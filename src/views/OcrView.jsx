import React, { useState, useRef, useEffect } from 'react';
import {
  Scan, Plus, AlertCircle, CheckCircle2, RefreshCw, Upload,
  FileText, ArrowRight, BookOpen, AlertTriangle, Sparkles
} from 'lucide-react';
import scanFacture, { CATEGORIES_SCE, cancelScan } from '../tesseractOcr';
import { FOURNISSEURS_LOOKUP, getCompteChargeForSupplier, getCompteTiersForSupplier } from '../utils/ocrParser';
import { parseFactureTunisienne, generateInvoiceNumber, saveOrUpdateFournisseur, corrigerFacture, detectClientAdresse, detectClientMF } from '../utils/ocrParser';
import { applyLearnedPatterns, recordCorrection } from '../utils/ocrLearning';
import { journalComptable, saveJournalPiece } from '../utils/journalComptable';
import { findTierByNom, getDefaultAccounts, addTierAuto, updateTier, autoSuggestCompte } from '../utils/tiersCodes';
import JournalPreview from '../components/JournalPreview';
import TiersManager from '../components/TiersManager';
import AccountSelect from '../components/AccountSelect';
import { storeDocument } from '../utils/docStore';
import { generateTEIFXML } from '../utils/teifGenerator';
import { sendToTTN, handleTTNResponse } from '../utils/ttnWorkflow';
import { getTTNMode } from '../teif';
import { trackUsage } from '../utils/auth/usageTracker';
import { aiEnhanceFacture, hasChromeAI, hasOpenRouterKey, hasServerAI, getOpenRouterKey, setOpenRouterKey, describeAIEngine, getChromeAIStatus, ensureChromeAIModel, aiVerifEcriture } from '../utils/aiOcr';
import { productsStore } from '../utils/erpStore';
import { enregistrerDocument } from '../utils/saveIntegration';
import OpenRouterGuide from '../components/OpenRouterGuide';

