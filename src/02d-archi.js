/* ==========================================================================
   ARCHITECTURE KIT: Mediterranean and Maghrebi buildings, reusable on all maps.
   A facade is built in its own frame (facadeFrame): origin at the foot of the wall, on the left seen from
   outside; x along the wall, y upward, z outward. Openings are real holes in
   the wall, with their reveals (depth), then the joinery at the back: glazing and frames, louvered
   shutters, grilles, paneled or arched doors, metal shop shutters. Building collisions
   stay solid boxes: gameplay does not depend on the scenery.
   ========================================================================== */
const PAL = {
  plaster: [[0.95, 0.88, 0.74], [0.9, 0.76, 0.58], [0.97, 0.93, 0.85], [0.84, 0.7, 0.55], [0.86, 0.66, 0.54], [0.78, 0.82, 0.76], [0.76, 0.8, 0.86], [0.92, 0.82, 0.66], [0.93, 0.8, 0.7]],
  shutter: [[0.3, 0.45, 0.38], [0.28, 0.38, 0.52], [0.55, 0.36, 0.22], [0.42, 0.42, 0.38], [0.2, 0.42, 0.55], [0.62, 0.55, 0.4]],
  frame: [[0.92, 0.9, 0.84], [0.35, 0.26, 0.18], [0.28, 0.4, 0.34], [0.86, 0.84, 0.78], [0.45, 0.4, 0.34]],
  door: [[0.12, 0.3, 0.55], [0.18, 0.4, 0.3], [0.42, 0.26, 0.16], [0.55, 0.18, 0.12], [0.16, 0.42, 0.46], [0.75, 0.6, 0.3]],
  awning: [[0.72, 0.24, 0.18], [0.2, 0.42, 0.34], [0.82, 0.7, 0.4], [0.3, 0.36, 0.55], [0.85, 0.85, 0.8], [0.62, 0.3, 0.12]],
  shop: [[0.62, 0.62, 0.6], [0.5, 0.55, 0.5], [0.62, 0.5, 0.42], [0.35, 0.45, 0.55], [0.7, 0.66, 0.55]],
  stone: [0.95, 0.9, 0.82],
};
/* Frame of a facade turned toward face ('n', 's', 'e', 'w') of a block [x0, x1] x [z0, z1] */
function facadeFrame(face, x0, x1, z0, z1) {
  if (face === 's') return { ox: x0, oz: z1, rot: 0, len: x1 - x0 };
  if (face === 'n') return { ox: x1, oz: z0, rot: Math.PI, len: x1 - x0 };
  if (face === 'e') return { ox: x1, oz: z1, rot: Math.PI / 2, len: z1 - z0 };
  return { ox: x0, oz: z0, rot: -Math.PI / 2, len: z1 - z0 };
}
function inFrame(F, fn) { const M = DECOR; M.save().move(F.ox, 0, F.oz).rotY(F.rot); try { fn(M); } finally { M.restore(); } }
/* Small local box by bounds, without collision */
function lbox(M, mat, x0, x1, y0, y1, z0, z1, o) { M.boxB(mat, x0, x1, y0, y1, z0, z1, o); }

/* ---------- Pierced wall and reveals ---------- */
/* Arc subdivision, shared by the spandrels, the intrados and the arched leaf: different segments left thin gaps
   between them, through which the void behind the facade was visible. Must be even (keystone in the middle). */
const ARCH_SEG = 20;
/* Arc of an arched opening: circle through the springings (y1 - rise) and the keystone (y1) */
function archGeom(op) {
  const w = op.x1 - op.x0, rise = Math.min(op.rise, w / 2), ys = op.y1 - rise, xc = (op.x0 + op.x1) / 2;
  const R = (w * w / 4 + rise * rise) / (2 * rise), cy = op.y1 - R, a0 = Math.asin(clamp((ys - cy) / R, -1, 1));
  return { R, xc, cy, ys, a0, a1: Math.PI - a0 };
}
/* Flat wall (z = 0, face +z) from x = 0 to len, y from y0 to y0 + h, pierced by the openings ops (facade frame).
   o.depth: depth of the reveals (thickness for a through wall); o.back: reveal closed at the back;
   o.round: radius of the block's corners at both ends (wallRound) */
function wallPierced(M, mat, len, y0, h, ops, o = {}) {
  M.save().move(0, y0, 0);
  const holes = ops.map((p) => ({ x0: p.x0, x1: p.x1, y0: p.y0 - y0, y1: p.y1 - y0 }));
  if (o.aoFn !== undefined) M.aoFn = o.aoFn;
  M.wall(mat, len, h, holes, { aoBottom: o.aoBottom, trim: o.round });
  if (o.round) wallRound(M, mat, len, h, holes, o.round, o.aoBottom);
  M.restore();
  for (const op of ops) {
    const d = op.depth !== undefined ? op.depth : (o.depth || 0.2);
    if (op.rise) archFill(M, mat, op, d);
    // a door at the foot of the wall has no sill: it blended with the ground or the floor (flicker)
    reveal(M, mat, op, d, o.floorY !== undefined ? o : { ...o, floorY: y0 });
  }
}
/* Rounded corners of a block: a facade's wall (wallPierced frame, length len, height h) stops r short of each end
   (M.wall, trim) and the facade places at both ends an eighth of a cylinder of radius r, tangent to the wall; with that of the neighboring
   facade, the corner becomes a quarter round. Its normals turn from one facade to the other: the corner catches the light over
   a few centimeters instead of a sharp edge, the tint lightens a bit there (worn plaster, less grime on the edge).
   Same rows as the wall (opening edges): vertex occlusion matches up. */
function wallRound(M, mat, len, h, holes, r, aoBottom, seg = 3) {
  const B = M.buf(mat, len / 2, h / 2, 0), t0 = M.tint;
  const ys = [...new Set([0, h, ...holes.flatMap((q) => [clamp(q.y0, 0, h), clamp(q.y1, 0, h)])].map((v) => Math.round(v * 1e4) / 1e4))].sort((a, b) => a - b);
  const ao = aoBottom ? (y) => lerp(aoBottom, 1, smoothstep(0, 0.8, y)) : () => 1;
  // from the point tangent to the wall (90 degrees) toward the corner diagonal (135 degrees at the start, 45 degrees at the end); center at r inside the block
  for (const [cx, a0, a1] of [[r, Math.PI / 2, Math.PI * 0.75], [len - r, Math.PI / 2, Math.PI * 0.25]]) {
    const col = [];
    for (let i = 0; i <= seg; i++) {
      const a = lerp(a0, a1, i / seg), c = Math.cos(a), s = Math.sin(a), k = 1 + 0.06 * (i / seg);
      M.tint = [t0[0] * k, t0[1] * k, t0[2] * k];
      col.push({ a, ids: ys.map((y) => M.v(B, cx + c * r, y, -r + s * r, c, 0, s, 0, y, ao(y))) });
    }
    M.tint = t0;
    // faces outward: from the largest angle to the smallest (left to right seen from outside)
    for (let i = 0; i < seg; i++) {
      const [L, R] = col[i].a > col[i + 1].a ? [col[i], col[i + 1]] : [col[i + 1], col[i]];
      for (let j = 0; j < ys.length - 1; j++) if (ys[j + 1] - ys[j] > 1e-4) M.quadI(B, L.ids[j], R.ids[j], R.ids[j + 1], L.ids[j + 1]);
    }
  }
}
/* Spandrels of an arched opening (between the arc and the rectangle) and intrados of the arc */
function archFill(M, mat, op, d) {
  const A = archGeom(op), n = ARCH_SEG / 2, B = M.buf(mat, A.xc, op.y1, 0);
  for (const [side, cx] of [[-1, op.x0], [1, op.x1]]) {
    const c = M.v(B, cx, op.y1, 0, 0, 0, 1, cx, op.y1);
    let prev = -1;
    for (let i = 0; i <= n; i++) {
      const a = side < 0 ? lerp(A.a1, Math.PI / 2, i / n) : lerp(A.a0, Math.PI / 2, i / n);
      const x = A.xc + Math.cos(a) * A.R, y = A.cy + Math.sin(a) * A.R, id = M.v(B, x, y, 0, 0, 0, 1, x, y);
      if (prev >= 0) { if (side < 0) M.tri(B, c, prev, id); else M.tri(B, c, id, prev); }
      prev = id;
    }
  }
  // intrados: strip along the arc, from the facade to the back of the reveal
  const B2 = M.buf(mat, A.xc, op.y1, -d / 2), m = ARCH_SEG; // same angles as the spandrels: shared edge, no gap
  let p0 = -1, p1 = -1;
  for (let i = 0; i <= m; i++) {
    const a = lerp(A.a0, A.a1, i / m), c = Math.cos(a), s = Math.sin(a), x = A.xc + c * A.R, y = A.cy + s * A.R;
    const q0 = M.v(B2, x, y, 0, -c, -s, 0, a * A.R, 0, 1), q1 = M.v(B2, x, y, -d, -c, -s, 0, a * A.R, d, 0.7);
    // visible face toward the center of the arc (downward at the keystone): the other way, the intrados was culled when seen from
    // below and the sky showed above the door
    if (p0 >= 0) M.quadI(B2, p0, q0, q1, p1);
    p0 = q0; p1 = q1;
  }
}
/* Reveal: cheeks, lintel (except arched opening) and inner sill, from z = 0 to z = -d */
function reveal(M, mat, op, d, o = {}) {
  const top = op.rise ? archGeom(op).ys : op.y1, ao = [1, 1, 0.72, 0.72];
  M.quad(mat, [op.x0, op.y0, 0], [op.x0, top, 0], [op.x0, top, -d], [op.x0, op.y0, -d], [1, 0, 0], { ao });
  M.quad(mat, [op.x1, op.y0, 0], [op.x1, top, 0], [op.x1, top, -d], [op.x1, op.y0, -d], [-1, 0, 0], { ao });
  if (!op.rise) M.quad(mat, [op.x0, op.y1, 0], [op.x1, op.y1, 0], [op.x1, op.y1, -d], [op.x0, op.y1, -d], [0, -1, 0], { ao: [0.9, 0.9, 0.65, 0.65] });
  if (op.y0 > (o.floorY !== undefined ? o.floorY : -1) + 0.01) M.quad(mat, [op.x0, op.y0, 0], [op.x1, op.y0, 0], [op.x1, op.y0, -d], [op.x0, op.y0, -d], [0, 1, 0], { ao });
  // dark back: buildings are hollow (at the map edge, only the facade on the game side exists); without it, a window
  // without glazing (arched with closed shutters, barred) let you see through the building to the void outside the map
  if (o.back || op.back) M.quad('dark', [op.x0, op.y0, -d], [op.x1, op.y0, -d], [op.x1, op.y1, -d], [op.x0, op.y1, -d], [0, 0, 1]);
}

