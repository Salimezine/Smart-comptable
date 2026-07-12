const fs = require('fs');
const c = fs.readFileSync('dist/assets/index-BhYGxsCW.js', 'utf8');
console.log('Length:', c.length);

// Find Bc function
const bcIdx = c.indexOf('function Bc');
console.log('Bc at:', bcIdx);
if (bcIdx >= 0) {
  console.log('Bc defines:', c.substring(bcIdx, bcIdx + 80));
}

// Find AppContent
const appIdx = c.indexOf('function AppContent');
console.log('AppContent at:', appIdx);
if (appIdx >= 0) {
  console.log('AppContent:', c.substring(appIdx, appIdx + 80));
}

// Find text "Assistant IA" which is near commandPaletteOpen
const aiIdx = c.indexOf('Assistant IA');
console.log('Assistant IA at:', aiIdx);
if (aiIdx >= 0) {
  console.log('Before:', c.substring(Math.max(0, aiIdx - 200), aiIdx));
  console.log('After:', c.substring(aiIdx, aiIdx + 200));
}

// Show context around commandPaletteOpen
const cmdIdx = c.indexOf('commandPaletteOpen');
console.log('\ncommandPaletteOpen at:', cmdIdx);
if (cmdIdx >= 0) {
  const before = c.substring(Math.max(0, cmdIdx - 500), cmdIdx);
  const lastArrow = before.lastIndexOf('=>');
  const lastBrace = before.lastIndexOf('{');
  const lastSemi = before.lastIndexOf(';');
  const markers = [lastArrow, lastBrace, lastSemi].filter(x => x >= 0).sort((a, b) => b - a);
  console.log('Nearest marker before:', markers[0] !== undefined ? 'index ' + markers[0] : 'none');
  if (markers[0] !== undefined) {
    console.log('Context before marker:', c.substring(Math.max(0, markers[0] - 100), markers[0]));
  }
}

// Check if the code matches what we expect - find the MessageCircle usage near commandPaletteOpen
const mcIdx = c.indexOf('MessageCircle');
console.log('\nMessageCircle at:', mcIdx);
if (mcIdx >= 0) {
  const nearCmd = Math.abs(mcIdx - cmdIdx);
  console.log('Distance from commandPaletteOpen:', nearCmd);
}
