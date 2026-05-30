import ExcelJS from 'exceljs';
import { getFinancialExportData } from './accountingUtils';

const DARK = 'FF1a1a2e';
const WHITE = 'FFFFFFFF';
const LIGHT_BG = 'FFF5F5FA';
const GREEN = 'FF10b981';
const RED = 'FFef4444';
const GRAY = 'FF64748b';
const BORDER = 'FFCBD5E1';

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function applyBorder(cell, opts = {}) {
  const { top, bottom, left, right } = opts;
  cell.border = {
    top: top || { style: 'thin', color: { argb: BORDER } },
    bottom: bottom || { style: 'thin', color: { argb: BORDER } },
    left: left || { style: 'thin', color: { argb: BORDER } },
    right: right || { style: 'thin', color: { argb: BORDER } }
  };
}

function applyFill(cell, color) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
}

function writeTitle(ws, row, text, cols) {
  ws.mergeCells(1, 1, row, cols);
  const c = ws.getCell(row, 1);
  c.value = text;
  c.font = { bold: true, size: 14, color: { argb: WHITE }, name: 'Arial' };
  applyFill(c, DARK);
  c.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(row).height = 32;
}

function writeSubtitle(ws, row, text, cols) {
  ws.mergeCells(1, 1, row, cols);
  const c = ws.getCell(row, 1);
  c.value = text;
  c.font = { italic: true, size: 9, color: { argb: GRAY }, name: 'Arial' };
  c.alignment = { horizontal: 'center' };
}

function writeHeaderRow(ws, row, labels) {
  const r = ws.getRow(row);
  labels.forEach((l, i) => {
    const c = r.getCell(i + 1);
    c.value = l;
    c.font = { bold: true, color: { argb: WHITE }, size: 10, name: 'Arial' };
    applyFill(c, DARK);
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    applyBorder(c);
  });
  r.height = 22;
}

function writeDataRow(ws, row, col, label, value, isBold = false, formula = null) {
  const r = ws.getRow(row);
  const lc = r.getCell(col);
  lc.value = label;
  lc.font = { bold: isBold, size: 10, color: { argb: DARK }, name: 'Arial' };
  if (isBold) applyFill(lc, LIGHT_BG);
  applyBorder(lc);

  const vc = r.getCell(col + 1);
  if (formula) {
    vc.value = { formula: formula };
  } else if (value !== null && value !== undefined) {
    vc.value = value;
  }
  vc.numFmt = '#,##0.000';
  vc.alignment = { horizontal: 'right', vertical: 'middle' };
  const clr = (typeof value === 'number' && value < 0) ? RED : DARK;
  vc.font = { bold: isBold, size: isBold ? 11 : 10, color: { argb: clr }, name: 'Arial' };
  if (isBold) applyFill(vc, LIGHT_BG);
  applyBorder(vc);
  r.height = 18;
}

function writeTotalRow(ws, row, col, label, formulaOrVal) {
  const r = ws.getRow(row);
  const lc = r.getCell(col);
  lc.value = label;
  lc.font = { bold: true, size: 11, color: { argb: DARK }, name: 'Arial' };
  applyFill(lc, 'FFE0E7FF');
  applyBorder(lc, { top: { style: 'medium', color: { argb: DARK } }, bottom: { style: 'medium', color: { argb: DARK } } });

  const vc = r.getCell(col + 1);
  if (typeof formulaOrVal === 'string' && formulaOrVal.startsWith('=')) {
    vc.value = { formula: formulaOrVal.substring(1) };
  } else {
    vc.value = formulaOrVal;
  }
  vc.numFmt = '#,##0.000';
  vc.alignment = { horizontal: 'right', vertical: 'middle' };
  vc.font = { bold: true, size: 11, color: { argb: DARK }, name: 'Arial' };
  applyFill(vc, 'FFE0E7FF');
  applyBorder(vc, { top: { style: 'medium', color: { argb: DARK } }, bottom: { style: 'medium', color: { argb: DARK } } });
  r.height = 22;
}