/* ---------- Joinery ---------- */
/* Window at the back of a reveal of depth d: frame, mullion, transom, glazing (o.glass: glazing material,
   glassLit for a lit room) */
function windowJoinery(M, op, d, tint, o = {}) {
  const w = op.x1 - op.x0, h = op.y1 - op.y0, t = 0.065, z0 = -d + 0.02, z1 = z0 + 0.07;
  M.save().color(tint).local(1); M.cls = 1; // at the back of the reveal, the jamb's shadow is enough
  lbox(M, 'paintwood', op.x0, op.x0 + t, op.y0, op.y1, z0, z1); lbox(M, 'paintwood', op.x1 - t, op.x1, op.y0, op.y1, z0, z1);
  lbox(M, 'paintwood', op.x0 + t, op.x1 - t, op.y1 - t, op.y1, z0, z1); lbox(M, 'paintwood', op.x0 + t, op.x1 - t, op.y0, op.y0 + t, z0, z1);
  if (w > 0.75) lbox(M, 'paintwood', (op.x0 + op.x1) / 2 - 0.03, (op.x0 + op.x1) / 2 + 0.03, op.y0 + t, op.y1 - t, z0 + 0.005, z1 - 0.005);
  if (h > 1.3 && !o.door) lbox(M, 'paintwood', op.x0 + t, op.x1 - t, op.y1 - h * 0.28 - 0.025, op.y1 - h * 0.28 + 0.025, z0 + 0.005, z1 - 0.005);
  M.restore();
  M.save().color(o.glassTint || [1, 1, 1]); M.cls = 1;
  const gp = [[op.x0 + t, op.y0 + t, z0 + 0.035], [op.x1 - t, op.y0 + t, z0 + 0.035], [op.x1 - t, op.y1 - t, z0 + 0.035], [op.x0 + t, op.y1 - t, z0 + 0.035]];
  if (!o.glass || o.glass === 'glass' || o.glass === 'glassLit') {
    // window of a room (window material, 02c-materials.js): the room is drawn behind it. Vertices carry its data instead of a
    // tint: seed (drawn from the window's position in the world), lamp on, height over width ratio and French window
    const e = M.m.elements, cx = (op.x0 + op.x1) / 2, cy = (op.y0 + op.y1) / 2, gw = op.x1 - op.x0 - 2 * t, gh = op.y1 - op.y0 - 2 * t;
    const wx = e[0] * cx + e[4] * cy + e[12], wy = e[1] * cx + e[5] * cy + e[13], wz = e[2] * cx + e[6] * cy + e[14];
    const fr = (v) => v - Math.floor(v), seed = fr(Math.sin(wx * 12.9898 + wz * 78.233 + wy * 3.17) * 43758.5453);
    const lit = o.glass === 'glassLit' || (o.glass !== 'glass' && fr(seed * 7.13) < ((CURMAP.def && CURMAP.def.atmo.winLit) || 0)) ? 1 : 0;
    M.tint = [seed, lit, Math.min(gh / Math.max(gw, 0.1), 3.9) / 8 + (o.door ? 0.5 : 0)];
    M.quad('window', ...gp, [0, 0, 1], { uv: [[0, 0], [1, 0], [1, 1], [0, 1]] });
  } else M.quad(o.glass, ...gp, [0, 0, 1]);
  // inner curtain, sometimes
  if (o.curtain) { M.color(o.curtain); M.quad('canvas', [op.x0 + t, op.y0 + h * 0.35, z0 - 0.05], [op.x1 - t, op.y0 + h * 0.35, z0 - 0.05], [op.x1 - t, op.y1 - t, z0 - 0.05], [op.x0 + t, op.y1 - t, z0 - 0.05], [0, 0, 1]); }
  M.restore();
}
/* Mashrabiya: openwork wooden oriel placed in front of an upper-floor window (lattice on three sides, awning, bracket) */
function mashrabiya(M, op, tint) {
  const w = op.x1 - op.x0 + 0.5, x0 = (op.x0 + op.x1) / 2 - w / 2, x1 = x0 + w, y0 = op.y0 - 0.25, y1 = op.y1 + 0.2, dp = 0.55;
  M.save().color([0.05, 0.05, 0.05]); M.quad('dark', [op.x0, op.y0, -0.2], [op.x1, op.y0, -0.2], [op.x1, op.y1, -0.2], [op.x0, op.y1, -0.2], [0, 0, 1]); M.restore();
  M.save().color([0.45, 0.3, 0.2]).local(1);
  M.boxB('wood', x0 - 0.05, x1 + 0.05, y0 - 0.1, y0, 0, dp + 0.05, { bevel: 0.015 });
  M.boxB('wood', x0 - 0.08, x1 + 0.08, y1, y1 + 0.08, 0, dp + 0.12, { bevel: 0.015 });
  for (const x of [x0, x1]) for (const z of [dp]) M.boxB('wood', x - 0.03, x + 0.03, y0, y1, z - 0.03, z + 0.03);
  for (const x of [x0, x1]) M.boxB('wood', x - 0.03, x + 0.03, y0, y1, 0, 0.05);
  M.boxB('wood', x0, x1, y0 + (y1 - y0) * 0.35, y0 + (y1 - y0) * 0.35 + 0.05, dp - 0.03, dp + 0.03);
  M.color([1, 1, 1]); M.cls = 1; M.uvS = 1;
  const B = M.buf('lattice', (x0 + x1) / 2, (y0 + y1) / 2, dp);
  const face = (p0, p1, p2, p3, n, uw, uh) => { const ids = [[p0, 0, 0], [p1, uw, 0], [p2, uw, uh], [p3, 0, uh]].map(([p, u, v]) => M.v(B, p[0], p[1], p[2], n[0], n[1], n[2], u, v)); M.quadI(B, ids[0], ids[1], ids[2], ids[3]); M.quadI(B, ids[0], ids[3], ids[2], ids[1]); };
  face([x0, y0, dp], [x1, y0, dp], [x1, y1, dp], [x0, y1, dp], [0, 0, 1], w, y1 - y0);
  face([x0, y0, 0.03], [x0, y0, dp], [x0, y1, dp], [x0, y1, 0.03], [-1, 0, 0], dp, y1 - y0);
  face([x1, y0, dp], [x1, y0, 0.03], [x1, y1, 0.03], [x1, y1, dp], [1, 0, 0], dp, y1 - y0);
  M.cls = 0; M.color([0.4, 0.28, 0.18]);
  const cons = [[0, 0], [0.4, 0], [0.4, -0.08], [0.1, -0.4], [0, -0.45]];
  for (const x of [x0 + 0.1, x1 - 0.1]) { M.save().move(x + 0.05, y0 - 0.1, 0).rotY(-Math.PI / 2); M.extrude('wood', cons, 0.1); M.restore(); }
  M.restore();
  M.occ(x0, x1, y0, y1, 0, dp, 0.5);
}
/* Boarded-up window: planks nailed across, dark room behind */
function boardedWindow(M, op, d, R) {
  const w = op.x1 - op.x0, h = op.y1 - op.y0;
  M.save().color([0.05, 0.05, 0.05]); M.quad('dark', [op.x0, op.y0, -d + 0.02], [op.x1, op.y0, -d + 0.02], [op.x1, op.y1, -d + 0.02], [op.x0, op.y1, -d + 0.02], [0, 0, 1]); M.restore();
  M.save().local(1);
  const n = 3 + Math.floor(R() * 2);
  for (let i = 0; i < n; i++) {
    const y = op.y0 + ((i + 0.5) / n) * h + (R() - 0.5) * 0.08, ang = (R() - 0.5) * 0.35;
    M.color([0.75 + R() * 0.2, 0.62 + R() * 0.15, 0.48]);
    M.save().move((op.x0 + op.x1) / 2, y, 0.025).rotZ(ang); M.box('crate', w + 0.3, 0.16, 0.025, { bevel: 0.004 }); M.restore();
  }
  M.restore();
}
/* Broken window: frame, glass shards in the corners, dark room */
function brokenWindow(M, op, d, tint, R) {
  const z = -d + 0.055, t = 0.065;
  M.save().color([0.05, 0.05, 0.05]); M.quad('dark', [op.x0, op.y0, -d + 0.005], [op.x1, op.y0, -d + 0.005], [op.x1, op.y1, -d + 0.005], [op.x0, op.y1, -d + 0.005], [0, 0, 1]); M.restore();
  M.save().color(tint).local(1); M.cls = 1;
  lbox(M, 'paintwood', op.x0, op.x0 + t, op.y0, op.y1, -d + 0.02, -d + 0.09); lbox(M, 'paintwood', op.x1 - t, op.x1, op.y0, op.y1, -d + 0.02, -d + 0.09);
  lbox(M, 'paintwood', op.x0 + t, op.x1 - t, op.y1 - t, op.y1, -d + 0.02, -d + 0.09); lbox(M, 'paintwood', op.x0 + t, op.x1 - t, op.y0, op.y0 + t, -d + 0.02, -d + 0.09);
  M.color([1, 1, 1]);
  for (const [cx, cy, sx, sy] of [[op.x0 + t, op.y0 + t, 1, 1], [op.x1 - t, op.y1 - t, -1, -1], [op.x1 - t, op.y0 + t, -1, 1]]) {
    const a = 0.15 + R() * 0.25, b = 0.2 + R() * 0.35;
    M.tri3('glass', [cx, cy, z], [cx + sx * a, cy, z], [cx, cy + sy * b, z], [0, 0, 1]);
  }
  M.restore();
}
/* Protruding window sill (stone or concrete), slightly wider than the opening */
function sill(M, op, mat = 'concrete', tint = PAL.stone) {
  M.save().color(tint).local(1);
  M.boxB(mat, op.x0 - 0.09, op.x1 + 0.09, op.y0 - 0.06, op.y0 + 0.005, -0.04, 0.09, { bevel: 0.012 });
  M.restore();
}
function lintel(M, op, mat = 'ashlar', tint = PAL.stone) {
  M.save().color(tint).world(1);
  M.boxB(mat, op.x0 - 0.12, op.x1 + 0.12, op.y1, op.y1 + 0.2, -0.01, 0.025, { bevel: 0.01 });
  M.restore();
}
/* Louvered shutters. state: 'open' (folded back against the wall), 'ajar' (half open), 'closed' */
function shutters(M, op, tint, state, rngF) {
  const w = op.x1 - op.x0, lw = w / 2 + 0.015, h = op.y1 - op.y0, t = 0.035;
  M.save().color(tint).local(1);
  M.uvS = 1.3 / TEXSCALE.shutter;
  if (state === 'closed') {
    for (const [x, s] of [[op.x0, 1], [op.x1, -1]]) { M.save().move(x + (s * lw) / 2, op.y0, s < 0 ? -0.055 : -0.06); M.box('shutter', lw - 0.01, h, t); M.restore(); } // the right leaf overlaps the left by 2 cm, 5 mm in front (not in its plane)
  } else {
    for (const [x, s] of [[op.x0, -1], [op.x1, 1]]) {
      const ang = state === 'open' ? rngF() * 0.12 : 0.6 + rngF() * 0.9;
      M.save().move(x + s * 0.01, op.y0, 0.02).rotY(s < 0 ? ang : -ang).move((s * lw) / 2, 0, t / 2); M.box('shutter', lw, h, t); M.restore();
      // hinges
      M.save().color([0.2, 0.2, 0.2]); M.cls = 2;
      for (const yy of [0.2, h - 0.25]) lbox(M, 'steel', x + s * 0.01 - 0.02, x + s * 0.01 + 0.02, op.y0 + yy, op.y0 + yy + 0.05, 0, 0.04);
      M.restore();
    }
  }
  M.restore();
}
/* Iron security grille (ground-floor windows) */
function grille(M, op) {
  const w = op.x1 - op.x0, n = Math.max(3, Math.round(w / 0.12)), z = 0.03;
  M.save().color([0.16, 0.15, 0.14]); M.cls = 1;
  for (let i = 1; i < n; i++) { const x = op.x0 + (w * i) / n; M.save().move(x, op.y0 - 0.02, z); M.cyl('steel', 0.009, op.y1 - op.y0 + 0.04, 5, { caps: '' }); M.restore(); }
  for (const y of [op.y0 + 0.12, op.y1 - 0.12, (op.y0 + op.y1) / 2]) lbox(M, 'steel', op.x0 - 0.03, op.x1 + 0.03, y - 0.015, y + 0.015, z - 0.01, z + 0.01);
  M.restore();
}
/* Paneled door (painted wood) at the back of the reveal, with frame, handle and threshold */
function panelDoor(M, op, d, tint, o = {}) {
  const w = op.x1 - op.x0, h = op.y1 - op.y0, z0 = -d + 0.02, cols = w > 1.3 ? 2 : 1, dbl = w > 1.3;
  M.save().color(tint).local(1);
  if (op.rise) {
    // arched door: leaf cut to the arc
    // (outline widened by 3 cm: it passes behind the intrados and the jambs, no gap between the door and the arc)
    const A = archGeom(op), sh = [[op.x0 - 0.03, op.y0], [op.x1 + 0.03, op.y0]], r = A.R + 0.03;
    for (let i = 0; i <= ARCH_SEG; i++) { const a = lerp(A.a0, A.a1, i / ARCH_SEG); sh.push([A.xc + Math.cos(a) * r, A.cy + Math.sin(a) * r]); }
    M.save().move(0, 0, z0); M.extrude('paintwood', sh, 0.05); M.restore();
    // decorative nails
    M.save().color([0.15, 0.14, 0.13]); M.cls = 2;
    for (let yy = op.y0 + 0.3; yy < A.ys - 0.1; yy += 0.36) for (let xx = op.x0 + 0.15; xx < op.x1 - 0.1; xx += 0.2) lbox(M, 'steel', xx - 0.012, xx + 0.012, yy - 0.012, yy + 0.012, z0 + 0.05, z0 + 0.065);
    M.restore();
  } else {
    if (o.open) {
      // entrance: dark room behind, leaf turned inward around its hinges
      const D = 1.4;
      M.save().color([0.62, 0.56, 0.48]).world(1); M.ao = 0.45;
      M.quad('plaster', [op.x0 - 0.4, op.y0, z0 - D], [op.x1 + 0.4, op.y0, z0 - D], [op.x1 + 0.4, op.y1 + 0.3, z0 - D], [op.x0 - 0.4, op.y1 + 0.3, z0 - D], [0, 0, 1]);
      M.quad('plaster', [op.x0, op.y0, z0], [op.x0, op.y1, z0], [op.x0 - 0.4, op.y1 + 0.3, z0 - D], [op.x0 - 0.4, op.y0, z0 - D], [1, 0, 0]);
      M.quad('plaster', [op.x1, op.y0, z0], [op.x1 + 0.4, op.y0, z0 - D], [op.x1 + 0.4, op.y1 + 0.3, z0 - D], [op.x1, op.y1, z0], [-1, 0, 0]);
      M.quad('plaster', [op.x0, op.y1, z0], [op.x1, op.y1, z0], [op.x1 + 0.4, op.y1 + 0.3, z0 - D], [op.x0 - 0.4, op.y1 + 0.3, z0 - D], [0, -1, 0]);
      M.color([0.7, 0.66, 0.6]); M.quad('tiles', [op.x0, op.y0 + 0.005, z0], [op.x1, op.y0 + 0.005, z0], [op.x1 + 0.4, op.y0 + 0.005, z0 - D], [op.x0 - 0.4, op.y0 + 0.005, z0 - D], [0, 1, 0]);
      M.restore();
      M.save().color(tint).local(1).move(op.x0 + 0.02, 0, z0).rotY(1.0); // open inward
      lbox(M, 'paintwood', 0, w * (dbl ? 0.5 : 1) - 0.02, op.y0, op.y1, -0.05, 0);
      M.restore();
      M.restore();
      return;
    }
    lbox(M, 'paintwood', op.x0, op.x1, op.y0, op.y1, z0, z0 + 0.05);
    const rows = h > 2 ? 3 : 2, pw = (w - 0.12 * (cols + 1)) / cols, ph = (h - 0.14 * (rows + 1)) / rows;
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      const x = op.x0 + 0.12 + c * (pw + 0.12), y = op.y0 + 0.14 + r * (ph + 0.14);
      if (o.glazed && r === rows - 1) { M.save(); M.cls = 1; M.quad('glass', [x, y, z0 + 0.052], [x + pw, y, z0 + 0.052], [x + pw, y + ph, z0 + 0.052], [x, y + ph, z0 + 0.052], [0, 0, 1]); M.restore(); continue; }
      M.boxB('paintwood', x, x + pw, y, y + ph, z0 + 0.05, z0 + 0.068, { bevel: 0.012 });
    }
    if (dbl) lbox(M, 'paintwood', (op.x0 + op.x1) / 2 - 0.012, (op.x0 + op.x1) / 2 + 0.012, op.y0, op.y1, z0 + 0.05, z0 + 0.06);
  }
  M.restore();
  // handle, knocker
  M.save().color([0.55, 0.45, 0.25]); M.cls = 2;
  const hx = dbl ? (op.x0 + op.x1) / 2 + 0.1 : op.x1 - 0.12;
  lbox(M, 'steel', hx - 0.015, hx + 0.015, op.y0 + 1.0, op.y0 + 1.12, z0 + 0.05, z0 + 0.1);
  M.restore();
  // stone threshold
  M.save().color(PAL.stone).local(1);
  M.boxB('ashlar', op.x0 - 0.06, op.x1 + 0.06, op.y0 - 0.02, op.y0 + 0.05, z0, 0.14, { bevel: 0.015 });
  M.restore();
}
/* Protruding frame around a rectangular opening (or stone band around an arc) */
function casing(M, op, tint, mat = 'ashlar', wd = 0.14) {
  M.save().color(tint).world(1);
  if (op.rise) {
    const A = archGeom(op), n = 14, B = M.buf(mat, A.xc, op.y1, 0.03);
    let p = null;
    for (let i = 0; i <= n; i++) {
      const a = lerp(A.a0, A.a1, i / n), c = Math.cos(a), s = Math.sin(a);
      const ids = [M.v(B, A.xc + c * A.R, A.cy + s * A.R, 0.03, 0, 0, 1, 0, 0), M.v(B, A.xc + c * (A.R + wd), A.cy + s * (A.R + wd), 0.03, 0, 0, 1, 0, 0),
        M.v(B, A.xc + c * (A.R + wd), A.cy + s * (A.R + wd), 0.03, c, s, 0, 0, 0), M.v(B, A.xc + c * (A.R + wd), A.cy + s * (A.R + wd), 0, c, s, 0, 0, 0)];
      if (p) { M.quadI(B, p[0], p[1], ids[1], ids[0]); M.quadI(B, p[3], p[2], ids[2], ids[3]); }
      p = ids;
    }
    lbox(M, mat, op.x0 - wd, op.x0, op.y0, A.ys, 0, 0.03); lbox(M, mat, op.x1, op.x1 + wd, op.y0, A.ys, 0, 0.03);
  } else {
    lbox(M, mat, op.x0 - wd, op.x0, op.y0, op.y1 + wd, 0, 0.03); lbox(M, mat, op.x1, op.x1 + wd, op.y0, op.y1 + wd, 0, 0.03);
    lbox(M, mat, op.x0, op.x1, op.y1, op.y1 + wd, 0, 0.03);
  }
  M.restore();
}
/* Metal shop shutter: slats, box, guides; open = raised share (0 to 1), dark shop behind */
function rollShutter(M, op, d, tint, open) {
  const w = op.x1 - op.x0, h = op.y1 - op.y0, bottom = op.y0 + h * open;
  M.save().color(tint).local(1); M.uvS = 1.5 / TEXSCALE.rollshutter;
  if (bottom < op.y1 - 0.05) M.boxB('rollshutter', op.x0 + 0.02, op.x1 - 0.02, bottom, op.y1, -0.1, -0.07);
  M.restore();
  // shutter box and tracks
  M.save().color([0.55, 0.55, 0.52]).local(1);
  M.boxB('steel', op.x0 - 0.06, op.x1 + 0.06, op.y1, op.y1 + 0.32, -0.02, 0.26, { bevel: 0.02 });
  lbox(M, 'steel', op.x0, op.x0 + 0.05, op.y0, op.y1, -0.12, -0.04); lbox(M, 'steel', op.x1 - 0.05, op.x1, op.y0, op.y1, -0.12, -0.04);
  M.restore();
  if (open > 0.05) {
    // shop: shallow dark room, shelves faintly visible
    const D = 1.6;
    M.save().color([0.72, 0.66, 0.58]).world(1); M.ao = 0.55;
    M.quad('plaster', [op.x0, op.y0, -D], [op.x1, op.y0, -D], [op.x1, op.y1, -D], [op.x0, op.y1, -D], [0, 0, 1]);
    M.quad('plaster', [op.x0, op.y0, -0.1], [op.x0, op.y1, -0.1], [op.x0, op.y1, -D], [op.x0, op.y0, -D], [1, 0, 0]);
    M.quad('plaster', [op.x1, op.y0, -0.1], [op.x1, op.y1, -0.1], [op.x1, op.y1, -D], [op.x1, op.y0, -D], [-1, 0, 0]);
    M.quad('plaster', [op.x0, op.y1, -0.1], [op.x1, op.y1, -0.1], [op.x1, op.y1, -D], [op.x0, op.y1, -D], [0, -1, 0]);
    M.color([0.6, 0.55, 0.5]); M.quad('tiles', [op.x0, op.y0 + 0.01, -0.1], [op.x1, op.y0 + 0.01, -0.1], [op.x1, op.y0 + 0.01, -D], [op.x0, op.y0 + 0.01, -D], [0, 1, 0]);
    M.color([0.5, 0.4, 0.3]); M.local(1);
    const R = rngOf(Math.round(op.x0 * 100 + op.y1 * 7));
    for (const y of [0.9, 1.5, 2.1]) if (op.y0 + y < op.y1 - 0.1) {
      M.color([0.5, 0.4, 0.3]); lbox(M, 'crate', op.x0 + 0.1, op.x1 - 0.1, op.y0 + y, op.y0 + y + 0.04, -D + 0.02, -D + 0.4);
      // goods on the shelf: boxes, jars, colored packages
      M.cls = 2;
      for (let x = op.x0 + 0.18; x < op.x1 - 0.25; x += 0.14 + R() * 0.18) {
        const h = 0.12 + R() * 0.22, w = 0.08 + R() * 0.1;
        M.color(R.pick([[0.8, 0.2, 0.15], [0.9, 0.8, 0.3], [0.2, 0.4, 0.7], [0.9, 0.9, 0.85], [0.3, 0.6, 0.3], [0.6, 0.4, 0.2]]));
        lbox(M, R() < 0.6 ? 'cardboard' : 'plastic', x, x + w, op.y0 + y + 0.04, op.y0 + y + 0.04 + h, -D + 0.08, -D + 0.3);
      }
      M.cls = 0;
    }
    M.restore();
  }
}
/* Striped, tilted awning blind with scalloped valance and steel arms (facade frame). Each strip is a simulated cloth (Maker.canvasCloth) held at the
   wall, at the load bar and by its neighbors: its middle breathes; the scalloped valance hangs from the bar and flaps in the wind */
