/* ==========================================================================
   JUNGLE OUTPOST, the command building (the owner's sheets 1 to 4): a 12 x 8 m two-level block of cast concrete in 1 m formwork
   panels with an ochre painted band at its foot, a flat roof behind a parapet (AC units, telecom mast, hatch), the olive corrugated
   awning on four concrete columns over the front, the single-story utility annex at the rear, the galvanized steel stair along the
   east gable up to the corridor door.
   Ground floor (sheet 3): the equipment preparation and assembly hall (four square columns, the preparation table and its benches in
   the middle, the reception desk along the west wall beside the entrance, two shelving units along the east wall, workbench and
   pegboard, lockers against the rear wall), the closed storage room in the rear right corner and, in the rear left corner, the
   concrete interior stair where the sheet has the utility room: the sink and the electrical panel are in the utility annex.
   Upper floor (sheet 2): the east-west corridor (2 m) between two bands of rooms 3 m deep: to the front the Supervisor, Planning and
   Shared offices (4 m each); to the rear the stair bay, the Radio office, the Briefing room and the kitchenette with its restroom.
   Interior stair: a dog-leg in the rear west bay, two flights side by side from the corridor line to a half landing against the rear
   wall (lower flight on the east, up to 1.6 m; upper flight along the west gable, its head at the west end of the corridor). The
   bots' network (03-nav.js) sets its size: 1 m cells, a node 0.42 m clear of walls (so the two lanes are the cell columns x -4.5 and
   -3.5: the bay is 2.7 m wide inside), at most 0.62 m of rise from one cell to the next (so each flight runs 2.6 m).
   Play: four ground entrances (front door, Alpha side; rear exit through the annex, Bravo side; a door on each gable: west beside
   the stair, east under the landing of the exterior stair), two ways up arriving at the two ends of the corridor; glazed windows
   stop soldiers but not shots, two sashes are slid open; the roofs are out of reach (parapet at 7 m, invisible caps over the awning
   and the annex).
   Frame: the map's own (centered on the origin), as on the sheets: front (entrance, awning) to the north (+z, the Alpha side), annex to the
   south (z -7 to -4), stair on the east gable (+x), its foot at the north end, climbing south to the landing at the corridor door. Seen
   from the front (from +z looking south), +x is on the viewer's right; in plan (front at the bottom, +x to the right) the rooms read
   like the floor plans of sheets 2 and 3.
   Prefabs, surfaces, materials and atlases: 02yoa-outpost-props.js.
   ========================================================================== */
/* Main block, wall thickness, upper floor level, roof slab top, parapet top (m) */
const OP_CP = { x0: -6, x1: 6, z0: -4, z1: 4, t: 0.25, F1: 3.2, roof: 6.6, top: 7.0 };
/* Plan: inner faces, ochre band outside and (lower, ground floor only) inside, ceilings (bottom of the slabs), corridor partitions (20 cm,
   centered on z = 1.05, front side, and -1.05, rear side), partitions of the front band (xf) and of the rear band (xr: stair bay | Radio |
   Briefing | kitchenette), the thin one between the kitchenette and the restroom (xk) */
const OPB = { xi: 5.75, zi: 3.75, band: 0.9, bandIn: 0.62, c0: 2.95, c1: 6.3, cf: 1.05, cr: -1.05, pt: 0.2, xf: [-2.0, 2.0], xr: [-2.95, -0.05, 3.6], xk: 4.8 };
/* Interior stair: divider between the two lanes (xd), east edge of the lower flight (xe), flights from the landing's edge (zl) to their
   foot and head (zt), landing height, where the upper floor resumes over the lower flight (zv: 1.9 m of headroom under the slab) */
const OP_IS = { xd: -4.0, xe: -3.05, zl: -2.55, zt: 0.05, hl: 1.6, zv: -1.66 };
/* Annex: half width, south face, height of its walls, bottom of its slab */
const OP_AX = { hw: 2.5, zs: -7.0, H: 3.35, hs: 2.85 };
/* Openings of the facades: a along the wall (x for the front and rear, z for the gables), b in height from the floor; kind door
   (dbl: two leaves), or window (glass, open: one sash slid behind its neighbor) */
const OP_OPS = {
  front0: [{ a0: -4.4, a1: -2.6, b0: 0, b1: 2.25, door: 1, dbl: 1 }, { a0: -0.55, a1: 1.55, b0: 1.2, b1: 2.5, win: 'glass' }, { a0: 2.45, a1: 4.55, b0: 1.2, b1: 2.5, win: 'glass' }],
  front1: [{ a0: -4.7, a1: -2.5, b0: 1.2, b1: 2.5, win: 'glass' }, { a0: -1.1, a1: 1.1, b0: 1.2, b1: 2.5, win: 'open' }, { a0: 2.5, a1: 4.7, b0: 1.2, b1: 2.5, win: 'glass' }],
  rear0: [{ a0: -0.1, a1: 1.1, b0: 0, b1: 2.2, door: 1 }],
  rear1: [{ a0: -2.8, a1: -0.6, b0: 1.2, b1: 2.5, win: 'glass' }, { a0: 1.1, a1: 3.3, b0: 1.2, b1: 2.5, win: 'open' }],
  west0: [{ a0: -2.25, a1: -0.65, b0: 1.2, b1: 2.5, win: 'glass' }, { a0: 0.05, a1: 1.25, b0: 0, b1: 2.2, door: 1 }],
  west1: [{ a0: -2.25, a1: -0.65, b0: 1.2, b1: 2.5, win: 'glass' }],
  east0: [{ a0: -1.05, a1: 0.05, b0: 0, b1: 2.2, door: 1 }],
  east1: [{ a0: -0.95, a1: 0.25, b0: 0, b1: 2.1, door: 1, bare: [-1, -1] }],
};

function opCommandPost() {
  opShell();
  opSlabs();
  opPartitions();
  opInnerStair();
  opAnnex();
  opAwning();
  opEastStair();
  opRoof();
  opFacadeDress();
  opWeather();
  opFurnishGround();
  opFurnishUpper();
  opLights();
}

/* ---------- Wall helpers ---------- */
/* Box in the frame of a wall: a along it, y up, n across it (toward +z for a wall along x, +x for a wall along z), fixed = its axis */
function opWB(axis, fixed, mat, a0, a1, y0, y1, n0, n1, o) {
  const M = DECOR, A0 = Math.min(a0, a1), A1 = Math.max(a0, a1), N0 = fixed + Math.min(n0, n1), N1 = fixed + Math.max(n0, n1);
  if (axis === 'x') M.boxB(mat, A0, A1, y0, y1, N0, N1, o); else M.boxB(mat, N0, N1, y0, y1, A0, A1, o);
}
const opWP = (axis, fixed, a, y, n) => (axis === 'x' ? [a, y, fixed + n] : [fixed + n, y, a]);
/* Frame of a wall face seen from in front of it: x to the viewer's right, y up, z out of the wall, origin (ox, oz) at its foot, turned by ry */
function opOnFace(ox, oz, ry, fn) { const M = DECOR; M.save().move(ox, 0, oz).rotY(ry); try { fn(M); } finally { M.restore(); } }
/* The same for side s of a wall (axis, fixed, thickness t): fn(M, k) with k the factor from the wall's a to the frame's x (1 or -1) */
function opOnSide(axis, fixed, t, s, fn) {
  const H = Math.PI / 2;
  if (axis === 'x') opOnFace(0, fixed + s * t / 2, s > 0 ? 0 : Math.PI, (M) => fn(M, s > 0 ? 1 : -1));
  else opOnFace(fixed + s * t / 2, 0, s > 0 ? H : -H, (M) => fn(M, s > 0 ? -1 : 1));
}
/* Through wall like wallOpen (02d-archi.js: the same collisions, two pierced facings with their reveals over half the thickness, the two
   ends), with a material and a tint per facing: mats and tints [side +1, side -1] (+1: toward +z for a wall along x, +x for a wall along
   z); end: [material, tint] of the two ends (the first facing's otherwise). No top course: a slab or a coping covers every wall here */
function opWallOpen(mats, tints, axis, fixed, t, a0, a1, y0, h, ops, end) {
  ops = ops.slice().sort((p, q) => p.a0 - q.a0);
  const col = (s0, s1, yb, yt) => {
    if (s1 - s0 < 0.01 || yt - yb < 0.01) return;
    if (axis === 'x') DECOR.col(s0, s1, yb, yt, fixed - t / 2, fixed + t / 2, 'concrete'); else DECOR.col(fixed - t / 2, fixed + t / 2, yb, yt, s0, s1, 'concrete');
  };
  let cur = a0;
  for (const op of ops) { col(cur, op.a0, y0, y0 + h); if (op.b0 > 0) col(op.a0, op.a1, y0, y0 + op.b0); if (op.b1 < h) col(op.a0, op.a1, y0 + op.b1, y0 + h); cur = op.a1; }
  col(cur, a1, y0, y0 + h);
  for (const side of [1, -1]) {
    const M = DECOR, k = side > 0 ? 0 : 1; M.save();
    // frame: origin at the start of the wall (seen from this side), z toward the outside of this facing
    if (axis === 'x') { if (side > 0) M.move(a0, 0, fixed + t / 2); else M.move(a1, 0, fixed - t / 2).rotY(Math.PI); }
    else { if (side > 0) M.move(fixed + t / 2, 0, a1).rotY(Math.PI / 2); else M.move(fixed - t / 2, 0, a0).rotY(-Math.PI / 2); }
    const L = a1 - a0, map = (a) => (axis === 'x' ? (side > 0 ? a - a0 : a1 - a) : (side > 0 ? a1 - a : a - a0));
    const lops = ops.map((p) => { const u0 = map(p.a0), u1 = map(p.a1); return { x0: Math.min(u0, u1), x1: Math.max(u0, u1), y0: y0 + p.b0, y1: y0 + Math.min(p.b1, h), rise: 0 }; });
    M.color(tints[k]).world(1);
    M.aoFn = (x, y) => lerp(0.86, 1, smoothstep(y0, y0 + 1.0, y)); // (scuffed, darker foot)
    wallPierced(M, mats[k], L, y0, h, lops.map((p) => ({ ...p, depth: t / 2 })), { floorY: y0, aoFn: M.aoFn });
    M.aoFn = null;
    if (side > 0) {
      const [em, et] = end || [mats[0], tints[0]]; M.color(et).world(1);
      M.quad(em, [0, y0, 0], [0, y0 + h, 0], [0, y0 + h, -t], [0, y0, -t], [-1, 0, 0]);
      M.quad(em, [L, y0, 0], [L, y0 + h, 0], [L, y0 + h, -t], [L, y0, -t], [1, 0, 0]);
    }
    M.restore();
  }
}
/* Building wall: the pierced wall (cast concrete outside, painted inside; o.out: side of the exterior, +1 or -1; a partition otherwise) and
   the ochre band painted at its foot (o.band: sides +1 / -1 across the wall; [] for none; never inside upstairs), interrupted by the
   doorways and their casings */
function opWall(axis, fixed, a0, a1, y0, h, ops, o = {}) {
  const t = o.t || OP_CP.t, out = o.out || 0, mat = (s) => (s === out ? 'opPanel' : 'opWallIn'), tint = (s) => (s === out ? OPC.wall : OPC.wallIn);
  opWallOpen([mat(1), mat(-1)], [tint(1), tint(-1)], axis, fixed, t, a0, a1, y0, h, ops.map((p) => ({ a0: p.a0, a1: p.a1, b0: p.b0, b1: p.b1 })), out ? ['opPanel', OPC.wall] : null);
  opBand(axis, fixed, t, o.bandA ? o.bandA[0] : a0, o.bandA ? o.bandA[1] : a1, y0, ops, o.band || [1, -1], [0, 0], out);
  for (const p of ops) if (p.door) opDoorFrame(axis, fixed, t, p.a0, p.a1, y0 + p.b0, y0 + p.b1, p.bare);
}
/* The band on the given sides of a wall: lengths of 2 m at most of the band cell of the weathering atlas (ragged top edge, chips, a dirty
   foot), a few millimeters off the wall; outside 0.9 m high, inside (ground floor only) lower and more worn */
