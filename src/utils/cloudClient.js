// ==========================================================================
//  Cloudflare Workers + D1 client — remplace Supabase
//  Mêmes exports que supabaseService.js pour ne pas casser les appelants.
// ==========================================================================

const API_URL = (import.meta.env.VITE_API_URL || 'https://smart-comptable-teif-api.ezzinesalim21.workers.dev/api').replace(/\/$/, '');

let _token = (typeof localStorage !== 'undefined' ? localStorage.getItem('smart_api_token') : null) || '';

export const isSupabaseEnabled = () => API_URL ? true : false;
export const isCloudEnabled = () => true;

export function setApiToken(token) {
  _token = token || '';
  if (token) localStorage.setItem('smart_api_token', token);
  else localStorage.removeItem('smart_api_token');
}

export function getApiToken() {
  return _token;
}

function authHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (_token) h['Authorization'] = `Bearer ${_token}`;
  return h;
}

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
  if (!res.ok) {
    let msg;
    try { msg = (await res.json()).message || `HTTP ${res.status}`; } catch { msg = `HTTP ${res.status}`; }
    console.error(`[Cloud] ${options.method || 'GET'} ${path} → ${res.status}: ${msg}`);
    throw new Error(msg);
  }
  return res.json();
}

// ==============================
// SESSION
// ==============================
export async function hasSession() {
  return !!_token;
}

export async function getSession() {
  return _token ? { access_token: _token, user: await getCurrentUser() } : null;
}

export async function getCurrentUser() {
  if (!_token) return null;
  try {
    const [h, p] = _token.split('.');
    const payload = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')) || '{}');
    return { id: payload.userId, email: payload.email, role: payload.role };
  } catch { return null; }
}

