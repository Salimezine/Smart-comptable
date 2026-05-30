import ExcelJS from 'exceljs';
import { getFinancialExportData } from './accountingUtils';

const DARK = 'FF1a1a2e';
const WHITE = 'FFFFFFFF';
const LIGHT_BG = 'FFF5F5FA';
const GREEN = 'FF10b981';
const RED = 'FFef4444';
const GRAY = 'FF64748b';
const BORDER = 'FFCBD5E1';
const SECTION_FILL = 'FF1e293b';

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
  c.font = { bold: true, size: 13, color: { argb: WHITE }, name: 'Arial' };
  applyFill(c, DARK);
  c.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(row).height = 30;
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

function writeDataRow(ws, row, col, label, value, isBold = false, formula = null, indent = 0) {
  const r = ws.getRow(row);
  const lc = r.getCell(col);
  lc.value = label;
  lc.font = { bold: isBold, size: indent > 0 && !isBold ? 9 : 10, color: { argb: DARK }, name: 'Arial' };
  if (isBold) applyFill(lc, LIGHT_BG);
  applyBorder(lc);
  lc.alignment = { horizontal: 'left', vertical: 'middle', indent: indent };

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
  r.height = 17;
}

function writeSectionRow(ws, row, col, text, cols) {
  const r = ws.getRow(row);
  ws.mergeCells(col, 1, row, cols || 2);
  const c = r.getCell(col);
  c.value = text;
  c.font = { bold: true, size: 10, color: { argb: WHITE }, name: 'Arial' };
  applyFill(c, SECTION_FILL);
  applyBorder(c);
  if (cols > 2) {
    for (let i = col + 1; i <= cols; i++) {
      applyFill(r.getCell(i), SECTION_FILL);
      applyBorder(r.getCell(i));
    }
  }
  r.height = 20;
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

  writeTitle(ws, 1, `BILAN SCE — ${data.company.name} — Exercice ${new Date().getFullYear()}`, 4);
  writeSubtitle(ws, 2, `Généré le ${todayStr()} · MF: ${data.company.mf}`, 4);
  ws.getRow(3).height = 4;

  writeHeaderRow(ws, 4, ['ACTIFS', 'Montant', 'PASSIFS & CAPITAUX PROPRES', 'Montant']);

  let r = 5;

  /* --- ACTIF --- */
  writeSectionRow(ws, r, 1, 'ACTIFS NON COURANTS', 2);
  const actifStart = r; r++;
  writeDataRow(ws, r, 1, '  Frais de développement', bs.assets.nonCurrent.intangibleDetail.devCosts, false, null, 1); r++;
  writeDataRow(ws, r, 1, '  Brevets, licences, marques', bs.assets.nonCurrent.intangibleDetail.patents, false, null, 1); r++;
  writeDataRow(ws, r, 1, '  Fonds commercial', bs.assets.nonCurrent.intangibleDetail.goodwill, false, null, 1); r++;
  writeDataRow(ws, r, 1, '  Immobilisations incorporelles', bs.assets.nonCurrent.intangible, true); r++;
  writeDataRow(ws, r, 1, '  Terrains', bs.assets.nonCurrent.tangibleDetail.land, false, null, 1); r++;
  writeDataRow(ws, r, 1, '  Constructions', bs.assets.nonCurrent.tangibleDetail.buildings, false, null, 1); r++;
  writeDataRow(ws, r, 1, '  Installations techniques', bs.assets.nonCurrent.tangibleDetail.equipment, false, null, 1); r++;
  writeDataRow(ws, r, 1, '  Matériel de transport', bs.assets.nonCurrent.tangibleDetail.transport, false, null, 1); r++;
  writeDataRow(ws, r, 1, '  Mobilier & matériel de bureau', bs.assets.nonCurrent.tangibleDetail.officeEquip, false, null, 1); r++;
  writeDataRow(ws, r, 1, '  Immobilisations corporelles', bs.assets.nonCurrent.tangible, true); r++;
  writeDataRow(ws, r, 1, '  Immobilisations financières', bs.assets.nonCurrent.financial, false); r++;
  writeTotalRow(ws, r, 1, 'TOTAL ACTIFS NON COURANTS', `=B${actifStart + 3}+B${actifStart + 10}+B${r - 1}`); r++;

  r++;
  writeSectionRow(ws, r, 1, 'ACTIFS COURANTS', 2);
  const actifCourantStart = r; r++;
  writeDataRow(ws, r, 1, '  Marchandises', bs.assets.current.stockDetail.merchandise, false, null, 1); r++;
  writeDataRow(ws, r, 1, '  Matières premières', bs.assets.current.stockDetail.rawMaterials, false, null, 1); r++;
  writeDataRow(ws, r, 1, '  Stocks', bs.assets.current.stocks, true); r++;
  writeDataRow(ws, r, 1, '  Clients et comptes rattachés', bs.assets.current.receivables, false); r++;
  writeDataRow(ws, r, 1, '  Personnel', bs.assets.current.personnelRec, false); r++;
  writeDataRow(ws, r, 1, '  État et collectivités', bs.assets.current.taxRec, false); r++;
  writeDataRow(ws, r, 1, '  Autres débiteurs', bs.assets.current.otherRec, false); r++;
  writeDataRow(ws, r, 1, '  Banque', bs.assets.current.cashAndBank, false); r++;
  writeDataRow(ws, r, 1, '  Caisse', bs.assets.current.cashRegister, false); r++;
  writeTotalRow(ws, r, 1, 'TOTAL ACTIFS COURANTS', `=B${actifCourantStart + 3}+B${actifCourantStart + 4}+B${actifCourantStart + 5}+B${actifCourantStart + 6}+B${actifCourantStart + 7}+B${actifCourantStart + 8}+B${actifCourantStart + 9}`); r++;
  r++;
  const totalActifRow = r;
  writeTotalRow(ws, r, 1, 'TOTAL ACTIFS', '='); r++;

  /* --- PASSIF --- */
  r = 5;
  writeSectionRow(ws, r, 3, 'CAPITAUX PROPRES', 4);
  const cpStart = r; r++;
  writeDataRow(ws, r, 3, '  Capital social', bs.equity.socialCapital, false, null, 1); r++;
  writeDataRow(ws, r, 3, '  Réserves légales', bs.equity.legalReserve, false, null, 1); r++;
  writeDataRow(ws, r, 3, '  Autres réserves', bs.equity.otherReserves, false, null, 1); r++;
  writeDataRow(ws, r, 3, '  Résultat net de l\'exercice', bs.equity.retainedEarnings, false, null, 1); r++;
  writeTotalRow(ws, r, 3, 'TOTAL CAPITAUX PROPRES', `=D${cpStart+1}+D${cpStart+2}+D${cpStart+3}+D${cpStart+4}`); r++;

  r++;
  writeSectionRow(ws, r, 3, 'PASSIFS NON COURANTS', 4);
  const pncStart = r; r++;
  writeDataRow(ws, r, 3, '  Emprunts bancaires', bs.liabilities.nonCurrent.bankLoans, false, null, 1); r++;
  writeDataRow(ws, r, 3, '  Provisions', bs.liabilities.nonCurrent.provisions, false, null, 1); r++;
  writeTotalRow(ws, r, 3, 'TOTAL PASSIFS NON COURANTS', `=D${pncStart+1}+D${pncStart+2}`); r++;

  r++;
  writeSectionRow(ws, r, 3, 'PASSIFS COURANTS', 4);
  const pcStart = r; r++;
  writeDataRow(ws, r, 3, '  Fournisseurs et comptes rattachés', bs.liabilities.current.accountsPayable, false, null, 1); r++;
  writeDataRow(ws, r, 3, '  Personnel', bs.liabilities.current.personnelPayable, false, null, 1); r++;
  writeDataRow(ws, r, 3, '  État — Impôt sur les sociétés', bs.liabilities.current.taxPayable, false, null, 1); r++;
  writeDataRow(ws, r, 3, '  État — TVA due', bs.liabilities.current.vatPayable, false, null, 1); r++;
  writeDataRow(ws, r, 3, '  Autres dettes', bs.liabilities.current.otherPayables, false, null, 1); r++;
  writeDataRow(ws, r, 3, '  Concours bancaires', bs.liabilities.current.bankOverdraft, false, null, 1); r++;
  writeTotalRow(ws, r, 3, 'TOTAL PASSIFS COURANTS', `=D${pcStart+1}+D${pcStart+2}+D${pcStart+3}+D${pcStart+4}+D${pcStart+5}+D${pcStart+6}`); r++;
  r++;
  writeTotalRow(ws, r, 3, 'TOTAL PASSIFS & CAPITAUX PROPRES', '='); r++;

  /* Control */
  const cr = Math.max(r + 1, totalActifRow + 2);
  ws.mergeCells(1, 1, cr, 4);
  const cc = ws.getCell(cr, 1);
  cc.value = { formula: `IF(ABS(B${totalActifRow}-D${cr - 1})<0.01,"✓ Bilan équilibré (Actif = Passif + CP)","✗ Bilan déséquilibré")` };
  cc.font = { bold: true, size: 10, color: { argb: GREEN }, name: 'Arial' };
  cc.alignment = { horizontal: 'center' };

  ws.protect('', { selectLockedCells: true, selectUnlockedCells: true });

  ws.getColumn(1).width = 36;
  ws.getColumn(2).width = 18;
  ws.getColumn(3).width = 36;
  ws.getColumn(4).width = 18;
  ws.views = [{ state: 'frozen', ySplit: 4 }];
}

