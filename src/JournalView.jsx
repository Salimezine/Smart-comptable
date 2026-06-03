import React, { useState, useEffect, useMemo } from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import { computeBalances, buildBalanceGenerale } from './utils/pcgTn';

const JOURNAL_KEY = 'smart_journal';

export default function JournalView({ formatCurrency, invoices = [], expenses = [], transactions = [] }) {
  const [journal, setJournal] = useState([]);
  const [filter, setFilter] = useState('all');
  const [showBalance, setShowBalance] = useState(false);

  const loadJournal = () => {
    try {
      const raw = localStorage.getItem(JOURNAL_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        setJournal(Array.isArray(data) ? data : []);
      } else {
        setJournal([]);
      }
    } catch {
      setJournal([]);
    }
  };

  useEffect(() => {
    loadJournal();
    const handler = () => loadJournal();
    window.addEventListener('journal:updated', handler);
    return () => window.removeEventListener('journal:updated', handler);
  }, []);

  const fallbackEntries = useMemo(() => {
    const entries = [];
    invoices.forEach(inv => {
      entries.push({ date: inv.issueDate, numeroPiece: inv.invoiceNumber || 'N/A', compte: '411 Clients', libelle: `Vente ${inv.clientName}`, debit: null, credit: inv.totalAmount || 0, journal: 'VNT' });
    });
    expenses.forEach(exp => {
      entries.push({ date: exp.date, numeroPiece: exp.invoiceNumber || `EXP-${entries.length+1}`, compte: '607000 Achats', libelle: `${exp.supplier || 'Fournisseur'} — ${exp.category || ''}`, debit: exp.totalAmount || 0, credit: null, journal: 'ACH' });
    });
    entries.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    return entries;
  }, [invoices, expenses, transactions]);

  const displayJournal = journal.length > 0 ? journal : fallbackEntries;

  const filtered = filter === 'all'
    ? displayJournal
    : displayJournal.filter(e => e.journal === filter);

  const totalDebit = filtered.reduce((s, e) => s + (parseFloat(e.debit) || 0), 0);
  const totalCredit = filtered.reduce((s, e) => s + (parseFloat(e.credit) || 0), 0);
  const equilibre = Math.abs(totalDebit - totalCredit) < 0.01;

  const balances = computeBalances(displayJournal);
  const balanceGenerale = buildBalanceGenerale(balances);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500">
            <option value="all">Tous les journaux</option>
            <option value="ACH">Achats</option>
            <option value="VNT">Ventes</option>
            <option value="OD">Opérations Diverses</option>
          </select>
          <span className="text-[10px] text-slate-500">{filtered.length} écriture{filtered.length > 1 ? 's' : ''}
            {journal.length === 0 && fallbackEntries.length > 0 && ' (données existantes)'}
          </span>
        </div>
        <button onClick={() => { loadJournal(); setShowBalance(!showBalance); }}
          className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs rounded-xl transition-colors">
          <RotateCcw className="w-3 h-3" />
          {showBalance ? 'Journal' : 'Balance Générale'}
        </button>
      </div>

      {showBalance ? (
        <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                  <th className="py-4 px-6">Compte</th>
                  <th className="py-4 px-6 text-right">Total Débit</th>
                  <th className="py-4 px-6 text-right">Total Crédit</th>
                  <th className="py-4 px-6 text-right">Solde Débiteur</th>
                  <th className="py-4 px-6 text-right">Solde Créditeur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-xs">
                {balanceGenerale.length === 0 ? (
                  <tr><td colSpan={5} className="py-12 text-center text-slate-500">Aucun mouvement.</td></tr>
                ) : (
                  balanceGenerale.map((b, i) => (
                    <tr key={i} className="hover:bg-slate-800/10 transition-colors">
                      <td className="py-3 px-6 font-mono text-slate-300">{b.compte}</td>
                      <td className="py-3 px-6 text-right text-slate-300">{formatCurrency(b.debitTotal)}</td>
                      <td className="py-3 px-6 text-right text-slate-300">{formatCurrency(b.creditTotal)}</td>
                      <td className="py-3 px-6 text-right text-danger-400 font-semibold">
                        {b.soldeDebiteur > 0 ? formatCurrency(b.soldeDebiteur) : '-'}
                      </td>
                      <td className="py-3 px-6 text-right text-accent-400 font-semibold">
                        {b.soldeCrediteur > 0 ? formatCurrency(b.soldeCrediteur) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">N° Pièce</th>
                  <th className="py-4 px-6">Compte</th>
                  <th className="py-4 px-6">Libellé</th>
                  <th className="py-4 px-6 text-right">Débit</th>
                  <th className="py-4 px-6 text-right">Crédit</th>
                  <th className="py-4 px-6 text-center">Journal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-xs">
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-slate-500">Aucune écriture trouvée. Scannez une facture pour créer une écriture.</td></tr>
                ) : (
                  filtered.map((e, i) => (
                    <tr key={i} className="hover:bg-slate-800/10 transition-colors">
                      <td className="py-4 px-6 text-slate-400 font-mono">{e.date}</td>
                      <td className="py-4 px-6 font-bold text-slate-300">{e.numeroPiece}</td>
                      <td className="py-4 px-6 font-mono text-slate-300">{e.compte}</td>
                      <td className="py-4 px-6 text-slate-200">{e.libelle}</td>
                      <td className="py-4 px-6 text-right text-danger-400 font-semibold">
                        {e.debit ? formatCurrency(e.debit) : '-'}
                      </td>
                      <td className="py-4 px-6 text-right text-accent-400 font-semibold">
                        {e.credit ? formatCurrency(e.credit) : '-'}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400">{e.journal}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!showBalance && (
        <div className="flex justify-end gap-6 text-xs">
          <span>Total Débit: <strong className="text-danger-400">{formatCurrency(totalDebit)}</strong></span>
          <span>Total Crédit: <strong className="text-accent-400">{formatCurrency(totalCredit)}</strong></span>
          <span className={equilibre ? 'text-accent-400' : 'text-danger-400'}>
            {equilibre ? '✓ Équilibré' : '✗ Déséquilibré'}
          </span>
        </div>
      )}
    </div>
  );
}
