import * as XLSX from 'xlsx';
import { formatCurrencyHelper, calculateFinancialRatios, getFinancialExportData } from './accountingUtils';

function fmt(val, currency = 'TND') {
  return formatCurrencyHelper(val, currency);
}

function buildBilanSheet(data) {
  const rows = [];
  rows.push(['BILAN (État de la Situation Financière)', '', '', '']);
  rows.push(['Société:', data.company.name, 'MF:', data.company.mf]);
  rows.push(['Exercice:', new Date().getFullYear(), 'Date arrêté:', new Date().toLocaleDateString('fr-TN')]);
  rows.push([]);
  rows.push(['ACTIF', 'Montant', 'PASSIF & CP', 'Montant']);
  rows.push(['Actifs Non Courants (Classe 2)', fmt(data.balanceSheet.assets.nonCurrent, data.company.currency), 'Capitaux Propres (Classe 1)', fmt(data.balanceSheet.equity, data.company.currency)]);
  rows.push(['Actifs Courants (Classe 3, 4, 5)', fmt(data.balanceSheet.assets.current, data.company.currency), 'Passifs Non Courants', fmt(data.balanceSheet.liabilities.nonCurrent, data.company.currency)]);
  rows.push(['', '', 'Passifs Courants', fmt(data.balanceSheet.liabilities.current, data.company.currency)]);
  rows.push(['Total Actifs', fmt(data.balanceSheet.assets.total, data.company.currency), 'Total Passifs & CP', fmt(data.balanceSheet.totalLiabilitiesAndEquity, data.company.currency)]);
  rows.push([]);
  rows.push(['Contrôle: Actif = Passif + CP ?', data.balanceSheet.assets.total === data.balanceSheet.totalLiabilitiesAndEquity ? 'ÉQUILIBRÉ ✓' : 'DÉSÉQUILIBRE ✗', '', '']);
  return XLSX.utils.aoa_to_sheet(rows);
}

function buildResultatSheet(data) {
  const rows = [];
  rows.push(['ÉTAT DE RÉSULTAT', '', '']);
  rows.push(['Société:', data.company.name, '']);
  rows.push(['Exercice:', new Date().getFullYear(), '']);
  rows.push([]);
  rows.push(['Rubrique', 'Montant', '']);
  rows.push(['Produits d\'exploitation', fmt(data.incomeStatement.revenue, data.company.currency), '']);
  rows.push(['Charges d\'exploitation', fmt(data.incomeStatement.operatingExpenses, data.company.currency), '']);
  rows.push(['Résultat d\'exploitation', fmt(data.incomeStatement.operatingProfit, data.company.currency), '']);
  rows.push(['Produits financiers', '0', '']);
  rows.push(['Charges financières', '0', '']);
  rows.push(['Résultat des activités ordinaires', fmt(data.incomeStatement.ordinaryProfit, data.company.currency), '']);
  rows.push(['Impôt sur les sociétés (15%)', `-${fmt(data.incomeStatement.tax, data.company.currency)}`, '']);
  rows.push(['RÉSULTAT NET DE L\'EXERCICE', fmt(data.incomeStatement.netProfit, data.company.currency), '']);
  return XLSX.utils.aoa_to_sheet(rows);
}

function buildBruteDataSheet(invoices, expenses, transactions) {
  const rows = [];
  rows.push(['BALANCE DES COMPTES - DONNÉES BRUTES', '', '', '', '']);
  rows.push([]);
  rows.push(['FACTURES CLIENTS', '', '', '', '']);
  rows.push(['N° Facture', 'Client', 'Date', 'HT', 'TTC']);
  invoices.forEach(inv => {
    rows.push([inv.invoiceNumber || '', inv.clientName || '', inv.issueDate || '', inv.subtotal || 0, inv.totalAmount || 0]);
  });
  rows.push([]);
  rows.push(['CHARGES / DÉPENSES', '', '', '', '']);
  rows.push(['Fournisseur', 'Catégorie', 'Date', 'HT', 'TTC']);
  expenses.forEach(exp => {
    rows.push([exp.supplier || '', exp.category || '', exp.date || '', exp.subtotal || 0, exp.totalAmount || 0]);
  });
  rows.push([]);
  rows.push(['TRANSACTIONS BANCAIRES', '', '', '', '']);
  rows.push(['Date', 'Description', 'Type', 'Montant', '']);
  transactions.forEach(tx => {
    rows.push([tx.date || '', tx.description || '', tx.type || '', tx.amount || 0, '']);
  });
  return XLSX.utils.aoa_to_sheet(rows);
}

