/**
 * Utilitaires de calculs comptables et fiscaux de Penni AI
 */

import { getJournalKey } from './utils/journalKey';

/**
 * Calcule le total des revenus encaissés (factures payées)
 * @param {Array} invoices - Liste des factures
 * @returns {number}
 */
export const calculateTotalRevenues = (invoices = []) => {
  return invoices
    .filter(inv => inv?.status === 'PAID')
    .reduce((sum, inv) => sum + (parseFloat(inv?.totalAmount) || 0), 0);
};

/**
 * Calcule les revenus en attente (factures envoyées/non payées)
 * @param {Array} invoices - Liste des factures
 * @returns {number}
 */
export const calculatePendingRevenues = (invoices = []) => {
  return invoices
    .filter(inv => inv?.status === 'SENT')
    .reduce((sum, inv) => sum + (parseFloat(inv?.totalAmount) || 0), 0);
};

/**
 * Calcule le total des dépenses d'achats validées
 * @param {Array} expenses - Liste des dépenses
 * @returns {number}
 */
export const calculateTotalExpenses = (expenses = []) => {
  return expenses.reduce((sum, exp) => sum + (parseFloat(exp?.totalAmount) || 0), 0);
};

/**
 * Calcule le solde théorique de la trésorerie bancaire
 * @param {number} initialBalance - Solde de départ
 * @param {Array} transactions - Liste des transactions
 * @returns {number}
 */
export const calculateBankBalance = (initialBalance = 32800, transactions = []) => {
  return initialBalance + transactions.reduce((sum, tx) => sum + (parseFloat(tx?.amount) || 0), 0);
};

/**
 * Estime le montant de la provision fiscale (Impôt sur les Sociétés en Tunisie = 25% standard, 15% pour petites entreprises)
 * @param {number} totalRevenues - Total des revenus encaissés
 * @param {number} totalExpenses - Total des charges
 * @returns {number}
 */
export const calculateEstimatedTaxes = (totalRevenues = 0, totalExpenses = 0) => {
  const profit = Math.max(0, totalRevenues - totalExpenses);
  return profit * 0.25; // Taux IS standard en Tunisie (25%)
};

/**
 * Calcule les totaux HT, TVA, Timbre Fiscal et TTC pour une liste de lignes d'articles facturés en Tunisie
 * @param {Array} items - Lignes d'articles
 * @param {boolean} includeStampDuty - Inclure le timbre fiscal de 1.000 DT (standard en Tunisie)
 * @returns {Object} { subtotal, vatAmount, stampDuty, totalAmount }
 */
export const calculateInvoiceTotals = (items = [], includeStampDuty = true) => {
  const subtotal = items.reduce((sum, item) => {
    const qty = parseFloat(item?.quantity) || 0;
    const price = parseFloat(item?.unitPrice) || 0;
    return sum + (qty * price);
  }, 0);

  const vatAmount = items.reduce((sum, item) => {
    const qty = parseFloat(item?.quantity) || 0;
    const price = parseFloat(item?.unitPrice) || 0;
    const vatRate = parseFloat(item?.vatRate) || 0;
    return sum + ((qty * price) * (vatRate / 100));
  }, 0);

  let stampDuty = 0;
  if (includeStampDuty) {
    const amountBeforeStamp = subtotal + vatAmount;
    if (amountBeforeStamp < 50.000) {
      stampDuty = 1.000;
    } else if (amountBeforeStamp <= 100.000) {
      stampDuty = 1.500;
    } else {
      stampDuty = 2.000;
    }
  }

  const totalAmount = subtotal + vatAmount + stampDuty;

  // Arrondi à 3 décimales pour le Dinar Tunisien (TND)
  return {
    subtotal: Math.round(subtotal * 1000) / 1000,
    vatAmount: Math.round(vatAmount * 1000) / 1000,
    stampDuty: stampDuty,
    totalAmount: Math.round(totalAmount * 1000) / 1000
  };
};

/**
 * Formate un nombre en devise locale (avec 3 décimales pour le Dinar Tunisien DT/TND)
 * @param {number} val - Montant
 * @param {string} currency - Code ISO de la devise (TND, EUR, USD, etc.)
 * @returns {string}
 */
export const formatCurrencyHelper = (val, currency = 'TND') => {
  if (currency === 'TND') {
    // Format Dinar Tunisien avec 3 décimales (ex: 1 500,350 DT)
    return new Intl.NumberFormat('fr-TN', { 
      style: 'currency', 
      currency: 'TND', 
      minimumFractionDigits: 3,
      maximumFractionDigits: 3 
    }).format(val);
  }
  if (currency === 'MDT') {
    // Format Millions de Dinars Tunisiens (ex: 1,500 MDT)
    const parts = new Intl.NumberFormat('fr-TN', { 
      minimumFractionDigits: 3,
      maximumFractionDigits: 3 
    }).formatToParts(val);
    return parts.map(p => p.value).join('').trim() + ' MDT';
  }
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(val);
};

/**
 * Génère les données du Bilan (Balance Sheet) avec détail SCE
 *
 * Architecture « Passif maître » :
 *   1. TOTAL PASSIF = Somme(Capitaux Propres) + Somme(Passifs Non Courants) + Somme(Passifs Courants)
 *   2. Banque = TOTAL PASSIF − Somme(tous les autres éléments de l'Actif)
 *   3. TOTAL ACTIFS = TOTAL PASSIF (équilibre automatique, zéro ajustement)
 */
