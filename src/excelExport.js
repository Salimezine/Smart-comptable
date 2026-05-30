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

function styleHeaderRow(row, cols) {
  for (let c = 1; c <= cols; c++) {
    const cell = row.getCell(c);
    cell.font = { bold: true, color: { argb: WHITE }, size: 11, name: 'Arial' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: BORDER } },
      left: { style: 'thin', color: { argb: BORDER } },
      bottom: { style: 'thin', color: { argb: BORDER } },
      right: { style: 'thin', color: { argb: BORDER } }
    };
  }
}

function styleSectionRow(row, cols) {
  for (let c = 1; c <= cols; c++) {
    const cell = row.getCell(c);
    cell.font = { bold: true, size: 10, color: { argb: DARK }, name: 'Arial' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BG } };
    cell.border = {
      top: { style: 'thin', color: { argb: BORDER } },
      bottom: { style: 'medium', color: { argb: BORDER } }
    };
  }
}

function styleDataCell(cell, isBold = false, isTotal = false) {
  cell.font = {
    bold: isBold,
    size: isTotal ? 11 : 10,
    color: isTotal ? { argb: DARK } : { argb: 'FF334155' },
    name: 'Arial'
  };
  if (isTotal) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0FA' } };
  }
  cell.border = {
    bottom: { style: 'thin', color: { argb: BORDER } },
    left: { style: 'thin', color: { argb: BORDER } },
    right: { style: 'thin', color: { argb: BORDER } }
  };
}

function styleAmountCell(cell, val) {
  cell.numFmt = '#,##0.000';
  cell.alignment = { horizontal: 'right' };
  cell.font = {
    color: { argb: val < 0 ? RED : 'FF334155' },
    size: 10, name: 'Arial'
  };
  cell.border = {
    bottom: { style: 'thin', color: { argb: BORDER } },
    left: { style: 'thin', color: { argb: BORDER } },
    right: { style: 'thin', color: { argb: BORDER } }
  };
}

