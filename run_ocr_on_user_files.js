import { createWorker } from 'tesseract.js';
import { parseFactureTunisienne } from './src/utils/ocrParser.js';
import fs from 'fs/promises';
import path from 'path';

const file1 = 'C:\\Users\\ezzin\\Downloads\\received_1825086331479482.webp';
const file2 = 'C:\\Users\\ezzin\\Downloads\\pdf.webp';

async function processImage(filePath) {
  console.log(`\n=======================================\nProcessing: ${filePath}\n=======================================`);
  try {
    // We want to support both French and Arabic for STEG (ara+fra)
    // Tesseract.js supports multi-language workers
    const worker = await createWorker(['fra', 'ara']);
    const result = await worker.recognize(filePath);
    await worker.terminate();
    
    const text = result.data.text;
    console.log("--- RAW TEXT ---");
    console.log(text);
    console.log("--- PARSED RESULT ---");
    const parsed = parseFactureTunisienne(text, result.data.confidence);
    console.log(JSON.stringify(parsed, null, 2));
    
    // Save raw text to file to investigate
    const textPath = filePath + '.txt';
    await fs.writeFile(textPath, text, 'utf-8');
    console.log(`Raw text saved to ${textPath}`);
  } catch (err) {
    console.error(`Error processing ${filePath}:`, err);
  }
}

async function run() {
  await processImage(file1);
  await processImage(file2);
}

run().catch(console.error);
