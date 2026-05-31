import React, { useState } from 'react';
import { Search, Plus, Trash2, Building, Phone, FileText } from 'lucide-react';

export default function FournisseursView({ expenses, formatCurrency }) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', mf: '', phone: '', address: '' });

  const [manualSuppliers, setManualSuppliers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sc_manual_suppliers') || '[]'); } catch { return []; }
  });

  const saveManual = (list) => {
    setManualSuppliers(list);
    localStorage.setItem('sc_manual_suppliers', JSON.stringify(list));
  };

  const supplierMap = {};
  expenses.forEach(exp => {
    const name = exp.supplier || 'Inconnu';
    if (!supplierMap[name]) supplierMap[name] = { name, mf: exp.matriculeFiscal || '', phone: '', address: '', total: 0, count: 0 };
    supplierMap[name].total += exp.totalAmount || 0;
    supplierMap[name].count++;
  });
  manualSuppliers.forEach(s => {
    if (!supplierMap[s.name]) supplierMap[s.name] = { ...s, total: 0, count: 0 };
  });

  const allSuppliers = Object.values(supplierMap);
  const filtered = allSuppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.name) return;
    saveManual([...manualSuppliers, { ...form }]);
    setForm({ name: '', mf: '', phone: '', address: '' });
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un fournisseur..."
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 w-full max-w-xs focus:outline-none focus:border-brand-500" />
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-gradient-brand text-white text-xs font-bold rounded-xl shadow-glow hover:opacity-90 transition-all">
          <Plus className="w-3.5 h-3.5" /> Ajouter Fournisseur
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="glass-card p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input required placeholder="Nom *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500" />
            <input placeholder="Matricule Fiscal" value={form.mf} onChange={e => setForm({ ...form, mf: e.target.value })}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500" />
            <input placeholder="Téléphone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500" />
            <input placeholder="Adresse" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors">Annuler</button>
            <button type="submit"
              className="px-3 py-1.5 bg-gradient-brand text-white text-xs font-bold rounded-xl hover:opacity-90 transition-all">Enregistrer</button>
          </div>
        </form>
      )}

      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                <th className="py-4 px-6">Fournisseur</th>
                <th className="py-4 px-6">Matricule Fiscal</th>
                <th className="py-4 px-6">Téléphone</th>
                <th className="py-4 px-6 text-right">Total Achats</th>
                <th className="py-4 px-6 text-center">Factures</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-xs">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-slate-500">Aucun fournisseur</td></tr>
              ) : (
                filtered.map((s, i) => (
                  <tr key={i} className="hover:bg-slate-800/10 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="font-bold text-white">{s.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-400 font-mono">{s.mf || '—'}</td>
                    <td className="py-4 px-6 text-slate-400">{s.phone || '—'}</td>
                    <td className="py-4 px-6 text-right font-extrabold text-danger-400">{formatCurrency(s.total)}</td>
                    <td className="py-4 px-6 text-center">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">{s.count} facture{s.count > 1 ? 's' : ''}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
