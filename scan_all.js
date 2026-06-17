import { createWorker } from 'tesseract.js';
import fs from 'fs';
import path from 'path';

const DOWNLOADS = 'C:\\Users\\ezzin\\Downloads';

async function scanAllDownloads() {
  const files = fs.readdirSync(DOWNLOADS);
  console.log(`Scanning all images in Downloads... Total files: ${files.length}`);
  
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  const candidates = files
    .filter(f => imageExtensions.includes(path.extname(f).toLowerCase()))
    .map(f => ({
      name: f,
      path: path.join(DOWNLOADS, f)
    }));

  console.log(`Total image candidates: ${candidates.length}`);

  for (const c of candidates) {
    try {
      // Fast check: let's do a quick OCR or look at files that are named like our files
      // We can also filter by file size or name patterns
      if (c.name.toLowerCase().includes('facture') || c.name.toLowerCase().includes('image') || c.name.toLowerCase().includes('received') || c.name.length < 20 || /^[0-9a-f\-]+\.(jpg|jpeg|png|webp)$/i.test(c.name)) {
        // Let's run a worker
        const worker = await createWorker('fra');
        const res = await worker.recognize(c.path);
        await worker.terminate();
        
        const text = res.data.text.toLowerCase();
        
        const isSTEG = text.includes('steg') || text.includes('tunisienne') || text.includes('electricité') || text.includes('53472');
        const isEInfo = text.includes('e-info') || text.includes('einfo') || text.includes('ramitech') || text.includes('279,000') || text.includes('22168875');
        const isAradenet = text.includes('aradenet') || text.includes('152.260') || text.includes('malaren');
        const isMyCompany = text.includes('my company');
        
        if (isSTEG || isEInfo || isAradenet || isMyCompany) {
          console.log(`\nFound target: ${c.name}`);
          console.log(`  STEG: ${isSTEG}, E-Info: ${isEInfo}, Aradenet: ${isAradenet}, MyCompany: ${isMyCompany}`);
          console.log(`  Confidence: ${res.data.confidence}%`);
          console.log(`  Snippet: ${res.data.text.replace(/\n/g, ' ').substring(0, 200)}`);
        }
      }
    } catch (err) {
      // ignore errors
    }
  }
  console.log('Scan complete!');
}

scanAllDownloads().catch(console.error);
