import { createCors, error, json, withParams } from 'itty-router';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function cors(res) {
  if (res && res.headers) {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
  }
  return res;
}

async function handleOptions(request) {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

async function verifyToken(token, secret) {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) return null;
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

async function requireAuth(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyToken(auth.slice(7), env.JWT_SECRET);
}

function supabaseFetch(url, options, env) {
  const supabaseUrl = env.SUPABASE_URL;
  const fullUrl = supabaseUrl + url;
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

async function apiLogin(request, env) {
  const { email, password } = await request.json();
  const res = await supabaseFetch('/rest/v1/profiles?select=id,email,name,role&email=eq.' + encodeURIComponent(email), {}, env);
  const users = await res.json();
  const user = Array.isArray(users) ? users[0] : null;
  if (!user) {
    return cors(json({ message: 'Utilisateur non trouvé' }, 401));
  }
  const payload = { userId: user.id, email: user.email, role: user.role || 'comptable' };
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadEnc = btoa(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 }));
  const keyBytes = new TextEncoder().encode(env.JWT_SECRET);
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(header + '.' + payloadEnc));
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const token = header + '.' + payloadEnc + '.' + signature;
  return cors(json({ token, user: { id: user.id, email: user.email, name: user.name || user.email, role: user.role } }));
}

async function apiDevToken(request, env) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = JSON.stringify({ userId: 'dev-user', email: 'dev@local.host', role: 'admin', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 });
  const payloadEnc = btoa(payload);
  const keyBytes = new TextEncoder().encode(env.JWT_SECRET);
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(header + '.' + payloadEnc));
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const token = header + '.' + payloadEnc + '.' + signature;
  return cors(json({ token, message: 'Token de développement - utilisez dans TEIF' }));
}

async function apiCompanies(request, env) {
  const user = await requireAuth(request, env);
  if (!user) return cors(json({ message: 'Non autorisé' }, 401));
  const res = await supabaseFetch('/rest/v1/companies?select=id,name,matricule_fiscal,adresse', {}, env);
  const companies = await res.json();
  const list = (Array.isArray(companies) ? companies : []).map(c => ({
    id: c.id,
    name: c.name,
    tax_id: c.matricule_fiscal || '',
    address: c.adresse || '',
  }));
  return cors(json(list));
}

async function apiCompanyInvoices(request, env, ctx) {
  const user = await requireAuth(request, env);
  if (!user) return cors(json({ message: 'Non autorisé' }, 401));
  const companyId = ctx.params.companyId;
  const res = await supabaseFetch(`/rest/v1/invoices?company_id=eq.${companyId}&select=*`, {}, env);
  const invoicesData = await res.json();
  const invoices = (Array.isArray(invoicesData) ? invoicesData : []).map(inv => ({
    id: inv.id,
    company_id: inv.company_id,
    invoice_number: inv.invoice_number || inv.invoiceNumber || '',
    client_name: inv.client_name || inv.clientName || '',
    client_tax_id: inv.client_vat || inv.clientVat || '',
    issue_date: inv.issue_date || inv.issueDate || '',
    lines: inv.items || inv.lines || [],
    totals: {
      subtotalHT: { amount: Number(inv.subtotal || 0), currency: 'TND' },
      totalTax: { amount: Number(inv.vat_amount || inv.vatAmount || 0), currency: 'TND' },
      totalTTC: { amount: Number(inv.total_amount || inv.totalAmount || 0), currency: 'TND' },
    },
    status: inv.status || 'DRAFT',
    teif_status: inv.teif_status || 'NONE',
    teif_xml: inv.teif_xml || null,
    middleware_document_id: inv.middleware_document_id || null,
    created_at: inv.created_at,
    updated_at: inv.updated_at,
  }));
  return cors(json(invoices));
}

