import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, CheckCircle2, XCircle, Clock, RefreshCw, Send, AlertTriangle, Download, Upload, ExternalLink } from 'lucide-react';
import SectionHeader from '../components/SectionHeader';
import KpiCard from '../components/KpiCard';
import { generateTEIFXML, validateTEIF, downloadTEIFXML } from '../utils/teifGenerator';
import { sendToTTN, handleTTNResponse, downloadTTNXml, confirmTTNTransmission, sendToMiddleware, mapInvoiceToMiddlewareDoc, pollMiddlewareStatus, resolveAutoMode } from '../utils/ttnWorkflow';
import { getTTNMode, setTTNMode } from '../teif';
import * as api from '../utils/teifSupabaseService';
import { logSubmission } from '../utils/submissionAudit';

const TTN_STATUS_KEY = 'smart_ttn_local_status';

const STATUS_DEFS = {
  none:        { label: 'Non généré',       color: 'bg-slate-800 text-slate-400',                    icon: Clock,         order: 0 },
  generated:   { label: 'XML généré',       color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', icon: FileText,      order: 1 },
  transmitted: { label: 'En attente signature', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: Upload, order: 2 },
  accepted:    { label: 'Accepté TTN',      color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: CheckCircle2, order: 3 },
  rejected:    { label: 'Rejeté',           color: 'bg-red-500/15 text-red-400 border-red-500/30',    icon: XCircle,      order: -1 },
};

function loadLocalStatuses() {
  try {
    return JSON.parse(localStorage.getItem(TTN_STATUS_KEY) || '{}');
  } catch { return {}; }
}

function saveLocalStatuses(map) {
  localStorage.setItem(TTN_STATUS_KEY, JSON.stringify(map));
}

export default function TeifDeclarationView({ invoices: localInvoices, companyDetails, onAddPieceComptable }) {
  const [localMap, setLocalMap] = useState(loadLocalStatuses);
  const [backendMap, setBackendMap] = useState({});
  const [generatingId, setGeneratingId] = useState(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [modal, setModal] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [ttnMode, setTtnModeState] = useState(getTTNMode());
  const [pollingInvoice, setPollingInvoice] = useState(null);
  const pollRef = useRef(null);

  const currentId = localStorage.getItem('smart_comptable_current_id');
  const companyId = currentId || '';

  // Détecter le callback NGSign (redirection après signature)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const callback = params.get('teif_callback');
    if (callback) {
      window.history.replaceState({}, '', window.location.pathname);
      // Auto-vérifier le statut des factures en attente
      const entries = Object.entries(localMap);
      const pending = entries.filter(([_, v]) => v.status === 'transmitted');
      if (pending.length > 0) {
        setPollingInvoice(Date.now());
      }
    }
  }, []);

  // Auto-polling après signature
  useEffect(() => {
    if (pollingInvoice) {
      const entries = Object.entries(localMap);
      const transmitted = entries.filter(([_, v]) => v.status === 'transmitted');
      if (transmitted.length > 0) {
        pollRef.current = setInterval(async () => {
          for (const [invNum, data] of transmitted) {
            const inv = invoices.find(i => (i.invoice_number || i.invoiceNumber || i.id) === invNum);
            if (!inv) continue;
            const status = await pollMiddlewareStatus(invNum, {
              middlewareUrl: companyDetails?.middlewareUrl || data.middlewareUrl || '',
              middlewareToken: companyDetails?.middlewareToken || '',
            });
            if (status?.status === 'accepted') {
              clearInterval(pollRef.current);
              pollRef.current = null;
              setPollingInvoice(null);
              const ttnId = `MW-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;
              setStatus(inv, 'accepted', { ttnId, documentNumber: invNum });
              logSubmission({ invoiceNumber: invNum, action: 'poll', status: 'accepted', mode: 'middleware', details: `Signé et transmis TTN (ID: ${ttnId})`, companyId });
              onAddPieceComptable && onAddPieceComptable({
                id: `piece-${Date.now()}`, ttnId,
                date: inv.issueDate || inv.date,
                journal: 'VNT', reference: invNum,
                total: inv.totalAmount || inv.montantTTC || 0,
              });
              setModal({ title: 'Signature + TTN accepté ✓', message: `Document ${invNum} signé et transmis automatiquement.`, type: 'success' });
              return;
            }
            if (status?.status === 'rejected') {
              clearInterval(pollRef.current);
              pollRef.current = null;
              setPollingInvoice(null);
              setStatus(inv, 'rejected');
              logSubmission({ invoiceNumber: invNum, action: 'poll', status: 'rejected', mode: 'middleware', details: 'Rejeté par le middleware ou TTN', companyId });
              setModal({ title: 'Document rejeté', errors: ['Rejeté par le middleware ou TTN'], type: 'error' });
              return;
            }
          }
        }, 8000);
      }
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [pollingInvoice]);

  useEffect(() => {
    setLocalMap(loadLocalStatuses());
  }, []);

  useEffect(() => {
    api.ensureToken().then(token => {
      if (!currentId || !token) return;
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
              setBackendMap(map);
              setConnected(true);
            });
        })
        .catch(() => { setConnected(false); })
        .finally(() => setSyncing(false));
    });
  }, [currentId]);

  const invoices = localInvoices.filter(inv => inv.status !== 'cancelled');

  function getStatus(inv) {
    const key = inv.invoice_number || inv.invoiceNumber || inv.id;
    const local = localMap[key];
    const backend = backendMap[key];
    if (local?.status === 'accepted') return local;
    if (local?.status === 'rejected') return local;
    if (local?.status === 'transmitted') return local;
    if (local?.status === 'generated') return local;
    if (backend?.status === 'ACCEPTED') return { status: 'accepted', documentId: backend.documentId, hasXml: backend.hasXml, source: 'backend' };
    if (backend?.status === 'REJECTED') return { status: 'rejected', documentId: backend.documentId, source: 'backend' };
    if (backend?.status) return { status: backend.status.toLowerCase(), documentId: backend.documentId, source: 'backend' };
    return null;
  }

  function setStatus(inv, status, extra = {}) {
    const key = inv.invoice_number || inv.invoiceNumber || inv.id;
    const updated = { ...localMap, [key]: { status, timestamp: new Date().toISOString(), ...extra } };
    setLocalMap(updated);
    saveLocalStatuses(updated);
  }

  const statusCounts = {
    all: invoices.length,
    pending: invoices.filter(inv => !getStatus(inv)).length,
    generated: invoices.filter(inv => getStatus(inv)?.status === 'generated').length,
    transmitted: invoices.filter(inv => getStatus(inv)?.status === 'transmitted').length,
    accepted: invoices.filter(inv => getStatus(inv)?.status === 'accepted').length,
    failed: invoices.filter(inv => getStatus(inv)?.status === 'rejected').length,
  };
  const pendingCount = invoices.filter(inv => !getStatus(inv) || getStatus(inv)?.status === 'rejected').length;

  const handleGenerateTEIF = useCallback(async (invoice) => {
    setGeneratingId(invoice.id);
    try {
      const teifInvoice = {
        id: invoice.invoiceNumber || invoice.invoice_number || invoice.id,
        dateEmission: invoice.issueDate || invoice.issue_date || invoice.date || new Date().toISOString().slice(0, 10),
        dueDate: invoice.dueDate || '',
        type: '380',
        timbre: parseFloat(invoice.stampDuty || invoice.timbre || 0),
        fournisseur: {
          matriculeFiscal: companyDetails?.vatNumber || companyDetails?.matriculeFiscal || '',
          nom: companyDetails?.companyName || companyDetails?.name || '',
          adresse: companyDetails?.address || '',
          rne: companyDetails?.rne || '',
        },
        client: {
          matriculeFiscal: invoice.clientVat || invoice.vatNumber || '',
          nom: invoice.clientName || invoice.client_name || invoice.client || 'Client',
          adresse: invoice.clientAddress || invoice.address || '',
        },
        lignes: (invoice.items || []).length > 0
          ? invoice.items.map(item => ({
              designation: item.description || item.designation || 'Prestation',
              quantite: item.quantity || 1,
              prixUnitaireHT: parseFloat(item.unitPrice || item.prixUnitaireHT || 0),
              tauxTVA: (()=>{const r=parseFloat(item.vatRate ?? item.tauxTVA);return r===0?0:r||19})(),
              fodec: parseFloat(item.fodec || 0),
            }))
          : [{
              designation: invoice.category || 'Prestation',
              quantite: 1,
              prixUnitaireHT: parseFloat(invoice.subtotal || invoice.montantHT || 0),
              tauxTVA: (()=>{const r=parseFloat(invoice.vatRate);return r===0?0:r||19})(),
              fodec: 0,
            }],
      };

      let effectiveMode = ttnMode;
      if (ttnMode === 'auto') {
        const middlewareConfig = {
          middlewareUrl: companyDetails?.middlewareUrl || '',
          middlewareToken: companyDetails?.middlewareToken || '',
        };
        const { resolved, reason } = await resolveAutoMode(middlewareConfig);
        effectiveMode = resolved;
        logSubmission({ invoiceNumber: teifInvoice.id, action: 'auto_resolve', status: resolved, mode: 'auto', details: reason, companyId });
      }

      if (effectiveMode === 'middleware') {
        // Middleware flow: send invoice JSON to middleware API
        const doc = mapInvoiceToMiddlewareDoc(teifInvoice, companyDetails);
        const middlewareConfig = {
          middlewareUrl: companyDetails?.middlewareUrl || '',
          middlewareToken: companyDetails?.middlewareToken || '',
        };
        const response = await sendToMiddleware(doc, middlewareConfig);

        if (response.status === 'accepted') {
          // Automatic flow — worker signed + submitted to TTN directly
          const ttnId = response.ttnId || `MW-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;
          setStatus(invoice, 'accepted', { ttnId });
          logSubmission({ invoiceNumber: doc.header.documentNumber, action: 'accept', status: 'accepted', mode: 'middleware', details: `Signé et transmis TTN (ID: ${ttnId})`, companyId });
          onAddPieceComptable && onAddPieceComptable({
            id: `piece-${Date.now()}`, ttnId,
            date: teifInvoice.dateEmission,
            journal: 'VNT', reference: teifInvoice.id,
            total: doc.totals.totalTTC.amount,
          });
          setModal({ title: 'Facture signée et transmise TTN ✓', message: `Document ${doc.header.documentNumber} signé et accepté (ID: ${ttnId}).`, type: 'success' });
        } else if (response.status === 'pending' && response.signatureUrl) {
          // Set status to transmitted while waiting for signature
          setStatus(invoice, 'transmitted', {
            signatureUUID: response.signatureUUID,
            middlewareUrl: companyDetails?.middlewareUrl || '',
            documentNumber: doc.header.documentNumber,
          });
          logSubmission({ invoiceNumber: doc.header.documentNumber, action: 'send', status: 'pending', mode: 'middleware', details: 'Envoyé pour signature NGSign', companyId });
          // Auto-poll every 8s until accepted/rejected
          setPollingInvoice(Date.now());
          setModal({
            title: 'Document envoyé au middleware ✓',
            message: response.message || 'Le document a été envoyé pour signature. Cliquez sur le bouton ci-dessous pour signer.',
            instructions: [
              '1. Cliquez sur "Ouvrir la page de signature" pour signer via NGSign',
              '2. Après signature, le statut sera vérifié automatiquement',
              '3. Le middleware soumettra à TTN après signature',
            ],
            type: 'mwPending',
            signatureUrl: response.signatureUrl,
            documentNumber: doc.header.documentNumber,
            invoice,
          });
        } else if (response.status === 'pending' && !response.signatureUrl) {
          // Signature not needed (dev mode middleware) — accept directly
          const ttnId = `MW-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;
          setStatus(invoice, 'accepted', { ttnId });
          logSubmission({ invoiceNumber: doc.header.documentNumber, action: 'accept', status: 'accepted', mode: 'middleware', details: 'Accepté sans signature (mode simulé)', companyId });
          onAddPieceComptable && onAddPieceComptable({
            id: `piece-${Date.now()}`, ttnId,
            date: teifInvoice.dateEmission,
            journal: 'VNT', reference: teifInvoice.id,
            total: doc.totals.totalTTC.amount,
          });
          setModal({ title: 'Facture acceptée ✓', message: `Document ${doc.header.documentNumber} traité par le middleware.`, type: 'success' });
        } else {
          setStatus(invoice, 'rejected');
          logSubmission({ invoiceNumber: doc.header.documentNumber, action: 'error', status: 'rejected', mode: 'middleware', details: (response.errors || ['Erreur']).join('; '), companyId });
          setModal({ title: 'Échec middleware', errors: response.errors || ['Erreur'], type: 'error' });
        }
        return;
      }

      // Standard flow (dev/prod): generate XML then send to TTN
      const gen = generateTEIFXML(teifInvoice);
      if (gen.error) throw new Error(gen.error);

      const valid = validateTEIF(gen.xml);
      if (!valid.valid) {
        setModal({ title: 'Erreur de validation TEIF', errors: valid.errors, type: 'error' });
        return;
      }

      const response = await sendToTTN(gen.xml, {
        ttnMode: effectiveMode,
        invoiceId: teifInvoice.id,
      });

      if (response.status === 'accepted') {
        const handled = await handleTTNResponse(teifInvoice, response);
        if (handled.success) {
          setStatus(invoice, 'accepted', { ttnId: handled.ttnId, pieceId: handled.pieceId });
          logSubmission({ invoiceNumber: teifInvoice.id, action: 'accept', status: 'accepted', mode: ttnMode, details: `TTN ID: ${handled.ttnId}`, companyId });
          onAddPieceComptable && onAddPieceComptable({
            id: handled.pieceId,
            ttnId: handled.ttnId,
            date: teifInvoice.dateEmission,
            journal: 'VNT',
            reference: teifInvoice.id,
            total: gen.totalTTC,
          });
          setModal({ title: 'Facture acceptée TTN ✓', message: `ID TTN: ${handled.ttnId}`, type: 'success' });
        } else {
          setStatus(invoice, 'rejected');
          logSubmission({ invoiceNumber: teifInvoice.id, action: 'reject', status: 'rejected', mode: effectiveMode, details: (handled.errors || ['Rejeté']).join('; '), companyId });
          setModal({ title: 'Rejet TTN', errors: handled.errors || ['Rejeté'], type: 'error' });
        }
      } else if (response.status === 'manual') {
        setStatus(invoice, 'generated', { xml: gen.xml });
        logSubmission({ invoiceNumber: teifInvoice.id, action: 'generate', status: 'generated', mode: effectiveMode, details: 'XML TEIF généré — transmission manuelle requise', companyId });
        setModal({
          title: 'XML TEIF généré ✓',
          message: response.message,
          instructions: response.instructions || [],
          portalUrl: response.portalUrl,
          xml: gen.xml,
          invoiceId: teifInvoice.id,
          invoice,
          type: 'manual',
        });
      } else if (response.status === 'rejected') {
        setStatus(invoice, 'rejected');
        logSubmission({ invoiceNumber: teifInvoice.id, action: 'reject', status: 'rejected', mode: ttnMode, details: (response.errors || []).map(e => e.message || e).join('; '), companyId });
        setModal({ title: 'Échec TTN', errors: (response.errors || []).map(e => e.message || e), type: 'error' });
      }
    } catch (err) {
      setStatus(invoice, 'rejected');
      logSubmission({ invoiceNumber: teifInvoice.id, action: 'error', status: 'error', mode: ttnMode, details: err.message, companyId });
      setModal({ title: 'Erreur TEIF', errors: [err.message], type: 'error' });
    } finally {
      setGeneratingId(null);
    }
  }, [companyDetails, ttnMode, onAddPieceComptable]);

  const handleConfirmTransmission = async (invoice) => {
    try {
      const entry = getStatus(invoice);
      const ttnId = `TTN-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;
      const result = await confirmTTNTransmission(
        {
          id: invoice.invoiceNumber || invoice.invoice_number || invoice.id,
          dateEmission: invoice.issueDate || invoice.issue_date || invoice.date,
          type: '380',
          fournisseur: {
            matriculeFiscal: companyDetails?.vatNumber || companyDetails?.matriculeFiscal || '',
            nom: companyDetails?.companyName || companyDetails?.name || '',
          },
          client: {
            matriculeFiscal: invoice.clientVat || '',
            nom: invoice.clientName || 'Client',
          },
          lignes: [{ designation: 'Prestation', quantite: 1, prixUnitaireHT: parseFloat(invoice.subtotal || 0), tauxTVA: 19 }],
        },
        ttnId,
      );
      if (result.success) {
        setStatus(invoice, 'accepted', { ttnId: result.ttnId, pieceId: result.pieceId });
        logSubmission({ invoiceNumber: invoice.invoiceNumber || invoice.invoice_number || invoice.id, action: 'confirm', status: 'accepted', mode: ttnMode, details: `Transmission manuelle confirmée — TTN ID: ${result.ttnId}`, companyId });
        onAddPieceComptable && onAddPieceComptable({
          id: result.pieceId, ttnId: result.ttnId,
          date: invoice.issueDate || invoice.date,
          journal: 'VNT', reference: invoice.invoiceNumber || invoice.id,
          total: invoice.totalAmount || invoice.montantTTC || 0,
        });
        setModal({ title: 'Transmission confirmée ✓', message: `ID TTN: ${result.ttnId}`, type: 'success' });
      } else {
        logSubmission({ invoiceNumber: invoice.invoiceNumber || invoice.invoice_number || invoice.id, action: 'confirm', status: 'error', mode: ttnMode, details: (result.errors || []).join('; '), companyId });
        setModal({ title: 'Erreur', errors: result.errors, type: 'error' });
      }
    } catch (err) {
      setModal({ title: 'Erreur', errors: [err.message], type: 'error' });
    }
  };

  const handleBatchGenerate = async () => {
    const pending = invoices.filter(inv => !getStatus(inv) || getStatus(inv)?.status === 'rejected');
    if (pending.length === 0) return;
    setBatchRunning(true);
    for (let i = 0; i < pending.length; i++) {
      setBatchProgress({ current: i + 1, total: pending.length });
      await handleGenerateTEIF(pending[i]);
    }
    setBatchRunning(false);
    setBatchProgress({ current: 0, total: 0 });
  };

  const handleCheckStatus = useCallback(async (invoice) => {
    const entry = getStatus(invoice);
    const documentNumber = entry?.documentNumber || invoice.invoiceNumber || invoice.invoice_number || invoice.id;
    const middlewareUrl = companyDetails?.middlewareUrl || entry?.middlewareUrl || '';
    const middlewareToken = companyDetails?.middlewareToken || '';

    if (!middlewareUrl) {
      setModal({ title: 'Middleware non configuré', errors: ['Configurez l\'URL du middleware dans Configuration'], type: 'error' });
      return;
    }

    const status = await pollMiddlewareStatus(documentNumber, { middlewareUrl, middlewareToken });
    if (!status) {
      setModal({ title: 'Statut non disponible', message: 'Le middleware n\'a pas encore de statut pour ce document.', type: 'error' });
      return;
    }

    if (status.status === 'accepted') {
      const ttnId = `MW-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;
      setStatus(invoice, 'accepted', { ttnId, documentNumber });
      logSubmission({ invoiceNumber: documentNumber, action: 'accept', status: 'accepted', mode: 'middleware', details: 'Accepté via vérification manuelle', companyId });
      onAddPieceComptable && onAddPieceComptable({
        id: `piece-${Date.now()}`, ttnId,
        date: invoice.issueDate || invoice.date,
        journal: 'VNT', reference: documentNumber,
        total: invoice.totalAmount || invoice.montantTTC || 0,
      });
      setModal({ title: 'Facture acceptée ✓', message: `Document ${documentNumber} accepté par TTN via le middleware.`, type: 'success' });
    } else if (status.status === 'rejected') {
      setStatus(invoice, 'rejected');
      logSubmission({ invoiceNumber: documentNumber, action: 'reject', status: 'rejected', mode: 'middleware', details: 'Rejeté via vérification manuelle', companyId });
      setModal({ title: 'Document rejeté', errors: ['Rejeté par le middleware ou TTN'], type: 'error' });
    } else {
      setModal({ title: 'En attente', message: `Statut actuel: ${status.rawStatus || status.status}`, type: 'info' });
    }
  }, [companyDetails, onAddPieceComptable]);

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
      setBackendMap(map);
    } catch { /* sync purement informatif, pas critique */ }
    setSyncing(false);
  }, [currentId]);

  function StatusBadge({ entry }) {
    if (!entry) return <span className="text-[10px] text-slate-500">En attente</span>;
    const def = STATUS_DEFS[entry.status];
    if (!def) return <span className="text-[10px] text-slate-500">{entry.status}</span>;
    const Icon = def.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${def.color}`}>
        <Icon className="w-2.5 h-2.5" /> {def.label}
        {entry.source === 'backend' && <span className="ml-0.5 text-[8px] opacity-50">☁</span>}
      </span>
    );
  }

  function renderModal() {
    if (!modal) return null;
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setModal(null)}>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-3">
            {modal.type === 'error' ? <AlertTriangle className="w-6 h-6 text-red-400" />
              : modal.type === 'success' ? <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              : modal.type === 'info' ? <Clock className="w-6 h-6 text-blue-400" />
              : <FileText className="w-6 h-6 text-blue-400" />}
            <h3 className="font-bold text-slate-100">{modal.title}</h3>
          </div>

          {modal.message && <p className="text-xs text-slate-400">{modal.message}</p>}

          {modal.errors && (
            <ul className="space-y-1">
              {(modal.errors || []).map((err, i) => (
                <li key={i} className="text-xs text-red-300/80">• {err.message || err}</li>
              ))}
            </ul>
          )}

          {modal.instructions && (
            <div className="bg-slate-800/50 rounded-xl p-3 space-y-1">
              {modal.instructions.map((inst, i) => (
                <p key={i} className="text-xs text-slate-300">{inst}</p>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {modal.type === 'manual' && modal.xml && (
              <button onClick={() => { downloadTEIFXML(modal.xml, modal.invoiceId); setModal(null); }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors">
                <Download className="w-3.5 h-3.5" /> Télécharger XML TEIF
              </button>
            )}
            {modal.type === 'manual' && modal.portalUrl && (
              <a href={modal.portalUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl transition-colors">
                <ExternalLink className="w-3.5 h-3.5" /> Ouvrir le portail El Fatoora
              </a>
            )}
            {modal.type === 'manual' && modal.invoice && (
              <button onClick={() => { handleConfirmTransmission(modal.invoice); setModal(null); }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors">
                <CheckCircle2 className="w-3.5 h-3.5" /> Confirmer transmission
              </button>
            )}
            {modal.type === 'mwPending' && modal.signatureUrl && (
              <a href={modal.signatureUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors">
                <ExternalLink className="w-3.5 h-3.5" /> Ouvrir la page de signature
              </a>
            )}
            {modal.type === 'mwPending' && modal.invoice && (
              <button onClick={() => { handleCheckStatus(modal.invoice); setModal(null); }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors">
                <RefreshCw className="w-3.5 h-3.5" /> Vérifier le statut
              </button>
            )}
            <button onClick={() => setModal(null)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors">
              Fermer
            </button>
          </div>
        </div>
      </div>
    );
  }

  const needsTransmissionConfirm = invoices.filter(inv => getStatus(inv)?.status === 'generated').length;
  const needsMiddlewareCheck = ttnMode === 'middleware' && invoices.filter(inv => getStatus(inv)?.status === 'transmitted').length;
  const needsBackendSync = connected && invoices.filter(inv => {
    const e = getStatus(inv);
    return !e || e.source !== 'backend';
  }).length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader
          icon={FileText}
          title="TEIF & Télédéclaration TTN"
          subtitle="Génération XML TEIF, soumission portail El Fatoora et suivi des statuts"
        />
        <div className="flex items-center gap-2">
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700/50 text-[10px] font-bold text-slate-400 hover:text-slate-200 transition-colors">
            <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} /> SYNC
          </button>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold ${connected ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
            {connected ? 'Backend ☁' : 'Local'}
          </div>
          <select value={ttnMode} onChange={e => { setTTNMode(e.target.value); setTtnModeState(e.target.value); }}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-300">
            <option value="auto">Mode Auto</option>
            <option value="dev">Mode Sandbox</option>
            <option value="production">Mode Production</option>
            <option value="middleware">Mode Middleware</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KpiCard title="Total factures" value={statusCounts.all} icon={FileText} />
        <KpiCard title="En attente" value={statusCounts.pending} icon={Clock} color="amber" />
        <KpiCard title="XML généré" value={statusCounts.generated} icon={FileText} color="blue" />
        <KpiCard title="Transmis portail" value={statusCounts.transmitted} icon={Upload} color="amber" />
        <KpiCard title="Acceptés TTN" value={statusCounts.accepted} icon={CheckCircle2} color="emerald" />
        {statusCounts.failed > 0 && <KpiCard title="Rejetés" value={statusCounts.failed} icon={XCircle} color="red" />}
      </div>

      <div className="flex items-center justify-between gap-4 px-4 py-2.5 bg-slate-900/30 border border-slate-800/40 rounded-xl">
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          <span>Mode: <span className="text-slate-300">{ttnMode === 'production' ? 'Production (XML + Portail)' : ttnMode === 'middleware' ? 'Middleware (API REST)' : 'Sandbox (Simulation)'}</span></span>
          <span className="h-4 w-px bg-slate-700/50" />
          <span>Suivi local: <span className="text-slate-300">{Object.keys(localMap).length} factures</span></span>
          {connected && <><span className="h-4 w-px bg-slate-700/50" /><span>Backend: <span className="text-slate-300">{Object.keys(backendMap).length} statuts</span></span></>}
          {ttnMode === 'middleware' && companyDetails?.middlewareUrl && <><span className="h-4 w-px bg-slate-700/50" /><span>Middleware: <span className="text-slate-300">✓</span></span></>}
          {pollingInvoice && <><span className="h-4 w-px bg-slate-700/50" /><span className="text-blue-400 animate-pulse">⏳ Vérification auto...</span></>}
        </div>
        <div className="flex gap-2">
          {needsTransmissionConfirm > 0 && (
            <span className="text-[10px] text-amber-400 font-semibold">{needsTransmissionConfirm} à confirmer</span>
          )}
          {needsMiddlewareCheck > 0 && (
            <span className="text-[10px] text-blue-400 font-semibold">{needsMiddlewareCheck} en attente signature</span>
          )}
        </div>
      </div>

      {(pendingCount > 0 || needsTransmissionConfirm > 0) && (
        <div className="flex justify-end gap-2">
          {needsTransmissionConfirm > 0 && (
            <button onClick={() => {
              const first = invoices.find(inv => getStatus(inv)?.status === 'generated');
              if (first) {
                const entry = getStatus(first);
                setModal({
                  title: 'Confirmer transmission',
                  message: `Marquer "${first.invoiceNumber || first.invoice_number || first.id}" comme transmis au portail TTN ?`,
                  instructions: ['Assurez-vous d\'avoir soumis le XML sur https://www.efatoora.tn avant de confirmer.'],
                  type: 'manual',
                  invoice: first,
                  portalUrl: 'https://www.efatoora.tn',
                });
              }
            }}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition-colors">
              <Upload className="w-3.5 h-3.5" /> Confirmer transmission ({needsTransmissionConfirm})
            </button>
          )}
          <button onClick={handleBatchGenerate} disabled={batchRunning}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-colors">
            {batchRunning ? (
              <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> {batchProgress.current}/{batchProgress.total}...</>
            ) : (
              <><Send className="w-3.5 h-3.5" /> Générer TEIF ({pendingCount})</>
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
                const entry = getStatus(inv);
                const key = inv.invoice_number || inv.invoiceNumber || inv.id;
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
                        {(!entry || entry.status === 'rejected') && (
                          <button onClick={() => handleGenerateTEIF(inv)} disabled={generatingId === inv.id}
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 disabled:opacity-40 text-white text-[10px] font-semibold transition-colors">
                            {generatingId === inv.id ? '...' : 'TEIF'}
                          </button>
                        )}
                        {entry?.status === 'generated' && (
                          <>
                            <button onClick={() => handleGenerateTEIF(inv)}
                              className="px-2 py-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-500 text-white text-[10px] font-semibold transition-colors">
                              Régénérer
                            </button>
                            <button onClick={() => handleConfirmTransmission(inv)}
                              className="px-2 py-1.5 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-white text-[10px] font-semibold transition-colors">
                              Confirmer
                            </button>
                          </>
                        )}
                        {entry?.status === 'transmitted' && (
                          <>
                            {ttnMode === 'middleware' ? (
                              <button onClick={() => handleCheckStatus(inv)}
                                className="px-2 py-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-500 text-white text-[10px] font-semibold transition-colors">
                                Vérifier
                              </button>
                            ) : (
                              <button onClick={() => handleConfirmTransmission(inv)}
                                className="px-2 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white text-[10px] font-semibold transition-colors">
                                Accepter
                              </button>
                            )}
                          </>
                        )}
                        {entry?.status === 'accepted' && (
                          <span className="px-2 py-1.5 text-[10px] text-emerald-400 font-semibold">✓ Transmis</span>
                        )}
                        {entry?.status === 'rejected' && (
                          <span className="px-2 py-1.5 text-[10px] text-red-400 font-semibold">Rejeté</span>
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

      {renderModal()}
    </div>
  );
}