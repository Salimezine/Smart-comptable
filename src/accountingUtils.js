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
  const equity            = Math.round((socialCapital + legalReserve + otherReserves + retainedEarnings) * 1000) / 1000;

  const provisions        = Math.round(R * 0.02 * 1000) / 1000;
  const nonCurrentLiabilities = Math.round((bankLoans + provisions) * 1000) / 1000;

  const accountsPayable   = Math.round(E * 0.40 * 1000) / 1000;
  const personnelPayable  = Math.round(E * 0.08 * 1000) / 1000;
  const taxPayable        = estimatedTax;
  const vatPayable        = Math.round(R * 0.06 * 1000) / 1000;
  const otherPayables     = Math.round(Math.max(E * 0.05, 0.200) * 1000) / 1000;
  const bankOverdraft     = 0;  /* avec l'équilibre actif/passif automatique, le découvert est nul */
  const currentLiabilities = Math.round((accountsPayable + personnelPayable + taxPayable + vatPayable + otherPayables + bankOverdraft) * 1000) / 1000;

  const totalLiabilities  = Math.round((currentLiabilities + nonCurrentLiabilities) * 1000) / 1000;
  const totalPassif       = Math.round((equity + totalLiabilities) * 1000) / 1000;
  /* totalPassif = totalLiabilitiesAndEquity (coffre fort du bilan) */

  /* --- STEP 2 : Somme de l'Actif hors Banque --- */
  const nonCurrentAssets  = Math.round((intangibleAssets + tangibleAssets + financialAssets) * 1000) / 1000;
  const autresActifsCourants = Math.round((stocksAmount + receivables + personnelRec + taxRec + otherRec + cashRegister) * 1000) / 1000;
  const sommeActifSaufBanque = Math.round((nonCurrentAssets + autresActifsCourants) * 1000) / 1000;

  /* --- STEP 3 : Banque = TOTAL PASSIF − Σ(autres Actifs) --- */
  const cashAndBank = Math.round((totalPassif - sommeActifSaufBanque) * 1000) / 1000;

  /* --- STEP 4 : Totaux Actif (automatiquement = totalPassif) --- */
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
  /* Target raw amounts (DT) — income statement values * 1000 */
  const targetRevenue = is.revenue * 1000;
  const targetExpenses = is.operatingExpenses * 1000;

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
