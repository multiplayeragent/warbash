/* Check of a map's scenery placements: node decor.js [--json]   (MAP=notos; the doors come from Notos's CYC.doors registry)
   Looks for what shows when playing:
   - an obstacle (scenery wall, prop, placed object) in the 1.5 m corridor in front of a door, except planters stored against the jamb and walls
     that extend the door reveal (in a thick wall, the corridor starts at the wall face) (a door
     that cannot be walked through, with the navigation network on one side only, is reported as such: painted door, closed, facing outward);
   - a planter sunk into a wall, or in the air with no support (a window sill is a support), or in the middle of an alley;
   - a tree planted in an alley narrower than 3.4 m, or whose crown covers a door;
   - a staircase that does not lead to the navigation network, or whose foot or head touches a door;
   - a poster or wall panel from the port kit or Saint-Givre (decal3Quad, decal2Quad) with no wall right behind it (placed across a door,
     it floats in the void) or hidden in a volume, placed on a window or a door of a facade wall (wallPierced), that sticks out of the wall or touches
     its end, or not centered in its wall panel when that is under 3.5 m (between two windows, between a window and a corner);
   - a bike (tipping prop) whose frame enters a wall: it no longer moves when shot;
   - an obstacle at the head of a suspension bridge (floating islands, BRIDGES): over 5 m in the bridge's extension and over its width plus 0.5 m on
     each side, nothing taller than 0.5 m (block, stele, rock, tree, crate, ramp); you leave a bridge onto a clear landing (what
     frames it, and what is beside it, stays allowed).
   - relief map (dunes): a placed object (prefab) with a part sunk in the sand or with its foot floating (rocks, trees and grasses
     excepted);
   - all maps: two things that overlap: the collision boxes of a placed object or a physics prop that enter by more than
     8 cm into those of another construction or another object, a tarp pole (smTarp) that goes through something.
   Output: one line per defect, with the place and the function that placed it; error code if there is an obstructed door, a planter sunk or in the air,
   a floating poster, a bike in a wall or a cluttered bridge head.
   The placement log is kept by wrapping Maker.place before the map is built (nothing is kept in the game). */
