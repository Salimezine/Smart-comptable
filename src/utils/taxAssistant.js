import { calculateIRPP } from './smartIRPP.js';
import { calculateIS } from './smartIS.js';

const FISCAL = {

  baremeIRPP: [
    { min: 0, max: 5000, taux: 0, label: '0 – 5 000 DT' },
    { min: 5000.01, max: 10000, taux: 15, label: '5 001 – 10 000 DT' },
    { min: 10000.01, max: 20000, taux: 25, label: '10 001 – 20 000 DT' },
    { min: 20000.01, max: 30000, taux: 30, label: '20 001 – 30 000 DT' },
    { min: 30000.01, max: 40000, taux: 33, label: '30 001 – 40 000 DT' },
    { min: 40000.01, max: 50000, taux: 36, label: '40 001 – 50 000 DT' },
    { min: 50000.01, max: 70000, taux: 38, label: '50 001 – 70 000 DT' },
    { min: 70000.01, max: Infinity, taux: 40, label: 'Plus de 70 000 DT' },
  ],

  tauxIS: [
    { taux: 10, label: 'Artisanat, agriculture, pêche, coopératives, micro-finance', min: 300 },
    { taux: 15, label: 'Éducation privée, formation prof., santé, hébergement univ.', min: 400 },
    { taux: 20, label: 'Taux général depuis 01/01/2024 — sociétés cotées (5 ans)', min: 500 },
    { taux: 35, label: 'Opérateurs télécom, hydrocarbures, raffinage', min: 500 },
    { taux: 40, label: 'Banques, établissements financiers, assurances', min: 500 },
  ],
  impotMinimumIS: [
    { taux: 0.2, seuil: 500, label: 'Général' },
    { taux: 0.1, seuil: 300, label: 'Taux 10%, déduction 2/3, santé, marge ≤ 6%' },
  ],

  retenuesSource: [
    { ligne: 1, libelle: 'Salaires/traitements (droit commun)', tauxFR: 'Barème progressif' },
    { ligne: 2, libelle: 'Salaires étrangers', tauxFR: '20% (25% p.e.c.)' },
    { ligne: 3, libelle: 'Contribution sociale solidaire salaires', tauxFR: 'Variable' },
    { ligne: 4, libelle: 'Commissions/loyers/honoraires non-commerciaux — Résidents PP/PM', tauxFR: '10%' },
    { ligne: '4b', libelle: 'Non-résidents PP/PM', tauxFR: '15% (17.64% p.e.c.)' },
    { ligne: 5, libelle: 'Honoraires PP hors régime réel', tauxFR: '10%' },
    { ligne: 6, libelle: 'Honoraires PM (IS/sociétés personnes)', tauxFR: '3%' },
    { ligne: 7, libelle: 'Cachets artistes/créateurs', tauxFR: '5%' },
    { ligne: 8, libelle: 'Loyers hôtels PM régime réel', tauxFR: '5%' },
    { ligne: 9, libelle: 'Primes de performance', tauxFR: '10%' },
    { ligne: 10, libelle: 'Intérêts dépôts épargne/obligations', tauxFR: '20% (25% p.e.c.)' },
    { ligne: 11, libelle: 'Revenus capitaux mobiliers résidents PP/PM', tauxFR: '20%' },
    { ligne: 12, libelle: 'Dividendes PP résidents', tauxFR: '10% (11.11% p.e.c.)' },
    { ligne: 13, libelle: 'Jetons présence résidents PP/PM', tauxFR: '20%' },
    { ligne: 14, libelle: 'Vacations hors activité principale', tauxFR: '15%' },
    { ligne: 15, libelle: 'Intérêts prêts banques non établies TN', tauxFR: '10%' },
    { ligne: 16, libelle: 'Prix cession immeubles résidents', tauxFR: '2.5%' },
    { ligne: 17, libelle: 'Achats ≥ 1000 DT TTC — IS 20%', tauxFR: '1%' },
    { ligne: 18, libelle: 'RS TVA paiements État/collectivités', tauxFR: '25%' },
    { ligne: 19, libelle: 'RS TVA non-établis en Tunisie', tauxFR: '100%' },
    { ligne: 20, libelle: 'BTP non-résidents < 6 mois', tauxFR: '5% à 15%' },
    { ligne: 21, libelle: 'Établissements stables sans déclaration', tauxFR: '15% – 25%' },
    { ligne: 22, libelle: 'Avance ventes industrie/grossistes PP forfait', tauxFR: '1%' },
    { ligne: 23, libelle: 'Avance vins/bières/alcools', tauxFR: '5%' },
    { ligne: 24, libelle: 'Plus-value cession actions non-résidents', tauxFR: '10% – 20%' },
    { ligne: 30, libelle: 'Ventes industrie/grossistes ≤ 20 000 DT/an', tauxFR: '3%' },
    { ligne: 31, libelle: 'Paiements livreurs e-commerce sans MF', tauxFR: '3%' },
  ],

  tva: { taux: [
    { taux: 19, label: 'TVA normale — Biens et services généraux' },
    { taux: 13, label: 'TVA réduite — Transport, tourisme, produits agricoles transformés' },
    { taux: 7, label: 'TVA réduite — Produits de base, eau, électricité, médicaments' },
  ]},

  tvaSpeciaux: [
    { taux: 6, label: 'Cas particuliers (à déclarer séparément)' },
    { taux: 12, label: 'Cas particuliers' },
    { taux: 18, label: 'Cas particuliers' },
  ],

  tfp: { industrie: 1, autre: 2, base: 'Masse salariale brute' },

  foprolos: { taux: 1, base: 'Masse salariale' },

  tcl: [
    { regime: 1, label: 'Produits à prix réglementés (marge ≤ 6%)', local: 0.1, export: 0.1 },
    { regime: 2, label: 'Basé sur IS — 25% × IS N-1', special: true },
    { regime: 3, label: 'Autres entreprises — général', local: 0.2, export: 0.1 },
  ],

  taxeHoteliere: { taux: 2, base: 'CA brut' },
  taxeLicence: [
    { categorie: 1, montant: 300, frequence: '/local/an' },
    { categorie: 2, montant: 150, frequence: '/local/an' },
    { categorie: 3, montant: 25, frequence: '/local/an' },
  ],

  contributionsSociales: {
    diversification: { taux: 4, min: 10000, applicable: 'Banques, assurances, télécom, concessions auto' },
    solidaire: [
      { isTaux: [40, 35], taux: 4, min: 500 },
      { isTaux: [20], taux: 3, min: 400 },
      { isTaux: [15, 10], taux: 3, min: 200 },
    ],
    irppSolidaire: { taux: 0.5, seuil: 5000 },
  },

  deductionsIRPP: [
    { label: 'Chef de famille', montant: 300, type: 'fixe' },
    { label: 'Enfant à charge (4 premiers)', montant: 100, type: 'par_enfant' },
    { label: 'Enfant > 20 ans études sup sans bourse', montant: 1000, type: 'par_enfant' },
    { label: 'Enfant handicapé (tout âge/rang)', montant: 2000, type: 'par_enfant' },
    { label: 'Parent à charge', montant: '5% revenu net (plafond 450 DT/parent)', type: 'formule' },
    { label: 'Intérêts comptes épargne bancaires', montant: 6000, type: 'plafond' },
    { label: 'Intérêts obligations/BTA/sukuk', montant: 10000, type: 'plafond' },
    { label: 'Intérêts prêts obligataires verts', montant: 10000, type: 'plafond' },
    { label: 'Frais professionnels salariés', montant: '10% plafonné 2 000 DT', type: 'formule' },
    { label: 'Frais professionnels retraites', montant: '25% sans plafond', type: 'formule' },
  ],

  delais: [
    { libelle: 'Déclaration mensuelle (télédéclaration)', echeance: '15 du mois suivant' },
    { libelle: 'Déclaration mensuelle (dépôt physique)', echeance: '28 du mois suivant' },
    { libelle: 'IRPP salariés uniquement', echeance: '5 décembre N' },
    { libelle: 'IRPP autres revenus (BIC/BNC/fonciers...)', echeance: '25 avril N+1' },
    { libelle: 'IS (clôture 31 déc.)', echeance: '25 mars N+1' },
    { libelle: 'Déclaration employeur', echeance: '30 avril N+1' },
    { libelle: 'Acompte 1 IS', echeance: '28 juin' },
    { libelle: 'Acompte 2 IS', echeance: '28 septembre' },
    { libelle: 'Acompte 3 IS', echeance: '28 décembre' },
    { libelle: 'Plus-value cession actions', echeance: '26 février N+1' },
    { libelle: 'Impôt sur la fortune', echeance: '30 juin N' },
  ],

  penaliteRetard: { tauxMensuel: 0.75, majoration: 1, seuilJours: 30 },

  autresTaxes: [
    { num: 1, libelle: 'Fonds compétitivité industrie/services', taux: '1% CA HT' },
    { num: 2, libelle: 'Fonds compétitivité conserves alimentaires', taux: '1% CA HT' },
    { num: 7, libelle: 'Fonds compétitivité tourisme (hôtels/restaurants)', taux: '1%' },
    { num: 10, libelle: 'Redevance fonds télécom/TIC', taux: '5% CA' },
    { num: 16, libelle: 'Fonds lutte pollution', taux: '7% CA HT' },
    { num: 22, libelle: 'Redevance subvention fonds compensation', taux: '3% – 5% CA HT' },
  ],

  timbreFiscal: [
    { libelle: 'Factures téléphone/internet', montant: 'Selon opérateur' },
    { libelle: 'Tickets caisse 50–100 DT', montant: '1.5 DT/ticket' },
    { libelle: 'Tickets caisse > 100 DT', montant: '2 DT/ticket' },
    { libelle: 'Certificat visite technique véhicule', montant: '10 DT' },
    { libelle: 'Billet transport international', montant: '5 DT' },
    { libelle: 'Facture/traite', montant: '1 DT' },
  ],

  reglements: {
    acomptesIS: '3 acomptes égaux = IS N-1 ÷ 3 (28 juin, 28 sept, 28 déc)',
    impotMinimumIRPP: '0.2% CA local brut (min 300 DT); 0.1% pour déduction 2/3 (min 200 DT)',
    impotMinimumIS: '0.2% CA local brut (min 500 DT); 0.1% pour taux 10% (min 300 DT)',
    entreprisesNouvelles: 'Exonérées minimum 3 ans si pas de CA pendant réalisation',
  },
};

function detectLangue(texte) {
  const arabe = /[\u0600-\u06FF]/;
  const latin = /[a-zA-Z]/;
  const a = (texte.match(arabe) || []).length;
  const l = (texte.match(latin) || []).length;
  if (a > l && a > 2) return 'ar';
  if (l > a && l > 2) return 'fr';
  return 'fr';
}

