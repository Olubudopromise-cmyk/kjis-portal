// Student dashboard click-through sweep: all 8 tabs, incl. Report Card, Fees polling, AI, Notices.
const h = require('./harness');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const ws = require('ws');
require('dotenv').config({ path: '.env.local' });

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } });

const STUDENT_NAME = 'Sweep Test Student';
const STUDENT_PW = 'SweepStu2026!';

async function section(name, fn) {
  console.log(`\n— ${name}`);
  try {
    await fn();
  } catch (e) {
    h.recordIssue('section-crash', `${name}: ${String(e).slice(0, 200)}`);
  }
}

async function clickTab(page, label) {
  const ok = await page.evaluate((l) => {
    const btn = [...document.querySelectorAll('.tab-btn')].find((b) => b.textContent.trim() === l);
    if (!btn) return false;
    btn.click();
    return true;
  }, label);
  if (!ok) h.recordIssue('click-not-found', `tab "${label}" not found`);
  return ok;
}

async function assertText(page, needles, what) {
  const ok = await h.waitForText(page, Array.isArray(needles) ? needles : [needles], 15000);
  if (ok) { console.log(`  ✓ ${what}`); return true; }
  h.recordIssue('assert-failed', `${what} — expected ${JSON.stringify(needles)} on page`);
  return false;
}

async function dbPoll(what, test, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data } = await supa.from('users').select('*').ilike('full_name', STUDENT_NAME).maybeSingle();
    if (test(data)) { console.log(`  ✓ ${what}`); return data; }
    await h.sleep(400);
  }
  h.recordIssue('assert-failed', `${what} — DB condition not met within ${timeoutMs}ms`);
  return null;
}

// Hard timeout so a hung browser can never wedge the sweep silently.
setTimeout(() => { console.error('HARD TIMEOUT after 4m — aborting'); process.exit(1); }, 240000).unref();

(async () => {
  // The teacher Manage-tab sweep resets this student's password to the modal's
  // suggested value — restore ours so the student login works.
  const hash = bcrypt.hashSync(STUDENT_PW, 10);
  await supa.from('users').update({ password_hash: hash }).ilike('full_name', STUDENT_NAME);
  console.log('(password restored for sweep student)');

  const browser = await h.launch();
  const page = await browser.newPage();
  h.monitor(page, 'student');
  page.on('dialog', (d) => d.accept());
  page.setDefaultTimeout(20000);

  await section('login as sweep student', async () => {
    if (!(await h.loginAs(page, 'student', STUDENT_NAME, STUDENT_PW))) throw new Error('student login failed');
  });

  await section('Overview tab', async () => {
    await assertText(page, 'Fee balance', 'overview renders');
  });

  await section('Attendance tab (shows teacher-marked record)', async () => {
    await clickTab(page, 'Attendance');
    await assertText(page, ['Days present', 'Attendance rate'], 'attendance view renders');
    await assertText(page, 'present', 'teacher-marked "present" record listed');
  });

  await section('Fees & Payments tab', async () => {
    await clickTab(page, 'Fees & Payments');
    await assertText(page, 'Make a payment', 'payment form renders');
    await assertText(page, 'Pay with Paystack', 'Paystack button present');
    await assertText(page, 'Current balance', 'balance card renders');
    // Submit a payment without a configured key → expect the clean config error.
    await page.evaluate(() => {
      const input = [...document.querySelectorAll('input[type=number]')][0];
      const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      proto.set.call(input, '1000');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Pay with Paystack'));
      btn.click();
    });
    await assertText(page, 'Payment processing is not configured', 'clean config error (no PAYSTACK key)');
  });

  await section('Fees polling: simulate returning from checkout (?paid=1)', async () => {
    // Navigate back with ?paid=1 (as Paystack's callback_url does) and bump
    // `paid` in the DB mid-poll; the component polls /api/students/me.
    await page.goto('http://localhost:3000/student?paid=1', { waitUntil: 'networkidle2' });
    await h.sleep(2000); // let React hydrate so the tab click actually registers
    await clickTab(page, 'Fees & Payments');
    const active = await page.evaluate(() => document.querySelector('.tab-btn.active')?.textContent.trim());
    if (active !== 'Fees & Payments') h.recordIssue('assert-failed', `fees tab not active after click (got "${active}")`);
    // Prove the interval is alive before bumping — otherwise the bump races.
    const alive = await page.waitForRequest((r) => r.url().includes('/api/students/me'), { timeout: 8000 }).then(() => true).catch(() => false);
    if (!alive) { h.recordIssue('assert-failed', 'polling interval never fired'); return; }
    setTimeout(async () => {
      await supa.from('users').update({ paid: 3000 }).ilike('full_name', STUDENT_NAME);
      console.log('  (paid -> 3000 in DB mid-poll)');
    }, 500);
    const confirmed = await h.waitForText(page, 'Payment confirmed', 12000);
    if (confirmed) {
      console.log('  ✓ polling detected the payment and showed confirmation banner');
      const url = page.url();
      if (!/[?&]paid=1/.test(url)) console.log('  ✓ paid=1 stripped from URL');
      else h.recordIssue('assert-failed', `paid=1 still in URL: ${url}`);
      // Restore paid to 0 so DB cleanup is trivial.
      await supa.from('users').update({ paid: 0 }).ilike('full_name', STUDENT_NAME);
      await dbPoll('paid restored to 0', (d) => d && d.paid === 0, 5000);
    } else {
      h.recordIssue('assert-failed', 'payment-confirmed banner never appeared during polling window');
    }
  });

  await section('Report Card tab (scored, with class position)', async () => {
    await clickTab(page, 'Report Card');
    await assertText(page, 'Termly Report Card', 'report card renders');
    await assertText(page, 'Sweep Biology', 'subjects listed from category');
    await assertText(page, '75', 'total renders (CA 30 + exam 45)');
    await assertText(page, 'Class Position', 'class position renders');
    await assertText(page, 'Test & Exam History', 'assessment history section renders');
  });

  await section('My Subjects tab', async () => {
    await clickTab(page, 'My Subjects');
    await assertText(page, 'Subjects — Science', 'subjects view renders with category');
    await assertText(page, 'Sweep Biology', 'sweep subject listed');
  });

  await section('Timetable tab', async () => {
    await clickTab(page, 'Timetable');
    await assertText(page, ['No timetable', 'Monday'], 'timetable view renders (empty or populated)');
  });

  await section('Ask AI Tutor tab (no API key → clean error)', async () => {
    await clickTab(page, 'Ask AI Tutor');
    await assertText(page, 'AI Study Assistant', 'AI chat renders');
    await page.type('.chat-input-row input', 'What is photosynthesis?');
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Send');
      btn.click();
      return true;
    });
    await assertText(page, 'AI tutor is not configured', 'clean config error (no ANTHROPIC key)');
  });

  await section('Notices tab', async () => {
    await clickTab(page, 'Notices');
    await assertText(page, ['Sweep test notice (edited text)', 'No notices yet'], 'notices view renders (migration-gated)');
  });

  await browser.close();
  console.log('\n=== STUDENT SWEEP DONE ===');
  console.log('Issues:', h.issues.length);
  h.issues.forEach((i) => console.log(` - [${i.kind}] ${i.detail}`));
  process.exit(0);
})().catch((e) => { console.error('SWEEP CRASHED:', e); process.exit(1); });
