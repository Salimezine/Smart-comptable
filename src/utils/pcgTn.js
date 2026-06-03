/**
 * pcgTn.js — Classification PCG Tunisien (Bilan / Résultat)
 *
 * Chaque compte est classé dans l'une des sections des états financiers :
 *   BILAN → ACTIF_NC, ACTIF_C, PASSIF_NC, PASSIF_C, CAPITAUX
 *   RÉSULTAT → CHARGE, PRODUIT
 */

// ─────────────────────────────────────────────
// Classification par préfixe de compte
// ─────────────────────────────────────────────
const CLASSIFICATION = [
  // Classe 1 — Capitaux
  { prefix: '11', section: 'CAPITAUX',     line: 'capital' },
  { prefix: '12', section: 'CAPITAUX',     line: 'reserves' },
  { prefix: '13', section: 'CAPITAUX',     line: 'subventions' },
  { prefix: '14', section: 'CAPITAUX',     line: 'provisions_reglementees' },
  { prefix: '15', section: 'PASSIF_NC',    line: 'provisions_risques' },
  { prefix: '16', section: 'PASSIF_NC',    line: 'emprunts' },
  { prefix: '17', section: 'PASSIF_NC',    line: 'dettes_credit_bail' },

  // Classe 2 — Actifs Non Courants
  { prefix: '20', section: 'ACTIF_NC',     line: 'immobilisations_incorporelles' },
  { prefix: '21', section: 'ACTIF_NC',     line: 'immobilisations_corporelles' },
  { prefix: '22', section: 'ACTIF_NC',     line: 'immobilisations_corporelles' },
  { prefix: '23', section: 'ACTIF_NC',     line: 'immobilisations_en_cours' },
  { prefix: '24', section: 'ACTIF_NC',     line: 'immobilisations_corporelles' },
  { prefix: '25', section: 'ACTIF_NC',     line: 'immobilisations_corporelles' },
  { prefix: '27', section: 'ACTIF_NC',     line: 'immobilisations_financieres' },
  { prefix: '28', section: 'ACTIF_NC',     line: 'amortissements' },
  { prefix: '29', section: 'ACTIF_NC',     line: 'provisions_depreciation' },

  // Classe 3 — Stocks
  { prefix: '3',  section: 'ACTIF_C',      line: 'stocks' },

  // Classe 4 — Tiers
  { prefix: '409', section: 'ACTIF_C',     line: 'fournisseurs_debiteurs' },
  { prefix: '41',  section: 'ACTIF_C',     line: 'clients' },
  { prefix: '42',  section: 'ACTIF_C',     line: 'personnel_avances' },
  { prefix: '43',  section: 'ACTIF_C',     line: 'etat_tva_deductible' },
  { prefix: '47',  section: 'ACTIF_C',     line: 'regularisation_actif' },
  { prefix: '40',  section: 'PASSIF_C',    line: 'fournisseurs' },
  { prefix: '419', section: 'PASSIF_C',    line: 'clients_crediteurs' },
  { prefix: '44',  section: 'PASSIF_C',    line: 'etat_is' },
  { prefix: '45',  section: 'PASSIF_C',    line: 'personnel_dettes' },
  { prefix: '46',  section: 'PASSIF_C',    line: 'associes' },
  { prefix: '48',  section: 'PASSIF_C',    line: 'regularisation_passif' },
  { prefix: '49',  section: 'PASSIF_C',    line: 'provisions_tiers' },

  // Classe 5 — Trésorerie
  { prefix: '5',   section: 'ACTIF_C',     line: 'tresorerie' },
  { prefix: '52',  section: 'PASSIF_C',    line: 'concours_bancaires' },

  // Classe 6 — Charges
  { prefix: '60',  section: 'CHARGE',      line: 'achats' },
  { prefix: '61',  section: 'CHARGE',      line: 'charges_externes' },
  { prefix: '62',  section: 'CHARGE',      line: 'charges_personnel' },
  { prefix: '63',  section: 'CHARGE',      line: 'impots_taxes' },
  { prefix: '64',  section: 'CHARGE',      line: 'charges_personnel' },
  { prefix: '65',  section: 'CHARGE',      line: 'autres_charges' },
  { prefix: '66',  section: 'CHARGE',      line: 'charges_financieres' },
  { prefix: '67',  section: 'CHARGE',      line: 'charges_exceptionnelles' },
  { prefix: '68',  section: 'CHARGE',      line: 'dotations' },
  { prefix: '69',  section: 'CHARGE',      line: 'participation' },

  // Classe 7 — Produits
  { prefix: '70',  section: 'PRODUIT',     line: 'ventes' },
  { prefix: '71',  section: 'PRODUIT',     line: 'production_stockee' },
  { prefix: '72',  section: 'PRODUIT',     line: 'production_immobilisee' },
  { prefix: '73',  section: 'PRODUIT',     line: 'subventions_exploitation' },
  { prefix: '74',  section: 'PRODUIT',     line: 'autres_produits' },
  { prefix: '75',  section: 'PRODUIT',     line: 'produits_financiers' },
  { prefix: '76',  section: 'PRODUIT',     line: 'produits_exceptionnels' },
  { prefix: '77',  section: 'PRODUIT',     line: 'reprises' },
];

