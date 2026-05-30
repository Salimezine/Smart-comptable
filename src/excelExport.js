import ExcelJS from 'exceljs';
import { getFinancialExportData } from './accountingUtils';

const DARK = 'FF1a1a2e';
const WHITE = 'FFFFFFFF';
const LIGHT_BG = 'FFF5F5FA';
const GREEN = 'FF10b981';
const RED = 'FFef4444';
const GRAY = 'FF64748b';
const BORDER = 'FFCBD5E1';
const SECTION = 'FF1e293b';

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function border(cell, opts = {}) {
  cell.border = {
    top: opts.top || { style: 'thin', color: { argb: BORDER } },
    bottom: opts.bottom || { style: 'thin', color: { argb: BORDER } },
    left: opts.left || { style: 'thin', color: { argb: BORDER } },
    right: opts.right || { style: 'thin', color: { argb: BORDER } }
  };
}

function fill(cell, color) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
}

function setRow(ws, row, labels, startCol) {
  labels.forEach((l, i) => {
    const c = ws.getCell(row, startCol + i);
    c.value = l;
    c.font = { bold: true, color: { argb: WHITE }, size: 10, name: 'Arial' };
    fill(c, DARK);
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    border(c);
  });
}

function dataRow(ws, row, col, label, value, isBold, indent) {
  const r = ws.getRow(row);
  const lc = r.getCell(col);
  lc.value = label;
  lc.font = { bold: isBold, size: isBold ? 10 : 9, color: { argb: DARK }, name: 'Arial' };
  lc.alignment = { horizontal: 'left', vertical: 'middle', indent: indent || 0 };
  if (isBold) fill(lc, LIGHT_BG);
  border(lc);

  const vc = r.getCell(col + 1);
  vc.value = value;
  vc.numFmt = '#,##0.000';
  vc.alignment = { horizontal: 'right', vertical: 'middle' };
  vc.font = { bold: isBold, size: isBold ? 10 : 9, color: { argb: DARK }, name: 'Arial' };
  if (isBold) fill(vc, LIGHT_BG);
  border(vc);
  r.height = 17;
}

function sectionRow(ws, row, col, text) {
  const r = ws.getRow(row);
  const c = r.getCell(col);
  c.value = text;
  c.font = { bold: true, size: 10, color: { argb: WHITE }, name: 'Arial' };
  fill(c, SECTION);
  border(c);
  const c2 = r.getCell(col + 1);
  fill(c2, SECTION);
  border(c2);
  r.height = 20;
}

function totalRow(ws, row, col, label, value) {
  const r = ws.getRow(row);
  const lc = r.getCell(col);
  lc.value = label;
  lc.font = { bold: true, size: 10, color: { argb: DARK }, name: 'Arial' };
  fill(lc, 'FFE0E7FF');
  border(lc, { top: { style: 'medium', color: { argb: DARK } }, bottom: { style: 'medium', color: { argb: DARK } } });

  const vc = r.getCell(col + 1);
  vc.value = value;
  vc.numFmt = '#,##0.000';
  vc.alignment = { horizontal: 'right', vertical: 'middle' };
  vc.font = { bold: true, size: 10, color: { argb: DARK }, name: 'Arial' };
  fill(vc, 'FFE0E7FF');
  border(vc, { top: { style: 'medium', color: { argb: DARK } }, bottom: { style: 'medium', color: { argb: DARK } } });
  r.height = 21;
}

