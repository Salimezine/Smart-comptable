import React, { useState } from 'react';
import { Search, Plus, Building2, Phone, MapPin, FileText, TrendingDown, X, Users, Sparkles } from 'lucide-react';
import { useToast } from './components/Toast';
import { supabase, isSupabaseEnabled } from './utils/supabaseClient';

function SupplierAvatar({ name, size = 'md' }) {
  const initials = (name || '?').slice(0, 2).toUpperCase();
  const hue = Array.from(name || '').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  const sizeClass = size === 'lg' ? 'w-12 h-12 text-sm' : 'w-9 h-9 text-xs';
  return (
    <div
      className={`${sizeClass} rounded-xl flex items-center justify-center font-black text-white shrink-0`}
      style={{
        background: `linear-gradient(135deg, hsl(${hue}, 60%, 30%), hsl(${hue}, 70%, 45%))`,
        border: `1px solid hsl(${hue}, 70%, 55%)`,
        boxShadow: `0 4px 12px hsl(${hue}, 60%, 30%)`,
      }}
    >
      {initials}
    </div>
  );
}

export default function FournisseursView({ expenses, formatCurrency, currentCompanyId }) {
  const { success } = useToast();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', mf: '', phone: '', address: '' });
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  const suppliersKey = currentCompanyId ? `sc_manual_suppliers_${currentCompanyId}` : 'sc_manual_suppliers';
  const [manualSuppliers, setManualSuppliers] = useState(() => {
    try { return JSON.parse(localStorage.getItem(suppliersKey) || '[]'); } catch { return []; }
  });

  const saveManual = (list) => {
    setManualSuppliers(list);
    localStorage.setItem(suppliersKey, JSON.stringify(list));
    // Sync to Supabase
    if (isSupabaseEnabled() && navigator.onLine && currentCompanyId) {
      supabase.from('suppliers').upsert(
        list.map(s => ({ ...s, company_id: currentCompanyId })),
        { onConflict: 'id' }
      ).catch(() => {});
    }
  };

  // Build supplier map
  const supplierMap = {};
  expenses.forEach(exp => {
    const name = exp.supplier || 'Inconnu';
    if (!supplierMap[name]) supplierMap[name] = { name, mf: exp.matriculeFiscal || '', phone: '', address: '', total: 0, count: 0 };
    supplierMap[name].total += exp.totalAmount || 0;
    supplierMap[name].count++;
  });
  manualSuppliers.forEach(s => {
    if (!supplierMap[s.name]) supplierMap[s.name] = { ...s, total: 0, count: 0 };
    else supplierMap[s.name] = { ...supplierMap[s.name], phone: s.phone || '', address: s.address || '', mf: s.mf || supplierMap[s.name].mf };
  });

  const allSuppliers = Object.values(supplierMap).sort((a, b) => b.total - a.total);
  const filtered = allSuppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.name) return;
    saveManual([...manualSuppliers, { ...form }]);
    setForm({ name: '', mf: '', phone: '', address: '' });
    setShowForm(false);
    success(`Fournisseur "${form.name}" ajouté.`);
  };

  const totalAchats = allSuppliers.reduce((s, x) => s + x.total, 0);

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Fournisseurs', value: allSuppliers.length, color: 'text-indigo-400', bg: 'bg-indigo-500/8 border-indigo-500/20', icon: Users },
          { label: 'Total Achats', value: formatCurrency(totalAchats), color: 'text-red-400', bg: 'bg-red-500/8 border-red-500/20', icon: TrendingDown },
          { label: 'Factures traitées', value: expenses.length, color: 'text-emerald-400', bg: 'bg-emerald-500/8 border-emerald-500/20', icon: FileText },
        ].map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className={`glass-card p-4 rounded-2xl border ${card.bg} transition-all duration-300 hover:-translate-y-0.5`}>
              <div className="flex items-start justify-between mb-2">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{card.label}</p>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <p className={`text-xl font-extrabold ${card.color}`}>{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-0 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un fournisseur..."
            className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowForm(f => !f)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-xs font-bold rounded-xl shadow-[0_4px_16px_rgba(99,102,241,0.3)] hover:shadow-[0_6px_20px_rgba(99,102,241,0.45)] transition-all duration-200"
        >
          <Plus className="w-3.5 h-3.5" /> Ajouter Fournisseur
        </button>
      </div>

      {/* ── Add form ── */}
      {showForm && (
        <div className="glass-card p-5 rounded-2xl border border-indigo-500/20 bg-indigo-500/4 shadow-[0_0_20px_rgba(99,102,241,0.08)]">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" /> Nouveau fournisseur
            </h4>
            <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key: 'name', label: 'Nom *', placeholder: 'Société Tunisienne...', required: true },
              { key: 'mf', label: 'Matricule Fiscal', placeholder: '1234567/X/A/M/000' },
              { key: 'phone', label: 'Téléphone', placeholder: '+216 XX XXX XXX' },
              { key: 'address', label: 'Adresse', placeholder: 'Rue..., Tunis' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1 block">{f.label}</label>
                <input
                  required={f.required}
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  className="w-full bg-slate-900/60 border border-slate-700/60 focus:border-indigo-500/50 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none transition-colors placeholder:text-slate-600"
                />
              </div>
            ))}
            <div className="sm:col-span-2 flex justify-end gap-2.5 mt-1">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white border border-slate-700/60 rounded-xl transition-colors">
                Annuler
              </button>
              <button type="submit"
                className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-xs font-bold rounded-xl shadow-[0_4px_16px_rgba(99,102,241,0.3)] transition-all hover:shadow-[0_6px_20px_rgba(99,102,241,0.45)]">
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Grid / Table ── */}
      {filtered.length === 0 ? (
        <div className="glass-card p-16 rounded-2xl border border-slate-800/60 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700/40 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-slate-600" />
          </div>
          <p className="text-sm font-bold text-slate-400 mb-1">
            {search ? `Aucun fournisseur pour "${search}"` : 'Aucun fournisseur'}
          </p>
          <p className="text-xs text-slate-600">
            {search ? 'Modifiez votre recherche' : 'Vos fournisseurs apparaîtront ici après importation de factures'}
          </p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl border border-slate-800/60 overflow-hidden shadow-card">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-900/60 border-b border-slate-800/60">
                <th className="py-3 px-5 text-left text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Fournisseur</th>
                <th className="py-3 px-5 text-left text-[10px] uppercase tracking-widest text-slate-500 font-semibold hidden md:table-cell">Matricule Fiscal</th>
                <th className="py-3 px-5 text-left text-[10px] uppercase tracking-widest text-slate-500 font-semibold hidden lg:table-cell">Contact</th>
                <th className="py-3 px-5 text-right text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Total Achats</th>
                <th className="py-3 px-5 text-center text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Factures</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {filtered.map((s, i) => (
                <tr key={i} className="hover:bg-slate-800/20 transition-colors group cursor-pointer" onClick={() => setSelectedSupplier(s === selectedSupplier ? null : s)}>
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-3">
                      <SupplierAvatar name={s.name} />
                      <div>
                        <p className="text-sm font-bold text-white">{s.name}</p>
                        {s.address && <p className="text-[10px] text-slate-500 flex items-center gap-1"><MapPin className="w-2.5 h-2.5" />{s.address}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-5 text-slate-400 font-mono text-xs hidden md:table-cell">{s.mf || '—'}</td>
                  <td className="py-3.5 px-5 hidden lg:table-cell">
                    {s.phone ? (
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Phone className="w-3 h-3" /> {s.phone}
                      </span>
                    ) : <span className="text-slate-600 text-xs">—</span>}
                  </td>
                  <td className="py-3.5 px-5 text-right font-extrabold text-red-400 text-sm">{formatCurrency(s.total)}</td>
                  <td className="py-3.5 px-5 text-center">
                    <span className="text-[10px] px-2.5 py-1 rounded-full bg-slate-800/60 border border-slate-700/40 text-slate-300 font-semibold">
                      {s.count}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
