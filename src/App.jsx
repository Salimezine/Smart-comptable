import React, { useState, useEffect } from 'react';
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
  ShieldCheck
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
  INITIAL_EXPENSES, 
  MOCK_CHART_DATA, 
  RECEIPT_SAMPLES 
} from './mockData';
import { 
  calculateTotalRevenues, 
  calculatePendingRevenues, 
  calculateTotalExpenses, 
  calculateBankBalance, 
  calculateEstimatedTaxes, 
  calculateInvoiceTotals, 
  formatCurrencyHelper 
} from './accountingUtils';
import { scanReceiptWithGemini, fileToBase64, analyzeDashboardWithGemini } from './geminiService';
import ReactMarkdown from 'react-markdown';
import Onboarding from './Onboarding';
import CompanySwitcher from './CompanySwitcher';
import FinancialReportView from './FinancialReportView';

export default function App() {
  // Navigation State
  const [currentTab, setCurrentTab] = useState('dashboard');
  
  // Advisor State
  const [advisorModalOpen, setAdvisorModalOpen] = useState(false);
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorReport, setAdvisorReport] = useState('');
  
  // App States - Multi-Tenant
  const [companies, setCompanies] = useState(() => {
    return JSON.parse(localStorage.getItem('smart_comptable_companies') || '{}');
  });
  
  const [currentCompanyId, setCurrentCompanyId] = useState(() => {
    return localStorage.getItem('smart_comptable_current_id') || null;
  });

  const [invoices, setInvoices] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [companyDetails, setCompanyDetails] = useState({});

  // Load specific company data when selected
  useEffect(() => {
    if (currentCompanyId && companies[currentCompanyId]) {
      const data = companies[currentCompanyId];
      setInvoices(data.invoices || []);
      setTransactions(data.transactions || []);
      setExpenses(data.expenses || []);
      setCompanyDetails(data.companyDetails || {});
    }
  }, [currentCompanyId]); // Run only when ID changes

  // Persist local state back to the companies catalogue
  useEffect(() => {
    if (currentCompanyId) {
      setCompanies(prev => {
        const currentData = prev[currentCompanyId] || {};
        const updated = {
          ...prev,
          [currentCompanyId]: {
            ...currentData,
            invoices,
            transactions,
            expenses,
            companyDetails
          }
        };
        localStorage.setItem('smart_comptable_companies', JSON.stringify(updated));
        return updated;
      });
    }
  }, [invoices, transactions, expenses, companyDetails, currentCompanyId]);

  const handleCreateCompany = (details) => {
    const id = `company_${Date.now()}`;
    const initialData = {
      companyDetails: details,
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

  // 1. Écran de démarrage obligatoire
  if (!currentCompanyId || !companies[currentCompanyId]) {
    return <Onboarding onComplete={handleCreateCompany} />;
  }

  // Core accounting metrics calculations using standard accounting utils
  const totalRevenues = calculateTotalRevenues(invoices);
  const pendingRevenues = calculatePendingRevenues(invoices);
  const totalExpenses = calculateTotalExpenses(expenses);
  const bankBalance = calculateBankBalance(32800, transactions);
  const estimatedTaxes = calculateEstimatedTaxes(totalRevenues);

  // Helpers
  const formatCurrency = (val) => {
    return formatCurrencyHelper(val, companyDetails.currency);
  };

  const handleAddInvoice = (newInv) => {
    setInvoices([newInv, ...invoices]);
  };

  const handleAddExpense = (newExp) => {
    setExpenses([newExp, ...expenses]);
  };

  const handleRequestAudit = async () => {
    setAdvisorModalOpen(true);
    setAdvisorLoading(true);
    setAdvisorReport('');
    try {
      const dashboardData = {
        totalRevenues,
        pendingRevenues,
        totalExpenses,
        bankBalance,
        estimatedTaxes,
        recentInvoices: invoices.slice(0, 5),
        recentExpenses: expenses.slice(0, 5)
      };
      const report = await analyzeDashboardWithGemini(companyDetails.geminiApiKey, dashboardData);
      setAdvisorReport(report);
    } catch (err) {
      setAdvisorReport("❌ Erreur lors de l'audit : " + err.message);
    } finally {
      setAdvisorLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-surface-900 text-slate-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 glass-panel border-r border-slate-800 flex flex-col justify-between shrink-0 z-20">
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
              { id: 'ocr', label: 'Scan Reçus (IA)', icon: Scan, badge: 'New' },
              { id: 'bank', label: 'Rapprochement', icon: ArrowLeftRight, badge: transactions.filter(t => t.status === 'UNRECONCILED').length || null },
              { id: 'financial', label: 'Bilan & Résultat', icon: CheckCheck },
              { id: 'settings', label: 'Configuration', icon: SettingsIcon },
            ].map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
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
        <header className="h-20 border-b border-slate-800/50 flex items-center justify-between px-8 bg-slate-950/20 backdrop-blur-md sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white capitalize">
              {currentTab === 'dashboard' && 'Vue d\'ensemble financière'}
              {currentTab === 'workflow' && 'Flux de Clôture Comptable & Déclaration'}
              {currentTab === 'invoicing' && 'Factures de Ventes'}
              {currentTab === 'ocr' && 'Numérisation & OCR intelligent'}
              {currentTab === 'bank' && 'Synchronisation & Rapprochement Bancaire'}
              {currentTab === 'settings' && 'Configuration & Entreprise'}
            </h2>
            <p className="text-xs text-slate-400">
              {currentTab === 'dashboard' && 'Suivez la santé de votre trésorerie et vos estimations fiscales en temps réel.'}
              {currentTab === 'invoicing' && 'Créez, gérez et exportez vos factures clients aux normes.'}
              {currentTab === 'ocr' && 'Déposez vos justificatifs. Notre intelligence artificielle Gemini extrait les montants et taxes.'}
              {currentTab === 'bank' && 'Associez vos relevés bancaires simulés à vos factures de ventes ou d\'achats.'}
              {currentTab === 'workflow' && 'Suivez pas à pas la déclaration de vos charges sociales, impôts IS et validez le mois.'}
              {currentTab === 'settings' && 'Renseignez les données légales de votre société pour les QR Codes et factures.'}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Quick Actions */}
            {currentTab === 'dashboard' && (
              <button 
                onClick={handleRequestAudit} 
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-750 text-brand-400 border border-brand-500/30 rounded-xl transition-all duration-300 shadow-inner-glow"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Audit Smart-Comptable
              </button>
            )}
            <button 
              onClick={() => setCurrentTab('ocr')} 
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-750 text-indigo-400 border border-indigo-500/20 rounded-xl transition-all duration-300 shadow-inner-glow"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Scanner un reçu
            </button>
            <button 
              onClick={() => setCurrentTab('invoicing')} 
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-gradient-brand hover:opacity-90 text-white rounded-xl transition-all duration-300 shadow-glow"
            >
              <Plus className="w-3.5 h-3.5" />
              Nouvelle Facture
            </button>
          </div>
        </header>

        {/* Tab Switcher Body */}
        <div className="flex-1 p-8">
          <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
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
            {currentTab === 'ocr' && (
              <OcrView 
                expenses={expenses}
                onAddExpense={handleAddExpense}
                formatCurrency={formatCurrency}
                geminiApiKey={companyDetails.geminiApiKey}
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
                handleRequestAudit={handleRequestAudit}
                analyzeDashboardWithGemini={analyzeDashboardWithGemini}
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
                  <p className="text-slate-400 font-medium animate-pulse">Analyse de vos flux de trésorerie et provisions IS/CNSS en cours...</p>
                </div>
              ) : (
                <ReactMarkdown>{advisorReport}</ReactMarkdown>
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
  // Evolution de la Trésorerie mockée
  const chartData = MOCK_CHART_DATA;

  // Calcul du taux de taxes
  const taxRatio = Math.min((estimatedTaxes / (totalRevenues || 1)) * 100, 100);

  return (
    <div className="space-y-6">
      {/* 4 Cards Métriques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-gradient-brand text-white rounded-xl shadow-glow transition-all"
        >
          {showCreateForm ? 'Annuler' : 'Créer une facture'}
        </button>
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
        /* TABLEAU PRINCIPAL DES FACTURES */
        <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden shadow-card">
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
              {invoices.map((inv, idx) => (
                <tr key={idx} className="hover:bg-slate-800/10 transition-colors">
                  <td className="py-4 px-6 font-mono font-bold text-slate-300">{inv.invoiceNumber}</td>
                  <td className="py-4 px-6">
                    <div>
                      <p className="font-bold text-white">{inv.clientName}</p>
                      <span className="text-[10px] text-slate-400">{inv.clientEmail}</span>
                    </div>
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
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleDownloadPDF(inv)}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 rounded-xl transition-all border border-slate-700/50 flex items-center gap-1.5 text-[11px] font-bold shadow-inner-glow"
                        title="Télécharger PDF"
                      >
                        <Download className="w-3.5 h-3.5" /> PDF
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   COMPONENT: OCR VIEW (NUMÉRISATION + SAISIE MANUELLE)
   ========================================================================== */
function OcrView({ expenses, onAddExpense, formatCurrency, geminiApiKey }) {
  const [mode, setMode] = useState('choice'); // 'choice' | 'manual' | 'scanning' | 'result' | 'success'
  const [activeSample, setActiveSample] = useState(null);
  const [isAiScan, setIsAiScan] = useState(false);

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
  };
  const [formData, setFormData] = useState(BLANK_FORM);

  const CATEGORIES = [
    'Télécoms & Internet', 'Énergie & Utilités', 'Fournitures de Bureau',
    'Déplacements', 'Restauration', 'Loyer & Charges', 'Salaires & Charges Sociales', 'Autres',
  ];

  const hasValidKey = geminiApiKey && geminiApiKey !== '' && geminiApiKey !== 'local';

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

  // Scan par exemple de test
  const handleStartScan = (sample) => {
    setActiveSample(sample);
    setIsAiScan(false);
    setMode('scanning');
    setTimeout(() => {
      applyFormData(sample.data);
      setMode('result');
    }, 1800);
  };

  // Scan fichier réel
  const handleFileScan = async (e) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    setActiveSample(null);
    setIsAiScan(hasValidKey);
    setMode('scanning');
    try {
      const { base64Data, mimeType } = await fileToBase64(file);
      const data = await scanReceiptWithGemini(geminiApiKey, base64Data, mimeType, file.name);
      applyFormData(data);
      setMode('result');
    } catch (err) {
      console.error(err);
      setMode('choice');
      alert("Erreur lors du scan : " + err.message);
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
      category: formData.category,
      invoiceNumber: formData.invoiceNumber,
      status: "VALIDATED"
    });
    setMode('success');
    setFormData(BLANK_FORM);
    setActiveSample(null);
  };

  // Formulaire partagé (saisie manuelle + résultat scan)
  const renderEntryForm = (isManual) => (
    <form onSubmit={handleConfirmExpense} className="space-y-4 animate-slide-up flex-1 overflow-y-auto">
      <div className="flex justify-between items-center border-b border-slate-800 pb-3">
        <h4 className={`text-sm font-extrabold flex items-center gap-1.5 ${isManual ? 'text-brand-400' : isAiScan ? 'text-accent-400' : 'text-warning-400'}`}>
          {isManual
            ? <><Plus className="w-4 h-4" /> Saisie Manuelle du Justificatif</>
            : isAiScan
              ? <><CheckCircle2 className="w-4 h-4" /> Extraction IA — Vérifiez et corrigez</>
              : <><AlertCircle className="w-4 h-4" /> Données simulées — Corrigez avant d'enregistrer</>
          }
        </h4>
        <button type="button" onClick={() => { setMode('choice'); setFormData(BLANK_FORM); }}
          className="text-[10px] text-slate-500 hover:text-slate-300 underline">✕ Annuler</button>
      </div>

      {!isManual && !isAiScan && (
        <div className="p-3 bg-warning-500/10 border border-warning-500/30 rounded-xl text-[10px] text-warning-400 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            <strong>Ces données sont fictives</strong> — L'IA n'a pas pu lire votre document (clé API invalide ou absente).
            Corrigez tous les champs ci-dessous. Pour activer le scan réel, ajoutez votre clé dans <strong>⚙️ Configuration</strong>.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">Fournisseur / Vendeur *</label>
          <input type="text" required placeholder="ex: Ooredoo Tunisie, STEG, Monoprix..."
            value={formData.supplier}
            onChange={(e) => setFormData(f => ({...f, supplier: e.target.value}))}
            className="w-full bg-slate-900 border border-slate-700 focus:border-brand-500 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none transition-colors"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">Matricule Fiscal Fournisseur</label>
          <input type="text" placeholder="ex: 1234567/A/M/000" value={formData.matriculeFiscal}
            onChange={(e) => setFormData(f => ({...f, matriculeFiscal: e.target.value}))}
            className="w-full bg-slate-900 border border-slate-700 focus:border-brand-500 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">Date du Reçu *</label>
          <input type="date" required value={formData.date}
            onChange={(e) => setFormData(f => ({...f, date: e.target.value}))}
            className="w-full bg-slate-900 border border-slate-700 focus:border-brand-500 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">N° Justificatif</label>
          <input type="text" placeholder="ex: FAC-2026-0012" value={formData.invoiceNumber}
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
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Section Montants */}
      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/60 space-y-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Détail des Montants (DT)</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">Taux TVA</label>
            <select value={formData.vatRate}
              onChange={(e) => {
                const r = parseFloat(e.target.value) || 19;
                const sub = parseFloat(formData.subtotal) || 0;
                const fodecVal = parseFloat(formData.fodec) || 0;
                const baseTva = sub + fodecVal;
                const vat = baseTva * (r / 100);
                const amountBeforeStamp = baseTva + vat;
                const newStamp = getStampDutyForAmount(amountBeforeStamp);
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
            <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase" title="Loi de finances 2026 : 1 DT si &lt;50, 1.5 DT si 50-100, 2 DT si &gt;100 DT">
              Timbre Fiscal (Auto) ⓘ
            </label>
            <input type="number" step="0.001" min="0" readOnly value={formData.stampDuty}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-brand-300 text-sm cursor-not-allowed opacity-75"
              title="Calculé automatiquement selon la Loi de finances 2026"
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
          <div>
            <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">FODEC (1%) (DT)</label>
            <input type="number" step="0.001" min="0" placeholder="0.000" value={formData.fodec}
              onChange={(e) => handleFodecChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 focus:border-brand-500 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">Montant TVA</label>
            <input type="number" step="0.001" min="0" placeholder="Auto-calculé" value={formData.vatAmount}
              onChange={(e) => setFormData(f => ({...f, vatAmount: e.target.value}))}
              className="w-full bg-slate-950 border border-slate-650 focus:border-brand-500 rounded-xl px-3 py-2 text-slate-300 text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] text-warning-400 font-bold mb-1 uppercase">✦ Total TTC *</label>
            <input type="number" step="0.001" min="0" required placeholder="Montant total payé" value={formData.totalAmount}
              onChange={(e) => handleTotalChange(e.target.value)}
              className="w-full bg-slate-950 border-2 border-warning-500/60 focus:border-warning-400 rounded-xl px-3 py-2 text-warning-300 text-sm font-bold focus:outline-none"
            />
          </div>
        </div>
        <p className="text-[9px] text-slate-500 mt-1">Saisissez le Total TTC ou le Sous-total HT pour mettre à jour les calculs.</p>
      </div>

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={() => { setMode('choice'); setFormData(BLANK_FORM); }}
          className="flex-1 py-2.5 border border-slate-700 hover:bg-slate-800/40 text-slate-400 text-xs font-bold rounded-xl transition-all">
          Annuler
        </button>
        <button type="submit"
          className="flex-[2] py-2.5 bg-gradient-brand hover:opacity-90 text-white text-xs font-bold rounded-xl shadow-glow transition-all flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" /> Enregistrer la dépense
        </button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6">
      {/* Bannière clé API */}
      {!hasValidKey && (
        <div className="p-3.5 bg-slate-900/50 border border-brand-500/30 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-brand-400 shrink-0" />
            <p className="text-xs text-slate-300">
              <strong className="text-brand-400">Mode Simulation actif.</strong>{' '}
              Pour un scan réel, ajoutez votre clé d'API n8n dans{' '}
              <strong>⚙️ Configuration</strong>. En attendant, utilisez la <strong>Saisie Manuelle</strong>.
            </p>
          </div>
          <span className="text-[10px] font-bold text-brand-400 border border-brand-500/30 px-2 py-1 rounded-lg shrink-0 bg-brand-500/10 whitespace-nowrap">
            n8n workflow
          </span>
        </div>
      )}

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
            <input type="file" accept=".pdf,image/png,image/jpeg"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileScan}
            />
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Upload className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-slate-100">
                Scanner un fichier{hasValidKey && <span className="text-accent-400 text-[10px] ml-2 font-bold">● IA ACTIVE</span>}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">PDF, PNG, JPG — {hasValidKey ? 'Lecture IA de votre document' : 'Données à corriger après scan'}</p>
            </div>
          </label>

          {/* Exemples de test */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Exemples de test (données réelles)</span>
            <div className="grid grid-cols-1 gap-2">
              {RECEIPT_SAMPLES.map((sample, idx) => (
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
        <div className="glass-card p-6 rounded-2xl border border-slate-800 lg:col-span-7 flex flex-col justify-between min-h-[520px] relative overflow-hidden">
          {mode === 'scanning' && (
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-500 to-transparent animate-[shimmer_1.5s_infinite] shadow-glow" />
          )}

          {mode === 'scanning' ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4 py-12 animate-pulse-soft">
              <div className="w-14 h-14 rounded-full bg-brand-500/10 border border-brand-500/30 flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-brand-400 animate-spin" />
              </div>
              <div className="text-center space-y-1">
                <h4 className="text-sm font-bold text-slate-200">Analyse {hasValidKey ? 'Gemini IA' : 'en cours'}...</h4>
                <p className="text-[11px] text-indigo-400">{hasValidKey ? 'Lecture intelligente par Gemini 1.5 Flash...' : 'Préparation des données...'}</p>
              </div>
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
   COMPONENT: SETTINGS VIEW (CONFIGURATION COMPAGNIE)
   ========================================================================== */
function SettingsView({ companyDetails, setCompanyDetails }) {
  const [success, setSuccess] = useState(false);

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

      <div className="bg-slate-900/50 p-5 rounded-2xl border border-brand-500/30">
        <label className="block text-[10px] text-brand-400 font-bold mb-1.5 uppercase flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> Clé API Google Gemini
        </label>
        <input type="password" placeholder="AIzaSy..." 
          value={companyDetails.geminiApiKey || ''}
          onChange={(e) => setCompanyDetails({...companyDetails, geminiApiKey: e.target.value})}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 text-xs focus:outline-none focus:border-brand-500"
        />
        <p className="text-[9px] text-slate-500 mt-1.5">Clé Gemini stockée localement. Envoyée au workflow n8n pour le scan et l'analyse.</p>
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
  setCurrentTab, 
  analyzeDashboardWithGemini 
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
      const dashboardData = {
        totalRevenues,
        pendingRevenues: invoices.reduce((acc, inv) => acc + (inv.status === 'PENDING' ? inv.total : 0), 0),
        totalExpenses,
        bankBalance: 32800 + transactions.reduce((acc, t) => acc + (t.type === 'INFLOW' ? t.amount : -t.amount), 0),
        estimatedTaxes: estimatedIS,
        recentInvoices: invoices.slice(0, 5),
        recentExpenses: expenses.slice(0, 5)
      };
      const report = await analyzeDashboardWithGemini(companyDetails.geminiApiKey || "local", dashboardData);
      setAuditReport(report);
      setActiveStep(4); // aller à l'étape finale
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
        <div className="glass-card p-8 rounded-2xl border border-slate-800 min-h-[500px] flex flex-col justify-between space-y-8 relative overflow-hidden">
          
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
                  <ReactMarkdown>{auditReport}</ReactMarkdown>
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

