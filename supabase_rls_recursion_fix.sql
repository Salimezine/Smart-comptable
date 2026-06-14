-- Fix infinite RLS recursion on company_members policies
-- The inline subqueries querying company_members trigger RLS → infinite loop
-- Use SECURITY DEFINER functions instead (bypass RLS)

DROP FUNCTION IF EXISTS public.user_is_admin(UUID);
CREATE FUNCTION public.user_is_admin(company_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.company_members WHERE company_id = $1 AND user_id = auth.uid() AND role = 'admin');
$$;

DROP POLICY IF EXISTS "company_members_select" ON public.company_members;
CREATE POLICY "company_members_select" ON public.company_members
  FOR SELECT USING (public.user_is_member(company_id));

DROP POLICY IF EXISTS "company_members_admin" ON public.company_members;
CREATE POLICY "company_members_admin" ON public.company_members
  FOR SELECT USING (public.user_is_member(company_id));

DROP POLICY IF EXISTS "company_members_update_admin" ON public.company_members;
CREATE POLICY "company_members_update_admin" ON public.company_members
  FOR UPDATE USING (public.user_is_admin(company_id));

DROP POLICY IF EXISTS "company_members_delete_admin" ON public.company_members;
CREATE POLICY "company_members_delete_admin" ON public.company_members
  FOR DELETE USING (public.user_is_admin(company_id));
