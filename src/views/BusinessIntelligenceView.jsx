import React, { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, PieChart as PieIcon, Activity, Target, Users, Download } from 'lucide-react';
import { predictNextQuarter, forecastCashFlow, getGrowthInsights } from '../utils/predictiveTax';
import { calculateFiscalHealth, generateFiscalReport } from '../utils/fiscalHealthScore';
import PremiumCard from '../components/PremiumCard';
import KpiCard from '../components/KpiCard';
import SectionHeader from '../components/SectionHeader';
import FiscalScoreCard from '../components/FiscalScoreCard';

const COLORS = ['#818cf8', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function BusinessIntelligenceView({ invoices = [], expenses = [], formatCurrency }) {
  const [activeTab, setActiveTab] = useState('overview');

  const fmt = (v) => formatCurrency ? formatCurrency(v) : `${(v || 0).toFixed(3)} DT`;

  const totalRevenue = useMemo(() => invoices.reduce((s, i) => s + (i.totalAmount || 0), 0), [invoices]);
  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + (e.totalAmount || 0), 0), [expenses]);
  const profit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  const predictive = useMemo(() => predictNextQuarter(invoices, expenses, 3), [invoices, expenses]);
  const cashFlow = useMemo(() => forecastCashFlow(invoices, expenses, 6), [invoices, expenses]);
  const insights = useMemo(() => getGrowthInsights(cashFlow), [cashFlow]);
  const health = useMemo(() => calculateFiscalHealth(invoices, expenses), [invoices, expenses]);

  const revenueByMonth = useMemo(() => {
    const map = {};
    invoices.forEach(inv => {
      const d = new Date(inv.issueDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = (map[key] || 0) + (inv.totalAmount || 0);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({
      month: new Date(`${k}-01`).toLocaleString('fr-FR', { month: 'short' }),
      Revenus: Math.round(v * 100) / 100,
    }));
  }, [invoices]);

  const expenseByCategory = useMemo(() => {
    const map = {};
    expenses.forEach(exp => {
      const cat = exp.category || 'Autres';
      map[cat] = (map[cat] || 0) + (exp.totalAmount || 0);
    });
    return Object.entries(map).map(([k, v]) => ({ name: k, value: Math.round(v * 100) / 100 }));
  }, [expenses]);

  const monthlyProfit = useMemo(() => {
    const revMap = {};
    invoices.forEach(i => { const d = new Date(i.issueDate); const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; revMap[k] = (revMap[k]||0)+(i.totalAmount||0); });
    const expMap = {};
    expenses.forEach(e => { const d = new Date(e.date); const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; expMap[k] = (expMap[k]||0)+(e.totalAmount||0); });
    const keys = [...new Set([...Object.keys(revMap), ...Object.keys(expMap)])].sort();
    return keys.map(k => ({
      month: new Date(`${k}-01`).toLocaleString('fr-FR', { month: 'short' }),
      Revenus: revMap[k]||0, Dépenses: expMap[k]||0,
      Profit: (revMap[k]||0)-(expMap[k]||0),
    }));
  }, [invoices, expenses]);

  const clientCount = useMemo(() => new Set(invoices.map(i => i.clientName || i.client)).size, [invoices]);
  const supplierCount = useMemo(() => new Set(expenses.map(e => e.supplier || e.fournisseur)).size, [expenses]);

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={BarChart3}
        title="Business Intelligence"
        subtitle="Analyses avancées, prévisions prédictives et indicateurs de performance financière"
      />

      <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
        {[
          { id: 'overview', label: 'Vue d\'ensemble', icon: Activity },
          { id: 'revenue', label: 'Revenus', icon: TrendingUp },
          { id: 'predictions', label: 'Prévisions IA', icon: Target },
          { id: 'health', label: 'Score fiscal', icon: DollarSign },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-brand-500/20 text-brand-400 border-brand-500/30'
                  : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:border-slate-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <KpiCard icon={TrendingUp} label="Revenus totaux" value={totalRevenue} color="emerald" format={fmt} />
            <KpiCard icon={TrendingDown} label="Dépenses totales" value={totalExpenses} color="red" format={fmt} />
            <KpiCard icon={DollarSign} label="Bénéfice net" value={profit} color={profit >= 0 ? 'brand' : 'red'} format={fmt} />
            <KpiCard icon={Activity} label="Marge nette" value={`${profitMargin.toFixed(1)}%`} color={profitMargin > 15 ? 'emerald' : profitMargin > 5 ? 'amber' : 'red'} />
            <KpiCard icon={Target} label="Score fiscal" value={`${health.score}/100`} color={health.score >= 80 ? 'emerald' : health.score >= 60 ? 'amber' : 'red'} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PremiumCard className="p-5">
              <h3 className="text-sm font-bold text-white mb-4">Revenus mensuels</h3>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={revenueByMonth}>
                  <defs><linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }} />
                  <Area type="monotone" dataKey="Revenus" stroke="#10b981" strokeWidth={2} fill="url(#revGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </PremiumCard>

            <PremiumCard className="p-5">
              <h3 className="text-sm font-bold text-white mb-4">Dépenses par catégorie</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={expenseByCategory} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" paddingAngle={3}>
                    {expenseByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-3 justify-center">
                {expenseByCategory.slice(0, 5).map((c, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: `${COLORS[i]}20`, color: COLORS[i] }}>{c.name}</span>
                ))}
              </div>
            </PremiumCard>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KpiCard icon={Users} label="Clients" value={clientCount} color="violet" />
            <KpiCard icon={Users} label="Fournisseurs" value={supplierCount} color="cyan" />
            <KpiCard icon={BarChart3} label="Transactions" value={invoices.length + expenses.length} color="brand" />
            <KpiCard icon={Target} label="Taux croissance" value={predictive.revenueGrowth > 0 ? `+${predictive.revenueGrowth.toFixed(1)}%` : `${predictive.revenueGrowth.toFixed(1)}%`} color={predictive.trend === 'growth' ? 'emerald' : predictive.trend === 'decline' ? 'red' : 'amber'} />
          </div>

          {insights.length > 0 && (
            <PremiumCard className="p-5">
              <h3 className="text-sm font-bold text-white mb-3">Insights & Tendances</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {insights.map((ins, i) => (
                  <div key={i} className={`p-3 rounded-xl border text-xs ${
                    ins.type === 'positive' ? 'bg-emerald-500/10 border-emerald-500/20' :
                    ins.type === 'warning' ? 'bg-red-500/10 border-red-500/20' : 'bg-blue-500/10 border-blue-500/20'
                  }`}>
                    <span className="text-base mr-1">{ins.icon}</span>
                    <span className="text-slate-200">{ins.message}</span>
                  </div>
                ))}
              </div>
            </PremiumCard>
          )}
        </>
      )}

      {activeTab === 'predictions' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KpiCard icon={Target} label="CA mensuel moyen" value={predictive.averageMonthlyRevenue} color="brand" format={fmt} />
            <KpiCard icon={TrendingUp} label="Croissance" value={`${predictive.revenueGrowth > 0 ? '+' : ''}${predictive.revenueGrowth.toFixed(1)}%`} color={predictive.trend === 'growth' ? 'emerald' : predictive.trend === 'decline' ? 'red' : 'amber'} />
            <KpiCard icon={DollarSign} label="CA annuel estimé" value={predictive.estimatedAnnualRevenue} color="violet" format={fmt} />
            <KpiCard icon={TrendingDown} label="IS estimé annuel" value={predictive.estimatedAnnualTax} color="amber" format={fmt} />
          </div>

          <PremiumCard className="p-5">
            <h3 className="text-sm font-bold text-white mb-4">Prévisions IA sur 3 mois</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-bold">
                    <th className="pb-3 pr-4">Mois</th>
                    <th className="pb-3 pr-4 text-right">Revenus</th>
                    <th className="pb-3 pr-4 text-right">Dépenses</th>
                    <th className="pb-3 pr-4 text-right">TVA</th>
                    <th className="pb-3 pr-4 text-right">IS</th>
                    <th className="pb-3 pr-4 text-right">Profit</th>
                    <th className="pb-3 text-center">Confiance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {predictive.predictions.map((p, i) => (
                    <tr key={i} className="hover:bg-slate-800/20">
                      <td className="py-3 pr-4 font-bold text-white">{p.monthShort}</td>
                      <td className="py-3 pr-4 text-right text-emerald-400 font-medium">{fmt(p.predictedRevenue)}</td>
                      <td className="py-3 pr-4 text-right text-red-400 font-medium">{fmt(p.predictedExpenses)}</td>
                      <td className="py-3 pr-4 text-right text-amber-400 font-medium">{fmt(p.predictedTVA)}</td>
                      <td className="py-3 pr-4 text-right text-violet-400 font-medium">{fmt(p.predictedIS)}</td>
                      <td className="py-3 pr-4 text-right font-bold text-white">{fmt(p.predictedProfit)}</td>
                      <td className="py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          p.confidence >= 80 ? 'bg-emerald-500/10 text-emerald-400' :
                          p.confidence >= 65 ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-500/10 text-slate-400'
                        }`}>{p.confidence}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PremiumCard>

          <PremiumCard className="p-5">
            <h3 className="text-sm font-bold text-white mb-4">Prévision de trésorerie</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={cashFlow}>
                <defs>
                  <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }} />
                <Area type="monotone" dataKey="balance" stroke="#818cf8" strokeWidth={2} fill="url(#balanceGrad)" name="Trésorerie" />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={1.5} fill="none" name="Revenus" />
                <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={1.5} fill="none" name="Dépenses" />
              </AreaChart>
            </ResponsiveContainer>
          </PremiumCard>
        </>
      )}

      {activeTab === 'health' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PremiumCard className="p-6 flex flex-col items-center">
            <FiscalScoreCard score={health.score} label="Santé fiscale" level={health.level} levelColor={health.levelColor} size="lg" />
          </PremiumCard>

          <PremiumCard className="p-5">
            <h3 className="text-sm font-bold text-white mb-3">Détail du score</h3>
            <div className="space-y-2">
              {health.breakdown.map((b, i) => (
                <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-slate-800/30 border border-slate-700/50 text-xs">
                  <span className="text-slate-300">{b.label}</span>
                  <span className={b.impact > 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                    {b.impact > 0 ? '+' : ''}{b.impact}
                  </span>
                </div>
              ))}
            </div>
          </PremiumCard>

          <PremiumCard className="lg:col-span-2 p-5">
            <h3 className="text-sm font-bold text-white mb-3">Recommandations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {health.recommendations.map((r, i) => (
                <div key={i} className={`p-3 rounded-xl border text-xs ${
                  r.priority === 'critical' ? 'bg-red-500/10 border-red-500/20' :
                  r.priority === 'high' ? 'bg-orange-500/10 border-orange-500/20' :
                  r.priority === 'medium' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-blue-500/10 border-blue-500/20'
                }`}>
                  <span className="text-slate-200">{r.message}</span>
                </div>
              ))}
            </div>
          </PremiumCard>
        </div>
      )}

      {activeTab === 'revenue' && (
        <>
          <PremiumCard className="p-5">
            <h3 className="text-sm font-bold text-white mb-4">Profit & Loss mensuel</h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={monthlyProfit}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }} />
                <Bar dataKey="Revenus" fill="#10b981" radius={[4,4,0,0]} />
                <Bar dataKey="Dépenses" fill="#ef4444" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </PremiumCard>

          <PremiumCard className="p-5">
            <h3 className="text-sm font-bold text-white mb-3">Marge bénéficiaire</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <p className="text-xs text-slate-400">Marge brute</p>
                <p className="text-2xl font-extrabold text-brand-400">{profitMargin.toFixed(1)}%</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <p className="text-xs text-slate-400">Ratio charges/CA</p>
                <p className="text-2xl font-extrabold text-amber-400">{totalRevenue > 0 ? ((totalExpenses/totalRevenue)*100).toFixed(1) : 0}%</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <p className="text-xs text-slate-400">Taux croissance</p>
                <p className={`text-2xl font-extrabold ${predictive.revenueGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {predictive.revenueGrowth >= 0 ? '+' : ''}{predictive.revenueGrowth.toFixed(1)}%
                </p>
              </div>
            </div>
          </PremiumCard>
        </>
      )}
    </div>
  );
}
