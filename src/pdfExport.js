import { jsPDF } from 'jspdf';
import { formatCurrencyHelper } from './accountingUtils';

const M = 20;
const W = 170;
const ML = 20;
const CL1 = 20;
const CL2 = 130;
const CL3 = 170;
const LH = 6.5;

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function drawCompanyHeader(doc, data) {
  doc.setFontSize(20);
  doc.setTextColor(26, 26, 46);
  doc.setFont('helvetica', 'bold');
  doc.text(data.company.name || 'Smart Comptable', M, 22);

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'normal');
  doc.text(`MF: ${data.company.mf}  |  ${data.company.address}`, M, 30);
  doc.text(`Exercice: ${new Date().getFullYear()}  |  Généré le ${todayStr()}`, M, 35);

  doc.setDrawColor(26, 26, 46);
  doc.setLineWidth(0.8);
  doc.line(M, 38, W + M, 38);
}

function drawTitle(doc, text, y) {
  doc.setFontSize(14);
  doc.setTextColor(26, 26, 46);
  doc.setFont('helvetica', 'bold');
  doc.text(text, M, y);
  return y + 8;
}

function drawSectionHeader(doc, text, y, w) {
  doc.setFillColor(26, 26, 46);
  doc.rect(M, y - 3.5, w || W, 7, 'F');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(text, M + 2, y + 1);
  return y + 7;
}

function drawRow(doc, y, label, value, opts = {}) {
  const { bold = false, total = false, indent = 0, color = [80, 80, 80] } = opts;
  const xLabel = M + 2 + indent;
  const xValue = W + M - 2;

  if (total) {
    doc.setFillColor(235, 240, 255);
    doc.rect(M, y - 3.5, W, 7, 'F');
  }

  doc.setFontSize(total ? 10 : 8.5);
  doc.setTextColor(color[0], color[1], color[2]);
  doc.setFont('helvetica', bold || total ? 'bold' : 'normal');
  doc.text(label, xLabel, y + 1);

  doc.text(value, xValue, y + 1, { align: 'right' });

  if (!total) {
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(M, y + 4, W + M, y + 4);
  }
  return y + LH;
}

function drawSeparator(doc, y) {
  doc.setDrawColor(26, 26, 46);
  doc.setLineWidth(0.5);
  doc.line(M, y, W + M, y);
  return y + 3;
}

export function exportBalanceSheetPDF(data) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const ccy = data.company.currency;
  const fmt = (v) => formatCurrencyHelper(v, ccy);
  const bs = data.balanceSheet;

  drawCompanyHeader(doc, data);
  let y = drawTitle(doc, 'Bilan — État de la Situation Financière', 44);

  y = drawSectionHeader(doc, 'ACTIF (Emplois)', y);
  y = drawRow(doc, y, 'Immobilisations incorporelles', fmt(bs.assets.nonCurrent.intangible), { indent: 4 });
  y = drawRow(doc, y, 'Immobilisations corporelles', fmt(bs.assets.nonCurrent.tangible), { indent: 4 });
  y = drawRow(doc, y, 'Actifs Non Courants (Classe 2)', fmt(bs.assets.nonCurrent.total), { bold: true });
  y = drawRow(doc, y, 'Créances clients', fmt(bs.assets.current.receivables), { indent: 4 });
  y = drawRow(doc, y, 'Trésorerie', fmt(bs.assets.current.cashAndBank), { indent: 4 });
  y = drawRow(doc, y, 'Actifs Courants (Classe 3,4,5)', fmt(bs.assets.current.total), { bold: true });
  y = drawSeparator(doc, y);
  y = drawRow(doc, y, 'TOTAL ACTIFS', fmt(bs.assets.total), { bold: true, total: true, color: [26, 26, 46] });

  y += 6;
  y = drawSectionHeader(doc, 'PASSIF & CAPITAUX PROPRES (Ressources)', y);
  y = drawRow(doc, y, 'Capital social', fmt(bs.equity.socialCapital), { indent: 4 });
  y = drawRow(doc, y, 'Réserves légales', fmt(bs.equity.legalReserve), { indent: 4 });
  y = drawRow(doc, y, 'Résultat net', fmt(bs.equity.retainedEarnings), { indent: 4 });
  y = drawRow(doc, y, 'Capitaux Propres (Classe 1)', fmt(bs.equity.total), { bold: true });
  y = drawRow(doc, y, 'Emprunts bancaires', fmt(bs.liabilities.nonCurrent.bankLoans), { indent: 4 });
  y = drawRow(doc, y, 'Passifs Non Courants', fmt(bs.liabilities.nonCurrent.total), { bold: true });
  y = drawRow(doc, y, 'Dettes fournisseurs', fmt(bs.liabilities.current.accountsPayable), { indent: 4 });
  y = drawRow(doc, y, 'Dettes fiscales (IS)', fmt(bs.liabilities.current.taxPayable), { indent: 4 });
  y = drawRow(doc, y, 'Passifs Courants', fmt(bs.liabilities.current.total), { bold: true });
  y = drawSeparator(doc, y);
  y = drawRow(doc, y, 'TOTAL PASSIFS & CAPITAUX PROPRES', fmt(bs.totalLiabilitiesAndEquity), { bold: true, total: true, color: [26, 26, 46] });

  y += 8;
  const balanced = Math.abs(bs.assets.total - bs.totalLiabilitiesAndEquity) < 0.01;
  doc.setFontSize(9);
  doc.setTextColor(balanced ? 16 : 239, balanced ? 185 : 68, balanced ? 129 : 68);
  doc.setFont('helvetica', 'bold');
  doc.text(balanced ? '✓ Bilan équilibré (Actif = Passif + Capitaux Propres)' : '✗ Bilan déséquilibré', M, y);

  /* Footer */
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.setFont('helvetica', 'normal');
  doc.text('Ce document a été généré par Smart Comptable', M, 285);
  doc.text(`Généré le ${todayStr()}`, M, 289);
  doc.text('Page 1', W + M, 285, { align: 'right' });

  doc.save(`Bilan_${data.company.name.replace(/\s+/g, '_')}_${new Date().getFullYear()}.pdf`);
}

