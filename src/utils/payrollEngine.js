/**
 * payrollEngine.js — Paie Tunisienne LF 2026
 * Calculs CNSS, IRPP, CSS (supprimée 2026+), bulletins, PDF exports
 */

import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { logAction, AUDIT_ACTIONS } from './security/auditLog';
import { getJournalKey } from './journalKey';

export const TAUX = {
  cnss_sal: 0.0968,
  cnss_pat: 0.1707,
  frais_pro_taux: 0.10,
  frais_pro_plaf: 2000,
  css_taux: 0.005,
  css_seuil: 5000,
};

export const BAREME_IRPP_2026 = [
  { min: 0,      max: 5000,  taux: 0.00 },
  { min: 5000,   max: 20000, taux: 0.26 },
  { min: 20000,  max: 30000, taux: 0.28 },
  { min: 30000,  max: 50000, taux: 0.32 },
  { min: 50000,  max: Infinity, taux: 0.35 },
];

const MINIMUM_IMPOT = 45;

function cssTaux(annee) {
  return annee >= 2026 ? 0 : TAUX.css_taux;
}

function getBareme(annee) {
  return annee >= 2026 ? BAREME_IRPP_2026 : BAREME_IRPP_2026;
}

export function calculerIRPP(revenuImposableAnnuel, annee = 2026) {
  if (revenuImposableAnnuel <= 0) return { irpp_annuel: 0, css_annuelle: 0, total_annuel: 0, rs_mensuelle: 0 };
  const bareme = getBareme(annee);
  let irpp = 0;
  let reste = revenuImposableAnnuel;
  for (const tr of bareme) {
    if (reste <= 0) break;
    const tranche = Math.min(reste, tr.max - tr.min);
    if (tranche > 0) irpp += tranche * tr.taux;
    reste -= tranche;
  }
  if (irpp > 0 && irpp < MINIMUM_IMPOT) irpp = MINIMUM_IMPOT;
  const css = revenuImposableAnnuel > TAUX.css_seuil ? revenuImposableAnnuel * cssTaux(annee) : 0;
  const total = irpp + css;
  return {
    irpp_annuel: parseFloat(irpp.toFixed(3)),
    css_annuelle: parseFloat(css.toFixed(3)),
    total_annuel: parseFloat(total.toFixed(3)),
    rs_mensuelle: parseFloat((total / 12).toFixed(3)),
  };
}

export function calculerBulletin(employe, params) {
  const { mois, annee, heuresSup = 0, primes = 0, avances = 0 } = params;
  const salaireBase = parseFloat(employe.salaireBase) || 0;
  const regime = employe.regimeHoraire || 40;
  const nbEnfants = parseInt(employe.nbEnfants) || 0;
  const chefFamille = !!employe.chefFamille;
  const conjointCharge = !!employe.conjointCharge;

  // Taux horaire
  const tauxHoraire = salaireBase / (52 * regime / 12);

  // Heures sup
  const majorationHS = regime === 48 ? 0.75 : (heuresSup > 8 ? 0.50 : 0.25);
  const montantHS = heuresSup > 0 ? parseFloat((tauxHoraire * heuresSup * (1 + majorationHS)).toFixed(3)) : 0;

  const brut = parseFloat((salaireBase + montantHS + primes).toFixed(3));

  // CNSS salarié
  const cnssSal = parseFloat((brut * TAUX.cnss_sal).toFixed(3));
  const cnssPat = parseFloat((brut * TAUX.cnss_pat).toFixed(3));

  // Revenu imposable annualisé
  const baseAnnuelle = brut * 12;
  const cnssSalAnnuelle = cnssSal * 12;
  const fraisPro = Math.min(baseAnnuelle * TAUX.frais_pro_taux, TAUX.frais_pro_plaf);
  let deductionsFamille = 0;
  if (chefFamille) deductionsFamille += 300;
  if (conjointCharge) deductionsFamille += 100;
  deductionsFamille += Math.min(nbEnfants, 4) * 100;

  const revenuImposableAnnuel = Math.max(0, baseAnnuelle - cnssSalAnnuelle - fraisPro - deductionsFamille);
  const irppCalc = calculerIRPP(revenuImposableAnnuel, annee);

  const netAvantAvances = parseFloat((brut - cnssSal - irppCalc.rs_mensuelle).toFixed(3));
  const netAPayer = parseFloat(Math.max(0, netAvantAvances - avances).toFixed(3));

  // Provision CP mensuelle
  const provisionCP = parseFloat((brut / 12).toFixed(3));

  const bulletinId = `${employe.id}_${annee}_${String(mois).padStart(2, '0')}`;

  return {
    id: bulletinId,
    employeId: employe.id,
    nom: employe.nom,
    prenom: employe.prenom,
    cin: employe.cin,
    matricule: employe.matricule,
    poste: employe.poste,
    regime,
    mois,
    annee,
    salaireBase,
    heuresSup,
    montantHS,
    primes,
    brut,
    cnssSal,
    cnssPat,
    fraisPro,
    deductionsFamille,
    revenuImposableAnnuel,
    irppAnnuel: irppCalc.irpp_annuel,
    cssAnnuelle: irppCalc.css_annuelle,
    rsMensuelle: irppCalc.rs_mensuelle,
    avances,
    netAPayer,
    provisionCP,
    coutEmployeur: parseFloat((brut + cnssPat).toFixed(3)),
  };
}

