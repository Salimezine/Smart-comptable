const TVA_RATES = { normal: 19, reduit1: 13, reduit2: 7, zero: 0 };

export function calculateTVASummary(invoices = [], expenses = []) {
  const collectedByRate = { 19: 0, 13: 0, 7: 0, 0: 0 };
  const deductibleByRate = { 19: 0, 13: 0, 7: 0, 0: 0 };

  invoices.forEach(inv => {
    const rate = inv.vatRate || 19;
    collectedByRate[rate] = (collectedByRate[rate] || 0) + (inv.vatAmount || 0);
  });

  expenses.forEach(exp => {
    const rate = exp.vatRate || 19;
    deductibleByRate[rate] = (deductibleByRate[rate] || 0) + (exp.vatAmount || 0);
  });

  const totalCollected = Object.values(collectedByRate).reduce((a, b) => a + b, 0);
  const totalDeductible = Object.values(deductibleByRate).reduce((a, b) => a + b, 0);

  return {
    collectedByRate,
    deductibleByRate,
    totalCollected,
    totalDeductible,
    tvaDue: Math.max(0, totalCollected - totalDeductible),
    tvaCredit: Math.max(0, totalDeductible - totalCollected),
    netTVA: totalCollected - totalDeductible,
    ratioRecouvrement: totalCollected > 0 ? (totalDeductible / totalCollected) * 100 : 0,
  };
}

export function generateTVADeclarations(invoices = [], expenses = []) {
  const monthly = {};
  const now = new Date();

  const processItem = (item, type) => {
    const d = new Date(item.issueDate || item.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthly[key]) {
      monthly[key] = {
        month: key, collected: 0, deductible: 0, due: 0,
        invoiceCount: 0, expenseCount: 0,
        baseHT: 0, baseDeductible: 0,
      };
    }
    monthly[key][type === 'invoice' ? 'collected' : 'deductible'] += item.vatAmount || 0;
    monthly[key][type === 'invoice' ? 'invoiceCount' : 'expenseCount'] += 1;
    monthly[key][type === 'invoice' ? 'baseHT' : 'baseDeductible'] += (item.totalAmount || 0) - (item.vatAmount || 0);
  };

  invoices.forEach(inv => processItem(inv, 'invoice'));
  expenses.forEach(exp => processItem(exp, 'expense'));

  Object.values(monthly).forEach(m => {
    m.due = Math.max(0, m.collected - m.deductible);
    m.label = new Date(`${m.month}-01`).toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
  });

  const sortedMonths = Object.keys(monthly).sort();
  const declarations = sortedMonths.map(key => {
    const m = monthly[key];
    const declarationDate = new Date(`${m.month}-01`);
    declarationDate.setMonth(declarationDate.getMonth() + 1);
    return {
      ...m,
      dueDate: `${declarationDate.getFullYear()}-${String(declarationDate.getMonth() + 1).padStart(2, '0')}-20`,
      status: m.due > 0 ? 'due' : 'zero',
    };
  });

  return declarations;
}

export function calculateTVAForecast(monthlyDeclarations) {
  const last6 = monthlyDeclarations.slice(-6);
  if (last6.length === 0) return { averageMonthly: 0, forecast: [], trend: 'stable' };

  const avg = last6.reduce((s, m) => s + m.due, 0) / last6.length;
  const forecast = [];
  const now = new Date();

  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    forecast.push({
      month: d.toLocaleString('fr-FR', { month: 'short', year: 'numeric' }),
      estimatedTVA: Math.round(avg * 100) / 100,
      dueDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-20`,
    });
  }

  const recent = last6.map(m => m.due);
  const trend = recent.length >= 2
    ? (recent[recent.length - 1] > recent[0] ? 'increasing' : recent[recent.length - 1] < recent[0] ? 'decreasing' : 'stable')
    : 'stable';

  return { averageMonthly: Math.round(avg * 100) / 100, forecast, trend };
}

export function getTVAOptimizationSuggestions(summary) {
  const suggestions = [];
  if (summary.tvaCredit > 0) {
    suggestions.push({
      icon: '💡',
      title: 'Crédit de TVA',
      description: `Vous avez un crédit de TVA de ${summary.tvaCredit.toFixed(3)} DT. Vous pouvez demander le remboursement ou l'imputer sur les prochains mois.`,
      priority: 'high',
    });
  }
  if (summary.ratioRecouvrement < 30) {
    suggestions.push({
      icon: '⚠️',
      title: 'Faible TVA déductible',
      description: 'Votre ratio de TVA déductible est bas. Assurez-vous de bien comptabiliser toutes vos factures d\'achats.',
      priority: 'medium',
    });
  }
  return suggestions;
}
