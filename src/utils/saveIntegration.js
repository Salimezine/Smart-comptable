/**
 * saveIntegration.js — Orchestrateur d'enregistrement unifié
 *
 * À chaque enregistrement d'un document (achat, vente, facture, dépense),
 * ce module exécute TOUTES les opérations liées de façon cohérente :
 *   1. Écriture comptable (journal) via journalComptable + saveJournalPiece
 *   2. Mise à jour du stock (ERP products/mouvements + stockManager legacy)
 *   3. Enregistrement automatique du tiers (client/fournisseur) en ERP
 *   4. Événements de rafraîchissement (journal:updated, stock:updated, data:updated)
 *
 * Pure JS navigateur — localStorage + Supabase sync.
 */
import { journalComptable, saveJournalPiece } from './journalComptable';
import { updateStockFromInvoice } from './stockManager';
import {
  clientsStore, suppliersStore, productsStore, stockMovementsStore,
  ensureDefaultWarehouse, updateStockAfterMovement,
} from './erpStore';

// ── Event bus ──
export function emitDataUpdated(kind = 'document') {
  try {
    window.dispatchEvent(new CustomEvent('data:updated', { detail: { kind } }));
    window.dispatchEvent(new CustomEvent('stock:updated', { detail: { kind } }));
  } catch { /* silencieux */ }
}

