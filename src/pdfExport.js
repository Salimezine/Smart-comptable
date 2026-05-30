import { jsPDF } from 'jspdf';
import { formatCurrencyHelper } from './accountingUtils';

const M = 15;
const W = 180;
const LH = 6;

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function drawCompanyHeader(doc, data) {
  doc.setFontSize(18);
  doc.setTextColor(26, 26, 46);
  doc.setFont('helvetica', 'bold');
  doc.text(data.company.name || 'Smart Comptable', M, 20);

  doc.setFontSize(7.5);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'normal');
  doc.text(`MF: ${data.company.mf}  |  ${data.company.address}`, M, 27);
  doc.text(`Exercice: ${new Date().getFullYear()}  |  Généré le ${todayStr()}`, M, 32);

  doc.setDrawColor(26, 26, 46);
  doc.setLineWidth(0.6);
  doc.line(M, 35, M + W, 35);
}

function drawTitle(doc, text, y) {
  doc.setFontSize(13);
  doc.setTextColor(26, 26, 46);
  doc.setFont('helvetica', 'bold');
  doc.text(text, M, y);
  return y + 7;
}

function drawSectionHeader(doc, text, y, w) {
  doc.setFillColor(26, 26, 46);
  doc.rect(M, y - 3, w || W, 6.5, 'F');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(text, M + 2, y + 1.5);
  return y + 7;
}

function drawItem(doc, y, label, value, opts = {}) {
  const { bold = false, total = false, indent = 0, color = [80, 80, 80] } = opts;
  const xLabel = M + 2 + indent;
  const xValue = M + W - 2;

  if (total) {
    doc.setFillColor(235, 240, 255);
    doc.rect(M, y - 3, W, 6.5, 'F');
  }

  doc.setFontSize(total ? 9 : 7.5);
  doc.setTextColor(color[0], color[1], color[2]);
  doc.setFont('helvetica', bold || total ? 'bold' : 'normal');
  doc.text(label, xLabel, y + 1);
  doc.text(value, xValue, y + 1, { align: 'right' });

  if (!total) {
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.15);
    doc.line(M, y + 4, M + W, y + 4);
  }
  return y + LH;
}

function drawSeparator(doc, y) {
  doc.setDrawColor(26, 26, 46);
  doc.setLineWidth(0.4);
  doc.line(M, y, M + W, y);
  return y + 2.5;
}

function checkPageBreak(doc, y, needed = 30) {
  if (y + needed > 280) {
    doc.addPage();
    return 20;
  }
  return y;
}