function opBand(axis, fixed, t, a0, a1, y0, ops, sides, ext = [0, 0], out = 0) {
  const cuts = ops.filter((p) => p.b0 < 0.5).map((p) => [p.a0 - (p.door ? 0.065 : 0), p.a1 + (p.door ? 0.065 : 0)]).sort((p, q) => p[0] - q[0]);
  for (const s of sides) {
    const up = s !== out && y0 > 1; // (inside upstairs: no band, the scuffs only)
    const segs = []; let cur = a0 - ext[0];
    for (const [c0, c1] of cuts) { if (c0 - cur > 0.02) segs.push([cur, c0]); cur = Math.max(cur, c1); }
    if (a1 + ext[1] - cur > 0.02) segs.push([cur, a1 + ext[1]]);
    opOnSide(axis, fixed, t, s, (M, k) => { for (const [p, q] of segs) {
      const u0 = Math.min(k * p, k * q), u1 = Math.max(k * p, k * q);
      if (!up) opBandRun(M, u0, u1, y0, s === out);
      if (s !== out) opScuffRun(M, u0, u1, y0 + (up ? 0.7 : OPB.bandIn - 0.12));
      if (s !== out) { // the shade of the junction with the floor (upstairs: where there is a floor, not over the stairwell)
        const yf = y0 < 1 ? 0.019 : y0 + 0.005, n = fixed + s * (t / 2 + 0.07), st = y0 < 1 ? 99 : 0.5;
        const on = (a) => y0 < 1 || OP_FLOOR1.some(([x0, x1, z0, z1]) => (axis === 'x' ? a : n) > x0 && (axis === 'x' ? a : n) < x1 && (axis === 'x' ? n : a) > z0 && (axis === 'x' ? n : a) < z1);
        M.save().color(OPC.shade); M.cls = 2;
        for (let a = p; a < q - 0.01; a += st) { const b = Math.min(q, a + st); if (on((a + b) / 2)) opbEdgeStrip(M, Math.max(k * a, k * b), 0, Math.min(k * a, k * b), 0, 0.14, yf); }
        M.restore();
      } else if (y0 < 1) { // outside: small chips down to the concrete where the band ends (corners, door jambs)
        M.save().color([0.5, 0.49, 0.47]); M.cls = 2;
        for (const [ux, fl] of [[u0, false], [u1, true]]) {
          opStain(M, OPW.chip, fl ? ux - 0.36 : ux, fl ? ux : ux + 0.36, y0 + 0.74, y0 + 0.84, 0.0065, fl);
          opStain(M, OPW.chip, fl ? ux - 0.3 : ux, fl ? ux : ux + 0.3, y0 + 0.32, y0 + 0.4, 0.0065, fl, 0.83);
        }
        M.restore();
      }
    } });
  }
}
function opBandRun(M, x0, x1, y0, outside, z = 0.005) {
  const h = outside ? OPB.band : OPB.bandIn, cell = outside ? OPW.bandOut : OPW.bandIn;
  M.save().color(outside ? OPC.ochre : OPC.ochreIn); M.cls = 1;
  for (let x = x0; x < x1 - 0.01; x += 2) { const xe = Math.min(x1, x + 2); opStain(M, cell, x, xe, y0, y0 + h, z, false, (xe - x) / 2, 'opDado'); }
  M.restore();
}
/* Grime on a painted inner face: a soft soiled lane with patches, above the band downstairs, at hand height upstairs */
function opScuffRun(M, x0, x1, y, h = 0.5, z = 0.007) {
  M.save().color([0.24, 0.225, 0.2]); M.cls = 2;
  for (let x = x0; x < x1 - 0.3; x += 2.6) { const xe = Math.min(x1, x + 2.6); opStain(M, OPW.wear, x, xe, y, y + h, z, false, (xe - x) / 2.6); }
  M.restore();
}
/* The band around a square post or column (x0..x1, z0..z1) */
function opBandBox(x0, x1, z0, z1, y0, outside) {
  const H = Math.PI / 2, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hw = (x1 - x0) / 2, hd = (z1 - z0) / 2;
  for (const [ox, oz, ry, w] of [[cx, z1, 0, hw], [cx, z0, Math.PI, hw], [x1, cz, H, hd], [x0, cz, -H, hd]]) opOnFace(ox, oz, ry, (M) => {
    opBandRun(M, -w, w, y0, outside, 0.0015);
    if (!outside) { M.save().color(OPC.shade); M.cls = 2; opbEdgeStrip(M, w, 0, -w, 0, 0.14, 0.019); M.restore(); } // (a hall column: the shade at its foot)
    if (outside) { M.cls = 2; M.color(OPC.mud); opStain(M, OPW.splash, -w, w, y0 + 0.3, y0 + 0.62, 0.004, false, w); } // (mud splashed over the plinth)
  });
}
/* Tint of a door leaf (k = 1) and of its frame and trims (k below 1): the olive family, lifted where the door stands in the shade */
const opLeafTint = (axis, fixed, y0, k = 1) => OPC.leaf.map((v) => v * k * (y0 < 1 ? (axis === 'z' ? (fixed > 0 ? 1.05 : 1.6) : fixed < -6 ? 1.2 : fixed > 3 ? 1.5 : 1.05) : 1.0));
/* Steel door frame (casing) on both faces: dark olive, 6 cm wide, 2.5 cm proud (bare: [side, end] of a jamb left without, where a wall meets it) */
function opDoorFrame(axis, fixed, t, a0, a1, y0, y1, bare) {
  const M = DECOR; M.save().color(opLeafTint(axis, fixed, y0, 0.93)).local(1); M.cls = 1;
  for (const s of [1, -1]) {
    const n0 = s * t / 2, n1 = s * (t / 2 + 0.025);
    if (!(bare && bare[0] === s && bare[1] < 0)) opWB(axis, fixed, 'opPaint', a0 - 0.06, a0, y0, y1 + 0.06, n0, n1);
    if (!(bare && bare[0] === s && bare[1] > 0)) opWB(axis, fixed, 'opPaint', a1, a1 + 0.06, y0, y1 + 0.06, n0, n1);
    opWB(axis, fixed, 'opPaint', a0, a1, y1, y1 + 0.06, n0, n1);
  }
  // lining of the reveal (head and jambs), steel threshold
  opWB(axis, fixed, 'opPaint', a0, a0 + 0.012, y0, y1, -t / 2, t / 2); opWB(axis, fixed, 'opPaint', a1 - 0.012, a1, y0, y1, -t / 2, t / 2); opWB(axis, fixed, 'opPaint', a0, a1, y1 - 0.012, y1, -t / 2, t / 2);
  M.color([0.5, 0.51, 0.5]); opWB(axis, fixed, 'opInox', a0, a1, y0, y0 + 0.02, -t / 2, t / 2);
  M.restore();
}
/* Door leaf (olive steel, a narrow slit of dark glass beside the lock, kick plate, handle) hinged at a = aH on face side s of the wall, opened
   by ang (rad) from closed toward the direction dir (+1: increasing a); near pi it lies back against the wall (no collision); otherwise it
   stands out and stops soldiers */
function opLeaf(axis, fixed, t, aH, y0, h, w, s, dir, ang = 2.98, col = ang <= 2.8) {
  const M = DECOR, [hx, , hz] = opWP(axis, fixed, aH + dir * 0.03, 0, s * (t / 2 + (ang > 2.8 ? 0.03 : 0.004)));
  // closed: the leaf runs along the wall toward -dir (across the opening); opened by ang about the hinge, toward the side s
  const ca = Math.cos(ang), sa = Math.sin(ang), ua = -dir * ca, un = s * sa, vx = axis === 'x' ? ua : un, vz = axis === 'x' ? un : ua;
  const ry = Math.atan2(-vz, vx);
  M.save().move(hx, y0, hz).rotY(ry).color(opLeafTint(axis, fixed, y0)).local(1); M.cls = ang > 2.8 ? 1 : 0; // (ground floor: the leaves stand in the shade)
  M.boxB('opPaint', 0, w, 0.01, h - 0.01, -0.022, 0.022, { bevel: 0.006 });
  M.cls = 2; M.color(opLeafTint(axis, fixed, y0, 0.86));
  for (const sd of [-1, 1]) {
    M.boxB('opPaint', 0.06, w - 0.06, 0.06, 0.3, sd * 0.022, sd * 0.027);
    // slit: its steel surround, the glass
    const x0 = w - 0.32, x1 = w - 0.18, q0 = h * 0.56, q1 = h * 0.84;
    M.boxB('opPaint', x0 - 0.025, x1 + 0.025, q0 - 0.025, q1 + 0.025, sd * 0.022, sd * 0.026);
    M.save().color(OPC.glass); M.quad('opGlass', [x0, q0, sd * 0.03], [x1, q0, sd * 0.03], [x1, q1, sd * 0.03], [x0, q1, sd * 0.03], [0, 0, sd]); M.restore();
  }
  M.color(OPC.handle); for (const sd of [-1, 1]) M.boxB('opInox', w - 0.13, w - 0.05, 0.98, 1.02, sd * 0.022, sd * 0.07);
  // wear on both faces: scuffs on the kick plate, grime around the handle, rust creeping up from the bottom edge
  for (const sd of [1, -1]) {
    M.save(); if (sd < 0) M.move(w, 0, 0).rotY(Math.PI); M.cls = 2;
    M.color([0.14, 0.13, 0.11]); opStain(M, OPW.wear, 0.05, w - 0.05, 0.04, 0.42, 0.0285);
    M.color([0.25, 0.27, 0.2]); opStain(M, OPW.blob, sd > 0 ? w - 0.2 : 0.0, sd > 0 ? w : 0.2, 0.9, 1.1, 0.0285);
    M.color([0.3, 0.17, 0.09]); opStain(M, OPW.splash, 0, w, 0.01, 0.2, 0.0287);
    M.restore();
  }
  M.restore();
  if (col) { M.save().move(hx, y0, hz).rotY(ry); M.col(0, w, 0, h, -0.03, 0.03, 'metal'); M.restore(); }
}
/* Window unit at the middle of the wall: dark olive steel frame, mullions, panes of dark tinted glass (state 'glass') or the sliding sash
   pushed open ('open'); concrete sill outside (out: side of the exterior); glassWall in the opening (stops soldiers, not shots) */
function opWindow(axis, fixed, t, a0, a1, y0, y1, out, state) {
  const M = DECOR, f = 0.065, d = 0.04, w = a1 - a0, n = w > 2.6 ? 3 : w > 0.9 ? 2 : 1, pw = (w - 2 * f) / n;
  M.save().color(OPC.frame).local(1); M.cls = 1;
  opWB(axis, fixed, 'opPaint', a0, a0 + f, y0, y1, -d, d); opWB(axis, fixed, 'opPaint', a1 - f, a1, y0, y1, -d, d);
  opWB(axis, fixed, 'opPaint', a0 + f, a1 - f, y1 - f, y1, -d, d); opWB(axis, fixed, 'opPaint', a0 + f, a1 - f, y0, y0 + f, -d, d);
  for (let i = 1; i < n; i++) { const a = a0 + f + i * pw; opWB(axis, fixed, 'opPaint', a - 0.025, a + 0.025, y0 + f, y1 - f, -d + 0.005, d - 0.005); }
  M.restore();
  M.save().color(OPC.glass);
  const nrm = axis === 'x' ? [0, 0, out] : [out, 0, 0], nin = nrm.map((v) => -v), P = (a, y, nn) => opWP(axis, fixed, a, y, nn);
  // a pane: its outer face (dark, reflective), its inner face (clearer) 4 mm behind, and what casts its shadow (tinted glass lets little sun in)
  // the outer face: green-grey, lighter toward its head (the sky it mirrors), greener toward its foot (the foliage)
  const glz = (a0p, a1p, q0, q1, nn) => {
    const fw = axis === 'x' ? out > 0 : out < 0, aa = fw ? a0p : a1p, ab = fw ? a1p : a0p, c = P((a0p + a1p) / 2, (q0 + q1) / 2, nn);
    M.save().local(1); const B = M.buf('opGlass', c[0], c[1], c[2]);
    const ids = [[aa, q0, 0], [ab, q0, 0], [ab, q1, 1], [aa, q1, 1]].map(([a, y, top]) => { const p = P(a, y, nn); M.color(top ? (q0 > 3 ? OPC.glassSkyUp : OPC.glassSky) : OPC.glassLeaf); return M.v(B, p[0], p[1], p[2], nrm[0], nrm[1], nrm[2], 0, 0); });
    M.quadI(B, ids[0], ids[1], ids[2], ids[3]); M.restore();
  };
  const pane = (a0p, a1p, q0, q1, nn) => {
    M.cls = 1;
    glz(a0p, a1p, q0, q1, nn);
    M.quad('opGlassIn', P(a0p, q0, nn - out * 0.004), P(a1p, q0, nn - out * 0.004), P(a1p, q1, nn - out * 0.004), P(a0p, q1, nn - out * 0.004), nin);
    M.cls = 0; M.quad('opShade', P(a0p, q0, nn - out * 0.034), P(a1p, q0, nn - out * 0.034), P(a1p, q1, nn - out * 0.034), P(a0p, q1, nn - out * 0.034), nrm);
  };
  for (let i = 0; i < n; i++) {
    const p0 = a0 + f + i * pw + (i ? 0.025 : 0), p1 = a0 + f + (i + 1) * pw - (i < n - 1 ? 0.025 : 0), q0 = y0 + f, q1 = y1 - f;
    if (state === 'glass' || i !== n - 1) pane(p0, p1, q0, q1, 0);
    else { // the sash slid behind its neighbor, toward the inside, with its frame
      const sh = -pw + 0.03, nn = -out * 0.052;
      pane(p0 + sh, p1 + sh, q0, q1, nn);
      M.cls = 1; M.quad('opVeil', P(p0, q0, 0), P(p1, q0, 0), P(p1, q1, 0), P(p0, q1, 0), nrm); // (from the yard the opening reads as a dim room; nothing from inside)
      M.save().color(OPC.frame).local(1); M.cls = 1; opWB(axis, fixed, 'opPaint', p0 + sh - 0.02, p0 + sh + 0.02, q0, q1, nn - 0.012, nn + 0.012); opWB(axis, fixed, 'opPaint', p1 + sh - 0.02, p1 + sh + 0.02, q0, q1, nn - 0.012, nn + 0.012); M.restore();
    }
  }
  M.restore();
  // concrete sill outside, lightly overhanging
  M.save().color(OPC.wall).world(1);
  opWB(axis, fixed, 'opPanel', a0 - 0.06, a1 + 0.06, y0 - 0.05, y0 + 0.012, out * 0.04, out * (t / 2 + 0.05), { bevel: 0.01 });
  M.restore();
  if (axis === 'x') glassWall(a0, a1, y0, y1, fixed - 0.04, fixed + 0.04); else glassWall(fixed - 0.04, fixed + 0.04, y0, y1, a0, a1);
}

