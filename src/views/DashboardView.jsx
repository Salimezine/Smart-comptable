import React from 'react';
import {
  TrendingUp, TrendingDown, FileText, DollarSign, Send, Calculator, Scan, Sparkles,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { computeMonthlyChartData } from '../accountingUtils';
import ErpKpiWidgets from '../components/ErpKpiWidgets';

export default function DashboardView({
  totalRevenues,
  pendingRevenues,
  totalExpenses,
  bankBalance,
  estimatedTaxes,
  formatCurrency,
  invoices,
  expenses,
  companyId,
}) {
  const chartData = computeMonthlyChartData(invoices, expenses);

  const getTeifKey = () => {
    const id = localStorage.getItem('smart_comptable_current_id');
    return id ? `teifStatusMap_${id}` : 'teifStatusMap';
  };

  const [dashTeifMap] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem(getTeifKey()) || '{}'); } catch { return {}; }
  });

  const taxRatio = Math.min((estimatedTaxes / (totalRevenues || 1)) * 100, 100);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
        {[
          { title: 'Revenus Encaissés', value: totalRevenues, color: 'text-accent-400', icon: TrendingUp, bg: 'bg-accent-500/10 border-accent-500/20', gradient: 'from-accent-500/5 to-transparent' },
          { title: 'Dépenses Totales', value: totalExpenses, color: 'text-danger-400', icon: TrendingDown, bg: 'bg-danger-500/10 border-danger-500/20', gradient: 'from-danger-500/5 to-transparent' },
          { title: 'Factures en Attente', value: pendingRevenues, color: 'text-warning-400', icon: FileText, bg: 'bg-warning-500/10 border-warning-500/20', gradient: 'from-warning-500/5 to-transparent' },
          { title: 'Solde Trésorerie', value: bankBalance, color: 'text-brand-400', icon: DollarSign, bg: 'bg-brand-500/10 border-brand-500/20', gradient: 'from-brand-500/5 to-transparent' },
          { title: 'TEIF Acceptées', value: invoices.filter(inv => dashTeifMap[inv.id] === 'accepted').length, color: 'text-indigo-400', icon: Send, bg: 'bg-indigo-500/10 border-indigo-500/20', gradient: 'from-indigo-500/5 to-transparent', suffix: true },
        ].map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className={`glass-card p-5 rounded-2xl border ${card.bg} relative overflow-hidden group transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg card-hover-glow`}
              style={{ animationDelay: `${i * 80}ms` }}>
              <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              <div className="relative z-10">
                <div className="flex justify-between items-start">
                  <div className="space-y-1.5">
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">{card.title}</p>
                    <h3 className={`text-xl lg:text-2xl font-extrabold tracking-tight ${card.color}`}>
                      {card.suffix ? card.value : formatCurrency(card.value)}
                    </h3>
                  </div>
                  <div className={`p-2.5 rounded-xl ${card.bg} border border-slate-700/50 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-4.5 h-4.5 text-slate-300" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {companyId && <ErpKpiWidgets companyId={companyId} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-2xl border border-slate-800 lg:col-span-2 space-y-4 transition-all duration-300 hover:border-slate-700/60">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-slate-100">Évolution de la Trésorerie</h3>
              <p className="text-xs text-slate-400">Revenus nets vs Dépenses cumulées sur l'année</p>
            </div>
            <span className="text-[10px] font-semibold px-2.5 py-1 bg-brand-500/10 text-brand-400 rounded-md border border-brand-500/20">Semestriel</span>
          </div>

          <div className="w-full">
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenues" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}
                  labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="revenus" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenues)" />
                <Area type="monotone" dataKey="depenses" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorExpenses)" />
                <Area type="monotone" dataKey="tresorerie" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCash)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl border border-slate-800 flex flex-col justify-between transition-all duration-300 hover:border-slate-700/60">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-warning-400">
              <Calculator className="w-5 h-5" />
              <h3 className="font-bold text-slate-100">Provision d'Impôts IA</h3>
            </div>
            <p className="text-xs text-slate-400">Calcul automatique estimatif basé sur vos encaissements réels de l'exercice fiscal en cours.</p>
          </div>

          <div className="my-6 flex flex-col items-center justify-center relative">
            <div className="relative w-44 h-44 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="88" cy="88" r="70" stroke="#1e293b" strokeWidth="12" fill="transparent" />
                <circle cx="88" cy="88" r="70" stroke="url(#warningGradient)" strokeWidth="12" fill="transparent"
                  strokeDasharray="440"
                  strokeDashoffset={440 - (440 * taxRatio) / 100}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
                <defs>
                  <linearGradient id="warningGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute text-center">
                <p className="text-3xl font-extrabold text-white tracking-tight">{formatCurrency(estimatedTaxes)}</p>
                <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Provision IS (15%)</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>CNSS Employeur (16.57%) :</span>
              <span className="font-semibold text-slate-200">{formatCurrency(totalRevenues * 0.1657)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Impôt sur Sociétés IS (15%) :</span>
              <span className="font-semibold text-slate-200">{formatCurrency(totalRevenues * 0.15)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4 transition-all duration-300 hover:border-slate-700/60">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-100">Facturations Récentes</h3>
            {invoices.length > 0 && (
              <span className="text-[10px] text-slate-500 font-medium">{invoices.length} total</span>
            )}
          </div>
          {invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="w-10 h-10 text-slate-700 mb-3" />
              <p className="text-sm font-semibold text-slate-500">Aucune facture</p>
              <p className="text-[11px] text-slate-600 mt-1">Créez votre première facture depuis l'onglet Factures</p>
            </div>
          ) : (
            <div className="space-y-2">
              {invoices.slice(0, 4).map((inv, idx) => (
                <div key={idx} className="row-hover flex justify-between items-center p-3 bg-slate-900/30 hover:bg-slate-800/25 rounded-xl border border-slate-800/50 hover:border-slate-700/50 cursor-default">
                  <div>
                    <h4 className="text-sm font-bold text-white">{inv.clientName}</h4>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span>{inv.invoiceNumber}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-600" />
                      <span>Créée le {inv.issueDate}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-slate-100 block">{formatCurrency(inv.totalAmount)}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-1 ${
                      inv.status === 'PAID' ? 'bg-accent-500/10 text-accent-400' :
                      inv.status === 'SENT' ? 'bg-warning-500/10 text-warning-400' : 'bg-danger-500/10 text-danger-400'
                    }`}>
                      {inv.status === 'PAID' ? 'Payée' : inv.status === 'SENT' ? 'Envoyée' : 'Retard'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4 transition-all duration-300 hover:border-slate-700/60">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-100">Dépenses Enregistrées par l'IA</h3>
            {expenses.length > 0 && (
              <span className="text-[10px] text-slate-500 font-medium">{expenses.length} total</span>
            )}
          </div>
          {expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Scan className="w-10 h-10 text-slate-700 mb-3" />
              <p className="text-sm font-semibold text-slate-500">Aucune dépense</p>
              <p className="text-[11px] text-slate-600 mt-1">Scannez un reçu ou saisissez une dépense depuis l'onglet Scan</p>
            </div>
          ) : (
            <div className="space-y-2">
              {expenses.slice(0, 4).map((exp, idx) => (
                <div key={idx} className="row-hover flex justify-between items-center p-3 bg-slate-900/30 hover:bg-slate-800/25 rounded-xl border border-slate-800/50 hover:border-slate-700/50 cursor-default">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{exp.supplier}</h4>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span className="text-indigo-400 font-semibold">{exp.category}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-600" />
                        <span>{exp.date}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-danger-400 block">-{formatCurrency(exp.totalAmount)}</span>
                    <span className="text-[10px] text-slate-400 font-medium mt-1 inline-block">Validée</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