function buildRatiosSheet(data) {
  const rs = data.ratios;
  const rows = [];
  rows.push(['RATIOS FINANCIERS', '', '']);
  rows.push(['Société:', data.company.name, '']);
  rows.push(['Exercice:', new Date().getFullYear(), '']);
  rows.push([]);
  rows.push(['Ratio', 'Valeur', 'Interprétation']);
  rows.push(['Liquidité Générale', rs.liquidityRatio, rs.liquidityRatio > 1 ? 'Favorable (>1)' : 'À surveiller (<1)']);
  rows.push(['Ratio Dettes / Capitaux Propres', rs.debtToEquity, rs.debtToEquity < 1 ? 'Faible endettement' : 'Endettement élevé']);
  rows.push(['ROE (Return on Equity)', `${rs.roe}%`, rs.roe > 10 ? 'Bonne rentabilité' : 'Rentabilité faible']);
  rows.push(['ROA (Return on Assets)', `${rs.roa}%`, rs.roa > 5 ? 'Bonne efficacité' : 'Efficacité faible']);
  rows.push(['Marge Nette', `${rs.netMargin}%`, rs.netMargin > 10 ? 'Bonne marge' : 'Marge faible']);
  rows.push(['Marge Brute', `${rs.grossMargin}%`, rs.grossMargin > 30 ? 'Bonne marge brute' : 'Marge brute faible']);
  rows.push(['Autonomie Financière', `${rs.financialAutonomy}%`, rs.financialAutonomy > 30 ? 'Bonne autonomie' : 'Dépendance financière']);
  rows.push(['Couverture des Intérêts', 'N/A', 'Nécessite données bancaires détaillées']);
  return XLSX.utils.aoa_to_sheet(rows);
}

export function exportToExcel(invoices, expenses, transactions, companyDetails) {
  const data = getFinancialExportData(invoices, expenses, transactions, companyDetails);
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, buildBilanSheet(data), 'Bilan');
  XLSX.utils.book_append_sheet(wb, buildResultatSheet(data), 'État de résultat');
  XLSX.utils.book_append_sheet(wb, buildBruteDataSheet(invoices, expenses, transactions), 'Données brutes');
  XLSX.utils.book_append_sheet(wb, buildRatiosSheet(data), 'Ratios');

  XLSX.writeFile(wb, `EtatsFinanciers_${(companyDetails.name || 'Societe').replace(/\s+/g, '_')}_${new Date().getFullYear()}.xlsx`);
}

export function exportBilanExcel(invoices, expenses, transactions, companyDetails) {
  const data = getFinancialExportData(invoices, expenses, transactions, companyDetails);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildBilanSheet(data), 'Bilan');
  XLSX.writeFile(wb, `Bilan_${(companyDetails.name || 'Societe').replace(/\s+/g, '_')}_${new Date().getFullYear()}.xlsx`);
}

export function exportResultatExcel(invoices, expenses, transactions, companyDetails) {
  const data = getFinancialExportData(invoices, expenses, transactions, companyDetails);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildResultatSheet(data), 'État de résultat');
  XLSX.writeFile(wb, `Resultat_${(companyDetails.name || 'Societe').replace(/\s+/g, '_')}_${new Date().getFullYear()}.xlsx`);
}
