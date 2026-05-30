import { jsPDF } from 'jspdf';
import { formatCurrencyHelper } from './accountingUtils';

const LH = 5.8;

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function header(doc, data) {
  doc.setFontSize(16); doc.setTextColor(26, 26, 46); doc.setFont('helvetica', 'bold');
  doc.text(data.company.name || 'Smart Comptable', 10, 18);
  doc.setFontSize(7); doc.setTextColor(100); doc.setFont('helvetica', 'normal');
  doc.text(`MF: ${data.company.mf}  |  ${data.company.address}`, 10, 24);
  doc.text(`Exercice: ${new Date().getFullYear()}  |  Généré le ${todayStr()}`, 10, 28);
  doc.setDrawColor(26, 26, 46); doc.setLineWidth(0.5);
  doc.line(10, 31, 200, 31);
}

function sectionH(doc, x, y, w, text) {
  doc.setFillColor(26, 26, 46); doc.rect(x, y - 2.5, w, 5.5, 'F');
  doc.setFontSize(7.5); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
  doc.text(text, x + 1.5, y + 1);
  return y + 5.5;
}

function item(doc, x, y, w, label, value, opts = {}) {
  const { bold = false, total = false, indent = 0, color = [80, 80, 80], valColor } = opts;
  if (total) { doc.setFillColor(235, 240, 255); doc.rect(x, y - 2.5, w, 5.5, 'F'); }
  doc.setFontSize(total ? 8.5 : 7);
  doc.setTextColor(color[0], color[1], color[2]);
  doc.setFont('helvetica', bold || total ? 'bold' : 'normal');
  doc.text(label, x + 1.5 + indent, y + 1);
  const vc = valColor || (total ? [26, 26, 46] : color);
  doc.setTextColor(vc[0], vc[1], vc[2]);
  doc.text(value, x + w - 1.5, y + 1, { align: 'right' });
  if (!total) { doc.setDrawColor(215, 215, 215); doc.setLineWidth(0.12); doc.line(x, y + 3.8, x + w, y + 3.8); }
  return y + LH;
}

function sep(doc, x, y, w) {
  doc.setDrawColor(26, 26, 46); doc.setLineWidth(0.3);
  doc.line(x, y, x + w, y);
  return y + 2;
}

function colHeader(doc, x, y, w, text) {
  doc.setFillColor(50, 50, 70); doc.rect(x, y - 2.5, w, 5.5, 'F');
  doc.setFontSize(7.5); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
  doc.text(text, x + w / 2, y + 1, { align: 'center' });
  return y + 5.5;
}

