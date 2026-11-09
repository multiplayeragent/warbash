/* Spawn quality: accelerated simulation of a match between bots (the player is removed from the game), which scores each spawn at the moment
   it happens. node spawnPoints.js [seconds=180] [page=dist/index.html]; MAP=saintgivre, MODE=tdm, ffa or dom, DIFF=0 to 2.
   Reports, for respawns during the match:
     sightline share of spawns that an opponent sees (clear line of sight to the head or chest, within 60 m);
     inView    share of those that an opponent sees in their field of view (60 degrees either side of their gaze): they see the other spawn;
     nearShare share of those with an opponent within 15 m;
     death5    share of lives ended within 5 s of the spawn (killed on spawn);
     distAdv   median distance to the nearest opponent;
     ms        duration of a spawn (including choosing the spot), median and worst case, on this machine;
   and for the start: the smallest distance between two soldiers and the number of pairs within 1.5 m (shared spots).
   Several seeds (SEEDS=3): the average. One-line JSON, to compare before and after a change to the spawn system. */
const { openGame } = require('./common');
(async () => {
  const secs = +(process.argv[2] || 180), seeds = +(process.env.SEEDS || 1);
  const { browser, page, logs } = await openGame({ page: process.argv[3], w: 480, h: 270, settings: { quality: 'low', difficulty: +(process.env.DIFF || 2), map: process.env.MAP || 'chergui', mode: process.env.MODE || 'tdm' }, noHdri: true });
  const runs = [];
  for (let s = 0; s < seeds; s++) runs.push(await page.evaluate((secs) => {
    LOCK.fallback = true;
    const ev = [], deaths = [], V = new THREE.Vector3(), W = new THREE.Vector3();
    // each spawn is scored as the opponents see it at that instant
    const note = (e, open) => {
      let md = 999, seen = 0, face = 0, near = 0;
      for (const o of entities) {
        if (!o.alive || o === e || o.off || allied(o, e)) continue;
        const dx = e.pos.x - o.pos.x, dz = e.pos.z - o.pos.z, d = Math.hypot(dx, dz);
        md = Math.min(md, d); if (d < 15) near = 1;
        if (d > 60) continue;
        entEye(o, W);
        if (!lineClear(V.set(e.pos.x, e.pos.y + 1.6, e.pos.z), W) && !lineClear(V.set(e.pos.x, e.pos.y + 1.0, e.pos.z), W)) continue;
        seen = 1;
        const fx = -Math.sin(o.yaw), fz = -Math.cos(o.yaw);
        if (d < 1 || (fx * dx + fz * dz) / d > Math.cos(Math.PI / 3)) face = 1;
      }
      ev.push({ open, md, seen, face, near, team: e.team, x: e.pos.x, z: e.pos.z });
    };
    const orig = spawnEntity, ms = [];
    window.spawnEntity = function (e) { const t0 = performance.now(); orig(e); ms.push(performance.now() - t0); if (!e.isPlayer) note(e, MATCH.time - MATCH.startAt < 0.01); };
    try {
      startMatch({});
      // the player leaves the game: neither a target nor a hindrance for the spawns
      PL.ent.alive = false; PL.ent.pos.set(MAP.x1 + 400, -50, MAP.z1 + 400); PL.ent.model && (PL.ent.model.root.visible = false);
      const bots = entities.filter((e) => !e.isPlayer && !e.off);
      // start: distances between soldiers (all teams), on the spots drawn by startMatch
      let minD = 999, pairs = 0;
      for (let i = 0; i < bots.length; i++) for (let j = i + 1; j < bots.length; j++) {
        if (!bots[i].alive || !bots[j].alive) continue;
        const d = Math.hypot(bots[i].pos.x - bots[j].pos.x, bots[i].pos.z - bots[j].pos.z); minD = Math.min(minD, d); if (d < 1.5) pairs++;
      }
      const dt = 1 / 30;
      for (let i = 0; i < secs * 30; i++) {
        MATCH.time += dt; MATCH.timeLeft -= dt;
        for (const e of bots) if (e.protT > 0) { e.protT -= dt; if (e.lastShotT > e.spawnAt) e.protT = 0; }
        for (let k = MATCH.events.length - 1; k >= 0; k--) if (MATCH.events[k].t <= MATCH.time) { const x = MATCH.events[k]; MATCH.events.splice(k, 1); x.fn(); }
        const was = bots.map((e) => e.alive);
        for (const e of bots) updateBot(e, dt, MATCH.time);
        updateNades(dt);
        if (MATCH.mode === 'dom') domUpdate(dt);
        bots.forEach((e, k) => { if (was[k] && !e.alive) deaths.push(MATCH.time - (e.spawnAt || 0)); }); // (killed by another's shot, during the update of that one)
      }
      return { ev, deaths, minD, pairs, ms };
    } finally { window.spawnEntity = orig; }
  }, secs));
  const all = runs.flatMap((r) => r.ev.filter((e) => !e.open)), deaths = runs.flatMap((r) => r.deaths);
  const pct = (n, d) => (d ? +((n / d) * 100).toFixed(1) : 0), med = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? +b[b.length >> 1].toFixed(1) : 0; };
  const r = {
    mapKey: process.env.MAP || 'chergui', mode: process.env.MODE || 'tdm', spawnPoints: all.length,
    sightline: pct(all.filter((e) => e.seen).length, all.length), inView: pct(all.filter((e) => e.face).length, all.length),
    nearShare: pct(all.filter((e) => e.near).length, all.length), death5: pct(deaths.filter((t) => t < 5).length, deaths.length), deathCount: deaths.length,
    distAdv: med(all.map((e) => e.md)), ms: { medianVal: med(runs.flatMap((r) => r.ms)), max: +Math.max(...runs.flatMap((r) => r.ms)).toFixed(1) },
    start: { distMin: +Math.min(...runs.map((r) => r.minD)).toFixed(2), pairsUnder1m5: runs.reduce((a, r) => a + r.pairs, 0) },
  };
  console.log(JSON.stringify(r));
  if (logs.length) console.log(logs.slice(0, 20).join('\n'));
  await browser.close();
})();
