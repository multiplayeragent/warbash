/* ==========================================================================
   JUNGLE OUTPOST, the guard tower and the utility shed (kit and colors: 02yp-outpost-yard.js; the building's props and materials:
   02yoa-outpost-props.js).
   GUARD TOWER (west, on the center line: both teams are as far from it; 1.5 m clear of the west fence), sheet 4: four 0.3 m legs of
   dark weathered grey steel (rust at the joints and the feet) unbroken from their concrete pads to the cabin floor, braced in X with mid
   girts (angle sections) on every face nobody walks through, a 4 x 4 m timber lookout cabin of weathered boards on slim 0.15 m posts,
   open all around between a 1 m parapet and a slim header, a 30 degree pyramid roof of grey-brown corrugated sheet over exposed rafters,
   its lamp under the eave; under the cabin a dark planked soffit on joists.
   - At the foot, between the legs, the guard room: the shed's corrugated sheet outside (matte olive, a step lighter; the legs and an X
     brace over each closed panel stand proud of it), painted panel lining inside, a door to the yard (east) and one to the back (west)
     with the building's kit leaves swung open flat against the walls, a window north and south; desk with the field radio and the
     telephone, lockers, cot, first aid cabinet, water cooler, crates, the map and notes on the board, sandbags under the south window.
   - Its roof is a steel deck at 3.3 m edged with a dark channel, open to a narrow porch over the yard door (east); above, the cabin floor
     at 6.6 m, a ledge round the cabin and the west landing (planked, a 1 m plank infill on its outer rail); the porch and the landing on
     two slim posts each, carried between them on brackets off the legs; inside, searchlight, chair, desk with the field telephone and
     the radio, map table, binoculars on the sill.
   - Two mirrored open steel switchback stairs, one on each face (north for Alpha, south for Bravo): a flight from the back (west) up to
     the porch (3.3 m), then a flight back west up to the landing (6.6 m). Open stringers on posts, grating treads, handrails both sides
     in the building stair's grey; a concrete pad at the foot.
   UTILITY SHED (east, on the center line), sheet 4: mid-olive corrugated metal shed 6 x 7 m on a concrete slab, neutral galvanized gable
   roof (ribs 0.2 m apart, a dark grey underside), double doors (2.6 m, nearly half the gable) on both gables (a way in from each yard, leaves swung open), windows on the sides;
   generator, fuel drums, shelving, workbench, a shelving rack in the middle that cuts the line of fire from one door to the other.
   ========================================================================== */
/* Tower frame: legs (centers), half-depth, deck and cabin floor levels, eaves; flight lanes (|z|) and runs (x), porch and balcony; cabin
   inset from the legs (4 x 4 m cabin on the 5 x 5 m frame) */
const OPT = { x0: -18.5, x1: -13.5, z: 2.5, deck: 3.3, cab: 6.6, eave: 8.85, inner: [2.67, 4.0], outer: [4.0, 5.1], low: [-19.2, -13.5], up: [-18.5, -13.0], porch: [-13.5, -11.95], balc: [-21.5, -18.5], end: 5.2, cin: 0.5 };
/* Colors of the tower: dark smooth charcoal (legs, beams, bracing: matte paint; rust at the joints and the feet), the command stair's dark
   steel and grating (railings, stringers, treads), the dark planked soffit under the cabin, its posts, weathered boards and their darker frame, roof (lit faces,
   underside), guard room lining */
const OPTC = { steel: [0.225, 0.23, 0.235], rail: [0.27, 0.28, 0.28], tread: [0.36, 0.37, 0.38], rust: [0.33, 0.19, 0.11], soffit: [0.5, 0.4, 0.31], post: [0.4, 0.37, 0.34], plank: [0.6, 0.62, 0.66], frame: [0.44, 0.46, 0.5], floor: [0.55, 0.56, 0.58], roof: [0.3, 0.28, 0.27], under: [0.1, 0.095, 0.09], lining: [0.72, 0.71, 0.68], ceil: [0.78, 0.78, 0.77] };

/* Pipe railing (sheet 4: stair and landing rails): top rail at 1.05 m, knee rail, posts every 1.5 m at most; along axis ('x': at z = f,
   'z': at x = f) from a0 to a1, rising from y0 to y1; noted in RAILS so that the end of the build stops soldiers along it (railingsSeal) */
function opyPipe(f, a0, a1, axis, y0, y1 = y0, post0 = true, post1 = true) {
  const M = DECOR, P = (a, y) => (axis === 'x' ? [a, y, f] : [f, y, a]), yAt = (a) => lerp(y0, y1, (a - a0) / (a1 - a0 || 1));
  RAILS.push({ x: f, y: y0, a0, a1, axis, ys: [y0, y1] });
  M.save().color(OPTC.rail); M.cls = 1;
  M.tube('opSteel', 0.024, [P(a0, y0 + 1.05), P(a1, y1 + 1.05)], 6); M.tube('opSteel', 0.016, [P(a0, y0 + 0.52), P(a1, y1 + 0.52)], 5);
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 1.5));
  for (let i = 0; i <= n; i++) {
    if ((i === 0 && !post0) || (i === n && !post1)) continue;
    const a = lerp(a0, a1, i / n), y = yAt(a), q = P(a, y);
    M.boxB('opSteel', q[0] - 0.025, q[0] + 0.025, y - 0.05, y + 1.05, q[2] - 0.025, q[2] + 0.025);
  }
  M.restore();
}
/* Grating panel (one layer, seen from above and below): x0..x1, z0..z1 at height y */
function opyGrate(x0, x1, z0, z1, y) {
  const M = DECOR; M.save().color(OPTC.tread).local(1); M.cls = 1;
  M.quad('opGrating', [x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, 1, 0]); M.quad('opGrating', [x0, y - 0.004, z0], [x1, y - 0.004, z0], [x1, y - 0.004, z1], [x0, y - 0.004, z1], [0, -1, 0]);
  M.restore();
}
/* Open steel flight: walkable ramp (RAMPS) over [x0, x1] x [z0, z1] rising along x from h0 (at x0) to h1; grating treads with a nosing
   (each stops shots), two channel stringers */
