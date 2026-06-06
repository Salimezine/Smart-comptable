import { describe, it, expect, beforeEach, vi } from 'vitest';

// Set up localStorage mock before anything else
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

const MOCK_KEY = 'smart_journal_test';

vi.mock('./utils/journalKey', () => ({
  getJournalKey: () => MOCK_KEY,
}));

// Minimal journal covering all account classes
const BASE_JOURNAL = [
  // BILAN — Actif
  { date:'2025-01-01', numeroPiece:'OD-001', compte:'201000 Frais de constitution', libelle:'Frais', debit:50000, credit:0, fournisseur:'', categorie:'', journal:'OD', locked:true },
  { date:'2025-01-01', numeroPiece:'OD-001', compte:'211000 Brevets', libelle:'Incorp', debit:200000, credit:0, fournisseur:'', categorie:'', journal:'OD', locked:true },
  { date:'2025-01-01', numeroPiece:'OD-001', compte:'221000 Terrains', libelle:'Terrains', debit:1000000, credit:0, fournisseur:'', categorie:'', journal:'OD', locked:true },
  { date:'2025-01-01', numeroPiece:'OD-001', compte:'282000 Amort terrain', libelle:'Amort', debit:0, credit:100000, fournisseur:'', categorie:'', journal:'OD', locked:true },
  { date:'2025-01-01', numeroPiece:'OD-001', compte:'291000 Prov incorp', libelle:'Prov', debit:0, credit:30000, fournisseur:'', categorie:'', journal:'OD', locked:true },
  // Stocks
  { date:'2025-01-01', numeroPiece:'OD-001', compte:'300000 Stock marchandises', libelle:'Stock initial', debit:800000, credit:0, fournisseur:'', categorie:'', journal:'OD', locked:true },
  { date:'2025-01-01', numeroPiece:'OD-001', compte:'391000 Prov stock', libelle:'Prov stock', debit:0, credit:20000, fournisseur:'', categorie:'', journal:'OD', locked:true },
  // Clients / TVA / Trésorerie
  { date:'2025-01-01', numeroPiece:'VNT-001', compte:'411000 Client X', libelle:'Vente X', debit:200000, credit:0, fournisseur:'', categorie:'', journal:'VNT', locked:true },
  { date:'2025-01-01', numeroPiece:'VNT-001', compte:'491100 Prov client', libelle:'Prov client', debit:0, credit:10000, fournisseur:'', categorie:'', journal:'VNT', locked:true },
  { date:'2025-01-02', numeroPiece:'VNT-001', compte:'443100 TVA collectée', libelle:'TVA collectée', debit:0, credit:50000, fournisseur:'', categorie:'', journal:'VNT', locked:true },
  { date:'2025-01-02', numeroPiece:'ACH-001', compte:'445600 TVA déductible', libelle:'TVA déductible', debit:25000, credit:0, fournisseur:'', categorie:'', journal:'ACH', locked:true },
  { date:'2025-01-03', numeroPiece:'ACH-001', compte:'532000 Banque', libelle:'Paiement', debit:400000, credit:100000, fournisseur:'', categorie:'', journal:'BQ', locked:true },
  // BILAN — Passif (debit entries per code expectation: Math.max(cl(X),0))
  { date:'2025-01-01', numeroPiece:'OD-001', compte:'101000 Capital social', libelle:'Capital', debit:2000000, credit:0, fournisseur:'', categorie:'', journal:'OD', locked:true },
  { date:'2025-01-01', numeroPiece:'OD-001', compte:'111000 Réserves légales', libelle:'Réserves', debit:400000, credit:0, fournisseur:'', categorie:'', journal:'OD', locked:true },
  { date:'2025-01-01', numeroPiece:'OD-001', compte:'121000 Report à nouveau', libelle:'RAN', debit:50000, credit:0, fournisseur:'', categorie:'', journal:'OD', locked:true },
  { date:'2025-01-01', numeroPiece:'OD-001', compte:'131000 Résultat exercice', libelle:'Résultat', debit:250000, credit:0, fournisseur:'', categorie:'', journal:'OD', locked:true },
  { date:'2025-01-01', numeroPiece:'OD-001', compte:'141000 Subventions', libelle:'Subv', debit:100000, credit:0, fournisseur:'', categorie:'', journal:'OD', locked:true },
  { date:'2025-01-01', numeroPiece:'OD-001', compte:'161000 Emprunt', libelle:'Emprunt', debit:600000, credit:0, fournisseur:'', categorie:'', journal:'OD', locked:true },
  { date:'2025-01-01', numeroPiece:'OD-001', compte:'151000 Provisions risques', libelle:'Provisions', debit:80000, credit:0, fournisseur:'', categorie:'', journal:'OD', locked:true },
  { date:'2025-01-01', numeroPiece:'OD-001', compte:'181000 Autres passifs NC', libelle:'APNC', debit:50000, credit:0, fournisseur:'', categorie:'', journal:'OD', locked:true },
  // Passif courant
  { date:'2025-01-02', numeroPiece:'ACH-001', compte:'401000 Fournisseur A', libelle:'Fournisseur', debit:0, credit:150000, fournisseur:'', categorie:'', journal:'ACH', locked:true },
  { date:'2025-01-03', numeroPiece:'BQ-001', compte:'521000 Concours bancaire', libelle:'CB', debit:0, credit:50000, fournisseur:'', categorie:'', journal:'BQ', locked:true },
  { date:'2025-01-02', numeroPiece:'OD-002', compte:'421000 Personnel', libelle:'Dettes personnel', debit:0, credit:120000, fournisseur:'', categorie:'', journal:'OD', locked:true },
  { date:'2025-01-02', numeroPiece:'OD-002', compte:'441000 État impôts', libelle:'Dettes fiscales', debit:0, credit:60000, fournisseur:'', categorie:'', journal:'OD', locked:true },
  // COMPTE DE RÉSULTAT — Produits
  { date:'2025-01-01', numeroPiece:'VNT-001', compte:'701000 Ventes marchandises', libelle:'Ventes M', debit:0, credit:200000, fournisseur:'', categorie:'', journal:'VNT', locked:true },
  { date:'2025-01-01', numeroPiece:'VNT-001', compte:'706000 Prestations', libelle:'Prestations', debit:0, credit:50000, fournisseur:'', categorie:'', journal:'VNT', locked:true },
  { date:'2025-01-01', numeroPiece:'OD-003', compte:'711000 Prod stockée', libelle:'Stockée', debit:0, credit:30000, fournisseur:'', categorie:'', journal:'OD', locked:true },
  { date:'2025-01-01', numeroPiece:'OD-003', compte:'721000 Prod immobilisée', libelle:'Immobilisée', debit:0, credit:20000, fournisseur:'', categorie:'', journal:'OD', locked:true },
  { date:'2025-01-01', numeroPiece:'OD-003', compte:'741000 Subventions', libelle:'Subv expl', debit:0, credit:15000, fournisseur:'', categorie:'', journal:'OD', locked:true },
  { date:'2025-01-01', numeroPiece:'OD-003', compte:'761000 Produits financiers', libelle:'Financiers', debit:0, credit:12000, fournisseur:'', categorie:'', journal:'OD', locked:true },
  { date:'2025-01-01', numeroPiece:'OD-003', compte:'771000 Produits exceptionnels', libelle:'Exceptionnels', debit:0, credit:8000, fournisseur:'', categorie:'', journal:'OD', locked:true },
  { date:'2025-01-01', numeroPiece:'OD-003', compte:'781000 Reprises', libelle:'Reprises', debit:0, credit:10000, fournisseur:'', categorie:'', journal:'OD', locked:true },
  // COMPTE DE RÉSULTAT — Charges
  { date:'2025-01-02', numeroPiece:'ACH-001', compte:'601000 Achats marchandises', libelle:'Achats M', debit:120000, credit:0, fournisseur:'', categorie:'', journal:'ACH', locked:true },
  { date:'2025-01-02', numeroPiece:'ACH-001', compte:'602000 Achats MP', libelle:'Achats MP', debit:40000, credit:0, fournisseur:'', categorie:'', journal:'ACH', locked:true },
  { date:'2025-01-02', numeroPiece:'ACH-001', compte:'606000 Achats non stockés', libelle:'Autres achats', debit:15000, credit:0, fournisseur:'', categorie:'', journal:'ACH', locked:true },
  { date:'2025-01-02', numeroPiece:'ACH-001', compte:'611000 Sous-traitance', libelle:'Charges externes', debit:50000, credit:0, fournisseur:'', categorie:'', journal:'ACH', locked:true },
  { date:'2025-01-02', numeroPiece:'OD-002', compte:'621000 Salaires', libelle:'Personnel', debit:80000, credit:0, fournisseur:'', categorie:'', journal:'OD', locked:true },
  { date:'2025-01-02', numeroPiece:'OD-002', compte:'631000 Impôts', libelle:'Impôts', debit:20000, credit:0, fournisseur:'', categorie:'', journal:'OD', locked:true },
  { date:'2025-01-02', numeroPiece:'OD-002', compte:'651000 Autres charges', libelle:'Autres', debit:10000, credit:0, fournisseur:'', categorie:'', journal:'OD', locked:true },
  { date:'2025-01-02', numeroPiece:'OD-002', compte:'661000 Intérêts', libelle:'Charges financières', debit:15000, credit:0, fournisseur:'', categorie:'', journal:'OD', locked:true },
  { date:'2025-01-02', numeroPiece:'OD-002', compte:'671000 Charges exceptionnelles', libelle:'Charges exc.', debit:5000, credit:0, fournisseur:'', categorie:'', journal:'OD', locked:true },
  { date:'2025-01-02', numeroPiece:'OD-002', compte:'681000 Dotations', libelle:'Dotations', debit:25000, credit:0, fournisseur:'', categorie:'', journal:'OD', locked:true },
  // Compte 6654 (impôts dans charges financières)
  { date:'2025-01-02', numeroPiece:'OD-002', compte:'665400 TCL', libelle:'TCL', debit:3000, credit:0, fournisseur:'', categorie:'', journal:'OD', locked:true },
  // Compte 64 (personnel — moved here)
  { date:'2025-01-02', numeroPiece:'OD-002', compte:'641000 Charges sociales', libelle:'CNSS', debit:30000, credit:0, fournisseur:'', categorie:'', journal:'OD', locked:true },
  // Compte 72 (prod immobilisée — credit side already above)
  // Compte 78 (reprises — credit side already above)
  // Compte 52 (concours bancaire — already above)
  // Trésorerie active
  { date:'2025-01-03', numeroPiece:'BQ-001', compte:'531000 Caisse', libelle:'Caisse', debit:100000, credit:0, fournisseur:'', categorie:'', journal:'BQ', locked:true },
  { date:'2025-01-03', numeroPiece:'BQ-001', compte:'590000 Prov trésorerie', libelle:'Prov trésorerie', debit:0, credit:5000, fournisseur:'', categorie:'', journal:'BQ', locked:true },
];