async function buildBilanSheet(wb, data) {
  const ws = wb.addWorksheet('Bilan');
  const bs = data.balanceSheet;

  // Title
  ws.mergeCells('A1:D1');
  const title = ws.getCell('A1');
  title.value = `BILAN SCE — ${data.company.name} — Exercice ${new Date().getFullYear()}`;
  title.font = { bold: true, size: 13, color: { argb: WHITE }, name: 'Arial' };
  fill(title, DARK);
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 30;

  ws.mergeCells('A2:D2');
  const sub = ws.getCell('A2');
  sub.value = `Généré le ${todayStr()} · MF: ${data.company.mf}`;
  sub.font = { italic: true, size: 9, color: { argb: GRAY }, name: 'Arial' };
  sub.alignment = { horizontal: 'center' };
  ws.getRow(3).height = 4;

  // Headers
  setRow(ws, 4, ['ACTIFS', 'Montant', 'PASSIFS & CAPITAUX PROPRES', 'Montant'], 1);

  // Track row for formulas
  const a = { r: 5 };

  // === ACTIFS ===
  sectionRow(ws, a.r, 1, 'ACTIFS NON COURANTS'); a.r++;
  const ancIncorp = a.r; dataRow(ws, a.r, 1, '  Frais de développement', bs.assets.nonCurrent.intangibleDetail.devCosts, false, 1); a.r++;
  dataRow(ws, a.r, 1, '  Brevets, licences, marques', bs.assets.nonCurrent.intangibleDetail.patents, false, 1); a.r++;
  dataRow(ws, a.r, 1, '  Fonds commercial', bs.assets.nonCurrent.intangibleDetail.goodwill, false, 1); a.r++;
  dataRow(ws, a.r, 1, '  Immobilisations incorporelles', bs.assets.nonCurrent.intangible, true); a.r++;
  const ancCorp = a.r; dataRow(ws, a.r, 1, '  Terrains', bs.assets.nonCurrent.tangibleDetail.land, false, 1); a.r++;
  dataRow(ws, a.r, 1, '  Constructions', bs.assets.nonCurrent.tangibleDetail.buildings, false, 1); a.r++;
  dataRow(ws, a.r, 1, '  Installations techniques', bs.assets.nonCurrent.tangibleDetail.equipment, false, 1); a.r++;
  dataRow(ws, a.r, 1, '  Matériel de transport', bs.assets.nonCurrent.tangibleDetail.transport, false, 1); a.r++;
  dataRow(ws, a.r, 1, '  Mobilier & mat. bureau', bs.assets.nonCurrent.tangibleDetail.officeEquip, false, 1); a.r++;
  dataRow(ws, a.r, 1, '  Immobilisations corporelles', bs.assets.nonCurrent.tangible, true); a.r++;
  dataRow(ws, a.r, 1, '  Immobilisations financières', bs.assets.nonCurrent.financial, false); a.r++;
  const totalANCrow = a.r;
  totalRow(ws, a.r, 1, 'TOTAL ACTIFS NON COURANTS', bs.assets.nonCurrent.total); a.r++;

  a.r++; // spacing
  sectionRow(ws, a.r, 1, 'ACTIFS COURANTS'); a.r++;
  const acStocks = a.r; dataRow(ws, a.r, 1, '  Marchandises', bs.assets.current.stockDetail.merchandise, false, 1); a.r++;
  dataRow(ws, a.r, 1, '  Matières premières', bs.assets.current.stockDetail.rawMaterials, false, 1); a.r++;
  dataRow(ws, a.r, 1, '  Stocks', bs.assets.current.stocks, true); a.r++;
  dataRow(ws, a.r, 1, '  Clients et comptes rattachés', bs.assets.current.receivables, false); a.r++;
  dataRow(ws, a.r, 1, '  Personnel', bs.assets.current.personnelRec, false); a.r++;
  dataRow(ws, a.r, 1, '  État et collectivités', bs.assets.current.taxRec, false); a.r++;
  dataRow(ws, a.r, 1, '  Autres débiteurs', bs.assets.current.otherRec, false); a.r++;
  dataRow(ws, a.r, 1, '  Banque', bs.assets.current.cashAndBank, false); a.r++;
  dataRow(ws, a.r, 1, '  Caisse', bs.assets.current.cashRegister, false); a.r++;
  const totalACrow = a.r;
  totalRow(ws, a.r, 1, 'TOTAL ACTIFS COURANTS', bs.assets.current.total); a.r++;
  a.r++;
  const totalActRow = a.r;
  totalRow(ws, a.r, 1, 'TOTAL ACTIFS', bs.assets.total); a.r++;

  // === PASSIFS ===
  const b = { r: 5 };
  sectionRow(ws, b.r, 3, 'CAPITAUX PROPRES'); b.r++;
  dataRow(ws, b.r, 3, '  Capital social', bs.equity.socialCapital, false, 1); b.r++;
  dataRow(ws, b.r, 3, '  Réserves légales', bs.equity.legalReserve, false, 1); b.r++;
  dataRow(ws, b.r, 3, '  Autres réserves', bs.equity.otherReserves, false, 1); b.r++;
  dataRow(ws, b.r, 3, '  Résultat net de l\'exercice', bs.equity.retainedEarnings, false, 1); b.r++;
  const totalCProw = b.r;
  totalRow(ws, b.r, 3, 'TOTAL CAPITAUX PROPRES', bs.equity.total); b.r++;

  b.r++;
  sectionRow(ws, b.r, 3, 'PASSIFS NON COURANTS'); b.r++;
  dataRow(ws, b.r, 3, '  Emprunts bancaires', bs.liabilities.nonCurrent.bankLoans, false, 1); b.r++;
  dataRow(ws, b.r, 3, '  Provisions', bs.liabilities.nonCurrent.provisions, false, 1); b.r++;
  const totalPNCrow = b.r;
  totalRow(ws, b.r, 3, 'TOTAL PASSIFS NON COURANTS', bs.liabilities.nonCurrent.total); b.r++;

  b.r++;
  sectionRow(ws, b.r, 3, 'PASSIFS COURANTS'); b.r++;
  dataRow(ws, b.r, 3, '  Fournisseurs et comptes rattachés', bs.liabilities.current.accountsPayable, false, 1); b.r++;
  dataRow(ws, b.r, 3, '  Personnel', bs.liabilities.current.personnelPayable, false, 1); b.r++;
  dataRow(ws, b.r, 3, '  État — Impôt sur les sociétés', bs.liabilities.current.taxPayable, false, 1); b.r++;
  dataRow(ws, b.r, 3, '  État — TVA due', bs.liabilities.current.vatPayable, false, 1); b.r++;
  dataRow(ws, b.r, 3, '  Autres dettes', bs.liabilities.current.otherPayables, false, 1); b.r++;
  dataRow(ws, b.r, 3, '  Concours bancaires', bs.liabilities.current.bankOverdraft, false, 1); b.r++;
  const totalPCrow = b.r;
  totalRow(ws, b.r, 3, 'TOTAL PASSIFS COURANTS', bs.liabilities.current.total); b.r++;
  b.r++;
  const totalPassRow = b.r;
  totalRow(ws, b.r, 3, 'TOTAL PASSIFS & CAPITAUX PROPRES', bs.totalLiabilitiesAndEquity); b.r++;

  // Control row
  const cr = Math.max(a.r, b.r) + 1;
  const labelR = ws.getRow(cr);
  ws.mergeCells(cr, 1, cr, 4);
  const cc = labelR.getCell(1);
  cc.value = Math.abs(bs.assets.total - bs.totalLiabilitiesAndEquity) < 0.01
    ? '✓ Bilan équilibré (Actif = Passif + Capitaux Propres)'
    : '✗ Bilan déséquilibré';
  cc.font = { bold: true, size: 10, color: { argb: GREEN }, name: 'Arial' };
  cc.alignment = { horizontal: 'center' };

  ws.getColumn(1).width = 36;
  ws.getColumn(2).width = 18;
  ws.getColumn(3).width = 36;
  ws.getColumn(4).width = 18;
  ws.views = [{ state: 'frozen', ySplit: 4 }];
}