/* ---------- Shell: the four facades, two levels, parapet ---------- */
/* The facades: [axis, plane of the wall's middle, a0, a1, side of the exterior, name] */
function opFacades() {
  const C = OP_CP, t = C.t, zi = OPB.zi;
  return [['x', C.z1 - t / 2, C.x0, C.x1, 1, 'front'], ['x', C.z0 + t / 2, C.x0, C.x1, -1, 'rear'], ['z', C.x0 + t / 2, -zi, zi, -1, 'west'], ['z', C.x1 - t / 2, -zi, zi, 1, 'east']];
}
function opShell() {
  const C = OP_CP, t = C.t, H0 = C.F1, xi = OPB.xi, A = OP_AX;
  for (const [axis, fixed, a0, a1, out, k] of opFacades()) {
    const o0 = OP_OPS[k + '0'], o1 = OP_OPS[k + '1'];
    const bandA = axis === 'x' ? [-xi, xi] : null; // (the inner band stops at the gables)
    opWall(axis, fixed, a0, a1, 0, H0, o0, { band: [-out], out, bandA });
    opWall(axis, fixed, a0, a1, H0, C.roof - H0, o1, { band: [-out], out, bandA });
    // parapet: cast concrete on both faces
    opWallOpen(['opPanel', 'opPanel'], [OPC.wall, OPC.wall], axis, fixed, t, a0, a1, C.roof, C.top - C.roof, []);
    // outside band of the facade, from corner to corner (not behind the annex)
    opBand(axis, fixed, t, axis === 'x' ? a0 : a0 - 0.25, axis === 'x' ? a1 : a1 + 0.25, 0, k === 'rear' ? o0.concat([{ a0: -A.hw, a1: A.hw, b0: 0 }]) : o0, [out], [0, 0], out);
    for (const p of o0.concat(o1.map((q) => ({ ...q, b0: q.b0 + H0, b1: q.b1 + H0 })))) if (p.win) opWindow(axis, fixed, t, p.a0, p.a1, p.b0, p.b1, out, p.win);
  }
  const M = DECOR;
  // the edge of the upper floor slab outside (drip groove of the cast)
  M.save().color([0.6, 0.59, 0.55]).world(1); M.cls = 2;
  for (const [x0, x1, z0, z1] of [[C.x0 - 0.008, C.x1 + 0.008, C.z0 - 0.008, C.z0], [C.x0 - 0.008, C.x1 + 0.008, C.z1, C.z1 + 0.008], [C.x0 - 0.008, C.x0, C.z0, C.z1], [C.x1, C.x1 + 0.008, C.z0, C.z1]]) M.boxB('opPanel', x0, x1, H0 - 0.025, H0, z0, z1);
  M.restore();
  // the parapet's cap band: its whole height (6.6 to 7.0), 14 cm proud of the facades all around, and its coping
  M.save().color(OPC.wall).world(1);
  const pb = 0.14, y0 = C.roof;
  M.boxB('opPanel', C.x0 - pb, C.x1 + pb, y0, C.top, C.z1, C.z1 + pb, { skip: 'Yz' }); M.boxB('opPanel', C.x0 - pb, C.x1 + pb, y0, C.top, C.z0 - pb, C.z0, { skip: 'YZ' });
  M.boxB('opPanel', C.x0 - pb, C.x0, y0, C.top, C.z0, C.z1, { skip: 'YXzZ' }); M.boxB('opPanel', C.x1, C.x1 + pb, y0, C.top, C.z0, C.z1, { skip: 'YxzZ' });
  const cp = 0.19; M.color(OPC.coping); // (its top takes the full sun: tinted down to the walls' tone)
  M.boxB('opPanel', C.x0 - cp, C.x1 + cp, C.top, C.top + 0.08, C.z0 - cp, C.z0 + t + 0.03, { bevel: 0.012 });
  M.boxB('opPanel', C.x0 - cp, C.x1 + cp, C.top, C.top + 0.08, C.z1 - t - 0.03, C.z1 + cp, { bevel: 0.012 });
  M.boxB('opPanel', C.x0 - cp, C.x0 + t + 0.03, C.top, C.top + 0.08, C.z0 + t + 0.03, C.z1 - t - 0.03, { bevel: 0.012 });
  M.boxB('opPanel', C.x1 - t - 0.03, C.x1 + cp, C.top, C.top + 0.08, C.z0 + t + 0.03, C.z1 - t - 0.03, { bevel: 0.012 });
  M.restore();
  // plinth course at the foot of the rear facade and the gables (the porch slab runs along the front), between the doorways and the annex
  M.save().color(OPC.plinth).world(1); M.cls = 1;
  const pl = 0.03, ph = 0.13, gap = (ops) => ops.filter((p) => p.door).map((p) => [p.a0 - 0.065, p.a1 + 0.065]);
  const runs = (a0, a1, cuts) => { const r = []; let c = a0; for (const [p, q] of cuts.sort((u, v) => u[0] - v[0])) { if (p > c) r.push([c, p]); c = Math.max(c, q); } if (a1 > c) r.push([c, a1]); return r; };
  for (const [x0, x1] of runs(C.x0 - pl, C.x1 + pl, [[-A.hw, A.hw]])) M.boxB('opPanel', x0, x1, 0, ph, C.z0 - pl, C.z0, { skip: 'yZ', bevel: 0.008 });
  for (const [z0, z1] of runs(C.z0, C.z1, gap(OP_OPS.west0))) M.boxB('opPanel', C.x0 - pl, C.x0, 0, ph, z0, z1, { skip: 'yX', bevel: 0.008 });
  for (const [z0, z1] of runs(C.z0, C.z1, gap(OP_OPS.east0))) M.boxB('opPanel', C.x1, C.x1 + pl, 0, ph, z0, z1, { skip: 'yx', bevel: 0.008 });
  for (const [x0, x1] of runs(-A.hw - pl, A.hw + pl, [[-0.165, 1.165]])) M.boxB('opPanel', x0, x1, 0, ph, A.zs - pl, A.zs, { skip: 'yZ', bevel: 0.008 });
  for (const s of [-1, 1]) M.boxB('opPanel', s > 0 ? A.hw : -A.hw - pl, s > 0 ? A.hw + pl : -A.hw, 0, ph, A.zs, C.z0 - pl, { skip: s > 0 ? 'yx' : 'yX', bevel: 0.008 });
  M.restore();
}

/* ---------- Slabs: ground floor, upper floor (with the stairwell), roof ---------- */
/* Rectangles of the upper floor around the stairwell (the upper flight's lane, the landing, the high end of the lower flight) */
const OP_FLOOR1 = [[-OPB.xi, OPB.xi, OP_IS.zt, OPB.zi], [OP_IS.xd + 0.05, OPB.xi, OP_IS.zv, OP_IS.zt], [OP_IS.xe, OPB.xi, -OPB.zi, OP_IS.zv]];
function opSlabs() {
  const M = DECOR, C = OP_CP, F1 = C.F1, xi = OPB.xi, zi = OPB.zi, S = OP_IS, xg = S.xd + 0.05;
  // ground floor: troweled concrete
  M.save().color(OPC.floor).world(1); M.cls = 1;
  M.quad('opFloor', [-xi, 0.012, -zi], [xi, 0.012, -zi], [xi, 0.012, zi], [-xi, 0.012, zi], [0, 1, 0]);
  M.restore();
  M.save().color([0.33, 0.32, 0.29]).local(1); M.cls = 2;
  for (const x of [-4, -2, 0, 2, 4]) M.boxB('opFloor', x - 0.006, x + 0.006, 0.012, 0.0155, -zi, zi, { skip: 'y' });
  for (const z of [-2, 0, 2]) M.boxB('opFloor', -xi, xi, 0.012, 0.0155, z - 0.006, z + 0.006, { skip: 'y' });
  // stains: at the four doors, around the drain, under the preparation table, along the shelving (hall and storage room)
  M.color([0.38, 0.36, 0.325]);
  for (const [x, z, hx, hz] of [[-3.5, 3.1, 1.2, 0.75], [0.5, -3.1, 1.0, 0.75], [-5.1, 0.65, 0.7, 0.9], [5.1, -0.5, 0.7, 0.9], [0.5, 2.6, 0.8, 0.8], [0, 0, 1.0, 1.6], [4.95, 1.93, 0.75, 2.0], [4.05, -3.2, 1.1, 0.55], [3.7, -2.5, 0.55, 0.8]]) opStainFlat(M, OPW.blob, x - hx, x + hx, z - hz, z + hz, 0.017);
  M.restore();
  // upper floor slab: collisions, tiles on top, concrete ceiling below, edges around the stairwell
  for (const [x0, x1, z0, z1] of OP_FLOOR1) {
    DECOR.col(x0, x1, OPB.c0, F1, z0, z1, 'concrete');
    M.save().color(OPC.tiles).world(1); M.cls = 1; M.quad('opVinyl', [x0, F1, z0], [x1, F1, z0], [x1, F1, z1], [x0, F1, z1], [0, 1, 0]); M.restore();
    M.save().color(OPC.ceil).world(1); M.cls = 1; M.quad('opCeil', [x0, OPB.c0 - 0.004, z0], [x1, OPB.c0 - 0.004, z0], [x1, OPB.c0 - 0.004, z1], [x0, OPB.c0 - 0.004, z1], [0, -1, 0]); M.restore(); // (4 mm under the wall tops: no crack of light)
  }
  M.save().color(OPC.wallIn).world(1);
  M.quad('opWallIn', [-xi, OPB.c0, S.zt], [xg, OPB.c0, S.zt], [xg, F1, S.zt], [-xi, F1, S.zt], [0, 0, -1]);
  M.quad('opWallIn', [xg, OPB.c0, S.zt], [xg, OPB.c0, S.zv], [xg, F1, S.zv], [xg, F1, S.zt], [-1, 0, 0]);
  M.quad('opWallIn', [xg, OPB.c0, S.zv], [S.xe, OPB.c0, S.zv], [S.xe, F1, S.zv], [xg, F1, S.zv], [0, 0, -1]);
  M.quad('opWallIn', [S.xe, OPB.c0, S.zv], [S.xe, OPB.c0, -zi], [S.xe, F1, -zi], [S.xe, F1, S.zv], [-1, 0, 0]);
  M.restore();
  // roof slab: collision, ceiling below, roofing on top (gray membrane over the concrete)
  DECOR.col(-xi, xi, OPB.c1, C.roof, -zi, zi, 'concrete');
  M.save().color(OPC.ceil).world(1); M.cls = 1; M.quad('opCeilUp', [-xi, OPB.c1 - 0.004, -zi], [xi, OPB.c1 - 0.004, -zi], [xi, OPB.c1 - 0.004, zi], [-xi, OPB.c1 - 0.004, zi], [0, -1, 0]); M.restore();
  M.save().color([0.42, 0.415, 0.4]).world(1); M.quad('opRoof', [-xi, C.roof, -zi], [xi, C.roof, -zi], [xi, C.roof, zi], [-xi, C.roof, zi], [0, 1, 0]); M.restore();
  M.save().color([0.15, 0.14, 0.12]); M.cls = 2;
  for (const x of [-4.95, 4.95]) opStainFlat(M, OPW.blob, x - 0.8, x + 0.8, -3.75, -2.5, C.roof + 0.004);
  opStainFlat(M, OPW.drip0, 3.45, 1.15, -0.67, -2.5, C.roof + 0.004); opStainFlat(M, OPW.drip1, -3.9, -4.9, 2.0, 0.6, C.roof + 0.004); opStainFlat(M, OPW.streak, 4.8, 4.0, -1.0, -2.6, C.roof + 0.004);
  M.restore();
}

/* ---------- Partitions: storage room and stair wall (ground floor), offices, rooms and corridor (upper floor) ---------- */
function opPartitions() {
  const F1 = OP_CP.F1, pt = OPB.pt, h1 = OPB.c1 - F1, h0 = OPB.c0, xi = OPB.xi, zi = OPB.zi, cf = OPB.cf, cr = OPB.cr, [xa, xb, xc] = OPB.xr;
  const door = (c, h = 2.1) => ({ a0: c - 0.6, a1: c + 0.6, b0: 0, b1: h, door: 1 });
  // storage room (x 3.1 to 5.75, z -3.75 to -1.85), closed: one door to the hall, centered on x 4.5
  opWall('x', -1.75, 2.9, xi, 0, h0, [door(4.5)], { t: pt });
  opWall('z', 3.0, -zi, -1.85, 0, h0, [], { t: pt });
  // the wall between the stair and the hall (the foot of the lower flight stays open)
  opWall('z', xa, -zi, -0.3, 0, h0, [], { t: pt, band: [1] });
  // upper floor: corridor walls; front band (Supervisor | Planning | Shared); rear band (stair bay, open to the corridor | Radio | Briefing |
  // kitchenette, restroom)
  opWall('x', cf, -xi, xi, F1, h1, [door(-3.5), { a0: 0.6, a1: 1.8, b0: 0, b1: 2.1, door: 1 }, door(4.5)], { t: pt });
  opWall('x', cr, xa + pt / 2, xi, F1, h1, [door(-1.5), door(2.5), { a0: 3.76, a1: 4.96, b0: 0, b1: 2.1, door: 1 }], { t: pt });
  for (const x of OPB.xf) opWall('z', x, cf + pt / 2, zi, F1, h1, [], { t: pt });
  opWall('z', xa, -zi, cr + pt / 2, F1, h1, [], { t: pt });
  for (const x of [xb, xc]) opWall('z', x, -zi, cr - pt / 2, F1, h1, [], { t: pt });
  // restroom: a closed compartment across the rear of the room (0.9 m deep) behind a thin cross partition, its door at the west end
  opWall('x', -2.8, xc + pt / 2, xi, F1, h1, [{ a0: 3.76, a1: 4.56, b0: 0, b1: 2.05, door: 1 }], { t: 0.1 });
  // the hall's four square columns (40 cm, on cell centers: each one takes a single node of the network), their band
  const M = DECOR;
  for (const [x, z] of [[-2.5, 2.5], [2.5, 2.5], [-2.5, -0.5], [2.5, -0.5]]) {
    M.save().color(OPC.wallIn).world(1); M.aoFn = (px, y) => lerp(0.74, 1, smoothstep(0, 1.0, y)); M.boxB('opWallIn', x - 0.2, x + 0.2, 0, h0, z - 0.2, z + 0.2, { skip: 'yY' }); M.restore();
    DECOR.col(x - 0.2, x + 0.2, 0, h0, z - 0.2, z + 0.2, 'concrete');
    opBandBox(x - 0.2, x + 0.2, z - 0.2, z + 0.2, 0, false);
  }
  // the stair wall runs up to the north-west column: the 15 cm between them is filled (no slit beside the foot of the flight)
  M.save().color(OPC.wallIn).world(1); M.boxB('opWallIn', -2.85, -2.7, 0, h0, -0.7, -0.3, { skip: 'yYxX' }); M.restore();
  DECOR.col(-2.85, -2.7, 0, h0, -0.7, -0.3, 'concrete');
  opOnFace(-2.875, -0.3, 0, (MM) => opBandRun(MM, -0.175, 0.175, 0, false)); opOnFace(-2.775, -0.7, Math.PI, (MM) => opBandRun(MM, -0.075, 0.075, 0, false));
  // leaves: flat against a wall where there is room (the Radio office's on the corridor side: the room is too narrow for it); storage and
  // Planning doors square to their partition, into the room; none at the kitchenette (it would fill the room)
  opLeaf('x', -1.75, pt, 5.1, 0, 2.08, 1.15, -1, 1, Math.PI / 2);
  opLeaf('x', cf, pt, -4.1, F1, 2.08, 1.15, 1, -1); opLeaf('x', cf, pt, 1.8, F1, 2.08, 1.15, 1, 1, Math.PI / 2, false); opLeaf('x', cf, pt, 3.9, F1, 2.08, 1.12, 1, -1);
  opLeaf('x', cr, pt, -0.9, F1, 2.08, 1.12, 1, 1); opLeaf('x', cr, pt, 1.9, F1, 2.08, 1.12, -1, -1);
  // kitchenette and restroom leaves: standing open against the west partition
  opLeaf('x', cr, pt, 3.76, F1, 2.08, 1.15, -1, -1, Math.PI / 2, false); opLeaf('x', -2.8, 0.1, 3.76, F1, 2.03, 0.76, -1, -1, Math.PI / 2, false);
}

