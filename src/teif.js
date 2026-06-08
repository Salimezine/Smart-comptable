/**
 * teif.js — TEIF v1.8.8 Tunisian Electronic Invoice Format
 *
 * Module de génération, validation, signature et transmission
 * de factures électroniques conformes au standard TTN (Tunisie TradeNet).
 *
 * LF2026 — Obligatoire pour toutes les factures B2B en Tunisie depuis juillet 2025
 *          (amendes 100-500 DT/facture papier si non respect)
 *
 * Flux: Émission → Transmission TTN → Acceptation client → Validation fiscale
 *
 * Dépendances: Web Crypto API (navigator), DOMParser/XMLSerializer
 * Compatible: navigateur moderne, React 19
 */

// ══════════════════════════════════════════════════
// CONSTANTES
// ══════════════════════════════════════════════════

const TEIF_VERSION = '1.8.8';

const NS = {
  invoice: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
  cac: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
  cbc: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
  ext: 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
  ds: 'http://www.w3.org/2000/09/xmldsig#',
  xades: 'http://uri.etsi.org/01903/v1.3.2#',
  xades141: 'http://uri.etsi.org/01903/v1.4.1#',
  ttn: 'http://www.tunisietradenet.tn/teif/1.8.8',
};

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
// HELPERS
// ══════════════════════════════════════════════════

function escapeXml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatMontant(val, decimals = 3) {
  if (val == null || isNaN(val)) return '0.000';
  return Number(val).toFixed(decimals);
}

function genererIdFacture() {
  const now = new Date();
  const d = now.toISOString().slice(0, 10).replace(/-/g, '');
  const r = Math.floor(Math.random() * 9999999).toString().padStart(7, '0');
  return `${d}-${r}`;
}

function validerMF(mf) {
  if (!mf) return false;
  return /^\d{6,7}\/[A-Z0-9](?:\/[A-Z0-9]\/\d{3})?$/i.test(mf.trim());
}

function getTvaLabel(rate) {
  return TVA_CODES[rate] || 'S';
}

function getCompteParCategorie(categorie) {
  return CATEGORIE_TO_COMPTE[categorie] || '6245';
}

function getCompteTvaParTaux(taux) {
  const map = { 19: '43666', 13: '43666', 7: '43666', 0: '43666' };
  return map[taux] || '43666';
}

function getCompteTimbre() {
  return '4368';
}

function getCompteFodec() {
  return '602000';
}

function getCompteFournisseur(categorie) {
  return '401000';
}

function getCompteChargeParCategorie(categorie) {
  return getCompteParCategorie(categorie);
}

// ══════════════════════════════════════════════════
// 1. GENERATE TEIF XML
// ══════════════════════════════════════════════════

export function generateTEIF(invoiceData) {
  const errors = [];
  if (!invoiceData) errors.push('Données facture manquantes');
  if (invoiceData) {
    if (!invoiceData.supplier?.matriculeFiscal) errors.push('MF fournisseur (votre société) obligatoire — configurez-le dans Configuration > Matricule Fiscal');
    else if (!validerMF(invoiceData.supplier.matriculeFiscal)) errors.push('Format MF fournisseur invalide (attendu: XXXXXXX/X/X/XXX) — corrigez dans Configuration > Matricule Fiscal');
    if (!invoiceData.customer?.name) errors.push('Nom client obligatoire');
    if (!invoiceData.lines?.length) errors.push('Au moins une ligne article obligatoire');
    if (!invoiceData.totals) errors.push('Totaux obligatoires');
    if (invoiceData.totals && (invoiceData.totals.totalTTC == null || isNaN(invoiceData.totals.totalTTC))) errors.push('Total TTC obligatoire');
    if (invoiceData.type && !['380', '381'].includes(invoiceData.type)) errors.push('Type facture invalide (380=facture, 381=avoir)');
    if (invoiceData.lines) {
      invoiceData.lines.forEach((l, i) => {
        if (![0, 7, 13, 19].includes(l.tvaRate)) errors.push(`Ligne ${i + 1}: taux TVA invalide (${l.tvaRate}) — doit être 0/7/13/19`);
      });
    }
  }
  if (errors.length > 0) throw new Error(`${errors.join('; ')}`);

  const inv = {
    id: invoiceData.id || genererIdFacture(),
    type: invoiceData.type || '380',
    date: invoiceData.date || new Date().toISOString(),
    currency: invoiceData.currency || 'TND',
    supplier: invoiceData.supplier,
    customer: invoiceData.customer,
    lines: invoiceData.lines.map((l, i) => ({ id: i + 1, ...l })),
    totals: invoiceData.totals,
  };

  // Calcul des totaux par taux TVA
  const taxTotals = {};
  for (const l of inv.lines) {
    const ht = l.quantity * l.unitPrice;
    const tva = ht * (l.tvaRate || 0) / 100;
    const rate = l.tvaRate || 0;
    if (!taxTotals[rate]) taxTotals[rate] = { taxable: 0, tax: 0 };
    taxTotals[rate].taxable += ht;
    taxTotals[rate].tax += tva;
  }

  const qrData = [
    `MF:${inv.supplier.matriculeFiscal}`,
    `INV:${inv.id}`,
    `DATE:${inv.date.slice(0, 10)}`,
    `TTC:${formatMontant(inv.totals.totalTTC)}`,
  ].join('|');

  const xml = xmlEnveloppe(inv, taxTotals, qrData);
  return xml;
}

