/* ==========================================================================
   RED SAND, version 2: three-lane layout with a strong identity (inspired by the great classics like
   Dust_2), mirrored north-south for fairness in team deathmatch. 72 × 100 m.
   WEST "Long"      : long street with sight lines, cut in the center by the Portail.
                      Raised post (Balcon de la Maison) on each side.
   CENTER "Rue"  : paved street, center crossing by the Portes (ground level)
                      or the Passerelle (elevated, exposed).
   EAST "Hangar"    : close combat: hangar with shelves, container yard,
                      Goulet in the center (one container across, a lane on each side).
   Connections: Ruelle and Maison (Long ↔ Rue), Lantern alley at the center (Long ↔ Rue, November 2026),
   Passage (Rue ↔ East), covered Souk in the center (Rue ↔ East). Each base has three exits.
   Long north-south axis (Z). Team Alpha in the south (+Z), team Bravo in the north (-Z).
   The collisions are those of the original version (same boxes, same positions), apart from the two changes of the night version
   (November 2026: Lantern alley, Goulet): the scenery overhaul changes neither the sight lines nor the bots' navigation. The small added objects are placed against the walls
   or outside the passage zones.
   ========================================================================== */
const SR = { rng: null }; // draw of the accessories, restarted at the start of each build (same map for all peers)
const PASS_Y = 3.5; // deck of the Passerelle (2.3 m until October 2026: raised together with the souk doors, which open beneath it)
const DOORS_XS = -1.4; // end of the flat coping of the Portes wall: beyond it, the wall climbs gradually up to the Passerelle arch
/* Top course of the souk's west wall on the Passerelle side, at the height of the arch's impost. A jump rises 1.04 m and auto-step 0.45 m:
   from the railing (1 m on the deck), you gain a course up to 1.49 m higher, i.e. 6 m here. At 6.2 m, the wall can no longer be climbed over and
   neither can what sits on top of it (gables, arch) (tools/dev/visual/reachability.js). */
const SOUK_W = 6.2;
const LANT = [3.6, 6.4]; // Lantern alley through the west block (Long ↔ central Rue): |z| from one facade to the other
/* Moonlit night (ambience workshop, November 2026; a sunset until then): a high moon in the east-northeast, cold and white, lights
   the open streets in blue and casts short shadows; deep navy sky with a few thin clouds, a faint warm glow of the town on the
   horizon. The souk is lit: street lamps, wall lights, lanterns, two windows out of three. Ambient light and floor in shadow
   high enough to read a soldier in the dark corners, fog a dark blue that does not hide him under 40 m */
const ATMO_CHERGUI = Object.assign({}, ATMO_DEFAULT, {
  sun: [0.42, 0.78, -0.22], sunColor: 0x9db7ff, sunI: 0.45, vmSun: 0x9db7ff,
  fog: [0.035, 0.048, 0.085], fogD: 0.0095, fogSun: 0.25,
  hemi: [0x4a6498, 0x4a3c2a, 0.35], vmHemi: [0x4a6498, 0x4a3c2a],
  sky: Object.assign({}, ATMO_DEFAULT.sky, {
    zen: [0.004, 0.008, 0.026], mid: [0.016, 0.026, 0.07], hor: [0.055, 0.045, 0.042], gnd: [0.03, 0.03, 0.04],
    glow: [0.1, 0.12, 0.2], halo: [0.2, 0.23, 0.32], disk: [2.6, 2.8, 3.2], cloudLo: [0.025, 0.03, 0.055], cloudHi: [0.22, 0.25, 0.34], cloud: [0.58, 0.9, 0.55],
  }),
  envGround: 0x2a2630, hdri: null, lit: true, lamps: 1.7, winLit: 0.65,
  bounce: [0.1, 0.12, 0.18], motes: null,
  grade: { lo: [0.9, 0.97, 1.12], hi: [1.1, 1.0, 0.88], exp: 1.3, lift: 0.07 }, rays: [0.3, 0.35, 0.5],
  impact: [0.36, 0.33, 0.3], bloom: [0.6, 0.6, 0.85], aoFloor: 0.42, raysThr: 2.5, raysCap: 1, satExp: 0.7,
});
MAP_DEFS.chergui = {
  type: 'mid', // medium with three corridors (Long, Rue, Hangar): README "Map design rules"; sets the bots' weapon choice (botArmForMap)
  bounds: { x0: -36, x1: 36, z0: -50, z1: 50 },
  textures: ['plaster', 'plaster2', 'stone', 'brick', 'cobble', 'pavers', 'asphalt', 'rooftiles', 'wood', 'shutter', 'ashlar', 'concrete', 'crate', 'canvas', 'linen', 'cardboard', 'rollshutter', 'steel', 'paintwood', 'burlap', 'timber', 'palmbark'],
  surfaces: ['ripple', 'palmbark'], // the fountain water (pondAdd), the palm bark
  // recorded ambience (05c-ambiance.js): dry wind, gusts, dogs and a donkey in the distance, tarps in the wind, plaza fountain
  // (the rooster and the doves of the daytime version keep quiet at night)
  sound: { pack: 'amb_chergui', bed: 0.4, fountain: 0.35, spots: [
    { id: 'a_gust', every: [10, 24], gain: 0.4, dist: [4, 12], y: [2, 7] },
    { id: 'a_dog', every: [20, 50], gain: 0.35, dist: [60, 120], y: [0, 2] },
    { id: 'a_donkey', every: [45, 110], gain: 0.3, dist: [70, 130], y: [0, 2] },
    { id: 'a_cloth', every: [12, 30], gain: 0.3, dist: [6, 20], y: [2, 5] },
  ] },
  // menu illustration (tools/dev/illustrations.js): the Long alley by moonlight, toward the Portail arch
  art: { cam: [-32, 1.4, 41.4], look: [-29.6, 3.1, -10], fov: 58 },
  // landmarks for orientation (measured by tools/dev/visual/leveldesign.js): the two minarets behind the bases
  landmarks: [[-8, 33.6, 53, 'south minaret'], [-8, 33.6, -53, 'north minaret']], // the top of the dome and the spire (the silhouette you recognize)
  kit() { TEX.canvasCloth = soukCanvasTex(); }, // atlas of the souk's awnings
  // stretched awnings of the souk (02me-canvases.js): no back face, both sheets are in the mesh; same samplers as the signs
  materials(M) { M('canvasCloth', { tex: 'canvasCloth', rough: 0.92, env: 0.25, macro: 0.12, dust: 0.25, scale: 1, noNormal: true }); },
  build() { SR.rng = rngOf(1337); buildLevel(); buildWires(); },
  after() { buildLightBeams(); },
  // ground distribution map (4 px per meter)
  splat: { x0: -64, z0: -80, w: 128, d: 160, ppm: 4 },
  update(t) { updateBeams(t); },
  // spawns of team Alpha (south); those of Bravo are the mirror
  spawns: [[-30.5, 46], [-26, 48.5], [-12, 46.5], [-6, 48.5], [6, 48.5], [8, 43.5], [15.5, 47], [22, 44.5], [30, 46.5], [33, 48.5], [-30, 43.5], [-8.5, 43]], // at the center of a navigation cell
  /* Bot points of interest: [x, y, z, route, hold]. route L (Long), M (central Rue), E (East).
     The "hold" points are positions a player holds for a few seconds (balcony, walkway, souk...) */
  poi: [
    [-30, 0, 22, 'L'], [-30, 0, -22, 'L'], [-30, 0, 5, 'L'], [-30, 0, -5, 'L'], [-26.2, 0, 4.6, 'L', 1], [-26.2, 0, -4.6, 'L', 1],
    [-24.9, 3.5, 23, 'L', 1], [-24.9, 3.5, -23, 'L', 1], [-19, 0, 24, 'L'], [-19, 0, -24, 'L'], [-15, 0, 15.5, 'M'], [-15, 0, -15.5, 'M'],
    [-15, 0, 5, 'M'], [-15, 0, -5, 'M'], // Lantern alley
    [0, 0, 24, 'M'], [0, 0, -24, 'M'], [-2.8, 0, 5, 'M', 1], [-2.8, 0, -5, 'M', 1], [4.7, PASS_Y, 6, 'M', 1], [4.7, PASS_Y, -6, 'M', 1], [4.7, 0, 5, 'M'], [4.7, 0, -5, 'M'],
    [13, 0, 16, 'E'], [13, 0, -16, 'E'], [13, 0, 3, 'E', 1], [13, 0, -3, 'E', 1], [28, 0, 27, 'E'], [28, 0, -27, 'E'], [24, 0, 8, 'E'], [24, 0, -8, 'E'],
    [30.5, 0, 7, 'E', 1], [30.5, 0, -7, 'E', 1], [33.6, 0, 1.7, 'E', 1], [33.6, 0, -1.7, 'E', 1], // next to the crates, not on top
  ],
  // domination: A near Alpha's base and C near Bravo's, in the central street on the approach to their bases; B at the
  // center, in the covered souk (the middle of the central street, under the z = 0 arch, is not passable)
  dom: [[1, 31], [11, 0], [1, -31]],
  lane: (x) => (x < -12 ? 'L' : x > 6 ? 'E' : 'M'),
  sniper: [-24.9, 3.5, 23], // balcony held by the sniper (z on the side of his base)
  coverZ: 42,               // beyond (bases), no cover point
  heli: [34, 52],           // semi-axes of the support helicopter's ellipse
  cam: 46,                  // radius of the aerial view of the class selection
  surface: (p) => (Math.abs(p.z) > 40 ? 'dirt' : 'concrete'), // ground footstep noise
  zones: [
    [_t('Alpha Base'), -36, 36, 40, 50], [_t('Bravo Base'), -36, 36, -50, -40],
    [_t('Gate'), -36, -24, -3, 3], [_t('House'), -24, -14, 17, 30], [_t('House'), -24, -14, -30, -17], [_t('Balcony'), -25.6, -24, 20, 26], [_t('Balcony'), -25.6, -24, -26, -20],
    [_t('Long'), -36, -24, -40, 40], [_t('Alley'), -24, -6, 14, 17], [_t('Alley'), -24, -6, -17, -14],
    [_t('Lantern Alley'), -24, -6, LANT[0], LANT[1]], [_t('Lantern Alley'), -24, -6, -LANT[1], -LANT[0]],
    [_t('Doors'), -6, 3.5, -2.5, 2.5], [_t('Catwalk'), 3.5, 6, -14, 14], [_t('Main Street'), -6, 6, -40, 40],
    [_t('Souk'), 6, 20, -8, 8], [_t('Passage'), 6, 20, 14, 18], [_t('Passage'), 6, 20, -18, -14],
    [_t('Hangar'), 20, 36, 20, 34], [_t('Hangar'), 20, 36, -34, -20], [_t('Backyard'), 20, 36, 34, 40], [_t('Backyard'), 20, 36, -40, -34],
    [_t('Bottleneck'), 20, 36, -2, 2], [_t('Containers'), 20, 36, -20, 20],
  ],
  // computed night sky (the moon disc is the map's sun); the dusk photo (qwantani_dusk_2) until November 2026
  atmo: ATMO_CHERGUI,
};
const CRATE_TINTS = [[1, 1, 1], [0.88, 0.82, 0.72], [0.8, 0.84, 0.66]];

/* ---------- Placed accessories (original collisions) ---------- */
/* The wooden crates remain static blocks: they serve as cover and cut the sight lines */
/* Plank crate: a physical prop (see the `crate` type, 02k-dynprops.js) that keeps its previous collision as long as it has not been touched */
function crate(cx, y, cz, s = 1.1, rot = 0) { DECOR.dyn('crate', cx, y, cz, rot, { a: [s], tint: SR.rng.pick(CRATE_TINTS) }); }
function barrel(cx, cz, tint) {
  DECOR.dyn('barrel', cx, 0, cz, SR.rng() * TAU, { tint: tint || SR.rng.pick([[0.3, 0.42, 0.55], [0.55, 0.2, 0.15], [0.4, 0.45, 0.3], [0.7, 0.6, 0.3]]) });
}
const CAR_COLORS = [[0.78, 0.76, 0.72], [0.55, 0.12, 0.1], [0.22, 0.3, 0.42], [0.85, 0.82, 0.62], [0.3, 0.32, 0.3], [0.62, 0.6, 0.55]];
/* Parked car: model 'sedan', 'hatch' (city car), 'offroad' (4x4); o: { dust, rack }; burnt: burnt-out wreck. Collisions of the
   model (vehCols, 02g-vehicles.js): the body from bumper to bumper, the cabin in two tiers under the sloped glazing */
function car(cx, cz, rot, color, burnt, model = 'sedan', o = {}) {
  vehicle(PF.car(model, Object.assign({ wreck: !!burnt }, o)), cx, 0, cz, rot, { tint: burnt ? null : color || SR.rng.pick(CAR_COLORS) });
}
/* Sandbag wall along x or z: one physical prop per bag, in staggered rows (see "Physical props"); a bag holds as long as it
   is in place, shots shake it and end up bringing it down, along with those it carried. Other shapes: sandbagWall, sandbagArc,
   sandbagU, sandbagPile (02f-props.js) */