function awningStriped(M, xc, y, w, depth, colors) {
  const n = Math.max(4, Math.round(w / 0.3)), drop = depth * 0.42, sag = 0.05;
  M.save();
  for (let i = 0; i < n; i++) {
    const xa = xc - w / 2 + (w * i) / n, xb = xa + w / n;
    M.color(colors[i % colors.length]);
    M.canvasCloth(1, 4, (u, t) => [lerp(xa, xb, u), y - t * drop - Math.sin(t * Math.PI) * sag, t * depth], { uL: xb - xa, vL: depth, play: 0.05, glow: 0.3, side: [0, 0.92, 0.38] });
    // scalloped valance: held at the bar, the tip free
    const yv = y - drop;
    M.canvasCloth(1, 2, (u, t) => [lerp(xa, xb, u), yv - t * (0.16 + 0.06 * Math.sin(u * Math.PI)), depth + 0.004], { uL: xb - xa, vL: 0.22, play: 0.16, glow: 0.3, side: [0, 0, 1], pin: (u, t) => t <= 0 });
  }
  M.color([0.25, 0.25, 0.24]); M.cls = 1;
  M.save().move(xc - w / 2, y + 0.02, 0.02); M.cyl('steel', 0.02, 0.02, 6); M.restore();
  lbox(M, 'steel', xc - w / 2, xc + w / 2, y - 0.03, y + 0.03, 0, 0.05);
  for (const x of [xc - w / 2 + 0.1, xc + w / 2 - 0.1]) M.tube('steel', 0.014, [[x, y - 0.6, 0.01], [x, y - drop * 0.6, depth * 0.6]], 5);
  M.restore();
  M.occ(xc - w / 2, xc + w / 2, y - drop, y, 0, depth, 0.6);
}
/* Painted sign (sign atlas), laid flat on the facade */
function signBoard(M, xc, y, w, h, idx) {
  const [u0, v0, du, dv] = signUV(idx), B = M.buf('signs', xc, y, 0.05), z = 0.06;
  M.save().color([1, 1, 1]);
  const a = M.v(B, xc - w / 2, y, z, 0, 0, 1, u0, v0 + dv), b = M.v(B, xc + w / 2, y, z, 0, 0, 1, u0 + du, v0 + dv);
  const c = M.v(B, xc + w / 2, y + h, z, 0, 0, 1, u0 + du, v0), d = M.v(B, xc - w / 2, y + h, z, 0, 0, 1, u0, v0);
  M.quadI(B, a, b, c, d);
  M.color([0.35, 0.3, 0.25]).local(1); lbox(M, 'paintwood', xc - w / 2 - 0.03, xc + w / 2 + 0.03, y - 0.03, y + h + 0.03, 0, z - 0.002);
  M.restore();
}
/* Balcony: slab on brackets, iron railing (facade frame) */
function balcony(M, xc, y, w, dp, rngF) {
  M.save().color([0.9, 0.88, 0.84]).local(1);
  M.boxB('concrete', xc - w / 2, xc + w / 2, y - 0.16, y, 0, dp, { bevel: 0.02 });
  M.pcol(xc - w / 2, xc + w / 2, y - 0.16, y, 0, dp); // the slab carries the flower pot (a physics body): without it, it fell at the first hit
  // consoles
  const cons = [[0, 0], [0.16, 0], [0.16, -0.08], [0.06, -0.34], [0, -0.38]];
  for (const x of [xc - w / 2 + 0.2, xc + w / 2 - 0.2]) { M.save().move(x + 0.06, y - 0.16, 0).rotY(-Math.PI / 2); M.extrude('concrete', cons, 0.12); M.restore(); }
  M.restore();
  // garde-corps
  M.save().color([0.14, 0.14, 0.13]); M.cls = 1;
  const x0 = xc - w / 2 + 0.04, x1 = xc + w / 2 - 0.04, z1 = dp - 0.04, top = y + 1.0;
  lbox(M, 'steel', x0, x1, top - 0.04, top, z1 - 0.025, z1 + 0.025);
  lbox(M, 'steel', x0, x1, y + 0.1, y + 0.13, z1 - 0.012, z1 + 0.012);
  for (const x of [x0, x1]) { lbox(M, 'steel', x - 0.025, x + 0.025, top - 0.04, top, 0, z1); lbox(M, 'steel', x - 0.012, x + 0.012, y + 0.1, y + 0.13, 0, z1); lbox(M, 'steel', x - 0.02, x + 0.02, y, top, z1 - 0.02, z1 + 0.02); }
  M.cls = 2;
  const nb = Math.round((x1 - x0) / 0.11);
  for (let i = 1; i < nb; i++) { const x = x0 + ((x1 - x0) * i) / nb; lbox(M, 'steel', x - 0.008, x + 0.008, y, top - 0.04, z1 - 0.008, z1 + 0.008, { skip: 'yY' }); }
  for (const x of [x0, x1]) for (let z = 0.12; z < z1 - 0.05; z += 0.11) lbox(M, 'steel', x - 0.008, x + 0.008, y, top - 0.04, z - 0.008, z + 0.008, { skip: 'yY' });
  M.restore();
  // flower pots, laundry
  if (rngF() < 0.5) M.dyn('pot', xc + (rngF() - 0.5) * (w - 0.6), y, dp * 0.55, rngF() * TAU);
  if (rngF() < 0.35) laundry(M, x0 + 0.1, x1 - 0.1, top - 0.02, z1, rngF);
}
/* Laundry hung on a bar (local frame) */
function laundry(M, x0, x1, y, z, rngF) {
  M.save(); M.cls = 2;
  let x = x0;
  while (x < x1 - 0.3) {
    const w = 0.3 + rngF() * 0.35, h = 0.35 + rngF() * 0.4;
    M.color(PAL.awning[Math.floor(rngF() * PAL.awning.length)]);
    clothPiece(M, [x, y - h, z + 0.04], [x + w, y - h, z + 0.04], [x + w, y, z + 0.04], [x, y, z + 0.04], [0, 0, 1]); // simulated cloth (02mc-cloths.js), set away from the bar
    x += w + 0.05 + rngF() * 0.2;
  }
  M.restore();
}
/* Rainwater downpipe (facade frame) */
function drainPipe(M, x, y1, y0 = 0) {
  M.save().color([0.62, 0.6, 0.56]); M.cls = 1;
  M.save().move(x, y0 + 0.25, 0.1); M.cyl('steel', 0.05, y1 - y0 - 0.25, 8, { caps: '' }); M.restore();
  M.tube('steel', 0.05, [[x, y0 + 0.28, 0.1], [x, y0 + 0.14, 0.14], [x, y0 + 0.08, 0.26]], 8);
  M.cls = 2;
  for (let y = y0 + 1.2; y < y1 - 0.2; y += 1.8) lbox(M, 'steel', x - 0.06, x + 0.06, y, y + 0.03, 0, 0.16);
  M.restore();
}
/* Electrical cable running along the facade, junction boxes */
function wallCable(M, x0, x1, y, rngF) {
  M.save().color([0.08, 0.08, 0.08]); M.cls = 2;
  const pts = []; for (let x = x0; x <= x1 + 1e-6; x += (x1 - x0) / 12) pts.push([x, y - Math.abs(Math.sin(((x - x0) / (x1 - x0)) * Math.PI * 3)) * 0.05, 0.04]);
  M.tube('rubber', 0.012, pts, 4);
  M.color([0.7, 0.68, 0.62]);
  for (let x = x0 + 1 + rngF() * 2; x < x1 - 0.5; x += 3 + rngF() * 4) lbox(M, 'plastic', x - 0.08, x + 0.08, y - 0.12, y + 0.08, 0, 0.07);
  M.restore();
}
/* Facade wall light; lit: on (bulb and warm light baked into the lighting volume); all on when street lighting is on */
function wallLamp(M, x, y, lit) {
  lit = lit || litOn();
  M.save().color([0.2, 0.2, 0.2]); M.cls = 1;
  M.tube('steel', 0.018, [[x, y, 0], [x, y + 0.12, 0.25], [x, y + 0.1, 0.5]], 5);
  M.save().move(x, y - 0.12, 0.5); M.cyl('steel', 0.14, 0.12, 10, { r1: 0.05 }); M.restore();
  M.cls = 1; M.save().move(x, y - 0.14, 0.5); M.cyl(lit ? 'lamp' : 'lampOff', 0.09, 0.03, 8); M.restore();
  if (lit) M.lamp(x, y - 0.3, 0.5, [1.0, 0.68, 0.38], 1.2, 6, 0.6);
  M.restore();
}
/* Profiled molding along the facade (profile [projection, height], closed against the wall) */
function molding(M, mat, x0, x1, y, prof, tint) {
  M.save().color(tint).world(1).move(x1, y, 0).rotY(-Math.PI / 2);
  M.extrude(mat, prof, x1 - x0);
  M.restore();
}
const PROF = {
  cornice: [[0, 0], [0.06, 0], [0.06, 0.05], [0.1, 0.08], [0.15, 0.14], [0.24, 0.18], [0.24, 0.27], [0, 0.27]],
  band: [[0, 0], [0.05, 0], [0.07, 0.025], [0.07, 0.11], [0.045, 0.14], [0, 0.14]],
  plinth: [[0, 0], [0.06, 0], [0.06, 0.0], [0.06, 0.8], [0.03, 0.85], [0, 0.85]],
  coping: [[-0.04, 0], [0.04, 0], [0.04, 0.04], [0.0, 0.08], [-0.04, 0.04]],
};

