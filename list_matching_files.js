import fs from 'fs';
import path from 'path';

const DOWNLOADS = 'C:\\Users\\ezzin\\Downloads';
const files = fs.readdirSync(DOWNLOADS);

console.log("Files matching webp, jpg, png, pdf:");
files.forEach(f => {
  const ext = path.extname(f).toLowerCase();
  const name = f.toLowerCase();
  if (['.webp', '.jpg', '.jpeg', '.png', '.pdf'].includes(ext)) {
    if (name.includes('received') || name.includes('pdf') || name.includes('steg') || name.includes('info') || name.includes('facture') || name.includes('68') || name.includes('50000') || name.includes('279')) {
      const stats = fs.statSync(path.join(DOWNLOADS, f));
      console.log(`- ${f} (${stats.size} bytes, modified: ${stats.mtime})`);
    }
  }
});