function opyFlight(x0, x1, z0, z1, h0, h1) {
  RAMPS.push({ x0, x1, z0, z1, axis: 'x', h0, h1 });
  const M = DECOR, len = x1 - x0, rise = h1 - h0, n = Math.max(2, Math.round(Math.abs(rise) / 0.2));
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n, top = Math.max(0.05, lerp(h0, h1, (t0 + t1) / 2) + Math.abs(rise) / n / 2), a0 = x0 + len * t0, a1 = x0 + len * t1;
    const lo = rise > 0 ? a0 - 0.03 : a0, hi = rise > 0 ? a1 : a1 + 0.03;
    M.save().color(OPTC.tread).local(1); M.cls = 1;
    M.quad('opGrating', [lo, top, z0 + 0.06], [hi, top, z0 + 0.06], [hi, top, z1 - 0.06], [lo, top, z1 - 0.06], [0, 1, 0]);
    M.color(OPTC.rail); M.boxB('opSteel', rise > 0 ? lo : hi - 0.035, rise > 0 ? lo + 0.035 : hi, top - 0.04, top, z0 + 0.06, z1 - 0.06); // nosing
    M.restore();
    DECOR.col(Math.min(a0, a1), Math.max(a0, a1), top - 0.05, top, z0, z1, 'metal', true);
  }
  const L = hyp(len, rise), ang = Math.atan2(rise, len);
  M.save().color(OPTC.rail).local(1);
  for (const z of [z0 + 0.03, z1 - 0.03]) { M.save().move(x0, h0, z).rotZ(ang); M.boxB('opSteel', -0.05, L + 0.05, -0.28, 0.0, -0.03, 0.03); M.restore(); }
  M.restore();
}
/* Steel H section (wide flange) standing from y0 to y1 at (x, z), flanges across z */
function opyHCol(x, z, y0, y1, w = 0.24) {
  const M = DECOR, h = w / 2, tf = 0.02, tw = 0.014;
  M.save().color(OPTC.steel).local(1);
  for (const s of [-1, 1]) M.boxB('opPaint', x - h, x + h, y0, y1, Math.min(z + s * (h - tf), z + s * h), Math.max(z + s * (h - tf), z + s * h));
  M.boxB('opPaint', x - tw / 2, x + tw / 2, y0, y1, z - h + tf, z + h - tf);
  M.restore();
}
/* Steel angle section (L, w wide, 9 mm) from p to q: the bracing (sheet 4: bold X's) */
function opyAngle(M, p, q, w = 0.09) {
  const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2], L = hyp3(dx, dy, dz), t = 0.009;
  M.save().move(p[0], p[1], p[2]).rotY(Math.atan2(dx, dz)).rotX(-Math.asin(dy / L));
  M.extrude('opPaint', [[-w / 2, -w / 2], [w / 2, -w / 2], [w / 2, -w / 2 + t], [-w / 2 + t, -w / 2 + t], [-w / 2 + t, w / 2], [-w / 2, w / 2]], L);
  M.restore();
}
/* X brace with a mid girt over a rectangular bay of a vertical plane (axis 'x': the plane z = f, from a0 to a1; 'z': x = f), from y0 to y1 */
function opyXBay(M, axis, f, a0, a1, y0, y1, girt = true) {
  const P = (a, y) => (axis === 'x' ? [a, y, f] : [f, y, a]), ym = (y0 + y1) / 2;
  opyAngle(M, P(a0, y0), P(a1, y1)); opyAngle(M, P(a0, y1), P(a1, y0));
  if (girt) opyAngle(M, P(a0, ym), P(a1, ym), 0.08);
}
/* Concrete pad with a steel base plate under a leg or a post (s: half side of the pad) */
function opyPad(x, z, s = 0.2) {
  const M = DECOR; M.save().color([0.6, 0.57, 0.53]).local(1);
  M.boxB('concrete', x - s, x + s, -0.1, 0.12, z - s, z + s, { bevel: 0.02 });
  M.color(OPTC.steel); M.boxB('opSteel', x - s * 0.85, x + s * 0.85, 0.12, 0.14, z - s * 0.85, z + s * 0.85);
  M.restore();
}
/* Water cooler (sheet 3 item 17): white cabinet, smooth blue bottle upside down on top, two taps */
PF.opyCooler = () => prefab('opyCooler', (M) => {
  M.local(1); M.color([0.84, 0.84, 0.81]); M.boxB('opEnamel', -0.17, 0.17, 0, 0.92, -0.17, 0.17, { bevel: 0.02 });
  M.color([0.55, 0.56, 0.55]); M.boxB('opEnamel', -0.175, 0.175, 0, 0.06, -0.175, 0.175);
  M.color([0.45, 0.6, 0.78]); M.save().move(0, 0.92, 0); M.lathe('opEnamel', [[0.04, 0], [0.05, 0.06], [0.14, 0.12], [0.15, 0.2], [0.15, 0.4], [0.13, 0.45], [0, 0.47]], 16, { sharp: 1.2 }); M.restore();
  M.cls = 2; M.color([0.85, 0.2, 0.15]); M.boxB('plastic', -0.08, -0.03, 0.66, 0.72, 0.17, 0.21); M.color([0.2, 0.4, 0.85]); M.boxB('plastic', 0.03, 0.08, 0.66, 0.72, 0.17, 0.21);
  M.col(-0.17, 0.17, 0, 1.39, -0.17, 0.17, 'metal');
});

/* Door leaf after the command building's kit door (opLeaf, 02yo-outpost-building.js): olive steel leaf, a narrow slit of dark glass by
   the lock in its frame, kick plate, lever handle, wear; hinged at (x, z) on the inside face of an end wall (x = const), its width
   running toward +z (sz = 1) or -z, opened flat back against the wall; no collision */
