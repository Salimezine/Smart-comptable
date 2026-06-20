/**
 * teif.js — TTN mode + comptabilité
 *
 * Ne contient plus que :
 *   setTTNMode / getTTNMode   → mode de télédéclaration
 *   fromInvoice               → conversion format facture
 *   createPieceComptable      → écritures comptables (legacy, utilisé par App.jsx)
 *
 * Le générateur XML TEIF est maintenant dans shared/teif-generator.js
 */

// ══════════════════════════════════════════════════
// CONSTANTES
// ══════════════════════════════════════════════════

const TVA_RATES = [0, 7, 13, 19];
const TVA_CODES = { 0: 'E', 7: 'S', 13: 'AA', 19: 'AB' };

const CATEGORIE_TO_COMPTE = {
  achat_marchandises: '601',
  achat_matieres: '6021',
  frais_telecommunication: '6248',
  frais_energie: '6042',
  frais_carburant: '6241',
  frais_transport: '624',
  fournitures_bureau: '6024',
  services_exterieurs: '6245',
  frais_bancaires: '6316',
  loyer: '6132',
  honoraires: '6222',
  frais_assurance: '616',
  frais_entretien: '615',
  frais_publicite: '623',
  frais_informatique: '2184',
};

const CATEGORIE_LABELS = {
  achat_marchandises: 'Achats de marchandises',
  achat_matieres: 'Matières premières',
  frais_telecommunication: 'Télécommunications',
  frais_energie: 'Eau, électricité, gaz',
  frais_carburant: 'Carburants et lubrifiants',
  frais_transport: 'Transports',
  fournitures_bureau: 'Fournitures de bureau',
  services_exterieurs: 'Services extérieurs',
  frais_bancaires: 'Frais bancaires',
  loyer: 'Loyers',
  honoraires: 'Honoraires',
  frais_assurance: "Primes d'assurance",
  frais_entretien: 'Entretien et réparations',
  frais_publicite: 'Publicité',
  frais_informatique: 'Matériel informatique',
};

// ══════════════════════════════════════════════════
// TTN MODE
// ══════════════════════════════════════════════════

const TTN_MODE_KEY = 'smart_ttn_mode';

export function setTTNMode(mode) {
  if (!['dev', 'prod', 'middleware'].includes(mode)) throw new Error('Mode TTN: dev, prod ou middleware');
  localStorage.setItem(TTN_MODE_KEY, mode);
}

export function getTTNMode() {
  return localStorage.getItem(TTN_MODE_KEY) || 'dev';
}

// ══════════════════════════════════════════════════
// HELPERS COMPTABLES
// ══════════════════════════════════════════════════

function formatMontant(val, decimals = 3) {
  if (val == null || isNaN(val)) return '0.000';
  return Number(val).toFixed(decimals);
}

function escapeXml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function genererIdFacture() {
  const now = new Date();
  const d = now.toISOString().slice(0, 10).replace(/-/g, '');
  const r = Math.floor(Math.random() * 9999999).toString().padStart(7, '0');
  return `${d}-${r}`;
}

function getCompteParCategorie(categorie) {
  return CATEGORIE_TO_COMPTE[categorie] || '6245';
}

function getCompteTvaParTaux(taux) {
  return '43666';
}

function getCompteTimbre() {
  return '4368';
}

function getCompteFodec() {
  return '602000';
}

function getCompteFournisseur() {
  return '401000';
}

function getCompteChargeParCategorie(categorie) {
  return getCompteParCategorie(categorie);
}

// ══════════════════════════════════════════════════
// CONVERTISSEUR DEPUIS FORMAT EXISTANT
// ══════════════════════════════════════════════════

export function fromInvoice(invoice, companyDetails) {
  if (!invoice) throw new Error('Facture requise');

  const lines = (invoice.items || invoice.lignes || []).map((item, i) => ({
    id: i + 1,
    description: item.description || item.designation || '',
    quantity: item.quantity || item.quantite || 1,
    unitPrice: item.unitPrice || item.prix_unitaire || item.total / (item.quantity || 1) || 0,
    tvaRate: item.vatRate || item.tvaRate || item.taux_tva || 19,
    total: item.total || item.montant_ttc || 0,
  }));

  if (lines.length === 0) {
    lines.push({
      id: 1,
      description: invoice.category || invoice.categorie_sce || 'Prestation',
      quantity: 1,
      unitPrice: invoice.subtotal || invoice.baseHT || invoice.montant_ht || 0,
      tvaRate: invoice.vatRate || invoice.taux_tva || 19,
      total: invoice.totalAmount || invoice.montant_ttc || 0,
    });
  }

  const baseHT = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const totalTVA = lines.reduce((s, l) => {
    const ht = l.quantity * l.unitPrice;
    return s + ht * (l.tvaRate || 0) / 100;
  }, 0);

  const stamp = invoice.stampDuty || invoice.timbre_fiscal;
  const timbre = stamp != null ? stamp : 1.000;
  const fodec = invoice.fodec || 0;
  const totalTTC = invoice.totalAmount || invoice.montant_ttc || (baseHT + totalTVA + fodec + timbre);

  return {
    id: invoice.invoiceNumber || invoice.numero_facture || genererIdFacture(),
    type: '380',
    date: invoice.issueDate || invoice.date || new Date().toISOString(),
    currency: invoice.currency || 'TND',
    supplier: {
      name: companyDetails?.name || invoice.supplier || invoice.fournisseur || '',
      matriculeFiscal: companyDetails?.vatNumber || invoice.supplierMF || invoice.matriculeFiscal || invoice.matricule_fiscal || '',
      address: companyDetails?.address || invoice.supplierAddress || '',
      rne: companyDetails?.rne || invoice.supplierRNE || '',
    },
    customer: {
      name: invoice.clientName || invoice.client || invoice.customer?.name || '',
      matriculeFiscal: invoice.clientVat || invoice.clientMF || invoice.customer?.matriculeFiscal || '',
      address: invoice.clientAddress || invoice.customer?.address || '',
    },
    lines,
    totals: {
      baseHT: formatMontant(baseHT),
      totalTVA: formatMontant(totalTVA),
      fodec: formatMontant(fodec),
      timbre: formatMontant(timbre),
      totalTTC: formatMontant(totalTTC),
      tauxTVA: invoice.vatRate || invoice.taux_tva || 19,
    },
    categorie_sce: invoice.categorie_sce || invoice.category || 'services_exterieurs',
  };
}

