// Identify the exact request producing the recurring 404.
const h = require('./harness');

(async () => {
  const browser = await h.launch();
  const page = await browser.newPage();
  h.monitor(page, 'probe');
  page.on('response', (res) => {
    if (res.status() === 404) console.log('404 ->', res.request().method(), res.request().url());
  });
  page.setDefaultTimeout(20000);

  await h.loginAs(page, 'admin', 'sweepadmin', 'SweepTest2026!x');
  await h.gotoPath(page, 'probe', '/admin');
  await h.sleep(3000);
  await browser.close();
  process.exit(0);
})().catch((e) => { console.error('PROBE CRASHED:', e); process.exit(1); });
