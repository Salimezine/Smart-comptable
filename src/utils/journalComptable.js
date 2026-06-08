import { getJournalKey } from './journalKey';
import { logAction, AUDIT_ACTIONS } from './security/auditLog';
import { syncToCloud } from './syncManager';

export const CATEGORIE_TO_COMPTE = {
  'Télécoms & Internet': '626000',
  'Énergie & Utilités': '614000',
  'Matériel informatique': '602400',
  'Services & Honoraires': '622200',
  'Fournitures & Consommables': '602400',
  'Charges & Services': '611000',
  'Autres charges': '637000',
};

export const LIBELLES_COMPTES = {
  '401': 'Fournisseurs',
  '607000': 'Achats de marchandises',
  '601000': 'Achats de matières premières',
  '611000': 'Charges externes',
  '614000': 'Charges locatives et de copropriété',
  '626000': 'Frais postaux et frais de télécommunications',
  '602400': 'Fournitures de bureau et informatiques',
  '622200': 'Honoraires',
  '624000': 'Transports',
  '616000': "Primes d'assurances",
  '623000': 'Publicité, publications, relations publiques',
  '627000': 'Services bancaires et assimilés',
  '637000': 'Autres charges',
  '640000': 'Salaires',
  '43666': 'TVA sur autres biens et services',
  '43671': 'TVA collectée',
  '4368': 'Taxes à régulariser',
  '602000': 'Achats stockés - Autres approvisionnements',
  '6654': "Droits d'enregistrement et de timbre",
  '70XXXX': 'Ventes de produits',
};

function getTiersKey() {
  try {
    const id = localStorage.getItem('smart_comptable_current_id');
    return id ? `smart_comptes_tiers_${id}` : 'smart_comptes_tiers';
  } catch {
    return 'smart_comptes_tiers';
  }
}

function getCompteTiers(nom, prefixe) {
  try {
    if (!nom) return `${prefixe}001`;
    const tiersKey = getTiersKey();
    const raw = localStorage.getItem(tiersKey);
    const tiers = raw ? JSON.parse(raw) : {};
    const key = nom.trim().toLowerCase();
    if (tiers[key]) return tiers[key];
    const existing = Object.values(tiers).filter(v => v.startsWith(prefixe));
    const maxNum = existing.reduce((mx, v) => {
      const n = parseInt(v.slice(prefixe.length), 10);
      return n > mx ? n : mx;
    }, 0);
    const next = String(maxNum + 1).padStart(3, '0');
    tiers[key] = `${prefixe}${next}`;
    localStorage.setItem(tiersKey, JSON.stringify(tiers));
    return tiers[key];
  } catch {
    return `${prefixe}001`;
  }
}

function getCompteFournisseur(nom) {
  return getCompteTiers(nom, '401');
}

/**
 * Génère une pièce comptable SCE depuis le JSON corrigé par corrigerFacture.
 *
 * @param {object} corrige - Sortie de corrigerFacture()
 * @param {object} options
 * @param {'achat'|'vente'} [options.type='achat']
 * @param {string} [options.fournisseurNom] - surcharge nom fournisseur
 * @param {string} [options.datePiece] - surcharge date (YYYY-MM-DD)
 * @param {string} [options.mf] - surcharge matricule fiscal
 * @returns {object} piece comptable
 */