function xmlEnveloppe(inv, taxTotals, qrData) {
  const issueDate = inv.date.slice(0, 10);
  const issueTime = inv.date.length > 10
    ? inv.date.slice(11, 19)
    : new Date().toTimeString().slice(0, 8);

  const linesXml = inv.lines.map((l) => {
    const ht = l.quantity * l.unitPrice;
    const tva = ht * (l.tvaRate || 0) / 100;
    return `
    <cac:InvoiceLine>
      <cbc:ID>${l.id}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="C62">${l.quantity}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${inv.currency}">${formatMontant(ht)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Name>${escapeXml(l.description)}</cbc:Name>
        ${l.fodec ? '<cac:CommodityClassification><cbc:ItemClassificationCode listID="TTN-PRODUCT-TYPE">FODEC</cbc:ItemClassificationCode></cac:CommodityClassification>' : ''}
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="${inv.currency}">${formatMontant(l.unitPrice)}</cbc:PriceAmount>
      </cac:Price>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="${inv.currency}">${formatMontant(tva)}</cbc:TaxAmount>
        <cac:TaxSubtotal>
          <cbc:TaxableAmount currencyID="${inv.currency}">${formatMontant(ht)}</cbc:TaxableAmount>
          <cbc:TaxAmount currencyID="${inv.currency}">${formatMontant(tva)}</cbc:TaxAmount>
          <cac:TaxCategory>
            <cbc:ID>${getTvaLabel(l.tvaRate || 0)}</cbc:ID>
            <cbc:Percent>${l.tvaRate || 0}</cbc:Percent>
            <cac:TaxScheme>
              <cbc:ID>TVA</cbc:ID>
            </cac:TaxScheme>
          </cac:TaxCategory>
        </cac:TaxSubtotal>
      </cac:TaxTotal>
    </cac:InvoiceLine>`;
  }).join('');

  const taxTotalsXml = Object.entries(taxTotals).map(([rate, vals]) => `
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="${inv.currency}">${formatMontant(vals.tax)}</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="${inv.currency}">${formatMontant(vals.taxable)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="${inv.currency}">${formatMontant(vals.tax)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:ID>${getTvaLabel(Number(rate))}</cbc:ID>
          <cbc:Percent>${rate}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>TVA</cbc:ID>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="${NS.invoice}"
         xmlns:cac="${NS.cac}"
         xmlns:cbc="${NS.cbc}"
         xmlns:ext="${NS.ext}"
         xmlns:ds="${NS.ds}"
         xmlns:xades="${NS.xades}"
         xmlns:xades141="${NS.xades141}"
         xmlns:ttn="${NS.ttn}">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>TEIF_v${TEIF_VERSION}</cbc:CustomizationID>
  <cbc:ProfileID>ttn:teif:${TEIF_VERSION}</cbc:ProfileID>
  <cbc:ID>${escapeXml(inv.id)}</cbc:ID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode listID="UN/ECE-1001">${inv.type}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${inv.currency}</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="MF">${escapeXml(inv.supplier.matriculeFiscal)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${escapeXml(inv.supplier.name)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(inv.supplier.address || '')}</cbc:StreetName>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID schemeID="MF">${escapeXml(inv.supplier.matriculeFiscal)}</cbc:CompanyID>
      </cac:PartyTaxScheme>
      ${inv.supplier.rne ? `
      <cac:PartyLegalEntity>
        <cbc:CompanyID schemeID="RNE">${escapeXml(inv.supplier.rne)}</cbc:CompanyID>
      </cac:PartyLegalEntity>` : ''}
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="MF">${escapeXml(inv.customer.matriculeFiscal || '0000000/X/X/000')}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${escapeXml(inv.customer.name)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(inv.customer.address || '')}</cbc:StreetName>
      </cac:PostalAddress>
      ${inv.customer.matriculeFiscal ? `
      <cac:PartyTaxScheme>
        <cbc:CompanyID schemeID="MF">${escapeXml(inv.customer.matriculeFiscal)}</cbc:CompanyID>
      </cac:PartyTaxScheme>` : ''}
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${inv.currency}">${formatMontant(inv.totals.totalTVA)}</cbc:TaxAmount>
    ${taxTotalsXml}
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${inv.currency}">${formatMontant(inv.totals.baseHT)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${inv.currency}">${formatMontant(inv.totals.baseHT)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${inv.currency}">${formatMontant(inv.totals.totalTTC)}</cbc:TaxInclusiveAmount>
    <cbc:PrepaidAmount currencyID="${inv.currency}">0.000</cbc:PrepaidAmount>
    <cbc:PayableAmount currencyID="${inv.currency}">${formatMontant(inv.totals.totalTTC)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${linesXml}
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent>
        <ttn:TTNExtension>
          <ttn:QRCodeData>${escapeXml(qrData)}</ttn:QRCodeData>
          ${inv.totals.fodec ? `<ttn:FODECAmount>${formatMontant(inv.totals.fodec)}</ttn:FODECAmount>` : ''}
          ${inv.totals.timbre ? `<ttn:TimbreFiscalAmount>${formatMontant(inv.totals.timbre)}</ttn:TimbreFiscalAmount>` : ''}
        </ttn:TTNExtension>
      </ext:ExtensionContent>
    </ext:UBLExtension>
    <ext:UBLExtension>
      <ext:ExtensionContent>
        <ds:Signature xmlns:ds="${NS.ds}" Id="TUNTRUST-SIGNATURE">
          <ds:SignedInfo>
            <ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
            <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
            <ds:Reference URI="">
              <ds:Transforms>
                <ds:Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
              </ds:Transforms>
              <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
              <ds:DigestValue>__DIGEST_PLACEHOLDER__</ds:DigestValue>
            </ds:Reference>
          </ds:SignedInfo>
          <ds:SignatureValue>__SIGNATURE_PLACEHOLDER__</ds:SignatureValue>
          <ds:KeyInfo>
            <ds:X509Data>
              <ds:X509SubjectName>CN=TUNTRUST Qualified Certificate - ${escapeXml(inv.supplier.matriculeFiscal)}</ds:X509SubjectName>
            </ds:X509Data>
          </ds:KeyInfo>
          <xades:QualifyingProperties Target="#TUNTRUST-SIGNATURE">
            <xades:SignedProperties Id="xades-signed-props">
              <xades:SignedSignatureProperties>
                <xades:SigningTime>${new Date().toISOString()}</xades:SigningTime>
                <xades:SigningCertificate>
                  <xades:Cert>
                    <xades:CertDigest>
                      <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                      <ds:DigestValue>__CERT_DIGEST_PLACEHOLDER__</ds:DigestValue>
                    </xades:CertDigest>
                    <xades:IssuerSerial>
                      <ds:X509IssuerName>CN=TUNTRUST CA ANCE</ds:X509IssuerName>
                      <ds:X509SerialNumber>__SERIAL_PLACEHOLDER__</ds:X509SerialNumber>
                    </xades:IssuerSerial>
                  </xades:Cert>
                </xades:SigningCertificate>
              </xades:SignedSignatureProperties>
            </xades:SignedProperties>
          </xades:QualifyingProperties>
        </ds:Signature>
      </ext:ExtensionContent>
    </ext:UBLExtension>
  </ext:UBLExtensions>
</Invoice>`;
}

// ══════════════════════════════════════════════════
// 2. VALIDATE TEIF XML
// ══════════════════════════════════════════════════

export function validateTEIF(xmlString) {
  const errors = [];

  if (!xmlString || typeof xmlString !== 'string') {
    return { valid: false, errors: ['XML vide ou invalide'] };
  }

  let doc;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(xmlString, 'application/xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      return { valid: false, errors: [`Erreur parsing XML: ${parseError.textContent}`] };
    }
  } catch (e) {
    return { valid: false, errors: [`Erreur parsing XML: ${e.message}`] };
  }

  const q = (sel, ctx) => (ctx || doc).querySelector(sel);
  const qa = (sel, ctx) => Array.from((ctx || doc).querySelectorAll(sel));

  // Obligatoires
  const checks = [
    { sel: 'Invoice', msg: 'Élément racine Invoice manquant' },
    { sel: 'Invoice > cbc\\:ID', msg: 'ID facture manquant' },
    { sel: 'Invoice > cbc\\:IssueDate', msg: 'Date d\'émission manquante' },
    { sel: 'Invoice > cbc\\:InvoiceTypeCode', msg: 'Type facture manquant' },
    { sel: 'Invoice > cac\\:AccountingSupplierParty', msg: 'Fournisseur manquant' },
    { sel: 'Invoice > cac\\:AccountingCustomerParty', msg: 'Client manquant' },
    { sel: 'Invoice > cac\\:TaxTotal', msg: 'Totaux TVA manquants' },
    { sel: 'Invoice > cac\\:LegalMonetaryTotal', msg: 'Totaux monétaires manquants' },
    { sel: 'Invoice > cac\\:InvoiceLine', msg: 'Lignes facture manquantes' },
  ];

  for (const c of checks) {
    if (!q(c.sel)) errors.push(c.msg);
  }

  if (errors.length > 0) return { valid: false, errors };

  // Vérifier ID
  const idEl = q('Invoice > cbc\\:ID');
  const id = idEl?.textContent?.trim();
  if (!id || id.length < 5) errors.push('ID facture trop court');

  // Vérifier type
  const typeEl = q('Invoice > cbc\\:InvoiceTypeCode');
  const type = typeEl?.textContent?.trim();
  if (!['380', '381'].includes(type)) errors.push(`Type facture invalide: "${type}" (attendu 380 ou 381)`);

  // Vérifier MF fournisseur
  const mfEl = q('cac\\:AccountingSupplierParty [schemeID="MF"]');
  const mf = mfEl?.textContent?.trim();
  if (!validerMF(mf)) errors.push(`MF fournisseur invalide: "${mf}"`);

  // Vérifier date
  const dateStr = q('Invoice > cbc\\:IssueDate')?.textContent?.trim();
  if (dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) errors.push(`Date invalide: "${dateStr}"`);
    else if (d > new Date()) errors.push('Date d\'émission dans le futur');
  }

  // Vérifier montants
  const taxableEl = q('cbc\\:LineExtensionAmount');
  const payableEl = q('cbc\\:PayableAmount');

  if (taxableEl && payableEl) {
    const ht = parseFloat(taxableEl.getAttribute('currencyID') === 'TND' ? taxableEl.textContent : '0');
    const ttc = parseFloat(payableEl.textContent);
    if (ttc < ht) errors.push('Total TTC inférieur au total HT');
  }

  // Vérifier lignes
  const lineEls = qa('cac\\:InvoiceLine');
  if (lineEls.length === 0) errors.push('Aucune ligne facture');

  lineEls.forEach((line, i) => {
    const qte = q('cbc\\:InvoicedQuantity', line);
    const pu = q('cbc\\:PriceAmount', line);
    const name = q('cac\\:Item > cbc\\:Name', line);
    if (!name?.textContent?.trim()) errors.push(`Ligne ${i + 1}: désignation manquante`);
    if (qte) {
      const q = parseFloat(qte.textContent);
      if (q <= 0) errors.push(`Ligne ${i + 1}: quantité <= 0 (${q})`);
      if (q > 999999) errors.push(`Ligne ${i + 1}: quantité anormale (${q})`);
    }
    if (pu) {
      const p = parseFloat(pu.textContent);
      if (p < 0) errors.push(`Ligne ${i + 1}: prix négatif`);
    }
    const taxCat = q('cac\\:TaxCategory > cbc\\:Percent', line);
    if (taxCat) {
      const rate = parseInt(taxCat.textContent);
      if (!TVA_RATES.includes(rate)) errors.push(`Ligne ${i + 1}: taux TVA invalide ${rate}`);
    }
  });

  // Vérifier QR code
  const qrEl = q('ttn\\:QRCodeData');
  if (!qrEl?.textContent?.trim()) errors.push('QR code data manquant');

  return { valid: errors.length === 0, errors };
}