function opyKitLeaf(x, z, sz, w, h) {
  const M = DECOR;
  M.save().move(x, 0, z).rotY(sz > 0 ? -Math.PI / 2 : Math.PI / 2).color(OPY.leaf).local(1); M.cls = 1;
  M.boxB('opPaint', 0, w, 0.01, h - 0.01, -0.022, 0.022, { bevel: 0.006 });
  M.cls = 2; M.color(OPY.leaf.map((v) => v * 0.8));
  for (const sd of [-1, 1]) {
    M.boxB('opPaint', 0.06, w - 0.06, 0.06, 0.3, sd * 0.022, sd * 0.027);
    const x0 = w - 0.32, x1 = w - 0.18, q0 = h * 0.56, q1 = h * 0.84;
    M.boxB('opPaint', x0 - 0.025, x1 + 0.025, q0 - 0.025, q1 + 0.025, sd * 0.022, sd * 0.026);
    M.save().color(OPC.glass); M.quad('opGlass', [x0, q0, sd * 0.03], [x1, q0, sd * 0.03], [x1, q1, sd * 0.03], [x0, q1, sd * 0.03], [0, 0, sd]); M.restore();
  }
  M.color([0.62, 0.62, 0.6]); for (const sd of [-1, 1]) M.boxB('opInox', w - 0.13, w - 0.05, 0.98, 1.02, sd * 0.022, sd * 0.07);
  for (const sd of [1, -1]) { M.save(); if (sd < 0) M.move(w, 0, 0).rotY(Math.PI); M.color([0.14, 0.13, 0.11]); opStain(M, OPW.wear, 0.05, w - 0.05, 0.04, 0.42, 0.0285); M.color([0.3, 0.17, 0.09]); opStain(M, OPW.splash, 0, w, 0.01, 0.2, 0.0287); M.restore(); }
  M.restore();
}
/* ---------- Guard tower ---------- */
function opyTower() {
  const M = DECOR, T = OPT, cx = (T.x0 + T.x1) / 2, wt = 0.14, lg = 0.15, gh = T.deck - 0.3, H = Math.PI / 2, sk = wt / 2;
  const c0 = T.x0 + T.cin, c1 = T.x1 - T.cin, cz = T.z - T.cin; // cabin walls (frame lines)
  // ---- legs (sheet 4: four legs and the cabin are the tower): 0.3 m H sections unbroken from their pads to the cabin floor; the porch and
  // the balcony on two slim posts each (0.12 m, at their outer corners), carried in between on brackets off the legs; rust at the feet
  const legs = []; for (const x of [T.x0, T.x1]) for (const z of [-T.z, T.z]) legs.push([x, z]);
  for (const [x, z] of legs) { opyHCol(x, z, 0.14, T.cab - 0.2, 0.3); opyPad(x, z, 0.26); DECOR.col(x - lg, x + lg, 0, T.cab - 0.2, z - lg, z + lg, 'metal'); }
  const porchPosts = [-5.05, 5.05].map((z) => [T.porch[1] - 0.1, z]), balcPosts = [-5.05, 5.05].map((z) => [T.balc[0] + 0.1, z]);
  M.save().color(OPTC.steel).local(1);
  for (const [x, z] of porchPosts) M.boxB('opPaint', x - 0.06, x + 0.06, 0.14, T.deck - 0.12, z - 0.06, z + 0.06);
  for (const [x, z] of balcPosts) M.boxB('opPaint', x - 0.1, x + 0.1, 0.14, T.cab - 0.12, z - 0.1, z + 0.1);
  M.restore();
  for (const [x, z] of porchPosts) { opyPad(x, z, 0.16); DECOR.col(x - 0.06, x + 0.06, 0, T.deck - 0.12, z - 0.06, z + 0.06, 'metal'); }
  for (const [x, z] of balcPosts) { opyPad(x, z, 0.2); DECOR.col(x - 0.1, x + 0.1, 0, T.cab - 0.12, z - 0.1, z + 0.1, 'metal'); }
  // rust: run down from the joints (deck, cabin floor) and up from the feet, on the legs' outer flanges
  M.save().color(OPTC.rust); M.cls = 2;
  for (const [x, z] of legs) {
    const ox = Math.sign(x - cx), oz = Math.sign(z), fz = z + oz * 0.153;
    for (const [y0, y1, cell] of [[0.14, 0.75, OPW.splash], [T.deck - 0.7, T.deck - 0.05, OPW.drip0], [T.cab - 1.0, T.cab - 0.25, OPW.drip1]]) {
      const a = oz > 0 ? -ox : ox; opyStainQ(M, cell, [[x - a * 0.14, y0, fz], [x + a * 0.14, y0, fz], [x + a * 0.14, y1, fz], [x - a * 0.14, y1, fz]], [0, 0, oz]);
    }
  }
  M.restore();
  // ---- bracing (sheet 4, the tower's signature): X of angle sections with a mid girt on the north, south and west faces between the deck
  // and the cabin floor; on the east face (the way from the porch onto the deck) knee braces only; X over each closed panel of the guard
  // room, proud of its skin
  M.save().color(OPTC.steel).local(1); M.cls = 1;
  const yb0 = T.deck + 0.06, yb1 = T.cab - 0.34, po = sk + 0.05;
  for (const sz of [-1, 1]) opyXBay(M, 'x', sz * (T.z + po), T.x0 + 0.12, T.x1 - 0.12, yb0, yb1);
  opyXBay(M, 'z', T.x0 - po, -T.z + 0.12, T.z - 0.12, yb0, yb1);
  for (const sz of [-1, 1]) opyAngle(M, [T.x1 + po, yb1 - 1.0, sz * (T.z - 0.12)], [T.x1 + po, yb1 + 0.1, sz * (T.z - 1.2)]);
  for (const [x, o] of [[T.x1, 1], [T.x0, -1]]) for (const sz of [-1, 1]) opyXBay(M, 'z', x + o * po, sz * 1.04, sz * (T.z - 0.13), 0.3, gh - 0.12, false);
  for (const sz of [-1, 1]) opyXBay(M, 'x', sz * (T.z + po), T.x0 + 0.13, cx - 0.12, 0.3, gh - 0.12, false);
  for (const sz of [-1, 1]) {
    // brackets: off the east legs to the porch's edge beam, off the west legs to the balcony's (diagonal struts), knee braces at the two
    // corner posts of each
    opyAngle(M, [T.x1 + 0.15, T.deck - 1.1, sz * T.z], [T.porch[1] - 0.12, T.deck - 0.3, sz * T.z]);
    opyAngle(M, [T.x0 - 0.15, T.cab - 2.2, sz * T.z], [T.balc[0] + 0.14, T.cab - 0.3, sz * T.z]);
    opyAngle(M, [T.porch[1] - 0.1, T.deck - 0.95, sz * 4.98], [T.porch[1] - 0.1, T.deck - 0.3, sz * 4.1]);
    opyAngle(M, [T.balc[0] + 0.1, T.cab - 1.1, sz * 4.98], [T.balc[0] + 0.1, T.cab - 0.3, sz * 3.9]);
    // X in the terrace's north and south bays and the porch's (above 2.2 m: the ground stays free), each on a hanger off the deck's edge
    opyXBay(M, 'x', sz * 5.05, T.balc[0] + 0.1, T.x0 - 0.12, 2.2, T.cab - 0.32); opyAngle(M, [T.x0 - 0.12, 2.2, sz * 5.05], [T.x0 - 0.12, T.cab - 0.3, sz * 5.05], 0.1);
    opyXBay(M, 'x', sz * 5.05, T.x1 + 0.12, T.porch[1] - 0.1, 2.2, T.deck - 0.32, false);
  }
  // X in the terrace's west face: two bays either side of a hanger at its middle
  for (const sz of [-1, 1]) opyXBay(M, 'z', T.balc[0] + 0.1, sz * 0.06, sz * 4.95, 2.2, T.cab - 0.32);
  opyAngle(M, [T.balc[0] + 0.1, 2.2, 0], [T.balc[0] + 0.1, T.cab - 0.3, 0], 0.1);
  // girts under the cabin floor, the dark steel channel round the deck slab
  for (const sz of [-1, 1]) M.boxB('opPaint', T.x0 - 0.12, T.x1 + 0.12, T.cab - 0.44, T.cab - 0.32, sz * T.z - 0.06, sz * T.z + 0.06);
  for (const x of [T.x0, T.x1]) M.boxB('opPaint', x - 0.06, x + 0.06, T.cab - 0.44, T.cab - 0.32, -T.z, T.z);
  for (const sz of [-1, 1]) M.boxB('opPaint', T.x0 - 0.1, T.x1 + 0.1, gh - 0.02, T.deck + 0.02, sz * (T.z + 0.03) - 0.07, sz * (T.z + 0.03) + 0.07);
  M.boxB('opPaint', T.x0 - 0.1, T.x0 + 0.04, gh - 0.02, T.deck + 0.02, -T.z, T.z);
  M.restore();

  // ---- guard room (ground floor): the shed's corrugated sheet outside (matte olive, a step lighter), painted panels inside (two skins of 7 cm on the frame lines), double
  // doors east (yard) and west (back), a window north and south, a mid post on the long walls
  const win = (a0, a1) => ({ a0, a1, b0: 1.1, b1: 1.75 }), door = { a0: -1.0, a1: 1.0, b0: 0, b1: 2.15 };
  const skins = (axis, f, out, a0, a1, ops) => {
    wallOpen('opyCorrM', axis, f + out * sk / 2, sk, a0, a1, 0, gh, ops, { tint: OPY.clad, frames: false, m: 'metal' });
    wallOpen('opWallIn', axis, f - out * sk / 2, sk, a0, a1, 0, gh, ops, { tint: OPTC.lining, frames: false, m: 'wood' });
  };
  for (const sz of [-1, 1]) skins('x', sz * T.z, sz, T.x0 + lg, T.x1 - lg, [win(-15.25, -14.15)]);
  skins('z', T.x1, 1, -T.z + lg, T.z - lg, [door]); skins('z', T.x0, -1, -T.z + lg, T.z - lg, [door]);
  // plinth, mid posts, door and window frames, the door leaves turned inside against the jambs (open)
  M.save().color([0.6, 0.57, 0.53]).local(1);
  for (const sz of [-1, 1]) M.boxB('concrete', T.x0 + lg, T.x1 - lg, 0, 0.12, sz * T.z - sk - 0.03, sz * T.z + sk + 0.03);
  for (const x of [T.x0, T.x1]) for (const sz of [-1, 1]) M.boxB('concrete', x - sk - 0.03, x + sk + 0.03, 0, 0.12, sz * 1.1, sz * (T.z - lg));
  M.color(OPTC.steel); for (const sz of [-1, 1]) M.boxB('opPaint', cx - 0.06, cx + 0.06, 0.12, gh, sz * T.z - sk - 0.05, sz * T.z + sk + 0.05);
  M.color(OPY.oliveDk);
  for (const x of [T.x0, T.x1]) { for (const z of [-1.05, 1.05]) M.boxB('opPaint', x - sk - 0.02, x + sk + 0.02, 0, 2.2, z - 0.06, z + 0.06); M.boxB('opPaint', x - sk - 0.02, x + sk + 0.02, 2.14, 2.25, -1.11, 1.11); }
  for (const sz of [-1, 1]) { const z = sz * T.z; for (const x of [-15.3, -14.1]) M.boxB('opPaint', x - 0.06, x + 0.06, 1.04, 1.81, z - sk - 0.02, z + sk + 0.02); M.boxB('opPaint', -15.36, -14.04, 1.74, 1.82, z - sk - 0.02, z + sk + 0.02); M.boxB('opPaint', -15.4, -14.0, 1.02, 1.11, z - sk - 0.06, z + sk + 0.06); }
  M.restore();
  // the leaves: the building's kit door (framed olive leaf, small glazed panel, lever handle), swung open inside flat against the wall
  for (const [x, o] of [[T.x1, -1], [T.x0, 1]]) for (const sz of [-1, 1]) opyKitLeaf(x + o * (sk + 0.03), sz * 1.0, sz, 0.98, 2.1);
  // floor slab, ceiling (underside of the deck, lighter), its lamp
  M.save().color(OPC.floor).world(1); M.cls = 1;
  M.quad('opFloor', [T.x0 + sk, 0.012, -T.z + sk], [T.x1 - sk, 0.012, -T.z + sk], [T.x1 - sk, 0.012, T.z - sk], [T.x0 + sk, 0.012, T.z - sk], [0, 1, 0]);
  M.color(OPTC.ceil); M.quad('opWallIn', [T.x0 + sk, gh - 0.01, T.z - sk], [T.x1 - sk, gh - 0.01, T.z - sk], [T.x1 - sk, gh - 0.01, -T.z + sk], [T.x0 + sk, gh - 0.01, -T.z + sk], [0, -1, 0]);
  M.restore();
  M.place(PF.opCeilLight(1.2), cx, gh - 0.01, 0, H, { nocol: true });
  M.lamp(cx, gh - 0.3, 0, [1.0, 0.86, 0.64], 1.3, 5.5, 0.6);
  // furniture: the passage from door to door (|z| < 1) stays free. North: desk with the field radio and the telephone under the window, its
  // chair, two double lockers, the wall clock; south: cot along the wall, sandbags under the window, first aid cabinet and
  // water cooler by the east door, crates; the map and notes on the board in the north-west corner, the extinguisher by the yard door (the
  // leaves lie flat against the end walls)
  const iz = T.z - sk, ix0 = T.x0 + sk, ix1 = T.x1 - sk; // inner faces
  M.place(PF.opyTable(1.3, 0.7), -14.7, 0, iz - 0.37, 0); M.place(PF.opyRadio(), -14.95, 0.75, iz - 0.3, Math.PI + 0.08); M.place(PF.opyPhone(), -14.3, 0.75, iz - 0.27, Math.PI - 0.3);
  M.place(PF.opyChair(), -14.8, 0, 1.38, 0.2, { tint: OPY.oliveDk });
  M.place(PF.opLocker(2, 0.45, 1.8), -16.9, 0, iz - 0.26, Math.PI); M.place(PF.opLocker(2, 0.45, 1.8), -15.95, 0, iz - 0.26, Math.PI); // (clear of the board)
  M.place(PF.opClock(), -16.5, 2.32, iz, Math.PI, { nocol: true }); // (on the wall panel, clear of the steel post)
  // the building's ochre band (0.9 m) round the pale walls, broken by the doors
  opOnFace(0, iz - 0.002, Math.PI, (MM) => opBandRun(MM, -ix1, -ix0, 0, true, 0.002));
  opOnFace(0, -iz + 0.002, 0, (MM) => opBandRun(MM, ix0, ix1, 0, true, 0.002));
  for (const [x, ry, k] of [[ix1 - 0.002, -H, 1], [ix0 + 0.002, H, -1]]) opOnFace(x, 0, ry, (MM) => { opBandRun(MM, -iz, -1.1, 0, true, 0.002); opBandRun(MM, 1.1, iz, 0, true, 0.002); });
  M.place(PF.opyCot(), -17.05, 0, -iz + 0.39, 0);
  opyBags(-14.7, -iz + 0.22, 1.3, 0, 3, 31);
  M.place(PF.opFirstAid(), -13.95, 1.62, -iz, 0, { nocol: true });
  M.place(PF.opyCooler(), ix1 - 0.22, 0, -2.05, -H);
  M.place(PF.opExtinguisher(), -13.82, 0.12, iz, Math.PI, { nocol: true });
  M.place(PF.opyCrate(0.6, 0.4, 0.4), -15.75, 0, -iz + 0.23, 0.05); M.place(PF.opyCrate(0.6, 0.4, 0.4), -15.72, 0.4, -iz + 0.25, -0.1);
  M.place(PF.opBin(), -14.1, 0, iz - 0.85, 0, { nocol: true });
  // the board on the north wall in the west corner (clear of the door leaves): the field map and pinned notes
  M.save().color(OPTC.frame).local(1); M.boxB('opWood', -18.38, -17.38, 0.95, 2.1, iz - 0.02, iz); M.color([0.5, 0.38, 0.26]); M.boxB('opWood', -18.33, -17.43, 1.0, 2.05, iz - 0.024, iz - 0.02); M.restore();
  opyAt(-17.88, 1.08, iz - 0.024, Math.PI, (M) => {
    M.save().color([1, 1, 1]); M.cls = 1; opyDecal(M, OPY_ATL.map, -0.1, 0.0, 0.62, 0.62, 0.003);
    const R = rngOf(77); for (const [x, y, w, h] of [[0.33, 0.45, 0.16, 0.24], [0.33, 0.08, 0.15, 0.22], [-0.05, 0.7, 0.2, 0.15]]) { M.color(R() < 0.5 ? [0.92, 0.91, 0.85] : [0.93, 0.88, 0.62]); M.boxB('paintwood', x - w / 2, x + w / 2, y, y + h, 0.002, 0.004); M.color([0.75, 0.1, 0.1]); M.boxB('plastic', x - 0.01, x + 0.01, y + h - 0.03, y + h - 0.01, 0.004, 0.012); }
    M.restore();
  });

  // ---- deck (roof of the guard room): steel deck plate; the porch over the yard door (grating, narrow); railings
  M.save().color([0.4, 0.4, 0.39]).local(1); M.boxB('opSteel', T.x0, T.x1, gh, T.deck, -T.z, T.z); M.restore();
  DECOR.col(T.x0, T.x1, gh, T.deck, -T.z, T.z, 'metal');
  opyGrate(T.porch[0], T.porch[1], -T.end, T.end, T.deck);
  DECOR.col(T.porch[0], T.porch[1], T.deck - 0.12, T.deck, -T.end, T.end, 'metal');
  M.save().color(OPTC.steel).local(1); M.boxB('opPaint', T.porch[1] - 0.12, T.porch[1], T.deck - 0.3, T.deck - 0.02, -T.end, T.end); for (const sz of [-1, 1]) M.boxB('opPaint', T.porch[0], T.porch[1], T.deck - 0.3, T.deck - 0.02, sz * T.end - 0.06, sz * T.end + 0.06); M.restore();
  for (const sz of [-1, 1]) opyPipe(sz * T.z, T.x0 + lg, T.x1, 'x', T.deck);
  opyPipe(T.x0 - 0.04, -T.z + lg, T.z - lg, 'z', T.deck);
  opyPipe(T.porch[1] - 0.04, -T.end, T.end, 'z', T.deck);
  for (const sz of [-1, 1]) opyPipe(sz * (T.end - 0.04), T.porch[0], T.porch[1], 'x', T.deck);
  M.place(PF.opyCrate(1.2, 0.6, 0.8), -16.1, T.deck, -1.7, 0.05); // ammo on the deck

  // ---- switchback stairs (north: s = 1, south: s = -1): lower flight on the inner lane, rising east from the back to the porch; upper
  // flight on the outer lane, rising west from the porch to the balcony; open stringers on posts, handrails both sides
  for (const s of [1, -1]) {
    const [i0, i1] = [s * T.inner[0], s * T.inner[1]].sort((a, b) => a - b), [o0, o1] = [s * T.outer[0], s * T.outer[1]].sort((a, b) => a - b);
    opyFlight(T.low[0], T.low[1], i0, i1, 0, T.deck);
    opyFlight(T.up[0], T.up[1], o0, o1, T.cab, T.deck);
    const yLo = (x) => (T.deck * (x - T.low[0])) / (T.low[1] - T.low[0]), yUp = (x) => T.cab + ((T.deck - T.cab) * (x - T.up[0])) / (T.up[1] - T.up[0]);
    opyPipe(s * (T.inner[0] + 0.03), T.low[0], T.low[1], 'x', 0, T.deck); opyPipe(s * T.inner[1], T.low[0], T.low[1], 'x', 0, T.deck);
    opyPipe(s * T.inner[1], T.up[0], T.porch[0], 'x', T.cab, yUp(T.porch[0])); opyPipe(s * T.outer[1], T.up[0], T.up[1], 'x', T.cab, T.deck);
    // posts under the stringers, the concrete pad at the foot
    M.save().color(OPTC.steel).local(1);
    for (const x of [-16.6, -14.6]) for (const z of [s * (T.inner[0] + 0.03), s * (T.inner[1] - 0.03)]) M.boxB('opSteel', x - 0.04, x + 0.04, 0, yLo(x) - 0.3, z - 0.04, z + 0.04);
    for (const z of [s * (T.outer[0] + 0.03), s * (T.outer[1] - 0.03)]) M.boxB('opSteel', -15.6 - 0.05, -15.6 + 0.05, 0, yUp(-15.6) - 0.3, z - 0.05, z + 0.05);
    M.color([0.6, 0.57, 0.53]); M.boxB('concrete', T.low[0] - 1.2, T.low[0] + 0.15, -0.05, 0.03, i0 - 0.1, i1 + 0.1, { bevel: 0.01 });
    M.restore();
    for (const z of [s * (T.outer[0] + 0.03), s * (T.outer[1] - 0.03)]) DECOR.col(-15.65, -15.55, 0, yUp(-15.6) - 0.3, z - 0.05, z + 0.05, 'metal');
    // under the low end of the lower flight (no headroom): collisions only, stepped under the slope
    const xe = -15.8, zp = s * T.inner[1];
    for (let x = T.low[0] + 0.55; x < xe; x += 0.55) DECOR.col(x, Math.min(xe, x + 0.55), 0, yLo(x) - 0.03, zp - 0.05, zp + 0.05, 'metal');
    DECOR.col(xe - 0.03, xe + 0.03, 0, yLo(xe) - 0.06, i0, i1, 'metal');
    // under the high end of the lower flight (2 to 3.3 m): crates stored in the nook
    opyAt(-14.75, 0, s * 3.3, 0, (M) => { M.place(PF.opyCrate(1.2, 0.6, 0.8), -0.6, 0, 0, 0, { nocol: true }); M.place(PF.opyCrate(0.6, 0.4, 0.4), 0.45, 0, 0.05, 0.1, { nocol: true }); });
    DECOR.col(-15.95, -14.05, 0, 0.6, s * 3.3 - 0.42, s * 3.3 + 0.42, 'wood');
  }

  // ---- cabin floor (6.6) with a 1 m deck round the 4 x 4 m cabin, the west balcony; the cabin: weathered boards, a 1 m parapet, open from
  // 1.0 to 2.0 m all round, a 0.15 m header, slim corner posts, one mid post per side, the doorway onto the balcony (west)
  const dk = 0.5; // (the deck round the cabin reaches 0.5 m past the legs: a walk all round the 4 m cabin)
  M.save().color(OPTC.floor).local(1); M.boxB('opyBoard', T.x0 - dk, T.x1 + dk, T.cab - 0.2, T.cab, -T.z - dk, T.z + dk); M.color(OPTC.steel); for (const sz of [-1, 1]) M.boxB('opSteel', T.x0 - dk, T.x1 + dk, T.cab - 0.34, T.cab - 0.2, sz * (T.z + dk) - 0.05, sz * (T.z + dk) + 0.05); M.boxB('opSteel', T.x1 + dk - 0.1, T.x1 + dk, T.cab - 0.34, T.cab - 0.2, -T.z - dk, T.z + dk);
  M.cls = 1; for (const [x, z] of legs) { opyAngle(M, [x, T.cab - 1.1, z], [x + Math.sign(x - cx) * dk * (x > cx ? 1 : 0), T.cab - 0.3, z + Math.sign(z) * dk], 0.07); }
  M.restore();
  DECOR.col(T.x0 - dk, T.x1 + dk, T.cab - 0.2, T.cab, -T.z - dk, T.z + dk, 'wood');
  // the west landing planked like the cabin's deck (it abuts it), a steel edge angle where the upper flights' grating arrives; an open dark
  // steel railing on its outer (west) edge
  const xb = T.x0 - dk;
  M.save().color(OPTC.floor).local(1);
  M.boxB('opyBoard', T.balc[0], xb, T.cab - 0.12, T.cab, -T.end, T.end);
  for (const sz of [-1, 1]) M.boxB('opyBoard', xb, T.balc[1], T.cab - 0.12, T.cab, Math.min(sz * (T.z + dk), sz * T.end), Math.max(sz * (T.z + dk), sz * T.end));
  M.color(OPTC.steel); for (const sz of [-1, 1]) M.boxB('opSteel', T.balc[1] - 0.05, T.balc[1] + 0.02, T.cab - 0.06, T.cab + 0.008, Math.min(sz * T.outer[0], sz * T.outer[1]), Math.max(sz * T.outer[0], sz * T.outer[1]));
  M.restore();
  DECOR.col(T.balc[0], T.balc[1], T.cab - 0.12, T.cab, -T.end, T.end, 'wood');
  M.save().color(OPTC.steel).local(1); M.boxB('opPaint', T.balc[0], T.balc[0] + 0.12, T.cab - 0.3, T.cab - 0.12, -T.end, T.end); for (const sz of [-1, 1]) M.boxB('opPaint', T.balc[0], T.balc[1], T.cab - 0.3, T.cab - 0.12, sz * T.end - 0.06, sz * T.end + 0.06); M.restore();
  // the soffit (the most-seen surface from the ground): dark planks with their joists every 0.6 m, under the cabin's deck and the landing
  M.save().color(OPTC.soffit).local(1); M.cls = 1;
  M.quad('opyBoard', [T.x0 - dk, T.cab - 0.206, -T.z - dk], [T.x1 + dk, T.cab - 0.206, -T.z - dk], [T.x1 + dk, T.cab - 0.206, T.z + dk], [T.x0 - dk, T.cab - 0.206, T.z + dk], [0, -1, 0]);
  M.quad('opyBoard', [T.balc[0], T.cab - 0.126, -T.end], [xb, T.cab - 0.126, -T.end], [xb, T.cab - 0.126, T.end], [T.balc[0], T.cab - 0.126, T.end], [0, -1, 0]);
  M.color(OPTC.soffit.map((v) => v * 0.8));
  for (let x = T.x0 - dk + 0.3; x < T.x1 + dk - 0.1; x += 0.6) M.boxB('opyBoard', x - 0.035, x + 0.035, T.cab - 0.34, T.cab - 0.206, -T.z - dk + 0.05, T.z + dk - 0.05, { skip: 'Y' });
  for (let x = T.balc[0] + 0.3; x < xb - 0.1; x += 0.6) M.boxB('opyBoard', x - 0.035, x + 0.035, T.cab - 0.27, T.cab - 0.126, -T.end + 0.06, T.end - 0.06, { skip: 'Y' });
  M.restore();
  const cw = (a0, a1) => ({ a0, a1, b0: 1.0, b1: 2.0 }), ch = T.eave - T.cab - 0.1, wo = { tint: OPTC.plank, frames: false, m: 'wood' }, pw = 0.075, wc = 0.12;
  // (the openings stop 2 cm inside the posts: their reveals hidden in the posts, no coplanar faces)
  const q = pw - 0.02;
  for (const sz of [-1, 1]) wallOpen('opyBoard', 'x', sz * cz, wc, c0 + q, c1 - q, T.cab, ch, [cw(c0 + q, cx - q), cw(cx + q, c1 - q)], wo);
  wallOpen('opyBoard', 'z', c1, wc, -cz + q, cz - q, T.cab, ch, [cw(-cz + q, -q), cw(q, cz - q)], wo);
  wallOpen('opyBoard', 'z', c0, wc, -cz + q, cz - q, T.cab, ch, [cw(-cz + q, -1.1 - q), { a0: -1.1 + q, a1: 1.1 - q, b0: 0, b1: 2.0 }, cw(1.1 + q, cz - q)], wo);
  // posts (sheet 4: slim, 0.15 m, the grain running up them): the corners, one in the middle of each side, the doorway's jambs
  M.save().color(OPTC.post).local(1);
  for (const x of [c0, c1]) for (const z of [-cz, cz]) M.boxB('timber', x - pw, x + pw, T.cab, T.eave - 0.1, z - pw, z + pw); // (under the roof sheet)
  for (const sz of [-1, 1]) M.boxB('timber', cx - pw, cx + pw, T.cab + 0.99, T.cab + 2.01, sz * cz - 0.07, sz * cz + 0.07);
  M.boxB('timber', c1 - 0.07, c1 + 0.07, T.cab + 0.99, T.cab + 2.01, -pw, pw);
  for (const z of [-1.1, 1.1]) M.boxB('timber', c0 - 0.07, c0 + 0.07, T.cab, T.cab + 2.01, z - pw, z + pw);
  M.restore(); M.save().color(OPTC.frame).local(1);
  for (const sz of [-1, 1]) M.boxB('opyBoard', c0 + pw, c1 - pw, T.cab + 0.97, T.cab + 1.02, sz * cz - wc / 2 - 0.04, sz * cz + wc / 2 + 0.04);
  M.boxB('opyBoard', c1 - wc / 2 - 0.04, c1 + wc / 2 + 0.04, T.cab + 0.97, T.cab + 1.02, -cz + pw, cz - pw);
  M.restore();
  // railings: the ledge (north, south, east), the balcony's west edge and ends, and the drops beside the frame toward the flights
  for (const sz of [-1, 1]) opyPipe(sz * (T.z + dk), T.x0, T.x1 + dk, 'x', T.cab); // (on the very edge: the walk keeps its 1 m)
  opyPipe(T.x1 + dk, -T.z - dk, T.z + dk, 'z', T.cab);
  opyPipe(T.balc[0] + 0.04, -T.end, T.end, 'z', T.cab);
  for (const sz of [-1, 1]) { opyPipe(sz * (T.end - 0.04), T.balc[0], T.balc[1], 'x', T.cab); const [a, b] = [sz * (T.z + dk), sz * T.outer[0]].sort((p, q) => p - q); opyPipe(T.balc[1] - 0.04, a, b, 'z', T.cab); }
  // roof: 30 degree pyramid of corrugated sheet (dark grey-brown, rust streaks in the sheet), 0.5 m overhang, thin fascia; wall plates, a
  // tie beam, hip and common rafters under the sheet's dark ribbed underside
  const ov = 0.5, slope = Math.tan(Math.PI / 6), half = cz + ov, ry0 = T.eave - ov * slope, apex = [cx, T.eave + cz * slope, 0];
  const rx0 = cx - half, rx1 = cx + half, rz = half;
  M.save().color(OPTC.roof).local(1);
  for (const [p, q] of [[[rx0, ry0, -rz], [rx1, ry0, -rz]], [[rx1, ry0, rz], [rx0, ry0, rz]], [[rx1, ry0, -rz], [rx1, ry0, rz]], [[rx0, ry0, rz], [rx0, ry0, -rz]]]) {
    const ax = q[0] - p[0], ay = q[1] - p[1], az = q[2] - p[2], bx = apex[0] - p[0], by = apex[1] - p[1], bz = apex[2] - p[2];
    let n = [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx]; const l = hyp3(...n) * (n[1] < 0 ? -1 : 1); n = [n[0] / l, n[1] / l, n[2] / l];
    M.color(OPTC.roof); M.tri3('opyRoofT', p, q, apex, n);
    M.color(OPTC.under); M.tri3('opyRoofT', [p[0], p[1] - 0.03, p[2]], [apex[0], apex[1] - 0.04, apex[2]], [q[0], q[1] - 0.03, q[2]], [-n[0], -n[1], -n[2]]);
    M.color([0.2, 0.19, 0.18]); M.tube('opPaint', 0.035, [[p[0], p[1] + 0.015, p[2]], [apex[0], apex[1] + 0.02, apex[2]]], 4); // hip cap
  }
  M.color([0.2, 0.19, 0.18]); for (const [a, b, c, d] of [[rx0, rx1, -rz - 0.02, -rz], [rx0, rx1, rz, rz + 0.02], [rx0 - 0.02, rx0, -rz, rz], [rx1, rx1 + 0.02, -rz, rz]]) M.boxB('opPaint', a, b, ry0 - 0.07, ry0 + 0.01, c, d);
  M.color(OPTC.frame);
  for (const sz of [-1, 1]) M.boxB('opyBoard', c0 - pw, c1 + pw, T.eave - 0.1, T.eave - 0.068, sz * cz - 0.08, sz * cz + 0.08); // (wall plates on the walls, under the sheet)
  for (const x of [c0, c1]) M.boxB('opyBoard', x - 0.08, x + 0.08, T.eave - 0.1, T.eave - 0.068, -cz, cz);
  M.boxB('opyBoard', c0, c1, T.eave - 0.16, T.eave - 0.04, -0.05, 0.05);
  for (const [x, z] of [[rx0, -rz], [rx1, -rz], [rx0, rz], [rx1, rz]]) M.tube('opyBoard', 0.05, [[x + Math.sign(cx - x) * 0.05, ry0 - 0.05, z + Math.sign(-z) * 0.05], [apex[0], apex[1] - 0.12, apex[2]]], 4);
  for (const f of [-0.5, 0.5]) for (const sz of [-1, 1]) { M.tube('opyBoard', 0.04, [[cx + f * cz * 2 * 0.5, ry0 - 0.04, sz * (rz - 0.05)], [cx + f * cz * 0.5, apex[1] - 0.12 - cz * 0.5 * slope, sz * cz * 0.5]], 4); M.tube('opyBoard', 0.04, [[sz * (rz - 0.05) * 0 + (sz > 0 ? rx1 - 0.05 : rx0 + 0.05), ry0 - 0.04, f * cz], [cx + sz * cz * 0.5, apex[1] - 0.12 - cz * 0.5 * slope, f * cz * 0.5]], 4); }
  M.color([0.17, 0.16, 0.15]); M.save().move(apex[0], apex[1] - 0.04, apex[2]); M.cyl('opPaint', 0.2, 0.3, 8, { r1: 0.03 }); M.restore(); // the apex cap
  M.restore();
  DECOR.col(rx0, rx1, ry0, ry0 + 0.4, -rz, rz, 'metal'); DECOR.col(cx - 1.6, cx + 1.6, ry0 + 0.4, apex[1], -1.6, 1.6, 'metal');
  // lamp under the eave over the yard (sheet 4), and the cabin's own on the tie beam
  M.place(PF.opWallLamp(), c1 + wc / 2 + 0.01, T.eave - 0.32, 0, H, { nocol: true });
  M.lamp(c1 + 0.4, T.eave - 0.6, 0, [1.0, 0.85, 0.6], 0.8, 7, 0.9);
  M.place(PF.opCeilLight(1.2), cx, T.eave - 0.16, 0, 0, { nocol: true });
  M.lamp(cx, T.eave - 0.45, 0, [1.0, 0.86, 0.66], 0.9, 4.5, 0.6);
  // cabin furniture: searchlight on the parapet's north-east corner facing out, desk with the field telephone and the radio on the south
  // wall, map table in the north-west corner, chair, ammo box, binoculars on the north sill
  const ix = c1 - wc / 2, jz = cz - wc / 2;
  M.place(PF.opySearchlight(0.18), c1 - 0.02, T.cab + 1.02, cz - 0.02, Math.PI / 4, { nocol: true }); // (on the parapet's corner, facing out)
  M.place(PF.opyTable(1.0, 0.6), ix - 0.62, T.cab, -jz + 0.32, 0);
  M.place(PF.opyPhone(), ix - 0.35, T.cab + 0.75, -jz + 0.3, 0.3);
  M.place(PF.opyRadio(), ix - 0.85, T.cab + 0.75, -jz + 0.3, -0.08);
  M.place(PF.opyTable(1.0, 0.6), c0 + 0.7, T.cab, jz - 0.32, 0);
  opyAt(c0 + 0.7, T.cab + 0.758, jz - 0.32, 0.1, (M) => { M.save().color([1, 1, 1]).local(1); M.cls = 1; const B = M.buf('opyAtlas', 0, 0, 0), a = M.v(B, -0.25, 0, 0.2, 0, 1, 0, 0, 0.5), b = M.v(B, 0.25, 0, 0.2, 0, 1, 0, 0.5, 0.5), c = M.v(B, 0.25, 0, -0.2, 0, 1, 0, 0.5, 0), d = M.v(B, -0.25, 0, -0.2, 0, 1, 0, 0, 0); M.quadI(B, a, b, c, d); M.restore(); });
  M.place(PF.opyChair(), cx, T.cab, -0.6, Math.PI * 0.55, { tint: OPY.oliveDk });
  M.place(PF.opyBinoculars(), -15.0, T.cab + 1.02, cz, 0.3);
}

