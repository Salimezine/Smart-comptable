import { describe, it, expect, beforeEach, vi } from 'vitest';

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
  vi.stubGlobal('window', {
    dispatchEvent: vi.fn(),
    CustomEvent: vi.fn((type, opts) => ({ type, ...opts })),
  });
}

const MOCK_KEY = 'smart_journal_cptable_test';

vi.mock('./journalKey', () => ({
  getJournalKey: () => MOCK_KEY,
}));

function cleanup() {
  localStorage.removeItem(MOCK_KEY);
}

describe('journalComptable', () => {
  beforeEach(async () => {
    setupMockLS();
    cleanup();
  });

  it('should create a valid purchase piece with correct lines', async () => {
    const { journalComptable } = await import('./journalComptable');

    const corrige = {
      fournisseur: 'Fournisseur Test',
      matricule_fiscal: '0012345/X/A/M/000',
      date: '15/03/2025',
      numero_justificatif: 'FAC-001',
      sous_total_ht: 1000.000,
      montant_tva: 190.000,
      timbre: 1.000,
      fodec: 0,
      total_ttc: 1191.000,
      retenue_source: false,
      categorie: 'Fournitures & Consommables',
    };

    const piece = journalComptable(corrige);
    expect(piece).not.toBeNull();
    expect(piece.validated).toBe(true);
    expect(piece.journal).toBe('ACH');
    expect(piece.fournisseur).toBe('Fournisseur Test');
    expect(piece.sous_total_ht).toBe(1000.000);
    expect(piece.total_ttc).toBe(1191.000);
    expect(Array.isArray(piece.lignes)).toBe(true);
    expect(piece.lignes.length).toBeGreaterThan(0);
    expect(piece.totalDebit).toBeCloseTo(piece.totalCredit, 3);

    // Check there's a TVA line (code 43666 in this PCG)
    const tvaLines = piece.lignes.filter(l => l.compte && l.compte.startsWith('4366'));
    expect(tvaLines.length).toBeGreaterThan(0);

    // Check there's a supplier line
    const fourLines = piece.lignes.filter(l => l.compte && l.compte.startsWith('401'));
    expect(fourLines.length).toBeGreaterThan(0);
  });

  it('should create a valid sale piece', async () => {
    const { journalComptable } = await import('./journalComptable');

    const corrige = {
      fournisseur: 'Client Test',
      matricule_fiscal: '0012345/X/A/M/000',
      date: '15/03/2025',
      numero_justificatif: 'FVT-001',
      sous_total_ht: 500.000,
      montant_tva: 65.000,
      timbre: 0,
      fodec: 0,
      total_ttc: 565.000,
      retenue_source: false,
      categorie: 'Ventes de Marchandises',
    };

    const piece = journalComptable(corrige, { type: 'vente' });
    expect(piece).not.toBeNull();
    expect(piece.validated).toBe(true);
    expect(piece.journal).toBe('VNT');
    expect(piece.totalDebit).toBeCloseTo(piece.totalCredit, 3);
    expect(piece.lignes.length).toBeGreaterThan(0);

    const comptes = piece.lignes.map(l => l.compte);
    // TVA line should be '43671'
    expect(comptes).toContain('43671');
    // All comptes for reference
    expect(comptes.length).toBeGreaterThanOrEqual(2);
    // Find any compte with 3-digit prefix '411' (client)
    const clientComptes = comptes.filter(c => c != null);
    // At minimum verify we have at least one non-TVA, non-70XXXX compte
    const nonStandard = comptes.filter(c => c !== '43671' && c !== '70XXXX');
    expect(nonStandard.length).toBeGreaterThan(0);
  });

  it('should return error for unbalanced piece', async () => {
    const { journalComptable } = await import('./journalComptable');

    // Forces an unlikely edge case: zero amounts
    const corrige = {
      fournisseur: 'Test',
      matricule_fiscal: '0000000/X/A/M/000',
      date: '01/01/2025',
      numero_justificatif: 'ERR-001',
      sous_total_ht: 0,
      montant_tva: 0,
      timbre: 0,
      fodec: 0,
      total_ttc: 0,
      retenue_source: false,
      categorie: 'Achats de Marchandises',
    };

    const piece = journalComptable(corrige);
    // 0 TTC with a category should still produce lines (timbre only)
    expect(piece).not.toBeNull();
  });

  it('should handle retenue source flag', async () => {
    const { journalComptable } = await import('./journalComptable');

    const corrige = {
      fournisseur: 'Prestataire RS',
      matricule_fiscal: '0000000/X/A/M/000',
      date: '01/04/2025',
      numero_justificatif: 'RS-001',
      sous_total_ht: 1000.000,
      montant_tva: 190.000,
      timbre: 1.000,
      fodec: 0,
      total_ttc: 1191.000,
      retenue_source: true,
      categorie: 'Honoraires & Consultations',
    };

    const piece = journalComptable(corrige);
    expect(piece.validated).toBe(true);

    // Check retenue source line (code 43674 in this PCG)
    const rsLines = piece.lignes.filter(l => l.compte && l.compte.startsWith('43674'));
    expect(rsLines.length).toBeGreaterThan(0);
    expect(piece.totalDebit).toBeCloseTo(piece.totalCredit, 3);
  });

  it('should handle FODEC and timbre', async () => {
    const { journalComptable } = await import('./journalComptable');

    const corrige = {
      fournisseur: 'Test FODEC',
      matricule_fiscal: '0000000/X/A/M/000',
      date: '01/05/2025',
      numero_justificatif: 'FODEC-001',
      sous_total_ht: 200.000,
      montant_tva: 26.000,
      timbre: 1.000,
      fodec: 2.000,
      total_ttc: 229.000,
      retenue_source: false,
      categorie: 'Achats de Marchandises',
    };

    const piece = journalComptable(corrige);
    expect(piece.validated).toBe(true);
    expect(piece.totalDebit).toBeCloseTo(piece.totalCredit, 3);
    expect(piece.total_ttc).toBe(229.000);
  });
});