const { openGame } = require('./common');
const json = process.argv.includes('--json'), itemList = process.argv.includes('--posters'); // --posters: all posters and wall panels, with their position and facing
(async () => {
  const map = process.env.MAP || 'chergui';
  const { browser, page } = await openGame({ w: 480, h: 270, page: process.env.PAGE, noMap: true, noHdri: true, settings: { quality: 'low', difficulty: 1, map } });
  const R = await page.evaluate(async (map) => {
    const PL = [], P = Maker.prototype, old = P.place;
    P.place = function (pf, x, y, z, ry, o) {
      if (this === DECOR && !/^(gravel|stone|chunk|pebbles|litter|weed|brick|shard|pile|grass|rubble|scrap|paper|leaf|moss|dirt|crack|puddle|debris|splat)/i.test(pf.name)) { // the small floor debris (scatterGround) is not an obstacle
        this._n(); const e = this.m.elements;
        PL.push({ n: pf.name, x: e[0] * x + e[4] * y + e[8] * z + e[12], y: e[1] * x + e[5] * y + e[9] * z + e[13], z: e[2] * x + e[6] * y + e[10] * z + e[14], nocol: !!(o && o.nocol), fn: ((new Error().stack.split('\n')[2] || '').trim().replace(/^at /, '').replace(/ \(.*$/, '')) });
      }
      return old.apply(this, arguments);
    };
    // doors of the other maps: we note the flush openings (at least 1.9 m tall, from 0 to 5 cm off the ground) that wallPierced and wallOpen place,
    // except those closed on purpose (isClosed: true in the opening: the gate of a walled-up or blocked tunnel, which is not a passage)
    const DOORS = [], WALLS = [];
    if (map !== 'notos') {
      const wp = wallPierced, wo = wallOpen;
      wallPierced = function (M, key, len, y, h, ops, o) {
        // the wall and all its openings (doors and windows) in the world: the facade frame has x along the wall, z toward the outside; used to place the posters
        if (M === DECOR) { const e = M.m.elements, tl = Math.hypot(e[0], e[2]) || 1, nl = Math.hypot(e[8], e[10]) || 1; WALLS.push({ ox: e[12], oz: e[14], tx: e[0] / tl, tz: e[2] / tl, nx: e[8] / nl, nz: e[10] / nl, s: tl, len, y0: e[13] + y, y1: e[13] + y + h, ops: (ops || []).map((q) => ({ x0: q.x0, x1: q.x1, y0: e[13] + q.y0, y1: e[13] + q.y1 })) }); }
        for (const op of ops || []) if (op.y0 <= 0.05 && op.y1 - op.y0 >= 1.9 && y <= 0.05 && !op.isClosed) { const e = M.m.elements, xc = (op.x0 + op.x1) / 2, nl = Math.hypot(e[8], e[10]) || 1; DOORS.push({ x: e[0] * xc + e[12], z: e[2] * xc + e[14], nx: e[8] / nl, nz: e[10] / nl, w: op.x1 - op.x0, kind: 'facade' }); }
        return wp.apply(this, arguments);
      };
      wallOpen = function (key, axis, fixed, t, a0, a1, y0, h, ops, o) {
        for (const op of ops || []) if (op.b0 <= 0.05 && op.b1 - op.b0 >= 1.9 && y0 <= 0.05 && !op.isClosed) { const c = (op.a0 + op.a1) / 2, w = op.a1 - op.a0; for (const sg of [1, -1]) DOORS.push(axis === 'x' ? { x: c, z: fixed, nx: 0, nz: sg, w, t, kind: 'passage' } : { x: fixed, z: c, nx: sg, nz: 0, w, t, kind: 'passage' }); }
        return wo.apply(this, arguments);
      };
    }
    // posters and wall panels (port kit: decal3Quad; Saint-Givre: decal2Quad): their four corners in the world (the prefabs have their own
    // workshop, not DECOR); for Saint-Givre, the ground decals (normal pointing up) are set aside as for the port
    const DEC = [], dq = typeof decal3Quad === 'function' ? decal3Quad : null, dq2 = typeof decal2Quad === 'function' ? decal2Quad : null;
    const decNote = (pf, kit) => function (M, i, p0, p1, p2, p3, n) {
      if (M === DECOR) {
        const e = M.m.elements, T = (q) => [e[0] * q[0] + e[4] * q[1] + e[8] * q[2] + e[12], e[1] * q[0] + e[5] * q[1] + e[9] * q[2] + e[13], e[2] * q[0] + e[6] * q[1] + e[10] * q[2] + e[14]];
        const N = [e[0] * n[0] + e[4] * n[1] + e[8] * n[2], e[1] * n[0] + e[5] * n[1] + e[9] * n[2], e[2] * n[0] + e[6] * n[1] + e[10] * n[2]];
        if (Math.abs(N[1]) < 0.5) DEC.push({ i, kit, P: [p0, p1, p2, p3].map(T), N, fn: (new Error().stack.split('\n')[3] || '').trim().replace(/^at /, '').replace(/ \(.*$/, '') });
      }
      return pf.apply(this, arguments);
    };
    if (dq) decal3Quad = decNote(dq, 'port');
    if (dq2) decal2Quad = decNote(dq2, 'winterKit');
    // placed objects (Maker.put in the scenery) and owner of each collision box: a scenery construction starts at a top-level
    // save(); a box placed outside any save() belongs to the function that placed it
    const PUTS = [], oput = P.put, osave = P.save, ocol = WORLD.col, frame = () => new Error().stack.split('\n').slice(2).map((l) => l.trim().replace(/^at /, '').replace(/ \(.*$/, '')).find((f) => !/^(P\.|Maker\.|Object\.|WORLD\.|smPlace|smFlat|smTarp)/.test(f)) || '?'; // the map function that places
    let own = 0, cur = 0, loose = '', looseId = 0;
    P.save = function () { if (this === DECOR && this.stack.length === 0) cur = ++own; return osave.apply(this, arguments); };
    WORLD.col = function () { const r = ocol.apply(this, arguments), c = COL[COL.length - 1]; if (DECOR.stack.length) c.own = cur; else { const f = frame(); if (f !== loose) { loose = f; looseId = ++own; } c.own = looseId; c.ownFn = f; } return r; };
    P.put = function (pf) {
      if (this !== DECOR) return oput.apply(this, arguments);
      this._n(); const c0 = COL.length, r = oput.apply(this, arguments), id = ++own;
      for (let k = c0; k < COL.length; k++) COL[k].own = id;
      PUTS.push({ pf, m: this.m.elements.slice(), id, fn: frame() });
      return r;
    };
    // tarp poles of Sirocco (smTarp): their feet in the world, and the tarp's construction (the collisions of its poles do not
    // count against themselves)
    const POLES = [], otarp = typeof smTarp === 'function' ? smTarp : null;
    if (otarp) smTarp = function (x, y, z, rot, w, d, h0, h1) {
      const c = Math.cos(rot), sn = Math.sin(rot), n0 = POLES.length;
      for (const sx of [-1, 1]) for (const [sz, h] of [[-1, h0], [1, h1]]) { const lx = sx * w / 2, lz = sz * d / 2; POLES.push({ x: x + lx * c + lz * sn, z: z - lx * sn + lz * c, y0: y, y1: y + h, fn: frame() }); }
      const r = otarp.apply(this, arguments);
      for (let k = n0; k < POLES.length; k++) POLES[k].own = cur;
      return r;
    };
    Settings.map = map; await mapEnsure(map); LOCK.fallback = true; startMatch({});
    P.place = old; P.put = oput; P.save = osave; WORLD.col = ocol; if (dq) decal3Quad = dq; if (dq2) decal2Quad = dq2; if (otarp) smTarp = otarp;
    const r1 = (v) => Math.round(v * 10) / 10;
    const solids = COL.filter((c) => !c.ray && !c.inv && !c.prop), propBoxes = COL.filter((c) => !c.ray && c.prop);
    const inBox = (c, x, z, y0, y1) => x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1 && c.y1 > y0 && c.y0 < y1;
    const scan = (x, z, dx, dz, ya = gy0(x, z) + 0.3, yb = gy0(x, z) + 1.8) => { for (let d = 0.1; d <= 6; d += 0.1) { const px = x + dx * d, pz = z + dz * d; for (const c of queryBoxes(px, pz, px, pz)) { if (c.ray || c.inv || c.prop || c.y1 < ya || c.y0 > yb || (c.x1 - c.x0) * (c.z1 - c.z0) < 1.2 || Math.max(c.x1 - c.x0, c.z1 - c.z0) < 1.5) continue; if (px >= c.x0 && px <= c.x1 && pz >= c.z0 && pz <= c.z1) return d; } } return 6; };
    const width = (x, z) => Math.min(scan(x, z, 1, 0) + scan(x, z, -1, 0), scan(x, z, 0, 1) + scan(x, z, 0, -1));
    const wallDist = (x, z, ya, yb) => Math.min(scan(x, z, 1, 0, ya, yb), scan(x, z, -1, 0, ya, yb), scan(x, z, 0, 1, ya, yb), scan(x, z, 0, -1, ya, yb));
    const zone = (x, z) => zoneName(x, z);
    const out = { all: DEC.map((d) => ({ i: d.i, kit: d.kit, c: [0, 1, 2].map((k) => r1((d.P[0][k] + d.P[2][k]) / 2)), N: [r1(d.N[0]), r1(d.N[2])] })), doors: 0, doorBlocked: [], potsBad: [], trees: [], stairs: [], decals: DEC.length, decalsBad: [], bikesBad: [], heads: 0, headsBlocked: [], placed: PL.length, sand: [], overlaps: [], relief: RELIEF.on };
    const doors = map === 'notos' && CYC.doors ? CYC.doors : DOORS;
    out.doors = doors.length;
    // 1. in front of the doors
    for (const D of doors) {
      // the corridor of a passage through a thick wall (rampart) starts at the wall face, not at the middle of the wall; a wall that extends the door
      // reveal (alley as wide as it) does not obstruct it: only the walls that enter its width count
      const tx = -D.nz, tz = D.nx, hits = new Map(), d0 = Math.max(0, (D.t || 0) / 2 - 0.4);
      for (let a = -(D.w / 2 + 0.15); a <= D.w / 2 + 0.15; a += 0.15) for (let d = 0.45 + d0; d <= 1.5 + d0; d += 0.15) {
        const x = D.x + D.nx * d + tx * a, z = D.z + D.nz * d + tz * a;
        for (const c of solids) if (Math.abs(a) < D.w / 2 - 0.01 && inBox(c, x, z, 0.5, 1.9)) hits.set('scenery ' + [c.x0, c.x1, c.z0, c.z1].map(r1).join(','), d);
        for (const c of propBoxes) if (inBox(c, x, z, 0.05, 1.9) && !(Math.abs(a) > D.w / 2 - 0.05 && c.prop && /pot|jar|planter|vase|urn/i.test(c.prop.d.type))) hits.set('prop ' + c.prop.d.type + ' (' + r1(c.prop.origin.x) + ', ' + r1(c.prop.origin.z) + ')', d);
      }
      for (const p of PL) {
        if (p.nocol) continue;
        const dx = p.x - D.x, dz = p.z - D.z, d = dx * D.nx + dz * D.nz, a = dx * tx + dz * tz;
        if (d > 0.1 && d < 1.7 && Math.abs(a) < D.w / 2 + 0.3) hits.set('placed ' + p.n + ' (' + r1(p.x) + ', ' + r1(p.z) + ') by ' + p.fn, d);
      }
      // a door that cannot be walked through (navigation network on one side only: painted door, closed, on the outside of the map) is reported as such
      const navAt = (x, z) => { const c = NAV.cells[(Math.floor(z) - NAV.z0) * NAV.W + Math.floor(x) - NAV.x0]; return !!c && c.some((i) => NAV.ny[i] < gy0(x, z) + 0.6); };
      const open = navAt(D.x - D.nx * 1.2, D.z - D.nz * 1.2) && navAt(D.x + D.nx * 1.2, D.z + D.nz * 1.2);
      if (hits.size) out.doorBlocked.push({ doorway: D.kind + ' (' + r1(D.x) + ', ' + r1(D.z) + ') normal (' + D.nx + ', ' + D.nz + ') ' + zone(D.x, D.z) + (open ? '' : ' (door that cannot be walked through)'), inFront: [...hits.keys()], open });
    }
    // 2. pots
    for (const b of PHYS.bodies) {
      if (b.pooled || !/pot|jar|planter|vase|urn/i.test(b.d.type)) continue;
      const { x, y, z } = b.origin, why = [], up = y - gy0(x, z); // height above the ground (the sand, on a relief map)
      if (solids.some((c) => inBox(c, x, z, y + 0.14, y + 0.3))) why.push('sunk into a wall or a volume');
      if (up > 0.25) {
        // supports: walls and volumes, other bodies, and collisions reserved for objects (PHYS.pcols: shelf, balcony slab)
        const wall = wallDist(x, z, y - 0.3, y + 0.6), sup = [...solids, ...propBoxes, ...(PHYS.pcols || [])].some((c) => c !== b.cols[0] && x >= c.x0 - 0.1 && x <= c.x1 + 0.1 && z >= c.z0 - 0.1 && z <= c.z1 + 0.1 && Math.abs(c.y1 - y) < 0.15);
        if (!sup && !(wall < 0.4 && up > 0.8)) why.push('in the air at ' + r1(up) + ' m (no support, not a ledge)');
      }
      const w = width(x, z), wd = wallDist(x, z);
      if (up < 0.3 && w <= 3.2 && wd > 0.6) why.push('in the middle of an alley of ' + r1(w) + ' m');
      if (why.length) out.potsBad.push({ pot: b.d.type + ' (' + r1(x) + ', ' + r1(y) + ', ' + r1(z) + ') ' + zone(x, z), defects: why });
    }
    // 3. trees
    for (const p of PL) {
      if (!/tree|palm|olive|fig|cypress|plane|tamarisk|pine|fir|spruce|linden|willow|bamboo|banana|fern|hedge|topiary|oak|birch|maple|cherry|ginkgo|conifer|larch/i.test(p.n)) continue;
      const nm = /([\d]+(?:\.[\d]+)?)/.exec(p.n), h = nm ? Math.min(14, +nm[1]) : 5, rc = /cypress|topiary|fir|spruce|pine|conifer|larch/i.test(p.n) ? 0.5 + h * 0.05 : h * 0.42, w = width(p.x, p.z), why = [];
      if (w <= 3.4) why.push('in an alley of ' + r1(w) + ' m');
      for (const D of doors) { const dx = p.x - D.x, dz = p.z - D.z, d = dx * D.nx + dz * D.nz, a = dx * -D.nz + dz * D.nx; if (d > -0.5 && d < 3.0 && Math.abs(a) < rc + D.w / 2) why.push('covers door ' + D.kind + ' (' + r1(D.x) + ', ' + r1(D.z) + ')'); }
      out.trees.push({ treeItem: p.n + ' (' + r1(p.x) + ', ' + r1(p.z) + ') crown radius ~' + r1(rc) + ' m ' + zone(p.x, p.z) + ' by ' + p.fn, defects: why });
    }
    // 4. staircases
    for (const r of RAMPS) {
      const lo = r.h0 <= r.h1 ? 0 : 1, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
      const foot = r.axis === 'x' ? [lo ? r.x1 : r.x0, cz] : [cx, lo ? r.z1 : r.z0], head = r.axis === 'x' ? [lo ? r.x0 : r.x1, cz] : [cx, lo ? r.z0 : r.z1], why = [];
      const ok = (pt, y) => { const id = navNode(pt[0], y, pt[1]); return id >= 0 && Math.hypot(NAV.nx[id] - pt[0], NAV.nz[id] - pt[1]) < 1.2 && Math.abs(NAV.ny[id] - y) < 0.8; };
      if (!ok(foot, Math.min(r.h0, r.h1))) why.push('the foot (' + r1(foot[0]) + ', ' + r1(foot[1]) + ') is not on the network');
      if (!ok(head, Math.max(r.h0, r.h1))) why.push('the head (' + r1(head[0]) + ', ' + r1(head[1]) + ') is not on the network');
      for (const D of doors) for (const [nm, pt] of [['foot', foot], ['head', head]]) if (Math.hypot(D.x - pt[0], D.z - pt[1]) < 2.2) why.push('door ' + D.kind + ' (' + r1(D.x) + ', ' + r1(D.z) + ') at ' + r1(Math.hypot(D.x - pt[0], D.z - pt[1])) + ' m from the ' + nm);
      // clear floor in front of the first step (README, Finishing touches: 1.5 m at least): solid boxes between 0.1 and 1.7 m above the foot, in
      // the axis of the flight, over its width minus 30 cm on each side (a railing running along it does not count)
      {
        const yf = Math.min(r.h0, r.h1), dir = r.axis === 'x' ? [lo ? 1 : -1, 0] : [0, lo ? 1 : -1], half = (r.axis === 'x' ? r.z1 - r.z0 : r.x1 - r.x0) / 2 - 0.3;
        let free = 1.5;
        for (const c of solids) {
          if (c.y1 < yf + 0.1 || c.y0 > yf + 1.7) continue;
          for (let t = 0.05; t < free; t += 0.1) for (const a of [-half, 0, half]) {
            const px = foot[0] + dir[0] * t + (r.axis === 'x' ? 0 : a), pz = foot[1] + dir[1] * t + (r.axis === 'x' ? a : 0);
            if (px > c.x0 && px < c.x1 && pz > c.z0 && pz < c.z1) { free = Math.min(free, t); break; }
          }
        }
        if (free < 1.45) why.push('clear floor in front of the first step: ' + r1(free) + ' m (1.5 at least)');
      }
      out.stairs.push({ stairway: [r.x0, r.x1, r.z0, r.z1].map(r1).join(' ') + ' axis ' + r.axis + ' from ' + r.h0 + ' to ' + r.h1 + ' ' + zone(cx, cz), defects: why });
    }
    // 5. wall posters: a wall 12 cm behind the center and the four corners (at 70 % of the center), nothing 15 cm in front
    const inSolid = (q) => solids.some((c) => q[0] >= c.x0 - 0.02 && q[0] <= c.x1 + 0.02 && q[1] >= c.y0 - 0.02 && q[1] <= c.y1 + 0.02 && q[2] >= c.z0 - 0.02 && q[2] <= c.z1 + 0.02);
    for (const d of DEC) {
      const c = [0, 1, 2].map((k) => (d.P[0][k] + d.P[2][k]) / 2), pts = [c].concat(d.P.map((q) => [0, 1, 2].map((k) => c[k] + (q[k] - c[k]) * 0.7)));
      const miss = pts.filter((q) => !inSolid([0, 1, 2].map((k) => q[k] - d.N[k] * 0.12))).length, hid = inSolid([0, 1, 2].map((k) => c[k] + d.N[k] * 0.15));
      // above a building (a box of 4 m or more in its column, under it): a gable or a cornice, which the collision does not cover (gable clock)
      const gable = solids.some((b) => b.y1 >= 4 && b.y1 <= Math.min(...d.P.map((q) => q[1])) + 0.05 && c[0] - d.N[0] * 0.12 >= b.x0 - 0.3 && c[0] - d.N[0] * 0.12 <= b.x1 + 0.3 && c[2] - d.N[2] * 0.12 >= b.z0 - 0.3 && c[2] - d.N[2] * 0.12 <= b.z1 + 0.3);
      const why = [miss && !gable ? 'no wall behind (' + miss + ' points out of 5)' : '', hid ? 'hidden inside a volume' : ''].filter(Boolean);
      // the facade wall (wallPierced) that carries it: same plane within 30 cm, same direction; its openings and the void around it, in the wall's plane
      const W = WALLS.find((w) => w.nx * d.N[0] + w.nz * d.N[2] > 0.9 && Math.abs((c[0] - w.ox) * w.nx + (c[2] - w.oz) * w.nz) < 0.3 && ((c[0] - w.ox) * w.tx + (c[2] - w.oz) * w.tz) / w.s > -0.05 && ((c[0] - w.ox) * w.tx + (c[2] - w.oz) * w.tz) / w.s < w.len + 0.05 && c[1] >= w.y0 - 0.05 && c[1] <= w.y1 + 0.05);
      // openings and centering: only for posters (port: 0 to 3; winter: poster, poster2, departures): a graffiti, a clock or a drip has transparent edges
      const poster = d.kit === 'port' ? d.i <= 3 : d.i === 4 || d.i === 5 || d.i === 6;
      if (W && poster) {
        const U = (q) => ((q[0] - W.ox) * W.tx + (q[2] - W.oz) * W.tz) / W.s, us = d.P.map(U), u0 = Math.min(...us), u1 = Math.max(...us), v0 = Math.min(...d.P.map((q) => q[1])), v1 = Math.max(...d.P.map((q) => q[1])), uc = (u0 + u1) / 2;
        const hit = W.ops.filter((q) => u1 > q.x0 - 0.03 && u0 < q.x1 + 0.03 && v1 > q.y0 - 0.03 && v0 < q.y1 + 0.03); // 3 cm tolerance around the opening (the frame is drawn on top)
        if (hit.length) why.push('on an opening (window or door at ' + hit.map((q) => r1(q.x0) + ' to ' + r1(q.x1) + ' m from the end of the wall, from ' + r1(q.y0) + ' to ' + r1(q.y1) + ' m high').join(', ') + '; wall of ' + r1(W.len) + ' m placed at (' + r1(W.ox) + ', ' + r1(W.oz) + '), from ' + r1(W.y0) + ' to ' + r1(W.y1) + ' m)');
        if (u0 < 0.05 || u1 > W.len - 0.05) why.push('sticks out of the wall or touches its end (' + r1(u0) + ' to ' + r1(u1) + ' m, wall of ' + r1(W.len) + ' m)');
        // centering: the empty wall space around it, at its height, between openings and wall ends
        const band = W.ops.filter((q) => v1 > q.y0 && v0 < q.y1), left = Math.max(0, ...band.filter((q) => q.x1 <= u0 + 0.05).map((q) => q.x1)), right = Math.min(W.len, ...band.filter((q) => q.x0 >= u1 - 0.05).map((q) => q.x0)), off = Math.abs(uc - (left + right) / 2);
        if (right - left < 3.5 && off > 0.3 && !hit.length) why.push('not centered in its wall panel (' + r1(off) + ' m offset, panel of ' + r1(right - left) + ' m between ' + r1(left) + ' and ' + r1(right) + ')');
      }
      if (why.length) out.decalsBad.push({ posterDecal: 'no. ' + d.i + ' (' + c.map(r1).join(', ') + ') facing (' + r1(d.N[0]) + ', ' + r1(d.N[2]) + ') ' + zone(c[0], c[2]) + ' by ' + d.fn, defects: why.concat(W && !why.some((w) => /wall of/.test(w)) ? ['(facade wall of ' + r1(W.len) + ' m placed at (' + r1(W.ox) + ', ' + r1(W.oz) + '))'] : []) });
    }
    // 6. bikes (tipping props): the frame, from wheel to wheel at mid-height, outside the walls
    for (const b of PHYS.bodies) {
      if (b.pooled || !b.d.topple) continue;
      propRot(b); const R = b.R, ax = [R[2], R[5], R[8]];
      const inWall = [-0.5, -0.25, 0, 0.25, 0.5].some((t) => inSolid([b.p.x + ax[0] * t, gy0(b.p.x, b.p.z) + 0.5, b.p.z + ax[2] * t]));
      if (inWall) out.bikesBad.push({ bikeProp: b.d.type + ' (' + r1(b.origin.x) + ', ' + r1(b.origin.z) + ') ' + zone(b.origin.x, b.origin.z), defects: ['the frame enters a wall'] });
    }
    // 7. heads of the suspension bridges: 5 m in the extension, bridge width plus 0.5 m on each side, nothing taller than 0.5 m (the posts
    //    of the bridges, at the corners of the heads, do not count)
    const BR = typeof BRIDGES !== 'undefined' ? BRIDGES : []; // (an older version of the game, PAGE=..., has no bridge registry)
    const posts = BR.flatMap((b) => [b.a0 - 0.35, b.a1 + 0.35].flatMap((a) => [-1, 1].map((sd) => (b.axis === 'z' ? [b.c + sd * (b.w / 2 + 0.16), a] : [a, b.c + sd * (b.w / 2 + 0.16)]))));
    const isPost = (c) => posts.some(([x, z]) => Math.abs((c.x0 + c.x1) / 2 - x) < 0.05 && Math.abs((c.z0 + c.z1) / 2 - z) < 0.05);
    for (const b of BR) for (const end of [0, 1]) {
      const e = end ? b.a1 : b.a0, sg = end ? 1 : -1, lo = Math.min(e, e + sg * 5), hi = Math.max(e, e + sg * 5), u0 = b.c - b.w / 2 - 0.5, u1 = b.c + b.w / 2 + 0.5;
      const [x0, x1, z0, z1] = b.axis === 'z' ? [u0, u1, lo, hi] : [lo, hi, u0, u1], hits = new Set();
      for (const c of COL) {
        if (c.ray || c.inv || c.y1 <= 0.5 || c.y0 >= 2 || c.x1 <= x0 || c.x0 >= x1 || c.z1 <= z0 || c.z0 >= z1 || isPost(c)) continue;
        const p = PL.find((q) => q.x >= c.x0 - 0.6 && q.x <= c.x1 + 0.6 && q.z >= c.z0 - 0.6 && q.z <= c.z1 + 0.6);
        hits.add((c.prop ? 'prop ' + c.prop.d.type : p ? 'placed ' + p.n + ' by ' + p.fn : 'scenery') + ' (' + [c.x0, c.x1, c.z0, c.z1].map(r1).join(', ') + ', top at ' + r1(c.y1) + ' m)');
      }
      for (const r of RAMPS) if (r.x1 > x0 && r.x0 < x1 && r.z1 > z0 && r.z0 < z1) hits.add('ramp (' + [r.x0, r.x1, r.z0, r.z1].map(r1).join(', ') + ')');
      out.heads++;
      if (hits.size) out.headsBlocked.push({ head: 'bridge ' + b.axis + ' = ' + r1(b.c) + ' from ' + r1(b.a0) + ' to ' + r1(b.a1) + ', end ' + r1(e) + ' ' + zone((x0 + x1) / 2, (z0 + z1) / 2), inFront: [...hits] });
    }
    // 8. relief map: a placed object (prefab) must neither enter the sand (a vertex more than 15 cm above its foot, under the
    //    sand by more than 8 cm) nor float (a vertex of its foot more than 25 cm above the sand); rocks, trees, reeds and grasses
    //    excepted (a rock sinks in, a trunk grows into the slope)
    if (RELIEF.on) {
      const skip = /^(smRock|smScree|palm|smPalmFar|smReeds|cyGrass|cyBush|smAcacia|tree|bush)/i; // (scree and bushes of Sirocco: rocks and grasses)
      for (const u of PUTS) {
        if (skip.test(u.pf.name)) continue;
        const e = u.m, upright = e[5] / Math.hypot(e[4], e[5], e[6]) > 0.9; let deep = 0, nDeep = 0, high = 0, nHigh = 0, nBase = 0; // a lying object has no foot anymore
        for (const part of u.pf.parts.values()) {
          const Pp = part.g.P;
          for (let i = 0; i < part.g.nv; i++) {
            const x = Pp[i * 3], y = Pp[i * 3 + 1], z = Pp[i * 3 + 2], wx = e[0] * x + e[4] * y + e[8] * z + e[12], wy = e[1] * x + e[5] * y + e[9] * z + e[13], wz = e[2] * x + e[6] * y + e[10] * z + e[14], g = gy0(wx, wz);
            if (y > 0.15 && g - wy > 0.08) { nDeep++; deep = Math.max(deep, g - wy); }
            if (y < 0.03 && upright) { nBase++; const sup = Math.max(g, groundHeight(wx, wz, wy - STEP + 0.05, 0.05)); if (wy - sup > 0.25) { nHigh++; high = Math.max(high, wy - sup); } } // support: the sand or a floor
          }
        }
        const why = [];
        if (nDeep) why.push(nDeep + ' vertices in the sand, up to ' + r1(deep) + ' m');
        if (nHigh > nBase * 0.25) why.push('in the air: ' + nHigh + ' foot vertices out of ' + nBase + ', up to ' + r1(high) + ' m');
        if (why.length) out.sand.push({ objectDesc: u.pf.name + ' (' + r1(e[12]) + ', ' + r1(e[14]) + ') ' + zone(e[12], e[14]) + ' by ' + u.fn, defects: why });
      }
    }
    // 9. all maps: two things do not overlap (the boxes of a placed object or a prop inside those of another construction or
    //    another object, a tarp pole that goes through something)
    {
      const label = new Map(); for (const u of PUTS) label.set(u.id, 'placed ' + u.pf.name + ' (' + r1(u.m[12]) + ', ' + r1(u.m[14]) + ') by ' + u.fn);
      const putIds = new Set(PUTS.map((u) => u.id)), boxes = COL.filter((c) => !c.ray && !c.inv), grid = new Map(), key = (i, j) => i + ',' + j;
      for (const c of boxes) for (let i = Math.floor(c.x0 / 4); i <= Math.floor(c.x1 / 4); i++) for (let j = Math.floor(c.z0 / 4); j <= Math.floor(c.z1 / 4); j++) { const k = key(i, j); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(c); }
      const who = (c) => (c.prop ? 'prop ' + c.prop.d.type + ' (' + r1(c.prop.origin.x) + ', ' + r1(c.prop.origin.z) + ')' : label.get(c.own) || 'scenery of ' + (c.ownFn || '?') + ' (' + r1((c.x0 + c.x1) / 2) + ', ' + r1((c.z0 + c.z1) / 2) + ')');
      const idOf = (c) => (c.prop ? 'p' + PHYS.bodies.indexOf(c.prop) : 'o' + c.own), pairs = new Map();
      for (const a of boxes) {
        if (!a.prop && !putIds.has(a.own)) continue;
        const seen = new Set();
        for (let i = Math.floor(a.x0 / 4); i <= Math.floor(a.x1 / 4); i++) for (let j = Math.floor(a.z0 / 4); j <= Math.floor(a.z1 / 4); j++) for (const b of grid.get(key(i, j)) || []) {
          if (b === a || seen.has(b)) continue; seen.add(b);
          if (idOf(a) === idOf(b)) continue;
          const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0), oz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
          if (ox <= 0.08 || oy <= 0.08 || oz <= 0.08) continue;
          const k = [idOf(a), idOf(b)].sort().join('|');
          if (!pairs.has(k)) pairs.set(k, { a: who(a), b: who(b), at: zone((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2), d: 0 });
          const p = pairs.get(k); p.d = Math.max(p.d, Math.min(ox, oz));
        }
      }
      for (const p of pairs.values()) out.overlaps.push({ things: p.a + ' and ' + p.b + ' ' + p.at, overlap: r1(p.d) });
      // a tarp pole goes through neither an object, nor a construction, nor a prop
      for (const q of POLES) {
        const hit = (grid.get(key(Math.floor(q.x / 4), Math.floor(q.z / 4))) || []).find((c) => c.own !== q.own && q.x > c.x0 - 0.04 && q.x < c.x1 + 0.04 && q.z > c.z0 - 0.04 && q.z < c.z1 + 0.04 && c.y1 > q.y0 + 0.1 && c.y0 < q.y1 - 0.1);
        if (hit) out.overlaps.push({ things: 'tarp pole (' + r1(q.x) + ', ' + r1(q.z) + ') by ' + q.fn + ' and ' + who(hit) + ' ' + zone(q.x, q.z), overlap: 'through' });
      }
    }
    return out;
  }, map);
  await browser.close();
  if (json) { console.log(JSON.stringify(R, null, 1)); }
  else {
    console.log(`${R.doors} doors, ${R.placed} placed objects tracked`);
    for (const d of R.doorBlocked) console.log('BLOCKED DOOR: ' + d.doorway + ': ' + d.inFront.join('; '));
    for (const p of R.potsBad) console.log('POT: ' + p.pot + ': ' + p.defects.join('; '));
    for (const t of R.trees) console.log('TREE: ' + t.treeItem + (t.defects.length ? ': ' + t.defects.join('; ') : ''));
    for (const s of R.stairs) console.log('STAIRS: ' + s.stairway + (s.defects.length ? ': ' + s.defects.join('; ') : ''));
    for (const d of R.decalsBad) console.log('POSTER: ' + d.posterDecal + ': ' + d.defects.join('; '));
    for (const v of R.bikesBad) console.log('BIKE: ' + v.bikeProp + ': ' + v.defects.join('; '));
    for (const h of R.headsBlocked) console.log('BRIDGE HEAD: ' + h.head + ': ' + h.inFront.join('; '));
    for (const o of R.sand) console.log('SAND: ' + o.objectDesc + ': ' + o.defects.join('; '));
    for (const o of R.overlaps) console.log('OVERLAP: ' + o.things + ': ' + o.overlap + (o.overlap === 'through' ? '' : ' m'));
    if (R.heads) console.log(`${R.heads} bridge heads checked`);
    if (R.decals) console.log(`${R.decals} posters and wall panels checked`);
    if (itemList) for (const d of R.all) console.log(`POSTER no. ${d.i} (${d.kit}) at (${d.c.join(', ')}) facing (${d.N.join(', ')})`);
  }
  const bad = R.doorBlocked.length + R.potsBad.filter((p) => p.defects.some((d) => /sunk into|in the air/.test(d))).length + R.decalsBad.length + R.bikesBad.length + R.headsBlocked.length + R.sand.length + R.overlaps.length;
  if (bad) { console.error(`FAIL: ${bad} door(s) obstructed, planter(s) sunk or in the air, poster(s) floating, bike(s) in a wall, bridge head(s) cluttered, object(s) in the sand or in the air, overlap(s)`); process.exit(1); }
  console.log('scenery: doors clear, planters placed, posters on their wall, bikes free, bridge heads clear, no overlaps' + (R.relief ? ', objects placed on the sand' : ''));
})();