export function journalComptable(corrige, options = {}) {
  const type = options.type || 'achat';
  const fournisseurNom = options.fournisseurNom || corrige.fournisseur || 'Fournisseur';
  const mf = options.mf || corrige.matricule_fiscal || '';
  const datePiece = options.datePiece || (corrige.date
    ? corrige.date.split('/').reverse().join('-')
    : new Date().toISOString().slice(0, 10));
  const numeroPiece = corrige.numero_justificatif || `PC-${Date.now()}`;

  const ht = corrige.sous_total_ht || 0;
  const tva = corrige.montant_tva || 0;
  const timbre = corrige.timbre || 0;
  const fodec = corrige.fodec || 0;
  const ttc = corrige.total_ttc || 0;
  const rs = corrige.retenue_source || false;

  const cat = corrige.categorie || 'Autres charges';
  const compteCharge = CATEGORIE_TO_COMPTE[cat] || '611000';

  const ecritures = [];
  const compteFournisseur = getCompteFournisseur(fournisseurNom);

  if (type === 'achat') {
    // Débit charge HT
    ecritures.push({
      compte: compteCharge,
      libelleCompte: `${compteCharge} ${LIBELLES_COMPTES[compteCharge] || 'Charge'}`,
      libelle: `HT ${numeroPiece}`,
      debit: ht,
      credit: 0,
    });

    // Débit TVA déductible
    if (tva > 0.001) {
      ecritures.push({
        compte: '43666',
        libelleCompte: '43666 TVA sur autres biens et services',
        libelle: `TVA ${numeroPiece}`,
        debit: tva,
        credit: 0,
      });
    }

    // Débit timbre
    if (timbre > 0.001) {
      ecritures.push({
        compte: '6654',
        libelleCompte: "6654 Droits d'enregistrement et de timbre",
        libelle: `Timbre ${numeroPiece}`,
        debit: timbre,
        credit: 0,
      });
    }

    // Débit FODEC
    if (fodec > 0.001) {
      ecritures.push({
        compte: '602000',
        libelleCompte: '602000 FODEC',
        libelle: `FODEC ${numeroPiece}`,
        debit: fodec,
        credit: 0,
      });
    }

    // Crédit fournisseur = total TTC
    ecritures.push({
      compte: compteFournisseur,
      libelleCompte: `${compteFournisseur.slice(0, 3)} ${LIBELLES_COMPTES[compteFournisseur.slice(0, 3)] || 'Tiers'}`,
      libelle: `Facture ${numeroPiece} - ${fournisseurNom}`,
      debit: 0,
      credit: ttc,
    });

    // Retenue à la source : crédit fournisseur réduit, débit 43674
    if (rs && ttc > 0) {
      const rsMontant = corrige.rs_montant > 0
        ? corrige.rs_montant
        : parseFloat((ttc * (corrige.rs_taux || 1.5) / 100).toFixed(3));
      ecritures.push({
        compte: compteFournisseur,
        libelleCompte: `${compteFournisseur.slice(0, 3)} ${LIBELLES_COMPTES[compteFournisseur.slice(0, 3)] || 'Tiers'}`,
        libelle: `Ret. source ${numeroPiece}`,
        debit: rsMontant,
        credit: 0,
      });
      ecritures.push({
        compte: '43674',
        libelleCompte: '43674 Retenue à la source',
        libelle: `Ret. source ${numeroPiece}`,
        debit: 0,
        credit: rsMontant,
      });
    }
  } else {
    // VENTE
    const compteClient = getCompteTiers(fournisseurNom, '411');
    const clientMontant = rs && ttc > 0
      ? ttc - (corrige.rs_montant > 0 ? corrige.rs_montant : parseFloat((ttc * (corrige.rs_taux || 1.5) / 100).toFixed(3)))
      : ttc;
    ecritures.push({
      compte: compteClient,
      libelleCompte: `${compteClient.slice(0, 3)} ${LIBELLES_COMPTES[compteClient.slice(0, 3)] || 'Tiers'}`,
      libelle: `Facture ${numeroPiece} - ${fournisseurNom}`,
      debit: clientMontant > 0 ? parseFloat(clientMontant.toFixed(3)) : 0,
      credit: 0,
    });
    // RS sur vente : débit 43674 (RS à recevoir du client/état)
    if (rs && ttc > 0) {
      const rsMontant = corrige.rs_montant > 0
        ? corrige.rs_montant
        : parseFloat((ttc * (corrige.rs_taux || 1.5) / 100).toFixed(3));
      if (rsMontant > 0) {
        ecritures.push({
          compte: '43674',
          libelleCompte: '43674 Retenue à la source',
          libelle: `Ret. source ${numeroPiece}`,
          debit: parseFloat(rsMontant.toFixed(3)),
          credit: 0,
        });
      }
    }
    ecritures.push({
      compte: '70XXXX',
      libelleCompte: '70XXXX Ventes de produits',
      libelle: `HT ${numeroPiece}`,
      debit: 0,
      credit: ht,
    });
    if (tva > 0.001) {
      ecritures.push({
        compte: '43671',
        libelleCompte: '43671 TVA collectée',
        libelle: `TVA ${numeroPiece}`,
        debit: 0,
        credit: tva,
      });
    }
    if (timbre > 0.001) {
      ecritures.push({
        compte: '4368',
        libelleCompte: '4368 Taxes à régulariser',
        libelle: `Timbre ${numeroPiece}`,
        debit: 0,
        credit: timbre,
      });
    }
  }

  const debitTotal = ecritures.reduce((s, l) => s + l.debit, 0);
  const creditTotal = ecritures.reduce((s, l) => s + l.credit, 0);

  if (Math.abs(debitTotal - creditTotal) > 0.010) {
    return {
      id: numeroPiece,
      error: `Pièce déséquilibrée: Débit=${debitTotal.toFixed(3)} Crédit=${creditTotal.toFixed(3)}`,
      validated: false,
    };
  }

  return {
    id: numeroPiece,
    date: datePiece,
    journal: type === 'achat' ? 'ACH' : 'VNT',
    reference: numeroPiece,
    piece_justificative: corrige.numero_justificatif || '',
    ttnId: '',
    libelle: `${numeroPiece} — ${fournisseurNom}`,
    fournisseur: fournisseurNom,
    matricule_fiscal: mf,
    categorie: cat,
    sous_total_ht: ht,
    montant_tva: tva,
    timbre,
    fodec,
    total_ttc: ttc,
    retenue_source: rs,
    lignes: ecritures.map(e => ({
      ...e,
      debit: parseFloat(e.debit.toFixed(3)),
      credit: parseFloat(e.credit.toFixed(3)),
    })),
    totalDebit: parseFloat(debitTotal.toFixed(3)),
    totalCredit: parseFloat(creditTotal.toFixed(3)),
    validated: true,
  };
}

