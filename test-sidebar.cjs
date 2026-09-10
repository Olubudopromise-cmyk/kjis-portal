const { chromium } = require('playwright');
const BASE = 'http://localhost:3000';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitForLogin(page, creds, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const uf = await page.$('input[type="text"], input[type="email"], input[name="username"], input[name="email"]');
    const pf = await page.$('input[type="password"]');
    if (uf && pf) {
      await uf.fill(creds.u);
      await pf.fill(creds.p);
      const s = await page.$('button[type="submit"], input[type="submit"], button:has-text("Sign in"), button:has-text("Login"), button:has-text("Sign In")');
      if (s) { await s.click(); await sleep(2000); return true; }
    }
    await sleep(500);
  }
  return false;
}

async function loginAs(type) {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
  const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const creds = { student: { u: 'student', p: 'password' }, teacher: { u: 'teacher', p: 'password' }, admin: { u: 'admin', p: 'password' } }[type];
  const loginPage = type === 'student' ? '/login' : type === 'teacher' ? '/teacher/login' : '/admin/login';
  
  page.on('console', m => { if (m.type() === 'error') console.log(`  [${type}] CONSOLE ERROR: ${m.text()}`); });
  page.on('pageerror', e => console.log(`  [${type}] PAGE ERROR: ${e.message}`));
  
  await page.goto(BASE + loginPage, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(2000);
  await waitForLogin(page, creds);
  return { page, ctx, br };
}

async function testPortal(type, portalUrl, sections) {
  console.log(`\n=== ${type} portal: ${portalUrl} ===`);
  const { page, ctx, br } = await loginAs(type);
  
  await page.goto(BASE + portalUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(3000);
  
  const sb = await page.$('.sidebar');
  console.log(`  sidebar present: ${sb ? 'YES' : 'NO'}`);
  const ham = await page.$('.sidebar-hamburger');
  console.log(`  hamburger present: ${ham ? 'YES' : 'NO'}`);
  
  for (const [label, check] of sections) {
    try {
      const item = await page.locator('.sidebar-item', { hasText: new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first();
      const found = await item.isVisible({ timeout: 3000 }).catch(() => false);
      if (!found) { console.log(`  ✗ "${label}" NOT in sidebar`); continue; }
      await item.click();
      await sleep(2000);
      const u = page.url();
      const stays = u.startsWith(BASE);
      console.log(`  "${label}" → ${stays ? 'OK' : 'LEFT SITE'}: ${u}`);
      if (check) {
        const content = await page.$(check);
        console.log(`    content ${check}: ${content ? 'FOUND' : 'missing'}`);
      }
    } catch (e) { console.log(`  ✗ "${label}": ${e.message}`); }
  }
  await ctx.close();
  await br.close();
}

async function main() {
  console.log('Testing student portal...');
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
  
  console.log('\nTesting teacher portal...');
  await testPortal('teacher', '/teacher', [
    ['Overview', '.grid.g3'],
    ['Mark Attendance', '.card'],
    ['Enter Results', '.card'],
    ['Fee Status', '.card'],
    ['Manage', '.card'],
    ['Sign out', null],
  ]);
  
  console.log('\nTesting admin portal...');
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
  
  console.log('\nTesting admin sub-pages...');
  const { page: pa, ctx: ca, br: ba } = await loginAs('admin');
  const adminSubs = [
    ['/admin/classes', 'Classes'],
    ['/admin/subjects', 'Subjects'],
    ['/admin/teachers', 'Teachers'],
    ['/admin/timetable', 'Timetable'],
    ['/admin/announcements', 'Notices'],
    ['/admin/attendance', 'Attendance'],
  ];
  for (const [url, name] of adminSubs) {
    await pa.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(2500);
    const h2 = await pa.$('.page-head h2');
    const txt = h2 ? (await h2.textContent()).trim() : 'NONE';
    const sb = await pa.$('.sidebar');
    console.log(`  ${name}: h2="${txt}" sidebar=${sb ? 'YES' : 'NO'}`);
  }
  await pa.goto(BASE + '/admin', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await sleep(2000);
  await ca.close();
  await ba.close();
  
  console.log('\nTesting mobile drawer...');
  const { page: pm, ctx: cm, br: bm } = await loginAs('student');
  await pm.setViewportSize({ width: 480, height: 800 });
  await pm.goto(BASE + '/student', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(3000);
  const ham = await pm.$('.sidebar-hamburger');
  if (ham) {
    await ham.click();
    await sleep(800);
    const open = await pm.$('.sidebar--open');
    console.log(`  drawer opens on hamburger tap: ${open ? 'YES' : 'NO'}`);
    if (open) {
      const item = await pm.locator('.sidebar-item', { hasText: 'Attendance' }).first();
      if (await item.isVisible({ timeout: 3000 }).catch(() => false)) {
        await item.click();
        await sleep(1200);
        const closed = await pm.$('.sidebar--open');
        console.log(`  drawer closes after nav click: ${!closed ? 'YES' : 'NO'}`);
      }
      await pm.click('body');
      await sleep(500);
      const stillOpen = await pm.$('.sidebar--open');
      console.log(`  drawer closes on outside tap: ${!stillOpen ? 'YES' : 'NO'}`);
      await ham.click();
      await sleep(600);
      const reopen = await pm.$('.sidebar--open');
      console.log(`  drawer reopens: ${reopen ? 'YES' : 'NO'}`);
    }
  } else {
    console.log('  ✗ hamburger not found');
  }
  await cm.close();
  await bm.close();
  
  console.log('\n✓ All tests complete');
}

main().catch(e => { console.error('FATAL:', e.message || e); process.exit(1); });