/* ---------- Complete facade ---------- */
/* Zones without a door or shop on the ground floor ([x0, x1, z0, z1], world frame), filled by the current map while it is
   being built: where a neighboring building, a container, a tent or a sandbag wall stands in front of the facade, the bay stays a solid wall
   (decor.js flagged these obstructed doors). The random draws are the same: the rest of the facade and the map does not change. */
const NO_DOOR = [];
/* Facade of a block: 3.2 m floors, bays of about 3.1 m; ground floor commercial or residential.
   o: { mat, tint, style, skipGround, noGround, shutters, rng } */
function facadeKit(face, x0, x1, z0, z1, h, o) {
  const F = facadeFrame(face, x0, x1, z0, z1), len = F.len, R = o.rng, floorH = 3.2;
  const shade = Math.sin(F.rot) * SUN_DIR.x + Math.cos(F.rot) * SUN_DIR.z < 0; // facade in shade: the door wall lights there are on
  const noDoor = (a) => { const x = F.ox + a * Math.cos(F.rot), z = F.oz - a * Math.sin(F.rot); return NO_DOOR.some((q) => x > q[0] && x < q[1] && z > q[2] && z < q[3]); };
  const ghost = []; // doors and shops removed by NO_DOOR: the posters avoid them as before (same draws)
  const bays = Math.max(1, Math.floor(len / (o.bay || 3.1))), bw = len / bays;
  const shut = o.shutters, frameT = o.frame, maghreb = o.style === 'maghreb';
  const ops = [], after = [];
  for (let f = o.skipGround ? 1 : 0; ; f++) {
    const fy = f * floorH; if (fy + 2.4 > h - 0.4) break;
    for (let i = 0; i < bays; i++) {
      const a = bw * (i + 0.5);
      if (f === 0) {
        if (o.noGround) continue;
        const r = R();
        if (r < 0.35) { // boutique
          const sw = Math.min(bw - 0.6, 2.6), op = { x0: a - sw / 2, x1: a + sw / 2, y0: 0, y1: 2.5, depth: 0.12, kind: 'shop' };
          const tint = R.pick(PAL.shop), open = R() < 0.3 ? 0.55 + R() * 0.3 : R() < 0.2 ? 0.2 : 0;
          if (noDoor(a)) { ghost.push(op); after.push(() => { if (R() < 0.6) R.pick(PAL.awning); else if (R() < 0.7) R(); }); continue; } // solid wall, same draws
          ops.push(op);
          after.push((M) => {
            rollShutter(M, op, 0.12, tint, open);
            if (R() < 0.6) awningStriped(M, a, 2.95, sw + 0.4, 1.25, [R.pick(PAL.awning), [0.9, 0.88, 0.82]]);
            else if (R() < 0.7) signBoard(M, a, 2.9, Math.min(sw + 0.2, 2.4), 0.55, Math.floor(R() * 8));
          });
        } else if (r < 0.55) { // door
          const arch = maghreb || R() < 0.25, dw = arch ? 1.2 : 1.1;
          const op = { x0: a - dw / 2, x1: a + dw / 2, y0: 0, y1: arch ? 2.5 : 2.2, depth: 0.25, kind: 'door', rise: arch ? 0.6 : 0, back: arch };
          const tint = R.pick(PAL.door), glazed = R() < 0.3, open = !arch && R() < 0.18;
          if (noDoor(a)) { ghost.push(op); after.push(() => { R(); }); continue; } // solid wall, same draws
          ops.push(op);
          after.push((M) => { panelDoor(M, op, 0.25, tint, { glazed, open }); casing(M, op, arch ? PAL.stone : [0.86, 0.82, 0.74], 'ashlar', arch ? 0.16 : 0.12); if (R() < 0.3) wallLamp(M, a + dw / 2 + 0.35, 2.3, shade); });
        } else { // low window
          const ww = Math.min(bw * 0.45, 1.2), op = { x0: a - ww / 2, x1: a + ww / 2, y0: 1.0, y1: 2.4, depth: 0.22, kind: 'win', rise: maghreb && R() < 0.5 ? 0.25 : 0, back: true };
          ops.push(op);
          const st = shut && R() < 0.8 ? (R() < 0.25 ? 'closed' : R() < 0.4 ? 'ajar' : 'open') : null, gr = R() < 0.6, board = !gr && R() < 0.2;
          after.push((M) => {
            if (board) boardedWindow(M, op, 0.22, R);
            else if (st !== 'closed') windowJoinery(M, op, 0.22, frameT, { curtain: R() < 0.3 ? R.pick(PAL.awning) : null });
            sill(M, op); if (st && !op.rise) shutters(M, op, shut, st, R);
            if (gr) grille(M, op);
          });
        }
      } else {
        const r = R(), bal = r < 0.14 && !maghreb, ac = r > 0.86;
        const ww = Math.min(bw * 0.42, 1.15);
        const op = bal ? { x0: a - ww / 2, x1: a + ww / 2, y0: fy + 0.05, y1: fy + 2.45, depth: 0.22, kind: 'french', back: true }
          : { x0: a - ww / 2, x1: a + ww / 2, y0: fy + 0.9, y1: fy + 2.45, depth: 0.22, kind: 'win', rise: maghreb && R() < 0.35 ? 0.22 : 0, back: true };
        ops.push(op);
        const st = shut && R() < 0.75 ? (R() < 0.3 ? 'closed' : R() < 0.35 ? 'ajar' : 'open') : null, dmg = bal ? 1 : R();
        after.push((M) => {
          if (maghreb && !bal && !op.rise && dmg > 0.8) { mashrabiya(M, op, frameT); return; }
          if (dmg < 0.06) boardedWindow(M, op, 0.22, R);
          else if (dmg < 0.11) brokenWindow(M, op, 0.22, frameT, R);
          else if (st !== 'closed') windowJoinery(M, op, 0.22, frameT, { door: bal, curtain: R() < 0.35 ? R.pick(PAL.awning) : null });
          if (!bal && R() < 0.3) wallDecal(M, 8, (op.x0 + op.x1) / 2, op.y0 - 1.3, op.x1 - op.x0 + 0.3, 1.25); // drip streak under the sill
          if (!bal) sill(M, op);
          if (st && !op.rise) shutters(M, op, shut, st, R);
          if (!op.rise && o.lintels) lintel(M, op);
          if (bal) balcony(M, a, fy + 0.05, ww + 1.0, 0.85, R);
          if (ac) M.place(PF.acUnit(), a + ww / 2 + 0.55, fy + 0.35, 0, 0, { cls: 1 });
          if (!bal && R() < 0.12) M.dyn('pot', a + (R() - 0.5) * 0.4, op.y0 + 0.005, 0.03, R() * TAU);
        });
      }
    }
  }
  inFrame(F, (M) => {
    M.save().color(o.tint).world(1);
    M.aoFn = (x, y) => lerp(0.75, 1, smoothstep(0, 1.2, y));
    wallPierced(M, o.mat, len, 0, h, ops, { depth: 0.22, round: o.round });
    M.restore();
    // plinth, string courses, cornice
    const pl = o.plinth;
    if (pl && !o.skipGround) {
      let cur = 0;
      const segs = ops.filter((p) => p.y0 < 0.5).map((p) => [p.x0, p.x1]).sort((p, q) => p[0] - q[0]);
      for (const [s0, s1] of segs) { if (s0 - cur > 0.05) plinthSeg(M, cur, s0, pl); cur = s1; }
      if (len - cur > 0.05) plinthSeg(M, cur, len, pl);
    }
    if (o.bands) for (let f = 1; f * floorH < h - 1.2; f++) molding(M, o.trimMat || 'plaster', 0, len, f * floorH - 0.14, PROF.band, o.trimTint || o.tint);
    if (o.cornice !== false) molding(M, o.trimMat || 'plaster', 0, len, h - 0.27, PROF.cornice, o.trimTint || o.tint);
    if (o.quoins) for (const x of [0, len]) for (let y = 0.9, k = 0; y < h - 0.6; y += 0.42, k++) {
      const w = k % 2 ? 0.28 : 0.45;
      M.save().color(PAL.stone).world(1); lbox(M, 'ashlar', x === 0 ? 0 : len - w, x === 0 ? w : len, y, y + 0.38, 0, 0.035); M.restore();
    }
    for (const fn of after) fn(M);
    // downpipe, cables, meter
    if (o.pipes !== false && len > 5) drainPipe(M, bw * Math.max(1, Math.floor(R() * bays)), h - 0.3);
    if (R() < 0.7 && !o.skipGround) wallCable(M, 0.2, len - 0.2, floorH - 0.22 + R() * 0.1, R);
    if (!o.skipGround && R() < 0.5) { M.save().color([0.8, 0.78, 0.72]); M.cls = 2; const x = 0.4 + R() * (len - 0.8); if (!ops.some((p) => x > p.x0 - 0.4 && x < p.x1 + 0.4)) lbox(M, 'plastic', x - 0.2, x + 0.2, 1.1, 1.6, 0, 0.16); M.restore(); }
    // posters, stencils, graffiti between the ground-floor openings
    if (!o.skipGround && !o.noGround) for (let k = 0; k < 3; k++) {
      if (R() > 0.55) continue;
      const kind = R(), w = kind < 0.5 ? 0.7 : kind < 0.75 ? 1.1 : 1.3, x = 0.3 + w / 2 + R() * (len - w - 0.6);
      if (ops.concat(ghost).some((p) => p.y0 < 2.6 && x + w / 2 > p.x0 - 0.15 && x - w / 2 < p.x1 + 0.15)) continue;
      const idx = kind < 0.5 ? Math.floor(R() * 4) : kind < 0.75 ? 4 + Math.floor(R() * 2) : 6 + Math.floor(R() * 2);
      wallDecal(M, idx, x, kind < 0.5 ? 1.25 + R() * 0.3 : 0.7 + R() * 0.6, w, kind < 0.5 ? w * 1.1 : w * 0.8);
    }
  });
}
function plinthSeg(M, a, b, pl) {
  M.save().color(pl.tint).world(1);
  M.boxB(pl.mat, a, b, 0, pl.h, -0.02, 0.05, { skip: 'z' });
  M.boxB(pl.mat, a, b, pl.h, pl.h + 0.05, -0.02, 0.07, { bevel: 0.015, skip: 'z' });
  M.restore();
}

