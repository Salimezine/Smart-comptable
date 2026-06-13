/**
 * teifGenerator.js — Génération XML TEIF v1.8.8
 *
 * Conforme au standard TTN El Fatoora (Tunisie)
 * Pure JS navigateur — zéro dépendance externe
 */

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmt3(n) {
  const v = parseFloat(n) || 0;
  return v.toFixed(3);
}

function makeId() {
  const now = new Date();
  const ds = now.toISOString().slice(0, 10).replace(/-/g, '');
  const r = Date.now().toString(36).toUpperCase();
  return `${ds}-${r}`;
}

function readConfig() {
  try {
    const c1 = JSON.parse(localStorage.getItem('smart_config') || '{}');
    const c2 = JSON.parse(localStorage.getItem('smart_entreprise') || '{}');
    const c3 = JSON.parse(localStorage.getItem('entreprise') || '{}');

    // Read from the actual company data store (Smart Comptable v2+)
    const currentId = localStorage.getItem('smart_comptable_current_id');
    let c4 = {};
    if (currentId) {
      try {
        const all = JSON.parse(localStorage.getItem('smart_comptable_companies') || '{}');
        const company = all[currentId];
        if (company?.companyDetails) {
          const d = company.companyDetails;
          c4 = {
            matriculeFiscal: d.vatNumber || d.matriculeFiscal || '',
            mf: d.vatNumber || d.matriculeFiscal || '',
            raisonSociale: d.name || d.companyName || '',
            nom: d.name || d.companyName || '',
            name: d.name || d.companyName || '',
            adresse: d.address || '',
            address: d.address || '',
            rne: d.rne || '',
            RNE: d.rne || '',
            ttnCategoryCode: d.ttnCategoryCode || '43211000',
          };
        }
      } catch {}
    }

    return { ...c3, ...c2, ...c1, ...c4 };
  } catch {
    return {};
  }
}

function resolveFournisseur(invoice) {
  const invF = invoice.fournisseur || {};
  const cfg = readConfig();
  return {
    matriculeFiscal: invF.matriculeFiscal || cfg.matriculeFiscal || cfg.mf || cfg.MF || '',
    nom: invF.nom || cfg.raisonSociale || cfg.nom || cfg.name || '',
    adresse: invF.adresse || cfg.adresse || cfg.address || '',
    rne: invF.rne || cfg.rne || cfg.RNE || '',
  };
}

function taxExemptionCode(taux) {
  const t = parseFloat(taux) || 19;
  if (t === 0) return 'E';
  return 'S';
}

function qrData(mf, invId, date, ttc) {
  try {
    return btoa(`${mf}|${invId}|${date}|${fmt3(ttc)}`);
  } catch {
    return '';
  }
}

export function generateTEIFXML(invoice) {
  try {
    if (!invoice) throw new Error('Facture requise');

    const fournisseur = resolveFournisseur(invoice);
    const client = invoice.client || {};

    const lignes = (Array.isArray(invoice.lignes) ? invoice.lignes : [])
      .filter(l => l && l.designation && (parseFloat(l.quantite) || 0) > 0 && (parseFloat(l.prixUnitaireHT) || 0) > 0);

    if (lignes.length === 0) throw new Error('Aucune ligne article valide — au moins une ligne avec désignation, quantité > 0 et prix > 0');

    if (!fournisseur.matriculeFiscal) throw new Error('MF fournisseur manquant — configurez votre Matricule Fiscal dans Configuration');

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

    const invId = invoice.id || invoice.numero || invoice.invoiceNumber || '',
      dateEmission = invoice.dateEmission || invoice.issueDate || new Date().toISOString().slice(0, 10),
      type = invoice.type || '380',
      intId = makeId();

    const mfFournisseur = fournisseur.matriculeFiscal;
    const qr = qrData(mfFournisseur, invId, dateEmission, totalTTC);

    function tvaBlock() {
      return Object.entries(tvaGroups)
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
          <cbc:TaxAmount currencyID="TND">${fmt3(ttotal * (parseFloat(l.tauxTVA) || 19) / 100)}</cbc:TaxAmount>
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

    const note = invoice.note ? `
  <cac:InvoiceLine>
    <cbc:ID>0</cbc:ID>
    <cbc:Note>${esc(invoice.note)}</cbc:Note>
  </cac:InvoiceLine>` : '';

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>TEIF-1.8.8</cbc:CustomizationID>
  <cbc:ID>${esc(invId)}</cbc:ID>
  <cbc:IssueDate>${dateEmission}</cbc:IssueDate>
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
  ${note}
  ${linesBlock()}

  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="TND">${fmt3(totalTVA)}</cbc:TaxAmount>
    ${tvaBlock()}
  </cac:TaxTotal>

  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="TND">${fmt3(baseHT)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="TND">${fmt3(baseHT)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="TND">${fmt3(baseHT + totalTVA)}</cbc:TaxInclusiveAmount>
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
    } else if (!/^\d{6,7}\/[A-Z]/.test(mf)) {
      errors.push(`MF fournisseur "${mf}" invalide — format attendu: 1234567/X/A/000 (7 chiffres + barre + lettre + barre + lettre + barre + 3 chiffres)`);
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

export function downloadTEIFXML(xmlString, invoiceId) {
  try {
    if (!xmlString) return;
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `TEIF-${invoiceId || 'facture'}-${date}.xml`;
    const blob = new Blob([xmlString], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    /* silencieux */
  }
}
