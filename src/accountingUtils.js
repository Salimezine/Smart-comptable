/**
 * Utilitaires de calculs comptables et fiscaux de Penni AI
 */

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
 * Estime le montant de la provision fiscale (Impôt sur les Sociétés en Tunisie = 15% standard)
 * @param {number} totalRevenues - Total des revenus encaissés
 * @returns {number}
 */
export const calculateEstimatedTaxes = (totalRevenues = 0) => {
  if (totalRevenues < 0) return 0;
  return totalRevenues * 0.15; // Taux IS standard en Tunisie (15%)
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
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(val);
};

/**
 * Génère les données du Bilan (Balance Sheet) avec détail SCE
 */
export const generateBalanceSheet = (invoices = [], expenses = [], transactions = []) => {
  const totalRevenue = invoices.reduce((sum, inv) => sum + (parseFloat(inv.totalAmount) || 0), 0);
  const paidRevenue = calculateTotalRevenues(invoices);
  const pendingRevenue = calculatePendingRevenues(invoices);
  const totalExpenses = calculateTotalExpenses(expenses);
  const bankBalance = calculateBankBalance(0, transactions);
  const netProfit = totalRevenue - totalExpenses;
  const estimatedTax = netProfit > 0 ? Math.round((netProfit * 0.15) * 1000) / 1000 : 0;

  const annualRevenue = Math.max(totalRevenue, 1);

  const intangibleAssets = Math.round(Math.min(annualRevenue * 0.08, 15000) * 1000) / 1000;
  const tangibleAssets = Math.round(Math.min(annualRevenue * 0.25, 50000) * 1000) / 1000;
  const nonCurrentAssets = Math.round((intangibleAssets + tangibleAssets) * 1000) / 1000;

  const receivables = Math.round(pendingRevenue * 1000) / 1000;
  const cashAndBank = Math.round(bankBalance * 1000) / 1000;
  const currentAssets = Math.round((receivables + cashAndBank) * 1000) / 1000;

  const totalAssets = Math.round((nonCurrentAssets + currentAssets) * 1000) / 1000;

  const socialCapital = Math.round(Math.min(annualRevenue * 0.20, 30000) * 1000) / 1000;
  const legalReserve = Math.round(Math.max(netProfit * 0.05, 0) * 1000) / 1000;
  const retainedEarnings = Math.round(netProfit * 1000) / 1000;
  const equity = Math.round((socialCapital + legalReserve + retainedEarnings) * 1000) / 1000;

  const bankLoans = Math.round(Math.min(annualRevenue * 0.15, 25000) * 1000) / 1000;
  const nonCurrentLiabilities = bankLoans;

  const accountsPayable = Math.round(totalExpenses * 0.5 * 1000) / 1000;
  const taxPayable = estimatedTax;
  const otherPayables = Math.round(Math.max(totalExpenses * 0.1, 500) * 1000) / 1000;
  const currentLiabilities = Math.round((accountsPayable + taxPayable + otherPayables) * 1000) / 1000;

  const totalLiabilities = Math.round((currentLiabilities + nonCurrentLiabilities) * 1000) / 1000;
  const totalLiabilitiesAndEquity = Math.round((equity + totalLiabilities) * 1000) / 1000;

  return {
    assets: {
      nonCurrent: { intangible: intangibleAssets, tangible: tangibleAssets, total: nonCurrentAssets },
      current: { receivables, cashAndBank, total: currentAssets },
      total: totalAssets
    },
    liabilities: {
      nonCurrent: { bankLoans, total: nonCurrentLiabilities },
      current: { accountsPayable, taxPayable, otherPayables, total: currentLiabilities },
      total: totalLiabilities
    },
    equity: {
      socialCapital,
      legalReserve,
      retainedEarnings,
      total: equity
    },
    totalLiabilitiesAndEquity
  };
};

/**
 * Génère les données de l'État de Résultat (Income Statement) SCE
 */
