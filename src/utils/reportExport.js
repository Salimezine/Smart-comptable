import { jsPDF } from 'jspdf';
import ExcelJS from 'exceljs';

const getVal = (obj, ...keys) => {
  for (const k of keys) {
    const v = obj[k];
    if (v != null) return v;
  }
  return 0;
};

const z = (v) => v ?? 0;

const fmt = (v) => {
  if (v == null || isNaN(v)) return '0,000';
  return v.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
};

function drawCell(doc, x, y, w, h, text, opts = {}) {
  const { align = 'left', bold = false, color = '#cbd5e1', fill, fontSize = 8 } = opts;
  if (fill) {
    doc.setFillColor(...hexToRgb(fill));
    doc.rect(x, y, w, h, 'F');
  }
  doc.setFontSize(fontSize);
  doc.setFont('Helvetica', bold ? 'bold' : 'normal');
  doc.setTextColor(...hexToRgb(color));
  const tx = align === 'right' ? x + w - 3 : x + 3;
  const ty = y + h / 2 + fontSize / 3;
  doc.text(text, tx, ty, { align: align === 'right' ? 'right' : 'left', maxWidth: w - 6 });
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
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
    doc.setDrawColor('#334155');
    doc.setLineWidth(0.3);
    doc.line(x, cy, x + colWidths.reduce((a, b) => a + b, 0), cy);
  }
  return cy;
}

function bGet(b, field) {
  return getVal(b, field, field + 'Deduction', field.replace('ActifNC', 'ActifNCDeduction'));
}

