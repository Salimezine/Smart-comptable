export function mapInvoiceToMiddlewareDoc(teifInvoice, companyDetails = {}) {
  const fournisseur = teifInvoice.fournisseur || {};
  const client = teifInvoice.client || {};
  const lignes = (teifInvoice.lignes || []).filter(l => l && l.designation);

  const lines = lignes.map((l, i) => ({
    lineNumber: i + 1,
    description: l.designation || 'Prestation',
    quantity: parseFloat(l.quantite) || 1,
    unitPrice: { amount: parseFloat(l.prixUnitaireHT) || 0, currency: 'TND' },
    taxRate: (() => { const r = parseFloat(l.tauxTVA); return r === 0 ? 0 : r || 19; })(),
  }));

  const subtotalHT = lines.reduce((s, l) => s + l.quantity * l.unitPrice.amount, 0);
  const totalTax = lines.reduce((s, l) => s + l.quantity * l.unitPrice.amount * l.taxRate / 100, 0);
  const timbre = parseFloat(teifInvoice.timbre) || 0;
  const fodecTotal = lignes.reduce((s, l) => s + (l.fodec ? (parseFloat(l.quantite) || 0) * (parseFloat(l.prixUnitaireHT) || 0) * 0.01 : 0), 0);
  const totalTTC = subtotalHT + totalTax + fodecTotal + timbre;

  const allowances = [];
  if (timbre > 0) {
    allowances.push({ type: 'SURCHARGE', amount: { amount: timbre, currency: 'TND' }, description: 'Timbre fiscal' });
  }
  if (fodecTotal > 0) {
    allowances.push({ type: 'SURCHARGE', amount: { amount: fodecTotal, currency: 'TND' }, description: 'FODEC' });
  }

  const typeMap = { '380': 'INVOICE', '381': 'CREDIT_NOTE' };
  const docType = typeMap[teifInvoice.type] || 'INVOICE';

  let dueDate = null;
  if (teifInvoice.dueDate) {
    dueDate = teifInvoice.dueDate;
  } else if (teifInvoice.dateEmission) {
    const d = new Date(teifInvoice.dateEmission);
    d.setDate(d.getDate() + 60);
    dueDate = d.toISOString().slice(0, 10);
  }

  return {
    header: {
      documentNumber: teifInvoice.id || teifInvoice.invoiceNumber || '',
      issueDate: teifInvoice.dateEmission || new Date().toISOString().slice(0, 10),
      type: docType,
    },
    seller: {
      identifier: fournisseur.matriculeFiscal || companyDetails.vatNumber || '',
      identifierType: 'FISCAL_ID',
      name: fournisseur.nom || companyDetails.name || '',
      address: {
        street: fournisseur.adresse || companyDetails.address || '',
        city: '',
        country: 'TN',
      },
      contact: {
        email: companyDetails.email || '',
      },
    },
    buyer: {
      identifier: client.matriculeFiscal || '0000000X000000',
      identifierType: client.matriculeFiscal ? 'FISCAL_ID' : 'CIN',
      name: client.nom || 'Client',
      address: {
        street: client.adresse || '',
        city: '',
        country: 'TN',
      },
    },
    lines,
    totals: {
      subtotalHT: { amount: Math.round(subtotalHT * 1000) / 1000, currency: 'TND' },
      totalTax: { amount: Math.round(totalTax * 1000) / 1000, currency: 'TND' },
      totalTTC: { amount: Math.round(totalTTC * 1000) / 1000, currency: 'TND' },
    },
    paymentTerms: {
      method: 'BANK_TRANSFER',
      dueDate,
      iban: companyDetails.iban || '',
      bankName: '',
    },
    allowances: allowances.length > 0 ? allowances : undefined,
    metadata: {
      notes: `Généré via Smart Comptable — TTN ${teifInvoice.type === '381' ? 'Avoir' : 'Facture'} ${teifInvoice.id || ''}`,
    },
  };
}

