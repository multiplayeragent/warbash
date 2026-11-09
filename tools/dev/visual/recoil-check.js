/* Check of aim recoil (src/07ca-recoil.js): node recoil-check.js [page=dist/index.html] ; WEAPON_LIST=m4,ak47 to limit their number.
   One table per weapon of the aim climb (in degrees) without the player pulling it back down, hip-fired: after 1, 5, 10 shots and a magazine, with the
   ratio to the old recoil; then what changes it (shoulder, crouched, running, gamepad, finger); then the aim's return when releasing, with and
   without manual compensation. Checks:
   - automatic weapons recoil more than before (at least x1.25 after ten shots) without overdoing it (at most x2.2);
   - shoulder and crouch soften it, running and jumping worsen it, gamepad and finger reduce it;
   - the aim returns the intended share when released, and never below the starting point when the player already compensated the recoil by hand;
   - bots keep exactly the old recoil;
   - a real player shot (ctlShoot) raises the aim and the return lowers it again;
   - a real ten-shot burst with the M4 in the frame loop (player aim and view shake included, 3D rendering off), hip-fired then
     from the shoulder: aim climb after the first shot, five shots, ten shots, and what remains once the trigger is released; for reference, before
     07ca-recoil.js: 8.2° after ten hip-fired shots (6.9° remaining) and 6.1° from the shoulder (4.8° remaining). */
