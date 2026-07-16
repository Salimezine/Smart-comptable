import { jsPDF } from 'jspdf';
import ExcelJS from 'exceljs';

const CURR = 'MDT';

const getVal = (obj, ...keys) => {
  for (const k of keys) {
    const v = obj[k];
    if (v != null) return v;
  }
  return 0;
};

const z = (v) => v ?? 0;

const toMdt = (v) => (v || 0) / 1000;

const fmt = (v) => {
  if (v == null || isNaN(v)) return '0,000';
  try { return v.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }); }
  catch { return v.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }); }
};

const fmtMdt = (v) => fmt(toMdt(v));

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function header(doc, data) {
  const name = data?.company?.name || 'Smart Comptable';
  const mf = data?.company?.mf || 'N/A';
  const addr = data?.company?.address || '';
  const year = data?.company?.year || new Date().getFullYear();
  doc.setFontSize(16); doc.setTextColor(26, 26, 46); doc.setFont('helvetica', 'bold');
  doc.text(name, 10, 18);
  doc.setFontSize(7); doc.setTextColor(100); doc.setFont('helvetica', 'normal');
  doc.text(`MF: ${mf}  |  ${addr}`, 10, 24);
  doc.text(`Exercice: ${year}  |  Généré le ${todayStr()}`, 10, 28);
  doc.setDrawColor(26, 26, 46); doc.setLineWidth(0.5);
  doc.line(10, 31, 200, 31);
}

function sectionH(doc, x, y, w, text) {
  doc.setFillColor(26, 26, 46); doc.rect(x, y - 2.5, w, 5.5, 'F');
  doc.setFontSize(7.5); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
  doc.text(text, x + 1.5, y + 1);
  return y + 5.5;
}

function rgb(c) {
  if (Array.isArray(c)) {
    if (c.length === 1) return [c[0], c[0], c[0]];
    return c;
  }
  if (typeof c === 'string' && c.startsWith('#')) return hexToRgb(c);
  return [c, c, c];
}
function item(doc, x, y, w, label, value, opts = {}) {
  const { bold = false, total = false, indent = 0, color = [80, 80, 80], valColor, section } = opts;
  if (section) {
    doc.setFillColor(230, 230, 240);
    doc.rect(x, y - 2.5, w, 5.5, 'F');
  }
  if (total) { doc.setFillColor(235, 240, 255); doc.rect(x, y - 2.5, w, 5.5, 'F'); }
  doc.setFontSize(total ? 8.5 : section ? 7.5 : 7);
  if (section) doc.setTextColor(60, 60, 80);
  else {
    const c = rgb(total ? '#1a1a2e' : color);
    doc.setTextColor(c[0], c[1], c[2]);
  }
  doc.setFont('helvetica', section || bold || total ? 'bold' : 'normal');
  if (!isNaN(x + 1.5 + indent) && !isNaN(y + 1)) doc.text(label, x + 1.5 + indent, y + 1);
  if (value != null) {
    doc.setFont('helvetica', total || bold ? 'bold' : 'normal');
    if (valColor) doc.setTextColor(valColor[0], valColor[1], valColor[2]);
    else if (total) doc.setTextColor(26, 26, 46);
    else {
      const c = rgb(section ? '#3c3c50' : '#3c3c3c');
      doc.setTextColor(c[0], c[1], c[2]);
    }
    if (!isNaN(x + w - 1.5) && !isNaN(y + 1)) doc.text(value, x + w - 1.5, y + 1, { align: 'right' });
  }
  if (total && !section) {
    doc.setDrawColor(26, 26, 46); doc.setLineWidth(0.5);
    doc.line(x, y + 3.5, x + w, y + 3.5);
  } else if (!section) {
    doc.setDrawColor(215, 215, 215); doc.setLineWidth(0.12);
    doc.line(x, y + 3.8, x + w, y + 3.8);
  }
  return y + (section ? 5.5 : 5);
}

function footer(doc, pageNum) {
  doc.setFontSize(6); doc.setTextColor(150);
  doc.text('Document généré par Smart Comptable — SCE Tunisie', 10, 285);
  doc.text(`Généré le ${todayStr()}`, 10, 289);
  doc.text(`Page ${pageNum}`, 200, 285, { align: 'right' });
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function drawCell(doc, x, y, w, h, text, opts = {}) {
  const { align = 'left', bold = false, color = '#cbd5e1', fill, fontSize = 8 } = opts;
  if (fill) {
    doc.setFillColor(...hexToRgb(fill));
    doc.rect(x, y, w, h, 'F');
  }
  doc.setFontSize(fontSize);
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setTextColor(...hexToRgb(color));
  const tx = align === 'right' ? x + w - 3 : x + 3;
  const ty = y + h / 2 + fontSize / 3;
  if (isNaN(tx) || isNaN(ty)) {
    console.warn('drawCell invalid coords', { x, y, w, h, tx, ty, text, align });
    return;
  }
  doc.text(String(text ?? ''), tx, ty, { align: align === 'right' ? 'right' : 'left' });
}

function drawTable(doc, x, y, colWidths, rows, opts = {}) {
  const { headerColor = '#1a1a2e', rowColors = ['#1e293b', '#1a1e2e'] } = opts;
  let cy = y;
  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const isHeader = ri === 0;
    const h = isHeader ? 7 : 6;
    let cx = x;
    for (let ci = 0; ci < row.length; ci++) {
      const w = colWidths[ci] || 30;
      if (isHeader) {
        drawCell(doc, cx, cy, w, h, row[ci], { bold: true, color: '#94a3b8', fill: headerColor, fontSize: 7 });
      } else {
        const fill = rowColors[ri % rowColors.length];
        const align = ci > 0 && !isNaN(parseFloat(String(row[ci]).replace(',', '.'))) ? 'right' : 'left';
        const isTotal = String(row[ci]).startsWith('=') || String(row[0]).startsWith('Total');
        drawCell(doc, cx, cy, w, h, String(row[ci]).replace(/^=/, ''), { align, color: isTotal ? '#f1f5f9' : '#cbd5e1', fill, fontSize: 6.5, bold: isTotal });
      }
      cx += w;
    }
    cy += h;
    const [dr, dg, db] = hexToRgb('#334155');
    doc.setDrawColor(dr, dg, db);
    doc.setLineWidth(0.3);
    doc.line(x, cy, x + colWidths.reduce((a, b) => a + b, 0), cy);
  }
  return cy;
}

function wrapDocText(doc) {
  const _origText = doc.text;
  doc.text = function(text, x, y, ...rest) {
    if (typeof text === 'undefined' || text === null || isNaN(x) || isNaN(y)) {
      console.warn('doc.text skipped', { text, x, y });
      return doc;
    }
    try { return _origText.call(doc, text, x, y, ...rest); }
    catch(e) {
      console.error('doc.text failed', { text, x, y, rest, error: e.message });
      return doc;
    }
  };
  return doc;
}

