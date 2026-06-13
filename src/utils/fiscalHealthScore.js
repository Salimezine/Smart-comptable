export function calculateFiscalHealth(invoices = [], expenses = [], transactions = []) {
  let score = 100;
  const breakdown = [];
  const recommendations = [];

  const totalRevenue = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.totalAmount || 0), 0);
  const paidInvoices = invoices.filter(i => i.status === 'PAID');
  const overdueInvoices = invoices.filter(i => i.status === 'OVERDUE');
  const sentInvoices = invoices.filter(i => i.status === 'SENT');

  if (invoices.length === 0 && expenses.length === 0) {
    return {
      score: 0, level: 'Aucune donnée', levelColor: 'text-slate-400', breakdown: [],
      recommendations: [{ priority: 'critical', message: 'Importez vos données comptables pour générer un score' }],
    };
  }

  if (totalRevenue === 0) { score -= 20; breakdown.push({ label: 'Aucun revenu enregistré', impact: -20 }); }

  const overdueRatio = invoices.length > 0 ? overdueInvoices.length / invoices.length : 0;
  if (overdueRatio > 0.3) { score -= 15; breakdown.push({ label: `${overdueInvoices.length} factures en retard (>30%)`, impact: -15 }); }
  else if (overdueRatio > 0.1) { score -= 5; breakdown.push({ label: `${overdueInvoices.length} factures en retard`, impact: -5 }); }

  const expenseRatio = totalRevenue > 0 ? totalExpenses / totalRevenue : 0;
  if (expenseRatio > 0.95) { score -= 15; breakdown.push({ label: `Marge très faible (${(100 - expenseRatio * 100).toFixed(0)}%)`, impact: -15 }); }
  else if (expenseRatio > 0.8) { score -= 5; breakdown.push({ label: `Marge réduite (${(100 - expenseRatio * 100).toFixed(0)}%)`, impact: -5 }); }
  else if (expenseRatio < 0.3 && totalRevenue > 0) { score += 5; breakdown.push({ label: `Bonne maîtrise des charges (${(expenseRatio * 100).toFixed(0)}%)`, impact: 5 }); }

  if (sentInvoices.length > 5) { score -= 5; breakdown.push({ label: `${sentInvoices.length} factures non encaissées`, impact: -5 }); }

  const collectionRate = totalRevenue > 0 ? paidInvoices.reduce((s, i) => s + (i.totalAmount || 0), 0) / totalRevenue * 100 : 0;
  if (collectionRate > 80) { score += 5; breakdown.push({ label: `Bon taux de recouvrement (${collectionRate.toFixed(0)}%)`, impact: 5 }); }

  score = Math.max(0, Math.min(100, score));

  if (score >= 80) recommendations.push({ priority: 'low', message: 'Excellent état fiscal. Continuez à suivre vos échéances.' });
  else if (score >= 60) recommendations.push({ priority: 'medium', message: 'Quelques points d\'attention. Passez en revue les factures en retard.' });
  else recommendations.push({ priority: 'high', message: 'Action requise : réduisez les retards et améliorez votre recouvrement.' });

  if (overdueInvoices.length > 0) recommendations.push({ priority: 'high', message: 'Relancez les clients avec des factures impayées.' });
  if (expenseRatio > 0.85) recommendations.push({ priority: 'medium', message: 'Optimisez vos charges pour améliorer la marge.' });

  return {
    score,
    level: score >= 80 ? 'Excellent' : score >= 60 ? 'Attention' : 'Risqué',
    levelColor: score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400',
    breakdown,
    recommendations,
    metrics: { totalRevenue, totalExpenses, paidInvoices: paidInvoices.length, overdueInvoices: overdueInvoices.length, collectionRate },
  };
}

export function generateFiscalReport(invoices = [], expenses = []) {
  const health = calculateFiscalHealth(invoices, expenses);

  const revenueByMonth = {};
  invoices.forEach(inv => {
    const d = new Date(inv.issueDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!revenueByMonth[key]) revenueByMonth[key] = 0;
    revenueByMonth[key] += inv.totalAmount || 0;
  });

  const expenseByMonth = {};
  expenses.forEach(exp => {
    const d = new Date(exp.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!expenseByMonth[key]) expenseByMonth[key] = 0;
    expenseByMonth[key] += exp.totalAmount || 0;
  });

  return {
    generatedAt: new Date().toISOString(),
    period: 'Exercice en cours',
    health,
    revenueByMonth,
    expenseByMonth,
    summary: {
      totalRevenue: health.metrics.totalRevenue,
      totalExpenses: health.metrics.totalExpenses,
      netProfit: health.metrics.totalRevenue - health.metrics.totalExpenses,
      marginRate: health.metrics.totalRevenue > 0
        ? ((health.metrics.totalRevenue - health.metrics.totalExpenses) / health.metrics.totalRevenue * 100).toFixed(1)
        : 0,
    },
  };
}
