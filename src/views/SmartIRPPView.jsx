import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Calculator, TrendingUp, Users, Target, AlertCircle } from 'lucide-react';
import { calculateIRPP, simulateIRPP, getIRPPDeductions } from '../utils/smartIRPP';
import PremiumCard from '../components/PremiumCard';
import KpiCard from '../components/KpiCard';
import SectionHeader from '../components/SectionHeader';

const COLORS = ['#818cf8', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function SmartIRPPView({ formatCurrency }) {
  const [revenuImposable, setRevenuImposable] = useState(50000);
  const [showSimulation, setShowSimulation] = useState(false);

  const irpp = useMemo(() => calculateIRPP(revenuImposable), [revenuImposable]);

  const scenarios = [
    { label: '+10% de revenus', adjustment: revenuImposable * 0.1 },
    { label: '+20% de revenus', adjustment: revenuImposable * 0.2 },
    { label: '-10% de revenus', adjustment: -revenuImposable * 0.1 },
    { label: '-20% de revenus', adjustment: -revenuImposable * 0.2 },
  ];

  const simulation = useMemo(() => simulateIRPP(revenuImposable, scenarios), [revenuImposable, scenarios]);

  const fmt = (v) => formatCurrency ? formatCurrency(v) : `${(v || 0).toFixed(3)} DT`;

  const trancheData = irpp.tranches
    .filter(t => t.applicable && t.impotPartiel > 0)
    .map(t => ({ name: `${t.taux}%`, value: t.impotPartiel }));

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Calculator}
        title="Module IRPP Intelligent"
        subtitle="Calcul automatique de l'Impôt sur le Revenu des Personnes Physiques — Barème 2026"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <PremiumCard className="lg:col-span-2 p-5">
          <h3 className="text-sm font-bold text-white mb-4">Simulateur IRPP</h3>
          <div className="space-y-6">
            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-2">Revenu imposable annuel (DT)</label>
              <div className="flex gap-3 items-center">
                <input
                  type="range"
                  min={0}
                  max={500000}
                  step={1000}
                  value={revenuImposable}
                  onChange={e => setRevenuImposable(parseInt(e.target.value))}
                  className="flex-1 accent-brand-500"
                />
                <input
                  type="number"
                  value={revenuImposable}
                  onChange={e => setRevenuImposable(parseInt(e.target.value) || 0)}
                  className="w-32 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white text-right focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Impôt brut</p>
                <p className="text-xl font-extrabold text-brand-400 mt-1">{fmt(irpp.impotBrut)}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Taux effectif</p>
                <p className="text-xl font-extrabold text-amber-400 mt-1">{irpp.tauxEffectif.toFixed(1)}%</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Revenu net</p>
                <p className="text-xl font-extrabold text-emerald-400 mt-1">{fmt(revenuImposable - irpp.impotBrut)}</p>
              </div>
            </div>
          </div>
        </PremiumCard>

        <PremiumCard className="p-5">
          <h3 className="text-sm font-bold text-white mb-4">Répartition par tranche</h3>
          {trancheData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={trancheData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                  {trancheData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-slate-500 text-center py-10">Aucun impôt dû en dessous de 5 000 DT</p>
          )}
          <div className="space-y-1.5 mt-3">
            {irpp.tranches.filter(t => t.applicable).map((t, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-slate-400">{t.taux}%</span>
                <span className="text-slate-300 font-medium">{fmt(t.impotPartiel)}</span>
              </div>
            ))}
          </div>
        </PremiumCard>
      </div>

      <PremiumCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white">Simulations & Scénarios</h3>
          <button
            onClick={() => setShowSimulation(!showSimulation)}
            className="text-xs text-brand-400 hover:text-brand-300 font-semibold"
          >
            {showSimulation ? 'Masquer' : 'Voir les simulations'}
          </button>
        </div>
        {showSimulation && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {simulation.simulations.map((s, i) => (
              <div key={i} className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <p className="text-xs font-bold text-white mb-2">{s.label}</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-slate-400">Impôt</span><span className="font-bold text-white">{fmt(s.impotBrut)}</span></div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Écart</span>
                    <span className={`font-bold ${s.difference > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{s.difference > 0 ? '+' : ''}{fmt(s.difference)}</span>
                  </div>
                  {s.economie > 0 && (
                    <div className="flex justify-between"><span className="text-slate-400">Économie</span><span className="font-bold text-emerald-400">{fmt(s.economie)}</span></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </PremiumCard>

      <PremiumCard className="p-5">
        <h3 className="text-sm font-bold text-white mb-4">Déductions fiscales IRPP</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {getIRPPDeductions().map((d, i) => (
            <div key={i} className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/50">
              <p className="text-xs font-bold text-white">{d.label}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{d.description}</p>
              <p className="text-[10px] text-brand-400 font-semibold mt-1">Plafond : {d.plafond.toLocaleString('fr-FR')} DT</p>
            </div>
          ))}
        </div>
      </PremiumCard>
    </div>
  );
}
