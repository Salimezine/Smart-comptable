/**
 * tesseractOcr.js — OCR local pour factures tunisiennes
 *
 * Stack: Tesseract.js v5 (CDN), window.Tesseract
 * Conformité: TVA 7/13/19%, FODEC, Timbre LF2023, Retenue Source
 */

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

const RGX_NUM = [
  /(?:Facture|N°|N\s*°|FAC|INV|FC|FV|FA|BL|REF)\s*[:\-\s]*([A-Z0-9]{4,})/i,
  /([A-Z]{2}\d{2}[A-Z]{2}\d{3,})/,
  /(\d{4}[-\/]\d{3,6})/,
  /N°\s*(\d+)/i,
];

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
function normaliserMontant(str) {
  if (str == null) return null;
  let s = String(str).trim();
  if (!s) return null;
  s = s.replace(/\s+/g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : parseFloat(n.toFixed(3));
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
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const firstLines = lines.slice(0, 40);

  for (const line of firstLines) {
    const lower = line.toLowerCase();
    for (const key of Object.keys(FOURNISSEURS_TN)) {
      const regex = key.length <= 3
        ? new RegExp(`\\b${key}\\b`)
        : new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      if (regex.test(lower)) return line;
    }
  }

  const motsEntreprise = ['société', 'sarl', 'eurl', 's.a.r.l', 's.a.', 'sarl au', 'sarl à', 'company', 'bureau', 'cabinet', 'entreprise', 'ste', 'etablissement', 'générale'];
  const bruit = ['www.', '@', 'facture', 'n°', 'n°', 'tva', 'tel:', 'tél', 'fax', 'rc°', 'rib', 'matricule', 'adresse', 'banque', 'code', 'designation'];

  for (const kw of motsEntreprise) {
    const found = firstLines.find(l => l.toLowerCase().includes(kw) && l.length < 80);
    if (found) return found;
  }

  const companyLine = firstLines.find(l => {
    const lc = l.toLowerCase();
    if (l.length < 4 || l.length > 80) return false;
    if (bruit.some(n => lc.includes(n))) return false;
    if (/^\d/.test(l)) return false;
    const words = l.split(/\s+/);
    if (words.length < 2) return false;
    const capCount = words.filter(w => /^[A-ZÉÈÊËÀÂÄÙÛÜÔÖÎÏÇ]/.test(w[0])).length;
    return capCount >= Math.min(2, Math.ceil(words.length / 2));
  });
  if (companyLine) return companyLine;

  if (firstLines.length > 0) {
    const l = firstLines[0];
    if (l.length < 80 && l.length > 3 && !bruit.some(n => l.toLowerCase().includes(n)) && !/^\d/.test(l)) return l;
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
  if (y) return `${y[1]}-01-01`;
  return null;
}

// ──────────────────────────────────────────────────
// Détection matricule fiscal
// ──────────────────────────────────────────────────
function detectMF(text) {
  const m = RGX_MF.exec(text);
  if (m) return `${m[1]}/${m[2].toUpperCase()}/${m[3].toUpperCase()}/${m[4].toUpperCase()}/${m[5]}`;
  const simple = /(\d{7})\s*[\/\\]\s*([A-Z0-9])/i.exec(text);
  return simple ? `${simple[1]}/${simple[2].toUpperCase()}` : null;
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
    fournisseur: null,
    matricule_fiscal: null,
    date: null,
    numero_facture: null,
    montant_ht: null,
    fodec: 0,
    base_tva: null,
    taux_tva: null,
    montant_tva: null,
    timbre_fiscal: 1.000,
    retenue_source: 0,
    taux_rs: 0,
    montant_ttc: null,
    net_a_payer: null,
    categorie_sce: null,
    code_comptable: null,
    lignes: [],
    devise: 'DT',
    flag_incoherence: false,
    champs_manquants: [],
    source: 'ocr_tesseract',
    confidence: 0,
  };

  try {
    result.fournisseur = detectFournisseur(text);
    result.date = detectDate(text);
    result.matricule_fiscal = detectMF(text);
    result.numero_facture = extrairePremier(RGX_NUM, text);
    result.lignes = detectLignes(text);

    const htStr = extraireDernier(RGX_HT, text);
    result.montant_ht = htStr ? normaliserMontant(htStr) : null;

    const tvaStr = extraireDernier(RGX_TVA, text);
    if (tvaStr) {
      const full = tvaStr;
      const tv = /(\d+[\.,]\d+)/.exec(full);
      result.montant_tva = tv ? normaliserMontant(tv[1]) : normaliserMontant(full);
      const tr = /(7|13|19)/.exec(full);
      if (tr) result.taux_tva = parseInt(tr[1]);
    }

    const tauxTvaLine = /TVA\s*(?:à|au|de)?\s*(7|13|19)\s*%/i.exec(text);
    if (!result.taux_tva && tauxTvaLine) result.taux_tva = parseInt(tauxTvaLine[1]);

    const fodecStr = extraireDernier(RGX_FODEC, text);
    result.fodec = fodecStr ? normaliserMontant(fodecStr) : 0;

    const timbreStr = extraireDernier(RGX_TIMBRE, text);
    if (timbreStr) result.timbre_fiscal = normaliserMontant(timbreStr);

    const rsStr = extraireDernier(RGX_RS, text);
    if (rsStr) {
      result.retenue_source = normaliserMontant(rsStr);
      const rsPct = /(1[.,]5|0[.,]5|3|10|2[.,]5)\s*%/.exec(text);
      if (rsPct) result.taux_rs = parseFloat(rsPct[1].replace(',', '.'));
    }

    const ttcStr = extraireDernier(RGX_TTC, text);
    result.montant_ttc = ttcStr ? normaliserMontant(ttcStr) : null;

    const fourniLower = result.fournisseur ? result.fournisseur.toLowerCase() : '';
    let fourniInfo = null;
    for (const [key, info] of Object.entries(FOURNISSEURS_TN)) {
      const r = key.length <= 3
        ? new RegExp(`\\b${key}\\b`)
        : new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      if (r.test(fourniLower)) {
        fourniInfo = info;
        break;
      }
    }

    if (fourniInfo) {
      result.categorie_sce = fourniInfo.cat;
      if (result.taux_tva === null) result.taux_tva = fourniInfo.tva;
      if (fourniInfo.timbre === 0) result.timbre_fiscal = 0;
    }

    if (result.categorie_sce && CATEGORIES_SCE[result.categorie_sce]) {
      result.code_comptable = CATEGORIES_SCE[result.categorie_sce].code;
    }

    // Appliquer les règles fournisseur pour la RS seulement si pas déjà détectée
    if (fourniInfo && fourniInfo.rs > 0 && result.retenue_source === 0) {
      result.taux_rs = fourniInfo.rs;
    }

    validerCalculs(result);
  } catch (e) {
    console.error('parseFactureTunisienne error:', e);
  }

  const tousChamps = ['fournisseur', 'date', 'montant_ht', 'taux_tva', 'montant_ttc', 'numero_facture'];
  const trouves = tousChamps.filter(f => result[f] !== null && result[f] !== undefined && result[f] !== '').length;
  result.confidence = Math.round((trouves / tousChamps.length) * 100);
  result.champs_manquants = tousChamps.filter(f => result[f] === null || result[f] === undefined || result[f] === '');

  return result;
}

// ──────────────────────────────────────────────────
// Fonction 3: validerCalculs(data)
// ──────────────────────────────────────────────────
function validerCalculs(data) {
  const TOLERANCE = 0.005;

  if (data.montant_ht !== null && data.taux_tva !== null) {
    const fodec = parseFloat((data.fodec || 0).toFixed(3));
    const base = parseFloat((data.montant_ht + fodec).toFixed(3));
    const tva = parseFloat((base * data.taux_tva / 100).toFixed(3));
    const timbre = data.timbre_fiscal != null ? data.timbre_fiscal : 0;
    const sousTotal = parseFloat((base + tva + timbre).toFixed(3));
    const rs = data.retenue_source || 0;
    const net = parseFloat((sousTotal - rs).toFixed(3));

    if (data.base_tva === null || data.base_tva === undefined) data.base_tva = base;
    if (data.montant_tva === null || data.montant_tva === undefined) data.montant_tva = tva;
    if (data.net_a_payer === null || data.net_a_payer === undefined) data.net_a_payer = net;

    if (data.montant_ttc !== null) {
      const diffTTC = Math.abs(sousTotal - data.montant_ttc);
      if (diffTTC > TOLERANCE) data.flag_incoherence = true;
    } else {
      data.montant_ttc = sousTotal;
    }

    if (data.net_a_payer === null || data.net_a_payer === undefined) {
      data.net_a_payer = parseFloat((data.montant_ttc - rs).toFixed(3));
    }

    // Appliquer règle retenue source seulement si TTC ≥ 1000
    if (data.retenue_source === 0 && data.taux_rs > 0 && data.montant_ttc >= 1000) {
      // Ne pas deviner le montant RS — l'OCR doit le trouver
    }
  }

  // Timbre: forfait LF2023 = 1 DT, sauf si déjà détecté via OCR
  if (data.timbre_fiscal === null || data.timbre_fiscal === undefined) {
    data.timbre_fiscal = 1.000;
    if (data.fournisseur) {
      const f = data.fournisseur.toLowerCase();
      if (f.includes('steg') || f.includes('sonede')) data.timbre_fiscal = 0;
    }
  }

  const requis = ['fournisseur', 'date', 'montant_ht', 'taux_tva', 'montant_ttc'];
  data.champs_manquants = requis.filter(f => data[f] === null || data[f] === undefined);

  return data;
}

// ──────────────────────────────────────────────────
// Fonction 1: scanFacture(file, onProgress)
// ──────────────────────────────────────────────────
async function scanFacture(file, onProgress) {
  if (file.type === 'application/pdf') {
    return {
      error: 'PDF non supporté. Faites une capture écran ou photo de la facture.',
      source: 'ocr_tesseract',
      champs_manquants: ['fournisseur', 'date', 'montant_ht', 'taux_tva', 'montant_ttc'],
    };
  }

  if (file.size > 10 * 1024 * 1024) {
    return {
      error: 'Fichier trop volumineux (max 10 Mo).',
      source: 'ocr_tesseract',
      champs_manquants: ['fournisseur', 'date', 'montant_ht', 'taux_tva', 'montant_ttc'],
    };
  }

  if (typeof Tesseract === 'undefined') {
    return {
      error: 'Tesseract.js n\'est pas chargé. Vérifiez votre connexion Internet.',
      source: 'ocr_tesseract',
      champs_manquants: ['fournisseur', 'date', 'montant_ht', 'taux_tva', 'montant_ttc'],
    };
  }

  try {
    onProgress?.(5);
    const { data } = await Tesseract.recognize(file, 'fra+ara', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          onProgress?.(Math.round(m.progress * 95) + 5);
        }
      },
    });

    onProgress?.(100);
    return parseFactureTunisienne(data.text);
  } catch (e) {
    console.error('scanFacture error:', e);
    return {
      fournisseur: null, date: null, numero_facture: null,
      montant_ht: null, fodec: 0, base_tva: null, taux_tva: null,
      montant_tva: null, timbre_fiscal: 1.000, retenue_source: 0, taux_rs: 0,
      montant_ttc: null, net_a_payer: null,
      categorie_sce: null, code_comptable: null, lignes: [],
      devise: 'DT', flag_incoherence: false, source: 'ocr_tesseract',
      confidence: 0, error: 'Échec OCR: ' + e.message,
      champs_manquants: ['fournisseur', 'date', 'montant_ht', 'taux_tva', 'montant_ttc'],
    };
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
