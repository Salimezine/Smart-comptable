import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  try {
    const { invoice_id } = await req.json()
    if (!invoice_id) throw new Error('invoice_id requis')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const { data: inv, error: fetchError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoice_id)
      .single()
    if (fetchError || !inv) throw new Error('Facture non trouvée')

    const invoiceNumber = inv.invoice_number || inv.invoiceNumber || invoice_id
    const issueDate = inv.issue_date || inv.issueDate || new Date().toISOString().split('T')[0]
    const clientName = inv.client_name || inv.clientName || ''
    const clientVat = inv.client_vat || inv.clientVat || ''
    const totalHT = inv.subtotal || 0
    const totalTVA = inv.vat_amount || inv.vatAmount || 0
    const totalTTC = inv.total_amount || inv.totalAmount || 0
    const currency = 'TND'
    const documentId = `TEIF-${invoiceNumber}-${Date.now()}`

    const teifXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:ID>${invoiceNumber}</cbc:ID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${inv.company_tax_id || inv.matricule_fiscal || ''}</cbc:CompanyID>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>${clientName}</cbc:Name>
      </cac:PartyName>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${clientVat}</cbc:CompanyID>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${currency}">${totalHT}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${currency}">${totalHT}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${currency}">${totalTTC}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${currency}">${totalTTC}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${currency}">${totalTVA}</cbc:TaxAmount>
  </cac:TaxTotal>
</Invoice>`

    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        teif_status: 'PENDING',
        teif_xml: teifXml,
        middleware_document_id: documentId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice_id)
    if (updateError) throw updateError

    return new Response(
      JSON.stringify({
        success: true,
        document_id: documentId,
        status: 'PENDING',
        xml_preview: teifXml.substring(0, 500),
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
