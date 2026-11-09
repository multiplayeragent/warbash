/* Crossing a map without jumping: node crossing.js [--json]   (MAP=notos; PAGE=other version)
   Owner feedback (October 2026): "I must be able to move from one end of the map to the other without getting blocked by an
   obstacle on my route that I have to jump". The bot network (03-nav.js) has walking links and jump links (navLeaps: climb,
   vault, drop). This check compares, between key points (one spawn of each side, the domination points, the ground-level
   points of interest), the shortest path with jumps and the shortest walking-only path (automatic step-up of 0.45 m, ramps,
   stairs):
   - pairs with no walking path, or whose walking path is more than 25 % longer;
   - the jumps taken by the shortest paths (with jumps) between all pairs, grouped by 1 m cell, from most used to
     least used: these are the obstacles to fix on the routes (low wall, crate, curb, ledge over 0.45 m);
   - ground-level areas (less than 0.6 m above the ground) of the main network reachable only by jumping, in clusters of at least
     4 m² (a room whose threshold is too high, a nook closed off by a crate); crate tops and roofs, being intended, are not there.
   Error code if a pair remains with no walking path or more than 25 % longer. Allow a minute per map. */
const { openGame } = require('./common');
const json = process.argv.includes('--json');
(async () => {
  const map = process.env.MAP || 'chergui';
  const { browser, page } = await openGame({ w: 480, h: 270, page: process.env.PAGE, noHdri: true, settings: { quality: 'low', difficulty: 1, map, mode: 'dom' } });
  const R = await page.evaluate(() => {
    LOCK.fallback = true; startMatch({});
    const N = NAV.count, main = (i) => NAV.comp[i] === NAV.mainComp, lift = (i) => NAV.ny[i] - gy0(NAV.nx[i], NAV.nz[i]);
    const dij = (s, walk) => {
      const dist = new Float64Array(N).fill(1e9), from = new Int32Array(N).fill(-1), via = new Int32Array(N).fill(-1), H = [];
      const push = (k, id) => { H.push([k, id]); let i = H.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (H[p][0] <= H[i][0]) break; [H[p], H[i]] = [H[i], H[p]]; i = p; } };
      const pop = () => { const t = H[0], l = H.pop(); if (H.length) { H[0] = l; let i = 0; for (;;) { const a = i * 2 + 1, b = a + 1; let m = i; if (a < H.length && H[a][0] < H[m][0]) m = a; if (b < H.length && H[b][0] < H[m][0]) m = b; if (m === i) break; [H[m], H[i]] = [H[i], H[m]]; i = m; } } return t; };
      dist[s] = 0; push(0, s);
      while (H.length) {
        const [d, n] = pop(); if (d > dist[n]) continue;
        for (let j = NAV.adjStart[n]; j < NAV.adjStart[n + 1]; j++) {
          if (walk && NAV.adjKind[j]) continue;
          const m = NAV.adj[j], nd = d + NAV.adjCost[j];
          if (nd < dist[m]) { dist[m] = nd; from[m] = n; via[m] = j; push(nd, m); }
        }
      }
      return { dist, from, via };
    };
    // key points: one spawn per side (the first), the domination points, the ground-level points of interest
    const keys = [];
    const add = (name, x, y, z) => { const id = navNode(x, y, z); if (id >= 0 && main(id)) keys.push({ name, id, x: +x.toFixed(1), z: +z.toFixed(1) }); };
    SPAWNS.forEach((side, t) => { if (side[0]) add(t ? 'Bravo spawn' : 'Alpha spawn', side[0][0], gy0(side[0][0], side[0][1]), side[0][1]); });
    DOM.pts.forEach((p, i) => add('point ' + 'ABC'[i], p.x, p.y !== undefined ? p.y : gy0(p.x, p.z), p.z));
    POI.forEach((p, i) => { if (p[1] - gy0(p[0], p[2]) < 0.6) add('interest ' + i, p[0], p[1], p[2]); });
    const full = keys.map((k) => dij(k.id, false)), walk = keys.map((k) => dij(k.id, true));
    const pairs = [], leaps = new Map();
    for (let a = 0; a < keys.length; a++) for (let b = a + 1; b < keys.length; b++) {
      const df = full[a].dist[keys[b].id], dw = walk[a].dist[keys[b].id];
      if (df > 1e8) continue;
      if (dw > 1e8 || dw > df * 1.25) pairs.push({ from: keys[a].name, toward: keys[b].name, withJumps: +df.toFixed(0), walking: dw > 1e8 ? null : +dw.toFixed(0) });
      for (let n = keys[b].id; full[a].from[n] >= 0; n = full[a].from[n]) {
        const j = full[a].via[n]; if (!NAV.adjKind[j]) continue;
        const p = full[a].from[n], k = Math.floor(NAV.nx[p]) + ',' + Math.floor(NAV.nz[p]);
        const e = leaps.get(k) || { x: +NAV.nx[p].toFixed(1), z: +NAV.nz[p].toFixed(1), y0: +NAV.ny[p].toFixed(2), y1: +NAV.ny[n].toFixed(2), kind: NAV.adjKind[j], n: 0 };
        e.n++; leaps.set(k, e);
      }
    }
    // ground-level zones reached only by jumping (from the Alpha spawn)
    const w0 = walk[0] ? walk[0].dist : null, cells = new Map();
    if (w0) for (let i = 0; i < N; i++) if (main(i) && w0[i] > 1e8 && lift(i) < 0.6) { const k = Math.floor(NAV.nx[i] / 2) + ',' + Math.floor(NAV.nz[i] / 2); cells.set(k, (cells.get(k) || 0) + 1); }
    // clusters of neighboring 2 m cells
    const seen = new Set(), zones = [];
    for (const k of cells.keys()) {
      if (seen.has(k)) continue;
      const st = [k], z = { n: 0, x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 }; seen.add(k);
      while (st.length) { const c = st.pop(), [cx, cz] = c.split(',').map(Number); z.n += cells.get(c); z.x0 = Math.min(z.x0, cx * 2); z.x1 = Math.max(z.x1, cx * 2 + 2); z.z0 = Math.min(z.z0, cz * 2); z.z1 = Math.max(z.z1, cz * 2 + 2); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = (cx + dx) + ',' + (cz + dz); if (cells.has(q) && !seen.has(q)) { seen.add(q); st.push(q); } } }
      if (z.n >= 4) zones.push(z);
    }
    const KIND = ['', 'climb', 'drop', 'step-over'];
    return {
      mapKey: CURMAP.id, points: keys.length, pairCount: keys.length * (keys.length - 1) / 2, badPairs: pairs,
      jumpLinks: [...leaps.values()].sort((a, b) => b.n - a.n).slice(0, 30).map((e) => ({ ...e, kind: KIND[e.kind] || e.kind })),
      zones: zones.sort((a, b) => b.n - a.n).slice(0, 20),
    };
  });
  await browser.close();
  if (json) { console.log(JSON.stringify(R)); return; }
  console.log(`${R.mapKey}: ${R.points} key points, ${R.pairCount} pairs; ${R.badPairs.length} without a walking path or more than 25 % longer`);
  for (const p of R.badPairs) console.log(`  ${p.from} > ${p.toward}: ${p.withJumps} m with jumps, ${p.walking === null ? 'no path' : p.walking + ' m'} walking`);
  if (R.jumpLinks.length) console.log('jumps on the shortest paths (cell, heights, number of paths):');
  for (const s of R.jumpLinks) console.log(`  (${s.x}, ${s.z}) ${s.kind} from ${s.y0} to ${s.y1} m: ${s.n}`);
  if (R.zones.length) console.log("ground-level zones reachable only by jumping:");
  for (const z of R.zones) console.log(`  x ${z.x0} to ${z.x1}, z ${z.z0} to ${z.z1}: ${z.n} nodes`);
  if (R.badPairs.length) process.exit(1);
})();
