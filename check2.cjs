const fs = require('fs');
const c = fs.readFileSync('dist/assets/index-BhYGxsCW.js', 'utf8');

// Search for common function names
const terms = ['function App', 'export default', 'ToastProvider', 'ConfirmProvider', 'useState(false', 'Bc(', 'commandPaletteOpen', 'useState('];
for (const t of terms) {
  const idx = c.indexOf(t);
  if (idx >= 0) {
    console.log(`"${t}" at ${idx}:`, c.substring(idx, Math.min(idx + 80, c.length)));
  } else {
    console.log(`"${t}" NOT found`);
  }
}
