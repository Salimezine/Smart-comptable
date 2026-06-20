import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateTEIFXML, validateTEIF } from './teifGenerator.js';

function setupMockLS(data = {}) {
  const store = { ...data };
  vi.stubGlobal('localStorage', {
    getItem: (key) => store[key] ?? null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (i) => Object.keys(store)[i],
  });
}

describe('generateTEIFXML', () => {
  beforeEach(() => {
    setupMockLS({
      'smart_comptable_companies': JSON.stringify({
        'comp-1': {
          companyDetails: {
            vatNumber: '1234567/X/A/000',
            name: 'Ma Société SARL',
            address: 'Tunis Centre 1001',
            rne: 'B1234562020',
          }
        }
      }),
      'smart_comptable_current_id': 'comp-1',
    });
  });

  it('returns error for null invoice', () => {
    const result = generateTEIFXML(null);
    expect(result.error).toBeTruthy();
    expect(result.xml).toBe('');
  });

  it('returns error for invoice without lignes', () => {
    const result = generateTEIFXML({ id: 'INV-001' });
    expect(result.error).toContain('ligne');
  });

  it('generates valid XML for a basic invoice', () => {
    const inv = {
      id: 'FAC-001',
      invoiceNumber: 'FAC-001',
      dateEmission: '2026-06-01',
      client: { nom: 'Client ABC', adresse: 'Sfax' },
      lignes: [
        { designation: 'Service test', quantite: 1, prixUnitaireHT: 100, tauxTVA: 19 }
      ]
    };
    const result = generateTEIFXML(inv);
    expect(result.error).toBeUndefined();
    expect(result.xml).toContain('<?xml version="1.0"');
    expect(result.xml).toContain('<cbc:ID>FAC-001</cbc:ID>');
    expect(result.xml).toContain('<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>');
    expect(result.xml).toContain('1234567/X/A/000');
    expect(result.xml).toContain('Ma Société SARL');
    expect(result.xml).toContain('Client ABC');
    expect(result.totalTTC).toBeCloseTo(119, 1);
    expect(result.qr).toBeTruthy();
  });

  it('supports invoice type 381 (credit note)', () => {
    const inv = {
      id: 'AV-001', type: '381', dateEmission: '2026-06-15',
      client: { nom: 'Client' },
      lignes: [{ designation: 'Avoir', quantite: 1, prixUnitaireHT: 50, tauxTVA: 19 }]
    };
    const result = generateTEIFXML(inv);
    expect(result.xml).toContain('<cbc:InvoiceTypeCode>381</cbc:InvoiceTypeCode>');
  });

  it('calculates multi-rate TVA correctly', () => {
    const inv = {
      id: 'FAC-002', dateEmission: '2026-06-01',
      client: { nom: 'Client' },
      lignes: [
        { designation: 'Produit 19%', quantite: 1, prixUnitaireHT: 100, tauxTVA: 19 },
        { designation: 'Produit 7%', quantite: 2, prixUnitaireHT: 50, tauxTVA: 7 },
      ]
    };
    const result = generateTEIFXML(inv);
    expect(result.totalTTC).toBeCloseTo(100*1.19 + 100*1.07, 1);
    expect(result.xml).toContain('Percent>19.000<');
    expect(result.xml).toContain('Percent>7.000<');
  });

  it('includes timbre fiscal when provided', () => {
    const inv = {
      id: 'FAC-003', dateEmission: '2026-06-01', timbre: 1,
      client: { nom: 'Client' },
      lignes: [{ designation: 'Produit', quantite: 1, prixUnitaireHT: 50, tauxTVA: 19 }]
    };
    const result = generateTEIFXML(inv);
    expect(result.totalTTC).toBeCloseTo(50*1.19 + 1, 1);
    expect(result.xml).toContain('TIMBRE_FISCAL');
    expect(result.xml).toContain('ChargeTotalAmount');
  });

  it('includes FODEC when flag is set on line', () => {
    const inv = {
      id: 'FAC-004', dateEmission: '2026-06-01',
      client: { nom: 'Client' },
      lignes: [{ designation: 'Produit', quantite: 1, prixUnitaireHT: 200, tauxTVA: 19, fodec: true }]
    };
    const result = generateTEIFXML(inv);
    expect(result.totalTTC).toBeCloseTo(200*1.19 + 2, 1);
    expect(result.xml).toContain('FODEC');
  });

  it('generates valid QR code data', () => {
    const inv = {
      id: 'FAC-005', dateEmission: '2026-07-01',
      client: { nom: 'Client' },
      lignes: [{ designation: 'Article', quantite: 1, prixUnitaireHT: 99.900, tauxTVA: 19 }]
    };
    const result = generateTEIFXML(inv);
    expect(result.qr).toBeTruthy();
    const decoded = atob(result.qr);
    expect(decoded).toContain('1234567/X/A/000');
    expect(decoded).toContain('FAC-005');
    expect(decoded).toContain('2026-07-01');
  });

  it('handles vatNumber at invoice level override', () => {
    setupMockLS({
      'smart_comptable_companies': JSON.stringify({
        'comp-1': { companyDetails: { name: 'Test' } }
      }),
      'smart_comptable_current_id': 'comp-1',
    });
    const inv = {
      id: 'INV-001', dateEmission: '2026-06-01',
      fournisseur: { matriculeFiscal: '7654321/Y/B/000', nom: 'Override SARL' },
      client: { nom: 'Client' },
      lignes: [{ designation: 'Test', quantite: 1, prixUnitaireHT: 10, tauxTVA: 19 }]
    };
    const result = generateTEIFXML(inv);
    expect(result.xml).toContain('7654321/Y/B/000');
    expect(result.xml).toContain('Override SARL');
  });
});