function t(ar, fr, langue = 'fr') { return langue === 'ar' ? ar : fr; }

function formatDT(m, langue = 'fr') {
  if (m == null || isNaN(m)) return '0 DT';
  return m.toLocaleString(langue === 'ar' ? 'ar-TN' : 'fr-TN') + ' DT';
}

function calculerIRPPComplet(revenuImposable, deductions = {}) {
  let totalDeductions = 0;
  if (deductions.chefFamille) totalDeductions += 300;
  if (deductions.enfants) totalDeductions += Math.min(deductions.enfants, 4) * 100;
  if (deductions.enfantsEtudes) totalDeductions += deductions.enfantsEtudes * 1000;
  if (deductions.enfantsHandicape) totalDeductions += deductions.enfantsHandicape * 2000;
  if (deductions.parentCharge) totalDeductions += Math.min(revenuImposable * 0.05, 450);
  if (deductions.interetsEpargne) totalDeductions += Math.min(deductions.interetsEpargne, 6000);
  if (deductions.interetsObligations) totalDeductions += Math.min(deductions.interetsObligations, 10000);
  if (deductions.cnss) totalDeductions += deductions.cnss;

  const revenuApres = Math.max(0, revenuImposable - totalDeductions);
  let impot = 0;
  const tranches = [];
  let cumulTranche = 0;

  for (const t of FISCAL.baremeIRPP) {
    if (revenuApres > t.min && revenuApres > 0) {
      const baseTranche = Math.min(revenuApres, t.max) - Math.max(t.min, 0);
      const baseReelle = Math.max(0, baseTranche);
      const impotPartiel = baseReelle * t.taux / 100;
      cumulTranche += impotPartiel;
      if (baseReelle > 0 || t.max === Infinity) {
        tranches.push({ ...t, base: baseReelle, impotPartiel, cumul: cumulTranche });
      }
    }
    if (revenuApres <= t.max) break;
  }

  impot = cumulTranche;
  const tauxEffectif = revenuApres > 0 ? (impot / revenuApres * 100) : 0;
  const css = revenuApres > 5000 ? impot * 0.005 : 0;
  const totalAPayer = impot + css;

  return { revenuBrut: revenuImposable, deductions: totalDeductions, revenuImposable: revenuApres, tranches, impot, tauxEffectif, css, totalAPayer, impotMinimum: Math.max(300, FISCAL.baremeIRPP[0].taux > 0 ? 0 : 0) };
}

function calculerISComplet(resultatFiscal, taux = 20, acomptesPayes = 0, regime = 'general') {
  const infoTaux = FISCAL.tauxIS.find(t => t.taux === taux) || FISCAL.tauxIS[2];
  const impotBrut = resultatFiscal * taux / 100;
  const caLocal = resultatFiscal;
  const impotMinimum = Math.max(infoTaux.min || 500, caLocal * (taux === 10 ? 0.001 : 0.002));
  const impotDu = Math.max(impotBrut, impotMinimum);
  const acompteUnitaire = impotDu / 3;
  const solde = impotDu - acomptesPayes;

  let contribution = 0;
  if (regime === 'banque' || regime === 'assurance' || regime === 'telecom' || regime === 'concession') {
    contribution = resultatFiscal * 0.04;
    contribution = Math.max(contribution, 10000);
  } else {
    const cssInfo = FISCAL.contributionsSociales.solidaire.find(s => s.isTaux.includes(taux));
    if (cssInfo) {
      contribution = impotDu * cssInfo.taux / 100;
      contribution = Math.max(contribution, cssInfo.min);
    }
  }

  const total = impotDu + contribution;

  return {
    impotBrut, impotMinimum, impotDu,
    acomptes: { unitaire: acompteUnitaire, echeances: ['28 juin', '28 septembre', '28 décembre'] },
    acomptesPayes, soldeAPayer: Math.max(0, impotDu - acomptesPayes),
    contribution, total,
    info: `IS brut = ${resultatFiscal.toLocaleString('fr-TN')} × ${taux}% = ${impotBrut.toLocaleString('fr-TN')} DT — Minimum ${impotMinimum.toLocaleString('fr-TN')} DT — Retenu = ${impotDu.toLocaleString('fr-TN')} DT`,
  };
}

function calculerTVAResume(caParTaux = {}, tvaDejaPayee = 0) {
  let due = 0;
  const details = [];
  for (const [taux, ca] of Object.entries(caParTaux)) {
    const t = parseFloat(taux);
    const montantTVA = ca * t / 100;
    due += montantTVA;
    details.push({ taux: t, ca, montantTVA });
  }
  const solde = due - tvaDejaPayee;
  return { due, dejaPayee: tvaDejaPayee, solde, details,
    message: `TVA due = ${details.map(d => `${d.ca.toLocaleString('fr-TN')} × ${d.taux}% = ${d.montantTVA.toLocaleString('fr-TN')} DT`).join(' + ')} = ${due.toLocaleString('fr-TN')} DT — Déductible ${tvaDejaPayee.toLocaleString('fr-TN')} DT — Solde = ${Math.abs(solde).toLocaleString('fr-TN')} DT ${solde > 0 ? 'à payer' : 'crédit TVA'}`,
  };
}

function calculerPenalites(montantDu, joursDeRetard) {
  const mois = Math.ceil(joursDeRetard / 30);
  const penalite = montantDu * (FISCAL.penaliteRetard.tauxMensuel / 100) * mois;
  const majoration = joursDeRetard > 30 ? montantDu * (FISCAL.penaliteRetard.majoration / 100) : 0;
  return { montantDu, joursDeRetard, mois, penalite, majoration, total: montantDu + penalite + majoration };
}

const FISCAL_RISK_INDICATORS = [
  { id: 'tva_mismatch', label: 'Écart TVA collectée / déclarée', severity: 'high' },
  { id: 'missing_declarations', label: 'Absence de déclarations périodiques', severity: 'high' },
  { id: 'profit_anomaly', label: 'Anomalie de rentabilité vs secteur', severity: 'medium' },
  { id: 'payroll_irpp', label: 'Écart paie / IRPP retenu', severity: 'high' },
  { id: 'cnss_late', label: 'Retard de déclaration CNSS', severity: 'medium' },
  { id: 'teif_missing', label: 'Factures sans transmission TEIF', severity: 'low' },
  { id: 'rs_non_reverse', label: 'Retenue à la source non reversée', severity: 'high' },
];

const FORMULAIRES = [
  { id: 'mensuelle', labelFR: 'Déclaration mensuelle 2026', labelAR: 'التصريح الشهري بالأداءات 2026', url: 'https://jibaya.tn/wp-content/uploads/2026/05/mensuelle2026.pdf', icone: '📄' },
  { id: 'is', labelFR: 'Déclaration annuelle IS 2026', labelAR: 'التصريح السنوي بالضريبة على الشركات 2026', url: 'https://jibaya.tn/wp-content/uploads/2026/05/IS_2026.pdf', icone: '🏢' },
  { id: 'irpp', labelFR: 'Déclaration annuelle IRPP 2025', labelAR: 'التصريح السنوي بالضريبة على الدخل 2025', url: 'https://jibaya.tn/wp-content/uploads/2025/09/التصريح-بالضريبة-على-الدخل-2025.pdf', icone: '👤' },
  { id: 'employeur', labelFR: 'Déclaration employeur 2025', labelAR: 'تصريح المؤجر 2025', url: 'https://jibaya.tn/wp-content/uploads/2026/03/Imprime-DEC-EMPL-2025.pdf', icone: '👔' },
  { id: 'plusvalue', labelFR: 'Plus-value cession actions 2025', labelAR: 'التصريح بالقيمة الزائدة 2025', url: 'https://jibaya.tn/wp-content/uploads/2025/09/التصريح-بالقيمة-الزائدة-المتأتية-من-التفويت-في-الأسهم-2025.pdf', icone: '📈' },
  { id: 'fortune', labelFR: 'Impôt sur la fortune 2026', labelAR: 'الضريبة على الثروة 2026', url: 'https://jibaya.tn/wp-content/uploads/2026/06/impotFortune.pdf', icone: '💰' },
];

const PROCESS_STEPS = [
  { id: 'accueil', labelFR: 'Accueil', labelAR: 'مرحبا' },
  { id: 'contexte', labelFR: 'Contexte client', labelAR: 'معلومات المكلّف' },
  { id: 'remplissage', labelFR: 'Remplissage guidé', labelAR: 'التعمير' },
  { id: 'calculs', labelFR: 'Calculs automatiques', labelAR: 'الاحتساب' },
  { id: 'recap', labelFR: 'Récapitulatif', labelAR: 'الملخص' },
];

