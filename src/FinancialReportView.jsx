import React, { useState, useEffect } from 'react';
import { generateBalanceSheet, generateIncomeStatement, getFinancialExportData, generateFromJournal } from './accountingUtils';
import { exportBalanceSheetPDF, exportIncomeStatementPDF } from './pdfExport';
import { exportToExcel } from './excelExport';
import { CheckCheck, TrendingUp, TrendingDown, Calendar, FileText, FileSpreadsheet, Edit, ChevronDown, ChevronRight, X, Search, ExternalLink } from 'lucide-react';

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

function Line({ label, value, indent = 0, color, bold, total, detailKey, onDetail }) {
  const hasDetail = detailKey && onDetail;
  return (
    <div onClick={() => hasDetail && onDetail(detailKey)}
      className={`flex justify-between py-1 ${total ? 'bg-indigo-500/5 rounded-lg px-2 -mx-2' : ''} ${bold ? '' : 'text-slate-400'} ${hasDetail ? 'cursor-pointer hover:bg-slate-800/30 rounded-lg px-1 -mx-1 transition-colors' : ''}`}>
      <span className={`text-xs flex items-center gap-1 ${total ? 'font-bold text-brand-300' : bold ? 'font-semibold text-slate-300' : ''}`}
        style={{ paddingLeft: indent * 12 }}>
        {label}
        {hasDetail && <Search className="w-3 h-3 text-slate-500" />}
      </span>
      <span className={`text-xs font-semibold ${color || (total ? 'text-brand-400' : 'text-slate-300')}`}>
        {fmt(value)}
      </span>
    </div>
  );
}

