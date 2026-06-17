import { supabase, isSupabaseEnabled, supabaseSessionActive } from './supabaseClient';

const STORAGE_KEYS = {
  supplierCorrections: 'smart_ocr_supplier_corrections',
  fingerprints: 'smart_ocr_fingerprints',
  rules: 'smart_ocr_rules',
};

function load(key) {
  try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
}

function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function extractKeywords(text) {
  const words = text.toLowerCase().split(/[\s\n\r]+/).filter(w => w.length > 3);
  const important = words.filter(w => /[a-zà-üéèêëôöîïûüç]/i.test(w) && !/^(total|tva|ttc|ht|timbre|net|facture|client|date|numero|montant|fodec|rs|dt|dinars|millimes|page|sur|le|la|les|des|pour|par|avec|dans)$/i.test(w));
  return [...new Set(important)].slice(0, 20);
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Uint8Array(n + 1));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0));
  return dp[m][n];
}

function similarity(a, b) {
  if (!a || !b) return 0;
  const d = levenshtein(a.slice(0, 100), b.slice(0, 100));
  return 1 - d / Math.max(a.length, b.length, 1);
}

export function saveSupplierCorrection(rawText, correctedName) {
  const data = load(STORAGE_KEYS.supplierCorrections);
  const key = extractKeywords(rawText).join(' ');
  if (!key) return;
  if (!data[key]) data[key] = { correctedName, count: 1, lastUsed: Date.now() };
  else { data[key].count++; data[key].lastUsed = Date.now(); }
  save(STORAGE_KEYS.supplierCorrections, data);
}

export function suggestSupplier(rawText) {
  const data = load(STORAGE_KEYS.supplierCorrections);
  const keywords = extractKeywords(rawText).join(' ');
  const candidates = [];
  for (const [storedKey, entry] of Object.entries(data)) {
    const sim = similarity(keywords, storedKey);
    if (sim > 0.4) candidates.push({ name: entry.correctedName, confidence: entry.count, similarity: sim });
  }
  return candidates.sort((a, b) => (b.confidence * b.similarity) - (a.confidence * a.similarity)).slice(0, 3);
}

export function buildFingerprint(text) {
  const lines = text.split('\n').filter(Boolean);
  const totalLines = lines.length;
  const anchors = [];
  const labelPatterns = [
    /(total|sous-total)\s*(ht|h\.t)/i, /(total|montant)\s*tva/i, /(net\s*(à\s*)?payer|total\s*ttc)/i,
    /timbre\s*fiscal/i, /fodec/i, /factur(e|é)\s*(à|e)/i, /client/i, /matricule\s*fiscal/i,
    /taux\s*tva|tva\s*\d/i, /retenue\s*(à\s*la\s*)?source/i, /mode\s*r[eé]glement/i,
    /num[eé]ro\s*(facture|justificatif)/i, /date/i, /d[eé]signation/i,
  ];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    for (const pat of labelPatterns) {
      if (pat.test(line)) anchors.push({ pat: pat.source, lineIdx: i, lineRatio: i / totalLines });
    }
  }
  return anchors;
}

export function fingerprintHash(text) {
  const fp = buildFingerprint(text);
  return fp.map(a => `${a.pat.slice(0, 30)}@${Math.round(a.lineRatio * 10)}`).join('|');
}

export function matchFingerprint(text) {
  const stored = load(STORAGE_KEYS.fingerprints);
  const hash = fingerprintHash(text);
  let best = null, bestSim = 0;
  for (const [storedHash, data] of Object.entries(stored)) {
    const sim = similarity(hash, storedHash);
    if (sim > bestSim && sim > 0.5) { bestSim = sim; best = data; }
  }
  return best;
}

export function saveFingerprint(text, parsedResult) {
  const stored = load(STORAGE_KEYS.fingerprints);
  const hash = fingerprintHash(text);
  if (!stored[hash]) stored[hash] = { count: 0, fields: {} };
  stored[hash].count++;
  const f = parsedResult?.formulaire || {};
  const fields = {};
  if (f.fournisseur_nom) fields.fournisseur_nom = f.fournisseur_nom;
  if (f.taux_tva) fields.taux_tva = f.taux_tva;
  if (f.timbre_fiscal) fields.timbre_fiscal = f.timbre_fiscal;
  if (f.montant_ht) fields.montant_ht = f.montant_ht;
  if (f.montant_ttc) fields.montant_ttc = f.montant_ttc;
  stored[hash].fields = { ...stored[hash].fields, ...fields };
  save(STORAGE_KEYS.fingerprints, stored);
}

