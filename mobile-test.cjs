const puppeteer = require('puppeteer-core');
const { SignJWT } = require('jose');

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
const STUDENT_ID = '782e893f-e93d-450e-9937-7a3ba14768c4';
const STUDENT_NAME = 'Boluware Rhema Olamiju';

async function makeToken() {
  const secret = new TextEncoder().encode(SESSION_SECRET);
  return new SignJWT({ id: STUDENT_ID, role: 'student', name: STUDENT_NAME })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(secret);
}

(async () => {
  const token = await makeToken();
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  async function testViewport(width, label) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 812 });
    
    // Set session cookie before navigating
    await page.setCookie({
      name: 'kjis_session',
      value: token,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
    });

    console.log(`\n=== ${label} (${width}px) ===`);
    await page.goto('http://127.0.0.1:3456/student', { waitUntil: 'networkidle0', timeout: 34560 });
    console.log('URL:', page.url());

    // Wait for React hydration
    await new Promise(r => setTimeout(r, 3456));
    await page.screenshot({ path: `/tmp/student-${width}px.png`, fullPage: true });

    // Check hamburger
    const hamburger = await page.$('.sidebar-hamburger');
    console.log('Hamburger in DOM:', hamburger ? 'EXISTS' : 'NOT FOUND');

    if (hamburger) {
      const visible = await hamburger.isIntersectingViewport();
      const box = await hamburger.boundingBox();
      const styles = await page.evaluate(el => {
        const cs = getComputedStyle(el);
        return {
          display: cs.display, visibility: cs.visibility,
          opacity: cs.opacity, position: cs.position,
          zIndex: cs.zIndex, width: cs.width, height: cs.height,
          top: cs.top, left: cs.left, overflow: cs.overflow,
        };
      }, hamburger);
      console.log('Hamburger visible:', visible, 'box:', JSON.stringify(box));
      console.log('Hamburger styles:', JSON.stringify(styles, null, 2));
    }

    // Check sidebar
    const sidebar = await page.$('.sidebar');
    if (sidebar) {
      const ss = await page.evaluate(el => {
        const cs = getComputedStyle(el);
        return { display: cs.display, position: cs.position, transform: cs.transform, width: cs.width, zIndex: cs.zIndex, visibility: cs.visibility, overflow: cs.overflow };
      }, sidebar);
      console.log('Sidebar styles:', JSON.stringify(ss, null, 2));
    }

    // Check all ancestors of hamburger for overflow issues
    if (hamburger) {
      const overflows = await page.evaluate(el => {
        const results = [];
        let node = el;
        while (node && node !== document.body) {
          const cs = getComputedStyle(node);
          if (cs.overflow !== 'visible') {
            results.push({ tag: node.tagName, class: node.className, overflow: cs.overflow });
          }
          node = node.parentElement;
        }
        return results;
      }, hamburger);
      console.log('Parents with overflow:', JSON.stringify(overflows, null, 2));
    }

    // Full DOM structure
    const structure = await page.evaluate(() => {
      function summarize(el, depth = 0) {
        if (depth > 5 || !el) return '';
        const tag = el.tagName?.toLowerCase() || '';
        const cls = el.className ? '.' + String(el.className).replace(/\s+/g, '.') : '';
        const kids = Array.from(el.children || []).map(c => summarize(c, depth + 1)).filter(Boolean);
        const indent = '  '.repeat(depth);
        if (kids.length) return `${indent}<${tag}${cls}>\n${kids.join('\n')}\n${indent}</${tag}>`;
        return `${indent}<${tag}${cls} />`;
      }
      const shell = document.querySelector('.portal-shell');
      return shell ? summarize(shell) : 'NO .portal-shell found';
    });
    console.log('\nPortal-shell DOM:\n' + structure);

    // Count hamburger elements
    const hamburgerCount = await page.$$eval('.sidebar-hamburger', els => els.length);
    console.log('Total .sidebar-hamburger elements:', hamburgerCount);

    // Check portal-content visibility
    const pc = await page.$('.portal-content');
    if (pc) {
      const pcBox = await pc.boundingBox();
      console.log('Portal-content box:', JSON.stringify(pcBox));
    }

    // Check page body text for debugging
    const bodyText = await page.evaluate(() => {
      const pc = document.querySelector('.portal-content');
      return pc ? pc.textContent?.slice(0, 300) : 'no portal-content';
    });
    console.log('Portal content text:', bodyText);

    await page.close();
  }

  await testViewport(375, 'iPhone SE');
  await testViewport(576, 'Small Tablet');
  await browser.close();
  console.log('\nDone!');
})().catch(e => { console.error(e); process.exit(1); });