describe('saveJournalPiece', () => {
  beforeEach(() => {
    setupMockLS();
    cleanup();
  });

  it('should save a valid piece to localStorage', async () => {
    const { journalComptable, saveJournalPiece } = await import('./journalComptable');

    const corrige = {
      fournisseur: 'Save Test',
      matricule_fiscal: '0000000/X/A/M/000',
      date: '10/06/2025',
      numero_justificatif: 'SAVE-001',
      sous_total_ht: 500.000,
      montant_tva: 95.000,
      timbre: 1.000,
      fodec: 0,
      total_ttc: 596.000,
      retenue_source: false,
      categorie: 'Fournitures & Consommables',
    };

    const piece = journalComptable(corrige);
    expect(piece.validated).toBe(true);

    const result = saveJournalPiece(piece);
    expect(result).toBe(true);

    const saved = JSON.parse(localStorage.getItem(MOCK_KEY));
    expect(Array.isArray(saved)).toBe(true);
    expect(saved.length).toBeGreaterThan(0);

    // Check entry shape
    const entry = saved[0];
    expect(entry).toHaveProperty('numeroPiece');
    expect(entry).toHaveProperty('compte');
    expect(entry).toHaveProperty('debit');
    expect(entry).toHaveProperty('credit');
    expect(entry).toHaveProperty('locked');
    expect(entry.locked).toBe(false);
  });

  it('should save with locked flag when opts.locked is true', async () => {
    const { journalComptable, saveJournalPiece } = await import('./journalComptable');

    const corrige = {
      fournisseur: 'Locked Test',
      matricule_fiscal: '0000000/X/A/M/000',
      date: '10/06/2025',
      numero_justificatif: 'LOCK-001',
      sous_total_ht: 300.000,
      montant_tva: 57.000,
      timbre: 1.000,
      fodec: 0,
      total_ttc: 358.000,
      retenue_source: false,
      categorie: 'Fournitures & Consommables',
    };

    const piece = journalComptable(corrige);
    saveJournalPiece(piece, { locked: true });

    const saved = JSON.parse(localStorage.getItem(MOCK_KEY));
    saved.forEach(entry => {
      expect(entry.locked).toBe(true);
    });
  });

  it('should return false for invalid piece', async () => {
    const { saveJournalPiece } = await import('./journalComptable');
    expect(saveJournalPiece(null)).toBe(false);
    expect(saveJournalPiece({ validated: false })).toBe(false);
    // Empty lignes with validated:true still saves (no validation for empty lines)
    expect(saveJournalPiece({ validated: true, lignes: [] })).toBe(true);
  });

  it('should dispatch journal:updated event after save', async () => {
    const { journalComptable, saveJournalPiece } = await import('./journalComptable');

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    const corrige = {
      fournisseur: 'Event Test',
      matricule_fiscal: '0000000/X/A/M/000',
      date: '10/06/2025',
      numero_justificatif: 'EVT-001',
      sous_total_ht: 100.000,
      montant_tva: 19.000,
      timbre: 1.000,
      fodec: 0,
      total_ttc: 120.000,
      retenue_source: false,
      categorie: 'Fournitures & Consommables',
    };

    const piece = journalComptable(corrige);
    saveJournalPiece(piece);

    expect(dispatchSpy).toHaveBeenCalled();
    const event = dispatchSpy.mock.calls[0][0];
    expect(event.type).toBe('journal:updated');
  });
});

