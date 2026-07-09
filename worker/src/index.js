import { generateTEIFXML as sharedGenerateTEIFXML, fmt3, esc, makeId } from '../../shared/teif-generator.js';
import { initSigner, signTeifXml, submitToTtn, submitToRelay } from './xades.js';

function addCORS(res) {
  if (res && res.headers) {
    res.headers.set('Access-Control-Allow-Origin', '*');
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  }
  return res;
}

function json(data, status = 200) {
  return addCORS(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }));
}

async function handleOptions() {
  return addCORS(new Response(null, { status: 204 }));
}

async function verifyToken(token, secret) {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) return null;
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch { return null; }
}

async function requireAuth(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyToken(auth.slice(7), env.JWT_SECRET);
}

function supabaseFetch(url, options, env) {
  const fullUrl = env.SUPABASE_URL + url;
  return fetch(fullUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      ...options?.headers,
    },
  });
}

// -----------------------------------------------------------------------
// Auth
// -----------------------------------------------------------------------
async function apiLogin(request, env) {
  const { email, password } = await request.json();
  const res = await supabaseFetch('/rest/v1/profiles?select=id,email,name,role&email=eq.' + encodeURIComponent(email), {}, env);
  const users = await res.json();
  const user = Array.isArray(users) ? users[0] : null;
  if (!user) return addCORS(json({ message: 'Utilisateur non trouvé' }, 401));
  const payload = { userId: user.id, email: user.email, role: user.role || 'comptable' };
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadEnc = btoa(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 }));
  const keyBytes = new TextEncoder().encode(env.JWT_SECRET);
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(header + '.' + payloadEnc));
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return addCORS(json({ token: `${header}.${payloadEnc}.${signature}`, user: { id: user.id, email: user.email, name: user.name || user.email, role: user.role } }));
}

async function apiDevToken(request, env) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = JSON.stringify({ userId: 'dev-user', email: 'dev@local.host', role: 'admin', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 });
  const payloadEnc = btoa(payload);
  const keyBytes = new TextEncoder().encode(env.JWT_SECRET);
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(header + '.' + payloadEnc));
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return addCORS(json({ token: `${header}.${payloadEnc}.${signature}`, message: 'Token de développement - utilisez dans TEIF' }));
}

// -----------------------------------------------------------------------
// Companies
// -----------------------------------------------------------------------
async function apiCompanies(request, env) {
  const user = await requireAuth(request, env);
  if (!user) return addCORS(json({ message: 'Non autorisé' }, 401));
  const res = await supabaseFetch('/rest/v1/companies?select=id,name,matricule_fiscal,adresse', {}, env);
  const companies = await res.json();
  return addCORS(json((Array.isArray(companies) ? companies : []).map(c => ({ id: c.id, name: c.name, tax_id: c.matricule_fiscal || '', address: c.adresse || '' }))));
}

// -----------------------------------------------------------------------
// Invoices
// -----------------------------------------------------------------------
async function apiCompanyInvoices(request, env, ctx) {
  const user = await requireAuth(request, env);
  if (!user) return addCORS(json({ message: 'Non autorisé' }, 401));
  const res = await supabaseFetch(`/rest/v1/invoices?company_id=eq.${ctx.params.companyId}&select=*`, {}, env);
  const invoicesData = await res.json();
  return addCORS(json((Array.isArray(invoicesData) ? invoicesData : []).map(inv => ({
    id: inv.id, company_id: inv.company_id, invoice_number: inv.invoice_number || '', client_name: inv.client_name || '',
    client_tax_id: inv.client_vat || '', issue_date: inv.issue_date || '', lines: inv.items || inv.lines || [],
    totals: { subtotalHT: { amount: Number(inv.subtotal || 0), currency: 'TND' }, totalTax: { amount: Number(inv.vat_amount || 0), currency: 'TND' }, totalTTC: { amount: Number(inv.total_amount || 0), currency: 'TND' } },
    status: inv.status || 'DRAFT', teif_status: inv.teif_status || 'NONE', teif_xml: inv.teif_xml || null, middleware_document_id: inv.middleware_document_id || null,
    created_at: inv.created_at, updated_at: inv.updated_at,
  }))));
}

