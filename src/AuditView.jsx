import React, { useState, useEffect, useCallback } from 'react';
import { runJournalAudit, generateAuditMarkdown } from './auditEngine';
import { ShieldCheck, AlertTriangle, CheckCircle, XCircle, Download, RefreshCw, FileText, Sparkles, BarChart3, ListChecks } from 'lucide-react';
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
        <div className="p-12 text-center border-2 border-dashed border-slate-700 rounded-2xl bg-slate-900/10">
          <BarChart3 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-xs text-slate-400 mb-2">Analyse complète du journal comptable</p>
          <p className="text-[10px] text-slate-500 max-w-md mx-auto">
            Vérification des écritures, TVA, IS, RS, paie, ratios financiers, équilibre du bilan et conformité PCG.
          </p>
        </div>
      )}

      {running && (
        <div className="p-12 flex flex-col items-center justify-center">
          <RefreshCw className="w-8 h-8 text-brand-400 animate-spin mb-3" />
          <span className="text-xs text-slate-400">Analyse du journal en cours...</span>
        </div>
      )}

      {auditResult && !running && (
        <>
          {/* Score & Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="glass-card p-4 rounded-xl border border-slate-700/50 text-center">
              <p className="text-3xl font-black" style={{ color: auditResult.score >= 80 ? '#34d399' : auditResult.score >= 60 ? '#fbbf24' : '#f87171' }}>
                {auditResult.score}
              </p>
              <p className="text-[10px] text-slate-400 uppercase font-bold mt-1">Score</p>
            </div>
            <div className="glass-card p-4 rounded-xl border border-slate-700/50 text-center">
              <p className="text-lg font-black text-emerald-400">{auditResult.summary.passed}</p>
              <p className="text-[10px] text-slate-400 uppercase font-bold mt-1">Conformes</p>
            </div>
            <div className="glass-card p-4 rounded-xl border border-slate-700/50 text-center">
              <p className="text-lg font-black text-amber-400">{auditResult.summary.warned}</p>
              <p className="text-[10px] text-slate-400 uppercase font-bold mt-1">Avertiss.</p>
            </div>
            <div className="glass-card p-4 rounded-xl border border-slate-700/50 text-center">
              <p className="text-lg font-black text-red-400">{auditResult.summary.failed}</p>
              <p className="text-[10px] text-slate-400 uppercase font-bold mt-1">Non conf.</p>
            </div>
            <div className="glass-card p-4 rounded-xl border border-slate-700/50 text-center">
              <p className="text-lg font-black text-slate-100">{auditResult.stats?.entriesCount || 0}</p>
              <p className="text-[10px] text-slate-400 uppercase font-bold mt-1">Écritures</p>
            </div>
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
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <ListChecks className="w-3.5 h-3.5" /> Contrôles effectués ({auditResult.checks.length})
            </h4>
            {auditResult.checks.map((c, i) => (
              <div key={c.id} className={`flex items-start gap-3 p-3 rounded-xl border ${statusBg(c.status)}`}>
                {statusIcon(c.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{c.category}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${statusBadge(c.status)}`}>
                      {labels[c.status]}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-200 mt-0.5">{c.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{c.detail}</p>
                </div>
              </div>
            ))}
          </div>

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
