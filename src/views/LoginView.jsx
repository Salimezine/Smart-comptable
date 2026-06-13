import React, { useState, useEffect } from 'react';
import { Shield, Lock, AlertTriangle, Key, User, Fingerprint, Clock, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { hashPIN, verifyPIN, recordFailedAttempt, clearFailedAttempts, isLockedOut, getLockoutRemaining, lockApp, unlockApp, setConfig } from '../utils/security/pinManager';
import { hasUsers, getUsers, createUser, getUserByEmail, updateUser } from '../utils/auth/userStore';
import { createSession } from '../utils/security/sessionManager';
import { logAction, AUDIT_ACTIONS } from '../utils/security/auditLog';

const RESET_CODE_KEY = 'sc_reset_code';
const EMAILJS_SERVICE_ID = 'Smart-Comptable';
const EMAILJS_TEMPLATE_ID = 'template_7k7ebdv';
const EMAILJS_PUBLIC_KEY = 'NhgDOZdl-hiwqNXX9';

export default function LoginView({ onLogin, companyId, onBack }) {
  const [mode, setMode] = useState('loading');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [setupData, setSetupData] = useState({ nom: '', prenom: '', email: '' });
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotUser, setForgotUser] = useState(null);
  const [resetCode, setResetCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [step, setStep] = useState('email');

  useEffect(() => {
    const u = hasUsers();
    const locked = isLockedOut();
    if (locked) {
      setMode('locked');
      updateLockout();
      return;
    }
    if (!u) {
      setMode('setup');
    } else {
      const all = getUsers();
      setUsers(all);
      if (all.length === 1) {
        setSelectedUserId(all[0].id);
        setMode('pin');
      } else {
        setMode('select');
      }
    }
  }, []);

  useEffect(() => {
    if (mode === 'locked') {
      const interval = setInterval(updateLockout, 1000);
      return () => clearInterval(interval);
    }
  }, [mode]);

  const updateLockout = () => {
    const rem = getLockoutRemaining();
    setLockoutRemaining(rem);
    if (rem <= 0) {
      clearFailedAttempts();
      setMode('select');
    }
  };

  const handleDigit = (d) => {
    if (pin.length >= 6) return;
    setPin(p => p + d);
    setError('');
  };

  const handleDelete = () => {
    setPin(p => p.slice(0, -1));
    setError('');
  };

  const handleSubmitPin = async () => {
    if (pin.length < 4) { setError('Minimum 4 chiffres'); return; }
    if (mode === 'setup') {
      const h = await hashPIN(pin);
      const user = createUser({
        nom: setupData.nom || 'Admin',
        prenom: setupData.prenom || 'Principal',
        email: setupData.email || '',
        role: 'admin',
        pin: h,
      });
      if (!user) { setError('Erreur création utilisateur'); return; }
      unlockApp();
      clearFailedAttempts();
      setConfig({ timeout_ms: 10 * 60 * 1000 });
      const session = createSession(user.id, companyId || 'default');
      logAction(AUDIT_ACTIONS.LOGIN, { userId: user.id, nom: `${user.prenom} ${user.nom}`, firstLogin: true });
      onLogin(user, session);
      return;
    }
    const user = users.find(u => u.id === selectedUserId);
    if (!user) { setError('Utilisateur introuvable'); return; }
    const ok = await verifyPIN(pin, user.pin_hash);
    if (!ok) {
      const n = recordFailedAttempt();
      setError(`PIN incorrect (tentative ${n}/5)`);
      setPin('');
      if (isLockedOut()) {
        setMode('locked');
        updateLockout();
        lockApp();
      }
      logAction(AUDIT_ACTIONS.LOGIN_FAILED, { userId: user.id, attempts: n });
      return;
    }
    clearFailedAttempts();
    unlockApp();
    const session = createSession(user.id, companyId || 'default');
    logAction(AUDIT_ACTIONS.LOGIN, { userId: user.id, nom: `${user.prenom} ${user.nom}` });
    onLogin(user, session);
  };

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
            otp: code,
            code: code,
            otp_code: code,
            message: `Votre code de verification PIN : ${code}`,
          },
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        setError(`EmailJS ${res.status}: ${text}`);
        return;
      }
      setStep('code');
      setError('');
    } catch (err) {
      setError(`Erreur: ${err.message}`);
    }
  };

  const handleVerifyCode = () => {
    const stored = localStorage.getItem(RESET_CODE_KEY);
    if (!stored) { setError('Code expiré. Recommencez.'); return; }
    const data = JSON.parse(stored);
    if (data.expires < Date.now()) { setError('Code expiré. Recommencez.'); return; }
    if (resetCode !== data.code) { setError('Code incorrect'); return; }
    setStep('newpin');
    setError('');
    setNewPin('');
  };

  const handleSetNewPin = async () => {
    if (newPin.length < 4) { setError('Minimum 4 chiffres'); return; }
    const h = await hashPIN(newPin);
    updateUser(forgotUser.id, { pin_hash: h });
    localStorage.removeItem(RESET_CODE_KEY);
    unlockApp();
    clearFailedAttempts();
    const session = createSession(forgotUser.id, companyId || 'default');
    logAction(AUDIT_ACTIONS.LOGIN, { userId: forgotUser.id, nom: `${forgotUser.prenom} ${forgotUser.nom}`, pinReset: true });
    onLogin(forgotUser, session);
  };

  const renderKeypad = (value, setValue, maxLen = 6) => (
    <div className="space-y-5">
      <div className="flex gap-2.5 justify-center mb-4">
        {Array.from({ length: maxLen }, (_, i) => (
          <div key={i} className={`w-3 h-3 rounded-full transition-all duration-300 ${i < value.length ? 'bg-indigo-400 shadow-glow scale-125' : 'bg-slate-700 scale-100'}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3.5 w-56 mx-auto">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
          <button key={d} type="button" onClick={() => { if (value.length < maxLen) { setValue(value + String(d)); setError(''); } }}
            className="w-16 h-16 rounded-full bg-slate-900/40 hover:bg-brand-500/10 border border-slate-800 hover:border-brand-500/30 text-white text-xl font-bold transition-all duration-200 active:scale-90 shadow-inner-glow flex items-center justify-center">
            {d}
          </button>
        ))}
        <button type="button" onClick={() => setValue('')}
          className="w-16 h-16 rounded-full bg-slate-900/20 hover:bg-danger-500/10 border border-slate-800/50 hover:border-danger-500/30 text-danger-400 text-xs font-semibold transition-all duration-200 active:scale-90 flex items-center justify-center">
          Effacer
        </button>
        <button type="button" onClick={() => { if (value.length < maxLen) { setValue(value + '0'); setError(''); } }}
          className="w-16 h-16 rounded-full bg-slate-900/40 hover:bg-brand-500/10 border border-slate-800 hover:border-brand-500/30 text-white text-xl font-bold transition-all duration-200 active:scale-90 shadow-inner-glow flex items-center justify-center">
          0
        </button>
        <button type="button" onClick={() => setValue(v => v.slice(0, -1))}
          className="w-16 h-16 rounded-full bg-slate-900/20 hover:bg-warning-500/10 border border-slate-800/50 hover:border-warning-500/30 text-warning-400 text-lg transition-all duration-200 active:scale-90 flex items-center justify-center">
          ⌫
        </button>
      </div>
    </div>
  );

  if (mode === 'locked') {
    const mins = Math.floor(lockoutRemaining / 60000);
    const secs = Math.floor((lockoutRemaining % 60000) / 1000);
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="glass-card p-8 rounded-3xl border border-red-500/30 max-w-sm w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-lg font-black text-white">Application verrouillée</h2>
          <div className="flex items-center justify-center gap-2 text-amber-400">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-bold">{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}</span>
          </div>
          <p className="text-xs text-slate-400">Trop de tentatives échouées. Réessayez dans {mins} min.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="glass-panel shadow-2xl p-8 rounded-3xl border border-white/5 max-w-sm w-full space-y-6 relative z-10 animate-fade-in">
        {onBack && (
          <button onClick={onBack}
            className="absolute top-4 left-4 text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Email
          </button>
        )}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/20 flex items-center justify-center mx-auto border border-brand-500/30 shadow-glow">
            <Shield className="w-8 h-8 text-brand-400 animate-pulse-soft" />
          </div>
          <h1 className="text-xl font-black text-white tracking-tight bg-gradient-to-r from-indigo-200 via-indigo-400 to-indigo-100 bg-clip-text text-transparent">Smart Comptable</h1>
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Comptabilité tunisienne sécurisée</p>
        </div>

        {mode === 'setup' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-300 font-bold text-center">Première utilisation — Créer un administrateur</p>
            <input value={setupData.prenom} onChange={e => setSetupData(p => ({ ...p, prenom: e.target.value }))}
              placeholder="Prénom"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500" />
            <input value={setupData.nom} onChange={e => setSetupData(p => ({ ...p, nom: e.target.value }))}
              placeholder="Nom"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500" />
            <input value={setupData.email} onChange={e => setSetupData(p => ({ ...p, email: e.target.value }))}
              placeholder="Email (optionnel)"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500" />
            <p className="text-[10px] text-slate-400 text-center">Choisissez un code PIN (4-6 chiffres)</p>
            {renderKeypad(pin, setPin)}
            <button onClick={handleSubmitPin} disabled={pin.length < 4}
              className="w-full py-2.5 bg-gradient-brand text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50">
              Créer & Connexion
            </button>
            {error && <p className="text-[10px] text-red-400 text-center">{error}</p>}
          </div>
        )}

        {mode === 'select' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-300 font-bold text-center">Choisir un utilisateur</p>
            {users.map(u => (
              <button key={u.id} onClick={() => { setSelectedUserId(u.id); setMode('pin'); }}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 transition-all text-left">
                <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center text-sm font-bold text-brand-400">
                  {(u.prenom?.[0] || '') + (u.nom?.[0] || '')}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-200">{u.prenom} {u.nom}</p>
                  <p className="text-[10px] text-slate-400 capitalize">{u.role}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {mode === 'pin' && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-brand-500/20 flex items-center justify-center mx-auto mb-2">
                <User className="w-6 h-6 text-brand-400" />
              </div>
              <p className="text-xs font-bold text-slate-200">
                {users.find(u => u.id === selectedUserId)?.prenom} {users.find(u => u.id === selectedUserId)?.nom}
              </p>
              <p className="text-[10px] text-slate-400">Entrez votre code PIN</p>
            </div>
            {renderKeypad(pin, setPin)}
            <button onClick={handleSubmitPin} disabled={pin.length < 4}
              className="w-full py-2.5 bg-gradient-brand text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50">
              <Fingerprint className="w-3.5 h-3.5 inline mr-1" /> Déverrouiller
            </button>
            {error && <p className="text-[10px] text-red-400 text-center">{error}</p>}
            <button onClick={() => { setMode('select'); setPin(''); setError(''); }}
              className="w-full text-[10px] text-slate-400 hover:text-slate-200">
              Changer d'utilisateur
            </button>
            <div className="pt-2 text-center">
              <button onClick={() => { setMode('forgot'); setStep('email'); setForgotEmail(''); setError(''); }}
                className="w-full text-[10px] text-slate-500 hover:text-brand-400 transition-colors">
                PIN oublié ?
              </button>
            </div>
          </div>
        )}

        {mode === 'forgot' && (
          <div className="space-y-4">
            <button onClick={() => { setMode('pin'); setError(''); }}
              className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200">
              <ArrowLeft className="w-3 h-3" /> Retour
            </button>

            {step === 'email' && (
              <>
                <p className="text-xs text-slate-300 font-bold text-center">Réinitialisation du PIN</p>
                <p className="text-[10px] text-slate-400 text-center">
                  Un code de vérification sera envoyé par email.
                </p>
                <input type="email" value={forgotEmail}
                  onChange={e => { setForgotEmail(e.target.value); setError(''); }}
                  placeholder="expert@comptable.tn"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500" />
                {error && <p className="text-[10px] text-red-400 text-center">{error}</p>}
                <button onClick={handleSendResetCode}
                  className="w-full py-2.5 bg-gradient-brand text-white text-xs font-bold rounded-xl transition-all">
                  <Mail className="w-3.5 h-3.5 inline mr-1" /> Envoyer le code
                </button>
              </>
            )}

            {step === 'code' && (
              <>
                <p className="text-xs text-slate-300 font-bold text-center">Code de vérification</p>
                <p className="text-[10px] text-slate-400 text-center">
                  Un email a été ouvert avec votre code. Entrez-le ci-dessous.
                </p>
                <div className="pt-4">{renderKeypad(resetCode, setResetCode, 6)}</div>
                {error && <p className="text-[10px] text-red-400 text-center">{error}</p>}
                <button onClick={handleVerifyCode} disabled={resetCode.length < 6}
                  className="w-full py-2.5 bg-gradient-brand text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50">
                  <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" /> Vérifier
                </button>
                <button onClick={() => { setStep('email'); setResetCode(''); setError(''); }}
                  className="w-full text-[10px] text-slate-400 hover:text-slate-200">
                  Renvoyer un code
                </button>
              </>
            )}

            {step === 'newpin' && (
              <>
                <p className="text-xs text-slate-300 font-bold text-center">Nouveau code PIN</p>
                <div className="pt-4">{renderKeypad(newPin, setNewPin)}</div>
                {error && <p className="text-[10px] text-red-400 text-center">{error}</p>}
                <button onClick={handleSetNewPin} disabled={newPin.length < 4}
                  className="w-full py-2.5 bg-gradient-brand text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50">
                  <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" /> Enregistrer
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}