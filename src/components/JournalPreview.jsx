import { useState } from 'react';
import { CheckCircle2, AlertCircle, BookOpen, UserPlus, Pencil } from 'lucide-react';
import { PCG_COMPLET } from '../utils/pcgComplet';

function findLibelle(code) {
  if (!code) return '';
  const exact = PCG_COMPLET[code];
  if (exact) return exact;
  const prefix = Object.keys(PCG_COMPLET).filter(k => code.startsWith(k)).sort((a, b) => b.length - a.length)[0];
  return prefix ? PCG_COMPLET[prefix] : '';
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
  const [editingIdx, setEditingIdx] = useState(-1);
  const [editForm, setEditForm] = useState(null);

  const totalDebit = lignes.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lignes.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;
  const tier = piece?._tier;
  const ocrConf = piece?._ocrConfidence || 100;
  const acctConf = tier ? Math.min(100, ocrConf + 5) : ocrConf;

  const startEdit = (i) => {
    setEditingIdx(i);
    setEditForm({ ...lignes[i] });
  };

  const cancelEdit = () => {
    setEditingIdx(-1);
    setEditForm(null);
  };

  const saveEdit = () => {
    if (!editForm) return;
    const updated = lignes.map((l, i) => i === editingIdx ? { ...editForm } : l);
    setLignes(updated);
    setEditingIdx(-1);
    setEditForm(null);
  };

  const updateEditField = (field, value) => {
    setEditForm(f => ({ ...f, [field]: value }));
  };

  const handleAccept = () => {
    onAccept({ ...piece, lignes });
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

      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left text-slate-500 font-medium pb-2 pr-2">Compte</th>
              <th className="text-left text-slate-500 font-medium pb-2 pr-2">Libellé</th>
              <th className="text-right text-slate-500 font-medium pb-2 pr-2">Débit</th>
              <th className="text-right text-slate-500 font-medium pb-2">Crédit</th>
              <th className="w-6"></th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => (
              editingIdx === i ? (
                <tr key={l.id || i} className="border-b border-brand-500/30 bg-brand-500/5">
                  <td className="py-1 pr-1">
                    <input value={editForm?.compte || ''} onChange={e => updateEditField('compte', e.target.value)}
                      className="w-full bg-slate-800 rounded px-1.5 py-1 text-[10px] font-mono text-brand-300 border border-brand-500/50" />
                  </td>
                  <td className="py-1 pr-1">
                    <input value={editForm?.libelle || ''} onChange={e => updateEditField('libelle', e.target.value)}
                      className="w-full bg-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-300 border border-brand-500/50" />
                  </td>
                  <td className="py-1 pr-1">
                    <input type="number" step="0.001" value={editForm?.debit || ''} onChange={e => updateEditField('debit', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-800 rounded px-1.5 py-1 text-[10px] font-mono text-emerald-400 border border-brand-500/50 text-right" />
                  </td>
                  <td className="py-1 pr-1">
                    <input type="number" step="0.001" value={editForm?.credit || ''} onChange={e => updateEditField('credit', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-800 rounded px-1.5 py-1 text-[10px] font-mono text-amber-400 border border-brand-500/50 text-right" />
                  </td>
                  <td className="py-1">
                    <div className="flex gap-1">
                      <button onClick={saveEdit} className="text-[9px] text-emerald-400 hover:text-emerald-300 px-1">✓</button>
                      <button onClick={cancelEdit} className="text-[9px] text-slate-500 hover:text-slate-300 px-1">✕</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={l.id || i} className={`border-b border-slate-800/50 ${i % 2 === 0 ? 'bg-slate-900/30' : ''} hover:bg-brand-500/5 cursor-pointer`} onClick={() => startEdit(i)}>
                  <td className="py-1.5 pr-2">
                    <span className="font-mono text-brand-300" title={findLibelle(l.compte)}>{l.compte}
                      {findLibelle(l.compte) && <span className="ml-1.5 text-[8px] text-slate-500 italic">{findLibelle(l.compte)}</span>}
                    </span>
                  </td>
                  <td className="py-1.5 pr-2 text-slate-300">
                    {l.libelle && l.libelle !== l.compte ? cleanLibelle(l.compte, l.libelle) : findLibelle(l.compte)}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono text-emerald-400">
                    {l.debit ? l.debit.toFixed(3) : ''}
                  </td>
                  <td className="py-1.5 text-right font-mono text-amber-400">
                    {l.credit ? l.credit.toFixed(3) : ''}
                  </td>
                  <td className="py-1.5 text-center">
                    <Pencil className="w-3 h-3 text-slate-600" />
                  </td>
                </tr>
              )
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-700 font-bold">
              <td className="pt-2 pr-2 text-slate-400">Total</td>
              <td className="pt-2 pr-2"></td>
              <td className="pt-2 pr-2 text-right font-mono text-emerald-300">{totalDebit.toFixed(3)}</td>
              <td className="pt-2 text-right font-mono text-amber-300">{totalCredit.toFixed(3)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {!balanced && (
        <div className="p-2.5 bg-danger-500/10 border border-danger-500/30 rounded-xl text-[10px] text-danger-400 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          Déséquilibre : {totalDebit.toFixed(3)} ≠ {totalCredit.toFixed(3)}
        </div>
      )}

      {piece.error && (
        <div className="p-2.5 bg-danger-500/10 border border-danger-500/30 rounded-xl text-[10px] text-danger-400 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {piece.error}
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

function cleanLibelle(compte, libelle) {
  if (!libelle || !compte) return libelle || '';
  const code = compte.toString().trim();
  if (libelle.startsWith(code)) {
    return libelle.slice(code.length).replace(/^[—–\-:\s]{1,3}/, '').trim();
  }
  return libelle;
}
