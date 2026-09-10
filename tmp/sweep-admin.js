// Admin click-through sweep: every /admin page + core actions, via real Chrome.
const h = require('./harness');
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
require('dotenv').config({ path: '.env.local' });

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } });

const CLASS_NAME = 'Sweep Test Class';
const SUBJECTS = ['Sweep Biology', 'Sweep Maths'];
const STUDENT_NAME = 'Sweep Test Student';
const STUDENT_PW = 'SweepStu2026!';
const TEACHER_NAME = 'Sweep Test Teacher';
const TEACHER_USER = 'sweepteacher';
const TEACHER_PW = 'SweepPass2026!';

async function preClean() {
  // Remove leftovers from a previous aborted run (my own test data only).
  // Exact names — a prefix like 'Sweep Test%' would also match the
  // 'Sweep Test Admin' account the sweep logs in as!
  await supa.from('users').delete().in('full_name', [STUDENT_NAME, TEACHER_NAME, 'SweepStu2026!']);
  await supa.from('users').delete().eq('username', TEACHER_USER);
  const { data: cls } = await supa.from('classes').select('id').eq('name', CLASS_NAME).maybeSingle();
  if (cls) await supa.from('classes').delete().eq('id', cls.id);
  await supa.from('subjects').delete().ilike('name', 'Sweep %');
  await supa.from('announcements').delete().ilike('text', 'Sweep test notice%');
  console.log('(pre-clean done)');
}

async function section(name, fn) {
  console.log(`\n— ${name}`);
  try {
    await fn();
  } catch (e) {
    h.recordIssue('section-crash', `${name}: ${String(e).slice(0, 200)}`);
  }
}

// Poll the DB until the row matches `expect`, or record a mismatch.
async function dbWait(what, expect, timeoutMs = 20000) {
  const start = Date.now();
  let got = null;
  while (Date.now() - start < timeoutMs) {
    const { data } = await supa.from('users').select('admission_no, active, password_hash').ilike('full_name', STUDENT_NAME).maybeSingle();
    got = JSON.stringify({ adm: data ? data.admission_no : null, active: data ? data.active : null });
    if (got === JSON.stringify(expect)) { console.log(`  ✓ ${what} (db: ${got})`); return data; }
    await h.sleep(400);
  }
  h.recordIssue('db-mismatch', `${what} — expected ${JSON.stringify(expect)}, last got ${got}`);
  return null;
}

// Wait for select #(selectIndex) to offer labelText, then select it.
async function selectByLabel(page, selectIndex, labelText, timeout = 20000) {
  const start = Date.now();
  let value = null;
  while (Date.now() - start < timeout) {
    value = await page.$$eval('select', (sels, i, label) => {
      const sel = sels[i];
      if (!sel) return null;
      const opt = [...sel.options].find((o) => o.textContent.trim() === label);
      return opt ? opt.value : null;
    }, selectIndex, labelText);
    if (value) break;
    await h.sleep(300);
  }
  if (!value) { h.recordIssue('select-not-found', `no option "${labelText}" in select #${selectIndex} within ${timeout}ms`); return false; }
  const sel = (await page.$$('select'))[selectIndex];
  await sel.select(value);
  return true;
}

// Type into the nth input INSIDE the first element matching scopeSelector.
async function typeIntoScoped(page, scopeSelector, index, value) {
  const handle = await page.evaluateHandle((sel, i) => {
    const scope = document.querySelector(sel);
    if (!scope) return null;
    return scope.querySelectorAll('input')[i] || null;
  }, scopeSelector, index);
  const el = handle.asElement();
  if (!el) { h.recordIssue('input-not-found', `input #${index} not found inside ${scopeSelector}`); return false; }
  await el.click({ clickCount: 3 });
  await el.type(String(value));
  return true;
}

