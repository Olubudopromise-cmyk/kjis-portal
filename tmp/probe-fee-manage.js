// Focused: Fee Status + Manage tabs in a fresh browser, with liveness checks.
const h = require('./harness');
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
require('dotenv').config({ path: '.env.local' });

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } });
const STUDENT_NAME = 'Sweep Test Student';

(async () => {
  const browser = await h.launch();
  const page = await browser.newPage();
  h.monitor(page, 'fee');
  page.setDefaultTimeout(20000);

  await h.loginAs(page, 'teacher', 'sweepteacher', 'SweepPass2026!');
  await h.gotoPath(page, 'fee', '/teacher');
  await h.waitForText(page, 'Mark attendance', 15000);

  const alive = () => `pageClosed=${page.isClosed()} browserUp=${browser.isConnected()}`;

  // Fee Status.
  await page.evaluate(() => { [...document.querySelectorAll('.tab-btn')].find((b) => b.textContent.trim() === 'Fee Status').click(); });
  let feeOk = await h.waitForText(page, 'Total Fee', 10000);
  console.log('fee table renders:', feeOk, alive());
  if (feeOk) {
    const txt = await h.bodyText(page);
    console.log('  student listed:', txt.includes(STUDENT_NAME));
    console.log('  owing tag:', txt.includes('Owing'));
  }

  // Manage.
  await page.evaluate(() => { [...document.querySelectorAll('.tab-btn')].find((b) => b.textContent.trim() === 'Manage').click(); });
  const mgOk = await h.waitForText(page, 'Manage students', 10000);
  console.log('manage tab renders:', mgOk, alive());
  if (mgOk) {
    const { data: before } = await supa.from('users').select('password_hash').ilike('full_name', STUDENT_NAME).maybeSingle();
    await page.evaluate((name) => {
      const row = [...document.querySelectorAll('tbody tr')].find((r) => r.textContent.includes(name));
      const btn = [...(row ? row.querySelectorAll('button') : [])].find((b) => b.textContent.trim() === 'Reset password');
      if (btn) btn.click();
    }, STUDENT_NAME);
    const modal = await h.waitForText(page, 'Reset password for', 10000);
    console.log('modal opened:', modal, alive());
    if (modal) {
      await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Reset password');
        btns[btns.length - 1].click();
      });
      const done = await h.waitForText(page, 'Password updated', 10000);
      console.log('password updated msg:', done);
      const { data: after } = await supa.from('users').select('password_hash').ilike('full_name', STUDENT_NAME).maybeSingle();
      console.log('hash changed:', before.password_hash !== after.password_hash);
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Close');
        if (btn) btn.click();
      });
    }
  }

  await browser.close().catch(() => {});
  process.exit(0);
})().catch((e) => { console.error('FEE DBG CRASHED:', String(e).slice(0, 300)); process.exit(1); });
