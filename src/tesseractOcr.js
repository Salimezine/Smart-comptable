/**
 * tesseractOcr.js — OCR local pour factures tunisiennes
 *
 * Stack: Tesseract.js v5 (npm), pdf.js (CDN)
 * Conformité: TVA 7/13/19%, FODEC, Timbre LF2023, Retenue Source
 */
import Tesseract from 'tesseract.js';

// ──────────────────────────────────────────────────
// 4. DICTIONNAIRE FOURNISSEURS TUNISIENS (40+)
// ──────────────────────────────────────────────────
const FOURNISSEURS_TN = {
  'ooredoo':            { cat: 'frais_telecommunication', tva: 19, rs: 0 },
  'tunisie telecom':    { cat: 'frais_telecommunication', tva: 19, rs: 0 },
  'tt telecom':         { cat: 'frais_telecommunication', tva: 19, rs: 0 },
  'orange':             { cat: 'frais_telecommunication', tva: 19, rs: 0 },
  'topnet':             { cat: 'frais_telecommunication', tva: 19, rs: 0 },
  'hexabyte':           { cat: 'frais_telecommunication', tva: 19, rs: 0 },
  'globalnet':          { cat: 'frais_telecommunication', tva: 19, rs: 0 },
  'planet':             { cat: 'frais_telecommunication', tva: 19, rs: 0 },
  'sotetel':            { cat: 'frais_telecommunication', tva: 19, rs: 0 },
  'steg':               { cat: 'frais_energie', tva: 13, rs: 0, timbre: 0 },
  'sonede':             { cat: 'frais_energie', tva: 7,  rs: 0, timbre: 0 },
  'sndp':               { cat: 'frais_carburant', tva: 19, rs: 0 },
  'total tunisie':      { cat: 'frais_carburant', tva: 19, rs: 0 },
  'agil':               { cat: 'frais_carburant', tva: 19, rs: 0 },
  'vivo energy':        { cat: 'frais_carburant', tva: 19, rs: 0 },
  'monoprix':           { cat: 'fournitures_bureau', tva: 19, rs: 0 },
  'geant':              { cat: 'fournitures_bureau', tva: 19, rs: 0 },
  'carrefour':          { cat: 'fournitures_bureau', tva: 19, rs: 0 },
  'magasin general':    { cat: 'achat_marchandises', tva: 19, rs: 0 },
  'promogros':          { cat: 'achat_marchandises', tva: 19, rs: 0 },
  'aziza':              { cat: 'achat_marchandises', tva: 19, rs: 0 },
  'delice':             { cat: 'achat_marchandises', tva: 7, rs: 0 },
  'poulina':            { cat: 'achat_marchandises', tva: 7, rs: 0 },
  'sotumag':            { cat: 'achat_marchandises', tva: 7, rs: 0 },
  'sfax lait':          { cat: 'achat_marchandises', tva: 7, rs: 0 },
  'star':               { cat: 'frais_assurance', tva: 0, rs: 0 },
  'gat':                { cat: 'frais_assurance', tva: 0, rs: 0 },
  'carte':              { cat: 'frais_assurance', tva: 0, rs: 0 },
  'bh assurance':       { cat: 'frais_assurance', tva: 0, rs: 0 },
  'hayett':             { cat: 'frais_assurance', tva: 0, rs: 0 },
  'biat':               { cat: 'frais_bancaires', tva: 19, rs: 10 },
  'attijari':           { cat: 'frais_bancaires', tva: 19, rs: 10 },
  'bna':                { cat: 'frais_bancaires', tva: 19, rs: 10 },
  'stb':                { cat: 'frais_bancaires', tva: 19, rs: 10 },
  'amen bank':          { cat: 'frais_bancaires', tva: 19, rs: 10 },
  'ubci':               { cat: 'frais_bancaires', tva: 19, rs: 10 },
  'bh bank':            { cat: 'frais_bancaires', tva: 19, rs: 10 },
  'rapid poste':        { cat: 'frais_transport', tva: 19, rs: 0 },
  'aramex':             { cat: 'frais_transport', tva: 19, rs: 0 },
  'ups':                { cat: 'frais_transport', tva: 19, rs: 0 },
  'e-info':            { cat: 'frais_informatique', tva: 7, rs: 0 },
  'e info':            { cat: 'frais_informatique', tva: 7, rs: 0 },
  'einfo':             { cat: 'frais_informatique', tva: 7, rs: 0 },
  'ednfo':             { cat: 'frais_informatique', tva: 7, rs: 0 },
};

// ──────────────────────────────────────────────────
// 5. CATÉGORIES SCE — PLAN COMPTABLE TUNISIEN
// ──────────────────────────────────────────────────
const CATEGORIES_SCE = {
  'achat_marchandises':       { code: '601',  label: 'Achats de marchandises' },
  'achat_matieres':           { code: '6021', label: 'Matières premières' },
  'frais_telecommunication':  { code: '6248', label: 'Télécommunications' },
  'frais_energie':            { code: '6042', label: 'Eau, électricité, gaz' },
  'frais_carburant':          { code: '6241', label: 'Carburants et lubrifiants' },
  'frais_transport':          { code: '624',  label: 'Transports' },
  'fournitures_bureau':       { code: '6024', label: 'Fournitures de bureau' },
  'services_exterieurs':      { code: '6245', label: 'Services extérieurs' },
  'frais_bancaires':          { code: '6316', label: 'Frais bancaires' },
  'loyer':                    { code: '6132', label: 'Loyers' },
  'honoraires':               { code: '6222', label: 'Honoraires' },
  'frais_assurance':          { code: '616',  label: "Primes d'assurance" },
  'frais_entretien':          { code: '615',  label: 'Entretien et réparations' },
  'frais_publicite':          { code: '623',  label: 'Publicité' },
  'frais_informatique':       { code: '2184', label: 'Matériel informatique' },
};

// ──────────────────────────────────────────────────
// 3. TOUS LES REGEX — FACTURES TUNISIENNES RÉELLES
// ──────────────────────────────────────────────────
// Matricule Fiscal: 1234567/Y/A/M/000
const RGX_MF = /(\d{7})\s*[\/\\]\s*([A-HJ-NP-TV-Z])\s*[\/\\]\s*([AB])\s*[\/\\]\s*([MNPE])\s*[\/\\]\s*(\d{3})/i;