export function exportReportsPDF(reports) {
  const { bilan, resultat, sig, ratios, fluxTresorerie, balanceGenerale, notes, accountingPolicies, tableauxData, bilanPrev } = reports;
  const doc = wrapDocText(new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }));

  const $b = (k, ...fallbacks) => getVal(bilan, k, ...fallbacks);
  const $r = (k, ...fallbacks) => getVal(resultat, k, ...fallbacks);
  const $sig = (k, ...fallbacks) => getVal(sig, k, ...fallbacks);
  const $fl = (k, ...fallbacks) => getVal(fluxTresorerie, k, ...fallbacks);
  const $ra = (k, ...fallbacks) => getVal(ratios, k, ...fallbacks);

  // ══════════ PAGE 1: BILAN (side-by-side) ══════════
  header(doc, reports);
  doc.setFontSize(11); doc.setTextColor(26, 26, 46); doc.setFont('helvetica', 'bold');
  const yearN = reports?.company?.year || 'N';
  const yearN_1 = bilanPrev ? (Number(yearN) - 1) : '';
  const subtitle = bilanPrev ? `BILAN (SCE) — ACTIF / PASSIF  (en MDT)  —  ${yearN_1} / ${yearN}` : `BILAN (SCE) — ACTIF / PASSIF  (en MDT)  —  ${yearN}`;
  doc.text(subtitle, 10, 37);
  doc.setDrawColor(26, 26, 46); doc.setLineWidth(0.3);
  doc.line(10, 39, 200, 39);

  const $bp = (k, ...fallbacks) => bilanPrev ? getVal(bilanPrev, k, ...fallbacks) : undefined;

  const lx = 10, rx = 105, cw = 90;

  function trow2(y, x, w, label, valN, valN_1, opts = {}) {
    const { section, total, indent } = opts;
    const bg = total ? [235, 240, 255] : section ? [26, 26, 46] : null;
    if (bg) { doc.setFillColor(bg[0], bg[1], bg[2]); doc.rect(x, y - 2, w, 5, 'F'); }
    doc.setFontSize(total ? 8 : section ? 7.5 : 6.8);
    if (section) doc.setTextColor(255, 255, 255);
    else if (total) doc.setTextColor(26, 26, 46);
    else doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', section || total ? 'bold' : 'normal');
    doc.text(label, x + 1 + (indent || 0), y + 1.2);
    const vw = (w - 2) / 2;
    const vx = x + w - 2;
    if (valN != null || valN_1 != null) {
      doc.setFont('helvetica', 'bold');
      if (total) doc.setTextColor(26, 26, 46);
      else if (section) doc.setTextColor(255, 255, 255);
      else doc.setTextColor(60, 60, 60);
      doc.setFontSize(total ? 7.5 : section ? 7 : 6.5);
      if (valN_1 != null) doc.text(String(valN_1), vx - vw, y + 1.2, { align: 'right' });
      if (valN != null) doc.text(String(valN), vx, y + 1.2, { align: 'right' });
    }
    if (total) { doc.setDrawColor(26, 26, 46); doc.setLineWidth(0.5); doc.line(x, y + 3.5, x + w, y + 3.5); }
    else { doc.setDrawColor(210, 210, 210); doc.setLineWidth(0.1); doc.line(x, y + 3.5, x + w, y + 3.5); }
    return y + 5;
  }

  function drawSide(y, x, w, side, items) {
    y = trow2(y, x, w, side, '', '', { section: true });
    let section = '';
    for (const item of items) {
      if (item.section && item.section !== section) {
        section = item.section;
        y = trow2(y, x, w, item.section, '', '', { section: true, valClr: [200, 200, 200] });
      }
      y = trow2(y, x, w, item.label, item.val, item.valN_1, { indent: item.indent || 0, total: item.total });
      if (item.after) item.after(y, x, w);
    }
    return y;
  }

  // Column header for N/N-1
  if (bilanPrev) {
    doc.setFontSize(6); doc.setTextColor(130); doc.setFont('helvetica', 'italic');
    doc.text(`${yearN_1}           ${yearN}`, lx + cw - 2, 45, { align: 'right' });
    doc.text(`${yearN_1}           ${yearN}`, rx + cw - 2, 45, { align: 'right' });
  }

  let ly = 46, ry = 46;

  ly = drawSide(ly, lx, cw, 'ACTIFS', [
    { section: 'Actifs Non Courants' },
    { label: '  Frais préliminaires', val: fmtMdt($b('fraisPreliminaires')), valN_1: bilanPrev ? fmtMdt($bp('fraisPreliminaires')) : null, indent: 6 },
    { label: '  Immobilisations incorporelles', val: fmtMdt($b('immobilisationsIncorporelles')), valN_1: bilanPrev ? fmtMdt($bp('immobilisationsIncorporelles')) : null, indent: 6 },
    { label: '  Immobilisations corporelles', val: fmtMdt($b('immobilisationsCorporelles')), valN_1: bilanPrev ? fmtMdt($bp('immobilisationsCorporelles')) : null, indent: 6 },
    { label: '  Immobilisations financières', val: fmtMdt($b('immobilisationsFinancieres')), valN_1: bilanPrev ? fmtMdt($bp('immobilisationsFinancieres')) : null, indent: 6 },
    ...(getVal(bilan, 'amortissements', 'amortissementsDeduction') !== 0 ? [{
      label: '  Moins: Amortissements', val: `(${fmtMdt(getVal(bilan, 'amortissements', 'amortissementsDeduction'))})`,
      valN_1: bilanPrev ? `(${fmtMdt(getVal(bilanPrev, 'amortissements', 'amortissementsDeduction'))})` : null, indent: 6
    }] : []),
    { section: 'Actifs Courants' },
    { label: '  Stocks', val: fmtMdt($b('stocks')), valN_1: bilanPrev ? fmtMdt($bp('stocks')) : null, indent: 6 },
    { label: '  Clients et comptes rattachés', val: fmtMdt($b('clients')), valN_1: bilanPrev ? fmtMdt($bp('clients')) : null, indent: 6 },
    { label: '  Autres actifs courants', val: fmtMdt(z($b('etatDebit')) + z($b('personnelDebit')) + z($b('autresCréances', 'autresCréances', 'autresCréances'))),
      valN_1: bilanPrev ? fmtMdt(z($bp('etatDebit')) + z($bp('personnelDebit')) + z($bp('autresCréances', 'autresCréances', 'autresCréances'))) : null, indent: 6 },
    { label: '  Trésorerie', val: fmtMdt($b('tresorerie', 'tresorerieActif')), valN_1: bilanPrev ? fmtMdt($bp('tresorerie', 'tresorerieActif')) : null, indent: 6 },
  ]);

  ry = drawSide(ry, rx, cw, 'PASSIFS & CAPITAUX PROPRES', [
    { section: 'Capitaux Propres' },
    { label: 'Capital social', val: fmtMdt($b('capital', 'capitalSocial')), valN_1: bilanPrev ? fmtMdt($bp('capital', 'capitalSocial')) : null, indent: 3 },
    { label: 'Réserves', val: fmtMdt($b('reserves')), valN_1: bilanPrev ? fmtMdt($bp('reserves')) : null, indent: 3 },
    { label: 'Résultats reportés', val: fmtMdt($b('resultatsReportes')), valN_1: bilanPrev ? fmtMdt($bp('resultatsReportes')) : null, indent: 3 },
    { label: 'Résultat de l\'exercice', val: fmtMdt($b('resultatExercice')), valN_1: bilanPrev ? fmtMdt($bp('resultatExercice')) : null, indent: 3 },
    { label: 'Autres capitaux propres', val: fmtMdt($b('autresCapitauxPropres')), valN_1: bilanPrev ? fmtMdt($bp('autresCapitauxPropres')) : null, indent: 3 },
    { section: 'Passifs Non Courants' },
    { label: 'Emprunts', val: fmtMdt($b('emprunts')), valN_1: bilanPrev ? fmtMdt($bp('emprunts')) : null, indent: 3 },
    { label: 'Provisions', val: fmtMdt($b('provisionsDettes', 'provisions')), valN_1: bilanPrev ? fmtMdt($bp('provisionsDettes', 'provisions')) : null, indent: 3 },
    { section: 'Passifs Courants' },
    { label: 'Fournisseurs et comptes rattachés', val: fmtMdt($b('fournisseurs')), valN_1: bilanPrev ? fmtMdt($bp('fournisseurs')) : null, indent: 3 },
    { label: 'État — TVA due', val: fmtMdt($b('etatCredit')), valN_1: bilanPrev ? fmtMdt($bp('etatCredit')) : null, indent: 3 },
    { label: 'Personnel', val: fmtMdt($b('personnelCredit')), valN_1: bilanPrev ? fmtMdt($bp('personnelCredit')) : null, indent: 3 },
    { label: 'Autres dettes', val: fmtMdt($b('autresDettes')), valN_1: bilanPrev ? fmtMdt($bp('autresDettes')) : null, indent: 3 },
    { label: 'Concours bancaires', val: fmtMdt($b('concoursBancaires')), valN_1: bilanPrev ? fmtMdt($bp('concoursBancaires')) : null, indent: 3 },
    { label: 'Emprunts courants', val: fmtMdt($b('empruntsCourants')), valN_1: bilanPrev ? fmtMdt($bp('empruntsCourants')) : null, indent: 3 },
  ]);

  // Aligned totals
  const ty = Math.max(ly, ry) + 1;
  doc.setFillColor(235, 240, 255); doc.rect(lx, ty - 2.5, cw, 6, 'F');
  doc.setFontSize(8); doc.setTextColor(26, 26, 46); doc.setFont('helvetica', 'bold');
  doc.text('TOTAL ACTIFS', lx + 1.5, ty + 1.7);
  const vw = (cw - 2) / 2;
  if (bilanPrev) doc.text(fmtMdt($bp('totalActif')), lx + cw - 2 - vw, ty + 1.7, { align: 'right' });
  doc.text(fmtMdt($b('totalActif')), lx + cw - 2, ty + 1.7, { align: 'right' });
  doc.setDrawColor(26, 26, 46); doc.setLineWidth(0.6);
  doc.line(lx, ty + 3.5, lx + cw, ty + 3.5);

  doc.setFillColor(235, 240, 255); doc.rect(rx, ty - 2.5, cw, 6, 'F');
  doc.setFontSize(8); doc.setTextColor(26, 26, 46); doc.setFont('helvetica', 'bold');
  doc.text('TOTAL PASSIFS & CP', rx + 1.5, ty + 1.7);
  if (bilanPrev) doc.text(fmtMdt($bp('totalPassif')), rx + cw - 2 - vw, ty + 1.7, { align: 'right' });
  doc.text(fmtMdt($b('totalPassif')), rx + cw - 2, ty + 1.7, { align: 'right' });
  doc.setDrawColor(26, 26, 46); doc.setLineWidth(0.6);
  doc.line(rx, ty + 3.5, rx + cw, ty + 3.5);

  footer(doc, 1);

  // ══════════ PAGE 2: ÉTAT DE RÉSULTAT ══════════
  doc.addPage();
  header(doc, reports);
  doc.setFontSize(11); doc.setTextColor(26, 26, 46); doc.setFont('helvetica', 'bold');
  doc.text('ÉTAT DE RÉSULTAT (SCE)  (en MDT)', 10, 37);
  doc.setDrawColor(26, 26, 46); doc.setLineWidth(0.3);
  doc.line(10, 39, 200, 39);

  const x = 10, w = 190;
  let y = 46;

  y = sectionH(doc, x, y, w, "PRODUITS D'EXPLOITATION");
  y = item(doc, x, y, w, 'Ventes de marchandises / Prestations', fmtMdt($r('ventes')), { indent: 4, color: [16, 185, 129] });
  y = item(doc, x, y, w, 'Production stockée', fmtMdt($r('productionStockee')), { indent: 4, color: [100] });
  y = item(doc, x, y, w, 'Subventions d\'exploitation', fmtMdt($r('subventionsExploitation')), { indent: 4, color: [100] });
  y = item(doc, x, y, w, 'Autres produits', fmtMdt($r('autresProduits')), { indent: 4, color: [100] });
  y = item(doc, x, y, w, 'Total Produits d\'exploitation', fmtMdt($r('produitsExploitation', 'totalProduitsExploitation', 'produits')), { bold: true, total: true, color: [16, 185, 129] });

  y += 2;
  y = sectionH(doc, x, y, w, "CHARGES D'EXPLOITATION");
  y = item(doc, x, y, w, 'Achats consommés', `(${fmtMdt($r('achatsConsommes', 'achats'))})`, { indent: 4, color: [200, 50, 50], valColor: [200, 50, 50] });
  y = item(doc, x, y, w, 'Charges externes', `(${fmtMdt($r('chargesExternes'))})`, { indent: 4, color: [200, 50, 50], valColor: [200, 50, 50] });
  y = item(doc, x, y, w, 'Autres services extérieurs', `(${fmtMdt($r('autresServicesExterieurs'))})`, { indent: 4, color: [200, 50, 50], valColor: [200, 50, 50] });
  y = item(doc, x, y, w, 'Charges de personnel', `(${fmtMdt($r('chargesPersonnel'))})`, { indent: 4, color: [200, 50, 50], valColor: [200, 50, 50] });
  y = item(doc, x, y, w, 'Impôts et taxes', `(${fmtMdt($r('impotsTaxes'))})`, { indent: 4, color: [120], valColor: [120] });
  y = item(doc, x, y, w, 'Dotations aux amortissements', `(${fmtMdt($r('dotations'))})`, { indent: 4, color: [120], valColor: [120] });
  y = item(doc, x, y, w, 'Autres charges d\'exploitation', `(${fmtMdt($r('autresCharges'))})`, { indent: 4, color: [120], valColor: [120] });
  y = item(doc, x, y, w, 'Total Charges d\'exploitation', `(${fmtMdt($r('chargesExploitation', 'totalChargesExploitation', 'charges'))})`, { bold: true, total: true, color: [200, 50, 50], valColor: [200, 50, 50] });
  y += 1;
  y = item(doc, x, y, w, "RÉSULTAT D'EXPLOITATION", fmtMdt($r('resultatExploitation')), { bold: true, total: true, color: [26, 26, 46] });

  y += 3;
  y = sectionH(doc, x, y, w, 'RÉSULTAT FINANCIER');
  y = item(doc, x, y, w, 'Produits financiers', fmtMdt($r('produitsFinanciers')), { indent: 4, color: [100] });
  y = item(doc, x, y, w, 'Charges financières', `(${fmtMdt($r('chargesFinancieres'))})`, { indent: 4, color: [200, 50, 50], valColor: [200, 50, 50] });
  y = item(doc, x, y, w, 'Résultat financier', fmtMdt($r('resultatFinancier')), { bold: true });
  y += 3;
  y = sectionH(doc, x, y, w, 'RÉSULTAT EXCEPTIONNEL');
  y = item(doc, x, y, w, 'Produits exceptionnels', fmtMdt($r('produitsExceptionnels')), { indent: 4, color: [100] });
  y = item(doc, x, y, w, 'Charges exceptionnelles', `(${fmtMdt($r('chargesExceptionnelles'))})`, { indent: 4, color: [200, 50, 50], valColor: [200, 50, 50] });
  y = item(doc, x, y, w, 'Résultat exceptionnel', fmtMdt($r('resultatExceptionnel')), { bold: true });
  y += 1;
  y = item(doc, x, y, w, "RÉSULTAT DES ACTIVITÉS ORDINAIRES AVANT IS", fmtMdt(getVal(resultat, 'resultatAvantImpot', 'rcai')), { bold: true, total: true });

  y += 2;
  y = item(doc, x, y, w, 'Impôt sur les sociétés', `(${fmtMdt(getVal(resultat, 'impot', 'impotIS', 'impotsTaxes'))})`, { color: [200, 50, 50], valColor: [200, 50, 50] });
  y += 1;
  const net = $r('resultatNet');
  const netColor = net >= 0 ? [16, 185, 129] : [239, 68, 68];
  y = item(doc, x, y, w, "RÉSULTAT NET DE L'EXERCICE", fmtMdt(net), { bold: true, total: true, color: netColor, valColor: netColor });

  y += 6;
  const produits = $r('produitsExploitation', 'totalProduitsExploitation', 'produits');
  doc.setFontSize(7); doc.setTextColor(100); doc.setFont('helvetica', 'normal');
  doc.text(`Marge d'exploitation: ${produits > 0 ? Math.round(($r('resultatExploitation') / produits) * 100) : 0}% | Marge nette: ${produits > 0 ? Math.round((net / produits) * 100) : 0}%`, x, y);
  doc.text('Impôt sur les sociétés basé sur les données de la balance.', x, y + 4);

  footer(doc, 2);

  // ══════════ PAGE 3: SIG ══════════
  doc.addPage();
  y = 15;
  doc.setFontSize(12); doc.setTextColor(26, 26, 46); doc.setFont('helvetica', 'bold');
  doc.text('SOLDES INTERMÉDIAIRES DE GESTION (SIG)', 10, y);
  y += 8;
  y = drawTable(doc, x, y, [100, 50], [
    ['Poste', 'Montant (MDT)'],
    ['Marge commerciale', fmtMdt($sig('margeCommerciale'))],
    ['+ Production de l\'exercice', fmtMdt($sig('productionExercice'))],
    ['- Achats consommés (hors marchandises)', fmtMdt($sig('achatsConsHorsMarch'))],
    ['- Services extérieurs', fmtMdt($sig('chargesExternes'))],
    ['- Autres services extérieurs', fmtMdt($sig('autresServicesExterieurs'))],
    ['= VALEUR AJOUTÉE', fmtMdt($sig('valeurAjoutee'))],
    ['+ Subventions d\'exploitation', fmtMdt($r('subventionsExploitation'))],
    ['- Charges de personnel', fmtMdt($r('chargesPersonnel'))],
    ['- Impôts et taxes', fmtMdt($r('impotsTaxes'))],
    ['= EBE', fmtMdt($sig('ebe'))],
    ['+ Autres produits', fmtMdt($r('autresProduits'))],
    ['- Autres charges', fmtMdt($r('autresCharges'))],
    ['+ Reprises', fmtMdt($r('reprises'))],
    ['- Dotations', fmtMdt($r('dotations'))],
    ['= RÉSULTAT D\'EXPLOITATION (SIG)', fmtMdt($sig('sigResultatExploitation'))],
    ['+ Résultat financier', fmtMdt($r('resultatFinancier'))],
    ['= RCAI', fmtMdt($sig('sigRcai'))],
    ['+ Résultat exceptionnel', fmtMdt($r('resultatExceptionnel'))],
    ['= RÉSULTAT AVANT IMPÔT', fmtMdt($r('resultatAvantImpot'))],
    ['- Impôt', fmtMdt(getVal(resultat, 'impot', 'impotIS', 'impotsTaxes'))],
    ['= RÉSULTAT NET (SIG)', fmtMdt($sig('sigResultatNet'))],
  ], { headerColor: '#0f4c81' });
  footer(doc, 3);

  // ══════════ PAGE 4: FLUX DE TRÉSORERIE ══════════
  doc.addPage();
  y = 15;
  doc.setFontSize(12); doc.setTextColor(26, 26, 46); doc.setFont('helvetica', 'bold');
  doc.text('ÉTAT DES FLUX DE TRÉSORERIE', 10, y);
  y += 8;
  y = drawTable(doc, x, y, [100, 50], [
    ['Flux', 'Montant (MDT)'],
    ['Résultat net', fmtMdt($fl('resultatNet'))],
    ['+ Dotations', fmtMdt($fl('dotations'))],
    ['- Reprises', fmtMdt($fl('reprises'))],
    ['= MBA', fmtMdt($fl('margeBruteAutofinancement'))],
    ['Flux de trésorerie d\'exploitation', fmtMdt($fl('fluxExploitation'))],
    ['Flux de trésorerie d\'investissement', fmtMdt($fl('fluxInvestissement'))],
    ['Flux de trésorerie de financement', fmtMdt($fl('fluxFinancement'))],
    ['= VARIATION DE TRÉSORERIE', fmtMdt($fl('variationTresorerie'))],
    ['Trésorerie finale', fmtMdt($fl('tresorerieFinale', 'tresorerie'))],
  ], { headerColor: '#0f4c81' });
  footer(doc, 4);

  // ══════════ PAGE 5: RATIOS ══════════
  doc.addPage();
  y = 15;
  doc.setFontSize(12); doc.setTextColor(26, 26, 46); doc.setFont('helvetica', 'bold');
  doc.text('RATIOS FINANCIERS', 10, y);
  y += 8;
  const fmtRat = (v) => {
    if (v == null || isNaN(v)) return 'N/A';
    if (Number.isInteger(v)) return v.toLocaleString('fr-TN');
    return v.toLocaleString('fr-TN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const lg = $ra('liquiditeGenerale');
  y = drawTable(doc, x, y, [90, 40, 40], [
    ['Ratio', 'Valeur', 'Interprétation'],
    ['Liquidité générale', fmtRat(lg), lg >= 1 ? 'Satisfaisant' : 'Faible'],
    ['Liquidité réduite', fmtRat($ra('liquiditeReduite')), ''],
    ['Autonomie financière', ($ra('autonomieFinanciere') * 100).toFixed(1) + '%', $ra('autonomieFinanciere') >= 0.2 ? 'Bonne' : 'Fragile'],
    ['Endettement net', fmtMdt($ra('endettementNet')), ''],
    ['Rentabilité économique', ($ra('rentabiliteEconomique', 'roe') * 100).toFixed(2) + '%', ''],
    ['Rentabilité financière', ($ra('rentabiliteFinanciere', 'roe_', 'roa') * 100).toFixed(2) + '%', ''],
    ['Marge nette', ($ra('margeNette') * 100).toFixed(2) + '%', ''],
    ['Rotation stocks (jours)', fmtRat($ra('rotationStocksJours')), ''],
    ['Délai clients (jours)', fmtRat($ra('delaiClientsJours')), ''],
    ['Délai fournisseurs (jours)', fmtRat($ra('delaiFournisseursJours')), ''],
  ], { headerColor: '#0f4c81' });
  footer(doc, 5);

  // ══════════ PAGE 6: BALANCE GÉNÉRALE ══════════
  doc.addPage();
  header(doc, reports);
  const bgy = 37;
  if (balanceGenerale && balanceGenerale.length > 0) {
    const maxRows = 55;
    let pageCount = 0;
    for (let i = 0; i < balanceGenerale.length; i += maxRows) {
      if (pageCount > 0) { doc.addPage(); header(doc, reports); }
      const chunk = balanceGenerale.slice(i, i + maxRows);
      const cols = [15, 42, 28, 28, 28, 28];
      let by = bgy;
      doc.setFontSize(7);
      doc.text('BALANCE GÉNÉRALE (détail)', 10, by - 7);
      doc.setFillColor(26, 26, 46);
      doc.rect(10, by - 4, 5, 6, 'F');
      ['Compte', 'Libellé', 'Débit', 'Crédit', 'S. Déb.', 'S. Créd.'].forEach((h, ci) => {
        const cx = 10 + cols.slice(0, ci).reduce((a, b) => a + b, 0);
        drawCell(doc, cx, by - 4, cols[ci], 6, h, { bold: true, color: '#94a3b8', fill: '#1a1a2e', fontSize: 6 });
      });
      by += 3;
      for (const b of chunk) {
        const rowColors = ['#1e293b', '#1a1e2e'];
        const fill = rowColors[(i + chunk.indexOf(b)) % 2];
        const vals = [
          b.compte || '', b.libelle || '',
          b.debitTotal > 0 ? b.debitTotal.toLocaleString('fr-TN', { minimumFractionDigits: 3 }) : '',
          b.creditTotal > 0 ? b.creditTotal.toLocaleString('fr-TN', { minimumFractionDigits: 3 }) : '',
          b.soldeDebiteur > 0 ? b.soldeDebiteur.toLocaleString('fr-TN', { minimumFractionDigits: 3 }) : '',
          b.soldeCrediteur > 0 ? b.soldeCrediteur.toLocaleString('fr-TN', { minimumFractionDigits: 3 }) : '',
        ];
        let cx = 10;
        for (let ci = 0; ci < vals.length; ci++) {
          const align = ci >= 2 ? 'right' : 'left';
          drawCell(doc, cx, by, cols[ci], 5, vals[ci], { align, color: '#cbd5e1', fill, fontSize: 5.5 });
          cx += cols[ci];
        }
        by += 5;
        doc.setDrawColor(51, 65, 85); doc.setLineWidth(0.2);
        doc.line(10, by, 10 + cols.reduce((a, b) => a + b, 0), by);
      }
      pageCount++;
    }
  } else {
    doc.setFontSize(8); doc.setTextColor(150); doc.setFont('helvetica', 'italic');
    doc.text('Balance générale non disponible en mode estimé.', 10, bgy + 10);
  }
  footer(doc, 6);

  // ══════════ HELPER: draw a tableau page ══════════
  function drawTableau(doc, title, headers, rows, colWidths, startPage, isEditable) {
    doc.addPage();
    header(doc, reports);
    const ty = 37;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(title, 10, ty - 7);
    const maxRows = Math.floor((275 - ty) / 6);
    let pageCount = 0;
    for (let i = 0; i < rows.length; i += maxRows) {
      if (pageCount > 0) { doc.addPage(); header(doc, reports); }
      const chunk = rows.slice(i, i + maxRows);
      let ry = ty;
      doc.setFontSize(6);
      headers.forEach((h, ci) => {
        const cx = 10 + colWidths.slice(0, ci).reduce((a, b) => a + b, 0);
        drawCell(doc, cx, ry - 4, colWidths[ci], 6, h, { bold: true, color: '#94a3b8', fill: '#1a1a2e', fontSize: 6 });
      });
      ry += 3;
      for (const row of chunk) {
        const fill = '#1e293b';
        let cx = 10;
        const vals = headers.map((_, ci) => {
          return row[ci] != null ? row[ci] : '';
        });
        for (let ci = 0; ci < vals.length; ci++) {
          const align = ci >= 1 ? 'right' : 'left';
          drawCell(doc, cx, ry, colWidths[ci], 5, typeof vals[ci] === 'number' ? vals[ci].toLocaleString('fr-TN', { minimumFractionDigits: 3 }) : String(vals[ci]), { align, color: '#cbd5e1', fill, fontSize: 5.5 });
          cx += colWidths[ci];
        }
        ry += 5;
        doc.setDrawColor(51, 65, 85); doc.setLineWidth(0.2);
        doc.line(10, ry, 10 + colWidths.reduce((a, b) => a + b, 0), ry);
      }
      // Total row
      if (i + maxRows >= rows.length) {
        ry += 1;
        let cx = 10;
        const totalVals = headers.map((_, ci) => {
          if (ci === 0) return 'TOTAL';
          return rows.reduce((s, r, ri) => s + (r[ci] || 0), 0);
        });
        for (let ci = 0; ci < totalVals.length; ci++) {
          const align = ci >= 1 ? 'right' : 'left';
          drawCell(doc, cx, ry, colWidths[ci], 5.5, typeof totalVals[ci] === 'number' ? totalVals[ci].toLocaleString('fr-TN', { minimumFractionDigits: 3 }) : totalVals[ci], { bold: true, align, color: '#e2e8f0', fill: '#0f172a', fontSize: 5.5 });
          cx += colWidths[ci];
        }
      }
      pageCount++;
    }
    footer(doc, startPage + pageCount);
  }

  // ══════════ PAGE 7: TABLEAU DES IMMOBILISATIONS ══════════
  const immoSource = tableauxData?.immobilisations || bilan?.donneesImmobilisations?.lignes || [];
  const immoRows = immoSource.map(l => [l.categorie || l.rubrique || '', l.debut || 0, l.augmentation || 0, l.diminution || 0, l.fin || 0]);
  if (immoRows.length) {
    drawTableau(doc, 'TABLEAU DES IMMOBILISATIONS', ['Catégorie', 'VB Début', 'Acquisitions', 'Cessions', 'VB Fin N'],
      immoRows, [35, 28, 28, 28, 28], 7);
  }

  // ══════════ PAGE 8: TABLEAU DES AMORTISSEMENTS ══════════
  const amorSource = tableauxData?.amortissements || bilan?.donneesAmortissements?.lignes || [];
  const amorRows = amorSource.map(l => [l.categorie || l.rubrique || '', l.debut || 0, l.augmentation || 0, l.diminution || 0, l.fin || 0]);
  if (amorRows.length) {
    drawTableau(doc, 'TABLEAU DES AMORTISSEMENTS', ['Catégorie', 'Amort. Début', 'Dotations', 'Reprises', 'Amort. Fin N'],
      amorRows, [35, 28, 28, 28, 28], 8);
  }

  // ══════════ PAGE 9: TABLEAU DES PROVISIONS ══════════
  const provSource = tableauxData?.provisions || bilan?.donneesProvisions?.lignes || [];
  const provRows = provSource.map(l => [l.categorie || l.rubrique || '', l.debut || 0, l.augmentation || 0, l.diminution || 0, l.fin || 0]);
  if (provRows.length) {
    drawTableau(doc, 'TABLEAU DES PROVISIONS', ['Catégorie', 'Prov. Début', 'Dotations', 'Reprises', 'Prov. Fin N'],
      provRows, [35, 28, 28, 28, 28], 9);
  }

  // ══════════ PAGE 10: VARIATION DES CAPITAUX PROPRES ══════════
  const vcpSource = tableauxData?.variationCP || bilan?.variationCapitauxPropres?.lignes || [];
  const vcpRows = vcpSource.map(l => [l.rubrique || l.categorie || '', l.debut || 0, l.augmentation || 0, l.diminution || 0, l.fin || 0]);
  if (vcpRows.length) {
    drawTableau(doc, 'VARIATION DES CAPITAUX PROPRES', ['Rubrique', 'Solde N-1', 'Augmentations', 'Diminutions', 'Solde N'],
      vcpRows, [40, 28, 28, 28, 28], 10);
  }

  // ══════════ PAGE 11: NOTES AUX ÉTATS FINANCIERS ══════════
  doc.addPage();
  header(doc, reports);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('NOTES AUX ÉTATS FINANCIERS', 10, 37);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  if (reports.notes) {
    doc.text(doc.splitTextToSize(reports.notes, 180), 10, 47);
  } else {
    doc.setTextColor(100);
    doc.setFont('helvetica', 'italic');
    doc.text('Aucune note fournie.', 10, 50);
  }
  footer(doc, 11);

  // ══════════ PAGE 12: PRINCIPES COMPTABLES ══════════
  doc.addPage();
  header(doc, reports);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('PRINCIPES ET MÉTHODES COMPTABLES', 10, 37);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  if (reports.accountingPolicies) {
    doc.text(doc.splitTextToSize(reports.accountingPolicies, 180), 10, 47);
  } else {
    doc.setTextColor(100);
    doc.setFont('helvetica', 'italic');
    doc.text('Aucun principe comptable fourni.', 10, 50);
  }
  footer(doc, 12);

  const companyName = reports?.company?.name || 'SCE';
  const year = reports?.company?.year || new Date().getFullYear();
  doc.save(`Bilan_SCE_${companyName.replace(/\s+/g, '_')}_${year}.pdf`);
}

// ════════════════════════════════════════════
// EXCEL EXPORT
// ════════════════════════════════════════════

export async function exportReportsExcel(reports) {
  const { bilan, resultat, sig, ratios, fluxTresorerie, controle, balanceGenerale, notes, accountingPolicies, tableauxData, bilanPrev } = reports;
  const wb = new ExcelJS.Workbook();
  const numFmt = '#,##0.000';

  const $b = (k, ...fb) => getVal(bilan, k, ...fb);
  const $bp = (k, ...fb) => bilanPrev ? getVal(bilanPrev, k, ...fb) : undefined;
  const $r = (k, ...fb) => getVal(resultat, k, ...fb);
  const $sig = (k, ...fb) => getVal(sig, k, ...fb);
  const $fl = (k, ...fb) => getVal(fluxTresorerie, k, ...fb);
  const $ra = (k, ...fb) => getVal(ratios, k, ...fb);

  const hasPrev = !!bilanPrev;
  const yearN = reports?.company?.year || 'N';
  const yearN_1 = bilanPrev ? (Number(yearN) - 1) : '';

  const addSheet = (name, headers, rows, colWidths) => {
    const ws = wb.addWorksheet(name);
    const hRow = ws.addRow(headers);
    hRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4C81' } };
    if (colWidths) colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    rows.forEach((r, ri) => {
      const row = ws.addRow(r.map(v => v));
      const label = String(r[0] || '');
      const isSection = label === label.toUpperCase() && label.length > 2 && !label.startsWith(' ');
      const isTotal = label.startsWith('=') || label.startsWith('Total') || label.includes('TOTAL');
      if (isTotal) {
        row.font = { bold: true };
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF0FF' } };
      } else if (isSection) {
        row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } };
      }
      r.forEach((v, ci) => {
        if (typeof v === 'number') row.getCell(ci + 1).numFmt = numFmt;
      });
    });
    return ws;
  };

  // ══════════ BILAN (2 sections: Actif + Passif) ══════════
  const bilanHeaders = hasPrev ? ['Rubrique', `N (${yearN}) MDT`, `N-1 (${yearN_1}) MDT`] : ['Rubrique', 'Montant (MDT)'];
  const bCw = hasPrev ? [40, 18, 18] : [40, 18];

  const bilanActifRows = [
    ['ACTIFS NON COURANTS'],
    ['Frais préliminaires', toMdt($b('fraisPreliminaires')), hasPrev ? toMdt($bp('fraisPreliminaires')) : null].filter(v => v !== null),
    ['Immobilisations incorporelles', toMdt($b('immobilisationsIncorporelles')), hasPrev ? toMdt($bp('immobilisationsIncorporelles')) : null].filter(v => v !== null),
    ['Immobilisations corporelles', toMdt($b('immobilisationsCorporelles')), hasPrev ? toMdt($bp('immobilisationsCorporelles')) : null].filter(v => v !== null),
    ['Immobilisations financières', toMdt($b('immobilisationsFinancieres')), hasPrev ? toMdt($bp('immobilisationsFinancieres')) : null].filter(v => v !== null),
  ];
  if (getVal(bilan, 'amortissements', 'amortissementsDeduction') !== 0) {
    const amortN = -toMdt(getVal(bilan, 'amortissements', 'amortissementsDeduction'));
    const amortN_1 = hasPrev ? -toMdt(getVal(bilanPrev, 'amortissements', 'amortissementsDeduction')) : null;
    bilanActifRows.push(['Moins: Amortissements', amortN, ...(hasPrev ? [amortN_1] : [])]);
  }
  bilanActifRows.push(
    ['ACTIFS COURANTS'],
    ['Stocks', toMdt($b('stocks')), hasPrev ? toMdt($bp('stocks')) : null].filter(v => v !== null),
    ['Clients et comptes rattachés', toMdt($b('clients')), hasPrev ? toMdt($bp('clients')) : null].filter(v => v !== null),
    ['Autres actifs courants', toMdt(z($b('etatDebit')) + z($b('personnelDebit')) + z($b('autresCréances', 'autresCréances', 'autresCréances'))),
      hasPrev ? toMdt(z($bp('etatDebit')) + z($bp('personnelDebit')) + z($bp('autresCréances', 'autresCréances', 'autresCréances'))) : null].filter(v => v !== null),
    ['Trésorerie', toMdt($b('tresorerie', 'tresorerieActif')), hasPrev ? toMdt($bp('tresorerie', 'tresorerieActif')) : null].filter(v => v !== null),
    ['= TOTAL ACTIFS', toMdt($b('totalActif')), hasPrev ? toMdt($bp('totalActif')) : null].filter(v => v !== null),
  );

  const bilanPassifRows = [
    ['CAPITAUX PROPRES'],
    ['Capital social', toMdt($b('capital', 'capitalSocial')), hasPrev ? toMdt($bp('capital', 'capitalSocial')) : null].filter(v => v !== null),
    ['Réserves', toMdt($b('reserves')), hasPrev ? toMdt($bp('reserves')) : null].filter(v => v !== null),
    ['Résultats reportés', toMdt($b('resultatsReportes')), hasPrev ? toMdt($bp('resultatsReportes')) : null].filter(v => v !== null),
    ['Résultat de l\'exercice', toMdt($b('resultatExercice')), hasPrev ? toMdt($bp('resultatExercice')) : null].filter(v => v !== null),
    ['Autres capitaux propres', toMdt($b('autresCapitauxPropres')), hasPrev ? toMdt($bp('autresCapitauxPropres')) : null].filter(v => v !== null),
    ['PASSIFS NON COURANTS'],
    ['Emprunts', toMdt($b('emprunts')), hasPrev ? toMdt($bp('emprunts')) : null].filter(v => v !== null),
    ['Provisions', toMdt($b('provisionsDettes', 'provisions')), hasPrev ? toMdt($bp('provisionsDettes', 'provisions')) : null].filter(v => v !== null),
    ['PASSIFS COURANTS'],
    ['Fournisseurs et comptes rattachés', toMdt($b('fournisseurs')), hasPrev ? toMdt($bp('fournisseurs')) : null].filter(v => v !== null),
    ['État — TVA due', toMdt($b('etatCredit')), hasPrev ? toMdt($bp('etatCredit')) : null].filter(v => v !== null),
    ['Personnel', toMdt($b('personnelCredit')), hasPrev ? toMdt($bp('personnelCredit')) : null].filter(v => v !== null),
    ['Autres dettes', toMdt($b('autresDettes')), hasPrev ? toMdt($bp('autresDettes')) : null].filter(v => v !== null),
    ['Concours bancaires', toMdt($b('concoursBancaires')), hasPrev ? toMdt($bp('concoursBancaires')) : null].filter(v => v !== null),
    ['Emprunts courants', toMdt($b('empruntsCourants')), hasPrev ? toMdt($bp('empruntsCourants')) : null].filter(v => v !== null),
    ['= TOTAL PASSIFS & CP', toMdt($b('totalPassif')), hasPrev ? toMdt($bp('totalPassif')) : null].filter(v => v !== null),
  ];

  addSheet('Bilan Actif', bilanHeaders, bilanActifRows, bCw);
  addSheet('Bilan Passif', bilanHeaders, bilanPassifRows, bCw);

  // ══════════ ÉTAT DE RÉSULTAT ══════════
  addSheet('État de résultat', ['Rubrique', 'Montant (MDT)'], [
    ["PRODUITS D'EXPLOITATION", ''],
    ['Ventes', toMdt($r('ventes'))],
    ['Production stockée', toMdt($r('productionStockee'))],
    ['Subventions d\'exploitation', toMdt($r('subventionsExploitation'))],
    ['Autres produits', toMdt($r('autresProduits'))],
    ['Total Produits d\'exploitation', toMdt($r('produitsExploitation', 'totalProduitsExploitation', 'produits'))],
    ["CHARGES D'EXPLOITATION", ''],
    ['Achats consommés', toMdt($r('achatsConsommes', 'achats'))],
    ['Charges externes', toMdt($r('chargesExternes'))],
    ['Autres services extérieurs', toMdt($r('autresServicesExterieurs'))],
    ['Charges de personnel', toMdt($r('chargesPersonnel'))],
    ['Impôts et taxes', toMdt($r('impotsTaxes'))],
    ['Dotations aux amortissements', toMdt($r('dotations'))],
    ['Autres charges d\'exploitation', toMdt($r('autresCharges'))],
    ['Total Charges d\'exploitation', toMdt($r('chargesExploitation', 'totalChargesExploitation', 'charges'))],
    ["= RÉSULTAT D'EXPLOITATION", toMdt($r('resultatExploitation'))],
    ['RÉSULTAT FINANCIER', ''],
    ['Produits financiers', toMdt($r('produitsFinanciers'))],
    ['Charges financières', toMdt($r('chargesFinancieres'))],
    ['= Résultat financier', toMdt($r('resultatFinancier'))],
    ['RÉSULTAT EXCEPTIONNEL', ''],
    ['Produits exceptionnels', toMdt($r('produitsExceptionnels'))],
    ['Charges exceptionnelles', toMdt($r('chargesExceptionnelles'))],
    ['= Résultat exceptionnel', toMdt($r('resultatExceptionnel'))],
    ['= RÉSULTAT AVANT IMPÔT', toMdt(getVal(resultat, 'resultatAvantImpot', 'rcai'))],
    ['Impôt sur les sociétés', toMdt(getVal(resultat, 'impot', 'impotIS', 'impotsTaxes'))],
    ["= RÉSULTAT NET DE L'EXERCICE", toMdt($r('resultatNet'))],
  ], [50, 20]);

  // ══════════ SIG ══════════
  addSheet('SIG', ['Poste', 'Montant (MDT)'], [
    ['Marge commerciale', toMdt($sig('margeCommerciale'))],
    ['+ Production de l\'exercice', toMdt($sig('productionExercice'))],
    ['- Achats consommés (hors marchandises)', -toMdt($sig('achatsConsHorsMarch'))],
    ['- Services extérieurs', -toMdt($sig('chargesExternes'))],
    ['- Autres services extérieurs', -toMdt($sig('autresServicesExterieurs'))],
    ['= VALEUR AJOUTÉE', toMdt($sig('valeurAjoutee'))],
    ['+ Subventions d\'exploitation', toMdt($r('subventionsExploitation'))],
    ['- Charges de personnel', -toMdt($r('chargesPersonnel'))],
    ['- Impôts et taxes', -toMdt($r('impotsTaxes'))],
    ['= EBE', toMdt($sig('ebe'))],
    ['+ Autres produits', toMdt($r('autresProduits'))],
    ['- Autres charges', -toMdt($r('autresCharges'))],
    ['+ Reprises', toMdt($r('reprises'))],
    ['- Dotations', -toMdt($r('dotations'))],
    ["= RÉSULTAT D'EXPLOITATION (SIG)", toMdt($sig('sigResultatExploitation'))],
    ['+ Résultat financier', toMdt($r('resultatFinancier'))],
    ['= RCAI', toMdt($sig('sigRcai'))],
    ['+ Résultat exceptionnel', toMdt($r('resultatExceptionnel'))],
    ['= RÉSULTAT AVANT IMPÔT', toMdt($r('resultatAvantImpot'))],
    ['- Impôt', -toMdt($r('impot'))],
    ['= RÉSULTAT NET (SIG)', toMdt($sig('sigResultatNet'))],
  ], [50, 20]);

  // ══════════ FLUX DE TRÉSORERIE ══════════
  addSheet('Flux trésorerie', ['Flux', 'Montant (MDT)'], [
    ['Résultat net', toMdt($fl('resultatNet'))],
    ['+ Dotations', toMdt($fl('dotations'))],
    ['- Reprises', toMdt($fl('reprises'))],
    ['= MBA (Marge Brute Autofinancement)', toMdt($fl('margeBruteAutofinancement'))],
    ['Variation du BFR', toMdt($fl('variationBFR', 'variationBFRE'))],
    ['Flux trésorerie d\'exploitation', toMdt($fl('fluxExploitation'))],
    ['Flux trésorerie d\'investissement', toMdt($fl('fluxInvestissement'))],
    ['Flux trésorerie de financement', toMdt($fl('fluxFinancement'))],
    ['= VARIATION DE TRÉSORERIE', toMdt($fl('variationTresorerie'))],
    ['Trésorerie initiale', toMdt($fl('tresorerieInitiale'))],
    ['Trésorerie finale', toMdt($fl('tresorerieFinale', 'tresorerie'))],
  ], [45, 20]);

  // ══════════ RATIOS ══════════
  addSheet('Ratios', ['Ratio', 'Valeur', 'Interprétation'], [
    ['Liquidité générale', ratios.liquiditeGenerale != null ? ratios.liquiditeGenerale.toFixed(2) : 'N/A', ratios.liquiditeGenerale >= 1 ? 'OK' : ratios.liquiditeGenerale >= 0.5 ? 'Faible' : 'Critique'],
    ['Liquidité réduite', ratios.liquiditeReduite != null ? ratios.liquiditeReduite.toFixed(2) : 'N/A', ratios.liquiditeReduite >= 0.5 ? 'OK' : ratios.liquiditeReduite >= 0.3 ? 'Faible' : 'Critique'],
    ['Autonomie financière', ratios.autonomieFinanciere != null ? (ratios.autonomieFinanciere * 100).toFixed(1) + '%' : 'N/A', ratios.autonomieFinanciere >= 0.2 ? 'Bonne' : 'Fragile'],
    ['Rentabilité économique', ((getVal(ratios, 'rentabiliteEconomique', 'roe')) * 100).toFixed(2) + '%', ''],
    ['Rentabilité financière', ((getVal(ratios, 'rentabiliteFinanciere', 'roe', 'roa')) * 100).toFixed(2) + '%', ''],
    ['Marge nette', (ratios.margeNette != null ? ratios.margeNette * 100 : 0).toFixed(2) + '%', ''],
    ['Rotation stocks (j)', Math.round(getVal(ratios, 'rotationStocksJours') || 0) + '', ''],
    ['Délai clients (j)', Math.round(getVal(ratios, 'delaiClientsJours') || 0) + '', ''],
    ['Délai fournisseurs (j)', Math.round(getVal(ratios, 'delaiFournisseursJours') || 0) + '', ''],
    ['Besoin en Fonds de Roulement', getVal(ratios, 'bfr', bilan, 'bfr') != null ? toMdt(getVal(ratios, 'bfr', bilan, 'bfr')) + ' MDT' : 'N/A', ''],
    ['Trésorerie nette', getVal(ratios, 'tresorerieNette') != null ? toMdt(getVal(ratios, 'tresorerieNette')) + ' MDT' : 'N/A', ''],
  ], [35, 20, 20]);

  // ══════════ BALANCE GÉNÉRALE ══════════
  if (balanceGenerale && balanceGenerale.length > 0) {
    const bgRows = balanceGenerale.slice(0, 500).map(b => [
      b.compte || '', b.libelle || '',
      b.debitTotal || 0, b.creditTotal || 0,
      b.soldeDebiteur || 0, b.soldeCrediteur || 0,
    ]);
    addSheet('Balance Générale', ['Compte', 'Libellé', 'Débit', 'Crédit', 'S. Débiteur', 'S. Créditeur'], bgRows, [12, 40, 18, 18, 18, 18]);
  }

  // ══════════ TABLEAUX ══════════
  const immoLignes = tableauxData?.immobilisations || bilan?.donneesImmobilisations?.lignes || [];
  if (immoLignes.length) {
    addSheet('Immobilisations', ['Catégorie', 'VB Début', 'Acquisitions', 'Cessions', 'VB Fin'],
      immoLignes.map(l => [l.categorie || l.rubrique || '', l.debut || 0, l.augmentation || 0, l.diminution || 0, l.fin || 0]), [30, 18, 18, 18, 18]);
  }

  const amorLignes = tableauxData?.amortissements || bilan?.donneesAmortissements?.lignes || [];
  if (amorLignes.length) {
    addSheet('Amortissements', ['Catégorie', 'Amort. Début', 'Dotations', 'Reprises', 'Amort. Fin'],
      amorLignes.map(l => [l.categorie || l.rubrique || '', l.debut || 0, l.augmentation || 0, l.diminution || 0, l.fin || 0]), [30, 18, 18, 18, 18]);
  }

  const provLignes = tableauxData?.provisions || bilan?.donneesProvisions?.lignes || [];
  if (provLignes.length) {
    addSheet('Provisions', ['Catégorie', 'Prov. Début', 'Dotations', 'Reprises', 'Prov. Fin'],
      provLignes.map(l => [l.categorie || l.rubrique || '', l.debut || 0, l.augmentation || 0, l.diminution || 0, l.fin || 0]), [30, 18, 18, 18, 18]);
  }

  const vcpLignes = tableauxData?.variationCP || bilan?.variationCapitauxPropres?.lignes || [];
  if (vcpLignes.length) {
    addSheet('Variation CP', ['Rubrique', 'Solde N-1', 'Augment.', 'Diminut.', 'Solde N'],
      vcpLignes.map(l => [l.rubrique || l.categorie || '', l.debut || 0, l.augmentation || 0, l.diminution || 0, l.fin || 0]), [30, 18, 18, 18, 18]);
  }

  // ══════════ NOTES ET POLITIQUES ══════════
  if (notes) {
    addSheet('Notes', ['Texte'], notes.split('\n').map(l => [l]), [80]);
  }

  if (accountingPolicies) {
    addSheet('Principes com.', ['Texte'], accountingPolicies.split('\n').map(l => [l]), [80]);
  }

  // ══════════ WRITE & DOWNLOAD ══════════
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const companyName = reports?.company?.name || 'SCE';
  const year = reports?.company?.year || new Date().getFullYear();
  a.download = `EtatsFinanciers_SCE_${companyName.replace(/\s+/g, '_')}_${year}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
