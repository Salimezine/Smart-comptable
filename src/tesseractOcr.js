/**
 * tesseractOcr.js — OCR local pour factures tunisiennes
 *
 * Stack: Tesseract.js v5 (npm), pdf.js (CDN)
 * Conformité: TVA 7/13/19%, FODEC, Timbre LF2023, Retenue Source
 */
import Tesseract from 'tesseract.js';
import * as pdfjs from 'pdfjs-dist';
import { parseFactureTunisienne, correctOCRText, normaliserMontant, FOURNISSEURS_LOOKUP } from './utils/ocrParser.js';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url
).toString();

// ──────────────────────────────────────────────────
// Catégories SCE (Plan Comptable Tunisien)
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
// Image preprocessing pipeline for OCR
// ──────────────────────────────────────────────────

/** Compute grayscale pixel array from canvas */
function getGrayData(ctx, w, h) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    gray[i] = 0.299 * imgData.data[idx] + 0.587 * imgData.data[idx + 1] + 0.114 * imgData.data[idx + 2];
  }
  return { gray, data: imgData.data };
}

/** Otsu threshold — finds optimal binarization threshold */
function otsuThreshold(gray) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) {
    const v = Math.round(gray[i]);
    hist[Math.min(Math.max(v, 0), 255)]++;
  }
  const total = gray.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, wF = 0;
  let maxVar = 0, best = 0;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) { maxVar = between; best = t; }
  }
  return best;
}

/** Detect image skew angle using horizontal projection variance */
function detectSkewAngle(ctx, w, h) {
  const { gray } = getGrayData(ctx, w, h);
  // Use a reduced resolution for speed
  const step = 4;
  const sw = Math.floor(w / step), sh = Math.floor(h / step);
  const small = new Float32Array(sw * sh);
  for (let y = 0; y < sh; y++)
    for (let x = 0; x < sw; x++)
      small[y * sw + x] = gray[(y * step) * w + (x * step)];

  // Find text rows by thresholding
  const thresh = otsuThreshold(small);
  const rowHasText = new Uint8Array(sh);
  for (let y = 0; y < sh; y++) {
    let count = 0;
    for (let x = 0; x < sw; x++) if (small[y * sw + x] < thresh) count++;
    rowHasText[y] = count > sw * 0.05 ? 1 : 0;
  }

  // Test angles -5 to +5 degrees
  let bestAngle = 0, bestVar = 0;
  for (let angle = -5; angle <= 5; angle += 0.5) {
    const rad = angle * Math.PI / 180;
    const variance = computeProjectionVariance(small, sw, sh, rad, thresh);
    if (variance > bestVar) { bestVar = variance; bestAngle = angle; }
  }
  return bestAngle;
}

function computeProjectionVariance(img, w, h, rad, thresh) {
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const cx = w / 2, cy = h / 2;
  const proj = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    let sum = 0, count = 0;
    for (let x = 0; x < w; x++) {
      const dx = x - cx, dy = y - cy;
      const rx = Math.round(dx * cos - dy * sin + cx);
      const ry = Math.round(dx * sin + dy * cos + cy);
      if (rx >= 0 && rx < w && ry >= 0 && ry < h && img[ry * w + rx] < thresh) { sum++; count++; }
    }
    proj[y] = count;
  }
  let mean = 0;
  for (let y = 0; y < h; y++) mean += proj[y];
  mean /= h;
  let variance = 0;
  for (let y = 0; y < h; y++) variance += (proj[y] - mean) * (proj[y] - mean);
  return variance / h;
}

/** Apply sharpening kernel to image data */
function sharpen(ctx, w, h, strength = 0.5) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const src = new Float32Array(imgData.data);
  const kernel = [0, -1, 0, -1, 4 + (1 / Math.max(strength, 0.01)), -1, 0, -1, 0];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let r = 0, g = 0, b = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * w + (x + kx)) * 4;
          const k = kernel[(ky + 1) * 3 + (kx + 1)];
          r += src[idx] * k;
          g += src[idx + 1] * k;
          b += src[idx + 2] * k;
        }
      }
      const idx = (y * w + x) * 4;
      imgData.data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      imgData.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      imgData.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