const RGX_HT = [
  /(?:Total\s+HT|Montant\s+HT|Sous[\s-]total\s+HT|Hors\s+[Tt]axe|H\.T\.?)\s*[:\s]*([\d\s.,]+\d)/i,
  /(?:المبلغ خ\.ض|خارج الأداء)\s*[:\s]*([\d\s.,]+\d)/i,
];

const RGX_TVA = [
  /TVA\s*(7|13|19)\s*%\s*[:\s]*([\d.,]+\d)/i,
  /T\.V\.A\.?\s*(7|13|19)\s*%?\s*[:\s]*([\d.,]+\d)/i,
  /Taxe\s+(?:sur\s+la\s+)?[Vv]aleur\s+[Aa]joutée\s*(7|13|19)?\s*%?\s*[:\s]*([\d.,]+)/i,
  /(?:الأداء على القيمة المضافة|أ\.ق\.م)\s*(7|13|19)?\s*%?\s*[:\s]*([\d.,]+)/i,
];

const RGX_FODEC = [
  /FODEC\s*(?:\(1\s*%\))?\s*[:\s]*([\d.,]+)/i,
  /Fonds?\s+(?:de\s+)?[Dd]éveloppement\s*[:\s]*([\d.,]+)/i,
];

const RGX_TIMBRE = [
  /[Tt]imbre\s*(?:[Ff]iscal)?\s*[:\s]*([\d.,]+)/i,
  /[Dd]roit\s+de\s+[Tt]imbre\s*[:\s]*([\d.,]+)/i,
  /طابع\s*[:\s]*([\d.,]+)/i,
];

const RGX_TTC = [
  /(?:Total\s+TTC|Net\s+[àa]\s+payer|Montant\s+TTC|TOTAL\s+TTC|Total\s+général)\s*[:\s]*([\d\s.,]+\d)/i,
  /(?:المبلغ الجملي|الإجمالي|المجموع\s+الكلي)\s*[:\s]*([\d\s.,]+\d)/i,
];

const RGX_RS = [
  /(?:Retenue\s+[àa]\s+la\s+source|Retenue|R\.?S\.?)\s*(?:\d+\s*%)?\s*[:\s]*([\d.,]+)/i,
  /(?:خصم من المورد)\s*[:\s]*([\d.,]+)/i,
];

const RGX_DATE = [
  /(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})/,
  /(\d{4})[\/\-\.](\d{2})[\/\-\.](\d{2})/,
  /(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/i,
  /(\d{4})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/i,
];

const RGX_LIGNE = /^(.+?)\s{2,}(\d+[.,]\d{3})(?:\s*DT)?\s{1,}(\d+(?:[.,]\d+)?)\s{1,}(\d+[.,]\d{3})(?:\s*DT)?\s*$/gm;

const RGX_PU_QTE = /(\d+[.,]\d{3})\s*(?:DT)?\s*[×xX\*]\s*(\d+)\s*[=:→]\s*(\d+[.,]\d{3})/gi;

const MONTHS = {
  janvier: '01', février: '02', mars: '03', avril: '04', mai: '05', juin: '06',
  juillet: '07', août: '08', septembre: '09', octobre: '10', novembre: '11', décembre: '12',
};

// ──────────────────────────────────────────────────
// Fonction 4: normaliserMontant(str)
// ──────────────────────────────────────────────────
export function normaliserMontant(str) {
  if (!str && str !== 0) return null;
  let s = str.toString()
    .replace(/\s/g, '')
    .replace(/DT|TND/gi, '')
    .replace(/\u00A0/g, '')
    .trim();
  if (!s) return null;

  const points = (s.match(/\./g) || []).length;
  const virgules = (s.match(/,/g) || []).length;

  if (points >= 2) {
    s = s.replace(/\./g, '');
    if (s.length > 3) s = s.slice(0, -3) + '.' + s.slice(-3);
  } else if (points === 1 && virgules === 1) {
    s = s.replace('.', '').replace(',', '.');
  } else if (virgules === 1) {
    s = s.replace(',', '.');
  }

  const num = parseFloat(s);
  if (isNaN(num)) return null;
  return parseFloat(num.toFixed(3));
}

// ──────────────────────────────────────────────────
// Utilitaires
// ──────────────────────────────────────────────────
function extrairePremier(patterns, text) {
  for (const p of patterns) {
    const m = p.exec(text);
    if (m) return m[1] || m[0];
  }
  return null;
}

function extraireDernier(patterns, text) {
  let dernier = null;
  for (const p of patterns) {
    p.lastIndex = 0;
    let m;
    while ((m = p.exec(text)) !== null) {
      dernier = m[1] || m[0];
    }
  }
  return dernier;
}

const OCR_CORRECTIONS = {
  'ednfo': 'E-info', 'ednf o': 'E-info', 'e dnfo': 'E-info',
  'steg': 'STEG', 'steg ': 'STEG',
  'sonede': 'SONEDE',
  'ooredoo': 'Ooredoo', 'ooredoo ': 'Ooredoo',
  'sndp': 'SNDP', 'sndp ': 'SNDP',
  'monoprix': 'Monoprix',
  'carrefour': 'Carrefour',
  'biat': 'BIAT',
  'attijari': 'Attijari',
  'bna': 'BNA',
};

const BLACKLIST_FOURNISSEUR = [
  /^timbre\s*fiscal/i,
  /^fodec/i,
  /^tva\s*\d/i,
  /^net\s*[àa]\s*payer/i,
  /^total\s*ttc/i,
  /^montant\s*tva/i,
  /^sous.total/i,
  /^\d{1,3}[.,]\d{3}$/,
];

