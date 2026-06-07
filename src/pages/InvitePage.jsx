import React, { useState } from 'react';
import { Sparkles, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { getInvitationByCode } from '../utils/auth/userStore';

export default function InvitePage({ onJoin, onBack }) {
  const [code, setCode] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [invitation, setInvitation] = useState(null);

  const handleCheckCode = () => {
    if (!code.trim() || !code.startsWith('INV-')) { setError('Code invalide (format: INV-XXXXXX)'); return; }
    try {
      const inv = getInvitationByCode(code.trim());
      if (!inv) { setError('Code invalide ou déjà utilisé'); return; }
      setInvitation(inv);
      setStep(1);
      setError('');
    } catch (err) { setError('Erreur de vérification'); }
  };

  const handleSubmit = async () => {
    if (!nom.trim() || !email.trim() || password.length < 8) { setError('Mot de passe : min 8 caractères'); return; }
    if (!/[A-Z]/.test(password)) { setError('Mot de passe : doit contenir une majuscule'); return; }
    if (!/\d/.test(password)) { setError('Mot de passe : doit contenir un chiffre'); return; }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas'); return; }
    setLoading(true);
    setError('');
    try {
      await onJoin({ nom, email, password, code: code.trim(), invitation });
    } catch (err) { setError(err.message || 'Erreur lors de l\'inscription'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-brand flex items-center justify-center shadow-glow mx-auto mb-3">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-extrabold text-white">Rejoindre une société</h1>
          <p className="text-slate-400 text-xs mt-1">{step === 0 ? 'Entrez votre code d\'invitation' : 'Créez votre compte'}</p>
        </div>

        {step === 0 && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-4">
            {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs text-center">{error}</div>}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Code d'invitation</label>
              <input type="text" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="INV-ABCDEF" className="w-full bg-slate-900/60 border border-slate-700 focus:border-brand-500 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none placeholder:text-slate-600 text-center font-bold tracking-widest" autoFocus />
            </div>
            <button onClick={handleCheckCode} className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-brand hover:opacity-90 text-white font-bold rounded-xl transition-all duration-300 shadow-glow">
              Vérifier le code
            </button>
            <button onClick={onBack} className="w-full flex items-center justify-center gap-2 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors">
              <ArrowLeft className="w-3 h-3" /> Retour
            </button>
          </div>
        )}

        {step === 1 && invitation && (
          <div className="space-y-4">
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <Check className="w-5 h-5 text-green-400" />
                <div>
                  <p className="text-sm font-bold text-white">Invitation valide</p>
                  <p className="text-xs text-slate-400">Rôle: <span className="text-brand-400 font-medium">{invitation.role}</span></p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-4">
              {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs text-center">{error}</div>}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Nom complet</label>
                <input type="text" value={nom} onChange={e => setNom(e.target.value)} placeholder="Votre nom" className="w-full bg-slate-900/60 border border-slate-700 focus:border-brand-500 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none placeholder:text-slate-600" autoFocus />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemple.tn" className="w-full bg-slate-900/60 border border-slate-700 focus:border-brand-500 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none placeholder:text-slate-600" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Mot de passe</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 car. + majuscule + chiffre" className="w-full bg-slate-900/60 border border-slate-700 focus:border-brand-500 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none placeholder:text-slate-600" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Confirmer</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" className="w-full bg-slate-900/60 border border-slate-700 focus:border-brand-500 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none placeholder:text-slate-600" />
              </div>
              <button onClick={handleSubmit} disabled={loading} className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-brand hover:opacity-90 text-white font-bold rounded-xl transition-all duration-300 shadow-glow disabled:opacity-50">
                {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><ArrowRight className="w-4 h-4" /> Rejoindre</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