export const generateBalanceSheet = (invoices = [], expenses = [], transactions = [], customData = {}, incomeStatement = null, stockTotalDT = 0) => {
  const totalRevenue = invoices.reduce((sum, inv) => sum + (parseFloat(inv.totalAmount) || 0), 0);
  const pendingRevenue = calculatePendingRevenues(invoices);
  const totalExpenses = calculateTotalExpenses(expenses);
  const bankBalance = calculateBankBalance(0, transactions);

  const is = incomeStatement || generateIncomeStatement(invoices, expenses);
  const netProfit = is.netProfit;
  const estimatedTax = is.tax;

  const R = Math.max(totalRevenue / 1000, 0);
  const E = Math.max(totalExpenses / 1000, 0);
  const PR = Math.max(pendingRevenue / 1000, 0);
  const BB = Math.max(bankBalance / 1000, 0);

  const hasData = totalRevenue > 0 || totalExpenses > 0 || bankBalance !== 0 || stockTotalDT > 0 || Object.keys(customData).length > 0 || (incomeStatement && incomeStatement.netProfit !== 0);
  if (!hasData) {
    const zero = () => 0;
    return {
      assets: {
        nonCurrent: { intangible: 0, intangibleDetail: { devCosts: 0, patents: 0, goodwill: 0 }, tangible: 0, tangibleDetail: { land: 0, buildings: 0, equipment: 0, transport: 0, officeEquip: 0 }, financial: 0, total: 0 },
        current: { stocks: 0, stockDetail: { merchandise: 0, rawMaterials: 0 }, receivables: 0, personnelRec: 0, taxRec: 0, otherRec: 0, cashAndBank: 0, cashRegister: 0, total: 0 },
        total: 0
      },
      liabilities: {
        nonCurrent: { bankLoans: 0, provisions: 0, total: 0 },
        current: { accountsPayable: 0, personnelPayable: 0, taxPayable: 0, vatPayable: 0, otherPayables: 0, bankOverdraft: 0, total: 0 },
        total: 0
      },
      equity: { socialCapital: 0, legalReserve: 0, otherReserves: 0, retainedEarnings: 0, total: 0 },
      totalLiabilitiesAndEquity: 0
    };
  }

  /* --- User-editable values --- */
  const intangibleAssets    = Math.round((customData.immobilisationsIncorporelles ?? Math.min(R * 0.08, 15)) * 1000) / 1000;
  const tangibleAssets      = Math.round((customData.immobilisationsCorporelles ?? Math.min(R * 0.25, 50)) * 1000) / 1000;
  const socialCapital       = Math.round((customData.capitalSocial ?? Math.min(Math.max(R * 0.20, 5), 30)) * 1000) / 1000;
  const bankLoans           = Math.round((customData.empruntsBancaires ?? Math.min(R * 0.15, 25)) * 1000) / 1000;
  const stocksAmount        = Math.round((customData.stocks ?? (stockTotalDT / 1000 || E * 0.10)) * 1000) / 1000;

  /* --- Sub-items --- */
  const devCosts      = Math.round(intangibleAssets * 0.3 * 1000) / 1000;
  const patents       = Math.round(intangibleAssets * 0.4 * 1000) / 1000;
  const goodwill      = Math.round(intangibleAssets * 0.3 * 1000) / 1000;
  const land          = Math.round(tangibleAssets * 0.2 * 1000) / 1000;
  const buildings     = Math.round(tangibleAssets * 0.3 * 1000) / 1000;
  const equipment     = Math.round(tangibleAssets * 0.3 * 1000) / 1000;
  const transport     = Math.round(tangibleAssets * 0.1 * 1000) / 1000;
  const officeEquip   = Math.round(tangibleAssets * 0.1 * 1000) / 1000;
  const financialAssets = Math.round(R * 0.03 * 1000) / 1000;
  const merchandise   = Math.round(stocksAmount * 0.5 * 1000) / 1000;
  const rawMaterials  = Math.round(stocksAmount * 0.5 * 1000) / 1000;
  const receivables   = Math.round(PR * 1000) / 1000;
  const personnelRec  = Math.round(E * 0.03 * 1000) / 1000;
  const taxRec        = Math.round(R * 0.02 * 1000) / 1000;
  const otherRec      = Math.round(R * 0.01 * 1000) / 1000;

  /* Caisse = estimation initiale (petite fraction des flux, figée une fois pour toutes) */
  const initialCashEstimate = Math.round(BB * 1000) / 1000;
  const cashRegister = Math.round(Math.max(initialCashEstimate * 0.05, 0.050) * 1000) / 1000;

  /* --- STEP 1 : Calcul du TOTAL PASSIF (valeur maître) --- */
  const legalReserve      = Math.round(Math.max(netProfit * 0.05, 0) * 1000) / 1000;
  const otherReserves     = Math.round(Math.max(netProfit * 0.03, 0) * 1000) / 1000;
  const retainedEarnings  = Math.round(netProfit * 1000) / 1000;
  /* Éviter des capitaux propres négatifs qui faussent les ratios */
  const equityRaw         = socialCapital + legalReserve + otherReserves + retainedEarnings;
  const equity            = Math.round(Math.max(equityRaw, 1) * 1000) / 1000;

  const provisions        = Math.round(R * 0.02 * 1000) / 1000;
  const nonCurrentLiabilities = Math.round((bankLoans + provisions) * 1000) / 1000;

  const accountsPayable   = Math.round(E * 0.40 * 1000) / 1000;
  const personnelPayable  = Math.round(E * 0.08 * 1000) / 1000;
  const taxPayable        = estimatedTax;
  const vatPayable        = Math.round(R * 0.06 * 1000) / 1000;
  const otherPayables     = Math.round(Math.max(E * 0.05, 0.200) * 1000) / 1000;
  let bankOverdraft     = 0;
  let currentLiabilities = Math.round((accountsPayable + personnelPayable + taxPayable + vatPayable + otherPayables + bankOverdraft) * 1000) / 1000;
  let totalLiabilities  = Math.round((currentLiabilities + nonCurrentLiabilities) * 1000) / 1000;
  let totalPassif       = Math.round((equity + totalLiabilities) * 1000) / 1000;

  /* --- STEP 2 : Somme de l'Actif hors Banque --- */
  const nonCurrentAssets  = Math.round((intangibleAssets + tangibleAssets + financialAssets) * 1000) / 1000;
  const autresActifsCourants = Math.round((stocksAmount + receivables + personnelRec + taxRec + otherRec + cashRegister) * 1000) / 1000;
  const sommeActifSaufBanque = Math.round((nonCurrentAssets + autresActifsCourants) * 1000) / 1000;

  /* --- STEP 3 : Banque = TOTAL PASSIF − Σ(autres Actifs) --- */
  let cashAndBank = Math.round((totalPassif - sommeActifSaufBanque) * 1000) / 1000;
  if (cashAndBank < 0) {
    /* Si trésorerie négative, on la transfère en découvert bancaire (passif courant) */
    bankOverdraft = Math.abs(cashAndBank);
    cashAndBank = 0;
    currentLiabilities = Math.round((accountsPayable + personnelPayable + taxPayable + vatPayable + otherPayables + bankOverdraft) * 1000) / 1000;
    totalLiabilities = Math.round((currentLiabilities + nonCurrentLiabilities) * 1000) / 1000;
    totalPassif = Math.round((equity + totalLiabilities) * 1000) / 1000;
  }

  /* --- STEP 4 : Totaux Actif (toujours = totalPassif) --- */
  const currentAssets = Math.round((autresActifsCourants + cashAndBank) * 1000) / 1000;
  const totalAssets   = Math.round((nonCurrentAssets + currentAssets) * 1000) / 1000;

  return {
    assets: {
      nonCurrent: {
        intangible: intangibleAssets,
        intangibleDetail: { devCosts, patents, goodwill },
        tangible: tangibleAssets,
        tangibleDetail: { land, buildings, equipment, transport, officeEquip },
        financial: financialAssets,
        total: nonCurrentAssets
      },
      current: {
        stocks: stocksAmount,
        stockDetail: { merchandise, rawMaterials },
        receivables,
        personnelRec,
        taxRec,
        otherRec,
        cashAndBank,
        cashRegister,
        total: currentAssets
      },
      total: totalAssets
    },
    liabilities: {
      nonCurrent: {
        bankLoans,
        provisions,
        total: nonCurrentLiabilities
      },
      current: {
        accountsPayable,
        personnelPayable,
        taxPayable,
        vatPayable,
        otherPayables,
        bankOverdraft,
        total: currentLiabilities
      },
      total: totalLiabilities
    },
    equity: {
      socialCapital,
      legalReserve,
      otherReserves,
      retainedEarnings,
      total: equity
    },
    totalLiabilitiesAndEquity: totalPassif
  };
};