function DetailModal({ detail, label, journal, onClose }) {
  const [search, setSearch] = useState('');
  const [selectedCompte, setSelectedCompte] = useState(null);
  if (!detail) return null;

  const filtered = detail.filter(d => !search || d.code.includes(search));

  const entriesForAccount = (code) =>
    journal.filter(e => (e.compte || '').replace(/\s.*$/, '').trim() === code);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-brand-400" />
            Détail — {label}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <div className="p-4 border-b border-slate-800">
          <input type="text" placeholder="Filtrer par compte..." value={search} onChange={e => { setSearch(e.target.value); setSelectedCompte(null); }}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500 placeholder-slate-500" />
        </div>
        <div className="overflow-y-auto flex-1 p-2">
          {filtered.length === 0 && <p className="text-xs text-slate-500 text-center py-8">Aucun compte trouvé</p>}
          {filtered.map(d => (
            <div key={d.code}>
              <button onClick={() => setSelectedCompte(selectedCompte === d.code ? null : d.code)}
                className="w-full flex justify-between items-center px-3 py-2 hover:bg-slate-800/40 rounded-xl transition-colors">
                <span className="text-xs text-slate-300 font-mono">{d.code}</span>
                <span className={`text-xs font-semibold ${d.solde >= 0 ? 'text-brand-400' : 'text-danger-400'}`}>
                  {fmt(d.solde)}
                </span>
              </button>
              {selectedCompte === d.code && (
                <div className="ml-6 mb-2 space-y-0.5">
                  {entriesForAccount(d.code).map((e, i) => (
                    <div key={i} className="flex justify-between items-center px-3 py-1 bg-slate-800/30 rounded-lg text-[11px]">
                      <span className="text-slate-400 truncate max-w-[180px]">
                        {e.libelle || e.numeroPiece || '—'}
                      </span>
                      <span className="text-slate-500 ml-2">{e.date || ''}</span>
                      <span className="font-mono text-slate-300 ml-2">
                        {fmt(parseFloat(e.debit || e.credit || 0))}
                      </span>
                    </div>
                  ))}
                  {entriesForAccount(d.code).length === 0 && (
                    <p className="text-[11px] text-slate-600 px-3 py-1">Aucune écriture</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-slate-800 flex justify-between items-center text-[11px] text-slate-500">
          <span>{filtered.length} compte{filtered.length > 1 ? 's' : ''}</span>
          <span>Solde total : {fmt(filtered.reduce((s, d) => s + d.solde, 0))}</span>
        </div>
      </div>
    </div>
  );
}

export default function FinancialReportView({ companyDetails, invoices, expenses, transactions, formatCurrency, stockTotal = 0 }) {
  const [period, setPeriod] = useState('N');
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedDetail, setSelectedDetail] = useState(null);

  const detailLabels = {
    immobilisationsIncorporelles: 'Immobilisations incorporelles',
    immobilisationsCorporelles: 'Immobilisations corporelles',
    immobilisationsFinancieres: 'Immobilisations financières',
    stocks: 'Stocks',
    clients: 'Clients et comptes rattachés',
    fournisseurs: 'Fournisseurs et comptes rattachés',
    etatDebit: 'État — TVA déductible',
    etatCredit: 'État — TVA due',
    personnelDebit: 'Personnel (débiteur)',
    personnelCredit: 'Personnel (créditeur)',
    autresCréances: 'Autres débiteurs',
    autresDettes: 'Autres dettes',
    tresorerieActif: 'Trésorerie',
    concoursBancaires: 'Concours bancaires',
    capitalSocial: 'Capital social',
    reserves: 'Réserves',
    emprunts: 'Emprunts bancaires',
    provisions: 'Provisions',
    ventes: 'Ventes de marchandises / Prestations',
    achats: 'Achats',
    chargesExternes: 'Charges externes',
    chargesPersonnel: 'Charges de personnel',
    impotsTaxes: 'Impôts et taxes',
    autresCharges: 'Autres charges',
    chargesFinancieres: 'Charges financières',
    dotations: 'Dotations aux amortissements',
    fraisPreliminaires: 'Frais préliminaires',
    resultatsReportes: 'Résultats reportés',
    autresCapitauxPropres: 'Autres capitaux propres',
    autresPassifsNC: 'Autres passifs non courants',
    productionStockee: 'Production stockée',
    productionImmobilisee: 'Production immobilisée',
    subventionsExploitation: "Subventions d'exploitation",
    produitsFinanciers: 'Produits financiers',
    produitsExceptionnels: 'Produits exceptionnels',
    chargesExceptionnelles: 'Charges exceptionnelles',
    amortissementsDeduction: 'Amortissements cumulés',
    provisionsActifNCDeduction: 'Provisions dépréciation immobilisations',
    stocksBrutes: 'Stocks (brut)',
    provisionsStocksDeduction: 'Provisions dépréciation stocks',
    clientsBrutes: 'Clients (brut)',
    provisionsClientsDeduction: 'Provisions dépréciation clients',
    tresorerieBrute: 'Trésorerie (brute)',
    provisionsTresorerieDeduction: 'Provisions dépréciation trésorerie',
  };

  const handleDetail = (key) => {
    if (!journalData?.details?.[key]) return;
    setSelectedDetail(key);
  };

  useEffect(() => {
    const handler = () => setRefreshKey(k => k + 1);
    window.addEventListener('journal:updated', handler);
    return () => window.removeEventListener('journal:updated', handler);
  }, []);

  // eslint-disable-next-line no-unused-vars
  const _ = refreshKey; // force re-render when journal changes
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
      fraisPreliminaires: 0,
      immobilisationsIncorporelles: bs.assets.nonCurrent.intangible,
      immobilisationsCorporelles: bs.assets.nonCurrent.tangible,
      immobilisationsFinancieres: bs.assets.nonCurrent.financial,
      amortissementsDeduction: 0,
      provisionsActifNCDeduction: 0,
      stocks: bs.assets.current.stocks,
      stocksBrutes: bs.assets.current.stocks,
      provisionsStocksDeduction: 0,
      clients: bs.assets.current.receivables,
      clientsBrutes: bs.assets.current.receivables,
      provisionsClientsDeduction: 0,
      etatDebit: bs.assets.current.taxRec,
      personnelDebit: bs.assets.current.personnelRec,
      autresCréances: bs.assets.current.otherRec,
      tresorerieActif: bs.assets.current.cashAndBank,
      tresorerieBrute: bs.assets.current.cashAndBank,
      provisionsTresorerieDeduction: 0,
      capitalSocial: bs.equity.socialCapital,
      reserves: bs.equity.legalReserve + bs.equity.otherReserves,
      resultatsReportes: 0,
      autresCapitauxPropres: 0,
      emprunts: bs.liabilities.nonCurrent.bankLoans,
      provisions: bs.liabilities.nonCurrent.provisions,
      autresPassifsNC: 0,
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
    const fallbackVentes = is.productSales + is.serviceRevenue;
    const fallbackAchats = is.purchaseGoods + is.purchaseRaw;
    resultat = {
      ventes: fallbackVentes,
      ventesMarchandises: is.productSales,
      ventesPrestations: is.serviceRevenue,
      productionStockee: 0,
      productionImmobilisee: 0,
      subventionsExploitation: 0,
      autresProduits: is.otherRevenue,
      produitsFinanciers: 0,
      produitsExceptionnels: 0,
      reprises: 0,
      achats: fallbackAchats,
      achatsMarchandises: is.purchaseGoods,
      achatsMP: is.purchaseRaw,
      autresAchatsSIG: 0,
      chargesExternes: is.otherPurchases,
      chargesPersonnel: is.personnelCosts,
      impotsTaxes: 0,
      autresCharges: is.otherOpCharges,
      chargesFinancieres: is.financialCosts,
      chargesExceptionnelles: 0,
      dotations: is.depreciation,
      produits: is.revenue,
      charges: is.operatingExpenses + is.financialCosts,
      resultatExploitation: is.operatingProfit,
      resultatFinancier: -is.financialCosts,
      resultatExceptionnel: 0,
      resultatNet: is.netProfit,
      totalProduitsExploitation: is.revenue,
      totalChargesExploitation: is.operatingExpenses,
      // SIG estimé
      margeCommerciale: is.productSales - is.purchaseGoods,
      productionExercice: fallbackVentes,
      valeurAjoutee: (is.productSales - is.purchaseGoods) + fallbackVentes - is.otherPurchases - is.purchaseRaw,
      ebe: (is.productSales - is.purchaseGoods) + fallbackVentes - is.otherPurchases - is.purchaseRaw - is.personnelCosts,
      rcai: is.operatingProfit - is.financialCosts,
      sigResultatNet: is.netProfit,
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
          <button onClick={() => { exportToExcel(invoices, expenses, transactions, companyDetails, {}, stockTotal).catch(console.error); }}
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
            <Line label="Frais préliminaires" value={bilan.fraisPreliminaires} indent={1} detailKey={useJournal ? 'fraisPreliminaires' : undefined} onDetail={handleDetail} />
            <Line label="Immobilisations incorporelles" value={bilan.immobilisationsIncorporelles} indent={1} detailKey={useJournal ? 'immobilisationsIncorporelles' : undefined} onDetail={handleDetail} />
            <Line label="Immobilisations corporelles" value={bilan.immobilisationsCorporelles} indent={1} detailKey={useJournal ? 'immobilisationsCorporelles' : undefined} onDetail={handleDetail} />
            <Line label="Immobilisations financières" value={bilan.immobilisationsFinancieres} indent={1} detailKey={useJournal ? 'immobilisationsFinancieres' : undefined} onDetail={handleDetail} />
            {useJournal && bilan.amortissementsDeduction > 0.001 && (
              <Line label="− Amortissements cumulés" value={-bilan.amortissementsDeduction} indent={1} color="text-danger-400" detailKey="amortissementsDeduction" onDetail={handleDetail} />
            )}
            {useJournal && bilan.provisionsActifNCDeduction > 0.001 && (
              <Line label="− Provisions dépréciation" value={-bilan.provisionsActifNCDeduction} indent={1} color="text-danger-400" detailKey="provisionsActifNCDeduction" onDetail={handleDetail} />
            )}
            <Line label="Total Actifs Non Courants" value={bilan.actifNC} total />
          </Section>

          <Section title="Actifs Courants">
            <Line label="Stocks" value={bilan.stocks} detailKey={useJournal ? 'stocksBrutes' : undefined} onDetail={handleDetail} />
            {useJournal && bilan.provisionsStocksDeduction > 0.001 && (
              <Line label="− Provisions stocks" value={-bilan.provisionsStocksDeduction} indent={2} color="text-danger-400" detailKey="provisionsStocksDeduction" onDetail={handleDetail} />
            )}
            <Line label="Clients et comptes rattachés" value={bilan.clients} detailKey={useJournal ? 'clientsBrutes' : undefined} onDetail={handleDetail} />
            {useJournal && bilan.provisionsClientsDeduction > 0.001 && (
              <Line label="− Provisions clients" value={-bilan.provisionsClientsDeduction} indent={2} color="text-danger-400" detailKey="provisionsClientsDeduction" onDetail={handleDetail} />
            )}
            <Line label="État — TVA déductible" value={bilan.etatDebit} indent={1} detailKey={useJournal ? 'etatDebit' : undefined} onDetail={handleDetail} />
            <Line label="Personnel" value={bilan.personnelDebit} indent={1} detailKey={useJournal ? 'personnelDebit' : undefined} onDetail={handleDetail} />
            <Line label="Autres débiteurs" value={bilan.autresCréances} indent={1} detailKey={useJournal ? 'autresCréances' : undefined} onDetail={handleDetail} />
            <Line label="Trésorerie" value={bilan.tresorerieActif} detailKey={useJournal ? 'tresorerieBrute' : undefined} onDetail={handleDetail} />
            {useJournal && bilan.provisionsTresorerieDeduction > 0.001 && (
              <Line label="− Provisions trésorerie" value={-bilan.provisionsTresorerieDeduction} indent={2} color="text-danger-400" detailKey="provisionsTresorerieDeduction" onDetail={handleDetail} />
            )}
            <Line label="Total Actifs Courants" value={bilan.actifC} total />
          </Section>

          <Line label="TOTAL ACTIFS" value={bilan.totalActif} total />

          <div className="mt-4 border-t border-slate-800 pt-4">
            <Section title="Capitaux Propres">
              <Line label="Capital social" value={bilan.capitalSocial} detailKey={useJournal ? 'capitalSocial' : undefined} onDetail={handleDetail} />
              <Line label="Réserves" value={bilan.reserves} indent={1} detailKey={useJournal ? 'reserves' : undefined} onDetail={handleDetail} />
              <Line label="Résultats reportés" value={bilan.resultatsReportes} indent={1} detailKey={useJournal ? 'resultatsReportes' : undefined} onDetail={handleDetail} />
              <Line label="Autres capitaux propres" value={bilan.autresCapitauxPropres} indent={1} detailKey={useJournal ? 'autresCapitauxPropres' : undefined} onDetail={handleDetail} />
              <Line label="Résultat net de l'exercice" value={resultatNet} />
              <Line label="Total Capitaux Propres" value={bilan.capPropres} total />
            </Section>

            <Section title="Passifs Non Courants">
              <Line label="Emprunts bancaires" value={bilan.emprunts} detailKey={useJournal ? 'emprunts' : undefined} onDetail={handleDetail} />
              <Line label="Provisions" value={bilan.provisions} indent={1} detailKey={useJournal ? 'provisions' : undefined} onDetail={handleDetail} />
              <Line label="Autres passifs non courants" value={bilan.autresPassifsNC} indent={1} detailKey={useJournal ? 'autresPassifsNC' : undefined} onDetail={handleDetail} />
              <Line label="Total Passifs Non Courants" value={bilan.passifNC} total />
            </Section>

            <Section title="Passifs Courants">
              <Line label="Fournisseurs et comptes rattachés" value={bilan.fournisseurs} detailKey={useJournal ? 'fournisseurs' : undefined} onDetail={handleDetail} />
              <Line label="État — TVA due" value={bilan.etatCredit} detailKey={useJournal ? 'etatCredit' : undefined} onDetail={handleDetail} />
              <Line label="Personnel" value={bilan.personnelCredit} detailKey={useJournal ? 'personnelCredit' : undefined} onDetail={handleDetail} />
              <Line label="Autres dettes" value={bilan.autresDettes} indent={1} detailKey={useJournal ? 'autresDettes' : undefined} onDetail={handleDetail} />
              <Line label="Concours bancaires" value={bilan.concoursBancaires} indent={1} detailKey={useJournal ? 'concoursBancaires' : undefined} onDetail={handleDetail} />
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
            <Line label="Ventes de marchandises / Prestations" value={resultat.ventes} indent={1} color="text-accent-400" detailKey={useJournal ? 'ventes' : undefined} onDetail={handleDetail} />
            <Line label="Production stockée" value={resultat.productionStockee} indent={1} detailKey={useJournal ? 'productionStockee' : undefined} onDetail={handleDetail} />
            <Line label="Production immobilisée" value={resultat.productionImmobilisee} indent={1} detailKey={useJournal ? 'productionImmobilisee' : undefined} onDetail={handleDetail} />
            <Line label="Subventions d'exploitation" value={resultat.subventionsExploitation} indent={1} detailKey={useJournal ? 'subventionsExploitation' : undefined} onDetail={handleDetail} />
            <Line label="Autres produits" value={resultat.autresProduits} indent={1} />
            <Line label="Total Produits d'exploitation" value={resultat.totalProduitsExploitation} total />
          </Section>

          <Section title="Charges d'Exploitation">
            <Line label="Achats" value={resultat.achats} indent={1} color="text-danger-400" detailKey={useJournal ? 'achats' : undefined} onDetail={handleDetail} />
            <Line label="Charges externes" value={resultat.chargesExternes} indent={1} color="text-danger-400" detailKey={useJournal ? 'chargesExternes' : undefined} onDetail={handleDetail} />
            <Line label="Charges de personnel" value={resultat.chargesPersonnel} indent={1} color="text-danger-400" detailKey={useJournal ? 'chargesPersonnel' : undefined} onDetail={handleDetail} />
            <Line label="Impôts et taxes" value={resultat.impotsTaxes} indent={1} detailKey={useJournal ? 'impotsTaxes' : undefined} onDetail={handleDetail} />
            <Line label="Dotations aux amortissements" value={resultat.dotations} indent={1} detailKey={useJournal ? 'dotations' : undefined} onDetail={handleDetail} />
            <Line label="Autres charges" value={resultat.autresCharges} indent={1} detailKey={useJournal ? 'autresCharges' : undefined} onDetail={handleDetail} />
            <Line label="Total Charges d'exploitation" value={resultat.totalChargesExploitation} total />
          </Section>

          <div className="border-b border-slate-800/50 pb-2 mb-2">
            <Line label="RÉSULTAT D'EXPLOITATION" value={resultat.resultatExploitation} bold total />
          </div>

          <Section title="Résultat Financier">
            <Line label="Produits financiers" value={resultat.produitsFinanciers} indent={1} color="text-accent-400" detailKey={useJournal ? 'produitsFinanciers' : undefined} onDetail={handleDetail} />
            <Line label="Charges financières" value={resultat.chargesFinancieres} indent={1} color="text-danger-400" detailKey={useJournal ? 'chargesFinancieres' : undefined} onDetail={handleDetail} />
            <Line label="Résultat financier" value={resultat.resultatFinancier} indent={1} bold />
          </Section>

          <Section title="Résultat Exceptionnel">
            <Line label="Produits exceptionnels" value={resultat.produitsExceptionnels} indent={1} color="text-accent-400" detailKey={useJournal ? 'produitsExceptionnels' : undefined} onDetail={handleDetail} />
            <Line label="Charges exceptionnelles" value={resultat.chargesExceptionnelles} indent={1} color="text-danger-400" detailKey={useJournal ? 'chargesExceptionnelles' : undefined} onDetail={handleDetail} />
            <Line label="Résultat exceptionnel" value={resultat.resultatExceptionnel} indent={1} bold />
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
              <li>Marge d'exploitation : {resultat.totalProduitsExploitation > 0 ? Math.round((resultat.resultatExploitation / resultat.totalProduitsExploitation) * 100) : 0}%</li>
              <li>Marge nette : {resultat.totalProduitsExploitation > 0 ? Math.round((resultatNet / resultat.totalProduitsExploitation) * 100) : 0}%</li>
              {useJournal && <li>Données extraites du journal comptable ({journalData ? 'réelles' : 'estimées'})</li>}
            </ul>
          </div>
        </div>
      </div>

      {/* ÉTAT DES FLUX DE TRÉSORERIE */}
      {useJournal && (
      <div className="glass-card p-5 rounded-2xl border border-slate-800 shadow-card">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-slate-100">État des flux de trésorerie</h3>
          <span className="text-[10px] font-bold px-2 py-1 bg-cyan-500/10 text-cyan-400 rounded-full">SCT NORME 7</span>
        </div>

        <Section title="Flux d'exploitation">
          <Line label="Résultat net de l'exercice" value={journalData?.fluxTresorerie?.margeBruteAutofinancement || 0} indent={1} />
          <Line label="+ Dotations" value={journalData?.fluxTresorerie?.dotations || 0} indent={1} color="text-accent-400" />
          <Line label="− Reprises" value={-(journalData?.fluxTresorerie?.reprises || 0)} indent={1} color="text-danger-400" />
          <Line label="= MBA" value={journalData?.fluxTresorerie?.margeBruteAutofinancement || 0} indent={1} bold />
          <Line label="Variation clients" value={journalData?.fluxTresorerie?.variationClients || 0} indent={1} />
          <Line label="Variation fournisseurs" value={journalData?.fluxTresorerie?.variationFournisseurs || 0} indent={1} />
          <Line label="Variation état" value={journalData?.fluxTresorerie?.variationEtat || 0} indent={1} />
          <Line label="Variation personnel" value={journalData?.fluxTresorerie?.variationPersonnel || 0} indent={1} />
          <Line label="Variation stocks" value={journalData?.fluxTresorerie?.variationStocks || 0} indent={1} />
          <Line label="Total flux d'exploitation" value={journalData?.fluxTresorerie?.fluxExploitation || 0} total />
        </Section>

        <Section title="Flux d'investissement">
          <Line label="Acquisitions immobilisations" value={journalData?.fluxTresorerie?.acquisitionsImmobilisations || 0} indent={1} color="text-danger-400" />
          <Line label="Cessions immobilisations" value={journalData?.fluxTresorerie?.cessionsImmobilisations || 0} indent={1} color="text-accent-400" />
          <Line label="Total flux d'investissement" value={journalData?.fluxTresorerie?.fluxInvestissement || 0} total />
        </Section>

        <Section title="Flux de financement">
          <Line label="Apports en capital" value={journalData?.fluxTresorerie?.apportsCapital || 0} indent={1} color="text-accent-400" />
          <Line label="Emprunts nouveaux" value={journalData?.fluxTresorerie?.empruntsNouveaux || 0} indent={1} color="text-accent-400" />
          <Line label="Remboursements emprunts" value={journalData?.fluxTresorerie?.remboursementsEmprunts || 0} indent={1} color="text-danger-400" />
          <Line label="Total flux de financement" value={journalData?.fluxTresorerie?.fluxFinancement || 0} total />
        </Section>

        <div className="border-t border-slate-800 pt-3 mt-2">
          <Line label="Variation de trésorerie" value={journalData?.fluxTresorerie?.variationTresorerie || 0} total />
          <Line label="Trésorerie initiale" value={journalData?.fluxTresorerie?.tresorerieInitiale || 0} indent={1} />
          <Line label="Trésorerie finale" value={journalData?.fluxTresorerie?.tresorerieFinale || 0} indent={1} />
        </div>
      </div>
      )}

      {/* SOLDES INTERMÉDIAIRES DE GESTION (SIG) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-card p-5 rounded-2xl border border-slate-800 shadow-card">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-slate-100">Soldes Intermédiaires de Gestion (SIG)</h3>
            <span className="text-[10px] font-bold px-2 py-1 bg-amber-500/10 text-amber-400 rounded-full">SCT NORME 5</span>
          </div>

          <Section title="1. Marge Commerciale">
            <Line label="Ventes de marchandises" value={resultat.ventesMarchandises || 0} indent={1} color="text-accent-400" />
            <Line label="− Coût d'achat des marchandises vendues" value={-(resultat.achatsMarchandises || 0)} indent={1} color="text-danger-400" />
            <Line label="= Marge commerciale" value={resultat.margeCommerciale || 0} total />
          </Section>

          <Section title="2. Production de l'exercice">
            <Line label="Ventes de prestations" value={resultat.ventesPrestations || 0} indent={1} color="text-accent-400" />
            <Line label="Production stockée" value={resultat.productionStockee || 0} indent={1} color="text-accent-400" />
            <Line label="Production immobilisée" value={resultat.productionImmobilisee || 0} indent={1} color="text-accent-400" />
            <Line label="= Production de l'exercice" value={resultat.productionExercice || 0} total />
          </Section>

          <Section title="3. Valeur Ajoutée">
            <Line label="Marge commerciale" value={resultat.margeCommerciale || 0} indent={1} />
            <Line label="Production de l'exercice" value={resultat.productionExercice || 0} indent={1} />
            <Line label="− Achats de MP & autres" value={-((resultat.achatsMP || 0) + (resultat.autresAchatsSIG || 0))} indent={1} color="text-danger-400" />
            <Line label="− Consommations externes" value={-(resultat.chargesExternes || 0)} indent={1} color="text-danger-400" />
            <Line label="= Valeur Ajoutée" value={resultat.valeurAjoutee || 0} total />
          </Section>

          <Section title="4. Excédent Brut d'Exploitation (EBE)">
            <Line label="Valeur Ajoutée" value={resultat.valeurAjoutee || 0} indent={1} />
            <Line label="− Impôts et taxes" value={-(resultat.impotsTaxes || 0)} indent={1} color="text-danger-400" />
            <Line label="− Charges de personnel" value={-(resultat.chargesPersonnel || 0)} indent={1} color="text-danger-400" />
            <Line label="= EBE" value={resultat.ebe || 0} total />
          </Section>

          <Section title="5. Résultat d'Exploitation">
            <Line label="EBE" value={resultat.ebe || 0} indent={1} />
            <Line label="+ Reprises" value={resultat.reprises || 0} indent={1} color="text-accent-400" />
            <Line label="− Dotations" value={-(resultat.dotations || 0)} indent={1} color="text-danger-400" />
            <Line label="= Résultat d'exploitation" value={resultat.resultatExploitation || 0} total />
          </Section>

          <Section title="6. Résultat Courant Avant Impôt (RCAI)">
            <Line label="Résultat d'exploitation" value={resultat.resultatExploitation || 0} indent={1} />
            <Line label="Résultat financier" value={resultat.resultatFinancier || 0} indent={1} />
            <Line label="= RCAI" value={resultat.rcai || 0} total />
          </Section>

          <Section title="7. Résultat Net">
            <Line label="RCAI" value={resultat.rcai || 0} indent={1} />
            <Line label="Résultat exceptionnel" value={resultat.resultatExceptionnel || 0} indent={1} />
            <Line label="− Impôt sur les sociétés" value={-(resultat.impotIS || 0)} indent={1} color="text-danger-400" />
            <Line label="= Résultat net" value={resultat.sigResultatNet || resultatNet || 0} total />
          </Section>

          <div className="mt-4 p-3 bg-gradient-brand rounded-xl shadow-glow">
            <div className="flex justify-between items-center">
              <span className="font-extrabold text-white text-sm">RÉSULTAT NET DE L'EXERCICE (SIG)</span>
              <span className="font-extrabold text-white text-base">{fmt(resultat.sigResultatNet || resultatNet)}</span>
            </div>
          </div>
        </div>

        {/* RATIOS FINANCIERS */}
        <div className="glass-card p-5 rounded-2xl border border-slate-800 shadow-card">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-slate-100">Ratios Financiers</h3>
            <span className="text-[10px] font-bold px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-full">ANALYSE</span>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Liquidité</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center py-1.5 px-2 bg-slate-800/30 rounded-lg">
                  <div>
                    <span className="text-xs text-slate-300">Liquidité générale</span>
                    <span className="text-[10px] text-slate-500 ml-2">(Actif C / Passif C)</span>
                  </div>
                  <span className={`text-xs font-bold ${(journalData?.ratios?.liquiditeGenerale || 0) >= 1 ? 'text-emerald-400' : 'text-danger-400'}`}>
                    {journalData?.ratios?.liquiditeGenerale?.toFixed(2) || '0.00'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 px-2 bg-slate-800/30 rounded-lg">
                  <div>
                    <span className="text-xs text-slate-300">Liquidité réduite</span>
                    <span className="text-[10px] text-slate-500 ml-2">(Actif C − Stocks / Passif C)</span>
                  </div>
                  <span className={`text-xs font-bold ${(journalData?.ratios?.liquiditeReduite || 0) >= 0.5 ? 'text-emerald-400' : 'text-danger-400'}`}>
                    {journalData?.ratios?.liquiditeReduite?.toFixed(2) || '0.00'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Structure financière</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center py-1.5 px-2 bg-slate-800/30 rounded-lg">
                  <div>
                    <span className="text-xs text-slate-300">Autonomie financière</span>
                    <span className="text-[10px] text-slate-500 ml-2">(CP / Total Passif)</span>
                  </div>
                  <span className={`text-xs font-bold ${(journalData?.ratios?.autonomieFinanciere || 0) >= 30 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {journalData?.ratios?.autonomieFinanciere?.toFixed(1) || '0.0'}%
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 px-2 bg-slate-800/30 rounded-lg">
                  <div>
                    <span className="text-xs text-slate-300">Endettement net</span>
                    <span className="text-[10px] text-slate-500 ml-2">(Dettes fin. / CP)</span>
                  </div>
                  <span className={`text-xs font-bold ${(journalData?.ratios?.endettementNet || 0) < 1 ? 'text-emerald-400' : 'text-danger-400'}`}>
                    {journalData?.ratios?.endettementNet?.toFixed(2) || '0.00'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 px-2 bg-slate-800/30 rounded-lg">
                  <div>
                    <span className="text-xs text-slate-300">Couverture emplois stables</span>
                    <span className="text-[10px] text-slate-500 ml-2">(CP + Passif NC / Actif NC)</span>
                  </div>
                  <span className={`text-xs font-bold ${(journalData?.ratios?.couvertureEmploisStables || 0) >= 1 ? 'text-emerald-400' : 'text-danger-400'}`}>
                    {journalData?.ratios?.couvertureEmploisStables?.toFixed(2) || '0.00'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Rentabilité</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center py-1.5 px-2 bg-slate-800/30 rounded-lg">
                  <div>
                    <span className="text-xs text-slate-300">Marge nette</span>
                    <span className="text-[10px] text-slate-500 ml-2">(Résultat net / Ventes)</span>
                  </div>
                  <span className="text-xs font-bold text-slate-300">
                    {journalData?.ratios?.margeNette?.toFixed(1) || '0.0'}%
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 px-2 bg-slate-800/30 rounded-lg">
                  <div>
                    <span className="text-xs text-slate-300">Marge d'exploitation</span>
                    <span className="text-[10px] text-slate-500 ml-2">(Résultat expl. / Ventes)</span>
                  </div>
                  <span className="text-xs font-bold text-slate-300">
                    {journalData?.ratios?.margeExploitation?.toFixed(1) || '0.0'}%
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 px-2 bg-slate-800/30 rounded-lg">
                  <div>
                    <span className="text-xs text-slate-300">ROE</span>
                    <span className="text-[10px] text-slate-500 ml-2">(Résultat net / CP)</span>
                  </div>
                  <span className="text-xs font-bold text-slate-300">
                    {journalData?.ratios?.roe?.toFixed(1) || '0.0'}%
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 px-2 bg-slate-800/30 rounded-lg">
                  <div>
                    <span className="text-xs text-slate-300">ROA</span>
                    <span className="text-[10px] text-slate-500 ml-2">(Résultat net / Actif total)</span>
                  </div>
                  <span className="text-xs font-bold text-slate-300">
                    {journalData?.ratios?.roa?.toFixed(1) || '0.0'}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {!useJournal && (
            <div className="mt-4 p-3 bg-slate-800/50 rounded-xl">
              <p className="text-[11px] text-slate-400 text-center">
                Les ratios précis sont disponibles avec des écritures comptables dans le journal.
              </p>
            </div>
          )}
        </div>
      </div>

      {selectedDetail && (
        <DetailModal
          detail={journalData?.details?.[selectedDetail]}
          label={detailLabels[selectedDetail] || selectedDetail}
          journal={journalData?.journal || []}
          onClose={() => setSelectedDetail(null)}
        />
      )}
    </div>
  );
}
