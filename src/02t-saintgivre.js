/* ==========================================================================
   SAINT-GIVRE: border station of a mountain pass, cut off from the world by avalanches. 48 x 96 m, very elongated,
   mirrored north-south (team Alpha in the south, +z; Bravo in the north, -z). Tighter than Chergui: three narrow
   routes, many rooms and covers, clear sight lines but cut at mid-map.
   WEST "Voies"       : two tracks along the cliff, stopped railcars (cover, tank car, logs); in the center the
                       Galerie pare-avalanche where the rotary snowplow sleeps. The Poste d'aiguillage (upper floor, large
                       windows) watches over the tracks on each side; at its foot, the border post yard (A, C), which the
                       customs office separates from the base. The Quai runs along the Gare under its canopy.
   CENTER "Grand-Rue" : snowy street that dead-ends at the Gare; you cross the center through the hall (north and south doors,
                       two on the platform, ticket window in the middle, two low windows onto the yard) or you swing around through the Halle
                       aux marchandises, the Hôtel des Cimes or the alleys.
   EAST "Village"     : chalet alleys, Placette and its lit fir tree, Grange à fenil (raised post), Scierie
                       open in the center (logs, saw carriage), linked to the Grand-Rue by the Cour de la gare (B, between two plank stacks).
   The draws are reproducible (fixed seed): each peer of a lobby builds the same map.
   ========================================================================== */
const ATMO_SAINTGIVRE = Object.assign({}, ATMO_DEFAULT, {
  // blizzard at dusk (blizzard workshop, November 2026; until then a clear snow night under the moon): the sun has just set behind the
  // western mountains (3.5° up, hidden by the cliff: almost no direct light), its last glow a dull pink-orange low in the west, over the
  // cliff and in the haze toward it (fogSun); cold grey overcast above (computed sky, no photo). Heavy snow driven by a west wind (map `vent`,
  // streaks: 02i-winter.js), dense blue-grey fog that thins with height (about half a soldier's contrast left at 40 m, nothing beyond 80 m),
  // street lamps, garlands and two windows out of three lit. Ambient light and floor high enough to see a soldier in the shadow
  sun: [-0.92, 0.06, 0.22], sunColor: 0xff9a7a, sunI: 0.5, vmSun: 0xc0a0a0,
  fog: [0.18, 0.2, 0.26], fogD: 0.017, fogH: [60, 0], fogSun: 0.6,
  hemi: [0x8090b0, 0x9098a8, 0.6], vmHemi: [0x8090b0, 0x9098a8],
  sky: {
    zen: [0.05, 0.06, 0.08], mid: [0.11, 0.12, 0.15], hor: [0.34, 0.22, 0.2], gnd: [0.1, 0.1, 0.12],
    glow: [0.6, 0.28, 0.14], halo: [0.4, 0.2, 0.12], disk: [0, 0, 0], cloudLo: [0.09, 0.1, 0.12], cloudHi: [0.2, 0.18, 0.2], cloud: [0.25, 0.55, 0.95],
    ridge: [0.075, 0.07, 0.75], ridgeSnow: [0.22, 0.22, 0.26], ridgeRock: [0.08, 0.08, 0.1],
  },
  envGround: 0x3a4050, hdri: null, lit: true, lamps: 2.0, winLit: 0.65,
  bounce: [0.12, 0.12, 0.15], dust: [0.9, 0.92, 0.95], motes: null,
  grade: { lo: [0.9, 0.97, 1.1], hi: [1.06, 1.0, 0.94], exp: 1.12, con: 1.0, sat: 0.9, lift: 0.07 }, rays: [0.4, 0.3, 0.3],
  impact: [0.88, 0.9, 0.94], snow: { top: 1, foot: 0.85, color: [0.88, 0.9, 0.95] }, snowfall: 3.0, snowCol: [0.82, 0.85, 0.92], wind: [520, 0.105],
  bloom: [0.6, 0.6, 0.85], aoFloor: 0.42, raysThr: 2.5, raysCap: 1, satExp: 0.55,
});
const GROUND_SAINTGIVRE = { base: 'snow', l1: 'snowpack', l2: 'cobble', l3: 'asphalt', pom: [0, 0, 0.035, 0], dirt: [0.6, 0.58, 0.55], mul: 0, env: 0.45 };
const GV = { tracks: [-19.6, -15.0], bed: [-22.4, -12.9], quay: [-12.3, -9.0] };

/* ---------- Railcars (collisions: body, chassis and bogies; you can see and shoot under the body between the bogies) ---------- */
/* Railcar collision shapes (railcar frame, heights above the ballast): up to 2.32, one solid box per railcar, whose empty corners
   stopped shots (round tank, log pile) and under the top of the covered railcar's curved roof, which shots passed through */
const GV_SHAPES = {
  boxcar: [[-1.43, 1.43, 0.95, 3.72, -6.1, 6.1], [-1.48, 1.48, 3.72, 3.86, -6.16, 6.16], [-0.95, 0.95, 3.86, 4.04, -6.16, 6.16]],
  tankcar: [[-1.35, 1.35, 0.95, 1.2, -5.1, 5.1], [-0.95, 0.95, 1.2, 1.62, -4.65, 4.65], [-1.32, 1.32, 1.62, 3.48, -4.65, 4.65], [-0.95, 0.95, 3.48, 3.87, -4.65, 4.65],
    [-0.95, 0.95, 1.62, 3.48, -5.0, -4.65], [-0.95, 0.95, 1.62, 3.48, 4.65, 5.0], [-0.48, 0.48, 3.82, 4.35, -0.48, 0.48]],
  flatcar: [[-1.35, 1.35, 0.95, 1.25, -6.0, 6.0], [-1.3, 1.3, 1.25, 1.89, -5.45, 5.45], [-0.92, 0.92, 1.89, 2.4, -5.45, 5.45], [-0.57, 0.57, 2.4, 2.85, -5.45, 5.45]],
};
function gvWagon(pf, x, zc, rot, tint, b) {
  DECOR.place(pf, x, RAIL.bed, zc, rot, { tint, nocol: true });
  const y = RAIL.bed;
  // b.shape: shape of the railcar in boxes [x0, x1, y0, y1, z0, z1] (curved roof, round tank, log pile), otherwise a solid box
  if (b.shape) colShape(x, y, zc, rot || 0, b.shape);
  else WORLD.col({ x0: x - b.hw, x1: x + b.hw, y0: y + b.y0, y1: y + b.y1, z0: zc - b.hl, z1: zc + b.hl }, 'metal');
  for (const bz of b.bogies || []) WORLD.col({ x0: x - 1.1, x1: x + 1.1, y0: y, y1: y + 0.85, z0: zc + bz - 1.35, z1: zc + bz + 1.35 }, 'metal');
}

/* Stone base (x0..x1, height h) along a wall from zA to zB, interrupted by the doors (gaps: sorted [z0, z1]):
   never a ledge across an entrance, where you walk without meeting anything */
function gvPlinth(x0, x1, h, zA, zB, gaps) {
  let cur = zA;
  for (const [g0, g1] of gaps.slice().sort((p, q) => p[0] - q[0])) { if (g0 - cur > 0.02) DECOR.boxB('stone', x0, x1, 0, h, cur, g0); cur = g1; }
  if (zB - cur > 0.02) DECOR.boxB('stone', x0, x1, 0, h, cur, zB);
}

/* ---------- Plan ---------- */
function saintgivreLevel() {
  SR.rng = rngOf(1847); // accessories shared with Chergui (sandbags...): same draws for everyone
  saintgivreRail();
  saintgivreStation();
  for (const s of [1, -1]) saintgivreHalf(s);
  saintgivreCenter();
  saintgivrePerimeter();
  saintgivreBackdrop();
  saintgivreGround(); // after the buildings: drifts at the foot of the walls
}

/* ---------- Voies, Galerie pare-avalanche, platform, canopy ---------- */
function saintgivreRail() {
  const [xa, xb] = GV.tracks;
  trackBed(GV.bed[0], GV.bed[1], -58, 58);
  railTrack(xa, -62, 62); railTrack(xb, -62, 62);
  // Galerie: slab on pillars on the platform side, backed against the cliff; dark back, caged lamps, frozen seepage
  const T = [0.76, 0.77, 0.79];
  box('concrete', -24, -12.2, 5.4, 6.15, -9.6, 9.6, { tint: T, bevel: 0.03 });
  box('concrete', -12.95, -12.2, 4.55, 5.4, -9.6, 9.6, { tint: T });
  for (const z of [-9.2, -4.6, 0, 4.6, 9.2]) {
    box('concrete', -12.95, -12.25, 0, 4.55, z - 0.4, z + 0.4, { tint: T, bevel: 0.02 });
    // gussets at the top of the pillars
    for (const s of [-1, 1]) if (Math.abs(z + s * 0.4) < 9.6) { DECOR.save().color(T).world(1).move(-12.95, 4.55, z + s * 0.4).mul(basis([0, 0, s], [0, 1, 0], [1, 0, 0]).clone()); DECOR.extrude('concrete', [[0, 0], [0, -0.7], [0.6, 0]], 0.7); DECOR.restore(); }
  }
  box('concrete', -24, -23.55, 0, 5.4, -9.6, 9.6, { tint: [0.7, 0.71, 0.73] });
  snowCap(-24.6, -12.0, -9.85, 9.85, 6.15, 0.6, 3);
  // seepage stalactites under the edge beam
  DECOR.save().color([1, 1, 1]); DECOR.cls = 2;
  const RI = rngOf(4549);
  for (let z = -9.3; z < 9.3; z += RI.range(0.13, 0.33)) { const L = 0.05 + Math.pow(RI(), 3) * 0.55; DECOR.save().move(RI.range(-12.8, -12.35), 4.55, z).rotX(Math.PI); DECOR.cyl('ice', 0.012 + L * 0.03, L, 5, { r1: 0.002, caps: '' }); DECOR.restore(); }
  DECOR.restore();
  for (const z of [-6.9, 0, 6.9]) {
    DECOR.save().local(1).color([0.25, 0.25, 0.24]); DECOR.boxB('steel', -23.55, -23.35, 3.95, 4.45, z - 0.18, z + 0.18); DECOR.cls = 1; DECOR.color([1, 1, 1]); DECOR.boxB('lamp', -23.38, -23.3, 4.0, 4.4, z - 0.12, z + 0.12); DECOR.restore();
  }
  DECOR.save().move(-23.551, 0, 0).rotY(Math.PI / 2); wallDecal2(DECOR, DEC2.avalanche, 3.6, 1.6, 1.1, 1.1); wallDecal2(DECOR, DEC2.soot, -2.5, 2.4, 3.0, 2.0); DECOR.restore();
  // rotary snowplow in the gallery (west track), pile of sleepers between the tracks, cabinets
  gvWagon(PF.snowplow(), xa, 0.35, 0, null, { hw: 1.5, y0: 0, y1: 4.0, hl: 6.8 });
  DECOR.place(PF.sleeperStack(5, 11), (xa + xb) / 2, RAIL.bed, 0, 0);
  // Quai: snowy paving, stone curb, safety line
  const [q0, q1] = GV.quay;
  box('pavers', q0, q1, 0, 0.4, -30, 30, { tint: [0.82, 0.82, 0.84], m: 'snow' });
  DECOR.save().color([0.86, 0.85, 0.83]).local(1);
  DECOR.boxB('ashlar', q0 - 0.06, q0 + 0.4, 0.3, 0.42, -30, 30, { bevel: 0.02 });
  DECOR.color([0.92, 0.9, 0.84]); DECOR.cls = 1; DECOR.boxB('paint', q0 + 0.62, q0 + 0.7, 0.4, 0.408, -30, 30); // 8 mm above the paving (2 mm flickered from afar)
  DECOR.restore();
  // Marquise: cast-iron columns, glass roof on trusses, cut wooden valance on the track side
  const mq = { y: 3.55, z: 14.5 };
  for (const z of [-13, -6.5, 0, 6.5, 13]) DECOR.place(PF.castColumn(mq.y), -11.55, 0.4, z, 0);
  WORLD.col({ x0: q0 + 0.1, x1: q1, y0: mq.y + 0.4, y1: mq.y + 0.62, z0: -mq.z, z1: mq.z }, 'metal');
  {
    const M = DECOR;
    M.save().color([0.14, 0.2, 0.17]).local(1);
    M.boxB('steel', q0 + 0.1, q1, mq.y + 0.4, mq.y + 0.52, -mq.z, mq.z);
    for (let z = -mq.z; z <= mq.z + 0.01; z += 1.45) M.boxB('steel', q0 + 0.1, q1, mq.y + 0.52, mq.y + 0.6, z - 0.04, z + 0.04);
    M.color([0.9, 0.95, 1]); M.cls = 1;
    M.boxB('glass', q0 + 0.12, q1 - 0.02, mq.y + 0.58, mq.y + 0.6, -mq.z, mq.z);
    // valance: pointed boards
    M.cls = 0; M.color([0.82, 0.78, 0.7]);
    for (let z = -mq.z + 0.06; z < mq.z; z += 0.13) { M.save().move(q0 + 0.08, mq.y + 0.52, z).mul(basis([0, 0, 1], [0, 1, 0], [1, 0, 0]).clone()); M.extrude('paintwood', [[-0.055, 0], [0.055, 0], [0.055, -0.42], [0, -0.52], [-0.055, -0.42]], 0.03); M.restore(); }
    M.restore();
    snowCap(q0 - 0.05, q1 + 0.05, -mq.z - 0.1, mq.z + 0.1, mq.y + 0.6, 0.18, 9);
    M.occ(q0, q1, mq.y + 0.3, mq.y + 0.6, -mq.z, mq.z, 0.9);
  }
  // in the center of the platform: luggage cart, trunks and mail sacks (cuts the sight line along the platform)
  DECOR.place(PF.luggageCart(), -10.7, 0.4, 0, 0.08);
  // trunks against the canopy column, track side (5 cm clearance from the column and the cart: they wrapped around it)
  crate(-12.0, 0.4, -0.75, 0.6, 0.04); crate(-12.0, 0.4, 0.75, 0.6, -0.04); crate(-12.0, 1.0, 0.72, 0.5, 0.3);
  WORLD.col({ x0: -11.4, x1: -10.0, y0: 0.4, y1: 1.6, z0: -1.1, z1: 1.1 }, 'wood');
  for (const s of [1, -1]) {
    // bench against the Halle aux marchandises, between the columns: 2.6 m from its door (z = 12), which it no longer brushes
    DECOR.place(PF.platformBench(), -9.55, 0.4, s * 8.4, -Math.PI / 2); WORLD.col({ x0: -9.9, x1: -9.0, y0: 0.4, y1: 0.9, z0: s * 8.4 - 1, z1: s * 8.4 + 1 }, 'wood');
    DECOR.save().move(-11.55, 0.4 + mq.y - 0.2, s * 6.5).rotY(Math.PI / 2); DECOR.put(PF.stationClock(), { cls: 1 }); DECOR.restore();
    for (const z of [21, 28.5]) DECOR.place(PF.lampPost(), -9.35, 0.4, s * z, -Math.PI); // on the platform paving (0.4 m), not inside it
    DECOR.place(PF.railSignal(), (xa + xb) / 2, RAIL.bed, s * 10.6, s > 0 ? 0 : Math.PI);
  }
}