// ══════════════════════════════════════════════════
// 3. PREPARE FOR SIGNATURE (XAdES-BES)
// ══════════════════════════════════════════════════

export function prepareForSignature(xmlString) {
  if (!xmlString) throw new Error('XML string required');

  let doc;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(xmlString, 'application/xml');
    const err = doc.querySelector('parsererror');
    if (err) throw new Error(`Parse error: ${err.textContent}`);
  } catch (e) {
    throw new Error(`Cannot parse XML: ${e.message}`);
  }

  // Retirer la signature existante (placeholder) pour canoniser seulement le contenu facture
  const sigParent = doc.querySelector('ext\\:UBLExtensions');
  const sigExtensions = doc.querySelectorAll('ext\\:UBLExtension');
  if (sigParent && sigExtensions.length > 0) {
    // Garder la première extension (QR code/TTN), retirer la seconde (signature)
    while (sigParent.childNodes.length > 1) {
      sigParent.removeChild(sigParent.lastChild);
    }
    // Remplacer avec juste la première extension TTN
    const firstExt = sigExtensions[0];
    sigParent.innerHTML = '';
    sigParent.appendChild(firstExt.cloneNode(true));
  }

  // Canonicalisation: normalisation du DOM
  canonicalizeNode(doc);

  // Sérialiser
  const serializer = new XMLSerializer();
  const canonicalized = serializer.serializeToString(doc);

  // Calculer SHA-256
  const hashSHA256 = computeSHA256(canonicalized);

  return { canonicalized, hashSHA256 };
}

