import { createWorker } from 'tesseract.js';
import fs from 'fs';

const files = [
  'C:\\Users\\ezzin\\Downloads\\WhatsApp Image 2026-06-16 at 5.44.15 PM.jpeg',
  'C:\\Users\\ezzin\\Downloads\\WhatsApp Image 2026-06-16 at 5.51.28 PM.jpeg'
];

async function checkWhatsApp() {
  for (const f of files) {
    console.log(`\n============================\n${f}\n============================`);
    const worker = await createWorker('fra');
    const res = await worker.recognize(f);
    await worker.terminate();
    console.log("OCR text:");
    console.log(res.data.text);
  }
}

checkWhatsApp().catch(console.error);
