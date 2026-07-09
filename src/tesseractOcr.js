import Tesseract from 'tesseract.js';
import * as pdfjs from 'pdfjs-dist';
import { parseFactureTunisienne, correctOCRText, normaliserMontant, FOURNISSEURS_LOOKUP } from './utils/ocrParser.js';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url
).toString();

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

let _worker = null;
let _workerBusy = false;
let _cancelRequested = false;

export function cancelScan() {
  _cancelRequested = true;
}

function checkCancel() {
  if (_cancelRequested) {
    _cancelRequested = false;
    _workerBusy = false;
    throw new Error('Scan annulé');
  }
}

function getBasePath() {
  return window.location.pathname.startsWith('/Smart-comptable/')
    ? '/Smart-comptable/tesseract/'
    : '/tesseract/';
}

async function getWorker(onProgress) {
  if (_worker && !_workerBusy) {
    _workerBusy = true;
    return _worker;
  }
  if (_worker) {
    try { await _worker.terminate(); } catch {}
    _worker = null;
  }
  onProgress?.(10, 'Chargement du module OCR...');
  const basePath = getBasePath();
  _worker = await Promise.race([
    Tesseract.createWorker('ara+fra', 1, {
      workerPath: basePath + 'worker.min.js',
      corePath: basePath,
      langPath: 'https://tessdata.projectnaptha.com/4.0.0',
      workerBlobURL: false,
      logger: (m) => {
        if (m.status === 'loading tesseract core') onProgress?.(12, 'OCR: chargement noyau...');
        else if (m.status === 'initializing tesseract') onProgress?.(14, 'OCR: initialisation...');
        else if (m.status === 'loading language traineddata') onProgress?.(16, 'OCR: téléchargement langues arabe+français...');
        else if (m.status === 'initializing api') onProgress?.(18, 'OCR: démarrage API...');
        else if (m.status === 'recognizing text') onProgress?.(20 + Math.round(m.progress * 70), `OCR: ${Math.round(m.progress * 100)}%`);
      },
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout 30s — vérifiez votre connexion internet')), 30000))
  ]).catch(err => {
    _workerBusy = false;
    throw new Error('Échec création worker OCR: ' + (err.message || err));
  });
  await _worker.setParameters({ tessedit_pageseg_mode: '3' });
  _workerBusy = true;
  return _worker;
}

function releaseWorker() {
  _workerBusy = false;
}

async function terminateWorker() {
  if (_worker) {
    try { await _worker.terminate(); } catch {}
    _worker = null;
    _workerBusy = false;
  }
}

function getGrayData(ctx, w, h) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    gray[i] = 0.299 * imgData.data[idx] + 0.587 * imgData.data[idx + 1] + 0.114 * imgData.data[idx + 2];
  }
  return { gray, data: imgData.data };
}

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

