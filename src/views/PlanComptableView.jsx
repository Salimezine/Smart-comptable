import React, { useState, useMemo } from 'react';
import { BookOpen, Search, FolderOpen, Hash, ChevronDown, ChevronRight, Layers } from 'lucide-react';
import SectionHeader from '../components/SectionHeader';
import KpiCard from '../components/KpiCard';
import { PCG_COMPLET } from '../utils/pcgComplet';

const CLASSES = [
  { num: 1, label: 'Capitaux propres', color: 'blue' },
  { num: 2, label: 'Actifs non courants', color: 'emerald' },
  { num: 3, label: 'Stocks', color: 'amber' },
  { num: 4, label: 'Tiers', color: 'purple' },
  { num: 5, label: 'Trésorerie', color: 'cyan' },
  { num: 6, label: 'Charges', color: 'red' },
  { num: 7, label: 'Produits', color: 'green' },
  { num: 8, label: 'Résultats', color: 'indigo' },
];

export default function PlanComptableView() {
  const [search, setSearch] = useState('');
  const [filterClasse, setFilterClasse] = useState(null);
  const [expanded, setExpanded] = useState({});

  const accounts = useMemo(() => {
    return Object.entries(PCG_COMPLET).map(([code, label]) => ({
      code,
      label,
      classe: parseInt(code[0]) || 0,
      hasChildren: false,
    }));
    // mark parents
  }, []);

  const hasChildren = useMemo(() => {
    const set = new Set();
    for (const { code } of accounts) {
      for (const other of accounts) {
        if (other.code !== code && other.code.startsWith(code)) {
          set.add(code);
          break;
        }
      }
    }
    return set;
  }, [accounts]);

  const accountsWithChildren = useMemo(() =>
    accounts.map(a => ({ ...a, hasChildren: hasChildren.has(a.code) })),
  [accounts, hasChildren]);

  const getChildren = (parentCode) =>
    accountsWithChildren.filter(a => a.code.startsWith(parentCode) && a.code !== parentCode);

  const filtered = useMemo(() => {
    let list = accountsWithChildren;
    if (filterClasse) list = list.filter(a => a.classe === filterClasse);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.code.toLowerCase().includes(q) || a.label.toLowerCase().includes(q)
      );
    }
    return list;
  }, [accountsWithChildren, filterClasse, search]);

  const classCounts = useMemo(() => {
    const counts = {};
    for (const a of accounts) {
      counts[a.classe] = (counts[a.classe] || 0) + 1;
    }
    return counts;
  }, [accounts]);

  const toggleExpanded = (code) => {
    setExpanded(prev => ({ ...prev, [code]: !prev[code] }));
  };

  function renderAccountRows(code, depth = 0) {
    const acc = accountsWithChildren.find(a => a.code === code);
    if (!acc) return null;
    const isExpanded = expanded[code];
    const children = getChildren(code).filter(c => c.code !== code);
    const visibleChildren = children.filter(c => {
      if (search.trim()) return true; // show all when searching
      return isExpanded;
    });

    return (
      <React.Fragment key={code}>
        <tr className="hover:bg-slate-800/20 transition-colors">
          <td className="px-4 py-2" style={{ paddingLeft: `${16 + depth * 20}px` }}>
            <div className="flex items-center gap-1.5">
              {acc.hasChildren && (
                <button onClick={() => toggleExpanded(code)} className="p-0.5 hover:text-slate-200 text-slate-500">
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
              )}
              {!acc.hasChildren && <span className="w-4" />}
              <span className={`font-mono font-bold ${depth === 0 ? 'text-white' : 'text-slate-300'}`}>{code}</span>
            </div>
          </td>
          <td className="px-4 py-2 text-slate-300 text-xs">{acc.label}</td>
          <td className="px-4 py-2 text-center">
            {acc.hasChildren ? (
              <span className="text-[10px] text-slate-500">Parent</span>
            ) : (
              <span className="text-[10px] text-emerald-500">Folio</span>
            )}
          </td>
          <td className="px-4 py-2 text-center text-[10px] text-slate-500">
            {acc.classe}
          </td>
        </tr>
        {acc.hasChildren && (isExpanded || search.trim()) && visibleChildren.map(child =>
          renderAccountRows(child.code, depth + 1)
        )}
      </React.Fragment>
    );
  }

  const rootAccounts = filtered.filter(a => {
    const parentCode = a.code.slice(0, -1);
    return !accountsWithChildren.some(p => p.hasChildren && a.code.startsWith(p.code) && a.code !== p.code);
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={BookOpen}
        title="Plan Comptable Tunisien"
        subtitle="PCG complet (loi 96-112) — Classes 1 à 8"
      />

      <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
        {CLASSES.map(c => (
          <button
            key={c.num}
            onClick={() => setFilterClasse(filterClasse === c.num ? null : c.num)}
            className={`relative p-3 rounded-xl border transition-all text-center ${
              filterClasse === c.num
                ? 'bg-brand-500/20 border-brand-500/40 text-white'
                : 'bg-slate-900/40 border-slate-800/40 text-slate-400 hover:border-slate-600'
            }`}
          >
            <div className="text-lg font-bold">{classCounts[c.num] || 0}</div>
            <div className="text-[9px] uppercase tracking-wider mt-0.5">{c.label}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Classe {c.num}</div>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par numéro ou libellé..."
          className="w-full bg-slate-900/60 border border-slate-800 focus:border-brand-500 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-200 focus:outline-none placeholder:text-slate-600"
        />
      </div>

      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-800/40">
                <th className="text-left px-4 py-3 text-slate-400 font-bold uppercase tracking-wide">Compte</th>
                <th className="text-left px-4 py-3 text-slate-400 font-bold uppercase tracking-wide">Libellé</th>
                <th className="text-center px-4 py-3 text-slate-400 font-bold uppercase tracking-wide w-20">Type</th>
                <th className="text-center px-4 py-3 text-slate-400 font-bold uppercase tracking-wide w-16">Classe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="text-center py-8 text-slate-500">Aucun compte trouvé</td></tr>
              )}
              {rootAccounts.map(a => renderAccountRows(a.code))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="px-4 py-2 text-[10px] text-slate-500 text-center">
        {accounts.length} comptes PCG tunisien · Cliquez sur une classe pour filtrer
      </div>
    </div>
  );
}
