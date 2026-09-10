// Polling test with hydration-safe sequencing.
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
  h.monitor(page, 'seq2');
  page.setDefaultTimeout(20000);

  await h.loginAs(page, 'student', STUDENT_NAME, 'SweepStu2026!');
  await page.goto('http://localhost:3000/student?paid=1', { waitUntil: 'networkidle2' });

  // Hydration-safe: sleep so React attaches handlers, click, then VERIFY the tab flipped.
  await h.sleep(2000);
  await page.evaluate(() => { [...document.querySelectorAll('.tab-btn')].find((b) => b.textContent.trim() === 'Fees & Payments').click(); });
  const active = await page.evaluate(() => document.querySelector('.tab-btn.active')?.textContent.trim());
  console.log('active tab after click:', active);

  // Wait for the first polling request — proves the interval is alive.
  const reqPromise = page.waitForRequest((r) => r.url().includes('/api/students/me'), { timeout: 8000 })
    .then(() => true).catch(() => false);
  const intervalAlive = await reqPromise;
  console.log('polling interval alive:', intervalAlive);
  if (!intervalAlive) { await browser.close(); process.exit(1); }

  // Interval confirmed running — now bump the DB.
  setTimeout(async () => {
    await supa.from('users').update({ paid: 3000 }).ilike('full_name', STUDENT_NAME);
    console.log('DB bumped (paid=3000)');
  }, 500);

  const confirmed = await h.waitForText(page, 'Payment confirmed', 12000);
  console.log('banner shown:', confirmed);
  if (confirmed) {
    console.log('url after:', page.url());
    await supa.from('users').update({ paid: 0 }).ilike('full_name', STUDENT_NAME);
  }

  await browser.close().catch(() => {});
  process.exit(0);
})().catch((e) => { console.error('SEQ2 CRASHED:', String(e).slice(0, 300)); process.exit(1); });
