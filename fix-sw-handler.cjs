const fs = require('fs');
let sw = fs.readFileSync('dist/sw.js', 'utf8');
if (sw.includes('createHandlerBoundToURL("index.html")')) {
  sw = sw.replace(/createHandlerBoundToURL\("index\.html"\)/g, 'createHandlerBoundToURL("app.html")');
  fs.writeFileSync('dist/sw.js', sw, 'utf8');
  console.log('Handler fixed to app.html');
} else {
  console.log('Handler already fixed or not found');
}
