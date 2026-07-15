import React, { useState, useEffect } from 'react';
import { generateBalanceSheet, generateIncomeStatement, getFinancialExportData, generateFromJournal } from './accountingUtils';
import { exportBalanceSheetPDF, exportIncomeStatementPDF } from './pdfExport';
import { exportToExcel } from './excelExport';
import { CheckCheck, TrendingUp, TrendingDown, Calendar, FileText, FileSpreadsheet, Edit, ChevronDown, ChevronRight, X, Search, ExternalLink, Info, RotateCcw, Upload, Download, AlertCircle } from 'lucide-react';
import { computeBalances, buildBalanceGenerale } from './utils/pcgTn';
import { PCG_COMPLET } from './utils/pcgComplet';
import { useToast } from './components/Toast';

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
      className={`flex justify-between py-1.5 items-center ${total ? 'bg-indigo-950/20 border-y border-indigo-500/20 rounded-lg px-3 -mx-2 shadow-[0_2px_10px_rgba(99,102,241,0.05)]' : ''} ${bold ? 'font-semibold text-slate-200' : 'text-slate-400'} ${hasDetail ? 'cursor-pointer hover:bg-slate-800/50 rounded-lg px-2 -mx-2 transition-all duration-200 group' : ''}`}>
      <span className={`text-xs flex items-center gap-1.5 ${total ? 'font-extrabold text-brand-300' : bold ? 'font-semibold text-slate-200' : ''}`}
        style={{ paddingLeft: indent * 12 }}>
        {label}
        {hasDetail && <Search className="w-3 h-3 text-slate-500 group-hover:text-brand-400 transition-colors" />}
      </span>
      <span className={`text-xs font-semibold ${color || (total ? 'text-brand-300' : 'text-slate-200')}`}>
        {fmt(value)}
      </span>
    </div>
  );
}