// Type into the nth input INSIDE the form of the card containing markerText
// (the heading sits outside the <form> element itself).
async function typeIntoForm(page, markerText, index, value) {
  const handle = await page.evaluateHandle((marker, i) => {
    const card = [...document.querySelectorAll('.card')].find((c) => c.textContent.includes(marker));
    const form = card && card.querySelector('form');
    if (!form) return null;
    return form.querySelectorAll('input')[i] || null;
  }, markerText, index);
  const el = handle.asElement();
  if (!el) { h.recordIssue('input-not-found', `input #${index} not found inside form "${markerText}"`); return false; }
  await el.click({ clickCount: 3 });
  await el.type(String(value));
  return true;
}

async function assertText(page, needle, what) {
  if (await h.waitForText(page, needle, 15000)) { console.log(`  ✓ ${what}`); return true; }
  h.recordIssue('assert-failed', `${what} — expected "${needle}" on page`);
  return false;
}

// Click a button inside the first row/card containing `needle`.
// RETRIES for up to 8s — the UI can lag the DB by ~1s after router.refresh(),
// and row buttons swap labels (Deactivate ⇄ Reactivate, Reset password hides).
// Returns true if a button was found AND clicked — never silently no-ops.
async function clickButtonInRow(page, rowSelector, needle, buttonText) {
  const start = Date.now();
  while (Date.now() - start < 8000) {
    const ok = await page.$$eval(rowSelector, (rows, n, bt) => {
      for (const row of rows) {
        if (!row.textContent.includes(n)) continue;
        const btn = [...row.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(bt));
        if (btn) { btn.click(); return true; }
      }
      return false;
    }, needle, buttonText);
    if (ok) return true;
    await h.sleep(300);
  }
  h.recordIssue('click-noop', `no "${buttonText}" button found in any ${rowSelector} containing "${needle}" within 8s`);
  return false;
}

// A row/card containing `needle` must exist in `rowSelector`.
async function expectRow(page, rowSelector, needle, what, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const found = await page.$$eval(rowSelector, (rows, n) => rows.some((r) => r.textContent.includes(n)), needle);
    if (found) { console.log(`  ✓ ${what}`); return true; }
    await h.sleep(300);
  }
  h.recordIssue('assert-failed', `${what} — no ${rowSelector} containing "${needle}"`);
  return false;
}

