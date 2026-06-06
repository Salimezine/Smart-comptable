import React, { useState, useEffect } from 'react';
import { generateFromJournal } from './accountingUtils';
import { getJournalKey } from './utils/journalKey';
import { generateProvisionIS } from './utils/pieceComptable';
import { FileText, Calendar, AlertTriangle, Info, ChevronDown, ChevronRight, CheckCircle, XCircle, Plus } from 'lucide-react';

const fmt = (v) => {
  if (v == null || isNaN(v)) return '0,000';
  return v.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
};

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-800/50 pb-3 mb-3">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1 text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 w-full text-left">
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {title}
      </button>
      {open && children}
    </div>
  );
}

function FiscalLine({ label, value, color, bold, total, indent }) {
  return (
    <div className={`flex justify-between py-1 ${total ? 'bg-indigo-500/5 rounded-lg px-2 -mx-2' : ''}`}>
      <span className={`text-xs ${total ? 'font-bold text-brand-300' : bold ? 'font-semibold text-slate-300' : 'text-slate-400'}`}
        style={{ paddingLeft: (indent || 0) * 12 }}>
        {label}
      </span>
      <span className={`text-xs font-semibold ${color || (total ? 'text-brand-400' : 'text-slate-300')}`}>
        {fmt(value)} DT
      </span>
    </div>
  );
}