/** Remove salt-and-pepper noise (median filter 3x3) */
function denoise(ctx, w, h) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const src = new Uint8ClampedArray(imgData.data);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const neighbors = [];
      for (let ky = -1; ky <= 1; ky++)
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * w + (x + kx)) * 4;
          neighbors.push(src[idx], src[idx + 1], src[idx + 2]);
        }
      neighbors.sort((a, b) => a - b);
      const median = neighbors[Math.floor(neighbors.length / 2)];
      const idx = (y * w + x) * 4;
      imgData.data[idx] = median;
      imgData.data[idx + 1] = median;
      imgData.data[idx + 2] = median;
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

/** Stretch contrast to fill 0-255 range */
function stretchContrast(ctx, w, h) {
  const imgData = ctx.getImageData(0, 0, w, h);
  let min = 255, max = 0;
  for (let i = 0; i < imgData.data.length; i += 4) {
    const gray = 0.299 * imgData.data[i] + 0.587 * imgData.data[i + 1] + 0.114 * imgData.data[i + 2];
    if (gray < min) min = gray;
    if (gray > max) max = gray;
  }
  const range = max - min;
  if (range < 10) return;
  for (let i = 0; i < imgData.data.length; i += 4) {
    imgData.data[i] = Math.min(255, Math.max(0, Math.round((imgData.data[i] - min) / range * 255)));
    imgData.data[i + 1] = Math.min(255, Math.max(0, Math.round((imgData.data[i + 1] - min) / range * 255)));
    imgData.data[i + 2] = Math.min(255, Math.max(0, Math.round((imgData.data[i + 2] - min) / range * 255)));
  }
  ctx.putImageData(imgData, 0, 0);
}