/* ---------- Gare (center): through hall, plastered upper floor, slate roof, clocks, signs ---------- */
function saintgivreStation() {
  const X0 = -9, X1 = 5, Z0 = -7, Z1 = 7, t = 0.45, G = 4.4, H = 8.3, stone = [0.86, 0.86, 0.88], pl = [0.94, 0.9, 0.82], frame = [0.28, 0.22, 0.16];
  // ground floor: through walls (arched doors, tall windows)
  for (const s of [1, -1]) {
    wallOpen('ashlar', 'x', s * (Z1 - t / 2), t, X0, X1, 0, G, [
      { a0: 0.0, a1: 2.4, b0: 0, b1: 3.3, arch: 0.7 }, { a0: -2.3, a1: -1.2, b0: 2.2, b1: 3.8, arch: 0.4 }, { a0: 3.4, a1: 4.4, b0: 2.2, b1: 3.8, arch: 0.4 },
    ], { tint: stone, frameTint: frame });
  }
  wallOpen('ashlar', 'z', X0 + t / 2, t, Z0 + t, Z1 - t, 0, G, [
    { a0: -4.5, a1: -2.5, b0: 0, b1: 2.9, arch: 0.45 }, { a0: 2.5, a1: 4.5, b0: 0, b1: 2.9, arch: 0.45 }, { a0: -0.55, a1: 0.55, b0: 2.3, b1: 3.8, arch: 0.4 },
    { a0: -6.3, a1: -5.4, b0: 2.3, b1: 3.8, arch: 0.4 }, { a0: 5.4, a1: 6.3, b0: 2.3, b1: 3.8, arch: 0.4 },
  ], { tint: stone, frameTint: frame });
  // east facade (Cour de la gare): no more door since the map workshop (October 2026). The hall had five; it keeps four
  // (north and south on the axis of the Grand-Rue, two on the platform); the yard enters from the north or the south.
  // Blizzard workshop (November 2026): B moved to the yard, 3.4 m from this wall; the two middle windows come down to a 1 m sill
  // (they were 2.2 m up, out of sight): from the hall, between the lockers and the ticket window, you watch over B under cover
  wallOpen('ashlar', 'z', X1 - t / 2, t, Z0 + t, Z1 - t, 0, G, [
    { a0: -2.3, a1: -1.2, b0: 1.0, b1: 2.6, arch: 0.4 }, { a0: 1.2, a1: 2.3, b0: 1.0, b1: 2.6, arch: 0.4 }, { a0: -4.8, a1: -3.6, b0: 2.2, b1: 3.8, arch: 0.4 }, { a0: 3.6, a1: 4.8, b0: 2.2, b1: 3.8, arch: 0.4 },
  ], { tint: stone, frameTint: frame });
  // tile floor, joisted ceiling, upper floor slab
  box('tiles', X0 + t, X1 - t, 0, 0.03, Z0 + t, Z1 - t, { collide: false, ao: false, tint: [0.78, 0.8, 0.84] });
  box('plaster', X0 + 0.01, X1 - 0.01, G, G + 0.4, Z0 + 0.01, Z1 - 0.01, { tint: [0.94, 0.92, 0.88] }); // 1 cm behind the upper floor walls (in their plane, it flickered)
  ceilingJoists(X0 + t, X1 - t, Z0 + t, Z1 - t, G);
  // upper floor (solid): plastered facades with windows, stone band, corner quoins
  DECOR.col(X0, X1, G + 0.4, H, Z0, Z1, 'concrete');
  const R = rngOf(1847);
  for (const f of 'nsew') {
    const F = facadeFrame(f, X0, X1, Z0, Z1), len = F.len, n = Math.max(2, Math.round(len / 2.8)), ops = [];
    for (let i = 0; i < n; i++) { const a = (len * (i + 0.5)) / n; ops.push({ x0: a - 0.5, x1: a + 0.5, y0: G + 1.0, y1: G + 2.75, depth: 0.25, lit: R() < 0.45 }); }
    inFrame(F, (M) => {
      M.save().color(pl).world(1); M.aoFn = null;
      wallPierced(M, 'plaster', len, G, H - G, ops, { depth: 0.25 });
      M.restore();
      molding(M, 'ashlar', 0, len, G - 0.05, PROF.band, [0.84, 0.82, 0.8]);
      molding(M, 'ashlar', 0, len, H - 0.27, PROF.cornice, [0.86, 0.84, 0.8]);
      for (const op of ops) { windowJoinery(M, op, 0.25, [0.9, 0.88, 0.82], { glass: op.lit ? 'glassLit' : 'glass', curtain: R() < 0.5 ? [0.62, 0.2, 0.15] : null }); sill(M, op, 'ashlar', [0.86, 0.84, 0.8]); lintel(M, op, 'ashlar', [0.86, 0.84, 0.8]); if (f === 'n' || f === 's') shutters(M, op, [0.2, 0.34, 0.26], R() < 0.3 ? 'closed' : 'open', R); }
      for (const x of [0, len]) for (let y = 0.2, k = 0; y < H - 0.5; y += 0.45, k++) {
        const w = k % 2 ? 0.3 : 0.5;
        M.save().color([0.88, 0.87, 0.86]).world(1); lbox(M, 'ashlar', x === 0 ? 0 : len - w, x === 0 ? w : len, y, y + 0.41, 0, 0.04); M.restore();
      }
      // signs: SAINT-GIVRE on the gables and platform side, DOUANE on the yard side, BUFFET on the platform
      if (f === 'n' || f === 's') { sign2Board(M, len / 2, G + 2.8, 3.2, 0.8, SIGNS2.gare, [0.85, 0.83, 0.8]); } // under the cornice (8.03 m), not inside it
      if (f === 'w') { sign2Board(M, len / 2, 3.0, 3.6, 0.9, SIGNS2.gare, [0.12, 0.18, 0.15]); sign2Board(M, len / 2 + 4.6, 2.95, 2.6, 0.65, SIGNS2.buffet, null); sign2Board(M, len / 2 - 4.6, 2.95, 2.6, 0.65, SIGNS2.voies, null); wallDecal2(M, DEC2.departs, len / 2, 0.8, 1.3, 1.3, 0.012); }
      if (f === 'e') { sign2Board(M, len / 2, 3.3, 2.0, 0.55, SIGNS2.douane, [0.12, 0.18, 0.15]); }
      // posters in the middle of each ground-floor pillar (the arch is at x from 0 to 2.4: pillars from -9 to 0 and from 2.4 to 5); the south-side frame runs in the direction of x, the north one reversed
      if (f === 'n' || f === 's') { const u = (x) => (f === 's' ? x - X0 : X1 - x); wallDecal2(M, DEC2.poster, u(-4.5), 0.9, 0.9, 1.1); wallDecal2(M, DEC2.poster2, u(3.7), 0.95, 0.9, 1.1); }
    });
  }
  const roof = alpineRoof(X0, X1, Z0, Z1, H, { alongX: false, pitch: 0.62, mat: 'slate', tint: [0.62, 0.64, 0.7], chimney: true, gable: 'plaster', wood: pl, ovE: 0.7, ovG: 0.6, R });
  // gable clocks
  for (const s of [1, -1]) {
    const y = H + roof.rise * 0.38, z = s * (Z1 + 0.02);
    DECOR.save().move(-2, y, z).rotY(s > 0 ? 0 : Math.PI);
    DECOR.color([0.86, 0.84, 0.8]); DECOR.save().rotX(Math.PI / 2); DECOR.cyl('ashlar', 0.78, 0.12, 24); DECOR.restore();
    decal2Quad(DECOR, DEC2.clock, [-0.62, -0.62, 0.13], [0.62, -0.62, 0.13], [0.62, 0.62, 0.13], [-0.62, 0.62, 0.13], [0, 0, 1]);
    DECOR.restore();
  }
  // bell turret on the ridge: bell, louvers, pointed snowy roof, weathervane
  {
    const M = DECOR, yb = H + roof.rise + 0.05;
    M.save().move(-2, yb - 0.6, 0).color([0.9, 0.88, 0.84]).world(1);
    M.boxB('plaster', -0.8, 0.8, 0, 1.2, -0.8, 0.8);
    M.local(1); M.color([0.42, 0.32, 0.24]);
    for (const s of [-1, 1]) { M.boxB('wood', -0.72, 0.72, 1.2, 2.5, s * 0.72 - 0.06, s * 0.72 + 0.06); M.boxB('wood', s * 0.72 - 0.06, s * 0.72 + 0.06, 1.2, 2.5, -0.72, 0.72); }
    M.color([0.06, 0.06, 0.06]); M.boxB('dark', -0.6, 0.6, 1.3, 2.4, -0.6, 0.6);
    M.color([0.62, 0.48, 0.2]); M.save().move(0, 1.5, 0); M.lathe('steel', [[0, 0.75], [0.12, 0.72], [0.22, 0.5], [0.3, 0.12], [0.36, 0], [0, 0]], 12); M.restore();
    M.color([0.6, 0.62, 0.68]); M.save().move(0, 2.5, 0); M.lathe('slate', [[0, 1.7], [0.95, 0.05], [1.0, 0], [0, 0]], 4, { sharp: 0.2 }); M.restore();
    M.color([1, 1, 1]); M.save().move(0, 2.55, 0); M.lathe('snowmat', [[0, 1.45], [0.25, 1.2], [0.88, 0.12], [0.98, 0.0], [0.9, -0.05]], 4, { sharp: 0.3 }); M.restore();
    M.color([0.2, 0.2, 0.2]); M.save().move(0, 4.2, 0); M.cyl('steel', 0.02, 0.9, 5); M.restore();
    M.save().move(0.12, 4.85, 0); M.boxB('steel', -0.3, 0.3, 0, 0.18, -0.01, 0.01); M.restore();
    M.restore();
  }
  // interior: ticket window in the center, double benches, stove, lockers, columns, timetables, lanterns
  {
    const M = DECOR;
    // ticket window: 2.6 x 2.1 m (point B, in the middle of the hall, remains passable on three quarters of the way around)
    const g0 = 0.0, g1 = 2.6, gz = 1.05, gm = (g0 + g1) / 2;
    M.save().local(1);
    M.color([0.2, 0.32, 0.25]); M.boxB('paintwood', g0, g1, 0, 1.1, -gz, gz);
    M.color([0.42, 0.3, 0.2]); M.boxB('wood', g0 - 0.1, g1 + 0.1, 1.1, 1.18, -gz - 0.1, gz + 0.1, { bevel: 0.015 });
    M.color([0.2, 0.32, 0.25]);
    for (const [x, z] of [[g0, -gz], [g1, -gz], [g0, gz], [g1, gz], [gm, -gz], [gm, gz], [g0, 0], [g1, 0]]) M.boxB('paintwood', x - 0.06, x + 0.06, 1.18, 2.3, z - 0.06, z + 0.06);
    M.cls = 1; M.color([1, 1, 1]);
    for (const s of [-1, 1]) { M.quad('glass', [g0 + 0.05, 1.25, s * gz], [g1 - 0.05, 1.25, s * gz], [g1 - 0.05, 2.25, s * gz], [g0 + 0.05, 2.25, s * gz], [0, 0, s]); M.quad('glass', [s > 0 ? g1 : g0, 1.25, -gz + 0.05], [s > 0 ? g1 : g0, 1.25, gz - 0.05], [s > 0 ? g1 : g0, 2.25, gz - 0.05], [s > 0 ? g1 : g0, 2.25, -gz + 0.05], [s, 0, 0]); }
    M.cls = 0; M.color([0.18, 0.28, 0.22]); M.boxB('paintwood', g0 - 0.15, g1 + 0.15, 2.3, 2.62, -gz - 0.15, gz + 0.15, { bevel: 0.03 });
    M.color([0.06, 0.06, 0.06]); M.boxB('dark', g0 + 0.1, g1 - 0.1, 1.2, 2.28, -gz + 0.1, gz - 0.1);
    M.restore();
    WORLD.col({ x0: g0, x1: g1, y0: 0, y1: 2.62, z0: -gz, z1: gz }, 'wood');
    // departures board: a thin two-sided panel, set on the roof of the ticket window (the board floated above it, with nothing behind)
    M.color([0.2, 0.32, 0.25]); M.boxB('paintwood', gm - 0.62, gm + 0.62, 2.62, 3.96, -0.05, 0.05, { bevel: 0.01 });
    WORLD.col({ x0: gm - 0.62, x1: gm + 0.62, y0: 2.62, y1: 3.96, z0: -0.05, z1: 0.05 }, 'wood');
    for (const s of [1, -1]) {
      M.save().color([1, 1, 1]).move(gm, 2.75, s * 0.056).rotY(s > 0 ? 0 : Math.PI); wallDecal2(M, DEC2.departs, 0, 0, 1.1, 1.1, 0); M.restore(); // white tint: that of the panel turned the board green
    }
    // double benches (shared backrest) on the platform side
    for (const s of [-1, 1]) M.place(PF.platformBench(), -6.8 + s * 0.42, 0, 0, s > 0 ? Math.PI / 2 : -Math.PI / 2);
    WORLD.col({ x0: -7.45, x1: -6.15, y0: 0, y1: 1.0, z0: -1.1, z1: 1.1 }, 'wood');
    // cast-iron stove and its pipe
    M.save().color([0.12, 0.12, 0.12]).local(1).move(-3.4, 0, 0);
    M.lathe('steel', [[0, 0], [0.32, 0], [0.34, 0.12], [0.3, 0.2], [0.3, 0.85], [0.34, 0.92], [0.22, 1.02], [0.08, 1.06], [0, 1.06]], 14, { sharp: 0.5 });
    M.cyl('steel', 0.08, G - 0.1, 8); M.color([2.4, 0.9, 0.3]); M.cls = 1; M.boxB('bulb', -0.14, 0.14, 0.32, 0.5, 0.29, 0.31);
    M.restore();
    WORLD.col({ x0: -3.75, x1: -3.05, y0: 0, y1: 1.06, z0: -0.35, z1: 0.35 }, 'metal');
    // luggage lockers along the east wall
    for (const s of [1, -1]) {
      const [a, b] = [s * 2.5, s * 6.3].sort((p, q) => p - q);
      M.save().color([0.42, 0.3, 0.2]).local(1);
      M.boxB('wood', 3.75, 4.55, 0, 1.05, a, b); M.boxB('wood', 3.6, 4.6, 1.05, 1.12, a - 0.05, b + 0.05, { bevel: 0.01 });
      M.color([0.35, 0.25, 0.17]); for (const y of [1.6, 2.3, 3.0]) M.boxB('wood', 4.15, 4.55, y, y + 0.04, a, b);
      M.restore();
      WORLD.col({ x0: 3.6, x1: 4.55, y0: 0, y1: 1.12, z0: a, z1: b }, 'wood');
      for (const y of [1.6, 2.3, 3.0]) M.pcol(4.15, 4.55, y, y + 0.04, a, b); // the shelves hold the cardboard boxes
      for (let k = 0; k < 5; k++) { const z = a + 0.4 + k * 0.7; M.dyn('cardboard', 4.35, 1.64, z, 0.1 * k, { a: [0.4, 0.3, 0.32] }); if (k % 2) M.dyn('cardboard', 4.35, 2.34, z + 0.1, 0.3, { a: [0.36, 0.34, 0.3] }); }
      M.place(PF.castColumn(G), -5.2, 0, s * 3.6, 0, {}); M.place(PF.castColumn(G), 3.0, 0, s * 4.6, 0, {});
      M.place(PF.lantern(), -5.2, G - 0.1, s * 1.4, 0, { nocol: true }); M.place(PF.lantern(), 1.2, G - 0.1, s * 4.2, 0, { nocol: true });
      M.save().move(-3.4, 0, s * 6.55).rotY(s > 0 ? Math.PI : 0); wallDecal2(M, s > 0 ? DEC2.poster : DEC2.poster2, 0, 1.0, 0.9, 1.1); M.restore();
    }
  }
}

