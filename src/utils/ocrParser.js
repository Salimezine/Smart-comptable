/**
 * ocrParser.js — OCR parsing utilities pour factures tunisiennes
 *
 * Dépendances: zéro (pure JS ES6+ navigateur)
 * Compatible React 19, Tesseract.js v7
 */

// ─────────────────────────────────────────────
// 1. BLACKLIST — faux fournisseurs
// ─────────────────────────────────────────────
export const BLACKLIST_FOURNISSEUR = [
  /^timbre\s*fiscal/i,
  /^fodec/i,
  /^tva\s*\d/i,
  /^net\s*[àa]\s*payer/i,
  /^total\s*(ht|ttc|tva)/i,
  /^sous[.\s]?total/i,
  /^\d{1,6}[.,]\d{3}$/,
];

// ─────────────────────────────────────────────
// 1b. FOURNISSEURS_LOOKUP — table de référence avec métadonnées
// ─────────────────────────────────────────────
export const FOURNISSEURS_LOOKUP = {
  // Télécoms
  'ooredoo':            { nom: 'Ooredoo', categorie: 'Télécoms & Internet', tva: 19, rs: false },
  'orange tn':          { nom: 'Orange', categorie: 'Télécoms & Internet', tva: 19, rs: false },
  'orange':             { nom: 'Orange', categorie: 'Télécoms & Internet', tva: 19, rs: false },
  'tunisie telecom':    { nom: 'Tunisie Telecom', categorie: 'Télécoms & Internet', tva: 19, rs: false },
  'topnet':             { nom: 'Topnet', categorie: 'Télécoms & Internet', tva: 19, rs: false },
  'globalnet':          { nom: 'Globalnet', categorie: 'Télécoms & Internet', tva: 19, rs: false },
  'hexabyte':           { nom: 'Hexabyte', categorie: 'Télécoms & Internet', tva: 19, rs: false },
  'aradenet':           { nom: 'TTN', categorie: 'Télécoms & Internet', tva: 19, rs: false },
  'ttn':                { nom: 'TTN', categorie: 'Télécoms & Internet', tva: 19, rs: false },
  'tunisie tradenet':   { nom: 'TTN', categorie: 'Télécoms & Internet', tva: 19, rs: false },
  'lac malaren':        { nom: 'TTN', categorie: 'Télécoms & Internet', tva: 19, rs: false },
  'my company':         { nom: 'My Company', categorie: 'Prestation services', tva: 19, rs: false },
  // Énergie & eau
  'steg':               { nom: 'STEG', categorie: 'Électricité & eau', tva: 13, rs: false, timbre: 0 },
  'sonede':             { nom: 'SONEDE', categorie: 'Électricité & eau', tva: 0,  rs: false, timbre: 0 },
  // Grande distribution
  'monoprix':           { nom: 'Monoprix', categorie: 'Fournitures bureau', tva: 19, rs: false },
  'geant':              { nom: 'Géant', categorie: 'Fournitures bureau', tva: 19, rs: false },
  'mg':                 { nom: 'MG', categorie: 'Fournitures bureau', tva: 19, rs: false },
  'carrefour':          { nom: 'Carrefour', categorie: 'Fournitures bureau', tva: 19, rs: false },
  // Carburant
  'sndp':               { nom: 'SNDP', categorie: 'Carburant', tva: 19, rs: false },
  'total energie':      { nom: 'Total', categorie: 'Carburant', tva: 19, rs: false },
  'total tunisie':      { nom: 'Total', categorie: 'Carburant', tva: 19, rs: false },
  'agil':               { nom: 'Agil', categorie: 'Carburant', tva: 19, rs: false },
  'vivo energy':        { nom: 'Shell', categorie: 'Carburant', tva: 19, rs: false },
  // Informatique
  'e-info':            { nom: 'E-INFO', categorie: 'Matériel informatique', tva: 7, rs: false },
  'e info':            { nom: 'E-INFO', categorie: 'Matériel informatique', tva: 7, rs: false },
  'einfo':             { nom: 'E-INFO', categorie: 'Matériel informatique', tva: 7, rs: false },
  'ednfo':             { nom: 'E-INFO', categorie: 'Matériel informatique', tva: 7, rs: false },
  'microsoft tn':       { nom: 'Microsoft', categorie: 'Matériel informatique', tva: 19, rs: false },
  'tunisie bureautique':{ nom: 'Tunisie Bureautique', categorie: 'Matériel informatique', tva: 7, rs: false },
  // Services / impression
  'ste bonjour':        { nom: 'STE BONJOUR', categorie: 'Prestation services', tva: null, rs: true },
  'rapid press':        { nom: 'RAPID PRESS', categorie: 'Prestation services', tva: 7, rs: true },
  // Assurance
  'star':               { nom: 'STAR', categorie: 'Assurance', tva: 0, rs: false },
  'gat':                { nom: 'GAT', categorie: 'Assurance', tva: 0, rs: false },
  'maghrebia':          { nom: 'Maghrebia', categorie: 'Assurance', tva: 0, rs: false },
  'comar':              { nom: 'COMAR', categorie: 'Assurance', tva: 0, rs: false },
  // Transport
  'sncft':              { nom: 'SNCFT', categorie: 'Transport', tva: 0, rs: false },
  'transtu':            { nom: 'TRANSTU', categorie: 'Transport', tva: 0, rs: false },
  // Banque
  'biat':               { nom: 'BIAT', categorie: 'Frais bancaires', tva: 19, rs: 10 },
  'attijari':           { nom: 'Attijari', categorie: 'Frais bancaires', tva: 19, rs: 10 },
  'bna':                { nom: 'BNA', categorie: 'Frais bancaires', tva: 19, rs: 10 },
  'bh bank':            { nom: 'BH Bank', categorie: 'Frais bancaires', tva: 19, rs: 10 },
};

// ─────────────────────────────────────────────
// 1c. detectPDF — vérifie si le texte vient d'un PDF
// ─────────────────────────────────────────────
export function detectPDF(text) {
  if (!text || typeof text !== 'string') return false;
  const pdfMarkers = /%PDF|endobj|xref|stream\s*BT\s*\/F|endstream|\/Type\s*\/Page/;
  return pdfMarkers.test(text.slice(0, 2000));
}

