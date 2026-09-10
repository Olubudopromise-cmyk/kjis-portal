// Dump exactly what renders after clicking Fee Status.
const h = require('./harness');

(async () => {
  const browser = await h.launch();
  const page = await browser.newPage();
  h.monitor(page, 'fee2');
  page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 400)));
  page.setDefaultTimeout(20000);

  await h.loginAs(page, 'teacher', 'sweepteacher', 'SweepPass2026!');
  await h.gotoPath(page, 'fee2', '/teacher');
  await h.waitForText(page, 'Mark attendance', 15000);

  await page.evaluate(() => { [...document.querySelectorAll('.tab-btn')].find((b) => b.textContent.trim() === 'Fee Status').click(); });
  await h.sleep(2000);

  const state = await page.evaluate(() => {
    const active = document.querySelector('.tab-btn.active');
    const cards = [...document.querySelectorAll('.card')].map((c) => c.innerText.slice(0, 150));
    return {
      activeTab: active ? active.textContent.trim() : null,
      cards,
      bodySnippet: document.body.innerText.slice(0, 400).replace(/\n+/g, ' | '),
      hasNextOverlay: !!document.querySelector('nextjs-portal'),
    };
  });
  console.log(JSON.stringify(state, null, 2));

  await browser.close().catch(() => {});
  process.exit(0);
})().catch((e) => { console.error('CRASHED:', String(e).slice(0, 300)); process.exit(1); });
