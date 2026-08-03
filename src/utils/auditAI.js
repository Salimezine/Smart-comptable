import { GoogleGenerativeAI } from '@google/generative-ai';
import { smartAnswer, getSuggestedQueries, initKnowledgeBase } from './taxKnowledge';
import { buildAuditContext } from '../auditEngine';

initKnowledgeBase();

const STORAGE_KEY = 'comptable_gemini_key';

export function setApiKey(key) {
  localStorage.setItem(STORAGE_KEY, key);
}

export function getApiKey() {
  return localStorage.getItem(STORAGE_KEY) || '';
}

export function hasApiKey() {
  return !!getApiKey();
}

export function clearApiKey() {
  localStorage.removeItem(STORAGE_KEY);
}

const FISCAL_CONTEXT = `You are a Tunisian tax expert assistant. Answer questions about Tunisian fiscal law, tax rates, declarations (déclaration mensuelle TVA, IS, IRPP, retenue à la source, employeur), deadlines, penalties, and procedures. Use the current year 2026. Be precise, cite official references (Code des Impôts Directs, Code de la TVA, Code de l'IRPP et de l'IS), and give practical examples when helpful. Respond in the same language as the query (French or Arabic). Keep answers concise and practical.`;

const AUDIT_CONTEXT = (companyDetails) => `\n\n=== CONTEXTE AUDIT DE L'ENTREPRISE (données réelles, à utiliser pour toute question d'audit, de conformité ou d'analyse de la comptabilité) ===\n${buildAuditContext(companyDetails)}\n\nUtilisez ces données réelles de l'entreprise pour répondre aux questions d'audit. Citez les montants réels. Si l'utilisateur demande un score, donnez-le avec le détail des points non conformes et les recommandations.`;

let genAI = null;
let model = null;

export function resetModel() {
  genAI = null;
  model = null;
}

function getModel() {
  const key = getApiKey();
  if (!key) return null;
  if (!genAI) {
    genAI = new GoogleGenerativeAI(key);
    model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }
  return model;
}

async function askGemini(query, history, companyDetails) {
  const m = getModel();
  if (!m) return null;
  try {
    const contents = (history || []).map(h => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content }]
    }));
    const context = companyDetails ? `${FISCAL_CONTEXT}${AUDIT_CONTEXT(companyDetails)}\n\nQuestion: ${query}` : `${FISCAL_CONTEXT}\n\nQuestion: ${query}`;
    contents.push({ role: 'user', parts: [{ text: context }] });
    const result = await m.generateContent({
      contents,
      generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
    });
    return result.response.text();
  } catch (err) {
    console.warn('Gemini API error:', err.message);
    return null;
  }
}

export async function askAI(query, history, companyDetails) {
  const q = query.trim();
  if (!q) return '';

  const knowledge = smartAnswer(q);
  if (knowledge.found) return knowledge.message;

  const gemini = await askGemini(q, history, companyDetails);
  if (gemini) return gemini;

  // Secours OpenRouter (modèles gratuits) si aucune clé Gemini
  try {
    const { hasOpenRouterKey, askOpenRouterChat } = await import('./aiOcr');
    if (hasOpenRouterKey()) {
      const or = await askOpenRouterChat(q, history, companyDetails);
      if (or && or.text) return or.text;
    }
  } catch { /* silencieux */ }

  return '';
}

export { getSuggestedQueries };
