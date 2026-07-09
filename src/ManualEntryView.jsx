import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Save, BookOpen, Paperclip, AlertCircle, Search } from 'lucide-react';
import { saveSimpleEntry } from './utils/pieceComptable';
import { storeDocument } from './utils/docStore';
import { getJournalKey } from './utils/journalKey';
import { PCG_COMPLET as PCG_COMPTES } from './utils/pcgComplet';
import AccountSelect from './components/AccountSelect';
import TiersManager from './components/TiersManager';

const PCG_LIBELLES = {
  '401000': 'Achat fournisseur',
  '411000': 'Vente client',
  '512000': 'Opération bancaire',
  '530000': 'Opération caisse',
  '601000': 'Achat marchandises',
  '602000': 'Achat matières premières',
  '604000': 'Prestation de services reçue',
  '606000': 'Achat non stocké',
  '607000': 'Achat marchandises revendues',
  '611000': 'Sous-traitance',
  '613000': 'Loyer',
  '614000': 'Charges locatives',
  '616000': "Prime d'assurance",
  '622200': 'Honoraires',
  '623000': 'Publicité et communication',
  '624000': 'Frais de transport',
  '626000': 'Frais télécom et postaux',
  '627000': 'Frais bancaires',
  '640000': 'Charges de personnel',
  '645000': 'Cotisations CNSS',
  '681000': 'Dotation aux amortissements',
  '700000': 'Vente de marchandises',
  '706000': 'Prestations de services',
  '708000': 'Autres produits',
  '445000': 'TVA collectée',
  '44550':  'TVA déductible',
  '43666':  'TVA sur autres biens et services',
  '43671':  'TVA collectée',
  '43674':  'Retenue à la source',
};

const LIBELLES_FIXES = [
  'Achat marchandises',
  'Vente client',
  'Règlement fournisseur',
  'Encaissement client',
  'Loyer mensuel',
  'Salaires du mois',
  'Cotisations CNSS',
  'TVA à décaisser',
  'Remboursement emprunt',
  'Dotation amortissement',
  'Régularisation fin de mois',
  'Avoir client',
  'Note de crédit fournisseur',
  'Frais bancaires',
  'Retenue à la source',
];

const EMPTY_LINE = { compte: '', libelle: '', debit: '', credit: '' };

const JOURNAL_TEMPLATES = {
  OD: [
    { compte: '', side: 'debit' },
    { compte: '', side: 'credit' },
  ],
  ACH: [
    { compte: '601000', side: 'debit' },
    { compte: '401000', side: 'credit' },
  ],
  VNT: [
    { compte: '411000', side: 'debit' },
    { compte: '700000', side: 'credit' },
  ],
  BQ: [
    { compte: '512000', side: 'debit' },
  ],
  CAI: [
    { compte: '530000', side: 'debit' },
  ],
  AN: [
    { compte: '101000', side: 'credit' },
    { compte: '201000', side: 'debit' },
  ],
  INV: [
    { compte: '310000', side: 'debit' },
    { compte: '603000', side: 'credit' },
  ],
};