function OcrView({ expenses, invoices = [], onAddExpense, formatCurrency, companyDetails, setInvoices, onAddPieceComptable, currentUser }) {
  const [mode, setMode] = useState('choice');
  const [activeSample, setActiveSample] = useState(null);
  const [isAiScan, setIsAiScan] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrError, setOcrError] = useState('');
  const [ocrStatus, setOcrStatus] = useState('');
  const [scannedDocument, setScannedDocument] = useState(null);

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
    compteCharge: '',
    compteTiers: '',
    compteTva: '',
    vatDetails: [],
    remise: '',
    remisePourcent: '',
  };
  const [formData, setFormData] = useState(BLANK_FORM);
  const stampDutyEdited = useRef(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showRsField, setShowRsField] = useState(false);
  const [rsRate, setRsRate] = useState('1');
  const [rsCustomRate, setRsCustomRate] = useState('');
  const [mfValid, setMfValid] = useState(null);
  const [purchaseInput, setPurchaseInput] = useState('');
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseError, setPurchaseError] = useState('');
  const [journalMessage, setJournalMessage] = useState('');
  const [ocrRawText, setOcrRawText] = useState('');
  const [typeJustificatif, setTypeJustificatif] = useState('achat');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [pendingPiece, setPendingPiece] = useState(null);
  const [ocrConfidence, setOcrConfidence] = useState(0);
  const [showTiersManager, setShowTiersManager] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [aiEnhancing, setAiEnhancing] = useState(false);
  const [aiEnhanced, setAiEnhanced] = useState(false);
  const [chromeAiAvailable, setChromeAiAvailable] = useState(typeof window !== 'undefined' && hasChromeAI());
  const [chromeAiStatus, setChromeAiStatus] = useState(chromeAiAvailable ? 'inconnu' : 'absent');
  const [orKeySet, setOrKeySet] = useState(hasOpenRouterKey());
  const [orKeyInput, setOrKeyInput] = useState(() => getOpenRouterKey());
  const [showOrKeyModal, setShowOrKeyModal] = useState(false);
  const [ocrLinesProduits, setOcrLinesProduits] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!hasChromeAI()) return;
      const st = await getChromeAIStatus();
      if (mounted) setChromeAiStatus(st);
      if (st === 'downloadable') {
        setOcrStatus('Téléchargement du modèle IA Chrome en cours (une seule fois)...');
        const after = await ensureChromeAIModel();
        if (mounted) {
          setChromeAiStatus(after);
          setChromeAiAvailable(after === 'available');
          if (after === 'available') setOcrStatus('');
          else setOcrStatus('Modèle IA non téléchargé — vérifiez votre connexion.');
        }
      }
    })();
    return () => { mounted = false; };
  }, []);

  const CATEGORIES = [
    'Télécoms & Internet', 'Énergie & Utilités', 'Fournitures de Bureau',
    'Déplacements', 'Restauration', 'Loyer & Charges', 'Salaires & Charges Sociales',
    'Matériel informatique', 'Honoraires & Conseils', 'Publicité & Marketing',
    'Assurances', 'Entretien & Réparations', 'Transports', 'Frais Bancaires',
    'Services extérieurs', 'Achats de marchandises', 'Matières premières',
    'Autres',
  ];

  const CATEGORIES_VENTE = [
    'Prestations de services', 'Ventes de marchandises', 'Produits financiers',
    'Produits divers', 'Location & Revenus immobiliers', 'Autres produits',
  ];

  const applyFormData = (data) => {
    const rsAmount = data.rsAmount != null && parseFloat(data.rsAmount) > 0 ? data.rsAmount : (data.retenue_source > 0 ? String(data.retenue_source) : '');
    if (rsAmount) {
      setShowRsField(true);
      if (data.rsRate) setRsRate(String(data.rsRate));
    }
    setFormData({
      supplier: data.supplier || '',
      matriculeFiscal: data.matriculeFiscal || '',
      date: data.date || new Date().toISOString().split('T')[0],
      subtotal: String(data.subtotal || ''),
      vatRate: (data.vatRate === 0 || data.vatRate === '0') ? '0' : String(data.vatRate || '19'),
      vatDetails: Array.isArray(data.vatDetails) ? data.vatDetails : [],
      fodec: String(data.fodec || '0.000'),
      vatAmount: String(data.vatAmount || ''),
      stampDuty: String(data.stampDuty || '1.000'),
      totalAmount: String(data.totalAmount || ''),
      category: data.category || 'Autres',
      invoiceNumber: data.invoiceNumber || '',
      rsAmount: rsAmount ? String(rsAmount) : '',
      remise: data.remise != null && data.remise !== '' ? String(data.remise) : '',
      remisePourcent: data.remisePourcent != null && data.remisePourcent !== '' ? String(data.remisePourcent) : '',
    });
  };

  const normalizeTexte = (s) => (s || '')
    .toLowerCase()
    .replace(/[àâä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o').replace(/[ùûü]/g, 'u')
    .replace(/[^a-z0-9]/g, '')
    .trim();

  const matchLigneAuxProduits = (lignes) => {
    try {
      const cid = localStorage.getItem('smart_comptable_current_id');
      if (!cid || !Array.isArray(lignes) || lignes.length === 0) return [];
      const produits = productsStore.getAll(cid);
      if (!Array.isArray(produits) || produits.length === 0) return [];
      return lignes.map(ligne => {
        const des = normalizeTexte(ligne.designation || ligne.libelle || '');
        if (!des) return { ...ligne, produit_trouve: null };
        const prefix = des.slice(0, Math.min(10, des.length));
        let best = null, bestScore = 0;
        for (const p of produits) {
          const np = normalizeTexte(p.designation || p.nom || p.reference || '');
          if (!np) continue;
          let score = 0;
          if (np.includes(des) || des.includes(np)) score = Math.max(np.length, des.length);
          else if (des.includes(prefix) && (np.includes(prefix) || prefix.includes(np))) score = prefix.length;
          if (score > bestScore) { bestScore = score; best = p; }
        }
        return { ...ligne, produit_trouve: best ? { id: best.id, designation: best.designation || best.nom || '', reference: best.reference || '' } : null };
      });
    } catch { return lignes.map(l => ({ ...l, produit_trouve: null })); }
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
    const isMixte = formData.vatRate === 'Mixte';
    if (isMixte) {
      setFormData(f => ({
        ...f,
        totalAmount: val,
        ...(stampDutyEdited.current ? {} : { stampDuty: total > 0 ? stamp.toFixed(3) : '1.000' }),
      }));
      return;
    }
    const r0 = parseFloat(formData.vatRate); const vatRate = (r0 === 0) ? 0 : (r0 || 19);

    const baseTva = (total - stamp) / (1 + vatRate / 100);
    const sub = baseTva - fodecVal;
    const vat = baseTva * (vatRate / 100);

    setFormData(f => ({
      ...f,
      totalAmount: val,
      ...(stampDutyEdited.current ? {} : { stampDuty: total > 0 ? stamp.toFixed(3) : '1.000' }),
      subtotal: (f.subtotal && total > 0) ? f.subtotal : (total > 0 ? (Math.round(sub * 1000) / 1000).toFixed(3) : ''),
      vatAmount: (f.vatAmount && total > 0) ? f.vatAmount : (total > 0 ? (Math.round(vat * 1000) / 1000).toFixed(3) : ''),
    }));
  };

  // Auto-calcul depuis le Sous-total HT
  const handleSubtotalChange = (val) => {
    const sub = parseFloat(val) || 0;
    const fodecVal = parseFloat(formData.fodec) || 0;
    if (formData.vatRate === 'Mixte') {
      setFormData(f => ({...f, subtotal: val}));
      return;
    }
    const r0 = parseFloat(formData.vatRate); const vatRate = (r0 === 0) ? 0 : (r0 || 19);
    const baseTva = sub + fodecVal;
    const vat = baseTva * (vatRate / 100);
    const amountBeforeStamp = baseTva + vat;
    const stamp = getStampDutyForAmount(amountBeforeStamp);
    const total = amountBeforeStamp + stamp;

    setFormData(f => ({
      ...f,
      subtotal: val,
      ...(stampDutyEdited.current ? {} : { stampDuty: sub > 0 ? stamp.toFixed(3) : '1.000' }),
      vatAmount: (f.vatAmount && sub > 0) ? f.vatAmount : (sub > 0 ? (Math.round(vat * 1000) / 1000).toFixed(3) : ''),
      totalAmount: (f.totalAmount && sub > 0) ? f.totalAmount : (sub > 0 ? (Math.round(total * 1000) / 1000).toFixed(3) : ''),
    }));
  };

  // Auto-calcul depuis le FODEC
  const handleFodecChange = (val) => {
    const fodecVal = parseFloat(val) || 0;
    const sub = parseFloat(formData.subtotal) || 0;
    if (formData.vatRate === 'Mixte') {
      setFormData(f => ({...f, fodec: val}));
      return;
    }
    const r0 = parseFloat(formData.vatRate); const vatRate = (r0 === 0) ? 0 : (r0 || 19);
    const baseTva = sub + fodecVal;
    const vat = baseTva * (vatRate / 100);
    const amountBeforeStamp = baseTva + vat;
    const stamp = getStampDutyForAmount(amountBeforeStamp);
    const total = amountBeforeStamp + stamp;

    setFormData(f => ({
      ...f,
      fodec: val,
      ...(stampDutyEdited.current ? {} : { stampDuty: sub > 0 ? stamp.toFixed(3) : '1.000' }),
      vatAmount: (f.vatAmount && sub > 0) ? f.vatAmount : (sub > 0 ? (Math.round(vat * 1000) / 1000).toFixed(3) : ''),
      totalAmount: (f.totalAmount && sub > 0) ? f.totalAmount : (sub > 0 ? (Math.round(total * 1000) / 1000).toFixed(3) : ''),
    }));
  };

  const EXEMPLES_TEST = [
    { name: 'STE BONJOUR — Facture avec timbre 0,600 (pré-LF2023)', data: { fournisseur: 'STE BONJOUR', date: '2023-03-15', numero_facture: 'FA20BJ001', montant_ht: 884.425, fodec: 0, base_tva: 884.425, taux_tva: 13, montant_tva: 114.975, timbre_fiscal: 0.600, retenue_source: 0, montant_ttc: 1000.000, net_a_payer: 1000.000, categorie_sce: null, code_comptable: null, devise: 'DT', flag_incoherence: false, champs_manquants: [], confidence: 100 } },
    { name: 'Ooredoo — Facture Télécom (19%)', data: { fournisseur: 'Ooredoo Tunisie', date: '2026-05-15', numero_facture: 'FAC-2026-04521', montant_ht: 132.800, fodec: 0, base_tva: 132.800, taux_tva: 19, montant_tva: 25.232, timbre_fiscal: 1.000, retenue_source: 0, montant_ttc: 159.032, net_a_payer: 159.032, categorie_sce: 'frais_telecommunication', code_comptable: '6248', devise: 'DT', flag_incoherence: false, champs_manquants: [], confidence: 95 } },
    { name: 'STEG — Facture Électricité (13%, exonéré timbre)', data: { fournisseur: 'STEG', date: '2026-04-28', numero_facture: 'FACT-2026-00312', montant_ht: 85.500, fodec: 0, base_tva: 85.500, taux_tva: 13, montant_tva: 11.115, timbre_fiscal: 0, retenue_source: 0, montant_ttc: 96.615, net_a_payer: 96.615, categorie_sce: 'frais_energie', code_comptable: '6042', devise: 'DT', flag_incoherence: false, champs_manquants: [], confidence: 95 } },
    { name: 'Monoprix — Fournitures Bureau (19%)', data: { fournisseur: 'Monoprix Tunisie', date: '2026-05-10', numero_facture: 'TKT-2026-7812', montant_ht: 45.200, fodec: 0, base_tva: 45.200, taux_tva: 19, montant_tva: 8.588, timbre_fiscal: 1.000, retenue_source: 0, montant_ttc: 54.788, net_a_payer: 54.788, categorie_sce: 'fournitures_bureau', code_comptable: '6024', devise: 'DT', flag_incoherence: false, champs_manquants: [], confidence: 95 } },
    { name: 'SONEDE — Facture Eau (0%, exonéré timbre)', data: { fournisseur: 'SONEDE', date: '2026-06-10', numero_facture: 'FA-SON-2026-1423', montant_ht: 62.300, fodec: 0, base_tva: 62.300, taux_tva: 0, montant_tva: 0, timbre_fiscal: 0, retenue_source: 0, montant_ttc: 62.300, net_a_payer: 62.300, categorie_sce: 'frais_energie', code_comptable: '6041', devise: 'DT', flag_incoherence: false, champs_manquants: [], confidence: 95 } },
    { name: 'TTN Tunisie Trade Net — Facture Internet (19%)', data: { fournisseur: 'TTN', date: '2026-06-01', numero_facture: 'FAC-2026-152260', montant_ht: 95.000, fodec: 0, base_tva: 95.000, taux_tva: 19, montant_tva: 18.050, timbre_fiscal: 1.000, retenue_source: 0, montant_ttc: 114.050, net_a_payer: 114.050, categorie_sce: 'frais_telecommunication', code_comptable: '6248', devise: 'DT', flag_incoherence: false, champs_manquants: [], confidence: 95 } },
    { name: 'SOTETEL — Prestation Services (19%, RS)', data: { fournisseur: 'SOTETEL', date: '2026-06-12', numero_facture: 'FAC-SOT-2026-089', montant_ht: 2500.000, fodec: 0, base_tva: 2500.000, taux_tva: 19, montant_tva: 475.000, timbre_fiscal: 1.000, retenue_source: 25.000, montant_ttc: 2976.000, net_a_payer: 2951.000, categorie_sce: 'prestation_service', code_comptable: '6133', devise: 'DT', flag_incoherence: false, champs_manquants: [], confidence: 95 } },
    { name: 'AMIANTE — Prestation avec FODEC 1% (19%)', data: { fournisseur: 'AMIANTE', date: '2026-05-20', numero_facture: 'FACT-2026-331', montant_ht: 3200.000, fodec: 32.000, base_tva: 3232.000, taux_tva: 19, montant_tva: 614.080, timbre_fiscal: 1.000, retenue_source: 0, montant_ttc: 3847.080, net_a_payer: 3847.080, categorie_sce: 'prestation_service', code_comptable: '6133', devise: 'DT', flag_incoherence: false, champs_manquants: [], confidence: 95 } },
    { name: 'BIAT — Frais Bancaires (19%, RS 10%)', data: { fournisseur: 'BIAT', date: '2026-06-05', numero_facture: 'EXT-2026-5841', montant_ht: 120.000, fodec: 0, base_tva: 120.000, taux_tva: 19, montant_tva: 22.800, timbre_fiscal: 1.000, retenue_source: 12.000, montant_ttc: 143.800, net_a_payer: 131.800, categorie_sce: 'frais_bancaires', code_comptable: '6311', devise: 'DT', flag_incoherence: false, champs_manquants: [], confidence: 95 } },
    { name: 'Tunisair — Billet Avion (0% TVA)', data: { fournisseur: 'Tunisair', date: '2026-06-08', numero_facture: 'TKT-2026-45821', montant_ht: 450.000, fodec: 0, base_tva: 450.000, taux_tva: 0, montant_tva: 0, timbre_fiscal: 0, retenue_source: 0, montant_ttc: 450.000, net_a_payer: 450.000, categorie_sce: 'frais_transport', code_comptable: '6251', devise: 'DT', flag_incoherence: false, champs_manquants: [], confidence: 95 } },
    { name: 'Délice Danone — Alimentaire (19%)', data: { fournisseur: 'Délice Danone', date: '2026-06-02', numero_facture: 'FAC-2026-1024', montant_ht: 180.500, fodec: 0, base_tva: 180.500, taux_tva: 19, montant_tva: 34.295, timbre_fiscal: 1.000, retenue_source: 0, montant_ttc: 215.795, net_a_payer: 215.795, categorie_sce: 'fournitures_bureau', code_comptable: '6021', devise: 'DT', flag_incoherence: false, champs_manquants: [], confidence: 95 } },
    { name: 'SOTRACO — Travaux Construction (19%)', data: { fournisseur: 'SOTRACO', date: '2026-05-28', numero_facture: 'FAC-SOTRA-2026-56', montant_ht: 5600.000, fodec: 0, base_tva: 5600.000, taux_tva: 19, montant_tva: 1064.000, timbre_fiscal: 1.000, retenue_source: 56.000, montant_ttc: 6665.000, net_a_payer: 6609.000, categorie_sce: 'travaux_construction', code_comptable: '6125', devise: 'DT', flag_incoherence: false, champs_manquants: [], confidence: 95 } },
    { name: 'La Poste Tunisienne — Frais Postaux (0%)', data: { fournisseur: 'La Poste Tunisienne', date: '2026-06-15', numero_facture: 'REC-2026-789', montant_ht: 25.000, fodec: 0, base_tva: 25.000, taux_tva: 0, montant_tva: 0, timbre_fiscal: 1.000, retenue_source: 0, montant_ttc: 26.000, net_a_payer: 26.000, categorie_sce: 'frais_postaux', code_comptable: '6262', devise: 'DT', flag_incoherence: false, champs_manquants: [], confidence: 95 } },
    { name: 'Vermego — Prestation Dev Web (19%, RS 1%)', data: { fournisseur: 'Vermego', date: '2026-06-18', numero_facture: 'FACT-2026-003', montant_ht: 1200.000, fodec: 0, base_tva: 1200.000, taux_tva: 19, montant_tva: 228.000, timbre_fiscal: 1.000, retenue_source: 14.290, montant_ttc: 1429.000, net_a_payer: 1414.710, categorie_sce: 'prestation_service', code_comptable: '6133', devise: 'DT', flag_incoherence: false, champs_manquants: [], confidence: 95 } },
  ];

  function ocrToFormData(r) {
    const fmt = (v) => v != null ? parseFloat(v).toFixed(3) : '';
    const f = r.formulaire || r;
    const catLabel = f.categorie_sce && CATEGORIES_SCE[f.categorie_sce]
      ? CATEGORIES_SCE[f.categorie_sce].label
      : (f.categorie_principale || f.categorie_sce || 'Autres');
    const type = f.type || 'achat';
    const client = f.client || '';
    return {
      type,
      client,
      supplier: type === 'vente' && client ? client : (f.fournisseur_nom || f.fournisseur || ''),
      matriculeFiscal: type === 'vente' ? '' : (f.fournisseur_mf || f.matricule_fiscal || ''),
      date: f.date_facture ? f.date_facture.split('/').reverse().join('-') : (f.date || new Date().toISOString().split('T')[0]),
      subtotal: fmt(f.montant_ht),
      vatRate: (f.taux_tva === 0 || f.taux_tva === '0') ? '0' : String(f.taux_tva || '19'),
      vatDetails: f.taux_tva_details || [],
      fodec: fmt(f.fodec),
      vatAmount: fmt(f.montant_tva),
      stampDuty: fmt(f.timbre_fiscal),
      totalAmount: fmt(f.montant_ttc),
      category: catLabel,
      invoiceNumber: f.numero_justificatif || f.numero_facture || '',
      rsAmount: f.rs_montant > 0 ? fmt(f.rs_montant) : (f.retenue_source > 0 ? fmt(f.retenue_source) : ''),
      rsRate: f.rs_taux > 0 ? String(f.rs_taux) : '',
    };
  }

  function corrigeToFormData(c) {
    const fmt = (v) => v != null ? parseFloat(v).toFixed(3) : '';
    const rs = parseFloat(c.rs_montant) > 0 ? parseFloat(c.rs_montant) : (c.retenue_source > 0 ? parseFloat(c.retenue_source) : 0);
    return {
      supplier: c.fournisseur || '',
      matriculeFiscal: c.matricule_fiscal || '',
      date: c.date ? c.date.split('/').reverse().join('-') : new Date().toISOString().split('T')[0],
      subtotal: fmt(c.sous_total_ht),
      vatRate: (c.taux_tva === 0 || c.taux_tva === '0%') ? '0' : (c.taux_tva || '19').replace('%', ''),
      vatDetails: c.taux_tva_details || [],
      fodec: fmt(c.fodec),
      vatAmount: fmt(c.montant_tva),
      stampDuty: fmt(c.timbre),
      totalAmount: fmt(c.total_ttc),
      category: c.categorie || 'Autres',
      invoiceNumber: c.numero_justificatif || '',
      rsAmount: rs > 0 ? fmt(rs) : '',
      rsRate: parseFloat(c.rs_taux) > 0 ? String(parseFloat(c.rs_taux)) : '',
      remise: c.remise != null && c.remise > 0 ? String(c.remise) : '',
      remisePourcent: c.remise_pourcent != null && c.remise_pourcent > 0 ? String(c.remise_pourcent) : '',
    };
  }

  const enhanceWithAI = async (rawText, currentFormData, cat, imageDataUrl) => {
    if (!rawText || rawText.trim().length < 20) return null;
    setAiEnhancing(true);
    setAiEnhanced(false);
    try {
      const currentFormulaire = {
        fournisseur_nom: currentFormData?.supplier || '',
        fournisseur_mf: currentFormData?.matriculeFiscal || '',
        date_facture: currentFormData?.date ? currentFormData.date.split('-').reverse().join('/') : '',
        numero_facture: currentFormData?.invoiceNumber || '',
        montant_ht: parseFloat(currentFormData?.subtotal) || 0,
        taux_tva: parseFloat(currentFormData?.vatRate) || 0,
        montant_tva: parseFloat(currentFormData?.vatAmount) || 0,
        timbre_fiscal: parseFloat(currentFormData?.stampDuty) || 0,
        fodec: parseFloat(currentFormData?.fodec) || 0,
        montant_ttc: parseFloat(currentFormData?.totalAmount) || 0,
        retenue_source: parseFloat(currentFormData?.rsAmount) || 0,
        type: typeJustificatif,
        categorie_sce: cat || null,
      };
      const enhanced = await aiEnhanceFacture(rawText, currentFormulaire, { imageDataUrl });
      if (enhanced) {
        setAiEnhanced(true);
        return enhanced;
      }
      if (!hasChromeAI() && !hasOpenRouterKey() && !hasServerAI()) {
        setPurchaseError('⚠️ IA indisponible : aucune clé détectée et l\'IA de votre navigateur (Chrome) est absente. Ajoutez une clé OpenRouter gratuite pour la correction automatique.');
      }
      return null;
    } catch (err) {
      console.warn('AI enhance failed:', err.message);
      setPurchaseError('⚠️ IA: ' + (err.message || 'erreur inconnue'));
      return null;
    } finally {
      setAiEnhancing(false);
    }
  };

  const applyAIResult = (enhanced, rawText) => {
    if (!enhanced) return;
    const mf = enhanced.fournisseur_mf || formData.matriculeFiscal || '';
    const catLabel = enhanced.categorie_sce && CATEGORIES_SCE[enhanced.categorie_sce]
      ? CATEGORIES_SCE[enhanced.categorie_sce].label
      : (enhanced.categorie || formData.category || 'Autres');
    const isVente = enhanced.type === 'vente' || typeJustificatif === 'vente';
    const rsAI = parseFloat(enhanced.rs_montant) > 0 ? parseFloat(enhanced.rs_montant) : (parseFloat(enhanced.retenue_source) > 0 ? parseFloat(enhanced.retenue_source) : 0);
    if (rsAI > 0) setShowRsField(true);
    // HT net après remise : si l'IA renvoie le HT brut + remise, on retranche la remise.
    // On tranche grâce à la cohérence TTC ≈ HT + TVA + timbre + fodec.
    const aiRemise = parseFloat(enhanced.remise) || 0;
    let subtotalVal = enhanced.montant_ht != null && enhanced.montant_ht !== '' ? parseFloat(enhanced.montant_ht) : parseFloat(f.subtotal) || 0;
    if (aiRemise > 0 && subtotalVal > 0) {
      const tvaAi = parseFloat(enhanced.montant_tva) || 0;
      const timbreAi = parseFloat(enhanced.timbre_fiscal) || 0;
      const fodecAi = parseFloat(enhanced.fodec) || 0;
      const ttcAi = parseFloat(enhanced.montant_ttc) || 0;
      const avecRemise = subtotalVal - aiRemise;
      if (ttcAi > 0) {
        const attenduNet = ttcAi - tvaAi - timbreAi - fodecAi;
        const grosCoherent = Math.abs(ttcAi - (subtotalVal + tvaAi + timbreAi + fodecAi)) < 0.050;
        const netCoherent = Math.abs(ttcAi - (avecRemise + tvaAi + timbreAi + fodecAi)) < 0.050;
        if (grosCoherent && !netCoherent) subtotalVal = avecRemise;
        else if (!grosCoherent && netCoherent) subtotalVal = avecRemise;
        else if (Math.abs(attenduNet - avecRemise) < Math.abs(attenduNet - subtotalVal)) subtotalVal = avecRemise;
      } else {
        subtotalVal = avecRemise;
      }
    }
    setFormData(f => ({
      ...f,
      supplier: enhanced.fournisseur_nom || f.supplier,
      matriculeFiscal: mf,
      date: enhanced.date_facture ? enhanced.date_facture.split('/').reverse().join('-') : f.date,
      invoiceNumber: enhanced.numero_facture || f.invoiceNumber,
      subtotal: subtotalVal > 0 ? String(subtotalVal) : f.subtotal,
      vatRate: (enhanced.taux_tva === 0 || enhanced.taux_tva === '0') ? '0' : String(enhanced.taux_tva || f.vatRate),
      vatDetails: Array.isArray(enhanced.taux_tva_details) && enhanced.taux_tva_details.length > 0
        ? enhanced.taux_tva_details
        : f.vatDetails,
      vatAmount: enhanced.montant_tva ? String(enhanced.montant_tva) : f.vatAmount,
      stampDuty: enhanced.timbre_fiscal ? String(enhanced.timbre_fiscal) : f.stampDuty,
      fodec: enhanced.fodec ? String(enhanced.fodec) : f.fodec,
      totalAmount: enhanced.montant_ttc ? String(enhanced.montant_ttc) : f.totalAmount,
      category: catLabel,
      rsAmount: rsAI > 0 ? String(rsAI) : f.rsAmount,
      remise: (enhanced.remise != null && parseFloat(enhanced.remise) > 0) ? String(enhanced.remise) : f.remise,
      remisePourcent: (enhanced.remise_pourcent != null && parseFloat(enhanced.remise_pourcent) > 0) ? String(enhanced.remise_pourcent) : f.remisePourcent,
    }));
    if (rsAI > 0 && enhanced.rs_taux > 0) setRsRate(String(enhanced.rs_taux));
    if (enhanced.lignes && enhanced.lignes.length > 0) {
      window.__aiLignes = enhanced.lignes;
      setOcrLinesProduits(matchLigneAuxProduits(enhanced.lignes));
    }
    setTypeJustificatif(isVente ? 'vente' : 'achat');
    setOcrRawText(rawText);
    setMode('result');
  };

  const handleAIEnhance = async () => {
    if (!ocrRawText) return;
    const enhanced = await enhanceWithAI(ocrRawText, formData);
    if (enhanced) applyAIResult(enhanced, ocrRawText);
  };

  const handleStartScan = (sample) => {
    setActiveSample(sample);
    setIsAiScan(false);
    setOcrProgress(0);
    setMode('scanning');
    setTimeout(() => {
      const formData = ocrToFormData(sample.data);
      applyFormData(formData);
      if (formData.type === 'vente') setTypeJustificatif('vente');
      else if (formData.type === 'achat') setTypeJustificatif('achat');
      setMode('result');
    }, 1800);
  };

  const handleFileScan = async (file) => {
    try {
      if (file && file.size > 10 * 1024 * 1024) {
        setOcrError('Fichier trop volumineux — limite 10 Mo');
        setMode('choice');
        return;
      }
      setOcrProgress(0);
      setOcrError('');
      setOcrStatus('');
      setPurchaseError('');
      setIsAiScan(true);
      setMode('scanning');

      let imageData = file;
      const isPdfFile = file?.type === 'application/pdf' || /\.pdf$/i.test(file?.name || '');
      let directParsed = null;

      if (isPdfFile) {
        setOcrProgress(10);
        setOcrStatus('Extraction texte PDF...');

        const arrayBuffer = await file.arrayBuffer();

        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = window.__PDF_WORKER_SRC__ || '/pdf.worker.min.js';
        const pdfDoc = await Promise.race([
          pdfjsLib.getDocument({ data: arrayBuffer }).promise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout 15s — échec chargement PDF')), 15000))
        ]);
        const page = await pdfDoc.getPage(1);

        const textContent = await page.getTextContent();
        let lastY = -1;
        let directText = '';
        for (const item of textContent.items) {
          const y = Math.round(item.transform[5]);
          if (lastY >= 0 && y < lastY - 2) {
            directText += '\n';
          } else if (lastY >= 0 && y === lastY) {
            directText += ' ';
          } else if (lastY >= 0) {
            directText += '\n';
          }
          directText += item.str;
          lastY = y;
        }
        directText = directText.trim();

        if (directText.length >= 10) {
          setOcrProgress(50);
          setOcrStatus('Texte extrait du PDF ✓');
          const pRaw = parseFactureTunisienne(directText, 100);
          const p = applyLearnedPatterns(directText, pRaw);
          if (p && !p.erreur) {
            directParsed = p;
            directParsed.rawText = directText;
          } else {
            directParsed = { rawText: directText, formulaire: {}, champs_manquants: ['all'], alerte: 'non_parse', confiance_ocr: 0 };
          }

          const vp = page.getViewport({ scale: 2.5 });
          const cv = document.createElement('canvas');
          cv.width = vp.width; cv.height = vp.height;
          await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
          const bl = await new Promise((resolve, reject) => {
            cv.toBlob(b => {
              if (b) resolve(b); else reject(new Error('toBlob null — canvas tainted?'));
            }, 'image/png');
          });
          imageData = new File([bl], 'page1.png', { type: 'image/png' });
          setOcrProgress(65);
        }

        if (!directParsed) {
          setOcrStatus('Conversion PDF en image...');
          const viewport = page.getViewport({ scale: 2.5 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({
            canvasContext: canvas.getContext('2d'),
            viewport
          }).promise;

          const blob = await new Promise((res, rej) => {
            canvas.toBlob(b => { b ? res(b) : rej(new Error('Échec conversion PNG')); }, 'image/png');
          });
          imageData = new File([blob], 'page1.png', { type: 'image/png' });
          setOcrProgress(25);
        }
      }

      const rawResult = directParsed || await scanFacture(imageData, (pct, status) => {
        setOcrProgress(25 + Math.round(pct * 0.75));
        if (status) setOcrStatus(status);
      });
      const result = rawResult?.rawText ? applyLearnedPatterns(rawResult.rawText, rawResult) : rawResult;
      window.__ocrLastResult = result;
      setOcrConfidence(result?.confiance_ocr || 0);

      if (result?.error) {
        setOcrError(result.error);
        setIsAiScan(false);
        setMode('choice');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setScannedDocument(reader.result);
      };
      const imageForAI = imageData instanceof File
        ? await new Promise((res) => {
            const r = new FileReader();
            r.onloadend = () => res(r.result || null);
            r.readAsDataURL(imageData);
          })
        : (typeof imageData === 'string' && imageData.startsWith('data:') ? imageData : null);
      reader.readAsDataURL(imageData instanceof File ? imageData : new File([imageData], 'scan.png', { type: 'image/png' }));

      const rawText = result?.rawText || '';
      if (result?.alerte === 'document_non_facture') {
        setOcrRawText(rawText);
        setPurchaseError(result.message || 'Ce document ne semble pas être une facture. Vérifiez les champs avant d\'enregistrer.');
        setMode('choice');
        return;
      }
      if (result?.alerte === 'non_parse') {
        setPurchaseError('Texte extrait du PDF mais non parsé automatiquement — remplissez les champs manuellement.');
      }
      const resultScan = result?.rawText ? corrigerFacture(result.formulaire || {}, result.rawText) : null;
      if (resultScan) {
        applyFormData(corrigeToFormData(resultScan));
        setOcrRawText(result.rawText);
        if (resultScan.type === 'vente') setTypeJustificatif('vente');
        else if (resultScan.type === 'achat') setTypeJustificatif('achat');
      } else {
        const fd = ocrToFormData(result);
        applyFormData(fd);
        if (fd.type === 'vente') setTypeJustificatif('vente');
        else if (fd.type === 'achat') setTypeJustificatif('achat');
        setOcrRawText(rawText);
      }
      const detectedType = result.formulaire?.type === 'vente' ? 'vente' : (result.formulaire?.type === 'achat' ? 'achat' : null);
      if (detectedType) setTypeJustificatif(detectedType);
      if (detectedType === 'vente' && result.formulaire?.client) {
        const addr = detectClientAdresse(result.rawText || rawText);
        const mfClient = detectClientMF(result.rawText || rawText);
        setFormData(f => ({...f, supplier: result.formulaire.client, matriculeFiscal: mfClient, clientAddress: addr}));
        if (addr) setClientAddress(addr);
        if (mfClient) setMfValid(null);
      } else if (detectedType === 'vente') {
        setFormData(f => ({...f, matriculeFiscal: ''}));
      }
      setOcrProgress(100);
      setMode('result');
      if (result?.faible_confiance || result?.alerte === 'faible_confiance') {
        setPurchaseError('⚠️ Certains champs n\'ont pas été reconnus automatiquement — vérifiez et corrigez les données ci-dessous.');
      }
      try { trackUsage(currentUser?.id, 'scan_ocr'); } catch (_) { /* ignorer */ }

      // Amélioration IA automatique (gratuite via OpenRouter/Chrome, sans clé requise si Chrome)
      if (rawText) {
        setOcrStatus('Amélioration IA en cours...');
        const currentForm = { ...formData };
        const enhanced = await enhanceWithAI(rawText, currentForm, result.formulaire?.categorie_sce, imageForAI);
        if (enhanced) {
          applyAIResult(enhanced, rawText);
        }
      }

    } catch (err) {
      setOcrError(`Erreur: ${err.message}`);
      setIsAiScan(false);
    }
  };

  // Générer écriture comptable depuis le JSON corrigé
  const runJournalPipeline = (locked) => {
    if (!ocrRawText && !formData.supplier) return null;
    try {
      const raw = ocrRawText || '';
      const useCorriger = raw.trim().length > 10;
      let parsedRawCorrige = null;
      let corrige = {
        fournisseur: formData.supplier,
        matricule_fiscal: formData.matriculeFiscal,
        date: formData.date ? formData.date.split('-').reverse().join('/') : '',
        numero_justificatif: formData.invoiceNumber,
        categorie: formData.category,
        taux_tva: formData.vatRate === 'Mixte' ? 'Mixte' : formData.vatRate + '%',
        taux_tva_details: formData.vatRate === 'Mixte' && Array.isArray(formData.vatDetails) ? formData.vatDetails : [],
        sous_total_ht: parseFloat(formData.subtotal) || 0,
        montant_tva: parseFloat(formData.vatAmount) || 0,
        timbre: parseFloat(formData.stampDuty) || 0,
        fodec: parseFloat(formData.fodec) || 0,
        total_ttc: parseFloat(formData.totalAmount) || 0,
        retenue_source: !!formData.rsAmount,
        alertes: [],
        notes: [],
        lignes: [],
      };
      if (useCorriger) {
        const parsedRaw = corrigerFacture({}, raw);
        parsedRawCorrige = parsedRaw;
        if (!corrige.matricule_fiscal && parsedRaw.matricule_fiscal) corrige.matricule_fiscal = parsedRaw.matricule_fiscal;
        if (!corrige.numero_justificatif && parsedRaw.numero_justificatif) corrige.numero_justificatif = parsedRaw.numero_justificatif;
        if (!corrige.date && parsedRaw.date) corrige.date = parsedRaw.date;
        if ((!corrige.sous_total_ht) && parsedRaw.sous_total_ht) corrige.sous_total_ht = parsedRaw.sous_total_ht;
        if ((!corrige.montant_tva) && parsedRaw.montant_tva) corrige.montant_tva = parsedRaw.montant_tva;
        if ((!corrige.total_ttc) && parsedRaw.total_ttc) corrige.total_ttc = parsedRaw.total_ttc;
        if (corrige.timbre <= 0 && parsedRaw.timbre > 0) corrige.timbre = parsedRaw.timbre;
        if (corrige.taux_tva_details.length === 0 && Array.isArray(parsedRaw.taux_tva_details) && parsedRaw.taux_tva_details.length > 0) {
          corrige.taux_tva_details = parsedRaw.taux_tva_details;
        }
      }
      // Override RS from form (user may have adjusted)
      if (parseFloat(formData.rsAmount) > 0) {
        corrige.retenue_source = true;
        corrige.rs_montant = parseFloat(formData.rsAmount) || 0;
        corrige.rs_taux = rsRate === 'other' ? (parseFloat(rsCustomRate) || 1) : (parseFloat(rsRate) || 1);
      }
      if (import.meta.env.DEV) console.log('runJournalPipeline corrige:', JSON.stringify(corrige, null, 2));
      const piece = journalComptable(corrige, {
        type: typeJustificatif === 'achat' ? 'achat' : 'vente',
        fournisseurNom: formData.supplier || 'Fournisseur',
        datePiece: formData.date,
      });
      if (!piece.validated) {
        setPurchaseError('⚠️ ' + (piece.error || 'Erreur génération écriture'));
        return null;
      }
      const saved = saveJournalPiece(piece, locked ? { locked: true } : {});
      if (saved) {
        // Intégration : tiers + stock automatique
        try {
          const cid = localStorage.getItem('smart_comptable_current_id');
          const lignesDoc = (parsedRawCorrige?.lignes || corrige.lignes || window.__aiLignes || []).map(l => ({
            designation: l.designation || l.libelle || '',
            quantite: l.quantite || 1,
            prix_unitaire_ht: l.prix_unitaire || l.prix_unitaire_ht || l.pu_ht || 0,
            taux_tva: l.tva || l.taux_tva || 19,
          }));
          enregistrerDocument(cid, {
            type: typeJustificatif === 'achat' ? 'achat' : 'vente',
            fournisseur: formData.supplier,
            mf: formData.matriculeFiscal || '',
            date: formData.date,
            numero: formData.invoiceNumber || piece.id,
            categorie: formData.category,
            total_ht: parseFloat(formData.subtotal) || 0,
            total_tva: parseFloat(formData.vatAmount) || 0,
            total_ttc: parseFloat(formData.totalAmount) || 0,
            timbre: parseFloat(formData.stampDuty) || 0,
            fodec: parseFloat(formData.fodec) || 0,
            lignes: lignesDoc,
            faireJournal: false,
            faireStock: typeJustificatif === 'vente' || lignesDoc.length > 0,
          });
        } catch (_) { /* silencieux */ }
        if (scannedDocument) storeDocument(piece.id, scannedDocument);
        if (scannedDocument && piece.piece_justificative && piece.piece_justificative !== piece.id) {
          storeDocument(piece.piece_justificative, scannedDocument);
        }
        setPurchaseError('');
        setJournalMessage(`Écriture ${piece.id} enregistrée dans le journal ${piece.journal}`);
        return piece;
      }
      return null;
    } catch (err) {
      setPurchaseError('⚠️ Erreur écriture: ' + err.message);
      return null;
    }
  };

  const generatePreviewPiece = () => {
    if (!formData.supplier) return null;
    try {
      const raw = ocrRawText || '';
      const useCorriger = raw.trim().length > 10;
      let corrige = {
        fournisseur: formData.supplier,
        matricule_fiscal: formData.matriculeFiscal,
        date: formData.date ? formData.date.split('-').reverse().join('/') : '',
        numero_justificatif: formData.invoiceNumber,
        categorie: formData.category,
        taux_tva: formData.vatRate === 'Mixte' ? 'Mixte' : formData.vatRate + '%',
        taux_tva_details: formData.vatRate === 'Mixte' && Array.isArray(formData.vatDetails) ? formData.vatDetails : [],
        sous_total_ht: parseFloat(formData.subtotal) || 0,
        montant_tva: parseFloat(formData.vatAmount) || 0,
        timbre: parseFloat(formData.stampDuty) || 0,
        fodec: parseFloat(formData.fodec) || 0,
        total_ttc: parseFloat(formData.totalAmount) || 0,
        retenue_source: !!formData.rsAmount,
        remise: parseFloat(formData.remise) || 0,
        remise_pourcent: parseFloat(formData.remisePourcent) || 0,
        alertes: [],
        notes: [],
        lignes: [],
      };
      if (useCorriger) {
        const parsedRaw = corrigerFacture({}, raw);
        if (!corrige.matricule_fiscal && parsedRaw.matricule_fiscal) corrige.matricule_fiscal = parsedRaw.matricule_fiscal;
        if (!corrige.numero_justificatif && parsedRaw.numero_justificatif) corrige.numero_justificatif = parsedRaw.numero_justificatif;
        if (!corrige.date && parsedRaw.date) corrige.date = parsedRaw.date;
        if ((!corrige.sous_total_ht) && parsedRaw.sous_total_ht) corrige.sous_total_ht = parsedRaw.sous_total_ht;
        if ((!corrige.montant_tva) && parsedRaw.montant_tva) corrige.montant_tva = parsedRaw.montant_tva;
        if ((!corrige.total_ttc) && parsedRaw.total_ttc) corrige.total_ttc = parsedRaw.total_ttc;
        if (corrige.timbre <= 0 && parsedRaw.timbre > 0) corrige.timbre = parsedRaw.timbre;
        if (corrige.remise <= 0 && parsedRaw.remise > 0) {
          corrige.remise = parsedRaw.remise;
          corrige.remise_pourcent = parsedRaw.remise_pourcent || 0;
        }
        if (corrige.taux_tva_details.length === 0 && Array.isArray(parsedRaw.taux_tva_details) && parsedRaw.taux_tva_details.length > 0) {
          corrige.taux_tva_details = parsedRaw.taux_tva_details;
        }
      }
      if (parseFloat(formData.rsAmount) > 0) {
        corrige.retenue_source = true;
        corrige.rs_montant = parseFloat(formData.rsAmount) || 0;
        corrige.rs_taux = rsRate === 'other' ? (parseFloat(rsCustomRate) || 1) : (parseFloat(rsRate) || 1);
      }
      const defaults = getDefaultAccounts(formData.supplier);
      if (defaults) {
        Object.assign(corrige, defaults);
      }
      const piece = journalComptable(corrige, {
        type: typeJustificatif === 'achat' ? 'achat' : 'vente',
        fournisseurNom: formData.supplier || 'Fournisseur',
        datePiece: formData.date,
      });
      const tier = findTierByNom(formData.supplier);
      if (piece) {
        piece._ocrConfidence = ocrConfidence || (ocrRawText ? 85 : 100);
        piece._tier = tier ? { code: tier.code, nom: tier.nom } : null;
        if (formData.compteCharge || formData.compteTiers || formData.compteTva) {
          piece.lignes = piece.lignes.map(l => {
            const updated = { ...l };
            if (formData.compteCharge && l.compte && l.compte.startsWith('6') && l.debit && l.debit > 0) {
              updated.compte = formData.compteCharge;
              updated.libelle = formData.compteCharge;
            }
            if (formData.compteTiers && l.compte && (l.compte.startsWith('401') || l.compte.startsWith('411')) && l.credit && l.credit > 0) {
              updated.compte = formData.compteTiers;
              updated.libelle = formData.compteTiers;
            }
            if (formData.compteTva && l.compte && l.compte.startsWith('436')) {
              updated.compte = formData.compteTva;
              updated.libelle = formData.compteTva;
            }
            return updated;
          });
        }
      }
      return piece;
    } catch (err) {
      setPurchaseError('⚠️ Erreur génération écriture: ' + err.message);
      return null;
    }
  };

  const acceptPiece = (piece) => {
    const saved = saveJournalPiece(piece, { locked: false });
    if (saved) {
      if (scannedDocument) storeDocument(piece.id, scannedDocument);
      if (scannedDocument && piece.piece_justificative && piece.piece_justificative !== piece.id) {
        storeDocument(piece.piece_justificative, scannedDocument);
      }
      setPendingPiece(null);
      setPurchaseError('');
      setJournalMessage(`Écriture ${piece.id} enregistrée dans le journal ${piece.journal}`);
      setFormData(BLANK_FORM);
      setOcrRawText('');
      setShowRsField(false);
      setRsRate('1');
      setRsCustomRate('');
      setMfValid(null);
      setClientEmail('');
      setClientAddress('');
      setScannedDocument(null);
      setMode('success');
      setActiveSample(null);
    }
  };

  const verifEcritureAvecIA = async (piece) => {
    if (!piece || !ocrRawText) return;
    if (!(hasOpenRouterKey() || hasChromeAI() || hasServerAI())) return;
    setOcrStatus('Vérification IA de l\'écriture...');
    try {
      const lignes = await aiVerifEcriture(piece, ocrRawText, scannedDocument || undefined);
      if (lignes && lignes.length > 0) {
        setPendingPiece(prev => prev ? { ...prev, lignes: prev.lignes.map((l, i) => lignes[i] ? { ...l, ...lignes[i] } : l) } : prev);
        setJournalMessage('✏️ Écriture corrigée par l\'IA — vérifiez puis enregistrez.');
      }
    } catch (_) { /* silencieux */ }
    setOcrStatus('');
  };

  const handleGenererEcriture = () => {
    const piece = generatePreviewPiece();
    if (piece) {
      setPendingPiece(piece);
      setMode('preview');
      verifEcritureAvecIA(piece);
    }
  };

  // Enregistrer la dépense
  const handleConfirmExpense = async (e) => {
    e.preventDefault();
    const inv = {
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
    };
    onAddExpense(inv);
    saveOrUpdateFournisseur(formData.supplier, {
      matriculeFiscal: formData.matriculeFiscal,
      date: formData.date,
      totalAmount: formData.totalAmount,
    });
    try {
      const teifInvoice = {
        id: inv.invoiceNumber || inv.id,
        dateEmission: inv.date,
        type: '380',
        timbre: inv.stampDuty || 0,
        fournisseur: { matriculeFiscal: inv.matriculeFiscal || '', nom: inv.supplier || '' },
        client: { matriculeFiscal: companyDetails.vatNumber || companyDetails.matriculeFiscal || '', nom: companyDetails.companyName || companyDetails.name || '' },
        lignes: [{ designation: inv.category || 'Charge', quantite: 1, prixUnitaireHT: inv.subtotal || 0, tauxTVA: (()=>{const r=parseFloat(inv.vatRate);return r===0?0:r||19})() }],
      };
      const gen = generateTEIFXML(teifInvoice);
      if (!gen.error) {
        const response = await sendToTTN(gen.xml, { ttnMode: getTTNMode() });
        if (response.status === 'accepted') await handleTTNResponse(teifInvoice, response);
      }
    } catch (e) {
      console.warn('TEIF auto-generation skipped:', e.message);
    }
    // Journal entry via pipeline (verrouillée après acceptation)
    runJournalPipeline(true);
    setScannedDocument(null);
    setMode('success');
    setFormData(BLANK_FORM);
    setActiveSample(null);
  };

  const handleLancerTraitement = () => {
    if (!purchaseInput.trim()) return;
    setPurchaseLoading(true);
    setPurchaseError('');

    try {
      const rawText = purchaseInput;
      const parsedRaw = parseFactureTunisienne(rawText);
      const parsed = applyLearnedPatterns(rawText, parsedRaw);

      if (!parsed || parsed.erreur) {
        setPurchaseError(parsed?.erreur === 'PDF_DETECTE'
          ? '⚠️ Fichier PDF détecté — veuillez utiliser la fonction "Scanner une facture" au lieu de coller le texte brut'
          : 'Erreur de parsing — vérifiez le format du texte');
        setPurchaseLoading(false);
        return;
      }

      // Auto-set typeJustificatif from OCR detection
      const detectedType = parsed.formulaire?.type === 'vente' ? 'vente' : (parsed.formulaire?.type === 'achat' ? 'achat' : null);
      if (detectedType) setTypeJustificatif(detectedType);

      // Appliquer corrigerFacture(parsed, texteOCR)
      const corrige = corrigerFacture(parsed.formulaire || {}, rawText);

      // Recherche produit dans le catalogue (lignes article OCR → produits)
      setOcrLinesProduits(matchLigneAuxProduits(corrige.lignes || []));

      // Mapper les valeurs corrigées vers le formulaire
      applyFormData(corrigeToFormData(corrige));
      // For vente, override supplier with the actual client name + details
      if (detectedType === 'vente' && parsed.formulaire?.client) {
        const addr = detectClientAdresse(rawText);
        const mfClient = detectClientMF(rawText);
        setFormData(f => ({...f, supplier: parsed.formulaire.client, matriculeFiscal: mfClient, clientAddress: addr}));
        if (addr) setClientAddress(addr);
        if (mfClient) setMfValid(null);
      } else if (detectedType === 'vente') {
        setFormData(f => ({...f, matriculeFiscal: ''}));
      }

      // Afficher les alertes si présentes
      if (corrige.alertes && corrige.alertes.length > 0) {
        setPurchaseError('⚠️ ' + corrige.alertes.join(', '));
      }

      setPurchaseLoading(false);
      setIsAiScan(true);
      setOcrRawText(rawText);
      setMode('result');
    } catch (err) {
      setPurchaseError('Erreur de parsing — vérifiez le format du texte');
      setPurchaseLoading(false);
    }
  };

   // Formulaire partagé (saisie manuelle + résultat scan)
  const renderEntryForm = (isManual) => {
    const sub = parseFloat(formData.subtotal) || 0;
    const isMixteTva = formData.vatRate === 'Mixte';
    const r0 = parseFloat(formData.vatRate); const rate = isMixteTva ? 0 : ((r0 === 0) ? 0 : (r0 || 19));
    const fodecVal = parseFloat(formData.fodec) || 0;
    const stamp = parseFloat(formData.stampDuty) || 1;
    const rsVal = parseFloat(formData.rsAmount) || 0;
    const baseCalc = sub + fodecVal;
    const tvaCalc = isMixteTva
      ? (parseFloat(formData.vatAmount) || 0)
      : (baseCalc > 0 ? parseFloat((baseCalc * rate / 100).toFixed(3)) : 0);
    const ttcCalc = isMixteTva
      ? (parseFloat(formData.totalAmount) || 0)
      : (baseCalc > 0 ? parseFloat((baseCalc + tvaCalc + stamp).toFixed(3)) : 0);
    const netCalc = ttcCalc > 0 ? parseFloat((ttcCalc - rsVal).toFixed(3)) : 0;

    const isAchat = typeJustificatif === 'achat';
    const isVente = typeJustificatif === 'vente';

    const fournisseurInput = formData.supplier || '';
    const lowerInput = fournisseurInput.toLowerCase();
    const suggestions = fournisseurInput.length >= 2
      ? Object.entries(FOURNISSEURS_LOOKUP)
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
      setOcrRawText('');
      setShowRsField(false);
      setRsRate('1');
      setMfValid(null);
      setClientEmail('');
      setClientAddress('');
      setJournalMessage('');
      setPurchaseError('');
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (requiredMissing.length > 0) return;

      // Vérification TVA avant validation (skip pour TVA mixte : taux multiples)
      const ht = parseFloat(formData.subtotal) || 0;
      const tvaSaisie = parseFloat(formData.vatAmount) || 0;
      const isMixteTvaSubmit = formData.vatRate === 'Mixte';
      const r0 = parseFloat(formData.vatRate); const taux = (r0 === 0) ? 0 : (r0 || 19);
      if (!isMixteTvaSubmit && ht > 0 && tvaSaisie > 0) {
        const tvaCalculee = parseFloat((ht * taux / 100).toFixed(3));
        if (Math.abs(tvaCalculee - tvaSaisie) > 0.010) {
          setPurchaseError(`⚠️ TVA incohérente: ${tvaSaisie} DT saisie ≠ ${tvaCalculee} DT calculée (${ht} × ${taux}%)`);
        }
      }

      let ttnCreatedEntry = false;
      if (isAchat) {
        const inv = {
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
        };
        onAddExpense(inv);
        saveOrUpdateFournisseur(formData.supplier, {
          matriculeFiscal: formData.matriculeFiscal,
          date: formData.date,
          totalAmount: formData.totalAmount,
        });
        try {
          const teifInvoice = {
            id: inv.invoiceNumber || inv.id,
            dateEmission: inv.date,
            type: '380',
            timbre: inv.stampDuty || 0,
            fournisseur: { matriculeFiscal: inv.matriculeFiscal || '', nom: inv.supplier || '' },
            client: { matriculeFiscal: companyDetails.vatNumber || companyDetails.matriculeFiscal || '', nom: companyDetails.companyName || companyDetails.name || '' },
        lignes: [{ designation: inv.category || 'Charge', quantite: 1, prixUnitaireHT: inv.subtotal || 0, tauxTVA: (()=>{const r=parseFloat(inv.vatRate);return r===0?0:r||19})() }],
          };
          const gen = generateTEIFXML(teifInvoice);
          if (!gen.error) {
            const response = await sendToTTN(gen.xml, { ttnMode: getTTNMode() });
            if (response.status === 'accepted') {
              await handleTTNResponse(teifInvoice, response);
              ttnCreatedEntry = true;
            }
          }
        } catch (e) {
          console.warn('TEIF auto-generation skipped:', e.message);
        }
      } else {
        const newInvoice = {
          id: `inv-${Date.now()}`,
          invoiceNumber: formData.invoiceNumber || generateInvoiceNumber(invoices),
          clientName: formData.supplier,
          clientEmail: formData.clientEmail || clientEmail,
          issueDate: formData.date,
          dueDate: formData.date ? new Date(new Date(formData.date).getTime() + 30*86400000).toISOString().split('T')[0] : '',
          subtotal: parseFloat(formData.subtotal) || 0,
          vatAmount: parseFloat(formData.vatAmount) || 0,
          totalAmount: parseFloat(formData.totalAmount) || 0,
          status: "SENT",
          items: [{ id: Date.now(), description: formData.category || 'Prestation', quantity: 1, unitPrice: parseFloat(formData.subtotal) || 0, vatRate: (()=>{const r=parseFloat(formData.vatRate);return r===0?0:r||19})() }]
        };
        if (typeof setInvoices === 'function') {
          setInvoices(prev => [newInvoice, ...prev]);
        }
      }

      // Enregistrer les corrections OCR
      if (ocrRawText) {
        recordCorrection(ocrRawText, formData.supplier, 'fournisseur_nom', formData.supplier);
        if (formData.stampDuty) recordCorrection(ocrRawText, formData.supplier, 'timbre_fiscal', formData.stampDuty);
        if (formData.vatRate) recordCorrection(ocrRawText, formData.supplier, 'taux_tva', formData.vatRate);
        if (formData.category) recordCorrection(ocrRawText, formData.supplier, 'categorie', formData.category);
      }

      // TTN a déjà créé l'écriture → pas de preview
      if (ttnCreatedEntry) {
        setMode('success');
        resetForm();
        setActiveSample(null);
        return;
      }

      // Générer la preview de l'écriture comptable
      const piece = generatePreviewPiece();
      if (piece) {
        if (piece.validated) {
          setPendingPiece(piece);
          setMode('preview');
          verifEcritureAvecIA(piece);
        } else {
          setPurchaseError('⚠️ ' + (piece.error || 'Erreur génération écriture'));
        }
      }
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

      {/* Debug OCR — texte brut */}
      {!isManual && ocrRawText && (
        <details className="group">
          <summary className="text-[10px] text-slate-500 cursor-pointer hover:text-slate-300 select-none flex items-center gap-1.5 py-1">
            <span className="opacity-50 group-open:opacity-100">▶</span> Texte OCR brut ({ocrRawText.length} car.)
          </summary>
          <pre className="mt-2 p-3 bg-slate-950 border border-slate-800 rounded-xl text-[10px] text-slate-400 font-mono leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap">{ocrRawText}</pre>
        </details>
      )}

      {/* Alertes OCR */}
      {purchaseError && (
        <div className="p-2.5 bg-danger-500/10 border border-danger-500/30 rounded-xl text-[10px] text-danger-400 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {purchaseError}
        </div>
      )}
      {journalMessage && (
        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-[10px] text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {journalMessage}
        </div>
      )}

      {/* TVA récupérable + contrôles */}
      {!isManual && ocrRawText && (
        (() => {
          try {
            const parsed = JSON.parse(JSON.stringify(window.__ocrLastResult || {}));
            const tvaRecup = parsed?.formulaire?.tva_recuperable;
            const verif = parsed?.verification;
            const tvaMismatch = verif?.tva_mismatch;
            return (
              <div className="space-y-1.5">
                {tvaRecup && (
                  <div className={`p-2 rounded-lg text-[10px] font-semibold flex items-center gap-2 ${tvaRecup.recuperable ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'}`}>
                    {tvaRecup.recuperable ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                    TVA {tvaRecup.recuperable ? 'récupérable' : 'non récupérable'} — {tvaRecup.raison}
                    {tvaRecup.taux_recuperation < 1 && <span className="ml-1 opacity-70">({Math.round(tvaRecup.taux_recuperation * 100)}%)</span>}
                  </div>
                )}
                {tvaMismatch && (
                  <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-[10px] text-red-400 font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3" />
                    ⚠️ TVA détectée ≠ TVA calculée — vérifiez le taux et les montants avant validation
                  </div>
                )}
              </div>
            );
          } catch { return null; }
        })()
      )}

      {/* Type de justificatif — sélection manuelle */}
      <div className="flex gap-2">
        <button type="button" onClick={() => { setTypeJustificatif('achat'); }}
          className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all
            ${isAchat ? 'bg-violet-600 text-white border border-violet-400 shadow-lg shadow-violet-600/20' : 'bg-slate-800 text-slate-400 border border-slate-600 hover:border-slate-500'}`}
        >
          <span className="text-base">🧾</span> Facture Achat
          <span className="text-[9px] opacity-70">Fournisseur</span>
        </button>
        <button type="button" onClick={() => { setTypeJustificatif('vente'); }}
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
                    const cpteCharge = getCompteChargeForSupplier(label);
                    const cpteTiers = getCompteTiersForSupplier(label, isAchat ? 'achat' : 'vente');
                    setFormData(f => ({...f, supplier: label, vatRate: String(info.tva || '19'), category: cat, stampDuty: stampVal, compteCharge: cpteCharge, compteTiers: cpteTiers}));
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">Taux TVA</label>
            <select value={formData.vatRate}
              onChange={(e) => {
                if (e.target.value === 'Mixte') {
                  setFormData(f => ({...f, vatRate: 'Mixte'}));
                  return;
                }
                const r = parseFloat(e.target.value); const effectiveRate = (r === 0) ? 0 : (r || 19);
                const fodecVal = parseFloat(formData.fodec) || 0;
                const baseTva = sub + fodecVal;
                const vat = baseTva * (effectiveRate / 100);
                const newStamp = getStampDutyForAmount(baseTva + vat);
                setFormData(f => ({...f, vatRate: e.target.value,
                  vatAmount: sub > 0 ? (Math.round(vat*1000)/1000).toFixed(3) : '',
                  ...(stampDutyEdited.current ? {} : { stampDuty: sub > 0 ? newStamp.toFixed(3) : '1.000' }),
                  totalAmount: sub > 0 ? (Math.round((sub+fodecVal+vat+newStamp)*1000)/1000).toFixed(3) : ''
                }));
              }}
              className="w-full bg-slate-950 border border-slate-700 focus:border-brand-500 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none"
            >
              <option value="19">19%</option>
              <option value="13">13%</option>
              <option value="12">12%</option>
              <option value="7">7%</option>
              <option value="0">0%</option>
              <option value="Mixte">Mixte (plusieurs taux)</option>
            </select>
            {formData.vatRate === 'Mixte' && Array.isArray(formData.vatDetails) && formData.vatDetails.length > 0 && (
              <div className="mt-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-2 py-1.5 text-[10px] text-amber-300">
                <div className="font-bold mb-0.5">Détail par taux détecté :</div>
                {formData.vatDetails.map((d, i) => (
                  <div key={i} className="flex justify-between opacity-90">
                    <span>TVA {d.taux}% — base {parseFloat(d.base_ht).toFixed(3)} DT</span>
                    <span>{parseFloat(d.montant_tva).toFixed(3)} DT</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase" title="Loi de finances 2023 : 1 DT forfaitaire">
              Timbre Fiscal ⓘ
            </label>
            <input type="number" step="0.001" min="0" value={formData.stampDuty}
              onChange={(e) => setFormData(f => ({...f, stampDuty: e.target.value}))}
              className="w-full bg-slate-950 border border-slate-700 focus:border-brand-500 rounded-xl px-3 py-2 text-brand-300 text-sm focus:outline-none"
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

        {/* RS */}
        <div className="flex items-center gap-3 pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showRsField}
              onChange={(e) => {
                const checked = e.target.checked;
                setShowRsField(checked);
                if (!checked) {
                  setFormData(f => ({...f, rsAmount: ''}));
                } else if (ttcCalc > 0) {
                  const taux = rsRate === 'other' ? (parseFloat(rsCustomRate) || 1) : (parseFloat(rsRate) || 1);
                  const autoRs = parseFloat((ttcCalc * taux / 100).toFixed(3));
                  setFormData(f => ({...f, rsAmount: String(autoRs)}));
                }
              }}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-[10px] text-slate-400 font-bold uppercase">Retenue à la source applicable</span>
          </label>
        </div>
        {showRsField && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-in">
            <div>
              <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">Taux RS</label>
              <select value={rsRate} onChange={(e) => {
                const newRate = e.target.value;
                setRsRate(newRate);
                if (newRate !== 'other' && ttcCalc > 0) {
                  const autoRs = parseFloat((ttcCalc * parseFloat(newRate) / 100).toFixed(3));
                  setFormData(f => ({...f, rsAmount: String(autoRs)}));
                }
              }}
                className="w-full bg-slate-950 border border-slate-700 focus:border-brand-500 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none"
              >
                <option value="1">1% — Achats ≥ 1 000 DT (L17)</option>
                <option value="3">3% — Personne morale / Honoraires PM (L6)</option>
                <option value="10">10% — Personne physique (L4)</option>
                <option value="15">15% — Prestations / Non-résidents (L14/L4b)</option>
                <option value="other">Autre taux...</option>
              </select>
              {rsRate === 'other' && (
                <input type="number" step="0.1" min="0" placeholder="Taux personnalisé"
                  value={rsCustomRate || ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRsCustomRate(v);
                    const pct = parseFloat(v);
                    if (pct > 0 && ttcCalc > 0) {
                      const autoRs = parseFloat((ttcCalc * pct / 100).toFixed(3));
                      setFormData(f => ({...f, rsAmount: String(autoRs)}));
                    }
                  }}
                  className="w-full mt-1 bg-slate-950 border border-brand-500/40 focus:border-brand-400 rounded-xl px-3 py-2 text-slate-100 text-xs focus:outline-none"
                />
              )}
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">Montant RS (DT)</label>
              <input type="number" step="0.001" min="0" placeholder="0.000" value={formData.rsAmount || ''}
                onChange={(e) => setFormData(f => ({...f, rsAmount: e.target.value}))}
                className="w-full bg-slate-950 border border-orange-500/40 focus:border-orange-400 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none"
              />
            </div>
            <div className="flex items-end">
              <p className="text-[10px] text-orange-400 font-bold pb-2">{isAchat ? 'Net à payer' : 'Net à recevoir'}: {netCalc.toFixed(3)} DT</p>
            </div>
          </div>
        )}

        <p className="text-[9px] text-slate-500 mt-1">Saisissez le Total TTC ou le Sous-total HT pour mettre à jour les calculs.</p>
      </div>

      {/* Lignes article → recherche produit dans le catalogue */}
      {!isManual && ocrLinesProduits.length > 0 && (
        <div className="p-3 rounded-xl border border-slate-700/50 bg-slate-900/40">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
            <FileText className="w-3 h-3" /> Lignes détectées — produits trouvés ({ocrLinesProduits.length})
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left text-slate-500 font-medium pb-1.5 pr-2">Désignation OCR</th>
                  <th className="text-left text-slate-500 font-medium pb-1.5 pr-2">Qté</th>
                  <th className="text-right text-slate-500 font-medium pb-1.5 pr-2">PU HT</th>
                  <th className="text-right text-slate-500 font-medium pb-1.5">Total</th>
                  <th className="text-left text-slate-500 font-medium pb-1.5 pl-2">Produit catalogue</th>
                </tr>
              </thead>
              <tbody>
                {ocrLinesProduits.map((l, i) => (
                  <tr key={i} className="border-b border-slate-800/40">
                    <td className="py-1.5 pr-2 text-slate-300">{l.designation || l.libelle || ''}</td>
                    <td className="py-1.5 pr-2 text-slate-400 font-mono">{l.quantite ?? '—'}</td>
                    <td className="py-1.5 pr-2 text-right text-slate-400 font-mono">{(l.prix_unitaire || l.prix_unitaire_ht || 0).toFixed(3)}</td>
                    <td className="py-1.5 text-right text-slate-300 font-mono">{(l.total || l.montant_ht || 0).toFixed(3)}</td>
                    <td className="py-1.5 pl-2">
                      {l.produit_trouve ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" /> {l.produit_trouve.designation || l.produit_trouve.reference}
                        </span>
                      ) : (
                        <span className="text-slate-600">Aucun produit</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[9px] text-slate-600 mt-1.5">Les produits correspondent aux articles du catalogue stock. Modifiez-les dans l'onglet Stock si nécessaire.</p>
        </div>
      )}

      {/* Résumé visuel */}
      {(sub > 0 || parseFloat(formData.totalAmount) > 0) && (
        <div className={`p-4 rounded-xl border space-y-1.5 ${isAchat ? 'bg-slate-900/80 border-slate-700/50' : 'bg-emerald-900/20 border-emerald-700/30'}`}>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-400">HT</span>
            <span className="text-slate-200 font-mono">{sub.toFixed(3)} DT</span>
          </div>
          {formData.remise && parseFloat(formData.remise) > 0 && (
            <div className="flex justify-between text-[11px]">
              <span className="text-amber-400">Remise {formData.remisePourcent ? `(${formData.remisePourcent}%)` : ''}</span>
              <span className="text-amber-400 font-mono">− {parseFloat(formData.remise).toFixed(3)} DT</span>
            </div>
          )}
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

      {/* Section Comptes — visible toujours dans le formulaire */}
      {(formData.compteCharge || formData.compteTiers || formData.compteTva || pendingPiece) && (
        <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-900/40 space-y-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <BookOpen className="w-3 h-3" /> Comptes SCE — laissez vide pour auto
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[10px]">
            <div>
              <label className="block text-slate-500 font-bold mb-1">Compte de charge</label>
              <AccountSelect value={formData.compteCharge} onChange={v => setFormData(f => ({...f, compteCharge: v}))} />
            </div>
            <div>
              <label className="block text-slate-500 font-bold mb-1">Compte tiers</label>
              <AccountSelect value={formData.compteTiers} onChange={v => setFormData(f => ({...f, compteTiers: v}))} />
            </div>
            <div>
              <label className="block text-slate-500 font-bold mb-1">Compte TVA</label>
              <AccountSelect value={formData.compteTva} onChange={v => setFormData(f => ({...f, compteTva: v}))} />
            </div>
          </div>
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
        {mode === 'result' && (
          <button type="button" onClick={handleGenererEcriture}
            className="flex-1 py-2.5 border border-amber-600/40 hover:bg-amber-600/10 text-amber-400 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5">
            <BookOpen className="w-4 h-4" /> Écriture
          </button>
        )}
        {mode === 'result' && (
          <button type="button" onClick={handleAIEnhance} disabled={aiEnhancing || !ocrRawText}
            className={`flex-1 py-2.5 border rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${aiEnhanced
              ? 'border-accent-500/60 bg-accent-500/10 text-accent-400'
              : 'border-accent-500/40 hover:bg-accent-500/10 text-accent-300'}`}>
            {aiEnhancing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {aiEnhancing ? 'IA...' : aiEnhanced ? 'IA ✓' : 'IA Améliorer'}
          </button>
        )}
        <button type="submit" disabled={requiredMissing.length > 0}
          className={`flex-[2] py-2.5 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-glow transition-all flex items-center justify-center gap-1.5 ${isAchat ? 'bg-gradient-brand hover:opacity-90' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
          <CheckCircle2 className="w-4 h-4" /> {isAchat ? 'Enregistrer la dépense' : 'Enregistrer la vente'}
        </button>
      </div>
    </form>
  );};

  return (
    <div className="space-y-6">
      {(!companyDetails?.vatNumber || companyDetails.vatNumber.trim() === '') && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <p className="text-xs text-amber-400 font-medium">
            ⚠️ Matricule Fiscal non configuré. Allez dans <strong>Configuration</strong> pour définir votre MF avant de générer les TEIF.
          </p>
        </div>
      )}
      {/* Bannière OCR local */}
      <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Scan className="w-4 h-4 text-indigo-400 shrink-0" />
          <p className="text-xs text-slate-300">
            <strong className="text-indigo-400">OCR Local actif.</strong>{' '}
            Tesseract.js lit vos factures dans le navigateur, puis l'IA{' '}
            <strong className="text-accent-400">{describeAIEngine()}</strong>{' '}
            corrige les champs automatiquement.
            {chromeAiAvailable && chromeAiStatus === 'downloading' && (
              <span className="block text-[10px] text-indigo-300 mt-1">⏳ Modèle IA Chrome en cours de téléchargement...</span>
            )}
            {chromeAiStatus === 'downloadable' && (
              <span className="block text-[10px] text-amber-400 mt-1">⚠️ Modèle IA Chrome à télécharger — il se lancera au premier scan.</span>
            )}
            {chromeAiStatus === 'unavailable' && (
              <span className="block text-[10px] text-danger-400 mt-1">⛔ IA Chrome bloquée par votre navigateur (désactivée ou version trop ancienne).</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasServerAI() ? (
            <span className="text-[10px] font-bold text-accent-400 border border-accent-500/30 px-2 py-1 rounded-lg bg-accent-500/10 whitespace-nowrap flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> IA auto
            </span>
          ) : !orKeySet && (
            <button type="button" onClick={() => setShowOrKeyModal(true)}
              className="text-[10px] font-bold text-amber-400 border border-amber-500/40 px-2 py-1 rounded-lg bg-amber-500/10 whitespace-nowrap hover:bg-amber-500/20 transition-colors flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> Clé OpenRouter
            </button>
          )}
          {aiEnhancing && (
            <span className="text-[10px] font-bold text-accent-400 border border-accent-500/30 px-2 py-1 rounded-lg bg-accent-500/10 whitespace-nowrap flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3 animate-spin" /> IA...
            </span>
          )}
          {!aiEnhancing && aiEnhanced && (
            <span className="text-[10px] font-bold text-accent-400 border border-accent-500/30 px-2 py-1 rounded-lg bg-accent-500/10 whitespace-nowrap flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> IA ✓
            </span>
          )}
          {!aiEnhancing && !aiEnhanced && (
            <span className="text-[10px] font-bold text-indigo-400 border border-indigo-500/30 px-2 py-1 rounded-lg bg-indigo-500/10 whitespace-nowrap">
              Tesseract.js
            </span>
          )}
        </div>
      </div>

      {/* Config clé OpenRouter */}
      {showOrKeyModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-extrabold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent-400" /> IA gratuite (OpenRouter)
              </h3>
              <button type="button" onClick={() => setShowOrKeyModal(false)}
                className="text-slate-500 hover:text-slate-300 text-xs">✕</button>
            </div>
            <p className="text-[10px] text-slate-400 mb-3 leading-relaxed">
              Collez votre clé <strong className="text-slate-200">OpenRouter</strong> pour utiliser{' '}
              <strong className="text-accent-400">des modèles IA gratuits</strong> (coût $0, aucune carte bancaire).
              Elle reste stockée uniquement sur votre appareil.
            </p>
            <input
              type="password"
              placeholder="sk-or-v1-..."
              value={orKeyInput}
              onChange={(e) => setOrKeyInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 focus:border-accent-500 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none mb-3 font-mono"
            />
            <div className="mb-3">
              <OpenRouterGuide />
            </div>
            <div className="flex gap-2">
              <button type="button"
                onClick={() => { setOpenRouterKey(orKeyInput); setOrKeySet(!!orKeyInput.trim()); setShowOrKeyModal(false); setAiEnhanced(false); }}
                disabled={!orKeyInput.trim()}
                className="flex-1 py-2.5 bg-accent-500/20 hover:bg-accent-500/30 text-accent-300 text-xs font-bold rounded-xl border border-accent-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                Enregistrer
              </button>
              {orKeySet && (
                <button type="button"
                  onClick={() => { setOpenRouterKey(''); setOrKeySet(false); setOrKeyInput(''); }}
                  className="px-4 py-2.5 border border-danger-500/40 hover:bg-danger-500/10 text-danger-400 text-xs font-bold rounded-xl transition-all">
                  Supprimer
                </button>
              )}
            </div>
            {!orKeySet && (
              <button type="button" onClick={() => { setShowOrKeyModal(false); setAiEnhanced(false); }}
                className="mt-2 w-full py-2 text-[10px] text-slate-500 hover:text-slate-300 underline">
                Continuer sans clé (IA Chrome locale si disponible)
              </button>
            )}
            {!orKeySet && !chromeAiAvailable && (
              <div className="mt-3 p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
                <p className="text-[10px] text-indigo-300 leading-relaxed">
                  <strong>Option 100% gratuite sans clé :</strong> activez l'IA de Chrome.
                  Dans Chrome, tapez <span className="font-mono text-indigo-200">chrome://flags</span> dans la barre d'adresse,
                  activez <span className="font-mono text-indigo-200">Prompt API for Gemini Nano</span> et{' '}
                  <span className="font-mono text-indigo-200">Enabling optimization guide on device</span>,
                  relancez Chrome. Ensuite cette app l'utilise automatiquement, sans clé, sans compte.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {ocrError && (
        <div className="p-3 bg-danger-500/10 border border-danger-500/30 rounded-xl text-xs text-danger-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {ocrError}
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
          <div className={`relative border-2 border-dashed rounded-2xl transition-all group ${isDragOver ? 'border-indigo-400 bg-indigo-500/10' : 'border-slate-700 hover:border-indigo-500/60'}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
            onDrop={(e) => { e.preventDefault(); setIsDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileScan(f); }}
          >
            <label className="flex items-center gap-4 p-4 cursor-pointer">
              <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => { if (e.target.files[0]) { handleFileScan(e.target.files[0]); e.target.value = ''; } }}
              />
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Upload className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-slate-100">
                  {isDragOver ? 'Déposez le fichier' : 'Scanner un fichier'}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Glisser-déposer ou cliquer — JPG, PNG, PDF — max 10 Mo</p>
              </div>
            </label>
          </div>

          {/* Aperçu du document scanné */}
          {scannedDocument && (mode === 'result' || mode === 'manual') && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aperçu du document</p>
              <div className="relative rounded-xl overflow-hidden border border-slate-700/50 max-h-48">
                <img src={scannedDocument} alt="Document scanné" className="w-full h-full object-contain bg-slate-950" />
              </div>
            </div>
          )}

          {/* Texte brut */}
          <button
            onClick={() => setMode('purchase')}
            className="w-full flex items-center gap-4 p-4 border-2 border-indigo-500/30 hover:border-indigo-500/60 rounded-2xl transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <FileText className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-slate-100">Coller le texte d'une facture</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Extraction → Vérifications → Écriture SCE</p>
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

          {/* Accès rapide Codes Tiers */}
          <button onClick={() => setShowTiersManager(true)}
            className="w-full flex items-center gap-3 p-3 border border-slate-700/50 hover:border-slate-600 rounded-xl transition-all text-xs text-left mt-3">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
              <span className="text-brand-400 font-bold text-[11px]">⚙</span>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-200">Gérer les Codes Tiers</p>
              <p className="text-[9px] text-slate-500">Fournisseurs, clients, banques — comptes par défaut</p>
            </div>
          </button>
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
                  Analyse OCR...
                </h4>
                <p className="text-[11px] text-indigo-400">
                  {ocrStatus || (ocrProgress > 0
                    ? `Traitement — ${ocrProgress}%`
                    : 'Initialisation...')}
                </p>
              </div>
              {ocrProgress > 0 && (
                <div className="w-56 sm:w-64 bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                  <div
                    className="h-full bg-gradient-to-r from-brand-500 to-indigo-500 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${ocrProgress}%` }}
                  />
                </div>
              )}
              {ocrError && (
                <p className="text-[10px] text-warning-400 text-center max-w-xs">{ocrError}</p>
              )}
              <button onClick={() => { cancelScan(); setMode('choice'); }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-bold rounded-xl border border-slate-700 transition-all"
              >
                Annuler
              </button>
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
          ) : mode === 'preview' && pendingPiece ? (
            <div className="flex-1 flex flex-col space-y-4 overflow-y-auto p-1 animate-fade-in">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h4 className="text-sm font-extrabold flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" /> Confirmation Écriture Comptable
                </h4>
                <button type="button" onClick={() => setMode('result')}
                  className="text-[10px] text-slate-500 hover:text-slate-300 underline">✕ Retour</button>
              </div>
              <JournalPreview
                piece={pendingPiece}
                onAccept={(updatedPiece) => acceptPiece(updatedPiece)}
                onModify={() => {
                  const lignes = pendingPiece?.lignes || [];
                  const charge = lignes.find(l => l.debit && l.debit > 0 && l.compte && l.compte.startsWith('6'));
                  const tiers = lignes.find(l => l.credit && l.credit > 0 && l.compte && (l.compte.startsWith('401') || l.compte.startsWith('411')));
                  const tva = lignes.find(l => l.compte && l.compte.startsWith('436'));
                  setFormData(f => ({
                    ...f,
                    compteCharge: (charge?.compte || f.compteCharge || ''),
                    compteTiers: (tiers?.compte || f.compteTiers || ''),
                    compteTva: (tva?.compte || f.compteTva || ''),
                  }));
                  setMode('result');
                }}
                onCancel={() => { setPendingPiece(null); setMode('choice'); }}
                onMemorize={pendingPiece && !pendingPiece._tier ? () => {
                  const nom = pendingPiece.fournisseur || 'Fournisseur';
                  const isVente = typeJustificatif === 'vente';
                  const type = isVente ? 'client' : 'fournisseur';
                  const prefixCharge = isVente ? '711' : '611';
                  const prefixTiers = isVente ? '411' : '401';
                  const suggereCharge = autoSuggestCompte(prefixCharge, 6);
                  const suggereTiers = autoSuggestCompte(prefixTiers, 6);
                  const chargeLabel = `${suggereCharge} ${isVente ? 'Ventes' : 'Achats'} – ${nom}`;
                  const tiersLabel = `${suggereTiers} ${isVente ? 'Clients' : 'Fournisseurs'} – ${nom}`;
                  const avecTva = formData.vatRate !== '0%';
                  const ok = addTierAuto(nom, type, {
                    mf: formData.matriculeFiscal,
                    comptes_defaut: {
                      charge: suggereCharge,
                      tiers: suggereTiers,
                      tva: avecTva ? '43666' : '',
                      charge_label: chargeLabel,
                      tiers_label: tiersLabel,
                    },
                  });
                  if (ok) {
                    const newTier = findTierByNom(nom);
                    setPendingPiece({ ...pendingPiece, _tier: newTier ? { code: newTier.code, nom: newTier.nom } : { code: '✓', nom } });
                  }
                } : null}
              />
            </div>
          ) : mode === 'manual' ? (
            renderEntryForm(true)
          ) : mode === 'result' ? (
            renderEntryForm(false)
          ) : mode === 'purchase' ? (
            <div className="flex-1 flex flex-col space-y-4 overflow-y-auto">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h4 className="text-sm font-extrabold flex items-center gap-1.5 text-purple-400">
                  <FileText className="w-4 h-4" /> Traitement de facture
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

      {showTiersManager && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-900 border border-slate-800 rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-6 overflow-y-auto flex-1">
              <TiersManager onClose={() => setShowTiersManager(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OcrView;