/* ---------- Roofs ---------- */
/* Flat roof: parapet with coping, waterproofing and gravel, gargoyles, equipment */
function flatRoof(x0, x1, z0, z1, y, tint, R) {
  const M = DECOR, t = 0.25, ph = 0.7;
  M.save().color([0.74, 0.72, 0.68]).world(1);
  M.boxB(R() < 0.5 ? 'gravel' : 'concrete', x0 + t, x1 - t, y, y + 0.06, z0 + t, z1 - t, { skip: 'y' });
  M.color(tint).world(1);
  M.boxB('plaster', x0, x1, y, y + ph, z0, z0 + t, { skip: 'y' }); M.boxB('plaster', x0, x1, y, y + ph, z1 - t, z1, { skip: 'y' });
  M.boxB('plaster', x0, x0 + t, y, y + ph, z0 + t, z1 - t, { skip: 'yzZ' }); M.boxB('plaster', x1 - t, x1, y, y + ph, z0 + t, z1 - t, { skip: 'yzZ' });
  // concrete coping, slightly overhanging
  M.color([0.86, 0.84, 0.8]).local(1);
  M.boxB('concrete', x0 - 0.03, x1 + 0.03, y + ph, y + ph + 0.06, z0 - 0.03, z0 + t + 0.03, { bevel: 0.012 });
  M.boxB('concrete', x0 - 0.03, x1 + 0.03, y + ph, y + ph + 0.06, z1 - t - 0.03, z1 + 0.03, { bevel: 0.012 });
  M.boxB('concrete', x0 - 0.03, x0 + t + 0.03, y + ph, y + ph + 0.06, z0 + t + 0.03, z1 - t - 0.03, { bevel: 0.012 });
  M.boxB('concrete', x1 - t - 0.03, x1 + 0.03, y + ph, y + ph + 0.06, z0 + t + 0.03, z1 - t - 0.03, { bevel: 0.012 });
  // gargoyles
  M.color([0.6, 0.58, 0.54]); M.cls = 1;
  for (const [x, z, dx, dz] of [[x0 + (x1 - x0) * 0.25, z0, 0, -1], [x1 - (x1 - x0) * 0.25, z1, 0, 1]]) {
    M.save().move(x, y + 0.1, z).rotY(dz > 0 ? 0 : Math.PI); M.boxB('steel', -0.06, 0.06, 0, 0.08, -0.05, 0.35); M.restore(); void dx;
  }
  M.restore();
  // equipment
  const w = x1 - x0, d = z1 - z0, n = Math.floor((w * d) / 55) + 1;
  for (let i = 0; i < n; i++) {
    const px = x0 + 1.2 + R() * (w - 2.4), pz = z0 + 1.2 + R() * (d - 2.4), r = R(), ry = Math.round(R() * 4) * (Math.PI / 2);
    if (r < 0.32) M.place(PF.waterTank(), px, y + 0.06, pz, R() * TAU, { tint: { plastic: R.pick([[0.9, 0.9, 0.86], [0.2, 0.2, 0.22], [0.25, 0.4, 0.6]]) }, nocol: true });
    else if (r < 0.5) M.place(PF.acUnit(), px, y + 0.06, pz, ry, { nocol: true });
    else if (r < 0.68) M.place(PF.dish(), px, y + 0.06, pz, R() * TAU, { nocol: true, cls: 1 });
    else if (r < 0.8) M.place(PF.solarHeater(), px, y + 0.06, pz, ry, { nocol: true });
    else if (r < 0.9) M.place(PF.antenna(), px, y + 0.06, pz, R() * TAU, { nocol: true, cls: 1 });
    else if (w * d > 60) M.place(PF.roofHut(), px, y + 0.06, pz, ry, { nocol: true });
  }
}
/* Gabled tile roof: overhangs, verges, round-tile ridge, gutters, plastered gables */
function pitchedRoof(x0, x1, z0, z1, y, tint, R) {
  const M = DECOR, alongX = x1 - x0 >= z1 - z0, span = alongX ? z1 - z0 : x1 - x0, len = alongX ? x1 - x0 : z1 - z0;
  const rise = Math.min(3.2, span * 0.24), ov = 0.4, drop = ov * (rise / (span / 2)), T = [0.92 + R() * 0.08, 0.85 + R() * 0.1, 0.82 + R() * 0.1];
  // local frame: x along the ridge (0..len), z across (-span/2..span/2)
  M.save();
  if (alongX) M.move(x0, y, (z0 + z1) / 2); else M.move((x0 + x1) / 2, y, z1).rotY(Math.PI / 2);
  const hs = span / 2 + ov, yr = rise;
  M.color(T).world(1);
  for (const s of [1, -1]) {
    const nl = hyp(hs, yr + drop);
    M.quad('rooftiles', [-ov, -drop, s * hs], [len + ov, -drop, s * hs], [len + ov, yr, 0], [-ov, yr, 0], [0, hs / nl, (s * (yr + drop)) / nl]);
    // soffit and eaves fascia
    M.color([0.5, 0.44, 0.38]).local(1);
    M.quad('paintwood', [-ov, -drop - 0.06, s * hs], [len + ov, -drop - 0.06, s * hs], [len + ov, yr - 0.1, 0], [-ov, yr - 0.1, 0], [0, -1, 0]);
    M.color([0.4, 0.3, 0.22]);
    M.save().move(len / 2, -drop - 0.2, s * (hs + 0.01)); M.box('paintwood', len + ov * 2, 0.16, 0.03); M.restore();
    // half-round gutter
    M.color([0.55, 0.52, 0.48]); M.cls = 1;
    M.save().move(-ov, -drop - 0.12, s * (hs + 0.08)).rotZ(-Math.PI / 2); M.cyl('steel', 0.065, len + ov * 2, 8, { a0: -Math.PI / 2, a1: Math.PI / 2, caps: '' }); M.restore();
    M.cls = 0; M.color(T).world(1);
  }
  // gables
  M.color(tint).world(1);
  for (const [xx, dir] of [[0, -1], [len, 1]]) {
    M.quad('plaster', [xx, 0, -span / 2], [xx, 0, span / 2], [xx, yr - 0.05, 0.001], [xx, yr - 0.05, -0.001], [dir, 0, 0]);
  }
  // verges (barge boards)
  M.color([0.42, 0.32, 0.24]).local(1);
  for (const xx of [-ov, len + ov]) for (const s of [1, -1]) {
    const dy = yr + drop + 0.07, dz = -s * hs, L = hyp(dy, dz);
    M.save().move(xx, (yr - drop) / 2 - 0.12, (s * hs) / 2).rotX(Math.atan2(-dy, dz)); M.box('paintwood', 0.05, 0.18, L); M.restore();
  }
  // round-tile ridge and eaves tile course
  M.color([0.82, 0.55, 0.42]).local(1);
  M.save().move(-ov, yr - 0.05, 0).rotZ(-Math.PI / 2); M.cyl('rooftiles', 0.13, len + ov * 2, 8, { a0: Math.PI / 2, a1: Math.PI * 1.5 }); M.restore();
  // eaves tiles: round half-tiles laid on the slope, at the bottom of the pitch
  const al = Math.atan2(yr + drop, hs);
  M.cls = 1;
  for (const s of [1, -1]) for (let x = -ov + 0.11; x < len + ov - 0.05; x += 0.22) {
    M.save().move(x, -drop, s * hs).rotX(s * al).move(0, 0.02, s > 0 ? -0.34 : 0).rotX(Math.PI / 2); M.cyl('rooftiles', 0.085, 0.34, 6, { a0: Math.PI, a1: TAU, caps: '' }); M.restore();
  }
  M.cls = 0;
  // chimney
  if (R() < 0.35) {
    const cx = len * (0.2 + R() * 0.6), cz = (R() - 0.5) * span * 0.3;
    M.color(tint).world(1); M.boxB('plaster', cx - 0.3, cx + 0.3, rise * 0.5, yr + 0.9, cz - 0.3, cz + 0.3);
    M.color([0.7, 0.66, 0.6]).local(1); M.boxB('concrete', cx - 0.36, cx + 0.36, yr + 0.9, yr + 0.98, cz - 0.36, cz + 0.36, { bevel: 0.01 });
  }
  M.restore();
  DECOR.occ(x0 - ov, x1 + ov, y, y + rise * 0.6, z0 - ov, z1 + ov, 1);
}