function sandbags(cx, cz, len, axis, rows = 4, y0 = 0, color) {
  const R = SR.rng, bl = 0.6, n = Math.max(1, Math.round(len / bl)), step = len / n, k = step / bl, dx = axis === 'x' ? 1 : 0, dz = axis === 'x' ? 0 : 1, rot = axis === 'x' ? 0 : Math.PI / 2;
  const W = rngOf(Math.round(cx * 131 + cz * 17 + len * 7 + 77)), fallen = [], base = color ? SANDBAG_TINT[color] : [0.95, 0.89, 0.77], top = rows - 1;
  // wear (sandbagWear): the top row is never complete, its ends mostly go; the bags that are gone often lie at the foot of the wall
  const wr = rows > 1 ? sandbagWear(n - (top % 2), top % 2 === 1, (top - 1) % 2 === 1, W) : null, fall = (x, z, type) => sandbagFallen(x, z, dx, dz, 0.2 * k, rot, () => y0, k, base, W, fallen, type);
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * step * 0.5;
    for (let i = 0; i < n - (r % 2); i++) {
      const a = -len / 2 + step * (i + 0.5) + off, j = (R() - 0.5) * 0.03, yj = (R() - 0.5) * 0.06; // (yj: the old draw of the bag's angle, which keeps the rest of the scenery unchanged)
      const x = axis === 'x' ? cx + a : cx + j, z = axis === 'x' ? cz + j : cz + a;
      const tint = color ? sandbagTint(SANDBAG_TINT[color], R) : [0.9 + R() * 0.1, 0.84 + R() * 0.1, 0.72 + R() * 0.1];
      if (wr && r === top && wr.gone.has(i)) { fall(x, z); continue; }
      DECOR.dyn('sandbag', x, y0 + r * 0.22 * k, z, rot + yj, { s: k, tint });
    }
    // a staggered row closes with two half-bags: without them, the bag at the end of the row above overhung by half a bag into the void
    if (r % 2) sandbagHalves(cx, cz, len, dx, dz, () => y0 + r * 0.22 * k, k, base, rngOf(Math.round(cx * 131 + cz * 17 + r * 7 + 5000)), wr ? (r === top ? wr.half : r === top - 1 ? wr.low : null) : null, fall);
  }
}
function jersey(cx, cz, len, axis) {
  DECOR.place(PF.jersey(len), cx, 0, cz, axis === 'x' ? Math.PI / 2 : 0, { nocol: true });
  const w = axis === 'x' ? len : 0.62, d = axis === 'x' ? 0.62 : len;
  WORLD.col({ x0: cx - w / 2 + 0.05, x1: cx + w / 2 - 0.05, y0: 0, y1: 0.87, z0: cz - d / 2 + 0.05, z1: cz + d / 2 - 0.05 }, 'concrete');
}
function container(cx, y, cz, axis, tint) {
  DECOR.place(PF.container(), cx, y, cz, axis === 'x' ? Math.PI / 2 : 0, { tint });
  const w = axis === 'x' ? 6.06 : 2.44, d = axis === 'x' ? 2.44 : 6.06;
  WORLD.col({ x0: cx - w / 2, x1: cx + w / 2, y0: y, y1: y + 2.6, z0: cz - d / 2, z1: cz + d / 2 }, 'metal');
}
function lampPost(cx, cz, dir) { DECOR.place(PF.lampPost(), cx, 0, cz, -dir); }
/* Truck parked along x or z (cab toward -z or -x): model 'army' (military with hood), 'cargo' (flatbed with side rails), 'box' (box van);
   o: { load, reefer, dust, wreck }; collisions of the model (truckCols, 02g-vehicles.js): chassis, hood in two steps, cab, bed */
function truck(cx, cz, axis, model = 'army', o = {}, tint = [0.42, 0.44, 0.32]) {
  vehicle(PF.truck(model, o), cx, 0, cz, axis === 'x' ? Math.PI / 2 : 0, { tint: o.wreck ? null : tint });
}
function tires(cx, cz, n) {
  for (let i = 0; i < n; i++) DECOR.dyn('tire', cx + (SR.rng() - 0.5) * 0.08, i * 0.2, cz, SR.rng() * TAU);
}
function dumpster(cx, cz, axis) {
  DECOR.place(PF.dumpster(), cx, 0, cz, axis === 'x' ? 0 : Math.PI / 2, { tint: [0.25, 0.42, 0.3] });
  const w = axis === 'x' ? 2 : 1.2, d = axis === 'x' ? 1.2 : 2;
  WORLD.col({ x0: cx - w / 2, x1: cx + w / 2, y0: 0.1, y1: 1.4, z0: cz - d / 2, z1: cz + d / 2 }, 'metal');
}
function palm(cx, cz, h = 7, kind = 'datePalm') { DECOR.place(PF.palm(h, Math.round(Math.abs(cx * 7 + cz * 3)) % 5, kind === 'datePalm' ? {} : { v: PALM_KINDS[kind] }), cx, 0, cz, 0); }
function shelf(x0, x1, z0, z1, h) {
  const alongX = x1 - x0 > z1 - z0, L = Math.max(x1 - x0, z1 - z0);
  DECOR.place(PF.rack(L), (x0 + x1) / 2, 0, (z0 + z1) / 2, alongX ? Math.PI / 2 : 0);
  WORLD.col({ x0, x1, y0: 0, y1: h, z0, z1 }, 'metal');
}
/* Market stall: table (original collision), posts, awning, goods */
function stall(cx, cz, axis) {
  const R = SR.rng, w = axis === 'x' ? 2.4 : 1.2, d = axis === 'x' ? 1.2 : 2.4;
  DECOR.place(PF.stall(R.pick(PAL.awning)), cx, 0, cz, axis === 'x' ? 0 : Math.PI / 2, { nocol: true });
  WORLD.col({ x0: cx - w / 2, x1: cx + w / 2, y0: 0, y1: 0.95, z0: cz - d / 2, z1: cz + d / 2 }, 'wood');
}
/* Masonry arch over an alley: barrel vault along x, from one wall to the other in z (z0 to z1);
   the collision remains the original box (y0 to y1) */
function alleyArch(x0, x1, z0, z1, y0, y1, tint) {
  WORLD.col({ x0, x1, y0, y1, z0, z1 }, 'concrete');
  const M = DECOR, span = z1 - z0, rise = 0.55, prof = [];
  const R = (span * span / 4 + rise * rise) / (2 * rise), cz = (z0 + z1) / 2;
  prof.push([z1, y1], [z0, y1]);
  // intrados: springings at y0 - rise against the walls, keystone at y0 in the middle
  for (let i = 0; i <= 12; i++) { const t = i / 12, z = lerp(z0, z1, t), dz = z - cz; prof.push([z, y0 - rise + Math.sqrt(Math.max(0, R * R - dz * dz)) - (R - rise)]); }
  // profile in the (z, y) plane, extruded along x
  M.save().color(tint).world(1).move(x0, 0, 0).mul(basis([0, 0, 1], [0, 1, 0], [1, 0, 0]).clone());
  M.extrude('plaster', prof.map(([z, y]) => [z, y]).reverse(), x1 - x0, { sharp: 0.5 });
  M.restore();
  M.save().color([0.86, 0.8, 0.7]).world(1);
  for (const x of [x0, x1]) M.boxB('ashlar', x - 0.02, x + 0.02, y1 - 0.2, y1, z0, z1);
  M.restore();
}

/* ---------- Ground ---------- */
/* Ground distribution map (4 px per meter): r cobbles, g paving, b asphalt, a earth; sand is the background.
   Sand accumulates at the foot of the walls and invades the edges of the cobbled areas. */
function paintGround() {
  const S = SPLAT, W = S.w * S.ppm, H = S.d * S.ppm, px = new Float32Array(W * H * 4), N = makeNoise(4242);
  // noises computed only once, at half resolution (patterns of several meters): edge of the areas, patches, detail
  const W2 = W >> 1, H2 = H >> 1, ne = new Float32Array(W2 * H2), n1a = new Float32Array(W2 * H2), n2a = new Float32Array(W2 * H2);
  for (let j = 0; j < H2; j++) for (let i = 0; i < W2; i++) {
    const x = S.x0 + (i * 2 + 1) / S.ppm, z = S.z0 + (j * 2 + 1) / S.ppm, k = j * W2 + i;
    ne[k] = N.fbm(x * 0.07, z * 0.07, 32, 32, 3); n1a[k] = N.fbm(x * 0.05, z * 0.05, 32, 32, 3); n2a[k] = N.fbm(x * 0.21 + 3.1, z * 0.21, 32, 32, 2);
  }
  const NE = { at: (i, j) => ne[(j >> 1) * W2 + (i >> 1)] };
  const zone = (ch, x0, x1, z0, z1, soft = 0.8, k = 1) => {
    const i0 = Math.max(0, Math.floor((x0 - soft - S.x0) * S.ppm)), i1 = Math.min(W - 1, Math.ceil((x1 + soft - S.x0) * S.ppm));
    const j0 = Math.max(0, Math.floor((z0 - soft - S.z0) * S.ppm)), j1 = Math.min(H - 1, Math.ceil((z1 + soft - S.z0) * S.ppm));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = S.x0 + (i + 0.5) / S.ppm, z = S.z0 + (j + 0.5) / S.ppm;
      const d = Math.min(x - x0, x1 - x, z - z0, z1 - z) + (NE.at(i, j) - 0.5) * 1.6;
      const w = smoothstep(-soft, soft, d) * k, o = (j * W + i) * 4;
      px[o + ch] = Math.max(px[o + ch], w);
    }
  };
  // asphalt everywhere inside the compound, then the areas
  zone(2, -44, 44, -58, 58, 1.5, 0.95);
  zone(3, -36, 36, 40, 58, 1.2); zone(3, -36, 36, -58, -40, 1.2);
  zone(0, -6, 6, -40, 40, 0.5); zone(0, -24, -6, 14, 17, 0.4); zone(0, -24, -6, -17, -14, 0.4);
  zone(0, -24, -6, LANT[0], LANT[1], 0.4); zone(0, -24, -6, -LANT[1], -LANT[0], 0.4);
  // paving curbs along the facades of the central street and the Long
  zone(1, -6, -5.35, -40, 40, 0.08); zone(1, 5.35, 6, -40, 40, 0.08); zone(1, -24.7, -24, -40, 40, 0.1, 0.8); zone(1, -36, -35.3, -40, 40, 0.1, 0.8);
  zone(1, 6, 20, 14, 18, 0.4); zone(1, 6, 20, -18, -14, 0.4);
  zone(1, 20, 36, 34, 40, 0.8, 0.9); zone(1, 20, 36, -40, -34, 0.8, 0.9);
  // mask of the walls (at ground level) then distance to the nearest wall (3-4 chamfer)
  const wall = new Float32Array(W * H).fill(1e4);
  for (const c of COL) {
    if (c.ray || c.y0 > 0.3 || c.y1 < 1.0) continue;
    const i0 = Math.max(0, Math.floor((c.x0 - S.x0) * S.ppm)), i1 = Math.min(W - 1, Math.ceil((c.x1 - S.x0) * S.ppm) - 1);
    const j0 = Math.max(0, Math.floor((c.z0 - S.z0) * S.ppm)), j1 = Math.min(H - 1, Math.ceil((c.z1 - S.z0) * S.ppm) - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) wall[j * W + i] = 0;
  }
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = j * W + i; let v = wall[k]; if (i > 0) v = Math.min(v, wall[k - 1] + 3); if (j > 0) v = Math.min(v, wall[k - W] + 3); if (i > 0 && j > 0) v = Math.min(v, wall[k - W - 1] + 4); if (i < W - 1 && j > 0) v = Math.min(v, wall[k - W + 1] + 4); wall[k] = v; }
  for (let j = H - 1; j >= 0; j--) for (let i = W - 1; i >= 0; i--) { const k = j * W + i; let v = wall[k]; if (i < W - 1) v = Math.min(v, wall[k + 1] + 3); if (j < H - 1) v = Math.min(v, wall[k + W] + 3); if (i < W - 1 && j < H - 1) v = Math.min(v, wall[k + W + 1] + 4); if (i > 0 && j < H - 1) v = Math.min(v, wall[k + W - 1] + 4); wall[k] = v; }
  const out = new Uint8Array(W * H * 4);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, o = k * 4;
    const dw = wall[k] / 3 / S.ppm; // meters
    const h2 = (j >> 1) * W2 + (i >> 1), n1 = n1a[h2], n2 = n2a[h2];
    // sand drifts at the foot of the walls and scattered patches of sand
    const drift = (1 - smoothstep(0.1, 1.1 + n1 * 1.4, dw)) * smoothstep(0.35, 0.6, n2 + 0.2);
    const patch = smoothstep(0.62, 0.75, n1 + (n2 - 0.5) * 0.3);
    const sand = clamp(Math.max(drift, patch * 0.85), 0, 1);
    let r = px[o], g = px[o + 1], b = px[o + 2], a = px[o + 3];
    const paved = Math.max(r, g);
    b *= 1 - paved; // the roadway gives way to cobbles and paving
    const keep = 1 - sand * (0.35 + 0.65 * (1 - smoothstep(0.35, 0.65, n2)));
    r *= keep; g *= keep; b *= keep * (1 - a * 0.9);
    out[o] = Math.round(clamp(r, 0, 1) * 255); out[o + 1] = Math.round(clamp(g, 0, 1) * 255); out[o + 2] = Math.round(clamp(b, 0, 1) * 255);
    out[o + 3] = Math.round(clamp(a * (0.25 + n2 * 0.55), 0, 1) * 255);
  }
  const t = new THREE.DataTexture(out, W, H, THREE.RGBAFormat); t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  S.wall = wall; S.mix = out; // reused by groundDressing, then released
  MAT.ground = groundMat(t, [S.x0, S.z0, S.w, S.d]);
  const M = DECOR; WORLD.force = 'g';
  M.save().color([1, 1, 1]).local(1); M.aoFn = null;
  M.plane('ground', 260, 260, 1, 1);
  M.restore(); WORLD.force = null;
}