function detectSkewAngle(ctx, w, h) {
  const { gray } = getGrayData(ctx, w, h);
  const step = 4;
  const sw = Math.floor(w / step), sh = Math.floor(h / step);
  const small = new Float32Array(sw * sh);
  for (let y = 0; y < sh; y++)
    for (let x = 0; x < sw; x++)
      small[y * sw + x] = gray[(y * step) * w + (x * step)];

  const thresh = otsuThreshold(small);
  const rowHasText = new Uint8Array(sh);
  for (let y = 0; y < sh; y++) {
    let count = 0;
    for (let x = 0; x < sw; x++) if (small[y * sw + x] < thresh) count++;
    rowHasText[y] = count > sw * 0.05 ? 1 : 0;
  }

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

function removeShadows(ctx, w, h) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = Math.round(0.299 * imgData.data[i * 4] + 0.587 * imgData.data[i * 4 + 1] + 0.114 * imgData.data[i * 4 + 2]);
  }

  // Vérifier s'il y a des ombres: comparer min/max de blocs
  const blocks = 8;
  const bw = Math.floor(w / blocks), bh = Math.floor(h / blocks);
  let blockContrast = 0;
  for (let by = 0; by < blocks; by++) {
    for (let bx = 0; bx < blocks; bx++) {
      let minV = 255, maxV = 0;
      for (let y = by * bh; y < (by + 1) * bh && y < h; y++) {
        for (let x = bx * bw; x < (bx + 1) * bw && x < w; x++) {
          const v = gray[y * w + x];
          if (v < minV) minV = v;
          if (v > maxV) maxV = v;
        }
      }
      blockContrast += maxV - minV;
    }
  }
  blockContrast /= blocks * blocks;
  // Si le contraste local moyen est suffisant, pas d'ombres → skip
  if (blockContrast > 80) return;

  // Dilatation 5×5 légère
  const dilated = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let maxVal = 0;
      for (let ky = -2; ky <= 2; ky++) {
        for (let kx = -2; kx <= 2; kx++) {
          const px = Math.min(Math.max(x + kx, 0), w - 1);
          const py = Math.min(Math.max(y + ky, 0), h - 1);
          if (gray[py * w + px] > maxVal) maxVal = gray[py * w + px];
        }
      }
      dilated[y * w + x] = maxVal;
    }
  }

  // Filtre médian 11×11 (estimation fond)
  const bg = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const neighbors = [];
      for (let ky = -5; ky <= 5; ky++) {
        for (let kx = -5; kx <= 5; kx++) {
          const px = Math.min(Math.max(x + kx, 0), w - 1);
          const py = Math.min(Math.max(y + ky, 0), h - 1);
          neighbors.push(dilated[py * w + px]);
        }
      }
      neighbors.sort((a, b) => a - b);
      bg[y * w + x] = neighbors[Math.floor(neighbors.length / 2)];
    }
  }

  // Soustraire fond avec atténuation (ne pas sur-corriger)
  for (let i = 0; i < w * h; i++) {
    let diff = bg[i] - gray[i];
    // Ne corriger que si la différence > 15 (évite bruit)
    if (diff > 15) {
      let v = gray[i] + Math.round(diff * 0.7);
      v = Math.min(255, Math.max(0, v));
      imgData.data[i * 4] = v;
      imgData.data[i * 4 + 1] = v;
      imgData.data[i * 4 + 2] = v;
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

/** Binarisation adaptative supprimée — trop destructive pour les images Web compressées.
 *  Tesseract applique sa propre binarisation interne plus robuste.
 */

function localContrastEnhancement(ctx, w, h) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    gray[i] = 0.299 * imgData.data[idx] + 0.587 * imgData.data[idx + 1] + 0.114 * imgData.data[idx + 2];
  }

  const integral = new Float32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y + 1) * (w + 1) + (x + 1);
      integral[idx] = gray[y * w + x] + integral[idx - 1] + integral[(y) * (w + 1) + (x + 1)] - integral[(y) * (w + 1) + x];
    }
  }

  const globalMean = gray.reduce((s, v) => s + v, 0) / gray.length;
  const s = Math.max(12, Math.round(Math.min(w, h) / 12));
  const half = Math.floor(s / 2);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - half);
      const x2 = Math.min(w - 1, x + half);
      const y1 = Math.max(0, y - half);
      const y2 = Math.min(h - 1, y + half);
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum = integral[(y2 + 1) * (w + 1) + (x2 + 1)]
                - integral[(y1) * (w + 1) + (x2 + 1)]
                - integral[(y2 + 1) * (w + 1) + (x1)]
                + integral[(y1) * (w + 1) + (x1)];
      const localMean = sum / count;

      const idx = (y * w + x) * 4;
      const orig = gray[y * w + x];
      let corrected = orig + (globalMean - localMean);
      corrected = Math.min(255, Math.max(0, Math.round(corrected)));
      imgData.data[idx] = corrected;
      imgData.data[idx + 1] = corrected;
      imgData.data[idx + 2] = corrected;
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

function isCleanDocument(ctx, w, h) {
  const step = Math.max(4, Math.ceil(Math.min(w, h) / 60));
  let dark = 0, mid = 0, light = 0, total = 0;
  const data = ctx.getImageData(0, 0, w, h).data;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const idx = (y * w + x) * 4;
      const v = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      if (v < 60) dark++;
      else if (v > 200) light++;
      else mid++;
      total++;
    }
  }
  const darkRatio = dark / total;
  const lightRatio = light / total;
  const midRatio = mid / total;
  // Document propre: > 60% clair + > 1% foncé + < 20% tons moyens
  return lightRatio > 0.60 && darkRatio > 0.01 && midRatio < 0.20;
}