// ══════════════════════════════════════════════════
// PIECE COMPTABLE (LEGACY)
// ══════════════════════════════════════════════════

export function createPieceComptable(invoiceData, ttnResponse) {
  if (!invoiceData) throw new Error('Données facture requises');

  const inv = invoiceData;
  const fournisseur = inv.supplier?.name || 'Fournisseur';
  const client = inv.customer?.name || '';
  const idFacture = inv.id || (typeof ttnResponse === 'string' ? ttnResponse : ttnResponse?.invoiceId) || 'N/A';
  const categorie = inv.categorie_sce || inv.category || 'services_exterieurs';
  const compteFournisseur = getCompteFournisseur(categorie);
  const compteCharge = getCompteChargeParCategorie(categorie);

  const lignes = [];
  const montantHT = inv.totals?.baseHT || 0;
  const montantTVA = inv.totals?.totalTVA || 0;
  const montantFodec = inv.totals?.fodec || 0;
  const montantTimbre = inv.totals?.timbre || 1.000;
  const montantTTC = inv.totals?.totalTTC || (Number(montantHT) + Number(montantTVA) + Number(montantFodec) + Number(montantTimbre));

  const tvaParTaux = {};
  if (inv.lines) {
    for (const l of inv.lines) {
      const rate = l.tvaRate || 0;
      if (!tvaParTaux[rate]) tvaParTaux[rate] = 0;
      tvaParTaux[rate] += l.quantity * l.unitPrice * rate / 100;
    }
  } else if (montantTVA > 0) {
    tvaParTaux[inv.totals?.tauxTVA || 19] = montantTVA;
  }

  lignes.push({
    compte: compteFournisseur,
    libelle: `${fournisseur} — Facture ${idFacture}`,
    debit: formatMontant(montantTTC),
    credit: '0.000',
  });

  lignes.push({
    compte: compteCharge,
    libelle: `Achat ${CATEGORIE_LABELS[categorie] || 'de biens/services'} — ${fournisseur}`,
    debit: '0.000',
    credit: formatMontant(montantHT),
  });

  for (const [rate, amount] of Object.entries(tvaParTaux)) {
    if (amount > 0) {
      lignes.push({
        compte: getCompteTvaParTaux(Number(rate)),
        libelle: `TVA déductible ${rate}%`,
        debit: '0.000',
        credit: formatMontant(amount),
      });
    }
  }

  if (montantFodec > 0) {
    lignes.push({
      compte: getCompteFodec(),
      libelle: 'FODEC 1%',
      debit: '0.000',
      credit: formatMontant(montantFodec),
    });
  }

  if (montantTimbre > 0) {
    lignes.push({
      compte: getCompteTimbre(),
      libelle: 'Timbre fiscal LF2023',
      debit: '0.000',
      credit: formatMontant(montantTimbre),
    });
  }

  const totalDebit = lignes.reduce((s, l) => s + parseFloat(l.debit), 0);
  const totalCredit = lignes.reduce((s, l) => s + parseFloat(l.credit), 0);

  return {
    id: `PC-${idFacture}-${Date.now()}`,
    date: inv.date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    libelle: `Facture ${idFacture} — ${fournisseur}${client ? ` / ${client}` : ''}`,
    reference_facture: idFacture,
    reference_ttn: (typeof ttnResponse === 'string' ? null : ttnResponse?.receiptId) || null,
    lignes,
    total_debit: formatMontant(totalDebit),
    total_credit: formatMontant(totalCredit),
    total: Math.max(totalDebit, totalCredit),
    totalDebit,
    totalCredit,
    equilibre: Math.abs(totalDebit - totalCredit) < 0.01,
    devise: 'TND',
  };
}

export { CATEGORIE_TO_COMPTE, CATEGORIE_LABELS, TVA_RATES };