/* ---------- Building ---------- */
/* Solid block [x0,x1] x [z0,z1] of height h. o: faces (sides with detailed facade), tint, key, style,
   skipGround, noGround, pitched */
function building(x0, x1, z0, z1, h, o = {}) {
  const R = rngOf(Math.round(x0 * 73 + z0 * 131 + h * 17) + 9001);
  const tint = o.tint || R.pick(PAL.plaster);
  let mat = o.key || 'plaster';
  if (mat === 'plaster' && R() < 0.3) mat = 'plaster2';
  const style = o.style || (R() < 0.45 ? 'maghreb' : 'colonial');
  DECOR.col(x0, x1, 0, h, z0, z1, 'concrete');
  const faces = o.faces || 'nsew';
  const kit = {
    mat, tint, style, rng: R, skipGround: o.skipGround, noGround: o.noGround,
    shutters: R() < 0.65 ? R.pick(PAL.shutter) : null, frame: R.pick(PAL.frame),
    plinth: { mat: R() < 0.6 ? 'ashlar' : 'stone', h: style === 'maghreb' ? 0.55 : 0.85, tint: PAL.stone },
    bands: style === 'colonial' && h > 5, cornice: true, quoins: style === 'colonial' && R() < 0.35, lintels: style === 'colonial' && R() < 0.5,
    round: /^plaster/.test(mat) ? 0.06 : 0, // rounded plaster corners (wallRound), brick keeps its edges
  };
  for (const f of 'nsew') {
    if (faces.indexOf(f) >= 0) facadeKit(f, x0, x1, z0, z1, h, kit);
    else plainWall(f, x0, x1, z0, z1, h, mat, tint, kit.round);
  }
  const pitched = o.pitched !== undefined ? o.pitched : style === 'colonial' && R() < 0.6;
  if (pitched) pitchedRoof(x0, x1, z0, z1, h, tint, R); else flatRoof(x0, x1, z0, z1, h, tint, R);
}
function plainWall(face, x0, x1, z0, z1, h, mat, tint, round) {
  const F = facadeFrame(face, x0, x1, z0, z1);
  inFrame(F, (M) => { M.save().color(tint).world(1); M.aoFn = (x, y) => lerp(0.75, 1, smoothstep(0, 1.2, y)); wallPierced(M, mat, F.len, 0, h, [], { round }); M.restore(); });
}