const SECTIONS = {
  mensuelle: [
    { id: 'identification', labelFR: 'Identification', labelAR: 'التعريف', icon: '📋' },
    { id: 'retenues_source', labelFR: 'Retenue à la source (31 lignes)', labelAR: 'الخصم من المنبع (31 خط)', icon: '💰' },
    { id: 'tfp', labelFR: 'TFP — Taxe formation professionnelle', labelAR: 'معلوم التكوين المهني', icon: '🎓' },
    { id: 'foprolos', labelFR: 'FOPROLOS (1%)', labelAR: 'فوبرولوص', icon: '🏠' },
    { id: 'tva', labelFR: 'TVA — Taxe sur la valeur ajoutée', labelAR: 'الأداء على القيمة المضافة', icon: '📊' },
    { id: 'autres_taxes', labelFR: 'Autres taxes (19 postes)', labelAR: 'المعاليم الأخرى (19)', icon: '🧾' },
    { id: 'timbre', labelFR: 'Timbre fiscal', labelAR: 'معلوم الطابع', icon: '🏷️' },
    { id: 'taxe_hoteliere', labelFR: 'Taxe hôtelière', labelAR: 'معلوم النزل', icon: '🏨' },
    { id: 'tcl', labelFR: 'TCL — Taxes collectivités locales', labelAR: 'معاليم الجماعات المحلية', icon: '🏛️' },
    { id: 'licence', labelFR: 'Taxe licence débits boissons', labelAR: 'معلوم الإجازة', icon: '🍷' },
  ],
  is: [
    { id: 'identification', labelFR: 'Identification', labelAR: 'التعريف', icon: '📋' },
    { id: 'donnees_taxation', labelFR: 'I — Données de taxation', labelAR: 'I — معطيات التضريب', icon: '📈' },
    { id: 'benefices_deduits', labelFR: 'II — Bénéfices déduits', labelAR: 'II — الأرباح المخصومة', icon: '📉' },
    { id: 'exonerations', labelFR: 'III — Sociétés exonérées', labelAR: 'III — الشركات المعفاة', icon: '✅' },
    { id: 'non_imposable', labelFR: 'IV — Produits non imposables', labelAR: 'IV — المداخيل غير الخاضعة', icon: '🟢' },
    { id: 'calcul_is', labelFR: 'V — Calcul IS', labelAR: 'V — حساب الضريبة', icon: '🧮' },
    { id: 'acomptes', labelFR: 'VI — Acomptes provisionnels', labelAR: 'VI — الدفعات', icon: '📅' },
    { id: 'liquidation', labelFR: 'VII — Liquidation finale', labelAR: 'VII — التسوية النهائية', icon: '✅' },
    { id: 'contributions', labelFR: 'VIII-IX — Contributions sociales + taxe visite', labelAR: 'VIII-IX — المساهمات الاجتماعية', icon: '🤝' },
    { id: 'recap_bancaire', labelFR: 'XII — Récapitulatif + comptes bancaires', labelAR: 'XII — الملخص والحسابات البنكية', icon: '🏦' },
  ],
  irpp: [
    { id: 'identification', labelFR: 'Identification', labelAR: 'التعريف', icon: '📋' },
    { id: 'situation_familiale', labelFR: 'Situation familiale', labelAR: 'الوضعية العائلية', icon: '👨‍👩‍👧‍👦' },
    { id: 'revenus', labelFR: 'Catégories de revenus', labelAR: 'أصناف المداخيل', icon: '💰' },
    { id: 'bic', labelFR: 'BIC — régime réel + forfaitaire', labelAR: 'الأرباح الصناعية والتجارية', icon: '🏭' },
    { id: 'bnc', labelFR: 'BNC — régime réel + forfaitaire', labelAR: 'الأرباح غير التجارية', icon: '👔' },
    { id: 'agriculture', labelFR: 'Agriculture/pêche', labelAR: 'الفلاحة والصيد', icon: '🌾' },
    { id: 'fonciers', labelFR: 'Revenus fonciers', labelAR: 'المداخيل العقارية', icon: '🏠' },
    { id: 'salaires', labelFR: 'Salaires et retraites', labelAR: 'الأجور والمعاشات', icon: '👷' },
    { id: 'deficits', labelFR: 'Déficits antérieurs', labelAR: 'الخسائر السابقة', icon: '📉' },
    { id: 'deductions', labelFR: 'Déductions communes', labelAR: 'الخصومات المشتركة', icon: '➖' },
    { id: 'calcul_irpp', labelFR: 'Calcul IRPP + contribution solidaire', labelAR: 'حساب الإرپ والمساهمة التضامنية', icon: '🧮' },
  ],
  employeur: [
    { id: 'identification', labelFR: 'Identification employeur', labelAR: 'تعريف المؤجر', icon: '📋' },
    { id: 'effectif', labelFR: 'Effectif et masse salariale', labelAR: 'العدد والأجور', icon: '👥' },
    { id: 'declarations', labelFR: 'Déclarations individuelles', labelAR: 'التصاريح الفردية', icon: '📄' },
    { id: 'recap_employeur', labelFR: 'Récapitulatif', labelAR: 'الملخص', icon: '📋' },
  ],
  plusvalue: [
    { id: 'identification', labelFR: 'Identification', labelAR: 'التعريف', icon: '📋' },
    { id: 'cessions', labelFR: 'Cessions d\'actions', labelAR: 'التفويت في الأسهم', icon: '📈' },
    { id: 'calcul_plusvalue', labelFR: 'Calcul plus-value', labelAR: 'حساب القيمة الزائدة', icon: '🧮' },
  ],
  fortune: [
    { id: 'identification', labelFR: 'Identification', labelAR: 'التعريف', icon: '📋' },
    { id: 'actifs', labelFR: 'Actifs imposables', labelAR: 'الأصول الخاضعة', icon: '💰' },
    { id: 'passifs', labelFR: 'Passifs déductibles', labelAR: 'الخصوم المخصومة', icon: '➖' },
    { id: 'calcul_fortune', labelFR: 'Calcul impôt fortune', labelAR: 'حساب ضريبة الثروة', icon: '🧮' },
  ],
};

const FIELD_PROMPTS = {
  identification: [
    { key: 'nom_ou_raison', fr: 'Nom / Raison sociale', ar: 'الاسم / العنوان الاجتماعي', type: 'text' },
    { key: 'adresse', fr: 'Adresse', ar: 'العنوان', type: 'text' },
    { key: 'activite', fr: 'Activité principale', ar: 'النشاط الرئيسي', type: 'text' },
    { key: 'annee', fr: 'Année/période concernée', ar: 'السنة/الفترة المعنية', type: 'text' },
  ],
  tva: [
    { key: 'ca_19', fr: 'CA HT soumis à 19%', ar: 'رقم المعاملات الخاضع لـ 19%' },
    { key: 'ca_13', fr: 'CA HT soumis à 13%', ar: 'رقم المعاملات الخاضع لـ 13%' },
    { key: 'ca_7', fr: 'CA HT soumis à 7%', ar: 'رقم المعاملات الخاضع لـ 7%' },
    { key: 'tva_deductible', fr: 'TVA déductible (total)', ar: 'الأداء المقتطع (المجموع)' },
  ],
  tfp: [
    { key: 'masse_salariale', fr: 'Masse salariale brute du mois', ar: 'الكتلة الشهرية للأجور الخام' },
    { key: 'secteur_activite', fr: 'Secteur (1=industrie, 2=autre)', ar: 'القطاع (1=صناعة، 2=غير ذلك)' },
  ],
  foprolos: [
    { key: 'masse_salariale_fop', fr: 'Masse salariale brute', ar: 'الكتلة الشهرية للأجور الخام' },
  ],
  timbre: [
    { key: 'montant_timbre', fr: 'Montant total timbre fiscal', ar: 'المبلغ الإجمالي لمعلوم الطابع' },
  ],
  taxe_hoteliere: [
    { key: 'ca_brut_hotel', fr: 'CA brut (hôtel/restaurant)', ar: 'رقم المعاملات الخام (نزل/مطعم)' },
  ],
  tcl: [
    { key: 'regime_tcl', fr: 'Régime TCL (1/2/3)', ar: 'نظام معاليم الجماعات المحلية (1/2/3)' },
    { key: 'ca_local_tcl', fr: 'CA local brut', ar: 'رقم المعاملات المحلي الخام' },
    { key: 'ca_export_tcl', fr: 'CA export (si applicable)', ar: 'رقم المعاملات التصدير (إن وجد)' },
  ],
  licence: [
    { key: 'categorie_licence', fr: 'Catégorie licence (1/2/3)', ar: 'صنف الإجازة (1/2/3)' },
    { key: 'nombre_locaux', fr: 'Nombre de locaux', ar: 'عدد المحلات' },
  ],
  situation_familiale: [
    { key: 'chef_famille', fr: 'Chef de famille ? (oui/non)', ar: 'رب أسرة؟ (نعم/لا)' },
    { key: 'nb_enfants', fr: 'Nombre d\'enfants à charge', ar: 'عدد الأطفال المكفولين' },
    { key: 'nb_enfants_etudes', fr: 'Enfants >20 ans en études sup.', ar: 'أطفال >20 سنة في التعليم العالي' },
    { key: 'nb_enfants_handicap', fr: 'Enfants handicapés à charge', ar: 'أطفال معوّقون مكفولون' },
  ],
  salaires: [
    { key: 'salaire_brut_annuel', fr: 'Salaire brut annuel', ar: 'الأجر الخام السنوي' },
    { key: 'cnss_salariale', fr: 'Cotisations CNSS salariales', ar: 'اشتراكات الأجير في الكناس' },
  ],
  deductions: [
    { key: 'interets_epargne', fr: 'Intérêts épargne (plafond 6000 DT)', ar: 'فوائد الادخار (سقف 6000 د.ت)' },
    { key: 'interets_obligations', fr: 'Intérêts obligations/BTA (plafond 10000 DT)', ar: 'فوائد السندات (سقف 10000 د.ت)' },
    { key: 'assurance_vie', fr: 'Primes assurance-vie', ar: 'أقساط التأمين على الحياة' },
  ],
  donnees_taxation: [
    { key: 'ca_brut', fr: 'Chiffre d\'affaires brut', ar: 'رقم المعاملات الخام' },
    { key: 'resultat_net', fr: 'Résultat net comptable', ar: 'النتيجة الصافية المحاسبية' },
    { key: 'stock_initial', fr: 'Stock initial', ar: 'المخزون الأولى' },
    { key: 'stock_final', fr: 'Stock final', ar: 'المخزون النهائي' },
  ],
  benefices_deduits: [
    { key: 'deductions_exploitation', fr: 'Déductions exploitation', ar: 'خصومات استغلال' },
    { key: 'deductions_reinvestissement', fr: 'Déductions réinvestissement', ar: 'خصومات إعادة استثمار' },
  ],
  calcul_is: [
    { key: 'resultat_fiscal', fr: 'Résultat fiscal', ar: 'النتيجة الجبائية' },
    { key: 'taux_is_applicable', fr: 'Taux IS applicable (10/15/20/35/40)', ar: 'نسبة الضريبة المطبقة (10/15/20/35/40)' },
  ],
  acomptes: [
    { key: 'acompte1_paye', fr: '1er acompte payé (28 juin)', ar: 'الدفعة الأولى المدفوعة (28 جوان)' },
    { key: 'acompte2_paye', fr: '2ème acompte payé (28 sept)', ar: 'الدفعة الثانية المدفوعة (28 سبتمبر)' },
    { key: 'acompte3_paye', fr: '3ème acompte payé (28 déc)', ar: 'الدفعة الثالثة المدفوعة (28 ديسمبر)' },
  ],
  revenus: [
    { key: 'type_revenu', fr: 'Type de revenu (BIC/BNC/fonciers/salaires/autres)', ar: 'صنف المدخول (أرباح صناعية/غير تجارية/عقارية/أجور/غيرها)' },
    { key: 'montant_brut', fr: 'Montant brut', ar: 'المبلغ الخام' },
  ],
  bic: [
    { key: 'ca_bic', fr: 'CA BIC', ar: 'رقم معاملات الأرباح الصناعية والتجارية' },
    { key: 'frais_bic', fr: 'Frais professionnels BIC', ar: 'مصاريف مهنية' },
  ],
  bnc: [
    { key: 'ca_bnc', fr: 'Recettes BNC', ar: 'إيرادات الأنشطة غير التجارية' },
    { key: 'frais_bnc', fr: 'Frais professionnels BNC', ar: 'مصاريف مهنية' },
  ],
  agriculture: [
    { key: 'ca_agricole', fr: 'Recettes agricoles/pêche', ar: 'إيرادات فلاحية/صيد بحري' },
  ],
  fonciers: [
    { key: 'loyers_bruts', fr: 'Loyers bruts encaissés', ar: 'الإيجارات الخام المقبوضة' },
    { key: 'frais_gestion', fr: 'Frais de gestion', ar: 'مصاريف التسيير' },
  ],
  deficits: [
    { key: 'deficits_reportables', fr: 'Déficits antérieurs reportables', ar: 'الخسائر السابقة القابلة للترحيل' },
  ],
  contributions: [
    { key: 'contribution_sociale', fr: 'Contribution sociale solidaire due', ar: 'المساهمة الاجتماعية التضامنية المستوجبة' },
  ],
  exonerations: [
    { key: 'exoneration_type', fr: 'Type d\'exonération', ar: 'نوع الإعفاء' },
    { key: 'montant_exonere', fr: 'Montant exonéré', ar: 'المبلغ المعفى' },
  ],
  non_imposable: [
    { key: 'produits_non_imposables', fr: 'Produits non imposables', ar: 'المداخيل غير الخاضعة' },
  ],
  liquidation: [
    { key: 'is_du', fr: 'IS dû après calcul', ar: 'الضريبة المستوجبة بعد الحساب' },
    { key: 'acomptes_total', fr: 'Total acomptes versés', ar: 'مجموع الدفعات المدفوعة' },
    { key: 'solde_a_payer', fr: 'Solde à payer', ar: 'الباقي للدفع' },
  ],
  recap_bancaire: [
    { key: 'compte1_rib', fr: 'RIB compte bancaire 1', ar: 'الحساب البنكي 1' },
    { key: 'compte2_rib', fr: 'RIB compte bancaire 2 (optionnel)', ar: 'الحساب البنكي 2 (اختياري)' },
  ],
  effectif: [
    { key: 'nb_salaries', fr: 'Nombre total de salariés', ar: 'العدد الجملي للأجراء' },
    { key: 'masse_salariale_annuelle', fr: 'Masse salariale annuelle brute', ar: 'الكتلة السنوية للأجور الخام' },
  ],
  cessions: [
    { key: 'nb_actions_cedees', fr: 'Nombre d\'actions cédées', ar: 'عدد الأسهم المفوّت فيها' },
    { key: 'prix_cession', fr: 'Prix de cession total', ar: 'ثمن التفويض الجملي' },
    { key: 'prix_acquisition', fr: 'Prix d\'acquisition total', ar: 'ثمن الشراء الجملي' },
  ],
  calcul_plusvalue: [
    { key: 'plus_value_brute', fr: 'Plus-value brute', ar: 'القيمة الزائدة الخام' },
  ],
  actifs: [
    { key: 'valeur_immobiliere', fr: 'Valeur biens immobiliers', ar: 'قيمة العقارات' },
    { key: 'valeur_mobiliere', fr: 'Valeur valeurs mobilières', ar: 'قيمة الأوراق المالية' },
    { key: 'autres_actifs', fr: 'Autres actifs', ar: 'أصول أخرى' },
  ],
  passifs: [
    { key: 'dettes_total', fr: 'Total dettes déductibles', ar: 'مجموع الديون المخصومة' },
  ],
  calcul_fortune: [
    { key: 'actif_net', fr: 'Actif net imposable', ar: 'الأصل الصافي الخاضع' },
  ],
};

