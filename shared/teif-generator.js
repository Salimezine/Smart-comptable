/**
 * teif-generator.js — Générateur XML TEIF partagé (client + worker)
 *
 * Pure JS — zéro dépendance navigateur/Node.
 * La config (MF, nom, adresse) est passée explicitement, pas de localStorage.
 *
 * Exporte:
 *   generateTEIFXML(invoice, config) → { xml, qr, totalTTC, internalId, error? }
 *   validateTEIF(xmlString)           → { valid, errors }
 *   esc(str), fmt3(n), makeId()
 */

export function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function fmt3(n) {
  const v = parseFloat(n) || 0;
  return v.toFixed(3);
}

export function makeId() {
  const now = new Date();
  const ds = now.toISOString().slice(0, 10).replace(/-/g, '');
  const r = Date.now().toString(36).toUpperCase();
  return `${ds}-${r}`;
}

function taxExemptionCode(taux) {
  const t0 = parseFloat(taux); const t = (t0 === 0) ? 0 : (t0 || 19);
  return t === 0 ? 'E' : 'S';
}

function qrData(mf, invId, date, ttc) {
  try {
    return btoa(`${mf}|${invId}|${date}|${fmt3(ttc)}`);
  } catch {
    return '';
  }
}

/**
 * @param {object} invoice
 * @param {object} invoice.fournisseur  - { matriculeFiscal, nom, adresse, rne }
 * @param {object} invoice.client      - { matriculeFiscal, nom, adresse }
 * @param {Array}  invoice.lignes      - [{ designation, quantite, prixUnitaireHT, tauxTVA, fodec }]
 * @param {string} invoice.id
 * @param {string} invoice.dateEmission
 * @param {string} invoice.type        - '380' ou '381'
 * @param {number} invoice.timbre
 *
 * @param {object} [config]            - override supplier if invoice.fournisseur is incomplete
 * @param {string} config.matriculeFiscal
 * @param {string} config.nom
 * @param {string} config.adresse
 * @param {string} config.rne
 */