async function buildBilanSheet(wb, data) {
  const ws = wb.addWorksheet('Bilan');
  const ccy = data.company.currency;
  const cols = 4;

  ws.mergeCells('A1:D1');
  const title = ws.getCell('A1');
  title.value = `BILAN — ${data.company.name} — Exercice ${new Date().getFullYear()}`;
  title.font = { bold: true, size: 14, color: { argb: WHITE }, name: 'Arial' };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 30;

  ws.mergeCells('A2:D2');
  ws.getCell('A2').value = `Généré le ${todayStr()} · MF: ${data.company.mf}`;
  ws.getCell('A2').font = { italic: true, size: 9, color: { argb: GRAY }, name: 'Arial' };
  ws.getCell('A2').alignment = { horizontal: 'center' };
  ws.getRow(2).height = 20;

  ws.getRow(3).height = 8;

  const hdr = ws.getRow(4);
  hdr.getCell(1).value = 'ACTIF';
  hdr.getCell(2).value = 'Montant';
  hdr.getCell(3).value = 'PASSIF & CAPITAUX PROPRES';
  hdr.getCell(4).value = 'Montant';
  styleHeaderRow(hdr, cols);
  ws.getRow(4).height = 22;

  const bs = data.balanceSheet;
  const rows = [
    ['Immobilisations incorporelles', bs.assets.nonCurrent.intangible, 'Capital social', bs.equity.socialCapital],
    ['Immobilisations corporelles', bs.assets.nonCurrent.tangible, 'Réserves légales', bs.equity.legalReserve],
    ['Actifs Non Courants (Classe 2)', bs.assets.nonCurrent.total, 'Résultat net', bs.equity.retainedEarnings],
    ['Créances clients', bs.assets.current.receivables, 'Capitaux Propres (Classe 1)', bs.equity.total],
    ['Trésorerie', bs.assets.current.cashAndBank, 'Emprunts bancaires', bs.liabilities.nonCurrent.bankLoans],
    ['Actifs Courants (Classe 3,4,5)', bs.assets.current.total, 'Passifs Non Courants', bs.liabilities.nonCurrent.total],
    ['', null, 'Dettes fournisseurs', bs.liabilities.current.accountsPayable],
    ['', null, 'Dettes fiscales (IS)', bs.liabilities.current.taxPayable],
    ['', null, 'Passifs Courants', bs.liabilities.current.total],
  ];

  let r = 5;
  for (const [label, val, plabel, pval] of rows) {
    const row = ws.getRow(r);
    if (label) {
      row.getCell(1).value = label;
      styleDataCell(row.getCell(1), false, false);
    }
    if (val !== null) {
      row.getCell(2).value = val;
      styleAmountCell(row.getCell(2), val);
    }
    if (plabel) {
      row.getCell(3).value = plabel;
      styleDataCell(row.getCell(3), false, false);
    }
    if (pval !== null && pval !== undefined) {
      row.getCell(4).value = pval;
      styleAmountCell(row.getCell(4), pval);
    }
    ws.getRow(r).height = 18;
    r++;
  }

  const totalRow = ws.getRow(r);
  totalRow.getCell(1).value = 'TOTAL ACTIFS';
  totalRow.getCell(2).value = bs.assets.total;
  totalRow.getCell(3).value = 'TOTAL PASSIFS & CP';
  totalRow.getCell(4).value = bs.totalLiabilitiesAndEquity;
  for (let c = 1; c <= cols; c++) {
    const cell = totalRow.getCell(c);
    cell.font = { bold: true, size: 11, color: { argb: DARK }, name: 'Arial' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
    cell.border = {
      top: { style: 'medium', color: { argb: DARK } },
      bottom: { style: 'medium', color: { argb: DARK } },
      left: { style: 'thin', color: { argb: BORDER } },
      right: { style: 'thin', color: { argb: BORDER } }
    };
  }
  styleAmountCell(totalRow.getCell(2), bs.assets.total);
  styleAmountCell(totalRow.getCell(4), bs.totalLiabilitiesAndEquity);
  ws.getRow(r).height = 22;

  r += 2;
  const controlRow = ws.getRow(r);
  const balanced = Math.abs(bs.assets.total - bs.totalLiabilitiesAndEquity) < 0.01;
  ws.mergeCells(`A${r}:D${r}`);
  controlRow.getCell(1).value = balanced ? '✓ Bilan équilibré (Actif = Passif + CP)' : '✗ Bilan déséquilibré';
  controlRow.getCell(1).font = {
    bold: true, size: 10,
    color: { argb: balanced ? GREEN : RED },
    name: 'Arial'
  };
  controlRow.getCell(1).alignment = { horizontal: 'center' };

  ws.getColumn(1).width = 34;
  ws.getColumn(2).width = 18;
  ws.getColumn(3).width = 34;
  ws.getColumn(4).width = 18;

  ws.views = [{ state: 'frozen', ySplit: 4 }];
}

async function buildResultatSheet(wb, data) {
  const ws = wb.addWorksheet('État de résultat');
  const ccy = data.company.currency;

  ws.mergeCells('A1:B1');
  ws.getCell('A1').value = `ÉTAT DE RÉSULTAT — ${data.company.name} — Exercice ${new Date().getFullYear()}`;
  ws.getCell('A1').font = { bold: true, size: 14, color: { argb: WHITE }, name: 'Arial' };
  ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } };
  ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 30;

  ws.mergeCells('A2:B2');
  ws.getCell('A2').value = `Généré le ${todayStr()}`;
  ws.getCell('A2').font = { italic: true, size: 9, color: { argb: GRAY }, name: 'Arial' };
  ws.getCell('A2').alignment = { horizontal: 'center' };

  const hdr = ws.getRow(4);
  hdr.getCell(1).value = 'Rubrique';
  hdr.getCell(2).value = 'Montant';
  styleHeaderRow(hdr, 2);

  const is = data.incomeStatement;
  const items = [
    ['Produits d\'exploitation', is.revenue, false],
    ['Charges d\'exploitation', -is.operatingExpenses, false],
    ['Résultat d\'exploitation', is.operatingProfit, true],
    ['Produits financiers', 0, false],
    ['Charges financières', 0, false],
    ['Résultat des activités ordinaires', is.ordinaryProfit, true],
    ['Impôt sur les sociétés (15%)', -is.tax, false],
    ['RÉSULTAT NET DE L\'EXERCICE', is.netProfit, true],
  ];

  items.forEach(([label, val, isTotal], i) => {
    const r = 5 + i;
    const row = ws.getRow(r);
    row.getCell(1).value = label;
    styleDataCell(row.getCell(1), isTotal, isTotal);
    row.getCell(2).value = Math.abs(val);
    styleAmountCell(row.getCell(2), val);
    if (val < 0) {
      row.getCell(2).font = { color: { argb: RED }, size: 10, name: 'Arial' };
    }
    if (isTotal) {
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0FA' } };
      row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0FA' } };
      row.getCell(2).font = { bold: true, size: 11, color: { argb: val >= 0 ? GREEN : RED }, name: 'Arial' };
    }
    ws.getRow(r).height = 20;
  });

  ws.getColumn(1).width = 40;
  ws.getColumn(2).width = 20;
  ws.views = [{ state: 'frozen', ySplit: 4 }];
}

