import React, { useState } from 'react';
import { generateBalanceSheet, generateIncomeStatement, getFinancialExportData, generateFromJournal } from './accountingUtils';
import { exportBalanceSheetPDF, exportIncomeStatementPDF } from './pdfExport';
import { exportToExcel } from './excelExport';
import { CheckCheck, TrendingUp, TrendingDown, Calendar, FileText, FileSpreadsheet, Edit, ChevronDown, ChevronRight } from 'lucide-react';

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
        {fmt(value)}
      </span>
    </div>
  );
}

export default function FinancialReportView({ companyDetails, invoices, expenses, transactions, formatCurrency, stockTotal = 0 }) {
  const [period, setPeriod] = useState('N');

  const journalData = generateFromJournal();
  const useJournal = journalData !== null;

  let bilan, resultat;

  if (useJournal) {
    bilan = journalData.bilan;
    resultat = journalData.resultat;
  } else {
    const is = generateIncomeStatement(invoices, expenses);
    const bs = generateBalanceSheet(invoices, expenses, transactions, {}, is, stockTotal);
    bilan = {
      immobilisationsIncorporelles: bs.assets.nonCurrent.intangible,
      immobilisationsCorporelles: bs.assets.nonCurrent.tangible,
      immobilisationsFinancieres: bs.assets.nonCurrent.financial,
      stocks: bs.assets.current.stocks,
      clients: bs.assets.current.receivables,
      etatDebit: bs.assets.current.taxRec,
      personnelDebit: bs.assets.current.personnelRec,
      autresCréances: bs.assets.current.otherRec,
      tresorerieActif: bs.assets.current.cashAndBank,
      capitalSocial: bs.equity.socialCapital,
      reserves: bs.equity.legalReserve + bs.equity.otherReserves,
      emprunts: bs.liabilities.nonCurrent.bankLoans,
      provisions: bs.liabilities.nonCurrent.provisions,
      fournisseurs: bs.liabilities.current.accountsPayable,
      etatCredit: bs.liabilities.current.vatPayable,
      personnelCredit: bs.liabilities.current.personnelPayable,
      autresDettes: bs.liabilities.current.otherPayables,
      concoursBancaires: bs.liabilities.current.bankOverdraft,
      actifNC: bs.assets.nonCurrent.total,
      actifC: bs.assets.current.total,
      totalActif: bs.assets.total,
      capPropres: bs.equity.total,
      passifNC: bs.liabilities.nonCurrent.total,
      passifC: bs.liabilities.current.total,
      totalPassif: bs.totalLiabilitiesAndEquity,
    };
    resultat = {
      ventes: is.productSales + is.serviceRevenue,
      autresProduits: is.otherRevenue,
      achats: is.purchaseGoods + is.purchaseRaw,
      chargesExternes: is.otherPurchases,
      chargesPersonnel: is.personnelCosts,
      impotsTaxes: 0,
      autresCharges: is.otherOpCharges,
      chargesFinancieres: is.financialCosts,
      dotations: is.depreciation,
      produits: is.revenue,
      charges: is.operatingExpenses + is.financialCosts,
      resultatExploitation: is.operatingProfit,
      resultatNet: is.netProfit,
    };
  }

  const resultatNet = resultat.resultatNet ?? (resultat.resultatExploitation - resultat.chargesFinancieres);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 p-6 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <CheckCheck className="w-5 h-5 text-brand-400" />
            États Financiers (SCE)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {useJournal ? 'Données issues du journal comptable.' : 'Estimé basé sur les factures et dépenses.'}
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
              exportBalanceSheetPDF(getFinancialExportData(invoices, expenses, transactions, companyDetails, {}, stockTotal));
            } catch(e) { console.error('PDF export error:', e); alert('Erreur PDF: ' + e.message); }
          }}
            className="flex items-center gap-1 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl transition-colors">
            <FileText className="w-3.5 h-3.5" /> PDF
          </button>
          <button onClick={() => { exportToExcel(invoices, expenses, transactions, companyDetails, {}).catch(console.error); }}
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
            </div>
          </div>

          <Section title="Actifs Non Courants">
            <Line label="Immobilisations incorporelles" value={bilan.immobilisationsIncorporelles} indent={1} />
            <Line label="Immobilisations corporelles" value={bilan.immobilisationsCorporelles} indent={1} />
            <Line label="Immobilisations financières" value={bilan.immobilisationsFinancieres} indent={1} />
            <Line label="Total Actifs Non Courants" value={bilan.actifNC} total />
          </Section>

          <Section title="Actifs Courants">
            <Line label="Stocks" value={bilan.stocks} />
            <Line label="Clients et comptes rattachés" value={bilan.clients} />
            <Line label="État — TVA déductible" value={bilan.etatDebit} indent={1} />
            <Line label="Personnel" value={bilan.personnelDebit} indent={1} />
            <Line label="Autres débiteurs" value={bilan.autresCréances} indent={1} />
            <Line label="Trésorerie" value={bilan.tresorerieActif} />
            <Line label="Total Actifs Courants" value={bilan.actifC} total />
          </Section>

          <Line label="TOTAL ACTIFS" value={bilan.totalActif} total />

          <div className="mt-4 border-t border-slate-800 pt-4">
            <Section title="Capitaux Propres">
              <Line label="Capital social" value={bilan.capitalSocial} />
              <Line label="Réserves" value={bilan.reserves} indent={1} />
              <Line label="Résultat net de l'exercice" value={resultatNet} />
              <Line label="Total Capitaux Propres" value={bilan.capPropres} total />
            </Section>

            <Section title="Passifs Non Courants">
              <Line label="Emprunts bancaires" value={bilan.emprunts} />
              <Line label="Provisions" value={bilan.provisions} indent={1} />
              <Line label="Total Passifs Non Courants" value={bilan.passifNC} total />
            </Section>

            <Section title="Passifs Courants">
              <Line label="Fournisseurs et comptes rattachés" value={bilan.fournisseurs} />
              <Line label="État — TVA due" value={bilan.etatCredit} />
              <Line label="Personnel" value={bilan.personnelCredit} />
              <Line label="Autres dettes" value={bilan.autresDettes} indent={1} />
              <Line label="Concours bancaires" value={bilan.concoursBancaires} indent={1} />
              <Line label="Total Passifs Courants" value={bilan.passifC} total />
            </Section>

            <Line label="TOTAL PASSIFS & CAPITAUX PROPRES" value={bilan.totalPassif} total />
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
            <Line label="Ventes de marchandises / Prestations" value={resultat.ventes} indent={1} color="text-accent-400" />
            <Line label="Autres produits" value={resultat.autresProduits} indent={1} />
            <Line label="Total Produits d'exploitation" value={resultat.produits} total />
          </Section>

          <Section title="Charges d'Exploitation">
            <Line label="Achats" value={resultat.achats} indent={1} color="text-danger-400" />
            <Line label="Charges externes" value={resultat.chargesExternes} indent={1} color="text-danger-400" />
            <Line label="Charges de personnel" value={resultat.chargesPersonnel} indent={1} color="text-danger-400" />
            <Line label="Impôts et taxes" value={resultat.impotsTaxes} indent={1} />
            <Line label="Dotations aux amortissements" value={resultat.dotations} indent={1} />
            <Line label="Autres charges" value={resultat.autresCharges} indent={1} />
            <Line label="Total Charges d'exploitation" value={resultat.charges} total />
          </Section>

          <div className="border-b border-slate-800/50 pb-2 mb-2">
            <Line label="RÉSULTAT D'EXPLOITATION" value={resultat.resultatExploitation} bold total />
          </div>

          <Section title="Résultat Financier">
            <Line label="Charges financières" value={resultat.chargesFinancieres} indent={1} color="text-danger-400" />
          </Section>

          <Line label="Impôt sur les sociétés (15%)" value={0} color="text-danger-400" />

          <div className="mt-3 p-3 bg-gradient-brand rounded-xl shadow-glow">
            <div className="flex justify-between items-center">
              <span className="font-extrabold text-white text-sm">RÉSULTAT NET DE L'EXERCICE</span>
              <span className="font-extrabold text-white text-base">{fmt(resultatNet)}</span>
            </div>
          </div>

          <div className="mt-4 space-y-1">
            <h4 className="text-xs font-bold text-slate-400 uppercase">Analyse Rapide</h4>
            <ul className="text-xs text-slate-500 space-y-0.5 list-disc list-inside">
              <li>Marge d'exploitation : {resultat.produits > 0 ? Math.round((resultat.resultatExploitation / resultat.produits) * 100) : 0}%</li>
              <li>Marge nette : {resultat.produits > 0 ? Math.round((resultatNet / resultat.produits) * 100) : 0}%</li>
              {useJournal && <li>Données extraites du journal comptable ({journalData ? 'réelles' : 'estimées'})</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
