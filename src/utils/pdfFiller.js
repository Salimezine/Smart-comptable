import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';


const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : (typeof __vite__base !== 'undefined' ? __vite__base : '/');
function pdfUrl(name) { return `${BASE}pdfs/${name}`; }
function pdfUrlAlt(name) { return `./pdfs/${name}`; }

const FORMULAIRES_MAP = {
  mensuelle: { labelFR: 'Déclaration mensuelle 2026', labelAR: 'التصريح الشهري بالأداءات 2026', url: pdfUrl('mensuelle.pdf') },
  is: { labelFR: 'Déclaration annuelle IS 2026', labelAR: 'التصريح السنوي بالضريبة على الشركات 2026', url: pdfUrl('is.pdf') },
  irpp: { labelFR: 'Déclaration annuelle IRPP 2025', labelAR: 'التصريح السنوي بالضريبة على الدخل 2025', url: pdfUrl('irpp.pdf') },
  employeur: { labelFR: 'Déclaration employeur 2025', labelAR: 'تصريح المؤجر 2025', url: pdfUrl('employeur.pdf') },
  plusvalue: { labelFR: 'Plus-value cession actions 2025', labelAR: 'التصريح بالقيمة الزائدة 2025', url: pdfUrl('plusvalue.pdf') },
  fortune: { labelFR: 'Impôt sur la fortune 2026', labelAR: 'الضريبة على الثروة 2026', url: pdfUrl('fortune.pdf') },
};

const SECTIONS_MAP = {
  mensuelle: [
    { id: 'identification', labelFR: 'Identification', labelAR: 'التعريف' },
    { id: 'retenues_source', labelFR: 'Retenue à la source (31 lignes)', labelAR: 'الخصم من المنبع (31 خط)' },
    { id: 'tfp', labelFR: 'TFP — Taxe formation professionnelle', labelAR: 'معلوم التكوين المهني' },
    { id: 'foprolos', labelFR: 'FOPROLOS (1%)', labelAR: 'فوبرولوص' },
    { id: 'tva', labelFR: 'TVA — Taxe sur la valeur ajoutée', labelAR: 'الأداء على القيمة المضافة' },
    { id: 'autres_taxes', labelFR: 'Autres taxes (19 postes)', labelAR: 'المعاليم الأخرى (19)' },
    { id: 'timbre', labelFR: 'Timbre fiscal', labelAR: 'معلوم الطابع' },
    { id: 'taxe_hoteliere', labelFR: 'Taxe hôtelière', labelAR: 'معلوم النزل' },
    { id: 'tcl', labelFR: 'TCL — Taxes collectivités locales', labelAR: 'معاليم الجماعات المحلية' },
    { id: 'licence', labelFR: 'Taxe licence débits boissons', labelAR: 'معلوم الإجازة' },
  ],
  is: [
    { id: 'identification', labelFR: 'Identification', labelAR: 'التعريف' },
    { id: 'donnees_taxation', labelFR: 'I — Données de taxation', labelAR: 'I — معطيات التضريب' },
    { id: 'benefices_deduits', labelFR: 'II — Bénéfices déduits', labelAR: 'II — الأرباح المخصومة' },
    { id: 'exonerations', labelFR: 'III — Sociétés exonérées', labelAR: 'III — الشركات المعفاة' },
    { id: 'non_imposable', labelFR: 'IV — Produits non imposables', labelAR: 'IV — المداخيل غير الخاضعة' },
    { id: 'calcul_is', labelFR: 'V — Calcul IS', labelAR: 'V — حساب الضريبة' },
    { id: 'acomptes', labelFR: 'VI — Acomptes provisionnels', labelAR: 'VI — الدفعات' },
    { id: 'liquidation', labelFR: 'VII — Liquidation finale', labelAR: 'VII — التسوية النهائية' },
    { id: 'contributions', labelFR: 'VIII-IX — Contributions sociales + taxe visite', labelAR: 'VIII-IX — المساهمات الاجتماعية' },
    { id: 'recap_bancaire', labelFR: 'XII — Récapitulatif + comptes bancaires', labelAR: 'XII — الملخص والحسابات البنكية' },
  ],
  irpp: [
    { id: 'identification', labelFR: 'Identification', labelAR: 'التعريف' },
    { id: 'situation_familiale', labelFR: 'Situation familiale', labelAR: 'الوضعية العائلية' },
    { id: 'revenus', labelFR: 'Catégories de revenus', labelAR: 'أصناف المداخيل' },
  ],
  employeur: [
    { id: 'identification', labelFR: 'Identification', labelAR: 'التعريف' },
    { id: 'salaires', labelFR: 'Salaires déclarés', labelAR: 'الأجور المصرح بها' },
    { id: 'effectifs', labelFR: 'Effectifs', labelAR: 'الأعوان' },
  ],
  plusvalue: [
    { id: 'identification', labelFR: 'Identification', labelAR: 'التعريف' },
    { id: 'cessions', labelFR: 'Cessions réalisées', labelAR: 'التفويتات' },
  ],
  fortune: [
    { id: 'identification', labelFR: 'Identification', labelAR: 'التعريف' },
    { id: 'patrimoine', labelFR: 'Patrimoine imposable', labelAR: 'الثروة الخاضعة' },
  ],
};

