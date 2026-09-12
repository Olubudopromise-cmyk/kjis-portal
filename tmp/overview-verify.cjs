// Verifies the student Overview renders: attendance summary, the genuine next
// upcoming class from the timetable, and up to 3 notices. Announcements and
// timetable are mocked via request interception (no DB writes) and the clock is
// frozen to a weekday so "next class" is deterministic.
const puppeteer = require('puppeteer-core');
const { SignJWT } = require('jose');

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
const STUDENT_ID = process.argv[2] || '782e893f-e93d-450e-9937-7a3ba14768c4';
const BASE = process.env.BASE || 'http://127.0.0.1:3456';

async function makeToken() {
  const secret = new TextEncoder().encode(SESSION_SECRET);
  return new SignJWT({ id: STUDENT_ID, role: 'student', name: 'Boluware Rhema Olamiju' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('12h').sign(secret);
}

let failures = 0;
const check = (n, ok, d) => { console.log(`${ok ? '  PASS' : '  FAIL'}  ${n}${d ? '  — ' + d : ''}`); if (!ok) failures++; };

const TIMETABLE = { entries: [
  // Deliberately out of chronological order in the array.
  { id: 't2', day_of_week: 'Wednesday', period_label: '10:00 - 10:40', subject: 'English Language', teacher_name: 'Mrs. Bello' },
  { id: 't1', day_of_week: 'Wednesday', period_label: '8:00 - 8:40', subject: 'Mathematics', teacher_name: 'Mr. Ade' },
  { id: 't3', day_of_week: 'Monday', period_label: '9:00 - 9:40', subject: 'Biology', teacher_name: 'Ms. Chi' },
] };

async function runCase(label, frozenLocal, expected) {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome', headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  await page.setCookie({ name: 'kjis_session', value: await makeToken(), domain: '127.0.0.1', path: '/', httpOnly: true });

  await page.evaluateOnNewDocument((fixedISO) => {
    const fixed = new Date(fixedISO).getTime();
    const RealDate = Date;
    class MockDate extends RealDate {
      constructor(...args) { super(...(args.length ? args : [fixed])); }
      static now() { return fixed; }
    }
    window.Date = MockDate;
  }, frozenLocal);

  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    const json = (body) => req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.includes('/api/announcements')) {
      return json({ announcements: [
        { id: 'a1', text: 'Mid-term break starts Monday.', author: 'Management', created_at: '2026-09-10T09:00:00Z' },
        { id: 'a2', text: 'Inter-house sports on Friday.', author: 'Sports Dept', created_at: '2026-09-09T09:00:00Z' },
        { id: 'a3', text: 'PTA meeting next week.', author: 'Principal', created_at: '2026-09-08T09:00:00Z' },
        { id: 'a4', text: 'This older notice must NOT appear on the overview.', author: 'Admin', created_at: '2026-09-01T09:00:00Z' },
      ] });
    }
    if (url.includes('/api/timetable')) return json(TIMETABLE);
    req.continue();
  });

  console.log(`\n======== ${label} (frozen ${frozenLocal}) ========`);
  await page.goto(`${BASE}/student`, { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2500));

  const out = await page.evaluate(() => {
    const content = document.querySelector('.portal-content');
    const text = content?.textContent || '';
    return {
      noticeTexts: [...document.querySelectorAll('.portal-content .notice')].map((n) => n.querySelector('div')?.textContent),
      attendanceDetail: (text.match(/\d+\/\d+ days present/) || [])[0] || null,
      nextClassSubject: [...document.querySelectorAll('.stat-card')].find((c) => c.textContent.includes('Next Class'))?.textContent || null,
      quickLinks: [...document.querySelectorAll('.portal-content .btn')].map((b) => b.textContent.trim()),
    };
  });
  const d = JSON.stringify(out.nextClassSubject);
  check('exactly 3 notices', out.noticeTexts.length === 3, JSON.stringify(out.noticeTexts));
  check('oldest notice excluded', !out.noticeTexts.some((t) => /must NOT appear/.test(t || '')));
  check('attendance summary rendered', !!out.attendanceDetail, out.attendanceDetail || 'none');
  check(`next class = ${expected.subject}`, out.nextClassSubject.includes(expected.subject), d);
  check(`next class label = ${expected.when}`, out.nextClassSubject.includes(expected.when), d);
  check('quick links present', ['Fees', 'Report Card', 'Timetable'].every((l) => out.quickLinks.some((b) => b.includes(l))));

  await page.screenshot({ path: `/tmp/overview-${expected.slug}.png` });
  await browser.close();
}

(async () => {
  // Wed 09:00 — 8:00 class has passed, 10:00 class is next today.
  await runCase('Weekday mid-morning', '2026-09-09T09:00:00', { subject: 'English Language', when: 'Today', slug: 'wed-0900' });
  // Wed 18:00 — all Wednesday classes done, so next is Monday's first.
  await runCase('Weekday evening', '2026-09-09T18:00:00', { subject: 'Biology', when: 'Monday', slug: 'wed-1800' });
  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
