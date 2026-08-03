// Plan de comptes SCE (Système Comptable des Entreprises) - Tunisie
// Nomenclature officielle des classes 1 à 7 (et 8/9 pour les comptes de résultat étendus).
// Utilisé pour la validation des balances et la classification des postes.

// Classes autorisées (premier chiffre du compte)
export const SCE_CLASSES = {
  '1': 'Capitaux propres et passifs non courants',
  '2': 'Actifs non courants',
  '3': 'Stocks',
  '4': 'Comptes de tiers',
  '5': 'Comptes financiers (trésorerie)',
  '6': 'Comptes de charges',
  '7': 'Comptes de produits',
};

// Préfixes de 2 chiffres valides (sous-classes SCE). Un compte doit commencer par l'un d'eux
// (ou par un préfixe de 3 chiffres contenu dans l'arborescence ci-dessous).
export const SCE_PREFIXES_2 = [
  '10', '11', '12', '13', '14', '15', '16', '17', '18',
  '20', '21', '22', '23', '24', '25', '26', '27', '28', '29',
  '31', '32', '33', '34', '35', '37', '39',
  '40', '41', '42', '43', '44', '45', '46', '47', '48', '49',
  '50', '51', '52', '53', '54', '55', '58', '59',
  '60', '61', '62', '63', '64', '65', '66', '67', '68', '69',
  '70', '71', '72', '73', '74', '75', '77', '78', '79',
];

// Correspondance poste du bilan / RT pour chaque préfixe de classe
export const SCE_POSTE = {
  '1': 'Passif — Capitaux propres / Passifs non courants',
  '2': 'Actif — Actifs non courants',
  '3': 'Actif — Stocks',
  '4': 'Actif/Passif — Comptes de tiers (selon solde net)',
  '5': 'Actif/Passif — Trésorerie',
  '6': 'Compte de résultat — Charges',
  '7': 'Compte de résultat — Produits',
};

// Renvoie true si le compte appartient au plan SCE (classe 1-7, structure cohérente).
export function isCompteSCE(compte) {
  if (!compte || !/^\d{3,8}$/.test(compte)) return false;
  const cls = compte[0];
  if (!SCE_CLASSES[cls]) return false;
  const p2 = compte.slice(0, 2);
  if (SCE_PREFIXES_2.includes(p2)) return true;
  // Comptes de résultat 8/9 non standard SCE : on les accepte si présents (étendus)
  return false;
}

// Valide une liste de comptes de balance et renvoie les anomalies éventuelles.
// accounts: [{ compte, libelle, debitTotal, creditTotal }]
export function validateBalanceSCE(accounts) {
  const horsPlan = [];
  const malFormes = [];
  for (const a of accounts) {
    const compte = String(a.compte || '').replace(/\s.*$/, '').trim();
    if (!compte) { malFormes.push(a); continue; }
    if (!/^\d+$/.test(compte)) { malFormes.push(a); continue; }
    if (!isCompteSCE(compte)) {
      horsPlan.push({ compte, libelle: a.libelle || '', classe: compte[0] });
    }
  }
  return {
    valide: horsPlan.length === 0 && malFormes.length === 0,
    horsPlan,
    malFormes,
    total: accounts.length,
  };
}