/* ---------- Through walls (walkable interiors) ---------- */
/* Wall of thickness t. axis 'x': wall along X at z = fixed; 'z': along Z at x = fixed.
   ops: openings [{ a0, a1, b0, b1 }] relative to the wall's foot (b0, b1: heights). Collisions identical to
   the old version (solid segments), scenery: two pierced facings, jambs, door frames, top course (o.top === false: no top course,
   when a slab or paving laid at the same level covers it; the two faces in the same plane flickered). Door
   frames: o.frameTint, o.frameMat (painted wood by default, 'ashlar': stone surround), o.frameW (width). */
function wallOpen(key, axis, fixed, t, a0, a1, y0, h, ops, o = {}) {
  ops = ops.slice().sort((p, q) => p.a0 - q.a0);
  const k = LEGACY_KEY[key] || key, kind = matKind(key);
  const col = (s0, s1, yb, yt) => {
    if (s1 - s0 < 0.01 || yt - yb < 0.01) return;
    if (axis === 'x') DECOR.col(s0, s1, yb, yt, fixed - t / 2, fixed + t / 2, o.m || kind);
    else DECOR.col(fixed - t / 2, fixed + t / 2, yb, yt, s0, s1, o.m || kind);
  };
  let cur = a0;
  for (const op of ops) {
    col(cur, op.a0, y0, y0 + h);
    if (op.b0 > 0) col(op.a0, op.a1, y0, y0 + op.b0);
    if (op.b1 < h) col(op.a0, op.a1, y0 + op.b1, y0 + h);
    cur = op.a1;
  }
  col(cur, a1, y0, y0 + h);
  // scenery: two facings in their frames (x along the wall seen from each side)
  const tint = o.tint || [1, 1, 1];
  for (const side of [1, -1]) {
    const M = DECOR; M.save();
    // frame: origin at the start of the wall (seen from this side), z toward the outside of this facing
    if (axis === 'x') { if (side > 0) M.move(a0, 0, fixed + t / 2); else M.move(a1, 0, fixed - t / 2).rotY(Math.PI); }
    else { if (side > 0) M.move(fixed + t / 2, 0, a1).rotY(Math.PI / 2); else M.move(fixed - t / 2, 0, a0).rotY(-Math.PI / 2); }
    const L = a1 - a0, map = (a) => (axis === 'x' ? (side > 0 ? a - a0 : a1 - a) : (side > 0 ? a1 - a : a - a0));
    const lops = ops.map((p) => { const u0 = map(p.a0), u1 = map(p.a1); return { x0: Math.min(u0, u1), x1: Math.max(u0, u1), y0: y0 + p.b0, y1: y0 + Math.min(p.b1, h), rise: p.arch ? Math.min(p.arch, (p.a1 - p.a0) / 2) : 0 }; });
    M.color(tint).world(1);
    M.aoFn = (x, y) => lerp(0.72, 1, smoothstep(y0, y0 + 1.2, y));
    // reveals over half the thickness on each side (the two halves meet in the middle)
    wallPierced(M, k, L, y0, h, lops.map((p) => ({ ...p, depth: t / 2 })), { floorY: o.floorY !== undefined ? o.floorY : y0, aoFn: M.aoFn });
    M.aoFn = null;
    if (o.frames !== false) for (const p of lops) if (p.y1 - p.y0 > 1.6 && p.y0 <= y0 + 0.05) casing(M, p, o.frameTint || [0.5, 0.42, 0.34], o.frameMat || 'paintwood', o.frameW || 0.09);
    // o.dress(M, L, lops, side): dressing of each facing in its frame (plinth, cornice, wall lights...), after the reveals
    if (o.dress) { M.save(); o.dress(M, L, lops, side); M.restore(); }
    if (side > 0) { // top course of the wall and ends
      M.color(tint).world(1);
      if (o.top !== false) M.quad(k, [0, y0 + h, 0], [L, y0 + h, 0], [L, y0 + h, -t], [0, y0 + h, -t], [0, 1, 0]);
      M.quad(k, [0, y0, 0], [0, y0 + h, 0], [0, y0 + h, -t], [0, y0, -t], [-1, 0, 0]);
      M.quad(k, [L, y0, 0], [L, y0 + h, 0], [L, y0 + h, -t], [L, y0, -t], [1, 0, 0]);
    }
    M.restore();
  }
}