export function genererEcrituresPaie(bulletins, mois, annee) {
  const totalBrut = bulletins.reduce((s, b) => s + b.brut, 0);
  const totalCnssSal = bulletins.reduce((s, b) => s + b.cnssSal, 0);
  const totalCnssPat = bulletins.reduce((s, b) => s + b.cnssPat, 0);
  const totalIrpp = bulletins.reduce((s, b) => s + b.rsMensuelle, 0);
  const totalCss = bulletins.reduce((s, b) => s + b.cssAnnuelle / 12, 0);
  const totalNet = bulletins.reduce((s, b) => s + b.netAPayer, 0);
  const totalProvisionCP = bulletins.reduce((s, b) => s + b.provisionCP, 0);

  const libelleNumero = `PAIE-${annee}${String(mois).padStart(2, '0')}`;
  const libelle = `Paie ${String(mois).padStart(2, '0')}/${annee} — ${bulletins.length} employé(s)`;

  const ecritures = [];

  // 1 — Masse salariale brute + retenues salariales
  ecritures.push(
    { compte: '6411', libelleCompte: '6411 Salaires et appointements', libelle: `Salaire brut ${libelleNumero}`, debit: parseFloat(totalBrut.toFixed(3)), credit: 0 },
    { compte: '4312', libelleCompte: '4312 CNSS salarié à verser', libelle: `CNSS sal. ${libelleNumero}`, debit: 0, credit: parseFloat(totalCnssSal.toFixed(3)) },
    { compte: '43621', libelleCompte: '43621 Retenue à la source (IRPP)', libelle: `IRPP/RS ${libelleNumero}`, debit: 0, credit: parseFloat(totalIrpp.toFixed(3)) },
  );
  if (totalCss > 0.001) {
    ecritures.push(
      { compte: '4368', libelleCompte: '4368 CSS à verser', libelle: `CSS ${libelleNumero}`, debit: 0, credit: parseFloat(totalCss.toFixed(3)) },
    );
  }
  ecritures.push(
    { compte: '4211', libelleCompte: '4211 Personnel — rémunérations dues', libelle: `Net à payer ${libelleNumero}`, debit: 0, credit: parseFloat(totalNet.toFixed(3)) },
  );

  // 2 — Charges patronales CNSS
  ecritures.push(
    { compte: '6431', libelleCompte: '6431 Charges sociales patronales', libelle: `CNSS pat. ${libelleNumero}`, debit: parseFloat(totalCnssPat.toFixed(3)), credit: 0 },
    { compte: '4311', libelleCompte: '4311 CNSS patronale à verser', libelle: `CNSS pat. ${libelleNumero}`, debit: 0, credit: parseFloat(totalCnssPat.toFixed(3)) },
  );

  // 3 — Provision congés payés
  if (totalProvisionCP > 0.001) {
    ecritures.push(
      { compte: '6412', libelleCompte: '6412 Congés payés', libelle: `Provision CP ${libelleNumero}`, debit: parseFloat(totalProvisionCP.toFixed(3)), credit: 0 },
      { compte: '4281', libelleCompte: '4281 Provision pour congés payés', libelle: `Provision CP ${libelleNumero}`, debit: 0, credit: parseFloat(totalProvisionCP.toFixed(3)) },
    );
  }

  const totalDebit = parseFloat(ecritures.reduce((s, e) => s + e.debit, 0).toFixed(3));
  const totalCredit = parseFloat(ecritures.reduce((s, e) => s + e.credit, 0).toFixed(3));

  const lignes = ecritures.map(e => ({
    ...e,
    debit: parseFloat(e.debit.toFixed(3)),
    credit: parseFloat(e.credit.toFixed(3)),
  }));

  const piece = {
    id: libelleNumero,
    date: `${annee}-${String(mois).padStart(2, '0')}-01`,
    journal: 'OD',
    reference: libelleNumero,
    piece_justificative: libelleNumero,
    libelle,
    fournisseur: null,
    categorie: null,
    lignes,
    totalDebit,
    totalCredit,
    validated: true,
  };
  logAction(AUDIT_ACTIONS.PAIE_VALIDATE, { mois, annee, employes: bulletins.length, totalBrut, totalNet });
  return piece;
}

