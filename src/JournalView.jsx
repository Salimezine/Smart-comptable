import React, { useState } from 'react';
import { BookOpen, Filter } from 'lucide-react';

export default function JournalView({ invoices, expenses, transactions, formatCurrency }) {
  const [journalType, setJournalType] = useState('all');

  const entries = [];
  invoices.forEach(inv => {
    entries.push({ date: inv.issueDate, ref: inv.invoiceNumber || 'N/A', account: '411 Clients', label: `Vente ${inv.clientName}`, type: 'credit', amount: inv.totalAmount || 0, journal: 'Ventes' });
  });
  expenses.forEach(exp => {
    entries.push({ date: exp.date, ref: exp.invoiceNumber || 'ACH-'+String(entries.length+1).padStart(4,'0'), account: '607 Achats', label: `${exp.supplier} — ${exp.category}`, type: 'debit', amount: exp.totalAmount || 0, journal: 'Achats' });
  });
  transactions.forEach(tx => {
    const label = tx.description || tx.libelle || 'Écriture bancaire';
    entries.push({ date: tx.date, ref: 'BNK-'+String(entries.length+1).padStart(4,'0'), account: '512 Banque', label, type: tx.type === 'credit' ? 'credit' : 'debit', amount: Math.abs(tx.amount || 0), journal: 'Banque' });
  });

  entries.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const filtered = journalType === 'all' ? entries : entries.filter(e => e.journal === journalType);
  const totalDebit = filtered.reduce((s, e) => s + (e.type === 'debit' ? e.amount : 0), 0);
  const totalCredit = filtered.reduce((s, e) => s + (e.type === 'credit' ? e.amount : 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-slate-400" />
        <select value={journalType} onChange={e => setJournalType(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500">
          <option value="all">Tous les journaux</option>
          <option value="Ventes">Ventes</option>
          <option value="Achats">Achats</option>
          <option value="Banque">Banque</option>
        </select>
        <span className="text-[10px] text-slate-500">{filtered.length} écriture{filtered.length > 1 ? 's' : ''}</span>
      </div>

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
                <tr><td colSpan={7} className="py-12 text-center text-slate-500">Aucune écriture trouvée.</td></tr>
              ) : (
                filtered.map((e, i) => (
                  <tr key={i} className="hover:bg-slate-800/10 transition-colors">
                    <td className="py-4 px-6 text-slate-400 font-mono">{e.date}</td>
                    <td className="py-4 px-6 font-bold text-slate-300">{e.ref}</td>
                    <td className="py-4 px-6 font-mono text-slate-300">{e.account}</td>
                    <td className="py-4 px-6 text-slate-200">{e.label}</td>
                    <td className="py-4 px-6 text-right text-danger-400 font-semibold">{e.type === 'debit' ? formatCurrency(e.amount) : '-'}</td>
                    <td className="py-4 px-6 text-right text-accent-400 font-semibold">{e.type === 'credit' ? formatCurrency(e.amount) : '-'}</td>
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

      <div className="flex justify-end gap-6 text-xs">
        <span>Total Débit: <strong className="text-danger-400">{formatCurrency(totalDebit)}</strong></span>
        <span>Total Crédit: <strong className="text-accent-400">{formatCurrency(totalCredit)}</strong></span>
        <span className={totalDebit === totalCredit ? 'text-accent-400' : 'text-danger-400'}>
          {totalDebit === totalCredit ? '✓ Équilibré' : '✗ Déséquilibré'}
        </span>
      </div>
    </div>
  );
}
