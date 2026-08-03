import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { mockIsSupabaseEnabled } = vi.hoisted(() => ({
  mockIsSupabaseEnabled: vi.fn(() => false),
}));

const mockStorage = {};
function setupMockLS() {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key) => mockStorage[key] ?? null),
    setItem: vi.fn((key, val) => { mockStorage[key] = String(val); }),
    removeItem: vi.fn((key) => { delete mockStorage[key]; }),
    clear: vi.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }),
    get length() { return Object.keys(mockStorage).length; },
    key: vi.fn((i) => Object.keys(mockStorage)[i]),
  });
}
function cleanup() {
  Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
}

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) })),
    })),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  },
  isSupabaseEnabled: mockIsSupabaseEnabled,
}));

describe('erpStore', () => {
  let stores;

  beforeEach(async () => {
    setupMockLS();
    stores = await import('./erpStore');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const CID = 'company_001';

  describe('clientsStore CRUD', () => {
    it('returns empty list initially', () => {
      expect(stores.clientsStore.getAll(CID)).toEqual([]);
    });

    it('upserts a new client', () => {
      const c = stores.clientsStore.upsert(CID, { id: 'c1', nom: 'Client A', code: 'C001' });
      expect(c.nom).toBe('Client A');
      expect(stores.clientsStore.getAll(CID)).toHaveLength(1);
    });

    it('updates an existing client', () => {
      stores.clientsStore.upsert(CID, { id: 'c1', nom: 'Client A', code: 'C001' });
      stores.clientsStore.upsert(CID, { id: 'c1', nom: 'Client A modifié' });
      const updated = stores.clientsStore.getById(CID, 'c1');
      expect(updated.nom).toBe('Client A modifié');
    });

    it('gets by id returns null for missing', () => {
      expect(stores.clientsStore.getById(CID, 'nonexistent')).toBeNull();
    });

    it('deletes a record', () => {
      stores.clientsStore.upsert(CID, { id: 'c1', nom: 'Client A' });
      stores.clientsStore.delete(CID, 'c1');
      expect(stores.clientsStore.getAll(CID)).toHaveLength(0);
    });
  });

  describe('productsStore CRUD', () => {
    it('upserts a product with full fields', () => {
      const p = stores.productsStore.upsert(CID, {
        id: 'p1',
        designation: 'Article Test',
        type: 'bien',
        unite: 'U',
        prix_achat_ht: 100,
        prix_vente_ht: 150,
        taux_tva: 19,
        stock_mini: 5,
        stock_actuel: 50,
        compte_stock: '310000',
      });
      expect(p.designation).toBe('Article Test');
      expect(p.type).toBe('bien');
      expect(p.prix_vente_ht).toBe(150);
    });
  });

  describe('suppliersStore', () => {
    it('stores and retrieves suppliers', () => {
      stores.suppliersStore.upsert(CID, { id: 's1', nom: 'Fournisseur X', code: 'F001' });
      expect(stores.suppliersStore.getAll(CID)).toHaveLength(1);
    });
  });

  describe('warehousesStore', () => {
    it('stores and retrieves warehouses', () => {
      stores.warehousesStore.upsert(CID, { id: 'w1', nom: 'Dépôt A', defaut: true });
      expect(stores.warehousesStore.getById(CID, 'w1').nom).toBe('Dépôt A');
    });
  });

  describe('stockMovementsStore', () => {
    it('stores a movement with type validation fields', () => {
      stores.stockMovementsStore.upsert(CID, {
        id: 'm1',
        product_id: 'p1',
        type: 'entree',
        quantite: 10,
        prix_unitaire_ht: 50,
        date_mouvement: '2025-06-01',
      });
      const list = stores.stockMovementsStore.getAll(CID);
      expect(list).toHaveLength(1);
      expect(list[0].quantite).toBe(10);
    });
  });

  describe('salesOrdersStore', () => {
    it('stores and retrieves orders', () => {
      stores.salesOrdersStore.upsert(CID, { id: 'o1', type: 'commande', numero: 'CMD-0001', total_ht: 1000 });
      expect(stores.salesOrdersStore.getById(CID, 'o1').total_ht).toBe(1000);
    });
  });

  describe('salesOrderLinesStore', () => {
    it('stores order lines', () => {
      stores.salesOrderLinesStore.upsert(CID, { id: 'l1', order_id: 'o1', designation: 'Ligne 1', quantite: 2, prix_unitaire_ht: 50 });
      expect(stores.salesOrderLinesStore.getAll(CID)).toHaveLength(1);
    });
  });

  describe('purchaseOrdersStore', () => {
    it('stores and retrieves purchase orders', () => {
      stores.purchaseOrdersStore.upsert(CID, { id: 'po1', type: 'bc', numero: 'BC-0001' });
      expect(stores.purchaseOrdersStore.getById(CID, 'po1').numero).toBe('BC-0001');
    });
  });

  describe('purchaseOrderLinesStore', () => {
    it('stores purchase order lines', () => {
      stores.purchaseOrderLinesStore.upsert(CID, { id: 'pl1', order_id: 'po1', designation: 'Fourniture' });
      expect(stores.purchaseOrderLinesStore.getAll(CID)).toHaveLength(1);
    });
  });

  describe('generateCode', () => {
    it('generates sequential codes with prefix', () => {
      stores.clientsStore.upsert(CID, { id: 'c1', nom: 'Client A', code: 'C001' });
      const next = stores.clientsStore.generateCode(CID, 'C');
      expect(next).toBe('C002');
    });

    it('starts at 001 when list is empty', () => {
      const code = stores.clientsStore.generateCode(CID, 'F');
      expect(code).toBe('F001');
    });
  });

  describe('ensureDefaultWarehouse', () => {
    it('creates default warehouse when none exists', () => {
      const w = stores.ensureDefaultWarehouse(CID);
      expect(w.nom).toBe('Dépôt principal');
      expect(w.defaut).toBe(true);
      expect(w.code).toBe('DP01');
    });

    it('returns existing default warehouse', () => {
      stores.warehousesStore.upsert(CID, { id: 'w1', nom: 'Dépôt A', defaut: true });
      stores.warehousesStore.upsert(CID, { id: 'w2', nom: 'Dépôt B', defaut: false });
      const w = stores.ensureDefaultWarehouse(CID);
      expect(w.id).toBe('w1');
    });
  });

  describe('updateStockAfterMovement', () => {
    it('calculates stock from movements', () => {
      stores.productsStore.upsert(CID, { id: 'p1', designation: 'Test', stock_actuel: 0 });
      stores.stockMovementsStore.upsert(CID, { id: 'm1', product_id: 'p1', type: 'entree', quantite: 10 });
      stores.stockMovementsStore.upsert(CID, { id: 'm2', product_id: 'p1', type: 'sortie', quantite: 3 });
      stores.updateStockAfterMovement(CID, 'p1');
      const p = stores.productsStore.getById(CID, 'p1');
      expect(p.stock_actuel).toBe(7);
    });

    it('handles ajustement types', () => {
      stores.productsStore.upsert(CID, { id: 'p2', designation: 'Test 2', stock_actuel: 0 });
      stores.stockMovementsStore.upsert(CID, { id: 'm3', product_id: 'p2', type: 'ajustement_positif', quantite: 5 });
      stores.stockMovementsStore.upsert(CID, { id: 'm4', product_id: 'p2', type: 'ajustement_negatif', quantite: 2 });
      stores.updateStockAfterMovement(CID, 'p2');
      expect(stores.productsStore.getById(CID, 'p2').stock_actuel).toBe(3);
    });
  });

  describe('generateOrderNum', () => {
    it('generates sequential order numbers by type', () => {
      stores.salesOrdersStore.upsert(CID, { id: 'o1', type: 'commande', numero: 'CMD-0001' });
      const num = stores.generateOrderNum(CID, 'commande');
      expect(num).toBe('CMD-0002');
    });

    it('generates first number for a type', () => {
      const num = stores.generateOrderNum(CID, 'devis');
      expect(num).toBe('DEV-0001');
    });

    it('uses correct prefix per type', () => {
      expect(stores.generateOrderNum(CID, 'bon_livraison')).toBe('BL-0001');
      expect(stores.generateOrderNum(CID, 'facture')).toBe('FAC-0001');
    });
  });

  describe('generatePurchaseNum', () => {
    it('generates sequential purchase numbers by type', () => {
      stores.purchaseOrdersStore.upsert(CID, { id: 'po1', type: 'bc', numero: 'BC-0001' });
      expect(stores.generatePurchaseNum(CID, 'bc')).toBe('BC-0002');
    });

    it('generates first number', () => {
      expect(stores.generatePurchaseNum(CID, 'facture_fournisseur')).toBe('FACF-0001');
    });
  });

  describe('migrateClientsFromInvoices', () => {
    it('creates clients from invoice data', () => {
      const invoices = [
        { clientName: 'Client A', clientEmail: 'a@test.com', clientVat: '123', clientAddress: 'Tunis' },
        { clientName: 'Client B' },
      ];
      const count = stores.migrateClientsFromInvoices(CID, invoices);
      expect(count).toBe(2);
      expect(stores.clientsStore.getAll(CID)).toHaveLength(2);
    });

    it('skips duplicate names', () => {
      const invoices = [
        { clientName: 'Client A' },
        { clientName: 'Client A' },
      ];
      expect(stores.migrateClientsFromInvoices(CID, invoices)).toBe(1);
    });

    it('handles empty invoices list', () => {
      expect(stores.migrateClientsFromInvoices(CID, [])).toBe(0);
    });
  });

  describe('migrateSuppliersFromExpenses', () => {
    it('creates suppliers from expenses', () => {
      const expenses = [
        { supplier: 'Fournisseur A', matriculeFiscal: 'MF001' },
        { supplier: 'Fournisseur B' },
      ];
      stores.migrateSuppliersFromExpenses(CID, expenses);
      expect(stores.suppliersStore.getAll(CID)).toHaveLength(2);
    });

    it('skips empty supplier names', () => {
      const expenses = [
        { supplier: '' },
        { supplier: '   ' },
      ];
      stores.migrateSuppliersFromExpenses(CID, expenses);
      expect(stores.suppliersStore.getAll(CID)).toHaveLength(0);
    });

    it('migrates from legacy localStorage suppliers', () => {
      const legacyKey = `sc_manual_suppliers_${CID}`;
      localStorage.setItem(legacyKey, JSON.stringify([
        { name: 'Legacy Fournisseur', mf: 'MF999', phone: '123', address: 'Sfax' },
      ]));
      stores.migrateSuppliersFromExpenses(CID, []);
      const list = stores.suppliersStore.getAll(CID);
      expect(list).toHaveLength(1);
      expect(list[0].nom).toBe('Legacy Fournisseur');
      expect(list[0].matricule_fiscal).toBe('MF999');
    });
  });

  describe('computeOrderTotals', () => {
    it('computes HT/TVA/TTC for single line', () => {
      const lines = [{ quantite: 2, prix_unitaire_ht: 100, taux_tva: 19 }];
      const t = stores.computeOrderTotals(lines);
      expect(t.total_ht).toBe(200);
      expect(t.total_tva).toBe(38);
      expect(t.total_ttc).toBe(238);
    });

    it('computes totals for multiple lines', () => {
      const lines = [
        { quantite: 1, prix_unitaire_ht: 100, taux_tva: 19 },
        { quantite: 3, prix_unitaire_ht: 50, taux_tva: 7 },
      ];
      const t = stores.computeOrderTotals(lines);
      expect(t.total_ht).toBe(250);
      expect(t.total_tva).toBe(19 + 10.5);
      expect(t.total_ttc).toBe(250 + 19 + 10.5);
    });

    it('returns zero for empty lines', () => {
      const t = stores.computeOrderTotals([]);
      expect(t.total_ht).toBe(0);
      expect(t.total_tva).toBe(0);
      expect(t.total_ttc).toBe(0);
    });

    it('handles zero quantities', () => {
      const lines = [{ quantite: 0, prix_unitaire_ht: 100, taux_tva: 19 }];
      const t = stores.computeOrderTotals(lines);
      expect(t.total_ht).toBe(0);
    });
  });
});
