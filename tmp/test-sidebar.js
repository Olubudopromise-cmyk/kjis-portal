const { chromium } = require('playwright');

const BASE = 'http://localhost:3000';

// ── helpers ──────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function loginAs(type) {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
  const ctx = await br.newContext();
  const page = await ctx.newPage();
  const loginUrl = type === 'student' ? '/login'
    : type === 'teacher' ? '/teacher/login'
    : '/admin/login';

  await page.goto(BASE + loginUrl);
  await sleep(1000);

  // KJIS uses StaffLoginForm / StudentLoginForm — fill known credentials
  // Try the standard test accounts used in this project.
  const creds = {
    student:  { username: 'student',  password: 'password' },
    teacher:  { username: 'teacher',  password: 'password' },
    admin:    { username: 'admin',    password: 'password' },
  }[type];

  // Find username + password fields and submit
  const userField = await page.$('input[type="text"], input[type="email"], input[name="username"], input[name="email"], input#username, input#email');
  const passField = await page.$('input[type="password"]');

  if (userField && passField) {
    await userField.fill(creds.username);
    await passField.fill(creds.password);
    const submit = await page.$('button[type="submit"], input[type="submit"], button:has-text("Sign in"), button:has-text("Login")');
    if (submit) await submit.click();
    await sleep(2000);
  }

  const currentUrl = page.url();
  console.log(`[${type}] after login → ${currentUrl}`);
  return { page, ctx, br };
}

async function testPortal(type, portalUrl, sections) {
  console.log(`\n=== Testing ${type} portal: ${portalUrl} ===`);
  const { page, ctx, br } = await loginAs(type);

  // navigate to portal if not already there
  if (!page.url().includes(portalUrl.replace(BASE, ''))) {
    await page.goto(BASE + portalUrl);
    await sleep(2000);
  }

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`CONSOLE ERROR: ${msg.text()}`);
  });
  page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}`));

  // check sidebar is visible
  const sidebar = await page.$('.sidebar');
  if (!sidebar) {
    console.log(`  ✗ Sidebar not found in DOM`);
  } else {
    console.log(`  ✓ Sidebar present`);
  }

  // check hamburger on mobile (it's hidden on desktop but should exist)
  const hamburger = await page.$('.sidebar-hamburger');
  console.log(`  ${hamburger ? '✓' : '✗'} Hamburger button present`);

  // click each section in the sidebar and verify content loads
  for (const [label, contentSelector] of sections) {
    console.log(`  → Clicking "${label}"…`);
    try {
      // find the sidebar item by its visible label
      const item = await page.locator(`.sidebar-item`, { hasText: label }).first();
      if (!item) {
        console.log(`    ✗ Sidebar item "${label}" not found`);
        continue;
      }
      await item.click();
      await sleep(1500);

      // verify we're still on the same page (no crash/navigation away)
      const url = page.url();
      console.log(`    URL after click: ${url}`);

      // check for content
      if (contentSelector) {
        const content = await page.$(contentSelector);
        console.log(`    ${content ? '✓' : '✗'} Content area found: ${contentSelector}`);
      }
    } catch (e) {
      console.log(`    ✗ Error clicking "${label}": ${e.message}`);
      errors.push(`Click ${label}: ${e.message}`);
    }
  }

  // report console errors
  if (errors.length) {
    console.log(`  ⚠ Console/page errors during ${type} test:`);
    for (const e of errors) console.log(`    - ${e}`);
  } else {
    console.log(`  ✓ No console errors`);
  }

  await ctx.close();
  await br.close();
}

async function main() {
  try {
    // ── STUDENT portal ──
    await testPortal('student', '/student', [
      ['Overview',        '.grid.g3'],
      ['Attendance',      '.card'],
      ['Fees & Payments', '.card'],
      ['Report Card',     '.card'],
      ['My Subjects',     '.card'],
      ['Timetable',       '.card'],
      ['Ask AI Tutor',    '.chat-log'],
      ['Notices',         '.card'],
      ['Sign out',        null],
    ]);

    // ── TEACHER portal ──
    await testPortal('teacher', '/teacher', [
      ['Overview',          '.grid.g3'],
      ['Mark Attendance',   '.card'],
      ['Enter Results',     '.card'],
      ['Fee Status',        '.card'],
      ['Manage',            '.card'],
      ['Sign out',          null],
    ]);

    // ── ADMIN portal ──
    await testPortal('admin', '/admin', [
      ['Overview',              '.grid.g3'],
      ['Classes',               '.card'],
      ['Categories & Subjects', '.card'],
      ['Teachers',              '.card'],
      ['Timetable',             '.card'],
      ['Attendance',            '.card'],
      ['Notices',               '.card'],
      ['Sign out',              null],
    ]);

    // ── Admin sub-pages directly ──
    console.log('\n=== Testing admin sub-pages directly ===');
    const { page: page2, ctx: ctx2, br: br2 } = await loginAs('admin');
    const adminPages = [
      { url: '/admin/classes',          name: 'Classes' },
      { url: '/admin/subjects',         name: 'Subjects' },
      { url: '/admin/teachers',         name: 'Teachers' },
      { url: '/admin/timetable',        name: 'Timetable' },
      { url: '/admin/announcements',    name: 'Notices' },
      { url: '/admin/attendance',       name: 'Attendance Overview' },
    ];
    for (const p of adminPages) {
      await page2.goto(BASE + p.url);
      await sleep(2000);
      const h2 = await page2.$('.page-head h2');
      const h2Text = h2 ? await h2.textContent() : null;
      console.log(`  ${p.name}: page-head → "${h2Text}"`);
      // verify sidebar is still present (layout wraps all)
      const sb = await page2.$('.sidebar');
      console.log(`  ${p.name}: sidebar present → ${sb ? '✓' : '✗'}`);
    }

    // ── Mobile drawer test ──
    console.log('\n=== Testing mobile drawer (student portal) ===');
    const { page: pm, ctx: ctxm, br: brm } = await loginAs('student');
    const viewport = pm.viewportSize();
    await pm.setViewportSize({ width: 480, height: 800 });
    await pm.goto(BASE + '/student');
    await sleep(2000);

    const hamburger = await pm.$('.sidebar-hamburger');
    if (hamburger) {
      await hamburger.click();
      await sleep(500);
      const drawer = await pm.$('.sidebar--open');
      console.log(`  Drawer opens → ${drawer ? '✓' : '✗'}`);
      if (drawer) {
        // click a sidebar item inside drawer to verify it closes
        const item = await pm.locator('.sidebar-item', { hasText: 'Attendance' }).first();
        if (item) {
          await item.click();
          await sleep(800);
          const closed = await pm.$('.sidebar--open');
          console.log(`  Drawer closes after click → ${!closed ? '✓' : '✗'}`);
        }
        // click outside to close
        await pm.click('body');
        await sleep(400);
        const stillOpen = await pm.$('.sidebar--open');
        console.log(`  Drawer closes on outside click → ${!stillOpen ? '✓' : '✗'}`);
      }
    } else {
      console.log('  ✗ Hamburger not found');
    }

    await ctxm.close();
    await brm.close();

    console.log('\n✓ All tests complete');
  } catch (e) {
    console.error('Test suite error:', e);
    process.exit(1);
  }
}

main();