// Field positions on the official PDF form (mensuelle = 12 pages, A4)
// Coordinates: x=0 left, y=0 bottom (pdf-lib coordinate system)
// Values drawn in the "مبلغ الخصم (د)" column (x ≈ 36–77)
// Bounding boxes measured from official mensuelle.pdf (page height = 842 pts)
// pdf-lib uses bottom-left origin (y=0 at bottom); PyMuPDF uses top-left origin
// Conversion: pdf-lib y = pageHeight - PyMuPDF_bottom + baseline_offset
const POS = {
  mensuelle: {
    // Page 0 client info: PyMuPDF boxes at y≈151-168 (MF cells), 173-185 (nom),
    // 186-198 (adresse), 199-211 (postal code), 216-228 (activite), 233-244 (annee/mois)
    client: [
      // MF: drawRaw centers in cell 1 (x=83), then one char per cell from cell 2 onward
      { key: 'matriculeFiscal', page: 0,  y: 682, size: 9,
        cells: [61, 80, 99, 118, 138, 157, 176, 196, 218, 240, 260, 282, 303] },
      { key: 'nom',            page: 0, x: 50,  y: 660, size: 11 },
      { key: 'adresse',        page: 0, x: 50,  y: 647, size: 10 },
      { key: 'codePostal',     page: 0, x: 35,  y: 634, size: 10 },   // postal y=198-211
      { key: 'secteur',        page: 0, x: 294, y: 617, size: 10 },
      { key: 'mois',           page: 0, x: 50,  y: 601, size: 10 },   // month y=233-244
      { key: 'annee',          page: 0, x: 150, y: 601, size: 10 },   // year y=233-244
    ],
    // "مبلغ الخصم (د)" column — PyMuPDF input boxes at x=36-66, right-aligned
    // "أساس الخصم (د)" column — fillable at x=236-305, values right-aligned at x=300
    retenues_source: {
      x: 87, base_x: 300, size: 8,
      lines: {
        // Lines 1-4b on page 0 (verified OK by PyMuPDF analysis)
        '1':  { page: 0, y: 436 },
        '2':  { page: 0, y: 409 },
        '3':  { page: 0, y: 381 },
        '4':  { page: 0, y: 328 },
        '4b': { page: 0, y: 313 },
        // Lines 5-9 moved to page 0 (official form has text labels on page 0)
        '5':  { page: 0, y: 282 },
        '6':  { page: 0, y: 267 },
        '7':  { page: 0, y: 251 },
        '8':  { page: 0, y: 223 },
        '9':  { page: 0, y: 196 },
        // Lines 10-20 on page 1
        '10': { page: 1, y: 593 },
        '11': { page: 1, y: 569 },
        '12': { page: 1, y: 549 },
        '13': { page: 1, y: 526 },
        '14': { page: 1, y: 509 },
        '15': { page: 1, y: 493 },
        '16': { page: 1, y: 475 },
        '17': { page: 1, y: 458 },
        '18': { page: 1, y: 442 },
        '19': { page: 1, y: 418 },
        '20': { page: 1, y: 388 },
        // Lines 21-30 on page 2
        '21': { page: 2, y: 658 },
        '22': { page: 2, y: 580 },
        '23': { page: 2, y: 579 },
        '24': { page: 2, y: 554 },
        '25': { page: 2, y: 515 },
        '26': { page: 2, y: 470 },
        '27': { page: 2, y: 401 },
        '28': { page: 2, y: 401 },
        '29': { page: 2, y: 381 },
        '30': { page: 2, y: 342 },
        // Line 31 on page 3
        '31': { page: 3, y: 483 },
      },
    },
    // Payment summary table on page 8 (خالصة الأداءات)
    // Columns: I=مبلغ أصل الأداء, II=الأداء المدفوع, III=الأداء المستوجب, IV=خطايا التأخير, V=المجموع
    payment_summary: {
      page: 8,
      size: 8,
      cols: { i: 370, ii: 296, iii: 221, iv: 149, v: 83 },
      rows: {
        rs:             { y: 322, label: 'الخصم من المورد' },
        tfp:            { y: 306, label: 'التكوين المهني' },
        foprolos:       { y: 283, label: 'صندوق النهوض بالمساكن' },
        tva:            { y: 243, label: 'الأداء على القيمة المضافة' },
        autres_taxes:   { y: 226, label: 'معاليم أخرى' },
        timbre:         { y: 210, label: 'الطابع الجبائي' },
        taxe_hoteliere: { y: 176, label: 'المعلوم على النزل' },
        licence:        { y: 128, label: 'معلوم الإجازة' },
        total:          { y: 111, label: 'المجموع' },
      },
    },
    // TVA table on page 4 (الأداء sur la valeur ajoutée)
    tva_table: {
      page: 4,
      size: 8,
      cols: { ca: 328, tva_due: 198, tva_deductible: 173 },
      rows: {
        rate_7:  { y: 575, rate: '7%' },
        rate_13: { y: 562, rate: '13%' },
        rate_19: { y: 549, rate: '19%' },
        total:   { y: 186, label: 'TVA Total' },
      },
    },
  },
  is: {
    // Page 0 client info: Tax ID card grid at PyMuPDF y≈130-165, name at y≈188-199,
    // business name at y≈209-220. Positions are approximate.
    client: [
      { key: 'matriculeFiscal', page: 0, x: 220, y: 684, size: 9 },
      { key: 'nom',            page: 0, x: 50,  y: 648, size: 11 },
      { key: 'adresse',        page: 0, x: 50,  y: 627, size: 10 },
      { key: 'codePostal',     page: 0, x: 35,  y: 614, size: 10 },
      { key: 'secteur',        page: 0, x: 294, y: 599, size: 10 },
      { key: 'mois',           page: 0, x: 50,  y: 585, size: 10 },
      { key: 'annee',          page: 0, x: 150, y: 585, size: 10 },
    ],
  },
};

