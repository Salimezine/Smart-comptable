import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initKnowledgeBase, getScrapedSources } from './utils/taxKnowledge';
import { initFiscalRates } from './utils/taxAssistant';
import { initAuditRates } from './auditEngine';
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
  Lock,
  KeyRound,
  Filter,
  Send,
  Package,
  BookOpen,
  Bell,
  Users,
  Activity,
  Bot,

  Command,
  X
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
import QRCode from 'qrcode';
// jsPDF & pdfjs loaded lazily — only imported when needed by child components
const pdfWorkerSrc = window.location.pathname.startsWith('/Smart-comptable/')
  ? '/Smart-comptable/pdf.worker.min.js'
  : '/pdf.worker.min.js';
// Make pdfWorkerSrc available globally so child components can use it
window.__PDF_WORKER_SRC__ = pdfWorkerSrc;

import { 
  calculateTotalRevenues, 
  calculatePendingRevenues, 
  calculateTotalExpenses, 
  calculateEstimatedTaxes, 
  calculateInvoiceTotals, 
  formatCurrencyHelper,
  computeMonthlyChartData,
  rapprochementBancaire 
} from './accountingUtils';
import { generateInvoiceLocal } from './invoiceService';
import scanFacture, { CATEGORIES_SCE, cancelScan } from './tesseractOcr';
import { FOURNISSEURS_LOOKUP } from './utils/ocrParser';
 import { parseFactureTunisienne, generateInvoiceNumber, saveOrUpdateFournisseur, corrigerFacture, detectClientAdresse, detectClientMF } from './utils/ocrParser';
import { applyLearnedPatterns, recordCorrection, getLearningSummary, syncLearningToSupabase, loadLearningFromSupabase } from './utils/ocrLearning';
import { runFullAudit } from './auditEngine';
import { learnFromExpense, learnFromInvoice } from './learningEngine';
import { journalComptable, saveJournalPiece } from './utils/journalComptable';
import { findTierByNom, getDefaultAccounts, addTierAuto, findTierByCode } from './utils/tiersCodes';
import JournalPreview from './components/JournalPreview';
import TiersManager from './components/TiersManager';
import AccountSelect, { findLibelle } from './components/AccountSelect';
import { getDemoData } from './utils/demoData';
import AuditReportRenderer from './components/AuditReportRenderer';

import ToastProvider, { useToast } from './components/Toast';
import ConfirmProvider, { useConfirm } from './components/ConfirmModal';
import NotificationCenter from './components/NotificationCenter';

import Confetti from './components/Confetti';

// Eagerly loaded (needed on first render / login screen)
import Onboarding from './Onboarding';
import CompanySwitcher from './CompanySwitcher';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import InvitePage from './pages/InvitePage';
import PlanBadge from './components/PlanBadge';
import PermissionGuard from './components/PermissionGuard';
import OnboardingWizard from './components/OnboardingWizard';


// Lazy-loaded views — only fetched when user navigates to the tab
const FournisseursView      = React.lazy(() => import('./FournisseursView'));
const JournalView           = React.lazy(() => import('./JournalView'));
const ManualEntryView       = React.lazy(() => import('./ManualEntryView'));
const ExpenseListView       = React.lazy(() => import('./ExpenseListView'));
const FinancialReportView   = React.lazy(() => import('./FinancialReportView'));
const LettrageView          = React.lazy(() => import('./views/LettrageView'));
const FiscalDeclarationView = React.lazy(() => import('./FiscalDeclarationView'));
const PayrollView           = React.lazy(() => import('./PayrollView'));
const AuditView             = React.lazy(() => import('./AuditView'));
const AdminDashboardView    = React.lazy(() => import('./views/AdminDashboardView'));
// Premium SaaS Modules
const AITaxAssistantView    = React.lazy(() => import('./views/AITaxAssistantView'));
const SmartTVAView          = React.lazy(() => import('./views/SmartTVAView'));
const SmartIRPPView         = React.lazy(() => import('./views/SmartIRPPView'));
const SmartISView           = React.lazy(() => import('./views/SmartISView'));
const BusinessIntelligenceView = React.lazy(() => import('./views/BusinessIntelligenceView'));
const FiscalAlertCenterView = React.lazy(() => import('./views/FiscalAlertCenterView'));
const AccountingCRMView     = React.lazy(() => import('./views/AccountingCRMView'));
const ExpertAccountantPortalView = React.lazy(() => import('./views/ExpertAccountantPortalView'));
const DigitalSafeView       = React.lazy(() => import('./views/DigitalSafeView'));
const TeifDeclarationView   = React.lazy(() => import('./views/TeifDeclarationView'));
const SubmissionAuditView   = React.lazy(() => import('./views/SubmissionAuditView'));
const PlanComptableView     = React.lazy(() => import('./views/PlanComptableView'));
const SettingsView          = React.lazy(() => import('./views/SettingsView'));
const ERPStockView         = React.lazy(() => import('./views/StockView'));
const TiersView            = React.lazy(() => import('./views/TiersView'));
const AchatsView           = React.lazy(() => import('./views/AchatsView'));
const VentesView           = React.lazy(() => import('./views/VentesView'));
const DashboardView        = React.lazy(() => import('./views/DashboardView'));
const InvoicingView        = React.lazy(() => import('./views/InvoicingView'));
const WorkflowView         = React.lazy(() => import('./views/WorkflowView'));
const BankSyncView        = React.lazy(() => import('./views/BankSyncView'));
const LockScreen           = React.lazy(() => import('./views/LockScreen'));
const PinSetupScreen       = React.lazy(() => import('./views/PinSetupScreen'));
const OcrView              = React.lazy(() => import('./views/OcrView'));
const ChatView             = React.lazy(() => import('./views/ChatView'));
import { getActiveUsers, createUser, updateUser, createSociete, addMembreToSociete, useInvitation, getSocieteById } from './utils/auth/userStore';
import { can, filterModules } from './utils/auth/permissionEngine';
import { logAction, AUDIT_ACTIONS } from './utils/security/auditLog';
import { isBackupOverdue } from './utils/security/backupManager';
import { useAuth } from './hooks/useAuth';
import useRealtimeSync from './hooks/useRealtimeSync';
import useCompanyData from './hooks/useCompanyData';
import useGlobalSearch from './hooks/useGlobalSearch';
import useCommandPalette from './hooks/useCommandPalette';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts';
import { trackUsage } from './utils/auth/usageTracker';
import { fromInvoice, createPieceComptable as oldCreatePieceComptable, setTTNMode, getTTNMode } from './teif';
import { saveSimpleEntry, LIBELLES_COMPTES } from './utils/pieceComptable';
import { getJournalKey } from './utils/journalKey';
import { storeDocument } from './utils/docStore';
import { generateTEIFXML, validateTEIF as validateTEIFv2, downloadTEIFXML } from './utils/teifGenerator';
import { sendToTTN, handleTTNResponse } from './utils/ttnWorkflow';
import { updateStockFromInvoice } from './utils/stockManager';
import { supabase, isSupabaseEnabled } from './utils/supabaseClient';
import { getNonLettreCount as getNonLettreCountFn } from './utils/ecrituresStore';
import { onAuthChange, getSession } from './utils/authSupabase';
import { signUp, getProfile, getUserCompanies, createCompany as createCompanySupabase, fetchData as fetchSupabaseData, insertData as insertSupabaseData, updateData as updateSupabaseData, deleteData as deleteSupabaseData, upsertData as upsertSupabaseData, fetchCompanySettings, saveCompanySettings } from './utils/supabaseService';
import { initNetworkListener, flushOfflineQueue } from './utils/syncManager';
import { employeeToDB, bulletinToDB } from './utils/payrollStore';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isUUID(v) { return typeof v === 'string' && UUID_RE.test(v); }

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

