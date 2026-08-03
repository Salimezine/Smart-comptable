// ==========================================================================
//  Compatibilité Supabase → Cloudflare D1
//  Expose le même objet `supabase` (builder .from(...) + auth) utilisé par
//  toute l'app, mais qui délègue à cloudClient (Workers + D1).
// ==========================================================================
import {
  isCloudEnabled, getApiToken,
  signIn, signUp, signOut, getSession, getCurrentUser, onAuthChange,
  getProfile, getUserCompanies, createCompany,
  fetchData, fetchDataSince, upsertData, insertData, updateData, updateDataById, deleteData, deleteDataById,
  findCompanyByRecord,
} from './cloudClient';

export const isSupabaseEnabled = isCloudEnabled;

export let supabaseSessionActive = false;

export async function checkSupabaseSession() {
  const s = await getSession();
  supabaseSessionActive = !!s;
  return supabaseSessionActive;
}

// --------------------------------------------------------------------------
//  Builder fluide compatible avec supabase-js
// --------------------------------------------------------------------------
class Builder {
  constructor(table) {
    this._table = table;
    this._filters = {};
    this._orderCol = null;
    this._orderAsc = true;
    this._limit = null;
    this._single = false;
    this._op = null;
    this._payload = null;
  }

  select() { this._op = 'select'; return this; }
  eq(col, val) { this._filters[col] = val; return this; }
  order(col, opts = {}) { this._orderCol = col; this._orderAsc = !!opts.ascending; return this; }
  limit(n) { this._limit = n; return this; }
  single() { this._single = true; return this; }
  insert(payload) { this._op = 'insert'; this._payload = payload; return this; }
  upsert(payload, opts = {}) { this._op = 'upsert'; this._payload = payload; return this; }
  update(payload) { this._op = 'update'; this._payload = payload; return this; }
  delete() { this._op = 'delete'; return this; }

  _has(key) { return Object.prototype.hasOwnProperty.call(this._filters, key); }

  // 'suppliers' → 'fournisseurs' (alias de compatibilité)
  _alias() {
    return this._table === 'suppliers' ? 'fournisseurs' : this._table;
  }

  // Résout le company_id : filtre → premier record → scan par id → société courante
  async _resolveCompany(companyId, rows, id) {
    if (companyId) return companyId;
    if (rows?.length && rows[0].company_id) return rows[0].company_id;
    if (id) {
      const found = findCompanyByRecord(this._alias(), id);
      if (found) return found;
    }
    try {
      const cur = localStorage.getItem('smart_comptable_current_id');
      if (cur) return cur;
    } catch { /* ignore */ }
    return null;
  }

