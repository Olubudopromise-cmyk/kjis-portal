const { chromium } = require('playwright');
const BASE = 'http://localhost:3000';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
  const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  
  page.on('console', m => { if (m.type() === 'error') console.log(`ERROR: ${m.text()}`); });
  
  console.log('=== Admin login page ===');
  await page.goto(BASE + '/admin/login', { waitUntil: 'networkidle', timeout: 20000 });
  await sleep(3000);
  console.log('URL:', page.url());
  const html = await page.content();
  // Extract form-related parts
  const formMatch = html.match(/<form[\s\S]*?<\/form>/);
  console.log('FORM:', formMatch ? formMatch[0].substring(0, 500) : 'NO FORM FOUND');
  console.log('\nINPUTS:');
  const inputs = await page.$$eval('input, button', els => els.map(e => ({ tag: e.tagName, type: e.type, name: e.name, value: e.value, text: e.textContent?.trim()?.substring(0,50), disabled: e.disabled })));
  console.log(JSON.stringify(inputs, null, 2));
  
  console.log('\n=== Student login page ===');
  await page.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 20000 });
  await sleep(2000);
  console.log('URL:', page.url());
  const inputs2 = await page.$$eval('input, button', els => els.map(e => ({ tag: e.tagName, type: e.type, name: e.name, value: e.value, text: e.textContent?.trim()?.substring(0,50), disabled: e.disabled })));
  console.log(JSON.stringify(inputs2, null, 2));
  
  await ctx.close();
  await br.close();
}

main().catch(e => console.error(e.message));
