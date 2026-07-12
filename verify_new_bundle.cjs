const fs = require('fs');
const c = fs.readFileSync('dist/assets/index-CqmYnMG9.js', 'utf8');
console.log('Length:', c.length);

// Check for commandPaletteOpen (should be 0 or 1 occurrences now)
let count = 0;
let idx = -1;
while ((idx = c.indexOf('commandPaletteOpen', idx + 1)) !== -1) count++;
console.log('commandPaletteOpen occurrences:', count);

if (count > 0) {
  const pos = c.indexOf('commandPaletteOpen');
  // Check if it's inside AppContent or WorkflowView
  const before = c.substring(0, pos);
  const workFunc = 'function ';
  let lastFunc = -1;
  let fi = -1;
  while ((fi = before.indexOf('function ', fi + 1)) !== -1) lastFunc = fi;
  console.log('Last function before commandPaletteOpen:');
  if (lastFunc >= 0) console.log(c.substring(lastFunc, Math.min(lastFunc + 80, c.length)));
  
  // Also check what section it's in
  console.log('\nContext:', c.substring(Math.max(0, pos-30), pos + 50));
}

// Check for AppContent function
console.log('\nAppContent:', c.indexOf('function AppContent'));
console.log('function Bc:', c.indexOf('function Bc'));
console.log('function Vc:', c.indexOf('function Vc'));

// Check that the scoping is correct
// Look for the FAB or MessageCircle near the command palette
const cmdPos = c.indexOf('commandPaletteOpen');
if (cmdPos >= 0) {
  const nearText = c.substring(Math.max(0, cmdPos - 500), cmdPos + 50);
  // Look for "Assistant IA" which is the AI button
  console.log('\n"Assistant IA" near commandPaletteOpen:', nearText.includes('Assistant IA'));
  // Look for "fixed bottom" near it
  console.log('"fixed bottom-6" near:', nearText.includes('fixed bottom-6'));
}

// Check what function contains the command palette usage
const cmdUsageIdx = c.indexOf('commandPaletteOpen&&');
if (cmdUsageIdx >= 0) {
  const beforeUsage = c.substring(0, cmdUsageIdx);
  let lastFunc = beforeUsage.lastIndexOf('function ');
  console.log('\n=== Function containing commandPaletteOpen usage ===');
  if (lastFunc >= 0) console.log(c.substring(lastFunc, Math.min(lastFunc + 120, c.length)));
}