// Checkbox positions for the tax-type selection table (pdf-lib coords, bottom-left origin)
// Table has 3 rows (PyMuPDF y=274-292, 292-312, 312-329). The checkboxes sit at the RTL start
// (right side) of each cell. Estimated from label text positions and grid dots in the PDF.
const CHECKBOXES = {
  retenues_source: { x: 538, y: 567, size: 11 },
  tfp:             { x: 495, y: 549, size: 11 },
  foprolos:        { x: 440, y: 567, size: 11 },
  tva:             { x: 318, y: 549, size: 11 },
  autres_taxes:    { x: 265, y: 567, size: 11 },
  timbre:          { x: 200, y: 567, size: 11 },
  taxe_hoteliere:  { x: 86,  y: 529, size: 11 },
  tcl:             { x: 155, y: 567, size: 11 },
  licence:         { x: 46,  y: 549, size: 11 },
};

function sanitizePDF(t) {
  return String(t).replace(/\u202f/g, ' ').replace(/[^\x20-\x7E\xA0-\xFF\u0600-\u06FF\u0152\u0153\u0160\u0161\u017D\u017E\u0178\u0192\u02C6\u02DC\u2013\u2014\u2018\u2019\u201A\u201C\u201D\u201E\u2020\u2021\u2022\u2026\u2030\u2039\u203A\u2044\u2122\u2212]/g, '');
}

function hasArabic(t) {
  return /[\u0600-\u06FF]/.test(String(t));
}

function formatDT(val) {
  const n = parseFloat(val) || 0;
  return sanitizePDF(n.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })) + ' DT';
}

function cmyk(c, m, y, k) {
  return rgb(
    (100 - c) / 100 * (100 - k) / 100,
    (100 - m) / 100 * (100 - k) / 100,
    (100 - y) / 100 * (100 - k) / 100,
  );
}

// RS line rates (first applicable percentage from tauxFR) as decimal fractions
const RS_RATES = {
  '1': null,   // Barème progressif
  '2': 0.20,
  '3': null,   // Variable
  '4': 0.10,
  '4b': 0.15,
  '5': 0.10,
  '6': 0.03,
  '7': 0.05,
  '8': 0.05,
  '9': 0.10,
  '10': 0.20,
  '11': 0.20,
  '12': 0.10,
  '13': 0.20,
  '14': 0.15,
  '15': 0.10,
  '16': 0.025,
  '17': 0.01,
  '18': 0.25,
  '19': 1.00,
  '20': null,  // 5% à 15% (range)
  '21': null,  // 15% – 25% (range)
  '22': 0.01,
  '23': 0.05,
  '24': null,  // 10% – 20% (range)
  '30': 0.03,
  '31': 0.03,
};

function rsBaseFromAmount(amount, num) {
  const rate = RS_RATES[num];
  if (rate == null) return null;
  return Math.round(amount / rate);
}

function parseKeyNum(key) {
  // "ligne_4b" → "4b", "ligne_10" → "10"
  const m = key.match(/^ligne_(.+)$/);
  return m ? m[1] : null;
}

// ── Canvas-based Arabic text rendering (browser handles shaping + RTL) ──
let _canvasFont = null;

async function _ensureCanvasFont() {
  if (_canvasFont) return;
  const fn = 'NotoSansArabic.ttf';
  const urls = [
    BASE + 'fonts/' + fn,
    'fonts/' + fn,
    window.location.origin + (BASE === '/' ? '/' : BASE) + 'fonts/' + fn,
  ];
  for (const url of urls) {
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        const font = new FontFace('ArabicCanvas', buf);
        await font.load();
        document.fonts.add(font);
        _canvasFont = 'ArabicCanvas';
        return;
      }
    } catch (_) {}
  }
  console.warn('pdfFiller: cannot load canvas Arabic font');
  _canvasFont = false;
}

