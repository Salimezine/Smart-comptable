import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Scan, 
  ArrowLeftRight, 
  Settings as SettingsIcon, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calculator, 
  Plus, 
  Download, 
  Trash2, 
  Sparkles, 
  Upload, 
  CheckCircle2, 
  CheckCheck,
  AlertCircle, 
  RefreshCw, 
  Search,
  Building,
  User,
  Layers,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
   Lock,
   KeyRound,
   Filter,
   Send,
   Package,
   BookOpen
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { jsPDF } from 'jspdf';
import { 
  INITIAL_INVOICES, 
  INITIAL_TRANSACTIONS, 
  INITIAL_EXPENSES
} from './mockData';
import { 
  calculateTotalRevenues, 
  calculatePendingRevenues, 
  calculateTotalExpenses, 
  calculateEstimatedTaxes, 
  calculateInvoiceTotals, 
  formatCurrencyHelper,
  computeMonthlyChartData,
  generateSimulatedData 
} from './accountingUtils';
import { generateInvoiceLocal } from './invoiceService';
import scanFacture, { CATEGORIES_SCE, FOURNISSEURS_TN, validerCalculs } from './tesseractOcr';
import { runFullAudit, generateAuditMarkdown } from './auditEngine';
import { learnFromExpense, learnFromInvoice, searchEntities, getLearningStats, predictCategory, predictVatRate } from './learningEngine';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import Onboarding from './Onboarding';
import CompanySwitcher from './CompanySwitcher';
import FournisseursView from './FournisseursView';
import JournalView from './JournalView';
import ExpenseListView from './ExpenseListView';
import FinancialReportView from './FinancialReportView';
import { isPinSet, setPin, verifyPin, setupInactivityTracker, resetAll } from './security';

function normaliserMontant(str) {
  if (!str) return null;
  let s = str.toString()
    .replace(/\s/g, '')
    .replace(/DT|TND/gi, '')
    .trim();
  if (!s) return null;

  if ((s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, '');
    if (s.length > 3) s = s.slice(0, -3) + '.' + s.slice(-3);
  } else {
    s = s.replace(',', '.');
  }

  const n = parseFloat(s);
  return isNaN(n) ? null : parseFloat(n.toFixed(3));
}

function detecterCategorie(text) {
  const t = text.toLowerCase();
  if (/ooredoo|telecom|orange|internet|topnet|hexabyte|globalnet/.test(t)) return 'frais_telecommunication';
  if (/steg|sonede|électricité|gaz|eau/.test(t)) return 'frais_energie';
  if (/carburant|essence|gasoil|sndp/.test(t)) return 'frais_carburant';
  if (/loyer|local/.test(t)) return 'loyer';
  if (/honoraire|consultant|expert|avocat/.test(t)) return 'honoraires';
  if (/transport|livraison|courrier/.test(t)) return 'frais_transport';
  if (/assurance/.test(t)) return 'frais_assurance';
  if (/fourniture|bureau|papier|cartouche|imprimante/.test(t)) return 'fournitures_bureau';
  if (/informatique|ordinateur|logiciel|serveur/.test(t)) return 'frais_informatique';
  if (/publicité|marketing|pub/.test(t)) return 'frais_publicite';
  if (/banque|bancaire|agios/.test(t)) return 'frais_bancaires';
  return 'services_exterieurs';
}

function parseTexteFacture(text) {
  const result = {
    fournisseur: null, matricule_fiscal: null, date: null, numero_facture: null,
    montant_ht: null, fodec: 0, base_tva: null, taux_tva: null, montant_tva: null,
    timbre_fiscal: 1.000, retenue_source: 0, montant_ttc: null, net_a_payer: null,
    categorie_sce: null, lignes: [], flag_incoherence: false,
  };

  const numPatterns = [
    /(?:Facture\s+)?N°\s*[:\s-]*([A-Z]{2,4}[-\/]\d{4}[-\/]\d{3,6})/i,
    /(?:FAC|INV|FC|FA|BL|REF)[-\/](\d{4}[-\/]\d{3,6})/i,
    /([A-Z]{2}\d{2}[A-Z]{2}\d{3,})/,
    /N°\s*(\d{4,})/i
  ];
  for (const pattern of numPatterns) {
    const m = text.match(pattern);
    if (m) { result.numero_facture = m[1] || m[0]; break; }
  }

  const dateMatch = text.match(/(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})/);
  if (dateMatch) result.date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;

  const fournMatch = text.match(/(?:Fournisseur|Vendeur|Société|Ste)\s*[:\-]?\s*([^\n\r,]{3,60})/i);
  if (fournMatch) result.fournisseur = fournMatch[1].trim();

  const mfMatch = text.match(/(?:MF|Matricule\s*[Ff]iscal[e]?)\s*[:\-]?\s*(\d{7}[\/\\][A-Z][\/\\][A-Z][\/\\][A-Z][\/\\]\d{3})/i);
  if (mfMatch) result.matricule_fiscal = mfMatch[1];

  const tvaMatch = text.match(/TVA\s*(7|13|19)\s*%/i);
  if (tvaMatch) result.taux_tva = parseInt(tvaMatch[1]);

  const htMatch = text.match(/(?:Total\s+HT|HT)\s*[:\-]?\s*([\d\s.,]+\d)/i);
  if (htMatch) result.montant_ht = normaliserMontant(htMatch[1]);

  const tvaAmountMatch = text.match(/TVA\s*(?:\d+\s*%)?\s*[:\-]\s*([\d\s.,]+\d)/i);
  if (tvaAmountMatch) result.montant_tva = normaliserMontant(tvaAmountMatch[1]);

  const ttcMatch = text.match(/(?:TTC|Total\s+TTC|Net\s+[àa]\s+payer)\s*[:\-]?\s*(?::\s*)?([\d\s.,]+\d)/i);
  if (ttcMatch) result.montant_ttc = normaliserMontant(ttcMatch[1]);

  const fodecMatch = text.match(/FODEC\s*[:\-]?\s*([\d.,]+)/i);
  if (fodecMatch) result.fodec = normaliserMontant(fodecMatch[1]) || 0;

  const timbreMatch = text.match(/[Tt]imbre\s*[:\-]?\s*([\d.,]+)/i);
  if (timbreMatch) result.timbre_fiscal = normaliserMontant(timbreMatch[1]);

  const rsMatch = text.match(/(?:Retenue|R\.?S\.?)\s*(?:[àa]\s+la\s+source)?\s*(?:\d+\s*%)?\s*[:\-]?\s*([\d.,]+)/i);
  if (rsMatch) result.retenue_source = normaliserMontant(rsMatch[1]);

  const ligneRegex = /(?:Désignation|Article|Produit|Service)\s*[:\-]?\s*(.+?)(?:Qté?|Quantité)\s*[:\-]?\s*(\d+).*?(?:PU|Prix\s+[Uu]nitaire)\s*[:\-]?\s*([\d.,]+)/gi;
  let lm;
  while ((lm = ligneRegex.exec(text)) !== null) {
    const qte = parseInt(lm[2]);
    const pu = normaliserMontant(lm[3]);
    if (qte > 0 && qte < 99999 && pu !== null) {
      result.lignes.push({
        designation: lm[1].replace(/Désignation\s*[:\-]?\s*/i, '').trim(),
        prix_unitaire: pu,
        quantite: qte,
        total: parseFloat((pu * qte).toFixed(3)),
      });
    }
  }

  if (result.montant_ht !== null) {
    result.base_tva = parseFloat((result.montant_ht + result.fodec).toFixed(3));
  }
  if (result.montant_ttc !== null) {
    result.net_a_payer = parseFloat((result.montant_ttc - result.retenue_source).toFixed(3));
  }

  const textLower = text.toLowerCase();
  if (textLower.includes('steg') || textLower.includes('sonede')) result.timbre_fiscal = 0;
  result.categorie_sce = detecterCategorie(textLower);

  return result;
}

