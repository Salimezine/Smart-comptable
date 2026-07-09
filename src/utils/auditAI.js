import { GoogleGenerativeAI } from '@google/generative-ai';
import { smartAnswer, getSuggestedQueries, initKnowledgeBase } from './taxKnowledge';

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

async function askGemini(query, history) {
  const m = getModel();
  if (!m) return null;
  try {
    const contents = (history || []).map(h => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content }]
    }));
    contents.push({ role: 'user', parts: [{ text: `${FISCAL_CONTEXT}\n\nQuestion: ${query}` }] });
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

export async function askAI(query, history) {
  const q = query.trim();
  if (!q) return '';

  const knowledge = smartAnswer(q);
  if (knowledge.found) return knowledge.message;

  const gemini = await askGemini(q, history);
  if (gemini) return gemini;

  return '';
}

export { getSuggestedQueries };
