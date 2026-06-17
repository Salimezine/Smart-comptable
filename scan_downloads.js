import { createWorker } from 'tesseract.js';
import fs from 'fs';
import path from 'path';

const DOWNLOADS = 'C:\\Users\\ezzin\\Downloads';

async function scanAllImages() {
  const files = fs.readdirSync(DOWNLOADS);
  console.log(`Scanning Downloads directory for images... Total files: ${files.length}`);
  
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  const candidates = files
    .filter(f => imageExtensions.includes(path.extname(f).toLowerCase()))
    .map(f => ({
      name: f,
      path: path.join(DOWNLOADS, f),
      mtime: fs.statSync(path.join(DOWNLOADS, f)).mtime
    }))
    .sort((a, b) => b.mtime - a.mtime) // newest first
    .slice(0, 15); // check top 15 newest images
    
  console.log(`Candidates (top 15 newest):`);
  candidates.forEach((c, idx) => console.log(`${idx}: ${c.name} (modified: ${c.mtime})`));

  for (const c of candidates) {
    console.log(`\n---------------------------------------\nScanning: ${c.name}\n---------------------------------------`);
    try {
      const worker = await createWorker('fra');
      const res = await worker.recognize(c.path);
      await worker.terminate();
      
      const text = res.data.text;
      console.log(`OCR Confidence: ${res.data.confidence}%`);
      
      const hasSTEG = /steg|tunisienne|electricite|gaz|كهرباء|غاز/i.test(text);
      const hasEInfo = /e-info|einfo|ramitech|w55|sata|TB220/i.test(text);
      const hasMohamed = /mohamed/i.test(text);
      const has50000 = /50\s*[.,]\s*000|50\s*000/i.test(text);
      const has279000 = /279\s*[.,]\s*000|279\s*000/i.test(text);
      
      console.log(`Matches - STEG: ${hasSTEG}, E-Info: ${hasEInfo}, Mohamed: ${hasMohamed}, 50DT: ${has50000}, 279DT: ${has279000}`);
      if (hasSTEG || hasEInfo || hasMohamed || has50000 || has279000) {
        console.log(`>>> FOUND INTERESTING FILE: ${c.name} <<<`);
        console.log("Snippet:");
        console.log(text.substring(0, 300));
      }
    } catch (err) {
      console.error(`Error scanning ${c.name}:`, err.message);
    }
  }
}

scanAllImages().catch(console.error);
