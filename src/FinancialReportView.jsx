import React, { useState, useEffect } from 'react';
import { generateBalanceSheet, generateIncomeStatement, getFinancialExportData } from './accountingUtils';
import { exportBalanceSheetPDF, exportIncomeStatementPDF } from './pdfExport';
import { exportToExcel } from './excelExport';
import { CheckCheck, TrendingUp, TrendingDown, Calendar, FileText, FileSpreadsheet, Edit, ChevronDown, ChevronRight } from 'lucide-react';

const CUSTOM_DATA_KEY = 'sc_bilan_custom_data';

const fmt = (v) => {
  if (v == null || isNaN(v)) return '0,000 MDT';
  return v.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' MDT';
};

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-800/50 pb-2 mb-2">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1 text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 w-full text-left">
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {title}
      </button>
      {open && children}
    </div>
  );
}

function Line({ label, value, indent = 0, color, bold, total }) {
  return (
    <div className={`flex justify-between py-1 ${total ? 'bg-indigo-500/5 rounded-lg px-2 -mx-2' : ''} ${bold ? '' : 'text-slate-400'}`}>
      <span className={`text-xs ${total ? 'font-bold text-brand-300' : bold ? 'font-semibold text-slate-300' : ''}`}
        style={{ paddingLeft: indent * 12 }}>
        {label}
      </span>
      <span className={`text-xs font-semibold ${color || (total ? 'text-brand-400' : 'text-slate-300')}`}>
        {typeof value === 'number' ? fmt(value) : value}
      </span>
    </div>
  );
}

function InputLine({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-slate-400">{label}</span>
      <input type="number" step="0.001"
        value={value}
        onChange={onChange}
        className="w-28 text-right bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-slate-100 focus:outline-none focus:border-brand-500 text-xs" />
    </div>
  );
}

