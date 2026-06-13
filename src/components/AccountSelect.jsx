import { useState, useRef, useEffect } from 'react';
import { Search, BookOpen } from 'lucide-react';
import { PCG_COMPLET } from '../utils/pcgComplet';

const ACCOUNTS = Object.entries(PCG_COMPLET).map(([code, label]) => ({ code, label }));

function findLibelle(code) {
  if (PCG_COMPLET[code]) return PCG_COMPLET[code];
  const match = Object.keys(PCG_COMPLET)
    .filter(k => code.startsWith(k))
    .sort((a, b) => b.length - a.length);
  return match.length > 0 ? PCG_COMPLET[match[0]] : '';
}

export default function AccountSelect({ value, onChange, placeholder = 'ex: 401000', inputRef, className = '', disabled = false }) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const wrapperRef = useRef(null);
  const internalRef = useRef(null);
  const actualRef = inputRef || internalRef;

  useEffect(() => {
    if (value !== undefined) setQuery(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleInput(val) {
    setQuery(val);
    if (val.length < 1) { setSuggestions([]); setShowSuggestions(false); return; }
    const lower = val.toLowerCase();
    const filtered = ACCOUNTS
      .filter(a => a.code.includes(val) || a.label.toLowerCase().includes(lower))
      .slice(0, 15);
    setSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
    setHighlightIdx(-1);
  }

  function selectAccount(code) {
    setQuery(code);
    setShowSuggestions(false);
    setShowModal(false);
    setModalSearch('');
    if (onChange) onChange(code, findLibelle(code));
  }

  function handleKeyDown(e) {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') setShowModal(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && highlightIdx >= 0) {
      e.preventDefault();
      selectAccount(suggestions[highlightIdx].code);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  }

  const modalResults = modalSearch
    ? ACCOUNTS.filter(a => a.code.includes(modalSearch) || a.label.toLowerCase().includes(modalSearch.toLowerCase()))
    : ACCOUNTS;

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      <div className="flex gap-1">
        <div className="relative flex-1">
          <input
            ref={actualRef}
            type="text"
            value={query}
            onChange={e => handleInput(e.target.value)}
            onFocus={() => query.length >= 1 && suggestions.length > 0 && setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-brand-500 font-mono disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {showSuggestions && (
            <div className="absolute z-40 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg bg-slate-800 border border-slate-700 shadow-xl">
              {suggestions.map((a, i) => (
                <div key={a.code}
                  className={`flex items-center justify-between px-2 py-1.5 text-xs cursor-pointer transition-colors ${i === highlightIdx ? 'bg-brand-500/20 text-brand-300' : 'text-slate-300 hover:bg-slate-700/50'}`}
                  onClick={() => selectAccount(a.code)}
                  onMouseEnter={() => setHighlightIdx(i)}>
                  <span className="font-mono text-slate-400">{a.code}</span>
                  <span className="truncate ml-2">{a.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button type="button" onClick={() => setShowModal(true)} disabled={disabled}
          className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-brand-300 hover:border-brand-500/30 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed">
          <BookOpen className="w-3.5 h-3.5" />
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => { setShowModal(false); setModalSearch(''); }}>
          <div className="relative w-full max-w-2xl max-h-[80vh] rounded-xl bg-slate-800 border border-slate-700/60 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-sm font-bold text-slate-200">Plan Comptable</h3>
              <button onClick={() => { setShowModal(false); setModalSearch(''); }} className="text-slate-400 hover:text-slate-200 text-lg">✕</button>
            </div>
            <div className="p-4 border-b border-slate-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type="text" value={modalSearch} onChange={e => setModalSearch(e.target.value)}
                  placeholder="Rechercher un compte (code ou libellé)..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500" />
              </div>
            </div>
            <div className="overflow-y-auto p-4 space-y-0.5 flex-1">
              {modalResults.map(({ code, label }) => (
                <div key={code} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-700/50 cursor-pointer text-xs"
                  onClick={() => selectAccount(code)}>
                  <span className="font-mono text-slate-400">{code}</span>
                  <span className="text-slate-200">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { findLibelle };