/* ---------- Interior stair: a dog-leg in the rear west bay. Lower flight in the east lane (foot at the corridor line, in the hall), half
   landing against the rear wall at 1.6 m, upper flight in the west lane along the gable, its head at the west end of the corridor ---------- */
function opInnerStair() {
  const M = DECOR, F1 = OP_CP.F1, xi = OPB.xi, zi = OPB.zi, S = OP_IS, hl = S.hl, xg = S.xd + 0.05;
  ramp(xg, S.xe, S.zl, S.zt, 'z', hl, 0, 'concrete', OPC.floor, { mat: 'opFloor' });
  ramp(-xi, S.xd, S.zl, S.zt, 'z', hl, F1, 'concrete', OPC.floor, { mat: 'opFloor' });
  M.save().color(OPC.floor).world(1); M.boxB('opFloor', -xi, S.xe, 0, hl, -zi, S.zl, { skip: 'yxXz' }); M.restore();
  // the faces of its block toward the hall and beside the lower flight: painted like the walls, the band along the foot
  M.save().color(OPC.wallIn).world(1); M.cls = 1;
  M.boxB('opWallIn', -xi, S.xd, 0, F1 - 0.05, S.zt, S.zt + 0.004, { skip: 'zxXyY' });
  M.quad('opWallIn', [S.xd + 0.004, 0, S.zt], [S.xd + 0.004, 0, S.zl], [S.xd + 0.004, hl, S.zl], [S.xd + 0.004, F1, S.zt], [1, 0, 0]);
  M.restore();
  opOnFace((S.xd - xi) / 2, S.zt, 0, (MM) => { opBandRun(MM, -(S.xd + xi) / 2, (S.xd + xi) / 2, 0, false, 0.012); opScuffRun(MM, -(S.xd + xi) / 2, (S.xd + xi) / 2, OPB.bandIn - 0.12, 0.5, 0.009); MM.save().color(OPC.shade); MM.cls = 2; opbEdgeStrip(MM, (S.xd + xi) / 2, 0.004, -(S.xd + xi) / 2, 0.004, 0.14, 0.019); MM.restore(); });
  // worn nosings (a dark strip along the edge of every tread)
  M.save().color([0.2, 0.19, 0.18]).local(1); M.cls = 2;
  for (let i = 0; i < 8; i++) {
    const zb = S.zl + ((S.zt - S.zl) * (i + 1)) / 8, yb = lerp(hl, 0, (i + 0.5) / 8) + 0.1, za = S.zl + ((S.zt - S.zl) * i) / 8, ya = lerp(hl, F1, (i + 0.5) / 8) + 0.1;
    M.boxB('opFloor', xg + 0.02, S.xe - 0.02, yb, yb + 0.003, zb - 0.025, zb + 0.032); M.boxB('opFloor', -xi + 0.16, S.xd - 0.02, ya, ya + 0.003, za - 0.032, za + 0.025);
  }
  M.restore();
  // the band raked up the stair wall beside the lower flight (lengths of its cell, sheared along the slope)
  const hdn = (z) => lerp(hl, 0, (z - S.zl) / (S.zt - S.zl));
  opOnSide('z', OPB.xr[0], OPB.pt, -1, (MM) => {
    const [cx, cy, cw, ch] = OPW.bandIn, bh = OPB.bandIn;
    opBandRun(MM, -OPB.zi, S.zl, hl, false); // (level along the half landing, then raked down the flight)
    MM.save().local(1).color(OPC.ochreIn); MM.cls = 1; MM.uvS = 1; MM.uvO = [0, 0];
    for (let a = S.zl; a < -0.31; a += 1.125) {
      const e = Math.min(-0.3, a + 1.125), ya = hdn(a), ye = hdn(e), u1 = (cx + (cw * (e - a)) / 2) / 1024, Bf = MM.buf('opDado', (a + e) / 2, (ya + ye + bh) / 2, 0.006);
      const ids = [[a, ya, cx / 1024, (cy + ch) / 1024], [e, ye, u1, (cy + ch) / 1024], [e, ye + bh, u1, cy / 1024], [a, ya + bh, cx / 1024, cy / 1024]].map(([x, y, u, v]) => MM.v(Bf, x, y, 0.006, 0, 0, 1, u, v));
      MM.quadI(Bf, ids[0], ids[1], ids[2], ids[3]);
    }
    MM.restore();
  });
  // the ground floor's west window behind the upper flight: closed flush inside (the pane stays outside)
  M.save().color(OPC.wallIn).world(1); M.boxB('opWallIn', -xi - 0.05, -xi + 0.003, 1.17, 2.53, -2.28, -0.62); M.restore();
  DECOR.col(-xi, S.xe, 0, hl, -zi, S.zl, 'concrete');
  // the lower flight's open sides: the upper flight's mass on the west (drawn by its steps), the hall on the east beyond the stair wall
  // stops soldiers: between the two lanes (shots go through the railing), under the head of the upper flight (its steps stop shots only),
  // at the edge of the upper floor over the lower flight
  glassWall(S.xd, xg, 0, F1 + 1.1, S.zl + 0.13, S.zt);
  glassWall(-xi, S.xd, 0, F1 - 0.06, S.zt - 0.06, S.zt);
  glassWall(xg, S.xe, F1, F1 + 1.1, S.zv - 0.05, S.zv);
  // railings: along the upper flight, level along the two edges of the floor above
  const rail = (pts, posts) => {
    M.save().color(OPC.steelDk); M.cls = 1;
    M.tube('opSteel', 0.022, pts.map((p) => [p[0], p[1] + 1.0, p[2]]), 6);
    M.tube('opSteel', 0.014, pts.map((p) => [p[0], p[1] + 0.5, p[2]]), 5);
    for (const p of posts) M.boxB('opSteel', p[0] - 0.02, p[0] + 0.02, p[1], p[1] + 1.0, p[2] - 0.02, p[2] + 0.02);
    M.restore();
  };
  const hu = (z) => lerp(hl, F1, (z - S.zl) / (S.zt - S.zl)), xr = S.xd + 0.025;
  rail([[xr, hu(S.zl + 0.1), S.zl + 0.1], [xr, hu(S.zt - 0.05), S.zt - 0.05]], [S.zl + 0.1, -1.72, -0.85].map((z) => [xr, hu(z), z]));
  rail([[xr, F1, S.zv - 0.03], [xr, F1, S.zt]], [S.zv - 0.03, -0.8, S.zt - 0.02].map((z) => [xr, F1, z]));
  rail([[xr, F1, S.zv - 0.03], [S.xe, F1, S.zv - 0.03]], [[-3.5, F1, S.zv - 0.03]]);
  // stringer upstand of the upper flight along the gable (15 cm, 20 cm above the nosings): it closes the lower west window beside the treads
  // (profile in z and y, extruded toward the east)
  M.save().move(-xi - 0.02, 0, 0).rotY(Math.PI / 2).color(OPC.wallIn).world(1); // (its wall-side end 2 cm inside the gable: not in the plane of the steps' ends)
  M.extrude('opWallIn', [[-S.zl, hl + 0.4], [-S.zt, F1 + 0.4], [-S.zt, F1 - 0.3], [-S.zl, hl - 0.3]], 0.17);
  M.restore();
}

/* ---------- Rear annex (x -2.5 to 2.5, z -7 to -4, one story): south door, vent, AC unit on its flat roof ---------- */
function opAnnex() {
  const M = DECOR, t = OP_CP.t, A = OP_AX, H = A.H, hs = A.hs, zs = A.zs, zi = zs + t, hw = A.hw, xi = hw - t;
  const south = [{ a0: -0.1, a1: 1.1, b0: 0, b1: 2.2, door: 1 }];
  opWall('x', zs + t / 2, -hw, hw, 0, H, south, { band: [1], bandA: [-xi, xi], out: -1 });
  opWall('z', -hw + t / 2, zi, -4.0, 0, H, [], { band: [1], out: -1 });
  opWall('z', hw - t / 2, zi, -4.0, 0, H, [], { band: [-1], out: 1 });
  opBand('x', zs + t / 2, t, -hw, hw, 0, south, [-1], [0, 0], -1);
  opBand('z', -hw + t / 2, t, zs, -4.0, 0, [], [-1], [0, 0], -1);
  opBand('z', hw - t / 2, t, zs, -4.0, 0, [], [1], [0, 0], 1);
  // the main block's rear wall seen from inside the annex: painted like a room, with its band
  M.save().color(OPC.wallIn).world(1); M.cls = 1;
  for (const [x0, x1, y0] of [[-xi, -0.165, 0], [1.165, xi, 0], [-0.165, 1.165, 2.26]]) M.boxB('opWallIn', x0, x1, y0, hs, -4.006, -4.0, { skip: 'yYZxX' });
  M.restore();
  opOnFace(0, -4.006, Math.PI, (MM) => { opBandRun(MM, -xi, -1.165, 0, false); opBandRun(MM, 0.165, xi, 0, false); });
  // roof slab, ceiling, roofing, coping
  DECOR.col(-xi, xi, hs, hs + 0.25, zi, -4.0, 'concrete');
  M.save().color(OPC.ceil).world(1); M.cls = 1; M.quad('opCeil', [-xi, hs, -4.0], [xi, hs, -4.0], [xi, hs, zi], [-xi, hs, zi], [0, -1, 0]); M.restore();
  M.save().color([0.6, 0.59, 0.56]).world(1); M.quad('concrete', [-xi, hs + 0.25, -4.0], [xi, hs + 0.25, -4.0], [xi, hs + 0.25, zi], [-xi, hs + 0.25, zi], [0, 1, 0]); M.restore();
  M.save().color(OPC.coping).world(1);
  M.boxB('opPanel', -hw - 0.06, hw + 0.06, H, H + 0.07, zs - 0.06, zi + 0.03, { bevel: 0.01 });
  for (const x of [-hw - 0.06, hw - t - 0.03]) M.boxB('opPanel', x, x + t + 0.09, H, H + 0.07, zi + 0.03, -4.0, { bevel: 0.01 });
  M.restore();
  M.save().color(OPC.floor).world(1); M.cls = 1; M.quad('opFloor', [-xi, 0.012, -4.0], [xi, 0.012, -4.0], [xi, 0.012, zi], [-xi, 0.012, zi], [0, 1, 0]); M.restore();
  glassWall(-hw, hw, hs + 0.25, 10, zs, -4.0); // out of reach (and nobody lands on it from the upper windows)
  // south door: leaf against the outside wall; louvered vent, lamp over the door; AC unit on the roof
  opLeaf('x', zs + t / 2, t, 1.1, 0, 2.18, 1.15, -1, 1);
  M.place(PF.opVent(1.0, 0.55, OPC.vent), -1.5, 1.3, zs, Math.PI, { nocol: true });
  M.place(PF.opWallLamp(), 0.5, 2.55, zs, Math.PI, { nocol: true });
  M.place(PF.opAcBig(1.0, 0.7, 0.6), -1.3, hs + 0.25, -6.1, Math.PI, { nocol: true });
}

