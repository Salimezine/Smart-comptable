import { createClient } from '@supabase/supabase-js';

// Nettoyer les vieux Service Workers qui causent des bugs de cache
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    for (const reg of regs) reg.unregister();
  });
}

const RAW_URL = import.meta.env.VITE_SUPABASE_URL;
const RAW_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isPlaceholder = (v) => !v || v.includes('VOTRE_PROJECT_ID') || v.includes('votre_project_id');

const SUPABASE_URL = isPlaceholder(RAW_URL) ? null : RAW_URL;
const SUPABASE_KEY = isPlaceholder(RAW_KEY) ? null : RAW_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('[Supabase] Variables manquantes ou placeholders — mode offline uniquement');
}

export const supabase = (SUPABASE_URL && SUPABASE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null;

export const isSupabaseEnabled = () => supabase !== null;