function correctOCRText(text) {
  try {
    let t = text;
    t = t.replace(/\r\n/g, '\n');
    t = t.replace(/\u00A0/g, ' ');
    t = t.replace(/[•·]/g, ' ');
    t = t.replace(/[  ]/g, ' ');
    t = t.replace(/(\d)\s+(\d{3}[.,])/g, '$1$2');
    t = t.replace(/œ/g, 'oe').replace(/Œ/g, 'OE');
    t = t.replace(/[¡¢£¤¥¦§¨©ª«¬®¯±²³´µ¶·¸¹º»¼½¾¿]/g, '');

    const corrections = {
      'ednfo': 'E-info', 'ednf o': 'E-info', 'e dnfo': 'E-info', 'e-dnfo': 'E-info',
      'steg': 'STEG', 'steg ': 'STEG',
      'sonede': 'SONEDE',
      '0oredoo': 'Ooredoo', 'ooredoo': 'Ooredoo', 'ooredo': 'Ooredoo',
      'tunisie tel': 'Tunisie Telecom',
      'sndp': 'SNDP',
      'monoprix': 'Monoprix',
      'carrefour': 'Carrefour',
      'biat': 'BIAT',
      'attijari': 'Attijari',
      'bna': 'BNA',
    };
    let lower = t.toLowerCase();
    for (const [wrong, right] of Object.entries(corrections)) {
      const re = new RegExp('\\b' + wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
      if (re.test(lower)) {
        t = t.replace(re, right);
        lower = t.toLowerCase();
      }
    }
    t = t.replace(/\s{2,}/g, ' ').trim();
    return t;
  } catch {
    return text;
  }
}

// ──────────────────────────────────────────────────
// Détection fournisseur
// ──────────────────────────────────────────────────
function detectFournisseur(text) {
  try {
    if (!text || typeof text !== 'string') return null;
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    // PRIORITÉ 1: label explicite
    const explicit = text.match(/(?:Fournisseur|Vendeur|Émetteur)\s*[:\-]\s*([^\n\r]{3,60})/i);
    if (explicit) return explicit[1].replace(/\s*(MF|Tél|—).*/i, '').trim();

    // PRIORITÉ 2: couper avant section client/tableau
    const stopMarkers = [/FACTURÉ\s*[ÀA]/i, /Désignation/i, /N°\s+Date\s+Client/i, /Mohamed|Client/i];
    let textFournisseur = text;
    for (const marker of stopMarkers) {
      const idx = text.search(marker);
      if (idx > 20) { textFournisseur = text.slice(0, idx); break; }
    }

    const IGNORE = /^(avenue|rue|route|bp|tél|tel|fax|email|www\.|http|\+216|mf|matricule|facture|relevé|période|date|n°|ref|rib|swift|règlement|virement|\d{4,})/i;
    const linesFiltered = textFournisseur.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    for (const line of linesFiltered.slice(0, 6)) {
      if (line.length < 2 || line.length > 65) continue;
      if (IGNORE.test(line)) continue;
      if (/^\d+$/.test(line)) continue;
      if (/^\W+$/.test(line)) continue;
      if (!(/[A-Za-zÀ-ü]{2,}/).test(line)) continue;
      const clean = line.replace(/\s*(MF\s*:|Tél\s*:|—{2,}|\|).*/i, '').replace(/^['\s\[]+/, '').trim();
      if (clean.length >= 2) return correctOCRText(clean);
    }
    return null;
  } catch { return null; }
}

// ──────────────────────────────────────────────────
// Détection numéro de facture
// ──────────────────────────────────────────────────
function detectNumeroFacture(text) {
  const patterns = [
    /(?:Facture\s*N°?|N°\s*Facture|Ref|Réf)\s*[:\s]*([A-Z0-9]{2,8}[-\/]?\d{2,6}[-\/]?\d{2,6})/i,
    /\b(FAC|INV|FC|FV|FA|BL|DST|OOR|STEG|MPX)[-\/](\d{4})[-\/](\d{3,6})\b/i,
    /\b([A-Z]{2}\d{2}[A-Z]{2}\d{3,})\b/,
    /N°[^\n]*\n\s*(\d{2,6})\s+\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4}/i,
    /\bN°\s*[:\s]*(\d{2,6})\b/i,
    // Fallback: "N" sans ° (après correctOCRText l'a retiré)
    /\bN\s+(\d{1,6})\b/i,
    // "Facture N° 68 pour Mohamed" (fin de texte)
    /Facture\s*N°?\s*(\d{1,6})\s*(?:pour|du|dat|\/)/i,
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const val = m[2] && m[3] ? `${m[1]}-${m[2]}-${m[3]}` : (m[1] || m[0]).trim();
      if (val && val.toLowerCase() !== 'ture') return val;
    }
  }
  return null;
}

// ──────────────────────────────────────────────────
// Détection date
// ──────────────────────────────────────────────────
function detectDate(text) {
  const m = RGX_DATE[0].exec(text);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const n = RGX_DATE[1].exec(text);
  if (n) return `${n[1]}-${n[2].padStart(2, '0')}-${n[3].padStart(2, '0')}`;
  const t = RGX_DATE[2].exec(text);
  if (t) return `${t[3]}-${MONTHS[t[2].toLowerCase()] || '01'}-${t[1].padStart(2, '0')}`;
  const y = RGX_DATE[3].exec(text);
  if (y) return `${y[3]}-01-01`;
  return null;
}

// ──────────────────────────────────────────────────
// Détection matricule fiscal
// ──────────────────────────────────────────────────
function detectMF(text) {
  try {
    if (!text || typeof text !== 'string') return null;

    const clientSectionStart = (() => {
      const keywords = ['FACTURÉ À', 'ADRESSÉ À', 'LIVRÉ À', 'CLIENT :', 'CLIENT:'];
      let minIdx = text.length;
      for (const kw of keywords) {
        const idx = text.toUpperCase().indexOf(kw);
        if (idx !== -1 && idx > 50 && idx < minIdx) minIdx = idx;
      }
      return minIdx;
    })();

    const fournisseurZone = text.substring(0, Math.min(clientSectionStart, text.length));

    const patterns = [
      /(?:M\.?F\.?\s*[:﹕]\s*|Matricule\s*[Ff]iscal\s*[:﹕]\s*)?(\d{6,7}\s*\/\s*[A-Za-z0-9]\s*\/\s*[A-Za-z]\s*\/\s*\d{3})/,
      /(?:M\.?F\.?\s*[:﹕]\s*|Matricule\s*[Ff]iscal\s*[:﹕]\s*)?(\d{6,7})\s*\/\s*([A-Za-z]{1,3})(?:\s|$|[^\/])/,
      /\b(\d{6,7})\s*\/\s*([A-Za-z])(?:\s|\/|$|\.)/,
    ];

    for (const pat of patterns) {
      const m = fournisseurZone.match(pat);
      if (m) {
        if (m[2] && !m[2].includes('/')) return (m[1] + '/' + m[2].toUpperCase()).trim();
        return m[1].trim();
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────
// Génération de numéro de facture unique
// ──────────────────────────────────────────────────
function generateInvoiceNumber(existingInvoices = []) {
  try {
    const year = new Date().getFullYear();
    const prefix = `FACT-${year}-`;
    let maxNum = 0;
    for (const inv of existingInvoices) {
      const n = inv.invoiceNumber || inv.numero_facture || '';
      if (typeof n === 'string' && n.startsWith(prefix)) {
        const num = parseInt(n.slice(prefix.length), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }
    return prefix + String(maxNum + 1).padStart(3, '0');
  } catch {
    return `FACT-${new Date().getFullYear()}-001`;
  }
}

// ──────────────────────────────────────────────────
// Persistance fournisseur (localStorage)
// ──────────────────────────────────────────────────
const FOURNISSEURS_KEY = 'smart_fournisseurs';

function saveOrUpdateFournisseur(name, detectedData = {}) {
  try {
    if (!name || typeof name !== 'string') return;
    const trimmed = name.trim();
    if (!trimmed) return;
    if (BLACKLIST_FOURNISSEUR.some(r => r.test(trimmed))) return;

    let fournisseurs = [];
    try {
      const raw = localStorage.getItem(FOURNISSEURS_KEY);
      if (raw) fournisseurs = JSON.parse(raw);
    } catch {
      fournisseurs = [];
    }
    if (!Array.isArray(fournisseurs)) fournisseurs = [];

    const existing = fournisseurs.find(
      f => f && f.nom && f.nom.toLowerCase() === trimmed.toLowerCase()
    );

    if (existing) {
      if (detectedData.matriculeFiscal && !existing.matriculeFiscal) {
        existing.matriculeFiscal = detectedData.matriculeFiscal;
      }
      if (detectedData.telephone && !existing.telephone) {
        existing.telephone = detectedData.telephone;
      }
      existing.derniereFacture = detectedData.date || new Date().toISOString().slice(0, 10);
      existing.totalAchats = (existing.totalAchats || 0) + (parseFloat(detectedData.totalAmount) || 0);
    } else {
      fournisseurs.unshift({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        nom: trimmed,
        matriculeFiscal: detectedData.matriculeFiscal || '',
        telephone: detectedData.telephone || '',
        adresse: detectedData.address || '',
        totalAchats: parseFloat(detectedData.totalAmount) || 0,
        derniereFacture: detectedData.date || new Date().toISOString().slice(0, 10),
        dateCreation: new Date().toISOString(),
      });
    }

    localStorage.setItem(FOURNISSEURS_KEY, JSON.stringify(fournisseurs));
  } catch {
    /* silencieux */
  }
}

// ──────────────────────────────────────────────────
// Parse montant en toutes lettres (français)
// ──────────────────────────────────────────────────
function parseMontantLettres(text) {
  const m = text.match(/(\S[\w\s\-]+)\s*[Dd]inars?/i);
  if (!m) return null;
  const mots = m[1].toLowerCase().replace(/[^a-zéèêëàâîïôûùç\s\-]/g, '').trim().split(/[\s\-]+/);
  const CHIFFRES = {
    zéro:0, un:1, une:1, deux:2, trois:3, quatre:4, cinq:5, six:6, sept:7, huit:8, neuf:9, dix:10,
    onze:11, douze:12, treize:13, quatorze:14, quinze:15, seize:16,
    vingt:20, trente:30, quarante:40, cinquante:50, soixante:60,
    soixantedix:70, quatrevingt:80, quatrevingtdix:90, cent:100, mille:1000,
  };
  let total = 0, courant = 0;
  for (const mot of mots) {
    if (CHIFFRES[mot] !== undefined) {
      const v = CHIFFRES[mot];
      if (v >= 1000) { total += courant * v; courant = 0; }
      else if (v >= 100) {
        if (courant === 0) courant = 1;
        courant *= v;
      } else {
        courant += v;
      }
    } else if (mot === 'et' || mot === '') {
      continue;
    } else {
      // "soixante-dix-neuf" → split on "-" already done
      // "quatre-vingt" → handled via CHIFFRES
    }
  }
  total += courant;
  return total > 0 ? total : null;
}

// ──────────────────────────────────────────────────
// Détection lignes articles
// ──────────────────────────────────────────────────
function detectLignes(text) {
  const lignes = [];
  const sauts = text.replace(/\r\n/g, '\n').split('\n');
  const bruitLigne = /^(total|tva|ht|ttc|net|timbre|fodec|retenue|remise|taux|reference|observation|base|designation|client)/i;
  const LIGNE_EINFO = /^(.{5,50}?)\s{2,}(\d{1,3})\s+(0|7|13|19)\s+([\d,]+)\s+([\d,]+)$/;
  // E-INFO actuel: [Désignation TVA[|] PrixHT[|] TotalTTC]
  const LIGNE_EINFO3 = /^\[?\s*(.{3,60}?)\s+(\d{1,2})\s*(?:\|\s*)?([\d,]+)\s*(?:\|\s*)?([\d,]+)\s*\]?\s*(?:\|\s*)?$/;

  for (const line of sauts) {
    const l = line.trim();

    // E-INFO format: Désignation  Qte  TVA  PrixHT  TotalTTC
    LIGNE_EINFO.lastIndex = 0;
    const em = LIGNE_EINFO.exec(l);
    if (em) {
      const des = em[1].trim();
      if (!bruitLigne.test(des) && des.length >= 3) {
        const qte = parseInt(em[2]);
        const prix = normaliserMontant(em[4]);
        const total = normaliserMontant(em[5]);
        if (qte > 0 && qte < 99999 && prix !== null && total !== null) {
          lignes.push({
            designation: des,
            prix_unitaire: prix,
            quantite: qte,
            total: total,
            tva: tva,
          });
          continue;
        }
      }
    }

    // E-INFO tableau réel: [Désignation TVA[|] PrixHT[|] TotalTTC]
    LIGNE_EINFO3.lastIndex = 0;
    const em3 = LIGNE_EINFO3.exec(l);
    if (em3) {
      const des = em3[1].trim();
      if (!bruitLigne.test(des) && des.length >= 3) {
        const tva = parseInt(em3[2]);
        const prix = normaliserMontant(em3[3]);
        const total = normaliserMontant(em3[4]);
        if ([0, 7, 13, 19].includes(tva) && prix !== null && total !== null) {
          lignes.push({
            designation: des,
            prix_unitaire: prix,
            quantite: 1,
            total: total,
            tva: tva,
          });
          continue;
        }
      }
    }

    RGX_LIGNE.lastIndex = 0;
    let m;
    while ((m = RGX_LIGNE.exec(l)) !== null) {
      const des = m[1].trim();
      if (bruitLigne.test(des) || des.length < 3) continue;
      const pu = normaliserMontant(m[2]);
      const qte = parseInt(String(m[3]).replace(/[\s,]/g, '').replace(',', '.'));
      const total = normaliserMontant(m[4]);
      if (pu !== null && !isNaN(qte) && total !== null && qte > 0 && qte < 99999) {
        lignes.push({
          designation: des,
          prix_unitaire: pu,
          quantite: qte,
          total: total,
        });
      }
    }
  }

  RGX_PU_QTE.lastIndex = 0;
  let p;
  while ((p = RGX_PU_QTE.exec(text)) !== null) {
    const pu = normaliserMontant(p[1]);
    const qte = parseInt(p[2]);
    const total = normaliserMontant(p[3]);
    if (pu !== null && !isNaN(qte) && total !== null && qte > 0 && qte < 99999) {
      const voisin = text.substring(Math.max(0, p.index - 30), p.index).trim();
      const des = voisin.length > 2 ? voisin.split('\n').pop() : 'Article';
      if (!lignes.find(lx => lx.designation === des && lx.total === total)) {
        lignes.push({ designation: des, prix_unitaire: pu, quantite: qte, total: total });
      }
    }
  }

  return lignes.slice(0, 30);
}

// ──────────────────────────────────────────────────
// Fonction 2: parseFactureTunisienne(text)
// ──────────────────────────────────────────────────
function parseFactureTunisienne(text) {
  text = correctOCRText(text);

  const result = {
    fournisseur: null, matricule_fiscal: null, date: null,
    numero_facture: null, montant_ht: null, fodec: 0,
    base_tva: null, taux_tva: null, montant_tva: null,
    timbre_fiscal: 1.000, retenue_source: 0, taux_rs: 0,
    montant_ttc: null, net_a_payer: null,
    categorie_sce: null, code_comptable: null,
    lignes: [], devise: 'DT',
    flag_incoherence: false, champs_manquants: [],
    source: 'ocr_tesseract', confidence: 0,
  };

  try {
    const textLower = text.toLowerCase();

    // ══════════════════════════════════════════
    // 1. FOURNISSEUR
    // ══════════════════════════════════════════
    result.fournisseur = detectFournisseur(text);

    // ══════════════════════════════════════════
    // 2. MATRICULE FISCAL
    // ══════════════════════════════════════════
    result.matricule_fiscal = detectMF(text);

    // ══════════════════════════════════════════
    // 3. DATE — tous formats tunisiens
    // ══════════════════════════════════════════
    const datePatterns = [
      { r: /(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})/, fn: m => `${m[3]}-${m[2]}-${m[1]}` },
      { r: /(\d{4})[\/\-\.](\d{2})[\/\-\.](\d{2})/, fn: m => `${m[1]}-${m[2]}-${m[3]}` },
      { r: /(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/i,
        fn: m => {
          const mois = {janvier:'01',février:'02',mars:'03',avril:'04',mai:'05',
            juin:'06',juillet:'07',août:'08',septembre:'09',octobre:'10',
            novembre:'11',décembre:'12'};
          return `${m[3]}-${mois[m[2].toLowerCase()]}-${m[1].padStart(2,'0')}`;
        }
      },
    ];
    // Collection tous les dates avec leur position
    const datesTrouvees = [];
    for (const { r, fn } of datePatterns) {
      let m;
      r.lastIndex = 0;
      while ((m = r.exec(text)) !== null) {
        const d = fn(m);
        if (!isNaN(Date.parse(d))) {
          datesTrouvees.push({ date: d, pos: m.index, raw: m[0] });
        }
      }
    }
    // Préférer dates précédées de mots-clés ; sinon la dernière
    const keywordsDate = /\b(?:Date|date|Le|le|Facture|facture|E[\-\s]INFO|émise|du)\s*[:\-]?\s*$/;
    let best = null;
    for (const dt of datesTrouvees) {
      const before = text.slice(Math.max(0, dt.pos - 40), dt.pos);
      if (keywordsDate.test(before)) { best = dt; break; }
    }
    if (!best && datesTrouvees.length > 0) {
      best = datesTrouvees[datesTrouvees.length - 1];
    }
    if (best) result.date = best.date;

    // ══════════════════════════════════════════
    // 4. NUMÉRO FACTURE
    // ══════════════════════════════════════════
    result.numero_facture = detectNumeroFacture(text);

    // ══════════════════════════════════════════
    // 5. MONTANT HT — chercher DERNIÈRE occurrence
    // ══════════════════════════════════════════
    const htPatterns = [
      /(?:Total\s+HT|Montant\s+HT|Sous[\-\s]total\s+HT|Net\s+HT|Base\s+HT)\s*[:\-]?\s*([\d\s\.,]+\d)/gi,
      /\bHT\b\s*[:\-]?\s*([\d\s\.,]+\d)/gi,
      /Total\s+HT\s*\|?\s*([\d\s\.,]+\d)/gi,
      /\bHT\b\s*\|?\s*([\d\s\.,]+\d)\s*$/gim,
      /(?:H\.T\.)\s*[:\-]?\s*([\d\s\.,]+\d)/gi,
    ];
    for (const p of htPatterns) {
      const matches = [...text.matchAll(p)];
      if (matches.length > 0) {
        const last = matches[matches.length - 1];
        const val = normaliserMontant(last[1]);
        if (val && val > 0) { result.montant_ht = val; break; }
      }
    }

    // ══════════════════════════════════════════
    // 6. TVA — taux ET montant
    // ══════════════════════════════════════════
    // Taux d'abord
    const tauxMatch = text.match(/TVA\s*(?:à|au|de)?\s*(7|13|19)\s*%/i) ||
                      text.match(/T\.V\.A\.?\s*(7|13|19)\s*%/i);
    if (tauxMatch) result.taux_tva = parseInt(tauxMatch[1]);

    // Montant TVA — plusieurs patterns
    const tvaAmtPatterns = [
      /Total\s+TVA\s+([\d\s\.,]+\d)/gi,
      /(?:Montant\s+TVA|TVA\s*(?:\d+\s*%)?\s*[:\-])\s{0,30}([\d\s\.,]+\d)/gi,
      /T\.V\.A\.?\s*(?:\d+\s*%)?\s*[:\-]\s*([\d\s\.,]+\d)/gi,
      /TVA\s*(7|13|19)\s*%\s*[:\-]?\s*([\d\s\.,]+\d)/gi,
    ];
    for (const p of tvaAmtPatterns) {
      const matches = [...text.matchAll(p)];
      if (matches.length > 0) {
        const last = matches[matches.length - 1];
        const valStr = last[2] || last[1];
        const val = normaliserMontant(valStr);
        if (val && val > 0 && val < 999999) {
          result.montant_tva = val;
          if (last[1] && /^(7|13|19)$/.test(last[1])) {
            result.taux_tva = parseInt(last[1]);
          }
          break;
        }
      }
    }

    // ══════════════════════════════════════════
    // 7. FODEC — 1% sur HT, produits industriels
    // ══════════════════════════════════════════
    const fodecPatterns = [
      /FODEC\s*(?:\(1\s*%\))?\s*[:\-]?\s*([\d\s\.,]+\d)/gi,
      /Fonds?\s+(?:de\s+)?[Dd]év(?:eloppement)?\s*[:\-]?\s*([\d\s\.,]+\d)/gi,
    ];
    for (const p of fodecPatterns) {
      const m = text.match(p);
      if (m) {
        const numMatch = m[0].match(/([\d\s\.,]+\d)$/);
        if (numMatch) {
          const val = normaliserMontant(numMatch[1]);
          if (val !== null) { result.fodec = val; break; }
        }
      }
    }
    if (result.fodec === 0 && text.match(/FODEC/i) && result.montant_ht) {
      result.fodec = parseFloat((result.montant_ht * 0.01).toFixed(3));
    }

    // ══════════════════════════════════════════
    // 8. TIMBRE FISCAL — LF2023: 1,000 DT forfait
    // ══════════════════════════════════════════
    const timbrePatterns = [
      /[Tt]imbre\s*(?:[Ff]iscal)?\s*[:\-]?\s*([\d\s\.,]+\d)/i,
      /[Dd]roit\s+de\s+[Tt]imbre\s*[:\-]?\s*([\d\s\.,]+\d)/i,
      /طابع\s*[:\-]?\s*([\d\s\.,]+\d)/i,
    ];
    for (const p of timbrePatterns) {
      const m = text.match(p);
      if (m) {
        const numMatch = m[0].match(/([\d\s\.,]+\d)$/);
        if (numMatch) {
          const val = normaliserMontant(numMatch[1]);
          if (val !== null) { result.timbre_fiscal = val; break; }
        }
      }
    }
    if (/\b(steg|sonede)\b/i.test(textLower)) {
      result.timbre_fiscal = 0;
    }

    // ══════════════════════════════════════════
    // 9. RETENUE À LA SOURCE — taux 2025
    // ══════════════════════════════════════════
    const rsPatterns = [
      /[Rr]etenue\s+[àa]\s+la\s+[Ss]ource\s*(?:\([\d\.,]+\s*%\))?\s*[:\-]?\s*([\d\s\.,]+\d)/i,
      /\bR\.?S\.?\b\s*(?:\([\d\.,]+\s*%\))?\s*[:\-]\s*([\d\s\.,]+\d)/i,
      /خصم\s+من\s+المورد\s*[:\-]?\s*([\d\s\.,]+\d)/i,
    ];
    for (const p of rsPatterns) {
      const m = text.match(p);
      if (m) {
        const numMatch = m[0].match(/([\d\s\.,]+\d)$/);
        if (numMatch) {
          const val = normaliserMontant(numMatch[1]);
          if (val && val > 0) {
            result.retenue_source = val;
            const rsPctMatch = m[0].match(/(1[.,]5|0[.,]5|2[.,]5|3|10)\s*%/);
            if (rsPctMatch) {
              result.taux_rs = parseFloat(rsPctMatch[1].replace(',', '.'));
            }
            break;
          }
        }
      }
    }
    if (result.retenue_source > 0 && result.taux_rs === 0) {
      const rsPct = /(1[.,]5|0[.,]5|2[.,]5|3|10)\s*%/.exec(text);
      if (rsPct) result.taux_rs = parseFloat(rsPct[1].replace(',', '.'));
    }

    // ══════════════════════════════════════════
    // 10. TOTAL TTC / NET À PAYER — highest value wins
    // ══════════════════════════════════════════
    const ttcPatterns = [
      /(?:Total\s+TTC|Montant\s+TTC|TOTAL\s+TTC)\s*[:\-]?\s*([\d\s\.,]+\d)/gi,
      /(?:Net\s+[àa]\s+[Pp]ayer|Montant\s+[Nn]et|Net\s+payé)\s*[:\-]?\s*([\d\s\.,]+\d)/gi,
      /Net\s+[àa]\s+payer\s*\|?\s*([\d\s\.,]+\d)/gi,
      /NET\s+A\s+PAYER\s*\|?\s*([\d\s\.,]+\d)/gi,
      /(?:المبلغ\s+الجملي|الإجمالي)\s*[:\-]?\s*([\d\s\.,]+\d)/gi,
    ];
    let bestTTC = 0;
    for (const p of ttcPatterns) {
      const matches = [...text.matchAll(p)];
      for (const m of matches) {
        const val = normaliserMontant(m[1]);
        if (val && val > bestTTC) bestTTC = val;
      }
    }
    if (bestTTC > 0) result.montant_ttc = bestTTC;

    // ══════════════════════════════════════════
    // 11. LIGNES ARTICLES — tableau facture
    // ══════════════════════════════════════════
    result.lignes = detectLignes(text);

    // Fallback: si TTC non trouvé, sommer les totaux des lignes
    if (!result.montant_ttc && result.lignes && result.lignes.length > 0) {
      const sumTotals = result.lignes.reduce((s, l) => s + (l.total || 0), 0);
      if (sumTotals > 0) result.montant_ttc = parseFloat(sumTotals.toFixed(3));
    }

    // Fallback: détecter "Deux cent soixante dix-neuf Dinars"
    if (!result.montant_ttc) {
      const montantLettres = parseMontantLettres(text);
      if (montantLettres) result.montant_ttc = montantLettres;
    }

    // Si TVA connue par ligne, calculer HT, TVA et TTC réels (taux mixtes)
    if (result.lignes && result.lignes.length > 0) {
      const withTva = result.lignes.filter(l => l.tva !== undefined);
      if (withTva.length === result.lignes.length) {
        // Vérifier cohérence: total ≈ prix × (1 + tva/100) pour chaque ligne
        const sane = result.lignes.every(l => {
          if (l.tva === 0) return Math.abs(l.total - l.prix_unitaire) < 0.010;
          const expected = l.prix_unitaire * (1 + l.tva / 100);
          return Math.abs(l.total - expected) < 0.010;
        });
        if (sane) {
          const totalHT = result.lignes.reduce((s, l) => s + (l.prix_unitaire || 0), 0);
          const sumTotals = result.lignes.reduce((s, l) => s + (l.total || 0), 0);
          const totalTVA = sumTotals - totalHT;
          const timbre = result.timbre_fiscal || 0;
          if (totalHT > 0) result.montant_ht = parseFloat(totalHT.toFixed(3));
          if (totalTVA > 0) result.montant_tva = parseFloat(totalTVA.toFixed(3));
          result.montant_ttc = parseFloat((sumTotals + timbre).toFixed(3));
          // Compter occurrences de chaque taux TVA
          const comptage = {};
          for (const l of result.lignes) {
            comptage[l.tva] = (comptage[l.tva] || 0) + 1;
          }
          const best = Object.entries(comptage).sort((a, b) => b[1] - a[1])[0];
          if (best) result.taux_tva = parseInt(best[0]);
        }
      }
    }

    // ══════════════════════════════════════════
    // 12. AUTO-DÉTECTION FOURNISSEUR → catégorie
    // ══════════════════════════════════════════
    const searchText = (result.fournisseur || '') + ' ' + text;
    const searchLower = searchText.toLowerCase();
    let fourniInfo = null;
    for (const [key, info] of Object.entries(FOURNISSEURS_TN)) {
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`\\b${escaped}\\b`, 'i');
      if (pattern.test(searchLower)) { fourniInfo = info; break; }
    }
    if (fourniInfo) {
      result.categorie_sce  = fourniInfo.cat;
      if (result.taux_tva === null) result.taux_tva = fourniInfo.tva;
      if (fourniInfo.timbre === 0)  result.timbre_fiscal = 0;
      if (fourniInfo.rs > 0 && result.retenue_source === 0) result.taux_rs = fourniInfo.rs;
    }

    // Fallback direct: patterns texte → fournisseur connu
    if (!fourniInfo) {
      if (/e[ -]?info/i.test(text)) {
        const info = FOURNISSEURS_TN['e-info'];
        if (info) { fourniInfo = info; result.categorie_sce = info.cat; if (result.taux_tva === null) result.taux_tva = info.tva; }
      } else if (/steg|sonede/i.test(text)) {
        const key = /steg/i.test(text) ? 'steg' : 'sonede';
        const info = FOURNISSEURS_TN[key];
        if (info) { fourniInfo = info; result.categorie_sce = info.cat; if (result.taux_tva === null) result.taux_tva = info.tva; }
      }
    }

    if (!result.categorie_sce) {
      if (/télécom|telecom|mobile|4g|internet|sms/i.test(searchLower))
        result.categorie_sce = 'frais_telecommunication';
      else if (/électricité|electricite|gaz|steg|sonede|eau/i.test(searchLower))
        result.categorie_sce = 'frais_energie';
      else if (/carburant|essence|gasoil|diesel|sndp|agil|total/i.test(searchLower))
        result.categorie_sce = 'frais_carburant';
      else if (/loyer|local|bureau|immeuble/i.test(searchLower))
        result.categorie_sce = 'loyer';
      else if (/honoraire|consultant|expert|avocat|architecte/i.test(searchLower))
        result.categorie_sce = 'honoraires';
      else if (/transport|livraison|coursier/i.test(searchLower))
        result.categorie_sce = 'frais_transport';
      else if (/assurance/i.test(searchLower))
        result.categorie_sce = 'frais_assurance';
      else if (/fourniture|bureau|papier|cartouche|toner/i.test(searchLower))
        result.categorie_sce = 'fournitures_bureau';
      else if (/informatique|ordinateur|logiciel|software|hardware|souris|usb|disque|boitier|imprimante|clavier|écran|ecran|micro|pc|laptop|serveur|ramitech|e.?info/i.test(searchLower))
        result.categorie_sce = 'frais_informatique';
      else if (/publicité|marketing|affiche|banner/i.test(searchLower))
        result.categorie_sce = 'frais_publicite';
      else
        result.categorie_sce = 'services_exterieurs';
    }

    if (result.categorie_sce && CATEGORIES_SCE[result.categorie_sce]) {
      result.code_comptable = CATEGORIES_SCE[result.categorie_sce].code;
    }

    // ══════════════════════════════════════════
    // 13. INFÉRER TAUX TVA depuis montants ou lignes
    // ══════════════════════════════════════════
    if (!result.taux_tva && result.montant_ht && result.montant_tva) {
      const taux = Math.round((result.montant_tva / result.montant_ht) * 100);
      if ([7, 13, 19].includes(taux)) result.taux_tva = taux;
    }
    // Fallback: détecter TVA depuis les lignes du tableau
    if (!result.taux_tva && result.lignes && result.lignes.length > 0) {
      const comptage = {};
      for (const line of text.split('\n')) {
        const m = line.match(/^\[?\s*.+?\s+(\d{1,2})\s*(?:\|\s*)?\d[\d,]+/);
        if (m && [0, 7, 13, 19].includes(parseInt(m[1]))) {
          const t = parseInt(m[1]);
          comptage[t] = (comptage[t] || 0) + 1;
        }
      }
      const best = Object.entries(comptage).sort((a, b) => b[1] - a[1])[0];
      if (best) result.taux_tva = parseInt(best[0]);
    }

    // ══════════════════════════════════════════
    // 14. INFÉRER HT depuis TTC si absent
    // ══════════════════════════════════════════
    if (!result.montant_ht && result.montant_ttc) {
      const timb = result.timbre_fiscal || 0;
      if (result.taux_tva) {
        const base = (result.montant_ttc - timb) / (1 + result.taux_tva / 100);
        result.montant_ht = parseFloat(base.toFixed(3));
      } else {
        // Fallback simple: TTC - timbre ≈ HT (quand taux TVA inconnu)
        result.montant_ht = parseFloat((result.montant_ttc - timb).toFixed(3));
      }
    }

    validerCalculs(result);

  } catch (e) {
    console.error('parseFactureTunisienne error:', e);
  }

  const tousChamps = ['fournisseur','date','montant_ht','taux_tva','montant_ttc','numero_facture'];
  const trouves = tousChamps.filter(f =>
    result[f] !== null && result[f] !== undefined && result[f] !== ''
  ).length;
  result.confidence = Math.round((trouves / tousChamps.length) * 100);
  result.champs_manquants = tousChamps.filter(f =>
    result[f] === null || result[f] === undefined || result[f] === ''
  );
  return result;
}

// ──────────────────────────────────────────────────
// Fonction 3: validerCalculs(data)
// ──────────────────────────────────────────────────
function validerCalculs(data) {
  const TOLERANCE = 0.010;

  if (data.montant_ht != null && data.taux_tva != null) {
    const base  = parseFloat((data.montant_ht + (data.fodec || 0)).toFixed(3));
    const timb  = data.timbre_fiscal ?? 1.000;
    const rs    = data.retenue_source || 0;

    // TVA: utiliser valeur explicite (taux mixtes) ou calculer depuis taux unique
    const tva = data.montant_tva != null
      ? data.montant_tva
      : parseFloat((base * data.taux_tva / 100).toFixed(3));

    // TTC: utiliser valeur existante (ex: somme lignes) ou calculer depuis HT+TVA+timbre
    const ttc = data.montant_ttc != null
      ? data.montant_ttc
      : parseFloat((base + tva + timb).toFixed(3));

    const net = parseFloat((ttc - rs).toFixed(3));

    if (data.base_tva == null)    data.base_tva    = base;
    if (data.montant_tva == null) data.montant_tva = tva;

    if (data.montant_ttc == null) {
      data.montant_ttc = ttc;
    } else if (Math.abs(ttc - data.montant_ttc) > TOLERANCE) {
      data.flag_incoherence = true;
    }

    if (data.net_a_payer == null) data.net_a_payer = net;
  }

  const requis = ['fournisseur', 'date', 'montant_ht', 'taux_tva', 'montant_ttc'];
  data.champs_manquants = requis.filter(f => data[f] == null);

  return data;
}

// ──────────────────────────────────────────────────
// Fonction 1: scanFacture(file, onProgress)
// ──────────────────────────────────────────────────
async function preprocessImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    const timer = setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error('Prétraitement image trop long'));
    }, 30000);
    img.onload = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      const maxDim = 2000;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
        else { width = Math.round(width * maxDim / height); height = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const pngTimer = setTimeout(() => reject(new Error('Conversion PNG trop long')), 15000);
      canvas.toBlob(blob => {
        clearTimeout(pngTimer);
        resolve(new File([blob], file.name, { type: 'image/png' }));
      }, 'image/png');
    };
    img.onerror = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      reject(new Error('Image invalide'));
    };
    img.src = url;
  });
}