async function buildBilanSheet(wb, data) {
  const ws = wb.addWorksheet('Bilan');
  const bs = data.balanceSheet;
  const { intangible, tangible } = bs.assets.nonCurrent;
  const { receivables, cashAndBank } = bs.assets.current;
  const { socialCapital, legalReserve, retainedEarnings } = bs.equity;
  const { bankLoans } = bs.liabilities.nonCurrent;
  const { accountsPayable, taxPayable } = bs.liabilities.current;

  writeTitle(ws, 1, `BILAN — ${data.company.name} — Exercice ${new Date().getFullYear()}`, 4);
  writeSubtitle(ws, 2, `Généré le ${todayStr()} · MF: ${data.company.mf}`, 4);
  ws.getRow(3).height = 6;

  writeHeaderRow(ws, 4, ['ACTIF', 'Montant', 'PASSIF & CAPITAUX PROPRES', 'Montant']);

  /* ACTIF side (col A-B) */
  writeDataRow(ws, 5, 1, 'Immobilisations incorporelles', intangible);
  writeDataRow(ws, 6, 1, 'Immobilisations corporelles', tangible);
  writeDataRow(ws, 7, 1, 'Actifs Non Courants', null, true, 'SUM(B5:B6)');
  writeDataRow(ws, 8, 1, 'Créances clients', receivables);
  writeDataRow(ws, 9, 1, 'Trésorerie', cashAndBank);
  writeDataRow(ws, 10, 1, 'Actifs Courants', null, true, 'SUM(B8:B9)');
  writeTotalRow(ws, 11, 1, 'TOTAL ACTIFS', '=B7+B10');

  /* PASSIF side (col C-D) */
  writeDataRow(ws, 5, 3, 'Capital social', socialCapital);
  writeDataRow(ws, 6, 3, 'Réserves légales', legalReserve);
  writeDataRow(ws, 7, 3, 'Résultat net', retainedEarnings);
  writeDataRow(ws, 8, 3, 'Capitaux Propres', null, true, 'SUM(D5:D7)');
  writeDataRow(ws, 9, 3, 'Emprunts bancaires', bankLoans);
  writeDataRow(ws, 10, 3, 'Passifs Non Courants', null, true, 'D9');
  writeDataRow(ws, 11, 3, 'Dettes fournisseurs', accountsPayable);
  writeDataRow(ws, 12, 3, 'Dettes fiscales (IS)', taxPayable);
  writeDataRow(ws, 13, 3, 'Passifs Courants', null, true, 'SUM(D11:D12)');
  writeTotalRow(ws, 14, 3, 'TOTAL PASSIFS & CP', '=D8+D10+D13');

  /* Control row */
  const cr = 16;
  ws.mergeCells(1, 1, cr, 4);
  const cc = ws.getCell(cr, 1);
  cc.value = { formula: 'IF(ABS(B11-D14)<0.01,"✓ Bilan équilibré (Actif = Passif + CP)","✗ Bilan déséquilibré")' };
  cc.font = { bold: true, size: 10, color: { argb: GREEN }, name: 'Arial' };
  cc.alignment = { horizontal: 'center' };

  /* Protection: lock all cells, then unlock data-entry cells */
  ws.protect('', { selectLockedCells: true, selectUnlockedCells: true });
  [5,6,8,9].forEach(r => { ws.getCell(r, 2).protection = { locked: false }; });
  [5,6,7,9,11,12].forEach(r => { ws.getCell(r, 4).protection = { locked: false }; });

  ws.getColumn(1).width = 34;
  ws.getColumn(2).width = 18;
  ws.getColumn(3).width = 34;
  ws.getColumn(4).width = 18;
  ws.views = [{ state: 'frozen', ySplit: 4 }];
}

