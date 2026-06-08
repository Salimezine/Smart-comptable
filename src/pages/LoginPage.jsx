import React, { useState } from 'react';
import { Lock, Mail, Eye, EyeOff, LogIn, Sparkles, UserPlus, ArrowRight, Fingerprint } from 'lucide-react';

function Input({ icon: Icon, ...props }) {
  return (
    <div className="relative">
      {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />}
      <input
        {...props}
        className={`w-full bg-slate-900/60 border border-slate-700 focus:border-brand-500 rounded-xl py-3 text-sm text-slate-200 focus:outline-none transition-colors placeholder:text-slate-600 ${Icon ? 'pl-10 pr-4' : 'px-4'}`}
      />
    </div>
  );
}

export default function LoginPage({ onLogin, onNavigateRegister, onNavigateInvite }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Veuillez remplir tous les champs'); return; }
    setLoading(true);
    try {
      await onLogin(email, password, remember);
    } catch (err) {
      setError(err.message || 'Erreur de connexion');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-brand flex items-center justify-center shadow-glow mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">Smart Comptable</h1>
          <p className="text-slate-400 text-sm mt-1">Connectez-vous à votre espace</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs text-center">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Email</label>
            <Input icon={Mail} type="email" placeholder="expert@comptable.tn" value={email} onChange={e => setEmail(e.target.value)} autoFocus />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Mot de passe</label>
            <div className="relative">
              <Input icon={Lock} type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="rounded border-slate-700 bg-slate-900 text-brand-500 focus:ring-brand-500" />
              <span className="text-xs text-slate-400">Se souvenir de moi</span>
            </label>
          </div>

          <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-brand hover:opacity-90 text-white font-bold rounded-xl transition-all duration-300 shadow-glow disabled:opacity-50">
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <><LogIn className="w-4 h-4" /> Se connecter</>
            )}
          </button>

          <div className="pt-2 space-y-2">
            <button type="button" onClick={onNavigateRegister} className="w-full flex items-center justify-center gap-2 py-2.5 border border-slate-700 hover:border-brand-500 text-slate-300 hover:text-white rounded-xl text-sm transition-all duration-200">
              <UserPlus className="w-4 h-4" /> Créer un compte
            </button>
            <button type="button" onClick={onNavigateInvite} className="w-full flex items-center justify-center gap-2 py-2 text-xs text-slate-500 hover:text-brand-400 transition-colors">
              <ArrowRight className="w-3 h-3" /> Rejoindre avec un code d'invitation
            </button>
          </div>


        </form>
      </div>
    </div>
  );
}
