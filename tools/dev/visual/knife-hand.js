/* Knife in hand (src/08-player.js: knifeButton, knifeDraw, knifeStow; src/07c-controller.js: KNIFE_MOVE): node knife-hand.js [page] ; PAGE=other.html.
   The game really runs (frame loop, 3D rendering off, bots frozen), keys and mouse come from Playwright. Checks:
   - without the knife: the weapon's walk and sprint speed; a brief press of F gives a strike, which goes off on release;
   - F held: the knife comes out (after KNIFE_HOLD), walking and sprinting go KNIFE_MOVE / d.move times faster;
   - knife in hand: a click gives a strike and does not shoot, aiming and reloading have no effect, no crosshair or magazine in the HUD, the weapon stays lowered;
   - an enemy in range: the strike goes off on press, and a held press then draws the knife;
   - 2 (or 1, Q) stows the knife and brings the weapon back out, Q goes back to the previous one; a grenade thrown with the knife in hand leaves it in hand;
   - the strike animation: a simple press (knife not in hand) plays the original strike, a strike with the knife in hand plays the one tuned in the bench (KNIFE_STAB), and a knife drawn mid original strike does not make the hand jump;
   - death: no more knife in hand; another class (giveLoadout) neither;
   - the hand stays in the view (rest, run over several strides; at the strike's contact, and the sweep takes it out of frame at the end of the strike), the tip too at rest and while running, in 16:9 and on a phone screen.
   Exits with an error at the first failure. */