/**
 * Génère les données de l'État de Résultat (Income Statement) SCE
 */
export const generateIncomeStatement = (invoices = [], expenses = []) => {
  const totalRevenue = invoices.reduce((sum, inv) => sum + (parseFloat(inv.totalAmount) || 0), 0);
  const totalExpenses = expenses.reduce((sum, exp) => sum + (parseFloat(exp.totalAmount) || 0), 0);
  /* Convert to MDT */
  const R = Math.max(totalRevenue / 1000, 0);
  const E = Math.max(totalExpenses / 1000, 0);

  /* --- Produits d'exploitation --- */
  const productSales      = Math.round(R * 0.55 * 1000) / 1000;
  const serviceRevenue    = Math.round(R * 0.40 * 1000) / 1000;
  const otherRevenue      = Math.round(R * 0.05 * 1000) / 1000;
  const totalOpRevenue    = Math.round((productSales + serviceRevenue + otherRevenue) * 1000) / 1000;

  /* --- Charges d'exploitation --- */
  const purchaseGoods     = Math.round(E * 0.30 * 1000) / 1000;
  const purchaseRaw       = Math.round(E * 0.12 * 1000) / 1000;
  const otherPurchases    = Math.round(E * 0.15 * 1000) / 1000;
  const personnelCosts    = Math.round(E * 0.30 * 1000) / 1000;
  const depreciation      = Math.round(E * 0.05 * 1000) / 1000;
  const otherOpCharges    = Math.round(E * 0.08 * 1000) / 1000;
  const totalOpExpenses   = Math.round((purchaseGoods + purchaseRaw + otherPurchases + personnelCosts + depreciation + otherOpCharges) * 1000) / 1000;

  const operatingProfit   = totalOpRevenue - totalOpExpenses;

  /* --- Résultat financier --- */
  const financialRevenue  = 0;
  const financialCosts    = Math.round(E * 0.01 * 1000) / 1000;
  const financialResult   = financialRevenue - financialCosts;

  const ordinaryProfit    = operatingProfit + financialResult;
  const taxAmount         = Math.round(calculateEstimatedTaxes(ordinaryProfit > 0 ? ordinaryProfit : 0) * 1000) / 1000;
  const netProfit         = Math.round((ordinaryProfit - taxAmount) * 1000) / 1000;

  return {
    /* Operating revenue detail */
    productSales,
    serviceRevenue,
    otherRevenue,
    revenue: totalOpRevenue,
    /* Operating expense detail */
    purchaseGoods,
    purchaseRaw,
    otherPurchases,
    personnelCosts,
    depreciation,
    otherOpCharges,
    operatingExpenses: totalOpExpenses,
    operatingProfit,
    /* Financial */
    financialRevenue,
    financialCosts,
    financialResult,
    ordinaryProfit,
    tax: taxAmount,
    netProfit
  };
};

/**
 * Calcule 8 ratios financiers clés
 */
export const calculateFinancialRatios = (invoices = [], expenses = [], transactions = []) => {
  const is = generateIncomeStatement(invoices, expenses);
  const bs = generateBalanceSheet(invoices, expenses, transactions, {}, is);

  const currentAssets = bs.assets.current.total;
  const currentLiabilities = bs.liabilities.current.total;
  const totalAssets = bs.assets.total;
  const equity = bs.equity.total;
  const totalLiabilities = bs.liabilities.total;
  const netProfit = is.netProfit;
  const revenue = is.revenue;
  const operatingProfit = is.operatingProfit;
  const operatingExpenses = is.operatingExpenses;
  const stocks = bs.assets.current.stocks || 0;

  const liquidityRatio = currentLiabilities > 0 ? Math.round((currentAssets / currentLiabilities) * 100) / 100 : 0;
  const quickRatio = currentLiabilities > 0 ? Math.round(((currentAssets - stocks) / currentLiabilities) * 100) / 100 : 0;
  const debtToEquity = equity > 0 ? Math.round((totalLiabilities / equity) * 100) / 100 : 0;
  const roe = equity > 0 ? Math.round((netProfit / equity) * 10000) / 100 : 0;
  const roa = totalAssets > 0 ? Math.round((netProfit / totalAssets) * 10000) / 100 : 0;
  const netMargin = revenue > 0 ? Math.round((netProfit / revenue) * 10000) / 100 : 0;
  const grossMargin = revenue > 0 ? Math.round(((revenue - (is.purchaseGoods + is.purchaseRaw + is.otherPurchases)) / revenue) * 10000) / 100 : 0;
  const financialAutonomy = totalAssets > 0 ? Math.round((equity / totalAssets) * 10000) / 100 : 0;
  const interestCoverage = is.financialCosts > 0 ? Math.round((operatingProfit / is.financialCosts) * 100) / 100 : 0;

  return {
    liquidityRatio,
    quickRatio,
    debtToEquity,
    roe,
    roa,
    netMargin,
    grossMargin,
    financialAutonomy,
    interestCoverage
  };
};

/**
 * Retourne toutes les données financières structurées pour export
 */
export const getFinancialExportData = (invoices = [], expenses = [], transactions = [], companyDetails = {}, customData = {}, stockTotalDT = 0) => {
  const incomeStatement = generateIncomeStatement(invoices, expenses);
  const balanceSheet = generateBalanceSheet(invoices, expenses, transactions, customData, incomeStatement, stockTotalDT);
  const ratios = calculateFinancialRatios(invoices, expenses, transactions);

  return {
    company: {
      name: companyDetails.name || 'N/A',
      mf: companyDetails.vatNumber || 'N/A',
      address: companyDetails.address || 'N/A',
      currency: companyDetails.currency || 'TND'
    },
    balanceSheet,
    incomeStatement,
    ratios,
    generatedAt: new Date().toISOString()
  };
};

/**
 * Génère des factures/dépenses/transactions fictives qui matchent l'État de Résultat.
 * Les montants sont en DT (bruts) — l'État de Résultat divise par 1000 pour les MDT.
 */
