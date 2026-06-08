import React, { useState } from 'react';
import { Lock, Mail, Eye, EyeOff, LogIn, Sparkles, UserPlus, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { getUserByEmail, updateUser, sha256 } from '../utils/auth/userStore';

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

const RESET_CODE_KEY = 'sc_reset_code_pwd';

export default function LoginPage({ onLogin, onNavigateRegister, onNavigateInvite, onDemo }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(null);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotUser, setForgotUser] = useState(null);
  const [resetCode, setResetCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState('email');

  const handleSendResetCode = () => {
    if (!forgotEmail) { setError('Veuillez entrer votre email'); return; }
    const user = getUserByEmail(forgotEmail);
    if (!user) { setError('Aucun compte trouvé avec cet email'); return; }
    setForgotUser(user);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedCode(code);
    localStorage.setItem(RESET_CODE_KEY, JSON.stringify({ code, userId: user.id, expires: Date.now() + 10 * 60 * 1000 }));
    setStep('code');
    setError('');
    window.location.href = `mailto:${user.email}?subject=Code%20de%20r%C3%A9initialisation%20-%20Smart%20Comptable&body=Bonjour%2C%0D%0A%0D%0AVoici%20votre%20code%20de%20r%C3%A9initialisation%20%3A%20${code}%0D%0A%0D%0ACe%20code%20est%20valable%2010%20minutes.%0D%0A%0D%0ASmart%20Comptable`;
  };

  const handleVerifyCode = () => {
    const stored = localStorage.getItem(RESET_CODE_KEY);
    if (!stored) { setError('Code expiré. Recommencez.'); return; }
    const data = JSON.parse(stored);
    if (data.expires < Date.now()) { setError('Code expiré. Recommencez.'); return; }
    if (resetCode !== data.code) { setError('Code incorrect'); return; }
    setStep('newpwd');
    setError('');
    setNewPassword('');
  };

  const handleSetNewPassword = async () => {
    if (newPassword.length < 6) { setError('Minimum 6 caractères'); return; }
    const hash = await sha256(newPassword);
    updateUser(forgotUser.id, { passwordHash: hash });
    localStorage.removeItem(RESET_CODE_KEY);
    setForgotMode(null);
    setEmail(forgotUser.email);
    setError('Mot de passe réinitialisé. Connectez-vous.');
  };

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

        <form onSubmit={forgotMode ? (e => { e.preventDefault(); if (step === 'email') handleSendResetCode(); else if (step === 'code') handleVerifyCode(); else handleSetNewPassword(); }) : handleSubmit} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-4">
          {forgotMode ? (
            <>
              <div className="flex items-center gap-3 mb-2">
                <button type="button" onClick={() => { setForgotMode(null); setStep('email'); setError(''); }} className="text-slate-500 hover:text-slate-300">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h2 className="text-lg font-bold text-white">Mot de passe oublié</h2>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs text-center">{error}</div>
              )}

              {step === 'email' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-400">Entrez votre email pour recevoir un code de réinitialisation.</p>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-400">Email</label>
                    <Input icon={Mail} type="email" placeholder="expert@comptable.tn" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} autoFocus />
                  </div>
                  <button type="submit" className="w-full py-3 bg-gradient-brand hover:opacity-90 text-white font-bold rounded-xl transition-all shadow-glow">
                    Envoyer le code
                  </button>
                </div>
              )}

              {step === 'code' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-400">Un email avec un code à 6 chiffres vous a été envoyé.</p>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-400">Code de vérification</label>
                    <Input type="text" placeholder="000000" value={resetCode} onChange={e => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))} autoFocus />
                  </div>
                  <button type="submit" className="w-full py-3 bg-gradient-brand hover:opacity-90 text-white font-bold rounded-xl transition-all shadow-glow">
                    Vérifier le code
                  </button>
                  <button type="button" onClick={() => { setStep('email'); setResetCode(''); setError(''); }} className="w-full text-xs text-slate-500 hover:text-brand-400 transition-colors">
                    Renvoyer le code
                  </button>
                </div>
              )}

              {step === 'newpwd' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-400">Choisissez un nouveau mot de passe (minimum 6 caractères).</p>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-400">Nouveau mot de passe</label>
                    <div className="relative">
                      <Input icon={Lock} type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoFocus />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <button type="submit" className="w-full py-3 bg-gradient-brand hover:opacity-90 text-white font-bold rounded-xl transition-all shadow-glow">
                    <CheckCircle2 className="w-4 h-4" /> Réinitialiser
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
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
                <button type="button" onClick={() => { setForgotMode(true); setForgotEmail(email); setStep('email'); setError(''); }} className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
                  Mot de passe oublié ?
                </button>
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
              <div className="pt-2 border-t border-slate-800">
                <button type="button" onClick={onDemo} className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-xl border border-emerald-500/20 transition-all">
                  <Sparkles className="w-3.5 h-3.5" /> Mode démo — Exploration libre
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
