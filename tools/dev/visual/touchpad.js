/* Trackpad mode check (src/09qe-touchpad.js): node touchpad.js [page=dist/index.html]
   Synthetic events (wheel, clicks) sent to the window, as the browser would; real solo match, 3D rendering off.
   - detection: wheel notches set nothing; two trackpad gestures (burst of small fractional steps that fades out) set Settings.tpSeen and the
     body class; two mouse notches remove it; a mouse wheel under a zoom (fractional steps) sets nothing; a held left click in
     detected mode gives the mouse back, fires and says so; the "off" or "on" mode takes precedence over detection;
   - in trackpad mode, auto-fire: a single click does not fire, a double click shoulders then stows the weapon, a right click (two-finger tap) does the same, the
     wheel no longer switches weapon, the reticle on an enemy starts firing and losing it stops it;
   - without auto-fire, a single click fires; without double click, it does not shoulder;
   - "off" mode: the old mouse (click that fires, held right click, wheel that switches weapon); toggle aiming chosen with the mouse: the right click toggles;
     reloading stows the toggled aim;
   - with touch or a gamepad, trackpad mode never applies;
   - trackpad-specific sensitivity: twice that of the mouse gives twice the look movement, and changing the mouse's has no effect on it;
     initially, it takes the mouse's;
   - Options, Game: the trackpad rows (sensitivity slider included) are displayed only with the mode, the mode choice exists. */