async function preprocessImage(file, onProgress) {
  // Les WebP WhatsApp (VP8X) ne sont pas décodables par le navigateur (img.width = undefined).
  // On tente d'abord le décodage navigateur. Si OK → preprocessing complet.
  // Si échec et c'est un WebP → fichier brut (Tesseract/Leptonica le décode).

  let img;
  let canvas, ctx;

  // ── Tentative décodage navigateur ──
  try {
    img = new Image();
    const url = URL.createObjectURL(file);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { URL.revokeObjectURL(url); reject(new Error('Prétraitement: timeout 30s')); }, 30000);
      img.onload = () => { clearTimeout(timer); resolve(); };
      img.onerror = () => { clearTimeout(timer); URL.revokeObjectURL(url); reject(new Error('Image invalide')); };
      img.src = url;
    });
    URL.revokeObjectURL(url);

    // Vérifier que le navigateur a décodé l'image
    if (!img.width || !img.height || img.width < 100 || img.height < 100) {
      throw new Error('Dimensions invalides: ' + img.width + '×' + img.height);
    }
  } catch (decodeErr) {
    // Échec décodage navigateur → si WebP, on laisse Tesseract gérer
    if (file?.type === 'image/webp' || /\.webp$/i.test(file?.name || '')) {
      return file;
    }
    throw decodeErr;
  }

  // ── Preprocessing (redimensionnement, contraste, débruitage, etc.) ──
  try {
    onProgress?.(4, 'Redimensionnement...');
    let width = img.width;
    let height = img.height;

    const maxDim = 2400;
    if (width > maxDim || height > maxDim) {
      if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
      else { width = Math.round(width * maxDim / height); height = maxDim; }
    }

    canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    ctx = canvas.getContext('2d', { willReadFrequently: true });

    ctx.drawImage(img, 0, 0, width, height);

    // Vérifier que le canvas contient bien des pixels
    const postDraw = ctx.getImageData(0, 0, Math.min(width, 20), Math.min(height, 20));
    const pixelCount = postDraw.data.length / 4;
    let nonEmptyPixels = 0;
    for (let i = 0; i < pixelCount; i++) {
      if (postDraw.data[i * 4] > 5 || postDraw.data[i * 4 + 1] > 5 || postDraw.data[i * 4 + 2] > 5) {
        nonEmptyPixels++;
      }
    }
    if (nonEmptyPixels < Math.min(10, Math.ceil(pixelCount * 0.1))) {
      throw new Error('Décodage image échoué — fichier corrompu ou format non supporté (actuellement: ' + (file.type || 'inconnu') + ')');
    }

    // Détection: image déjà propre (doc scanné, texte noir sur blanc) ?
    // Histogramme: si pics distincts clair + foncé → on saute les étapes agressives
    const isClean = isCleanDocument(ctx, width, height);

    if (!isClean) {
      onProgress?.(5, 'Suppression ombres & fond...');
      removeShadows(ctx, width, height);

      onProgress?.(6, 'Correction contraste local...');
      localContrastEnhancement(ctx, width, height);
    }

    onProgress?.(7, 'Étalonnage contraste global...');
    stretchContrast(ctx, width, height);

    if (!isClean) {
      onProgress?.(8, 'Débruitage & netteté...');
      if (width * height < 5000000) { denoise(ctx, width, height); }
    }
    sharpen(ctx, width, height, 0.3);

    onProgress?.(9, 'Détection inclinaison...');
    const angle = detectSkewAngle(ctx, width, height);
    if (Math.abs(angle) > 0.5) {
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

    // Vérifier que le canvas contient assez de contenu
    const contentCheck = ctx.getImageData(0, 0, width, height);
    if (contentCheck) {
      const step = Math.max(4, Math.ceil(Math.min(width, height) / 100));
      let filledPixels = 0, totalSampled = 0;
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const idx = (y * width + x) * 4;
          const r = contentCheck.data[idx], g = contentCheck.data[idx + 1], b = contentCheck.data[idx + 2], a = contentCheck.data[idx + 3];
          if ((r < 240 || g < 240 || b < 240) && a > 0) filledPixels++;
          totalSampled++;
        }
      }
      const density = filledPixels / Math.max(totalSampled, 1);
      if (density < 0.005 && width * height > 50000) {
        throw new Error('Image quasi-vide (densité ' + (density * 100).toFixed(1) + '%) — fichier corrompu ou fond uni sans contenu');
      }
    }

    // Vérification finale des dimensions
    if (width < 100 || height < 100) {
      throw new Error('Image trop petite après prétraitement (' + width + '×' + height + ')');
    }

    const blob = await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Conversion PNG: timeout 15s')), 15000);
      canvas.toBlob(b => { clearTimeout(t); b ? resolve(b) : reject(new Error('toBlob null')); }, 'image/png');
    });

    return new File([blob], file.name, { type: 'image/png' });
  } catch (err) {
    throw err;
  }
}

