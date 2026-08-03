import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, X, Save, FileText, Check, Printer, AlertCircle, Trash2 } from 'lucide-react';
import { purchaseOrdersStore, purchaseOrderLinesStore, suppliersStore, productsStore, computeOrderTotals, generatePurchaseNum } from '../utils/erpStore';
import { enregistrerDocument } from '../utils/saveIntegration';

const EMPTY_LINE = { product_id: '', designation: '', quantite: 1, prix_unitaire_ht: 0, taux_tva: 19, montant_ht: 0, montant_tva: 0, montant_ttc: 0, remise_pourcent: 0, quantite_recue: 0 };

export default function AchatsView({ companyId }) {
  const cid = companyId || localStorage.getItem('smart_comptable_current_id');
  const [tab, setTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [lines, setLines] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ numero: '', date: new Date().toISOString().slice(0, 10), date_echeance: '', date_reception: '', supplier_id: '', supplier_nom: '', notes: '', statut: 'brouillon' });
  const [msg, setMsg] = useState(null);
  const [filterStatut, setFilterStatut] = useState('all');

  useEffect(() => {
    if (!cid) return;
    setOrders(purchaseOrdersStore.getAll(cid));
    setSuppliers(suppliersStore.getAll(cid));
    setProducts(productsStore.getAll(cid));
  }, [cid]);

  const filtered = useMemo(() => {
    let list = orders;
    if (filterStatut !== 'all') list = list.filter(o => o.statut === filterStatut);
    return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [orders, filterStatut]);

  const openNew = () => {
    setForm({ numero: generatePurchaseNum(cid, 'achat'), date: new Date().toISOString().slice(0, 10), date_echeance: '', date_reception: '', supplier_id: '', supplier_nom: '', notes: '', statut: 'brouillon' });
    setLines([{ ...EMPTY_LINE, ligne: 1 }]);
    setEditingId(null);
    setShowForm(true);
  };

  const statuts = [
    { id: 'brouillon', label: 'Brouillon' },
    { id: 'confirme', label: 'Confirmé' },
    { id: 'recu', label: 'Reçu' },
    { id: 'facture', label: 'Facturé' },
    { id: 'annule', label: 'Annulé' },
  ];

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
      const newLines = lines.map((l, i) => i === idx ? { ...l, product_id: pid, designation: p.designation, prix_unitaire_ht: p.prix_achat_ht || 0, taux_tva: p.taux_tva || 19 } : l);
      setLines(recalcLines(newLines));
    }
  };

  const totals = useMemo(() => computeOrderTotals(lines), [lines]);

  const handleSave = () => {
    if (!form.supplier_id && !form.supplier_nom.trim()) { setMsg({ type: 'error', text: 'Sélectionnez un fournisseur' }); return; }
    if (lines.length === 0 || lines.every(l => !l.designation)) { setMsg({ type: 'error', text: 'Ajoutez au moins une ligne' }); return; }
    const supplier = form.supplier_id ? suppliers.find(s => s.id === form.supplier_id) : null;
    const orderData = {
      ...form,
      supplier_nom: supplier?.nom || form.supplier_nom,
      supplier_matricule_fiscal: supplier?.matricule_fiscal || '',
      supplier_adresse: supplier?.adresse || '',
      supplier_contact: supplier?.telephone || '',
      total_ht: totals.total_ht, total_tva: totals.total_tva, total_ttc: totals.total_ttc,
    };
    if (!orderData.numero) orderData.numero = generatePurchaseNum(cid, 'achat');
    const saved = purchaseOrdersStore.upsert(cid, orderData);
    if (saved) {
      const existingLines = editingId ? purchaseOrderLinesStore.getAll(cid).filter(l => l.order_id === editingId) : [];
      for (const oldL of existingLines) purchaseOrderLinesStore.delete(cid, oldL.id);
      const savedLines = [];
      for (const l of recalcLines(lines)) {
        const sl = purchaseOrderLinesStore.upsert(cid, { ...l, order_id: saved.id, company_id: cid });
        if (sl) savedLines.push(sl);
      }
      // Intégration : tiers fournisseur + écriture comptable + stock
      const docType = orderData.statut === 'annule' ? null : 'achat';
      if (docType) {
        try {
          enregistrerDocument(cid, {
            type: docType,
            fournisseur: orderData.supplier_nom || form.supplier_nom,
            mf: orderData.supplier_matricule_fiscal || '',
            adresse: orderData.supplier_adresse || '',
            telephone: orderData.supplier_contact || '',
            date: orderData.date,
            numero: orderData.numero,
            categorie: 'Achats de marchandises',
            journal: 'ACH',
            total_ht: orderData.total_ht, total_tva: orderData.total_tva, total_ttc: orderData.total_ttc,
            lignes: savedLines.length > 0 ? savedLines : recalcLines(lines),
            faireStock: orderData.statut === 'recu' || orderData.statut === 'facture',
          });
        } catch {}
      }
      setMsg({ type: 'success', text: `Bon d'achat ${saved.numero} enregistré` });
    }
    setShowForm(false);
    setOrders(purchaseOrdersStore.getAll(cid));
  };

  const handleDelete = (id, num) => {
    if (!window.confirm(`Supprimer ${num} ?`)) return;
    const toDelete = purchaseOrderLinesStore.getAll(cid).filter(l => l.order_id === id);
    for (const l of toDelete) purchaseOrderLinesStore.delete(cid, l.id);
    purchaseOrdersStore.delete(cid, id);
    setOrders(purchaseOrdersStore.getAll(cid));
    setMsg({ type: 'success', text: `${num} supprimé` });
  };

  const handleEdit = (order) => {
    setForm(order);
    setEditingId(order.id);
    const orderLines = purchaseOrderLinesStore.getAll(cid).filter(l => l.order_id === order.id);
    setLines(orderLines.length > 0 ? orderLines : [{ ...EMPTY_LINE, ligne: 1 }]);
    setShowForm(true);
  };

  const handleReception = (order) => {
    if (order.statut === 'recu' || order.statut === 'facture' || order.statut === 'annule') return;
    const orderLines = purchaseOrderLinesStore.getAll(cid).filter(l => l.order_id === order.id);
    for (const l of orderLines) {
      purchaseOrderLinesStore.upsert(cid, { ...l, quantite_recue: l.quantite || 0 });
    }
    purchaseOrdersStore.upsert(cid, { ...order, statut: 'recu', date_reception: new Date().toISOString().slice(0, 10) });
    // Intégration stock à la réception
    try {
      enregistrerDocument(cid, {
        type: 'achat',
        fournisseur: order.supplier_nom || '',
        mf: order.supplier_matricule_fiscal || '',
        date: order.date_reception || order.date,
        numero: order.numero,
        categorie: 'Achats de marchandises',
        journal: 'ACH',
        total_ht: order.total_ht || 0, total_tva: order.total_tva || 0, total_ttc: order.total_ttc || 0,
        lignes: orderLines,
        faireJournal: false,
        faireStock: true,
      });
    } catch {}
    setOrders(purchaseOrdersStore.getAll(cid));
    setMsg({ type: 'success', text: `${order.numero} marqué reçu` });
  };

  const statutBadge = (s) => {
    const map = { brouillon: 'bg-slate-600/30 text-slate-400', confirme: 'bg-blue-600/30 text-blue-400', recu: 'bg-emerald-600/30 text-emerald-400', facture: 'bg-indigo-600/30 text-indigo-400', annule: 'bg-red-600/30 text-red-400' };
    return <span className={`text-xs px-2 py-0.5 rounded-full ${map[s] || map.brouillon}`}>{s}</span>;
  };

  const btnBase = 'px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2';

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="text-2xl font-bold text-slate-100">Achats</h2><p className="text-sm text-slate-400">{orders.length} bon{orders.length !== 1 ? 's' : ''} d'achat</p></div>
        <button onClick={openNew} className={`${btnBase} bg-indigo-600 hover:bg-indigo-500 text-white`}><Plus className="w-4 h-4" /> Nouvel achat</button>
      </div>

      {msg && <div className={`flex items-start gap-3 p-4 rounded-xl border ${msg.type === 'success' ? 'bg-emerald-900/20 border-emerald-800/30 text-emerald-400' : 'bg-red-900/20 border-red-800/30 text-red-400'}`}><span className="text-sm flex-1">{msg.text}</span><button onClick={() => setMsg(null)}><X className="w-4 h-4" /></button></div>}

      <div className="flex gap-1 bg-slate-800 rounded-xl p-1 flex-wrap">
        <button onClick={() => setFilterStatut('all')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${filterStatut === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Tous</button>
        {statuts.map(s => (
          <button key={s.id} onClick={() => setFilterStatut(s.id)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${filterStatut === s.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>{s.label}</button>
        ))}
      </div>

      <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 420px)' }}>
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-800 text-slate-400 text-xs uppercase tracking-wider sticky top-0"><tr><th className="p-3">N°</th><th className="p-3">Date</th><th className="p-3">Fournisseur</th><th className="p-3">Total HT</th><th className="p-3">Total TTC</th><th className="p-3">Statut</th><th className="p-3"></th></tr></thead>
            <tbody className="divide-y divide-slate-800/50">
              {filtered.map(o => (
                <tr key={o.id} className="hover:bg-slate-700/30 text-slate-300">
                  <td className="p-3 font-mono text-xs text-indigo-400 cursor-pointer" onClick={() => handleEdit(o)}>{o.numero}</td>
                  <td className="p-3 whitespace-nowrap">{o.date}</td>
                  <td className="p-3 max-w-[200px] truncate text-indigo-300 cursor-pointer" onClick={() => handleEdit(o)}>{o.supplier_nom || '—'}</td>
                  <td className="p-3 font-mono">{(o.total_ht || 0).toFixed(3)}</td>
                  <td className="p-3 font-mono font-bold">{(o.total_ttc || 0).toFixed(3)}</td>
                  <td className="p-3">{statutBadge(o.statut)}</td>
                  <td className="p-3 flex gap-1">
                    {o.statut !== 'recu' && o.statut !== 'facture' && o.statut !== 'annule' && (
                      <button onClick={() => handleReception(o)} className="text-emerald-400 hover:text-emerald-300" title="Marquer reçu"><Check className="w-4 h-4" /></button>
                    )}
                    <button onClick={() => handleDelete(o.id, o.numero)} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="p-12 text-center text-slate-500">Aucun bon d'achat</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto" onClick={() => setShowForm(false)}>
          <div className="bg-slate-800 rounded-2xl border border-slate-700 max-w-4xl w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="text-lg font-semibold text-slate-200">Bon d'achat {form.numero}</h3><button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-slate-500" /></button></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><label className="block text-sm text-slate-400 mb-1">Date</label><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-200" /></div>
              <div><label className="block text-sm text-slate-400 mb-1">Échéance</label><input type="date" value={form.date_echeance} onChange={e => setForm({ ...form, date_echeance: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-200" /></div>
              <div className="col-span-2"><label className="block text-sm text-slate-400 mb-1">Fournisseur</label>
                <select value={form.supplier_id} onChange={e => setForm({ ...form, supplier_id: e.target.value, supplier_nom: suppliers.find(s => s.id === e.target.value)?.nom || '' })} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-200">
                  <option value="">Sélectionner...</option>
                  {suppliers.filter(s => s.actif !== false).map(s => <option key={s.id} value={s.id}>{s.code} — {s.nom}</option>)}
                </select>
              </div>
            </div>
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
            <div className="text-right space-y-1 border-t border-slate-700 pt-3">
              <p className="text-sm text-slate-400">Total HT: <span className="text-slate-200 font-mono font-bold">{totals.total_ht.toFixed(3)}</span></p>
              <p className="text-sm text-slate-400">TVA: <span className="text-slate-200 font-mono">{totals.total_tva.toFixed(3)}</span></p>
              <p className="text-base text-slate-200 font-bold">Total TTC: <span className="text-indigo-400">{totals.total_ttc.toFixed(3)}</span></p>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <select value={form.statut} onChange={e => setForm({ ...form, statut: e.target.value })} className="bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200">
                <option value="brouillon">Brouillon</option><option value="confirme">Confirmé</option><option value="recu">Reçu</option><option value="facture">Facturé</option><option value="annule">Annulé</option>
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
