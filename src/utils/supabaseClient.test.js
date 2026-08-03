import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = {};
vi.stubGlobal('localStorage', {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  key: (i) => Object.keys(store)[i] || null,
  get length() { return Object.keys(store).length; },
});

vi.mock('./cloudClient', () => ({
  isCloudEnabled: () => true,
  getApiToken: () => 'tok',
  signIn: vi.fn(async () => ({ data: { session: { access_token: 'tok' } }, error: null })),
  signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
  signOut: vi.fn(async () => ({})),
  getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
  getCurrentUser: vi.fn(async () => ({ data: { user: null }, error: null })),
  onAuthChange: vi.fn(() => () => {}),
  getProfile: vi.fn(async () => ({})),
  getUserCompanies: vi.fn(async () => [{ id: 'co1', name: 'Co', tax_id: '123', address: 'TN' }]),
  createCompany: vi.fn(async (v) => ({ id: 'newco', ...v })),
  fetchData: vi.fn(async (table, cid) => {
    const rows = JSON.parse(store[`${table}_${cid}`] || '[]');
    return rows;
  }),
  fetchDataSince: vi.fn(async () => []),
  upsertData: vi.fn(async (table, cid, records) => {
    const existing = JSON.parse(store[`${table}_${cid}`] || '[]');
    const map = new Map(existing.map(r => [r.id, r]));
    for (const r of records) map.set(r.id, r);
    const out = Array.from(map.values());
    store[`${table}_${cid}`] = JSON.stringify(out);
    return out;
  }),
  insertData: vi.fn(async (table, cid, r) => r),
  updateData: vi.fn(async () => ({})),
  updateDataById: vi.fn(async (table, id, updates) => ({ id, ...updates })),
  deleteData: vi.fn(async () => ({})),
  deleteDataById: vi.fn(async () => ({})),
  importToCloud: vi.fn(async () => ({ ok: true, results: [] })),
  flushOfflineQueue: vi.fn(async () => {}),
  initNetworkListener: vi.fn(() => {}),
  migrateLocalToSupabase: vi.fn(async () => ({ success: true })),
  findCompanyByRecord: vi.fn((table, id) => {
    for (const k of Object.keys(store)) {
      if (!k.startsWith(`${table}_`)) continue;
      const cid = k.slice(table.length + 1);
      const rows = JSON.parse(store[k] || '[]');
      if (rows.some(r => r.id === id)) return cid;
    }
    return null;
  }),
}));

import { supabase } from './supabaseClient';

describe('supabase shim (Cloudflare D1)', () => {
  beforeEach(() => { store['smart_api_token'] = ''; for (const k of Object.keys(store)) if (!k.startsWith('smart_api')) delete store[k]; });

  it('aliase suppliers vers fournisseurs', async () => {
    store['fournisseurs_co1'] = JSON.stringify([{ id: 's1', name: 'X', company_id: 'co1' }]);
    const { data, error } = await supabase.from('suppliers').select('*').eq('company_id', 'co1');
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('X');
  });

  it('lit par id sans company_id', async () => {
    store['invoices_co1'] = JSON.stringify([{ id: 'inv1', total: 100, company_id: 'co1' }]);
    const { data, error } = await supabase.from('invoices').select('*').eq('id', 'inv1').single();
    expect(error).toBeNull();
    expect(data.id).toBe('inv1');
  });

  it('ocr_learning: id = company_id pour une ligne par société', async () => {
    const { error } = await supabase.from('ocr_learning').upsert({ company_id: 'co1', rules: [] }, { onConflict: 'company_id' });
    const rows = JSON.parse(store['ocr_learning_co1'] || '[]');
    expect(error).toBeNull();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('co1');
  });

  it('company_members renvoie les sociétés de l’utilisateur (shape joint)', async () => {
    const { data } = await supabase.from('company_members').select('company_id, role, companies:company_id(id, name)');
    expect(data).toHaveLength(1);
    expect(data[0].companies.name).toBe('Co');
    expect(data[0].role).toBe('comptable');
  });

  it('update par id appelle updateDataById', async () => {
    const { data } = await supabase.from('invoices').update({ status: 'SENT' }).eq('id', 'inv1');
    expect(data[0].status).toBe('SENT');
  });
});
