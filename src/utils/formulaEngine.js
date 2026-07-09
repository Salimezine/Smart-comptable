const DEFAULT_TEMPLATES = [
  {
    id: 'default',
    name: 'Par défaut',
    client_match: '',
    is_default: true,
    sector: '',
    regime: '',
    config: {
      mensuelle: {
        tfp_rate: 0.01,
        tcl_rate: 0.10,
        timbre: 1.000,
        foprolos_rate: 0.01,
        foprolos_threshold: 10,
      },
      is: { is_rate: 0.20, taux_minimum: 0.002, seuil_minimum: 500 },
      irpp: { bareme: [
        { min: 0, max: 5000, taux: 0 },
        { min: 5001, max: 10000, taux: 15 },
        { min: 10001, max: 20000, taux: 25 },
        { min: 20001, max: 30000, taux: 30 },
        { min: 30001, max: 40000, taux: 33 },
        { min: 40001, max: 50000, taux: 36 },
        { min: 50001, max: 70000, taux: 38 },
        { min: 70001, max: Infinity, taux: 40 },
      ]},
      employeur: { tfp_rate: 0.01 },
      plusvalue: { taux: 0.05 },
      fortune: { bareme: [
        { min: 0, max: 1000000, taux: 0.005 },
        { min: 1000001, max: 2000000, taux: 0.01 },
        { min: 2000001, max: 5000000, taux: 0.015 },
        { min: 5000001, max: Infinity, taux: 0.02 },
      ]},
    },
  },
  {
    id: 'transport_passager',
    name: 'Transport / Passager',
    client_match: 'PASSAGER',
    is_default: false,
    sector: 'Transport',
    regime: 'Réel',
    config: {
      mensuelle: {
        retenues_source_defaults: { 17: 1, 22: 1 },
        tfp_rate: 0.01,
        tcl_rate: 0.10,
      },
    },
  },
  {
    id: 'commerce_gros',
    name: 'Commerce de gros',
    client_match: 'GROS|GROSSISTE|DISTRIBUTION',
    is_default: false,
    sector: 'Commerce',
    regime: 'Réel',
    config: {
      mensuelle: {
        retenues_source_defaults: { 17: 1 },
        tfp_rate: 0.01,
        tcl_rate: 0.10,
      },
    },
  },
  {
    id: 'btp',
    name: 'Bâtiment / Travaux Publics',
    client_match: 'BTP|BATIMENT|CONSTRUCTION|PROMOTION|IMMOBILIER',
    is_default: false,
    sector: 'BTP',
    regime: 'Réel',
    config: {
      mensuelle: {
        retenues_source_defaults: { 2: 10, 17: 1 },
        tfp_rate: 0.01,
        tcl_rate: 0.10,
      },
    },
  },
  {
    id: 'sante',
    name: 'Santé / Cliniques',
    client_match: 'CLINIQUE|SANTE|HOPITAL|MEDICAL|LABORATOIRE',
    is_default: false,
    sector: 'Santé',
    regime: 'Réel',
    config: {
      mensuelle: {
        tva_rate: 7,
        tfp_rate: 0.01,
        tcl_rate: 0.10,
      },
    },
  },
  {
    id: 'hotellerie',
    name: 'Hôtellerie / Tourisme',
    client_match: 'HOTEL|TOURISME|RESTAURANT|HOTELLERIE',
    is_default: false,
    sector: 'Tourisme',
    regime: 'Réel',
    config: {
      mensuelle: {
        tva_rate: 13,
        taxe_hoteliere_taux: { '5*': 12, '4*': 8, '3*': 5, '2*': 3, '1*': 2, 'NC': 1 },
        tfp_rate: 0.01,
        tcl_rate: 0.10,
      },
    },
  },
  {
    id: 'agriculture',
    name: 'Agriculture / Pêche',
    client_match: 'AGRICULT|FERME|PECHE|ELEVAGE|AGRICOLE',
    is_default: false,
    sector: 'Agriculture',
    regime: 'Réel',
    config: {
      mensuelle: {
        tva_rate: 7,
        tfp_rate: 0,
        tcl_rate: 0.10,
      },
    },
  },
];

let userTemplates = [];
let listeners = [];

