/* Ragdoll bench: kills a soldier with a given force (weapon, body part hit, direction) and follows the body frame by
   frame. Three series:
   - flat ground: the effect of each weapon (distance travelled, peak speed, sleep, stretched bones);
   - map geometry: against a wall, on a crate, on a ramp, in free fall, explosion against a wall;
   - random draw: hundreds of deaths (weapon, angle, speed, place) to hunt what bugs out: body that does not
     fall asleep, that slides after resting, that goes through a wall, aberrant values (NaN), stretched bones.
   node ragdoll.js [page=dist/index.html] ; MAP=saintgivre for the other map ; N=300: number of draws ;
   DETAIL=1: second-by-second trace of the flat series ; TRACE=name T=t0,t1: frame-by-frame trace of a case ;
   RAGSET='{"iters":4}': RAG settings tried without rebuilding ; SEED=n: random seed (replays the same cases) ; REP=20: repeats the flat series 20 times (different seeds). Exit code 1 if a defect is found. */
const { openGame } = require('./common');
const TRACE = process.env.TRACE || '', [TR0, TR1] = (process.env.T || '0,12').split(',').map(Number);
(async () => {
  const { browser, page, logs } = await openGame({ page: process.argv[2], w: 480, h: 270, settings: { quality: 'low', difficulty: 1, map: process.env.MAP || 'chergui' }, noHdri: true });
  const out = await page.evaluate(([detail, N, TR, TR0, TR1, SET, SEED, REP, ANOM]) => {
    let sd = +SEED; Math.random = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296); // fixed seed: cases replay identically
    LOCK.fallback = true; startMatch({});
    MATCH.state = 'playing';
    if (SET) Object.assign(RAG, JSON.parse(SET));
    const bot = entities.find((e) => !e.isPlayer), dt = 1 / 60;
    // ---- one death, followed for `secs` seconds ----
    const run = (s) => {
      const FLAT = [400, 400];
      const at = s.at || FLAT;
      bot.pos.set(at[0], s.y || 0, at[1]); bot.yaw = s.yaw || 0; bot.alive = true; bot.model.rag = null; bot.model.sink = 0; bot.respawnT = 1e9; bot.onGround = !(s.y > 0.1 && !s.stand);
      const vel = s.vel || 0, yaw = bot.yaw;
      bot.vel.set(-Math.sin(yaw) * vel, 0, -Math.cos(yaw) * vel); bot.sprinting = vel > 4;
      for (let i = 0; i < 40; i++) { bot.pos.x += bot.vel.x * dt; bot.pos.z += bot.vel.z * dt; if (s.at) collideCircle(bot.pos, 0.34, 1.75); animSoldier(bot, dt); }
      bot.model.gun.visible = !!s.gun; // a killed bot drops its weapon (dropKilledWeapon): it does not follow the body; the player's killcam keeps it
      bot.lastForce = { dir: new V3(...s.dir).normalize(), mag: s.mag, lift: s.lift, part: s.part || 'body', radial: !!s.radial };
      bot.alive = false;
      const p0 = bot.model.J[J_PEL].clone(); let last = p0.clone(), path = 0, vmax = 0, sleepT = -1, maxStretch = 0, stretchAt = '', maxPen = 0, atRest = null, drift = 0, nan = false, minY = 9;
      const trace = [], n = Math.round((s.secs || 12) * 60), R0 = () => bot.model.rag, hist = []; let anom = null, anomLeft = 0, penInfo = null;
      for (let i = 0; i < n; i++) {
        animSoldier(bot, dt); const t = (i + 1) * dt, J = bot.model.J, pel = J[J_PEL], R = R0();
        if (!isFinite(pel.x + pel.y + pel.z)) { nan = true; break; }
        const step = Math.hypot(pel.x - last.x, pel.z - last.z); path += step; vmax = Math.max(vmax, step / dt); last.copy(pel);
        for (let k = 0; k < 15; k++) {
          minY = Math.min(minY, J[k].y);
          // penetration into (solid) boxes: depth to the nearest face, beyond the tolerance
          for (const c of queryBoxes(J[k].x - 1, J[k].z - 1, J[k].x + 1, J[k].z + 1)) {
            if (c.ray) continue; const r = RAG_RAD[k];
            const d = Math.min(J[k].x - (c.x0 - r), c.x1 + r - J[k].x, J[k].y - (c.y0 - r), c.y1 + r - J[k].y, J[k].z - (c.z0 - r), c.z1 + r - J[k].z);
            if (d > 0 && d > maxPen) { maxPen = d; penInfo = { t: +t.toFixed(3), k, box: [c.x0, c.x1, c.y0, c.y1, c.z0, c.z1].map((x) => +x.toFixed(2)).join(','), p: [J[k].x, J[k].y, J[k].z].map((x) => +x.toFixed(3)).join(',') }; }
          }
        }
        if (R) for (let k = 0; k < RAG_RIGID.length; k++) { const [a, b] = RAG_RIGID[k], st = Math.abs(J[a].distanceTo(J[b]) - R.rest[k]); if (st > maxStretch) { maxStretch = st; stretchAt = `${a}-${b}@${t.toFixed(2)}`; } }
        if (R && !anom && ANOM && !(i === 6 * 60)) {
          const snap = { t: +t.toFixed(3), step: +(step / dt).toFixed(1), p: R.p.slice(0, 15).map((v) => [v.x, v.y, v.z].map((x) => +x.toFixed(3)).join(',')), v: R.v.slice(0, 15).map((v) => +v.length().toFixed(1)).join(' '), hit: Array.from(R.hit).join('') };
          hist.push(snap); if (hist.length > 8) hist.shift();
          if (t > 0.6 && Math.max(...R.v.slice(0, 15).map((v) => v.length())) > 5.5 && s.name !== "explosion") { anom = hist.slice(); anomLeft = 1; }
        } else if (anom && anomLeft-- > 0 && R) anom.push({ t: +t.toFixed(3), step: +(step / dt).toFixed(1), p: R.p.slice(0, 15).map((v) => [v.x, v.y, v.z].map((x) => +x.toFixed(3)).join(',')), v: R.v.slice(0, 15).map((v) => +v.length().toFixed(1)).join(' '), hit: Array.from(R.hit).join('') });
        if (R && i === 6 * 60 && !R.sleep) anom = [{ t: +t.toFixed(3), nosleep: 1, v: R.v.map((v) => +v.length().toFixed(2)).join(' '), hit: Array.from(R.hit).join(''), still: R.still, p: R.p.map((v) => [v.x, v.y, v.z].map((x) => +x.toFixed(3)).join(',')) }];
        if (R && R.sleep && sleepT < 0) { sleepT = t; atRest = pel.clone(); }
        if (TR && s.name.includes(TR) && i > TR0 * 60 && i < TR1 * 60 && R) trace.push([+t.toFixed(3), ...J.map((j) => [+j.x.toFixed(2), +j.y.toFixed(2), +j.z.toFixed(2)].join(',')).filter((_, q) => q < 3), 'v', R.v.slice(0, 15).map((v) => +v.length().toFixed(2)).join(' '), 'gun', R.n > 15 ? [R.p[15], R.p[16], R.v[15], R.v[16]].map((v) => [v.x, v.y, v.z].map((x) => +x.toFixed(3)).join(',')).join(' ') : '', 'hit', Array.from(R.hit).join(''), 'still', +R.still.toFixed(2), 'sleep', R.sleep]);
        if (detail && (i + 1) % 30 === 0) trace.push([+t.toFixed(1), +(pel.x - p0.x).toFixed(2), +pel.y.toFixed(2), +(pel.z - p0.z).toFixed(2), +(step / dt).toFixed(2)]);
      }
      const pe = bot.model.J[J_PEL];
      if (atRest) drift = Math.hypot(pe.x - atRest.x, pe.z - atRest.z) + Math.abs(pe.y - atRest.y);
      return { name: s.name, travel: +Math.hypot(pe.x - p0.x, pe.z - p0.z).toFixed(2), pathway: +path.toFixed(2), vmax: +vmax.toFixed(1), sleepTime: +sleepT.toFixed(2), derive: +drift.toFixed(4), sunk: +maxPen.toFixed(3), lowY: +minY.toFixed(2), stretched: +maxStretch.toFixed(3), stretchedAt: stretchAt, spec: s.dump ? JSON.stringify({ at: s.at, yaw: s.yaw, dir: s.dir, mag: s.mag, lift: s.lift, part: s.part, radial: s.radial, vel: s.vel }) : undefined, nan, outroY: +pe.y.toFixed(2), trace, anom, penInfo };
    };
    const W = (name, o) => Object.assign({ name, dir: [0, 0, 1], mag: 5.4, lift: 3, secs: 12 }, o);
    const flat = [
      W('rifle front', {}), W('rifle back', { dir: [0, 0, -1] }), W('rifle side', { dir: [1, 0, 0] }), W('rifle head', { part: 'head', mag: 6.2 }), W('rifle legs', { part: 'legs' }),
      W('submachine-gun', { mag: 3, lift: 1.2 }), W('shotgun', { mag: 8.2, lift: 4.4 }), W('sniper', { mag: 7.4, lift: 4.2 }), W('knife', { mag: 6, lift: 1.4 }),
      W('with weapon (killcam) rifle', { gun: 1 }), W('with weapon (killcam) shotgun', { gun: 1, mag: 8.2, lift: 4.4 }), W('with weapon (killcam) running back', { gun: 1, dir: [0, 0, -1], vel: 5.5 }),
      W('explosion', { mag: 14, lift: 12, radial: true }), W('close explosion', { mag: 17, lift: 16, radial: true }), W('running front', { vel: 5.5 }), W('running back', { dir: [0, 0, -1], vel: 5.5 }), W('no force', { mag: 2.5, lift: 0.6 }),
    ].map((sp) => {
      const rs = []; for (let k = 0; k < REP; k++) { sd = (+SEED + 101 * k) >>> 0; rs.push(run(sp)); }
      const worst = (f) => rs.reduce((a, b) => (f(b) > f(a) ? b : a));
      const w = worst((r) => r.vmax / 10 + r.stretched + Math.max(0, r.sleepTime - 3)), m = rs.reduce((t, r) => t + r.travel, 0) / rs.length;
      return Object.assign({}, w, { travel: +m.toFixed(2), reps: rs.length, vmaxMax: Math.max(...rs.map((r) => r.vmax)), sleepTimeMax: Math.max(...rs.map((r) => r.sleepTime)), stretchedMax: Math.max(...rs.map((r) => r.stretched)) });
    });
    // ---- map geometry ----
    const geo = [];
    const boxes = COL.filter((c) => !c.ray);
    // wall: a tall, long vertical face, clear in front; the soldier stands 0.7 m away, turned toward the open, pushed toward the wall
    const faceCand = [];
    for (const c of boxes) {
      if (c.y1 < 2.5 || c.y0 > 0.1 || c.x1 - c.x0 < 3) continue;
      for (const sgn of [-1, 1]) {
        const z = sgn < 0 ? c.z0 - 0.7 : c.z1 + 0.7, x = (c.x0 + c.x1) / 2; let ok = true;
        for (const o of queryBoxes(x - 1.2, z - 1.2, x + 1.2, z + 1.2)) if (!o.ray && o !== c && o.y1 > 0.1) ok = false;
        if (ok) faceCand.push([x, z, sgn]);
      }
    }
    for (const [x, z, sgn] of faceCand.slice(0, 3)) {
      geo.push(run(W(`toward a wall (rifle) ${x.toFixed(0)},${z.toFixed(0)}`, { at: [x, z], dir: [0, 0, -sgn] })));
      geo.push(run(W(`toward a wall (shotgun) ${x.toFixed(0)},${z.toFixed(0)}`, { at: [x, z], dir: [0, 0, -sgn], mag: 8.2, lift: 4.4 })));
      geo.push(run(W(`explosion against a wall ${x.toFixed(0)},${z.toFixed(0)}`, { at: [x, z], dir: [0, 0, -sgn], mag: 17, lift: 16, radial: true })));
      geo.push(run(W(`running into a wall ${x.toFixed(0)},${z.toFixed(0)}`, { at: [x, z + sgn * 4], dir: [0, 0, -sgn], vel: 6, yaw: sgn < 0 ? Math.PI : 0 })));
    }
    // crate top: a large low platform (0.3 to 1.6 m), the soldier standing in the middle
    const tops = boxes.filter((c) => c.y1 > 0.3 && c.y1 < 1.6 && c.x1 - c.x0 > 2 && c.z1 - c.z0 > 2).slice(0, 3);
    for (const c of tops) {
      const x = (c.x0 + c.x1) / 2, z = (c.z0 + c.z1) / 2, tag = `${x.toFixed(0)},${z.toFixed(0)} h${c.y1.toFixed(1)}`;
      geo.push(run(W(`on a platform, no force ${tag}`, { at: [x, z], y: c.y1, stand: 1, mag: 2.5, lift: 0.6 })));
      geo.push(run(W(`on a platform, rifle ${tag}`, { at: [x, z], y: c.y1, stand: 1 })));
    }
    // ramps: middle of the ramp, without force then with a shot along the slope
    for (const rp of RAMPS.slice(0, 2)) {
      const x = (rp.x0 + rp.x1) / 2, z = (rp.z0 + rp.z1) / 2, h = rampHeight(rp, x, z), tag = `${x.toFixed(0)},${z.toFixed(0)}`;
      geo.push(run(W(`on a ramp, no force ${tag}`, { at: [x, z], y: h, stand: 1, mag: 2.5, lift: 0.6 })));
      geo.push(run(W(`on a ramp, rifle ${tag}`, { at: [x, z], y: h, stand: 1, dir: [0, 0, 1] })));
      geo.push(run(W(`on a ramp, rifle sideways ${tag}`, { at: [x, z], y: h, stand: 1, dir: [1, 0, 0] })));
    }
    geo.push(run(W('4 m fall (killed midair)', { y: 4, stand: 1, mag: 2.5, lift: 0.6 })));
    // ---- random draw on the map ----
    const WP = [[3, 1.2], [3.5, 1.4], [4.8, 2.4], [5.4, 3], [7.4, 4.2], [8.2, 4.4], [6, 1.4]], rnd = [];
    let seed = 12345; const R = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const clearAt = (x, z) => { for (const c of queryBoxes(x - 0.45, z - 0.45, x + 0.45, z + 0.45)) if (!c.ray && c.y1 > 0.5 && c.y0 < 1.8) return false; return true; };
    for (let k = 0; k < N; k++) {
      let x, z, tries = 0; do { x = MAP.x0 + 2 + R() * (MAP.x1 - MAP.x0 - 4); z = MAP.z0 + 2 + R() * (MAP.z1 - MAP.z0 - 4); } while (!clearAt(x, z) && ++tries < 50);
      if (tries >= 50) continue;
      const w = WP[Math.floor(R() * WP.length)], a = R() * 2 * Math.PI, part = ['body', 'body', 'body', 'head', 'legs'][Math.floor(R() * 5)], rad = R() < 0.08;
      const r = run({ dump: 1, name: `draw ${k}`, at: [x, z], yaw: R() * 2 * Math.PI, dir: [Math.sin(a), 0, Math.cos(a)], mag: rad ? 8 + R() * 10 : w[0], lift: rad ? 6 + R() * 10 : w[1], part: rad ? 'body' : part, radial: rad, vel: R() < 0.4 ? R() * 6 : 0, secs: 12 });
      r.at = [+x.toFixed(1), +z.toFixed(1)]; r.radial = rad; rnd.push(r);
    }
    return { flat, geo, rnd };
  }, [!!process.env.DETAIL, +(process.env.N || 150), TRACE, TR0, TR1, process.env.RAGSET || '', process.env.SEED || '987', +(process.env.REP || 1), !!process.env.ANOM]);
  const fmt = (r) => { const { trace, name, at, radial, spec, anom, penInfo, ...m } = r; return `${name.padEnd(40)} ${JSON.stringify(m)}`; };
  console.log('--- terrain plat'); for (const r of out.flat) { console.log(fmt(r)); if (r.anom) for (const a of r.anom) console.log('   ANOM', JSON.stringify(a)); if (r.trace && r.trace.length) console.log('  ' + r.trace.map((t) => t.join(' ')).join('\n  ')); }
  console.log('--- map geometry'); for (const r of out.geo) { console.log(fmt(r)); if (TRACE && r.name.includes(TRACE) && r.trace.length) console.log('  ' + r.trace.map((t) => t.join(' ')).join('\n  ')); }
  // ---- defects ----
  const bad = [], warn = [];
  const chk = (r, ctx) => {
    if (r.nan) bad.push(`${ctx} ${r.name}: non-finite values`);
    if (r.sleepTime < 0 || r.sleepTime > 6) bad.push(`${ctx} ${r.name}: does not fall asleep (${r.sleepTime}) ${r.spec || ''}`);
    if (r.derive > 0.002) bad.push(`${ctx} ${r.name}: moves after sleeping (${r.derive})`);
    if (r.sunk > 0.06 && r.penInfo && r.penInfo.t > 0.05) bad.push(`${ctx} ${r.name}: sunk by ${r.sunk} m into a box ${JSON.stringify(r.penInfo)} ${r.spec || ''}`);
    if (r.lowY < -0.02) bad.push(`${ctx} ${r.name}: goes below the floor (${r.lowY})`);
    if (r.stretched > 0.2) bad.push(`${ctx} ${r.name}: bone stretched by ${(r.stretched * 100).toFixed(0)} cm (${r.stretchedAt}) ${r.spec || ''}`);
    else if (r.stretched > 0.08) warn.push(`${ctx} ${r.name}: bone stretched by ${(r.stretched * 100).toFixed(0)} cm (${r.stretchedAt})`);
  };
  for (const r of out.flat) chk(r, 'flat'); for (const r of out.geo) chk(r, 'map');
  for (const r of out.rnd) { chk(r, 'draw'); if (TRACE && r.name === TRACE && r.trace.length) console.log(r.name + '\n  ' + r.trace.map((t) => t.join(' ')).join('\n  ')); }
  const nonRad = out.rnd.filter((r) => !r.radial), st = (a, f) => { const v = a.map(f).sort((x, y) => x - y); return v.length ? `mean ${(v.reduce((s, x) => s + x, 0) / v.length).toFixed(2)} med ${v[Math.floor(v.length / 2)].toFixed(2)} p95 ${v[Math.floor(v.length * 0.95)].toFixed(2)} max ${v[v.length - 1].toFixed(2)}` : '-'; };
  console.log(`--- ${out.rnd.length} draws (of which ${out.rnd.length - nonRad.length} explosions)`);
  console.log('distance (non-explosions) :', st(nonRad, (r) => r.travel)); console.log('sleep (s)                 :', st(out.rnd, (r) => r.sleepTime)); console.log('stretched bones (m)       :', st(out.rnd, (r) => r.stretched)); console.log('box penetration (m)       :', st(out.rnd, (r) => r.sunk));
  if (warn.length) console.log(`warnings (${warn.length}): bones stretched by more than 8 cm\n  ` + warn.slice(0, 10).join('\n  '));
  console.log(bad.length ? `DEFECTS (${bad.length}):\n  ` + bad.slice(0, 40).join('\n  ') : 'no defects');
  if (logs.length) console.log(logs.filter((l) => !l.includes('HDRI')).slice(0, 20).join('\n'));
  await browser.close();
  if (bad.length) process.exit(1);
})();
