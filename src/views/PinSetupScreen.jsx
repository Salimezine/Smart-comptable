import React, { useState, useRef, useEffect } from 'react';
import { Lock, KeyRound } from 'lucide-react';

export default function PinSetupScreen({ onComplete }) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [step, setStep] = useState('create');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, [step]);

  const handleCreate = (e) => {
    e.preventDefault();
    setError('');
    setStep('confirm');
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    if (pin !== confirm) {
      setError('Les codes ne correspondent pas');
      setConfirm('');
      return;
    }
    await onComplete(pin);
  };

  const handleReset = () => {
    setStep('create');
    setPin('');
    setConfirm('');
    setError('');
  };

  if (step === 'confirm') {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
        <form onSubmit={handleConfirm} className="glass-card p-10 rounded-3xl border border-slate-800 max-w-sm w-full space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center mx-auto">
            <KeyRound className="w-8 h-8 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-100">Confirmer le code</h1>
            <p className="text-sm text-slate-400 mt-1">Saisissez à nouveau votre code à 4-6 chiffres</p>
          </div>
          {error && <p className="text-xs text-red-400 font-semibold">{error}</p>}
          <input
            ref={inputRef}
            type="password"
            maxLength="6"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={confirm}
            onChange={e => { setConfirm(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
            placeholder="● ● ● ● ● ●"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] text-slate-100 focus:outline-none focus:border-brand-500 placeholder:text-slate-700"
          />
          <div className="flex gap-3">
            <button type="button" onClick={handleReset} className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs hover:bg-slate-700 transition-all">
              Retour
            </button>
            <button type="submit" disabled={confirm.length < 4} className="flex-1 py-3 bg-gradient-brand text-white font-bold rounded-xl text-sm shadow-glow hover:opacity-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              Confirmer
            </button>
          </div>
        </form>
    </div>
  );
}

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
      <form onSubmit={handleCreate} className="glass-card p-10 rounded-3xl border border-slate-800 max-w-sm w-full space-y-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-brand flex items-center justify-center mx-auto shadow-glow">
          <Lock className="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100">Sécurisez votre application</h1>
          <p className="text-sm text-slate-400 mt-1">Créez un code de verrouillage à 4-6 chiffres</p>
        </div>
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
          Créer le code
        </button>
        <p className="text-[10px] text-slate-600">Ce code protège vos données financières contre tout accès non autorisé</p>
      </form>
    </div>
  );
}
