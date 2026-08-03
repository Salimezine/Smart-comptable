import React, { useState, useEffect } from 'react';
import {
  Sparkles, Plus, Trash2, CheckCircle2, Filter, CheckCheck, Send, Download, RefreshCw, AlertCircle,
} from 'lucide-react';
import QRCode from 'qrcode';
import { calculateInvoiceTotals, formatCurrencyHelper } from '../accountingUtils';
import { generateInvoiceLocal } from '../invoiceService';
import { generateInvoiceNumber } from '../utils/ocrParser';
import { findLibelle } from '../components/AccountSelect';
import { trackUsage } from '../utils/auth/usageTracker';
import { fromInvoice, createPieceComptable as oldCreatePieceComptable, setTTNMode, getTTNMode } from '../teif';
import { saveSimpleEntry } from '../utils/pieceComptable';
import { generateTEIFXML, validateTEIF as validateTEIFv2, downloadTEIFXML } from '../utils/teifGenerator';
import { sendToTTN, handleTTNResponse } from '../utils/ttnWorkflow';
import { updateStockFromInvoice } from '../utils/stockManager';
import { enregistrerDocument, ensureClient } from '../utils/saveIntegration';
import { deleteData as deleteSupabaseData } from '../utils/supabaseService';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmModal';

export default function InvoicingView({
  invoices, setInvoices, formatCurrency, companyDetails, onAddPieceComptable,
  setConfettiActive, currentUser, currentCompanyId, companies, setCompanies,
}) {
  const toast = useToast();
  const confirm = useConfirm();

  const getTeifKey = () => {
    const id = localStorage.getItem('smart_comptable_current_id');
    return id ? `teifStatusMap_${id}` : 'teifStatusMap';
  };

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientVat, setClientVat] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterClient, setFilterClient] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [teifStatusMap, setTeifStatusMap] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem(getTeifKey()) || '{}'); } catch { return {}; }
  });
  const [teifModal, setTeifModal] = React.useState(null);
  const [teifXmlContent, setTeifXmlContent] = React.useState('');
  const [pieceComptableView, setPieceComptableView] = React.useState(null);
  const [isBatchGenerating, setIsBatchGenerating] = React.useState(false);
  const [batchProgress, setBatchProgress] = React.useState({ current: 0, total: 0 });
  const [teifErrorModal, setTeifErrorModal] = React.useState(null);

  React.useEffect(() => { localStorage.setItem(getTeifKey(), JSON.stringify(teifStatusMap)); }, [teifStatusMap]);

  React.useEffect(() => {
    try { setTeifStatusMap(JSON.parse(localStorage.getItem(getTeifKey()) || '{}')); } catch { setTeifStatusMap({}); }
  }, [companyDetails]);

  const [items, setItems] = useState([
    { id: Date.now(), description: 'Prestation de développement logiciel', quantity: 1, unitPrice: 1200.000, vatRate: 19 }
  ]);

  const handleAddItem = () => {
    setItems([...items, { id: Date.now(), description: '', quantity: 1, unitPrice: 0.000, vatRate: 19 }]);
  };

  const handleRemoveItem = (id) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const handleItemChange = (id, field, value) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        updated.total = (parseFloat(updated.quantity) || 0) * (parseFloat(updated.unitPrice) || 0);
        return updated;
      }
      return item;
    }));
  };

  const { subtotal, vatAmount, totalAmount } = calculateInvoiceTotals(items);

  const filteredInvoices = invoices.filter(inv => {
    if (filterStatus !== 'all' && inv.status !== filterStatus) return false;
    if (filterClient && !inv.clientName.toLowerCase().includes(filterClient.toLowerCase())) return false;
    if (filterDateFrom && inv.issueDate < filterDateFrom) return false;
    if (filterDateTo && inv.issueDate > filterDateTo) return false;
    return true;
  });

  const handleSaveInvoice = (e) => {
    e.preventDefault();
    if (!clientName || !clientEmail || !dueDate) {
      console.warn('[InvoicingView] required fields missing', { clientName, clientEmail, dueDate });
      return;
    }

    const invoiceNum = generateInvoiceNumber(invoices);

    const newInvoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: invoiceNum,
      clientName,
      clientEmail,
      clientVat,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate,
      subtotal,
      vatAmount,
      totalAmount,
      status: "SENT",
      items: items.map(item => ({ ...item, total: item.quantity * item.unitPrice }))
    };

    const updatedInvoices = [newInvoice, ...invoices];
    setInvoices(updatedInvoices);
    console.log('[InvoicingView] setInvoices direct, new length:', updatedInvoices.length, 'adding:', invoiceNum);
    if (setCompanies) {
      setCompanies(prev => {
        const currentData = prev[currentCompanyId] || {};
        const updated = { ...prev, [currentCompanyId]: { ...currentData, invoices: updatedInvoices } };
        localStorage.setItem('smart_comptable_companies', JSON.stringify(updated));
        return updated;
      });
    }

    saveSimpleEntry({ date: newInvoice.issueDate, numeroPiece: invoiceNum, compte: '411 Clients', libelle: `Vente ${invoiceNum} - ${clientName}`, debit: totalAmount, credit: 0, journal: 'VNT' });
    saveSimpleEntry({ date: newInvoice.issueDate, numeroPiece: invoiceNum, compte: '70XXXX Ventes', libelle: `HT ${invoiceNum}`, debit: 0, credit: subtotal, journal: 'VNT' });
    if (vatAmount > 0.001) saveSimpleEntry({ date: newInvoice.issueDate, numeroPiece: invoiceNum, compte: '43671 TVA collectée', libelle: `TVA ${invoiceNum}`, debit: 0, credit: vatAmount, journal: 'VNT' });

    try { updateStockFromInvoice({ ...newInvoice, lignes: items.map(i => ({ designation: i.description, quantite: i.quantity, prixUnitaireHT: i.unitPrice })), isVente: true }); } catch {}
    try { ensureClient(currentCompanyId, clientName, { matricule_fiscal: clientVat, email: clientEmail }); } catch {}

    setTimeout(() => {
      try {
        const teifInvoice = {
          id: invoiceNum, dateEmission: newInvoice.issueDate, type: '380', timbre: 0,
          fournisseur: { matriculeFiscal: companyDetails.vatNumber || companyDetails.matriculeFiscal || '', nom: companyDetails.companyName || companyDetails.name || '', adresse: companyDetails.address || '', rne: companyDetails.rne || '' },
          client: { matriculeFiscal: clientVat || '', nom: clientName || 'Client', adresse: '' },
          lignes: newInvoice.items.map(i => ({ designation: i.description || 'Prestation', quantite: i.quantity || 1, prixUnitaireHT: parseFloat(i.unitPrice || 0), tauxTVA: (()=>{const r=parseFloat(i.vatRate);return r===0?0:r||19})(), fodec: 0 })),
        };
        const gen = generateTEIFXML(teifInvoice);
        if (!gen.error) { setTeifStatusMap(prev => ({ ...prev, [newInvoice.id]: 'generated' })); }
      } catch (e) { console.warn('TEIF auto-generation skipped:', e.message); }
    }, 100);

    setClientName(''); setClientEmail(''); setClientVat(''); setDueDate('');
    setItems([{ id: Date.now(), description: 'Prestation de développement logiciel', quantity: 1, unitPrice: 1200.000, vatRate: 19 }]);
    setShowCreateForm(false);
    toast.success(`Facture ${invoiceNum} créée.`);
    trackUsage(currentUser?.id, 'create_invoice');
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError('');
    try {
      const lastInv = invoices.length > 0 ? invoices[0].invoiceNumber : null;
      const data = await generateInvoiceLocal(aiPrompt, companyDetails, lastInv);
      setClientName(data.clientName || '');
      setClientEmail(data.clientEmail || '');
      setClientVat(data.clientVat || '');
      setDueDate(data.dueDate || '');
      if (data.items && data.items.length > 0) {
        setItems(data.items.map(item => ({ ...item, id: Date.now() + Math.random() })));
      }
      setAiModalOpen(false);
      setAiPrompt('');
      setShowCreateForm(true);
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleDownloadPDF = async (invoice) => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(99, 102, 241);
    doc.text("Smart Comptable Ledger", 20, 25);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Facture N°: ${invoice.invoiceNumber}`, 20, 32);
    doc.text(`Date d'émission: ${invoice.issueDate}`, 20, 37);
    doc.text(`Échéance: ${invoice.dueDate}`, 20, 42);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text("ÉMETTEUR :", 20, 55);
    doc.setFont("Helvetica", "normal");
    doc.text(companyDetails?.name || companyDetails?.raisonSociale || '', 20, 60);
    doc.text(companyDetails?.address || '', 20, 65);
    doc.text(`TVA : ${companyDetails?.vatNumber || ''}`, 20, 70);
    doc.setFont("Helvetica", "bold");
    doc.text("DESTINATAIRE :", 120, 55);
    doc.setFont("Helvetica", "normal");
    doc.text(invoice.clientName || invoice.client || '', 120, 60);
    doc.text(invoice.clientEmail || '', 120, 65);
    doc.setFillColor(241, 245, 249);
    doc.rect(20, 85, 170, 8, "F");
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Description", 22, 90);
    doc.text("Qté", 115, 90);
    doc.text("P.U. HT (DT)", 135, 90);
    doc.text("Total HT (DT)", 165, 90);
    let currentY = 99;
    (invoice.items || []).forEach(item => {
      doc.setFont("Helvetica", "normal");
      doc.text(item?.description || '', 22, currentY);
      doc.text(String(item?.quantity ?? ''), 115, currentY);
      doc.text(parseFloat(item?.unitPrice || 0).toFixed(3), 135, currentY);
      doc.text(parseFloat(item?.total || 0).toFixed(3), 165, currentY);
      currentY += 8;
    });
    doc.setDrawColor(226, 232, 240);
    doc.line(20, currentY, 190, currentY);
    currentY += 10;
    doc.setFont("Helvetica", "bold");
    doc.text("Sous-total HT:", 135, currentY);
    doc.text(parseFloat(invoice?.subtotal || 0).toFixed(3) + " DT", 165, currentY);
    currentY += 6;
    doc.text("Total TVA:", 135, currentY);
    doc.text(parseFloat(invoice?.vatAmount || 0).toFixed(3) + " DT", 165, currentY);
    currentY += 6;
    doc.text("Timbre Fiscal:", 135, currentY);
    doc.text("1.000 DT", 165, currentY);
    currentY += 8;
    doc.setFontSize(11);
    doc.setTextColor(99, 102, 241);
    doc.text("Total TTC:", 135, currentY);
    doc.text(parseFloat(invoice?.totalAmount || 0).toFixed(3) + " DT", 165, currentY);
    currentY += 15;
    const qrText = `FACTURE:${invoice.invoiceNumber}\nCLIENT:${invoice.clientName}\nMONTANT:${parseFloat(invoice?.totalAmount || 0).toFixed(3)} DT\nDATE:${invoice.issueDate}`;
    try {
      const qrDataUrl = await QRCode.toDataURL(qrText, { width: 120, margin: 1, color: { dark: '#1e293b', light: '#ffffff' } });
      doc.addImage(qrDataUrl, 'PNG', 135, currentY - 5, 30, 30);
    } catch {
      doc.setDrawColor(99, 102, 241);
      doc.rect(135, currentY - 5, 30, 30);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(99, 102, 241);
      doc.text("QR", 148, currentY + 10);
    }
    doc.save(`${invoice.invoiceNumber}_${invoice.clientName.replace(/\s+/g, '_')}.pdf`);
    trackUsage(currentUser?.id, 'export_pdf');
  };

  const handleGenerateTEIF = async (invoice) => {
    setTeifModal(invoice);
    setTeifXmlContent('');
    try {
      const teifInvoice = {
        id: invoice.invoiceNumber || invoice.id,
        dateEmission: invoice.issueDate || invoice.date || new Date().toISOString().slice(0, 10),
        type: '380', timbre: parseFloat(invoice.stampDuty) || 0,
        fournisseur: {
          matriculeFiscal: companyDetails.vatNumber || companyDetails.matriculeFiscal || '',
          nom: companyDetails.companyName || companyDetails.name || '',
          adresse: companyDetails.address || '', rne: companyDetails.rne || '',
        },
        client: { matriculeFiscal: invoice.clientVat || '', nom: invoice.clientName || 'Client', adresse: invoice.clientAddress || '' },
        lignes: (invoice.items || [{ designation: invoice.category || 'Prestation', quantite: 1, prixUnitaireHT: invoice.subtotal || 0, tauxTVA: 19 }]).map(item => ({
          designation: item.description || item.designation || 'Prestation',
          quantite: item.quantity || 1,
          prixUnitaireHT: parseFloat(item.unitPrice || item.prixUnitaireHT || invoice.subtotal) || 0,
          tauxTVA: (()=>{const r=parseFloat(item.vatRate ?? item.tauxTVA);return r===0?0:r||19})(),
          fodec: parseFloat(item.fodec || 0),
        })),
      };
      const gen = generateTEIFXML(teifInvoice);
      if (gen.error) throw new Error(gen.error);
      setTeifXmlContent(gen.xml);
      setTeifStatusMap(prev => ({ ...prev, [invoice.id]: 'generated' }));
      const valid = validateTEIFv2(gen.xml);
      if (!valid.valid) { setTeifErrorModal({ title: 'Erreur de validation TEIF', errors: valid.errors }); return; }
      const response = await sendToTTN(gen.xml, { ttnMode: getTTNMode() });
      if (response.status === 'accepted') {
        setTeifStatusMap(prev => ({ ...prev, [invoice.id]: 'submitted' }));
        const handled = await handleTTNResponse(teifInvoice, response);
        if (handled.success) {
          setTeifStatusMap(prev => ({ ...prev, [invoice.id]: 'accepted' }));
          onAddPieceComptable && onAddPieceComptable({ id: handled.pieceId, ttnId: handled.ttnId, date: teifInvoice.dateEmission, journal: 'VNT', reference: teifInvoice.id, total: gen.totalTTC });
          setTeifModal(null);
        } else { setTeifStatusMap(prev => ({ ...prev, [invoice.id]: 'failed' })); setTeifErrorModal({ title: 'Rejet TTN', errors: handled.errors || ['Rejeté'] }); }
      } else if (response.status === 'rejected') { setTeifStatusMap(prev => ({ ...prev, [invoice.id]: 'failed' })); setTeifErrorModal({ title: 'Échec TTN', errors: (response.errors || []).map(e => e.message || e) }); }
      else { setTeifStatusMap(prev => ({ ...prev, [invoice.id]: 'submitted' })); }
    } catch (err) { setTeifStatusMap(prev => ({ ...prev, [invoice.id]: 'failed' })); setTeifErrorModal({ title: 'Erreur TEIF', errors: [err.message] }); }
  };

  const handleViewPieceComptable = (invoice) => {
    const status = teifStatusMap[invoice.id];
    if (status === 'accepted' || status === 'generated') {
      try { const teifData = fromInvoice(invoice, companyDetails); const piece = oldCreatePieceComptable(teifData, invoice.id); setPieceComptableView(piece); } catch (err) { setTeifErrorModal({ title: 'Erreur écriture comptable', errors: [err.message] }); }
    }
  };

  const handleBatchGenerateTEIF = async () => {
    const pending = invoices.filter(inv => !teifStatusMap[inv.id] || teifStatusMap[inv.id] === 'failed');
    if (pending.length === 0) return;
    setIsBatchGenerating(true);
    for (let i = 0; i < pending.length; i++) { setBatchProgress({ current: i + 1, total: pending.length }); await handleGenerateTEIF(pending[i]); }
    setIsBatchGenerating(false);
    setBatchProgress({ current: 0, total: 0 });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-slate-900/20 p-4 rounded-xl border border-slate-800/40">
        <div>
          <h3 className="font-bold text-lg text-slate-100">Liste des Factures Clients</h3>
          <p className="text-xs text-slate-400">Suivez l'encaissement et générez des PDF avec QR Code instantanément.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAiModalOpen(true)} className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-slate-800 text-brand-400 border border-brand-500/30 rounded-xl hover:bg-slate-700 transition-all">
            <Sparkles className="w-3.5 h-3.5" /> Générer par IA
          </button>
          <button onClick={() => setShowCreateForm(!showCreateForm)} className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-gradient-brand text-white rounded-xl shadow-glow transition-all">
            {showCreateForm ? 'Annuler' : 'Créer une facture'}
          </button>
          {invoices.some(inv => !teifStatusMap[inv.id] || teifStatusMap[inv.id] === 'failed') && (
            <button onClick={handleBatchGenerateTEIF} disabled={isBatchGenerating} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors">
              {isBatchGenerating ? `📨 TEIF ${batchProgress.current}/${batchProgress.total}...` : `📨 Générer TEIF (${invoices.filter(inv => !teifStatusMap[inv.id] || teifStatusMap[inv.id] === 'failed').length})`}
            </button>
          )}
        </div>
      </div>

      {showCreateForm ? (
        <form onSubmit={handleSaveInvoice} className="glass-card p-8 rounded-2xl border border-slate-800 space-y-6 animate-slide-up">
          <h3 className="text-base font-bold text-indigo-400 flex items-center gap-2"><Plus className="w-5 h-5" /> Nouveau Document Client</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><label className="block text-xs text-slate-400 font-bold mb-2 uppercase">Nom du client</label><input type="text" required placeholder="ex: Wayne Enterprises" value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full bg-slate-900/60 border border-slate-850 focus:border-brand-500 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none transition-colors" /></div>
            <div><label className="block text-xs text-slate-400 font-bold mb-2 uppercase">MF Client</label><input type="text" placeholder="Matricule Fiscal du client" value={clientVat} onChange={(e) => setClientVat(e.target.value)} className="w-full bg-slate-900/60 border border-slate-850 focus:border-brand-500 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none transition-colors" /></div>
            <div><label className="block text-xs text-slate-400 font-bold mb-2 uppercase">Adresse e-mail client</label><input type="email" required placeholder="ex: accounts@wayne.corp" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className="w-full bg-slate-900/60 border border-slate-850 focus:border-brand-500 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none transition-colors" /></div>
            <div><label className="block text-xs text-slate-400 font-bold mb-2 uppercase">Date d'échéance</label><input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full bg-slate-900/60 border border-slate-850 focus:border-brand-500 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none transition-colors" /></div>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Lignes de Prestation / Produits</h4>
              <button type="button" onClick={handleAddItem} className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"><Plus className="w-3.5 h-3.5" /> Ajouter une ligne</button>
            </div>
            {items.map((item, idx) => (
              <div key={item.id} className="grid grid-cols-12 gap-4 items-center animate-fade-in">
                <div className="col-span-6"><input type="text" placeholder="Description de la prestation..." required value={item.description} onChange={(e) => handleItemChange(item.id, 'description', e.target.value)} className="w-full bg-slate-900/40 border border-slate-850 focus:border-brand-500 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none transition-colors" /></div>
                <div className="col-span-1.5"><input type="number" placeholder="Qté" required min="1" value={item.quantity} onChange={(e) => handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 0)} className="w-full bg-slate-900/40 border border-slate-850 focus:border-brand-500 rounded-xl px-3 py-2 text-slate-200 text-xs text-center focus:outline-none transition-colors" /></div>
                <div className="col-span-2"><input type="number" placeholder="P.U. HT (DT)" required step="0.001" value={item.unitPrice} onChange={(e) => handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)} className="w-full bg-slate-900/40 border border-slate-850 focus:border-brand-500 rounded-xl px-3 py-2 text-slate-200 text-xs text-right focus:outline-none transition-colors" /></div>
                <div className="col-span-1.5"><select value={item.vatRate} onChange={(e) => handleItemChange(item.id, 'vatRate', parseFloat(e.target.value) || 0)} className="w-full bg-slate-900/40 border border-slate-850 focus:border-brand-500 rounded-xl px-3 py-2 text-slate-300 text-xs focus:outline-none transition-colors"><option value="19">TVA 19%</option><option value="13">TVA 13%</option><option value="7">TVA 7%</option><option value="0">TVA 0%</option></select></div>
                <div className="col-span-1 flex items-center justify-end"><button type="button" onClick={() => handleRemoveItem(item.id)} className="text-danger-400 hover:text-danger-500 p-1.5 rounded-lg hover:bg-danger-500/10 transition-colors"><Trash2 className="w-4 h-4" /></button></div>
              </div>
            ))}
          </div>
          <div className="flex flex-col md:flex-row justify-between items-end border-t border-slate-800 pt-6 gap-6">
            <div className="space-y-2 max-w-sm text-xs text-slate-400"><p>📌 Votre profil entreprise est utilisé pour formater l'émetteur légal de ce document.</p><p>⚡ Un QR Code EPC de virement instantané sera intégré automatiquement au bas du document.</p></div>
            <div className="w-80 space-y-3 bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
              <div className="flex justify-between text-xs text-slate-400"><span>Sous-total HT :</span><span className="font-semibold text-slate-200">{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between text-xs text-slate-400"><span>Total TVA :</span><span className="font-semibold text-slate-200">{formatCurrency(vatAmount)}</span></div>
              <div className="flex justify-between text-xs text-slate-400"><span>Timbre Fiscal :</span><span className="font-semibold text-slate-200">{formatCurrency(1.000)}</span></div>
              <div className="flex justify-between text-sm font-bold text-slate-100 border-t border-slate-800 pt-2"><span>Total TTC :</span><span className="text-indigo-400">{formatCurrency(totalAmount)}</span></div>
              <button type="submit" className="w-full mt-3 py-2.5 bg-gradient-brand text-white font-bold rounded-xl text-xs shadow-glow hover:opacity-90 transition-all flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4" /> Finaliser & Enregistrer</button>
            </div>
          </div>
        </form>
      ) : (
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Filter className="w-4 h-4 text-slate-400" />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500"><option value="all">Tous statuts</option><option value="PAID">Payées</option><option value="SENT">Envoyées</option><option value="OVERDUE">En retard</option></select>
            <input type="text" placeholder="Rechercher un client..." value={filterClient} onChange={e => setFilterClient(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 w-48 focus:outline-none focus:border-brand-500" />
            <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500" />
            <span className="text-[10px] text-slate-500">→</span>
            <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500" />
            {(filterStatus !== 'all' || filterClient || filterDateFrom || filterDateTo) && (<button onClick={() => { setFilterStatus('all'); setFilterClient(''); setFilterDateFrom(''); setFilterDateTo(''); }} className="text-[10px] text-brand-400 hover:text-white transition-colors">Effacer</button>)}
          </div>
          <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden shadow-card">
            <div className="overflow-x-auto"><table className="w-full text-left border-collapse">
              <thead><tr className="bg-slate-900/50 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 font-bold"><th className="py-4 px-6">Numéro</th><th className="py-4 px-6">Client</th><th className="py-4 px-6">Date</th><th className="py-4 px-6">Échéance</th><th className="py-4 px-6 text-right">Total TTC</th><th className="py-4 px-6 text-center">Statut</th><th className="py-4 px-6 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-800/50 text-xs">
                {filteredInvoices.length === 0 ? (<tr><td colSpan={7} className="py-12 text-center text-slate-500">Aucune facture trouvée</td></tr>) : (
                  filteredInvoices.map((inv, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/10 transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-slate-300">{inv.invoiceNumber}</td>
                      <td className="py-4 px-6"><button onClick={() => setSelectedClient(inv.clientName)} className="font-bold text-white hover:text-brand-400 transition-colors text-left">{inv.clientName}</button><span className="text-[10px] text-slate-400 block">{inv.clientEmail}</span></td>
                      <td className="py-4 px-6 text-slate-400">{inv.issueDate}</td><td className="py-4 px-6 text-slate-400">{inv.dueDate}</td>
                      <td className="py-4 px-6 text-right font-extrabold text-white">{formatCurrency(inv.totalAmount)}</td>
                      <td className="py-4 px-6 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${inv.status === 'PAID' ? 'bg-accent-500/10 text-accent-400 border border-accent-500/10' : inv.status === 'SENT' ? 'bg-warning-500/10 text-warning-400 border border-warning-500/10' : 'bg-danger-500/10 text-danger-400 border border-danger-500/10'}`}>{inv.status === 'PAID' ? 'Payée' : inv.status === 'SENT' ? 'Envoyée' : 'Retard'}</span>
                        {teifStatusMap[inv.id] && (<div className="flex items-center gap-1.5 mt-1 justify-center"><span className={`inline-block w-1.5 h-1.5 rounded-full ${teifStatusMap[inv.id] === 'accepted' ? 'bg-emerald-400' : teifStatusMap[inv.id] === 'submitted' ? 'bg-blue-400' : teifStatusMap[inv.id] === 'generated' ? 'bg-amber-400' : 'bg-red-400'}`} /><span className={`text-[10px] font-medium ${teifStatusMap[inv.id] === 'accepted' ? 'text-emerald-400' : teifStatusMap[inv.id] === 'submitted' ? 'text-blue-400' : teifStatusMap[inv.id] === 'generated' ? 'text-amber-400' : 'text-red-400'}`}>{teifStatusMap[inv.id] === 'accepted' ? 'TEIF ✓' : teifStatusMap[inv.id] === 'submitted' ? 'Soumis' : teifStatusMap[inv.id] === 'generated' ? 'Généré' : 'Échec'}</span>{(teifStatusMap[inv.id] === 'accepted' || teifStatusMap[inv.id] === 'generated') && (<button onClick={() => handleViewPieceComptable(inv)} className="text-[10px] text-amber-400 hover:text-amber-300 underline" title="Voir l'écriture comptable">📒 PC</button>)}{teifStatusMap[inv.id] === 'failed' && (<button onClick={() => handleGenerateTEIF(inv)} className="text-[10px] text-red-400 hover:text-red-300 underline">Réessayer</button>)}</div>)}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-1.5">
                          {inv.status !== 'PAID' && (<button onClick={() => { setInvoices(invoices.map(x => x.id === inv.id ? {...x, status: 'PAID'} : x)); toast.success(`Facture ${inv.invoiceNumber} payée.`); setConfettiActive(true); }} className="p-2 bg-slate-800 hover:bg-accent-500/20 text-accent-400 rounded-xl border border-slate-700/50" title="Marquer payée"><CheckCheck className="w-3.5 h-3.5" /></button>)}
                          {inv.status === 'PAID' && (<button onClick={() => { setInvoices(invoices.map(x => x.id === inv.id ? {...x, status: 'SENT'} : x)); toast.info(`Facture ${inv.invoiceNumber} marquée envoyée.`); }} className="p-2 bg-slate-800 hover:bg-warning-500/20 text-warning-400 rounded-xl border border-slate-700/50" title="Marquer envoyée"><Send className="w-3.5 h-3.5" /></button>)}
                          <button onClick={() => handleDownloadPDF(inv)} className="p-2 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-xl border border-slate-700/50" title="PDF"><Download className="w-3.5 h-3.5" /></button>
                          <button onClick={async () => { const ok = await confirm({ title: 'Supprimer la facture', message: `Voulez-vous vraiment supprimer la facture ${inv.invoiceNumber} ? cette action est définitive.`, confirmLabel: 'Supprimer', cancelLabel: 'Annuler', type: 'danger' }); if (ok) { setInvoices(invoices.filter(x => x.id !== inv.id)); deleteSupabaseData('invoices', currentCompanyId, inv.id).catch((e) => { console.warn('[sync] delete invoice failed:', e?.message); }); setTeifStatusMap(prev => { const n = {...prev}; delete n[inv.id]; return n; }); toast.success(`Facture ${inv.invoiceNumber} supprimée.`); } }} className="p-2 bg-slate-800 hover:bg-danger-500/20 text-danger-400 rounded-xl border border-slate-700/50" title="Supprimer"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table></div>
          </div>
        </div>
      )}

      {teifModal && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setTeifModal(null)}><div className="relative w-full max-w-3xl max-h-[85vh] overflow-auto rounded-xl bg-slate-800 border border-slate-700/60 shadow-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4"><h3 className="text-sm font-bold text-slate-200">📄 TEIF — {teifModal.invoiceNumber || teifModal.numero || teifModal.id || 'Sans numéro'}</h3><button onClick={() => setTeifModal(null)} className="text-slate-400 hover:text-slate-200 text-lg">✕</button></div>
        <pre className="text-[10px] text-slate-300 bg-slate-900/80 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-all max-h-[60vh]">{teifXmlContent || 'Génération en cours...'}</pre>
        <div className="flex justify-end gap-2 mt-4">{teifXmlContent && <button onClick={() => downloadTEIFXML(teifXmlContent, teifModal.invoiceNumber || teifModal.id)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs">Télécharger XML</button>}<button onClick={() => setTeifModal(null)} className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs">Fermer</button></div>
      </div></div>)}

      {pieceComptableView && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setPieceComptableView(null)}><div className="relative w-full max-w-lg rounded-xl bg-slate-800 border border-slate-700/60 shadow-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4"><h3 className="text-sm font-bold text-slate-200">📒 Écriture Comptable</h3><button onClick={() => setPieceComptableView(null)} className="text-slate-400 hover:text-slate-200 text-lg">✕</button></div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between"><span className="text-slate-400">Journal:</span><span className="text-slate-200 font-medium">{pieceComptableView.journal}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Date:</span><span className="text-slate-200 font-medium">{pieceComptableView.date}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Pièce:</span><span className="text-slate-200 font-medium">{pieceComptableView.pieceRef}</span></div>
          <div className="border-t border-slate-700/60 my-2" />
          <div className="font-bold text-slate-300 mb-1">Lignes d'écriture:</div>
          {pieceComptableView.lignes?.map((l, i) => (<div key={i} className={`p-2 rounded-lg ${i === 0 ? 'bg-red-900/20' : 'bg-emerald-900/20'}`}><div className="flex justify-between items-center"><span className="text-slate-400" title={findLibelle(l.compte)}>{l.compte}{findLibelle(l.compte) ? <span className="ml-1.5 text-[8px] text-slate-600 italic">{findLibelle(l.compte)}</span> : ''}</span><span className="text-slate-200">{l.libelle}</span></div><div className="flex justify-between text-[10px]"><span className="text-slate-500">Débit:</span><span className="text-slate-300">{formatCurrency(l.debit)}</span></div><div className="flex justify-between text-[10px]"><span className="text-slate-500">Crédit:</span><span className="text-slate-300">{formatCurrency(l.credit)}</span></div></div>))}
          <div className="border-t border-slate-700/60 my-2" />
          <div className="flex justify-between font-bold"><span className="text-slate-400">Total:</span><span className="text-slate-200">{(() => { const t = pieceComptableView.total ?? (pieceComptableView.totalDebit ?? pieceComptableView.totalCredit ?? 0); return formatCurrency(typeof t === 'number' && !isNaN(t) ? t : 0); })()}</span></div>
        </div>
        <div className="flex justify-end gap-2 mt-4"><button onClick={() => setPieceComptableView(null)} className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs">Fermer</button></div>
      </div></div>)}

      {teifErrorModal && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setTeifErrorModal(null)}><div className="relative w-full max-w-md rounded-xl bg-slate-800 border border-slate-700/60 shadow-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4"><h3 className="text-sm font-bold text-red-400">⚠️ {teifErrorModal.title}</h3><button onClick={() => setTeifErrorModal(null)} className="text-slate-400 hover:text-slate-200 text-lg">✕</button></div>
        <div className="space-y-2">{teifErrorModal.errors?.map((err, i) => (<p key={i} className="text-xs text-slate-300 bg-red-900/20 p-2 rounded-lg">{err}</p>))}</div>
        <div className="flex justify-end mt-4"><button onClick={() => setTeifErrorModal(null)} className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs">Fermer</button></div>
      </div></div>)}

      {selectedClient && (<div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"><div className="bg-surface-900 border border-slate-800 rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-800/50 flex justify-between items-center"><div><h3 className="font-extrabold text-lg text-white">Répertoire Client</h3><p className="text-xs text-slate-400">{selectedClient}</p></div><button onClick={() => setSelectedClient(null)} className="text-slate-500 hover:text-white p-2">✕</button></div>
        <div className="p-6 space-y-3 text-xs text-slate-300 overflow-y-auto">{invoices.filter(inv => inv.clientName === selectedClient).map(inv => (<div key={inv.id} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center"><div><p className="font-bold text-white">{inv.invoiceNumber}</p><p className="text-[10px] text-slate-400">{inv.issueDate} → {formatCurrency(inv.totalAmount)}</p></div><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${inv.status === 'PAID' ? 'text-accent-400' : inv.status === 'SENT' ? 'text-warning-400' : 'text-danger-400'}`}>{inv.status === 'PAID' ? 'Payée' : inv.status === 'SENT' ? 'Envoyée' : 'Retard'}</span></div>))}</div>
      </div></div>)}

      {aiModalOpen && (<div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"><div className="bg-surface-900 border border-slate-800 rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-800/50 flex justify-between items-center"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow"><Sparkles className="w-5 h-5 text-white" /></div><div><h3 className="font-extrabold text-lg text-white">Génération IA</h3><p className="text-xs text-brand-400 font-medium">Facture de vente tunisienne</p></div></div><button onClick={() => { setAiModalOpen(false); setAiError(''); }} className="text-slate-500 hover:text-white p-2">✕</button></div>
        <div className="p-6 space-y-4">
          <div><label className="block text-xs text-slate-400 font-bold mb-2">Décrivez la facture à générer</label><textarea placeholder="Ex: Facture pour ACME Corp SARL pour prestation de consulting en comptabilité, montant 5 000 DT, TVA 19%" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} rows={4} className="w-full bg-slate-950 border border-slate-700 focus:border-brand-500 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none resize-none transition-colors" /><p className="text-[10px] text-slate-500 mt-1.5">Précisez le client, la prestation, le montant. L'IA générera une facture conforme.</p></div>
          {aiError && (<div className="p-3 bg-danger-500/10 border border-danger-500/30 rounded-xl text-xs text-danger-400 flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /> {aiError}</div>)}
          <div className="flex gap-3">
            <button onClick={() => { setAiModalOpen(false); setAiError(''); }} className="flex-1 py-2.5 border border-slate-700 hover:bg-slate-800/40 text-slate-400 text-xs font-bold rounded-xl transition-all">Annuler</button>
            <button onClick={handleGenerateAI} disabled={aiLoading || !aiPrompt.trim()} className="flex-[2] py-2.5 bg-gradient-brand hover:opacity-90 text-white text-xs font-bold rounded-xl shadow-glow transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed">{aiLoading ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Génération en cours...</>) : (<><Sparkles className="w-4 h-4" /> Générer la facture</>)}</button>
          </div>
        </div>
      </div></div>)}
    </div>
  );
}
