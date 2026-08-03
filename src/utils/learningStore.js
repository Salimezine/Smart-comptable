// Système d'apprentissage : mémorise les reclassements de comptes corrigés
// manuellement par l'utilisateur, et les réapplique automatiquement aux
// prochains imports (le système "apprend de ses erreurs").
//
// Une règle = { fromPrefix, toPrefix, note, createdAt }
//   fromPrefix : préfixe de compte d'origine (ex: '765')
//   toPrefix   : préfixe SCE cible (ex: '75') — le compte est reclassé pour
//                qu'il tombe dans la bonne classe/poste.
// Les règles sont stockées en localStorage, par société (filename) ou globales.

const LS_KEY = 'sce_learned_rules_v1';

const SCE_CLASSES = {
  '1': 'Capitaux propres / Passifs NC',
  '2': 'Actifs non courants',
  '3': 'Stocks',
  '4': 'Comptes de tiers',
  '5': 'Trésorerie',
  '6': 'Charges (compte de résultat)',
  '7': 'Produits (compte de résultat)',
};

export function getClassLabel(prefix) {
  const c = String(prefix || '')[0];
  return SCE_CLASSES[c] || 'Autre';
}

export function loadRules() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveRules(rules) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(rules));
  } catch {
    /* ignore quota */
  }
}

export function addRule({ fromPrefix, toPrefix, note = '', scope = 'global' }) {
  const rules = loadRules();
  const fp = String(fromPrefix).trim();
  const tp = String(toPrefix).trim();
  if (!/^\d{1,8}$/.test(fp) || !/^\d{1,8}$/.test(tp)) return rules;
  // Évite les doublons (même fromPrefix + scope)
  const filtered = rules.filter(r => !(r.fromPrefix === fp && r.scope === scope));
  filtered.push({ fromPrefix: fp, toPrefix: tp, note, scope, createdAt: Date.now() });
  saveRules(filtered);
  return filtered;
}

export function removeRule(fromPrefix, scope = 'global') {
  const rules = loadRules().filter(r => !(r.fromPrefix === fromPrefix && r.scope === scope));
  saveRules(rules);
  return rules;
}

export function clearRules() {
  saveRules([]);
  return [];
}

// Applique les règles apprises à une liste de comptes.
// Renomme le compte pour qu'il tombe dans la classe cible (même longueur
// de préfixe), EX : 765000 -> 755000 (classe 7 = produits).
export function applyRules(accounts, scope = 'global') {
  const rules = loadRules().filter(r => r.scope === scope || r.scope === 'global');
  if (rules.length === 0) return accounts;
  return accounts.map(a => {
    const compte = String(a.compte || '');
    for (const r of rules) {
      if (compte.startsWith(r.fromPrefix)) {
        // Remplace le préfixe d'origine par le préfixe cible (même longueur).
        const len = r.fromPrefix.length;
        const tail = compte.slice(len);
        const newPrefix = r.toPrefix.slice(0, len).padEnd(len, '0');
        const newCompte = newPrefix + tail;
        if (newCompte !== compte) {
          return { ...a, compte: newCompte, reclassed: true, regle: r.fromPrefix + '→' + r.toPrefix };
        }
      }
    }
    return a;
  });
}
