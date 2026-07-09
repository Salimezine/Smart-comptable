const fs = require('fs');
const pdfjs = require('pdfjs-dist');
(async () => {
  const buf = fs.readFileSync('_test.pdf');
  const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  for (let p = 1; p <= 6; p++) {
    const pg = await doc.getPage(p);
    const tc = await pg.getTextContent();
    console.log('=== PAGE', p, '===');
    tc.items.forEach(item => {
      const s = item.str;
      if (!s || !s.trim() || s.match(/^\.+$/) || s.match(/^_+$/)) return;
      const x = Math.round(item.transform[4]);
      const y = Math.round(item.transform[5]);
      console.log(x, y, JSON.stringify(s.slice(0, 80)));
    });
  }
  await doc.destroy();
})().catch(e => console.error(e));
