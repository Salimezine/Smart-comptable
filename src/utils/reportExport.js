import { jsPDF } from 'jspdf';
import ExcelJS from 'exceljs';

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

  // ── BILAN ──
  doc.addPage();
  y = 15;
  title('BILAN (SCE)');

  const bCols = [50, 30, 30, 30, 30];
  section('ACTIF');
  y = drawTable(doc, lm, y, bCols, [
    ['', 'Brut', 'Amort/Prov', 'Net', ''],
    ['Actifs non courants', fmt(bilan.ancBrut), fmt(bilan.amortissements + bilan.provisionsActifNC), fmt(bilan.actifNC), ''],
    ['  Immobilisations incorporelles', fmt(bilan.immobilisationsIncorporelles), '', '', ''],
    ['  Immobilisations corporelles', fmt(bilan.immobilisationsCorporelles), '', '', ''],
    ['  Immobilisations financières', fmt(bilan.immobilisationsFinancieres), '', '', ''],
    ['Actifs courants', '', '', fmt(bilan.actifC), ''],
    ['  Stocks', fmt(bilan.stocks), '', '', ''],
    ['  Clients', fmt(bilan.clients), '', '', ''],
    ['  Autres actifs courants', fmt(bilan.etatDebit + bilan.personnelDebit + bilan.autresCréances), '', '', ''],
    ['  Trésorerie', fmt(bilan.tresorerie), '', '', ''],
    ['= TOTAL ACTIF', '', '', fmt(bilan.totalActif), ''],
  ], { headerColor: '#0f4c81' });

  y += 5;
  section('PASSIF');
  y = drawTable(doc, lm, y, [80, 40, 40], [
    ['', '', ''],
    ['Capitaux propres', '', fmt(bilan.capPropres)],
    ['  Capital social', fmt(bilan.capital), ''],
    ['  Réserves', fmt(bilan.reserves), ''],
    ['  Résultat de l\'exercice', fmt(bilan.resultatExercice), ''],
    ['Passifs non courants', '', fmt(bilan.passifNC)],
    ['  Emprunts', fmt(bilan.emprunts), ''],
    ['  Provisions', fmt(bilan.provisionsDettes), ''],
    ['Passifs courants', '', fmt(bilan.passifC)],
    ['  Fournisseurs', fmt(bilan.fournisseurs), ''],
    ['  Autres passifs courants', fmt(bilan.etatCredit + bilan.personnelCredit + bilan.autresDettes + bilan.concoursBancaires), ''],
    ['= TOTAL PASSIFS & CP', '', fmt(bilan.totalPassif)],
  ], { headerColor: '#0f4c81' });

  // ── ÉTAT DE RÉSULTAT ──
  doc.addPage();
  y = 15;
  title('ÉTAT DE RÉSULTAT (SCE - Méthode par nature)');
  y = drawTable(doc, lm, y, [100, 50], [
    ['', 'Montant'],
    ['Produits d\'exploitation', fmt(resultat.produitsExploitation)],
    ['  Ventes', fmt(resultat.ventes)],
    ['  Production stockée', fmt(resultat.productionStockee)],
    ['  Subventions d\'exploitation', fmt(resultat.subventionsExploitation)],
    ['  Reprises', fmt(resultat.reprises)],
    ['Charges d\'exploitation', fmt(resultat.chargesExploitation)],
    ['  Achats consommés', fmt(resultat.achatsConsommes)],
    ['  Charges externes', fmt(resultat.chargesExternes)],
    ['  Charges de personnel', fmt(resultat.chargesPersonnel)],
    ['  Dotations aux amortissements', fmt(resultat.dotations)],
    ['= RÉSULTAT D\'EXPLOITATION', fmt(resultat.resultatExploitation)],
    ['Produits financiers', fmt(resultat.produitsFinanciers)],
    ['Charges financières', fmt(resultat.chargesFinancieres)],
    ['= RÉSULTAT FINANCIER', fmt(resultat.resultatFinancier)],
    ['= RÉSULTAT AVANT IMPÔT', fmt(resultat.resultatAvantImpot)],
    ['Impôt sur les bénéfices', fmt(resultat.impot)],
    ['= RÉSULTAT NET', fmt(resultat.resultatNet)],
  ], { headerColor: '#0f4c81' });

  // ── SIG ──
  doc.addPage();
  y = 15;
  title('SOLDES INTERMÉDIAIRES DE GESTION (SIG)');
  y = drawTable(doc, lm, y, [100, 50], [
    ['', 'Montant'],
    ['Marge commerciale', fmt(sig.margeCommerciale)],
    ['+ Production de l\'exercice', fmt(sig.productionExercice)],
    ['- Achats consommés', fmt(resultat.achatsConsommes)],
    ['- Charges externes', fmt(resultat.chargesExternes)],
    ['= VALEUR AJOUTÉE', fmt(sig.valeurAjoutee)],
    ['+ Subventions d\'exploitation', fmt(resultat.subventionsExploitation)],
    ['- Charges de personnel', fmt(resultat.chargesPersonnel)],
    ['- Impôts et taxes', fmt(resultat.impotsTaxes)],
    ['= EBE', fmt(sig.ebe)],
    ['+ Reprises', fmt(resultat.reprises)],
    ['- Dotations', fmt(resultat.dotations)],
    ['= RÉSULTAT D\'EXPLOITATION (SIG)', fmt(sig.sigResultatExploitation)],
    ['+ Résultat financier', fmt(resultat.resultatFinancier)],
    ['= RCAI', fmt(sig.sigRcai)],
    ['- Impôt', fmt(resultat.impot)],
    ['= RÉSULTAT NET (SIG)', fmt(sig.sigResultatNet)],
  ], { headerColor: '#0f4c81' });

  // ── FLUX DE TRÉSORERIE ──
  doc.addPage();
  y = 15;
  title('ÉTAT DES FLUX DE TRÉSORERIE');
  y = drawTable(doc, lm, y, [100, 50], [
    ['', 'Montant'],
    ['Résultat net', fmt(fluxTresorerie.resultatNet)],
    ['+ Dotations', fmt(fluxTresorerie.dotations)],
    ['- Reprises', fmt(fluxTresorerie.reprises)],
    ['= MBA', fmt(fluxTresorerie.margeBruteAutofinancement)],
    ['Flux de trésorerie d\'exploitation', fmt(fluxTresorerie.fluxExploitation)],
    ['Flux de trésorerie d\'investissement', fmt(fluxTresorerie.fluxInvestissement)],
    ['Flux de trésorerie de financement', fmt(fluxTresorerie.fluxFinancement)],
    ['= VARIATION DE TRÉSORERIE', fmt(fluxTresorerie.variationTresorerie)],
    ['Trésorerie finale', fmt(fluxTresorerie.tresorerieFinale || 0)],
  ], { headerColor: '#0f4c81' });

  // ── RATIOS ──
  y += 5;
  title('RATIOS FINANCIERS');
  y = drawTable(doc, lm, y, [90, 40, 40], [
    ['Ratio', 'Valeur', 'Interprétation'],
    ['Liquidité générale', fmt(ratios.liquiditeGenerale), ratios.liquiditeGenerale >= 1 ? 'Satisfaisant' : 'Faible'],
    ['Liquidité réduite', fmt(ratios.liquiditeReduite), ''],
    ['Autonomie financière', (ratios.autonomieFinanciere * 100).toFixed(1) + '%', ratios.autonomieFinanciere >= 0.2 ? 'Bonne' : 'Fragile'],
    ['Endettement net', fmt(ratios.endettementNet), ''],
    ['Rentabilité économique', (ratios.rentabiliteEconomique * 100).toFixed(2) + '%', ''],
    ['Rentabilité financière', (ratios.rentabiliteFinanciere * 100).toFixed(2) + '%', ''],
    ['Marge nette', (ratios.margeNette * 100).toFixed(2) + '%', ''],
    ['Rotation stocks (jours)', fmt(ratios.rotationStocksJours), ''],
    ['Délai clients (jours)', fmt(ratios.delaiClientsJours), ''],
    ['Délai fournisseurs (jours)', fmt(ratios.delaiFournisseursJours), ''],
  ], { headerColor: '#0f4c81' });

  doc.save('rapport-financier-sce.pdf');
}

