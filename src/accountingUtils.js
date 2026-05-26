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