export default function FiscalDeclarationView({ companyDetails }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isMsg, setIsMsg] = useState(null);
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

  // --- IS computation (resultatNet from generateFromJournal is in kilodinars) ---
  const resultatNet = useJournal
    ? (journalData.resultat.resultatNet || 0) * 1000
    : 0;
  const isEstime = Math.max(0, resultatNet * 0.15);
  const acomptesIS = isEstime / 4; // 4 acomptes provisionnels

  // --- RS computation (entries in DT) ---
  const rsDue = useJournal
    ? jb.filter(e => (e.compte || '').startsWith('43674')).reduce((s, e) => s + (parseFloat(e.credit) || 0), 0)
    : 0;

  // --- Échéances ---
  const now = new Date();
  const year = now.getFullYear();
  const echeancesTVA = [
    { mois: 'Janvier', date: `${year}-01-28`, label: 'TVA décembre N-1' },
    { mois: 'Février', date: `${year}-02-28`, label: 'TVA janvier' },
    { mois: 'Mars', date: `${year}-03-28`, label: 'TVA février' },
    { mois: 'Avril', date: `${year}-04-28`, label: 'TVA mars' },
    { mois: 'Mai', date: `${year}-05-28`, label: 'TVA avril' },
    { mois: 'Juin', date: `${year}-06-28`, label: 'TVA mai' },
    { mois: 'Juillet', date: `${year}-07-28`, label: 'TVA juin' },
    { mois: 'Août', date: `${year}-08-28`, label: 'TVA juillet' },
    { mois: 'Septembre', date: `${year}-09-28`, label: 'TVA août' },
    { mois: 'Octobre', date: `${year}-10-28`, label: 'TVA septembre' },
    { mois: 'Novembre', date: `${year}-11-28`, label: 'TVA octobre' },
    { mois: 'Décembre', date: `${year}-12-28`, label: 'TVA novembre' },
  ];

  const echeancesIS = [
    { date: `${year}-06-30`, label: '1er acompte IS' },
    { date: `${year}-09-28`, label: '2e acompte IS' },
    { date: `${year}-12-28`, label: '3e acompte IS' },
    { date: `${year + 1}-03-31`, label: '4e acompte IS + Solde IS N' },
  ];

  const handleGenerateIS = () => {
    const result = generateProvisionIS();
    if (!result) { setIsMsg({ type: 'error', text: 'Erreur lors de la génération' }); return; }
    if (result.alreadyExists) { setIsMsg({ type: 'info', text: `Provision IS ${new Date().getFullYear()} déjà existante.` }); return; }
    if (result.resultatNet <= 0) { setIsMsg({ type: 'warn', text: 'Résultat net ≤ 0, pas d\'IS à provisionner.' }); return; }
    setIsMsg({ type: 'success', text: `Provision IS ${result.exercice} : ${result.isAmount.toFixed(3)} DT passée en écriture.` });
  };

  const getStatus = (dateStr) => {
    const d = new Date(dateStr);
    return d < now ? 'passée' : (d - now < 30 * 86400000 ? 'imminente' : 'future');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 p-6 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-400" />
            Déclarations fiscales (Liasse)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            TVA, IS et Retenue à la source — calculés à partir du journal comptable.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* TVA */}
        <div className="glass-card p-5 rounded-2xl border border-slate-800 shadow-card">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-slate-100">Déclaration TVA</h3>
            <span className="text-[10px] font-bold px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-full">MENSUELLE</span>
          </div>

          {!useJournal ? (
            <div className="p-4 bg-slate-800/50 rounded-xl text-center">
              <p className="text-xs text-slate-400">Ajoutez des écritures comptables pour voir la TVA.</p>
            </div>
          ) : (
            <>
              <Section title="Récapitulatif">
                <FiscalLine label="TVA collectée (43671)" value={tvaCollectee} color="text-accent-400" />
                <FiscalLine label="TVA déductible (43666)" value={tvaDeductible} color="text-danger-400" />
                <FiscalLine label="TVA due au Trésor" value={tvaDue} total />
              </Section>

              <Section title="Échéances mensuelles" defaultOpen={false}>
                <div className="space-y-1.5">
                  {echeancesTVA.map((ech, i) => {
                    const status = getStatus(ech.date);
                    return (
                      <div key={i} className={`flex justify-between items-center px-2 py-1.5 rounded-lg text-xs ${
                        status === 'passée' ? 'text-slate-600' : status === 'imminente' ? 'bg-amber-500/10 text-amber-400' : 'text-slate-400'
                      }`}>
                        <span className="flex items-center gap-1">
                          {status === 'passée' ? <CheckCircle className="w-3 h-3 text-slate-600" /> :
                           status === 'imminente' ? <AlertTriangle className="w-3 h-3 text-amber-400" /> :
                           <Calendar className="w-3 h-3 text-slate-500" />}
                          {ech.label}
                        </span>
                        <span>{new Date(ech.date).toLocaleDateString('fr-TN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      </div>
                    );
                  })}
                </div>
              </Section>

              <div className="mt-3 p-3 bg-slate-800/30 rounded-xl">
                <p className="text-[11px] text-slate-500 flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-brand-400 shrink-0 mt-0.5" />
                  Déclaration mensuelle avant le 28 du mois suivant. Taux : 7%, 13%, 19%.
                </p>
              </div>
            </>
          )}
        </div>

        {/* IS */}
        <div className="glass-card p-5 rounded-2xl border border-slate-800 shadow-card">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-slate-100">Impôt sur les Sociétés (IS)</h3>
            <span className="text-[10px] font-bold px-2 py-1 bg-amber-500/10 text-amber-400 rounded-full">ANNUEL</span>
          </div>

          {!useJournal ? (
            <div className="p-4 bg-slate-800/50 rounded-xl text-center">
              <p className="text-xs text-slate-400">Ajoutez des écritures comptables pour estimer l'IS.</p>
            </div>
          ) : (
            <>
              <Section title="Estimation IS">
                <FiscalLine label="Résultat net de l'exercice" value={resultatNet} />
                <FiscalLine label="Taux IS (15%)" value={0} indent={1} />
                <FiscalLine label="IS estimé" value={isEstime} total />
              </Section>

              <Section title="Acomptes provisionnels" defaultOpen={false}>
                <div className="space-y-1.5">
                  <FiscalLine label="Montant par acompte" value={acomptesIS} />
                  {echeancesIS.map((ech, i) => {
                    const status = getStatus(ech.date);
                    return (
                      <div key={i} className={`flex justify-between items-center px-2 py-1.5 rounded-lg text-xs ${
                        status === 'passée' ? 'text-slate-600' : status === 'imminente' ? 'bg-amber-500/10 text-amber-400' : 'text-slate-400'
                      }`}>
                        <span className="flex items-center gap-1">
                          {status === 'passée' ? <CheckCircle className="w-3 h-3 text-slate-600" /> :
                           status === 'imminente' ? <AlertTriangle className="w-3 h-3 text-amber-400" /> :
                           <Calendar className="w-3 h-3 text-slate-500" />}
                          {ech.label}
                        </span>
                        <span>{new Date(ech.date).toLocaleDateString('fr-TN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      </div>
                    );
                  })}
                </div>
              </Section>

              <div className="mt-3 p-3 bg-slate-800/30 rounded-xl">
                <p className="text-[11px] text-slate-500 flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-brand-400 shrink-0 mt-0.5" />
                  Taux standard 15% (régime réel). Acomptes : juin, septembre, décembre, mars N+1.
                </p>
              </div>

              <button
                onClick={handleGenerateIS}
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 text-xs font-bold rounded-xl transition-colors border border-amber-600/30"
              >
                <Plus className="w-3.5 h-3.5" />
                Générer provision IS
              </button>

              {isMsg && (
                <div className={`mt-2 px-3 py-2 rounded-xl text-xs font-bold ${
                  isMsg.type === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                  isMsg.type === 'warn' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                  isMsg.type === 'info' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                  'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                  {isMsg.text}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* RS */}
      <div className="glass-card p-5 rounded-2xl border border-slate-800 shadow-card">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-slate-100">Retenue à la Source (RS)</h3>
          <span className="text-[10px] font-bold px-2 py-1 bg-rose-500/10 text-rose-400 rounded-full">1.5% / 2.5% / 3% / 10% / 15%</span>
        </div>

        {!useJournal ? (
          <div className="p-4 bg-slate-800/50 rounded-xl text-center">
            <p className="text-xs text-slate-400">Ajoutez des écritures pour calculer la RS.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Section title="Calcul RS">
                <FiscalLine label="Retenue source (43674)" value={rsDue} total />
              </Section>
            </div>
            <div>
              <Section title="Barème RS tunisien">
                <div className="space-y-1 text-xs text-slate-400">
                  <div className="flex justify-between py-0.5"><span>Prestations de services</span><span className="font-mono text-slate-300">1.5%</span></div>
                  <div className="flex justify-between py-0.5"><span>Honoraires (personnes morales)</span><span className="font-mono text-slate-300">2.5%</span></div>
                  <div className="flex justify-between py-0.5"><span>Honoraires (personnes physiques)</span><span className="font-mono text-slate-300">3%</span></div>
                  <div className="flex justify-between py-0.5"><span>Revenus de capitaux mobiliers</span><span className="font-mono text-slate-300">10%</span></div>
                  <div className="flex justify-between py-0.5"><span>Dividendes</span><span className="font-mono text-slate-300">15%</span></div>
                </div>
              </Section>
            </div>
          </div>
        )}
      </div>

      {!useJournal && (
        <div className="p-6 bg-amber-500/5 border border-amber-500/20 rounded-2xl text-center">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
          <p className="text-sm text-slate-300 font-bold">Données insuffisantes</p>
          <p className="text-xs text-slate-500 mt-1">Les déclarations fiscales précises nécessitent des écritures comptables dans le journal.</p>
        </div>
      )}
    </div>
  );
}