/* ---------- One half of the map (mirrored in z) ---------- */
function saintgivreHalf(s) {
  const Z = (z) => z * s, zr = (a, b) => [Z(a), Z(b)].sort((p, q) => p - q);
  const zop = (a, b) => { const [p, q] = zr(a, b); return { a0: p, a1: q }; };
  const fN = s > 0 ? 'n' : 's', fS = s > 0 ? 's' : 'n'; // face turned toward the center / toward the base
  const R = rngOf(s > 0 ? 501 : 502);
  const [xa, xb] = GV.tracks;

  /* ----- Voies: railcars, trackman's hut, covers ----- */
  gvWagon(PF.boxcar(), xb, Z(18.5), s > 0 ? 0 : Math.PI, s > 0 ? [0.46, 0.27, 0.21] : [0.36, 0.41, 0.47], { shape: GV_SHAPES.boxcar, bogies: [-4.5, 4.5] });
  gvWagon(PF.tankcar(), xa, Z(29.7), s > 0 ? 0 : Math.PI, s > 0 ? [0.16, 0.16, 0.17] : [0.86, 0.86, 0.83], { shape: GV_SHAPES.tankcar, bogies: [-3.6, 3.6] });
  gvWagon(PF.flatcar(), xa, Z(41.0), s > 0 ? 0 : Math.PI, null, { shape: GV_SHAPES.flatcar, bogies: [-4.3, 4.3] }); // joined to the tank car, 1.4 m of passage to the back wall (the strip behind it ended in a dead end)
  DECOR.place(PF.sleeperStack(5, 6), (xa + xb) / 2, RAIL.bed, Z(30.3), 0);
  {
    // roadman's hut on the cliff path
    const [a, b] = zr(10.6, 13.6);
    chalet(-23.9, -21.7, a, b, { h: 2.5, g0: 2.5, ridge: 'z', faces: 'e', stone: false, lit: 0.6, balcony: false, chimney: true, tint: [0.62, 0.46, 0.34], wood: [0.6, 0.5, 0.42], roofTint: [0.5, 0.45, 0.42], pitch: 0.5, ovE: 0.5, ovG: 0.4 });
  }
  for (const [z, w, d, h] of [[21, 2.6, 1.6, 0.9], [35.5, 3.2, 1.8, 1.1]]) { DECOR.place(PF.snowMound(w, d, h, 2 + Math.round(z), 'ground'), -23.0, 0, Z(z), 0.2 * s); snowHeap(-23.0, Z(z), w * 0.75, d * 0.75, 0.2 * s); }
  WORLD.col({ x0: -23.9, x1: -22.3, y0: 0, y1: 0.85, z0: Z(35.5) - 1.3, z1: Z(35.5) + 1.3 }, 'snow');
  for (const z of [16, 28, 40]) DECOR.place(PF.pole(), -23.45, 0, Z(z), Math.PI / 2);

  /* ----- Halle aux marchandises (x -9..-3, z 7..20): through hall, platform ↔ Grand-Rue ----- */
  {
    const X0 = -9, X1 = -3, t = 0.3, H = 4.7, [zA, zB] = zr(7, 20), tint = [0.88, 0.76, 0.64];
    // platform door (z 12 to 15) and east window raised to 2.75 m: the mezzanine (z 7 to 11.6) passes above the front door (10.5 to 13.5)
    // platform wall 1 cm in front of the station facade: the station's corner quoins (z 7 to 7.07) were flush in its plane
    wallOpen('boards', 'z', X0 + t / 2 - 0.01, t, zA, zB, 0, H, [{ ...zop(12.0, 15.0), b0: 0, b1: 3.2 }, { ...zop(16.5, 18.0), b0: 2.0, b1: 3.4 }], { tint, m: 'wood', frames: false });
    wallOpen('boards', 'z', X1 - t / 2, t, zA, zB, 0, H, [{ ...zop(15.0, 18.0), b0: 0, b1: 3.2 }, { ...zop(9.5, 11.0), b0: 2.75, b1: 3.95 }], { tint, m: 'wood', frames: false });
    wallOpen('boards', 'x', Z(20) - s * t / 2, t, X0 + t, X1 - t, 0, H, [{ a0: -7.0, a1: -5.2, b0: 2.2, b1: 3.4 }], { tint, m: 'wood', frames: false });
    box('wood', X0 + t, X1 - t, 0, 0.04, ...zr(7, 20 - t), { collide: false, ao: false, tint: [0.6, 0.5, 0.4] }); // up to the gable (its end flickered in its face)
    // stone base, sliding doors open, canopy on the platform side
    DECOR.save().color([0.82, 0.8, 0.77]).world(1);
    gvPlinth(X0 - 0.06, X0, 0.6, zA, zB, [zr(12.0, 15.0)]); gvPlinth(X1, X1 + 0.06, 0.6, zA, zB, [zr(15.0, 18.0)]);
    DECOR.restore();
    DECOR.save().color([0.5, 0.26, 0.18]).local(1);
    { const [a, b] = zr(8.9, 11.9); DECOR.boxB('paintwood', X0 - 0.12, X0 - 0.05, 0.05, 3.3, a, b); }
    { const [a, b] = zr(11.8, 14.8); DECOR.boxB('paintwood', X1 + 0.05, X1 + 0.12, 0.05, 3.3, a, b); }
    DECOR.color([0.2, 0.2, 0.2]); DECOR.boxB('steel', X0 - 0.16, X0 - 0.04, 3.35, 3.45, zA + 0.3, zB - 0.3); DECOR.boxB('steel', X1 + 0.04, X1 + 0.16, 3.35, 3.45, zA + 0.3, zB - 0.3);
    DECOR.restore();
    alpineRoof(X0, X1, zA, zB, H, { alongX: false, pitch: 0.42, mat: 'slate', tint: [0.55, 0.52, 0.5], chimney: false, wood: [0.62, 0.52, 0.42], ovE: 0.9, ovG: 0.5, R });
    // storage mezzanine against the station wall (map workshop, October 2026; sketch val-blanc-redesign-b.js): floor at 2.5 m,
    // edge beam on two posts against the walls, railing; ramp along the east wall (1.75 m wide: the x = -4.5 cell keeps its
    // 42 cm on each side, invisible railing wall included); through the east window, the Grand-Rue and the hall's north door
    {
      const [ma, mb] = zr(7.02, 11.6), zf = Z(11.6), [ea, eb] = zr(11.4, 11.6), wt = [0.58, 0.46, 0.34];
      box('wood', X0 + t + 0.01, X1 - t - 0.01, 2.35, 2.5, ma, mb, { tint: wt });
      DECOR.save().color([0.45, 0.36, 0.28]).local(1);
      DECOR.boxB('wood', X0 + t, X1 - t, 2.1, 2.35, ea, eb);
      for (const [p0, p1] of [[X0 + t, X0 + t + 0.18], [X1 - t - 0.18, X1 - t]]) DECOR.boxB('wood', p0, p1, 0, 2.1, ea, eb);
      DECOR.restore();
      WORLD.col({ x0: X0 + t, x1: X1 - t, y0: 2.1, y1: 2.35, z0: ea, z1: eb }, 'wood');
      for (const [p0, p1] of [[X0 + t, X0 + t + 0.18], [X1 - t - 0.18, X1 - t]]) WORLD.col({ x0: p0, x1: p1, y0: 0, y1: 2.1, z0: ea, z1: eb }, 'wood');
      railing(zf, 0, 2.5, X0 + t, -5.05, 'x');
      const [ra, rb] = zr(11.6, 15.8);
      ramp(-5.05, X1 - t - 0.01, ra, rb, 'z', s > 0 ? 2.5 : 0, s > 0 ? 0 : 2.5, 'wood', [0.55, 0.45, 0.36], { mat: 'wood' });
      railing(-5.07, 0, 0, ra, rb, 'z', s > 0 ? [2.5, 0] : [0, 2.5]);
    }
    // interior: crates (under the mezzanine), sacks on pallets, platform scale, hand truck
    // a single pile, in the west corner: a row along the station wall closed off, with the head of the ramp and the east wall, a pocket (dead end)
    crate(-8.05, 0, Z(7.75), 1.1, 0.1); crate(-8.05, 0, Z(9.05), 1.0, -0.2); crate(-8.0, 1.1, Z(7.8), 0.9, 0.2);
    DECOR.place(PF.pallet(), -7.4, 0, Z(17.8), 0.1); for (let k = 0; k < 3; k++) { DECOR.save().move(-7.4 + (k - 1) * 0.32, 0.12, Z(17.8)).rotY(Math.PI / 2); DECOR.dyn('sandbagLow', 0, 0, 0, 0, { tint: [0.9, 0.86, 0.74] }); DECOR.restore(); }
    WORLD.col({ x0: -8.0, x1: -6.8, y0: 0, y1: 0.5, z0: Z(17.8) - 0.5, z1: Z(17.8) + 0.5 }, 'dirt');
    barrel(-4.0, Z(19.2), [0.3, 0.42, 0.55]); barrel(-4.75, Z(19.4), [0.55, 0.2, 0.15]);
    DECOR.place(PF.lantern(), -6, H - 0.1, Z(13.5), 0, { nocol: true });
  }
  /* ----- Poste d'aiguillage (x -9..-4.5, z 24..29.5): glazed upper floor over the tracks, staircase on the base side ----- */
  {
    const X0 = -9, X1 = -4.5, [zA, zB] = zr(24, 29.5), F = 3.4, h2 = 2.45, t = 0.2;
    box('stone', X0, X1, 0, F, zA, zB, { tint: [0.84, 0.82, 0.8] });
    box('wood', X0 + t, X1 - t, F, F + 0.03, zA + t, zB - t, { collide: false, ao: false, tint: [0.55, 0.42, 0.32] });
    const up = { tint: [0.72, 0.58, 0.46], floorY: F, m: 'wood', frames: false };
    wallOpen('boards', 'z', X0 + t / 2, t, zA, zB, F, h2, [{ ...zop(24.5, 29.0), b0: 0.95, b1: 2.15 }], up);
    wallOpen('boards', 'z', X1 - t / 2, t, zA, zB, F, h2, [{ ...zop(25.0, 28.5), b0: 0.95, b1: 2.15 }], up);
    wallOpen('boards', 'x', Z(24) + s * t / 2, t, X0 + t, X1 - t, F, h2, [{ a0: -8.5, a1: -5.0, b0: 0.95, b1: 2.15 }], up);
    wallOpen('boards', 'x', Z(29.5) - s * t / 2, t, X0 + t, X1 - t, F, h2, [{ a0: -8.05, a1: -6.95, b0: 0, b1: 2.1 }, { a0: -6.1, a1: -5.0, b0: 0.95, b1: 2.15 }], up);
    box('wood', X0, X1, F + h2, F + h2 + 0.2, zA, zB, { tint: [0.55, 0.42, 0.32] });
    alpineRoof(X0, X1, zA, zB, F + h2 + 0.2, { alongX: false, pitch: 0.5, mat: 'slate', tint: [0.5, 0.48, 0.48], chimney: true, wood: [0.68, 0.56, 0.44], ovE: 0.8, ovG: 0.6, R });
    // wooden gallery in front of the door, base side, and staircase that climbs to it along the facade (from east to west, up to the door:
    // you no longer climb facing the wall). Gentle slope: the bots use it, the navigation grid does not accept more than 0.62 m of climb
    // per meter. The staircase arrives at a 1.5 m landing at the end of the gallery, above the end of the platform, from which you enter the gallery
    // over its whole depth (owner's feedback, October 2026: at the top, you got onto the gallery through a 0.8 m gap, and nothing
    // held you back from the void at the end of the staircase). Railing all around the gallery and the landing.
    {
      const [a, b] = zr(29.3, 31.0), [c, d] = zr(31.0, 32.3), [pa, pb] = zr(29.3, 32.3), XG = -4.0, XL = X0 - 1.5, wt = [0.55, 0.45, 0.36];
      // the gallery floor stops at the stone base (z 29.5), whose top is at the same height: over its first 20 cm the two top faces
      // flickered in the same plane (audit, November 2026); only the part east of the base (x -4.5 to -4) starts at 29.3
      box('wood', X0, X1, F - 0.15, F, ...zr(29.5, 31.0), { tint: wt }); box('wood', X1, XG, F - 0.15, F, a, b, { tint: wt });
      box('wood', XL, X0, F - 0.15, F, pa, pb, { tint: wt }); // landing
      railing(Z(30.97), 0, F, X0, XG, 'x'); DECOR.col(X0, XG, F, F + 1.0, Math.min(Z(30.92), Z(31.0)), Math.max(Z(30.92), Z(31.0)), 'wood');
      railing(XG - 0.02, 0, F, a, b, 'z'); DECOR.col(XG - 0.07, XG + 0.03, F, F + 1.0, a, b, 'wood');
      // landing railing: west edge (above the platform), north and south edges
      railing(XL + 0.05, 0, F, pa, pb, 'z'); DECOR.col(XL, XL + 0.1, F, F + 1.0, pa, pb, 'wood');
      for (const zz of [29.33, 32.27]) { railing(Z(zz), 0, F, XL, X0, 'x'); DECOR.col(XL, X0, F, F + 1.0, Z(zz) - 0.05, Z(zz) + 0.05, 'wood'); }
      ramp(X0, -3.1, c, d, 'x', F, 0, 'wood', wt, { mat: 'wood' });
      railing(Z(32.28), 0, 0, X0, -3.1, 'x', [F, 0]);
      // landing posts (on the ground, north of the end of the platform) and knee braces that carry its south edge, above the platform
      DECOR.save().color([0.45, 0.36, 0.28]).local(1);
      for (const zz of [30.45, 32.15]) { DECOR.boxB('wood', XL + 0.03, XL + 0.17, 0, F - 0.15, Z(zz) - 0.07, Z(zz) + 0.07); DECOR.col(XL + 0.03, XL + 0.17, 0, F - 0.15, Z(zz) - 0.07, Z(zz) + 0.07, 'wood'); }
      DECOR.save().move(XL + 0.1, F - 0.15, Z(30.45)).rotX(-s * Math.atan2(1.0, 0.9)); DECOR.boxB('wood', -0.05, 0.05, -1.3, 0, -0.05, 0.05); DECOR.restore();
      DECOR.restore();
    }
    DECOR.save().color([0.45, 0.36, 0.28]).local(1); for (const x of [-8.9, -6.6, -4.1]) DECOR.boxB('wood', x - 0.07, x + 0.07, 0, F - 0.15, Z(30.88) - 0.07, Z(30.88) + 0.07); DECOR.restore();
    // interior: row of signal levers, desk, stove
    const M = DECOR;
    M.save().local(1);
    for (let k = 0; k < 10; k++) {
      const z = Z(24.9 + k * 0.42), c = [[0.7, 0.12, 0.1], [0.15, 0.3, 0.6], [0.1, 0.1, 0.1], [0.85, 0.7, 0.15]][k % 4];
      M.color(c); M.save().move(-8.1, F + 0.25, z).rotZ(k % 3 ? 0.25 : -0.3); M.boxB('steel', -0.025, 0.025, 0, 1.25, -0.02, 0.02); M.restore();
    }
    M.color([0.3, 0.3, 0.28]); M.boxB('steel', -8.5, -7.7, F, F + 0.3, Z(24.6), Z(29.1) + 0.0001);
    M.color([0.45, 0.33, 0.23]); M.boxB('wood', -5.5, -4.8, F, F + 0.95, ...zr(25.2, 27.4)); M.boxB('wood', -5.6, -4.75, F + 0.95, F + 1.0, ...zr(25.1, 27.5), { bevel: 0.01 });
    M.restore();
    WORLD.col({ x0: -5.5, x1: -4.8, y0: F, y1: F + 1.0, z0: Math.min(Z(25.2), Z(27.4)), z1: Math.max(Z(25.2), Z(27.4)) }, 'wood');
    M.place(PF.lantern(), -6.7, F + h2 - 0.05, Z(26.8), 0, { nocol: true });
  }
  /* ----- West base yard: woodpile, barrier ----- */
  // woodpile against the south facade of the customs booth, east of the passage under the barrier (whose exit it closed)
  DECOR.place(PF.woodpile(2.0, 1.3, 0.6), -6.2, 0, Z(37.2), s > 0 ? 0 : Math.PI);
  /* ----- Border post (map workshop, October 2026; sketch: tools/dev/visual/sketches/val-blanc-redesign-a.js): the yard of point
     A had no post, and 10 of the base's 12 spawns saw the point (whoever took it shot into the base). The customs
     office and its booth close off the view between the base and the yard; you pass between the two under the raised barrier (1.4 m, one more entrance
     for A). A pile of logs screens the east, facing the Grand-Rue; a luggage cart and crates cover the arrival from the center. ----- */
  {
    const [zA, zB] = zr(37.6, 40.1), yard = s > 0 ? 'n' : 's';
    const douane = { h: 3.2, g0: 3.2, ridge: 'x', faces: 'nsew', stone: true, lit: 0.5, balcony: false, tint: [0.86, 0.84, 0.8], wood: [0.55, 0.42, 0.3], roofTint: [0.5, 0.48, 0.48], pitch: 0.5, ovE: 0.35, ovG: 0.3 };
    chalet(-13.5, -9.0, zA, zB, { ...douane, chimney: true });
    chalet(-7.6, -5.0, zA, zB, { ...douane, chimney: false });
    inFrame(facadeFrame(yard, -13.5, -9.0, zA, zB), (M) => sign2Board(M, 2.25, 2.35, 2.0, 0.55, SIGNS2.douane, [0.12, 0.18, 0.15]));
    // raised barrier between the two: striped post against the booth, raised rail (no collision above the passage)
    const M = DECOR, zc = Z(38.85);
    M.save().local(1).color([0.92, 0.9, 0.86]); M.boxB('paintwood', -7.85, -7.65, 0, 1.1, zc - 0.1, zc + 0.1); M.restore();
    M.save().move(-7.75, 1.05, zc).rotZ(1.35).local(1);
    for (let i = 0; i < 6; i++) { M.color(i % 2 ? [0.92, 0.92, 0.9] : [0.72, 0.1, 0.08]); M.boxB('paintwood', i * 0.5, i * 0.5 + 0.5, -0.04, 0.04, -0.04, 0.04); }
    M.restore();
    WORLD.col({ x0: -7.85, x1: -7.65, y0: 0, y1: 1.1, z0: zc - 0.1, z1: zc + 0.1 }, 'wood');
    logPile(-2.0, Z(37.2), 1.6, 5, 0.33, 7 + s);
    DECOR.place(PF.luggageCart(), -12.8, 0, Z(29.4), 0);
    crate(-6.2, 0, Z(34.3), 1.0, 0.15); crate(-5.2, 0, Z(34.4), 0.8, 0.5);
  }

  /* ----- Grand-Rue (x -3..5): military truck, 4x4, snow berms, street lamps, garlands ----- */
  truck(2.0, Z(22), 'z'); // tarped military truck, hood toward the station (the cab-forward flatbed, 2.9 m high, blocked the menu view)
  car(1.0, Z(34.6), -0.25 * s, [0.55, 0.12, 0.1], false, 'offroad');
  snowBank(-3.0, -2.15, ...zr(8.6, 12.2), 0.75, 11 + s); // stopped before the street lamp (z 13)
  snowBank(-3.0, -2.15, ...zr(21.0, 28.4), 0.85, 13 + s);
  snowBank(4.15, 5.0, ...zr(9.4, 14.6), 0.8, 15 + s);
  snowBank(4.15, 5.0, ...zr(18.0, 20.6), 0.7, 17 + s);
  lampPost(-2.6, Z(13), 0); lampPost(4.6, Z(27), Math.PI);
  stringLights([-3.0, 4.3, Z(10.5)], [5.0, 5.6, Z(12.5)], 0.5, 3 + s);
  stringLights([-3.0, 4.3, Z(18.5)], [5.0, 5.8, Z(20.0)], 0.6, 5 + s);
  stringLights([-4.45, 5.5, Z(28.4)], [5.0, 5.4, Z(31.0)], 0.6, 7 + s); // from the wall of the Poste d'aiguillage to the Hôtel
  // frozen fountain-trough
  {
    const M = DECOR, z = Z(31.6);
    M.save().color([0.8, 0.79, 0.77]).local(1).move(3.7, 0, z);
    M.boxB('stone', -0.5, 0.5, 0, 0.75, -1.1, 1.1, { bevel: 0.04 });
    M.color([0.78, 0.86, 0.95]); M.boxB('ice', -0.4, 0.4, 0.62, 0.66, -1.0, 1.0);
    M.color([0.75, 0.74, 0.72]); M.boxB('stone', 0.32, 0.52, 0, 1.5, -0.2, 0.2); M.color([0.3, 0.3, 0.3]); M.tube('steel', 0.03, [[0.32, 1.3, 0], [0.05, 1.25, 0], [0, 1.1, 0]], 5);
    M.color([1, 1, 1]); M.save().move(0, 1.1, 0).rotX(Math.PI); M.cyl('ice', 0.05, 0.5, 6, { r1: 0.006, caps: '' }); M.restore();
    M.restore();
    WORLD.col({ x0: 3.2, x1: 4.22, y0: 0, y1: 0.75, z0: z - 1.1, z1: z + 1.1 }, 'concrete');
  }

  /* ----- Hôtel des Cimes (x 5..11, z 9..21): through bar, three levels of chalet ----- */
  {
    const X0 = 5, X1 = 11, [zA, zB] = zr(9, 21), t = 0.35, G = 3.4, stone = [0.88, 0.86, 0.84];
    wallOpen('stone', 'z', X0 + t / 2, t, zA + t, zB - t, 0, G, [{ ...zop(15.4, 16.9), b0: 0, b1: 2.4 }, { ...zop(11.0, 12.3), b0: 1.15, b1: 2.15 }], { tint: stone, frameTint: [0.32, 0.24, 0.17] });
    wallOpen('stone', 'z', X1 - t / 2, t, zA + t, zB - t, 0, G, [{ ...zop(11.6, 13.1), b0: 0, b1: 2.4 }, { ...zop(17.2, 18.5), b0: 1.15, b1: 2.15 }], { tint: stone, frameTint: [0.32, 0.24, 0.17] });
    wallOpen('stone', 'x', Z(9) + s * t / 2, t, X0, X1, 0, G, [{ a0: 7.3, a1: 8.7, b0: 1.15, b1: 2.15 }], { tint: stone });
    wallOpen('stone', 'x', Z(21) - s * t / 2, t, X0, X1, 0, G, [{ a0: 7.6, a1: 9.0, b0: 1.15, b1: 2.15 }], { tint: stone });
    box('wood', X0 + t, X1 - t, 0, 0.04, zA + t, zB - t, { collide: false, ao: false, tint: [0.56, 0.42, 0.3] });
    // slab set 2 cm into the walls and 1 cm above their course: in their plane, it flickered with the stone
    box('plaster', X0 + 0.02, X1 - 0.02, G - 0.25, G + 0.01, zA + 0.02, zB - 0.02, { tint: [0.92, 0.9, 0.86] });
    ceilingJoists(X0 + t, X1 - t, zA + t, zB - t, G - 0.25);
    chalet(X0, X1, zA, zB, { hollow: true, g0: G, h: 9.0, ridge: 'z', faces: 'nsew', lit: 0.55, balcony: true, chimney: true, tint: [0.95, 0.92, 0.86], wood: [0.78, 0.64, 0.5], shutter: [0.6, 0.16, 0.12], roofTint: [0.55, 0.5, 0.48] });
    inFrame(facadeFrame('w', X0, X1, zA, zB), (M) => { sign2Board(M, 6, G + 0.15, 3.4, 0.85, SIGNS2.hotel, [0.3, 0.22, 0.15]); });
    // bar: counter and shelves, tables, lit fireplace, lanterns
    const M = DECOR, [ca, cb] = zr(14.0, 19.2);
    M.save().local(1).color([0.45, 0.3, 0.2]);
    M.boxB('wood', 9.4, 10.0, 0, 1.08, ca, cb); M.boxB('wood', 9.3, 10.1, 1.08, 1.14, ca - 0.05, cb + 0.05, { bevel: 0.015 });
    // shelves on the solid wall section between the door and the window (z 13.1 to 17.2): from 14 to 19.2, they passed in front of the window
    const [sa, sb] = zr(13.3, 17.0), sz = (z) => lerp(sa + 0.08, sb - 0.08, (z - ca - 0.15) / (cb - ca - 0.25)); // sz: place of a bottle (same draws as before)
    M.color([0.38, 0.26, 0.18]); for (const y of [1.4, 1.9, 2.4]) M.boxB('wood', 10.35, 10.62, y, y + 0.04, sa, sb);
    // bottles: physical bodies, resting on the shelves (collision reserved for props) and shattering under a bullet
    const RB = rngOf(77 + s);
    for (const y of [1.4, 1.9, 2.4]) M.pcol(10.35, 10.62, y, y + 0.04, sa, sb);
    for (const y of [1.44, 1.94, 2.44]) for (let z = ca + 0.15; z < cb - 0.1; z += 0.13 + RB() * 0.08) { const tint = RB.pick([[0.12, 0.3, 0.12], [0.4, 0.2, 0.1], [0.8, 0.75, 0.6], [0.1, 0.12, 0.2]]); M.dyn('bottle', 10.48, y, sz(z), 0, { a: [Math.round((0.24 + RB() * 0.06) * 50) / 50], tint }); }
    M.restore();
    WORLD.col({ x0: 9.3, x1: 10.1, y0: 0, y1: 1.14, z0: ca, z1: cb }, 'wood');
    tableSet(M, 7.0, Z(12.6), 0.1 * s, [[-0.5, 0.74], [0.45, -0.74], [-0.45, -0.74]], [0.55, 0.4, 0.28]);
    tableSet(M, 7.1, Z(18.9), -0.15 * s, [[0.5, 0.74], [-0.45, -0.74], [0.45, -0.74]], [0.55, 0.4, 0.28]);
    {
      const z = Z(9) + s * 0.55;
      M.save().color([0.8, 0.78, 0.75]).local(1).move(8.0, 0, z);
      M.boxB('stone', -1.0, 1.0, 0, 1.45, -0.35, 0.35); M.boxB('stone', -0.8, 0.8, 1.45, G - 0.25, -0.3, 0.3);
      M.color([0.05, 0.05, 0.05]); M.boxB('dark', -0.6, 0.6, 0.15, 1.0, -0.36, -0.1);
      M.cls = 1; M.color([2.6, 1.1, 0.35]); M.boxB('bulb', -0.4, 0.4, 0.18, 0.42, -0.3, -0.12);
      M.restore();
      WORLD.col({ x0: 7.0, x1: 9.0, y0: 0, y1: G - 0.25, z0: z - 0.35, z1: z + 0.35 }, 'concrete');
    }
    M.place(PF.lantern(), 7.0, G - 0.3, Z(15), 0, { nocol: true }); M.place(PF.lantern(), 9.0, G - 0.3, Z(11.4), 0, { nocol: true });
    M.place(PF.rugFloor(), 7.2, 0.045, Z(15.3), Math.PI / 2);
  }
  /* ----- Boulangerie (x 5..11, z 25..33) ----- */
  {
    const [a, b] = zr(25, 33);
    chalet(5, 11, a, b, { h: 6.4, g0: 3.0, ridge: 'x', faces: 'w' + fN + fS, door: 'w', lit: 0.5, stone: false, tint: [0.96, 0.9, 0.8], shutter: [0.2, 0.36, 0.26], pile: fN, pileCol: true });
    inFrame(facadeFrame('w', 5, 11, a, b), (M) => { sign2Board(M, 4.0, 2.75, 2.6, 0.65, SIGNS2.boulangerie, [0.3, 0.22, 0.15]); });
  }
  DECOR.place(PF.woodpile(2.6, 1.2, 0.55), 8.2, 0, Z(21.35), s > 0 ? 0 : Math.PI);
  DECOR.dyn('sled', 5.3, 0, Z(23.0), 0.4);

  /* ----- Village: Placette chalet, Placette and its fir tree, Grange, paths ----- */
  {
    const [a, b] = zr(10, 18);
    chalet(15, 24, a, b, { h: 6.9, g0: 3.0, ridge: 'x', faces: 'w' + fN + fS, door: fS, lit: 0.45, balcony: true }); // without a log pile on the Scierie side: the alley ended in a dead end behind it
  }
  {
    // Placette: lit fir tree, trough, bench, street lamp
    const zc = Z(20.6);
    // trimmed square fir (first branches at 2.4 m, their tips at 1.9 m at the lowest) in a 1.3 m wooden planter: you pass under its
    // branches and on both sides of the planter. Until then, branched down to the ground and ringed by a 4 m snow bank, it blocked the square
    // (owner's feedback, October 2026: it hindered all navigation)
    const xt = 22.0; // at the east end of the square, its crown far from the doors of the Grange and the chalet
    DECOR.place(PF.xmasTree(6, 2.4), xt, 0, zc, 0, { nocol: true });
    DECOR.save().color([0.5, 0.38, 0.28]).local(1);
    DECOR.boxB('wood', xt - 0.65, xt + 0.65, 0, 0.5, zc - 0.65, zc + 0.65, { bevel: 0.02 });
    DECOR.color([0.4, 0.3, 0.22]); DECOR.boxB('wood', xt - 0.7, xt + 0.7, 0.44, 0.52, zc - 0.7, zc + 0.7, { bevel: 0.015 });
    DECOR.color([1, 1, 1]); DECOR.boxB('snowmat', xt - 0.58, xt + 0.58, 0.52, 0.56, zc - 0.58, zc + 0.58, { bevel: 0.03 });
    DECOR.restore();
    WORLD.col({ x0: xt - 0.7, x1: xt + 0.7, y0: 0, y1: 0.52, z0: zc - 0.7, z1: zc + 0.7 }, 'wood');
    WORLD.col({ x0: xt - 0.15, x1: xt + 0.15, y0: 0.52, y1: 4.5, z0: zc - 0.15, z1: zc + 0.15 }, 'wood');
    DECOR.place(PF.platformBench(), 23.4, 0, Z(19.6), -Math.PI / 2);
    lampPost(14.2, Z(22.6), s > 0 ? 0 : Math.PI); // against the wall of the Grange, away from its door (x 17.4 to 20)
  }
  /* ----- Grange (x 13..21, z 23..32): north-south through-barn, hayloft on the west (ramp), window onto the Placette. Layout reworked
     (owner's feedback, October 2026: the staircase stuck out onto the entrance, the hay bales blocked the middle): the two doors
     (x 17.4 to 20) face each other on the axis of a straight corridor, 30 cm from the ramp railing (x 15.6 to 17.1, along the hayloft); the
     hay is stored against the east wall, north of its door, away from the door corridors ----- */
  {
    const X0 = 13, X1 = 21, [zA, zB] = zr(23, 32), t = 0.25, H = 5.0, tint = [0.56, 0.44, 0.36], L = 2.8;
    const o = { tint, m: 'wood', frames: false };
    wallOpen('boards', 'x', Z(23) + s * t / 2, t, X0, X1, 0, H, [{ a0: 17.4, a1: 20.0, b0: 0, b1: 3.0 }, { a0: 13.5, a1: 15.0, b0: L + 0.25, b1: 4.4 }], o);
    wallOpen('boards', 'x', Z(32) - s * t / 2, t, X0, X1, 0, H, [{ a0: 17.4, a1: 20.0, b0: 0, b1: 3.0 }], o);
    wallOpen('boards', 'z', X0 + t / 2, t, zA + t, zB - t, 0, H, [], o);
    wallOpen('boards', 'z', X1 - t / 2, t, zA + t, zB - t, 0, H, [{ ...zop(26.0, 27.3), b0: 0, b1: 2.2 }], o);
    DECOR.save().color([0.8, 0.78, 0.76]).world(1);
    gvPlinth(X0 - 0.06, X0, 0.5, zA, zB, []); gvPlinth(X1, X1 + 0.06, 0.5, zA, zB, [zr(26.0, 27.3)]);
    DECOR.restore();
    alpineRoof(X0, X1, zA, zB, H, { alongX: false, pitch: 0.5, mat: 'slate', tint: [0.45, 0.4, 0.36], chimney: false, wood: [0.5, 0.4, 0.33], ovE: 1.3, ovG: 1.0, R });
    box('dirt', X0 + t, X1 - t, 0, 0.03, zA + t, zB - t, { collide: false, ao: false, tint: [0.66, 0.6, 0.52] });
    // hayloft: floor, posts, railing; access ramp
    { const [a, b] = zr(23.25, 31.75); box('wood', X0 + t, 15.6, L - 0.15, L, a, b, { tint: [0.58, 0.46, 0.34] }); }
    DECOR.save().color([0.45, 0.36, 0.28]).local(1); for (const z of [24.5, 28, 31.4]) DECOR.boxB('wood', 15.45, 15.6, 0, L - 0.15, Z(z) - 0.08, Z(z) + 0.08); DECOR.restore();
    // ramp arrival landing (against the north wall): it extends the hayloft to the ramp, you turn west instead of running into the void.
    // Ramp and 1.5 m landing (x 15.6 to 17.1), centered on the x = 16.5 cell: at 1.1 m wide, no cell center kept 42 cm on
    // each side, the network did not pass there and the hayloft stayed out of reach of the bots
    // Ramp and landing moved back 0.8 m to the north (map workshop): the foot of the ramp and its railing are out of the corridor of the south
    // door (x 16.4 to 19), and the underside of the hayloft keeps its exit through that door
    { const [a, b] = zr(23.25, 25.2); box('wood', 15.6, 17.1, L - 0.15, L, a, b, { tint: [0.58, 0.46, 0.34] }); railing(17.12, 0, L, a, b, 'z'); DECOR.col(17.1, 17.2, L, L + 1.0, a, b, 'wood');
      DECOR.save().color([0.45, 0.36, 0.28]).local(1); DECOR.boxB('wood', 16.95, 17.09, 0, L - 0.15, Z(24.6) - 0.07, Z(24.6) + 0.07); DECOR.restore(); }
    { const [a, b] = zr(25.2, 30.2); ramp(15.6, 17.1, a, b, 'z', s > 0 ? L : 0, s > 0 ? 0 : L, 'wood', [0.55, 0.45, 0.36], { mat: 'wood' }); railing(17.12, 0, 0, a, b, 'z', s > 0 ? [L, 0] : [0, L]); }
    // hay: stacked bales (low cover), hay on the hayloft, cart
    for (const [x, z, y, r] of [[20.35, 28.6, 0, Math.PI / 2], [20.35, 29.6, 0, Math.PI / 2 + 0.05], [20.35, 29.1, 0.45, Math.PI / 2 - 0.1], [14.3, 30.5, L, 0.3], [14.4, 29.6, L, -0.2], [14.3, 30.0, L + 0.45, 0.1]]) DECOR.dyn('hayBale', x, y, Z(z), r);
    DECOR.place(PF.snowMound(1.8, 1.1, 0.35, 12), 14.2, L, Z(25.0), 0, { tint: [0.9, 0.78, 0.5] });
    DECOR.place(PF.lantern(), 17.6, H - 0.15, Z(27.5), 0, { nocol: true });
  }
  // paths: woodpiles, barrier, sled, skis, snowman
  DECOR.place(PF.woodpile(3.2, 1.4, 0.55), 23.65, 0, Z(31.0), -Math.PI / 2);
  DECOR.dyn('snowman', 15.2, 0, Z(35.4), s > 0 ? Math.PI : 0); // next to the axis of the Grange door (x 17.4 to 20), not inside it
  skiRackAt(DECOR, 14.75, Z(32) + s * 0.56, s > 0 ? 0 : Math.PI, [[0.75, 0.15, 0.12], [0.2, 0.35, 0.6], [0.9, 0.7, 0.15], [0.15, 0.15, 0.17]]); // rack against the wall of the Grange

  /* ----- Base (z 38..48): tent, truck, crates, sandbags, snow berms ----- */
  { const tz = Z(45.5); DECOR.place(PF.tent(), -4.0, 0, tz, 0, { nocol: true }); box('canvas', -7.5, -0.5, 0, 2.1, tz - 2.2, tz + 2.2, { m: 'dirt', skip: 'xXyYzZ' }); }
  truck(9.0, Z(44.5), 'x', 'cargo', { load: 'tarp' }, [0.36, 0.42, 0.3]); // tarped cab-forward flatbed
  crate(16.5, 0, Z(41.2), 1.2, 0.2); crate(17.95, 0, Z(41.0), 1.1, 0.5); crate(17.2, 1.2, Z(41.1), 1.0, 0.1);
  sandbags(13.0, Z(39.0), 2.4, 'x', 4, 0, 'khaki');
  snowBank(19.5, 24.0, ...zr(38.4, 39.4), 0.8, 31 + s);
  snowBank(-3.0, 1.0, ...zr(38.2, 39.2), 0.7, 33 + s);
  DECOR.place(PF.generator(), 1.5, 0, Z(47.2), 0, { tint: [0.4, 0.44, 0.3] });
  // no fir in the corners of the base: its low branches (3 m span) closed off the passage there
}

