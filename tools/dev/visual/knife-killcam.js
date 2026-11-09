/* The killcam replays the killer's knife strikes (src/09b-killcam.js: knife and melee events, share of the knife drawn in the buffer): node knife-killcam.js [page] ; PAGE=other.html.
   The game really runs (frame loop, 3D rendering off, bots frozen). Three replays, the player being the killer:
   - a simple press strike (knife not in hand) that kills: the knife and the arm are on screen during the strike, it is the original strike, the weapon lowers then comes back up, the hand passes through the view,
     and nothing is left in hand at the end;
   - a strike made with the knife in hand: the knife is already in hand and the weapon already lowered from the first frame, it is the tuned strike;
   - a replay without a knife strike: the knife never appears.
   Exits with an error at the first failure. */
const { openGame } = require('./common');
const fails = [];
const ok = (c, msg, extra) => { console.log((c ? 'ok    ' : 'FAIL ') + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails.push(msg); };
const wait = (page, ms) => page.waitForTimeout(ms);
(async () => {
  const { browser, page, logs } = await openGame({ page: process.argv[2] || process.env.PAGE, w: 640, h: 360, settings: { quality: 'low', map: 'chergui' }, noHdri: true });
  await page.evaluate(() => {
    LOCK.fallback = true; startMatch({}); composer.render = () => {}; // 3D rendering off: the frame loop runs fast with software rendering
    window.botsTick = () => {};
    window.entChest = (e, out) => out.set(e.pos.x, e.pos.y + 1.3, e.pos.z);
  });
  await page.waitForFunction('typeof frameN !== "undefined" && frameN > 40', null, { timeout: 300000, polling: 500 });
  const spot = await page.evaluate(() => {
    for (let x = -30; x <= 30; x += 3) for (let z = -30; z <= 30; z += 3) for (let a = 0; a < 8; a++) {
      const yaw = a * Math.PI / 4, dx = -Math.sin(yaw), dz = -Math.cos(yaw), g = groundHeight(x, z, 5, 0.3);
      if (Math.abs(g) > 0.3) continue;
      let free = true;
      for (let d = 0; d <= 6 && free; d++) { const q = new V3(x + dx * d, g, z + dz * d), x0 = q.x, z0 = q.z; collideCircle(q, 0.36, 1.75); free = Math.hypot(q.x - x0, q.z - z0) < 0.01 && Math.abs(groundHeight(x0, z0, 5, 0.3) - g) < 0.3; }
      if (free) return { x, z, yaw };
    }
    return null;
  });
  ok(!!spot, 'a clear 6 m patch of ground', spot);
  if (!spot) { await browser.close(); process.exit(1); }
  // the player in place, an enemy 1.6 m in front of them (none if enemy is false), knife drawn or not
  const setup = (enemy, knifeOut) => page.evaluate(({ s, enemy, knifeOut }) => {
    const e = PL.ent; e.alive = true; e.health = 100; e.pos.set(s.x, groundHeight(s.x, s.z, 5, 0.3), s.z); e.vel.set(0, 0, 0); e.vy = 0; e.onGround = true;
    PL.yaw = s.yaw; PL.pitch = 0; PL.protT = 99; e.protT = 99; PL.knifeT = 0; PL.knifeBtn = null; PL.nadeState = null; PL.reload = null; PL.knifeOut = false; PL.knifeHold = 0;
    VM.lowerTarget = 0; VM.lower = 0;
    for (const o of entities) if (!o.isPlayer) { o.alive = false; o.model.root.visible = false; }
    if (enemy) {
      const f = [-Math.sin(PL.yaw), -Math.cos(PL.yaw)], b = entities.find((o) => !o.isPlayer && o.team !== e.team);
      b.alive = true; b.model.root.visible = true; b.health = 100; b.pos.set(e.pos.x + f[0] * 1.6, e.pos.y, e.pos.z + f[1] * 1.6);
    }
    if (knifeOut) { knifeDraw(); VM.lowerTarget = 1; }
  }, { s: spot, enemy, knifeOut });
  const rec = () => page.evaluate(() => { kcReset(); }); // the killcam recording restarts from zero
  // replay: every other frame of the killer's view state, until the end
  const replay = () => page.evaluate(() => new Promise((resolve) => {
    const v = new V3(), out = [], victim = entities.find((o) => !o.isPlayer && o.team !== PL.ent.team);
    if (!startKillcam({ killer: PL.ent, victim, tEnd: window.__tEnd, final: false, info: '' })) { resolve(null); return; }
    const step = () => {
      if (!KC.active || out.length > 900) { resolve({ frames: out, after: { vis: VM.knifeRig.visible, state: MATCH.state } }); return; }
      VM.root.updateMatrixWorld(true); VM.knifeArm.hand.localToWorld(v.set(0, 0, 0)); v.project(vmCamera);
      out.push({ t: +KC.t.toFixed(3), vis: VM.knifeRig.visible, kt: +(KC.knifeT || 0).toFixed(3), neu: !!KC.knifeNew, low: +VM.lower.toFixed(2), up: !!KC.knifeUp, x: +v.x.toFixed(2), y: +v.y.toFixed(2) });
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }));
  // a strike actually made, then time to fill the buffer after the strike
  const stab = async () => {
    await page.evaluate(() => { knife(); });
    await page.waitForFunction('PL.knifeHit', null, { timeout: 20000, polling: 10 });
    await page.evaluate(() => { window.__tEnd = MATCH.time; });
    await wait(page, 700);
  };

  // 1. simple press, knife not in hand: the original strike
  await setup(true, false); await wait(page, 300); await rec(); await wait(page, 700);
  await stab();
  const killed = await page.evaluate(() => !entities.find((o) => !o.isPlayer && o.team !== PL.ent.team).alive);
  ok(killed, 'the knife strike kills the enemy at 1.6 m', { killed });
  let R = await replay();
  ok(!!R && R.frames.length > 5, 'the killcam starts and lasts', { frames: R && R.frames.length });
  if (R) {
    const F = R.frames, stabF = F.filter((f) => f.kt > 0);
    ok(stabF.length > 2 && stabF.every((f) => f.vis), 'simple press strike replayed: the knife and the arm are on screen during the strike', { images: stabF.length });
    ok(stabF.length > 2 && stabF.every((f) => !f.neu), 'simple press strike replayed: it is the original strike', { neu: stabF.map((f) => f.neu).slice(0, 3) });
    ok(F.some((f) => f.kt > 0 && f.low > 0.5), 'strike replayed: the weapon lowers during the strike', { low: Math.max(...F.map((f) => f.low)) });
    const mid = stabF.filter((f) => f.kt < 0.32 && f.kt > 0.22);
    ok(mid.length > 0 && mid.every((f) => Math.abs(f.x) < 1.2 && f.y > -1.2 && f.y < 1), 'strike replayed: the hand passes through the view at contact', mid.map((f) => [f.x, f.y]).slice(0, 3));
    const first = F.find((g) => g.kt > 0), before = first ? F.filter((f) => f.t < first.t - 0.05) : [];
    ok(before.length > 0 && before.every((f) => !f.vis && f.low < 0.05), 'before the strike: no knife and no lowered weapon', { n: before.length });
    ok(!R.after.vis, 'end of the replay: no more knife in view', R.after);
  }
  await wait(page, 300);

  // 2. strike made with the knife in hand: the knife and the lowered weapon from the first frame, the tuned strike
  await setup(true, true); await wait(page, 1200); await rec(); await wait(page, 700);
  await stab();
  R = await replay();
  ok(!!R && R.frames.length > 5, 'the killcam starts (knife in hand)', { frames: R && R.frames.length });
  if (R) {
    const F = R.frames, stabF = F.filter((f) => f.kt > 0);
    ok(F[0].vis && F[0].low > 0.95 && F[0].up, 'knife in hand: it is there from the first frame, the weapon already lowered', F[0]);
    ok(stabF.length > 2 && stabF.every((f) => f.neu), 'knife in hand: it is the tuned strike', { neu: stabF.map((f) => f.neu).slice(0, 3) });
    ok(F.every((f) => f.vis), 'knife in hand: it stays on screen before, during and after the strike', { hidden: F.filter((f) => !f.vis).length });
    ok(!R.after.vis, 'end of the replay: no more knife in view', R.after);
  }
  await wait(page, 300);

  // 3. a replay without a knife strike: no sign of the knife
  await setup(false, false); await wait(page, 300); await rec(); await wait(page, 1000);
  await page.evaluate(() => { window.__tEnd = MATCH.time - 0.2; });
  R = await replay();
  ok(!!R && R.frames.length > 3, 'the killcam starts (no knife)', { frames: R && R.frames.length });
  if (R) ok(R.frames.every((f) => !f.vis && f.kt === 0 && f.low < 0.05), 'no knife strike: the knife never appears, the weapon stays in hand', { knifeBench: R.frames.filter((f) => f.vis).length });

  const errs = logs.filter((l) => !l.includes('ERR_FILE_NOT_FOUND') && !l.includes('ERR_FAILED'));
  ok(errs.length === 0, 'clean console', errs.slice(0, 3));
  await browser.close();
  if (fails.length) { console.log(fails.length + ' failure(s)'); process.exit(1); }
  console.log('all good');
})().catch((e) => { console.error(e); process.exit(1); });
