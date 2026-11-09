/* ==========================================================================
   CYCLADIC KIT (2/4): the whitewashed town. A plan on a 2 m grid (one string per row) gives the houses; the
   generator splits them into houses 4 to 8 m wide, sets their height, draws only the walls that can be seen (the bottom of a wall
   hidden by a taller neighboring house does not exist), pierces each facade with small blue-shuttered windows and
   painted doors, crowns the roofs with a rounded parapet and leaves the flat roofs walkable for anyone who climbs up by
   an outside staircase. Collisions are solid boxes: the scenery can be as fine as you like.
   Grid characters: . street or square | 1 one-story house | 2 two-story house | 3 three-story house
   (the map's perimeter) | t walkable flat roof | a covered arch (passage under a house) | k small building
   (oven, fountain, shed: see 02yd) | X reserved (church, cafe, mill...: placed by hand).
   ========================================================================== */
const CYP = {
  // joinery paints: island blue first
  paint: [[0.07, 0.3, 0.62], [0.07, 0.3, 0.62], [0.07, 0.3, 0.62], [0.07, 0.3, 0.62], [0.05, 0.2, 0.45], [0.05, 0.2, 0.45], [0.1, 0.55, 0.6], [0.16, 0.42, 0.34], [0.62, 0.17, 0.12], [0.85, 0.62, 0.2]],
  wash: [[0.97, 0.96, 0.93], [0.97, 0.96, 0.93], [0.97, 0.96, 0.93], [0.96, 0.95, 0.91], [0.95, 0.94, 0.9], [0.98, 0.97, 0.95], [0.94, 0.88, 0.72], [0.82, 0.89, 0.95], [0.95, 0.85, 0.8]],
  frame: [[0.95, 0.95, 0.93], [0.07, 0.3, 0.62], [0.95, 0.95, 0.93]],
  stone: [0.9, 0.88, 0.83],
};
const CY_FLOOR = 3.3;
const CY_H = { 1: 3.4, 2: 6.6, 3: 9.9, t: 3.4, a: 6.4, k: 3.0, X: 4.0 };
const CY_ARCH_Y = 2.7; // under an arch: clearance

/* Grid plan: rows = rows of the south half (z from 0 to +48), the north half is its mirror. Returns a reader object
   { W, H, x0, z0, c, at(i, k) }: the cell's character (i: column, k: row from north to south). Beyond the grid:
   a ring of three-story houses to the east and at both ends (the perimeter), the sea to the west. */
function cyPlan(rows, x0 = -30, z0 = -48, c = 2) {
  const W = rows[0].length, H = rows.length * 2, G = [];
  for (let k = 0; k < H; k++) G.push(k < rows.length ? rows[rows.length - 1 - k] : rows[k - rows.length]);
  const P = { W, H, x0, z0, c, G };
  P.at = (i, k) => (i < 0 ? '~' : i >= W || k < 0 || k >= H ? '3' : G[k][i]);
  P.ix = (x) => Math.floor((x - x0) / c); P.kz = (z) => Math.floor((z - z0) / c);
  P.cx = (i) => x0 + i * c; P.cz = (k) => z0 + k * c;
  return P;
}
const cyIsBuilding = (ch) => ch === '1' || ch === '2' || ch === '3' || ch === 't' || ch === 'a' || ch === 'k' || ch === 'X';

/* Splits a number of cells into houses of 2 to 4 cells */
function cySplit(n, R) {
  const out = []; let rem = n;
  while (rem > 4) { const t = R.pick(rem === 5 ? [2, 3] : rem === 6 ? [2, 3, 4] : [2, 3, 4]); out.push(t); rem -= t; }
  if (rem > 0) out.push(rem);
  return out;
}
/* Houses of the plan: rectangles of cells of the same type, split into houses; each carries its height, its tints and its random draw.
   Types a, k and X are full houses in their own right (one per rectangle). */