/* ---------- Center: Cour de la gare, sawmill ---------- */
function saintgivreCenter() {
  // Cour: point B since the blizzard workshop (November 2026). The snowy car that filled the middle is gone: the point stands in the
  // open (70% of its disc walkable at least), between two short stacks of sawn planks waiting for the train (along x, 1.2 m high, at the
  // edge of the disc: cover for its defenders against each side's corner and alley), the log pile on the Scierie side and the station wall
  // with its two low windows. Woodpiles against the hotel, barrels at their end (at the station corner, they narrowed the way past the stacks)
  for (const s of [1, -1]) {
    DECOR.place(PF.woodpile(3.0, 1.3, 0.55), 8.0, 0, s * 8.35, s > 0 ? Math.PI : 0);
    barrel(9.95, s * 8.35, [0.3, 0.32, 0.28]);
    DECOR.place(PF.plankStack(2.0, 1.2, 1.2), 8.2, 0, s * 5.0, Math.PI / 2 + s * 0.03);
  }
  lampPost(11.4, -3.6, Math.PI / 2);
  // Sawmill: large open lean-to, logs, saw carriage, plank stacks, sawdust
  const X0 = 12.3, X1 = 24, Z0 = -8.5, Z1 = 8.5, H = 5.0;
  for (const x of [12.6, 18.2, 23.6]) for (const z of [-8.1, -2.7, 2.7, 8.1]) {
    if (x === 18.2 && Math.abs(z) < 3) continue;
    box('wood', x - 0.16, x + 0.16, 0, H, z - 0.16, z + 0.16, { tint: [0.55, 0.42, 0.32], m: 'wood' });
  }
  DECOR.save().color([0.5, 0.38, 0.28]).local(1);
  for (const x of [12.6, 18.2, 23.6]) DECOR.boxB('wood', x - 0.15, x + 0.15, H - 0.3, H, Z0, Z1);
  DECOR.restore();
  box('dirt', 12.6, 23.6, 0, 0.02, -8.1, 8.1, { collide: false, ao: false, tint: [0.78, 0.66, 0.5] }); // ground of packed earth and sawdust
  wallOpen('boards', 'z', 23.85, 0.3, Z0, Z1, 0, 4.2, [{ a0: -1.2, a1: 1.2, b0: 1.4, b1: 2.6 }], { tint: [0.52, 0.42, 0.34], m: 'wood', frames: false });
  alpineRoof(X0, X1, Z0, Z1, H, { alongX: false, pitch: 0.3, mat: 'corrugated', tint: [0.7, 0.68, 0.64], chimney: false, wood: [0.5, 0.4, 0.33], ovE: 0.7, ovG: 0.6, snowT: 0.38 });
  inFrame(facadeFrame('w', X0, X1, Z0, Z1), (M) => sign2Board(M, 8.5, H - 0.95, 3.4, 0.85, SIGNS2.scierie, [0.28, 0.2, 0.14]));
  // logs: pile in the center (cuts the alley's sight line) and two large piles
  logPile(12.0, 0, 2.7, 3, 0.33, 1);
  for (const s of [1, -1]) logPile(14.5, s * 5.0, 5.4, 4, 0.33, 2 + s);
  // saw carriage: steel frame on rails, log, saw frame
  {
    const M = DECOR;
    M.save().local(1).color([0.25, 0.25, 0.25]);
    for (const x of [19.4, 21.4]) M.boxB('rust', x - 0.06, x + 0.06, 0, 0.12, -6.5, 6.5);
    M.boxB('rust', 19.2, 21.6, 0.35, 0.7, -4.8, 4.8, { bevel: 0.03 });
    for (const z of [-4, 0, 4]) for (const x of [19.4, 21.4]) M.boxB('rust', x - 0.1, x + 0.1, 0, 0.35, z - 0.2, z + 0.2);
    M.color([0.62, 0.62, 0.6]); M.boxB('steel', 19.05, 21.75, 0, 3.4, -0.35, -0.2); M.boxB('steel', 19.05, 21.75, 0, 3.4, 0.2, 0.35);
    M.boxB('steel', 19.0, 21.8, 3.2, 3.5, -0.4, 0.4, { bevel: 0.03 });
    M.color([0.85, 0.85, 0.86]); for (let x = 19.3; x < 21.6; x += 0.18) M.boxB('steel', x - 0.006, x + 0.006, 0.7, 3.2, -0.04, 0.04);
    M.color([0.9, 0.72, 0.1]); M.boxB('paint', 19.0, 21.8, 2.9, 3.0, -0.42, -0.36);
    M.restore();
    M.save().color([0.95, 0.95, 0.95]).local(1).move(20.4, 1.05, -4.6).rotX(Math.PI / 2); M.cyl('bark', 0.36, 9.2, 12, { caps: '' }); M.restore();
    for (const s of [1, -1]) { M.save().move(20.4, 1.05, s * 4.6).rotX(s * Math.PI / 2); M.cyl('logend', 0.36, 0.0005, 12, { caps: 't', side: false }); M.restore(); }
    WORLD.col({ x0: 19.2, x1: 21.6, y0: 0, y1: 1.4, z0: -4.8, z1: 4.8 }, 'metal');
    WORLD.col({ x0: 19.05, x1: 21.75, y0: 0, y1: 3.5, z0: -0.4, z1: 0.4 }, 'metal');
  }
  for (const s of [1, -1]) {
    DECOR.place(PF.snowMound(2.2, 1.6, 0.7, 7 + s), 17.0, 0, s * 1.6, 0, { tint: [0.82, 0.66, 0.44] });
    WORLD.col({ x0: 16.3, x1: 17.7, y0: 0, y1: 0.5, z0: s * 1.6 - 0.5, z1: s * 1.6 + 0.5 }, 'dirt');
    DECOR.place(PF.lantern(), 16.0, H - 0.3, s * 5.4, 0, { nocol: true });
  }
}

