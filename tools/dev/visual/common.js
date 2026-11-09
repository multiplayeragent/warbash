/* Common tools: opening the game in headless Chromium, network and music off, map loaded. three.js and the HDRIs are
   served by the site (dist/tex); pages built before that (jsDelivr) get them from node_modules. */
const { chromium } = require('playwright-core');
const path = require('path');
const HERE = __dirname, REPO = path.resolve(HERE, '../../..');
const CHROME = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
async function openGame(o = {}) {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', ...(process.env.CHROME_ARGS ? process.env.CHROME_ARGS.split(' ') : [])] }); // CHROME_ARGS: extra options (e.g. --js-flags=--allow-natives-syntax)
  // o.mobile: Android phone in landscape (touch screen, pixels of 2.625 or o.dpr, Chrome Android; o.ua: another agent, an iPhone for example; o.pwa: lets the install prompt come up); otherwise a desktop screen
  const pg = o.mobile
    ? await (await b.newContext({ bypassCSP: !o.csp, viewport: { width: o.w || 915, height: o.h || 412 }, deviceScaleFactor: o.dpr || 2.625, isMobile: true, hasTouch: true, userAgent: o.ua || 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36' })).newPage()
    : await b.newPage({ bypassCSP: !o.csp, viewport: { width: o.w || 1280, height: o.h || 720 } }); // page CSP (build.py) lifted: the tools evaluate text (waitForFunction); o.csp keeps it (visual/csp.js)
  const settings = Object.assign({ quality: 'high', sv: 7, dynres: false, eco: false }, o.settings || {}); // sv: settings version (01-core.js); when up to date, the settings passed in are not migrated; eco: no frame rate limit and no touch prompt (09zl-economy.js), o.settings.eco turns them on
  await pg.addInitScript(`try{localStorage.setItem('dc_settings', ${JSON.stringify(JSON.stringify(settings))})}catch(e){}`);
  if (o.mobile && !o.pwa) await pg.addInitScript(`try{localStorage.setItem('dc_pwa_ok', String(Date.now()))}catch(e){}`); // on a phone, the game does not start without installation (09r-pwa.js): o.pwa lets the install prompt come up
  // start countdown (src/09y-countdown.js): off, the tools deploy then play right away; o.countdown: its duration in seconds (true: the game's own)
  if (o.countdown !== true) await pg.addInitScript(`window.MATCH_COUNTDOWN = ${JSON.stringify(o.countdown === undefined ? 0 : +o.countdown)}`);
  if (o.init) await pg.addInitScript(o.init); // o.init: script run before the page (to simulate app mode, for example)
  const logs = [];
  pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
  pg.on('pageerror', (e) => logs.push(`[pageerror] ${e}`));
  await pg.route('**/*', async (r) => {
    const u = r.request().url();
    if (u.includes('three@0.147.0/')) return r.fulfill({ path: path.join(HERE, 'node_modules/three', u.split('three@0.147.0/')[1]), contentType: 'application/javascript' });
    if (u.includes('@pmndrs/assets@1.7.0/') && !o.noHdri) return r.fulfill({ path: path.join(HERE, 'node_modules/@pmndrs/assets', u.split('@pmndrs/assets@1.7.0/')[1]), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } });
    if (o.noHdri && u.includes('/tex/hdri_')) return r.abort();
    if (u.includes('@pmndrs') || u.includes('peerjs') || u.includes('fonts.g') || u.endsWith('.mp3') || u.includes('version.json')) return r.abort();
    return r.continue();
  });
  await pg.goto(o.url || 'file://' + (o.page || path.join(REPO, 'dist/index.html'))); // o.url: page served by tools/dev/api-dev.js (accounts)
  if (o.gate) return { browser: b, page: pg, logs }; // o.gate: the game waits behind the install prompt, nothing to wait for
  await pg.waitForFunction(() => typeof MATCH !== 'undefined' && MATCH.state === 'menu', null, { timeout: 600000, polling: 500 });
  // the map is only built when a match starts (older versions built it at startup)
  if (!o.noMap) await pg.evaluate(() => (typeof mapEnsure === 'function' ? mapEnsure(Settings.map) : null));
  return { browser: b, page: pg, logs: logs.filter((l) => !l.includes('ERR_FAILED')) };
}
module.exports = { openGame, REPO, HERE };