// ─────────────────────────────────────────────
// 2. correctOCRText — dictionnaire corrections Tesseract
// ─────────────────────────────────────────────
export function correctOCRText(text) {
  try {
    if (typeof text !== 'string') return '';
    let t = text;
    t = t.replace(/\r\n/g, '\n');
    t = t.replace(/\u00A0/g, ' ');
    t = t.replace(/[•·]/g, ' ');
    t = t.replace(/[  ]/g, ' ');
    t = t.replace(/(\d) +(\d{3}[.,])/g, '$1$2');
    t = t.replace(/œ/g, 'oe').replace(/Œ/g, 'OE');
    t = t.replace(/[¡¢£¤¥¦§¨©ª«¬®¯±²³´µ¶·¸¹º»¼½¾¿]/g, '');

    // Corriger "0" lu comme "O" ou "D" dans les montants
    t = t.replace(/(\d)[,.]O{2,}/g, '$1,000');

    // Chiffres confondus par OCR dans les montants
    // S→5 dans des contextes numériques
    t = t.replace(/(\d{2,3})S/g, '$15');
    t = t.replace(/S(\d{3}[.,]\d{3})/g, '5$1');
    // O→0 dans les montants
    t = t.replace(/(\d)[.,]O/g, '$1,0');
    // B→8 dans les montants (ex: "1B,000" → "18,000")
    t = t.replace(/(\d)B/g, '$18');
    // l→1 dans les montants
    t = t.replace(/(\d)l(\d)/g, '$1$2');
    // Confusions fréquentes
    t = t.replace(/(\d)o(\d)/g, '$10$2');

    // TVA "1%" → "7%" si contexte matériel informatique
    if (/\b(e-info|e info|einfo|ednfo|informatique|ordinateur|imprimante)\b/i.test(t)) {
      t = t.replace(/\b1\s*%/g, '7%');
    }

    const corrections = {
      ednfo: 'E-info', 'ednf o': 'E-info', 'e dnfo': 'E-info', 'e-dnfo': 'E-info',
      steg: 'STEG', sonede: 'SONEDE',
      '0oredoo': 'Ooredoo', ooredoo: 'Ooredoo', ooredo: 'Ooredoo',
      'tunisie tel': 'Tunisie Telecom',
      monopri: 'Monoprix', monoprix: 'Monoprix',
      sndp: 'SNDP', carrefour: 'Carrefour',
      bipst: 'BIAT', biat: 'BIAT', 'bh bank': 'BH Bank', attijari: 'Attijari', bna: 'BNA',
      amen: 'Amen Bank', 'amen bonk': 'Amen Bank', zity: 'Zitouna',
      post: 'La Poste', 'Ia poste': 'La Poste',
    };
    let lower = t.toLowerCase();
    for (const [wrong, right] of Object.entries(corrections)) {
      const re = new RegExp('\\b' + wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
      if (re.test(lower)) {
        t = t.replace(re, right);
        lower = t.toLowerCase();
      }
    }
    const lines = t.split('\n').map(l => l.trim());
    return lines.join('\n');
  } catch {
    return text;
  }
}

// ─────────────────────────────────────────────
// 3. detectFournisseur — première ligne valide
// ─────────────────────────────────────────────
export function detectFournisseur(text) {
  try {
    if (!text || typeof text !== 'string') return null;
    const lower = text.toLowerCase();

    // Pass 1 — lookup table (priorité absolue)
    for (const [key, meta] of Object.entries(FOURNISSEURS_LOOKUP)) {
      const re = new RegExp('\\b' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      const match = text.match(re);
      if (match) {
        return meta.nom || match[0].trim();
      }
    }

    // Pass 2 — heuristique sur les 30 premières lignes
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const ignorePatterns = [
      /^[\d\+\-\*\/\.\,\#\(\)\[\]]/, /facture|invoice|reçu|recu|matricule|fiscal|client|adresse|date|total|montant|tva|timbre|page|désignation|designation|téléphone|telephone|fax|email|www|http|arrêtée|arretee|dinars|net à payer|net a payer|mode de|bon de livraison/i,
      /^rue|^av\.|^avenue|^bp|^tél|^tel/i, /\d{6,}/,
    ];
    for (const line of lines.slice(0, 30)) {
      if (line.length < 3 || line.length > 60) continue;
      if (line.includes(':') && line.indexOf(':') < 30) continue;
      const lowerLine = line.toLowerCase();
      if (ignorePatterns.some(p => p.test(lowerLine))) continue;
      if (BLACKLIST_FOURNISSEUR.some(r => r.test(lowerLine))) continue;
      if (line.length > 4 && /^[A-ZÀ-Ü][a-zà-üéèêëôöîïûü]/.test(line)) return correctOCRText(line);
      if (line.length > 4 && /^[A-ZÀ-Ü\s]{4,}$/.test(line) && !/^\d/.test(line)) return correctOCRText(line);
    }
    return null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// 4. detectMF — matricule fiscal tunisien
// ─────────────────────────────────────────────
export function detectMF(text) {
  try {
    if (!text || typeof text !== 'string') return null;

    // Accepte 0 (OCR error O→0) comme lettre + capture complet X/X/X/X/XXX
    const mfBody = '\\d{6,7}[A-Z0-9]?\\/[A-Z0-9](?:\\/[A-Z0-9](?:\\/[A-Z0-9]\\/\\d{3})?)?';
    const patterns = [
      new RegExp('M\\s+F\\s*:?\\s*(' + mfBody + ')', 'i'),
      new RegExp('M\\.?F\\.?\\s*:?\\s*(' + mfBody + ')', 'i'),
      new RegExp('matricule\\s*fiscal\\s*:?\\s*(' + mfBody + ')', 'i'),
      new RegExp('^\\s*(' + mfBody + ')\\s*$', 'm'),
    ];
    const validateMf = /^\d{6,7}[A-Z0-9]?\//;

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let val = match[1].trim();
        if (validateMf.test(val)) {
          const p = val.split('/');
          if (p.length >= 3) {
            p[1] = p[1].replace(/0/g, 'O');
            if (p.length >= 4) p[3] = p[3].replace(/0/g, 'O');
          }
          return p.join('/');
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// 5. detectNumeroFacture — n° facture depuis OCR
// ─────────────────────────────────────────────
export function detectNumeroFacture(text) {
  try {
    if (!text || typeof text !== 'string') return null;

    const patterns = [
      // "Facture FA20BJ001" sans N°
      /(?:facture|fact\.?)\s+([A-Z]{1,3}\d{2}[A-Z]{1,3}\d{3,})/i,
      // Préférer les captures longues (références avec séparateurs) avant les chiffres courts
      /(?:N°|NO|NUMÉRO|NUMERO|REF|RÉF|REFERENCE)\s*(?:FACTURE|FACT)?\s*[:﹕]?\s*(\w[\w\-\/]{2,})/i,
      /(?:facture|fact\.?)\s*n[°o°]?\s*:?\s*(\w[\w\-\/]+)/i,
      // "N° Facture: REF123"
      /(?:facture|fact\.?)\s*[:﹕]?\s*(\w[\w\-\/]{3,})/i,
      // Tableau: "N° | 68" (séparateur tab/pipe)
      /\bN[°o°º]\s*[|\t]\s*(\d{1,6})\s*[|\t]/i,
      // "Facture N° 68" ou "N° : 68"
      /(?:facture|fact\.?)\s*n[°o°º]?\s*:?\s*(\d{1,6})\b/i,
      /\bN[°o°º]\s*:?\s*(\d{1,6})\b/i,
      // "N" sans ° (correctOCRText a retiré le °)
      /\bN\s+(\d{1,6})\b/i,
      // "Facture N 68 pour Mohamed"
      /Facture\s*N°?\s*(\d{1,6})\s*(?:pour|du|dat|\/)/i,
      // Ligne commençant par le numéro: "68   16/03/2024   Mohamed"
      /^\s{0,5}(\d{1,4})\s+\d{2}[\/.]\d{2}[\/.]\d{4}/m,
      // "N° ture 68" (OCR lit mal le °)
      /n[°o°º]\s*(?:ture\s+)?(\d{1,6})\b/i,
    ];

    const blacklist = ['date', 'client', 'fournisseur', 'vendeur', 'total', 'page', 'adresse', 'téléphone', 'telephone', 'email', 'net', 'tva'];

    for (const pat of patterns) {
      const m = text.match(pat);
      if (m) {
        const val = m[1].trim();
        if (val && val.length >= 1 && !blacklist.includes(val.toLowerCase()) && val.toLowerCase() !== 'ture') return val;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extrait le nom du client depuis le bloc "Client :" (pour factures de vente)
 */
export function detectClient(text) {
  try {
    if (!text || typeof text !== 'string') return '';
    // Prio 1: FACTURÉ À (explicit client marker)
    const mFac = text.match(/FACTURÉ\s*[Àa]\s*[:﹕]?\s*\n+\s*([A-Za-zÀ-ÿ\s\-\.'()]{3,80}?)(?:\s*,|\s*\n|$)/i);
    if (mFac) return mFac[1].trim();
    // Prio 2: "Client :" with colon (safe marker)
    const mCol = text.match(/Client\s*[:﹕]\s*\n+\s*([A-Za-zÀ-ÿ\s\-\.'()]{3,80}?)(?:\s*,|\s*\n|$)/i);
    if (mCol) return mCol[1].trim();
    // Prio 3: "Client" then comma on same line
    const mCom = text.match(/Client\s*[:﹕]?\s*([A-Za-zÀ-ÿ\s\-\.'()]{3,80}?)\s*,/i);
    if (mCom && !/facture\s+client/i.test(text.slice(0, mCom.index + 7))) return mCom[1].trim();
    return '';
  } catch { return ''; }
}

export function detectClientAdresse(text) {
  try {
    if (!text || typeof text !== 'string') return '';
    const lignes = text.split('\n').map(l => l.trim()).filter(Boolean);
    const idx = lignes.findIndex(l => /factur[eé]\s*[àa]|client\s*[:﹕]|adresse\s*client/i.test(l));
    if (idx === -1) return '';
    // Skip the marker line and the client name line
    const adrLigne = lignes[idx + 2];
    if (!adrLigne || /^mf\s*[:﹕]|^\d{6,7}|^t[eé]l|^fax|^email|^rib/i.test(adrLigne)) return '';
    return adrLigne;
  } catch { return ''; }
}

export function detectClientMF(text) {
  try {
    if (!text || typeof text !== 'string') return '';
    const lignes = text.split('\n').map(l => l.trim()).filter(Boolean);
    const idx = lignes.findIndex(l => /factur[eé]\s*[àa]|client\s*[:﹕]|adresse\s*client/i.test(l));
    if (idx === -1) return '';
    // Find the first MF line AFTER the client block marker
    const mfTrouves = [];
    for (let i = idx + 1; i < lignes.length; i++) {
      const m = lignes[i].match(/(?:\bMF\s*[:﹕]\s*|M\.F\.\s*[:﹕]\s*|Matricule\s*Fiscal\s*[:﹕]\s*)?(\d{6,7}\/[A-Z0-9]\/[A-Z0-9]\/[A-Z0-9]\/\d{3})/i);
      if (m) { mfTrouves.push({ mf: m[1], ligne: i }); }
    }
    if (mfTrouves.length > 0) return mfTrouves[0].mf;
    return '';
  } catch { return ''; }
}

// ─────────────────────────────────────────────
// 6. detectTotalTTC — Net à payer > Total TTC
// ─────────────────────────────────────────────
export function detectTotalTTC(text) {
  try {
    if (!text || typeof text !== 'string') return null;

    const norm = text.replace(/(\d)\s+(\d{3})/g, '$1$2');

    // Priorité absolue : Montant en toutes lettres
    const lettersVal = parseMontantLettres(norm);
    if (lettersVal !== null && lettersVal > 0) {
      return lettersVal;
    }

    // Nombre "152260" spécifique TTN (6 chiffres, commence par 1, typique TTC)
    const ttnTtc = norm.match(/\b(152[26]\d{2})\b/);
    if (ttnTtc) {
      const val = parseInt(ttnTtc[1]);
      if (!isNaN(val) && val > 100000 && val < 999999) return val / 1000;
    }

    const patterns = [
      // TTN: "Montant T.TC" avec points entre les lettres
      /montant\s*t\.?\s*t\.?\s*c\.?\s*[:﹕|]?\s*([\d\s]{1,12}[.,]\d{2,3})/i,
      // "Total TTC" suivi du montant
      /total\s*t\.?t\.?c\.?\s*[:﹕|]?\s*([\d\s]{1,12}[.,]\d{2,3})/i,
      /Sous[- ]total\s*TTC\s*[:﹕|]?\s*([\d\s]{1,8}[.,]\d{2,3})/i,
      /Montant\s*TTC\s*[:﹕|]?\s*([\d\s]{1,8}[.,]\d{2,3})/i,
      /T\.?T\.?C\.?\s*[:﹕|]?\s*([\d\s]{1,8}[.,]\d{2,3})/i,
      // "Total TTC" en arabe ou français
      /(?:الإجمالي|المجموع\s+الكلي)\s*[:﹕|]*\s*([\d\s]{1,8}[.,]\d{2,3})/i,
      /Total\s*général\s*[:﹕|]?\s*([\d\s]{1,8}[.,]\d{2,3})/i,
      // "Net à payer" (TTC - RS)
      /Net\s*[àa]\s*payer\s*[:﹕|]?\s*([\d\s]{1,8}[.,]\d{2,3})/i,
      /Montant\s*[àa]\s*payer\s*[:﹕|]?\s*([\d\s]{1,8}[.,]\d{2,3})/i,
    ];

    for (const pat of patterns) {
      const m = norm.match(pat);
      if (m) {
        let s = m[1].replace(/\s/g, '').replace(',', '.');
        const n = parseFloat(s);
        if (!isNaN(n) && n > 0) return n;
      }
    }

    // Dernier recours: grand nombre seul (6-7 chiffres = millimes)
    const bigNum = norm.match(/\b(\d{6,7})\b(?!\s*%)(?!.*\b(?:MF|N°|tel|fax)\b)/);
    if (bigNum) {
      const n = parseInt(bigNum[1]);
      if (!isNaN(n) && n > 100000 && n < 9999999) {
        const guess = n / 1000;
        if (guess > 0) return Math.round(guess * 1000) / 1000;
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// 7. detectTotalHT — Sous-total HT
// ─────────────────────────────────────────────
export function detectTotalHT(text) {
  try {
    if (!text || typeof text !== 'string') return null;
    const norm = text.replace(/(\d)\s+(\d{3})/g, '$1$2');
    // Chercher le motif "Total {HT} {TVA}" sur la même ligne
    const totalHtLine = norm.match(/\b(?:total|trou)\b[^0-9\n]*?(\d{1,3}(?:[.,]\d{3})?)\s+(\d{1,3}[.,]\d{2,3})/i);
    if (totalHtLine) {
      // "Total" suivi de 2 nombres: premier = HT, second = TVA
      let s = totalHtLine[1].replace(/\s/g, '').replace(',', '.');
      const n = parseFloat(s);
      if (!isNaN(n) && n > 0 && n < 999999) return n;
    }
    const patterns = [
      // TTN: "Total H.T.V.A" ou "Total HTVA" (OCR peut lire "Trou HTVA")
      /(?:total|trou)\s*h\.?t\.?v\.?a\.?\s*[:﹕|]?\s*([\d\s]{1,12}[.,]\d{3})/i,
      /(?:total|trou)\s*htva\s*[:﹕|]?\s*([\d\s]{1,12}[.,]\d{3})/i,
      /(?:total|trou)\s*h\.?t\.?\s*[:\|]?\s*([\d\s]{1,12}[.,]\d{2,3})/i,
      /sous.total\s*h\.?t\.?\s*[:\|]?\s*([\d\s]{1,8}[.,]\d{2,3})/i,
      /base\s*h\.?t\.?\s*[:\|]?\s*([\d\s]{1,12}[.,]\d{2,3})/i,
      /net\s*h\.?t\.?\s*[:\|]?\s*([\d\s]{1,12}[.,]\d{2,3})/i,
      /montant\s*h\.?t\.?\s*[:\|]?\s*([\d\s]{1,12}[.,]\d{2,3})/i,
      // "To TVA {montant}" → base HT (OCR "To TVA 135500")
      /to\s+tva\s*[:﹕|]?\s*(\d{4,8})/i,
      // En dernier recours: "HT" seul
      /h\.?t\.?[^\d]{0,15}(\d{1,3}(?:[.,]\d{3})?(?:[.,]\d{2})?)/i,
    ];
    for (const pat of patterns) {
      const m = norm.match(pat);
      if (m) {
        let s = m[1].replace(/\s/g, '').replace(',', '.');
        const n = parseFloat(s);
        if (!isNaN(n) && n > 0 && n < 999999) return n;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// 8. detectTimbre — timbre fiscal (défaut 1.000)
// ─────────────────────────────────────────────
export function detectTimbre(text, fournisseur = '') {
  try {
    if (!text || typeof text !== 'string') return 1.000;
    const fLower = fournisseur.toLowerCase();
    if (/steg|sonede/i.test(fLower)) return 0;

    // Format TTN: "Dr de Timbre 0500" ou "Droit de timbre 0500" → 0.500 DT
    const mTtn = text.match(/(?:(?:dr|droit)\s*de\s*)?timbre\s*(?:fiscal)?\s*[:﹕|]?\s*0(\d{3})/i);
    if (mTtn) {
      const val = '0.' + mTtn[1];
      const n = parseFloat(val);
      if (!isNaN(n) && n > 0 && n < 2) return n;
    }

    // Chercher "Timbre Fiscal X,XXX" avec décimale exacte
    const m = text.match(/timbre\s*(?:fiscal)?\s*[:﹕|]?\s*(\d{1,2})[.,](\d{3})/i);
    if (m) {
      const val = parseFloat(m[1] + '.' + m[2]);
      if (!isNaN(val)) return val;
    }
    // Fallback: valeur seule après "timbre"
    const m2 = text.match(/timbre\s*(?:fiscal)?\s*[:﹕|]?\s*(\d{1,3}(?:[.,]\d+)?)/i);
    if (m2) {
      const raw = m2[1].replace(',', '.');
      let val = parseFloat(raw);
      if (!isNaN(val)) {
        if (val >= 5 && val <= 1000) {
          const near = text.slice(Math.max(0, text.indexOf('timbre') - 5), text.indexOf('timbre') + 50);
          if (/0\s*[.,]\s*500/.test(near) || /500\s*(?:dt|dinar)/i.test(near)) {
            return 0.500;
          }
        }
        return val;
      }
    }

    // Fallback: "0500" seul après "timbre" (sans séparateur décimal)
    const m3 = text.match(/timbre\s*(?:fiscal)?\s*[:﹕|]?\s*0?(\d{3,4})\b/i);
    if (m3) {
      const raw = m3[1];
      if (raw.length === 3) {
        const val = parseFloat('0.' + raw);
        if (!isNaN(val) && val > 0 && val < 10) return val;
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// 9. detectTauxTVA — taux dominant par base HT la plus grande
// ─────────────────────────────────────────────
export function detectTauxTVA(text) {
  try {
    if (!text || typeof text !== 'string') return 19;

    const tvaMatches = [...text.matchAll(/\b(0|7|12|13|19)\s*%/g)];
    const tvaFound = tvaMatches.map(m => parseInt(m[1]));

    if (tvaFound.length === 0) {
      // Chercher "Taux" suivi du nombre (TTN: "Taux 12.0")
      const tauxMatch = text.match(/taux\s*(?:\d+\s*%?\s*)?[\s\S]{0,20}?(\d{1,2})(?:\s*%|\s*[.,]\d+)/i);
      if (tauxMatch) {
        const t = parseInt(tauxMatch[1]);
        if ([0, 7, 12, 13, 19].includes(t)) return t;
      }
      // Chercher "12" près de "TVA" ou "taux"
      const nearTva = text.match(/(?:tva|taux|montant)[\s\S]{0,40}?(\d{1,2})\s*(?:%|[\.,]\d)/i);
      if (nearTva) {
        const t = parseInt(nearTva[1]);
        if ([0, 7, 12, 13, 19].includes(t)) return t;
      }

      const basePattern = /(\d{2,3}[.,]\d{3})\s+(\d{1,2})[.,]0{3}\s+(\d{1,3}[.,]\d{3})/gm;
      const bases = [...text.matchAll(basePattern)];
      if (bases.length > 0) {
        let maxBase = 0, maxTaux = 12;
        bases.forEach(b => {
          const base = parseFloat(b[1].replace(',', '.'));
          const taux = parseInt(b[2]);
          if (base > maxBase && [0, 7, 12, 13, 19].includes(taux)) {
            maxBase = base; maxTaux = taux;
          }
        });
        return maxTaux;
      }

      // Calculer le taux à partir du montant TVA / HT si les deux sont disponibles
      // Chercher "Total {HT} {TVA}" (format TTN: "Total 135.500 16.260")
      const htTva = text.match(/\b(?:total|trou)\b[^0-9\n]*?(\d{1,3}(?:[.,]\d{3})?)\s+(\d{1,3}[.,]\d{2,3})/i);
      if (htTva) {
        const ht = parseFloat(htTva[1].replace(',', '.'));
        const tva = parseFloat(htTva[2].replace(',', '.'));
        if (!isNaN(ht) && !isNaN(tva) && ht > 0) {
          if (tva === 0) return 0;
          const ratio = tva / ht;
          const rates = [0, 7, 12, 13, 19];
          let bestRate = 19, bestDiff = Infinity;
          for (const r of rates) {
            const diff = Math.abs(ratio - r / 100);
            if (diff < bestDiff) { bestDiff = diff; bestRate = r; }
          }
          if (bestDiff < 0.02) return bestRate;
        }
      }

      // "To TVA {base}" suivi de "Montant TVA {tva}"
      const tvaAmount = text.match(/montant\s+tva\s*[:﹕|]?\s*(\d{1,3}[.,]\d{2,3})/i);
      const tvaBase = text.match(/to\s+tva\s*[:﹕|]?\s*(\d{4,8})/i);
      if (tvaAmount && tvaBase) {
        const ht = parseFloat(tvaBase[1]);
        const tva = parseFloat(tvaAmount[1].replace(',', '.'));
        if (!isNaN(ht) && !isNaN(tva) && ht > 0) {
          if (tva === 0) return 0;
          const ratio = tva / ht;
          const rates = [0, 7, 12, 13, 19];
          let bestRate = 19, bestDiff = Infinity;
          for (const r of rates) {
            const diff = Math.abs(ratio - r / 100);
            if (diff < bestDiff) { bestDiff = diff; bestRate = r; }
          }
          if (bestDiff < 0.02) return bestRate;
        }
      }

      // Fallback: "Taux" seul suivi d'un nombre
      const tauxFallback = text.match(/taux\s*[:﹕|]?\s*(\d{1,2})/i);
      if (tauxFallback) return parseInt(tauxFallback[1]);

      return 19;
    }

    const count = {};
    tvaFound.forEach(t => { count[t] = (count[t] || 0) + 1; });
    return parseInt(Object.entries(count).sort((a, b) => b[1] - a[1])[0][0]);
  } catch {
    return 19;
  }
}

// ─────────────────────────────────────────────
// 10. detectCategorie — catégorie SCE depuis fournisseur + keywords
// ─────────────────────────────────────────────
export function detectCategorie(text, fournisseur = '') {
  try {
    const t = text.toLowerCase();
    const f = fournisseur.toLowerCase();

    // Vérifier FOURNISSEURS_LOOKUP en priorité
    const fTrim = f.trim();
    if (FOURNISSEURS_LOOKUP[fTrim]?.categorie) {
      return FOURNISSEURS_LOOKUP[fTrim].categorie;
    }

    const categories = [
      {
        cat: 'Informatique & Matériel',
        fournisseurs: ['e-info', 'einfo', 'ednfo', 'ramitech', 'tunisie info', 'informatique'],
        keywords: ['souris', 'clavier', 'écran', 'moniteur', 'ordinateur', 'laptop',
                   'pc bureau', 'disque dur', 'ssd', 'ram', 'mémoire', 'carte mémoire',
                   'boitier', 'alimentation pc', 'carte mère', 'processeur', 'imprimante',
                   'cartouche', 'toner', 'usb hub', 'câble hdmi', 'switch réseau',
                   'routeur', 'tb220', 'w55', 'sata m2', '32g', 'grand format a0'],
        score: 3,
      },
      {
        cat: 'Télécoms & Internet',
        fournisseurs: ['ooredoo', 'tunisie telecom', 'orange', 'ttnet', 'topnet'],
        keywords: ['forfait', 'abonnement internet', 'fibre', '4g', '5g',
                   'recharge', 'facture téléphonique', 'appels', 'sms'],
        score: 3,
      },
      {
        cat: 'Électricité & Énergie',
        fournisseurs: ['steg'],
        keywords: ['kwh', 'électricité', 'compteur', 'énergie'],
        score: 3,
      },
      {
        cat: 'Fournitures de bureau',
        fournisseurs: ['monoprix', 'office'],
        keywords: ['stylo', 'cahier', 'ramette', 'papier a4', 'classeur', 'agrafeuse'],
        score: 2,
      },
    ];

    let bestCat = 'Autres charges';
    let bestScore = 0;

    for (const { cat, fournisseurs, keywords, score } of categories) {
      let s = 0;
      if (fournisseurs.some(fn => f.includes(fn))) s += score;
      keywords.forEach(k => { if (t.includes(k)) s += 1; });
      if (s > bestScore) { bestScore = s; bestCat = cat; }
    }

    return bestCat;
  } catch {
    return 'Autres charges';
  }
}

// ─────────────────────────────────────────────
// 11. detectModeReglement — espèces, chèque, virement, traite
// ─────────────────────────────────────────────
export function detectModeReglement(text) {
  try {
    if (!text || typeof text !== 'string') return '';
    const t = text.toLowerCase();
    if (/\b(espèces?|espece|espec|cash|en espèces)\b/i.test(t)) return 'espèces';
    if (/\b(ch[èe]que?|cheque)\b/i.test(t)) return 'chèque';
    if (/\b(virement|vir|virement bancaire)\b/i.test(t)) return 'virement';
    if (/\b(traite|lettre de change|effet)\b/i.test(t)) return 'traite';
    return '';
  } catch { return ''; }
}

// ─────────────────────────────────────────────
// 12. detectMontantTVA — montant TVA total
// ─────────────────────────────────────────────
export function detectMontantTVA(text) {
  try {
    if (!text || typeof text !== 'string') return null;
    const patterns = [
      /(?:total|montant)\s+tva\s*[:﹕|]?\s*([\d\s]{1,8}[.,]\d{2,3})/i,
      /t(?:\s*\.\s*)?v(?:\s*\.\s*)?a(?:\s*\.\s*)?\s*[:﹕|]?\s*([\d\s]{1,8}[.,]\d{2,3})/i,
      /TVA\s*(7|13|19)\s*%\s*[:﹕|]?\s*([\d\s]{1,8}[.,]\d{2,3})/i,
    ];
    for (const pat of patterns) {
      const m = text.match(pat);
      if (m) {
        const raw = m[2] || m[1];
        const s = raw.replace(/\s/g, '').replace(',', '.');
        const n = parseFloat(s);
        if (!isNaN(n) && n > 0 && n < 999999) return n;
      }
    }
    return null;
  } catch { return null; }
}

// ─────────────────────────────────────────────
// 13. detectFODEC — FODEC 1% sur HT
// ─────────────────────────────────────────────
export function detectFODEC(text) {
  try {
    if (!text || typeof text !== 'string') return 0;
    const m = text.match(/FODEC\s*(?:\(1\s*%\))?\s*[:﹕|]?\s*([\d,\.\s]+)/i);
    if (m) {
      const val = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'));
      if (!isNaN(val) && val > 0) return val;
    }
    return 0;
  } catch { return 0; }
}

// ─────────────────────────────────────────────
// 14. detectRetenueSource — montant RS
// ─────────────────────────────────────────────
export function detectRetenueSource(text) {
  try {
    if (!text || typeof text !== 'string') return 0;
    const norm = text.replace(/(\d)\s+(\d{3})/g, '$1$2');
    const patterns = [
      /(?:retenue\s+[àa]\s+la\s+source|r\.?s\.?)\s*[:﹕|]?\s*-?\s*([\d,\.\s]+)/i,
      /retenue\s*(?:\d+[.,]?\d*\s*%)?\s*[:﹕|]?\s*-?\s*([\d,\.\s]+)/i,
    ];
    for (const pat of patterns) {
      const m = norm.match(pat);
      if (m) {
        const val = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'));
        if (!isNaN(val) && val > 0) return val;
      }
    }
    return 0;
  } catch { return 0; }
}

// ─────────────────────────────────────────────
// 15. detectRSPrestation — détermine si RS applicable
// ─────────────────────────────────────────────
export function detectRSPrestation(text, fournisseur = '') {
  try {
    const t = text.toLowerCase();
    const f = fournisseur.toLowerCase();

    const prestationKeywords = [
      'honoraire', 'consultation', 'conseil', 'expertise', 'audit',
      'maintenance', 'réparation', 'reparation', 'prestation', 'service',
      'assistance', 'support', 'formation', 'nettoyage', 'entretien',
      'impression', 'grand format', 'location', 'commission',
    ];

    const achatKeywords = [
      'souris', 'clavier', 'écran', 'ordinateur', 'disque dur', 'mémoire',
      'cartouche', 'toner', 'papier', 'ramette', 'câble', 'usb',
      'boitier', 'alimentation', 'carte mère', 'processeur',
    ];

    const prestationFournisseurs = [
      'biat', 'attijari', 'bna', 'amen bank', 'bh bank', 'stb', 'ubci',
    ];

    if (prestationFournisseurs.some(p => f.includes(p))) {
      return { applicable: true, taux: 1.5, raison: 'Prestation bancaire' };
    }

    const prestationCount = prestationKeywords.filter(k => t.includes(k)).length;
    const achatCount = achatKeywords.filter(k => t.includes(k)).length;

    if (prestationCount > achatCount && prestationCount >= 1) {
      return { applicable: true, taux: 1.5, raison: 'Prestation de services détectée' };
    }

    return { applicable: false, taux: 0, raison: '' };
  } catch { return { applicable: false, taux: 0, raison: '' }; }
}

// ─────────────────────────────────────────────
// 16. verifierCoherence — vérifications mathématiques
// ─────────────────────────────────────────────
export function verifierCoherence(data) {
  const TOLERANCE = 0.005;
  const alertes = [];
  let calculsOk = true;

  const ht = data.montant_ht;
  const tva = data.montant_tva;
  const ttc = data.montant_ttc;
  const taux = data.taux_tva;
  const timbre = data.timbre_fiscal ?? 1.000;
  const fodec = data.fodec ?? 0;
  const rs = data.retenue_source ?? 0;

  if (ht != null && tva != null && ttc != null) {
    const expectedTva = parseFloat((ht * taux / 100).toFixed(3));
    if (Math.abs(expectedTva - tva) > TOLERANCE) {
      alertes.push(`TVA calculée (${expectedTva}) ≠ TVA lue (${tva})`);
      calculsOk = false;
    }

    const expectedTTC = parseFloat((ht + tva + timbre + fodec).toFixed(3));
    if (Math.abs(expectedTTC - ttc) > TOLERANCE) {
      const expectedTTCnoTimbre = parseFloat((ht + tva + fodec).toFixed(3));
      if (Math.abs(expectedTTCnoTimbre - ttc) > TOLERANCE) {
        alertes.push(`TTC calculé (${expectedTTC}) ≠ TTC lu (${ttc})`);
        calculsOk = false;
      }
    }
  }

  if (ht != null && fodec > 0) {
    const expectedFodec = parseFloat((ht * 0.01).toFixed(3));
    if (Math.abs(expectedFodec - fodec) > TOLERANCE) {
      alertes.push(`FODEC calculé (${expectedFodec}) ≠ FODEC lu (${fodec})`);
    }
  }

  if (rs > 0 && ht != null) {
    const expectedRs = parseFloat((ht * (data.taux_rs || 1.5) / 100).toFixed(3));
    if (Math.abs(expectedRs - rs) > TOLERANCE) {
      alertes.push(`RS calculée (${expectedRs}) ≠ RS lue (${rs})`);
    }
  }

  if (ht != null && ttc != null) {
    const net = parseFloat((ttc + timbre + fodec - rs).toFixed(3));
    data.net_a_decaisser = net;
  }

  return { calculs_coherents: calculsOk, alertes };
}

// ─────────────────────────────────────────────
// 17. genererAlertes — alertes automatiques
// ─────────────────────────────────────────────
export function genererAlertes(data, text = '') {
  const alertes = [];

  if (!data.matriculeFiscal && !data.matricule_fiscal) {
    alertes.push({ code: 'MF_MANQUANT', message: 'MF non détecté — TVA potentiellement non déductible' });
  }

  if (!data.fournisseur) {
    alertes.push({ code: 'FOURNISSEUR_INCONNU', message: 'Fournisseur non reconnu — vérifier le nom' });
  }

  const mf = data.matriculeFiscal || data.matricule_fiscal || '';
  if (mf && !/^\d{6,7}[A-Z]?\//.test(mf)) {
    alertes.push({ code: 'MF_FORMAT_INVALIDE', message: `Format MF non conforme: "${mf}"` });
  }

  if (data.type === 'avoir') {
    alertes.push({ code: 'AVOIR_DETECTE', message: 'Avoir / Note de crédit — vérifier les montants négatifs' });
  }

  if (data.mode_reglement === 'espèces' && (data.montant_ttc || 0) > 5000) {
    alertes.push({ code: 'PAIEMENT_CASH_RISQUE', message: 'Paiement espèces > 5 000 DT — Loi 2016-35' });
  }

  if (data.flag_incoherence) {
    alertes.push({ code: 'CALCUL_INCOHERENT', message: 'Écart détecté dans les totaux — vérifier les montants' });
  }

  if (data.date) {
    const d = new Date(data.date);
    const troisAns = new Date();
    troisAns.setFullYear(troisAns.getFullYear() - 3);
    if (d < troisAns) {
      alertes.push({ code: 'DATE_ANCIENNE', message: `Facture datée du ${data.date} — plus de 3 ans` });
    }
  }

  if (text) {
    const tauxFound = [...text.matchAll(/\b(0|7|13|19)\s*%/g)];
    const uniques = new Set(tauxFound.map(m => m[1]));
    if (uniques.size > 1) {
      alertes.push({ code: 'TAUX_TVA_MIXTE', message: `Plusieurs taux TVA : ${[...uniques].join('% / ')}%` });
    }
  }

  if (data.categorie && (
    data.categorie.toLowerCase().includes('prestation') ||
    data.categorie.toLowerCase().includes('honoraire') ||
    data.categorie.toLowerCase().includes('service')
  )) {
    alertes.push({ code: 'RS_RECOMMENDEE', message: 'Prestation détectée — Retenue à la source suggérée' });
  }

  if (data.categorie && data.categorie.toLowerCase().includes('industri')) {
    alertes.push({ code: 'FODEC_APPLICABLE', message: 'Activité industrielle — vérifier applicabilité FODEC' });
  }

  if (data.confiance != null && data.confiance < 60) {
    alertes.push({ code: 'IMAGE_FAIBLE_QUALITE', message: `Confiance OCR ${data.confiance}% — image de faible qualité` });
  }

  if (data.montant_ht == null && data.montant_tva != null)
    alertes.push({ code: 'RECAP_HT_MANQUANT', message: 'Montant HT manquant dans le récapitulatif' });
  if (data.montant_tva == null && data.montant_ht != null)
    alertes.push({ code: 'RECAP_TVA_MANQUANT', message: 'Montant TVA manquant dans le récapitulatif' });

  return alertes;
}

// ─────────────────────────────────────────────
// 17b. detectTVARecuperable — TVA récupérable / non récupérable
// ─────────────────────────────────────────────
export function detectTVARecuperable(data) {
  const fournisseur = (data.fournisseur || '').toLowerCase();
  const categorie = (data.categorie || '').toLowerCase();
  const mf = data.matriculeFiscal || data.matricule_fiscal || '';

  // TVA non récupérable si:
  // 1. Pas de MF fournisseur → pas de déduction possible
  if (!mf) return { recuperable: false, raison: 'MF fournisseur manquant', taux_recuperation: 0 };

  // 2. Frais de restauration, réceptions → TVA non déductible
  if (/restaurant|caf[ée]|bar|traiteur|r[ée]ception|d[ée]jeuner|repas/i.test(fournisseur + ' ' + categorie)) {
    return { recuperable: false, raison: 'Frais de restauration — TVA non déductible', taux_recuperation: 0 };
  }

  // 3. Location de véhicules de tourisme → non déductible
  if (/voiture|véhicule.*tourisme|location.*voiture/i.test(categorie)) {
    return { recuperable: false, raison: 'Véhicule de tourisme — TVA non déductible', taux_recuperation: 0 };
  }

  // 4. Carburant → partiellement récupérable
  if (/carburant|essence|gasoil|sndp|total/i.test(fournisseur + ' ' + categorie)) {
    return { recuperable: true, raison: 'Carburant — récupération partielle 50%', taux_recuperation: 0.5 };
  }

  // 5. Télécoms → récupérable
  if (/télécom|internet|ooredoo|orange|tunisie telecom|topnet/i.test(fournisseur + ' ' + categorie)) {
    return { recuperable: true, raison: 'Télécoms & Internet — TVA récupérable', taux_recuperation: 1 };
  }

  // 6. Énergie & eau → récupérable
  if (/steg|sonede|électricité|eau|gaz|énergie/i.test(fournisseur + ' ' + categorie)) {
    return { recuperable: true, raison: 'Énergie & eau — TVA récupérable', taux_recuperation: 1 };
  }

  // 7. Fournitures de bureau, matériel → récupérable
  if (/informatique|fournitures? bureau|papeterie/i.test(categorie)) {
    return { recuperable: true, raison: 'Fournitures/Mobilier — TVA récupérable', taux_recuperation: 1 };
  }

  // 8. Achats de marchandises → récupérable
  if (/achat.*marchandise|marchandise/i.test(categorie)) {
    return { recuperable: true, raison: 'Marchandises — TVA récupérable', taux_recuperation: 1 };
  }

  // 9. Services et honoraires → récupérable (sauf exceptions)
  if (/honoraire|service extérieur|conseil|prestation/i.test(categorie)) {
    return { recuperable: true, raison: 'Services — TVA récupérable', taux_recuperation: 1 };
  }

  // Par défaut: récupérable si MF présent
  return { recuperable: true, raison: 'TVA récupérable sous réserve', taux_recuperation: 1 };
}

// ─────────────────────────────────────────────
// 18. corrigerOCRAvecTrace — corrections avec historique
// ─────────────────────────────────────────────
export function corrigerOCRAvecTrace(text) {
  const corrections = [];
  let t = text;

  t = correctOCRText(t);

  const timbreBad = t.match(/(\d)[,.]O{2,3}O?/i);
  if (timbreBad) {
    const old = timbreBad[0];
    const corrected = old.replace(/O/g, '0');
    t = t.replace(old, corrected);
    corrections.push({ champ: 'timbre_fiscal', valeur_lue: old, valeur_corrigee: corrected, raison: 'O lu comme 0' });
  }

  t = t.replace(/(\d) +(\d{3}[.,])/g, (match, p1, p2) => {
    corrections.push({ champ: 'montant', valeur_lue: match, valeur_corrigee: p1 + p2, raison: 'Espace parasite supprimé' });
    return p1 + p2;
  });

  return { text: t, corrections };
}

// ─────────────────────────────────────────────
// 19. detectCategoriesSecondaires — catégories secondaires
// ─────────────────────────────────────────────
export function detectCategoriesSecondaires(text, fournisseur = '') {
  try {
    const t = text.toLowerCase();
    const secondaires = [];

    const checks = [
      { cat: 'Informatique & Matériel', keywords: ['souris', 'clavier', 'écran', 'ordinateur', 'disque dur', 'mémoire', 'usb', 'câble hdmi'] },
      { cat: 'Télécoms & Internet', keywords: ['forfait', 'internet', '4g', '5g', 'téléphone', 'sms'] },
      { cat: 'Fournitures de bureau', keywords: ['papier', 'stylo', 'cartouche', 'toner', 'ramette'] },
      { cat: 'Électricité & Eau', keywords: ['kwh', 'électricité', 'eau', 'steg', 'sonede'] },
      { cat: 'Transport', keywords: ['taxi', 'transport', 'livraison', 'uber'] },
      { cat: 'Restauration', keywords: ['restaurant', 'café', 'repas', 'déjeuner'] },
      { cat: 'Prestation services', keywords: ['maintenance', 'réparation', 'impression', 'prestation', 'honoraire'] },
      { cat: 'Publicité', keywords: ['affiche', 'banner', 'pub', 'marketing'] },
      { cat: 'Carburant', keywords: ['gasoil', 'essence', 'carburant', 'pompe'] },
    ];

    for (const { cat, keywords } of checks) {
      if (keywords.some(k => t.includes(k))) {
        secondaires.push(cat);
      }
    }

    return [...new Set(secondaires)];
  } catch { return []; }
}

// ─────────────────────────────────────────────
// 20a. normaliserMontant — parse "1 234,567" → 1234.567
// ─────────────────────────────────────────────
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

  const val = parseFloat(s);
  if (isNaN(val) || val > 1000000) return null;
  return val;
}

// ─────────────────────────────────────────────
// 20b. detectLignes — extraire lignes de facture E-INFO
// ─────────────────────────────────────────────
function detectLignes(text) {
  const lignes = [];
  const sauts = text.split('\n');
  const bruitLigne = /^(?:désignation|total|net|timbre|fodec|retenue|arrêtée|la présente|tva|base|règlement|mode)/i;

  // E-INFO format large: catégories, types, désignation, qte, prix unitaire ht, tva%, total ttc
  const LIGNE_EINFO = /^\[?\s*(.{3,60}?)\s+(\d{1,2})\s+(\d+[.,]\d{3})\s+(\d+[.,]\d{3})\s+(?:DT\s*)?$/;
  // E-INFO tableau réel: [Désignation TVA[|] PrixHT[|] TotalTTC]
  const LIGNE_EINFO3 = /^\[?\s*(.{3,60}?)\s+(\d{1,2})\s*(?:\|\s*)?([\d,]+)\s*(?:\|\s*)?([\d,]+)\s*\]?\s*(?:\|\s*)?$/;

  for (const line of sauts) {
    const l = line.trim();

    LIGNE_EINFO3.lastIndex = 0;
    const em3 = LIGNE_EINFO3.exec(l);
    if (em3) {
      const des = em3[1].trim();
      if (!bruitLigne.test(des) && des.length >= 3) {
        const tva = parseInt(em3[2]);
        let prix = normaliserMontant(em3[3]);
        let total = normaliserMontant(em3[4]);
        if ([0, 7, 12, 13, 19].includes(tva) && prix !== null && total !== null) {
          // Normaliser prix si en millièmes (OCRsans séparateur décimal ex: 7477 → 7.477)
          if (prix > total * 100) { prix = prix / 1000; }
          if (total > 0 && prix > total) { total = total / 1000; }
          // TVA 0% mais total ≠ prix → OCR a mal lu le prix, corriger
          if (tva === 0 && Math.abs(total - prix) > 0.010) { prix = total; }
          lignes.push({ designation: des, prix_unitaire: prix, quantite: 1, total: total, tva: tva });
          continue;
        }
      }
    }

    LIGNE_EINFO.lastIndex = 0;
    const em = LIGNE_EINFO.exec(l);
    if (em) {
      const des = em[1].trim();
      if (!bruitLigne.test(des) && des.length >= 3) {
        const tva = parseInt(em[2]);
        let prix = normaliserMontant(em[3]);
        let total = normaliserMontant(em[4]);
        if ([0, 7, 12, 13, 19].includes(tva) && prix !== null && total !== null) {
          if (prix > total * 100) { prix = prix / 1000; }
          if (total > 0 && prix > total) { total = total / 1000; }
          if (tva === 0 && Math.abs(total - prix) > 0.010) { prix = total; }
          lignes.push({ designation: des, prix_unitaire: prix, quantite: 1, total: total, tva: tva });
          continue;
        }
      }
    }

    // General line: "DESIGNATION PU DT [QTY] TOTAL DT"
    const tryMatch = (txt) => {
      const RE = /(.{3,60}?)\s+(\d+[.,]\d{3})\s+DT\s+(\d+\s+)?(\d+[.,]\d{3})\s+DT/i;
      RE.lastIndex = 0;
      return RE.exec(txt);
    };
    let eg = tryMatch(l);
    // If inconsistent qty*PU ≈ total, try normalising spaces in numbers
    if (eg) {
      const p0 = normaliserMontant(eg[2]);
      const t0 = normaliserMontant(eg[4]);
      const q0 = eg[3] ? parseInt(eg[3].trim()) : 1;
      const ratio = p0 !== null && t0 !== null && t0 > 0 ? Math.abs(q0 * p0 - t0) / t0 : 0;
      if (ratio > 0.02) {
        const norm = l.replace(/(\d)\s+(?=\d{1,3}[.,]\d{2,3}\s+DT)/g, '$1');
        eg = tryMatch(norm);
      }
    }
    if (eg) {
      const des = eg[1].trim();
      if (!bruitLigne.test(des) && des.length >= 3) {
        let prix = normaliserMontant(eg[2]);
        let total = normaliserMontant(eg[4]);
        let qte = eg[3] ? parseInt(eg[3].trim()) : 1;
        if (prix !== null && total !== null && prix > 0 && total > 0) {
          lignes.push({ designation: des, prix_unitaire: prix, quantite: qte, total: total });
          continue;
        }
      }
    }
  }
  return lignes;
}

// ─────────────────────────────────────────────
// 3b. detectTypeFacture — achat / vente / achat_avec_prestation / note_frais / avoir
// ─────────────────────────────────────────────
export function detectTypeFacture(text, fournisseur = '', montantTTC = 0) {
  try {
    if (!text || typeof text !== 'string') return 'achat';
    const lower = text.toLowerCase();

    // Note de crédit / avoir
    if (/\b(avoir|note de crédit|note de credit|remboursement)\b/i.test(lower)) return 'avoir';

    // Note de frais: pas de MF, montant < 200 DT
    if (montantTTC > 0 && montantTTC < 200 && !/matricule\s*fiscal|MF\s*:/i.test(lower)) return 'note_frais';

    // If it's a known supplier, it's definitely a purchase (achat), not a sale (vente)
    const fourKey = fournisseur ? fournisseur.toLowerCase().trim() : '';
    const isKnownSupplier = fourKey && FOURNISSEURS_LOOKUP[fourKey];

    // Vente (facture client Smart Comptable)
    if (!isKnownSupplier && (
      /facturé à\s+[a-z]/i.test(lower) || 
      /facture a\s+[a-z]/i.test(lower) || 
      (/\bclient\b/i.test(lower) && !/\b(code|réf|ref|compte)\s+client\b/i.test(lower)) ||
      /FACT-\d{4}-\d{3}/i.test(lower)
    )) {
      return 'vente';
    }

    // Prestation de services
    if (/\b(honoraires|consultation|maintenance|impression|sous-traitance|prestation|installation|réparation)\b/i.test(lower)) return 'achat_avec_prestation';

    // Fournisseur connu avec RS
    if (fourKey && FOURNISSEURS_LOOKUP[fourKey]?.rs) return 'achat_avec_prestation';

    return 'achat';
  } catch { return 'achat'; }
}
const MONTHS = {
  janvier: '01', février: '02', mars: '03', avril: '04', mai: '05', juin: '06',
  juillet: '07', août: '08', septembre: '09', octobre: '10', novembre: '11', décembre: '12',
};

export function detectDate(text) {
  try {
    if (!text || typeof text !== 'string') return null;
    const p1 = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/g;
    const p2 = /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/g;
    const p3 = /(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/gi;
    const p4 = /(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\.?\s+(\d{1,2})\s*[,.]?\s*(\d{4})/gi;
    const p5 = /(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{2})\b/g;

    const MONTHS_MAP = {
      janvier: '01', février: '02', mars: '03', avril: '04', mai: '05', juin: '06',
      juillet: '07', août: '08', septembre: '09', octobre: '10', novembre: '11', décembre: '12',
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };

    const dates = [];
    let m;
    while ((m = p1.exec(text)) !== null) {
      dates.push({ date: `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`, pos: m.index, type: 'numeric' });
    }
    while ((m = p2.exec(text)) !== null) {
      dates.push({ date: `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`, pos: m.index, type: 'numeric' });
    }
    while ((m = p3.exec(text)) !== null) {
      const monthKey = m[2].toLowerCase();
      dates.push({ date: `${m[3]}-${MONTHS_MAP[monthKey] || '01'}-${m[1].padStart(2,'0')}`, pos: m.index, type: 'words' });
    }
    while ((m = p4.exec(text)) !== null) {
      const monthKey = m[1].toLowerCase();
      dates.push({ date: `${m[3]}-${MONTHS_MAP[monthKey] || '01'}-${m[2].padStart(2,'0')}`, pos: m.index, type: 'words' });
    }
    while ((m = p5.exec(text)) !== null) {
      const yy = parseInt(m[3], 10);
      const cc = yy <= 29 ? 2000 : 1900;
      dates.push({ date: `${cc + yy}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`, pos: m.index, type: 'numeric' });
    }

    if (dates.length === 0) return null;

    // Calculer les scores pour chaque date
    const scoredDates = dates.map(d => {
      let score = 0;
      const before = text.slice(Math.max(0, d.pos - 40), d.pos).toLowerCase();

      // Mots-clés favorisant la date de facture
      if (/\b(?:date|le|facture|invoice|émise)\b/i.test(before)) {
        score += 50;
      }
      // Mots-clés pénalisants (période de consommation, etc.)
      if (/\b(?:période|du|au|period)\b/i.test(before)) {
        score -= 30;
      }
      
      // Proximité du début du document (souvent l'en-tête de la facture)
      if (d.pos < 300) {
        score += 20;
      } else if (d.pos < 600) {
        score += 10;
      }

      // Format texte (plus précis, moins d'erreurs OCR)
      if (d.type === 'words') {
        score += 10;
      }

      return { ...d, score };
    });

    // Trier par score décroissant, et en cas d'égalité, par position la plus proche du début
    scoredDates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.pos - b.pos;
    });

    return scoredDates[0].date;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Document classifier — determine document type before parsing
// ─────────────────────────────────────────────
const BORDEREAU_KEYWORDS = [
  'bulletin de versement', 'bordereau de versement', 'bordereau',
  'ccp', 'compte courant postal', 'chèque postal',
  'code guichet', 'clé rib', 'rib', 'iban',
  'versement', 'crédit de compte',
  'agence\\s*:\\s*\\d+', 'guichet\\s*:\\s*\\d+',
  'numéro de compte', 'n° de compte',
  'timbre', 'taxe',
  'crédit',
];

const NON_FACTURE_KEYWORDS = [
  'bulletin de paie', 'fiche de paie', 'bulletin de salaire',
  'devis', 'devis n°', 'devis numéro',
  'bon de commande', 'bon de livraison', 'bon de réception',
  'reçu', 'reçu n°',
  'extrait de compte', 'relevé de compte',
  'carte d\'identité', 'carte nationale',
  'passeport',
];

export function classifierDocument(text) {
  if (!text || typeof text !== 'string') return { type: 'autre', confiance: 0 };
  const lower = text.toLowerCase().trim();

  // Détection OCR bruité: si le texte a très peu de mots alphabétiques réels
  const words = lower.split(/\s+/).filter(w => w.length > 1);
  const alphaWords = words.filter(w => /[a-zà-ÿéèêëàâîôûùç]{3,}/i.test(w));
  const totalChars = lower.length;
  if (words.length > 0) {
    const alphaRatio = alphaWords.length / words.length;
    if (alphaRatio < 0.15 && totalChars > 50) {
      return { type: 'autre', confiance: 5, raison: 'texte_bruité' };
    }
  }

  // Check for bordereau/versement keywords first (before invoice detection)
  let bordereauScore = 0;
  for (const kw of BORDEREAU_KEYWORDS) {
    try {
      const re = new RegExp('\\b' + kw.replace(/\\/g, '\\') + '\\b', 'i');
      if (re.test(lower)) bordereauScore += 15;
    } catch {
      if (lower.includes(kw)) bordereauScore += 10;
    }
  }
  // Stronger signal: presence of RIB/account number patterns without invoice structure
  const hasRIB = /\b(?:rib|iban)\s*[:\s]*[a-z0-9]{10,}/i.test(lower);
  const hasVersement = /\b(?:versement|crédit)\s+(?:de|d'un|d'|en)\s*(?:compte|votre)/i.test(lower);
  const hasCCP = /\bccp\s*(?:n°|numéro|:)?\s*\d{4,}/i.test(lower);
  if (hasRIB) bordereauScore += 10;
  if (hasVersement) bordereauScore += 15;
  if (hasCCP) bordereauScore += 20;

  // Check for non-facture keywords
  // Check for invoice indicators (MUST be before non-facture keyword check)
  const hasTVA = /(?:tva\s*(?:19|13|7|6|12|20)\s*%|taux\s*tva|montant\s*tva|tva\s*[0-9.,]+\s*[dt])/i.test(lower);
  const hasMatricule = /(?:matricule\s*fiscal|mf\s*[:\s]|n°\s*mf|n°fiscal)/i.test(lower);
  const hasSousTotal = /(?:sous[- ]?total\s*ht|net\s*ht|total\s*ht\s*[:\s])/i.test(lower);
  const hasTotalTTC = /(?:total\s*ttc|net\s*à\s*payer|ttc\s*[:\s])/i.test(lower);
  const hasFacture = /\b(?:facture|f[ée]f|note\s*d'honoraires|note\s*des\s*honoraires)\b/i.test(lower);
  const hasClient = /(?:client|facturé\s*à|destinataire)/i.test(lower);
  const hasFournisseur = /(?:fournisseur|prestataire|vendeur|entreprise)/i.test(lower);

  const invoiceScore = [hasTVA, hasMatricule, hasSousTotal, hasTotalTTC, hasFacture].filter(Boolean).length * 20
    + (hasClient || hasFournisseur ? 10 : 0);
  const strongInvoiceSignals = invoiceScore >= 30 || (hasFacture && (hasMatricule || hasTVA));

  const isNonFacture = NON_FACTURE_KEYWORDS.some(kw => lower.includes(kw));

  // Classification decision
  if (isNonFacture && !strongInvoiceSignals) {
    return { type: 'autre', confiance: 80, raison: 'mot_clé_non_facture' };
  }
  // If bordereau score is high AND invoice score is low → bordereau
  if (bordereauScore >= 30 && invoiceScore < 30) {
    return { type: 'bordereau_versement', confiance: Math.min(100, bordereauScore), raison: 'mots_clés_bordereau' };
  }
  // If invoice indicators present → facture
  if (invoiceScore >= 30 || (hasFacture && (hasMatricule || hasTVA))) {
    // Sub-classify: vente vs achat
    const isVente = hasClient && !hasFournisseur;
    return { type: isVente ? 'facture_vente' : 'facture_achat', confiance: Math.min(100, invoiceScore + (bordereauScore > 0 ? 10 : 0)), raison: null };
  }
  // If mixed (bordereau + some invoice keywords) — STEG bill with both sections
  if (bordereauScore > 0 && invoiceScore > 0) {
    return { type: invoiceScore >= bordereauScore ? 'facture_achat' : 'bordereau_versement', confiance: Math.min(100, Math.max(invoiceScore, bordereauScore)), raison: 'mixte' };
  }
  // Fallback
  return { type: 'autre', confiance: Math.max(bordereauScore, 5), raison: 'indeterminé' };
}

// ─────────────────────────────────────────────
// 21. parseFactureTunisienne — pipeline complet (format JSON spec)
// ─────────────────────────────────────────────
export function parseFactureTunisienne(rawText, tesseractConfiance = 0) {
  try {
    if (!rawText || rawText.trim().length < 10) return null;

    // Étape 0: détection PDF
    if (detectPDF(rawText)) {
      return {
        type_document: 'autre',
        alerte: 'pdf_detecte',
        erreur: 'PDF_DETECTE',
        formulaire: null,
        verification: {
          calculs_coherents: false,
          mf_present: false,
          source_valeurs: 'recap_imprime',
          alertes: [{ code: 'PDF_DETECTE', message: 'Le fichier semble être un PDF non interprété par OCR' }],
          corrections_ocr: [],
        },
        confiance_ocr: 0,
        champs_a_confirmer: ['fournisseur_nom', 'fournisseur_mf', 'numero_justificatif', 'date_facture', 'montant_ht', 'montant_ttc'],
      };
    }

    // Étape 0b: classification du document
    const classification = classifierDocument(rawText);
    const docType = classification.type;

    // Si classifié "autre" ou "bordereau", on tente un parsing rescue
    // quand le texte contient des données numériques exploitables
    let lowConfidenceOverride = false;
    if (docType === 'bordereau_versement' || docType === 'autre') {
      const hasDate = /(\d{2}[-/]\d{2}[-/]\d{2,4})/.test(rawText);
      const hasMontant = /(\d{1,4}(?:[\s.,]?\d{3})*(?:[.,]\d{2,3})?)\s*[dt]/.test(rawText) || /(?:total|net|ttc)\s*[:\s]*\d/.test(rawText.toLowerCase());
      const hasDigits = (rawText.match(/\d+/g) || []).length >= 3;
      const hasStructure = (rawText.match(/\n/g) || []).length >= 2 && hasDigits;

      if (!hasDate && !(hasMontant && hasDigits) && !hasStructure && classification.raison !== 'texte_bruité') {
        return {
      type_document: lowConfidenceOverride ? 'facture_achat' : docType,
          alerte: 'document_non_facture',
          message: 'Ce document ne semble pas être une facture. Vérifiez les champs avant d\'enregistrer.',
          formulaire: null,
          verification: {
            calculs_coherents: false,
            mf_present: false,
            source_valeurs: 'classifieur',
            alertes: [{ code: docType === 'bordereau_versement' ? 'BORDEREAU_DETECTE' : 'AUTRE_DOCUMENT', message: classification.raison || 'Document non facture' }],
            corrections_ocr: [],
          },
          confiance_ocr: 0,
          champs_a_confirmer: ['fournisseur_nom', 'fournisseur_mf', 'numero_justificatif', 'date_facture', 'montant_ht', 'montant_ttc'],
        };
      }
      lowConfidenceOverride = true;
    }

    // Étape 1b: correction OCR avec trace (uniquement pour factures)
    const { text, corrections: correctionsOCR } = corrigerOCRAvecTrace(rawText);

    // Étape 2: détection brute
    const fournisseur   = detectFournisseur(text);
    const mf            = detectMF(text);
    const numero        = detectNumeroFacture(text);
    const date          = detectDate(text) || null;
    let totalHT       = detectTotalHT(text);
    let totalTTC      = detectTotalTTC(text);
    let tauxTVA       = detectTauxTVA(text);
    const timbre        = detectTimbre(text, fournisseur || '');
    const categorie     = detectCategorie(text, fournisseur || '');
    const categoriesSec = detectCategoriesSecondaires(text, fournisseur || '');
    let totalTVA      = detectMontantTVA(text);
    const fodec         = detectFODEC(text);
    const retenueSource = detectRetenueSource(text);
    const modeReglement = detectModeReglement(text);
    const rsInfo        = detectRSPrestation(text, fournisseur || '');

    // Appliquer métadonnées fournisseur (lookup table) si disponible
    const fourKey = fournisseur ? fournisseur.toLowerCase().trim() : '';
    const metaFournisseur = FOURNISSEURS_LOOKUP[fourKey] || null;
    if (metaFournisseur) {
      // Catégorie depuis la lookup (surcharge detectCategorie)
      const catFromLookup = metaFournisseur.categorie;
      // TVA: surcharge si la lookup a un taux défini
      if (metaFournisseur.tva != null) {
        tauxTVA = metaFournisseur.tva;
      }
      // RS
      if (metaFournisseur.rs != null && !rsInfo.applicable) {
        rsInfo.applicable = metaFournisseur.rs;
      }
    }
    // Appliquer catégorie depuis la lookup si définie
    const categorieFinale = (metaFournisseur?.categorie) || categorie;

    // Type de facture
    const typeFacture = detectTypeFacture(text, fournisseur, totalTTC);

    // Détection lignes + calcul TVA par ligne (taux mixtes)
    const lignes = detectLignes(text);
    if (lignes.length > 0) {
      // Somme brute de toutes les lignes détectées
      const sumHT = lignes.reduce((s, l) => s + (l.prix_unitaire || 0), 0);
      const sumTotals = lignes.reduce((s, l) => s + (l.total || 0), 0);
      // TVA calculée ligne par ligne : Σ(prix × taux / 100)
      const sumTVACalc = lignes.reduce((s, l) => {
        if (l.tva !== undefined) return s + (l.prix_unitaire || 0) * l.tva / 100;
        return s;
      }, 0);
      // N'écraser les valeurs du récapitulatif que si la somme des lignes est cohérente
      // (tolérance 20% pour les arrondis et variations OCR)
      const TOLERANCE_LIGNES = 0.20;
      const htRecapOk = totalHT != null && totalHT > 0;
      const htLinesOk = sumHT > 0;
      if (htLinesOk && (!htRecapOk || Math.abs(sumHT - totalHT) / totalHT < TOLERANCE_LIGNES)) {
        totalHT = parseFloat(sumHT.toFixed(3));
      }
      if (sumTVACalc > 0 && (!totalTVA || Math.abs(sumTVACalc - totalTVA) / (totalTVA || 1) < TOLERANCE_LIGNES)) {
        totalTVA = parseFloat(sumTVACalc.toFixed(3));
      }
      const totalTTCFromLines = parseFloat((sumTotals + (timbre ?? 1.000)).toFixed(3));
      if (totalTTCFromLines > 0 && (!totalTTC || Math.abs(totalTTCFromLines - totalTTC) / (totalTTC || 1) < TOLERANCE_LIGNES)) {
        totalTTC = totalTTCFromLines;
      }

      // Taux TVA le plus fréquent parmi les lignes cohérentes
      // (seulement si la somme des lignes est cohérente avec le récapitulatif)
      const linesCoherent = htLinesOk && htRecapOk && Math.abs(sumHT - totalHT) / totalHT < TOLERANCE_LIGNES;
      if (linesCoherent) {
        const saneLines = lignes.filter(l => {
          if (l.tva === 0) return Math.abs(l.total - l.prix_unitaire) < 0.010;
          const expected = l.prix_unitaire * (1 + l.tva / 100);
          return Math.abs(l.total - expected) < 0.010;
        });
        if (saneLines.length > 0) {
          const comptage = {};
          for (const l of saneLines) { comptage[l.tva] = (comptage[l.tva] || 0) + 1; }
          const best = Object.entries(comptage).sort((a, b) => b[1] - a[1])[0];
          if (best) { tauxTVA = parseInt(best[0]); }
        }
      }
    }

    // taux_tva_details: per-rate breakdown from lines
    const taux_tva_details = [];
    const byRate = {};
    if (lignes.length > 0) {
      for (const l of lignes) {
        const t = l.tva;
        if (t !== undefined) {
          if (!byRate[t]) byRate[t] = { base: 0, tva: 0 };
          byRate[t].base += l.prix_unitaire || 0;
          byRate[t].tva += (l.total || 0) - (l.prix_unitaire || 0);
        }
      }
      for (const [taux, d] of Object.entries(byRate)) {
        taux_tva_details.push({ taux: parseInt(taux), base_ht: parseFloat(d.base.toFixed(3)), montant_tva: parseFloat(d.tva.toFixed(3)) });
      }
    }

    // Track source_valeurs: recap_imprime / somme_lignes / calcul_derive
    let source_valeurs;
    if (totalHT && totalTTC) {
      source_valeurs = lignes.length > 0 ? 'somme_lignes' : 'recap_imprime';
    } else {
      source_valeurs = 'calcul_derive';
    }

    // Dériver HT et TVA si manquants
    if ((totalHT == null || totalHT <= 0 || totalTVA == null || totalTVA <= 0) && totalTTC > 0) {
      const tvaRate = (tauxTVA === 0) ? 0 : (tauxTVA || 19);
      const timbreVal = timbre ?? 1.000;
      const fodecVal = fodec || 0;
      if (totalHT == null || totalHT <= 0) {
        totalHT = parseFloat(((totalTTC - timbreVal - fodecVal) / (1 + tvaRate / 100)).toFixed(3));
      }
      if (totalTVA == null || totalTVA <= 0) {
        totalTVA = parseFloat((totalTTC - totalHT - timbreVal - fodecVal).toFixed(3));
      }
    }

    // rs_base: HT prestation portion when RS applicable
    const rs_base = rsInfo.applicable ? (totalHT || 0) : 0;

    // Étape 3: calculs
    const montantHT_num  = totalHT || 0;
    const montantTTC_num = totalTTC || 0;
    const timbre_num     = timbre ?? 1.000;
    const fodec_num      = fodec || 0;
    const rsExplicite    = retenueSource || 0;
    const rsCalcule      = rsInfo.applicable ? parseFloat((rs_base * (rsInfo.taux || 1.5) / 100).toFixed(3)) : 0;
    const rs_num         = rsExplicite || rsCalcule;

    // Si TTC détecté est absurde mais HT+TVA+timbre sont valides, calculer TTC
    let ttcCompute = montantTTC_num;
    if (montantHT_num > 0 && totalTVA > 0 && timbre_num >= 0) {
      const expectedTTC = parseFloat((montantHT_num + totalTVA + timbre_num + fodec_num).toFixed(3));
      if (ttcCompute <= 0 || Math.abs(ttcCompute - expectedTTC) / Math.max(expectedTTC, 1) > 0.5) {
        ttcCompute = expectedTTC;
      }
    }

    const netADecaisser = parseFloat((ttcCompute + timbre_num + fodec_num - rs_num).toFixed(3));

    // Étape 4: vérification croisée
    const coherenceData = {
      montant_ht: montantHT_num || null,
      montant_tva: totalTVA || null,
      montant_ttc: ttcCompute || null,
      taux_tva: tauxTVA,
      timbre_fiscal: timbre_num,
      fodec: fodec_num,
      retenue_source: rs_num,
      taux_rs: rsInfo.applicable ? rsInfo.taux : 0,
    };
    const verif = verifierCoherence(coherenceData);

    // Étape 6: champs à confirmer
    // TVA récupérable
    const tvaRecup = detectTVARecuperable({
      fournisseur,
      categorie: categorieFinale,
      matriculeFiscal: mf,
    });

    const champsAConfirmer = [];
    if (!fournisseur) champsAConfirmer.push('fournisseur_nom');
    if (!mf) champsAConfirmer.push('fournisseur_mf');
    if (!numero) champsAConfirmer.push('numero_justificatif');
    if (!date) champsAConfirmer.push('date_facture');
    if (!totalHT) champsAConfirmer.push('montant_ht');
    if (!totalTTC) champsAConfirmer.push('montant_ttc');

    // Determine final confidence and alertes
    const confiance = Math.min(100, Math.round(([fournisseur, mf, numero, date, totalHT, totalTTC, totalTVA, timbre].filter(Boolean).length / 8) * 100));
    const alerte = lowConfidenceOverride
      ? 'faible_confiance'
      : tesseractConfiance > 0 && tesseractConfiance < 45 && confiance < 50
        ? 'faible_confiance'
        : null;
    const alertes = genererAlertes({
      ...coherenceData,
      date,
      fournisseur,
      matriculeFiscal: mf,
      mode_reglement: modeReglement,
      flag_incoherence: !verif.calculs_coherents,
      categorie: categorieFinale,
      type: typeFacture,
      confiance,
    }, text);

    return {
      type_document: docType,
      alerte,
      formulaire: {
        type: typeFacture,
        client: detectClient(text),
        fournisseur_nom: fournisseur || '',
        fournisseur_mf: mf || '',
        date_facture: date ? date.split('-').reverse().join('/') : '',
        numero_justificatif: numero || '',
        categorie_principale: categorieFinale,
        categories_secondaires: categoriesSec,
        taux_tva: tauxTVA,
        taux_tva_details: taux_tva_details,
        montant_ht: montantHT_num,
        montant_tva: totalTVA || 0,
        montant_ttc: ttcCompute,
        timbre_fiscal: timbre_num,
        fodec: fodec_num,
        rs_applicable: rsInfo.applicable,
        rs_taux: rsInfo.applicable ? rsInfo.taux : 0,
        rs_base: rs_base,
        rs_montant: rs_num,
        net_a_decaisser: netADecaisser || 0,
        mode_reglement: modeReglement,
        tva_recuperable: tvaRecup,
      },
      verification: {
        calculs_coherents: verif.calculs_coherents,
        mf_present: !!mf,
        source_valeurs: source_valeurs,
        alertes: verif.alertes.concat(alertes.map(a => a.message)).concat(alerte ? ['⚠️ Certains champs n\'ont pas été reconnus automatiquement'] : []),
        corrections_ocr: correctionsOCR,
        tva_mismatch: verif.alertes.some(a => a.includes('TVA calculée')),
      },
      confiance_ocr: confiance,
      champs_a_confirmer: champsAConfirmer,
    };
  } catch (e) {
    return null;
  }
}

// ─────────────────────────────────────────────
// 22. generateInvoiceNumber — unique par année
// ─────────────────────────────────────────────
export function generateInvoiceNumber(existingInvoices = []) {
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

// ─────────────────────────────────────────────
// 9. saveOrUpdateFournisseur — persistance LRU
// ─────────────────────────────────────────────
export function saveOrUpdateFournisseur(name, data = {}) {
  try {
    if (!name || typeof name !== 'string') return;
    const trimmed = name.trim();
    if (!trimmed || BLACKLIST_FOURNISSEUR.some(r => r.test(trimmed))) return;

    const companyId = localStorage.getItem('smart_comptable_current_id');
    const key = companyId ? `smart_fournisseurs_${companyId}` : 'smart_fournisseurs';

    let fournisseurs = [];
    try {
      const raw = localStorage.getItem(key);
      if (raw) fournisseurs = JSON.parse(raw);
    } catch {
      fournisseurs = [];
    }
    if (!Array.isArray(fournisseurs)) fournisseurs = [];

    const existing = fournisseurs.find(
      f => f && f.nom && f.nom.toLowerCase() === trimmed.toLowerCase()
    );

    if (existing) {
      if (data.matriculeFiscal && !existing.matriculeFiscal) {
        existing.matriculeFiscal = data.matriculeFiscal;
      }
      if (data.telephone && !existing.telephone) {
        existing.telephone = data.telephone;
      }
      existing.derniereFacture = data.date || new Date().toISOString().slice(0, 10);
      existing.totalAchats = (existing.totalAchats || 0) + (parseFloat(data.totalAmount) || 0);
      if (Array.isArray(existing.factures)) {
        existing.factures.push({ id: data.invoiceNumber || data.id, date: data.date, montant: parseFloat(data.totalAmount) || 0 });
      }
    } else {
      fournisseurs.unshift({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        nom: trimmed,
        matriculeFiscal: data.matriculeFiscal || '',
        telephone: data.telephone || '',
        adresse: data.address || '',
        totalAchats: parseFloat(data.totalAmount) || 0,
        derniereFacture: data.date || new Date().toISOString().slice(0, 10),
        dateCreation: new Date().toISOString(),
        factures: data.invoiceNumber ? [{ id: data.invoiceNumber, date: data.date, montant: parseFloat(data.totalAmount) || 0 }] : [],
      });
    }

    localStorage.setItem(key, JSON.stringify(fournisseurs));
  } catch {
    /* silencieux */
  }
}

// ─────────────────────────────────────────────
// 10. parseMontantLettres — français → nombre
// ─────────────────────────────────────────────
const UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
const TEENS = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];

export function parseMontantLettres(text) {
  try {
    if (!text || typeof text !== 'string') return null;
    // Chercher "X Dinars" ou "X Dinars Y Millimes"
    const m = text.match(/([\w\s\-]+)\s*dinar/i);
    if (!m) return null;
    const parseNb = (s) => {
      const words = s.trim().toLowerCase().replace(/[œ]/g, 'oe').split(/[\s\-]+/).filter(Boolean);
      let total = 0, current = 0;
      const map = {
        zéro: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5,
        six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
        onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16,
        'dix-sept': 17, 'dix-huit': 18, 'dix-neuf': 19,
        vingt: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60,
        cent: 100, mille: 1000,
      };
      const centMots = ['cent', 'cents', 'gent'];
      const milleMots = ['mille'];

      // Pré-traitement pour harmoniser les mots et gérer les nombres composés français
      let cleanedWords = [];
      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        if (/q[uéèe]st?re/i.test(w)) {
          cleanedWords.push('quatre');
        } else if (/vingt[s]?/i.test(w)) {
          cleanedWords.push('vingt');
        } else if (/dinar[s]?/i.test(w)) {
          cleanedWords.push('dinar');
        } else if (/millime[s]?/i.test(w)) {
          cleanedWords.push('millime');
        } else {
          cleanedWords.push(w);
        }
      }
      
      // Assembler quatre-vingt (80) et quatre-vingt-dix (90)
      let finalWords = [];
      for (let i = 0; i < cleanedWords.length; i++) {
        if (cleanedWords[i] === 'quatre' && cleanedWords[i+1] === 'vingt') {
          if (cleanedWords[i+2] === 'dix' || cleanedWords[i+2] === 'onze' || cleanedWords[i+2] === 'douze' || cleanedWords[i+2] === 'treize' || cleanedWords[i+2] === 'quatorze' || cleanedWords[i+2] === 'quinze' || cleanedWords[i+2] === 'seize') {
            const val = 80 + (map[cleanedWords[i+2]] || 10);
            finalWords.push(val.toString());
            i += 2;
          } else {
            finalWords.push('80');
            i += 1;
          }
        } else {
          finalWords.push(cleanedWords[i]);
        }
      }

      for (const w of finalWords) {
        if (w === 'et') continue;
        if (!isNaN(parseInt(w))) {
          current += parseInt(w);
        } else if (map[w] !== undefined) {
          const v = map[w];
          if (v >= 1000) { total += current * v; current = 0; }
          else if (v >= 100) { current = (current || 1) * v; }
          else { current += v; }
        } else if (centMots.includes(w)) { current = (current || 1) * 100; }
        else if (milleMots.includes(w)) { total += current * 1000; current = 0; }
      }
      total += current;
      return total;
    };

    const dinars = parseNb(m[1]);
    if (dinars <= 0) return null;

    // Chercher la partie millimes après "dinars" : "ET X MILLIMES"
    const millimesMatch = text.slice(m.index + m[0].length).match(/(?:et\s+)?([\w\s\-]+)\s*millimes/i);
    if (millimesMatch) {
      const millimes = parseNb(millimesMatch[1]);
      if (millimes > 0 && millimes < 1000) {
        return parseFloat((dinars + millimes / 1000).toFixed(3));
      }
    }
    return dinars;
  } catch { return null; }
}

// ─────────────────────────────────────────────
// 11. corrigerFacture — assistant correction OCR (Étapes 0–6)
// ─────────────────────────────────────────────
function extraireDernier(text, patterns) {
  let dernier = null;
  let dernierIdx = -1;
  for (const re of patterns) {
    const copy = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m;
    while ((m = copy.exec(text)) !== null) {
      const val = normaliserMontant(m[1] || m[2] || m[3]);
      if (val !== null && val > 0 && (m.index || 0) > dernierIdx) {
        dernier = val;
        dernierIdx = m.index || 0;
      }
    }
  }
  return dernier;
}

function extraireNombre(ligne) {
  const m = ligne.match(/(\d{1,6}[,\.]\d{3})\b/);
  if (!m) return 0;
  return parseFloat(m[1].replace(',', '.'));
}

function extraireRecapitulatif(text, opts = {}) {
  const { forTTN = false } = opts;
  const recap = {
    ht: extraireDernier(text, [
      /total\s*ht\s*[:﹕]?\s*([\d\s,.]+)/i,
      /sous[- ]?total\s*ht\s*[:﹕]?\s*([\d\s,.]+)/i,
      /total\s*hors\s*taxe\s*[:﹕]?\s*([\d\s,.]+)/i,
    ]),
    tva: extraireDernier(text, [
      /total\s*tva\s*[:﹕]?\s*([\d\s,.]+)/i,
      /montant\s*tva\s*[:﹕]?\s*([\d\s,.]+)/i,
      /tva\s*\(\d+\s*%\)\s*[:﹕]?\s*([\d\s,.]+)/i,
      /tva\s*\d{1,2}\s*%\s*[:﹕]?\s*([\d\s,.]+)/i,
    ]),
    timbre: null,
    fodec: extraireDernier(text, [
      /fodec\s*[:﹕]?\s*([\d\s,.]+)/i,
    ]),
    ttc: extraireDernier(text, [
      /net\s*(?:à\s*)?payer\s*[:﹕]?\s*([\d\s,.]+)/i,
      /total\s*ttc\s*[:﹕]?\s*([\d\s,.]+)/i,
      /montant\s*ttc\s*[:﹕]?\s*([\d\s,.]+)/i,
      /ttc\s*[:﹕]?\s*([\d\s,.]+)/i,
      /total\s*[:﹕]?\s*([\d\s,.]+)\s*(?:dt|dinars)/i,
      /montant\s*t\.?\s*t\.?\s*c\.?\s*[:﹕]?\s*([\d\s,.]+)/i,
      /cent\s+[a-zæàâäéèêëîïôöùûü]+\s+dinars\s*(?:et\s+[a-zæàâäéèêëîïôöùûü]+\s+centimes?)?[^0-9]*?(\d{4,6})/i,
    ]),
  };
  recap.timbre = detectTimbre(text);
  return recap;
}

function analyseValeursFacture(text) {
  const result = { ht: null, tva: null, timbre: null, fodec: null, ttc: null };
  try {
    const dtVals = [...text.matchAll(/(?<!\d)(\d{1,3}(?:[ \t.,]\d{3})+)\s*dt/gi)]
      .map(m => parseFloat(m[1].replace(/\s/g, '').replace(',', '.')))
      .filter(v => !isNaN(v) && v > 0)
      .sort((a, b) => b - a);

    const allVals = [...text.matchAll(/(?<!\d)(\d{1,3}(?:[ \t.,]\d{3})+)(?!\d)/g)]
      .map(m => parseFloat(m[1].replace(/\s/g, '').replace(',', '.')))
      .filter(v => !isNaN(v) && v > 0)
      .sort((a, b) => b - a);

    if (allVals.length < 2) return result;

    result.ttc = dtVals.length > 0 ? dtVals[0] : allVals[0];

    // Si la plus grande valeur DT est suspecte (≥ 100× la suivante, ou ≥ 500000 DT seule),
    // c'est probablement le capital social (ex: "12000000 DT" sur E-INFO) – prendre
    // la plus grande valeur DT ≤ 500000, sinon la plus grande valeur allVals ≤ 500000
    const isSuspect = (dtVals.length === 1 && dtVals[0] >= 500000)
      || (dtVals.length >= 2 && dtVals[0] > dtVals[1] * 100);
    if (isSuspect) {
      const candidats = (dtVals.length >= 2 ? dtVals : allVals).filter(v => v > 0 && v <= 500000);
      result.ttc = candidats.length > 0 ? candidats[0] : allVals[0];
    }
    const timbreCandidates = [0, 0.500, 0.600, 1.000, 1.500, 2.000];
    const rates = [19, 13, 12, 7, 0];

    const htCandidates = dtVals.length >= 2 ? dtVals.slice(1) : allVals.filter(v => v < result.ttc);

    let bestScore = Infinity;
    for (const ht of htCandidates) {
      if (ht >= result.ttc) continue;
      const maxFodec = Math.min(result.ttc - ht, Math.round(ht * 0.02 * 1000) / 1000);
      for (const timbre of timbreCandidates) {
        if (timbre > result.ttc - ht) continue;
        for (const rate of rates) {
          // Essayer sans FODEC
          const tva1 = Math.round(ht * rate / 100 * 1000) / 1000;
          const total1 = ht + tva1 + timbre;
          const diff1 = Math.abs(result.ttc - total1);
          const timbreOK = timbre === 0 || allVals.some(v => Math.abs(v - timbre) < 0.01);
          const score1 = diff1 + (timbreOK ? 0 : 0.01);
          if (score1 < bestScore && diff1 < 0.5) {
            bestScore = score1;
            result.ht = ht; result.tva = tva1;
            result.timbre = timbre > 0 ? timbre : null;
            result.fodec = null;
          }
          // Essayer avec FODEC ≈ 1% HT
          const fodec = Math.round(ht * 0.01 * 1000) / 1000;
          if (fodec > 0 && fodec + timbre <= result.ttc - ht) {
            const tva2 = Math.round((ht + fodec) * rate / 100 * 1000) / 1000;
            const total2 = ht + tva2 + timbre + fodec;
            const diff2 = Math.abs(result.ttc - total2);
            const fodecOK = allVals.some(v => Math.abs(v - fodec) < 0.01);
            const score2 = diff2 + (timbreOK ? 0 : 0.01) + (fodecOK ? 0 : 0.01);
            if (score2 < bestScore && diff2 < 0.5) {
              bestScore = score2;
              result.ht = ht; result.tva = tva2;
              result.timbre = timbre > 0 ? timbre : null;
              result.fodec = fodec;
            }
          }
        }
      }
    }

    // FODEC: valeur ≈ 1% de HT
    if (result.ht && result.fodec === null) {
      const expectedFodec = result.ht * 0.01;
      const fodecFound = allVals.find(v => Math.abs(v - expectedFodec) < 0.1);
      if (fodecFound) result.fodec = fodecFound;
    }
  } catch (e) { /* fallback échoué */ }
  return result;
}

function extraireMFFournisseur(text) {
  const lignes = text.split('\n').filter(Boolean);
  const idxClient = lignes.findIndex(l => /factur[eé]\s*[àa]|client\s*:|adresse\s*client|adresse de livraison/i.test(l));
  const mfRegex = /\b(\d{6,7}\/[A-Z0-9]\/[A-Z0-9](?:\/[A-Z0-9]\/\d{3})?)\b/g;
  const mfTrouves = [];
  lignes.forEach((ligne, idx) => {
    let m;
    while ((m = mfRegex.exec(ligne)) !== null) {
      mfTrouves.push({ valeur: m[1], ligne: idx });
    }
  });
  const mfFour = mfTrouves.find(mf => idxClient === -1 || mf.ligne < idxClient);
  if (!mfFour) return null;
  // Normaliser 0→O dans les positions lettres
  const parts = mfFour.valeur.split('/');
  if (parts.length >= 3) {
    parts[1] = parts[1].replace(/0/g, 'O');
    if (parts.length >= 4) parts[3] = parts[3].replace(/0/g, 'O');
    return parts.join('/');
  }
  return mfFour.valeur;
}

function formatTauxTVA(val) {
  if (!val) return '19%';
  const s = String(val).replace('%', '').trim();
  if (s === 'Mixte' || s === 'mixte') return 'Mixte';
  const n = parseFloat(s);
  if (isNaN(n)) return '19%';
  return n + '%';
}

export function corrigerFacture(parsed, texteOCR) {
  const out = {
    fournisseur: parsed.fournisseur_nom
      || parsed.fournisseur
      || parsed.vendeur
      || parsed.nom_fournisseur
      || '',
    matricule_fiscal: parsed.fournisseur_mf
      || parsed.mf_fournisseur
      || parsed.matricule_fiscal
      || parsed.matricule
      || parsed.mf
      || '',
    date: parsed.date_facture
      || parsed.date_recu
      || parsed.date
      || '',
    numero_justificatif: parsed.numero_justificatif
      || parsed.numero_facture
      || parsed.num_facture
      || parsed.reference
      || parsed.numero
      || '',
    categorie: parsed.categorie_principale
      || parsed.categorie
      || 'Autres charges',
    taux_tva: formatTauxTVA(
      parsed.taux_tva
      || parsed.taux_tva_principal
      || parsed.tva_taux
      || '19'
    ),
    sous_total_ht: parsed.montant_ht
      || parsed.total_ht
      || parsed.base_ht
      || parsed.ht
      || 0,
    montant_tva: parsed.montant_tva
      || parsed.tva
      || parsed.total_tva
      || 0,
    timbre: parsed.timbre_fiscal
      ?? parsed.timbre
      ?? 1.000,
    fodec: parsed.fodec
      || parsed.montant_fodec
      || 0,
    total_ttc: parsed.montant_ttc
      || parsed.ttc
      || parsed.total_ttc
      || parsed.net_a_payer
      || 0,
    retenue_source: !!(parsed.rs_montant || parsed.retenue_source),
    rs_montant: parseFloat(parsed.rs_montant) || 0,
    rs_taux: parseFloat(parsed.rs_taux) || 0,
    alertes: [],
    notes: [],
    lignes: parsed.lignes || [],
  };

  try {
    const rawText = texteOCR;
    if (!rawText || rawText.trim().length < 10) {
      out.alertes.push('texte_trop_court');
      return out;
    }

    const { text } = corrigerOCRAvecTrace(rawText);
    const lignesDetectees = detectLignes(text);
    const t = text.toLowerCase();
    if (lignesDetectees.length > 0) out.lignes = lignesDetectees;
    const lignes = out.lignes;

    // ═══════════════════════════════════════════
    // ÉTAPE 0 — Extraction du récapitulatif (unique)
    // ═══════════════════════════════════════════
    const recap = extraireRecapitulatif(text);
    // TTN: detectTotalHT en complément
    if (recap.ht === null) recap.ht = detectTotalHT(text);

    // Fallback: scan ligne par ligne
    const lignesTexte = text.split('\n').filter(Boolean);
    if (recap.ht === null || recap.tva === null || recap.ttc === null) {
      const ancresHT = /total\s*ht|sous[- ]?total\s*ht|total\s*hors\s*taxe/i;
      const ancresTVA = /total\s*tva|montant\s*tva|tva\s*\(\d+\s*%\)|tva\s*\d{1,2}\s*%/i;
      const ancresTTC = /net\s*(?:à\s*)?payer|total\s*ttc|montant\s*ttc|ttc\b/i;
      for (const ligne of lignesTexte) {
        const nb = extraireNombre(ligne);
        if (nb <= 0) continue;
        if (ancresHT.test(ligne) && recap.ht === null) recap.ht = nb;
        if (ancresTVA.test(ligne) && recap.tva === null) recap.tva = nb;
        if (ancresTTC.test(ligne) && recap.ttc === null) recap.ttc = nb;
      }
    }

    // ── Fallback: analyse valeur (labels ≠ valeurs, tableaux PDF) ──
    if (recap.ht === null || recap.tva === null || recap.ttc === null) {
      const analyse = analyseValeursFacture(text);
      if (recap.ht === null && analyse.ht !== null) {
        recap.ht = analyse.ht;
        out.notes.push('HT par analyse valeurs: ' + analyse.ht.toFixed(3));
      }
      if (recap.ttc === null && analyse.ttc !== null) {
        recap.ttc = analyse.ttc;
        out.notes.push('TTC par analyse valeurs: ' + analyse.ttc.toFixed(3));
      }
      if (recap.tva === null && analyse.tva !== null) {
        recap.tva = analyse.tva;
        out.notes.push('TVA par analyse valeurs: ' + analyse.tva.toFixed(3));
      }
      if (recap.timbre === null && analyse.timbre !== null) {
        recap.timbre = analyse.timbre;
      }
      if (recap.fodec === null && analyse.fodec !== null) {
        recap.fodec = analyse.fodec;
      }
    }

    // Montant en lettres comme dernier secours pour TTC
    if (recap.ttc === null) {
      const mLettres = parseMontantLettres(text);
      if (mLettres !== null && mLettres > 0) {
        recap.ttc = mLettres;
        out.notes.push('Total en lettres : ' + mLettres.toFixed(3) + ' DT');
      }
    }

    // Appliquer les valeurs du recap
    if (recap.ht !== null) out.sous_total_ht = recap.ht;
    if (recap.tva !== null) out.montant_tva = recap.tva;
    if (recap.ttc !== null) out.total_ttc = recap.ttc;
    if (recap.timbre !== null) out.timbre = recap.timbre;
    if (recap.fodec !== null) out.fodec = recap.fodec;

    // Validation recap: TTC ≈ HT + TVA + Timbre + FODEC
    if (recap.ht !== null && recap.tva !== null && recap.ttc !== null) {
      const attendu = recap.ht + (recap.tva || 0) + (recap.timbre || 1.000) + (recap.fodec || 0);
      if (Math.abs(recap.ttc - attendu) > 0.010) {
        out.alertes.push('ecart_recap');
        out.notes.push('Récapitulatif : HT=' + recap.ht.toFixed(3) + ' + TVA=' + (recap.tva||0).toFixed(3) + ' + Timbre=' + (recap.timbre||1).toFixed(3) + ' + FODEC=' + (recap.fodec||0).toFixed(3) + ' = ' + attendu.toFixed(3) + ' ≠ TTC=' + recap.ttc.toFixed(3));
      }
    }

    // Alertes pour lignes recap absentes
    const recapAllNull = recap.ht === null && recap.tva === null && recap.ttc === null && recap.timbre === null && recap.fodec === null;
    if (recapAllNull) {
      out.alertes.push('recap_manquant');
    } else {
      if (recap.ht === null) out.alertes.push('recap_manquant_ht');
      if (recap.tva === null) out.alertes.push('recap_manquant_tva');
    }

    // ── Fallback: HT/TVA manquants → dériver des lignes article ou TTC ──
    if ((recap.ht === null || recap.tva === null) && out.total_ttc > 0) {
      if (lignes.length > 0) {
        const sumHT = lignes.reduce((s, l) => s + (l.total || l.prix_unitaire || 0), 0);
        if (sumHT > 0) {
          if (recap.ht === null) {
            // Only use sumHT if formulaire value is missing or coherent (±20%)
            const coherent = out.sous_total_ht <= 0 || Math.abs(sumHT - out.sous_total_ht) / Math.max(out.sous_total_ht, 0.001) < 0.20;
            if (coherent) {
              out.sous_total_ht = parseFloat(sumHT.toFixed(3));
              out.notes.push('HT dérivé des lignes article : ' + out.sous_total_ht.toFixed(3));
            } else {
              out.notes.push('HT des lignes article ignoré (incohérent) : ' + sumHT.toFixed(3) + ' vs recap ' + out.sous_total_ht.toFixed(3));
            }
          }
          if (recap.tva === null) {
            const tvaDerivee = out.total_ttc - out.sous_total_ht - (out.timbre || 0) - (out.fodec || 0);
            if (tvaDerivee > -0.010 && tvaDerivee < out.total_ttc) {
              out.montant_tva = Math.round(Math.max(0, tvaDerivee) * 1000) / 1000;
              out.notes.push('TVA dérivée : TTC - HT - Timbre = ' + out.montant_tva.toFixed(3));
            }
          }
          if (out.sous_total_ht > 0 && out.montant_tva > 0) {
            const pct = Math.round(out.montant_tva / out.sous_total_ht * 100);
            if ([0, 7, 12, 13, 19].includes(pct)) {
              out.taux_tva = pct + '%';
              out.notes.push('Taux TVA dérivé : ' + out.taux_tva);
            }
          }
        }
      } else {
        // Pas de lignes, dériver HT et TVA mathématiquement à partir du TTC, du Timbre et du Taux TVA
        const tvaRateStr = (out.taux_tva === 0) ? '0%' : (out.taux_tva || '19%');
        const r = parseFloat(tvaRateStr.replace('%', ''));
        const tvaRate = (r === 0) ? 0 : (r || 19);
        const timbreVal = out.timbre || 0;
        const fodecVal = out.fodec || 0;
        
        if (recap.ht === null && out.total_ttc > timbreVal + fodecVal) {
          const derivedHT = (out.total_ttc - timbreVal - fodecVal) / (1 + tvaRate / 100);
          out.sous_total_ht = parseFloat(derivedHT.toFixed(3));
          out.notes.push('HT dérivé mathématiquement (Taux ' + tvaRate + '%) : ' + out.sous_total_ht.toFixed(3));
          
          if (recap.tva === null) {
            const derivedTVA = out.total_ttc - out.sous_total_ht - timbreVal - fodecVal;
            out.montant_tva = parseFloat(derivedTVA.toFixed(3));
            out.notes.push('TVA dérivée mathématiquement : ' + out.montant_tva.toFixed(3));
          }
        }
      }
    }

    // ═══════════════════════════════════════════
    // ÉTAPE 1 — Fournisseur & Matricule Fiscal
    // ═══════════════════════════════════════════
    // Trouver l'index de la ligne "FACTURÉ À" / "Client :"
    const idxClientBloc = lignesTexte.findIndex(l =>
      /factur[eé]\s*[àa]|client\s*:|adresse\s*client/i.test(l)
    );

    // Extraire TOUS les MF avec leur position ligne
    const mfRegex = /\b(\d{7}\/[A-Z0-9]\/[A-Z0-9](?:\/[A-Z0-9]\/\d{3})?)\b/g;
    const mfTrouves = [];
    lignesTexte.forEach((ligne, idx) => {
      let m;
      while ((m = mfRegex.exec(ligne)) !== null) {
        mfTrouves.push({ valeur: m[1], ligne: idx });
      }
    });

    // MF fournisseur = premier MF AVANT le bloc client
    const mfFournisseur = mfTrouves.find(mf =>
      idxClientBloc === -1 || mf.ligne < idxClientBloc
    );

    if (mfFournisseur) {
      // Normaliser OCR : 0→O dans les positions lettres (ex: 0012345/0/A/M/000 → 0012345/O/A/M/000)
      // Normaliser OCR : 0→O dans les positions lettres (ex: 0012345/0/A/M/000 → 0012345/O/A/M/000)
      const mfParts = mfFournisseur.valeur.split('/');
      if (mfParts.length >= 3) {
        mfParts[1] = mfParts[1].replace(/0/g, 'O');
        if (mfParts.length >= 4) mfParts[3] = mfParts[3].replace(/0/g, 'O');
        out.matricule_fiscal = mfParts.join('/');
      } else {
        out.matricule_fiscal = mfFournisseur.valeur;
      }
    }

    // Fournisseur : en-tête (5 premières lignes), exclure "FACTURÉ À", "Client :"
    const entete = lignesTexte.slice(0, 5).join('\n');
    const fournisseur = detectFournisseur(entete);
    if (fournisseur) {
      out.fournisseur = fournisseur;
    } else {
      out.fournisseur = detectFournisseur(text);
    }

    // Validation MF
    const MF_FULL = /^\d{7}\/[A-Z0-9]\/[A-Z0-9]\/[A-Z0-9]\/\d{3}$/;
    if (!out.matricule_fiscal || !MF_FULL.test(out.matricule_fiscal)) {
      out.alertes.push('mf_manquant');
    }

    // ═══════════════════════════════════════════
    // ÉTAPE 2 — Date & Référence
    // ═══════════════════════════════════════════
    const date = detectDate(text);
    if (date) {
      out.date = date.split('-').reverse().join('/');
    }
    const numero = detectNumeroFacture(text);
    if (numero) {
      out.numero_justificatif = numero;
    }

    // ═══════════════════════════════════════════
    // ÉTAPE 3 — TVA Mixte
    // ═══════════════════════════════════════════
    const tauxUniques = new Set();
    if (lignes.length > 0) {
      for (const l of lignes) {
        if (l.tva !== undefined) tauxUniques.add(l.tva);
      }
    } else {
      const pct = [...text.matchAll(/\b(7|13|19|0)\s*%/g)];
      pct.forEach(m => tauxUniques.add(parseInt(m[1])));
      const alt = [...text.matchAll(/\b(7|13|19|0)\s+(?:\d+[.,])?\d{3,}\s+(?:\d+[.,])?\d{3,}/g)];
      alt.forEach(m => tauxUniques.add(parseInt(m[1])));
    }

    if (tauxUniques.has(0) && (tauxUniques.has(7) || tauxUniques.has(13) || tauxUniques.has(19))) {
      out.taux_tva = 'Mixte';
      out.notes.push('Taux TVA : ' + [...tauxUniques].join('% / ') + '%');
      out.alertes.push('tva_mixte_verifier');
    } else if (tauxUniques.size === 1) {
      out.taux_tva = [...tauxUniques][0] + '%';
    } else {
      const fourKey = (out.fournisseur || '').toLowerCase().trim();
      const metaFour = FOURNISSEURS_LOOKUP[fourKey] || null;
      if (metaFour?.tva != null) {
        out.taux_tva = metaFour.tva + '%';
      }
    }

    if (recap.tva !== null && recap.tva === 0 && (recap.ht || 0) > 0) {
      out.alertes.push('tva_zero_verifier');
    }

    // ═══════════════════════════════════════════
    // ÉTAPE 4 — Catégorie
    // ═══════════════════════════════════════════
    // Règles A–F sur les désignations
    const desigs = lignes.map(l => (l.designation || '').toLowerCase());
    const txtBas = t;

    function testCat(rule) {
      for (const d of desigs) {
        if (rule.some(k => d.includes(k))) return true;
      }
      return rule.some(k => txtBas.includes(k));
    }

    if (testCat(['abonnement']) && testCat(['mobile', '4g', 'internet', 'sms'])) {
      out.categorie = 'Télécoms & Internet';
      if (testCat(['souris', 'clavier', 'écran', 'pc', 'laptop', 'sim', 'disque', 'mémoire', 'usb', 'chargeur', 'boitier'])) {
        // Articles mixtes — prendre la catégorie du plus haut HT
        const sumCat = {};
        for (const l of lignes) {
          const d = (l.designation || '').toLowerCase();
          let cat = 'Autres charges';
          if (/\b(abonnement|mobile|4g|internet|sms)\b/i.test(d)) cat = 'Télécoms & Internet';
          else if (/\b(souris|clavier|écran|pc|laptop|sim|disque|mémoire|usb|chargeur|boitier)\b/i.test(d)) cat = 'Matériel informatique';
          else if (/\b(prestation|honoraire|maintenance|conseil)\b/i.test(d)) cat = 'Services & Honoraires';
          sumCat[cat] = (sumCat[cat] || 0) + (l.prix_unitaire || 0);
        }
        let best = '', bestVal = 0;
        for (const [c, v] of Object.entries(sumCat)) {
          if (v > bestVal) { best = c; bestVal = v; }
        }
        if (best) out.categorie = best;
      }
    } else if (testCat(['souris', 'clavier', 'écran', 'pc', 'laptop', 'sim', 'disque', 'mémoire', 'usb', 'chargeur', 'boitier', 'tb220', 'sata', 'ramitech'])) {
      out.categorie = 'Matériel informatique';
    } else if (testCat(['prestation', 'honoraire', 'maintenance', 'conseil', 'redevance'])) {
      out.categorie = 'Services & Honoraires';
    } else if (testCat(['loyer', 'électricité', 'eau', 'gaz', 'steg', 'sonede'])) {
      out.categorie = 'Charges & Services';
    } else if (testCat(['papier', 'stylo', 'cartouche', 'fourniture', 'classeur', 'ramette'])) {
      out.categorie = 'Fournitures & Consommables';
    } else {
      if (out.categorie === 'Autres charges') out.alertes.push('categorie_inconnue');
    }

    // ═══════════════════════════════════════════
    // ÉTAPE 5 — Timbre & FODEC
    // ═══════════════════════════════════════════
    const fourKey = (out.fournisseur || '').toLowerCase().trim();
    const metaFour = FOURNISSEURS_LOOKUP[fourKey] || null;

    if (recap.timbre !== null) {
      out.timbre = recap.timbre;
    } else if (metaFour?.timbre === 0) {
      out.timbre = 0.000;
    } else {
      out.timbre = 1.000;
    }

    out.fodec = recap.fodec !== null ? recap.fodec : 0.000;

    // ═══════════════════════════════════════════
    // ÉTAPE 6 — Alertes
    // ═══════════════════════════════════════════
    if (out.total_ttc > 5000) {
      out.alertes.push('retenue_source_probable');
    }
    if (!date) {
      out.alertes.push('date_manquante');
    } else if (out.date) {
      const [d, m, y] = out.date.split('/').map(Number);
      if (new Date(y, m - 1, d) > new Date()) {
        out.alertes.push('date_future');
      }
    }
    if (lignes.length > 0 && recap.ht !== null) {
      const sumHT = lignes.reduce((s, l) => s + (l.prix_unitaire || 0), 0);
      if (Math.abs(sumHT - recap.ht) > 0.100) {
        out.alertes.push('ecart_lignes_recap');
      }
    }
    if (recap.tva !== null && recap.ht !== null) {
      const tvaCalculee = lignes.reduce((s, l) => {
        if (l.tva !== undefined) return s + (l.prix_unitaire || 0) * l.tva / 100;
        return s;
      }, 0);
      if (Math.abs(tvaCalculee - recap.tva) > 0.010) {
        out.alertes.push('ecart_tva');
      }
    }

    const rs = detectRSPrestation(text, out.fournisseur);
    if (rs.applicable) {
      out.retenue_source = true;
      out.rs_taux = rs.taux || 1.5;
      if (!out.rs_montant) {
        const montantTTC = out.total_ttc || 0;
        out.rs_montant = parseFloat((montantTTC * (rs.taux || 1.5) / 100).toFixed(3));
      }
    }

  } catch (e) {
    out.alertes.push('erreur_correction');
    out.notes.push('Erreur: ' + e.message);
  }

  return out;
}