/* ---------- Front awning: olive corrugated sheet on lean-to steel trusses, four concrete columns, porch slab and entrance step ---------- */
const OP_AWN = { xs: -6.25, x0: -6.0, x1: 6.0, zw: 4.0, zf: 6.35, yw: 3.95, yf: 3.08, cols: [-5.85, -1.45, 2.0, 5.6], zc: 6.1 };
function opAwning() {
  const M = DECOR, A = OP_AWN, L = hyp(A.yw - A.yf, A.zf - A.zw), ph = Math.atan2(A.yw - A.yf, A.zf - A.zw), W = A.x1 - A.x0 + 0.1;
  // porch slab under the awning (15 cm: the ground floor stays at the yard's level) and two shallow steps in front of the door: the same
  // stained concrete
  box('opPanel', A.xs, A.x1, 0, 0.15, A.zw, A.zf, { tint: OPC.slab, m: 'concrete' });
  M.save().color(OPC.stain); M.cls = 2; for (let x = A.xs; x < A.x1 - 0.01; x += 2) opStainFlat(M, OPW.splash, x, Math.min(A.x1, x + 2), A.zf - 0.55, A.zf, 0.1535); M.restore(); // (stained along its edge)
  box('opPanel', -4.7, -2.3, 0, 0.1, A.zf, A.zf + 0.3, { tint: OPC.slab, m: 'concrete' });
  box('opPanel', -4.7, -2.3, 0, 0.05, A.zf + 0.3, A.zf + 0.6, { tint: OPC.slab, m: 'concrete' });
  // corrugated sheet, modeled (ribs down the slope, 15 cm apart: a texture of them shimmered seen from above); laid from the front edge up to
  // the wall (its frame looks south); flat underside; front fascia
  M.save().move((A.x0 + A.x1) / 2, A.yf, A.zf).rotY(Math.PI).rotX(-ph);
  const prof = []; for (let i = 0, n = Math.round(W / 0.075); i <= n; i++) prof.push([W / 2 - (i * W) / n, 0.012 + (i % 2 ? 0.03 : 0)]);
  M.save().move(0, 0, -0.08).color(OPC.awning).local(1); M.extrude('opSheet', prof, L + 0.08, { closed: false }); M.restore();
  M.local(1); M.cls = 1; // its underside: the ribs as strips of two olives (it only sees the shaded porch)
  { const nu = Math.round(W / 0.075); for (let i = 0; i < nu; i++) { M.color(i % 2 ? [0.25, 0.29, 0.19] : [0.19, 0.225, 0.145]); M.boxB('opSheetUnder', W / 2 - ((i + 1) * W) / nu, W / 2 - (i * W) / nu, -0.008, 0.01, -0.08, L, { skip: 'YxXzZ' }); } }
  // weathering of the sheet (laid just over the ribs): dirt run down the slope from the wall, rust creeping up from the eave; the fixings
  // on the ribs, rusted, along the purlins
  const RA = rngOf(977), nr = Math.round(W / 0.075); M.cls = 2;
  for (let x = -W / 2; x < W / 2 - 0.01; x += 2) {
    const x1 = Math.min(W / 2, x + 2);
    if (RA() > 0.2) { M.color(OPC.stain); opStainFlat(M, RA() < 0.5 ? OPW.drip0 : OPW.drip1, x1, x, L - 0.02, L - 1.5 - RA() * 0.6, 0.05); }
    M.color([0.3, 0.2, 0.13]); opStainFlat(M, OPW.splash, x1, x, 0.22 + RA() * 0.12, -0.06, 0.05);
  }
  M.color(OPC.awning.map((v) => v * 0.78)).local(1);
  for (let i = 0; i <= nr; i += 2) { const x = W / 2 - (i * W) / nr; M.boxB('opSheet', x - 0.02, x + 0.02, 0.0165, 0.0175, 0, L, { skip: 'yxXzZ' }); } // (the valleys: the ribs' shade)
  M.color([0.26, 0.17, 0.11]).local(1);
  for (let i = 3; i < nr; i += 8) for (const k of [0.07, 0.36, 0.64, 0.93]) { const x = W / 2 - (i * W) / nr; M.boxB('opSteel', x - 0.012, x + 0.012, 0.04, 0.05, k * L - 0.012, k * L + 0.012); }
  M.restore();
  for (let i = 0; i < 4; i++) { // (in slices along the slope: shots from the upper windows pass over its low end)
    const z0 = lerp(A.zw, A.zf, i / 4), z1 = lerp(A.zw, A.zf, (i + 1) / 4);
    DECOR.col(A.x0, A.x1, lerp(A.yw, A.yf, (i + 1) / 4) - 0.03, lerp(A.yw, A.yf, i / 4) + 0.05, z0, z1, 'metal');
  }
  M.save().color(OPC.olive).local(1);
  M.boxB('opPaint', A.x0 - 0.05, A.x1 + 0.05, A.yf - 0.16, A.yf + 0.045, A.zf + 0.06, A.zf + 0.1);
  // wall ledger, purlins
  M.color(OPC.oliveDk); M.boxB('opPaint', A.x0, A.x1, A.yw - 0.14, A.yw - 0.02, A.zw, A.zw + 0.08);
  for (const k of [0.25, 0.5, 0.75]) { const z = lerp(A.zw, A.zf, k), y = lerp(A.yw, A.yf, k); M.boxB('opPaint', A.x0, A.x1, y - 0.1, y - 0.005, z - 0.03, z + 0.03); }
  M.restore();
  // trusses over the columns: bottom chord, sloped top chord, web
  const beam = (x, y1, z1, y2, z2, w = 0.06, d = 0.08) => {
    const l = hyp(y2 - y1, z2 - z1); M.save().move(x, y1, z1).rotX(-Math.atan2(y2 - y1, z2 - z1)); M.boxB('opPaint', -w / 2, w / 2, -d / 2, d / 2, 0, l); M.restore();
  };
  const yb = 2.95;
  M.save().color(opOl(0.72)).local(1);
  for (const x of A.cols) {
    beam(x, yb, A.zc, yb, A.zw);
    const yt = (z) => lerp(A.yf, A.yw, (z - A.zf) / (A.zw - A.zf)) - 0.12;
    beam(x, yt(A.zf - 0.1), A.zf - 0.1, yt(A.zw), A.zw);
    const zs = [A.zc, 5.55, 5.0, 4.5, A.zw + 0.05];
    for (let i = 0; i < zs.length - 1; i++) { beam(x, yb, zs[i], yt(zs[i + 1]), zs[i + 1], 0.04, 0.05); beam(x, yb, zs[i + 1], yt(zs[i + 1]), zs[i + 1], 0.04, 0.05); }
  }
  M.restore();
  // columns: the walls' concrete with the ochre band, capital
  for (const x of A.cols) {
    M.save().color(OPC.wall).world(1); M.boxB('opPanel', x - 0.175, x + 0.175, 0.15, yb, A.zc - 0.175, A.zc + 0.175, { skip: 'yY', bevel: 0.012 });
    M.boxB('opPanel', x - 0.22, x + 0.22, yb - 0.1, yb, A.zc - 0.22, A.zc + 0.22, { bevel: 0.01 });
    M.color(OPC.plinth); M.boxB('opPanel', x - 0.275, x + 0.275, 0.15, 0.45, A.zc - 0.275, A.zc + 0.275, { skip: 'y', bevel: 0.015 }); M.restore(); // plinth
    DECOR.col(x - 0.275, x + 0.275, 0.15, 0.45, A.zc - 0.275, A.zc + 0.275, 'concrete');
    DECOR.col(x - 0.175, x + 0.175, 0.15, yb, A.zc - 0.175, A.zc + 0.175, 'concrete');
    opBandBox(x - 0.175, x + 0.175, A.zc - 0.175, A.zc + 0.175, 0.15, true);
  }
  // nobody stands on it (the steps of the stair pass beside its east end)
  glassWall(A.xs, A.x1 + 0.05, A.yf - 0.1, 10, A.zw, A.zf + 0.1);
}

/* ---------- East stair: galvanized steel, open grating treads between two stringers, from its foot at the north end (zf) up to the landing at
   the corridor door, railings; the east ground door under the landing; olive ammunition crates stacked under the flight ---------- */
const OP_ES = { x0: 6.05, x1: 7.45, zf: 5.5, zt: 0.3, n: 16, lz0: -1.7 }; // (foot on a cell center: the node there is the ground's)
function opEastStair() {
  const M = DECOR, S = OP_ES, F1 = OP_CP.F1, run = (S.zf - S.zt) / S.n, rise = F1 / S.n, sl = Math.atan2(F1, S.zf - S.zt), L = hyp(F1, S.zf - S.zt);
  RAMPS.push({ x0: S.x0, x1: S.x1, z0: S.zt, z1: S.zf, axis: 'z', h0: F1, h1: 0 });
  // stringers (C-channels along the slope, from the foot: their frame looks south)
  M.save().color(OPC.steelDk).local(1);
  for (const x of [S.x0 + 0.03, S.x1 - 0.03]) { M.save().move(x, 0, S.zf).rotY(Math.PI).rotX(-sl); M.boxB('opSteel', -0.03, 0.03, -0.28, 0.0, 0, L); M.restore(); }
  M.restore();
  // treads: grating with a steel nosing; each stops shots
  for (let i = 0; i < S.n; i++) {
    const za = S.zf - i * run, y = (i + 1) * rise;
    M.save().color([0.36, 0.37, 0.38]).local(1); M.cls = 1;
    M.boxB('opGrating', S.x0 + 0.06, S.x1 - 0.06, y - 0.03, y, za - run - 0.02, za);
    M.color([0.72, 0.72, 0.7]); M.boxB('opSteel', S.x0 + 0.06, S.x1 - 0.06, y - 0.04, y, za - 0.03, za + 0.005); // (worn bright)
    M.restore();
    M.col(S.x0, S.x1, y - 0.04, y, za - run, za, 'metal', true);
  }
  // landing: grating on a steel frame, two posts with a brace, brackets on the wall (clear of the door below)
  const lx0 = 6.0, lx1 = S.x1 + 0.05, lz0 = S.lz0, lz1 = S.zt, ly = F1 - 0.08;
  M.save().color([0.36, 0.37, 0.38]).local(1); M.cls = 1; M.boxB('opGrating', lx0, lx1 - 0.05, ly + 0.05, F1, lz0 + 0.05, lz1); M.restore();
  DECOR.col(lx0, lx1, ly, F1, lz0, lz1, 'metal');
  M.save().color(OPC.steelDk).local(1);
  M.boxB('opSteel', lx0, lx1, ly - 0.12, ly + 0.05, lz0, lz0 + 0.06); M.boxB('opSteel', lx1 - 0.06, lx1, ly - 0.12, ly + 0.05, lz0, lz1); M.boxB('opSteel', lx0, lx1, ly - 0.12, ly + 0.05, lz1 - 0.05, lz1);
  for (const z of [lz0 + 0.06, lz1 - 0.06]) { M.boxB('opSteel', lx1 - 0.13, lx1 - 0.03, 0, ly - 0.12, z - 0.05, z + 0.05); }
  M.tube('opSteel', 0.025, [[lx1 - 0.08, 0.3, lz1 - 0.1], [lx1 - 0.08, ly - 0.2, lz0 + 0.1]], 5);
  for (const z of [lz0 + 0.04, lz1 - 0.04]) M.tube('opSteel', 0.03, [[lx0 + 0.02, ly - 0.75, z], [lx0 + 0.7, ly - 0.12, z]], 5);
  M.restore();
  for (const z of [lz0 + 0.06, lz1 - 0.06]) DECOR.col(lx1 - 0.13, lx1 - 0.03, 0, ly - 0.12, z - 0.05, z + 0.05, 'metal');
  // railings: east side of the flight, west side beside the awning, along the wall (handrail on brackets), landing edges
  const yr = (z) => ((S.zf - z) / (S.zf - S.zt)) * F1;
  M.save().color(OPC.plinth).world(1); M.cls = 2; // concrete pads under the posts and the stringers
  for (const z of [lz0 + 0.06, lz1 - 0.06]) M.boxB('opPanel', lx1 - 0.2, lx1 + 0.04, 0, 0.07, z - 0.12, z + 0.12, { skip: 'y' });
  for (const x of [S.x0 + 0.03, S.x1 - 0.03]) M.boxB('opPanel', x - 0.09, x + 0.09, 0, 0.06, S.zf - 0.2, S.zf + 0.04, { skip: 'y' });
  M.restore();
  M.save().color(OPC.steelDk); M.cls = 1;
  const hand = (x, za, zb, posts) => {
    M.color(OPC.steelWorn); M.tube('opSteel', 0.024, [[x, yr(za) + 1.0, za], [x, yr(zb) + 1.0, zb]], 6); M.color(OPC.steelDk); M.tube('opSteel', 0.016, [[x, yr(za) + 0.5, za], [x, yr(zb) + 0.5, zb]], 5);
    for (const z of posts) M.boxB('opSteel', x - 0.025, x + 0.025, yr(z) - 0.1, yr(z) + 1.0, z - 0.025, z + 0.025);
  };
  hand(S.x1 - 0.03, S.zf - 0.15, S.zt, [S.zf - 0.15, 4.2, 2.9, 1.6, S.zt + 0.03]);
  hand(S.x0 + 0.03, S.zf - 0.15, 4.05, [S.zf - 0.15, 4.7, 4.05]);
  M.color(OPC.steelWorn); M.tube('opSteel', 0.022, [[6.08, yr(3.9) + 0.95, 3.9], [6.08, yr(0.5) + 0.95, 0.5]], 6); M.color(OPC.steelDk);
  for (const z of [3.4, 2.0, 0.8]) M.tube('opSteel', 0.012, [[6.0, yr(z) + 0.9, z], [6.08, yr(z) + 0.95, z]], 4);
  for (const [xa, za, xb, zb] of [[lx1 - 0.03, lz1, lx1 - 0.03, lz0 + 0.03], [lx1 - 0.03, lz0 + 0.03, lx0, lz0 + 0.03]]) {
    M.color(OPC.steelWorn); M.tube('opSteel', 0.024, [[xa, F1 + 1.05, za], [xb, F1 + 1.05, zb]], 6); M.color(OPC.steelDk); M.tube('opSteel', 0.016, [[xa, F1 + 0.52, za], [xb, F1 + 0.52, zb]], 5);
  }
  for (const [x, z] of [[lx1 - 0.03, lz1 - 0.03], [lx1 - 0.03, -0.45], [lx1 - 0.03, lz0 + 0.03], [6.75, lz0 + 0.03], [lx0 + 0.04, lz0 + 0.03]]) M.boxB('opSteel', x - 0.025, x + 0.025, F1, F1 + 1.05, z - 0.025, z + 0.025);
  M.restore();
  // light rust: on the pads around the feet, creeping up the posts, under the brackets bolted to the wall
  M.save().color([0.27, 0.2, 0.15]); M.cls = 2;
  for (const z of [lz0 + 0.06, lz1 - 0.06]) {
    opStainFlat(M, OPW.blob, lx1 - 0.2, lx1 + 0.04, z - 0.12, z + 0.12, 0.072);
    M.save().move(lx1 - 0.03, 0, z).rotY(Math.PI / 2); opStain(M, OPW.splash, -0.05, 0.05, 0.07, 0.42, 0.002, false, 0.05); M.restore();
  }
  for (const x of [S.x0 + 0.03, S.x1 - 0.03]) opStainFlat(M, OPW.blob, x - 0.09, x + 0.09, S.zf - 0.2, S.zf + 0.04, 0.062);
  for (const z of [lz0 + 0.04, lz1 - 0.04]) { M.save().move(6.0, ly - 0.75, z).rotY(Math.PI / 2); opStain(M, OPW.streak, -0.09, 0.09, -0.55, 0.03, 0.008); M.restore(); }
  M.restore();
  // invisible planes: soldiers stay on the flight and the landing; the west one goes high (nobody jumps from the flight onto the awning)
  glassWall(S.x1, S.x1 + 0.05, 0, F1 + 1.15, S.zt, S.zf);
  glassWall(6.0, S.x0, 0, 6.0, 4.0, 6.45); // (and along the east edge of the porch: no stepping between it and the foot of the flight)
  glassWall(lx1 - 0.05, lx1, F1, F1 + 1.1, lz0, lz1);
  glassWall(lx0, lx1, F1, F1 + 1.1, lz0, lz0 + 0.05);
  // ammunition crates stacked under the flight (they fill what the slope of the flight forbids anyway)
  const ammo = (x, y, z, k, ry) => M.place(PF.opAmmo(k), x, y, z, ry), H = Math.PI / 2;
  M.place(PF.pallet(), 6.75, 0, 2.1, H, { nocol: true }); ammo(6.75, 0.122, 2.1, 0, H); ammo(6.75, 0.722, 2.1, 0, H - 0.04);
  M.place(PF.pallet(), 6.75, 0, 3.35, H, { nocol: true }); ammo(6.75, 0.122, 3.35, 0, H);
  ammo(6.48, 0, 4.25, 1, H); ammo(6.98, 0, 4.25, 1, H); // (clear of the east door's swing)
}

