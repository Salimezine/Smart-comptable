import { supabase, isSupabaseEnabled } from './supabaseClient';
export { isSupabaseEnabled };

// ==============================
// AUTH
// ==============================
export async function signUp(email, password, meta = {}) {
  if (!isSupabaseEnabled()) return { error: 'Supabase non configuré' };
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: meta } });
  return { data, error };
}

export async function signIn(email, password) {
  if (!isSupabaseEnabled()) return { error: 'Supabase non configuré' };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signOut() {
  if (!isSupabaseEnabled()) return;
  await supabase.auth.signOut();
  localStorage.removeItem('sc_supabase_session');
}

export async function getSession() {
  if (!isSupabaseEnabled()) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session ?? null;
}

export async function getCurrentUser() {
  if (!isSupabaseEnabled()) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

export function onAuthChange(callback) {
  if (!isSupabaseEnabled()) return () => {};
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return () => subscription.unsubscribe();
}

// ==============================
// PROFILE
// ==============================
export async function getProfile(userId) {
  if (!isSupabaseEnabled()) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
  return data;
}

export async function updateProfile(userId, updates) {
  if (!isSupabaseEnabled()) return null;
  const { data } = await supabase.from('profiles').update(updates).eq('id', userId).select().single();
  return data;
}

// ==============================
// COMPANIES
// ==============================
export async function getUserCompanies(userId) {
  if (!isSupabaseEnabled()) return [];
  const { data } = await supabase
    .from('company_members')
    .select('company_id, role, companies:company_id(*)')
    .eq('user_id', userId)
    .eq('is_active', true);
  return (data || []).map(m => ({ ...m.companies, role: m.role }));
}

export async function createCompany(values) {
  if (!isSupabaseEnabled()) return null;
  const { data: company, error } = await supabase.from('companies').insert(values).select().single();
  if (error) throw error;
  await supabase.from('company_members').insert({ company_id: company.id, user_id: values.owner_id, role: 'admin' });
  return company;
}

export async function updateCompany(id, values) {
  if (!isSupabaseEnabled()) return null;
  const { data } = await supabase.from('companies').update(values).eq('id', id).select().single();
  return data;
}

// ==============================
// DATA LAYER — with localStorage fallback
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

function filterByCompany(query, companyId) {
  return query.eq('company_id', companyId);
}

// Generic fetch: Supabase first, localStorage fallback
export async function fetchData(table, companyId, orderBy = 'created_at', ascending = false) {
  if (!isSupabaseEnabled() || !navigator.onLine) {
    return lsRead(table, companyId) || [];
  }
  const { data } = await supabase
    .from(table)
    .select('*')
    .eq('company_id', companyId)
    .order(orderBy, { ascending });
  if (data) {
    const mapped = data.map(r => dbToJs(r, table));
    lsWrite(table, companyId, mapped);
    return mapped;
  }
  return lsRead(table, companyId) || [];
}

export async function upsertData(table, companyId, records) {
  const mapped = records.map(r => jsToDb({ ...r, company_id: companyId }, table));
  if (!isSupabaseEnabled() || !navigator.onLine) {
    const existing = lsRead(table, companyId) || [];
    const merged = mergeRecords(existing, mapped);
    lsWrite(table, companyId, merged);
    return merged;
  }
  const { data, error } = await supabase
    .from(table)
    .upsert(mapped)
    .select();
  if (error) throw error;
  const existing = lsRead(table, companyId) || [];
  const merged = mergeRecords(existing, data ? data.map(r => dbToJs(r, table)) : []);
  lsWrite(table, companyId, merged);
  return merged;
}

export async function insertData(table, companyId, record) {
  const enriched = { ...record, company_id: companyId };
  const dbRecord = jsToDb(enriched, table);
  if (!isSupabaseEnabled() || !navigator.onLine) {
    const existing = lsRead(table, companyId) || [];
    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const entry = { ...dbRecord, id };
    existing.push(entry);
    lsWrite(table, companyId, existing);
    return entry;
  }
  const { data, error } = await supabase.from(table).insert(dbRecord).select().single();
  if (error) throw error;
  const result = dbToJs(data, table);
  const existing = lsRead(table, companyId) || [];
  existing.push(result);
  lsWrite(table, companyId, existing);
  return result;
}

export async function updateData(table, companyId, id, updates) {
  const dbUpdates = jsToDb(updates, table);
  if (!isSupabaseEnabled() || !navigator.onLine) {
    const existing = lsRead(table, companyId) || [];
    const idx = existing.findIndex(r => r.id === id);
    if (idx >= 0) existing[idx] = { ...existing[idx], ...dbUpdates };
    lsWrite(table, companyId, existing);
    return existing[idx] || null;
  }
  const { data, error } = await supabase.from(table).update(dbUpdates).eq('id', id).select().single();
  if (error) throw error;
  const result = dbToJs(data, table);
  const existing = lsRead(table, companyId) || [];
  const idx = existing.findIndex(r => r.id === id);
  if (idx >= 0) existing[idx] = result;
  else existing.push(result);
  lsWrite(table, companyId, existing);
  return result;
}

export async function deleteData(table, companyId, id) {
  if (!isSupabaseEnabled() || !navigator.onLine) {
    const existing = lsRead(table, companyId) || [];
    const filtered = existing.filter(r => r.id !== id);
    lsWrite(table, companyId, filtered);
    return true;
  }
  await supabase.from(table).delete().eq('id', id);
  const existing = lsRead(table, companyId) || [];
  lsWrite(table, companyId, existing.filter(r => r.id !== id));
  return true;
}

// ==============================
// FIELD MAPPING (camelCase JS ↔ snake_case DB)
// ==============================
const FIELD_MAP = {
  journal_entries: {
    numeroPiece: 'numero_piece',
    ttnId: null, // remove — doesn't exist in schema
  },
  expenses: {
    matriculeFiscal: 'matricule_fiscal',
    totalAmount: 'total_amount',
    vatAmount: 'vat_rate',
    subtotal: null,
    fodec: null,
    stampDuty: null,
    rsAmount: null,
    invoiceNumber: null,
    status: null,
  },
  invoices: {
    invoiceNumber: 'invoice_number',
    clientName: 'client_name',
    clientEmail: 'client_email',
    clientVat: 'client_vat',
    clientAddress: 'client_address',
    issueDate: 'issue_date',
    dueDate: 'due_date',
    vatAmount: 'vat_amount',
    totalAmount: 'total_amount',
  },
  transactions: {},
  employees: {},
  payroll_slips: {},
};

const REVERSE_MAP = {};
for (const [table, map] of Object.entries(FIELD_MAP)) {
  REVERSE_MAP[table] = {};
  for (const [js, db] of Object.entries(map)) {
    if (db) REVERSE_MAP[table][db] = js;
  }
}

export function jsToDb(record, table) {
  if (!record || typeof record !== 'object') return record;
  const map = FIELD_MAP[table];
  if (!map) return record;
  const out = {};
  for (const [key, val] of Object.entries(record)) {
    if (map[key] === null) continue; // drop unknown keys
    if (map[key]) { out[map[key]] = val; }
    else { out[key] = val; }
  }
  return out;
}

function dbToJs(record, table) {
  if (!record || typeof record !== 'object') return record;
  const map = REVERSE_MAP[table];
  if (!map) return record;
  const out = {};
  for (const [key, val] of Object.entries(record)) {
    if (map[key]) { out[map[key]] = val; }
    else { out[key] = val; }
  }
  return out;
}

// ==============================
// HELPERS
// ==============================
function mergeRecords(existing, incoming) {
  const map = new Map();
  for (const r of existing) map.set(r.id, r);
  for (const r of incoming) map.set(r.id, r);
  return Array.from(map.values());
}

// ==============================
// REALTIME SUBSCRIPTION
// ==============================
export function subscribeTable(table, companyId, onEvent) {
  if (!isSupabaseEnabled()) return () => {};
  const sub = supabase
    .channel(`${table}_changes`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table, filter: `company_id=eq.${companyId}` },
      onEvent
    )
    .subscribe();
  return () => sub.unsubscribe();
}

// ==============================
// MIGRATION: localStorage → Supabase
// ==============================
export async function migrateLocalToSupabase(companyId) {
  if (!isSupabaseEnabled()) return { success: false, reason: 'Supabase non configuré' };
  const tables = ['journal_entries', 'invoices', 'expenses', 'transactions', 'employees', 'payroll_slips'];
  const results = [];
  for (const table of tables) {
    const local = lsRead(table, companyId);
    if (!local || local.length === 0) continue;
    const enriched = local.map(r => jsToDb({ ...r, company_id: companyId }, table));
    const { error } = await supabase.from(table).upsert(enriched, { onConflict: 'id' });
    results.push({ table, count: enriched.length, error: error?.message || null });
  }
  if (results.every(r => !r.error)) {
    localStorage.setItem(`smart_migrated_${companyId}`, 'true');
    return { success: true, results };
  }
  return { success: false, results };
}
