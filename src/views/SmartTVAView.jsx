import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, AlertCircle, Download, Calendar } from 'lucide-react';
import { calculateTVASummary, generateTVADeclarations, calculateTVAForecast, getTVAOptimizationSuggestions } from '../utils/smartTVA';
import PremiumCard from '../components/PremiumCard';
import KpiCard from '../components/KpiCard';
import SectionHeader from '../components/SectionHeader';

export default function SmartTVAView({ invoices = [], expenses = [], formatCurrency }) {
  const summary = useMemo(() => calculateTVASummary(invoices, expenses), [invoices, expenses]);
  const declarations = useMemo(() => generateTVADeclarations(invoices, expenses), [invoices, expenses]);
  const forecast = useMemo(() => calculateTVAForecast(declarations), [declarations]);
  const suggestions = useMemo(() => getTVAOptimizationSuggestions(summary), [summary]);

  const fmt = (v) => formatCurrency ? formatCurrency(v) : `${(v || 0).toFixed(3)} DT`;

  const chartData = declarations.slice(-12).map(d => ({
    name: d.label?.split(' ')[0] || d.month,
    Collectée: Math.round(d.collected * 100) / 100,
    Déductible: Math.round(d.deductible * 100) / 100,
    Due: Math.round(d.due * 100) / 100,
  }));

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={DollarSign}
        title="Module TVA Intelligent"
        subtitle="Gestion complète de la TVA : collecte, déduction, déclarations et prévisions"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={TrendingUp} label="TVA Collectée" value={summary.totalCollected} color="emerald" format={fmt} />
        <KpiCard icon={TrendingDown} label="TVA Déductible" value={summary.totalDeductible} color="amber" format={fmt} />
        <KpiCard icon={AlertCircle} label="TVA Due" value={summary.tvaDue} color="violet" format={fmt} />
        <KpiCard icon={DollarSign} label="Crédit TVA" value={summary.tvaCredit} color={summary.tvaCredit > 0 ? 'cyan' : 'brand'} format={fmt} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <PremiumCard className="lg:col-span-2 p-5">
          <h3 className="text-sm font-bold text-white mb-4">Évolution TVA mensuelle</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }} />
              <Bar dataKey="Collectée" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Déductible" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Due" fill="#818cf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </PremiumCard>

        <PremiumCard className="p-5">
          <h3 className="text-sm font-bold text-white mb-4">Prévision trimestrielle</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
              <span>Moyenne mensuelle</span>
              <span className="text-brand-400 font-bold">{fmt(forecast.averageMonthly)}</span>
            </div>
            {forecast.forecast.map((f, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-slate-300">{f.month}</span>
                <span className="text-amber-400 font-bold">{fmt(f.estimatedTVA)}</span>
              </div>
            ))}
            <div className="mt-3 pt-3 border-t border-slate-800">
              <span className={`text-[10px] font-semibold ${
                forecast.trend === 'increasing' ? 'text-red-400' : forecast.trend === 'decreasing' ? 'text-emerald-400' : 'text-slate-400'
              }`}>
                Tendance : {forecast.trend === 'increasing' ? '📈 Hausse' : forecast.trend === 'decreasing' ? '📉 Baisse' : '➡️ Stable'}
              </span>
            </div>
          </div>
        </PremiumCard>
      </div>

      {suggestions.length > 0 && (
        <PremiumCard className="p-5">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <LightbulbIcon className="w-4 h-4 text-amber-400" />
            Suggestions d'optimisation
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {suggestions.map((s, i) => (
              <div key={i} className={`p-3 rounded-xl border ${s.priority === 'high' ? 'bg-orange-500/10 border-orange-500/20' : 'bg-blue-500/10 border-blue-500/20'}`}>
                <p className="text-sm font-bold text-white">{s.icon} {s.title}</p>
                <p className="text-xs text-slate-400 mt-1">{s.description}</p>
              </div>
            ))}
          </div>
        </PremiumCard>
      )}

      <PremiumCard className="p-5">
        <h3 className="text-sm font-bold text-white mb-4">Déclarations TVA</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-bold">
                <th className="pb-3 pr-4">Période</th>
                <th className="pb-3 pr-4">Base HT</th>
                <th className="pb-3 pr-4">Collectée</th>
                <th className="pb-3 pr-4">Déductible</th>
                <th className="pb-3 pr-4 text-right">Due</th>
                <th className="pb-3 pr-4 text-center">Échéance</th>
                <th className="pb-3 text-center">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {declarations.length === 0 ? (
                <tr><td colSpan={7} className="py-8 text-center text-slate-500">Aucune déclaration à afficher</td></tr>
              ) : declarations.slice().reverse().map((d, i) => (
                <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                  <td className="py-3 pr-4 text-slate-200 font-medium">{d.label || d.month}</td>
                  <td className="py-3 pr-4 text-slate-400">{fmt(d.baseHT || d.baseDeductible)}</td>
                  <td className="py-3 pr-4 text-emerald-400">{fmt(d.collected)}</td>
                  <td className="py-3 pr-4 text-amber-400">{fmt(d.deductible)}</td>
                  <td className="py-3 pr-4 text-right font-bold text-white">{fmt(d.due)}</td>
                  <td className="py-3 pr-4 text-center text-slate-400">{d.dueDate}</td>
                  <td className="py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      d.due > 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
                    }`}>
                      {d.due > 0 ? 'À payer' : 'Néant'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PremiumCard>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PremiumCard className="p-4 text-center">
          <p className="text-[11px] text-slate-400 uppercase tracking-wider">Taux 19%</p>
          <p className="text-lg font-extrabold text-brand-400 mt-1">{fmt(summary.collectedByRate[19] || 0)}</p>
          <p className="text-[10px] text-slate-500">Collectée</p>
        </PremiumCard>
        <PremiumCard className="p-4 text-center">
          <p className="text-[11px] text-slate-400 uppercase tracking-wider">Taux 13%</p>
          <p className="text-lg font-extrabold text-brand-400 mt-1">{fmt(summary.collectedByRate[13] || 0)}</p>
          <p className="text-[10px] text-slate-500">Collectée</p>
        </PremiumCard>
        <PremiumCard className="p-4 text-center">
          <p className="text-[11px] text-slate-400 uppercase tracking-wider">Taux 7%</p>
          <p className="text-lg font-extrabold text-brand-400 mt-1">{fmt(summary.collectedByRate[7] || 0)}</p>
          <p className="text-[10px] text-slate-500">Collectée</p>
        </PremiumCard>
      </div>
    </div>
  );
}

function LightbulbIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 006 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" /><path d="M10 22h4" />
    </svg>
  );
}
