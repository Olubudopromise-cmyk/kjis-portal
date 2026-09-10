// Isolate: does the StudentTable row re-render after toggleActive + router.refresh()?
const h = require('./harness');
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
require('dotenv').config({ path: '.env.local' });

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } });
const STUDENT_NAME = 'Sweep Test Student';

(async () => {
  // Ensure a known starting state: student is active with SWP-002.
  await supa.from('users').update({ active: true, admission_no: 'SWP-002' }).ilike('full_name', STUDENT_NAME);
  console.log('DB reset: active=true, adm=SWP-002');

  const browser = await h.launch();
  const page = await browser.newPage();
  h.monitor(page, 'probe');
  page.on('dialog', (d) => d.accept());
  page.setDefaultTimeout(20000);

  await h.loginAs(page, 'admin', 'sweepadmin', 'SweepTest2026!x');
  await h.gotoPath(page, 'probe', '/admin');

  const state = async () =>
    page.evaluate((name) => {
      const row = [...document.querySelectorAll('tbody tr')].find((r) => r.textContent.includes(name));
      if (!row) return { row: false };
      const txt = row.textContent;
      return {
        row: true,
        inactiveTag: txt.includes('Inactive'),
        buttons: [...row.querySelectorAll('button')].map((b) => b.textContent.trim()),
      };
    }, STUDENT_NAME);

  console.log('\ninitial UI state:', JSON.stringify(await state()));

  // Click Deactivate with full tracing.
  const clicked = await page.evaluate((name) => {
    const row = [...document.querySelectorAll('tbody tr')].find((r) => r.textContent.includes(name));
    const btn = [...row.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Deactivate'));
    if (!btn) return null;
    btn.click();
    return true;
  }, STUDENT_NAME);
  console.log('deactivate click:', clicked);

  // Wait for the PATCH to land in DB.
  let dbInactive = false;
  let dbMs = 0;
  for (let i = 0; i < 25; i++) {
    await h.sleep(400);
    dbMs += 400;
    const { data } = await supa.from('users').select('active').ilike('full_name', STUDENT_NAME).maybeSingle();
    if (data && data.active === false) { dbInactive = true; break; }
  }
  console.log('db active=false reached:', dbInactive, `(${dbMs}ms)`);

  // Then poll UI for up to 12s more.
  let uiInactive = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 12000) {
    const s = await state();
    if (s.inactiveTag) { uiInactive = true; break; }
    await h.sleep(400);
  }
  console.log('UI shows Inactive within 12s:', uiInactive, `(${Date.now() - t0}ms)`);
  if (!uiInactive) {
    console.log('UI state at timeout:', JSON.stringify(await state()));
    // Also check: does a manual reload show it?
    await page.reload({ waitUntil: 'networkidle2' });
    await h.sleep(800);
    console.log('after manual reload:', JSON.stringify(await state()));
  }

  await browser.close();
  process.exit(0);
})().catch((e) => { console.error('PROBE CRASHED:', e); process.exit(1); });
