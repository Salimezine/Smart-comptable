-- OCR Learning data (self-learning memory per company)
CREATE TABLE IF NOT EXISTS public.ocr_learning (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  supplier_corrections JSONB DEFAULT '{}'::jsonb,
  fingerprints JSONB DEFAULT '{}'::jsonb,
  rules JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id)
);

ALTER TABLE public.ocr_learning ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ocr_learning_member" ON public.ocr_learning;
CREATE POLICY "ocr_learning_member" ON public.ocr_learning
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = ocr_learning.company_id AND user_id = auth.uid()
  ));

GRANT ALL ON public.ocr_learning TO authenticated;

-- IF NOT EXISTS not supported for ALTER PUBLICATION in PG < 15
-- Run separately only if needed: ALTER PUBLICATION supabase_realtime ADD TABLE public.ocr_learning;