const { openGame } = require('./common');
const fails = [];
const ok = (c, msg, extra) => { console.log((c ? 'ok    ' : 'FAIL  ') + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails.push(msg); };
(async () => {
  const only = process.env.WEAPON_LIST ? process.env.WEAPON_LIST.split(',') : null;
  const { browser, page, logs } = await openGame({ page: process.argv[2], w: 640, h: 360, settings: { quality: 'low', map: 'chergui' }, noHdri: true });
  const R = await page.evaluate((only) => {
    LOCK.fallback = true; startMatch({}); composer.render = () => {}; // (3D rendering off: the frame loop runs fast in software rendering)
    const rnd = Math.random; Math.random = () => 0.5; // a fixed draw: rand(0.9 ; 1.1) = 1 and no random drift
    const deg = (r) => r * 180 / Math.PI;
    // the old recoil, as it was (ctlShoot before 07ca-recoil.js): cumulative kv after n shots, hip-fired, standing
    const old = (d, n) => { let t = 0; for (let i = 0; i < n; i++) { let kv = d.recoil.v; if (d.pattern === 'climb') kv *= 1 + Math.min(i, 10) * 0.035; else if (d.pattern === 'smg') kv *= 0.92; t += kv; } return deg(t); };
    const cum = (d, n, ads, spd, crouch, air) => { const ent = { crouch, onGround: !air }; let t = 0; for (let i = 0; i < n; i++) t += recoilShot(ent, d, i, ads, spd).kv; return deg(t); };
    const rows = [];
    for (const w of Object.values(WEAPONS)) {
      if (only && !only.includes(w.id)) continue;
      const mag = w.auto ? w.mag : 1;
      rows.push({ id: w.id, cat: w.cat, auto: !!w.auto, rpm: w.rpm, mag: w.mag, n1: cum(w, 1, 0, 0, false, false), n5: cum(w, 5, 0, 0, false, false), n10: cum(w, 10, 0, 0, false, false), nm: cum(w, mag, 0, 0, false, false),
        o1: old(w, 1), o5: old(w, 5), o10: old(w, 10), om: old(w, mag), ads: cum(w, 10, 1, 0, false, false), crouch: cum(w, 10, 0, 0, true, false), run: cum(w, 10, 0, 5, false, false), air: cum(w, 10, 0, 0, false, true) });
    }
    // gamepad and touch
    const m4 = WEAPONS.m4, kb = cum(m4, 10, 0, 0, false, false);
    PAD.drive = true; const pad = cum(m4, 10, 0, 0, false, false); PAD.drive = false;
    const touchWas = TOUCH.on; TOUCH.on = true; const touch = cum(m4, 10, 0, 0, false, false); TOUCH.on = touchWas;
    // aim return: a 10-shot burst with the M4, then 1.5 s without firing
    const A = PL.ent.arms; const sim = (compensate) => {
      PL.pitch = 0.2; A.recPend = 0; A.recArm = false; let now = 100; const start = PL.pitch;
      for (let i = 0; i < 10; i++) { const k = recoilShot(PL.ent, m4, i, 0, 0).kv; PL.pitch += k; A.recPend += k; A.lastShotAt = now; now += 60 / m4.rpm; }
      const peak = PL.pitch - start;
      let minP = PL.pitch;
      if (compensate) { const take = -peak * compensate; PL.pitch += take; recoilTick(1 / 60, now, take); minP = Math.min(minP, PL.pitch); }
      for (let t = 0; t < 1.5; t += 1 / 60) { now += 1 / 60; recoilTick(1 / 60, now, 0); minP = Math.min(minP, PL.pitch); }
      return { peak: deg(peak), left: deg(PL.pitch - start), min: deg(minP - start) };
    };
    const back = sim(0), comp = sim(1);
    // a shot that restarts right away during the return: the delay suspends it
    PL.pitch = 0; A.recPend = 0; A.recArm = false; let t0 = 200; A.lastShotAt = t0; A.recPend = 0.05; PL.pitch = 0.05;
    recoilTick(1 / 60, t0 + 0.05, 0); const held = PL.pitch;
    // bots: old recoil, fixed draw
    const bot = entities.find((e) => !e.isPlayer && e.alive); const bd = armsW(bot).def; bot.arms.fireCd = 0; bot.arms.adsW = 0; bot.crouch = false; bot.arms.lastShotAt = -9; bot.arms.burstN = 0;
    const p0 = bot.pitch; bot.onGround = true; ctlShoot(bot, 300); const botKv = bot.pitch - p0;
    const expect = bd.recoil.v * 1 * (bot.crouch ? 0.85 : 1) * (bd.pattern === 'smg' ? 0.92 : 1);
    // a real player shot
    const P = PL.ent, pa = P.arms; Object.assign(pa, { fireCd: 0, boltT: 0, switching: 0, sprintW: 0, reload: null }); armsW(P).mag = 30; P.sprinting = false; P.busy = false; pa.lastShotAt = -9; pa.burstN = 0; pa.recPend = 0; pa.recArm = false;
    const pw = armsW(P).def; PL.pitch = 0; P.pitch = 0; P.onGround = true; P.crouch = false; pa.adsW = 0;
    ctlShoot(P, 400); const shot = { pitch: deg(P.pitch), pend: deg(pa.recPend), id: pw.id };
    pa.lastShotAt = 400; let now2 = 400.1; for (let i = 0; i < 90; i++) { now2 += 1 / 60; recoilTick(1 / 60, now2, 0); }
    P.pitch = PL.pitch; const after = deg(PL.pitch);
    Math.random = rnd;
    return { rows, kb, pad, touch, back, comp, held, botKv, expect, shot, after, back70: RECOIL.cat[m4.cat].back };
  }, only);
  const f1 = (v) => v.toFixed(1).padStart(5);
  console.log('weapon     rpm  1 shot  5 shots  10 shots  magazine  (old)             shoulder  crouch  run  airborne');
  for (const r of R.rows) console.log(`${r.id.padEnd(9)} ${String(r.rpm).padStart(5)}  ${r.n1.toFixed(2).padStart(5)}  ${f1(r.n5)}   ${f1(r.n10)}     ${r.auto ? f1(r.nm) : '    -'}      (${r.o1.toFixed(2)} ${f1(r.o5)} ${f1(r.o10)} ${r.auto ? f1(r.om) : '    -'})  ${f1(r.ads)}   ${f1(r.crouch)}    ${f1(r.run)}   ${f1(r.air)}`);
  console.log(`(degrees after 10 shots with the M4: keyboard ${R.kb.toFixed(1)}, gamepad ${R.pad.toFixed(1)}, touch ${R.touch.toFixed(1)})`);
  for (const r of R.rows.filter((x) => x.auto && x.cat !== 'shotgun')) {
    const k = r.n10 / r.o10;
    ok(k >= 1.25 && k <= 2.2, `${r.id}: recoil after ten shots x${k.toFixed(2)} the old one (1.25 to 2.2)`);
    ok(r.ads < r.n10 && r.crouch < r.n10 && r.run > r.n10 && r.air > r.run, `${r.id}: shoulder and crouch soften, running and jumping worsen`);
  }
  ok(R.pad < R.kb && R.touch < R.pad, 'gamepad and finger: reduced recoil', [+R.kb.toFixed(1), +R.pad.toFixed(1), +R.touch.toFixed(1)]);
  ok(Math.abs(R.back.left - R.back.peak * (1 - R.back70)) < R.back.peak * 0.03, `aim return: the intended share remains (${Math.round((1 - R.back70) * 100)} %)`, [+R.back.peak.toFixed(2), +R.back.left.toFixed(2)]);
  ok(R.comp.min > -0.02, 'recoil already compensated by hand: the aim does not go below its starting point', R.comp);
  ok(Math.abs(R.held - 0.05) < 1e-9, 'the return waits for the delay after the last shot', R.held);
  ok(Math.abs(R.botKv - R.expect) < 1e-9, 'bots keep exactly the old recoil', [R.botKv, R.expect]);
  ok(R.shot.pitch > 0.3 && R.shot.pend > 0.3 && R.after < R.shot.pitch * 0.5, 'a real shot (' + R.shot.id + ') raises the aim, the return lowers it again', [+R.shot.pitch.toFixed(2), +R.after.toFixed(2)]);
  // real burst: ten shots with the M4 in the frame loop, trigger released at the tenth, the aim followed frame by frame up to 2.4 s
  await page.evaluate(() => { for (const e of entities) if (!e.isPlayer) { e.pos.set(0, 0, -200); e.alive = false; } PL.ent.health = 1e9; });
  await page.waitForFunction('typeof frameN !== "undefined" && frameN > 40', null, { timeout: 300000, polling: 500 });
  const spray = async (ads) => page.evaluate(async (ads) => {
    PL.adsWant = ads; PL.pitch = 0; PL.ent.pitch = 0; PL.punchP = 0; PL.vpP = 0; Object.assign(PL.ent.arms, { recPend: 0, recArm: false, lastShotAt: -9, burstN: 0, fireCd: 0 }); armsW(PL.ent).mag = 30; // (the earlier steps fired at made-up dates)
    await new Promise((res) => setTimeout(res, 700));
    const out = [], base = PL.pitch, t0 = performance.now(), s0 = PL.shots; let released = false; PL.held = true; PL.queued = true;
    await new Promise((res) => { const step = () => {
      const t = (performance.now() - t0) / 1000;
      out.push([PL.shots - s0, (PL.pitch - base + PL.punchP) * 180 / Math.PI, (PL.pitch - base) * 180 / Math.PI]);
      if (!released && PL.shots - s0 >= 10) { released = true; PL.held = false; PL.queued = false; }
      if (t < 2.4) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
    PL.adsWant = false;
    const at = (n) => (out.find((x) => x[0] >= n) || [0, 0])[1];
    const A2 = PL.ent.arms; const st = ({ mag: armsW(PL.ent).mag, id: armsW(PL.ent).def.id, reload: !!A2.reload, bolt: A2.boltT, sw: A2.switching, spr: A2.sprintW, fireCd: A2.fireCd, last: A2.lastShotAt, now: MATCH.time, busy: PL.ent.busy, sprinting: PL.ent.sprinting, hold: playHold(), held: PL.held, ads: A2.adsW, state: MATCH.state });
    return { st, shots: out[out.length - 1][0], c1: at(1), c5: at(5), c10: at(10), crest: Math.max(...out.map((x) => x[1])), rest: out[out.length - 1][2] };
  }, ads);
  const hip = await spray(false), ads = await spray(true);
  if (hip.shots !== 10) console.log('state:', JSON.stringify(hip.st));
  console.log(`real ten-shot burst with the M4 (degrees): hip ${hip.c1.toFixed(2)} / ${hip.c5.toFixed(1)} / ${hip.c10.toFixed(1)}, rest ${hip.rest.toFixed(1)} ; shoulder ${ads.c1.toFixed(2)} / ${ads.c5.toFixed(1)} / ${ads.c10.toFixed(1)}, rest ${ads.rest.toFixed(1)}`);
  ok(hip.shots === 10 && ads.shots === 10, 'ten shots fired hip and from the shoulder', [hip.shots, ads.shots]);
  ok(hip.c10 > 9 && hip.c10 < 17 && ads.c10 > 6 && ads.c10 < hip.c10, 'real burst: the aim climbs markedly, less from the shoulder', [+hip.c10.toFixed(1), +ads.c10.toFixed(1)]);
  ok(hip.rest < hip.crest * 0.45 && ads.rest < ads.crest * 0.45, 'real burst: the aim comes back down once the trigger is released', [+hip.rest.toFixed(1), +ads.rest.toFixed(1)]);
  const errs = logs.filter((l) => /pageerror/.test(l) || (/^\[error\]/.test(l) && !/ERR_/.test(l)));
  ok(!errs.length, 'no error in the page', errs.slice(0, 3));
  console.log(fails.length ? `${fails.length} failure(s)` : 'all good');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