/* ---------- Utility shed ---------- */
/* Footprint, eaves and ridge, doors (x range, on both gables) */
const OP_SHED = { x0: 14.0, x1: 20.0, z: 3.5, eave: 2.6, ridge: 3.9, door: [15.7, 18.3] };
/* Colors: the one corrugated olive (walls and door leaves, as the booth and the guard room), neutral galvanized roof and its dark grey
   underside, dark olive trims */
const OPSH = { wall: OPY.clad, roof: [0.55, 0.55, 0.55], under: [0.3, 0.3, 0.3], trim: [0.23, 0.26, 0.17], door: OPY.clad.map((v) => v * 0.94) };
function opyShed() {
  const M = DECOR, S = OP_SHED, t = 0.1, xc = (S.x0 + S.x1) / 2, fl = 0.12, wo = { tint: OPSH.wall, frames: false, m: 'metal' }, h = S.eave - fl, lw = (S.door[1] - S.door[0]) / 2 - 0.02;
  // concrete slab (a step of 12 cm)
  box('concrete', S.x0 - 0.15, S.x1 + 0.15, 0, fl, -S.z - 0.15, S.z + 0.15, { tint: OPY.concrete });
  // walls: corrugated sheet on a steel frame; windows on the long sides, double doors on the gables
  const wW = [{ a0: -0.8, a1: 0.8, b0: 0.95, b1: 1.6 }], wE = [{ a0: 0.8, a1: 2.1, b0: 1.05, b1: 1.65 }, { a0: -2.1, a1: -0.8, b0: 1.05, b1: 1.65 }];
  wallOpen('opyCorrM', 'z', S.x0 + t / 2, t, -S.z, S.z, fl, h, wW, wo);
  wallOpen('opyCorrM', 'z', S.x1 - t / 2, t, -S.z, S.z, fl, h, wE, wo);
  for (const sz of [-1, 1]) wallOpen('opyCorrM', 'x', sz * (S.z - t / 2), t, S.x0 + t, S.x1 - t, fl, h, [{ a0: S.door[0], a1: S.door[1], b0: 0, b1: 2.3 }], wo);
  // corner trims, window frames (with their glass: windows stop soldiers, not shots), gable triangles with a louvered vent, door frames,
  // the leaves swung open flat against the gable (outside)
  M.save().color(OPSH.trim).local(1);
  for (const x of [S.x0, S.x1]) for (const sz of [-1, 1]) M.boxB('opPaint', x - 0.07, x + 0.07, fl, S.eave, sz * S.z - 0.07, sz * S.z + 0.07);
  const wins = [[S.x0, wW[0]], [S.x1, wE[0]], [S.x1, wE[1]]];
  for (const [x, w] of wins) { const y0 = fl + w.b0, y1 = fl + w.b1; for (const z of [w.a0, w.a1]) M.boxB('opPaint', x - 0.08, x + 0.08, y0 - 0.04, y1 + 0.04, z - 0.04, z + 0.04); for (const y of [y0, y1]) M.boxB('opPaint', x - 0.08, x + 0.08, y - 0.04, y + 0.04, w.a0 - 0.04, w.a1 + 0.04); M.boxB('opPaint', x - 0.04, x + 0.04, y0, y1, (w.a0 + w.a1) / 2 - 0.02, (w.a0 + w.a1) / 2 + 0.02); }
  M.restore();
  for (const [xw, w] of wins) {
    const x = xw === S.x0 ? S.x0 + t / 2 : S.x1 - t / 2, y0 = fl + w.b0, y1 = fl + w.b1;
    M.save().color(OPC.glass); M.cls = 1;
    for (const o of [1, -1]) M.quad(o * (x - xc) > 0 ? 'opGlass' : 'opGlassIn', [x + o * 0.005, y0, o > 0 ? w.a1 : w.a0], [x + o * 0.005, y0, o > 0 ? w.a0 : w.a1], [x + o * 0.005, y1, o > 0 ? w.a0 : w.a1], [x + o * 0.005, y1, o > 0 ? w.a1 : w.a0], [o, 0, 0]);
    M.restore(); glassWall(x - 0.02, x + 0.02, y0, y1, w.a0, w.a1);
  }
  M.save().color(OPSH.wall).local(1);
  for (const sz of [-1, 1]) {
    const z = sz * S.z;
    for (const dz of [0.005, -t - 0.005]) M.tri3('opyCorrM', [S.x0, S.eave, z + sz * dz], [S.x1, S.eave, z + sz * dz], [xc, S.ridge, z + sz * dz], [0, 0, sz * Math.sign(dz + 0.01)]);
    M.color([0.2, 0.2, 0.2]); M.boxB('dark', xc - 0.35, xc + 0.35, S.eave + 0.3, S.eave + 0.7, z - 0.02, z + 0.02); M.color(OPSH.trim);
    for (let k = 0; k < 4; k++) M.boxB('opPaint', xc - 0.37, xc + 0.37, S.eave + 0.32 + k * 0.1, S.eave + 0.37 + k * 0.1, z + sz * 0.02, z + sz * 0.06);
    for (const x of S.door) M.boxB('opPaint', x - 0.06, x + 0.06, fl, fl + 2.36, z - 0.08, z + 0.08);
    M.boxB('opPaint', S.door[0] - 0.06, S.door[1] + 0.06, fl + 2.29, fl + 2.42, z - 0.08, z + 0.08);
    for (const [hx, dir] of [[S.door[0], -1], [S.door[1], 1]]) {
      M.color(OPSH.door); M.boxB('opyCorrM', Math.min(hx, hx + dir * lw), Math.max(hx, hx + dir * lw), fl + 0.02, fl + 2.26, Math.min(z + sz * 0.08, z + sz * 0.13), Math.max(z + sz * 0.08, z + sz * 0.13));
      M.color(OPSH.trim); for (const y of [fl + 0.1, fl + 1.1, fl + 2.14]) M.boxB('opPaint', Math.min(hx, hx + dir * lw), Math.max(hx, hx + dir * lw), y, y + 0.06, Math.min(z + sz * 0.13, z + sz * 0.15), Math.max(z + sz * 0.13, z + sz * 0.15));
      M.color([0.25, 0.25, 0.24]); M.boxB('steel', hx + dir * (lw - 0.18) - 0.02, hx + dir * (lw - 0.18) + 0.02, 1.0, 1.25, Math.min(z + sz * 0.13, z + sz * 0.17), Math.max(z + sz * 0.13, z + sz * 0.17)); M.color(OPSH.trim);
    }
    M.color(OPSH.wall);
  }
  M.restore();
  for (const sz of [-1, 1]) { const za = Math.min(sz * S.z, sz * (S.z + 0.17)), zb = Math.max(sz * S.z, sz * (S.z + 0.17)); /* (from the wall: no slit behind the leaf) */ DECOR.col(S.door[0] - lw, S.door[0], fl, fl + 2.26, za, zb, 'metal'); DECOR.col(S.door[1], S.door[1] + lw, fl, fl + 2.26, za, zb, 'metal'); }
  // gable roof (cool grey galvanized, ribs down the slopes, rust and dirt in the sheet), barge boards, ridge cap, gable collision, trusses,
  // lamps
  const ov = 0.3, rz = S.z + 0.3, slope = (S.ridge - S.eave) / (xc - S.x0);
  M.save().color(OPSH.roof).local(1);
  for (const sd of [-1, 1]) {
    const xe = sd < 0 ? S.x0 - ov : S.x1 + ov, ye = S.eave - ov * slope, L = hyp(Math.abs(xc - xe), S.ridge - ye), n = [sd * slope, 1, 0], l = hyp3(...n);
    // (the ribs 0.2 m apart: the sheet's 16 ribs a tile spread over 3.2 m; the underside its own neutral dark grey)
    for (const [y0, nn] of [[0, 1], [-0.05, -1]]) { M.color(nn > 0 ? OPSH.roof : OPSH.under); M.quad(nn > 0 ? 'opyRoofS' : 'opyCorrM', [xe, ye + y0, -rz], [xe, ye + y0, rz], [xc, S.ridge + y0, rz], [xc, S.ridge + y0, -rz], [nn * n[0] / l, nn * n[1] / l, 0], { uv: [[-rz * 0.625, 0], [rz * 0.625, 0], [rz * 0.625, L], [-rz * 0.625, L]] }); }
    M.save().color(OPSH.trim); for (const sz of [-1, 1]) M.tube('opPaint', 0.05, [[xe, ye - 0.02, sz * (rz + 0.02)], [xc, S.ridge - 0.02, sz * (rz + 0.02)]], 4); M.boxB('opPaint', Math.min(xe, xe + sd * 0.06), Math.max(xe, xe + sd * 0.06), ye - 0.12, ye, -rz, rz); M.restore();
  }
  M.color([0.5, 0.51, 0.54]); M.save().move(xc, S.ridge - 0.02, -rz); M.extrude('steel', [[0.22, -0.05], [0, 0.05], [-0.22, -0.05]], 2 * rz, { closed: false }); M.restore(); // ridge cap, along z
  M.color([0.36, 0.37, 0.36]); M.cls = 1;
  for (const z of [-1.8, 0, 1.8]) { M.tube('steel', 0.04, [[S.x0 + 0.1, S.eave - 0.05, z], [xc, S.ridge - 0.12, z], [S.x1 - 0.1, S.eave - 0.05, z]], 5); M.tube('steel', 0.035, [[S.x0 + 0.1, S.eave - 0.1, z], [S.x1 - 0.1, S.eave - 0.1, z]], 5); M.tube('steel', 0.02, [[xc, S.eave - 0.1, z], [xc, S.ridge - 0.15, z]], 4); }
  M.restore();
  for (const [y0, y1, a] of [[S.eave - 0.05, S.eave + 0.35, 0], [S.eave + 0.35, S.eave + 0.75, 1.3], [S.eave + 0.75, S.ridge, 2.4]]) DECOR.col(S.x0 - ov + a, S.x1 + ov - a, y0, y1, -rz, rz, 'metal');
  for (const z of [-1.8, 1.8]) M.place(PF.opCeilLight(1.2), xc, S.eave - 0.12, z, Math.PI / 2, { nocol: true });
  for (const z of [-1.8, 1.8]) M.lamp(xc, S.eave - 0.3, z, [0.95, 0.95, 1.0], 1.2, 6, 0.7);
  // a wall lamp over each door (in the gable), the high-voltage sign by the north door, flammable sign by the south door (west wall)
  for (const sz of [-1, 1]) M.place(PF.opWallLamp(), xc, S.eave + 0.08, sz * (S.z + 0.01), sz > 0 ? 0 : Math.PI, { nocol: true });
  for (const sz of [-1, 1]) opyAt(S.x0 - 0.01, fl + 1.3, sz * 2.4, -Math.PI / 2, (M) => opyDecal(M, sz > 0 ? OPY_ATL.volt : OPY_ATL.fire, 0, 0, 0.4, 0.4));
  // floor stains
  M.save().color([0.3, 0.3, 0.28]).local(1); M.cls = 1; M.boxB('dark', 18.6, 19.7, fl, fl + 0.004, 0.4, 2.6); M.restore();
  // ---- interior: rack in the middle (cuts the line of fire from door to door), generator and fuel drums (east), shelving and workbench (west)
  M.place(PF.opyShelf(2.0, 1.9, 5, true), xc, fl, 0, 0);
  M.place(PF.generator(), S.x1 - t - 0.6, fl, 1.6, Math.PI / 2, { tint: OPY.olive });
  M.save().color([0.12, 0.12, 0.12]).local(1); M.cls = 1; M.tube('rubber', 0.025, [[S.x1 - 0.7, fl + 0.6, 0.7], [S.x1 - 0.8, fl + 0.02, 0.3], [xc + 0.5, fl + 0.02, 0.0], [xc + 0.9, fl + 0.02, -2.6], [S.x0 + 0.25, fl + 0.05, -3.1], [S.x0 + 0.13, fl + 2.3, -3.15]], 4); M.restore(); // (along the floor, then up the wall)
  M.save().color([0.3, 0.3, 0.3]).local(1); M.tube('steel', 0.05, [[S.x1 - 0.65, fl + 1.4, 1.1], [S.x1 - 0.65, fl + 1.8, 1.1], [S.x1 + 0.2, fl + 1.8, 1.1], [S.x1 + 0.2, S.eave + 0.6, 1.1]], 6); M.restore(); // exhaust through the wall
  opyDrums(18.6, 2.8, 2, 51, OPY.olive, fl);
  opyDrums(18.6, -2.8, 2, 52, undefined, fl);
  for (const [x, z, r] of [[18.25, -2.1, 0.3], [18.2, -1.6, -0.2]]) M.place(PF.jerrycan(), x, fl, z, r, { tint: OPY.olive });
  M.place(PF.opyShelf(2.2, 1.9, 6), S.x0 + t + 0.28, fl, 2.0, Math.PI / 2);
  M.place(PF.opyWorkbench(), S.x0 + t + 0.42, fl, -1.9, Math.PI / 2);
  M.place(PF.opExtinguisher(), S.x0 + t, fl + 0.25, 0.6, Math.PI / 2, { nocol: true });
}
