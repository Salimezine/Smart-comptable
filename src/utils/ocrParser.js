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
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    for (const line of lines.slice(0, 15)) {
      if (line.length < 3 || line.length > 70) continue;
      if (/^[\d\+\-\*\/\.\,\#\(\)\[\]]/.test(line)) continue;
      const lower = line.toLowerCase().trim();
      if (BLACKLIST_FOURNISSEUR.some(r => r.test(lower))) continue;
      if (/^(rue|av\.|avenue|bp|tél|tel|fax|email|www|http)/i.test(lower)) continue;
      if (/\d{8,}/.test(lower)) continue;
      if ((/^[A-ZÀ-Ü][a-zà-ü]/.test(line) && line.length > 4) || (/^[A-ZÀ-Ü\s]{2,30}$/.test(line) && line.length >= 3)) {
        return correctOCRText(line);
      }
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

    const mfBody = '\\d{6,7}[A-Z]?\\/[A-Z](?:\\/[A-Z](?:\\/\\d{3})?)?';
    const patterns = [
      // "M F : 130893/B" (cas E-info: espace entre M et F)
      new RegExp('M\\s+F\\s*:?\\s*(' + mfBody + ')', 'i'),
      // "MF: 130893/B" avec pipe ou séparateurs alternatifs
      new RegExp('M\\.?F\\.?\\s*:?\\s*(' + mfBody + ')', 'i'),
      // "Matricule Fiscal : 130893/B"
      new RegExp('matricule\\s*fiscal\\s*:?\\s*(' + mfBody + ')', 'i'),
      // Pattern seul sur une ligne (sans label)
      new RegExp('^\\s*(' + mfBody + ')\\s*$', 'm'),
    ];
    const validateMf = /^\d{6,7}[A-Z]?\//;

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const val = match[1].trim();
        if (validateMf.test(val)) return val;
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
      // Préférer les captures longues (références avec séparateurs) avant les chiffres courts
      /(?:N°|NO|NUMÉRO|NUMERO|REF|RÉF|REFERENCE)\s*(?:FACTURE|FACT)?\s*[:﹕]?\s*(\w[\w\-\/]{2,})/i,
      /(?:facture|fact\.?)\s*n[°o°]?\s*:?\s*(\w[\w\-\/]+)/i,
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
export function detectTimbre(text) {
  try {
    if (!text || typeof text !== 'string') return 1.000;
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

    const categories = [
      {
        cat: 'Informatique & Matériel',
        fournisseurs: ['e-info', 'einfo', 'ramitech', 'tunisie info', 'informatique'],
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

  const mf = data.matriculeFiscal || data.matricule_fiscal || '';
  if (mf && !/^\d{6,7}[A-Z]?\//.test(mf)) {
    alertes.push({ code: 'MF_FORMAT_INVALIDE', message: `Format MF non conforme: "${mf}"` });
  }

  if (data.mode_reglement === 'espèces' && (data.montant_ttc || 0) > 5000) {
    alertes.push({ code: 'PAIEMENT_CASH', message: 'Paiement espèces > 5 000 DT — Loi 2016-35' });
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
        const prix = normaliserMontant(em3[3]);
        const total = normaliserMontant(em3[4]);
        if ([0, 7, 13, 19].includes(tva) && prix !== null && total !== null) {
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
        const prix = normaliserMontant(em[3]);
        const total = normaliserMontant(em[4]);
        if ([0, 7, 13, 19].includes(tva) && prix !== null && total !== null) {
          lignes.push({ designation: des, prix_unitaire: prix, quantite: 1, total: total, tva: tva });
          continue;
        }
      }
    }
  }
  return lignes;
}

// ─────────────────────────────────────────────
// 20c. detectDate — date facture (DD/MM/YYYY)
// ─────────────────────────────────────────────
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
    const timbre        = detectTimbre(text);
    const categorie     = detectCategorie(text, fournisseur || '');
    const categoriesSec = detectCategoriesSecondaires(text, fournisseur || '');
    let totalTVA      = detectMontantTVA(text);
    const fodec         = detectFODEC(text);
    const retenueSource = detectRetenueSource(text);
    const modeReglement = detectModeReglement(text);
    const rsInfo        = detectRSPrestation(text, fournisseur || '');

    // Détection lignes + calcul TVA par ligne (taux mixtes)
    const lignes = detectLignes(text);
    if (lignes.length > 0) {
      const withTva = lignes.filter(l => l.tva !== undefined);
      if (withTva.length === lignes.length) {
        // Vérifier cohérence: total ≈ prix × (1 + tva/100) pour chaque ligne
        const sane = lignes.every(l => {
          if (l.tva === 0) return Math.abs(l.total - l.prix_unitaire) < 0.010;
          const expected = l.prix_unitaire * (1 + l.tva / 100);
          return Math.abs(l.total - expected) < 0.010;
        });
        if (sane) {
          const sumHT = lignes.reduce((s, l) => s + (l.prix_unitaire || 0), 0);
          const sumTotals = lignes.reduce((s, l) => s + (l.total || 0), 0);
          const sumTVA = sumTotals - sumHT;
          if (sumHT > 0) { totalHT = parseFloat(sumHT.toFixed(3)); }
          if (sumTVA > 0) { totalTVA = parseFloat(sumTVA.toFixed(3)); }
          const totalTTCFromLines = parseFloat((sumTotals + (timbre ?? 1.000)).toFixed(3));
          if (totalTTCFromLines > 0) { totalTTC = totalTTCFromLines; }
          // Taux TVA le plus fréquent
          const comptage = {};
          for (const l of lignes) { comptage[l.tva] = (comptage[l.tva] || 0) + 1; }
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

    // rs_base: HT prestation portion when RS applicable
    const rs_base = rsInfo.applicable ? (totalHT || 0) : 0;

    // Étape 3: calculs
    const montantHT_num  = totalHT || 0;
    const montantTTC_num = totalTTC || 0;
    const timbre_num     = timbre ?? 1.000;
    const fodec_num      = fodec || 0;
    // RS: utiliser le montant explicite de l'OCR, sinon calculer rs_base × taux
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
    const alertes = genererAlertes({
      ...coherenceData,
      date,
      fournisseur,
      matriculeFiscal: mf,
      mode_reglement: modeReglement,
      flag_incoherence: !verif.calculs_coherents,
      categorie,
    }, text);

    // Étape 6: champs à confirmer
    const champsAConfirmer = [];
    if (!fournisseur) champsAConfirmer.push('fournisseur_nom');
    if (!mf) champsAConfirmer.push('fournisseur_mf');
    if (!numero) champsAConfirmer.push('numero_justificatif');
    if (!date) champsAConfirmer.push('date_facture');
    if (!totalHT) champsAConfirmer.push('montant_ht');
    if (!totalTTC) champsAConfirmer.push('montant_ttc');

    // Confiance OCR
    const champsTrouves = [fournisseur, mf, numero, date, totalHT, totalTTC, totalTVA, timbre].filter(Boolean).length;
    const confiance = Math.min(100, Math.round((champsTrouves / 8) * 100));

    return {
      formulaire: {
        type: rsInfo.applicable ? 'achat_avec_prestation' : 'achat',
        fournisseur_nom: fournisseur || '',
        fournisseur_mf: mf || '',
        date_facture: date ? date.split('-').reverse().join('/') : '',
        numero_justificatif: numero || '',
        categorie_principale: categorie,
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
