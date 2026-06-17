import { createWorker } from 'tesseract.js';
import * as pdfjs from 'pdfjs-dist';
import fs from 'fs/promises';
import path from 'path';

const SAMPLES_DIR = 'C:\\Users\\ezzin\\Downloads';
const SAMPLES = [
  'facture_prestation_rs.pdf',
  'facture_ste_bonjour_produits.pdf',
  'facture_steg_electricite.pdf',
  'facture_ooredoo_telecom.pdf',
  'facture-exemple-1.png',
];
const COMBINED_DIR = 'C:\\Users\\ezzin\\Downloads\\files';
const SAMPLES2 = ['facture_fournisseur_TN.pdf'];

async function extractPdfText(filePath) {
  try {
    const data = await fs.readFile(filePath);
    const pdf = await pdfjs.getDocument({ data: data.buffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      let lastY = -1;
      for (const item of tc.items) {
        const y = Math.round(item.transform[5]);
        if (lastY >= 0 && y < lastY - 2) text += '\n';
        else if (lastY >= 0 && y === lastY) text += ' ';
        else if (lastY >= 0) text += '\n';
        text += item.str;
        lastY = y;
      }
      text += '\n--- PAGE BREAK ---\n';
    }
    return { source: 'pdf-text', text: text.trim(), length: text.trim().length };
  } catch (err) {
    return { source: 'pdf-text', text: '', length: 0, error: err.message };
  }
}

async function ocrImage(filePath) {
  try {
    const worker = await createWorker('fra');
    const result = await worker.recognize(filePath);
    await worker.terminate();
    const text = result?.data?.text || '';
    return { source: 'ocr', text, length: text.length, confidence: result?.data?.confidence || 0 };
  } catch (err) {
    return { source: 'ocr', text: '', length: 0, error: err.message };
  }
}

async function main() {
  for (const file of [...SAMPLES, ...SAMPLES2.map(f => path.join(COMBINED_DIR, f))]) {
    const fullPath = path.resolve(file);
    const exists = await fs.stat(fullPath).then(() => true).catch(() => false);
    if (!exists) { console.log(`\n=== SKIP (not found): ${file} ===`); continue; }

    const ext = path.extname(file).toLowerCase();
    console.log(`\n${'='.repeat(70)}`);
    console.log(`=== ${path.basename(file)} (${ext}) ===`);
    console.log(`${'='.repeat(70)}`);

    let result;
    if (ext === '.pdf') {
      result = await extractPdfText(fullPath);
      if (result.length < 10) {
        console.log(`  PDF text extraction gave ${result.length} chars, trying OCR...`);
        result = await ocrImage(fullPath);
      }
    } else {
      result = await ocrImage(fullPath);
    }

    console.log(`  Source: ${result.source}, Length: ${result.length}, Confidence: ${result.confidence || 'N/A'}`);
    if (result.error) console.log(`  Error: ${result.error}`);
    console.log(`  ${'-'.repeat(50)}`);
    console.log(result.text.substring(0, 1200));
    console.log(`  ${'-'.repeat(50)}`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