/* ---------- Background: distant districts, minaret, dome, dunes ---------- */
function backdrop(R) {
  for (let i = 0; i < 70; i++) {
    const ang = R() * TAU, d = 90 + R() * 60, x = Math.cos(ang) * d * 0.85, z = Math.sin(ang) * d * 1.1;
    const h = 8 + Math.floor(R() * 7) * 3.2, w = 8 + R() * 14;
    farBuilding(x, z, w, w * (0.6 + R() * 0.8), h, R.pick(PAL.plaster), R);
  }
  minaret(62, -92, 36); domeHouse(-76, 104, 1.1); domeHouse(98, 40, 0.8);
  // landmarks (map workshop, October 2026): a minaret behind each base, on the rooftops of the compound (out of play), seen from 63%
  // of the ground; square with a green dome in the south (Alpha), round with a lead spire in the north (Bravo): you know which way you are looking
  minaret(-8, 53, 35, { col: true }); minaret(-8, -53, 35, { isRound: true });
  dunes();
}

/* ---------- Plan ---------- */
/* Obstructed facade doors (decor.js, map workshop, October 2026): a neighboring building, the base's tent or sandbags, a container,
   a hangar wall, barrels or crates in front. These bays remain solid walls (NO_DOOR, 02d-archi.js), with the same draws. The last two:
   the west block redrawn around the Lantern alley (November 2026), a door behind the crate of the Ruelle and one behind the low wall of the Long */
const CHERGUI_NO_DOOR = [[-36, -36.7], [-36, -26.4], [-36, -14.8], [-36, -17.9], [-36, 0.8], [-36, 10.8], [-36, 36.1], [36, -33.2], [-21.6, -50], [-18, -50], [-14.4, -50], [15, -50], [37, -50], [41.4, -50], [-35.6, 50], [-19.9, 50], [-15.9, 50], [28, 50], [42, 50], [38, 50], [-11.4, 14], [-6, 8.8], [-6, 35.1], [-22.3, 40], [-19, 40], [11.3, 14], [20, 19.6], [6, 22.7], [6, 29], [-11.4, -14], [-6, -8.7], [-24, -12.2], [-12, -17], [-6, -25.2], [20, -32.1], [6, -29], [6, -22.7], [-18.6, 14], [-24, 12.1]];
function buildLevel() {
  const R = rngOf(2024);
  NO_DOOR.length = 0; for (const [x, z] of CHERGUI_NO_DOOR) NO_DOOR.push([x - 0.4, x + 0.4, z - 0.4, z + 0.4]);
  // compound: facades facing inward
  const perimeter = (side) => {
    const horiz = side === 'n' || side === 's';
    const a0 = horiz ? -44 : -50, a1 = horiz ? 44 : 50;
    let a = a0;
    while (a < a1) {
      const w = Math.min(a1 - a, 6 + R() * 7), h = 7 + R() * 7;
      const key = R() < 0.18 ? 'brick' : 'plaster';
      let x0, x1, z0, z1, face;
      if (side === 'w') { x0 = -44; x1 = -36; z0 = a; z1 = a + w; face = 'e'; }
      if (side === 'e') { x0 = 36; x1 = 44; z0 = a; z1 = a + w; face = 'w'; }
      if (side === 'n') { x0 = a; x1 = a + w; z0 = -58; z1 = -50; face = 's'; }
      if (side === 's') { x0 = a; x1 = a + w; z0 = 50; z1 = 58; face = 'n'; }
      building(x0, x1, z0, z1, h, { tint: key === 'brick' ? [0.95, 0.72, 0.58] : R.pick(PAL.plaster), key, faces: face });
      a += w;
    }
  };
  perimeter('w'); perimeter('e'); perimeter('n'); perimeter('s');
  backdrop(R);
  for (const s of [1, -1]) half(s);
  center();
  dressing();
  paintGround(); // after the buildings: sand accumulates at the foot of the walls
  groundDressing();
  NO_DOOR.length = 0;
}

/* ---------- Ground dressing: scattered debris and drifts ----------
   Based on the distribution map (sand, cobbles, earth) and the distance to the wall: lots of debris at the foot of the walls,
   pebbles on the sand, almost nothing in the middle of the cobbled streets, barely a few scraps under a roof. Nothing on objects
   or stairs. No collision: the game is unchanged. Everything is drawn from a fixed seed (same debris for all
   the players of a lobby). */
function groundDressing() {
  const S = SPLAT, W = S.w * S.ppm, H = S.d * S.ppm;
  // fine masks (10 cm): occupied at ground level (objects, walls, stairs), under a roof
  const F = { x0: -46, z0: -60, ppm: 10, w: 920, d: 1200 }, block = new Uint8Array(F.w * F.d), roof = new Uint8Array(F.w * F.d);
  const mark = (a, x0, x1, z0, z1) => {
    const i0 = Math.max(0, Math.floor((x0 - F.x0) * F.ppm)), i1 = Math.min(F.w - 1, Math.floor((x1 - F.x0) * F.ppm));
    const j0 = Math.max(0, Math.floor((z0 - F.z0) * F.ppm)), j1 = Math.min(F.d - 1, Math.floor((z1 - F.z0) * F.ppm));
    for (let j = j0; j <= j1; j++) a.fill(1, j * F.w + i0, j * F.w + i1 + 1);
  };
  for (const c of COL) {
    if (c.y0 < 0.3 && c.y1 > 0.02) mark(block, c.x0 - 0.06, c.x1 + 0.06, c.z0 - 0.06, c.z1 + 0.06);
    if (c.y0 >= 2.2 && c.y0 < 9) mark(roof, c.x0, c.x1, c.z0, c.z1);
  }
  for (const r of RAMPS) mark(block, r.x0 - 0.15, r.x1 + 0.15, r.z0 - 0.15, r.z1 + 0.15);
  const fine = (x, z) => {
    const i = Math.floor((x - F.x0) * F.ppm), j = Math.floor((z - F.z0) * F.ppm);
    return i < 0 || j < 0 || i >= F.w || j >= F.d ? -1 : j * F.w + i;
  };
  const cellAt = (x, z) => {
    const i = Math.floor((x - S.x0) * S.ppm), j = Math.floor((z - S.z0) * S.ppm);
    return i < 0 || j < 0 || i >= W || j >= H ? -1 : j * W + i;
  };
  const N = makeNoise(9090);
  const pieces = scatterGround(-44, 44, -58, 58, 31337, (x, z) => {
    const f = fine(x, z), k = cellAt(x, z); if (f < 0 || k < 0 || block[f]) return null;
    const o = k * 4, r = S.mix[o] / 255, g = S.mix[o + 1] / 255, b = S.mix[o + 2] / 255, dirt = S.mix[o + 3] / 255;
    // distance to the wall: that of the map (25 cm pixel centers) minus half a pixel
    const sand = Math.max(0, 1 - r - g - b), dw = Math.max(0, S.wall[k] / 3 / S.ppm - 0.2);
    const foot = 1 - smoothstep(0.05, 0.8, dw), near = 1 - smoothstep(0.6, 2.4, dw); // foot of the wall, surroundings
    const blot = smoothstep(0.3, 0.75, N(x * 0.3, z * 0.3, 256, 256)); // clusters and clear zones
    const open = (0.05 + sand * 0.25 + dirt * 0.45 + near * 0.35) * (0.3 + blot * 1.2) * (1 - (r * 0.7 + b * 0.45) * (1 - near));
    const n = (open + foot * 3.2 * (0.55 + blot * 0.9)) * (roof[f] ? 0.12 : 1);
    // under a roof (tiled floors, warehouses): a few shards and scraps, no pebbles
    if (roof[f]) return { n, w: { chunk: 0.3, shard: 0.2, litter: 0.5 } };
    return {
      n, w: {
        gravel: 0.3 + sand * 0.2, stone: 0.18 + sand * 0.3 + dirt * 0.2, chunk: 0.05 + foot * 0.2, brick: 0.04 + foot * 0.2, pile: foot * 0.05,
        shard: 0.02 + foot * 0.12, litter: 0.05 + (1 - sand) * 0.06 + foot * 0.04, weed: foot * (0.08 + sand * 0.1),
      },
    };
  });
  // drifts: against the walls at ground level, where the map has already put sand
  const walls = COL.filter((c) => !c.ray && c.y0 <= 0.3 && c.y1 >= 1.0 && Math.abs(c.x0) < 45 && Math.abs(c.z0) < 59);
  const drifts = sandDrifts(walls, (x, z) => {
    const k = cellAt(x, z), f = fine(x, z); if (k < 0 || f < 0 || roof[f]) return 0;
    const o = k * 4, sand = Math.max(0, 1 - (S.mix[o] + S.mix[o + 1] + S.mix[o + 2]) / 255);
    return smoothstep(0.72, 0.95, sand) * (0.05 + 0.13 * smoothstep(0.3, 0.8, N(x * 0.45 + 17, z * 0.45, 256, 256)));
  }, (x, z) => { const f = fine(x, z); return f >= 0 && !block[f]; });
  S.wall = S.mix = null;
  WORLD.dressing = { pieces, drifts };
}