function cyHouses(P, R) {
  const used = new Uint8Array(P.W * P.H), out = [];
  for (let k = 0; k < P.H; k++) for (let i = 0; i < P.W; i++) {
    const ch = P.G[k][i];
    if (used[k * P.W + i] || !'123takX'.includes(ch) || ch === 'X') continue;
    let w = 1; while (i + w < P.W && P.G[k][i + w] === ch && !used[k * P.W + i + w] && (ch === 'a' ? w < 2 : true)) w++;
    let h = 1; while (k + h < P.H) { let ok = true; for (let q = 0; q < w; q++) if (P.G[k + h][i + q] !== ch || used[(k + h) * P.W + i + q]) { ok = false; break; } if (!ok) break; h++; }
    for (let b = 0; b < h; b++) for (let a = 0; a < w; a++) used[(k + b) * P.W + i + a] = 1;
    // split along the longest dimension (except arches and small buildings)
    const alongX = w >= h, L = alongX ? w : h, parts = ch === 'a' || ch === 'k' ? [L] : cySplit(L, R);
    let p = 0;
    for (const n of parts) {
      const hs = ch === '1' ? R.pick([3.2, 3.4, 3.6]) : ch === '2' ? R.pick([6.4, 6.6, 6.9]) : ch === '3' ? R.pick([9.6, 9.9, 10.2]) : CY_H[ch];
      const [ia, ib, ka, kb] = alongX ? [i + p, i + p + n, k, k + h] : [i, i + w, k + p, k + p + n];
      out.push({ ch, i0: ia, i1: ib, k0: ka, k1: kb, x0: P.cx(ia), x1: P.cx(ib), z0: P.cz(ka), z1: P.cz(kb), h: hs });
      p += n;
    }
  }
  // the perimeter: a band of three-story houses against the east and at both ends, facing inward
  const ring = [[P.W, P.W + 1, -1, P.H + 1, false], [0, P.W, -1, 0, true], [0, P.W, P.H, P.H + 1, true]];
  for (const [ia, ib, ka, kb, alongX] of ring) {
    const L = alongX ? ib - ia : kb - ka; let p = 0;
    for (const n of cySplit(L, R)) {
      const [i0, i1, k0, k1] = alongX ? [ia + p, ia + p + n, ka, kb] : [ia, ib, ka + p, ka + p + n];
      out.push({ ch: '3', ring: true, i0, i1, k0, k1, x0: P.cx(i0), x1: P.cx(i1), z0: P.cz(k0), z1: P.cz(k1), h: R.pick([9.6, 9.9, 10.2]) });
      p += n;
    }
  }
  // actual height of each perimeter cell (cyRingHeightAt)
  P.ringH = new Map();
  for (const h of out) if (h.ring) for (let k = h.k0; k < h.k1; k++) for (let i = h.i0; i < h.i1; i++) P.ringH.set(i + ',' + k, h.h);
  // height per cell (reserved buildings count at their default height or the one the map gives)
  P.hmap = new Float32Array(P.W * P.H);
  for (const h of out) if (!h.ring) for (let k = h.k0; k < h.k1; k++) for (let i = h.i0; i < h.i1; i++) P.hmap[k * P.W + i] = h.h;
  for (let k = 0; k < P.H; k++) for (let i = 0; i < P.W; i++) if (P.G[k][i] === 'X') P.hmap[k * P.W + i] = (P.xh && P.xh[`${i},${k}`]) || CY_H.X;
  return out;
}
/* Height of what is in the neighboring cell (0: nothing, the street). Beyond the grid: the perimeter. */
function cyHeightAt(P, i, k) {
  if (i < 0) return 0;
  if (i >= P.W || k < 0 || k >= P.H) return CY_H[3];
  return P.hmap[k * P.W + i];
}
/* Height of a cell as seen from the perimeter: that of the perimeter house occupying it, 0 beyond (the outside, the sea). cyHeightAt counts everything
   beyond the grid at the perimeter's default height: the perimeter houses had neither an outer wall nor a correct joint between them. */
function cyRingHeightAt(P, i, k) {
  if (i >= 0 && i < P.W && k >= 0 && k < P.H) return P.hmap[k * P.W + i];
  return (P.ringH && P.ringH.get(i + ',' + k)) || 0;
}
/* Visible parts of the wall of a house of height H against a neighboring cell of height hn (and type ch): intervals [ya, yb] */
function cyExposure(H, hn, ch) {
  if (ch === 'a') return H > hn ? [[hn, H]] : [];
  return hn >= H ? [] : [[hn, H]];
}