/* ---------- Roof: the main AC unit on its curb, a small unit, telecom mast, hatch, vent pipes ---------- */
function opRoof() {
  const M = DECOR, y = OP_CP.roof;
  M.save().color(OPC.wall).world(1); M.boxB('opPanel', 1.26, 3.34, y, y + 0.45, -0.49, 0.89, { skip: 'y', bevel: 0.01 }); M.restore();
  M.place(PF.opAcBig(2.0, 1.3, 0.95), 2.3, y + 0.45, 0.2, 0, { nocol: true });
  for (const [ux, uz] of [[-4.4, 2.4], [4.5, -2.75]]) { // two small units on sleepers, at opposite corners
    M.save().color([0.4, 0.4, 0.39]).local(1); for (const dz of [-0.3, 0.3]) M.boxB('opSteel', ux - 0.3, ux + 0.3, y, y + 0.3, uz + dz - 0.05, uz + dz + 0.05); M.restore();
    M.place(PF.opAcBig(1.0, 0.7, 0.6), ux, y + 0.3, uz, Math.PI / 2, { nocol: true });
  }
  M.place(PF.opMast(), 4.4, y, -0.6, Math.PI - 0.3, { nocol: true });
  M.save().color([0.55, 0.56, 0.55]); M.cls = 1;
  for (const [x, z] of [[4.6, 2.6], [-4.8, -2.9]]) { M.save().move(x, y, z); M.cyl('opSteel', 0.06, 0.6, 8); M.save().move(0, 0.6, 0); M.cyl('opSteel', 0.1, 0.06, 8); M.restore(); M.restore(); }
  M.color([0.12, 0.12, 0.12]); M.tube('rubber', 0.02, [[4.3, y + 0.05, -0.45], [3.8, y + 0.05, -0.3], [3.45, y + 0.05, 0.1]], 5);
  M.restore();
}

/* ---------- Facade dressing: door leaves, lamps, electrical boxes and conduits, louvered vents, drainpipes ---------- */
function opFacadeDress() {
  const M = DECOR, C = OP_CP, t = C.t, F1 = C.F1, H = Math.PI / 2;
  // door leaves, opened flat against the facades: front double door (under the awning), west and east doors; rear exit into the annex; the
  // corridor door stands open along the corridor wall
  opLeaf('x', C.z1 - t / 2, t, -4.4, 0, 2.23, 0.88, 1, -1); opLeaf('x', C.z1 - t / 2, t, -2.6, 0, 2.23, 0.88, 1, 1);
  opLeaf('x', C.z0 + t / 2, t, 1.1, 0, 2.18, 1.1, -1, 1);
  opLeaf('z', C.x0 + t / 2, t, 1.25, 0, 2.18, 1.15, -1, 1);
  opLeaf('z', C.x1 - t / 2, t, 0.05, 0, 2.18, 1.05, 1, 1);
  opLeaf('z', C.x1 - t / 2, t, -0.95, F1, 2.08, 1.15, -1, 1, Math.PI / 2, false);
  // lamps over the doors
  const nc = { nocol: true };
  M.place(PF.opWallLamp(), -3.5, 2.62, C.z1, 0, nc);
  M.place(PF.opWallLamp(), 0.5, 2.55, C.z0, Math.PI, nc); // (inside the annex, over the rear exit)
  M.place(PF.opWallLamp(), C.x0, 2.55, 0.65, -H, nc);
  M.place(PF.opWallLamp(), C.x1, 2.55, -0.5, H, nc);
  M.place(PF.opWallLamp(), C.x1, F1 + 2.35, -0.35, H, nc);
  for (const [lx, ly, lz, lr] of [[C.x0, 2.55, 0.65, -H], [C.x1, 2.55, -0.5, H], [C.x1, F1 + 2.35, -0.35, H], [0.5, 2.55, OP_AX.zs, Math.PI]]) {
    opOnFace(lx, lz, lr, (MM) => { MM.cls = 2; MM.color([0.2, 0.17, 0.11]); opStain(MM, OPW.blob, -0.32, 0.32, ly - 0.46, ly + 0.06, 0.012, false, 1, 'opGlow'); });
  }
  // the porch lamp: a warm pool of about 1 m on the shaded wall over the door head (the upper half of the cell: brightest at the head)
  opOnFace(-3.5, C.z1, 0, (MM) => { MM.cls = 2; MM.color([0.5, 0.4, 0.22]); opStain(MM, [OPW.blob[0], OPW.blob[1], OPW.blob[2], OPW.blob[3] / 2], -1.15, 1.15, 2.3, 3.4, 0.012, false, 1, 'opGlow'); });
  // electrical box on the rear wall, its conduits into the ground and up to the roof, a conduit along the wall to the annex
  M.place(PF.opElecBox(0.9), 4.3, 0.9, C.z0, Math.PI, nc);
  M.save().color([0.6, 0.61, 0.6]); M.cls = 1;
  M.tube('opSteel', 0.022, [[4.45, 1.68, C.z0 - 0.06], [4.45, 6.46, C.z0 - 0.06], [4.45, 6.55, C.z0 - 0.215], [4.45, 7.1, C.z0 - 0.215], [4.45, 7.19, C.z0 + 0.2]], 6);
  M.tube('opSteel', 0.018, [[4.05, 1.5, C.z0 - 0.05], [3.6, 1.5, C.z0 - 0.05], [3.4, 2.9, C.z0 - 0.05], [2.55, 2.9, C.z0 - 0.05]], 5);
  for (const y of [2.5, 4.0, 5.5]) M.boxB('opSteel', 4.4, 4.5, y, y + 0.03, C.z0 - 0.08, C.z0);
  M.restore();
  // louvered vents: under the parapet (rear, east), under the exterior flight, at the foot of the west gable
  M.place(PF.opVent(0.55, 0.4, OPC.vent), 5.0, 5.75, C.z0, Math.PI, nc);
  M.place(PF.opVent(0.5, 0.4, OPC.vent), C.x1, 5.65, 2.6, H, nc);
  M.place(PF.opVent(0.6, 0.5, OPC.vent), C.x1, 0.75, 2.4, H, nc);
  M.place(PF.opVent(0.4, 0.3, OPC.vent), C.x1, 0.45, -2.6, H, nc);
  M.place(PF.opVent(0.6, 0.3, OPC.vent), C.x0, 0.42, -1.45, -H, nc);
  M.place(PF.opVent(0.6, 0.3, OPC.vent), C.x0, 0.42, 3.1, -H, nc);
  // drainpipes at the two rear corners (from the roof's outlets, through the wall under the cap band)
  M.save().color([0.45, 0.47, 0.44]); M.cls = 1;
  for (const x of [-5.85, 5.85]) {
    M.save().move(x, 0.15, -4.14); M.cyl('opSteel', 0.05, 6.3, 8, { caps: '' }); M.restore();
    M.tube('opSteel', 0.05, [[x, 6.45, -4.14], [x, 6.53, -4.1], [x, 6.55, -3.96]], 6);
  }
  M.restore();
}

/* ---------- Weathering of the facades: run-off under the parapet band, the coping of the annex and the window sills, mud splashed at the foot,
   streaks under the vents (decals of the weathering atlas, 02yoa-outpost-props.js, laid just off the concrete) ---------- */
function opWeather() {
  const C = OP_CP, R = rngOf(4811), H = Math.PI / 2, A = OP_AX, zm = (A.zs + C.z0) / 2, hd = (C.z0 - A.zs) / 2;
  // faces: [origin x, z, heading, half width, top (under the parapet band or the coping), name of the facade (its openings) and factor from a to
  // the frame's x, lengths of the foot left clean (in the frame's x): the annex against the rear facade, its own doorway]
  const yb = C.roof - 0.005, faces = [[0, C.z1, 0, 6, yb, 'front', 1, []], [0, C.z0, Math.PI, 6, yb, 'rear', -1, [[-A.hw, A.hw]]], [C.x1, 0, H, 4, yb, 'east', -1, []], [C.x0, 0, -H, 4, yb, 'west', 1, []],
    [0, A.zs, Math.PI, A.hw, A.H, null, -1, [[-1.2, 0.2]]], [A.hw, zm, H, hd, A.H, null, -1, []], [-A.hw, zm, -H, hd, A.H, null, 1, []]];
  for (const [ox, oz, ry, hw, top, k, sg, clean] of faces) opOnFace(ox, oz, ry, (M) => {
    M.cls = 1;
    // under the band or the coping: drips in 2 m lengths, one in four left clean
    for (let x = -hw; x < hw - 0.01; x += 2) {
      const x1 = Math.min(hw, x + 2), v = R(), fl = R() < 0.5;
      if (v < 0.25) continue;
      M.color(OPC.stain); opStain(M, v < 0.62 ? OPW.drip0 : OPW.drip1, x, x1, top - (k ? 0.86 : 1.12), top - 0.005, 0.006, fl, (x1 - x) / 2); // (clear of the upper windows' heads)
    }
    // foot: splashed mud over the band, between the doorways
    const cuts = clean.concat(k ? OP_OPS[k + '0'].filter((p) => p.door).map((p) => [Math.min(sg * p.a0, sg * p.a1) - 0.1, Math.max(sg * p.a0, sg * p.a1) + 0.1]) : []).sort((p, q) => p[0] - q[0]);
    let cur = -hw;
    const run = (b) => { for (let x = cur; x < b - 0.3; x += 2) { const x1 = Math.min(b, x + 2); M.color(OPC.mud); opStain(M, OPW.splash, x, x1, 0, 0.5, 0.034, R() < 0.5, (x1 - x) / 2); } };
    // the front: dirt splashed back onto the wall along the awning
    if (k === 'front') for (let x = -hw; x < hw - 0.01; x += 2) { M.color(OPC.stain); opStain(M, OPW.splash, x, Math.min(hw, x + 2), 4.0, 4.34, 0.006, R() < 0.5); }
    for (const [c0, c1] of cuts) { run(c0); cur = Math.max(cur, c1); }
    run(hw);
    if (!k) return;
    const ops = OP_OPS[k + '0'].concat(OP_OPS[k + '1'].map((q) => ({ ...q, b0: q.b0 + C.F1, b1: q.b1 + C.F1 })));
    for (const p of ops) if (p.win) {
      const a0 = Math.min(sg * p.a0, sg * p.a1), a1 = Math.max(sg * p.a0, sg * p.a1);
      M.color(OPC.stain); for (const fl of [R() < 0.5]) opStain(M, OPW.sill, a0 - 0.12, a1 + 0.12, k === 'front' && p.b0 > 3 ? 4.01 : p.b0 - 0.95, p.b0 - 0.05, p.b0 < 2 ? 0.018 : 0.006, fl); // (the awning under the front's upper sills)
    }
  });
  // streaks under the vents (their places: opFacadeDress, opAnnex)
  const M = DECOR;
  for (const [x, y, z, ry, w] of [[5.0, 5.55, C.z0, Math.PI, 0.6], [C.x1, 5.45, 2.6, H, 0.55], [-1.5, 1.02, A.zs, Math.PI, 1.05], [4.3, 0.9, C.z0, Math.PI, 0.62], [C.x0, 0.27, -1.45, -H, 0.62], [C.x0, 0.27, 3.1, -H, 0.62], [C.x1, 0.5, 2.4, H, 0.62], [C.x1, 0.3, -2.6, H, 0.44]]) {
    M.save().move(x, y, z).rotY(ry).color(OPC.stain); M.cls = 1; for (const fl of [R() < 0.5]) opStain(M, OPW.streak, -w / 2, w / 2, Math.max(-1.0, 0.01 - y), 0, y < 2 ? 0.018 : 0.007, fl); M.restore(); // (never below the ground)
  }
}

