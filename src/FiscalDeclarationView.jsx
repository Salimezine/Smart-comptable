import React, { useState, useEffect } from 'react';
import { generateFromJournal } from './accountingUtils';
import { getJournalKey } from './utils/journalKey';
import { generateProvisionIS } from './utils/pieceComptable';
import { FileText, Calendar, AlertTriangle, Info, ChevronDown, ChevronRight, CheckCircle2, XCircle, Plus, Clock, Sparkles } from 'lucide-react';
import { useToast } from './components/Toast';
import { useConfirm } from './components/ConfirmModal';
import Confetti from './components/Confetti';

const fmt = (v) => {
  if (v == null || isNaN(v)) return '0,000';
  return v.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
};

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-800/50 pb-4 mb-4 last:border-b-0 last:pb-0">
      <button 
        onClick={() => setOpen(!open)} 
        className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 w-full text-left hover:text-slate-200 transition-colors"
      >
        <span className="flex items-center gap-2">
          {open ? <ChevronDown className="w-3.5 h-3.5 text-indigo-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
          {title}
        </span>
        <span className="h-px flex-1 bg-slate-800/50 mx-4" />
      </button>
      {open && <div className="space-y-2 animate-fade-in">{children}</div>}
    </div>
  );
}

function FiscalLine({ label, value, color, bold, total, indent }) {
  return (
    <div className={`flex justify-between items-center py-2 px-3 rounded-xl transition-all duration-200 hover:bg-slate-800/20 ${
      total ? 'bg-gradient-to-r from-indigo-500/10 to-purple-500/5 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.05)]' : ''
    }`}>
      <span 
        className={`text-xs ${total ? 'font-bold text-indigo-300' : bold ? 'font-semibold text-slate-300' : 'text-slate-400'}`}
        style={{ paddingLeft: (indent || 0) * 12 }}
      >
        {label}
      </span>
      <span className={`text-xs font-bold ${color || (total ? 'text-indigo-400 text-sm' : 'text-slate-200 font-mono')}`}>
        {fmt(value)} DT
      </span>
    </div>
  );
}

