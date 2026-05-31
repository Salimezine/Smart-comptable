import Tesseract from 'tesseract.js';

export const FOURNISSEURS_TN = {
  'ooredoo': 'Télécoms & Internet',
  'tunisie telecom': 'Télécoms & Internet',
  'tt': 'Télécoms & Internet',
  'orange': 'Télécoms & Internet',
  'topnet': 'Télécoms & Internet',
  'hexabyte': 'Télécoms & Internet',
  'globalnet': 'Télécoms & Internet',
  'steg': 'Énergie & Utilités',
  'sonede': 'Énergie & Utilités',
  'monoprix': 'Fournitures de Bureau',
  'geant': 'Fournitures de Bureau',
  'carrefour': 'Fournitures de Bureau',
  'sndp': 'Déplacements',
  'total': 'Déplacements',
  'star': 'Loyer & Charges',
  'gat': 'Loyer & Charges',
  'magasin general': 'Autres',
  'promogros': 'Autres',
};

export const CATEGORIES_SCE = {
  'Télécoms & Internet': '6248 - Télécommunications',
  'Énergie & Utilités': '6042 - Eau, électricité, gaz',
  'Fournitures de Bureau': '6024 - Fournitures de bureau',
  'Déplacements': '6241 - Carburants et lubrifiants',
  'Restauration': '624 - Services extérieurs',
  'Loyer & Charges': '6132 - Loyers',
  'Salaires & Charges Sociales': '621 - Personnel',
  'Autres': '624 - Services extérieurs',
};

const REGEX = {
  matriculeFiscal: /(\d{7})\s*[\/\\]\s*([A-HJ-NP-TV-Z])\s*[\/\\]\s*([AB])\s*[\/\\]\s*([MNPE])\s*[\/\\]\s*(\d{3})/i,
  invoiceNumber: [/N[°o]\s*[:\s]*(\d{4,})/i, /Facture\s*N[°o]?\s*[:\s]*(\d{4,})/i, /FAC\s*[:\s]*(\d{4,})/i, /INV\s*[:\s]*(\d{4,})/i, /FC\s*[:\s]*(\d{4,})/i, /FV\s*[:\s]*(\d{4,})/i, /FA\s*[:\s]*(\d{4,})/i, /BL\s*[:\s]*(\d{4,})/i, /(\d{4})[-\/](\d{3,6})/],
  montant: /(\d{1,3}(?:[\s.,]\d{3})*[\s.,]\d{3})\s*(?:DT|TND|د\.ت)/gi,
  tva: [/TVA\s*(?:à|au|de)?\s*(7|13|19)\s*%\s*:?\s*(\d{1,3}(?:[\s.,]\d{3})*[\s.,]\d{3})/gi, /T\.V\.A\s*:?\s*(\d{1,3}(?:[\s.,]\d{3})*[\s.,]\d{3})/gi],
  fodec: /FODEC\s*(?:\(1%\))?\s*:?\s*(\d{1,3}(?:[\s.,]\d{3})*[\s.,]\d{3})/gi,
  timbre: /[Tt]imbre\s*(?:fiscal)?\s*:?\s*(\d{1,3}(?:[\s.,]\d{3})*[\s.,]\d{3})/gi,
  ttc: [/(?:Total\s+TTC|Net\s+[àa]\s+payer|Montant\s+TTC|TOTAL\s+TTC)\s*:?\s*(\d{1,3}(?:[\s.,]\d{3})*[\s.,]\d{3})/gi, /(?:المبلغ الجملي|الإجمالي|المجموع)\s*:?\s*(\d{1,3}(?:[\s.,]\d{3})*[\s.,]\d{3})/gi],
  rs: /(?:Retenue|R\.?S\.?)\s*(?:à la source)?\s*(?:\d+\s*%)?\s*:?\s*(\d{1,3}(?:[\s.,]\d{3})*[\s.,]\d{3})/gi,
  ht: /(?:Montant\s+HT|Total\s+HT|Hors\s+[Tt]axe|H\.T)\s*:?\s*(\d{1,3}(?:[\s.,]\d{3})*[\s.,]\d{3})/gi,
  tvaRate: /TVA\s*(?:à|au|de)?\s*(7|13|19)\s*%/gi,
  date: [/(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})/, /(\d{4})[\/\-\.](\d{2})[\/\-\.](\d{2})/],
  dateText: /(\d{1,2})\s*(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s*(\d{4})/gi,
};

