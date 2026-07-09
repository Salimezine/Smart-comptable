import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Search, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import AccountSelect from './AccountSelect';
import { loadTiers, saveTiers, removeTier, autoSuggestCode, autoSuggestCompte } from '../utils/tiersCodes';
import { PCG_COMPLET } from '../utils/pcgComplet';

function PcgBrowser({ onSelect }) {
  const [q, setQ] = useState('');
  const entries = Object.entries(PCG_COMPLET).filter(([code, label]) => {
    if (!q) return true;
    const lower = q.toLowerCase();
    return code.includes(q) || label.toLowerCase().includes(lower);
  });

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="Rechercher par code ou libellé..."
          className="w-full bg-slate-900 rounded-xl pl-7 pr-3 py-2 text-slate-200 border border-slate-800 text-[10px]" />
      </div>
      <div className="max-h-80 overflow-y-auto space-y-0.5">
        {entries.length === 0 && <p className="text-[10px] text-slate-500 text-center py-4">Aucun compte trouvé</p>}
        {entries.length > 0 && <p className="text-[9px] text-slate-600 text-right">{entries.length} compte(s)</p>}
        {entries.map(([code, label]) => (
          <div key={code}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer transition-colors"
            onClick={() => onSelect?.(code)}>
            <span className="font-mono text-brand-400 text-[10px] font-bold w-16 shrink-0">{code}</span>
            <span className="text-[10px] text-slate-300 truncate">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TiersManager({ onClose }) {
  const [tab, setTab] = useState('tiers');
  const [tiers, setTiers] = useState([]);
  const [filter, setFilter] = useState('fournisseur');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { setTiers(loadTiers()); }, []);

  const filtered = tiers.filter(t => {
    if (filter !== 'all' && t.type !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.code.toLowerCase().includes(q) || t.nom.toLowerCase().includes(q) || t.mf.toLowerCase().includes(q);
    }
    return true;
  });

  const refresh = () => setTiers(loadTiers());

  const handleRemove = (code) => {
    removeTier(code);
    refresh();
    if (expanded === code) setExpanded(null);
  };

  const comptePrefix = { fournisseur: '401', client: '411', banque: '532' };

  const handleAdd = () => {
    const type = filter === 'all' ? 'fournisseur' : filter;
    const code = autoSuggestCode(type);
    const baseCompte = autoSuggestCompte(comptePrefix[type] || '401');
    const newTier = {
      code,
      type,
      nom: '',
      mf: '',
      categorie: '',
      tva: 19,
      timbre: 1,
      rs_applicable: false,
      comptes_defaut: { charge: '', tiers: baseCompte, tva: '43666' },
      actif: true,
    };
    setEditing({ ...newTier, _isNew: true });
  };

  const handleSave = (tier) => {
    const list = loadTiers();
    const idx = list.findIndex(t => t.code === tier.code);
    if (idx >= 0) list[idx] = tier;
    else list.push(tier);
    saveTiers(list);
    setEditing(null);
    refresh();
  };

  const EditableRow = ({ tier, onSave, onCancel }) => {
    const [form, setForm] = useState({ ...tier });

    const set = (field, value) => setForm(f => ({ ...f, [field]: value }));
    const setCompte = (field, value) => setForm(f => ({ ...f, comptes_defaut: { ...f.comptes_defaut, [field]: value } }));

    return (
      <div className="space-y-2 p-2.5 bg-slate-900 rounded-xl border border-brand-500/30">
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div>
            <label className="text-slate-500 mb-1 block">Code</label>
            <input value={form.code} onChange={e => set('code', e.target.value)}
              className="w-full bg-slate-800 rounded-lg px-2 py-1.5 text-slate-200 border border-slate-700 font-mono text-[11px]" />
          </div>
          <div>
            <label className="text-slate-500 mb-1 block">Type</label>
            <select value={form.type} onChange={e => set('type', e.target.value)}
              className="w-full bg-slate-800 rounded-lg px-2 py-1.5 text-slate-200 border border-slate-700 text-[11px]">
              <option value="fournisseur">Fournisseur</option>
              <option value="client">Client</option>
              <option value="banque">Banque</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-slate-500 mb-1 block">Nom</label>
            <input value={form.nom} onChange={e => set('nom', e.target.value)}
              className="w-full bg-slate-800 rounded-lg px-2 py-1.5 text-slate-200 border border-slate-700 text-[11px]" />
          </div>
          <div className="col-span-2">
            <label className="text-slate-500 mb-1 block">Matricule Fiscal</label>
            <input value={form.mf} onChange={e => set('mf', e.target.value)}
              className="w-full bg-slate-800 rounded-lg px-2 py-1.5 text-slate-200 border border-slate-700 font-mono text-[11px]" />
          </div>
          <div>
            <label className="text-slate-500 mb-1 block">Catégorie</label>
            <input value={form.categorie} onChange={e => set('categorie', e.target.value)}
              className="w-full bg-slate-800 rounded-lg px-2 py-1.5 text-slate-200 border border-slate-700 text-[11px]" />
          </div>
          <div>
            <label className="text-slate-500 mb-1 block">TVA %</label>
            <input type="number" value={form.tva} onChange={e => set('tva', parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-800 rounded-lg px-2 py-1.5 text-slate-200 border border-slate-700 text-[11px]" />
          </div>
        </div>

        <div className="text-[10px] font-bold text-slate-400 mt-2 mb-1">Comptes par défaut</div>
        <div className="grid grid-cols-3 gap-2 text-[10px]">
          <div>
            <label className="text-slate-500 mb-1 block">Charge</label>
            <AccountSelect value={form.comptes_defaut.charge} onChange={v => setCompte('charge', v)} />
          </div>
          <div>
            <label className="text-slate-500 mb-1 block">Tiers</label>
            <AccountSelect value={form.comptes_defaut.tiers} onChange={v => setCompte('tiers', v)} />
          </div>
          <div>
            <label className="text-slate-500 mb-1 block">TVA</label>
            <AccountSelect value={form.comptes_defaut.tva} onChange={v => setCompte('tva', v)} />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-1">
          <label className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <input type="checkbox" checked={form.rs_applicable} onChange={e => set('rs_applicable', e.target.checked)}
              className="accent-brand-500" />
            Retenue Source applicable
          </label>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onCancel}
            className="flex-1 py-2 rounded-lg border border-slate-700 text-[10px] text-slate-400 hover:bg-slate-800 transition-colors">
            Annuler
          </button>
          <button onClick={() => onSave(form)}
            className="flex-1 py-2 rounded-lg bg-brand-600 text-white text-[10px] font-bold hover:bg-brand-500 transition-colors flex items-center justify-center gap-1">
            <Save className="w-3 h-3" /> Enregistrer
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h4 className="text-sm font-extrabold flex items-center gap-1.5 text-brand-400">
          <Search className="w-4 h-4" /> Codes Tiers
        </h4>
        <button onClick={onClose} className="text-[10px] text-slate-500 hover:text-slate-300 underline">✕ Fermer</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 text-[10px]">
        <button onClick={() => setTab('tiers')}
          className={`flex-1 py-2 rounded-xl font-bold transition-colors ${tab === 'tiers' ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30' : 'bg-slate-800/50 text-slate-500 border border-transparent hover:text-slate-300'}`}>
          Tiers
        </button>
        <button onClick={() => setTab('pcg')}
          className={`flex-1 py-2 rounded-xl font-bold transition-colors ${tab === 'pcg' ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30' : 'bg-slate-800/50 text-slate-500 border border-transparent hover:text-slate-300'}`}>
          Comptes PCG
        </button>
      </div>

      {tab === 'tiers' ? (
        <>
          <div className="flex gap-2 text-[10px]">
            <div className="flex-1 relative">
              <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher par code, nom ou MF..."
                className="w-full bg-slate-900 rounded-xl pl-7 pr-3 py-2 text-slate-200 border border-slate-800 text-[10px]" />
            </div>
            <select value={filter} onChange={e => setFilter(e.target.value)}
              className="bg-slate-900 rounded-xl px-3 py-2 text-slate-200 border border-slate-800 text-[10px]">
              <option value="fournisseur">Fournisseurs</option>
              <option value="client">Clients</option>
              <option value="banque">Banques</option>
              <option value="all">Tous</option>
            </select>
            <button onClick={handleAdd}
              className="px-3 py-2 rounded-xl bg-brand-600 text-white text-[10px] font-bold hover:bg-brand-500 transition-colors flex items-center gap-1 whitespace-nowrap">
              <Plus className="w-3 h-3" /> Nouveau
            </button>
          </div>

          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {editing?._isNew && (
              <div className="p-0.5">
                <EditableRow tier={editing} onSave={handleSave} onCancel={() => setEditing(null)} />
              </div>
            )}
            {filtered.length === 0 && !editing?._isNew && (
              <p className="text-[10px] text-slate-500 text-center py-6">Aucun tiers trouvé</p>
            )}
            {filtered.map(t => (
              <div key={t.code}>
                {editing && editing.code === t.code ? (
                  <EditableRow tier={editing} onSave={handleSave} onCancel={() => setEditing(null)} />
                ) : (
                  <div onClick={() => setExpanded(expanded === t.code ? null : t.code)}
                    className="flex items-center justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-brand-400 text-[11px] font-bold w-14">{t.code}</span>
                      <div>
                        <span className="text-slate-200 text-[11px] font-medium">{t.nom}</span>
                        <span className="text-[9px] text-slate-500 ml-2">
                          {t.type === 'fournisseur' ? 'Fournisseur' : t.type === 'client' ? 'Client' : 'Banque'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {t.mf && <span className="text-[9px] font-mono text-slate-600">{t.mf}</span>}
                      <button onClick={e => { e.stopPropagation(); setEditing({ ...t }); }}
                        className="text-[10px] text-slate-500 hover:text-brand-400 transition-colors">✎</button>
                      <button onClick={e => { e.stopPropagation(); handleRemove(t.code); }}
                        className="text-[10px] text-slate-500 hover:text-danger-400 transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                      {expanded === t.code ? <ChevronUp className="w-3 h-3 text-slate-600" /> : <ChevronDown className="w-3 h-3 text-slate-600" />}
                    </div>
                  </div>
                )}
                {expanded === t.code && !editing && (
                  <div className="p-2.5 bg-slate-900/50 rounded-b-xl border-x border-b border-slate-800 -mt-1 text-[10px]">
                    <div className="grid grid-cols-2 gap-2 text-slate-400">
                      {t.comptes_defaut?.charge && <div>Charge : <span className="font-mono text-slate-300">{t.comptes_defaut.charge}</span></div>}
                      {t.comptes_defaut?.tiers && <div>Tiers : <span className="font-mono text-slate-300">{t.comptes_defaut.tiers}</span></div>}
                      {t.comptes_defaut?.tva && <div>TVA : <span className="font-mono text-slate-300">{t.comptes_defaut.tva}</span></div>}
                      <div>TVA {t.tva}%{t.rs_applicable ? ' • RS applicable' : ''}</div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <PcgBrowser />
      )}
    </div>
  );
}