export const generateIncomeStatement = (invoices = [], expenses = []) => {
  const operatingRevenue = invoices.reduce((sum, inv) => sum + (parseFloat(inv.totalAmount) || 0), 0);
  const operatingExpenses = expenses.reduce((sum, exp) => sum + (parseFloat(exp.totalAmount) || 0), 0);
  const operatingProfit = operatingRevenue - operatingExpenses;
  const financialRevenue = 0;
  const financialExpenses = 0;
  const ordinaryProfit = operatingProfit + financialRevenue - financialExpenses;
  const taxAmount = calculateEstimatedTaxes(ordinaryProfit > 0 ? ordinaryProfit : 0);
  const netProfit = ordinaryProfit - taxAmount;

  return {
    revenue: operatingRevenue,
    costOfGoodsSold: 0,
    operatingExpenses: operatingExpenses,
    operatingProfit: operatingProfit,
    ordinaryProfit: ordinaryProfit,
    tax: taxAmount,
    netProfit: netProfit
  };
};

/**
 * Calcule 8 ratios financiers clés
 */
export const calculateFinancialRatios = (invoices = [], expenses = [], transactions = []) => {
  const bs = generateBalanceSheet(invoices, expenses, transactions);
  const is = generateIncomeStatement(invoices, expenses);

  const currentAssets = bs.assets.current.total;
  const currentLiabilities = bs.liabilities.current.total;
  const totalAssets = bs.assets.total;
  const equity = bs.equity.total;
  const totalLiabilities = bs.liabilities.total;
  const netProfit = is.netProfit;
  const revenue = is.revenue;
  const operatingProfit = is.operatingProfit;
  const operatingExpenses = is.operatingExpenses;

  const liquidityRatio = currentLiabilities > 0 ? Math.round((currentAssets / currentLiabilities) * 100) / 100 : 0;
  const debtToEquity = equity !== 0 ? Math.round((totalLiabilities / equity) * 100) / 100 : 0;
  const roe = equity !== 0 ? Math.round((netProfit / equity) * 10000) / 100 : 0;
  const roa = totalAssets !== 0 ? Math.round((netProfit / totalAssets) * 10000) / 100 : 0;
  const netMargin = revenue !== 0 ? Math.round((netProfit / revenue) * 10000) / 100 : 0;
  const grossMargin = revenue !== 0 ? Math.round(((revenue - operatingExpenses) / revenue) * 10000) / 100 : 0;
  const financialAutonomy = totalAssets !== 0 ? Math.round((equity / totalAssets) * 10000) / 100 : 0;
  const interestCoverage = 0;

  return {
    liquidityRatio,
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
export const getFinancialExportData = (invoices = [], expenses = [], transactions = [], companyDetails = {}) => {
  const balanceSheet = generateBalanceSheet(invoices, expenses, transactions);
  const incomeStatement = generateIncomeStatement(invoices, expenses);
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

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

function getMonthKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.getMonth();
}

export const computeMonthlyChartData = (invoices = [], expenses = []) => {
  const monthly = {};

  for (const inv of invoices) {
    const m = getMonthKey(inv.issueDate || inv.date);
    if (m === null) continue;
    if (!monthly[m]) monthly[m] = { revenus: 0, depenses: 0 };
    monthly[m].revenus += parseFloat(inv.totalAmount) || 0;
  }

  for (const exp of expenses) {
    const m = getMonthKey(exp.date);
    if (m === null) continue;
    if (!monthly[m]) monthly[m] = { revenus: 0, depenses: 0 };
    monthly[m].depenses += parseFloat(exp.totalAmount) || 0;
  }

  const sortedMonths = Object.keys(monthly).map(Number).sort((a, b) => a - b);
  let tresorerie = 0;
  const result = [];

  for (const m of sortedMonths) {
    tresorerie += monthly[m].revenus - monthly[m].depenses;
    result.push({
      name: MONTHS[m],
      Revenus: Math.round(monthly[m].revenus * 1000) / 1000,
      Dépenses: Math.round(monthly[m].depenses * 1000) / 1000,
      Trésorerie: Math.round(tresorerie * 1000) / 1000
    });
  }

  return result;
};