function DetailRow({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 pl-5 pb-1 text-[10px] text-slate-500 border-b border-slate-800/10">
      {items.map((item, i) => (
        <span key={i}>{item.label}: <span className="text-slate-400 font-mono">{item.pct != null ? item.pct + '%' : fmt(item.value)}</span>{i < items.length - 1 ? ' |' : ''}</span>
      ))}
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
  const toast = useToast();
  const [period, setPeriod] = useState('N');
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [reportTab, setReportTab] = useState('financiers');
  const [balanceSearch, setBalanceSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importedData, setImportedData] = useState(null);
  const [dataSource, setDataSource] = useState('journal');

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
    reprises: 'Reprises',
    variationClients: 'Variation clients',
    variationFournisseurs: 'Variation fournisseurs',
    variationEtat: "Variation état",
    variationPersonnel: 'Variation personnel',
    variationStocks: 'Variation stocks',
    acquisitionsImmobilisations: 'Acquisitions immobilisations',
    cessionsImmobilisations: 'Cessions immobilisations',
    apportsCapital: 'Apports en capital',
    empruntsNouveaux: 'Emprunts nouveaux',
    remboursementsEmprunts: 'Remboursements emprunts',
    tresorerieFinale: 'Trésorerie finale',
  };

  const handleImport = async (file) => {
    setImporting(true);
    setImportError(null);
    try {
      const { parseBalanceFile } = await import('./utils/balanceParser');
      const { balancesToReports } = await import('./utils/balanceToReports');
      const parsed = await parseBalanceFile(file);
      const reports = balancesToReports(parsed.accounts);
      setImportedData({ ...parsed, ...reports });
      setDataSource('import');
      toast.success(`${parsed.accounts.length} comptes extraits de ${parsed.filename} — États financiers générés.`);
    } catch (e) {
      console.error('Import error:', e);
      setImportError(e.message);
      toast.error('Erreur d\'import: ' + e.message);
    } finally {
      setImporting(false);
    }
  };

  const handleDetail = (key) => {
    if (journalData?.details?.[key]) return setSelectedDetail(key);
    if (nonJournalDetails[key]?.length > 0) return setSelectedDetail(key);
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

  const balanceGenerale = React.useMemo(() => {
    if (importedData && dataSource === 'import' && importedData.accounts?.length) {
      const balances = {};
      for (const a of importedData.accounts) {
        const compte = a.compte.replace(/\s.*$/, '').trim();
        if (!compte) continue;
        if (!balances[compte]) balances[compte] = { compte, debitTotal: 0, creditTotal: 0, solde: 0 };
        balances[compte].debitTotal += a.debitTotal || 0;
        balances[compte].creditTotal += a.creditTotal || 0;
        balances[compte].solde = balances[compte].debitTotal - balances[compte].creditTotal;
      }
      return buildBalanceGenerale(balances);
    }
    if (!useJournal || !journalData?.journal?.length) return [];
    const balances = computeBalances(journalData.journal);
    return buildBalanceGenerale(balances);
  }, [journalData, refreshKey, importedData, dataSource]);

  const filteredBalance = React.useMemo(() => {
    if (!balanceSearch) return balanceGenerale;
    const q = balanceSearch.toLowerCase();
    return balanceGenerale.filter(b =>
      b.compte.includes(q) ||
      (PCG_COMPLET[b.compte] || '').toLowerCase().includes(q)
    );
  }, [balanceGenerale, balanceSearch]);

  const totalDebit = filteredBalance.reduce((s, b) => s + b.debitTotal, 0);
  const totalCredit = filteredBalance.reduce((s, b) => s + b.creditTotal, 0);
  const totalSoldeDeb = filteredBalance.reduce((s, b) => s + b.soldeDebiteur, 0);
  const totalSoldeCred = filteredBalance.reduce((s, b) => s + b.soldeCrediteur, 0);

  let bilan, resultat, ratios;
  let hasImported = importedData && dataSource === 'import';

  if (hasImported) {
    bilan = importedData.bilan;
    resultat = importedData.resultat;
    ratios = importedData.ratios;
  } else if (useJournal) {
    bilan = journalData.bilan;
    resultat = journalData.resultat;
    ratios = journalData.ratios;
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
    const ac = bilan.actifC, pc = bilan.passifC, cp = bilan.capPropres, pnc = bilan.passifNC, anc = bilan.actifNC, tp = bilan.totalPassif;
    const stocks = bilan.stocks || 0;
    const emprunts = bilan.emprunts || 0;
    const cc = bilan.concoursBancaires || 0;
    const apnc = bilan.autresPassifsNC || 0;
    const stockVal = bilan.stocks || 0;
    const clientsVal = bilan.clients || 0;
    const fournisseursVal = bilan.fournisseurs || 0;
    const tresorerieVal = bilan.tresorerieActif || 0;
    ratios = {
      liquiditeGenerale: pc > 0 ? Math.round((ac / pc) * 100) / 100 : 0,
      liquiditeReduite: pc > 0 ? Math.round(((ac - stockVal) / pc) * 100) / 100 : 0,
      autonomieFinanciere: tp > 0 ? Math.round((cp / tp) * 10000) / 100 : 0,
      endettementNet: cp > 0 ? Math.round(((emprunts + cc + apnc) / cp) * 100) / 100 : 0,
      couvertureEmploisStables: anc > 0 ? Math.round(((cp + pnc) / anc) * 100) / 100 : 0,
      bfr: stockVal + clientsVal - fournisseursVal,
      tresorerieNette: tresorerieVal - cc,
      poidsChargesFinancieres: (is.operatingProfit > 0 && is.financialCosts > 0) ? Math.round((is.financialCosts / is.operatingProfit) * 1000) / 1000 : 0,
      margeNette: 0, roe: 0, roa: 0, margeExploitation: 0,
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

  // Compteurs pour les détails non-journal
  const invoiceTotal = useJournal ? 0 : (invoices || []).reduce((s, inv) => s + parseFloat(inv.total || inv.montant || 0), 0);
  const expenseTotal = useJournal ? 0 : (expenses || []).reduce((s, exp) => s + parseFloat(exp.total || exp.montant || 0), 0);

  // Détails cliquables pour mode non-journal
  const toDet = (v) => ({ code: v.id || v.numero || '—', solde: (parseFloat(v.total || v.montant || 0) / 1000) });
  const nonJournalDetails = !useJournal ? {
    ventes: (invoices || []).map(toDet),
    achats: (expenses || []).map(toDet),
    chargesExternes: (expenses || []).filter(e => (e.categorie || e.type || '').toLowerCase().includes('extern') || (e.categorie || e.type || '').toLowerCase().includes('service')).map(toDet),
    chargesPersonnel: (expenses || []).filter(e => (e.categorie || e.type || '').toLowerCase().includes('personnel') || (e.categorie || e.type || '').toLowerCase().includes('salaire')).map(toDet),
    clientsBrutes: (invoices || []).filter(inv => inv.status !== 'payee' && inv.status !== 'paid').map(toDet),
    fournisseurs: (expenses || []).filter(exp => exp.status !== 'payee' && exp.status !== 'paid').map(toDet),
    tresorerieBrute: (transactions || []).map(v => ({ code: v.label || v.description || v.date || '—', solde: parseFloat(v.amount || 0) / 1000 })),
    stocksBrutes: stockTotal > 0 ? [{ code: 'Stock déclaré', solde: stockTotal / 1000 }] : [],
  } : {};

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 p-6 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-950/60 rounded-xl p-1 border border-slate-700/50">
            <button onClick={() => setReportTab('financiers')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${reportTab === 'financiers' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>
              <CheckCheck className="w-3.5 h-3.5 inline mr-1" />États Financiers
            </button>
            <button onClick={() => setReportTab('balance')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${reportTab === 'balance' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>
              <RotateCcw className="w-3.5 h-3.5 inline mr-1" />Balance Générale
            </button>
          </div>
          <p className="text-xs text-slate-400 hidden md:block">
            {hasImported ? `Importé: ${importedData.filename}` : useJournal ? 'Données issues du journal comptable.' : 'Estimé basé sur les factures et dépenses.'}
          </p>
          {hasImported && (
            <button onClick={() => { setImportedData(null); setDataSource('journal'); }}
              className="text-[10px] text-brand-400 hover:text-brand-300 underline underline-offset-2">
              Revenir au journal
            </button>
          )}
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
              toast.success('Bilan PDF exporté avec succès.');
            } catch(e) { console.error('PDF export error:', e); toast.error('Erreur PDF: ' + e.message); }
          }}
            className="flex items-center gap-1 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl transition-colors">
            <FileText className="w-3.5 h-3.5" /> PDF
          </button>
          <button onClick={() => { exportToExcel(invoices, expenses, transactions, companyDetails, {}, stockTotal).catch(console.error); }}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
          </button>
          <label className={`relative flex items-center gap-1 px-3 py-1.5 rounded-xl transition-colors text-white text-xs font-bold cursor-pointer ${importing ? 'bg-purple-600/50 opacity-50 pointer-events-none' : 'bg-purple-600 hover:bg-purple-500'}`}>
            <Upload className="w-3.5 h-3.5" />
            {importing ? 'Analyse...' : 'Importer'}
            {!importing && <input type="file" accept=".xlsx,.csv,.pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={async e => { const f = e.target.files?.[0]; if (f) { e.target.value = ''; await handleImport(f); } }} />}
          </label>
        </div>
      </div>

      {reportTab === 'financiers' && (
      <>
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
            <Line label="Stocks" value={bilan.stocks} detailKey="stocksBrutes" onDetail={handleDetail} />
            {useJournal && <DetailRow items={[
              { label: 'Marchandises', value: bilan.stocksMarchandises || 0 },
              { label: 'MP', value: bilan.stocksMP || 0 },
              { label: 'PF', value: bilan.stocksPF || 0 },
            ]} />}
            {!useJournal && stockTotal > 0 && <DetailRow items={[
              { label: 'Stock déclaré', value: stockTotal },
            ]} />}
            {useJournal && bilan.provisionsStocksDeduction > 0.001 && (
              <Line label="− Provisions stocks" value={-bilan.provisionsStocksDeduction} indent={2} color="text-danger-400" detailKey="provisionsStocksDeduction" onDetail={handleDetail} />
            )}
            <Line label="Clients et comptes rattachés" value={bilan.clients} detailKey="clientsBrutes" onDetail={handleDetail} />
            {useJournal && <DetailRow items={[
              { label: 'Clients', value: bilan.clientsBrute || bilan.clients || 0 },
              { label: 'Effets à recevoir', value: bilan.effetsAR || 0 },
              { label: 'Clients douteux', value: bilan.clientsDouteux || 0 },
            ]} />}
            {!useJournal && invoices && invoices.length > 0 && <DetailRow items={[
              { label: 'Total factures', value: invoiceTotal },
            ]} />}
            {useJournal && bilan.provisionsClientsDeduction > 0.001 && (
              <Line label="− Provisions clients" value={-bilan.provisionsClientsDeduction} indent={2} color="text-danger-400" detailKey="provisionsClientsDeduction" onDetail={handleDetail} />
            )}
            <Line label="État — TVA déductible" value={bilan.etatDebit} indent={1} detailKey={useJournal ? 'etatDebit' : undefined} onDetail={handleDetail} />
            <Line label="Personnel" value={bilan.personnelDebit} indent={1} detailKey={useJournal ? 'personnelDebit' : undefined} onDetail={handleDetail} />
            <Line label="Autres débiteurs" value={bilan.autresCréances} indent={1} detailKey={useJournal ? 'autresCréances' : undefined} onDetail={handleDetail} />
            <Line label="Trésorerie" value={bilan.tresorerieActif} detailKey="tresorerieBrute" onDetail={handleDetail} />
            {!useJournal && <DetailRow items={[
              { label: 'Solde bancaire', value: bilan.tresorerieActif || 0 },
            ]} />}
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
              {useJournal && <DetailRow items={[
                { label: 'Fournisseurs', value: bilan.fournisseursBrute || 0 },
                { label: 'Effets à payer', value: bilan.effetsAP || 0 },
              ]} />}
              {!useJournal && expenses && expenses.length > 0 && <DetailRow items={[
                { label: 'Total dépenses', value: expenseTotal },
              ]} />}
              <Line label="État — TVA due" value={bilan.etatCredit} detailKey={useJournal ? 'etatCredit' : undefined} onDetail={handleDetail} />
              <Line label="Personnel" value={bilan.personnelCredit} detailKey={useJournal ? 'personnelCredit' : undefined} onDetail={handleDetail} />
              <Line label="Autres dettes" value={bilan.autresDettes} indent={1} detailKey={useJournal ? 'autresDettes' : undefined} onDetail={handleDetail} />
              <Line label="Concours bancaires" value={bilan.concoursBancaires} indent={1} detailKey={useJournal ? 'concoursBancaires' : undefined} onDetail={handleDetail} />
              <Line label="Total Passifs Courants" value={bilan.passifC} total />
            </Section>

            <Line label="TOTAL PASSIFS & CAPITAUX PROPRES" value={bilan.totalPassif} total />
          </div>

          {(bilan.totalActif > 0) && (
            <div className="mt-3 pt-3 border-t border-slate-800/50">
              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Structure du bilan</h4>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
                <span>Actif NC: <span className="text-slate-400">{Math.round((bilan.actifNC / bilan.totalActif) * 100)}%</span></span>
                <span>Actif C: <span className="text-slate-400">{Math.round((bilan.actifC / bilan.totalActif) * 100)}%</span></span>
                <span>CP: <span className="text-slate-400">{Math.round((bilan.capPropres / bilan.totalPassif) * 100)}%</span></span>
                <span>Dettes: <span className="text-slate-400">{Math.round(((bilan.passifNC + bilan.passifC) / bilan.totalPassif) * 100)}%</span></span>
              </div>
            </div>
          )}
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
            <Line label="Ventes de marchandises / Prestations" value={resultat.ventes} indent={1} color="text-accent-400" detailKey="ventes" onDetail={handleDetail} />
            {!useJournal && <DetailRow items={[
              { label: 'Marchandises', value: resultat.ventesMarchandises || 0 },
              { label: 'Prestations', value: resultat.ventesPrestations || 0 },
            ]} />}
            {useJournal && <DetailRow items={[
              { label: 'Ventes marchandises', value: resultat.ventesMarchandises || 0 },
              { label: 'Prestations', value: resultat.ventesPrestations || 0 },
              { label: 'Autres prod.', value: resultat.productionStockee || 0 },
            ]} />}
            <Line label="Production stockée" value={resultat.productionStockee} indent={1} detailKey={useJournal ? 'productionStockee' : undefined} onDetail={handleDetail} />
            <Line label="Production immobilisée" value={resultat.productionImmobilisee} indent={1} detailKey={useJournal ? 'productionImmobilisee' : undefined} onDetail={handleDetail} />
            <Line label="Subventions d'exploitation" value={resultat.subventionsExploitation} indent={1} detailKey={useJournal ? 'subventionsExploitation' : undefined} onDetail={handleDetail} />
            <Line label="Autres produits" value={resultat.autresProduits} indent={1} />
            <Line label="Total Produits d'exploitation" value={resultat.totalProduitsExploitation} total />
          </Section>

          <Section title="Charges d'Exploitation">
            <Line label="Achats" value={resultat.achats} indent={1} color="text-danger-400" detailKey="achats" onDetail={handleDetail} />
            {!useJournal && <DetailRow items={[
              { label: 'Achats marchandises', value: resultat.achatsMarchandises || 0 },
              { label: 'Achats MP', value: resultat.achatsMP || 0 },
            ]} />}
            <Line label="Charges externes" value={resultat.chargesExternes} indent={1} color="text-danger-400" detailKey="chargesExternes" onDetail={handleDetail} />
            <Line label="Charges de personnel" value={resultat.chargesPersonnel} indent={1} color="text-danger-400" detailKey="chargesPersonnel" onDetail={handleDetail} />
            {resultat.impotsTaxes > 0 && <Line label="Impôts et taxes" value={resultat.impotsTaxes} indent={1} detailKey={useJournal ? 'impotsTaxes' : undefined} onDetail={handleDetail} />}
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

          {resultatNet > 0 && <Line label="Impôt sur les sociétés (15%)" value={-(resultatNet * 0.15)} indent={1} color="text-danger-400" />}

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
          <Line label="Résultat net de l'exercice" value={journalData?.fluxTresorerie?.resultatNet || 0} indent={1} detailKey="resultatNet" onDetail={handleDetail} />
          <Line label="+ Dotations" value={journalData?.fluxTresorerie?.dotations || 0} indent={1} color="text-accent-400" detailKey="dotations" onDetail={handleDetail} />
          <Line label="− Reprises" value={-(journalData?.fluxTresorerie?.reprises || 0)} indent={1} color="text-danger-400" detailKey="reprises" onDetail={handleDetail} />
          <Line label="= MBA" value={journalData?.fluxTresorerie?.margeBruteAutofinancement || 0} indent={1} bold />
          <Line label="Variation clients" value={journalData?.fluxTresorerie?.variationClients || 0} indent={1} detailKey="variationClients" onDetail={handleDetail} />
          <Line label="Variation fournisseurs" value={journalData?.fluxTresorerie?.variationFournisseurs || 0} indent={1} detailKey="variationFournisseurs" onDetail={handleDetail} />
          <Line label="Variation état" value={journalData?.fluxTresorerie?.variationEtat || 0} indent={1} detailKey="variationEtat" onDetail={handleDetail} />
          <Line label="Variation personnel" value={journalData?.fluxTresorerie?.variationPersonnel || 0} indent={1} detailKey="variationPersonnel" onDetail={handleDetail} />
          <Line label="Variation stocks" value={journalData?.fluxTresorerie?.variationStocks || 0} indent={1} detailKey="variationStocks" onDetail={handleDetail} />
          <Line label="Total flux d'exploitation" value={journalData?.fluxTresorerie?.fluxExploitation || 0} total />
        </Section>

        <Section title="Flux d'investissement">
          <Line label="Acquisitions immobilisations" value={journalData?.fluxTresorerie?.acquisitionsImmobilisations || 0} indent={1} color="text-danger-400" detailKey="acquisitionsImmobilisations" onDetail={handleDetail} />
          <Line label="Cessions immobilisations" value={journalData?.fluxTresorerie?.cessionsImmobilisations || 0} indent={1} color="text-accent-400" detailKey="cessionsImmobilisations" onDetail={handleDetail} />
          <Line label="Total flux d'investissement" value={journalData?.fluxTresorerie?.fluxInvestissement || 0} total />
        </Section>

        <Section title="Flux de financement">
          <Line label="Apports en capital" value={journalData?.fluxTresorerie?.apportsCapital || 0} indent={1} color="text-accent-400" detailKey="apportsCapital" onDetail={handleDetail} />
          <Line label="Emprunts nouveaux" value={journalData?.fluxTresorerie?.empruntsNouveaux || 0} indent={1} color="text-accent-400" detailKey="empruntsNouveaux" onDetail={handleDetail} />
          <Line label="Remboursements emprunts" value={journalData?.fluxTresorerie?.remboursementsEmprunts || 0} indent={1} color="text-danger-400" detailKey="remboursementsEmprunts" onDetail={handleDetail} />
          <Line label="Total flux de financement" value={journalData?.fluxTresorerie?.fluxFinancement || 0} total />
        </Section>

        <div className="border-t border-slate-800 pt-3 mt-2">
          <Line label="Variation de trésorerie" value={journalData?.fluxTresorerie?.variationTresorerie || 0} total />
          <Line label="Trésorerie initiale" value={journalData?.fluxTresorerie?.tresorerieInitiale || 0} indent={1} />
          <Line label="Trésorerie finale" value={journalData?.fluxTresorerie?.tresorerieFinale || 0} indent={1} detailKey="tresorerieFinale" onDetail={handleDetail} />
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
            {resultat.ventesMarchandises > 0 && (
              <div className="flex gap-3 pl-5 pb-1 text-[10px] text-slate-500">
                <span>Taux de marge: <span className="text-slate-400 font-semibold">{Math.round((resultat.margeCommerciale / resultat.ventesMarchandises) * 100)}%</span></span>
                <span>Poids achats: <span className="text-slate-400 font-semibold">{Math.round((resultat.achatsMarchandises / resultat.ventesMarchandises) * 100)}%</span></span>
              </div>
            )}
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
            {(resultat.productionExercice + resultat.margeCommerciale) > 0 && (
              <div className="flex gap-3 pl-5 pb-1 text-[10px] text-slate-500">
                <span>Taux de VA: <span className="text-slate-400 font-semibold">{Math.round((resultat.valeurAjoutee / (resultat.productionExercice + resultat.margeCommerciale)) * 100)}%</span></span>
              </div>
            )}
          </Section>

          <Section title="4. Excédent Brut d'Exploitation (EBE)">
            <Line label="Valeur Ajoutée" value={resultat.valeurAjoutee || 0} indent={1} />
            <Line label="− Impôts et taxes" value={-(resultat.impotsTaxes || 0)} indent={1} color="text-danger-400" />
            <Line label="− Charges de personnel" value={-(resultat.chargesPersonnel || 0)} indent={1} color="text-danger-400" />
            <Line label="= EBE" value={resultat.ebe || 0} total />
            {resultat.valeurAjoutee > 0 && (
              <div className="flex gap-3 pl-5 pb-1 text-[10px] text-slate-500">
                <span>Poids personnel: <span className="text-slate-400 font-semibold">{Math.round((resultat.chargesPersonnel / resultat.valeurAjoutee) * 100)}%</span></span>
                <span>Taux d'EBE: <span className="text-slate-400 font-semibold">{Math.round((resultat.ebe / resultat.valeurAjoutee) * 100)}%</span></span>
              </div>
            )}
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

          {(resultat.productionExercice > 0 || resultat.margeCommerciale > 0) && (
            <div className="mt-3 pt-3 border-t border-slate-800/50">
              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Analyse SIG</h4>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
                {resultat.valeurAjoutee > 0 && <span>VA/Production: <span className="text-slate-400">{Math.round((resultat.valeurAjoutee / (resultat.productionExercice + resultat.margeCommerciale)) * 100)}%</span></span>}
                {resultat.ebe > 0 && <span>EBE/VA: <span className="text-slate-400">{Math.round((resultat.ebe / Math.abs(resultat.valeurAjoutee)) * 100)}%</span></span>}
                <span>Poids frais généraux: <span className="text-slate-400">{resultat.totalProduitsExploitation > 0 ? Math.round(((resultat.chargesExternes + resultat.chargesPersonnel) / resultat.totalProduitsExploitation) * 100) : 0}%</span></span>
              </div>
            </div>
          )}
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
                <div>
                  <div className="flex justify-between items-center py-1.5 px-2 bg-slate-800/30 rounded-t-lg">
                    <div>
                      <span className="text-xs text-slate-300">Liquidité générale</span>
                      <span className="text-[10px] text-slate-500 ml-2">(Actif C / Passif C)</span>
                    </div>
                    <span className={`text-xs font-bold ${(ratios?.liquiditeGenerale || 0) >= 1 ? 'text-emerald-400' : 'text-danger-400'}`}>
                      {ratios?.liquiditeGenerale?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                  <div className="flex justify-between px-2 py-1 bg-slate-800/10 rounded-b-lg border-t border-slate-800/30">
                    <span className="text-[10px] text-slate-500">Actif C: {fmt(bilan?.actifC)}</span>
                    <span className="text-[10px] text-slate-500">Passif C: {fmt(bilan?.passifC)}</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center py-1.5 px-2 bg-slate-800/30 rounded-t-lg">
                    <div>
                      <span className="text-xs text-slate-300">Liquidité réduite</span>
                      <span className="text-[10px] text-slate-500 ml-2">(Actif C − Stocks / Passif C)</span>
                    </div>
                    <span className={`text-xs font-bold ${(ratios?.liquiditeReduite || 0) >= 0.5 ? 'text-emerald-400' : 'text-danger-400'}`}>
                      {ratios?.liquiditeReduite?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                  <div className="flex justify-between px-2 py-1 bg-slate-800/10 rounded-b-lg border-t border-slate-800/30">
                    <span className="text-[10px] text-slate-500">Stocks: {fmt(bilan?.stocks)}</span>
                    <span className="text-[10px] text-slate-500">{fmt((bilan?.actifC || 0) - (bilan?.stocks || 0))} / {fmt(bilan?.passifC)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Structure financière</h4>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between items-center py-1.5 px-2 bg-slate-800/30 rounded-t-lg">
                    <div>
                      <span className="text-xs text-slate-300">Autonomie financière</span>
                      <span className="text-[10px] text-slate-500 ml-2">(CP / Total Passif)</span>
                    </div>
                    <span className={`text-xs font-bold ${(ratios?.autonomieFinanciere || 0) >= 30 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {ratios?.autonomieFinanciere?.toFixed(1) || '0.0'}%
                    </span>
                  </div>
                  <div className="flex justify-between px-2 py-1 bg-slate-800/10 rounded-b-lg border-t border-slate-800/30">
                    <span className="text-[10px] text-slate-500">CP: {fmt(bilan?.capPropres)}</span>
                    <span className="text-[10px] text-slate-500">Total: {fmt(bilan?.totalPassif)}</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center py-1.5 px-2 bg-slate-800/30 rounded-t-lg">
                    <div>
                      <span className="text-xs text-slate-300">Endettement net</span>
                      <span className="text-[10px] text-slate-500 ml-2">(Dettes fin. / CP)</span>
                    </div>
                    <span className={`text-xs font-bold ${(ratios?.endettementNet || 0) < 1 ? 'text-emerald-400' : 'text-danger-400'}`}>
                      {ratios?.endettementNet?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                  <div className="flex justify-between px-2 py-1 bg-slate-800/10 rounded-b-lg border-t border-slate-800/30">
                    <span className="text-[10px] text-slate-500">Emprunts: {fmt(bilan?.emprunts)}</span>
                    <span className="text-[10px] text-slate-500">CP: {fmt(bilan?.capPropres)}</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center py-1.5 px-2 bg-slate-800/30 rounded-t-lg">
                    <div>
                      <span className="text-xs text-slate-300">Couverture emplois stables</span>
                      <span className="text-[10px] text-slate-500 ml-2">(CP + Passif NC / Actif NC)</span>
                    </div>
                    <span className={`text-xs font-bold ${(ratios?.couvertureEmploisStables || 0) >= 1 ? 'text-emerald-400' : 'text-danger-400'}`}>
                      {ratios?.couvertureEmploisStables?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                  <div className="flex justify-between px-2 py-1 bg-slate-800/10 rounded-b-lg border-t border-slate-800/30">
                    <span className="text-[10px] text-slate-500">CP+PNC: {fmt((bilan?.capPropres || 0) + (bilan?.passifNC || 0))}</span>
                    <span className="text-[10px] text-slate-500">Actif NC: {fmt(bilan?.actifNC)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Trésorerie & Équilibre</h4>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between items-center py-1.5 px-2 bg-slate-800/30 rounded-t-lg">
                    <div>
                      <span className="text-xs text-slate-300">Besoin en Fonds de Roulement (BFR)</span>
                      <span className="text-[10px] text-slate-500 ml-2">(Stocks + Clients − Fournisseurs)</span>
                    </div>
                    <span className={`text-xs font-bold ${(ratios?.bfr || 0) <= (bilan?.actifC || 0) * 0.5 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {ratios?.bfr != null ? fmt(ratios.bfr) : '0,000 MDT'}
                    </span>
                  </div>
                  <div className="flex justify-between px-2 py-1 bg-slate-800/10 rounded-b-lg border-t border-slate-800/30">
                    <span className="text-[10px] text-slate-500">Stocks+Clients: {fmt((bilan?.stocks || 0) + (bilan?.clients || 0))}</span>
                    <span className="text-[10px] text-slate-500">Fournisseurs: {fmt(bilan?.fournisseurs)}</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center py-1.5 px-2 bg-slate-800/30 rounded-t-lg">
                    <div>
                      <span className="text-xs text-slate-300">Trésorerie nette</span>
                      <span className="text-[10px] text-slate-500 ml-2">(Trésorerie − Concours bancaires)</span>
                    </div>
                    <span className={`text-xs font-bold ${(ratios?.tresorerieNette || 0) >= 0 ? 'text-emerald-400' : 'text-danger-400'}`}>
                      {ratios?.tresorerieNette != null ? fmt(ratios.tresorerieNette) : '0,000 MDT'}
                    </span>
                  </div>
                  <div className="flex justify-between px-2 py-1 bg-slate-800/10 rounded-b-lg border-t border-slate-800/30">
                    <span className="text-[10px] text-slate-500">Trésorerie: {fmt(bilan?.tresorerieActif)}</span>
                    <span className="text-[10px] text-slate-500">CB: {fmt(bilan?.concoursBancaires)}</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center py-1.5 px-2 bg-slate-800/30 rounded-t-lg">
                    <div>
                      <span className="text-xs text-slate-300">Poids des charges financières</span>
                      <span className="text-[10px] text-slate-500 ml-2">(Charges fin. / EBE)</span>
                    </div>
                    <span className={`text-xs font-bold ${(ratios?.poidsChargesFinancieres || 0) < 0.3 ? 'text-emerald-400' : 'text-danger-400'}`}>
                      {ratios?.poidsChargesFinancieres != null ? (ratios.poidsChargesFinancieres * 100).toFixed(1) + '%' : '0.0%'}
                    </span>
                  </div>
                  <div className="flex justify-between px-2 py-1 bg-slate-800/10 rounded-b-lg border-t border-slate-800/30">
                    <span className="text-[10px] text-slate-500">Charges fin.: {fmt(resultat?.chargesFinancieres)}</span>
                    <span className="text-[10px] text-slate-500">EBE: {fmt(resultat?.ebe)}</span>
                  </div>
                </div>
              </div>
            </div>

        </div>
        </div>
      </div>
      </>
      )}

      {reportTab === 'balance' && (
      <div className="glass-card p-5 rounded-2xl border border-slate-800 shadow-card">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-slate-100">Balance Générale</h3>
          <span className="text-[10px] font-bold px-2 py-1 bg-cyan-500/10 text-cyan-400 rounded-full">
            TOUS COMPTES
          </span>
        </div>

        {!useJournal && !(importedData && dataSource === 'import') ? (
          <p className="text-xs text-slate-500 py-8 text-center">
            La Balance Générale nécessite un journal comptable ou des données importées.
          </p>
        ) : (
          <>
            <div className="mb-4">
              <input type="text" value={balanceSearch} onChange={e => setBalanceSearch(e.target.value)}
                placeholder="Rechercher par compte ou libellé..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500 placeholder-slate-500" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="text-left py-2 px-2">Compte</th>
                    <th className="text-left py-2 px-2">Libellé</th>
                    <th className="text-right py-2 px-2">Total Débit</th>
                    <th className="text-right py-2 px-2">Total Crédit</th>
                    <th className="text-right py-2 px-2">Solde Débiteur</th>
                    <th className="text-right py-2 px-2">Solde Créditeur</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBalance.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-slate-500">Aucun compte trouvé</td></tr>
                  )}
                  {filteredBalance.map(b => (
                    <tr key={b.compte} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                      <td className="py-1.5 px-2 font-mono text-slate-300">{b.compte}</td>
                      <td className="py-1.5 px-2 text-slate-400 max-w-[200px] truncate">{PCG_COMPLET[b.compte] || '—'}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-slate-300">{b.debitTotal.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-slate-300">{b.creditTotal.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</td>
                      <td className={`py-1.5 px-2 text-right font-mono ${b.soldeDebiteur > 0 ? 'text-brand-400' : 'text-slate-600'}`}>{b.soldeDebiteur > 0 ? b.soldeDebiteur.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : '—'}</td>
                      <td className={`py-1.5 px-2 text-right font-mono ${b.soldeCrediteur > 0 ? 'text-danger-400' : 'text-slate-600'}`}>{b.soldeCrediteur > 0 ? b.soldeCrediteur.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-600 bg-slate-800/30 font-bold text-slate-200">
                    <td colSpan={2} className="py-2 px-2 text-xs">TOTAUX</td>
                    <td className="py-2 px-2 text-right font-mono">{totalDebit.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</td>
                    <td className="py-2 px-2 text-right font-mono">{totalCredit.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</td>
                    <td className="py-2 px-2 text-right font-mono text-brand-400">{totalSoldeDeb.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</td>
                    <td className="py-2 px-2 text-right font-mono text-danger-400">{totalSoldeCred.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</td>
                  </tr>
                  <tr className="text-[10px] text-slate-500">
                    <td colSpan={6} className="py-1 px-2 text-right">
                      {balanceGenerale.length} compte{balanceGenerale.length > 1 ? 's' : ''} · Différence: {Math.abs(totalDebit - totalCredit).toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
      )}

      {selectedDetail && (
        <DetailModal
          detail={journalData?.details?.[selectedDetail] || nonJournalDetails[selectedDetail] || []}
          label={detailLabels[selectedDetail] || selectedDetail}
          journal={journalData?.journal || []}
          onClose={() => setSelectedDetail(null)}
        />
      )}
    </div>
  );
}