function half(s) {
  const Z = (z) => z * s, zr = (a, b) => [Z(a), Z(b)].sort((p, q) => p - q);
  const bz = (key, x0, x1, y0, y1, z0, z1, o) => box(key, x0, x1, y0, y1, Z(z0), Z(z1), o);
  const fN = s > 0 ? 'n' : 's', fS = s > 0 ? 's' : 'n'; // face turned toward the center / toward the base
  const warm = s > 0 ? [0.94, 0.86, 0.72] : [0.9, 0.78, 0.64];

  /* ---------- WEST BLOCK: between Long and the central Rue ---------- */
  /* W0, cut in two by the Lantern alley (z 3.6 to 6.4, November 2026): a third link between the Long and the central Rue, at the
     center. It comes out on the Long behind the truck and on the Rue behind the crates of the Portes; until then the block was solid
     from one Ruelle to the other (28 m), and the Long only met the Rue 15 m from the center */
  building(-24, -6, ...zr(0, LANT[0]), 8.4, { tint: warm, faces: 'ew' + fS });          // W0a, between the Portail and the Portes
  building(-24, -6, ...zr(LANT[1], 14), 8.4, { tint: warm, faces: 'ew' + fS + fN });    // W0b
  alleyArch(-13, -9, ...zr(LANT[0], LANT[1]), 6.5, 7.3, warm);                         // vault in the middle, a lantern hung from its keystone
  DECOR.place(PF.lantern(), -11, 6.45, Z((LANT[0] + LANT[1]) / 2), 0, { nocol: true });
  // a wall light at each mouth, on the corner of the block: whoever comes out of it is seen, on the Long as on the Rue
  DECOR.save().move(-24.04, 0, Z(LANT[0] - 0.6)).rotY(-Math.PI / 2); wallLamp(DECOR, 0, 2.9, true); DECOR.restore();
  DECOR.save().move(-5.96, 0, Z(LANT[1] + 0.6)).rotY(Math.PI / 2); wallLamp(DECOR, 0, 2.9, true); DECOR.restore();
  building(-14, -6, ...zr(17, 40), 8.0, { faces: 'e' + fS + fN });                   // W1
  building(-24, -14, ...zr(30, 40), 7.0, { faces: 'w' + fS });                       // W2
  // Maison du balcon (x -24..-14, z 17..30): Long ↔ Ruelle link and raised firing post over the Long
  {
    const X0 = -24, X1 = -14, t = 0.3, G = 3.2, SL = 3.5, H2 = 3.0, tint = [0.96, 0.9, 0.78];
    const [zA, zB] = zr(17, 30);
    const wN = Z(17 + t / 2), wS = Z(30 - t / 2);
    const zop = (a, b) => { const [p, q] = zr(a, b); return { a0: p, a1: q }; };
    // ground-floor walls raised up to the upper floor (SL): stopped at G, they left a 30 cm strip open all the way
    // around, under the upper floor, through which you could see daylight from the stairwell (owner's feedback, October 2026)
    wallOpen('plaster', 'x', wN, t, X0, X1, 0, SL, [{ a0: -18.2, a1: -16.6, b0: 0, b1: 2.6 }], { tint });
    wallOpen('plaster', 'x', wS, t, X0, X1, 0, SL, [], { tint });
    wallOpen('plaster', 'z', X0 + t / 2, t, zA + t, zB - t, 0, SL, [{ ...zop(26.8, 28.8), b0: 0, b1: 2.6 }, { ...zop(20.5, 22.5), b0: 1.0, b1: 2.3 }], { tint });
    wallOpen('plaster', 'z', X1 - t / 2, t, zA + t, zB - t, 0, SL, [], { tint });
    // staircase along the east wall, solid up to the back wall: the first step is 1.8 m from the opposite wall (1 m until October
    // 2026, it felt cramped to turn there), and the underside of the landing is masonry (it was hollow, filled with crates: a dead end)
    { const [r0, r1] = zr(19.1, 26.1); ramp(-16.4, -14.3, r0, r1, 'z', s > 0 ? 0 : SL, s > 0 ? SL : 0, 'pavers', [0.82, 0.78, 0.72], { mat: 'ashlar' }); }
    { const [a, b] = zr(26.1, 29.7); box('ashlar', -16.4, -14.3, 0, G, a, b, { tint: [0.82, 0.78, 0.72] }); }
    // upper floor, hatch above the staircase
    { const [a, b] = zr(17.3, 29.7); box('plaster', -23.7, -16.4, G, SL, a, b, { tint: [0.95, 0.93, 0.88] }); ceilingJoists(-23.7, -16.4, a, b, G); }
    { const [a, b] = zr(26.1, 29.7); box('plaster', -16.4, -14.3, G, SL, a, b, { tint: [0.95, 0.93, 0.88] }); }
    { const [a, b] = zr(17.6, 25.9); railing(-16.45, -16.45, SL, a, b, 'z'); DECOR.col(-16.5, -16.4, SL, SL + 1.0, a, b, 'metal'); }
    box('tiles', -23.7, -16.4, 0, 0.03, ...zr(17.3, 29.7), { collide: false, ao: false }); box('tiles', -16.4, -14.3, 0, 0.03, ...zr(17.3, 19.1), { collide: false, ao: false });
    box('tiles', -23.7, -16.4, SL, SL + 0.02, ...zr(17.3, 29.7), { collide: false, ao: false });
    box('tiles', -16.4, -14.3, SL, SL + 0.02, ...zr(26.1, 29.7), { collide: false, ao: false });
    // upper floor: French window onto the balcony (Long side), window onto the Ruelle
    const up = { tint, floorY: SL };
    wallOpen('plaster', 'z', X0 + t / 2, t, zA + t, zB - t, SL, H2, [{ ...zop(20, 26), b0: 0, b1: 2.4 }], up);
    wallOpen('plaster', 'x', wN, t, X0, X1, SL, H2, [{ a0: -22, a1: -20, b0: 0.9, b1: 2.1 }], up);
    wallOpen('plaster', 'x', wS, t, X0, X1, SL, H2, [], up);
    wallOpen('plaster', 'z', X1 - t / 2, t, zA + t, zB - t, SL, H2, [], up);
    box('plaster', X0, X1, SL + H2, SL + H2 + 0.3, zA, zB, { tint });
    flatRoof(X0, X1, zA, zB, SL + H2 + 0.3, tint, rngOf(77 + s));
    { const [a, b] = zr(20, 26); DECOR.save().color([0.85, 0.8, 0.72]).local(1); DECOR.boxB('ashlar', X0 - 0.04, X0 + t, SL - 0.12, SL + 0.02, a, b, { bevel: 0.01 }); DECOR.restore(); } // threshold of the French window
    // balcony overhanging the Long, solid chest-high railing
    bz('ashlar', -25.6, -24, SL - 0.3, SL, 20, 26, { tint: [0.9, 0.86, 0.78], bevel: 0.02 });
    bz('plaster', -25.6, -25.35, SL, SL + 1.0, 20, 26, { tint });
    bz('plaster', -25.6, -24, SL, SL + 1.0, 19.75, 20, { tint }); bz('plaster', -25.6, -24, SL, SL + 1.0, 26, 26.25, { tint });
    DECOR.save().color([0.86, 0.84, 0.8]).local(1);
    DECOR.boxB('concrete', -25.65, -25.3, SL + 1.0, SL + 1.06, ...zr(19.7, 26.3), { bevel: 0.012 });
    DECOR.restore();
    for (const zz of [20.5, 25.5]) { DECOR.save().color([0.8, 0.74, 0.64]).move(-24, SL - 0.3, Z(zz) - 0.1).rotY(-Math.PI / 2); DECOR.extrude('ashlar', [[0, 0], [0.9, 0], [0.9, -0.12], [0.3, -0.5], [0, -0.6]], 0.2); DECOR.restore(); }
    // interior: crates, table and chairs, rug
    crate(-22.5, 0, Z(19), 1.0, 0.2);
    tableSet(DECOR, -20.5, Z(24), 0, [[-0.4, 0.72], [0.45, -0.72]], [0.55, 0.4, 0.28]);
    DECOR.place(PF.rugFloor(), -20.5, 0.035, Z(21.5), 0.1);
    crate(-17.5, SL, Z(28.5), 0.9, 0.3);
    // warm bulbs above the table and upstairs: the house reads from afar as a lit refuge
    DECOR.place(PF.hangLamp(false, 0.55), -20.5, G - 0.16, Z(24), 0, { nocol: true });
    DECOR.place(PF.hangLamp(false, 0.7), -20, SL + H2, Z(23), 0, { nocol: true });
  }
  // Ruelle (z 14..17): staggered cover to break the sight line
  crate(-11, 0, Z(15.1), 1.1, 0.25); crate(-19.5, 0, Z(16), 1.0, 0.1);
  alleyArch(-14, -6, ...zr(14, 17), 6.5, 7.3, warm);                                // high arch, above the windows
  DECOR.place(PF.lantern(), -10, 6.45, Z(15.5), 0, { nocol: true });                // (at night, the Ruelle would be a black hole)

  /* ---------- LONG (x -36..-24) ---------- */
  jersey(-34.4, Z(41), 3.2, 'x'); jersey(-31.2, Z(41), 3.2, 'x'); jersey(-28.4, Z(41.3), 2.4, 'x');   // staggered base exit
  car(-31, Z(34), 0.2 * s, undefined, false, 'offroad', { dust: 1 }); // dusty 4x4
  { const zc = s > 0 ? 28.4 : 28; crate(-35, 0, Z(zc), 1.1, 0.1); crate(-35.1, 1.1, Z(zc), 1.0, 0.4); } // out of the doors' passage (z = 26.3 in the north, -30.3 in the south)
  // low wall against the block
  bz('ashlar', -25.3, -24.95, 0, 1.0, 8.5, 13, { tint: [0.9, 0.84, 0.72] });
  DECOR.save().color([0.86, 0.84, 0.8]).local(1); DECOR.boxB('concrete', -25.36, -24.92, 1.0, 1.06, ...zr(8.45, 13.05), { bevel: 0.01 }); DECOR.restore();
  // truck stopped in front of the Portail, crosswise: it cuts the view that crossed the map through the arch (80 m, base to base); it
  // is bypassed at both ends (1.6 m to the west, 1.9 m to the east); the Long remains a sniper's street up to it
  truck(-29.4, Z(7.2), 'x');
  crate(-26.2, 0, Z(3.2), 1.1, 0.3);
  stall(-35, Z(17), 'z');
  lampPost(-24.4, Z(33), Math.PI); lampPost(-35.6, Z(12), 0);
  barrel(-35.4, Z(36)); barrel(-34.7, Z(36.7));

  /* ---------- CENTRAL RUE (x -6..6) ---------- */
  truck(0, Z(45), 'x', 'cargo', { load: 'tarp' }, [0.72, 0.62, 0.42]); // tarped flatbed                                                              // cuts the base-center sight line
  DECOR.place(PF.fountain(), -2, 0, Z(27), 0, { nocol: true }); fountainWater(-2, Z(27));
  box('plaster', -3.2, -0.8, 0, 0.85, ...zr(25.8, 28.2), { skip: 'xXyYzZ', m: 'concrete' });  // fountain
  stall(-4.6, Z(20), 'z');
  crate(4.6, 0, Z(22), 1.1, 0.3); crate(4.8, 0, Z(23.3), 1.0, 0.1);
  crate(-3.6, 0, Z(3.4), 1.2, 0.15); crate(-2.25, 0, Z(3.3), 1.0, 0.4); crate(-3.15, 1.2, Z(3.4), 0.9, 0.2); // "xbox" in front of the Portes
  crate(-2.2, 1.0, Z(3.3), 0.9, -0.1); // at the top across the whole width of the door: the view ran from base to base through its east half
  sandbags(-4.2, Z(36.5), 2.6, 'x', 4);
  lampPost(-5.6, Z(31), 0); lampPost(5.6, Z(16), Math.PI);
  // Passerelle ramp (climbs toward the center): 6 m for 3.5 m (slope 0.58, under the bots' limit)
  { const [a, b] = zr(8, 14); ramp(3.5, 6, a, b, 'z', s > 0 ? PASS_Y : 0, s > 0 ? 0 : PASS_Y, 'pavers', [0.84, 0.8, 0.74]); railing(3.55, 3.55, 0, a, b, 'z', s > 0 ? [PASS_Y, 0] : [0, PASS_Y]); }

  /* ---------- EAST BLOCK and PASSAGE ---------- */
  building(6, 20, ...zr(8, 14), 8.0, { faces: 'e' + fS });                           // E0: blind west facade, the Passerelle runs along it
  building(6, 20, ...zr(18, 40), 8.6, { faces: 'w' + fN + fS });                      // E1 (blind east facade: the hangar is built against it, its windows and their pots were inside its wall)
  crate(12, 0, Z(15.2), 1.1, 0.2); crate(16.8, 0, Z(16.8), 1.0, 0.3);
  alleyArch(6, 20, ...zr(14, 18), 6.5, 7.3, [0.86, 0.78, 0.64]);                        // Passage arch, above the windows
  DECOR.place(PF.lantern(), 11.5, 6.45, Z(16), 0, { nocol: true });

  /* ---------- EAST: Hangar (x 20..36, z 20..34) ---------- */
  {
    const [zA, zB] = zr(20, 34), H = 6.5, tint = [0.72, 0.74, 0.7];
    const zBase = Z(34) + (s > 0 ? -0.15 : 0.15), zMid = Z(20) + (s > 0 ? 0.15 : -0.15);
    wallOpen('metal', 'x', zBase, 0.3, 20, 36, 0, H, [{ a0: 25, a1: 31, b0: 0, b1: 4.5 }], { tint, frames: false });
    wallOpen('metal', 'x', zMid, 0.3, 20, 36, 0, H, [{ a0: 21, a1: 24, b0: 0, b1: 3 }, { a0: 32, a1: 35, b0: 0, b1: 3 }], { tint, frames: false });
    box('metal', 20, 20.3, 0, H, zA + 0.3, zB - 0.3, { tint });
    box('metal', 35.7, 36, 0, H, zA + 0.3, zB - 0.3, { tint });
    hangarRoof(20, 36, zA, zB, H, s);
    // workshop lighting: cold pendants under the trusses, in the aisle between the shelves; white light against the ocher outside
    for (const x of [22.07, 28.07, 34.07]) DECOR.place(PF.hangLamp(true, 1.2), x, H - 0.55, Z(27), 0, { nocol: true });
    box('concrete', 20.3, 35.7, 0, 0.03, zA + 0.3, zB - 0.3, { collide: false, ao: false, tint: [0.72, 0.72, 0.7] });
    box('paint', 20, 36, H - 0.9, H - 0.4, s > 0 ? zB : zA - 0.05, s > 0 ? zB + 0.05 : zA, { collide: false, tint: [0.62, 0.2, 0.14] });
    shelf(24.5, 25.5, ...zr(23, 31), 3.2);
    shelf(30.5, 31.5, ...zr(22.5, 30.5), 3.2);
    crate(28, 0, Z(24.5), 1.2); crate(28.1, 1.2, Z(24.5), 1.0, 0.4); crate(22, 0, Z(31.5), 1.1, 0.2);
    barrel(35.15, Z(22.7)); barrel(35.2, Z(23.4)); // in the corner, out of the door's passage (x 32 to 35)
  }
  // back yard (base → hangar)
  dumpster(34.9, Z(39.8), 'x'); crate(22.2, 0, Z(38.2), 1.1, 0.2); tires(26, Z(37.4), 3); // the dumpster at the back, against the base: in front of the hangar wall, it closed off a nook
  // forklift (original collision), moved out of the hangar corner where it closed a pocket against the walls
  DECOR.place(PF.forklift(), 30.5, 0, Z(39.2), s > 0 ? 0 : Math.PI, { nocol: true });
  bz('paint', 29.7, 31.3, 0.2, 1.5, 38.1, 40.3, { skip: 'xXyYzZ', m: 'metal' });

  /* ---------- EAST: container yard (z 2..20) ---------- */
  container(28.3, 0, Z(16.4), 'x', s > 0 ? [0.62, 0.2, 0.15] : [0.2, 0.36, 0.55]);
  // crate pile at the exit of the Passage: the z = 14.5 row ran from the yard all the way to the Long (70 m)
  crate(22.6, 0, Z(14.55), 1.1, 0.08); crate(22.55, 0, Z(15.75), 1.1, -0.1); crate(22.6, 1.1, Z(14.6), 1.0, -0.2); crate(22.6, 1.1, Z(15.7), 1.0, 0.15);
  container(33.2, 0, Z(10), 'z', s > 0 ? [0.22, 0.38, 0.55] : [0.72, 0.52, 0.2]);
  container(33.2, 2.6, Z(10.3), 'z', [0.58, 0.55, 0.48]);                                  // pile: visual landmark
  // open container, can be walked through
  {
    const cx = 26.8, [a, b] = zr(4.2, 10.3), tint = s > 0 ? [0.3, 0.45, 0.3] : [0.55, 0.3, 0.25];
    DECOR.place(PF.container(true), cx, 0, (a + b) / 2, 0, { tint, nocol: true });
    WORLD.col({ x0: cx - 1.22, x1: cx - 1.1, y0: 0, y1: 2.6, z0: a, z1: b }, 'metal');
    WORLD.col({ x0: cx + 1.1, x1: cx + 1.22, y0: 0, y1: 2.6, z0: a, z1: b }, 'metal');
    WORLD.col({ x0: cx - 1.22, x1: cx + 1.22, y0: 2.5, y1: 2.62, z0: a, z1: b }, 'metal');
  }
  crate(22.6, 0, Z(9.5), 1.1, 0.3); crate(30.4, 0, Z(4.2), 1.2, 0.2); crate(21.3, 0, Z(2.2), 1.0, 0.1); // (next to the east door of the souk, z = 4.3, and not in front)

  /* ---------- BASES ---------- */
  sandbags(-19, Z(41.6), 4, 'x'); sandbags(17, Z(41.6), 4, 'x');
  { const tz = Z(46.5); DECOR.place(PF.tent(), -18.5, 0, tz, 0, { nocol: true }); box('canvas', -22, -15, 0, 2.1, tz - 2.2, tz + 2.2, { m: 'dirt', skip: 'xXyYzZ' }); }
  crate(11, 0, Z(47.5), 1.2); crate(12.4, 0, Z(47.8), 1.1, 0.3); crate(11.7, 1.2, Z(47.6), 1.0);
  palm(-9, Z(48.5)); palm(24, Z(48), 7.5, 'suckers'); palm(-33, Z(47), 7.5, 'tuft');
  barrel(-12.5, Z(43)); barrel(-11.85, Z(43.7));
}

