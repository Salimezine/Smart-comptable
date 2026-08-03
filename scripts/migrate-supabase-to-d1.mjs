#!/usr/bin/env node
// ==========================================================================
//  Migration Supabase → Cloudflare D1
//  Lit toutes les données d'un utilisateur Supabase (RLS via son compte)
//  et les importe dans le worker D1 (/api/import).
//
//  Usage :
//    node scripts/migrate-supabase-to-d1.mjs \
//      --supabase-url https://xxxx.supabase.co \
//      --supabase-anon "sb_publishable_xxx" \
//      --email user@example.com \
//      --password "mot-de-passe-supabase" \
//      [--d1-url https://smart-comptable-teif-api.ezzinesalim21.workers.dev/api] \
//      [--d1-password "nouveau-mot-de-passe-d1"]
//
//  Si --d1-password est omis, on utilise --password.
//  Le compte D1 (même email) est créé automatiquement s'il n'existe pas.
// ==========================================================================

const SUPABASE_URL = 'https://xkpkmqlcxtlcdkmccbhs.supabase.co';
const SUPABASE_ANON = 'sb_publishable_mF8_8Ep4ouZylaxNBzdDxw_ToZ6E_LT';
const D1_URL = 'https://smart-comptable-teif-api.ezzinesalim21.workers.dev/api';

const TABLES = [
  'journal_entries', 'invoices', 'expenses', 'transactions',
  'stock', 'stock_mouvements', 'pieces_comptables', 'employees',
  'payroll_slips', 'clients', 'fournisseurs', 'tva_declarations',
  'declarations_sociales', 'declarations_is', 'declaration_templates',
  'fiscal_knowledge', 'ocr_learning',
];

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const email = arg('email', process.env.SUPABASE_EMAIL);
const password = arg('password', process.env.SUPABASE_PASSWORD);
const d1Url = (arg('d1-url', D1_URL) || '').replace(/\/$/, '');
const d1Password = arg('d1-password', password);

if (!email || !password) {
  console.error('Usage: node scripts/migrate-supabase-to-d1.mjs --email X --password Y [--d1-password Z]');
  process.exit(1);
}

// ------------------------------------------------------------------
// Supabase REST (auth user via anon key → RLS appliqué)
// ------------------------------------------------------------------
const supabaseAuth = async () => {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Supabase login failed (${res.status}): ${t.slice(0, 200)}`);
  }
  return (await res.json()).access_token;
};

const supabaseGet = async (token, path) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Supabase GET ${path} failed (${res.status}): ${t.slice(0, 200)}`);
  }
  return res.json();
};

// ------------------------------------------------------------------
// Worker D1 (login/register + import)
// ------------------------------------------------------------------
const d1 = async (path, method, body, token) => {
  const res = await fetch(`${d1Url}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`D1 ${method} ${path} failed (${res.status}): ${data.message || res.statusText}`);
  return data;
};

async function d1Login() {
  try {
    return await d1('/auth/login', 'POST', { email, password: d1Password });
  } catch {
    await d1('/auth/register', 'POST', { email, password: d1Password, nom: email.split('@')[0] });
    return await d1('/auth/login', 'POST', { email, password: d1Password });
  }
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------
async function main() {
  console.log('[1/5] Connexion à Supabase…');
  const token = await supabaseAuth();
  console.log('       OK');

  console.log('[2/5] Récupération des sociétés…');
  const members = await supabaseGet(token, `company_members?select=company_id,role`);
  const companyIds = [...new Set((members || []).map(m => m.company_id))];
  console.log(`       ${companyIds.length} société(s)`);

  console.log('[3/5] Connexion/création du compte D1…');
  const { token: d1Token, user } = await d1Login();
  console.log(`       Compte D1: ${user.email}`);

  console.log('[4/5] Import des données…');
  for (const companyId of companyIds) {
    console.log(`  — Société ${companyId}`);
    // S'assurer que la société existe côté D1 (id stable)
    try {
      await d1('/companies', 'POST', { name: companyId }, d1Token);
    } catch (e) { /* existe déjà */ }
    const tables = {};
    for (const table of TABLES) {
      try {
        const rows = await supabaseGet(token, `${table}?company_id=eq.${companyId}&select=*`);
        if (rows && rows.length) {
          tables[table] = rows;
          console.log(`      ${table}: ${rows.length}`);
        }
      } catch (e) {
        console.warn(`      ${table}: ignoré (${e.message})`);
      }
    }
    if (Object.keys(tables).length) {
      const res = await d1('/import', 'POST', { company_id: companyId, tables }, d1Token);
      console.log(`      → importé:`, JSON.stringify(res.results || res));
    }
  }

  console.log('[5/5] Terminé.');
}

main().catch(e => { console.error('Erreur:', e.message); process.exit(1); });
