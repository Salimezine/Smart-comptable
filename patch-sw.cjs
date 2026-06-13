const fs = require('fs');
let sw = fs.readFileSync('dist/sw.js', 'utf8');
// Remove the NavigationRoute that redirects navigations to index.html/app.html
sw = sw.replace(/s\.registerRoute\(new s\.NavigationRoute\(s\.createHandlerBoundToURL\("[^"]+"\)\)\)[^;]*;/g, '');
sw = sw.replace(/\}\]\,\{\}\)\,s\.cleanupOutdatedCaches/g,
  '},{url:"app.html",revision:null},{url:"index.html",revision:null},{url:"mentions-legales.html",revision:null}],{}),s.cleanupOutdatedCaches');
fs.writeFileSync('dist/sw.js', sw, 'utf8');
console.log('SW patched — navigation route removed');