/* Soft contact shadow on a floor under a piece of furniture (footprint x0..x1, z0..z1 at height y): the baked light is too coarse for it */
function opBlob(x0, x1, z0, z1, y, soft) {
  const M = DECOR, e = 0.22, yy = y < 0.05 ? y + 0.014 : y; // (the ground floor's slab lies 12 mm up)
  M.save().color(OPC.shade); M.cls = 2; opStainFlat(M, OPW.blob, x0 - e, x1 + e, z0 - e, z1 + e, yy + 0.004);
  if (!soft) { // the tight shade at the foot: a strip along each side, dark at the base
    const w = 0.13, h = yy + 0.005;
    opbEdgeStrip(M, x1 + w, z1, x0 - w, z1, w, h); opbEdgeStrip(M, x0 - w, z0, x1 + w, z0, w, h); opbEdgeStrip(M, x1, z0, x1, z1, w, h); opbEdgeStrip(M, x0, z1, x0, z0, w, h);
  }
  M.restore();
}
/* A strip of the weathering atlas's edge cell laid flat at height y along the segment a to b (dark along it), w wide toward its left (seen
   from above, x to the right and z downward) */
function opbEdgeStrip(M, ax, az, bx, bz, w, y) {
  const [cx, cy, cw, ch] = OPW.edge, u0 = cx / 1024, u1 = (cx + cw) / 1024, v0 = cy / 1024, v1 = (cy + ch) / 1024;
  const dx = bx - ax, dz = bz - az, l = hyp(dx, dz) || 1, nx = (dz / l) * w, nz = (-dx / l) * w;
  M.save().local(1); M.uvS = 1; M.uvO = [0, 0];
  const B = M.buf('opStain', (ax + bx) / 2, y, (az + bz) / 2);
  const ids = [[ax, az, u0, v0], [bx, bz, u1, v0], [bx + nx, bz + nz, u1, v1], [ax + nx, az + nz, u0, v1]].map(([x, z, u, v]) => M.v(B, x, y, z, 0, 1, 0, u, v));
  M.quadI(B, ids[0], ids[1], ids[2], ids[3]);
  M.restore();
}
/* Contact shadow of a placed prefab: under its collision box (turned by a multiple of a right angle), or under the footprint listed here
   for those without one ([half side, soft]: soft for legs and casters, no tight shade at the foot) */
let OPB_FOOT = null;
const OPB_SOLID = /^op(Locker|Filing|Ammo|WasteBin|Cooler|Fridge|Rack|Reception|Kitchen|Bookcase)/; // (what stands solid on the floor: the tight shade at its foot)
function opbPad(pf, x, y, z, ry) {
  if (!OPB_FOOT) OPB_FOOT = new Map([[PF.opPlant(), [0.15, 0]], [PF.opBin(), [0.14, 0]], [PF.opHeater(), [0.26, 0]], [PF.opSwivel(), [0.3, 1]], [PF.opVisitor(), [0.27, 1]], [PF.opVisitor(false), [0.27, 1]], [PF.opHandTruck(), [0.24, 1]]]);
  const c = pf.cols[0], f = OPB_FOOT.get(pf);
  if (c && c.y0 < 0.3) { const q = Math.abs(Math.round(ry / (Math.PI / 2))) % 2, hw = (c.x1 - c.x0) / 2, hd = (c.z1 - c.z0) / 2, ax = q ? hd : hw, az = q ? hw : hd; opBlob(x - ax, x + ax, z - az, z + az, y, !OPB_SOLID.test(pf.name)); }
  else if (!c && f) opBlob(x - f[0], x + f[0], z - f[0], z + f[0], y, f[1]);
}
/* Prefab placed at (x, y, z), heading ry (stamped: the scenery check reads placed objects in plan only, and took the upper floor's furniture
   for obstacles in front of the ground floor's doors), with the contact shadow of its collision box (turned by a multiple of a right angle) */
function opPut(pf, x, y, z, ry, o) {
  const M = DECOR; M.save().move(x, y, z).rotY(ry); M.put(pf, o || {}); M.restore();
  opbPad(pf, x, y, z, ry);
}
/* Prefab placed with a collision that stops soldiers but not shots (open shelving: what you see through, a bullet passes through); hw, hd: half
   width and depth in its frame, h: height; turned by a multiple of a right angle */
function opSoftPlace(pf, x, y, z, ry, hw, hd, h) {
  const M = DECOR; M.save().move(x, y, z).rotY(ry); M.put(pf, { nocol: true }); M.restore();
  const q = Math.abs(Math.round(ry / (Math.PI / 2))) % 2, ax = q ? hd : hw, az = q ? hw : hd;
  COL.push({ x0: x - ax, x1: x + ax, y0: y, y1: y + h, z0: z - az, z1: z + az, m: 'metal', ray: false, noRay: true });
  opBlob(x - ax, x + ax, z - az, z + az, y, !OPB_SOLID.test(pf.name));
}

/* ---------- Ground floor furniture (sheet 3): hall, storage room, utility annex ---------- */
function opFurnishGround() {
  const M = DECOR, H = Math.PI / 2, xi = OPB.xi, zi = OPB.zi, nc = { nocol: true }, c0 = OPB.c0;
  const P = (pf, x, y, z, ry, o) => { M.place(pf, x, y, z, ry, o); if (y < 0.3) opbPad(pf, x, y, z, ry); };
  // reception along the west wall, beside the entrance, facing the hall: its chair behind it, screen, two small olive crates stacked, a plant
  P(PF.opReception(2.4), -4.9, 0, 2.53, H);
  P(PF.opSwivel(), -5.42, 0, 2.35, H, nc);
  P(PF.opMonitor(OPS.scrTxt), -4.55, 1.09, 2.35, -H, nc); // (on the counter top)
  P(PF.opPlant(), -4.63, 1.09, 3.45, 0.4, nc);
  P(PF.opMiniCrate(), -4.65, 1.09, 1.78, H + 0.06, nc); P(PF.opMiniCrate(), -4.65, 1.34, 1.7, H - 0.14, nc);
  // right of the entrance, against the front wall: water cooler, waste bin, first aid cabinet over it, extinguisher; hand truck against the
  // pier between the windows, a fan above it; the cart and crates under the east window
  P(PF.opCooler(), -2.2, 0, 3.56, Math.PI);
  P(PF.opWasteBin(), -1.62, 0, 3.52, Math.PI);
  P(PF.opFirstAid(), -1.62, 1.6, zi, Math.PI, nc);
  P(PF.opExtinguisher(), -1.0, 0.3, zi, Math.PI, nc);
  P(PF.opHandTruck(), 2.0, 0, 3.55, Math.PI - 0.1, nc);
  P(PF.opFan(), 2.0, 2.5, zi, Math.PI, nc);
  P(PF.opCart(), 3.15, 0, 3.42, Math.PI);
  P(PF.opAmmo(0), 4.5, 0, 3.34, 0); P(PF.opAmmo(1), 4.4, 0.6, 3.36, 0.06, nc); // (a large crate, 1.2 x 0.8 x 0.6, a small one on it)
  // assembly: preparation table between the columns, a bench at each end, floor drain in front. The table lies front to rear (the sheet has
  // it across): the bots' network then keeps a lane on each side of it, between the table and the columns, from the entrance to the rear exit
  P(PF.opPrepTable(), 0, 0, 0, H);
  P(PF.opBench(2.0), 0.87, 0, 0, H); P(PF.opBench(2.0), -0.87, 0, 0, H); // (along its long sides, pushed in: the lanes at x = 1.5 and -1.5 stay open for the bots)
  P(PF.opDrain(), 0.5, 0, 2.6, 0, nc);
  // east wall: two shelving units side by side (the east door opens under them, toward the rear)
  for (const z of [1.03, 2.83]) opSoftPlace(PF.opShelving(1.8, 1.3), xi - 0.31, 0, z, -H, 0.9, 0.3, 1.3);
  // rear wall: workbench with the tool pegboard over it (west of the rear exit); lockers and crates (east of it); extinguisher by the storage door
  P(PF.opWorkbench(2.4), -1.6, 0, -zi + 0.41, 0);
  P(PF.opPegboard(), -1.6, 1.62, -zi, 0, nc);
  P(PF.opAmmo(1), -2.3, 0.905, -3.4, 0.15, nc);
  P(PF.opLocker(3, 0.4, 2.0), 1.85, 0, -zi + 0.26, 0);
  P(PF.opAmmo(1), 2.67, 0, -3.42, H, nc); P(PF.opAmmo(1), 2.67, 0.4, -3.42, H - 0.1, nc);
  P(PF.opExtinguisher(), 3.4, 0.3, -1.65, 0, nc);
  // storage room: shelving with crates along the rear and west walls, crates in the corner
  opSoftPlace(PF.opShelving(1.8, 1.3, 0.38), 4.05, 0, -zi + 0.19, 0, 0.9, 0.19, 1.3); // (shallow: the doorway's 1.5 m stays clear)
  opSoftPlace(PF.opShelving(1.2, 1.6), 3.41, 0, -2.5, H, 0.6, 0.3, 1.6);
  P(PF.opAmmo(2), 5.45, 0, -3.42, H, nc); P(PF.opAmmo(2), 5.45, 0.35, -3.4, H + 0.1, nc); P(PF.opAmmo(1), 5.48, 0, -2.75, H - 0.08, nc);
  // cable conduits (sheet 3, item 21): two runs under the hall's ceiling from the annex's panel, down the east columns to a junction box
  M.save().color([0.6, 0.61, 0.6]); M.cls = 1;
  M.tube('opInox', 0.025, [[-1.35, c0 - 0.08, -zi], [-1.35, c0 - 0.08, -0.9], [xi, c0 - 0.08, -0.9]], 6);
  M.tube('opInox', 0.02, [[-1.25, c0 - 0.12, -zi], [-1.25, c0 - 0.12, 2.1], [xi, c0 - 0.12, 2.1]], 6);
  for (const [zr, z] of [[-0.9, -0.725], [2.1, 2.275]]) { M.tube('opInox', 0.025, [[2.5, c0 - 0.1, zr], [2.5, c0 - 0.1, z], [2.5, 1.55, z]], 6); M.boxB('opInox', 2.4, 2.6, 1.3, 1.55, z - 0.03, z + 0.04, { bevel: 0.01 }); }
  // utility annex (the rear exit crosses it): sink on the west wall, electrical panel and its conduits on the main block's wall, water heater,
  // a bench on the east wall, first aid, extinguisher, bin
  for (const x of [-1.45, -1.35, -1.25, -1.15]) M.tube('opInox', 0.016, [[x, 1.9, -4.1], [x, 2.8, -4.1]], 5);
  M.restore();
  P(PF.opSink(), -1.94, 0, -5.2, H);
  P(PF.opElecPanel(), -1.3, 1.0, -4.018, Math.PI, nc);
  P(PF.opHeater(), -1.9, 0, -6.4, 0, nc);
  P(PF.opBench(2.0), 2.04, 0, -5.4, H);
  P(PF.opFirstAid(), 2.25, 1.55, -5.9, -H, nc);
  P(PF.opExtinguisher(), 2.25, 0.3, -4.5, -H, nc);
  P(PF.opWasteBin(), -0.75, 0, -4.28, 0, nc);
  P(PF.opWallStrip(), 4.05, 2.3, -zi, 0, nc); P(PF.opWallStrip(), 2.25, 2.3, -5.4, -H, nc); // (storage room, annex)
  P(PF.opAmmo(2), -1.2, 0, -6.4, 0.1, nc);
  // a rubber mat on the porch in front of the entrance
  M.save().color([0.1, 0.1, 0.095]).local(1); M.cls = 1; M.boxB('opPaint', -4.2, -2.8, 0.15, 0.164, 4.45, 5.35, { bevel: 0.004 });
  M.cls = 2; M.color([0.17, 0.17, 0.16]); for (let z = 4.49; z < 5.32; z += 0.04) M.boxB('opPaint', -4.17, -2.83, 0.164, 0.17, z, z + 0.02, { skip: 'y' });
  M.restore();
}

