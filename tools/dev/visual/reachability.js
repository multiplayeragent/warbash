/* Reach: what a player can gain by walking and jumping from a spot, in an area of the map. node reachability.js [x0 x1 z0 z1] [--from x,z] [--threshold 2] [--max 40]   (MAP=notos; PAGE=another version)
   A starting point (--from x,z and the height y at which one stands, on the ground by default; without it, the middle of the area) then everything that follows, with the controller's real rules (07c-controller.js):
   - walking: 25 cm steps in eight directions, refused if collideCircle (radius 0.36, 1.75 m) pushes the soldier back, on the ground returned by groundHeight
     (automatic step of STEP = 0.45 m, fall from a ledge);
   - jump: run-up of 6.3 m/s, gravity of 19 m/s² (1.04 m apex), sixteen directions, speeds of 0, 3, that of running (MOVE_SPEED, 4.75 m/s), of sprinting
     (SPRINT_MUL, 7.4 m/s) and of the slide jump (SLIDE.max, 10.3 m/s, the momentum is kept), read from the game, steps of 1/60 s, same collisions in flight, ceiling that cuts the momentum, landing on the first surface reached.
     The jump speed is limited by the run-up: it takes 0.75 m of straight-line walking behind the starting point (within 20°), on ground
     at least 0.8 m wide, for 4.4 m/s and 2.4 m for the sprint and slide jump; on a 10 cm guardrail, you can only jump from a standstill.
   Jumps start only from edges (a neighbor refused, higher or lower): jumping from the middle of a flat surface gains nothing that its edge
   does not gain better, with the same run-up.
   Output: the places that a jump (or a chain of jumps) reaches and that walking alone does not reach, more than --threshold m (2 by default) high
   above the ground, grouped by 1 m cell: height, number of positions, the collision box that carries, and the path from the start (jumps
   marked; supports less than 28 cm wide are skipped, guardrails, thin parapets and glass, where nobody settles, but what is reached from them counts).
   This is what the player must not be able to do: jump onto a low wall, onto a guardrail and then higher, climb a roof by its
   cornices. A roof meant to be walkable is opened by a staircase: it does not appear here. Error code if a place remains.
   The area is given in meters (by default the whole map's playfield, slow: allow 20 s for 400 m², a minute for 1,500 m²). */