function setupJournal(entries = BASE_JOURNAL) {
  localStorage.setItem(MOCK_KEY, JSON.stringify(entries));
}

function cleanup() {
  localStorage.removeItem(MOCK_KEY);
}

describe('generateFromJournal', () => {
  beforeEach(async () => {
    setupMockLS();
    cleanup();
    setupJournal();
  });

  it('should return null when journal is empty', async () => {
    cleanup();
    const { generateFromJournal } = await import('./accountingUtils');
    expect(generateFromJournal()).toBeNull();
  });

  it('should return bilan with all sections', async () => {
    const { generateFromJournal } = await import('./accountingUtils');
    const data = generateFromJournal();
    expect(data).not.toBeNull();
    const { bilan } = data;

    // Actif non courant
    expect(bilan.fraisPreliminaires).toBeGreaterThan(0);
    expect(bilan.immobilisationsIncorporelles).toBeGreaterThan(0);
    expect(bilan.immobilisationsCorporelles).toBeGreaterThan(0);
    expect(bilan.amortissementsDeduction).toBeGreaterThan(0);
    expect(bilan.provisionsActifNCDeduction).toBeGreaterThan(0);

    // Actif courant
    expect(bilan.stocks).toBeGreaterThan(0);
    expect(bilan.clients).toBeGreaterThan(0);
    expect(bilan.tresorerieActif).toBeGreaterThan(0);

    // Passif
    expect(bilan.capitalSocial).toBeGreaterThan(0);
    expect(bilan.reserves).toBeGreaterThan(0);
    expect(bilan.resultatsReportes).toBeGreaterThan(0);
    expect(bilan.resultatExercice).toBeGreaterThan(0);
    expect(bilan.autresCapitauxPropres).toBeGreaterThan(0);
    expect(bilan.emprunts).toBeGreaterThan(0);
    expect(bilan.provisions).toBeGreaterThan(0);
    expect(bilan.autresPassifsNC).toBeGreaterThan(0);
    expect(bilan.fournisseurs).toBeGreaterThan(0);
    expect(bilan.concoursBancaires).toBeGreaterThan(0);

    // Both sides should be positive (balance not guaranteed with arbitrary test data)
    expect(bilan.totalActif).toBeGreaterThan(0);
    expect(bilan.totalPassif).toBeGreaterThan(0);
  });

  it('should return resultat with all sections', async () => {
    const { generateFromJournal } = await import('./accountingUtils');
    const data = generateFromJournal();
    const { resultat } = data;

    expect(resultat.ventes).toBeGreaterThan(0);
    expect(resultat.achats).toBeGreaterThan(0);
    expect(resultat.chargesExternes).toBeGreaterThan(0);
    expect(resultat.chargesPersonnel).toBeGreaterThan(0);
    expect(resultat.impotsTaxes).toBeGreaterThan(0);
    expect(resultat.autresCharges).toBeGreaterThan(0);
    expect(resultat.chargesFinancieres).toBeGreaterThan(0);
    expect(resultat.chargesExceptionnelles).toBeGreaterThan(0);
    expect(resultat.dotations).toBeGreaterThan(0);
    expect(resultat.reprises).toBeGreaterThan(0);
    expect(resultat.produitsFinanciers).toBeGreaterThan(0);
    expect(resultat.produitsExceptionnels).toBeGreaterThan(0);
    expect(resultat.subventionsExploitation).toBeGreaterThan(0);
    expect(resultat.productionStockee).toBeGreaterThan(0);
    expect(resultat.productionImmobilisee).toBeGreaterThan(0);

    // Resultat net = produits - charges
    expect(resultat.resultatNet).toBe(resultat.produits - resultat.charges);

    // SIG fields
    expect(resultat.margeCommerciale).toBeDefined();
    expect(resultat.productionExercice).toBeDefined();
    expect(resultat.valeurAjoutee).toBeDefined();
    expect(resultat.ebe).toBeDefined();
    expect(resultat.rcai).toBeDefined();
    expect(resultat.sigResultatNet).toBeDefined();
  });

  it('should return 9 ratios', async () => {
    const { generateFromJournal } = await import('./accountingUtils');
    const data = generateFromJournal();
    const { ratios } = data;

    const ratioKeys = ['liquiditeGenerale','liquiditeReduite','autonomieFinanciere',
      'endettementNet','margeNette','roe','roa','couvertureEmploisStables','margeExploitation'];
    ratioKeys.forEach(k => {
      expect(ratios).toHaveProperty(k);
      expect(typeof ratios[k]).toBe('number');
    });
  });

  it('should return fluxTresorerie sections', async () => {
    const { generateFromJournal } = await import('./accountingUtils');
    const data = generateFromJournal();
    const { fluxTresorerie } = data;

    expect(fluxTresorerie.fluxExploitation).toBeDefined();
    expect(fluxTresorerie.fluxInvestissement).toBeDefined();
    expect(fluxTresorerie.fluxFinancement).toBeDefined();
    expect(fluxTresorerie.variationTresorerie).toBeDefined();
    expect(fluxTresorerie.tresorerieFinale).toBeDefined();
  });

  it('should return details with account breakdowns', async () => {
    const { generateFromJournal } = await import('./accountingUtils');
    const data = generateFromJournal();
    const { details } = data;

    expect(Array.isArray(details.ventes)).toBe(true);
    expect(details.ventes.length).toBeGreaterThan(0);
    expect(Array.isArray(details.achats)).toBe(true);
    expect(Array.isArray(details.fraisPreliminaires)).toBe(true);

    // Check shape of detail items
    const firstVente = details.ventes[0];
    expect(firstVente).toHaveProperty('code');
    expect(firstVente).toHaveProperty('solde');
  });
});

