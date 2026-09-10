// Debug: why does Fee Status fail after the assessments section?
const h = require('./harness');

(async () => {
  const browser = await h.launch();
  const browserDisconnect = new Promise((r) => browser.on('disconnected', () => r('BROWSER DISCONNECTED')));
  const page = await browser.newPage();
  h.monitor(page, 'dbg');
  page.on('dialog', (d) => d.accept());
  page.setDefaultTimeout(20000);

  const dump = async (label) => {
    try {
      const url = page.url();
      const txt = await page.evaluate(() => document.body.innerText.slice(0, 200).replace(/\n/g, ' | '));
      console.log(`  [${label}] url=${url}`);
      console.log(`  [${label}] body="${txt}"`);
    } catch (e) {
      console.log(`  [${label}] DUMP FAILED: ${String(e).slice(0, 120)}`);
    }
  };

  const race = (p) => Promise.race([p, browserDisconnect]);

  await race(h.loginAs(page, 'teacher', 'sweepteacher', 'SweepPass2026!'));
  await race(h.gotoPath(page, 'dbg', '/teacher'));
  await race(h.waitForText(page, 'Mark attendance', 15000));

  // Go to Results tab.
  await race(page.evaluate(() => { [...document.querySelectorAll('.tab-btn')].find((b) => b.textContent.trim() === 'Enter Results').click(); }));
  await race(h.waitForText(page, 'Enter results', 10000));
  await dump('results-tab');

  // Add an assessment (POST will 500 until migration).
  await race(page.evaluate(() => {
    const set = (el, v) => {
      const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      proto.set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const label = [...document.querySelectorAll('input')].find((i) => i.placeholder && i.placeholder.includes('Label e.g.'));
    const score = [...document.querySelectorAll('input')].find((i) => i.placeholder === 'Score');
    set(label, 'Test 1');
    set(score, '25');
  }));
  await race(page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Add').click(); }));
  await h.sleep(4000);
  await dump('after-add-assessment');

  // Try Fee Status tab.
  try {
    await race(page.evaluate(() => {
      const btn = [...document.querySelectorAll('.tab-btn')].find((b) => b.textContent.trim() === 'Fee Status');
      if (!btn) throw new Error('Fee Status tab-btn not found');
      btn.click();
    }));
    console.log('  fee click ok');
  } catch (e) {
    console.log('  fee click FAILED:', String(e).slice(0, 150));
  }
  await h.sleep(3000);
  await dump('after-fee-click');

  await browser.close().catch(() => {});
  process.exit(0);
})().catch((e) => { console.error('DBG CRASHED:', String(e).slice(0, 300)); process.exit(1); });