export function saveJournalPiece(piece, opts = {}) {
  try {
    if (!piece || !piece.validated) return false;
    const journalKey = getJournalKey();
    const companyId = localStorage.getItem('smart_comptable_current_id');

    let journal = [];
    try {
      const raw = localStorage.getItem(journalKey);
      if (raw) journal = JSON.parse(raw);
    } catch { /* ignorer */ }
    if (!Array.isArray(journal)) journal = [];

    const entries = piece.lignes.map(l => ({
      id: crypto.randomUUID(),
      date: piece.date,
      numeroPiece: piece.id,
      piece_justificative: piece.piece_justificative || piece.id,
      fournisseur: piece.fournisseur || '',
      categorie: piece.categorie || '',
      compte: l.libelleCompte,
      libelle: l.libelle,
      debit: l.debit || null,
      credit: l.credit || null,
      journal: piece.journal,
      ttnId: piece.ttnId || null,
      locked: !!opts.locked,
    }));

    journal.unshift(...entries);
    localStorage.setItem(journalKey, JSON.stringify(journal));
    window.dispatchEvent(new CustomEvent('journal:updated'));
    logAction(AUDIT_ACTIONS.JOURNAL_SAVE, { details: `Pièce ${piece.id} sauvegardée (${piece.lignes.length} lignes)` });

    // Sync cloud (non-bloquant)
    if (companyId) {
      const rows = entries.map(e => ({
        ...e,
        company_id: companyId,
      }));
      syncToCloud('journal_entries', rows, 'insert').catch(console.warn);
    }

    return true;
  } catch {
    return false;
  }
}
