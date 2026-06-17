-- Déclarations sociales (CNSS mensuelle, IRPP annuel, Etat 301)
CREATE TABLE IF NOT EXISTS public.declarations_sociales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('cnss_mensuelle', 'irpp_annuelle', 'etat_301')),
  periode TEXT NOT NULL, -- YYYY-MM pour CNSS, YYYY pour IRPP
  statut TEXT DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'soumise', 'payee', 'en_retard')),

  -- Effectifs
  nb_employes INT DEFAULT 0,
  total_brut DECIMAL(15,3) DEFAULT 0,
  total_salaire_imposable DECIMAL(15,3) DEFAULT 0,

  -- CNSS
  cnss_salarie DECIMAL(15,3) DEFAULT 0,
  cnss_patronal DECIMAL(15,3) DEFAULT 0,
  cnss_total DECIMAL(15,3) DEFAULT 0,

  -- IRPP / RS
  irpp_annuel DECIMAL(15,3) DEFAULT 0,
  rs_mensuelle DECIMAL(15,3) DEFAULT 0,
  css DECIMAL(15,3) DEFAULT 0,

  -- Taux applicables
  taux_cnss_sal NUMERIC(5,3) DEFAULT 9.68,
  taux_cnss_pat NUMERIC(5,3) DEFAULT 17.07,

  -- Paiement
  net_a_payer DECIMAL(15,3) DEFAULT 0,
  date_echeance DATE,
  date_soumission TIMESTAMPTZ,
  date_paiement TIMESTAMPTZ,
  reference TEXT,
  notes TEXT,

  -- Données brutes (JSON)
  bulletins JSONB,
  detail JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, type, periode)
);

ALTER TABLE public.declarations_sociales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Social declarations access" ON public.declarations_sociales
  FOR ALL USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

GRANT ALL ON public.declarations_sociales TO authenticated;

-- Trigger updated_at
DROP TRIGGER IF EXISTS declarations_sociales_updated_at ON public.declarations_sociales;
CREATE TRIGGER declarations_sociales_updated_at
  BEFORE UPDATE ON public.declarations_sociales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.declarations_sociales;
