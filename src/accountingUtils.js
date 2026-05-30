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
export const generateBalanceSheet = (invoices = [], expenses = [], transactions = [], customData = {}) => {
  const totalRevenue = invoices.reduce((sum, inv) => sum + (parseFloat(inv.totalAmount) || 0), 0);
  const pendingRevenue = calculatePendingRevenues(invoices);
  const totalExpenses = calculateTotalExpenses(expenses);
  const bankBalance = calculateBankBalance(0, transactions);
  const netProfit = totalRevenue - totalExpenses;
  const estimatedTax = netProfit > 0 ? Math.round((netProfit * 0.15) * 1000) / 1000 : 0;

  const R = Math.max(totalRevenue, 1);
  const E = Math.max(totalExpenses, 1);

  /* --- User-editable values (with auto defaults) --- */
  const intangibleAssets    = Math.round((customData.immobilisationsIncorporelles ?? Math.min(R * 0.08, 15000)) * 1000) / 1000;
  const tangibleAssets      = Math.round((customData.immobilisationsCorporelles ?? Math.min(R * 0.25, 50000)) * 1000) / 1000;
  const socialCapital       = Math.round((customData.capitalSocial ?? Math.min(Math.max(R * 0.20, 5000), 30000)) * 1000) / 1000;
  const bankLoans           = Math.round((customData.empruntsBancaires ?? Math.min(R * 0.15, 25000)) * 1000) / 1000;
  const stocksAmount        = Math.round((customData.stocks ?? E * 0.10) * 1000) / 1000;

  /* --- Sub-items (estimated from data) --- */
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

  const receivables   = Math.round(pendingRevenue * 1000) / 1000;
  const personnelRec  = Math.round(E * 0.03 * 1000) / 1000;
  const taxRec        = Math.round(R * 0.02 * 1000) / 1000;
  const otherRec      = Math.round(R * 0.01 * 1000) / 1000;
  const cashAndBank   = Math.round(bankBalance * 1000) / 1000;
  const cashRegister  = Math.round(Math.max(cashAndBank * 0.05, 50) * 1000) / 1000;

  const nonCurrentAssets  = Math.round((intangibleAssets + tangibleAssets + financialAssets) * 1000) / 1000;
  const currentAssets     = Math.round((stocksAmount + receivables + personnelRec + taxRec + otherRec + cashAndBank + cashRegister) * 1000) / 1000;
  const totalAssets       = Math.round((nonCurrentAssets + currentAssets) * 1000) / 1000;

  /* --- Equity --- */
  const legalReserve      = Math.round(Math.max(netProfit * 0.05, 0) * 1000) / 1000;
  const otherReserves     = Math.round(Math.max(netProfit * 0.03, 0) * 1000) / 1000;
  const retainedEarnings  = Math.round(netProfit * 1000) / 1000;
  const equity            = Math.round((socialCapital + legalReserve + otherReserves + retainedEarnings) * 1000) / 1000;

  /* --- Liabilities --- */
  const provisions        = Math.round(R * 0.02 * 1000) / 1000;
  const nonCurrentLiabilities = Math.round((bankLoans + provisions) * 1000) / 1000;

  const accountsPayable   = Math.round(E * 0.40 * 1000) / 1000;
  const personnelPayable  = Math.round(E * 0.08 * 1000) / 1000;
  const taxPayable        = estimatedTax;
  const vatPayable        = Math.round(R * 0.06 * 1000) / 1000;
  const otherPayables     = Math.round(Math.max(E * 0.05, 200) * 1000) / 1000;
  const bankOverdraft     = Math.round(Math.max(currentAssets * (-0.05), 0) * 1000) / 1000;
  const currentLiabilities = Math.round((accountsPayable + personnelPayable + taxPayable + vatPayable + otherPayables + bankOverdraft) * 1000) / 1000;

  const totalLiabilities              = Math.round((currentLiabilities + nonCurrentLiabilities) * 1000) / 1000;
  const totalLiabilitiesAndEquity     = Math.round((equity + totalLiabilities) * 1000) / 1000;

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
    totalLiabilitiesAndEquity
  };
};

/**
 * Génère les données de l'État de Résultat (Income Statement) SCE
 */
export const generateIncomeStatement = (invoices = [], expenses = []) => {
  const totalRevenue = invoices.reduce((sum, inv) => sum + (parseFloat(inv.totalAmount) || 0), 0);
  const totalExpenses = expenses.reduce((sum, exp) => sum + (parseFloat(exp.totalAmount) || 0), 0);
  const R = Math.max(totalRevenue, 1);
  const E = Math.max(totalExpenses, 1);

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
  const financialCosts    = Math.round(totalExpenses * 0.01 * 1000) / 1000;
  const financialResult   = financialRevenue - financialCosts;

  const ordinaryProfit    = operatingProfit + financialResult;
  const taxAmount         = calculateEstimatedTaxes(ordinaryProfit > 0 ? ordinaryProfit : 0);
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
  const stocks = bs.assets.current.stocks || 0;

  const liquidityRatio = currentLiabilities > 0 ? Math.round((currentAssets / currentLiabilities) * 100) / 100 : 0;
  const quickRatio = currentLiabilities > 0 ? Math.round(((currentAssets - stocks) / currentLiabilities) * 100) / 100 : 0;
  const debtToEquity = equity !== 0 ? Math.round((totalLiabilities / equity) * 100) / 100 : 0;
  const roe = equity !== 0 ? Math.round((netProfit / equity) * 10000) / 100 : 0;
  const roa = totalAssets !== 0 ? Math.round((netProfit / totalAssets) * 10000) / 100 : 0;
  const netMargin = revenue !== 0 ? Math.round((netProfit / revenue) * 10000) / 100 : 0;
  const grossMargin = revenue !== 0 ? Math.round(((revenue - (is.purchaseGoods + is.purchaseRaw + is.otherPurchases)) / revenue) * 10000) / 100 : 0;
  const financialAutonomy = totalAssets !== 0 ? Math.round((equity / totalAssets) * 10000) / 100 : 0;
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