export function exportReportsPDF(reports) {
  const { bilan, resultat, sig, ratios, fluxTresorerie } = reports;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = 190;
  const lm = 10;
  let y = 15;

  const title = (text) => {
    doc.setFontSize(12);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(248, 250, 252);
    doc.text(text, lm, y);
    y += 8;
  };

  const section = (text) => {
    doc.setFontSize(9);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(148, 163, 184);
    doc.text(text, lm, y);
    y += 5;
  };

  const $b = (k, ...fallbacks) => getVal(bilan, k, ...fallbacks);
  const $r = (k, ...fallbacks) => getVal(resultat, k, ...fallbacks);
  const $sig = (k, ...fallbacks) => getVal(sig, k, ...fallbacks);
  const $fl = (k, ...fallbacks) => getVal(fluxTresorerie, k, ...fallbacks);
  const $ra = (k, ...fallbacks) => getVal(ratios, k, ...fallbacks);

  // ── BILAN ──
  doc.addPage();
  y = 15;
  title('BILAN (SCE)');

  const bCols = [50, 30, 30, 30, 30];
  section('ACTIF');
  const amortProv = $b('amortissements', 'amortissementsDeduction') + $b('provisionsActifNC', 'provisionsActifNCDeduction', 'provActifNC');
  y = drawTable(doc, lm, y, bCols, [
    ['', 'Brut', 'Amort/Prov', 'Net', ''],
    ['Actifs non courants', fmt($b('ancBrut')), fmt(amortProv), fmt($b('actifNC')), ''],
    ['  Immobilisations incorporelles', fmt($b('immobilisationsIncorporelles')), '', '', ''],
    ['  Immobilisations corporelles', fmt($b('immobilisationsCorporelles')), '', '', ''],
    ['  Immobilisations financières', fmt($b('immobilisationsFinancieres')), '', '', ''],
    ['Actifs courants', '', '', fmt($b('actifC')), ''],
    ['  Stocks', fmt($b('stocks')), '', '', ''],
    ['  Clients', fmt($b('clients')), '', '', ''],
    ['  Autres actifs courants', fmt(z($b('etatDebit')) + z($b('personnelDebit')) + z($b('autresCr\u00e9ances', 'autresCr\u00e9ances', 'autresCréances'))), '', '', ''],
    ['  Trésorerie', fmt($b('tresorerie', 'tresorerieActif')), '', '', ''],
    ['= TOTAL ACTIF', '', '', fmt($b('totalActif')), ''],
  ], { headerColor: '#0f4c81' });

  y += 5;
  section('PASSIF');
  y = drawTable(doc, lm, y, [80, 40, 40], [
    ['', '', ''],
    ['Capitaux propres', '', fmt($b('capPropres'))],
    ['  Capital social', fmt($b('capital', 'capitalSocial')), ''],
    ['  Réserves', fmt($b('reserves')), ''],
    ['  Résultat de l\'exercice', fmt($b('resultatExercice')), ''],
    ['Passifs non courants', '', fmt($b('passifNC'))],
    ['  Emprunts', fmt($b('emprunts')), ''],
    ['  Provisions', fmt($b('provisionsDettes', 'provisions')), ''],
    ['Passifs courants', '', fmt($b('passifC'))],
    ['  Fournisseurs', fmt($b('fournisseurs')), ''],
    ['  Autres passifs courants', fmt(z($b('etatCredit')) + z($b('personnelCredit')) + z($b('autresDettes')) + z($b('concoursBancaires'))), ''],
    ['= TOTAL PASSIFS & CP', '', fmt($b('totalPassif'))],
  ], { headerColor: '#0f4c81' });

  // ── ÉTAT DE RÉSULTAT ──
  doc.addPage();
  y = 15;
  title('ÉTAT DE RÉSULTAT (SCE - Méthode par nature)');
  y = drawTable(doc, lm, y, [100, 50], [
    ['', 'Montant'],
    ['Produits d\'exploitation', fmt($r('produitsExploitation', 'totalProduitsExploitation', 'produits'))],
    ['  Ventes', fmt($r('ventes'))],
    ['  Production stockée', fmt($r('productionStockee'))],
    ['  Subventions d\'exploitation', fmt($r('subventionsExploitation'))],
    ['  Reprises', fmt($r('reprises'))],
    ['Charges d\'exploitation', fmt($r('chargesExploitation', 'totalChargesExploitation', 'charges'))],
    ['  Achats consommés', fmt($r('achatsConsommes', 'achats'))],
    ['  Charges externes', fmt($r('chargesExternes'))],
    ['  Charges de personnel', fmt($r('chargesPersonnel'))],
    ['  Dotations aux amortissements', fmt($r('dotations'))],
    ['= RÉSULTAT D\'EXPLOITATION', fmt($r('resultatExploitation'))],
    ['Produits financiers', fmt($r('produitsFinanciers'))],
    ['Charges financières', fmt($r('chargesFinancieres'))],
    ['= RÉSULTAT FINANCIER', fmt($r('resultatFinancier'))],
    ['= RÉSULTAT AVANT IMPÔT', fmt($r('resultatAvantImpot', 'rcai'))],
    ['Impôt sur les bénéfices', fmt($r('impot', 'impotIS', 'impotsTaxes'))],
    ['= RÉSULTAT NET', fmt($r('resultatNet'))],
  ], { headerColor: '#0f4c81' });

  // ── SIG ──
  doc.addPage();
  y = 15;
  title('SOLDES INTERMÉDIAIRES DE GESTION (SIG)');
  y = drawTable(doc, lm, y, [100, 50], [
    ['', 'Montant'],
    ['Marge commerciale', fmt($sig('margeCommerciale'))],
    ['+ Production de l\'exercice', fmt($sig('productionExercice'))],
    ['- Achats consommés', fmt($r('achatsConsommes', 'achats'))],
    ['- Charges externes', fmt($r('chargesExternes'))],
    ['= VALEUR AJOUTÉE', fmt($sig('valeurAjoutee'))],
    ['+ Subventions d\'exploitation', fmt($r('subventionsExploitation'))],
    ['- Charges de personnel', fmt($r('chargesPersonnel'))],
    ['- Impôts et taxes', fmt($r('impotsTaxes'))],
    ['= EBE', fmt($sig('ebe'))],
    ['+ Reprises', fmt($r('reprises'))],
    ['- Dotations', fmt($r('dotations'))],
    ['= RÉSULTAT D\'EXPLOITATION (SIG)', fmt($sig('sigResultatExploitation'))],
    ['+ Résultat financier', fmt($r('resultatFinancier'))],
    ['= RCAI', fmt($sig('sigRcai'))],
    ['- Impôt', fmt($r('impot', 'impotIS', 'impotsTaxes'))],
    ['= RÉSULTAT NET (SIG)', fmt($sig('sigResultatNet'))],
  ], { headerColor: '#0f4c81' });

  // ── FLUX DE TRÉSORERIE ──
  doc.addPage();
  y = 15;
  title('ÉTAT DES FLUX DE TRÉSORERIE');
  y = drawTable(doc, lm, y, [100, 50], [
    ['', 'Montant'],
    ['Résultat net', fmt($fl('resultatNet'))],
    ['+ Dotations', fmt($fl('dotations'))],
    ['- Reprises', fmt($fl('reprises'))],
    ['= MBA', fmt($fl('margeBruteAutofinancement'))],
    ['Flux de trésorerie d\'exploitation', fmt($fl('fluxExploitation'))],
    ['Flux de trésorerie d\'investissement', fmt($fl('fluxInvestissement'))],
    ['Flux de trésorerie de financement', fmt($fl('fluxFinancement'))],
    ['= VARIATION DE TRÉSORERIE', fmt($fl('variationTresorerie'))],
    ['Trésorerie finale', fmt($fl('tresorerieFinale', 'tresorerie'))],
  ], { headerColor: '#0f4c81' });

  // ── RATIOS ──
  y += 5;
  title('RATIOS FINANCIERS');
  const lg = $ra('liquiditeGenerale');
  y = drawTable(doc, lm, y, [90, 40, 40], [
    ['Ratio', 'Valeur', 'Interprétation'],
    ['Liquidité générale', fmt(lg), lg >= 1 ? 'Satisfaisant' : 'Faible'],
    ['Liquidité réduite', fmt($ra('liquiditeReduite')), ''],
    ['Autonomie financière', ($ra('autonomieFinanciere') * 100).toFixed(1) + '%', $ra('autonomieFinanciere') >= 0.2 ? 'Bonne' : 'Fragile'],
    ['Endettement net', fmt($ra('endettementNet')), ''],
    ['Rentabilité économique', ($ra('rentabiliteEconomique', 'roe') * 100).toFixed(2) + '%', ''],
    ['Rentabilité financière', ($ra('rentabiliteFinanciere', 'roe_', 'roa') * 100).toFixed(2) + '%', ''],
    ['Marge nette', ($ra('margeNette') * 100).toFixed(2) + '%', ''],
    ['Rotation stocks (jours)', fmt($ra('rotationStocksJours')), ''],
    ['Délai clients (jours)', fmt($ra('delaiClientsJours')), ''],
    ['Délai fournisseurs (jours)', fmt($ra('delaiFournisseursJours')), ''],
  ], { headerColor: '#0f4c81' });

  doc.save('rapport-financier-sce.pdf');
}

