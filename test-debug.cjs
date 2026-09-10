const { chromium } = require('playwright');
const BASE = 'http://localhost:3000';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
  const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  
  page.on('console', m => console.log(`CONSOLE [${m.type()}]: ${m.text()}`));
  page.on('requestfailed', r => console.log(`REQ FAIL: ${r.url()}`));
  page.on('response', r => { if (r.status() >= 400) console.log(`RESP [${r.status()}]: ${r.url()}`); });
  
  // Step 1: Go to login page
  console.log('\n--- Step 1: Login page ---');
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(3000);
  console.log('URL after login page load:', page.url());
  const title = await page.title();
  console.log('Title:', title);
  
  // Check the form fields
  const fields = await page.$$eval('input', inputs => inputs.map(i => ({ type: i.type, name: i.name, id: i.id, placeholder: i.placeholder, label: (i.previousElementSibling && i.previousElementSibling.textContent) || '' })));
  console.log('Form fields:', JSON.stringify(fields, null, 2));
  
  // Step 2: Fill in login
  console.log('\n--- Step 2: Login as student ---');
  const nameInput = await page.$('input[autoComplete="name"]');
  const passInput = await page.$('input[type="password"]');
  console.log('Name input:', nameInput ? 'found' : 'NOT FOUND');
  console.log('Pass input:', passInput ? 'found' : 'NOT FOUND');
  
  if (nameInput && passInput) {
    await nameInput.fill('Test Student');
    await passInput.fill('password');
    console.log('Filled credentials');
    
    const btn = await page.$('button[type="submit"]');
    if (btn) {
      await btn.click();
      console.log('Clicked submit');
      await sleep(5000);
      console.log('URL after login attempt:', page.url());
      console.log('Title:', await page.title());
    }
  }
  
  // Step 3: Try admin login
  console.log('\n--- Step 3: Login as admin ---');
  await page.goto(BASE + '/admin/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(2000);
  console.log('Admin login URL:', page.url());
  
  const adminName = await page.$('input[autoComplete="username"]') || await page.$('input[name="username"], input[id="username"]');
  const adminPass = await page.$('input[type="password"]');
  console.log('Admin name input:', adminName ? 'found' : 'NOT FOUND');
  
  if (adminName && adminPass) {
    await adminName.fill('admin');
    await adminPass.fill('password');
    const btn = await page.$('button[type="submit"]');
    if (btn) { await btn.click(); await sleep(5000); }
    console.log('After admin login URL:', page.url());
  }
  
  await ctx.close();
  await br.close();
  console.log('\nDone');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
