/* Install (PWA) check: node tools/dev/visual/pwa.js [screenshots folder]
   Serves dist/ locally (localhost is a secure context: the service worker registers there) and checks:
   - the manifest and its icons, the service worker (active, caches fingerprinted files, leaves the page to the network);
   - installation first on a touch screen in a browser: the window shows right away (portrait included, before "Rotate
     your phone"), the game does not start behind it; Android with the browser prompt (Install button, active at the prompt),
     browser without prompt (manual steps), iPhone (Safari steps); the waiver ("Can't install?");
     app installed or launched from the icon: the game starts without the window; account verification links, lobby invitation;
   - nothing on desktop.
   Exits with an error code at the first failure. WebKit (iPhone) is not available here: the iPhone is simulated by its user
   agent, which checks our logic, not the real behavior of Safari. */
const { openGame, REPO } = require('./common');
const http = require('http'), fs = require('fs'), path = require('path');
const DIST = path.join(REPO, 'dist');
const out = process.argv[2];
if (out) fs.mkdirSync(out, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg' };
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
// Safari on iPad presents itself as a Mac: only the MacIntel platform and the touch screen give it away
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const IPAD_INIT = "Object.defineProperty(Navigator.prototype, 'platform', { get: () => 'MacIntel' }); Object.defineProperty(Navigator.prototype, 'maxTouchPoints', { get: () => 5 });";
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL  :', msg); } else console.log('ok    :', msg); };
const hits = {};
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); hits[u] = (hits[u] || 0) + 1;
  const f = path.join(DIST, u === '/' ? 'index.html' : u);
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res);
});
const MENU = "typeof MATCH!=='undefined' && MATCH.state==='menu'";
const shown = (page, id) => page.evaluate((i) => !document.getElementById(i).classList.contains('hidden'), id);
const announce = (page) => page.evaluate(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = () => { window.__prompted = (window.__prompted || 0) + 1; return Promise.resolve(); }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); return e.defaultPrevented; });
const wait = (page, cond, ms) => page.waitForFunction(cond, null, { timeout: ms || 15000, polling: 100 }).then(() => true, () => false);
let base = '';
const open = async (o) => {
  const g = await openGame(Object.assign({ mobile: true, pwa: !!(o && o.gate), dpr: 1, url: `${base}/index.html`, settings: { quality: 'low', touch: 'on' }, noHdri: true, noMap: true }, o || {})); // without o.gate: waiver already granted (the game starts); o.gate: the game waits behind the install window
  return g;
};
const shot = async (g, name) => { if (out) { await g.page.waitForTimeout(400); await g.page.screenshot({ path: path.join(out, `pwa-${name}.png`) }); } };

const STANDALONE = "const mm = window.matchMedia.bind(window); window.matchMedia = (q) => (/display-mode: (fullscreen|standalone)/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q));";
const gateOpen = (page) => page.evaluate(() => !document.getElementById('pwaOffer').classList.contains('hidden'));
const started = (page) => page.evaluate(() => typeof MATCH !== 'undefined' && MATCH.state === 'menu');
const txt = (page, id) => page.evaluate((i) => document.getElementById(i).textContent, id);