export function generateTEIFXML(invoice, config) {
  try {
    if (!invoice) throw new Error('Facture requise');

    const invF = invoice.fournisseur || {};
    const cfg = config || {};
    const fournisseur = {
      matriculeFiscal: invF.matriculeFiscal || cfg.matriculeFiscal || cfg.mf || '',
      nom: invF.nom || cfg.nom || cfg.raisonSociale || '',
      adresse: invF.adresse || cfg.adresse || '',
      rne: invF.rne || cfg.rne || '',
    };
    const client = invoice.client || {};

    const lignes = (Array.isArray(invoice.lignes) ? invoice.lignes : [])
      .filter(l => l && l.designation && (parseFloat(l.quantite) || 0) > 0 && (parseFloat(l.prixUnitaireHT) || 0) > 0);

    if (lignes.length === 0) throw new Error('Aucune ligne article valide — au moins une ligne avec désignation, quantité > 0 et prix > 0');

    if (!fournisseur.matriculeFiscal) throw new Error('MF fournisseur manquant — configurez votre Matricule Fiscal dans Configuration');

    const baseHT = lignes.reduce((s, l) => s + (parseFloat(l.quantite) || 0) * (parseFloat(l.prixUnitaireHT) || 0), 0);

    const tvaGroups = {};
    let fodecTotal = 0;
    lignes.forEach(l => {
      const r = parseFloat(l.tauxTVA); const taux = (r === 0) ? 0 : (r || 19);
      const ht = (parseFloat(l.quantite) || 0) * (parseFloat(l.prixUnitaireHT) || 0);
      const mtva = ht * taux / 100;
      if (!tvaGroups[taux]) tvaGroups[taux] = 0;
      tvaGroups[taux] += mtva;
      if (l.fodec) fodecTotal += ht * 0.01;
    });
    const totalTVA = Object.values(tvaGroups).reduce((s, v) => s + v, 0);

    const timbre = parseFloat(invoice.timbre) || 0;
    const totalTTC = baseHT + totalTVA + fodecTotal + timbre;

    const invId = invoice.id || invoice.numero || invoice.invoiceNumber || '';
    const dateEmission = invoice.dateEmission || invoice.issueDate || new Date().toISOString().slice(0, 10);
    const type = invoice.type || '380';
    const intId = makeId();

    const mfFournisseur = fournisseur.matriculeFiscal;
    const qr = qrData(mfFournisseur, invId, dateEmission, totalTTC);

    function tvaBlock() {
      const subs = Object.entries(tvaGroups)
        .filter(([, v]) => v > 0.001)
        .map(([taux, mt]) => {
          const code = taxExemptionCode(taux);
          return `
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="TND">${fmt3(baseHT)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="TND">${fmt3(mt)}</cbc:TaxAmount>
        <cbc:Percent>${fmt3(parseFloat(taux))}</cbc:Percent>
        <cac:TaxCategory>
          <cbc:TaxExemptionReasonCode>${code}</cbc:TaxExemptionReasonCode>
          <cbc:Percent>${fmt3(parseFloat(taux))}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>`;
        }).join('');
      const fodec = fodecTotal > 0.001 ? `
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="TND">${fmt3(baseHT)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="TND">${fmt3(fodecTotal)}</cbc:TaxAmount>
        <cbc:Percent>1.000</cbc:Percent>
        <cac:TaxCategory>
          <cbc:ID>FODEC</cbc:ID>
          <cbc:Percent>1.000</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>FODEC</cbc:ID>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>` : '';
      return subs + fodec;
    }

    function linesBlock() {
      return lignes.map((l, i) => {
        const qte = parseFloat(l.quantite) || 1;
        const pu = parseFloat(l.prixUnitaireHT) || 0;
        const ttotal = qte * pu;
        return `
      <cac:InvoiceLine>
        <cbc:ID>${i + 1}</cbc:ID>
        <cac:Item>
          <cbc:Name>${esc(l.designation || 'Prestation')}</cbc:Name>
          <cac:SellersItemIdentification>
            <cbc:ID>${i + 1}</cbc:ID>
          </cac:SellersItemIdentification>
        </cac:Item>
        <cbc:InvoicedQuantity unitCode="C62">${fmt3(qte)}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="TND">${fmt3(ttotal)}</cbc:LineExtensionAmount>
        <cac:TaxTotal>
          <cbc:TaxAmount currencyID="TND">${fmt3(function(){const rr=parseFloat(l.tauxTVA);const t=(rr===0)?0:(rr||19);return ttotal*t/100;}())}</cbc:TaxAmount>
        </cac:TaxTotal>
        <cac:Price>
          <cbc:PriceAmount currencyID="TND">${fmt3(pu)}</cbc:PriceAmount>
        </cac:Price>
      </cac:InvoiceLine>`;
      }).join('');
    }

    function partyBlock(role) {
      const p = role === 'supplier' ? fournisseur : client;
      const mf = esc(p.matriculeFiscal || '');
      const nom = esc(p.nom || '');
      const adr = esc(p.adresse || '');
      const rne = esc(p.rne || '');
      const roleTag = role === 'supplier' ? 'AccountingSupplierParty' : 'AccountingCustomerParty';
      const idScheme = role === 'supplier' ? 'MF' : 'MF_CLIENT';
      return `
    <cac:${roleTag}>
      <cac:Party>
        <cac:PartyIdentification>
          <cbc:ID schemeID="${idScheme}">${mf}</cbc:ID>
        </cac:PartyIdentification>
        <cac:PartyName>
          <cbc:Name>${nom}</cbc:Name>
        </cac:PartyName>
        <cac:PostalAddress>
          <cbc:StreetName>${adr}</cbc:StreetName>
        </cac:PostalAddress>
        ${role === 'supplier' ? `
        <cac:PartyTaxScheme>
          <cbc:CompanyID>${mf}</cbc:CompanyID>
          <cac:TaxScheme>
            <cbc:ID>TVA</cbc:ID>
          </cac:TaxScheme>
        </cac:PartyTaxScheme>
        <cac:PartyLegalEntity>
          <cbc:RegistrationName>${nom}</cbc:RegistrationName>
          <cbc:CompanyID>${rne || mf}</cbc:CompanyID>
        </cac:PartyLegalEntity>` : ''}
      </cac:Party>
    </cac:${roleTag}>`;
    }

    const taxTotalAmount = totalTVA + fodecTotal;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
         xmlns:xades="http://uri.etsi.org/01903/v1.3.2#"
         xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>UBL-2.1-TEIF-1.0</cbc:CustomizationID>
  <cbc:ID>${esc(invId)}</cbc:ID>
  <cbc:IssueDate>${dateEmission}</cbc:IssueDate>
  <cbc:IssueTime>${new Date().toISOString().slice(11, 19)}</cbc:IssueTime>
  <cbc:InvoiceTypeCode>${esc(type)}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>TND</cbc:DocumentCurrencyCode>

  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionURI>urn:ttn:qr</ext:ExtensionURI>
      <ext:ExtensionContent>
        <ttn:QRCode xmlns:ttn="urn:ttn:qr">${esc(qr)}</ttn:QRCode>
      </ext:ExtensionContent>
    </ext:UBLExtension>
  </ext:UBLExtensions>

  ${partyBlock('supplier')}
  ${partyBlock('customer')}

  ${linesBlock()}

  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="TND">${fmt3(taxTotalAmount)}</cbc:TaxAmount>
    ${tvaBlock()}
  </cac:TaxTotal>

  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="TND">${fmt3(baseHT)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="TND">${fmt3(baseHT)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="TND">${fmt3(baseHT + taxTotalAmount)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="TND">0.000</cbc:AllowanceTotalAmount>
    <cbc:ChargeTotalAmount currencyID="TND">${fmt3(timbre)}</cbc:ChargeTotalAmount>
    <cbc:PrepaidAmount currencyID="TND">0.000</cbc:PrepaidAmount>
    ${timbre > 0 ? `
    <cac:AllowanceCharge>
      <cbc:ChargeIndicator>true</cbc:ChargeIndicator>
      <cbc:AllowanceChargeReason>TIMBRE_FISCAL</cbc:AllowanceChargeReason>
      <cbc:Amount currencyID="TND">${fmt3(timbre)}</cbc:Amount>
    </cac:AllowanceCharge>` : ''}
    <cbc:PayableAmount currencyID="TND">${fmt3(totalTTC)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>`;

    return { xml, qr, totalTTC, internalId: intId };
  } catch (e) {
    return { xml: '', qr: '', totalTTC: 0, internalId: '', error: e.message };
  }
}

export function validateTEIF(xmlString) {
  try {
    if (!xmlString || typeof xmlString !== 'string') {
      return { valid: false, errors: ['XML vide ou invalide'] };
    }

    const errors = [];

    if (!xmlString.includes('<cbc:ID>')) errors.push('ID facture manquant');
    if (!xmlString.includes('<cbc:IssueDate>')) errors.push("Date d'émission manquante");
    if (!xmlString.includes('<cbc:InvoiceTypeCode>')) errors.push('Type facture manquant');
    if (!xmlString.includes('AccountingSupplierParty')) errors.push('Fournisseur (AccountingSupplierParty) manquant');
    if (!xmlString.includes('AccountingCustomerParty')) errors.push('Client (AccountingCustomerParty) manquant');
    if (!xmlString.includes('<cac:LegalMonetaryTotal>')) errors.push('Totaux monétaires (LegalMonetaryTotal) manquants');
    if (!xmlString.includes('<cac:TaxTotal>')) errors.push('Totaux TVA (TaxTotal) manquants');
    if (!xmlString.includes('<cac:InvoiceLine>')) errors.push('Lignes facture (InvoiceLine) manquantes');
    if (!xmlString.includes('<cbc:PayableAmount')) errors.push('Montant TTC (PayableAmount) manquant');

    const mfMatch = xmlString.match(/<cbc:ID schemeID="MF">([^<]+)<\/cbc:ID>/);
    const mf = mfMatch ? mfMatch[1].trim() : '';
    if (!mf) {
      errors.push('MF fournisseur manquant → Allez dans Configuration > Matricule Fiscal (MF) et saisissez votre MF (ex: 1234567/X/A/000)');
    } else if (!/^\d{6,7}\/[A-Z](\/[A-Z]){0,2}\/\d{3}$/.test(mf)) {
      errors.push(`MF fournisseur "${mf}" invalide — format attendu: 1234567/X/A/000 ou 1234567/X/A/M/000 (7 chiffres + barres + 1-3 lettres + barre + 3 chiffres)`);
    }

    const clientMfMatch = xmlString.match(/<cbc:ID schemeID="MF_CLIENT">([^<]+)<\/cbc:ID>/);
    const clientMf = clientMfMatch ? clientMfMatch[1].trim() : '';
    if (clientMf && !/^\d{6,7}\/[A-Z](\/[A-Z]){0,2}\/\d{3}$/.test(clientMf)) {
      errors.push(`MF client "${clientMf}" invalide — format attendu: 1234567/X/A/000 ou 1234567/X/A/M/000`);
    }

    const ttcMatch = xmlString.match(/<cbc:PayableAmount[^>]*>([^<]+)<\/cbc:PayableAmount>/);
    if (ttcMatch) {
      const ttc = parseFloat(ttcMatch[1]);
      if (isNaN(ttc) || ttc <= 0) errors.push('Total TTC doit être > 0');
    }

    const lineCount = (xmlString.match(/<cac:InvoiceLine>/g) || []).length;
    if (lineCount === 0) errors.push('Aucune ligne article dans le XML');

    return { valid: errors.length === 0, errors };
  } catch {
    return { valid: false, errors: ["Erreur de validation XML inattendue"] };
  }
}
