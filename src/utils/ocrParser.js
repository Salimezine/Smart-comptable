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
    t = t.replace(/[¡¢£¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿]/g, '');

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
      if (/^[A-ZÀ-Ü][a-zà-ü]/.test(line) && line.length > 4) {
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

    const clientSectionStart = (() => {
      const kw = ['FACTURÉ À', 'ADRESSÉ À', 'LIVRÉ À', 'CLIENT :', 'CLIENT:'];
      let min = text.length;
      for (const k of kw) {
        const idx = text.toUpperCase().indexOf(k);
        if (idx !== -1 && idx > 50 && idx < min) min = idx;
      }
      return min;
    })();

    const zone = text.substring(0, Math.min(clientSectionStart, text.length));

    const patterns = [
      /(?:M\.?F\.?\s*[:﹕|]\s*|Matricule\s*[Ff]iscal\s*[:﹕|]\s*)?(\d{6,7})\s*[/|\\]\s*([A-Za-z0-9])\s*[/|\\]\s*([A-Za-z])\s*[/|\\]\s*(\d{3})/,
      /(?:M\.?F\.?\s*[:﹕|]\s*|Matricule\s*[Ff]iscal\s*[:﹕|]\s*)?(\d{6,7})\s*[/|\\]\s*([A-Za-z]{1,3})(?:\s|$|[^/|\\])/,
      /\b(\d{6,7})\s*[/|\\]\s*([A-Za-z])(?:\s|[/|\\]|$|\.)/,
    ];

    const seen = new Set();
    for (const pat of patterns) {
      pat.lastIndex = 0;
      let m;
      while ((m = pat.exec(zone)) !== null) {
        const parts = m.slice(1).filter(Boolean);
        if (parts.length >= 2 && parts[1].length <= 3) {
          const val = (parts[0] + '/' + parts[1].toUpperCase()).trim();
          if (val.length >= 8 && !seen.has(val)) {
            seen.add(val);
            return val;
          }
        }
        if (parts.length === 1) {
          const val = parts[0].trim();
          if (val.length >= 8 && !seen.has(val)) {
            seen.add(val);
            return val;
          }
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

    const _sd = String.fromCharCode(45, 58, 47);
    const _sq = '[' + _sd + ']?';
    const patterns = [
      /(?:facture|fact\.?)\s*n[°o°]?\s*:?\s*(\w[\w\-\/]+)/i,
      /\bN[°o]\s*\|?\s*(\d{1,6})\b/i,
      /(?:N°|NO|NUMÉRO|NUMERO|REF|RÉF|REFERENCE)\s*(?:FACTURE|FACT)?\s*[:﹕]?\s*(\w[\w\-\/]{2,})/i,
      new RegExp('\\b(FAC|INV|FC|FV|FA|BL)\\s*' + _sq + '\\s*(\\d{2,6})\\s*' + _sq + '\\s*(\\d{2,6})', 'i'),
    ];

    for (const pat of patterns) {
      const m = text.match(pat);
      if (m) {
        const val = (m[2] && m[3]) ? `${m[1]}-${m[2]}-${m[3]}` : (m[1] || m[0]).trim();
        if (val && val.length >= 2 && val.toLowerCase() !== 'ture') return val;
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
// 7. detectTimbre — timbre fiscal (défaut 1.000)
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
// 8. generateInvoiceNumber — unique par année
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
