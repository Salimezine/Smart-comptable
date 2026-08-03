import { generateTEIFXML as sharedGenerateTEIFXML, fmt3, esc, makeId } from '../../shared/teif-generator.js';
import { initSigner, signTeifXml, submitToTtn, submitToRelay } from './xades.js';

// ==========================================================================
//  Helpers
// ==========================================================================
function addCORS(res) {
  if (res && res.headers) {
    res.headers.set('Access-Control-Allow-Origin', '*');
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
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

const TYPE_COLUMNS = new Set(['profiles', 'companies', 'company_members']);
const GENERIC_TABLES = new Set([
  'journal_entries', 'invoices', 'expenses', 'transactions', 'stock', 'stock_mouvements',
  'pieces_comptables', 'employees', 'payroll_slips', 'clients', 'fournisseurs',
  'tva_declarations', 'declarations_sociales', 'declarations_is',
  'declaration_templates', 'fiscal_knowledge', 'ocr_learning',
]);
const ALL_TABLES = new Set([...TYPE_COLUMNS, ...GENERIC_TABLES]);

function isAllowedTable(table) { return ALL_TABLES.has(table); }

// --------------------------------------------------------------------------
// JWT (HS256)
// --------------------------------------------------------------------------
function b64url(obj) {
  if (obj instanceof Uint8Array || ArrayBuffer.isView(obj)) {
    let bin = '';
    for (const b of obj) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
  const bytes = new TextEncoder().encode(typeof obj === 'string' ? obj : JSON.stringify(obj));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  return atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
}

function b64urlBytes(str) {
  const bin = b64urlDecode(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function signJWT(env, payload) {
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const body = b64url({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 });
  const keyBytes = new TextEncoder().encode(env.JWT_SECRET);
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(`${header}.${body}`));
  return `${header}.${body}.${b64url(new Uint8Array(sig))}`;
}

async function verifyToken(token, env) {
  try {
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return null;
    const keyBytes = new TextEncoder().encode(env.JWT_SECRET);
    const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sigBytes = b64urlBytes(s);
    const ok = await crypto.subtle.verify(
      'HMAC',
      cryptoKey,
      sigBytes,
      new TextEncoder().encode(`${h}.${p}`)
    );
    if (!ok) return null;
    const payload = JSON.parse(b64urlDecode(p));
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch { return null; }
}

async function requireAuth(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyToken(auth.slice(7), env);
}

// --------------------------------------------------------------------------
//  D1 data access (generic tables store full record JSON in `data`)
// --------------------------------------------------------------------------
function nowIso() { return new Date().toISOString(); }

async function dbList(env, table, companyId, since) {
  if (since) {
    const rows = await env.DB.prepare(`SELECT id, data, updated_at FROM ${table} WHERE company_id = ? AND updated_at > ?`)
      .bind(companyId, since).all();
    return rows.results.map(r => ({ ...JSON.parse(r.data), id: r.id, company_id: companyId, updated_at: r.updated_at }));
  }
  const rows = await env.DB.prepare(`SELECT id, data, updated_at FROM ${table} WHERE company_id = ?`)
    .bind(companyId).all();
  return rows.results.map(r => ({ ...JSON.parse(r.data), id: r.id, company_id: companyId, updated_at: r.updated_at }));
}

async function dbUpsert(env, table, record, companyId) {
  const id = record.id || crypto.randomUUID();
  const data = JSON.stringify({ ...record, id, company_id: companyId });
  const ts = nowIso();
  await env.DB.prepare(
    `INSERT INTO ${table} (id, company_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
  ).bind(id, companyId, data, ts, ts).run();
  return { ...record, id, company_id: companyId, updated_at: ts };
}

async function dbDelete(env, table, id) {
  await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
}

async function dbGet(env, table, id) {
  const row = await env.DB.prepare(`SELECT id, company_id, data FROM ${table} WHERE id = ?`).bind(id).first();
  if (!row) return null;
  return { ...JSON.parse(row.data), id: row.id, company_id: row.company_id };
}

// -----------------------------------------------------------------------
// Auth
// -----------------------------------------------------------------------
async function apiRegister(request, env) {
  const body = await request.json();
  const { email, password, nom, prenom } = body;
  if (!email || !password) return json({ message: 'Email et mot de passe requis' }, 400);
  const existing = await env.DB.prepare('SELECT id FROM profiles WHERE email = ?').bind(email).first();
  if (existing) return json({ message: 'Cet email est déjà utilisé' }, 409);
  const id = crypto.randomUUID();
  const keyBytes = new TextEncoder().encode(password + ':' + env.JWT_SECRET);
  const digest = await crypto.subtle.digest('SHA-256', keyBytes);
  const password_hash = b64url(new Uint8Array(digest));
  const ts = nowIso();
  await env.DB.prepare(
    `INSERT INTO profiles (id, email, password_hash, nom, prenom, role, plan, actif, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'comptable', 'free', 1, ?, ?)`
  ).bind(id, email, password_hash, nom || '', prenom || '', ts, ts).run();
  const token = await signJWT(env, { userId: id, email, role: 'comptable' });
  return json({ token, user: { id, email, name: nom || email, role: 'comptable' } });
}

async function apiLogin(request, env) {
  const { email, password } = await request.json();
  const row = await env.DB.prepare('SELECT * FROM profiles WHERE email = ?').bind(email).first();
  if (!row) return json({ message: 'Utilisateur non trouvé' }, 401);
  const keyBytes = new TextEncoder().encode(password + ':' + env.JWT_SECRET);
  const digest = await crypto.subtle.digest('SHA-256', keyBytes);
  const hash = b64url(new Uint8Array(digest));
  if (hash !== row.password_hash) return json({ message: 'Mot de passe incorrect' }, 401);
  const token = await signJWT(env, { userId: row.id, email: row.email, role: row.role || 'comptable' });
  return json({ token, user: { id: row.id, email: row.email, name: row.nom || row.email, role: row.role || 'comptable', plan: row.plan || 'free' } });
}

// -----------------------------------------------------------------------
// Companies
// -----------------------------------------------------------------------
async function apiCompanies(request, env) {
  const user = await requireAuth(request, env);
  if (!user) return json({ message: 'Non autorisé' }, 401);
  const rows = await env.DB.prepare(
    `SELECT c.* FROM companies c JOIN company_members m ON m.company_id = c.id WHERE m.user_id = ? AND m.is_active = 1`
  ).bind(user.userId).all();
  return json((rows.results || []).map(c => ({
    id: c.id, name: c.name, tax_id: c.matricule_fiscal || '', address: c.adresse || '',
    owner_id: c.owner_id, plan: c.plan || 'free', settings: c.settings ? JSON.parse(c.settings) : null,
  })));
}

async function apiCreateCompany(request, env) {
  const user = await requireAuth(request, env);
  if (!user) return json({ message: 'Non autorisé' }, 401);
  const body = await request.json();
  const id = crypto.randomUUID();
  const ts = nowIso();
  await env.DB.prepare(
    `INSERT INTO companies (id, owner_id, name, matricule_fiscal, adresse, plan, settings, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, user.userId, body.name || 'Ma Société', body.matricule_fiscal || '', body.adresse || '', body.plan || 'free', body.settings ? JSON.stringify(body.settings) : null, ts, ts).run();
  await env.DB.prepare(
    `INSERT INTO company_members (company_id, user_id, role, is_active) VALUES (?, ?, 'admin', 1)`
  ).bind(id, user.userId).run();
  return json({ id, name: body.name, owner_id: user.userId });
}

// -----------------------------------------------------------------------
// Generic CRUD over D1
// -----------------------------------------------------------------------
async function apiDataList(request, env, ctx) {
  const user = await requireAuth(request, env);
  if (!user) return json({ message: 'Non autorisé' }, 401);
  const table = ctx.params.table;
  if (!isAllowedTable(table)) return json({ message: 'Table inconnue' }, 404);
  const url = new URL(request.url);
  const companyId = url.searchParams.get('company_id');
  const since = url.searchParams.get('since');
  if (!companyId) return json({ message: 'company_id requis' }, 400);
  const data = await dbList(env, table, companyId, since || null);
  return json(data);
}

async function apiDataUpsert(request, env, ctx) {
  const user = await requireAuth(request, env);
  if (!user) return json({ message: 'Non autorisé' }, 401);
  const table = ctx.params.table;
  if (!isAllowedTable(table)) return json({ message: 'Table inconnue' }, 404);
  const body = await request.json();
  const companyId = body.company_id;
  const records = Array.isArray(body) ? body : (body.records || [body]);
  if (!companyId) return json({ message: 'company_id requis' }, 400);
  const saved = [];
  for (const r of records) {
    saved.push(await dbUpsert(env, table, { ...r, company_id: companyId }, companyId));
  }
  return json(saved);
}

async function apiDataDelete(request, env, ctx) {
  const user = await requireAuth(request, env);
  if (!user) return json({ message: 'Non autorisé' }, 401);
  const table = ctx.params.table;
  if (!isAllowedTable(table)) return json({ message: 'Table inconnue' }, 404);
  const id = ctx.params.id;
  await dbDelete(env, table, id);
  return json({ ok: true, id });
}

async function apiDataPatch(request, env, ctx) {
  const user = await requireAuth(request, env);
  if (!user) return json({ message: 'Non autorisé' }, 401);
  const table = ctx.params.table;
  if (!isAllowedTable(table)) return json({ message: 'Table inconnue' }, 404);
  const id = ctx.params.id;
  const updates = await request.json();
  const existing = await dbGet(env, table, id);
  if (!existing) return json({ message: 'Enregistrement non trouvé' }, 404);
  const merged = await dbUpsert(env, table, { ...existing, ...updates, id }, existing.company_id);
  return json(merged);
}

// -----------------------------------------------------------------------
// Import batch (migration Supabase → D1)
// -----------------------------------------------------------------------
async function apiImport(request, env) {
  const user = await requireAuth(request, env);
  if (!user) return json({ message: 'Non autorisé' }, 401);
  const body = await request.json();
  // body = { company_id, tables: { tableName: [records...] } }
  const companyId = body.company_id;
  if (!companyId) return json({ message: 'company_id requis' }, 400);
  const results = {};
  for (const [table, records] of Object.entries(body.tables || {})) {
    if (!isAllowedTable(table) || !Array.isArray(records)) continue;
    let count = 0;
    for (const r of records) { await dbUpsert(env, table, r, companyId); count++; }
    results[table] = count;
  }
  return json({ ok: true, results });
}

// -----------------------------------------------------------------------
// Invoices (TEIF) — now backed by D1
// -----------------------------------------------------------------------
async function apiCompanyInvoices(request, env, ctx) {
  const user = await requireAuth(request, env);
  if (!user) return json({ message: 'Non autorisé' }, 401);
  const invoices = await dbList(env, 'invoices', ctx.params.companyId, null);
  return json(invoices.map(inv => ({
    id: inv.id, company_id: inv.company_id, invoice_number: inv.invoiceNumber || inv.invoice_number || '',
    client_name: inv.clientName || inv.client_name || '',
    client_tax_id: inv.clientVat || inv.client_vat || '',
    issue_date: inv.issueDate || inv.issue_date || '',
    lines: inv.items || inv.lines || [],
    totals: {
      subtotalHT: { amount: Number(inv.subtotal || 0), currency: 'TND' },
      totalTax: { amount: Number(inv.vatAmount || inv.vat_amount || 0), currency: 'TND' },
      totalTTC: { amount: Number(inv.totalAmount || inv.total_amount || 0), currency: 'TND' },
    },
    status: inv.status || 'DRAFT', teif_status: inv.teif_status || 'NONE',
    teif_xml: inv.teif_xml || null, middleware_document_id: inv.middleware_document_id || null,
    created_at: inv.created_at, updated_at: inv.updated_at,
  })));
}

async function apiSubmitInvoice(request, env, ctx) {
  const user = await requireAuth(request, env);
  if (!user) return json({ message: 'Non autorisé' }, 401);
  const invoiceId = ctx.params.id;
  const inv = await dbGet(env, 'invoices', invoiceId);
  if (!inv) return json({ message: 'Facture non trouvée' }, 404);
  const documentId = `TEIF-${inv.invoiceNumber || invoiceId}-${Date.now().toString(36)}`;
  const teifXml = `<?xml version="1.0"?><Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"><cbc:ID>${inv.invoiceNumber || ''}</cbc:ID><cbc:IssueDate>${inv.issueDate || ''}</cbc:IssueDate></Invoice>`;
  await dbUpsert(env, 'invoices', { ...inv, teif_status: 'PENDING', teif_xml: teifXml, middleware_document_id: documentId }, inv.company_id);
  return json({ documentId, signatureUrl: null, status: 'PENDING' });
}

async function apiSyncTeifStatus(request, env, ctx) {
  const user = await requireAuth(request, env);
  if (!user) return json({ message: 'Non autorisé' }, 401);
  const inv = await dbGet(env, 'invoices', ctx.params.id);
  if (!inv) return json({ message: 'Facture non trouvée' }, 404);
  return json({ status: inv.teif_status || 'NONE', documentId: inv.middleware_document_id || null });
}

// -----------------------------------------------------------------------
// Middleware API — compatibilité frontend (sendToMiddleware)
// -----------------------------------------------------------------------
function requireApiKey(request, env) {
  const apiKey = env.API_KEY;
  if (!apiKey) return true;
  const header = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.slice(7) || '';
  return header === apiKey;
}

async function apiCreateDocument(request, env) {
  if (!requireApiKey(request, env)) return json({ message: 'Non autorisé — X-API-Key invalide' }, 401);

  let body;
  try { body = await request.json(); } catch { return json({ message: 'JSON invalide' }, 400); }

  const doc = body.data?.[0]?.invoice || body.invoice;
  if (!doc) return json({ message: 'Format invalide — invoice requis' }, 400);

  const companyId = body.companyId || '';

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
  try { gen = sharedGenerateTEIFXML(teifInvoice, sellerConfig); } catch (err) { return json({ message: err.message }, 400); }

  const documentNumber = teifInvoice.id;
  const documentId = `TEIF-${documentNumber}-${Date.now().toString(36)}`;

  // Récupérer une facture existante (par numéro) ou créer
  const existing = await dbList(env, 'invoices', companyId, null);
  const found = existing.find(i => i.invoiceNumber === documentNumber || i.invoice_number === documentNumber);
  const invId = found ? found.id : null;

  let stored = { invoiceNumber: documentNumber, teif_status: 'PENDING', teif_xml: gen.xml, middleware_document_id: documentId, updated_at: nowIso(), ...(found || {}) };

  // Signature XAdES-BES automatique si le certificat est configuré
  let signedXml = gen.xml;
  let signatureUUID = null;

  if (env.TUNTRUST_PFX && env.TUNTRUST_PFX_PASSWORD) {
    try {
      const signer = await initSigner(env.TUNTRUST_PFX, env.TUNTRUST_PFX_PASSWORD);
      signedXml = await signTeifXml(gen.xml, signer);
      signatureUUID = `xades-${documentId}-${Date.now().toString(36)}`;
    } catch (err) {
      return json({
        message: 'Erreur signature XAdES-BES: ' + err.message,
        documentId, documentNumber,
        status: 'rejected',
        signatureUUID: null,
        signatureUrl: null,
      });
    }
  }

  if (signedXml !== gen.xml) {
    stored = { ...stored, teif_xml: signedXml, teif_status: 'SIGNED' };
  }
  await dbUpsert(env, 'invoices', stored, companyId);

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
    await dbUpsert(env, 'invoices', { ...stored, teif_status: finalStatus, teif_xml: signedXml, ttn_id: ttnResult.ttnId || null }, companyId);
    return json({
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
    });
  }

  const hasSig = !!signatureUUID;
  return json({
    message: hasSig ? 'XML TEIF signé — en attente de transmission TTN' : 'TEIF XML généré et enregistré.',
    signatureUUID,
    signatureUrl: null,
    documentId,
    documentNumber,
    status: hasSig ? 'SIGNED' : 'PENDING',
  });
}

async function apiDocumentStatus(request, env, ctx) {
  if (!requireApiKey(request, env)) return json({ message: 'Non autorisé' }, 401);
  const invoiceNumber = ctx.params.invoiceNumber;
  if (!invoiceNumber) return json({ message: 'Numéro de facture requis' }, 400);

  // Chercher dans toutes les compagnies (l'API key permet l'accès middleware)
  const tables = await env.DB.prepare('SELECT name FROM sqlite_master WHERE type = "table" AND name = "invoices"').first();
  if (!tables) return json({ code: 'DOCUMENT_NOT_FOUND', error: `Document ${invoiceNumber} non trouvé` }, 404);
  const rows = await env.DB.prepare(`SELECT data, company_id FROM invoices WHERE data LIKE ?`).bind(`%${invoiceNumber}%`).all();
  const inv = (rows.results || []).map(r => JSON.parse(r.data)).find(i => i.invoiceNumber === invoiceNumber || i.invoice_number === invoiceNumber);
  if (!inv) return json({ code: 'DOCUMENT_NOT_FOUND', error: `Document ${invoiceNumber} non trouvé` }, 404);
  return json({ invoiceNumber, status: inv.teif_status || 'NONE', documentId: inv.middleware_document_id || null });
}

async function apiHealth() {
  return json({ status: 'ok', service: 'smart-comptable-teif-worker', version: '3.0' });
}

// -----------------------------------------------------------------------
// Router
// -----------------------------------------------------------------------
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === 'OPTIONS') return handleOptions();
    try {
      if (path === '/api/health' && request.method === 'GET') return await apiHealth();

      // Auth
      if (path === '/api/auth/register' && request.method === 'POST') return await apiRegister(request, env);
      if (path === '/api/auth/login' && request.method === 'POST') return await apiLogin(request, env);

      // Companies
      if (path === '/api/companies' && request.method === 'GET') return await apiCompanies(request, env);
      if (path === '/api/companies' && request.method === 'POST') return await apiCreateCompany(request, env);

      // Import batch (migration)
      if (path === '/api/import' && request.method === 'POST') return await apiImport(request, env);

      // Generic CRUD /api/data/:table
      const matchData = path.match(/^\/api\/data\/([a-z_]+)$/);
      if (matchData) {
        const ctx2 = { params: { table: matchData[1] } };
        if (request.method === 'GET') return await apiDataList(request, env, ctx2);
        if (request.method === 'POST') return await apiDataUpsert(request, env, ctx2);
        if (request.method === 'PUT') return await apiDataUpsert(request, env, ctx2);
      }
      const matchDataId = path.match(/^\/api\/data\/([a-z_]+)\/(.+)$/);
      if (matchDataId) {
        const ctx2 = { params: { table: matchDataId[1], id: decodeURIComponent(matchDataId[2]) } };
        if (request.method === 'DELETE') return await apiDataDelete(request, env, ctx2);
        if (request.method === 'PATCH') return await apiDataPatch(request, env, ctx2);
      }

      // v1 API — compatible middleware
      if (path === '/api/v1/documents' && request.method === 'POST') return await apiCreateDocument(request, env);
      const matchStatus = path.match(/^\/api\/v1\/documents\/status\/(.+)$/);
      if (matchStatus && request.method === 'GET') return await apiDocumentStatus(request, env, { params: { invoiceNumber: decodeURIComponent(matchStatus[1]) } });

      const matchInvoices = path.match(/^\/api\/invoices\/company\/(.+)$/);
      if (matchInvoices && request.method === 'GET') return await apiCompanyInvoices(request, env, { params: { companyId: decodeURIComponent(matchInvoices[1]) } });
      const matchSubmit = path.match(/^\/api\/invoices\/(.+)\/submit$/);
      if (matchSubmit && request.method === 'POST') return await apiSubmitInvoice(request, env, { params: { id: decodeURIComponent(matchSubmit[1]) } });
      const matchSync = path.match(/^\/api\/invoices\/(.+)\/sync-teif-status$/);
      if (matchSync && request.method === 'POST') return await apiSyncTeifStatus(request, env, { params: { id: decodeURIComponent(matchSync[1]) } });

      return json({ message: 'Not found' }, 404);
    } catch (err) {
      return json({ message: err.message }, 500);
    }
  },
};
