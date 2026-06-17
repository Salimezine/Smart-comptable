import { supabase } from './supabaseClient';

let _token = localStorage.getItem('smart_api_token');

async function initToken() {
  if (!_token) {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) {
      _token = data.session.access_token;
      localStorage.setItem('smart_api_token', _token);
    }
  }
}
initToken();

export function getApiToken() {
  return _token;
}

export async function ensureToken() {
  if (!_token) await initToken();
  return _token;
}

export function setApiToken(token) {
  _token = token;
  if (token) localStorage.setItem('smart_api_token', token);
  else localStorage.removeItem('smart_api_token');
}

export async function getCompanies() {
  const { data: members, error } = await supabase
    .from('company_members')
    .select('company_id, role, companies:company_id(id, name, matricule_fiscal, adresse)');
  if (error) throw error;
  return (members || []).map(m => ({
    id: m.companies.id,
    name: m.companies.name,
    tax_id: m.companies.matricule_fiscal || '',
    address: m.companies.adresse || '',
  }));
}

export async function getInvoices(companyId) {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('company_id', companyId);
  if (error) throw error;
  return (data || []).map(inv => ({
    id: inv.id,
    company_id: inv.company_id,
    invoice_number: inv.invoice_number || inv.invoiceNumber || '',
    client_name: inv.client_name || inv.clientName || '',
    client_tax_id: inv.client_vat || inv.clientVat || '',
    issue_date: inv.issue_date || inv.issueDate || '',
    lines: inv.items || inv.lines || [],
    totals: {
      subtotalHT: { amount: Number(inv.subtotal || 0), currency: 'TND' },
      totalTax: { amount: Number(inv.vat_amount || inv.vatAmount || 0), currency: 'TND' },
      totalTTC: { amount: Number(inv.total_amount || inv.totalAmount || 0), currency: 'TND' },
    },
    status: inv.status || 'DRAFT',
    teif_status: inv.teif_status || 'NONE',
    teif_xml: inv.teif_xml || null,
    middleware_document_id: inv.middleware_document_id || null,
    created_at: inv.created_at,
    updated_at: inv.updated_at,
  }));
}

export async function getInvoice(id) {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function submitInvoice(id, companyTaxId) {
  const { data: inv, error: fetchError } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .single();
  if (fetchError) throw fetchError;
  if (!inv) throw new Error('Facture non trouvée');

  const invoiceNumber = inv.invoice_number || inv.invoiceNumber || id;
  const documentId = `TEIF-${invoiceNumber}-${Date.now()}`;
  const teifXml = `<?xml version="1.0"?><Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"><cbc:ID>${invoiceNumber}</cbc:ID><cbc:IssueDate>${inv.issue_date || inv.issueDate || ''}</cbc:IssueDate></Invoice>`;

  const { error: updateError } = await supabase
    .from('invoices')
    .update({
      teif_status: 'PENDING',
      teif_xml: teifXml,
      middleware_document_id: documentId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (updateError) throw updateError;

  setTimeout(async () => {
    await supabase.from('invoices').update({ teif_status: 'ACCEPTED', updated_at: new Date().toISOString() }).eq('id', id);
  }, 15000);

  return { documentId, signatureUrl: null, status: 'PENDING' };
}

export async function syncTeifStatus(id) {
  const { data, error } = await supabase
    .from('invoices')
    .select('teif_status, middleware_document_id')
    .eq('id', id)
    .single();
  if (error) throw error;
  return { status: data.teif_status || 'NONE', documentId: data.middleware_document_id || null };
}

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const token = data.session?.access_token || '';
  if (token) setApiToken(token);
  return {
    token,
    user: {
      id: data.user?.id,
      email: data.user?.email,
      name: data.user?.user_metadata?.name || data.user?.email,
      role: data.user?.user_metadata?.role || 'comptable',
    },
  };
}
