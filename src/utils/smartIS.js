const IS_RATES = {
  agriculture: 0.10,
  reduit_petites_entreprises: 0.15,
  industrie_export: 0.15,
  commerce_services: 0.20,
  normal: 0.25,
  etablissements_stables: 0.25,
  trading: 0.25,
  secteurs_reglementes: 0.35,
  societes_civiles: 0.35,
  banques: 0.40,
  assurances_telecoms: 0.40,
};

const CSS_RATES = {
  faible: 0.03,
  eleve: 0.04,
};

const CSS_MIN = { faible: 400, eleve: 500 };

const ACOMPTE_RATES = [0.30, 0.30, 0.40];

function getCSS(resultatFiscal, tauxIS) {
  if (tauxIS <= 0.20) {
    const css = Math.max(resultatFiscal * tauxIS * CSS_RATES.faible, CSS_MIN.faible);
    return { taux: CSS_RATES.faible, montant: Math.round(css * 1000) / 1000 };
  }
  const css = Math.max(resultatFiscal * tauxIS * CSS_RATES.eleve, CSS_MIN.eleve);
  return { taux: CSS_RATES.eleve, montant: Math.round(css * 1000) / 1000 };
}

export function calculateIS(resultatFiscal, regime = 'normal') {
  const taux = IS_RATES[regime] || IS_RATES.normal;
  const impot = resultatFiscal * taux;
  const css = getCSS(resultatFiscal, taux);
  const acomptes = ACOMPTE_RATES.map((r, i) => ({
    numero: i + 1,
    taux: r,
    montant: Math.round(impot * r * 1000) / 1000,
    echeance: i === 0 ? '25/06' : i === 1 ? '25/09' : '25/12',
  }));

  return {
    resultatFiscal,
    taux,
    impotBrut: Math.round(impot * 1000) / 1000,
    css,
    impotEtCSS: Math.round((impot + css.montant) * 1000) / 1000,
    acomptes,
    totalAcomptes: acomptes.reduce((s, a) => s + a.montant, 0),
    soldeAPayer: Math.round(impot * 1000) / 1000 - acomptes.reduce((s, a) => s + a.montant, 0),
    echeanceDeclaration: '31/03/N+1 (papier) ou 30/04/N+1 (en ligne)',
  };
}

export function simulateIS(resultatFiscal, scenarios = []) {
  const base = calculateIS(resultatFiscal);
  const simulations = [];

  for (const sc of scenarios) {
    const result = calculateIS(sc.resultat || resultatFiscal, sc.regime || 'normal');
    simulations.push({
      label: sc.label,
      resultatFiscal: result.resultatFiscal,
      impot: result.impotBrut,
      difference: result.impotBrut - base.impotBrut,
      economie: base.impotBrut - result.impotBrut,
    });
  }

  return { base, simulations };
}

export function calculateProvisionIS(resultatMensuels = [], regime = 'normal') {
  const cumulResultat = resultatMensuels.reduce((s, m) => s + (m.resultat || 0), 0);
  const taux = IS_RATES[regime] || IS_RATES.normal;
  const isEstime = cumulResultat * taux;
  const mois = resultatMensuels.length;

  return {
    cumulResultat,
    isEstime: Math.round(isEstime * 1000) / 1000,
    moisTraites: mois,
    provisionMensuelle: mois > 0 ? Math.round((isEstime / mois) * 1000) / 1000 : 0,
    chargeMensuelleEstimee: Math.round((cumulResultat / Math.max(mois, 1)) * taux * 1000) / 1000,
  };
}

export function getISDeductions() {
  return [
    { code: 'amortissements', label: 'Amortissements', taux: 'Variable selon bien' },
    { code: 'provisions', label: 'Provisions réglementées', taux: 'Selon nature' },
    { code: 'interets', label: 'Intérêts d\'emprunt', taux: 'Taux du marché' },
    { code: 'reinvestissement', label: 'Réinvestissement', taux: 'Abattement 35%' },
    { code: 'export', label: 'Activités exportatrices', taux: 'Exonération 10 ans' },
    { code: 'developpement_regional', label: 'Développement régional', taux: 'Exonération 50% 5 ans' },
  ];
}

export function generateISDeclaration(resultatFiscal, regime = 'normal', acomptesVerses = []) {
  const is = calculateIS(resultatFiscal, regime);
  const totalAcomptes = acomptesVerses.reduce((s, a) => s + (a.montant || 0), 0);

  return {
    exercice: new Date().getFullYear(),
    resultatFiscal,
    impotBrut: is.impotBrut,
    acomptesVerses: totalAcomptes,
    solde: Math.round((is.impotBrut - totalAcomptes) * 1000) / 1000,
    penalites: is.impotBrut > totalAcomptes ? 0 : 0,
    declarationEcheance: `31/03/${new Date().getFullYear() + 1}`,
    acomptesN1: calculateIS(resultatFiscal * 1.1, regime).acomptes,
  };
}
