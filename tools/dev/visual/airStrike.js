/* Check of the airstrike: node tools/dev/visual/airStrike.js [captures folder]
   1. Gamepad (simulated Xbox, navigator.getGamepads): the strike map opens, the two sticks move the aimed point (their vectors add up, capped at 1),
      the speed (precise at small deflection, 85 m/s fully pushed), A and RT confirm (not during the first 0.2 s), B cancels; the mouse point follows the cursor 1 to 1.
   2. By touch (phone in landscape, two sizes): a tap on the map launches the strike where the finger lands, lifted outside the map nothing goes off, Cancel cancels,
      no more Confirm button, the hint and Cancel do not cover the map.
   3. Lethality (Sirocco map, clear ground, motionless targets at each ring around the aimed point, damage counted by the real engine): everything dies up to 6 m, most
      up to 10 m, a bit over half at 11 m (the displayed zone has an 11 m radius), nothing at 13 m.
   4. Shelter (Notos map, motionless targets at the back of houses, strike centered on each): the bombs burst
      on the roof and not in the room, and almost everyone survives (one in ten at most dies; without the shelter, the blast through the doors and
      windows killed four in ten).
   PARTS=3 (or 1, 2, 1,3...): only those parts. Exits with an error code at the first failure. */
const { openGame } = require('./common');
const out = process.argv[2];
if (out) require('fs').mkdirSync(out, { recursive: true });
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL  :', msg); } else console.log('ok    :', msg); };
const until = (page, cond, ms) => page.waitForFunction(cond, null, { timeout: ms || 90000, polling: 100 }).then(() => true, () => false);
const frames = (page, n) => page.evaluate((k) => new Promise((r) => { let i = 0; const f = () => (++i >= k ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

async function play(opts, init) {
  const g = await openGame(Object.assign({ settings: { quality: 'low', map: 'chergui', touch: opts.mobile ? 'on' : 'auto' }, noHdri: true, init }, opts));
  const { page } = g;
  await page.evaluate(() => { const b = document.getElementById('wnOk'); if (b) b.click(); });
  await page.evaluate(() => { toMenu('solo'); menuLaunch({ online: false, map: Settings.map, deploy: () => startMatch() }); });
  await page.waitForFunction("UI.screen==='deploy'", null, { timeout: 120000 });
  await page.evaluate(() => document.getElementById('depGo').click());
  await page.waitForFunction("MATCH.state==='playing' && PL.ent.alive", null, { timeout: 120000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => { const h = document.getElementById('tcHelp'); if (h) h.classList.add('hidden'); PL.ent.protT = 1e9; }); // respawning bots do not kill the player during the check
  return g;
}
/* calls the airstrike and waits for the map to have been open for more than 0.3 s of play */
async function openMap(page) {
  await page.evaluate(() => { for (const e of entities) if (!e.isPlayer) e.alive = false; PL.ks.air = true; PL.ent.pos.set(0, PL.ent.pos.y, 0); useAirstrike(); });
  const opened = await until(page, 'KS.map.open', 60000);
  if (!opened) console.log('      state:', JSON.stringify(await page.evaluate(() => ({ alive: PL.ent.alive, mode: KS.mode, stage: KS.stage, air: PL.ks.air, sw: PL.switching, state: MATCH.state }))));
  await until(page, 'MATCH.time - KS.map.t0 > 0.3', 60000);
  return opened;
}

const only = (n) => !process.env.PARTS || process.env.PARTS.split(',').includes(String(n));
(async () => {
  let g, page;
  // --- 1. gamepad
  if (only(1)) {
  g = await play({ w: 800, h: 450 }, `
    window.__pad = { id: 'Xbox 360 Controller (STANDARD GAMEPAD)', connected: true, mapping: 'standard', index: 0, axes: [0,0,0,0], buttons: Array.from({length:17},()=>({pressed:false,value:0})) };
    navigator.getGamepads = () => [window.__pad];
    window.__set = (axes, btns) => { const p = window.__pad; if (axes) p.axes = axes; for (const k in (btns||{})) { const v = btns[k]; p.buttons[k] = { pressed: v > 0.5, value: v }; } };`);
  page = g.page;
  const set = (axes, btns) => page.evaluate(([a, b]) => window.__set(a, b), [axes, btns]);
  await page.evaluate(() => window.dispatchEvent(Object.assign(new Event('gamepadconnected'), { gamepad: window.__pad })));
  await set(null, { 13: 1 }); await frames(page, 3); await set(null, { 13: 0 }); await frames(page, 3); // the gamepad is in control
  ok(await page.evaluate(() => PAD.drive), 'the gamepad is in control');
  // speed: pure function, one 10 ms frame
  const sp = await page.evaluate(() => {
    const mv = (axes) => { KS.map.x = 0; KS.map.z = 0; padMapMove({ axes }, 0.01); return [KS.map.x, KS.map.z]; };
    return { full: mv([1, 0, 0, 0]), right: mv([0, 0, 1, 0]), both: mv([1, 0, 1, 0]), up: mv([0, -1, 0, -1]), diag: mv([1, 1, 0, 0]), half: mv([0.5, 0, 0, 0]), quarter: mv([0.35, 0, 0, 0]), dead: mv([0.08, 0, 0.08, 0]), opposite: mv([1, 0, -1, 0]) };
  });
  const near = (a, b, e) => Math.abs(a - b) <= e;
  ok(near(sp.full[0], 0.85, 0.01) && near(sp.right[0], 0.85, 0.01), `left stick and right stick fully pushed: 85 m/s (${sp.full[0].toFixed(2)} and ${sp.right[0].toFixed(2)} m in 10 ms)`);
  ok(near(sp.both[0], 0.85, 0.01) && near(sp.up[1], -0.85, 0.01), 'both sticks in the same direction: the sum is capped at full speed');
  ok(near(Math.hypot(...sp.diag), 0.85, 0.01), 'diagonal fully pushed: same speed as on one axis');
  ok(sp.half[0] > 0.18 && sp.half[0] < 0.26 && sp.quarter[0] > 0.03 && sp.quarter[0] < 0.12, `precise at small deflection (${sp.quarter[0].toFixed(2)} m at 35 %, ${sp.half[0].toFixed(2)} m at 50 % in 10 ms)`);
  ok(sp.dead[0] === 0 && Math.abs(sp.opposite[0]) < 1e-9, 'dead zone respected, two opposite sticks cancel out');
  // in play: the map, the two sticks, A, RT, B
  ok(await openMap(page), 'strike map open');
  // mouse captured: one mouse pixel, one map pixel
  const mouse = await page.evaluate(() => { const r = $('tacCanvas').getBoundingClientRect(); KS.map.x = 0; KS.map.z = 0; ksMapMouse(100, 0); return { m: KS.map.x, px: KS.map.x * r.height / (MAP.z1 - MAP.z0), canvas: r.height }; });
  ok(near(mouse.px, 100, 1), `mouse: 100 mouse pixels make ${mouse.px.toFixed(1)} map pixels (${mouse.m.toFixed(1)} m)`);
  ok(await page.evaluate(() => /LS/.test($('tacKeys').textContent) && /RS/.test($('tacKeys').textContent) && $('tacKeys').querySelectorAll('kbd.key.pad.b0').length === 1 && $('tacKeys').querySelectorAll('kbd.key.pad.sh').length >= 3), 'legend: LS RS to aim, A and RT to confirm');
  await page.evaluate(() => { KS.map.x = 0; KS.map.z = 0; });
  await set([1, 0, 0, 0], {});
  ok(await until(page, 'KS.map.x > 4', 60000), 'left stick to the right: the aimed point goes right');
  await set([0, 0, 0, 1], {});
  const z0 = await page.evaluate(() => KS.map.z);
  ok(await until(page, `KS.map.z > ${z0} + 4`, 60000), 'right stick down: the aimed point goes down');
  await set([0, 0, 0, 0], {});
  if (out) await page.screenshot({ path: out + '/strike-gamepad.png' });
  // A pressed at the same time as the map opens: nothing goes off (0.2 s delay); later, A launches the strike
  await page.evaluate(() => { window.__t0 = KS.map.t0; KS.map.t0 = MATCH.time; }); // as if the map had just opened
  await set(null, { 0: 1 }); await frames(page, 1); await set(null, { 0: 0 }); await frames(page, 2);
  ok(await page.evaluate(() => KS.map.open), 'A pressed within 0.2 s after opening: nothing goes off');
  await page.evaluate(() => { KS.map.t0 = window.__t0; });
  const tgt = await page.evaluate(() => [KS.map.x, KS.map.z]);
  await set(null, { 0: 1 }); await frames(page, 2); await set(null, { 0: 0 });
  ok(await until(page, '!KS.map.open && KS.stage === "confirm"', 30000), 'A: the strike is confirmed');
  const strike = await page.evaluate(() => ({ events: MATCH.events.length, jets: KS.jets.length, ks: PL.ks.air }));
  ok(strike.jets === 2 && strike.events >= 16 && strike.ks === false, `the planes arrive, ${strike.events} bomb events, streak spent`);
  ok(await page.evaluate((t) => { const b = airPattern(new V3(Math.round(t[0] * 10) / 10, 0, Math.round(t[1] * 10) / 10), Math.round(KS.map.yaw * 1000) / 1000); return b.length === AIR.n; }, tgt), 'bomb zone at the aimed point');
  await until(page, '!KS.mode', 60000);
  // RT also confirms, B cancels
  ok(await openMap(page), 'map reopened');
  await set(null, { 7: 1 }); await frames(page, 2); await set(null, { 7: 0 });
  ok(await until(page, '!KS.map.open && KS.stage === "confirm"', 30000), 'RT: the strike is confirmed');
  await until(page, '!KS.mode', 60000);
  ok(await openMap(page), 'map opened a third time');
  await set(null, { 1: 1 }); await frames(page, 2); await set(null, { 1: 0 });
  ok(await until(page, '!KS.map.open && KS.stage === "cancel"', 30000) && await page.evaluate(() => PL.ks.air), 'B: cancelled, the streak stays ready');
  await until(page, '!KS.mode', 60000);
  ok(!g.logs.some((l) => l.includes('pageerror')), 'no page error (gamepad)');
  await g.browser.close();
  }

  // --- 2. by touch
  if (only(2)) for (const [w, h] of [[915, 412], [667, 340]]) {
    g = await play({ mobile: true, w, h, dpr: 2 }, "try{localStorage.setItem('dc_touch_help','1')}catch(e){}");
    page = g.page;
    const cdp = await page.context().newCDPSession(page);
    const tap = async (x, y) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] }); await frames(page, 2); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
    ok(await openMap(page), `${w}x${h}: map open`);
    const lay = await page.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); if (!e) return null; const q = e.getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom, w: q.width, vis: getComputedStyle(e).display !== 'none' }; };
      return { map: r('#tacCanvas'), hint: r('#tcMapHint'), no: r('#tcMapNo'), ok: !!document.getElementById('tcMapOk'), vw: innerWidth, vh: innerHeight };
    });
    const hit = (a, b) => a && b && Math.min(a.r, b.r) - Math.max(a.l, b.l) > 0.5 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 0.5;
    ok(!lay.ok, `${w}x${h}: no more Confirm button`);
    ok(lay.hint && lay.hint.vis && lay.no && lay.no.vis && !hit(lay.hint, lay.map) && !hit(lay.no, lay.map) && lay.no.r <= lay.vw && lay.no.b <= lay.vh && lay.hint.t >= 0, `${w}x${h}: the hint and Cancel are visible, outside the map and inside the screen ${JSON.stringify({ hint: lay.hint && [Math.round(lay.hint.l), Math.round(lay.hint.t), Math.round(lay.hint.r), Math.round(lay.hint.b)], no: [Math.round(lay.no.l), Math.round(lay.no.t), Math.round(lay.no.r), Math.round(lay.no.b)], map: [Math.round(lay.map.l), Math.round(lay.map.t), Math.round(lay.map.r), Math.round(lay.map.b)] })}`);
    if (out) await page.screenshot({ path: `${out}/strike-touch-${w}x${h}.png` });
    // lifted outside the map: nothing goes off
    await page.evaluate(() => { const r = $('tacCanvas').getBoundingClientRect(); $('tacCanvas').dispatchEvent(new PointerEvent('pointerup', { clientX: r.right + 30, clientY: r.top + 20, pointerId: 77, bubbles: true })); });
    await frames(page, 2);
    ok(await page.evaluate(() => KS.map.open), `${w}x${h}: finger lifted outside the map, the strike does not go off`);
    // tap next to the map (on the hint): the mouse the browser then simulates does not move the point and launches nothing (the point used to run off to the edge)
    await page.evaluate(() => { KS.map.x = 3; KS.map.z = -4; });
    await tap((lay.hint.l + lay.hint.r) / 2, (lay.hint.t + lay.hint.b) / 2); await frames(page, 3);
    ok(await page.evaluate(() => KS.map.open && KS.map.x === 3 && KS.map.z === -4), `${w}x${h}: a tap next to the map does not move the point and launches nothing`);
    // a tap: the strike goes off where it lands
    const at = [lay.map.l + lay.map.w * 0.3, lay.map.t + (lay.map.b - lay.map.t) * 0.7];
    await tap(at[0], at[1]);
    ok(await until(page, '!KS.map.open && KS.stage === "confirm"', 30000), `${w}x${h}: a tap launches the strike`);
    const hitPt = await page.evaluate(([a, m]) => ({ x: KS.map.x, z: KS.map.z, ex: MAP.x0 + ((a[0] - m.l) / m.w) * (MAP.x1 - MAP.x0), ez: MAP.z0 + ((a[1] - m.t) / (m.b - m.t)) * (MAP.z1 - MAP.z0), jets: KS.jets.length }), [at, lay.map]);
    ok(Math.hypot(hitPt.x - hitPt.ex, hitPt.z - hitPt.ez) < 1 && hitPt.jets === 2, `${w}x${h}: the strike is where the finger landed (${hitPt.x.toFixed(1)}, ${hitPt.z.toFixed(1)} for ${hitPt.ex.toFixed(1)}, ${hitPt.ez.toFixed(1)})`);
    await until(page, '!KS.mode', 60000);
    // Cancel
    ok(await openMap(page), `${w}x${h}: map reopened`);
    const no = await page.evaluate(() => { KS.map.x = 3; KS.map.z = -4; window.__nj = KS.jets.length; const q = $('tcMapNo').getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
    await tap(no[0], no[1]);
    ok(await until(page, '!KS.map.open && KS.stage === "cancel"', 30000) && await page.evaluate(() => PL.ks.air && KS.jets.length <= window.__nj && KS.map.x === 3 && KS.map.z === -4), `${w}x${h}: Cancel really cancels (the streak stays ready, no new strike, the point has not moved)`);
    ok(!g.logs.some((l) => l.includes('pageerror')), `${w}x${h}: no page error`);
    await g.browser.close();
  }

  // --- 3. lethality
  if (only(3)) {
  g = await play({ w: 800, h: 450, settings: { quality: 'low', map: 'sirocco' } });
  page = g.page;
  const res = await page.evaluate(() => {
    const bots = entities.filter((e) => !e.isPlayer);
    for (const e of bots) { e.team = 1 - PL.ent.team; e.model = null; } // without a model, entChest reads the entity's position
    let best = null;
    for (let x = MAP.x0 + 20; x <= MAP.x1 - 20 && !best; x += 6) for (let z = MAP.z0 + 20; z <= MAP.z1 - 20 && !best; z += 6) {
      const h0 = groundHeight(x, z, 12); let flat = true;
      for (let a = 0; a < 6.28 && flat; a += 0.4) for (const r of [4, 8, 11]) if (Math.abs(groundHeight(x + Math.cos(a) * r, z + Math.sin(a) * r, 12) - h0) > 1.6) flat = false;
      if (flat) best = [x, z];
    }
    if (!best) return null;
    const T = new V3(best[0], 0, best[1]), dealt = new Map(), orig = window.applyDamage;
    window.applyDamage = (v, dmg) => dealt.set(v, (dealt.get(v) || 0) + dmg);
    const RINGS = [0, 4, 8, 10, 11, 13], samples = [], per = {};
    for (const r of RINGS) { per[r] = [0, 0]; for (let k = 0; k < (r === 0 ? 1 : 8); k++) samples.push([r, r === 0 ? 0 : k * Math.PI / 4 + 0.3 * r]); }
    PL.ent.pos.set(T.x + 60 > MAP.x1 ? T.x - 60 : T.x + 60, groundHeight(T.x, T.z, 12), T.z); // the player outside the zone
    for (let s0 = 0; s0 < samples.length; s0 += bots.length) {
      const chunk = samples.slice(s0, s0 + bots.length); dealt.clear();
      chunk.forEach(([r, a], i) => { const e = bots[i], x = T.x + Math.cos(a) * r, z = T.z + Math.sin(a) * r; e.alive = true; e.health = 100; e.protT = 0; e.pos.set(x, groundHeight(x, z, 12), z); e.vel.set(0, 0, 0); });
      MATCH.events.length = 0; airstrike(T, 0.7, PL.ent);
      for (let t = 0; t < 4.2; t += 1 / 30) { MATCH.time += 1 / 30; for (let i = MATCH.events.length - 1; i >= 0; i--) if (MATCH.events[i].t <= MATCH.time) { const ev = MATCH.events[i]; MATCH.events.splice(i, 1); ev.fn(); } updateAircraft(1 / 30); updateFx(1 / 30); }
      chunk.forEach(([r], i) => { per[r][1]++; if ((dealt.get(bots[i]) || 0) >= 100) per[r][0]++; });
    }
    window.applyDamage = orig;
    return { at: best, per };
  });
  ok(!!res, 'clear ground found on Sirocco');
  if (res) {
    const p = res.per, pct = (r) => p[r][0] / p[r][1];
    console.log('      dead per ring:', Object.entries(p).map(([r, [k, n]]) => `${r} m ${k}/${n}`).join(', '));
    ok(pct(0) === 1 && pct(4) === 1 && pct(8) >= 0.85, 'up to 8 m from the aimed point: almost everyone dies (a target can be sheltered by the terrain)');
    ok(pct(10) >= 0.75 && pct(11) >= 0.4, 'at 10 m, and at the edge of the displayed zone (11 m): most die');
    ok(pct(13) <= 0.25, 'at 13 m, outside the displayed zone: almost nobody');
  }
  ok(!g.logs.some((l) => l.includes('pageerror')), 'no page error (lethality)');
  await g.browser.close();
  }
  if (only(4)) {
  g = await play({ w: 800, h: 450, settings: { quality: 'low', map: 'notos' } });
  page = g.page;
  const res = await page.evaluate(() => {
    const bots = entities.filter((e) => !e.isPlayer);
    for (const e of bots) { e.team = 1 - PL.ent.team; e.model = null; }
    // at the back of a house: a roof above, walls in seven directions out of eight within 10 m, a soldier's spot
    const pts = [];
    for (let x = MAP.x0 + 2; x < MAP.x1 - 2; x += 1.5) for (let z = MAP.z0 + 2; z < MAP.z1 - 2; z += 1.5) {
      const fy = groundHeight(x, z, 0.5);
      if (queryBoxes(x - 0.3, z - 0.3, x + 0.3, z + 0.3).some((b) => !b.ray && b.y0 < fy + 1.7 && b.y1 > fy + 0.5 && x + 0.3 > b.x0 && x - 0.3 < b.x1 && z + 0.3 > b.z0 && z - 0.3 < b.z1)) continue;
      const u = rayWorld(x, fy + 0.2, z, 0, 1, 0, 40); if (u && u.t < 2) continue;
      if (!roofAbove(x, fy + 1.75, z, 30)) continue;
      let walls = 0; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; if (rayWorld(x, fy + 1.3, z, Math.cos(a), 0, Math.sin(a), 10)) walls++; }
      if (walls >= 7) pts.push([x, fy, z]);
    }
    const dealt = new Map(), orig = window.applyDamage;
    window.applyDamage = (v, dmg) => dealt.set(v, (dealt.get(v) || 0) + dmg);
    PL.ent.pos.set(MAP.x1 - 3, groundHeight(MAP.x1 - 3, MAP.z1 - 3, 12), MAP.z1 - 3);
    let dead = 0, n = 0;
    for (const [x, fy, z] of pts) {
      for (const e of bots) e.alive = false;
      const e = bots[0]; e.alive = true; e.health = 100; e.protT = 0; e.pos.set(x, fy, z); e.vel.set(0, 0, 0); dealt.clear();
      MATCH.events.length = 0; airstrike(new V3(x, fy, z), 0.7 + x * 0.13, PL.ent);
      for (let t = 0; t < 4.2; t += 1 / 30) { MATCH.time += 1 / 30; for (let i = MATCH.events.length - 1; i >= 0; i--) if (MATCH.events[i].t <= MATCH.time) { const ev = MATCH.events[i]; MATCH.events.splice(i, 1); ev.fn(); } updateAircraft(1 / 30); updateFx(1 / 30); }
      n++; if ((dealt.get(e) || 0) >= 100) dead++;
      if (airImpact(x, z) < fy + 2) return { bad: [x, fy, z, airImpact(x, z)] };
    }
    window.applyDamage = orig;
    return { n, dead };
  });
  ok(res && !res.bad, 'above a house, the bomb bursts on the roof' + (res && res.bad ? ' ' + JSON.stringify(res.bad) : ''));
  if (res && !res.bad) {
    console.log(`      ${res.n} points at the back of the houses, ${res.dead} dead`);
    ok(res.n >= 15, 'Notos: enough points at the back of the houses');
    ok(res.dead <= res.n * 0.1, 'sheltered inside a house: at most one target in ten dies from a strike centered on it');
  }
  ok(!g.logs.some((l) => l.includes('pageerror')), 'no page error (shelter)');
  await g.browser.close();
  }
  console.log(fails ? fails + ' failure(s)' : 'all good');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('ERROR', e); process.exit(2); });
