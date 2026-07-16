import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfjs = require(path.join(process.cwd(), 'node_modules/pdfjs-dist/build/pdf.js'));

async function main() {
  const buf = fs.readFileSync('C:/Users/ezzin/Downloads/Bilan_SCE_N_A_2026 (6).pdf');
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    console.log('=== PAGE ' + p + ' (' + tc.items.length + ' items) ===');
    
    const lineMap = {};
    const yTolerance = 3;
    for (const item of tc.items) {
      const y = Math.round(item.transform[5] / yTolerance) * yTolerance;
      if (!lineMap[y]) lineMap[y] = [];
      lineMap[y].push(item);
    }
    const keys = Object.keys(lineMap).map(Number).sort((a, b) => b - a);
    for (const y of keys) {
      const lineItems = lineMap[y].sort((a, b) => a.transform[4] - b.transform[4]);
      const text = lineItems.map(i => i.str).join(' ').trim();
      if (text) console.log('Y=' + y + ': ' + text);
    }
  }
}
main().catch(e => console.error('Error:', e.message));
