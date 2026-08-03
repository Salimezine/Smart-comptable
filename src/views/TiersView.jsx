import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, X, Save, Building2, Phone, MapPin, FileText, Mail, User, Check, AlertCircle } from 'lucide-react';
import { clientsStore, suppliersStore, migrateClientsFromInvoices, migrateSuppliersFromExpenses } from '../utils/erpStore';

const EMPTY_CLIENT = { nom: '', matricule_fiscal: '', adresse: '', ville: '', telephone: '', email: '', contact_nom: '', contact_telephone: '', contact_email: '', categorie: 'entreprise', regime_tva: 'normal', taux_tva_defaut: 19, mode_reglement_defaut: 'virement', delai_paiement: 30, plafond_credit: 0, notes: '', actif: true };
const EMPTY_SUPPLIER = { nom: '', matricule_fiscal: '', adresse: '', ville: '', telephone: '', email: '', contact_nom: '', contact_telephone: '', contact_email: '', categorie: 'entreprise', regime_tva: 'normal', taux_tva_defaut: 19, mode_reglement_defaut: 'virement', delai_paiement: 30, plafond_credit: 0, notes: '', actif: true };

export default function TiersView({ companyId, invoices = [], expenses = [] }) {
  const [tab, setTab] = useState('clients');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_CLIENT);
  const [list, setList] = useState([]);
  const [msg, setMsg] = useState(null);

  const store = tab === 'clients' ? clientsStore : suppliersStore;
  const emptyRecord = tab === 'clients' ? EMPTY_CLIENT : EMPTY_SUPPLIER;

  useEffect(() => {
    if (!companyId) return;
    const cid = localStorage.getItem('smart_comptable_current_id') || companyId;
    // Migration auto au premier chargement
    const migrated = localStorage.getItem(`erp_migrated_${cid}`);
    if (!migrated) {
      const nc = migrateClientsFromInvoices(cid, invoices);
      const ns = migrateSuppliersFromExpenses(cid, expenses);
      if (nc > 0 || ns > 0) setMsg({ type: 'success', text: `${nc} clients et ${ns} fournisseurs importés depuis vos données existantes` });
      localStorage.setItem(`erp_migrated_${cid}`, '1');
    }
    setList(store.getAll(cid));
  }, [companyId, tab]);

  const cid = companyId || localStorage.getItem('smart_comptable_current_id');
  const filtered = useMemo(() => {
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(r => (r.nom || '').toLowerCase().includes(q) || (r.matricule_fiscal || '').toLowerCase().includes(q) || (r.email || '').toLowerCase().includes(q));
  }, [list, search]);

  const handleSave = () => {
    if (!form.nom.trim()) { setMsg({ type: 'error', text: 'Le nom est obligatoire' }); return; }
    const record = { ...form };
    if (!record.code) record.code = store.generateCode(cid, tab === 'clients' ? 'C' : 'F');
    store.upsert(cid, record);
    setList(store.getAll(cid));
    setShowForm(false);
    setEditing(null);
    setForm(emptyRecord);
    setMsg({ type: 'success', text: `${tab === 'clients' ? 'Client' : 'Fournisseur'} enregistré` });
  };

  const handleEdit = (r) => {
    setForm({ ...r });
    setEditing(r.id);
    setShowForm(true);
  };

  const handleDelete = (id, nom) => {
    if (!window.confirm(`Supprimer ${nom} ?`)) return;
    store.delete(cid, id);
    setList(store.getAll(cid));
    setMsg({ type: 'success', text: `${nom} supprimé` });
  };

  const openNew = () => {
    setForm(emptyRecord);
    setEditing(null);
    setShowForm(true);
  };

  const btnBase = 'px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2';

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">{tab === 'clients' ? 'Clients' : 'Fournisseurs'}</h2>
          <p className="text-sm text-slate-400">{list.length} enregistrement{list.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 bg-slate-800 rounded-xl p-1">
            <button onClick={() => setTab('clients')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${tab === 'clients' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Clients</button>
            <button onClick={() => setTab('suppliers')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${tab === 'suppliers' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Fournisseurs</button>
          </div>
          <button onClick={openNew} className={`${btnBase} bg-indigo-600 hover:bg-indigo-500 text-white`}><Plus className="w-4 h-4" /> Nouveau</button>
        </div>
      </div>

      {msg && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border ${msg.type === 'success' ? 'bg-emerald-900/20 border-emerald-800/30 text-emerald-400' : 'bg-red-900/20 border-red-800/30 text-red-400'}`}>
          {msg.type === 'success' ? <Check className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
          <span className="text-sm flex-1">{msg.text}</span>
          <button onClick={() => setMsg(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input type="text" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
      </div>

      {/* Liste */}
      <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 400px)' }}>
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-800 text-slate-400 text-xs uppercase tracking-wider sticky top-0">
              <tr><th className="p-3">Code</th><th className="p-3">Nom</th><th className="p-3">Matricule fiscal</th><th className="p-3">Tél</th><th className="p-3">Email</th><th className="p-3">Ville</th><th className="p-3">Créé le</th><th className="p-3">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-slate-700/30 text-slate-300">
                  <td className="p-3 font-mono text-xs text-indigo-400">{r.code || '—'}</td>
                  <td className="p-3 font-medium">{r.nom}</td>
                  <td className="p-3 font-mono text-xs">{r.matricule_fiscal || '—'}</td>
                  <td className="p-3">{r.telephone || '—'}</td>
                  <td className="p-3 text-xs">{r.email || '—'}</td>
                  <td className="p-3">{r.ville || '—'}</td>
                  <td className="p-3 text-xs text-slate-500">{r.created_at ? r.created_at.slice(0, 10) : '—'}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(r)} className="text-indigo-400 hover:text-indigo-300 transition text-xs"><FileText className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(r.id, r.nom)} className="text-red-400 hover:text-red-300 transition text-xs"><X className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="p-12 text-center text-slate-500">Aucun enregistrement</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-slate-800 rounded-2xl border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-200">{editing ? 'Modifier' : 'Nouveau'} {tab === 'clients' ? 'client' : 'fournisseur'}</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-slate-300"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-400 mb-1">Nom *</label>
                <input value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Matricule fiscal</label>
                <input value={form.matricule_fiscal} onChange={e => setForm({ ...form, matricule_fiscal: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Téléphone</label>
                <input value={form.telephone} onChange={e => setForm({ ...form, telephone: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-400 mb-1">Email</label>
                <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-400 mb-1">Adresse</label>
                <input value={form.adresse} onChange={e => setForm({ ...form, adresse: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Ville</label>
                <input value={form.ville} onChange={e => setForm({ ...form, ville: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Catégorie</label>
                <select value={form.categorie} onChange={e => setForm({ ...form, categorie: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
                  <option value="entreprise">Entreprise</option>
                  <option value="professionnel">Professionnel</option>
                  <option value="particulier">Particulier</option>
                  <option value="association">Association</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Régime TVA</label>
                <select value={form.regime_tva} onChange={e => setForm({ ...form, regime_tva: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
                  <option value="normal">Normal</option><option value="simplifié">Simplifié</option><option value="suspension">Suspension</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Délai paiement (jours)</label>
                <input type="number" value={form.delai_paiement} onChange={e => setForm({ ...form, delai_paiement: parseInt(e.target.value) || 30 })} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Mode règlement</label>
                <select value={form.mode_reglement_defaut} onChange={e => setForm({ ...form, mode_reglement_defaut: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
                  <option value="virement">Virement</option><option value="cheque">Chèque</option><option value="espece">Espèces</option><option value="traite">Traite</option><option value="carte">Carte</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setShowForm(false)} className="bg-slate-700/50 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-sm transition">Annuler</button>
              <button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2"><Save className="w-4 h-4" /> Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
