import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Building, TrendingUp, Target, Calendar, AlertCircle, Save, History, CheckCircle2, XCircle } from 'lucide-react';
import { calculateIS, simulateIS, calculateProvisionIS, generateISDeclaration, getISDeductions } from '../utils/smartIS';
import { loadDeclarations, saveDeclaration, updateDeclarationStatus, IS_STATUS_BADGES } from '../utils/smartISDeclarationService';
import PremiumCard from '../components/PremiumCard';
import KpiCard from '../components/KpiCard';
import SectionHeader from '../components/SectionHeader';

export default function SmartISView({ formatCurrency, companyDetails, currentCompanyId }) {
  const [resultatFiscal, setResultatFiscal] = useState(100000);
  const [regime, setRegime] = useState('normal');
  const [showSimulation, setShowSimulation] = useState(false);
  const [declarations, setDeclarations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const is = useMemo(() => calculateIS(resultatFiscal, regime), [resultatFiscal, regime]);

  const scenarios = [
    { label: 'Résultat +20%', resultat: resultatFiscal * 1.2 },
    { label: 'Résultat -20%', resultat: resultatFiscal * 0.8 },
    { label: 'Résultat +50%', resultat: resultatFiscal * 1.5 },
    { label: 'Exonération export (50%)', resultat: resultatFiscal * 0.5 },
  ];

  const simulation = useMemo(() => simulateIS(resultatFiscal, scenarios), [resultatFiscal, scenarios]);
  const provisionData = useMemo(() => calculateProvisionIS([{ resultat: resultatFiscal / 12 }]), [resultatFiscal]);

  useEffect(() => {
    if (!currentCompanyId) return;
    loadDeclarations(currentCompanyId).then(setDeclarations).catch((e) => console.warn('[IS] load declarations failed:', e?.message));
  }, [currentCompanyId]);

  const handleDeclare = async () => {
    if (!currentCompanyId || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const exercice = new Date().getFullYear();
      const decl = {
        exercice,
        regime,
        resultatFiscal,
        taux: is.taux,
        impotBrut: is.impotBrut,
        css: is.css.montant,
        impotCSS: is.impotEtCSS,
        acompte1: is.acomptes[0]?.montant || 0,
        acompte2: is.acomptes[1]?.montant || 0,
        acompte3: is.acomptes[2]?.montant || 0,
        totalAcomptes: is.totalAcomptes,
        solde: is.soldeAPayer,
        dateEcheance: `${exercice + 1}-03-31`,
      };
      await saveDeclaration(currentCompanyId, decl);
      setMessage({ type: 'success', text: `Déclaration IS ${exercice} soumise avec succès` });
      const updated = await loadDeclarations(currentCompanyId);
      setDeclarations(updated);
    } catch (e) {
      setMessage({ type: 'error', text: e.message || 'Erreur lors de la sauvegarde' });
    }
    setSaving(false);
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await updateDeclarationStatus(id, status);
      const updated = await loadDeclarations(currentCompanyId);
      setDeclarations(updated);
    } catch {}
  };

  const fmt = (v) => formatCurrency ? formatCurrency(v) : `${(v || 0).toFixed(3)} DT`;

  const acompteData = is.acomptes.map(a => ({
    name: `Acompte ${a.numero}`,
    montant: a.montant,
    echeance: a.echeance,
  }));

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Building}
        title="Module IS Intelligent"
        subtitle="Impôt sur les Sociétés — Calcul, CSS, simulation, acomptes et déclaration"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Building} label="Résultat fiscal" value={resultatFiscal} color="brand" format={fmt} />
        <KpiCard icon={TrendingUp} label="IS Brut" value={is.impotBrut} color="violet" format={fmt} />
        <KpiCard icon={Target} label="Taux appliqué" value={`${(is.taux * 100).toFixed(0)}%`} color="amber" />
        <KpiCard icon={AlertCircle} label="Solde à payer" value={is.soldeAPayer} color={is.soldeAPayer > 0 ? 'red' : 'emerald'} format={fmt} />
        <KpiCard icon={Target} label="CSS" value={`${(is.css.taux * 100).toFixed(0)}%`} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <PremiumCard className="lg:col-span-2 p-5">
          <h3 className="text-sm font-bold text-white mb-4">Simulateur IS</h3>
          <div className="space-y-6">
            <div className="flex gap-4 items-start">
              <div className="flex-1">
                <label className="block text-xs text-slate-400 font-semibold mb-2">Résultat fiscal annuel (DT)</label>
                <input
                  type="number"
                  value={resultatFiscal}
                  onChange={e => setResultatFiscal(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-right text-lg font-bold focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-2">Régime</label>
                <select
                  value={regime}
                  onChange={e => setRegime(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-500"
                >
                  <option value="agriculture">Agriculture, pêche, artisanat (10%)</option>
                  <option value="industrie_export">Industrie, export (15%)</option>
                  <option value="reduit_petites_entreprises">Petites entreprises — régime réduit (15%)</option>
                  <option value="commerce_services">Commerce et services (20%)</option>
                  <option value="normal">Droit commun — trading (25%)</option>
                  <option value="etablissements_stables">Établissements stables (25%)</option>
                  <option value="secteurs_reglementes">Grandes surfaces, concessionnaires (35%)</option>
                  <option value="banques">Banques, assurances, télécoms (40%)</option>
                  <option value="societes_civiles">Sociétés civiles (35%)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">IS à payer</p>
                <p className="text-xl font-extrabold text-brand-400 mt-1">{fmt(is.impotBrut)}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">CSS</p>
                <p className="text-xl font-extrabold text-amber-400 mt-1">{fmt(is.css.montant)}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Acomptes</p>
                <p className="text-xl font-extrabold text-amber-400 mt-1">{fmt(is.totalAcomptes)}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Solde</p>
                <p className={`text-xl font-extrabold mt-1 ${is.soldeAPayer > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {fmt(is.soldeAPayer)}
                </p>
              </div>
            </div>
          </div>
        </PremiumCard>

        <PremiumCard className="p-5">
          <h3 className="text-sm font-bold text-white mb-4">Acomptes provisionnels</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={acompteData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }} />
              <Bar dataKey="montant" fill="#818cf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-3">
            {is.acomptes.map((a, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-slate-400">Acompte {a.numero} ({a.echeance})</span>
                <span className="text-white font-bold">{fmt(a.montant)}</span>
              </div>
            ))}
          </div>
        </PremiumCard>
      </div>

      <PremiumCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white">Simulations & Scénarios</h3>
          <button onClick={() => setShowSimulation(!showSimulation)} className="text-xs text-brand-400 hover:text-brand-300 font-semibold">
            {showSimulation ? 'Masquer' : 'Voir les simulations'}
          </button>
        </div>
        {showSimulation && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {simulation.simulations.map((s, i) => (
              <div key={i} className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <p className="text-xs font-bold text-white mb-2">{s.label}</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-slate-400">IS</span><span className="font-bold text-white">{fmt(s.impot)}</span></div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Écart</span>
                    <span className={s.difference > 0 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                      {s.difference > 0 ? '+' : ''}{fmt(s.difference)}
                    </span>
                  </div>
                  {s.economie > 0 && (
                    <div className="flex justify-between"><span className="text-emerald-400">Économie</span><span className="text-emerald-400 font-bold">{fmt(s.economie)}</span></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </PremiumCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PremiumCard className="p-5">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-amber-400" />
            Déductions & Avantages fiscaux
          </h3>
          <div className="space-y-2">
            {getISDeductions().map((d, i) => (
              <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-slate-800/30 border border-slate-700/50">
                <div><p className="text-xs font-bold text-white">{d.label}</p><p className="text-[10px] text-slate-400">{d.taux}</p></div>
              </div>
            ))}
          </div>
        </PremiumCard>

        <PremiumCard className="p-5">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-400" />
            Calendrier IS
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between p-3 rounded-xl bg-slate-800/30">
              <span className="text-slate-400">1er acompte (30%)</span>
              <span className="text-white font-bold">25 juin</span>
            </div>
            <div className="flex justify-between p-3 rounded-xl bg-slate-800/30">
              <span className="text-slate-400">2ème acompte (30%)</span>
              <span className="text-white font-bold">25 septembre</span>
            </div>
            <div className="flex justify-between p-3 rounded-xl bg-slate-800/30">
              <span className="text-slate-400">3ème acompte (40%)</span>
              <span className="text-white font-bold">25 décembre</span>
            </div>
            <div className="flex justify-between p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <span className="text-slate-300 font-bold">Déclaration annuelle</span>
              <span className="text-red-400 font-bold">31 mars N+1</span>
            </div>
          </div>
        </PremiumCard>
      </div>

      <PremiumCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Save className="w-4 h-4 text-brand-400" />
            Déclaration IS
          </h3>
          <button
            onClick={handleDeclare}
            disabled={saving || !currentCompanyId}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-colors"
          >
            {saving ? 'Enregistrement...' : 'Soumettre la déclaration'}
          </button>
        </div>
        {message && (
          <div className={`mb-3 px-4 py-2 rounded-xl text-xs font-semibold ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
            {message.text}
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-800/30"><span className="text-slate-400">Exercice</span><p className="text-white font-bold">{new Date().getFullYear()}</p></div>
          <div className="p-3 rounded-xl bg-slate-800/30"><span className="text-slate-400">IS brut</span><p className="text-brand-400 font-bold">{fmt(is.impotBrut)}</p></div>
          <div className="p-3 rounded-xl bg-slate-800/30"><span className="text-slate-400">Acomptes versés</span><p className="text-amber-400 font-bold">{fmt(is.totalAcomptes)}</p></div>
          <div className="p-3 rounded-xl bg-slate-800/30"><span className="text-slate-400">Solde</span><p className="text-red-400 font-bold">{fmt(is.soldeAPayer)}</p></div>
        </div>
      </PremiumCard>

      <PremiumCard className="p-5">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <History className="w-4 h-4 text-violet-400" />
          Historique des déclarations IS
        </h3>
        {declarations.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">Aucune déclaration enregistrée</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700/50 text-slate-400 uppercase tracking-wider">
                  <th className="px-3 py-2 text-left">Exercice</th>
                  <th className="px-3 py-2 text-left">Régime</th>
                  <th className="px-3 py-2 text-right">Résultat</th>
                  <th className="px-3 py-2 text-right">IS brut</th>
                  <th className="px-3 py-2 text-right">CSS</th>
                  <th className="px-3 py-2 text-right">Acomptes</th>
                  <th className="px-3 py-2 text-right">Solde</th>
                  <th className="px-3 py-2 text-center">Statut</th>
                  <th className="px-3 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {declarations.map(d => {
                  const badge = IS_STATUS_BADGES[d.statut] || IS_STATUS_BADGES.brouillon;
                  return (
                    <tr key={d.id} className="hover:bg-slate-800/20">
                      <td className="px-3 py-2 text-white font-bold">{d.exercice}</td>
                      <td className="px-3 py-2 text-slate-300">{d.regime}</td>
                      <td className="px-3 py-2 text-right text-white">{fmt(d.resultat_fiscal)}</td>
                      <td className="px-3 py-2 text-right text-brand-400">{fmt(d.impot_brut)}</td>
                      <td className="px-3 py-2 text-right text-amber-400">{fmt(d.css)}</td>
                      <td className="px-3 py-2 text-right text-slate-300">{fmt(d.total_acomptes)}</td>
                      <td className="px-3 py-2 text-right text-red-400">{fmt(d.solde)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex gap-1 justify-center">
                          {d.statut === 'soumise' && (
                            <button onClick={() => handleUpdateStatus(d.id, 'payee')} className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" title="Marquer payée">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {d.statut !== 'soumise' && d.statut !== 'payee' && (
                            <button onClick={() => handleUpdateStatus(d.id, 'soumise')} className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20" title="Marquer soumise">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PremiumCard>
    </div>
  );
}
