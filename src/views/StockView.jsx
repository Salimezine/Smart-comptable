import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, X, Save, Package, Warehouse, AlertTriangle, RefreshCw } from 'lucide-react';
import { productsStore, warehousesStore, stockMovementsStore, ensureDefaultWarehouse, updateStockAfterMovement } from '../utils/erpStore';
import { getJournalKey } from '../utils/journalKey';

export default function StockView({ companyId }) {
  const [tab, setTab] = useState('products');
  const [search, setSearch] = useState('');
  const [list, setList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ reference: '', designation: '', description: '', unite: 'U', type: 'bien', compte_achat: '601000', compte_vente: '700000', compte_stock: '310000', taux_tva: 19, prix_achat_ht: 0, prix_vente_ht: 0, stock_mini: 0, stock_actuel: 0, code_barres: '', actif: true });
  const [msg, setMsg] = useState(null);
  const [showMovement, setShowMovement] = useState(null);
  const [movementForm, setMovementForm] = useState({ type: 'entree', quantite: 1, prix_unitaire_ht: 0, libelle: '', date_mouvement: new Date().toISOString().slice(0, 10) });

  const cid = companyId || localStorage.getItem('smart_comptable_current_id');
  const store = tab === 'products' ? productsStore : tab === 'warehouses' ? warehousesStore : stockMovementsStore;

  useEffect(() => {
    if (!cid) return;
    if (tab === 'warehouses') ensureDefaultWarehouse(cid);
    setList(store.getAll(cid));
  }, [cid, tab]);

  // Import stock from journal entries
  const handleImportFromJournal = () => {
    if (!cid) return;
    try {
      const jk = getJournalKey();
      const entries = JSON.parse(localStorage.getItem(jk) || '[]');
      // Get unique product-like accounts (3xxx)
      const accounts = new Set(entries.filter(e => /^3/.test(e.compte)).map(e => e.compte));
      const existing = productsStore.getAll(cid);
      const existingRefs = new Set(existing.map(p => p.reference));
      let count = 0;
      for (const acc of accounts) {
        const ref = `STK-${acc}`;
        if (existingRefs.has(ref)) continue;
        productsStore.upsert(cid, { reference: ref, designation: `Stock ${acc}`, type: 'bien', compte_stock: acc, stock_actuel: 0 });
        existingRefs.add(ref);
        count++;
      }
      if (count > 0) { setList(productsStore.getAll(cid)); setMsg({ type: 'success', text: `${count} produits importés du journal` }); }
      else setMsg({ type: 'error', text: 'Aucun nouveau produit trouvé' });
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
  };

  const filtered = useMemo(() => {
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(r => (r.designation || r.nom || r.reference || r.libelle || '').toLowerCase().includes(q));
  }, [list, search]);

  const handleSaveProduct = () => {
    if (!form.designation.trim()) { setMsg({ type: 'error', text: 'La désignation est obligatoire' }); return; }
    const record = { ...form };
    if (!record.reference) record.reference = productsStore.generateCode(cid, 'ART');
    productsStore.upsert(cid, record);
    setList(productsStore.getAll(cid)); setShowForm(false); setEditing(null); setForm({ ...form, reference: '', designation: '', description: '', prix_achat_ht: 0, prix_vente_ht: 0 });
    setMsg({ type: 'success', text: 'Produit enregistré' });
  };
  const handleSaveWarehouse = () => {
    if (!form.nom.trim()) return;
    warehousesStore.upsert(cid, { ...form });
    setList(warehousesStore.getAll(cid)); setShowForm(false); setEditing(null); setForm({ nom: '', adresse: '', code: '', defaut: false, actif: true });
    setMsg({ type: 'success', text: 'Dépôt enregistré' });
  };

  const handleMovement = () => {
    if (!showMovement || !movementForm.quantite) return;
    const wh = ensureDefaultWarehouse(cid);
    const product = productsStore.getById(cid, showMovement);
    const stockAvant = product?.stock_actuel || 0;
    let stockApres = stockAvant;
    if (['entree', 'ajustement_positif', 'transfert_entree'].includes(movementForm.type)) stockApres = stockAvant + movementForm.quantite;
    else stockApres = Math.max(0, stockAvant - movementForm.quantite);
    const movement = {
      product_id: showMovement, warehouse_id: wh.id, type: movementForm.type, quantite: movementForm.quantite,
      quantite_avant: stockAvant, quantite_apres: stockApres,
      prix_unitaire_ht: movementForm.prix_unitaire_ht, total_ht: movementForm.quantite * movementForm.prix_unitaire_ht,
      libelle: movementForm.libelle, date_mouvement: movementForm.date_mouvement,
    };
    stockMovementsStore.upsert(cid, movement);
    updateStockAfterMovement(cid, showMovement);
    setList(stockMovementsStore.getAll(cid)); setShowMovement(null);
    setMovementForm({ type: 'entree', quantite: 1, prix_unitaire_ht: 0, libelle: '', date_mouvement: new Date().toISOString().slice(0, 10) });
    setMsg({ type: 'success', text: 'Mouvement enregistré' });
  };

  const btnBase = 'px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2';

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="text-2xl font-bold text-slate-100">Gestion de stock</h2><p className="text-sm text-slate-400">{list.length} élément{list.length !== 1 ? 's' : ''}</p></div>
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1 bg-slate-800 rounded-xl p-1">
            <button onClick={() => setTab('products')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${tab === 'products' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Articles</button>
            <button onClick={() => setTab('movements')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${tab === 'movements' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Mouvements</button>
            <button onClick={() => setTab('warehouses')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${tab === 'warehouses' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Dépôts</button>
          </div>
          {tab === 'products' && <button onClick={() => { setEditing(null); setForm({ reference: '', designation: '', description: '', unite: 'U', type: 'bien', compte_achat: '601000', compte_vente: '700000', compte_stock: '310000', taux_tva: 19, prix_achat_ht: 0, prix_vente_ht: 0, stock_mini: 0, stock_actuel: 0, code_barres: '', actif: true }); setShowForm(true); }} className={`${btnBase} bg-indigo-600 hover:bg-indigo-500 text-white`}><Plus className="w-4 h-4" /> Article</button>}
          {tab === 'products' && <button onClick={handleImportFromJournal} className={`${btnBase} bg-amber-600/20 hover:bg-amber-600/30 text-amber-400`}><RefreshCw className="w-4 h-4" /> Importer du journal</button>}
          {tab === 'warehouses' && <button onClick={() => { setEditing(null); setForm({ nom: '', adresse: '', code: '', defaut: false, actif: true }); setShowForm(true); }} className={`${btnBase} bg-indigo-600 hover:bg-indigo-500 text-white`}><Plus className="w-4 h-4" /> Dépôt</button>}
        </div>
      </div>

      {msg && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border ${msg.type === 'success' ? 'bg-emerald-900/20 border-emerald-800/30 text-emerald-400' : 'bg-red-900/20 border-red-800/30 text-red-400'}`}>
          <span className="text-sm flex-1">{msg.text}</span>
          <button onClick={() => setMsg(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
      </div>

      {/* Products table */}
      {tab === 'products' && (
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 overflow-hidden">
          <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 400px)' }}>
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-800 text-slate-400 text-xs uppercase tracking-wider sticky top-0"><tr><th className="p-3">Réf</th><th className="p-3">Désignation</th><th className="p-3">Type</th><th className="p-3">PA HT</th><th className="p-3">PV HT</th><th className="p-3">Stock</th><th className="p-3">Mini</th><th className="p-3">TVA</th><th className="p-3"></th></tr></thead>
              <tbody className="divide-y divide-slate-800/50">
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-slate-700/30 text-slate-300">
                    <td className="p-3 font-mono text-xs text-indigo-400">{r.reference || '—'}</td>
                    <td className="p-3 font-medium">{r.designation}</td>
                    <td className="p-3 text-xs">{r.type}</td>
                    <td className="p-3 font-mono">{(r.prix_achat_ht || 0).toFixed(3)}</td>
                    <td className="p-3 font-mono">{(r.prix_vente_ht || 0).toFixed(3)}</td>
                    <td className={`p-3 font-mono font-bold ${(r.stock_actuel || 0) <= (r.stock_mini || 0) ? 'text-red-400' : 'text-emerald-400'}`}>{(r.stock_actuel || 0).toFixed(3)}</td>
                    <td className="p-3 font-mono">{(r.stock_mini || 0).toFixed(3)}</td>
                    <td className="p-3">{r.taux_tva || 19}%</td>
                    <td className="p-3">
                      <button onClick={() => { setShowMovement(r.id); setMovementForm({ ...movementForm, prix_unitaire_ht: r.prix_achat_ht || 0 }); }} className="text-indigo-400 hover:text-indigo-300 text-xs" title="Mouvement de stock"><RefreshCw className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={9} className="p-12 text-center text-slate-500">Aucun article</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Movements table */}
      {tab === 'movements' && (
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 overflow-hidden">
          <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 400px)' }}>
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-800 text-slate-400 text-xs uppercase tracking-wider sticky top-0"><tr><th className="p-3">Date</th><th className="p-3">Type</th><th className="p-3">Qté</th><th className="p-3">Avant</th><th className="p-3">Après</th><th className="p-3">PU HT</th><th className="p-3">Total HT</th><th className="p-3">Libellé</th></tr></thead>
              <tbody className="divide-y divide-slate-800/50">
                {filtered.slice().sort((a, b) => (b.date_mouvement || '').localeCompare(a.date_mouvement || '')).map(r => (
                  <tr key={r.id} className="hover:bg-slate-700/30 text-slate-300">
                    <td className="p-3 whitespace-nowrap">{r.date_mouvement}</td>
                    <td className="p-3"><span className={`text-xs px-2 py-0.5 rounded-full ${r.type === 'entree' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>{r.type}</span></td>
                    <td className="p-3 font-mono">{r.quantite}</td>
                    <td className="p-3 font-mono">{(r.quantite_avant || 0).toFixed(3)}</td>
                    <td className="p-3 font-mono">{(r.quantite_apres || 0).toFixed(3)}</td>
                    <td className="p-3 font-mono">{(r.prix_unitaire_ht || 0).toFixed(3)}</td>
                    <td className="p-3 font-mono">{(r.total_ht || 0).toFixed(3)}</td>
                    <td className="p-3 max-w-[150px] truncate">{r.libelle || '—'}</td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={8} className="p-12 text-center text-slate-500">Aucun mouvement</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Warehouses table */}
      {tab === 'warehouses' && (
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-800 text-slate-400 text-xs uppercase tracking-wider"><tr><th className="p-3">Code</th><th className="p-3">Nom</th><th className="p-3">Adresse</th><th className="p-3">Défaut</th></tr></thead>
            <tbody className="divide-y divide-slate-800/50">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-slate-700/30 text-slate-300">
                  <td className="p-3 font-mono text-xs text-indigo-400">{r.code || '—'}</td>
                  <td className="p-3 font-medium">{r.nom}</td>
                  <td className="p-3">{r.adresse || '—'}</td>
                  <td className="p-3">{r.defaut ? <span className="text-emerald-400 text-xs">✓</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Product form modal */}
      {showForm && tab === 'products' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-slate-800 rounded-2xl border border-slate-700 max-w-lg w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-200">{editing ? 'Modifier' : 'Nouvel'} article</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className="block text-sm text-slate-400 mb-1">Désignation *</label><input value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" /></div>
              <div><label className="block text-sm text-slate-400 mb-1">Type</label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"><option value="bien">Bien</option><option value="service">Service</option><option value="matiere_premiere">Matière première</option></select></div>
              <div><label className="block text-sm text-slate-400 mb-1">Unité</label><select value={form.unite} onChange={e => setForm({ ...form, unite: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"><option value="U">Unité</option><option value="kg">Kg</option><option value="L">Litre</option><option value="m">Mètre</option><option value="h">Heure</option><option value="forfait">Forfait</option></select></div>
              <div><label className="block text-sm text-slate-400 mb-1">PA HT</label><input type="number" value={form.prix_achat_ht} onChange={e => setForm({ ...form, prix_achat_ht: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" /></div>
              <div><label className="block text-sm text-slate-400 mb-1">PV HT</label><input type="number" value={form.prix_vente_ht} onChange={e => setForm({ ...form, prix_vente_ht: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" /></div>
              <div><label className="block text-sm text-slate-400 mb-1">TVA %</label><input type="number" value={form.taux_tva} onChange={e => setForm({ ...form, taux_tva: parseFloat(e.target.value) || 19 })} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" /></div>
              <div><label className="block text-sm text-slate-400 mb-1">Stock mini</label><input type="number" value={form.stock_mini} onChange={e => setForm({ ...form, stock_mini: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" /></div>
              <div className="col-span-2"><label className="block text-sm text-slate-400 mb-1">Compte stock</label><input value={form.compte_stock} onChange={e => setForm({ ...form, compte_stock: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" /></div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setShowForm(false)} className="bg-slate-700/50 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-sm transition">Annuler</button>
              <button onClick={handleSaveProduct} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl text-sm font-medium transition"><Save className="w-4 h-4 inline mr-1" /> Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* Movement modal */}
      {showMovement && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowMovement(null)}>
          <div className="bg-slate-800 rounded-2xl border border-slate-700 max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-200">Mouvement de stock</h3>
            <div className="space-y-3">
              <div><label className="block text-sm text-slate-400 mb-1">Type</label><select value={movementForm.type} onChange={e => setMovementForm({ ...movementForm, type: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"><option value="entree">Entrée</option><option value="sortie">Sortie</option><option value="ajustement_positif">Ajustement +</option><option value="ajustement_negatif">Ajustement -</option></select></div>
              <div><label className="block text-sm text-slate-400 mb-1">Quantité</label><input type="number" value={movementForm.quantite} onChange={e => setMovementForm({ ...movementForm, quantite: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" /></div>
              <div><label className="block text-sm text-slate-400 mb-1">PU HT</label><input type="number" value={movementForm.prix_unitaire_ht} onChange={e => setMovementForm({ ...movementForm, prix_unitaire_ht: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" /></div>
              <div><label className="block text-sm text-slate-400 mb-1">Date</label><input type="date" value={movementForm.date_mouvement} onChange={e => setMovementForm({ ...movementForm, date_mouvement: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" /></div>
              <div><label className="block text-sm text-slate-400 mb-1">Libellé</label><input value={movementForm.libelle} onChange={e => setMovementForm({ ...movementForm, libelle: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" /></div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setShowMovement(null)} className="bg-slate-700/50 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-sm transition">Annuler</button>
              <button onClick={handleMovement} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl text-sm font-medium transition">Valider</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