// Sections with iterable fields (like 31 retenue lines)
const REPETITIVE_FIELDS = {
  retenues_source: {
    labelFR: 'Retenue à la source',
    labelAR: 'الخصم من المنبع',
    items: [
      { ligne: 1, libelle: 'Salaires/traitements (droit commun)', tauxFR: 'Barème progressif' },
      { ligne: 2, libelle: 'Salaires étrangers', tauxFR: '20% (25% p.e.c.)' },
      { ligne: 3, libelle: 'Contribution sociale solidaire salaires', tauxFR: 'Variable' },
      { ligne: 4, libelle: 'Commissions/loyers/honoraires non-commerciaux — Résidents PP/PM', tauxFR: '10%' },
      { ligne: '4b', libelle: 'Non-résidents PP/PM', tauxFR: '15% (17.64% p.e.c.)' },
      { ligne: 5, libelle: 'Honoraires PP hors régime réel', tauxFR: '10%' },
      { ligne: 6, libelle: 'Honoraires PM (IS/sociétés personnes)', tauxFR: '3%' },
      { ligne: 7, libelle: 'Cachets artistes/créateurs', tauxFR: '5%' },
      { ligne: 8, libelle: 'Loyers hôtels PM régime réel', tauxFR: '5%' },
      { ligne: 9, libelle: 'Primes de performance', tauxFR: '10%' },
      { ligne: 10, libelle: 'Intérêts dépôts épargne/obligations', tauxFR: '20% (25% p.e.c.)' },
      { ligne: 11, libelle: 'Revenus capitaux mobiliers résidents PP/PM', tauxFR: '20%' },
      { ligne: 12, libelle: 'Dividendes PP résidents', tauxFR: '10% (11.11% p.e.c.)' },
      { ligne: 13, libelle: 'Jetons présence résidents PP/PM', tauxFR: '20%' },
      { ligne: 14, libelle: 'Vacations hors activité principale', tauxFR: '15%' },
      { ligne: 15, libelle: 'Intérêts prêts banques non établies TN', tauxFR: '10%' },
      { ligne: 16, libelle: 'Prix cession immeubles résidents', tauxFR: '2.5%' },
      { ligne: 17, libelle: 'Achats ≥ 1000 DT TTC — IS 20%', tauxFR: '1%' },
      { ligne: 18, libelle: 'RS TVA paiements État/collectivités', tauxFR: '25%' },
      { ligne: 19, libelle: 'RS TVA non-établis en Tunisie', tauxFR: '100%' },
      { ligne: 20, libelle: 'BTP non-résidents < 6 mois', tauxFR: '5% à 15%' },
      { ligne: 21, libelle: 'Établissements stables sans déclaration', tauxFR: '15% – 25%' },
      { ligne: 22, libelle: 'Avance ventes industrie/grossistes PP forfait', tauxFR: '1%' },
      { ligne: 23, libelle: 'Avance vins/bières/alcools', tauxFR: '5%' },
      { ligne: 24, libelle: 'Plus-value cession actions non-résidents', tauxFR: '10% – 20%' },
      { ligne: 30, libelle: 'Ventes industrie/grossistes ≤ 20 000 DT/an', tauxFR: '3%' },
      { ligne: 31, libelle: 'Paiements livreurs e-commerce sans MF', tauxFR: '3%' },
    ],
    fieldPrompt: (item, lang) => t(
      `الخط ${item.ligne}: ${item.libelle} (${item.tauxFR}) — المبلغ بالدينار (0 لتخطي)`,
      `Ligne ${item.ligne}: ${item.libelle} (${item.tauxFR}) — montant en DT (0 pour passer)`, lang),
  },
  autres_taxes: {
    labelFR: 'Autres taxes',
    labelAR: 'المعاليم الأخرى',
    items: [
      { num: 1, libelle: 'Fonds compétitivité industrie/services', taux: '1% CA HT' },
      { num: 2, libelle: 'Fonds compétitivité conserves alimentaires', taux: '1% CA HT' },
      { num: 3, libelle: 'Fonds compétitivité agriculture/pêche — poissons', taux: '2%' },
      { num: 4, libelle: 'Fonds compétitivité — légumineuses/soja', taux: '2.5%' },
      { num: 5, libelle: 'Fonds compétitivité — légumes/fruits', taux: '2%' },
      { num: 6, libelle: 'Fonds compétitivité — viandes', taux: '0.050 DT/kg' },
      { num: 7, libelle: 'Fonds compétitivité tourisme (hôtels/restaurants)', taux: '1%' },
      { num: 10, libelle: 'Redevance fonds télécom/TIC', taux: '5% CA' },
      { num: 11, libelle: 'Fonds emploi — thé/café', taux: '0.150 DT/kg' },
      { num: 12, libelle: 'Taxe compensatoire ciment', taux: '2 DT/tonne' },
      { num: 16, libelle: 'Fonds lutte pollution', taux: '7% CA HT' },
      { num: 17, libelle: 'Fonds transition énergétique — climatiseurs', taux: '10 DT/1000W' },
      { num: 18, libelle: 'Fonds transition énergétique — lampes/tubes', taux: '60% CA HT' },
      { num: 22, libelle: 'Redevance subvention fonds compensation', taux: '3% – 5% CA HT' },
      { num: 23, libelle: 'Taxe résidence hôtelière', taux: '1-12 DT/nuit' },
      { num: 25, libelle: 'Taxe sucre (OTCO)', taux: '0.100 DT/kg' },
      { num: 27, libelle: 'Fonds diversification SS — recharge ≥5 DT', taux: '0.100 DT/op.' },
      { num: 28, libelle: 'Prélèvement location voitures', taux: '2 DT/jour' },
      { num: 29, libelle: 'Fonds handicapés (assurances accidents)', taux: '1% indemnités' },
    ],
    fieldPrompt: (item, lang) => t(
      `المعلوم ${item.num}: ${item.libelle} (${item.taux}) — المبلغ بالدينار (0 لتخطي)`,
      `Taxe ${item.num}: ${item.libelle} (${item.taux}) — montant en DT (0 pour passer)`, lang),
  },
};

