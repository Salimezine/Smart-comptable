/**
 * pieceComptable.js — Pièces comptables PCG Tunisien
 *
 * Plan Comptable Général tunisien (PCG TN)
 * Pure JS navigateur — localStorage
 */

// ─────────────────────────────────────────────
// Comptes PCG TN par catégorie
// ─────────────────────────────────────────────
export const COMPTES_PCG_TN = {
  achat_marchandises: '607000',
  achat_mp: '601000',
  charge_externe: '611000',
  personnel: '621000',
  frais_energie: '626000',
  frais_bancaires: '627000',
  amortissement: '681000',
  autre_charge: '658000',
  prestation_services: '614000',
  loyer: '613000',
  telecom: '626300',
  transport: '624000',
  assurance: '616000',
  honoraires: '622200',
  publicite: '623000',
};

const LIBELLES_COMPTES = {
  '401': 'Fournisseurs',
  '411': 'Clients',
  '607000': 'Achats de marchandises',
  '601000': 'Achats de matières premières',
  '611000': 'Charges externes',
  '621000': 'Charges de personnel',
  '626000': 'Eau, électricité, gaz',
  '627000': 'Frais bancaires',
  '681000': 'Amortissements',
  '658000': 'Autres charges',
  '614000': 'Prestations de services',
  '613000': 'Loyers',
  '626300': 'Télécommunications',
  '624000': 'Transports',
  '616000': "Primes d'assurance",
  '622200': 'Honoraires',
  '623000': 'Publicité',
  '43671': 'TVA déductible',
  '43611': 'TVA collectée',
  '4311': 'Timbre fiscal',
  '602000': 'FODEC',
  '6353': 'Timbre (charge)',
  '70XXXX': 'Ventes de produits',
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
      // Débit fournisseur = total TTC
      ecritures.push({
        compte: compteTiers,
        libelleCompte: `${compteTiers.slice(0, 3)} ${LIBELLES_COMPTES[compteTiers.slice(0, 3)] || 'Tiers'}`,
        libelle: `Facture ${invoice.id} - ${nomTiers}`,
        debit: totalTTC,
        credit: 0,
      });

      // Crédit charge HT
      const cat = invoice.categorie_sce || invoice.category || 'charge_externe';
      const compteCharge = COMPTES_PCG_TN[cat] || '611000';
      ecritures.push({
        compte: compteCharge,
        libelleCompte: `${compteCharge} ${LIBELLES_COMPTES[compteCharge] || 'Charge'}`,
        libelle: `HT ${invoice.id}`,
        debit: 0,
        credit: baseHT,
      });

      // Crédit TVA déductible
      if (totalTVA > 0.001) {
        ecritures.push({
          compte: '43671',
          libelleCompte: '43671 TVA déductible',
          libelle: `TVA ${invoice.id}`,
          debit: 0,
          credit: totalTVA,
        });
      }

      // Crédit timbre
      if (timbre > 0.001) {
        ecritures.push({
          compte: '4311',
          libelleCompte: '4311 Timbre fiscal',
          libelle: `Timbre ${invoice.id}`,
          debit: 0,
          credit: timbre,
        });
      }

      // Crédit FODEC
      if (fodecTotal > 0.001) {
        ecritures.push({
          compte: '602000',
          libelleCompte: '602000 FODEC',
          libelle: `FODEC ${invoice.id}`,
          debit: 0,
          credit: fodecTotal,
        });
      }
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
          compte: '43611',
          libelleCompte: '43611 TVA collectée',
          libelle: `TVA ${invoice.id}`,
          debit: 0,
          credit: totalTVA,
        });
      }

      // Débit timbre (charge)
      if (timbre > 0.001) {
        ecritures.push({
          compte: '6353',
          libelleCompte: '6353 Timbre (charge)',
          libelle: `Timbre ${invoice.id}`,
          debit: timbre,
          credit: 0,
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
const JOURNAL_KEY = 'smart_journal';

export function savePieceToJournal(piece) {
  try {
    if (!piece || !piece.validated) return;

    let journal = [];
    try {
      const raw = localStorage.getItem(JOURNAL_KEY);
      if (raw) journal = JSON.parse(raw);
    } catch {
      journal = [];
    }
    if (!Array.isArray(journal)) journal = [];

    const entries = piece.lignes.map(l => ({
      date: piece.date,
      numeroPiece: piece.id,
      compte: `${l.compte} ${l.libelleCompte}`,
      libelle: l.libelle,
      debit: l.debit || null,
      credit: l.credit || null,
      journal: piece.journal,
      ttnId: piece.ttnId || null,
    }));

    journal.unshift(...entries);
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(journal));

    window.dispatchEvent(new CustomEvent('journal:updated'));
  } catch {
    /* silencieux */
  }
}
