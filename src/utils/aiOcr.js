import { GoogleGenerativeAI } from '@google/generative-ai';
import { getApiKey } from './auditAI';
import { buildAuditContext } from '../auditEngine';

const OPENROUTER_KEY = 'comptable_openrouter_key';

export function getOpenRouterKey() {
  return localStorage.getItem(OPENROUTER_KEY) || '';
}
export function setOpenRouterKey(key) {
  if (key) localStorage.setItem(OPENROUTER_KEY, key.trim());
  else localStorage.removeItem(OPENROUTER_KEY);
}
export function hasOpenRouterKey() {
  return !!getOpenRouterKey();
}

// IA automatique côté serveur (clé OpenRouter sur le worker) — aucun utilisateur ne doit entrer de clé.
// L'endpoint /api/ai/chat est public (limité par IP) : disponible sans login, sans token.
export function hasServerAI() {
  try {
    return typeof navigator !== 'undefined' && navigator.onLine !== false;
  } catch { return false; }
}

let genAI = null;
let geminiModel = null;

function getGeminiModel() {
  const key = getApiKey();
  if (!key) return null;
  if (!genAI) {
    genAI = new GoogleGenerativeAI(key);
    geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }
  return geminiModel;
}

export function resetOcrModel() {
  genAI = null;
  geminiModel = null;
}