function toNumber(val) {
  if (val == null) return null;
  const str = String(val).replace(/[\s,]/g, '').replace(',', '.');
  const n = parseFloat(str);
  return isNaN(n) ? null : Math.round(n * 1000) / 1000;
}

function extractFirst(pattern, text) {
  const m = pattern.exec(text);
  return m ? m[1] || m[0] : null;
}

function extractAll(pattern, text) {
  const results = [];
  let m;
  while ((m = pattern.exec(text)) !== null) results.push(m[1] || m[0]);
  return results;
}

function findBestMatch(patterns, text) {
  for (const p of patterns) {
    const val = extractFirst(p, text);
    if (val) return val;
  }
  return null;
}

function extractFournisseur(text) {
  const lines = text.split('\n').slice(0, 15);
  const lowerLines = lines.map(l => l.toLowerCase().trim());
  for (let i = 0; i < lowerLines.length; i++) {
    for (const [key] of Object.entries(FOURNISSEURS_TN)) {
      if (lowerLines[i].includes(key)) {
        const originalLine = lines[i].trim();
        return originalLine.length > 40 ? key.charAt(0).toUpperCase() + key.slice(1) + ' Tunisie' : originalLine;
      }
    }
  }
  const clients = ['société', 'sarl', 'sa.', 'eurl', 'company', 'shop', 'store', 'boutique', 'service'];
  for (const line of lines) {
    const lower = line.toLowerCase().trim();
    if (lower.length > 3 && lower.length < 80 && clients.some(c => lower.includes(c))) return line.trim();
  }
  return null;
}

function extractDate(text) {
  const textMatch = REGEX.dateText.exec(text);
  if (textMatch) {
    const months = { janvier:'01', février:'02', mars:'03', avril:'04', mai:'05', juin:'06', juillet:'07', août:'08', septembre:'09', octobre:'10', novembre:'11', décembre:'12' };
    const day = textMatch[1].padStart(2, '0');
    const month = months[textMatch[2].toLowerCase()] || '01';
    return `${textMatch[3]}-${month}-${day}`;
  }
  const numMatch = REGEX.date[0].exec(text);
  if (numMatch) return `${numMatch[3]}-${numMatch[2].padStart(2, '0')}-${numMatch[1].padStart(2, '0')}`;
  const isoMatch = REGEX.date[1].exec(text);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  return null;
}

function extractTvaRate(text) {
  const m = REGEX.tvaRate.exec(text);
  if (m) return parseInt(m[1]);
  const allTvaMatches = [];
  let t;
  while ((t = REGEX.tva[0].exec(text)) !== null) allTvaMatches.push(parseInt(t[1]));
  return allTvaMatches.length > 0 ? allTvaMatches[0] : 19;
}

