import { supabase, isSupabaseEnabled } from './supabaseClient';

// ── Generic localStorage CRUD ──
function lsKey(table, companyId) { return `erp_${table}_${companyId}`; }

function lsRead(table, companyId) {
  try { return JSON.parse(localStorage.getItem(lsKey(table, companyId)) || '[]'); } catch { return []; }
}

function lsWrite(table, companyId, data) {
  localStorage.setItem(lsKey(table, companyId), JSON.stringify(data));
}

function genId() { return crypto.randomUUID(); }

function now() { return new Date().toISOString(); }

// ── Reusable CRUD factory ──
function createStore(tableName) {
  const store = {
    getAll(companyId) { return lsRead(tableName, companyId); },

    getById(companyId, id) {
      return lsRead(tableName, companyId).find(r => r.id === id) || null;
    },

    upsert(companyId, record) {
      const list = lsRead(tableName, companyId);
      const idx = list.findIndex(r => r.id === record.id);
      const nowStr = now();
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...record, updated_at: nowStr };
      } else {
        list.push({ ...record, id: record.id || genId(), company_id: companyId, created_at: nowStr, updated_at: nowStr });
      }
      lsWrite(tableName, companyId, list);
      this.syncToSupabase(companyId, list);
      return list.find(r => r.id === (record.id || list[list.length - 1].id));
    },

    delete(companyId, id) {
      const list = lsRead(tableName, companyId).filter(r => r.id !== id);
      lsWrite(tableName, companyId, list);
      this.syncToSupabase(companyId, list);
    },

    async syncToSupabase(companyId, list) {
      if (!isSupabaseEnabled() || !navigator.onLine || !companyId) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const payload = list.map(r => ({ ...r, company_id: companyId }));
        await supabase.from(tableName).upsert(payload, { onConflict: 'id' });
      } catch (e) { console.warn(`[erp] sync ${tableName} failed:`, e?.message); }
    },

    async loadFromSupabase(companyId) {
      if (!isSupabaseEnabled() || !navigator.onLine || !companyId) return null;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return null;
        const { data, error } = await supabase.from(tableName).select('*').eq('company_id', companyId);
        if (error) throw error;
        if (data && data.length > 0) {
          lsWrite(tableName, companyId, data);
          return data;
        }
      } catch (e) { console.warn(`[erp] load ${tableName} failed:`, e?.message); }
      return null;
    },

    generateCode(companyId, prefix) {
      const list = lsRead(tableName, companyId);
      const nums = list.map(r => {
        const m = (r.code || '').match(/(\d+)$/);
        return m ? parseInt(m[1], 10) : 0;
      });
      const max = nums.length > 0 ? Math.max(...nums) : 0;
      return `${prefix}${String(max + 1).padStart(3, '0')}`;
    },
  };
  return store;
}

// ── Individual stores ──
export const clientsStore = createStore('clients');
export const suppliersStore = createStore('suppliers');
export const productsStore = createStore('products');
export const warehousesStore = createStore('warehouses');
export const stockMovementsStore = createStore('stock_movements');
export const salesOrdersStore = createStore('sales_orders');
export const salesOrderLinesStore = createStore('sales_order_lines');
export const purchaseOrdersStore = createStore('purchase_orders');
export const purchaseOrderLinesStore = createStore('purchase_order_lines');

// ── Specific helpers ──

// Warehouses: ensure default warehouse exists
export function ensureDefaultWarehouse(companyId) {
  const list = warehousesStore.getAll(companyId);
  const def = list.find(w => w.defaut);
  if (def) return def;
  const newW = { id: genId(), nom: 'Dépôt principal', adresse: '', code: 'DP01', defaut: true, actif: true };
  warehousesStore.upsert(companyId, newW);
  return newW;
}

// Stock: update product stock_actuel after movement
export function updateStockAfterMovement(companyId, productId) {
  const movements = stockMovementsStore.getAll(companyId).filter(m => m.product_id === productId);
  let stock = 0;
  for (const m of movements) {
    if (m.type === 'entree' || m.type === 'ajustement_positif' || m.type === 'transfert_entree') stock += m.quantite;
    else if (m.type === 'sortie' || m.type === 'ajustement_negatif' || m.type === 'transfert_sortie') stock -= m.quantite;
  }
  const product = productsStore.getById(companyId, productId);
  if (product) productsStore.upsert(companyId, { ...product, stock_actuel: Math.max(0, stock) });
}