/* ---------- Background ---------- */
/* Distant building: plastered volume, facades with textured windows (farfacade, one bay per tile), simplified flat
   roof; no collision. */
function farBuilding(cx, cz, w, d, h, tint, R) {
  const M = DECOR, bw = 3.1, fh = 3.2;
  M.save().move(cx, 0, cz).color(tint);
  for (const [face, x0, x1, z0, z1] of [['s', -w / 2, w / 2, -d / 2, d / 2], ['n', -w / 2, w / 2, -d / 2, d / 2], ['e', -w / 2, w / 2, -d / 2, d / 2], ['w', -w / 2, w / 2, -d / 2, d / 2]]) {
    const F = facadeFrame(face, x0, x1, z0, z1), nb = Math.max(1, Math.round(F.len / bw)), sx = F.len / nb, nf = Math.max(1, Math.floor(h / fh));
    M.save().move(F.ox, 0, F.oz).rotY(F.rot);
    const B = M.buf('farfacade', F.len / 2, h / 2, 0);
    const q = [M.v(B, 0, 0, 0, 0, 0, 1, 0, 0), M.v(B, F.len, 0, 0, 0, 0, 1, nb, 0), M.v(B, F.len, nf * fh, 0, 0, 0, 1, nb, nf), M.v(B, 0, nf * fh, 0, 0, 0, 1, 0, nf)];
    M.quadI(B, q[0], q[1], q[2], q[3]);
    if (h > nf * fh + 0.05) M.quad('plaster', [0, nf * fh, 0], [F.len, nf * fh, 0], [F.len, h, 0], [0, h, 0], [0, 0, 1]);
    M.restore(); void sx;
  }
  M.world(1); M.boxB('concrete', -w / 2, w / 2, h, h + 0.05, -d / 2, d / 2, { skip: 'y' });
  M.local(1); M.boxB('plaster', -w / 2, w / 2, h, h + 0.6, -d / 2, -d / 2 + 0.2); M.boxB('plaster', -w / 2, w / 2, h, h + 0.6, d / 2 - 0.2, d / 2);
  if (R() < 0.5) M.place(PF.waterTank(), (R() - 0.5) * w * 0.5, h + 0.05, (R() - 0.5) * d * 0.5, 0, { tint: { plastic: [0.9, 0.9, 0.86] }, nocol: true });
  M.restore();
}
/* Minaret: square shaft, balcony on corbels, lantern, dome and crescent */
function minaret(x, z, h = 30, o = {}) {
  const M = DECOR;
  if (o.isRound) { minaretRound(x, z, h); return; }
  if (o.col) { WORLD.col({ x0: x - 2.2, x1: x + 2.2, y0: 0, y1: h * 0.72 + 0.6, z0: z - 2.2, z1: z + 2.2 }, 'concrete'); WORLD.col({ x0: x - 1.6, x1: x + 1.6, y0: h * 0.72 + 0.6, y1: h * 0.88, z0: z - 1.6, z1: z + 1.6 }, 'concrete'); }
  M.save().move(x, 0, z).color([0.95, 0.9, 0.8]).world(1);
  M.boxB('plaster', -2.2, 2.2, 0, h * 0.72, -2.2, 2.2);
  M.local(1); M.color([0.85, 0.78, 0.66]);
  for (let y = 6; y < h * 0.7; y += 6) M.boxB('ashlar', -2.28, 2.28, y, y + 0.3, -2.28, 2.28);
  M.boxB('ashlar', -2.9, 2.9, h * 0.72, h * 0.72 + 0.6, -2.9, 2.9, { bevel: 0.1 });
  M.color([0.95, 0.9, 0.8]).world(1); M.boxB('plaster', -1.6, 1.6, h * 0.72 + 0.6, h * 0.88, -1.6, 1.6);
  M.local(1); M.color([0.3, 0.55, 0.5]);
  M.save().move(0, h * 0.88, 0); M.lathe('paint', [[0, 0], [1.7, 0], [1.75, 0.2], [1.6, 1.2], [1.1, 2.3], [0.4, 2.9], [0, 3.0]], 16); M.restore();
  M.color([0.85, 0.7, 0.3]); M.save().move(0, h * 0.88 + 3, 0); M.cyl('steel', 0.06, 1.4, 6); M.restore();
  M.restore();
}
/* Round "pencil" minaret: cylindrical shaft with rings, balcony on brackets, lantern, conical lead spire (silhouette clearly distinct
   from the square minaret with a green cupola). Collision of the shaft and the lantern: it stops shots. */
function minaretRound(x, z, h) {
  const M = DECOR, r = 1.9, b = h * 0.68, l = h * 0.8;
  M.save().move(x, 0, z).color([0.96, 0.93, 0.86]).local(1);
  M.lathe('plaster', [[0, 0], [r + 0.3, 0], [r + 0.3, 2.4], [r, 2.6], [r * 0.92, b], [0, b]], 16, { sharp: 0.5 });
  M.color([0.85, 0.78, 0.66]);
  for (let y = 6; y < b - 1; y += 5) { M.save().move(0, y, 0); M.lathe('ashlar', [[r * 0.98 - 0.02, 0], [r * 0.98 + 0.08, 0], [r * 0.98 + 0.08, 0.3], [r * 0.98 - 0.02, 0.3]], 16); M.restore(); }
  M.save().move(0, b, 0); M.lathe('ashlar', [[0, -0.9], [r * 0.95, -0.9], [r + 0.7, 0], [r + 0.75, 0.2], [0, 0.2]], 16, { sharp: 0.5 }); M.restore();
  M.color([0.2, 0.2, 0.2]); M.save().move(0, b + 0.2, 0); M.lathe('steel', [[r + 0.66, 0], [r + 0.72, 0], [r + 0.72, 1.0], [r + 0.66, 1.0]], 24); M.restore();
  M.color([0.96, 0.93, 0.86]); M.save().move(0, b + 0.2, 0); M.lathe('plaster', [[0, 0], [r * 0.7, 0], [r * 0.7, l - b - 0.2], [0, l - b - 0.2]], 12); M.restore();
  M.color([0.05, 0.05, 0.05]); for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU; M.save().move(Math.cos(a) * r * 0.7, b + 1.2, Math.sin(a) * r * 0.7).rotY(-a + Math.PI / 2); M.boxB('dark', -0.25, 0.25, 0, 1.4, -0.01, 0.01); M.restore(); }
  M.color([0.42, 0.44, 0.48]); M.save().move(0, l, 0); M.lathe('paint', [[0, 0], [r * 0.8, 0], [r * 0.75, 0.2], [0.05, h - l - 1.2], [0, h - l - 1.1]], 16, { sharp: 0.8 }); M.restore();
  M.color([0.85, 0.7, 0.3]); M.save().move(0, h - 1.15, 0); M.cyl('steel', 0.05, 1.3, 6); M.save().move(0, 0.6, 0); M.lathe('steel', [[0, -0.12], [0.12, 0], [0, 0.12]], 8); M.restore(); M.restore();
  M.restore();
  WORLD.col({ x0: x - r, x1: x + r, y0: 0, y1: b, z0: z - r, z1: z + r }, 'concrete');
  WORLD.col({ x0: x - r * 0.7, x1: x + r * 0.7, y0: b, y1: l, z0: z - r * 0.7, z1: z + r * 0.7 }, 'concrete');
}
/* House with a white cupola */
function domeHouse(x, z, s = 1) {
  const M = DECOR;
  M.save().move(x, 0, z).color([0.96, 0.94, 0.9]).world(1);
  M.boxB('plaster', -7 * s, 7 * s, 0, 7 * s, -7 * s, 7 * s);
  M.local(1); M.save().move(0, 7 * s, 0); M.lathe('plaster', [[0, 0], [5.5 * s, 0], [5.5 * s, 0.8 * s], [5.2 * s, 2.5 * s], [4.2 * s, 4.4 * s], [2.4 * s, 5.8 * s], [0, 6.4 * s]], 20); M.restore();
  M.restore();
}
/* Dunes and hills beyond the town (ring of noisy relief, sand) */
function dunes(r0 = 150, r1 = 250) {
  const M = DECOR, N = makeNoise(99), nu = 72, nv = 10;
  WORLD.force = 'far';
  M.save().color([0.95, 0.85, 0.75]).local(1); M.cls = 1;
  M.surf('sand', nu, nv, (u, v) => {
    const a = u * TAU, r = lerp(r0, r1, v), x = Math.cos(a) * r, z = Math.sin(a) * r;
    const n = N.fbm(u, v, 12, 4, 4), ridge = 1 - Math.abs(N.fbm(u + 0.37, v, 6, 4, 3) * 2 - 1);
    return [x, -1 + smoothstep(0, 0.35, v) * (n * 22 + ridge * 18) * (0.4 + v * 0.8), z];
  }, { closeU: true, uL: 300, vL: 30 });
  M.restore(); WORLD.force = null;
}
