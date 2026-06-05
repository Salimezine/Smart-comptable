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
  'ooredoo':            { categorie: 'Télécoms & Internet', tva: 19, rs: false },
  'orange tn':          { categorie: 'Télécoms & Internet', tva: 19, rs: false },
  'orange':             { categorie: 'Télécoms & Internet', tva: 19, rs: false },
  'tunisie telecom':    { categorie: 'Télécoms & Internet', tva: 19, rs: false },
  'topnet':             { categorie: 'Télécoms & Internet', tva: 19, rs: false },
  'globalnet':          { categorie: 'Télécoms & Internet', tva: 19, rs: false },
  'hexabyte':           { categorie: 'Télécoms & Internet', tva: 19, rs: false },
  // Énergie & eau
  'steg':               { categorie: 'Électricité & eau', tva: 13, rs: false, timbre: 0 },
  'sonede':             { categorie: 'Électricité & eau', tva: 0,  rs: false, timbre: 0 },
  // Grande distribution
  'monoprix':           { categorie: 'Fournitures bureau', tva: 19, rs: false },
  'geant':              { categorie: 'Fournitures bureau', tva: 19, rs: false },
  'mg':                 { categorie: 'Fournitures bureau', tva: 19, rs: false },
  'carrefour':          { categorie: 'Fournitures bureau', tva: 19, rs: false },
  // Carburant
  'sndp':               { categorie: 'Carburant', tva: 19, rs: false },
  'total energie':      { categorie: 'Carburant', tva: 19, rs: false },
  'total tunisie':      { categorie: 'Carburant', tva: 19, rs: false },
  'agil':               { categorie: 'Carburant', tva: 19, rs: false },
  'vivo energy':        { categorie: 'Carburant', tva: 19, rs: false },
  // Informatique
  'e-info':            { categorie: 'Matériel informatique', tva: 7, rs: false },
  'e info':            { categorie: 'Matériel informatique', tva: 7, rs: false },
  'einfo':             { categorie: 'Matériel informatique', tva: 7, rs: false },
  'ednfo':             { categorie: 'Matériel informatique', tva: 7, rs: false },
  'microsoft tn':       { categorie: 'Matériel informatique', tva: 19, rs: false },
  'tunisie bureautique':{ categorie: 'Matériel informatique', tva: 7, rs: false },
  // Services / impression
  'ste bonjour':        { categorie: 'Prestation services', tva: null, rs: true },
  'rapid press':        { categorie: 'Prestation services', tva: 7, rs: true },
  // Assurance
  'star':               { categorie: 'Assurance', tva: 0, rs: false },
  'gat':                { categorie: 'Assurance', tva: 0, rs: false },
  'maghrebia':          { categorie: 'Assurance', tva: 0, rs: false },
  'comar':              { categorie: 'Assurance', tva: 0, rs: false },
  // Transport
  'sncft':              { categorie: 'Transport', tva: 0, rs: false },
  'transtu':            { categorie: 'Transport', tva: 0, rs: false },
  // Banque
  'biat':               { categorie: 'Frais bancaires', tva: 19, rs: 10 },
  'attijari':           { categorie: 'Frais bancaires', tva: 19, rs: 10 },
  'bna':                { categorie: 'Frais bancaires', tva: 19, rs: 10 },
  'bh bank':            { categorie: 'Frais bancaires', tva: 19, rs: 10 },
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
    t = t.replace(/(\d)\s+(\d{3}[.,])/g, '$1$2');
    t = t.replace(/œ/g, 'oe').replace(/Œ/g, 'OE');
    t = t.replace(/[¡¢£¤¥¦§¨©ª«¬®¯±²³´µ¶·¸¹º»¼½¾¿]/g, '');

    // Corriger "0" lu comme "O" ou "D" dans les montants
    t = t.replace(/(\d)[,.]O{2,}/g, '$1,000');

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
      biat: 'BIAT', 'bh bank': 'BH Bank', attijari: 'Attijari', bna: 'BNA',
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
        return match[0].trim();
      }
    }

    // Pass 2 — heuristique sur les 15 premières lignes
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const ignorePatterns = [
      /^[\d\+\-\*\/\.\,\#\(\)\[\]]/, /facture|invoice|reçu|recu|matricule|fiscal|client|adresse|date|total|montant|tva|timbre|page|désignation|designation|téléphone|telephone|fax|email|www|http|arrêtée|arretee|dinars|net à payer|net a payer|mode de|bon de livraison/i,
      /^rue|^av\.|^avenue|^bp|^tél|^tel/i, /\d{6,}/,
    ];
    for (const line of lines.slice(0, 15)) {
      if (line.length < 3 || line.length > 60) continue;
      if (line.includes(':') && line.indexOf(':') < 30) continue;
      const lowerLine = line.toLowerCase();
      if (ignorePatterns.some(p => p.test(lowerLine))) continue;
      if (BLACKLIST_FOURNISSEUR.some(r => r.test(lowerLine))) continue;
      if (/^[A-ZÀ-Ü][a-zà-üéèêëôöîïûü]/.test(line) && line.length > 4) return correctOCRText(line);
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

    for (const pat of patterns) {
      const m = text.match(pat);
      if (m) {
        const val = m[1].trim();
        if (val && val.length >= 1 && val.toLowerCase() !== 'ture') return val;
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
    const m = text.match(/(?:Client|Client\s*[:﹕]?)\s*\n+\s*([A-Za-zÀ-ÿ\s\-']{3,60}?)(?:\s*,|\s*\n|$)/i);
    if (m) return m[1].trim();
    const m2 = text.match(/Client\s*[:﹕]?\s*([A-Za-zÀ-ÿ\s\-']{3,60}?)\s*,/i);
    if (m2) return m2[1].trim();
    return '';
  } catch { return ''; }
}

// ─────────────────────────────────────────────
// 6. detectTotalTTC — Net à payer > Total TTC
// ─────────────────────────────────────────────
export function detectTotalTTC(text) {
  try {
    if (!text || typeof text !== 'string') return null;

    const patterns = [
      /Net\s*[àa]\s*payer\s*[:﹕|]\s*([\d\s]{1,8}[.,]\d{2,3})/i,
      /Total\s*TTC\s*[:﹕|]\s*([\d\s]{1,8}[.,]\d{2,3})/i,
      /Montant\s*TTC\s*[:﹕|]\s*([\d\s]{1,8}[.,]\d{2,3})/i,
      /Total\s*général\s*[:﹕|]\s*([\d\s]{1,8}[.,]\d{2,3})/i,
      /(?:الإجمالي|المجموع\s+الكلي)\s*[:﹕|]*\s*([\d\s]{1,8}[.,]\d{2,3})/i,
    ];

    for (const pat of patterns) {
      const m = text.match(pat);
      if (m) {
        let s = m[1].replace(/\s/g, '').replace(',', '.');
        const n = parseFloat(s);
        if (!isNaN(n) && n > 0) return n;
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
    const patterns = [
      /total\s*h\.?t\.?\s*[:\|]?\s*([\d\s]{1,8}[,.][\d]{3})/i,
      /sous.total\s*h\.?t\.?\s*[:\|]?\s*([\d\s]{1,8}[,.][\d]{3})/i,
      /base\s*h\.?t\.?\s*[:\|]?\s*([\d\s]{1,8}[,.][\d]{3})/i,
      /h\.?t\.?[^\d]{0,10}([\d]{1,6}[,.][\d]{3})/i,
    ];
    for (const pat of patterns) {
      const m = text.match(pat);
      if (m) {
        const s = m[1].replace(/\s/g, '').replace(',', '.');
        const n = parseFloat(s);
        if (!isNaN(n) && n > 0) return n;
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
    // STEG/SONEDE/services publics → pas de timbre
    const fLower = fournisseur.toLowerCase();
    if (/steg|sonede/i.test(fLower)) return 0;
    // Lire le montant "Timbre" imprimé sur la facture
    const m = text.match(/timbre\s*(?:fiscal)?\s*[:﹕|]?\s*([\d,\.]+)/i);
    if (m) {
      const val = parseFloat(m[1].replace(',', '.'));
      if (!isNaN(val)) return val;
    }
    return 1.000;
  } catch {
    return 1.000;
  }
}

// ─────────────────────────────────────────────
// 9. detectTauxTVA — taux dominant par base HT la plus grande
// ─────────────────────────────────────────────
export function detectTauxTVA(text) {
  try {
    if (!text || typeof text !== 'string') return 19;

    const tvaMatches = [...text.matchAll(/\b(7|13|19)\s*%/g)];
    const tvaFound = tvaMatches.map(m => parseInt(m[1]));

    if (tvaFound.length === 0) {
      const basePattern = /(\d{2,3}[.,]\d{3})\s+(\d{1,2})[.,]0{3}\s+(\d{1,3}[.,]\d{3})/gm;
      const bases = [...text.matchAll(basePattern)];
      if (bases.length > 0) {
        let maxBase = 0, maxTaux = 19;
        bases.forEach(b => {
          const base = parseFloat(b[1].replace(',', '.'));
          const taux = parseInt(b[2]);
          if (base > maxBase && [7, 13, 19].includes(taux)) {
            maxBase = base; maxTaux = taux;
          }
        });
        return maxTaux;
      }
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
    const patterns = [
      /(?:retenue\s+[àa]\s+la\s+source|r\.?s\.?)\s*[:﹕|]?\s*([\d,\.\s]+)/i,
      /retenue\s*(?:\d+[.,]?\d*\s*%)?\s*[:﹕|]?\s*([\d,\.\s]+)/i,
    ];
    for (const pat of patterns) {
      const m = text.match(pat);
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
    const tauxFound = [...text.matchAll(/\b(7|13|19)\s*%/g)];
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

  return alertes;
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

  t = t.replace(/(\d)\s+(\d{3}[.,])/g, (match, p1, p2) => {
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
  return isNaN(val) ? null : val;
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
        if ([0, 7, 13, 19].includes(tva) && prix !== null && total !== null) {
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
        if ([0, 7, 13, 19].includes(tva) && prix !== null && total !== null) {
          if (prix > total * 100) { prix = prix / 1000; }
          if (total > 0 && prix > total) { total = total / 1000; }
          if (tva === 0 && Math.abs(total - prix) > 0.010) { prix = total; }
          lignes.push({ designation: des, prix_unitaire: prix, quantite: 1, total: total, tva: tva });
          continue;
        }
      }
    }

    // General line: "DESIGNATION PU DT [QTY] TOTAL DT"
    const LIGNE_GEN = /(.{3,60}?)\s+(\d+[.,]\d{3})\s+DT\s+(\d+\s+)?(\d+[.,]\d{3})\s+DT/i;
    LIGNE_GEN.lastIndex = 0;
    const eg = LIGNE_GEN.exec(l);
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

    // Vente (facture client Smart Comptable)
    if (/votre facture|facturé à|facture a |client|FACT-\d{4}-\d{3}/i.test(lower)) return 'vente';

    // Prestation de services
    if (/\b(honoraires|consultation|maintenance|impression|sous-traitance|prestation|installation|réparation)\b/i.test(lower)) return 'achat_avec_prestation';

    // Fournisseur connu avec RS
    const fourKey = fournisseur ? fournisseur.toLowerCase() : '';
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
    const p1 = /(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})/g;
    const p2 = /(\d{4})[\/\-\.](\d{2})[\/\-\.](\d{2})/g;
    const p3 = /(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/gi;
    // Collect all valid dates with positions
    const dates = [];
    let m;
    while ((m = p1.exec(text)) !== null) {
      dates.push({ date: `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`, pos: m.index });
    }
    while ((m = p2.exec(text)) !== null) {
      dates.push({ date: `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`, pos: m.index });
    }
    while ((m = p3.exec(text)) !== null) {
      dates.push({ date: `${m[3]}-${MONTHS[m[2].toLowerCase()]||'01'}-${m[1].padStart(2,'0')}`, pos: m.index });
    }
    // Prefer dates near keywords; else last match
    const kw = /\b(?:Date|date|Le|le|Facture|facture|E[\-\s]INFO|émise|du)\s*[:\-]?\s*$/;
    let best = null;
    for (const d of dates) {
      const before = text.slice(Math.max(0, d.pos - 50), d.pos);
      if (kw.test(before)) { best = d.date; break; }
    }
    if (!best && dates.length > 0) best = dates[dates.length - 1].date;
    return best || null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// 21. parseFactureTunisienne — pipeline complet (format JSON spec)
// ─────────────────────────────────────────────
export function parseFactureTunisienne(rawText) {
  try {
    if (!rawText || rawText.trim().length < 10) return null;

    // Étape 0: détection PDF
    if (detectPDF(rawText)) {
      return {
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

    // Étape 1: correction OCR avec trace
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
      if (sumHT > 0) { totalHT = parseFloat(sumHT.toFixed(3)); }
      if (sumTVACalc > 0) { totalTVA = parseFloat(sumTVACalc.toFixed(3)); }
      // TTC = somme des totaux ligne + timbre
      const totalTTCFromLines = parseFloat((sumTotals + (timbre ?? 1.000)).toFixed(3));
      if (totalTTCFromLines > 0) { totalTTC = totalTTCFromLines; }

      // Taux TVA le plus fréquent parmi les lignes cohérentes
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
    const netADecaisser  = parseFloat((montantTTC_num + timbre_num + fodec_num - rs_num).toFixed(3));

    // Étape 4: vérification croisée
    const coherenceData = {
      montant_ht: montantHT_num || null,
      montant_tva: totalTVA || null,
      montant_ttc: montantTTC_num || null,
      taux_tva: tauxTVA,
      timbre_fiscal: timbre_num,
      fodec: fodec_num,
      retenue_source: rs_num,
      taux_rs: rsInfo.applicable ? rsInfo.taux : 0,
    };
    const verif = verifierCoherence(coherenceData);

    // Étape 5: alertes
    const confiance = Math.min(100, Math.round(([fournisseur, mf, numero, date, totalHT, totalTTC, totalTVA, timbre].filter(Boolean).length / 8) * 100));
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

    // Étape 6: champs à confirmer
    const champsAConfirmer = [];
    if (!fournisseur) champsAConfirmer.push('fournisseur_nom');
    if (!mf) champsAConfirmer.push('fournisseur_mf');
    if (!numero) champsAConfirmer.push('numero_justificatif');
    if (!date) champsAConfirmer.push('date_facture');
    if (!totalHT) champsAConfirmer.push('montant_ht');
    if (!totalTTC) champsAConfirmer.push('montant_ttc');

    return {
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
        montant_ttc: montantTTC_num,
        timbre_fiscal: timbre_num,
        fodec: fodec_num,
        rs_applicable: rsInfo.applicable,
        rs_taux: rsInfo.applicable ? rsInfo.taux : 0,
        rs_base: rs_base,
        rs_montant: rs_num,
        net_a_decaisser: netADecaisser || 0,
        mode_reglement: modeReglement,
      },
      verification: {
        calculs_coherents: verif.calculs_coherents,
        mf_present: !!mf,
        source_valeurs: source_valeurs,
        alertes: verif.alertes.concat(alertes.map(a => a.message)),
        corrections_ocr: correctionsOCR,
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
const FOURNISSEURS_KEY = 'smart_fournisseurs';

export function saveOrUpdateFournisseur(name, data = {}) {
  try {
    if (!name || typeof name !== 'string') return;
    const trimmed = name.trim();
    if (!trimmed || BLACKLIST_FOURNISSEUR.some(r => r.test(trimmed))) return;

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

    localStorage.setItem(FOURNISSEURS_KEY, JSON.stringify(fournisseurs));
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
    const words = m[1].trim().toLowerCase().replace(/[œ]/g, 'oe').split(/[\s\-]+/).filter(Boolean);

    let total = 0, current = 0;
    const map = {
      zéro: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5,
      six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
      onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16,
      'dix-sept': 17, 'dix-huit': 18, 'dix-neuf': 19,
      vingt: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60,
      cent: 100, mille: 1000,
    };
    const centMots = ['cent', 'cents'];
    const milleMots = ['mille'];

    for (const w of words) {
      if (w === 'et' || w === 'dinars') continue;
      if (map[w] !== undefined) {
        const v = map[w];
        if (v >= 1000) { total += current * v; current = 0; }
        else if (v >= 100) { current = (current || 1) * v; }
        else { current += v; }
      } else if (centMots.includes(w)) { current = (current || 1) * 100; }
      else if (milleMots.includes(w)) { total += current * 1000; current = 0; }
    }
    total += current;
    return total > 0 ? total : null;
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

function extraireRecapitulatif(text) {
  return {
    ht: extraireDernier(text, [/total\s*ht\s*[:﹕]?\s*([\d\s,.]+)/i, /sous[- ]?total\s*ht\s*[:﹕]?\s*([\d\s,.]+)/i]),
    tva: extraireDernier(text, [/total\s*tva\s*[:﹕]?\s*([\d\s,.]+)/i, /montant\s*tva\s*[:﹕]?\s*([\d\s,.]+)/i]),
    timbre: extraireDernier(text, [/timbre\s*(?:fiscal)?\s*[:﹕|]?\s*([\d,\.]+)/i]),
    fodec: extraireDernier(text, [/fodec\s*[:﹕]?\s*([\d\s,.]+)/i]),
    ttc: extraireDernier(text, [/net\s*(?:à\s*)?payer\s*[:﹕]?\s*([\d\s,.]+)/i, /total\s*ttc\s*[:﹕]?\s*([\d\s,.]+)/i]),
  };
}

function extraireMFFournisseur(text) {
  const lignes = text.split('\n').filter(Boolean);
  const idxClient = lignes.findIndex(l => /factur[eé]\s*[àa]|client\s*:|adresse\s*client/i.test(l));
  const mfRegex = /\b(\d{7}\/[A-Z0-9]\/[A-Z0-9](?:\/[A-Z0-9]\/\d{3})?)\b/g;
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
    const lignes = detectLignes(text);
    const t = text.toLowerCase();
    out.lignes = lignes;

    // ═══════════════════════════════════════════
    // ÉTAPE 0 — Extraction du récapitulatif
    // ═══════════════════════════════════════════
    const recap = { ht: null, tva: null, timbre: null, fodec: null, ttc: null };

    recap.ht = extraireDernier(text, [
      /total\s*ht\s*[:﹕]?\s*([\d\s,.]+)/i,
      /sous[- ]?total\s*ht\s*[:﹕]?\s*([\d\s,.]+)/i,
      /total\s*hors\s*taxe\s*[:﹕]?\s*([\d\s,.]+)/i,
    ]);
    recap.tva = extraireDernier(text, [
      /total\s*tva\s*[:﹕]?\s*([\d\s,.]+)/i,
      /montant\s*tva\s*[:﹕]?\s*([\d\s,.]+)/i,
      /tva\s*\(\d+\s*%\)\s*[:﹕]?\s*([\d\s,.]+)/i,
    ]);
    recap.timbre = extraireDernier(text, [
      /timbre\s*(?:fiscal)?\s*[:﹕|]?\s*([\d,\.]+)/i,
    ]);
    recap.fodec = extraireDernier(text, [
      /fodec\s*[:﹕]?\s*([\d\s,.]+)/i,
    ]);
    recap.ttc = extraireDernier(text, [
      /net\s*(?:à\s*)?payer\s*[:﹕]?\s*([\d\s,.]+)/i,
      /total\s*ttc\s*[:﹕]?\s*([\d\s,.]+)/i,
      /montant\s*ttc\s*[:﹕]?\s*([\d\s,.]+)/i,
      /ttc\s*[:﹕]?\s*([\d\s,.]+)/i,
      /total\s*[:﹕]?\s*([\d\s,.]+)\s*(?:dt|dinars)/i,
    ]);

    // Fallback: scan ligne par ligne si extraireDernier a raté des valeurs
    const lignesTexte = text.split('\n').filter(Boolean);
    if (recap.ht === null || recap.tva === null || recap.ttc === null) {
      const ancresHT = /total\s*ht|sous[- ]?total\s*ht|total\s*hors\s*taxe/i;
      const ancresTVA = /total\s*tva|montant\s*tva|tva\s*\(\d+\s*%\)/i;
      const ancresTTC = /net\s*(?:à\s*)?payer|total\s*ttc|montant\s*ttc|ttc\b/i;
      for (const ligne of lignesTexte) {
        const nb = extraireNombre(ligne);
        if (nb <= 0) continue;
        if (ancresHT.test(ligne) && recap.ht === null) recap.ht = nb;
        if (ancresTVA.test(ligne) && recap.tva === null) recap.tva = nb;
        if (ancresTTC.test(ligne) && recap.ttc === null) recap.ttc = nb;
      }
    }

    // Montant en lettres comme TTC de secours
    const mLettres = parseMontantLettres(text);
    if (mLettres !== null && mLettres > 0 && recap.ttc === null) {
      recap.ttc = mLettres;
      out.notes.push('Total en lettres : ' + mLettres.toFixed(3) + ' DT');
    }

    // Appliquer les valeurs du recap
    if (recap.ht !== null) out.sous_total_ht = recap.ht;
    if (recap.tva !== null) out.montant_tva = recap.tva;
    if (recap.ttc !== null) out.total_ttc = recap.ttc;

    // Validation recap: TTC ≈ HT + TVA + Timbre + FODEC
    if (recap.ht !== null && recap.tva !== null && recap.ttc !== null) {
      const attendu = recap.ht + (recap.tva || 0) + (recap.timbre || 1.000) + (recap.fodec || 0);
      if (Math.abs(recap.ttc - attendu) > 0.010) {
        out.alertes.push('ecart_recap');
        out.notes.push('Récapitulatif : HT=' + recap.ht.toFixed(3) + ' + TVA=' + (recap.tva||0).toFixed(3) + ' + Timbre=' + (recap.timbre||1).toFixed(3) + ' + FODEC=' + (recap.fodec||0).toFixed(3) + ' = ' + attendu.toFixed(3) + ' ≠ TTC=' + recap.ttc.toFixed(3));
      }
    }

    // Alertes pour lignes recap absentes
    if (recap.ht === null && recap.tva === null && recap.ttc === null && recap.timbre === null && recap.fodec === null) {
      out.alertes.push('recap_manquant');
    }

    // ── Fallback: HT/TVA manquants → dériver des lignes article + TTC ──
    if ((recap.ht === null || recap.tva === null) && out.total_ttc > 0 && lignes.length > 0) {
      const sumHT = lignes.reduce((s, l) => s + (l.total || l.prix_unitaire || 0), 0);
      if (sumHT > 0) {
        if (recap.ht === null) {
          out.sous_total_ht = parseFloat(sumHT.toFixed(3));
          out.notes.push('HT dérivé des lignes article : ' + out.sous_total_ht.toFixed(3));
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
          if ([0, 7, 13, 19].includes(pct)) {
            out.taux_tva = pct + '%';
            out.notes.push('Taux TVA dérivé : ' + out.taux_tva);
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
    }

  } catch (e) {
    out.alertes.push('erreur_correction');
    out.notes.push('Erreur: ' + e.message);
  }

  // ── Correction fallback depuis texte OCR brut ─────────────
  if (texteOCR && texteOCR.trim().length >= 10) {
    const recap = extraireRecapitulatif(texteOCR);
    if (recap.ht > 0 && recap.ttc > 0) {
      if (recap.ht !== null) out.sous_total_ht = recap.ht;
      if (recap.tva !== null) out.montant_tva = recap.tva;
      if (recap.ttc !== null) out.total_ttc = recap.ttc;
      if (recap.timbre !== null) out.timbre = recap.timbre;
      if (recap.fodec !== null) out.fodec = recap.fodec;
    }
    const mfCorrige = extraireMFFournisseur(texteOCR);
    if (mfCorrige) out.matricule_fiscal = mfCorrige;
  }

  return out;
}