/* ---------- Perimeter: cliff, tunnels, chalets of the east and of the ends of the valley ---------- */
function saintgivrePerimeter() {
  // west cliff (no fir at the foot of the landmark towers on the ledge)
  rockWall(-24, -64, 64, 15.5, 1, 1913, { clear: (x, z) => Math.abs(Math.abs(z) - GV_TOWER.z) < 3.5 && x > GV_TOWER.x - 4 });
  saintgivreTowers();
  // tunnel portals (tracks) at both ends, in the rock mass
  for (const s of [1, -1]) {
    const M = DECOR, zf = s * 48, x0 = -24, x1 = -10, cx = -17.3, w = 10.4, hA = 6.6;
    WORLD.col({ x0: x0 - 12, x1, y0: 0, y1: 16, z0: s > 0 ? zf + 0.4 : zf - 14, z1: s > 0 ? zf + 14 : zf - 0.4 }, 'concrete');
    // ashlar facing pierced by the arch, in the portal frame (local x from -7 to 7, facade toward the map)
    M.save().move(cx, 0, zf).rotY(s > 0 ? Math.PI : 0).move(-7, 0, -0.4);
    M.color([0.8, 0.79, 0.78]).world(1);
    wallPierced(M, 'ashlar', 14, 0, 10, [{ x0: 7 - w / 2, x1: 7 + w / 2, y0: 0, y1: hA, rise: 2.4, depth: 1.2, isClosed: true }], { depth: 1.2 }); // closed: doors in the south, avalanche in the north
    M.local(1); M.color([0.72, 0.71, 0.7]); lbox(M, 'ashlar', -0.2, 14.2, 10, 10.5, -0.1, 0.25);
    M.color([0.03, 0.03, 0.03]); M.quad('dark', [7 - w / 2, 0, -8], [7 + w / 2, 0, -8], [7 + w / 2, hA, -8], [7 - w / 2, hA, -8], [0, 0, 1]);
    M.boxB('dark', 7 - w / 2, 7 - w / 2 + 0.01, 0, hA, -8, -1.2); M.boxB('dark', 7 + w / 2 - 0.01, 7 + w / 2, 0, hA, -8, -1.2); M.boxB('dark', 7 - w / 2, 7 + w / 2, hA - 0.01, hA + 2.4, -8, -1.2);
    M.restore();
    // south: tunnel doors closed; north: avalanche flow blocking the entrance
    if (s > 0) {
      M.save().move(cx, 0, zf + 1.4).color([0.42, 0.28, 0.2]).local(1);
      for (const side of [-1, 1]) { M.boxB('paintwood', side < 0 ? -w / 2 : 0.02, side < 0 ? -0.02 : w / 2, 0, hA + 0.6, -0.1, 0.1); M.color([0.18, 0.18, 0.18]); for (const y of [0.8, 3.2, 5.6]) M.boxB('rust', side < 0 ? -w / 2 : 0.1, side < 0 ? -0.1 : w / 2, y, y + 0.16, 0.1, 0.16); M.color([0.42, 0.28, 0.2]); }
      M.restore();
    } else {
      for (const [x, z, w2, d2, h2, k] of [[-17.3, -49.5, 9.0, 6.0, 4.2, 1], [-14.2, -48.8, 4.5, 3.0, 1.6, 2], [-20.5, -48.6, 4.0, 2.8, 1.4, 3]]) { M.place(PF.snowMound(w2, d2, h2, k, 'ground'), x, 0, z, 0.3, { cls: 0 }); snowHeap(x, z, w2 * 0.75, d2 * 0.75, 0.3); }
      for (const [x, z, r] of [[-15.4, -48.7, 0.4], [-19.6, -48.9, 1.6]]) { M.save().move(x, 0.35, z).rotY(r).rotZ(Math.PI / 2 - 0.25); M.color([0.95, 0.95, 0.95]); M.cyl('bark', 0.18, 3.2, 7, { caps: '' }); M.restore(); }
    }
    // rock mass above and beside the portal, snow, firs
    const R = rngOf(s > 0 ? 71 : 72);
    for (let x = -23; x < -10.5; x += R.range(2.5, 3.6)) {
      const rx = Math.round(R.range(1.5, 2.4) * 4) / 4, ry = Math.round(R.range(1.4, 2.0) * 4) / 4, rz = Math.round(R.range(1.6, 2.4) * 4) / 4;
      M.place(PF.boulder(1 + Math.floor(R() * 12), rx, ry, rz), x, 9.6, zf + s * (Math.max(rx, rz) + 0.9 + R() * 1.5), R() * TAU, { nocol: true });
    }
    M.save().color([1, 1, 1]).world(1);
    M.boxB('snowmat', -26, -9.5, 14.2, 15.2, s > 0 ? zf + 1 : zf - 22, s > 0 ? zf + 22 : zf - 1, { bevel: 0.4 });
    M.restore();
    for (let k = 0; k < 6; k++) M.place(PF.spruce(Math.round(R.range(8, 12)), 1 + Math.floor(R() * 6)), R.range(-23, -11), 15.0, zf + s * R.range(4, 16), R() * TAU, { nocol: true });
  }
  // chalets of the east (facades toward the map) and of the ends of the valley (facades toward the bases)
  const R = rngOf(4747);
  for (let z = -60, k = 0; z < 60; k++) {
    const w = R.range(7.5, 11), h = R.range(6.4, 9.2) + (k % 2) * 0.06, d = R.range(8, 10); // two neighbors never at the same height: the undersides of their roofs crossed in the same plane
    // the back of the sawmill (x = 23.85, from z = -8.5 to 8.5, 4.2 m high) hides the ground floor of the chalets facing it: no poster behind
    chalet(24, 24 + d, z, Math.min(60, z + w), { h, ridge: R() < 0.5 ? 'x' : 'z', faces: 'w', lit: 0.35, balcony: true, noPoster: z < 8.5 && z + w > -8.5 });
    z += w;
  }
  for (const s of [1, -1]) {
    for (let x = -10; x < 24;) {
      const w = Math.min(24 - x, R.range(7, 10)), h = R.range(6.6, 9.0), z0 = s > 0 ? 48 : -48 - 9, z1 = s > 0 ? 48 + 9 : -48;
      chalet(x, x + w, z0, z1, { h, ridge: R() < 0.5 ? 'x' : 'z', faces: s > 0 ? 'n' : 's', lit: 0.35, balcony: true });
      x += w;
    }
  }
}

