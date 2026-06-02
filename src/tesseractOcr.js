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

// ──────────────────────────────────────────────────
// Détection fournisseur
// ──────────────────────────────────────────────────
function detectFournisseur(text) {
  const partFournisseur = text.split(/FACTURÉ\s*[ÀA]\s*:/i)[0];
  const lines = partFournisseur
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length >= 3);

  const IGNORE = /^(avenue|rue|route|impasse|bd\s|boulevard|bp\s|b\.p\.|1002|1000|tunis|sfax|sousse|bizerte|nabeul|ariana|\+216|tél|tel:|fax|email|e-mail|www\.|http|facture\s+client|relevé|relevé\s+de|facturé|société\s+abc|période|date|n°\s*facture|ref|objet|rib|swift|règlement|virement)/i;

  for (const line of lines) {
    if (!line || line.length > 65) continue;
    if (IGNORE.test(line)) continue;
    if (/^\d+$/.test(line)) continue;
    if (/^\W+$/.test(line)) continue;
    if (!(/[A-Za-zÀ-ü]{2,}/).test(line)) continue;

    const clean = line
      .replace(/\s*(MF\s*:|Tél\s*:|Tel\s*:|—{2,}|\|).*/i, '')
      .replace(/^['\s]+/, '')
      .trim();

    if (clean.length >= 3) return clean;
  }
  return null;
}

// ──────────────────────────────────────────────────
// Détection numéro de facture
// ──────────────────────────────────────────────────
function detectNumeroFacture(text) {
  const patterns = [
    /(?:Facture\s*N°?|N°\s*Facture|N°|Ref|Réf)\s*[:\s]*([A-Z]{2,4}[-\/]?\d{4}[-\/]\d{3,6})/i,
    /\b(FAC|INV|FC|FV|FA|BL|DST|OOR|STEG|MPX)[-\/](\d{4})[-\/](\d{3,6})\b/i,
    /\b([A-Z]{2}\d{2}[A-Z]{2}\d{3,})\b/,
    /(?:Facture|N°)\s*[:\s]*(\d{4,})/i,
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      if (m[2] && m[3]) return `${m[1]}-${m[2]}-${m[3]}`;
      return (m[1] || m[0]).trim();
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
  const sections = text.split(/FACTURÉ\s*[ÀA]\s*:/i);
  const partFournisseur = sections[0] || text;

  const MF_REGEX = /(\d{7})\s*[\/\\]\s*([A-HJ-NP-TV-Z])\s*[\/\\]\s*([AB])\s*[\/\\]\s*([MNPE])\s*[\/\\]\s*(\d{3})/i;

  const m1 = partFournisseur.match(MF_REGEX);
  if (m1) return `${m1[1]}/${m1[2]}/${m1[3]}/${m1[4]}/${m1[5]}`;

  const mfLabel = text.match(
    /(?:MF|Matricule\s*[Ff]iscal[e]?)\s*[:\-]?\s*(\d{7}[\/\\][A-Z][\/\\][A-Z][\/\\][A-Z][\/\\]\d{3})/i
  );
  if (mfLabel) return mfLabel[1].replace(/\\/g, '/');

  return null;
}

// ──────────────────────────────────────────────────
// Détection lignes articles
// ──────────────────────────────────────────────────
function detectLignes(text) {
  const lignes = [];
  const sauts = text.replace(/\r\n/g, '\n').split('\n');
  const bruitLigne = /^(total|tva|ht|ttc|net|timbre|fodec|retenue|remise|taux|reference|observation)/i;

  for (const line of sauts) {
    const l = line.trim();
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
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const textLower = text.toLowerCase();

    // ══════════════════════════════════════════
    // 1. FOURNISSEUR — stopper à newline, max 60 chars
    // ══════════════════════════════════════════
    const fournPatterns = [
      /(?:Fournisseur|Vendeur|Émetteur|Prestataire)\s*[:\-]\s*([^\n\r]{3,60})/i,
      /(?:Société|Ste|Sté|SARL|S\.A\.R\.L|S\.A\.|SNC)\s+([^\n\r,]{3,55})/i,
    ];
    for (const p of fournPatterns) {
      const m = text.match(p);
      if (m) {
        let nom = m[1].trim()
          .replace(/\s*(MF|Tél|Tel|Email|e-mail|www\.|N°|Matricule|—|-{2,}).*/i, '')
          .trim();
        if (nom.length >= 3 && nom.length <= 60) {
          result.fournisseur = nom;
          break;
        }
      }
    }
    // Fallback: première ligne significative (majuscules, min 5 chars)
    if (!result.fournisseur) {
      const stopWords = /^(date|facture|client|objet|ref|n°|avenue|rue|route|bp|tél|tel|email|www|mf|matricule|période|relevé|facturé|société\s+abc|1002|1000)/i;
      for (const line of lines.slice(0, 8)) {
        if (line.length < 3 || line.length > 65) continue;
        if (stopWords.test(line)) continue;
        if (/^\d+$/.test(line)) continue;
        if (/^\+216/.test(line)) continue;
        if (/[A-Za-zÀ-ü]/.test(line)) {
          result.fournisseur = line
            .replace(/\s*(MF|Tél|Tel|—|-{2,}|FACTURÉ).*/i, '')
            .trim();
          break;
        }
      }
    }

    // ══════════════════════════════════════════
    // 2. MATRICULE FISCAL — format tunisien exact
    // ══════════════════════════════════════════
    // Couper à "FACTURÉ À" pour ignorer la partie client
    const textFournisseurMF = text.split(/FACTURÉ\s+[ÀA]/i)[0];
    const mfPatterns = [
      /(\d{7})\s*[\/\\]\s*([A-HJ-NP-TV-Z])\s*[\/\\]\s*([AB])\s*[\/\\]\s*([MNPE])\s*[\/\\]\s*(\d{3})/i,
      /MF\s*[:\-]?\s*(\d{7}[\/\\][A-Z][\/\\][A-Z][\/\\][A-Z][\/\\]\d{3})/i,
      /Matricule\s*[Ff]iscal[e]?\s*[:\-]?\s*(\d{7}[\/\\][A-Z][\/\\][A-Z][\/\\][A-Z][\/\\]\d{3})/i,
    ];
    for (const p of mfPatterns) {
      const m = (textFournisseurMF.match(p) || text.match(p));
      if (m) {
        result.matricule_fiscal = m[1] ||
          `${m[1]}/${m[2]}/${m[3]}/${m[4]}/${m[5]}`;
        break;
      }
    }

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
    for (const { r, fn } of datePatterns) {
      const m = text.match(r);
      if (m) {
        const d = fn(m);
        // Valider date (éviter 2026-02-29 etc.)
        if (!isNaN(Date.parse(d))) { result.date = d; break; }
      }
    }

    // ══════════════════════════════════════════
    // 4. NUMÉRO FACTURE — patterns tunisiens précis
    // ══════════════════════════════════════════
    const numPatterns = [
      /(?:N°\s*Facture|Facture\s*N°?|Ref(?:érence)?)\s*[:\s]+([A-Z]{2,4}[-\/]\d{4}[-\/]\d{3,6})/i,
      /\b((?:FAC|INV|FC|FV|FA|BL|DST|OOR|MPX|STEG)[-\/]\d{4}[-\/]\d{3,6})\b/i,
      /\b([A-Z]{2}\d{2}[A-Z]{2}\d{3,})\b/,  // FA20BJ001
      /(?:N°|Num(?:éro)?)\s*[:\s]+(\d{4,})/i,
    ];
    for (const p of numPatterns) {
      const m = text.match(p);
      if (m) { result.numero_facture = m[1].trim(); break; }
    }

    // ══════════════════════════════════════════
    // 5. MONTANT HT — chercher DERNIÈRE occurrence
    // ══════════════════════════════════════════
    const htPatterns = [
      /(?:Total\s+HT|Montant\s+HT|Sous[\-\s]total\s+HT|Net\s+HT|Base\s+HT)\s*[:\-]?\s*([\d\s\.,]+\d)/gi,
      /\bHT\b\s*[:\-]?\s*([\d\s\.,]+\d)/gi,
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
      /(?:Montant\s+TVA|TVA\s*(?:\d+\s*%)?\s*[:\-])\s*([\d\s\.,]+\d)/gi,
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
    // 10. TOTAL TTC / NET À PAYER
    // ══════════════════════════════════════════
    const ttcPatterns = [
      /(?:Total\s+TTC|Montant\s+TTC|TOTAL\s+TTC)\s*[:\-]?\s*([\d\s\.,]+\d)/gi,
      /(?:Net\s+[àa]\s+[Pp]ayer|Montant\s+[Nn]et)\s*[:\-]?\s*([\d\s\.,]+\d)/gi,
      /(?:المبلغ\s+الجملي|الإجمالي)\s*[:\-]?\s*([\d\s\.,]+\d)/gi,
    ];
    for (const p of ttcPatterns) {
      const matches = [...text.matchAll(p)];
      if (matches.length > 0) {
        const last = matches[matches.length - 1];
        const val = normaliserMontant(last[1]);
        if (val && val > 0) { result.montant_ttc = val; break; }
      }
    }

    // ══════════════════════════════════════════
    // 11. LIGNES ARTICLES — tableau facture
    // ══════════════════════════════════════════
    result.lignes = [];
    const lignePatterns = [
      /^(.{3,50}?)\s{2,}([\d\.,]+)\s+([\d]+)\s+([\d\s\.,]+\d)\s*(?:DT)?$/gm,
      /(?:Désignation|Article|Produit|Service)\s*[:\-]?\s*(.+?)(?:Qté?|Quantité)\s*[:\-]?\s*(\d+).*?(?:PU|P\.U\.|Prix\s+[Uu]nitaire)\s*[:\-]?\s*([\d\.,]+)/gi,
    ];
    for (const p of lignePatterns) {
      const matches = [...text.matchAll(p)];
      for (const m of matches) {
        const pu  = normaliserMontant(m[3] || m[2]);
        const qte = parseInt(m[2] || m[3]);
        if (pu && qte && !isNaN(qte)) {
          result.lignes.push({
            designation:   m[1].trim().replace(/^(Désignation|Article)\s*[:\-]?\s*/i, ''),
            prix_unitaire: pu,
            quantite:      qte,
            total:         parseFloat((pu * qte).toFixed(3))
          });
        }
      }
      if (result.lignes.length > 0) break;
    }

    // ══════════════════════════════════════════
    // 12. AUTO-DÉTECTION FOURNISSEUR → catégorie
    // ══════════════════════════════════════════
    const searchText = (result.fournisseur || '') + ' ' + text;
    const searchLower = searchText.toLowerCase();
    let fourniInfo = null;
    for (const [key, info] of Object.entries(FOURNISSEURS_TN)) {
      const pattern = key.length <= 3
        ? new RegExp(`\\b${key}\\b`, 'i')
        : new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      if (pattern.test(searchLower)) { fourniInfo = info; break; }
    }
    if (fourniInfo) {
      result.categorie_sce  = fourniInfo.cat;
      if (result.taux_tva === null) result.taux_tva = fourniInfo.tva;
      if (fourniInfo.timbre === 0)  result.timbre_fiscal = 0;
      if (fourniInfo.rs > 0 && result.retenue_source === 0) result.taux_rs = fourniInfo.rs;
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
      else if (/informatique|ordinateur|logiciel|software|hardware/i.test(searchLower))
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
    // 13. INFÉRER TAUX TVA depuis montants si absent
    // ══════════════════════════════════════════
    if (!result.taux_tva && result.montant_ht && result.montant_tva) {
      const taux = Math.round((result.montant_tva / result.montant_ht) * 100);
      if ([7, 13, 19].includes(taux)) result.taux_tva = taux;
    }

    // ══════════════════════════════════════════
    // 14. INFÉRER HT depuis TTC si absent
    // ══════════════════════════════════════════
    if (!result.montant_ht && result.montant_ttc && result.taux_tva) {
      const timb = result.timbre_fiscal || 0;
      const base = (result.montant_ttc - timb) / (1 + result.taux_tva / 100);
      result.montant_ht = parseFloat(base.toFixed(3));
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
    const tva   = parseFloat((base * data.taux_tva / 100).toFixed(3));
    const timb  = data.timbre_fiscal ?? 1.000;
    const ttc   = parseFloat((base + tva + timb).toFixed(3));
    const rs    = data.retenue_source || 0;
    const net   = parseFloat((ttc - rs).toFixed(3));

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
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
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
      canvas.toBlob(blob => {
        resolve(new File([blob], file.name, { type: 'image/png' }));
      }, 'image/png');
    };
    img.src = url;
  });
}

async function scanFacture(file, onProgress) {
  if (file?.type === 'application/pdf') {
    return {
      error: 'PDF détecté — convertissez en image avant OCR.',
      champs_manquants: ['all']
    };
  }

  let worker;

  try {
    onProgress?.(5);
    file = await preprocessImage(file);
    onProgress?.(10);

    worker = await Tesseract.createWorker('fra', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          onProgress?.(10 + Math.round(m.progress * 85));
        }
      }
    });
    await worker.setParameters({ tessedit_pageseg_mode: '6' });

    const TIMEOUT_MS = 180000;
    const { data: { text, confidence } } = await Promise.race([
      worker.recognize(file),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Délai d\'attente dépassé (3 min)')), TIMEOUT_MS)
      )
    ]);

    await worker.terminate();
    onProgress?.(95);

    if (!text || text.trim().length < 10) {
      return {
        error: 'Image illisible — utilisez une image plus nette (min 150 DPI)',
        champs_manquants: ['all'],
        confidence: 0
      };
    }

    const parsed = parseFactureTunisienne(text);
    parsed.confidence = Math.round(confidence);
    const validated = validerCalculs(parsed);

    onProgress?.(100);
    return validated;

  } catch (err) {
    await worker?.terminate();
    const msg = err.message === 'Délai d\'attente dépassé (3 min)'
      ? err.message
      : `OCR échoué: ${err.message}`;
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
export { parseFactureTunisienne, validerCalculs, CATEGORIES_SCE, FOURNISSEURS_TN, TEST_STE_BONJOUR };
