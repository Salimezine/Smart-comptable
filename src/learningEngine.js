const KB_KEY = 'sc_learning_kb';
const SCE_COMPTES = {
  'Achats de marchandises': '6011', 'Achats de matières premières': '6011',
  'Fournitures de Bureau': '6031', 'Fournitures d\'entretien': '6032',
  'Achats d\'emballages': '6022', 'Prestations de services': '611X',
  'Loyer & Charges': '6125', 'Télécoms & Internet': '6132',
  'Énergie & Utilités': '6131', 'Déplacements': '6251',
  'Restauration': '6252', 'Honoraires': '6221',
  'Entretien & Réparations': '6151', 'Publicité': '6231',
  'Transport': '6241', 'Salaires & Charges Sociales': '6311',
  'Assurances': '6161', 'Impôts & Taxes': '6371',
  'Frais bancaires': '6271', 'Autres': '618X',
};

const loadKB = () => {
  try {
    const raw = localStorage.getItem(KB_KEY);
    if (raw) return JSON.parse(raw);
  } catch { }
  return { suppliers: {}, itemPatterns: {}, vatBySupplier: {}, catBySupplier: {} };
};

const saveKB = (kb) => {
  localStorage.setItem(KB_KEY, JSON.stringify(kb));
};

const extractKeywords = (text) => {
  if (!text) return [];
  return text.toLowerCase()
    .replace(/[<>{}()\[\]|\\;:"'',.!?]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .filter(w => !['les','des','pour','dans','une','que','est','pas','sur','par','avec','son','sont','cet','cette','aux','ses','leur','leurs','tout','tous','mais','donc','alors','chez','entre','sans','sous'].includes(w));
};

export const learnFromExpense = (expense) => {
  const kb = loadKB();
  const key = expense.supplier?.trim().toLowerCase();
  if (!key) return;

  if (!kb.suppliers[key]) {
    kb.suppliers[key] = { name: expense.supplier, count: 0, totalAmount: 0, lastDate: '', mf: '', categories: {}, vatRates: {}, amounts: [] };
  }
  const s = kb.suppliers[key];
  s.count++;
  s.totalAmount += expense.totalAmount || 0;
  s.lastDate = expense.date || new Date().toISOString().split('T')[0];
  if (expense.matriculeFiscal && !s.mf) s.mf = expense.matriculeFiscal;
  if (expense.category) s.categories[expense.category] = (s.categories[expense.category] || 0) + 1;
  if (expense.vatRate) s.vatRates[expense.vatRate] = (s.vatRates[expense.vatRate] || 0) + 1;
  if (expense.totalAmount) s.amounts.push(expense.totalAmount);

  const keywords = extractKeywords(expense.supplier);
  keywords.forEach(kw => {
    if (!kb.itemPatterns[kw]) kb.itemPatterns[kw] = { category: expense.category, vatRate: expense.vatRate, count: 0 };
    kb.itemPatterns[kw].count++;
    kb.itemPatterns[kw].category = expense.category;
    kb.itemPatterns[kw].vatRate = expense.vatRate;
  });
  if (expense.category) kb.catBySupplier[key] = expense.category;
  if (expense.vatRate) kb.vatBySupplier[key] = expense.vatRate;

  saveKB(kb);
};

export const learnFromInvoice = (invoice) => {
  const kb = loadKB();
  const key = invoice.clientName?.trim().toLowerCase();
  if (!key) return;

  if (!kb.suppliers[key]) {
    kb.suppliers[key] = { name: invoice.clientName, count: 0, totalAmount: 0, lastDate: '', mf: '', categories: {}, vatRates: {}, amounts: [] };
  }
  const s = kb.suppliers[key];
  s.count++;
  s.totalAmount += invoice.totalAmount || 0;
  s.lastDate = invoice.issueDate || new Date().toISOString().split('T')[0];
  if (invoice.totalAmount) s.amounts.push(invoice.totalAmount);

  if (invoice.items) {
    invoice.items.forEach(item => {
      const kw = extractKeywords(item.description);
      kw.forEach(w => {
        if (!kb.itemPatterns[w]) kb.itemPatterns[w] = { category: 'Ventes', vatRate: item.vatRate, count: 0 };
        kb.itemPatterns[w].count++;
      });
    });
  }

  saveKB(kb);
};

export const predictCategory = (supplier, description) => {
  const kb = loadKB();
  const key = supplier?.trim().toLowerCase();
  if (key && kb.catBySupplier[key]) return kb.catBySupplier[key];

  const descWords = extractKeywords(description || supplier || '');
  for (const word of descWords) {
    const pattern = kb.itemPatterns[word];
    if (pattern?.category && pattern.count > 1) return pattern.category;
  }

  if (!supplier) return 'Autres';
  const sup = supplier.toLowerCase();
  if (sup.includes('steg') || sup.includes('électr')) return 'Énergie & Utilités';
  if (sup.includes('ooredoo') || sup.includes('orange') || sup.includes('telecom') || sup.includes('tt')) return 'Télécoms & Internet';
  if (sup.includes('monoprix') || sup.includes('carrefour') || sup.includes('bureau')) return 'Fournitures de Bureau';
  if (sup.includes('tunisair') || sup.includes('voyage')) return 'Déplacements';
  if (sup.includes('resto') || sup.includes('café') || sup.includes('cafe')) return 'Restauration';
  if (sup.includes('loyer') || sup.includes('immeuble')) return 'Loyer & Charges';
  return 'Autres';
};

export const predictVatRate = (supplier, category) => {
  const kb = loadKB();
  const key = supplier?.trim().toLowerCase();
  if (key && kb.vatBySupplier[key]) return kb.vatBySupplier[key];

  const vatByCat = { 'Énergie & Utilités': 13, 'Déplacements': 7, 'Télécoms & Internet': 19, 'Fournitures de Bureau': 19, 'Restauration': 19, 'Loyer & Charges': 13, 'Salaires & Charges Sociales': 0, 'Autres': 19 };
  return vatByCat[category] || 19;
};

export const suggestAccount = (category) => {
  return SCE_COMPTES[category] || '618X';
};

export const suggestDefaultAmount = (supplier) => {
  const kb = loadKB();
  const key = supplier?.trim().toLowerCase();
  const s = kb.suppliers[key];
  if (s?.amounts?.length > 0) {
    const avg = s.amounts.reduce((a, b) => a + b, 0) / s.amounts.length;
    return Math.round(avg * 1000) / 1000;
  }
  return 0;
};

export const detectAnomaly = (supplier, amount) => {
  const kb = loadKB();
  const key = supplier?.trim().toLowerCase();
  const s = kb.suppliers[key];
  if (!s || s.amounts.length < 2) return null;
  const avg = s.amounts.reduce((a, b) => a + b, 0) / s.amounts.length;
  const deviation = Math.abs(amount - avg) / avg;
  if (deviation > 0.5) return { avg: Math.round(avg * 1000) / 1000, deviation: Math.round(deviation * 100) + '%', severity: deviation > 1 ? 'high' : 'medium' };
  return null;
};

export const searchEntities = (invoices, expenses, query) => {
  if (!query || query.length < 2) return { invoices: [], expenses: [] };
  const q = query.toLowerCase();
  const score = (text) => {
    if (!text) return 0;
    const t = text.toLowerCase();
    let s = 0;
    if (t === q) s += 100;
    if (t.startsWith(q)) s += 50;
    if (t.includes(q)) s += 20;
    const qWords = q.split(/\s+/).filter(w => w.length > 1);
    qWords.forEach(w => { if (t.includes(w)) s += 5; });
    return s;
  };

  const matchedInvoices = invoices
    .map(inv => ({
      ...inv,
      _score: score(inv.clientName) + score(inv.invoiceNumber) + score(inv.clientEmail) +
        (inv.items || []).reduce((sum, item) => sum + score(item.description), 0)
    }))
    .filter(inv => inv._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 20);

  const matchedExpenses = expenses
    .map(exp => ({
      ...exp,
      _score: score(exp.supplier) + score(exp.invoiceNumber) + score(exp.category) + score(exp.matriculeFiscal)
    }))
    .filter(exp => exp._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 20);

  return { invoices: matchedInvoices, expenses: matchedExpenses };
};

export const getLearningStats = () => {
  const kb = loadKB();
  const supplierCount = Object.keys(kb.suppliers).length;
  const patternsCount = Object.keys(kb.itemPatterns).length;
  const knownSuppliers = Object.values(kb.suppliers)
    .sort((a, b) => b.count - a.count)
    .slice(0, 50)
    .map(s => ({ name: s.name, count: s.count, total: Math.round(s.totalAmount * 1000) / 1000, lastDate: s.lastDate, mf: s.mf }));
  return { supplierCount, patternsCount, knownSuppliers, categories: SCE_COMPTES };
};

export const suggestInvoiceItems = (description, amount) => {
  const kb = loadKB();
  const words = extractKeywords(description || '');
  const suggestions = [];
  words.forEach(w => {
    const p = kb.itemPatterns[w];
    if (p) suggestions.push({ keyword: w, category: p.category, vatRate: p.vatRate, confidence: Math.min(p.count / 5, 1) });
  });
  return suggestions;
};