/* ---------- High landmarks on the west cliff ledge (map workshop, October 2026; sketch val-blanc-redesign-b.js) ----------
   One tower per half, same size (3.4 m on a side, top around 29 m): the pair is seen from 72% of the ground, declared landmarks included (46.9%
   before). In the south (Alpha), the pass chapel's bell tower, clock turned toward the valley, slate spire; in the north (Bravo), the
   old fort's watchtower, battlements and flag: you know which side you are on by looking up. Out of play (the top of the rock is at
   15.5 m); collisions stop shots, open where the bell tower is openwork. */
const GV_TOWER = { x: -30.5, z: 40, hw: 1.7, y0: 14.0 };
function saintgivreTowers() {
  const M = DECOR, T = GV_TOWER;
  for (const s of [1, -1]) {
    const zc = s * T.z, x0 = T.x - T.hw, x1 = T.x + T.hw, z0 = zc - T.hw, z1 = zc + T.hw, bell = s > 0;
    const mat = bell ? 'ashlar' : 'stone', tint = bell ? [0.9, 0.87, 0.81] : [0.7, 0.7, 0.72], top = bell ? 24.8 : 25.6;
    M.save().color(tint).world(1);
    // plinth (battered for the fort), shaft, band
    M.boxB(mat, x0 - (bell ? 0.2 : 0.4), x1 + (bell ? 0.2 : 0.4), T.y0, T.y0 + 3.0, z0 - (bell ? 0.2 : 0.4), z1 + (bell ? 0.2 : 0.4), { skip: 'y' });
    M.boxB(mat, x0, x1, T.y0 + 3.0, top, z0, z1, { skip: 'y' });
    M.color(bell ? [0.84, 0.8, 0.74] : [0.62, 0.62, 0.64]);
    M.boxB(mat, x0 - 0.12, x1 + 0.12, 20.4, 20.7, z0 - 0.12, z1 + 0.12, { bevel: 0.03 });
    M.restore();
    // slits (arrow slits of the fort, openings of the bell tower) on the faces turned toward the map
    M.save().color([0.05, 0.05, 0.05]).world(1);
    for (const y of bell ? [17.6] : [17.4, 22.4]) {
      M.quad('dark', [x1 + 0.01, y, zc - 0.12], [x1 + 0.01, y, zc + 0.12], [x1 + 0.01, y + 1.1, zc + 0.12], [x1 + 0.01, y + 1.1, zc - 0.12], [1, 0, 0]);
      const zf = s > 0 ? z0 - 0.01 : z1 + 0.01, n = s > 0 ? -1 : 1;
      M.quad('dark', [T.x - 0.12, y, zf], [T.x + 0.12, y, zf], [T.x + 0.12, y + 1.1, zf], [T.x - 0.12, y + 1.1, zf], [0, 0, n]);
    }
    M.restore();
    WORLD.col({ x0: x0, x1: x1, y0: T.y0, y1: top, z0: z0, z1: z1 }, 'concrete');
    if (bell) {
      // clock on the east face (toward the valley), in a stone frame
      M.save().move(x1, 22.4, zc).rotY(Math.PI / 2).color([0.8, 0.76, 0.7]).local(1);
      M.boxB('ashlar', -0.95, 0.95, -0.95, 0.95, 0, 0.06);
      M.color([0.95, 0.94, 0.9]); M.save().move(0, 0, 0.06).rotX(Math.PI / 2); M.cyl('paint', 0.82, 0.02, 24); M.restore();
      wallDecal2(M, DEC2.clock, 0, -0.78, 1.56, 1.56, 0.09);
      M.restore();
      // bell chamber: cornice, four corner piers, lintel, bell; slate spire and cross
      const b0 = top, b1 = top + 2.3, p = 0.7;
      M.save().color(tint).world(1);
      M.boxB('ashlar', x0 - 0.15, x1 + 0.15, b0, b0 + 0.3, z0 - 0.15, z1 + 0.15, { bevel: 0.03 });
      for (const [px, pz] of [[x0, z0], [x1 - p, z0], [x0, z1 - p], [x1 - p, z1 - p]]) { M.boxB('ashlar', px, px + p, b0 + 0.3, b1, pz, pz + p); WORLD.col({ x0: px, x1: px + p, y0: b0 + 0.3, y1: b1, z0: pz, z1: pz + p }, 'concrete'); }
      M.boxB('ashlar', x0 - 0.15, x1 + 0.15, b1, b1 + 0.4, z0 - 0.15, z1 + 0.15, { bevel: 0.03 });
      M.restore();
      WORLD.col({ x0: x0 - 0.15, x1: x1 + 0.15, y0: b0, y1: b0 + 0.3, z0: z0 - 0.15, z1: z1 + 0.15 }, 'concrete');
      WORLD.col({ x0: x0 - 0.15, x1: x1 + 0.15, y0: b1, y1: b1 + 0.4, z0: z0 - 0.15, z1: z1 + 0.15 }, 'concrete');
      M.save().move(T.x, b0 + 0.6, zc).color([0.5, 0.38, 0.18]).local(1);
      M.lathe('steel', [[0, 1.25], [0.16, 1.25], [0.3, 1.1], [0.36, 0.6], [0.5, 0.12], [0.56, 0], [0.5, 0.0], [0, 0.05]], 16, { sharp: 0.5 });
      M.color([0.2, 0.18, 0.16]); M.boxB('wood', -1.0, 1.0, 1.25, 1.45, -0.12, 0.12);
      M.restore();
      const sp = b1 + 0.4;
      M.save().move(T.x, sp, zc).rotY(Math.PI / 4).color([0.5, 0.52, 0.58]).local(1);
      M.lathe('slate', [[0, 0], [2.55, 0], [2.4, 0.25], [0.06, 4.9], [0, 5.0]], 4, { sharp: 1 });
      M.restore();
      WORLD.col({ x0: T.x - 0.8, x1: T.x + 0.8, y0: sp, y1: sp + 2.4, z0: zc - 0.8, z1: zc + 0.8 }, 'concrete');
      M.save().move(T.x, sp + 5.0, zc).color([0.2, 0.2, 0.2]).local(1);
      M.cyl('steel', 0.04, 1.3, 6); M.boxB('steel', -0.04, 0.04, 0.8, 0.88, -0.35, 0.35);
      M.restore();
    } else {
      // watchtower: machicolations on corbels, crenellated parapet, mast and flag
      const c0 = top, c1 = top + 0.45, e = 0.3, q0 = x0 - e, q1 = x1 + e, r0 = z0 - e, r1 = z1 + e, w = 0.35;
      M.save().color([0.66, 0.66, 0.68]).world(1);
      for (let a = x0 + 0.2; a < x1 - 0.1; a += 0.62) for (const zz of [z0 - e, z1]) M.boxB('stone', a, a + 0.28, c0 - 0.5, c0, zz, zz + e);
      for (let a = z0 + 0.2; a < z1 - 0.1; a += 0.62) for (const xx of [x0 - e, x1]) M.boxB('stone', xx, xx + e, c0 - 0.5, c0, a, a + 0.28);
      M.boxB('stone', q0, q1, c0, c1, r0, r1, { bevel: 0.03 });
      const P = c1 + 0.8, seaside = 0.55;
      for (const [a0, a1, b0, b1] of [[q0, q1, r0, r0 + w], [q0, q1, r1 - w, r1], [q0, q0 + w, r0 + w, r1 - w], [q1 - w, q1, r0 + w, r1 - w]]) {
        M.boxB('stone', a0, a1, c1, P, b0, b1);
        const alongX = a1 - a0 > b1 - b0, L = alongX ? a1 - a0 : b1 - b0, n = Math.max(2, Math.round(L / 1.0));
        for (let i = 0; i < n; i += 1) { if (i % 2) continue; const t0 = i / n, t1 = (i + 1) / n;
          if (alongX) M.boxB('stone', lerp(a0, a1, t0), lerp(a0, a1, t1), P, P + seaside, b0, b1); else M.boxB('stone', a0, a1, P, P + seaside, lerp(b0, b1, t0), lerp(b0, b1, t1)); }
      }
      M.restore();
      WORLD.col({ x0: q0, x1: q1, y0: c0, y1: P, z0: r0, z1: r1 }, 'concrete');
      M.save().move(T.x, c1, zc).color([0.22, 0.22, 0.22]).local(1);
      M.cyl('steel', 0.06, 5.2, 8);
      M.restore();
      // plain dark green flag (neither a team's colors nor a country's)
      M.save().move(T.x + 0.06, c1 + 3.6, zc).color([0.1, 0.3, 0.2]).local(1);
      clothPiece(M, [0, 0, 0], [2.16, 0, 0], [2.16, 1.4, 0], [0, 1.4, 0], [0, 0, 1], { hoist: true, clothKind: 'flagCloth', grp: 'flagCloth' + T.x + ',' + zc }); // flutters (simulated cloth, 02mc-cloths.js)
      M.restore();
    }
  }
}

