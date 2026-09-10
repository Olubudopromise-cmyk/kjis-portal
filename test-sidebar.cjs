const { chromium } = require('playwright');
const BASE = 'http://localhost:3000';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function loginAs(page, type) {
  const creds = {
    student:  { page: '/login',         identifier: 'Test Student', password: 'password', buttonText: 'Sign in as Student' },
    teacher:  { page: '/teacher/login', identifier: 'teacher',      password: 'password', buttonText: 'Sign in as Teacher' },
    admin:    { page: '/admin/login',   identifier: 'admin',        password: 'password', buttonText: 'Sign in as Head Admin' },
  }[type];

  await page.goto(BASE + creds.page, { waitUntil: 'networkidle', timeout: 20000 });
  await sleep(3000);

  // Try multiple selectors for the identifier field
  const identifierField = await page.$('input[autoComplete="name"]') || await page.$('input[autoComplete="username"]') || await page.$('input[type="text"]') || await page.$('input:first-of-type');
  const passwordField = await page.$('input[type="password"]');
  const submitBtn = await page.$('button:has-text("Sign in")') || await page.$('button[type="submit"]');

  if (!identifierField || !passwordField || !submitBtn) {
    console.log(`  WARNING: Could not find form fields for ${type} on ${creds.page}`);
    return false;
  }

  await identifierField.fill(creds.identifier);
  await passwordField.fill(creds.password);
  await submitBtn.click();
  await sleep(5000);

  // If still on login page, login failed
  if (page.url().includes(creds.page)) {
    // Check if there's an error message
    const errEl = await page.$('.error-msg');
    const errText = errEl ? await errEl.textContent() : 'no error element';
    console.log(`  Login FAILED for ${type}, still on ${creds.page} (error: ${errText})`);
    // Show any error message
    const err = await page.$('.error-msg');
    if (err) console.log(`    Error: ${await err.textContent()}`);
    return false;
  }

  console.log(`  Logged in as ${type} → ${page.url()}`);
  return true;
}

async function testPortal(type, portalUrl, sections) {
  console.log(`\n=== ${type} portal ===`);
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
  const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(`${type}: ${m.text()}`); });
  page.on('pageerror', e => errors.push(`${type} PAGE: ${e.message}`));

  const loggedIn = await loginAs(page, type);
  if (!loggedIn) {
    console.log(`  SKIPPING — could not log in`);
    await ctx.close();
    await br.close();
    return;
  }

  // Navigate to portal
  await page.goto(BASE + portalUrl, { waitUntil: 'networkidle', timeout: 15000 });
  await sleep(2000);

  const sb = await page.$('.sidebar');
  console.log(`  sidebar: ${sb ? 'YES' : 'NO'}`);
  const ham = await page.$('.sidebar-hamburger');
  console.log(`  hamburger: ${ham ? 'YES' : 'NO'}`);

  for (const [label, check] of sections) {
    try {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const item = await page.locator(`.sidebar-item`, { hasText: new RegExp('^' + escaped + '$') }).first();
      const visible = await item.isVisible({ timeout: 3000 }).catch(() => false);
      if (!visible) { console.log(`  ✗ "${label}" not in sidebar`); continue; }
      await item.click();
      await sleep(2000);
      const u = page.url();
      const ok = u.startsWith(BASE);
      console.log(`  "${label}" → ${ok ? 'OK' : 'LEFT SITE'}: ${u}`);
      if (check) {
        const el = await page.$(check);
        console.log(`    content ${check}: ${el ? 'FOUND' : 'missing'}`);
      }
    } catch (e) { console.log(`  ✗ "${label}": ${e.message}`); }
  }

  if (errors.length) {
    console.log(`  ERRORS (${errors.length}):`);
    for (const e of errors) console.log(`    - ${e}`);
  } else {
    console.log(`  no console errors`);
  }

  await ctx.close();
  await br.close();
}

async function main() {
  await testPortal('student', '/student', [
    ['Overview', '.grid.g3'],
    ['Attendance', '.card'],
    ['Fees & Payments', '.card'],
    ['Report Card', '.card'],
    ['My Subjects', '.card'],
    ['Timetable', '.card'],
    ['Ask AI Tutor', '.chat-log'],
    ['Notices', '.card'],
    ['Sign out', null],
  ]);

  await testPortal('teacher', '/teacher', [
    ['Overview', '.grid.g3'],
    ['Mark Attendance', '.card'],
    ['Enter Results', '.card'],
    ['Fee Status', '.card'],
    ['Manage', '.card'],
    ['Sign out', null],
  ]);

  await testPortal('admin', '/admin', [
    ['Overview', '.grid.g3'],
    ['Classes', '.card'],
    ['Categories & Subjects', '.card'],
    ['Teachers', '.card'],
    ['Timetable', '.card'],
    ['Attendance', '.card'],
    ['Notices', '.card'],
    ['Sign out', null],
  ]);

  // Admin sub-pages
  console.log('\n=== admin sub-pages ===');
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
  const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await loginAs(page, 'admin');

  const subs = [
    ['/admin/classes', 'Classes'],
    ['/admin/subjects', 'Subjects'],
    ['/admin/teachers', 'Teachers'],
    ['/admin/timetable', 'Timetable'],
    ['/admin/announcements', 'Notices'],
    ['/admin/attendance', 'Attendance'],
  ];
  for (const [url, name] of subs) {
    await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 15000 });
    await sleep(2500);
    const h2 = await page.$('.page-head h2');
    const txt = h2 ? (await h2.textContent()).trim() : 'NONE';
    const sb = await page.$('.sidebar');
    console.log(`  ${name}: h2="${txt}" sidebar=${sb ? 'YES' : 'NO'}`);
  }
  await ctx.close();
  await br.close();

  // Mobile drawer
  console.log('\n=== mobile drawer ===');
  const br2 = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
  const ctx2 = await br2.newContext({ viewport: { width: 480, height: 800 } });
  const page2 = await ctx2.newPage();
  await loginAs(page2, 'student');
  await page2.setViewportSize({ width: 480, height: 800 });
  await page2.goto(BASE + '/student', { waitUntil: 'networkidle', timeout: 15000 });
  await sleep(3000);

  const ham = await page2.$('.sidebar-hamburger');
  if (ham) {
    await ham.click();
    await sleep(800);
    const open = await page2.$('.sidebar--open');
    console.log(`  drawer opens: ${open ? 'YES' : 'NO'}`);
    if (open) {
      const item = await page2.locator('.sidebar-item', { hasText: 'Attendance' }).first();
      if (await item.isVisible({ timeout: 3000 }).catch(() => false)) {
        await item.click();
        await sleep(1500);
        const closed = await page2.$('.sidebar--open');
        console.log(`  closes on nav click: ${!closed ? 'YES' : 'NO'}`);
      }
      await page2.click('body');
      await sleep(500);
      const still = await page2.$('.sidebar--open');
      console.log(`  closes on outside tap: ${!still ? 'YES' : 'NO'}`);
      await ham.click();
      await sleep(600);
      const reopen = await page2.$('.sidebar--open');
      console.log(`  reopens: ${reopen ? 'YES' : 'NO'}`);
    }
  } else {
    console.log('  ✗ hamburger not found');
  }
  await ctx2.close();
  await br2.close();

  console.log('\n✓ Tests complete');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
