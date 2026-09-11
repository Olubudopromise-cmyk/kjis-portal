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

  for (const width of [375, 576]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 812 });
    await page.setCookie({ name: 'kjis_session', value: token, domain: '127.0.0.1', path: '/', httpOnly: true });

    console.log(`\n=== ${width}px ===`);
    await page.goto('http://127.0.0.1:3456/student', { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));
    await page.screenshot({ path: `/tmp/student-${width}px.png`, fullPage: true });
    console.log('URL:', page.url());

    // Hamburger check
    const hamburger = await page.$('.sidebar-hamburger');
    const hStyles = hamburger ? await page.evaluate(el => {
      const cs = getComputedStyle(el);
      return { display: cs.display, visibility: cs.visibility, position: cs.position, zIndex: cs.zIndex, top: cs.top, left: cs.left };
    }, hamburger) : null;
    console.log('Hamburger:', hamburger ? 'EXISTS' : 'MISSING', hStyles ? JSON.stringify(hStyles) : '');

    // Content check
    const content = await page.evaluate(() => {
      const pc = document.querySelector('.portal-content');
      return pc ? pc.textContent?.slice(0, 500) : 'NO CONTENT';
    });
    console.log('Content:', content);

    // Quick links check
    const buttons = await page.$$eval('.portal-content .btn', els => els.map(e => e.textContent));
    console.log('Buttons found:', buttons);

    // Click hamburger and screenshot
    if (hamburger) {
      await hamburger.click();
      await new Promise(r => setTimeout(r, 500));
      await page.screenshot({ path: `/tmp/student-${width}px-sidebar-open.png`, fullPage: true });
      const sidebarOpen = await page.evaluate(() => {
        const sidebar = document.querySelector('.sidebar');
        return sidebar ? sidebar.classList.contains('sidebar--open') : false;
      });
      console.log('Sidebar opened:', sidebarOpen);
    }

    await page.close();
  }

  await browser.close();
  console.log('\nDone!');
})().catch(e => { console.error(e); process.exit(1); });