(async () => {
  await preClean();
  const browser = await h.launch();
  const page = await browser.newPage();
  h.monitor(page, 'admin');
  page.on('dialog', (d) => d.accept());
  page.setDefaultTimeout(20000);

  await section('login', async () => {
    if (!(await h.loginAs(page, 'admin', 'sweepadmin', 'SweepTest2026!x'))) throw new Error('admin login failed');
  });

  await section('/admin dashboard', async () => {
    await h.gotoPath(page, 'admin', '/admin');
    await assertText(page, 'Admin Desk', 'dashboard renders');
    await assertText(page, 'Current term', 'term control renders');
    await h.clickByText(page, 'button', 'Save');
    await assertText(page, 'Saved ✓', 'term save works');
  });

  await section('/admin/classes: add', async () => {
    await h.gotoPath(page, 'admin', '/admin/classes');
    await h.typeIntoNthInput(page, 0, CLASS_NAME);
    await h.clickByText(page, 'button', 'Add class');
    await assertText(page, CLASS_NAME, 'class added appears in list');
    // NOTE: real classes are NEVER deleted by this sweep. (An earlier run
    // accidentally deleted the empty 'JSS 1' via auto-accepted confirm.)
  });

  await section('/admin/subjects: add two', async () => {
    await h.gotoPath(page, 'admin', '/admin/subjects');
    for (const s of SUBJECTS) {
      await h.typeIntoNthInput(page, 0, s);
      await h.clickByText(page, 'button', 'Add subject');
      await assertText(page, s, `${s} listed`);
    }
  });

  await section('/admin/teachers: register teacher', async () => {
    await h.gotoPath(page, 'admin', '/admin/teachers');
    await h.typeIntoNthInput(page, 0, TEACHER_NAME);
    await h.typeIntoNthInput(page, 1, TEACHER_USER);
    await h.typeIntoNthInput(page, 2, 'sweepteacher@test.invalid');
    await h.typeIntoNthInput(page, 3, TEACHER_PW);
    await selectByLabel(page, 0, CLASS_NAME);
    await h.clickByText(page, 'button', 'Add teacher');
    await assertText(page, TEACHER_NAME, 'teacher listed after add');
  });

  await section('/admin/timetable: add + remove', async () => {
    await h.gotoPath(page, 'admin', '/admin/timetable');
    await selectByLabel(page, 0, CLASS_NAME);
    await h.typeIntoNthInput(page, 0, '8:00 - 8:40');
    await h.typeIntoNthInput(page, 1, 'Sweep Biology');
    await h.typeIntoNthInput(page, 2, 'Sweep Teacher');
    await h.clickByText(page, 'button', 'Add');
    await assertText(page, '8:00 - 8:40', 'timetable entry appears');
    await clickButtonInRow(page, 'tbody tr', 'Sweep Biology', 'Remove');
    await h.waitGone(page, '8:00 - 8:40');
    console.log('  ✓ timetable entry removed');
  });

  await section('/admin/announcements: post/edit/delete', async () => {
    await h.gotoPath(page, 'admin', '/admin/announcements');
    await h.sleep(1000);
    const text = await h.bodyText(page);
    if (text.includes('Could not load notices')) {
      h.recordIssue('blocked-migration', 'announcements GET 500 — expires_at migration not applied yet');
      return;
    }
    const KEEP = 'Sweep test notice (keep for student check)';
    const KILL = 'Sweep test notice (to be deleted)';
    for (const t of [KEEP, KILL]) {
      await h.typeIntoNthInput(page, 0, t);
      await h.clickByText(page, 'button', 'Post notice');
      await assertText(page, t, `notice posted: ${t.slice(16, 40)}`);
    }
    // Edit the KEEP notice: the edit form is the <form> containing a textarea.
    await expectRow(page, '.notice', KEEP, 'keep notice listed');
    await clickButtonInRow(page, '.notice', KEEP, 'Edit');
    await page.waitForFunction(() => document.querySelector('form textarea'), { timeout: 10000 });
    await page.evaluate(() => {
      const ta = document.querySelector('form textarea');
      ta.focus();
      ta.select();
    });
    await page.type('form textarea', 'Sweep test notice (edited text)');
    await page.evaluate(() => {
      const forms = [...document.querySelectorAll('form')];
      const editForm = forms.find((f) => f.querySelector('textarea'));
      const btn = [...editForm.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Save');
      if (btn) btn.click(); else throw new Error('edit-form Save not found');
    });
    await assertText(page, 'Sweep test notice (edited text)', 'notice edit saved');
    // Delete the KILL notice.
    await clickButtonInRow(page, '.notice', KILL, 'Delete');
    await h.waitGone(page, KILL);
    console.log('  ✓ notice deleted');
  });

  await section('/admin/attendance: overview', async () => {
    await h.gotoPath(page, 'admin', '/admin/attendance');
    await assertText(page, 'Attendance Overview', 'attendance page renders');
    await assertText(page, 'JSS 1', 'overview lists real classes');
    await assertText(page, CLASS_NAME, 'overview lists test class');
  });

  await section('register student via AddStudentForm', async () => {
    await h.gotoPath(page, 'admin', '/admin');
    // NOTE: type inside the AddStudentForm — the page's first input is the
    // TermControl term box, so page-wide input indexing is off by one.
    await typeIntoForm(page, 'Register a student', 0, STUDENT_NAME);
    await typeIntoForm(page, 'Register a student', 1, STUDENT_PW);
    await typeIntoForm(page, 'Register a student', 2, 'SWP-001'); // admission no
    await selectByLabel(page, 0, CLASS_NAME);
    await selectByLabel(page, 1, 'Science');
    await typeIntoForm(page, 'Register a student', 3, '5000'); // term fee
    // NDPR face-consent checkbox (required) — only checkbox on the page.
    await page.evaluate(() => {
      const cb = document.querySelector('input[type=checkbox]');
      if (cb && !cb.checked) cb.click();
    });
    await h.sleep(300);
    await h.clickByText(page, 'button', 'Add student');
    await assertText(page, STUDENT_NAME, 'student appears in table');
  });

  await section('StudentTable: edit/deactivate/reactivate/reset', async () => {
    // 1. Edit admission number (UI doesn't display it — verify via DB).
    const before = await dbWait('snapshot before edits', { adm: 'SWP-001', active: true });
    await expectRow(page, 'tbody tr', STUDENT_NAME, 'student row present');
    await clickButtonInRow(page, 'tbody tr', STUDENT_NAME, 'Edit');
    await page.waitForSelector('.edit-row', { timeout: 10000 });
    await typeIntoScoped(page, '.edit-row', 1, 'SWP-002');
    // Scope the click to the edit form — page-wide 'Save' hits TermControl first.
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.edit-row button')].find((b) => b.textContent.trim() === 'Save');
      if (btn) btn.click(); else throw new Error('edit-row Save button not found');
    });
    await dbWait('edit saved', { adm: 'SWP-002', active: true });

    // 2. Deactivate (UI shows the Inactive tag — uppercase via CSS text-transform).
    await expectRow(page, 'tbody tr', STUDENT_NAME, 'row re-rendered after edit');
    await clickButtonInRow(page, 'tbody tr', STUDENT_NAME, 'Deactivate');
    await dbWait('deactivate landed', { adm: 'SWP-002', active: false });
    if (await h.waitForText(page, ['Inactive', 'INACTIVE'], 15000)) console.log('  ✓ inactive tag shown');
    else h.recordIssue('assert-failed', 'inactive tag shown — expected Inactive/INACTIVE on page');

    // 3. Reactivate (row list re-renders on refresh — re-locate it first).
    await expectRow(page, 'tbody tr', STUDENT_NAME, 'row re-rendered after deactivate');
    await clickButtonInRow(page, 'tbody tr', STUDENT_NAME, 'Reactivate');
    await dbWait('reactivate landed', { adm: 'SWP-002', active: true });
    await h.waitGone(page, 'INACTIVE');
    console.log('  ✓ inactive tag cleared');

    // 4. Reset password modal (submit is the modal's 'Reset password' button —
    // the row's trigger has the same label, so pick the LAST match).
    const oldHash = (before || {}).password_hash;
    await expectRow(page, 'tbody tr', STUDENT_NAME, 'row re-rendered after reactivate');
    await clickButtonInRow(page, 'tbody tr', STUDENT_NAME, 'Reset password');
    await page.waitForFunction(() => document.body.innerText.includes('Reset password for'), { timeout: 10000 });
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Reset password');
      btns[btns.length - 1].click();
    });
    await assertText(page, 'Password updated', 'password reset modal works');
    const { data: afterPw } = await supa.from('users').select('password_hash').ilike('full_name', STUDENT_NAME).maybeSingle();
    if (oldHash && afterPw.password_hash !== oldHash) console.log('  ✓ password hash changed in DB');
    else if (oldHash) h.recordIssue('db-mismatch', 'password hash unchanged after reset');
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Close');
      if (btn) btn.click();
    });
  });

  await browser.close();
  console.log('\n=== ADMIN SWEEP DONE ===');
  console.log('Issues:', h.issues.length);
  h.issues.forEach((i) => console.log(` - [${i.kind}] ${i.detail}`));
  process.exit(0);
})().catch((e) => { console.error('SWEEP CRASHED:', e); process.exit(1); });
