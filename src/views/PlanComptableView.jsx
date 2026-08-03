import React, { useState, useMemo, useEffect } from 'react';
import { BookOpen, Search, ChevronDown, ChevronRight, Users, Plus, Trash2, X } from 'lucide-react';
import SectionHeader from '../components/SectionHeader';
import KpiCard from '../components/KpiCard';
import AccountSelect from '../components/AccountSelect';
import { PCG_COMPLET } from '../utils/pcgComplet';
import { loadTiers, updateTier, loadCustomAccounts, addCustomAccount, updateCustomAccount, removeCustomAccount } from '../utils/tiersCodes';

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
  const [tiersList, setTiersList] = useState([]);
  const [tiersSearch, setTiersSearch] = useState('');
  const [customList, setCustomList] = useState([]);
  const [newCode, setNewCode] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [customMsg, setCustomMsg] = useState('');

  useEffect(() => { setTiersList(loadTiers().filter(t => t.actif)); }, []);
  useEffect(() => { setCustomList(loadCustomAccounts()); }, []);

  const handleAddCustom = () => {
    const code = newCode.trim();
    const label = newLabel.trim();
    if (!code || !label) { setCustomMsg('Code et libellé obligatoires'); return; }
    if (PCG_COMPLET[code]) { setCustomMsg(`Le compte ${code} existe déjà dans le PCG`); return; }
    const ok = addCustomAccount({ code, label });
    if (!ok) { setCustomMsg(`Le compte ${code} existe déjà`); return; }
    setCustomList(loadCustomAccounts());
    setNewCode(''); setNewLabel(''); setCustomMsg(`Compte ${code} ajouté`);
  };

  const handleEditCustom = (code, updates) => {
    updateCustomAccount(code, updates);
    setCustomList(loadCustomAccounts());
  };

  const handleRemoveCustom = (code) => {
    removeCustomAccount(code);
    setCustomList(loadCustomAccounts());
  };

  const updateTierAccount = (code, field, value) => {
    const tier = loadTiers().find(t => t.code === code);
    if (tier) updateTier(code, { comptes_defaut: { ...tier.comptes_defaut, [field]: value } });
    setTiersList(loadTiers().filter(t => t.actif));
  };

  const updateTierLabel = (code, field, value) => {
    const labelField = field + '_label';
    const tier = loadTiers().find(t => t.code === code);
    if (tier) updateTier(code, { comptes_defaut: { ...tier.comptes_defaut, [labelField]: value } });
    setTiersList(loadTiers().filter(t => t.actif));
  };

  const filteredTiers = useMemo(() => {
    if (!tiersSearch.trim()) return tiersList;
    const q = tiersSearch.toLowerCase();
    return tiersList.filter(t =>
      t.code.toLowerCase().includes(q) ||
      t.nom.toLowerCase().includes(q) ||
      t.mf?.toLowerCase().includes(q)
    );
  }, [tiersList, tiersSearch]);

  const customAccounts = useMemo(() => {
    const map = {};
    for (const t of tiersList) {
      const cd = t.comptes_defaut || {};
      if (cd.charge && cd.charge_label) map[cd.charge] = cd.charge_label;
      if (cd.tiers && cd.tiers_label) map[cd.tiers] = cd.tiers_label;
      if (cd.tva && cd.tva_label) map[cd.tva] = cd.tva_label;
    }
    for (const a of customList) {
      map[a.code] = a.label;
    }
    return map;
  }, [tiersList, customList]);

  const accounts = useMemo(() => {
    const pcgEntries = Object.entries(PCG_COMPLET).map(([code, label]) => ({
      code,
      label,
      classe: parseInt(code[0]) || 0,
      hasChildren: false,
      custom: false,
      manual: false,
    }));
    const customManualCodes = new Set(customList.map(a => a.code));
    const customEntries = Object.entries(customAccounts)
      .filter(([code]) => !PCG_COMPLET[code])
      .map(([code, label]) => ({
        code,
        label,
        classe: parseInt(code[0]) || 0,
        hasChildren: false,
        custom: true,
        manual: customManualCodes.has(code),
      }));
    return [...pcgEntries, ...customEntries];
  }, [customAccounts, customList]);

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
        <tr className={`hover:bg-slate-800/20 transition-colors ${acc.custom ? 'bg-brand-500/5' : ''}`}>
          <td className="px-4 py-2" style={{ paddingLeft: `${16 + depth * 20}px` }}>
            <div className="flex items-center gap-1.5">
              {acc.hasChildren && (
                <button onClick={() => toggleExpanded(code)} className="p-0.5 hover:text-slate-200 text-slate-500">
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
              )}
              {!acc.hasChildren && <span className="w-4" />}
              <span className={`font-mono font-bold ${depth === 0 ? 'text-white' : 'text-slate-300'} ${acc.custom ? 'text-brand-300' : ''}`}>{code}</span>
            </div>
          </td>
          <td className="px-4 py-2 text-xs">
            <span className={acc.custom ? 'text-brand-300' : 'text-slate-300'}>{acc.label}</span>
          </td>
          <td className="px-4 py-2 text-center">
            {acc.hasChildren ? (
              <span className="text-[10px] text-slate-500">Parent</span>
            ) : acc.manual ? (
              <span className="text-[10px] text-purple-400">Personnalisé</span>
            ) : acc.custom ? (
              <span className="text-[10px] text-brand-500">Fournisseur</span>
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

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
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

      {/* Comptes Personnalisés */}
      <div className="space-y-3 pt-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <Plus className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-bold text-slate-200">Comptes Personnalisés</h3>
          <span className="text-[10px] text-slate-500 ml-auto">{customList.length} comptes</span>
        </div>
        <p className="text-[10px] text-slate-500">Ajoutez vos propres comptes (spécifiques à votre entreprise). Ils apparaissent dans l'arbre PCG et dans les AccountSelect.</p>

        <div className="flex gap-2">
          <input type="text" value={newCode} onChange={e => setNewCode(e.target.value)}
            placeholder="Code (ex: 611099)"
            className="w-32 bg-slate-900/60 border border-slate-800 focus:border-brand-500 rounded-xl px-3 py-2.5 text-xs text-slate-200 font-mono focus:outline-none placeholder:text-slate-600" />
          <input type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddCustom(); }}
            placeholder="Libellé (ex: Achats spécifiques)"
            className="flex-1 bg-slate-900/60 border border-slate-800 focus:border-brand-500 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none placeholder:text-slate-600" />
          <button onClick={handleAddCustom}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl bg-purple-600 text-white hover:bg-purple-500 transition-all shrink-0">
            <Plus className="w-3.5 h-3.5" /> Ajouter
          </button>
        </div>
        {customMsg && <p className="text-[10px] text-purple-400">{customMsg}</p>}

        {customList.length > 0 && (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-800/40">
                    <th className="text-left px-4 py-3 text-slate-400 font-bold uppercase tracking-wide">Compte</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-bold uppercase tracking-wide">Libellé</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {customList.map((a, i) => (
                    <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-2">
                        <input type="text" value={a.code}
                          onChange={e => {
                            const newC = e.target.value.trim();
                            if (newC === a.code) return;
                            if (!newC) return;
                            if (PCG_COMPLET[newC] || customList.some(x => x.code === newC && x.code !== a.code)) {
                              setCustomMsg(`Le compte ${newC} existe déjà`);
                              return;
                            }
                            updateCustomAccount(a.code, { code: newC, label: a.label });
                            setCustomList(loadCustomAccounts());
                          }}
                          className="w-full bg-transparent border border-transparent hover:border-slate-700 rounded px-2 py-1 text-xs text-purple-300 font-mono focus:outline-none focus:border-purple-500" />
                      </td>
                      <td className="px-4 py-2">
                        <input type="text" value={a.label}
                          onChange={e => handleEditCustom(a.code, { label: e.target.value })}
                          className="w-full bg-transparent border border-transparent hover:border-slate-700 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-purple-500" />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button onClick={() => handleRemoveCustom(a.code)}
                          className="text-slate-600 hover:text-danger-400 transition-colors" title="Supprimer le compte">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Comptes Fournisseurs */}
      {tiersList.length > 0 && (
        <div className="space-y-3 pt-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <Users className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-bold text-slate-200">Comptes par Fournisseur / Client</h3>
            <span className="text-[10px] text-slate-500 ml-auto">{filteredTiers.length} tiers</span>
          </div>
          <p className="text-[10px] text-slate-500">Modifiez ici les comptes par défaut de chaque tiers — ces comptes seront utilisés automatiquement lors des prochaines écritures.</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input type="text" value={tiersSearch} onChange={e => setTiersSearch(e.target.value)}
              placeholder="Rechercher par code, nom ou MF..."
              className="w-full bg-slate-900/60 border border-slate-800 focus:border-brand-500 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-200 focus:outline-none placeholder:text-slate-600" />
          </div>
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-800/40">
                    <th className="text-left px-4 py-3 text-slate-400 font-bold uppercase tracking-wide">Code</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-bold uppercase tracking-wide">Nom</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-bold uppercase tracking-wide">Compte Charge</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-bold uppercase tracking-wide">Compte Tiers</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-bold uppercase tracking-wide">Compte TVA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {filteredTiers.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-slate-500">Aucun tiers trouvé</td></tr>
                  )}
                  {filteredTiers.map(t => (
                    <tr key={t.code} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-2 font-mono text-brand-300">{t.code}</td>
                      <td className="px-4 py-2 text-slate-200">{t.nom}</td>
                      <td className="px-4 py-2">
                        <AccountSelect value={t.comptes_defaut?.charge || ''}
                          onChange={v => updateTierAccount(t.code, 'charge', v || '')}
                          className="max-w-[120px] mb-1" />
                        {t.comptes_defaut?.charge && (
                          <input type="text" value={t.comptes_defaut?.charge_label || PCG_COMPLET[t.comptes_defaut.charge] || ''}
                            onChange={e => updateTierLabel(t.code, 'charge', e.target.value)}
                            className="w-full bg-slate-800/40 border border-slate-700/40 rounded px-1.5 py-1 text-[9px] text-slate-400 focus:outline-none focus:border-slate-500" />
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <AccountSelect value={t.comptes_defaut?.tiers || ''}
                          onChange={v => updateTierAccount(t.code, 'tiers', v || '')}
                          className="max-w-[120px] mb-1" />
                        {t.comptes_defaut?.tiers && (
                          <input type="text" value={t.comptes_defaut?.tiers_label || PCG_COMPLET[t.comptes_defaut.tiers] || ''}
                            onChange={e => updateTierLabel(t.code, 'tiers', e.target.value)}
                            className="w-full bg-slate-800/40 border border-slate-700/40 rounded px-1.5 py-1 text-[9px] text-slate-400 focus:outline-none focus:border-slate-500" />
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <AccountSelect value={t.comptes_defaut?.tva || ''}
                          onChange={v => updateTierAccount(t.code, 'tva', v || '')}
                          className="max-w-[120px] mb-1" />
                        {t.comptes_defaut?.tva && (
                          <input type="text" value={t.comptes_defaut?.tva_label || PCG_COMPLET[t.comptes_defaut.tva] || ''}
                            onChange={e => updateTierLabel(t.code, 'tva', e.target.value)}
                            className="w-full bg-slate-800/40 border border-slate-700/40 rounded px-1.5 py-1 text-[9px] text-slate-400 focus:outline-none focus:border-slate-500" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
