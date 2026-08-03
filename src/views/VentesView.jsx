import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, X, Save, FileText, Check, Printer, AlertCircle, Trash2 } from 'lucide-react';
import { salesOrdersStore, salesOrderLinesStore, clientsStore, productsStore, computeOrderTotals, generateOrderNum } from '../utils/erpStore';
import { enregistrerDocument } from '../utils/saveIntegration';

const EMPTY_LINE = { product_id: '', designation: '', quantite: 1, prix_unitaire_ht: 0, taux_tva: 19, montant_ht: 0, montant_tva: 0, montant_ttc: 0, remise_pourcent: 0, quantite_livree: 0 };

export default function VentesView({ companyId }) {
  const cid = companyId || localStorage.getItem('smart_comptable_current_id');
  const [tab, setTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [lines, setLines] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ type: 'commande', numero: '', date: new Date().toISOString().slice(0, 10), date_echeance: '', client_id: '', client_nom: '', client_matricule_fiscal: '', notes: '', statut: 'brouillon' });
  const [msg, setMsg] = useState(null);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    if (!cid) return;
    setOrders(salesOrdersStore.getAll(cid));
    setClients(clientsStore.getAll(cid));
    setProducts(productsStore.getAll(cid));
  }, [cid]);

  const orderTypes = [
    { id: 'devis', label: 'Devis', icon: FileText },
    { id: 'commande', label: 'Commande', icon: FileText },
    { id: 'bon_livraison', label: 'BL', icon: FileText },
    { id: 'facture', label: 'Facture', icon: FileText },
  ];

  const filtered = useMemo(() => {
    let list = orders;
    if (filterType !== 'all') list = list.filter(o => o.type === filterType);
    return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [orders, filterType]);

  const openNew = (type) => {
    setForm({ type, numero: generateOrderNum(cid, type), date: new Date().toISOString().slice(0, 10), date_echeance: '', client_id: '', client_nom: '', client_matricule_fiscal: '', notes: '', statut: 'brouillon' });
    setLines([{ ...EMPTY_LINE, ligne: 1 }]);
    setEditingId(null);
    setShowForm(true);
  };

  const recalcLines = (lignes) => lignes.map(l => {
    const ht = (l.quantite || 0) * (l.prix_unitaire_ht || 0);
    const tva = ht * ((l.taux_tva || 19) / 100);
    return { ...l, montant_ht: round(ht), montant_tva: round(tva), montant_ttc: round(ht + tva) };
  });

  const handleLineChange = (idx, field, value) => {
    const newLines = lines.map((l, i) => i === idx ? { ...l, [field]: value } : l);
    setLines(recalcLines(newLines));
  };

  const addLine = () => setLines([...lines, { ...EMPTY_LINE, ligne: lines.length + 1 }]);
  const removeLine = (idx) => setLines(lines.filter((_, i) => i !== idx));

  const selectProduct = (idx, pid) => {
    const p = products.find(pr => pr.id === pid);
    if (p) {
      const newLines = lines.map((l, i) => i === idx ? { ...l, product_id: pid, designation: p.designation, prix_unitaire_ht: p.prix_vente_ht || 0, taux_tva: p.taux_tva || 19 } : l);
      setLines(recalcLines(newLines));
    }
  };

  const totals = useMemo(() => computeOrderTotals(lines), [lines]);

  const handleSave = () => {
    if (!form.client_id && !form.client_nom.trim()) { setMsg({ type: 'error', text: 'Sélectionnez un client' }); return; }
    if (lines.length === 0 || lines.every(l => !l.designation)) { setMsg({ type: 'error', text: 'Ajoutez au moins une ligne' }); return; }
    const client = form.client_id ? clients.find(c => c.id === form.client_id) : null;
    const orderData = {
      ...form,
      client_nom: client?.nom || form.client_nom,
      client_matricule_fiscal: client?.matricule_fiscal || '',
      client_adresse: client?.adresse || '',
      client_contact: client?.telephone || '',
      total_ht: totals.total_ht, total_tva: totals.total_tva, total_ttc: totals.total_ttc,
    };
    if (!orderData.numero) orderData.numero = generateOrderNum(cid, form.type);
    const saved = salesOrdersStore.upsert(cid, orderData);
    if (saved) {
      // Save lines
      const existingLines = editingId ? salesOrderLinesStore.getAll(cid).filter(l => l.order_id === editingId) : [];
      for (const oldL of existingLines) salesOrderLinesStore.delete(cid, oldL.id);
      const savedLines = [];
      for (const l of recalcLines(lines)) {
        const sl = salesOrderLinesStore.upsert(cid, { ...l, order_id: saved.id, company_id: cid });
        if (sl) savedLines.push(sl);
      }
      // Intégration : tiers client + écriture comptable + stock (facture/BL/livré uniquement)
      if (form.type === 'facture' || form.type === 'bon_livraison' || orderData.statut === 'livre' || orderData.statut === 'facture') {
        try {
          enregistrerDocument(cid, {
            type: 'vente',
            client: orderData.client_nom || form.client_nom,
            mf: orderData.client_matricule_fiscal || '',
            adresse: orderData.client_adresse || '',
            telephone: orderData.client_contact || '',
            date: orderData.date,
            numero: orderData.numero,
            categorie: 'Ventes de marchandises',
            journal: 'VNT',
            total_ht: orderData.total_ht, total_tva: orderData.total_tva, total_ttc: orderData.total_ttc,
            lignes: savedLines.length > 0 ? savedLines : recalcLines(lines),
            faireStock: true,
          });
        } catch {}
      } else {
        // Simple tiers même pour devis/commande
        try {
          enregistrerDocument(cid, {
            type: 'vente',
            client: orderData.client_nom || form.client_nom,
            mf: orderData.client_matricule_fiscal || '',
            adresse: orderData.client_adresse || '',
            telephone: orderData.client_contact || '',
            lignes: [],
            total_ht: 0, total_tva: 0, total_ttc: 0,
            faireJournal: false, faireStock: false,
          });
        } catch {}
      }
      setMsg({ type: 'success', text: `${orderTypes.find(t => t.id === form.type)?.label || 'Document'} ${saved.numero} enregistré` });
    }
    setShowForm(false);
    setOrders(salesOrdersStore.getAll(cid));
  };

  const handleDelete = (id, num) => {
    if (!window.confirm(`Supprimer ${num} ?`)) return;
    const toDelete = salesOrderLinesStore.getAll(cid).filter(l => l.order_id === id);
    for (const l of toDelete) salesOrderLinesStore.delete(cid, l.id);
    salesOrdersStore.delete(cid, id);
    setOrders(salesOrdersStore.getAll(cid));
    setMsg({ type: 'success', text: `${num} supprimé` });
  };

  const handleEdit = (order) => {
    setForm(order);
    setEditingId(order.id);
    const orderLines = salesOrderLinesStore.getAll(cid).filter(l => l.order_id === order.id);
    setLines(orderLines.length > 0 ? orderLines : [{ ...EMPTY_LINE, ligne: 1 }]);
    setShowForm(true);
  };

  const statutBadge = (s) => {
    const map = { brouillon: 'bg-slate-600/30 text-slate-400', confirme: 'bg-blue-600/30 text-blue-400', livre: 'bg-emerald-600/30 text-emerald-400', facture: 'bg-indigo-600/30 text-indigo-400', annule: 'bg-red-600/30 text-red-400' };
    return <span className={`text-xs px-2 py-0.5 rounded-full ${map[s] || map.brouillon}`}>{s}</span>;
  };

  const btnBase = 'px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2';

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="text-2xl font-bold text-slate-100">Documents de vente</h2><p className="text-sm text-slate-400">{orders.length} document{orders.length !== 1 ? 's' : ''}</p></div>
        <div className="flex flex-wrap gap-2">
          {orderTypes.map(t => (
            <button key={t.id} onClick={() => openNew(t.id)} className={`${btnBase} bg-indigo-600 hover:bg-indigo-500 text-white`}><t.icon className="w-4 h-4" /> {t.label}</button>
          ))}
        </div>
      </div>

      {msg && <div className={`flex items-start gap-3 p-4 rounded-xl border ${msg.type === 'success' ? 'bg-emerald-900/20 border-emerald-800/30 text-emerald-400' : 'bg-red-900/20 border-red-800/30 text-red-400'}`}><span className="text-sm flex-1">{msg.text}</span><button onClick={() => setMsg(null)}><X className="w-4 h-4" /></button></div>}

      <div className="flex gap-1 bg-slate-800 rounded-xl p-1 flex-wrap">
        <button onClick={() => setFilterType('all')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${filterType === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Tous</button>
        {orderTypes.map(t => (
          <button key={t.id} onClick={() => setFilterType(t.id)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${filterType === t.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>{t.label}</button>
        ))}
      </div>

      <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 420px)' }}>
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-800 text-slate-400 text-xs uppercase tracking-wider sticky top-0"><tr><th className="p-3">Type</th><th className="p-3">N°</th><th className="p-3">Date</th><th className="p-3">Client</th><th className="p-3">Total HT</th><th className="p-3">Total TTC</th><th className="p-3">Statut</th><th className="p-3"></th></tr></thead>
            <tbody className="divide-y divide-slate-800/50">
              {filtered.map(o => (
                <tr key={o.id} className="hover:bg-slate-700/30 text-slate-300 cursor-pointer" onClick={() => handleEdit(o)}>
                  <td className="p-3"><span className="text-xs font-medium">{orderTypes.find(t => t.id === o.type)?.label || o.type}</span></td>
                  <td className="p-3 font-mono text-xs text-indigo-400">{o.numero}</td>
                  <td className="p-3 whitespace-nowrap">{o.date}</td>
                  <td className="p-3 max-w-[150px] truncate">{o.client_nom || '—'}</td>
                  <td className="p-3 font-mono">{(o.total_ht || 0).toFixed(3)}</td>
                  <td className="p-3 font-mono font-bold">{(o.total_ttc || 0).toFixed(3)}</td>
                  <td className="p-3">{statutBadge(o.statut)}</td>
                  <td className="p-3"><button onClick={e => { e.stopPropagation(); handleDelete(o.id, o.numero); }} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="p-12 text-center text-slate-500">Aucun document</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto" onClick={() => setShowForm(false)}>
          <div className="bg-slate-800 rounded-2xl border border-slate-700 max-w-4xl w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="text-lg font-semibold text-slate-200">{orderTypes.find(t => t.id === form.type)?.label} {form.numero}</h3><button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-slate-500" /></button></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><label className="block text-sm text-slate-400 mb-1">Date</label><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-200" /></div>
              <div><label className="block text-sm text-slate-400 mb-1">Échéance</label><input type="date" value={form.date_echeance} onChange={e => setForm({ ...form, date_echeance: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-200" /></div>
              <div className="col-span-2"><label className="block text-sm text-slate-400 mb-1">Client</label>
                <select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value, client_nom: clients.find(c => c.id === e.target.value)?.nom || '' })} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-200">
                  <option value="">Sélectionner...</option>
                  {clients.filter(c => c.actif !== false).map(c => <option key={c.id} value={c.id}>{c.code} — {c.nom}</option>)}
                </select>
              </div>
            </div>
            {/* Lines */}
            <div className="space-y-2">
              <div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-300">Lignes</span><button onClick={addLine} className="text-indigo-400 hover:text-indigo-300 text-sm flex items-center gap-1"><Plus className="w-3 h-3" /> Ajouter</button></div>
              {lines.map((l, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <select value={l.product_id} onChange={e => selectProduct(idx, e.target.value)} className="w-32 bg-slate-700 border border-slate-600 rounded-lg px-2 py-2 text-xs text-slate-200">
                    <option value="">Article</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.reference || p.designation}</option>)}
                  </select>
                  <input value={l.designation} onChange={e => handleLineChange(idx, 'designation', e.target.value)} placeholder="Désignation" className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-200" />
                  <input type="number" value={l.quantite} onChange={e => handleLineChange(idx, 'quantite', parseFloat(e.target.value) || 0)} className="w-20 bg-slate-700 border border-slate-600 rounded-lg px-2 py-2 text-xs text-slate-200 text-right" />
                  <input type="number" value={l.prix_unitaire_ht} onChange={e => handleLineChange(idx, 'prix_unitaire_ht', parseFloat(e.target.value) || 0)} className="w-24 bg-slate-700 border border-slate-600 rounded-lg px-2 py-2 text-xs text-slate-200 text-right" />
                  <input type="number" value={l.taux_tva} onChange={e => handleLineChange(idx, 'taux_tva', parseFloat(e.target.value) || 0)} className="w-16 bg-slate-700 border border-slate-600 rounded-lg px-2 py-2 text-xs text-slate-200 text-right" />
                  <span className="w-24 text-right text-xs text-slate-300 py-2 font-mono">{(l.montant_ht || 0).toFixed(3)}</span>
                  {lines.length > 1 && <button onClick={() => removeLine(idx)} className="text-red-400 hover:text-red-300 py-2"><X className="w-4 h-4" /></button>}
                </div>
              ))}
            </div>
            {/* Totaux */}
            <div className="text-right space-y-1 border-t border-slate-700 pt-3">
              <p className="text-sm text-slate-400">Total HT: <span className="text-slate-200 font-mono font-bold">{totals.total_ht.toFixed(3)}</span></p>
              <p className="text-sm text-slate-400">TVA: <span className="text-slate-200 font-mono">{totals.total_tva.toFixed(3)}</span></p>
              <p className="text-base text-slate-200 font-bold">Total TTC: <span className="text-indigo-400">{totals.total_ttc.toFixed(3)}</span></p>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <select value={form.statut} onChange={e => setForm({ ...form, statut: e.target.value })} className="bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200">
                <option value="brouillon">Brouillon</option><option value="confirme">Confirmé</option><option value="livre">Livré</option><option value="facture">Facturé</option><option value="annule">Annulé</option>
              </select>
              <button onClick={() => setShowForm(false)} className="bg-slate-700/50 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-sm transition">Annuler</button>
              <button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl text-sm font-medium transition"><Save className="w-4 h-4 inline mr-1" /> Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function round(n) { return Math.round(n * 1000) / 1000; }
