const pdf = require('pdf-parse');
const fs = require('fs');
(async () => {
  const buf = fs.readFileSync('JSS & SSS - NERDC Scheme (2025).pdf');
  const inst = new pdf.PDFParse(new Uint8Array(buf), { verbosity: pdf.VerbosityLevel.ERROR });
  await inst.load();
  const doc = inst.doc;
  const page = await doc.getPage(Number(process.argv[2]));
  const tc = await page.getTextContent();
  const items = (tc.items||[]).filter(it=>it.str&&it.str.trim()).map(it=>({str:it.str.trim(), x:Math.round(it.transform[4]*10)/10, y:Math.round(it.transform[5]*10)/10, w:Math.round((it.width||0)*10)/10}));
  const lines = [];
  for (const it of items) {
    let ln = lines.find(l=>Math.abs(l.y-it.y)<5);
    if(!ln){ln={y:it.y,items:[]};lines.push(ln);}
    ln.items.push(it);
  }
  lines.sort((a,b)=>b.y-a.y);
  for(const l of lines){ l.items.sort((a,b)=>a.x-b.x); }
  for(const l of lines){
    const t=l.items.map(i=>i.str).join(' ');
    if(/week/i.test(t) && /topic|content|breakdown|speech/i.test(t)) {
      console.log('HEADER y=',l.y, JSON.stringify(t));
      for(const i of l.items) console.log('   ', JSON.stringify(i.str), 'x=',i.x,'w=',i.w);
    }
  }
  console.log('--- first 6 lines after header ---');
  let seen=false, n=0;
  for(const l of lines){
    const t=l.items.map(i=>i.str).join(' ');
    if(/^\s*week/i.test(t)&&/topic|content/i.test(t)) seen=true;
    if(seen && n<8){ console.log('y=',l.y, JSON.stringify(t.slice(0,120)), 'x0=', l.items[0]&&l.items[0].x); n++; }
  }
})();
