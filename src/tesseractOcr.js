const FOURNISSEURS_TN = {
  ooredoo: 'Télécoms & Internet',
  'tunisie telecom': 'Télécoms & Internet',
  tt: 'Télécoms & Internet',
  orange: 'Télécoms & Internet',
  topnet: 'Télécoms & Internet',
  hexabyte: 'Télécoms & Internet',
  steg: 'Énergie & Utilités',
  sonede: 'Énergie & Utilités',
  monoprix: 'Fournitures de Bureau',
  geant: 'Fournitures de Bureau',
  carrefour: 'Fournitures de Bureau',
  sndp: 'Déplacements',
  total: 'Déplacements',
  star: 'Loyer & Charges',
  gat: 'Loyer & Charges',
};

function toNumber(s) {
  if (s == null) return null;
  const n = parseFloat(String(s).replace(/[\s,]/g, '').replace(',', '.'));
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

function extractFirst(regex, text) {
  const m = regex.exec(text);
  return m ? (m[1] || m[0]).trim() : null;
}

function detectFournisseur(text) {
  const lines = text.split('\n').slice(0, 15).map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const lower = line.toLowerCase();
    for (const key of Object.keys(FOURNISSEURS_TN)) {
      if (lower.includes(key)) return line.length > 50 ? key.charAt(0).toUpperCase() + key.slice(1) : line;
    }
  }
  for (const kw of ['société', 'sarl', 'sa.', 'eurl', 'company', 'shop', 'store', 'bureau', 'service']) {
    const found = lines.find(l => l.toLowerCase().includes(kw) && l.length < 80);
    if (found) return found;
  }
  return null;
}

