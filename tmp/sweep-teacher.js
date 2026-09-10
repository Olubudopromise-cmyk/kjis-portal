// Teacher dashboard click-through sweep: Attendance, Results (+ assessments), Fee Status, Manage.
const h = require('./harness');
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
require('dotenv').config({ path: '.env.local' });

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } });

const STUDENT_NAME = 'Sweep Test Student';

async function section(name, fn) {
  console.log(`\n— ${name}`);
  try {
    await fn();
  } catch (e) {
    h.recordIssue('section-crash', `${name}: ${String(e).slice(0, 200)}`);
  }
}

// Poll until `test` returns truthy.
async function poll(what, test, timeoutMs = 15000, interval = 400) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = await test();
    if (v) { console.log(`  ✓ ${what}`); return v; }
    await h.sleep(interval);
  }
  h.recordIssue('assert-failed', `${what} — condition not met within ${timeoutMs}ms`);
  return null;
}

async function assertText(page, needles, what) {
  const ok = await h.waitForText(page, Array.isArray(needles) ? needles : [needles], 15000);
  if (ok) { console.log(`  ✓ ${what}`); return true; }
  h.recordIssue('assert-failed', `${what} — expected ${JSON.stringify(needles)} on page`);
  return false;
}

(async () => {
  const browser = await h.launch();
  const page = await browser.newPage();
  h.monitor(page, 'teacher');
  page.on('dialog', (d) => d.accept());
  page.setDefaultTimeout(20000);

  await section('login', async () => {
    if (!(await h.loginAs(page, 'teacher', 'sweepteacher', 'SweepPass2026!'))) throw new Error('teacher login failed');
  });

  const today = new Date().toISOString().slice(0, 10);

  await section('Attendance tab: mark + save', async () => {
    await h.gotoPath(page, 'teacher', '/teacher');
    await assertText(page, 'Mark attendance', 'attendance tab renders');
    await assertText(page, STUDENT_NAME, 'roster shows sweep student');
    // Mark present.
    const clicked = await page.evaluate((name) => {
      const row = [...document.querySelectorAll('.att-row')].find((r) => r.textContent.includes(name));
      const btn = [...(row ? row.querySelectorAll('button') : [])].find((b) => b.textContent.trim() === 'Present');
      if (!btn) return false;
      btn.click();
      return true;
    }, STUDENT_NAME);
    if (!clicked) h.recordIssue('click-noop', 'Present button not found for sweep student');
    // Save.
    const saveBtn = await page.evaluateHandle(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.startsWith('Save attendance for'));
      if (!btn) throw new Error('save button not found');
      return btn;
    });
    await (saveBtn.asElement() || saveBtn).click();
    await assertText(page, 'Saved ✓', 'attendance saved UI');
    // DB check.
    const { data: stu } = await supa.from('users').select('id').ilike('full_name', STUDENT_NAME).maybeSingle();
    await poll('attendance row in DB', async () => {
      const { data } = await supa.from('attendance').select('status').eq('student_id', stu.id).eq('date', today).maybeSingle();
      return data && data.status === 'present';
    });
  });

  await section('Results tab: scores + save', async () => {
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.tab-btn')].find((b) => b.textContent.trim() === 'Enter Results');
      btn.click();
    });
    await assertText(page, 'Enter results', 'results tab renders');
    await assertText(page, 'Sweep Biology', 'subject list populated (Science category)');
    // Type CA + exam for Sweep Biology.
    const typed = await page.evaluate(() => {
      const row = [...document.querySelectorAll('tbody tr')].find((r) => r.textContent.includes('Sweep Biology'));
      if (!row) return false;
      const inputs = row.querySelectorAll('.score-input');
      if (inputs.length < 2) return false;
      const set = (el, v) => {
        const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
        proto.set.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      set(inputs[0], '30');
      set(inputs[1], '45');
      return true;
    });
    if (!typed) h.recordIssue('input-not-found', 'score inputs not found for Sweep Biology');
    await h.sleep(200);
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.startsWith('Save results for'));
      if (!btn) throw new Error('save results button not found');
      btn.click();
    });
    await assertText(page, 'Saved ✓', 'results saved UI');
    const { data: stu } = await supa.from('users').select('id').ilike('full_name', STUDENT_NAME).maybeSingle();
    await poll('result rows in DB', async () => {
      const { data } = await supa.from('results').select('ca, exam').eq('student_id', stu.id).eq('subject', 'Sweep Biology').maybeSingle();
      return data && Number(data.ca) === 30 && Number(data.exam) === 45;
    });
  });

  await section('Results tab: assessments (add + delete)', async () => {
    const migrationBlocked = await page.evaluate(() => document.body.innerText.includes('No tests or exams recorded yet'));
    // Fill the add-assessment row.
    const fill = await page.evaluate(() => {
      const label = [...document.querySelectorAll('input')].find((i) => i.placeholder && i.placeholder.includes('Label e.g.'));
      const score = [...document.querySelectorAll('input')].find((i) => i.placeholder === 'Score');
      const max = [...document.querySelectorAll('input')].find((i) => i.placeholder === 'Max');
      if (!label || !score || !max) return false;
      const set = (el, v) => {
        const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
        proto.set.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set(label, 'Test 1');
      set(score, '25');
      set(max, '100');
      return true;
    });
    if (!fill) { h.recordIssue('input-not-found', 'assessment inputs not found'); return; }
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Add');
      if (btn) btn.click();
    });
    // The POST hits /api/assessments — 500 until migration 009 is applied.
    const appeared = await poll('assessment row appears', async () => {
      const txt = await h.bodyText(page);
      return txt.includes('Test 1') && txt.includes('25 / 100');
    }, 8000).catch(() => null);
    if (!appeared) {
      h.recordIssue('blocked-migration', 'assessment POST/GET 500 — assessments migration not applied yet');
      return;
    }
    // Delete it.
    await page.evaluate(() => {
      const row = [...document.querySelectorAll('tbody tr')].find((r) => r.textContent.includes('Test 1'));
      const btn = [...(row ? row.querySelectorAll('button') : [])].find((b) => b.textContent.trim() === 'Delete');
      if (btn) btn.click();
    });
    await poll('assessment deleted from UI', async () => {
      const txt = await h.bodyText(page);
      return !txt.includes('Test 1');
    }, 8000);
    const { data: stu } = await supa.from('users').select('id').ilike('full_name', STUDENT_NAME).maybeSingle();
    await poll('assessment gone from DB', async () => {
      const { data } = await supa.from('assessments').select('id').eq('student_id', stu.id).eq('label', 'Test 1').maybeSingle();
      return data === null;
    }, 8000);
  });

  await section('Fee Status tab', async () => {
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.tab-btn')].find((b) => b.textContent.trim() === 'Fee Status');
      btn.click();
    });
    await assertText(page, 'Total Fee', 'fee table renders');
    await assertText(page, STUDENT_NAME, 'student listed in fee table');
    await assertText(page, 'Owing', 'owing tag shown (fee 5000, paid 0)');
  });

  await section('Manage tab: reset password modal', async () => {
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.tab-btn')].find((b) => b.textContent.trim() === 'Manage');
      btn.click();
    });
    await assertText(page, 'Manage students', 'manage tab renders');
    const { data: before } = await supa.from('users').select('password_hash').ilike('full_name', STUDENT_NAME).maybeSingle();
    await page.evaluate((name) => {
      const row = [...document.querySelectorAll('tbody tr')].find((r) => r.textContent.includes(name));
      const btn = [...(row ? row.querySelectorAll('button') : [])].find((b) => b.textContent.trim() === 'Reset password');
      if (btn) btn.click();
    }, STUDENT_NAME);
    await page.waitForFunction(() => document.body.innerText.includes('Reset password for'), { timeout: 10000 });
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Reset password');
      btns[btns.length - 1].click();
    });
    await assertText(page, 'Password updated', 'teacher can reset student password');
    const { data: after } = await supa.from('users').select('password_hash').ilike('full_name', STUDENT_NAME).maybeSingle();
    if (after.password_hash !== before.password_hash) console.log('  ✓ password hash changed in DB');
    else h.recordIssue('db-mismatch', 'password hash unchanged after teacher reset');
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Close');
      if (btn) btn.click();
    });
  });

  await browser.close();
  console.log('\n=== TEACHER SWEEP DONE ===');
  console.log('Issues:', h.issues.length);
  h.issues.forEach((i) => console.log(` - [${i.kind}] ${i.detail}`));
  process.exit(0);
})().catch((e) => { console.error('SWEEP CRASHED:', e); process.exit(1); });
