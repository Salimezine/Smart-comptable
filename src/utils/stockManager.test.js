import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockIsSupabaseEnabled } = vi.hoisted(() => ({
  mockIsSupabaseEnabled: vi.fn(() => false),
}));

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert: vi.fn(() => ({ error: null })),
    })),
  },
  isSupabaseEnabled: mockIsSupabaseEnabled,
}));

import { updateStockFromInvoice, getStockSummary } from './stockManager.js';

let mockStorage = {};

beforeEach(() => {
  mockStorage = {};
  mockStorage['smart_comptable_current_id'] = 'test-company-123';
  vi.stubGlobal('localStorage', {
    getItem: (key) => mockStorage[key] ?? null,
    setItem: (key, val) => { mockStorage[key] = String(val); },
    removeItem: (key) => { delete mockStorage[key]; },
    clear: () => { mockStorage = {}; },
    get length() { return Object.keys(mockStorage).length; },
    key: (i) => Object.keys(mockStorage)[i],
  });
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubGlobal('window', {
    dispatchEvent: () => {},
    CustomEvent: () => ({}),
  });
});

describe('updateStockFromInvoice', () => {
  it('does nothing for null invoice', () => {
    updateStockFromInvoice(null);
    expect(localStorage.getItem('smart_stock_test-company-123')).toBeNull();
    expect(localStorage.getItem('smart_stock_mouvements_test-company-123')).toBeNull();
  });

  it('does nothing for invoice without lignes', () => {
    updateStockFromInvoice({ id: 'INV-001', type: 'achat' });
    expect(localStorage.getItem('smart_stock_test-company-123')).toBeNull();
  });

  it('creates stock entry for purchase invoice (entree)', () => {
    const inv = {
      id: 'INV-001',
      type: 'achat',
      dateEmission: '2026-06-01',
      lignes: [
        { designation: 'Clavier USB', quantite: 10, prixUnitaireHT: 25.500 }
      ]
    };
    updateStockFromInvoice(inv);
    const stock = JSON.parse(localStorage.getItem('smart_stock_test-company-123'));
    expect(stock).toHaveLength(1);
    expect(stock[0].designation).toBe('Clavier USB');
    expect(stock[0].quantite).toBe(10);
    expect(stock[0].valeurUnitaire).toBe(25.500);
    const movs = JSON.parse(localStorage.getItem('smart_stock_mouvements_test-company-123'));
    expect(movs).toHaveLength(1);
    expect(movs[0].type).toBe('entree');
    expect(movs[0].delta).toBe(10);
    expect(movs[0].reference).toBe('INV-001');
  });

  it('deducts stock for sales invoice (sortie)', () => {
    const buy = { id: 'INV-001', type: 'achat', dateEmission: '2026-06-01', lignes: [{ designation: 'Clavier USB', quantite: 10, prixUnitaireHT: 25 }] };
    updateStockFromInvoice(buy);
    const sell = { id: 'INV-002', isVente: true, dateEmission: '2026-06-15', lignes: [{ designation: 'Clavier USB', quantite: 3, prixUnitaireHT: 45 }] };
    updateStockFromInvoice(sell);
    const stock = JSON.parse(localStorage.getItem('smart_stock_test-company-123'));
    expect(stock[0].quantite).toBe(7);
    expect(stock[0].valeurUnitaire).toBe(45);
    const movs = JSON.parse(localStorage.getItem('smart_stock_mouvements_test-company-123'));
    expect(movs).toHaveLength(2);
    expect(movs[0].type).toBe('sortie');
    expect(movs[0].delta).toBe(-3);
  });

  it('handles multiple different articles in one invoice', () => {
    const inv = {
      id: 'INV-003', type: 'achat', dateEmission: '2026-06-01',
      lignes: [
        { designation: 'Souris', quantite: 20, prixUnitaireHT: 15 },
        { designation: 'Clavier', quantite: 10, prixUnitaireHT: 30 },
        { designation: 'Écran', quantite: 5, prixUnitaireHT: 200 }
      ]
    };
    updateStockFromInvoice(inv);
    const stock = JSON.parse(localStorage.getItem('smart_stock_test-company-123'));
    expect(stock).toHaveLength(3);
    expect(stock.find(a => a.designation === 'Souris').quantite).toBe(20);
    expect(stock.find(a => a.designation === 'Clavier').quantite).toBe(10);
    expect(stock.find(a => a.designation === 'Écran').quantite).toBe(5);
  });

  it('does not create articles for unknown items on sortie', () => {
    const inv = { id: 'INV-004', isVente: true, dateEmission: '2026-06-01', lignes: [{ designation: 'Article Inconnu', quantite: 5, prixUnitaireHT: 10 }] };
    updateStockFromInvoice(inv);
    const stock = JSON.parse(localStorage.getItem('smart_stock_test-company-123') || '[]');
    expect(stock).toHaveLength(0);
  });

  it('accumulates quantities for same article across invoices', () => {
    updateStockFromInvoice({ id: 'INV-001', type: 'achat', dateEmission: '2026-06-01', lignes: [{ designation: 'Carton A4', quantite: 5, prixUnitaireHT: 10 }] });
    updateStockFromInvoice({ id: 'INV-002', type: 'achat', dateEmission: '2026-06-10', lignes: [{ designation: 'Carton A4', quantite: 3, prixUnitaireHT: 12 }] });
    const stock = JSON.parse(localStorage.getItem('smart_stock_test-company-123'));
    expect(stock[0].quantite).toBe(8);
    expect(stock[0].valeurUnitaire).toBe(12);
  });
});

describe('getStockSummary', () => {
  it('returns empty array when no stock', () => {
    expect(getStockSummary()).toEqual([]);
  });

  it('returns only articles with positive quantity', () => {
    const stock = [
      { id: 'a1', designation: 'Article A', quantite: 5, valeurUnitaire: 10 },
      { id: 'a2', designation: 'Article B', quantite: 0, valeurUnitaire: 15 },
      { id: 'a3', designation: 'Article C', quantite: -2, valeurUnitaire: 20 },
    ];
    localStorage.setItem('smart_stock_test-company-123', JSON.stringify(stock));
    const result = getStockSummary();
    expect(result).toHaveLength(1);
    expect(result[0].designation).toBe('Article A');
    expect(result[0].quantite).toBe(5);
    expect(result[0].valeurTotale).toBe(50);
  });

  it('computes valeurTotale correctly', () => {
    const stock = [{ id: 'a1', designation: 'Test', quantite: 10, valeurUnitaire: 25.500 }];
    localStorage.setItem('smart_stock_test-company-123', JSON.stringify(stock));
    const result = getStockSummary();
    expect(result[0].valeurTotale).toBeCloseTo(255, 1);
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('smart_stock_test-company-123', '{corrupted');
    expect(getStockSummary()).toEqual([]);
  });
});