(async () => {
  await new Promise((r) => srv.listen(0, r));
  base = `http://localhost:${srv.address().port}`;

  // 1. manifest and service worker (waiver granted: the game starts normally)
  {
    const g = await open(), { page } = g;
    const href = await page.evaluate(() => document.querySelector('link[rel=manifest]').href);
    const m = await (await fetch(href)).json();
    ok(m.display === 'fullscreen' && m.orientation === 'landscape', `manifest: fullscreen, landscape (${m.display}, ${m.orientation})`);
    ok(m.start_url && m.scope && m.id && m.name && m.short_name, 'manifest: id, start_url, scope, names');
    const purposes = new Set((m.icons || []).map((i) => i.purpose || 'any')); ok(purposes.has('any') && purposes.has('maskable'), 'manifest: any and maskable icons');
    const sizes = new Set((m.icons || []).map((i) => i.sizes)); ok(sizes.has('192x192') && sizes.has('512x512'), 'manifest: 192 and 512 icons');
    let allIcons = true; for (const i of m.icons) { const r = await fetch(new URL(i.src, href)); if (r.status !== 200 || !/png/.test(r.headers.get('content-type') || '')) allIcons = false; }
    ok(allIcons, `manifest: ${m.icons.length} icons served`);
    const sw = await page.evaluate(async () => { const r = await Promise.race([navigator.serviceWorker.ready, new Promise((x) => setTimeout(() => x(null), 15000))]); return r ? { scope: r.scope, active: !!r.active } : null; });
    ok(sw && sw.active, `service worker active (${sw && sw.scope})`);
    const icon = new URL(m.icons[0].src, href).pathname;
    const fetchTwice = () => page.evaluate(async (u) => { const a = await fetch(u); await a.arrayBuffer(); const b = await fetch(u); await b.arrayBuffer(); }, icon);
    await page.reload(); await page.waitForFunction(MENU, null, { timeout: 120000 });
    ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'service worker controls the page after reload');
    await fetchTwice(); await page.waitForTimeout(400);
    const cached = await page.evaluate(async (u) => { const keys = await caches.keys(); const c = await caches.open('cod-files-v1'); return { keys, has: !!(await c.match(u)), others: (await c.keys()).map((r) => new URL(r.url).pathname).filter((p) => !/^\/(tex|maps|icons)\//.test(p)) }; }, icon);
    ok(cached.keys.length === 1 && cached.has, `fingerprinted file in cache (${icon})`);
    ok(cached.others.length === 0, "nothing else cached: no page, no API, no version.json");
    const before = hits[icon] || 0; await fetchTwice(); ok((hits[icon] || 0) === before, 'the second load of the fingerprinted file does not go through the network');
    const pageHits = hits['/index.html'] || 0; await page.reload(); await page.waitForFunction(MENU, null, { timeout: 120000 });
    ok((hits['/index.html'] || 0) > pageHits, 'the page, however, is still requested from the network (automatic update intact)');
    await g.browser.close();
  }

  // 2. Android, browser with prompt: window right away, button active at the prompt, game blocked behind, then "installed"
  {
    const g = await open({ gate: true }), { page } = g;
    ok(await wait(page, "!document.getElementById('pwaOffer').classList.contains('hidden')", 8000), "the install window is there from the start, without waiting for the menu");
    ok(!(await started(page)), 'the game does not start behind the window');
    const t0 = await page.evaluate(() => ({ go: document.getElementById('poGo').textContent, dis: document.getElementById('poGo').disabled, hid: document.getElementById('poGo').classList.contains('hidden'), steps: document.getElementById('poSteps').classList.contains('hidden'), help: !document.getElementById('poHelp').classList.contains('hidden'), alt: document.getElementById('poAlt').classList.contains('hidden'), title: document.getElementById('poTitle').textContent }));
    ok(t0.go === "Install the app" && t0.dis && !t0.hid && t0.steps, "while waiting for the browser prompt: button visible but not yet active, no steps");
    ok(t0.help && t0.alt, "discreet \"Impossible d'installer ?\", no button to play in the browser");
    ok(await announce(page), 'beforeinstallprompt: browser prompt held back');
    ok(await page.evaluate(() => !document.getElementById('poGo').disabled), "at the prompt, the install button becomes active");
    await shot(g, 'android');
    await page.click('#poGo');
    ok(await wait(page, '(window.__prompted || 0) === 1'), 'Install button: browser prompt opened');
    ok(await wait(page, "document.getElementById('poTitle').textContent === 'Installed!'"), '"Installed!": tells the user to open the icon');
    ok(await page.evaluate(() => document.getElementById('poGo').classList.contains('hidden') && !!(+localStorage.getItem('dc_pwa_in'))), 'no more button, installation remembered');
    ok(!(await started(page)), "the game stays blocked in the tab: the app is opened");
    await shot(g, 'installed');
    // waiver
    await page.click('#poHelp');
    ok(await page.evaluate(() => !document.getElementById('poAlt').classList.contains('hidden') && document.getElementById('poHelp').classList.contains('hidden')), "\"Impossible d'installer ?\" shows the waiver");
    await page.click('#poNo');
    ok(await wait(page, MENU, 120000), 'play in the browser anyway: the game starts');
    ok(!(await gateOpen(page)), 'window closed');
    ok(await page.evaluate(() => +localStorage.getItem('dc_pwa_ok') > 0), 'waiver remembered (one week)');
    await page.reload(); ok(await wait(page, MENU, 120000) && !(await gateOpen(page)), 'reload: no more window during the waiver');
    await g.browser.close();
  }

  // 3. browser without prompt: after the wait, manual steps, no button; the menu card reopens the window
  {
    const g = await open({ w: 667, h: 375, gate: true }), { page } = g;
    ok(await gateOpen(page), 'without prompt: the window is open right away');
    ok(await wait(page, "document.querySelectorAll('#poSteps li').length === 3", 8000), "after the wait (3.5 s): three manual steps");
    const t = await page.evaluate(() => ({ go: document.getElementById('poGo').classList.contains('hidden'), steps: document.getElementById('poSteps').classList.contains('hidden'), btnsInView: (() => { const b = document.getElementById('poHelp').getBoundingClientRect(); return b.bottom <= innerHeight + 1; })() }));
    ok(t.go && !t.steps, 'manual steps: no Install button');
    ok(t.btnsInView, "low landscape: \"Impossible d'installer ?\" stays on screen");
    await shot(g, 'manual');
    ok(await announce(page) && (await page.evaluate(() => !document.getElementById('poGo').classList.contains('hidden') && !document.getElementById('poGo').disabled)), "late prompt: the install button takes over");
    await page.evaluate(() => { PWA.prompt = null; pwaRender(); });
    await page.click('#poHelp'); await page.click('#poNo');
    ok(await wait(page, MENU, 120000), 'waiver: the game starts');
    ok(await shown(page, 'pwaCard'), 'the menu card stays, as a reminder');
    await page.evaluate(() => { const b = document.getElementById('wnOk'); if (b) b.click(); });
    await page.click('#pwaGo');
    ok(await gateOpen(page), 'the menu card reopens the window');
    const c = await page.evaluate(() => ({ no: document.getElementById('poNo').textContent, helpHidden: document.getElementById('poHelp').classList.contains('hidden'), altShown: !document.getElementById('poAlt').classList.contains('hidden') }));
    ok(c.no === 'Later' && c.helpHidden && c.altShown, 'reopened from the menu: "Later" closes, no blocking');
    await page.click('#poNo'); ok(!(await gateOpen(page)), '"Later" closes the window');
    await page.evaluate(() => localStorage.setItem('dc_pwa_ok', String(Date.now() - 8 * 24 * 3600 * 1000)));
    await page.reload();
    ok(await wait(page, "!document.getElementById('pwaOffer').classList.contains('hidden')", 8000) && !(await started(page)), 'a week later, the window comes back and blocks again');
    await g.browser.close();
  }

  // 4. iPhone in portrait: no prompt, the Safari steps right away, in front of "Turn your device"
  {
    const g = await open({ ua: IPHONE, w: 390, h: 844, gate: true }), { page } = g;
    ok(await wait(page, "document.querySelectorAll('#poSteps li').length === 3", 8000), "iPhone: the window opens immediately with the steps, without waiting for a prompt");
    const t = await page.evaluate(() => ({ go: document.getElementById('poGo').classList.contains('hidden'), steps: [...document.querySelectorAll('#poSteps li span')].map((e) => e.textContent), note: !document.getElementById('poNote').classList.contains('hidden') }));
    ok(t.steps.length === 3 && /Share/.test(t.steps[0]) && /Home Screen/.test(t.steps[1]) && t.go && t.note, "iPhone: Share, \"Add to Home Screen\", Add, the orientation note, no button");
    const r = await page.evaluate(() => { const o = document.getElementById('pwaOffer'), rot = document.getElementById('rotate'); return { z: +getComputedStyle(o).zIndex > +getComputedStyle(rot).zIndex, rot: getComputedStyle(rot).display !== 'none', help: (() => { const b = document.getElementById('poHelp').getBoundingClientRect(); return b.bottom <= innerHeight + 1 || o.scrollHeight > innerHeight; })() }; });
    ok(r.rot && r.z, "portrait: \"Turn your device\" exists but the install window is in front");
    ok(r.help, 'portrait: everything is reachable');
    await shot(g, 'iphone-portrait');
    await page.setViewportSize({ width: 844, height: 390 }); await shot(g, 'iphone');
    ok(await page.evaluate(() => { const b = document.getElementById('poHelp').getBoundingClientRect(); return b.bottom <= innerHeight + 1 || document.getElementById('pwaOffer').scrollHeight > innerHeight; }), 'landscape: everything is reachable (scrolling if needed)');
    await g.browser.close();
  }

  // 4 bis. iPad in landscape (4:3): recognized despite its Mac agent, the Safari steps, everything on screen
  {
    const g = await open({ ua: IPAD, init: IPAD_INIT, w: 1024, h: 768, gate: true }), { page } = g;
    ok(await wait(page, "document.querySelectorAll('#poSteps li').length === 3", 8000), "iPad: recognized as iOS, the window shows the Safari steps");
    const t = await page.evaluate(() => ({ steps: [...document.querySelectorAll('#poSteps li span')].map((e) => e.textContent), note: document.getElementById('poNote').textContent, help: (() => { const b = document.getElementById('poHelp').getBoundingClientRect(); return b.bottom <= innerHeight + 1 && b.height > 0; })() }));
    ok(/Share/.test(t.steps[0]) && /iPad/.test(t.note) && t.help, `iPad: Share, the orientation note (${t.note}), everything on screen`);
    await shot(g, 'ipad');
    await g.browser.close();
  }

  // 5. game launched from the icon (app mode): no window, the game starts, and it is remembered for the browser
  {
    const g = await open({ init: STANDALONE, gate: true, pwa: true }), { page } = g;
    ok(await wait(page, MENU, 120000), 'app installed: the game starts without a window');
    await page.waitForTimeout(1500);
    ok(!(await gateOpen(page)) && !(await shown(page, 'pwaCard')), 'app installed: neither window nor card');
    ok(await page.evaluate(() => +localStorage.getItem('dc_pwa_in') > 0), "launched from the icon: remembered for the browser on the same phone");
    await g.browser.close();
  }

  // 6. already installed (seen from the icon), but opened in the browser: tell the user to open the icon, the waiver is offered from the start
  {
    const g = await open({ gate: true, init: "try{localStorage.setItem('dc_pwa_in', String(Date.now()))}catch(e){}" }), { page } = g;
    ok(await gateOpen(page), 'installed but opened in the browser: window');
    const t = await page.evaluate(() => ({ title: document.getElementById('poTitle').textContent, alt: !document.getElementById('poAlt').classList.contains('hidden'), go: document.getElementById('poGo').classList.contains('hidden') }));
    ok(t.title === 'The game is already installed' && t.alt && t.go, `"${t.title}": waiver offered from the start, no Install button`);
    await g.browser.close();
  }

  // 7. links: account verification (no window), lobby invitation (kept for the app)
  {
    const g = await open({ gate: true, url: `${base}/index.html?verif=abc123` }), { page } = g;
    ok(await wait(page, MENU, 120000) && !(await gateOpen(page)), 'account verification link: no window, the game starts');
    await g.browser.close();
    const g2 = await open({ gate: true, url: `${base}/index.html?lobby=ABCDE` });
    ok(await gateOpen(g2.page), "lobby invitation in the browser: install window");
    const kept = await g2.page.evaluate(() => JSON.parse(localStorage.getItem('dc_lobby') || 'null'));
    ok(kept && kept.c === 'ABCDE', `the lobby code is kept for the app (${kept && kept.c})`);
    const code = await g2.page.evaluate(() => { PWA.standalone = true; return pwaLobby(); });
    ok(code === 'ABCDE', "the app finds the lobby code again");
    ok(await g2.page.evaluate(() => { PWA.standalone = true; return pwaLobby(); }) === null, 'and does not replay it');
    await g2.browser.close();
  }

  // 8. desktop: never
  {
    const g = await openGame({ url: `${base}/index.html`, w: 960, h: 540, settings: { quality: 'low' }, noHdri: true, noMap: true }), { page } = g;
    await announce(page); await page.waitForTimeout(3000);
    ok(!(await gateOpen(page)) && !(await shown(page, 'pwaCard')), "desktop: neither window nor card, even if the browser announces installation");
    await g.browser.close();
  }
  srv.close();
  console.log(fails ? `${fails} failure(s)` : 'all good');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
