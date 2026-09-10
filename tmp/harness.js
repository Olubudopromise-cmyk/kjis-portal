// Shared puppeteer helpers for the click-through sweep.
const puppeteer = require('puppeteer-core');

const BASE = 'http://localhost:3000';

const issues = [];
function recordIssue(kind, detail) {
  issues.push({ kind, detail });
  console.log(`  [ISSUE:${kind}] ${detail}`);
}

function ignoreNoise(url) {
  // Dev-mode webpack/HMR churn and favicon are not app bugs.
  return /\/_next\/webpack-hmr|__nextjs|\/favicon\.ico|\/_next\/static/.test(url || '');
}

async function launch() {
  return puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
}

// Attach console/pageerror/request-failure/response listeners to a page.
function monitor(page, label) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (/Download the React DevTools|favicon/i.test(text)) return;
      recordIssue('console-error', `[${label}] ${text.slice(0, 300)}`);
    }
  });
  page.on('pageerror', (err) => {
    recordIssue('pageerror', `[${label}] ${String(err).slice(0, 300)}`);
  });
  page.on('requestfailed', (req) => {
    if (ignoreNoise(req.url())) return;
    recordIssue('requestfailed', `[${label}] ${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
  });
  page.on('response', (res) => {
    if (ignoreNoise(res.request().url())) return;
    if (res.status() >= 400) {
      recordIssue('http-' + res.status(), `[${label}] ${res.request().method()} ${res.url()}`);
    }
  });
}

async function gotoPath(page, label, path) {
  await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(400);
  const url = new URL(page.url());
  console.log(`  [${label}] ${path} -> ${url.pathname}${url.search} | "${await title(page)}"`);
  return url.pathname;
}

async function loginAs(page, role, identifier, password) {
  const path = role === 'student' ? '/login' : `/${role}/login`;
  await page.goto(BASE + path, { waitUntil: 'networkidle2' });
  await page.waitForSelector('input', { timeout: 15000 });
  const inputs = await page.$$('input');
  await inputs[0].type(identifier);
  await inputs[1].type(password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {}),
    page.click('button[type="submit"], form button'),
  ]);
  await sleep(500);
  const url = new URL(page.url()).pathname;
  console.log(`  login(${role}) -> ${url}`);
  if (!url.startsWith('/' + role)) {
    const err = await page.$eval('.error-msg', (el) => el.textContent).catch(() => null);
    recordIssue('login-failed', `${role} login ended at ${url}${err ? ` — "${err}"` : ''}`);
    return false;
  }
  return true;
}

// Click the first visible button/anchor whose text matches (string or regex).
async function clickByText(page, selector, text) {
  const matches = await page.$$eval(
    selector,
    (els, t) => {
      const target = typeof t === 'string' ? t : { source: t.source, flags: t.flags };
      const rx = typeof target === 'string' ? new RegExp(`^\\s*${target}\\s*$`) : new RegExp(target.source, target.flags);
      return els
        .filter((el) => {
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) return false;
          return rx.test(el.textContent || '');
        })
        .map((el) => el.textContent.trim());
    },
    text
  );
  if (!matches.length) {
    recordIssue('click-not-found', `no visible <${selector}> matching ${JSON.stringify(text)}`);
    return false;
  }
  const clicked = await page.$$eval(
    selector,
    (els, t) => {
      const target = typeof t === 'string' ? t : { source: t.source, flags: t.flags };
      const rx = typeof target === 'string' ? new RegExp(`^\\s*${target}\\s*$`) : new RegExp(target.source, target.flags);
      for (const el of els) {
        if (!rx.test(el.textContent || '')) continue;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        el.click();
        return true;
      }
      return false;
    },
    text
  );
  if (!clicked) {
    recordIssue('click-failed', `couldn't click <${selector}> matching ${JSON.stringify(text)}`);
    return false;
  }
  return true;
}

async function typeIntoNthInput(page, index, value) {
  const inputs = await page.$$('input');
  if (!inputs[index]) {
    recordIssue('input-not-found', `input #${index} not found (only ${inputs.length} on page)`);
    return false;
  }
  await inputs[index].click({ clickCount: 3 });
  await inputs[index].type(String(value));
  return true;
}

async function bodyText(page) {
  return page.evaluate(() => document.body.innerText);
}

async function title(page) {
  return page.$eval('.page-head h2, h2', (el) => el.textContent.trim()).catch(() => '(no h2)');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Wait until at least one element matching selector exists, or timeout.
async function waitForAny(page, selector, timeout = 10000) {
  try {
    await page.waitForSelector(selector, { timeout, visible: true });
    return true;
  } catch {
    recordIssue('wait-timeout', `no visible element ${selector} within ${timeout}ms`);
    return false;
  }
}

// Wait until body text contains ANY of the needles (or timeout).
// Case-insensitive: CSS text-transform (uppercase tags/headers) changes innerText.
async function waitForText(page, needles, timeout = 20000) {
  const arr = (Array.isArray(needles) ? needles : [needles]).map((n) => String(n).toLowerCase());
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const text = await page.evaluate(() => document.body.innerText).catch(() => '');
    const low = text.toLowerCase();
    if (arr.some((n) => low.includes(n))) return true;
    await sleep(300);
  }
  recordIssue('wait-timeout', `none of ${JSON.stringify(needles).slice(0, 120)} appeared within ${timeout}ms`);
  return false;
}

// Wait until body text no longer contains the needle (case-insensitive).
async function waitGone(page, needle, timeout = 20000) {
  const low = String(needle).toLowerCase();
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const text = await page.evaluate(() => document.body.innerText).catch(() => '');
    if (!text.toLowerCase().includes(low)) return true;
    await sleep(300);
  }
  recordIssue('wait-timeout', `"${needle}" still present after ${timeout}ms`);
  return false;
}

module.exports = {
  BASE, issues, recordIssue, launch, monitor, gotoPath, loginAs,
  clickByText, typeIntoNthInput, bodyText, title, sleep, waitForAny,
  waitForText, waitGone,
};