async function buildResultatSheet(wb, data) {
  const ws = wb.addWorksheet('État de résultat');
  const is = data.incomeStatement;

  ws.mergeCells('A1:B1');
  const t = ws.getCell('A1');
  t.value = `ÉTAT DE RÉSULTAT SCE — ${data.company.name} — Exercice ${new Date().getFullYear()}`;
  t.font = { bold: true, size: 13, color: { argb: WHITE }, name: 'Arial' };
  fill(t, DARK);
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 30;

  ws.mergeCells('A2:B2');
  const s = ws.getCell('A2');
  s.value = `Généré le ${todayStr()}`;
  s.font = { italic: true, size: 9, color: { argb: GRAY }, name: 'Arial' };
  s.alignment = { horizontal: 'center' };
  ws.getRow(3).height = 4;

  setRow(ws, 4, ['Rubrique', 'Montant'], 1);

  let r = 5;
  const S = (txt) => { sectionRow(ws, r, 1, txt); r++; };
  const D = (label, val, bold, indent) => { dataRow(ws, r, 1, label, val, bold, indent); r++; };
  const T = (label, val) => { totalRow(ws, r, 1, label, val); r++; };

  S('PRODUITS D\'EXPLOITATION');
  D('  Ventes de marchandises', is.productSales, false, 1);
  D('  Prestations de services', is.serviceRevenue, false, 1);
  D('  Autres produits', is.otherRevenue, false, 1);
  T('Total Produits d\'exploitation', is.revenue);

  r++;
  S('CHARGES D\'EXPLOITATION');
  D('  Achats de marchandises', is.purchaseGoods, false, 1);
  D('  Achats de matières premières', is.purchaseRaw, false, 1);
  D('  Autres achats et charges externes', is.otherPurchases, false, 1);
  D('  Charges de personnel', is.personnelCosts, false, 1);
  D('  Dotations aux amortissements', is.depreciation, false, 1);
  D('  Autres charges d\'exploitation', is.otherOpCharges, false, 1);
  T('Total Charges d\'exploitation', is.operatingExpenses);

  r++;
  T('RÉSULTAT D\'EXPLOITATION', is.operatingProfit);

  r++;
  S('RÉSULTAT FINANCIER');
  D('  Produits financiers', is.financialRevenue, false, 1);
  D('  Charges financières', is.financialCosts, false, 1);
  T('Résultat financier', is.financialResult);

  r++;
  T('RÉSULTAT DES ACTIVITÉS ORDINAIRES AVANT IS', is.ordinaryProfit);

  r++;
  D('Impôt sur les sociétés (15%)', is.tax, false);

  const netRow = r;
  T('RÉSULTAT NET DE L\'EXERCICE', is.netProfit);
  const vc = ws.getCell(netRow, 2);
  vc.font = { bold: true, size: 11, color: { argb: is.netProfit >= 0 ? GREEN : RED }, name: 'Arial' };
  fill(vc, 'FFE0E7FF');

  ws.getColumn(1).width = 42;
  ws.getColumn(2).width = 22;
  ws.views = [{ state: 'frozen', ySplit: 4 }];
}