async function doOcr(input, onProgress, isPdfPage = false) {
  const TIMEOUT_MS = 240000;
  let worker;

  checkCancel();
  onProgress?.(12, 'Initialisation OCR...');
  worker = await getWorker(onProgress);

  checkCancel();
  onProgress?.(20, 'Reconnaissance en cours...');
  const result = await Promise.race([
    worker.recognize(input).catch(err => { throw new Error('Reconnaissance échouée: ' + (err.message || err)); }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout 4 min — image trop lourde')), TIMEOUT_MS))
  ]);

  let text = result?.data?.text || '';
  let confidence = result?.data?.confidence || 0;

  // Si le texte est très court ou suspect, on tente un fallback avec PSM 11 (Sparse text)
  if (!isPdfPage && (text.length < 150 || confidence < 60)) {
    try {
      onProgress?.(40, 'Optimisation de la segmentation (PSM 11)...');
      await worker.setParameters({ tessedit_pageseg_mode: '11' });
      const retryResult = await Promise.race([
        worker.recognize(input).catch(() => null),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout 4 min')), TIMEOUT_MS))
      ]);
      // Remettre PSM 3 par défaut pour les futurs scans
      await worker.setParameters({ tessedit_pageseg_mode: '3' });
      if (retryResult && (retryResult.data?.text?.length > text.length || retryResult.data?.confidence > confidence)) {
        text = retryResult.data.text || '';
        confidence = Math.max(confidence, retryResult.data.confidence || 0);
      }
    } catch (e) {
      // Ignorer l'échec du retry et conserver le résultat initial
      try { await worker.setParameters({ tessedit_pageseg_mode: '3' }); } catch {}
    }
  }

  if (!isPdfPage) releaseWorker();

  if (isPdfPage) return { text, confidence };

  onProgress?.(92, 'Analyse du texte...');

  if (!text || text.trim().length < 15) {
    return { error: 'Image illisible — utilisez une image plus nette (min 150 DPI)', champs_manquants: ['all'], confidence: 0 };
  }

  // Vérifier que le texte contient des mots réels (pas que du bruit OCR)
  const words = text.split(/\s+/).filter(w => w.length > 2);
  const alphaWords = words.filter(w => /[a-zA-ZÀ-ÿéèêëàâîôûùç]{3,}/i.test(w));
  const digitWords = words.filter(w => /\d/.test(w));
  const newlines = (text.match(/\n/g) || []).length;
  const letterRatio = (text.replace(/[^a-zA-ZÀ-ÿéèêëàâîôûùç]/g, '').length) / Math.max(text.length, 1);
  if (words.length < 2 || alphaWords.length < 1 || digitWords.length < 1) {
    return { error: 'Texte OCR de mauvaise qualité — prenez une photo plus nette de la facture', champs_manquants: ['all'], confidence: 0 };
  }
  // Bruit: trop peu de chiffres OU pas de structure (newlines) pour un texte long
  if (digitWords.length < 1 && text.length > 100) {
    return { error: 'Texte OCR sans chiffres — facture non reconnue', champs_manquants: ['all'], confidence: 0 };
  }
  if (text.length > 200 && newlines < 2) {
    return { error: 'Texte OCR sans structure (pas de sauts de ligne) — image invalide', champs_manquants: ['all'], confidence: 0 };
  }
  // Texte avec trop peu de lettres par rapport à la longueur = bruit
  if (text.length > 100 && letterRatio < 0.15) {
    return { error: 'Texte OCR de mauvaise qualité — trop de caractères spéciaux', champs_manquants: ['all'], confidence: 0 };
  }

  onProgress?.(95, 'Parsing facture tunisienne...');
  const parsed = parseFactureTunisienne(text, Math.round(confidence));
  if (!parsed || parsed.erreur) {
    return { error: parsed?.erreur === 'PDF_DETECTE' ? 'PDF détecté dans l\'OCR' : 'Échec du parsing OCR — texte illisible', champs_manquants: ['all'] };
  }
  // document_non_facture = classifieur dit "pas une facture" → ne pas laisser passer
  if (parsed.alerte === 'document_non_facture') {
    return { error: 'Document non reconnu comme facture — vérifiez l\'image ou utilisez la saisie manuelle', champs_manquants: ['all'] };
  }
  if (!parsed.confiance_ocr || parsed.confiance_ocr === 0) parsed.confiance_ocr = Math.round(confidence);
  parsed.rawText = text;
  parsed.faible_confiance = parsed.alerte === 'faible_confiance';

  onProgress?.(100, 'Terminé ✓');
  return parsed;
}

async function scanFacture(file, onProgress) {
  const isPdf = file?.type === 'application/pdf' || /\.pdf$/i.test(file?.name || '');
  if (isPdf) {
    onProgress?.(2, 'Extraction texte PDF...');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

      let allText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        let lastY = -1, pageText = '';
        for (const item of tc.items) {
          const y = Math.round(item.transform[5]);
          if (lastY >= 0 && y < lastY - 2) pageText += '\n';
          else if (lastY >= 0 && y === lastY) pageText += ' ';
          else if (lastY >= 0) pageText += '\n';
          pageText += item.str;
          lastY = y;
        }
        pageText = pageText.trim();
        if (pageText) allText += pageText + '\n';
      }
      allText = allText.trim();
      if (allText.length >= 10) {
        onProgress?.(95, 'Parsing facture...');
        const parsed = parseFactureTunisienne(allText);
        if (parsed && !parsed.erreur) {
          parsed.rawText = allText;
          onProgress?.(100, 'Terminé ✓');
          return parsed;
        }
        return { rawText: allText, formulaire: {}, champs_manquants: ['all'], alerte: 'non_parse', confiance_ocr: 0 };
      }

      onProgress?.(3, 'Conversion PDF en images...');
      allText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        const dataUrl = canvas.toDataURL('image/png');
        const progBase = 10 + Math.round((i - 1) / pdf.numPages * 80);
        onProgress?.(progBase, `OCR page ${i}/${pdf.numPages}...`);
        const ocrResult = await doOcr(dataUrl, () => {}, true);
        if (ocrResult?.text) allText += ocrResult.text + '\n';
      }
      if (!allText.trim()) return { error: 'Aucun texte détecté dans le PDF', champs_manquants: ['all'] };
      onProgress?.(95, 'Parsing facture...');
      const parsed = parseFactureTunisienne(allText);
      if (!parsed || parsed.erreur) return { error: 'Échec parsing PDF', champs_manquants: ['all'] };
      parsed.rawText = allText;
      onProgress?.(100, 'Terminé ✓');
      return parsed;
    } catch (err) {
      return { error: 'Échec lecture PDF: ' + (err.message || err), champs_manquants: ['all'] };
    }
  }

  let preprocessed = file;
  let usedFallback = false;
  try {
    checkCancel();
    onProgress?.(2, 'Prétraitement image...');
    preprocessed = await preprocessImage(file, onProgress);
  } catch (err) {
    if (_cancelRequested) {
      _cancelRequested = false;
      _workerBusy = false;
      return { error: 'Scan annulé', champs_manquants: ['all'], annule: true };
    }
    // Preprocessing échoué → on continue avec l'original
    preprocessed = file;
  }

  checkCancel();
  onProgress?.(10, 'Lancement OCR...');
  let result = await doOcr(preprocessed, onProgress, false).catch(() => null);

  // Si l'OCR a échoué (pas de texte), réessayer avec l'image originale
  if (!result || result.error || !result?.rawText || result.rawText.trim().length < 15) {
    if (preprocessed !== file) {
      usedFallback = true;
      onProgress?.(5, 'Fallback: OCR sur image originale...');
      result = await doOcr(file, onProgress, false).catch(() => null);
    }
    if (!result || result.error) {
      return { error: 'Image illisible — utilisez une image plus nette (min 150 DPI)', champs_manquants: ['all'], confidence: 0 };
    }
  }
  return result;
}

export default scanFacture;
export { CATEGORIES_SCE, terminateWorker };