export function exportBalanceSheetPDF(data) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const ccy = data.company.currency;
  const fmt = (v) => formatCurrencyHelper(v, ccy);
  const bs = data.balanceSheet;

  header(doc, data);
  doc.setFontSize(11); doc.setTextColor(26, 26, 46); doc.setFont('helvetica', 'bold');
  doc.text('BILAN (SCE) — ACTIF / PASSIF', 10, 37);
  doc.setDrawColor(26, 26, 46); doc.setLineWidth(0.3);
  doc.line(10, 39, 200, 39);

  const lx = 10, rx = 105, cw = 90;
  let ly = 46, ry = 46;

  /* Helper: draws a table row with label + value */
  function trow(y, x, w, label, val, opts = {}) {
    const { section, total, indent, valClr } = opts;
    if (total) {
      doc.setDrawColor(26, 26, 46); doc.setLineWidth(0.5);
      doc.line(x, y - 0.3, x + w, y - 0.3);
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 26, 46);
      doc.text(label, x + 1 + (indent || 0), y + 1.2);
      doc.text(val, x + w - 1, y + 1.2, { align: 'right' });
      doc.setDrawColor(200); doc.setLineWidth(0.2);
      doc.line(x, y + 2.8, x + w, y + 2.8);
      return y + 3.5;
    }
    if (section) {
      doc.setFillColor(26, 26, 46); doc.rect(x, y - 1.5, w, 4.5, 'F');
      doc.setFontSize(7); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
      doc.text(label, x + 1 + (indent || 0), y + 1);
      doc.text(val, x + w - 1, y + 1, { align: 'right' });
      return y + 4.5;
    }
    doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    doc.setTextColor(valClr || [80, 80, 80]);
    doc.text(label, x + 1 + (indent || 0), y + 1);
    doc.setFont('helvetica', 'bold');
    doc.text(val, x + w - 1, y + 1, { align: 'right' });
    doc.setDrawColor(215, 215, 215); doc.setLineWidth(0.1);
    doc.line(x, y + 3.2, x + w, y + 3.2);
    return y + 4;
  }

  /* === LEFT: ACTIFS === */
  ly = trow(ly, lx, cw, 'ACTIFS', '', { section: true });
  ly = trow(ly, lx, cw, 'Actifs Non Courants', '', { section: true, valClr: [200,200,200] });
  ly = trow(ly, lx, cw, '  Brevets, licences, marques', fmt(bs.assets.nonCurrent.intangibleDetail.patents), { indent: 6, valClr: [110,110,110] });
  ly = trow(ly, lx, cw, '  Fonds commercial', fmt(bs.assets.nonCurrent.intangibleDetail.goodwill), { indent: 6, valClr: [110,110,110] });
  ly = trow(ly, lx, cw, '  Autres immob. incorporelles', fmt(bs.assets.nonCurrent.intangibleDetail.devCosts), { indent: 6, valClr: [110,110,110] });
  ly = trow(ly, lx, cw, 'Immobilisations incorporelles', fmt(bs.assets.nonCurrent.intangible), { indent: 3 });
  ly = trow(ly, lx, cw, '  Terrains', fmt(bs.assets.nonCurrent.tangibleDetail.land), { indent: 6, valClr: [110,110,110] });
  ly = trow(ly, lx, cw, '  Constructions', fmt(bs.assets.nonCurrent.tangibleDetail.buildings), { indent: 6, valClr: [110,110,110] });
  ly = trow(ly, lx, cw, '  Installations techniques', fmt(bs.assets.nonCurrent.tangibleDetail.equipment), { indent: 6, valClr: [110,110,110] });
  ly = trow(ly, lx, cw, '  Matériel de transport', fmt(bs.assets.nonCurrent.tangibleDetail.transport), { indent: 6, valClr: [110,110,110] });
  ly = trow(ly, lx, cw, '  Mobilier & matériel bureau', fmt(bs.assets.nonCurrent.tangibleDetail.officeEquip), { indent: 6, valClr: [110,110,110] });
  ly = trow(ly, lx, cw, 'Immobilisations corporelles', fmt(bs.assets.nonCurrent.tangible), { indent: 3 });
  ly = trow(ly, lx, cw, 'Immobilisations financières', fmt(bs.assets.nonCurrent.financial), { indent: 3 });

  ly = trow(ly, lx, cw, 'Actifs Courants', '', { section: true, valClr: [200,200,200] });
  ly = trow(ly, lx, cw, '  Marchandises', fmt(bs.assets.current.stockDetail.merchandise), { indent: 6, valClr: [110,110,110] });
  ly = trow(ly, lx, cw, '  Matières premières', fmt(bs.assets.current.stockDetail.rawMaterials), { indent: 6, valClr: [110,110,110] });
  ly = trow(ly, lx, cw, 'Stocks', fmt(bs.assets.current.stocks), { indent: 3 });
  ly = trow(ly, lx, cw, 'Clients et comptes rattachés', fmt(bs.assets.current.receivables), { indent: 3 });
  ly = trow(ly, lx, cw, '  Personnel', fmt(bs.assets.current.personnelRec), { indent: 6, valClr: [110,110,110] });
  ly = trow(ly, lx, cw, '  État et collectivités', fmt(bs.assets.current.taxRec), { indent: 6, valClr: [110,110,110] });
  ly = trow(ly, lx, cw, '  Autres débiteurs', fmt(bs.assets.current.otherRec), { indent: 6, valClr: [110,110,110] });
  ly = trow(ly, lx, cw, 'Banque', fmt(bs.assets.current.cashAndBank), { indent: 3 });
  ly = trow(ly, lx, cw, '  Caisse', fmt(bs.assets.current.cashRegister), { indent: 6, valClr: [110,110,110] });
  ly = trow(ly, lx, cw, 'TOTAL ACTIFS', fmt(bs.assets.total), { total: true });

  /* === RIGHT: PASSIFS & CAPITAUX PROPRES === */
  ry = trow(ry, rx, cw, 'PASSIFS & CAPITAUX PROPRES', '', { section: true });
  ry = trow(ry, rx, cw, 'Capitaux Propres', '', { section: true, valClr: [200,200,200] });
  ry = trow(ry, rx, cw, 'Capital social', fmt(bs.equity.socialCapital), { indent: 3 });
  ry = trow(ry, rx, cw, 'Réserves légales', fmt(bs.equity.legalReserve), { indent: 3 });
  ry = trow(ry, rx, cw, '  Autres réserves', fmt(bs.equity.otherReserves), { indent: 6, valClr: [110,110,110] });
  ry = trow(ry, rx, cw, 'Résultat net de l\'exercice', fmt(bs.equity.retainedEarnings), { indent: 3 });

  ry = trow(ry, rx, cw, 'Passifs Non Courants', '', { section: true, valClr: [200,200,200] });
  ry = trow(ry, rx, cw, 'Emprunts bancaires', fmt(bs.liabilities.nonCurrent.bankLoans), { indent: 3 });
  ry = trow(ry, rx, cw, '  Provisions', fmt(bs.liabilities.nonCurrent.provisions), { indent: 6, valClr: [110,110,110] });

  ry = trow(ry, rx, cw, 'Passifs Courants', '', { section: true, valClr: [200,200,200] });
  ry = trow(ry, rx, cw, 'Fournisseurs et comptes rattachés', fmt(bs.liabilities.current.accountsPayable), { indent: 3 });
  ry = trow(ry, rx, cw, 'Personnel', fmt(bs.liabilities.current.personnelPayable), { indent: 3 });
  ry = trow(ry, rx, cw, 'État — IS', fmt(bs.liabilities.current.taxPayable), { indent: 3 });
  ry = trow(ry, rx, cw, 'État — TVA due', fmt(bs.liabilities.current.vatPayable), { indent: 3 });
  ry = trow(ry, rx, cw, '  Autres dettes', fmt(bs.liabilities.current.otherPayables), { indent: 6, valClr: [110,110,110] });
  ry = trow(ry, rx, cw, '  Concours bancaires', fmt(bs.liabilities.current.bankOverdraft), { indent: 6, valClr: [110,110,110] });
  ry = trow(ry, rx, cw, 'TOTAL PASSIFS & CP', fmt(bs.totalLiabilitiesAndEquity), { total: true });

  /* Balance verification at bottom center */
  const checkY = Math.max(ly, ry) + 6;
  const balanced = Math.abs(bs.assets.total - bs.totalLiabilitiesAndEquity) < 0.01;
  doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.setTextColor(balanced ? 16 : 239, balanced ? 185 : 68, balanced ? 129 : 68);
  doc.text(balanced ? '✓ Bilan équilibré (Actif = Passif + Capitaux Propres)' : '✗ Bilan déséquilibré', 105, checkY, { align: 'center' });

  /* Footer */
  doc.setFontSize(6); doc.setTextColor(150); doc.setFont('helvetica', 'normal');
  doc.text('Document généré par Smart Comptable — SCE Tunisie', 10, 285);
  doc.text(`Généré le ${todayStr()}`, 10, 289);
  doc.text('Page 1', 200, 285, { align: 'right' });

  /* ====== PAGE 2: ÉTAT DE RÉSULTAT ====== */
  doc.addPage();
  header(doc, data);
  const is = data.incomeStatement;
  doc.setFontSize(11); doc.setTextColor(26, 26, 46); doc.setFont('helvetica', 'bold');
  doc.text('ÉTAT DE RÉSULTAT (SCE)', 10, 37);
  doc.setDrawColor(26, 26, 46); doc.setLineWidth(0.3);
  doc.line(10, 39, 200, 39);

  const x = 10, w = 190;
  let y = 46;

  y = sectionH(doc, x, y, w, 'PRODUITS D\'EXPLOITATION');
  y = item(doc, x, y, w, 'Ventes de marchandises', fmt(is.productSales), { indent: 4, color: [16, 185, 129] });
  y = item(doc, x, y, w, 'Prestations de services', fmt(is.serviceRevenue), { indent: 4, color: [16, 185, 129] });
  y = item(doc, x, y, w, 'Autres produits', fmt(is.otherRevenue), { indent: 4, color: [100] });
  y = item(doc, x, y, w, 'Total Produits d\'exploitation', fmt(is.revenue), { bold: true, total: true, color: [16, 185, 129] });

  y += 2;
  y = sectionH(doc, x, y, w, 'CHARGES D\'EXPLOITATION');
  y = item(doc, x, y, w, 'Achats de marchandises', `(${fmt(is.purchaseGoods)})`, { indent: 4, color: [200, 50, 50], valColor: [200, 50, 50] });
  y = item(doc, x, y, w, 'Achats de matières premières', `(${fmt(is.purchaseRaw)})`, { indent: 4, color: [200, 50, 50], valColor: [200, 50, 50] });
  y = item(doc, x, y, w, 'Autres achats et charges externes', `(${fmt(is.otherPurchases)})`, { indent: 4, color: [200, 50, 50], valColor: [200, 50, 50] });
  y = item(doc, x, y, w, 'Charges de personnel', `(${fmt(is.personnelCosts)})`, { indent: 4, color: [200, 50, 50], valColor: [200, 50, 50] });
  y = item(doc, x, y, w, 'Dotations aux amortissements', `(${fmt(is.depreciation)})`, { indent: 4, color: [120], valColor: [120] });
  y = item(doc, x, y, w, 'Autres charges d\'exploitation', `(${fmt(is.otherOpCharges)})`, { indent: 4, color: [120], valColor: [120] });
  y = item(doc, x, y, w, 'Total Charges d\'exploitation', `(${fmt(is.operatingExpenses)})`, { bold: true, total: true, color: [200, 50, 50], valColor: [200, 50, 50] });
  y += 1;
  y = item(doc, x, y, w, 'RÉSULTAT D\'EXPLOITATION', fmt(is.operatingProfit), { bold: true, total: true, color: [26, 26, 46] });

  y += 3;
  y = sectionH(doc, x, y, w, 'RÉSULTAT FINANCIER');
  y = item(doc, x, y, w, 'Produits financiers', fmt(is.financialRevenue), { indent: 4, color: [100] });
  y = item(doc, x, y, w, 'Charges financières', `(${fmt(is.financialCosts)})`, { indent: 4, color: [200, 50, 50], valColor: [200, 50, 50] });
  y = item(doc, x, y, w, 'Résultat financier', fmt(is.financialResult), { bold: true });
  y += 1;
  y = item(doc, x, y, w, 'RÉSULTAT DES ACTIVITÉS ORDINAIRES AVANT IS', fmt(is.ordinaryProfit), { bold: true, total: true });

  y += 2;
  y = item(doc, x, y, w, 'Impôt sur les sociétés (15%)', `(${fmt(is.tax)})`, { color: [200, 50, 50], valColor: [200, 50, 50] });
  y += 1;
  const netColor = is.netProfit >= 0 ? [16, 185, 129] : [239, 68, 68];
  y = item(doc, x, y, w, 'RÉSULTAT NET DE L\'EXERCICE', fmt(is.netProfit), { bold: true, total: true, color: netColor, valColor: netColor });

  y += 6;
  doc.setFontSize(7); doc.setTextColor(100); doc.setFont('helvetica', 'normal');
  doc.text(`Marge d'exploitation: ${is.revenue > 0 ? Math.round((is.operatingProfit / is.revenue) * 100) : 0}% | Marge nette: ${is.revenue > 0 ? Math.round((is.netProfit / is.revenue) * 100) : 0}%`, x, y);
  doc.text(`IS calculée au taux standard PME tunisien (15% du résultat ordinaire).`, x, y + 4);

  doc.setFontSize(6); doc.setTextColor(150);
  doc.text('Document généré par Smart Comptable — SCE Tunisie', 10, 285);
  doc.text(`Généré le ${todayStr()}`, 10, 289);
  doc.text('Page 2', 200, 285, { align: 'right' });

  doc.save(`Bilan_SCE_${data.company.name.replace(/\s+/g, '_')}_${new Date().getFullYear()}.pdf`);
}

