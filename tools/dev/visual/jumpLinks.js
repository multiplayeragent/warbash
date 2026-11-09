/* Jumps: each jump link of the bot network (03-nav.js, navLeaps: climbing a ledge of 0.47 to 1 m, vaulting a low obstacle, dropping from a ledge up to 3 m) run through the
   game controller. node jumpLinks.js [--json]   (MAP=notos; PAGE=other version)
   A walker (a soldier of the map, driven by ctlMove like the player and the bots) starts 2 m before the start node (if there is no room, from
   1 m, then from the node itself, standing still), walks toward the end node at walking pace then sprint pace, and jumps when the bot rule
   (botLeapNow, 07e-human.js) asks for it. A link passes if it lands the walker on the destination within 3 s: on the ground, within 0.6 m in plan and 0.35 m in height
   for a climb or a vault; within 2.5 m and 0.5 m above to 1 m below for a drop (it does not fall beside, nor into the void).
   Output: the number of links per type, the failures grouped by mode and height, the first failures with the boxes touching the walker;
   error code if any remain. Allow a minute. */
const { openGame } = require('./common');
const json = process.argv.includes('--json');
(async () => {
  const map = process.env.MAP || 'chergui';
  const { browser, page } = await openGame({ w: 480, h: 270, page: process.env.PAGE, noHdri: true, settings: { quality: 'low', difficulty: 2, map } });
  const R = await page.evaluate(() => {
    LOCK.fallback = true; startMatch({});
    const N = NAV.count, links = [], LEAD = {};
    for (let i = 0; i < N; i++) if (NAV.comp[i] === NAV.mainComp) for (let j = NAV.adjStart[i]; j < NAV.adjStart[i + 1]; j++) if (NAV.adjKind[j]) { links.push([i, NAV.adj[j], NAV.adjKind[j]]); LEAD[i + ':' + NAV.adj[j]] = NAV.adjLead[j]; }
    const w = entities.find((e) => !e.isPlayer); w.alive = true; w.health = 1e9;
    const I = w.input, dt = 1 / 30, fails = [], stat = { climbs: 0, stepOvers: 0, descents: 0, failures: { walking: 0, sprint: 0 }, byHeight: {} };
    const hasLedge = (x, z) => COL.filter((c) => !c.ray && x > c.x0 - 0.6 && x < c.x1 + 0.6 && z > c.z0 - 0.6 && z < c.z1 + 0.6 && c.y1 > w.pos.y - 0.05 && c.y0 < w.pos.y + 1.8).slice(0, 4).map((c) => c.m + ' [' + [c.x0, c.x1, c.y0, c.y1, c.z0, c.z1].map((v) => +v.toFixed(2)).join(', ') + ']');
    for (const [a, b, kind] of links) {
      const ax = NAV.nx[a], ay = NAV.ny[a], az = NAV.nz[a], bx = NAV.nx[b], by = NAV.ny[b], bz = NAV.nz[b], rise = by - ay;
      if (kind === 1) stat.climbs++; else if (kind === 3) stat.stepOvers++; else stat.descents++;
      const ux = bx - ax, uz = bz - az, ul = Math.hypot(ux, uz) || 1;
      let start = [ax, az, 'standing still'];
      const clear = (sx, sz) => { // the start point is at the same level and nothing separates it from the start node
        if (!botSpotFree(sx, sz, ay, false) || Math.abs(groundHeight(sx, sz, ay + 0.05, 0.3) - ay) > 0.1) return false;
        for (let f = 0; f <= 1.0001; f += 0.125) { const px = sx + (ax - sx) * f, pz = sz + (az - sz) * f; if (!botSpotFree(px, pz, ay, false) || Math.abs(groundHeight(px, pz, ay + 0.05, 0.3) - ay) > 0.1) return false; }
        return true;
      };
      for (const back of [2, 1]) { const sx = ax - ux / ul * back, sz = az - uz / ul * back; if (clear(sx, sz)) { start = [sx, sz, back + ' m']; break; } }
      const key = (kind === 1 ? 'climb ' : kind === 3 ? 'step-over ' : 'drop ') + (Math.round(Math.abs(rise) * 4) / 4).toFixed(2);
      for (const mode of kind === 2 ? ['walking'] : ['walking', 'sprint']) { // bots slow down at the edge of a drop of more than 0.9 m
        w.pos.set(start[0], ay + 0.01, start[1]); w.vel.set(0, 0, 0); w.vy = 0; w.onGround = true; w.slideT = 0; w.slideCd = 0; w.crouch = false; w.jumpHeld = false; w.input.jump = false; w.airVy = 0; w.eyeH = 1.62;
        let ok = false, maxY = ay, jt = 0;
        const PA = { x: ax, y: ay, z: az }, P = { x: bx, y: by, z: bz, jump: kind !== 2, lead: LEAD[a + ':' + b] };
        for (let f = 0; f < 90; f++) {
          const dx = bx - w.pos.x, dz = bz - w.pos.z;
          w.yaw = Math.atan2(-dx, -dz); I.mx = 0; I.mz = 1; I.sprint = mode === 'sprint'; I.crouch = false; I.ads = false; I.slide = false;
          if (jt <= 0 && kind !== 2 && botLeapNow(w, PA, P)) jt = 0.12;
          I.jump = jt > 0 && w.onGround; if (jt > 0) jt -= dt;
          ctlMove(w, dt); maxY = Math.max(maxY, w.pos.y);
          if (w.pos.y < -20) break;
          const dh = Math.hypot(bx - w.pos.x, bz - w.pos.z), dy = Math.abs(w.pos.y - by);
          if (w.onGround && (kind !== 2 ? dh < 0.6 && dy < 0.35 : dh < 2.5 && w.pos.y < by + 0.5 && w.pos.y > by - 1.0)) { ok = true; break; }
        }
        if (!ok) {
          stat.failures[mode]++; stat.byHeight[key] = (stat.byHeight[key] || 0) + 1;
          if (fails.length < 25) fails.push({ type: kind === 1 ? 'climb' : kind === 3 ? 'stepOver' : 'descent', mode, start: start[2], from: [ax, ay, az].map((v) => +v.toFixed(2)), toward: [bx, by, bz].map((v) => +v.toFixed(2)), end: [w.pos.x, w.pos.y, w.pos.z].map((v) => +v.toFixed(2)), zone: zoneName(ax, az), touchedBoxes: hasLedge(w.pos.x, w.pos.z) });
        }
      }
    }
    return { map: CURMAP.id, linkCount: links.length, ...stat, fails };
  });
  await browser.close();
  if (json) console.log(JSON.stringify(R));
  else {
    console.log(`${R.map}: ${R.linkCount} jump links (${R.climbs} climbs, ${R.stepOvers} step-overs, ${R.descents} drops); failures walking ${R.failures.walking}, sprinting ${R.failures.sprint}`);
    if (Object.keys(R.byHeight).length) console.log('  by height: ' + Object.entries(R.byHeight).sort().map(([k, v]) => `${k}: ${v}`).join(', '));
    for (const f of R.fails) console.log(`  FAIL ${f.type} (${f.mode}, start ${f.start}) from (${f.from.join(', ')}) toward (${f.toward.join(', ')}) ${f.zone}, end (${f.end.join(', ')}); ${f.touchedBoxes.join('; ')}`);
  }
  process.exit(R.failures.walking + R.failures.sprint ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