export function exportBalanceSheetPDF(data) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const ccy = data.company.currency;
  const fmt = (v) => formatCurrencyHelper(v, ccy);
  const bs = data.balanceSheet;

  drawCompanyHeader(doc, data);
  let y = drawTitle(doc, 'Bilan — État de la Situation Financière (SCE)', 41);
  y = drawSectionHeader(doc, 'ACTIFS (Emplois)', y);

  // --- ACTIFS NON COURANTS ---
  doc.setFontSize(7.5);
  doc.setTextColor(120);
  doc.setFont('helvetica', 'bold');
  doc.text('Actifs Non Courants', M + 2, y + 1);
  doc.setFont('helvetica', 'normal');
  y += LH;
  y = drawItem(doc, y, 'Frais de développement', fmt(bs.assets.nonCurrent.intangibleDetail.devCosts), { indent: 8, color: [120] });
  y = drawItem(doc, y, 'Brevets, licences, marques', fmt(bs.assets.nonCurrent.intangibleDetail.patents), { indent: 8, color: [120] });
  y = drawItem(doc, y, 'Fonds commercial', fmt(bs.assets.nonCurrent.intangibleDetail.goodwill), { indent: 8, color: [120] });
  y = drawItem(doc, y, 'Immobilisations incorporelles', fmt(bs.assets.nonCurrent.intangible), { bold: true, indent: 4 });

  y = drawItem(doc, y, 'Terrains', fmt(bs.assets.nonCurrent.tangibleDetail.land), { indent: 8, color: [120] });
  y = drawItem(doc, y, 'Constructions', fmt(bs.assets.nonCurrent.tangibleDetail.buildings), { indent: 8, color: [120] });
  y = drawItem(doc, y, 'Installations techniques', fmt(bs.assets.nonCurrent.tangibleDetail.equipment), { indent: 8, color: [120] });
  y = drawItem(doc, y, 'Matériel de transport', fmt(bs.assets.nonCurrent.tangibleDetail.transport), { indent: 8, color: [120] });
  y = drawItem(doc, y, 'Mobilier & matériel de bureau', fmt(bs.assets.nonCurrent.tangibleDetail.officeEquip), { indent: 8, color: [120] });
  y = drawItem(doc, y, 'Immobilisations corporelles', fmt(bs.assets.nonCurrent.tangible), { bold: true, indent: 4 });

  y = drawItem(doc, y, 'Immobilisations financières', fmt(bs.assets.nonCurrent.financial), { indent: 4 });
  y = drawSeparator(doc, y);
  y = drawItem(doc, y, 'Total Actifs Non Courants', fmt(bs.assets.nonCurrent.total), { bold: true, total: true, color: [26, 26, 46] });

  // --- ACTIFS COURANTS ---
  y = checkPageBreak(doc, y, 50);
  doc.setFontSize(7.5);
  doc.setTextColor(120);
  doc.setFont('helvetica', 'bold');
  doc.text('Actifs Courants', M + 2, y + 1);
  doc.setFont('helvetica', 'normal');
  y += LH;

  y = drawItem(doc, y, 'Marchandises', fmt(bs.assets.current.stockDetail.merchandise), { indent: 8, color: [120] });
  y = drawItem(doc, y, 'Matières premières', fmt(bs.assets.current.stockDetail.rawMaterials), { indent: 8, color: [120] });
  y = drawItem(doc, y, 'Stocks', fmt(bs.assets.current.stocks), { bold: true, indent: 4 });

  y = drawItem(doc, y, 'Clients et comptes rattachés', fmt(bs.assets.current.receivables), { indent: 4 });
  y = drawItem(doc, y, 'Personnel', fmt(bs.assets.current.personnelRec), { indent: 4, color: [120] });
  y = drawItem(doc, y, 'État et collectivités', fmt(bs.assets.current.taxRec), { indent: 4, color: [120] });
  y = drawItem(doc, y, 'Autres débiteurs', fmt(bs.assets.current.otherRec), { indent: 4, color: [120] });
  y = drawItem(doc, y, 'Banque', fmt(bs.assets.current.cashAndBank), { indent: 4 });
  y = drawItem(doc, y, 'Caisse', fmt(bs.assets.current.cashRegister), { indent: 4, color: [120] });
  y = drawSeparator(doc, y);
  y = drawItem(doc, y, 'Total Actifs Courants', fmt(bs.assets.current.total), { bold: true, total: true, color: [26, 26, 46] });

  y = drawSeparator(doc, y);
  y = drawItem(doc, y, 'TOTAL ACTIFS', fmt(bs.assets.total), { bold: true, total: true, color: [26, 26, 46] });

  // --- CAPITAUX PROPRES & PASSIFS ---
  y += 6;
  y = checkPageBreak(doc, y, 60);
  y = drawSectionHeader(doc, 'CAPITAUX PROPRES & PASSIFS (Ressources)', y);

  // --- CAPITAUX PROPRES ---
  doc.setFontSize(7.5);
  doc.setTextColor(120);
  doc.setFont('helvetica', 'bold');
  doc.text('Capitaux Propres', M + 2, y + 1);
  doc.setFont('helvetica', 'normal');
  y += LH;

  y = drawItem(doc, y, 'Capital social', fmt(bs.equity.socialCapital), { indent: 4 });
  y = drawItem(doc, y, 'Réserves légales', fmt(bs.equity.legalReserve), { indent: 4 });
  y = drawItem(doc, y, 'Autres réserves', fmt(bs.equity.otherReserves), { indent: 4, color: [120] });
  y = drawItem(doc, y, 'Résultat net de l\'exercice', fmt(bs.equity.retainedEarnings), { indent: 4 });
  y = drawSeparator(doc, y);
  y = drawItem(doc, y, 'Total Capitaux Propres (Classe 1)', fmt(bs.equity.total), { bold: true, total: true, color: [26, 26, 46] });

  // --- PASSIFS NON COURANTS ---
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(7.5);
  doc.setTextColor(120);
  doc.setFont('helvetica', 'bold');
  doc.text('Passifs Non Courants', M + 2, y + 1);
  doc.setFont('helvetica', 'normal');
  y += LH;

  y = drawItem(doc, y, 'Emprunts bancaires', fmt(bs.liabilities.nonCurrent.bankLoans), { indent: 4 });
  y = drawItem(doc, y, 'Provisions', fmt(bs.liabilities.nonCurrent.provisions), { indent: 4, color: [120] });
  y = drawSeparator(doc, y);
  y = drawItem(doc, y, 'Total Passifs Non Courants', fmt(bs.liabilities.nonCurrent.total), { bold: true, total: true, color: [26, 26, 46] });

  // --- PASSIFS COURANTS ---
  y = checkPageBreak(doc, y, 40);
  doc.setFontSize(7.5);
  doc.setTextColor(120);
  doc.setFont('helvetica', 'bold');
  doc.text('Passifs Courants', M + 2, y + 1);
  doc.setFont('helvetica', 'normal');
  y += LH;

  y = drawItem(doc, y, 'Fournisseurs et comptes rattachés', fmt(bs.liabilities.current.accountsPayable), { indent: 4 });
  y = drawItem(doc, y, 'Personnel', fmt(bs.liabilities.current.personnelPayable), { indent: 4 });
  y = drawItem(doc, y, 'État — Impôt sur les sociétés', fmt(bs.liabilities.current.taxPayable), { indent: 4 });
  y = drawItem(doc, y, 'État — TVA due', fmt(bs.liabilities.current.vatPayable), { indent: 4 });
  y = drawItem(doc, y, 'Autres dettes', fmt(bs.liabilities.current.otherPayables), { indent: 4 });
  y = drawItem(doc, y, 'Concours bancaires', fmt(bs.liabilities.current.bankOverdraft), { indent: 4, color: [120] });
  y = drawSeparator(doc, y);
  y = drawItem(doc, y, 'Total Passifs Courants', fmt(bs.liabilities.current.total), { bold: true, total: true, color: [26, 26, 46] });

  y = drawSeparator(doc, y);
  y = drawItem(doc, y, 'TOTAL PASSIFS & CAPITAUX PROPRES', fmt(bs.totalLiabilitiesAndEquity), { bold: true, total: true, color: [26, 26, 46] });

  /* Verification */
  y += 7;
  const balanced = Math.abs(bs.assets.total - bs.totalLiabilitiesAndEquity) < 0.01;
  doc.setFontSize(8.5);
  doc.setTextColor(balanced ? 16 : 239, balanced ? 185 : 68, balanced ? 129 : 68);
  doc.setFont('helvetica', 'bold');
  doc.text(balanced ? '✓ Bilan équilibré (Actif = Passif + Capitaux Propres)' : '✗ Bilan déséquilibré', M, y);

  /* Footer */
  doc.setFontSize(6.5);
  doc.setTextColor(150);
  doc.setFont('helvetica', 'normal');
  doc.text('Document généré par Smart Comptable — Moteur d\'audit local — SCE Tunisie', M, 285);
  doc.text(`Généré le ${todayStr()}`, M, 289);
  doc.text('Page 1', M + W, 285, { align: 'right' });

  doc.save(`Bilan_SCE_${data.company.name.replace(/\s+/g, '_')}_${new Date().getFullYear()}.pdf`);
}

