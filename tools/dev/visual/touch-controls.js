/* Check of the mobile version: node tools/dev/visual/touch-controls.js [screenshots folder]
   For several phone sizes in landscape: starts a match with touch controls, shows all the buttons, records the
   overlaps (buttons with each other, buttons and interface elements) and the screen overflows. Then plays by finger (real
   touch events, through the debugging protocol): joystick, look, fire, aim, jump, reload, weapon switch, pause, several fingers
   at once. Overlaps are recorded in three modes: default (auto-fire and double tap to aim: neither fire button nor Aim button),
   auto-fire only (aiming in place of firing) and manual fire; finger play is done in manual fire, then auto-fire is checked (buttons, continuous
   fire of a pistol at an enemy in front), then the double tap (two brief taps shoulder the weapon, two others put it away, a single tap or a look does not),
   death and the killcam by finger ("Tap" prompt, a tap makes the player respawn).
   Finally, the portrait screen must ask to rotate the phone. Exits with an error code at the first failure. */
const { openGame } = require('./common');
const path = require('path');
const out = process.argv[2];
if (out) require('fs').mkdirSync(out, { recursive: true });
const SIZES = process.env.SCREEN_SIZES ? process.env.SCREEN_SIZES.split(',').map((t) => t.split('x').map(Number)) // SCREEN_SIZES=1024x768,1366x1024: only these sizes
  : [[915, 412], [844, 390], [740, 360], [667, 375], [1024, 460], [1024, 768], [1366, 1024]]; // the last two: iPad in landscape (4:3)
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL  :', msg); } else console.log('ok    :', msg); };
const inter = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;

async function start(w, h, dpr, auto = true, dbl = true) {
  const g = await openGame({ mobile: true, w, h, dpr, settings: { quality: 'low', map: 'chergui', touch: 'on', tcAuto: auto, tcDblAds: dbl }, noHdri: true, init: "try{localStorage.setItem('dc_touch_help','1')}catch(e){}" }); // (the first-launch help otherwise swallows the first tap)
  const { page } = g;
  await page.evaluate(() => { const b = document.getElementById('wnOk'); if (b) b.click(); });
  await page.evaluate(() => { toMenu('solo'); menuLaunch({ online: false, map: Settings.map, deploy: () => startMatch() }); });
  await page.waitForFunction("UI.screen==='deploy'", null, { timeout: 120000 });
  await page.evaluate(() => document.getElementById('depGo').click());
  await page.waitForFunction("MATCH.state==='playing' && PL.ent.alive", null, { timeout: 120000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => { const h = document.getElementById('tcHelp'); if (h) h.classList.add('hidden'); });
  g.cdp = await page.context().newCDPSession(page);
  return g;
}
/* Touch event clock: software rendering is slow, the real gap between two events says nothing about the gesture; it restarts from real time
   at each finger put down, adv: seconds elapsed in the gesture */
let clk = Date.now() / 1000;
const touch = (g, type, pts, adv) => { clk = type === 'touchStart' ? Date.now() / 1000 : clk + (adv === undefined ? 0.03 : adv); return g.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id: id || 0 })), timestamp: clk }); };
/* waits for a condition in the page (software rendering is slow: a few frames per second, sometimes one) */
const until = (g, cond, ms) => g.page.waitForFunction(cond, null, { timeout: ms || 90000, polling: 100 }).then(() => true, () => false);
const center = (g, sel) => g.page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);