export async function exportReportsExcel(reports) {
  const { bilan, resultat, sig, ratios, fluxTresorerie, controle } = reports;
  const wb = new ExcelJS.Workbook();
  const numFmt = '#,##0.000';

  const addSheet = (name, headers, rows, colWidths, opts = {}) => {
    const ws = wb.addWorksheet(name);
    const hRow = ws.addRow(headers);
    hRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4C81' } };
    if (colWidths) colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    rows.forEach((r, ri) => {
      const row = ws.addRow(r);
      const isTotal = String(r[0] || '').startsWith('=') || String(r[0] || '').startsWith('Total');
      if (isTotal) { row.font = { bold: true }; }
      r.forEach((v, ci) => {
        const cell = row.getCell(ci + 1);
        if (typeof v === 'number') cell.numFmt = numFmt;
      });
    });
    return ws;
  };

  // Bilan
  addSheet('Bilan', ['', 'Brut', 'Amort/Prov', 'Net'], [
    ['Actifs non courants', bilan.ancBrut, bilan.amortissements + bilan.provisionsActifNC, bilan.actifNC],
    ['  Frais préliminaires', bilan.fraisPreliminaires, '', ''],
    ['  Immobilisations incorporelles', bilan.immobilisationsIncorporelles, '', ''],
    ['  Immobilisations corporelles', bilan.immobilisationsCorporelles, '', ''],
    ['  Immobilisations financières', bilan.immobilisationsFinancieres, '', ''],
    ['Actifs courants', '', '', bilan.actifC],
    ['  Stocks', '', '', bilan.stocks],
    ['  Clients', '', '', bilan.clients],
    ['  Trésorerie', '', '', bilan.tresorerie],
    ['= TOTAL ACTIF', '', '', bilan.totalActif],
    [],
    ['Capitaux propres', '', bilan.capPropres],
    ['  Capital', '', bilan.capital],
    ['  Réserves', '', bilan.reserves],
    ['  Résultat', '', bilan.resultatExercice],
    ['Passifs non courants', '', bilan.passifNC],
    ['  Emprunts', '', bilan.emprunts],
    ['Passifs courants', '', bilan.passifC],
    ['  Fournisseurs', '', bilan.fournisseurs],
    ['  Concours bancaires', '', bilan.concoursBancaires],
    ['= TOTAL PASSIFS & CP', '', bilan.totalPassif],
  ], [35, 20, 20, 20]);

  // État de résultat
  addSheet('État de résultat', ['', 'Montant'], [
    ['Produits d\'exploitation', resultat.produitsExploitation],
    ['  Ventes', resultat.ventes],
    ['  Production stockée', resultat.productionStockee],
    ['  Subventions', resultat.subventionsExploitation],
    ['Charges d\'exploitation', resultat.chargesExploitation],
    ['  Achats', resultat.achatsConsommes],
    ['  Charges externes', resultat.chargesExternes],
    ['  Personnel', resultat.chargesPersonnel],
    ['  Dotations', resultat.dotations],
    ['= RÉSULTAT D\'EXPLOITATION', resultat.resultatExploitation],
    ['Résultat financier', resultat.resultatFinancier],
    ['= RÉSULTAT AVANT IMPÔT', resultat.resultatAvantImpot],
    ['Impôt', resultat.impot],
    ['= RÉSULTAT NET', resultat.resultatNet],
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
    ['Rentabilité économique', (ratios.rentabiliteEconomique * 100).toFixed(2) + '%', ''],
    ['Rentabilité financière', (ratios.rentabiliteFinanciere * 100).toFixed(2) + '%', ''],
    ['Marge nette', (ratios.margeNette * 100).toFixed(2) + '%', ''],
    ['Rotation stocks (j)', Math.round(ratios.rotationStocksJours || 0) + '', ''],
    ['Délai clients (j)', Math.round(ratios.delaiClientsJours || 0) + '', ''],
    ['Délai fournisseurs (j)', Math.round(ratios.delaiFournisseursJours || 0) + '', ''],
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
