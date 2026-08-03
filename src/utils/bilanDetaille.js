// Construction d'un bilan SCE DÉTAILLÉ selon le MODÈLE DE RÉFÉRENCE du PCGA tunisien
// (Chapitre 5 — Plan de regroupement de référence, pages 10-11).
// Les listes de comptes et la répartition Actif/Passif par solde net reproduisent
// EXACTEMENT la classification du moteur (balanceToReports.js) afin que les totaux
// du bilan détaillé coïncident toujours avec le bilan synthétique.

const LIB = {
  '10': 'Capital social', '11': 'Réserves', '12': 'Résultats reportés', '13': 'Résultat de l\'exercice', '14': 'Autres capitaux propres',
  '15': 'Provisions', '16': 'Emprunts', '17': 'Comptes de liaison', '18': 'Autres passifs non courants',
  '20': 'Frais préliminaires', '21': 'Immobilisations incorporelles', '22': 'Immobilisations corporelles',
  '23': 'Immobilisations en cours', '24': 'Immobilisations à statut particulier', '25': 'Participations & créances rattachées',
  '26': 'Autres immobilisations financières', '27': 'Autres actifs non courants', '28': 'Amortissements des immobilisations',
  '29': 'Provisions pour dépréciation des actifs immobilisés',
  '31': 'Matières premières & fournitures', '32': 'Autres approvisionnements', '33': 'En-cours de production de biens',
  '34': 'En-cours de production de services', '35': 'Stocks de produits', '37': 'Stocks de marchandises', '39': 'Provisions pour dépréciation des stocks',
  '40': 'Fournisseurs & comptes rattachés', '41': 'Clients & comptes rattachés', '42': 'Personnel & comptes rattachés',
  '43': 'État & collectivités publiques', '44': 'Sociétés du groupe & associés', '45': 'Débiteurs & créditeurs divers',
  '46': 'Comptes transitoires', '47': 'Comptes de régularisation', '48': 'Provisions courantes', '49': 'Provisions pour dépréciation des tiers',
  '50': 'Emprunts et dettes financières courants', '51': 'Prêts et créances financières courants', '52': 'Placements courants',
  '53': 'Banques, établissements financiers', '54': 'Caisse', '55': 'Régies d\'avances & accréditifs', '58': 'Virements internes',
  '59': 'Provisions pour dépréciation des comptes financiers',
  '505': 'Avances reçues sur emprunts',
};

// Chaque compte (code complet) est classé selon son solde NET, à la manière exacte
// du moteur (balanceToReports.js) : les débiteurs vont à l'actif, les créditeurs au
// passif, SANS compenser deux comptes d'un même préfixe entre eux.
function prefix2(c) { return c.length >= 2 ? c.slice(0, 2) : c; }

function netOf(accounts, prefixes) {
  const rows = [];
  for (const a of accounts) {
    const c = String(a.compte || '').replace(/\s.*$/, '').trim();
    if (!/^\d+$/.test(c)) continue;
    const p2 = prefix2(c);
    // Un préfixe correspond si le compte commence par ce préfixe (2 ou 3 chiffres)
    const hit = prefixes.find(p => c.startsWith(p));
    if (!hit) continue;
    const net = (a.debitTotal || 0) - (a.creditTotal || 0);
    rows.push({ prefixe: p2, matched: hit, code: c, label: LIB[p2] || p2, net });
  }
  return rows;
}

// Ventilation Actif (solde débiteur) / Passif (solde créditeur) par compte, comme splitTiers().
function splitTiers(accounts, prefixes) {
  const rows = netOf(accounts, prefixes);
  const actif = [], passif = [];
  for (const r of rows) {
    if (r.net > 0.001) actif.push({ prefixe: r.prefixe, matched: r.matched, code: r.code, label: r.label + ' (créances)', montant: r.net });
    else if (r.net < -0.001) passif.push({ prefixe: r.prefixe, matched: r.matched, code: r.code, label: r.label + ' (dettes)', montant: -r.net });
  }
  return { actif, passif };
}

// Comptes d'une classe dont le solde net est du signe demandé (débiteur -> actif, créditeur -> passif)
function signed(accounts, prefixes, sign) {
  return netOf(accounts, prefixes)
    .filter(r => sign > 0 ? r.net > 0.001 : r.net < -0.001)
    .map(r => ({ prefixe: r.prefixe, matched: r.matched, code: r.code, label: r.label, montant: sign > 0 ? r.net : -r.net }));
}

function sumMontant(arr) { return (arr || []).reduce((s, x) => s + x.montant, 0); }