// ─────────────────────────────────────────────
// Écritures de paiement
// ─────────────────────────────────────────────

export function genererPaiementPaie(bulletins, type, mois, annee) {
  const libelleNumero = `PAIE-${annee}${String(mois).padStart(2, '0')}`;
  const paiementId = `PAIEMENT-${type}-${libelleNumero}`;
  const date = new Date().toISOString().slice(0, 10);

  const totalNet = bulletins.reduce((s, b) => s + b.netAPayer, 0);
  const totalCnssSal = bulletins.reduce((s, b) => s + b.cnssSal, 0);
  const totalCnssPat = bulletins.reduce((s, b) => s + b.cnssPat, 0);
  const totalIrpp = bulletins.reduce((s, b) => s + b.rsMensuelle, 0);

  let ecritures = [];

  if (type === 'net') {
    // Écriture 4 — Virement net
    ecritures.push(
      { compte: '4211', libelleCompte: '4211 Personnel — rémunérations dues', libelle: `Paiement net ${libelleNumero}`, debit: parseFloat(totalNet.toFixed(3)), credit: 0 },
      { compte: '532', libelleCompte: '532 Banque', libelle: `Paiement net ${libelleNumero}`, debit: 0, credit: parseFloat(totalNet.toFixed(3)) },
    );
  } else if (type === 'cnss') {
    // Écriture 5 — Paiement CNSS
    const total = totalCnssPat + totalCnssSal;
    ecritures.push(
      { compte: '4311', libelleCompte: '4311 CNSS patronale à verser', libelle: `Paiement CNSS ${libelleNumero}`, debit: parseFloat(totalCnssPat.toFixed(3)), credit: 0 },
      { compte: '4312', libelleCompte: '4312 CNSS salarié à verser', libelle: `Paiement CNSS ${libelleNumero}`, debit: parseFloat(totalCnssSal.toFixed(3)), credit: 0 },
      { compte: '532', libelleCompte: '532 Banque', libelle: `Paiement CNSS ${libelleNumero}`, debit: 0, credit: parseFloat(total.toFixed(3)) },
    );
  } else if (type === 'irpp') {
    // Écriture 6 — Paiement IRPP/RS
    ecritures.push(
      { compte: '43621', libelleCompte: '43621 Retenue à la source (IRPP)', libelle: `Paiement IRPP ${libelleNumero}`, debit: parseFloat(totalIrpp.toFixed(3)), credit: 0 },
      { compte: '532', libelleCompte: '532 Banque', libelle: `Paiement IRPP ${libelleNumero}`, debit: 0, credit: parseFloat(totalIrpp.toFixed(3)) },
    );
  }

  const totalDebit = parseFloat(ecritures.reduce((s, e) => s + e.debit, 0).toFixed(3));
  const totalCredit = parseFloat(ecritures.reduce((s, e) => s + e.credit, 0).toFixed(3));

  const piece = {
    id: paiementId,
    date,
    journal: 'BQ',
    reference: paiementId,
    piece_justificative: libelleNumero,
    libelle: type === 'net' ? `Virement salaires ${libelleNumero}` : type === 'cnss' ? `Paiement CNSS ${libelleNumero}` : `Paiement IRPP ${libelleNumero}`,
    fournisseur: null,
    categorie: null,
    lignes: ecritures.map(e => ({ ...e, debit: parseFloat(e.debit.toFixed(3)), credit: parseFloat(e.credit.toFixed(3)) })),
    totalDebit,
    totalCredit,
    validated: true,
  };
  logAction(AUDIT_ACTIONS.PAIE_SAVE, { mois, annee, type, montant: totalDebit });
  return piece;
}