export function generateResponse(query, context = {}) {
  const q = query.trim();
  const lang = detectLangue(q);
  const { invoices = [], expenses = [], history = [], guidedState } = context;

  const lastType = history.length > 0 ? history[history.length - 1].type : null;

  // Raccourcis de navigation
  if (q.match(/^(0|menu|retour|القائمة|الرئيسية)$/i)) {
    return buildAccueil(lang);
  }

  // === ÉTAPE 0: Accueil — sélection du formulaire ===
  if (!guidedState || guidedState.step === 'accueil') {
    if (q.match(/^(1|mensuelle|شهري)/i) && !q.match(/calcule|taux|irpp|is|tva|cnss/i)) {
      return startGuided('mensuelle', lang);
    }
    if (q.match(/^(2|is|شركات)/i) && !q.match(/calcule|taux|irpp/i)) {
      return startGuided('is', lang);
    }
    if (q.match(/^(3|irpp|دخل)/i) && !q.match(/calcule|taux/i)) {
      return startGuided('irpp', lang);
    }
    if (q.match(/^(4|employeur|مؤجر)/i)) {
      return startGuided('employeur', lang);
    }
    if (q.match(/^(5|plus.value|قيمة زائدة)/i)) {
      return startGuided('plusvalue', lang);
    }
    if (q.match(/^(6|fortune|ثروة)/i)) {
      return startGuided('fortune', lang);
    }
    if (q.match(/^(7|بحث|recherche)/i)) {
      return {
        type: 'recherche', langue: lang,
        message: t(
          '🔍 اكتب كلمة مفتاحية للبحث في كل المطبوعات (مثلاً: "TVA" أو "إقامة")',
          '🔍 Tapez un mot-clé pour chercher dans tous les formulaires (ex: "TVA" ou "hôtelière")', lang
        ),
      };
    }
    if (q.match(/^(0|مساعدة|aide|help)/i)) {
      return buildHelp(lang);
    }
  }

  // === Gestion du mode guidé ===
  if (guidedState && guidedState.active) {
    return handleGuidedInput(q, guidedState, lang);
  }

  // === Calculs personnalisés ===
  const revenuMatch = q.match(/(\d[\d\s]*)\s*dt/i);
  const montant = revenuMatch ? parseFloat(revenuMatch[1].replace(/\s/g, '')) : 0;

  if ((q.includes('calcule') || q.includes('mon irpp') || q.includes('mon is') || q.includes('حاسب') || q.includes('إرپ')) &&
      (q.includes('irpp') || q.includes('revenu') || q.includes('دخل'))) {
    let revenu = montant;
    if (!revenu && invoices.length > 0) revenu = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
    if (revenu > 0) {
      const result = calculerIRPPComplet(revenu);
      return {
        type: 'irpp_calculated', langue: lang,
        message: t(
          `📊 **احتساب الإرپ**\n\nالدخل الخاضع: **${formatDT(result.revenuBrut, 'ar')}**\nالخصومات: **${formatDT(result.deductions, 'ar')}**\nالدخل الصافي: **${formatDT(result.revenuImposable, 'ar')}**\n\n${result.tranches.filter(t => t.base > 0).map(t => `• الشريحة ${t.label} (${t.taux}%): ${formatDT(t.base, 'ar')} = **${formatDT(t.impotPartiel, 'ar')}**`).join('\n')}\n\n**الإرپ الإجمالي: ${formatDT(result.impot, 'ar')}**\nالمساهمة الاجتماعية (0.5%): **${formatDT(result.css, 'ar')}**\n**المجموع: ${formatDT(result.totalAPayer, 'ar')}**\nالمعدل الفعلي: **${result.tauxEffectif.toFixed(1)}%**`,
          `📊 **Calcul IRPP**\n\nRevenu imposable: **${formatDT(result.revenuBrut)}**\nDéductions: **${formatDT(result.deductions)}**\nRevenu net: **${formatDT(result.revenuImposable)}**\n\n${result.tranches.filter(t => t.base > 0).map(t => `• Tranche ${t.label} (${t.taux}%): ${formatDT(t.base)} = **${formatDT(t.impotPartiel)}**`).join('\n')}\n\n**IRPP brut: ${formatDT(result.impot)}**\nContribution sociale (0.5%): **${formatDT(result.css)}**\n**Total: ${formatDT(result.totalAPayer)}**\nTaux effectif: **${result.tauxEffectif.toFixed(1)}%**`, lang),
        data: result,
      };
    }
  }

  if ((q.includes('calcule') || q.includes('mon is') || q.includes('حاسب') || q.includes('إيس')) &&
      (q.includes('is') || q.includes('impôt') || q.includes('شركة') || q.includes('société'))) {
    let resultat = montant;
    if (!resultat && invoices.length > 0 && expenses.length > 0) {
      resultat = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0) - expenses.reduce((s, e) => s + (e.totalAmount || 0), 0);
    }
    if (resultat > 0) {
      const result = calculerISComplet(resultat);
      return {
        type: 'is_calculated', langue: lang,
        message: result.info + `\n\nAcomptes: ${result.acomptes.unitaire.toLocaleString('fr-TN')} DT × 3\nSolde à payer: ${result.soldeAPayer.toLocaleString('fr-TN')} DT`,
        data: { resultat, ...result },
      };
    }
  }

  // === Connaissances générales ===

  if (q.includes('tva') || q.includes('أداء') || (q.includes('taux') && !q.includes('irpp') && !q.includes('is') && !q.includes('cnss'))) {
    return {
      type: 'tva_rates', langue: lang,
      message: t(
        `**نسب الأداء على القيمة المضافة**\n${FISCAL.tva.taux.map(t => `• **${t.taux}%** — ${t.label}`).join('\n')}`,
        `**Taux de TVA**\n${FISCAL.tva.taux.map(t => `• **${t.taux}%** — ${t.label}`).join('\n')}`, lang),
      data: FISCAL.tva.taux,
    };
  }

  if (q.includes('irpp') || q.includes('impôt sur le revenu') || q.includes('إرپ') || q.includes('ضريبة دخل')) {
    return {
      type: 'irpp_rates', langue: lang,
      message: t(
        `**سلم الإرپ 2025**\n${FISCAL.baremeIRPP.map(b => `• ${b.label}: **${b.taux}%**`).join('\n')}\n\n**الخصومات:**\n${FISCAL.deductionsIRPP.slice(0, 5).map(d => `• ${d.label}: ${d.montant}`).join('\n')}`,
        `**Barème IRPP 2025**\n${FISCAL.baremeIRPP.map(b => `• ${b.label}: **${b.taux}%**`).join('\n')}\n\n**Déductions:**\n${FISCAL.deductionsIRPP.slice(0, 5).map(d => `• ${d.label}: ${d.montant}`).join('\n')}`, lang),
      data: FISCAL.baremeIRPP,
    };
  }

  if (q.includes('is') || q.includes('impôt sur les sociétés') || q.includes('société') || q.includes('إيس') || q.includes('شركة')) {
    return {
      type: 'is_rates', langue: lang,
      message: t(
        `**نسب الضريبة على الشركات**\n${FISCAL.tauxIS.map(t => `• **${t.taux}%** — ${t.label}`).join('\n')}\n\n**الحد الأدنى:** ${FISCAL.impotMinimumIS.map(i => `${i.label}: ${i.taux}% (min ${i.seuil} DT)`).join('\n')}`,
        `**Taux IS**\n${FISCAL.tauxIS.map(t => `• **${t.taux}%** — ${t.label}`).join('\n')}\n\n**Impôt minimum:** ${FISCAL.impotMinimumIS.map(i => `${i.label}: ${i.taux}% (min ${i.seuil} DT)`).join('\n')}`, lang),
      data: FISCAL.tauxIS,
    };
  }

  if (q.includes('cnss') || q.includes('sécurité sociale') || q.includes('salari') || q.includes('اجتماعية') || q.includes('كناس')) {
    return {
      type: 'cnss_rates', langue: lang,
      message: t(
        '**كناس 2025**\n• المؤجر: 16.57%\n• الأجير: 9.18%\n• المجموع: 25.75%\n• السقف الشهري: 6,000 DT\n• السقف السنوي: 72,000 DT',
        '**CNSS 2025**\n• Employeur: 16.57%\n• Salarié: 9.18%\n• Total: 25.75%\n• Plafond mensuel: 6,000 DT\n• Plafond annuel: 72,000 DT', lang),
    };
  }

  if (q.includes('régime') || q.includes('fiscal') && (q.includes('entreprise') || q.includes('société') || q.includes('مؤسسة') || q.includes('نظام'))) {
    return {
      type: 'fiscal_regime', langue: lang,
      message: t(
        '**الأنظمة الجبائية**\n• **نظام حقيقي**: رقم معاملات > 500,000 DT (مبيعات) أو 200,000 DT (خدمات) — محاسبة كاملة\n• **نظام مبسّط**: رقم معاملات 100,000 – 500,000 DT — محاسبة مبسّطة\n• **نظام اتفاقي**: رقم معاملات < 100,000 DT — تصريح سنوي',
        '**Régimes fiscaux**\n• **Réel**: CA > 500 000 DT (ventes) ou > 200 000 DT (prestations) — compta complète\n• **Simplifié**: CA 100 000 – 500 000 DT — compta simplifiée\n• **Forfaitaire**: CA < 100 000 DT — déclaration annuelle', lang),
    };
  }

  if (q.includes('retenue') || q.includes('rs') || q.includes('retenue à la source') || q.includes('خصم') || q.includes('مصدر')) {
    return {
      type: 'withholding_tax', langue: lang,
      message: t(
        '**الخصم من المنبع**\nالخطوط الرئيسية:\n' + FISCAL.retenuesSource.slice(0, 10).map(r => `• الخط ${r.ligne}: ${r.libelle} — ${r.tauxFR}`).join('\n'),
        '**Retenue à la source**\nLignes principales:\n' + FISCAL.retenuesSource.slice(0, 10).map(r => `• Ligne ${r.ligne}: ${r.libelle} — ${r.tauxFR}`).join('\n'), lang),
    };
  }

  if (q.includes('timbre') || q.includes('طابع')) {
    return {
      type: 'stamp_duty', langue: lang,
      message: t(
        '**معلوم الطابع**\n' + FISCAL.timbreFiscal.map(t => `• ${t.libelle}: ${t.montant}`).join('\n'),
        '**Timbre fiscal**\n' + FISCAL.timbreFiscal.map(t => `• ${t.libelle}: ${t.montant}`).join('\n'), lang),
    };
  }

  if (q.includes('tfp') || q.includes('formation') || q.includes('تكوين مهني')) {
    return {
      type: 'tfp', langue: lang,
      message: t(
        `**معلوم التكوين المهني**\n• الصناعات التحويلية: 1%\n• الأنشطة الأخرى: 2%\nالأساس: الأجور الخام`,
        `**TFP**\n• Industries manufacturières: 1%\n• Autres activités: 2%\nBase: Masse salariale brute`, lang),
    };
  }

  if (q.includes('foprolos') || q.includes('foprolos')) {
    return {
      type: 'foprolos', langue: lang,
      message: t('**فوبرولوص**\n• النسبة: 1%\n• الأساس: الأجور', '**FOPROLOS**\n• Taux: 1%\n• Base: Masse salariale'),
    };
  }

  if (q.includes('tcl') || q.includes('collectivité') || q.includes('بلدية') || q.includes('محلية')) {
    return {
      type: 'tcl', langue: lang,
      message: t(
        `**معاليم الجماعات المحلية**\n• النظام 1 (هامش ≤ 6%): 0.1% محلي + 0.1% تصدير\n• النظام 2 (حسب IS): 25% × IS N-1\n• النظام 3 (عام): 0.2% محلي + 0.1% تصدير\n• معلوم النزل: 2%\n• معلوم الإجازة: 300/150/25 DT`,
        `**TCL**\n• Régime 1 (marge ≤ 6%): 0.1% local + 0.1% export\n• Régime 2 (basé IS): 25% × IS N-1\n• Régime 3 (général): 0.2% local + 0.1% export\n• Taxe hôtelière: 2%\n• Taxe licence: 300/150/25 DT`, lang),
    };
  }

  if (q.includes('pénalité') || q.includes('amende') || q.includes('retard') || q.includes('خطية') || q.includes('غرامة')) {
    const joursMatch = q.match(/(\d+)\s*(jour|mois|يوم|شهر)/i);
    const montantMatch = q.match(/(\d[\d\s]*)\s*dt/i);
    let message;
    if (joursMatch && montantMatch) {
      const jours = parseInt(joursMatch[1]);
      const mnt = parseFloat(montantMatch[1].replace(/\s/g, ''));
      const result = calculerPenalites(mnt, jours);
      message = t(
        `⏰ **احتساب الخطايا**\nالأصل: ${formatDT(result.montantDu, 'ar')}\nالتأخير: ${result.joursDeRetard} يوم (${result.mois} شهر)\nالخطيـة (${FISCAL.penaliteRetard.tauxMensuel}%/شهر): ${formatDT(result.penalite, 'ar')}\nالزيادة (إن وجدت): ${formatDT(result.majoration, 'ar')}\n**المجموع: ${formatDT(result.total, 'ar')}**`,
        `⏰ **Calcul pénalités**\nPrincipal: ${formatDT(result.montantDu)}\nRetard: ${result.joursDeRetard} jours (${result.mois} mois)\nPénalité (${FISCAL.penaliteRetard.tauxMensuel}%/mois): ${formatDT(result.penalite)}\nMajoration: ${formatDT(result.majoration)}\n**Total: ${formatDT(result.total)}**`, lang);
    } else {
      message = t(
        `**خطايا التأخير**\n• نسبة شهرية: ${FISCAL.penaliteRetard.tauxMensuel}%\n• زيادة إضافية بعد 30 يوم: ${FISCAL.penaliteRetard.majoration}%\n\nللحساب: "احتسب خطية X DT على Y يوم"`,
        `**Pénalités de retard**\n• Taux mensuel: ${FISCAL.penaliteRetard.tauxMensuel}%\n• Majoration après 30 jours: ${FISCAL.penaliteRetard.majoration}%\n\nPour calculer: "calcule pénalité X DT sur Y jours"`, lang);
    }
    return { type: 'penalties', langue: lang, message };
  }

  if (q.includes('déduction') || q.includes('déductible') || q.includes('خصم') || q.includes('طرح')) {
    return {
      type: 'deductions', langue: lang,
      message: t(
        '**الخصومات الجبائية**\n' + FISCAL.deductionsIRPP.map(d => `• ${d.label}: ${d.montant}`).join('\n'),
        '**Déductions fiscales**\n' + FISCAL.deductionsIRPP.map(d => `• ${d.label}: ${d.montant}`).join('\n'), lang),
    };
  }

  if (q.includes('contribution') || q.includes('sociale') || q.includes('تضامنية') || q.includes('اجتماعية')) {
    return {
      type: 'contribution_sociale', langue: lang,
      message: t(
        `**المساهمة الاجتماعية التضامنية**\n• IRPP: 0.5% من صافي الدخل (≥ 5,000 DT)\n• IS 40-35%: 4% (min 500 DT)\n• IS 20%: 3% (min 400 DT)\n• IS 15-10%: 3% (min 200 DT)\n\n**مساهمة تنويع الصندوق (للبنوك والاتصالات...):**\n• 4% من الربح الخاضع (min 10,000 DT)`,
        `**Contribution sociale solidaire**\n• IRPP: 0.5% du revenu net (≥ 5,000 DT)\n• IS 40-35%: 4% (min 500 DT)\n• IS 20%: 3% (min 400 DT)\n• IS 15-10%: 3% (min 200 DT)\n\n**Diversification SS (banques, télécom...):**\n• 4% du bénéfice (min 10,000 DT)`, lang),
    };
  }

  if (q.includes('risque') || q.includes('audit') || q.includes('contrôle') || q.includes('مخاطر') || q.includes('مراقبة')) {
    const totalRevenue = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + (e.totalAmount || 0), 0);
    const profitMargin = totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(1) : 0;
    return {
      type: 'risk_analysis', langue: lang,
      message: t(
        `**تحليل المخاطر**\nرقم المعاملات: ${formatDT(totalRevenue, 'ar')}\nالمصروفات: ${formatDT(totalExpenses, 'ar')}\nالهامش: ${profitMargin}%\n\n${FISCAL_RISK_INDICATORS.map(r => `• [${r.severity === 'high' ? '🔴' : r.severity === 'medium' ? '🟡' : '🟢'}] ${r.label}`).join('\n')}`,
        `**Analyse des risques**\nCA: ${formatDT(totalRevenue)}\nDépenses: ${formatDT(totalExpenses)}\nMarge: ${profitMargin}%\n\n${FISCAL_RISK_INDICATORS.map(r => `• [${r.severity === 'high' ? '🔴' : r.severity === 'medium' ? '🟡' : '🟢'}] ${r.label}`).join('\n')}`, lang),
      data: { revenue: totalRevenue, expenses: totalExpenses, margin: profitMargin, indicators: FISCAL_RISK_INDICATORS },
    };
  }

  if (q.includes('optimisation') || q.includes('économiser') || q.includes('réduire') || q.includes('تحسين') || q.includes('توفير')) {
    return {
      type: 'optimization', langue: lang,
      message: t(
        '**نصائح للتحسين الجبائي**\n✅ استثمر في التجهيزات — استغل الإهتلاكات المعجّلة\n✅ وفّن للديون المشكوك فيها\n✅ حسّن مزيج الأجر/الأرباح لتخفيف الإرپ\n✅ وحّد مشترياتك عبر هيكل واحد\n✅ استعمل الكراء المالي (Leasing)\n✅ صرّح إلكترونياً\n✅ راجع الأداء شهرياً\n✅ وثّق كل شيء',
        '**Optimisation fiscale**\n✅ Valorisez vos investissements — amortissements accélérés\n✅ Provisionnez vos créances douteuses\n✅ Optimisez le mix salaire/dividendes\n✅ Centralisez vos achats\n✅ Utilisez le crédit-bail\n✅ Déclarez en ligne\n✅ Contrôle TVA régulier\n✅ Documentez tout', lang),
    };
  }

  if (q.includes('teif') || q.includes('facture électronique') || q.includes('facturation') || q.includes('فاتورة') || q.includes('تييف')) {
    return {
      type: 'teif', langue: lang,
      message: t(
        '**الفاتورة الإلكترونية TEIF**\n📅 منذ 2025: إجبارية B2B\n💰 الخطية: 100-500 DT لكل فاتورة\n\n**المسار:**\n1️⃣ توليد XML مطابق\n2️⃣ التوقيع الإلكتروني\n3️⃣ الإرسال إلى TTN\n4️⃣ مصادقة الزبون\n5️⃣ الأرشيف (10 سنوات)\n\nالتطبيق يتولى كل شيء آلياً!',
        '**Facturation électronique TEIF**\n📅 Depuis 2025: obligatoire B2B\n💰 Sanction: 100-500 DT/facture\n\n**Processus:**\n1️⃣ Génération XML conforme\n2️⃣ Signature électronique\n3️⃣ Transmission TTN\n4️⃣ Validation client\n5️⃣ Archivage 10 ans\n\nSmart Comptable gère tout automatiquement!', lang),
    };
  }

  if (q.includes('délai') || q.includes('échéance') || q.includes('تاريخ') || q.includes('أجل')) {
    return {
      type: 'delais', langue: lang,
      message: t(
        '**الآجال القانونية**\n' + FISCAL.delais.map(d => `• ${d.libelle}: **${d.echeance}**`).join('\n') + '\n\n⚠️ إذا صادف يوم الأحد أو عطلة: يُرجّع إلى اليوم الموالي',
        '**Délais légaux**\n' + FISCAL.delais.map(d => `• ${d.libelle}: **${d.echeance}**`).join('\n') + '\n\n⚠️ Si le dernier jour tombe un dimanche/férié: report au lendemain', lang),
    };
  }

  if (q.match(/^(aide|help|مساعدة|مساعدة)/i)) {
    return buildHelp(lang);
  }

  // === Fallback: pas compris → menu simple ===
  return {
    type: 'accueil', langue: lang,
    message: t(
      `لم أفهم "${q}". اختر رقماً:\n\n${FORMULAIRES.map((f, i) => `${i + 1}️⃣ ${f.icone} ${f.labelAR}`).join('\n')}\n\n0️⃣ استفسار`,
      `"${q}" ? Choisissez un numéro:\n\n${FORMULAIRES.map((f, i) => `${i + 1}️⃣ ${f.icone} ${f.labelFR}`).join('\n')}\n\n0️⃣ Renseignements`, lang),
    formulaires: FORMULAIRES,
  };
}

