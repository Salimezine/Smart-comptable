import { useState } from 'react';
import { CheckCircle2, AlertCircle, BookOpen, UserPlus, Trash2, Plus } from 'lucide-react';
import { PCG_COMPLET } from '../utils/pcgComplet';
import { loadTiers } from '../utils/tiersCodes';
import AccountSelect from './AccountSelect';

function findLibelle(code) {
  if (!code) return '';
  const exact = PCG_COMPLET[code];
  if (exact) return exact;
  const prefix = Object.keys(PCG_COMPLET).filter(k => code.startsWith(k)).sort((a, b) => b.length - a.length)[0];
  return prefix ? PCG_COMPLET[prefix] : '';
}

function getCustomLabels(tierCode) {
  const map = {};
  if (!tierCode) return map;
  const tiers = loadTiers();
  const t = tiers.find(x => x.code === tierCode || x.nom === tierCode);
  if (!t?.comptes_defaut) return map;
  const cd = t.comptes_defaut;
  if (cd.charge && cd.charge_label) map[cd.charge] = cd.charge_label;
  if (cd.tiers && cd.tiers_label) map[cd.tiers] = cd.tiers_label;
  if (cd.tva && cd.tva_label) map[cd.tva] = cd.tva_label;
  return map;
}

function ConfidenceBadge({ label, value }) {
  const color = value >= 95 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    : value >= 80 ? 'text-brand-400 bg-brand-500/10 border-brand-500/20'
    : value >= 60 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    : 'text-danger-400 bg-danger-500/10 border-danger-500/20';
  return (
    <div className={`p-2 rounded-xl border ${color} text-center`}>
      <span className="text-[18px] font-bold">{value}%</span>
      <p className="text-[9px] opacity-70 mt-0.5">{label}</p>
    </div>
  );
}

