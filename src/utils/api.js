const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

let _token = localStorage.getItem('smart_api_token');

export function setApiToken(token) {
  _token = token;
  if (token) localStorage.setItem('smart_api_token', token);
  else localStorage.removeItem('smart_api_token');
}

export function getApiToken() {
  return _token;
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (_token) headers['Authorization'] = `Bearer ${_token}`;
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.text();
    let msg;
    try { msg = JSON.parse(body).message || body; } catch { msg = body; }
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.json();
}

export function getInvoices(companyId) {
  return request(`/invoices/company/${companyId}`);
}

export function getInvoice(id) {
  return request(`/invoices/${id}`);
}

export function submitInvoice(id, companyTaxId) {
  return request(`/invoices/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify({ companyTaxId }),
  });
}

export function syncTeifStatus(id) {
  return request(`/invoices/${id}/sync-teif-status`, { method: 'POST' });
}

export function getCompanies() {
  return request('/companies');
}

export function login(email, password) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}