const { openGame } = require('./common');
const fails = [];
const ok = (c, msg, extra) => { console.log((c ? 'ok    ' : 'FAIL ') + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails.push(msg); };
const wait = (page, ms) => page.waitForTimeout(ms);
(async () => {
  const { browser, page, logs } = await openGame({ page: process.argv[2] || process.env.PAGE, w: 640, h: 360, settings: { quality: 'low', map: 'chergui' }, noHdri: true });
  await page.evaluate(() => {
    LOCK.fallback = true; startMatch({}); composer.render = () => {}; // 3D rendering off: the frame loop runs fast with software rendering
    window.botsTick = () => {}; // bots frozen: nothing shoots, nothing moves
    window.entChest = (e, out) => out.set(e.pos.x, e.pos.y + 1.3, e.pos.z); // a frozen bot's body does not follow its position: the torso is placed from it
  });
  await page.waitForFunction('typeof frameN !== "undefined" && frameN > 40', null, { timeout: 300000, polling: 500 });
  // a clear patch of ground: 28 m ahead with no wall or step (collideCircle pushes nowhere), to run without touching anything
  const spot = await page.evaluate(() => {
    for (let x = -30; x <= 30; x += 3) for (let z = -30; z <= 30; z += 3) for (let a = 0; a < 8; a++) {
      const yaw = a * Math.PI / 4, dx = -Math.sin(yaw), dz = -Math.cos(yaw), g = groundHeight(x, z, 5, 0.3);
      if (Math.abs(g) > 0.3) continue;
      let free = true;
      for (let d = 0; d <= 28 && free; d++) { const q = new V3(x + dx * d, g, z + dz * d), x0 = q.x, z0 = q.z; collideCircle(q, 0.36, 1.75); free = Math.hypot(q.x - x0, q.z - z0) < 0.01 && Math.abs(groundHeight(x0, z0, 5, 0.3) - g) < 0.3; }
      if (free) return { x, z, yaw };
    }
    return null;
  });
  ok(!!spot, 'a clear 28 m patch of ground to run on', spot);
  if (!spot) { await browser.close(); process.exit(1); }
  const place = () => page.evaluate((s) => {
    const e = PL.ent; e.alive = true; e.health = 100; e.pos.set(s.x, groundHeight(s.x, s.z, 5, 0.3), s.z); e.vel.set(0, 0, 0); e.vy = 0; e.onGround = true;
    PL.yaw = PL.pitch = 0; PL.yaw = s.yaw; PL.protT = 99; e.protT = 99;
    if (PL.cur !== 0) { PL.cur = 0; } PL.switching = 0; PL.knifeOut = false; PL.knifeHold = 0; PL.knifeBtn = null; PL.knifeT = 0; PL.nadeState = null; PL.reload = null;
    VM.lowerTarget = 0; VM.lower = 0; PL.ent.arms.slots[0].mag = PL.ent.arms.slots[0].def.mag; vmEquip(PL.ent.arms.slots[0].def);
    for (const o of entities) if (!o.isPlayer) { o.alive = false; o.model.root.visible = false; }
  }, spot);
  const st = () => page.evaluate(() => ({
    out: PL.knifeOut, knew: PL.knifeNew, knifeT: PL.knifeT, cur: PL.cur, sw: PL.switching, lowerT: VM.lowerTarget, lower: +VM.lower.toFixed(2), hold: +PL.knifeHold.toFixed(2),
    mag: curW().mag, shots: PL.ent.arms.shots, reload: !!PL.reload, ads: !!PL.ent.adsActive, vads: +VM.ads.toFixed(2), spd: +Math.hypot(PL.ent.vel.x, PL.ent.vel.z).toFixed(2),
    sprint: !!PL.sprinting, rig: VM.knifeRig.visible, holder: VM.holder.visible, nades: PL.nades, wname: document.getElementById('wname').textContent,
    xh: document.getElementById('xhair').style.opacity, hudNums: document.querySelector('.ammo .nums').style.visibility, bm: PL.ent.arms.slots[0].def.move, pm: PL.ent.arms.slots[1].def.move,
  }));
  const run = async (key, ms) => { await page.keyboard.down(key); await wait(page, ms); };

  // 1. bare-handed: the weapon's speed, brief press = strike on release
  await place(); await wait(page, 200);
  await page.keyboard.down('KeyW'); await wait(page, 1400);
  let s = await st();
  const base = 4.4 * s.bm;
  ok(Math.abs(s.spd - base) < 0.35, `walking with the weapon: ${s.spd} m/s (expected ${base.toFixed(2)})`);
  await page.keyboard.up('KeyW'); await wait(page, 500);
  await page.keyboard.down('KeyF'); await wait(page, 90); s = await st();
  ok(s.knifeT === 0 && !s.out, 'brief press, nobody in range: the strike did not go off on press', { knifeT: s.knifeT });
  await page.keyboard.up('KeyF'); await wait(page, 60); s = await st();
  ok(s.knifeT > 0 && !s.out, 'brief press: the strike goes off on release, the knife does not stay in hand', { knifeT: +s.knifeT.toFixed(2), out: s.out });
  ok(!s.knew, 'simple press: the original strike, not the one for the knife in hand', { knew: s.knew });
  await wait(page, 700);

  // 2. F held: the knife comes out, we go faster
  await place(); await wait(page, 200);
  await page.keyboard.down('KeyF'); await wait(page, 150); s = await st();
  ok(!s.out, 'F held 0.15 s: not in hand yet', { out: s.out });
  await wait(page, 350); s = await st();
  ok(s.out && s.knifeT === 0, 'F held 0.5 s: the knife is in hand, no strike given', { out: s.out, knifeT: s.knifeT });
  await page.keyboard.up('KeyF'); await wait(page, 300); s = await st();
  ok(s.out && s.rig && s.hold > 0.9 && s.lowerT === 1 && !s.holder, 'F released: the knife stays in hand, the hand is there, the weapon lowered', { hold: s.hold, rig: s.rig, holder: s.holder, lowerT: s.lowerT });
  ok(s.wname.toLowerCase() === 'knife', 'HUD: the knife name in place of the weapon', s.wname);
  ok(s.hudNums === 'hidden', 'HUD: no magazine or reserve', s.hudNums);
  ok(+s.xh === 0, 'HUD: no crosshair', s.xh);
  await page.keyboard.down('KeyW'); await wait(page, 1400); s = await st();
  const kn = 4.4 * 1.15;
  ok(Math.abs(s.spd - kn) < 0.35 && s.spd > base + 0.4, `walking with the knife in hand: ${s.spd} m/s (expected ${kn.toFixed(2)}, ${base.toFixed(2)} with the weapon)`);
  await page.keyboard.down('ShiftLeft'); await wait(page, 1200); s = await st();
  const kns = kn * 1.55;
  ok(s.sprint && Math.abs(s.spd - kns) < 0.5, `sprint with the knife in hand: ${s.spd} m/s (expected ${kns.toFixed(2)})`);
  await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW'); await wait(page, 400);

  // 3. knife in hand: click strikes, aiming and reloading do nothing
  await place(); await wait(page, 100);
  await page.evaluate(() => { curW().mag = 10; });
  await page.keyboard.down('KeyF'); await wait(page, 500); await page.keyboard.up('KeyF'); await wait(page, 200);
  const before = await st();
  await page.mouse.down(); await wait(page, 120); s = await st();
  ok(s.knifeT > 0 && s.shots === before.shots && s.mag === 10, 'click with the knife in hand: one knife strike, no shot', { knifeT: +s.knifeT.toFixed(2), shots: s.shots - before.shots, mag: s.mag });
  ok(s.knew, 'click with knife in hand: the strike of the knife in hand', { knew: s.knew });
  await wait(page, 600); s = await st();
  ok(s.out && s.rig && s.knifeT >= 0, 'click held: strikes chain together and the knife stays in hand', { knifeT: +s.knifeT.toFixed(2) });
  await page.mouse.up(); await wait(page, 700);
  await page.mouse.down({ button: 'right' }); await wait(page, 500); s = await st();
  ok(!s.ads && s.vads < 0.05, 'right click with knife in hand: no aiming', { ads: s.ads, vads: s.vads });
  await page.mouse.up({ button: 'right' });
  await page.keyboard.press('KeyR'); await wait(page, 300); s = await st();
  ok(!s.reload && s.mag === 10, 'R with the knife in hand: no reload', { reload: s.reload, mag: s.mag });

  // 4. stowing: 2 draws the pistol, Q goes back to the previous weapon
  await page.keyboard.press('Digit2'); await wait(page, 900); s = await st();
  ok(!s.out && s.cur === 1 && s.sw <= 0 && s.lowerT === 0 && s.lower < 0.05 && s.holder && !s.rig, 'key 2: knife stowed, pistol in hand', { out: s.out, cur: s.cur, lower: s.lower, holder: s.holder, rig: s.rig });
  await page.keyboard.down('KeyF'); await wait(page, 500); await page.keyboard.up('KeyF'); await wait(page, 200); s = await st();
  ok(s.out && s.cur === 1, 'knife drawn with the pistol', { out: s.out, cur: s.cur });
  await page.keyboard.press('KeyQ'); await wait(page, 900); s = await st();
  ok(!s.out && s.cur === 1 && s.holder, 'Q with knife in hand: back to the pistol held before (not to the other weapon)', { out: s.out, cur: s.cur });
  await page.keyboard.press('Digit1'); await wait(page, 900);
  await page.keyboard.down('KeyF'); await wait(page, 500); await page.keyboard.up('KeyF'); await wait(page, 200);
  await page.keyboard.press('Digit1'); await wait(page, 900); s = await st();
  ok(!s.out && s.cur === 0 && s.holder && s.lower < 0.05, 'key 1 with the knife in hand: the primary weapon comes back out', { out: s.out, cur: s.cur, lower: s.lower });

  // 5. an enemy in range: the strike goes off on press, a held press then draws the knife
  await place(); await wait(page, 100);
  await page.evaluate(() => {
    const e = PL.ent, f = [-Math.sin(PL.yaw), -Math.cos(PL.yaw)], b = entities.find((o) => !o.isPlayer && o.team !== e.team);
    b.alive = true; b.model.root.visible = true; b.health = 100; b.pos.set(e.pos.x + f[0] * 1.6, e.pos.y, e.pos.z + f[1] * 1.6);
  });
  await page.keyboard.down('KeyF'); await wait(page, 80); s = await st();
  ok(s.knifeT > 0 && !s.knew, 'enemy at 1.6 m: the original strike goes off on press', { knifeT: +s.knifeT.toFixed(2), knew: s.knew });
  await page.keyboard.up('KeyF'); await wait(page, 800); s = await st();
  ok(!s.out, 'enemy in range, brief press: the knife does not come out', { out: s.out });
  // held press on an enemy: the original strike goes off on press, the knife comes out mid-strike without the hand jumping (it rises once the strike is over)
  await place(); await wait(page, 100);
  await page.evaluate(() => {
    const e = PL.ent, f = [-Math.sin(PL.yaw), -Math.cos(PL.yaw)], b = entities.find((o) => !o.isPlayer && o.team !== e.team);
    b.alive = true; b.model.root.visible = true; b.health = 100; b.pos.set(e.pos.x + f[0] * 1.6, e.pos.y, e.pos.z + f[1] * 1.6);
  });
  await page.keyboard.down('KeyF'); await page.waitForFunction('PL.knifeOut', null, { timeout: 5000, polling: 10 }); s = await st();
  ok(s.out && s.knifeT > 0 && !s.knew && s.hold < 0.1, 'F held on an enemy: the knife comes out mid original strike, the hand does not jump', { knifeT: +s.knifeT.toFixed(2), knew: s.knew, hold: s.hold });
  await wait(page, 800); s = await st();
  ok(s.out && s.knifeT <= 0 && s.hold > 0.9, 'F held on an enemy: once the strike is over, the hand rises with the knife', { knifeT: s.knifeT, hold: s.hold });
  await page.keyboard.up('KeyF'); await wait(page, 100);
  await place(); await wait(page, 100);
  await page.evaluate(() => { const b = entities.find((o) => !o.isPlayer); b.alive = false; b.model.root.visible = false; });
  await page.keyboard.down('KeyF'); await wait(page, 600); await page.keyboard.up('KeyF'); await wait(page, 200); s = await st();
  ok(s.out, 'F held: the knife comes out, even after a strike', { out: s.out });

  // 6. grenade with the knife in hand: the knife stays in hand
  await page.keyboard.press('KeyG'); await wait(page, 300);
  s = await st();
  ok(s.out && s.hold < 0.3, 'grenade in progress: the knife stays in hand, but the grenade hand takes its place', { out: s.out, hold: s.hold });
  await wait(page, 1400); s = await st();
  ok(s.out && s.lowerT === 1 && s.hold > 0.9 && s.rig && s.nades === 1, 'grenade thrown: the knife is still in hand, the weapon lowered', { out: s.out, lowerT: s.lowerT, hold: s.hold, rig: s.rig, nades: s.nades });

  // 7. death and new class
  await page.evaluate(() => { killEnt(PL.ent, entities.find((o) => !o.isPlayer), 'M4A1', false, new V3(0, 0, 1)); });
  await wait(page, 200); s = await st();
  ok(!s.out && !s.rig, 'death: no more knife in hand', { out: s.out, rig: s.rig });
  await page.evaluate(() => { kcReset(); respawnPlayer(); }); await wait(page, 600);
  await place(); await wait(page, 100);
  await page.keyboard.down('KeyF'); await wait(page, 500); await page.keyboard.up('KeyF'); await wait(page, 100);
  await page.evaluate(() => { giveLoadout(); }); await wait(page, 600); s = await st();
  ok(!s.out && s.cur === 0, 'new class: the knife is stowed', { out: s.out, cur: s.cur });

  // 8. the hand stays in the view: at rest, over several stride cycles at full sprint, then during a strike made with the knife in hand, at two screen formats
  // (16:9 and a phone in landscape). updateViewmodel and updateRigs are run by hand, in the same evaluation (the frame loop does not get control in between).
  const F = await page.evaluate(() => {
    const out = {}, v = new V3(), VMOD = { ads: false, sprint: false, speed: 0, grounded: true, crouch: false, empty: false, lat: 0, fwd: 0, fire: false, wall: 0, slide: 0 };
    const proj = (obj, p) => { VM.root.updateMatrixWorld(true); obj.localToWorld(v.copy(p)); v.project(vmCamera); return [v.x, v.y]; };
    const aspect0 = vmCamera.aspect;
    for (const asp of [16 / 9, 2.05]) {
      vmCamera.aspect = asp; vmCamera.updateProjectionMatrix();
      const r = { hand: [[9, 9], [-9, -9]], tip: [[9, 9], [-9, -9]], blow: [[9, 9], [-9, -9]], hit: [[9, 9], [-9, -9]], orig: [[9, 9], [-9, -9]] };
      // the tip is only tracked at rest and while running: when winding up the strike, the blade (reverse grip) points toward the elbow, so toward the bottom of the screen
      const note = (swing, orig, kt) => {
        const h = proj(VM.knifeArm.hand, new V3(0, 0, 0)), t = proj(VM.knife, new V3(0, 0, -0.185));
        for (let i = 0; i < 2; i++) { const R = orig ? r.orig : swing ? r.blow : r.hand; R[0][i] = Math.min(R[0][i], h[i]); R[1][i] = Math.max(R[1][i], h[i]); if (swing && !orig && Math.abs(1 - kt / KNIFE_DUR - KNIFE_HIT) < 0.05) { r.hit[0][i] = Math.min(r.hit[0][i], h[i]); r.hit[1][i] = Math.max(r.hit[1][i], h[i]); } if (!swing) { r.tip[0][i] = Math.min(r.tip[0][i], t[i]); r.tip[1][i] = Math.max(r.tip[1][i], t[i]); } }
      };
      const step = (sprint, knifeT, orig) => {
        const sp = sprint ? 7.84 : 0; updateViewmodel(1 / 60, Object.assign({}, VMOD, { sprint, speed: sp, fwd: sp }));
        updateRigs(1 / 60, { knifeT: knifeT || 0, knifeNew: !orig, nadeState: null, nadeT: 0, cookT: 0, knifeHold: orig ? 0 : 1, sprint: VM.sprint, speed: sp }); note(!!knifeT, !!orig, knifeT);
      };
      VM.sprint = 0; VM.sprV = 0; VM.bobAmt = 0; VM.bobT = 0; VM.lower = 1; VM.lowerTarget = 1;
      for (let i = 0; i < 60; i++) step(false);
      for (let i = 0; i < 150; i++) step(true);
      for (let i = 0; i < 40; i++) step(false);
      for (let i = 0; i < 26; i++) step(false, Math.max(0.0001, KNIFE_DUR * (1 - i / 25)));
      for (let i = 0; i < 26; i++) step(false, Math.max(0.0001, KNIFE_DUR * (1 - i / 25)), true);
      out[asp.toFixed(2)] = r;
    }
    vmCamera.aspect = aspect0; vmCamera.updateProjectionMatrix();
    return out;
  });
  for (const [asp, r] of Object.entries(F)) {
    const hand = r.hand, tip = r.tip, inView = hand[0][0] > -0.9 && hand[1][0] < 0.9 && hand[0][1] > -0.95 && hand[1][1] < 0 && r.hit[0][0] > -0.95 && r.hit[1][0] < 0.95 && r.hit[0][1] > -1.1 && r.hit[1][1] < 0.1 && tip[0][0] > -1 && tip[1][0] < 1 && tip[0][1] > -1 && tip[1][1] < 1;
    ok(r.orig[0][1] < -1.5 && r.orig[1][1] > -0.6 && r.orig[1][1] < 0, `original strike at ${asp}:1: the hand comes from below and rises into the view`, { origY: r.orig.map((p) => +p[1].toFixed(2)) });
    ok(inView, `knife in hand at ${asp}:1: the hand stays in the view (rest, run, strike contact; the sweep takes it out of frame at the end of the strike) and the tip at rest and while running`, { mainX: hand.map((p) => +p[0].toFixed(2)), mainY: hand.map((p) => +p[1].toFixed(2)), pointeY: tip.map((p) => +p[1].toFixed(2)), coupX: r.blow.map((p) => +p[0].toFixed(2)), coupY: r.blow.map((p) => +p[1].toFixed(2)), contactX: r.hit.map((p) => +p[0].toFixed(2)), contactY: r.hit.map((p) => +p[1].toFixed(2)), origX: r.orig.map((p) => +p[0].toFixed(2)), origY: r.orig.map((p) => +p[1].toFixed(2)) });
  }

  const errs = logs.filter((l) => !l.includes('ERR_FILE_NOT_FOUND') && !l.includes('ERR_FAILED'));
  ok(errs.length === 0, `clean console${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
  await browser.close();
  console.log(fails.length ? `${fails.length} failure(s)` : 'all good');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
