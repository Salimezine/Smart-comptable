import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, AlertCircle, Download, Calendar, FileText, Send, CheckCircle2, Clock, AlertTriangle, Plus } from 'lucide-react';
import { calculateTVASummary, generateTVADeclarations, calculateTVAForecast, getTVAOptimizationSuggestions } from '../utils/smartTVA';
import { computeTVAFromJournal, loadDeclarations, saveDeclaration, updateDeclarationStatus, generateDeclarationPDF } from '../utils/tvaDeclarationService';
import PremiumCard from '../components/PremiumCard';
import KpiCard from '../components/KpiCard';
import SectionHeader from '../components/SectionHeader';
import { supabase, isSupabaseEnabled } from '../utils/supabaseClient';

export default function SmartTVAView({ invoices = [], expenses = [], formatCurrency, companyDetails }) {
  const [useJournal, setUseJournal] = useState(true);
  const [savedDeclarations, setSavedDeclarations] = useState([]);
  const [submitting, setSubmitting] = useState(null);
  const [loadingDecl, setLoadingDecl] = useState(false);

  const currentId = localStorage.getItem('smart_comptable_current_id');
  const company = companyDetails || {};

  const journalDeclarations = useMemo(() => computeTVAFromJournal(), []);
  const invoiceDeclarations = useMemo(() => generateTVADeclarations(invoices, expenses), [invoices, expenses]);
  const declarations = useJournal ? journalDeclarations : invoiceDeclarations;
  const summary = useMemo(() => calculateTVASummary(invoices, expenses), [invoices, expenses]);
  const forecast = useMemo(() => calculateTVAForecast(declarations), [declarations]);
  const suggestions = useMemo(() => getTVAOptimizationSuggestions(summary), [summary]);

  useEffect(() => {
    if (currentId && isSupabaseEnabled()) {
      setLoadingDecl(true);
      loadDeclarations(currentId).then(setSavedDeclarations).catch((e) => console.warn('[TVA] load declarations failed:', e?.message)).finally(() => setLoadingDecl(false));
    }
  }, [currentId]);

  const fmt = (v) => formatCurrency ? formatCurrency(v) : `${(v || 0).toFixed(3)} DT`;

  const chartData = declarations.slice(-12).map(d => ({
    name: d.label?.split(' ')[0] || d.month,
    Collectée: Math.round(d.collected * 100) / 100,
    Déductible: Math.round(d.deductible * 100) / 100,
    Due: Math.round(d.due * 100) / 100,
  }));

  const handleGenerate = async (decl) => {
    if (!currentId || !isSupabaseEnabled()) return;
    setSubmitting(decl.month);
    try {
      const saved = await saveDeclaration(currentId, {
        periode: decl.month,
        collected: decl.collected,
        deductible: decl.deductible,
        due: decl.due,
        credit: decl.credit || 0,
        baseHT: decl.baseHT,
        dueDate: decl.dueDate,
        type: 'mensuelle',
      });
      setSavedDeclarations(prev => [saved, ...prev]);
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
    setSubmitting(null);
  };

  const handleExport = (decl) => {
    generateDeclarationPDF(decl, company);
  };

  const getSavedStatus = (month) => {
    const found = savedDeclarations.find(d => d.periode === month);
    return found ? found : null;
  };

  const STATUS_BADGES = {
    brouillon: { label: 'Brouillon', color: 'text-slate-400 bg-slate-800' },
    soumise: { label: 'Soumise', color: 'text-blue-400 bg-blue-500/10' },
    payee: { label: 'Payée', color: 'text-emerald-400 bg-emerald-500/10' },
    en_retard: { label: 'En retard', color: 'text-red-400 bg-red-500/10' },
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={DollarSign}
        title="Déclaration TVA"
        subtitle="Calcul, génération et suivi des déclarations TVA mensuelles"
      />

      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/30 border border-slate-800/40 rounded-xl">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Source :</span>
          <button onClick={() => setUseJournal(true)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${useJournal ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : 'text-slate-500 hover:text-slate-300'}`}>
            Journal comptable
          </button>
          <button onClick={() => setUseJournal(false)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${!useJournal ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : 'text-slate-500 hover:text-slate-300'}`}>
            Factures + Dépenses
          </button>
        </div>
        <span className="text-[10px] text-slate-500">
          {useJournal ? `${journalDeclarations.reduce((s, d) => s + d.entries, 0)} écritures` : `${invoices.length} factures, ${expenses.length} dépenses`}
        </span>
      </div>

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
                Tendance : {forecast.trend === 'increasing' ? 'Hausse' : forecast.trend === 'decreasing' ? 'Baisse' : 'Stable'}
              </span>
            </div>
          </div>
        </PremiumCard>
      </div>

      {suggestions.length > 0 && (
        <PremiumCard className="p-5">
          <h3 className="text-sm font-bold text-white mb-3">Suggestions d'optimisation</h3>
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white">Déclarations TVA</h3>
        </div>
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
                <th className="pb-3 pr-4 text-center">Statut</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {declarations.length === 0 ? (
                <tr><td colSpan={8} className="py-8 text-center text-slate-500">Aucune déclaration à afficher</td></tr>
              ) : declarations.slice().reverse().map((d, i) => {
                const saved = getSavedStatus(d.month);
                const statut = saved ? saved.statut : (d.due > 0 ? 'due' : 'zero');
                return (
                  <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-3 pr-4 text-slate-200 font-medium">{d.label || d.month}</td>
                    <td className="py-3 pr-4 text-slate-400">{fmt(d.baseHT || d.baseDeductible)}</td>
                    <td className="py-3 pr-4 text-emerald-400">{fmt(d.collected)}</td>
                    <td className="py-3 pr-4 text-amber-400">{fmt(d.deductible)}</td>
                    <td className="py-3 pr-4 text-right font-bold text-white">{fmt(d.due)}</td>
                    <td className="py-3 pr-4 text-center text-slate-400">{d.dueDate}</td>
                    <td className="py-3 pr-4 text-center">
                      {saved ? (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGES[statut]?.color || ''}`}>
                          {STATUS_BADGES[statut]?.label || statut}
                        </span>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          d.due > 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {d.due > 0 ? 'À payer' : 'Néant'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!saved && (
                          <button onClick={() => handleGenerate(d)} disabled={submitting === d.month}
                            className="px-2 py-1.5 rounded-lg bg-brand-600/80 hover:bg-brand-500 disabled:opacity-40 text-white text-[10px] font-semibold transition-colors">
                            {submitting === d.month ? '...' : 'Déclarer'}
                          </button>
                        )}
                        <button onClick={() => handleExport(d)}
                          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors">
                          <Download className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PremiumCard>

      {savedDeclarations.length > 0 && (
        <PremiumCard className="p-5">
          <h3 className="text-sm font-bold text-white mb-4">Historique des déclarations</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-bold">
                  <th className="pb-3 pr-4">Période</th>
                  <th className="pb-3 pr-4 text-right">TVA Due</th>
                  <th className="pb-3 pr-4 text-right">Net payé</th>
                  <th className="pb-3 pr-4 text-center">Statut</th>
                  <th className="pb-3 pr-4 text-center">Soumission</th>
                  <th className="pb-3 text-center">Paiement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {savedDeclarations.map(d => (
                  <tr key={d.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-3 pr-4 text-slate-200 font-medium">{d.periode}</td>
                    <td className="py-3 pr-4 text-right text-white font-bold">{fmt(d.tva_due)}</td>
                    <td className="py-3 pr-4 text-right text-slate-300">{fmt(d.net_a_payer)}</td>
                    <td className="py-3 pr-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGES[d.statut]?.color || ''}`}>
                        {STATUS_BADGES[d.statut]?.label || d.statut}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-center text-slate-400">
                      {d.date_soumission ? new Date(d.date_soumission).toLocaleDateString('fr-FR') : '-'}
                    </td>
                    <td className="py-3 text-center text-slate-400">
                      {d.date_paiement ? new Date(d.date_paiement).toLocaleDateString('fr-FR') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PremiumCard>
      )}

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
