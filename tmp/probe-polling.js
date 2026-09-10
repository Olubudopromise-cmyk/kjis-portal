// Debug: why doesn't the ?paid=1 polling start after clicking the Fees tab?
const h = require('./harness');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
require('dotenv').config({ path: '.env.local' });

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } });
const STUDENT_NAME = 'Sweep Test Student';

(async () => {
  await supa.from('users').update({ paid: 0 }).ilike('full_name', STUDENT_NAME);
  const hash = bcrypt.hashSync('SweepStu2026!', 10);
  await supa.from('users').update({ password_hash: hash }).ilike('full_name', STUDENT_NAME);

  const browser = await h.launch();
  const page = await browser.newPage();
  h.monitor(page, 'poll');
  page.setDefaultTimeout(20000);

  // Log every request the page makes.
  page.on('request', (req) => {
    const u = req.url();
    if (!/_next\/static|webpack-hmr|favicon/.test(u)) console.log('   >>', req.method(), u.replace('http://localhost:3000', ''));
  });

  await h.loginAs(page, 'student', STUDENT_NAME, 'SweepStu2026!');
  await page.goto('http://localhost:3000/student?paid=1', { waitUntil: 'networkidle2' });
  await h.sleep(1000);

  const before = await page.evaluate(() => ({
    url: window.location.href,
    tabs: [...document.querySelectorAll('.tab-btn')].map((b) => b.textContent.trim()),
  }));
  console.log('before click:', JSON.stringify(before));

  await page.evaluate(() => { [...document.querySelectorAll('.tab-btn')].find((b) => b.textContent.trim() === 'Fees & Payments').click(); });
  await h.sleep(1500);

  const after = await page.evaluate(() => ({
    url: window.location.href,
    search: window.location.search,
    body: document.body.innerText.slice(0, 300).replace(/\n+/g, ' | '),
  }));
  console.log('after click:', JSON.stringify(after, null, 2));

  // Wait ~6s of polling, then dump requests + DB.
  await h.sleep(6000);
  const { data } = await supa.from('users').select('paid').ilike('full_name', STUDENT_NAME).maybeSingle();
  console.log('db paid:', data.paid);
  console.log('final body:', (await h.bodyText(page)).slice(0, 300).replace(/\n+/g, ' | '));

  await browser.close().catch(() => {});
  process.exit(0);
})().catch((e) => { console.error('POLL DBG CRASHED:', String(e).slice(0, 300)); process.exit(1); });
