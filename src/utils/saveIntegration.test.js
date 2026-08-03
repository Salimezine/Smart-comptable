import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ls = {};
function makeLS() {
  const storage = {};
  return {
    getItem: (k) => k in storage ? storage[k] : null,
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; },
    _dump: () => storage,
  };
}

let localStore;
let events = [];

beforeEach(() => {
  localStore = makeLS();
  vi.stubGlobal('localStorage', localStore);
  events = [];
  globalThis.window = {
    dispatchEvent: (e) => { events.push(e.type); return true; },
  };
  vi.stubGlobal('navigator', { onLine: true });
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete globalThis.window;
});

describe('saveIntegration — orchestrateur unifié', () => {
  it('enregistre un document achat : journal + stock + fournisseur + événements', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-' + Math.random().toString(36).slice(2) });
    localStorage.setItem('smart_comptable_current_id', 'C1');

    const si = await import('./saveIntegration');
    const res = si.enregistrerDocument('C1', {
      type: 'achat',
      fournisseur: 'Fournisseur Test',
      mf: '1234567/X/A/M/000',
      date: '2026-01-15',
      numero: 'FAC-001',
      total_ht: 1000, total_tva: 190, total_ttc: 1190,
      lignes: [
        { designation: 'Cartouches HP', quantite: 10, prix_unitaire_ht: 100, taux_tva: 19 },
      ],
    });

    expect(res.journal.ok).toBe(true);
    expect(res.tiers).toBeTruthy();
    expect(res.stock).toBe(true);

    // Journal enregistré
    const journal = JSON.parse(localStorage.getItem('smart_journal_C1'));
    expect(journal.length).toBeGreaterThan(0);

    // Fournisseur auto-créé en ERP
    const suppliers = JSON.parse(localStorage.getItem('erp_suppliers_C1'));
    expect(suppliers.some(s => s.nom === 'Fournisseur Test')).toBe(true);

    // Stock ERP : produit + mouvement + stock_actuel
    const products = JSON.parse(localStorage.getItem('erp_products_C1'));
    expect(products.length).toBe(1);
    const mvts = JSON.parse(localStorage.getItem('erp_stock_movements_C1'));
    expect(mvts.length).toBe(1);
    expect(mvts[0].type).toBe('entree');
    expect(products[0].stock_actuel).toBe(10);

    // Événements émis
    expect(events).toContain('journal:updated');
    expect(events).toContain('stock:updated');
    expect(events).toContain('data:updated');
  });

  it('vente : sortie de stock + client auto-enregistré', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-' + Math.random().toString(36).slice(2) });
    localStorage.setItem('smart_comptable_current_id', 'C1');

    // Pré-créer le produit + une entrée de stock (le stock est recalculé depuis les mouvements)
    const products = [{ id: 'P1', designation: 'Produit A', prix_achat_ht: 50, prix_vente_ht: 100, stock_actuel: 20 }];
    localStorage.setItem('erp_products_C1', JSON.stringify(products));
    localStorage.setItem('erp_stock_movements_C1', JSON.stringify([
      { id: 'M1', product_id: 'P1', type: 'entree', quantite: 20, date: '2026-01-01' },
    ]));

    const si = await import('./saveIntegration');
    si.enregistrerDocument('C1', {
      type: 'vente',
      client: 'Client Dupont',
      date: '2026-02-01',
      numero: 'FAC-100',
      total_ht: 200, total_tva: 38, total_ttc: 238,
      lignes: [
        { designation: 'Produit A', quantite: 5, prix_unitaire_ht: 100, taux_tva: 19 },
      ],
    });

    const productsAfter = JSON.parse(localStorage.getItem('erp_products_C1'));
    expect(productsAfter[0].stock_actuel).toBe(15);
    const mvts = JSON.parse(localStorage.getItem('erp_stock_movements_C1'));
    expect(mvts.filter(m => m.product_id === 'P1').length).toBe(2);
    expect(mvts.find(m => m.type === 'sortie').quantite).toBe(5);

    const clients = JSON.parse(localStorage.getItem('erp_clients_C1'));
    expect(clients.some(c => c.nom === 'Client Dupont')).toBe(true);
  });

  it('ne duplique pas le tiers existant', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-' + Math.random().toString(36).slice(2) });
    localStorage.setItem('smart_comptable_current_id', 'C1');
    localStorage.setItem('erp_suppliers_C1', JSON.stringify([{ id: 'S1', nom: 'Fournisseur Test', code: 'F001' }]));

    const si = await import('./saveIntegration');
    si.enregistrerDocument('C1', {
      type: 'achat',
      fournisseur: 'Fournisseur Test',
      date: '2026-01-15',
      numero: 'FAC-002',
      total_ht: 100, total_tva: 19, total_ttc: 119,
      lignes: [{ designation: 'X', quantite: 1, prix_unitaire_ht: 100 }],
    });

    const suppliers = JSON.parse(localStorage.getItem('erp_suppliers_C1'));
    expect(suppliers.filter(s => s.nom === 'Fournisseur Test').length).toBe(1);
  });
});
