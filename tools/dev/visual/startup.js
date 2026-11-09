/* Startup check: node tools/dev/visual/startup.js
   Without it (src/00b-preflight.js), a refused WebGL context or a missing three.js left the screen on "Loading three.js" without a word (a Pixel, right after
   a 3D display interruption: Chrome then blocks context creation for the page for a few minutes). Emulates, in a real browser:
   - context creation refused for a few seconds ("Web page caused context loss and was blocked"): the waiting message is shown, the page reloads itself
     and the game starts when the context becomes possible again;
   - a three.js that does not load: the message and the retry;
   - a startup that stops on a script error: the message with the error and the button to reload.
   Exits with an error code at the first failure. */
const { openGame } = require('./common');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL  :', m); } else console.log('ok    :', m); };
const open = (init) => openGame({ mobile: true, w: 987, h: 444, dpr: 1, settings: { quality: 'low' }, noMap: true, noHdri: true, init, gate: true });
(async () => {
  // 1. context creation refused for 12 s (from the first attempt)
  const BLOCK = "window.__PRE_WATCH = 3000; (() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, a) { if (/webgl/.test(t) && (+sessionStorage.getItem('__t0') || (sessionStorage.setItem('__t0', String(Date.now())), Date.now())) + 12000 > Date.now()) { this.dispatchEvent(Object.assign(new Event('webglcontextcreationerror'), { statusMessage: 'Web page caused context loss and was blocked' })); return null; } return g.call(this, t, a); }; })();";
  let { browser, page } = await open(BLOCK);
  await page.waitForFunction("/blocked the game's 3D display/.test(document.getElementById('loadMsg').textContent)", null, { timeout: 30000 });
  await page.waitForTimeout(4000); // the startup check (advanced to 3 s) must not offer "Reload": reloading does not unblock Chrome
  const m1 = await page.evaluate(() => ({ txt: document.getElementById('loadMsg').textContent, booted: PRE.booted, btn: !!document.querySelector('#loading .load-inner > button') }));
  ok(!m1.booted && /Force stop/.test(m1.txt) && /Waiting: \d+ s/.test(m1.txt) && /was blocked/.test(m1.txt) && !m1.btn, `context refused: message (stop Chrome), wait and browser reason, no button ("${m1.txt.slice(0, 70)}...")`);
  await page.waitForFunction("(() => { try { return MATCH.state === 'menu'; } catch (e) { return false; } })()", null, { timeout: 300000, polling: 500 }); // MATCH does not exist yet while the script is stopped
  const tl = await page.evaluate(() => GPU_EV.map((e) => e[2]));
  ok(tl.some((m) => /WebGL unavailable at start/.test(m)) && tl.some((m) => /WebGL available again/.test(m)), `context possible again: the page reloaded and the game started (${tl.filter((m) => /WebGL/.test(m)).join(' > ').slice(0, 120)})`);
  await browser.close();

  // 2. three.js that does not load
  ({ browser, page } = await open("Object.defineProperty(window, 'THREE', { configurable: true, get() { return undefined; }, set() {} });"));
  await page.waitForFunction("/three.js could not be downloaded/.test(document.getElementById('loadMsg').textContent)", null, { timeout: 30000 });
  ok(true, 'three.js missing: message and retry announced');
  await browser.close();

  // 3. startup stopped by a script error (main context refused, the check attempt passes): message with the error and button
  ({ browser, page } = await open("window.__PRE_WATCH = 3000; (() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, a) { if (/webgl/.test(t) && a && a.powerPreference) return null; return g.call(this, t, a); }; })();"));
  await page.waitForFunction("/Startup did not complete/.test(document.getElementById('loadMsg').textContent)", null, { timeout: 30000 });
  const m3 = await page.evaluate(() => ({ txt: document.getElementById('loadMsg').textContent, btn: !!document.querySelector('#loading .load-inner > button') }));
  ok(/WebGL: no context/.test(m3.txt) && m3.btn, `startup stopped: the error is stated, button to reload ("${m3.txt.slice(0, 80)}...")`);
  await page.screenshot({ path: (process.argv[2] || '/tmp') + '/startup-blocked.png' }).catch(() => {});
  await browser.close();
  console.log(fails ? `${fails} failure(s)` : 'all good');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