/* ---------- Valley floor: mountains, forests, hamlets, onion-dome church ---------- */
function saintgivreBackdrop() {
  mountainRing(78, 235, 105, 2207, { k: 1.25, west: 26, trees: 520 });
  const R = rngOf(909), M = DECOR;
  WORLD.force = 'far';
  // valley forest (near the houses) and hamlets
  for (let i = 0; i < 220; i++) {
    const a = R() * TAU, d = R.range(52, 95), x = Math.cos(a) * d, z = Math.sin(a) * d * 1.25;
    if (x < -30 || (Math.abs(z) < 60 && x < 40)) continue;
    farTree(M, x, 0, z, R.range(8, 15), R() * TAU);
  }
  for (let i = 0; i < 26; i++) {
    const a = R() * TAU, d = R.range(50, 90), x = Math.cos(a) * d, z = Math.sin(a) * d * 1.3;
    if (x < -28 || (Math.abs(z) < 62 && x < 38)) continue;
    farChalet(x, z, R.range(7, 11), R.range(6, 9), R.range(5.5, 8), Math.round(R() * 4) * Math.PI / 2 + R.range(-0.2, 0.2), R);
  }
  // church with an onion-dome bell tower, east of the valley
  {
    const cx = 64, cz = 30;
    M.save().move(cx, 0, cz).color([0.95, 0.93, 0.88]).world(1);
    M.boxB('plaster', -5, 5, 0, 8, -9, 9, { skip: 'y' });
    M.boxB('plaster', -2.4, 2.4, 0, 19, -13.4, -8.6);
    M.local(1); M.color([0.06, 0.06, 0.06]);
    for (const z of [-5, 0, 5]) for (const s of [-1, 1]) M.quad('dark', [s * 5.01, 3, z - 0.6], [s * 5.01, 3, z + 0.6], [s * 5.01, 6.2, z + 0.6], [s * 5.01, 6.2, z - 0.6], [s, 0, 0]);
    M.color([0.25, 0.42, 0.36]); M.save().move(0, 19, -11); M.lathe('paint', [[0, 0], [2.6, 0], [2.7, 0.4], [2.2, 1.6], [2.9, 3.2], [2.0, 4.6], [0.6, 5.6], [0.25, 6.4], [0.25, 7.2], [0, 7.4]], 16, { sharp: 0.9 }); M.restore();
    M.color([0.85, 0.7, 0.3]); M.save().move(0, 26.4, -11); M.cyl('steel', 0.06, 1.6, 6); M.boxB('steel', -0.5, 0.5, 1.1, 1.2, -0.05, 0.05); M.restore();
    M.color([0.06, 0.06, 0.06]); M.save().move(0, 15, -13.41); M.cyl('dark', 0.9, 0.02, 16); M.restore();
    M.restore();
    M.save().move(cx - 5, 0, cz - 9); alpineRoofLocal(M, 10, 18, 8, R); M.restore();
  }
  WORLD.force = null;
}

/* ---------- Ground: fresh snow, packed snow in the passages, cleared roadway, yard cobbles ---------- */
function saintgivreGround() {
  const S = SPLAT, W = S.w * S.ppm, H = S.d * S.ppm, px = new Float32Array(W * H * 4), N = makeNoise(1847);
  const zone = (ch, x0, x1, z0, z1, soft = 0.8, k = 1) => {
    const i0 = Math.max(0, Math.floor((x0 - soft - S.x0) * S.ppm)), i1 = Math.min(W - 1, Math.ceil((x1 + soft - S.x0) * S.ppm));
    const j0 = Math.max(0, Math.floor((z0 - soft - S.z0) * S.ppm)), j1 = Math.min(H - 1, Math.ceil((z1 + soft - S.z0) * S.ppm));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = S.x0 + (i + 0.5) / S.ppm, z = S.z0 + (j + 0.5) / S.ppm;
      const d = Math.min(x - x0, x1 - x, z - z0, z1 - z) + (N.fbm(x * 0.09, z * 0.09, 32, 32, 3) - 0.5) * 1.8;
      const w = smoothstep(-soft, soft, d) * k, o = (j * W + i) * 4;
      px[o + ch] = Math.max(px[o + ch], w);
    }
  };
  // packed snow: paths, alleys, yards, bases; cleared roadway in the middle of the Grand-Rue; yard cobbles
  zone(0, -24, 24, 37, 48, 1.5, 0.85); zone(0, -24, 24, -48, -37, 1.5, 0.85);
  zone(0, -24, -22.2, -48, 48, 0.6, 0.7);
  zone(0, -3.2, 5.2, -40, 40, 0.8, 0.9);
  zone(0, 11, 15.2, -38, 38, 0.8, 0.9); zone(0, 15, 24, 18, 23.3, 0.8, 0.85); zone(0, 15, 24, -23.3, -18, 0.8, 0.85); zone(0, 21, 24, 23, 38, 0.6, 0.8); zone(0, 21, 24, -38, -23, 0.6, 0.8);
  zone(0, -9, -3, 20, 24, 0.6, 0.85); zone(0, -9, -3, -24, -20, 0.6, 0.85); zone(0, -9, 5, 29, 38, 1, 0.8); zone(0, -9, 5, -38, -29, 1, 0.8);
  zone(0, 11, 24, -8.5, 8.5, 0.5, 1); zone(3, 12.3, 24, -8.5, 8.5, 0.4, 0.75);
  zone(2, -0.5, 2.5, -38, 38, 0.5, 0.75); zone(3, -0.8, 2.8, -38, 38, 1.0, 0.55);
  zone(1, 5, 12, -9, 9, 0.5, 0.9); zone(1, -3, 5, 7, 9.5, 0.5, 0.9); zone(1, -3, 5, -9.5, -7, 0.5, 0.9);
  // under the gallery roofs: dark gravelly ground
  zone(0, -24, -22.2, -9.6, 9.6, 0.3, 1); zone(3, -24, -22.2, -9.6, 9.6, 0.3, 0.9);
  // wall mask then distance to the wall (drifts)
  const wall = new Float32Array(W * H).fill(1e4);
  for (const c of COL) {
    if (c.ray || c.y0 > 0.3 || c.y1 < 1.0) continue;
    const i0 = Math.max(0, Math.floor((c.x0 - S.x0) * S.ppm)), i1 = Math.min(W - 1, Math.ceil((c.x1 - S.x0) * S.ppm) - 1);
    const j0 = Math.max(0, Math.floor((c.z0 - S.z0) * S.ppm)), j1 = Math.min(H - 1, Math.ceil((c.z1 - S.z0) * S.ppm) - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) wall[j * W + i] = 0;
  }
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = j * W + i; let v = wall[k]; if (i > 0) v = Math.min(v, wall[k - 1] + 3); if (j > 0) v = Math.min(v, wall[k - W] + 3); if (i > 0 && j > 0) v = Math.min(v, wall[k - W - 1] + 4); if (i < W - 1 && j > 0) v = Math.min(v, wall[k - W + 1] + 4); wall[k] = v; }
  for (let j = H - 1; j >= 0; j--) for (let i = W - 1; i >= 0; i--) { const k = j * W + i; let v = wall[k]; if (i < W - 1) v = Math.min(v, wall[k + 1] + 3); if (j < H - 1) v = Math.min(v, wall[k + W] + 3); if (i < W - 1 && j < H - 1) v = Math.min(v, wall[k + W + 1] + 4); if (i > 0 && j < H - 1) v = Math.min(v, wall[k + W - 1] + 4); wall[k] = v; }
  // fine masks (10 cm) of ground objects and roofs, drawn from the collisions (the query index is built
  // only after the plan): no fresh snow under a roof, no drift on an object
  const F = { x0: -26, z0: -50, ppm: 10, w: 520, d: 1000 }, block = new Uint8Array(F.w * F.d), roof = new Uint8Array(F.w * F.d);
  const mark = (a, x0, x1, z0, z1) => {
    const i0 = Math.max(0, Math.floor((x0 - F.x0) * F.ppm)), i1 = Math.min(F.w - 1, Math.floor((x1 - F.x0) * F.ppm));
    const j0 = Math.max(0, Math.floor((z0 - F.z0) * F.ppm)), j1 = Math.min(F.d - 1, Math.floor((z1 - F.z0) * F.ppm));
    for (let j = j0; j <= j1; j++) a.fill(1, j * F.w + i0, j * F.w + i1 + 1);
  };
  for (const c of COL) {
    if (c.ray) continue;
    if (c.y0 < 0.3 && c.y1 > 0.02) mark(block, c.x0 - 0.06, c.x1 + 0.06, c.z0 - 0.06, c.z1 + 0.06);
    if (c.y0 >= 2.2 && c.y0 < 9) mark(roof, c.x0 - 0.5, c.x1 + 0.5, c.z0 - 0.5, c.z1 + 0.5);
  }
  for (const r of RAMPS) mark(block, r.x0 - 0.2, r.x1 + 0.2, r.z0 - 0.2, r.z1 + 0.2);
  const fine = (x, zz) => { const i = Math.floor((x - F.x0) * F.ppm), j = Math.floor((zz - F.z0) * F.ppm); return i < 0 || j < 0 || i >= F.w || j >= F.d ? -1 : j * F.w + i; };
  const out = new Uint8Array(W * H * 4);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, o = k * 4, x = S.x0 + (i + 0.5) / S.ppm, z = S.z0 + (j + 0.5) / S.ppm, dw = wall[k] / 3 / S.ppm;
    const n = N.fbm(x * 0.05 + 3.1, z * 0.05, 32, 32, 3), n2 = N.fbm(x * 0.21, z * 0.21 + 7.7, 32, 32, 2);
    // fresh snow takes over again at the foot of the walls (drifts) and in patches
    const f = fine(x, z), under = f >= 0 && roof[f];
    let fresh = under ? 0 : Math.max((1 - smoothstep(0.15, 0.9 + n * 0.8, dw)) * 0.85, smoothstep(0.66, 0.8, n + (n2 - 0.5) * 0.3) * 0.7);
    if (!under) for (const hp of SNOW_HEAPS) { const dx = x - hp.x, dz = z - hp.z; if (Math.abs(dx) > hp.rx + hp.rz + 1 || Math.abs(dz) > hp.rx + hp.rz + 1) continue; const c = Math.cos(hp.rot), sn = Math.sin(hp.rot), lx = dx * c - dz * sn, lz = dx * sn + dz * c, q = hyp(lx / (hp.rx + 0.7), lz / (hp.rz + 0.7)); fresh = Math.max(fresh, 1 - smoothstep(0.55 + n2 * 0.2, 1.0, q)); } // snow heaps: fresh snow underneath and around
    let r = px[o], g = px[o + 1], b = px[o + 2], a = px[o + 3];
    if (under) { r = Math.max(r, 0.9); a = Math.max(a, 0.55); } // under a roof: packed, dirty ground
    b *= 1 - g; r *= 1 - b * 0.6;
    const keep = 1 - fresh;
    out[o] = Math.round(clamp(r * keep, 0, 1) * 255); out[o + 1] = Math.round(clamp(g * keep, 0, 1) * 255); out[o + 2] = Math.round(clamp(b * keep, 0, 1) * 255);
    out[o + 3] = Math.round(clamp(a * (0.35 + n2 * 0.6) * keep, 0, 1) * 255);
  }
  const t = new THREE.DataTexture(out, W, H, THREE.RGBAFormat); t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  MAT.ground = groundMat(t, [S.x0, S.z0, S.w, S.d], GROUND_SAINTGIVRE);
  const M = DECOR; WORLD.force = 'g';
  M.save().color([1, 1, 1]).local(1); M.aoFn = null;
  M.plane('ground', 330, 330, 1, 1);
  M.restore(); WORLD.force = null;
  const cellAt = (x, zz) => { const i = Math.floor((x - S.x0) * S.ppm), j = Math.floor((zz - S.z0) * S.ppm); return i < 0 || j < 0 || i >= W || j >= H ? -1 : j * W + i; };
  const walls = COL.filter((c) => !c.ray && c.y0 <= 0.3 && c.y1 >= 1.0 && c.x1 > -25 && c.x0 < 25 && Math.abs(c.z0) < 49);
  // drifts against the walls, where the snow is fresh
  sandDrifts(walls, (x, zz) => {
    const k = cellAt(x, zz), f = fine(x, zz); if (k < 0 || f < 0 || roof[f]) return 0;
    const o = k * 4, fresh = 1 - (out[o] + out[o + 1] + out[o + 2]) / 255;
    return smoothstep(0.55, 0.9, fresh) * (0.12 + 0.3 * smoothstep(0.3, 0.8, N(x * 0.45 + 17, zz * 0.45, 256, 256)));
  }, (x, zz) => { const f = fine(x, zz); return f >= 0 && !block[f]; });
  WORLD.dressing = { drifts: true };
  SNOW_HEAPS.length = 0;
}

