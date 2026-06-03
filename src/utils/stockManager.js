/**
 * stockManager.js — Mise à jour automatique du stock
 *
 * Pure JS navigateur — localStorage
 * Compatible avec les entrées existantes de StockView
 */

const STOCK_KEY = 'smart_stock';
const MOVEMENTS_KEY = 'smart_stock_mouvements';

function normalize(str) {
  if (!str) return '';
  return str.toLowerCase()
    .replace(/[àâä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o')
    .replace(/[ùûü]/g, 'u')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function findArticle(designation) {
  try {
    const raw = localStorage.getItem(STOCK_KEY);
    const stock = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(stock)) return null;

    const nd = normalize(designation);
    if (!nd) return null;

    const prefix = nd.slice(0, Math.min(8, nd.length));

    return stock.find(a => {
      const na = normalize(a.designation);
      return na.includes(prefix) || prefix.includes(na);
    }) || null;
  } catch {
    return null;
  }
}

function saveStock(stock) {
  try {
    localStorage.setItem(STOCK_KEY, JSON.stringify(stock));
  } catch {
    /* silencieux */
  }
}

// ─────────────────────────────────────────────
// updateStockFromInvoice — auto stock
// ─────────────────────────────────────────────
export function updateStockFromInvoice(invoice) {
  try {
    if (!invoice) return;
    const lignes = Array.isArray(invoice.lignes) ? invoice.lignes : [];
    if (lignes.length === 0) return;

    const isSortie = invoice.type === 'vente' || invoice.isVente;
    const delta = isSortie ? -1 : 1;

    let stock = [];
    try {
      const raw = localStorage.getItem(STOCK_KEY);
      if (raw) stock = JSON.parse(raw);
    } catch {
      stock = [];
    }
    if (!Array.isArray(stock)) stock = [];

    let mouvements = [];
    try {
      const raw = localStorage.getItem(MOVEMENTS_KEY);
      if (raw) mouvements = JSON.parse(raw);
    } catch {
      mouvements = [];
    }
    if (!Array.isArray(mouvements)) mouvements = [];

    for (const ligne of lignes) {
      const designation = ligne.designation || 'Article';
      const quantite = parseFloat(ligne.quantite) || 1;
      const prixUnitaire = parseFloat(ligne.prixUnitaireHT) || 0;

      const existing = findArticle(designation);

      if (existing) {
        existing.quantite = (existing.quantite || 0) + delta * quantite;
        existing.valeurUnitaire = prixUnitaire;
        existing.derniereMaj = new Date().toISOString();
      } else if (!isSortie) {
        // Créer article automatiquement pour les achats
        const newArticle = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          designation,
          quantite: quantite,
          valeurUnitaire: prixUnitaire,
          dateCreation: new Date().toISOString(),
          derniereMaj: new Date().toISOString(),
        };
        stock.push(newArticle);
      }

      mouvements.unshift({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        date: invoice.dateEmission || new Date().toISOString().slice(0, 10),
        reference: invoice.id,
        designation,
        delta: delta * quantite,
        prixUnitaire,
        type: isSortie ? 'sortie' : 'entree',
        timestamp: Date.now(),
      });
    }

    saveStock(stock);
    try {
      localStorage.setItem(MOVEMENTS_KEY, JSON.stringify(mouvements));
    } catch {
      /* silencieux */
    }

    window.dispatchEvent(new CustomEvent('stock:updated'));
  } catch {
    /* silencieux */
  }
}

// ─────────────────────────────────────────────
// getStockSummary — état actuel du stock
// ─────────────────────────────────────────────
export function getStockSummary() {
  try {
    const raw = localStorage.getItem(STOCK_KEY);
    const stock = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(stock)) return [];
    return stock
      .filter(a => a && a.designation)
      .map(a => ({
        id: a.id,
        designation: a.designation,
        quantite: a.quantite || 0,
        valeurUnitaire: a.valeurUnitaire || 0,
        valeurTotale: ((a.quantite || 0) * (a.valeurUnitaire || 0)),
        derniereMaj: a.derniereMaj || '',
      }))
      .filter(a => a.quantite > 0);
  } catch {
    return [];
  }
}