const { openGame } = require('./common');
const fails = [];
const ok = (c, msg, extra) => { console.log((c ? 'ok    ' : 'FAIL ') + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails.push(msg); };
(async () => {
  const { browser, page, logs } = await openGame({ page: process.argv[2], w: 1000, h: 560, settings: { quality: 'low', map: 'chergui', tpMode: 'auto', tpSeen: false, tpHint: true }, noHdri: true });
  const ev = (f, a) => page.evaluate(f, a);
  await ev(() => { LOCK.fallback = true; startMatch({}); composer.render = () => {}; });
  await page.waitForFunction('typeof frameN !== "undefined" && frameN > 30', null, { timeout: 300000, polling: 500 });
  // helpers in the page: wheel (a burst of n events spaced dt ms apart, decreasing steps or notch), spaced clicks
  await ev(() => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    window.__sleep = sleep;
    window.__frames = async (n) => { const f = frameN; while (frameN < f + n) await sleep(15); }; // (frames are slow in software rendering: we count frames, not milliseconds)
    window.__wheel = async (kind) => {
      if (kind === 'pad') { for (let i = 0; i < 14; i++) { window.dispatchEvent(new WheelEvent('wheel', { deltaY: 14.37 * Math.pow(0.82, i) + 0.31, deltaX: i % 3 ? 0.4 : 0 })); await sleep(18); } }
      else for (let i = 0; i < 2; i++) { window.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, deltaMode: 0 })); await sleep(30); }
      await sleep(420); // the burst is over (the burst-end delay, 140 ms, then the 250 ms timer)
    };
    window.__click = (b = 0) => { window.dispatchEvent(new MouseEvent('mousedown', { button: b })); window.dispatchEvent(new MouseEvent('mouseup', { button: b })); };
    window.__reset = () => { PL.held = false; PL.queued = false; PL.adsWant = false; TPAD.tap = 0; PL.shots0 = PL.shots; };
  });
  // --- detection ---
  const st = () => ev(() => ({ seen: !!Settings.tpSeen, on: trackpadOn(), cls: document.body.classList.contains('trackpad') }));
  await ev(() => window.__wheel('notch')); await ev(() => window.__wheel('notch'));
  let s = await st(); ok(!s.seen && !s.on && !s.cls, 'two wheel notches: nothing detected', s);
  await ev(() => window.__wheel('pad')); s = await st(); ok(!s.seen, 'a single trackpad gesture: not yet', s);
  await ev(() => window.__wheel('pad')); s = await st(); ok(s.seen && s.on && s.cls, 'two trackpad gestures: trackpad mode, body class set', s);
  await ev(() => window.__wheel('notch')); await ev(() => window.__wheel('notch')); s = await st(); ok(!s.seen && !s.on && !s.cls, 'two mouse notches: the mode turns off', s);
  // a mouse under a browser zoom (or a screen scaling) gives fractional steps: not a trackpad (feedback "after the settings, I can no longer fire")
  await ev(async () => { for (let b = 0; b < 3; b++) { for (let i = 0; i < 6; i++) { window.dispatchEvent(new WheelEvent('wheel', { deltaY: 90.90909, deltaMode: 0 })); await window.__sleep(20); } await window.__sleep(420); } });
  s = await st(); ok(!s.seen && !s.on, 'mouse wheel under a zoom (fractional steps): not a trackpad', s);
  // trackpad mode detected wrongly: a held left click is a mouse's, the mode turns off, the shot goes off and a message says so
  await ev(() => window.__wheel('pad')); await ev(() => window.__wheel('pad'));
  const hold = await ev(async () => {
    window.__reset(); PL.noFireT = 0; const on0 = trackpadOn(); $('msg').textContent = '';
    window.dispatchEvent(new MouseEvent('mousedown', { button: 0 })); const held0 = PL.held;
    await window.__sleep(500); const r = { on0, held0, on: trackpadOn(), held: PL.held, msg: $('msg').textContent };
    window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })); r.after = PL.held; return r;
  });
  ok(hold.on0 && !hold.held0 && !hold.on && hold.held && !hold.after, 'trackpad detected wrongly: a held click gives the mouse back and fires, released it stops', hold);
  ok(/Mouse/.test(hold.msg), 'back to the mouse: a message says so', hold.msg);
  await ev(() => { Settings.tpMode = 'on'; trackpadSync(); }); s = await st(); ok(s.on && s.cls, '"Enabled" mode: without detection', s);
  await ev(() => window.__wheel('notch')); await ev(() => window.__wheel('notch')); s = await st(); ok(s.on, '"Enabled" mode: the wheel changes nothing', s);
  await ev(() => { Settings.tpMode = 'off'; Settings.tpSeen = true; trackpadSync(); }); s = await st(); ok(!s.on && !s.cls, '"Disabled" mode: takes precedence over detection', s);
  // --- in trackpad mode, auto-fire and double click ---
  await ev(() => { Settings.tpMode = 'on'; Settings.tpAuto = true; Settings.tpDblAds = true; Settings.adsToggle = false; trackpadSync(); window.__reset(); });
  const S = () => ev(() => ({ held: PL.held, queued: PL.queued, ads: PL.adsWant, shots: PL.shots - (PL.shots0 || 0), cur: PL.cur }));
  await ev(() => window.__click(0)); let t = await S(); ok(!t.held && !t.queued, 'a single click does not fire (auto-fire)', t);
  await ev(() => window.__sleep(450)); await ev(() => window.__click(0)); await ev(() => window.__sleep(120)); await ev(() => window.__click(0)); t = await S(); ok(t.ads, 'a double click shoulders', t);
  await ev(() => window.__sleep(450)); await ev(() => window.__click(0)); await ev(() => window.__sleep(120)); await ev(() => window.__click(0)); t = await S(); ok(!t.ads, 'another double click stows the weapon', t);
  await ev(() => window.__sleep(450)); await ev(() => window.__click(0)); await ev(() => window.__sleep(600)); await ev(() => window.__click(0)); t = await S(); ok(!t.ads, 'two clicks too far apart: not a double click', t);
  await ev(() => window.__click(2)); t = await S(); ok(t.ads, 'right click (two-finger tap): shoulders', t);
  await ev(() => window.__click(2)); t = await S(); ok(!t.ads, 'right click again: stows the weapon (never held)', t);
  await ev(() => { PL.adsWant = true; window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyR' })); }); t = await S(); ok(!t.ads, 'reloading stows the toggled aim', t);
  const cur0 = (await S()).cur; await ev(() => window.dispatchEvent(new WheelEvent('wheel', { deltaY: 120 }))); t = await S(); ok(t.cur === cur0, 'the wheel does not switch weapon', [cur0, t.cur]);
  // auto-fire: an enemy under the reticle, then nothing (the target and the ray are simulated: the aiming geometry is that of the touch screen)
  const auto = await ev(async () => {
    const out = {}, aT = aimTarget, rE = rayEntities, rW = rayWorld, foe = entities.find((e) => !e.isPlayer);
    window.__reset(); PL.ent.alive = true; PL.noFireT = 0;
    aimTarget = () => ({ e: foe, ang: 0, rad: 0.05, d: 10, yaw: PL.yaw, pitch: PL.pitch }); rayEntities = () => ({ t: 10 }); rayWorld = () => null;
    aimAssist(1 / 60); out.held = PL.held; out.queued = PL.queued;
    aimTarget = () => null; AIM.autoT = MATCH.time - 0.3; aimAssist(1 / 60); out.heldAfter = PL.held;
    aimTarget = aT; rayEntities = rE; rayWorld = rW;
    Settings.tpAuto = false; window.__reset(); aimTarget = () => ({ e: foe, ang: 0, rad: 0.05, d: 10, yaw: PL.yaw, pitch: PL.pitch }); rayEntities = () => ({ t: 10 }); rayWorld = () => null;
    aimAssist(1 / 60); out.heldSans = PL.held; Settings.tpAuto = true;
    aimTarget = aT; rayEntities = rE; rayWorld = rW; window.__reset();
    return out;
  });
  ok(auto.held && auto.queued, 'an enemy under the reticle: the shot goes off by itself', auto);
  ok(!auto.heldSans, 'without auto-fire, the reticle on an enemy does not fire', auto);
  ok(!auto.heldAfter, 'no enemy under the reticle anymore: firing stops', auto);
  // --- without auto-fire, without double click ---
  await ev(() => { Settings.tpAuto = false; window.__reset(); window.__click(0); }); t = await S(); ok(t.queued, 'without auto-fire, a click fires', t);
  await ev(() => { PL.held = false; PL.queued = false; Settings.tpAuto = true; Settings.tpDblAds = false; window.__reset(); });
  await ev(() => window.__click(0)); await ev(() => window.__sleep(120)); await ev(() => window.__click(0)); t = await S(); ok(!t.ads, 'without double click, two clicks do not shoulder', t);
  // --- mode off: the mouse as before ---
  t = await ev(() => { Settings.tpMode = 'off'; Settings.tpDblAds = true; trackpadSync(); window.__reset(); window.dispatchEvent(new MouseEvent('mousedown', { button: 0 })); return { held: PL.held, queued: PL.queued }; }); ok(t.held && t.queued, '"Disabled" mode: the click fires', t);
  await ev(() => { window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })); window.dispatchEvent(new MouseEvent('mousedown', { button: 2 })); }); t = await S(); ok(t.ads, '"Disabled" mode: right click held, we aim', t);
  await ev(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 2 }))); t = await S(); ok(!t.ads, '"Disabled" mode: released, aiming stops', t);
  const w0 = (await S()).cur; await ev(() => window.dispatchEvent(new WheelEvent('wheel', { deltaY: 120 }))); await ev(() => window.__sleep(900)); t = await S(); ok(t.cur !== w0, '"Disabled" mode: the wheel switches weapon', [w0, t.cur]);
  // --- toggle aiming chosen with the mouse ---
  await ev(() => { Settings.adsToggle = true; trackpadSync(); window.__reset(); window.__click(2); }); t = await S(); ok(t.ads, 'toggle aiming with the mouse: a right click shoulders', t);
  await ev(() => window.__click(2)); t = await S(); ok(!t.ads, 'toggle aiming with the mouse: another one stows the weapon', t);
  // --- by finger, never ---
  await ev(() => { Settings.adsToggle = false; Settings.tpMode = 'on'; TOUCH.on = true; }); ok(!(await ev(() => trackpadOn())), 'with touch, trackpad mode does not apply');
  await ev(() => { TOUCH.on = false; PAD.drive = true; }); ok(!(await ev(() => trackpadOn())), 'with a gamepad, trackpad mode does not apply');
  await ev(() => { PAD.drive = false; });
  // --- own sensitivity ---
  ok(await ev(() => Settings.tpSens === Settings.sens), 'initially, the trackpad sensitivity takes the mouse\'s', await ev(() => [Settings.tpSens, Settings.sens]));
  const look = (mode) => ev(async (mode) => {
    Settings.tpMode = mode; trackpadSync(); PL.adsWant = false; for (const e of entities) if (!e.isPlayer) e.alive = false;
    await window.__frames(3); const y0 = PL.yaw; window.dispatchEvent(new MouseEvent('mousemove', { movementX: 120, movementY: 0 }));
    await window.__frames(3); return Math.abs(PL.yaw - y0);
  }, mode);
  await ev(() => { Settings.sens = 1; Settings.tpSens = 2; });
  const dMouse = await look('off'), dPad = await look('on');
  ok(dMouse > 0 && Math.abs(dPad / dMouse - 2) < 0.08, 'trackpad sensitivity: twice the mouse\'s, twice the look movement', [+dMouse.toFixed(4), +dPad.toFixed(4)]);
  await ev(() => { Settings.sens = 3; }); const dPad3 = await look('on');
  ok(Math.abs(dPad3 - dPad) < dPad * 0.05, 'changing the mouse sensitivity changes nothing for the trackpad', [+dPad.toFixed(4), +dPad3.toFixed(4)]);
  await ev(() => { Settings.sens = 1; Settings.tpMode = 'on'; trackpadSync(); });
  // --- Options ---
  const opt = await ev(() => {
    const rows = [...document.querySelectorAll('.orow[data-tp]')], all = [...document.querySelectorAll('.orow')];
    const vis = (r) => getComputedStyle(r).display !== 'none';
    document.body.classList.remove('trackpad'); const hidden = rows.every((r) => !vis(r));
    document.body.classList.add('trackpad'); const shown = rows.every((r) => vis(r));
    document.body.classList.toggle('trackpad', trackpadOn());
    return { rows: rows.length, hidden, shown, sens: all.some((r) => /trackpad sensitivity/i.test(r.textContent)), mode: all.some((r) => /trackpad controls/i.test(r.textContent)), toggle: all.some((r) => /toggle aim/i.test(r.textContent)) };
  });
  ok(opt.rows >= 4 && opt.sens && opt.hidden && opt.shown, 'Options: the trackpad rows are displayed only with the mode', opt);
  ok(opt.mode && opt.toggle, 'Options: the mode choice and toggle aiming exist', opt);
  const errs = logs.filter((l) => /pageerror/.test(l) || (/^\[error\]/.test(l) && !/ERR_/.test(l)));
  ok(!errs.length, 'no errors in the page', errs.slice(0, 3));
  console.log(fails.length ? `${fails.length} failure(s)` : 'all good');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
