import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Trash2, Bot, User, KeyRound } from 'lucide-react';
import { askAI, getApiKey, hasApiKey, setApiKey, clearApiKey, getSuggestedQueries } from '../utils/auditAI';
import { hasOpenRouterKey, getOpenRouterKey, setOpenRouterKey, askOpenRouterChat } from '../utils/aiOcr';
import OpenRouterGuide from '../components/OpenRouterGuide';

const WELCOME = [
  { role: 'assistant', content: 'Bonjour 👋 Je suis votre assistant comptable et fiscal tunisien.\n\nPosez-moi des questions sur :\n• TVA, IS, IRPP, retenue à la source, déclarations\n• Écritures comptables, plan comptable SCE\n• Échéances fiscales et pénalités\n• Conseils pratiques pour votre entreprise\n\nJe réponds en français ou en arabe.' },
];

export default function ChatView({ currentCompanyId, currentUser, companyDetails }) {
  const [messages, setMessages] = useState(WELCOME);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [geminiKey, setGeminiKey] = useState('');
  const [orKey, setOrKey] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    setGeminiKey(getApiKey());
    setOrKey(getOpenRouterKey());
  }, [showKeys]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const engineLabel = () => {
    const parts = [];
    if (hasApiKey()) parts.push('Gemini');
    if (hasOpenRouterKey()) parts.push('OpenRouter');
    if (parts.length === 0) return 'Connaissance locale';
    return parts.join(' + ');
  };

  const send = async (q) => {
    const query = (q || input).trim();
    if (!query || loading) return;
    if (q) setInput(q);
    setMessages(prev => [...prev, { role: 'user', content: query }]);
    setLoading(true);
    const history = messages.filter(m => m.role !== 'assistant' || m.content !== WELCOME[0].content);
    let answer = '';
    // 1. Connaissance locale + Gemini (via askAI) avec contexte audit
    try {
      answer = await askAI(query, history.map(m => ({ role: m.role, content: m.content })), companyDetails);
    } catch (_) { /* silencieux */ }
    // 2. Secours OpenRouter si aucun résultat
    if (!answer && hasOpenRouterKey()) {
      try {
        const or = await askOpenRouterChat(query, history.map(m => ({ role: m.role, content: m.content })), companyDetails);
        if (or && or.text) answer = or.text;
      } catch (_) { /* silencieux */ }
    }
    const resp = answer || 'Je n\'ai pas trouvé de réponse pour cette question. Vérifiez vos clés IA (bouton "Clés IA") ou reformulez votre question.';
    setMessages(prev => [...prev, { role: 'assistant', content: resp }]);
    setLoading(false);
    setInput('');
  };

  const saveGemini = () => {
    if (geminiKey.trim()) setApiKey(geminiKey.trim());
    else clearApiKey();
    setShowKeys(false);
  };

  const saveOpenRouter = () => {
    if (orKey.trim()) setOpenRouterKey(orKey.trim());
    setShowKeys(false);
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Bot className="w-6 h-6 text-brand-400" /> Assistant Comptable IA
          </h2>
          <p className="text-sm text-slate-400">Fiscalité tunisienne, comptabilité SCE et conseils — moteur : <span className="text-amber-400">{engineLabel()}</span></p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowKeys(v => !v)} className="px-3 py-2 rounded-xl text-xs bg-slate-800/70 hover:bg-slate-700/70 text-slate-300 border border-slate-700/60 flex items-center gap-1.5 transition"><KeyRound className="w-3.5 h-3.5" /> Clés IA</button>
          <button onClick={() => setMessages(WELCOME)} className="px-3 py-2 rounded-xl text-xs bg-slate-800/70 hover:bg-slate-700/70 text-slate-300 border border-slate-700/60 flex items-center gap-1.5 transition"><Trash2 className="w-3.5 h-3.5" /> Effacer</button>
        </div>
      </div>

      {showKeys && (
        <div className="mb-4 p-4 bg-slate-800/60 border border-slate-700/60 rounded-2xl space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Clé Gemini (google.generativeai — gemini-2.0-flash)</label>
            <div className="flex gap-2">
              <input type="password" value={geminiKey} onChange={e => setGeminiKey(e.target.value)} placeholder="AIza..." className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-xs text-slate-200" />
              <button onClick={saveGemini} className="px-3 py-2 rounded-xl text-xs bg-brand-600 hover:bg-brand-500 text-white transition">Enregistrer</button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Clé OpenRouter (modèles gratuits — secours)</label>
            <div className="flex gap-2">
              <input type="password" value={orKey} onChange={e => setOrKey(e.target.value)} placeholder="sk-or-..." className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-xs text-slate-200" />
              <button onClick={saveOpenRouter} className="px-3 py-2 rounded-xl text-xs bg-indigo-600 hover:bg-indigo-500 text-white transition">Enregistrer</button>
            </div>
            <div className="mt-3">
              <OpenRouterGuide />
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 260px)' }}>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-2 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 ${m.role === 'user' ? 'bg-emerald-600/20 border border-emerald-600/30' : 'bg-brand-600/20 border border-brand-500/30'}`}>
                  {m.role === 'user' ? <User className="w-3.5 h-3.5 text-emerald-400" /> : <Bot className="w-3.5 h-3.5 text-brand-400" />}
                </div>
                <div className={`p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'bg-emerald-600/15 border border-emerald-600/20 text-emerald-100' : 'bg-slate-800/70 border border-slate-700/60 text-slate-200'}`}>
                  {m.content}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="p-3 rounded-2xl bg-slate-800/70 border border-slate-700/60 text-sm text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {messages.length <= 1 && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {getSuggestedQueries().slice(0, 8).map(sq => (
              <button key={sq} onClick={() => send(sq)} className="px-2.5 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/50 text-[11px] text-slate-400 hover:text-amber-300 hover:border-amber-500/30 transition-all">{sq}</button>
            ))}
          </div>
        )}

        <form onSubmit={e => { e.preventDefault(); send(); }} className="p-3 border-t border-slate-800/60 flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Posez une question (français ou arabe)..."
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
          />
          <button type="submit" disabled={loading || !input.trim()} className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white flex items-center gap-1.5 text-sm font-medium transition">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