async function buildResultatSheet(wb, data) {
  const ws = wb.addWorksheet('État de résultat');
  const is = data.incomeStatement;

  writeTitle(ws, 1, `ÉTAT DE RÉSULTAT SCE — ${data.company.name} — Exercice ${new Date().getFullYear()}`, 2);
  writeSubtitle(ws, 2, `Généré le ${todayStr()}`, 2);
  ws.getRow(3).height = 4;

  writeHeaderRow(ws, 4, ['Rubrique', 'Montant']);

  let r = 5;
  const items = [];

  /* Produits d'exploitation */
  items.push(['PRODUITS D\'EXPLOITATION', null, 'section']);
  items.push(['  Ventes de marchandises', is.productSales, 'data']);
  items.push(['  Prestations de services', is.serviceRevenue, 'data']);
  items.push(['  Autres produits', is.otherRevenue, 'data']);
  items.push(['Total Produits d\'exploitation', null, 'total', 'SUM(B' + (r + 1) + ':B' + (r + 3) + ')']);
  r += 5;

  items.push(['CHARGES D\'EXPLOITATION', null, 'section']);
  items.push(['  Achats de marchandises', is.purchaseGoods, 'data']);
  items.push(['  Achats de matières premières', is.purchaseRaw, 'data']);
  items.push(['  Autres achats et charges externes', is.otherPurchases, 'data']);
  items.push(['  Charges de personnel', is.personnelCosts, 'data']);
  items.push(['  Dotations aux amortissements', is.depreciation, 'data']);
  items.push(['  Autres charges d\'exploitation', is.otherOpCharges, 'data']);
  items.push(['Total Charges d\'exploitation', null, 'total', 'SUM(B' + (r + 1) + ':B' + (r + 6) + ')']);
  r += 8;

  items.push(['RÉSULTAT D\'EXPLOITATION', null, 'total', '=B' + (r - 7) + '-B' + r]);
  r += 1;

  items.push(['', null, 'spacer']);
  r += 1;

  items.push(['RÉSULTAT FINANCIER', null, 'section']);
  items.push(['  Produits financiers', is.financialRevenue, 'data']);
  items.push(['  Charges financières', is.financialCosts, 'data']);
  items.push(['Résultat financier', null, 'total', '=B' + (r + 1) + '-B' + (r + 2)]);
  r += 4;

  items.push(['', null, 'spacer']);
  items.push(['RÉSULTAT DES ACTIVITÉS ORDINAIRES AVANT IS', null, 'total', '=B' + (r - 2) + '+' + 'B' + (r - 1)]);
  r += 2;

  items.push(['Impôt sur les sociétés (15%)', is.tax, 'data']);
  items.push(['RÉSULTAT NET DE L\'EXERCICE', is.netProfit, 'final']);

  r = 5;
  items.forEach(([label, val, type, formula]) => {
    if (type === 'section') {
      writeSectionRow(ws, r, 1, label, 2);
    } else if (type === 'spacer') {
      // skip
    } else if (type === 'total') {
      writeTotalRow(ws, r, 1, label, formula || val);
    } else if (type === 'final') {
      writeTotalRow(ws, r, 1, label, val);
      const vc = ws.getCell(r, 2);
      vc.font = { bold: true, size: 11, color: { argb: is.netProfit >= 0 ? GREEN : RED }, name: 'Arial' };
    } else {
      writeDataRow(ws, r, 1, label, val);
    }
    r++;
  });

  ws.protect('');
  ws.getColumn(1).width = 42;
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
    ['Liquidité Réduite', rs.quickRatio, rs.quickRatio > 0.8 ? 'Favorable (>0.8)' : 'À surveiller (<0.8)'],
    ['Dettes / Capitaux Propres', rs.debtToEquity, rs.debtToEquity < 1 ? 'Faible endettement' : 'Endettement élevé'],
    ['ROE (Return on Equity)', `${rs.roe}%`, rs.roe > 15 ? 'Bonne rentabilité' : 'Rentabilité faible'],
    ['ROA (Return on Assets)', `${rs.roa}%`, rs.roa > 8 ? 'Bonne efficacité' : 'Efficacité faible'],
    ['Marge Nette', `${rs.netMargin}%`, rs.netMargin > 10 ? 'Bonne marge' : 'Marge faible'],
    ['Marge Brute', `${rs.grossMargin}%`, rs.grossMargin > 30 ? 'Bonne marge brute' : 'Marge brute faible'],
    ['Autonomie Financière', `${rs.financialAutonomy}%`, rs.financialAutonomy > 30 ? 'Bonne autonomie' : 'Dépendance financière'],
    ['Couverture des Intérêts', rs.interestCoverage || 'N/A', rs.interestCoverage > 3 ? 'Bonne couverture' : 'Couverture insuffisante'],
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

  ws.getColumn(1).width = 34;
  ws.getColumn(2).width = 22;
  ws.getColumn(3).width = 40;
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
    `EtatsFinanciers_SCE_${(companyDetails.name || 'Societe').replace(/\s+/g, '_')}_${new Date().getFullYear()}.xlsx`);
}

export async function exportBilanExcel(invoices, expenses, transactions, companyDetails) {
  const data = getFinancialExportData(invoices, expenses, transactions, companyDetails);
  const wb = new ExcelJS.Workbook();
  await buildBilanSheet(wb, data);
  download(await wb.xlsx.writeBuffer(),
    `Bilan_SCE_${(companyDetails.name || 'Societe').replace(/\s+/g, '_')}_${new Date().getFullYear()}.xlsx`);
}

export async function exportResultatExcel(invoices, expenses, transactions, companyDetails) {
  const data = getFinancialExportData(invoices, expenses, transactions, companyDetails);
  const wb = new ExcelJS.Workbook();
  await buildResultatSheet(wb, data);
  download(await wb.xlsx.writeBuffer(),
    `Resultat_SCE_${(companyDetails.name || 'Societe').replace(/\s+/g, '_')}_${new Date().getFullYear()}.xlsx`);
}