function canonicalizeNode(node) {
  // Normaliser les textes (collapser les whitespace)
  if (node.nodeType === 3) {
    node.textContent = node.textContent.replace(/\n\s*/g, '');
  }
  for (let i = 0; i < node.childNodes.length; i++) {
    canonicalizeNode(node.childNodes[i]);
  }
}

function computeSHA256(str) {
  // Web Crypto API — synchrone via Uint8Array
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  // Retourne une promesse; on force synchrone en utilisant crypto.subtle.digest
  // Mais comme c'est async, on retourne la promesse
  return crypto.subtle.digest('SHA-256', data).then(hash => {
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  });
}

// Version synchrone pour usage simple (retourne Promise)
export async function computeDigestSHA256(str) {
  return computeSHA256(str);
}

// ══════════════════════════════════════════════════
// 4. SEND TO TTN (Simulation / Production)
// ══════════════════════════════════════════════════

const TTN_CONFIG = {
  dev: {
    sftpHost: 'sandbox.ttn.tn',
    sftpPort: 22,
    sftpUser: 'dev_user',
    sftpPath: '/upload',
  },
  prod: {
    sftpHost: 'sftp.el-faatoora.ttn.tn',
    sftpPort: 22,
    sftpUser: null,
    sftpPath: '/factures',
  },
};