export const generateSimulatedData = () => {
  const incomeStatement = generateIncomeStatement([], []);
  const is = incomeStatement;
  /* Target raw amounts (DT) — use defaults when no real data */
  const targetRevenue = (is.revenue * 1000) || 300000;
  const targetExpenses = (is.operatingExpenses * 1000) || 200000;

  const invoices = [];
  let invSum = 0;
  const invCount = 12;
  for (let i = 0; i < invCount; i++) {
    const amount = i < invCount - 1
      ? Math.round((targetRevenue / invCount) * (0.8 + Math.random() * 0.4))
      : Math.round(targetRevenue - invSum);
    invSum += amount;
    const month = String(i + 1).padStart(2, '0');
    invoices.push({
      id: `SIM-INV-${String(i + 1).padStart(3, '0')}`,
      invoiceNumber: `FAC-${2026}-${String(i + 1).padStart(4, '0')}`,
      clientName: `Client ${String.fromCharCode(65 + (i % 26))}`,
      clientVat: `1234567${String(i + 1).padStart(3, '0')}/${['A','M','B'][i % 3]}`,
      issueDate: `2026-${month}-15`,
      dueDate: `2026-${month}-${28 + (i % 3)}`,
      totalHT: Math.round(amount / 1.19),
      tvaAmount: Math.round(amount - amount / 1.19),
      totalAmount: amount,
      status: i % 3 === 0 ? 'payée' : (i % 3 === 1 ? 'impayée' : 'en_attente'),
      category: i % 2 === 0 ? 'vente_marchandises' : 'prestation_service'
    });
  }

  const expenses = [];
  let expSum = 0;
  const expCount = 24;
  const expCategories = [
    { cat: 'achat_marchandises', pct: 0.30 },
    { cat: 'achat_mp', pct: 0.12 },
    { cat: 'charge_externe', pct: 0.15 },
    { cat: 'personnel', pct: 0.30 },
    { cat: 'amortissement', pct: 0.05 },
    { cat: 'charge_financiere', pct: 0.01 },
    { cat: 'autre_charge', pct: 0.07 },
  ];
  const expByCat = {};
  for (const c of expCategories) {
    expByCat[c.cat] = Math.round(targetExpenses * c.pct);
  }
  for (let i = 0; i < expCount; i++) {
    const catIdx = i % expCategories.length;
    const cat = expCategories[catIdx];
    const remaining = expByCat[cat.cat] || 0;
    const perExp = Math.max(1, Math.round(remaining / (Math.ceil((expCount - i) / expCategories.length))));
    const amount = Math.min(remaining, perExp);
    expByCat[cat.cat] = remaining - amount;
    expSum += amount;
    const month = String((i % 12) + 1).padStart(2, '0');
    expenses.push({
      id: `SIM-EXP-${String(i + 1).padStart(3, '0')}`,
      description: `${cat.cat.replace('_', ' ')} — ${['Fournisseur A','Fournisseur B','Freelance X','SNT','Banque','Locaux'][catIdx % 6]}`,
      totalAmount: amount,
      date: `2026-${month}-${10 + (i % 15)}`,
      category: cat.cat,
      vatRate: cat.cat === 'personnel' ? 0 : 19,
      supplier: `Fournisseur ${String.fromCharCode(65 + (catIdx % 6))}`
    });
  }

  const transactions = [];
  for (let i = 0; i < 12; i++) {
    const month = String(i + 1).padStart(2, '0');
    transactions.push({
      id: `SIM-TRX-${String(i + 1).padStart(3, '0')}`,
      date: `2026-${month}-20`,
      description: `Virement client — ${['Vente','Prestation','Règlement'][i % 3]} ${i + 1}`,
      amount: Math.round(invoices[i]?.totalAmount * 0.7 || 1000),
      type: 'crédit',
      category: 'vente'
    });
    transactions.push({
      id: `SIM-TRX-${String(i + 13).padStart(3, '0')}`,
      date: `2026-${month}-25`,
      description: `Paiement fournisseur — ${['Achats','Charges','Loyer'][i % 3]}`,
      amount: Math.round((expenses[i * 2]?.totalAmount || 500) * 0.9),
      type: 'débit',
      category: 'achat'
    });
  }

  return { invoices, expenses, transactions, incomeStatement };
};

// ─────────────────────────────────────────────
// ─────────────────────────────────────────────

const JOURNAL_KEY = () => getJournalKey();

