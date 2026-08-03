import React, { useState, useEffect } from 'react';
import { generateBalanceSheet, generateIncomeStatement, generateFromJournal } from './accountingUtils';
import { exportReportsPDF, exportReportsExcel, exportN1Balance, exportSCEBilan } from './utils/reportExport';
import { CheckCheck, TrendingUp, TrendingDown, Calendar, FileText, FileSpreadsheet, Edit, ChevronDown, ChevronRight, X, Search, ExternalLink, Info, RotateCcw, Upload, Download, AlertCircle, Table } from 'lucide-react';
import { computeBalances, buildBalanceGenerale } from './utils/pcgTn';
import { PCG_COMPLET } from './utils/pcgComplet';
import { useToast } from './components/Toast';
import { loadRules, addRule, removeRule, clearRules, getClassLabel } from './utils/learningStore';
import { buildBilanDetaille } from './utils/bilanDetaille';

const fmt = (v) => {
  if (v == null || isNaN(v)) return '0 DT';
  return v.toLocaleString('fr-TN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' DT';
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

function Line({ label, value, indent = 0, color, bold, total, detailKey, onDetail, prevValue }) {
  const hasDetail = detailKey && onDetail;
  return (
    <div onClick={() => hasDetail && onDetail(detailKey)}
      className={`flex justify-between py-1.5 items-center ${total ? 'bg-indigo-950/20 border-y border-indigo-500/20 rounded-lg px-3 -mx-2 shadow-[0_2px_10px_rgba(99,102,241,0.05)]' : ''} ${bold ? 'font-semibold text-slate-200' : 'text-slate-400'} ${hasDetail ? 'cursor-pointer hover:bg-slate-800/50 rounded-lg px-2 -mx-2 transition-all duration-200 group' : ''}`}>
      <span className={`text-xs flex items-center gap-1.5 ${total ? 'font-extrabold text-brand-300' : bold ? 'font-semibold text-slate-200' : ''}`}
        style={{ paddingLeft: indent * 12 }}>
        {label}
        {hasDetail && <Search className="w-3 h-3 text-slate-500 group-hover:text-brand-400 transition-colors" />}
      </span>
      <span className={`text-xs font-semibold flex items-center gap-2 ${color || (total ? 'text-brand-300' : 'text-slate-200')}`}>
        {prevValue != null && <span className="text-slate-500 font-normal">{fmt(prevValue)}</span>}
        <span>{fmt(value)}</span>
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
  const [period, setPeriod] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [reportTab, setReportTab] = useState('financiers');
  const [tableauxData, setTableauxData] = useState(() => ({
    immobilisations: [],
    amortissements: [],
    provisions: [],
    variationCP: [],
  }));
  const [notes, setNotes] = useState('');
  const [accountingPolicies, setAccountingPolicies] = useState('');
  const [balanceSearch, setBalanceSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importedData, setImportedData] = useState(null);
  const [editingAccounts, setEditingAccounts] = useState(null);
  const [dataSource, setDataSource] = useState('journal');
  const [learnedRules, setLearnedRules] = useState(() => loadRules());
  const [showRules, setShowRules] = useState(false);
  const [reclassTargets, setReclassTargets] = useState({}); // compte -> prefixe cible en édition
  const [detailMode, setDetailMode] = useState(false); // vue bilan détaillé (par classe)
  const currentYear = new Date().getFullYear();
  const exerciceYear = importedData?.exercice ? parseInt(importedData.exercice, 10) : currentYear;
  const displayYear = period || String(exerciceYear);
  const prevYear = String(exerciceYear - 1);

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
    empruntsCourants: 'Emprunts courants',
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

  const handleImport = async (file, forceType) => {
    setImporting(true);
    setImportError(null);
    try {
      const { parseBalanceFile } = await import('./utils/balanceParser');
      const opts = forceType ? { forceType } : {};
      const parsed = await parseBalanceFile(file, opts);
      if (!parsed.accounts?.length) throw new Error('Aucun compte extrait du fichier');
      // Aggregate duplicate accounts (same compte = sum debit/credit)
      const accountMap = new Map();
      for (const a of parsed.accounts) {
        const key = a.compte;
        if (accountMap.has(key)) {
          const existing = accountMap.get(key);
          existing.debitTotal += a.debitTotal || 0;
          existing.creditTotal += a.creditTotal || 0;
        } else {
          accountMap.set(key, { ...a });
        }
      }
      const aggregated = [...accountMap.values()].map(a => ({
        ...a,
        soldeDebiteur: Math.max(0, (a.debitTotal || 0) - (a.creditTotal || 0)),
        soldeCrediteur: Math.max(0, (a.creditTotal || 0) - (a.debitTotal || 0)),
      }));
      // Applique les règles d'apprentissage mémorisées (reclassement auto des comptes corrigés)
      const { applyRules } = await import('./utils/learningStore');
      const learned = applyRules(aggregated, 'global');
      const nReclassed = learned.filter(a => a.reclassed).length;
      setEditingAccounts(learned.map(a => ({ ...a })));
      if (nReclassed > 0) {
        toast.info(`${nReclassed} compte(s) reclassé(s) automatiquement selon les règles apprises`);
      }
      setImportedData({ filename: parsed.filename, exercice: parsed.exercice, type: parsed.type, accounts: aggregated });
      toast.success(`${aggregated.length} comptes extraits de ${parsed.filename} (${parsed.accounts.length} lignes agrégées) — Vérifiez et modifiez si besoin`);
    } catch (e) {
      console.error('Import error:', e);
      setImportError(e.message);
      toast.error("Erreur d'import: " + e.message);
    } finally {
      setImporting(false);
    }
  };

  const confirmImport = async () => {
    if (!editingAccounts) return;
    setImporting(true);
    try {
      const { balancesToReports } = await import('./utils/balanceToReports');
      const reportsN = balancesToReports(editingAccounts);
      const prevAccounts = editingAccounts.map(a => ({
        ...a,
        debitTotal: a.debitTotalPrev || 0,
        creditTotal: a.creditTotalPrev || 0,
      }));
      const reportsN_1 = balancesToReports(prevAccounts);
      setImportedData(prev => ({ ...prev, accounts: editingAccounts, ...reportsN, reportsN_1, reportsN, live: true }));
      setTableauxData({
        immobilisations: (reportsN.bilan.donneesImmobilisations.lignes || []).map(l => ({ ...l })),
        amortissements: (reportsN.bilan.donneesAmortissements.lignes || []).map(l => ({ ...l })),
        provisions: (reportsN.bilan.donneesProvisions.lignes || []).map(l => ({ ...l })),
        variationCP: (reportsN.bilan.variationCapitauxPropres.lignes || []).map(l => ({ ...l })),
      });
      // On quitte le mode édition : le bilan finalisé s'affiche (sinon l'utilisateur a
      // l'impression que "Générer" ne fait rien car l'édition reste à l'écran).
      setEditingAccounts(null);
      setDataSource('import');
      toast.success(`États financiers générés (${editingAccounts.length} comptes)`);
    } catch (e) {
      console.error('Generation error:', e);
      toast.error('Erreur de calcul: ' + e.message);
    } finally {
      setImporting(false);
    }
  };

  const cancelEdit = () => { setEditingAccounts(null); setImportedData(null); };

  // Import d'un fichier N-1 (exercice précédent) séparé, pour comparatif Bilans/N-1.
  const [importingN1, setImportingN1] = useState(false);
  // Saisie manuelle du N-1 : grille de comptes éditables (pas d'import de fichier).
  const [showManualN1, setShowManualN1] = useState(false);
  const [manualN1Rows, setManualN1Rows] = useState([]);
  const [manualN1Name, setManualN1Name] = useState('Saisie manuelle N-1');

  const handleManualN1Apply = async () => {
    const rows = manualN1Rows.filter(r => r.compte && (r.debit || r.credit));
    if (!rows.length) { toast.error('Ajoutez au moins un compte N-1'); return; }
    setImportingN1(true);
    try {
      const { balancesToReports } = await import('./utils/balanceToReports');
      const { applyRules } = await import('./utils/learningStore');
      const accounts = applyRules(rows.map(r => ({ ...r })), 'global');
      const repN1 = balancesToReports(accounts);
      setImportedData(prev => ({ ...prev, reportsN_1: repN1, accountsN1: accounts, filenameN1: manualN1Name || 'Saisie manuelle N-1' }));
      setPeriod(prevYear);
      setShowManualN1(false);
      toast.success(`N-1 saisi manuellement (${rows.length} comptes) — comparatif activé`);
    } catch (e) {
      console.error('Manual N-1 error:', e);
      toast.error('Erreur N-1: ' + e.message);
    } finally {
      setImportingN1(false);
    }
  };

  const handleImportN1 = async (file) => {
    if (!file) return;
    setImportingN1(true);
    try {
      const { parseBalanceFile } = await import('./utils/balanceParser');
      const { balancesToReports } = await import('./utils/balanceToReports');
      const { applyRules } = await import('./utils/learningStore');
      const parsed = await parseBalanceFile(file);
      // Agréger doublons
      const m = new Map();
      for (const a of parsed.accounts) {
        if (m.has(a.compte)) { const e = m.get(a.compte); e.debitTotal += a.debitTotal||0; e.creditTotal += a.creditTotal||0; }
        else m.set(a.compte, { ...a });
      }
      const accounts = applyRules([...m.values()].map(a => ({ ...a })), 'global');
      const repN1 = balancesToReports(accounts);
      setImportedData(prev => ({ ...prev, reportsN_1: repN1, accountsN1: accounts, filenameN1: parsed.filename }));
      setPeriod(prevYear);
      toast.success(`Exercice N-1 (${parsed.exercice || prevYear}) importé depuis ${parsed.filename}`);
    } catch (e) {
      console.error('N-1 import error:', e);
      toast.error("Erreur import N-1: " + e.message);
    } finally {
      setImportingN1(false);
    }
  };

  // Recalcul RÉACTIF : à chaque modification de editingAccounts, on recalcule
  // balancesToReports en temps réel (sans attendre le clic "Générer").
  const [liveReports, setLiveReports] = useState(null);
  useEffect(() => {
    if (!editingAccounts || editingAccounts.length === 0) { setLiveReports(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const { balancesToReports } = await import('./utils/balanceToReports');
        if (cancelled) return;
        const rep = balancesToReports(editingAccounts);
        const prev = editingAccounts.map(a => ({
          ...a,
          debitTotal: a.debitTotalPrev || 0,
          creditTotal: a.creditTotalPrev || 0,
        }));
        const repPrev = balancesToReports(prev);
        if (!cancelled) setLiveReports({ ...rep, reportsN_1: repPrev });
      } catch (e) {
        if (!cancelled) setLiveReports(null);
      }
    })();
    return () => { cancelled = true; };
  }, [editingAccounts]);

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
        if (!balances[compte]) balances[compte] = { compte, libelle: a.libelle || '', debitTotal: 0, creditTotal: 0, solde: 0 };
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

  // Bilan détaillé (par classe SCE) pour la vue "Détaillé"
  const bilanDetaille = React.useMemo(() => {
    const src = editingAccounts && editingAccounts.length ? editingAccounts : (importedData?.accounts || []);
    if (!src.length) return null;
    const rpt = editingAccounts && liveReports ? liveReports : (importedData || {});
    return buildBilanDetaille(src, rpt?.bilan);
  }, [editingAccounts, importedData, liveReports]);

  const totalDebit = filteredBalance.reduce((s, b) => s + b.debitTotal, 0);
  const totalCredit = filteredBalance.reduce((s, b) => s + b.creditTotal, 0);
  const totalSoldeDeb = filteredBalance.reduce((s, b) => s + b.soldeDebiteur, 0);
  const totalSoldeCred = filteredBalance.reduce((s, b) => s + b.soldeCrediteur, 0);

  let bilan, resultat, ratios, sig, fluxTresorerie, controle, bilanPrev, resultatFiscal;
  let hasImported = importedData && dataSource === 'import';

  if (editingAccounts && liveReports) {
    // Mode ÉDITION RÉACTIVE : on affiche le bilan recalculé en temps réel.
    const useN_1 = period && period !== String(exerciceYear) && liveReports.reportsN_1;
    const r = useN_1 ? liveReports.reportsN_1 : liveReports;
    bilan = r.bilan;
    resultat = r.resultat;
    resultatFiscal = r.resultatFiscal;
    ratios = r.ratios;
    sig = r.sig;
    fluxTresorerie = r.fluxTresorerie;
    controle = r.controle;
    bilanPrev = liveReports?.reportsN_1?.bilan;
  } else if (hasImported) {
    const useN_1 = period && period !== String(exerciceYear) && importedData.reportsN_1;
    const r = useN_1 ? importedData.reportsN_1 : importedData;
    bilan = r.bilan;
    resultat = r.resultat;
    resultatFiscal = r.resultatFiscal;
    ratios = r.ratios;
    sig = r.sig;
    fluxTresorerie = r.fluxTresorerie;
    controle = r.controle;
    bilanPrev = importedData?.reportsN_1?.bilan;
    // En mode "N-1" (useN_1), le comparatif gris doit montrer le N (exercice courant).
    if (useN_1) bilanPrev = importedData?.bilan;
  } else if (useJournal) {
    bilan = journalData.bilan;
    resultat = journalData.resultat;
    ratios = journalData.ratios;
  } else {
    const is = generateIncomeStatement(invoices, expenses);
    const bs = generateBalanceSheet(invoices, expenses, transactions, {}, is, stockTotal);
    const ancBrutVal = bs.assets.nonCurrent.intangible + bs.assets.nonCurrent.tangible + bs.assets.nonCurrent.financial;
    const amortVal = bs.assets.nonCurrent.accumulatedDepreciation || 0;
    bilan = {
      fraisPreliminaires: 0,
      immobilisationsIncorporelles: bs.assets.nonCurrent.intangible,
      immobilisationsCorporelles: bs.assets.nonCurrent.tangible,
      immobilisationsFinancieres: bs.assets.nonCurrent.financial,
      ancBrut: ancBrutVal,
      amortissements: amortVal,
      amortissementsDeduction: amortVal,
      provisionsActifNC: 0,
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
      tresorerie: bs.assets.current.cashAndBank,
      tresorerieActif: bs.assets.current.cashAndBank,
      tresorerieBrute: bs.assets.current.cashAndBank,
      provisionsTresorerieDeduction: 0,
      capital: bs.equity.socialCapital,
      capitalSocial: bs.equity.socialCapital,
      reserves: bs.equity.legalReserve + bs.equity.otherReserves,
      resultatsReportes: 0,
      resultatExercice: is.netProfit || 0,
      autresCapitauxPropres: 0,
      emprunts: bs.liabilities.nonCurrent.bankLoans,
      provisions: bs.liabilities.nonCurrent.provisions,
      provisionsDettes: bs.liabilities.nonCurrent.provisions,
      autresPassifsNC: 0,
      fournisseurs: bs.liabilities.current.accountsPayable,
      etatCredit: bs.liabilities.current.vatPayable,
      personnelCredit: bs.liabilities.current.personnelPayable,
      autresDettes: bs.liabilities.current.otherPayables,
      concoursBancaires: bs.liabilities.current.bankOverdraft,
      empruntsCourants: 0,
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
    const ec = bilan.empruntsCourants || 0;
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
      endettementNet: cp > 0 ? Math.round(((emprunts + ec + cc + apnc) / cp) * 100) / 100 : 0,
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
      achatsConsommes: fallbackAchats,
      achatsMarchandises: is.purchaseGoods,
      achatsMP: is.purchaseRaw,
      autresAchatsSIG: 0,
      chargesExternes: is.otherPurchases,
      autresServicesExterieurs: 0,
      chargesPersonnel: is.personnelCosts,
      impotsTaxes: 0,
      autresCharges: is.otherOpCharges,
      chargesFinancieres: is.financialCosts,
      chargesExceptionnelles: 0,
      dotations: is.depreciation,
      produits: is.revenue,
      produitsExploitation: is.revenue,
      charges: is.operatingExpenses + is.financialCosts,
      chargesExploitation: is.operatingExpenses,
      resultatExploitation: is.operatingProfit,
      resultatFinancier: -is.financialCosts,
      resultatExceptionnel: 0,
      resultatAvantImpot: is.operatingProfit - is.financialCosts,
      impot: 0,
      impotIS: 0,
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

  // Build sig + fluxTresorerie for all modes
  if (!sig) {
    const r = resultat;
    const marge = r.margeCommerciale ?? (r.ventesMarchandises - (r.achatsMarchandises || 0));
    const prod = r.productionExercice ?? r.ventes + (r.productionStockee || 0);
    const achCM = (r.achatsConsommes || 0) - (r.achatsMarchandises || 0);
    const ce = r.chargesExternes || 0;
    const ase = r.autresServicesExterieurs || 0;
    const va = r.valeurAjoutee ?? marge + prod - achCM - ce - ase;
    const ebe = r.ebe ?? va + (r.subventionsExploitation || 0) - (r.chargesPersonnel || 0) - (r.impotsTaxes || 0);
    const sigExpl = ebe + (r.reprises || 0) - (r.dotations || 0);
    const rcai = r.rcai ?? sigExpl + (r.resultatFinancier || 0);
    sig = {
      margeCommerciale: marge,
      productionExercice: prod,
      achatsConsHorsMarch: achCM,
      chargesExternes: ce,
      autresServicesExterieurs: ase,
      valeurAjoutee: va,
      ebe,
      sigResultatExploitation: sigExpl,
      sigRcai: rcai,
      sigResultatNet: r.sigResultatNet ?? rcai - (r.impot || 0),
    };
  }
  if (!fluxTresorerie) {
    const rn = resultat.resultatNet ?? 0;
    const dot = resultat.dotations ?? 0;
    const rep = resultat.reprises ?? 0;
    const mba = rn + dot - rep;
    const tresorerieFinale = bilan.tresorerie ?? bilan.tresorerieActif ?? 0;
    fluxTresorerie = {
      resultatNet: rn,
      dotations: dot,
      reprises: rep,
      margeBruteAutofinancement: mba,
      variationClients: 0,
      variationFournisseurs: 0,
      variationEtat: 0,
      variationPersonnel: 0,
      variationStocks: 0,
      fluxExploitation: mba,
      acquisitionsImmobilisations: 0,
      cessionsImmobilisations: 0,
      fluxInvestissement: 0,
      apportsCapital: 0,
      empruntsNouveaux: 0,
      remboursementsEmprunts: 0,
      fluxFinancement: 0,
      variationTresorerie: mba,
      tresorerieInitiale: tresorerieFinale - mba,
      tresorerieFinale,
    };
  }

  const resultatNet = resultat.resultatNet ?? (resultat.resultatExploitation - resultat.chargesFinancieres);

  // Build effective tableaux data (user edits take precedence, else defaults from bilan)
  const buildDefaultTableaux = (b) => ({
    immobilisations: [
      { categorie: 'Frais préliminaires', debut: 0, augmentation: 0, diminution: 0, fin: (b?.fraisPreliminaires ?? b?.donneesImmobilisations?.fraisPreliminaires) || 0, _key: 'fp' },
      { categorie: 'Incorporelles', debut: 0, augmentation: 0, diminution: 0, fin: (b?.immobilisationsIncorporelles ?? b?.donneesImmobilisations?.incorporelles) || 0, _key: 'inc' },
      { categorie: 'Corporelles', debut: 0, augmentation: 0, diminution: 0, fin: (b?.immobilisationsCorporelles ?? b?.donneesImmobilisations?.corporelles) || 0, _key: 'corp' },
      { categorie: 'Financières', debut: 0, augmentation: 0, diminution: 0, fin: (b?.immobilisationsFinancieres ?? b?.donneesImmobilisations?.financieres) || 0, _key: 'fin' },
    ],
    amortissements: [
      { categorie: 'Frais préliminaires', debut: 0, augmentation: 0, diminution: 0, fin: 0, _key: 'fp' },
      { categorie: 'Incorporelles', debut: 0, augmentation: b?.dotationsAmortInc || 0, diminution: 0, fin: b?.amortissementsInc || 0, _key: 'inc' },
      { categorie: 'Corporelles', debut: 0, augmentation: b?.dotationsAmortCorp || 0, diminution: 0, fin: b?.amortissementsCorp || 0, _key: 'corp' },
    ],
    provisions: [
      { categorie: 'Immobilisations', debut: 0, augmentation: 0, diminution: 0, fin: b?.provisionsActifNC || 0, _key: 'anc' },
      { categorie: 'Stocks', debut: 0, augmentation: 0, diminution: 0, fin: b?.provisionsStocks || 0, _key: 'stk' },
      { categorie: 'Clients', debut: 0, augmentation: 0, diminution: 0, fin: b?.provisionsClients || 0, _key: 'clt' },
    ],
    variationCP: [
      { rubrique: 'Capital', debut: 0, augmentation: 0, diminution: 0, fin: b?.capital || 0, _key: 'cap' },
      { rubrique: 'Réserves', debut: 0, augmentation: 0, diminution: 0, fin: b?.reserves || 0, _key: 'res' },
      { rubrique: 'Résultats reportés', debut: 0, augmentation: 0, diminution: 0, fin: b?.resultatsReportes || 0, _key: 'rr' },
      { rubrique: 'Subventions d\'investissement', debut: 0, augmentation: 0, diminution: 0, fin: b?.subventionsInvestissement || 0, _key: 'subv' },
      { rubrique: 'Écarts de réévaluation', debut: 0, augmentation: 0, diminution: 0, fin: b?.ecartsReevaluation || 0, _key: 'ecr' },
      { rubrique: 'Résultat de l\'exercice', debut: 0, augmentation: 0, diminution: 0, fin: b?.resultatExercice || 0, _key: 'resex' },
    ],
  });
  const effectiveTableaux = tableauxData.immobilisations.length ? tableauxData : buildDefaultTableaux(bilan);

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
            <button onClick={() => setReportTab('tableaux')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${reportTab === 'tableaux' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>
              <Table className="w-3.5 h-3.5 inline mr-1" />Tableaux
            </button>
            <button onClick={() => setReportTab('notes')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${reportTab === 'notes' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>
              <FileText className="w-3.5 h-3.5 inline mr-1" />Notes
            </button>
          </div>
          <p className="text-xs text-slate-400 hidden md:block">
            {editingAccounts ? `Modification: ${importedData?.filename || ''}` : hasImported ? `Importé: ${importedData.filename}` : useJournal ? 'Données issues du journal comptable.' : 'Estimé basé sur les factures et dépenses.'}
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
          <select value={displayYear} onChange={(e) => setPeriod(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500">
            <option value={String(exerciceYear)}>{exerciceYear}</option>
            <option value={prevYear}>{prevYear} (N-1)</option>
          </select>
          {hasImported && (
            <>
              <input
                type="file"
                accept=".xls,.xlsx,.csv,.pdf"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportN1(f); e.target.value = ''; }}
                className="hidden"
                id="n1-file-input"
              />
              <button onClick={() => document.getElementById('n1-file-input')?.click()}
                disabled={importingN1}
                className="text-[10px] px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold transition-colors disabled:opacity-50 flex items-center gap-1">
                <Calendar size={12} /> {importingN1 ? 'Import N-1...' : importedData?.filenameN1 ? `N-1 ✓ ${importedData.filenameN1}` : 'Importer N-1'}
              </button>
              <button onClick={() => setShowManualN1(s => !s)}
                className={`text-[10px] px-3 py-1.5 rounded-lg font-bold transition-colors ${showManualN1 ? 'bg-brand-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1'}`}>
                <Edit size={12} /> {showManualN1 ? '✓ Saisir N-1' : 'Saisir N-1'}
              </button>
              {(importedData?.accountsN1?.length || manualN1Rows.some(r => r.compte)) && (
                <button onClick={() => {
                  const srcN1 = importedData?.accountsN1 || manualN1Rows.filter(r => r.compte);
                  const srcN = importedData?.accounts || [];
                  if (!srcN.length && !srcN1.length) { toast.error('Aucune donnée à exporter'); return; }
                  exportN1Balance(srcN, srcN1, { year: currentYear })
                    .then(() => toast.success('Balances N et N-1 exportées (Excel)'))
                    .catch(e => toast.error('Erreur export: ' + e.message));
                }}
                  className="text-[10px] px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-colors flex items-center gap-1">
                  <Download size={12} /> Export N-1
                </button>
              )}
              {importedData?.accounts?.length > 0 && (
                <button onClick={async () => {
                  const srcN = importedData.accounts || [];
                  const srcN1 = importedData.accountsN1 || [];
                  if (!srcN.length) { toast.error('Aucune balance N à exporter'); return; }
                  try {
                    const { balancesToReports } = await import('./utils/balanceToReports');
                    // (Re)calcule le bilan si non encore généré (sinon buildBilanDetaille tombe à vide)
                    const bilanN = importedData?.bilan || balancesToReports(srcN).bilan;
                    const bilanN1 = importedData?.reportsN_1?.bilan || (srcN1.length ? balancesToReports(srcN1).bilan : undefined);
                    await exportSCEBilan({
                      accountsN: srcN,
                      accountsN1: srcN1,
                      bilanN,
                      bilanN1,
                      meta: { yearN: currentYear, yearN1: prevYear, filename: 'Bilan_SCE_' + (companyName || 'SCE') },
                    });
                    toast.success('Bilan SCE (N' + (srcN1.length ? ' + N-1' : '') + ') exporté (Excel)');
                  } catch (e) { toast.error('Erreur export bilan: ' + e.message); }
                }}
                  className="text-[10px] px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold transition-colors flex items-center gap-1">
                  <Download size={12} /> Bilan SCE
                </button>
              )}
            </>
          )}
          <button onClick={() => {
            try {
              const bilanPrev = hasImported && importedData?.reportsN_1?.bilan ? importedData.reportsN_1.bilan : undefined;
              exportReportsPDF({ bilan, resultat, sig, ratios, fluxTresorerie, controle, company: companyDetails, balanceGenerale: filteredBalance, tableauxData: effectiveTableaux, notes, accountingPolicies, bilanPrev });
              toast.success('Rapport PDF exporté avec succès.');
            } catch(e) { console.error('PDF export error:', e); toast.error('Erreur PDF: ' + e.message); }
          }}
            className="flex items-center gap-1 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl transition-colors">
            <FileText className="w-3.5 h-3.5" /> PDF
          </button>
          <button onClick={async () => {
            try {
              const { balancesToReports } = await import('./utils/balanceToReports');
              // Bilan N-1 pour comparatif N/N-1 (diman présenté si des données N-1 existent)
              const bilanPrev = (importedData?.reportsN_1?.bilan)
                || (importedData?.accountsN1?.length ? balancesToReports(importedData.accountsN1).bilan : undefined);
              exportReportsExcel({ bilan, resultat, sig, ratios, fluxTresorerie, controle, resultatFiscal, company: companyDetails, balanceGenerale: filteredBalance, tableauxData: effectiveTableaux, notes, accountingPolicies, bilanPrev }).catch(console.error);
            } catch (e) { toast.error('Erreur export Excel: ' + e.message); }
          }}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
          </button>
          <input type="file" accept=".xls,.xlsx,.csv,.pdf" id="simpleImportInput"
            className="text-[10px] text-slate-200 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 max-w-[140px] file:mr-2 file:py-0.5 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-500 cursor-pointer"
            onChange={async e => { const f = e.target.files?.[0]; if (f) { try { e.target.value = ''; await handleImport(f); } catch(err) { console.error(err); } } }} />
          <input type="file" accept=".xls,.xlsx,.csv,.pdf" id="bilanImportInput"
            className="text-[10px] text-slate-200 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 max-w-[130px] file:mr-2 file:py-0.5 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-amber-600 file:text-white hover:file:bg-amber-500 cursor-pointer"
            title="Importer un bilan"
            onChange={async e => { const f = e.target.files?.[0]; if (f) { try { e.target.value = ''; await handleImport(f, 'bilan'); } catch(err) { console.error(err); } } }} />
        </div>
      </div>

      {editingAccounts && (
      <div className="glass-card p-5 rounded-2xl border border-slate-800 shadow-card">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100">{importedData?.filename || 'Comptes importés'}</h3>
            <p className="text-[10px] text-slate-400">Exercice {importedData?.exercice || 'N'} · {editingAccounts.length} comptes · Modifiez les valeurs puis cliquez Générer</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={cancelEdit}
              className="text-[10px] px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold transition-colors">
              Annuler
            </button>
             <button onClick={confirmImport} disabled={importing}
               className="text-[10px] px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-bold transition-colors disabled:opacity-50">
               {importing ? 'Calcul...' : 'Générer les états financiers'}
             </button>
             <button onClick={() => setShowRules(s => !s)}
               className="text-[10px] px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-500 text-white rounded-lg font-bold transition-colors flex items-center gap-1">
               <RotateCcw size={12} /> Règles ({learnedRules.length})
             </button>
           </div>
         </div>
         {showRules && (
           <div className="mb-3 p-3 bg-slate-900/60 rounded-xl border border-indigo-500/30">
             <div className="flex items-center justify-between mb-2">
               <p className="text-[11px] font-bold text-indigo-300">Règles d'apprentissage (réappliquées automatiquement aux prochains imports)</p>
               {learnedRules.length > 0 && (
                 <button onClick={() => { clearRules(); setLearnedRules([]); toast.success('Règles effacées'); }}
                   className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg">Tout effacer</button>
               )}
             </div>
             {learnedRules.length === 0 ? (
               <p className="text-[10px] text-slate-500">Aucune règle. Utilisez « Mémoriser » sur une ligne ci-dessous pour que le système reclasse automatiquement ce compte à l'avenir.</p>
             ) : (
               <ul className="space-y-1">
                 {learnedRules.map(r => (
                   <li key={r.fromPrefix + r.scope} className="flex items-center justify-between text-[10px] bg-slate-800/50 rounded-lg px-2 py-1">
                     <span className="text-slate-300">Compte <b className="font-mono text-slate-100">{r.fromPrefix}…</b> → classe <b className="text-indigo-300">{r.toPrefix[0]}</b> ({getClassLabel(r.toPrefix)}) {r.note ? `· ${r.note}` : ''}</span>
                     <button onClick={() => { removeRule(r.fromPrefix, r.scope); setLearnedRules(loadRules()); }}
                       className="text-rose-400 hover:text-rose-300 ml-2">✕</button>
                   </li>
                 ))}
               </ul>
             )}
           </div>
         )}
        <div className="max-h-96 overflow-y-auto border border-slate-700 rounded-xl">
          <table className="w-full text-[11px]">
            <thead className="bg-slate-800/50 sticky top-0">
              <tr className="text-slate-400 font-bold uppercase tracking-wider">
                <th className="text-left py-2 px-3 w-[80px]">Compte</th>
                <th className="text-left py-2 px-3">Libellé</th>
                <th className="text-center py-2 px-2 w-[120px]">Classe cible</th>
                <th className="text-center py-2 px-2 w-[60px]">Mém.</th>
                {importedData?.type === 'bilan' ? (
                  <>
                    <th className="text-right py-2 px-3 w-[130px]">Montant N</th>
                    <th className="text-right py-2 px-3 w-[130px]">Montant N-1</th>
                  </>
                ) : (
                  <>
                    <th className="text-right py-2 px-3 w-[130px]">Débit</th>
                    <th className="text-right py-2 px-3 w-[130px]">Crédit</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {editingAccounts.map((a, i) => (
                <tr key={a.compte + '-' + i} className="border-t border-slate-800/30 hover:bg-slate-800/20">
                  <td className="py-1.5 px-3">
                    <input type="text"
                      value={a.compte}
                      onChange={e => setEditingAccounts(prev => prev.map((x, j) => j === i ? { ...x, compte: e.target.value } : x))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-left text-slate-200 font-mono text-[11px] focus:outline-none focus:border-brand-500" />
                  </td>
                  <td className="py-1.5 px-3">
                    <input type="text"
                      value={a.libelle || ''}
                      onChange={e => setEditingAccounts(prev => prev.map((x, j) => j === i ? { ...x, libelle: e.target.value } : x))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-left text-slate-400 font-mono text-[11px] focus:outline-none focus:border-brand-500" />
                  </td>
                  <td className="py-1.5 px-2">
                    <select
                      value={reclassTargets[a.compte] || a.compte[0] || ''}
                      onChange={e => setReclassTargets(prev => ({ ...prev, [a.compte]: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-1 py-1 text-center text-slate-200 font-mono text-[10px] focus:outline-none focus:border-indigo-500">
                      {['1','2','3','4','5','6','7'].map(c => (
                        <option key={c} value={c}>{c} · {getClassLabel(c).split(' ')[0]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    <button
                      onClick={() => {
                        const prefix = String(a.compte || '').slice(0, 3);
                        const target = reclassTargets[a.compte] || a.compte[0];
                        if (!prefix) { toast.error('Compte vide'); return; }
                        setLearnedRules(addRule({ fromPrefix: prefix, toPrefix: target, note: a.libelle || '' }));
                        toast.success(`Règle mémorisée : ${prefix}… → classe ${target}`);
                      }}
                      title="Mémoriser ce reclassement pour les prochains imports"
                      className="text-[10px] px-1.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition-colors">💾</button>
                  </td>
                  {importedData?.type === 'bilan' ? (
                    <>
                      <td className="py-1.5 px-3">
                        <input type="number" step="0.001"
                          value={a.debitTotal || a.creditTotal}
                          onChange={e => {
                            const v = parseFloat(e.target.value) || 0;
                            setEditingAccounts(prev => prev.map((x, j) => j === i ? {
                              ...x,
                              debitTotal: x.debitTotal ? v : 0,
                              creditTotal: x.creditTotal ? v : 0,
                            } : x));
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right text-slate-200 font-mono text-[11px] focus:outline-none focus:border-brand-500" />
                      </td>
                      <td className="py-1.5 px-3">
                        <input type="number" step="0.001"
                          value={a.debitTotalPrev || a.creditTotalPrev}
                          onChange={e => {
                            const v = parseFloat(e.target.value) || 0;
                            setEditingAccounts(prev => prev.map((x, j) => j === i ? {
                              ...x,
                              debitTotalPrev: x.debitTotalPrev ? v : 0,
                              creditTotalPrev: x.creditTotalPrev ? v : 0,
                            } : x));
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right text-slate-200 font-mono text-[11px] focus:outline-none focus:border-brand-500" />
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-1.5 px-3">
                        <input type="number" step="0.001"
                          value={a.debitTotal}
                          onChange={e => {
                            const v = parseFloat(e.target.value) || 0;
                            setEditingAccounts(prev => prev.map((x, j) => j === i ? { ...x, debitTotal: v } : x));
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right text-slate-200 font-mono text-[11px] focus:outline-none focus:border-brand-500" />
                      </td>
                      <td className="py-1.5 px-3">
                        <input type="number" step="0.001"
                          value={a.creditTotal}
                          onChange={e => {
                            const v = parseFloat(e.target.value) || 0;
                            setEditingAccounts(prev => prev.map((x, j) => j === i ? { ...x, creditTotal: v } : x));
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right text-slate-200 font-mono text-[11px] focus:outline-none focus:border-brand-500" />
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-center gap-4">
          <button onClick={() => setEditingAccounts(prev => [...prev, { compte: '', libelle: '', debitTotal: 0, creditTotal: 0 }])}
            className="text-[11px] px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold transition-colors flex items-center gap-1">
            + Nouveau compte
          </button>
          {liveReports && (
            <span className={`text-[11px] px-3 py-1.5 rounded-lg font-bold ${
              Math.abs((liveReports.bilan?.totalActif||0) - (liveReports.bilan?.totalPassif||0)) < 0.5
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-amber-500/15 text-amber-400'
            }`}>
              Actif {Math.round(liveReports.bilan?.totalActif||0).toLocaleString('fr-TN')} DT ·
              Passif {Math.round(liveReports.bilan?.totalPassif||0).toLocaleString('fr-TN')} DT ·
              {Math.abs((liveReports.bilan?.totalActif||0) - (liveReports.bilan?.totalPassif||0)) < 0.5 ? ' ÉQUILIBRÉ ✓' : ' NON ÉQUILIBRÉ ⚠'}
            </span>
          )}
        </div>
      </div>
      )}

      {hasImported && showManualN1 && (
        <div className="glass-card p-5 rounded-2xl border border-brand-500/30 shadow-card">
          <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100">Saisie manuelle de l'exercice N-1</h3>
              <p className="text-[10px] text-slate-400">Saisissez la balance Fisher de l'année précédente (compte / libellé / débit / crédit). Vous pouvez aussi importer un fichier pour pré-remplir, puis ajuster.</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept=".xls,.xlsx,.csv,.pdf"
                onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  try {
                    const { parseBalanceFile } = await import('./utils/balanceParser');
                    const parsed = await parseBalanceFile(f);
                    const rows = parsed.accounts.map(a => ({ compte: a.compte, libelle: a.libelle || '', debit: a.debitTotal || 0, credit: a.creditTotal || 0 }));
                    setManualN1Rows(rows.length ? rows : [{ compte: '', libelle: '', debit: 0, credit: 0 }]);
                    setManualN1Name(parsed.filename + ' (N-1)');
                    toast.success(`${rows.length} lignes pré-remplies depuis ${parsed.filename}`);
                  } catch (err) { toast.error('Erreur: ' + err.message); }
                  e.target.value = '';
                }}
                className="text-[10px] text-slate-200 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 max-w-[140px] file:mr-2 file:py-0.5 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-500 cursor-pointer"
              />
              <button onClick={handleManualN1Apply} disabled={importingN1}
                className="text-[10px] px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-bold transition-colors disabled:opacity-50">
                {importingN1 ? 'Calcul...' : 'Valider N-1'}
              </button>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto border border-slate-700 rounded-xl">
            <table className="w-full text-[11px]">
              <thead className="bg-slate-800/50 sticky top-0">
                <tr className="text-slate-400 font-bold uppercase tracking-wider">
                  <th className="text-left py-2 px-3 w-[90px]">Compte</th>
                  <th className="text-left py-2 px-3">Libellé</th>
                  <th className="text-right py-2 px-3 w-[130px]">Débit N-1</th>
                  <th className="text-right py-2 px-3 w-[130px]">Crédit N-1</th>
                  <th className="w-[40px]" />
                </tr>
              </thead>
              <tbody>
                {manualN1Rows.map((r, i) => (
                  <tr key={i} className="border-t border-slate-800/30 hover:bg-slate-800/20">
                    <td className="py-1.5 px-3">
                      <input type="text" value={r.compte}
                        onChange={e => setManualN1Rows(prev => prev.map((x, j) => j === i ? { ...x, compte: e.target.value } : x))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-left text-slate-200 font-mono text-[11px] focus:outline-none focus:border-brand-500" />
                    </td>
                    <td className="py-1.5 px-3">
                      <input type="text" value={r.libelle}
                        onChange={e => setManualN1Rows(prev => prev.map((x, j) => j === i ? { ...x, libelle: e.target.value } : x))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-left text-slate-400 font-mono text-[11px] focus:outline-none focus:border-brand-500" />
                    </td>
                    <td className="py-1.5 px-3">
                      <input type="number" step="0.001" value={r.debit}
                        onChange={e => setManualN1Rows(prev => prev.map((x, j) => j === i ? { ...x, debit: parseFloat(e.target.value) || 0 } : x))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right text-slate-200 font-mono text-[11px] focus:outline-none focus:border-brand-500" />
                    </td>
                    <td className="py-1.5 px-3">
                      <input type="number" step="0.001" value={r.credit}
                        onChange={e => setManualN1Rows(prev => prev.map((x, j) => j === i ? { ...x, credit: parseFloat(e.target.value) || 0 } : x))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right text-slate-200 font-mono text-[11px] focus:outline-none focus:border-brand-500" />
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <button onClick={() => setManualN1Rows(prev => prev.filter((_, j) => j !== i))}
                        className="text-rose-400 hover:text-rose-300 text-[12px]">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-center">
            <button onClick={() => setManualN1Rows(prev => [...prev, { compte: '', libelle: '', debit: 0, credit: 0 }])}
              className="text-[11px] px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold transition-colors flex items-center gap-1">
              + Nouveau compte
            </button>
          </div>
        </div>
      )}

      {!editingAccounts && reportTab === 'financiers' && (
      <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* BILAN */}
        <div className="glass-card p-5 rounded-2xl border border-slate-800 shadow-card">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-slate-100">Bilan (SCE)</h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded-full">ACTIF / PASSIF</span>
              <button onClick={() => setDetailMode(d => !d)}
                className={`text-[10px] px-3 py-1 rounded-lg font-bold transition-colors ${detailMode ? 'bg-brand-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}>
                {detailMode ? '✓ Détaillé' : 'Synthétique'}
              </button>
              {hasImported && !editingAccounts && importedData?.accounts && (
                <button onClick={() => {
                  setEditingAccounts(importedData.accounts.map(a => ({ ...a })));
                  setShowRules(false);
                }}
                  className="text-[10px] px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold transition-colors flex items-center gap-1">
                  <Edit size={12} /> Modifier les comptes
                </button>
              )}
            </div>
          </div>

          {period && period !== String(exerciceYear) && !importedData?.reportsN_1 && (
            <div className="mb-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[10px] text-amber-300">
              Aucun exercice N-1 importé. Cliquez sur « Importer N-1 » (à côté du sélecteur d'exercice) pour charger la balance de l'année précédente et afficher le comparatif.
            </div>
          )}

          <Section title="Actifs Non Courants">
            <Line label="Frais préliminaires" value={bilan.fraisPreliminaires} prevValue={bilanPrev?.fraisPreliminaires} indent={1} detailKey={useJournal ? 'fraisPreliminaires' : undefined} onDetail={handleDetail} />
            <Line label="Immobilisations incorporelles" value={bilan.immobilisationsIncorporelles} prevValue={bilanPrev?.immobilisationsIncorporelles} indent={1} detailKey={useJournal ? 'immobilisationsIncorporelles' : undefined} onDetail={handleDetail} />
            <Line label="Immobilisations corporelles" value={bilan.immobilisationsCorporelles} prevValue={bilanPrev?.immobilisationsCorporelles} indent={1} detailKey={useJournal ? 'immobilisationsCorporelles' : undefined} onDetail={handleDetail} />
            <Line label="Immobilisations financières" value={bilan.immobilisationsFinancieres} prevValue={bilanPrev?.immobilisationsFinancieres} indent={1} detailKey={useJournal ? 'immobilisationsFinancieres' : undefined} onDetail={handleDetail} />
            {bilan.amortissementsDeduction > 0.001 && (
              <Line label="− Amortissements cumulés" value={-bilan.amortissementsDeduction} prevValue={bilanPrev ? -bilanPrev.amortissementsDeduction : undefined} indent={1} color="text-danger-400" detailKey="amortissementsDeduction" onDetail={handleDetail} />
            )}
            {bilan.provisionsActifNCDeduction > 0.001 && (
              <Line label="− Provisions dépréciation" value={-bilan.provisionsActifNCDeduction} prevValue={bilanPrev ? -bilanPrev.provisionsActifNCDeduction : undefined} indent={1} color="text-danger-400" detailKey="provisionsActifNCDeduction" onDetail={handleDetail} />
            )}
            <Line label="Total Actifs Non Courants" value={bilan.actifNC} prevValue={bilanPrev?.actifNC} total />
          </Section>

          <Section title="Actifs Courants">
            <Line label="Stocks" value={bilan.stocks} prevValue={bilanPrev?.stocks} detailKey="stocksBrutes" onDetail={handleDetail} />
            {useJournal && <DetailRow items={[
              { label: 'Marchandises', value: bilan.stocksMarchandises || 0 },
              { label: 'MP', value: bilan.stocksMP || 0 },
              { label: 'PF', value: bilan.stocksPF || 0 },
            ]} />}
            {!useJournal && stockTotal > 0 && <DetailRow items={[
              { label: 'Stock déclaré', value: stockTotal },
            ]} />}
            {useJournal && bilan.provisionsStocksDeduction > 0.001 && (
              <Line label="− Provisions stocks" value={-bilan.provisionsStocksDeduction} prevValue={bilanPrev ? -bilanPrev.provisionsStocksDeduction : undefined} indent={2} color="text-danger-400" detailKey="provisionsStocksDeduction" onDetail={handleDetail} />
            )}
            <Line label="Clients et comptes rattachés" value={bilan.clients} prevValue={bilanPrev?.clients} detailKey="clientsBrutes" onDetail={handleDetail} />
            {useJournal && <DetailRow items={[
              { label: 'Clients', value: bilan.clientsBrute || bilan.clients || 0 },
              { label: 'Effets à recevoir', value: bilan.effetsAR || 0 },
              { label: 'Clients douteux', value: bilan.clientsDouteux || 0 },
            ]} />}
            {!useJournal && invoices && invoices.length > 0 && <DetailRow items={[
              { label: 'Total factures', value: invoiceTotal },
            ]} />}
            {useJournal && bilan.provisionsClientsDeduction > 0.001 && (
              <Line label="− Provisions clients" value={-bilan.provisionsClientsDeduction} prevValue={bilanPrev ? -bilanPrev.provisionsClientsDeduction : undefined} indent={2} color="text-danger-400" detailKey="provisionsClientsDeduction" onDetail={handleDetail} />
            )}
            <Line label="État — TVA déductible" value={bilan.etatDebit} prevValue={bilanPrev?.etatDebit} indent={1} detailKey={useJournal ? 'etatDebit' : undefined} onDetail={handleDetail} />
            <Line label="Personnel" value={bilan.personnelDebit} prevValue={bilanPrev?.personnelDebit} indent={1} detailKey={useJournal ? 'personnelDebit' : undefined} onDetail={handleDetail} />
            <Line label="Autres débiteurs" value={bilan.autresCréances} prevValue={bilanPrev?.autresCréances} indent={1} detailKey={useJournal ? 'autresCréances' : undefined} onDetail={handleDetail} />
            <Line label="Trésorerie" value={bilan.tresorerieActif} prevValue={bilanPrev?.tresorerieActif} detailKey="tresorerieBrute" onDetail={handleDetail} />
            {!useJournal && <DetailRow items={[
              { label: 'Solde bancaire', value: bilan.tresorerieActif || 0 },
            ]} />}
            {useJournal && bilan.provisionsTresorerieDeduction > 0.001 && (
              <Line label="− Provisions trésorerie" value={-bilan.provisionsTresorerieDeduction} prevValue={bilanPrev ? -bilanPrev.provisionsTresorerieDeduction : undefined} indent={2} color="text-danger-400" detailKey="provisionsTresorerieDeduction" onDetail={handleDetail} />
            )}
            <Line label="Total Actifs Courants" value={bilan.actifC} prevValue={bilanPrev?.actifC} total />
          </Section>

          <Line label="TOTAL ACTIFS" value={bilan.totalActif} prevValue={bilanPrev?.totalActif} total />

          <div className="mt-4 border-t border-slate-800 pt-4">
            {bilanPrev && <div className="text-[9px] text-slate-500 mb-2 text-right">N-1 (gris) / N (blanc)</div>}
            <Section title="Capitaux Propres">
              <Line label="Capital social" value={bilan.capitalSocial} prevValue={bilanPrev?.capitalSocial} detailKey={useJournal ? 'capitalSocial' : undefined} onDetail={handleDetail} />
              <Line label="Réserves" value={bilan.reserves} prevValue={bilanPrev?.reserves} indent={1} detailKey={useJournal ? 'reserves' : undefined} onDetail={handleDetail} />
              <Line label="Résultats reportés" value={bilan.resultatsReportes} prevValue={bilanPrev?.resultatsReportes} indent={1} detailKey={useJournal ? 'resultatsReportes' : undefined} onDetail={handleDetail} />
              <Line label="Autres capitaux propres" value={bilan.autresCapitauxPropres} prevValue={bilanPrev?.autresCapitauxPropres} indent={1} detailKey={useJournal ? 'autresCapitauxPropres' : undefined} onDetail={handleDetail} />
              <Line label="Résultat net de l'exercice" value={resultatNet} prevValue={bilanPrev?.resultatExercice} />
              <Line label="Total Capitaux Propres" value={bilan.capPropres} prevValue={bilanPrev?.capPropres} total />
            </Section>

            <Section title="Passifs Non Courants">
              <Line label="Emprunts bancaires" value={bilan.emprunts} prevValue={bilanPrev?.emprunts} detailKey={useJournal ? 'emprunts' : undefined} onDetail={handleDetail} />
              <Line label="Provisions" value={bilan.provisions} prevValue={bilanPrev?.provisions} indent={1} detailKey={useJournal ? 'provisions' : undefined} onDetail={handleDetail} />
              <Line label="Autres passifs non courants" value={bilan.autresPassifsNC} prevValue={bilanPrev?.autresPassifsNC} indent={1} detailKey={useJournal ? 'autresPassifsNC' : undefined} onDetail={handleDetail} />
              <Line label="Total Passifs Non Courants" value={bilan.passifNC} prevValue={bilanPrev?.passifNC} total />
            </Section>

            <Section title="Passifs Courants">
              <Line label="Fournisseurs et comptes rattachés" value={bilan.fournisseurs} prevValue={bilanPrev?.fournisseurs} detailKey={useJournal ? 'fournisseurs' : undefined} onDetail={handleDetail} />
              {useJournal && <DetailRow items={[
                { label: 'Fournisseurs', value: bilan.fournisseursBrute || 0 },
                { label: 'Effets à payer', value: bilan.effetsAP || 0 },
              ]} />}
              {!useJournal && expenses && expenses.length > 0 && <DetailRow items={[
                { label: 'Total dépenses', value: expenseTotal },
              ]} />}
              <Line label="État — TVA due" value={bilan.etatCredit} prevValue={bilanPrev?.etatCredit} detailKey={useJournal ? 'etatCredit' : undefined} onDetail={handleDetail} />
              <Line label="Personnel" value={bilan.personnelCredit} prevValue={bilanPrev?.personnelCredit} detailKey={useJournal ? 'personnelCredit' : undefined} onDetail={handleDetail} />
              <Line label="Autres dettes" value={bilan.autresDettes} prevValue={bilanPrev?.autresDettes} indent={1} detailKey={useJournal ? 'autresDettes' : undefined} onDetail={handleDetail} />
              <Line label="Concours bancaires" value={bilan.concoursBancaires} prevValue={bilanPrev?.concoursBancaires} indent={1} detailKey={useJournal ? 'concoursBancaires' : undefined} onDetail={handleDetail} />
              <Line label="Emprunts courants" value={bilan.empruntsCourants} prevValue={bilanPrev?.empruntsCourants} indent={1} detailKey={useJournal ? 'empruntsCourants' : undefined} onDetail={handleDetail} />
              <Line label="Total Passifs Courants" value={bilan.passifC} prevValue={bilanPrev?.passifC} total />
            </Section>

            <Line label="TOTAL PASSIFS & CAPITAUX PROPRES" value={bilan.totalPassif} prevValue={bilanPrev?.totalPassif} total />
          </div>

          {detailMode && bilanDetaille && (
            <div className="mt-4 pt-3 border-t border-slate-800/50 space-y-3">
              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bilan détaillé — modèle de référence PCGA</h4>
              {(() => {
                const fmtD = (v) => (v == null || isNaN(v)) ? '0' : Math.round(v).toLocaleString('fr-TN') + ' DT';
                const Block = ({ title, lines, total }) => (
                  <div>
                    <div className="text-[10px] font-bold text-brand-300 mb-0.5 uppercase tracking-wider">{title}</div>
                    {lines.map((it, i) => (
                      <div key={i} className="flex justify-between text-[10px] py-0.5 px-2 odd:bg-slate-900/30">
                        <span className="text-slate-400">{it.prefixe} · {it.label}</span>
                        <span className={it.montant < 0 ? 'text-rose-400' : 'text-slate-200'}>{fmtD(it.montant)}</span>
                      </div>
                    ))}
                    {total != null && (
                      <div className="flex justify-between text-[10px] py-0.5 px-2 font-bold text-slate-200 border-t border-slate-800/40 mt-0.5">
                        <span>Total</span><span>{fmtD(total)}</span>
                      </div>
                    )}
                  </div>
                );
                const ai = [
                  ...bilanDetaille.actifNC.incorp,
                  ...bilanDetaille.actifNC.corp,
                  ...bilanDetaille.actifNC.fin,
                  ...bilanDetaille.actifNC.amort,
                  ...bilanDetaille.actifNC.provANC,
                ];
                return (
                  <>
                    <Block title="Actifs non courants — Actifs immobilisés" lines={ai} total={bilanDetaille.actifNC.total} />
                    <Block title="Autres actifs non courants" lines={bilanDetaille.actifNC.autresANC} />
                    <Block title="Stocks (moins provisions)" lines={bilanDetaille.stocks} />
                    <Block title="Clients et comptes rattachés (actif)" lines={bilanDetaille.tiersActif} />
                    <Block title="Autres actifs courants" lines={bilanDetaille.autresActifsC} />
                    <Block title="Placements et autres actifs financiers" lines={bilanDetaille.placements} />
                    <Block title="Liquidités" lines={bilanDetaille.liquidites} />
                    <Block title="Capitaux propres" lines={bilanDetaille.cp} />
                    <Block title="Emprunts" lines={bilanDetaille.emprunts} />
                    <Block title="Autres passifs financiers non courants" lines={bilanDetaille.autresPassifsFinNC} />
                    <Block title="Provisions (passif)" lines={bilanDetaille.provisionsNC} />
                    <Block title="Fournisseurs et comptes rattachés (passif)" lines={bilanDetaille.fournisseurs} />
                    <Block title="Autres passifs courants" lines={bilanDetaille.autresPassifsC} />
                    <Block title="Concours bancaires et autres passifs financiers courants" lines={bilanDetaille.concours} />
                  </>
                );
              })()}
            </div>
          )}


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

          {resultatNet > 0 && <Line label="Impôt sur les sociétés" value={-(resultat.impotIS || resultatNet * 0.15)} indent={1} color="text-danger-400" />}

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
      <div className="glass-card p-5 rounded-2xl border border-slate-800 shadow-card">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-slate-100">État des flux de trésorerie</h3>
          <span className="text-[10px] font-bold px-2 py-1 bg-cyan-500/10 text-cyan-400 rounded-full">SCT NORME 7</span>
        </div>

        <Section title="Flux d'exploitation">
          <Line label="Résultat net de l'exercice" value={fluxTresorerie?.resultatNet || 0} indent={1} detailKey="resultatNet" onDetail={handleDetail} />
          <Line label="+ Dotations" value={fluxTresorerie?.dotations || 0} indent={1} color="text-accent-400" detailKey="dotations" onDetail={handleDetail} />
          <Line label="− Reprises" value={-(fluxTresorerie?.reprises || 0)} indent={1} color="text-danger-400" detailKey="reprises" onDetail={handleDetail} />
          <Line label="= MBA" value={fluxTresorerie?.margeBruteAutofinancement || 0} indent={1} bold />
          <Line label="Variation clients" value={fluxTresorerie?.variationClients || 0} indent={1} detailKey="variationClients" onDetail={handleDetail} />
          <Line label="Variation fournisseurs" value={fluxTresorerie?.variationFournisseurs || 0} indent={1} detailKey="variationFournisseurs" onDetail={handleDetail} />
          <Line label="Variation état" value={fluxTresorerie?.variationEtat || 0} indent={1} detailKey="variationEtat" onDetail={handleDetail} />
          <Line label="Variation personnel" value={fluxTresorerie?.variationPersonnel || 0} indent={1} detailKey="variationPersonnel" onDetail={handleDetail} />
          <Line label="Variation stocks" value={fluxTresorerie?.variationStocks || 0} indent={1} detailKey="variationStocks" onDetail={handleDetail} />
          <Line label="Total flux d'exploitation" value={fluxTresorerie?.fluxExploitation || 0} total />
        </Section>

        <Section title="Flux d'investissement">
          <Line label="Acquisitions immobilisations" value={fluxTresorerie?.acquisitionsImmobilisations || 0} indent={1} color="text-danger-400" detailKey="acquisitionsImmobilisations" onDetail={handleDetail} />
          <Line label="Cessions immobilisations" value={fluxTresorerie?.cessionsImmobilisations || 0} indent={1} color="text-accent-400" detailKey="cessionsImmobilisations" onDetail={handleDetail} />
          <Line label="Total flux d'investissement" value={fluxTresorerie?.fluxInvestissement || 0} total />
        </Section>

        <Section title="Flux de financement">
          <Line label="Apports en capital" value={fluxTresorerie?.apportsCapital || 0} indent={1} color="text-accent-400" detailKey="apportsCapital" onDetail={handleDetail} />
          <Line label="Emprunts nouveaux" value={fluxTresorerie?.empruntsNouveaux || 0} indent={1} color="text-accent-400" detailKey="empruntsNouveaux" onDetail={handleDetail} />
          <Line label="Remboursements emprunts" value={fluxTresorerie?.remboursementsEmprunts || 0} indent={1} color="text-danger-400" detailKey="remboursementsEmprunts" onDetail={handleDetail} />
          <Line label="Total flux de financement" value={fluxTresorerie?.fluxFinancement || 0} total />
        </Section>

        <div className="border-t border-slate-800 pt-3 mt-2">
          <Line label="Variation de trésorerie" value={fluxTresorerie?.variationTresorerie || 0} total />
          <Line label="Trésorerie initiale" value={fluxTresorerie?.tresorerieInitiale || 0} indent={1} />
          <Line label="Trésorerie finale" value={fluxTresorerie?.tresorerieFinale || 0} indent={1} detailKey="tresorerieFinale" onDetail={handleDetail} />
        </div>
      </div>

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
                      {ratios?.bfr != null ? fmt(ratios.bfr) : '0 DT'}
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
                      {ratios?.tresorerieNette != null ? fmt(ratios.tresorerieNette) : '0 DT'}
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

      {!editingAccounts && reportTab === 'balance' && (
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
                      <td className="py-1.5 px-2 text-slate-400 max-w-[200px] truncate">{b.libelle || PCG_COMPLET[b.compte] || '—'}</td>
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

      {!editingAccounts && reportTab === 'tableaux' && (
      <div className="glass-card p-5 rounded-2xl border border-slate-800 shadow-card">
        <div className="mb-4 border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-slate-100">Tableaux annexes</h3>
          <p className="text-[10px] text-slate-400 mt-1">Modifiez les valeurs directement dans les tableaux ci-dessous.</p>
        </div>

        {/* Tableau des immobilisations */}
        <h4 className="text-sm font-bold text-slate-200 mb-2 mt-4">1. Immobilisations</h4>
        <div className="overflow-x-auto text-[11px] mb-6">
          <table className="w-full">
            <thead><tr className="text-slate-400 font-bold uppercase tracking-wider border-b border-slate-700">
              <th className="text-left py-2 px-2">Catégorie</th>
              <th className="text-right py-2 px-2 w-[120px]">VB Début</th>
              <th className="text-right py-2 px-2 w-[120px]">Acquisitions</th>
              <th className="text-right py-2 px-2 w-[120px]">Cessions</th>
              <th className="text-right py-2 px-2 w-[120px]">VB Fin</th>
            </tr></thead>
            <tbody>
              {effectiveTableaux.immobilisations.map((l, i) => (
                <tr key={l._key || i} className="border-b border-slate-800/30">
                  <td className="py-1 px-2 text-slate-300">{l.categorie}</td>
                  {['debut', 'augmentation', 'diminution', 'fin'].map(f => (
                    <td key={f} className="py-1 px-2">
                      <input type="number" step="0.001" value={l[f]}
                        onChange={e => {
                          const v = parseFloat(e.target.value) || 0;
                          setTableauxData(prev => ({
                            ...prev,
                            immobilisations: (prev.immobilisations.length ? prev.immobilisations : effectiveTableaux.immobilisations).map((x, j) => j === i ? { ...x, [f]: v } : x),
                          }));
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-right text-slate-200 font-mono text-[11px] focus:outline-none focus:border-brand-500" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tableau des amortissements */}
        <h4 className="text-sm font-bold text-slate-200 mb-2 mt-6">2. Amortissements</h4>
        <div className="overflow-x-auto text-[11px] mb-6">
          <table className="w-full">
            <thead><tr className="text-slate-400 font-bold uppercase tracking-wider border-b border-slate-700">
              <th className="text-left py-2 px-2">Catégorie</th>
              <th className="text-right py-2 px-2 w-[120px]">Amort. Début</th>
              <th className="text-right py-2 px-2 w-[120px]">Dotations</th>
              <th className="text-right py-2 px-2 w-[120px]">Reprises</th>
              <th className="text-right py-2 px-2 w-[120px]">Amort. Fin</th>
            </tr></thead>
            <tbody>
              {effectiveTableaux.amortissements.map((l, i) => (
                <tr key={l._key || i} className="border-b border-slate-800/30">
                  <td className="py-1 px-2 text-slate-300">{l.categorie}</td>
                  {['debut', 'augmentation', 'diminution', 'fin'].map(f => (
                    <td key={f} className="py-1 px-2">
                      <input type="number" step="0.001" value={l[f]}
                        onChange={e => {
                          const v = parseFloat(e.target.value) || 0;
                          setTableauxData(prev => ({
                            ...prev,
                            amortissements: (prev.amortissements.length ? prev.amortissements : effectiveTableaux.amortissements).map((x, j) => j === i ? { ...x, [f]: v } : x),
                          }));
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-right text-slate-200 font-mono text-[11px] focus:outline-none focus:border-brand-500" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tableau des provisions */}
        <h4 className="text-sm font-bold text-slate-200 mb-2 mt-6">3. Provisions</h4>
        <div className="overflow-x-auto text-[11px] mb-6">
          <table className="w-full">
            <thead><tr className="text-slate-400 font-bold uppercase tracking-wider border-b border-slate-700">
              <th className="text-left py-2 px-2">Catégorie</th>
              <th className="text-right py-2 px-2 w-[120px]">Prov. Début</th>
              <th className="text-right py-2 px-2 w-[120px]">Dotations</th>
              <th className="text-right py-2 px-2 w-[120px]">Reprises</th>
              <th className="text-right py-2 px-2 w-[120px]">Prov. Fin</th>
            </tr></thead>
            <tbody>
              {effectiveTableaux.provisions.map((l, i) => (
                <tr key={l._key || i} className="border-b border-slate-800/30">
                  <td className="py-1 px-2 text-slate-300">{l.categorie}</td>
                  {['debut', 'augmentation', 'diminution', 'fin'].map(f => (
                    <td key={f} className="py-1 px-2">
                      <input type="number" step="0.001" value={l[f]}
                        onChange={e => {
                          const v = parseFloat(e.target.value) || 0;
                          setTableauxData(prev => ({
                            ...prev,
                            provisions: (prev.provisions.length ? prev.provisions : effectiveTableaux.provisions).map((x, j) => j === i ? { ...x, [f]: v } : x),
                          }));
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-right text-slate-200 font-mono text-[11px] focus:outline-none focus:border-brand-500" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Variation des capitaux propres */}
        <h4 className="text-sm font-bold text-slate-200 mb-2 mt-6">4. Variation des capitaux propres</h4>
        <div className="overflow-x-auto text-[11px] mb-6">
          <table className="w-full">
            <thead><tr className="text-slate-400 font-bold uppercase tracking-wider border-b border-slate-700">
              <th className="text-left py-2 px-2">Rubrique</th>
              <th className="text-right py-2 px-2 w-[120px]">Solde N-1</th>
              <th className="text-right py-2 px-2 w-[120px]">Augmentations</th>
              <th className="text-right py-2 px-2 w-[120px]">Diminutions</th>
              <th className="text-right py-2 px-2 w-[120px]">Solde N</th>
            </tr></thead>
            <tbody>
              {effectiveTableaux.variationCP.map((l, i) => (
                <tr key={l._key || i} className="border-b border-slate-800/30">
                  <td className="py-1 px-2 text-slate-300">{l.rubrique}</td>
                  {['debut', 'augmentation', 'diminution', 'fin'].map(f => (
                    <td key={f} className="py-1 px-2">
                      <input type="number" step="0.001" value={l[f]}
                        onChange={e => {
                          const v = parseFloat(e.target.value) || 0;
                          setTableauxData(prev => ({
                            ...prev,
                            variationCP: (prev.variationCP.length ? prev.variationCP : effectiveTableaux.variationCP).map((x, j) => j === i ? { ...x, [f]: v } : x),
                          }));
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-right text-slate-200 font-mono text-[11px] focus:outline-none focus:border-brand-500" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {!editingAccounts && reportTab === 'notes' && (
      <div className="glass-card p-5 rounded-2xl border border-slate-800 shadow-card">
        <div className="mb-4 border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-slate-100">Notes aux états financiers</h3>
          <p className="text-[10px] text-slate-400 mt-1">Saisissez les notes explicatives et les principes comptables.</p>
        </div>

        <div className="mb-6">
          <h4 className="text-sm font-bold text-slate-200 mb-2">Notes explicatives</h4>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            rows={8}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500 placeholder-slate-500 font-mono"
            placeholder="Saisissez ici les notes aux états financiers (méthodes de calcul, hypothèses retenues, faits marquants, etc.)..." />
        </div>

        <div className="mb-4">
          <h4 className="text-sm font-bold text-slate-200 mb-2">Principes et méthodes comptables</h4>
          <textarea value={accountingPolicies} onChange={e => setAccountingPolicies(e.target.value)}
            rows={8}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500 placeholder-slate-500 font-mono"
            placeholder="Saisissez ici les principes comptables appliqués (mode d'évaluation, méthode d'amortissement, règles de provisionnement, etc.)..." />
        </div>
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