export async function exportReportsExcel(reports) {
  const { bilan, resultat, sig, ratios, fluxTresorerie, controle } = reports;
  const wb = new ExcelJS.Workbook();
  const numFmt = '#,##0.000';

  const addSheet = (name, headers, rows, colWidths) => {
    const ws = wb.addWorksheet(name);
    const hRow = ws.addRow(headers);
    hRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4C81' } };
    if (colWidths) colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    rows.forEach((r, ri) => {
      const row = ws.addRow(r.map((v, ci) => {
        if (ci > 0 && typeof v === 'string' && v.startsWith('=')) return r[ci];
        return v;
      }));
      const isTotal = String(r[0] || '').startsWith('=') || String(r[0] || '').startsWith('Total');
      if (isTotal) row.font = { bold: true };
      r.forEach((v, ci) => {
        if (typeof v === 'number') row.getCell(ci + 1).numFmt = numFmt;
      });
    });
    return ws;
  };

  const $b = (k, ...fb) => getVal(bilan, k, ...fb);
  const $r = (k, ...fb) => getVal(resultat, k, ...fb);

  // Bilan
  addSheet('Bilan', ['', 'Brut', 'Amort/Prov', 'Net'], [
    ['Actifs non courants', $b('ancBrut'), $b('amortissements', 'amortissementsDeduction') + $b('provisionsActifNC', 'provisionsActifNCDeduction', 'provActifNC'), $b('actifNC')],
    ['  Frais préliminaires', $b('fraisPreliminaires'), '', ''],
    ['  Immobilisations incorporelles', $b('immobilisationsIncorporelles'), '', ''],
    ['  Immobilisations corporelles', $b('immobilisationsCorporelles'), '', ''],
    ['  Immobilisations financières', $b('immobilisationsFinancieres'), '', ''],
    ['Actifs courants', '', '', $b('actifC')],
    ['  Stocks', '', '', $b('stocks')],
    ['  Clients', '', '', $b('clients')],
    ['  Trésorerie', '', '', $b('tresorerie', 'tresorerieActif')],
    ['= TOTAL ACTIF', '', '', $b('totalActif')],
    [],
    ['Capitaux propres', '', $b('capPropres')],
    ['  Capital', '', $b('capital', 'capitalSocial')],
    ['  Réserves', '', $b('reserves')],
    ['  Résultat', '', $b('resultatExercice')],
    ['Passifs non courants', '', $b('passifNC')],
    ['  Emprunts', '', $b('emprunts')],
    ['Passifs courants', '', $b('passifC')],
    ['  Fournisseurs', '', $b('fournisseurs')],
    ['  Concours bancaires', '', $b('concoursBancaires')],
    ['= TOTAL PASSIFS & CP', '', $b('totalPassif')],
  ], [35, 20, 20, 20]);

  // État de résultat
  addSheet('État de résultat', ['', 'Montant'], [
    ['Produits d\'exploitation', $r('produitsExploitation', 'totalProduitsExploitation', 'produits')],
    ['  Ventes', $r('ventes')],
    ['  Production stockée', $r('productionStockee')],
    ['  Subventions', $r('subventionsExploitation')],
    ['Charges d\'exploitation', $r('chargesExploitation', 'totalChargesExploitation', 'charges')],
    ['  Achats', $r('achatsConsommes', 'achats')],
    ['  Charges externes', $r('chargesExternes')],
    ['  Personnel', $r('chargesPersonnel')],
    ['  Dotations', $r('dotations')],
    ['= RÉSULTAT D\'EXPLOITATION', $r('resultatExploitation')],
    ['Résultat financier', $r('resultatFinancier')],
    ['= RÉSULTAT AVANT IMPÔT', $r('resultatAvantImpot', 'rcai')],
    ['Impôt', $r('impot', 'impotIS', 'impotsTaxes')],
    ['= RÉSULTAT NET', $r('resultatNet')],
  ], [45, 20]);

  // SIG
  addSheet('SIG', ['Poste', 'Montant'], [
    ['Marge commerciale', sig.margeCommerciale],
    ['Production exercice', sig.productionExercice],
    ['Valeur ajoutée', sig.valeurAjoutee],
    ['EBE', sig.ebe],
    ['Résultat d\'exploitation (SIG)', sig.sigResultatExploitation],
    ['RCAI', sig.sigRcai],
    ['Résultat net (SIG)', sig.sigResultatNet],
  ], [40, 20]);

  // Flux trésorerie
  addSheet('Flux trésorerie', ['Flux', 'Montant'], [
    ['Résultat net', fluxTresorerie.resultatNet],
    ['+ Dotations', fluxTresorerie.dotations],
    ['- Reprises', fluxTresorerie.reprises],
    ['MBA', fluxTresorerie.margeBruteAutofinancement],
    ['Flux exploitation', fluxTresorerie.fluxExploitation],
    ['Flux investissement', fluxTresorerie.fluxInvestissement],
    ['Flux financement', fluxTresorerie.fluxFinancement],
    ['Variation trésorerie', fluxTresorerie.variationTresorerie],
  ], [35, 20]);

  // Ratios
  addSheet('Ratios', ['Ratio', 'Valeur', 'Interprétation'], [
    ['Liquidité générale', ratios.liquiditeGenerale, ratios.liquiditeGenerale >= 1 ? 'OK' : 'Faible'],
    ['Autonomie financière', (ratios.autonomieFinanciere * 100).toFixed(1) + '%', ratios.autonomieFinanciere >= 0.2 ? 'Bonne' : 'Fragile'],
    ['Rentabilité économique', ((getVal(ratios, 'rentabiliteEconomique', 'roe')) * 100).toFixed(2) + '%', ''],
    ['Rentabilité financière', ((getVal(ratios, 'rentabiliteFinanciere', 'roe', 'roa')) * 100).toFixed(2) + '%', ''],
    ['Marge nette', (ratios.margeNette * 100).toFixed(2) + '%', ''],
    ['Rotation stocks (j)', Math.round(getVal(ratios, 'rotationStocksJours') || 0) + '', ''],
    ['Délai clients (j)', Math.round(getVal(ratios, 'delaiClientsJours') || 0) + '', ''],
    ['Délai fournisseurs (j)', Math.round(getVal(ratios, 'delaiFournisseursJours') || 0) + '', ''],
  ], [30, 20, 20]);

  // Balance
  if (controle?.accounts) {
    addSheet('Balance', ['Compte', 'Libellé', 'Débit', 'Crédit'], controle.accounts.map(a => [a.compte, a.libelle || '', a.debitTotal, a.creditTotal]), [12, 25, 15, 15]);
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'rapport-financier-sce.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}
