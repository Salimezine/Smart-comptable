import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Calculator, TrendingUp, Download, Send, FileText, DollarSign, Users, Clock } from 'lucide-react';
import { calculateIRPP, simulateIRPP, getIRPPDeductions } from '../utils/smartIRPP';
import { loadDeclarations, saveDeclaration, updateDeclarationStatus, generateIRPPFromPayroll } from '../utils/socialDeclarationService';
import PremiumCard from '../components/PremiumCard';
import KpiCard from '../components/KpiCard';
import SectionHeader from '../components/SectionHeader';
import { isSupabaseEnabled } from '../utils/supabaseClient';
import { getAllBulletins } from '../utils/payrollStore';

const COLORS = ['#818cf8', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const STATUS_BADGES = {
  brouillon: { label: 'Brouillon', color: 'text-slate-400 bg-slate-800' },
  soumise: { label: 'Soumise', color: 'text-blue-400 bg-blue-500/10' },
  payee: { label: 'Payée', color: 'text-emerald-400 bg-emerald-500/10' },
  en_retard: { label: 'En retard', color: 'text-red-400 bg-red-500/10' },
};

export default function SmartIRPPView({ formatCurrency }) {
  const [revenuImposable, setRevenuImposable] = useState(50000);
  const [tab, setTab] = useState('simulateur');
  const [irppDeclarations, setIrppDeclarations] = useState([]);
  const [cnssDeclarations, setCnssDeclarations] = useState([]);
  const [submitting, setSubmitting] = useState(null);
  const currentId = localStorage.getItem('smart_comptable_current_id');

  useEffect(() => {
    if (currentId && isSupabaseEnabled()) {
      loadDeclarations(currentId, 'irpp_annuelle').then(setIrppDeclarations).catch((e) => console.warn('[IRPP] load irpp failed:', e?.message));
      loadDeclarations(currentId, 'cnss_mensuelle').then(setCnssDeclarations).catch((e) => console.warn('[IRPP] load cnss failed:', e?.message));
    }
  }, [currentId]);

  const allBulletins = useMemo(() => {
    try { return getAllBulletins() || []; } catch { return []; }
  }, []);

  const irpp = useMemo(() => calculateIRPP(revenuImposable), [revenuImposable]);
  const scenarios = [
    { label: '+10%', adjustment: revenuImposable * 0.1 },
    { label: '+20%', adjustment: revenuImposable * 0.2 },
    { label: '-10%', adjustment: -revenuImposable * 0.1 },
    { label: '-20%', adjustment: -revenuImposable * 0.2 },
  ];
  const simulation = useMemo(() => simulateIRPP(revenuImposable, scenarios), [revenuImposable, scenarios]);
  const fmt = (v) => formatCurrency ? formatCurrency(v) : `${(v || 0).toFixed(3)} DT`;

  const trancheData = irpp.tranches
    .filter(t => t.applicable && t.impotPartiel > 0)
    .map(t => ({ name: `${t.taux}%`, value: t.impotPartiel }));

  const anneeActuelle = new Date().getFullYear();

  const handleGenerateIRPP = async () => {
    if (!currentId || !isSupabaseEnabled()) return;
    setSubmitting('irpp');
    try {
      const bulletinsAnnee = allBulletins.filter(b => (b.annee || anneeActuelle) === anneeActuelle);
      const data = generateIRPPFromPayroll(bulletinsAnnee);
      const irppCalc = calculateIRPP(data.totalBrut - data.totalCNSS);
      const maxRev = Math.max(revenuImposable, data.totalBrut);
      await saveDeclaration(currentId, {
        type: 'irpp_annuelle',
        periode: String(anneeActuelle),
        nbEmployes: data.nbEmployes,
        totalBrut: data.totalBrut,
        totalImposable: maxRev,
        irpp: irppCalc.impotBrut,
        rs: data.totalRS,
        css: data.totalCSS,
        netAPayer: irppCalc.impotBrut,
        dueDate: `${anneeActuelle}-03-31`,
        bulletins: bulletinsAnnee,
        reference: `IRPP-${anneeActuelle}`,
      });
      const updated = await loadDeclarations(currentId, 'irpp_annuelle');
      setIrppDeclarations(updated);
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
    setSubmitting(null);
  };

  const handleGenerateCNSS = async () => {
    if (!currentId || !isSupabaseEnabled()) return;
    const mois = new Date().getMonth();
    const annee = new Date().getFullYear();
    const periode = `${annee}-${String(mois).padStart(2, '0')}`;
    setSubmitting(periode);
    try {
      const bulletinsMois = allBulletins.filter(b => b.mois === mois && b.annee === annee);
      const cnssSal = bulletinsMois.reduce((s, b) => s + (b.cnssSal || 0), 0);
      const cnssPat = bulletinsMois.reduce((s, b) => s + (b.cnssPat || 0), 0);
      const totalBrut = bulletinsMois.reduce((s, b) => s + (b.brut || 0), 0);
      const rs = bulletinsMois.reduce((s, b) => s + (b.rsMensuelle || 0), 0);
      await saveDeclaration(currentId, {
        type: 'cnss_mensuelle',
        periode,
        nbEmployes: bulletinsMois.length,
        totalBrut,
        cnssSal,
        cnssPat,
        cnssTotal: cnssSal + cnssPat,
        rs,
        netAPayer: cnssSal + cnssPat,
        dueDate: `${annee}-${String(mois + 1).padStart(2, '0')}-28`,
        reference: `CNSS-${periode}`,
        bulletins: bulletinsMois,
      });
      const updated = await loadDeclarations(currentId, 'cnss_mensuelle');
      setCnssDeclarations(updated);
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
    setSubmitting(null);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Calculator}
        title="IRPP & CNSS — Déclarations sociales"
        subtitle="Calcul IRPP, génération déclaration annuelle, CNSS mensuelle — conforme LF 2026"
      />

      <div className="flex gap-2">
        {['simulateur', 'declarations', 'cnss'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              tab === t ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}>
            {t === 'simulateur' ? 'Simulateur IRPP' : t === 'declarations' ? 'Déclarations IRPP' : 'CNSS Mensuelle'}
          </button>
        ))}
      </div>

      {tab === 'simulateur' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <PremiumCard className="lg:col-span-2 p-5">
              <h3 className="text-sm font-bold text-white mb-4">Simulateur IRPP</h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-xs text-slate-400 font-semibold mb-2">Revenu imposable annuel (DT)</label>
                  <div className="flex gap-3 items-center">
                    <input type="range" min={0} max={500000} step={1000} value={revenuImposable}
                      onChange={e => setRevenuImposable(parseInt(e.target.value))} className="flex-1 accent-brand-500" />
                    <input type="number" value={revenuImposable}
                      onChange={e => setRevenuImposable(parseInt(e.target.value) || 0)}
                      className="w-32 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white text-right focus:outline-none focus:border-brand-500" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
                    <p className="text-[10px] text-slate-400 uppercase">Impôt brut</p>
                    <p className="text-xl font-extrabold text-brand-400 mt-1">{fmt(irpp.impotBrut)}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
                    <p className="text-[10px] text-slate-400 uppercase">Taux effectif</p>
                    <p className="text-xl font-extrabold text-amber-400 mt-1">{irpp.tauxEffectif.toFixed(1)}%</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
                    <p className="text-[10px] text-slate-400 uppercase">Revenu net</p>
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
                    <span className="text-slate-400">{t.taux}%</span><span className="text-slate-300 font-medium">{fmt(t.impotPartiel)}</span>
                  </div>
                ))}
              </div>
            </PremiumCard>
          </div>

          <PremiumCard className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">Simulations</h3>
              <button onClick={() => setTab('simulateur')} className="text-xs text-brand-400 font-semibold">Voir</button>
            </div>
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
                  </div>
                </div>
              ))}
            </div>
          </PremiumCard>

          <PremiumCard className="p-5">
            <h3 className="text-sm font-bold text-white mb-4">Déductions fiscales</h3>
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
        </>
      )}

      {tab === 'declarations' && (
        <>
          <PremiumCard className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">Déclaration IRPP Annuelle {anneeActuelle}</h3>
              <button onClick={handleGenerateIRPP} disabled={submitting === 'irpp'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-[10px] font-semibold transition-colors">
                <Send className="w-3 h-3" />
                {submitting === 'irpp' ? '...' : 'Générer depuis la paie'}
              </button>
            </div>
            {(() => {
              const bulletinsAnnee = allBulletins.filter(b => (b.annee || anneeActuelle) === anneeActuelle);
              const data = generateIRPPFromPayroll(bulletinsAnnee);
              const irppCalc = calculateIRPP(data.totalBrut - data.totalCNSS);
              return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KpiCard icon={Users} label="Employés" value={data.nbEmployes || bulletinsAnnee.length} color="blue" />
                  <KpiCard icon={TrendingUp} label="Masse salariale" value={data.totalBrut} color="brand" format={fmt} />
                  <KpiCard icon={DollarSign} label="IRPP estimé" value={irppCalc.impotBrut} color="violet" format={fmt} />
                  <KpiCard icon={Download} label="RS déjà retenue" value={data.totalRS} color="amber" format={fmt} />
                </div>
              );
            })()}
          </PremiumCard>

          <PremiumCard className="p-5">
            <h3 className="text-sm font-bold text-white mb-4">Historique des déclarations IRPP</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-bold">
                    <th className="pb-3 pr-4 text-left">Année</th>
                    <th className="pb-3 pr-4 text-right">Masse salariale</th>
                    <th className="pb-3 pr-4 text-right">IRPP dû</th>
                    <th className="pb-3 pr-4 text-right">RS retenue</th>
                    <th className="pb-3 pr-4 text-center">Statut</th>
                    <th className="pb-3 text-center">Soumission</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {irppDeclarations.length === 0 ? (
                    <tr><td colSpan={6} className="py-8 text-center text-slate-500">Aucune déclaration IRPP</td></tr>
                  ) : irppDeclarations.map(d => (
                    <tr key={d.id} className="hover:bg-slate-800/20">
                      <td className="py-3 pr-4 text-slate-200 font-medium">{d.periode}</td>
                      <td className="py-3 pr-4 text-right text-slate-300">{fmt(d.total_brut)}</td>
                      <td className="py-3 pr-4 text-right text-brand-400 font-bold">{fmt(d.irpp_annuel)}</td>
                      <td className="py-3 pr-4 text-right text-amber-400">{fmt(d.rs_mensuelle)}</td>
                      <td className="py-3 pr-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGES[d.statut]?.color || ''}`}>
                          {STATUS_BADGES[d.statut]?.label || d.statut}
                        </span>
                      </td>
                      <td className="py-3 text-center text-slate-400">
                        {d.date_soumission ? new Date(d.date_soumission).toLocaleDateString('fr-FR') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PremiumCard>
        </>
      )}

      {tab === 'cnss' && (
        <>
          <PremiumCard className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">Déclaration CNSS Mensuelle</h3>
              <button onClick={handleGenerateCNSS} disabled={submitting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-[10px] font-semibold transition-colors">
                <Send className="w-3 h-3" />
                {submitting ? '...' : 'Déclarer le mois en cours'}
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard icon={Users} label="Employés" value={allBulletins.filter(b => b.mois === new Date().getMonth() && b.annee === new Date().getFullYear()).length} color="blue" />
              <KpiCard icon={TrendingUp} label="Taux salarial" value="9.68%" color="amber" />
              <KpiCard icon={TrendingUp} label="Taux patronal" value="17.07%" color="violet" />
              <KpiCard icon={Clock} label="Échéance" value="28 du mois suivant" color="brand" />
            </div>
          </PremiumCard>

          <PremiumCard className="p-5">
            <h3 className="text-sm font-bold text-white mb-4">Historique CNSS</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-bold">
                    <th className="pb-3 pr-4 text-left">Mois</th>
                    <th className="pb-3 pr-4 text-right">Employés</th>
                    <th className="pb-3 pr-4 text-right">Brut</th>
                    <th className="pb-3 pr-4 text-right">CNSS Sal.</th>
                    <th className="pb-3 pr-4 text-right">CNSS Pat.</th>
                    <th className="pb-3 pr-4 text-right">Total</th>
                    <th className="pb-3 pr-4 text-center">Statut</th>
                    <th className="pb-3 text-center">Échéance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {cnssDeclarations.length === 0 ? (
                    <tr><td colSpan={8} className="py-8 text-center text-slate-500">Aucune déclaration CNSS</td></tr>
                  ) : cnssDeclarations.map(d => (
                    <tr key={d.id} className="hover:bg-slate-800/20">
                      <td className="py-3 pr-4 text-slate-200 font-medium">{d.periode}</td>
                      <td className="py-3 pr-4 text-right text-slate-300">{d.nb_employes}</td>
                      <td className="py-3 pr-4 text-right text-slate-300">{fmt(d.total_brut)}</td>
                      <td className="py-3 pr-4 text-right text-amber-400">{fmt(d.cnss_salarie)}</td>
                      <td className="py-3 pr-4 text-right text-violet-400">{fmt(d.cnss_patronal)}</td>
                      <td className="py-3 pr-4 text-right text-white font-bold">{fmt(d.cnss_total)}</td>
                      <td className="py-3 pr-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGES[d.statut]?.color || ''}`}>
                          {STATUS_BADGES[d.statut]?.label || d.statut}
                        </span>
                      </td>
                      <td className="py-3 text-center text-slate-400">
                        {d.date_echeance ? new Date(d.date_echeance).toLocaleDateString('fr-FR') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PremiumCard>
        </>
      )}
    </div>
  );
}