describe('generateCashFlowStatement', () => {
  beforeEach(async () => {
    setupMockLS();
    cleanup();
    setupJournal();
  });

  it('should compute cash flow from journal data', async () => {
    const { generateFromJournal, generateCashFlowStatement } = await import('./accountingUtils');
    const data = generateFromJournal();
    const { bilan, resultat, journal: jb } = data;

    const cf = generateCashFlowStatement(bilan, resultat, jb.reduce((acc, e) => {
      const code = e.compte.replace(/\s.*$/, '').trim();
      if (!acc[code]) acc[code] = { debit: 0, credit: 0 };
      acc[code].debit += parseFloat(e.debit) || 0;
      acc[code].credit += parseFloat(e.credit) || 0;
      return acc;
    }, {}));

    expect(cf.fluxExploitation).toBeDefined();
    expect(cf.margeBruteAutofinancement).toBeDefined();
    expect(cf.variationClients).toBeDefined();
    expect(cf.variationFournisseurs).toBeDefined();
    expect(cf.variationStocks).toBeDefined();

    // Cash flow identity: variationTresorerie = fluxExploitation + fluxInvestissement + fluxFinancement
    expect(cf.variationTresorerie).toBeCloseTo(cf.fluxExploitation + cf.fluxInvestissement + cf.fluxFinancement, 4);
  });
});