function notifyListeners() {
  for (const fn of listeners) fn(getAllTemplates());
}

export function onTemplatesChange(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter(l => l !== fn); };
}

export function getAllTemplates() {
  return [...DEFAULT_TEMPLATES, ...userTemplates];
}

export function addUserTemplate(template) {
  userTemplates.push({ ...template, id: 'user_' + Date.now(), is_default: false, is_user: true });
  notifyListeners();
  return userTemplates[userTemplates.length - 1];
}

export function removeUserTemplate(id) {
  userTemplates = userTemplates.filter(t => t.id !== id);
  notifyListeners();
}

export function setUserTemplates(templates) {
  userTemplates = templates.filter(t => t.is_user).map(t => ({ ...t }));
  notifyListeners();
}

export function matchTemplate(clientInfo, templates) {
  const all = templates || getAllTemplates();
  if (!clientInfo) return all.find(t => t.is_default) || all[0] || null;

  const name = (clientInfo.nom || clientInfo.client_match || '').toUpperCase().trim();
  const sector = (clientInfo.secteur || '').toUpperCase().trim();
  const regime = (clientInfo.regime || '').toUpperCase().trim();

  let best = null;
  let bestScore = -1;

  for (const t of all) {
    let score = 0;

    if (t.client_match) {
      const patterns = t.client_match.split('|').map(p => p.trim().toUpperCase());
      for (const pat of patterns) {
        if (name.includes(pat)) score += 10;
        else if (sector.includes(pat)) score += 5;
      }
    }

    if (t.sector && sector === t.sector.toUpperCase().trim()) score += 3;
    if (t.regime && regime === t.regime.toUpperCase().trim()) score += 2;

    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }

  if (best && bestScore > 0) return best;
  return all.find(t => t.is_default) || all[0] || null;
}

