import React, { useState, useEffect, useCallback } from 'react';
import { FileText, CheckCircle2, XCircle, Clock, RefreshCw, Send, AlertTriangle, Server } from 'lucide-react';
import SectionHeader from '../components/SectionHeader';
import KpiCard from '../components/KpiCard';
import { getTTNMode } from '../teif';
import * as api from '../utils/api';

const STATUS_LABELS = {
  NONE: 'Non soumise',
  PENDING: 'En cours...',
  SIGNED: 'Signée',
  ACCEPTED: 'Acceptée',
  REJECTED: 'Rejetée',
  FAILED: 'Échec',
  TTN_PENDING: 'En attente TTN',
};

const STATUS_COLORS = {
  NONE: { bg: 'bg-slate-800', text: 'text-slate-400' },
  PENDING: { bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30', text: 'text-amber-400' },
  SIGNED: { bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30', text: 'text-blue-400' },
  ACCEPTED: { bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', text: 'text-emerald-400' },
  REJECTED: { bg: 'bg-red-500/15 text-red-400 border-red-500/30', text: 'text-red-400' },
  FAILED: { bg: 'bg-red-500/15 text-red-400 border-red-500/30', text: 'text-red-400' },
  TTN_PENDING: { bg: 'bg-purple-500/15 text-purple-400 border-purple-500/30', text: 'text-purple-400' },
};

const STATUS_ICONS = {
  NONE: Clock,
  PENDING: Clock,
  SIGNED: FileText,
  ACCEPTED: CheckCircle2,
  REJECTED: XCircle,
  FAILED: XCircle,
  TTN_PENDING: Clock,
};

export default function TeifDeclarationView({ invoices: localInvoices, companyDetails }) {
  const [teifMap, setTeifMap] = useState({});
  const [generatingId, setGeneratingId] = useState(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [errorModal, setErrorModal] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [connected, setConnected] = useState(!!api.getApiToken());

  const currentId = localStorage.getItem('smart_comptable_current_id');

  useEffect(() => {
    if (!currentId || !api.getApiToken()) return;
    setSyncing(true);
    api.getCompanies()
      .then(companies => {
        const company = companies.find(c => c.id === currentId);
        if (!company) return;
        return api.getInvoices(currentId)
          .then(backendInvoices => {
            const map = {};
            for (const inv of backendInvoices) {
              if (inv.teif_status && inv.teif_status !== 'NONE') {
                map[inv.invoice_number] = {
                  status: inv.teif_status,
                  documentId: inv.middleware_document_id,
                  hasXml: !!inv.teif_xml,
                };
              }
            }
            setTeifMap(map);
            setConnected(true);
          });
      })
      .catch(() => { setConnected(false); })
      .finally(() => setSyncing(false));
  }, [currentId]);

  const handleSubmitToTEIF = useCallback(async (inv) => {
    setGeneratingId(inv.id);
    try {
      if (!api.getApiToken()) {
        setErrorModal({ title: 'Backend non connecté', errors: ['Connectez-vous au backend Smart Comptable pour soumettre les factures à la TEIF.'] });
        return;
      }
      const companies = await api.getCompanies();
      const company = companies.find(c => c.id === currentId);
      if (!company) throw new Error('Société introuvable');
      const result = await api.submitInvoice(inv.id, company.tax_id);
      setTeifMap(prev => ({
        ...prev,
        [inv.invoice_number || inv.id]: { status: 'PENDING', documentId: result.documentId },
      }));
    } catch (err) {
      setTeifMap(prev => ({ ...prev, [inv.invoice_number || inv.id]: { status: 'FAILED' } }));
      setErrorModal({ title: 'Erreur soumission TEIF', errors: [err.message] });
    } finally {
      setGeneratingId(null);
    }
  }, [currentId]);

  const handleSync = useCallback(async () => {
    if (!api.getApiToken()) return;
    setSyncing(true);
    try {
      const backendInvoices = await api.getInvoices(currentId);
      const map = {};
      for (const inv of backendInvoices) {
        if (inv.teif_status && inv.teif_status !== 'NONE') {
          map[inv.invoice_number] = {
            status: inv.teif_status,
            documentId: inv.middleware_document_id,
            hasXml: !!inv.teif_xml,
          };
        }
      }
      setTeifMap(map);
    } catch { /* ignore */ }
    setSyncing(false);
  }, [currentId]);

  const invoices = localInvoices.filter(inv => inv.status !== 'cancelled');

  const statusCounts = {
    all: invoices.length,
    pending: invoices.filter(inv => !teifMap[inv.invoice_number || inv.id]).length,
    signed: invoices.filter(inv => teifMap[inv.invoice_number || inv.id]?.status === 'SIGNED').length,
    accepted: invoices.filter(inv => teifMap[inv.invoice_number || inv.id]?.status === 'ACCEPTED').length,
    failed: invoices.filter(inv => teifMap[inv.invoice_number || inv.id]?.status === 'FAILED' || teifMap[inv.invoice_number || inv.id]?.status === 'REJECTED').length,
    ttnPending: invoices.filter(inv => teifMap[inv.invoice_number || inv.id]?.status === 'TTN_PENDING').length,
  };
  const pendingCount = invoices.filter(inv => !teifMap[inv.invoice_number || inv.id] || teifMap[inv.invoice_number || inv.id]?.status === 'FAILED').length;

  const handleBatchSubmit = async () => {
    const pending = invoices.filter(inv => !teifMap[inv.invoice_number || inv.id] || teifMap[inv.invoice_number || inv.id]?.status === 'FAILED');
    if (pending.length === 0) return;
    setBatchRunning(true);
    for (let i = 0; i < pending.length; i++) {
      setBatchProgress({ current: i + 1, total: pending.length });
      await handleSubmitToTEIF(pending[i]);
    }
    setBatchRunning(false);
    setBatchProgress({ current: 0, total: 0 });
  };

  function StatusBadge({ entry }) {
    const status = entry?.status;
    if (!status || status === 'NONE') return <span className="text-[10px] text-slate-500">En attente</span>;
    const style = STATUS_COLORS[status] || STATUS_COLORS.NONE;
    const Icon = STATUS_ICONS[status] || Clock;
    const label = STATUS_LABELS[status] || status;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${style.bg}`}>
        <Icon className="w-2.5 h-2.5" /> {label}
        {entry?.hasXml && status === 'SIGNED' && <span className="ml-0.5 text-[8px] opacity-60">✓XML</span>}
      </span>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader
          icon={FileText}
          title="TEIF & Télédéclaration"
          subtitle="Soumission des factures à la TEIF via le backend Smart Comptable"
        />
        <div className="flex items-center gap-2">
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700/50 text-[10px] font-bold text-slate-400 hover:text-slate-200 transition-colors">
            <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} /> SYNC
          </button>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold ${connected ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
            <Server className="w-3 h-3" />
            {connected ? 'API Connectée' : 'API Déconnectée'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KpiCard title="Total" value={statusCounts.all} icon={FileText} />
        <KpiCard title="En attente" value={statusCounts.pending} icon={Clock} color="amber" />
        <KpiCard title="Signées" value={statusCounts.signed} icon={FileText} color="blue" />
        <KpiCard title="Acceptées TTN" value={statusCounts.accepted} icon={CheckCircle2} color="emerald" />
        <KpiCard title="TTN en cours" value={statusCounts.ttnPending} icon={Send} color="purple" />
        {statusCounts.failed > 0 && <KpiCard title="Échec" value={statusCounts.failed} icon={XCircle} color="red" />}
      </div>

      <div className="flex items-center justify-between gap-4 px-4 py-2.5 bg-slate-900/30 border border-slate-800/40 rounded-xl">
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          <span>Mode: <span className="text-slate-300">{getTTNMode() === 'prod' ? 'Production' : 'Sandbox'}</span></span>
          <span className="h-4 w-px bg-slate-700/50" />
          <span>Backend: <span className={connected ? 'text-emerald-400' : 'text-red-400'}>{connected ? 'Connecté' : 'Non connecté'}</span></span>
          <span className="h-4 w-px bg-slate-700/50" />
          <span>Synchronisation: <span className="text-slate-300">{syncing ? '...' : `${Object.keys(teifMap).length} statuts`}</span></span>
        </div>
      </div>

      {connected && pendingCount > 0 && (
        <div className="flex justify-end">
          <button onClick={handleBatchSubmit} disabled={batchRunning}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-colors">
            {batchRunning ? (
              <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> {batchProgress.current}/{batchProgress.total}...</>
            ) : (
              <><Send className="w-3.5 h-3.5" /> Soumettre à la TEIF ({pendingCount})</>
            )}
          </button>
        </div>
      )}

      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-800/40">
                <th className="text-left px-4 py-3 text-slate-400 font-bold uppercase tracking-wide">Facture</th>
                <th className="text-left px-4 py-3 text-slate-400 font-bold uppercase tracking-wide">Client</th>
                <th className="text-right px-4 py-3 text-slate-400 font-bold uppercase tracking-wide">Montant</th>
                <th className="text-center px-4 py-3 text-slate-400 font-bold uppercase tracking-wide">Statut TEIF</th>
                <th className="text-right px-4 py-3 text-slate-400 font-bold uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {invoices.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-slate-500">Aucune facture à déclarer</td></tr>
              )}
              {invoices.map(inv => {
                const key = inv.invoice_number || inv.id;
                const entry = teifMap[key];
                return (
                  <tr key={inv.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-bold text-slate-200">{inv.invoiceNumber || inv.invoice_number || inv.numero}</span>
                      <span className="text-slate-500 ml-2">{inv.issueDate || inv.issue_date || inv.date}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{inv.clientName || inv.client_name || inv.client}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-200">
                      {((inv.totalTTC?.amount) || inv.totalAmount || inv.montantTTC || 0).toFixed(3)} DT
                    </td>
                    <td className="px-4 py-3 text-center"><StatusBadge entry={entry} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(!entry || entry.status === 'FAILED' || entry.status === 'NONE') && connected && (
                          <button onClick={() => handleSubmitToTEIF(inv)} disabled={generatingId === inv.id}
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 disabled:opacity-40 text-white text-[10px] font-semibold transition-colors">
                            {generatingId === inv.id ? '...' : 'TEIF'}
                          </button>
                        )}
                        {entry?.status === 'ACCEPTED' && (
                          <span className="px-2 py-1.5 text-[10px] text-emerald-400 font-semibold">Transmis ✓</span>
                        )}
                        {entry?.status === 'FAILED' && !connected && (
                          <span className="px-2 py-1.5 text-[10px] text-red-400 font-semibold">Échec local</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {errorModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setErrorModal(null)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              <h3 className="font-bold text-slate-100">{errorModal.title}</h3>
            </div>
            <ul className="space-y-1">
              {(errorModal.errors || []).map((err, i) => (
                <li key={i} className="text-xs text-red-300/80">• {err.message || err}</li>
              ))}
            </ul>
            <button onClick={() => setErrorModal(null)} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors">Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}
