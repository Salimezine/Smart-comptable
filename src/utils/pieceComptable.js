/**
 * pieceComptable.js — Pièces comptables PCG Tunisien
 *
 * Plan Comptable Général tunisien (PCG TN)
 * Pure JS navigateur — localStorage
 */
import { getJournalKey } from './journalKey';
import { logAction, AUDIT_ACTIONS } from './security/auditLog';

// ─────────────────────────────────────────────
// Comptes PCG TN par catégorie
// ─────────────────────────────────────────────
export const COMPTES_PCG_TN = {
  achat_marchandises: '607000',
  achat_mp: '601000',
  charge_externe: '611000',
  personnel: '640000',
  frais_energie: '614000',
  frais_bancaires: '627000',
  amortissement: '681000',
  autre_charge: '637000',
  prestation_services: '604000',
  loyer: '613000',
  telecom: '626000',
  transport: '624000',
  assurance: '616000',
  honoraires: '622200',
  publicite: '623000',
};

export const LIBELLES_COMPTES = {
  '401': 'Fournisseurs',
  '411': 'Clients',
  '607000': 'Achats de marchandises',
  '601000': 'Achats de matières premières',
  '611000': 'Charges externes',
  '640000': 'Salaires',
  '614000': 'Charges locatives et de copropriété',
  '627000': 'Services bancaires et assimilés',
  '681000': "Dotations d'exploitation",
  '637000': 'Réductions de valeur',
  '604000': "Achats d'études et de prestations",
  '613000': 'Locations',
  '626000': 'Frais postaux et frais de télécommunications',
  '624000': 'Transports',
  '616000': "Primes d'assurances",
  '622200': 'Honoraires',
  '623000': 'Publicité, publications, relations publiques',
  '43666': 'TVA sur autres biens et services',
  '43671': 'TVA collectée',
  '4368': 'Taxes à régulariser',
  '602000': 'Achats stockés - Autres approvisionnements',
  '602400': 'Fournitures de bureau et informatiques',
  '6654': "Droits d'enregistrement et de timbre",
  '70XXXX': 'Ventes de produits',
  '631000': 'Impôt sur les sociétés',
  '437000': 'État - Impôt sur les sociétés',
};

// ─────────────────────────────────────────────
// Sous-comptes tiers (fournisseurs / clients)
// ─────────────────────────────────────────────
const TIERS_KEY = 'smart_comptes_tiers';

function getCompteTiers(nom, prefixe) {
  try {
    if (!nom) return `${prefixe}001`;
    const raw = localStorage.getItem(TIERS_KEY);
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
    localStorage.setItem(TIERS_KEY, JSON.stringify(tiers));
    return tiers[key];
  } catch {
    return `${prefixe}001`;
  }
}

function getCompteFournisseur(nom) {
  return getCompteTiers(nom, '401');
}

function getCompteClient(nom) {
  return getCompteTiers(nom, '411');
}

