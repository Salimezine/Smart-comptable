import React, { useState, useEffect, useMemo } from 'react';
import { Clock, CheckCircle2, XCircle, AlertTriangle, Download, Trash2, Filter, Search, ChevronDown, Activity, Send, RefreshCw, FileText } from 'lucide-react';
import SectionHeader from '../components/SectionHeader';
import KpiCard from '../components/KpiCard';
import { getSubmissionLog, getSubmissionStats, exportSubmissionCSV, clearSubmissionLog } from '../utils/submissionAudit';

const ACTION_LABELS = {
  send: 'Envoi', poll: 'Vérification', accept: 'Acceptation', reject: 'Rejet',
  confirm: 'Confirmation', callback: 'Callback', error: 'Erreur', generate: 'Génération XML',
};

const STATUS_COLORS = {
  accepted: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  transmitted: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  error: 'bg-red-500/15 text-red-400 border-red-500/30',
  generated: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

const MODE_LABELS = { dev: 'Sandbox', prod: 'Production', middleware: 'Middleware' };

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

export default function SubmissionAuditView({ companyDetails }) {
  const [log, setLog] = useState([]);
  const [filter, setFilter] = useState({ status: '', mode: '', search: '' });
  const [showFilters, setShowFilters] = useState(false);

  const companyId = companyDetails?.id || localStorage.getItem('smart_comptable_current_id') || '';

  useEffect(() => {
    setLog(getSubmissionLog({ companyId, limit: 2000 }));
  }, [companyId]);

  const refresh = () => setLog(getSubmissionLog({ companyId, limit: 2000 }));

  const stats = useMemo(() => getSubmissionStats({ companyId }), [log]);

  const filtered = useMemo(() => {
    let result = log;
    if (filter.status) result = result.filter(e => e.status === filter.status);
    if (filter.mode) result = result.filter(e => e.mode === filter.mode);
    if (filter.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(e =>
        (e.invoiceNumber || '').toLowerCase().includes(q) ||
        (e.details || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [log, filter]);

  const handleExport = () => {
    const csv = exportSubmissionCSV({ companyId });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `submissions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    if (window.confirm('Effacer tout l\'historique des soumissions ?')) {
      clearSubmissionLog();
      setLog([]);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Activity}
        title="Audit des Soumissions"
        subtitle="Historique complet des envois TEIF, middleware et TTN"
        action={
          <div className="flex items-center gap-2">
            <button onClick={refresh}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700/50 text-[10px] font-bold text-slate-400 hover:text-slate-200 transition-colors">
              <RefreshCw className="w-3 h-3" /> Actualiser
            </button>
            <button onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700/50 text-[10px] font-bold text-slate-400 hover:text-slate-200 transition-colors">
              <Download className="w-3 h-3" /> CSV
            </button>
            <button onClick={handleClear}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-700/30 text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors">
              <Trash2 className="w-3 h-3" /> Effacer
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard title="Total soumissions" value={stats.total} icon={Send} />
        <KpiCard title="Acceptées" value={stats.accepted} icon={CheckCircle2} color="emerald" />
        <KpiCard title="Rejetées" value={stats.rejected} icon={XCircle} color="red" />
        <KpiCard title="En attente" value={stats.pending} icon={Clock} color="amber" />
        <KpiCard title="Erreurs" value={stats.errors} icon={AlertTriangle} color="red" />
      </div>

      <div className="bg-slate-900/30 border border-slate-800/40 rounded-xl p-4">
        <button onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors">
          <Filter className="w-3.5 h-3.5" /> Filtres <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
        {showFilters && (
          <div className="flex flex-wrap gap-3 mt-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input type="text" value={filter.search} onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
                placeholder="Rechercher facture..."
                className="w-48 bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500" />
            </div>
            <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300">
              <option value="">Tous les statuts</option>
              <option value="accepted">Accepté</option>
              <option value="rejected">Rejeté</option>
              <option value="pending">En attente</option>
              <option value="error">Erreur</option>
              <option value="generated">Généré</option>
            </select>
            <select value={filter.mode} onChange={e => setFilter(f => ({ ...f, mode: e.target.value }))}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300">
              <option value="">Tous les modes</option>
              <option value="dev">Sandbox</option>
              <option value="prod">Production</option>
              <option value="middleware">Middleware</option>
            </select>
          </div>
        )}
      </div>

      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-800/90 backdrop-blur-sm">
                <th className="text-left px-4 py-3 text-slate-400 font-bold uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-slate-400 font-bold uppercase tracking-wide">Facture</th>
                <th className="text-left px-4 py-3 text-slate-400 font-bold uppercase tracking-wide">Action</th>
                <th className="text-center px-4 py-3 text-slate-400 font-bold uppercase tracking-wide">Statut</th>
                <th className="text-center px-4 py-3 text-slate-400 font-bold uppercase tracking-wide">Mode</th>
                <th className="text-left px-4 py-3 text-slate-400 font-bold uppercase tracking-wide">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-slate-500">Aucune soumission enregistrée</td></tr>
              )}
              {filtered.map(entry => (
                <tr key={entry.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap font-mono text-[10px]">{formatDate(entry.timestamp)}</td>
                  <td className="px-4 py-2.5 font-semibold text-slate-200">{entry.invoiceNumber || '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1 text-slate-300">
                      {ACTION_LABELS[entry.action] || entry.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_COLORS[entry.status] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                      {entry.status === 'accepted' && <CheckCircle2 className="w-2.5 h-2.5" />}
                      {entry.status === 'rejected' && <XCircle className="w-2.5 h-2.5" />}
                      {entry.status === 'error' && <AlertTriangle className="w-2.5 h-2.5" />}
                      {entry.status === 'pending' && <Clock className="w-2.5 h-2.5" />}
                      {entry.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className="text-slate-400">{MODE_LABELS[entry.mode] || entry.mode}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 max-w-[250px] truncate" title={entry.details}>
                    {entry.details || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
