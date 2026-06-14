-- Fix: Allow users to INSERT their own profile (needed when auth
-- user exists but profile was deleted, e.g. after DROP TABLE CASCADE)
DROP POLICY IF EXISTS "profiles_self" ON public.profiles;
CREATE POLICY "profiles_self" ON public.profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
