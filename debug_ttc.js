import { 
  detectTotalTTC, 
  detectTotalHT, 
  detectMontantTVA, 
  detectTauxTVA,
  parseMontantLettres,
  corrigerFacture 
} from './src/utils/ocrParser.js';
import fs from 'fs';

const text = fs.readFileSync('C:\\Users\\ezzin\\Downloads\\received_1825086331479482.webp.txt', 'utf-8');

console.log("detectTotalTTC:", detectTotalTTC(text));
console.log("detectTotalHT:", detectTotalHT(text));
console.log("detectMontantTVA:", detectMontantTVA(text));
console.log("detectTauxTVA:", detectTauxTVA(text));
console.log("parseMontantLettres:", parseMontantLettres(text));

// Let's run a line-by-line check on how each function behaves
const norm = text.replace(/(\d)\s+(\d{3})/g, '$1$2');
console.log("Norm contains 861712?", norm.includes("861712"));
console.log("Norm contains 1861712?", norm.includes("1861712"));
