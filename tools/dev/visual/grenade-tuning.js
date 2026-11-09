/* Tuning bench for hand-held grenades (src/09zj-grenade-tuning.js, game opened with ?grenade=1): node grenade-tuning.js [captures folder]; PAGE=other.html.
   The game really runs (3D rendering off without a captures folder, bots frozen and moved away) and the panel is operated the way the owner would. Checks:
   - without ?grenade=1, nothing exists (no panel, no hook);
   - with it: the panel, its settings and the free mouse; a slider and a numeric field change NADE_GRIP, HAND_POSES.n<type> and NADE_POSE, and the real hand;
   - the chosen type is the one the hand holds (even after a respawn); Hold, Pin pull and Throw force the pose without throwing anything;
   - what is done in the panel does not reach the game (G key, click);
   - Copy gives a text that Apply reads back, Reset all returns to the code, the configuration survives a reload; foreign text does not get in.
   Exits with an error on the first defect. With a folder: captures of each held grenade (3D rendering kept). */
const path = require('path');
const { openGame, REPO } = require('./common');
const out = process.argv[2], fails = [];
const ok = (c, msg, extra) => { console.log((c ? 'ok    ' : 'FAIL ') + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails.push(msg); };
const wait = (page, ms) => page.waitForTimeout(ms);
// software rendering is slow when taking captures: we wait for game frames (frameN), not milliseconds
const frames = async (page, n) => { const f0 = await page.evaluate('frameN'); await page.waitForFunction(`frameN >= ${f0 + n}`, null, { timeout: 180000, polling: 50 }); };
const PAGE = path.resolve(REPO, 'dist', process.env.PAGE || 'index.html');
(async () => {
  if (out) require('fs').mkdirSync(out, { recursive: true });
  // 1. without ?grenade=1
  let g = await openGame({ url: 'file://' + PAGE, w: 960, h: 540, settings: { quality: 'low', map: 'chergui' }, noHdri: true });
  ok(await g.page.evaluate(() => !document.getElementById('ndbg') && NADE_DEBUG === null && !LOCK.fallback), 'without ?grenade=1: no panel and no hook, the mouse stays captured');
  await g.browser.close();
  // 2. with it
  g = await openGame({ url: 'file://' + PAGE + '?grenade=1', w: 960, h: 540, settings: { quality: 'low', map: 'chergui' }, noHdri: true });
  const { page, logs } = g;
  await page.evaluate((cut) => { startMatch({}); if (cut) composer.render = () => {}; window.botsTick = () => {}; for (const o of entities) if (!o.isPlayer) { o.alive = false; o.model.root.visible = false; } }, !out);
  await page.waitForFunction('typeof frameN !== "undefined" && frameN > 40 && !!document.getElementById("ndbg")', null, { timeout: 300000, polling: 500 });
  await page.evaluate(() => { localStorage.removeItem('dc_grenade'); PL.yaw = 0; PL.pitch = -0.1; });
  const P = (js) => page.evaluate(js);
  const click = async (txt) => page.evaluate((t) => { for (const b of document.querySelectorAll('#ndbg button')) if (b.textContent === t) { b.click(); return true; } return false; }, txt);
  const slide = (p, v) => P(`(() => { const r = NDBG.rows.find((r) => r.path === '${p}'); r.input.value = ${v}; r.input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  ok(await P('NADE_DEBUG !== null && LOCK.fallback === true'), 'with ?grenade=1: hook set, mouse free');
  const n = await P('NDBG.rows.length');
  ok(n >= 3 * 27 + 12, `the panel has ${n} settings (three grenades: grip, fingers, thumb; armed arm, left hand)`);
  ok(await P('["G.frag.p.0","G.flash.r.1","G.smoke.p.2","H.nfrag.i.0","H.nflash.t.7","H.nsmoke.spread","N.armed.2","N.rollArmed","N.guide.0"].every((p) => NDBG.rows.some((r) => r.path === p))'), 'the key settings are there');

  // nothing reaches the game
  await click('Game');
  await P(`(() => { [...document.querySelectorAll('#ndbg input[type=number]')].find((x) => x.getClientRects().length > 0).focus(); })()`); // a visible field (those in collapsed sections do not take focus)
  const st0 = await P('PL.nadeState');
  await page.keyboard.press('KeyG'); await wait(page, 250);
  ok(st0 === null && await P('PL.nadeState === null'), 'a key typed in the panel does not reach the game', { forward: st0, afterwards: await P('PL.nadeState') });
  const box = await page.evaluate(() => { const r = document.querySelector('#ndbg h1').getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; });
  await page.mouse.move(box.x, box.y); await page.mouse.down(); await wait(page, 150);
  ok(await P('PL.held === false && PL.queued === false'), 'a click in the panel does not fire');
  await page.mouse.up(); await wait(page, 150); await P('document.getElementById("ndbg").classList.remove("min")');

  // Hold: the grenade of the chosen type in hand, without throwing anything
  const rig = () => P('(() => { const v = new V3(), q = new THREE.Quaternion(); const N = NADE_RIG; N.nade.getWorldPosition(v); N.nade.getWorldQuaternion(q); return { vis: N.g.visible && N.nade.visible, ty: Object.keys(N.models).find((k) => N.models[k] === N.nade), p: [v.x, v.y, v.z], q: [q.x, q.y, q.z, q.w], state: PL.nadeState, nades: PL.nades }; })()');
  await click('Hold'); await frames(page, 30); let s = await rig();
  ok(s.vis && s.ty === 'frag' && s.state === null, 'Hold: the frag in hand, with no pin actually pulled', s);
  await P(`document.querySelector('#ndbg button[data-ty=flash]').click()`); await frames(page, 20); s = await rig();
  ok(s.vis && s.ty === 'flash' && (await P('PL.nadeType')) === 'flash', 'the Flash button puts the flash in hand', s);
  ok(await P('NDBG.secs.filter((x) => x.type === "flash").some((x) => x.d.open) && NDBG.secs.filter((x) => x.type === "frag").every((x) => !x.d.open)'), 'its settings open, those of the frag collapse');
  const s0 = s; await slide('G.flash.p.2', -0.09); await frames(page, 20); s = await rig();
  ok(Math.hypot(s.p[0] - s0.p[0], s.p[1] - s0.p[1], s.p[2] - s0.p[2]) > 0.02 && Math.abs((await P('NADE_GRIP.flash.p[2]')) + 0.09) < 1e-6, 'a position slider moves the grenade in the hand (NADE_GRIP)');
  await slide('G.flash.r.0', 70); await frames(page, 20); const s2 = await rig();
  ok(Math.abs(s2.q[0] - s.q[0]) + Math.abs(s2.q[1] - s.q[1]) + Math.abs(s2.q[2] - s.q[2]) > 0.2, 'an angle slider rotates the grenade in the hand');
  ok(await P('NADE_GRIP.frag.p[2] === NDBG.def.NADE_GRIP.frag.p[2]'), 'one type\'s grip does not affect the others');
  // fingers and thumb of the real hand
  const fing = () => P('(() => { const u = NADE_RIG.R.hand.userData; return { i0: u.cur.i[0], t: u.cur.t.slice() }; })()');
  await slide('H.nflash.i.0', 0.2); await frames(page, 30); const f1 = await fing();
  ok(Math.abs(f1.i0 - 0.2) < 0.03 && Math.abs((await P('HAND_POSES.nflash.i[0]')) - 0.2) < 1e-6, 'a finger is adjusted and the hand takes it', f1.i0);
  await P(`(() => { for (const { d: b } of NDBG.secs.filter((x) => x.type === 'flash' && /thumb/.test(x.d.querySelector('summary').textContent))) for (const x of b.querySelectorAll('button')) if (x.textContent === 'Resting on the handle, toward the guard') x.click(); })()`); await frames(page, 30); const f2 = await fing();
  ok(await P('JSON.stringify(HAND_POSES.nflash.t) === JSON.stringify([0.2, 0.3, 0.2, 0.5, 0, 0, 0, 0])') && Math.abs(f2.t[3] - 0.5) < 0.03, 'Thumb: a starting pose sets the eight angles, the hand takes it');
  await click('Take grip from: Frag');
  ok(await P('JSON.stringify(NADE_GRIP.flash) === JSON.stringify(NADE_GRIP.frag) && JSON.stringify(HAND_POSES.nflash) === JSON.stringify(HAND_POSES.nfrag)'), 'Take grip from: Frag copies the position and the fingers');
  // armed arm
  const a0 = await rig(); await slide('N.armed.0', 0.1); await frames(page, 30); const a1 = await rig();
  ok(Math.abs(a1.p[0] - a0.p[0]) + Math.abs(a1.p[2] - a0.p[2]) > 0.05, 'the armed arm\'s wrist moves the hand and its grenade');
  // Pin pull and Throw: frozen at one instant, nothing leaves
  await click('Throw'); await P('(() => { NDBG.loop = false; NDBG.t = 0.05; })()'); await frames(page, 20); const l1 = await rig();
  await P('(() => { NDBG.t = 0.5; })()'); await frames(page, 20); const l2 = await rig();
  ok(l1.vis && !l2.vis && l2.nades === l1.nades && (await P('NADES.length')) === 0, 'Throw: the grenade leaves the hand at the instant of release, with no grenade actually thrown', { forward: l1.vis, afterwards: l2.vis });
  await click('Pin pull'); await P('(() => { NDBG.loop = true; NDBG.clock = 0; })()'); await frames(page, 20);
  ok(await P('NDBG.clock > 0 && NADE_RIG.g.visible'), 'Pin pull in a loop: the gesture replays');
  // the held type stays after a respawn
  await P('(() => { PL.ent.alive = false; respawnPlayer(); })()'); await frames(page, 10);
  ok((await P('PL.nadeType')) === 'flash', 'after a respawn, the hand still holds the chosen type');
  if (out) {
    await click('Reset all'); await click('Hold');
    for (const id of ['frag', 'flash', 'smoke']) { // (the buttons carry the translated name: we take them by their type)
      await P(`document.querySelector('#ndbg button[data-ty=${id}]').click()`); await frames(page, 40); await page.screenshot({ path: path.join(out, `outfit-${id}.png`), timeout: 180000 });
    }
  }
  // copy, apply, reset all
  await click('Reset all');
  await P(`(() => { const r = NDBG.rows.find((r) => r.path === 'G.smoke.p.1'); r.num.value = -0.051; r.num.dispatchEvent(new Event('change')); })()`);
  await click('Copy'); await wait(page, 300);
  const txt = await P('NDBG.ta.value'), cfg = JSON.parse(txt);
  ok(cfg.NADE_GRIP && cfg.NADE_GRIP.smoke.p[1] === -0.051 && cfg.handReturn.nflash.t.length === 8 && cfg.handReturn.nsmoke.i.length === 3 && cfg.NADE_POSE.armed.length === 3 && !('pullR' in cfg.NADE_POSE), 'Copy: the text is JSON (grips, hands of the three types, armed arm; without the trajectories)');
  await click('Reset all');
  ok(await P('NADE_GRIP.smoke.p[1] === NDBG.def.NADE_GRIP.smoke.p[1]'), 'Reset all: the code configuration comes back');
  await P(`(t => { NDBG.ta.value = t; })(${JSON.stringify(txt)})`); await click('Apply text');
  ok(await P('NADE_GRIP.smoke.p[1] === -0.051 && Math.abs(+NDBG.rows.find((r) => r.path === "G.smoke.p.1").input.value + 0.051) < 1e-6'), 'Apply: the copied text is read back and the sliders follow');
  await click('Reset all');
  await P(`(() => { NDBG.ta.value = JSON.stringify({ NADE_GRIP: { frag: { p: [0.01, 'x'], evil: 1 }, other: { p: [1, 1, 1] } }, NADE_POSE: { armed: [0.3], pullR: [[9, 9, 9, 9]] }, mains: { nsmoke: { t: 'no', i: [0.4] } } }); })()`); await click('Apply text');
  const after = await P('({ p: NADE_GRIP.frag.p, evil: NADE_GRIP.frag.evil, other: NADE_GRIP.other, armed: NADE_POSE.armed, pull: NADE_POSE.pullR[0][0], t: HAND_POSES.nsmoke.t, i: HAND_POSES.nsmoke.i, def: NDBG.def })');
  ok(after.p[0] === 0.01 && after.p[1] === after.def.NADE_GRIP.frag.p[1] && after.evil === undefined && after.other === undefined && after.armed[0] === 0.3 && after.pull === 0 && after.t.length === 8 && after.i[0] === 0.4, 'foreign text: only known keys, of the same type, get in', after);
  await click('Reset all');
  // reload: the configuration stays
  await P(`(() => { const r = NDBG.rows.find((r) => r.path === 'N.rollArmed'); r.num.value = -1.11; r.num.dispatchEvent(new Event('change')); })()`);
  await page.reload(); await page.waitForFunction('typeof NDBG !== "undefined" && !!NDBG.el', null, { timeout: 300000, polling: 500 });
  ok(await P('Math.abs(NADE_POSE.rollArmed + 1.11) < 1e-6'), 'after reload: the configuration is restored', await P('[NADE_POSE.rollArmed, (localStorage.getItem("dc_grenade") || "").length]'));
  const errs = logs.filter((l) => !l.includes('ERR_FILE_NOT_FOUND') && !l.includes('ERR_FAILED') && !l.includes('Failed to load'));
  ok(errs.length === 0, `clean console${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
  await g.browser.close();
  console.log(fails.length ? `${fails.length} failure(s)` : 'all good');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
