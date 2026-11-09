/* Tuning bench for the knife in hand (src/09zk-knife-tuning.js, game opened with ?knife=1): node knife-tuning.js [captures folder] ; PAGE=other.html.
   The game really runs (3D rendering off without a captures folder, bots frozen by the panel) and the panel is operated the way the owner would. Checks:
   - without ?knife=1, nothing exists (no panel, no hook);
   - with it: the panel, its settings and the free mouse; a slider, a checkbox and a numeric field change KNIFE_HELD, HAND_POSES.kgrip and the knife grip;
   - Rest, Run and Stab force the pose (knife drawn on its own, stride frozen or played, stab frozen at one instant);
   - what is done in the panel does not reach the game (F key, click);
   - Copy gives a text that Apply reads back, Reset all goes back to the code, the configuration survives a reload;
   - a damaged or foreign text does not get in (unknown keys, wrong numbers).
   Exits with an error at the first failure. With a folder: captures of the panel and the game (3D rendering kept). */
const path = require('path');
const { openGame, REPO } = require('./common');
const out = process.argv[2], fails = [];
const ok = (c, msg, extra) => { console.log((c ? 'ok    ' : 'FAIL ') + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails.push(msg); };
const wait = (page, ms) => page.waitForTimeout(ms);
// software rendering is slow when taking captures: we wait for game frames (frameN), not milliseconds
const frames = async (page, n) => { const f0 = await page.evaluate('frameN'); await page.waitForFunction(`frameN >= ${f0 + n}`, null, { timeout: 120000, polling: 50 }); };
const PAGE = path.resolve(REPO, 'dist', process.env.PAGE || 'index.html');
(async () => {
  if (out) require('fs').mkdirSync(out, { recursive: true });
  // 1. without ?knife=1
  let g = await openGame({ url: 'file://' + PAGE, w: 960, h: 540, settings: { quality: 'low', map: 'chergui' }, noHdri: true });
  ok(await g.page.evaluate(() => !document.getElementById('kdbg') && KNIFE_DEBUG === null && !LOCK.fallback), 'without ?knife=1: no panel or hook, the mouse stays captured');
  await g.browser.close();
  // 2. with
  g = await openGame({ url: 'file://' + PAGE + '?knife=1', w: 960, h: 540, settings: { quality: 'low', map: 'chergui' }, noHdri: true });
  const { page, logs } = g;
  await page.evaluate((cut) => { startMatch({}); if (cut) composer.render = () => {}; window.botsTick = () => {}; for (const o of entities) if (!o.isPlayer) { o.alive = false; o.model.root.visible = false; } }, !out); // bots frozen and moved away: nothing kills the player during the test
  await page.waitForFunction('typeof frameN !== "undefined" && frameN > 40 && !!document.getElementById("kdbg")', null, { timeout: 300000, polling: 500 });
  await page.evaluate(() => { localStorage.removeItem('dc_knife'); const e = PL.ent; e.pos.set(-27, groundHeight(-27, -12, 5, 0.3), -12); PL.yaw = 0; });
  const P = (js) => page.evaluate(js);
  const click = async (txt) => page.evaluate((t) => { for (const b of document.querySelectorAll('#kdbg button')) if (b.textContent === t) { b.click(); return true; } return false; }, txt);
  ok(await P('KNIFE_DEBUG !== null && LOCK.fallback === true && pointerActive()'), 'with ?knife=1: hook in place, mouse free');
  const n = await P('KDBG.rows.length');
  ok(n >= 50, `the panel has ${n} settings (arm, knife, fingers, run)`);
  ok(await P('["H.pos.0","H.grip.phi","H.grip.mid.2","G.i.0","G.t.4","G.t.5","G.t.6","G.t.7","H.run.amp.2","H.flex","H.S.1","G.p.2"].every((p) => KDBG.rows.some((r) => r.path === p))'), 'the key settings are there (wrist, grip, fingers, thumb with eight angles, run, shoulder)');

  // slider, numeric field, checkbox
  await P(`(() => { const r = KDBG.rows.find((r) => r.path === 'H.pos.0'); r.input.value = 0.31; r.input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  ok(await P('Math.abs(KNIFE_HELD.pos[0] - 0.31) < 1e-6 && Math.abs(+KDBG.rows.find((r) => r.path === "H.pos.0").num.value - 0.31) < 1e-6'), 'a slider changes KNIFE_HELD and its numeric field');
  await P(`(() => { const r = KDBG.rows.find((r) => r.path === 'H.pos.1'); r.num.value = -0.22; r.num.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  ok(await P('Math.abs(KNIFE_HELD.pos[1] + 0.22) < 1e-6 && Math.abs(+KDBG.rows.find((r) => r.path === "H.pos.1").input.value + 0.22) < 1e-6'), 'a numeric field changes KNIFE_HELD and its slider');
  const m0 = await P('Array.from(knifeGripMatrix(KNIFE_HELD.grip).elements)');
  await P(`(() => { const r = KDBG.rows.find((r) => r.path === 'H.grip.phi'); r.input.value = 40; r.input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  const m1 = await P('Array.from(knifeGripMatrix(KNIFE_HELD.grip).elements)'), moved = await P('Array.from(_kgmH.elements).every((v, i) => Math.abs(v - knifeGripMatrix(KNIFE_HELD.grip).elements[i]) < 1e-9)');
  ok(m0.some((v, i) => Math.abs(v - m1[i]) > 1e-3) && moved, 'the knife angle in the palm changes the grip (matrix and cached grip)');
  await P(`(() => { const r = KDBG.rows.find((r) => r.path === 'H.grip.flip'); r.input.checked = false; r.input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  ok(await P('KNIFE_HELD.grip.flip === false'), 'the "flipped grip" checkbox changes the grip');
  await P(`(() => { const r = KDBG.rows.find((r) => r.path === 'G.i.1'); r.input.value = 0.4; r.input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  ok(await P('Math.abs(HAND_POSES.kgrip.i[1] - 0.4) < 1e-6'), 'a finger can be tuned (HAND_POSES.kgrip)');
  ok(await P('localStorage.getItem("dc_knife") && JSON.parse(localStorage.getItem("dc_knife")).KNIFE_HELD.pos[0] === 0.31'), 'the configuration is kept in the browser');

  // nothing reaches the game
  await P(`(() => { document.querySelector('#kdbg input[type=number]').focus(); })()`);
  await page.keyboard.press('KeyF'); await wait(page, 250);
  ok(await P('PL.knifeT === 0 && PL.knifeBtn === null && !PL.knifeOut'), 'a key typed in the panel does not reach the game');
  const box = await page.evaluate(() => { const r = document.querySelector('#kdbg h1').getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; });
  const yaw0 = await P('PL.yaw');
  await page.mouse.move(box.x, box.y); await page.mouse.down(); await page.mouse.move(box.x + 30, box.y + 4); await wait(page, 200);
  ok(await P('PL.held === false && PL.queued === false'), 'a click in the panel does not shoot');
  await page.mouse.up(); await wait(page, 200);
  ok(Math.abs((await P('PL.yaw')) - yaw0) < 1e-9, 'the mouse moving over the panel does not turn the view');

  ok(await P('document.getElementById("kdbg").classList.contains("min")'), 'a click on the title collapses the panel'); await P('document.getElementById("kdbg").classList.remove("min")');
  await click('Reset all');
  // modes
  const rig = () => P('(() => { const v = new V3(); VM.knife.getWorldPosition(v); return { out: PL.knifeOut, vis: VM.knifeRig.visible, hold: +PL.knifeHold.toFixed(2), sprint: +VM.sprint.toFixed(2), knifeT: +PL.knifeT.toFixed(2), p: [v.x, v.y, v.z] }; })()');
  await click('Freeze bots'); ok(await P('KDBG.bots !== null && botsTick !== KDBG.bots'), 'Freeze bots');
  await click('Rest'); await frames(page, 80); let s = await rig();
  ok(s.out && s.vis && s.hold > 0.95, 'Rest: the knife comes out on its own and stays in hand', s);
  // the thumb: a preset sets the eight angles, a slider pivots the thumb base in the real hand
  await click('Resting on the handle, toward the guard');
  ok(await P('JSON.stringify(HAND_POSES.kgrip.t) === JSON.stringify([0.2, 0.3, 0.2, 0.5, 0, 0, 0, 0])'), 'Thumb: a preset sets the eight angles');
  const tq = () => P('(() => { const q = VM.knifeArm.hand.userData.tm.quaternion; return [q.x, q.y, q.z, q.w]; })()');
  await frames(page, 10); const q0 = await tq();
  await P(`(() => { const r = KDBG.rows.find((r) => r.path === 'G.t.6'); r.input.value = 1.2; r.input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await frames(page, 10); const q1 = await tq();
  ok(q0.some((v, i) => Math.abs(v - q1[i]) > 0.05), 'Thumb: the base pivot turns the hand\'s thumb', { forward: q0.map((v) => +v.toFixed(2)), afterwards: q1.map((v) => +v.toFixed(2)) });
  await click('Reset all');
  await click('Run'); await P('(() => { KDBG.anim = false; KDBG.ph = 0.5; })()'); await frames(page, 30); const c1 = await rig();
  await P('(() => { KDBG.ph = 3.6; })()'); await frames(page, 30); const c2 = await rig();
  const dc = Math.hypot(c1.p[0] - c2.p[0], c1.p[1] - c2.p[1], c1.p[2] - c2.p[2]);
  ok(dc > 0.005, 'Run: the pose follows the phase of the frozen stride', { dx: +dc.toFixed(3) });
  await P('(() => { KDBG.anim = true; })()'); await frames(page, 20);
  ok((await P('KDBG.ph')) !== 3.6, 'Run animated: the stride advances');
  await click('Stab'); await P('(() => { KDBG.loop = false; KDBG.t = 0.05; })()'); await frames(page, 30); const k1 = await rig();
  await P('(() => { KDBG.t = 0.4; })()'); await frames(page, 30); const k2 = await rig();
  const dk = Math.hypot(k1.p[0] - k2.p[0], k1.p[1] - k2.p[1], k1.p[2] - k2.p[2]);
  ok(dk > 0.03 && k1.knifeT === 0, 'Stab: the pose follows the chosen instant, with no stab actually made', { dx: +dk.toFixed(3) });
  // the strike: two full poses, start and end. The strike starts from the held pose, passes through the start at tStart and through the end at tEnd, and returns to the held pose
  const flatDiff = await P(`(() => {
    const B = knifeFlat(KNIFE_HELD, HAND_POSES.kgrip, new Float64Array(KP_N)), F = new Float64Array(KP_N), S0 = knifeFlat(KNIFE_STAB.start, KNIFE_STAB.start.fingers, new Float64Array(KP_N)), E0 = knifeFlat(KNIFE_STAB.end, KNIFE_STAB.end.fingers, new Float64Array(KP_N));
    const d = (a, b) => a.reduce((m, v, i) => Math.max(m, Math.abs(v - b[i])), 0), Z = KNIFE_STAB;
    return { t0: d(knifeStabPose(0, B, F), B), t1: d(knifeStabPose(1, B, F), B), start: d(knifeStabPose(Z.tStart, B, F), S0), end: d(knifeStabPose(Z.tEnd, B, F), E0), n: KP_N };
  })()`);
  ok(flatDiff.t0 < 1e-9 && flatDiff.t1 < 1e-9 && flatDiff.start < 1e-9 && flatDiff.end < 1e-9, 'the strike starts from the held pose, passes through the start and the end at their instants and returns to the held pose', flatDiff);
  await click('Panel right / left'); ok(await P('getComputedStyle(document.getElementById("kdbg")).left !== "0px" && document.getElementById("kdbg").classList.contains("right")'), 'the button moves the panel to the right (the start of the strike plays on the left)'); await click('Panel right / left'); ok(await P('getComputedStyle(document.getElementById("kdbg")).left === "0px"'), 'and brings it back to the left');
  await click('See the start'); await frames(page, 30); const q2 = await rig();
  ok(await P('KDBG.mode === "blow" && KDBG.loop === false && KDBG.t === KNIFE_STAB.tStart'), 'See the start: Stab mode, frozen at the start instant', await P('KDBG.t'));
  await click('See the end'); await frames(page, 30); const q3 = await rig();
  const dq = Math.hypot(q2.p[0] - q3.p[0], q2.p[1] - q3.p[1], q2.p[2] - q3.p[2]);
  ok(dq > 0.1, 'the start and end of the strike are not the same pose (the knife goes from left to right)', { dx: +dq.toFixed(3), startpoint: q2.p.map((v) => +v.toFixed(2)), outro: q3.p.map((v) => +v.toFixed(2)) });
  await P(`(() => { const r = KDBG.rows.find((r) => r.path === 'K.end.pos.0'); r.input.value = +r.input.value - 0.2; r.input.dispatchEvent(new Event('input', { bubbles: true })); })()`); await frames(page, 30); const q4 = await rig();
  ok(Math.hypot(q3.p[0] - q4.p[0], q3.p[1] - q4.p[1], q3.p[2] - q4.p[2]) > 0.05, 'an end-pose slider moves the knife at the end of the strike');
  await P(`(() => { const r = KDBG.rows.find((r) => r.path === 'K.end.fingers.i.0'); r.input.value = 0.2; r.input.dispatchEvent(new Event('input', { bubbles: true })); })()`); await frames(page, 30);
  ok(await P('Math.abs(KNIFE_STAB.end.fingers.i[0] - 0.2) < 1e-6 && Math.abs(HAND_POSES.kstab.i[0] - 0.2) < 0.02'), 'a finger of the end pose can be tuned and the strike hand picks it up');
  await click('End: take the held pose');
  ok(await P('JSON.stringify(KNIFE_STAB.end.pos) === JSON.stringify(KNIFE_HELD.pos) && KNIFE_STAB.end.roll === KNIFE_HELD.roll && JSON.stringify(KNIFE_STAB.end.fingers.t) === JSON.stringify(HAND_POSES.kgrip.t) && KNIFE_STAB.end.grip.phi === KNIFE_HELD.grip.phi'), 'End: take the held pose copies arm, grip and fingers');
  await click('Start: take the end');
  ok(await P('JSON.stringify(KNIFE_STAB.start) === JSON.stringify(KNIFE_STAB.end)'), 'Start: take the end copies the whole pose');
  await click('Reset all');
  await P('(() => { KDBG.loop = true; KDBG.clock = 0; })()'); await frames(page, 20);
  ok(await P('KDBG.clock > 0'), 'Looping strike: the motion replays');
  if (out) {
    await click('Run'); await P('(() => { KDBG.anim = false; KDBG.ph = 0.8; })()'); await frames(page, 40);
    await page.screenshot({ path: path.join(out, 'tuning-run.png') });
    await click('Rest'); await frames(page, 40);
    await page.screenshot({ path: path.join(out, 'tuning-rest.png') });
  }
  await click('Game');

  // copy, apply, reset all
  await P(`(() => { KDBG.rows.find((r) => r.path === 'H.pos.2').num.value = -0.37; KDBG.rows.find((r) => r.path === 'H.pos.2').num.dispatchEvent(new Event('change')); })()`);
  await click('Copy'); await wait(page, 300);
  const txt = await P('KDBG.ta.value'), cfg = JSON.parse(txt);
  ok(cfg.KNIFE_HELD && cfg.kgrip && cfg.KNIFE_HELD.pos[2] === -0.37 && cfg.kgrip.i.length === 3 && cfg.kgrip.t.length === 8 && cfg.KNIFE_HELD.run.amp.length === 3 && cfg.KNIFE_STAB.start.pos.length === 3 && cfg.KNIFE_STAB.start.fingers.t.length === 8 && cfg.KNIFE_STAB.end.grip.mid.length === 3 && cfg.KNIFE_STAB.end.pole.length === 3 && typeof cfg.KNIFE_STAB.tStart === 'number', 'Copy: the text is complete JSON (KNIFE_HELD, KNIFE_STAB with start and end, and kgrip)');
  await click('Reset all');
  ok(await P('KNIFE_HELD.pos[2] !== -0.37 && JSON.stringify(KNIFE_HELD.pos) === JSON.stringify(KDBG.def.KNIFE_HELD.pos)'), 'Reset all: the code configuration comes back');
  await P(`(t => { KDBG.ta.value = t; })(${JSON.stringify(txt)})`); await click('Apply text');
  ok(await P('KNIFE_HELD.pos[2] === -0.37 && Math.abs(+KDBG.rows.find((r) => r.path === "H.pos.2").input.value + 0.37) < 1e-6'), 'Apply: the copied text is read back and the sliders follow');
  // a foreign text: only known keys, of the same type, get in
  await click('Reset all');
  await P(`(() => { KDBG.ta.value = JSON.stringify({ KNIFE_HELD: { pos: [1, 'x', null], roll: 'oops', evil: 1, grip: { flip: 0, phi: 33, __proto__: { z: 1 } } }, kgrip: { i: [0.1, 0.2], t: 'no' }, KNIFE_STAB: { start: { pos: [9, 'x'], fingers: { t: [1, 2] } }, tStart: 0.2, low: [0.1, 0.2, 0.3] }, other: 5 }); })()`); await click('Apply text');
  const after = await P('({ pos: KNIFE_HELD.pos, roll: KNIFE_HELD.roll, evil: KNIFE_HELD.evil, flip: KNIFE_HELD.grip.flip, phi: KNIFE_HELD.grip.phi, i: HAND_POSES.kgrip.i, t: HAND_POSES.kgrip.t, z: ({}).z, def: KDBG.def.KNIFE_HELD, start: KNIFE_STAB.start, defs: KDBG.def.KNIFE_STAB.start, tStart: KNIFE_STAB.tStart, low: KNIFE_STAB.low })');
  ok(after.pos[0] === 1 && after.pos[1] === after.def.pos[1] && after.pos[2] === after.def.pos[2], 'foreign text: the valid number gets in, text and empty in place of a number do not', after.pos);
  ok(after.roll === after.def.roll && after.evil === undefined && after.z === undefined && after.flip === false && after.phi === 33 && after.t.length === 8 && after.i.length === 3, 'foreign text: unknown key, text in place of a number and __proto__ do not get in', after);
  ok(after.start.pos[0] === 9 && after.start.pos[1] === after.defs.pos[1] && after.start.fingers.t[0] === 1 && after.start.fingers.t[1] === 2 && after.start.fingers.t[2] === after.defs.fingers.t[2] && after.tStart === 0.2 && after.low[2] === 0.3, 'foreign text: the start pose (objects and arrays in the pose) only takes valid numbers', { pos: after.start.pos, t: after.start.fingers.t.slice(0, 3) });
  await P('(() => { try { kdbgLoad(\'{broken\'); } catch (e) {} })()');
  ok(true, 'unreadable text: refused without breaking the panel');
  await click('Reset all');
  // reload: the configuration stays
  await P(`(() => { const r = KDBG.rows.find((r) => r.path === 'H.roll'); r.num.value = -1.11; r.num.dispatchEvent(new Event('change')); })()`);
  await page.reload(); await page.waitForFunction('typeof KDBG !== "undefined" && !!KDBG.el', null, { timeout: 300000, polling: 500 });
  ok(await P('Math.abs(KNIFE_HELD.roll + 1.11) < 1e-6'), 'after reload: the configuration is restored');
  const errs = logs.filter((l) => !l.includes('ERR_FILE_NOT_FOUND') && !l.includes('ERR_FAILED') && !l.includes('Failed to load'));
  ok(errs.length === 0, `clean console${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
  await g.browser.close();
  console.log(fails.length ? `${fails.length} failure(s)` : 'all good');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
