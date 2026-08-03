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
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY || null;

const TABLES = [
  'journal_entries', 'invoices', 'expenses', 'transactions',
  'stock', 'stock_mouvements', 'pieces_comptables', 'employees',
  'payroll_slips', 'clients', 'fournisseurs', 'tva_declarations',
  'declarations_sociales', 'declarations_is', 'ocr_learning',
];

// Synonymes de noms de tables Supabase (certaines tables sont nommées différemment)
const TABLE_ALIASES = { clients: ['clients', 'customers'], fournisseurs: ['fournisseurs', 'suppliers'] };

const CHUNK_SIZE = 300;

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const email = arg('email', process.env.SUPABASE_EMAIL) || 'migration@local.dev';
const password = arg('password', process.env.SUPABASE_PASSWORD);
const d1Url = (arg('d1-url', D1_URL) || '').replace(/\/$/, '');
const d1Password = arg('d1-password', password) || Math.random().toString(36).slice(2, 12);

if (!email && !SUPABASE_SERVICE) {
  console.error('Usage: node scripts/migrate-supabase-to-d1.mjs --email X --password Y [--d1-password Z]');
  console.error('Ou définir SUPABASE_SERVICE_KEY pour une migration sans login (service key).');
  process.exit(1);
}

if (!d1Password) {
  console.error('Définir --d1-password (ou SUPABASE_PASSWORD) pour le compte D1.');
  process.exit(1);
}

// ------------------------------------------------------------------
// Supabase REST (service key = accès admin, ou auth user via anon key)
// ------------------------------------------------------------------

const supabaseAuth = async () => {
  if (SUPABASE_SERVICE) return SUPABASE_SERVICE;
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
  const key = SUPABASE_SERVICE || SUPABASE_ANON;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${token}` },
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
  console.log(`       OK (${SUPABASE_SERVICE ? 'service key' : 'session user'})`);

  console.log('[2/5] Récupération des sociétés…');
  const companiesRaw = await supabaseGet(token, `companies?select=id,name,matricule_fiscal,adresse,owner_id,plan`);
  const members = await supabaseGet(token, `company_members?select=company_id,user_id,role`);
  const companyIds = [...new Set((members || []).map(m => m.company_id))].filter(Boolean);
  console.log(`       ${companyIds.length} société(s)`);

  console.log('[3/5] Connexion/création du compte D1…');
  const { token: d1Token, user } = await d1Login();
  console.log(`       Compte D1: ${user.email}`);

  console.log('[4/5] Import des sociétés (id stable)…');
  const companies = (companiesRaw || []).filter(c => companyIds.includes(c.id)).map(c => ({
    id: c.id, name: c.name || 'Ma Société',
    matricule_fiscal: c.matricule_fiscal || '',
    adresse: c.adresse || '',
    owner_id: c.owner_id || user.id,
    plan: c.plan || 'free',
  }));
  if (companies.length) {
    const imported = await d1('/companies/import', 'POST', { companies }, d1Token);
    console.log(`       ${imported.length} société(s) importée(s) dans D1`);
  }

  console.log('[5/6] Import des données…');
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  for (const companyId of companyIds) {
    const name = (companies.find(c => c.id === companyId) || {}).name || companyId;
    const readTable = async (table) => {
      const aliases = TABLE_ALIASES[table] || [table];
      for (const a of aliases) {
        try {
          const rows = await supabaseGet(token, `${a}?company_id=eq.${companyId}&select=*`);
          if (rows && rows.length) return rows;
          return [];
        } catch (e) { /* tenter l'alias suivant */ }
      }
      return null; // aucune table trouvée
    };
    console.log(`  — ${name} (${companyId})`);
    const tables = {};
    for (const table of TABLES) {
      try {
        const rows = await readTable(table);
        if (rows === null) { console.warn(`      ${table}: pas de table correspondante`); continue; }
        if (rows.length) { tables[table] = rows; console.log(`      ${table}: ${rows.length}`); }
      } catch (e) { console.warn(`      ${table}: ignoré (${e.message})`); }
    }
    // Importer par lots (limite D1 par invocation)
    for (const table of Object.keys(tables)) {
      const rows = tables[table];
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        const res = await d1('/import', 'POST', { company_id: companyId, tables: { [table]: chunk } }, d1Token);
        console.log(`      ${table} chunk ${i / CHUNK_SIZE + 1}/${Math.ceil(rows.length / CHUNK_SIZE)} →`, JSON.stringify(res.results || res));
        await sleep(400);
      }
    }
  }

  // Tables globales (sans company_id en Supabase) → associées à chaque société
  console.log('[6/7] Import des tables globales…');
  const GLOBAL_TABLES = ['declaration_templates', 'fiscal_knowledge'];
  const globalRows = {};
  for (const g of GLOBAL_TABLES) {
    try {
      const rows = await supabaseGet(token, `${g}?select=*`);
      globalRows[g] = rows && rows.length ? rows : [];
      console.log(`       ${g}: ${globalRows[g].length}`);
    } catch (e) { console.warn(`       ${g}: ignoré (${e.message})`); globalRows[g] = []; }
  }
  for (const companyId of companyIds) {
    for (const g of GLOBAL_TABLES) {
      if (!globalRows[g] || !globalRows[g].length) continue;
      const res = await d1('/import', 'POST', { company_id: companyId, tables: { [g]: globalRows[g] } }, d1Token);
      console.log(`       ${g} → ${companyId}:`, JSON.stringify(res.results || res));
      await sleep(300);
    }
  }

  console.log('[Fin] Terminé.');
}

main().catch(e => { console.error('Erreur:', e.message); process.exit(1); });