async function apiSubmitInvoice(request, env, ctx) {
  const user = await requireAuth(request, env);
  if (!user) return addCORS(json({ message: 'Non autorisé' }, 401));
  const invoiceId = ctx.params.id;
  const res = await supabaseFetch(`/rest/v1/invoices?id=eq.${invoiceId}&select=*`, {}, env);
  const invoices = await res.json();
  const inv = Array.isArray(invoices) ? invoices[0] : null;
  if (!inv) return addCORS(json({ message: 'Facture non trouvée' }, 404));
  const documentId = `TEIF-${inv.invoice_number || invoiceId}-${Date.now().toString(36)}`;
  const teifXml = `<?xml version="1.0"?><Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"><cbc:ID>${inv.invoice_number || ''}</cbc:ID><cbc:IssueDate>${inv.issue_date || ''}</cbc:IssueDate></Invoice>`;
  await supabaseFetch(`/rest/v1/invoices?id=eq.${invoiceId}`, {
    method: 'PATCH',
    body: JSON.stringify({ teif_status: 'PENDING', teif_xml: teifXml, middleware_document_id: documentId, updated_at: new Date().toISOString() }),
    headers: { Prefer: 'return=minimal' },
  }, env);
  return addCORS(json({ documentId, signatureUrl: null, status: 'PENDING' }));
}

async function apiSyncTeifStatus(request, env, ctx) {
  const user = await requireAuth(request, env);
  if (!user) return addCORS(json({ message: 'Non autorisé' }, 401));
  const res = await supabaseFetch(`/rest/v1/invoices?id=eq.${ctx.params.id}&select=teif_status,middleware_document_id`, {}, env);
  const data = await res.json();
  const inv = Array.isArray(data) ? data[0] : null;
  if (!inv) return addCORS(json({ message: 'Facture non trouvée' }, 404));
  return addCORS(json({ status: inv.teif_status || 'NONE', documentId: inv.middleware_document_id || null }));
}

// -----------------------------------------------------------------------
// Middleware API — compatibilité avec le frontend (sendToMiddleware)
// -----------------------------------------------------------------------

function requireApiKey(request, env) {
  const apiKey = env.API_KEY;
  if (!apiKey) return true; // No key configured = open (dev mode)
  const header = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.slice(7) || '';
  return header === apiKey;
}

