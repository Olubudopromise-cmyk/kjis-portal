const pdf = require('pdf-parse');
const fs = require('fs');
const PDF_PATH = 'JSS & SSS - NERDC Scheme (2025).pdf';
const buf = fs.readFileSync(PDF_PATH);

(async () => {
  const instance = new pdf.PDFParse(new Uint8Array(buf), { verbosity: pdf.VerbosityLevel.ERROR });
  await instance.load();
  const doc = instance.doc;

  console.log('Scanning footer text for pages 141-383...');
  let lastFooter = '';
  for (let pn = 141; pn <= 383; pn++) {
    const page = await doc.getPage(pn);
    const tc = await page.getTextContent();
    const items = (tc.items || []).filter(it => it.str && it.str.trim()).map(it => ({
      str: it.str, x: it.transform[4], y: it.transform[5]
    }));
    const foot = items.filter(it => it.y > 775 && it.x < 260).sort((a,b)=>a.x-b.x).map(it => it.str).join(' ');
    const norm = foot.toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    if (norm !== lastFooter) {
      console.log('PAGE', pn, '-> footer:', JSON.stringify(norm));
      lastFooter = norm;
    }
    if (pn % 50 === 0) console.log('  ... scanned to page', pn);
  }

  // Also find where JSS2->JSS3 boundary is
  console.log('\nScanning footer text for pages 70-145 (JSS2->JSS3 boundary)...');
  let lastFooter2 = '';
  for (let pn = 70; pn <= 145; pn++) {
    const page = await doc.getPage(pn);
    const tc = await page.getTextContent();
    const items = (tc.items || []).filter(it => it.str && it.str.trim()).map(it => ({
      str: it.str, x: it.transform[4], y: it.transform[5]
    }));
    const foot = items.filter(it => it.y > 775 && it.x < 260).sort((a,b)=>a.x-b.x).map(it => it.str).join(' ');
    const norm = foot.toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    if (norm !== lastFooter2) {
      console.log('PAGE', pn, '-> footer:', JSON.stringify(norm));
      lastFooter2 = norm;
    }
  }

  // And JSS1->JSS2 boundary
  console.log('\nScanning footer text for pages 5-80 (JSS1->JSS2 boundary)...');
  let lastFooter3 = '';
  for (let pn = 5; pn <= 80; pn++) {
    const page = await doc.getPage(pn);
    const tc = await page.getTextContent();
    const items = (tc.items || []).filter(it => it.str && it.str.trim()).map(it => ({
      str: it.str, x: it.transform[4], y: it.transform[5]
    }));
    const foot = items.filter(it => it.y > 775 && it.x < 260).sort((a,b)=>a.x-b.x).map(it => it.str).join(' ');
    const norm = foot.toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    if (norm !== lastFooter3) {
      console.log('PAGE', pn, '-> footer:', JSON.stringify(norm));
      lastFooter3 = norm;
    }
  }
})().catch(err => { console.error('ERR', err.message || err); process.exit(1); });