function parseMontant(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const s = String(val).replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
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

  const ttcMatch = text.match(/(?:TTC|Total\s+TTC|Net\s+[à a]\s+payer)\s*[:\-]?\s*(?::\s*)?([\d\s.,]+\d)/i);
  if (ttcMatch) result.montant_ttc = normaliserMontant(ttcMatch[1]);

  const fodecMatch = text.match(/FODEC\s*[:\-]?\s*([\d.,]+)/i);
  if (fodecMatch) result.fodec = normaliserMontant(fodecMatch[1]) || 0;

  const timbreMatch = text.match(/[Tt]imbre\s*[:\-]?\s*([\d.,]+)/i);
  if (timbreMatch) result.timbre_fiscal = normaliserMontant(timbreMatch[1]);

  const rsMatch = text.match(/(?:Retenue|R\.?S\.?)\s*(?:[à a]\s+la\s+source)?\s*(?:\d+\s*%)?\s*[:\-]?\s*([\d.,]+)/i);
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

function AppContent() {
  const toast = useToast();
  const confirm = useConfirm();
  const [confettiActive, setConfettiActive] = useState(false);

  // Auth State
  const { currentUser, currentSociete, initializing, login, logout, can, isAdmin } = useAuth();
  const [authPage, setAuthPage] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('register') === '1') return 'register';
    if (params.get('demo') === '1') return 'demo';
    if (params.get('login') === '1') {
      // Force login page: clear any stale session first
      const clearKeys = ['sc_auth_session', 'sc_auth_session_pwd'];
      clearKeys.forEach(k => { localStorage.removeItem(k); sessionStorage.removeItem(k); });
    }
    return 'login';
  }); // login | register | invite | demo

  // Auto-trigger demo if ?demo=1
  useEffect(() => {
    if (authPage === 'demo') {
      // Clear any stale session first
      const clearKeys = ['sc_auth_session', 'sc_auth_session_pwd'];
      clearKeys.forEach(k => { localStorage.removeItem(k); sessionStorage.removeItem(k); });
      handleDemoLogin();
    }
  }, []);

  // Force clean old service worker caches on mount
  useEffect(() => {
    if ('caches' in window) {
      caches.keys().then(keys => {
        keys.forEach(key => { if (key.startsWith('workbox')) caches.delete(key); });
      });
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(reg => reg.unregister());
      });
    }
  }, []);

  // Initialize scraped data and fiscal rates on mount
  useEffect(() => {
    initKnowledgeBase();
    initFiscalRates();
    initAuditRates();
  }, []);

  // Demo is now triggered only from the "Mode démo" button on the login page

  // Navigation State
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // App States - Multi-tenant
  const [companies, setCompanies] = useState(() => {
    const stored = localStorage.getItem('smart_comptable_companies');
    if (!stored) return {};
    try { return JSON.parse(stored); } catch { return {}; }
  });

  const [currentCompanyId, setCurrentCompanyId] = useState(() => {
    return localStorage.getItem('smart_comptable_current_id') || null;
  });

  const handleLogout = () => {
    logout();
    setCompanies({});
    setCurrentCompanyId(null);
  };

  const handleCompanySwitch = (id) => {
    setCurrentCompanyId(id);
    localStorage.setItem('smart_comptable_current_id', id);
    logAction(AUDIT_ACTIONS.COMPANY_SWITCH, { to: id });
    setAdvisorModalOpen(false);
    setAdvisorReport('');
  };

  // Auth page routing
  const handleDemoLogin = async () => {
    const existingUsers = JSON.parse(localStorage.getItem('sc_users') || '{"users":[]}');
    const existingDemo = existingUsers.users?.find(u => u.email === 'demo@demo.tn') || null;
    // If demo user exists and already has a société, just log in
    if (existingDemo && existingDemo.societeId) {
      const companiesData = JSON.parse(localStorage.getItem('smart_comptable_companies') || '{}');
      if (companiesData[existingDemo.societeId]) {
        await login('demo@demo.tn', 'demo123', false);
        setCurrentCompanyId(existingDemo.societeId);
        localStorage.setItem('smart_comptable_current_id', existingDemo.societeId);
        return;
      }
    }
    // Cleanup: remove all "Démo" companies from React state AND localStorage
    const cleaned = Object.fromEntries(
      Object.entries(companies).filter(([, d]) => !d?.companyDetails?.name?.includes('Démo'))
    );
    setCompanies(cleaned);
    localStorage.setItem('smart_comptable_companies', JSON.stringify(cleaned));
    // Also clean any demo sociétés from userStore
    const store = JSON.parse(localStorage.getItem('sc_users') || '{"users":[],"societes":[]}');
    const demoIds = store.societes.filter(s => s.name && s.name.includes('Démo')).map(s => s.id);
    if (demoIds.length > 0) {
      const oldOwners = store.societes.filter(s => demoIds.includes(s.id)).map(s => s.ownerId);
      store.societes = store.societes.filter(s => !demoIds.includes(s.id));
      if (existingDemo && oldOwners.includes(existingDemo.id)) {
        existingDemo.societeId = null;
        const uIdx = store.users.findIndex(u => u.id === existingDemo.id);
        if (uIdx >= 0) store.users[uIdx].societeId = null;
      }
      localStorage.setItem('sc_users', JSON.stringify(store));
    }
    // Create or reuse demo user
    const demoUser = existingDemo || await createUser({ nom: 'Démo', prenom: 'Utilisateur', email: 'demo@demo.tn', password: 'demo123', role: 'admin', plan: 'pro' });
    if (!demoUser) { toast.error('Erreur création utilisateur démo'); return; }
    // Create new demo société
    const soc = createSociete({ nom: 'Société Démo', matriculeFiscal: 'MF0000000000', ownerId: demoUser.id, plan: 'pro' });
    updateUser(demoUser.id, { societeId: soc.id });
    const data = getDemoData();
    const newEntry = { [soc.id]: { invoices: data.invoices, expenses: data.expenses, transactions: data.transactions, companyDetails: { name: 'Société Démo' } } };
    setCompanies(prev => ({ ...prev, ...newEntry }));
    localStorage.setItem('smart_comptable_companies', JSON.stringify({ ...cleaned, ...newEntry }));
    const journalKey = `journal_entries_${soc.id}`;
    localStorage.setItem(journalKey, JSON.stringify(data.journalEntries));
    await login('demo@demo.tn', 'demo123', false);
    setCurrentCompanyId(soc.id);
    localStorage.setItem('smart_comptable_current_id', soc.id);
  };

  const handleLoginSubmit = async (email, password, remember) => {
    const user = await login(email, password, remember);
    let companyId = user?.societeId || localStorage.getItem('smart_comptable_current_id');
    const hasSupabase = isSupabaseEnabled() && navigator.onLine && user?.id && isUUID(user.id);
    // BEFORE overwriting anything, capture old data from localStorage
    const oldRaw = localStorage.getItem('smart_comptable_companies');
    let oldCompaniesData = null;
    try { oldCompaniesData = oldRaw ? JSON.parse(oldRaw) : null; } catch {}
    const oldFlatKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      for (const table of ['invoices', 'expenses', 'transactions', 'journal_entries']) {
        const prefix = table + '_';
        if (key.startsWith(prefix) && !isUUID(key.slice(prefix.length))) {
          try { oldFlatKeys.push({ key, table, data: JSON.parse(localStorage.getItem(key) || '[]') }); } catch {}
        }
      }
      if (key.startsWith('smart_journal_') && !isUUID(key.slice(14))) {
        try { oldFlatKeys.push({ key, table: 'journal_entries', data: JSON.parse(localStorage.getItem(key) || '[]') }); } catch {}
      }
      const empSuffix = key.startsWith('smart_employes_') ? key.slice(14) : null;
      if (empSuffix && (!isUUID(empSuffix) || empSuffix !== companyId)) {
        try { oldFlatKeys.push({ key, table: 'employees', data: JSON.parse(localStorage.getItem(key) || '[]') }); } catch {}
      }
      const bulSuffix = key.startsWith('smart_bulletins_') ? key.slice(15) : null;
      if (bulSuffix && (!isUUID(bulSuffix) || bulSuffix !== companyId)) {
        try { oldFlatKeys.push({ key, table: 'payroll_slips', data: JSON.parse(localStorage.getItem(key) || '[]') }); } catch {}
      }
    }
    // Create Supabase company if needed
    if (hasSupabase && (!companyId || !isUUID(companyId))) {
      try {
        let oldName = 'Ma Société';
        if (oldCompaniesData) {
          const first = Object.values(oldCompaniesData)[0];
          if (first?.name) oldName = first.name;
        }
        const soc = await createCompanySupabase({ name: oldName, owner_id: user.id, plan: user.plan || 'free' });
        if (soc) {
          companyId = soc.id;
          setCompanies(prev => {
            const updated = { ...prev, [soc.id]: { ...soc, invoices: [], expenses: [], transactions: [], companyDetails: { onboardingDone: true, name: soc.name } } };
            localStorage.setItem('smart_comptable_companies', JSON.stringify(updated));
            return updated;
          });
          setCompanyDetails({ name: soc.name });
        }
      } catch (e) { console.warn('[Login] Échec création société Supabase:', e); }
    }
    // Migrate old data to the new UUID company (runs every login)
    if (hasSupabase && companyId && isUUID(companyId)) {
      const migrated = { invoices: 0, expenses: 0, transactions: 0, journal_entries: 0 };
      const upsertBatch = async (table, items) => {
        if (!Array.isArray(items) || items.length === 0) return;
        const enriched = items.map(r => ({ ...r, id: crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`, company_id: companyId }));
        const { error } = await supabase.from(table).upsert(enriched, { onConflict: 'id' });
        if (!error) { migrated[table] += enriched.length; }
      };
      // 1. Migrate data from smart_comptable_companies (old nested non-UUID entries)
      if (oldCompaniesData) {
        for (const [oldId, oldCompany] of Object.entries(oldCompaniesData)) {
          if (isUUID(oldId)) continue;
          await upsertBatch('invoices', oldCompany.invoices);
          await upsertBatch('expenses', oldCompany.expenses);
          await upsertBatch('transactions', oldCompany.transactions);
          const jEntries = oldCompany.journal_entries || oldCompany.journal;
          await upsertBatch('journal_entries', jEntries);
        }
      }
      // 2. Migrate data from flat keys like invoices_{nonUUID}
      for (const { key, table, data } of oldFlatKeys) {
        if (!Array.isArray(data) || data.length === 0) continue;
        let enriched;
        let updatedData;
        let newKey;
        if (table === 'employees') {
          updatedData = data.map(r => { const newId = r.id && isUUID(r.id) ? r.id : crypto.randomUUID(); return { ...r, id: newId }; });
          enriched = updatedData.map(r => employeeToDB(r, companyId));
          newKey = `smart_employes_${companyId}`;
        } else if (table === 'payroll_slips') {
          updatedData = data.map(r => { const newId = r.id && isUUID(r.id) ? r.id : crypto.randomUUID(); return { ...r, id: newId }; });
          enriched = updatedData.map(r => bulletinToDB(r, companyId));
          newKey = `smart_bulletins_${companyId}`;
        } else {
          enriched = data.map(r => ({ ...r, id: crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`, company_id: companyId }));
          updatedData = null;
          newKey = key.startsWith('smart_journal_') ? `smart_journal_${companyId}` : `${table}_${companyId}`;
        }
        const { error } = await supabase.from(table).upsert(enriched, { onConflict: 'id' });
        if (!error) {
          migrated[table] += enriched.length;
          localStorage.setItem(newKey, JSON.stringify(updatedData || enriched));
          localStorage.removeItem(key);
        }
      }
      const total = Object.values(migrated).reduce((a, b) => a + b, 0);
    }
    if (companyId && isUUID(companyId)) {
      setCompanies(prev => {
        if (prev[companyId]) return prev;
        const updated = { ...prev, [companyId]: { id: companyId, name: 'Ma Société', invoices: [], expenses: [], transactions: [], companyDetails: { onboardingDone: true, name: 'Ma Société' } } };
        localStorage.setItem('smart_comptable_companies', JSON.stringify(updated));
        return updated;
      });
    }
    setCurrentCompanyId(companyId);
    if (companyId) localStorage.setItem('smart_comptable_current_id', companyId);
  };

  const handleRegister = async (data) => {
    let user;
    if (isSupabaseEnabled()) {
      const { data: authData, error } = await signUp(data.email, data.password, { nom: data.nom, prenom: data.prenom || '' });
      if (error) throw new Error(error.message || 'Erreur inscription Supabase');
      if (!authData?.user) throw new Error('Erreur création compte');
      let profile = await getProfile(authData.user.id);
      if (!profile) {
        try {
          const { data: newProfile } = await supabase.from('profiles').insert({
            id: authData.user.id, email: authData.user.email,
            nom: data.nom, prenom: data.prenom || '',
          }).select().single();
          profile = newProfile;
        } catch (e) { /* RLS may block, handled below */ }
      }
      if (!profile) throw new Error('Erreur création profil');
      user = { id: profile.id, email: profile.email, nom: profile.nom, prenom: profile.prenom, role: profile.role, plan: profile.plan, actif: true, societeId: null };
    } else {
      user = await createUser({ nom: data.nom, email: data.email, password: data.password, role: 'admin', plan: data.plan, societeId: null });
      if (!user) throw new Error('Cet email est déjà  utilisé');
    }
    const soc = await createCompanySupabase({ name: data.societeNom, matricule_fiscal: data.matriculeFiscal, owner_id: user.id, plan: data.plan });
    if (!soc) throw new Error('Erreur création société');
    const now = new Date();
    const demoInvoices = [
      { id: 'inv_1', numero: 'F-2025-001', client: 'Client SARL ABC', totalAmount: 4500, vatAmount: 855, issueDate: new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString(), status: 'PAID', category: 'services' },
      { id: 'inv_2', numero: 'F-2025-002', client: 'Client XYZ SARL', totalAmount: 3200, vatAmount: 608, issueDate: new Date(now.getFullYear(), now.getMonth() - 1, 22).toISOString(), status: 'SENT', category: 'prestations' },
      { id: 'inv_3', numero: 'F-2025-003', client: 'Fournisseur STEG', totalAmount: 1850, vatAmount: 351.5, issueDate: new Date(now.getFullYear(), now.getMonth(), 5).toISOString(), status: 'DRAFT', category: 'services' },
      { id: 'inv_4', numero: 'F-2025-004', client: 'Groupe Tunisie', totalAmount: 7200, vatAmount: 1368, issueDate: new Date(now.getFullYear(), now.getMonth(), 10).toISOString(), status: 'SENT', category: 'consulting' },
    ];
    const demoExpenses = [
      { id: 'exp_1', label: 'Électricité STEG', totalAmount: 890, date: new Date(now.getFullYear(), now.getMonth() - 1, 10).toISOString(), category: 'utilities', supplier: 'STEG' },
      { id: 'exp_2', label: 'Abonnement Internet', totalAmount: 240, date: new Date(now.getFullYear(), now.getMonth() - 1, 5).toISOString(), category: 'telecom', supplier: 'TT' },
      { id: 'exp_3', label: 'Fournitures bureau', totalAmount: 560, date: new Date(now.getFullYear(), now.getMonth(), 2).toISOString(), category: 'supplies', supplier: 'Bureau Plus' },
      { id: 'exp_4', label: 'Maintenance serveur', totalAmount: 1200, date: new Date(now.getFullYear(), now.getMonth(), 8).toISOString(), category: 'it', supplier: 'Cloud TN' },
    ];
    const demoTransactions = [
      { id: 'txn_1', label: 'Virement client ABC', amount: 4500, date: new Date(now.getFullYear(), now.getMonth() - 1, 20).toISOString(), type: 'income' },
      { id: 'txn_2', label: 'Paiement STEG', amount: -890, date: new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString(), type: 'expense' },
      { id: 'txn_3', label: 'Virement client Groupe', amount: 7200, date: new Date(now.getFullYear(), now.getMonth(), 12).toISOString(), type: 'income' },
    ];
    const socId = soc.id;
    // Strip non-UUID ids for Supabase compatibility
    const cleanForCloud = (items) => items.map(({ id, ...rest }) => rest);
    const cloudInvoices = cleanForCloud(demoInvoices);
    const cloudExpenses = cleanForCloud(demoExpenses);
    const cloudTransactions = cleanForCloud(demoTransactions);
    setCompanies(prev => ({ ...prev, [socId]: { invoices: demoInvoices, expenses: demoExpenses, transactions: demoTransactions, companyDetails: { name: soc.name } } }));
    setInvoices(demoInvoices);
    setExpenses(demoExpenses);
    setTransactions(demoTransactions);
    setCompanyDetails({ name: soc.name });
    setShowOnboarding(false);
    // Sync demo data to Supabase immediately so it's available cross-device
    if (isSupabaseEnabled() && navigator.onLine) {
      try {
        await upsertSupabaseData('invoices', socId, cloudInvoices);
        await upsertSupabaseData('expenses', socId, cloudExpenses);
        await upsertSupabaseData('transactions', socId, cloudTransactions);
      } catch (e) { /* will retry via saveData effect */ }
    }
    await login(data.email, data.password, true);
    localStorage.removeItem('smart_journal');
    setCurrentCompanyId(socId);
    localStorage.setItem('smart_comptable_current_id', socId);
  };

  const handleJoinWithInvite = async (data) => {
    const inv = useInvitation(data.code);
    if (!inv) throw new Error('Code d\'invitation invalide');
    const user = await createUser({
      nom: data.nom, email: data.email, password: data.password,
      role: inv.role, plan: 'free', societeId: inv.societeId, inviteCode: data.code
    });
    if (!user) throw new Error('Cet email est déjà  utilisé');
    addMembreToSociete(inv.societeId, user.id);
    const soc = getSocieteById(inv.societeId);
    setCompanies(prev => soc ? { ...prev, [soc.id]: prev[soc.id] || { invoices: [], expenses: [], transactions: [], companyDetails: { name: soc.nom } } } : prev);
    await login(data.email, data.password, true);
    setCurrentCompanyId(inv.societeId);
    localStorage.setItem('smart_comptable_current_id', inv.societeId);
  };

  // Data state management (invoices, expenses, sync)
  const {
    invoices, setInvoices,
    transactions, setTransactions,
    expenses, setExpenses,
    companyDetails, setCompanyDetails,
    showOnboarding, setShowOnboarding,
    piecesComptables, setPiecesComptables,
    syncVersion,
    activeCompanyRef,
  } = useCompanyData({ currentUser, currentCompanyId, setCurrentCompanyId, companies, setCompanies });
  const saveTimerRef = useRef(null);
  const savingRef = useRef(false);

  const {
    searchQuery, setSearchQuery,
    searchResults,
    searchOpen, setSearchOpen,
    searchRef,
    handleSearch,
  } = useGlobalSearch(invoices, expenses);

  const {
    commandPaletteOpen, setCommandPaletteOpen,
    commandQuery, setCommandQuery,
    commandIdx, setCommandIdx,
    commandInputRef,
    filteredCommands,
    openCommandPalette,
    closeCommandPalette,
  } = useCommandPalette();

  const { openShortcutsModal } = useKeyboardShortcuts({
    setCurrentTab,
    setSearchOpen,
    searchRef,
    openCommandPalette,
  });

  // Advisor State
  const [advisorModalOpen, setAdvisorModalOpen] = useState(false);
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorReport, setAdvisorReport] = useState('');

  // Sync remote companies when user is authenticated but local state is empty
  useEffect(() => {
    if (!currentUser || Object.keys(companies).length > 0 || !isSupabaseEnabled()) return;
    getUserCompanies(currentUser.id).then(remote => {
      if (remote.length > 0) {
        setCompanies(prev => {
          const updated = { ...prev };
          for (const c of remote) {
            if (!updated[c.id]) updated[c.id] = { ...c, invoices: [], expenses: [], transactions: [], companyDetails: { onboardingDone: true } };
          }
          localStorage.setItem('smart_comptable_companies', JSON.stringify(updated));
          return updated;
        });
        if (!currentCompanyId) {
          setCurrentCompanyId(remote[0].id);
          localStorage.setItem('smart_comptable_current_id', remote[0].id);
        }
      }
    }).catch((e) => console.warn('[sync] loadCompany failed:', e?.message));
  }, [currentUser]);

  // Supabase init + realtime subscriptions
  useRealtimeSync({ currentCompanyId, currentUser, invoices, expenses, transactions, setInvoices, setExpenses, setTransactions });

  // Auth routing
  if (initializing) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-brand-400 animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    if (authPage === 'register') return <RegisterPage onRegister={handleRegister} onBack={() => setAuthPage('login')} />;
    if (authPage === 'invite') return <InvitePage onJoin={handleJoinWithInvite} onBack={() => setAuthPage('login')} />;
    return <LoginPage onLogin={handleLoginSubmit} onNavigateRegister={() => setAuthPage('register')} onNavigateInvite={() => setAuthPage('invite')} onDemo={handleDemoLogin} />;
  }

  const handleCreateCompany = async (details) => {
    let id = `company_${Date.now()}`;
    const safeDetails = { ...details };
    
    // Nettoyer l'ancienne clé globale pour éviter la migration de données dans la nouvelle société
    localStorage.removeItem('smart_journal');
    
    // Créer dans Supabase si disponible
    if (isSupabaseEnabled() && currentUser) {
      try {
        const supabaseCompany = await createCompanySupabase({
          name: details.name || 'Ma Société',
          matricule_fiscal: details.vatNumber || '',
          adresse: details.address || '',
          owner_id: currentUser.id,
          plan: currentUser.plan || 'free'
        });
        if (supabaseCompany) id = supabaseCompany.id;
      } catch (e) { /* fallback to local */ }
    }
    
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
    setAdvisorModalOpen(false);
    setAdvisorReport('');
  };

  const handleOnboardingNavigate = (tab) => {
    setShowOnboarding(false);
    setCurrentTab(tab);
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setCompanyDetails(prev => ({ ...prev, onboardingDone: true }));
  };

  // 1. Écran Onboarding seulement en mode local (pas après connexion Supabase)
  if (currentUser && Object.keys(companies).length === 0 && !isSupabaseEnabled()) {
    return <Onboarding onComplete={handleCreateCompany} />;
  }

  // Core accounting metrics calculations using standard accounting utils
  const totalRevenues = calculateTotalRevenues(invoices);
  const pendingRevenues = calculatePendingRevenues(invoices);
  const totalExpenses = calculateTotalExpenses(expenses);
  const bankBalance = totalRevenues - totalExpenses;
  const estimatedTaxes = calculateEstimatedTaxes(totalRevenues);

  const stockTotal = (() => {
    try {
      const stockKey = currentCompanyId ? `STOCK_LOG_KEY_${currentCompanyId}` : 'STOCK_LOG_KEY';
      const entries = JSON.parse(localStorage.getItem(stockKey) || '[]');
      const map = {};
      entries.forEach(e => {
        if (!map[e.designation]) map[e.designation] = { qte: 0, total: 0 };
        map[e.designation].qte += (e.type === 'entree' ? 1 : -1) * e.quantite;
        map[e.designation].total += (e.type === 'entree' ? 1 : -1) * e.quantite * (e.prix_unitaire ?? e.prixUnitaire ?? 0);
      });
      return Object.values(map).reduce((sum, v) => sum + Math.max(v.total, 0), 0);
    } catch { return 0; }
  })();

  // Helpers
  const formatCurrency = (val) => {
    return formatCurrencyHelper(val, companyDetails.currency);
  };

  const handleAddInvoice = (newInv) => {
    learnFromInvoice(newInv);
    setInvoices([newInv, ...invoices]);
    trackUsage(currentUser?.id, 'create_invoice');
    try { updateStockFromInvoice(newInv); } catch {}
    toast.success(`Facture client ${newInv.invoiceNumber} enregistrée.`);
  };

  const handleAddExpense = (newExp) => {
    learnFromExpense(newExp);
    setExpenses([newExp, ...expenses]);
    trackUsage(currentUser?.id, 'add_expense');
    toast.success(`Dépense fournisseur ${newExp.supplier || ''} enregistrée.`);
  };

  const handleAddPieceComptable = (piece) => {
    setPiecesComptables(prev => {
      const updated = [piece, ...prev];
      const id = localStorage.getItem('smart_comptable_current_id');
      const key = id ? `piecesComptables_${id}` : 'piecesComptables';
      localStorage.setItem(key, JSON.stringify(updated));
      return updated;
    });
    toast.info(`Nouvelle pièce comptable ${piece.id} générée.`);
  };

  const handleLoadDemoData = () => {
    const journalKey = getJournalKey();
    if (JSON.parse(localStorage.getItem(journalKey) || '[]').length > 0) {
      toast.info("Les données de démonstration sont déjà  chargées.");
      return;
    }
    const data = getDemoData();
    setInvoices(data.invoices);
    setExpenses(data.expenses);
    setTransactions(data.transactions);
    for (const e of data.journalEntries) {
      saveJournalPiece(e);
    }
    setPiecesComptables(data.journalEntries.map(e => ({ id: e.id, entries: [e], locked: false })));
    toast.success("Données de démonstration chargées avec succès !");
    setConfettiActive(true);
  };

  const handleRequestAudit = () => {
    setAdvisorModalOpen(true);
    setAdvisorLoading(true);
    setAdvisorReport(null);
    try {
      const result = runFullAudit({ invoices, expenses, transactions, companyDetails });
      setAdvisorReport(result);
      trackUsage(currentUser?.id, 'run_audit');
      if (result && result.score >= 80) {
        toast.success(`Audit réussi avec un score excellent de ${result.score}/100 !`);
        setConfettiActive(true);
      } else if (result) {
        toast.warning(`Audit complété. Score : ${result.score}/100.`);
      }
    } catch (err) {
      setAdvisorReport("— Erreur lors de l'audit : " + err.message);
      toast.error("Échec de l'audit.");
    } finally {
      setAdvisorLoading(false);
    }
  };

  return (
    <div className="flex h-dvh bg-surface-800 text-slate-100 font-sans overflow-hidden relative">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar - off-canvas on mobile */}
      <aside className={`w-64 glass-panel border-r border-slate-800 flex flex-col justify-between shrink-0 z-40 transition-transform duration-300 ease-in-out lg:translate-x-0 overflow-y-auto ${
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
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-medium">comptabilité tunisienne</p>
            </div>
          </div>

          {/* Nav list */}
          <nav className="px-4 py-2 space-y-1">
            {[
              // ——— Principaux ———
              { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
              { id: 'workflow', label: 'Flux de Clôture', icon: Layers, badge: 'Workflow' },
              { id: 'invoicing', label: 'Factures Client', icon: FileText },
              { id: 'suppliers', label: 'Fournisseurs', icon: Package },
              { id: 'expenses', label: 'Dépenses', icon: TrendingDown },
              null, // separator
              { id: 'bank', label: 'Rapprochement', icon: ArrowLeftRight, badge: transactions.filter(t => t.status === 'UNRECONCILED').length || null },
              { id: 'fiscal', label: 'Déclarations', icon: Calculator, badge: 'Liasse' },
              { id: 'teif', label: 'TEIF & Télédéclaration', icon: FileText, badge: 'XML' },
              { id: 'submission_audit', label: 'Audit Soumissions', icon: Activity },
              { id: 'payroll', label: 'Paie & CNSS', icon: User },
              { id: 'audit', label: 'Audit', icon: ShieldCheck },
              { id: 'financial', label: 'Bilan & Résultat', icon: CheckCheck },
              { id: 'lettrage', label: 'Lettrage', icon: CheckCheck, badge: (() => { try { const n = getNonLettreCountFn(); return n > 0 ? n : null; } catch { return null; } })() },
              null, // separator
              { id: 'manual', label: 'Saisie Manuelle', icon: BookOpen },
              { id: 'journal', label: 'Journal Comptable', icon: BookOpen },
              { id: 'plan_comptable', label: 'Plan Comptable', icon: BookOpen },
              { id: 'tiers', label: 'Clients & Fournisseurs', icon: Users },
              { id: 'achats', label: 'Achats', icon: Package },
              { id: 'ventes', label: 'Ventes', icon: FileText },
              { id: 'stock', label: 'Stock', icon: Package },
              { id: 'ocr', label: 'Scan Reçus (IA)', icon: Scan, badge: 'New' },
              { id: 'chat', label: 'Assistant IA', icon: Sparkles, badge: 'Chat' },
              null, // separator
              // ——— Premium ———
              { id: 'ai_tax', label: 'Portail Déclarations', icon: Sparkles, badge: 'PDF' },
              { id: 'bi', label: 'Business Intelligence', icon: TrendingUp, badge: 'BI' },
              { id: 'smart_tva', label: 'TVA Intelligente', icon: Calculator },
              { id: 'smart_irpp', label: 'IRPP Intelligent', icon: TrendingUp },
              { id: 'smart_is', label: 'IS Intelligent', icon: Building },
              { id: 'alerts', label: 'Alertes Fiscales', icon: Bell },
              { id: 'crm', label: 'CRM Comptable', icon: Users },
              { id: 'portal', label: 'Portail Expert', icon: Building, badge: 'Pro' },
              { id: 'safe', label: 'Coffre-Fort', icon: ShieldCheck },
              null,
              { id: 'settings', label: 'Configuration', icon: SettingsIcon },
              { id: 'admin', label: 'Administration', icon: ShieldCheck },
            ].filter(item => {
              if (!item) return true;
              if (!currentUser) return true;
              if (item.id === 'admin') return can('manage_users');
              if (item.id === 'payroll') return can('view_all');
              if (item.id === 'audit') return can('run_audit');
              return true;
            }).map((item, idx) => {
              if (!item) return <div key={`sep-${idx}`} className="my-2 border-t border-slate-800/40" />;
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { setCurrentTab(item.id); setSidebarOpen(false); }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-300 font-medium text-sm ${
                    isActive 
                      ? 'bg-gradient-brand text-white shadow-glow' 
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
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
            onCompanyChange={handleCompanySwitch}
            onCreateCompany={handleCreateCompany}
            currentUser={currentUser}
          />
          <a href="https://salimezine.github.io/Smart-comptable/" target="_blank" rel="noopener noreferrer"
            className="w-full mt-2 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-brand-400 hover:bg-slate-800/40 transition-all duration-200">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            <span>Site public</span>
          </a>
          <button onClick={() => openShortcutsModal()}
            className="w-full mt-2 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-brand-400 hover:bg-slate-800/40 transition-all duration-200">
            <kbd className="text-[9px] font-mono bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">?</kbd>
            <span>Raccourcis clavier</span>
          </button>
          <button onClick={handleLogout} className="w-full mt-2 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-amber-400 hover:bg-slate-800/40 transition-all duration-200">
            <Lock className="w-3.5 h-3.5" />
            Verrouiller
          </button>
          <div className="flex items-center gap-3 mt-2">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
              <User className="w-5 h-5 text-slate-300" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-200 truncate">{companyDetails.name || currentSociete?.nom || 'Ma société'}</p>
              <PlanBadge user={currentUser} />
              {currentUser?.role && (
                <span className={`inline-flex items-center gap-1 mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  currentUser.role === 'admin' ? 'bg-violet-600/20 text-violet-300 border border-violet-600/30' :
                  currentUser.role === 'comptable' ? 'bg-blue-600/20 text-blue-300 border border-blue-600/30' :
                  'bg-slate-600/20 text-slate-300 border border-slate-600/30'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    currentUser.role === 'admin' ? 'bg-violet-400' :
                    currentUser.role === 'comptable' ? 'bg-blue-400' :
                    'bg-slate-400'
                  }`} />
                  {currentUser.role === 'admin' ? 'Administrateur' : currentUser.role === 'comptable' ? 'Comptable' : 'Lecteur'}
                </span>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 max-w-full bg-surface-900 overflow-y-auto">
        {/* Header */}
        <header className="h-14 lg:h-16 border-b border-slate-800/50 flex items-center justify-between px-3 sm:px-6 lg:px-8 bg-slate-950/30 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Hamburger */}
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden flex items-center gap-1 p-1.5 -ml-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/40 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
              <span className="text-[10px] font-medium text-slate-500">Menu</span>
            </button>
            {currentTab !== 'dashboard' && (
              <button onClick={() => setCurrentTab('dashboard')} className="lg:hidden flex items-center gap-1 px-2 py-1.5 text-[11px] text-brand-400 hover:text-brand-300 rounded-lg hover:bg-slate-800/40 transition-colors font-medium">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                <span>Accueil</span>
              </button>
            )}
            <div className="min-w-0">
              <h2 className="text-sm lg:text-lg font-bold tracking-tight text-white truncate">
                {currentTab === 'dashboard' && 'Tableau de bord'}
                {currentTab === 'workflow' && 'Flux de Clôture'}
                {currentTab === 'invoicing' && 'Factures de Ventes'}
                {currentTab === 'suppliers' && 'Fournisseurs'}
                {currentTab === 'expenses' && 'Dépenses'}
                {currentTab === 'tiers' && 'Clients & Fournisseurs'}
                {currentTab === 'achats' && 'Achats'}
                {currentTab === 'ventes' && 'Ventes'}
                {currentTab === 'stock' && 'Stocks'}
                {currentTab === 'manual' && 'Saisie manuelle'}
                {currentTab === 'ocr' && 'Scan Reçus (IA)'}
                {currentTab === 'chat' && 'Assistant IA'}                
                {currentTab === 'bank' && 'Rapprochement Bancaire'}
                {currentTab === 'financial' && 'Bilan & Résultat'}
                {currentTab === 'journal' && 'Journal Comptable'}
                {currentTab === 'plan_comptable' && 'Plan Comptable'}
                {currentTab === 'fiscal' && 'Déclarations fiscales'}
                {currentTab === 'payroll' && 'Paie & CNSS'}
                {currentTab === 'teif' && 'TEIF & Télédéclaration TTN'}
                {currentTab === 'submission_audit' && 'Audit des Soumissions'}
                {currentTab === 'audit' && 'Audit & Conformité'}
                {currentTab === 'settings' && 'Configuration'}
                {currentTab === 'ai_tax' && 'Portail Déclarations'}
                {currentTab === 'smart_tva' && 'TVA Intelligente'}
                {currentTab === 'smart_irpp' && 'IRPP Intelligent'}
                {currentTab === 'smart_is' && 'IS Intelligent'}
                {currentTab === 'bi' && 'Business Intelligence'}
                {currentTab === 'alerts' && 'Centre d\'Alertes'}
                {currentTab === 'crm' && 'CRM Comptable'}
                {currentTab === 'portal' && 'Portail Expert'}
                {currentTab === 'safe' && 'Coffre-Fort Numérique'}
              </h2>
              <p className="text-[10px] text-slate-500 hidden sm:block truncate">
              {currentTab === 'dashboard' && 'Santé financière et indicateurs clés.'}
              {currentTab === 'invoicing' && 'Factures clients aux normes tunisiennes.'}
              {currentTab === 'suppliers' && 'Gestion et historique des fournisseurs.'}
              {currentTab === 'tiers' && 'Clients, prospects et fournisseurs structurés.'}
              {currentTab === 'achats' && 'Bons de commande, réceptions et factures fournisseurs.'}
              {currentTab === 'ventes' && 'Devis, commandes, BL et factures clients.'}
              {currentTab === 'expenses' && 'Toutes vos dépenses enregistrées.'}
              {currentTab === 'stock' && 'Inventaire et valorisation des stocks.'}
              {currentTab === 'manual' && 'Écritures comptables manuelles.'}
              {currentTab === 'ocr' && 'Reconnaissance automatique de factures.'}
              {currentTab === 'chat' && 'Chatbot fiscal et comptable propulsé par l\'IA.'}
              {currentTab === 'bank' && 'Rapprochement des relevés bancaires.'}
              {currentTab === 'financial' && 'Bilan SCE, compte de résultat, ratios.'}
              {currentTab === 'journal' && 'Saisie et filtrage des écritures.'}
              {currentTab === 'plan_comptable' && 'PCG Tunisien — Classes 1 à 8.'}
              {currentTab === 'fiscal' && 'TVA, IS, RS — échéances et calculs.'}
              {currentTab === 'payroll' && 'Salaires, CNSS, IRPP — conforme LF 2025.'}
              {currentTab === 'teif' && 'Génération XML TEIF et soumission TTN.'}
              {currentTab === 'submission_audit' && 'Historique des envois middleware et TTN.'}
              {currentTab === 'audit' && 'Analyse complète du journal comptable.'}
              {currentTab === 'workflow' && 'Déclarations sociales et validation mensuelle.'}
              {currentTab === 'settings' && 'Données légales et configuration société.'}
              {currentTab === 'ai_tax' && 'Formulaires officiels jibaya.tn — remplissage guidé pas à pas.'}
              {currentTab === 'smart_tva' && 'Collecte, déduction et déclarations TVA.'}
              {currentTab === 'smart_irpp' && 'Simulation Impôt sur le Revenu 2025.'}
              {currentTab === 'smart_is' && 'Simulation Impôt sur les Sociétés.'}
              {currentTab === 'bi' && 'KPI, prévisions et analyses avancées.'}
              {currentTab === 'alerts' && 'Échéances fiscales et sociales.'}
              {currentTab === 'crm' && 'Clients, fournisseurs et historique.'}
              {currentTab === 'portal' && 'Supervision multi-dossiers clients.'}
              {currentTab === 'safe' && 'Archivage sécurisé de documents.'}
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

          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            {/* Back to Dashboard (when not on dashboard) */}
            {currentTab !== 'dashboard' && (
              <button
                onClick={() => setCurrentTab('dashboard')}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700/50 rounded-lg transition-all"
              >
                <LayoutDashboard className="w-3 h-3" />
                <span>Accueil</span>
              </button>
            )}
            {/* Role Badge */}
            {currentUser?.role && (
              <span className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border ${
                currentUser.role === 'admin' ? 'bg-violet-600/15 text-violet-300 border-violet-600/25' :
                currentUser.role === 'comptable' ? 'bg-blue-600/15 text-blue-300 border-blue-600/25' :
                'bg-slate-600/15 text-slate-300 border-slate-600/25'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  currentUser.role === 'admin' ? 'bg-violet-400' :
                  currentUser.role === 'comptable' ? 'bg-blue-400' :
                  'bg-slate-400'
                }`} />
                {currentUser.role === 'admin' ? 'Administrateur' : currentUser.role === 'comptable' ? 'Comptable' : 'Lecteur'}
              </span>
            )}
            {/* Notification Center */}
            <NotificationCenter invoices={invoices} expenses={expenses} onNavigate={setCurrentTab} />

            {/* Quick Actions */}
            {currentTab === 'dashboard' && (
              <button 
                onClick={handleRequestAudit} 
                className="btn btn-sm btn-ghost hidden sm:flex"
              >
                <Sparkles className="w-3 h-3" />
                Audit
              </button>
            )}

            <button 
              onClick={() => setCurrentTab('invoicing')} 
              className="btn btn-sm btn-primary"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Facture</span>
            </button>
          </div>
        </header>

        {/* Tab Switcher Body */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8">
          <React.Suspense fallback={
            <div className="max-w-7xl mx-auto space-y-4 mt-4">
              <div className="card-base p-6"><div className="skeleton skeleton-text w-1/3" /><div className="skeleton skeleton-text w-2/3 mt-3" /></div>
              <div className="card-base p-6"><div className="skeleton skeleton-chart" /></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="card-base p-6"><div className="skeleton skeleton-text w-1/2" /><div className="skeleton skeleton-text w-full mt-3" /></div><div className="card-base p-6"><div className="skeleton skeleton-text w-1/2" /><div className="skeleton skeleton-text w-full mt-3" /></div><div className="card-base p-6"><div className="skeleton skeleton-text w-1/2" /><div className="skeleton skeleton-text w-full mt-3" /></div></div>
            </div>
          }>
          <div key={currentTab} className="max-w-7xl mx-auto space-y-4 sm:space-y-6 lg:space-y-8 animate-slide-in-up">
            {currentTab === 'dashboard' && (
              <PermissionGuard module="dashboard" fallback={<div className="text-slate-400 text-center py-20">Accès refusé</div>}>
                <DashboardView 
                  totalRevenues={totalRevenues}
                  pendingRevenues={pendingRevenues}
                  totalExpenses={totalExpenses}
                  bankBalance={bankBalance}
                  estimatedTaxes={estimatedTaxes}
                  formatCurrency={formatCurrency}
                  invoices={invoices}
                  expenses={expenses}
                  companyId={currentCompanyId}
                />
              </PermissionGuard>
            )}
            {currentTab === 'invoicing' && (
              <InvoicingView 
                invoices={invoices}
                setInvoices={setInvoices}
                formatCurrency={formatCurrency}
                companyDetails={companyDetails}
                onAddPieceComptable={handleAddPieceComptable}
                setConfettiActive={setConfettiActive}
                currentUser={currentUser}
                currentCompanyId={currentCompanyId}
                companies={companies}
                setCompanies={setCompanies}
              />
            )}
            {currentTab === 'suppliers' && (
              <FournisseursView
                expenses={expenses}
                formatCurrency={formatCurrency}
                currentCompanyId={currentCompanyId}
              />
            )}
            {currentTab === 'expenses' && (
              <ExpenseListView
                expenses={expenses}
                setExpenses={setExpenses}
                formatCurrency={formatCurrency}
                currentCompanyId={currentCompanyId}
              />
            )}
            {currentTab === 'stock' && (
              <ERPStockView companyId={currentCompanyId} />
            )}
            {currentTab === 'tiers' && (
              <TiersView companyId={currentCompanyId} />
            )}
            {currentTab === 'achats' && (
              <AchatsView companyId={currentCompanyId} />
            )}
            {currentTab === 'ventes' && (
              <VentesView companyId={currentCompanyId} />
            )}
            {currentTab === 'ocr' && (
              <OcrView 
                expenses={expenses}
                invoices={invoices}
                onAddExpense={handleAddExpense}
                formatCurrency={formatCurrency}
                companyDetails={companyDetails}
                setInvoices={setInvoices}
                onAddPieceComptable={handleAddPieceComptable}
                currentUser={currentUser}
              />
            )}
            {currentTab === 'chat' && (
              <ChatView currentCompanyId={currentCompanyId} currentUser={currentUser} companyDetails={companyDetails} />
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
                currentUser={currentUser}
              />
            )}
            {currentTab === 'bank' && (
              <BankSyncView 
                transactions={transactions}
                setTransactions={setTransactions}
                invoices={invoices}
                setInvoices={setInvoices}
                expenses={expenses}
                setExpenses={setExpenses}
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
                stockTotal={stockTotal}
              />
            )}
            {currentTab === 'lettrage' && (
              <LettrageView companyId={currentCompanyId} />
            )}
            {currentTab === 'manual' && (
              <ManualEntryView
                formatCurrency={formatCurrency}
              />
            )}
            {currentTab === 'plan_comptable' && (
              <PlanComptableView />
            )}
            {currentTab === 'journal' && (
              <PermissionGuard module="journal" fallback={<div className="text-slate-400 text-center py-20">Accès refusé</div>}>
                <JournalView
                  invoices={invoices}
                  expenses={expenses}
                  transactions={transactions}
                  formatCurrency={formatCurrency}
                  currentCompanyId={currentCompanyId}
                />
              </PermissionGuard>
            )}
            {currentTab === 'teif' && (
              <TeifDeclarationView
                invoices={invoices}
                companyDetails={companyDetails}
                onAddPieceComptable={handleAddPieceComptable}
              />
            )}
            {currentTab === 'submission_audit' && (
              <SubmissionAuditView companyDetails={companyDetails} />
            )}
            {currentTab === 'fiscal' && (
              <FiscalDeclarationView
                companyDetails={companyDetails}
              />
            )}
            {currentTab === 'payroll' && (
              <PermissionGuard module="paie" fallback={<div className="text-slate-400 text-center py-20">Accès refusé</div>}>
                <PayrollView
                  companyDetails={companyDetails}
                />
              </PermissionGuard>
            )}
            {currentTab === 'audit' && (
              <PermissionGuard module="audit" fallback={<div className="text-slate-400 text-center py-20">Accès refusé</div>}>
                <AuditView
                  companyDetails={companyDetails}
                />
              </PermissionGuard>
            )}
            {currentTab === 'admin' && (
              <PermissionGuard module="admin" fallback={<div className="text-slate-400 text-center py-20">Accès refusé</div>}>
                <AdminDashboardView
                  currentUser={currentUser}
                  onLogout={handleLogout}
                />
              </PermissionGuard>
            )}
            {currentTab === 'settings' && (
              <SettingsView 
                companyDetails={companyDetails}
                setCompanyDetails={setCompanyDetails}
              />
            )}
            {currentTab === 'ai_tax' && (
              <AITaxAssistantView />
            )}
            {currentTab === 'smart_tva' && (
              <SmartTVAView
                invoices={invoices}
                expenses={expenses}
                formatCurrency={formatCurrency}
                companyDetails={companyDetails}
              />
            )}
            {currentTab === 'smart_irpp' && (
              <SmartIRPPView
                formatCurrency={formatCurrency}
              />
            )}
            {currentTab === 'smart_is' && (
              <SmartISView
                formatCurrency={formatCurrency}
                companyDetails={companyDetails}
                currentCompanyId={currentCompanyId}
              />
            )}
            {currentTab === 'bi' && (
              <BusinessIntelligenceView
                invoices={invoices}
                expenses={expenses}
                formatCurrency={formatCurrency}
              />
            )}
            {currentTab === 'alerts' && (
              <FiscalAlertCenterView />
            )}
            {currentTab === 'crm' && (
              <AccountingCRMView
                invoices={invoices}
                expenses={expenses}
                formatCurrency={formatCurrency}
              />
            )}
            {currentTab === 'portal' && (
              <ExpertAccountantPortalView
                companies={companies}
                currentCompanyId={currentCompanyId}
                onCompanyChange={handleCompanySwitch}
                formatCurrency={formatCurrency}
              />
            )}
            {currentTab === 'safe' && (
              <DigitalSafeView />
            )}
          </div>
          </React.Suspense>
        </div>
      </main>

      {showOnboarding && (
        <OnboardingWizard
          companyDetails={companyDetails}
          setCompanyDetails={setCompanyDetails}
          onComplete={handleOnboardingComplete}
          onNavigate={handleOnboardingNavigate}
        />
      )}

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
                ×
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto flex-1">
              {advisorLoading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <RefreshCw className="w-8 h-8 text-brand-400 animate-spin" />
                  <p className="text-slate-400 font-medium animate-pulse">Analyse locale de vos flux comptables en cours...</p>
                </div>
              ) : typeof advisorReport === 'string' ? (
                <p className="text-red-400 text-xs">{advisorReport}</p>
              ) : (
                <AuditReportRenderer report={advisorReport} />
              )}
            </div>
            
            <div className="p-4 border-t border-slate-800/50 bg-slate-900/50 text-center">
              <p className="text-[10px] text-slate-500">Smart Comptable n'est pas un conseiller fiscal agréé. Validez toujours vos déclarations avec un expert-comptable inscrit à  l'OECT.</p>
            </div>
          </div>
        </div>
      )}

      {/* Global Interactive Utilities */}
      {/* FAB removed per user request */}
      {/* Floating chat bubble → Assistant IA */}
      {!commandPaletteOpen && (
        <button
          onClick={() => setCurrentTab('chat')}
          title="Assistant IA"
          className="fixed bottom-5 right-5 z-40 w-13 h-13 p-3.5 rounded-full bg-gradient-to-br from-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-600 text-white shadow-lg shadow-brand-600/30 flex items-center justify-center transition-transform hover:scale-110 group"
        >
          <Bot className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border-2 border-slate-900 animate-pulse" />
        </button>
      )}

      {/* AI Assistant button removed per user request */}

      {/* Command Palette Modal */}
      {commandPaletteOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-[15vh]" onClick={closeCommandPalette}>
          <div
            className="w-full max-w-lg bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800">
              <Command className="w-4 h-4 text-brand-400" />
              <input
                ref={commandInputRef}
                type="text"
                placeholder="Chercher une page, une action..."
                value={commandQuery}
                onChange={e => { setCommandQuery(e.target.value); setCommandIdx(0); }}
                onKeyDown={e => {
                  if (e.key === 'Escape') { closeCommandPalette(); return; }
                  if (e.key === 'ArrowDown') { e.preventDefault(); setCommandIdx(i => Math.min(i + 1, filteredCommands.length - 1)); return; }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setCommandIdx(i => Math.max(i - 1, 0)); return; }
                  if (e.key === 'Enter' && filteredCommands[commandIdx]) {
                    setCurrentTab(filteredCommands[commandIdx].id);
                    closeCommandPalette();
                  }
                }}
                className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-500 focus:outline-none"
                autoFocus
              />
              <kbd className="text-[10px] font-mono text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">Esc</kbd>
            </div>
            <div className="max-h-80 overflow-y-auto p-2 space-y-0.5">
              {filteredCommands.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">Aucun résultat</p>
              ) : (
                filteredCommands.map((cmd, i) => (
                  <button
                    key={cmd.id}
                    onClick={() => { setCurrentTab(cmd.id); closeCommandPalette(); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                      i === commandIdx
                        ? 'bg-brand-500/15 text-brand-300 border border-brand-500/20'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                  >
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                      i === commandIdx ? 'bg-brand-500/20 text-brand-300' : 'bg-slate-800 text-slate-500'
                    }`}>
                      {cmd.icon === 'LayoutDashboard' && <LayoutDashboard className="w-3.5 h-3.5" />}
                      {cmd.icon === 'FileText' && <FileText className="w-3.5 h-3.5" />}
                      {cmd.icon === 'Package' && <Package className="w-3.5 h-3.5" />}
                      {cmd.icon === 'TrendingDown' && <TrendingDown className="w-3.5 h-3.5" />}
                      {cmd.icon === 'ArrowLeftRight' && <ArrowLeftRight className="w-3.5 h-3.5" />}
                      {cmd.icon === 'Calculator' && <Calculator className="w-3.5 h-3.5" />}
                      {cmd.icon === 'User' && <User className="w-3.5 h-3.5" />}
                      {cmd.icon === 'ShieldCheck' && <ShieldCheck className="w-3.5 h-3.5" />}
                      {cmd.icon === 'CheckCheck' && <CheckCheck className="w-3.5 h-3.5" />}
                      {cmd.icon === 'BookOpen' && <BookOpen className="w-3.5 h-3.5" />}
                      {cmd.icon === 'Scan' && <Scan className="w-3.5 h-3.5" />}
                      {cmd.icon === 'TrendingUp' && <TrendingUp className="w-3.5 h-3.5" />}
                      {cmd.icon === 'Building' && <Building className="w-3.5 h-3.5" />}
                      {cmd.icon === 'Bell' && <Bell className="w-3.5 h-3.5" />}
                      {cmd.icon === 'Users' && <Users className="w-3.5 h-3.5" />}
                      {cmd.icon === 'SettingsIcon' && <SettingsIcon className="w-3.5 h-3.5" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{cmd.label}</p>
                      <p className="text-[10px] text-slate-500">{cmd.category}</p>
                    </div>
                    {i === commandIdx && (
                      <kbd className="text-[10px] font-mono text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded">→</kbd>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Components extracted to views/ — see lazy imports above

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error?.message, error?.stack);
  }
  render() {
    if (this.state.error) {
      return <div className="flex items-center justify-center h-screen bg-surface-900 text-slate-400 p-8 text-center">
        <div><h2 className="text-lg font-bold text-danger-400 mb-2">Erreur inattendue</h2>
        <p className="text-sm text-slate-500 mb-4">{this.state.error?.message}</p>
        <button onClick={() => { this.setState({ error: null }); window.location.reload(); }}
          className="px-4 py-2 bg-brand-500 text-white rounded-xl text-sm">Recharger</button></div>
      </div>;
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmProvider>
          <AppContent />
        </ConfirmProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

