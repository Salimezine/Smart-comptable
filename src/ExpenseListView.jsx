import React, { useState } from 'react';
import { Filter, Trash2, TrendingDown, Search, X, BarChart3, Calendar, Tag, AlertCircle } from 'lucide-react';
import { useConfirm } from './components/ConfirmModal';
import { useToast } from './components/Toast';

const CATEGORY_COLORS = {
  frais_telecommunication: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  frais_energie: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  frais_carburant: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  loyer: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  honoraires: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
  frais_transport: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  frais_assurance: 'bg-teal-500/15 text-teal-400 border-teal-500/20',
  fournitures_bureau: 'bg-pink-500/15 text-pink-400 border-pink-500/20',
  frais_informatique: 'bg-violet-500/15 text-violet-400 border-violet-500/20',
  frais_publicite: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
  frais_bancaires: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
  services_exterieurs: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
};

function getCategoryColor(cat) {
  return CATEGORY_COLORS[cat] || 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20';
}

function SupplierAvatar({ name }) {
  const initials = (name || '?').slice(0, 2).toUpperCase();
  const hue = Array.from(name || '').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black text-white shrink-0"
      style={{ background: `hsl(${hue}, 60%, 35%)`, border: `1px solid hsl(${hue}, 60%, 50%)` }}
    >
      {initials}
    </div>
  );
}