/* Frame of a wall section [a0, a1] (world meters along the wall) facing face, whose plane is at fixed */
function cyRunFrame(face, fixed, a0, a1) {
  if (face === 's') return { ox: a0, oz: fixed, rot: 0, len: a1 - a0 };
  if (face === 'n') return { ox: a1, oz: fixed, rot: Math.PI, len: a1 - a0 };
  if (face === 'e') return { ox: fixed, oz: a1, rot: Math.PI / 2, len: a1 - a0 };
  return { ox: fixed, oz: a0, rot: -Math.PI / 2, len: a1 - a0 };
}

/* ---------- Doors ---------- */
/* Registry of the village's doors (world: center x, z, outward normal nx, nz, width w): used to keep the area in front of them clear
   (tools/dev/visual/decor.js). Reset and released with the map (notosLevel, MAP_DEFS.notos.unload). */
function cyDoorMark(x, z, nx, nz, w, kind) { if (CYC.doors) CYC.doors.push({ x, z, nx, nz, w, kind }); }
/* Is (x, z), of radius r, outside the 2 m corridor in front of each door (a tree, a bench, a table, a bale of straw must not block the entrance there)? */
function cyDoorClear(x, z, r = 0.4, depth = 2.0) {
  for (const D of CYC.doors || []) {
    const dx = x - D.x, dz = z - D.z, d = dx * D.nx + dz * D.nz, a = -dx * D.nz + dz * D.nx;
    if (d > -r && d < depth + r && Math.abs(a) < D.w / 2 + 0.3 + r) return false;
  }
  return true;
}
/* Nearest free position to (x, z) (in rings of 0.3 m up to 'reach' m): outside the area in front of doors; null if there is none */
function cyClearSpot(x, z, r = 0.4, reach = 3, ok, depth = 2.0) {
  for (let k = 0; k <= reach / 0.3; k++) for (let i = 0; i < (k ? 12 : 1); i++) {
    const a = (i / 12) * TAU, px = x + Math.cos(a) * k * 0.3, pz = z + Math.sin(a) * k * 0.3;
    if (cyDoorClear(px, pz, r, depth) && (!ok || ok(px, pz))) return [px, pz];
  }
  return null;
}
/* Is (x, z) inside a solid wall of the zone, or within m of one? */
function cyNearWall(x, z, m = 0) { for (const c of cyWalls()) if (x > c.x0 - m && x < c.x1 + m && z > c.z0 - m && z < c.z1 + m) return true; return false; }
/* Walls and low walls of the zone (volumes at least 1.5 m long and 0.9 m high), taken from the collisions already placed */
let _cyWalls = null, _cyWallsN = -1;
function cyWalls() {
  if (_cyWallsN !== COL.length) { _cyWalls = COL.filter((c) => !c.ray && !c.inv && !c.prop && c.y1 > 0.9 && c.y0 < 0.4 && Math.max(c.x1 - c.x0, c.z1 - c.z0) >= 1.5); _cyWallsN = COL.length; }
  return _cyWalls;
}
/* Distance from (x, z) to the first solid wall in direction (dx, dz), up to max m */
function cyWallDist(x, z, dx, dz, max = 3) {
  const W = cyWalls();
  for (let d = 0.05; d <= max; d += 0.05) { const px = x + dx * d, pz = z + dz * d; for (const c of W) if (px >= c.x0 && px <= c.x1 && pz >= c.z0 && pz <= c.z1) return d; }
  return max;
}
/* Brings (x, z) against the nearest wall (in the 4 directions, up to 'reach' m), at 'off' m from its face: a pot or a planter is set at the foot of a wall, never in the middle of an alley.
   Returns { x, z, ry (back to the wall), w (free width between walls, along the axis of the nearest wall) } or null */
function cyWallSpot(x, z, off = 0.3, reach = 1.6) {
  let best = null;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const d = cyWallDist(x, z, dx, dz, reach); if (d < reach && (!best || d < best.d)) best = { d, dx, dz }; }
  if (!best) return null;
  const k = best.d - off, back = cyWallDist(x, z, -best.dx, -best.dz, 6);
  return { x: x + best.dx * k, z: z + best.dz * k, ry: Math.atan2(-best.dx, -best.dz), w: best.d + back };
}

/* ---------- Facades ---------- */
/* Facade section: wall from ya to yb (H: height of the house), pierced with small windows and, on the ground floor, a door.
   o: R (random draw), tint, paint (joinery), frame, door (index of the door's bay, -1: none), plain (blind wall), arch (street arch) */