let ttnMode = 'dev';

export function setTTNMode(mode) {
  if (!['dev', 'prod'].includes(mode)) throw new Error('Mode TTN: dev ou prod');
  ttnMode = mode;
}

export function getTTNMode() {
  return ttnMode;
}

export function sendToTTN(signedXml, credentials = {}) {
  return new Promise((resolve, reject) => {
    if (!signedXml || typeof signedXml !== 'string' || signedXml.length < 100) {
      reject(new Error('XML signé invalide ou trop court'));
      return;
    }

    // Extraire ID depuis le XML
    let invoiceId = 'UNKNOWN';
    try {
      const match = signedXml.match(/<cbc:ID>([^<]+)<\/cbc:ID>/);
      if (match) invoiceId = match[1];
    } catch (_) {}

    if (ttnMode === 'dev') {
      const delay = credentials.delay || 1500;
      const shouldFail = credentials.failRate && Math.random() < credentials.failRate;

      setTimeout(() => {
        if (shouldFail) {
          reject(new Error('TTN: Erreur de connexion SFTP (timeout)'));
          return;
        }
        resolve({
          status: 'accepted',
          invoiceId,
          timestamp: new Date().toISOString(),
          receiptId: `TTN-${invoiceId}-${Date.now()}`,
          _simulated: true,
        });
      }, delay);
      return;
    }

    // Mode production: nécessite credentials réels
    if (!credentials.username || !credentials.password || !credentials.privateKey) {
      reject(new Error('TTN prod: credentials requis (username, password, privateKey)'));
      return;
    }

    // En production, on ferait un appel SFTP vers les serveurs TTN.
    // Actuellement non implémenté — nécessite une librairie SFTP côté serveur.
    reject(new Error('TTN prod: connexion SFTP non disponible côté client. Utilisez un backend API.'));
  });
}

