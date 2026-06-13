import React, { useState, useEffect, useCallback } from 'react';
import { runJournalAudit, generateAuditMarkdown } from './auditEngine';
import { ShieldCheck, AlertTriangle, CheckCircle, XCircle, Download, RefreshCw, FileText, Sparkles, BarChart3, ListChecks, Info, Play, TrendingUp } from 'lucide-react';
import { jsPDF } from 'jspdf';

const fmt = (v) => {
  if (v == null || isNaN(v)) return '0,000 DT';
  return v.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' DT';
};

const statusIcon = (s) => {
  if (s === 'pass') return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
  if (s === 'warn') return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
  if (s === 'fail') return <XCircle className="w-3.5 h-3.5 text-red-400" />;
  return <Info className="w-3.5 h-3.5 text-slate-400" />;
};

const statusBg = (s) => {
  if (s === 'pass') return 'bg-emerald-500/10 border-emerald-600/20';
  if (s === 'warn') return 'bg-amber-500/10 border-amber-600/20';
  if (s === 'fail') return 'bg-red-500/10 border-red-600/20';
  return 'bg-slate-800/40 border-slate-700/30';
};

const statusBadge = (s) => {
  if (s === 'pass') return 'bg-emerald-500/20 text-emerald-400';
  if (s === 'warn') return 'bg-amber-500/20 text-amber-400';
  if (s === 'fail') return 'bg-red-500/20 text-red-400';
  return 'bg-slate-700/40 text-slate-400';
};

const labels = { pass: 'Conforme', warn: 'Attention', fail: 'Non conforme', info: 'Info' };

