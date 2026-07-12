-- =============================================
-- Smart Comptable — Fix migrations
-- À exécuter dans Supabase Dashboard > SQL Editor
-- =============================================

-- 1. fiscal_knowledge: ajouter RLS SELECT policy
DROP POLICY IF EXISTS "fiscal_knowledge_select" ON public.fiscal_knowledge;
CREATE POLICY "fiscal_knowledge_select" ON public.fiscal_knowledge
  FOR SELECT USING (true);

GRANT SELECT ON public.fiscal_knowledge TO authenticated;

-- 2. Vérifier que stock_mouvements existe avec les bonnes colonnes
-- (le frontend envoie désormais: id UUID, prix_unitaire, quantite, etc.)
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'stock_mouvements' AND table_schema = 'public';