async function scanFacture(file, onProgress) {
  const isPdf = file?.type === 'application/pdf' || /\.pdf$/i.test(file?.name || '');
  if (isPdf) {
    return {
      error: 'PDF détecté — convertissez en image avant OCR.',
      champs_manquants: ['all']
    };
  }

  try {
    onProgress?.(5, 'Prétraitement de l\'image...');
    file = await preprocessImage(file);
    onProgress?.(10, 'Initialisation du moteur OCR...');

    const basePath = window.location.pathname.startsWith('/Smart-comptable/')
      ? '/Smart-comptable/tesseract/'
      : '/tesseract/';

    const TIMEOUT_MS = 300000;
    let timedOut = false;

    const recoPromise = Tesseract.recognize(file, 'fra', {
      workerPath: basePath + 'worker.min.js',
      corePath: basePath + 'tesseract-core.wasm.js',
      langPath: 'https://tessdata.projectnaptha.com/4.0.0',
      logger: (m) => {
        if (m.status === 'recognizing text') {
          onProgress?.(10 + Math.round(m.progress * 85), `Reconnaissance OCR... ${Math.round(m.progress * 100)}%`);
        }
      }
    }).catch(err => {
      if (timedOut) return { data: { text: '', confidence: 0 } };
      throw err;
    });

    const { data: { text, confidence } } = await Promise.race([
      recoPromise,
      new Promise((_, reject) =>
        setTimeout(() => {
          timedOut = true;
          reject(new Error('Délai d\'attente dépassé (5 min)'));
        }, TIMEOUT_MS)
      )
    ]);

    onProgress?.(97, 'Analyse du texte extrait...');

    if (!text || text.trim().length < 10) {
      return {
        error: 'Image illisible — utilisez une image plus nette (min 150 DPI)',
        champs_manquants: ['all'],
        confidence: 0
      };
    }

    onProgress?.(98, 'Parsing de la facture...');
    const parsed = parseFactureTunisienne(text);
    parsed.confidence = Math.round(confidence);
    parsed.rawText = text;

    onProgress?.(99, 'Validation des calculs...');
    const validated = validerCalculs(parsed);

    onProgress?.(100, 'Terminé ✓');
    return validated;

  } catch (err) {
    const msg = err.message && err.message.includes('Délai')
      ? err.message
      : `OCR échoué: ${err.message || 'Erreur inconnue'}`;
    return { error: msg, champs_manquants: ['all'] };
  }
}