const AUTO_FORMULAS = {
  mensuelle: [
    {
      id: 'tfp_from_salaires',
      label: 'TFP (1% masse salariale)',
      description: 'Calcule TFP = salaires_bruts × 1%',
      condition: (values, template) => {
        const tfpRate = template?.config?.mensuelle?.tfp_rate;
        return tfpRate !== undefined && tfpRate !== 0;
      },
      compute: (values, template) => {
        const section = values.tfp || {};
        const salaires = parseFloat(section.salaires_bruts) || 0;
        const rate = template?.config?.mensuelle?.tfp_rate || 0.01;
        return { field: 'tfp.montant_tfp', value: round(salaires * rate, 3) };
      },
    },
    {
      id: 'tcl_from_tva',
      label: 'TCL (10% TVA nette)',
      description: 'Calcule TCL = TVA_due × 10%',
      condition: (values, template) => {
        const tclRate = template?.config?.mensuelle?.tcl_rate;
        return tclRate !== undefined;
      },
      compute: (values, template) => {
        const tva = values.tva || {};
        const tvaDue = (parseFloat(tva.tva_collectee) || 0) - (parseFloat(tva.tva_deductible) || 0);
        const rate = template?.config?.mensuelle?.tcl_rate || 0.10;
        return { field: 'tcl.montant_tcl', value: round(Math.max(0, tvaDue * rate), 3) };
      },
    },
    {
      id: 'total_retenues',
      label: 'Total retenues à la source',
      description: 'Somme des lignes 1 à 31',
      condition: () => true,
      compute: (values) => {
        const rs = values.retenues_source || {};
        let total = 0;
        for (let i = 1; i <= 31; i++) {
          total += parseFloat(rs['ligne_' + i]) || 0;
        }
        return { field: 'retenues_source.total', value: round(total, 3) };
      },
    },
    {
      id: 'total_autres_taxes',
      label: 'Total autres taxes',
      description: 'Somme des 19 postes',
      condition: () => true,
      compute: (values) => {
        const at = values.autres_taxes || {};
        let total = 0;
        for (let i = 1; i <= 19; i++) {
          total += parseFloat(at['poste_' + i]) || 0;
        }
        return { field: 'autres_taxes.total', value: round(total, 3) };
      },
    },
  ],
  is: [
    {
      id: 'is_calculated',
      label: 'IS calculé',
      description: 'IS = résultat fiscal × taux',
      condition: () => true,
      compute: (values, template) => {
        const calc = values.calcul_is || {};
        const resultat = parseFloat(calc.resultat_fiscal) || 0;
        const rate = template?.config?.is?.is_rate || 0.20;
        const isBrut = round(resultat * rate, 3);
        const isMin = round(Math.max(resultat, 0) * (template?.config?.is?.taux_minimum || 0.002), 3);
        const seuil = template?.config?.is?.seuil_minimum || 500;
        const isFinal = Math.max(isBrut, isMin, seuil);
        return { field: 'calcul_is.is_du', value: round(isFinal, 3) };
      },
    },
  ],
  irpp: [
    {
      id: 'revenu_net_irpp',
      label: 'Revenu net imposable',
      description: 'Somme des revenus nets par catégorie - déficits',
      condition: () => true,
      compute: (values) => {
        const bic = values.bic || {};
        const bnc = values.bnc || {};
        const agriculture = values.agriculture || {};
        const fonciers = values.fonciers || {};
        const salaires = values.salaires || {};
        const deficits = values.deficits || {};
        const deductions = values.deductions || {};

        const bicNet = (parseFloat(bic.ca_bic) || 0) - (parseFloat(bic.frais_bic) || 0);
        const bncNet = (parseFloat(bnc.ca_bnc) || 0) - (parseFloat(bnc.frais_bnc) || 0);
        const agricoleNet = parseFloat(agriculture.ca_agricole) || 0;
        const fonciersNet = (parseFloat(fonciers.loyers_bruts) || 0) - (parseFloat(fonciers.frais_gestion) || 0);
        const salairesNet = (parseFloat(salaires.salaire_brut_annuel) || 0) - (parseFloat(salaires.cnss_salariale) || 0);
        const deficitsReport = parseFloat(deficits.deficits_reportables) || 0;
        const deductionsTot = (parseFloat(deductions.interets_epargne) || 0) + (parseFloat(deductions.interets_obligations) || 0) + (parseFloat(deductions.assurance_vie) || 0);

        const brut = Math.max(0, bicNet) + Math.max(0, bncNet) + Math.max(0, agricoleNet) + Math.max(0, fonciersNet) + Math.max(0, salairesNet);
        const net = Math.max(0, brut - deficitsReport - deductionsTot);
        return { field: 'calcul_irpp.revenu_net', value: round(net, 3) };
      },
    },
    {
      id: 'irpp_bareme',
      label: 'IRPP brut (barème progressif)',
      description: 'Application du barème progressif 2025',
      condition: (values) => {
        const calc = values.calcul_irpp || {};
        return parseFloat(calc.revenu_net) > 0;
      },
      compute: (values, template) => {
        const calc = values.calcul_irpp || {};
        const revenu = parseFloat(calc.revenu_net) || 0;
        const config = template?.config?.irpp || {};
        const bareme = config.bareme || [
          { min: 0, max: 5000, taux: 0 },
          { min: 5001, max: 10000, taux: 15 },
          { min: 10001, max: 20000, taux: 25 },
          { min: 20001, max: 30000, taux: 30 },
          { min: 30001, max: 40000, taux: 33 },
          { min: 40001, max: 50000, taux: 36 },
          { min: 50001, max: 70000, taux: 38 },
          { min: 70001, max: Infinity, taux: 40 },
        ];
        let impot = 0;
        for (const b of bareme) {
          if (revenu > b.min) {
            const base = Math.min(revenu, b.max) - b.min;
            impot += Math.max(0, base) * b.taux / 100;
          }
          if (revenu <= b.max) break;
        }
        return { field: 'calcul_irpp.irpp_brut', value: round(impot, 3) };
      },
    },
    {
      id: 'contribution_solidaire_irpp',
      label: 'Contribution sociale solidaire (0.5%)',
      description: 'CSS = IRPP brut × 0.5% si revenu net > 5000 DT',
      condition: (values) => {
        const calc = values.calcul_irpp || {};
        const revenu = parseFloat(calc.revenu_net) || 0;
        return revenu > 5000;
      },
      compute: (values) => {
        const calc = values.calcul_irpp || {};
        const impot = parseFloat(calc.irpp_brut) || 0;
        return { field: 'calcul_irpp.css', value: round(impot * 0.005, 3) };
      },
    },
    {
      id: 'total_irpp_a_payer',
      label: 'Total IRPP à payer',
      description: 'IRPP brut + CSS',
      condition: (values) => {
        const calc = values.calcul_irpp || {};
        return (parseFloat(calc.irpp_brut) || 0) > 0;
      },
      compute: (values) => {
        const calc = values.calcul_irpp || {};
        const impot = parseFloat(calc.irpp_brut) || 0;
        const css = parseFloat(calc.css) || 0;
        return { field: 'calcul_irpp.total_a_payer', value: round(impot + css, 3) };
      },
    },
  ],
  employeur: [
    {
      id: 'tfp_employeur',
      label: 'TFP (1% masse salariale)',
      description: 'TFP = masse salariale annuelle × 1%',
      condition: (values, template) => {
        const eff = values.effectif || {};
        return parseFloat(eff.masse_salariale_annuelle) > 0;
      },
      compute: (values, template) => {
        const eff = values.effectif || {};
        const masse = parseFloat(eff.masse_salariale_annuelle) || 0;
        const rate = template?.config?.employeur?.tfp_rate || 0.01;
        return { field: 'effectif.tfp_calcule', value: round(masse * rate, 3) };
      },
    },
    {
      id: 'total_employeur',
      label: 'Total déclaration employeur',
      description: 'Masse salariale + TFP',
      condition: (values) => {
        const eff = values.effectif || {};
        return parseFloat(eff.masse_salariale_annuelle) > 0;
      },
      compute: (values) => {
        const eff = values.effectif || {};
        const masse = parseFloat(eff.masse_salariale_annuelle) || 0;
        const tfp = parseFloat(eff.tfp_calcule) || 0;
        return { field: 'recap_employeur.total_employeur', value: round(masse + tfp, 3) };
      },
    },
  ],
  plusvalue: [
    {
      id: 'plus_value_brute',
      label: 'Plus-value brute',
      description: 'Prix cession - Prix acquisition',
      condition: (values) => {
        const c = values.cessions || {};
        return (parseFloat(c.prix_cession) || 0) > 0;
      },
      compute: (values) => {
        const c = values.cessions || {};
        const cession = parseFloat(c.prix_cession) || 0;
        const acquisition = parseFloat(c.prix_acquisition) || 0;
        const pv = Math.max(0, cession - acquisition);
        return { field: 'calcul_plusvalue.plus_value_brute', value: round(pv, 3) };
      },
    },
    {
      id: 'taxe_plusvalue',
      label: 'Taxe sur plus-value (5%)',
      description: 'Plus-value × 5% (taux général)',
      condition: (values) => {
        const calc = values.calcul_plusvalue || {};
        return (parseFloat(calc.plus_value_brute) || 0) > 0;
      },
      compute: (values, template) => {
        const calc = values.calcul_plusvalue || {};
        const pv = parseFloat(calc.plus_value_brute) || 0;
        const rate = template?.config?.plusvalue?.taux || 0.05;
        return { field: 'calcul_plusvalue.taxe_due', value: round(pv * rate, 3) };
      },
    },
  ],
  fortune: [
    {
      id: 'actif_net_fortune',
      label: 'Actif net imposable',
      description: 'Total actifs - Total passifs',
      condition: (values) => {
        const a = values.actifs || {};
        return (parseFloat(a.valeur_immobiliere) || 0) > 0;
      },
      compute: (values) => {
        const a = values.actifs || {};
        const p = values.passifs || {};
        const immobilier = parseFloat(a.valeur_immobiliere) || 0;
        const mobilier = parseFloat(a.valeur_mobiliere) || 0;
        const autres = parseFloat(a.autres_actifs) || 0;
        const dettes = parseFloat(p.dettes_total) || 0;
        const actifNet = Math.max(0, immobilier + mobilier + autres - dettes);
        return { field: 'calcul_fortune.actif_net', value: round(actifNet, 3) };
      },
    },
    {
      id: 'impot_fortune',
      label: 'Impôt sur la fortune',
      description: 'Barème progressif 0.5% - 2%',
      condition: (values) => {
        const calc = values.calcul_fortune || {};
        return (parseFloat(calc.actif_net) || 0) > 0;
      },
      compute: (values, template) => {
        const calc = values.calcul_fortune || {};
        const actifNet = parseFloat(calc.actif_net) || 0;
        const config = template?.config?.fortune || {};
        const bareme = config.bareme || [
          { min: 0, max: 1000000, taux: 0.005 },
          { min: 1000001, max: 2000000, taux: 0.01 },
          { min: 2000001, max: 5000000, taux: 0.015 },
          { min: 5000001, max: Infinity, taux: 0.02 },
        ];
        let impot = 0;
        for (const b of bareme) {
          if (actifNet > b.min) {
            const base = Math.min(actifNet, b.max) - b.min;
            impot += Math.max(0, base) * b.taux;
          }
          if (actifNet <= b.max) break;
        }
        return { field: 'calcul_fortune.impot_due', value: round(impot, 3) };
      },
    },
  ],
};