export default function ManualEntryView({ formatCurrency }) {
  const [showTiersManager, setShowTiersManager] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [numeroPiece, setNumeroPiece] = useState(`OD-${Date.now()}`);
  const [journal, setJournal] = useState('OD');
  const [lines, setLines] = useState([{ ...EMPTY_LINE }]);
  const [saved, setSaved] = useState(false);
  const [libelleSuggestions, setLibelleSuggestions] = useState([]);
  const [docFile, setDocFile] = useState(null);
  const [docName, setDocName] = useState('');

  const [errors, setErrors] = useState({});
  const compteRefs = useRef([]);
  const addLineRef = useRef(null);
  const prevJournalRef = useRef(journal);

  // Appliquer le template de comptes à chaque changement de journal
  useEffect(() => {
    if (prevJournalRef.current === journal) return;
    prevJournalRef.current = journal;
    const tpl = JOURNAL_TEMPLATES[journal];
    if (!tpl || !tpl.some(t => t.compte)) {
      setLines([{ ...EMPTY_LINE }]);
      return;
    }
    setLines(tpl.map(t => ({ compte: t.compte, libelle: findLibelle(t.compte), debit: t.side === 'debit' ? '' : '', credit: t.side === 'credit' ? '' : '' })));
    setTimeout(() => { if (compteRefs.current[0]?.current) compteRefs.current[0].current.focus(); }, 50);
  }, [journal]);

  const addLine = () => {
    setLines(prev => [...prev, { ...EMPTY_LINE }]);
    setTimeout(() => {
      const idx = compteRefs.current.length - 1;
      if (compteRefs.current[idx]?.current) compteRefs.current[idx].current.focus();
    }, 50);
  };

  useEffect(() => { addLineRef.current = addLine; }, [addLine]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('manual-entry-form')?.requestSubmit();
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyL' && e.shiftKey) {
        e.preventDefault();
        addLineRef.current?.();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Insert') {
        e.preventDefault();
        addLineRef.current?.();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Delete') {
        e.preventDefault();
        setLines(prev => prev.length > 1 ? prev.slice(0, -1) : prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Auto-focus first line compte on mount
  useEffect(() => {
    if (compteRefs.current[0]?.current) compteRefs.current[0].current.focus();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(getJournalKey());
      if (!raw) return;
      const entries = JSON.parse(raw);
      if (!Array.isArray(entries)) return;
      const libelles = new Set();
      entries.forEach(e => {
        if (e.libelle && e.libelle.trim()) libelles.add(e.libelle.trim());
      });
      const merged = [...new Set([...libelles, ...LIBELLES_FIXES])].sort();
      setLibelleSuggestions(merged);
    } catch {
      setLibelleSuggestions(LIBELLES_FIXES);
    }
  }, []);

  const removeLine = (i) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, idx) => idx !== i));
  };

  const findLibelle = (code) => {
    if (!code) return '';
    const exact = PCG_LIBELLES[code] || PCG_COMPTES[code];
    if (exact) return exact;
    const keys = Object.keys(PCG_COMPTES);
    const byPrefix = keys.filter(k => code.startsWith(k)).sort((a, b) => b.length - a.length);
    if (byPrefix.length > 0) return PCG_COMPTES[byPrefix[0]];
    const bySuffix = keys.filter(k => k.startsWith(code)).sort((a, b) => a.length - b.length);
    if (bySuffix.length > 0) return PCG_COMPTES[bySuffix[0]];
    return '';
  };

  const updateLine = (i, field, value) => {
    setLines(prev => prev.map((line, idx) => {
      if (idx !== i) return line;
      const updated = { ...line, [field]: value };
      if (field === 'compte' && value) {
        const lib = findLibelle(value);
        if (lib) updated.libelle = lib;
      }
      return updated;
    }));
  };

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const equilibre = Math.abs(totalDebit - totalCredit) < 0.01;
  const diff = totalDebit - totalCredit;

  const autoBalance = () => {
    if (equilibre || !diff) return;
    const amount = Math.abs(diff).toFixed(3);
    if (diff > 0) {
      // plus de débit → ajouter une ligne au crédit
      setLines(prev => [...prev, { compte: '', libelle: '', debit: '', credit: amount }]);
    } else {
      // plus de crédit → ajouter une ligne au débit
      setLines(prev => [...prev, { compte: '', libelle: '', debit: amount, credit: '' }]);
    }
    setTimeout(() => {
      const idx = compteRefs.current.length - 1;
      if (compteRefs.current[idx]?.current) compteRefs.current[idx].current.focus();
    }, 50);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = {};
    const validLines = lines.filter(l => l.compte.trim() && (parseFloat(l.debit) || parseFloat(l.credit)));
    if (validLines.length === 0) {
      errs.empty = 'Ajoutez au moins une ligne avec un compte et un montant.';
    }
    if (!equilibre && validLines.length > 0) {
      errs.balance = 'Le montant total des débits doit être égal au total des crédits.';
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    validLines.forEach(l => {
      saveSimpleEntry({
        date,
        numeroPiece,
        piece_justificative: docName || numeroPiece,
        compte: l.compte.trim(),
        libelle: l.libelle.trim() || `Pièce ${numeroPiece}`,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
        journal,
      });
    });
    if (docFile) {
      storeDocument(numeroPiece, docFile);
    }
    setSaved(true);
    setLines([{ ...EMPTY_LINE }]);
    setNumeroPiece(`OD-${Date.now()}`);
    setDocFile(null);
    setDocName('');
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="glass-card rounded-2xl border border-slate-800 p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-brand-400" />
            <h3 className="text-sm font-bold text-slate-200">Nouvelle écriture manuelle</h3>
          </div>
          <button onClick={() => setShowTiersManager(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-[10px] text-slate-400 hover:text-brand-400 hover:border-brand-500/30 transition-colors">
            <Search className="w-3 h-3" /> Codes Tiers / PCG
          </button>
        </div>
        <form id="manual-entry-form" onSubmit={handleSubmit} className="space-y-4">
          {/* Infos générales */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">N° Pièce</label>
              <input type="text" value={numeroPiece} onChange={e => setNumeroPiece(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">Journal</label>
              <select value={journal} onChange={e => setJournal(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500">
                <option value="OD">Opérations Diverses</option>
                <option value="ACH">Achats</option>
                <option value="VNT">Ventes</option>
                <option value="BQ">Banque</option>
                <option value="CAI">Caisse</option>
                <option value="AN">À Nouveau</option>
                <option value="INV">Inventaire</option>
              </select>
            </div>
          </div>

          {/* Lignes d'écriture */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 font-bold uppercase">Lignes d'écriture</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={addLine}
                  className="flex items-center gap-1 text-[10px] text-brand-400 hover:text-brand-300">
                  <Plus className="w-3 h-3" /> Ajouter une ligne
                </button>
                <span className="text-[9px] text-slate-600 hidden sm:inline">Ctrl+Shift+L</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="py-2 pr-2">Compte</th>
                    <th className="py-2 px-2">Libellé</th>
                    <th className="py-2 px-2 text-right w-28">Débit</th>
                    <th className="py-2 px-2 text-right w-28">Crédit</th>
                    <th className="py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-xs">
                  {lines.map((l, i) => {
                    if (!compteRefs.current[i]) compteRefs.current[i] = React.createRef();
                    return (
                    <tr key={i}>
                      <td className="py-1.5 pr-2 min-w-[180px]">
                        <AccountSelect value={l.compte} inputRef={compteRefs.current[i]}
                          onChange={(code, lib) => updateLine(i, 'compte', code)}
                          placeholder="ex: 401000" />
                      </td>
                      <td className="py-1.5 px-2">
                        <input type="text" value={l.libelle} onChange={e => updateLine(i, 'libelle', e.target.value)}
                          placeholder="Libellé" list={`libelles-list-${i}`}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-brand-500" />
                        <datalist id={`libelles-list-${i}`}>
                          {libelleSuggestions.map((s, si) => (
                            <option key={si} value={s} />
                          ))}
                        </datalist>
                      </td>
                      <td className="py-1.5 px-2">
                        <input type="number" step="0.001" value={l.debit} onChange={e => updateLine(i, 'debit', e.target.value)}
                          placeholder="0.000"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-right text-slate-300 focus:outline-none focus:border-brand-500 font-mono" />
                      </td>
                      <td className="py-1.5 px-2">
                        <input type="number" step="0.001" value={l.credit} onChange={e => updateLine(i, 'credit', e.target.value)}
                          placeholder="0.000"
                          onKeyDown={e => { if ((e.key === 'Tab' || e.key === 'Enter') && i === lines.length - 1) { e.preventDefault(); addLine(); } }}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-right text-slate-300 focus:outline-none focus:border-brand-500 font-mono" />
                      </td>
                      <td className="py-1.5 pl-2">
                        <button type="button" onClick={() => removeLine(i)}
                          className="text-slate-600 hover:text-danger-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>

          {/* Pièce justificative */}
          <div className="flex items-center gap-3">
            <Paperclip className="w-3.5 h-3.5 text-slate-500" />
            <label className="text-[10px] text-slate-500 font-bold uppercase cursor-pointer flex items-center gap-2">
              <span>Pièce justificative (PNG/PDF)</span>
              <input type="file" accept="image/png,application/pdf,image/jpeg" className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setDocName(file.name.replace(/\.[^.]+$/, ''));
                  const reader = new FileReader();
                  reader.onloadend = () => setDocFile(reader.result);
                  reader.readAsDataURL(file);
                }} />
              <span className="text-brand-400 text-[10px] underline">Parcourir</span>
            </label>
            {docFile && (
              <span className="text-[10px] text-accent-400">{docName}</span>
            )}
          </div>

          {/* Totaux et soumission */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/50">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span>Total Débit: <strong className="text-danger-400">{formatCurrency(totalDebit)}</strong></span>
              <span>Total Crédit: <strong className="text-accent-400">{formatCurrency(totalCredit)}</strong></span>
              <span className={equilibre ? 'text-accent-400' : 'text-danger-400'}>
                {equilibre ? '✓ Équilibré' : '✗ Déséquilibré'}
              </span>
              {!equilibre && totalDebit + totalCredit > 0 && (
                <button type="button" onClick={autoBalance}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 hover:text-brand-300 hover:border-brand-500/30 transition-colors">
                  + Auto-balancer ({formatCurrency(Math.abs(diff))} en {diff > 0 ? 'Crédit' : 'Débit'})
                </button>
              )}
            </div>
            <button type="submit"
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-400 text-white text-xs font-bold rounded-xl transition-colors shadow-glow">
              <Save className="w-3.5 h-3.5" /> Enregistrer <span className="text-[9px] text-white/50 hidden sm:inline ml-1">Ctrl+Enter</span>
            </button>
          </div>
        </form>
        {saved && (
          <div className="text-[11px] text-accent-400 font-medium animate-fade-in">
            ✓ Écriture(s) enregistrée(s) avec succès dans le journal {journal}.
          </div>
        )}
        {errors.empty && (
          <div className="text-[11px] text-danger-400 font-medium animate-fade-in flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {errors.empty}
          </div>
        )}
        {errors.balance && (
          <div className="text-[11px] text-danger-400 font-medium animate-fade-in flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {errors.balance}
          </div>
        )}
      </div>

      {showTiersManager && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl p-5 max-h-[80vh] overflow-y-auto">
            <TiersManager onClose={() => setShowTiersManager(false)} />
          </div>
        </div>
      )}

    </div>
  );
}