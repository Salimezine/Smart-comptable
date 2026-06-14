-- =============================================
-- Smart Comptable — Setup Supabase (Production)
-- Exécuter dans Supabase Dashboard > SQL Editor
-- =============================================

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- PROFILES (lié à auth.users de Supabase)
-- =============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  nom TEXT NOT NULL DEFAULT '',
  prenom TEXT DEFAULT '',
  role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'comptable', 'expert', 'lecture')),
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

-- =============================================
-- COMPANIES (Sociétés)
-- =============================================
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  matricule_fiscal TEXT DEFAULT '',
  adresse TEXT DEFAULT '',
  code_categorie TEXT DEFAULT '',
  rne TEXT DEFAULT '',
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- COMPANY MEMBERS (Membres d'une société)
-- =============================================
CREATE TABLE IF NOT EXISTS public.company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'comptable' CHECK (role IN ('admin', 'comptable', 'expert', 'lecture')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

-- =============================================
-- JOURNAL ENTRIES (Écritures comptables)
-- =============================================
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  local_id TEXT,
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_company ON public.journal_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON public.journal_entries(company_id, date);

-- =============================================
-- EMPLOYEES
-- =============================================
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  nom TEXT NOT NULL,
  prenom TEXT,
  cin TEXT,
  matricule TEXT,
  poste TEXT,
  salaire_base NUMERIC DEFAULT 0,
  regime TEXT DEFAULT '40h',
  situation_famille TEXT DEFAULT 'celibataire',
  nb_enfants INT DEFAULT 0,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_company ON public.employees(company_id);

-- =============================================
-- INVOICES (Factures clients)
-- =============================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  local_id TEXT,
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_company ON public.invoices(company_id);

-- =============================================
-- PAYROLL SLIPS (Bulletins de paie)
-- =============================================
CREATE TABLE IF NOT EXISTS public.payroll_slips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
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
CREATE INDEX IF NOT EXISTS idx_payroll_slips_month ON public.payroll_slips(company_id, mois, annee);

-- =============================================
-- EXPENSES (Dépenses / Achats)
-- =============================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  label TEXT,
  total_amount NUMERIC DEFAULT 0,
  date TEXT,
  category TEXT,
  supplier TEXT,
  vat_rate NUMERIC DEFAULT 19,
  matricule_fiscal TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_company ON public.expenses(company_id);

-- =============================================
-- TRANSACTIONS (Banque)
-- =============================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  label TEXT,
  description TEXT,
  amount NUMERIC DEFAULT 0,
  type TEXT CHECK (type IN ('income', 'expense', 'transfer')),
  reference TEXT,
  date TEXT,
  status TEXT DEFAULT 'PENDING',
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_company ON public.transactions(company_id);

-- =============================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_slips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES
-- =============================================

-- Profiles: chacun voit et modifie son propre profil
DROP POLICY IF EXISTS "profiles_self" ON public.profiles;
CREATE POLICY "profiles_self" ON public.profiles
  FOR ALL USING (auth.uid() = id);

-- Companies: un membre voit les sociétés dont il est membre
DROP POLICY IF EXISTS "companies_member_select" ON public.companies;
CREATE POLICY "companies_member_select" ON public.companies
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.company_members WHERE company_id = id AND user_id = auth.uid())
    OR owner_id = auth.uid()
  );

DROP POLICY IF EXISTS "companies_owner_insert" ON public.companies;
CREATE POLICY "companies_owner_insert" ON public.companies
  FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "companies_owner_update" ON public.companies;
CREATE POLICY "companies_owner_update" ON public.companies
  FOR UPDATE USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "companies_owner_delete" ON public.companies;
CREATE POLICY "companies_owner_delete" ON public.companies
  FOR DELETE USING (owner_id = auth.uid());

-- Company members: un membre voit les autres membres
DROP POLICY IF EXISTS "company_members_select" ON public.company_members;
CREATE POLICY "company_members_select" ON public.company_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.company_members cm2 WHERE cm2.company_id = company_id AND cm2.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "company_members_admin" ON public.company_members;
CREATE POLICY "company_members_admin" ON public.company_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.company_members cm2 WHERE cm2.company_id = company_id AND cm2.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "company_members_insert_owner" ON public.company_members;
CREATE POLICY "company_members_insert_owner" ON public.company_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "company_members_update_delete_admin" ON public.company_members;
CREATE POLICY "company_members_update_delete_admin" ON public.company_members
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.company_members cm2 WHERE cm2.company_id = company_id AND cm2.user_id = auth.uid() AND cm2.role = 'admin')
  );
CREATE POLICY "company_members_delete_admin" ON public.company_members
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.company_members cm2 WHERE cm2.company_id = company_id AND cm2.user_id = auth.uid() AND cm2.role = 'admin')
  );

-- Données métier: filtrées par company_id, l'utilisateur doit être membre
CREATE OR REPLACE FUNCTION public.user_is_member(company_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.company_members WHERE company_id = $1 AND user_id = auth.uid());
$$;

-- Journal entries
DROP POLICY IF EXISTS "journal_entries_member" ON public.journal_entries;
CREATE POLICY "journal_entries_member" ON public.journal_entries
  FOR ALL USING (public.user_is_member(company_id));

-- Employees
DROP POLICY IF EXISTS "employees_member" ON public.employees;
CREATE POLICY "employees_member" ON public.employees
  FOR ALL USING (public.user_is_member(company_id));

-- Invoices
DROP POLICY IF EXISTS "invoices_member" ON public.invoices;
CREATE POLICY "invoices_member" ON public.invoices
  FOR ALL USING (public.user_is_member(company_id));

-- Payroll slips
DROP POLICY IF EXISTS "payroll_slips_member" ON public.payroll_slips;
CREATE POLICY "payroll_slips_member" ON public.payroll_slips
  FOR ALL USING (public.user_is_member(company_id));

-- Expenses
DROP POLICY IF EXISTS "expenses_member" ON public.expenses;
CREATE POLICY "expenses_member" ON public.expenses
  FOR ALL USING (public.user_is_member(company_id));

-- Transactions
DROP POLICY IF EXISTS "transactions_member" ON public.transactions;
CREATE POLICY "transactions_member" ON public.transactions
  FOR ALL USING (public.user_is_member(company_id));

-- =============================================
-- GRANTS
-- =============================================
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.companies TO authenticated;
GRANT ALL ON public.company_members TO authenticated;
GRANT ALL ON public.journal_entries TO authenticated;
GRANT ALL ON public.employees TO authenticated;
GRANT ALL ON public.invoices TO authenticated;
GRANT ALL ON public.payroll_slips TO authenticated;
GRANT ALL ON public.expenses TO authenticated;
GRANT ALL ON public.transactions TO authenticated;

-- =============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nom, prenom)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nom', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'prenom', '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- AUTO-UPDATE TIMESTAMPS
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_journal_entries_updated_at BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_employees_updated_at BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