function buildAccueil(lang) {
  return {
    type: 'accueil', langue: lang,
    message: t(
      `**اختر تصريحاً لتعميره**\n\n${FORMULAIRES.map((f, i) => `${i + 1}️⃣ ${f.icone} ${f.labelAR}`).join('\n')}\n\n0️⃣ ❓ استفسار — نسب، حساب، آجال\n\nأو اكتب مباشرة: "نسبة TVA" أو "احتسب إرپ 50000"`,
      `**Sélectionnez un formulaire**\n\n${FORMULAIRES.map((f, i) => `${i + 1}️⃣ ${f.icone} ${f.labelFR}`).join('\n')}\n\n0️⃣ ❓ Renseignements — taux, calculs, délais\n\nOu tapez directement: "taux TVA" ou "calcule IRPP 50000"`, lang),
    formulaires: FORMULAIRES,
  };
}

function buildHelp(lang) {
  return {
    type: 'help', langue: lang,
    message: t(
      '**❓ المساعدة**\n\n⦿ اختر تصريحاً من القائمة\n⦿ أو اكتب سؤالك مباشرة\n\n**الكلمات المفتاحية:** TVA, IRPP, IS, CNSS, TFP, FOPROLOS, TCL, timbre, RS, TEIF, pénalité, déduction, optimisation, risque, délai\n\n**حساب:** "احتسب إرپ على X DT" / "احتسب إيس على X DT"\n\n**خطية:** "احتسب خطية X DT على Y يوم"',
      '**❓ Aide**\n\n⦿ Choisissez une déclaration dans la liste\n⦿ Ou posez directement votre question\n\n**Mots-clés:** TVA, IRPP, IS, CNSS, TFP, FOPROLOS, TCL, timbre, RS, TEIF, pénalité, déduction, optimisation, risque, délai\n\n**Calcul:** "calcule IRPP sur X DT" / "calcule IS sur X DT"\n\n**Pénalité:** "calcule pénalité X DT sur Y jours"', lang),
  };
}

