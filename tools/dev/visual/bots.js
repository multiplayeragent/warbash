/* Accelerated simulation of a match between bots (the player stays invulnerable in their base): checks that the bots
   move and fight on the map. node bots.js [seconds=90] [page=dist/index.html]; MAP=saintgivre: another map.
   Also reports the zones where bots spend the most time and the kills per zone, and what the simulation did
   to the physics props (dislodged, broken, max number moving), and, on a floating-islands map, the bots that fell into the void.
   Also measures walls: share of living time where the scenery absorbs more than half of the intended movement (`walls.timeShare`), number of
   these hits per minute and per bot, length of the worst continuous streak (`walls.longestStreak`, a few seconds at most: a bot does not stay nose
   against a partition, 07e-human.js); and movement usage (`movements`: sprint, crouch, slide, airborne, number of jumps and
   slides). DIFF=0 to 2 (default 2, Veteran) sets the bots' level, MODE=tdm, ffa or dom the mode. */
const { openGame } = require('./common');
(async () => {
  const secs = +(process.argv[2] || 90);
  const { browser, page, logs } = await openGame({ page: process.argv[3], w: 480, h: 270, settings: { quality: 'low', difficulty: +(process.env.DIFF || 2), map: process.env.MAP || 'chergui', mode: process.env.MODE || 'tdm' }, noHdri: true });
  const r = await page.evaluate((secs) => {
    LOCK.fallback = true; startMatch({});
    // the player, invulnerable, stays at the back of their base (out of reach)
    PL.ent.pos.set(SPAWNS[0][0][0], 0, VOID.on ? SPAWNS[0][0][1] + 4 : MAP.z1 - 0.5); // floating islands: at the edge of the zone, it is the void
    const dt = 1 / 30, bots = entities.filter((e) => !e.isPlayer), dist = new Map(bots.map((e) => [e, 0])), prev = new Map(bots.map((e) => [e, e.pos.clone()]));
    const zt = new Map(), zk = new Map(), stuck = new Map(bots.map((e) => [e, 0]));
    const kills0 = new Map(bots.map((e) => [e, 0])); let pmax = 0, falls = 0;
    // walls: for each bot, the share of the intended step (speed before collision) that the scenery absorbed, over a sliding 0.5 s
    const W = new Map(bots.map((e) => [e, { w: [], cm: 0, lost: 0, bump: false, t: 0, tot: 0, events: 0, streaks: [], alive: 0, sprint: 0, crouch: 0, slide: 0, air: 0, jumps: 0, slides: 0, ground: true, sl: false }]));
    for (let i = 0; i < secs * 30; i++) {
      MATCH.time += dt; MATCH.timeLeft -= dt; PL.ent.health = 1e9;
      for (const e of bots) if (e.protT > 0) e.protT -= dt; // respawn protection (09i-modes.js, which the frame loop does not call here)
      for (let k = MATCH.events.length - 1; k >= 0; k--) if (MATCH.events[k].t <= MATCH.time) { const ev = MATCH.events[k]; MATCH.events.splice(k, 1); ev.fn(); }
      const alive = new Map(bots.map((e) => [e, e.alive]));
      for (const e of bots) {
        const x0 = e.pos.x, z0 = e.pos.z, was = e.alive, w = W.get(e);
        updateBot(e, dt, MATCH.time); const d = e.pos.distanceTo(prev.get(e)); dist.set(e, dist.get(e) + d); prev.get(e).copy(e.pos);
        if (!was || !e.alive) { w.w.length = 0; w.cm = w.lost = 0; if (w.bump) { w.streaks.push(w.t); w.bump = false; w.t = 0; } }
        else {
          w.alive += dt;
          const cx = e.vel.x * dt, cz = e.vel.z * dt, cm = Math.hypot(cx, cz), lost = cm > 1e-4 ? Math.max(0, cm - ((e.pos.x - x0) * cx + (e.pos.z - z0) * cz) / cm) : 0;
          w.w.push([cm, lost]); w.cm += cm; w.lost += lost; if (w.w.length > 15) { const o = w.w.shift(); w.cm -= o[0]; w.lost -= o[1]; }
          const ratio = w.cm > 1 ? w.lost / w.cm : 0;
          if (!w.bump && ratio > 0.55) { w.bump = true; w.t = 0; w.events++; } else if (w.bump && ratio < 0.25) { w.streaks.push(w.t); w.bump = false; w.t = 0; }
          if (w.bump) { w.t += dt; w.tot += dt; }
          if (e.sprinting) w.sprint += dt; if (e.crouch) w.crouch += dt; if ((e.slideT || 0) > 0) { w.slide += dt; if (!w.sl) w.slides++; } w.sl = (e.slideT || 0) > 0; if (!e.onGround) w.air += dt;
          if (w.ground && !e.onGround && e.vy > 1) w.jumps++; w.ground = e.onGround;
        }
        if (e.alive) { const z = zoneName(e.pos.x, e.pos.z); zt.set(z, (zt.get(z) || 0) + dt); if (d < 0.002 && !e.goal) stuck.set(e, stuck.get(e) + dt); }
      }
      for (const e of bots) if (alive.get(e) && !e.alive) { const z = zoneName(e.pos.x, e.pos.z); zk.set(z, (zk.get(z) || 0) + 1); if (e.voidDead) falls++; }
      updateNades(dt);
      if (typeof updateProps === 'function') { updateProps(dt); pmax = Math.max(pmax, PHYS.awake.length); }
    }
    const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round(v)}`).join(', ');
    const props = typeof PHYS === 'undefined' ? null : { bodies: PHYS.bodies.filter((b) => !b.pooled).length, movingAtHighest: pmax, dislodged: PHYS.bodies.filter((b) => !b.pooled && b.origin && (b.state === 2 || b.p.distanceTo(new V3(b.origin.x, b.p.y, b.origin.z)) > 0.3)).length, breaks: PHYS.bodies.filter((b) => !b.pooled && b.state === 0).length };
    const sum = (f) => bots.reduce((a, e) => a + f(W.get(e)), 0), alive = sum((w) => w.alive) || 1, streaks = bots.flatMap((e) => W.get(e).streaks).sort((a, b) => a - b), pct = (v) => +(v / alive * 100).toFixed(1) + ' %';
    const walls = { timeShare: +(sum((w) => w.tot) / alive * 100).toFixed(2) + ' %', hitsPerMinutePerBot: +(sum((w) => w.events) / (alive / 60)).toFixed(2), longestStreak: +(streaks[streaks.length - 1] || 0).toFixed(2) };
    const movements = { sprint: pct(sum((w) => w.sprint)), crouched: pct(sum((w) => w.crouch)), slide: pct(sum((w) => w.slide)), airborne: pct(sum((w) => w.air)), jumps: sum((w) => w.jumps), slideCount: sum((w) => w.slides) };
    return { props, walls, movements, ...(VOID.on ? { fallCount: falls } : {}), score: MATCH.score, eliminations: bots.map((e) => e.kills - kills0.get(e)), meters: bots.map((e) => Math.round(dist.get(e))), timeByZone: top(zt), deathsByZone: top(zk) };
  }, secs);
  console.log(JSON.stringify(r));
  if (logs.length) console.log(logs.slice(0, 20).join('\n'));
  await browser.close();
})();
