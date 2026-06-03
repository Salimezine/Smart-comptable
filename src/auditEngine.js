import { detectAnomaly, getLearningStats } from './learningEngine';
import { generateBalanceSheet, generateIncomeStatement, calculateFinancialRatios } from './accountingUtils';

const fmt = (val) => {
  if (val == null || isNaN(val)) return '0,000 DT';
  return val.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' DT';
};

const tvaRates = [19, 13, 7, 0];

export const runFullAudit = ({ invoices, expenses, transactions, companyDetails }) => {
  const checks = [];

  const totalRevenue = invoices.reduce((s, inv) => s + (parseFloat(inv.totalAmount) || 0), 0);
  const totalExpenses = expenses.reduce((s, exp) => s + (parseFloat(exp.totalAmount) || 0), 0);
  const netProfit = totalRevenue - totalExpenses;
  const paidRevenue = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + (parseFloat(i.totalAmount) || 0), 0);
  const pendingRevenue = invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + (parseFloat(i.totalAmount) || 0), 0);
  const bankBalance = paidRevenue - totalExpenses;

  // 1. TVA collected vs deducted
  const tvaCollected = invoices.reduce((s, inv) => {
    const items = inv.items || [];
    return s + items.reduce((si, item) => si + ((item.unitPrice || 0) * (item.vatRate || 0) / 100), 0);
  }, 0);
  const tvaDeducted = expenses.reduce((s, exp) => {
    const ht = exp.totalAmount / (1 + (exp.vatRate || 19) / 100);
    return s + (ht * ((exp.vatRate || 19) / 100));
  }, 0);
  const tvaDue = Math.max(0, tvaCollected - tvaDeducted);
  const tvaRate = totalRevenue > 0 ? (tvaCollected / totalRevenue) * 100 : 0;
  checks.push({
    id: 'tva-compliance',
    category: 'TVA',
    label: 'Conformité TVA — Collecte vs Déduction',
    status: tvaDue > 0 && tvaDue < totalRevenue * 0.2 ? 'pass' : tvaDue >= totalRevenue * 0.2 ? 'warn' : 'fail',
    detail: `TVA collectée : ${fmt(tvaCollected)} | TVA déductible : ${fmt(tvaDeducted)} | TVA due : ${fmt(tvaDue)}`,
    value: tvaDue
  });

  // 2. IS (Impôt sur les Sociétés) provision
  const estimatedIS = netProfit > 0 ? Math.round(netProfit * 0.15 * 1000) / 1000 : 0;
  const isRate = netProfit > 0 ? (estimatedIS / netProfit) * 100 : 0;
  checks.push({
    id: 'is-provision',
    category: 'IS',
    label: 'Provision IS (15% — Régime PME)',
    status: netProfit > 0 ? 'pass' : 'info',
    detail: `Résultat net : ${fmt(netProfit)} | IS estimé (15%) : ${fmt(estimatedIS)}`,
    value: estimatedIS
  });

  // 3. CNSS provision
  const payrollBase = Math.max(totalExpenses * 0.35, 4500);
  const cnssRate = 0.1657;
  const estimatedCNSS = payrollBase * cnssRate;
  checks.push({
    id: 'cnss-provision',
    category: 'CNSS',
    label: 'Provision CNSS (16.57%)',
    status: 'pass',
    detail: `Base salariale estimée : ${fmt(payrollBase)} | CNSS : ${fmt(estimatedCNSS)}`,
    value: estimatedCNSS
  });

  // 4. Timbre Fiscal compliance
  const invoicesWithoutStamp = invoices.filter(inv => !inv.stampDuty || inv.stampDuty === 0);
  const stampPct = invoices.length > 0 ? ((invoices.length - invoicesWithoutStamp.length) / invoices.length) * 100 : 0;
  checks.push({
    id: 'timbre-fiscal',
    category: 'TVA',
    label: 'Timbre Fiscal sur Factures',
    status: stampPct >= 80 ? 'pass' : stampPct >= 50 ? 'warn' : 'fail',
    detail: `${invoices.length - invoicesWithoutStamp.length}/${invoices.length} factures avec timbre fiscal (${Math.round(stampPct)}%)`,
    value: stampPct
  });

  // 5. Retenue à la Source (RS) on service expenses
  const serviceExpenses = expenses.filter(exp => /service|prestation|honoraire|conseil|commission/i.test(exp.category || ''));
  const rsApplied = serviceExpenses.filter(exp => exp.retenueSource && exp.retenueSource > 0);
  const rsPct = serviceExpenses.length > 0 ? (rsApplied.length / serviceExpenses.length) * 100 : 100;
  checks.push({
    id: 'retenue-source',
    category: 'RS',
    label: 'Retenue à la Source sur Prestations',
    status: rsPct >= 80 ? 'pass' : rsPct >= 50 ? 'warn' : 'fail',
    detail: `${rsApplied.length}/${serviceExpenses.length} prestations avec RS appliquée (${Math.round(rsPct)}%)`,
    value: rsPct
  });

  // 6. Missing MF (Matricule Fiscal)
  const missingMf = expenses.filter(exp => !exp.matriculeFiscal || exp.matriculeFiscal.trim() === '');
  const mfPct = expenses.length > 0 ? (missingMf.length / expenses.length) * 100 : 0;
  checks.push({
    id: 'missing-mf',
    category: 'Conformité',
    label: 'MF Fournisseur sur Factures Achats',
    status: mfPct <= 10 ? 'pass' : mfPct <= 30 ? 'warn' : 'fail',
    detail: `${missingMf.length}/${expenses.length} factures sans MF (${Math.round(mfPct)}%)`,
    value: mfPct
  });

  // 7. Bank Reconciliation
  const unreconciled = transactions.filter(t => t.status === 'UNRECONCILED').length;
  const totalTx = transactions.length;
  const recPct = totalTx > 0 ? ((totalTx - unreconciled) / totalTx) * 100 : 100;
  checks.push({
    id: 'bank-reconciliation',
    category: 'Trésorerie',
    label: 'Rapprochement Bancaire',
    status: recPct >= 90 ? 'pass' : recPct >= 70 ? 'warn' : 'fail',
    detail: `${totalTx - unreconciled}/${totalTx} transactions reconciliées (${Math.round(recPct)}%)`,
    value: recPct
  });

  // 8. Liquidity Ratio (Current Ratio)
  const balanceSheet = generateBalanceSheet(invoices, expenses, transactions);
  const currentAssets = balanceSheet.assets.current.total;
  const currentLiabilities = balanceSheet.liabilities.current.total;
  const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
  checks.push({
    id: 'liquidity-ratio',
    category: 'Ratios',
    label: 'Ratio de Liquidité (Actifs Courants / Passifs Courants)',
    status: currentRatio >= 1.2 ? 'pass' : currentRatio >= 0.8 ? 'warn' : 'fail',
    detail: `Ratio : ${currentRatio.toFixed(2)}x (seuil minimal : 1.2x)`,
    value: currentRatio
  });

  // 9. Debt-to-Equity Ratio
  const totalLiabilities = balanceSheet.liabilities.total;
  const equity = balanceSheet.equity.total;
  const debtEquity = equity > 0 ? totalLiabilities / equity : 0;
  checks.push({
    id: 'debt-equity',
    category: 'Ratios',
    label: "Ratio d'Endettement (Dettes / Capitaux Propres)",
    status: debtEquity <= 1.5 ? 'pass' : debtEquity <= 2.5 ? 'warn' : 'fail',
    detail: `Ratio : ${debtEquity.toFixed(2)}x (seuil : ≤ 1.5x)`,
    value: debtEquity
  });

  // 10. Operating Margin
  const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  checks.push({
    id: 'operating-margin',
    category: 'Ratios',
    label: 'Marge Nette',
    status: margin >= 10 ? 'pass' : margin >= 3 ? 'warn' : 'fail',
    detail: `Marge : ${margin.toFixed(1)}% (seuil : ≥ 10%)`,
    value: margin
  });

  // 11. Anomalies (from learning engine)
  let anomalyCount = 0;
  const anomalyDetails = [];
  expenses.forEach(exp => {
    if (exp.supplier && exp.totalAmount) {
      const anomaly = detectAnomaly(exp.supplier, exp.totalAmount);
      if (anomaly) {
        anomalyCount++;
        anomalyDetails.push(`${exp.supplier}: ${fmt(exp.totalAmount)} (moy. ${fmt(anomaly.avg)}, écart ${anomaly.deviation})`);
      }
    }
  });
  checks.push({
    id: 'anomalies',
    category: 'Détection',
    label: 'Anomalies Détectées (Moteur d\'Apprentissage)',
    status: anomalyCount === 0 ? 'pass' : anomalyCount <= 2 ? 'warn' : 'fail',
    detail: anomalyCount > 0 ? `${anomalyCount} anomalie(s) détectée(s)\n${anomalyDetails.join('\n')}` : 'Aucune anomalie significative',
    value: anomalyCount
  });

  // 12. Balance Sheet Balance Check
  const totalAssets = balanceSheet.assets.total;
  const totalLiabilitiesEquity = balanceSheet.totalLiabilitiesAndEquity;
  const balanced = Math.abs(totalAssets - totalLiabilitiesEquity) < 0.01;
  checks.push({
    id: 'balance-check',
    category: 'Bilan',
    label: 'Équilibre du Bilan (Actif = Passif + CP)',
    status: balanced ? 'pass' : 'fail',
    detail: balanced
      ? `Actif ${fmt(totalAssets)} = Passif + CP ${fmt(totalLiabilitiesEquity)} ✓`
      : `Actif ${fmt(totalAssets)} ≠ Passif + CP ${fmt(totalLiabilitiesEquity)} (écart : ${fmt(Math.abs(totalAssets - totalLiabilitiesEquity))})`,
    value: balanced ? 100 : 0
  });

  // 13. TVA Rate Compliance
  const invalidRateExpenses = expenses.filter(exp => exp.vatRate != null && !tvaRates.includes(exp.vatRate));
  checks.push({
    id: 'tva-rates',
    category: 'TVA',
    label: 'Taux TVA Conformes (19%, 13%, 7%, 0%)',
    status: invalidRateExpenses.length === 0 ? 'pass' : 'warn',
    detail: invalidRateExpenses.length > 0
      ? `${invalidRateExpenses.length} écriture(s) avec taux TVA non standard`
      : 'Tous les taux TVA sont conformes',
    value: invalidRateExpenses.length
  });

  // 14. Overdue Invoices
  const now = new Date();
  const overdue = invoices.filter(inv => {
    if (inv.status === 'PAID' || !inv.dueDate) return false;
    const due = new Date(inv.dueDate);
    return due < now;
  });
  const overdueAmount = overdue.reduce((s, inv) => s + (parseFloat(inv.totalAmount) || 0), 0);
  checks.push({
    id: 'overdue',
    category: 'Recouvrement',
    label: 'Factures Échues Non Payées',
    status: overdue.length === 0 ? 'pass' : overdue.length <= 3 ? 'warn' : 'fail',
    detail: `${overdue.length} facture(s) échue(s) pour un total de ${fmt(overdueAmount)}`,
    value: overdue.length
  });

  // 15. SCE Account Mapping Coverage
  const stats = getLearningStats();
  const categoriesUsed = [...new Set(expenses.map(e => e.category).filter(Boolean))];
  const mappedCategories = categoriesUsed.filter(c => stats.categories[c]);
  const mappingPct = categoriesUsed.length > 0 ? (mappedCategories.length / categoriesUsed.length) * 100 : 100;
  checks.push({
    id: 'sce-mapping',
    category: 'SCE',
    label: 'Couverture Comptes SCE',
    status: mappingPct >= 80 ? 'pass' : mappingPct >= 50 ? 'warn' : 'fail',
    detail: `${mappedCategories.length}/${categoriesUsed.length} catégories mappées au plan SCE (${Math.round(mappingPct)}%)`,
    value: mappingPct
  });

  // Score calculation (weighted)
  const weights = {
    'tva-compliance': 3,
    'is-provision': 2,
    'cnss-provision': 1,
    'timbre-fiscal': 2,
    'retenue-source': 2,
    'missing-mf': 2,
    'bank-reconciliation': 2,
    'liquidity-ratio': 1.5,
    'debt-equity': 1.5,
    'operating-margin': 1,
    'anomalies': 2,
    'balance-check': 1,
    'tva-rates': 1,
    'overdue': 1.5,
    'sce-mapping': 0.5
  };
  const scoreMap = { pass: 100, warn: 50, info: 75, fail: 0 };
  let totalWeight = 0;
  let weightedScore = 0;
  checks.forEach(c => {
    const w = weights[c.id] || 1;
    totalWeight += w;
    weightedScore += w * (scoreMap[c.status] || 0);
  });
  const auditScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;

  // Summary
  const passed = checks.filter(c => c.status === 'pass').length;
  const warned = checks.filter(c => c.status === 'warn').length;
  const failed = checks.filter(c => c.status === 'fail').length;

  const recommendations = [];
  if (failed > 0 || warned > 0) {
    const critical = checks.filter(c => c.status === 'fail');
    critical.forEach(c => {
      if (c.id === 'tva-compliance') recommendations.push('Rapprochez vos déclarations TVA avec les relevés bancaires. Assurez-vous de déclarer avant le 20 du mois suivant.');
      if (c.id === 'timbre-fiscal') recommendations.push('Apposez le timbre fiscal (1 DT par facture) sur toutes les factures de vente éligibles.');
      if (c.id === 'missing-mf') recommendations.push('Exigez le Matricule Fiscal (MF) de tous vos fournisseurs pour déduire la TVA.');
      if (c.id === 'bank-reconciliation') recommendations.push('Effectuez le lettrage des transactions bancaires en attente dans l\'onglet "Banque".');
      if (c.id === 'liquidity-ratio') recommendations.push('Réduisez les dettes à court terme ou augmentez les actifs liquides pour améliorer le ratio de liquidité.');
      if (c.id === 'debt-equity') recommendations.push('Réduisez l\'endettement ou augmentez les capitaux propres (apport en capital).');
      if (c.id === 'anomalies') recommendations.push('Vérifiez les montants inhabituels signalés. Il peut s\'agir d\'erreurs de saisie ou de fraudes potentielles.');
      if (c.id === 'retenue-source') recommendations.push('Appliquez la retenue à la source (1.5% ou 2.5%) sur toutes les prestations de services.');
      if (c.id === 'overdue') recommendations.push('Relancez les clients avec des factures échues. Envisagez des pénalités de retard.');
      if (c.id === 'sce-mapping') recommendations.push('Mappez les catégories manquantes au plan SCE pour une comptabilité conforme.');
    });
  }
  if (auditScore >= 80) recommendations.push('Excellent niveau de conformité. Continuez à tenir vos registres à jour.');
  else if (auditScore >= 60) recommendations.push('Niveau de conformité acceptable. Quelques points d\'attention à corriger.');
  else recommendations.push('Plusieurs non-conformités critiques détectées. Consultez un expert-comptable agréé OECT.');

  return {
    score: auditScore,
    summary: {
      total: checks.length,
      passed,
      warned,
      failed
    },
    checks,
    recommendations,
    companyName: companyDetails?.name || 'Société',
    date: new Date().toISOString().split('T')[0]
  };
};

