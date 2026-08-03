import React, { useState } from 'react';
import {
  Layers,
  CheckCircle2,
  Scan,
  Plus,
  ArrowLeftRight,
  Calculator,
  Building,
  Sparkles,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { runFullAudit } from '../auditEngine';
import { trackUsage } from '../utils/auth/usageTracker';
import AuditReportRenderer from '../components/AuditReportRenderer';
import Confetti from '../components/Confetti';

export default function WorkflowView({ 
  expenses, 
  transactions, 
  invoices, 
  formatCurrency, 
  companyDetails, 
  setCurrentTab,
  currentUser
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [payrollBase, setPayrollBase] = useState(4800);
  const [cnssValidated, setCnssValidated] = useState(false);
  const [fiscalValidated, setFiscalValidated] = useState(false);
  const [generatingAudit, setGeneratingAudit] = useState(false);
  const [auditReport, setAuditReport] = useState('');
  const [monthClosed, setMonthClosed] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);

  // calculations
  const unreconciledCount = transactions.filter(t => t.status === 'UNRECONCILED').length;
  const isBankDone = unreconciledCount === 0;
  const isOcrDone = expenses.length >= 2; // on considère qu'au moins 2 reçus scannés valide l'étape

  const totalRevenues = invoices.reduce((acc, inv) => acc + (inv.status === 'PAID' ? inv.total : 0), 0);
  const totalExpenses = expenses.reduce((acc, exp) => acc + exp.totalAmount, 0);
  const netProfit = totalRevenues - totalExpenses;
  
  const estimatedIS = netProfit > 0 ? netProfit * 0.15 : 0;
  const estimatedCNSS = payrollBase * 0.1657;
  const totalDue = estimatedIS + estimatedCNSS;

  const handleGenerateAudit = async () => {
    setGeneratingAudit(true);
    setAuditReport('');
    try {
      const result = runFullAudit({ invoices, expenses, transactions, companyDetails });
      setAuditReport(result);
      setActiveStep(4);
      trackUsage(currentUser?.id, 'run_audit');
    } catch (e) {
      console.error('AUDIT ERROR:', e);
      setAuditReport("❌ Erreur d'audit : " + e.message);
    } finally {
      setGeneratingAudit(false);
    }
  };

  const steps = [
    {
      title: "1. Scan & Collecte",
      desc: "Vérification des factures achats",
      isDone: isOcrDone,
      badge: `${expenses.length} reçus`
    },
    {
      title: "2. Rapprochement",
      desc: "Lettrage des flux bancaires",
      isDone: isBankDone,
      badge: isBankDone ? "Complet" : `${unreconciledCount} en attente`
    },
    {
      title: "3. CNSS Tunisie",
      desc: "Déclaration sociale trimestrielle",
      isDone: cnssValidated,
      badge: cnssValidated ? "Calculé & Validé" : "À vérifier"
    },
    {
      title: "4. Provision IS & TVA",
      desc: "Déclaration fiscale prévisionnelle",
      isDone: fiscalValidated,
      badge: fiscalValidated ? "Provisionné" : "À vérifier"
    },
    {
      title: "5. Audit & Clôture",
      desc: "Rapport Smart-Comptable",
      isDone: monthClosed,
      badge: monthClosed ? "Clôturé" : "Finalisation"
    }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Sidebar des étapes */}
      <div className="lg:col-span-4 space-y-4">
        <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
          <div>
            <h3 className="font-extrabold text-white flex items-center gap-2 text-sm">
              <Layers className="w-4 h-4 text-brand-400" /> Progression de la Clôture
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Complétez chaque étape pour générer l'audit légal et verrouiller vos comptes.
            </p>
          </div>

          <div className="space-y-2.5">
            {steps.map((step, idx) => (
              <button
                key={idx}
                onClick={() => setActiveStep(idx)}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all text-left ${
                  activeStep === idx 
                    ? 'bg-slate-800 border-indigo-500/50 shadow-inner-glow' 
                    : 'bg-slate-900/30 border-slate-850 hover:bg-slate-900/50'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {step.isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-slate-500" />
                    )}
                    <span className={`text-xs font-bold ${activeStep === idx ? 'text-white' : 'text-slate-300'}`}>
                      {step.title}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 pl-4">{step.desc}</p>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                  step.isDone ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                }`}>
                  {step.badge}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Card récapitulative live */}
        <div className="glass-card p-5 rounded-2xl border border-slate-800/80 bg-slate-950/20 space-y-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Récapitulatif de Déclaration</span>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Résultat Fiscal :</span>
              <span className="font-bold text-slate-200">{formatCurrency(netProfit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Prov. IS (15%) :</span>
              <span className="font-bold text-indigo-400">{formatCurrency(estimatedIS)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Prov. CNSS (16.57%) :</span>
              <span className="font-bold text-brand-400">{formatCurrency(estimatedCNSS)}</span>
            </div>
            <div className="border-t border-slate-850 pt-2 flex justify-between font-bold">
              <span className="text-white">Total Obligations :</span>
              <span className="text-accent-400">{formatCurrency(totalDue)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Détail de l'étape active */}
      <div className="lg:col-span-8">
        <div className="glass-card p-4 sm:p-8 rounded-2xl border border-slate-800 min-h-[300px] lg:min-h-[500px] flex flex-col justify-between space-y-8 relative overflow-hidden">
          
          {/* STEP 1: SCAN & COLLECTE */}
          {activeStep === 0 && (
            <div className="space-y-6 flex-1">
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Scan className="w-5 h-5 text-brand-400" /> Étape 1 : Collecte de Justificatifs & OCR
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Tous vos achats professionnels doivent être accompagnés d'un justificatif conforme pour réduire votre assiette d'impôt IS.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Factures d'Achats Scannées</span>
                  <p className="text-2xl font-black text-white">{expenses.length}</p>
                  <p className="text-[10px] text-emerald-400">Moteur OCR local actif & opérationnel</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Total Charges Enregistrées</span>
                  <p className="text-2xl font-black text-indigo-400">{formatCurrency(totalExpenses)}</p>
                  <p className="text-[10px] text-slate-400">Base déductible estimée</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 space-y-2">
                <h4 className="text-xs font-bold text-indigo-300">💡 Statut de conformité</h4>
                <p className="text-xs text-slate-300">
                  {isOcrDone 
                    ? "Excellent ! Vous disposez de suffisamment de reçus d'achats scannés pour optimiser légalement l'Impôt sur les Sociétés."
                    : "Attention, vous avez peu de reçus d'achats numérisés. Importez vos factures de frais dans l'onglet OCR pour réduire vos charges imposables."
                  }
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setCurrentTab('ocr')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl transition-all font-bold text-xs"
                >
                  <Plus className="w-4 h-4" /> Numériser de nouveaux reçus d'achats
                </button>
                <button
                  onClick={() => setActiveStep(1)}
                  className="px-5 py-2.5 bg-gradient-brand text-white rounded-xl transition-all font-bold text-xs ml-auto"
                >
                  Étape Suivante
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: RAPPROCHEMENT */}
          {activeStep === 1 && (
            <div className="space-y-6 flex-1">
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-indigo-400" /> Étape 2 : Rapprochement Bancaire
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Assurez la cohérence absolue entre votre relevé bancaire et vos factures (ventes & achats).
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/30 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Transactions non lettrées</span>
                  <p className="text-2xl font-black text-white">{unreconciledCount} écritures</p>
                </div>
                {isBankDone ? (
                  <span className="px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                    ✓ Rapproché à 100%
                  </span>
                ) : (
                  <span className="px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
                    ⚠️ En attente d'association
                  </span>
                )}
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-850 space-y-2">
                <h4 className="text-xs font-bold text-slate-200">🔍 Rapprochement des flux de trésorerie</h4>
                <p className="text-xs text-slate-400">
                  Le lettrage permet de lier des entrées ou sorties de fonds à des factures physiques réelles. C'est indispensable pour justifier de l'exactitude fiscale de votre CA.
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setCurrentTab('bank')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/30 rounded-xl transition-all font-bold text-xs"
                >
                  <ArrowLeftRight className="w-4 h-4" /> Aller au rapprochement bancaire
                </button>
                <button
                  onClick={() => setActiveStep(2)}
                  className="px-5 py-2.5 bg-gradient-brand text-white rounded-xl transition-all font-bold text-xs ml-auto"
                >
                  Étape Suivante
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: CNSS */}
          {activeStep === 2 && (
            <div className="space-y-6 flex-1">
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-brand-400" /> Étape 3 : Déclaration & Cotisation CNSS (Tunisie)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Les cotisations de la CNSS (régime général de Tunisie) s'élèvent à **16.57%** à la charge de l'employeur sur le total des salaires bruts versés.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold mb-2 uppercase">
                    Masse salariale mensuelle brute cumulée : **{formatCurrency(payrollBase)}**
                  </label>
                  <input 
                    type="range" 
                    min="1500" 
                    max="15000" 
                    step="100"
                    value={payrollBase}
                    onChange={(e) => {
                      setPayrollBase(Number(e.target.value));
                      setCnssValidated(false);
                    }}
                    className="w-full accent-indigo-500"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 mt-1 font-semibold">
                    <span>1 500 DT</span>
                    <span>7 500 DT</span>
                    <span>15 000 DT</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase">CNSS Employeur (16.57%)</span>
                    <p className="text-xl font-extrabold text-brand-400">{formatCurrency(estimatedCNSS)}</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase">Provision à bloquer</span>
                    <p className="text-xl font-extrabold text-white">{formatCurrency(estimatedCNSS)}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5 text-xs text-slate-400">
                <p className="font-bold text-slate-200">ℹ️ Échéances de dépôt de la CNSS en Tunisie :</p>
                <p>• La déclaration s'effectue par trimestre civil (avant le 15 du mois suivant le trimestre).</p>
                <p>• Anticiper et provisionner chaque mois 16.57% de la masse salariale évite tout incident de trésorerie.</p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setCnssValidated(true)}
                  className="px-5 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl transition-all font-bold text-xs"
                >
                  {cnssValidated ? "✓ Cotisation CNSS Validée !" : "Valider et provisionner la CNSS"}
                </button>
                <button
                  onClick={() => setActiveStep(3)}
                  className="px-5 py-2.5 bg-gradient-brand text-white rounded-xl transition-all font-bold text-xs ml-auto"
                >
                  Étape Suivante
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: IS & TVA */}
          {activeStep === 3 && (
            <div className="space-y-6 flex-1">
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Building className="w-5 h-5 text-indigo-400" /> Étape 4 : Impôt sur les Sociétés (IS) & TVA
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Calcul de la provision pour l'Impôt sur les Sociétés (IS) au taux standard prévisionnel de **15%**.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Revenus Encaissés</span>
                  <p className="text-lg font-black text-white">{formatCurrency(totalRevenues)}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Dépenses Cumulées</span>
                  <p className="text-lg font-black text-slate-400">{formatCurrency(totalExpenses)}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/50 border border-indigo-500/20 space-y-1">
                  <span className="text-[10px] text-indigo-400 font-bold uppercase">Résultat Fiscal Estimé</span>
                  <p className={`text-lg font-black ${netProfit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(netProfit)}
                  </p>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/15 flex justify-between items-center">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Impôt sur les Sociétés (Taux 15%)</span>
                  <p className="text-2xl font-black text-indigo-400">{formatCurrency(estimatedIS)}</p>
                </div>
                <button
                  onClick={() => setFiscalValidated(true)}
                  className="px-4 py-2 bg-gradient-brand text-white text-xs font-bold rounded-xl shadow-glow hover:opacity-95 transition-all"
                >
                  {fiscalValidated ? "✓ Provision IS Bloquée" : "Bloquer la Provision IS"}
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-850 space-y-1 text-xs text-slate-400">
                <span className="font-bold text-slate-200">🔍 Mécanique de déclaration fiscale tunisienne :</span>
                <p>• Le taux normal de l'IS en Tunisie est de 15% (loi de finances en vigueur).</p>
                <p>• Bloquer cette provision évite de gonfler artificiellement votre solde disponible et garantit la solvabilité de l'entreprise lors des échéances fiscales officielles.</p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setActiveStep(4)}
                  className="px-5 py-2.5 bg-gradient-brand text-white rounded-xl transition-all font-bold text-xs ml-auto"
                >
                  Étape Suivante
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: FINAL CLOSE & AUDIT */}
          {activeStep === 4 && (
            <div className="space-y-6 flex-1">
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-brand-400" /> Étape 5 : Audit final & Clôture du Mois
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Générez le rapport de synthèse par **Smart-Comptable** et finalisez la clôture de Carthage Creative Studio S.A.R.L.
                </p>
              </div>

              {generatingAudit ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-4">
                  <RefreshCw className="w-8 h-8 text-brand-400 animate-spin" />
                  <span className="text-xs text-indigo-400 font-semibold">Génération de l'audit expert en cours...</span>
                </div>
               ) : auditReport ? (
                <div className="p-6 rounded-2xl bg-slate-950/40 border border-slate-800 text-xs overflow-y-auto max-h-[300px] ">
                  <AuditReportRenderer report={auditReport} />
                </div>
              ) : (
                <div className="p-12 text-center border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/10 flex flex-col items-center justify-center space-y-4">
                  <Sparkles className="w-10 h-10 text-slate-600 animate-pulse-soft" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-200">Rapport d'audit de conformité final</p>
                    <p className="text-[10px] text-slate-500 max-w-sm">Le moteur d'intelligence comptable tunisien va dresser le diagnostic complet de vos charges, provisions et liquidités.</p>
                  </div>
                  <button
                    onClick={handleGenerateAudit}
                    className="px-5 py-2.5 bg-gradient-brand text-white text-xs font-bold rounded-xl shadow-glow hover:opacity-90 transition-all flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" /> Lancer l'Audit Smart-Comptable
                  </button>
                </div>
              )}

              {monthClosed ? (
                <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-center space-y-2 animate-fade-in">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <h4 className="text-sm font-black text-emerald-300">FÉLICITATIONS ! EXERCICE CLÔTURÉ AVEC SUCCÈS</h4>
                  <p className="text-xs text-slate-200">
                    Les écritures comptables et le rapport de clôture pour **Carthage Creative Studio S.A.R.L** ont été verrouillés et archivés.
                  </p>
                </div>
              ) : (
                <div className="flex gap-4">
                  {auditReport && (
                    <button
                      onClick={() => { setMonthClosed(true); setConfettiActive(true); }}
                      className="w-full py-3 bg-gradient-brand text-white font-black rounded-xl text-xs shadow-glow hover:scale-[1.01] transition-all flex items-center justify-center gap-2"
                    >
                      <ShieldCheck className="w-4 h-4" /> VERROUILLER & CLÔTURER LE MOIS
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
      
      <Confetti active={confettiActive} onDone={() => setConfettiActive(false)} />

    </div>
  );
}
