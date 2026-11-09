/* Steam Deck on the game side (src/09ra-deck.js, README "Steam Deck"): node tools/dev/visual/deck.js [captures folder]
   dist/ served locally, Chromium with the screen (1280 x 800, touch) and the user agent of a Steam Deck:
   - Deck browser in Desktop mode: no phone install window or card, the "Install on Steam Deck" card, the downloaded
     file (.desktop shortcut that installs from the page address), the card that says what to do next;
   - game launched by Steam (?deck=1): no touch screen or touch controls, no install window, no Fullscreen button; without a
     gamepad, the controls layout card, which disappears when a gamepad connects; the Steam keyboard reminder;
   - Android phone: nothing changed (usual install window).
   The installer itself: python3 tools/dev/check_deck.py. Exits with an error code at the slightest failure. */
const { chromium } = require('playwright-core');
const http = require('http'), fs = require('fs'), path = require('path');
const { REPO } = require('./common');
const DIST = path.join(REPO, 'dist'), HERE = __dirname, OUT = process.argv[2];
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'ok    : ' : 'FAIL  : ') + m); };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html'; const f = path.join(DIST, u); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'application/javascript' : f.endsWith('.sh') ? 'text/plain' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
(async () => {
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${srv.address().port}`;
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const open = async (q, ctx) => {
    const c = await b.newContext(Object.assign({ bypassCSP: true, viewport: { width: 1280, height: 800 }, screen: { width: 1280, height: 800 }, hasTouch: true, acceptDownloads: true }, ctx || {}));
    await c.addInitScript(`try{localStorage.setItem('dc_settings', ${JSON.stringify(JSON.stringify({ quality: 'low', sv: 7, dynres: false, eco: false }))})}catch(e){}`);
    const p = await c.newPage(), logs = []; p.on('pageerror', (e) => logs.push(String(e)));
    await p.route('**/*', (r) => { const u = r.request().url(); if (u.includes('three@0.147.0/')) return r.fulfill({ path: path.join(HERE, 'node_modules/three', u.split('three@0.147.0/')[1]), contentType: 'application/javascript' }); if (u.includes('@pmndrs') || u.includes('peerjs') || u.includes('fonts.g') || u.endsWith('.mp3') || u.includes('version.json') || u.includes('/api/')) return r.abort(); return r.continue(); });
    await p.goto(base + '/' + q);
    return { c, p, logs };
  };
  const LINUX = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
  // 1. Deck browser in Desktop mode
  {
    const { c, p, logs } = await open('', { userAgent: LINUX });
    await p.waitForFunction("typeof MATCH!=='undefined' && MATCH.state==='menu'", null, { timeout: 300000 });
    const st = await p.evaluate(() => ({ deck: DECK, look: deckLooksLike(), gate: document.body.classList.contains('gated'), card: !$('deckCard').classList.contains('hidden'), pwa: !$('pwaCard').classList.contains('hidden'), btn: $('deckGo').textContent, txt: $('deckTxt').textContent }));
    ok(!st.deck && st.look, 'Desktop mode: recognized as a Steam Deck, not in Deck mode');
    ok(!st.gate && !st.pwa, 'Desktop mode: no phone install window or card');
    ok(st.card && st.btn === 'Install on Steam Deck', 'Desktop mode: card "' + st.btn + '": ' + st.txt);
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#deckGo')]);
    const txt = fs.readFileSync(await dl.path(), 'utf8');
    ok(dl.suggestedFilename() === 'Install War Bash.desktop', 'downloaded file: ' + dl.suggestedFilename());
    ok(txt.includes(`Exec=bash -c "curl -fsSL --create-dirs ${base}/deck/installer.sh -o ~/.cache/warbash-installer.sh && bash ~/.cache/warbash-installer.sh ${base}"`) && /Terminal=true/.test(txt) && !/[$`\\]/.test(txt.split('Exec=')[1]), 'shortcut: installs from the page address (' + base + ')');
    ok(await p.evaluate(() => $('deckGo').textContent === 'Download again' && /Downloads/.test($('deckTxt').textContent)), 'after the download: the card says what to do');
    if (OUT) await p.screenshot({ path: path.join(OUT, 'deck-desktop.png') });
    ok(!logs.length, 'Desktop mode: no error' + (logs.length ? ' ' + logs[0] : ''));
    await c.close();
  }
  // 2. game launched by Steam (?deck=1), Deck touch screen
  {
    const { c, p, logs } = await open('?deck=1', { userAgent: LINUX });
    await p.waitForFunction("typeof MATCH!=='undefined' && MATCH.state==='menu'", null, { timeout: 300000 });
    const st = await p.evaluate(() => ({ deck: DECK, coarse: COARSE, touch: TOUCH.on, gate: document.body.classList.contains('gated'), fs: $('fsBtn').classList.contains('hidden'), card: !$('deckCard').classList.contains('hidden'), tier: RQ.q.label }));
    ok(st.deck && !st.coarse && !st.touch, 'Deck mode: no touch screen or touch controls');
    ok(!st.gate, 'Deck mode: no install window');
    ok(st.fs, 'Deck mode: Fullscreen button hidden');
    ok(!st.card, 'Deck mode: no card at startup');
    await p.waitForTimeout(6000); await p.evaluate(() => deckCard());
    const hint = await p.evaluate(() => (!$('deckCard').classList.contains('hidden') && $('deckGo').classList.contains('hidden')) ? $('deckTxt').textContent : '');
    ok(/Gamepad with Mouse Trackpad/.test(hint), 'Deck mode, no gamepad: the card shows the layout: ' + hint);
    if (OUT) await p.screenshot({ path: path.join(OUT, 'deck-no-gamepad.png') });
    await p.evaluate(() => dispatchEvent(Object.assign(new Event('gamepadconnected'), { gamepad: { id: 'Microsoft X-Box 360 pad 0 (STANDARD GAMEPAD Vendor: 28de Product: 11ff)' } })));
    ok(await p.evaluate(() => $('deckCard').classList.contains('hidden')), 'Deck mode: gamepad seen, the card fades out');
    await p.evaluate(() => { const i = document.createElement('input'); i.type = 'text'; document.body.appendChild(i); i.focus(); });
    ok(await p.evaluate(() => !$('deckKb').classList.contains('hidden') && $('deckKb').textContent), 'Deck mode: text field, Steam keyboard reminder');
    await p.evaluate(() => document.activeElement.blur());
    ok(await p.evaluate(() => $('deckKb').classList.contains('hidden')), 'Deck mode: reminder removed from view');
    ok(!logs.length, 'Deck mode: no error' + (logs.length ? ' ' + logs[0] : ''));
    await c.close();
  }
  // 3. Android phone: nothing changes (install window, no Deck card)
  {
    const { c, p } = await open('', { viewport: { width: 915, height: 412 }, screen: { width: 915, height: 412 }, isMobile: true, deviceScaleFactor: 2.625, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36' });
    await p.waitForFunction("document.body.classList.contains('gated')", null, { timeout: 120000 }).catch(() => {});
    const st = await p.evaluate(() => ({ gate: document.body.classList.contains('gated'), look: deckLooksLike(), deck: DECK }));
    ok(st.gate && !st.look && !st.deck, 'phone: usual install window, no Steam Deck');
    await c.close();
  }
  await b.close(); srv.close();
  console.log(fails ? `${fails} failure(s)` : 'all good'); process.exit(fails ? 1 : 0);
})();