const { openGame } = require('./common');
const args = process.argv.slice(2), num = args.slice(0, args.findIndex((a) => a.startsWith('--')) < 0 ? args.length : args.findIndex((a) => a.startsWith('--'))).filter((a) => /^-?\d+(\.\d+)?$/.test(a)).map(Number);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
(async () => {
  const map = process.env.MAP || 'chergui';
  const { browser, page } = await openGame({ w: 480, h: 270, page: process.env.PAGE, noHdri: true, settings: { quality: 'low', map } });
  const R = await page.evaluate(([zone, from, cutpoint, max]) => {
    const [X0, X1, Z0, Z1] = zone.length === 4 ? zone : [MAP.x0, MAP.x1, MAP.z0, MAP.z1], C = 0.25, DT = 1 / 60;
    const ix = (x) => Math.round((x - X0) / C), iz = (z) => Math.round((z - Z0) / C), key = (x, z, h) => (ix(x) * 4096 + iz(z)) * 4096 + Math.round(h / 0.05);
    const inside = (x, z) => x >= X0 && x <= X1 && z >= Z0 && z <= Z1;
    const standable = (x, z, h) => ceilingAbove(x, z, h + 0.05, 0.3) > h + 1.2;
    const start = from || [(X0 + X1) / 2, (Z0 + Z1) / 2];
    // run-up speeds read from the game (07c-controller.js): walk, sprint, slide jump (4.4, 6.8 and 9.7 m/s before 5.1)
    const VW = MOVE_SPEED, VS = MOVE_SPEED * (typeof SPRINT_MUL === 'number' ? SPRINT_MUL : 1.55), VG = SLIDE.max;
    // 1) walking alone, 2) walking and jumps; each node keeps its parent (n.p) and the way it was reached (n.k: 0 walk, 1 jump)
    // run-up: the longest straight-line walk, at the same level (within 0.3 m) and on ground at least 0.8 m wide (on a guardrail or
    // a narrow coping, you do not run), behind the starting point for a jump in direction th (within 20° either side: in the air,
    // the momentum barely turns)
    const p2 = { x: 0, y: 0, z: 0 };
    const runUp = (n, th) => {
      let best = 0;
      for (const dl of [0, -0.35, 0.35]) {
        const bx = -Math.cos(th + dl), bz = -Math.sin(th + dl); let L = 0;
        for (let i = 1; i <= 10; i++) {
          const x = n.x + bx * C * i, z = n.z + bz * C * i; p2.x = x; p2.y = n.h; p2.z = z; collideCircle(p2, 0.36, 1.75);
          if (Math.abs(p2.x - x) + Math.abs(p2.z - z) > 0.03 || Math.abs(groundHeight(x, z, n.h, 0.3) - n.h) > 0.3) break;
          let wide = true; // ground on each side, at 0.4 m
          for (const sg of [1, -1]) wide = wide && Math.abs(groundHeight(x - bz * 0.4 * sg, z + bx * 0.4 * sg, n.h, 0.3) - n.h) <= 0.3;
          if (!wide) break;
          L = i * C;
        }
        best = Math.max(best, L);
      }
      return best;
    };
    const run = (jumps) => {
      const nodes = new Map(), q = [];
      const sx = Math.round(start[0] / C) * C, sz = Math.round(start[1] / C) * C, sh = groundHeight(sx, sz, (start[2] ?? 0) + 0.1, 0.3);
      const add = (x, z, h, p, k, v) => {
        if (!inside(x, z)) return; // the position stays exact (nothing is pushed back into a wall); only the key is at the 25 cm cell
        const kk = key(x, z, h); if (nodes.has(kk) || !standable(x, z, h)) return;
        const n = { x, z, h, p, k, v }; nodes.set(kk, n); q.push(n);
      };
      add(sx, sz, sh, null, 0, 0);
      const pos = { x: 0, y: 0, z: 0 };
      for (let qi = 0; qi < q.length; qi++) {
        const n = q[qi];
        let atEdge = false;
        for (let d = 0; d < 8; d++) {
          const nx = n.x + Math.round(Math.cos(d * Math.PI / 4)) * C, nz = n.z + Math.round(Math.sin(d * Math.PI / 4)) * C;
          pos.x = nx; pos.y = n.h; pos.z = nz; collideCircle(pos, 0.36, 1.75);
          if (Math.abs(pos.x - nx) + Math.abs(pos.z - nz) > 0.03) { atEdge = true; continue; }
          const g = groundHeight(nx, nz, n.h, 0.3);
          if (Math.abs(g - n.h) > 0.1) atEdge = true;
          add(nx, nz, g, n, 0, 0);
        }
        if (!jumps || !atEdge) continue;
        for (const v of [0, 3, VW, VS, VG]) for (let a = 0; a < (v ? 16 : 1); a++) {
          if (v > 0 && runUp(n, a * Math.PI / 8) < (v > VW ? 2.4 : v > 3 ? 0.75 : 0.25)) continue;
          const vx = Math.cos(a * Math.PI / 8) * v, vz = Math.sin(a * Math.PI / 8) * v;
          pos.x = n.x; pos.y = n.h; pos.z = n.z; let vy = 6.3;
          for (let f = 0; f < 120; f++) {
            pos.x += vx * DT; pos.z += vz * DT;
            collideCircle(pos, 0.36, 1.75);
            vy -= 19 * DT; pos.y += vy * DT;
            if (!inside(pos.x, pos.z)) break;
            const g = groundHeight(pos.x, pos.z, Math.max(pos.y, pos.y - vy * DT), 0.3);
            if (vy > 0) { const c = ceilingAbove(pos.x, pos.z, pos.y + 0.3, 0.3); if (c < pos.y + 1.75 + 0.05) vy = 0; }
            if (pos.y <= g && vy <= 0) { add(pos.x, pos.z, g, n, 1, v); break; }
          }
        }
      }
      return nodes;
    };
    const W = run(false), J = run(true);
    // the positions that the jumps add, far from the ground (local ground: the terrain or 0), outside what walking reaches within 0.3 m
    const walkH = new Map(); for (const n of W.values()) { const k = ix(n.x) * 4096 + iz(n.z); (walkH.get(k) || walkH.set(k, []).get(k)).push(n.h); }
    const extra = [];
    for (const n of J.values()) {
      let isKnown = false; // a walking position within 0.35 m (neighboring cells included) and within 0.3 m in height
      for (let a = -1; a <= 1 && !isKnown; a++) for (let b = -1; b <= 1 && !isKnown; b++) isKnown = (walkH.get((ix(n.x) + a) * 4096 + iz(n.z) + b) || []).some((h) => Math.abs(h - n.h) < 0.3);
      if (isKnown) continue;
      if (n.h - gy0(n.x, n.z) < cutpoint) continue;
      // a guardrail, a parapet or a thin pane carries a foot without anyone settling there: it is skipped, but what is reached from it is still counted
      const bx = queryBoxes(n.x - 0.1, n.z - 0.1, n.x + 0.1, n.z + 0.1).find((c) => !c.ray && Math.abs(c.y1 - n.h) < 0.02 && n.x >= c.x0 - 0.2 && n.x <= c.x1 + 0.2 && n.z >= c.z0 - 0.2 && n.z <= c.z1 + 0.2);
      if (bx && Math.min(bx.x1 - bx.x0, bx.z1 - bx.z0) < 0.28) continue;
      extra.push(n);
    }
    const cells = new Map();
    for (const n of extra) { const k = Math.floor(n.x) + ',' + Math.floor(n.z); const c = cells.get(k) || { x: Math.floor(n.x), z: Math.floor(n.z), n: 0, h0: 99, h1: -99, top: n }; c.n++; c.h0 = Math.min(c.h0, n.h); c.h1 = Math.max(c.h1, n.h); cells.set(k, c); }
    const pathway = (n) => { const out = []; for (let m = n; m; m = m.p) out.push(`${m.k ? 'JUMP ' + m.v + ' m/s ' : ''}(${m.x.toFixed(2)}, ${m.h.toFixed(2)}, ${m.z.toFixed(2)})`); return out.reverse(); };
    const boxDesc = (n) => { const b = queryBoxes(n.x - 0.1, n.z - 0.1, n.x + 0.1, n.z + 0.1).filter((c) => !c.ray && Math.abs(c.y1 - n.h) < 0.02 && n.x >= c.x0 - 0.2 && n.x <= c.x1 + 0.2 && n.z >= c.z0 - 0.2 && n.z <= c.z1 + 0.2)[0]; return b ? `${b.m || '?'} [${b.x0.toFixed(2)}..${b.x1.toFixed(2)}, ${b.y0.toFixed(2)}..${b.y1.toFixed(2)}, ${b.z0.toFixed(2)}..${b.z1.toFixed(2)}]` : 'ramp or floor'; };
    return { mapKey: CURMAP.id, start, walking: W.size, jumpLinks: J.size, extra: extra.length,
      cells: [...cells.values()].sort((a, b) => b.h1 - a.h1).slice(0, max).map((c) => ({ x: c.x, z: c.z, n: c.n, h0: +c.h0.toFixed(2), h1: +c.h1.toFixed(2), boxDesc: boxDesc(c.top), pathway: pathway(c.top) })) };
  }, [num.length === 4 ? num : [], opt('--from', '') ? opt('--from').split(',').map(Number) : null, +opt('--threshold', 2), +opt('--max', 40)]); // --max: number of cells listed (comparing two versions)
  await browser.close();
  console.log(`${R.mapKey}: ${R.walking} positions on foot, ${R.jumpLinks} with jumps, ${R.extra} gained by jumps at more than ${opt('--threshold', 2)} m above the ground, ${R.cells.length} 1 m cells`);
  for (const c of R.cells) {
    console.log(`  cell (${c.x}, ${c.z}): ${c.n} positions, from ${c.h0} to ${c.h1} m; ${c.boxDesc}`);
    console.log('    ' + c.pathway.filter((s, i, a) => i === 0 || s.startsWith('JUMP') || i === a.length - 1).join(' > '));
  }
  if (R.cells.length) process.exit(1);
})();
