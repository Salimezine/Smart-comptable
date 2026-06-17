/**
 * ttnWorkflow.js — Workflow TTN El Fatoora
 *
 * Mode dev: simulation locale
 * Mode prod: téléchargement XML + redirection portail
 * Pure JS navigateur — zéro dépendance
 *
 * Exporte:
 *   sendToTTN(xml, cfg)     → { status, ttnId?, errors?, message? }
 *   handleTTNResponse(inv, r) → { success, pieceId?, ttnId?, errors? }
 *   confirmTTNTransmission(inv, xml, cfg) → workflow complet combiné
 */

import { createPieceComptable, savePieceToJournal } from './pieceComptable.js';
import { updateStockFromInvoice } from './stockManager.js';
import { downloadTEIFXML } from './teifGenerator.js';

// ─────────────────────────────────────────────
// Codes erreur TTN → messages FR
// ─────────────────────────────────────────────
const ERR_MAP = {
  ERR_MF_INVALID: 'Matricule fiscal invalide — vérifiez Configuration > Matricule Fiscal',
  ERR_SCHEMA_INVALID: 'Structure XML non conforme TEIF v1.8.8',
  ERR_DUPLICATE_ID: 'Numéro de facture déjà transmis à TTN',
  ERR_SIGNATURE: 'Certificat TUNTRUST requis (mode production)',
  ERR_DATE: 'Date de facture invalide ou antérieure à 2016',
};

function frError(err) {
  return ERR_MAP[err] || err || 'Erreur inconnue';
}

// ─────────────────────────────────────────────
// 1. sendToTTN — envoi vers TTN
// ─────────────────────────────────────────────
export async function sendToTTN(xmlString, config = {}) {
  try {
    const mode = config.ttnMode || 'dev';

    if (mode === 'dev' || mode === 'sandbox') {
      // Mode développement — simulation
      await new Promise(r => setTimeout(r, 1500));

      const rejected = Math.random() < 0.05;
      if (rejected) {
        const reasons = ['ERR_MF_INVALID', 'ERR_SCHEMA_INVALID', 'ERR_DUPLICATE_ID'];
        const err = reasons[Math.floor(Math.random() * reasons.length)];
        return {
          status: 'rejected',
          errors: [err],
          messages: [frError(err)],
          timestamp: new Date().toISOString(),
        };
      }

      const year = new Date().getFullYear();
      const r6 = Math.random().toString(36).slice(2, 8).toUpperCase();
      return {
        status: 'accepted',
        ttnId: `TTN-${year}-${r6}`,
        timestamp: new Date().toISOString(),
        _simulated: true,
      };
    }

    // Mode production — téléchargement XML + portail
    return {
      status: 'manual',
      message: 'Téléchargez le fichier XML TEIF et soumettez-le sur le portail El Fatoora.',
      xml: xmlString,
      invoiceId: config.invoiceId || 'facture',
      portalUrl: 'https://www.efatoora.tn',
      instructions: [
        '1. Cliquez sur "Télécharger XML" pour sauvegarder le fichier',
        '2. Accédez au portail El Fatoora: https://www.efatoora.tn',
        '3. Connectez-vous avec votre certificat TUNTRUST',
        '4. Importez le fichier XML dans la section "Déposer une facture"',
        '5. Le portail vérifiera la signature et transmettra à TTN',
        '6. Revenez ici et cliquez sur "Confirmer transmission" après soumission',
      ],
      timestamp: new Date().toISOString(),
    };
  } catch (e) {
    return { status: 'error', errors: [e.message], timestamp: new Date().toISOString() };
  }
}

// ─────────────────────────────────────────────
// 1b. téléchargement XML après sendToTTN
// ─────────────────────────────────────────────
export function downloadTTNXml(response) {
  if (response?.xml) {
    downloadTEIFXML(response.xml, response.invoiceId);
  }
}

// ─────────────────────────────────────────────
// 2. handleTTNResponse — workflow post-acceptation
// ─────────────────────────────────────────────
export async function handleTTNResponse(invoice, ttnResponse) {
  try {
    if (!invoice || !ttnResponse) {
      return { success: false, errors: ['Données requises manquantes'] };
    }

    const { status, ttnId, errors = [], timestamp } = ttnResponse;

    if (status === 'accepted') {
      const piece = await createPieceComptable(invoice, ttnId);
      await savePieceToJournal(piece, { locked: true });
      await updateStockFromInvoice(invoice);

      invoice.statut = 'validee_teif';
      invoice.ttnId = ttnId;
      invoice.ttnTimestamp = timestamp;

      window.dispatchEvent(new CustomEvent('teif:accepted', {
        detail: { invoiceId: invoice.id, ttnId, pieceId: piece.id },
      }));

      return {
        success: true,
        pieceId: piece.id,
        ttnId,
      };
    }

    if (status === 'rejected') {
      invoice.statut = 'teif_rejete';
      invoice.ttnErrors = errors.map(frError);
      invoice.ttnTimestamp = timestamp;

      window.dispatchEvent(new CustomEvent('teif:rejected', {
        detail: { invoiceId: invoice.id, errors: invoice.ttnErrors },
      }));

      return {
        success: false,
        errors: invoice.ttnErrors,
      };
    }

    if (status === 'pending') {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('teif:pending', {
          detail: { invoiceId: invoice.id },
        }));
      }, 30000);

      return {
        success: null,
        message: 'En attente de confirmation TTN',
      };
    }

    if (status === 'manual') {
      return {
        success: null,
        status: 'manual',
        message: ttnResponse.message,
        portalUrl: ttnResponse.portalUrl,
        instructions: ttnResponse.instructions,
        xml: ttnResponse.xml,
      };
    }

    return { success: false, errors: ['Statut TTN inconnu'] };
  } catch (e) {
    return { success: false, errors: [e.message] };
  }
}

// ─────────────────────────────────────────────
// 3. confirmTTNTransmission — marque manuellement
//    une facture comme transmise → écriture comptable
// ─────────────────────────────────────────────
export async function confirmTTNTransmission(invoice, ttnIdOverride) {
  try {
    if (!invoice) return { success: false, errors: ['Facture requise'] };

    const ttnId = ttnIdOverride || `TTN-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;

    const piece = await createPieceComptable(invoice, ttnId);
    await savePieceToJournal(piece, { locked: true });
    await updateStockFromInvoice(invoice);

    invoice.statut = 'validee_teif';
    invoice.ttnId = ttnId;
    invoice.ttnTimestamp = new Date().toISOString();

    window.dispatchEvent(new CustomEvent('teif:accepted', {
      detail: { invoiceId: invoice.id, ttnId, pieceId: piece.id },
    }));

    return { success: true, pieceId: piece.id, ttnId };
  } catch (e) {
    return { success: false, errors: [e.message] };
  }
}