async function buildResultatSheet(wb, data) {
  const ws = wb.addWorksheet('État de résultat');
  const is = data.incomeStatement;

  writeTitle(ws, 1, `ÉTAT DE RÉSULTAT — ${data.company.name} — Exercice ${new Date().getFullYear()}`, 2);
  writeSubtitle(ws, 2, `Généré le ${todayStr()}`, 2);
  ws.getRow(3).height = 6;

  writeHeaderRow(ws, 4, ['Rubrique', 'Montant']);

  const items = [
    ['Produits d\'exploitation', is.revenue, false, null],
    ['Charges d\'exploitation', is.operatingExpenses, false, null],
    ['Résultat d\'exploitation', null, true, 'B5-B6'],
    ['Produits financiers', 0, false, null],
    ['Charges financières', 0, false, null],
    ['Résultat des activités ordinaires', null, true, 'B7+B8-B9'],
    ['Impôt sur les sociétés (15%)', is.tax, false, null],
    ['RÉSULTAT NET DE L\'EXERCICE', null, true, 'B10-B11'],
  ];

  items.forEach(([label, val, isTotal, formula], i) => {
    const r = 5 + i;
    writeDataRow(ws, r, 1, label, val, isTotal, formula);
    if (isTotal && r === 12) {
      const vc = ws.getCell(r, 2);
      vc.font = { bold: true, size: 11, color: { argb: is.netProfit >= 0 ? GREEN : RED }, name: 'Arial' };
    }
  });

  ws.protect('');
  ws.getColumn(1).width = 40;
  ws.getColumn(2).width = 22;
  ws.views = [{ state: 'frozen', ySplit: 4 }];
}

