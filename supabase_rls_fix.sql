-- =============================================
-- Fix RLS : permettre au propriétaire de s'ajouter
-- comme membre de sa propre société
-- =============================================

-- Supprimer l'ancienne politique trop restrictive
DROP POLICY IF EXISTS "company_members_admin" ON public.company_members;

-- Lecture : tout membre de la société peut voir les membres
CREATE POLICY "company_members_admin" ON public.company_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.company_members cm2 WHERE cm2.company_id = company_id AND cm2.user_id = auth.uid())
  );

-- Insertion : le propriétaire de la société peut ajouter des membres
CREATE POLICY "company_members_insert_owner" ON public.company_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND owner_id = auth.uid())
  );

-- Mise à jour : seuls les admins de la société peuvent modifier
CREATE POLICY "company_members_update_admin" ON public.company_members
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.company_members cm2 WHERE cm2.company_id = company_id AND cm2.user_id = auth.uid() AND cm2.role = 'admin')
  );

-- Suppression : seuls les admins de la société peuvent supprimer
CREATE POLICY "company_members_delete_admin" ON public.company_members
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.company_members cm2 WHERE cm2.company_id = company_id AND cm2.user_id = auth.uid() AND cm2.role = 'admin')
  );
