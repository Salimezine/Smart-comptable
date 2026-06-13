import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, BookOpen, Paperclip, AlertCircle } from 'lucide-react';
import { saveSimpleEntry } from './utils/pieceComptable';
import { storeDocument } from './utils/docStore';
import { getJournalKey } from './utils/journalKey';
import { PCG_COMPLET as PCG_COMPTES } from './utils/pcgComplet';

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

export default function ManualEntryView({ formatCurrency }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [numeroPiece, setNumeroPiece] = useState(`OD-${Date.now()}`);
  const [journal, setJournal] = useState('OD');
  const [lines, setLines] = useState([{ ...EMPTY_LINE }]);
  const [saved, setSaved] = useState(false);
  const [libelleSuggestions, setLibelleSuggestions] = useState([]);
  const [docFile, setDocFile] = useState(null);
  const [docName, setDocName] = useState('');
  const [showPlan, setShowPlan] = useState(false);
  const [planSearch, setPlanSearch] = useState('');
  const [errors, setErrors] = useState({});

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

  const addLine = () => setLines([...lines, { ...EMPTY_LINE }]);

  const removeLine = (i) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, idx) => idx !== i));
  };

  const findLibelle = (code) => {
    if (!code) return '';
    const exact = PCG_LIBELLES[code] || PCG_COMPTES[code];
    if (exact) return exact;
    const prefix = Object.keys(PCG_COMPTES).filter(k => code.startsWith(k)).sort((a, b) => b.length - a.length)[0];
    if (prefix) return PCG_COMPTES[prefix];
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
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="w-5 h-5 text-brand-400" />
          <h3 className="text-sm font-bold text-slate-200">Nouvelle écriture manuelle</h3>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
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
                <button type="button" onClick={() => setShowPlan(true)}
                  className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-brand-300">
                  Plan comptable
                </button>
                <button type="button" onClick={addLine}
                  className="flex items-center gap-1 text-[10px] text-brand-400 hover:text-brand-300">
                  <Plus className="w-3 h-3" /> Ajouter une ligne
                </button>
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
                  {lines.map((l, i) => (
                    <tr key={i}>
                      <td className="py-1.5 pr-2">
                        <input type="text" value={l.compte} onChange={e => updateLine(i, 'compte', e.target.value)}
                          placeholder="ex: 401000 — Fournisseurs" list="comptes-list"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-brand-500 font-mono" />
                      </td>
                      <td className="py-1.5 px-2">
                        <input type="text" value={l.libelle} onChange={e => updateLine(i, 'libelle', e.target.value)}
                          placeholder="Libellé de l'écriture" list={`libelles-list-${i}`}
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
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-right text-slate-300 focus:outline-none focus:border-brand-500 font-mono" />
                      </td>
                      <td className="py-1.5 pl-2">
                        <button type="button" onClick={() => removeLine(i)}
                          className="text-slate-600 hover:text-danger-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <datalist id="comptes-list">
              {Object.entries(PCG_COMPTES).map(([code, label]) => (
                <option key={code} value={code}>{code} — {label}</option>
              ))}
            </datalist>
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
            <div className="flex gap-4 text-xs">
              <span>Total Débit: <strong className="text-danger-400">{formatCurrency(totalDebit)}</strong></span>
              <span>Total Crédit: <strong className="text-accent-400">{formatCurrency(totalCredit)}</strong></span>
              <span className={equilibre ? 'text-accent-400' : 'text-danger-400'}>
                {equilibre ? '✓ Équilibré' : '✗ Déséquilibré'}
              </span>
            </div>
            <button type="submit"
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-400 text-white text-xs font-bold rounded-xl transition-colors shadow-glow">
              <Save className="w-3.5 h-3.5" /> Enregistrer l'écriture
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

      {showPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => { setShowPlan(false); setPlanSearch(''); }}>
          <div className="relative w-full max-w-2xl max-h-[80vh] rounded-xl bg-slate-800 border border-slate-700/60 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-sm font-bold text-slate-200">Plan Comptable</h3>
              <button onClick={() => { setShowPlan(false); setPlanSearch(''); }} className="text-slate-400 hover:text-slate-200 text-lg">✕</button>
            </div>
            <div className="p-4 border-b border-slate-700">
              <input type="text" value={planSearch} onChange={e => setPlanSearch(e.target.value)}
                placeholder="Rechercher un compte (code ou libellé)..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500" />
            </div>
            <div className="overflow-y-auto p-4 space-y-0.5 flex-1">
              {Object.entries(PCG_COMPTES)
                .filter(([code, label]) => !planSearch || code.includes(planSearch) || label.toLowerCase().includes(planSearch.toLowerCase()))
                .map(([code, label]) => (
                  <div key={code} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-700/50 cursor-pointer text-xs"
                    onClick={() => {
                      setLines(prev => {
                        const last = prev.length - 1;
                        const lib = findLibelle(code);
                        return prev.map((l, idx) => idx === last ? { ...l, compte: code, libelle: lib || label } : l);
                      });
                      setShowPlan(false);
                      setPlanSearch('');
                    }}>
                    <span className="font-mono text-slate-400">{code}</span>
                    <span className="text-slate-200">{label}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}