function cyRun(F, ya, yb, H, o) {
  const len = F.len, R = o.R, ops = [], after = [], nb = Math.max(1, Math.round(len / 2.9)), bw = len / nb, floors = H > 5 ? [0, H / 2] : [0], fh = H > 5 ? H / 2 : H;
  if (!o.plain && len >= 1.3) for (const fy of floors) {
    if (yb < fy + 2.2 || ya > fy + 0.95) continue; // the upper floor is not visible enough on this section
    for (let i = 0; i < nb; i++) {
      const a = bw * (i + 0.5), ground = fy === 0;
      if (ground && i === o.door) {
        const dw = 1.0, arch = R() < 0.35, op = { x0: a - dw / 2, x1: a + dw / 2, y0: 0, y1: arch ? 2.45 : 2.2, depth: 0.3, rise: arch ? 0.4 : 0, back: true };
        if (op.x0 < 0.25 || op.x1 > len - 0.25) continue;
        const wx = F.ox + a * Math.cos(F.rot), wz = F.oz - a * Math.sin(F.rot);
        if ((CYC.noDoor || []).some((q) => wx > q[0] && wx < q[1] && wz > q[2] && wz < q[3])) continue; // no door at the foot of a staircase or under its landing
        ops.push(op);
        cyDoorMark(wx, wz, Math.sin(F.rot), Math.cos(F.rot), dw, 'house');
        const dc = R.pick(CYC.paintAt ? CYC.paintAt(wz) : CYP.paint); // door color: that of the map's side if it has one (a single draw, as before)
        after.push((M) => {
          panelDoor(M, op, 0.3, dc, { glazed: !arch && R() < 0.35 });
          casing(M, op, [0.96, 0.95, 0.92], 'limewash', 0.09);
          if (R() < 0.45) wallLamp(M, a + 0.95 > len - 0.3 ? a - 0.95 : a + 0.95, 2.35);
          if (R() < 0.5) M.dyn('pot', a + (R() < 0.5 ? -0.85 : 0.85), 0.0, 0.3, R() * TAU);
        });
        continue;
      }
      if (R() < (ground ? 0.5 : 0.76)) {
        const ww = Math.min(bw - 0.7, R.pick([0.8, 0.9, 0.9, 1.05])), wh = R.pick([1.1, 1.2, 1.3]), y0 = fy + (ground ? 1.0 : 0.9);
        if (ww < 0.55 || a - ww / 2 < 0.3 || a + ww / 2 > len - 0.3) continue;
        if (y0 < ya + 0.05 || y0 + wh > yb - 0.2) continue;
        if (ground && (CYC.noWin || []).some((q) => { const wx = F.ox + a * Math.cos(F.rot), wz = F.oz - a * Math.sin(F.rot); return wx > q[0] && wx < q[1] && wz > q[2] && wz < q[3]; })) continue; // the flight or its landing eats the window: solid wall
        const arch = R() < 0.18, op = { x0: a - ww / 2, x1: a + ww / 2, y0, y1: y0 + wh, depth: 0.28, rise: arch ? 0.28 : 0, back: true };
        ops.push(op);
        const st = arch ? null : R.pick(['open', 'open', 'ajar', 'closed', null]), pc = o.paint, lit = R() < 0.25;
        after.push((M) => {
          if (st !== 'closed') windowJoinery(M, op, 0.28, o.frame, { glass: lit ? 'glassLit' : 'glass', curtain: R() < 0.3 ? [0.92, 0.9, 0.84] : null });
          M.save().color([0.96, 0.95, 0.92]); sill(M, op, 'limewash', [0.96, 0.95, 0.92]); M.restore();
          if (st) shutters(M, op, pc, st, R);
          else if (arch) { M.save().color(pc).local(1); casing(M, op, pc, 'paintwood', 0.07); M.restore(); }
          if (ground && R() < 0.3) grille(M, op);
          if (R() < 0.14) M.dyn('pot', a + (R() - 0.5) * 0.3, op.y0 + 0.02, 0.1, R() * TAU);
        });
      }
    }
  }
  inFrame(F, (M) => {
    M.save().color(o.tint).world(1); M.aoFn = (x, y) => lerp(0.8, 1, smoothstep(0, 1.4, y));
    wallPierced(M, o.mat || 'limewash', len, ya, yb - ya, ops, { depth: 0.28 });
    M.restore();
    for (const fn of after) fn(M);
    // whitewash band at the foot of the wall, streaks, details
    if (ya < 0.05 && len > 1.4) {
      if (R() < 0.35) { M.save().color([0.55, 0.6, 0.66]).world(1); const ps = ops.filter((p) => p.y0 < 0.6).sort((p, q) => p.x0 - q.x0); let cur = 0; const seg = (a, b) => { if (b - a > 0.2) M.boxB('limewash', a, b, 0, 0.35, -0.01, 0.03, { skip: 'z' }); }; for (const p of ps) { seg(cur, p.x0); cur = p.x1; } seg(cur, len); M.restore(); }
      if (o.climber && len > 2.2) { const x = 0.6 + R() * (len - 1.2); if (!ops.some((p) => x > p.x0 - 0.8 && x < p.x1 + 0.8)) M.place(PF.cyClimber(R.pick(['bougain', 'bougain', 'bougain', 'jasmine', 'vine', 'ivy']), R.range(1.6, 2.4), R.range(2.0, 3.0)), x, 0, 0.02, 0); }
      if (R() < 0.18 && len > 2.0) { const x = 0.7 + R() * (len - 1.4); if (!ops.some((p) => x > p.x0 - 0.5 && x < p.x1 + 0.5)) cyWallDecal(M, R() < 0.5 ? CYD.mati : CYD.numero, x, 1.5 + R() * 0.3, 0.45, 0.45); }
    }
    if (o.sign) cySignBoard(M, o.sign.x, o.sign.y, o.sign.w, o.sign.h, o.sign.i, o.sign.frame);
  });
}