async function buildBruteDataSheet(wb, invoices, expenses, transactions) {
  const ws = wb.addWorksheet('Données brutes');

  ws.mergeCells('A1:E1');
  const t = ws.getCell('A1');
  t.value = 'BALANCE DES COMPTES — DONNÉES BRUTES';
  t.font = { bold: true, size: 13, color: { argb: WHITE }, name: 'Arial' };
  fill(t, DARK);
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 30;
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
    for (let c = 1; c <= 5; c++) fill(sr.getCell(c), LIGHT_BG);
    sr.height = 24;
    r++;
    setRow(ws, r, headers, 1);
    r++;
    for (const rowData of data) {
      const row = ws.getRow(r);
      rowData.forEach((val, i) => {
        const c = row.getCell(i + 1);
        c.value = val;
        c.font = { size: 10, name: 'Arial' };
        border(c);
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

  ws.mergeCells('A1:C1');
  const t = ws.getCell('A1');
  t.value = `RATIOS FINANCIERS — ${data.company.name} — ${new Date().getFullYear()}`;
  t.font = { bold: true, size: 13, color: { argb: WHITE }, name: 'Arial' };
  fill(t, DARK);
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 30;
  ws.getRow(2).height = 6;

  setRow(ws, 3, ['Ratio', 'Valeur', 'Interprétation'], 1);

  const rs = data.ratios;
  const items = [
    ['Liquidité Générale', rs.liquidityRatio, rs.liquidityRatio > 1 ? 'Favorable (>1)' : 'À surveiller (<1)'],
    ['Liquidité Réduite', rs.quickRatio, rs.quickRatio > 0.8 ? 'Favorable (>0.8)' : 'À surveiller (<0.8)'],
    ['Dettes / Capitaux Propres', rs.debtToEquity, rs.debtToEquity < 1 ? 'Faible endettement' : 'Endettement élevé'],
    ['ROE', `${rs.roe}%`, rs.roe > 15 ? 'Bonne rentabilité' : 'Rentabilité faible'],
    ['ROA', `${rs.roa}%`, rs.roa > 8 ? 'Bonne efficacité' : 'Efficacité faible'],
    ['Marge Nette', `${rs.netMargin}%`, rs.netMargin > 10 ? 'Bonne marge' : 'Marge faible'],
    ['Marge Brute', `${rs.grossMargin}%`, rs.grossMargin > 30 ? 'Bonne marge brute' : 'Marge brute faible'],
    ['Autonomie Financière', `${rs.financialAutonomy}%`, rs.financialAutonomy > 30 ? 'Bonne autonomie' : 'Dépendance financière'],
    ['Couverture des Intérêts', rs.interestCoverage || 'N/A', rs.interestCoverage > 3 ? 'Bonne couverture' : 'Insuffisante'],
  ];

  items.forEach(([label, val, interp], i) => {
    const rr = 4 + i;
    const row = ws.getRow(rr);
    for (let c = 1; c <= 3; c++) {
      row.getCell(c).font = { size: 10, name: 'Arial', color: { argb: DARK } };
      border(row.getCell(c));
    }
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
