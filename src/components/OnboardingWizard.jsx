import React, { useState } from 'react';
import { Sparkles, Check, ArrowRight, Building, FileText, Scan, LayoutDashboard } from 'lucide-react';

export default function OnboardingWizard({ companyDetails, setCompanyDetails, onComplete, onNavigate }) {
  const [step, setStep] = useState(1);
  const [setup, setSetup] = useState({
    nom: companyDetails?.name || '',
    matriculeFiscal: companyDetails?.matriculeFiscal || companyDetails?.vatNumber || '',
    adresse: companyDetails?.address || '',
    email: companyDetails?.email || '',
    rib: companyDetails?.rib || '',
    tauxIS: companyDetails?.tauxIS || 15,
  });

  const isFirstStepDone = true;
  const isSecondStepDone = setup.nom.trim().length > 0;

  const handleSave = () => {
    setCompanyDetails((prev) => ({
      ...prev,
      name: setup.nom,
      matriculeFiscal: setup.matriculeFiscal,
      vatNumber: setup.matriculeFiscal,
      address: setup.adresse,
      email: setup.email,
      rib: setup.rib,
      tauxIS: setup.tauxIS,
    }));
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg animate-fade-in">
        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                step === s ? 'bg-brand-500 text-white shadow-glow' :
                step > s ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-500'
              }`}>
                {step > s ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < 3 && <div className={`w-12 h-0.5 transition-all duration-300 ${step > s ? 'bg-emerald-500' : 'bg-slate-800'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1 — Welcome */}
        {step === 1 && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-brand flex items-center justify-center shadow-glow mx-auto">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white mb-2">Bienvenue sur Smart Comptable</h1>
              <p className="text-slate-400 text-sm">
                Votre société est prête. Configurons-la en quelques clics.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-left">
              {[
                { icon: Building, label: 'Infos société', desc: 'Raison sociale, MF, adresse' },
                { icon: FileText, label: 'Factures', desc: 'Créez vos premières factures' },
                { icon: Scan, label: 'Scan OCR', desc: 'Numérisez vos reçus' },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40">
                    <Icon className="w-5 h-5 text-brand-400 mb-1" />
                    <p className="text-xs font-bold text-slate-200">{item.label}</p>
                    <p className="text-[10px] text-slate-500">{item.desc}</p>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setStep(2)} className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-brand hover:opacity-90 text-white font-bold rounded-xl transition-all duration-300 shadow-glow">
              Configurer ma société <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2 — Company Info */}
        {step === 2 && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 space-y-5">
            <div className="text-center">
              <Building className="w-10 h-10 text-brand-400 mx-auto mb-2" />
              <h2 className="text-lg font-extrabold text-white">Informations de votre société</h2>
              <p className="text-xs text-slate-400">Remplissez les informations légales de votre entreprise</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1 block">Raison sociale *</label>
                <input value={setup.nom} onChange={(e) => setSetup((s) => ({ ...s, nom: e.target.value }))}
                  placeholder="Carthage Creative Studio" autoFocus
                  className="w-full bg-slate-950 border border-slate-700 focus:border-brand-500 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none placeholder:text-slate-600" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1 block">Matricule Fiscal</label>
                <input value={setup.matriculeFiscal} onChange={(e) => setSetup((s) => ({ ...s, matriculeFiscal: e.target.value }))}
                  placeholder="1234567/X/A/M/000"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-brand-500 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none placeholder:text-slate-600" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1 block">Adresse</label>
                  <input value={setup.adresse} onChange={(e) => setSetup((s) => ({ ...s, adresse: e.target.value }))}
                    placeholder="Imm. Ibn Khaldoun, Tunis"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-brand-500 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none placeholder:text-slate-600" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1 block">Email légal</label>
                  <input value={setup.email} onChange={(e) => setSetup((s) => ({ ...s, email: e.target.value }))}
                    placeholder="contact@societe.tn"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-brand-500 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none placeholder:text-slate-600" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1 block">RIB Bancaire</label>
                  <input value={setup.rib} onChange={(e) => setSetup((s) => ({ ...s, rib: e.target.value }))}
                    placeholder="XX XXX XXX XXXXXX XX XX"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-brand-500 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none placeholder:text-slate-600" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1 block">Taux IS</label>
                  <select value={setup.tauxIS} onChange={(e) => setSetup((s) => ({ ...s, tauxIS: parseInt(e.target.value) }))}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-brand-500 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none">
                    <option value={15}>IS 15% — Industriel/Export</option>
                    <option value={25}>IS 25% — Services/Commerce</option>
                    <option value={10}>IS 10% — Secteur prioritaire</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 py-3 text-xs font-bold text-slate-400 hover:text-slate-200 border border-slate-700 rounded-xl transition-colors">
                Retour
              </button>
              <button onClick={() => setStep(3)} disabled={!isSecondStepDone}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-brand hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all duration-300 shadow-glow">
                Suivant <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Ready */}
        {step === 3 && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto border-2 border-emerald-500/30">
              <Check className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white mb-1">Société configurée !</h2>
              <p className="text-slate-400 text-sm">
                <span className="font-bold text-brand-400">{setup.nom}</span> est prête.
                Vous pouvez maintenant créer vos premières factures et saisir vos dépenses.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <button onClick={() => { handleSave(); onNavigate('invoicing'); }}
                className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/40 hover:border-brand-500/40 hover:bg-slate-800/60 transition-all text-center group">
                <FileText className="w-6 h-6 text-brand-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-xs font-bold text-slate-200">Facture</p>
                <p className="text-[10px] text-slate-500">Créer une facture</p>
              </button>
              <button onClick={() => { handleSave(); onNavigate('ocr'); }}
                className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/40 hover:border-brand-500/40 hover:bg-slate-800/60 transition-all text-center group">
                <Scan className="w-6 h-6 text-brand-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-xs font-bold text-slate-200">Scan</p>
                <p className="text-[10px] text-slate-500">Scanner un reçu</p>
              </button>
              <button onClick={() => { handleSave(); onNavigate('dashboard'); }}
                className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/40 hover:border-brand-500/40 hover:bg-slate-800/60 transition-all text-center group">
                <LayoutDashboard className="w-6 h-6 text-brand-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-xs font-bold text-slate-200">Dashboard</p>
                <p className="text-[10px] text-slate-500">Voir le tableau</p>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