/* ---------- Roofs ---------- */
/* Flat roof of a house: whitewash surface (or paving slabs if walkable), rounded parapet on the exposed edges, fixtures.
   top: { n, s, e, w } segments [a0, a1] (world) where the edge overlooks the street or a lower roof; o.walk: walkable; o.gaps: parapet openings;
   o.hole: stairwell opening [x0, x1, z0, z1] without slab */
function cyRoof(h, top, o) {
  const { x0, x1, z0, z1, h: y } = h, M = DECOR, R = o.R, walk = !!o.walk, ph = walk ? 1.05 : R.range(0.35, 0.6), t = walk ? 0.3 : 0.22, tint = h.tint;
  M.save().color(walk ? [0.93, 0.92, 0.89] : [0.96, 0.95, 0.92]).world(1); M.cls = 0;
  const slab = (a0, a1, b0, b1) => { if (a1 - a0 > 0.01 && b1 - b0 > 0.01) M.quad(walk ? 'slab' : 'limewash', [a0, y, b0], [a1, y, b0], [a1, y, b1], [a0, y, b1], [0, 1, 0]); };
  if (o.hole) { // opening of an interior staircase: [x0, x1, z0, z1]; the slab surrounds it
    const [hx0, hx1, hz0, hz1] = o.hole;
    slab(x0, hx0, z0, z1); slab(hx0, x1, z0, hz0); slab(hx0, x1, hz1, z1); slab(hx1, x1, hz0, hz1);
  } else slab(x0, x1, z0, z1);
  M.restore();
  const gaps = o.gaps || [];
  const cut = (side, a0, a1) => { // subtracts the openings
    let segs = [[a0, a1]];
    for (const g of gaps) if (g.side === side) segs = segs.flatMap(([p, q]) => (g.a1 <= p || g.a0 >= q ? [[p, q]] : [[p, g.a0], [g.a1, q]].filter(([u, v]) => v - u > 0.05)));
    return segs;
  };
  const has = (side) => (top[side] || []).length > 0;
  const par = (bx0, bx1, bz0, bz1) => {
    M.save().color(tint).world(1); M.boxB('limewash', bx0, bx1, y, y + ph, bz0, bz1, { skip: 'y' }); M.restore();
    M.save().color([0.97, 0.96, 0.94]).local(1); M.boxB('limewash', bx0 - 0.03, bx1 + 0.03, y + ph, y + ph + 0.07, bz0 - 0.03, bz1 + 0.03, { bevel: 0.03 }); M.restore();
    if (walk) DECOR.col(bx0, bx1, y, y + ph + 0.05, bz0, bz1, 'concrete');
  };
  for (const [side, list] of Object.entries(top)) for (const [a, b] of list) for (const [p, q] of cut(side, a, b)) {
    if (side === 'n') par(p, q, z0, z0 + t); else if (side === 's') par(p, q, z1 - t, z1);
    else { const pa = p + (p <= z0 + 1e-3 && has('n') ? t : 0), qa = q - (q >= z1 - 1e-3 && has('s') ? t : 0); if (qa - pa > 0.05) { if (side === 'w') par(x0, x0 + t, pa, qa); else par(x1 - t, x1, pa, qa); } }
  }
  // drainage gargoyles
  if (!walk && R() < 0.5) { M.save().color([0.62, 0.6, 0.56]); M.cls = 1; const sd = R.pick(['n', 's']); if (has(sd)) { const x = lerp(x0, x1, R.range(0.25, 0.75)); M.boxB('steel', x - 0.06, x + 0.06, y + 0.08, y + 0.16, sd === 'n' ? z0 - 0.3 : z1, sd === 'n' ? z0 : z1 + 0.3); } M.restore(); }
  // fixtures: black cistern, solar water heater, antenna, white chimney, flower pot; never on a walkable roof (which has its own cover)
  if (!walk && (x1 - x0) * (z1 - z0) >= 12) {
    const n = 1 + (R() < 0.55 ? 1 : 0);
    for (let q = 0; q < n; q++) {
      const px = lerp(x0 + 1.3, x1 - 1.3, R()), pz = lerp(z0 + 1.3, z1 - 1.3, R()), r = R(); // 1.3 m from the edges: the water heater (2.1 m) touched the parapet
      if (r < 0.3) M.place(PF.waterTank(), px, y + 0.02, pz, R() * TAU, { tint: { plastic: R.pick([[0.12, 0.12, 0.13], [0.2, 0.25, 0.3], [0.9, 0.9, 0.88]]) }, nocol: true });
      else if (r < 0.55) M.place(PF.solarHeater(), px, y + 0.02, pz, R.pick([0, Math.PI / 2, Math.PI]), { nocol: true });
      else if (r < 0.72) M.place(PF.antenna(), px, y + 0.02, pz, R() * TAU, { nocol: true, cls: 1 });
      else if (r < 0.9) { M.save().color([0.97, 0.96, 0.94]).world(1); M.boxB('limewash', px - 0.3, px + 0.3, y, y + 1.0, pz - 0.3, pz + 0.3, { bevel: 0.04 }); M.boxB('limewash', px - 0.4, px + 0.4, y + 1.0, y + 1.1, pz - 0.4, pz + 0.4, { bevel: 0.03 }); M.restore(); }
    }
  }
}