export async function sendToMiddleware(document, config = {}) {
  const apiUrl = config.middlewareUrl || '';
  const apiToken = config.middlewareToken || '';

  if (!apiUrl) {
    return { status: 'error', errors: ['URL du middleware non configurée — configurez-la dans Configuration > Middleware'] };
  }

  const url = apiUrl.replace(/\/+$/, '') + '/v1/documents';

  const baseUrl = typeof window !== 'undefined' ? window.location.href.replace(/\?.*$/, '') : '';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiToken || '',
        'Authorization': apiToken ? `Bearer ${apiToken}` : '',
      },
      body: JSON.stringify({
        data: [{ invoice: document, pdf: '' }],
        successUrl: `${baseUrl}?teif_callback=success`,
        failureUrl: `${baseUrl}?teif_callback=failure`,
      }),
    });

    const body = await response.json();

    if (!response.ok) {
      const msg = body?.message || body?.error || `HTTP ${response.status}`;
      return { status: 'rejected', errors: [msg], httpStatus: response.status };
    }

    const mappedStatus = body.status === 'ACCEPTED' ? 'accepted' : (body.status === 'REJECTED' || body.status === 'SIGNING_FAILED' ? 'rejected' : 'pending');
    return {
      status: mappedStatus,
      message: body.message || 'Document envoyé au middleware pour signature',
      signatureUUID: body.signatureUUID || null,
      signatureUrl: body.signatureUrl || null,
      documentNumber: document.header.documentNumber,
      ttnId: body.ttnId || null,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return { status: 'error', errors: [err.message || 'Erreur réseau — middleware injoignable'] };
  }
}

export async function checkMiddlewareTTNHealth(config = {}) {
  const apiUrl = config.middlewareUrl || '';
  const apiToken = config.middlewareToken || '';
  if (!apiUrl) return { reachable: false, reason: 'Middleware URL not configured' };

  const url = apiUrl.replace(/\/+$/, '') + '/health/ttn';
  try {
    const res = await fetch(url, {
      headers: {
        'X-API-Key': apiToken || '',
        'Authorization': apiToken ? `Bearer ${apiToken}` : '',
      },
    });
    if (!res.ok) return { reachable: false, reason: `HTTP ${res.status}` };
    const data = await res.json();
    const soapReachable = data?.soap?.status === 'reachable';
    return {
      reachable: soapReachable,
      soap: data?.soap,
      sftp: data?.sftp,
      ttnHandlingMode: data?.ttn_handling_mode,
    };
  } catch {
    return { reachable: false, reason: 'Middleware unreachable' };
  }
}

export async function pollMiddlewareStatus(invoiceNumber, config = {}) {
  const apiUrl = config.middlewareUrl || '';
  const apiToken = config.middlewareToken || '';

  if (!apiUrl || !invoiceNumber) return null;

  const url = apiUrl.replace(/\/+$/, '') + '/v1/documents/status/' + encodeURIComponent(invoiceNumber);

  try {
    const response = await fetch(url, {
      headers: {
        'X-API-Key': apiToken || '',
        'Authorization': apiToken ? `Bearer ${apiToken}` : '',
      },
    });

    if (response.status === 404) return null;

    const body = await response.json();
    if (!response.ok) return null;

    const statusMap = {
      'RECEIVED': 'pending',
      'SIGNING_PENDING': 'pending',
      'TTN_PENDING': 'pending',
      'TTN_SUBMITTED': 'pending',
      'TTN_ACCEPTED': 'accepted',
      'TTN_REJECTED': 'rejected',
      'SIGNING_FAILED': 'rejected',
      'FAILED': 'rejected',
    };

    return {
      invoiceNumber: body.invoiceNumber || invoiceNumber,
      status: statusMap[body.status] || body.status?.toLowerCase() || 'pending',
      rawStatus: body.status,
      timestamp: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