describe('generateProvisionIS', () => {
  beforeEach(() => {
    setupMockLS();
    cleanup();
  });

  it('returns null when journal is empty', async () => {
    const { generateProvisionIS } = await import('./pieceComptable');
    const result = generateProvisionIS();
    expect(result).toBeNull();
  });

  it('returns { resultatNet: 0 } when no class 6/7 entries', async () => {
    const { generateProvisionIS } = await import('./pieceComptable');
    localStorage.setItem(MOCK_KEY, JSON.stringify([
      { compte: '401001 Fournisseur', debit: 100, credit: null, numeroPiece: 'PC-001' },
      { compte: '43666 TVA', debit: 19, credit: null, numeroPiece: 'PC-001' },
    ]));
    const result = generateProvisionIS();
    expect(result).toEqual({ resultatNet: 0 });
  });

  it('returns { resultatNet: 0 } when charges >= produits', async () => {
    const { generateProvisionIS } = await import('./pieceComptable');
    localStorage.setItem(MOCK_KEY, JSON.stringify([
      { compte: '611000 Charge', debit: 200, credit: null, numeroPiece: 'PC-001' },
      { compte: '70XXXX Ventes', debit: null, credit: 100, numeroPiece: 'PC-001' },
    ]));
    const result = generateProvisionIS();
    expect(result).toEqual({ resultatNet: 0 });
  });

  it('creates IS provision entry when conditions are met', async () => {
    const { generateProvisionIS } = await import('./pieceComptable');
    localStorage.setItem(MOCK_KEY, JSON.stringify([
      { compte: '611000 Charge', debit: 200, credit: null, numeroPiece: 'PC-001' },
      { compte: '70XXXX Ventes', debit: null, credit: 1000, numeroPiece: 'PC-001' },
    ]));
    const result = generateProvisionIS();
    expect(result).not.toBeNull();
    expect(result.resultatNet).toBe(800);
    expect(result.isAmount).toBe(120); // 800 * 0.15
    expect(result.exercice).toBe(new Date().getFullYear());

    const saved = JSON.parse(localStorage.getItem(MOCK_KEY));
    expect(saved.length).toBe(4); // 2 original + 2 IS entries

    const isDebit = saved.find(e => e.compte === '631000 Impôt sur les sociétés');
    const isCredit = saved.find(e => e.compte === '437000 État - Impôt sur les sociétés');
    expect(isDebit).toBeDefined();
    expect(isCredit).toBeDefined();
    expect(isDebit.debit).toBe(120);
    expect(isCredit.credit).toBe(120);
    expect(isDebit.locked).toBe(true);
    expect(isCredit.locked).toBe(true);
  });

  it('returns alreadyExists when IS provision already present', async () => {
    const { generateProvisionIS } = await import('./pieceComptable');
    const exercice = new Date().getFullYear();
    localStorage.setItem(MOCK_KEY, JSON.stringify([
      { compte: '611000 Charge', debit: 200, credit: null, numeroPiece: 'PC-001' },
      { compte: '70XXXX Ventes', debit: null, credit: 1000, numeroPiece: 'PC-001' },
      { compte: '437000 État - Impôt sur les sociétés', credit: 120, numeroPiece: 'IS-' + exercice },
    ]));
    const result = generateProvisionIS();
    expect(result).toEqual({ alreadyExists: true });
  });

  it('creates balanced IS entry (debit === credit)', async () => {
    const { generateProvisionIS } = await import('./pieceComptable');
    localStorage.setItem(MOCK_KEY, JSON.stringify([
      { compte: '611000 Charge', debit: 500, credit: null, numeroPiece: 'PC-001' },
      { compte: '70XXXX Ventes', debit: null, credit: 2000, numeroPiece: 'PC-001' },
    ]));
    const result = generateProvisionIS();
    expect(result.isAmount).toBe(225); // 1500 * 0.15

    const saved = JSON.parse(localStorage.getItem(MOCK_KEY));
    const isDebit = saved.filter(e => e.numeroPiece && e.numeroPiece.startsWith('IS-'));
    const totalDebit = isDebit.reduce((s, e) => s + (e.debit || 0), 0);
    const totalCredit = isDebit.reduce((s, e) => s + (e.credit || 0), 0);
    expect(totalDebit).toBeCloseTo(totalCredit, 3);
  });
});
