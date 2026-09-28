const pdf=require('pdf-parse');const fs=require('fs');const buf=fs.readFileSync('JSS & SSS - NERDC Scheme (2025).pdf');
(async()=>{
 const i=new pdf.PDFParse(new Uint8Array(buf),{verbosity:pdf.VerbosityLevel.ERROR});await i.load();const d=i.doc;
 const [pn,yLo,yHi]=process.argv.slice(2).map(Number);
 const p=await d.getPage(pn);const tc=await p.getTextContent();
 const its=(tc.items||[]).filter(it=>it.str&&it.str.trim()&&it.transform[5]>=yLo&&it.transform[5]<=yHi)
  .map(it=>({s:it.str,x:+it.transform[4].toFixed(1),y:+it.transform[5].toFixed(1)})).sort((a,b)=>b.y-a.y||a.x-b.x);
 let cur=null;
 for(const it of its){ if(cur===null||Math.abs(it.y-cur)>3){ if(cur!==null)console.log(); cur=it.y; process.stdout.write('y='+String(it.y).padStart(6)+' '); } process.stdout.write('['+it.x+']'+it.s+' '); }
 console.log();
})().catch(e=>{console.error(e.message);process.exit(1);});