// ─────────────────────────────────────────────
// 1. createPieceComptable
// ─────────────────────────────────────────────
export function createPieceComptable(invoice, ttnId) {
  try {
    if (!invoice) throw new Error('Facture requise');

    const isAchat = invoice.type === 'achat' || invoice.isAchat;
    const fournisseur = invoice.fournisseur || {};
    const client = invoice.client || {};
    const lignes = Array.isArray(invoice.lignes) ? invoice.lignes : [];

    const baseHT = lignes.reduce((s, l) => s + (parseFloat(l.quantite) || 0) * (parseFloat(l.prixUnitaireHT) || 0), 0);

    const tvaGroups = {};
    lignes.forEach(l => {
      const taux = parseFloat(l.tauxTVA) || 19;
      const ht = (parseFloat(l.quantite) || 0) * (parseFloat(l.prixUnitaireHT) || 0);
      const mtva = ht * taux / 100;
      if (!tvaGroups[taux]) tvaGroups[taux] = 0;
      tvaGroups[taux] += mtva;
    });
    const totalTVA = Object.values(tvaGroups).reduce((s, v) => s + v, 0);

    const fodecTotal = lignes
      .filter(l => l.fodec)
      .reduce((s, l) => s + (parseFloat(l.quantite) || 0) * (parseFloat(l.prixUnitaireHT) || 0) * 0.01, 0);

    const timbre = parseFloat(invoice.timbre) || 0;
    const totalTTC = baseHT + totalTVA + fodecTotal + timbre;

    const ecritures = [];
    const nomTiers = isAchat ? fournisseur.nom : client.nom;
    const compteTiers = isAchat ? getCompteFournisseur(nomTiers) : getCompteClient(nomTiers);

    if (isAchat) {
      // Débit charge HT
      const cat = invoice.categorie_sce || invoice.category || 'charge_externe';
      const compteCharge = COMPTES_PCG_TN[cat] || '611000';
      ecritures.push({
        compte: compteCharge,
        libelleCompte: `${compteCharge} ${LIBELLES_COMPTES[compteCharge] || 'Charge'}`,
        libelle: `HT ${invoice.id}`,
        debit: baseHT,
        credit: 0,
      });

      // Débit TVA déductible
      if (totalTVA > 0.001) {
        ecritures.push({
          compte: '43666',
          libelleCompte: '43666 TVA sur autres biens et services',
          libelle: `TVA ${invoice.id}`,
          debit: totalTVA,
          credit: 0,
        });
      }

      // Débit timbre fiscale (compte de régularisation)
      if (timbre > 0.001) {
        ecritures.push({
          compte: '6654',
          libelleCompte: '6654 Droits d\'enregistrement et de timbre',
          libelle: `Timbre ${invoice.id}`,
          debit: timbre,
          credit: 0,
        });
      }

      // Débit FODEC
      if (fodecTotal > 0.001) {
        ecritures.push({
          compte: '602000',
          libelleCompte: '602000 FODEC',
          libelle: `FODEC ${invoice.id}`,
          debit: fodecTotal,
          credit: 0,
        });
      }

      // Crédit fournisseur = total TTC
      ecritures.push({
        compte: compteTiers,
        libelleCompte: `${compteTiers.slice(0, 3)} ${LIBELLES_COMPTES[compteTiers.slice(0, 3)] || 'Tiers'}`,
        libelle: `Facture ${invoice.id} - ${nomTiers}`,
        debit: 0,
        credit: totalTTC,
      });
    } else {
      // Facture VENTE
      // Débit client = total TTC
      ecritures.push({
        compte: compteTiers,
        libelleCompte: `${compteTiers.slice(0, 3)} ${LIBELLES_COMPTES[compteTiers.slice(0, 3)] || 'Tiers'}`,
        libelle: `Facture ${invoice.id} - ${nomTiers}`,
        debit: totalTTC,
        credit: 0,
      });

      // Crédit vente HT
      ecritures.push({
        compte: '70XXXX',
        libelleCompte: '70XXXX Ventes de produits',
        libelle: `HT ${invoice.id}`,
        debit: 0,
        credit: baseHT,
      });

      // Crédit TVA collectée
      if (totalTVA > 0.001) {
        ecritures.push({
          compte: '43671',
          libelleCompte: '43671 TVA collectée',
          libelle: `TVA ${invoice.id}`,
          debit: 0,
          credit: totalTVA,
        });
      }

      // Crédit timbre collecté (dette fiscale)
      if (timbre > 0.001) {
        ecritures.push({
          compte: '4368',
          libelleCompte: '4368 Taxes à régulariser',
          libelle: `Timbre ${invoice.id}`,
          debit: 0,
          credit: timbre,
        });
      }
    }

    const debitTotal = ecritures.reduce((s, l) => s + l.debit, 0);
    const creditTotal = ecritures.reduce((s, l) => s + l.credit, 0);

    if (Math.abs(debitTotal - creditTotal) > 0.001) {
      throw new Error(`Pièce déséquilibrée: Débit=${debitTotal.toFixed(3)} Crédit=${creditTotal.toFixed(3)}`);
    }

    return {
      id: `PC-${ttnId || Date.now()}`,
      date: invoice.dateEmission || new Date().toISOString().slice(0, 10),
      journal: isAchat ? 'ACH' : 'VNT',
      reference: invoice.id,
      ttnId: ttnId || '',
      libelle: `${invoice.id} — ${nomTiers || 'Tiers'}`,
      lignes: ecritures.map(e => ({
        ...e,
        debit: parseFloat(e.debit.toFixed(3)),
        credit: parseFloat(e.credit.toFixed(3)),
      })),
      totalDebit: parseFloat(debitTotal.toFixed(3)),
      totalCredit: parseFloat(creditTotal.toFixed(3)),
      validated: true,
    };
  } catch (e) {
    return { id: '', error: e.message, validated: false };
  }
}

// ─────────────────────────────────────────────
// 2. savePieceToJournal — persistance journal
// ─────────────────────────────────────────────