export const generateAuditMarkdown = (auditResult) => {
  const { score, summary, checks, recommendations, companyName, date } = auditResult;
  const grade = score >= 80 ? '🟢' : score >= 60 ? '🟡' : '🔴';
  const gradeLabel = score >= 80 ? 'Excellent' : score >= 60 ? 'Acceptable' : 'Critique';

  let md = `## Rapport d'Audit Smart-Comptable\n\n`;
  md += `**Société :** ${companyName}  \n`;
  md += `**Date :** ${date}  \n`;
  md += `**Score global :** ${grade} **${score}/100** — ${gradeLabel}\n\n`;
  md += `### Résumé\n\n`;
  md += `- ✅ **${summary.passed}** conformes\n`;
  md += `- ⚠️ **${summary.warned}** avertissements\n`;
  md += `- ❌ **${summary.failed}** non-conformités\n\n`;

  md += `### Détail des contrôles\n\n`;
  md += `\n\n| # | Catégorie | Contrôle | Statut | Détail |\n`;
  md += `| --- | --- | --- | --- | --- |\n`;
  checks.forEach((c, i) => {
    const icon = c.status === 'pass' ? '✅' : c.status === 'warn' ? '⚠️' : c.status === 'fail' ? '❌' : 'ℹ️';
    const detail = (c.detail || '').replace(/\|/g, '&#124;').replace(/\n/g, ' · ').trim();
    const label = (c.label || '').replace(/\|/g, '&#124;');
    const category = (c.category || '').replace(/\|/g, '&#124;');
    md += `| ${i + 1} | ${category} | ${label} | ${icon} | ${detail} |\n`;
  });
  md += `\n`;

  if (recommendations.length > 0) {
    md += `\n### Recommandations\n\n`;
    recommendations.forEach(r => {
      md += `- ${r}\n`;
    });
  }

  md += `\n---\n`;
  md += `_Rapport généré par Smart-Comptable — Moteur d'audit local. Validez avec un expert-comptable OECT._`;
  return md;
};
