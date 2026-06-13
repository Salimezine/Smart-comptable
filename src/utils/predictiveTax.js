export function predictNextQuarter(invoices = [], expenses = [], months = 3) {
  const now = new Date();
  const monthlyData = [];
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const getMonthlyData = (items, dateField, valueField) => {
    const map = {};
    items.forEach(item => {
      const d = new Date(item[dateField]);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = (map[key] || 0) + (item[valueField] || 0);
    });
    return map;
  };

  const revenueByMonth = getMonthlyData(invoices, 'issueDate', 'totalAmount');
  const expenseByMonth = getMonthlyData(expenses, 'date', 'totalAmount');

  const last3MonthsRevenue = [];
  const last3MonthsExpenses = [];

  for (let i = 0; i < 3; i++) {
    const d = new Date(currentYear, currentMonth - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    last3MonthsRevenue.push(revenueByMonth[key] || 0);
    last3MonthsExpenses.push(expenseByMonth[key] || 0);
  }

  const avgRevenue = last3MonthsRevenue.reduce((a, b) => a + b, 0) / 3;
  const avgExpenses = last3MonthsExpenses.reduce((a, b) => a + b, 0) / 3;

  const revenueGrowth = last3MonthsRevenue.length >= 2
    ? ((last3MonthsRevenue[0] - last3MonthsRevenue[last3MonthsRevenue.length - 1]) / Math.max(last3MonthsRevenue[last3MonthsRevenue.length - 1], 1)) * 100
    : 0;

  const predictions = [];
  for (let i = 1; i <= months; i++) {
    const d = new Date(currentYear, currentMonth + i, 1);
    const growthFactor = 1 + (revenueGrowth / 100) * (i / 3);
    const predictedRevenue = avgRevenue * growthFactor;
    const predictedExpenses = avgExpenses * (1 + 0.02 * i);
    const predictedTVA = predictedRevenue * 0.19 / 1.19 - predictedExpenses * 0.19 / 1.19;
    const predictedIS = Math.max(0, (predictedRevenue - predictedExpenses)) * 0.25;

    predictions.push({
      month: d.toLocaleString('fr-FR', { month: 'long', year: 'numeric' }),
      monthShort: d.toLocaleString('fr-FR', { month: 'short', year: 'numeric' }),
      predictedRevenue: Math.round(predictedRevenue * 100) / 100,
      predictedExpenses: Math.round(predictedExpenses * 100) / 100,
      predictedTVA: Math.round(predictedTVA * 100) / 100,
      predictedIS: Math.round(predictedIS * 100) / 100,
      predictedProfit: Math.round((predictedRevenue - predictedExpenses) * 100) / 100,
      confidence: i === 1 ? 85 : i === 2 ? 70 : 55,
    });
  }

  return {
    predictions,
    averageMonthlyRevenue: Math.round(avgRevenue * 100) / 100,
    averageMonthlyExpenses: Math.round(avgExpenses * 100) / 100,
    revenueGrowth: Math.round(revenueGrowth * 100) / 100,
    estimatedAnnualRevenue: Math.round(avgRevenue * 12 * 100) / 100,
    estimatedAnnualTax: Math.round((avgRevenue - avgExpenses) * 12 * 0.15 * 100) / 100,
    trend: revenueGrowth > 5 ? 'growth' : revenueGrowth < -5 ? 'decline' : 'stable',
  };
}

export function forecastCashFlow(invoices = [], expenses = [], months = 6) {
  const now = new Date();
  const cashFlow = [];
  let runningBalance = 0;

  const getMonthlySum = (items, dateField, valueField) => {
    const map = {};
    items.forEach(item => {
      const d = new Date(item[dateField]);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = (map[key] || 0) + (item[valueField] || 0);
    });
    return map;
  };

  const revenueByMonth = getMonthlySum(invoices, 'issueDate', 'totalAmount');
  const expenseByMonth = getMonthlySum(expenses, 'date', 'totalAmount');

  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    const revenue = revenueByMonth[key] || 0;
    const expenses_m = expenseByMonth[key] || 0;
    const net = revenue - expenses_m;
    runningBalance += net;

    cashFlow.push({
      month: d.toLocaleString('fr-FR', { month: 'short', year: 'numeric' }),
      revenue,
      expenses: expenses_m,
      net,
      balance: runningBalance,
    });
  }

  return cashFlow;
}

export function getGrowthInsights(monthlyData) {
  const insights = [];
  if (monthlyData.length < 2) return insights;

  const recent = monthlyData.slice(-3);
  const prev = monthlyData.slice(-6, -3);

  const avgRecent = recent.reduce((s, m) => s + m.revenue, 0) / recent.length;
  const avgPrev = prev.reduce((s, m) => s + m.revenue, 0) / Math.max(prev.length, 1);

  const growth = avgPrev > 0 ? ((avgRecent - avgPrev) / avgPrev) * 100 : 0;

  if (growth > 20) insights.push({ type: 'positive', message: `Croissance forte : +${growth.toFixed(1)}% du CA sur les 3 derniers mois`, icon: '🚀' });
  else if (growth > 5) insights.push({ type: 'positive', message: `Croissance stable : +${growth.toFixed(1)}% du CA trimestriel`, icon: '📈' });
  else if (growth > -5) insights.push({ type: 'neutral', message: `Stabilité du chiffre d'affaires (${growth.toFixed(1)}%)`, icon: '📊' });
  else insights.push({ type: 'warning', message: `Baisse d'activité : ${growth.toFixed(1)}% sur le trimestre`, icon: '📉' });

  return insights;
}
