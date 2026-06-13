import React, { useState } from 'react';
import { Lock, Mail, Eye, EyeOff, LogIn, Sparkles, UserPlus, ArrowRight, ArrowLeft, CheckCircle2, Shield, Zap, BarChart3, FileCheck, RefreshCw } from 'lucide-react';
import { getUserByEmail, updateUser, sha256 } from '../utils/auth/userStore';

const EMAILJS_SERVICE_ID = 'Smart-Comptable';
const EMAILJS_TEMPLATE_ID = 'template_7k7ebdv';
const EMAILJS_PUBLIC_KEY = 'NhgDOZdl-hiwqNXX9';

function Input({ icon: Icon, ...props }) {
  return (
    <div className="relative group">
      {Icon && <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors duration-200" />}
      <input
        {...props}
        className={`w-full bg-slate-900/50 border border-slate-700/60 focus:border-indigo-500/60 focus:ring-0 focus:shadow-[0_0_20px_rgba(99,102,241,0.15)] rounded-xl py-3 text-sm text-slate-100 focus:outline-none transition-all duration-200 placeholder:text-slate-600 ${Icon ? 'pl-11 pr-4' : 'px-4'}`}
      />
    </div>
  );
}

const RESET_CODE_KEY = 'sc_reset_code_pwd';

const features = [
  {
    icon: <Sparkles className="w-5 h-5" />,
    color: 'from-indigo-500 to-violet-500',
    glow: 'rgba(99,102,241,0.4)',
    title: 'OCR Intelligent',
    desc: 'Scannez vos factures, l\'IA extrait tout automatiquement — 100% local, zéro API.',
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    color: 'from-emerald-500 to-teal-500',
    glow: 'rgba(16,185,129,0.4)',
    title: 'Bilan & Compte de Résultat',
    desc: 'Génération automatique du bilan SCE et des états financiers aux normes tunisiennes.',
  },
  {
    icon: <FileCheck className="w-5 h-5" />,
    color: 'from-amber-500 to-orange-500',
    glow: 'rgba(245,158,11,0.4)',
    title: 'Déclarations Fiscales',
    desc: 'TVA, IS, Retenue à la Source et liasse fiscale conformes LF 2025.',
  },
  {
    icon: <Shield className="w-5 h-5" />,
    color: 'from-rose-500 to-pink-500',
    glow: 'rgba(244,63,94,0.4)',
    title: 'Audit & Conformité PCG',
    desc: 'Score d\'audit en temps réel avec détection des anomalies comptables.',
  },
  {
    icon: <Zap className="w-5 h-5" />,
    color: 'from-cyan-500 to-blue-500',
    glow: 'rgba(6,182,212,0.4)',
    title: 'TEIF & Télédéclaration',
    desc: 'Export XML TEIF v2, validation automatique et envoi aux instances fiscales.',
  },
];

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

  const handleSendResetCode = async () => {
    if (!forgotEmail) { setError('Veuillez entrer votre email'); return; }
    const user = getUserByEmail(forgotEmail);
    if (!user) { setError('Aucun compte trouvé avec cet email'); return; }
    setForgotUser(user);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedCode(code);
    localStorage.setItem(RESET_CODE_KEY, JSON.stringify({ code, userId: user.id, expires: Date.now() + 10 * 60 * 1000 }));
    try {
      const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: EMAILJS_SERVICE_ID,
          template_id: EMAILJS_TEMPLATE_ID,
          user_id: EMAILJS_PUBLIC_KEY,
          template_params: {
            to_email: user.email,
            to_name: user.prenom || 'Utilisateur',
            otp: code, code: code, otp_code: code,
            message: `Votre code de verification : ${code}`,
          },
        }),
      });
      if (!res.ok) { const text = await res.text(); setError(`EmailJS ${res.status}: ${text}`); return; }
      setStep('code');
    } catch (err) { setError(`Erreur: ${err.message}`); }
  };

  const handleVerifyCode = () => {
    const stored = localStorage.getItem(RESET_CODE_KEY);
    if (!stored) { setError('Code expiré. Recommencez.'); return; }
    const data = JSON.parse(stored);
    if (data.expires < Date.now()) { setError('Code expiré. Recommencez.'); return; }
    if (resetCode !== data.code) { setError('Code incorrect'); return; }
    setStep('newpwd'); setError(''); setNewPassword('');
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
    try { await onLogin(email, password, remember); }
    catch (err) { setError(err.message || 'Erreur de connexion'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex overflow-hidden">
      {/* ── Left Panel — Feature Showcase ── */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-12 overflow-hidden">
        {/* Background gradient mesh */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-indigo-950/30 to-slate-950" />
        <div className="ambient-orb w-[500px] h-[500px] bg-indigo-600/10 top-[-100px] left-[-100px]" />
        <div className="ambient-orb w-[400px] h-[400px] bg-emerald-600/8 bottom-[-80px] right-[-80px]" />

        {/* Animated grid lines */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3 animate-fade-in">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.5)]">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-black text-lg text-white tracking-tight">Smart <span className="gradient-text-brand">Comptable</span></span>
            <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-medium">Tunisia · PCG 2025</p>
          </div>
        </div>

        {/* Hero text */}
        <div className="relative z-10 space-y-6 animate-slide-in-left" style={{ animationDelay: '0.1s' }}>
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-xs font-semibold text-indigo-400">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              100% local · Zéro cloud · Données privées
            </div>
            <h2 className="text-4xl font-black text-white leading-tight">
              La comptabilité tunisienne{' '}
              <span className="shimmer-text">intelligente</span>
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed max-w-md">
              Factures OCR, bilan automatique, déclarations fiscales et audit en temps réel — tout dans votre navigateur, sans abonnement cloud.
            </p>
          </div>

          {/* Feature cards */}
          <div className="space-y-3">
            {features.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-4 rounded-2xl bg-slate-900/50 border border-slate-800/60 hover:border-slate-700/80 transition-all duration-300 group card-hover"
                style={{ animationDelay: `${0.15 + i * 0.08}s` }}
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center shrink-0 text-white shadow-lg transition-transform duration-300 group-hover:scale-110`}
                  style={{ boxShadow: `0 4px 16px ${f.glow}` }}>
                  {f.icon}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{f.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom disclaimer */}
        <p className="relative z-10 text-[10px] text-slate-600">
          © 2025 Smart Comptable · Conforme aux normes PCG Tunisie & LF 2025
        </p>
      </div>

      {/* ── Right Panel — Auth Form ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10 relative bg-slate-950/80">
        {/* Subtle ambient glows */}
        <div className="ambient-orb w-72 h-72 bg-indigo-600/6 top-1/4 right-1/4 translate-x-1/2" />
        <div className="ambient-orb w-56 h-56 bg-emerald-500/5 bottom-1/4 left-1/4" />

        <div className="w-full max-w-md relative z-10 animate-fade-in">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-[0_0_25px_rgba(99,102,241,0.4)]">
              <Sparkles className="w-6 h-6 text-white animate-pulse-soft" />
            </div>
            <div className="text-left">
              <h1 className="text-xl font-black text-white">Smart Comptable</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">PCG Tunisie 2025</p>
            </div>
          </div>

          {/* Form card */}
          <div className="glass-panel rounded-3xl p-8 border border-white/5 shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
            <form onSubmit={forgotMode
              ? (e => { e.preventDefault(); if (step === 'email') handleSendResetCode(); else if (step === 'code') handleVerifyCode(); else handleSetNewPassword(); })
              : handleSubmit}
              className="space-y-5"
            >
              {forgotMode ? (
                <>
                  <div className="flex items-center gap-3 mb-2">
                    <button type="button" onClick={() => { setForgotMode(null); setStep('email'); setError(''); }}
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors">
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <h2 className="text-lg font-bold text-white">Mot de passe oublié</h2>
                  </div>

                  {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs text-center">{error}</div>}

                  {step === 'email' && (
                    <div className="space-y-4">
                      <p className="text-xs text-slate-400">Entrez votre email pour recevoir un code de réinitialisation.</p>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-400">Email</label>
                        <Input icon={Mail} type="email" placeholder="expert@comptable.tn" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} autoFocus />
                      </div>
                      <button type="submit" className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white font-bold rounded-xl transition-all shadow-[0_4px_20px_rgba(99,102,241,0.35)]">
                        Envoyer le code
                      </button>
                    </div>
                  )}
                  {step === 'code' && (
                    <div className="space-y-4">
                      <p className="text-xs text-slate-400">Un code de vérification a été envoyé par email.</p>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-400">Code de vérification</label>
                        <Input type="text" placeholder="000000" value={resetCode} onChange={e => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))} autoFocus />
                      </div>
                      <button type="submit" className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold rounded-xl transition-all shadow-[0_4px_20px_rgba(99,102,241,0.35)]">
                        Vérifier le code
                      </button>
                      <button type="button" onClick={() => { setStep('email'); setResetCode(''); setError(''); }} className="w-full text-xs text-slate-500 hover:text-indigo-400 transition-colors">
                        Renvoyer un code
                      </button>
                    </div>
                  )}
                  {step === 'newpwd' && (
                    <div className="space-y-4">
                      <p className="text-xs text-slate-400">Choisissez un nouveau mot de passe (minimum 6 caractères).</p>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-400">Nouveau mot de passe</label>
                        <div className="relative">
                          <Input icon={Lock} type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoFocus />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <button type="submit" className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold rounded-xl transition-all shadow-[0_4px_20px_rgba(99,102,241,0.35)]">
                        <CheckCircle2 className="w-4 h-4" /> Réinitialiser
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="mb-6">
                    <h2 className="text-2xl font-black text-white flex items-center gap-3">
                      <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-[0_0_16px_rgba(99,102,241,0.4)]">
                        <LogIn className="w-4 h-4 text-white" />
                      </span>
                      Connexion
                    </h2>
                    <p className="text-slate-500 text-xs mt-3">Accédez à votre espace comptable sécurisé</p>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs text-center animate-slide-in-up">
                      {error}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400">Adresse email</label>
                    <Input icon={Mail} type="email" placeholder="expert@comptable.tn" value={email} onChange={e => setEmail(e.target.value)} autoFocus />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400">Mot de passe</label>
                    <div className="relative">
                      <Input icon={Lock} type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500" />
                      <span className="text-xs text-slate-400">Se souvenir de moi</span>
                    </label>
                    <button type="button" onClick={() => { setForgotMode(true); setForgotEmail(email); setStep('email'); setError(''); }}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
                      Mot de passe oublié ?
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white font-bold rounded-xl transition-all duration-300 shadow-[0_4px_24px_rgba(99,102,241,0.4)] hover:shadow-[0_6px_32px_rgba(99,102,241,0.6)] disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <><LogIn className="w-4 h-4" /> Se connecter</>
                    )}
                  </button>

                  <div className="pt-1 space-y-2.5">
                    <div className="relative flex items-center gap-3">
                      <div className="flex-1 h-px bg-slate-800" />
                      <span className="text-[10px] text-slate-600 uppercase tracking-widest">ou</span>
                      <div className="flex-1 h-px bg-slate-800" />
                    </div>

                    <button type="button" onClick={onNavigateRegister}
                      className="w-full flex items-center justify-center gap-2 py-3 border border-slate-700/80 hover:border-indigo-500/40 text-slate-300 hover:text-white rounded-xl text-sm font-medium transition-all duration-200 hover:bg-slate-900/40">
                      <UserPlus className="w-4 h-4" /> Créer un compte
                    </button>

                    <button type="button" onClick={onNavigateInvite}
                      className="w-full flex items-center justify-center gap-1 py-2 text-xs text-slate-500 hover:text-indigo-400 transition-colors">
                      <ArrowRight className="w-3 h-3" /> Rejoindre avec un code d'invitation
                    </button>
                  </div>

                  <div className="pt-1 border-t border-slate-800/60">
                    <button type="button" onClick={onDemo}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500/8 hover:bg-emerald-500/15 text-emerald-400 text-xs font-bold rounded-xl border border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-200">
                      <Sparkles className="w-3.5 h-3.5" /> Mode démo
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>

          <p className="text-center text-[10px] text-slate-700 mt-6">
            Vos données restent 100% sur votre appareil — aucun serveur externe.
          </p>
        </div>
      </div>
    </div>
  );
}
