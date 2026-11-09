/* Gamepad check: node tools/dev/visual/gamepad-check.js [captures folder]
   Simulates an Xbox gamepad (navigator.getGamepads) in the game: menu navigation (D-pad, A, B, tabs), starting a match, then movement, sprint (L3),
   look (response curves, acceleration), fire (RT, which stops sprint), aim (LT), jump, crouch, reload (short X) and picking up a ground weapon (held X), weapon switch, grenade, pause (Menu), left-handed layout; the prompt bar (#padHints) of the pause
   and results screens (glyphs, nothing covered, focus on "Replay"). Exits with an error code on the first failure. */
const { openGame } = require('./common');
const out = process.argv[2];
if (out) require('fs').mkdirSync(out, { recursive: true });
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL  :', msg); } else console.log('ok    :', msg); };
const until = (page, cond, ms) => page.waitForFunction(cond, null, { timeout: ms || 90000, polling: 100 }).then(() => true, () => false);

(async () => {
  const g = await openGame({ w: 800, h: 450, settings: { quality: 'low', map: 'chergui' }, noHdri: true, init: `
    window.__pad = { id: 'Xbox 360 Controller (STANDARD GAMEPAD)', connected: true, mapping: 'standard', index: 0, axes: [0,0,0,0], buttons: Array.from({length:17},()=>({pressed:false,value:0})) };
    navigator.getGamepads = () => [window.__pad];
    window.__set = (axes, btns) => { const p = window.__pad; if (axes) p.axes = axes; for (const k in (btns||{})) { const v = btns[k]; p.buttons[k] = { pressed: v > 0.5, value: v }; } };` });
  const { page } = g;
  const set = (axes, btns) => page.evaluate(([a, b]) => window.__set(a, b), [axes, btns]);
  // software rendering is slow (a few frames per second): a press must last several frames to be seen, and we wait for conditions rather than durations
  const frames = (n) => page.evaluate((k) => new Promise((r) => { let i = 0; const f = () => (++i >= k ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const tap = async (i) => { await set(null, { [i]: 1 }); await frames(4); await set(null, { [i]: 0 }); await frames(4); };
  await page.evaluate(() => { const b = document.getElementById('wnOk'); if (b) b.click(); });
  await page.evaluate(() => window.dispatchEvent(Object.assign(new Event('gamepadconnected'), { gamepad: window.__pad })));
  ok(await page.evaluate(() => PAD.seen), 'gamepad detected');
  // menus: A on the first button, D-pad down, B
  await tap(13); await frames(2);
  ok(await page.evaluate(() => PAD.drive && document.body.classList.contains('padnav')), 'the gamepad is in control in the menus');
  await tap(13); await frames(2);
  const f1 = await page.evaluate(() => document.activeElement && document.activeElement.className);
  ok(!!f1 && f1.includes('mbtn'), 'D-pad down: focus advances in the main menu (' + f1 + ')');
  // Options (tabs, one row per setting): the row is the unit; up and down move from row to row, left and right adjust, A toggles, LB and RB change tab
  await page.evaluate(() => { UI.stack = ['main']; uiGo('options', true); });
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => { const a = document.activeElement; return !!a && a.getAttribute('role') === 'tab' && a.getAttribute('aria-selected') === 'true'; }), 'Options: focus lands on the open tab');
  await tap(5); await page.waitForTimeout(150);
  ok(await page.evaluate(() => document.querySelectorAll('#optMenu .tabs button')[1].getAttribute('aria-selected') === 'true'), 'RB: next tab');
  await tap(4); await page.waitForTimeout(150);
  ok(await page.evaluate(() => document.querySelectorAll('#optMenu .tabs button')[0].getAttribute('aria-selected') === 'true'), 'LB: previous tab');
  await tap(13); await page.waitForTimeout(100);
  ok(await page.evaluate(() => document.activeElement.classList.contains('onav')), 'down: focus moves to the first setting row');
  // slider: the gamepad sensitivity row, right increases, left decreases
  await page.evaluate(() => { [...document.querySelectorAll('#optMenu .onav')].find((r) => /controller sens/i.test(r.textContent)).focus(); });
  const s0 = await page.evaluate(() => Settings.padSens); await tap(15);
  ok((await page.evaluate(() => Settings.padSens)) > s0, 'D-pad right: adjusts the sensitivity slider');
  await tap(14);
  ok((await page.evaluate(() => Settings.padSens)) <= s0 + 1e-9, 'D-pad left: decreases it');
  ok(await page.evaluate(() => !document.getElementById('padHints').classList.contains('hidden') && /Adjust/.test(document.getElementById('padHints').textContent)), 'help bar: Adjust on a row that can be adjusted');
  await tap(13); await tap(13); await tap(12); await tap(12);
  ok(await page.evaluate(() => document.activeElement.classList.contains('onav') && !!document.activeElement.closest('.orows')), 'up and down: focus stays on the setting rows');
  // segmented choice: A moves to the next choice; switch: A toggles
  const sg0 = await page.evaluate(() => { [...document.querySelectorAll('#optMenu .onav')].find((r) => r.querySelector('.seg') && /touch/i.test(r.textContent)).focus(); return Settings.touch; });
  await tap(0);
  ok((await page.evaluate(() => Settings.touch)) !== sg0, 'A on a segmented choice: setting changed');
  await page.evaluate(() => { Settings.touch = 'auto'; saveSettings(); touchDetect(); syncOptions(); });
  const iv0 = await page.evaluate(() => { [...document.querySelectorAll('#optMenu .onav')].find((r) => r.querySelector('input[type=checkbox]') && /vertical/i.test(r.textContent)).focus(); return Settings.invertY; });
  await tap(0);
  ok((await page.evaluate(() => Settings.invertY)) === !iv0, 'A on a switch: it toggles');
  await tap(0);
  if (out) await page.screenshot({ path: out + '/gamepad-options.png' });
  await tap(1); await page.waitForTimeout(300);
  ok(await page.evaluate(() => UI.screen === 'main'), 'B: back to main menu');
  ok(await page.evaluate(() => { const a = document.activeElement; return !!a && document.getElementById('scr-main').contains(a); }), 'back to the main menu: focus returns on its own inside the screen');
  // Solo, like the old Call of Duty games: menu on the left; a submenu opens on the right (A or right), the menu darkens; left at the edge or B closes it
  await page.evaluate(() => { UI.stack = ['main']; uiGo('solo', true); }); await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.activeElement.dataset.key === 'map'), 'Solo: focus lands on the first row (Map)');
  await tap(15); await page.waitForTimeout(300);
  ok(await page.evaluate(() => lmDepth(LM.scr.solo) === 1 && document.activeElement.classList.contains('lcard') && document.activeElement.classList.contains('on') && document.getElementById('scr-solo').classList.contains('lm-open')), 'right on Map: the map submenu opens on the right, focus on the chosen map, menu darkened');
  const k0 = await page.evaluate(() => document.activeElement.dataset.key); await tap(15);
  const k1 = await page.evaluate(() => document.activeElement.dataset.key);
  ok(k1 !== k0 && (await page.evaluate(() => document.activeElement.classList.contains('lcard'))), 'right in the grid: the neighboring map');
  await tap(14); await page.waitForTimeout(100);
  ok((await page.evaluate(() => document.activeElement.dataset.key)) === k0, 'left: back to the previous map');
  await tap(14); await page.waitForTimeout(300);
  ok(await page.evaluate(() => lmDepth(LM.scr.solo) === 0 && document.activeElement.dataset.key === 'map'), 'left at the edge of the grid: the submenu closes, focus on Map');
  await tap(0); await page.waitForTimeout(300); await tap(15); await tap(0); await page.waitForTimeout(400);
  ok(await page.evaluate((k) => lmDepth(LM.scr.solo) === 0 && document.activeElement.dataset.key === 'map' && Settings.map === k, k1), 'A on a map: chooses it, the submenu closes, focus on Map');
  await page.evaluate((k) => { Settings.map = k; saveSettings(); }, k0);
  await tap(13); await tap(0); await page.waitForTimeout(300);
  ok(await page.evaluate(() => lmDepth(LM.scr.solo) === 1 && LM.scr.solo.stack[1].id === 'setup' && document.activeElement.dataset.key === 'mode'), 'A on Match settings: the submenu opens on the mode');
  await page.evaluate(() => { document.querySelector('#soloPanel .lrow[data-key="time"]').focus(); });
  const m0 = await page.evaluate(() => Settings.minutes); await tap(15); await page.waitForTimeout(200);
  ok((await page.evaluate(() => Settings.minutes)) !== m0 && (await page.evaluate(() => document.activeElement.dataset.key)) === 'time', 'D-pad right on the duration: it changes and focus stays on the row');
  await tap(14); await page.waitForTimeout(200);
  ok((await page.evaluate(() => Settings.minutes)) === m0, 'd-pad left: goes back');
  await tap(1); await page.waitForTimeout(300);
  ok(await page.evaluate(() => UI.screen === 'solo' && lmDepth(LM.scr.solo) === 0 && document.activeElement.dataset.key === 'setup'), 'B: closes the submenu, focus on Match settings');
  await tap(13); await tap(13); await tap(13);
  ok(await page.evaluate(() => document.activeElement.id === 'soloGo'), 'down from the last row: focus moves to "Start the match"');
  await tap(12); await tap(12);
  // lobby: Back (B) is the only exit; it opens "Leave the lobby?" in the middle of the screen, focus on "Stay in the lobby"; B closes it, A on "Leave the lobby" leaves
  await page.evaluate(() => {
    UI.stack = ['main']; uiGo('multi', false);
    Object.assign(NET, { role: 'host', joined: true, code: 'AB12C', me: 'me', phase: 'lobby', t0: performance.now(), hostSeen: performance.now() + 1e6 });
    NET.players.clear(); NET.players.set('me', { id: 'me', n: 'Soldier', t: 0, h: true, lv: 12 }); netRender({ fresh: true });
  });
  await page.waitForTimeout(300); await tap(1); await page.waitForTimeout(300);
  ok(await page.evaluate(() => UI.screen === 'multi' && NET.role === 'host' && !document.getElementById('netLeave').classList.contains('hidden') && document.activeElement.id === 'nlStay'), 'lobby, B: "Leave the lobby?" opens, focus on "Stay in the lobby"');
  await tap(1); await page.waitForTimeout(300);
  ok(await page.evaluate(() => UI.screen === 'multi' && NET.role === 'host' && document.getElementById('netLeave').classList.contains('hidden')), 'B again: the question closes, we stay in the lobby');
  await tap(1); await page.waitForTimeout(300);
  const up = await page.evaluate(() => document.getElementById('nlQuit').getBoundingClientRect().bottom <= document.getElementById('nlStay').getBoundingClientRect().top); // buttons stacked one under the other on a short screen
  await tap(up ? 12 : 14); await tap(0); await page.waitForTimeout(300);
  ok(await page.evaluate(() => UI.screen === 'multi' && NET.role === 'off' && LM.scr.multi.stack[0].id === 'home'), 'A on "Leave the lobby": the lobby is left, we stay on the Multiplayer screen');
  await page.evaluate(() => { Settings.touch = 'auto'; saveSettings(); touchDetect(); UI.stack = ['main']; uiGo('main', false); }); await page.waitForTimeout(200);
  // cursor and hover: the gamepad is in control, the mouse hovers nothing anymore (no double highlight); a mouse movement gives control back
  await tap(13); await frames(2);
  ok(await page.evaluate(() => { const b = document.querySelector('#scr-main .mbtn'), c = getComputedStyle(b); return PAD.drive && c.pointerEvents === 'none' && c.cursor === 'none'; }), 'gamepad active: cursor hidden, no hover');
  await page.mouse.move(400, 300); await page.mouse.move(430, 330); await frames(2);
  ok(await page.evaluate(() => !PAD.drive && !document.body.classList.contains('padnav') && getComputedStyle(document.querySelector('#scr-main .mbtn')).pointerEvents !== 'none'), 'a mouse movement gives control back (cursor and hover return)');
  // Menu: the screen's main action ("Start the match"); the help bar names it
  await page.evaluate(() => { UI.stack = ['main']; uiGo('solo', false); window.__go = 0; document.getElementById('soloGo').addEventListener('click', (e) => { window.__go++; e.stopImmediatePropagation(); }, true); });
  await page.waitForTimeout(300); await tap(13); await frames(2);
  ok(await page.evaluate(() => !document.getElementById('padHints').classList.contains('hidden') && document.getElementById('padHints').textContent.includes('Start the match')), 'help bar: Menu = Start the match');
  await tap(9); await frames(2);
  ok(await page.evaluate(() => window.__go === 1), 'Menu: starts the match from any element of the Solo screen');
  // aiming speed: 100% at the hip, the full multiplier when aiming
  ok(await page.evaluate(() => { VM.ads = 0; const a = adsLookMul(0.5); VM.ads = 1; const b = adsLookMul(0.5), c = adsLookMul(1); VM.ads = 0; return Math.abs(a - 1) < 1e-6 && Math.abs(b - 0.5) < 1e-6 && Math.abs(c - 1) < 1e-6; }), 'aiming multiplier: 1 at the hip, full when aiming');
  // response curves of the look stick (padStick): dead zone, starts right after leaving the dead zone, monotonic, full at 95% of travel
  const cv = await page.evaluate(() => {
    const at = (name, m, dead) => padStick(m, 0, dead, PAD_CURVES[name])[0];
    const mono = (name) => { let p = -1; for (let m = 0; m <= 1.0001; m += 0.01) { const o = at(name, m, 0.1); if (o < p - 1e-9) return false; p = o; } return true; };
    return { dead: at('reactive', 0.09, 0.1), start: at('reactive', 0.15, 0.1), startOld: at('classic', 0.15, 0.1), full: at('reactive', 0.95, 0.1), fullLin: at('linear', 0.95, 0.1), over: at('reactive', 1, 0.1),
      mid: at('reactive', 0.5, 0.1), midOld: at('classic', 0.5, 0.1), lin: at('linear', 0.525, 0.1), mono: mono('reactive') && mono('classic') && mono('linear'),
      circ: Math.hypot(...padStick(0.8, 0.8, 0.1, PAD_CURVES.reactive).slice(0, 2)), noPick: Object.values(PAD_LAYOUTS).every((l) => !Object.values(l).includes('pick')), def: [Settings.padCurve, Settings.padAccel, Settings.padDead] };
  });
  ok(cv.dead === 0 && cv.start > 0.015 && cv.start > cv.startOld * 2, `responsive curve: nothing in the dead zone, a clean start right after leaving it (${cv.start.toFixed(3)} vs ${cv.startOld.toFixed(3)} avant)`);
  ok(Math.abs(cv.full - 1) < 1e-9 && Math.abs(cv.fullLin - 1) < 1e-9 && Math.abs(cv.over - 1) < 1e-9, 'stick at 95% of travel: full speed, no overshoot at full tilt');
  ok(cv.mono && cv.mid > cv.midOld && Math.abs(cv.mid - 0.287) < 0.03 && Math.abs(cv.lin - 0.5) < 0.01, `monotonic curves, the responsive one is livelier than the old one at the middle (${cv.mid.toFixed(2)} vs ${cv.midOld.toFixed(2)}), the linear one follows the travel`);
  ok(Math.abs(cv.circ - 1) < 1e-9 && cv.def.join() === 'reactive,normal,0.1', `radial dead zone (full diagonal = 1) and default settings ${cv.def.join(' ')}`);
  ok(cv.noPick, 'no layout has a pickup button anymore (X held)');
  await page.evaluate(() => { toMenu('main'); });
  // match
  await page.evaluate(() => { toMenu('solo'); menuLaunch({ online: false, map: Settings.map, deploy: () => startMatch() }); });
  await until(page, "UI.screen==='deploy'", 120000);
  await page.evaluate(() => { if (UI.screen === 'deploy') document.getElementById('depGo').click(); });
  ok(await until(page, "MATCH.state==='playing' && PL.ent.alive", 120000), 'match started');
  await page.waitForTimeout(800);
  ok(await page.evaluate(() => pointerActive() && !document.getElementById('lockPrompt').classList.contains('show')), 'pointerActive with the gamepad, no "Click to play" prompt');
  // movement
  const p0 = await page.evaluate(() => PL.ent.pos.toArray());
  await set([0, -1, 0, 0], {});
  ok(await until(page, `Math.hypot(PL.ent.pos.x - ${p0[0]}, PL.ent.pos.z - ${p0[2]}) > 0.8`, 60000), 'left stick forward: the soldier advances');
  await set([0, 0, 0, 0], {});
  // sprint L3
  await set([0, -1, 0, 0], {}); await frames(6); await tap(10);
  ok(await until(page, 'PL.sprinting', 30000), 'L3: sprint');
  await set([0, 0, 0, 0], {}); await frames(4);
  ok(await page.evaluate(() => !PAD.sprint), 'stick released: sprint stops');
  // firing while running: the run stops and the shot goes off; it resumes only with L3
  await set([0, -1, 0, 0], {}); await frames(6); await tap(10);
  ok(await until(page, 'PL.sprinting', 30000), 'L3: sprint, before the shot');
  const shots0 = await page.evaluate(() => PL.ent.arms.shots);
  await set([0, -1, 0, 0], { 7: 1 });
  ok(await until(page, `!PL.sprinting && PL.ent.arms.shots > ${shots0}`, 30000), 'RT while sprinting: the run stops and the shot goes off');
  await set([0, -1, 0, 0], { 7: 0 }); await frames(6);
  ok(await page.evaluate(() => !PAD.sprint && !PL.sprinting), 'RT released: the run does not resume without L3');
  await tap(10); ok(await until(page, 'PL.sprinting', 30000), 'L3: sprint again');
  const shots1 = await page.evaluate(() => PL.ent.arms.shots);
  await set([0, -1, 0, 0], { 7: 1 }); await frames(1); await set([0, -1, 0, 0], { 7: 0 }); // short press, released before the end of the sprint exit
  ok(await until(page, `PL.ent.arms.shots > ${shots1}`, 30000), 'short RT while sprinting (automatic weapon): the shot goes off anyway');
  await set([0, 0, 0, 0], {}); await frames(4);
  // regard
  const y0 = await page.evaluate(() => PL.yaw);
  await set([0, 0, 1, 0], {});
  ok(await until(page, `PL.yaw < ${y0} - 0.2`, 60000), 'right stick to the right: the view turns right'); await set([0, 0, 0, 0], {});
  // small deflection (20% of raw travel): the look starts right away
  const ys = await page.evaluate(() => PL.yaw);
  await set([0, 0, 0.2, 0], {});
  ok(await until(page, `PL.yaw < ${ys} - 0.03`, 60000), 'right stick at 20%: the look starts as soon as it leaves the dead zone'); await set([0, 0, 0, 0], {});
  // acceleration: at full tilt, the ramp climbs to 1 then the speed gain of PAD_ACCEL applies; released, it falls back
  await set([0, 0, 1, 0], {});
  ok(await until(page, 'PAD.ramp > 0.99', 60000), 'right stick at full tilt: the acceleration ramp climbs to the maximum');
  ok(await page.evaluate(() => { const y0 = PL.yaw; PAD.lx = 1; PAD.ly = 0; padLook(0.01); return PL.yaw < y0; }), 'padLook turns the view at full ramp');
  await set([0, 0, 0, 0], {});
  ok(await until(page, 'PAD.ramp === 0', 30000), 'stick released: the ramp falls back');
  const accOff = await page.evaluate(() => {
    const run = (acc) => { Settings.padAccel = acc; PAD.ramp = 1; PAD.lx = 1; PAD.ly = 0; const y0 = PL.yaw; padLook(0.01); return y0 - PL.yaw; };
    const off = run('off'), normal = run('normal'), strong = run('strong'); PAD.lx = 0; PAD.ramp = 0; Settings.padAccel = 'normal';
    return { off, normal, strong };
  });
  ok(Math.abs(accOff.normal / accOff.off - 1.5) < 0.2 && accOff.strong > accOff.normal, `acceleration gain: None 1, Normal ${(accOff.normal / accOff.off).toFixed(2)}, Forte ${(accOff.strong / accOff.off).toFixed(2)}`);
  const pi0 = await page.evaluate(() => PL.pitch);
  await set([0, 0, 0, -1], {});
  ok(await until(page, `PL.pitch > ${pi0} + 0.1`, 60000), 'right stick up: the view rises'); await set([0, 0, 0, 0], {});
  // triggers
  await set(null, { 7: 1 }); await frames(4);
  ok(await page.evaluate(() => PL.held), 'RT: fire held');
  await set(null, { 7: 0 }); await frames(4);
  ok(await page.evaluate(() => !PL.held), 'RT released: firing stops');
  await set(null, { 6: 1 }); await frames(4);
  ok(await page.evaluate(() => PL.adsWant), 'LT: aiming'); await set(null, { 6: 0 }); await frames(4);
  ok(await page.evaluate(() => !PL.adsWant), 'LT released: end of aiming');
  // buttons
  const c0 = await page.evaluate(() => PL.cur); await tap(3);
  ok(await until(page, `PL.cur !== ${c0}`, 30000), 'Y: switch weapon');
  await until(page, 'PL.switching <= 0', 30000);
  await page.evaluate(() => { PL.weapons[PL.cur].mag = 1; }); await tap(2);
  ok(await until(page, 'PL.reload', 30000), 'X: reload');
  await until(page, '!PL.reload', 60000);
  // X held: picks up the ground weapon in range (a short press always reloads); the prompt says so and a thin bar fills during the press
  await page.evaluate(() => {
    clearDrops(); // (weapons dropped by dead bots must not come first)
    const P = PL.ent, A = P.arms, have = new Set(A.slots.map((x) => x.def.id));
    const def = Object.values(WEAPONS).find((w) => !have.has(w.id) && w.cat === A.slots[A.cur].def.cat) || Object.values(WEAPONS).find((w) => !have.has(w.id));
    window.__dropId = def.id; window.__heldId = A.slots[A.cur].def.id;
    dropWeapon(def, 20, 60, new V3(P.pos.x - Math.sin(P.yaw) * 0.8, P.pos.y + 0.3, P.pos.z - Math.cos(P.yaw) * 0.8), new THREE.Quaternion(), new V3());
  });
  ok(await until(page, 'DROP.cur && DROP.cur.def.id === window.__dropId', 60000), 'ground weapon in range: the prompt appears');
  const pk = await page.evaluate(() => { const el = document.getElementById('pickup'); return { t: el.textContent, g: el.querySelectorAll('kbd.key.pad.b2').length }; });
  ok(/Hold/.test(pk.t) && pk.g === 1, 'prompt: "Hold X to swap..." with the X button (' + pk.t + ')');
  await page.evaluate(() => { PL.weapons[PL.cur].mag = 1; });
  await set(null, { 2: 1 }); await frames(2);
  ok(await page.evaluate(() => !PL.reload && PAD.useT >= 0 && document.getElementById('pickup').classList.contains('hold')), 'X pressed: no reload right away, the bar fills');
  await set(null, { 2: 0 }); await frames(2);
  ok(await until(page, 'PL.reload', 30000), 'X released before 0.3 s: it reloads');
  ok(await page.evaluate(() => !!DROP.cur && PL.weapons[PL.cur].def.id === window.__heldId), 'short press: the ground weapon stayed where it was');
  await until(page, '!PL.reload', 60000);
  await set(null, { 2: 1 });
  ok(await until(page, 'PL.weapons[PL.cur].def.id === window.__dropId', 60000), 'X held 0.3 s: the ground weapon is picked up');
  ok(await page.evaluate(() => !PL.reload && DROP.list.some((d) => d.def.id === window.__heldId)), 'pickup: no reload, the dropped weapon falls to the ground');
  await set(null, { 2: 0 }); await frames(3);
  ok(await page.evaluate(() => !PL.reload && PAD.useT === -1 && !document.getElementById('pickup').classList.contains('hold')), 'X released after the pickup: nothing reloads, the bar disappears');
  await until(page, 'PL.switching <= 0', 30000);
  await set(null, { 0: 1 }); await frames(3);
  ok(await page.evaluate(() => !!KEYS.Space), 'A: jump (jump key held)'); await set(null, { 0: 0 }); await frames(3);
  ok(await page.evaluate(() => !KEYS.Space), 'A released: jump released');
  await tap(1); ok(await until(page, 'PL.crouchToggle', 30000), 'B: crouch');
  await tap(1);
  const n0 = await page.evaluate(() => PL.nades); await set(null, { 5: 1 }); await frames(8); await set(null, { 5: 0 });
  ok(await until(page, `PL.nades < ${n0}`, 60000), 'RB: grenade thrown');
  await until(page, '!PL.nadeState', 60000); await until(page, 'PL.switching <= 0', 30000);
  // R3: a short press gives a strike, held it pulls out the knife, Y (switch weapon) puts it away
  await tap(11); ok(await until(page, 'PL.knifeT > 0 && !PL.knifeOut', 30000), 'short R3: a knife strike, the knife does not stay in hand');
  await until(page, 'PL.knifeT <= 0', 30000);
  await set(null, { 11: 1 }); ok(await until(page, 'PL.knifeOut', 60000), 'R3 held: the knife is in hand'); await set(null, { 11: 0 }); await frames(4);
  ok(await page.evaluate(() => PL.knifeOut && PL.knifeT <= 0), 'R3 released: the knife stays in hand, no extra strike');
  await tap(3); ok(await until(page, '!PL.knifeOut', 30000), 'Y: the knife is put away');
  await until(page, 'PL.switching <= 0 && VM.lower < 0.05', 60000);
  await set(null, { 8: 1 }); await frames(4);
  ok(await page.evaluate(() => HUD.board), 'Back: scoreboard'); await set(null, { 8: 0 }); await frames(4);
  ok(await page.evaluate(() => !HUD.board), 'Back released: scoreboard closed');
  if (out) await page.screenshot({ path: out + '/gamepad-game.png' });
  // left-handed: the sticks are swapped
  await page.evaluate(() => { Settings.padLay = 'southpaw'; });
  const q0 = await page.evaluate(() => PL.ent.pos.toArray());
  await set([0, 0, 0, -1], {});
  ok(await until(page, `Math.hypot(PL.ent.pos.x - ${q0[0]}, PL.ent.pos.z - ${q0[2]}) > 0.6`, 60000), 'left-handed: the right stick moves'); await set([0, 0, 0, 0], {}); await page.evaluate(() => { Settings.padLay = 'default'; });
  // pause
  await tap(9); ok(await until(page, "MATCH.state==='paused'", 30000), 'Menu: pause');
  // pause: the prompt bar at the bottom right, with the button glyphs (A, Menu = Resume), which does not cover the menu
  ok(await until(page, "!document.getElementById('padHints').classList.contains('hidden')", 30000), 'pause: gamepad prompt bar');
  const ph = await page.evaluate(() => { const h = document.getElementById('padHints'), r = h.getBoundingClientRect(), hit = [...document.querySelectorAll('.pm button')].filter((b) => { const q = b.getBoundingClientRect(); return q.width && r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top; }).map((b) => b.id || b.dataset.pm); return { t: h.textContent, g: h.querySelectorAll('kbd.key.pad').length, right: innerWidth - r.right, hit }; });
  ok(ph.t.includes('Resume') && ph.g >= 2 && ph.right < 40 && !ph.hit.length, `pause: invites ${JSON.stringify(ph)}`);
  if (out) await page.screenshot({ path: out + '/gamepad-pause.png' });
  await tap(9); ok(await until(page, "MATCH.state==='playing'", 30000), 'Menu: resume');
  // a click gives control back to the mouse
  await page.mouse.click(300, 300); await page.waitForTimeout(200);
  ok(await page.evaluate(() => !PAD.drive), 'a click gives control back to the mouse');
  // end of match: the gamepad takes over the results; prompt bar (A, Menu = Replay), focus on the main action, nothing covered
  await page.evaluate(() => { MATCH.score[0] = MATCH.limit; endMatch(); });
  await tap(13); await frames(3);
  ok(await until(page, "MATCH.state==='ended' && PAD.drive && !document.getElementById('padHints').classList.contains('hidden')", 30000), 'end of match: gamepad prompt bar');
  const eh = await page.evaluate(() => { const h = document.getElementById('padHints'), r = h.getBoundingClientRect(), hit = [...document.querySelectorAll('#end button')].filter((b) => { const q = b.getBoundingClientRect(); return q.width && r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top; }).map((b) => b.id); return { t: h.textContent, g: h.querySelectorAll('kbd.key.pad').length, f: document.activeElement && document.activeElement.id, hit }; });
  ok(eh.t.includes('Play again') && eh.g >= 2 && eh.f === 'againBtn' && !eh.hit.length, `end of match: prompts and focus on "Replay" ${JSON.stringify(eh)}`);
  if (out) await page.screenshot({ path: out + '/gamepad-end.png' });
  const errs = g.logs.filter((l) => l.includes('pageerror'));
  ok(!errs.length, 'no page error' + (errs.length ? ': ' + errs[0] : ''));
  await g.browser.close();
  console.log(fails ? fails + ' failure(s)' : 'all good');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('ERROR', e); process.exit(2); });