/** Main image preprocessing pipeline */
async function preprocessImage(file) {
  const img = new Image();
  const url = URL.createObjectURL(file);
  let canvas, ctx;
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { URL.revokeObjectURL(url); reject(new Error('Prétraitement: timeout 30s')); }, 30000);
      img.onload = () => { clearTimeout(timer); resolve(); };
      img.onerror = () => { clearTimeout(timer); URL.revokeObjectURL(url); reject(new Error('Image invalide')); };
      img.src = url;
    });
    URL.revokeObjectURL(url);

    // Resize if too large
    const maxDim = 2400;
    let { width, height } = img;
    if (width > maxDim || height > maxDim) {
      if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
      else { width = Math.round(width * maxDim / height); height = maxDim; }
    }

    canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    ctx = canvas.getContext('2d');

    // Step 1: Draw original
    ctx.drawImage(img, 0, 0, width, height);

    // Step 2: Stretch contrast
    stretchContrast(ctx, width, height);

    // Step 3: Light denoising (skip if small image)
    if (width * height < 5000000) denoise(ctx, width, height);

    // Step 4: Sharpen
    sharpen(ctx, width, height, 0.4);

    // Step 5: Detect skew and rotate
    const angle = detectSkewAngle(ctx, width, height);
    if (Math.abs(angle) > 0.3) {
      const rad = angle * Math.PI / 180;
      const cos = Math.abs(Math.cos(rad));
      const sin = Math.abs(Math.sin(rad));
      const nw = Math.ceil(width * cos + height * sin);
      const nh = Math.ceil(width * sin + height * cos);
      const rotCanvas = document.createElement('canvas');
      rotCanvas.width = nw; rotCanvas.height = nh;
      const rotCtx = rotCanvas.getContext('2d');
      rotCtx.translate(nw / 2, nh / 2);
      rotCtx.rotate(rad);
      rotCtx.drawImage(canvas, -width / 2, -height / 2);
      canvas = rotCanvas;
      ctx = rotCtx;
      width = nw; height = nh;
    }

    const blob = await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Conversion PNG: timeout 15s')), 15000);
      canvas.toBlob(b => { clearTimeout(t); b ? resolve(b) : reject(new Error('toBlob null')); }, 'image/png');
    });
    return new File([blob], file.name, { type: 'image/png' });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function doOcr(input, onProgress, isPdfPage = false) {
  const basePath = window.location.pathname.startsWith('/Smart-comptable/')
    ? '/Smart-comptable/tesseract/'
    : '/tesseract/';

  const TIMEOUT_MS = 240000;
  let worker;

  onProgress?.(12, 'Téléchargement des fichiers OCR...');
  worker = await Tesseract.createWorker('fra', 1, {
    workerPath: basePath + 'worker.min.js',
    corePath: basePath,
  }).catch(err => {
    throw new Error('Échec création worker OCR: ' + (err.message || err));
  });
  await worker.setParameters({ tessedit_pageseg_mode: '6' });

  onProgress?.(15, 'Reconnaissance en cours...');
  const result = await Promise.race([
    worker.recognize(input).catch(err => { throw new Error('Reconnaissance échouée: ' + (err.message || err)); }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout 4 min — image trop lourde')), TIMEOUT_MS))
  ]);

  onProgress?.(96, 'Fermeture OCR...');
  try {
    await Promise.race([worker.terminate(), new Promise(r => setTimeout(r, 5000))]);
  } catch (e) { /* ignore terminate errors */ }

  const text = result?.data?.text || '';
  const confidence = result?.data?.confidence || 0;

  if (isPdfPage) return { text, confidence };

  onProgress?.(97, 'Analyse texte...');

  if (!text || text.trim().length < 10) {
    return { error: 'Image illisible — utilisez une image plus nette (min 150 DPI)', champs_manquants: ['all'], confidence: 0 };
  }

  onProgress?.(98, 'Parsing facture...');
  const parsed = parseFactureTunisienne(text, Math.round(confidence));
  if (!parsed || parsed.erreur) {
    return { error: parsed?.erreur === 'PDF_DETECTE' ? 'PDF détecté dans l\'OCR' : 'Échec du parsing OCR — texte illisible', champs_manquants: ['all'] };
  }
  // Apply Tesseract confidence to result (parseFactureTunisienne already got it via parameter)
  if (!parsed.confiance_ocr || parsed.confiance_ocr === 0) parsed.confiance_ocr = Math.round(confidence);
  parsed.rawText = text;
  parsed.faible_confiance = parsed.alerte === 'faible_confiance';

  onProgress?.(100, 'Terminé ✓');
  return parsed;
}

async function scanFacture(file, onProgress) {
  const isPdf = file?.type === 'application/pdf' || /\.pdf$/i.test(file?.name || '');
  if (isPdf) {
    onProgress?.(5, 'Conversion PDF en images...');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      let allText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        const dataUrl = canvas.toDataURL('image/png');
        onProgress?.(10 + Math.round((i / pdf.numPages) * 80), `OCR page ${i}/${pdf.numPages}...`);
        const ocrResult = await doOcr(dataUrl, () => {}, true);
        if (ocrResult?.text) allText += ocrResult.text + '\n';
      }
      if (!allText.trim()) return { error: 'Aucun texte détecté dans le PDF', champs_manquants: ['all'] };
      onProgress?.(98, 'Parsing facture...');
      const parsed = parseFactureTunisienne(allText);
      if (!parsed || parsed.erreur) return { error: 'Échec parsing PDF', champs_manquants: ['all'] };
      parsed.rawText = allText;
      onProgress?.(100, 'Terminé ✓');
      return parsed;
    } catch (err) {
      return { error: 'Échec lecture PDF: ' + (err.message || err), champs_manquants: ['all'] };
    }
  }

  try {
    onProgress?.(5, 'Prétraitement image...');
    file = await preprocessImage(file);

    onProgress?.(10, 'Initialisation OCR...');
    return await doOcr(file, onProgress, false);

  } catch (err) {
    return { error: err.message || 'OCR échoué', champs_manquants: ['all'] };
  }
}

// ──────────────────────────────────────────────────
// Exports
// ──────────────────────────────────────────────────
export default scanFacture;
export { CATEGORIES_SCE };