export function exportIncomeStatementPDF(data) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const ccy = data.company.currency;
  const fmt = (v) => formatCurrencyHelper(v, ccy);
  const is = data.incomeStatement;

  drawCompanyHeader(doc, data);
  let y = drawTitle(doc, 'État de Résultat (SCE)', 41);
  y = drawSectionHeader(doc, 'PRODUITS D\'EXPLOITATION', y);

  y = drawItem(doc, y, 'Ventes de marchandises', fmt(is.productSales), { indent: 4, color: [16, 185, 129] });
  y = drawItem(doc, y, 'Prestations de services', fmt(is.serviceRevenue), { indent: 4, color: [16, 185, 129] });
  y = drawItem(doc, y, 'Autres produits', fmt(is.otherRevenue), { indent: 4, color: [100] });
  y = drawSeparator(doc, y);
  y = drawItem(doc, y, 'Total Produits d\'exploitation', fmt(is.revenue), { bold: true, total: true, color: [16, 185, 129] });

  y += 3;
  y = drawSectionHeader(doc, 'CHARGES D\'EXPLOITATION', y);

  y = drawItem(doc, y, 'Achats de marchandises', `(${fmt(is.purchaseGoods)})`, { indent: 4, color: [200, 50, 50] });
  y = drawItem(doc, y, 'Achats de matières premières', `(${fmt(is.purchaseRaw)})`, { indent: 4, color: [200, 50, 50] });
  y = drawItem(doc, y, 'Autres achats et charges externes', `(${fmt(is.otherPurchases)})`, { indent: 4, color: [200, 50, 50] });
  y = drawItem(doc, y, 'Charges de personnel', `(${fmt(is.personnelCosts)})`, { indent: 4, color: [200, 50, 50] });
  y = drawItem(doc, y, 'Dotations aux amortissements', `(${fmt(is.depreciation)})`, { indent: 4, color: [120] });
  y = drawItem(doc, y, 'Autres charges d\'exploitation', `(${fmt(is.otherOpCharges)})`, { indent: 4, color: [120] });
  y = drawSeparator(doc, y);
  y = drawItem(doc, y, 'Total Charges d\'exploitation', `(${fmt(is.operatingExpenses)})`, { bold: true, total: true, color: [200, 50, 50] });

  y += 2;
  y = drawSeparator(doc, y);
  y = drawItem(doc, y, 'RÉSULTAT D\'EXPLOITATION', fmt(is.operatingProfit), { bold: true, total: true, color: [26, 26, 46] });

  y += 4;
  y = drawSectionHeader(doc, 'RÉSULTAT FINANCIER', y);
  y = drawItem(doc, y, 'Produits financiers', fmt(is.financialRevenue), { indent: 4, color: [100] });
  y = drawItem(doc, y, 'Charges financières', `(${fmt(is.financialCosts)})`, { indent: 4, color: [200, 50, 50] });
  y = drawSeparator(doc, y);
  y = drawItem(doc, y, 'Résultat financier', fmt(is.financialResult), { bold: true });

  y += 2;
  y = drawSeparator(doc, y);
  y = drawItem(doc, y, 'RÉSULTAT DES ACTIVITÉS ORDINAIRES AVANT IS', fmt(is.ordinaryProfit), { bold: true, total: true, color: [26, 26, 46] });

  y += 3;
  y = drawItem(doc, y, 'Impôt sur les sociétés (15%)', `(${fmt(is.tax)})`, { color: [200, 50, 50] });
  y = drawSeparator(doc, y);
  y = drawItem(doc, y, 'RÉSULTAT NET DE L\'EXERCICE', fmt(is.netProfit), { bold: true, total: true, color: is.netProfit >= 0 ? [16, 185, 129] : [239, 68, 68] });

  y += 8;
  doc.setFontSize(7.5);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'normal');
  doc.text(`Marge d'exploitation: ${is.revenue > 0 ? Math.round((is.operatingProfit / is.revenue) * 100) : 0}%`, M, y);
  doc.text(`IS calculée au taux standard PME tunisien (15% du résultat ordinaire).`, M, y + 4);
  doc.text(`Résultat net: ${fmt(is.netProfit)}`, M, y + 8);

  /* Footer */
  doc.setFontSize(6.5);
  doc.setTextColor(150);
  doc.text('Document généré par Smart Comptable — Moteur d\'audit local — SCE Tunisie', M, 285);
  doc.text(`Généré le ${todayStr()}`, M, 289);
  doc.text('Page 1', M + W, 285, { align: 'right' });

  doc.save(`Resultat_SCE_${data.company.name.replace(/\s+/g, '_')}_${new Date().getFullYear()}.pdf`);
}
