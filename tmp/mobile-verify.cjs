const puppeteer = require('puppeteer-core');
const { SignJWT } = require('jose');

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
const STUDENT_ID = process.argv[2] || '782e893f-e93d-450e-9937-7a3ba14768c4';
const STUDENT_NAME = 'Boluware Rhema Olamiju';
const BASE = process.env.BASE || 'http://127.0.0.1:3456';

async function makeToken() {
  const secret = new TextEncoder().encode(SESSION_SECRET);
  return new SignJWT({ id: STUDENT_ID, role: 'student', name: STUDENT_NAME })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(secret);
}

let failures = 0;
function check(name, ok, detail) {
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
}

(async () => {
  const token = await makeToken();
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  for (const width of [375, 576]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 812, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
    await page.setCookie({ name: 'kjis_session', value: token, domain: '127.0.0.1', path: '/', httpOnly: true });

    console.log(`\n======== ${width}px ========`);
    await page.goto(`${BASE}/student`, { waitUntil: 'networkidle0', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 3500));

    // 1) hamburger exists, is on-screen, legible, and clickable
    const burger = await page.evaluate(() => {
      function lum(c) {
        const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => {
          v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      }
      function contrast(a, b) {
        const l1 = lum(a), l2 = lum(b);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      }
      const el = document.querySelector('.sidebar-hamburger');
      if (!el) return { inDom: false };
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
      const top = document.elementFromPoint(cx, cy);
      return {
        inDom: true,
        display: cs.display,
        position: cs.position,
        zIndex: cs.zIndex,
        color: cs.color,
        background: cs.backgroundColor,
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        onScreen: r.x >= 0 && r.y >= 0 && r.x + r.width <= window.innerWidth,
        contrast: Number(contrast(cs.color, cs.backgroundColor).toFixed(2)),
        clickable: !!top && (top === el || el.contains(top)),
      };
    });
    check('hamburger exists in DOM', burger.inDom);
    check('hamburger displayed', burger.display === 'block', `display=${burger.display} position=${burger.position} z=${burger.zIndex}`);
    check('hamburger fully on screen', burger.onScreen, JSON.stringify(burger.rect));
    check('icon/background contrast >= 3:1', burger.contrast >= 3, `color=${burger.color} bg=${burger.background} ratio=${burger.contrast}`);
    check('hamburger hit-testable (not covered)', burger.clickable);

    await page.screenshot({ path: `/tmp/verify-${width}-closed.png` });

    // 2) tap it -> drawer opens, hamburger hides, nav items visible
    await page.click('.sidebar-hamburger');
    await new Promise((r) => setTimeout(r, 600));
    const opened = await page.evaluate(() => {
      const sb = document.querySelector('.sidebar');
      const items = [...document.querySelectorAll('.sidebar-item')];
      const close = document.querySelector('.sidebar-close');
      const hb = document.querySelector('.sidebar-hamburger');
      return {
        open: sb?.classList.contains('sidebar--open'),
        x: Math.round(sb?.getBoundingClientRect().x ?? -999),
        width: Math.round(sb?.getBoundingClientRect().width ?? 0),
        itemCount: items.length,
        firstItemVisible: items[0] ? items[0].getBoundingClientRect().width > 0 : false,
        closeVisible: close ? getComputedStyle(close).display !== 'none' : false,
        hamburgerHidden: hb ? getComputedStyle(hb).display === 'none' : true,
      };
    });
    check('drawer opens on tap', opened.open && opened.x === 0, JSON.stringify(opened));
    check('nav items present & visible', opened.itemCount >= 8 && opened.firstItemVisible, `items=${opened.itemCount}`);
    check('in-drawer close button visible', opened.closeVisible);
    check('hamburger hidden while drawer open', opened.hamburgerHidden);
    await page.screenshot({ path: `/tmp/verify-${width}-open.png` });

    // 3) tapping a nav item switches tab and closes the drawer
    await page.evaluate(() => {
      const items = [...document.querySelectorAll('.sidebar-item')];
      const fees = items.find((i) => i.textContent.includes('Fees'));
      fees.click();
    });
    await new Promise((r) => setTimeout(r, 600));
    const navigated = await page.evaluate(() => {
      const sb = document.querySelector('.sidebar');
      const hb = document.querySelector('.sidebar-hamburger');
      return {
        drawerClosed: !sb.classList.contains('sidebar--open'),
        hamburgerBack: hb ? getComputedStyle(hb).display === 'block' : false,
        content: document.querySelector('.portal-content')?.textContent?.slice(0, 80) || '',
      };
    });
    check('nav item closes drawer', navigated.drawerClosed);
    check('hamburger reappears after navigating', navigated.hamburgerBack);

    // 4) Overview content (go back to overview)
    await page.evaluate(() => {
      [...document.querySelectorAll('.sidebar-item')].find((i) => i.textContent.includes('Overview'))?.click();
    });
    await new Promise((r) => setTimeout(r, 2500));
    const overview = await page.evaluate(() => {
      const text = document.querySelector('.portal-content')?.textContent || '';
      const buttons = [...document.querySelectorAll('.portal-content .btn')].map((b) => b.textContent.trim());
      return {
        hasAttendance: text.includes('Attendance'),
        hasNextClass: text.includes('Next Class'),
        hasNotices: text.includes('Recent Notices'),
        noticeCount: document.querySelectorAll('.portal-content .notice').length,
        quickLinks: ['Fees', 'Report Card', 'Timetable'].every((l) => buttons.some((b) => b.includes(l))),
        buttons,
        snippet: text.slice(0, 60),
      };
    });
    check('Overview shows attendance summary', overview.hasAttendance);
    check('Overview shows next class card', overview.hasNextClass);
    check('Overview shows recent notices', overview.hasNotices, `notice elements=${overview.noticeCount}`);
    check('Overview quick links (Fees/Report Card/Timetable)', overview.quickLinks, JSON.stringify(overview.buttons));
    await page.screenshot({ path: `/tmp/verify-${width}-overview.png` });

    await page.close();
  }

  await browser.close();
  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