export default function FinancialReportView({ companyDetails, invoices, expenses, transactions, formatCurrency }) {
  const [period, setPeriod] = useState('N');
  const [editing, setEditing] = useState(false);
  const [customData, setCustomData] = useState(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_DATA_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  });

  useEffect(() => {
    localStorage.setItem(CUSTOM_DATA_KEY, JSON.stringify(customData));
  }, [customData]);

  const incomeData = generateIncomeStatement(invoices, expenses);
  const balanceData = generateBalanceSheet(invoices, expenses, transactions, customData, incomeData);

  const updateCustom = (key, val) => {
    const v = parseFloat(val);
    setCustomData(prev => ({ ...prev, [key]: isNaN(v) ? undefined : v }));
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 p-6 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <CheckCheck className="w-5 h-5 text-brand-400" />
            États Financiers (SCE)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Conforme au SCE Tunisie. <Edit className="w-3 h-3 inline" /> pour modifier.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-xs text-slate-400 font-bold uppercase flex items-center gap-1">
            <Calendar className="w-4 h-4" /> Exercice
          </label>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500">
            <option value="N">N</option>
            <option value="N-1">N-1</option>
          </select>
          <button onClick={() => {
            try {
              exportBalanceSheetPDF(getFinancialExportData(invoices, expenses, transactions, companyDetails, customData));
            } catch(e) { console.error('PDF export error:', e); alert('Erreur PDF: ' + e.message); }
          }}
            className="flex items-center gap-1 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl transition-colors">
            <FileText className="w-3.5 h-3.5" /> PDF
          </button>
          <button onClick={() => { exportToExcel(invoices, expenses, transactions, companyDetails, customData).catch(console.error); }}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* BILAN */}
        <div className="glass-card p-5 rounded-2xl border border-slate-800 shadow-card">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-slate-100">Bilan (SCE)</h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded-full">ACTIF / PASSIF</span>
              <button onClick={() => setEditing(!editing)} className="text-slate-400 hover:text-brand-400 transition-colors p-1">
                <Edit className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* ACTIFS */}
          <Section title="Actifs Non Courants">
            {editing ? (
              <>
                <InputLine label="Immobilisations incorporelles" value={customData.immobilisationsIncorporelles ?? balanceData.assets.nonCurrent.intangible}
                  onChange={(e) => updateCustom('immobilisationsIncorporelles', e.target.value)} />
                <InputLine label="Immobilisations corporelles" value={customData.immobilisationsCorporelles ?? balanceData.assets.nonCurrent.tangible}
                  onChange={(e) => updateCustom('immobilisationsCorporelles', e.target.value)} />
              </>
            ) : (
              <>
                <Line label="Frais de développement" value={balanceData.assets.nonCurrent.intangibleDetail.devCosts} indent={1} />
                <Line label="Brevets, licences, marques" value={balanceData.assets.nonCurrent.intangibleDetail.patents} indent={1} />
                <Line label="Fonds commercial" value={balanceData.assets.nonCurrent.intangibleDetail.goodwill} indent={1} />
                <Line label="Immobilisations incorporelles" value={balanceData.assets.nonCurrent.intangible} bold />
                <Line label="Terrains" value={balanceData.assets.nonCurrent.tangibleDetail.land} indent={1} />
                <Line label="Constructions" value={balanceData.assets.nonCurrent.tangibleDetail.buildings} indent={1} />
                <Line label="Installations techniques" value={balanceData.assets.nonCurrent.tangibleDetail.equipment} indent={1} />
                <Line label="Matériel de transport" value={balanceData.assets.nonCurrent.tangibleDetail.transport} indent={1} />
                <Line label="Mobilier & mat. bureau" value={balanceData.assets.nonCurrent.tangibleDetail.officeEquip} indent={1} />
                <Line label="Immobilisations corporelles" value={balanceData.assets.nonCurrent.tangible} bold />
                <Line label="Immobilisations financières" value={balanceData.assets.nonCurrent.financial} />
              </>
            )}
            <Line label="Total Actifs Non Courants" value={balanceData.assets.nonCurrent.total} total />
          </Section>

          <Section title="Actifs Courants">
            {editing && (
              <InputLine label="Stocks" value={customData.stocks ?? balanceData.assets.current.stocks}
                onChange={(e) => updateCustom('stocks', e.target.value)} />
            )}
            <Line label="Marchandises" value={balanceData.assets.current.stockDetail.merchandise} indent={1} />
            <Line label="Matières premières" value={balanceData.assets.current.stockDetail.rawMaterials} indent={1} />
            <Line label="Stocks" value={balanceData.assets.current.stocks} bold />
            <Line label="Clients et comptes rattachés" value={balanceData.assets.current.receivables} />
            <Line label="Personnel" value={balanceData.assets.current.personnelRec} indent={1} />
            <Line label="État et collectivités" value={balanceData.assets.current.taxRec} indent={1} />
            <Line label="Autres débiteurs" value={balanceData.assets.current.otherRec} indent={1} />
            <Line label="Banque" value={balanceData.assets.current.cashAndBank} />
            <Line label="Caisse" value={balanceData.assets.current.cashRegister} indent={1} />
            <Line label="Total Actifs Courants" value={balanceData.assets.current.total} total />
          </Section>

          <Line label="TOTAL ACTIFS" value={balanceData.assets.total} total />

          <div className="mt-4 border-t border-slate-800 pt-4">
            <Section title="Capitaux Propres">
              {editing ? (
                <InputLine label="Capital social" value={customData.capitalSocial ?? balanceData.equity.socialCapital}
                  onChange={(e) => updateCustom('capitalSocial', e.target.value)} />
              ) : (
                <Line label="Capital social" value={balanceData.equity.socialCapital} />
              )}
              <Line label="Réserves légales" value={balanceData.equity.legalReserve} />
              <Line label="Autres réserves" value={balanceData.equity.otherReserves} indent={1} />
              <Line label="Résultat net de l'exercice" value={balanceData.equity.retainedEarnings} />
              <Line label="Total Capitaux Propres" value={balanceData.equity.total} total />
            </Section>

            <Section title="Passifs Non Courants">
              {editing ? (
                <InputLine label="Emprunts bancaires" value={customData.empruntsBancaires ?? balanceData.liabilities.nonCurrent.bankLoans}
                  onChange={(e) => updateCustom('empruntsBancaires', e.target.value)} />
              ) : (
                <Line label="Emprunts bancaires" value={balanceData.liabilities.nonCurrent.bankLoans} />
              )}
              <Line label="Provisions" value={balanceData.liabilities.nonCurrent.provisions} indent={1} />
              <Line label="Total Passifs Non Courants" value={balanceData.liabilities.nonCurrent.total} total />
            </Section>

            <Section title="Passifs Courants">
              <Line label="Fournisseurs et comptes rattachés" value={balanceData.liabilities.current.accountsPayable} />
              <Line label="Personnel" value={balanceData.liabilities.current.personnelPayable} />
              <Line label="État — IS" value={balanceData.liabilities.current.taxPayable} />
              <Line label="État — TVA due" value={balanceData.liabilities.current.vatPayable} />
              <Line label="Autres dettes" value={balanceData.liabilities.current.otherPayables} indent={1} />
              <Line label="Concours bancaires" value={balanceData.liabilities.current.bankOverdraft} indent={1} />
              <Line label="Total Passifs Courants" value={balanceData.liabilities.current.total} total />
            </Section>

            <Line label="TOTAL PASSIFS & CAPITAUX PROPRES" value={balanceData.totalLiabilitiesAndEquity} total />
          </div>
        </div>

        {/* ÉTAT DE RÉSULTAT */}
        <div className="glass-card p-5 rounded-2xl border border-slate-800 shadow-card">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-slate-100">État de Résultat (SCE)</h3>
            <span className="text-[10px] font-bold px-2 py-1 bg-accent-500/10 text-accent-400 rounded-full">
              PRODUITS / CHARGES
            </span>
          </div>

          <Section title="Produits d'Exploitation">
            <Line label="Ventes de marchandises" value={incomeData.productSales} indent={1} color="text-accent-400" />
            <Line label="Prestations de services" value={incomeData.serviceRevenue} indent={1} color="text-accent-400" />
            <Line label="Autres produits" value={incomeData.otherRevenue} indent={1} />
            <Line label="Total Produits d'exploitation" value={incomeData.revenue} total />
          </Section>

          <Section title="Charges d'Exploitation">
            <Line label="Achats de marchandises" value={incomeData.purchaseGoods} indent={1} color="text-danger-400" />
            <Line label="Achats de matières premières" value={incomeData.purchaseRaw} indent={1} color="text-danger-400" />
            <Line label="Autres achats & charges externes" value={incomeData.otherPurchases} indent={1} color="text-danger-400" />
            <Line label="Charges de personnel" value={incomeData.personnelCosts} indent={1} color="text-danger-400" />
            <Line label="Dotations aux amortissements" value={incomeData.depreciation} indent={1} />
            <Line label="Autres charges" value={incomeData.otherOpCharges} indent={1} />
            <Line label="Total Charges d'exploitation" value={incomeData.operatingExpenses} total />
          </Section>

          <div className="border-b border-slate-800/50 pb-2 mb-2">
            <Line label="RÉSULTAT D'EXPLOITATION" value={incomeData.operatingProfit} bold total />
          </div>

          <Section title="Résultat Financier">
            <Line label="Produits financiers" value={incomeData.financialRevenue} indent={1} />
            <Line label="Charges financières" value={incomeData.financialCosts} indent={1} color="text-danger-400" />
            <Line label="Résultat financier" value={incomeData.financialResult} bold />
          </Section>

          <div className="border-b border-slate-800/50 pb-2 mb-2">
            <Line label="RÉSULTAT DES ACTIVITÉS ORDINAIRES AVANT IS" value={incomeData.ordinaryProfit} bold total />
          </div>

          <Line label="Impôt sur les sociétés (15%)" value={incomeData.tax} color="text-danger-400" />

          <div className="mt-3 p-3 bg-gradient-brand rounded-xl shadow-glow">
            <div className="flex justify-between items-center">
              <span className="font-extrabold text-white text-sm">RÉSULTAT NET DE L'EXERCICE</span>
              <span className="font-extrabold text-white text-base">{fmt(incomeData.netProfit)}</span>
            </div>
          </div>

          <div className="mt-4 space-y-1">
            <h4 className="text-xs font-bold text-slate-400 uppercase">Analyse Rapide</h4>
            <ul className="text-xs text-slate-500 space-y-0.5 list-disc list-inside">
              <li>Marge d'exploitation : {incomeData.revenue > 0 ? Math.round((incomeData.operatingProfit / incomeData.revenue) * 100) : 0}%</li>
              <li>Marge nette : {incomeData.revenue > 0 ? Math.round((incomeData.netProfit / incomeData.revenue) * 100) : 0}%</li>
              <li>IS provisionnée au taux standard PME (15%)</li>
              {incomeData.financialResult !== 0 && <li>Résultat financier : {incomeData.financialResult > 0 ? 'Bénéficiaire' : 'Déficitaire'}</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
