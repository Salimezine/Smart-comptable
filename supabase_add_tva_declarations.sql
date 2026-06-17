-- Table des déclarations TVA
CREATE TABLE IF NOT EXISTS public.tva_declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  periode TEXT NOT NULL, -- YYYY-MM
  type_declaration TEXT DEFAULT 'mensuelle' CHECK (type_declaration IN ('mensuelle', 'trimestrielle')),
  base_ht DECIMAL(15,3) DEFAULT 0,
  tva_collectee DECIMAL(15,3) DEFAULT 0,
  tva_deductible DECIMAL(15,3) DEFAULT 0,
  tva_due DECIMAL(15,3) DEFAULT 0,
  credit_tva DECIMAL(15,3) DEFAULT 0,
  penalites DECIMAL(15,3) DEFAULT 0,
  net_a_payer DECIMAL(15,3) DEFAULT 0,
  statut TEXT DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'soumise', 'payee', 'en_retard')),
  date_echeance DATE,
  date_soumission TIMESTAMPTZ,
  date_paiement TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, periode)
);

ALTER TABLE public.tva_declarations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "TVA declarations access" ON public.tva_declarations
  FOR ALL USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

GRANT ALL ON public.tva_declarations TO authenticated;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_tva_declarations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tva_declarations_updated_at ON public.tva_declarations;
CREATE TRIGGER tva_declarations_updated_at
  BEFORE UPDATE ON public.tva_declarations
  FOR EACH ROW EXECUTE FUNCTION update_tva_declarations_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tva_declarations;
