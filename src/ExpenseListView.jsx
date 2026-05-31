import React, { useState } from 'react';
import { Filter, Trash2, TrendingDown } from 'lucide-react';

export default function ExpenseListView({ expenses, setExpenses, formatCurrency }) {
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const categories = [...new Set(expenses.map(e => e.category).filter(Boolean))];
  const filtered = expenses.filter(exp => {
    if (filterCategory !== 'all' && exp.category !== filterCategory) return false;
    if (filterSupplier && !exp.supplier?.toLowerCase().includes(filterSupplier.toLowerCase())) return false;
    if (filterDateFrom && exp.date < filterDateFrom) return false;
    if (filterDateTo && exp.date > filterDateTo) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-card p-4 rounded-xl border border-slate-800">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Total</p>
          <p className="text-lg font-extrabold text-danger-400">{formatCurrency(expenses.reduce((s, e) => s + (e.totalAmount || 0), 0))}</p>
        </div>
        <div className="glass-card p-4 rounded-xl border border-slate-800">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Dépenses</p>
          <p className="text-lg font-extrabold text-white">{expenses.length}</p>
        </div>
        <div className="glass-card p-4 rounded-xl border border-slate-800">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Moyenne</p>
          <p className="text-lg font-extrabold text-slate-200">{formatCurrency(expenses.length ? expenses.reduce((s, e) => s + (e.totalAmount || 0), 0) / expenses.length : 0)}</p>
        </div>
        <div className="glass-card p-4 rounded-xl border border-slate-800">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Catégories</p>
          <p className="text-lg font-extrabold text-brand-400">{categories.length}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-slate-400" />
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500">
          <option value="all">Toutes catégories</option>
          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <input type="text" placeholder="Rechercher fournisseur..." value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 w-48 focus:outline-none focus:border-brand-500" />
        <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500" />
        <span className="text-[10px] text-slate-500">→</span>
        <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500" />
        {(filterCategory !== 'all' || filterSupplier || filterDateFrom || filterDateTo) && (
          <button onClick={() => { setFilterCategory('all'); setFilterSupplier(''); setFilterDateFrom(''); setFilterDateTo(''); }}
            className="text-[10px] text-brand-400 hover:text-white transition-colors">Effacer</button>
        )}
        <span className="text-[10px] text-slate-500 ml-auto">{filtered.length} dépense{filtered.length > 1 ? 's' : ''}{filtered.length < expenses.length ? ` (filtrées sur ${expenses.length})` : ''}</span>
      </div>

      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                <th className="py-4 px-6">Fournisseur</th>
                <th className="py-4 px-6">Catégorie</th>
                <th className="py-4 px-6">Date</th>
                <th className="py-4 px-6 text-right">Montant TTC</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-xs">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-slate-500">Aucune dépense</td></tr>
              ) : (
                filtered.map((exp, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/10 transition-colors">
                    <td className="py-4 px-6">
                      <p className="font-bold text-white">{exp.supplier}</p>
                      {exp.matriculeFiscal && <span className="text-[10px] text-slate-500">MF: {exp.matriculeFiscal}</span>}
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400">{exp.category}</span>
                    </td>
                    <td className="py-4 px-6 text-slate-400">{exp.date}</td>
                    <td className="py-4 px-6 text-right font-extrabold text-danger-400">{formatCurrency(exp.totalAmount)}</td>
                    <td className="py-4 px-6 text-right">
                      <button onClick={() => { if (window.confirm(`Supprimer "${exp.supplier}" ?`)) setExpenses(expenses.filter(x => x.id !== exp.id)); }}
                        className="p-2 bg-slate-800 hover:bg-danger-500/20 text-danger-400 rounded-xl border border-slate-700/50" title="Supprimer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
