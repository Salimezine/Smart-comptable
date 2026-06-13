const IRPP_BAREME_2026 = [
  { min: 0, max: 5000, taux: 0, deduction: 0 },
  { min: 5000, max: 10000, taux: 15, deduction: 0 },
  { min: 10000, max: 20000, taux: 25, deduction: 0 },
  { min: 20000, max: 30000, taux: 30, deduction: 0 },
  { min: 30000, max: 40000, taux: 33, deduction: 0 },
  { min: 40000, max: 50000, taux: 36, deduction: 0 },
  { min: 50000, max: 70000, taux: 38, deduction: 0 },
  { min: 70000, max: Infinity, taux: 40, deduction: 0 },
];

export function calculateIRPP(revenuImposable) {
  let impot = 0;
  let previousMax = 0;

  for (const tranche of IRPP_BAREME_2026) {
    if (revenuImposable > tranche.min) {
      const montantTranche = Math.min(revenuImposable, tranche.max) - tranche.min;
      impot += montantTranche * (tranche.taux / 100);
    }
    if (revenuImposable <= tranche.max) break;
  }

  return {
    revenuImposable,
    impotBrut: Math.round(impot * 1000) / 1000,
    tauxEffectif: revenuImposable > 0 ? (impot / revenuImposable * 100) : 0,
    tranches: IRPP_BAREME_2026.map(t => ({
      ...t,
      applicable: revenuImposable > t.min,
      impotPartiel: revenuImposable > t.min
        ? Math.round(Math.min(revenuImposable - Math.max(t.min, 0), t.max - t.min) * (t.taux / 100) * 1000) / 1000
        : 0,
    })),
  };
}

export function simulateIRPP(revenuBase, scenarios = []) {
  const base = calculateIRPP(revenuBase);
  const simulations = [];

  for (const sc of scenarios) {
    const newRevenu = Math.max(0, revenuBase + (sc.adjustment || 0));
    const result = calculateIRPP(newRevenu);
    simulations.push({
      label: sc.label,
      revenuImposable: newRevenu,
      impotBrut: result.impotBrut,
      difference: result.impotBrut - base.impotBrut,
      economie: base.impotBrut - result.impotBrut,
      tauxEffectif: result.tauxEffectif,
    });
  }

  return { base, simulations };
}

export function getIRPPDeductions() {
  return [
    { code: 'assurance_vie', label: 'Assurance-vie', plafond: 1500, description: 'Primes d\'assurance-vie' },
    { code: 'credit_immobilier', label: 'Intérêts crédit immobilier', plafond: 3000, description: 'Intérêts sur prêt logement principal' },
    { code: 'dons', label: 'Dons aux œuvres', plafond: 1000, description: 'Dons aux associations reconnues' },
    { code: 'formation', label: 'Formation professionnelle', plafond: 2000, description: 'Frais de formation continue' },
    { code: 'sante', label: 'Frais médicaux', plafond: 1500, description: 'Assurance santé et frais médicaux' },
  ];
}

export function generateIRPPDeclaration(employes, revenusAnnuels) {
  const totalRevenus = revenusAnnuels.reduce((s, r) => s + r.montant, 0);
  const irpp = calculateIRPP(totalRevenus);
  const retenuesSource = employes.reduce((s, e) => s + (e.irppRetenu || 0), 0);

  return {
    totalRevenus,
    impotDu: irpp.impotBrut,
    retenuesEffectuees: retenuesSource,
    soldeAPayer: Math.max(0, irpp.impotBrut - retenuesSource),
    tropPerçu: Math.max(0, retenuesSource - irpp.impotBrut),
    tauxEffectif: irpp.tauxEffectif,
    declarationDate: `31/03/${new Date().getFullYear()}`,
  };
}
