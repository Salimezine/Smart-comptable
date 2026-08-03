import React, { useState, useMemo } from 'react';
import { Sparkles, CheckCircle2 } from 'lucide-react';
import { rapprochementBancaire } from '../accountingUtils';
import { useToast } from '../components/Toast';

function BankSyncView({ transactions, setTransactions, invoices, setInvoices, expenses, setExpenses, formatCurrency }) {
  const [successMatchId, setSuccessMatchId] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [activeTab, setActiveTab] = useState('factures');

  const recData = useMemo(() => rapprochementBancaire(transactions, invoices, expenses), [transactions, invoices, expenses]);

  const handleReconcileInvoice = (txId, invoiceId) => {
    setTransactions(transactions.map(tx => {
      if (tx.id === txId) return { ...tx, status: 'RECONCILED', matchedInvoiceId: invoiceId };
      return tx;
    }));
    setInvoices(invoices.map(inv => {
      if (inv.id === invoiceId) return { ...inv, status: 'PAID' };
      return inv;
    }));
    setSuccessMatchId(txId);
    setTimeout(() => setSuccessMatchId(null), 2000);
  };

  const handleReconcileExpense = (txId, expenseId) => {
    setTransactions(transactions.map(tx => {
      if (tx.id === txId) return { ...tx, status: 'RECONCILED', matchedExpenseId: expenseId };
      return tx;
    }));
    setExpenses(expenses.map(exp => {
      if (exp.id === expenseId) return { ...exp, status: 'PAID' };
      return exp;
    }));
    setSuccessMatchId(txId);
    setTimeout(() => setSuccessMatchId(null), 2000);
  };

  const pendingTx = transactions.filter(t => t.status === 'UNRECONCILED');
  const unpaidInvoices = invoices.filter(inv => inv.status === 'SENT');
  const unpaidExpenses = expenses.filter(exp => exp.status === 'VALIDATED');

  const confidenceColor = (c) => {
    if (c >= 100) return { bg: 'bg-accent-500/10', text: 'text-accent-400', label: 'Confiance haute' };
    if (c >= 80) return { bg: 'bg-brand-500/10', text: 'text-brand-400', label: 'Confiance moyenne' };
    return { bg: 'bg-warning-500/10', text: 'text-warning-400', label: 'Confiance faible' };
  };

  return (
    <div className="space-y-6">
      
      {/* Status header with stats */}
      <div className="flex justify-between items-center bg-slate-900/20 p-4 rounded-xl border border-slate-800/40">
        <div>
          <h3 className="font-bold text-lg text-slate-100">Ledger de Synchronisation Bancaire</h3>
          <p className="text-xs text-slate-400">Rapprochez les flux bancaires aux factures et dépenses.</p>
        </div>
        <div className="text-right space-y-1">
          <span className="text-xs font-bold text-slate-300 block">
            {recData.stats.reconciled}/{recData.stats.total} rapprochés
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            recData.stats.tauxRapprochement >= 90 ? 'bg-accent-500/10 text-accent-400' :
            recData.stats.tauxRapprochement >= 70 ? 'bg-brand-500/10 text-brand-400' :
            'bg-warning-500/10 text-warning-400'
          }`}>
            {recData.stats.tauxRapprochement}% rapproché
          </span>
        </div>
      </div>

      {/* Tabs: Suggestions automatiques / Relevé */}
      <div className="flex gap-2">
        <button onClick={() => setActiveTab('factures')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${activeTab === 'factures' ? 'bg-brand-600 text-white' : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700'}`}>
          Factures ({unpaidInvoices.length})
        </button>
        <button onClick={() => setActiveTab('depenses')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${activeTab === 'depenses' ? 'bg-brand-600 text-white' : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700'}`}>
          Dépenses ({unpaidExpenses.length})
        </button>
        <button onClick={() => setActiveTab('suggestions')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${activeTab === 'suggestions' ? 'bg-brand-600 text-white' : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700'}`}>
          Suggestions IA ({recData.suggestions.length})
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Bank Flow */}
        <div className="lg:col-span-7 space-y-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Relevé de Banque</h4>
          
          <div className="space-y-3">
            {pendingTx.length === 0 ? (
              <div className="glass-card p-8 rounded-2xl border border-slate-800 text-center text-xs text-slate-500">
                🚀 Toutes les écritures de ce relevé bancaire ont été réconciliées avec succès !
              </div>
            ) : (
              pendingTx.map((tx) => {
                const suggestion = recData.suggestions.find(s => s.transaction.id === tx.id);
                const isMatchedJustNow = successMatchId === tx.id;
                const cc = suggestion ? confidenceColor(suggestion.confidence) : null;

                return (
                  <div 
                    key={tx.id} 
                    className={`glass-card p-5 rounded-2xl border transition-all relative overflow-hidden ${
                      isMatchedJustNow ? 'border-accent-500 bg-accent-500/5' : 'border-slate-850'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            tx.type === 'CREDIT' ? 'bg-accent-500/10 text-accent-400' : 'bg-danger-500/10 text-danger-400'
                          }`}>
                            {tx.type === 'CREDIT' ? 'Entrée' : 'Débit'}
                          </span>
                          <span className="text-[11px] text-slate-400">{tx.date}</span>
                        </div>
                        <h4 className="text-sm font-bold text-white mt-2">{tx.description}</h4>
                      </div>

                      <div className="text-right">
                        <span className={`text-base font-extrabold ${tx.type === 'CREDIT' ? 'text-accent-400' : 'text-slate-100'}`}>
                          {tx.type === 'CREDIT' ? '+' : ''}{formatCurrency(tx.amount)}
                        </span>
                      </div>
                    </div>

                    {/* IA Suggestion */}
                    {suggestion && !isMatchedJustNow && (
                      <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between bg-brand-500/5 p-3 rounded-xl border border-brand-500/10">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-brand-400 shrink-0" />
                          <div>
                            <p className="text-[11px] text-slate-300">
                              IA Suggestion : <span className="font-semibold text-white">
                                {suggestion.type === 'facture'
                                  ? `Facture ${suggestion.candidate.invoiceNumber}` 
                                  : `Dépense ${suggestion.candidate.supplier}`}
                              </span> ({formatCurrency(suggestion.candidate.totalAmount)})
                            </p>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${cc ? cc.bg + ' ' + cc.text : ''}`}>
                              {cc ? cc.label : ''} — {suggestion.strategy.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => suggestion.type === 'facture'
                            ? handleReconcileInvoice(tx.id, suggestion.candidate.id)
                            : handleReconcileExpense(tx.id, suggestion.candidate.id)
                          }
                          className="px-3 py-1 bg-brand-600 hover:bg-brand-500 text-white font-bold text-[10px] rounded-lg shadow-glow transition-all"
                        >
                          Valider
                        </button>
                      </div>
                    )}

                    {isMatchedJustNow && (
                      <div className="mt-3 text-xs font-bold text-accent-400 flex items-center gap-1.5 animate-fade-in">
                        <CheckCircle2 className="w-4 h-4" /> Écriture rapprochée avec succès !
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side */}
        <div className="lg:col-span-5 space-y-4">
          {activeTab === 'factures' && (
            <>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Factures Clients En Attente</h4>
              <div className="space-y-3">
                {unpaidInvoices.length === 0 ? (
                  <div className="glass-card p-6 rounded-2xl border border-slate-850 text-center text-xs text-slate-500">
                    Aucune facture en attente de règlement.
                  </div>
                ) : (
                  unpaidInvoices.map((inv) => (
                    <div key={inv.id} onClick={() => setSelectedInvoice(inv)} className="glass-card p-4 rounded-xl border border-slate-850 space-y-2 cursor-pointer hover:border-brand-500/40 transition-all">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-xs font-extrabold text-white">{inv.clientName}</h4>
                          <span className="text-[10px] font-mono text-slate-400">{inv.invoiceNumber}</span>
                        </div>
                        <span className="text-xs font-bold text-slate-200">{formatCurrency(inv.totalAmount)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                        <span>Échéance : {inv.dueDate}</span>
                        <span className="text-warning-400 font-bold">Attente</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {activeTab === 'depenses' && (
            <>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Dépenses Fournisseurs</h4>
              <div className="space-y-3">
                {unpaidExpenses.length === 0 ? (
                  <div className="glass-card p-6 rounded-2xl border border-slate-850 text-center text-xs text-slate-500">
                    Aucune dépense en attente de rapprochement.
                  </div>
                ) : (
                  unpaidExpenses.map((exp) => (
                    <div key={exp.id} onClick={() => setSelectedExpense(exp)} className="glass-card p-4 rounded-xl border border-slate-850 space-y-2 cursor-pointer hover:border-brand-500/40 transition-all">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-xs font-extrabold text-white">{exp.supplier}</h4>
                          <span className="text-[10px] font-mono text-slate-400">{exp.category}</span>
                        </div>
                        <span className="text-xs font-bold text-slate-200">{formatCurrency(exp.totalAmount)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                        <span>Date : {exp.date}</span>
                        <span className="text-warning-400 font-bold">{exp.status}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {activeTab === 'suggestions' && (
            <>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Suggestions IA</h4>
              <div className="space-y-3">
                {recData.suggestions.length === 0 ? (
                  <div className="glass-card p-6 rounded-2xl border border-slate-850 text-center text-xs text-slate-500">
                    Aucune suggestion disponible.
                  </div>
                ) : (
                  recData.suggestions.map((sug) => {
                    const cc = confidenceColor(sug.confidence);
                    return (
                      <div key={sug.transaction.id} className="glass-card p-4 rounded-xl border border-slate-850 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="text-xs font-bold text-white">{sug.transaction.description}</h4>
                            <span className="text-[10px] text-slate-400">{sug.transaction.date}</span>
                          </div>
                          <span className="text-xs font-bold text-slate-200">{formatCurrency(sug.transaction.amount)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className={`px-1.5 py-0.5 rounded-full font-bold ${cc.bg} ${cc.text}`}>{cc.label}</span>
                          <span className="text-slate-500">{sug.strategy.replace(/_/g, ' ')}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          → {sug.type === 'facture' ? 'Facture' : 'Dépense'} : <span className="text-white font-semibold">
                            {sug.type === 'facture' ? sug.candidate.invoiceNumber : sug.candidate.supplier}
                          </span> ({formatCurrency(sug.candidate.totalAmount)})
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          {/* Non-rapprochés */}
          <div className="pt-2">
            <div className="flex justify-between text-[10px] text-slate-500 p-2">
              <span>{recData.nonRapprochees.transactions.length} transactions non suggérées</span>
              <span>{recData.nonRapprochees.invoices.length} factures • {recData.nonRapprochees.expenses.length} dépenses</span>
            </div>
          </div>
        </div>

        {selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setSelectedInvoice(null)}>
            <div className="relative w-full max-w-lg rounded-xl bg-slate-800 border border-slate-700/60 shadow-2xl p-6" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-200">{selectedInvoice.invoiceNumber || 'Sans N°'}</h3>
                <button onClick={() => setSelectedInvoice(null)} className="text-slate-400 hover:text-slate-200 text-lg">✕</button>
              </div>
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] text-slate-500 block">Client</label><span className="text-slate-200 font-bold">{selectedInvoice.clientName}</span></div>
                  <div><label className="text-[10px] text-slate-500 block">Email</label><span className="text-slate-300">{selectedInvoice.clientEmail || '—'}</span></div>
                  <div><label className="text-[10px] text-slate-500 block">Date d'émission</label><span className="text-slate-300">{selectedInvoice.issueDate}</span></div>
                  <div><label className="text-[10px] text-slate-500 block">Échéance</label><span className="text-slate-300">{selectedInvoice.dueDate}</span></div>
                  <div><label className="text-[10px] text-slate-500 block">Matricule Fiscal</label><span className="text-slate-300 font-mono">{selectedInvoice.clientVat || '—'}</span></div>
                  <div><label className="text-[10px] text-slate-500 block">Statut</label>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedInvoice.status === 'PAID' ? 'bg-accent-500/10 text-accent-400' : selectedInvoice.status === 'SENT' ? 'bg-warning-500/10 text-warning-400' : 'bg-danger-500/10 text-danger-400'}`}>
                      {selectedInvoice.status === 'PAID' ? 'Payée' : selectedInvoice.status === 'SENT' ? 'Envoyée' : 'Retard'}
                    </span>
                  </div>
                </div>
                <div className="border-t border-slate-700 pt-3">
                  <label className="text-[10px] text-slate-500 block mb-2">Montants (DT)</label>
                  <div className="space-y-1.5">
                    {selectedInvoice.items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-[11px] text-slate-400">
                        <span>{item.description}</span>
                        <span>{formatCurrency(item.quantity * item.unitPrice)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-slate-700 mt-2 pt-2 space-y-1">
                    <div className="flex justify-between text-[11px]"><span className="text-slate-400">Sous-total HT</span><span className="text-slate-300">{formatCurrency(selectedInvoice.subtotal || (selectedInvoice.items || []).reduce((s, it) => s + it.quantity * it.unitPrice, 0))}</span></div>
                    {!!selectedInvoice.vatAmount && (<div className="flex justify-between text-[11px]"><span className="text-slate-400">TVA</span><span className="text-slate-300">{formatCurrency(selectedInvoice.vatAmount)}</span></div>)}
                    <div className="flex justify-between text-sm font-bold"><span className="text-slate-200">Total TTC</span><span className="text-white">{formatCurrency(selectedInvoice.totalAmount)}</span></div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end mt-6">
                <button onClick={() => setSelectedInvoice(null)} className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold">Fermer</button>
              </div>
            </div>
          </div>
        )}

        {selectedExpense && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setSelectedExpense(null)}>
            <div className="relative w-full max-w-lg rounded-xl bg-slate-800 border border-slate-700/60 shadow-2xl p-6" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-200">{selectedExpense.supplier}</h3>
                <button onClick={() => setSelectedExpense(null)} className="text-slate-400 hover:text-slate-200 text-lg">✕</button>
              </div>
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] text-slate-500 block">Fournisseur</label><span className="text-slate-200 font-bold">{selectedExpense.supplier}</span></div>
                  <div><label className="text-[10px] text-slate-500 block">Catégorie</label><span className="text-slate-300">{selectedExpense.category}</span></div>
                  <div><label className="text-[10px] text-slate-500 block">Date</label><span className="text-slate-300">{selectedExpense.date}</span></div>
                  <div><label className="text-[10px] text-slate-500 block">Statut</label><span className="text-slate-300">{selectedExpense.status}</span></div>
                </div>
                <div className="border-t border-slate-700 pt-3 space-y-1">
                  {selectedExpense.subtotal !== undefined && (<div className="flex justify-between text-[11px]"><span className="text-slate-400">HT</span><span className="text-slate-300">{formatCurrency(selectedExpense.subtotal)}</span></div>)}
                  {selectedExpense.vatAmount !== undefined && (<div className="flex justify-between text-[11px]"><span className="text-slate-400">TVA</span><span className="text-slate-300">{formatCurrency(selectedExpense.vatAmount)}</span></div>)}
                  {selectedExpense.stampDuty !== undefined && (<div className="flex justify-between text-[11px]"><span className="text-slate-400">Timbre</span><span className="text-slate-300">{formatCurrency(selectedExpense.stampDuty)}</span></div>)}
                  <div className="flex justify-between text-sm font-bold pt-1 border-t border-slate-700"><span className="text-slate-200">Total TTC</span><span className="text-white">{formatCurrency(selectedExpense.totalAmount)}</span></div>
                </div>
              </div>
              <div className="flex justify-end mt-6">
                <button onClick={() => setSelectedExpense(null)} className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold">Fermer</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default BankSyncView;
