const pdf = require('pdf-parse');
const fs = require('fs');
const PDF_PATH = 'JSS & SSS - NERDC Scheme (2025).pdf';
const buf = fs.readFileSync(PDF_PATH);

(async () => {
  const instance = new pdf.PDFParse(new Uint8Array(buf), { verbosity: pdf.VerbosityLevel.ERROR });
  await instance.load();
  const doc = instance.doc;

  console.log('Scanning pages 141-477 for any SENIOR SECONDARY mention...');
  for (let pn = 141; pn <= 477; pn++) {
    const page = await doc.getPage(pn);
    const tc = await page.getTextContent();
    const items = (tc.items || []).filter(it => it.str && it.str.trim()).map(it => ({
      str: it.str, x: it.transform[4], y: it.transform[5]
    }));
    const body = items.filter(it => it.y < 780 && it.y > 50).sort((a,b)=>a.y-b.y || a.x-b.x);
    const bodyText = body.map(it => it.str).join(' ');
    const upper = bodyText.toUpperCase();
    if (upper.includes('SENIOR SECONDARY') || upper.includes('SSS')) {
      // Find the items containing SENIOR or SSS
      const hits = body.filter(it => /senior secondary|sss/i.test(it.str));
      console.log('\nPAGE', pn, '-> hits:', hits.length);
      hits.slice(0, 8).forEach(it => console.log('   y='+it.y.toFixed(1).padStart(7), 'x='+it.x.toFixed(1).padStart(7), '|', JSON.stringify(it.str).padEnd(34)));
      // Also print the full body text (first 400 chars) for context
      console.log('   BODY TEXT (first 400 chars):', JSON.stringify(bodyText.slice(0, 400)));
    }
  }
  console.log('\nDone.');
})().catch(err => { console.error('ERR', err.message || err); process.exit(1); });
