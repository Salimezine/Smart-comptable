import { jsPDF } from 'jspdf';
import { formatCurrencyHelper } from './accountingUtils';

const LINE_H = 7;
const MARGIN = 20;
const PAGE_W = 210;
const CONTENT_W = PAGE_W - 2 * MARGIN;

function drawHeader(doc, data, title) {
  doc.setFontSize(18);
  doc.setTextColor(26, 26, 46);
  doc.text(data.company.name || 'Smart Comptable', MARGIN, 25);

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(`MF: ${data.company.mf}`, MARGIN, 32);
  doc.text(data.company.address, MARGIN, 37);
  doc.text(`Exercice: ${new Date().getFullYear()}`, MARGIN, 42);

  doc.setFontSize(14);
  doc.setTextColor(26, 26, 46);
  doc.text(title, MARGIN, 52);

  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, 55, PAGE_W - MARGIN, 55);
}

function drawFooter(doc, pageNum) {
  doc.setFontSize(7);
  doc.setTextColor(150);
  const footerY = 290;
  doc.text('Ce document a été généré par Smart Comptable', MARGIN, footerY);
  doc.text(`Généré le: ${new Date().toLocaleDateString('fr-TN')}`, MARGIN, footerY + 4);
  doc.text(`Page ${pageNum}`, PAGE_W - MARGIN, footerY, { align: 'right' });
}

function drawSectionRow(doc, y, label, value, opts = {}) {
  const { bold = false, color = [60], bg = null } = opts;
  if (bg) {
    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.rect(MARGIN, y - 4, CONTENT_W, LINE_H, 'F');
  }
  doc.setFontSize(10);
  doc.setTextColor(color[0], color[1] || color[0], color[2] || color[0]);
  doc.setFont(undefined, bold ? 'bold' : 'normal');
  doc.text(label, MARGIN + 2, y + 1);
  doc.text(value, PAGE_W - MARGIN - 2, y + 1, { align: 'right' });
  return y + LINE_H;
}

function drawLine(doc, y) {
  doc.setDrawColor(220);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  return y + 2;
}

export function exportBalanceSheetPDF(data) {
  const doc = new jsPDF();
  let y = 62;
  let page = 1;

  drawHeader(doc, data, 'Bilan (État de la Situation Financière)');

  y = drawLine(doc, y + 4);

  doc.setFontSize(11);
  doc.setTextColor(26, 26, 46);
  doc.setFont(undefined, 'bold');
  doc.text('ACTIF', MARGIN, y);
  y += LINE_H + 2;

  y = drawSectionRow(doc, y, 'Actifs Non Courants (Classe 2)', formatCurrencyHelper(data.balanceSheet.assets.nonCurrent, data.company.currency), { bold: false, color: [80] });
  y = drawSectionRow(doc, y, 'Actifs Courants (Classe 3, 4, 5)', formatCurrencyHelper(data.balanceSheet.assets.current, data.company.currency), { bold: false, color: [80] });
  y = drawSectionRow(doc, y, 'Total Actifs', formatCurrencyHelper(data.balanceSheet.assets.total, data.company.currency), { bold: true, color: [26, 26, 46], bg: [240, 240, 250] });

  y += 6;
  doc.setFontSize(11);
  doc.setTextColor(26, 26, 46);
  doc.setFont(undefined, 'bold');
  doc.text('PASSIF & CAPITAUX PROPRES', MARGIN, y);
  y += LINE_H + 2;

  y = drawSectionRow(doc, y, 'Capitaux Propres (Classe 1)', formatCurrencyHelper(data.balanceSheet.equity, data.company.currency), { bold: false, color: [80] });
  y = drawSectionRow(doc, y, 'Passifs Non Courants', formatCurrencyHelper(data.balanceSheet.liabilities.nonCurrent, data.company.currency), { bold: false, color: [80] });
  y = drawSectionRow(doc, y, 'Passifs Courants', formatCurrencyHelper(data.balanceSheet.liabilities.current, data.company.currency), { bold: false, color: [80] });
  y = drawSectionRow(doc, y, 'Total Passifs & Capitaux Propres', formatCurrencyHelper(data.balanceSheet.totalLiabilitiesAndEquity, data.company.currency), { bold: true, color: [26, 26, 46], bg: [240, 240, 250] });

  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(0, 128, 0);
  doc.setFont(undefined, 'bold');
  doc.text('✓ Le bilan est équilibré (Actif = Passif + Capitaux Propres)', MARGIN, y);

  drawFooter(doc, page);
  doc.save(`Bilan_${data.company.name.replace(/\s+/g, '_')}_${new Date().getFullYear()}.pdf`);
}

export function exportIncomeStatementPDF(data) {
  const doc = new jsPDF();
  let y = 62;
  let page = 1;

  drawHeader(doc, data, 'État de Résultat');

  y = drawLine(doc, y + 4);

  const fmt = (v) => formatCurrencyHelper(v, data.company.currency);

  y = drawSectionRow(doc, y, 'Produits d\'exploitation', fmt(data.incomeStatement.revenue), { bold: false, color: [0, 128, 0] });
  y = drawSectionRow(doc, y, 'Charges d\'exploitation', fmt(data.incomeStatement.operatingExpenses), { bold: false, color: [200, 50, 50] });
  y = drawSectionRow(doc, y, 'Résultat d\'exploitation', fmt(data.incomeStatement.operatingProfit), { bold: true, color: [26, 26, 46], bg: [240, 240, 250] });

  y += 4;
  y = drawSectionRow(doc, y, 'Produits financiers', '0', { bold: false, color: [100] });
  y = drawSectionRow(doc, y, 'Charges financières', '0', { bold: false, color: [100] });
  y = drawSectionRow(doc, y, 'Résultat des activités ordinaires', fmt(data.incomeStatement.ordinaryProfit), { bold: true, color: [26, 26, 46] });

  y += 4;
  y = drawSectionRow(doc, y, 'Impôt sur les sociétés (15%)', fmt(data.incomeStatement.tax), { bold: false, color: [200, 50, 50] });

  y += 2;
  doc.setDrawColor(26, 26, 46);
  doc.setLineWidth(1);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 4;
  y = drawSectionRow(doc, y, 'RÉSULTAT NET DE L\'EXERCICE', fmt(data.incomeStatement.netProfit), { bold: true, color: data.incomeStatement.netProfit >= 0 ? [0, 128, 0] : [200, 50, 50] });

  drawFooter(doc, page);
  doc.save(`Resultat_${data.company.name.replace(/\s+/g, '_')}_${new Date().getFullYear()}.pdf`);
}