export function exportIncomeStatementPDF(data) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const ccy = data.company.currency;
  const fmt = (v) => formatCurrencyHelper(v, ccy);
  const is = data.incomeStatement;

  header(doc, data);
  doc.setFontSize(11); doc.setTextColor(26, 26, 46); doc.setFont('helvetica', 'bold');
  doc.text('ÉTAT DE RÉSULTAT (SCE)', 10, 37);
  doc.line(10, 39, 200, 39);

  const x = 10, w = 190;
  let y = 46;

  y = sectionH(doc, x, y, w, 'PRODUITS D\'EXPLOITATION');
  y = item(doc, x, y, w, 'Ventes de marchandises', fmt(is.productSales), { indent: 4, color: [16, 185, 129] });
  y = item(doc, x, y, w, 'Prestations de services', fmt(is.serviceRevenue), { indent: 4, color: [16, 185, 129] });
  y = item(doc, x, y, w, 'Autres produits', fmt(is.otherRevenue), { indent: 4, color: [100] });
  y = item(doc, x, y, w, 'Total Produits d\'exploitation', fmt(is.revenue), { bold: true, total: true, color: [16, 185, 129] });

  y += 2;
  y = sectionH(doc, x, y, w, 'CHARGES D\'EXPLOITATION');
  y = item(doc, x, y, w, 'Achats de marchandises', `(${fmt(is.purchaseGoods)})`, { indent: 4, color: [200, 50, 50], valColor: [200, 50, 50] });
  y = item(doc, x, y, w, 'Achats de matières premières', `(${fmt(is.purchaseRaw)})`, { indent: 4, color: [200, 50, 50], valColor: [200, 50, 50] });
  y = item(doc, x, y, w, 'Autres achats et charges externes', `(${fmt(is.otherPurchases)})`, { indent: 4, color: [200, 50, 50], valColor: [200, 50, 50] });
  y = item(doc, x, y, w, 'Charges de personnel', `(${fmt(is.personnelCosts)})`, { indent: 4, color: [200, 50, 50], valColor: [200, 50, 50] });
  y = item(doc, x, y, w, 'Dotations aux amortissements', `(${fmt(is.depreciation)})`, { indent: 4, color: [120], valColor: [120] });
  y = item(doc, x, y, w, 'Autres charges d\'exploitation', `(${fmt(is.otherOpCharges)})`, { indent: 4, color: [120], valColor: [120] });
  y = item(doc, x, y, w, 'Total Charges d\'exploitation', `(${fmt(is.operatingExpenses)})`, { bold: true, total: true, color: [200, 50, 50], valColor: [200, 50, 50] });
  y += 1;
  y = item(doc, x, y, w, 'RÉSULTAT D\'EXPLOITATION', fmt(is.operatingProfit), { bold: true, total: true, color: [26, 26, 46] });

  y += 3;
  y = sectionH(doc, x, y, w, 'RÉSULTAT FINANCIER');
  y = item(doc, x, y, w, 'Produits financiers', fmt(is.financialRevenue), { indent: 4, color: [100] });
  y = item(doc, x, y, w, 'Charges financières', `(${fmt(is.financialCosts)})`, { indent: 4, color: [200, 50, 50], valColor: [200, 50, 50] });
  y = item(doc, x, y, w, 'Résultat financier', fmt(is.financialResult), { bold: true });
  y += 1;
  y = item(doc, x, y, w, 'RÉSULTAT DES ACTIVITÉS ORDINAIRES AVANT IS', fmt(is.ordinaryProfit), { bold: true, total: true });

  y += 2;
  y = item(doc, x, y, w, 'Impôt sur les sociétés (15%)', `(${fmt(is.tax)})`, { color: [200, 50, 50], valColor: [200, 50, 50] });
  y += 1;
  const netColor = is.netProfit >= 0 ? [16, 185, 129] : [239, 68, 68];
  y = item(doc, x, y, w, 'RÉSULTAT NET DE L\'EXERCICE', fmt(is.netProfit), { bold: true, total: true, color: netColor, valColor: netColor });

  y += 6;
  doc.setFontSize(7); doc.setTextColor(100); doc.setFont('helvetica', 'normal');
  doc.text(`Marge d'exploitation: ${is.revenue > 0 ? Math.round((is.operatingProfit / is.revenue) * 100) : 0}% | Marge nette: ${is.revenue > 0 ? Math.round((is.netProfit / is.revenue) * 100) : 0}%`, x, y);
  doc.text(`IS calculée au taux standard PME tunisien (15% du résultat ordinaire).`, x, y + 4);

  doc.setFontSize(6); doc.setTextColor(150);
  doc.text('Document généré par Smart Comptable — SCE Tunisie', 10, 285);
  doc.text(`Généré le ${todayStr()}`, 10, 289);
  doc.text('Page 1', 200, 285, { align: 'right' });

  doc.save(`Resultat_SCE_${data.company.name.replace(/\s+/g, '_')}_${new Date().getFullYear()}.pdf`);
}