describe('validateTEIF', () => {
  it('rejects empty string', () => {
    const r = validateTEIF('');
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('rejects null', () => {
    expect(validateTEIF(null).valid).toBe(false);
  });

  it('detects missing ID', () => {
    const xml = '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"><cbc:IssueDate>2026-01-01</cbc:IssueDate></Invoice>';
    const r = validateTEIF(xml);
    expect(r.errors).toContain('ID facture manquant');
  });

  it('detects missing MF', () => {
    const xml = '<Invoice><cbc:ID>1</cbc:ID><cbc:IssueDate>2026-01-01</cbc:IssueDate>' +
      '<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>' +
      '<cac:AccountingSupplierParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="MF"></cbc:ID></cac:PartyIdentification></cac:Party></cac:AccountingSupplierParty>' +
      '<cac:AccountingCustomerParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="MF_CLIENT">1234567/X/A/000</cbc:ID></cac:PartyIdentification></cac:Party></cac:AccountingCustomerParty>' +
      '<cac:TaxTotal><cbc:TaxAmount>0</cbc:TaxAmount></cac:TaxTotal>' +
      '<cac:LegalMonetaryTotal><cbc:PayableAmount currencyID="TND">100.000</cbc:PayableAmount></cac:LegalMonetaryTotal>' +
      '<cac:InvoiceLine></cac:InvoiceLine></Invoice>';
    const r = validateTEIF(xml);
    expect(r.errors.some(e => e.includes('MF'))).toBe(true);
  });

  it('passes for a valid minimal XML', () => {
    const xml = '<?xml version="1.0"?><Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">' +
      '<cbc:ID>FAC-001</cbc:ID>' +
      '<cbc:IssueDate>2026-06-01</cbc:IssueDate>' +
      '<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>' +
      '<cac:AccountingSupplierParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="MF">1234567/X/A/000</cbc:ID></cac:PartyIdentification></cac:Party></cac:AccountingSupplierParty>' +
      '<cac:AccountingCustomerParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="MF_CLIENT">7654321/Y/B/000</cbc:ID></cac:PartyIdentification></cac:Party></cac:AccountingCustomerParty>' +
      '<cac:TaxTotal><cbc:TaxAmount>19.000</cbc:TaxAmount></cac:TaxTotal>' +
      '<cac:LegalMonetaryTotal><cbc:PayableAmount currencyID="TND">119.000</cbc:PayableAmount></cac:LegalMonetaryTotal>' +
      '<cac:InvoiceLine></cac:InvoiceLine></Invoice>';
    const r = validateTEIF(xml);
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
});