// ── Tiers (client / fournisseur) ──
function normalise(nom) {
  return (nom || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function ensureTier(companyId, store, nom, infos = {}) {
  try {
    if (!companyId || !nom) return null;
    const existing = store.getAll(companyId).find(t =>
      normalise(t.nom) === normalise(nom));
    if (existing) {
      const patch = {};
      if (infos.matricule_fiscal && !existing.matricule_fiscal) patch.matricule_fiscal = infos.matricule_fiscal;
      if (infos.adresse && !existing.adresse) patch.adresse = infos.adresse;
      if (infos.email && !existing.email) patch.email = infos.email;
      if (infos.telephone && !existing.telephone) patch.telephone = infos.telephone;
      if (Object.keys(patch).length > 0) store.upsert(companyId, { ...existing, ...patch });
      return existing;
    }
    return store.upsert(companyId, {
      nom,
      matricule_fiscal: infos.matricule_fiscal || '',
      adresse: infos.adresse || '',
      email: infos.email || '',
      telephone: infos.telephone || '',
      code: store.generateCode(companyId, store === clientsStore ? 'C' : 'F'),
      actif: true,
      source: 'auto',
    });
  } catch { return null; }
}

export function ensureClient(companyId, nom, infos = {}) {
  return ensureTier(companyId, clientsStore, nom, infos);
}

export function ensureFournisseur(companyId, nom, infos = {}) {
  return ensureTier(companyId, suppliersStore, nom, infos);
}

// ── Stock ERP + legacy ──
function findProduct(companyId, designation) {
  const liste = productsStore.getAll(companyId);
  const nd = normalise(designation);
  const prefix = nd.slice(0, Math.min(10, nd.length));
  return liste.find(p => {
    const np = normalise(p.designation || p.nom || p.reference || '');
    return np.includes(prefix) || prefix.includes(np) || (nd && np.includes(nd));
  }) || null;
}

export function applyStockDoc(companyId, doc) {
  const lignes = Array.isArray(doc.lignes) ? doc.lignes : [];
  if (!companyId || lignes.length === 0) return;
  const isSortie = doc.type === 'vente';
  const sens = isSortie ? 'sortie' : 'entree';

  for (const l of lignes) {
    const designation = (l.designation || l.libelle || '').trim() || 'Article';
    const quantite = parseFloat(l.quantite) || 1;
    const prix = parseFloat(l.prix_unitaire_ht ?? l.prixUnitaireHT ?? l.prix_achat_ht) || 0;
    if (quantite <= 0) continue;

    let product = l.product_id
      ? productsStore.getById(companyId, l.product_id)
      : findProduct(companyId, designation);

    if (!product && !isSortie) {
      product = productsStore.upsert(companyId, {
        designation,
        reference: '',
        prix_achat_ht: prix,
        prix_vente_ht: prix,
        taux_tva: parseFloat(l.taux_tva) || 19,
        stock_actuel: 0,
        stock_mini: 0,
        code: productsStore.generateCode(companyId, 'P'),
      });
    }

    if (product) {
      stockMovementsStore.upsert(companyId, {
        product_id: product.id,
        designation,
        type: sens,
        quantite,
        prix_unitaire_ht: prix,
        date: doc.date || new Date().toISOString().slice(0, 10),
        reference: doc.numero || '',
        source: doc.source || 'document',
        company_id: companyId,
      });
      updateStockAfterMovement(companyId, product.id);
    }
  }

  // StockManager legacy (tableau de bord / stockTotal / reports)
  try {
    updateStockFromInvoice({
      id: doc.numero || doc.id,
      type: doc.type,
      isVente: isSortie,
      dateEmission: doc.date,
      lignes: lignes.map(l => ({
        designation: l.designation || l.libelle || 'Article',
        quantite: parseFloat(l.quantite) || 1,
        prixUnitaireHT: parseFloat(l.prix_unitaire_ht ?? l.prixUnitaireHT) || 0,
      })),
    });
  } catch { /* silencieux */ }

  emitDataUpdated('stock');
}

// ── Journal ──
export function saveDocJournal(companyId, doc) {
  try {
    const corrige = {
      fournisseur: doc.fournisseur || '',
      matricule_fiscal: doc.mf || '',
      date: doc.date,
      numero_justificatif: doc.numero || `PC-${Date.now()}`,
      categorie: doc.categorie || (doc.type === 'vente' ? 'Ventes' : 'Autres charges'),
      sous_total_ht: parseFloat(doc.total_ht) || 0,
      montant_tva: parseFloat(doc.total_tva) || 0,
      timbre: parseFloat(doc.timbre) || 0,
      fodec: parseFloat(doc.fodec) || 0,
      total_ttc: parseFloat(doc.total_ttc) || 0,
      retenue_source: doc.retenue_source || false,
      remise: doc.remise || 0,
      remise_pourcent: doc.remise_pourcent || 0,
    };
    const piece = journalComptable(corrige, {
      type: doc.type === 'vente' ? 'vente' : 'achat',
      fournisseurNom: doc.fournisseur || 'Fournisseur',
      datePiece: doc.date,
      mf: doc.mf,
    });
    piece.journal = doc.journal || (doc.type === 'vente' ? 'VNT' : 'ACH');
    const ok = saveJournalPiece(piece, {});
    if (ok) emitDataUpdated('journal');
    return { ok, piece };
  } catch {
    return { ok: false, piece: null };
  }
}

/**
 * enregistrerDocument — point d'entrée unique.
 * doc = {
 *   type: 'achat'|'vente',
 *   fournisseur?, client?, mf?, adresse?, email?, telephone?,
 *   date, numero, categorie?, journal?,
 *   total_ht, total_tva, total_ttc, timbre?, fodec?, remise?, remise_pourcent?,
 *   lignes: [{ designation, quantite, prix_unitaire_ht, taux_tva, product_id }],
 *   faireJournal: true|false (defaut true),
 *   faireStock: true|false (defaut true),
 * }
 */
export function enregistrerDocument(companyId, doc) {
  const resultat = { journal: { ok: false }, stock: false, tiers: null };
  try {
    const nomTiers = doc.type === 'vente' ? doc.client : doc.fournisseur;
    if (companyId && nomTiers) {
      resultat.tiers = doc.type === 'vente'
        ? ensureClient(companyId, nomTiers, { matricule_fiscal: doc.mf, adresse: doc.adresse, email: doc.email, telephone: doc.telephone })
        : ensureFournisseur(companyId, nomTiers, { matricule_fiscal: doc.mf, adresse: doc.adresse, email: doc.email, telephone: doc.telephone });
    }

    if (doc.faireJournal !== false && (parseFloat(doc.total_ttc) > 0 || parseFloat(doc.total_ht) > 0)) {
      resultat.journal = saveDocJournal(companyId, doc);
    }

    if (doc.faireStock !== false) {
      applyStockDoc(companyId, doc);
      resultat.stock = true;
    }

    if (resultat.journal.ok || resultat.stock || resultat.tiers) {
      emitDataUpdated(doc.type === 'vente' ? 'vente' : 'achat');
    }
  } catch { /* silencieux */ }
  return resultat;
}

// ── Helpers de synthèse ──
export function stockTotal(companyId) {
  try {
    return productsStore.getAll(companyId)
      .reduce((sum, p) => sum + (p.stock_actuel || 0) * (p.prix_achat_ht || 0), 0);
  } catch { return 0; }
}

export function compteurTiers(companyId, type) {
  try {
    const liste = type === 'clients' ? clientsStore.getAll(companyId) : suppliersStore.getAll(companyId);
    return liste.length;
  } catch { return 0; }
}