export default function JournalPreview({ piece, onAccept, onModify, onCancel, onMemorize }) {
  const [lignes, setLignes] = useState(piece?.lignes?.map(l => ({ ...l })) || []);

  const totalDebit = lignes.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lignes.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;
  const tier = piece?._tier;
  const ocrConf = piece?._ocrConfidence || 100;
  const acctConf = tier ? Math.min(100, ocrConf + 5) : ocrConf;
  const customLabels = getCustomLabels(tier?.code);

  const updateLine = (i, fields) => {
    setLignes(prev => prev.map((line, idx) => idx === i ? { ...line, ...fields } : line));
  };

  const removeLine = (i) => {
    if (lignes.length <= 1) return;
    setLignes(prev => prev.filter((_, idx) => idx !== i));
  };

  const addLine = () => {
    setLignes(prev => [...prev, { compte: '', libelle: '', debit: null, credit: null }]);
  };

  const handleCompteChange = (i, l, code) => {
    const nouveauLib = customLabels[code] || findLibelle(code);
    const ancienLib = l.compte ? (customLabels[l.compte] || findLibelle(l.compte)) : '';
    const newLibelle = (nouveauLib && (!l.libelle || l.libelle === ancienLib)) ? nouveauLib : l.libelle;
    setLignes(prev => balanceLines(prev.map((line, idx) => idx === i ? { ...line, compte: code, libelle: newLibelle } : line)));
  };

  const balanceLines = (lines) => {
    const debit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const credit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    const diff = parseFloat((debit - credit).toFixed(3));
    if (Math.abs(diff) < 0.001) return lines;
    const prefix = piece.journal === 'VNT' ? '411' : '401';
    const idx = lines.findIndex(l => l.compte?.startsWith(prefix));
    if (idx >= 0) {
      return lines.map((l, j) => {
        if (j !== idx) return l;
        if (diff > 0) return { ...l, credit: (parseFloat(l.credit) || 0) + diff };
        return { ...l, debit: (parseFloat(l.debit) || 0) - diff };
      });
    }
    const ligne = diff > 0
      ? { compte: prefix + '001', libelle: `Ajustement ${piece.fournisseur || ''}`, debit: null, credit: diff }
      : { compte: prefix + '001', libelle: `Ajustement ${piece.fournisseur || ''}`, debit: -diff, credit: null };
    return [...lines, ligne];
  };

  const autoBalance = () => {
    setLignes(prev => balanceLines(prev));
  };

  const handleAccept = () => {
    onAccept({ ...piece, lignes, validated: true });
  };

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h4 className="text-sm font-extrabold flex items-center gap-1.5 text-brand-400">
          <BookOpen className="w-4 h-4" /> Écriture Comptable Proposée
        </h4>
        {piece.journal && (
          <span className="text-[10px] font-mono bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
            Journal {piece.journal}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <ConfidenceBadge label="Confiance OCR" value={ocrConf} />
        <ConfidenceBadge label="Confiance Comptable" value={acctConf} />
        {tier ? (
          <div className="p-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-center flex flex-col items-center justify-center">
            <span className="text-[9px] text-emerald-400 opacity-70">Fournisseur reconnu</span>
            <p className="text-[11px] font-bold text-emerald-300 mt-0.5">{tier.code}</p>
            <p className="text-[9px] text-emerald-400/60">{tier.nom}</p>
          </div>
        ) : (
          <div className="p-2 rounded-xl border border-amber-500/20 bg-amber-500/5 text-center flex flex-col items-center justify-center">
            <span className="text-[9px] text-amber-400 opacity-70">Nouveau fournisseur</span>
            <p className="text-[11px] text-amber-300 font-bold mt-0.5">{piece.fournisseur || '—'}</p>
            {onMemorize && (
              <button onClick={onMemorize}
                className="mt-1 flex items-center gap-1 text-[9px] text-amber-400 hover:text-amber-300 transition-colors">
                <UserPlus className="w-3 h-3" /> Mémoriser
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-[10px]">
        <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
          <span className="text-slate-500">Pièce N°</span>
          <p className="text-slate-200 font-bold mt-0.5">{piece.numeroPiece || piece.id || '—'}</p>
        </div>
        <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
          <span className="text-slate-500">Date</span>
          <p className="text-slate-200 font-bold mt-0.5">{piece.date || piece.datePiece || '—'}</p>
        </div>
        <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
          <span className="text-slate-500">Fournisseur / Client</span>
          <p className="text-slate-200 font-bold mt-0.5">{piece.fournisseur || '—'}</p>
        </div>
        <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
          <span className="text-slate-500">Justificatif</span>
          <p className="text-slate-200 font-bold mt-0.5">{piece.piece_justificative || '—'}</p>
        </div>
      </div>

      {piece.taux_tva_details && piece.taux_tva_details.length > 0 && (
        <div className="p-2.5 bg-amber-500/5 border border-amber-500/25 rounded-xl">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400 mb-1">
            <AlertCircle className="w-3 h-3" /> TVA Mixte — détail par taux
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {piece.taux_tva_details.map((d, i) => (
              <div key={i} className="p-1.5 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-[9px] text-slate-500">TVA {d.taux}%</span>
                <p className="text-[11px] text-slate-200 font-bold mt-0.5">
                  Base {parseFloat(d.base_ht || 0).toFixed(3)} DT
                </p>
                <p className="text-[11px] text-amber-300 font-mono">{parseFloat(d.montant_tva || 0).toFixed(3)} DT</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left text-slate-500 font-medium pb-2 pr-2">Compte</th>
              <th className="text-left text-slate-500 font-medium pb-2 pr-2">Libellé</th>
              <th className="text-right text-slate-500 font-medium pb-2 pr-2 w-24">Débit</th>
              <th className="text-right text-slate-500 font-medium pb-2 pr-2 w-24">Crédit</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => (
              <tr key={l.id || i} className={`border-b border-slate-800/50 ${i % 2 === 0 ? 'bg-slate-900/30' : ''}`}>
                <td className="py-1.5 pr-2 min-w-[180px]">
                  <AccountSelect value={l.compte || ''} onChange={code => handleCompteChange(i, l, code)} />
                  {(customLabels[l.compte] || findLibelle(l.compte)) && (
                    <div className="text-[8px] text-slate-500 mt-0.5 truncate max-w-[200px]">{customLabels[l.compte] || findLibelle(l.compte)}</div>
                  )}
                </td>
                <td className="py-1.5 pr-2 min-w-[160px]">
                  <input type="text" value={l.libelle || ''} onChange={e => updateLine(i, { libelle: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-brand-500" />
                </td>
                <td className="py-1.5 pr-2">
                  <input type="number" step="0.001" value={l.debit ?? ''} onChange={e => updateLine(i, { debit: e.target.value === '' ? null : parseFloat(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-emerald-400 font-mono text-right focus:outline-none focus:border-brand-500" />
                </td>
                <td className="py-1.5 pr-2">
                  <input type="number" step="0.001" value={l.credit ?? ''} onChange={e => updateLine(i, { credit: e.target.value === '' ? null : parseFloat(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-amber-400 font-mono text-right focus:outline-none focus:border-brand-500" />
                </td>
                <td className="py-1.5 text-center">
                  <button onClick={() => removeLine(i)} disabled={lignes.length <= 1}
                    className="text-slate-600 hover:text-danger-400 disabled:opacity-30 transition-colors" title="Supprimer la ligne">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-700 font-bold">
              <td className="pt-2 pr-2 text-slate-400">Total</td>
              <td className="pt-2 pr-2"></td>
              <td className="pt-2 pr-2 text-right font-mono text-emerald-300">{totalDebit.toFixed(3)}</td>
              <td className="pt-2 pr-2 text-right font-mono text-amber-300">{totalCredit.toFixed(3)}</td>
              <td></td>
            </tr>
            <tr>
              <td colSpan={5} className="pt-2">
                <button onClick={addLine}
                  className="flex items-center gap-1 text-[10px] text-brand-400 hover:text-brand-300 transition-colors font-semibold">
                  <Plus className="w-3 h-3" /> Ajouter une ligne
                </button>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {!balanced && (
        <div className="p-2.5 bg-danger-500/10 border border-danger-500/30 rounded-xl">
          <div className="flex items-center gap-2 text-[10px] text-danger-400">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1">{piece.error || `Déséquilibre : ${totalDebit.toFixed(3)} ≠ ${totalCredit.toFixed(3)}`}</span>
            <button onClick={autoBalance}
              className="px-3 py-1.5 bg-danger-500/20 hover:bg-danger-500/30 text-danger-300 text-[10px] font-bold rounded-lg transition-colors whitespace-nowrap">
              Équilibrer auto
            </button>
          </div>
        </div>
      )}
      {balanced && (
        <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-[10px] text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1">Écriture équilibrée — vous pouvez enregistrer.</span>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button onClick={onModify}
          className="flex-1 py-2.5 rounded-xl border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 transition-colors">
          Modifier le formulaire
        </button>
        <button onClick={onCancel}
          className="py-2.5 px-4 rounded-xl border border-slate-700 text-xs text-slate-500 hover:text-slate-300 transition-colors">
          Annuler
        </button>
        <button onClick={handleAccept} disabled={!balanced}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
            balanced
              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          }`}>
          <CheckCircle2 className="w-3.5 h-3.5" />
          Accepter et Enregistrer
        </button>
      </div>
    </div>
  );
}
