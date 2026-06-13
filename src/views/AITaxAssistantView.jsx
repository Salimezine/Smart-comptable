import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, MessageSquare, Lightbulb, RefreshCw, Mic, Volume2, Trash2 } from 'lucide-react';
import { generateResponse, getSuggestedPrompts } from '../utils/taxAssistant';

function ChatMessage({ msg, isLastAssistant }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
        isUser ? 'bg-gradient-to-br from-brand-500 to-brand-600' : 'bg-gradient-to-br from-emerald-500 to-emerald-600'
      }`}>
        {isUser ? <MessageSquare className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
      </div>
      <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`rounded-2xl px-5 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-gradient-to-br from-brand-500/20 to-brand-600/10 border border-brand-500/20 text-white'
            : 'bg-slate-800/60 border border-slate-700/50 text-slate-200'
        }`}>
          <div dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br/>') }} />
        </div>
        <p className="text-[10px] text-slate-500 mt-1 px-1">{isUser ? 'Vous' : 'Assistant Fiscal IA'}</p>
      </div>
    </div>
  );
}

export default function AITaxAssistantView() {
  const [messages, setMessages] = useState([
    { id: 'welcome', role: 'assistant', content: '👋 **Bienvenue sur l\'Assistant Fiscal IA Smart Comptable**\n\nJe suis votre conseiller virtuel spécialisé dans la fiscalité tunisienne. Posez-moi toutes vos questions sur la TVA, l\'IRPP, l\'IS, les déclarations, ou choisissez une suggestion ci-dessous.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationMode, setConversationMode] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const clearChat = () => {
    setMessages([
      { id: 'welcome', role: 'assistant', content: '👋 **Bienvenue sur l\'Assistant Fiscal IA Smart Comptable**\n\nNouvelle conversation démarrée. Comment puis-je vous aider ?' },
    ]);
  };

  const handleSend = async (query) => {
    const q = (query || input).trim();
    if (!q || loading) return;
    setInput('');

    const userMsg = { id: `user_${Date.now()}`, role: 'user', content: q };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    setTimeout(() => {
      try {
        const history = messages.filter(m => m.role === 'assistant' && m.type).map(m => ({ type: m.type, content: m.content }));
        const response = generateResponse(q, { history });
        const assistantMsg = {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          content: response.message,
          type: response.type,
          data: response.data,
        };
        setMessages(prev => [...prev, assistantMsg]);
      } catch {
        setMessages(prev => [...prev, { id: `err_${Date.now()}`, role: 'assistant', content: '❌ Désolé, une erreur est survenue. Veuillez réessayer.' }]);
      }
      setLoading(false);
    }, 800);
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  const suggestedPrompts = getSuggestedPrompts();
  const lastAssistantType = messages.filter(m => m.role === 'assistant' && m.type).pop()?.type;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20">
          <Bot className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-white">Assistant Fiscal IA</h2>
          <p className="text-xs text-slate-400">Conseiller virtuel spécialisé fiscalité tunisienne</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={clearChat}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-700/50 bg-slate-800 text-slate-400 hover:border-red-500/30 hover:text-red-400 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nouvelle conversation</span>
          </button>
          <button
            onClick={() => setConversationMode(!conversationMode)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              conversationMode ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700/50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Mode expert
          </button>
        </div>
      </div>

      <div className="flex-1 bg-slate-900/40 border border-slate-800/60 rounded-2xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
          {lastAssistantType && messages.length > 2 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/40 border border-slate-700/30 text-xs text-slate-500">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Contexte : <span className="text-slate-300 font-medium">{lastAssistantType.replace(/_/g, ' ')}</span></span>
              <span className="text-slate-600">— Posez une question de suivi</span>
            </div>
          )}
          {messages.map(msg => (
            <ChatMessage key={msg.id} msg={msg} isLastAssistant={msg.role === 'assistant' && msg === messages[messages.length - 1]} />
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                <RefreshCw className="w-4 h-4 text-white animate-spin" />
              </div>
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl px-5 py-3">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          {messages.length === 1 && (
            <div className="mt-4">
              <p className="text-xs text-slate-500 mb-3 flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                Suggestions de questions
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {suggestedPrompts.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(p.query)}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:border-brand-500/30 hover:bg-slate-800 transition-all text-left text-xs text-slate-300 hover:text-white"
                  >
                    <span className="text-base">{p.icon}</span>
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-slate-800/50 p-4 bg-slate-900/60">
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Posez votre question sur la fiscalité tunisienne..."
              className="flex-1 bg-slate-900 border border-slate-700/80 focus:border-emerald-500/50 rounded-xl px-5 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition-colors"
              disabled={loading}
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="px-5 py-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white font-bold text-sm shadow-lg hover:shadow-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Envoyer</span>
            </button>
          </div>
          <p className="text-[10px] text-slate-600 mt-2">Smart Comptable n'est pas un conseiller fiscal agréé. Validez toujours vos déclarations avec un expert-comptable.</p>
        </div>
      </div>
    </div>
  );
}