async function _arabicPng(text, fontSizePt) {
  await _ensureCanvasFont();
  if (!_canvasFont) throw new Error('no canvas font');
  const family = _canvasFont;
  const scale = 2;
  const pxSize = Math.round(fontSizePt * scale * 96 / 72);
  const tmp = new OffscreenCanvas(1, 1);
  let tc = tmp.getContext('2d');
  tc.font = `${pxSize}px "${family}"`;
  const m = tc.measureText(text);
  const textH = (m.actualBoundingBoxAscent || pxSize * 0.8) + (m.actualBoundingBoxDescent || pxSize * 0.2);
  const w = Math.ceil(m.width) + 8;
  const h = Math.ceil(textH) + 6;
  tmp.width = w;
  tmp.height = h;
  tc = tmp.getContext('2d');
  tc.font = `${pxSize}px "${family}"`;
  tc.textAlign = 'right';
  tc.textBaseline = 'alphabetic';
  tc.fillStyle = '#000';
  const baselineY = h - 3;
  tc.fillText(text, w - 4, baselineY);
  const blob = await tmp.convertToBlob({ type: 'image/png' });
  const buf = await blob.arrayBuffer();
  return {
    data: new Uint8Array(buf),
    w: w / scale,
    h: h / scale,
    baseline: (h - baselineY) / scale,
  };
}