export function exportIncomeStatementPDF(data) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const ccy = data.company.currency;
  const fmt = (v) => formatCurrencyHelper(v, ccy);
  const is = data.incomeStatement;

  drawCompanyHeader(doc, data);
  let y = drawTitle(doc, 'État de Résultat', 44);

  y = drawSectionHeader(doc, 'PRODUITS & CHARGES', y);
  y = drawRow(doc, y, 'Produits d\'exploitation', fmt(is.revenue), { color: [16, 185, 129] });
  y = drawRow(doc, y, 'Charges d\'exploitation', `(${fmt(is.operatingExpenses)})`, { color: [200, 50, 50] });
  y = drawSeparator(doc, y);
  y = drawRow(doc, y, 'Résultat d\'exploitation', fmt(is.operatingProfit), { bold: true, total: true, color: [26, 26, 46] });

  y += 3;
  y = drawRow(doc, y, 'Produits financiers', '0 TND', { indent: 4, color: [100] });
  y = drawRow(doc, y, 'Charges financières', '0 TND', { indent: 4, color: [100] });
  y = drawRow(doc, y, 'Résultat des activités ordinaires', fmt(is.ordinaryProfit), { bold: true });

  y += 3;
  y = drawRow(doc, y, 'Impôt sur les sociétés (Taux 15%)', `(${fmt(is.tax)})`, { color: [200, 50, 50] });
  y = drawSeparator(doc, y);
  y = drawRow(doc, y, 'RÉSULTAT NET DE L\'EXERCICE', fmt(is.netProfit), { bold: true, total: true, color: is.netProfit >= 0 ? [16, 185, 129] : [239, 68, 68] });

  y += 8;
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'normal');
  doc.text(`Marge d'exploitation: ${is.revenue > 0 ? Math.round((is.operatingProfit / is.revenue) * 100) : 0}%`, M, y);
  doc.text('Charge d\'IS calculée selon régime standard PME tunisien (15% du bénéfice net).', M, y + 4);

  /* Footer */
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text('Ce document a été généré par Smart Comptable', M, 285);
  doc.text(`Généré le ${todayStr()}`, M, 289);
  doc.text('Page 1', W + M, 285, { align: 'right' });

  doc.save(`Resultat_${data.company.name.replace(/\s+/g, '_')}_${new Date().getFullYear()}.pdf`);
}