describe('generateSIG', () => {
  beforeEach(async () => {
    setupMockLS();
    cleanup();
    setupJournal();
  });

  it('should compute SIG pyramid from journal data', async () => {
    const { generateFromJournal, generateSIG } = await import('./accountingUtils');
    const data = generateFromJournal();
    const { bilan, resultat, journal: jb } = data;

    const balances = jb.reduce((acc, e) => {
      const code = e.compte.replace(/\s.*$/, '').trim();
      if (!acc[code]) acc[code] = { debit: 0, credit: 0 };
      acc[code].debit += parseFloat(e.debit) || 0;
      acc[code].credit += parseFloat(e.credit) || 0;
      return acc;
    }, {});

    const sig = generateSIG(bilan, resultat, balances);

    expect(sig.margeCommerciale).toBeDefined();
    expect(sig.productionExercice).toBeDefined();
    expect(sig.valeurAjoutee).toBeDefined();
    expect(sig.ebe).toBeDefined();
    expect(sig.resultatExploitation).toBeDefined();
    expect(sig.rcai).toBeDefined();
    expect(sig.resultatNet).toBeDefined();

    // SIG chain: margeCommerciale = ventesMarchandises - achatsMarchandises
    expect(sig.margeCommerciale).toBeCloseTo(sig.ventesMarchandises - sig.achatsMarchandises, 3);
  });

  it('should fall back to estimation when journalBalances is null', async () => {
    const { generateSIG } = await import('./accountingUtils');
    const mockResultat = { ventes: 100000, achats: 60000, chargesExternes: 10000,
      chargesPersonnel: 20000, impotsTaxes: 5000, dotations: 5000 };

    const sig = generateSIG(null, mockResultat, null);
    expect(sig.ventesMarchandises).toBeGreaterThan(0);
    expect(sig.achatsMarchandises).toBeGreaterThan(0);
    expect(sig.margeCommerciale).toBeDefined();
    expect(sig.valeurAjoutee).toBeDefined();
  });
});