/* ---------- The town ---------- */
/* Builds all the houses of plan P. o: R (random draw), special: (house, face) => specific options (signs...), walkable: (house) => parapet openings. Returns the list of houses. */
function cyBuildTown(P, o) {
  const R = o.R, houses = cyHouses(P, R), M = DECOR;
  for (const h of houses) {
    const Rh = rngOf(Math.round(h.x0 * 131 + h.z0 * 37 + h.h * 11) + 4001), walk = h.ch === 't', arch = h.ch === 'a';
    if (h.ch === 'k') { cySmall(h, Rh); continue; } // small building (oven, fountain, shed): 02yd
    h.R = Rh; h.walk = walk; h.tint = o.tint ? o.tint(h, Rh) : Rh.pick(CYP.wash);
    h.paint = o.paintOf ? o.paintOf(h, Rh) : Rh.pick(CYP.paint); h.frame = Rh.pick(CYP.frame);
    // volume: solid, or above a passage for an arch
    if (arch) DECOR.col(h.x0, h.x1, CY_ARCH_Y, h.h, h.z0, h.z1, 'concrete'); else DECOR.col(h.x0, h.x1, 0, h.h, h.z0, h.z1, 'concrete');
    // edge by edge: exposed sections
    const top = { n: [], s: [], e: [], w: [] }, faces = [], outer = [];
    const edge = (face, cells, ni, nk, fixed, along) => {
      const runs = [], more = [];
      const push = (L, ya, yb, a) => {
        const key = ya.toFixed(2) + '|' + yb.toFixed(2), last = L[L.length - 1];
        if (last && last.key === key && Math.abs(last.a1 - a) < 1e-6) last.a1 = a + P.c; else L.push({ key, ya, yb, a0: a, a1: a + P.c });
      };
      for (const c of cells) {
        const a = along(c), nbr = [ni(c), nk(c)], ch = P.at(nbr[0], nbr[1]), hn = cyHeightAt(P, nbr[0], nbr[1]);
        const ex = cyExposure(h.h, ch === '~' ? h.h : hn, ch);
        // perimeter: the outside (beyond the grid and the perimeter, sea included) and the joint with the neighboring perimeter house count at their
        // true height. What is thus added to the wall is built separately (cyOuterRun): the facades facing the village keep their draws.
        const hr = h.ring ? cyRingHeightAt(P, nbr[0], nbr[1]) : hn;
        if (hn < h.h - 0.01 || hr < h.h - 0.01 || ch === '.' || ch === '~') top[face].push([a, a + P.c]);
        for (const [ya, yb] of ex) push(runs, ya, yb, a);
        if (h.ring) { const lo = hr, hi = Math.min(h.h, ex.length ? ex[0][0] : h.h); if (hi - lo > 0.01) push(more, lo, hi, a); }
      }
      for (const r of runs) faces.push({ face, fixed, ...r });
      for (const r of more) outer.push({ face, fixed, ...r });
    };
    const ci = [], ck = [];
    for (let i = h.i0; i < h.i1; i++) ci.push(i); for (let k = h.k0; k < h.k1; k++) ck.push(k);
    edge('n', ci, (i) => i, () => h.k0 - 1, h.z0, (i) => P.cx(i));
    edge('s', ci, (i) => i, () => h.k1, h.z1, (i) => P.cx(i));
    edge('w', ck, () => h.i0 - 1, (k) => k, h.x0, (k) => P.cz(k));
    edge('e', ck, () => h.i1, (k) => k, h.x1, (k) => P.cz(k));
    // roof: parapet where the edge overlooks
    for (const s of ['n', 's', 'e', 'w']) top[s] = cyMerge(top[s]);
    h.top = top;
    // facades
    const best = faces.filter((f) => f.ya < 0.05).sort((a, b) => (b.a1 - b.a0) - (a.a1 - a.a0))[0];
    for (const f of faces) {
      const F = cyRunFrame(f.face, f.fixed, f.a0, f.a1), opt = { R: Rh, tint: h.tint, paint: h.paint, frame: h.frame, climber: Rh() < 0.35, door: -1 };
      if (f === best && f.ya < 0.05 && !arch && F.len >= 2.4) opt.door = Math.floor(Rh() * Math.max(1, Math.round(F.len / 2.9)));
      // wall of an arch: the passage opening at both ends of the passage, an ordinary wall on the sides
      if (arch && (h.x1 - h.x0 > h.z1 - h.z0 ? f.face === 'w' || f.face === 'e' : f.face === 'n' || f.face === 's')) { cyArchFace(F, f, h, P, Rh); continue; }
      if (o.special) Object.assign(opt, o.special(h, f, F) || {});
      cyRun(F, f.ya, f.yb, h.h, opt);
    }
    if (outer.length) { const Ro = rngOf(Math.round(h.x0 * 71 + h.z0 * 13 + h.h * 7) + 5003); for (const f of outer) cyOuterRun(cyRunFrame(f.face, f.fixed, f.a0, f.a1), f.ya, f.yb, h.h, { R: Ro, tint: h.tint, paint: h.paint }); }
    cyRoof(h, top, { R: Rh, walk, gaps: o.gaps ? o.gaps(h) : [] });
    if (walk) cyRoofCovers(h, Rh);
  }
  return houses;
}
/* Outer wall of a perimeter house (seen from the aerial view, the hill and the sea, never up close): solid whitewash, flat windows
   (glass, sill, shutters open against the wall), few triangles; o.R: its own random draw */