export function saveJournalPiece(piece) {
  try {
    const key = getJournalKey();
    let journal = [];
    try {
      const raw = localStorage.getItem(key);
      if (raw) journal = JSON.parse(raw);
    } catch {}
    if (!Array.isArray(journal)) journal = [];

    const entries = piece.lignes.map(l => ({
      date: piece.date,
      numeroPiece: piece.id,
      piece_justificative: piece.piece_justificative || piece.id,
      fournisseur: '',
      categorie: '',
      compte: l.libelleCompte,
      libelle: l.libelle,
      debit: l.debit || null,
      credit: l.credit || null,
      journal: piece.journal,
      ttnId: null,
      locked: true,
    }));

    journal.unshift(...entries);
    localStorage.setItem(key, JSON.stringify(journal));
    window.dispatchEvent(new CustomEvent('journal:updated'));
    return true;
  } catch {
    return false;
  }
}

export async function exportBulletinPDF(bulletin, entreprise) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 190;
  const m = 10;
  const moisNom = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('BULLETIN DE PAIE', pageW / 2 + m, 20, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${moisNom[bulletin.mois - 1]} ${bulletin.annee}`, pageW / 2 + m, 27, { align: 'center' });

  doc.setFontSize(9);
  doc.text(`Entreprise : ${entreprise.nom || '—'}`, m, 36);
  doc.text(`MF : ${entreprise.matriculeFiscal || '—'}`, m, 42);

  doc.setFontSize(9);
  doc.text(`Employé : ${bulletin.nom} ${bulletin.prenom}`, m, 50);
  doc.text(`CIN : ${bulletin.cin || '—'}`, m + 90, 50);
  doc.text(`Poste : ${bulletin.poste || '—'}`, m, 56);
  doc.text(`Matricule : ${bulletin.matricule || '—'}`, m + 90, 56);
  doc.text(`Régime : ${bulletin.regime || 40}h/sem`, m, 62);

  const colGain = ['Gains', 'Montant (DT)'];
  const colRetenue = ['Retenues', 'Montant (DT)'];
  const dataGain = [
    ['Salaire de base', bulletin.salaireBase.toFixed(3)],
    ['Heures sup.', bulletin.montantHS > 0 ? bulletin.montantHS.toFixed(3) : '0,000'],
    ['Primes', bulletin.primes > 0 ? bulletin.primes.toFixed(3) : '0,000'],
  ];
  const dataRetenue = [
    [`CNSS (${(TAUX.cnss_sal * 100).toFixed(2)}%)`, bulletin.cnssSal.toFixed(3)],
    ['IRPP/RS', bulletin.rsMensuelle.toFixed(3)],
    ['CSS', bulletin.cssAnnuelle > 0 ? (bulletin.cssAnnuelle / 12).toFixed(3) : '0,000'],
    ['Avances', bulletin.avances > 0 ? bulletin.avances.toFixed(3) : '0,000'],
  ];

  autoTable(doc, {
    startY: 70,
    head: [colGain],
    body: dataGain,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
    styles: { fontSize: 8 },
    margin: { left: m },
    tableWidth: 90,
  });

  const retenueStartY = doc.lastAutoTable.finalY + 5;
  autoTable(doc, {
    startY: retenueStartY,
    head: [colRetenue],
    body: dataRetenue,
    theme: 'grid',
    headStyles: { fillColor: [239, 68, 68], fontSize: 9 },
    styles: { fontSize: 8 },
    margin: { left: m },
    tableWidth: 90,
  });

  const totalY = Math.max(doc.lastAutoTable.finalY, doc.lastAutoTable.finalY) + 5;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL BRUT : ${bulletin.brut.toFixed(3)} DT`, m, totalY);
  const totalRetenues = bulletin.cnssSal + bulletin.rsMensuelle + (bulletin.cssAnnuelle > 0 ? bulletin.cssAnnuelle / 12 : 0) + bulletin.avances;
  doc.text(`TOTAL RETENUES : ${totalRetenues.toFixed(3)} DT`, m + 95, totalY);
  doc.setFontSize(12);
  doc.text(`NET À PAYER : ${bulletin.netAPayer.toFixed(3)} DT`, pageW / 2 + m, totalY + 8, { align: 'center' });

  const chargesY = totalY + 16;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Charges patronales (hors bulletin) :', m, chargesY);
  doc.setFont('helvetica', 'normal');
  doc.text(`CNSS patronale (${(TAUX.cnss_pat * 100).toFixed(2)}%) : ${bulletin.cnssPat.toFixed(3)} DT`, m, chargesY + 6);
  doc.text(`Coût total employeur : ${bulletin.coutEmployeur.toFixed(3)} DT`, m, chargesY + 12);

  return doc;
}