/* Tile coping on the top course of a wall, from p0 to p1 ([x, y, z], the top of the wall, which may rise), overhanging by e on each side of the axis.
   Closed, domed profile, the same from end to end (in the vertical plane, across the axis): plaster soffit (o.soffit: its tint;
   false: none, when another coping already provides it), vertical edge of o.band (6 cm, the end of the tiles), two slopes tangent to the rounded
   ridge (radius o.ridge, 8 cm), top at yr above the course. Convex profile: seen from anywhere, nothing sticks out of the plane of the slopes,
   you never see the sky between the edge and the ridge (with a ridge laid on flat slopes, it was seen from below, above the
   edge). Tile gable at the free end (o.cap0, o.cap1); two successive copings (same e, same yr) join without a gap.
   Placed in the world frame (DECOR.world(1)) with the current tint for the tiles. */
function tileCoping(M, p0, p1, e, o = {}) {
  const yr = o.yr || 0.24, f = o.band ?? 0.06, r = o.ridge ?? 0.08, NA = 6;
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], dz = p1[2] - p0[2], L = hyp3(dx, dy, dz), hl = hyp(dx, dz);
  const w = [dz / hl, -dx / hl], dh = [dx / hl, dz / hl], d = [dx / L, dy / L, dz / L]; // horizontal across the axis; horizontal direction; axis
  // tangency of the slope (+w side) to the ridge: from the corner of the edge (e, f) to the circle centered at (0, yc)
  const yc = yr - r, ang = Math.atan2(f - yc, e) + Math.acos(r / hyp(e, f - yc));
  const prof = [[-e, 0], [e, 0], [e, f]]; // profile (q along w, h above the course), counterclockwise seen from p1
  for (let i = 0; i <= NA; i++) { const a = ang + (Math.PI - 2 * ang) * i / NA; prof.push([r * Math.cos(a), yc + r * Math.sin(a)]); }
  prof.push([-e, f]);
  const P = (p, q, h) => [p[0] + w[0] * q, p[1] + h, p[2] + w[1] * q];
  const nrm = (A, B, C) => { const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]]; return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; };
  // normal of a profile point, turned outward and perpendicular to the axis
  const out = (q, h, nq, nh) => { let n = [w[0] * nq, nh, w[1] * nq]; const k = n[0] * d[0] + n[1] * d[1] + n[2] * d[2]; n = [n[0] - k * d[0], n[1] - k * d[1], n[2] - k * d[2]]; const l = Math.hypot(...n); return [n[0] / l, n[1] / l, n[2] / l]; };
  // underside (plaster)
  if (o.soffit !== false) { const S = [P(p0, e, 0), P(p1, e, 0), P(p1, -e, 0), P(p0, -e, 0)]; M.save().color(o.soffit || [0.9, 0.84, 0.72]); M.quad('plaster', ...S, out(0, 0, 0, -1)); M.restore(); }
  // edges, slopes (flat faces) then ridge (rounded, smoothed normals), all in tiles
  for (const s of [1, -1]) {
    M.quad('rooftiles', P(p0, s * e, 0), P(p1, s * e, 0), P(p1, s * e, f), P(p0, s * e, f), out(0, 0, s, 0));
    const t = prof[3 + (s > 0 ? 0 : NA)], A = P(p0, s * e, f), B = P(p1, s * e, f), C = P(p1, t[0], t[1]), D = P(p0, t[0], t[1]);
    const n = nrm(A, B, C); M.quad('rooftiles', A, B, C, D, n[1] < 0 ? [-n[0], -n[1], -n[2]] : n);
  }
  const B = M.buf('rooftiles', (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 + yr, (p0[2] + p1[2]) / 2), ids = [];
  for (let i = 0; i <= NA; i++) {
    const a = ang + (Math.PI - 2 * ang) * i / NA, q = r * Math.cos(a), h = yc + r * Math.sin(a), n = out(q, h, Math.cos(a), Math.sin(a));
    ids.push([p0, p1].map((p, j) => { const v = P(p, q, h); return { v, i: M.v(B, v[0], v[1], v[2], n[0], n[1], n[2], j * L, r * a) }; }));
  }
  for (let i = 0; i < NA; i++) {
    const [a0, a1] = ids[i], [b0, b1] = ids[i + 1], n = nrm(a0.v, a1.v, b1.v), c = out(0, 0, Math.cos(ang + (Math.PI - 2 * ang) * (i + 0.5) / NA), Math.sin(ang + (Math.PI - 2 * ang) * (i + 0.5) / NA));
    if (n[0] * c[0] + n[1] * c[1] + n[2] * c[2] > 0) M.quadI(B, a0.i, a1.i, b1.i, b0.i); else M.quadI(B, a0.i, b0.i, b1.i, a1.i);
  }
  // gables: the whole profile, fanned from its center
  for (const [p, sg, on] of [[p0, -1, o.cap0], [p1, 1, o.cap1]]) {
    if (!on) continue;
    const c = P(p, 0, yr * 0.45);
    for (let i = 0; i < prof.length; i++) { const a = prof[i], b = prof[(i + 1) % prof.length]; M.tri3('rooftiles', c, P(p, a[0], a[1]), P(p, b[0], b[1]), [dh[0] * sg, 0, dh[1] * sg]); }
  }
}

/* Middle Portes: a wall across the central street (x -6 to 3.5), a door at ground level on the west; the Passerelle passes on the east, in the open
   air, along the end of the wall. October 2026 overhaul (at the owner's request): the wall takes on the look of the facades and of the Long's
   Portail (ashlar stone base, stone-framed door with keystone and frame, corner quoins at the end of the wall, molded
   cornice, tile coping), at the height of the neighboring souk, and climbs gradually along the edge of the Passerelle up to its arch
   (footbridgeArch). Until then, a lintel at 4.2 m passed above the deck (10 cm above the head) and the wall rose to 5.4 m
   up to the souk, which is only 4.5: it stuck out above it. At ground level, same boxes and same passages. */
function doorsWall(tint) {
  const H = 4.6, T = 0.8, X1 = 3.5, PL = { mat: 'ashlar', h: 0.85, tint: PAL.stone }, FW = 0.24;
  const sunny = (side) => side * SUN_DIR.z >= 0; // facing in the sun: its wall light is off (as on the facades)
  wallOpen('plaster', 'x', 0, T, -6, X1, 0, H, [{ a0: -4.1, a1: -1.6, b0: 0, b1: 2.8, arch: 0.5 }], {
    tint, frameTint: PAL.stone, frameMat: 'ashlar', frameW: FW,
    dress: (M, L, ops, side) => {
      const d = ops[0], xc = (d.x0 + d.x1) / 2, ax0 = d.x0 - FW - 0.16, ax1 = d.x1 + FW + 0.16, ay = d.y1 + FW + 0.2;
      for (const [a, b] of [[0, d.x0 - FW], [d.x1 + FW, L]]) plinthSeg(M, a, b, PL); // plinth, interrupted by the frame
      M.color(PAL.stone).world(1);
      // frame around the arch (uprights set on the base) and keystone
      lbox(M, 'ashlar', ax0, ax0 + 0.1, PL.h + 0.05, ay, 0, 0.05); lbox(M, 'ashlar', ax1 - 0.1, ax1, PL.h + 0.05, ay, 0, 0.05);
      lbox(M, 'ashlar', ax0, ax1, ay - 0.1, ay, 0, 0.05);
      lbox(M, 'ashlar', xc - 0.13, xc + 0.13, d.y1 - 0.04, d.y1 + FW + 0.04, 0, 0.055, { bevel: 0.01 });
      molding(M, 'ashlar', 0, L, H - 0.27, PROF.cornice, PAL.stone); // cornice under the coping
      wallLamp(M, ax1 + 0.45, 2.6, !sunny(side));
    },
  });
  // under the Passerelle deck: the wall closes the ground passage, with the same base
  box('plaster', X1, 6, 0, PASS_Y - 0.25, -T / 2, T / 2, { tint });
  DECOR.save().color(PL.tint).world(1);
  for (const s of [1, -1]) {
    const z0 = s * (T / 2 - 0.02), z1 = s * (T / 2 + 0.05), z2 = s * (T / 2 + 0.07);
    DECOR.boxB('ashlar', X1, 6, 0, PL.h, Math.min(z0, z1), Math.max(z0, z1), { skip: 'xX' });
    DECOR.boxB('ashlar', X1, 6, PL.h, PL.h + 0.05, Math.min(z0, z2), Math.max(z0, z2), { bevel: 0.015, skip: 'xX' });
  }
  // corner quoins at the end of the wall, above the deck: alternating blocks that return onto the end (it continues on the pier of the arch)
  for (let k = 0, st = (H - 0.29 - PASS_Y) / 3; k < 3; k++) DECOR.boxB('ashlar', X1 - (k % 2 ? 0.26 : 0.42), X1 + 0.02, PASS_Y + k * st, PASS_Y + (k + 1) * st - 0.02, -T / 2 - 0.03, T / 2 + 0.03, { bevel: 0.015 });
  DECOR.restore();
  // tile coping on the course, above the cornice: flat up to DOORS_XS, where the wall climbs gradually toward the arch of the
  // Passerelle (footbridgeArch) with the same coping
  const zc = T / 2 + 0.27, yr = 0.24, XS = DOORS_XS;
  DECOR.save().color([0.95, 0.88, 0.84]).world(1);
  tileCoping(DECOR, [-6, H, 0], [XS, H, 0], zc, { yr, soffit: tint });
  DECOR.restore();
  DECOR.col(-6, X1, H - 0.27, H, -T / 2 - 0.24, T / 2 + 0.24, 'concrete', true); // cornice: shots stop there, but you cannot stand on it (from the Passerelle, you could jump onto it)
  DECOR.col(-6, XS, H, H + yr, -T / 2, T / 2, 'concrete');
}

/* Passerelle arch: above the deck, the Portes wall extends as an arch up to the souk wall (owner's requests,
   October 2026). Same look as the wall: plaster, arch of ashlar voussoirs with keystone, imposts, tile coping. The intrados rises
   from SOUK_W (6.2 m, the impost) to 6.65 m at the keystone, at least 2.7 m above the deck (PASS_Y). On the Portes side, the wall climbs gradually:
   its course rises from 4.6 m (DOORS_XS) to the top of the arch, under the wall's coping, which follows it; the corner quoins continue on the
   pier. On the souk side, the pier rests on the course of the souk wall (SOUK_W, same height as the impost), with the same corner quoins
   as the other, and the wall climbs in two slopes up to a landing, under a coping that runs its whole length, from end to end
   (owner's feedback: the coping must follow all the low walls, the two piers must match). The two ridges
   cross at the same height above the pier, in a valley. Until then, the arch (lower, with the deck at 2.3 m) sat on the
   tiles of the wall and stuck out above them. Collisions as close as possible to the masonry, in steps under the slopes; nothing is within jump
   reach from the deck (reachability.js). */