// Tri du plus spécifique au plus général
CLASSIFICATION.sort((a, b) => b.prefix.length - a.prefix.length);

/**
 * Retourne la classification complète d'un numéro de compte PCG.
 * @param {string} compte - Numéro de compte (ex: "401001", "607000")
 * @returns {{ section: string, line: string }|null}
 */
export function getPCGClass(compte) {
  if (!compte || typeof compte !== 'string') return null;
  const num = compte.replace(/\s.*$/, '').trim(); // "401001 Fournisseurs" → "401001"
  for (const c of CLASSIFICATION) {
    if (num.startsWith(c.prefix)) return { section: c.section, line: c.line };
  }
  return null;
}

/**
 * Regroupe les écritures du journal par compte et calcule le solde net.
 * @param {Array} journal - Écritures du journal
 * @returns {Object} Map { compte: { debitTotal, creditTotal, solde } }
 */
export function computeBalances(journal) {
  const balances = {};

  for (const entry of journal) {
    const compte = (entry.compte || '').replace(/\s.*$/, '').trim();
    const debit = parseFloat(entry.debit) || 0;
    const credit = parseFloat(entry.credit) || 0;

    if (!compte) continue;

    if (!balances[compte]) balances[compte] = { compte, debitTotal: 0, creditTotal: 0, solde: 0 };
    balances[compte].debitTotal += debit;
    balances[compte].creditTotal += credit;
    balances[compte].solde = balances[compte].debitTotal - balances[compte].creditTotal;
  }

  return balances;
}

/**
 * Agrège les soldes des comptes par section du Bilan/Résultat.
 * @param {Object} balances - Résultat de computeBalances
 * @returns {Object}
 */
export function aggregateBySection(balances) {
  const sections = {};

  for (const [compte, data] of Object.entries(balances)) {
    const cls = getPCGClass(compte);
    if (!cls) continue;

    const key = cls.section;
    if (!sections[key]) sections[key] = {};
    if (!sections[key][cls.line]) sections[key][cls.line] = 0;

    // Pour le Bilan, on prend le solde débiteur ou créditeur selon la section
    if (['ACTIF_NC', 'ACTIF_C'].includes(key)) {
      sections[key][cls.line] += Math.max(data.solde, 0);
    } else if (['PASSIF_NC', 'PASSIF_C', 'CAPITAUX'].includes(key)) {
      sections[key][cls.line] += Math.max(-data.solde, 0);
    } else if (key === 'CHARGE') {
      sections[key][cls.line] += data.debitTotal;
    } else if (key === 'PRODUIT') {
      sections[key][cls.line] += data.creditTotal;
    }
  }

  return sections;
}

/**
 * Construit la balance générale (liste de tous les comptes avec leurs soldes).
 * @param {Object} balances - Résultat de computeBalances
 * @returns {Array}
 */
export function buildBalanceGenerale(balances) {
  return Object.values(balances)
    .map(b => ({
      compte: b.compte,
      debitTotal: parseFloat(b.debitTotal.toFixed(3)),
      creditTotal: parseFloat(b.creditTotal.toFixed(3)),
      soldeDebiteur: b.solde > 0.001 ? parseFloat(b.solde.toFixed(3)) : 0,
      soldeCrediteur: b.solde < -0.001 ? parseFloat((-b.solde).toFixed(3)) : 0,
    }))
    .sort((a, b) => a.compte.localeCompare(b.compte));
}
