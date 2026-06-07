import React, { useState } from 'react';
import { Sparkles, UserPlus, ArrowLeft, Check } from 'lucide-react';
import { PLAN_LIST, PLANS } from '../utils/auth/plansManager';

const COLORS = { gray: 'bg-slate-600', blue: 'bg-blue-600', violet: 'bg-violet-600', gold: 'bg-amber-500' };
const BORDER_COLORS = { gray: 'border-slate-600', blue: 'border-blue-500', violet: 'border-violet-500', gold: 'border-amber-500' };
const TEXT_COLORS = { gray: 'text-slate-300', blue: 'text-blue-400', violet: 'text-violet-400', gold: 'text-amber-400' };
const BG_LIGHT = { gray: 'bg-slate-800/40', blue: 'bg-blue-500/10', violet: 'bg-violet-500/10', gold: 'bg-amber-500/10' };

export default function RegisterPage({ onRegister, onBack }) {
  const [step, setStep] = useState(0);
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [societeNom, setSocieteNom] = useState('');
  const [matriculeFiscal, setMatriculeFiscal] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('free');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateStep0 = () => {
    if (!nom.trim()) { setError('Nom requis'); return false; }
    if (!email.trim() || !email.includes('@')) { setError('Email invalide'); return false; }
    if (password.length < 6) { setError('Mot de passe : min 6 caractères'); return false; }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas'); return false; }
    setError('');
    return true;
  };

  const handleNext = () => {
    if (step === 0 && !validateStep0()) return;
    setError('');
    setStep(step + 1);
  };

  const handleSubmit = async () => {
    if (!societeNom.trim()) { setError('Nom de société requis'); return; }
    setLoading(true);
    setError('');
    try {
      await onRegister({ nom, email, password, societeNom, matriculeFiscal, plan: selectedPlan });
    } catch (err) {
      setError(err.message || 'Erreur lors de l\'inscription');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-brand flex items-center justify-center shadow-glow mx-auto mb-3">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-extrabold text-white">Créer un compte</h1>
          <p className="text-slate-400 text-xs mt-1">{step === 0 ? 'Informations personnelles' : 'Configuration entreprise'}</p>
        </div>

        {step === 0 && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-4">
            {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs text-center">{error}</div>}

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Nom complet</label>
              <input type="text" value={nom} onChange={e => setNom(e.target.value)} placeholder="Mohamed Ben Ali" className="w-full bg-slate-900/60 border border-slate-700 focus:border-brand-500 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none placeholder:text-slate-600" autoFocus />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="expert@comptable.tn" className="w-full bg-slate-900/60 border border-slate-700 focus:border-brand-500 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none placeholder:text-slate-600" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Mot de passe</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 caractères" className="w-full bg-slate-900/60 border border-slate-700 focus:border-brand-500 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none placeholder:text-slate-600" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Confirmer mot de passe</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" className="w-full bg-slate-900/60 border border-slate-700 focus:border-brand-500 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none placeholder:text-slate-600" />
            </div>

            <button onClick={handleNext} className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-brand hover:opacity-90 text-white font-bold rounded-xl transition-all duration-300 shadow-glow">
              Suivant
            </button>
            <button onClick={onBack} className="w-full flex items-center justify-center gap-2 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors">
              <ArrowLeft className="w-3 h-3" /> Retour
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-4">
              {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs text-center">{error}</div>}

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Nom de la société</label>
                <input type="text" value={societeNom} onChange={e => setSocieteNom(e.target.value)} placeholder="Carthage Creative Studio" className="w-full bg-slate-900/60 border border-slate-700 focus:border-brand-500 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none placeholder:text-slate-600" autoFocus />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Matricule Fiscal (optionnel)</label>
                <input type="text" value={matriculeFiscal} onChange={e => setMatriculeFiscal(e.target.value)} placeholder="1234567/X/A/M/000" className="w-full bg-slate-900/60 border border-slate-700 focus:border-brand-500 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none placeholder:text-slate-600" />
              </div>
            </div>

            <div className="text-center">
              <p className="text-xs font-medium text-slate-400 mb-3">Choisissez votre formule</p>
              <div className="grid grid-cols-2 gap-3">
                {PLAN_LIST.map(id => {
                  const plan = PLANS[id];
                  const selected = selectedPlan === id;
                  return (
                    <button key={id} onClick={() => setSelectedPlan(id)}
                      className={`relative p-4 rounded-xl border text-left transition-all duration-200 ${selected ? `${BORDER_COLORS[plan.color]} ${BG_LIGHT[plan.color]}` : 'border-slate-800 bg-slate-900/30 hover:border-slate-600'}`}>
                      {selected && <Check className="absolute top-2 right-2 w-4 h-4 text-brand-400" />}
                      <div className={`w-3 h-3 rounded-full ${COLORS[plan.color]} mb-2`} />
                      <p className="text-sm font-bold text-white">{plan.label}</p>
                      <p className="text-lg font-extrabold text-white mt-1">{plan.price}</p>
                      <ul className="mt-2 space-y-1">
                        {Object.entries(plan.limits).slice(0, 3).map(([k, v]) => (
                          <li key={k} className="text-[10px] text-slate-400">{v === Infinity ? 'Illimité' : v} {k.replace(/_/g, ' ')}</li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>
            </div>

            <button onClick={handleSubmit} disabled={loading} className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-brand hover:opacity-90 text-white font-bold rounded-xl transition-all duration-300 shadow-glow disabled:opacity-50">
              {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><UserPlus className="w-4 h-4" /> Créer mon compte</>}
            </button>
            <button onClick={() => { setStep(0); setError(''); }} className="w-full flex items-center justify-center gap-2 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors">
              <ArrowLeft className="w-3 h-3" /> Modifier mes informations
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
