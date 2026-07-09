import React, { useState, useMemo } from 'react';
import { Users, Building, Mail, Phone, MapPin, FileText, TrendingUp, Search, Filter, Clock, Plus, MessageSquare } from 'lucide-react';
import { getClients, getSuppliers, getClientTimeline, getNotes, addNote } from '../utils/crmEngine';
import PremiumCard from '../components/PremiumCard';
import KpiCard from '../components/KpiCard';
import SectionHeader from '../components/SectionHeader';

export default function AccountingCRMView({ invoices = [], expenses = [], formatCurrency }) {
  const [activeTab, setActiveTab] = useState('clients');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [noteInput, setNoteInput] = useState('');

  const fmt = (v) => formatCurrency ? formatCurrency(v) : `${(v || 0).toFixed(3)} DT`;

  const clients = useMemo(() => getClients(invoices), [invoices]);
  const suppliers = useMemo(() => getSuppliers(expenses), [expenses]);
  const timeline = useMemo(() => getClientTimeline(invoices), [invoices]);

  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.vat.includes(q));
  }, [clients, searchQuery]);

  const filteredSuppliers = useMemo(() => {
    if (!searchQuery) return suppliers;
    const q = searchQuery.toLowerCase();
    return suppliers.filter(s => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
  }, [suppliers, searchQuery]);

  const totalClientRevenue = clients.reduce((s, c) => s + c.totalInvoiced, 0);
  const totalPending = clients.reduce((s, c) => s + c.totalPending, 0);

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Users}
        title="CRM Comptable"
        subtitle="Gestion intelligente de vos clients et fournisseurs avec historique et suivi"
      />

      <div className="flex gap-2 mb-4">
        {[
          { id: 'clients', label: 'Clients', icon: Users, count: clients.length },
          { id: 'suppliers', label: 'Fournisseurs', icon: Building, count: suppliers.length },
          { id: 'timeline', label: 'Chronologie', icon: Clock },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSelectedEntity(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                activeTab === tab.id
                  ? 'bg-brand-500/20 text-brand-400 border-brand-500/30'
                  : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:border-slate-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && (
                <span className="px-1.5 py-0.5 rounded-full bg-slate-700 text-[10px]">{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === 'clients' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KpiCard icon={Users} label="Nombre de clients" value={clients.length} color="brand" />
            <KpiCard icon={TrendingUp} label="Chiffre d'affaires" value={totalClientRevenue} color="emerald" format={fmt} />
            <KpiCard icon={FileText} label="Factures impayées" value={totalPending} color={totalPending > 0 ? 'amber' : 'emerald'} format={fmt} />
            <KpiCard icon={Users} label="Taux recouvrement" value={totalClientRevenue > 0 ? `${((totalClientRevenue - totalPending) / totalClientRevenue * 100).toFixed(0)}%` : '0%'} color="violet" />
          </div>

          <div className="flex gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Rechercher un client..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 focus:border-brand-500 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {selectedEntity ? (
              <PremiumCard className="lg:col-span-3 p-5">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white text-xl font-bold">
                    {selectedEntity.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-extrabold text-white">{selectedEntity.name}</h3>
                    <div className="flex gap-4 mt-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{selectedEntity.email || 'N/A'}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />MF : {selectedEntity.vat || 'N/A'}</span>
                    </div>
                  </div>
                  <button onClick={() => setSelectedEntity(null)} className="text-xs text-brand-400 hover:text-brand-300 font-semibold">Retour</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 text-center">
                    <p className="text-[10px] text-slate-400">Total facturé</p>
                    <p className="text-lg font-extrabold text-emerald-400">{fmt(selectedEntity.totalInvoiced)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 text-center">
                    <p className="text-[10px] text-slate-400">Payé</p>
                    <p className="text-lg font-extrabold text-brand-400">{fmt(selectedEntity.totalPaid)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 text-center">
                    <p className="text-[10px] text-slate-400">Impayé</p>
                    <p className={`text-lg font-extrabold ${selectedEntity.totalPending > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{fmt(selectedEntity.totalPending)}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-300 mb-2">Factures ({selectedEntity.invoices.length})</h4>
                  {selectedEntity.invoices.slice(0, 10).map((inv, i) => (
                    <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-slate-800/20 border border-slate-700/50 text-xs">
                      <div><span className="text-white font-medium">{inv.invoiceNumber}</span><span className="text-slate-500 ml-2">{inv.issueDate}</span></div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-white">{fmt(inv.totalAmount)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          inv.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-400' :
                          inv.status === 'SENT' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
                        }`}>{inv.status === 'PAID' ? 'Payée' : inv.status === 'SENT' ? 'Envoyée' : 'Retard'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </PremiumCard>
            ) : (
              filteredClients.map((client, i) => (
                <PremiumCard key={i} className="p-5 cursor-pointer" onClick={() => setSelectedEntity(client)}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500/30 to-brand-600/10 border border-brand-500/20 flex items-center justify-center text-brand-400 font-bold text-sm">
                      {client.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-white truncate">{client.name}</h4>
                      <p className="text-[10px] text-slate-400 truncate">{client.email || 'Aucun email'}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-slate-400">Total</span><span className="text-emerald-400 font-bold">{fmt(client.totalInvoiced)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Impayé</span><span className={client.totalPending > 0 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>{fmt(client.totalPending)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Factures</span><span className="text-white font-bold">{client.invoiceCount}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Dernière</span><span className="text-white">{client.lastInvoice || 'N/A'}</span></div>
                  </div>
                </PremiumCard>
              ))
            )}
          </div>
        </>
      )}

      {activeTab === 'suppliers' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard icon={Building} label="Fournisseurs" value={suppliers.length} color="brand" />
            <KpiCard icon={TrendingUp} label="Total dépenses" value={suppliers.reduce((s, c) => s + c.totalSpent, 0)} color="red" format={fmt} />
            <KpiCard icon={FileText} label="Transactions" value={suppliers.reduce((s, c) => s + c.expenseCount, 0)} color="violet" />
          </div>

          <div className="flex gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Rechercher un fournisseur..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 focus:border-brand-500 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead><tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-bold">
                <th className="pb-3 pr-4">Fournisseur</th>
                <th className="pb-3 pr-4">Catégorie</th>
                <th className="pb-3 pr-4 text-right">Total dépensé</th>
                <th className="pb-3 pr-4 text-center">Factures</th>
                <th className="pb-3 text-right">Dernière</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredSuppliers.map((s, i) => (
                  <tr key={i} className="hover:bg-slate-800/20">
                    <td className="py-3 pr-4"><span className="font-bold text-white">{s.name}</span></td>
                    <td className="py-3 pr-4 text-slate-400">{s.category || 'Divers'}</td>
                    <td className="py-3 pr-4 text-right text-red-400 font-bold">{fmt(s.totalSpent)}</td>
                    <td className="py-3 pr-4 text-center text-white">{s.expenseCount}</td>
                    <td className="py-3 text-right text-slate-400">{s.lastExpense || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'timeline' && (
        <PremiumCard className="p-5">
          <h3 className="text-sm font-bold text-white mb-4">Chronologie des ventes</h3>
          <div className="space-y-3">
            {timeline.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">Aucune activité enregistrée</p>
            ) : timeline.slice().reverse().map((t, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/30 border border-slate-700/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-brand-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{t.label}</p>
                    <p className="text-[10px] text-slate-400">{t.count} facture{t.count > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-emerald-400">{fmt(t.total)}</p>
                  <p className="text-[10px] text-slate-400">Payé : {fmt(t.paid)}</p>
                </div>
              </div>
            ))}
          </div>
        </PremiumCard>
      )}
    </div>
  );
}
