import React, { useState, useRef, useEffect } from 'react';
import { Lock } from 'lucide-react';

export default function LockScreen({ onUnlock }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [showReset, setShowReset] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const ok = await onUnlock(pin);
    if (!ok) {
      setError('Code incorrect');
      setPin('');
    }
  };

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="glass-card p-10 rounded-3xl border border-slate-800 max-w-sm w-full space-y-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-brand flex items-center justify-center mx-auto shadow-glow">
          <Lock className="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100">Smart Comptable</h1>
          <p className="text-sm text-slate-400 mt-1">Entrez votre code de verrouillage</p>
        </div>
        {error && <p className="text-xs text-red-400 font-semibold">{error}</p>}
        <input
          ref={inputRef}
          type="password"
          maxLength="6"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={pin}
          onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
          placeholder="● ● ● ● ● ●"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] text-slate-100 focus:outline-none focus:border-brand-500 placeholder:text-slate-700"
        />
        <button type="submit" disabled={pin.length < 4} className="w-full py-3 bg-gradient-brand text-white font-bold rounded-xl text-sm shadow-glow hover:opacity-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
          Déverrouiller
        </button>
        <p className="text-[10px] text-slate-600">Verrouillage automatique après 5 minutes d'inactivité</p>
        <div className="space-y-2">
          {!showReset ? (
            <button type="button" onClick={() => setShowReset(true)} className="text-[10px] text-slate-600 hover:text-amber-400 underline transition-colors">
              Code oublié ?
            </button>
          ) : (
            <div className="space-y-2 pt-1">
              <p className="text-[10px] text-red-400/80">Réinitialiser effacera toutes les données.</p>
              <button type="button" onClick={() => { localStorage.clear(); window.location.reload(); }} className="text-[10px] px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/30 transition-all">
                Confirmer la réinitialisation
              </button>
              <button type="button" onClick={() => setShowReset(false)} className="text-[10px] text-slate-500 ml-2 hover:text-slate-300">
                Annuler
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
