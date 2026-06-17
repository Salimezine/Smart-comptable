CREATE TABLE IF NOT EXISTS public.declarations_is (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  exercice INTEGER NOT NULL,
  regime TEXT DEFAULT 'normal',
  resultat_fiscal DECIMAL(15,3) DEFAULT 0,
  taux_is DECIMAL(5,3) DEFAULT 0.25,
  impot_brut DECIMAL(15,3) DEFAULT 0,
  css DECIMAL(15,3) DEFAULT 0,
  impot_css DECIMAL(15,3) DEFAULT 0,
  acompte1 DECIMAL(15,3) DEFAULT 0,
  acompte2 DECIMAL(15,3) DEFAULT 0,
  acompte3 DECIMAL(15,3) DEFAULT 0,
  total_acomptes DECIMAL(15,3) DEFAULT 0,
  solde DECIMAL(15,3) DEFAULT 0,
  statut TEXT DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'soumise', 'payee', 'en_retard')),
  date_echeance DATE,
  date_soumission TIMESTAMPTZ,
  date_paiement TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, exercice)
);

ALTER TABLE public.declarations_is ENABLE ROW LEVEL SECURITY;

CREATE POLICY "IS declarations access" ON public.declarations_is
  FOR ALL USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

GRANT ALL ON public.declarations_is TO authenticated;

DROP TRIGGER IF EXISTS declarations_is_updated_at ON public.declarations_is;
CREATE TRIGGER declarations_is_updated_at
  BEFORE UPDATE ON public.declarations_is
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.declarations_is;