function footbridgeArch(tint) {
  const T = 0.8, xa = 3.5, xb = 6.0, xs = DOORS_XS, xr = 2.7, xl = 6.3, ys = SOUK_W, yk = ys + 0.45, Yc = ys + 1.0, ring = 0.24, yr = 0.24, zw = 2.4, M = DECOR;
  const soukTint = [0.9, 0.8, 0.64], tileTint = [0.95, 0.88, 0.84], st = PAL.stone, eP = T / 2 + 0.27, eS = 0.35, xm = (xb + xl) / 2, zt = eP;
  const half = (xb - xa) / 2, rise = yk - ys, R = (half * half + rise * rise) / (2 * rise), cx = (xa + xb) / 2, cy = yk - R;
  const a0 = Math.atan2(ys - cy, xb - cx), a1 = Math.PI - a0, arc = (r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  const yw = (z) => ys + (Yc - ys) * clamp((zw - Math.abs(z)) / (zw - zt), 0, 1); // course of the souk wall: climbs toward the arch, landing at Yc across the width of its coping (zt)
  // plastered body, with the facings of the Portes wall: ramp laid on the course, pier, spandrels, souk pier; its intrados is that
  // of the arch (hidden under the voussoirs, visible in the joints)
  const body = [[xs, 4.6], [xa, 4.6], [xa, ys]];
  for (let i = 1; i < 16; i++) body.push(arc(R, a1 - (a1 - a0) * i / 16));
  body.push([xb, ys], [xl, ys], [xl, Yc], [xr, Yc]);
  M.save().color(tint).world(1).move(0, 0, -T / 2); M.extrude('plaster', body, T, { sharp: 0.3 }); M.restore();
  // gables of the souk wall: on each side of the arch, the course rises by ys up to the landing (rotated frame: local x = -z of the world)
  for (const s of [1, -1]) {
    M.save().color(soukTint).world(1).move(xb, 0, 0).rotY(Math.PI / 2);
    M.extrude('plaster', [[-s * T / 2, ys], [-s * zw, ys], [-s * zt, Yc], [-s * T / 2, Yc]], xl - xb);
    M.restore();
  }
  // arch of voussoirs, higher and protruding keystone; 1 cm joints
  M.save().color(st).world(1);
  const N = 9, da = (a1 - a0) / N;
  for (let k = 0; k < N; k++) {
    const key = k === (N >> 1), r0 = R - 0.012, r1 = R + ring + (key ? 0.1 : 0), b0 = a0 + da * k + 0.003, b1 = a0 + da * (k + 1) - 0.003, sh = [];
    for (let i = 0; i <= 3; i++) sh.push(arc(r0, b0 + (b1 - b0) * i / 3));
    for (let i = 3; i >= 0; i--) sh.push(arc(r1, b0 + (b1 - b0) * i / 3));
    const out = key ? 0.05 : 0.025;
    M.save().move(0, 0, -T / 2 - out); M.extrude('ashlar', sh, T + out * 2, { sharp: 0.2 }); M.restore();
  }
  for (const [x0, x1, sk] of [[xa - 0.42, xa + 0.06, ''], [xb - 0.06, xl, 'X']]) lbox(M, 'ashlar', x0, x1, ys - 0.12, ys, -T / 2 - 0.03, T / 2 + 0.03, { bevel: 0.01, skip: sk }); // imposts (the souk's stops at the wall face: no face in the plane of the plaster)
  // corner quoins on the pier, from the course of the Portes wall to the impost
  for (let k = 0, h = (ys - 0.14 - 4.62) / 4; k < 4; k++) lbox(M, 'ashlar', xa - (k % 2 ? 0.42 : 0.26), xa + 0.02, 4.62 + k * h, 4.62 + (k + 1) * h - 0.02, -T / 2 - 0.03, T / 2 + 0.03, { bevel: 0.015 });
  // corner quoins of the pier on the souk side, on the facing of the souk wall: the courses of the other pier (three blocks from the deck to the
  // cornice of the Portes wall, one at its height, four up to the impost), alternating long and short, toothed into the facing
  // (owner's feedback: one side of the arch in stone, the other in plaster)
  {
    const sp = (4.6 - 0.29 - PASS_Y) / 3, hp = (ys - 0.14 - 4.62) / 4, rows = [];
    for (let k = 0; k < 3; k++) rows.push([PASS_Y + k * sp, PASS_Y + (k + 1) * sp - 0.02, k % 2 === 0]);
    rows.push([4.6 - 0.29, 4.6, false]);
    for (let k = 0; k < 4; k++) rows.push([4.62 + k * hp, 4.62 + (k + 1) * hp - 0.02, k % 2 === 1]);
    for (const [y0, y1, long] of rows) { const zh = T / 2 + 0.03 + (long ? 0.16 : 0); lbox(M, 'ashlar', xb - 0.03, xb + 0.01, y0, y1, -zh, zh, { bevel: 0.015, skip: 'X' }); }
  }
  // impost band along the souk wall, Passerelle side: the line of imposts runs to both ends of the wall
  for (const [z0, z1] of [[-8, -T / 2 - 0.03], [T / 2 + 0.03, 8]]) lbox(M, 'ashlar', xb - 0.03, xb, ys - 0.12, ys, z0, z1, { bevel: 0.01, skip: 'xX' });
  M.restore();
  // tile copings: continuation of that of the Portes wall (ramp, then flat over the arch); on the souk wall, from end to end (gable at
  // each end), in two slopes that climb to a landing the width of the arch's coping. The two ridges cross at the same
  // height, above the pier: the arch's ends in the souk's, its slopes join it in a valley (until then, it stuck out as a
  // gable above two slopes that fell away: owner's feedback, the tiles did not meet)
  M.save().color(tileTint).world(1);
  tileCoping(M, [xs, 4.6, 0], [xr, Yc, 0], eP, { yr, soffit: tint });
  tileCoping(M, [xr, Yc, 0], [xm - eS, Yc, 0], eP, { yr, soffit: tint });
  tileCoping(M, [xm - eS, Yc, 0], [xm, Yc, 0], eP, { yr, soffit: false }); // under the souk coping, which provides the soffit
  for (const s of [1, -1]) {
    tileCoping(M, [xm, ys, s * 8], [xm, ys, s * zw], eS, { yr, soffit: soukTint, cap0: true });
    tileCoping(M, [xm, ys, s * zw], [xm, Yc, s * zt], eS, { yr, soffit: soukTint });
  }
  tileCoping(M, [xm, Yc, -zt], [xm, Yc, zt], eS, { yr, soffit: soukTint });
  M.restore();
  // collisions: stepped ramp, piers, spandrels (flush with the intrados), keystone; souk wall and its stepped slopes
  for (let k = 0; k < 5; k++) { const x0 = lerp(xs, xr, k / 5), x1 = lerp(xs, xr, (k + 1) / 5); M.col(x0, x1, 4.6, lerp(4.6, Yc, k / 5) + yr, -T / 2, T / 2, 'concrete'); }
  M.col(xr, xa, 4.6, Yc + yr, -T / 2, T / 2, 'concrete'); M.col(xb, xl, ys, Yc + yr, -T / 2, T / 2, 'concrete');
  M.col(xa, xa + 0.4, ys + 0.15, yk, -T / 2, T / 2, 'concrete'); M.col(xb - 0.4, xb, ys + 0.15, yk, -T / 2, T / 2, 'concrete');
  M.col(xa, xb, yk, Yc + yr, -T / 2, T / 2, 'concrete'); M.col(xr, xm, Yc, Yc + yr, -eP, eP, 'concrete'); M.col(xm - eS, xm + eS, Yc, Yc + yr, -zt, zt, 'concrete');
  for (const s of [1, -1]) {
    M.col(xm - eS, xm + eS, ys, ys + yr, Math.min(s * zw, s * 8), Math.max(s * zw, s * 8), 'concrete');
    for (let k = 0; k < 4; k++) { const za = lerp(zw, zt, k / 4), zb = lerp(zw, zt, (k + 1) / 4); M.col(xb, xl, ys, yw(za) + yr, Math.min(s * za, s * zb), Math.max(s * za, s * zb), 'concrete'); }
    M.col(xb, xl, ys, Yc, Math.min(s * T / 2, s * zt), Math.max(s * T / 2, s * zt), 'concrete');
  }
}

/* Unique elements on the center line */
function center() {
  const warmN = [0.92, 0.84, 0.7];
  /* Long Portail: large gate and wicket, leaves open on each side */
  wallOpen('stone', 'x', 0, 1.0, -36, -24, 0, 4.6, [{ a0: -32, a1: -28, b0: 0, b1: 3.8, arch: 0.7 }, { a0: -35.6, a1: -34.5, b0: 0, b1: 2.3 }], { tint: [0.95, 0.88, 0.78], frames: false });
  box('stone', -36, -24, 4.6, 5.2, -0.8, 0.8, { tint: [0.88, 0.8, 0.7] });
  DECOR.save().color([0.86, 0.8, 0.7]).local(1); DECOR.boxB('ashlar', -36, -24, 5.2, 5.3, -0.85, 0.85, { bevel: 0.02 }); DECOR.restore();
  for (const z of [1.5, -1.5]) { DECOR.place(PF.gateLeaf(), -27.75, 0, z, z > 0 ? 0 : Math.PI, { nocol: true }); }
  box('wood', -27.9, -27.6, 0, 3.5, 0.5, 2.5, { m: 'wood', skip: 'xXyYzZ' });
  box('wood', -27.9, -27.6, 0, 3.5, -2.5, -0.5, { m: 'wood', skip: 'xXyYzZ' });
  doorsWall(warmN); footbridgeArch(warmN);
  // Passerelle: deck at PASS_Y from z -8 to 8, railing on the street side; you pass beneath it up to the souk doors
  const py = PASS_Y, pu = PASS_Y - 0.25;
  box('concrete', 3.5, 6, pu, py, -8, 8, { tint: [0.84, 0.8, 0.74] });
  railing(3.55, 3.55, py, -8, -0.4, 'z'); railing(3.55, 3.55, py, 0.4, 8, 'z');
  DECOR.col(3.5, 3.6, py, py + 1.0, -8, -0.4, 'metal'); DECOR.col(3.5, 3.6, py, py + 1.0, 0.4, 8, 'metal');
  for (const z of [-7.5, -3, 3, 7.5]) { DECOR.place(PF.iBeam(pu), 3.7, 0, z, 0, { nocol: true }); DECOR.col(3.6, 3.8, 0, pu, z - 0.1, z + 0.1, 'metal'); }
  /* Covered souk (x 6..20, z -8..8): Rue ↔ East link at the center, close combat */
  {
    const t = 0.3, H = 4.5, tint = [0.9, 0.8, 0.64];
    // street-side entrances: arch of 2.5 to 3 m (until October 2026, 1.6 to 2 m, head height: owner's feedback), under the deck
    // the west wall rises to SOUK_W (course at the height of the arch's impost, out of jump reach from the deck); its coping and its
    // gables are placed by footbridgeArch; the two corners, which stay at H, join it by a block
    wallOpen('plaster', 'z', 6 + t / 2, t, -7.7, 7.7, 0, SOUK_W, [{ a0: -5, a1: -2.2, b0: 0, b1: 3.0, arch: 0.5 }, { a0: 2.2, a1: 5, b0: 0, b1: 3.0, arch: 0.5 }], { tint });
    box('plaster', 6, 6 + t, H, SOUK_W, 7.7, 8, { tint }); box('plaster', 6, 6 + t, H, SOUK_W, -8, -7.7, { tint });
    wallOpen('plaster', 'z', 20 - t / 2, t, -7.7, 7.7, 0, H, [{ a0: -5.6, a1: -3.0, b0: 0, b1: 2.8, arch: 0.6 }, { a0: 3.0, a1: 5.6, b0: 0, b1: 2.8, arch: 0.6 }], { tint });
    box('plaster', 6, 20, 0, H, 7.7, 8, { tint }); box('plaster', 6, 20, 0, H, -8, -7.7, { tint });
    soukRoof(H);
    box('tiles', 6.3, 19.7, 0, 0.03, -7.7, 7.7, { collide: false, ao: false });
    for (const [x, z] of [[10, -3.2], [10, 3.2], [16, -3.2], [16, 3.2]]) { DECOR.place(PF.column(H), x, 0, z, 0, { nocol: true, tint: { plaster: [0.85, 0.76, 0.62] } }); DECOR.col(x - 0.3, x + 0.3, 0, H, z - 0.3, z + 0.3, 'concrete'); }
    DECOR.place(PF.counter(), 13, 0, 0, 0, { nocol: true }); box('wood', 12.2, 13.8, 0, 1.0, -1.2, 1.2, { m: 'wood', skip: 'xXyYzZ' });   // central counter
    stall(9, 6.2, 'x'); stall(17, -6.2, 'x');
    crate(18.3, 0, 6.4, 1.0, 0.2); crate(8, 0, -6, 1.0, 0.3); // (out of the east door's passage, z = 4.3)
    // lanterns hung from the stringers
    for (const [x, z] of [[8, 3.2], [13, -3.2], [13, 3.2], [18, -3.2]]) DECOR.place(PF.lantern(), x, H, z, 0, { nocol: true });
  }
  /* East bottleneck (November 2026): a single container across the middle of the yard, and two lanes of 5 m on either side, one along
     the souk (its east doors open onto it), the other along the compound wall, with a crate at each of its mouths. Until then, two containers
     closed the yard from wall to wall with a 4 m gap in the middle: the only way through the East, a choke that one player held alone */
  container(28, 0, 0, 'x', [0.62, 0.52, 0.42]);
  crate(34.9, 0, 1.7, 1.1, 0.1); crate(34.9, 0, -1.7, 1.1, -0.1); // between the doors of the compound facade (z = -4.1, -0.1 and 3.8)
}

/* Exposed joists under a floor (scenery, no collision) */
function ceilingJoists(x0, x1, z0, z1, y) {
  DECOR.save().color([0.5, 0.38, 0.28]).local(1);
  for (let x = x0 + 0.6; x < x1 - 0.3; x += 1.1) DECOR.boxB('wood', x - 0.07, x + 0.07, y - 0.16, y, z0, z1, { bevel: 0.01 });
  DECOR.restore();
}
/* Souk roof: tiered stretched awnings (owner's request, October 2026: rather than a plank roof full of gaps, several
   fabrics stretched one above the other, with pretty patterns, with real cloth physics). Light framework: two stringers on the
   columns (z = ±3.2) and the gable walls, a batten on the course of each long wall. Five awnings run from one long wall to the other, in 3 m
   strips along x that overlap by 0.5 m, alternately low (resting on the battens and stringers, around 4.6 m) and high
   (on poles carried by uprights: 5.2 m on the stringers, 5.0 m at the walls), each sagging between its supports. Seen from below,
   the cloth covers everything; daylight comes in at an angle between two tiers, the sun passes through the awnings (underside lightened). Simulated (canvasAdd,
   02me-canvases.js) with a clearance of 18 cm at most, less than half the gap between two tiers (45 cm): they never touch.
   Collisions: thin noRay slats under the rest shape (a grenade thrown over a wall bounces off the awning; bullets
   and sight pass through); half-opaque occlusion volumes (the cloth lets part of the daylight through); the stringers stop everything. */
function soukRoof(H) {
  const M = DECOR, ZS = [-7.85, -3.2, 3.2, 7.85], SEG = COARSE ? [6, 8, 6] : [9, 12, 9], RV = SEG[0] + SEG[1] + SEG[2] + 1, CU = 7; // looser grid on phones (cost)
  const SHEETS = [[6.6, 9.5, false, 0], [9.0, 12.05, true, 1], [11.55, 14.6, false, 2], [14.1, 17.15, true, 3], [16.65, 19.7, false, 1]]; // x0, x1, haute, motif
  const gk = clamp(CURMAP.def.atmo.sunI / ATMO_DEFAULT.sunI, 0, 1); // share of the daylight that passes through the cloth
  // height of the supports (walls, stringers) and sag of each bay, low or high awning
  const sup = (hi) => (hi ? [5.0, 5.2, 5.2, 5.0] : [H + 0.12, H + 0.24, H + 0.24, H + 0.12]), sag = (hi) => (hi ? [0.12, 0.18, 0.12] : [0.12, 0.2, 0.12]);
  const rowZ = (j) => { let a = 0; for (let s = 0; s < 3; s++) { if (j <= a + SEG[s]) return lerp(ZS[s], ZS[s + 1], (j - a) / SEG[s]); a += SEG[s]; } return ZS[3]; };
  const rowY = (hi, j) => { let a = 0; const Y = sup(hi), G = sag(hi); for (let s = 0; s < 3; s++) { if (j <= a + SEG[s]) { const t = (j - a) / SEG[s]; return lerp(Y[s], Y[s + 1], t) - G[s] * 4 * t * (1 - t); } a += SEG[s]; } return Y[3]; };
  const pinRow = (j) => j === 0 || j === SEG[0] || j === SEG[0] + SEG[1] || j === RV - 1;
  // framework
  M.save().color([0.5, 0.38, 0.27]).local(1);
  for (const z of [-3.2, 3.2]) { M.boxB('wood', 6.3, 20, H, H + 0.22, z - 0.12, z + 0.12, { bevel: 0.015 }); M.col(6.3, 20, H, H + 0.22, z - 0.12, z + 0.12, 'wood'); } // from the face of the west wall (SOUK_W), which would cover them
  for (const z of [-7.85, 7.85]) M.boxB('wood', 6.3, 19.7, H, H + 0.1, z - 0.1, z + 0.1, { bevel: 0.01 });
  // high awnings: a pole under each row of supports, on two uprights set on the stringer or the course
  for (const [x0, x1, hi] of SHEETS) {
    if (!hi) continue;
    for (let k = 0; k < 4; k++) {
      const z = ZS[k], y = sup(true)[k] - 0.03, base = k === 1 || k === 2 ? H + 0.22 : H + 0.1;
      M.save().move(x0 - 0.05, y - 0.045, z).rotZ(-Math.PI / 2); M.cyl('wood', 0.045, x1 - x0 + 0.1, 8); M.restore();
      for (const x of [x0 + 0.2, x1 - 0.2]) M.boxB('wood', x - 0.05, x + 0.05, base, y - 0.08, z - 0.05, z + 0.05);
    }
  }
  M.restore();
  SHEETS.forEach(([x0, x1, hi, band], si) => {
    const R = rngOf(4100 + si), ph = R() * TAU;
    canvasAdd({
      cu: CU, rv: RV, mat: 'canvasCloth', drag: 0.55, color: [1, 1, 1],
      rest: (u, v) => { const j = Math.round(v * (RV - 1)); return [lerp(x0, x1, u), rowY(hi, j) - (pinRow(j) ? 0 : 0.015 * Math.sin(u * 9 + ph)), rowZ(j)]; },
      pin: (u, v) => pinRow(Math.round(v * (RV - 1))),
      // clearance: zero at the supports, 18 cm in the middle of the bays
      maxD: (u, v) => { const j = Math.round(v * (RV - 1)), d = Math.min(...[0, SEG[0], SEG[0] + SEG[1], RV - 1].map((q) => Math.abs(rowZ(j) - rowZ(q)))); return Math.min(0.18, 0.05 + d * 0.07); },
      uv: (u, v) => [rowZ(Math.round(v * (RV - 1))) / 2.4, (band * 256 + 10 + u * 236) / 1024],
      // light passing through: strong on a high awning, less under the overlap of a neighboring high awning; it fades with the sun
      // (under the moon, the awnings are only lit from below by the lanterns)
      glow: (u) => { const x = lerp(x0, x1, u); return (hi ? 0.45 : SHEETS.some((q) => q[2] && x > q[0] && x < q[1]) ? 0.1 : 0.32) * gk; },
    });
    // slats against grenades (noRay) and occlusion volumes, based on the rest shape
    for (let j = 0; j < RV - 1; j += 2) {
      const j1 = Math.min(RV - 1, j + 2), y = Math.min(rowY(hi, j), rowY(hi, j1), rowY(hi, Math.min(RV - 1, j + 1)));
      COL.push({ x0, x1, y0: y - 0.06, y1: y - 0.01, z0: rowZ(j), z1: rowZ(j1), m: 'dirt', ray: false, noRay: true });
    }
    for (let s = 0, a = 0; s < 3; a += SEG[s], s++) { const ym = rowY(hi, a + SEG[s] / 2); M.occ(x0, x1, ym - 0.25, ym + 0.25, ZS[s], ZS[s + 1], 0.4); }
  });
}

/* Atlas of the souk awnings (1024², four 256 px strips: u along the awning, 2.4 m per atlas width, which repeats; v across,
   one strip per pattern, 10 px margin on each side against blending of the levels of detail): 0 madder and cream stripes, indigo
   piping; 1 indigo and white stripes, ocher chevrons in the middle; 2 saffron, borders of red diamonds outlined in black; 3 kilim, rows
   of madder, indigo and ocher diamonds on a cream background. Weave grain and sun-faded cloth on top. */
function soukCanvasTex() {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), R = rngOf(1290);
  const C = { gar: '#a3322a', cre: '#eadfc6', ind: '#2c3e6e', saf: '#d9a23a', ocr: '#b8742e', noi: '#2a2420', bla: '#f1ece0' };
  const band = (k, f) => { g.save(); g.translate(0, k * 256); g.beginPath(); g.rect(0, 0, S, 256); g.clip(); f(); g.restore(); };
  const stripes = (list) => { let y = 0, i = 0; while (y < 256) { const [w, col] = list[i % list.length]; g.fillStyle = col; g.fillRect(0, y, S, w); y += w; i++; } };
  const lozenge = (cx, cy, w, h, fill, edge) => { g.beginPath(); g.moveTo(cx - w / 2, cy); g.lineTo(cx, cy - h / 2); g.lineTo(cx + w / 2, cy); g.lineTo(cx, cy + h / 2); g.closePath(); g.fillStyle = fill; g.fill(); if (edge) { g.strokeStyle = edge; g.lineWidth = 2; g.stroke(); } };
  // the diamonds drawn in px: 427 px per meter along, 80 across (a 3 m awning over 236 px)
  band(0, () => { stripes([[10, C.cre], [30, C.gar], [5, C.cre], [3, C.ind], [5, C.cre], [30, C.gar], [26, C.cre]]); });
  band(1, () => {
    stripes([[10, C.bla], [12, C.ind], [9, C.bla]]);
    g.fillStyle = C.ind; g.fillRect(0, 104, S, 48);
    g.strokeStyle = C.ocr; g.lineWidth = 6; g.beginPath(); for (let x = 0; x <= S; x += 64) { g.lineTo(x, 116); g.lineTo(x + 32, 140); } g.stroke();
  });
  band(2, () => {
    g.fillStyle = C.saf; g.fillRect(0, 0, S, 256);
    for (const y0 of [10, 210]) {
      g.fillStyle = C.noi; g.fillRect(0, y0, S, 3); g.fillRect(0, y0 + 33, S, 3);
      for (let x = 0; x < S; x += 128) lozenge(x + 64, y0 + 18, 110, 24, C.gar, C.noi);
    }
  });
  band(3, () => {
    g.fillStyle = C.cre; g.fillRect(0, 0, S, 256);
    const rows = [[40, C.gar, 1], [86, C.ind, 0], [128, C.ocr, 1], [170, C.ind, 0], [216, C.gar, 1]];
    for (const [y, col, off] of rows) {
      g.fillStyle = C.noi; g.fillRect(0, y - 17, S, 2); g.fillRect(0, y + 15, S, 2);
      for (let x = off ? 64 : 0; x < S + 128; x += 128) { lozenge(x, y, 120, 26, col, null); lozenge(x, y, 50, 11, C.cre, null); }
    }
  });
  // margins: the edge of each strip copied over 10 px
  for (let k = 0; k < 4; k++) { const y = k * 256; g.drawImage(c, 0, y + 10, S, 1, 0, y, S, 10); g.drawImage(c, 0, y + 245, S, 1, 0, y + 246, S, 10); }
  // weave grain, lighter and darker threads, cloth faded in places
  for (let k = 0; k < 9000; k++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,250,235' : '30,20,10'},${R() * 0.06})`; g.fillRect(R() * S, R() * S, 1 + R() * 6, 1); }
  for (let k = 0; k < 4000; k++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,250,235' : '30,20,10'},${R() * 0.05})`; g.fillRect(R() * S, R() * S, 1, 1 + R() * 3); }
  for (let k = 0; k < 40; k++) { const x = R() * S, y = R() * S, r = 20 + R() * 80, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,248,230,0.10)'); gr.addColorStop(1, 'rgba(255,248,230,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  const t = canvasOnce(new THREE.CanvasTexture(c)); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; t.flipY = false; t.wrapS = THREE.RepeatWrapping;
  return { map: t, normal: null };
}
/* Hangar roof (original collisions: 2 m pans, 1 m gaps): trusses, purlins, corrugated sheet pans */
function hangarRoof(x0, x1, zA, zB, H, s) {
  for (let x = x0; x < x1; x += 3) {
    const xb = Math.min(x1, x + 2);
    WORLD.col({ x0: x, x1: xb, y0: H, y1: H + 0.15, z0: zA, z1: zB }, 'metal');
    DECOR.save().color([0.62, 0.62, 0.58]).world(1);
    DECOR.boxB('corrugated', x, xb, H + 0.04, H + 0.15, zA, zB);
    DECOR.restore();
    // lattice truss at the edge of the gap
    const xt = Math.min(x1, x + 2) + 0.07;
    if (xt < x1 - 0.1) DECOR.place(PF.truss(zB - zA), xt, H - 0.3, (zA + zB) / 2, 0, { nocol: true });
  }
  void s;
}
/* Metal railing along an axis (world frame): handrail, low rail, bars (col: tint, dark gray by default). Each railing is noted in RAILS:
   railingsSeal (at the end of the build) places an invisible wall for soldiers wherever nobody placed a collision, which fills in the omissions */
const RAILS = [];
function railing(x, x2, y, a0, a1, axis, ys, col = [0.2, 0.2, 0.19]) {
  void x2;
  const M = DECOR, L = a1 - a0, n = Math.max(2, Math.round(L / 0.12));
  const yAt = (t) => (ys ? lerp(ys[0], ys[1], t) : y);
  RAILS.push({ x, y, a0, a1, axis, ys: ys ? [ys[0], ys[1]] : null });
  M.save().color(col); M.cls = 1;
  const top = [], mid = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8, a = lerp(a0, a1, t); top.push(axis === 'z' ? [x, yAt(t) + 1.0, a] : [a, yAt(t) + 1.0, x]); mid.push(axis === 'z' ? [x, yAt(t) + 0.12, a] : [a, yAt(t) + 0.12, x]); }
  M.tube('steel', 0.025, top, 6); M.tube('steel', 0.012, mid, 4);
  M.cls = 2;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = lerp(a0, a1, t), yy = yAt(t), post = i % 10 === 0 || i === n;
    M.save().move(axis === 'z' ? x : a, yy, axis === 'z' ? a : x); M.cyl('steel', post ? 0.022 : 0.009, 1.0, post ? 6 : 4, { caps: '' }); M.restore();
  }
  M.restore();
}

/* A railing stops soldiers along its whole length: at every 0.4 m step, a collision (not reserved for shots) is looked for in its
   place, at chest height; where there is none, an invisible wall (glassWall: neither shots nor sight stopped). Returns the number of sections added. */
function railingsSeal() {
  let added = 0;
  for (const R of RAILS) {
    const L = R.a1 - R.a0, n = Math.max(1, Math.ceil(Math.abs(L) / 0.4)), yAt = (t) => (R.ys ? lerp(R.ys[0], R.ys[1], t) : R.y);
    let run = null;
    const flush = () => { if (!run) return; const [lo, hi] = [Math.min(run.p0, run.p1), Math.max(run.p0, run.p1)];
      if (R.axis === 'z') glassWall(R.x - 0.06, R.x + 0.06, run.y0, run.y1, lo, hi); else glassWall(lo, hi, run.y0, run.y1, R.x - 0.06, R.x + 0.06);
      added++; run = null; };
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, tm = (t0 + t1) / 2, a0 = lerp(R.a0, R.a1, t0), a1 = lerp(R.a0, R.a1, t1), am = lerp(R.a0, R.a1, tm), ym = yAt(tm) + 0.5;
      const px = R.axis === 'z' ? R.x : am, pz = R.axis === 'z' ? am : R.x;
      let covered = false;
      for (const c of COL) {
        if (c.ray || px < c.x0 - 0.1 || px > c.x1 + 0.1 || pz < c.z0 - 0.1 || pz > c.z1 + 0.1 || ym < c.y0 || ym > c.y1) continue;
        covered = true; break;
      }
      if (covered) { flush(); continue; }
      const y0 = Math.min(yAt(t0), yAt(t1)) - 0.05, y1 = Math.max(yAt(t0), yAt(t1)) + 1.05;
      if (run && Math.abs(run.y0 - y0) < 0.2 && Math.abs(run.y1 - y1) < 0.2) { run.p1 = a1; run.y0 = Math.min(run.y0, y0); run.y1 = Math.max(run.y1, y1); } else { flush(); run = { p0: a0, p1: a1, y0, y1 }; }
    }
    flush();
  }
  return added;
}