function startGuided(formulaireId, lang) {
  const form = FORMULAIRES.find(f => f.id === formulaireId);
  return {
    type: 'guided_start', langue: lang, formulaire: formulaireId,
    message: t(
      `🔄 **بدء تعمير ${form.labelAR}**\n\nلنبدأ بمعلومات المكلّف:\n\n**المعرف الجبائي** (7 أرقام + 1-3 أحرف + 3 أرقام — مثال: 1234567A000 أو 1234567XAM000)`,
      `🔄 **Début remplissage ${form.labelFR}**\n\nCommençons par le contexte client:\n\n**Matricule Fiscal** (7 chiffres + 1-3 lettres + 3 chiffres — ex: 1234567A000 ou 1234567XAM000)`, lang),
    guidedState: {
      active: true, step: 'contexte', formulaire: formulaireId,
      data: { sections: {} },
      contextQuestions: ['matriculeFiscal', 'nom', 'adresse', 'personneType', 'regime', 'secteur', 'periode'],
      currentQuestionIndex: 0,
      url: form.url,
    },
  };
}

const CONTEXT_QUESTIONS = {
  matriculeFiscal: { ar: '**المعرف الجبائي** (7 أرقام + 1-3 أحرف + 3 أرقام — مثال: 1234567A000 أو 1234567XAM000)', fr: '**Matricule Fiscal** (7 chiffres + 1-3 lettres + 3 chiffres — ex: 1234567A000 ou 1234567XAM000)' },
  nom: { ar: '**الاسم / Raison sociale**', fr: '**Nom / Raison sociale**' },
  adresse: { ar: '**العنوان** — كامل العنوان', fr: '**Adresse** — Adresse complète' },
  personneType: { ar: '**النوع** — شخص طبيعي (PP) أم شخص معنوي (PM) ?', fr: '**Type** — Personne physique (PP) ou Personne morale (PM) ?' },
  regime: { ar: '**النظام** — حقيقي / مبسّط / اتفاقي ?', fr: '**Régime** — Réel / Simplifié / Forfaitaire ?' },
  secteur: { ar: '**قطاع النشاط** — مثال: تجارة، خدمات، صناعة', fr: '**Secteur d\'activité** — ex: Commerce, Services, Industrie' },
  periode: { ar: '**الفترة** — مثال: 2026-06 أو "السنة 2026"', fr: '**Période** — ex: 2026-06 ou "exercice 2026"' },
};

function buildSectionMenu(s, form, lang) {
  const sections = SECTIONS[s.formulaire] || [];
  const doneSections = Object.keys(s.data.sections || {});
  const lines = sections.map((sec, i) => {
    const done = doneSections.includes(sec.id) ? ' ✅' : '';
    return `${i + 1}️⃣ ${sec.icon} ${t(sec.labelAR, sec.labelFR, lang)}${done}`;
  });
  lines.push('');
  lines.push(t('📋 "تم" للملخص النهائي', '📋 "terminé" pour le récapitulatif', lang));
  return {
    type: 'guided_section', langue: lang,
    message: t(
      `✅ **${form.labelAR}**\n👤 ${s.data.nom} | MF: ${s.data.matriculeFiscal}\n🔗 ${form.url}\n\n**اختر القسم:**`,
      `✅ **${form.labelFR}**\n👤 ${s.data.nom} | MF: ${s.data.matriculeFiscal}\n🔗 ${form.url}\n\n**Choisissez la section:**`, lang),
    url: form.url,
    sections: sections.map((sec, i) => ({
      id: sec.id, icon: sec.icon, labelAR: sec.labelAR, labelFR: sec.labelFR,
      done: doneSections.includes(sec.id),
    })),
    guidedState: s,
  };
}

function startSection(s, sectionId, lang) {
  const secDef = SECTIONS[s.formulaire]?.find(se => se.id === sectionId);
  if (!secDef) return null;

  s.sectionId = sectionId;
  s.fieldIndex = 0;

  if (REPETITIVE_FIELDS[sectionId]) {
    const rf = REPETITIVE_FIELDS[sectionId];
    s.sectionType = 'repetitive';
    s.repetitiveIndex = 0;
    const item = rf.items[0];
    s.data.sections[sectionId] = s.data.sections[sectionId] || {};
    return {
      type: 'guided_input', langue: lang,
      message: t(
        `**${secDef.labelAR}**\n${rf.items.length} بند\n${rf.fieldPrompt(item, lang)}\n\n(أرسل 0 للتخطي، "كامل" للكل مرة)`,
        `**${secDef.labelFR}**\n${rf.items.length} postes\n${rf.fieldPrompt(item, lang)}\n\n(0 pour passer, "tout" pour montant unique)`, lang),
      guidedState: s,
    };
  }

  const prompts = FIELD_PROMPTS[sectionId];
  if (!prompts || prompts.length === 0) {
    s.data.sections[sectionId] = s.data.sections[sectionId] || {};
    const form = FORMULAIRES.find(f => f.id === s.formulaire);
    return showFieldPrompt(s, sectionId, 0, lang, secDef);
  }

  s.sectionType = 'fields';
  s.data.sections[sectionId] = s.data.sections[sectionId] || {};
  return showFieldPrompt(s, sectionId, 0, lang, secDef);
}

function showFieldPrompt(s, sectionId, fieldIdx, lang, secDef) {
  const prompts = FIELD_PROMPTS[sectionId];
  if (!prompts || fieldIdx >= prompts.length) {
    return sectionDone(s, sectionId, lang);
  }
  const p = prompts[fieldIdx];
  s.fieldIndex = fieldIdx;
  const isText = p.type === 'text';
  s.currentFieldType = isText ? 'text' : 'number';
  const arLabel = isText ? `${p.ar}:` : `**${p.ar}** — المبلغ بالدينار (0 لتخطي):`;
  const frLabel = isText ? `${p.fr}:` : `**${p.fr}** — montant en DT (0 pour passer):`;
  return {
    type: 'guided_input', langue: lang,
    message: t(
      `**${secDef?.labelAR || sectionId}**\nالسؤال ${fieldIdx + 1}/${prompts.length}\n${arLabel}`,
      `**${secDef?.labelFR || sectionId}**\nQuestion ${fieldIdx + 1}/${prompts.length}\n${frLabel}`, lang),
    guidedState: s,
  };
}

function sectionDone(s, sectionId, lang) {
  const secDef = SECTIONS[s.formulaire]?.find(se => se.id === sectionId);
  const vals = s.data.sections[sectionId] || {};
  const total = Object.values(vals).reduce((a, b) => a + (parseFloat(b) || 0), 0);
  s.sectionId = null;
  s.fieldIndex = 0;
  s.repetitiveIndex = 0;
  s.sectionType = null;
  s.currentFieldType = null;
  const form = FORMULAIRES.find(f => f.id === s.formulaire);
  return buildSectionMenu(s, form, lang);
}

