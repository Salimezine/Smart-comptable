import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const dest = resolve(root, 'public', 'tesseract');
if (!existsSync(dest)) mkdirSync(dest, { recursive: true });

const files = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'tesseract/worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core.wasm.js', 'tesseract/tesseract-core.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core.wasm', 'tesseract/tesseract-core.wasm'],
  ['node_modules/pdfjs-dist/build/pdf.worker.min.js', 'pdf.worker.min.js'],
];

for (const [src, name] of files) {
  const srcPath = resolve(root, src);
  const destPath = resolve(root, 'public', name);
  copyFileSync(srcPath, destPath);
  console.log(`  ✓ ${name}`);
}

console.log('\nTesseract worker/core/wasm + pdf.js worker copied to public/');
