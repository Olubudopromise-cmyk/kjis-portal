import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';

const browser = await chromium.launch({ headless: true });

async function testViewport(width, label) {
  const context = await browser.newContext({ viewport: { width, height: 812 } });
  const page = await context.newPage();

  // Navigate to student login
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  console.log(`\n=== ${label} (${width}px) ===`);
  console.log('Login page loaded:', page.url());

  // Check if there's a hamburger on the login page
  const loginHamburger = await page.$('.sidebar-hamburger');
  console.log('Hamburger on login page:', loginHamburger ? 'EXISTS' : 'NOT FOUND');

  // Screenshot the login page
  await page.screenshot({ path: `/tmp/login-${width}px.png`, fullPage: true });

  // Try to log in - first let's see what students exist
  // Use a known test credential
  await page.fill('input[autocomplete="name"]', 'Test Student');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  console.log('After login URL:', page.url());

  // If we're on the student dashboard, check for hamburger
  if (page.url().includes('/student')) {
    // Wait for dashboard to render
    await page.waitForTimeout(2000);

    // Screenshot the dashboard
    await page.screenshot({ path: `/tmp/student-dashboard-${width}px.png`, fullPage: true });

    // Check for hamburger button in DOM
    const hamburger = await page.$('.sidebar-hamburger');
    console.log('Hamburger button in DOM:', hamburger ? 'EXISTS' : 'NOT FOUND');

    if (hamburger) {
      const isVisible = await hamburger.isVisible();
      const box = await hamburger.boundingBox();
      const styles = await hamburger.evaluate(el => {
        const cs = window.getComputedStyle(el);
        return {
          display: cs.display,
          visibility: cs.visibility,
          opacity: cs.opacity,
          position: cs.position,
          zIndex: cs.zIndex,
          width: cs.width,
          height: cs.height,
          top: cs.top,
          left: cs.left,
        };
      });
      console.log('Hamburger visible:', isVisible);
      console.log('Hamburger bounding box:', box);
      console.log('Hamburger computed styles:', JSON.stringify(styles, null, 2));
    }

    // Check for sidebar
    const sidebar = await page.$('.sidebar');
    if (sidebar) {
      const sidebarStyles = await sidebar.evaluate(el => {
        const cs = window.getComputedStyle(el);
        return {
          display: cs.display,
          position: cs.position,
          transform: cs.transform,
          width: cs.width,
          zIndex: cs.zIndex,
          visibility: cs.visibility,
        };
      });
      console.log('Sidebar computed styles:', JSON.stringify(sidebarStyles, null, 2));
    }

    // Check portal-body
    const portalBody = await page.$('.portal-body');
    if (portalBody) {
      const pbStyles = await portalBody.evaluate(el => {
        const cs = window.getComputedStyle(el);
        return {
          display: cs.display,
          flexDirection: cs.flexDirection,
          height: cs.height,
          overflow: cs.overflow,
        };
      });
      console.log('Portal body styles:', JSON.stringify(pbStyles, null, 2));
    }

    // Check portal-content
    const portalContent = await page.$('.portal-content');
    if (portalContent) {
      const pcStyles = await portalContent.evaluate(el => {
        const cs = window.getComputedStyle(el);
        return {
          display: cs.display,
          flex: cs.flex,
          width: cs.width,
          padding: cs.padding,
        };
      });
      console.log('Portal content styles:', JSON.stringify(pcStyles, null, 2));
    }

    // Get full HTML structure of portal-body
    const portalBodyHTML = await page.$eval('.portal-body', el => {
      function summarize(el, depth = 0) {
        if (depth > 3) return '';
        const tag = el.tagName?.toLowerCase() || '';
        const cls = el.className ? `.${String(el.className).split(' ').join('.')}` : '';
        const id = el.id ? `#${el.id}` : '';
        const kids = Array.from(el.children || []).map(c => summarize(c, depth + 1)).filter(Boolean);
        const indent = '  '.repeat(depth);
        if (kids.length) {
          return `${indent}<${tag}${id}${cls}>\n${kids.join('\n')}\n${indent}</${tag}>`;
        }
        return `${indent}<${tag}${id}${cls} />`;
      }
      return summarize(el);
    });
    console.log('\nPortal-body DOM structure:\n' + portalBodyHTML);

    // Also get the full outer HTML of the body > page structure
    const fullStructure = await page.$eval('body > div', el => {
      function summarize(el, depth = 0) {
        if (depth > 4) return '';
        const tag = el.tagName?.toLowerCase() || '';
        const cls = el.className ? `.${String(el.className).split(' ').join('.')}` : '';
        const kids = Array.from(el.children || []).map(c => summarize(c, depth + 1)).filter(Boolean);
        const indent = '  '.repeat(depth);
        if (kids.length) {
          return `${indent}<${tag}${cls}>\n${kids.join('\n')}\n${indent}</${tag}>`;
        }
        return `${indent}<${tag}${cls} />`;
      }
      return summarize(el);
    });
    console.log('\nFull page structure:\n' + fullStructure);
  } else {
    console.log('Not on student page, checking page content...');
    const content = await page.textContent('body');
    console.log('Page text (first 500 chars):', content?.slice(0, 500));
    await page.screenshot({ path: `/tmp/after-login-${width}px.png`, fullPage: true });
  }

  await context.close();
}

await testViewport(375, 'iPhone SE');
await testViewport(576, 'Small Tablet');

await browser.close();
console.log('\nDone! Screenshots saved to /tmp/');