function cyOuterRun(F, ya, yb, H, o) {
  const len = F.len, R = o.R;
  inFrame(F, (M) => {
    M.save().color(o.tint).world(1); M.aoFn = (x, y) => lerp(0.8, 1, smoothstep(0, 1.4, y));
    wallPierced(M, 'limewash', len, ya, yb - ya, []);
    M.aoFn = null; M.restore();
    if (yb - ya < 2.2 || len < 1.6) return;
    const nb = Math.max(1, Math.round(len / 2.9)), bw = len / nb;
    for (const fy of H > 5 ? [0, H / 2] : [0]) for (let i = 0; i < nb; i++) {
      const a = bw * (i + 0.5), ww = 0.85, wh = R.pick([1.1, 1.2, 1.3]), y0 = fy + (fy === 0 ? 1.0 : 0.9), x0 = a - ww / 2, x1 = a + ww / 2;
      if (R() < 0.3 || y0 < ya + 0.05 || y0 + wh > yb - 0.2) continue;
      M.save().color([0.1, 0.12, 0.14]); M.quad('glass', [x0, y0, 0.012], [x1, y0, 0.012], [x1, y0 + wh, 0.012], [x0, y0 + wh, 0.012], [0, 0, 1]); M.restore();
      M.save().color([0.96, 0.95, 0.92]).world(1); M.boxB('limewash', x0 - 0.08, x1 + 0.08, y0 - 0.08, y0, -0.01, 0.1, { skip: 'z' }); M.restore();
      if (R() < 0.75) { M.save().color(o.paint); M.quad('paintwood', [x0 - ww / 2, y0, 0.02], [x0, y0, 0.02], [x0, y0 + wh, 0.02], [x0 - ww / 2, y0 + wh, 0.02], [0, 0, 1]); M.quad('paintwood', [x1, y0, 0.02], [x1 + ww / 2, y0, 0.02], [x1 + ww / 2, y0 + wh, 0.02], [x1, y0 + wh, 0.02], [0, 0, 1]); M.restore(); }
    }
  });
}
/* Merges contiguous segments [a, b] */
function cyMerge(list) {
  const s = list.slice().sort((p, q) => p[0] - q[0]), out = [];
  for (const [a, b] of s) { const l = out[out.length - 1]; if (l && Math.abs(l[1] - a) < 1e-6) l[1] = b; else out.push([a, b]); }
  return out;
}
/* Face of an arch: the wall above the passage, pierced with a large arch at both ends when the passage crosses the house (the two opposite
   faces open onto the street); the opening receives the jambs and the intrados over half the length of the passage */