// ══════════════════════════════════════════════════
// 5. HANDLE ACCEPTANCE
// ══════════════════════════════════════════════════

export function handleAcceptance(invoiceData, ttnResponse) {
  const status = ttnResponse?.status || 'pending';
  const invoiceId = ttnResponse?.invoiceId || invoiceData?.id || 'UNKNOWN';

  switch (status) {
    case 'accepted':
      const piece = createPieceComptable(invoiceData, ttnResponse);
      updateStock(invoiceData.lines || [], invoiceId);
      return { status: 'accepted', piece };

    case 'rejected':
      const code = ttnResponse?.errorCode || 'ERR_UNKNOWN';
      console.error(`[TEIF] Facture ${invoiceId} rejetée par TTN. Code: ${code}`);
      return { status: 'rejected', errorCode: code };

    case 'pending':
      return { status: 'pending', retryAfter: 30000 };

    default:
      console.warn(`[TEIF] Statut TTN inconnu: ${status}`);
      return { status: 'unknown', error: `Statut inconnu: ${status}` };
  }
}

// ══════════════════════════════════════════════════
// 6. CREATE PIECE COMPTABLE
// ══════════════════════════════════════════════════

export function createPieceComptable(invoiceData, ttnResponse) {
  if (!invoiceData) throw new Error('Données facture requises');

  const inv = invoiceData;
  const fournisseur = inv.supplier?.name || 'Fournisseur';
  const client = inv.customer?.name || '';
  const idFacture = inv.id || ttnResponse?.invoiceId || 'N/A';
  const categorie = inv.categorie_sce || inv.category || 'services_exterieurs';
  const compteFournisseur = getCompteFournisseur(categorie);
  const compteCharge = getCompteChargeParCategorie(categorie);

  // Détail des écritures
  const lignes = [];
  const montantHT = inv.totals?.baseHT || 0;
  const montantTVA = inv.totals?.totalTVA || 0;
  const montantFodec = inv.totals?.fodec || 0;
  const montantTimbre = inv.totals?.timbre || 1.000;
  const montantTTC = inv.totals?.totalTTC || (montantHT + montantTVA + montantFodec + montantTimbre);

  // Regrouper TVA par taux
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

  // Débit: Fournisseur (on doit payer)
  lignes.push({
    compte: compteFournisseur,
    libelle: `${fournisseur} — Facture ${idFacture}`,
    debit: formatMontant(montantTTC),
    credit: '0.000',
  });

  // Crédit: Charge (HT)
  lignes.push({
    compte: compteCharge,
    libelle: `Achat ${CATEGORIE_LABELS[categorie] || 'de biens/services'} — ${fournisseur}`,
    debit: '0.000',
    credit: formatMontant(montantHT),
  });

  // Crédit: TVA déductible par taux
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

  // Crédit: FODEC
  if (montantFodec > 0) {
    lignes.push({
      compte: getCompteFodec(),
      libelle: 'FODEC 1%',
      debit: '0.000',
      credit: formatMontant(montantFodec),
    });
  }

  // Crédit: Timbre fiscal
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
    reference_ttn: ttnResponse?.receiptId || null,
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

// ══════════════════════════════════════════════════
// 7. UPDATE STOCK
// ══════════════════════════════════════════════════

function getStockKey() {
  try {
    const id = localStorage.getItem('smart_comptable_current_id');
    return id ? `sc_stock_mouvements_${id}` : 'sc_stock_mouvements';
  } catch {
    return 'sc_stock_mouvements';
  }
}

function getStockMouvements() {
  try {
    return JSON.parse(localStorage.getItem(getStockKey())) || [];
  } catch {
    return [];
  }
}

function saveStockMouvements(mvmts) {
  try {
    localStorage.setItem(getStockKey(), JSON.stringify(mvmts));
  } catch (e) {
    console.warn('[TEIF] Stock: localStorage saturé', e);
  }
}

export function updateStock(lines, invoiceId) {
  if (!lines?.length) {
    console.warn('[TEIF] updateStock: aucune ligne');
    return [];
  }

  const mouvements = getStockMouvements();
  const nouveaux = [];

  for (const line of lines) {
    const designation = line.description || line.designation || 'Article';
    const quantite = line.quantity || 0;

    if (quantite <= 0) continue;

    const mvt = {
      id: `STK-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: new Date().toISOString(),
      reference_facture: invoiceId || 'N/A',
      designation,
      quantite: -quantite,
      type: 'sortie',
      prix_unitaire: line.unitPrice || 0,
      total: formatMontant(quantite * (line.unitPrice || 0)),
      notes: `Facture ${invoiceId} — ${designation}`,
    };

    mouvements.push(mvt);
    nouveaux.push(mvt);
  }

  saveStockMouvements(mouvements);

  return nouveaux;
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
// GÉNÉRATION QR CODE (données uniquement, pas l'image)
// ══════════════════════════════════════════════════

export function generateQRCodeData(invoiceId, supplierMF, date, totalTTC) {
  const raw = `MF:${supplierMF}|INV:${invoiceId}|DATE:${date.slice(0, 10)}|TTC:${formatMontant(totalTTC)}`;
  return { raw, encoded: btoa(raw) };
}

export function addStockEntry({ designation, quantite, prix_unitaire, notes }) {
  if (!designation || !quantite || quantite <= 0) return null;
  const mouvements = getStockMouvements();
  const mvt = {
    id: `STK-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date: new Date().toISOString(),
    reference_facture: 'MANUEL',
    designation: designation.trim(),
    quantite: Math.abs(quantite),
    type: 'entree',
    prix_unitaire: parseFloat(prix_unitaire) || 0,
    total: formatMontant(Math.abs(quantite) * (parseFloat(prix_unitaire) || 0)),
    notes: notes || `Entrée manuelle — ${designation.trim()}`,
  };
  mouvements.push(mvt);
  saveStockMouvements(mouvements);
  return mvt;
}

export function getStockSummary() {
  const mouvements = getStockMouvements();
  const summary = {};
  for (const m of mouvements) {
    const key = m.designation.toLowerCase().trim();
    if (!summary[key]) {
      summary[key] = { designation: m.designation, quantite: 0, valeur: 0, prix_unitaire: m.prix_unitaire || 0, derniere_entree: null, derniere_sortie: null };
    }
    if (m.type === 'entree') {
      summary[key].quantite += m.quantite;
      summary[key].valeur += m.quantite * (m.prix_unitaire || 0);
      if (!summary[key].derniere_entree || m.date > summary[key].derniere_entree) summary[key].derniere_entree = m.date;
    } else {
      summary[key].quantite -= m.quantite;
      if (!summary[key].derniere_sortie || m.date > summary[key].derniere_sortie) summary[key].derniere_sortie = m.date;
    }
  }
  return Object.values(summary).sort((a, b) => b.quantite - a.quantite);
}

// ══════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════

export { TEIF_VERSION, TVA_RATES, CATEGORIE_TO_COMPTE, CATEGORIE_LABELS };
export { getStockMouvements };