  async _exec() {
    const table = this._alias();
    const companyId = this._filters.company_id;
    const id = this._filters.id;
    const err = (e) => ({ data: null, error: e instanceof Error ? e : new Error(e || 'Erreur cloud') });
    const ok = (d) => ({ data: d, error: null });

    try {
      // ── Écritures ──
      if (this._op === 'insert') {
        const rows = Array.isArray(this._payload) ? this._payload : [this._payload];
        if (table === 'profiles') return ok(rows[0] || {});
        if (table === 'company_members') return ok(rows[0] || {});
        if (table === 'companies') {
          const c = await createCompany(rows[0] || {});
          return ok(c || rows[0]);
        }
        const cid = await this._resolveCompany(companyId, rows, id);
        if (!cid) return err('company_id requis');
        const out = [];
        for (const r of rows) out.push(await insertData(table, cid, r));
        return ok(this._single ? out[0] : out);
      }
      if (this._op === 'upsert') {
        const rows = Array.isArray(this._payload) ? this._payload : [this._payload];
        if (table === 'profiles') return ok(rows[0] || {});
        if (table === 'company_members') return ok(rows[0] || {});
        if (table === 'companies') {
          const c = await createCompany(rows[0] || {});
          return ok(c || rows[0]);
        }
        const cid = await this._resolveCompany(companyId, rows, id);
        if (!cid) return err('company_id requis');
        // ocr_learning : une ligne par société → id = company_id
        const normalized = rows.map(r => table === 'ocr_learning' ? { ...r, id: cid } : r);
        const out = await upsertData(table, cid, normalized);
        return ok(this._single ? (out[0] || null) : out);
      }
      if (this._op === 'update') {
        if (table === 'profiles') return ok(this._payload);
        if (table === 'companies') return ok({ id, ...this._payload });
        if (id) {
          const updated = await updateDataById(table, id, this._payload);
          if (updated) return ok(this._single ? updated : [updated]);
          return ok(this._single ? { id, ...this._payload } : [{ id, ...this._payload }]);
        }
        if (!companyId) return err('company_id requis pour update');
        const out = await updateData(table, companyId, id, this._payload);
        return ok(this._single ? out : [out]);
      }
      if (this._op === 'delete') {
        if (!id) return err('id requis pour delete');
        await deleteDataById(table, id);
        return ok(null);
      }

      // ── Lecture ──
      if (table === 'profiles') {
        const p = await getProfile(id);
        return ok(this._single ? (p || null) : (p ? [p] : []));
      }
      if (table === 'companies') {
        const list = await getUserCompanies();
        const filtered = id ? list.filter(c => c.id === id) : (companyId ? list.filter(c => c.id === companyId) : list);
        return ok(this._single ? (filtered[0] || null) : filtered);
      }
      if (table === 'company_members') {
        const list = await getUserCompanies();
        const members = list.map(c => ({
          company_id: c.id,
          role: c.role || 'comptable',
          companies: {
            id: c.id,
            name: c.name,
            matricule_fiscal: c.tax_id || c.matricule_fiscal || '',
            adresse: c.address || c.adresse || '',
          },
        }));
        return ok(this._single ? (members[0] || null) : members);
      }
      if (table === 'suppliers' || table === 'fournisseurs' || table === 'clients' || table === 'stock' || table === 'employees' || table === 'payroll_slips' || table === 'journal_entries' || table === 'invoices' || table === 'expenses' || table === 'transactions' || table === 'pieces_comptables' || table === 'stock_mouvements' || table === 'tva_declarations' || table === 'declarations_sociales' || table === 'declarations_is' || table === 'declaration_templates' || table === 'fiscal_knowledge' || table === 'ocr_learning') {
        let cid = await this._resolveCompany(companyId, null, id);
        if (!cid) return err('company_id requis');
        let rows = await fetchData(table, cid);
        if (id) rows = rows.filter(r => r.id === id);
        // filtres eq supplémentaires
        for (const [k, v] of Object.entries(this._filters)) {
          if (k === 'company_id' || k === 'id') continue;
          rows = rows.filter(r => r[k] === v || r[k] === String(v));
        }
        if (this._orderCol) {
          rows = [...rows].sort((a, b) => {
            const av = a[this._orderCol]; const bv = b[this._orderCol];
            if (av == null) return 1; if (bv == null) return -1;
            return this._orderAsc ? (av > bv ? 1 : av < bv ? -1 : 0) : (av < bv ? 1 : av > bv ? -1 : 0);
          });
        }
        if (this._limit) rows = rows.slice(0, this._limit);
        return ok(this._single ? (rows[0] || null) : rows);
      }
      return err('Table inconnue: ' + table);
    } catch (e) {
      return err(e);
    }
  }

  then(resolve, reject) {
    return this._exec().then(resolve, reject);
  }
  catch(reject) {
    return this._exec().catch(reject);
  }
  finally(cb) {
    return this._exec().finally(cb);
  }
}

// --------------------------------------------------------------------------
//  Supabase "shim"
// --------------------------------------------------------------------------
export const supabase = {
  auth: {
    async signUp({ email, password }) {
      const res = await signUp(email, password);
      supabaseSessionActive = !!res?.data?.session;
      return res;
    },
    async signInWithPassword({ email, password }) {
      const res = await signIn(email, password);
      supabaseSessionActive = !!res?.data?.session;
      return res;
    },
    async signOut() {
      await signOut();
      supabaseSessionActive = false;
      return { error: null };
    },
    async getSession() {
      const s = await getSession();
      return { data: { session: s }, error: null };
    },
    async getUser() {
      const u = await getCurrentUser();
      return { data: { user: u }, error: null };
    },
    onAuthStateChange(cb) {
      // Pas de push temps réel : on simule une première lecture
      getSession().then(s => { supabaseSessionActive = !!s; cb('INITIAL_SESSION', s); }).catch(() => {});
      return { data: { subscription: { unsubscribe() {} } } };
    },
    async setSession(session) {
      return { data: { session }, error: null };
    },
  },
  from(table) {
    return new Builder(table);
  },
  channel() {
    return {
      on() { return this; },
      subscribe() { return { unsubscribe() {} }; },
      unsubscribe() {},
    };
  },
  removeChannel() {},
};

// Mettre à jour l'état de session au chargement
checkSupabaseSession().catch(() => {});