/* ---------- Dressing: small objects against the walls, vegetation, debris ---------- */
function dressing() {
  const M = DECOR;
  for (const s of [1, -1]) {
    const Z = (z) => z * s;
    // Long: bags, gas cylinders and jerrycans at the foot of the facades
    M.dyn('gasBottle', -35.55, 0, Z(24.5), 0.3, { tint: [0.2, 0.35, 0.65] }); M.dyn('gasBottle', -35.6, 0, Z(24.9), 1.2, { tint: [0.85, 0.45, 0.12] });
    M.dyn('trashBag', -24.35, 0, Z(13.4), 0.5); M.dyn('trashBag', -24.4, 0, Z(12.8), 2.1);
    M.dyn('jerrycan', -35.6, 0, Z(35.3), 0.1, { tint: [0.35, 0.4, 0.28] });
    M.place(PF.grass(1), -35.7, 0, Z(20), 0); M.place(PF.grass(0.8), -24.35, 0, Z(9.4), 1); M.place(PF.grass(1.1), -35.6, 0, Z(3.6), 2);
    M.place(PF.bush(0.9), -35.4, 0, Z(37.8), 0.4); // between two doors (z = 36.1 and 39.6)
    // central Rue: cafe (chairs against the facades), pots, bougainvillea
    cafeSet(M, 5.35, Z(29), [Math.PI / 2 + 0.25, -Math.PI / 2 + 0.1], [0.9, 0.9, 0.86]);
    M.dyn('jar', -5.65, 0, Z(24), 0); const jar1 = M.lastDyn; M.dyn('jar', -5.6, 0, Z(24.6), 1, { s: 0.8 });
    propLink([jar1, M.lastDyn], { x0: -6, x1: -5.35, y0: 0, y1: 0.6, z0: Z(24.3) - 0.6, z1: Z(24.3) + 0.6 }, 'concrete'); // the original collision, returned when a jar goes
    M.save().move(-6, 0.2, Z(12.2)).rotY(s > 0 ? Math.PI / 2 : Math.PI / 2); M.put(PF.bougainvillea(2.4, 3.2), { cls: 1 }); M.restore();
    M.save().move(6, 2.4, Z(33)).rotY(-Math.PI / 2); M.put(PF.bougainvillea(2.0, 2.6), { cls: 1 }); M.restore();
    // bases: pallets, cardboard, generator
    M.place(PF.pallet(), 14.5, 0, Z(48.8), 0.1); M.place(PF.generator(), -9.2, 0, Z(49.3), 0, { tint: [0.4, 0.44, 0.3] }); // farther east (neither in the exit of the strip behind the tent, nor in front of the x = -12 door)
    M.place(PF.reel(), 27.5, 0, Z(49.3), Math.PI / 2);
    M.place(PF.blocks(), 2, 0, Z(49.8), 0);
    M.place(PF.rubble(1 + (s > 0 ? 0 : 1), 1.3), -29, 0, Z(49), 0);
    // container yard and back yard: tires, drums, grasses
    M.dyn('jerrycan', 35.6, 0, Z(13.9), 1.4, { tint: [0.55, 0.15, 0.1] }); M.dyn('jerrycan', 35.65, 0, Z(14.4), 1.6, { tint: [0.35, 0.4, 0.28] });
    M.place(PF.grass(1), 35.7, 0, Z(18.5), 0.4); M.place(PF.grass(0.9), 20.35, 0, Z(12), 2);
    M.dyn('trashBag', 35.5, 0, Z(35.3), 0.2); M.dyn('cardboard', 35.55, 0, Z(38.9), 0.3, { a: [0.6, 0.45, 0.5] });
    // oil stains, tire tracks, dry puddles, impacts
    groundDecal(12, -31, Z(34), 2.2, 1.6, 0.4); groundDecal(12, 0.5, Z(44.5), 3, 2, 0.1); groundDecal(12, 26, Z(10), 2, 1.5, 1.2);
    groundDecal(13, -30.5, Z(20), 1.9, 8, 0.05); groundDecal(13, 1, Z(35), 1.9, 7, -0.03); groundDecal(13, 28, Z(-2 + 0) + 0, 1.9, 6, Math.PI / 2 + 0.05);
    groundDecal(14, -3, Z(12), 3, 3, 0); groundDecal(14, 16, Z(6), 2.5, 2.5, 1); groundDecal(12, 28.5, Z(26), 1.8, 1.8, 0.7);
    DECOR.save().move(-24.99, 0, Z(7.6)).rotY(-Math.PI / 2); wallDecal(DECOR, 11, 0, 1.2, 1.2, 1.2); DECOR.restore(); // (at z = 6 until the Lantern alley opened there)
    // manhole covers, storm drains, gravel
    M.place(PF.manhole(), 0.5, 0, Z(33), 0); M.place(PF.manhole(), -30, 0, Z(24), 0); M.place(PF.manhole(), 28, 0, Z(12.5), 0);
    for (const z of [8, 26]) M.place(PF.drain(), -5.2, 0, Z(z), 0); M.place(PF.drain(), 5.25, 0, Z(12), 0);
    for (const [x, z, k] of [[-35.5, 30, 1], [-24.6, 22, 2], [-5.6, 14, 3], [20.6, 18, 4], [35.4, 6, 5], [-10, 16.6, 6], [15, 14.4, 7]]) M.place(PF.pebbles(k), x, 0, Z(z), 0);
    // bike and moped along the walls, flower pots at the doors; the bikes 60 cm from their wall: stuck against it, a shot coming from the street pinned them there
    // without them moving, and the hangar's had its frame in the sheet metal (x 35.7), between the wall and the forklift
    M.dyn('bicycle', -5.4, 0, Z(10), s > 0 ? 0.08 : Math.PI - 0.08, { tint: [0.25, 0.35, 0.55] });
    M.place(PF.moped(), -35.55, 0, Z(9.5), s > 0 ? 0.05 : Math.PI - 0.05, { tint: [0.7, 0.12, 0.08] });
    M.dyn('bicycle', 35.1, 0, Z(25), s > 0 ? Math.PI + 0.1 : -0.1, { tint: [0.15, 0.15, 0.15] });
    M.dyn('pot', -5.75, 0, Z(35.6), 0); M.dyn('pot', 5.75, 0, Z(24.2), 1.3); M.dyn('pot', -35.7, 0, Z(15.6), 0.5);
    // alley and passage: laundry hung between the facades
    clothesLine(-22, Z(14.05), -22, Z(16.95), 5.1);
    clothesLine(9, Z(14.05), 9, Z(17.95), 5.3);
  }
}
/* Clothesline stretched across an alley */
function clothesLine(xa, za, xb, zb, y) {
  LINES.push({ k: 'linen', a: [xa, y, za], b: [xb, y, zb] }); lineHooks([xa, y, za], [xb, y, zb]);
  const M = DECOR, R = rngOf(Math.round(xa * 13 + za * 7));
  M.save().color([0.85, 0.82, 0.76]); M.cls = 2;
  M.tube('plastic', 0.006, sagPath([xa, y, za], [xb, y, zb], 0.25, 10), 3);
  const n = 4 + Math.floor(R() * 3);
  for (let i = 1; i < n; i++) {
    const t = i / n + (R() - 0.5) * 0.05, x = lerp(xa, xb, t), z = lerp(za, zb, t), yy = y - Math.sin(t * Math.PI) * 0.25, w = 0.35 + R() * 0.3, h = 0.4 + R() * 0.5;
    M.color(PAL.awning[Math.floor(R() * PAL.awning.length)]);
    const dx = (xb - xa), dz = (zb - za), l = hyp(dx, dz), ux = dx / l, uz = dz / l;
    clothPiece(M, [x - ux * w / 2, yy - h, z - uz * w / 2], [x + ux * w / 2, yy - h, z + uz * w / 2], [x + ux * w / 2, yy, z + uz * w / 2], [x - ux * w / 2, yy, z - uz * w / 2], [uz, 0, -ux], { grp: 'linen' + xa + ',' + za }); // simulated cloth (02mc-cloths.js)
  }
  M.restore();
}

