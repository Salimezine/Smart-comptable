const fs = require('fs');
const c = fs.readFileSync('src/App.jsx', 'utf8');
const lines = c.split('\n');

// Find the line number where the key functions open and close
let depth = 0;
let funcStack = [];
let braceLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // Count braces
  const trimmed = line.trim();
  if (trimmed.includes('function AppContent')) {
    funcStack.push({name: 'AppContent', line: i+1, depthAtOpen: depth});
    console.log(`AppContent opens at line ${i+1}, current depth ${depth}`);
  }
  if (trimmed.includes('function WorkflowView')) {
    funcStack.push({name: 'WorkflowView', line: i+1, depthAtOpen: depth});
    console.log(`WorkflowView opens at line ${i+1}, current depth ${depth}`);
  }
  if (trimmed.includes('export default function App')) {
    funcStack.push({name: 'App', line: i+1, depthAtOpen: depth});
    console.log(`App opens at line ${i+1}, current depth ${depth}`);
  }
  
  for (const ch of line) {
    if (ch === '{') depth++;
    if (ch === '}') depth--;
  }
  
  // After processing line, check if any function just closed
  if (funcStack.length > 0) {
    const last = funcStack[funcStack.length - 1];
    if (depth <= last.depthAtOpen) {
      console.log(`${last.name} closes around line ${i+1} (depth now ${depth})`);
      funcStack.pop();
      // Check if next function on same level
      if (funcStack.length > 0) {
        console.log(`  Remaining: ${funcStack.map(f=>f.name).join(', ')}`);
      }
    }
  }
}