async function buildBruteDataSheet(wb, invoices, expenses, transactions) {
  const ws = wb.addWorksheet('Données brutes');
  writeTitle(ws, 1, 'BALANCE DES COMPTES — DONNÉES BRUTES', 5);
  ws.getRow(2).height = 6;

  let r = 3;
  const sections = [
    ['FACTURES CLIENTS', ['N° Facture', 'Client', 'Date', 'HT', 'TTC'],
      invoices.map(inv => [inv.invoiceNumber || '', inv.clientName || '', inv.issueDate || '', inv.subtotal || 0, inv.totalAmount || 0])],
    ['CHARGES / DÉPENSES', ['Fournisseur', 'Catégorie', 'Date', 'HT', 'TTC'],
      expenses.map(exp => [exp.supplier || '', exp.category || '', exp.date || '', exp.subtotal || 0, exp.totalAmount || 0])],
    ['TRANSACTIONS BANCAIRES', ['Date', 'Description', 'Type', 'Montant', ''],
      transactions.map(tx => [tx.date || '', tx.description || '', tx.type || '', tx.amount || 0, ''])]
  ];

  for (const [title, headers, data] of sections) {
    const sr = ws.getRow(r);
    sr.getCell(1).value = title;
    sr.getCell(1).font = { bold: true, size: 11, color: { argb: DARK }, name: 'Arial' };
    sr.getCell(1).alignment = { vertical: 'middle' };
    applyFill(sr.getCell(1), LIGHT_BG);
    for (let c = 2; c <= 5; c++) applyFill(sr.getCell(c), LIGHT_BG);
    sr.height = 24;
    r++;
    writeHeaderRow(ws, r, headers);
    r++;
    for (const rowData of data) {
      const row = ws.getRow(r);
      rowData.forEach((val, i) => {
        const c = row.getCell(i + 1);
        c.value = val;
        c.font = { size: 10, name: 'Arial' };
        applyBorder(c);
        if (typeof val === 'number') { c.numFmt = '#,##0.000'; c.alignment = { horizontal: 'right' }; }
      });
      row.height = 18;
      r++;
    }
    r++;
  }

  ws.getColumn(1).width = 24;
  ws.getColumn(2).width = 26;
  ws.getColumn(3).width = 14;
  ws.getColumn(4).width = 16;
  ws.getColumn(5).width = 16;
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

async function buildRatiosSheet(wb, data) {
  const ws = wb.addWorksheet('Ratios');
  writeTitle(ws, 1, `RATIOS FINANCIERS — ${data.company.name} — ${new Date().getFullYear()}`, 3);
  ws.getRow(2).height = 6;
  writeHeaderRow(ws, 3, ['Ratio', 'Valeur', 'Interprétation']);

  const rs = data.ratios;
  const ratios = [
    ['Liquidité Générale', rs.liquidityRatio, rs.liquidityRatio > 1 ? 'Favorable (>1)' : 'À surveiller (<1)'],
    ['Dettes / Capitaux Propres', rs.debtToEquity, rs.debtToEquity < 1 ? 'Faible endettement' : 'Endettement élevé'],
    ['ROE (Return on Equity)', `${rs.roe}%`, rs.roe > 10 ? 'Bonne rentabilité' : 'Rentabilité faible'],
    ['ROA (Return on Assets)', `${rs.roa}%`, rs.roa > 5 ? 'Bonne efficacité' : 'Efficacité faible'],
    ['Marge Nette', `${rs.netMargin}%`, rs.netMargin > 10 ? 'Bonne marge' : 'Marge faible'],
    ['Marge Brute', `${rs.grossMargin}%`, rs.grossMargin > 30 ? 'Bonne marge brute' : 'Marge brute faible'],
    ['Autonomie Financière', `${rs.financialAutonomy}%`, rs.financialAutonomy > 30 ? 'Bonne autonomie' : 'Dépendance financière'],
    ['Couverture des Intérêts', 'N/A', 'Nécessite données bancaires détaillées'],
  ];

  ratios.forEach(([label, val, interp], i) => {
    const r = 4 + i;
    const row = ws.getRow(r);
    [1, 2, 3].forEach(c => {
      row.getCell(c).font = { size: 10, name: 'Arial', color: { argb: DARK } };
      applyBorder(row.getCell(c));
    });
    row.getCell(1).value = label;
    row.getCell(2).value = val;
    row.getCell(2).font = { bold: true, size: 10, name: 'Arial' };
    row.getCell(3).value = interp;
    row.height = 20;
  });

  ws.getColumn(1).width = 32;
  ws.getColumn(2).width = 22;
  ws.getColumn(3).width = 38;
  ws.views = [{ state: 'frozen', ySplit: 3 }];
}

function download(buf, name) {
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportToExcel(invoices, expenses, transactions, companyDetails) {
  const data = getFinancialExportData(invoices, expenses, transactions, companyDetails);
  const wb = new ExcelJS.Workbook();
  await buildBilanSheet(wb, data);
  await buildResultatSheet(wb, data);
  await buildBruteDataSheet(wb, invoices, expenses, transactions);
  await buildRatiosSheet(wb, data);
  download(await wb.xlsx.writeBuffer(),
    `EtatsFinanciers_${(companyDetails.name || 'Societe').replace(/\s+/g, '_')}_${new Date().getFullYear()}.xlsx`);
}

export async function exportBilanExcel(invoices, expenses, transactions, companyDetails) {
  const data = getFinancialExportData(invoices, expenses, transactions, companyDetails);
  const wb = new ExcelJS.Workbook();
  await buildBilanSheet(wb, data);
  download(await wb.xlsx.writeBuffer(),
    `Bilan_${(companyDetails.name || 'Societe').replace(/\s+/g, '_')}_${new Date().getFullYear()}.xlsx`);
}

export async function exportResultatExcel(invoices, expenses, transactions, companyDetails) {
  const data = getFinancialExportData(invoices, expenses, transactions, companyDetails);
  const wb = new ExcelJS.Workbook();
  await buildResultatSheet(wb, data);
  download(await wb.xlsx.writeBuffer(),
    `Resultat_${(companyDetails.name || 'Societe').replace(/\s+/g, '_')}_${new Date().getFullYear()}.xlsx`);
}
