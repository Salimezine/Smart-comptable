import { getJournalKey } from './utils/journalKey';
import { generateFromJournal, generateBalanceSheet, generateIncomeStatement, calculateFinancialRatios } from './accountingUtils';
import { detectAnomaly, getLearningStats } from './learningEngine';
import { loadFiscalData } from './utils/fiscalDataService';

const fmt = (val) => {
  if (val == null || isNaN(val)) return '0,000 DT';
  return val.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' DT';
};

const fmtPct = (v) => (v * 100).toFixed(1) + '%';

const tvaRates = [19, 13, 7, 0];

export async function initAuditRates() {
  try {
    const data = await loadFiscalData('_fallback');
    if (!data || !data.taux) return;
    const t = data.taux;
    if (t.tva_19) {
      const r = parseFloat(t.tva_19.taux);
      if (r) tvaRates[0] = r;
    }
  } catch (_) {}
}

function loadJournal() {
  try {
    const key = getJournalKey();
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

// ─────────────────────────────────────────────
//  Journal-based audit
// ─────────────────────────────────────────────
export const runJournalAudit = ({ companyDetails } = {}) => {
  const journal = loadJournal();
  if (journal.length === 0) {
    return {
      score: 0,
      summary: { total: 0, passed: 0, warned: 0, failed: 0 },
      checks: [],
      recommendations: ['Ajoutez des écritures comptables pour générer un audit.'],
      optimizations: [],
      stats: { entriesCount: 0, lockedCount: 0, unbalancedCount: 0, duplicatePieces: 0, tvaCollected: 0, tvaDeductible: 0, tvaDue: 0, rsSolde: 0, isProvision: 0, payrollBrut: 0, totalDebit: 0, totalCredit: 0, cashAndBank: 0, totalCharges: 0 },
      companyName: companyDetails?.name || 'Nouvelle société',
      date: new Date().toISOString().split('T')[0]
    };
  }
  const checks = [];

  // Compute aggregates from journal
  const totalDebit = journal.reduce((s, e) => s + (e.debit || 0), 0);
  const totalCredit = journal.reduce((s, e) => s + (e.credit || 0), 0);
  const entriesCount = journal.length;

  const tvaCollected = journal.filter(e => e.compte && e.compte.startsWith('43671')).reduce((s, e) => s + (e.credit || 0), 0);
  const tvaDeductible = journal.filter(e => e.compte && e.compte.startsWith('43666')).reduce((s, e) => s + (e.debit || 0), 0);
  const tvaDue = Math.max(0, tvaCollected - tvaDeductible);

  const rsCredit = journal.filter(e => e.compte && e.compte.startsWith('43674')).reduce((s, e) => s + (e.credit || 0), 0);
  const rsDebit = journal.filter(e => e.compte && e.compte.startsWith('43674')).reduce((s, e) => s + (e.debit || 0), 0);
  const rsSolde = rsCredit - rsDebit;

  const is631 = journal.filter(e => e.compte && e.compte.startsWith('631000')).reduce((s, e) => s + (e.debit || 0), 0);
  const is437 = journal.filter(e => e.compte && e.compte.startsWith('437000')).reduce((s, e) => s + (e.credit || 0), 0);

  const payrollBrut = journal.filter(e => e.compte && e.compte.startsWith('6411')).reduce((s, e) => s + (e.debit || 0), 0);
  const payrollCnssPat = journal.filter(e => e.compte && e.compte.startsWith('6431')).reduce((s, e) => s + (e.debit || 0), 0);
  const payrollCP = journal.filter(e => e.compte && e.compte.startsWith('6412')).reduce((s, e) => s + (e.debit || 0), 0);

  const bankEntries = journal.filter(e => e.compte && e.compte.startsWith('532'));
  const bankDebitTotal = bankEntries.reduce((s, e) => s + (e.debit || 0), 0);
  const bankCreditTotal = bankEntries.reduce((s, e) => s + (e.credit || 0), 0);
  const cashAndBank = bankDebitTotal - bankCreditTotal;

  const lockedCount = journal.filter(e => e.locked === true).length;
  const pieceIds = journal.map(e => e.numeroPiece).filter(Boolean);
  const uniquePieces = new Set(pieceIds);
  const duplicatePieces = pieceIds.length - uniquePieces.size;

  // Compute balanced entry checks
  const piecesMap = new Map();
  for (const e of journal) {
    const pid = e.numeroPiece || 'sans_piece';
    if (!piecesMap.has(pid)) piecesMap.set(pid, []);
    piecesMap.get(pid).push(e);
  }
  let unbalancedCount = 0;
  let unbalancedDetails = [];
  for (const [pid, lignes] of piecesMap) {
    const d = lignes.reduce((s, l) => s + (l.debit || 0), 0);
    const c = lignes.reduce((s, l) => s + (l.credit || 0), 0);
    if (Math.abs(d - c) > 0.001) {
      unbalancedCount++;
      if (unbalancedDetails.length < 5) unbalancedDetails.push(pid);
    }
  }

  const result = generateFromJournal();
  const bilan = result?.bilan ?? {};
  const resultat = result?.resultat ?? {};
  const ratios = result?.ratios ?? {};
  const currentAssets = bilan?.assets?.current?.total || 0;
  const currentLiabilities = bilan?.liabilities?.current?.total || 0;
  const equity = bilan?.equity?.total || 0;
  const totalLiabilities = bilan?.liabilities?.total || 0;
  const totalAssets = bilan?.assets?.total || 0;
  const totalLiabEq = bilan?.totalLiabilitiesAndEquity || 0;
  const revenue = resultat?.chiffreAffaires || resultat?.productionVendue || 0;
  const netResult = resultat?.resultatNet || 0;

  // Helper to push a check
  const addCheck = (id, category, label, status, detail, value) => {
    checks.push({ id, category, label, status, detail, value });
  };

  // ── 1. Volume d'écritures ──
  addCheck('journal-volume', 'Journal',
    'Volume d\'écritures comptables',
    entriesCount >= 5 ? 'pass' : entriesCount >= 1 ? 'warn' : 'fail',
    `${entriesCount} écriture(s) dans le journal`,
    entriesCount);

  // ── 2. TVA collectée vs déductible ──
  addCheck('tva-compliance', 'TVA',
    'Conformité TVA — Collecte vs Déduction',
    tvaDue > 0 && tvaDue < (tvaCollected || 1) * 1.5 ? 'pass' : tvaDue === 0 && tvaCollected > 0 ? 'warn' : tvaCollected > 0 ? 'pass' : 'info',
    `TVA collectée (43671) : ${fmt(tvaCollected)} | TVA déductible (43666) : ${fmt(tvaDeductible)} | TVA due : ${fmt(tvaDue)}`,
    tvaDue);

  // ── 3. Déclaration TVA ──
  const hasTvaEntries = tvaCollected > 0 || tvaDeductible > 0;
  addCheck('tva-declaration', 'TVA',
    'Déclaration TVA périodique',
    hasTvaEntries ? 'pass' : 'info',
    hasTvaEntries ? 'Comptes TVA (43671/43666) utilisés' : 'Aucune écriture TVA détectée',
    hasTvaEntries ? 100 : 0);

  // ── 4. Taux TVA conformes ──
  const tvaAccounts = journal.filter(e => e.compte && (e.compte.startsWith('43671') || e.compte.startsWith('43666')));
  addCheck('tva-rates', 'TVA',
    'Taux TVA — Comptes conformes',
    tvaAccounts.length > 0 ? 'pass' : 'info',
    `${tvaAccounts.length} écriture(s) sur comptes TVA`,
    tvaAccounts.length);

  // ── 5. RS (Retenue à la source) ──
  addCheck('retenue-source', 'RS',
    'Retenue à la Source (43674)',
    rsSolde > 0 ? 'pass' : rsCredit > 0 ? 'pass' : 'info',
    `RS débit: ${fmt(rsDebit)} | RS crédit: ${fmt(rsCredit)} | Solde: ${fmt(rsSolde)}`,
    rsSolde);

  // ── 6. Provision IS ──
  addCheck('is-provision', 'IS',
    'Provision IS (631000 / 437000)',
    is631 > 0 && is437 > 0 ? 'pass' : is631 > 0 || is437 > 0 ? 'warn' : netResult > 0 ? 'warn' : 'info',
    `631000 (débit): ${fmt(is631)} | 437000 (crédit): ${fmt(is437)} | Résultat net: ${fmt(netResult)}`,
    is631);

  // ── 7. Équilibre du bilan ──
  const bilanBalanced = Math.abs(totalAssets - totalLiabEq) < 0.01;
  addCheck('balance-check', 'Bilan',
    'Équilibre du Bilan (Actif = Passif + CP)',
    bilanBalanced ? 'pass' : 'fail',
    bilanBalanced
      ? `Actif ${fmt(totalAssets)} = Passif + CP ${fmt(totalLiabEq)}`
      : `Écart: ${fmt(Math.abs(totalAssets - totalLiabEq))}`,
    bilanBalanced ? 100 : 0);

  // ── 8. Pièces équilibrées ──
  addCheck('balanced-entries', 'Journal',
    'Pièces comptables équilibrées',
    unbalancedCount === 0 ? 'pass' : unbalancedCount <= 2 ? 'warn' : 'fail',
    `${unbalancedCount} pièce(s) non équilibrée(s)${unbalancedDetails.length ? ' : ' + unbalancedDetails.join(', ') : ''}`,
    unbalancedCount);

  // ── 9. Pièces en double ──
  addCheck('duplicate-pieces', 'Journal',
    'Doublons de pièces comptables',
    duplicatePieces === 0 ? 'pass' : 'warn',
    `${duplicatePieces} N° pièce(s) en double`,
    duplicatePieces);

  // ── 10. Écritures verrouillées ──
  const lockPct = entriesCount > 0 ? lockedCount / entriesCount : 0;
  addCheck('locked-entries', 'Journal',
    'Écritures verrouillées',
    lockPct >= 0.8 ? 'pass' : lockPct >= 0.5 ? 'warn' : 'fail',
    `${lockedCount}/${entriesCount} verrouillées (${fmtPct(lockPct)})`,
    lockPct);

  // ── 11. Paie — écritures salaires ──
  addCheck('payroll-entries', 'Paie',
    'Écritures de paie (6411)',
    payrollBrut > 0 ? 'pass' : 'info',
    `Salaire brut comptabilisé: ${fmt(payrollBrut)}`,
    payrollBrut);

  // ── 12. Paie — CNSS patronale ──
  addCheck('payroll-cnss', 'Paie',
    'CNSS patronale (6431)',
    payrollCnssPat > 0 ? 'pass' : payrollBrut > 0 ? 'warn' : 'info',
    `CNSS patronale: ${fmt(payrollCnssPat)}`,
    payrollCnssPat);

  // ── 13. Paie — Provision CP ──
  addCheck('payroll-cp', 'Paie',
    'Provision congés payés (6412)',
    payrollCP > 0 ? 'pass' : payrollBrut > 0 ? 'warn' : 'info',
    `Provision CP: ${fmt(payrollCP)}`,
    payrollCP);

  // ── 14. Compte banque ──
  const bankNet = bankDebitTotal - bankCreditTotal;
  addCheck('bank-account', 'Trésorerie',
    'Solde compte Banque (532)',
    bankEntries.length > 0 ? 'pass' : 'info',
    `${bankEntries.length} écriture(s) · Solde: ${fmt(bankNet)}`,
    bankNet);

  // ── 15. Ratio de liquidité ──
  const liqRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
  addCheck('liquidity-ratio', 'Ratios',
    'Ratio de liquidité générale',
    liqRatio >= 1.2 ? 'pass' : liqRatio >= 0.8 ? 'warn' : 'fail',
    `Ratio: ${liqRatio.toFixed(2)}x (seuil ≥ 1.2)`,
    liqRatio);

  // ── 16. Ratio d'endettement ──
  const debtRatio = equity > 0 ? totalLiabilities / equity : 0;
  addCheck('debt-equity', 'Ratios',
    'Ratio d\'endettement',
    debtRatio <= 1.5 ? 'pass' : debtRatio <= 2.5 ? 'warn' : 'fail',
    `Ratio: ${debtRatio.toFixed(2)}x (seuil ≤ 1.5)`,
    debtRatio);

  // ── 17. Marge nette ──
  const margin = revenue > 0 ? (netResult / revenue) * 100 : 0;
  addCheck('operating-margin', 'Ratios',
    'Marge nette',
    margin >= 10 ? 'pass' : margin >= 3 ? 'warn' : revenue > 0 ? 'warn' : 'info',
    `Marge: ${margin.toFixed(1)}% (seuil ≥ 10%)`,
    margin);

  // ── 18. Résultat net ──
  addCheck('net-result', 'Résultat',
    'Résultat net de l\'exercice',
    netResult > 0 ? 'pass' : netResult === 0 ? 'info' : 'warn',
    `Résultat net: ${fmt(netResult)}`,
    netResult);

  // ── 19. Chronologie des dates ──
  const dates = journal.map(e => e.date).filter(Boolean).sort();
  let dateIssues = 0;
  try {
    const now = new Date();
    for (const d of dates) {
      if (new Date(d) > now) dateIssues++;
    }
  } catch {}
  addCheck('date-chronology', 'Journal',
    'Dates chronologiques (aucune date future)',
    dateIssues === 0 ? 'pass' : 'warn',
    dateIssues > 0 ? `${dateIssues} écriture(s) avec date future` : `${dates.length} écriture(s) avec dates valides`,
    dateIssues);

  // ── 20. Comptes PCG couverts ──
  const usedPrefixes = new Set(journal.map(e => (e.compte || '').substring(0, 2)).filter(Boolean));
  const expectedPrefixes = ['1', '2', '3', '4', '5', '6', '7'];
  const missingClasses = expectedPrefixes.filter(p => ![...usedPrefixes].some(u => u.startsWith(p)));
  const coveragePct = Math.round((1 - missingClasses.length / expectedPrefixes.length) * 100);
  addCheck('sce-mapping', 'SCE',
    'Couverture classes comptables (1-7)',
    missingClasses.length <= 1 ? 'pass' : missingClasses.length <= 2 ? 'warn' : 'fail',
    `${coveragePct}% couvert · Classes manquantes: ${missingClasses.join(', ') || 'aucune'}`,
    coveragePct);

  // ── 21. Revenus vs charges ──
  const class7 = journal.filter(e => (e.compte || '').startsWith('7'));
  const class6 = journal.filter(e => (e.compte || '').startsWith('6'));
  const totalProd = class7.reduce((s, e) => s + (e.credit || 0), 0) + class7.reduce((s, e) => s + (e.debit || 0), 0);
  const totalCharges = class6.reduce((s, e) => s + (e.debit || 0), 0) + class6.reduce((s, e) => s + (e.credit || 0), 0);
  addCheck('income-vs-expenses', 'Résultat',
    'Produits vs Charges (classes 6 & 7)',
    totalProd > 0 || totalCharges > 0 ? 'pass' : 'info',
    `Produits: ${fmt(totalProd)} | Charges: ${fmt(totalCharges)}`,
    totalProd);

  // ── 22. Fournisseurs / Clients ──
  const fournisseurs = journal.filter(e => e.compte && e.compte.startsWith('401'));
  const clients = journal.filter(e => e.compte && e.compte.startsWith('411'));
  addCheck('clients-fournisseurs', 'Bilan',
    'Comptes Clients (411) & Fournisseurs (401)',
    fournisseurs.length > 0 || clients.length > 0 ? 'pass' : 'info',
    `Fournisseurs: ${fournisseurs.length} écrit. | Clients: ${clients.length} écrit.`,
    fournisseurs.length + clients.length);

  // ── 23. Actifs immobilisés ──
  const immobilisations = journal.filter(e => e.compte && (e.compte.startsWith('20') || e.compte.startsWith('21') || e.compte.startsWith('22') || e.compte.startsWith('23')));
  addCheck('fixed-assets', 'Bilan',
    'Actifs immobilisés (20-23)',
    immobilisations.length > 0 ? 'pass' : 'info',
    `${immobilisations.length} écriture(s) d'immobilisation`,
    immobilisations.length);

  // ── 24. Amortissements ──
  const amortissements = journal.filter(e => e.compte && e.compte.startsWith('28'));
  const dotations = journal.filter(e => e.compte && (e.compte.startsWith('681') || e.compte.startsWith('682')));
  addCheck('amortissements', 'Bilan',
    'Amortissements (28) & Dotations (681/682)',
    amortissements.length > 0 || dotations.length > 0 ? 'pass' : 'info',
    `Amortissements: ${amortissements.length} écrit. | Dotations: ${dotations.length} écrit.`,
    amortissements.length + dotations.length);

  // ── 25. Provisions ──
  const provisions = journal.filter(e => e.compte && (e.compte.startsWith('29') || e.compte.startsWith('39') || e.compte.startsWith('49') || e.compte.startsWith('59')));
  addCheck('provisions', 'Bilan',
    'Provisions pour dépréciation (29/39/49/59)',
    provisions.length > 0 ? 'pass' : 'info',
    `${provisions.length} écriture(s) de provision`,
    provisions.length);

  // ── 26. Capitaux propres ──
  const capital = journal.filter(e => e.compte && e.compte.startsWith('101')).reduce((s, e) => s + (e.credit || 0) - (e.debit || 0), 0);
  addCheck('share-capital', 'Bilan',
    'Capital social (101)',
    capital > 0 ? 'pass' : 'info',
    `Capital social: ${fmt(capital)}`,
    capital);

  // ── 27. Paie — virement bancaire ──
  const paiementNet = journal.filter(e => e.libelle && e.libelle.toLowerCase().includes('paiement net'));
  addCheck('payroll-payment', 'Paie',
    'Virement salaires (paiement net)',
    paiementNet.length > 0 ? 'pass' : payrollBrut > 0 ? 'warn' : 'info',
    `${paiementNet.length} virement(s) salaires`,
    paiementNet.length);

  // ── 28. Paie — paiement CNSS ──
  const paiementCnss = journal.filter(e => e.libelle && e.libelle.toLowerCase().includes('paiement cnss'));
  addCheck('payroll-cnss-payment', 'Paie',
    'Paiement CNSS',
    paiementCnss.length > 0 ? 'pass' : payrollCnssPat > 0 ? 'warn' : 'info',
    `${paiementCnss.length} paiement(s) CNSS`,
    paiementCnss.length);

  // ── 29. Paie — paiement IRPP ──
  const paiementIrpp = journal.filter(e => e.libelle && e.libelle.toLowerCase().includes('paiement irpp'));
  addCheck('payroll-irpp-payment', 'Paie',
    'Paiement IRPP/RS',
    paiementIrpp.length > 0 ? 'pass' : rsSolde > 0 ? 'warn' : 'info',
    `${paiementIrpp.length} paiement(s) IRPP`,
    paiementIrpp.length);

  // ── 30. Total débit = total crédit ──
  const journalBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
  addCheck('journal-balance', 'Journal',
    'Total Débit = Total Crédit',
    journalBalanced ? 'pass' : 'fail',
    `Débit: ${fmt(totalDebit)} | Crédit: ${fmt(totalCredit)} | Écart: ${fmt(Math.abs(totalDebit - totalCredit))}`,
    Math.abs(totalDebit - totalCredit));

  // ── 31. Réserves légales ──
  const reserveLegale = journal.filter(e => e.compte && e.compte.startsWith('102')).reduce((s, e) => s + (e.credit || 0) - (e.debit || 0), 0);
  addCheck('legal-reserve', 'Bilan',
    'Réserves légales (102)',
    reserveLegale > 0 ? 'pass' : capital > 0 ? 'warn' : 'info',
    `Réserves légales: ${fmt(reserveLegale)}`,
    reserveLegale);

  // ── 32. Résultat reporté ──
  const resultatReporte = journal.filter(e => e.compte && e.compte.startsWith('12')).reduce((s, e) => s + (e.credit || 0) - (e.debit || 0), 0);
  addCheck('retained-earnings', 'Bilan',
    'Résultats reportés (12)',
    resultatReporte !== 0 ? 'pass' : 'info',
    `Résultats reportés: ${fmt(resultatReporte)}`,
    resultatReporte);

  // ── 33. Timbre fiscal sur ventes ──
  const timbreEntries = journal.filter(e => e.compte && e.compte.startsWith('43675'));
  addCheck('timbre-fiscal', 'TVA',
    'Timbre fiscal (43675)',
    timbreEntries.length > 0 ? 'pass' : 'info',
    `${timbreEntries.length} écriture(s) de timbre fiscal`,
    timbreEntries.length);

  // ── 34. Écritures sans N° pièce ──
  const sansPiece = journal.filter(e => !e.numeroPiece);
  addCheck('missing-piece-num', 'Journal',
    'Écritures sans N° pièce',
    sansPiece.length === 0 ? 'pass' : sansPiece.length <= 3 ? 'warn' : 'fail',
    `${sansPiece.length} écriture(s) sans numéro de pièce`,
    sansPiece.length);

  // ── 35. Écritures avec montant nul ──
  const nulMontant = journal.filter(e => e.debit === 0 && e.credit === 0);
  addCheck('zero-amount-entries', 'Journal',
    'Écritures avec montant nul',
    nulMontant.length === 0 ? 'pass' : 'warn',
    `${nulMontant.length} écriture(s) sans montant`,
    nulMontant.length);

  // ── Score calculation ──
  const weights = {};
  const defaultWeight = 1;
  checks.forEach(c => { weights[c.id] = weights[c.id] || defaultWeight; });
  weights['tva-compliance'] = 3;
  weights['balance-check'] = 3;
  weights['balanced-entries'] = 2;
  weights['journal-balance'] = 3;
  weights['is-provision'] = 2;
  weights['retenue-source'] = 2;
  weights['tva-declaration'] = 2;
  weights['liquidity-ratio'] = 1.5;
  weights['debt-equity'] = 1.5;
  weights['locked-entries'] = 1.5;
  weights['duplicate-pieces'] = 1.5;
  weights['operating-margin'] = 1;
  weights['missing-piece-num'] = 1;
  weights['zero-amount-entries'] = 1;

  const scoreMap = { pass: 100, warn: 50, info: 75, fail: 0 };
  let totalWeight = 0;
  let weightedScore = 0;
  checks.forEach(c => {
    const w = weights[c.id] || 1;
    totalWeight += w;
    weightedScore += w * (scoreMap[c.status] || 0);
  });
  const auditScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;

  const passed = checks.filter(c => c.status === 'pass').length;
  const warned = checks.filter(c => c.status === 'warn').length;
  const failed = checks.filter(c => c.status === 'fail').length;

  const recommendations = [];
  checks.filter(c => c.status === 'fail' || c.status === 'warn').forEach(c => {
    if (c.id === 'tva-compliance') recommendations.push('Rapprochez vos déclarations TVA. TVA collectée (43671) et déductible (43666) doivent être déclarées mensuellement.');
    if (c.id === 'balance-check') recommendations.push('Le bilan doit être équilibré. Vérifiez les montants saisis dans les écritures.');
    if (c.id === 'balanced-entries' || c.id === 'journal-balance') recommendations.push('Toute pièce comptable doit être équilibrée (total débit = total crédit). Corrigez les écritures non équilibrées.');
    if (c.id === 'is-provision' && netResult > 0) recommendations.push('Provisionnez l\'IS (15%) via 631000/437000 depuis la vue Déclaration Fiscale.');
    if (c.id === 'retenue-source') recommendations.push('Comptabilisez la retenue à la source (43674) sur les prestations de services.');
    if (c.id === 'locked-entries') recommendations.push('Verrouillez les écritures validées pour éviter les modifications non contrôlées.');
    if (c.id === 'duplicate-pieces') recommendations.push('Évitez les doublons de N° de pièce. Supprimez ou renumérotez les pièces en double.');
    if (c.id === 'missing-piece-num') recommendations.push('Attribuez un N° de pièce à chaque écriture pour assurer la traçabilité.');
    if (c.id === 'zero-amount-entries') recommendations.push('Supprimez les écritures sans montant (débit=0 et crédit=0).');
    if (c.id === 'liquidity-ratio') recommendations.push('Améliorez le ratio de liquidité en réduisant les dettes CT ou augmentant les actifs courants.');
    if (c.id === 'debt-equity') recommendations.push('Réduisez l\'endettement ou augmentez les capitaux propres.');
    if (c.id === 'operating-margin') recommendations.push('La marge nette est faible. Optimisez les charges ou augmentez le chiffre d\'affaires.');
    if (c.id === 'payroll-entries' && c.status === 'info' && payrollBrut === 0) {
      // Only suggest if there's indication payroll should exist
    }
    if (c.id === 'legal-reserve') recommendations.push('Constituer la réserve légale (5% du résultat) au compte 102.');
    if (c.id === 'timbre-fiscal') recommendations.push('Appliquez le timbre fiscal (43675) sur les factures de vente.');
    if (c.id === 'date-chronology') recommendations.push('Les dates d\'écritures ne doivent pas être dans le futur.');
    if (c.id.startsWith('payroll-') && c.status === 'warn') recommendations.push('Comptabilisez les écritures de paie (salaires, CNSS, virement) pour une comptabilité complète.');
  });

  if (auditScore >= 80) recommendations.push('Excellent niveau de conformité comptable. Continuez à tenir vos écritures à jour.');
  else if (auditScore >= 60) recommendations.push('Niveau de conformité acceptable. Quelques points d\'attention à corriger.');
  else recommendations.push('Plusieurs non-conformités détectées. Consultez un expert-comptable agréé OECT.');

  // ── Optimisations fiscales & réduction de charges ──
  const optimizations = [];

  // Analyse des charges par compte
  const chargeAccounts = {};
  for (const e of journal) {
    const c = (e.compte || '').split(' ')[0];
    if (c.startsWith('6')) {
      chargeAccounts[c] = (chargeAccounts[c] || 0) + (e.debit || 0);
    }
  }

  const totalChargesClass6 = Object.values(chargeAccounts).reduce((s, v) => s + v, 0);

  // Top charges
  const sortedCharges = Object.entries(chargeAccounts).sort((a, b) => b[1] - a[1]);
  const topThreeCharges = sortedCharges.slice(0, 3);

  if (totalChargesClass6 > 0) {
    // Réduction des charges générales
    const fraisGest = chargeAccounts['611000'] || 0;
    if (fraisGest > totalChargesClass6 * 0.3) {
      optimizations.push({
        type: 'reduction',
        icon: '📉',
        title: 'Frais généraux élevés',
        detail: `Les frais d'entretien et réparations (611000) représentent ${fmtPct(fraisGest / totalChargesClass6)} des charges totales. Négociez avec les prestataires ou regroupez les achats pour réduire les coûts.`,
        gain: `Économie potentielle : ${fmt(fraisGest * 0.15)}–${fmt(fraisGest * 0.3)}`,
      });
    }

    const honoraires = chargeAccounts['622200'] || 0;
    if (honoraires > 5000) {
      optimizations.push({
        type: 'reduction',
        icon: '📉',
        title: 'Honoraires et conseils élevés',
        detail: `Honoraires (622200) de ${fmt(honoraires)}. Envisagez des abonnements annuels ou des forfaits pour réduire les coûts de conseil juridique/comptable.`,
        gain: `Économie possible : ${fmt(honoraires * 0.1)}–${fmt(honoraires * 0.2)}`,
      });
    }

    const telecom = chargeAccounts['626000'] || 0;
    if (telecom > 3000) {
      optimizations.push({
        type: 'reduction',
        icon: '📉',
        title: 'Frais de télécommunications',
        detail: `Télécommunications (626000) de ${fmt(telecom)}. Comparez les offres opérateurs ou optez pour des forfaits professionnels groupés.`,
        gain: `Économie possible : ${fmt(telecom * 0.2)}–${fmt(telecom * 0.35)}`,
      });
    }

    const transport = chargeAccounts['624000'] || 0;
    if (transport > 5000) {
      optimizations.push({
        type: 'reduction',
        icon: '📉',
        title: 'Frais de transport élevés',
        detail: `Transport (624000) de ${fmt(transport)}. Optimisez les tournées, privilégiez le covoiturage professionnel ou les véhicules électriques (avantage fiscal).`,
        gain: `Économie possible : ${fmt(transport * 0.15)}–${fmt(transport * 0.25)}`,
      });
    }

    const loyer = chargeAccounts['613000'] || 0;
    if (loyer > totalChargesClass6 * 0.2) {
      optimizations.push({
        type: 'reduction',
        icon: '📉',
        title: 'Loyers élevés',
        detail: `Loyers (613000) de ${fmt(loyer)} soit ${fmtPct(loyer / totalChargesClass6)} des charges. Envisagez le télétravail partiel ou la renégociation du bail.`,
        gain: `Économie possible : ${fmt(loyer * 0.1)}–${fmt(loyer * 0.2)}`,
      });
    }

    // Optimisation TVA — déduction
    if (tvaDeductible < tvaCollected * 0.5 && tvaCollected > 100) {
      optimizations.push({
        type: 'fiscal',
        icon: '💰',
        title: 'Optimisation TVA déductible',
        detail: `Votre TVA déductible (${fmt(tvaDeductible)}) est faible par rapport à la TVA collectée (${fmt(tvaCollected)}). Assurez-vous de bien déclarer toutes vos factures d'achats pour réduire la TVA due.`,
        gain: `Gain potentiel : ${fmt(tvaCollected - tvaDeductible - Math.max(0, tvaCollected * 0.5))}`,
      });
    }

    // Avantages fiscaux Tunisie
    optimizations.push({
      type: 'fiscal',
      icon: '⭐',
      title: 'FODEC — Prime d\'investissement',
      detail: `Le Fonds de Développement de la Compétitivité (FODEC) offre des primes d'investissement jusqu'à 30% pour les projets de modernisation, mise à niveau, R&D et innovation. Éligible PME tunisiennes.`,
      gain: 'Prime jusqu\'à 30% du montant investi (plafond 500 000 DT)',
    });

    optimizations.push({
      type: 'fiscal',
      icon: '⭐',
      title: 'Amortissement dégressif — Investissements productifs',
      detail: `Les biens d'équipement (matériel, machines, outillage) peuvent bénéficier de l'amortissement dégressif au lieu du linéaire, ce qui permet de constater une charge plus élevée les premières années et réduire l'IS immédiat.`,
      gain: 'Réduction d\'IS jusqu\'à 35% la 1ʳᵉ année selon le bien',
    });

    optimizations.push({
      type: 'fiscal',
      icon: '⭐',
      title: 'Exonération IS — Entreprises exportatrices',
      detail: `Les entreprises totalement exportatrices bénéficient d'une exonération totale de l'IS pendant 10 ans, suivie d'un taux réduit à 50% du taux en vigueur. Si vous exportez partiellement, l'exonération est proratisée.`,
      gain: 'Exonération totale 10 ans, puis 50% du taux normal',
    });

    optimizations.push({
      type: 'fiscal',
      icon: '⭐',
      title: 'Crédit d\'impôt Recherche & Développement',
      detail: `Les dépenses de R&D (salaires chercheurs, équipements labo, brevets) ouvrent droit à un crédit d'impôt de 50% du montant des dépenses, imputable sur l'IS dû. Plafond annuel : 500 000 DT.`,
      gain: '50% des dépenses R&D en crédit d\'impôt (plafond 500 000 DT)',
    });

    if (payrollBrut > 0) {
      optimizations.push({
        type: 'fiscal',
        icon: '⭐',
        title: 'Formation professionnelle — Déduction fiscale',
        detail: `Les frais de formation du personnel (inscriptions, stages, certification) sont déductibles à 200% du montant engagé (Loi de Finances). Investir dans la formation réduit l'IS tout en améliorant les compétences.`,
        gain: 'Déduction à 200% du montant de la formation',
      });
    }

    // Optimisation masse salariale
    if (payrollBrut > totalChargesClass6 * 0.4) {
      optimizations.push({
        type: 'reduction',
        icon: '📉',
        title: 'Masse salariale prédominante',
        detail: `Les salaires (6411) représentent ${fmtPct(payrollBrut / totalChargesClass6)} des charges. Envisagez le recours à des stagiaires, l'alternance ou la sous-traitance pour les tâches non stratégiques.`,
        gain: `Économie possible : ${fmt(payrollBrut * 0.1)}–${fmt(payrollBrut * 0.2)} en externalisant`,
      });
    }

    // Frais financiers
    const fraisFinanciers = chargeAccounts['660000'] || chargeAccounts['661000'] || chargeAccounts['662000'] || 0;
    if (fraisFinanciers > 3000) {
      optimizations.push({
        type: 'reduction',
        icon: '📉',
        title: 'Frais financiers importants',
        detail: `Frais financiers (66xxx) de ${fmt(fraisFinanciers)}. Renégociez vos lignes de crédit ou regroupez vos dettes pour réduire les intérêts bancaires.`,
        gain: `Économie possible : ${fmt(fraisFinanciers * 0.15)}–${fmt(fraisFinanciers * 0.3)}`,
      });
    }
  }

  // Optimisation structure bilancielle
  if (currentLiabilities > equity * 2 && equity > 0) {
    optimizations.push({
      type: 'structure',
      icon: '📊',
      title: 'Renforcer les capitaux propres',
      detail: `Les dettes CT (${fmt(currentLiabilities)}) sont ${(currentLiabilities / equity).toFixed(1)}× les capitaux propres (${fmt(equity)}). Envisagez une augmentation de capital ou l'intégration de comptes courants d'associés pour assainir la structure financière.`,
      gain: 'Amélioration du ratio d\'endettement et accès au crédit facilité',
    });
  }

  if (cashAndBank > totalChargesClass6 * 3 && totalChargesClass6 > 0) {
    // Could invest excess cash
  }

  // Recommandations d'investissement
  if (netResult > 50000 && (capital < 10000 || reserveLegale === 0)) {
    optimizations.push({
      type: 'investissement',
      icon: '📈',
      title: 'Réinvestir les bénéfices',
      detail: `Résultat net de ${fmt(netResult)}. Envisagez d'investir dans des équipements productifs (amortissables sur 5-10 ans) pour réduire l'IS tout en développant l'outil de travail.`,
      gain: `IS économisé sur investissement : ${fmt(netResult * 0.15)} pour ${fmt(netResult)} réinvesti`,
    });
  }

  return {
    score: auditScore,
    summary: { total: checks.length, passed, warned, failed },
    checks,
    recommendations,
    optimizations,
    stats: {
      entriesCount,
      lockedCount,
      unbalancedCount,
      duplicatePieces,
      tvaCollected,
      tvaDeductible,
      tvaDue,
      rsSolde,
      isProvision: is631,
      payrollBrut,
      totalDebit,
      totalCredit,
      cashAndBank,
      totalCharges: totalChargesClass6,
    },
    companyName: companyDetails?.name || 'Société',
    date: new Date().toISOString().split('T')[0]
  };
};

export const generateAuditMarkdown = (auditResult) => {
  const { score, summary, checks, recommendations, stats, companyName, date } = auditResult;
  const grade = score >= 80 ? '🟢' : score >= 60 ? '🟡' : '🔴';
  const gradeLabel = score >= 80 ? 'Excellent' : score >= 60 ? 'Acceptable' : 'Critique';

  let md = `## Rapport d'Audit Smart-Comptable\n\n`;
  md += `**Société :** ${companyName}  \n`;
  md += `**Date :** ${date}  \n`;
  md += `**Score global :** ${grade} **${score}/100** — ${gradeLabel}\n\n`;

  if (stats) {
    md += `### Statistiques du journal\n\n`;
    md += `- Écritures : **${stats.entriesCount}** (dont ${stats.lockedCount} verrouillées)\n`;
    md += `- Total Débit : **${stats.totalDebit?.toLocaleString('fr-TN', { minimumFractionDigits: 3 })} DT**\n`;
    md += `- Total Crédit : **${stats.totalCredit?.toLocaleString('fr-TN', { minimumFractionDigits: 3 })} DT**\n`;

    if (stats.tvaCollected > 0 || stats.tvaDeductible > 0) {
      md += `- TVA collectée : **${stats.tvaCollected?.toLocaleString('fr-TN', { minimumFractionDigits: 3 })} DT**\n`;
      md += `- TVA déductible : **${stats.tvaDeductible?.toLocaleString('fr-TN', { minimumFractionDigits: 3 })} DT**\n`;
    }
    if (stats.rsSolde) md += `- RS (43674) : **${stats.rsSolde?.toLocaleString('fr-TN', { minimumFractionDigits: 3 })} DT**\n`;
    if (stats.isProvision) md += `- IS provisionné : **${stats.isProvision?.toLocaleString('fr-TN', { minimumFractionDigits: 3 })} DT**\n`;
    if (stats.payrollBrut) md += `- Masse salariale : **${stats.payrollBrut?.toLocaleString('fr-TN', { minimumFractionDigits: 3 })} DT**\n`;
    md += `\n`;
  }

  md += `### Résumé\n\n`;
  md += `- ✅ **${summary.passed}** conformes\n`;
  md += `- ⚠️ **${summary.warned}** avertissements\n`;
  md += `- ❌ **${summary.failed}** non-conformités\n\n`;

  md += `### Détail des contrôles\n\n`;
  md += `| # | Catégorie | Contrôle | Statut | Détail |\n`;
  md += `|---|----------|----------|--------|-------|\n`;
  checks.forEach((c, i) => {
    const icon = c.status === 'pass' ? '✅' : c.status === 'warn' ? '⚠️' : c.status === 'fail' ? '❌' : 'ℹ️';
    const detail = (c.detail || '').replace(/\|/g, '&#124;').replace(/\n/g, ' · ').trim();
    const label = (c.label || '').replace(/\|/g, '&#124;');
    const category = (c.category || '').replace(/\|/g, '&#124;');
    md += `| ${i + 1} | ${category} | ${label} | ${icon} | ${detail} |\n`;
  });
  md += `\n`;

  if (recommendations.length > 0) {
    md += `### Recommandations\n\n`;
    recommendations.forEach(r => { md += `- ${r}\n`; });
  }

  md += `\n---\n`;
  md += `_Rapport généré par Smart-Comptable — Audit basé sur le journal comptable. Validez avec un expert-comptable OECT._`;
  return md;
};

// ─────────────────────────────────────────────
// Legacy audit (old data model)
// ─────────────────────────────────────────────

export const runFullAudit = ({ invoices, expenses, transactions, companyDetails }) => {
  const checks = [];

  const totalRevenue = invoices.reduce((s, inv) => s + (parseFloat(inv.totalAmount) || 0), 0);
  const totalExpenses = expenses.reduce((s, exp) => s + (parseFloat(exp.totalAmount) || 0), 0);
  const netProfit = totalRevenue - totalExpenses;

  if (totalRevenue === 0 && totalExpenses === 0 && (!transactions || transactions.length === 0)) {
    return {
      score: 0,
      summary: { total: 0, passed: 0, warned: 0, failed: 0 },
      checks: [],
      recommendations: ['Ajoutez des factures et dépenses pour générer un audit complet.'],
      optimizations: [],
      stats: { entriesCount: 0, lockedCount: 0, unbalancedCount: 0, duplicatePieces: 0, tvaCollected: 0, tvaDeductible: 0, tvaDue: 0, rsSolde: 0, isProvision: 0, payrollBrut: 0, totalDebit: 0, totalCredit: 0, cashAndBank: 0, totalCharges: 0 },
      companyName: companyDetails?.name || 'Nouvelle société',
      date: new Date().toISOString().split('T')[0]
    };
  }
  const paidRevenue = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + (parseFloat(i.totalAmount) || 0), 0);
  const pendingRevenue = invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + (parseFloat(i.totalAmount) || 0), 0);
  const bankBalance = paidRevenue - totalExpenses;

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

  const estimatedIS = netProfit > 0 ? Math.round(netProfit * 0.15 * 1000) / 1000 : 0;
  checks.push({
    id: 'is-provision',
    category: 'IS',
    label: 'Provision IS (15% — Régime PME)',
    status: netProfit > 0 ? 'pass' : 'info',
    detail: `Résultat net : ${fmt(netProfit)} | IS estimé (15%) : ${fmt(estimatedIS)}`,
    value: estimatedIS
  });

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

  const serviceExpenses = expenses.filter(exp => /service|prestation|honoraire|conseil|commission/i.test(exp.category || ''));
  const rsApplied = serviceExpenses.filter(exp => (exp.rsAmount || exp.retenueSource) > 0);
  const rsPct = serviceExpenses.length > 0 ? (rsApplied.length / serviceExpenses.length) * 100 : 100;
  checks.push({
    id: 'retenue-source',
    category: 'RS',
    label: 'Retenue à la Source sur Prestations',
    status: rsPct >= 80 ? 'pass' : rsPct >= 50 ? 'warn' : 'fail',
    detail: `${rsApplied.length}/${serviceExpenses.length} prestations avec RS appliquée (${Math.round(rsPct)}%)`,
    value: rsPct
  });

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

  const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  checks.push({
    id: 'operating-margin',
    category: 'Ratios',
    label: 'Marge Nette',
    status: margin >= 10 ? 'pass' : margin >= 3 ? 'warn' : 'fail',
    detail: `Marge : ${margin.toFixed(1)}% (seuil : ≥ 10%)`,
    value: margin
  });

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

  const weights = {
    'tva-compliance': 3, 'is-provision': 2, 'cnss-provision': 1, 'timbre-fiscal': 2,
    'retenue-source': 2, 'missing-mf': 2, 'bank-reconciliation': 2, 'liquidity-ratio': 1.5,
    'debt-equity': 1.5, 'operating-margin': 1, 'anomalies': 2, 'balance-check': 1,
    'tva-rates': 1, 'overdue': 1.5, 'sce-mapping': 0.5
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

  const passed = checks.filter(c => c.status === 'pass').length;
  const warned = checks.filter(c => c.status === 'warn').length;
  const failed = checks.filter(c => c.status === 'fail').length;

  const recommendations = [];
  if (failed > 0 || warned > 0) {
    const critical = checks.filter(c => c.status === 'fail');
    critical.forEach(c => {
      if (c.id === 'tva-compliance') recommendations.push('Rapprochez vos déclarations TVA avec les relevés bancaires.');
      if (c.id === 'timbre-fiscal') recommendations.push('Apposez le timbre fiscal (1 DT par facture) sur toutes les factures de vente.');
      if (c.id === 'missing-mf') recommendations.push('Exigez le MF de tous vos fournisseurs pour déduire la TVA.');
      if (c.id === 'bank-reconciliation') recommendations.push('Effectuez le lettrage des transactions bancaires.');
      if (c.id === 'liquidity-ratio') recommendations.push('Améliorez le ratio de liquidité.');
      if (c.id === 'debt-equity') recommendations.push('Réduisez l\'endettement ou augmentez les capitaux propres.');
      if (c.id === 'anomalies') recommendations.push('Vérifiez les montants inhabituels signalés.');
      if (c.id === 'retenue-source') recommendations.push('Appliquez la RS sur toutes les prestations de services.');
      if (c.id === 'overdue') recommendations.push('Relancez les clients avec des factures échues.');
      if (c.id === 'sce-mapping') recommendations.push('Mappez les catégories manquantes au plan SCE.');
    });
  }
  if (auditScore >= 80) recommendations.push('Excellent niveau de conformité.');
  else if (auditScore >= 60) recommendations.push('Niveau de conformité acceptable.');
  else recommendations.push('Plusieurs non-conformités critiques détectées.');

  return {
    score: auditScore,
    summary: { total: checks.length, passed, warned, failed },
    checks, recommendations,
    companyName: companyDetails?.name || 'Société',
    date: new Date().toISOString().split('T')[0]
  };
};