export default function ExpenseListView({ expenses, setExpenses, formatCurrency }) {
  const confirm = useConfirm();
  const { success, error: toastError } = useToast();
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

  const totalFiltered = filtered.reduce((s, e) => s + (e.totalAmount || 0), 0);
  const totalAll = expenses.reduce((s, e) => s + (e.totalAmount || 0), 0);
  const avgAmount = expenses.length ? totalAll / expenses.length : 0;

  const handleDelete = async (exp) => {
    const ok = await confirm({
      title: 'Supprimer la dépense ?',
      message: `"${exp.supplier}" — ${formatCurrency(exp.totalAmount)} sera définitivement supprimée.`,
      confirmLabel: 'Supprimer',
      cancelLabel: 'Annuler',
      type: 'danger',
    });
    if (!ok) return;
    setExpenses(expenses.filter(x => x.id !== exp.id));
    success(`Dépense "${exp.supplier}" supprimée.`);
  };

  const clearFilters = () => {
    setFilterCategory('all');
    setFilterSupplier('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const hasFilters = filterCategory !== 'all' || filterSupplier || filterDateFrom || filterDateTo;

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Dépenses',
            value: formatCurrency(totalAll),
            icon: TrendingDown,
            color: 'text-red-400',
            bg: 'bg-red-500/8 border-red-500/20',
            glow: 'hover:shadow-[0_0_20px_rgba(239,68,68,0.2)] hover:border-red-500/35',
          },
          {
            label: 'Nb. Dépenses',
            value: expenses.length,
            icon: BarChart3,
            color: 'text-slate-100',
            bg: 'bg-slate-800/40 border-slate-700/40',
            glow: 'hover:shadow-card-hover',
          },
          {
            label: 'Montant Moyen',
            value: formatCurrency(avgAmount),
            icon: Calendar,
            color: 'text-slate-200',
            bg: 'bg-slate-800/40 border-slate-700/40',
            glow: 'hover:shadow-card-hover',
          },
          {
            label: 'Catégories',
            value: categories.length,
            icon: Tag,
            color: 'text-indigo-400',
            bg: 'bg-indigo-500/8 border-indigo-500/20',
            glow: 'hover:shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:border-indigo-500/35',
          },
        ].map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className={`glass-card p-4 rounded-2xl border ${card.bg} ${card.glow} transition-all duration-300 hover:-translate-y-0.5 group`}>
              <div className="flex items-start justify-between mb-2">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{card.label}</p>
                <div className={`p-1.5 rounded-lg ${card.bg} border border-slate-700/30`}>
                  <Icon className={`w-3.5 h-3.5 ${card.color}`} />
                </div>
              </div>
              <p className={`text-xl font-extrabold ${card.color}`}>{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* ── Filters ── */}
      <div className="glass-card p-4 rounded-2xl border border-slate-800/60 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Filter className="w-3.5 h-3.5" />
          <span className="text-xs font-semibold">Filtres</span>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
          <input
            type="text"
            placeholder="Fournisseur..."
            value={filterSupplier}
            onChange={e => setFilterSupplier(e.target.value)}
            className="bg-slate-900/60 border border-slate-700/60 rounded-xl pl-7 pr-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500/50 w-44 transition-colors"
          />
        </div>

        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="bg-slate-900/60 border border-slate-700/60 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500/50 transition-colors"
        >
          <option value="all">Toutes catégories</option>
          {categories.map(cat => <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>)}
        </select>

        <input
          type="date"
          value={filterDateFrom}
          onChange={e => setFilterDateFrom(e.target.value)}
          className="bg-slate-900/60 border border-slate-700/60 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500/50 transition-colors"
        />
        <span className="text-slate-600 text-xs">→</span>
        <input
          type="date"
          value={filterDateTo}
          onChange={e => setFilterDateTo(e.target.value)}
          className="bg-slate-900/60 border border-slate-700/60 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500/50 transition-colors"
        />

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg text-xs font-bold border border-indigo-500/20 transition-all"
          >
            <X className="w-3 h-3" /> Effacer
          </button>
        )}

        <span className="ml-auto text-[10px] text-slate-500 font-medium">
          {hasFilters
            ? `${filtered.length} / ${expenses.length} · ${formatCurrency(totalFiltered)}`
            : `${expenses.length} dépense${expenses.length > 1 ? 's' : ''} · ${formatCurrency(totalAll)}`
          }
        </span>
      </div>

      {/* ── Table ── */}
      <div className="glass-card rounded-2xl border border-slate-800/60 overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-900/60 border-b border-slate-800/60">
                <th className="py-3 px-5 text-left text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Fournisseur</th>
                <th className="py-3 px-5 text-left text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Catégorie</th>
                <th className="py-3 px-5 text-left text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Date</th>
                <th className="py-3 px-5 text-right text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Montant TTC</th>
                <th className="py-3 px-5 text-center text-[10px] uppercase tracking-widest text-slate-500 font-semibold w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-slate-800/60 border border-slate-700/40 flex items-center justify-center">
                        <AlertCircle className="w-7 h-7 text-slate-600" />
                      </div>
                      <p className="text-sm font-bold text-slate-400">
                        {hasFilters ? 'Aucun résultat pour ces filtres' : 'Aucune dépense enregistrée'}
                      </p>
                      <p className="text-xs text-slate-600">
                        {hasFilters ? 'Modifiez vos critères de filtre' : 'Scannez un reçu ou saisissez manuellement'}
                      </p>
                      {hasFilters && (
                        <button onClick={clearFilters} className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
                          Effacer les filtres
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((exp, idx) => (
                  <tr key={exp.id || idx} className="hover:bg-slate-800/20 transition-colors group">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <SupplierAvatar name={exp.supplier} />
                        <div>
                          <p className="text-sm font-bold text-white">{exp.supplier}</p>
                          {exp.matriculeFiscal && (
                            <p className="text-[10px] text-slate-500 font-mono">MF: {exp.matriculeFiscal}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${getCategoryColor(exp.category)}`}>
                        {(exp.category || 'Autre').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-xs text-slate-400 font-medium">{exp.date}</td>
                    <td className="py-3.5 px-5 text-right font-extrabold text-red-400 text-sm">
                      -{formatCurrency(exp.totalAmount)}
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <button
                        onClick={() => handleDelete(exp)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 bg-slate-800/60 hover:bg-red-500/15 text-slate-500 hover:text-red-400 rounded-lg border border-slate-700/40 hover:border-red-500/30 transition-all duration-200"
                        title="Supprimer"
                      >
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