export function parseFactureTunisienne(text) {
  const fournisseur = extractFournisseur(text);
  const matriculeFiscal = extractFirst(REGEX.matriculeFiscal, text);
  const date = extractDate(text);
  const numeroFacture = findBestMatch(REGEX.invoiceNumber, text);

  const htMatch = extractFirst(REGEX.ht, text);
  const montant_ht = toNumber(htMatch);

  const fodecMatches = extractAll(REGEX.fodec, text);
  const fodec = fodecMatches.length > 0 ? toNumber(fodecMatches[0]) : 0;

  const taux_tva = extractTvaRate(text);

  const tvaMatches = extractAll(REGEX.tva[0], text);
  const tvaAltMatches = extractAll(REGEX.tva[1], text);
  const allTvaAmts = [...tvaMatches.map(m => {
    const parts = REGEX.tva[0].exec(m);
    return parts ? parts[2] : null;
  }).filter(Boolean), ...tvaAltMatches];
  const montant_tva = allTvaAmts.length > 0 ? toNumber(allTvaAmts[0]) : null;

  const timbreMatch = extractFirst(REGEX.timbre, text);
  const timbre_fiscal = toNumber(timbreMatch) || 0;

  const rsMatches = extractAll(REGEX.rs, text);
  const retenue_source = rsMatches.length > 0 ? toNumber(rsMatches[0]) : 0;

  const ttcMatch = findBestMatch(REGEX.ttc, text);
  const montant_ttc = toNumber(ttcMatch);

  const net_a_payer = montant_ttc != null ? montant_ttc - retenue_source : null;

  const searchText = fournisseur ? fournisseur.toLowerCase() : '';
  let categorie_sce = 'Autres';
  let code_comptable = '624 - Services extérieurs';
  for (const [key, cat] of Object.entries(FOURNISSEURS_TN)) {
    if (searchText.includes(key)) {
      categorie_sce = cat;
      code_comptable = CATEGORIES_SCE[cat] || code_comptable;
      break;
    }
  }

  const champs_manquants = [];
  if (!fournisseur) champs_manquants.push('fournisseur');
  if (!date) champs_manquants.push('date');
  if (!montant_ht) champs_manquants.push('montant_ht');
  if (!montant_ttc) champs_manquants.push('montant_ttc');
  if (!montant_tva) champs_manquants.push('montant_tva');

  const base_tva = montant_ht != null ? montant_ht + fodec : null;

  const result = {
    fournisseur,
    matricule_fiscal: matriculeFiscal || null,
    date,
    numero_facture: numeroFacture || null,
    montant_ht,
    fodec,
    base_tva,
    taux_tva,
    montant_tva,
    timbre_fiscal: timbre_fiscal || (montant_ttc != null && montant_ttc > 1000 ? 1 : 0),
    retenue_source,
    montant_ttc,
    net_a_payer,
    categorie_sce,
    code_comptable,
    devise: 'DT',
    flag_incoherence: false,
    champs_manquants,
  };

  return validerCalculs(result);
}

export function validerCalculs(data) {
  const TOLERANCE = 0.005;
  let flag = false;

  const base_tva_calculee = data.montant_ht != null ? data.montant_ht + (data.fodec || 0) : null;
  const tva_calculee = base_tva_calculee != null && data.taux_tva != null
    ? Math.round(base_tva_calculee * (data.taux_tva / 100) * 1000) / 1000
    : null;
  const ttc_calcule = base_tva_calculee != null && tva_calculee != null
    ? Math.round((base_tva_calculee + tva_calculee + (data.timbre_fiscal || 0)) * 1000) / 1000
    : null;
  const net_calcule = ttc_calcule != null
    ? Math.round((ttc_calcule - (data.retenue_source || 0)) * 1000) / 1000
    : null;

  if (data.montant_tva != null && tva_calculee != null) {
    if (Math.abs(tva_calculee - data.montant_tva) > TOLERANCE) flag = true;
  }
  if (data.montant_ttc != null && ttc_calcule != null) {
    if (Math.abs(ttc_calcule - data.montant_ttc) > TOLERANCE) flag = true;
  }

  return {
    ...data,
    base_tva: base_tva_calculee != null ? base_tva_calculee : data.base_tva,
    montant_tva: data.montant_tva ?? tva_calculee,
    timbre_fiscal: data.timbre_fiscal || (ttc_calcule != null && ttc_calcule > 1000 ? 1 : 0),
    montant_ttc: data.montant_ttc ?? ttc_calcule,
    net_a_payer: data.net_a_payer ?? net_calcule,
    flag_incoherence: flag,
    _detail: { base_tva_calculee, tva_calculee, ttc_calcule, net_calcule },
  };
}

export async function scanAvecTesseract(file, onProgress) {
  if (file.type === 'application/pdf') {
    throw new Error('Format PDF détecté. Veuillez d\'abord convertir la page en image (JPG/PNG).');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Fichier trop volumineux. Maximum 10 Mo.');
  }

  const { data } = await Tesseract.recognize(file, 'fra+ara', {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        onProgress?.(Math.round(m.progress * 100));
      }
    },
  });

  return data.text;
}

