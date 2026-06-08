const today = () => new Date().toISOString().split('T')[0];
const pastDate = (daysAgo) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); return d.toISOString().split('T')[0]; };

const invoices = [
  { invoiceNumber: 'FACT-001', client: 'Société Tunisie Telecom', totalAmount: 15000, status: 'PAID', date: pastDate(45), items: [{ label: 'Prestation maintenance réseau', qty: 1, unitPrice: 15000, vatRate: 19 }], stampDuty: 1 },
  { invoiceNumber: 'FACT-002', client: 'EURL Med Services', totalAmount: 8200, status: 'PAID', date: pastDate(30), items: [{ label: 'Conseil en gestion', qty: 1, unitPrice: 8200, vatRate: 19 }], stampDuty: 1 },
  { invoiceNumber: 'FACT-003', client: 'SARL Atlas Distribution', totalAmount: 12350, status: 'PENDING', date: pastDate(15), items: [{ label: 'Fournitures bureau', qty: 50, unitPrice: 247, vatRate: 19 }], stampDuty: 1 },
  { invoiceNumber: 'FACT-004', client: 'Cabinet Avocats Associés', totalAmount: 5600, status: 'PAID', date: pastDate(60), items: [{ label: 'Audit financier', qty: 1, unitPrice: 5600, vatRate: 19 }], stampDuty: 1 },
  { invoiceNumber: 'FACT-005', client: 'STE Générale de BTP', totalAmount: 28700, status: 'SENT', date: pastDate(5), items: [{ label: 'Étude de chantier', qty: 1, unitPrice: 28700, vatRate: 13 }], stampDuty: 1 },
];

const expenses = [
  { totalAmount: 3200, category: 'Loyer', supplier: 'Agence Immobilière Tunis', date: pastDate(30), vatRate: 19, matriculeFiscal: 'MF1234567A' },
  { totalAmount: 1850, category: 'Électricité', supplier: 'STEG', date: pastDate(25), vatRate: 13, matriculeFiscal: 'MF0987654B' },
  { totalAmount: 420, category: 'Téléphone', supplier: 'Ooredoo Tunisie', date: pastDate(20), vatRate: 19, matriculeFiscal: 'MF5678901C' },
  { totalAmount: 950, category: 'Internet', supplier: 'TopNet', date: pastDate(18), vatRate: 19, matriculeFiscal: 'MF3456789D' },
  { totalAmount: 2100, category: 'Fournitures bureau', supplier: 'BuroPlus Tunis', date: pastDate(12), vatRate: 19, matriculeFiscal: 'MF2345678E' },
  { totalAmount: 1500, category: 'Transport', supplier: 'Transporteurs Réunis', date: pastDate(8), vatRate: 7, matriculeFiscal: 'MF8765432F' },
  { totalAmount: 780, category: 'Assurance', supplier: 'COMAR Assurances', date: pastDate(5), vatRate: 7, matriculeFiscal: 'MF4321098G' },
];

const transactions = [
  { date: pastDate(45), description: 'Virement client FACT-001', amount: 15000, type: 'credit', status: 'RECONCILED' },
  { date: pastDate(30), description: 'Virement client FACT-002', amount: 8200, type: 'credit', status: 'RECONCILED' },
  { date: pastDate(28), description: 'Paiement loyer', amount: 3200, type: 'debit', status: 'RECONCILED' },
  { date: pastDate(25), description: 'Paiement STEG', amount: 1850, type: 'debit', status: 'RECONCILED' },
  { date: pastDate(20), description: 'Paiement Ooredoo', amount: 420, type: 'debit', status: 'RECONCILED' },
  { date: pastDate(5), description: 'Virement client FACT-005 (acompte)', amount: 10000, type: 'credit', status: 'PENDING' },
];

