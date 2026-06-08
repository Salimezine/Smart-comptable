import { supabase, isSupabaseEnabled } from './supabaseClient';

export async function signUp(email, password) {
  if (!isSupabaseEnabled()) return { error: 'Supabase non configuré' };
  const { data, error } = await supabase.auth.signUp({ email, password });
  return { data, error };
}

export async function signIn(email, password) {
  if (!isSupabaseEnabled()) return { error: 'Supabase non configuré' };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signOut() {
  if (!isSupabaseEnabled()) return;
  await supabase.auth.signOut();
}

export async function getSession() {
  if (!isSupabaseEnabled()) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session ?? null;
}

export async function getCurrentUser() {
  if (!isSupabaseEnabled()) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

export function onAuthChange(callback) {
  if (!isSupabaseEnabled()) return () => {};
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return () => subscription.unsubscribe();
}
