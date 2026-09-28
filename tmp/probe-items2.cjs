const pdf = require('pdf-parse');
const fs = require('fs');
(async () => {
  const buf = fs.readFileSync('JSS & SSS - NERDC Scheme (2025).pdf');
  const inst = new pdf.PDFParse(new Uint8Array(buf), { verbosity: pdf.VerbosityLevel.ERROR });
  await inst.load();
  const doc = inst.doc;
  for (const pn of [65,66,67,68,70]) {
    const page = await doc.getPage(pn);
    const tc = await page.getTextContent();
    const items = (tc.items||[]).filter(it=>it.str&&it.str.trim()).map(it=>({str:it.str, x:Math.round(it.transform[4]*10)/10, y:Math.round(it.transform[5]*10)/10, w:Math.round((it.width||0)*10)/10}));
    const lines = [];
    for (const it of items) { let ln = lines.find(l=>Math.abs(l.y-it.y)<5); if(!ln){ln={y:it.y,items:[]};lines.push(ln);} ln.items.push(it); }
    lines.sort((a,b)=>b.y-a.y);
    console.log('===== page', pn);
    let shown=0;
    for (const l of lines) {
      if (/(GET ACCESS|SCHEME OF WORK|CLICK)/i.test(l.items.map(i=>i.str).join(' '))) continue;
      l.items.sort((a,b)=>a.x-b.x);
      console.log('  y='+l.y.toFixed(1), l.items.map(i=>`${JSON.stringify(i.str)}@${i.x}`).join('  '));
      if (++shown>=6) break;
    }
  }
})();
