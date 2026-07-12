const fs = require('fs');
const c = fs.readFileSync('dist/assets/index-BhYGxsCW.js', 'utf8');

// Show code around ToastProvider 
const tp = c.indexOf('ToastProvider');
console.log("=== Around ToastProvider ===");
console.log(c.substring(Math.max(0, tp - 200), Math.min(tp + 300, c.length)));

// Find all useState calls and check if any is immediately followed by commandPaletteOpen
const us = c.indexOf('useState(!1)');
console.log("\n=== useState(!1) at", us, "===");
if (us >= 0) {
  console.log(c.substring(Math.max(0, us - 200), Math.min(us + 50, c.length)));
}

// Check if Bc contains the return statement with all the UI
const bc = c.indexOf('function Bc');
console.log("\n=== Near Bc end ===");
// Find the last 'return' in Bc
const bcContent = c.substring(bc, bc + 40000);
let lastReturn = bcContent.lastIndexOf('return');
console.log("Last return in Bc at relative:", lastReturn);
if (lastReturn >= 0) {
  console.log("Return context:", bcContent.substring(lastReturn, Math.min(lastReturn + 200, bcContent.length)));
}

// Find closeCommandPalette reference
const cc = c.indexOf('closeCommandPalette');
console.log("\n=== closeCommandPalette at", cc, "===");
if (cc >= 0) {
  console.log(c.substring(Math.max(0, cc - 100), cc + 50));
}

// What comes after Bc? Search for the next function
const afterBc = c.indexOf('function ', bc + 1);
console.log("\n=== Next function after Bc at", afterBc, "===");
if (afterBc >= 0) {
  console.log(c.substring(afterBc, afterBc + 50));
}

// Where does the file end after Bc?
console.log("\n=== End of file ===");
console.log(c.substring(c.length - 200));
