const T = require('tesseract.js');
const p = 'C:\\Users\\ezzin\\Downloads\\7dc3c454-fc42-435f-a0d0-bb434e7be1f1.jpg';
console.log('OCR en cours sur:', p);
T.recognize(p, 'fra', {
  logger: m => { if (m.status === 'recognizing text') process.stdout.write('.'); }
}).then(r => {
  console.log('\n=== TEXTE OCR ===');
  console.log(r.data.text);
  console.log('=== FIN OCR ===');
}).catch(e => console.error('Erreur:', e.message));