// ── Live Countdown Widget ──────────────────────────────────────────
function CountdownWidget({ nextEcheance }) {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!nextEcheance) return;
    const targetDate = new Date(`${nextEcheance.date}T23:59:59`);
    
    const calculateTime = () => {
      const now = new Date();
      const diff = targetDate - now;
      if (diff <= 0) {
        setTimeLeft({ d: 0, h: 0, m: 0, s: 0 });
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft({ d, h, m, s });
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [nextEcheance]);

  if (!timeLeft) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl border border-indigo-500/25 bg-slate-950/60 shadow-[0_0_25px_rgba(99,102,241,0.1)] backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
          <Clock className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400/80">Prochaine Échéance Fiscale</span>
          <h4 className="text-sm font-bold text-white leading-tight">{nextEcheance.label}</h4>
          <p className="text-[11px] text-slate-400 mt-0.5">Le {new Date(nextEcheance.date).toLocaleDateString('fr-TN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      <div className="flex gap-2">
        {[
          { label: 'J', val: timeLeft.d },
          { label: 'H', val: timeLeft.h },
          { label: 'M', val: timeLeft.m },
          { label: 'S', val: timeLeft.s, pulse: true }
        ].map((unit, idx) => (
          <div key={idx} className="flex flex-col items-center justify-center w-12 h-12 bg-slate-900/60 border border-slate-800 rounded-xl">
            <span className={`text-sm font-black font-mono text-white ${unit.pulse ? 'text-indigo-400' : ''}`}>
              {String(unit.val).padStart(2, '0')}
            </span>
            <span className="text-[9px] font-bold text-slate-500 uppercase">{unit.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FiscalDeclarationView({ companyDetails }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [refreshKey, setRefreshKey] = useState(0);
  const [confettiActive, setConfettiActive] = useState(false);

  useEffect(() => {
    const handler = () => setRefreshKey(k => k + 1);
    window.addEventListener('journal:updated', handler);
    return () => window.removeEventListener('journal:updated', handler);
  }, []);

  const _ = refreshKey;
  const journalData = generateFromJournal();
  const useJournal = journalData !== null;
  const jb = useJournal ? journalData.journal : [];

  // --- TVA computation from journal (entries in DT) ---
  const tvaCollectee = useJournal
    ? jb.filter(e => (e.compte || '').startsWith('43671')).reduce((s, e) => s + (parseFloat(e.credit) || 0), 0)
    : 0;
  const tvaDeductible = useJournal
    ? jb.filter(e => (e.compte || '').startsWith('43666')).reduce((s, e) => s + (parseFloat(e.debit) || 0), 0)
    : 0;
  const tvaDue = Math.max(0, tvaCollectee - tvaDeductible);

  // --- IS computation ---
  const resultatNet = useJournal
    ? (journalData.resultat.resultatNet || 0) * 1000
    : 0;
  const isEstime = Math.max(0, resultatNet * 0.25);
  const acomptesIS = isEstime * 0.30;
  const acompte2IS = isEstime * 0.30;
  const acompte3IS = isEstime * 0.40;

  // --- RS computation ---
  const rsDue = useJournal
    ? jb.filter(e => (e.compte || '').startsWith('43674')).reduce((s, e) => s + (parseFloat(e.credit) || 0), 0)
    : 0;

  // --- Échéances ---
  const now = new Date();
  const year = now.getFullYear();
  
  const echeancesTVA = [
    { mois: 'Janvier', date: `${year}-01-20`, label: 'TVA décembre N-1' },
    { mois: 'Février', date: `${year}-02-20`, label: 'TVA janvier' },
    { mois: 'Mars', date: `${year}-03-20`, label: 'TVA février' },
    { mois: 'Avril', date: `${year}-04-20`, label: 'TVA mars' },
    { mois: 'Mai', date: `${year}-05-20`, label: 'TVA avril' },
    { mois: 'Juin', date: `${year}-06-20`, label: 'TVA mai' },
    { mois: 'Juillet', date: `${year}-07-20`, label: 'TVA juin' },
    { mois: 'Août', date: `${year}-08-20`, label: 'TVA juillet' },
    { mois: 'Septembre', date: `${year}-09-20`, label: 'TVA août' },
    { mois: 'Octobre', date: `${year}-10-20`, label: 'TVA septembre' },
    { mois: 'Novembre', date: `${year}-11-20`, label: 'TVA octobre' },
    { mois: 'Décembre', date: `${year}-12-20`, label: 'TVA novembre' },
  ];

  const echeancesIS = [
    { date: `${year}-06-25`, label: '1er acompte IS (30%)' },
    { date: `${year}-09-25`, label: '2e acompte IS (30%)' },
    { date: `${year}-12-25`, label: '3e acompte IS (40%)' },
    { date: `${year + 1}-03-31`, label: 'Solde IS N' },
  ];

  const handleGenerateIS = async () => {
    const isOk = await confirm({
      title: 'Générer la provision IS',
      message: `Voulez-vous générer les écritures de provision IS d'un montant de ${fmt(isEstime)} DT pour l'exercice ${year} ?`,
      confirmLabel: 'Générer',
      cancelLabel: 'Annuler',
      type: 'info'
    });

    if (!isOk) return;

    const result = generateProvisionIS();
    if (!result) { 
      toast.error('Erreur lors de la génération des écritures de provision.'); 
      return; 
    }
    if (result.alreadyExists) { 
      toast.info(`La provision IS pour l'exercice ${year} existe déjà dans le journal.`); 
      return; 
    }
    if (result.resultatNet <= 0) { 
      toast.warning('Résultat net négatif ou nul : aucun impôt sur les sociétés à provisionner.'); 
      return; 
    }

    toast.success(`Provision IS de ${fmt(result.isAmount)} DT générée et passée en écriture dans le journal.`);
    setConfettiActive(true);
  };

  const getStatus = (dateStr) => {
    const d = new Date(dateStr);
    const timeDiff = d - now;
    if (timeDiff < 0) return 'passée';
    if (timeDiff < 30 * 86400000) return 'imminente';
    return 'future';
  };

  // Find next upcoming deadline
  const allEcheances = [...echeancesTVA, ...echeancesIS]
    .map(e => ({ ...e, parsedDate: new Date(`${e.date}T23:59:59`) }))
    .filter(e => e.parsedDate >= now)
    .sort((a, b) => a.parsedDate - b.parsedDate);

  const nextEcheance = allEcheances[0] || null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 animate-fade-in relative px-1">
      <Confetti active={confettiActive} onDone={() => setConfettiActive(false)} />

      {/* Header section */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/20 p-6 md:p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/20 bg-indigo-500/5 text-xs font-semibold text-indigo-400">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-spin" /> Fiscalité Tunisienne
            </div>
            <h2 className="text-2xl font-black text-white flex items-center gap-3">
              <FileText className="w-6 h-6 text-indigo-400" />
              Liasse & Déclarations Fiscales
            </h2>
            <p className="text-xs text-slate-400 max-w-xl">
              Calcul et suivi automatique de la TVA, de l'impôt sur les sociétés (IS) et des retenues à la source (RS) en conformité avec la réglementation tunisienne.
            </p>
          </div>
          
          {/* Quick stats totals */}
          <div className="grid grid-cols-2 gap-4 shrink-0">
            <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-2xl min-w-[120px]">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">TVA Due</span>
              <p className="text-sm font-black text-amber-400 mt-0.5">{useJournal ? `${fmt(tvaDue)}` : '0,000'} DT</p>
            </div>
            <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-2xl min-w-[120px]">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">IS Estimé</span>
              <p className="text-sm font-black text-indigo-400 mt-0.5">{useJournal ? `${fmt(isEstime)}` : '0,000'} DT</p>
            </div>
          </div>
        </div>
      </div>

      {/* Countdown Widget */}
      {nextEcheance && <CountdownWidget nextEcheance={nextEcheance} />}

      {/* Main grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* TVA CARD */}
        <div className="glass-card p-6 rounded-3xl border border-slate-800/80 bg-slate-900/10 shadow-lg backdrop-blur-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5 border-b border-slate-800/60 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                  <span className="text-xs font-black">TVA</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-200">Déclaration de TVA</h3>
                  <p className="text-[10px] text-slate-500">Flux de taxe collectée & déductible</p>
                </div>
              </div>
              <span className="text-[9px] font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
                MENSUELLE
              </span>
            </div>

            {!useJournal ? (
              <div className="p-8 bg-slate-950/35 border border-slate-850 rounded-2xl text-center my-4">
                <AlertTriangle className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Aucune écriture enregistrée pour le calcul de la TVA.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Section title="Récapitulatif TVA" defaultOpen={true}>
                  <FiscalLine label="TVA Collectée (compte 43671)" value={tvaCollectee} color="text-emerald-400" />
                  <FiscalLine label="TVA Déductible (compte 43666)" value={tvaDeductible} color="text-rose-400" />
                  <FiscalLine label="TVA Due nette à payer" value={tvaDue} total />
                </Section>

                <Section title="Calendrier Échéances" defaultOpen={false}>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {echeancesTVA.map((ech, i) => {
                      const status = getStatus(ech.date);
                      return (
                        <div 
                          key={i} 
                          className={`flex justify-between items-center px-3 py-2 rounded-xl text-xs border ${
                            status === 'passée' ? 'border-slate-850 bg-slate-900/10 text-slate-500' : 
                            status === 'imminente' ? 'border-amber-500/20 bg-amber-500/5 text-amber-400' : 
                            'border-slate-800/40 bg-slate-900/5 text-slate-300'
                          }`}
                        >
                          <span className="flex items-center gap-2 font-medium">
                            {status === 'passée' ? <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" /> :
                             status === 'imminente' ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400 animate-pulse" /> :
                             <Calendar className="w-3.5 h-3.5 text-slate-500" />}
                            {ech.label}
                          </span>
                          <span className="font-mono text-[11px]">
                            {new Date(ech.date).toLocaleDateString('fr-TN', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Section>
              </div>
            )}
          </div>

          <div className="mt-5 p-3.5 bg-slate-950/40 border border-slate-800/60 rounded-2xl flex gap-2.5 items-start">
            <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-500 leading-normal">
              La déclaration mensuelle doit être déposée au plus tard le <strong className="text-slate-400">20 de chaque mois</strong>. Les taux standards en vigueur en Tunisie sont de 7%, 13%, et 19%.
            </p>
          </div>
        </div>

        {/* IS CARD */}
        <div className="glass-card p-6 rounded-3xl border border-slate-800/80 bg-slate-900/10 shadow-lg backdrop-blur-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5 border-b border-slate-800/60 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
                  <span className="text-xs font-black">IS</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-200">Impôt sur les Sociétés</h3>
                  <p className="text-[10px] text-slate-500">Estimation et acomptes provisionnels</p>
                </div>
              </div>
              <span className="text-[9px] font-bold px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20">
                ANNUEL
              </span>
            </div>

            {!useJournal ? (
              <div className="p-8 bg-slate-950/35 border border-slate-850 rounded-2xl text-center my-4">
                <AlertTriangle className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Écritures insuffisantes pour estimer le résultat de l'IS.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Section title="Estimation de l'Impôt" defaultOpen={true}>
                  <FiscalLine label="Résultat Net comptable estimé" value={resultatNet} />
                  <FiscalLine label="Taux d'imposition standard (15%)" value={0} indent={1} />
                  <FiscalLine label="IS estimé de l'exercice" value={isEstime} total />
                </Section>

                <Section title="Calendrier Acomptes" defaultOpen={false}>
                  <div className="space-y-2">
                    <FiscalLine label="1er acompte (30% — 25 juin)" value={acomptesIS} />
                    <FiscalLine label="2e acompte (30% — 25 sept.)" value={acompte2IS} />
                    <FiscalLine label="3e acompte (40% — 25 déc.)" value={acompte3IS} />
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {echeancesIS.map((ech, i) => {
                        const status = getStatus(ech.date);
                        return (
                          <div 
                            key={i} 
                            className={`p-2 rounded-xl text-left border ${
                              status === 'passée' ? 'border-slate-850 bg-slate-900/10 text-slate-500' :
                              status === 'imminente' ? 'border-amber-500/25 bg-amber-500/5 text-amber-400' :
                              'border-slate-800/40 bg-slate-900/5 text-slate-300'
                            }`}
                          >
                            <p className="text-[10px] font-bold truncate">{ech.label}</p>
                            <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                              {new Date(ech.date).toLocaleDateString('fr-TN', { day: 'numeric', month: 'short', year: '2-digit' })}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Section>
              </div>
            )}
          </div>

          <div className="space-y-3 mt-5">
            {useJournal && (
              <button
                onClick={handleGenerateIS}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-black rounded-2xl shadow-[0_4px_20px_rgba(99,102,241,0.25)] transition-all duration-200 active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                Générer provision IS dans le journal
              </button>
            )}
            <div className="p-3.5 bg-slate-950/40 border border-slate-800/60 rounded-2xl flex gap-2.5 items-start">
              <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-slate-500 leading-normal">
                Taux de droit commun de <strong className="text-slate-400">25%</strong> (10% agriculture, 15% industrie/export, 20% commerce/services, 35% secteurs réglementés, 40% banques/assurances). Les acomptes provisionnels (30% de l'impôt de l'exercice précédent chacun) se payent au 6ème, 9ème, et 12ème mois de l'exercice.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* RS SECTION */}
      <div className="glass-card p-6 rounded-3xl border border-slate-800/80 bg-slate-900/10 shadow-lg backdrop-blur-md">
        <div className="flex items-center justify-between mb-5 border-b border-slate-800/60 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-400">
              <span className="text-xs font-black">RS</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">Retenue à la Source</h3>
              <p className="text-[10px] text-slate-500">Calcul à partir des comptes fournisseurs de type 43674</p>
            </div>
          </div>
          <span className="text-[9px] font-bold px-2 py-0.5 bg-rose-500/10 text-rose-400 rounded-full border border-rose-500/20">
            1.5% à 15%
          </span>
        </div>

        {!useJournal ? (
          <div className="p-8 bg-slate-950/35 border border-slate-850 rounded-2xl text-center my-2">
            <AlertTriangle className="w-6 h-6 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400">Aucune retenue à la source comptabilisée.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Section title="Impôt Liquidateur" defaultOpen={true}>
                <FiscalLine label="État - Retenues à la source (compte 43674)" value={rsDue} total />
              </Section>
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Taux en vigueur (Tunisie)</span>
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4 space-y-2 text-xs">
                {[
                  { label: 'Honoraires et prestations de services (Pers. Physiques)', rate: '3.0%' },
                  { label: 'Honoraires et prestations de services (Pers. Morales)', rate: '2.5%' },
                  { label: 'Prestations de services ordinaires', rate: '1.5%' },
                  { label: 'Revenus de capitaux mobiliers', rate: '10%' },
                  { label: 'Loyers (immeubles, matériels)', rate: '15%' }
                ].map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1 border-b border-slate-800/40 last:border-0 last:pb-0">
                    <span className="text-slate-400 text-[11px]">{item.label}</span>
                    <span className="font-mono font-bold text-rose-400">{item.rate}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {!useJournal && (
        <div className="p-6 bg-amber-500/5 border border-amber-500/20 rounded-2xl text-center flex flex-col items-center justify-center gap-2">
          <AlertTriangle className="w-8 h-8 text-amber-500 animate-bounce" />
          <h5 className="text-xs font-bold text-amber-400">Avertissement : Journal Comptable Vide</h5>
          <p className="text-[11px] text-slate-500 max-w-md">
            L'ensemble des déclarations fiscales ci-dessus s'appuie sur les écritures enregistrées dans le journal comptable. Veuillez d'abord ajouter des écritures ou générer des données de démo depuis le menu principal.
          </p>
        </div>
      )}
    </div>
  );
}
