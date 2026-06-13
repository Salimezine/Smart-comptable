import React, { useState } from 'react';
import { Sparkles, Building2, Mail, CreditCard, Landmark, Code, ArrowRight } from 'lucide-react';

export default function Onboarding({ onComplete }) {
  const [newCompany, setNewCompany] = useState({
    name: '',
    email: '',
    vatNumber: '',
    address: '',
    iban: '',
    bic: '',
    currency: 'TND',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onComplete(newCompany);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background accents */}
      <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-brand-500/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 bg-indigo-500/20 rounded-full blur-[120px]" />

      <div className="w-full max-w-2xl glass-card border border-slate-800 rounded-3xl p-8 md:p-12 relative z-10 shadow-2xl">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-brand mx-auto flex items-center justify-center shadow-glow mb-6">
            <Sparkles className="w-8 h-8 text-white animate-pulse-soft" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-3">Bienvenue sur Smart Comptable</h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Pour commencer, veuillez configurer votre profil d'entreprise. 
            Les données seront enregistrées localement et vous partirez avec des compteurs à zéro.
          </p>

          {/* Completion Progress Bar */}
          {(() => {
            const requiredFields = [newCompany.name, newCompany.email, newCompany.vatNumber];
            const filledCount = requiredFields.filter(val => val && val.trim() !== '').length;
            const pct = Math.round((filledCount / requiredFields.length) * 100);
            return (
              <div className="mt-6 max-w-sm mx-auto space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-500 uppercase tracking-widest">Configuration Profil</span>
                  <span className={`font-black ${pct === 100 ? 'text-emerald-400' : 'text-indigo-400'}`}>{pct}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${
                      pct === 100 ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'bg-gradient-to-r from-indigo-500 to-violet-500 shadow-[0_0_8px_rgba(99,102,241,0.3)]'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })()}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5" /> Nom de la société *
              </label>
              <input 
                required 
                placeholder="ex: Tech Solutions SARL" 
                value={newCompany.name}
                onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                className="w-full bg-slate-900/60 border border-slate-700 focus:border-brand-500 rounded-xl px-4 py-3 text-sm text-slate-100 transition-all focus:shadow-[0_0_0_2px_rgba(var(--brand-500),0.2)] outline-none" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Mail className="w-3.5 h-3.5" /> E-mail de contact *
              </label>
              <input 
                required 
                type="email" 
                placeholder="contact@societe.tn" 
                value={newCompany.email}
                onChange={(e) => setNewCompany({ ...newCompany, email: e.target.value })}
                className="w-full bg-slate-900/60 border border-slate-700 focus:border-brand-500 rounded-xl px-4 py-3 text-sm text-slate-100 transition-all focus:shadow-[0_0_0_2px_rgba(var(--brand-500),0.2)] outline-none" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Landmark className="w-3.5 h-3.5" /> Matricule Fiscal *
              </label>
              <input 
                required 
                placeholder="ex: 1234567/X/A/M/000" 
                value={newCompany.vatNumber}
                onChange={(e) => setNewCompany({ ...newCompany, vatNumber: e.target.value })}
                className="w-full bg-slate-900/60 border border-slate-700 focus:border-brand-500 rounded-xl px-4 py-3 text-sm text-slate-100 transition-all focus:shadow-[0_0_0_2px_rgba(var(--brand-500),0.2)] outline-none" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5" /> IBAN (Optionnel)
              </label>
              <input 
                placeholder="ex: TN59..." 
                value={newCompany.iban}
                onChange={(e) => setNewCompany({ ...newCompany, iban: e.target.value })}
                className="w-full bg-slate-900/60 border border-slate-700 focus:border-brand-500 rounded-xl px-4 py-3 text-sm text-slate-100 transition-all focus:shadow-[0_0_0_2px_rgba(var(--brand-500),0.2)] outline-none" 
              />
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Code className="w-3.5 h-3.5" /> Clé API n8n (Optionnel)
              </label>
              <input 
                placeholder="Laissez vide pour utiliser l'OCR local"
                className="w-full bg-slate-900/60 border border-slate-700 focus:border-brand-500 rounded-xl px-4 py-3 text-sm text-slate-100 transition-all focus:shadow-[0_0_0_2px_rgba(var(--brand-500),0.2)] outline-none font-mono" 
              />
              <p className="text-[10px] text-slate-500 mt-1">L'OCR Tesseract fonctionne sans clé, 100% local.</p>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800">
            <button 
              type="submit" 
              className="w-full py-4 bg-gradient-brand text-white font-bold rounded-xl shadow-glow hover:opacity-90 transition-all flex items-center justify-center gap-2"
            >
              Créer mon espace et démarrer <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