export const RECEIPT_SAMPLES = [
  {
    name: 'Ooredoo Tunisie — Facture Télécom',
    filename: 'ooredoo_facture.jpg',
    data: {
      fournisseur: 'Ooredoo Tunisie',
      matricule_fiscal: '1234567/X/A/M/001',
      date: '2026-05-15',
      numero_facture: 'FAC-2026-04521',
      montant_ht: 132.800,
      fodec: 0,
      base_tva: 132.800,
      taux_tva: 19,
      montant_tva: 25.232,
      timbre_fiscal: 1.000,
      retenue_source: 0,
      montant_ttc: 159.032,
      net_a_payer: 159.032,
      categorie_sce: 'Télécoms & Internet',
      code_comptable: '6248 - Télécommunications',
      devise: 'DT',
      flag_incoherence: false,
      champs_manquants: [],
    },
  },
  {
    name: 'STEG — Facture Électricité',
    filename: 'steg_facture.jpg',
    data: {
      fournisseur: 'STEG',
      matricule_fiscal: '0987654/B/B/M/001',
      date: '2026-04-28',
      numero_facture: 'FACT-2026-00312',
      montant_ht: 85.500,
      fodec: 0,
      base_tva: 85.500,
      taux_tva: 13,
      montant_tva: 11.115,
      timbre_fiscal: 1.000,
      retenue_source: 0,
      montant_ttc: 97.615,
      net_a_payer: 97.615,
      categorie_sce: 'Énergie & Utilités',
      code_comptable: '6042 - Eau, électricité, gaz',
      devise: 'DT',
      flag_incoherence: false,
      champs_manquants: [],
    },
  },
  {
    name: 'Facture Industrielle (FODEC 1% + TVA 19%)',
    filename: 'industrielle_facture.jpg',
    data: {
      fournisseur: 'Société Tunisienne de Fournitures S.A.',
      matricule_fiscal: '1122334/C/A/M/002',
      date: '2026-06-01',
      numero_facture: 'FAC-2026-0512',
      montant_ht: 1000.000,
      fodec: 10.000,
      base_tva: 1010.000,
      taux_tva: 19,
      montant_tva: 191.900,
      timbre_fiscal: 1.000,
      retenue_source: 0,
      montant_ttc: 1202.900,
      net_a_payer: 1202.900,
      categorie_sce: 'Autres',
      code_comptable: '624 - Services extérieurs',
      devise: 'DT',
      flag_incoherence: false,
      champs_manquants: [],
    },
  },
  {
    name: 'Facture avec Retenue à la Source (RS 5%)',
    filename: 'facture_avec_rs.jpg',
    data: {
      fournisseur: 'Consulting & Co SARL',
      matricule_fiscal: '5566778/D/A/M/001',
      date: '2026-05-20',
      numero_facture: 'INV-2026-0089',
      montant_ht: 420.168,
      fodec: 0,
      base_tva: 420.168,
      taux_tva: 19,
      montant_tva: 79.832,
      timbre_fiscal: 0,
      retenue_source: 25.000,
      montant_ttc: 500.000,
      net_a_payer: 475.000,
      categorie_sce: 'Autres',
      code_comptable: '624 - Services extérieurs',
      devise: 'DT',
      flag_incoherence: false,
      champs_manquants: [],
    },
  },
  {
    name: 'Monoprix — Fournitures Bureau',
    filename: 'monoprix_facture.jpg',
    data: {
      fournisseur: 'Monoprix Tunisie',
      matricule_fiscal: '3344556/E/B/M/001',
      date: '2026-05-10',
      numero_facture: 'TKT-2026-7812',
      montant_ht: 45.200,
      fodec: 0,
      base_tva: 45.200,
      taux_tva: 19,
      montant_tva: 8.588,
      timbre_fiscal: 1.000,
      retenue_source: 0,
      montant_ttc: 54.788,
      net_a_payer: 54.788,
      categorie_sce: 'Fournitures de Bureau',
      code_comptable: '6024 - Fournitures de bureau',
      devise: 'DT',
      flag_incoherence: false,
      champs_manquants: [],
    },
  },
];