const journalEntries = [
  { compte: '411', libelle: 'Client FACT-001', debit: 15000, credit: 0, date: pastDate(45), numeroPiece: 'PIECE-001' },
  { compte: '701', libelle: 'Vente prestations', debit: 0, credit: 12605, date: pastDate(45), numeroPiece: 'PIECE-001' },
  { compte: '43671', libelle: 'TVA collectée 19%', debit: 0, credit: 2395, date: pastDate(45), numeroPiece: 'PIECE-001' },
  { compte: '532', libelle: 'Banque encaissement FACT-001', debit: 15000, credit: 0, date: pastDate(43), numeroPiece: 'PIECE-002' },
  { compte: '411', libelle: 'Client FACT-001', debit: 0, credit: 15000, date: pastDate(43), numeroPiece: 'PIECE-002' },
  { compte: '411', libelle: 'Client FACT-002', debit: 8200, credit: 0, date: pastDate(30), numeroPiece: 'PIECE-003' },
  { compte: '701', libelle: 'Vente prestations', debit: 0, credit: 6891, date: pastDate(30), numeroPiece: 'PIECE-003' },
  { compte: '43671', libelle: 'TVA collectée 19%', debit: 0, credit: 1309, date: pastDate(30), numeroPiece: 'PIECE-003' },
  { compte: '532', libelle: 'Banque encaissement FACT-002', debit: 8200, credit: 0, date: pastDate(28), numeroPiece: 'PIECE-004' },
  { compte: '411', libelle: 'Client FACT-002', debit: 0, credit: 8200, date: pastDate(28), numeroPiece: 'PIECE-004' },
  { compte: '613', libelle: 'Loyer', debit: 3200, credit: 0, date: pastDate(28), numeroPiece: 'PIECE-005' },
  { compte: '43666', libelle: 'TVA déductible 19%', debit: 608, credit: 0, date: pastDate(28), numeroPiece: 'PIECE-005' },
  { compte: '532', libelle: 'Banque virement loyer', debit: 0, credit: 3808, date: pastDate(28), numeroPiece: 'PIECE-005' },
  { compte: '613', libelle: 'Électricité STEG', debit: 1850, credit: 0, date: pastDate(25), numeroPiece: 'PIECE-006' },
  { compte: '43666', libelle: 'TVA déductible 13%', debit: 240.5, credit: 0, date: pastDate(25), numeroPiece: 'PIECE-006' },
  { compte: '532', libelle: 'Banque virement STEG', debit: 0, credit: 2090.5, date: pastDate(25), numeroPiece: 'PIECE-006' },
  { compte: '613', libelle: 'Téléphone Ooredoo', debit: 420, credit: 0, date: pastDate(20), numeroPiece: 'PIECE-007' },
  { compte: '43666', libelle: 'TVA déductible 19%', debit: 79.8, credit: 0, date: pastDate(20), numeroPiece: 'PIECE-007' },
  { compte: '532', libelle: 'Banque virement Ooredoo', debit: 0, credit: 499.8, date: pastDate(20), numeroPiece: 'PIECE-007' },
  { compte: '411', libelle: 'Client FACT-003', debit: 12350, credit: 0, date: pastDate(15), numeroPiece: 'PIECE-008' },
  { compte: '701', libelle: 'Vente fournitures', debit: 0, credit: 10378, date: pastDate(15), numeroPiece: 'PIECE-008' },
  { compte: '43671', libelle: 'TVA collectée 19%', debit: 0, credit: 1972, date: pastDate(15), numeroPiece: 'PIECE-008' },
];

export function getDemoData() {
  return {
    invoices: invoices.map(inv => ({ ...inv, id: `demo_inv_${Math.random().toString(36).slice(2, 8)}`, createdAt: today() })),
    expenses: expenses.map(exp => ({ ...exp, id: `demo_exp_${Math.random().toString(36).slice(2, 8)}`, createdAt: today() })),
    transactions: transactions.map(tx => ({ ...tx, id: `demo_tx_${Math.random().toString(36).slice(2, 8)}` })),
    journalEntries: journalEntries.map(e => ({ ...e, id: `demo_je_${Math.random().toString(36).slice(2, 8)}` })),
  };
}