function detectDate(text) {
  const dmy = /(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})/.exec(text);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
  const iso = /(\d{4})[\/\-\.](\d{2})[\/\-\.](\d{2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2].padStart(2,'0')}-${iso[3].padStart(2,'0')}`;
  const txt = /(\d{1,2})\s*(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s*(\d{4})/i.exec(text);
  if (txt) {
    const months = { janvier:'01', février:'02', mars:'03', avril:'04', mai:'05', juin:'06', juillet:'07', août:'08', septembre:'09', octobre:'10', novembre:'11', décembre:'12' };
    return `${txt[3]}-${months[txt[2].toLowerCase()]}-${txt[1].padStart(2,'0')}`;
  }
  return null;
}

function detectInvoiceNumber(text) {
  const patterns = [/N[°o]\s*[:\s]*([A-Z0-9\-/]{4,})/i, /Facture\s*N[°o]?\s*[:\s]*([A-Z0-9\-/]{4,})/i, /FAC\s*[:\s]*([A-Z0-9\-/]{4,})/i, /INV\s*[:\s]*([A-Z0-9\-/]{4,})/i, /(\d{4})[-\/](\d{3,6})/];
  for (const p of patterns) {
    const m = p.exec(text);
    if (m) return m[1] || m[0];
  }
  return null;
}

function detectMontant(regex, text) {
  const m = regex.exec(text);
  if (!m) return null;
  const val = m[1] || m[0];
  return toNumber(val);
}

export function parseFactureText(text) {
  const fournisseur = detectFournisseur(text);
  const date = detectDate(text);
  const numero_facture = detectInvoiceNumber(text);

  const montant_ttc = detectMontant(/(?:Total\s+TTC|Net\s+[àa]\s+payer|Montant\s+TTC|TOTAL\s+TTC|TOTAL)\s*:?\s*(\d{1,3}(?:[\s.,]\d{3})*[\s.,]\d{3})/gi, text);
  const montant_ht = detectMontant(/(?:Montant\s+HT|Total\s+HT|Hors\s+[Tt]axe|H\.T)\s*:?\s*(\d{1,3}(?:[\s.,]\d{3})*[\s.,]\d{3})/gi, text);
  const tva = detectMontant(/(?:TVA|T\.V\.A)\s*(?:à|au|de)?\s*(?:\d{1,2}\s*%)?\s*:?\s*(\d{1,3}(?:[\s.,]\d{3})*[\s.,]\d{3})/gi, text);
  const tvaRate = /TVA\s*(?:à|au|de)?\s*(7|13|19)\s*%/i.exec(text);

  const searchText = fournisseur ? fournisseur.toLowerCase() : '';
  let categorie_sce = 'Autres';
  for (const [key, cat] of Object.entries(FOURNISSEURS_TN)) {
    if (searchText.includes(key)) { categorie_sce = cat; break; }
  }

  return {
    fournisseur,
    date,
    numero_facture: numero_facture || '',
    montant_ht,
    tva,
    montant_ttc,
    taux_tva: tvaRate ? parseInt(tvaRate[1]) : null,
    categorie_sce,
    devise: 'DT',
    champs_manquants: [
      ...(!fournisseur ? ['fournisseur'] : []),
      ...(!date ? ['date'] : []),
      ...(montant_ht == null ? ['montant_ht'] : []),
      ...(tva == null ? ['tva'] : []),
      ...(montant_ttc == null ? ['montant_ttc'] : []),
    ],
  };
}

export async function scanFacture(file, onProgress) {
  if (file.type === 'application/pdf') throw new Error('Les fichiers PDF ne sont pas supportés directement. Convertissez d\'abord en image (JPG/PNG).');
  if (file.size > 10 * 1024 * 1024) throw new Error('Fichier trop volumineux (max 10 Mo).');

  if (typeof Tesseract === 'undefined') throw new Error('Tesseract.js n\'est pas chargé. Vérifiez votre connexion Internet.');

  const { data } = await Tesseract.recognize(file, 'fra+ara', {
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress?.(Math.round(m.progress * 100));
    },
  });

  return parseFactureText(data.text);
}

export const EXEMPLES_TEST = [
  {
    name: 'Ooredoo — Facture Télécom (159 DT)',
    data: { fournisseur: 'Ooredoo Tunisie', date: '2026-05-15', numero_facture: 'FAC-2026-04521', montant_ht: 132.80, tva: 25.23, montant_ttc: 159.03, taux_tva: 19, categorie_sce: 'Télécoms & Internet', devise: 'DT', champs_manquants: [] },
  },
  {
    name: 'STEG — Facture Électricité (97 DT)',
    data: { fournisseur: 'STEG', date: '2026-04-28', numero_facture: 'FACT-2026-00312', montant_ht: 85.50, tva: 11.12, montant_ttc: 97.62, taux_tva: 13, categorie_sce: 'Énergie & Utilités', devise: 'DT', champs_manquants: [] },
  },
  {
    name: 'Monoprix — Fournitures Bureau (54 DT)',
    data: { fournisseur: 'Monoprix Tunisie', date: '2026-05-10', numero_facture: 'TKT-2026-7812', montant_ht: 45.20, tva: 8.59, montant_ttc: 54.79, taux_tva: 19, categorie_sce: 'Fournitures de Bureau', devise: 'DT', champs_manquants: [] },
  },
  {
    name: 'Facture Industrielle avec FODEC (1 202 DT)',
    data: { fournisseur: 'Société Tunisienne de Fournitures S.A.', date: '2026-06-01', numero_facture: 'FAC-2026-0512', montant_ht: 1000.00, tva: 191.90, montant_ttc: 1202.90, taux_tva: 19, categorie_sce: 'Autres', devise: 'DT', champs_manquants: [] },
  },
  {
    name: 'Consulting — Facture avec RS (500 DT)',
    data: { fournisseur: 'Consulting & Co SARL', date: '2026-05-20', numero_facture: 'INV-2026-0089', montant_ht: 420.17, tva: 79.83, montant_ttc: 500.00, taux_tva: 19, categorie_sce: 'Autres', devise: 'DT', champs_manquants: [] },
  },
];
