// Reproduce the EXACT sweep sequence for the polling section, with timestamps.
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
  h.monitor(page, 'seq');
  page.setDefaultTimeout(20000);

  const t0 = Date.now();
  const log = (m) => console.log(`[+${String(Math.round((Date.now() - t0) / 100) / 10).padStart(5)}s] ${m}`);
  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('/api/students/me') || u.includes('/student?paid')) log(`REQ ${req.method()} ${u.replace('http://localhost:3000', '')}`);
  });

  await h.loginAs(page, 'student', STUDENT_NAME, 'SweepStu2026!');
  log('logged in');

  // Mimic sweep: visit Fees tab first (config-error test), then goto ?paid=1.
  await h.waitForText(page, 'Fee balance', 15000);
  await page.evaluate(() => { [...document.querySelectorAll('.tab-btn')].find((b) => b.textContent.trim() === 'Fees & Payments').click(); });
  log('clicked Fees (config test)');

  await page.goto('http://localhost:3000/student?paid=1', { waitUntil: 'networkidle2' });
  log('goto ?paid=1 done');
  await h.waitForText(page, 'Fee balance', 15000);
  log('Fee balance visible');
  await page.evaluate(() => { [...document.querySelectorAll('.tab-btn')].find((b) => b.textContent.trim() === 'Fees & Payments').click(); });
  log('clicked Fees again');

  setTimeout(async () => {
    log('DB bump starting…');
    await supa.from('users').update({ paid: 3000 }).ilike('full_name', STUDENT_NAME);
    log('DB bump DONE (paid=3000)');
  }, 2500);

  const confirmed = await h.waitForText(page, 'Payment confirmed', 14000);
  log(`banner: ${confirmed}`);
  if (!confirmed) {
    const txt = await h.bodyText(page);
    log(`body has "Still confirming": ${txt.includes('Still confirming')}`);
  }
  const { data } = await supa.from('users').select('paid').ilike('full_name', STUDENT_NAME).maybeSingle();
  log(`db paid now: ${data.paid}`);

  await browser.close().catch(() => {});
  process.exit(0);
})().catch((e) => { console.error('SEQ CRASHED:', String(e).slice(0, 300)); process.exit(1); });