// ──────────────────────────────────────────────────
// Exemple test — Facture "STE BONJOUR"
// ──────────────────────────────────────────────────
const TEST_STE_BONJOUR = (() => {
  const text = [
    'STE BONJOUR',
    'Matricule: 1234567/X/A/M/000',
    'Facture N° FA20BJ001',
    'Date: 15/03/2023',
    '',
    'Produit X       58.962 DT    15     884.425 DT',
    '',
    'Total HT            884.425 DT',
    'TVA 13%             114.975',
    'Timbre                0.600',
    'Total TTC          1 000.000 DT',
  ].join('\n');

  const expected = {
    fournisseur: 'STE BONJOUR',
    numero_facture: 'FA20BJ001',
    montant_ht: 884.425,
    fodec: 0,
    base_tva: 884.425,
    taux_tva: 13,
    montant_tva: 114.975,
    timbre_fiscal: 0.600,
    retenue_source: 0,
    montant_ttc: 1000.000,
    net_a_payer: 1000.000,
    flag_incoherence: false,
    champs_manquants: [],
    lignes: [{
      designation: 'Produit X',
      prix_unitaire: 58.962,
      quantite: 15,
      total: 884.425,
    }],
    confidence: 100,
  };

  return { text, expected };
})();

// ──────────────────────────────────────────────────
// Exports
// ──────────────────────────────────────────────────
export default scanFacture;
export { parseFactureTunisienne, validerCalculs, CATEGORIES_SCE, FOURNISSEURS_TN, TEST_STE_BONJOUR, generateInvoiceNumber, saveOrUpdateFournisseur };