/* ---------- Map definition (see MAP_DEFS in 02-map.js and 02z-load.js) ---------- */
MAP_DEFS.saintgivre = {
  type: 'mid', // medium, tight and winding: README "Map design rules"; sets the bots' weapon choice (botArmForMap)
  bounds: { x0: -24, x1: 24, z0: -48, z1: 48 },
  textures: ['plaster', 'stone', 'cobble', 'pavers', 'asphalt', 'wood', 'shutter', 'snow', 'snowpack', 'rock', 'boards', 'slate', 'barkw', 'ashlar', 'concrete', 'canvas', 'rust', 'steel', 'paintwood', 'burlap', 'timber'],
  surfaces: ['ripple'], // all scenery water (pondAdd) needs it
  // recorded ambience (05c-ambiance.js): cold mountain wind and its gusts, bell of the valley church, crows, rafters creaking in the cold, snow sliding off a roof
  sound: { pack: 'amb_saintgivre', bed: 0.42, spots: [
    { id: 'a_gust', every: [9, 22], gain: 0.45, dist: [4, 12], y: [3, 8] },
    { id: 'a_bell', every: [70, 150], gain: 0.5, at: () => new V3(64, 20, 19), ref: 25, roll: 0.6 },
    { id: 'a_crow', every: [25, 60], gain: 0.3, dist: [40, 100], y: [8, 20] },
    { id: 'a_creak', every: [18, 45], gain: 0.25, dist: [8, 25], y: [1, 5] },
    { id: 'a_snowfall', every: [30, 70], gain: 0.3, dist: [8, 25], y: [3, 7] },
  ] },
  winter: true, // surfaces, atlases and materials of the winter kit (02i-winter.js)
  // menu illustration (tools/dev/illustrations.js): the Grand-Rue under the snow, at the foot of the Gare and its clock
  art: { cam: [-0.6, 1.9, 20.5], look: [-0.1, 3.8, 4], fov: 60 },
  splat: { x0: -50, z0: -74, w: 100, d: 148, ppm: 4 },
  far: 330,
  build() { saintgivreLevel(); },
  // spawns of team Alpha (south); those of Bravo are the mirror
  // the first row in the west moved back: 87.4 m of walking from one camp to the other (at least 90). Blizzard workshop (November 2026): without
  // the car, the Cour de la gare lets you walk straight from one alley to the other (86.7 m): the east front row moves back 1.2 to 2.8 m, and
  // the spawn at the foot of the truck goes behind it (from 4.6, 42.9, past the customs booth, it saw the new A)
  spawns: [[-15.5, 43.5], [-15.5, 46], [-10.5, 42.5], [-11.5, 45.5], [-8.5, 44.5], [0.5, 41.8],
            [3.4, 45.4], [6.5, 46.6], [13.6, 44.6], [15.5, 46.5], [21.0, 43.4], [20.5, 46.2]],
  /* Bot points of interest: [x, y, z, route, hold]; route L (Voies, platform), M (Gare, Grand-Rue, hall, hotel), E (Village, sawmill).
     Held in the hall: the two low windows onto B (3.9, ±1.7) */
  poi: [
    [-15.2, 0.16, 30, 'L'], [-15.2, 0.16, -30, 'L'], [-22.9, 0, 18, 'L'], [-22.9, 0, -18, 'L'], [-15.4, 0.16, 4, 'L', 1], [-15.4, 0.16, -4, 'L', 1],
    [-6.8, 3.4, 26.8, 'L', 1], [-6.8, 3.4, -26.8, 'L', 1], [-10.6, 0.4, 14, 'L'], [-10.6, 0.4, -14, 'L'], [-10.4, 0.4, 4.2, 'L', 1], [-10.4, 0.4, -4.2, 'L', 1],
    [-6.0, 0, 13.8, 'M'], [-6.0, 0, -13.8, 'M'], [-0.8, 0, 16, 'M'], [-0.8, 0, -16, 'M'], [-5.6, 0, 4.6, 'M', 1], [-5.6, 0, -4.6, 'M', 1], [3.9, 0, 1.7, 'M', 1], [3.9, 0, -1.7, 'M', 1],
    [7.8, 0, 15.2, 'M'], [7.8, 0, -15.2, 'M'], [1.0, 0, 30, 'M'], [1.0, 0, -30, 'M'], [8.6, 0, 2.8, 'M', 1], [8.6, 0, -2.8, 'M', 1],
    [13.0, 0, 15, 'E'], [13.0, 0, -15, 'E'], [19.5, 0, 22.2, 'E'], [19.5, 0, -22.2, 'E'], [18.4, 0, 26.5, 'E'], [18.4, 0, -26.5, 'E'], [14.4, 2.8, 24.6, 'E', 1], [14.4, 2.8, -24.6, 'E', 1],
    [17.0, 0, 4.4, 'E', 1], [17.0, 0, -4.4, 'E', 1], [22.4, 0, 2.0, 'E', 1], [22.4, 0, -2.0, 'E', 1], [22.4, 0, 34, 'E'], [22.4, 0, -34, 'E'],
  ],
  // domination: A and C in the border post yard, at the foot of the Poste d'aiguillage, on the approach to each base (at the center of a cell of
  // the navigation, so that A and C measure the same); B in the Cour de la gare, between the plank stacks. Blizzard workshop (November 2026):
  // A, placed by the owner with the zones tool (?tool=zones, October 2026) east of the Grand-Rue at (9, 36.5), was 17 m from its base and seen
  // from 9 of its 12 spawns, while C was 22 m away and hidden: A is now the mirror of C. B leaves the hall for the yard, so that the East route
  // (Village, Scierie) keeps a point to fight over and the center fight happens outside, in the storm; the hall becomes its covered approach
  dom: [[-11.5, 33.5], [8.4, 0], [-11.5, -33.5]],
  mecha: [[-0.5, -16.5], [-0.5, 15.5], [-20.5, 15.5], [-20.5, -16.5]], // mecha drop zones (08f-mecha.js, mnavZones), placed likewise
  lane: (x) => (x < -9 ? 'L' : x > 11 ? 'E' : 'M'),
  sniper: [-6.8, 3.4, 26.8], // signal box cabin (z on the side of its base)
  // landmarks for orientation (measured by tools/dev/visual/leveldesign.js): on the cliff, the bell tower (south) and the fort tower (north); the
  // great roof of the station in the center, its clocks, the ridge of the Hôtel des Cimes and the lit fir tree of the Placette, one of each per half
  landmarks: [[-30.5, 29, 40, 'south bell tower'], [-30.5, 29, -40, 'north fort tower'], [-2, 12.9, 0, 'station roof'], [-2, 9.9, 7.02, 'south clock'], [-2, 9.9, -7.02, 'north clock'], [8, 12.4, 15, 'Hôtel des Cimes south'], [8, 12.4, -15, 'Hôtel des Cimes north'], [20.6, 5.0, 20.6, 'south fir'], [20.6, 5.0, -20.6, 'north fir']],
  coverZ: 40,
  heli: [21, 46],
  cam: 40,
  // not in the snow outside; under a roof (hall, freight hall, hotel, gallery, sawmill), hard ground
  surface: (p) => (ceilingAbove(p.x, p.z, p.y + 0.1, 0.2) < p.y + 8 ? 'concrete' : 'snow'),
  zones: [
    [_t('Alpha Base'), -24, 24, 38, 48], [_t('Bravo Base'), -24, 24, -48, -38],
    [_t('Gallery'), -24, -12.2, -9.6, 9.6], ["Poste d'aiguillage", -9, -3, 24, 31], ["Poste d'aiguillage", -9, -3, -31, -24],
    [_t('Platform'), -12.3, -9, -38, 38], [_t('Tracks'), -24, -12.3, -38, 38],
    [_t('Station'), -9, 5, -7, 7], [_t('Freight hall'), -9, -3, 7, 20], [_t('Freight hall'), -9, -3, -20, -7],
    [_t('Hôtel des Cimes'), 5, 11, 9, 21], [_t('Hôtel des Cimes'), 5, 11, -21, -9], [_t('Station yard'), 5, 12.3, -9, 9],
    [_t('Alley'), 5, 11, 21, 25], [_t('Alley'), 5, 11, -25, -21], [_t('Bakery'), 5, 11, 25, 38], [_t('Bakery'), 5, 11, -38, -25],
    [_t('High Street'), -3, 5, -38, 38], [_t('Sawmill'), 12.3, 24, -8.5, 8.5],
    [_t('Barn'), 13, 21, 23, 32], [_t('Barn'), 13, 21, -32, -23], [_t('Square'), 15, 24, 18, 23], [_t('Square'), 15, 24, -23, -18],
    [_t('Passage'), -9, -3, 20, 24], [_t('Passage'), -9, -3, -24, -20], [_t('Border post yard'), -9, -3, 31, 38], [_t('Border post yard'), -9, -3, -38, -31],
    [_t('Village'), 11, 24, -38, 38],
  ],
  // no photographed sky since the blizzard (the night photo, kloppenheim_02, had stars and a moon): the computed sky, overcast, glows over the cliff
  vent: [1, 0.12], // blizzard from the west, over the cliff (snowfall, firs, flags; strength from atmo.wind)
  atmo: ATMO_SAINTGIVRE,
};