export async function exportDeclarationCNSS(bulletins, mois, annee, entreprise) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const m = 10;
  const moisNom = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('DÉCLARATION MENSUELLE DES SALAIRES (DMS)', 105, 20, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`Période : ${moisNom[mois - 1]} ${annee}`, 105, 28, { align: 'center' });
  doc.setFontSize(9);
  doc.text(`Entreprise : ${entreprise.nom || '—'} — MF : ${entreprise.matriculeFiscal || '—'}`, 105, 35, { align: 'center' });

  const rows = bulletins.map(b => [
    b.matricule || '—',
    `${b.nom} ${b.prenom}`,
    b.brut.toFixed(3),
    b.cnssSal.toFixed(3),
    b.cnssPat.toFixed(3),
    (b.cnssSal + b.cnssPat).toFixed(3),
  ]);

  const totalBrut = bulletins.reduce((s, b) => s + b.brut, 0);
  const totalCnssSal = bulletins.reduce((s, b) => s + b.cnssSal, 0);
  const totalCnssPat = bulletins.reduce((s, b) => s + b.cnssPat, 0);

  autoTable(doc, {
    startY: 42,
    head: [['Matricule', 'Nom Prénom', 'Brut (DT)', 'CNSS Sal. (DT)', 'CNSS Pat. (DT)', 'Total CNSS (DT)']],
    body: rows,
    foot: [[
      { content: 'TOTAL', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } },
      totalBrut.toFixed(3),
      totalCnssSal.toFixed(3),
      totalCnssPat.toFixed(3),
      (totalCnssSal + totalCnssPat).toFixed(3),
    ]],
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
    footStyles: { fillColor: [59, 130, 246, 0.1], fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 8 },
    margin: { left: m, right: m },
  });

  return doc;
}

export async function exportEtat301(bulletinsParMois, annee, entreprise) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const m = 10;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ÉTAT ANNUEL N° 301', 105, 20, { align: 'center' });
  doc.text('Retenues à la source (IRPP)', 105, 28, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`Exercice : ${annee}`, 105, 36, { align: 'center' });
  doc.setFontSize(9);
  doc.text(`Entreprise : ${entreprise.nom || '—'} — MF : ${entreprise.matriculeFiscal || '—'}`, 105, 43, { align: 'center' });

  // Aggregate per employee
  const employeMap = new Map();
  for (const bulletins of bulletinsParMois) {
    for (const b of bulletins) {
      if (!employeMap.has(b.employeId)) {
        employeMap.set(b.employeId, { ...b, brutAnnuel: 0, irppAnnuelTotal: 0, cssAnnuelTotal: 0, rsTotal: 0, netAnnuel: 0 });
      }
      const e = employeMap.get(b.employeId);
      e.brutAnnuel += b.brut;
      e.irppAnnuelTotal += b.rsMensuelle;
      e.cssAnnuelTotal += b.cssAnnuelle / 12;
      e.rsTotal += b.rsMensuelle;
      e.netAnnuel += b.netAPayer;
    }
  }

  const rows = Array.from(employeMap.values()).map(e => [
    e.cin || '—',
    `${e.nom} ${e.prenom}`,
    e.brutAnnuel.toFixed(3),
    (e.fraisPro || 0).toFixed(3),
    (e.deductionsFamille || 0).toFixed(3),
    e.revenuImposableAnnuel.toFixed(3),
    e.irppAnnuelTotal.toFixed(3),
    e.cssAnnuelTotal.toFixed(3),
    e.rsTotal.toFixed(3),
    e.netAnnuel.toFixed(3),
  ]);

  autoTable(doc, {
    startY: 50,
    head: [['CIN', 'Nom Prénom', 'Brut annuel', 'Frais pro.', 'Déduc. famille', 'Imposable', 'IRPP retenu', 'CSS', 'RS totale', 'Net payé']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], fontSize: 7 },
    styles: { fontSize: 7 },
    margin: { left: m, right: m },
  });

  return doc;
}