function handleContexte(q, s, lang) {
  const idx = s.currentQuestionIndex || 0;
  if (idx === 0) {
    const mf = q.trim().toUpperCase();
    if (!/^\d{6,7}[A-Z]{1,3}\d{3}$/.test(mf.replace(/\//g, ''))) {
      return {
        type: 'guided_input', langue: lang,
        message: t('⚠️ المعرف الجبائي غير صحيح — 7 أرقام + 1-3 أحرف + 3 أرقام\nمثال: 1234567A000 أو 1234567XAM000\nحاول مرة أخرى:', '⚠️ MF invalide — 7 chiffres + 1-3 lettres + 3 chiffres\nExemple: 1234567A000 ou 1234567XAM000\nRéessayez:', lang),
        guidedState: s,
      };
    }
    s.data.matriculeFiscal = mf;
    s.currentQuestionIndex = 1;
  } else if (idx === 1) {
    s.data.nom = q.trim();
    s.currentQuestionIndex = 2;
  } else if (idx === 2) {
    s.data.adresse = q.trim();
    s.currentQuestionIndex = 3;
  } else if (idx === 3) {
    s.data.personneType = q.match(/physique|شخص طبيعي|pp/i) ? 'PP' : 'PM';
    s.currentQuestionIndex = 4;
  } else if (idx === 4) {
    s.data.regime = q.match(/réel|حقيقي/i) ? 'Réel' : q.match(/simplifié|مبسط/i) ? 'Simplifié' : q.match(/forfaitaire|اتفاقي/i) ? 'Forfaitaire' : 'Réel';
    s.currentQuestionIndex = 5;
  } else if (idx === 5) {
    s.data.secteur = q.trim();
    s.currentQuestionIndex = 6;
  } else if (idx === 6) {
    s.data.periode = q.trim();
    s.step = 'remplissage';
    s.data.sections = {};
    const form = FORMULAIRES.find(f => f.id === s.formulaire);
    return buildSectionMenu(s, form, lang);
  }
  const qData = CONTEXT_QUESTIONS[['matriculeFiscal', 'nom', 'adresse', 'personneType', 'regime', 'secteur', 'periode'][idx]];
  return { type: 'guided_input', langue: lang, message: t(qData.ar, qData.fr, lang), guidedState: s };
}

function handleRemplissage(q, s, lang) {
  const form = FORMULAIRES.find(f => f.id === s.formulaire);
  const sections = SECTIONS[s.formulaire] || [];
  const ql = q.trim().toLowerCase();

  // Navigation: "terminé" / "recap" / "تم"
  if (ql.match(/^(terminé|done|fin|recap|تم|خلص|ملخص)$/i)) {
    return buildRecap(s, lang);
  }

  // Navigation: "menu" / "retour" / "accueil"
  if (ql.match(/^(menu|0|retour|accueil|قائمة|رئيسية|رجوع)$/i)) {
    return buildAccueil(lang);
  }

  // If currently filling a section
  if (s.sectionId) {
    return handleSectionField(q, s, lang);
  }

  // Select section by number
  const numMatch = ql.match(/^(\d+)$/);
  if (numMatch) {
    const idx = parseInt(numMatch[1]) - 1;
    if (idx >= 0 && idx < sections.length) {
      return startSection(s, sections[idx].id, lang);
    }
  }

  // Select section by keyword
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    if (ql.includes(sec.id) || ql.includes(sec.labelFR.toLowerCase().slice(0, 8)) || ql.includes(sec.labelAR.slice(0, 4))) {
      return startSection(s, sec.id, lang);
    }
  }

  return buildSectionMenu(s, form, lang);
}

function handleSectionField(q, s, lang) {
  const sectionId = s.sectionId;
  const secDef = SECTIONS[s.formulaire]?.find(se => se.id === sectionId);
  const form = FORMULAIRES.find(f => f.id === s.formulaire);

  // Navigation commands during filling
  const ql = q.trim().toLowerCase();
  if (ql.match(/^(menu|retour|0|accueil|قائمة|رجوع)$/i)) return buildAccueil(lang);
  if (ql.match(/^(terminé|done|fin|recap|تم|خلص|ملخص)$/i)) return buildRecap(s, lang);
  if (ql.match(/^section|قسم/i)) {
    s.sectionId = null;
    s.sectionType = null;
    s.fieldIndex = 0;
    s.repetitiveIndex = 0;
    s.currentFieldType = null;
    return buildSectionMenu(s, form, lang);
  }
  if (ql.match(/^suivant|next|تالي|التالي|ok$/i)) {
    return advanceField(s, lang);
  }

  s.data.sections[sectionId] = s.data.sections[sectionId] || {};

  // Repetitive field (retenues source or autres taxes)
  if (s.sectionType === 'repetitive') {
    const rf = REPETITIVE_FIELDS[sectionId];
    if (!rf) return sectionDone(s, sectionId, lang);
    const idx = s.repetitiveIndex || 0;
    const item = rf.items[idx];

    // Handle "tout" / "كامل" — same value for all
    if (ql.match(/^(tout|all|كامل|الكل)$/i)) {
      s.data.sections[sectionId]._all = 'waiting_value';
      return { type: 'guided_input', langue: lang, message: t('المبلغ الموحد لكل البنود:', 'Montant unique pour tous les postes:'), guidedState: s };
    }

    // Store the value
    if (s.data.sections[sectionId]._all === 'waiting_value') {
      const val = parseFloat(q.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
      rf.items.forEach((it, i) => { s.data.sections[sectionId][`ligne_${it.ligne || it.num}`] = val; });
      delete s.data.sections[sectionId]._all;
      return sectionDone(s, sectionId, lang);
    }

    const val = parseFloat(q.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    s.data.sections[sectionId][`ligne_${item.ligne || item.num}`] = val;
    s.repetitiveIndex = idx + 1;

    if (s.repetitiveIndex >= rf.items.length) return sectionDone(s, sectionId, lang);
    const nextItem = rf.items[s.repetitiveIndex];
    return {
      type: 'guided_input', langue: lang,
      message: rf.fieldPrompt(nextItem, lang),
      guidedState: s,
    };
  }

  // Regular field prompts
  const prompts = FIELD_PROMPTS[sectionId];
  if (!prompts) return sectionDone(s, sectionId, lang);

  const idx = s.fieldIndex || 0;
  const p = prompts[idx];
  if (!p) return sectionDone(s, sectionId, lang);

  const isText = p.type === 'text';
  const val = isText ? q.trim() : (parseFloat(q.replace(/[^\d.,]/g, '').replace(',', '.')) || 0);
  s.data.sections[sectionId][p.key] = val;
  s.fieldIndex = idx + 1;

  if (s.fieldIndex >= prompts.length) return sectionDone(s, sectionId, lang);
  return showFieldPrompt(s, sectionId, s.fieldIndex, lang, secDef);
}

function advanceField(s, lang) {
  const sectionId = s.sectionId;
  if (s.sectionType === 'repetitive') {
    const rf = REPETITIVE_FIELDS[sectionId];
    if (rf) s.repetitiveIndex = (s.repetitiveIndex || 0) + 1;
    if (!rf || s.repetitiveIndex >= rf.items.length) return sectionDone(s, sectionId, lang);
    return { type: 'guided_input', langue: lang, message: rf.fieldPrompt(rf.items[s.repetitiveIndex], lang), guidedState: s };
  }
  const prompts = FIELD_PROMPTS[sectionId];
  if (!prompts) return sectionDone(s, sectionId, lang);
  s.fieldIndex = (s.fieldIndex || 0) + 1;
  if (s.fieldIndex >= prompts.length) return sectionDone(s, sectionId, lang);
  return showFieldPrompt(s, sectionId, s.fieldIndex, lang, SECTIONS[s.formulaire]?.find(se => se.id === sectionId));
}

function buildRecap(s, lang) {
  const form = FORMULAIRES.find(f => f.id === s.formulaire);
  const sections = SECTIONS[s.formulaire] || [];
  const doneSections = Object.keys(s.data.sections || {});
  let recapSections = doneSections.map(id => {
    const sec = sections.find(s => s.id === id);
    const vals = s.data.sections[id] || {};
    const total = Object.values(vals).reduce((a, b) => a + (parseFloat(b) || 0), 0);
    return `• ${sec ? t(sec.labelAR, sec.labelFR, lang) : id}: **${formatDT(total, lang)}**`;
  }).join('\n');

  s.step = 'recap';
  return {
    type: 'guided_recap', langue: lang,
    message: t(
      `📋 **الملخص النهائي — ${form.labelAR}**\n━━━━━━━━━━━━━━━━\n👤 ${s.data.nom} | MF: ${s.data.matriculeFiscal}\n📅 ${s.data.periode}\n🔗 ${form.url}\n━━━━━━━━━━━━━━━━\n${recapSections}\n━━━━━━━━━━━━━━━━\n\n✅ التصريح جاهز للإيداع\n\n[A] تصريح آخر  [B] تحميل PDF  [C] العودة للقائمة`,
      `📋 **Récapitulatif final — ${form.labelFR}**\n━━━━━━━━━━━━━━━━\n👤 ${s.data.nom} | MF: ${s.data.matriculeFiscal}\n📅 ${s.data.periode}\n🔗 ${form.url}\n━━━━━━━━━━━━━━━━\n${recapSections}\n━━━━━━━━━━━━━━━━\n\n✅ Déclaration complète — prête pour dépôt\n\n[A] Autre déclaration  [B] Télécharger PDF  [C] Retour au menu`, lang),
    url: form.url,
    guidedState: { ...s, step: 'recap' },
  };
}

function handleRecap(q, s, lang) {
  const cmd = q.trim().toUpperCase();
  if (cmd === 'A' || q.match(/autre|آخر|تصريح/i)) return buildAccueil(lang);
  if (cmd === 'B' || q.match(/download|télécharger|تحميل/i)) {
    return {
      type: 'download_pdf', langue: lang, guidedState: s,
      message: t('🔄 جاري تحميل الـ PDF...', '🔄 Téléchargement du PDF...', lang),
    };
  }
  if (cmd === 'C' || q.match(/menu|قائمة|retour/i)) return buildAccueil(lang);
  return {
    type: 'guided_recap', langue: lang,
    message: t('[A] تصريح آخر  [B] تحميل PDF  [C] العودة للقائمة', '[A] Autre déclaration  [B] Télécharger PDF  [C] Retour au menu', lang),
    guidedState: s,
  };
}

function handleGuidedInput(q, state, lang) {
  const s = { ...state, data: { ...state.data, sections: { ...(state.data?.sections || {}) } } };
  if (s.step === 'contexte') return handleContexte(q, s, lang);
  if (s.step === 'remplissage') return handleRemplissage(q, s, lang);
  if (s.step === 'recap') return handleRecap(q, s, lang);
  return buildAccueil(lang);
}

export function getSuggestedPrompts() {
  return [
    { icon: '📄', label: 'Déclaration mensuelle', query: '1' },
    { icon: '🏢', label: 'IS 2026', query: '2' },
    { icon: '👤', label: 'IRPP 2025', query: '3' },
    { icon: '💰', label: 'Taux TVA', query: 'taux TVA' },
    { icon: '📊', label: 'Barème IRPP', query: 'barème IRPP' },
    { icon: '🧮', label: 'Calcul IS', query: 'calcule mon IS sur 120000 DT' },
    { icon: '⚠️', label: 'Pénalités', query: 'calcule pénalité 10000 DT sur 45 jours' },
    { icon: '📈', label: 'Risques', query: 'analyse mes risques fiscaux' },
  ];
}

export function calculateTaxForecast(invoices = [], expenses = [], months = 6) {
  const monthly = [];
  const now = new Date();
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    monthly.push({
      month: d.toLocaleString('fr-FR', { month: 'short', year: 'numeric' }),
      revenue: 0, expenses: 0, tvaCollected: 0, tvaDeductible: 0, tvaDue: 0,
    });
  }
  invoices.forEach(inv => {
    const d = new Date(inv.issueDate);
    const idx = ((d.getFullYear() - now.getFullYear()) * 12) + (d.getMonth() - now.getMonth());
    if (idx >= 0 && idx < months) {
      monthly[idx].revenue += inv.totalAmount || 0;
      monthly[idx].tvaCollected += inv.vatAmount || 0;
    }
  });
  expenses.forEach(exp => {
    const d = new Date(exp.date);
    const idx = ((d.getFullYear() - now.getFullYear()) * 12) + (d.getMonth() - now.getMonth());
    if (idx >= 0 && idx < months) {
      monthly[idx].expenses += exp.totalAmount || 0;
      monthly[idx].tvaDeductible += (exp.totalAmount || 0) * 0.19 / 1.19;
    }
  });
  monthly.forEach(m => { m.tvaDue = Math.max(0, m.tvaCollected - m.tvaDeductible); });
  return monthly;
}

export function getFiscalAlerts() {
  return [
    { id: 'tva_monthly', type: 'tva', title: 'Déclaration TVA mensuelle', dueDay: 15, severity: 'high' },
    { id: 'rs_monthly', type: 'rs', title: 'Reversement Retenue à la Source', dueDay: 20, severity: 'high' },
    { id: 'is_acompte1', type: 'is', title: '1er Acompte provisionnel IS', dueDay: 28, month: 6, severity: 'medium' },
    { id: 'is_acompte2', type: 'is', title: '2ème Acompte provisionnel IS', dueDay: 28, month: 9, severity: 'medium' },
    { id: 'is_acompte3', type: 'is', title: '3ème Acompte provisionnel IS', dueDay: 28, month: 12, severity: 'medium' },
  ];
}

export function calculateFiscalHealthScore(invoices = [], expenses = [], transactions = []) {
  let score = 100;
  const details = [];
  const totalRevenue = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.totalAmount || 0), 0);

  if (totalRevenue > 0) {
    const overdueRatio = invoices.filter(i => i.status === 'OVERDUE').length / invoices.length;
    if (overdueRatio > 0.2) { score -= 10; details.push({ reason: 'Trop de factures en retard', impact: -10 }); }
  }

  const expenseRatio = totalRevenue > 0 ? totalExpenses / totalRevenue : 0;
  if (expenseRatio > 0.9) { score -= 15; details.push({ reason: 'Marge bénéficiaire trop faible (<10%)', impact: -15 }); }
  else if (expenseRatio > 0.8) { score -= 5; details.push({ reason: 'Marge bénéficiaire réduite', impact: -5 }); }

  if (invoices.length > 5 && invoices.filter(i => i.status === 'SENT').length > 5) {
    score -= 5; details.push({ reason: 'Factures envoyées non payées', impact: -5 });
  }

  if (invoices.length === 0 && expenses.length === 0) {
    score = 50; details.push({ reason: 'Aucune activité comptable enregistrée', impact: -50 });
  }

  return {
    score: Math.max(0, score), details,
    level: score >= 80 ? 'Excellent' : score >= 60 ? 'Attention' : 'Risqué',
    levelColor: score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400',
  };
}