// ==============================
// AUTH
// ==============================
export async function signUp(email, password, meta = {}) {
  try {
    const data = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, nom: meta.nom || '', prenom: meta.prenom || '' }),
    });
    if (data.token) setApiToken(data.token);
    return { data: { user: data.user, session: { access_token: data.token } }, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function signIn(email, password) {
  try {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.token) setApiToken(data.token);
    return { data: { user: data.user, session: { access_token: data.token } }, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function signOut() {
  _token = '';
  localStorage.removeItem('smart_api_token');
  localStorage.removeItem('sc_supabase_session');
}

export function onAuthChange() {
  return () => {};
}

// ==============================
// PROFILE
// ==============================
export async function getProfile(userId) {
  if (!_token) return null;
  try {
    const me = await getCurrentUser();
    return { id: me?.id, email: me?.email, role: me?.role };
  } catch { return null; }
}

export async function updateProfile(userId, updates) {
  return updates;
}

// ==============================
// COMPANIES
// ==============================
export async function getUserCompanies(userId) {
  if (!_token) return [];
  try {
    const list = await request('/companies');
    return list.map(c => ({ id: c.id, name: c.name, matricule_fiscal: c.tax_id, adresse: c.address, settings: c.settings, role: 'admin', owner_id: c.owner_id, plan: c.plan }));
  } catch { return []; }
}

export async function createCompany(values) {
  if (!_token) return null;
  try {
    const data = await request('/companies', {
      method: 'POST',
      body: JSON.stringify({ name: values.name || 'Ma Société', matricule_fiscal: values.matricule_fiscal || '', adresse: values.adresse || '', plan: values.plan || 'free' }),
    });
    return { id: data.id, name: data.name, owner_id: data.owner_id, plan: values.plan || 'free' };
  } catch { return null; }
}

export async function updateCompany(id, values) {
  return { id, ...values };
}

export async function fetchCompanySettings(companyId) {
  if (!_token) return null;
  try {
    const list = await request('/companies');
    const c = list.find(x => x.id === companyId);
    return c?.settings || null;
  } catch { return null; }
}

export async function saveCompanySettings(companyId, settings) {
  return settings;
}

// ==============================
// DATA LAYER — D1 via le worker, avec fallback localStorage
// ==============================
function lsKey(table, companyId) {
  return `${table}_${companyId}`;
}

function lsRead(table, companyId) {
  try {
    const raw = localStorage.getItem(lsKey(table, companyId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function lsWrite(table, companyId, data) {
  localStorage.setItem(lsKey(table, companyId), JSON.stringify(data));
}

function mergeRecords(existing, incoming) {
  const map = new Map();
  for (const r of existing || []) map.set(r.id, r);
  for (const r of incoming || []) map.set(r.id, r);
  return Array.from(map.values());
}

export async function fetchData(table, companyId, orderBy = 'created_at', ascending = false) {
  if (!navigator.onLine || !_token) return lsRead(table, companyId) || [];
  try {
    const data = await request(`/data/${table}?company_id=${encodeURIComponent(companyId)}`);
    if (Array.isArray(data)) {
      lsWrite(table, companyId, data);
      return data;
    }
    return lsRead(table, companyId) || [];
  } catch (e) {
    console.error(`[Cloud] fetchData ${table} failed:`, e?.message);
    return lsRead(table, companyId) || [];
  }
}

export async function fetchDataSince(table, companyId, since) {
  if (!navigator.onLine || !_token) return [];
  try {
    return await request(`/data/${table}?company_id=${encodeURIComponent(companyId)}&since=${encodeURIComponent(since)}`);
  } catch (e) {
    console.error(`[Cloud] fetchDataSince ${table} failed:`, e?.message);
    return [];
  }
}

export async function upsertData(table, companyId, records) {
  const withIds = (records || []).map(r => ({
    ...r,
    id: r.id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`),
    company_id: companyId,
  }));
  const existing = lsRead(table, companyId) || [];
  const merged = mergeRecords(existing, withIds);
  lsWrite(table, companyId, merged);
  if (navigator.onLine && _token) {
    try {
      await request(`/data/${table}`, { method: 'POST', body: JSON.stringify({ company_id: companyId, records: withIds }) });
    } catch (err) {
      console.warn('[Cloud] upsert failed (kept local):', err?.message);
      addToOfflineQueue({ table, companyId, records: withIds });
    }
  } else {
    addToOfflineQueue({ table, companyId, records: withIds });
  }
  return merged;
}

export async function insertData(table, companyId, record) {
  const enriched = {
    ...record,
    id: record.id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`),
    company_id: companyId,
  };
  const existing = lsRead(table, companyId) || [];
  existing.push(enriched);
  lsWrite(table, companyId, existing);
  if (navigator.onLine && _token) {
    try {
      await request(`/data/${table}`, { method: 'POST', body: JSON.stringify({ company_id: companyId, records: [enriched] }) });
    } catch (err) {
      console.warn('[Cloud] insert failed (kept local):', err?.message);
      addToOfflineQueue({ table, companyId, records: [enriched] });
    }
  } else {
    addToOfflineQueue({ table, companyId, records: [enriched] });
  }
  return enriched;
}

export async function updateData(table, companyId, id, updates) {
  const existing = lsRead(table, companyId) || [];
  const idx = existing.findIndex(r => r.id === id);
  let updated;
  if (idx >= 0) {
    updated = { ...existing[idx], ...updates, id, company_id: companyId };
    existing[idx] = updated;
  } else {
    updated = { ...updates, id, company_id: companyId };
    existing.push(updated);
  }
  lsWrite(table, companyId, existing);
  if (navigator.onLine && _token) {
    try {
      await request(`/data/${table}`, { method: 'POST', body: JSON.stringify({ company_id: companyId, records: [updated] }) });
    } catch (err) {
      console.warn('[Cloud] update failed (kept local):', err?.message);
      addToOfflineQueue({ table, companyId, records: [updated] });
    }
  } else {
    addToOfflineQueue({ table, companyId, records: [updated] });
  }
  return updated;
}

export async function deleteData(table, companyId, id) {
  const existing = lsRead(table, companyId) || [];
  lsWrite(table, companyId, existing.filter(r => r.id !== id));
  if (navigator.onLine && _token) {
    try {
      await request(`/data/${table}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('[Cloud] delete failed (kept local):', err?.message);
      addToOfflineQueue({ table, companyId, records: [{ _delete: true, id }] });
    }
  } else {
    addToOfflineQueue({ table, companyId, records: [{ _delete: true, id }] });
  }
  return true;
}

export function findCompanyByRecord(table, id) {
  const prefix = `${table}_`;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    const cid = key.slice(prefix.length);
    const data = lsRead(table, cid) || [];
    if (data.some(r => r.id === id)) return cid;
  }
  return null;
}

export async function updateDataById(table, id, updates) {
  const companyId = findCompanyByRecord(table, id);
  if (companyId) return updateData(table, companyId, id, updates);
  // Pas de copie locale : tenter le cloud par id
  if (navigator.onLine && _token) {
    try {
      await request(`/data/${table}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(updates) });
      return { id, ...updates };
    } catch (err) {
      console.warn('[Cloud] updateById failed:', err?.message);
    }
  }
  return null;
}

export async function deleteDataById(table, id) {
  const companyId = findCompanyByRecord(table, id);
  if (companyId) return deleteData(table, companyId, id);
  if (navigator.onLine && _token) {
    try {
      await request(`/data/${table}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      return true;
    } catch (err) {
      console.warn('[Cloud] deleteById failed:', err?.message);
    }
  }
  return true;
}

// ==============================
// IMPORT / MIGRATION
// ==============================
export async function importToCloud(companyId, tables) {
  if (!_token) return { success: false, reason: 'Non connecté' };
  try {
    return await request('/import', { method: 'POST', body: JSON.stringify({ company_id: companyId, tables }) });
  } catch (error) {
    return { success: false, reason: error.message };
  }
}

// ==============================
// OFFLINE QUEUE
// ==============================
const OFFLINE_QUEUE_KEY = 'smart_offline_queue';

function getOfflineQueue() {
  try { return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]'); } catch { return []; }
}

function setOfflineQueue(q) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q));
}

function addToOfflineQueue(op) {
  const q = getOfflineQueue();
  q.push({ ...op, queued_at: new Date().toISOString() });
  setOfflineQueue(q);
}

export async function flushOfflineQueue() {
  if (!navigator.onLine || !_token) return;
  const q = getOfflineQueue();
  if (q.length === 0) return;
  const failed = [];
  for (const op of q) {
    try {
      if (op.records?.every(r => r._delete)) {
        for (const r of op.records) {
          if (r.id) await request(`/data/${op.table}/${encodeURIComponent(r.id)}`, { method: 'DELETE' });
        }
      } else {
        await request(`/data/${op.table}`, { method: 'POST', body: JSON.stringify({ company_id: op.companyId, records: op.records }) });
      }
    } catch (err) {
      console.warn('[Cloud] flush item failed:', err?.message);
      failed.push(op);
    }
  }
  setOfflineQueue(failed);
}

export function initNetworkListener() {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => { flushOfflineQueue().catch(() => {}); });
}

// ==============================
// MIGRATION SUPABASE → CLOUDFLARE (end-of-life, appelé manuellement)
// ==============================
export async function migrateLocalToSupabase(companyId) {
  // Renommé par compat : copie le localStorage vers D1
  try {
    const tables = {};
    const stdTables = ['journal_entries', 'invoices', 'expenses', 'transactions', 'stock', 'stock_mouvements', 'pieces_comptables', 'employees', 'payroll_slips', 'clients', 'fournisseurs'];
    for (const table of stdTables) {
      const data = lsRead(table, companyId);
      if (data && data.length > 0) tables[table] = data;
    }
    const res = await importToCloud(companyId, tables);
    return { success: !!res.ok, results: res.results || [] };
  } catch (e) {
    return { success: false, reason: e.message };
  }
}
