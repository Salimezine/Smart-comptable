/**
 * tesseractOcr.js — OCR local pour factures tunisiennes
 *
 * Stack: Tesseract.js v5 (npm), pdf.js (CDN)
 * Conformité: TVA 7/13/19%, FODEC, Timbre LF2023, Retenue Source
 */
import Tesseract from 'tesseract.js';
import { parseFactureTunisienne, correctOCRText, normaliserMontant } from './utils/ocrParser.js';

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
// Fonction 1: scanFacture(file, onProgress)
// ──────────────────────────────────────────────────
async function preprocessImage(file) {
  const img = new Image();
  const url = URL.createObjectURL(file);
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { URL.revokeObjectURL(url); reject(new Error('Prétraitement: timeout 30s')); }, 30000);
      img.onload = () => { clearTimeout(timer); resolve(); };
      img.onerror = () => { clearTimeout(timer); URL.revokeObjectURL(url); reject(new Error('Image invalide')); };
      img.src = url;
    });
    URL.revokeObjectURL(url);
    const maxDim = 2000;
    let { width, height } = img;
    if (width > maxDim || height > maxDim) {
      if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
      else { width = Math.round(width * maxDim / height); height = maxDim; }
    }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
    const blob = await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Conversion PNG: timeout 15s')), 15000);
      canvas.toBlob(b => { clearTimeout(t); b ? resolve(b) : reject(new Error('toBlob null')); }, 'image/png');
    });
    return new File([blob], file.name, { type: 'image/png' });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function scanFacture(file, onProgress) {
  const isPdf = file?.type === 'application/pdf' || /\.pdf$/i.test(file?.name || '');
  if (isPdf) {
    return { error: 'PDF détecté — convertissez en image avant OCR.', champs_manquants: ['all'] };
  }

  try {
    onProgress?.(5, 'Prétraitement image...');
    file = await preprocessImage(file);
    onProgress?.(10, 'Initialisation OCR...');

    const basePath = window.location.pathname.startsWith('/Smart-comptable/')
      ? '/Smart-comptable/tesseract/'
      : '/tesseract/';

    const TIMEOUT_MS = 240000;
    let worker;

    onProgress?.(12, 'Téléchargement des fichiers OCR...');
    worker = await Tesseract.createWorker('fra', 1, {
      workerPath: basePath + 'worker.min.js',
      corePath: basePath + 'tesseract-core.wasm.js',
      langPath: 'https://tessdata.projectnaptha.com/4.0.0',
    }).catch(err => {
      throw new Error('Échec création worker OCR: ' + (err.message || err));
    });
    await worker.setParameters({ tessedit_pageseg_mode: '6' });

    onProgress?.(15, 'Reconnaissance en cours...');
    const result = await Promise.race([
      worker.recognize(file).catch(err => { throw new Error('Reconnaissance échouée: ' + (err.message || err)); }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout 4 min — image trop lourde')), TIMEOUT_MS))
    ]);

    onProgress?.(96, 'Fermeture OCR...');
    try {
      await Promise.race([worker.terminate(), new Promise(r => setTimeout(r, 5000))]);
    } catch (e) { /* ignore terminate errors */ }

    const text = result?.data?.text || '';
    const confidence = result?.data?.confidence || 0;

    onProgress?.(97, 'Analyse texte...');

    if (!text || text.trim().length < 10) {
      return { error: 'Image illisible — utilisez une image plus nette (min 150 DPI)', champs_manquants: ['all'], confidence: 0 };
    }

    onProgress?.(98, 'Parsing facture...');
    const parsed = parseFactureTunisienne(text);
    if (!parsed) {
      return { error: 'Échec du parsing OCR — texte illisible', champs_manquants: ['all'] };
    }
    parsed.confiance_ocr = Math.round(confidence);
    parsed.rawText = text;

    onProgress?.(100, 'Terminé ✓');
    return parsed;

  } catch (err) {
    return { error: err.message || 'OCR échoué', champs_manquants: ['all'] };
  }
}

// ──────────────────────────────────────────────────
// Exports
// ──────────────────────────────────────────────────
export default scanFacture;
export { CATEGORIES_SCE, FOURNISSEURS_TN };