/* Power lines (thin wires between the facades) */
function buildWires() {
  const mat = new THREE.LineBasicMaterial({ color: 0x1a1612 });
  const addWire = (a, b, sag) => {
    LINES.push({ k: 'cable', a, b });
    const pts = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(new V3(lerp(a[0], b[0], t), lerp(a[1], b[1], t) - Math.sin(t * Math.PI) * sag, lerp(a[2], b[2], t))); }
    mapAdd(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
  };
  for (const s of [1, -1]) {
    addWire([-35.8, 7.5, 22 * s], [-24.1, 7.2, 34 * s], 1.2);
    addWire([-35.8, 8, 8 * s], [-24.1, 7.8, 5 * s], 1.4);
    addWire([-5.9, 7, 24 * s], [5.9, 7.2, 30 * s], 1.0);
    addWire([-20, 5.9, 14.04 * s], [-19.6, 6.0, 17.0 * s], 0.4); // across the alley, from one facade to the other
    addWire([14, 5.8, 14.04 * s], [14.4, 5.9, 18.0 * s], 0.5);
  }
}

/* Light shafts: additive volumes under the sunlit roof openings. The prism (the opening extended along the
   sun to the ground) is drawn only by its back faces; the shader follows the line of sight inside the beam, from its entry (or the eye)
   to that face, and adds up a density that fades toward the edges of the opening, toward the ground and with the dust drifting by.
   The light comes from the length traversed: soft where the line of sight merely grazes the beam, with no hard edge. Until October
   2026, every pixel of the prism received the same light, hard edges included (owner's feedback: "very pronounced rays, lacking
   softness"). In the beam frame (sheared along the sun), the prism is a box: the entry is computed by planes. */
const BEAMS = [];
function lightBeam(gx0, gx1, gz0, gz1, y, bmin, bmax) {
  const cx = (gx0 + gx1) / 2, cz = (gz0 + gz1) / 2;
  const h = rayWorld(cx, y + 0.35, cz, SUN_DIR.x, SUN_DIR.y, SUN_DIR.z, 200);
  if (h) return; // opening in the shadow of another building: no ray
  const d = SUN_DIR.clone().negate(), t = y / -d.y, o = d.multiplyScalar(t);
  const top = [[gx0, y, gz0], [gx1, y, gz0], [gx1, y, gz1], [gx0, y, gz1]], bot = top.map(([x, yy, z]) => [x + o.x, 0, z + o.z]);
  const pos = [];
  const face = (a, b, c, dd) => { for (const p of [a, b, c, a, c, dd]) pos.push(...p); };
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; face(top[i], top[j], bot[j], bot[i]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // the shaft takes the color of the light that comes in, and fades with it: a warm sun by day, a faint cold moon at night
  const A = CURMAP.def.atmo, sc = new THREE.Color(A.sunColor), k = 1.6 / Math.max(sc.r, sc.g, sc.b);
  const m = new THREE.ShaderMaterial({
    uniforms: {
      bmin: { value: new V3(...bmin) }, bmax: { value: new V3(...bmax) }, uTime: { value: 0 }, uI: { value: 0.065 * clamp(A.sunI / 2.9, 0.25, 1) },
      uC: { value: new V3(sc.r * k, sc.g * k, sc.b * k) },
      uRect: { value: new THREE.Vector4(gx0, gx1, gz0, gz1) }, uSh: { value: new V3(o.x / y, o.z / y, y) },
    },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec3 bmin, bmax, uSh, uC; uniform vec4 uRect; uniform float uTime, uI; varying vec3 vW;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){
        if (any(lessThan(vW, bmin)) || any(greaterThan(vW, bmax))) discard;
        vec3 rd = vW - cameraPosition; float L = length(rd); rd /= L;
        // beam frame: x and z brought back to plumb with the opening according to the height
        vec3 ro = vec3(cameraPosition.x - uSh.x * (uSh.z - cameraPosition.y), cameraPosition.y, cameraPosition.z - uSh.y * (uSh.z - cameraPosition.y));
        vec3 dd = vec3(rd.x + uSh.x * rd.y, rd.y, rd.z + uSh.y * rd.y);
        vec3 lo = vec3(uRect.x, 0.0, uRect.z), hi = vec3(uRect.y, uSh.z, uRect.w);
        vec3 iv = 1.0 / (dd + vec3(equal(dd, vec3(0.0))) * 1e-5), t0 = (lo - ro) * iv, t1 = (hi - ro) * iv;
        vec3 tn3 = min(t0, t1);
        float tn = max(max(max(tn3.x, tn3.y), tn3.z), 0.0);
        if (L <= tn) discard;
        float w = uRect.y - uRect.x, l = uRect.w - uRect.z, ex = min(0.42, w * 0.45), ez = min(1.2, l * 0.2), acc = 0.0;
        for (int i = 0; i < 6; i++) {
          vec3 b = ro + dd * mix(tn, L, (float(i) + 0.5) / 6.0);
          float sx = smoothstep(0.0, ex, min(b.x - uRect.x, uRect.y - b.x)), sz = smoothstep(0.0, ez, min(b.z - uRect.z, uRect.w - b.z));
          float k = clamp(b.y / uSh.z, 0.0, 1.0), fade = smoothstep(0.0, 0.45, k) * (0.45 + 0.55 * k);
          float dust = 0.7 + 0.3 * n(b.xz * 1.3 + vec2(uTime * 0.07, uTime * 0.05)) * n(b.yz * 2.1 - uTime * 0.04);
          acc += sx * sx * sz * fade * dust;
        }
        acc *= (L - tn) / 6.0; // length traversed, weighted (m)
        gl_FragColor = vec4(uC * uI * (1.0 - exp(-acc * 0.8)), 1.0);
      }`,
    // back faces only: a line of sight leaves a shaft through a single face, whether or not it is inside (both faces doubled the haze, and a line of sight
    // along the souk crossed ten)
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
  });
  const mesh = new THREE.Mesh(g, m); mesh.userData.noAO = true; mesh.renderOrder = 5; mesh.frustumCulled = false;
  mapAdd(mesh); BEAMS.push(m);
}
function buildLightBeams() {
  for (const s of [1, -1]) {
    const [zA, zB] = [20 * s, 34 * s].sort((p, q) => p - q);
    for (let x = 20; x < 36; x += 3) if (x + 3 <= 36) lightBeam(x + 2.15, x + 3, zA + 0.3, zB - 0.3, 6.5, [20.3, 0, zA + 0.3], [35.7, 6.5, zB - 0.3]);
  }
}
function updateBeams(t) { for (const m of BEAMS) m.uniforms.uTime.value = t; }