export function buildBilanDetaille(accounts, bilan) {
  if (!accounts || !accounts.length) return null;

  // --- ACTIF NON COURANT : ACTIFS IMMOBILISÉS ---
  // Montants BRUTS (débiteurs) pour les immos, puis déductions (amort/provisions) en négatif.
  const incorpBrut = signed(accounts, ['20', '21', '23', '24'], 1);
  const corpBrut = signed(accounts, ['22'], 1);
  const finBrut = signed(accounts, ['25', '26'], 1);
  const autresANCBrut = signed(accounts, ['27'], 1);
  const ancBrut = sumMontant(incorpBrut) + sumMontant(corpBrut) + sumMontant(finBrut) + sumMontant(autresANCBrut);
  const amort = signed(accounts, ['28'], -1).map(x => ({ ...x, label: '− ' + x.label, montant: -x.montant }));
  const provANC = signed(accounts, ['29'], -1).map(x => ({ ...x, label: '− ' + x.label, montant: -x.montant }));
  const actifNC = {
    incorp: incorpBrut, corp: corpBrut, fin: finBrut, autresANC: autresANCBrut, amort, provANC,
    total: Math.max(0, ancBrut + sumMontant(amort) + sumMontant(provANC)),
  };

  // --- ACTIF COURANT ---
  const stocks = signed(accounts, ['31', '32', '33', '34', '35', '37'], 1)
    .concat(signed(accounts, ['39'], -1).map(x => ({ ...x, label: '− ' + x.label })));

  const clientsSplit = splitTiers(accounts, ['41']);
  const clients = clientsSplit.actif;
  const provisionsClients = signed(accounts, ['413', '419', '491'], 1).map(x => ({ ...x, label: '− ' + x.label }));

  const etat = splitTiers(accounts, ['43']);
  const personnel = splitTiers(accounts, ['42']);
  const autresTiers = splitTiers(accounts, ['44', '45', '46', '47', '48', '49']);
  const fournisseurs = splitTiers(accounts, ['40']).passif;
  const avancesFournisseurs = splitTiers(accounts, ['40']).actif;

  // Trésorerie & finances courantes — conformément au plan de regroupement de référence
  // (CH5_PEF, p.10) : Placements et autres actifs financiers = 51, 52, 55, 59 (débiteurs) ;
  // Liquidités et équivalents = 53, 54 (débiteurs).
  const placements = signed(accounts, ['51', '52', '55', '59'], 1);
  const liquidites = signed(accounts, ['53', '54'], 1);
  const avancesEmprunts = signed(accounts, ['505'], 1);

  // Regroupement "Tiers — Actif" (clients + état + personnel + autres créances + avances fournisseurs)
  const tiersActif = [
    ...clients, ...provisionsClients,
    ...etat.actif, ...personnel.actif, ...autresTiers.actif, ...avancesFournisseurs,
  ];
  const autresActifsC = [...avancesEmprunts];

  // --- PASSIF ---
  // Capitaux propres : on utilise les montants DÉJÀ calculés et équilibrés par le moteur
  // (capital, réserves, résultats reportés, résultat de l'exercice) afin de garantir que le
  // bilan détaillé coïncide exactement avec le bilan synthétique. Le détail par compte est
  // ajouté en complément (sans double comptage).
  const cpCapital = signed(accounts, ['101'], -1).map(x => ({ ...x, label: 'Capital social' }));
  const cpReserves = signed(accounts, ['11'], -1).map(x => ({ ...x, label: 'Réserves' }));
  const cpRR = signed(accounts, ['12', '131', '135'], -1).map(x => ({ ...x, label: 'Résultats reportés' }));
  const cpAutres = signed(accounts, ['14'], -1).map(x => ({ ...x, label: 'Autres capitaux propres' }));
  // Lignes "totales" issues du moteur (garantissent la cohérence avec le bilan synthétique) :
  const cpMoteur = [];
  if (bilan) {
    if (bilan.capitalSocial) cpMoteur.push({ prefixe: '10', matched: '101', code: '101', label: 'Capital social', montant: bilan.capitalSocial });
    if (bilan.reserves) cpMoteur.push({ prefixe: '11', matched: '11', code: '11', label: 'Réserves', montant: bilan.reserves });
    if (bilan.resultatsReportes) cpMoteur.push({ prefixe: '12', matched: '12', code: '12', label: 'Résultats reportés', montant: bilan.resultatsReportes });
    if (bilan.resultatExercice) cpMoteur.push({ prefixe: '13', matched: '13', code: '13', label: 'Résultat net de l\'exercice', montant: bilan.resultatExercice });
    if (bilan.autresCapitauxPropres) cpMoteur.push({ prefixe: '14', matched: '14', code: '14', label: 'Autres capitaux propres', montant: bilan.autresCapitauxPropres });
  }
  const cp = cpMoteur.length ? cpMoteur : [...cpCapital, ...cpReserves, ...cpRR, ...cpAutres];

  const emprunts = signed(accounts, ['16'], -1);
  const autresPassifsFinNC = signed(accounts, ['17', '18'], -1);
  const provisionsNC = signed(accounts, ['15'], -1);
  const autresPassifsC = [
    ...etat.passif, ...personnel.passif, ...autresTiers.passif, ...clientsSplit.passif,
  ];
  // Concours bancaires = solde créditeur des comptes de trésorerie (50-55) + 505,
  // conformément au moteur (concoursBancaires = tresoreriePassif + creditNet('505')).
  const concours = signed(accounts, ['50', '51', '52', '53', '54', '55', '505'], -1);
  // Ligne de rééquilibrage calculée par le moteur (autresDettesCalc = résidu du passif).
  const autresDettesCalc = (bilan && bilan.autresDettes) ? [{ prefixe: '49', matched: '49', code: '49', label: 'Autres dettes (rééquilibrage)', montant: bilan.autresDettes }] : [];
  const autresPassifsCFinal = [...autresPassifsC, ...autresDettesCalc];

  return {
    actifNC,
    stocks,
    tiersActif,
    autresActifsC,
    placements,
    liquidites,
    cp,
    emprunts,
    autresPassifsFinNC,
    provisionsNC,
    fournisseurs,
    autresPassifsC: autresPassifsCFinal,
    concours,
  };
}
