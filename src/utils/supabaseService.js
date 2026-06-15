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

export async function fetchCompanySettings(companyId) {
  if (!isSupabaseEnabled() || !navigator.onLine) return null;
  if (!(await hasSession())) return null;
  const { data } = await supabase.from('companies').select('settings').eq('id', companyId).single();
  return data?.settings || null;
}

export async function saveCompanySettings(companyId, settings) {
  if (!isSupabaseEnabled() || !navigator.onLine) return;
  await supabase.from('companies').update({ settings }).eq('id', companyId);
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
async function hasSession() {
  try { const { data: { session } } = await supabase.auth.getSession(); return !!session; }
  catch { return false; }
}

export async function fetchData(table, companyId, orderBy = 'created_at', ascending = false) {
  if (!isSupabaseEnabled() || !navigator.onLine) {
    return lsRead(table, companyId) || [];
  }
  if (!(await hasSession())) return lsRead(table, companyId) || [];
  const { data } = await supabase
    .from(table)
    .select('*')
    .eq('company_id', companyId)
    .order(orderBy, { ascending });
  if (data) {
    lsWrite(table, companyId, data);
    return data;
  }
  return lsRead(table, companyId) || [];
}

export async function upsertData(table, companyId, records) {
  const withIds = records.map(r => ensureUUID({ ...r, company_id: companyId }));
  if (!isSupabaseEnabled() || !navigator.onLine) {
    const existing = lsRead(table, companyId) || [];
    const merged = mergeRecords(existing, withIds);
    lsWrite(table, companyId, merged);
    return merged;
  }
  if (withIds.length === 0) return [];
  if (!(await hasSession())) {
    const existing = lsRead(table, companyId) || [];
    const merged = mergeRecords(existing, withIds);
    lsWrite(table, companyId, merged);
    return merged;
  }
  const { data, error } = await supabase
    .from(table)
    .upsert(withIds)
    .select();
  if (error) throw error;
  const existing = lsRead(table, companyId) || [];
  const merged = mergeRecords(existing, data || []);
  lsWrite(table, companyId, merged);
  return merged;
}

export async function insertData(table, companyId, record) {
  const enriched = ensureUUID({ ...record, company_id: companyId });
  if (!isSupabaseEnabled() || !navigator.onLine) {
    const existing = lsRead(table, companyId) || [];
    existing.push(enriched);
    lsWrite(table, companyId, existing);
    return enriched;
  }
  const { data, error } = await supabase.from(table).insert(enriched).select().single();
  if (error) throw error;
  const existing = lsRead(table, companyId) || [];
  existing.push(data);
  lsWrite(table, companyId, existing);
  return data;
}

export async function updateData(table, companyId, id, updates) {
  if (!isSupabaseEnabled() || !navigator.onLine) {
    const existing = lsRead(table, companyId) || [];
    const idx = existing.findIndex(r => r.id === id);
    if (idx >= 0) existing[idx] = { ...existing[idx], ...updates };
    lsWrite(table, companyId, existing);
    return existing[idx] || null;
  }
  const { data, error } = await supabase.from(table).update(updates).eq('id', id).select().single();
  if (error) throw error;
  const existing = lsRead(table, companyId) || [];
  const idx = existing.findIndex(r => r.id === id);
  if (idx >= 0) existing[idx] = data;
  else existing.push(data);
  lsWrite(table, companyId, existing);
  return data;
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
// HELPERS
// ==============================
function isUUID(str) {
  return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function ensureUUID(record) {
  if (!record.id || !isUUID(record.id)) {
    return { ...record, id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}` };
  }
  return record;
}

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
  if (!(await hasSession())) return { success: false, reason: 'Aucune session Supabase active — connectez-vous d\'abord' };
  const results = [];
  // Tables with standard key format: {table}_{companyId}
  const stdTables = ['journal_entries', 'invoices', 'expenses', 'transactions', 'stock', 'stock_mouvements', 'pieces_comptables'];
  for (const table of stdTables) {
    const local = lsRead(table, companyId);
    if (!local || local.length === 0) continue;
    const enriched = local.map(r => ({ ...r, company_id: companyId }));
    const { error } = await supabase.from(table).upsert(enriched, { onConflict: 'id' });
    results.push({ table, count: enriched.length, error: error?.message || null });
  }
  // Employees: stored in smart_employes_{companyId}
  try {
    const empRaw = localStorage.getItem(`smart_employes_${companyId}`);
    if (empRaw) {
      const local = JSON.parse(empRaw);
      if (local.length > 0) {
        const enriched = local.map(r => ({
          id: r.id, company_id: companyId, nom: r.nom, prenom: r.prenom,
          cin: r.cin, matricule: r.matricule, poste: r.poste,
          salaire_base: parseFloat(r.salaireBase) || 0,
          nb_enfants: parseInt(r.nbEnfants) || 0,
          regime: r.regimeHoraire === 48 ? '48h' : '40h',
          situation_famille: r.chefFamille ? 'chef_famille' : r.conjointCharge ? 'marie' : 'celibataire',
        }));
        const { error } = await supabase.from('employees').upsert(enriched, { onConflict: 'id' });
        results.push({ table: 'employees', count: enriched.length, error: error?.message || null });
      }
    }
  } catch {}
  // Payroll slips: stored in smart_bulletins_{companyId}
  try {
    const payRaw = localStorage.getItem(`smart_bulletins_${companyId}`);
    if (payRaw) {
      const local = JSON.parse(payRaw);
      if (local.length > 0) {
        const enriched = local.map(r => ({
          id: r.id || crypto.randomUUID(), company_id: companyId,
          employee_id: r.employeId, nom: r.nom, prenom: r.prenom,
          mois: r.mois, annee: r.annee,
          salaire_base: parseFloat(r.salaireBase) || 0,
          brut: parseFloat(r.brut) || 0,
          cnss_sal: parseFloat(r.cnssSal) || 0,
          cnss_pat: parseFloat(r.cnssPat) || 0,
          irpp: parseFloat(r.irppAnnuel) || 0,
          net_a_payer: parseFloat(r.netAPayer) || 0,
          cout_employeur: parseFloat(r.coutEmployeur) || 0,
        }));
        const { error } = await supabase.from('payroll_slips').upsert(enriched, { onConflict: 'id' });
        results.push({ table: 'payroll_slips', count: enriched.length, error: error?.message || null });
      }
    }
  } catch {}
  if (results.every(r => !r.error)) {
    localStorage.setItem(`smart_migrated_${companyId}`, 'true');
    return { success: true, results };
  }
  return { success: false, results };
}