async function apiSubmitInvoice(request, env, ctx) {
  const user = await requireAuth(request, env);
  if (!user) return cors(json({ message: 'Non autorisé' }, 401));
  const invoiceId = ctx.params.id;
  const { companyTaxId } = await request.json();
  const res = await supabaseFetch(`/rest/v1/invoices?id=eq.${invoiceId}&select=*`, {}, env);
  const invoices = await res.json();
  const inv = Array.isArray(invoices) ? invoices[0] : null;
  if (!inv) return cors(json({ message: 'Facture non trouvée' }, 404));
  const documentId = `TEIF-${inv.invoice_number || inv.invoiceNumber || invoiceId}-${Date.now()}`;
  const teifXml = `<?xml version="1.0"?><Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"><cbc:ID>${inv.invoice_number || inv.invoiceNumber || ''}</cbc:ID><cbc:IssueDate>${inv.issue_date || inv.issueDate || ''}</cbc:IssueDate></Invoice>`;
  const updateRes = await supabaseFetch(`/rest/v1/invoices?id=eq.${invoiceId}`, {
    method: 'PATCH',
    body: JSON.stringify({ teif_status: 'PENDING', teif_xml: teifXml, middleware_document_id: documentId, updated_at: new Date().toISOString() }),
    headers: { Prefer: 'return=minimal' },
  }, env);
  return cors(json({ documentId, signatureUrl: null, status: 'PENDING' }));
}

async function apiSyncTeifStatus(request, env, ctx) {
  const user = await requireAuth(request, env);
  if (!user) return cors(json({ message: 'Non autorisé' }, 401));
  const invoiceId = ctx.params.id;
  const res = await supabaseFetch(`/rest/v1/invoices?id=eq.${invoiceId}&select=teif_status,middleware_document_id`, {}, env);
  const data = await res.json();
  const inv = Array.isArray(data) ? data[0] : null;
  if (!inv) return cors(json({ message: 'Facture non trouvée' }, 404));
  return cors(json({ status: inv.teif_status || 'NONE', documentId: inv.middleware_document_id || null }));
}

async function apiSeedDefaults(request, env) {
  const user = await requireAuth(request, env);
  if (!user) return cors(json({ message: 'Non autorisé' }, 401));
  const compRes = await supabaseFetch('/rest/v1/companies?select=id&limit=1', {}, env);
  const companies = await compRes.json();
  if (!Array.isArray(companies) || companies.length === 0) {
    return cors(json({ ok: false, message: 'Aucune société trouvée. Créez-en une dans Configuration.' }));
  }
  return cors(json({ ok: true, companyId: companies[0].id }));
}

async function apiHealth() {
  return cors(json({ status: 'ok', service: 'smart-comptable-teif-worker' }));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === 'OPTIONS') return handleOptions(request);
    try {
      if (path === '/api/health' && request.method === 'GET') return apiHealth();
      if (path === '/api/auth/login' && request.method === 'POST') return apiLogin(request, env);
      if (path === '/api/auth/dev-token') return apiDevToken(request, env);
      if (path === '/api/companies' && request.method === 'GET') return apiCompanies(request, env);
      if (path === '/api/seed-defaults') return apiSeedDefaults(request, env);
      const matchInvoices = path.match(/^\/api\/invoices\/company\/(.+)$/);
      if (matchInvoices && request.method === 'GET') return apiCompanyInvoices(request, env, { params: { companyId: matchInvoices[1] } });
      const matchSubmit = path.match(/^\/api\/invoices\/(.+)\/submit$/);
      if (matchSubmit && request.method === 'POST') return apiSubmitInvoice(request, env, { params: { id: matchSubmit[1] } });
      const matchSync = path.match(/^\/api\/invoices\/(.+)\/sync-teif-status$/);
      if (matchSync && request.method === 'POST') return apiSyncTeifStatus(request, env, { params: { id: matchSync[1] } });
      return cors(json({ message: 'Not found' }, 404));
    } catch (err) {
      return cors(json({ message: err.message }, 500));
    }
  },
};