// Sales orders: generate sequential number per type
export function generateOrderNum(companyId, type) {
  const prefixMap = { devis: 'DEV', commande: 'CMD', bon_livraison: 'BL', facture: 'FAC' };
  const prefix = prefixMap[type] || 'ORD';
  const orders = salesOrdersStore.getAll(companyId).filter(o => o.type === type);
  const nums = orders.map(o => { const m = (o.numero || '').match(/(\d+)$/); return m ? parseInt(m[1], 10) : 0; });
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
}

// Purchase orders: generate sequential number
export function generatePurchaseNum(companyId, type) {
  const prefixMap = { bc: 'BC', recepton: 'REC', facture_fournisseur: 'FACF' };
  const prefix = prefixMap[type] || 'ACH';
  const orders = purchaseOrdersStore.getAll(companyId).filter(o => o.type === type);
  const nums = orders.map(o => { const m = (o.numero || '').match(/(\d+)$/); return m ? parseInt(m[1], 10) : 0; });
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
}

// Migration: import clients from existing invoices
export function migrateClientsFromInvoices(companyId, invoices = []) {
  const existing = clientsStore.getAll(companyId);
  const existingNames = new Set(existing.map(c => c.nom.toLowerCase().trim()));
  let count = 0;
  for (const inv of invoices) {
    const name = (inv.clientName || inv.client || '').trim();
    if (!name || existingNames.has(name.toLowerCase())) continue;
    existingNames.add(name.toLowerCase());
    clientsStore.upsert(companyId, {
      nom: name,
      email: inv.clientEmail || '',
      matricule_fiscal: inv.clientVat || '',
      adresse: inv.clientAddress || '',
      code: clientsStore.generateCode(companyId, 'C'),
    });
    count++;
  }
  return count;
}

// Migration: import suppliers from existing expenses + FournisseursView data
export function migrateSuppliersFromExpenses(companyId, expenses = []) {
  const existing = suppliersStore.getAll(companyId);
  const existingNames = new Set(existing.map(s => s.nom.toLowerCase().trim()));
  let count = 0;

  // From expenses
  for (const exp of expenses) {
    const name = (exp.supplier || exp.fournisseur || '').trim();
    if (!name || existingNames.has(name.toLowerCase())) continue;
    existingNames.add(name.toLowerCase());
    suppliersStore.upsert(companyId, {
      nom: name,
      matricule_fiscal: exp.matriculeFiscal || '',
      code: suppliersStore.generateCode(companyId, 'F'),
    });
    count++;
  }

  // From legacy localStorage (FournisseursView)
  try {
    const legacyKey = `sc_manual_suppliers_${companyId}`;
    const legacy = JSON.parse(localStorage.getItem(legacyKey) || '[]');
    for (const s of legacy) {
      const name = (s.name || s.nom || '').trim();
      if (!name || existingNames.has(name.toLowerCase())) continue;
      existingNames.add(name.toLowerCase());
      suppliersStore.upsert(companyId, {
        nom: name,
        matricule_fiscal: s.mf || s.matriculeFiscal || '',
        telephone: s.phone || s.telephone || '',
        adresse: s.address || '',
        code: suppliersStore.generateCode(companyId, 'F'),
      });
      count++;
    }
  } catch {}

  return count;
}

// Compute order totals from lines
export function computeOrderTotals(lines) {
  let total_ht = 0, total_tva = 0, total_ttc = 0;
  for (const l of lines) {
    const ht = (l.quantite || 0) * (l.prix_unitaire_ht || 0);
    const tva = ht * ((l.taux_tva || 19) / 100);
    total_ht += ht;
    total_tva += tva;
    total_ttc += ht + tva;
  }
  return { total_ht: round(total_ht), total_tva: round(total_tva), total_ttc: round(total_ttc) };
}

function round(n) { return Math.round(n * 1000) / 1000; }