function extractJson(text) {
  const cleaned = (text || '').replace(/```json\n?/g, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { /* fallback */ }
  }
  try { return JSON.parse(cleaned); } catch { /* not json */ }
  return null;
}

const SYSTEM_PROMPT = `Tu es un expert en facturation tunisienne et en comptabilité SCE (Système Comptable des Entreprises).
À partir du texte brut extrait d'une facture par OCR, tu dois reconstruire les données structurées de la facture avec une grande précision.
Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans commentaire, sans bloc markdown.
Respecte EXACTEMENT cette structure (champs null si non trouvés, pas d'invention) :

{
  "fournisseur_nom": "nom de la société ou null",
  "fournisseur_mf": "matricule fiscal format 1234567/X/A/M/000 ou null",
  "date_facture": "DD/MM/YYYY ou null",
  "numero_facture": "numéro de facture ou null",
  "montant_ht": nombre,
  "remise": nombre ou 0 (remise commerciale déduite du total HT, sinon 0),
  "remise_pourcent": nombre ou 0 (taux de la remise en %, ex: 10 pour 10%),
  "taux_tva": nombre (0, 7, 12, 13 ou 19),
  "montant_tva": nombre,
  "timbre_fiscal": nombre (0 ou 1.000 ou 1.500 ou 2.000),
  "fodec": nombre,
  "montant_ttc": nombre,
  "retenue_source": nombre ou 0 (montant de la retenue à la source si la case "Retenue à la source applicable" est cochée ou si un montant "Retenue à la source" est imprimé),
  "rs_taux": nombre ou 0 (taux de la retenue à la source : 1, 3, 10 ou 15 selon la mention sur la facture, sinon 1 si case cochée sans taux),
  "type": "achat" ou "vente",
  "categorie_sce": "frais_telecommunication | frais_energie | fournitures_bureau | frais_transport | restauration | loyer | salaries | materiel_informatique | honoraires | publicite | assurances | entretien | frais_bancaires | prestation_service | achats_marchandises | matieres_premieres | autres",
  "lignes": [
    {
      "designation": "libellé de la ligne",
      "quantite": nombre,
      "prix_unitaire_ht": nombre,
      "montant_ht": nombre,
      "taux_tva": nombre
    }
  ]
}

Règles de vérification :
- Les montants sont en dinars tunisiens (DT), arrondis à 3 décimales.
- Vérifie la cohérence : montant_ttc ≈ montant_ht + montant_tva + timbre_fiscal + fodec.
- REMISE : si la facture mentionne une remise (Remise, Rémise, Rabais, Escompte, خصم, "remise 10%", "remise X%", "remise : Y DT", une ligne pointillée "Remise ...... Y"), mets remise = montant en DT déduit (ex: 50 ou 100.000) et remise_pourcent = taux en % si visible (ex: 10). Sinon remise = 0.
- montant_ht = le NET après remise (si "Total HT 1 000" et "Remise 10%", montant_ht = 900 et remise = 100). Ne le mets JAMAIS dans une ligne d'article.
- Si le texte est brouillé, choisis la valeur la plus probable, sinon null.
- Ne déduis JAMAIS le timbre fiscal : utilise uniquement la valeur visible sur la facture.
- Le fournisseur_nom est TOUJOURS l'émetteur de la facture : la société dont le nom et le matricule fiscal figurent en en-tête (en haut) de la facture.
- Le champ "Client :" désigne le DESTINATAIRE de la facture, pas le fournisseur. Ne mets JAMAIS le destinataire dans fournisseur_nom.
- type : par défaut "achat" (facture reçue). Ne passe "vente" que si le document est manifestement émis par l'utilisateur (son propre en-tête).`;

// Détection IA Chrome (Gemini Nano, on-device, gratuit, sans clé)
function getChromeLM() {
  const anyWindow = typeof window !== 'undefined' ? window : null;
  const root = typeof self !== 'undefined' ? self : null;
  if (anyWindow?.LanguageModel) return anyWindow.LanguageModel;
  if (anyWindow?.ai?.languageModel) return anyWindow.ai.languageModel;
  if (anyWindow?.model?.LanguageModel) return anyWindow.model.LanguageModel;
  if (anyWindow?.ai?.LanguageModel) return anyWindow.ai.LanguageModel;
  if (root && 'LanguageModel' in root) return root.LanguageModel;
  return null;
}

export function hasChromeAI() {
  return !!getChromeLM();
}

export async function getChromeAIStatus() {
  const LM = getChromeLM();
  if (!LM) return 'absent';
  try {
    const a = await LM.availability();
    return a || 'inconnu';
  } catch {
    return 'inconnu';
  }
}

export async function ensureChromeAIModel() {
  const LM = getChromeLM();
  if (!LM) return 'absent';
  try {
    const a = await LM.availability();
    if (a === 'available' || a === 'downloading') return a;
    if (a === 'unavailable') return 'unavailable';
    if (a === 'downloadable') {
      try {
        const session = await LM.create({ systemPrompt: '', temperature: 0.1 });
        session.destroy?.();
        return 'available';
      } catch (e) {
        return 'downloadable';
      }
    }
    return a || 'inconnu';
  } catch {
    return 'inconnu';
  }
}

export function describeAIEngine() {
  const engines = [];
  if (hasOpenRouterKey()) engines.push('IA OpenRouter (modèles gratuits)');
  if (hasChromeAI()) engines.push('IA Chrome locale (Gemini Nano)');
  if (getApiKey()) engines.push('Gemini cloud');
  if (engines.length === 0) return 'aucune IA configurée';
  return engines.join(' → ');
}

export async function aiEnhanceFacture(ocrText, currentFormulaire, options = {}) {
  if (!ocrText || ocrText.trim().length < 20) return null;
  const prompt = `Texte OCR brut de la facture :\n"""\n${ocrText.slice(0, 6000)}\n"""`;

  // 1. OpenRouter automatique via le worker (clé serveur) — sans clé locale
  const server = await askOpenRouterServer(prompt);
  const serverJson = server && server.text ? extractJson(server.text) : null;
  if (serverJson) return mergeAI(currentFormulaire || {}, serverJson);

  // 2. OpenRouter clé locale (fallback)
  if (hasOpenRouterKey()) {
    const orResult = await askOpenRouter(prompt, options.imageDataUrl);
    if (orResult?.json) return mergeAI(currentFormulaire || {}, orResult.json);
    if (orResult?.error && orResult.kind !== 'rate') throw new Error(orResult.error);
  }

  // 3. IA Chrome on-device (gratuit, sans clé, sans réseau)
  const chromeResult = await askChromeAI(prompt);
  if (chromeResult?.json) return mergeAI(currentFormulaire || {}, chromeResult.json);

  // 4. Gemini cloud (si une clé est configurée — optionnel)
  const geminiResult = await askGemini(prompt, options.imageDataUrl);
  const gjson = geminiResult ? extractJson(geminiResult) : null;
  if (gjson) return mergeAI(currentFormulaire || {}, gjson);

  if (chromeResult?.error) throw new Error(chromeResult.error);
  return null;
}

async function askOpenRouter(prompt, imageDataUrl) {
  const apiKey = getOpenRouterKey();
  if (!apiKey) return null;
  const models = [
    'google/gemma-4-26b-a4b-it:free',
    'openai/gpt-oss-20b:free',
    'google/gemma-4-31b-it:free',
    'nvidia/nemotron-3-nano-30b-a3b:free',
    'deepseek/deepseek-chat-v3-0324',
    'deepseek/deepseek-v3.2',
  ];
  const userContent = imageDataUrl
    ? [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: imageDataUrl } },
      ]
    : prompt;
  for (const model of models) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60000);
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userContent },
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        if (resp.status === 429) return { error: 'IA OpenRouter: quota gratuit épuisé (429)', kind: 'rate' };
        if (resp.status === 401) return { error: 'Clé OpenRouter invalide — vérifiez-la dans les paramètres', kind: 'auth' };
        if (resp.status === 404 && model !== models[models.length - 1]) continue;
        return { error: `Erreur IA (${resp.status}): ${body.slice(0, 120)}` };
      }
      const data = await resp.json();
      const content = data?.choices?.[0]?.message?.content;
      const json = extractJson(content);
      if (json) return { json };
      return { error: 'Réponse IA non exploitable' };
    } catch (err) {
      if (err?.name === 'AbortError') return { error: 'Délai dépassé (60s) — réessayez' };
      if (model !== models[models.length - 1]) continue;
      return { error: `Erreur réseau IA: ${err?.message || err}` };
    }
  }
  return { error: 'IA indisponible' };
}