export async function generateFilledPdf(guidedState, lang = 'fr') {
  const data = guidedState?.data || {};
  const formId = guidedState?.formulaire || 'mensuelle';
  const formInfo = FORMULAIRES_MAP[formId] || FORMULAIRES_MAP.mensuelle;
  const sectionsDef = SECTIONS_MAP[formId] || SECTIONS_MAP.mensuelle;
  const pos = POS[formId];

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const leftMargin = 50;

  // Only use official PDF if there's actual sections data to fill
  const sectionKeys = data.sections ? Object.keys(data.sections).filter(s => s !== 'identification') : [];
  const hasDataToFill = sectionKeys.some(s =>
    Object.values(data.sections[s]).some(v => parseFloat(v) > 0)
  );

  let pdfDoc, useOfficial;
  if (hasDataToFill) {
    const pdfUrls = [formInfo.url, pdfUrlAlt(formId + '.pdf')].filter(Boolean);
    for (const url of pdfUrls) {
      try {
        const resp = await fetch(url);
        if (resp.ok) {
          const pdfBytes = await resp.arrayBuffer();
          pdfDoc = await PDFDocument.load(pdfBytes);
          useOfficial = true;
          break;
        }
      } catch (_) {}
    }
  }

  if (!pdfDoc) {
    pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([pageWidth, pageHeight]);
    useOfficial = false;
  }

  pdfDoc.registerFontkit(fontkit);

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  let fontArabic = null;
  const fontCandidates = ['NotoSansArabic.ttf', 'Amiri-Regular.ttf'];
  for (const fn of fontCandidates) {
    if (fontArabic) break;
    const urls = [
      BASE + 'fonts/' + fn,
      'fonts/' + fn,
      window.location.origin + (BASE === '/' ? '/' : BASE) + 'fonts/' + fn,
    ];
    for (const url of urls) {
      try {
        console.log('pdfFiller: trying font', url);
        const resp = await fetch(url);
        console.log('pdfFiller: font response', resp.status, resp.statusText);
        if (resp.ok) {
          const buf = await resp.arrayBuffer();
          console.log('pdfFiller: font size', buf.byteLength);
          fontArabic = await pdfDoc.embedFont(new Uint8Array(buf), { subset: false });
          console.log('pdfFiller: font loaded', fn);
          break;
        }
      } catch (e) { console.warn('pdfFiller: font error', fn, e); }
    }
  }
  if (!fontArabic) { console.error('pdfFiller: NO Arabic font loaded — Arabic text will be stripped'); }

  function safeText(text) {
    const s = String(text);
    return fontArabic || !hasArabic(s) ? s : s.replace(/[\u0600-\u06FF]/g, '');
  }

  function isPureArabic(text) {
    return /^[\u0600-\u06FF\s]+$/.test(String(text));
  }

  function pickFont(text, bold) {
    if (fontArabic && hasArabic(text)) return fontArabic;
    return bold ? fontBold : font;
  }

  function getPage(n) {
    while (n >= pdfDoc.getPageCount()) pdfDoc.addPage([pageWidth, pageHeight]);
    return pdfDoc.getPage(n);
  }

  // Draw text, reshaping Arabic and rendering RTL when needed
  async function drawRaw(text, pg, x, y, opts = {}) {
    const txt = safeText(text);
    if (!txt) return;
    if (fontArabic && isPureArabic(txt)) {
      try {
        const png = await _arabicPng(txt, opts.size || 8);
        const img = await pdfDoc.embedPng(png.data);
        pg.drawImage(img, { x, y: y - png.baseline, width: png.w, height: png.h });
      } catch (e) { console.warn('pdfFiller: Arabic canvas failed', e); }
      return;
    }
    const f = pickFont(txt, opts.bold);
    const sz = opts.size || 8;
    const color = opts.color || rgb(0, 0, 0);
    pg.drawText(sanitizePDF(txt), { x, y, size: sz, font: f, color });
  }

  // Right-aligned text, reshaping Arabic and rendering RTL when needed
  async function drawRight(text, pg, rightX, y, opts = {}) {
    const txt = safeText(text);
    if (!txt) return;
    if (fontArabic && isPureArabic(txt)) {
      try {
        const png = await _arabicPng(txt, opts.size || 8);
        const img = await pdfDoc.embedPng(png.data);
        pg.drawImage(img, { x: rightX - png.w, y: y - png.baseline, width: png.w, height: png.h });
      } catch (e) { console.warn('pdfFiller: Arabic canvas failed', e); }
      return;
    }
    const f = pickFont(txt, opts.bold);
    const sz = opts.size || 8;
    const color = opts.color || rgb(0, 0, 0);
    const display = sanitizePDF(txt);
    const w = f.widthOfTextAtSize(display, sz);
    pg.drawText(display, { x: rightX - w, y, size: sz, font: f, color });
  }

  // Check if there's actual section data to fill on the official form
  const hasSectionData = data.sections && Object.keys(data.sections).some(
    s => s !== 'identification' && Object.values(data.sections[s]).some(v => parseFloat(v) > 0)
  );

  // ── Draw on official PDF (only if there's data to fill) ───
  if (useOfficial && pos && hasSectionData) {
    // 1) Client info fields at specific positions
    const clientPos = pos.client || [];
    for (const cp of clientPos) {
      let val;
      if (cp.key === 'annee') {
        val = data.periode ? data.periode.split('-')[0] || data.periode : '';
      } else if (cp.key === 'mois') {
        val = data.periode ? data.periode.split('-')[1] || '' : '';
      } else {
        val = data[cp.key];
      }
      if (val) {
        const pg = getPage(cp.page);
        const txt = String(val).slice(0, 50);
        if (cp.cells) {
          const chars = txt.replace(/[\/\s-]/g, '').split('');
          const cells = cp.cells;
          const sz = cp.size;
          for (let i = 0; i < Math.min(chars.length, cells.length); i++) {
            const ch = chars[i];
            const f = pickFont(ch, false);
            const cw = f.widthOfTextAtSize(ch, sz);
            drawRaw(ch, pg, cells[i] - cw / 2, cp.y, { size: sz });
          }
        } else {
          drawRaw(txt, pg, cp.x, cp.y, { size: cp.size });
        }
      }
    }

    // 2) Retenues source line amounts
    const rs = pos.retenues_source;
    if (rs) {
      const rsData = data.sections?.retenues_source || {};
      for (const [key, rawVal] of Object.entries(rsData)) {
        if (key.startsWith('_')) continue;
        const num = parseKeyNum(key);
        if (!num) continue;
        const info = rs.lines[num];
        if (!info) continue;
        const val = parseFloat(rawVal) || 0;
        if (val === 0) continue;
        const pg = getPage(info.page);
        const txt = val.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
        drawRight(txt, pg, rs.x, info.y, { size: rs.size });
        if (rs.base_x) {
          const baseVal = rsBaseFromAmount(val, num) ?? val;
          const baseTxt = baseVal.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
          drawRight(baseTxt, pg, rs.base_x, info.y, { size: rs.size });
        }
      }
    }

    // 2b) Auto-fill tax-type checkboxes
    for (const [secId, cb] of Object.entries(CHECKBOXES)) {
      if (secId === 'identification') continue;
      const vals = data.sections?.[secId] || {};
      const hasData = Object.keys(vals).some(k => !k.startsWith('_') && parseFloat(vals[k]));
      if (hasData) {
        const pg = getPage(0);
        drawRaw('X', pg, cb.x, cb.y, { size: cb.size, bold: true });
      }
    }

    // 2c) Draw TVA table on page 4
    const tvaPos = pos.tva_table;
    if (tvaPos) {
      const tvaData = data.sections?.tva || {};
      const pg = getPage(tvaPos.page);
      const sz = tvaPos.size;
      const ca7 = parseFloat(tvaData.ca_7) || 0;
      const ca13 = parseFloat(tvaData.ca_13) || 0;
      const ca19 = parseFloat(tvaData.ca_19) || 0;
      const tvaDeductible = parseFloat(tvaData.tva_deductible) || 0;
      const tvaCollectee = parseFloat(tvaData.tva_collectee) || (ca7 * 0.07 + ca13 * 0.13 + ca19 * 0.19);
      if (ca7) {
        drawRight(ca7.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }), pg, tvaPos.cols.ca, tvaPos.rows.rate_7.y, { size: sz });
        drawRight((ca7 * 0.07).toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }), pg, tvaPos.cols.tva_due, tvaPos.rows.rate_7.y, { size: sz });
      }
      if (ca13) {
        drawRight(ca13.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }), pg, tvaPos.cols.ca, tvaPos.rows.rate_13.y, { size: sz });
        drawRight((ca13 * 0.13).toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }), pg, tvaPos.cols.tva_due, tvaPos.rows.rate_13.y, { size: sz });
      }
      if (ca19) {
        drawRight(ca19.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }), pg, tvaPos.cols.ca, tvaPos.rows.rate_19.y, { size: sz });
        drawRight((ca19 * 0.19).toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }), pg, tvaPos.cols.tva_due, tvaPos.rows.rate_19.y, { size: sz });
      }
      const tvaDue = tvaCollectee - tvaDeductible;
      if (tvaDue) {
        drawRight(tvaDue.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }), pg, tvaPos.cols.tva_due, tvaPos.rows.total.y, { size: sz });
      }
      if (tvaDeductible) {
        drawRight(tvaDeductible.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }), pg, tvaPos.cols.tva_deductible, tvaPos.rows.total.y, { size: sz });
      }
    }

    // 2d) Draw payment summary on page 8
    const psPos = pos.payment_summary;
    if (psPos) {
      const pg = getPage(psPos.page);
      const sz = psPos.size;
      const colI = psPos.cols.i;

      function sectionTotal(secId) {
        const vals = data.sections?.[secId] || {};
        return Object.entries(vals)
          .filter(([k]) => !k.startsWith('_') && k !== 'secteur_activite' && k !== 'regime_tcl' && k !== 'categorie_licence' && k !== 'nombre_locaux')
          .reduce((a, [, v]) => a + (parseFloat(v) || 0), 0);
      }

      const totals = {
        rs:           sectionTotal('retenues_source'),
        tfp:          parseFloat(data.sections?.tfp?.montant_tfp) || sectionTotal('tfp'),
        foprolos:     sectionTotal('foprolos'),
        tva:          Math.max(0, (parseFloat(data.sections?.tva?.tva_due) || 0) || sectionTotal('tva')),
        autres_taxes: sectionTotal('autres_taxes'),
        timbre:       sectionTotal('timbre'),
        taxe_hoteliere: sectionTotal('taxe_hoteliere'),
        licence:      sectionTotal('licence'),
      };
      let grandTotal = 0;
      for (const [key, row] of Object.entries(psPos.rows)) {
        if (key === 'total') continue;
        const val = totals[key] || 0;
        if (val) {
          drawRight(val.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }), pg, colI, row.y, { size: sz });
          grandTotal += val;
        }
      }
      if (grandTotal && psPos.rows.total) {
        drawRight(grandTotal.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }), pg, colI, psPos.rows.total.y, { size: sz });
      }
    }

    // 3) Overlay summary page appended after the form
    const doneSections = Object.keys(data.sections || {});
    const overlaySections = doneSections.filter(s => s !== 'identification');
    {
      let sumPage = getPage(pdfDoc.getPageCount());
      let sy = sumPage.getSize().height - 60;

      function sumDraw(text, opts = {}) {
        const txt = safeText(text);
        const f = pickFont(txt, opts.bold);
        const sz = opts.size || 10;
        const color = opts.color || cmyk(0, 0, 0, 85);
        const display = sanitizePDF(txt);
        const x = sumPage.getSize().width / 2 - f.widthOfTextAtSize(display, sz) / 2;
        sumDraw.raw(text, x, sy, { size: sz, bold: opts.bold, color });
      }
      sumDraw.raw = (text, x, y, opts) => drawRaw(text, sumPage, x, y, opts);

      sumDraw('Smart Comptable — Déclaration fiscale', { bold: true, size: 14, color: cmyk(0, 0, 0, 70) });
      sy -= 24;
      sumDraw(formInfo.labelFR, { bold: true, size: 11, color: cmyk(0, 0, 0, 50) });
      sy -= 16;
      const coName = data.nom || '';
      const coMf = data.matriculeFiscal || '';
      const coAddr = data.adresse || '';
      if (coName) { sumDraw('Société : ' + coName, { size: 9 }); sy -= 14; }
      if (coMf) { sumDraw('MF : ' + coMf, { size: 9 }); sy -= 14; }
      if (coAddr) { sumDraw('Adresse : ' + coAddr, { size: 9 }); sy -= 14; }
      if (data.periode) { sumDraw('Période : ' + data.periode, { size: 9 }); sy -= 14; }
      sy -= 6;
      sumDraw('─'.repeat(80), { size: 8, color: cmyk(0, 0, 0, 25) });
      sy -= 14;

      let totalGeneral = 0;
      for (const sectionId of overlaySections) {
        const secDef = sectionsDef.find(s => s.id === sectionId);
        const secLabel = secDef ? secDef.labelFR : sectionId;
        const vals = data.sections[sectionId] || {};
        const entries = Object.entries(vals).filter(([k]) => !k.startsWith('_'));
        if (entries.length === 0) continue;

        if (sy < 80) {
          sumPage = getPage(pdfDoc.getPageCount());
          sy = sumPage.getSize().height - 60;
          sumDraw.raw = (text, x, y, opts) => drawRaw(text, sumPage, x, y, opts);
        }

        sumDraw(secLabel, { bold: true, size: 10 });
        sy -= 16;

        const sectTotal = entries.reduce((a, [, v]) => a + (parseFloat(v) || 0), 0);
        for (const [key, rawVal] of entries) {
          const displayKey = key.replace(/^ligne_(\d+)/, 'Ligne $1');
          const val = parseFloat(rawVal) || 0;
          sumDraw(`${displayKey}   ${val.toLocaleString('fr-FR', { minimumFractionDigits: 3 })} DT`, { size: 8.5 });
          sy -= 13;
        }

        if (entries.length > 1) {
          sy -= 2;
          sumDraw('Sous-total : ' + sectTotal.toLocaleString('fr-FR', { minimumFractionDigits: 3 }) + ' DT', { bold: true, size: 9 });
          sy -= 16;
          totalGeneral += sectTotal;
        }
        sy -= 4;
      }

      if (overlaySections.some(s => (Object.keys(data.sections[s] || {}).filter(k => !k.startsWith('_')).length) > 1)) {
        sy -= 8;
        sumDraw('TOTAL GÉNÉRAL : ' + totalGeneral.toLocaleString('fr-FR', { minimumFractionDigits: 3 }) + ' DT', { bold: true, size: 12, color: cmyk(0, 0, 0, 80) });
        sy -= 24;
      }

      sy -= 8;
      sumDraw('Document généré par Smart Comptable — ' + new Date().toLocaleDateString('fr-FR'), { size: 7, color: cmyk(0, 0, 0, 40) });
    }

    return await pdfDoc.save();
  }

  // ── Fallback: simple overlay page ────────────────────────
  // If official template was loaded but no data, add a clean overlay page
  if (useOfficial && !hasSectionData) {
    {
      let sumPage = getPage(pdfDoc.getPageCount());
      let sy = sumPage.getSize().height - 60;

      function sumDraw(text, opts = {}) {
        const txt = safeText(text);
        const f = pickFont(txt, opts.bold);
        const sz = opts.size || 10;
        const color = opts.color || cmyk(0, 0, 0, 85);
        const display = sanitizePDF(txt);
        const x = sumPage.getSize().width / 2 - f.widthOfTextAtSize(display, sz) / 2;
        sumDraw.raw(text, x, sy, { size: sz, bold: opts.bold, color });
      }
      sumDraw.raw = (text, x, y, opts) => drawRaw(text, sumPage, x, y, opts);

      sumDraw('Smart Comptable — Déclaration fiscale', { bold: true, size: 14, color: cmyk(0, 0, 0, 70) });
      sy -= 24;
      sumDraw(formInfo.labelFR, { bold: true, size: 11, color: cmyk(0, 0, 0, 50) });
      sy -= 16;
      const coName = data.nom || '';
      const coMf = data.matriculeFiscal || '';
      const coAddr = data.adresse || '';
      if (coName) { sumDraw('Société : ' + coName, { size: 9 }); sy -= 14; }
      if (coMf) { sumDraw('MF : ' + coMf, { size: 9 }); sy -= 14; }
      if (coAddr) { sumDraw('Adresse : ' + coAddr, { size: 9 }); sy -= 14; }
      if (data.periode) { sumDraw('Période : ' + data.periode, { size: 9 }); sy -= 14; }
      sy -= 6;
      sumDraw('─'.repeat(80), { size: 8, color: cmyk(0, 0, 0, 25) });
      sy -= 14;
      sumDraw('Aucune donnée fiscale trouvée dans le journal pour cette période.', { size: 9, color: cmyk(0, 0, 0, 50) });
      sy -= 14;
      sumDraw('Le PDF ne contient que les informations de la société.', { size: 9, color: cmyk(0, 0, 0, 50) });
      sy -= 20;
      sumDraw('Document généré par Smart Comptable — ' + new Date().toLocaleDateString('fr-FR'), { size: 7, color: cmyk(0, 0, 0, 40) });
    }
    return await pdfDoc.save();
  }

  const lineHeight = 14;
  let page = pdfDoc.getPage(0);
  let y = page.getSize().height - 50;
  let pageNum = 0;

  function switchPage(n) {
    page = getPage(n);
    y = page.getSize().height - 50;
    pageNum = n;
  }

  function drawText(text, opts = {}) {
    const txt = safeText(text);
    const f = pickFont(txt, opts.bold);
    const size = opts.size || 10;
    const color = opts.color || cmyk(0, 0, 0, 90);
    const display = sanitizePDF(txt);
    const x = opts.center ? page.getSize().width / 2 - f.widthOfTextAtSize(display, size) / 2 : (opts.x ?? leftMargin);
    page.drawText(display, { x, y, size, font: f, color });
  }

  function drawLine(yPos) {
    page.drawLine({
      start: { x: leftMargin, y: yPos },
      end: { x: page.getSize().width - 50, y: yPos },
      thickness: 0.5,
      color: cmyk(0, 0, 0, 30),
    });
  }

  function newPageIfNeeded(needed) {
    if (y - needed < 60) switchPage(pageNum + 1);
  }

  drawText('SMART COMPTABLE — Déclaration fiscale', { bold: true, size: 16, color: cmyk(0, 0, 0, 80), center: true });
  y -= 22;
  drawText(formInfo.labelFR, { bold: true, size: 13, color: cmyk(0, 0, 0, 60), center: true });
  y -= 18;
  drawLine(y); y -= 12;

  drawText('Renseignements client', { bold: true, size: 11, center: true });
  y -= 16;
  const infoLines = [
    ['Matricule Fiscal', data.matriculeFiscal || '—'],
    ['Raison sociale', data.nom || '—'],
    ['Type', data.personneType || '—'],
    ['Régime', data.regime || '—'],
    ['Secteur', data.secteur || '—'],
    ['Période', data.periode || '—'],
  ];
  infoLines.forEach(([label, value]) => {
    newPageIfNeeded(lineHeight);
    drawText(label + ' : ' + value, { size: 9, center: true });
    y -= lineHeight;
  });
  y -= 6;
  drawLine(y); y -= 10;

  const doneSections = Object.keys(data.sections || {});
  let grandTotal = 0;

  doneSections.forEach(sectionId => {
    const secDef = sectionsDef.find(s => s.id === sectionId);
    const secLabel = secDef ? secDef.labelFR : sectionId;
    const vals = data.sections[sectionId] || {};
    const entries = Object.entries(vals).filter(([k]) => !k.startsWith('_'));
    if (entries.length === 0) return;

    newPageIfNeeded(lineHeight * 2 + entries.length * lineHeight);

    drawText(secLabel, { bold: true, size: 10, color: cmyk(0, 0, 0, 70), center: true });
    y -= 16;

    const sectionTotal = entries.reduce((a, [, v]) => a + (parseFloat(v) || 0), 0);
    entries.forEach(([key, val]) => {
      newPageIfNeeded(lineHeight);
      const displayKey = key.replace(/^ligne_(\d+)/, 'Ligne $1');
      drawText(`${displayKey}   ${formatDT(val)}`, { size: 8.5, center: true });
      y -= lineHeight;
    });

    if (entries.length > 1) {
      y -= 2;
      drawText('Sous-total  ' + formatDT(sectionTotal), { bold: true, size: 9, center: true });
      y -= lineHeight + 2;
      grandTotal += sectionTotal;
    }
    y -= 4;
    drawLine(y); y -= 8;
  });

  if (doneSections.length > 0) {
    newPageIfNeeded(30);
    y -= 6;
    drawText('TOTAL GÉNÉRAL  ' + formatDT(grandTotal), { bold: true, size: 12, color: cmyk(0, 0, 0, 80), center: true });
    y -= 20;
    drawLine(y); y -= 10;
  }

  y -= 10;
  newPageIfNeeded(30);
  drawText('Document généré par Smart Comptable — Portail Déclarations', { size: 7.5, color: cmyk(0, 0, 0, 50), center: true });
  y -= 11;
  drawText(`Formulaire officiel : ${formId.toUpperCase()}`, { size: 7.5, color: cmyk(0, 0, 0, 50), center: true });
  y -= 11;
  drawText(`Date de génération : ${new Date().toLocaleDateString('fr-FR')}`, { size: 7.5, color: cmyk(0, 0, 0, 50), center: true });

  return await pdfDoc.save();
}