export function getAutoFormulas(formId) {
  return AUTO_FORMULAS[formId] || [];
}

export function autoCalculate(formId, currentValues, template) {
  const formulas = getAutoFormulas(formId);
  const updates = [];

  for (const f of formulas) {
    try {
      if (f.condition(currentValues, template)) {
        const result = f.compute(currentValues, template);
        updates.push({ formulaId: f.id, label: f.label, field: result.field, value: result.value });
      }
    } catch (e) {
      console.warn('[FormulaEngine] Error in', f.id, e.message);
    }
  }

  return updates;
}

export function applyCalculations(formId, currentValues, template) {
  const newVals = { ...currentValues };
  const updates = autoCalculate(formId, currentValues, template);

  for (const u of updates) {
    const parts = u.field.split('.');
    if (parts.length === 2) {
      if (!newVals[parts[0]]) newVals[parts[0]] = {};
      newVals[parts[0]][parts[1]] = u.value;
    } else {
      newVals[u.field] = u.value;
    }
  }

  return { values: newVals, calculations: updates };
}

const BALANCE_RULES = {
  mensuelle: [
    {
      id: 'balance_tva',
      label: 'Équilibre TVA',
      check: (data) => {
        const tva = data?.sections?.tva || {};
        const collectee = parseFloat(tva.tva_collectee) || 0;
        const deductible = parseFloat(tva.tva_deductible) || 0;
        const due = parseFloat(tva.tva_due) || 0;
        const expected = round(collectee - deductible, 3);
        const diff = round(Math.abs(expected - due), 3);
        if (diff > 0.001) {
          return { valid: false, field: 'tva.tva_due', message: `TVA due: ${due} ≠ collectée(${collectee}) - déductible(${deductible}) = ${expected} (écart ${diff})` };
        }
        return { valid: true };
      },
    },
    {
      id: 'total_retenues_vs_sum',
      label: 'Total retenues = somme des lignes',
      check: (data) => {
        const rs = data?.sections?.retenues_source || {};
        const declared = parseFloat(rs.total) || 0;
        let sum = 0;
        for (let i = 1; i <= 31; i++) {
          sum += parseFloat(rs['ligne_' + i]) || 0;
        }
        sum = round(sum, 3);
        if (declared > 0 && Math.abs(declared - sum) > 0.001) {
          return { valid: false, field: 'retenues_source.total', message: `Total déclaré ${declared} ≠ somme des lignes ${sum}` };
        }
        return { valid: true };
      },
    },
    {
      id: 'mf_required',
      label: 'Matricule fiscal requis',
      check: (data) => {
        if (!data?.matriculeFiscal || data.matriculeFiscal.trim().length < 10) {
          return { valid: false, field: 'matriculeFiscal', message: 'Matricule fiscal requis (13 caractères)' };
        }
        return { valid: true };
      },
    },
  ],
  irpp: [
    {
      id: 'revenu_net_positif',
      label: 'Revenu net imposable > 0',
      check: (data) => {
        const calc = data?.sections?.calcul_irpp || {};
        const revenu = parseFloat(calc.revenu_net) || 0;
        if (revenu <= 0) {
          return { valid: false, field: 'calcul_irpp.revenu_net', message: 'Le revenu net imposable doit être positif' };
        }
        return { valid: true };
      },
    },
    {
      id: 'mf_required_irpp',
      label: 'Matricule fiscal requis',
      check: (data) => {
        if (!data?.matriculeFiscal || data.matriculeFiscal.trim().length < 10) {
          return { valid: false, field: 'matriculeFiscal', message: 'Matricule fiscal requis' };
        }
        return { valid: true };
      },
    },
  ],
  employeur: [
    {
      id: 'masse_salariale_required',
      label: 'Masse salariale requise',
      check: (data) => {
        const eff = data?.sections?.effectif || {};
        const masse = parseFloat(eff.masse_salariale_annuelle) || 0;
        if (masse <= 0) {
          return { valid: false, field: 'effectif.masse_salariale_annuelle', message: 'Masse salariale annuelle requise' };
        }
        return { valid: true };
      },
    },
    {
      id: 'mf_required_employeur',
      label: 'Matricule fiscal requis',
      check: (data) => {
        if (!data?.matriculeFiscal || data.matriculeFiscal.trim().length < 10) {
          return { valid: false, field: 'matriculeFiscal', message: 'Matricule fiscal requis' };
        }
        return { valid: true };
      },
    },
  ],
  plusvalue: [
    {
      id: 'prix_cession_sup_acquisition',
      label: 'Prix cession > prix acquisition',
      check: (data) => {
        const c = data?.sections?.cessions || {};
        const cession = parseFloat(c.prix_cession) || 0;
        const acquisition = parseFloat(c.prix_acquisition) || 0;
        if (cession <= acquisition) {
          return { valid: false, field: 'cessions.prix_cession', message: 'Le prix de cession doit être supérieur au prix d\'acquisition' };
        }
        return { valid: true };
      },
    },
  ],
  fortune: [
    {
      id: 'actif_net_positif',
      label: 'Actif net imposable > 0',
      check: (data) => {
        const calc = data?.sections?.calcul_fortune || {};
        const actifNet = parseFloat(calc.actif_net) || 0;
        if (actifNet <= 0) {
          return { valid: false, field: 'calcul_fortune.actif_net', message: 'L\'actif net imposable doit être positif' };
        }
        return { valid: true };
      },
    },
  ],
};

