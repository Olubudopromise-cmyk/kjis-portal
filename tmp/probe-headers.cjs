const pdf=require('pdf-parse');const fs=require('fs');const buf=fs.readFileSync('JSS & SSS - NERDC Scheme (2025).pdf');
(async()=>{
 const i=new pdf.PDFParse(new Uint8Array(buf),{verbosity:pdf.VerbosityLevel.ERROR});await i.load();const d=i.doc;
 const [a,b]=process.argv.slice(2).map(Number);
 for(let pn=a;pn<=b;pn++){
  const p=await d.getPage(pn);const tc=await p.getTextContent();
  const its=(tc.items||[]).filter(it=>it.str&&it.str.trim()).map(it=>({s:it.str,x:+it.transform[4].toFixed(0),y:+it.transform[5].toFixed(1)}));
  const txt=its.map(it=>it.s).join(' ').toUpperCase();
  if(!/SCHEME OF WORK/.test(txt)) continue;
  const hdr=its.filter(it=>it.y>735&&it.y<752).sort((p,q)=>p.x-q.x);
  console.log('page',pn, hdr.map(h=>h.x+':'+JSON.stringify(h.s)).join(' '));
 }
})().catch(e=>{console.error(e.message);process.exit(1);});