async function apiCreateDocument(request, env) {
  if (!requireApiKey(request, env)) return addCORS(json({ message: 'Non autorisé — X-API-Key invalide' }, 401));

  let body;
  try { body = await request.json(); } catch { return addCORS(json({ message: 'JSON invalide' }, 400)); }

  // Accepter soit { data: [{ invoice: DocumentSchema, pdf: "" }] } (middleware format)
  // soit directement le payload { invoice, companyId, teifInvoice } (format frontend)
  const doc = body.data?.[0]?.invoice || body.invoice;
  if (!doc) return addCORS(json({ message: 'Format invalide — invoice requis' }, 400));

  const companyId = body.companyId || '';

  // Extraire les champs pour generateTEIFXML
  const teifInvoice = {
    id: doc.header?.documentNumber || doc.documentNumber || '',
    invoiceNumber: doc.header?.documentNumber || doc.documentNumber || '',
    dateEmission: doc.header?.issueDate || doc.issueDate || new Date().toISOString().slice(0, 10),
    type: doc.header?.type === 'CREDIT_NOTE' ? '381' : '380',
    timbre: 0,
    fournisseur: {
      matriculeFiscal: doc.seller?.identifier || '',
      nom: doc.seller?.name || '',
      adresse: doc.seller?.address?.street || '',
    },
    client: {
      matriculeFiscal: doc.buyer?.identifier || '',
      nom: doc.buyer?.name || 'Client',
      adresse: doc.buyer?.address?.street || '',
    },
    lignes: (doc.lines || []).map(l => ({
      designation: l.description || 'Prestation',
      quantite: l.quantity || 1,
      prixUnitaireHT: l.unitPrice?.amount || 0,
      tauxTVA: l.taxRate || 19,
      fodec: 0,
    })),
  };

  const sellerConfig = {
    matriculeFiscal: teifInvoice.fournisseur?.matriculeFiscal || '',
    nom: teifInvoice.fournisseur?.nom || '',
    adresse: teifInvoice.fournisseur?.adresse || '',
  };
  let gen;
  try { gen = sharedGenerateTEIFXML(teifInvoice, sellerConfig); } catch (err) { return addCORS(json({ message: err.message }, 400)); }

  const documentNumber = teifInvoice.id;
  const documentId = `TEIF-${documentNumber}-${Date.now().toString(36)}`;

  // Sauvegarder dans Supabase — créer ou mettre à jour
  const existingRes = await supabaseFetch(`/rest/v1/invoices?invoice_number=eq.${encodeURIComponent(documentNumber)}&company_id=eq.${encodeURIComponent(companyId)}&select=id`, {}, env);
  const existing = await existingRes.json();
  const invId = Array.isArray(existing) && existing.length > 0 ? existing[0].id : null;

  if (invId) {
    await supabaseFetch(`/rest/v1/invoices?id=eq.${invId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        teif_status: 'PENDING', teif_xml: gen.xml, middleware_document_id: documentId,
        updated_at: new Date().toISOString(),
      }),
      headers: { Prefer: 'return=minimal' },
    }, env);
  }

  // Signature XAdES-BES automatique si le certificat est configuré
  let signedXml = gen.xml;
  let signatureUUID = null;

  if (env.TUNTRUST_PFX && env.TUNTRUST_PFX_PASSWORD) {
    try {
      const signer = await initSigner(env.TUNTRUST_PFX, env.TUNTRUST_PFX_PASSWORD);
      signedXml = await signTeifXml(gen.xml, signer);
      signatureUUID = `xades-${documentId}-${Date.now().toString(36)}`;
    } catch (err) {
      return addCORS(json({
        message: 'Erreur signature XAdES-BES: ' + err.message,
        documentId, documentNumber,
        status: 'rejected',
        signatureUUID: null,
        signatureUrl: null,
      }));
    }
  }

  // Sauvegarder le XML signé
  if (invId && signedXml !== gen.xml) {
    await supabaseFetch(`/rest/v1/invoices?id=eq.${invId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        teif_xml: signedXml,
        teif_status: 'SIGNED',
        updated_at: new Date().toISOString(),
      }),
      headers: { Prefer: 'return=minimal' },
    }, env);
  }

  // Soumission TTN automatique
  let ttnResult = null;
  if (signedXml !== gen.xml) {
    if (env.TTN_RELAY_URL) {
      ttnResult = await submitToRelay(signedXml, env.TTN_RELAY_URL, env.TTN_RELAY_TOKEN || '');
    } else if (env.TTN_SOAP_URL) {
      ttnResult = await submitToTtn(signedXml, {
        soapUrl: env.TTN_SOAP_URL,
        username: env.TTN_USERNAME || '',
        password: env.TTN_PASSWORD || '',
      });
    }
  }

  if (ttnResult) {
    const finalStatus = ttnResult.status === 'accepted' ? 'ACCEPTED' : 'REJECTED';
    if (invId) {
      await supabaseFetch(`/rest/v1/invoices?id=eq.${invId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          teif_status: finalStatus,
          teif_xml: signedXml,
          ttn_id: ttnResult.ttnId || null,
          updated_at: new Date().toISOString(),
        }),
        headers: { Prefer: 'return=minimal' },
      }, env);
    }
    return addCORS(json({
      message: ttnResult.status === 'accepted'
        ? `Document signé et transmis à TTN (ID: ${ttnResult.ttnId || documentNumber})`
        : 'Échec transmission TTN',
      signatureUUID,
      signatureUrl: null,
      documentId,
      documentNumber,
      status: finalStatus,
      ttnId: ttnResult.ttnId || null,
      errors: ttnResult.errors || null,
    }));
  }

  // Pas de soumission TTN — retourner le statut selon si signé ou pas
  const hasSig = !!signatureUUID;
  return addCORS(json({
    message: hasSig
      ? 'XML TEIF signé — en attente de transmission TTN'
      : 'TEIF XML généré et enregistré.',
    signatureUUID,
    signatureUrl: null,
    documentId,
    documentNumber,
    status: hasSig ? 'SIGNED' : 'PENDING',
  }));
}

async function apiDocumentStatus(request, env, ctx) {
  if (!requireApiKey(request, env)) return addCORS(json({ message: 'Non autorisé' }, 401));

  const invoiceNumber = ctx.params.invoiceNumber;
  if (!invoiceNumber) return addCORS(json({ message: 'Numéro de facture requis' }, 400));

  const res = await supabaseFetch(`/rest/v1/invoices?invoice_number=eq.${encodeURIComponent(invoiceNumber)}&select=teif_status,middleware_document_id,invoice_number`, {}, env);
  const data = await res.json();
  const inv = Array.isArray(data) ? data[0] : null;
  if (!inv) return addCORS(json({ code: 'DOCUMENT_NOT_FOUND', error: `Document ${invoiceNumber} non trouvé` }, 404));

  return addCORS(json({
    invoiceNumber: inv.invoice_number,
    status: inv.teif_status || 'NONE',
    documentId: inv.middleware_document_id || null,
  }));
}

async function apiSeedDefaults(request, env) {
  const user = await requireAuth(request, env);
  if (!user) return addCORS(json({ message: 'Non autorisé' }, 401));
  const compRes = await supabaseFetch('/rest/v1/companies?select=id&limit=1', {}, env);
  const companies = await compRes.json();
  if (!Array.isArray(companies) || companies.length === 0) return addCORS(json({ ok: false, message: 'Aucune société trouvée. Créez-en une dans Configuration.' }));
  return addCORS(json({ ok: true, companyId: companies[0].id }));
}

async function apiHealth() {
  return addCORS(json({ status: 'ok', service: 'smart-comptable-teif-worker', version: '2.0' }));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === 'OPTIONS') return handleOptions();
    try {
      if (path === '/api/health' && request.method === 'GET') return await apiHealth();
      if (path === '/api/auth/login' && request.method === 'POST') return await apiLogin(request, env);
      if (path === '/api/auth/dev-token') return await apiDevToken(request, env);
      if (path === '/api/companies' && request.method === 'GET') return await apiCompanies(request, env);
      if (path === '/api/seed-defaults') return await apiSeedDefaults(request, env);

      // v1 API — compatible middleware
      if (path === '/api/v1/documents' && request.method === 'POST') return await apiCreateDocument(request, env);
      const matchStatus = path.match(/^\/api\/v1\/documents\/status\/(.+)$/);
      if (matchStatus && request.method === 'GET') return await apiDocumentStatus(request, env, { params: { invoiceNumber: matchStatus[1] } });

      const matchInvoices = path.match(/^\/api\/invoices\/company\/(.+)$/);
      if (matchInvoices && request.method === 'GET') return await apiCompanyInvoices(request, env, { params: { companyId: matchInvoices[1] } });
      const matchSubmit = path.match(/^\/api\/invoices\/(.+)\/submit$/);
      if (matchSubmit && request.method === 'POST') return await apiSubmitInvoice(request, env, { params: { id: matchSubmit[1] } });
      const matchSync = path.match(/^\/api\/invoices\/(.+)\/sync-teif-status$/);
      if (matchSync && request.method === 'POST') return await apiSyncTeifStatus(request, env, { params: { id: matchSync[1] } });

      return addCORS(json({ message: 'Not found' }, 404));
    } catch (err) {
      return addCORS(json({ message: err.message }, 500));
    }
  },
};