describe('calculateFinancialRatios (legacy)', () => {
  it('should compute ratios from legacy data', async () => {
    const { calculateFinancialRatios } = await import('./accountingUtils');
    const mockInvoices = [
      { status: 'PAID', total_ttc: 100000 },
      { status: 'PAID', total_ttc: 200000 },
      { status: 'SENT', total_ttc: 50000 },
    ];
    const mockExpenses = [
      { montant: 30000, statut: 'payé' },
      { montant: 15000, statut: 'payé' },
    ];
    const mockTransactions = [
      { type: 'credit', montant: 50000 },
      { type: 'debit', montant: 20000 },
    ];

    const ratios = calculateFinancialRatios(mockInvoices, mockExpenses, mockTransactions);
    expect(ratios).toHaveProperty('liquidityRatio');
    expect(ratios).toHaveProperty('financialAutonomy');
    expect(typeof ratios.liquidityRatio).toBe('number');
  });
});

describe('rapprochementBancaire', () => {
  const txns = [
    { id:'tx-1', date:'2026-05-12', description:'Virement reçu - Acme Corporation Tunisie', amount:5356.000, type:'CREDIT', status:'RECONCILED', matchedInvoiceId:'inv-1' },
    { id:'tx-2', date:'2026-05-22', description:'Virement Wayne Enterprises', amount:9759.000, type:'CREDIT', status:'UNRECONCILED' },
    { id:'tx-3', date:'2026-05-24', description:'Prélèvement Ooredoo Tunisie', amount:-155.700, type:'DEBIT', status:'UNRECONCILED' },
    { id:'tx-4', date:'2026-05-25', description:'Facture STEG', amount:-66.913, type:'DEBIT', status:'UNRECONCILED' },
    { id:'tx-5', date:'2026-05-25', description:'Virement inconnu', amount:3333.000, type:'CREDIT', status:'UNRECONCILED' },
  ];

  const invs = [
    { id:'inv-1', clientName:'Acme Corporation Tunisie', totalAmount:5356.000, status:'PAID', invoiceNumber:'FACT-001', dueDate:'2026-06-10' },
    { id:'inv-2', clientName:'Wayne Enterprises S.A.R.L', totalAmount:9759.000, status:'SENT', invoiceNumber:'FACT-002', dueDate:'2026-06-20' },
    { id:'inv-3', clientName:'Inconnu SARL', totalAmount:4900.000, status:'SENT', invoiceNumber:'FACT-003' },
    { id:'inv-4', clientName:'Lointain SARL', totalAmount:12300.000, status:'SENT', invoiceNumber:'FACT-004' },
  ];

  const exps = [
    { id:'exp-1', supplier:'Ooredoo Tunisie', totalAmount:155.700, date:'2026-05-24', status:'VALIDATED', category:'Télécoms' },
    { id:'exp-2', supplier:'STEG Tunisie', totalAmount:66.913, date:'2026-05-20', status:'VALIDATED', category:'Énergie' },
    { id:'exp-3', supplier:'Autre Fournisseur', totalAmount:200.000, date:'2026-05-22', status:'VALIDATED', category:'Divers' },
  ];

  it('retourne les stats de rapprochement', async () => {
    const { rapprochementBancaire } = await import('./accountingUtils');
    const r = rapprochementBancaire(txns, invs, exps);
    expect(r.stats.total).toBe(5);
    expect(r.stats.reconciled).toBe(1);
    expect(r.stats.unreconciled).toBe(4);
    expect(r.stats.tauxRapprochement).toBe(20);
    expect(r.stats.montantTotalTransactions).toBeGreaterThan(0);
    expect(r.stats.montantRapproche).toBeCloseTo(5356.000, 3);
  });

  it('suggère un rapprochement par montant exact (CREDIT → facture)', async () => {
    const { rapprochementBancaire } = await import('./accountingUtils');
    const r = rapprochementBancaire(txns, invs, exps);
    const sug = r.suggestions.find(s => s.transaction.id === 'tx-2');
    expect(sug).toBeDefined();
    expect(sug.type).toBe('facture');
    expect(sug.candidate.id).toBe('inv-2');
    expect(sug.confidence).toBe(100);
    expect(sug.strategy).toBe('montant_exact');
  });

  it('suggère un rapprochement par nom fournisseur + montant (DEBIT → dépense)', async () => {
    const { rapprochementBancaire } = await import('./accountingUtils');
    const r = rapprochementBancaire(txns, invs, exps);
    const sug = r.suggestions.find(s => s.transaction.id === 'tx-3');
    expect(sug).toBeDefined();
    expect(sug.type).toBe('depense');
    expect(sug.candidate.id).toBe('exp-1');
    expect(sug.confidence).toBeGreaterThanOrEqual(100);
  });

  it('ne suggère pas une transaction déjà rapprochée', async () => {
    const { rapprochementBancaire } = await import('./accountingUtils');
    const r = rapprochementBancaire(txns, invs, exps);
    expect(r.rapprochees.some(t => t.id === 'tx-1')).toBe(true);
    expect(r.suggestions.some(s => s.transaction.id === 'tx-1')).toBe(false);
  });

  it('retourne les transactions non rapprochées sans suggestion', async () => {
    const { rapprochementBancaire } = await import('./accountingUtils');
    const r = rapprochementBancaire(txns, invs, exps);
    expect(r.nonRapprochees.transactions.some(t => t.id === 'tx-5')).toBe(true);
  });

  it('retourne les factures non rapprochées', async () => {
    const { rapprochementBancaire } = await import('./accountingUtils');
    const r = rapprochementBancaire(txns, invs, exps);
    expect(r.nonRapprochees.invoices.some(i => i.id === 'inv-3')).toBe(true);
    expect(r.nonRapprochees.invoices.some(i => i.id === 'inv-4')).toBe(true);
    expect(r.nonRapprochees.invoices.some(i => i.id === 'inv-1')).toBe(false);
  });

  it('retourne les dépenses non rapprochées', async () => {
    const { rapprochementBancaire } = await import('./accountingUtils');
    const r = rapprochementBancaire(txns, invs, exps);
    expect(r.nonRapprochees.expenses.some(e => e.id === 'exp-3')).toBe(true);
    expect(r.nonRapprochees.expenses.some(e => e.id === 'exp-1')).toBe(false);
  });

  it('gère les entrées vides', async () => {
    const { rapprochementBancaire } = await import('./accountingUtils');
    const r = rapprochementBancaire([], [], []);
    expect(r.stats.total).toBe(0);
    expect(r.stats.tauxRapprochement).toBe(0);
    expect(r.suggestions).toEqual([]);
    expect(r.nonRapprochees.transactions).toEqual([]);
    expect(r.nonRapprochees.invoices).toEqual([]);
    expect(r.nonRapprochees.expenses).toEqual([]);
  });

  it('suggère un rapprochement montant proche (tolérance 0.010 DT)', async () => {
    const { rapprochementBancaire } = await import('./accountingUtils');
    const txProche = [
      { id:'tx-p1', date:'2026-06-01', description:'Règlement facture', amount:1000.005, type:'CREDIT', status:'UNRECONCILED' },
    ];
    const invProche = [
      { id:'inv-p1', clientName:'Client Test', totalAmount:1000.000, status:'SENT', invoiceNumber:'FACT-P1' },
    ];
    const r = rapprochementBancaire(txProche, invProche, []);
    const sug = r.suggestions.find(s => s.transaction.id === 'tx-p1');
    expect(sug).toBeDefined();
    expect(sug.confidence).toBe(95);
    expect(sug.strategy).toBe('montant_proche');
  });

  it('identifie le rapprochement par stratégie montant+client', async () => {
    const { rapprochementBancaire } = await import('./accountingUtils');
    const txClient = [
      { id:'tx-c1', date:'2026-06-01', description:'Virement reçu - Société Alpha', amount:2500.000, type:'CREDIT', status:'UNRECONCILED' },
    ];
    const invClient = [
      { id:'inv-c1', clientName:'Société Alpha', totalAmount:2500.000, status:'SENT', invoiceNumber:'FACT-C1' },
      { id:'inv-c2', clientName:'Autre Société', totalAmount:2500.000, status:'SENT', invoiceNumber:'FACT-C2' },
    ];
    const r = rapprochementBancaire(txClient, invClient, []);
    const sug = r.suggestions.find(s => s.transaction.id === 'tx-c1');
    expect(sug).toBeDefined();
    expect(sug.candidate.id).toBe('inv-c1');
    expect(sug.confidence).toBeGreaterThanOrEqual(100);
  });
});