/* ---------- Upper floor furniture (sheet 2): offices, radio office, briefing room, kitchenette, restroom, stair bay ---------- */
function opFurnishUpper() {
  const M = DECOR, F1 = OP_CP.F1, H = Math.PI / 2, xi = OPB.xi, zi = OPB.zi, cf = OPB.cf, cr = OPB.cr, nc = { nocol: true };
  const P = (pf, x, y, z, ry, o) => opPut(pf, x, F1 + y, z, ry, o);
  // Supervisor office (x -5.75 to -2.1): desk across the room, its chair on the window side, two visitor chairs, filing cabinet and bookcase
  // against the east partition, clock, plant
  P(PF.opDesk(1.6, 0.8, 2), -4.82, 0, 2.55, 0); P(PF.opSwivel(), -4.8, 0, 3.25, Math.PI, nc);
  P(PF.opMonitor(OPS.scrMap), -5.05, 0.75, 2.45, 0, nc); P(PF.opTaskLamp(), -4.25, 0.75, 2.42, 0.5, nc);
  P(PF.opTower(), -4.56, 0, 2.5, 0, nc); // (under the desk, in the knee space)
  P(PF.opVisitor(), -5.2, 0, 1.62, 0, nc); P(PF.opVisitor(), -4.55, 0, 1.62, 0, nc);
  P(PF.opFiling(), -2.42, 0, 1.6, -H);
  opSoftPlace(PF.opBookcase(1.2, 1), -2.3, F1, 2.75, -H, 0.6, 0.2, 1.8);
  P(PF.opClock(), -5.0, 2.3, cf + 0.1, 0, nc);
  P(PF.opPlant(), -2.42, 0, 3.53, 1.1, nc);
  P(PF.opBin(), -3.75, 0, 3.45, 0, nc);
  // Planning office (x -1.9 to 1.9): planning table in the middle, two swivel chairs on the window side, the wall map on the corridor partition,
  // filing cabinets and a bookcase against the west partition, the stand of rolled maps against the east one
  P(PF.opPlanTable(2.0, 1.0), 0, 0, 2.5, 0);
  for (const x of [-0.45, 0.45]) P(PF.opSwivel(), x, 0, 3.25, Math.PI, nc);
  P(PF.opMapBoard(2.0, 1.2, OPS.mapW), -0.7, 1.7, cf + 0.1, 0, nc);
  P(PF.opFiling(), -1.59, 0, 1.56, H); P(PF.opFiling(), -1.59, 0, 2.04, H);
  opSoftPlace(PF.opBookcase(1.2, 2), -1.7, F1, 3.05, H, 0.6, 0.2, 1.8);
  P(PF.opMapStand(), 1.68, 0, 3.0, -H, nc);
  P(PF.opBin(), 1.6, 0, 3.5, 0, nc);
  // Shared office (x 2.1 to 5.75): two desks under the window, screens, towers, task lamp, bookcase, locker
  for (const x of [2.95, 4.7]) { P(PF.opDesk(1.6, 0.8, 2, 1.3), x, 0, 3.34, Math.PI); P(PF.opSwivel(), x, 0, 2.6, 0, nc); P(PF.opTower(), x + 0.26, 0, 3.3, Math.PI, nc); }
  P(PF.opMonitor(OPS.scrTxt), 2.85, 0.75, 3.48, Math.PI, nc); P(PF.opMonitor(OPS.scrMap), 4.6, 0.75, 3.48, Math.PI, nc); P(PF.opTaskLamp(), 5.3, 0.75, 3.5, Math.PI - 0.5, nc);
  opSoftPlace(PF.opBookcase(1.2, 3), 2.3, F1, 1.9, H, 0.6, 0.2, 1.8);
  P(PF.opLocker(2, 0.45), xi - 0.26, 0, 1.75, -H);
  P(PF.opBin(), 5.5, 0, 2.55, 0, nc); P(PF.opClock(), 3.0, 2.3, cf + 0.1, 0, nc); P(PF.opTaskLamp(), 2.3, 0.75, 3.5, Math.PI + 0.5, nc);
  // Radio office (x -2.85 to -0.15): console against the rear wall under the window, its chair; the equipment rack and two filing cabinets on the east
  // partition (clear of the window), a locker on the west one, clock
  P(PF.opRadioConsole(), -1.6, 0, -zi + 0.4, 0); P(PF.opSwivel(), -1.6, 0, -2.5, Math.PI, nc);
  P(PF.opRack(), -0.55, 0, -1.6, -H);
  P(PF.opFiling(), -0.46, 0, -2.2, -H); P(PF.opFiling(), -0.46, 0, -2.67, -H);
  P(PF.opLocker(2, 0.45), -2.6, 0, -2.05, H);
  P(PF.opClock(), -2.45, 2.3, cr - 0.1, Math.PI, nc);
  P(PF.opBin(), -2.6, 0, -2.75, 0, nc);
  // Briefing room (x 0.05 to 3.5): table and six chairs (three a side), whiteboard on the west partition (on the table's axis), a bookcase
  // in the rear corner of the east one, clock
  P(PF.opPlanTable(2.0, 1.0, false), 1.775, 0, -2.45, 0);
  for (const x of [1.125, 1.775, 2.425]) { P(PF.opVisitor(false), x, 0, -1.72, Math.PI, nc); P(PF.opVisitor(false), x, 0, -3.18, 0, nc); }
  P(PF.opWhiteboard(), 0.05, 1.6, -2.45, H, nc);
  opSoftPlace(PF.opBookcase(1.2, 5), 3.3, F1, -1.87, -H, 0.6, 0.2, 1.8);
  P(PF.opFiling(), 3.19, 0, -3.0, -H);
  P(PF.opClock(), 3.5, 2.3, -1.9, -H, nc);
  P(PF.opBin(), 0.3, 0, -1.45, 0, nc);
  // kitchenette (x 3.7 to 4.75): counter with its inset sink across the rear wall, mini fridge on the west partition (opposite the restroom's
  // doorway, clear of the counter's front); restroom (x 4.85 to 5.75): toilet, handwash basin
  // (kitchenette x 3.7 to 5.75, z -2.75 to -1.15: the counter at its kit size along the east wall, its sink at the rear end, the fridge in
  // the corner against the cross partition; restroom z -3.75 to -2.85: toilet at the east end, wall-hung basin at the west end)
  P(PF.opKitchen(1.6, true), 5.45, 0, -1.95, -H); // (sink at the corridor end: the fridge stands clear of its cupboard)
  P(PF.opFridge(), 4.875, 0, -2.45, 0);
  P(PF.opBin(), 4.98, 0, -1.33, 0, nc);
  P(PF.opVent(0.4, 0.3), 4.2, 2.6, -2.75, 0, nc);
  P(PF.opToilet(), 5.3, 0, -zi, 0, nc); M.save().color([0.3, 0.29, 0.27]); M.cls = 2; opStainFlat(M, OPW.blob, 5.02, 5.58, -3.8, -3.08, F1 + 0.004); M.restore();
  P(PF.opBasin(), 4.12, 0, -zi, 0, nc);
  // stair bay: extinguisher by the window of the gable, a plant and a bin in the nook over the lower flight
  P(PF.opExtinguisher(), -xi, 0.3, 0.6, H, nc);
  P(PF.opPlant(), -3.3, 0, -1.4, 0.3, nc);
  P(PF.opBin(), -3.7, 0, -1.42, 0, nc);
  // corridor: wall vents, extinguisher by the landing door; the wear of the traffic along its middle
  for (const x of [-1.5, 2.3]) P(PF.opVent(0.4, 0.3), x, 2.75, cf - 0.1, Math.PI, nc);
  P(PF.opExtinguisher(), 5.3, 0.3, cf - 0.1, Math.PI, nc);
  M.save().color([0.3, 0.28, 0.25]); M.cls = 2; for (let x = -3.9; x < 5.6; x += 3.2) opStainFlat(M, OPW.wear, x, Math.min(5.75, x + 3.2), -0.62, 0.62, F1 + 0.003); M.restore();
}

/* ---------- Lights: LED strips under the ceilings, lit (their warm light is baked, stopped by the walls: a pool under each) ---------- */
function opLights() {
  const M = DECOR, c = [1.0, 0.9, 0.76];
  const strip = (x, y, z, ry = 0, p = 1.85, r = 4.6, gl = 1) => {
    M.place(PF.opCeilLight(1.2), x, y, z, ry, { nocol: true }); M.lamp(x, y - 0.15, z, c, p, r, 0.85);
    // its glow on the ceiling (a quad turned downward)
    const hx = ry ? 0.55 : 1.15, hz = ry ? 1.15 : 0.55, [cx, cy, cw, ch] = OPW.blob, u0 = cx / 1024, u1 = (cx + cw) / 1024, v0 = cy / 1024, v1 = (cy + ch) / 1024;
    M.save().local(1).color([0.5 * gl, 0.4 * gl, 0.24 * gl]); M.cls = 2; M.uvS = 1; M.uvO = [0, 0];
    const B = M.buf('opGlow', x, y - 0.009, z), ids = [[x - hx, z - hz, u0, v0], [x + hx, z - hz, u1, v0], [x + hx, z + hz, u1, v1], [x - hx, z + hz, u0, v1]].map(([px, pz, u, v]) => M.v(B, px, y - 0.009, pz, 0, -1, 0, u, v));
    M.quadI(B, ids[0], ids[1], ids[2], ids[3]); M.restore();
  };
  // hall (two rows), storage room, annex, under the stair's upper floor
  for (const x of [-2.9, 0.0, 2.9]) strip(x, OPB.c0, 1.4);
  for (const [x, z] of [[-1.3, -1.4], [1.5, -1.4], [4.3, -0.6]]) strip(x, OPB.c0, z);
  strip(4.4, OPB.c0, -2.7, Math.PI / 2, 1.5, 3.8);
  strip(0.6, OP_AX.hs, -5.5, 0, 1.5, 4, 0.5); // (its glow halved: the pool would cover the whole of this small ceiling)
  // upper floor: offices, radio office, briefing room, kitchenette, restroom, corridor, stair bay
  for (const [x, z] of [[-3.9, 2.45], [0.0, 2.45], [3.9, 2.45], [-1.5, -2.45], [1.775, -2.45]]) strip(x, OPB.c1, z, 0, 1.45, 5.0);
  strip(4.6, OPB.c1, -1.95, Math.PI / 2, 2.0, 3.5); strip(4.7, OPB.c1, -3.3, 0, 2.2, 3);
  for (const x of [-2.6, 0.6, 3.8]) strip(x, OPB.c1, 0.0, 0, 1.5, 5.6);
  strip(-4.9, OPB.c1, -2.2, Math.PI / 2, 1.7, 5.5);
}

/* What the building needs from the map: photo textures (assets/tex), procedural surfaces, atlases (kit, after the surfaces) and its own
   materials (after the library); the plan (02yq-outpost.js) adds them to the yard's */
const OP_CP_TEX = ['concrete', 'plaster', 'opSteel', 'paintwood', 'wood', 'timber', 'crate'], OP_CP_SURF = ['opPanel', 'opWallIn', 'opCeilTx', 'opWood', 'opPaintTx', 'opSteelTx', 'grating', 'vinyl'];
function opCpKit() { TEX.opSigns = opSignAtlas(); TEX.opStain = opStainAtlas(); }
function opCpMaterials(M) { opMakeMaterials(M); }
/* Bot points of interest in and on the building: [x, y, z, route, hold] (on the nodes of the network: cell centers) */
const OP_CP_POI = [
  // ground floor: hall, front windows, east door, foot of the interior stair, storage room, annex, rear exit, foot of the exterior stair
  [-1.5, 0, 2.5, 'M'], [3.5, 0, 0.5, 'M'], [-3.5, 0, 0.5, 'M'], [0.5, 0, 2.5, 'M', 1], [3.5, 0, 2.5, 'M', 1], [4.5, 0, -0.5, 'M'],
  [4.5, 0, -2.5, 'M'], [0.5, 0, -5.5, 'M'], [-0.5, 0, -5.5, 'M'],
  [0.5, 0, -2.5, 'M'], [6.5, 0, 6.5, 'M'],
  // exterior landing (hold)
  [6.5, OP_CP.F1, -0.5, 'M', 1],
  // upper floor: corridor, offices, radio office; holds at the windows
  [-4.5, OP_CP.F1, 0.5, 'M'], [0.5, OP_CP.F1, -0.5, 'M'], [4.5, OP_CP.F1, 0.5, 'M'],
  [-3.5, OP_CP.F1, 2.5, 'M', 1], [3.5, OP_CP.F1, 2.5, 'M', 1],
  [-1.5, OP_CP.F1, -2.5, 'M', 1],
];
/* Sniper post: the exterior landing (mirrored in z for Bravo: still on the landing) */
const OP_CP_SNIPER = [6.5, OP_CP.F1, -0.3];
/* Named zones of the building (minimap), from the most specific: [name, x0, x1, z0, z1, y0, y1]; the heights tell the two levels apart
   where a reader of the zones takes them into account (otherwise the first one in the list that contains x, z wins: the ground floor) */
const OP_CP_ZONES = [
  [_t('Stairs'), 6.0, 7.55, -1.7, 5.55, 0, 5], [_t('Utility Annex'), -2.5, 2.5, -7, -4, 0, 4],
  [_t('Storage'), 2.9, 6, -4, -1.65, 0, 3], [_t('Stairwell'), -6, -2.95, -4, 0.05, 0, 3.15], [_t('Assembly Hall'), -6, 6, -4, 4, 0, 3.15],
  [_t('Stairwell'), -6, -2.95, -4, -1.05, 3.15, 7], [_t('Radio Office'), -2.95, -0.05, -4, -1.05, 3.15, 7], [_t('Briefing Room'), -0.05, 3.6, -4, -1.05, 3.15, 7], [_t('Kitchenette'), 3.6, 6, -4, -1.05, 3.15, 7],
  [_t('Supervisor Office'), -6, -2, 1.05, 4, 3.15, 7], [_t('Planning Office'), -2, 2, 1.05, 4, 3.15, 7], [_t('Shared Office'), 2, 6, 1.05, 4, 3.15, 7],
  [_t('Corridor'), -6, 6, -1.05, 1.05, 3.15, 7], [_t('Front Porch'), -6.3, 6, 4, 6.4, 0, 4],
];
