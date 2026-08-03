-- ==========================================================================
--  Smart Comptable — Cloudflare D1 Schema (remplace Supabase)
--  Run:  wrangler d1 execute smart-comptable-d1 --local --file=./schema.sql
-- ==========================================================================

PRAGMA foreign_keys = ON;

-- --------------------------------------------------------------------------
-- AUTH / PROFILES
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nom           TEXT,
  prenom        TEXT,
  role          TEXT DEFAULT 'comptable',
  plan          TEXT DEFAULT 'free',
  actif         INTEGER DEFAULT 1,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- --------------------------------------------------------------------------
-- COMPANIES & MEMBERS
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
  id               TEXT PRIMARY KEY,
  owner_id         TEXT,
  name             TEXT,
  matricule_fiscal TEXT,
  adresse          TEXT,
  plan             TEXT DEFAULT 'free',
  settings         TEXT,
  created_at       TEXT DEFAULT (datetime('now')),
  updated_at       TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_companies_owner ON companies(owner_id);

CREATE TABLE IF NOT EXISTS company_members (
  company_id TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  role       TEXT DEFAULT 'admin',
  is_active  INTEGER DEFAULT 1,
  PRIMARY KEY (company_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_members_user ON company_members(user_id);

-- --------------------------------------------------------------------------
-- GENERIC DATA TABLES  (id + company_id + full JSON payload + timestamps)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS journal_entries (
  id         TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  data       TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS invoices (
  id         TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  data       TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS expenses (
  id         TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  data       TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS transactions (
  id         TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  data       TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS stock (
  id         TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  data       TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS stock_mouvements (
  id         TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  data       TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS pieces_comptables (
  id         TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  data       TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS employees (
  id         TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  data       TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS payroll_slips (
  id         TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  data       TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS clients (
  id         TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  data       TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS fournisseurs (
  id         TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  data       TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS tva_declarations (
  id         TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  data       TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS declarations_sociales (
  id         TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  data       TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS declarations_is (
  id         TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  data       TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS declaration_templates (
  id         TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  data       TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS fiscal_knowledge (
  id         TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  data       TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS ocr_learning (
  id         TEXT PRIMARY KEY,
  company_id TEXT,
  data       TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Company lookup indexes (one per data table)
CREATE INDEX IF NOT EXISTS idx_je_company      ON journal_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_inv_company     ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_exp_company     ON expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_txn_company     ON transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_company   ON stock(company_id);
CREATE INDEX IF NOT EXISTS idx_stockmov_company ON stock_mouvements(company_id);
CREATE INDEX IF NOT EXISTS idx_pieces_company  ON pieces_comptables(company_id);
CREATE INDEX IF NOT EXISTS idx_emp_company     ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_payroll_company ON payroll_slips(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_company ON clients(company_id);
CREATE INDEX IF NOT EXISTS idx_fourn_company   ON fournisseurs(company_id);
CREATE INDEX IF NOT EXISTS idx_tva_company     ON tva_declarations(company_id);
CREATE INDEX IF NOT EXISTS idx_soc_company     ON declarations_sociales(company_id);
CREATE INDEX IF NOT EXISTS idx_is_company      ON declarations_is(company_id);
CREATE INDEX IF NOT EXISTS idx_tmpl_company    ON declaration_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_company  ON fiscal_knowledge(company_id);
CREATE INDEX IF NOT EXISTS idx_ocr_company     ON ocr_learning(company_id);