export default function AuditView({ companyDetails }) {
  const [auditResult, setAuditResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const runAudit = useCallback(() => {
    setRunning(true);
    setError('');
    try {
      const result = runJournalAudit({ companyDetails });
      setAuditResult(result);
    } catch (e) {
      console.error('AUDIT ERROR:', e);
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }, [companyDetails]);

  useEffect(() => {
    setAuditResult(null);
    setError('');
  }, [companyDetails]);

  useEffect(() => {
    const handler = () => {
      if (auditResult) runAudit();
    };
    window.addEventListener('journal:updated', handler);
    return () => window.removeEventListener('journal:updated', handler);
  }, [auditResult, runAudit]);

  const exportPDF = () => {
    if (!auditResult) return;
    const md = generateAuditMarkdown(auditResult);
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const m = 14;
    let y = 20;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text("Rapport d'Audit Smart-Comptable", 105, y, { align: 'center' });
    y += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Société : ${auditResult.companyName}`, m, y);
    y += 6;
    doc.text(`Date : ${auditResult.date}`, m, y);
    y += 6;
    const gradeLabel = auditResult.score >= 80 ? 'Excellent' : auditResult.score >= 60 ? 'Acceptable' : 'Critique';
    doc.text(`Score : ${auditResult.score}/100 — ${gradeLabel}`, m, y);
    y += 10;

    const { stats } = auditResult;
    if (stats) {
      doc.setFont('helvetica', 'bold');
      doc.text('Statistiques du journal', m, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Écritures: ${stats.entriesCount}  |  Verrouillées: ${stats.lockedCount}  |  Non équilibrées: ${stats.unbalancedCount}`, m, y);
      y += 5;
      doc.text(`TVA collectée: ${(stats.tvaCollected || 0).toFixed(3)} DT  |  TVA déductible: ${(stats.tvaDeductible || 0).toFixed(3)} DT`, m, y);
      y += 10;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Contrôles : ${auditResult.summary.passed} ✅ / ${auditResult.summary.warned} ⚠️ / ${auditResult.summary.failed} ❌`, m, y);
    y += 4;

    for (const c of auditResult.checks) {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      const icon = c.status === 'pass' ? '✅' : c.status === 'warn' ? '⚠️' : c.status === 'fail' ? '❌' : 'ℹ️';
      const txt = `${icon} [${c.category}] ${c.label}`;
      doc.text(txt, m, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      const detail = (c.detail || '').substring(0, 120);
      doc.text(detail, m + 4, y);
      y += 5;
    }

    if (auditResult.recommendations.length > 0) {
      y += 4;
      if (y > 230) { doc.addPage(); y = 20; }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Recommandations', m, y);
      y += 6;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      for (const r of auditResult.recommendations) {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(`- ${r}`, m + 2, y);
        y += 5;
      }
    }

    doc.save(`Audit_${auditResult.date}.pdf`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-slate-100 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-brand-400" /> Audit Comptable
        </h3>
        <div className="flex gap-2">
          {auditResult && (
            <button onClick={exportPDF}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 text-xs font-bold rounded-xl border border-indigo-500/30 transition-all">
              <Download className="w-3.5 h-3.5" /> PDF
            </button>
          )}
          <button onClick={runAudit} disabled={running}
            className="flex items-center gap-2 px-4 py-1.5 bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 text-xs font-bold rounded-xl border border-brand-500/30 transition-all disabled:opacity-50">
            {running ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Lancer l'audit
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
          Erreur : {error}
        </div>
      )}

      {!auditResult && !running && (
        <div className="relative p-12 text-center rounded-3xl overflow-hidden border border-slate-800/60 bg-slate-900/20">
          {/* Animated ambient orbs */}
          <div className="absolute w-64 h-64 bg-indigo-600/8 rounded-full blur-[80px] -top-16 -left-16 pointer-events-none" />
          <div className="absolute w-48 h-48 bg-emerald-600/6 rounded-full blur-[60px] -bottom-10 -right-10 pointer-events-none" />

          {/* Central icon cluster */}
          <div className="relative flex items-center justify-center mb-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500/15 to-violet-500/10 border border-indigo-500/20 flex items-center justify-center animate-glow-pulse">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500/20 to-violet-600/15 border border-indigo-400/30 flex items-center justify-center">
                <ShieldCheck className="w-8 h-8 text-indigo-400" />
              </div>
            </div>
            {/* Orbiting mini-icons */}
            <div className="absolute w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center" style={{ animation: 'orbit 6s linear infinite', top: '50%', left: '50%', marginLeft: '-16px', marginTop: '-16px' }}>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="absolute w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center" style={{ animation: 'orbit 8s linear reverse infinite', top: '50%', left: '50%', marginLeft: '-14px', marginTop: '-14px' }}>
              <BarChart3 className="w-3 h-3 text-amber-400" />
            </div>
          </div>

          <h3 className="text-lg font-black text-white mb-2">Audit Comptable & Conformité</h3>
          <p className="text-sm text-slate-400 mb-1">Analyse complète du journal comptable</p>
          <p className="text-[11px] text-slate-500 max-w-sm mx-auto mb-8 leading-relaxed">
            Vérification des écritures, TVA, IS, RS, paie, ratios financiers, équilibre du bilan et conformité PCG — en quelques secondes.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button onClick={runAudit}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white font-bold rounded-xl shadow-[0_4px_24px_rgba(99,102,241,0.4)] hover:shadow-[0_6px_32px_rgba(99,102,241,0.6)] transition-all duration-300 text-sm">
              <Play className="w-4 h-4" /> Lancer l'audit maintenant
            </button>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {['TVA & IS', 'Retenue Source', 'Paie CNSS', 'Équilibre Bilan', 'Ratios Financiers', 'Conformité PCG'].map(tag => (
              <span key={tag} className="px-2.5 py-1 bg-slate-800/60 border border-slate-700/50 rounded-full text-[10px] text-slate-400 font-medium">{tag}</span>
            ))}
          </div>
        </div>
      )}

      {running && (
        <div className="relative p-16 flex flex-col items-center justify-center rounded-3xl bg-slate-900/20 border border-slate-800/60 overflow-hidden">
          <div className="absolute w-48 h-48 bg-indigo-600/8 rounded-full blur-[60px] pointer-events-none" />
          <div className="relative w-16 h-16 rounded-full border-2 border-indigo-500/30 flex items-center justify-center mb-4 animate-glow-pulse">
            <RefreshCw className="w-7 h-7 text-indigo-400 animate-spin" />
          </div>
          <p className="text-sm font-bold text-white mb-1">Analyse en cours...</p>
          <span className="text-xs text-slate-400">Vérification des écritures et de la conformité PCG</span>
          <div className="mt-4 flex gap-1.5">
            {[0,1,2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}

      {auditResult && !running && (
        <>
          {/* Score & Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Score gauge card */}
            <div className={`glass-card p-5 rounded-2xl border col-span-2 md:col-span-1 flex flex-col items-center justify-center ${
              auditResult.score >= 80 ? 'border-emerald-500/25 bg-emerald-500/5' :
              auditResult.score >= 60 ? 'border-amber-500/25 bg-amber-500/5' :
              'border-red-500/25 bg-red-500/5'
            }`}>
              <div className="relative w-24 h-24 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  {/* Track */}
                  <circle cx="18" cy="18" r="15.9155" stroke="rgba(255,255,255,0.05)" strokeWidth="3" fill="none" />
                  {/* Fill */}
                  <path
                    className="animate-gauge"
                    strokeWidth="3.2"
                    strokeDasharray={`${auditResult.score}, 100`}
                    strokeLinecap="round"
                    stroke={auditResult.score >= 80 ? 'url(#gaugeGreen)' : auditResult.score >= 60 ? 'url(#gaugeAmber)' : 'url(#gaugeRed)'}
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <defs>
                    <linearGradient id="gaugeGreen" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#34d399" /><stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                    <linearGradient id="gaugeAmber" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#fcd34d" /><stop offset="100%" stopColor="#f59e0b" />
                    </linearGradient>
                    <linearGradient id="gaugeRed" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#fca5a5" /><stop offset="100%" stopColor="#ef4444" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute text-center">
                  <span className="text-2xl font-black" style={{ color: auditResult.score >= 80 ? '#34d399' : auditResult.score >= 60 ? '#fbbf24' : '#f87171' }}>
                    {auditResult.score}
                  </span>
                  <span className="block text-[8px] text-slate-500 font-bold">/100</span>
                </div>
              </div>
              <p className="text-[9px] text-slate-400 uppercase font-black tracking-wider mt-2">Score Global</p>
              <span className={`mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                auditResult.score >= 80 ? 'bg-emerald-500/15 text-emerald-400' :
                auditResult.score >= 60 ? 'bg-amber-500/15 text-amber-400' :
                'bg-red-500/15 text-red-400'
              }`}>
                {auditResult.score >= 80 ? 'Excellent' : auditResult.score >= 60 ? 'Acceptable' : 'Critique'}
              </span>
            </div>

            {[
              { label: 'Conformes', count: auditResult.summary.passed, color: 'text-emerald-400', bg: 'bg-emerald-500/8 border-emerald-500/20' },
              { label: 'Avertissements', count: auditResult.summary.warned, color: 'text-amber-400', bg: 'bg-amber-500/8 border-amber-500/20' },
              { label: 'Non Conformes', count: auditResult.summary.failed, color: 'text-red-400', bg: 'bg-red-500/8 border-red-500/20' },
              { label: 'Écritures', count: auditResult.stats?.entriesCount || 0, color: 'text-slate-100', bg: 'bg-slate-800/40 border-slate-700/30', span: 'col-span-2 md:col-span-1' },
            ].map((s) => (
              <div key={s.label} className={`glass-card p-4 rounded-2xl border text-center flex flex-col items-center justify-center ${s.bg} ${s.span || ''}`}>
                <p className={`text-3xl font-black ${s.color}`}>{s.count}</p>
                <p className="text-[10px] text-slate-400 uppercase font-bold mt-1.5 tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Stats détaillées */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/30">
              <p className="text-[10px] text-slate-500 font-bold uppercase">TVA collectée</p>
              <p className="text-sm font-bold text-slate-100">{fmt(auditResult.stats?.tvaCollected)}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/30">
              <p className="text-[10px] text-slate-500 font-bold uppercase">TVA déductible</p>
              <p className="text-sm font-bold text-slate-100">{fmt(auditResult.stats?.tvaDeductible)}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/30">
              <p className="text-[10px] text-slate-500 font-bold uppercase">RS (43674)</p>
              <p className="text-sm font-bold text-slate-100">{fmt(auditResult.stats?.rsSolde)}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/30">
              <p className="text-[10px] text-slate-500 font-bold uppercase">IS provisionné</p>
              <p className="text-sm font-bold text-slate-100">{fmt(auditResult.stats?.isProvision)}</p>
            </div>
          </div>

          {/* Checks */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <ListChecks className="w-3.5 h-3.5" /> Contrôles effectués ({auditResult.checks.length})
            </h4>
            {auditResult.checks.map((c, i) => {
              const borderColor = 
                c.status === 'pass' ? 'border-l-emerald-500' :
                c.status === 'warn' ? 'border-l-amber-500' :
                c.status === 'fail' ? 'border-l-red-500' : 'border-l-slate-500';
              return (
                <div key={c.id} className={`flex items-start gap-3.5 p-4 rounded-xl border border-slate-800/60 border-l-4 ${borderColor} ${statusBg(c.status)} hover:bg-slate-800/30 transition-all duration-200 hover:-translate-y-[1px]`}>
                  <div className="mt-0.5">{statusIcon(c.status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{c.category}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${statusBadge(c.status)}`}>
                        {labels[c.status]}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-100 mt-1">{c.label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{c.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Optimisations fiscales & réduction de charges */}
          {auditResult.optimizations?.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" /> Conseils d'optimisation ({auditResult.optimizations.length})
              </h4>
              {auditResult.optimizations.map((o, i) => {
                const typeColors = { reduction: 'border-red-600/20 bg-red-500/5', fiscal: 'border-amber-600/20 bg-amber-500/5', structure: 'border-blue-600/20 bg-blue-500/5', investissement: 'border-emerald-600/20 bg-emerald-500/5' };
                const bg = typeColors[o.type] || 'border-slate-600/20 bg-slate-800/30';
                return (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${bg}`}>
                    <span className="text-lg">{o.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-200">{o.title}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{o.detail}</p>
                      {o.gain && (
                        <p className="text-[10px] text-emerald-400 font-semibold mt-1">{o.gain}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Recommendations */}
          {auditResult.recommendations.length > 0 && (
            <div className="glass-card p-4 rounded-xl border border-slate-700/50">
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2 mb-2">
                <FileText className="w-3.5 h-3.5 text-brand-400" /> Recommandations
              </h4>
              <ul className="space-y-1.5">
                {auditResult.recommendations.map((r, i) => (
                  <li key={i} className="text-[10px] text-slate-400 flex items-start gap-2">
                    <span className="text-brand-400 mt-0.5">•</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