export function getValidationRules(formId) {
  return BALANCE_RULES[formId] || [];
}

export function validateDeclaration(data, formId) {
  const rules = getValidationRules(formId);
  const errors = [];

  for (const r of rules) {
    try {
      const result = r.check(data);
      if (!result.valid) {
        errors.push({ ruleId: r.id, label: r.label, field: result.field, message: result.message });
      }
    } catch (e) {
      errors.push({ ruleId: r.id, label: r.label, field: '', message: e.message });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    totalSections: Object.keys(data?.sections || {}).length,
    totalAmount: computeTotalAmount(data),
  };
}

function computeTotalAmount(data) {
  const sections = data?.sections || {};
  let total = 0;
  for (const id of Object.keys(sections)) {
    const vals = sections[id] || {};
    for (const k of Object.keys(vals)) {
      if (!k.startsWith('_')) total += parseFloat(vals[k]) || 0;
    }
  }
  return round(total, 3);
}

export function rsBaseFromAmount(amount, lineNum) {
  const RS_RATES = {
    2: 0.20, 4: 0.10, '4b': 0.15, 5: 0.10, 6: 0.03, 7: 0.05, 8: 0.05,
    9: 0.10, 10: 0.20, 11: 0.20, 12: 0.10, 13: 0.20, 14: 0.15, 15: 0.10,
    16: 0.025, 17: 0.01, 18: 0.25, 19: 1.00, 22: 0.01, 23: 0.05, 30: 0.05, 31: 0.03,
  };

  const num = String(lineNum);
  const rate = RS_RATES[num];
  if (rate && rate > 0) {
    return round(parseFloat(amount) / rate, 3);
  }
  return parseFloat(amount) || 0;
}

function round(val, decimals) {
  const f = Math.pow(10, decimals);
  return Math.round(val * f) / f;
}