function loadJournal() {
  try {
    const raw = localStorage.getItem(JOURNAL_KEY());
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/**
 * Agrège les soldes des comptes depuis le journal réel.
 * @returns {{ bilan: Object, resultat: Object }}
 */
export function generateFromJournal() {
  const journal = loadJournal();
  if (!journal.length) return null;

  const balances = {};
  for (const e of journal) {
    const compte = (e.compte || '').replace(/\s.*$/, '').trim();
    const debit = parseFloat(e.debit) || 0;
    const credit = parseFloat(e.credit) || 0;
    if (!compte) continue;
    if (!balances[compte]) balances[compte] = { debit: 0, credit: 0 };
    balances[compte].debit += debit;
    balances[compte].credit += credit;
  }

  const solde = (c) => parseFloat(((balances[c]?.debit || 0) - (balances[c]?.credit || 0)).toFixed(3));
  const soldeDetails = (filter) => Object.keys(balances).filter(filter).map(k => ({ code: k, solde: solde(k) })).filter(d => Math.abs(d.solde) > 0.001);

  // BILAN
  const cl = (p) => Object.keys(balances).filter(k => k.startsWith(p)).reduce((s, k) => s + solde(k), 0);

  // Actifs non courants — valeur brute (SCT class 2 sauf 28,29)
  const fraisPreliminairesBrutes         = Math.max(cl('20'), 0) / 1000;
  const immobilisationsIncorporellesBrutes = Math.max(cl('21'), 0) / 1000;
  const immobilisationsCorporellesBrutes  = Math.max(cl('22') + cl('23') + cl('24') + cl('25') + cl('26'), 0) / 1000;
  const immobilisationsFinancieresBrutes  = Math.max(cl('27'), 0) / 1000;
  // Amortissements et provisions (contreparties d'actif, solde créditeur → valeur positive à déduire)
  const amortissementsDeduction          = Math.max(-cl('28'), 0) / 1000;   // 28 = amortissements cumulés
  const provisionsActifNCDeduction       = Math.max(-cl('29'), 0) / 1000;   // 29 = provisions dépréciation immobilisations

  // Actifs courants — valeur brute
  const stocksBrutes                     = Math.max(cl('30') + cl('31') + cl('32') + cl('33') + cl('34') + cl('35') + cl('37') + cl('38'), 0) / 1000;
  const provisionsStocksDeduction        = Math.max(-cl('39'), 0) / 1000;   // 39 = provisions dépréciation stocks

  // Tiers — on sépare par solde
  const fournisseurs    = Math.max(-cl('40'), 0) / 1000;
  const clientsBrutes   = Math.max(cl('41'), 0) / 1000;
  const provisionsClientsDeduction = Math.max(-cl('491'), 0) / 1000;  // 491 = provisions clients
  const clients         = clientsBrutes - provisionsClientsDeduction;
  const etatDebit       = Math.max(cl('43'), 0) / 1000;
  const etatCredit      = Math.max(-cl('43'), 0) / 1000;
  const personnelDebit  = Math.max(cl('45'), 0) / 1000;   // 45 = avances (débit)
  const personnelCredit = Math.max(-cl('42'), 0) / 1000;  // 42 = rémunérations dues (crédit)
  const autresCréances  = Math.max(cl('409') + cl('47') - cl('472'), 0) / 1000;  // exclut 472 (PCA)
  const autresDettes    = Math.max(-cl('44') - cl('46') - cl('48') - cl('49'), 0) / 1000;

  const tresorerieBrute   = Math.max(cl('5') - cl('52'), 0) / 1000;
  const provisionsTresorerieDeduction = Math.max(-cl('59'), 0) / 1000;  // 59 = provisions trésorerie
  const tresorerieActif   = tresorerieBrute - provisionsTresorerieDeduction;
  const concoursBancaires = Math.max(-cl('52'), 0) / 1000;

  // Capitaux propres (SCT class 1) — credit-normal accounts: use -cl() to get positive values
  const capitalSocial        = Math.max(-cl('10'), 0) / 1000;  // 10 = capital
  const reserves             = Math.max(-cl('11'), 0) / 1000;  // 11 = primes et réserves
  const resultatsReportes    = Math.max(-cl('12'), 0) / 1000;  // 12 = report à nouveau
  const resultatExercice     = Math.max(-cl('13'), 0) / 1000;  // 13 = résultat (crédit = profit)
  const autresCapitauxPropres = Math.max(-cl('14'), 0) / 1000; // 14 = subventions, réserves réglementées
  const emprunts             = Math.max(-cl('16') - cl('17'), 0) / 1000;  // 16,17 = dettes financières (crédit)
  const provisions           = Math.max(-cl('15'), 0) / 1000;  // 15 = provisions (crédit)
  const autresPassifsNC      = Math.max(-cl('18'), 0) / 1000;  // 18 = autres passifs non courants

  const ancBrut = fraisPreliminairesBrutes + immobilisationsIncorporellesBrutes + immobilisationsCorporellesBrutes + immobilisationsFinancieresBrutes;
  const actifNC  = ancBrut - amortissementsDeduction - provisionsActifNCDeduction;
  const stocks   = stocksBrutes - provisionsStocksDeduction;
  const actifC   = stocks + clients + etatDebit + personnelDebit + autresCréances + tresorerieActif;
  const totalActif = actifNC + actifC;

  // If account 13 has no closing entries, compute resultat from income/expense accounts
  const charges  = Object.keys(balances).filter(k => k.startsWith('6')).reduce((s, k) => s + balances[k].debit, 0) / 1000;
  const produits = Object.keys(balances).filter(k => k.startsWith('7')).reduce((s, k) => s + balances[k].credit, 0) / 1000;
  const netComputed = produits - charges;
  const finalResultat = resultatExercice > 0.001 ? resultatExercice : Math.max(netComputed, 0);

  const capPropres   = capitalSocial + reserves + resultatsReportes + finalResultat + autresCapitauxPropres;
  const passifNC     = emprunts + provisions + autresPassifsNC;
  const passifC      = fournisseurs + etatCredit + personnelCredit + autresDettes + concoursBancaires;
  const totalPassif  = capPropres + passifNC + passifC;

  const achats = Object.keys(balances).filter(k => k.startsWith('60')).reduce((s, k) => s + balances[k].debit, 0) / 1000;
  // Sous-comptes achats pour SIG
  const achatsMarchandises = Object.keys(balances).filter(k => k.startsWith('601')).reduce((s, k) => s + balances[k].debit, 0) / 1000;
  const achatsMP = Object.keys(balances).filter(k => k.startsWith('602')).reduce((s, k) => s + balances[k].debit, 0) / 1000;
  const autresAchatsSIG = Object.keys(balances).filter(k => k.startsWith('60') && !k.startsWith('601') && !k.startsWith('602')).reduce((s, k) => s + balances[k].debit, 0) / 1000;

  const chargesExternes = Object.keys(balances).filter(k => k.startsWith('61')).reduce((s, k) => s + balances[k].debit, 0) / 1000;
  const chargesPersonnel = Object.keys(balances).filter(k => k.startsWith('62') || k.startsWith('64')).reduce((s, k) => s + balances[k].debit, 0) / 1000;
  const impotsTaxes = Object.keys(balances).filter(k => k.startsWith('63') || k.startsWith('6654')).reduce((s, k) => s + balances[k].debit, 0) / 1000;
  const autresCharges = Object.keys(balances).filter(k => k.startsWith('65')).reduce((s, k) => s + balances[k].debit, 0) / 1000;
  const chargesFinancieres = Object.keys(balances).filter(k => k.startsWith('66') && !k.startsWith('6654')).reduce((s, k) => s + balances[k].debit, 0) / 1000;
  const chargesExceptionnelles = Object.keys(balances).filter(k => k.startsWith('67')).reduce((s, k) => s + balances[k].debit, 0) / 1000;
  const dotations = Object.keys(balances).filter(k => k.startsWith('68')).reduce((s, k) => s + balances[k].debit, 0) / 1000;

  const ventes = Object.keys(balances).filter(k => k.startsWith('70')).reduce((s, k) => s + balances[k].credit, 0) / 1000;
  const ventesMarchandises = Object.keys(balances).filter(k => k.startsWith('70') && !k.startsWith('706')).reduce((s, k) => s + balances[k].credit, 0) / 1000;
  const ventesPrestations = Object.keys(balances).filter(k => k.startsWith('706')).reduce((s, k) => s + balances[k].credit, 0) / 1000;
  const productionStockee = Object.keys(balances).filter(k => k.startsWith('71')).reduce((s, k) => s + balances[k].credit, 0) / 1000;
  const productionImmobilisee = Object.keys(balances).filter(k => k.startsWith('72')).reduce((s, k) => s + balances[k].credit, 0) / 1000;
  const subventionsExploitation = Object.keys(balances).filter(k => k.startsWith('74')).reduce((s, k) => s + balances[k].credit, 0) / 1000;
  const produitsFinanciers = Object.keys(balances).filter(k => k.startsWith('76')).reduce((s, k) => s + balances[k].credit, 0) / 1000;
  const produitsExceptionnels = Object.keys(balances).filter(k => k.startsWith('77')).reduce((s, k) => s + balances[k].credit, 0) / 1000;
  const reprises = Object.keys(balances).filter(k => k.startsWith('78')).reduce((s, k) => s + balances[k].credit, 0) / 1000;  // 78 = reprises

  // autres produits = tout le reste de la classe 7 non détaillé ci-dessus (75, etc.)
  const autresProduits = (produits - ventes - productionStockee - productionImmobilisee - subventionsExploitation - produitsFinanciers - produitsExceptionnels - reprises);

  const totalChargesExploitation = achats + chargesExternes + chargesPersonnel + impotsTaxes + autresCharges + dotations;
  const totalProduitsExploitation = ventes + productionStockee + productionImmobilisee + subventionsExploitation + autresProduits;

  const resultatExploitation = totalProduitsExploitation - totalChargesExploitation;
  const resultatFinancier = produitsFinanciers - chargesFinancieres;
  const resultatExceptionnel = produitsExceptionnels - chargesExceptionnelles;
  const resultatNet = finalResultat;

  // SIG computation
  const margeCommerciale = ventesMarchandises - achatsMarchandises;
  const productionExercice = ventes + productionStockee + productionImmobilisee;
  const valeurAjoutee = margeCommerciale + productionExercice - chargesExternes - achatsMP - autresAchatsSIG;
  const ebe = valeurAjoutee - impotsTaxes - chargesPersonnel;
  const sigResultatExploitation = ebe + reprises - dotations;
  const rcai = sigResultatExploitation + resultatFinancier;
  const sigResultatNet = rcai + resultatExceptionnel;

  // Ratios financiers
  const liquiditeGenerale = passifC > 0 ? Math.round((actifC / passifC) * 100) / 100 : 0;
  const liquiditeReduite = passifC > 0 ? Math.round(((actifC - stocks - provisionsStocksDeduction) / passifC) * 100) / 100 : 0;
  const autonomieFinanciere = totalPassif > 0 ? Math.round((capPropres / totalPassif) * 10000) / 100 : 0;
  const endettementNet = capPropres > 0 ? Math.round(((emprunts + concoursBancaires + autresPassifsNC) / capPropres) * 100) / 100 : 0;
  const margeNette = totalProduitsExploitation > 0 ? Math.round((sigResultatNet / totalProduitsExploitation) * 10000) / 100 : 0;
  const roe = capPropres > 0 ? Math.round((sigResultatNet / capPropres) * 10000) / 100 : 0;
  const roa = totalActif > 0 ? Math.round((sigResultatNet / totalActif) * 10000) / 100 : 0;
  const couvertureEmploisStables = actifNC > 0 ? Math.round(((capPropres + passifNC) / actifNC) * 100) / 100 : 0;
  const margeExploitation = totalProduitsExploitation > 0 ? Math.round((sigResultatExploitation / totalProduitsExploitation) * 10000) / 100 : 0;

  const fluxTresorerie = generateCashFlowStatement(
    { actifC, actifNC, stocks, stocksBrutes, clients, fournisseurs, etatDebit, etatCredit, personnelCredit, capPropres, passifNC, passifC },
    { sigResultatNet: sigResultatNet, resultatNet, dotations, reprises },
    balances
  );

  return {
    bilan: {
      actifNC, actifC, totalActif,
      fraisPreliminaires: fraisPreliminairesBrutes,
      immobilisationsIncorporelles: immobilisationsIncorporellesBrutes,
      immobilisationsCorporelles: immobilisationsCorporellesBrutes,
      immobilisationsFinancieres: immobilisationsFinancieresBrutes,
      amortissementsDeduction, provisionsActifNCDeduction,
      stocks, stocksBrutes, provisionsStocksDeduction,
      clients, clientsBrutes, provisionsClientsDeduction,
      etatDebit, personnelDebit, autresCréances,
      tresorerieActif, tresorerieBrute, provisionsTresorerieDeduction,
      capPropres, passifNC, passifC, totalPassif,
      capitalSocial, reserves, resultatsReportes, resultatExercice: finalResultat, autresCapitauxPropres,
      emprunts, provisions, autresPassifsNC,
      fournisseurs, etatCredit, personnelCredit, autresDettes, concoursBancaires,
    },
    resultat: {
      produits, charges, resultatNet: finalResultat,
      ventes, ventesMarchandises, ventesPrestations,
      productionStockee, productionImmobilisee, subventionsExploitation,
      autresProduits, produitsFinanciers, produitsExceptionnels, reprises,
      achats, achatsMarchandises, achatsMP, autresAchatsSIG,
      chargesExternes, chargesPersonnel, impotsTaxes,
      autresCharges, chargesFinancieres, chargesExceptionnelles, dotations,
      resultatExploitation, resultatFinancier, resultatExceptionnel,
      totalProduitsExploitation, totalChargesExploitation,
      // SIG
      margeCommerciale, productionExercice, valeurAjoutee, ebe,
      rcai, sigResultatNet,
    },
    ratios: {
      liquiditeGenerale, liquiditeReduite, autonomieFinanciere, endettementNet,
      margeNette, roe, roa, couvertureEmploisStables, margeExploitation,
      bfr: (stocks || 0) + (clients || 0) - (fournisseurs || 0),
      tresorerieNette: (tresorerieActif || 0) - (concoursBancaires || 0),
      poidsChargesFinancieres: (ebe && ebe > 0) ? Math.round((chargesFinancieres / ebe) * 1000) / 1000 : 0,
    },
    fluxTresorerie,
    details: {
      fraisPreliminaires: soldeDetails(k => k.startsWith('20')),
      immobilisationsIncorporelles: soldeDetails(k => k.startsWith('21')),
      immobilisationsCorporelles: soldeDetails(k => k.startsWith('22') || k.startsWith('23') || k.startsWith('24') || k.startsWith('25') || k.startsWith('26')),
      immobilisationsFinancieres: soldeDetails(k => k.startsWith('27')),
      amortissementsDeduction: soldeDetails(k => k.startsWith('28')),
      provisionsActifNCDeduction: soldeDetails(k => k.startsWith('29')),
      stocksBrutes: soldeDetails(k => (k.startsWith('3') && !k.startsWith('39'))),
      provisionsStocksDeduction: soldeDetails(k => k.startsWith('39')),
      clientsBrutes: soldeDetails(k => k.startsWith('41')),
      provisionsClientsDeduction: soldeDetails(k => k.startsWith('491')),
      fournisseurs: soldeDetails(k => k.startsWith('40')),
      etatDebit: soldeDetails(k => k.startsWith('43') && solde(k) > 0),
      etatCredit: soldeDetails(k => k.startsWith('43') && solde(k) < 0),
      personnelDebit: soldeDetails(k => k.startsWith('45')),
      personnelCredit: soldeDetails(k => k.startsWith('42')),
      autresCréances: soldeDetails(k => (k.startsWith('409') || k.startsWith('47')) && !k.startsWith('472')),
      autresDettes: soldeDetails(k => k.startsWith('44') || k.startsWith('46') || k.startsWith('48') || k.startsWith('49')),
      tresorerieBrute: soldeDetails(k => k.startsWith('5') && !k.startsWith('52') && !k.startsWith('59')),
      provisionsTresorerieDeduction: soldeDetails(k => k.startsWith('59')),
      concoursBancaires: soldeDetails(k => k.startsWith('52')),
      capitalSocial: soldeDetails(k => k.startsWith('10')),
      reserves: soldeDetails(k => k.startsWith('11')),
      resultatsReportes: soldeDetails(k => k.startsWith('12')),
      autresCapitauxPropres: soldeDetails(k => k.startsWith('14')),
      emprunts: soldeDetails(k => k.startsWith('16') || k.startsWith('17')),
      provisions: soldeDetails(k => k.startsWith('15')),
      autresPassifsNC: soldeDetails(k => k.startsWith('18')),
      ventes: soldeDetails(k => k.startsWith('70')),
      productionStockee: soldeDetails(k => k.startsWith('71')),
      productionImmobilisee: soldeDetails(k => k.startsWith('72')),
      subventionsExploitation: soldeDetails(k => k.startsWith('74')),
      produitsFinanciers: soldeDetails(k => k.startsWith('76')),
      produitsExceptionnels: soldeDetails(k => k.startsWith('77')),
      achats: soldeDetails(k => k.startsWith('60')),
      chargesExternes: soldeDetails(k => k.startsWith('61')),
      chargesPersonnel: soldeDetails(k => k.startsWith('62') || k.startsWith('64')),
      impotsTaxes: soldeDetails(k => k.startsWith('63') || k.startsWith('6654')),
      autresCharges: soldeDetails(k => k.startsWith('65')),
      chargesFinancieres: soldeDetails(k => k.startsWith('66') && !k.startsWith('6654')),
      chargesExceptionnelles: soldeDetails(k => k.startsWith('67')),
      dotations: soldeDetails(k => k.startsWith('68')),
      reprises: soldeDetails(k => k.startsWith('78')),
      variationClients: soldeDetails(k => k.startsWith('41')),
      variationFournisseurs: soldeDetails(k => k.startsWith('40')),
      variationEtat: soldeDetails(k => k.startsWith('43')),
      variationPersonnel: soldeDetails(k => k.startsWith('42')),
      variationStocks: soldeDetails(k => (k.startsWith('3') && !k.startsWith('39'))),
      acquisitionsImmobilisations: soldeDetails(k => (k.startsWith('20') || k.startsWith('21') || k.startsWith('22') || k.startsWith('23') || k.startsWith('24') || k.startsWith('25') || k.startsWith('26') || k.startsWith('27'))),
      cessionsImmobilisations: soldeDetails(k => (k.startsWith('20') || k.startsWith('21') || k.startsWith('22') || k.startsWith('23') || k.startsWith('24') || k.startsWith('25') || k.startsWith('26') || k.startsWith('27'))),
      apportsCapital: soldeDetails(k => k.startsWith('10')),
      empruntsNouveaux: soldeDetails(k => k.startsWith('16') || k.startsWith('17')),
      remboursementsEmprunts: soldeDetails(k => k.startsWith('16') || k.startsWith('17')),
      tresorerieFinale: soldeDetails(k => k.startsWith('5') && !k.startsWith('52') && !k.startsWith('59')),
    },
    journal,
  };
}

/**
 * Génère l'État des flux de trésorerie (SCT norme 7) — méthode indirecte
 */
export function generateCashFlowStatement(bilan, resultat, journalBalances) {
  const jb = journalBalances;
  const cl = (p) => jb ? Object.keys(jb).filter(k => k.startsWith(p)).reduce((s, k) => s + ((jb[k]?.debit || 0) - (jb[k]?.credit || 0)), 0) / 1000 : 0;
  const db = (p) => jb ? Object.keys(jb).filter(k => k.startsWith(p)).reduce((s, k) => s + (jb[k]?.debit || 0), 0) / 1000 : 0;
  const cr = (p) => jb ? Object.keys(jb).filter(k => k.startsWith(p)).reduce((s, k) => s + (jb[k]?.credit || 0), 0) / 1000 : 0;

  const resultatNet = resultat.sigResultatNet || resultat.resultatNet || 0;
  const dotations = resultat.dotations || 0;
  const reprises = resultat.reprises || 0;

  // Variations des actifs/passifs d'exploitation (directement depuis les soldes)
  // Approche simplifiée: utiliser les soldes comme proxy des variations
  const variationClients = -(cl('41') || 0) / 1000;
  const variationFournisseurs = (cl('40') || 0) / 1000;
  const variationEtat = (cl('43') || 0) / 1000;
  const variationPersonnel = (cl('42') || 0) / 1000;
  const variationStocks = -(cl('3') - cl('39') || 0) / 1000;

  // Flux d'exploitation
  const margeBruteAutofinancement = resultatNet + dotations - reprises;
  const ajustementsExploitation = variationClients + variationFournisseurs + variationEtat + variationPersonnel + variationStocks;
  const fluxExploitation = margeBruteAutofinancement + ajustementsExploitation;

  // Flux d'investissement: acquisitions d'immobilisations (débit 2xxx crédit 5xx)
  const acquisitionsImmobilisations = -(db('20') + db('21') + db('22') + db('23') + db('24') + db('25') + db('26') + db('27')) / 1000;
  const cessionsImmobilisations = (cr('20') + cr('21') + cr('22') + cr('23') + cr('24') + cr('25') + cr('26') + cr('27')) / 1000;
  const fluxInvestissement = acquisitionsImmobilisations + cessionsImmobilisations;

  // Flux de financement: emprunts, capital, remboursements
  const apportsCapital = cr('10') / 1000;
  const empruntsNouveaux = cr('16') + cr('17') / 1000;
  const remboursementsEmprunts = -(db('16') + db('17')) / 1000;
  const fluxFinancement = apportsCapital + empruntsNouveaux + remboursementsEmprunts;

  // Variation de trésorerie
  const variationTresorerie = fluxExploitation + fluxInvestissement + fluxFinancement;

  // Trésorerie finale = solde du compte 5 (sauf 52 concours bancaires)
  const tresorerieFinale = Math.max((cl('5') - cl('52')), 0) / 1000;
  const tresorerieInitiale = tresorerieFinale - variationTresorerie;

  return {
    resultatNet,
    fluxExploitation,
    margeBruteAutofinancement,
    dotations,
    reprises,
    variationClients,
    variationFournisseurs,
    variationEtat,
    variationPersonnel,
    variationStocks,
    fluxInvestissement,
    acquisitionsImmobilisations,
    cessionsImmobilisations,
    fluxFinancement,
    apportsCapital,
    empruntsNouveaux,
    remboursementsEmprunts,
    variationTresorerie,
    tresorerieInitiale,
    tresorerieFinale,
  };
}

/**
 * Génère les Soldes Intermédiaires de Gestion (SIG) — SCT norme 5
 * Pyramide : Marge commerciale → Production → VA → EBE → Résultat exploitation → RCAI → Résultat net
 */
export function generateSIG(bilanData, resultatData, journalBalances) {
  const jb = journalBalances;
  const cl = (p) => jb ? Object.keys(jb).filter(k => k.startsWith(p)).reduce((s, k) => s + ((jb[k]?.debit || 0) - (jb[k]?.credit || 0)), 0) / 1000 : 0;
  const cr = (p) => jb ? Object.keys(jb).filter(k => k.startsWith(p)).reduce((s, k) => s + (jb[k]?.credit || 0), 0) / 1000 : 0;
  const db = (p) => jb ? Object.keys(jb).filter(k => k.startsWith(p)).reduce((s, k) => s + (jb[k]?.debit || 0), 0) / 1000 : 0;

  // Ventes de marchandises (70) vs Prestations (706 si disponible, sinon proportion estimée)
  const ventesMarchandises = jb ? cr('70') - cr('706') : resultatData.ventes * 0.55;
  const ventesPrestations  = jb ? cr('706') : resultatData.ventes * 0.40;

  // Achats de marchandises (601) vs Achats de MP (602) vs Autres achats (603-609)
  const achatsMarchandises = jb ? db('601') : resultatData.achats * 0.50;
  const achatsMP          = jb ? db('602') : resultatData.achats * 0.25;
  const autresAchats      = jb ? db('603') + db('604') + db('605') + db('606') + db('607') + db('608') + db('609') : resultatData.achats * 0.25;

  const production         = resultatData.ventes + (resultatData.productionStockee || 0) + (resultatData.productionImmobilisee || 0);
  const consommationsExternes = resultatData.chargesExternes || 0;
  const chargesPersonnel   = resultatData.chargesPersonnel || 0;
  const impotsTaxes        = resultatData.impotsTaxes || 0;
  const dotations          = resultatData.dotations || 0;
  const reprises           = jb ? cr('78') : 0;

  const margeCommerciale   = ventesMarchandises - achatsMarchandises;
  const productionExercice = production;
  const valeurAjoutee      = margeCommerciale + productionExercice - consommationsExternes - achatsMP - autresAchats;
  const ebe                = valeurAjoutee - impotsTaxes - chargesPersonnel;
  const resultatExploitation = ebe + reprises - dotations;
  const rcai               = resultatExploitation + (resultatData.resultatFinancier || 0);
  const resultatNet        = rcai + (resultatData.resultatExceptionnel || 0) - (resultatData.impotIS || 0);

  return {
    ventesMarchandises,
    ventesPrestations,
    achatsMarchandises,
    achatsMP,
    autresAchats,
    production,
    margeCommerciale,
    productionExercice,
    consommationsExternes,
    valeurAjoutee,
    chargesPersonnel,
    impotsTaxes,
    ebe,
    reprises,
    dotations,
    resultatExploitation,
    resultatFinancier: resultatData.resultatFinancier || 0,
    rcai,
    resultatExceptionnel: resultatData.resultatExceptionnel || 0,
    impotIS: resultatData.impotIS || 0,
    resultatNet,
  };
}

/**
 * Rapprochement bancaire : fait correspondre les transactions bancaires
 * aux factures clients et dépenses fournisseurs.
 *
 * @param {Array} transactions - Transactions bancaires [{id, date, description, amount, type, status, matchedInvoiceId}]
 * @param {Array} invoices - Factures clients [{id, clientName, totalAmount, status, invoiceNumber, dueDate}]
 * @param {Array} expenses - Dépenses fournisseurs [{id, supplier, date, totalAmount, status, category}]
 * @param {Array} [journal] - Écritures comptables (optionnel)
 * @returns {{ rapprochees: Array, suggestions: Array, nonRapprochees: Object, stats: Object }}
 */
export function rapprochementBancaire(transactions = [], invoices = [], expenses = [], journal = []) {
  const reconciled = transactions.filter(t => t.status === 'RECONCILED');
  const unreconciled = transactions.filter(t => t.status !== 'RECONCILED');

  const total = transactions.length;
  const reconciledCount = reconciled.length;
  const tauxRapprochement = total > 0 ? Math.round((reconciledCount / total) * 10000) / 100 : 0;

  const unpaidInvoices = invoices.filter(inv => inv.status !== 'PAID');
  const unpaidExpenses = expenses.filter(exp => exp.status !== 'PAID' && exp.status !== 'RECONCILED');

  const suggestions = [];

  for (const tx of unreconciled) {
    const txAmount = Math.abs(parseFloat(tx.amount) || 0);
    const isCredit = tx.type === 'CREDIT' || tx.type === 'crédit';
    const candidates = isCredit ? unpaidInvoices : unpaidExpenses;

    let best = null;
    let bestScore = 0;

    for (const cand of candidates) {
      const candAmount = Math.abs(parseFloat(cand.totalAmount) || 0);
      const diff = Math.abs(txAmount - candAmount);
      const txDesc = (tx.description || '').toLowerCase();

      let score = 0;
      let strategy = '';

      if (diff === 0) { score = 100; strategy = 'montant_exact'; }
      else if (diff <= 0.010) { score = 95; strategy = 'montant_proche'; }
      else if (txAmount > 0 && diff / txAmount <= 0.10) { score = 60; strategy = 'montant_partiel'; }

      if (isCredit) {
        const name = (cand.clientName || '').toLowerCase();
        const num = (cand.invoiceNumber || '').toLowerCase();
        if (name && txDesc.includes(name)) {
          score = Math.min(score + 20, 100);
          strategy = strategy.startsWith('montant') ? `${strategy}+client` : 'client';
        }
        if (num && txDesc.includes(num)) {
          score = Math.min(score + 15, 100);
          strategy = strategy.startsWith('montant') ? `${strategy}+facture` : 'facture';
        }
      } else {
        const supplier = (cand.supplier || '').toLowerCase();
        if (supplier && txDesc.includes(supplier)) {
          score = Math.min(score + 20, 100);
          strategy = strategy.startsWith('montant') ? `${strategy}+fournisseur` : 'fournisseur';
        }
      }

      if (score > bestScore) {
        bestScore = score;
        best = { candidate: cand, confidence: score, strategy, type: isCredit ? 'facture' : 'depense' };
      }
    }

    if (best && bestScore >= 60) {
      suggestions.push({ transaction: tx, ...best });
    }
  }

  const matchedInvoiceIds = new Set(
    [...reconciled.filter(t => t.matchedInvoiceId).map(t => t.matchedInvoiceId),
     ...suggestions.filter(s => s.type === 'facture').map(s => s.candidate.id)]
  );
  const matchedExpenseIds = new Set(
    suggestions.filter(s => s.type === 'depense').map(s => s.candidate.id)
  );

  const montantTotal = transactions.reduce((s, t) => s + Math.abs(parseFloat(t.amount) || 0), 0);
  const montantRapproche = reconciled.reduce((s, t) => s + Math.abs(parseFloat(t.amount) || 0), 0);

  return {
    rapprochees: reconciled,
    suggestions,
    nonRapprochees: {
      transactions: unreconciled.filter(tx =>
        !suggestions.some(s => s.transaction.id === tx.id)
      ),
      invoices: unpaidInvoices.filter(inv => !matchedInvoiceIds.has(inv.id)),
      expenses: unpaidExpenses.filter(exp => !matchedExpenseIds.has(exp.id)),
    },
    stats: {
      total,
      reconciled: reconciledCount,
      unreconciled: unreconciled.length,
      tauxRapprochement,
      montantTotalTransactions: Math.round(montantTotal * 1000) / 1000,
      montantRapproche: Math.round(montantRapproche * 1000) / 1000,
    },
  };
}

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

function getMonthKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.getMonth();
}

export const computeMonthlyChartData = (invoices = [], expenses = []) => {
  const monthly = {};

  for (let i = 0; i < 12; i++) monthly[i] = { revenus: 0, depenses: 0 };

  for (const inv of invoices) {
    const m = getMonthKey(inv.issueDate || inv.date);
    if (m === null) continue;
    if (inv.status === 'PAID') monthly[m].revenus += parseFloat(inv.totalAmount) || 0;
  }

  for (const exp of expenses) {
    const m = getMonthKey(exp.date);
    if (m === null) continue;
    monthly[m].depenses += parseFloat(exp.totalAmount) || 0;
  }

  let tresorerie = 0;
  const result = [];

  for (let m = 0; m < 12; m++) {
    tresorerie += monthly[m].revenus - monthly[m].depenses;
    result.push({
      name: MONTHS[m],
      revenus: Math.round(monthly[m].revenus * 1000) / 1000,
      depenses: Math.round(monthly[m].depenses * 1000) / 1000,
      tresorerie: Math.round(tresorerie * 1000) / 1000
    });
  }

  return result;
};