export function savePieceToJournal(piece, opts = {}) {
  try {
    if (!piece || !piece.validated) return;

    let journal = [];
    try {
      const raw = localStorage.getItem(getJournalKey());
      if (raw) journal = JSON.parse(raw);
    } catch {
      journal = [];
    }
    if (!Array.isArray(journal)) journal = [];

    const entries = piece.lignes.map(l => ({
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
    localStorage.setItem(getJournalKey(), JSON.stringify(journal));
    window.dispatchEvent(new CustomEvent('journal:updated'));
    logAction(AUDIT_ACTIONS.JOURNAL_SAVE, { details: `Pièce ${piece.id} sauvegardée (${piece.lignes.length} lignes)` });
  } catch {
    /* silencieux */
  }
}

// ─────────────────────────────────────────────
// 3. saveSimpleEntry — écriture simple rapide
//    pour opérations sans TEIF (achat direct,
//    écriture bancaire, OD)
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// Migration: nettoyer les comptes dupliqués
// (ex: "602400 602400 Fournitures" → "602400 Fournitures")
// ─────────────────────────────────────────────
export function migrateJournal() {
  try {
    const raw = localStorage.getItem(getJournalKey());
    if (!raw) return;
    let entries = JSON.parse(raw);
    if (!Array.isArray(entries)) return;
    let changed = false;
    entries = entries.map(e => {
      if (!e.compte) return e;
      const m = e.compte.match(/^(\S+)\s+\1(?:\s|$)/);
      if (m) {
        changed = true;
        return { ...e, compte: e.compte.slice(m[1].length + 1) };
      }
      return e;
    });
    if (changed) localStorage.setItem(getJournalKey(), JSON.stringify(entries));
  } catch { /* silencieux */ }
}

export function saveSimpleEntry({ date, numeroPiece, compte, libelle, debit, credit, journal = 'OD', piece_justificative, fournisseur, categorie }) {
  try {
    let entries = [];
    try {
      const raw = localStorage.getItem(getJournalKey());
      if (raw) entries = JSON.parse(raw);
    } catch { /* ignorer */ }
    if (!Array.isArray(entries)) entries = [];

    entries.unshift({
      date: date || new Date().toISOString().slice(0, 10),
      numeroPiece: numeroPiece || `OD-${Date.now()}`,
      piece_justificative: piece_justificative || numeroPiece || null,
      fournisseur: fournisseur || null,
      categorie: categorie || null,
      compte: String(compte || ''),
      libelle: String(libelle || ''),
      debit: debit != null ? parseFloat(debit) || 0 : null,
      credit: credit != null ? parseFloat(credit) || 0 : null,
      journal: journal || 'OD',
      ttnId: null,
    });

    localStorage.setItem(getJournalKey(), JSON.stringify(entries));
    window.dispatchEvent(new CustomEvent('journal:updated'));
    logAction(AUDIT_ACTIONS.JOURNAL_SAVE, { details: `Écriture simple ${numeroPiece} sauvegardée` });
  } catch {
    /* silencieux */
  }
}

export function generateProvisionIS() {
  try {
    const raw = localStorage.getItem(getJournalKey());
    if (!raw) return null;
    const journal = JSON.parse(raw);
    if (!Array.isArray(journal) || journal.length === 0) return null;

    const alreadyExists = journal.some(e =>
      (e.compte || '').startsWith('437000') && (e.numeroPiece || '').startsWith('IS-')
    );
    if (alreadyExists) return { alreadyExists: true };

    const exercice = new Date().getFullYear();
    const charges = journal.filter(e => (e.compte || '').startsWith('6')).reduce((s, e) => s + (parseFloat(e.debit) || 0), 0);
    const produits = journal.filter(e => (e.compte || '').startsWith('7')).reduce((s, e) => s + (parseFloat(e.credit) || 0), 0);
    const resultatNet = produits - charges;
    if (resultatNet <= 0) return { resultatNet: 0 };

    const isAmount = parseFloat((resultatNet * 0.15).toFixed(3));
    const numeroPiece = `IS-${exercice}`;

    journal.unshift(
      {
        date: `${exercice}-12-31`,
        numeroPiece,
        piece_justificative: `Provision IS ${exercice}`,
        fournisseur: null,
        categorie: null,
        compte: '631000 Impôt sur les sociétés',
        libelle: `Provision IS ${exercice}`,
        debit: isAmount,
        credit: null,
        journal: 'OD',
        ttnId: null,
        locked: true,
      },
      {
        date: `${exercice}-12-31`,
        numeroPiece,
        piece_justificative: `Provision IS ${exercice}`,
        fournisseur: null,
        categorie: null,
        compte: '437000 État - Impôt sur les sociétés',
        libelle: `Provision IS ${exercice}`,
        debit: null,
        credit: isAmount,
        journal: 'OD',
        ttnId: null,
        locked: true,
      }
    );
    localStorage.setItem(getJournalKey(), JSON.stringify(journal));
    window.dispatchEvent(new CustomEvent('journal:updated'));
    return { isAmount, resultatNet, exercice };
  } catch {
    return null;
  }
}
