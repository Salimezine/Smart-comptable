import React, { useState, useMemo } from 'react';
import { Building, Users, ShieldCheck, CheckCircle2, Clock, RefreshCw, FileText, TrendingUp, AlertTriangle, UserCheck, ArrowRight } from 'lucide-react';
import PremiumCard from '../components/PremiumCard';
import KpiCard from '../components/KpiCard';
import SectionHeader from '../components/SectionHeader';

export default function ExpertAccountantPortalView({ companies = {}, currentCompanyId, onCompanyChange, formatCurrency }) {
  const [selectedClient, setSelectedClient] = useState(null);
  const [validationFilter, setValidationFilter] = useState('all');

  const companyList = useMemo(() => {
    return Object.entries(companies || {}).map(([id, data]) => ({
      id,
      name: data.companyDetails?.name || data.companyDetails?.raisonSociale || `Société ${id.slice(-4)}`,
      invoices: data.invoices || [],
      expenses: data.expenses || [],
      transactions: data.transactions || [],
      details: data.companyDetails || {},
    }));
  }, [companies]);

  const totalRevenue = companyList.reduce((s, c) => s + c.invoices.reduce((si, i) => si + (i.totalAmount || 0), 0), 0);
  const totalExpenses = companyList.reduce((s, c) => s + c.expenses.reduce((se, e) => se + (e.totalAmount || 0), 0), 0);
  const totalClients = companyList.length;
  const overdueCount = companyList.reduce((s, c) => s + c.invoices.filter(i => i.status === 'OVERDUE').length, 0);

  const fmt = (v) => formatCurrency ? formatCurrency(v) : `${(v || 0).toFixed(3)} DT`;

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Building}
        title="Portail Expert-Comptable"
        subtitle="Gestion multi-sociétés, validation des écritures et supervision des dossiers clients"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard icon={Building} label="Sociétés actives" value={totalClients} color="brand" />
        <KpiCard icon={TrendingUp} label="CA consolidé" value={totalRevenue} color="emerald" format={fmt} />
        <KpiCard icon={TrendingUp} label="Dépenses consolidées" value={totalExpenses} color="red" format={fmt} />
        <KpiCard icon={AlertTriangle} label="Factures en retard" value={overdueCount} color={overdueCount > 0 ? 'amber' : 'emerald'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-bold text-white">Dossiers clients</h3>
          {companyList.length === 0 ? (
            <PremiumCard className="p-8 text-center">
              <Building className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Aucune société configurée</p>
            </PremiumCard>
          ) : companyList.map((company, i) => {
            const companyRevenue = company.invoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
            const companyExpenses = company.expenses.reduce((s, e) => s + (e.totalAmount || 0), 0);
            const isActive = company.id === currentCompanyId;
            return (
              <PremiumCard
                key={company.id}
                className={`p-5 cursor-pointer transition-all ${isActive ? 'border-brand-500/40 shadow-[0_0_20px_rgba(99,102,241,0.08)]' : ''}`}
                onClick={() => onCompanyChange && onCompanyChange(company.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                      isActive ? 'bg-brand-500/20 border border-brand-500/30' : 'bg-slate-800 border border-slate-700/50'
                    }`}>
                      🏢
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-white truncate">{company.name}</h4>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
                        <span>{company.invoices.length} factures</span>
                        <span>{company.expenses.length} dépenses</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-emerald-400">{fmt(companyRevenue)}</p>
                    <p className="text-[10px] text-slate-400">CA</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                  <div className="p-2.5 rounded-lg bg-slate-800/30 border border-slate-700/50 text-center">
                    <p className="text-[10px] text-slate-400">Solde</p>
                    <p className={`text-xs font-bold ${(companyRevenue - companyExpenses) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(companyRevenue - companyExpenses)}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-800/30 border border-slate-700/50 text-center">
                    <p className="text-[10px] text-slate-400">Impayés</p>
                    <p className="text-xs font-bold text-amber-400">{company.invoices.filter(i => i.status !== 'PAID').length}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-800/30 border border-slate-700/50 text-center">
                    <p className="text-[10px] text-slate-400">Statut</p>
                    <span className={`inline-block w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                  </div>
                </div>
              </PremiumCard>
            );
          })}
        </div>

        <div className="space-y-4">
          <PremiumCard className="p-5">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Workflow de validation
            </h3>
            <div className="space-y-3">
              {[
                { step: 'Saisie', status: 'completed', count: 12 },
                { step: 'Révision', status: 'in_progress', count: 5 },
                { step: 'Validation client', status: 'pending', count: 8 },
                { step: 'Déclaration fiscale', status: 'pending', count: 3 },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/30 border border-slate-700/50">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      item.status === 'completed' ? 'bg-emerald-400' :
                      item.status === 'in_progress' ? 'bg-amber-400' : 'bg-slate-500'
                    }`} />
                    <span className="text-xs text-slate-300">{item.step}</span>
                  </div>
                  <span className="text-xs font-bold text-white">{item.count}</span>
                </div>
              ))}
            </div>
          </PremiumCard>

          <PremiumCard className="p-5">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              Actions récentes
            </h3>
            <div className="space-y-2">
              {[
                { action: 'Validation écritures', company: 'SARL Tech', time: 'Il y a 2h' },
                { action: 'Déclaration TVA', company: 'Smart Services', time: 'Il y a 1j' },
                { action: 'TEIF générées', company: 'Atlas Distribution', time: 'Il y a 3j' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-800/30 transition-colors">
                  <div className="w-7 h-7 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
                    <FileText className="w-3.5 h-3.5 text-brand-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-white truncate">{item.action}</p>
                    <p className="text-[10px] text-slate-500">{item.company} · {item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </PremiumCard>

          <PremiumCard className="p-5">
            <h3 className="text-sm font-bold text-white mb-3">Alertes consolidées</h3>
            <div className="space-y-2">
              {[
                { msg: `${overdueCount} factures en retard`, severity: 'high' },
                { msg: `${totalClients} sociétés à superviser`, severity: 'info' },
              ].map((a, i) => (
                <div key={i} className={`p-2.5 rounded-xl text-xs border ${
                  a.severity === 'high' ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-blue-500/10 border-blue-500/20 text-blue-300'
                }`}>
                  {a.msg}
                </div>
              ))}
            </div>
          </PremiumCard>
        </div>
      </div>
    </div>
  );
}