// ── Automatic PDF field detection ──
// Tries to extract AcroForm field positions from the official PDF.
// Falls back to hardcoded POS when no AcroForm exists (scanned PDFs).
export async function detectPdfFields(formId) {
  const formInfo = FORMULAIRES_MAP[formId];
  if (!formInfo?.url) return null;
  try {
    const resp = await fetch(formInfo.url);
    if (!resp.ok) return null;
    const pdfBytes = await resp.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const acroFields = form.getFields();
    if (!acroFields || acroFields.length === 0) return null;

    const result = { fields: [], checkboxes: [] };
    for (const field of acroFields) {
      try {
        const name = field.getName();
        const type = field.constructor.name;
        const widgets = field.acroField.getWidgets();
        for (const widget of widgets) {
          const rect = widget.getRectangle();
          const pageIdx = widget.getPage();
          const pg = pdfDoc.getPage(pageIdx);
          const pageH = pg.getHeight();
          const entry = {
            name,
            type,
            page: pageIdx,
            x: rect.x,
            y: pageH - rect.y - rect.height,
            width: rect.width,
            height: rect.height,
          };
          if (type === 'PDFCheckBox') {
            result.checkboxes.push(entry);
          } else {
            result.fields.push(entry);
          }
        }
      } catch (_) {}
    }
    return result.fields.length > 0 || result.checkboxes.length > 0 ? result : null;
  } catch (e) {
    return null;
  }
}

// Diagnostics: generates a report of all detected vs hardcoded fields for a form
export async function getFieldDetectionReport(formId) {
  const detected = await detectPdfFields(formId);
  const hardcoded = POS[formId] || null;
  const checkboxes = CHECKBOXES;
  return {
    formId,
    hasAcroForm: !!detected,
    detectedFields: detected?.fields?.length || 0,
    detectedCheckboxes: detected?.checkboxes?.length || 0,
    hardcodedFields: hardcoded ? (hardcoded.client?.length || 0) + (hardcoded.retenues_source ? Object.keys(hardcoded.retenues_source.lines).length : 0) : 0,
    hardcodedCheckboxes: Object.keys(checkboxes).length,
    detected,
    hardcoded,
    checkboxes,
  };
}

export function downloadPdf(pdfBytes, filename) {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