(async () => {
  // 1. overlaps for each size
  for (const [w, h] of process.env.IN_GAME ? [] : SIZES) { // IN_GAME=1: skips the overlap checks, only plays
    const g = await start(w, h, 1.5), { page } = g;
    await page.evaluate(() => {
      touchTick = () => {}; // freeze the contextual buttons: show them all
      TC.root.classList.remove('hidden', 'dead', 'map');
      for (const b of document.querySelectorAll('.tcb')) b.classList.remove('gone');
      document.getElementById('killfeed').innerHTML = '<div class="kf">Player<i>M4A1</i>Bot Alpha</div><div class="kf">Bot<i>M9</i>Bot Bravo</div>';
      document.getElementById('msg').textContent = 'Test message'; document.getElementById('msg').classList.add('show');
      document.getElementById('hp').style.opacity = 1;
    });
    for (const [auto, dbl] of [[true, true], [true, false], [false, false]]) {
      await page.evaluate(([a, d]) => { Settings.tcAuto = a; Settings.tcDblAds = d; touchModeSync(); }, [auto, dbl]);
      await page.waitForTimeout(300);
      const r = await page.evaluate(() => {
        const box = (e) => { const b = e.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom }; };
        const btn = [...document.querySelectorAll('.tcb')].map((e) => ({ id: e.dataset.tc, ...box(e) })).filter((b) => b.right - b.left > 1);
        const hud = ['.mm', '.score', '.ammo', '#killfeed', '#hp', '#msg', '#hitmarker', '#tcStick i'].map((s) => ({ id: s, ...box(document.querySelector(s)) }));
        return { btn, hud, w: innerWidth, h: innerHeight, u: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u')) };
      });
      const bad = [];
      for (let i = 0; i < r.btn.length; i++) {
        const a = r.btn[i];
        if (a.left < 0 || a.top < 0 || a.right > r.w || a.bottom > r.h) bad.push(`${a.id} off screen`);
        for (let j = i + 1; j < r.btn.length; j++) if (inter(a, r.btn[j])) bad.push(`${a.id} / ${r.btn[j].id}`);
        for (const e of r.hud) if (e.id !== '#hitmarker' && inter(a, e)) bad.push(`${a.id} / ${e.id}`);
      }
      for (let i = 0; i < r.hud.length; i++) for (let j = i + 1; j < r.hud.length; j++) { const a = r.hud[i], b = r.hud[j]; if (a.id === '#tcStick i' || b.id === '#tcStick i' || a.id === '#hitmarker' || b.id === '#hitmarker' || a.id === '#msg' || b.id === '#msg') continue; if (inter(a, b)) bad.push(`${a.id} / ${b.id}`); }
      const want = 15 - (auto ? 1 : 0) - (dbl ? 1 : 0), mode = dbl ? 'auto-fire and double tap' : auto ? 'auto-fire' : 'manual fire';
      ok(r.btn.length === want && bad.length === 0, `${w}x${h}, ${mode}: no overlap (${r.btn.length} buttons visible out of ${want}, three are removed by the original layout${auto ? ', no fire button' : ''}${dbl ? ', no Aim button' : ''})${bad.length ? ': ' + bad.join(', ') : ''}`);
      if (dbl) ok(await page.evaluate(() => getComputedStyle(TC.el.ads).display === 'none'), `${w}x${h}, double tap: no Aim button`);
      if (dbl) { // layout slots: at the same distance from the edges as on a phone 100 u high (at most 222 u wide), whatever the screen size
        const q = await page.evaluate(() => {
          const W = innerWidth, H = innerHeight, Hb = Math.min(H, 560), Wb = H > 560 ? Math.min(W, 1244) : W, u = TOUCH.R / 12.5, bad = [];
          for (const [id, L] of Object.entries(TC.lay)) {
            const e = TC.el[id]; if (!e || L[3] || (id !== 'stick' && !e.classList.contains('ov'))) continue;
            const r = (id === 'stick' ? e.firstChild : e).getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            if (r.width < 1) continue;
            if (L[1] >= 0.4 && Math.abs(H - cy - (1 - L[1]) * Hb) > 1.5) bad.push(`${id} at ${((H - cy) / u).toFixed(1)} u from the bottom instead of ${((1 - L[1]) * Hb / u).toFixed(1)}`);
            if (L[0] >= 0.6 && Math.abs(W - cx - (1 - L[0]) * Wb) > 1.5) bad.push(`${id} at ${((W - cx) / u).toFixed(1)} u from the right instead of ${((1 - L[0]) * Wb / u).toFixed(1)}`);
            if (L[0] <= 0.4 && Math.abs(cx - L[0] * Wb) > 1.5) bad.push(`${id} at ${(cx / u).toFixed(1)} u from the left instead of ${(L[0] * Wb / u).toFixed(1)}`);
          }
          // round trip (floating joystick, drag in edit mode): the touchFrac fraction puts the circle back under the finger, anywhere on the screen
          for (const [fx, fy] of [[0.1, 0.9], [0.3, 0.25], [0.45, 0.33], [0.5, 0.5], [0.58, 0.15], [0.9, 0.6]]) {
            const X = fx * W, Y = fy * H; TC.el.stick.style.setProperty('--fx', touchFrac(X, 'x')); TC.el.stick.style.setProperty('--fy', touchFrac(Y, 'y'));
            const g = touchStickGeom(); if (Math.abs(g.cx - X) > 1 || Math.abs(g.cy - Y) > 1) bad.push(`joystick placed at ${Math.round(X)}, ${Math.round(Y)} but drawn at ${Math.round(g.cx)}, ${Math.round(g.cy)}`);
          }
          touchLayoutOne('stick'); // (its original place)
          const n = TC.el.nade.getBoundingClientRect();
          return { bad, nade: (H - n.top - n.height / 2) / u };
        });
        ok(q.bad.length === 0, `${w}x${h}, layout at the same distance from the edges as on a phone (grenade at ${q.nade.toFixed(1)} u from the bottom)${q.bad.length ? ': ' + q.bad.join(', ') : ''}`);
      }
      if (auto && !dbl) {
        const q = await page.evaluate(() => { const a = TC.el.ads.getBoundingClientRect(), F = TC.lay.fire; return { fire: getComputedStyle(TC.el.fire).display, fireL: getComputedStyle(TC.el.fireL).display, ax: touchFrac(a.left + a.width / 2, 'x'), ay: touchFrac(a.top + a.height / 2, 'y'), as: a.height / (TOUCH.R / 12.5), F }; });
        ok(q.fire === 'none' && q.fireL === 'none' && Math.abs(q.ax - q.F[0]) < 0.01 && Math.abs(q.ay - q.F[1]) < 0.01 && Math.abs(q.as - q.F[2]) < 0.6, `${w}x${h}, auto-fire: no fire button, aim in its place and at its size (${q.as.toFixed(1)} u)`);
      }
      if (out) await page.screenshot({ path: path.join(out, `t-${w}x${h}-${dbl ? 'default' : auto ? 'auto' : 'manual'}.png`) });
    }

    await g.browser.close();
  }

  // 2. finger play (manual fire: fire button; aim by button)
  const g = await start(915, 412, 1, false, false), { page } = g;
  const P = (e) => page.evaluate(e);
  ok(await P('TOUCH.on === true && document.body.classList.contains("touch")'), 'touch controls active, class body.touch');
  ok(await P('pointerActive()'), 'pointerActive() true (no mouse capture)');
  // fixed joystick: the center of its circle does not move, the finger's offset says walk or run
  await P("Settings.tcStick = 'fixed'"); await page.waitForTimeout(300);
  const G = await P('touchStickGeom()'); const sx0 = G.cx, sy0 = G.cy, R = G.R;
  await touch(g, 'touchStart', [[sx0 + 8, sy0, 1]]);
  let s = await P('({mx: TOUCH.mx, mz: TOUCH.mz, sprint: TOUCH.sprint})'); ok(Math.abs(s.mz) < 0.2, `finger placed near the center: almost still (mz ${s.mz.toFixed(2)})`);
  await touch(g, 'touchMove', [[sx0, sy0 - R * 0.55, 1]]);
  s = await P('({mx: TOUCH.mx, mz: TOUCH.mz, sprint: TOUCH.sprint})');
  ok(s.mz > 0.2 && s.mz < 0.9 && !s.sprint, `joystick half pushed: proportional walk (mz ${s.mz.toFixed(2)})`);
  await touch(g, 'touchMove', [[sx0, sy0 - R * 1.0, 1]]);
  s = await P('({mx: TOUCH.mx, mz: TOUCH.mz, sprint: TOUCH.sprint})'); ok(s.mz > 0.95 && !s.sprint, `at the edge of the circle: full walk, no run (mz ${s.mz.toFixed(2)})`);
  await touch(g, 'touchMove', [[sx0, sy0 - R * 1.3, 1]]);
  s = await P('({mx: TOUCH.mx, mz: TOUCH.mz, sprint: TOUCH.sprint})'); ok(s.sprint, 'finger beyond the circle: run');
  ok(await P('TC.el.stick.classList.contains("run")'), 'joystick: running is visible (yellow ring)');
  const G2 = await P('touchStickGeom()'); ok(Math.abs(G2.cx - sx0) < 0.5 && Math.abs(G2.cy - sy0) < 0.5, 'the joystick does not follow the finger: center unchanged');
  await touch(g, 'touchMove', [[sx0, sy0 - R * 0.7, 1]]);
  s = await P('({sprint: TOUCH.sprint})'); ok(!s.sprint, 'finger back in the circle: back to walking');
  await touch(g, 'touchMove', [[sx0 + R * 1.3, sy0, 1]]); s = await P('({sprint: TOUCH.sprint, mx: TOUCH.mx})'); ok(!s.sprint && s.mx > 0.9, 'pushed far to the side: no run, it strafes');
  await touch(g, 'touchEnd', []); await page.waitForTimeout(200);
  s = await P('({sprint: TOUCH.sprint, mz: TOUCH.mz})'); ok(!s.sprint && s.mz === 0, 'joystick released: stop');
  // "Run button" setting: the joystick no longer starts running; the button locks it while moving forward
  await P("Settings.tcRun = 'button'; TC.el.run.classList.remove('off')"); await page.waitForTimeout(300);
  await touch(g, 'touchStart', [[sx0, sy0, 1]]); await touch(g, 'touchMove', [[sx0, sy0 - R * 1.4, 1]]);
  s = await P('({sprint: TOUCH.sprint})'); ok(!s.sprint, 'button setting: pushing the joystick does not make the player run');
  const [kx, ky] = await center(g, '[data-tc=run]'); await touch(g, 'touchStart', [[sx0, sy0 - R * 1.4, 1], [kx, ky, 9]]); await touch(g, 'touchEnd', [[kx, ky, 9]]);
  ok(await until(g, 'TOUCH.sprint === true && TC.runOn'), 'Run button: sprint while the joystick moves forward');
  await touch(g, 'touchEnd', []); await page.waitForTimeout(200);
  s = await P('({sprint: TOUCH.sprint, on: TC.runOn})'); ok(!s.sprint && !s.on, 'joystick released: running stops');
  await P("Settings.tcRun = 'stick'; TC.el.run.classList.add('off')");
  // floating joystick (default setting): nothing on screen, it appears under the finger, does not follow the slide and disappears on release
  await P("Settings.tcStick = 'float'"); await page.waitForTimeout(400);
  ok(await until(g, 'TC.root.classList.contains("float") && getComputedStyle(TC.el.stick).opacity === "0"'), 'floating joystick: nothing on screen until touched');
  await touch(g, 'touchStart', [[300, 170, 1]]);
  ok(await until(g, 'TC.el.stick.classList.contains("on")'), 'floating joystick: it appears under the finger');
  const F = await P('touchStickGeom()'); ok(Math.abs(F.cx - 300) < 1 && Math.abs(F.cy - 170) < 1, `floating joystick: centered on the finger (${Math.round(F.cx)}, ${Math.round(F.cy)})`);
  await touch(g, 'touchMove', [[300, 170 - F.R * 0.6, 1]]); await touch(g, 'touchMove', [[300 + F.R * 0.3, 170 - F.R * 1.4, 1]]);
  s = await P('({ mz: TOUCH.mz, sprint: TOUCH.sprint })'); ok(s.mz > 0.9 && s.sprint, 'floating joystick: a finger sliding beyond the circle makes the player run');
  const F2 = await P('touchStickGeom()'); ok(Math.abs(F2.cx - 300) < 1 && Math.abs(F2.cy - 170) < 1, 'floating joystick: it stays where the finger was put down');
  await touch(g, 'touchEnd', []); await page.waitForTimeout(300);
  ok(await P('!TC.el.stick.classList.contains("on") && TOUCH.mz === 0 && !TOUCH.sprint'), 'floating joystick: it disappears when the finger lifts');
  await touch(g, 'touchStart', [[700, 200, 2]]); ok(await P('!TC.el.stick.classList.contains("on") && !!TC.look'), 'right half: look, no joystick');
  await touch(g, 'touchEnd', []);
  await touch(g, 'touchStart', [[sx0, sy0, 1]]); await touch(g, 'touchMove', [[sx0, sy0 - R * 0.9, 1]]);
  const z0 = await P('PL.ent.pos.z + "," + PL.ent.pos.x');
  const adv = await until(g, `PL.ent.pos.z + "," + PL.ent.pos.x !== ${JSON.stringify(z0)}`); ok(adv, 'the player moves forward with the joystick');
  if (!adv) console.log('  state:', JSON.stringify(await P('({mz: TOUCH.mz, move: !!TC.move, sprint: TOUCH.sprint, st: MATCH.state, alive: PL.ent.alive, busy: typeof busy === "function" ? busy() : null, pos: [PL.ent.pos.x, PL.ent.pos.z], fps: DYN.stat.fps})')));
  await touch(g, 'touchEnd', []);
  s = await P('({mx: TOUCH.mx, mz: TOUCH.mz, sprint: TOUCH.sprint})'); ok(s.mx === 0 && s.mz === 0 && !s.sprint, 'joystick released: stop');
  // regard
  const yaw0 = await P('PL.yaw');
  await touch(g, 'touchStart', [[620, 200, 2]]); for (let i = 1; i <= 6; i++) await touch(g, 'touchMove', [[620 + i * 12, 200 + i * 3, 2]]); await touch(g, 'touchEnd', []);
  await until(g, `Math.abs(PL.yaw - ${yaw0}) > 0.02`);
  const yaw1 = await P('PL.yaw'); ok(Math.abs(yaw1 - yaw0) > 0.02, `sliding right turns the view (${(yaw1 - yaw0).toFixed(3)} rad)`);
  // fire
  const [fx, fy] = await center(g, '[data-tc=fire]'); const mag0 = await P('curW().mag');
  await touch(g, 'touchStart', [[fx, fy, 3]]);
  ok(await P('PL.held'), 'fire button: trigger held'); await until(g, `curW().mag < ${mag0}`); await touch(g, 'touchEnd', []);
  ok(!(await P('PL.held')), 'fire button released: trigger released'); ok((await P('curW().mag')) < mag0, `bullets were fired (${mag0} -> ${await P('curW().mag')})`);
  // fire: the firing finger can slide to look, without releasing the trigger
  const yawF = await P('PL.yaw');
  await touch(g, 'touchStart', [[fx, fy, 3]]); for (let i = 1; i <= 6; i++) await touch(g, 'touchMove', [[fx - i * 14, fy + i * 2, 3]]);
  ok(await P('PL.held'), 'finger sliding on the fire button: trigger still held');
  ok(await until(g, `Math.abs(PL.yaw - ${yawF}) > 0.02`), 'finger sliding on the fire button: the view turns');
  await touch(g, 'touchEnd', []); await page.waitForTimeout(100); ok(!(await P('PL.held')), 'fire button released after the slide');
  // aim: brief press shoulders the weapon, another puts it away; long press holds for the duration of the finger
  const [ax, ay] = await center(g, '[data-tc=ads]');
  await P(`window.__ev = []; for (const t of ['pointerdown', 'pointerup', 'pointercancel', 'lostpointercapture']) document.querySelector('[data-tc=ads]').addEventListener(t, (e) => window.__ev.push([t, e.timeStamp | 0, performance.now() | 0, PL.adsWant]), true);`);
  // (events are processed frame by frame: wait for the effect rather than reading it right away)
  await touch(g, 'touchStart', [[ax, ay, 4]]); await touch(g, 'touchEnd', []); await page.waitForTimeout(1500); ok(await P('PL.adsWant'), 'brief press on aim: shouldered');
  await touch(g, 'touchStart', [[ax, ay, 4]]); await touch(g, 'touchEnd', []); ok(await until(g, '!PL.adsWant'), 'second press: put away');
  await touch(g, 'touchStart', [[ax, ay, 4]]); await page.waitForTimeout(1500); ok(await P('PL.adsWant'), 'long press: aim held');
  await touch(g, 'touchEnd', [], 0.6); const rel = await until(g, '!PL.adsWant', 8000); ok(rel, 'long press released: put away');
  if (!rel) console.log('  events:', JSON.stringify(await P('window.__ev')), JSON.stringify(await P('({ads: PL.adsWant, tc: TC.ads, now: performance.now() | 0})')));
  // jump
  const [jx, jy] = await center(g, '[data-tc=jump]'); await touch(g, 'touchStart', [[jx, jy, 5]]); ok(await P('KEYS.Space'), 'jump button held'); await touch(g, 'touchEnd', []); ok(!(await P('KEYS.Space')), 'jump released');
  // reload, weapon
  const [rx, ry] = await center(g, '[data-tc=reload]'); await touch(g, 'touchStart', [[rx, ry, 6]]); await touch(g, 'touchEnd', []); ok(await until(g, '!!PL.reload'), 'reload button: reload started');
  await until(g, '!PL.reload');
  const cur0 = await P('PL.cur'); const [sx, sy] = await center(g, '[data-tc=swap]'); await touch(g, 'touchStart', [[sx, sy, 7]]); await touch(g, 'touchEnd', []);
  ok(await until(g, `PL.cur !== ${cur0}`), "weapon switch button");
  // knife: a brief press gives a strike, a held press draws the knife, the weapon switch button puts it away
  await until(g, 'PL.switching <= 0');
  const [kbx, kby] = await center(g, "[data-tc=knife]");
  await touch(g, 'touchStart', [[kbx, kby, 9]]); await touch(g, 'touchEnd', []); ok(await until(g, 'PL.knifeT > 0 && !PL.knifeOut'), 'knife button, brief press: a strike, the knife does not stay in hand');
  await until(g, 'PL.knifeT <= 0');
  await touch(g, 'touchStart', [[kbx, kby, 9]]); ok(await until(g, 'PL.knifeOut', 20000), 'knife button held: the knife is in hand'); await touch(g, 'touchEnd', []);
  await page.waitForTimeout(300); ok(await P('PL.knifeOut && PL.knifeT <= 0'), 'knife button released: the knife stays in hand, no extra strike');
  await touch(g, 'touchStart', [[sx, sy, 7]]); await touch(g, 'touchEnd', []); ok(await until(g, '!PL.knifeOut'), "weapon switch button: the knife is put away");
  await until(g, 'PL.switching <= 0 && VM.lower < 0.05', 30000);
  // several fingers: joystick + look + fire at the same time
  await touch(g, 'touchStart', [[150, 300, 1], [620, 200, 2], [fx, fy, 3]]); await touch(g, 'touchMove', [[150, 240, 1], [660, 210, 2], [fx, fy, 3]]);
  s = await P('({mz: TOUCH.mz, held: PL.held})'); ok(s.mz > 0.5 && s.held, 'joystick, look and fire with three fingers');
  await touch(g, 'touchEnd', []); await page.waitForTimeout(100);
  s = await P('({mz: TOUCH.mz, held: PL.held})'); ok(s.mz === 0 && !s.held, 'all fingers lifted: everything released');
  if (out) await page.screenshot({ path: path.join(out, 't-game.png') });
  // pause on touch
  const [px, py] = await center(g, '[data-tc=pause]'); await touch(g, 'touchStart', [[px, py, 8]]); await touch(g, 'touchEnd', []); await page.waitForTimeout(300);
  ok((await P('MATCH.state')) === 'paused', 'pause button: pause menu');
  ok(await P('document.getElementById("touch").classList.contains("hidden")'), 'touch controls hidden during the pause');
  if (out) await page.screenshot({ path: path.join(out, 't-pause.png') });
  // options in pause: the list must display (it had zero height on a phone)
  await P("document.querySelector('[data-pm=options]').click()"); await page.waitForTimeout(300);
  const ob = await P("(() => { const r = document.querySelector('#optPause .orows').getBoundingClientRect(); return { h: r.height, n: document.querySelectorAll('#optPause .orow').length, tool: [...document.querySelectorAll('#optPause .orow')].some((e) => /Disposition|layout/i.test(e.textContent)) }; })()");
  ok(ob.h > 100 && ob.n >= 5 && ob.tool, `options in pause: ${ob.n} settings shown over ${Math.round(ob.h)} px, including the controls layout`);
  if (out) await page.screenshot({ path: path.join(out, 't-pause-options.png') });
  // layout: open from the pause, move, enlarge, remove, share, reset
  await P("[...document.querySelectorAll('#optPause .orow button')].find((b) => /Disposition|layout/i.test(b.textContent)).click()"); await page.waitForTimeout(300);
  ok(await P('TC.edit && !document.getElementById("pause").classList.contains("show") && !document.getElementById("touch").classList.contains("hidden")'), 'layout editing: the controls display, the pause menu disappears');
  ok(await P('[...document.querySelectorAll(".tcb")].every((b) => b.getBoundingClientRect().width > 0)'), 'editing: all buttons are visible, even the contextual ones');
  const [ex, ey] = await center(g, '[data-tc=knife]'); const R0 = await P('JSON.stringify(document.querySelector("[data-tc=knife]").getBoundingClientRect())');
  await touch(g, 'touchStart', [[ex, ey, 1]]); await touch(g, 'touchMove', [[ex - 150, ey - 60, 1]]); await touch(g, 'touchMove', [[ex - 300, ey - 120, 1]]); await touch(g, 'touchEnd', []);
  const moved = await P('(() => { const r = document.querySelector("[data-tc=knife]").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, lay: Settings.tcLay && Settings.tcLay.knife, saved: JSON.parse(localStorage.getItem("dc_settings")).tcLay }; })()');
  ok(Math.abs(moved.x - (ex - 300)) < 6 && Math.abs(moved.y - (ey - 120)) < 6 && moved.lay && moved.saved && moved.saved.knife, `button dragged to its new place (${Math.round(moved.x)}, ${Math.round(moved.y)}) and saved`);
  // the joystick: floating, only its size can be set (its place is the finger's); fixed, it also moves
  const gf0 = await P('touchStickGeom()'); await touch(g, 'touchStart', [[gf0.cx, gf0.cy, 1]]); await touch(g, 'touchMove', [[gf0.cx + 90, gf0.cy - 60, 1]]); await touch(g, 'touchEnd', []);
  const gf1 = await P('touchStickGeom()'); ok(Math.abs(gf1.cx - gf0.cx) < 1 && Math.abs(gf1.cy - gf0.cy) < 1, 'floating joystick: it does not move in the editor (it appears under the finger)');
  await P("Settings.tcStick = 'fixed'; TC.root.classList.remove('float')");
  const gs0 = await P('touchStickGeom()'); await touch(g, 'touchStart', [[gs0.cx, gs0.cy, 1]]); await touch(g, 'touchMove', [[gs0.cx + 60, gs0.cy - 40, 1]]); await touch(g, 'touchMove', [[gs0.cx + 120, gs0.cy - 80, 1]]); await touch(g, 'touchEnd', []);
  const gs1 = await P('touchStickGeom()'); ok(Math.abs(gs1.cx - (gs0.cx + 120)) < 6 && Math.abs(gs1.cy - (gs0.cy - 80)) < 6 && await P('!!Settings.tcLay.stick'), `joystick dragged to its new place (${Math.round(gs1.cx)}, ${Math.round(gs1.cy)}) and saved`);
  await P("Settings.tcStick = 'float'; TC.root.classList.add('float')");
  await P("TC.el.ed.querySelector('[data-ed=reset]').click()"); const gs2 = await P('touchStickGeom()'); ok(Math.abs(gs2.cx - gs0.cx) < 1 && Math.abs(gs2.cy - gs0.cy) < 1, 'reset: the joystick returns to its original place');
  await touch(g, 'touchStart', [[ex, ey, 1]]); await touch(g, 'touchMove', [[ex - 150, ey - 60, 1]]); await touch(g, 'touchMove', [[ex - 300, ey - 120, 1]]); await touch(g, 'touchEnd', []);
  await P("TC.el.ed.querySelector('[data-ed=plus]').click(); TC.el.ed.querySelector('[data-ed=plus]').click()");
  const sz = await P('Settings.tcLay.knife[2]'); ok(sz === 12, `enlarged button (${sz} u)`);
  await P("TC.el.ed.querySelector('[data-ed=toggle]').click()");
  ok(await P('TC.el.knife.classList.contains("off") && Settings.tcLay.knife[3] === 1'), 'button removed: it stays visible in editing (dimmed)');
  await P("TC.el.ed.querySelector('[data-ed=share]').click()");
  const js = await P('TC.el.ed.querySelector("textarea").value'); ok(/"v":1/.test(js) && /"knife"/.test(js), 'sharing: the layout is given as text');
  await P("TC.el.ed.querySelector('[data-ed=done]').click()"); await page.waitForTimeout(200);
  ok(await P('!TC.edit && document.getElementById("pause").classList.contains("show") && document.getElementById("touch").classList.contains("hidden")'), 'end of editing: back to the pause menu, controls hidden');
  await page.evaluate(() => resumeGame()); await page.waitForTimeout(500);
  ok(await P('getComputedStyle(TC.el.knife).display === "none"'), 'in a match, the removed button does not appear');
  const kn = await until(g, 'TC.show && TC.el.fire.getBoundingClientRect().width > 0'); ok(kn, 'the other buttons stay in place');
  // imported text: layout restored then reset
  const imp = await P(`(() => { const r = touchLayoutImport(${JSON.stringify(js)}); return { r, knife: Settings.tcLay && Settings.tcLay.knife }; })()`);
  ok(imp.r && !!imp.knife, 'layout text re-imported'); if (!(imp.r && imp.knife)) console.log('  import:', JSON.stringify(imp), js.slice(0, 200));
  ok(await P('!touchLayoutImport("{not json") && !touchLayoutImport(JSON.stringify({v:1,b:{anything:[0.5,0.5,10,0]}}))'), 'invalid text rejected');
  await P('Settings.tcLay = null; touchLayoutApply(); saveSettings()');
  await P('pauseGame()'); await page.waitForTimeout(200); await page.evaluate(() => resumeGame()); await page.waitForTimeout(300);
  // auto-fire (default setting by finger): no more fire button, aim in its place; a pistol fires shot after shot at an enemy in front
  await P('Settings.tcAuto = true');
  ok(await until(g, 'TC.root.classList.contains("auto") && getComputedStyle(TC.el.fire).display === "none" && getComputedStyle(TC.el.ads).display !== "none"'), 'auto-fire: the fire button gives way to aim');
  await P('switchWeapon(1)');
  ok(await until(g, '!curW().def.auto && PL.ent.arms.switching <= 0'), 'semi-automatic weapon in hand');
  const tg = await P(`(() => {
    const p = PL.ent.pos, b = entities.find((e) => !e.isPlayer && e.alive && !allied(e, PL.ent)); let yaw = null;
    for (let k = 0; k < 16 && yaw === null; k++) { const a = k * Math.PI / 8; if (!rayWorld(p.x, p.y + 1.5, p.z, -Math.sin(a), 0, -Math.cos(a), 9)) yaw = a; }
    if (yaw === null || !b) return null;
    // the enemy stays 6 m in front of the player, alive; the player looks at it and fears nothing
    window.__hold = setInterval(() => { const q = PL.ent.pos; b.alive = true; b.health = 100; b.pos.set(q.x - Math.sin(yaw) * 6, q.y, q.z - Math.cos(yaw) * 6); if (b.vel) b.vel.set(0, 0, 0); PL.yaw = yaw; PL.pitch = -0.04; PL.ent.protT = 1e9; PL.ent.health = 100; }, 30);
    return { mag: curW().mag, w: curW().def.id };
  })()`);
  ok(!!tg, 'an enemy placed in front of the player');
  if (tg) {
    const shot = await until(g, `curW().mag <= ${tg.mag - 3}`, 120000);
    ok(shot, `auto-fire, semi-automatic weapon (${tg.w}): it fires shot after shot while the enemy is in the reticle (${tg.mag} -> ${await P('curW().mag')})`);
    await P('clearInterval(window.__hold)');
  }
  await P('Settings.tcAuto = false');
  // double tap to aim (default setting): no Aim button; two brief taps shoulder the weapon, two others put it away; a single tap or a look does not
  await P('Settings.tcDblAds = true; PL.adsWant = false');
  ok(await until(g, 'TC.root.classList.contains("dbl") && getComputedStyle(TC.el.ads).display === "none"'), 'double tap: the Aim button disappears');
  // imposed timestamps (software rendering spaces events out much more than a finger would)
  const taps = async (list) => { for (const [type, x, y, dt] of list) { const p = type === 'touchEnd' ? [] : [{ x, y, id: 5 }]; tt += dt; await g.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p, timestamp: tt }); } };
  let tt = Date.now() / 1000;
  await taps([['touchStart', 700, 160, 0], ['touchEnd', 700, 160, 0.06], ['touchStart', 704, 163, 0.12], ['touchEnd', 704, 163, 0.06]]);
  ok(await until(g, 'PL.adsWant === true'), 'two brief taps: shouldered');
  tt += 1; await taps([['touchStart', 700, 160, 0], ['touchEnd', 700, 160, 0.06]]); await page.waitForTimeout(300);
  ok(await P('PL.adsWant === true'), 'a single touch: nothing changes');
  tt += 1; await taps([['touchStart', 700, 160, 0], ['touchEnd', 700, 160, 0.06], ['touchStart', 702, 158, 0.12], ['touchEnd', 702, 158, 0.06]]);
  ok(await until(g, 'PL.adsWant === false'), 'two more brief taps: weapon put away');
  tt += 1; await taps([['touchStart', 650, 160, 0], ['touchMove', 700, 170, 0.05], ['touchEnd', 700, 170, 0.05], ['touchStart', 700, 170, 0.1], ['touchEnd', 700, 170, 0.05]]); await page.waitForTimeout(300);
  ok(await P('PL.adsWant === false'), 'a look followed by a tap: no aim');
  // an action button (reload) leaves aim: at the end of the reload, the player does not return to aim
  tt += 1; await taps([['touchStart', 700, 160, 0], ['touchEnd', 700, 160, 0.06], ['touchStart', 703, 161, 0.12], ['touchEnd', 703, 161, 0.06]]);
  await until(g, 'PL.adsWant === true');
  const rb = await P('(() => { const r = TC.el.reload.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()');
  await P('curW().mag = 1');
  tt += 1; await taps([['touchStart', rb[0], rb[1], 0], ['touchEnd', rb[0], rb[1], 0.08]]);
  ok(await until(g, 'PL.adsWant === false'), 'reload while aiming: aim is left');
  // software rendering is slow: wait for the real end of the reload (full magazine) and for the weapon to come back down, rather than a fixed delay
  const reloaded = await until(g, 'curW().mag > 1', 60000);
  await page.waitForTimeout(400);
  ok(reloaded && await P('PL.adsWant === false') && await until(g, 'VM.ads < 0.05', 20000), 'end of reload: still out of aim');
  await P('Settings.tcDblAds = false; PL.adsWant = false');
  // death by finger: the card ("Tap" prompt, within the screen, no button on top: the controls fade), a tap makes the player respawn;
  // killcam: "Tap" prompt, a tap skips it and makes the player respawn
  await P("PL.ent.protT = 0; killEnt(PL.ent, PL.ent, 'M4A1', false, new V3(0, 0, 1))");
  ok(await until(g, 'TC.dead && PL.deathT > 0.4', 60000), 'death: the touch controls fade');
  const dc = await P(`(() => { const b = document.querySelector('#death .box').getBoundingClientRect(), sk = document.querySelector('#death .skip').textContent, vis = [...document.querySelectorAll('.tcb')].filter((e) => e.getBoundingClientRect().width > 0).length; return { sk, vis, inside: b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight }; })()`);
  ok(dc.inside && /Tap/.test(dc.sk) && dc.vis === 0, `death: card within the screen, finger prompt, no button on top ${JSON.stringify(dc)}`);
  if (out) await page.screenshot({ path: path.join(out, 't-death.png') });
  await touch(g, 'touchStart', [[700, 200, 3]]); await touch(g, 'touchEnd', []);
  ok(await until(g, 'PL.ent.alive && !document.getElementById("death").classList.contains("show")', 30000), 'death: a tap makes the player respawn');
  await until(g, 'KC.count >= 14', 60000);
  const kc0 = await P(`(() => { const b = entities.find((e) => !e.isPlayer && !allied(e, PL.ent) && e.alive && e.model); return !!b && startKillcam({ killer: b, victim: PL.ent, tEnd: MATCH.time - 0.3, info: killInfo(b, PL.ent, 'AK-47') }); })()`);
  ok(kc0 && await until(g, 'TC.dead', 30000) && /Tap/.test(await P("document.getElementById('kcSkip').textContent")), 'killcam: finger prompt');
  if (out) await page.screenshot({ path: path.join(out, 't-killcam.png') });
  await touch(g, 'touchStart', [[700, 200, 3]]); await touch(g, 'touchEnd', []);
  ok(await until(g, '!KC.active && PL.ent.alive && MATCH.state === "playing"', 30000), 'killcam: a tap skips it and makes the player respawn');
  // page in the background: automatic pause
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  ok((await P('MATCH.state')) === 'paused', 'page in the background: automatic pause');
  await g.browser.close();

  // 3. portrait: ask to rotate the phone
  const q = await openGame({ mobile: true, w: 412, h: 915, settings: { quality: 'low', touch: 'on' }, noHdri: true, noMap: true });
  ok(await q.page.evaluate('getComputedStyle(document.getElementById("rotate")).display !== "none"'), 'portrait: "Turn your device" screen');
  if (out) await q.page.screenshot({ path: path.join(out, 't-portrait.png') });
  await q.browser.close();
  console.log(fails ? `${fails} failure(s)` : 'all good');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
