-- Drop and recreate with camelCase columns (no data to lose)
DROP TABLE IF EXISTS public.stock_mouvements CASCADE;
DROP TABLE IF EXISTS public.stock CASCADE;
DROP TABLE IF EXISTS public.pieces_comptables CASCADE;

CREATE TABLE public.stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  designation TEXT NOT NULL DEFAULT '',
  quantite REAL DEFAULT 0,
  valeurUnitaire REAL DEFAULT 0,
  dateCreation TIMESTAMPTZ DEFAULT NOW(),
  derniereMaj TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.stock_mouvements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  type TEXT DEFAULT 'entree' CHECK (type IN ('entree', 'sortie')),
  designation TEXT NOT NULL DEFAULT '',
  quantite REAL DEFAULT 0,
  prixUnitaire REAL DEFAULT 0,
  fournisseur TEXT DEFAULT '',
  date DATE DEFAULT CURRENT_DATE,
  reference TEXT DEFAULT '',
  delta REAL DEFAULT 0,
  timestamp BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.pieces_comptables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  journal TEXT DEFAULT '',
  reference TEXT DEFAULT '',
  ttnId TEXT DEFAULT '',
  libelle TEXT DEFAULT '',
  lignes JSONB DEFAULT '[]'::jsonb,
  totalDebit REAL DEFAULT 0,
  totalCredit REAL DEFAULT 0,
  validated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_mouvements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pieces_comptables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_member" ON public.stock;
CREATE POLICY "stock_member" ON public.stock
  FOR ALL USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_id = stock.company_id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "stock_mouvements_member" ON public.stock_mouvements;
CREATE POLICY "stock_mouvements_member" ON public.stock_mouvements
  FOR ALL USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_id = stock_mouvements.company_id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "pieces_comptables_member" ON public.pieces_comptables;
CREATE POLICY "pieces_comptables_member" ON public.pieces_comptables
  FOR ALL USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_id = pieces_comptables.company_id AND user_id = auth.uid()));

GRANT ALL ON public.stock TO authenticated;
GRANT ALL ON public.stock_mouvements TO authenticated;
GRANT ALL ON public.pieces_comptables TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.stock;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_mouvements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pieces_comptables;
