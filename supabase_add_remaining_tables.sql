-- Stock items (auto-managed from invoices)
CREATE TABLE IF NOT EXISTS public.stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  designation TEXT NOT NULL DEFAULT '',
  quantite REAL DEFAULT 0,
  valeur_unitaire REAL DEFAULT 0,
  date_creation TIMESTAMPTZ DEFAULT NOW(),
  derniere_maj TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock movements (auto-managed + manual StockView)
CREATE TABLE IF NOT EXISTS public.stock_mouvements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  type TEXT DEFAULT 'entree' CHECK (type IN ('entree', 'sortie')),
  designation TEXT NOT NULL DEFAULT '',
  quantite REAL DEFAULT 0,
  prix_unitaire REAL DEFAULT 0,
  fournisseur TEXT DEFAULT '',
  date DATE DEFAULT CURRENT_DATE,
  reference TEXT DEFAULT '',
  delta REAL DEFAULT 0,
  timestamp BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pièces comptables
CREATE TABLE IF NOT EXISTS public.pieces_comptables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  journal TEXT DEFAULT '',
  reference TEXT DEFAULT '',
  ttn_id TEXT DEFAULT '',
  libelle TEXT DEFAULT '',
  lignes JSONB DEFAULT '[]'::jsonb,
  total_debit REAL DEFAULT 0,
  total_credit REAL DEFAULT 0,
  validated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_mouvements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pieces_comptables ENABLE ROW LEVEL SECURITY;

-- RLS policies for stock
DROP POLICY IF EXISTS "stock_member" ON public.stock;
CREATE POLICY "stock_member" ON public.stock
  FOR ALL USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_id = stock.company_id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "stock_mouvements_member" ON public.stock_mouvements;
CREATE POLICY "stock_mouvements_member" ON public.stock_mouvements
  FOR ALL USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_id = stock_mouvements.company_id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "pieces_comptables_member" ON public.pieces_comptables;
CREATE POLICY "pieces_comptables_member" ON public.pieces_comptables
  FOR ALL USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_id = pieces_comptables.company_id AND user_id = auth.uid()));

-- Grants
GRANT ALL ON public.stock TO authenticated;
GRANT ALL ON public.stock_mouvements TO authenticated;
GRANT ALL ON public.pieces_comptables TO authenticated;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.stock;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.stock_mouvements;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.pieces_comptables;
