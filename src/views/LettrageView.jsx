import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Upload, Trash2, CheckCheck, X, Search, RefreshCw, AlertCircle, CheckCircle2, FileText, ArrowUpDown } from 'lucide-react';
import { getEcritures, addEcritures, clearEcritures, saveLettrage, deletrage, getEcrituresByCompte, getNonLettreCount } from '../utils/ecrituresStore';
import { initSeedData, genererProchaineLettre, calculerLettrageAuto, validerImportExcel } from '../utils/lettrageUtils';

const TOLERANCE = 0.001;

export default function LettrageView({ companyId } = {}) {
  const [comptes, setComptes] = useState([]);
  const [compteActif, setCompteActif] = useState('');
  const [ecritures, setEcritures] = useState([]);
  const [selection, setSelection] = useState(new Set());
  const [filtre, setFiltre] = useState('toutes');
  const [search, setSearch] = useState('');
  const [tri, setTri] = useState({ col: 'date', asc: true });
  const [showImport, setShowImport] = useState(false);
  const [importResultats, setImportResultats] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [nonLettreCount, setNonLettreCount] = useState(0);
  const [confirmAction, setConfirmAction] = useState(null);
  const fileRef = useRef(null);

  // Seed data au premier chargement
  useEffect(() => {
    const seeded = initSeedData();
    if (seeded) setMsg({ type: 'success', text: 'Exemples de test chargés : FAC001/REG001 (411001), FAC010/REG010 (411002), FF001/REGF001 (401001)' });
  }, []);

  const rafraichir = useCallback(() => {
    const list = getEcritures();
    const map = {};
    for (const e of list) {
      const c = e.compte.trim();
      if (!map[c]) map[c] = { compte: c, nbNonLettre: 0, nbTotal: 0, solde: 0 };
      map[c].nbTotal++;
      if (!e.lettre) { map[c].nbNonLettre++; map[c].solde += (e.debit || 0) - (e.credit || 0); }
    }
    setComptes(Object.values(map).sort((a, b) => a.compte.localeCompare(b.compte)));
    if (compteActif) setEcritures(getEcrituresByCompte(compteActif));
    setNonLettreCount(list.filter(e => !e.lettre).length);
  }, [compteActif]);

  useEffect(() => { rafraichir(); }, [compteActif]);
  useEffect(() => { rafraichir(); /* eslint-disable-line */ }, []);

  // Filtrer + trier
  const ecrituresFiltered = useMemo(() => {
    let list = ecritures;
    if (filtre === 'lettrees') list = list.filter(e => e.lettre);
    if (filtre === 'non_lettrees') list = list.filter(e => !e.lettre);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e => (e.libelle || '').toLowerCase().includes(q) || (e.piece || '').toLowerCase().includes(q));
    }
    list = [...list].sort((a, b) => {
      let va = a[tri.col], vb = b[tri.col];
      if (tri.col === 'debit' || tri.col === 'credit') { va = va || 0; vb = vb || 0; }
      else if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
      return (va < vb ? -1 : va > vb ? 1 : 0) * (tri.asc ? 1 : -1);
    });
    return list;
  }, [ecritures, filtre, search, tri]);

  const statsSelection = useMemo(() => {
    const sel = [...selection].map(id => ecritures.find(e => e.id === id)).filter(Boolean);
    const totalDebit = sel.reduce((s, e) => s + (e.debit || 0), 0);
    const totalCredit = sel.reduce((s, e) => s + (e.credit || 0), 0);
    const ecart = Math.abs(totalDebit - totalCredit);
    const hasDebit = sel.some(e => (e.debit || 0) > 0);
    const hasCredit = sel.some(e => (e.credit || 0) > 0);
    return { totalDebit, totalCredit, ecart, ok: ecart <= TOLERANCE, hasDebit, hasCredit, nb: sel.length };
  }, [selection, ecritures]);

  const toggleSelection = (id) => {
    const e = ecritures.find(x => x.id === id);
    if (!e || e.lettre) return;
    setSelection(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const handleValiderLettrage = () => {
    const ids = [...selection];
    if (ids.length < 2 || !statsSelection.ok || !statsSelection.hasDebit || !statsSelection.hasCredit) return;
    const lettre = genererProchaineLettre(compteActif, ecritures);
    saveLettrage(ids, lettre);
    setSelection(new Set());
    setMsg({ type: 'success', text: `Lettrage ${lettre} effectué avec succès (${ids.length} écritures)` });
    rafraichir();
  };

  const handleDelettrage = (lettre, ids) => {
    setConfirmAction({
      title: 'Délettrer le groupe ' + lettre,
      message: `Cela supprimera le lettrage de ${ids.length} écriture(s). Continuer ?`,
      onConfirm: () => {
        deletrage(lettre);
        setMsg({ type: 'success', text: `Lettrage ${lettre} annulé (${ids.length} écritures délettrées)` });
        setConfirmAction(null);
        rafraichir();
      },
    });
  };

  // ── Import Excel ──
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setImportResultats(null);
    try {
      const resultats = await validerImportExcel(file);
      setImportResultats(resultats);
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
    setImportLoading(false);
    e.target.value = '';
  };

  const handleValiderImport = () => {
    if (!importResultats) return;
    const valides = importResultats.filter(r => r.valid).map(r => ({
      journal: r.journal, date: r.date, piece: r.piece, compte: r.compte,
      libelle: r.libelle, debit: r.debit, credit: r.credit,
    }));
    const { ajoutés, doublons } = addEcritures(valides);
    const nbErrors = importResultats.filter(r => !r.valid).length;
    setMsg({ type: 'success', text: `${ajoutés} écritures importées${doublons ? ', ' + doublons + ' doublons ignorés' : ''}${nbErrors ? ', ' + nbErrors + ' erreurs' : ''}` });
    setImportResultats(null);
    setShowImport(false);
    rafraichir();
  };

  // ── Auto-lettrage ──
  const handleAutoLettrage = () => {
    const list = getEcritures();
    const { paires, restantes } = calculerLettrageAuto(list, compteActif);
    if (paires.length === 0) {
      setMsg({ type: 'error', text: 'Aucune paire exacte trouvée' });
      return;
    }
    setConfirmAction({
      title: `Lettrage automatique : ${paires.length} paire(s) trouvée(s)`,
      message: paires.map(p => `${p.debit.piece} (${p.debit.debit.toFixed(3)} DT) ↔ ${p.credit.piece} (${p.credit.credit.toFixed(3)} DT)`).join('\n') +
        (restantes.length > 0 ? `\n\n⚠ ${restantes.length} écriture(s) laissée(s) en attente (ambiguïté ou sans correspondance)` : ''),
      confirmLabel: 'Appliquer',
      onConfirm: () => {
        for (const p of paires) {
          const lettre = genererProchaineLettre(compteActif, getEcritures());
          saveLettrage(p.ids, lettre);
        }
        setMsg({ type: 'success', text: `${paires.length} paires lettrées automatiquement${restantes.length ? ', ' + restantes.length + ' écritures laissées en attente' : ''}` });
        setConfirmAction(null);
        rafraichir();
      },
    });
  };

  // ── Reset ──
  const handleReset = () => {
    setConfirmAction({
      title: 'Réinitialiser les écritures',
      message: 'Cela supprimera TOUTES les écritures et leur lettrage. Les exemples de test seront rechargés automatiquement. Continuer ?',
      confirmLabel: 'Tout réinitialiser',
      onConfirm: () => {
        localStorage.removeItem('smart_comptable_ecritures_seeded');
        clearEcritures();
        initSeedData();
        setSelection(new Set());
        setCompteActif('');
        setConfirmAction(null);
        setMsg({ type: 'success', text: 'Écritures réinitialisées — exemples de test rechargés' });
        rafraichir();
      },
    });
  };

  // Nom de compte lisible
  const libelleCompte = (c) => {
    const map = { '411001': 'Client ABC', '411002': 'Client XYZ', '401001': 'Fournisseur DEF' };
    return map[c];
  };

  const btnBase = 'px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2';

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Lettrage des comptes</h2>
          <p className="text-sm text-slate-400">{nonLettreCount} écriture{nonLettreCount !== 1 ? 's' : ''} non lettrée{nonLettreCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowImport(!showImport)} className={`${btnBase} bg-indigo-600 hover:bg-indigo-500 text-white`}>
            <Upload className="w-4 h-4" /> Importer écritures
          </button>
          <button onClick={handleReset} className={`${btnBase} bg-red-600/20 hover:bg-red-600/30 text-red-400`}>
            <Trash2 className="w-4 h-4" /> Réinitialiser
          </button>
        </div>
      </div>

      {/* Message flash */}
      {msg && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border ${msg.type === 'success' ? 'bg-emerald-900/20 border-emerald-800/30 text-emerald-400' : 'bg-red-900/20 border-red-800/30 text-red-400'}`}>
          {msg.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
          <span className="text-sm flex-1">{msg.text}</span>
          <button onClick={() => setMsg(null)} className="shrink-0"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Panel import */}
      {showImport && (
        <div className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50 space-y-4">
          <h3 className="text-lg font-semibold text-slate-200">Importer un fichier Excel</h3>
          <p className="text-sm text-slate-400">Colonnes attendues dans cet ordre : Journal | Date | N° Pièce | Compte | Libellé | Débit | Crédit</p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer" />
          {importLoading && <p className="text-sm text-slate-400">Analyse du fichier...</p>}
          {importResultats && (
            <div className="space-y-3">
              <p className="text-sm">{importResultats.filter(r => r.valid).length} lignes valides, {importResultats.filter(r => !r.valid).length} erreurs</p>
              <div className="overflow-x-auto max-h-64 rounded-xl border border-slate-700/50">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-800 text-slate-400 sticky top-0">
                    <tr><th className="p-2 w-8">#</th><th className="p-2">Journal</th><th className="p-2">Date</th><th className="p-2">Pièce</th><th className="p-2">Compte</th><th className="p-2">Libellé</th><th className="p-2 text-right">Débit</th><th className="p-2 text-right">Crédit</th><th className="p-2 w-12">Statut</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {importResultats.map((r, i) => (
                      <tr key={i} className={`${r.valid ? 'hover:bg-slate-700/30' : 'bg-red-900/10'} text-slate-300`}>
                        <td className="p-2 text-slate-500">{r.ligne}</td>
                        <td className="p-2">{r.journal}</td>
                        <td className="p-2">{r.date || '?'}</td>
                        <td className="p-2">{r.piece}</td>
                        <td className="p-2 font-mono">{r.compte}</td>
                        <td className="p-2 max-w-[120px] truncate">{r.libelle}</td>
                        <td className="p-2 text-right font-mono">{r.debit || ''}</td>
                        <td className="p-2 text-right font-mono">{r.credit || ''}</td>
                        <td className="p-2 text-center">{r.valid ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" /> : <X className="w-4 h-4 text-red-500 mx-auto" />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={handleValiderImport} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl text-sm font-medium transition">Valider l'import</button>
                <button onClick={() => { setImportResultats(null); }} className="bg-slate-700/50 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-sm transition">Annuler</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sélection compte */}
      <div className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50 space-y-3">
        <label className="text-sm font-medium text-slate-300">Sélectionner un compte</label>
        <select value={compteActif} onChange={e => { setCompteActif(e.target.value); setSelection(new Set()); }} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
          <option value="">— Choisir un compte —</option>
          {comptes.map(c => (
            <option key={c.compte} value={c.compte}>
              {c.compte}{libelleCompte(c.compte) ? ' — ' + libelleCompte(c.compte) : ''} ({c.nbNonLettre}/{c.nbTotal} non lettrées, solde: {c.solde.toFixed(3)} DT)
            </option>
          ))}
        </select>
      </div>

      {/* Tableau */}
      {compteActif && (
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 overflow-hidden">
          {/* Filtres */}
          <div className="flex flex-wrap items-center gap-3 p-4 border-b border-slate-700/50 bg-slate-800/40">
            <div className="flex gap-1 bg-slate-800 rounded-xl p-1">
              {[
                { id: 'toutes', label: 'Toutes' },
                { id: 'non_lettrees', label: 'Non lettrées' },
                { id: 'lettrees', label: 'Lettrées' },
              ].map(f => (
                <button key={f.id} onClick={() => setFiltre(f.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filtre === f.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>{f.label}</button>
              ))}
            </div>
            <div className="relative flex-1 min-w-[150px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input type="text" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
            </div>
            <button onClick={handleAutoLettrage} disabled={!ecritures.some(e => !e.lettre)} className={`${btnBase} bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 disabled:opacity-40 disabled:cursor-not-allowed`}>
              <RefreshCw className="w-4 h-4" /> Lettrage auto
            </button>
          </div>

          {/* Tableau */}
          <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 520px)' }}>
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-800 text-slate-400 text-xs uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="p-3 w-8"></th>
                  {[
                    { key: 'date', label: 'Date' },
                    { key: 'piece', label: 'Pièce' },
                    { key: 'journal', label: 'Journal' },
                    { key: 'libelle', label: 'Libellé' },
                    { key: 'debit', label: 'Débit' },
                    { key: 'credit', label: 'Crédit' },
                  ].map(col => (
                    <th key={col.key} className="p-3 cursor-pointer hover:text-slate-200 select-none" onClick={() => setTri(prev => ({ col: col.key, asc: prev.col === col.key ? !prev.asc : true }))}>
                      <span className="inline-flex items-center gap-1">{col.label} <ArrowUpDown className={`w-3 h-3 ${tri.col === col.key ? 'text-indigo-400' : 'text-slate-600'}`} /></span>
                    </th>
                  ))}
                  <th className="p-3 w-16 text-center">Lettre</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {ecrituresFiltered.map(e => {
                  const isSelected = selection.has(e.id);
                  const isLettrée = !!e.lettre;
                  return (
                    <tr key={e.id}
                      className={`transition-colors ${isLettrée ? 'bg-emerald-900/15 text-slate-400' : isSelected ? 'bg-amber-500/10 text-slate-200' : 'hover:bg-slate-700/30 text-slate-300'}`}
                      onClick={() => !isLettrée && toggleSelection(e.id)}>
                      <td className="p-3"><input type="checkbox" checked={isSelected} disabled={isLettrée} readOnly className="rounded border-slate-600 text-indigo-500 focus:ring-indigo-500/50" onClick={e => e.stopPropagation()} /></td>
                      <td className="p-3 whitespace-nowrap">{e.date}</td>
                      <td className="p-3 font-mono text-xs">{e.piece}</td>
                      <td className="p-3">{e.journal}</td>
                      <td className="p-3 max-w-[180px] truncate" title={e.libelle}>{e.libelle}</td>
                      <td className="p-3 text-right font-mono">{e.debit ? e.debit.toFixed(3) : ''}</td>
                      <td className="p-3 text-right font-mono">{e.credit ? e.credit.toFixed(3) : ''}</td>
                      <td className="p-3 text-center">{e.lettre ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600/20 text-indigo-400 text-xs font-bold">{e.lettre}</span> : <span className="text-slate-600">—</span>}</td>
                      <td className="p-3 text-center">
                        {e.lettre && (
                          <button onClick={e => { e.stopPropagation(); const ids = ecritures.filter(x => x.lettre === e.target.lettre).map(x => x.id); handleDelettrage(e.target.lettre, ids); }} className="text-slate-500 hover:text-red-400 transition" title="Délettrer">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {ecrituresFiltered.length === 0 && (
                  <tr><td colSpan={9} className="p-12 text-center text-slate-500">Aucune écriture trouvée</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Barre sélection (sticky) */}
          <div className="sticky bottom-0 bg-slate-800/95 backdrop-blur border-t border-slate-700/50 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="text-slate-400">{statsSelection.nb} ligne{statsSelection.nb !== 1 ? 's' : ''}</span>
              <span className="text-slate-400">Débit: <span className="text-slate-200 font-mono font-bold">{statsSelection.totalDebit.toFixed(3)}</span></span>
              <span className="text-slate-400">Crédit: <span className="text-slate-200 font-mono font-bold">{statsSelection.totalCredit.toFixed(3)}</span></span>
              <span className="text-slate-400">Écart: <span className={`font-mono font-bold ${statsSelection.ok ? 'text-emerald-400' : 'text-red-400'}`}>{statsSelection.ecart.toFixed(3)}</span></span>
            </div>
            <button
              disabled={selection.size < 2 || !statsSelection.ok || !statsSelection.hasDebit || !statsSelection.hasCredit}
              onClick={handleValiderLettrage}
              className={`${btnBase} ${selection.size >= 2 && statsSelection.ok && statsSelection.hasDebit && statsSelection.hasCredit ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>
              <CheckCheck className="w-4 h-4" /> Lettrer la sélection
            </button>
          </div>
        </div>
      )}

      {/* Modal confirmation */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setConfirmAction(null)}>
          <div className="bg-slate-800 rounded-2xl border border-slate-700 max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-200">{confirmAction.title}</h3>
            <p className="text-sm text-slate-400 whitespace-pre-wrap">{confirmAction.message}</p>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setConfirmAction(null)} className="bg-slate-700/50 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-sm transition">Annuler</button>
              <button onClick={confirmAction.onConfirm} className={`px-6 py-2 rounded-xl text-sm font-medium transition ${confirmAction.confirmLabel === 'Tout réinitialiser' ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>
                {confirmAction.confirmLabel || 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