export default function App() {
  // Security State
  const [locked, setLocked] = useState(true);
  const [pinMode, setPinMode] = useState(null); // 'setup' | 'unlock' | null
  const pinRef = useRef('');
  const lockCleanupRef = useRef(null);

  // Navigation State
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ invoices: [], expenses: [] });
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);

  // Advisor State
  const [advisorModalOpen, setAdvisorModalOpen] = useState(false);
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorReport, setAdvisorReport] = useState('');
  
  // App States - Multi-Tenant
  const [companies, setCompanies] = useState(() => {
    const stored = localStorage.getItem('smart_comptable_companies');
    if (!stored) return {};
    try { return JSON.parse(stored); } catch { return {}; }
  });
  
  const [currentCompanyId, setCurrentCompanyId] = useState(() => {
    return localStorage.getItem('smart_comptable_current_id') || null;
  });

  const [invoices, setInvoices] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [companyDetails, setCompanyDetails] = useState({});

  // PIN initialization
  useEffect(() => {
    if (!isPinSet()) {
      setPinMode('setup');
    } else {
      setPinMode('unlock');
    }
  }, []);

  const handleLock = useCallback(() => {
    if (lockCleanupRef.current) lockCleanupRef.current();
    lockCleanupRef.current = null;
    pinRef.current = '';
    setLocked(true);
    setPinMode('unlock');
  }, []);

  const handleUnlock = useCallback(async (pin) => {
    const ok = await verifyPin(pin);
    if (!ok) return false;
    pinRef.current = pin;
    setLocked(false);
    setPinMode(null);
    lockCleanupRef.current = setupInactivityTracker(() => handleLock());
    return true;
  }, [handleLock]);

  const handleSetupPin = useCallback(async (pin) => {
    await setPin(pin);
    const ok = await handleUnlock(pin);
    return ok;
  }, [handleUnlock]);

  const handleGenerateSimulatedData = useCallback(() => {
    const data = generateSimulatedData();
    setInvoices(data.invoices);
    setExpenses(data.expenses);
    setTransactions(data.transactions);
  }, []);

  // Load specific company data when selected
  useEffect(() => {
    const loadData = async () => {
      if (currentCompanyId && companies[currentCompanyId]) {
        const data = companies[currentCompanyId];
        setInvoices(data.invoices || []);
        setTransactions(data.transactions || []);
        setExpenses(data.expenses || []);

        const details = { ...(data.companyDetails || {}) };
        setCompanyDetails(details);
      }
    };
    loadData();
  }, [currentCompanyId]); // Run only when ID changes

  // Persist local state back to the companies catalogue
  useEffect(() => {
    const saveData = async () => {
      if (!currentCompanyId) return;

      // Store company data
      const safeDetails = { ...companyDetails };

      setCompanies(prev => {
        const currentData = prev[currentCompanyId] || {};
        const updated = {
          ...prev,
          [currentCompanyId]: {
            ...currentData,
            invoices,
            transactions,
            expenses,
            companyDetails: safeDetails
          }
        };
        localStorage.setItem('smart_comptable_companies', JSON.stringify(updated));
        return updated;
      });
    };
    saveData();
  }, [invoices, transactions, expenses, companyDetails, currentCompanyId]);

  const handleCreateCompany = (details) => {
    const id = `company_${Date.now()}`;
    const safeDetails = { ...details };
    
    const initialData = {
      companyDetails: safeDetails,
      invoices: [],
      expenses: [],
      transactions: [],
      dashboardData: {}
    };
    
    setCompanies(prev => {
      const updated = { ...prev, [id]: initialData };
      localStorage.setItem('smart_comptable_companies', JSON.stringify(updated));
      return updated;
    });
    
    setCurrentCompanyId(id);
    localStorage.setItem('smart_comptable_current_id', id);
  };

  const handleCompanyChange = (id) => {
    setCurrentCompanyId(id);
    localStorage.setItem('smart_comptable_current_id', id);
  };

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    if (query.length < 2) { setSearchResults({ invoices: [], expenses: [] }); return; }
    const results = searchEntities(invoices, expenses, query);
    setSearchResults(results);
    setSearchOpen(true);
  }, [invoices, expenses]);

  // Security screens
  if (locked && pinMode === 'setup') {
    return <PinSetupScreen onComplete={handleSetupPin} />;
  }
  if (locked && pinMode === 'unlock') {
    return <LockScreen onUnlock={handleUnlock} />;
  }

  // 1. Écran de démarrage obligatoire
  if (!currentCompanyId || !companies[currentCompanyId]) {
    return <Onboarding onComplete={handleCreateCompany} />;
  }

  // Core accounting metrics calculations using standard accounting utils
  const totalRevenues = calculateTotalRevenues(invoices);
  const pendingRevenues = calculatePendingRevenues(invoices);
  const totalExpenses = calculateTotalExpenses(expenses);
  const bankBalance = totalRevenues - totalExpenses;
  const estimatedTaxes = calculateEstimatedTaxes(totalRevenues);

  // Helpers
  const formatCurrency = (val) => {
    return formatCurrencyHelper(val, companyDetails.currency);
  };

  const handleAddInvoice = (newInv) => {
    learnFromInvoice(newInv);
    setInvoices([newInv, ...invoices]);
  };

  const handleAddExpense = (newExp) => {
    learnFromExpense(newExp);
    setExpenses([newExp, ...expenses]);
  };

  const handleRequestAudit = () => {
    setAdvisorModalOpen(true);
    setAdvisorLoading(true);
    setAdvisorReport('');
    try {
      const result = runFullAudit({ invoices, expenses, transactions, companyDetails });
      const md = generateAuditMarkdown(result);
      setAdvisorReport(md);
    } catch (err) {
      setAdvisorReport("❌ Erreur lors de l'audit : " + err.message);
    } finally {
      setAdvisorLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-surface-900 text-slate-100 font-sans overflow-hidden relative">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar - off-canvas on mobile */}
      <aside className={`w-72 glass-panel border-r border-slate-800 flex flex-col justify-between shrink-0 z-40 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } fixed lg:static inset-y-0 left-0`}>
        <div>
          {/* Logo */}
          <div className="p-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow">
              <Sparkles className="w-5 h-5 text-white animate-pulse-soft" />
            </div>
            <div>
              <h1 className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-indigo-200 via-indigo-400 to-indigo-100 bg-clip-text text-transparent">
                Smart <span className="text-brand-400">Comptable</span>
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-medium">Smart SaaS Ledger</p>
            </div>
          </div>

          {/* Nav list */}
          <nav className="px-4 py-2 space-y-1.5">
            {[
              { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
              { id: 'workflow', label: 'Flux de Clôture', icon: Layers, badge: 'Workflow' },
              { id: 'invoicing', label: 'Factures Client', icon: FileText },
              { id: 'suppliers', label: 'Fournisseurs', icon: Package },
              { id: 'expenses', label: 'Dépenses', icon: TrendingDown },
              { id: 'ocr', label: 'Scan Reçus (IA)', icon: Scan, badge: 'New' },
              { id: 'bank', label: 'Rapprochement', icon: ArrowLeftRight, badge: transactions.filter(t => t.status === 'UNRECONCILED').length || null },
              { id: 'financial', label: 'Bilan & Résultat', icon: CheckCheck },
              { id: 'journal', label: 'Journal Comptable', icon: BookOpen },
              { id: 'settings', label: 'Configuration', icon: SettingsIcon },
            ].map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { setCurrentTab(item.id); setSidebarOpen(false); }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300 font-medium text-sm ${
                    isActive 
                      ? 'bg-gradient-brand text-white shadow-glow' 
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-brand-500/20 text-brand-400'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Sidebar / Profile preview */}
        <div className="p-4 border-t border-slate-800/50 bg-slate-900/40">
          <CompanySwitcher 
            companies={companies}
            currentCompanyId={currentCompanyId}
            onCompanyChange={handleCompanyChange}
            onCreateCompany={handleCreateCompany}
          />
          <button onClick={handleLock} className="w-full mt-2 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-amber-400 hover:bg-slate-800/40 transition-all duration-200">
            <Lock className="w-3.5 h-3.5" />
            Verrouiller
          </button>
          <div className="flex items-center gap-3 mt-2">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
              <User className="w-5 h-5 text-slate-300" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-200 truncate">{companyDetails.name}</p>
              <span className="text-[10px] text-accent-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Plan Pro IA Active
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto relative bg-surface-900">
        {/* Header */}
        <header className="h-16 lg:h-20 border-b border-slate-800/50 flex items-center justify-between px-4 sm:px-6 lg:px-8 bg-slate-950/20 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger */}
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/40 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div className="min-w-0">
              <h2 className="text-base lg:text-xl font-bold tracking-tight text-white capitalize truncate">
                {currentTab === 'dashboard' && 'Vue d\'ensemble financière'}
                {currentTab === 'workflow' && 'Flux de Clôture'}
                {currentTab === 'invoicing' && 'Factures de Ventes'}
                {currentTab === 'suppliers' && 'Gestion des Fournisseurs'}
                {currentTab === 'expenses' && 'Toutes les Dépenses'}
                {currentTab === 'ocr' && 'Numérisation & OCR'}
                {currentTab === 'bank' && 'Rapprochement Bancaire'}
                {currentTab === 'financial' && 'Bilan & Rapport Financier SCE'}
                {currentTab === 'journal' && 'Journal Comptable — Saisie des écritures'}
                {currentTab === 'settings' && 'Configuration & Entreprise'}
              </h2>
              <p className="text-[10px] lg:text-xs text-slate-400 hidden sm:block truncate">
              {currentTab === 'dashboard' && 'Suivez la santé de votre trésorerie et vos estimations fiscales en temps réel.'}
              {currentTab === 'invoicing' && 'Créez, gérez et exportez vos factures clients aux normes.'}
              {currentTab === 'suppliers' && 'Gérez vos fournisseurs, consultez les historiques d\'achats et les matricules fiscaux.'}
              {currentTab === 'expenses' && 'Consultez, filtrez et gérez l\'ensemble de vos dépenses enregistrées.'}
              {currentTab === 'ocr' && 'Tesseract.js lit vos factures directement dans le navigateur — zéro API, zéro clé, 100% privé'}
              {currentTab === 'bank' && 'Associez vos relevés bancaires simulés à vos factures de ventes ou d\'achats.'}
              {currentTab === 'financial' && 'Consultez le bilan SCE, le compte de résultat et les ratios financiers.'}
              {currentTab === 'journal' && 'Consultez et filtrez les écritures comptables par journal (Achats, Ventes, Banque, OD).'}
              {currentTab === 'workflow' && 'Suivez pas à pas la déclaration de vos charges sociales, impôts IS et validez le mois.'}
              {currentTab === 'settings' && 'Renseignez les données légales de votre société pour les QR Codes et factures.'}
            </p>
          </div>
            {/* Search */}
            <div className="hidden sm:block relative flex-1 max-w-xs mx-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Rechercher facture, fournisseur..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => searchQuery.length >= 2 && setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
                className="w-full bg-slate-900/60 border border-slate-800 focus:border-brand-500 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none transition-colors placeholder:text-slate-600"
              />
              {searchOpen && searchQuery.length >= 2 && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 max-h-72 overflow-y-auto">
                  <div className="p-2 space-y-0.5">
                    {searchResults.invoices.length === 0 && searchResults.expenses.length === 0 && (
                      <p className="text-[11px] text-slate-500 px-3 py-4 text-center">Aucun résultat</p>
                    )}
                    {searchResults.invoices.slice(0, 5).map((inv, i) => (
                      <button key={'si'+i} onClick={() => { setCurrentTab('invoicing'); setSearchOpen(false); setSearchQuery(''); }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-800/60 text-left transition-colors">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-200 truncate">{inv.clientName}</p>
                          <p className="text-[10px] text-slate-500 truncate">{inv.invoiceNumber} — {inv.issueDate}</p>
                        </div>
                        <span className="text-[11px] font-bold text-accent-400 shrink-0 ml-2">{formatCurrency(inv.totalAmount)}</span>
                      </button>
                    ))}
                    {searchResults.expenses.slice(0, 5).map((exp, i) => (
                      <button key={'se'+i} onClick={() => { setCurrentTab('ocr'); setSearchOpen(false); setSearchQuery(''); }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-800/60 text-left transition-colors">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-200 truncate">{exp.supplier}</p>
                          <p className="text-[10px] text-slate-500 truncate">{exp.category} — {exp.date}</p>
                        </div>
                        <span className="text-[11px] font-bold text-danger-400 shrink-0 ml-2">-{formatCurrency(exp.totalAmount)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Quick Actions */}
            {currentTab === 'dashboard' && (
              <button 
                onClick={handleRequestAudit} 
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 text-[10px] sm:text-xs font-bold bg-slate-800 hover:bg-slate-750 text-brand-400 border border-brand-500/30 rounded-xl transition-all duration-300 shadow-inner-glow"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Audit</span>
              </button>
            )}
            {(currentTab === 'dashboard' || currentTab === 'financial') && (
              <button 
                onClick={handleGenerateSimulatedData} 
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 text-[10px] sm:text-xs font-bold bg-slate-800 hover:bg-slate-750 text-amber-400 border border-amber-500/20 rounded-xl transition-all duration-300 shadow-inner-glow"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Simuler</span>
              </button>
            )}
            <button 
              onClick={() => setCurrentTab('ocr')} 
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 text-[10px] sm:text-xs font-bold bg-slate-800 hover:bg-slate-750 text-indigo-400 border border-indigo-500/20 rounded-xl transition-all duration-300 shadow-inner-glow"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Scan</span>
            </button>
            <button 
              onClick={() => setCurrentTab('invoicing')} 
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 text-[10px] sm:text-xs font-bold bg-gradient-brand hover:opacity-90 text-white rounded-xl transition-all duration-300 shadow-glow"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Facture</span>
            </button>
          </div>
        </header>

        {/* Tab Switcher Body */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 lg:space-y-8 animate-fade-in">
            {currentTab === 'dashboard' && (
              <DashboardView 
                totalRevenues={totalRevenues}
                pendingRevenues={pendingRevenues}
                totalExpenses={totalExpenses}
                bankBalance={bankBalance}
                estimatedTaxes={estimatedTaxes}
                formatCurrency={formatCurrency}
                invoices={invoices}
                expenses={expenses}
              />
            )}
            {currentTab === 'invoicing' && (
              <InvoicingView 
                invoices={invoices}
                setInvoices={setInvoices}
                formatCurrency={formatCurrency}
                companyDetails={companyDetails}
              />
            )}
            {currentTab === 'suppliers' && (
              <FournisseursView
                expenses={expenses}
                formatCurrency={formatCurrency}
              />
            )}
            {currentTab === 'expenses' && (
              <ExpenseListView
                expenses={expenses}
                setExpenses={setExpenses}
                formatCurrency={formatCurrency}
              />
            )}
            {currentTab === 'ocr' && (
              <OcrView 
                expenses={expenses}
                onAddExpense={handleAddExpense}
                formatCurrency={formatCurrency}
                companyDetails={companyDetails}
                setInvoices={setInvoices}
              />
            )}
            {currentTab === 'workflow' && (
              <WorkflowView
                expenses={expenses}
                transactions={transactions}
                invoices={invoices}
                formatCurrency={formatCurrency}
                setExpenses={setExpenses}
                setTransactions={setTransactions}
                setInvoices={setInvoices}
                currentTab={currentTab}
                setCurrentTab={setCurrentTab}
                companyDetails={companyDetails}
              />
            )}
            {currentTab === 'bank' && (
              <BankSyncView 
                transactions={transactions}
                setTransactions={setTransactions}
                invoices={invoices}
                setInvoices={setInvoices}
                formatCurrency={formatCurrency}
              />
            )}
            {currentTab === 'financial' && (
              <FinancialReportView 
                companyDetails={companyDetails}
                invoices={invoices}
                expenses={expenses}
                transactions={transactions}
                formatCurrency={formatCurrency}
              />
            )}
            {currentTab === 'journal' && (
              <JournalView
                invoices={invoices}
                expenses={expenses}
                transactions={transactions}
                formatCurrency={formatCurrency}
              />
            )}
            {currentTab === 'settings' && (
              <SettingsView 
                companyDetails={companyDetails}
                setCompanyDetails={setCompanyDetails}
              />
            )}
          </div>
        </div>
      </main>

      {/* AI Advisor Modal */}
      {advisorModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden relative">
            <div className="p-6 border-b border-slate-800/50 flex justify-between items-center bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-white">Smart-Comptable IA</h3>
                  <p className="text-xs text-brand-400 font-medium">Assistant Financier & Fiscal Tunisie</p>
                </div>
              </div>
              <button onClick={() => setAdvisorModalOpen(false)} className="text-slate-500 hover:text-white p-2">
                ✕
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto flex-1 text-sm text-slate-300 prose prose-invert prose-brand max-w-none">
              {advisorLoading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <RefreshCw className="w-8 h-8 text-brand-400 animate-spin" />
                  <p className="text-slate-400 font-medium animate-pulse">Analyse locale de vos flux comptables en cours...</p>
                </div>
              ) : (
                <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{advisorReport}</ReactMarkdown>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-800/50 bg-slate-900/50 text-center">
              <p className="text-[10px] text-slate-500">Smart Comptable n'est pas un conseiller fiscal agréé. Validez toujours vos déclarations avec un expert-comptable inscrit à l'OECT.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   COMPONENT: DASHBOARD VIEW
   ========================================================================== */
function DashboardView({ 
  totalRevenues, 
  pendingRevenues, 
  totalExpenses, 
  bankBalance, 
  estimatedTaxes, 
  formatCurrency,
  invoices,
  expenses
}) {
  // Évolution de la Trésorerie calculée à partir des données réelles
  const chartData = computeMonthlyChartData(invoices, expenses);

  // Calcul du taux de taxes
  const taxRatio = Math.min((estimatedTaxes / (totalRevenues || 1)) * 100, 100);

  return (
    <div className="space-y-6">
      {/* 4 Cards Métriques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[
          { title: 'Revenus Encaissés', value: totalRevenues, color: 'text-accent-400', icon: TrendingUp, bg: 'bg-accent-500/10 border-accent-500/20' },
          { title: 'Dépenses Totales', value: totalExpenses, color: 'text-danger-400', icon: TrendingDown, bg: 'bg-danger-500/10 border-danger-500/20' },
          { title: 'Factures en Attente', value: pendingRevenues, color: 'text-warning-400', icon: FileText, bg: 'bg-warning-500/10 border-warning-500/20' },
          { title: 'Solde Trésorerie', value: bankBalance, color: 'text-brand-400', icon: DollarSign, bg: 'bg-brand-500/10 border-brand-500/20' },
        ].map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className={`glass-card p-6 rounded-2xl border ${card.bg} relative overflow-hidden group shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{card.title}</p>
                  <h3 className={`text-2xl font-extrabold mt-2 tracking-tight ${card.color}`}>
                    {formatCurrency(card.value)}
                  </h3>
                </div>
                <div className={`p-2.5 rounded-xl ${card.bg} border border-slate-700/50`}>
                  <Icon className="w-5 h-5 text-slate-300 group-hover:scale-110 transition-transform duration-300" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 w-full h-[3px] bg-gradient-to-r from-slate-800 to-slate-700/30" />
            </div>
          );
        })}
      </div>

      {/* Graphiques et Estimations d'Impôts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graphique de Trésorerie principal */}
        <div className="glass-card p-6 rounded-2xl border border-slate-800 lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-slate-100">Évolution de la Trésorerie</h3>
              <p className="text-xs text-slate-400">Revenus nets vs Dépenses cumulées sur l'année</p>
            </div>
            <div className="flex gap-2">
              <span className="text-xs font-semibold px-2 py-1 bg-brand-500/10 text-brand-400 rounded-md border border-brand-500/20">Semestriel</span>
            </div>
          </div>

          <div className="w-full">
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenues" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}
                  labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="Revenus" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenues)" />
                <Area type="monotone" dataKey="Dépenses" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorExpenses)" />
                <Area type="monotone" dataKey="Trésorerie" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCash)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Jauge des Impôts / RCharges Sociales */}
        <div className="glass-card p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-warning-400">
              <Calculator className="w-5 h-5" />
              <h3 className="font-bold text-slate-100">Provision d'Impôts IA</h3>
            </div>
            <p className="text-xs text-slate-400">Calcul automatique estimatif basé sur vos encaissements réels de l'exercice fiscal en cours.</p>
          </div>

          <div className="my-6 flex flex-col items-center justify-center relative">
            {/* SVG Arc Progress Circle */}
            <div className="relative w-44 h-44 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="88" cy="88" r="70" stroke="#1e293b" strokeWidth="12" fill="transparent" />
                <circle cx="88" cy="88" r="70" stroke="url(#warningGradient)" strokeWidth="12" fill="transparent" 
                  strokeDasharray="440"
                  strokeDashoffset={440 - (440 * taxRatio) / 100}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
                <defs>
                  <linearGradient id="warningGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute text-center">
                <p className="text-3xl font-extrabold text-white tracking-tight">{formatCurrency(estimatedTaxes)}</p>
                <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Provision IS (15%)</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>CNSS Employeur (16.57%) :</span>
              <span className="font-semibold text-slate-200">{formatCurrency(totalRevenues * 0.1657)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Impôt sur Sociétés IS (15%) :</span>
              <span className="font-semibold text-slate-200">{formatCurrency(totalRevenues * 0.15)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recents list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recents factures */}
        <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="font-bold text-slate-100">Facturations Récentes</h3>
          <div className="space-y-3">
            {invoices.slice(0, 4).map((inv, idx) => (
              <div key={idx} className="flex justify-between items-center p-3.5 bg-slate-900/30 hover:bg-slate-800/25 rounded-xl border border-slate-800/50 transition-colors">
                <div>
                  <h4 className="text-sm font-bold text-white">{inv.clientName}</h4>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <span>{inv.invoiceNumber}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-600" />
                    <span>Créée le {inv.issueDate}</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-extrabold text-slate-100 block">{formatCurrency(inv.totalAmount)}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-1 ${
                    inv.status === 'PAID' ? 'bg-accent-500/10 text-accent-400' :
                    inv.status === 'SENT' ? 'bg-warning-500/10 text-warning-400' : 'bg-danger-500/10 text-danger-400'
                  }`}>
                    {inv.status === 'PAID' ? 'Payée' : inv.status === 'SENT' ? 'Envoyée' : 'Retard'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recents dépenses */}
        <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="font-bold text-slate-100">Dépenses Enregistrées par l'IA</h3>
          <div className="space-y-3">
            {expenses.slice(0, 4).map((exp, idx) => (
              <div key={idx} className="flex justify-between items-center p-3.5 bg-slate-900/30 hover:bg-slate-800/25 rounded-xl border border-slate-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{exp.supplier}</h4>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span className="text-indigo-400 font-semibold">{exp.category}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-600" />
                      <span>{exp.date}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-extrabold text-danger-400 block">-{formatCurrency(exp.totalAmount)}</span>
                  <span className="text-[10px] text-slate-400 font-medium mt-1 inline-block">Validée</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   COMPONENT: INVOICING VIEW (LIST & CREATE FACTURE)
   ========================================================================== */
function InvoicingView({ invoices, setInvoices, formatCurrency, companyDetails }) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterClient, setFilterClient] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  
  // Articles de la facture
  const [items, setItems] = useState([
    { id: Date.now(), description: 'Prestation de développement logiciel', quantity: 1, unitPrice: 1200.000, vatRate: 19 }
  ]);

  const handleAddItem = () => {
    setItems([...items, { id: Date.now(), description: '', quantity: 1, unitPrice: 0.000, vatRate: 19 }]);
  };

  const handleRemoveItem = (id) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const handleItemChange = (id, field, value) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        updated.total = (parseFloat(updated.quantity) || 0) * (parseFloat(updated.unitPrice) || 0);
        return updated;
      }
      return item;
    }));
  };

  // Calculs totaux via nos utilitaires comptables partagés
  const { subtotal, vatAmount, totalAmount } = calculateInvoiceTotals(items);

  const filteredInvoices = invoices.filter(inv => {
    if (filterStatus !== 'all' && inv.status !== filterStatus) return false;
    if (filterClient && !inv.clientName.toLowerCase().includes(filterClient.toLowerCase())) return false;
    if (filterDateFrom && inv.issueDate < filterDateFrom) return false;
    if (filterDateTo && inv.issueDate > filterDateTo) return false;
    return true;
  });


  // Création finale
  const handleSaveInvoice = (e) => {
    e.preventDefault();
    if (!clientName || !clientEmail || !dueDate) return;

    const count = invoices.length + 1;
    const invoiceNum = `FACT-2026-${String(count).padStart(3, '0')}`;

    const newInvoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: invoiceNum,
      clientName,
      clientEmail,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate,
      subtotal,
      vatAmount,
      totalAmount,
      status: "SENT",
      items: items.map(item => ({
        ...item,
        total: item.quantity * item.unitPrice
      }))
    };

    setInvoices([newInvoice, ...invoices]);
    
    // Reset state & hide form
    setClientName('');
    setClientEmail('');
    setDueDate('');
    setItems([{ id: Date.now(), description: 'Prestation de développement logiciel', quantity: 1, unitPrice: 1200.000, vatRate: 19 }]);
    setShowCreateForm(false);
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError('');
    try {
      const lastInv = invoices.length > 0 ? invoices[0].invoiceNumber : null;
      const data = await generateInvoiceLocal(aiPrompt, companyDetails, lastInv);
      setClientName(data.clientName || '');
      setClientEmail(data.clientEmail || '');
      setDueDate(data.dueDate || '');
      if (data.items && data.items.length > 0) {
        setItems(data.items.map(item => ({ ...item, id: Date.now() + Math.random() })));
      }
      setAiModalOpen(false);
      setAiPrompt('');
      setShowCreateForm(true);
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  // Télécharger Facture en PDF
  const handleDownloadPDF = (invoice) => {
    const doc = new jsPDF();
    
    // Header Style
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(99, 102, 241); // Indigo color
    doc.text("Smart Comptable Ledger", 20, 25);
    
    // Metadata
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Facture N°: ${invoice.invoiceNumber}`, 20, 32);
    doc.text(`Date d'émission: ${invoice.issueDate}`, 20, 37);
    doc.text(`Échéance: ${invoice.dueDate}`, 20, 42);

    // Emetteur (SaaSify / Company Details)
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text("ÉMETTEUR :", 20, 55);
    doc.setFont("Helvetica", "normal");
    doc.text(companyDetails.name, 20, 60);
    doc.text(companyDetails.address, 20, 65);
    doc.text(`TVA : ${companyDetails.vatNumber}`, 20, 70);

    // Destinataire
    doc.setFont("Helvetica", "bold");
    doc.text("DESTINATAIRE :", 120, 55);
    doc.setFont("Helvetica", "normal");
    doc.text(invoice.clientName, 120, 60);
    doc.text(invoice.clientEmail, 120, 65);

    // Table Header
    doc.setFillColor(241, 245, 249);
    doc.rect(20, 85, 170, 8, "F");
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Description", 22, 90);
    doc.text("Qté", 115, 90);
    doc.text("P.U. HT (DT)", 135, 90);
    doc.text("Total HT (DT)", 165, 90);

    // Table Lines
    let currentY = 99;
    invoice.items.forEach(item => {
      doc.setFont("Helvetica", "normal");
      doc.text(item.description, 22, currentY);
      doc.text(String(item.quantity), 115, currentY);
      doc.text(parseFloat(item.unitPrice).toFixed(3), 135, currentY);
      doc.text(parseFloat(item.total).toFixed(3), 165, currentY);
      currentY += 8;
    });

    // Separator line
    doc.setDrawColor(226, 232, 240);
    doc.line(20, currentY, 190, currentY);
    currentY += 10;

    // Totals Block
    doc.setFont("Helvetica", "bold");
    doc.text("Sous-total HT:", 135, currentY);
    doc.text(parseFloat(invoice.subtotal).toFixed(3) + " DT", 165, currentY);
    currentY += 6;
    doc.text("Total TVA:", 135, currentY);
    doc.text(parseFloat(invoice.vatAmount).toFixed(3) + " DT", 165, currentY);
    currentY += 6;
    doc.text("Timbre Fiscal:", 135, currentY);
    doc.text("1.000 DT", 165, currentY);
    currentY += 8;
    
    // Total TTC
    doc.setFontSize(11);
    doc.setTextColor(99, 102, 241);
    doc.text("Total TTC:", 135, currentY);
    doc.text(parseFloat(invoice.totalAmount).toFixed(3) + " DT", 165, currentY);

    // Dynamic QR Code Conforme EPC (Mock)
    currentY += 15;
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("QR Code dynamique de paiement instantané.", 20, currentY);
    
    // Draw QR box mockup
    doc.setDrawColor(99, 102, 241);
    doc.rect(20, currentY + 4, 30, 30);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(99, 102, 241);
    doc.text("SCAN FOR PAY", 22, currentY + 20);

    // Save document
    doc.save(`${invoice.invoiceNumber}_${invoice.clientName.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* View Header with Toggle Action */}
        <div className="flex justify-between items-center bg-slate-900/20 p-4 rounded-xl border border-slate-800/40">
          <div>
            <h3 className="font-bold text-lg text-slate-100">Liste des Factures Clients</h3>
            <p className="text-xs text-slate-400">Suivez l'encaissement et générez des PDF avec QR Code instantanément.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setAiModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-slate-800 text-brand-400 border border-brand-500/30 rounded-xl hover:bg-slate-750 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" /> Générer par IA
            </button>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-gradient-brand text-white rounded-xl shadow-glow transition-all"
            >
              {showCreateForm ? 'Annuler' : 'Créer une facture'}
            </button>
          </div>
        </div>

      {showCreateForm ? (
        /* FORMULAIRE DE CRÉATION DE FACTURE */
        <form onSubmit={handleSaveInvoice} className="glass-card p-8 rounded-2xl border border-slate-800 space-y-6 animate-slide-up">
          <h3 className="text-base font-bold text-indigo-400 flex items-center gap-2">
            <Plus className="w-5 h-5" /> Nouveau Document Client
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs text-slate-400 font-bold mb-2 uppercase">Nom du client</label>
              <input 
                type="text" 
                required 
                placeholder="ex: Wayne Enterprises"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-850 focus:border-brand-500 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 font-bold mb-2 uppercase">Adresse e-mail client</label>
              <input 
                type="email" 
                required 
                placeholder="ex: accounts@wayne.corp"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-850 focus:border-brand-500 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 font-bold mb-2 uppercase">Date d'échéance</label>
              <input 
                type="date" 
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-850 focus:border-brand-500 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Lignes d'articles facturés */}
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Lignes de Prestation / Produits</h4>
              <button 
                type="button"
                onClick={handleAddItem}
                className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
              </button>
            </div>

            {items.map((item, idx) => (
              <div key={item.id} className="grid grid-cols-12 gap-4 items-center animate-fade-in">
                <div className="col-span-6">
                  <input 
                    type="text" 
                    placeholder="Description de la prestation..." 
                    required
                    value={item.description}
                    onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                    className="w-full bg-slate-900/40 border border-slate-850 focus:border-brand-500 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none transition-colors"
                  />
                </div>
                <div className="col-span-1.5">
                  <input 
                    type="number" 
                    placeholder="Qté" 
                    required
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-900/40 border border-slate-850 focus:border-brand-500 rounded-xl px-3 py-2 text-slate-200 text-xs text-center focus:outline-none transition-colors"
                  />
                </div>
                <div className="col-span-2">
                  <input 
                    type="number" 
                    placeholder="P.U. HT (DT)" 
                    required
                    step="0.001"
                    value={item.unitPrice}
                    onChange={(e) => handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900/40 border border-slate-850 focus:border-brand-500 rounded-xl px-3 py-2 text-slate-200 text-xs text-right focus:outline-none transition-colors"
                  />
                </div>
                <div className="col-span-1.5">
                  <select
                    value={item.vatRate}
                    onChange={(e) => handleItemChange(item.id, 'vatRate', parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900/40 border border-slate-850 focus:border-brand-500 rounded-xl px-3 py-2 text-slate-300 text-xs focus:outline-none transition-colors"
                  >
                    <option value="19">TVA 19%</option>
                    <option value="13">TVA 13%</option>
                    <option value="7">TVA 7%</option>
                    <option value="0">TVA 0%</option>
                  </select>
                </div>
                <div className="col-span-1 flex items-center justify-end">
                  <button 
                    type="button" 
                    onClick={() => handleRemoveItem(item.id)}
                    className="text-danger-400 hover:text-danger-500 p-1.5 rounded-lg hover:bg-danger-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Totaux & Action */}
          <div className="flex flex-col md:flex-row justify-between items-end border-t border-slate-800 pt-6 gap-6">
            <div className="space-y-2 max-w-sm text-xs text-slate-400">
              <p>📌 Votre profil entreprise est utilisé pour formater l'émetteur légal de ce document.</p>
              <p>⚡ Un QR Code EPC de virement instantané sera intégré automatiquement au bas du document.</p>
            </div>
            
            <div className="w-80 space-y-3 bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Sous-total HT :</span>
                <span className="font-semibold text-slate-200">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Total TVA :</span>
                <span className="font-semibold text-slate-200">{formatCurrency(vatAmount)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Timbre Fiscal :</span>
                <span className="font-semibold text-slate-200">{formatCurrency(1.000)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-100 border-t border-slate-800 pt-2">
                <span>Total TTC :</span>
                <span className="text-indigo-400">{formatCurrency(totalAmount)}</span>
              </div>
              <button 
                type="submit" 
                className="w-full mt-3 py-2.5 bg-gradient-brand text-white font-bold rounded-xl text-xs shadow-glow hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> Finaliser & Enregistrer
              </button>
            </div>
          </div>
        </form>
      ) : (
        /* FILTER BAR */
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Filter className="w-4 h-4 text-slate-400" />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500">
              <option value="all">Tous statuts</option>
              <option value="PAID">Payées</option>
              <option value="SENT">Envoyées</option>
              <option value="OVERDUE">En retard</option>
            </select>
            <input type="text" placeholder="Rechercher un client..." value={filterClient} onChange={e => setFilterClient(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 w-48 focus:outline-none focus:border-brand-500" />
            <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500" />
            <span className="text-[10px] text-slate-500">→</span>
            <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500" />
            {(filterStatus !== 'all' || filterClient || filterDateFrom || filterDateTo) && (
              <button onClick={() => { setFilterStatus('all'); setFilterClient(''); setFilterDateFrom(''); setFilterDateTo(''); }}
                className="text-[10px] text-brand-400 hover:text-white transition-colors">Effacer</button>
            )}
          </div>
          <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden shadow-card">
            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                  <th className="py-4 px-6">Numéro</th>
                  <th className="py-4 px-6">Client</th>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Échéance</th>
                  <th className="py-4 px-6 text-right">Total TTC</th>
                  <th className="py-4 px-6 text-center">Statut</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-xs">
                {filteredInvoices.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-slate-500">Aucune facture trouvée</td></tr>
                ) : (
                  filteredInvoices.map((inv, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/10 transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-slate-300">{inv.invoiceNumber}</td>
                      <td className="py-4 px-6">
                        <button onClick={() => setSelectedClient(inv.clientName)}
                          className="font-bold text-white hover:text-brand-400 transition-colors text-left">{inv.clientName}</button>
                        <span className="text-[10px] text-slate-400 block">{inv.clientEmail}</span>
                      </td>
                      <td className="py-4 px-6 text-slate-400">{inv.issueDate}</td>
                      <td className="py-4 px-6 text-slate-400">{inv.dueDate}</td>
                      <td className="py-4 px-6 text-right font-extrabold text-white">{formatCurrency(inv.totalAmount)}</td>
                      <td className="py-4 px-6 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          inv.status === 'PAID' ? 'bg-accent-500/10 text-accent-400 border border-accent-500/10' :
                          inv.status === 'SENT' ? 'bg-warning-500/10 text-warning-400 border border-warning-500/10' :
                          'bg-danger-500/10 text-danger-400 border border-danger-500/10'
                        }`}>
                          {inv.status === 'PAID' ? 'Payée' : inv.status === 'SENT' ? 'Envoyée' : 'Retard'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-1.5">
                          {inv.status !== 'PAID' && (
                            <button onClick={() => setInvoices(invoices.map(x => x.id === inv.id ? {...x, status: 'PAID'} : x))}
                              className="p-2 bg-slate-800 hover:bg-accent-500/20 text-accent-400 rounded-xl border border-slate-700/50" title="Marquer payée">
                              <CheckCheck className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {inv.status === 'PAID' && (
                            <button onClick={() => setInvoices(invoices.map(x => x.id === inv.id ? {...x, status: 'SENT'} : x))}
                              className="p-2 bg-slate-800 hover:bg-warning-500/20 text-warning-400 rounded-xl border border-slate-700/50" title="Marquer envoyée">
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => handleDownloadPDF(inv)}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-xl border border-slate-700/50" title="PDF">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => { if (window.confirm(`Supprimer la facture ${inv.invoiceNumber} ?`)) setInvoices(invoices.filter(x => x.id !== inv.id)); }}
                            className="p-2 bg-slate-800 hover:bg-danger-500/20 text-danger-400 rounded-xl border border-slate-700/50" title="Supprimer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* Répertoire Client Modal */}
      {selectedClient && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-900 border border-slate-800 rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800/50 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-lg text-white">Répertoire Client</h3>
                <p className="text-xs text-slate-400">{selectedClient}</p>
              </div>
              <button onClick={() => setSelectedClient(null)} className="text-slate-500 hover:text-white p-2">✕</button>
            </div>
            <div className="p-6 space-y-3 text-xs text-slate-300 overflow-y-auto">
              {invoices.filter(inv => inv.clientName === selectedClient).map(inv => (
                <div key={inv.id} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-white">{inv.invoiceNumber}</p>
                    <p className="text-[10px] text-slate-400">{inv.issueDate} → {formatCurrency(inv.totalAmount)}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    inv.status === 'PAID' ? 'text-accent-400' : inv.status === 'SENT' ? 'text-warning-400' : 'text-danger-400'
                  }`}>{inv.status === 'PAID' ? 'Payée' : inv.status === 'SENT' ? 'Envoyée' : 'Retard'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI Invoice Generation Modal */}
      {aiModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-900 border border-slate-800 rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800/50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-white">Génération IA</h3>
                  <p className="text-xs text-brand-400 font-medium">Facture de vente tunisienne</p>
                </div>
              </div>
              <button onClick={() => { setAiModalOpen(false); setAiError(''); }} className="text-slate-500 hover:text-white p-2">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs text-slate-400 font-bold mb-2">Décrivez la facture à générer</label>
                <textarea
                  placeholder="Ex: Facture pour ACME Corp SARL pour prestation de consulting en comptabilité, montant 5 000 DT, TVA 19%"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-brand-500 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none resize-none transition-colors"
                />
                <p className="text-[10px] text-slate-500 mt-1.5">Précisez le client, la prestation, le montant. L'IA générera une facture conforme.</p>
              </div>
              {aiError && (
                <div className="p-3 bg-danger-500/10 border border-danger-500/30 rounded-xl text-xs text-danger-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {aiError}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => { setAiModalOpen(false); setAiError(''); }}
                  className="flex-1 py-2.5 border border-slate-700 hover:bg-slate-800/40 text-slate-400 text-xs font-bold rounded-xl transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={handleGenerateAI}
                  disabled={aiLoading || !aiPrompt.trim()}
                  className="flex-[2] py-2.5 bg-gradient-brand hover:opacity-90 text-white text-xs font-bold rounded-xl shadow-glow transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {aiLoading ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Génération en cours...</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> Générer la facture</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   COMPONENT: OCR VIEW (NUMÉRISATION + SAISIE MANUELLE)
   ========================================================================== */
function OcrView({ expenses, onAddExpense, formatCurrency, companyDetails, setInvoices }) {
  const [mode, setMode] = useState('choice');
  const [activeSample, setActiveSample] = useState(null);
  const [isAiScan, setIsAiScan] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrError, setOcrError] = useState('');

  const BLANK_FORM = {
    supplier: '',
    matriculeFiscal: '',
    date: new Date().toISOString().split('T')[0],
    subtotal: '',
    vatRate: '19',
    fodec: '0.000',
    vatAmount: '',
    stampDuty: '1.000',
    totalAmount: '',
    category: 'Autres',
    invoiceNumber: '',
    rsAmount: '',
    clientEmail: '',
    clientAddress: '',
  };
  const [formData, setFormData] = useState(BLANK_FORM);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showRsField, setShowRsField] = useState(false);
  const [rsRate, setRsRate] = useState('1.5');
  const [mfValid, setMfValid] = useState(null);
  const [purchaseInput, setPurchaseInput] = useState('');
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseError, setPurchaseError] = useState('');
  const [typeJustificatif, setTypeJustificatif] = useState('achat');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');

  const CATEGORIES = [
    'Télécoms & Internet', 'Énergie & Utilités', 'Fournitures de Bureau',
    'Déplacements', 'Restauration', 'Loyer & Charges', 'Salaires & Charges Sociales', 'Autres',
  ];

  const CATEGORIES_VENTE = [
    'Prestations de services', 'Ventes de marchandises', 'Produits financiers',
    'Produits divers', 'Location & Revenus immobiliers', 'Autres produits',
  ];

  const applyFormData = (data) => {
    setFormData({
      supplier: data.supplier || '',
      matriculeFiscal: data.matriculeFiscal || '',
      date: data.date || new Date().toISOString().split('T')[0],
      subtotal: String(data.subtotal || ''),
      vatRate: String(data.vatRate || '19'),
      fodec: String(data.fodec || '0.000'),
      vatAmount: String(data.vatAmount || ''),
      stampDuty: String(data.stampDuty || '1.000'),
      totalAmount: String(data.totalAmount || ''),
      category: data.category || 'Autres',
      invoiceNumber: data.invoiceNumber || '',
    });
  };

  const getStampDutyForAmount = (amountBeforeStamp) => {
    if (amountBeforeStamp < 50.000) return 1.000;
    if (amountBeforeStamp <= 100.000) return 1.500;
    return 2.000;
  };

  const getStampDutyForTotal = (total) => {
    if (total < 51.000) return 1.000;
    if (total <= 101.500) return 1.500;
    return 2.000;
  };

  // Auto-calcul depuis le Total TTC
  const handleTotalChange = (val) => {
    const total = parseFloat(val) || 0;
    const stamp = getStampDutyForTotal(total);
    const fodecVal = parseFloat(formData.fodec) || 0;
    const vatRate = parseFloat(formData.vatRate) || 19;
    
    const baseTva = (total - stamp) / (1 + vatRate / 100);
    const sub = baseTva - fodecVal;
    const vat = baseTva * (vatRate / 100);

    setFormData(f => ({
      ...f,
      totalAmount: val,
      stampDuty: total > 0 ? stamp.toFixed(3) : '1.000',
      subtotal: total > 0 ? (Math.round(sub * 1000) / 1000).toFixed(3) : '',
      vatAmount: total > 0 ? (Math.round(vat * 1000) / 1000).toFixed(3) : '',
    }));
  };

  // Auto-calcul depuis le Sous-total HT
  const handleSubtotalChange = (val) => {
    const sub = parseFloat(val) || 0;
    const fodecVal = parseFloat(formData.fodec) || 0;
    const vatRate = parseFloat(formData.vatRate) || 19;
    const baseTva = sub + fodecVal;
    const vat = baseTva * (vatRate / 100);
    const amountBeforeStamp = baseTva + vat;
    const stamp = getStampDutyForAmount(amountBeforeStamp);
    const total = amountBeforeStamp + stamp;

    setFormData(f => ({
      ...f,
      subtotal: val,
      stampDuty: sub > 0 ? stamp.toFixed(3) : '1.000',
      vatAmount: sub > 0 ? (Math.round(vat * 1000) / 1000).toFixed(3) : '',
      totalAmount: sub > 0 ? (Math.round(total * 1000) / 1000).toFixed(3) : '',
    }));
  };

  // Auto-calcul depuis le FODEC
  const handleFodecChange = (val) => {
    const fodecVal = parseFloat(val) || 0;
    const sub = parseFloat(formData.subtotal) || 0;
    const vatRate = parseFloat(formData.vatRate) || 19;
    const baseTva = sub + fodecVal;
    const vat = baseTva * (vatRate / 100);
    const amountBeforeStamp = baseTva + vat;
    const stamp = getStampDutyForAmount(amountBeforeStamp);
    const total = amountBeforeStamp + stamp;

    setFormData(f => ({
      ...f,
      fodec: val,
      stampDuty: sub > 0 ? stamp.toFixed(3) : '1.000',
      vatAmount: sub > 0 ? (Math.round(vat * 1000) / 1000).toFixed(3) : '',
      totalAmount: sub > 0 ? (Math.round(total * 1000) / 1000).toFixed(3) : '',
    }));
  };

  const EXEMPLES_TEST = [
    { name: 'STE BONJOUR — Facture avec timbre 0,600 (pré-LF2023)', data: { fournisseur: 'STE BONJOUR', date: '2023-03-15', numero_facture: 'FA20BJ001', montant_ht: 884.425, fodec: 0, base_tva: 884.425, taux_tva: 13, montant_tva: 114.975, timbre_fiscal: 0.600, retenue_source: 0, montant_ttc: 1000.000, net_a_payer: 1000.000, categorie_sce: null, code_comptable: null, devise: 'DT', flag_incoherence: false, champs_manquants: [], confidence: 100 } },
    { name: 'Ooredoo — Facture Télécom (19%)', data: { fournisseur: 'Ooredoo Tunisie', date: '2026-05-15', numero_facture: 'FAC-2026-04521', montant_ht: 132.800, fodec: 0, base_tva: 132.800, taux_tva: 19, montant_tva: 25.232, timbre_fiscal: 1.000, retenue_source: 0, montant_ttc: 159.032, net_a_payer: 159.032, categorie_sce: 'frais_telecommunication', code_comptable: '6248', devise: 'DT', flag_incoherence: false, champs_manquants: [], confidence: 95 } },
    { name: 'STEG — Facture Électricité (13%, exonéré timbre)', data: { fournisseur: 'STEG', date: '2026-04-28', numero_facture: 'FACT-2026-00312', montant_ht: 85.500, fodec: 0, base_tva: 85.500, taux_tva: 13, montant_tva: 11.115, timbre_fiscal: 0, retenue_source: 0, montant_ttc: 96.615, net_a_payer: 96.615, categorie_sce: 'frais_energie', code_comptable: '6042', devise: 'DT', flag_incoherence: false, champs_manquants: [], confidence: 95 } },
    { name: 'Monoprix — Fournitures Bureau (19%)', data: { fournisseur: 'Monoprix Tunisie', date: '2026-05-10', numero_facture: 'TKT-2026-7812', montant_ht: 45.200, fodec: 0, base_tva: 45.200, taux_tva: 19, montant_tva: 8.588, timbre_fiscal: 1.000, retenue_source: 0, montant_ttc: 54.788, net_a_payer: 54.788, categorie_sce: 'fournitures_bureau', code_comptable: '6024', devise: 'DT', flag_incoherence: false, champs_manquants: [], confidence: 95 } },
  ];

  function ocrToFormData(r) {
    return {
      supplier: r.fournisseur || '',
      matriculeFiscal: r.matricule_fiscal || '',
      date: r.date || new Date().toISOString().split('T')[0],
      subtotal: r.montant_ht != null ? String(r.montant_ht) : '',
      vatRate: String(r.taux_tva || '19'),
      fodec: r.fodec != null ? String(r.fodec) : '0.000',
      vatAmount: r.montant_tva != null ? String(r.montant_tva) : '',
      stampDuty: r.timbre_fiscal != null ? String(r.timbre_fiscal) : '1.000',
      totalAmount: r.montant_ttc != null ? String(r.montant_ttc) : '',
      category: r.categorie_sce || 'Autres',
      invoiceNumber: r.numero_facture || '',
    };
  }

  const handleStartScan = (sample) => {
    setActiveSample(sample);
    setIsAiScan(false);
    setOcrProgress(0);
    setMode('scanning');
    setTimeout(() => {
      applyFormData(ocrToFormData(sample.data));
      setMode('result');
    }, 1800);
  };

  const handleFileScan = async (file) => {
    setOcrProgress(0);
    setOcrError('');
    setIsAiScan(true);
    setMode('scanning');

    try {
      let imageData = file;

      if (file?.type === 'application/pdf') {
        setOcrProgress(10);

        if (!window.pdfjsLib) {
          throw new Error('pdf.js non chargé — rafraîchissez la page');
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdfDoc.getPage(1);

        const viewport = page.getViewport({ scale: 2.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: canvas.getContext('2d'),
          viewport
        }).promise;

        const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
        imageData = new File([blob], 'page1.png', { type: 'image/png' });
        setOcrProgress(25);
      }

      const result = await scanFacture(imageData, (pct) => {
        setOcrProgress(25 + Math.round(pct * 0.75));
      });

      if (result?.error) {
        setOcrError(result.error);
        setIsAiScan(false);
        setMode('choice');
        return;
      }

      applyFormData(ocrToFormData(result));
      setOcrProgress(100);
      setMode('result');

    } catch (err) {
      setOcrError(`Erreur: ${err.message}`);
      setIsAiScan(false);
    }
  };

  // Enregistrer la dépense
  const handleConfirmExpense = (e) => {
    e.preventDefault();
    onAddExpense({
      id: `exp-${Date.now()}`,
      supplier: formData.supplier || 'Fournisseur',
      matriculeFiscal: formData.matriculeFiscal || '',
      date: formData.date,
      subtotal: parseFloat(formData.subtotal) || 0,
      fodec: parseFloat(formData.fodec) || 0,
      vatAmount: parseFloat(formData.vatAmount) || 0,
      stampDuty: parseFloat(formData.stampDuty) || 1,
      totalAmount: parseFloat(formData.totalAmount) || 0,
      rsAmount: parseFloat(formData.rsAmount) || 0,
      category: formData.category,
      invoiceNumber: formData.invoiceNumber,
      status: "VALIDATED"
    });
    setMode('success');
    setFormData(BLANK_FORM);
    setActiveSample(null);
  };

  const handleLancerTraitement = () => {
    if (!purchaseInput.trim()) return;
    setPurchaseLoading(true);
    setPurchaseError('');

    try {
      const parsed = parseTexteFacture(purchaseInput);
      const validated = validerCalculs(parsed);
      const f = validated.categorie_sce && CATEGORIES_SCE[validated.categorie_sce]
        ? CATEGORIES_SCE[validated.categorie_sce].label
        : 'Autres';

      applyFormData({
        supplier: validated.fournisseur || '',
        matriculeFiscal: validated.matricule_fiscal || '',
        date: validated.date || new Date().toISOString().split('T')[0],
        subtotal: validated.montant_ht != null ? String(validated.montant_ht) : '',
        vatRate: String(validated.taux_tva || '19'),
        fodec: validated.fodec != null ? String(validated.fodec) : '0.000',
        vatAmount: validated.montant_tva != null ? String(validated.montant_tva) : '',
        stampDuty: validated.timbre_fiscal != null ? String(validated.timbre_fiscal) : '1.000',
        totalAmount: validated.montant_ttc != null ? String(validated.montant_ttc) : '',
        category: f,
        invoiceNumber: validated.numero_facture || '',
      });

      if (validated.flag_incoherence) {
        setPurchaseError('⚠️ Incohérence détectée dans les montants — vérifiez manuellement');
      }

      setPurchaseLoading(false);
      setIsAiScan(true);
      setMode('result');
    } catch (err) {
      setPurchaseError('Erreur de parsing — vérifiez le format du texte');
      setPurchaseLoading(false);
    }
  };

   // Formulaire partagé (saisie manuelle + résultat scan)
  const renderEntryForm = (isManual) => {
    const sub = parseFloat(formData.subtotal) || 0;
    const rate = parseFloat(formData.vatRate) || 19;
    const fodecVal = parseFloat(formData.fodec) || 0;
    const stamp = parseFloat(formData.stampDuty) || 1;
    const rsVal = parseFloat(formData.rsAmount) || 0;
    const baseCalc = sub + fodecVal;
    const tvaCalc = baseCalc > 0 ? parseFloat((baseCalc * rate / 100).toFixed(3)) : 0;
    const ttcCalc = baseCalc > 0 ? parseFloat((baseCalc + tvaCalc + stamp).toFixed(3)) : 0;
    const netCalc = ttcCalc > 0 ? parseFloat((ttcCalc - rsVal).toFixed(3)) : 0;

    const isAchat = typeJustificatif === 'achat';
    const isVente = typeJustificatif === 'vente';

    const fournisseurInput = formData.supplier || '';
    const lowerInput = fournisseurInput.toLowerCase();
    const suggestions = fournisseurInput.length >= 2
      ? Object.entries(FOURNISSEURS_TN)
          .filter(([key]) => key.includes(lowerInput) || lowerInput.includes(key))
          .slice(0, 6)
      : [];

    const mfValue = formData.matriculeFiscal || '';
    const mfPattern = /^\d{7}\/[A-Z]\/[AB]\/[MNPE]\/\d{3}$/;
    const mfBorder = mfValue.length > 0
      ? (mfPattern.test(mfValue) ? 'border-green-500/60' : 'border-danger-500/60')
      : 'border-slate-700';

    const requiredMissing = [];
    if (!formData.supplier) requiredMissing.push(isAchat ? 'Fournisseur' : 'Client');
    if (!formData.date) requiredMissing.push('Date');
    if (!formData.subtotal && !formData.totalAmount) requiredMissing.push('Sous-total HT ou Total TTC');

    const resetForm = () => {
      setFormData(BLANK_FORM);
      setShowRsField(false);
      setRsRate('1.5');
      setMfValid(null);
      setClientEmail('');
      setClientAddress('');
    };

    const handleSubmit = (e) => {
      e.preventDefault();
      if (requiredMissing.length > 0) return;

      if (isAchat) {
        onAddExpense({
          id: `exp-${Date.now()}`,
          supplier: formData.supplier || 'Fournisseur',
          matriculeFiscal: formData.matriculeFiscal || '',
          date: formData.date,
          subtotal: parseFloat(formData.subtotal) || 0,
          fodec: parseFloat(formData.fodec) || 0,
          vatAmount: parseFloat(formData.vatAmount) || 0,
          stampDuty: parseFloat(formData.stampDuty) || 1,
          totalAmount: parseFloat(formData.totalAmount) || 0,
          rsAmount: parseFloat(formData.rsAmount) || 0,
          category: formData.category,
          invoiceNumber: formData.invoiceNumber,
          status: "VALIDATED"
        });
      } else {
        const invCount = typeof setInvoices === 'function' ? 0 : 0;
        const newInvoice = {
          id: `inv-${Date.now()}`,
          invoiceNumber: formData.invoiceNumber || `FACT-2026-${String((document.querySelectorAll('#invoices-list li')?.length || 0) + 1).padStart(3, '0')}`,
          clientName: formData.supplier,
          clientEmail: formData.clientEmail || clientEmail,
          issueDate: formData.date,
          dueDate: formData.date ? new Date(new Date(formData.date).getTime() + 30*86400000).toISOString().split('T')[0] : '',
          subtotal: parseFloat(formData.subtotal) || 0,
          vatAmount: parseFloat(formData.vatAmount) || 0,
          totalAmount: parseFloat(formData.totalAmount) || 0,
          status: "SENT",
          items: [{ id: Date.now(), description: formData.category || 'Prestation', quantity: 1, unitPrice: parseFloat(formData.subtotal) || 0, vatRate: parseFloat(formData.vatRate) || 19 }]
        };
        if (typeof setInvoices === 'function') {
          setInvoices(prev => [newInvoice, ...prev]);
        }
      }

      setMode('success');
      resetForm();
      setActiveSample(null);
    };

    return (
    <form onSubmit={handleSubmit} className="space-y-4 animate-slide-up flex-1 overflow-y-auto">
      <div className="flex justify-between items-center border-b border-slate-800 pb-3">
        <h4 className={`text-sm font-extrabold flex items-center gap-1.5 ${isManual ? 'text-brand-400' : isAiScan ? 'text-accent-400' : 'text-warning-400'}`}>
          {isManual
            ? <><Plus className="w-4 h-4" /> Saisie Manuelle du Justificatif</>
            : isAiScan
              ? <><Scan className="w-4 h-4" /> OCR Local — Vérifiez et corrigez</>
              : <><AlertCircle className="w-4 h-4" /> Données simulées — Corrigez avant d'enregistrer</>
          }
        </h4>
        <button type="button" onClick={() => { setMode('choice'); resetForm(); }}
          className="text-[10px] text-slate-500 hover:text-slate-300 underline">✕ Annuler</button>
      </div>

      {!isManual && !isAiScan && (
        <div className="p-3 bg-warning-500/10 border border-warning-500/30 rounded-xl text-[10px] text-warning-400 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            <strong>Ces données sont fictives</strong> — extraites d'un exemple de test.
            Corrigez tous les champs ci-dessous avant d'enregistrer.
          </span>
        </div>
      )}

      {/* Toggle Type de Justificatif */}
      <div className="flex gap-2">
        <button type="button" onClick={() => { setTypeJustificatif('achat'); resetForm(); }}
          className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all
            ${isAchat ? 'bg-violet-600 text-white border border-violet-400 shadow-lg shadow-violet-600/20' : 'bg-slate-800 text-slate-400 border border-slate-600 hover:border-slate-500'}`}
        >
          <span className="text-base">🧾</span> Facture Achat
          <span className="text-[9px] opacity-70">Fournisseur</span>
        </button>
        <button type="button" onClick={() => { setTypeJustificatif('vente'); resetForm(); }}
          className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all
            ${isVente ? 'bg-emerald-600 text-white border border-emerald-400 shadow-lg shadow-emerald-600/20' : 'bg-slate-800 text-slate-400 border border-slate-600 hover:border-slate-500'}`}
        >
          <span className="text-base">📤</span> Facture Vente
          <span className="text-[9px] opacity-70">Client</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 relative">
          <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">{isAchat ? 'Fournisseur / Vendeur' : 'Client'} *</label>
          <input type="text" required placeholder={isAchat ? 'ex: Ooredoo Tunisie, STEG, Monoprix...' : 'ex: ABC Entreprise, SARL Tunisie...'}
            value={formData.supplier}
            onChange={(e) => {
              const val = e.target.value;
              setFormData(f => ({...f, supplier: val}));
              if (isAchat) {
                setShowSuggestions(val.length >= 2);
                if (val.length < 2) setShowSuggestions(false);
              }
            }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            onFocus={() => { if (isAchat && formData.supplier.length >= 2) setShowSuggestions(true); }}
            className="w-full bg-slate-900 border border-slate-700 focus:border-brand-500 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none transition-colors"
          />
          {isAchat && showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
              {suggestions.map(([key, info]) => (
                <button
                  key={key}
                  type="button"
                  className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-brand-500/20 hover:text-white transition-colors border-b border-slate-800 last:border-0"
                  onClick={() => {
                    const label = key.charAt(0).toUpperCase() + key.slice(1);
                    const cat = info.cat && CATEGORIES_SCE[info.cat] ? CATEGORIES_SCE[info.cat].label : 'Autres';
                    const stampVal = info.timbre === 0 ? '0.000' : '1.000';
                    setFormData(f => ({...f, supplier: label, vatRate: String(info.tva || '19'), category: cat, stampDuty: stampVal}));
                    setShowSuggestions(false);
                    if (info.rs > 0) { setShowRsField(true); setRsRate(String(info.rs)); }
                  }}
                >
                  <span className="font-semibold">{key}</span>
                  <span className="text-slate-500 ml-2">TVA {info.tva}% — {info.cat ? info.cat.replace(/_/g, ' ') : 'Autres'}</span>
                  {info.timbre === 0 && <span className="text-green-400 ml-2">Timbre 0 DT</span>}
                  {info.rs > 0 && <span className="text-orange-400 ml-2">RS {info.rs}%</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {isVente && (
          <div className="col-span-2 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">Email Client</label>
              <input type="email" placeholder="client@entreprise.com" value={formData.clientEmail || clientEmail}
                onChange={(e) => { setClientEmail(e.target.value); setFormData(f => ({...f, clientEmail: e.target.value})); }}
                className="w-full bg-slate-900 border border-slate-700 focus:border-brand-500 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">Adresse Client</label>
              <input type="text" placeholder="Avenue X, Tunis" value={formData.clientAddress || clientAddress}
                onChange={(e) => { setClientAddress(e.target.value); setFormData(f => ({...f, clientAddress: e.target.value})); }}
                className="w-full bg-slate-900 border border-slate-700 focus:border-brand-500 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none"
              />
            </div>
          </div>
        )}

        <div className="col-span-2">
          <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">{isAchat ? 'Matricule Fiscal Fournisseur' : 'Matricule Fiscal Client'}</label>
          <input type="text" placeholder="ex: 1234567/X/A/M/000" value={mfValue}
            onChange={(e) => {
              const v = e.target.value;
              setFormData(f => ({...f, matriculeFiscal: v}));
              setMfValid(v.length > 0 ? mfPattern.test(v) : null);
            }}
            className={`w-full bg-slate-900 border ${mfBorder} focus:border-brand-500 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none transition-colors`}
          />
          {mfValid === false && (
            <p className="text-[10px] text-danger-400 mt-1">Format attendu: 1234567/X/A/M/000</p>
          )}
          {mfValid === true && (
            <p className="text-[10px] text-green-400 mt-1">Format valide ✓</p>
          )}
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">{isAchat ? 'Date du Reçu' : isVente ? "Date d'émission" : 'Date'} *</label>
          <input type="date" required value={formData.date}
            onChange={(e) => setFormData(f => ({...f, date: e.target.value}))}
            className="w-full bg-slate-900 border border-slate-700 focus:border-brand-500 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">N° Justificatif</label>
          <input type="text" placeholder={isAchat ? 'ex: FAC-2026-0012' : 'ex: FACT-2026-001'} value={formData.invoiceNumber}
            onChange={(e) => setFormData(f => ({...f, invoiceNumber: e.target.value}))}
            className="w-full bg-slate-900 border border-slate-700 focus:border-brand-500 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none transition-colors"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">Catégorie Comptable *</label>
          <select required value={formData.category}
            onChange={(e) => setFormData(f => ({...f, category: e.target.value}))}
            className="w-full bg-slate-900 border border-slate-700 focus:border-brand-500 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none transition-colors"
          >
            {(isAchat ? CATEGORIES : CATEGORIES_VENTE).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Section Montants */}
      <div className={`p-4 rounded-xl border space-y-3 ${isAchat ? 'bg-slate-900/60 border-slate-700/60' : 'bg-emerald-900/20 border-emerald-700/40'}`}>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Détail des Montants (DT)</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">Taux TVA</label>
            <select value={formData.vatRate}
              onChange={(e) => {
                const r = parseFloat(e.target.value) || 19;
                const fodecVal = parseFloat(formData.fodec) || 0;
                const baseTva = sub + fodecVal;
                const vat = baseTva * (r / 100);
                const newStamp = getStampDutyForAmount(baseTva + vat);
                setFormData(f => ({...f, vatRate: e.target.value,
                  vatAmount: sub > 0 ? (Math.round(vat*1000)/1000).toFixed(3) : '',
                  stampDuty: sub > 0 ? newStamp.toFixed(3) : '1.000',
                  totalAmount: sub > 0 ? (Math.round((sub+fodecVal+vat+newStamp)*1000)/1000).toFixed(3) : ''
                }));
              }}
              className="w-full bg-slate-950 border border-slate-700 focus:border-brand-500 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none"
            >
              <option value="19">19%</option>
              <option value="13">13%</option>
              <option value="7">7%</option>
              <option value="0">0%</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase" title="Loi de finances 2023 : 1 DT forfaitaire">
              Timbre Fiscal ⓘ
            </label>
            <input type="number" step="0.001" min="0" readOnly value={formData.stampDuty}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-brand-300 text-sm cursor-not-allowed opacity-75"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">Sous-total HT *</label>
            <input type="number" step="0.001" min="0" required placeholder="0.000" value={formData.subtotal}
              onChange={(e) => handleSubtotalChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 focus:border-brand-500 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {isAchat && (
          <div>
            <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">FODEC (1%) (DT)</label>
            <input type="number" step="0.001" min="0" placeholder="0.000" value={formData.fodec}
              onChange={(e) => handleFodecChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 focus:border-brand-500 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none"
            />
          </div>
          )}
          <div className={isAchat ? '' : 'col-span-1'}>
            <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">Montant TVA</label>
            <input type="number" step="0.001" min="0" placeholder="Auto" value={formData.vatAmount}
              onChange={(e) => setFormData(f => ({...f, vatAmount: e.target.value}))}
              className="w-full bg-slate-950 border border-slate-650 focus:border-brand-500 rounded-xl px-3 py-2 text-slate-300 text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold mb-1 uppercase">{isAchat ? '✦ Total TTC *' : '✦ Total TTC Facture *'}</label>
            <input type={isAchat ? 'text' : 'number'} step="0.001" min="0" required placeholder={isAchat ? 'ex: 1 017,450' : '0.000'} value={formData.totalAmount}
              onChange={(e) => isAchat ? handleTotalChange(e.target.value) : setFormData(f => ({...f, totalAmount: e.target.value}))}
              className={`w-full bg-slate-950 border-2 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none ${isAchat ? 'border-warning-500/60 focus:border-warning-400 text-warning-300' : 'border-emerald-500/60 focus:border-emerald-400 text-emerald-300'}`}
            />
          </div>
        </div>

        {/* RS conditionnel (achat seulement) */}
        {isAchat && (
          <>
        <div className="flex items-center gap-3 pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showRsField}
              onChange={(e) => { setShowRsField(e.target.checked); if (!e.target.checked) { setFormData(f => ({...f, rsAmount: ''})); } }}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-[10px] text-slate-400 font-bold uppercase">Retenue à la source applicable</span>
          </label>
        </div>
        {showRsField && (
          <div className="grid grid-cols-3 gap-3 animate-fade-in">
            <div>
              <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">Taux RS</label>
              <select value={rsRate} onChange={(e) => setRsRate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 focus:border-brand-500 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none"
              >
                <option value="1.5">1,5% — Marchandises/services</option>
                <option value="3">3% — Personne morale</option>
                <option value="10">10% — Personne physique</option>
                <option value="0.5">0,5% — Non identifié</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">Montant RS (DT)</label>
              <input type="number" step="0.001" min="0" placeholder="0.000" value={formData.rsAmount || ''}
                onChange={(e) => setFormData(f => ({...f, rsAmount: e.target.value}))}
                className="w-full bg-slate-950 border border-orange-500/40 focus:border-orange-400 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none"
              />
            </div>
            <div className="flex items-end">
              <p className="text-[10px] text-orange-400 font-bold pb-2">Net à payer: {netCalc.toFixed(3)} DT</p>
            </div>
          </div>
        )}
        </>)}

        <p className="text-[9px] text-slate-500 mt-1">Saisissez le Total TTC ou le Sous-total HT pour mettre à jour les calculs.</p>
      </div>

      {/* Résumé visuel */}
      {(sub > 0 || parseFloat(formData.totalAmount) > 0) && (
        <div className={`p-4 rounded-xl border space-y-1.5 ${isAchat ? 'bg-slate-900/80 border-slate-700/50' : 'bg-emerald-900/20 border-emerald-700/30'}`}>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-400">HT</span>
            <span className="text-slate-200 font-mono">{sub.toFixed(3)} DT</span>
          </div>
          {fodecVal > 0 && isAchat && (
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">FODEC</span>
              <span className="text-slate-200 font-mono">{fodecVal.toFixed(3)} DT</span>
            </div>
          )}
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-400">TVA ({rate}%)</span>
            <span className="text-slate-200 font-mono">{(sub > 0 ? tvaCalc : 0).toFixed(3)} DT</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-400">Timbre fiscal</span>
            <span className="text-slate-200 font-mono">{stamp.toFixed(3)} DT</span>
          </div>
          {rsVal > 0 && isAchat && (
            <div className="flex justify-between text-[11px]">
            <span className="text-orange-400">Retenue source ({rsRate}%)</span>
            <span className="text-orange-400 font-mono">− {rsVal.toFixed(3)} DT</span>
          </div>
          )}
          <div className={`border-t pt-1.5 mt-1.5 flex justify-between text-xs font-bold ${isAchat ? 'border-slate-700' : 'border-emerald-700/50'}`}>
            <span className={isAchat ? 'text-warning-400' : 'text-emerald-400'}>TTC</span>
            <span className={isAchat ? 'text-warning-400 font-mono' : 'text-emerald-400 font-mono'}>{(sub > 0 ? ttcCalc : parseFloat(formData.totalAmount) || 0).toFixed(3)} DT</span>
          </div>
          {rsVal > 0 && isAchat && (
            <div className="flex justify-between text-xs font-bold">
              <span className="text-accent-400">Net à payer</span>
              <span className="text-accent-400 font-mono">{netCalc.toFixed(3)} DT</span>
            </div>
          )}
        </div>
      )}

      {/* Validation errors */}
      {requiredMissing.length > 0 && (
        <div className="p-2.5 bg-danger-500/10 border border-danger-500/30 rounded-xl text-[10px] text-danger-400 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          Champs obligatoires manquants : {requiredMissing.join(', ')}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={() => { setMode('choice'); resetForm(); }}
          className="flex-1 py-2.5 border border-slate-700 hover:bg-slate-800/40 text-slate-400 text-xs font-bold rounded-xl transition-all">
          Annuler
        </button>
        <button type="submit" disabled={requiredMissing.length > 0}
          className={`flex-[2] py-2.5 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-glow transition-all flex items-center justify-center gap-1.5 ${isAchat ? 'bg-gradient-brand hover:opacity-90' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
          <CheckCircle2 className="w-4 h-4" /> {isAchat ? 'Enregistrer la dépense' : 'Enregistrer la vente'}
        </button>
      </div>
    </form>
  );};

  return (
    <div className="space-y-6">
      {/* Bannière OCR local */}
      <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Scan className="w-4 h-4 text-indigo-400 shrink-0" />
          <p className="text-xs text-slate-300">
            <strong className="text-indigo-400">OCR Local actif.</strong>{' '}
            Tesseract.js lit vos factures directement dans le navigateur —{' '}
            <strong>zéro API, zéro clé, 100% privé</strong>.
          </p>
        </div>
        <span className="text-[10px] font-bold text-indigo-400 border border-indigo-500/30 px-2 py-1 rounded-lg shrink-0 bg-indigo-500/10 whitespace-nowrap">
          Tesseract.js
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Panel gauche */}
        <div className="glass-card p-6 rounded-2xl border border-slate-800 lg:col-span-5 space-y-4">

          {/* Saisie Manuelle - Option principale */}
          <button
            onClick={() => { setFormData(BLANK_FORM); setMode('manual'); }}
            className="w-full flex items-center gap-4 p-4 bg-brand-500/10 border-2 border-brand-500/40 hover:border-brand-500 rounded-2xl transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Plus className="w-5 h-5 text-brand-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-slate-100">Saisie Manuelle</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Entrez les données directement — Toujours disponible</p>
            </div>
          </button>

          {/* Scanner un fichier */}
          <label className="w-full flex items-center gap-4 p-4 border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-2xl transition-all group cursor-pointer relative">
            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={(e) => e.target.files[0] && handleFileScan(e.target.files[0])}
            />
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Upload className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-slate-100">
                Scanner un fichier
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, PDF — max 10 Mo — OCR Local Tesseract</p>
            </div>
          </label>

          {/* Traitement Facture d'Achat */}
          <button
            onClick={() => setMode('purchase')}
            className="w-full flex items-center gap-4 p-4 border-2 border-indigo-500/30 hover:border-indigo-500/60 rounded-2xl transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <FileText className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-slate-100">Facture d'Achat Fournisseur</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Extraction → Vérifications → RS → Écriture SCE</p>
            </div>
          </button>

          {/* Exemples de test */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Exemples de test Tesseract</span>
            <div className="grid grid-cols-1 gap-2">
              {EXEMPLES_TEST.map((sample, idx) => (
                <button
                  key={idx}
                  onClick={() => handleStartScan(sample)}
                  disabled={mode === 'scanning'}
                  className={`flex items-center justify-between p-3 border rounded-xl transition-all text-xs text-left ${
                    activeSample?.name === sample.name ? 'border-brand-500 bg-brand-500/5' : 'border-slate-800/60 bg-slate-900/30 hover:bg-slate-800/30'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full bg-indigo-400" />
                    <span className="font-semibold text-slate-300">{sample.name}</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Panel droit */}
        <div className="glass-card p-4 sm:p-6 rounded-2xl border border-slate-800 lg:col-span-7 flex flex-col justify-between min-h-[300px] lg:min-h-[520px] relative overflow-hidden">
          {mode === 'scanning' && (
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-500 to-transparent animate-[shimmer_1.5s_infinite] shadow-glow" />
          )}

          {mode === 'scanning' ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4 py-12 animate-pulse-soft">
              <div className="w-14 h-14 rounded-full bg-brand-500/10 border border-brand-500/30 flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-brand-400 animate-spin" />
              </div>
              <div className="text-center space-y-1">
                <h4 className="text-sm font-bold text-slate-200">
                  Analyse OCR Tesseract...
                </h4>
                <p className="text-[11px] text-indigo-400">
                  {ocrProgress > 0
                    ? `Tesseract analyse le document — ${ocrProgress}%`
                    : 'Initialisation du moteur OCR...'}
                </p>
              </div>
              {ocrProgress > 0 && (
                <div className="w-64 bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                  <div
                    className="h-full bg-gradient-to-r from-brand-500 to-indigo-500 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${ocrProgress}%` }}
                  />
                </div>
              )}
              {ocrError && (
                <p className="text-[10px] text-warning-400 text-center max-w-xs">{ocrError}</p>
              )}
            </div>
          ) : mode === 'success' ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3 py-12 text-center animate-fade-in">
              <div className="w-14 h-14 rounded-full bg-accent-500/10 border border-accent-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-accent-400" />
              </div>
              <h4 className="text-sm font-bold text-slate-200">Dépense enregistrée !</h4>
              <p className="text-[11px] text-slate-400 max-w-sm">Le justificatif a été comptabilisé et vos indicateurs financiers ont été mis à jour.</p>
              <div className="flex gap-3 mt-4">
                <button onClick={() => { setFormData(BLANK_FORM); setMode('manual'); }}
                  className="px-4 py-2 bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 text-xs font-bold rounded-xl border border-brand-500/30">
                  + Nouvelle saisie
                </button>
                <button onClick={() => setMode('choice')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl">
                  Retour
                </button>
              </div>
            </div>
          ) : mode === 'manual' ? (
            renderEntryForm(true)
          ) : mode === 'result' ? (
            renderEntryForm(false)
          ) : mode === 'purchase' ? (
            <div className="flex-1 flex flex-col space-y-4 overflow-y-auto">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h4 className="text-sm font-extrabold flex items-center gap-1.5 text-purple-400">
                  <FileText className="w-4 h-4" /> Traitement Facture d'Achat
                </h4>
                <button type="button" onClick={() => setMode('choice')}
                  className="text-[10px] text-slate-500 hover:text-slate-300 underline">✕ Annuler</button>
              </div>
              <div className="space-y-3 flex-1 flex flex-col">
                <div>
                  <label className="block text-[10px] text-slate-500 font-bold mb-1.5 uppercase">
                    Collez ou décrivez la facture fournisseur
                  </label>
                  <textarea
                    placeholder='Ex: Facture d&#39;achat N° FAC-2026-0421 du 15/05/2026
Fournisseur : Société Tunisienne de Fournitures S.A.
MF : 1234567/X/A/000
Désignation : Cartouches d&#39;encre HP LaserJet — Qté : 10 — PU : 85.500 DT — TVA 19%
Total HT : 855.000 DT — TVA : 162.450 DT — TTC : 1 017.450 DT
Règlement : Virement à 60 jours'
                    value={purchaseInput}
                    onChange={(e) => setPurchaseInput(e.target.value)}
                    rows={8}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-xl px-4 py-3 text-slate-100 text-xs focus:outline-none resize-none transition-colors font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1.5">Le parsing local extrait fournisseur, MF, articles, montants et remplit le formulaire automatiquement.</p>
                </div>
                {purchaseError && (
                  <div className="p-3 bg-danger-500/10 border border-danger-500/30 rounded-xl text-xs text-danger-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {purchaseError}
                  </div>
                )}
                <button
                  onClick={handleLancerTraitement}
                  disabled={purchaseLoading || !purchaseInput.trim()}
                  className="w-full py-3 bg-gradient-brand hover:opacity-90 text-white text-xs font-bold rounded-xl shadow-glow transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {purchaseLoading ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Analyse en cours...</>
                  ) : (
                    <><FileText className="w-4 h-4" /> Lancer le traitement</>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4 text-slate-500 py-12">
              <div className="w-16 h-16 rounded-2xl bg-slate-800/60 flex items-center justify-center border border-slate-700">
                <FileText className="w-8 h-8 text-slate-600" />
              </div>
              <div className="text-center space-y-2">
                <h4 className="text-sm font-bold text-slate-400">Aucune dépense en cours</h4>
                <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed">
                  Cliquez sur <strong className="text-brand-400">Saisie Manuelle</strong> pour entrer vos données directement,
                  ou importez un fichier pour l'analyse automatique.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


/* ==========================================================================
   COMPONENT: BANK SYNC VIEW (RAPPROCHEMENT BANCAIRE SIMULÉ)
   ========================================================================== */
function BankSyncView({ transactions, setTransactions, invoices, setInvoices, formatCurrency }) {
  const [successMatchId, setSuccessMatchId] = useState(null);

  // Rapprochement manuel
  const handleReconcile = (txId, invoiceId) => {
    // 1. Update transaction status
    setTransactions(transactions.map(tx => {
      if (tx.id === txId) {
        return { ...tx, status: 'RECONCILED', matchedInvoiceId: invoiceId };
      }
      return tx;
    }));

    // 2. Update invoice status
    setInvoices(invoices.map(inv => {
      if (inv.id === invoiceId) {
        return { ...inv, status: 'PAID' };
      }
      return inv;
    }));

    // Action success feedback
    setSuccessMatchId(txId);
    setTimeout(() => {
      setSuccessMatchId(null);
    }, 2000);
  };

  // Liste des transactions non rapprochées
  const pendingTx = transactions.filter(t => t.status === 'UNRECONCILED');
  // Liste des factures clients non réglées (SENT)
  const unpaidInvoices = invoices.filter(inv => inv.status === 'SENT');

  return (
    <div className="space-y-6">
      
      {/* Explication & Status header */}
      <div className="flex justify-between items-center bg-slate-900/20 p-4 rounded-xl border border-slate-800/40">
        <div>
          <h3 className="font-bold text-lg text-slate-100">Ledger de Synchronisation Bancaire</h3>
          <p className="text-xs text-slate-400">Associez les flux financiers de votre banque aux factures clients émises.</p>
        </div>
        <div className="text-right">
          <span className="text-xs font-bold text-slate-300">
            {pendingTx.length} flux en suspens
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Bank Flow */}
        <div className="lg:col-span-7 space-y-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Relevé de Banque (Simulé)</h4>
          
          <div className="space-y-3">
            {pendingTx.length === 0 ? (
              <div className="glass-card p-8 rounded-2xl border border-slate-800 text-center text-xs text-slate-500">
                🚀 Toutes les écritures de ce relevé bancaire ont été réconciliées avec succès !
              </div>
            ) : (
              pendingTx.map((tx) => {
                // Recherche d'une correspondance intelligente (montant exact)
                const autoMatch = unpaidInvoices.find(inv => Math.abs(parseFloat(inv.totalAmount)) === Math.abs(parseFloat(tx.amount)));
                const isMatchedJustNow = successMatchId === tx.id;

                return (
                  <div 
                    key={tx.id} 
                    className={`glass-card p-5 rounded-2xl border transition-all relative overflow-hidden ${
                      isMatchedJustNow ? 'border-accent-500 bg-accent-500/5' : 'border-slate-850'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            tx.type === 'CREDIT' ? 'bg-accent-500/10 text-accent-400' : 'bg-danger-500/10 text-danger-400'
                          }`}>
                            {tx.type === 'CREDIT' ? 'Entrée' : 'Débit'}
                          </span>
                          <span className="text-[11px] text-slate-400">{tx.date}</span>
                        </div>
                        <h4 className="text-sm font-bold text-white mt-2">{tx.description}</h4>
                      </div>

                      <div className="text-right">
                        <span className={`text-base font-extrabold ${tx.type === 'CREDIT' ? 'text-accent-400' : 'text-slate-100'}`}>
                          {tx.type === 'CREDIT' ? '+' : ''}{formatCurrency(tx.amount)}
                        </span>
                      </div>
                    </div>

                    {/* Auto Matching IA Banner Suggestion */}
                    {autoMatch && !isMatchedJustNow && (
                      <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between bg-brand-500/5 p-3 rounded-xl border border-brand-500/10 animate-pulse-soft">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-brand-400 shrink-0" />
                          <p className="text-[11px] text-slate-300">
                            IA Suggestion : <span className="font-semibold text-white">Facture {autoMatch.invoiceNumber}</span> de {autoMatch.clientName} ({formatCurrency(autoMatch.totalAmount)})
                          </p>
                        </div>
                        <button
                          onClick={() => handleReconcile(tx.id, autoMatch.id)}
                          className="px-3 py-1 bg-brand-600 hover:bg-brand-500 text-white font-bold text-[10px] rounded-lg shadow-glow transition-all"
                        >
                          Valider
                        </button>
                      </div>
                    )}

                    {isMatchedJustNow && (
                      <div className="mt-3 text-xs font-bold text-accent-400 flex items-center gap-1.5 animate-fade-in">
                        <CheckCircle2 className="w-4 h-4" /> Écriture rapprochée avec succès !
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Unpaid Invoices */}
        <div className="lg:col-span-5 space-y-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Factures Clients En Attente</h4>
          
          <div className="space-y-3">
            {unpaidInvoices.length === 0 ? (
              <div className="glass-card p-6 rounded-2xl border border-slate-850 text-center text-xs text-slate-500">
                Aucune facture en attente de règlement.
              </div>
            ) : (
              unpaidInvoices.map((inv) => (
                <div key={inv.id} className="glass-card p-4 rounded-xl border border-slate-850 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xs font-extrabold text-white">{inv.clientName}</h4>
                      <span className="text-[10px] font-mono text-slate-400">{inv.invoiceNumber}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-200">{formatCurrency(inv.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                    <span>Échéance : {inv.dueDate}</span>
                    <span className="text-warning-400 font-bold">Attente</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}


/* ==========================================================================
   COMPONENTS: LOCK SCREEN & PIN SETUP
   ========================================================================== */
function LockScreen({ onUnlock }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [showReset, setShowReset] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const ok = await onUnlock(pin);
    if (!ok) {
      setError('Code incorrect');
      setPin('');
    }
  };

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="glass-card p-10 rounded-3xl border border-slate-800 max-w-sm w-full space-y-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-brand flex items-center justify-center mx-auto shadow-glow">
          <Lock className="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100">Smart Comptable</h1>
          <p className="text-sm text-slate-400 mt-1">Entrez votre code de verrouillage</p>
        </div>
        {error && <p className="text-xs text-red-400 font-semibold">{error}</p>}
        <input
          ref={inputRef}
          type="password"
          maxLength="6"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={pin}
          onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
          placeholder="● ● ● ● ● ●"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] text-slate-100 focus:outline-none focus:border-brand-500 placeholder:text-slate-700"
        />
        <button type="submit" disabled={pin.length < 4} className="w-full py-3 bg-gradient-brand text-white font-bold rounded-xl text-sm shadow-glow hover:opacity-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
          Déverrouiller
        </button>
        <p className="text-[10px] text-slate-600">Verrouillage automatique après 5 minutes d'inactivité</p>
        <div className="space-y-2">
          {!showReset ? (
            <button type="button" onClick={() => setShowReset(true)} className="text-[10px] text-slate-600 hover:text-amber-400 underline transition-colors">
              Code oublié ?
            </button>
          ) : (
            <div className="space-y-2 pt-1">
              <p className="text-[10px] text-red-400/80">Réinitialiser effacera toutes les données.</p>
              <button type="button" onClick={() => { resetAll(); localStorage.clear(); window.location.reload(); }} className="text-[10px] px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/30 transition-all">
                Confirmer la réinitialisation
              </button>
              <button type="button" onClick={() => setShowReset(false)} className="text-[10px] text-slate-500 ml-2 hover:text-slate-300">
                Annuler
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

function PinSetupScreen({ onComplete }) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [step, setStep] = useState('create'); // 'create' | 'confirm'
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, [step]);

  const handleCreate = (e) => {
    e.preventDefault();
    setError('');
    setStep('confirm');
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    if (pin !== confirm) {
      setError('Les codes ne correspondent pas');
      setConfirm('');
      return;
    }
    await onComplete(pin);
  };

  const handleReset = () => {
    setStep('create');
    setPin('');
    setConfirm('');
    setError('');
  };

  if (step === 'confirm') {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
        <form onSubmit={handleConfirm} className="glass-card p-10 rounded-3xl border border-slate-800 max-w-sm w-full space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center mx-auto">
            <KeyRound className="w-8 h-8 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-100">Confirmer le code</h1>
            <p className="text-sm text-slate-400 mt-1">Saisissez à nouveau votre code à 4-6 chiffres</p>
          </div>
          {error && <p className="text-xs text-red-400 font-semibold">{error}</p>}
          <input
            ref={inputRef}
            type="password"
            maxLength="6"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={confirm}
            onChange={e => { setConfirm(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
            placeholder="● ● ● ● ● ●"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] text-slate-100 focus:outline-none focus:border-brand-500 placeholder:text-slate-700"
          />
          <div className="flex gap-3">
            <button type="button" onClick={handleReset} className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs hover:bg-slate-700 transition-all">
              Retour
            </button>
            <button type="submit" disabled={confirm.length < 4} className="flex-1 py-3 bg-gradient-brand text-white font-bold rounded-xl text-sm shadow-glow hover:opacity-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              Confirmer
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
      <form onSubmit={handleCreate} className="glass-card p-10 rounded-3xl border border-slate-800 max-w-sm w-full space-y-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-brand flex items-center justify-center mx-auto shadow-glow">
          <Lock className="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100">Sécurisez votre application</h1>
          <p className="text-sm text-slate-400 mt-1">Créez un code de verrouillage à 4-6 chiffres</p>
        </div>
        <input
          ref={inputRef}
          type="password"
          maxLength="6"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={pin}
          onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
          placeholder="● ● ● ● ● ●"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] text-slate-100 focus:outline-none focus:border-brand-500 placeholder:text-slate-700"
        />
        <button type="submit" disabled={pin.length < 4} className="w-full py-3 bg-gradient-brand text-white font-bold rounded-xl text-sm shadow-glow hover:opacity-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
          Créer le code
        </button>
        <p className="text-[10px] text-slate-600">Ce code protège vos données financières contre tout accès non autorisé</p>
      </form>
    </div>
  );
}

/* ==========================================================================
   COMPONENT: SETTINGS VIEW (CONFIGURATION COMPAGNIE)
   ========================================================================== */
function SettingsView({ companyDetails, setCompanyDetails }) {
  const [success, setSuccess] = useState(false);
  const [stats, setStats] = useState(getLearningStats());

  useEffect(() => { setStats(getLearningStats()); }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2500);
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card p-8 rounded-2xl border border-slate-800 max-w-2xl mx-auto space-y-6">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h3 className="font-extrabold text-slate-100 flex items-center gap-2">
            <Building className="w-5 h-5 text-indigo-400" /> Profil de l'entreprise
          </h3>
          <p className="text-xs text-slate-400 mt-1">Configurez les mentions légales apparaissant sur vos factures et les QR codes.</p>
        </div>
      </div>

      {success && (
        <div className="p-3 bg-accent-500/10 border border-accent-500/25 rounded-xl text-xs font-bold text-accent-400 flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4" /> Paramètres enregistrés avec succès !
        </div>
      )}

      {/* Statistiques du Moteur d'Apprentissage */}
      <div className="bg-slate-900/50 p-5 rounded-2xl border border-brand-500/30 space-y-3">
        <div className="flex items-center gap-2 text-brand-400">
          <Sparkles className="w-4 h-4" />
          <h4 className="text-xs font-extrabold uppercase tracking-wider">Moteur IA Local — Apprentissage Actif</h4>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-slate-950/60 rounded-xl p-3">
            <p className="text-xl font-black text-white">{stats.supplierCount}</p>
            <p className="text-[9px] text-slate-400 font-bold uppercase">Fournisseurs mémorisés</p>
          </div>
          <div className="bg-slate-950/60 rounded-xl p-3">
            <p className="text-xl font-black text-white">{stats.patternsCount}</p>
            <p className="text-[9px] text-slate-400 font-bold uppercase">Patterns appris</p>
          </div>
          <div className="bg-slate-950/60 rounded-xl p-3">
            <p className="text-xl font-black text-white">{Object.keys(stats.categories).length}</p>
            <p className="text-[9px] text-slate-400 font-bold uppercase">Catégories SCE</p>
          </div>
        </div>
        {stats.knownSuppliers.length > 0 && (
          <div>
            <p className="text-[10px] text-slate-500 font-bold mb-1.5 uppercase tracking-wider">Fournisseurs Appris</p>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {stats.knownSuppliers.map((s, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-slate-950/40 rounded-lg">
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-slate-200 truncate block">{s.name}</span>
                    <span className="text-[9px] text-slate-500">{s.count} entrée{s.count > 1 ? 's' : ''}{s.mf ? ' — MF: ' + s.mf : ''}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 ml-2">{s.total.toFixed(0)} DT</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="text-[9px] text-slate-500 mt-1"><AlertCircle className="w-3 h-3 inline-block mr-1" />L'IA apprend de chaque facture et dépense que vous saisissez. Plus vous l'utilisez, plus les suggestions sont précises.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-[10px] text-slate-500 font-bold mb-1.5 uppercase">Raison sociale</label>
          <input 
            type="text" 
            required 
            value={companyDetails.name}
            onChange={(e) => setCompanyDetails({...companyDetails, name: e.target.value})}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 text-xs focus:outline-none focus:border-brand-500"
          />
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 font-bold mb-1.5 uppercase">E-mail légal</label>
          <input 
            type="email" 
            required 
            value={companyDetails.email}
            onChange={(e) => setCompanyDetails({...companyDetails, email: e.target.value})}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 text-xs focus:outline-none focus:border-brand-500"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-[10px] text-slate-500 font-bold mb-1.5 uppercase">Adresse physique</label>
          <input 
            type="text" 
            required 
            value={companyDetails.address}
            onChange={(e) => setCompanyDetails({...companyDetails, address: e.target.value})}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 text-xs focus:outline-none focus:border-brand-500"
          />
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 font-bold mb-1.5 uppercase">Matricule Fiscal (MF)</label>
          <input 
            type="text" 
            required 
            value={companyDetails.vatNumber}
            onChange={(e) => setCompanyDetails({...companyDetails, vatNumber: e.target.value})}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 text-xs focus:outline-none focus:border-brand-500"
          />
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 font-bold mb-1.5 uppercase">Devise de l'exercice</label>
          <select 
            value={companyDetails.currency}
            onChange={(e) => setCompanyDetails({...companyDetails, currency: e.target.value})}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 text-xs focus:outline-none focus:border-brand-500"
          >
            <option value="TND">Dinar Tunisien (DT)</option>
            <option value="EUR">Euro (€)</option>
            <option value="USD">Dollar Américain ($)</option>
            <option value="MAD">Dirham Marocain (MAD)</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 font-bold mb-1.5 uppercase">RIB Bancaire (Compte courant)</label>
          <input 
            type="text" 
            required 
            value={companyDetails.iban}
            onChange={(e) => setCompanyDetails({...companyDetails, iban: e.target.value})}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 text-xs focus:outline-none focus:border-brand-500"
          />
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 font-bold mb-1.5 uppercase">Code Swift de la Banque</label>
          <input 
            type="text" 
            required 
            value={companyDetails.bic}
            onChange={(e) => setCompanyDetails({...companyDetails, bic: e.target.value})}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 text-xs focus:outline-none focus:border-brand-500"
          />
        </div>
      </div>

      <div className="pt-4">
        <button 
          type="submit" 
          className="w-full py-2.5 bg-gradient-brand text-white font-bold rounded-xl text-xs shadow-glow hover:opacity-90 transition-all"
        >
          Sauvegarder les modifications
        </button>
      </div>
    </form>
  );
}

/* ==========================================================================
   COMPONENT: FLUX DE CLÔTURE & DÉCLARATION COMPTABLE (WORKFLOW VIEW)
   ========================================================================== */
function WorkflowView({ 
  expenses, 
  transactions, 
  invoices, 
  formatCurrency, 
  companyDetails, 
  setCurrentTab
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [payrollBase, setPayrollBase] = useState(4800);
  const [cnssValidated, setCnssValidated] = useState(false);
  const [fiscalValidated, setFiscalValidated] = useState(false);
  const [generatingAudit, setGeneratingAudit] = useState(false);
  const [auditReport, setAuditReport] = useState('');
  const [monthClosed, setMonthClosed] = useState(false);

  // calculations
  const unreconciledCount = transactions.filter(t => t.status === 'UNRECONCILED').length;
  const isBankDone = unreconciledCount === 0;
  const isOcrDone = expenses.length >= 2; // on considère qu'au moins 2 reçus scannés valide l'étape

  const totalRevenues = invoices.reduce((acc, inv) => acc + (inv.status === 'PAID' ? inv.total : 0), 0);
  const totalExpenses = expenses.reduce((acc, exp) => acc + exp.totalAmount, 0);
  const netProfit = totalRevenues - totalExpenses;
  
  const estimatedIS = netProfit > 0 ? netProfit * 0.15 : 0;
  const estimatedCNSS = payrollBase * 0.1657;
  const totalDue = estimatedIS + estimatedCNSS;

  const handleGenerateAudit = async () => {
    setGeneratingAudit(true);
    setAuditReport('');
    try {
      const result = runFullAudit({ invoices, expenses, transactions, companyDetails });
      const md = generateAuditMarkdown(result);
      setAuditReport(md);
      setActiveStep(4);
    } catch (e) {
      setAuditReport("❌ Erreur d'audit : " + e.message);
    } finally {
      setGeneratingAudit(false);
    }
  };

  const steps = [
    {
      title: "1. Scan & Collecte",
      desc: "Vérification des factures achats",
      isDone: isOcrDone,
      badge: `${expenses.length} reçus`
    },
    {
      title: "2. Rapprochement",
      desc: "Lettrage des flux bancaires",
      isDone: isBankDone,
      badge: isBankDone ? "Complet" : `${unreconciledCount} en attente`
    },
    {
      title: "3. CNSS Tunisie",
      desc: "Déclaration sociale trimestrielle",
      isDone: cnssValidated,
      badge: cnssValidated ? "Calculé & Validé" : "À vérifier"
    },
    {
      title: "4. Provision IS & TVA",
      desc: "Déclaration fiscale prévisionnelle",
      isDone: fiscalValidated,
      badge: fiscalValidated ? "Provisionné" : "À vérifier"
    },
    {
      title: "5. Audit & Clôture",
      desc: "Rapport Smart-Comptable",
      isDone: monthClosed,
      badge: monthClosed ? "Clôturé" : "Finalisation"
    }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Sidebar des étapes */}
      <div className="lg:col-span-4 space-y-4">
        <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
          <div>
            <h3 className="font-extrabold text-white flex items-center gap-2 text-sm">
              <Layers className="w-4 h-4 text-brand-400" /> Progression de la Clôture
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Complétez chaque étape pour générer l'audit légal et verrouiller vos comptes.
            </p>
          </div>

          <div className="space-y-2.5">
            {steps.map((step, idx) => (
              <button
                key={idx}
                onClick={() => setActiveStep(idx)}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all text-left ${
                  activeStep === idx 
                    ? 'bg-slate-800 border-indigo-500/50 shadow-inner-glow' 
                    : 'bg-slate-900/30 border-slate-850 hover:bg-slate-900/50'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {step.isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-slate-500" />
                    )}
                    <span className={`text-xs font-bold ${activeStep === idx ? 'text-white' : 'text-slate-300'}`}>
                      {step.title}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 pl-4">{step.desc}</p>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                  step.isDone ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                }`}>
                  {step.badge}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Card récapitulative live */}
        <div className="glass-card p-5 rounded-2xl border border-slate-800/80 bg-slate-950/20 space-y-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Récapitulatif de Déclaration</span>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Résultat Fiscal :</span>
              <span className="font-bold text-slate-200">{formatCurrency(netProfit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Prov. IS (15%) :</span>
              <span className="font-bold text-indigo-400">{formatCurrency(estimatedIS)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Prov. CNSS (16.57%) :</span>
              <span className="font-bold text-brand-400">{formatCurrency(estimatedCNSS)}</span>
            </div>
            <div className="border-t border-slate-850 pt-2 flex justify-between font-bold">
              <span className="text-white">Total Obligations :</span>
              <span className="text-accent-400">{formatCurrency(totalDue)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Détail de l'étape active */}
      <div className="lg:col-span-8">
        <div className="glass-card p-4 sm:p-8 rounded-2xl border border-slate-800 min-h-[300px] lg:min-h-[500px] flex flex-col justify-between space-y-8 relative overflow-hidden">
          
          {/* STEP 1: SCAN & COLLECTE */}
          {activeStep === 0 && (
            <div className="space-y-6 flex-1">
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Scan className="w-5 h-5 text-brand-400" /> Étape 1 : Collecte de Justificatifs & OCR
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Tous vos achats professionnels doivent être accompagnés d'un justificatif conforme pour réduire votre assiette d'impôt IS.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Factures d'Achats Scannées</span>
                  <p className="text-2xl font-black text-white">{expenses.length}</p>
                  <p className="text-[10px] text-emerald-400">Moteur OCR local actif & opérationnel</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Total Charges Enregistrées</span>
                  <p className="text-2xl font-black text-indigo-400">{formatCurrency(totalExpenses)}</p>
                  <p className="text-[10px] text-slate-400">Base déductible estimée</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 space-y-2">
                <h4 className="text-xs font-bold text-indigo-300">💡 Statut de conformité</h4>
                <p className="text-xs text-slate-300">
                  {isOcrDone 
                    ? "Excellent ! Vous disposez de suffisamment de reçus d'achats scannés pour optimiser légalement l'Impôt sur les Sociétés."
                    : "Attention, vous avez peu de reçus d'achats numérisés. Importez vos factures de frais dans l'onglet OCR pour réduire vos charges imposables."
                  }
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setCurrentTab('ocr')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl transition-all font-bold text-xs"
                >
                  <Plus className="w-4 h-4" /> Numériser de nouveaux reçus d'achats
                </button>
                <button
                  onClick={() => setActiveStep(1)}
                  className="px-5 py-2.5 bg-gradient-brand text-white rounded-xl transition-all font-bold text-xs ml-auto"
                >
                  Étape Suivante
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: RAPPROCHEMENT */}
          {activeStep === 1 && (
            <div className="space-y-6 flex-1">
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-indigo-400" /> Étape 2 : Rapprochement Bancaire
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Assurez la cohérence absolue entre votre relevé bancaire et vos factures (ventes & achats).
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/30 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Transactions non lettrées</span>
                  <p className="text-2xl font-black text-white">{unreconciledCount} écritures</p>
                </div>
                {isBankDone ? (
                  <span className="px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                    ✓ Rapproché à 100%
                  </span>
                ) : (
                  <span className="px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
                    ⚠️ En attente d'association
                  </span>
                )}
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-850 space-y-2">
                <h4 className="text-xs font-bold text-slate-200">🔍 Rapprochement des flux de trésorerie</h4>
                <p className="text-xs text-slate-400">
                  Le lettrage permet de lier des entrées ou sorties de fonds à des factures physiques réelles. C'est indispensable pour justifier de l'exactitude fiscale de votre CA.
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setCurrentTab('bank')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/30 rounded-xl transition-all font-bold text-xs"
                >
                  <ArrowLeftRight className="w-4 h-4" /> Aller au rapprochement bancaire
                </button>
                <button
                  onClick={() => setActiveStep(2)}
                  className="px-5 py-2.5 bg-gradient-brand text-white rounded-xl transition-all font-bold text-xs ml-auto"
                >
                  Étape Suivante
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: CNSS */}
          {activeStep === 2 && (
            <div className="space-y-6 flex-1">
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-brand-400" /> Étape 3 : Déclaration & Cotisation CNSS (Tunisie)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Les cotisations de la CNSS (régime général de Tunisie) s'élèvent à **16.57%** à la charge de l'employeur sur le total des salaires bruts versés.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold mb-2 uppercase">
                    Masse salariale mensuelle brute cumulée : **{formatCurrency(payrollBase)}**
                  </label>
                  <input 
                    type="range" 
                    min="1500" 
                    max="15000" 
                    step="100"
                    value={payrollBase}
                    onChange={(e) => {
                      setPayrollBase(Number(e.target.value));
                      setCnssValidated(false);
                    }}
                    className="w-full accent-brand-500"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 mt-1 font-semibold">
                    <span>1 500 DT</span>
                    <span>7 500 DT</span>
                    <span>15 000 DT</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase">CNSS Employeur (16.57%)</span>
                    <p className="text-xl font-extrabold text-brand-400">{formatCurrency(estimatedCNSS)}</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase">Provision à bloquer</span>
                    <p className="text-xl font-extrabold text-white">{formatCurrency(estimatedCNSS)}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5 text-xs text-slate-400">
                <p className="font-bold text-slate-200">ℹ️ Échéances de dépôt de la CNSS en Tunisie :</p>
                <p>• La déclaration s'effectue par trimestre civil (avant le 15 du mois suivant le trimestre).</p>
                <p>• Anticiper et provisionner chaque mois 16.57% de la masse salariale évite tout incident de trésorerie.</p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setCnssValidated(true)}
                  className="px-5 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl transition-all font-bold text-xs"
                >
                  {cnssValidated ? "✓ Cotisation CNSS Validée !" : "Valider et provisionner la CNSS"}
                </button>
                <button
                  onClick={() => setActiveStep(3)}
                  className="px-5 py-2.5 bg-gradient-brand text-white rounded-xl transition-all font-bold text-xs ml-auto"
                >
                  Étape Suivante
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: IS & TVA */}
          {activeStep === 3 && (
            <div className="space-y-6 flex-1">
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Building className="w-5 h-5 text-indigo-400" /> Étape 4 : Impôt sur les Sociétés (IS) & TVA
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Calcul de la provision pour l'Impôt sur les Sociétés (IS) au taux standard prévisionnel de **15%**.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Revenus Encaissés</span>
                  <p className="text-lg font-black text-white">{formatCurrency(totalRevenues)}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Dépenses Cumulées</span>
                  <p className="text-lg font-black text-slate-400">{formatCurrency(totalExpenses)}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/50 border border-indigo-500/20 space-y-1">
                  <span className="text-[10px] text-indigo-400 font-bold uppercase">Résultat Fiscal Estimé</span>
                  <p className={`text-lg font-black ${netProfit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(netProfit)}
                  </p>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/15 flex justify-between items-center">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Impôt sur les Sociétés (Taux 15%)</span>
                  <p className="text-2xl font-black text-indigo-400">{formatCurrency(estimatedIS)}</p>
                </div>
                <button
                  onClick={() => setFiscalValidated(true)}
                  className="px-4 py-2 bg-gradient-brand text-white text-xs font-bold rounded-xl shadow-glow hover:opacity-95 transition-all"
                >
                  {fiscalValidated ? "✓ Provision IS Bloquée" : "Bloquer la Provision IS"}
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-850 space-y-1 text-xs text-slate-400">
                <span className="font-bold text-slate-200">🔍 Mécanique de déclaration fiscale tunisienne :</span>
                <p>• Le taux normal de l'IS en Tunisie est de 15% (loi de finances en vigueur).</p>
                <p>• Bloquer cette provision évite de gonfler artificiellement votre solde disponible et garantit la solvabilité de l'entreprise lors des échéances fiscales officielles.</p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setActiveStep(4)}
                  className="px-5 py-2.5 bg-gradient-brand text-white rounded-xl transition-all font-bold text-xs ml-auto"
                >
                  Étape Suivante
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: FINAL CLOSE & AUDIT */}
          {activeStep === 4 && (
            <div className="space-y-6 flex-1">
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-brand-400" /> Étape 5 : Audit final & Clôture du Mois
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Générez le rapport de synthèse par **Smart-Comptable** et finalisez la clôture de Carthage Creative Studio S.A.R.L.
                </p>
              </div>

              {generatingAudit ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-4">
                  <RefreshCw className="w-8 h-8 text-brand-400 animate-spin" />
                  <span className="text-xs text-indigo-400 font-semibold">Génération de l'audit expert en cours...</span>
                </div>
              ) : auditReport ? (
                <div className="p-6 rounded-2xl bg-slate-950/40 border border-slate-800 text-xs overflow-y-auto max-h-[300px] space-y-4 custom-markdown">
                  <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{auditReport}</ReactMarkdown>
                </div>
              ) : (
                <div className="p-12 text-center border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/10 flex flex-col items-center justify-center space-y-4">
                  <Sparkles className="w-10 h-10 text-slate-600 animate-pulse-soft" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-200">Rapport d'audit de conformité final</p>
                    <p className="text-[10px] text-slate-500 max-w-sm">Le moteur d'intelligence comptable tunisien va dresser le diagnostic complet de vos charges, provisions et liquidités.</p>
                  </div>
                  <button
                    onClick={handleGenerateAudit}
                    className="px-5 py-2.5 bg-gradient-brand text-white text-xs font-bold rounded-xl shadow-glow hover:opacity-90 transition-all flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" /> Lancer l'Audit Smart-Comptable
                  </button>
                </div>
              )}

              {monthClosed ? (
                <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-center space-y-2 animate-fade-in">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <h4 className="text-sm font-black text-emerald-300">FÉLICITATIONS ! EXERCICE CLÔTURÉ AVEC SUCCÈS</h4>
                  <p className="text-xs text-slate-200">
                    Les écritures comptables et le rapport de clôture pour **Carthage Creative Studio S.A.R.L** ont été verrouillés et archivés.
                  </p>
                </div>
              ) : (
                <div className="flex gap-4">
                  {auditReport && (
                    <button
                      onClick={() => setMonthClosed(true)}
                      className="w-full py-3 bg-gradient-brand text-white font-black rounded-xl text-xs shadow-glow hover:scale-[1.01] transition-all flex items-center justify-center gap-2"
                    >
                      <ShieldCheck className="w-4 h-4" /> VERROUILLER & CLÔTURER LE MOIS
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