const CHAT_SYSTEM_PROMPT = `Tu es l'assistant comptable et fiscal tunisien de Smart Comptable.
Réponds de manière précise et pratique sur : fiscalité tunisienne (TVA, IS, IRPP, retenue à la source, déclarations), comptabilité SCE, plan comptable, échéances, pénalités.
Cite les références officielles (Code des Impôts Directs, Code de la TVA, Code de l'IRPP et de l'IS) quand c'est utile.
Réponds dans la langue de la question (français ou arabe). Réponses concises.`;

/**
 * IA automatique via le worker Cloudflare (clé OpenRouter côté serveur).
 * Retourne { text } ou null si non disponible.
 */
async function askOpenRouterServer(prompt, history = [], companyDetails = null) {
  try {
    const API_URL = (import.meta.env.VITE_API_URL || 'https://smart-comptable-teif-api.ezzinesalim21.workers.dev/api').replace(/\/$/, '');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('smart_api_token') || '';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const resp = await fetch(`${API_URL}/ai/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt, history, companyDetails }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const data = await resp.json();
    return (data && data.text) ? { text: data.text } : null;
  } catch {
    return null;
  }
}

/**
 * Chat OpenRouter : essaye d'abord le worker auto, sinon la clé locale.
 * Retourne { text } ou { error }.
 */
export async function askOpenRouterChat(prompt, history = [], companyDetails = null) {
  const auto = await askOpenRouterServer(prompt, history, companyDetails);
  if (auto && auto.text) return auto;
  const apiKey = getOpenRouterKey();
  if (!apiKey) return auto || { error: 'Aucune clé OpenRouter configurée' };
  const models = [
    'google/gemma-4-26b-a4b-it:free',
    'openai/gpt-oss-20b:free',
    'google/gemma-4-31b-it:free',
    'nvidia/nemotron-3-nano-30b-a3b:free',
    'deepseek/deepseek-chat-v3-0324',
    'deepseek/deepseek-v3.2',
  ];
  const system = companyDetails
    ? `${CHAT_SYSTEM_PROMPT}\n\n=== CONTEXTE AUDIT DE L'ENTREPRISE (données réelles) ===\n${buildAuditContext(companyDetails)}\n\nUtilisez ces données réelles pour répondre aux questions d'audit/conformité. Citez les montants réels et le score.`
    : CHAT_SYSTEM_PROMPT;
  const messages = [
    { role: 'system', content: system },
    ...(history || []).map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content || '' })),
    { role: 'user', content: prompt },
  ];
  for (const model of models) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 90000);
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 900 }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        if (resp.status === 429) return { error: 'Quota gratuit OpenRouter épuisé (429). Ajoutez un solde ou patientez.', kind: 'rate' };
        if (resp.status === 401) return { error: 'Clé OpenRouter invalide — vérifiez-la dans le chat (Clés IA).', kind: 'auth' };
        if (resp.status === 404 && model !== models[models.length - 1]) continue;
        return { error: `Erreur IA (${resp.status}): ${body.slice(0, 140)}` };
      }
      const data = await resp.json();
      const text = data?.choices?.[0]?.message?.content;
      if (text && text.trim()) return { text: text.trim() };
      return { error: 'Réponse IA vide' };
    } catch (err) {
      if (err?.name === 'AbortError') return { error: 'Délai dépassé (90s) — réessayez' };
      if (model !== models[models.length - 1]) continue;
      return { error: `Erreur réseau IA: ${err?.message || err}` };
    }
  }
  return { error: 'IA indisponible' };
}

async function askChromeAI(prompt) {
  const LM = getChromeLM();
  if (!LM) return null;
  try {
    let availability = 'unknown';
    try { availability = await LM.availability(); } catch { /* ignore */ }
    if (availability === 'unavailable') return null;

    let session;
    try {
      session = await LM.create({
        systemPrompt: SYSTEM_PROMPT,
        temperature: 0.1,
      });
    } catch (e) {
      if (e?.name === 'NotSupportedError') return null;
      return { error: 'IA locale indisponible sur ce navigateur' };
    }

    try {
      const result = await session.prompt(prompt);
      session.destroy?.();
      const json = extractJson(result);
      return json ? { json } : { error: 'Réponse IA locale non exploitable' };
    } catch (e) {
      session.destroy?.();
      if (e?.name === 'QuotaExceededError') return { error: 'IA locale: contexte trop long' };
      return { error: 'IA locale: ' + (e?.message || 'erreur') };
    }
  } catch (err) {
    return { error: 'IA locale: ' + (err?.message || err) };
  }
}

async function askGemini(prompt, imageDataUrl) {
  const m = getGeminiModel();
  if (!m) return null;
  try {
    const parts = [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }];
    if (imageDataUrl) {
      const base64 = imageDataUrl.replace(/^data:image\/(png|jpe?g|webp);base64,/, '');
      parts.push({ inlineData: { mimeType: imageDataUrl.includes('image/png') ? 'image/png' : 'image/jpeg', data: base64 } });
    }
    const result = await m.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1500, responseMimeType: 'application/json' },
    });
    return result.response.text();
  } catch (err) {
    console.warn('Gemini OCR error:', err.message);
    return null;
  }
}

export function mergeAI(current, ai) {
  const out = { ...current };
  const set = (key, src, keys) => {
    if (src === undefined || src === null) return;
    for (const k of keys) {
      if (src[k] !== undefined && src[k] !== null && src[k] !== '') {
        out[key] = src[k];
        return;
      }
    }
  };
  const isEmpty = (v) => v === undefined || v === null || v === '' || v === 0;

  set('fournisseur_nom', ai, ['fournisseur_nom', 'fournisseur']);
  set('fournisseur_mf', ai, ['fournisseur_mf', 'matricule_fiscal', 'fournisseur_mf']);
  set('date_facture', ai, ['date_facture', 'date']);
  set('numero_facture', ai, ['numero_facture', 'numero_justificatif']);

  if (isEmpty(out.montant_ht) && !isEmpty(ai.montant_ht)) out.montant_ht = ai.montant_ht;
  if (isEmpty(out.remise) && !isEmpty(ai.remise)) out.remise = ai.remise;
  if (isEmpty(out.remise_pourcent) && !isEmpty(ai.remise_pourcent)) out.remise_pourcent = ai.remise_pourcent;
  if (!isEmpty(ai.remise)) {
    if (!isEmpty(ai.montant_ht)) out.montant_ht = ai.montant_ht;
    if (!isEmpty(ai.montant_ttc)) out.montant_ttc = ai.montant_ttc;
    if (!isEmpty(ai.montant_tva)) out.montant_tva = ai.montant_tva;
    if (!isEmpty(ai.timbre_fiscal)) out.timbre_fiscal = ai.timbre_fiscal;
    if (!isEmpty(ai.fodec)) out.fodec = ai.fodec;
  }
  if (!isEmpty(ai.taux_tva) && (isEmpty(out.taux_tva) || out.taux_tva === '19%')) out.taux_tva = ai.taux_tva;
  if (isEmpty(out.montant_tva) && !isEmpty(ai.montant_tva)) out.montant_tva = ai.montant_tva;
  if (isEmpty(out.timbre_fiscal) && !isEmpty(ai.timbre_fiscal)) out.timbre_fiscal = ai.timbre_fiscal;
  if (isEmpty(out.fodec) && !isEmpty(ai.fodec)) out.fodec = ai.fodec;
  if (isEmpty(out.montant_ttc) && !isEmpty(ai.montant_ttc)) out.montant_ttc = ai.montant_ttc;
  if (isEmpty(out.retenue_source) && !isEmpty(ai.retenue_source)) out.retenue_source = ai.retenue_source;
  if (isEmpty(out.rs_montant) && !isEmpty(ai.rs_montant)) out.rs_montant = ai.rs_montant;
  if (isEmpty(out.rs_taux) && !isEmpty(ai.rs_taux)) out.rs_taux = ai.rs_taux;
  set('type', ai, ['type']);
  set('categorie_sce', ai, ['categorie_sce', 'categorie']);
  if (Array.isArray(ai.lignes) && ai.lignes.length > 0 && (!Array.isArray(out.lignes) || out.lignes.length === 0)) {
    out.lignes = ai.lignes;
  }
  if (!Array.isArray(out.lignes)) out.lignes = [];
  return out;
}

// Vérification de l'écriture comptable par IA : relit la facture (texte + image) et
// corrige les lignes de l'écriture (comptes, libellés, montants) si incohérent.
export async function aiVerifEcriture(piece, ocrText, imageDataUrl) {
  if (!piece || !piece.lignes || piece.lignes.length === 0) return null;
  const lignes = piece.lignes.map(l => ({
    compte: l.compte || '',
    libelle: l.libelle || '',
    debit: parseFloat(l.debit) || 0,
    credit: parseFloat(l.credit) || 0,
  }));
  const prompt = `Voici une écriture comptable générée automatiquement à partir d'une facture scannée.
Écriture :
"""${JSON.stringify(lignes)}"""
${ocrText ? `Texte OCR de la facture :
"""${ocrText.slice(0, 4000)}"""` : ''}
Vérifie chaque ligne : le code compte (plan comptable SCE tunisien : 6xx charges, 4xx tiers, 436 TVA), le libellé, et les montants.
Réponds UNIQUEMENT avec un objet JSON valide :
{
  "lignes": [ { "compte": "code", "libelle": "texte", "debit": nombre, "credit": nombre } ]
}
- Conserve l'équilibre débit = crédit.
- Corrige uniquement ce qui est manifestement faux, sinon garde la valeur d'origine.
- Ne renvoie JAMAIS de texte hors JSON.`;

  if (hasOpenRouterKey()) {
    const orResult = await askOpenRouter(prompt, imageDataUrl);
    if (orResult?.json && Array.isArray(orResult.json.lignes)) return orResult.json.lignes;
  }
  const chromeResult = await askChromeAI(prompt);
  if (chromeResult?.json && Array.isArray(chromeResult.json.lignes)) return chromeResult.json.lignes;
  const geminiResult = await askGemini(prompt, imageDataUrl);
  const gjson = geminiResult ? extractJson(geminiResult) : null;
  if (gjson && Array.isArray(gjson.lignes)) return gjson.lignes;
  return null;
}
