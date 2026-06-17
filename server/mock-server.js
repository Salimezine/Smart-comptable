import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, 'data.json');
const JWT_SECRET = 'mock-secret-smart-comptable-dev';
const PORT = 4000;

function readData() {
  if (!existsSync(DATA_FILE)) return { companies: [], invoices: [], users: [] };
  return JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
}

function writeData(data) {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token manquant' });
  }
  try {
    jwt.verify(auth.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Token invalide' });
  }
}

app.get('/api/auth/dev-token', (_req, res) => {
  const token = jwt.sign({ userId: 'dev-user', email: 'dev@local.host', role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, setup: `localStorage.setItem("smart_api_token","${token}");fetch("/api/seed-defaults")` });
});

app.get('/api/seed-defaults', (_req, res) => {
  const data = readData();
  if (data.companies.length === 0) {
    data.companies.push({ id: 'default-company', user_id: 'dev-user', name: 'Ma Société', tax_id: '1234567/X/A/M/000', address: 'Tunis', category_code: null, rne: null, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  }
  writeData(data);
  res.json({ ok: true, companies: data.companies.length, invoices: data.invoices.length });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const data = readData();
  let user = data.users.find(u => u.email === email);
  if (!user && email && password) {
    user = { id: randomUUID(), email, name: email.split('@')[0], role: 'admin' };
    data.users.push(user);
    writeData(data);
  }
  if (!user) return res.status(401).json({ message: 'Identifiants invalides' });
  const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

app.get('/api/companies', authMiddleware, (req, res) => {
  const data = readData();
  res.json(data.companies);
});

app.get('/api/invoices/company/:companyId', authMiddleware, (req, res) => {
  const data = readData();
  const invoices = data.invoices.filter(inv => inv.company_id === req.params.companyId);
  res.json(invoices);
});

app.get('/api/invoices/:id', authMiddleware, (req, res) => {
  const data = readData();
  const inv = data.invoices.find(i => i.id === req.params.id);
  if (!inv) return res.status(404).json({ message: 'Facture non trouvée' });
  res.json(inv);
});

app.post('/api/invoices/:id/submit', authMiddleware, (req, res) => {
  const data = readData();
  const idx = data.invoices.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Facture non trouvée' });

  const inv = data.invoices[idx];
  const documentId = `TEIF-${inv.invoice_number}-${Date.now()}`;
  const teifXml = `<?xml version="1.0"?><Invoice><ID>${inv.invoice_number}</ID><IssueDate>${inv.issue_date}</IssueDate></Invoice>`;

  data.invoices[idx] = {
    ...inv,
    teif_status: 'PENDING',
    teif_xml: teifXml,
    middleware_document_id: documentId,
    updated_at: new Date().toISOString(),
  };
  writeData(data);

  setTimeout(() => {
    const d = readData();
    const i = d.invoices.findIndex(x => x.id === req.params.id);
    if (i !== -1) {
      d.invoices[i].teif_status = 'ACCEPTED';
      writeData(d);
    }
  }, 15000);

  res.json({ documentId, signatureUrl: null, status: 'PENDING' });
});

app.post('/api/invoices/:id/sync-teif-status', authMiddleware, (req, res) => {
  const data = readData();
  const inv = data.invoices.find(i => i.id === req.params.id);
  if (!inv) return res.status(404).json({ message: 'Facture non trouvée' });
  res.json({ status: inv.teif_status || 'NONE', documentId: inv.middleware_document_id });
});

app.post('/api/seed', authMiddleware, (req, res) => {
  const { company, invoices } = req.body;
  const data = readData();

  if (company) {
    const existing = data.companies.findIndex(c => c.id === company.id);
    if (existing !== -1) data.companies[existing] = { ...data.companies[existing], ...company };
    else data.companies.push(company);
  }

  if (invoices && Array.isArray(invoices)) {
    for (const inv of invoices) {
      const existing = data.invoices.findIndex(i => i.id === inv.id || i.invoice_number === inv.invoiceNumber);
      if (existing !== -1) {
        data.invoices[existing] = {
          ...data.invoices[existing],
          invoice_number: inv.invoiceNumber || inv.invoice_number,
          client_name: inv.clientName || inv.client_name,
          client_tax_id: inv.clientVat || inv.client_tax_id || '',
          issue_date: inv.issueDate || inv.issue_date || inv.date,
          teif_status: data.invoices[existing].teif_status || 'NONE',
          company_id: company?.id || data.invoices[existing].company_id || 'default',
          lines: inv.items || inv.lines || [],
          totals: { subtotalHT: { amount: inv.subtotal || 0, currency: 'TND' }, totalTax: { amount: inv.vatAmount || 0, currency: 'TND' }, totalTTC: { amount: inv.totalAmount || 0, currency: 'TND' } },
          status: 'VALIDATED',
        };
      } else {
        data.invoices.push({
          id: inv.id || randomUUID(),
          company_id: company?.id || 'default',
          invoice_number: inv.invoiceNumber || inv.invoice_number || `INV-${Date.now()}`,
          client_name: inv.clientName || inv.client_name || '',
          client_tax_id: inv.clientVat || inv.client_tax_id || '',
          issue_date: inv.issueDate || inv.issue_date || inv.date || new Date().toISOString().split('T')[0],
          lines: inv.items || inv.lines || [],
          totals: { subtotalHT: { amount: inv.subtotal || 0, currency: 'TND' }, totalTax: { amount: inv.vatAmount || 0, currency: 'TND' }, totalTTC: { amount: inv.totalAmount || 0, currency: 'TND' } },
          status: 'VALIDATED',
          teif_status: 'NONE',
          teif_xml: null,
          middleware_document_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }
  }

  writeData(data);
  res.json({ ok: true, companyCount: data.companies.length, invoiceCount: data.invoices.length });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'smart-comptable-mock', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Smart Comptable Mock API running on http://localhost:${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  POST /api/auth/login`);
  console.log(`  GET  /api/companies`);
  console.log(`  GET  /api/invoices/company/:companyId`);
  console.log(`  POST /api/invoices/:id/submit`);
  console.log(`  POST /api/invoices/:id/sync-teif-status`);
  console.log(`  POST /api/seed      (seed data from frontend)`);
});
