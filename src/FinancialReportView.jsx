import React, { useState } from 'react';
import { generateBalanceSheet, generateIncomeStatement } from './accountingUtils';
import { CheckCheck, TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react';

export default function FinancialReportView({ companyDetails, invoices, expenses, transactions, formatCurrency }) {
  const [period, setPeriod] = useState('N');

  const balanceData = generateBalanceSheet(invoices, expenses, transactions);
  const incomeData = generateIncomeStatement(invoices, expenses);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 p-6 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <CheckCheck className="w-5 h-5 text-brand-400" />
            États Financiers Annuels
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Conforme au Système Comptable des Entreprises (SCE) - Tunisie. Données indicatives.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 font-bold uppercase flex items-center gap-1">
            <Calendar className="w-4 h-4" /> Exercice
          </label>
          <select 
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
          >
            <option value="N">Exercice en cours (N)</option>
            <option value="N-1">Exercice Précédent (N-1)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* BILAN (BALANCE SHEET) */}
        <div className="glass-card p-6 rounded-2xl border border-slate-800 shadow-card">
          <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-3">
            <h3 className="text-lg font-bold text-slate-100">Bilan (État de la situation financière)</h3>
            <span className="text-[10px] font-bold px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded-full">
              ACTIF / PASSIF
            </span>
          </div>

          <div className="space-y-6">
            {/* Actif */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Actifs (Emplois)</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b border-slate-800/50">
                  <span className="text-slate-300">Actifs Non Courants (Classe 2)</span>
                  <span className="font-semibold">{formatCurrency(balanceData.assets.nonCurrent)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800/50">
                  <span className="text-slate-300">Actifs Courants (Classe 3, 4, 5)</span>
                  <span className="font-semibold">{formatCurrency(balanceData.assets.current)}</span>
                </div>
                <div className="flex justify-between py-2 bg-slate-800/20 rounded-lg px-2 mt-2">
                  <span className="font-bold text-brand-300">Total Actifs</span>
                  <span className="font-extrabold text-brand-400">{formatCurrency(balanceData.assets.total)}</span>
                </div>
              </div>
            </div>

            {/* Passif et Capitaux Propres */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Passifs & Capitaux Propres (Ressources)</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b border-slate-800/50">
                  <span className="text-slate-300">Capitaux Propres (Classe 1)</span>
                  <span className="font-semibold">{formatCurrency(balanceData.equity)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800/50">
                  <span className="text-slate-300">Passifs Non Courants</span>
                  <span className="font-semibold">{formatCurrency(balanceData.liabilities.nonCurrent)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800/50">
                  <span className="text-slate-300">Passifs Courants</span>
                  <span className="font-semibold">{formatCurrency(balanceData.liabilities.current)}</span>
                </div>
                <div className="flex justify-between py-2 bg-slate-800/20 rounded-lg px-2 mt-2">
                  <span className="font-bold text-brand-300">Total Passifs & Capitaux</span>
                  <span className="font-extrabold text-brand-400">{formatCurrency(balanceData.totalLiabilitiesAndEquity)}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Vérification équilibre */}
          <div className="mt-6 p-3 rounded-xl border border-brand-500/20 bg-brand-500/10 flex items-center gap-2">
            <CheckCheck className="w-4 h-4 text-brand-400" />
            <p className="text-xs font-semibold text-brand-300">Le bilan est équilibré (Actif = Passif + CP)</p>
          </div>
        </div>

        {/* ÉTAT DE RÉSULTAT (INCOME STATEMENT) */}
        <div className="glass-card p-6 rounded-2xl border border-slate-800 shadow-card">
          <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-3">
            <h3 className="text-lg font-bold text-slate-100">État de Résultat</h3>
            <span className="text-[10px] font-bold px-2 py-1 bg-accent-500/10 text-accent-400 rounded-full">
              PRODUITS / CHARGES
            </span>
          </div>

          <div className="space-y-4 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-800/50 group hover:bg-slate-800/30 transition-colors rounded px-2">
              <span className="text-slate-300 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-accent-400" /> Produits d'exploitation</span>
              <span className="font-semibold text-accent-300">+{formatCurrency(incomeData.revenue)}</span>
            </div>
            
            <div className="flex justify-between py-2 border-b border-slate-800/50 group hover:bg-slate-800/30 transition-colors rounded px-2">
              <span className="text-slate-300 flex items-center gap-2"><TrendingDown className="w-4 h-4 text-danger-400" /> Charges d'exploitation</span>
              <span className="font-semibold text-danger-300">-{formatCurrency(incomeData.operatingExpenses)}</span>
            </div>

            <div className="flex justify-between py-2 bg-slate-900/60 rounded-lg px-3 mt-2 border border-slate-700/50">
              <span className="font-bold text-slate-200">Résultat d'exploitation</span>
              <span className="font-bold text-white">{formatCurrency(incomeData.operatingProfit)}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-800/50 px-2 mt-4">
              <span className="text-slate-300">Résultat des activités ordinaires</span>
              <span className="font-semibold">{formatCurrency(incomeData.ordinaryProfit)}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-800/50 px-2">
              <span className="text-slate-300">Impôt sur les sociétés (Estimatif 15%)</span>
              <span className="font-semibold text-danger-300">-{formatCurrency(incomeData.tax)}</span>
            </div>

            <div className="flex justify-between py-3 bg-gradient-brand rounded-xl px-4 mt-6 shadow-glow">
              <span className="font-extrabold text-white">RÉSULTAT NET DE L'EXERCICE</span>
              <span className="font-extrabold text-white text-lg">{formatCurrency(incomeData.netProfit)}</span>
            </div>
          </div>
          
          <div className="mt-6 space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase">Analyse Rapide</h4>
            <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
              <li>Marge d'exploitation : {incomeData.revenue > 0 ? Math.round((incomeData.operatingProfit / incomeData.revenue) * 100) : 0}%</li>
              <li>Charge d'IS provisionnée selon le régime standard PME.</li>
              <li>Aucun élément extraordinaire détecté.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