async function buildBruteDataSheet(wb, invoices, expenses, transactions) {
  const ws = wb.addWorksheet('Données brutes');

  ws.mergeCells('A1:E1');
  ws.getCell('A1').value = 'BALANCE DES COMPTES — DONNÉES BRUTES';
  ws.getCell('A1').font = { bold: true, size: 14, color: { argb: WHITE }, name: 'Arial' };
  ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } };
  ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 30;

  let r = 3;
  const sections = [
    {
      title: 'FACTURES CLIENTS',
      headers: ['N° Facture', 'Client', 'Date', 'HT', 'TTC'],
      data: invoices.map(inv => [inv.invoiceNumber || '', inv.clientName || '', inv.issueDate || '', inv.subtotal || 0, inv.totalAmount || 0])
    },
    {
      title: 'CHARGES / DÉPENSES',
      headers: ['Fournisseur', 'Catégorie', 'Date', 'HT', 'TTC'],
      data: expenses.map(exp => [exp.supplier || '', exp.category || '', exp.date || '', exp.subtotal || 0, exp.totalAmount || 0])
    },
    {
      title: 'TRANSACTIONS BANCAIRES',
      headers: ['Date', 'Description', 'Type', 'Montant', ''],
      data: transactions.map(tx => [tx.date || '', tx.description || '', tx.type || '', tx.amount || 0, ''])
    }
  ];

  for (const section of sections) {
    ws.getRow(r).getCell(1).value = section.title;
    styleSectionRow(ws.getRow(r), 5);
    ws.getRow(r).height = 22;
    r++;

    const hdrRow = ws.getRow(r);
    section.headers.forEach((h, i) => { hdrRow.getCell(i + 1).value = h; });
    styleHeaderRow(hdrRow, 5);
    ws.getRow(r).height = 20;
    r++;

    for (const rowData of section.data) {
      const row = ws.getRow(r);
      rowData.forEach((val, i) => {
        const cell = row.getCell(i + 1);
        cell.value = val;
        styleDataCell(cell);
        if (typeof val === 'number') {
          cell.numFmt = '#,##0.000';
          cell.alignment = { horizontal: 'right' };
        }
      });
      ws.getRow(r).height = 18;
      r++;
    }
    r++;
  }

  ws.getColumn(1).width = 22;
  ws.getColumn(2).width = 24;
  ws.getColumn(3).width = 14;
  ws.getColumn(4).width = 16;
  ws.getColumn(5).width = 16;
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

async function buildRatiosSheet(wb, data) {
  const ws = wb.addWorksheet('Ratios');
  const rs = data.ratios;

  ws.mergeCells('A1:C1');
  ws.getCell('A1').value = `RATIOS FINANCIERS — ${data.company.name} — ${new Date().getFullYear()}`;
  ws.getCell('A1').font = { bold: true, size: 14, color: { argb: WHITE }, name: 'Arial' };
  ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } };
  ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 30;

  const hdr = ws.getRow(3);
  hdr.getCell(1).value = 'Ratio';
  hdr.getCell(2).value = 'Valeur';
  hdr.getCell(3).value = 'Interprétation';
  styleHeaderRow(hdr, 3);

  const ratios = [
    ['Liquidité Générale', rs.liquidityRatio, rs.liquidityRatio > 1 ? 'Favorable (>1)' : 'À surveiller (<1)'],
    ['Ratio Dettes / Capitaux Propres', rs.debtToEquity, rs.debtToEquity < 1 ? 'Faible endettement' : 'Endettement élevé'],
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
    row.getCell(1).value = label;
    styleDataCell(row.getCell(1));
    row.getCell(2).value = val;
    styleDataCell(row.getCell(2));
    row.getCell(2).font = { bold: true, size: 10, name: 'Arial' };
    row.getCell(3).value = interp;
    styleDataCell(row.getCell(3));
    ws.getRow(r).height = 20;
  });

  ws.getColumn(1).width = 32;
  ws.getColumn(2).width = 20;
  ws.getColumn(3).width = 38;
  ws.views = [{ state: 'frozen', ySplit: 3 }];
}

export async function exportToExcel(invoices, expenses, transactions, companyDetails) {
  const data = getFinancialExportData(invoices, expenses, transactions, companyDetails);
  const wb = new ExcelJS.Workbook();

  await buildBilanSheet(wb, data);
  await buildResultatSheet(wb, data);
  await buildBruteDataSheet(wb, invoices, expenses, transactions);
  await buildRatiosSheet(wb, data);

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `EtatsFinanciers_${(companyDetails.name || 'Societe').replace(/\s+/g, '_')}_${new Date().getFullYear()}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportBilanExcel(invoices, expenses, transactions, companyDetails) {
  const data = getFinancialExportData(invoices, expenses, transactions, companyDetails);
  const wb = new ExcelJS.Workbook();
  await buildBilanSheet(wb, data);
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Bilan_${(companyDetails.name || 'Societe').replace(/\s+/g, '_')}_${new Date().getFullYear()}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportResultatExcel(invoices, expenses, transactions, companyDetails) {
  const data = getFinancialExportData(invoices, expenses, transactions, companyDetails);
  const wb = new ExcelJS.Workbook();
  await buildResultatSheet(wb, data);
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Resultat_${(companyDetails.name || 'Societe').replace(/\s+/g, '_')}_${new Date().getFullYear()}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
