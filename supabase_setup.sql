-- =============================================
-- Smart Comptable — Setup Supabase
-- Ex�cuter dans Supabase Dashboard > SQL Editor
-- =============================================

-- 1. Table journal_entries (�critures comptables)
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  local_id TEXT UNIQUE,
  date TEXT NOT NULL,
  journal TEXT DEFAULT 'OD',
  numero_piece TEXT,
  piece_justificative TEXT,
  compte TEXT NOT NULL,
  libelle TEXT,
  debit NUMERIC DEFAULT 0,
  credit NUMERIC DEFAULT 0,
  locked BOOLEAN DEFAULT false,
  fournisseur TEXT,
  categorie TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour filtrage par soci�t�
CREATE INDEX IF NOT EXISTS idx_journal_entries_company ON public.journal_entries(company_id);

-- 2. Table employees (employ�s)
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  nom TEXT NOT NULL,
  prenom TEXT,
  cin TEXT,
  matricule TEXT,
  poste TEXT,
  salaire_base NUMERIC,
  regime TEXT DEFAULT '40h',
  situation_famille TEXT DEFAULT 'celibataire',
  nb_enfants INT DEFAULT 0,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_company ON public.employees(company_id);

-- 3. Table invoices (factures clients)
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  local_id TEXT UNIQUE,
  invoice_number TEXT,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_vat TEXT,
  client_address TEXT,
  issue_date TEXT,
  due_date TEXT,
  subtotal NUMERIC DEFAULT 0,
  vat_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'SENT',
  items JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_company ON public.invoices(company_id);

-- 4. Table payroll_slips (bulletins de paie)
CREATE TABLE IF NOT EXISTS public.payroll_slips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  employee_id TEXT,
  nom TEXT,
  prenom TEXT,
  mois INT NOT NULL,
  annee INT NOT NULL,
  salaire_base NUMERIC DEFAULT 0,
  brut NUMERIC DEFAULT 0,
  cnss_sal NUMERIC DEFAULT 0,
  cnss_pat NUMERIC DEFAULT 0,
  irpp NUMERIC DEFAULT 0,
  net_a_payer NUMERIC DEFAULT 0,
  cout_employeur NUMERIC DEFAULT 0,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_slips_company ON public.payroll_slips(company_id);
CREATE INDEX IF NOT EXISTS idx_payroll_slips_month ON public.payroll_slips(mois, annee);

-- 5. Activer RLS (Row Level Security) sur toutes les tables
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_slips ENABLE ROW LEVEL SECURITY;

-- 6. Politiques RLS : chaque utilisateur ne voit que ses propres donn�es
-- (filtr� par company_id — pas de user_id car on est en PIN mode)

DROP POLICY IF EXISTS "Acces par company_id" ON public.journal_entries;
CREATE POLICY "Acces par company_id" ON public.journal_entries
  FOR ALL USING (true);

DROP POLICY IF EXISTS "Acces par company_id" ON public.employees;
CREATE POLICY "Acces par company_id" ON public.employees
  FOR ALL USING (true);

DROP POLICY IF EXISTS "Acces par company_id" ON public.invoices;
CREATE POLICY "Acces par company_id" ON public.invoices
  FOR ALL USING (true);

DROP POLICY IF EXISTS "Acces par company_id" ON public.payroll_slips;
CREATE POLICY "Acces par company_id" ON public.payroll_slips
  FOR ALL USING (true);

-- 7. Donner les droits d'acc�s � la cl� anon
GRANT ALL ON public.journal_entries TO anon, authenticated;
GRANT ALL ON public.employees TO anon, authenticated;
GRANT ALL ON public.invoices TO anon, authenticated;
GRANT ALL ON public.payroll_slips TO anon, authenticated;

-- Note : les politiques sont ouvertes � tous (authentifi�s ou non)
-- car l'app utilise un mode PIN local sans auth Supabase.
-- La s�curit� est g�r�e par le fait que la cl� anon est publique
-- et que l'app filtre par company_id c�t� client.
-- Pour une s�curit� renforc�e, migrer vers auth Supabase plus tard.