function cyArchFace(F, f, h, P, R) {
  const len = F.len, along = f.face === 'n' || f.face === 's' ? h.x1 - h.x0 : h.z1 - h.z0, pass = f.face === 'n' || f.face === 's' ? h.z1 - h.z0 : h.x1 - h.x0;
  const op = { x0: 0.12, x1: len - 0.12, y0: 0, y1: 2.55, depth: pass / 2, rise: 0.5 };
  inFrame(F, (M) => {
    M.save().color(h.tint).world(1); M.aoFn = (x, y) => lerp(0.75, 1, smoothstep(0, 1.4, y));
    wallPierced(M, 'limewash', len, 0, h.h, [op], { depth: pass / 2 });
    M.restore();
    // stone molding around the arch, small window above, plaque
    casing(M, op, [0.95, 0.94, 0.9], 'limewash', 0.14);
    if (h.h > 5.2 && len >= 1.8) { const wop = { x0: len / 2 - 0.4, x1: len / 2 + 0.4, y0: 4.0, y1: 5.2, depth: 0.25, back: true }; windowJoinery(M, wop, 0.25, h.frame, {}); sill(M, wop, 'limewash', [0.96, 0.95, 0.92]); shutters(M, wop, h.paint, 'open', R); }
  });
  void along;
}
/* Walkable flat roof: planters and tubs that serve as low cover, a few pots */
function cyRoofCovers(h, R) {
  const M = DECOR, y = h.h, w = h.x1 - h.x0, d = h.z1 - h.z0;
  if (w < 4 || d < 4) return;
  const n = Math.floor((w * d) / 40);
  for (let q = 0; q < n; q++) {
    const long = R() < 0.5, lw = long ? 1.8 : 0.9, ld = long ? 0.9 : 1.8, px = lerp(h.x0 + 1.4 + lw / 2, h.x1 - 1.4 - lw / 2, R()), pz = lerp(h.z0 + 1.4 + ld / 2, h.z1 - 1.4 - ld / 2, R());
    M.save().color([0.95, 0.94, 0.91]).world(1); M.boxB('limewash', px - lw / 2, px + lw / 2, y, y + 0.85, pz - ld / 2, pz + ld / 2, { bevel: 0.04 }); M.restore();
    DECOR.col(px - lw / 2, px + lw / 2, y, y + 0.85, pz - ld / 2, pz + ld / 2, 'concrete');
    M.place(PF.cyBush(R.range(1.0, 1.3), 1 + Math.floor(R() * 3)), px, y + 0.85, pz, R() * TAU);
  }
}
