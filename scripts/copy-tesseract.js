import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const dest = resolve(root, 'public', 'tesseract');
if (!existsSync(dest)) mkdirSync(dest, { recursive: true });

const files = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core.wasm.js', 'tesseract-core.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core.wasm', 'tesseract-core.wasm'],
];

for (const [src, name] of files) {
  const srcPath = resolve(root, src);
  const destPath = resolve(dest, name);
  copyFileSync(srcPath, destPath);
  console.log(`  ✓ ${name}`);
}

console.log('\nTesseract worker/core/wasm copied to public/tesseract/');
