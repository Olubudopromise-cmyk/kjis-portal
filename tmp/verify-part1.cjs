// Part 1 verification: /admin must render inside AdminShell (navy KJ top bar +
// left nav) and every sidebar item must navigate to its own page.
// Usage: node tmp/verify-part1.cjs [adminUser adminPass]
const { chromium } = require('playwright');
const fs = require('fs');

// The installed Playwright build (1234) is older than the one this package
// expects, so point it straight at a real Chromium/Chrome on disk.
function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    `${process.env.HOME}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`,
    '/usr/bin/google-chrome',
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p));
}

const BASE = 'http://localhost:3000';
const USER = process.argv[2] || 'verifyadmin';
const PASS = process.argv[3] || 'VerifyPass2026!x';

const EXPECT = [
  ['Overview', '/admin'],
  ['Classes', '/admin/classes'],
  ['Categories & Subjects', '/admin/subjects'],
  ['Teachers', '/admin/teachers'],
  ['Timetable', '/admin/timetable'],
  ['Attendance', '/admin/attendance'],
  ['Notices', '/admin/announcements'],
];

const problems = [];
const log = (...a) => console.log(...a);

(async () => {
  const browser = await chromium.launch({ executablePath: findBrowser(), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 200)}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/DevTools|favicon/.test(m.text())) errors.push(`console: ${m.text().slice(0, 200)}`); });

  // --- sign in as admin ---
  await page.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle' });
  await page.fill('input[autocomplete="username"]', USER);
  await page.fill('input[type="password"]', PASS);
  await Promise.all([
    page.waitForURL('**/admin', { timeout: 20000 }).catch(() => {}),
    page.click('button[type="submit"], form button'),
  ]);
  await page.waitForLoadState('networkidle');
  log('after login ->', page.url());
  if (!page.url().includes('/admin')) {
    log('LOGIN FAILED:', await page.textContent('body').catch(() => ''));
    await browser.close();

  // --- shell chrome assertions ---
  const shell = await page.evaluate(() => {
    const aside = document.querySelector('aside#portal-sidebar');
    const topbar = document.querySelector('.portal-topbar');
    const crest = document.querySelector('.portal-topbar .crest');
    const items = [...document.querySelectorAll('.sidebar-nav .sidebar-item')].map((b) => b.textContent.trim());
    return {
      hasShell: !!document.querySelector('.portal-shell'),
      hasAside: !!aside,
      asideVisible: !!aside && aside.getBoundingClientRect().width > 100,
      hasTopbar: !!topbar,
      crestText: crest ? crest.textContent.trim() : null,
      navItems: items,
      hasContent: !!document.querySelector('.portal-content'),
    };
  });
  log('shell:', JSON.stringify(shell));
  if (!shell.hasShell) problems.push('no .portal-shell on /admin');
  if (!shell.hasTopbar) problems.push('no navy .portal-topbar on /admin');
  if (shell.crestText !== 'KJ') problems.push(`top-bar crest is ${shell.crestText}, not "KJ"`);
  if (!shell.hasAside || !shell.asideVisible) problems.push('left sidebar missing or zero-width');
  for (const [label] of EXPECT) {
    if (!shell.navItems.some((t) => t.includes(label))) problems.push(`sidebar is missing "${label}"`);
  }

  // page content: current term + register a student + students table
  const bodyTxt = await page.textContent('body');
  for (const needle of ['Admin Desk', 'Current term', 'Register a student', 'Students']) {
    if (!bodyTxt.includes(needle)) problems.push(`/admin body is missing "${needle}"`);
  }

  // --- each sidebar item navigates ---
  for (const [label, path] of EXPECT) {
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
    const clicked = await page.evaluate((label) => {
      const btn = [...document.querySelectorAll('.sidebar-nav .sidebar-item')].find((b) => b.textContent.includes(label));
      if (!btn) return false;
      btn.click();
      return true;
    }, label);
    if (!clicked) { problems.push(`cannot find sidebar button "${label}"`); continue; }
    await page.waitForURL((u) => u.pathname === path, { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState('networkidle');
    const landed = new URL(page.url()).pathname;
    const active = await page.evaluate(() => document.querySelector('.sidebar-item--active')?.textContent.trim() || null);
    const ok = landed === path;
    log(`${ok ? 'OK ' : 'BAD'}  ${label.padEnd(24)} -> ${landed}  (active: ${JSON.stringify(active)})`);
    if (!ok) problems.push(`sidebar "${label}" landed on ${landed}, expected ${path}`);
    if (active && !active.includes(label)) problems.push(`"${label}" navigated but active highlight is "${active}"`);
  }

    process.exit(1);
  }


  // --- 375px: drawer opens from hamburger and items still navigate ---
  await page.setViewportSize({ width: 375, height: 720 });
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  const mob = await page.evaluate(() => {
    const btn = document.querySelector('.sidebar-hamburger');
    const r = btn?.getBoundingClientRect();
    return { exists: !!btn, w: r?.width || 0, h: r?.height || 0 };
  });
  log('mobile hamburger:', JSON.stringify(mob));
  if (!mob.exists || mob.w === 0) problems.push('mobile: hamburger not visible at 375px');
  await page.evaluate(() => document.querySelector('.sidebar-hamburger')?.click());
  await page.waitForTimeout(600);
  const drawerOpen = await page.evaluate(() => {
    const a = document.querySelector('aside#portal-sidebar');
    return a ? a.getBoundingClientRect().left >= 0 && a.classList.contains('sidebar--open') : false;
  });
  log('mobile drawer open:', drawerOpen);
  if (!drawerOpen) problems.push('mobile: drawer did not open at 375px');
  const mobileNav = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.sidebar-nav .sidebar-item')].find((b) => b.textContent.includes('Teachers'));
    if (!btn) return false;
    btn.click();
    return true;
  });
  await page.waitForURL((u) => u.pathname === '/admin/teachers', { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle');
  log('mobile drawer Teachers ->', new URL(page.url()).pathname, `(clicked=${mobileNav})`);
  if (new URL(page.url()).pathname !== '/admin/teachers') problems.push('mobile: drawer item did not navigate');

  if (errors.length) { log('\nJS/console errors:'); errors.forEach((e) => log('  ' + e)); problems.push(`${errors.length} js error(s)`); }

  await browser.close();
  log('\n=== PART 1 PROBLEMS:', problems.length, '===');
  problems.forEach((p) => log(' - ' + p));
  process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error('CRASHED:', e); process.exit(2); });