export function saveCorrectionRule(fournisseur, field, correctedValue) {
  const rules = load(STORAGE_KEYS.rules);
  const key = `${fournisseur}_${field}`;
  if (!rules[key]) rules[key] = { fournisseur, field, correctedValue, count: 1, autoApply: false };
  else {
    rules[key].count++;
    rules[key].correctedValue = correctedValue;
  }
  if (rules[key].count >= 3) rules[key].autoApply = true;
  save(STORAGE_KEYS.rules, rules);
}

export function getAutoRules(fournisseur) {
  const rules = load(STORAGE_KEYS.rules);
  return Object.values(rules).filter(r => r.autoApply && r.fournisseur === fournisseur);
}

export function applyLearnedPatterns(text, parsedResult) {
  if (!parsedResult || !text) return parsedResult;
  const formulaire = parsedResult.formulaire || {};
  const fournisseur = formulaire.fournisseur_nom || '';

  const fpMatch = matchFingerprint(text);
  if (fpMatch && fpMatch.fields) {
    if (!fournisseur && fpMatch.fields.fournisseur_nom) formulaire.fournisseur_nom = fpMatch.fields.fournisseur_nom;
    if (fpMatch.fields.timbre_fiscal && (!formulaire.timbre_fiscal || formulaire.timbre_fiscal === 1)) formulaire.timbre_fiscal = fpMatch.fields.timbre_fiscal;
  }

  const rules = getAutoRules(fournisseur);
  for (const rule of rules) {
    if (rule.field === 'timbre_fiscal' && (!formulaire.timbre_fiscal || formulaire.timbre_fiscal === 1)) formulaire.timbre_fiscal = parseFloat(rule.correctedValue);
    if (rule.field === 'taux_tva' && !formulaire.taux_tva) formulaire.taux_tva = parseInt(rule.correctedValue);
    if (rule.field === 'categorie' && !formulaire.categorie_principale) formulaire.categorie_principale = rule.correctedValue;
  }

  const supplierSuggest = suggestSupplier(text);
  if (!formulaire.fournisseur_nom && supplierSuggest.length > 0) formulaire.fournisseur_nom = supplierSuggest[0].name;

  parsedResult.formulaire = formulaire;
  return parsedResult;
}

export function recordCorrection(rawText, fournisseur, field, value) {
  if (field === 'fournisseur_nom' && value) saveSupplierCorrection(rawText, value);
  if (field === 'timbre_fiscal' || field === 'taux_tva' || field === 'categorie') {
    saveCorrectionRule(fournisseur, field, String(value));
  }
  if (rawText) saveFingerprint(rawText, { formulaire: { [field]: value, fournisseur_nom: fournisseur } });
}

export function getLearningSummary() {
  const corrections = load(STORAGE_KEYS.supplierCorrections);
  const fingerprints = load(STORAGE_KEYS.fingerprints);
  const rules = load(STORAGE_KEYS.rules);
  return {
    fournisseursConnus: Object.keys(corrections).length,
    empreintes: Object.keys(fingerprints).length,
    reglesAuto: Object.values(rules).filter(r => r.autoApply).length,
  };
}

function getCompanyId() {
  try {
    const id = localStorage.getItem('smart_comptable_current_id');
    return id || null;
  } catch { return null; }
}

export async function syncLearningToSupabase() {
  if (!isSupabaseEnabled() || !supabaseSessionActive) return false;
  const companyId = getCompanyId();
  if (!companyId) return false;

  const data = {
    supplier_corrections: load(STORAGE_KEYS.supplierCorrections),
    fingerprints: load(STORAGE_KEYS.fingerprints),
    rules: load(STORAGE_KEYS.rules),
  };

  try {
    const { error } = await supabase.from('ocr_learning').upsert({
      company_id: companyId,
      supplier_corrections: data.supplier_corrections,
      fingerprints: data.fingerprints,
      rules: data.rules,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id' });
    return !error;
  } catch { return false; }
}

export async function loadLearningFromSupabase() {
  if (!isSupabaseEnabled() || !supabaseSessionActive) return false;
  const companyId = getCompanyId();
  if (!companyId) return false;

  try {
    const { data, error } = await supabase
      .from('ocr_learning')
      .select('supplier_corrections, fingerprints, rules')
      .eq('company_id', companyId)
      .single();

    if (error || !data) return false;

    if (data.supplier_corrections) save(STORAGE_KEYS.supplierCorrections, data.supplier_corrections);
    if (data.fingerprints) save(STORAGE_KEYS.fingerprints, data.fingerprints);
    if (data.rules) save(STORAGE_KEYS.rules, data.rules);

    return true;
  } catch { return false; }
}
