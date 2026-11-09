/* ==========================================================================
   FLORÉAL: a botanical garden and its great greenhouse. 76 x 100 m, mirrored north-south (team Alpha in the south, +z; Bravo in the north, -z).
   Hub plan around the Grande Serre (x -19..19, z -13..13):
   CENTER "Grande Serre" : the glass jungle. In the iron and glass nave, the plaza (point B) and the two rockery outcrops that bar the
                        central path (no more line of fire from one base to the other through the middle doors), the pond where the
                        Rocher's waterfall falls, the cave under the Rocher, whose two tunnels (one per side) come out in the ravine at
                        ground level, and at the top, the Rocher terrace and the canopy walkway that crosses the ravine to the east plateau.
   WEST "Jardin japonais" : the water lily pond, its island and tea pavilion, the red bridge and the zigzag bridge;
                        cherry trees, red maples, weeping willow, stone lanterns. Rose garden and wisteria pergolas in the north and south.
   EAST "Ravin des fougères" : the ravine at the foot of the greenhouse, its stream, its tree ferns and its waterfalls, the mouths of
                        the cave tunnels; the bamboo plateau, reached by the rock stairs. Boxwood maze in the north and south.
   NORTH AND SOUTH "Parterres" : the central path, its canal and basins, the boxwood embroideries and the mosaic flower beds,
                        then the bases: the Orangerie and the gardeners' sheds, in front of the stone enclosure.
   The draws are reproducible (fixed seed): each peer of a lobby builds the same map.
   ========================================================================== */
const ATMO_FLORALIA = Object.assign({}, ATMO_DEFAULT, {
  // just after a spring shower (ambience workstream, November 2026): soft overcast, the sun lost behind a cool grey-white cloud deck
  // with brighter breaks toward the zenith; diffuse, almost shadowless light (weak sun, strong sky), wet and slightly saturated greens,
  // puddles on the paths (floraliaPuddles), light mist in the distance (fog thinned with altitude). Computed sky, no photo: its
  // clouds also light the scenery (hdri: null, the 'park' HDRI is a sunny day); contrast and saturation lifted a little against the flat light
  sun: [-0.35, 0.8, 0.45], sunColor: 0xe8eef8, sunI: 0.85, vmSun: 0xe8eef8,
  fog: [0.6, 0.64, 0.67], fogD: 0.0078, fogH: [14, 0], fogSun: 0.15,
  hemi: [0xdee6ee, 0x5a6150, 1.45], vmHemi: [0xdee6ee, 0x4a5040],
  sky: {
    zen: [0.9, 0.95, 1.04], mid: [0.74, 0.78, 0.84], hor: [0.6, 0.63, 0.66], gnd: [0.3, 0.34, 0.28],
    glow: [0.3, 0.3, 0.27], halo: [0.4, 0.39, 0.35], disk: [0, 0, 0], cloudLo: [0.28, 0.31, 0.36], cloudHi: [1.05, 1.05, 1.04], cloud: [0.36, 0.5, 0.97],
    ridge: [0, 0, 0], ridgeSnow: [1, 1, 1], ridgeRock: [0.5, 0.5, 0.5],
  },
  envGround: 0x4c5442, hdri: null,
  bounce: [0.55, 0.6, 0.55], dust: [0.5, 0.52, 0.5], motes: [0.8, 0.85, 0.85],
  grade: { lo: [0.95, 1.0, 1.05], hi: [1.02, 1.01, 0.98], exp: 1.1, sat: 1.12, con: 1.14 }, rays: [0.5, 0.5, 0.5],
  impact: [0.34, 0.32, 0.26], wind: [300, 0.06],
  bloom: [0.22, 0.5, 0.95], aoFloor: 0.4, raysThr: 3.5, raysCap: 6, satExp: 0.95,
  volOpen: true,
});

function floraliaLevel() {
  const sp = new Splat();
  FLO_HOLES.length = 0; WFALLS.length = 0;
  floraliaPaint(sp);
  floraliaPerimeter();
  for (const s of [1, -1]) { floraliaBase(s); floraliaParterre(s); }
  floraliaGreenhouse(); floraliaJapan(); floraliaRavine();
  for (const sg of [1, -1]) { floraliaMaze(sg, sg > 0 ? 4711 : 4712); floraliaRoseGarden(sg, rngOf(sg > 0 ? 2201 : 2202)); floraliaLawns(sg, rngOf(sg > 0 ? 3301 : 3302)); }
  floraliaParis(); floraliaLife(); floraliaPuddles();
  const R = rngOf(8181);
  lawnTufts(R, sp, [-37, 37, -49, 49], 2600, FLO_HOLES, (x, z) => Math.abs(x) < 17.3 && Math.abs(z) > 44.1); // no grass in the orangeries (it poked through the tiling)
  floralGroundMesh(sp.finish(0.12), FLO_HOLES);
  FLO_SPLAT = sp;
}

/* ---------- Ground: gravel paths, paving, humus ---------- */
function floraliaPaint(sp) {
  // central path and its paving borders, domination roundabout, base forecourts, canal
  for (const s of [1, -1]) {
    const Z = (z) => z * s;
    sp.rect(1, -4.4, 4.4, Math.min(Z(14), Z(46)), Math.max(Z(14), Z(46)), 0.4, 1, 0.5); sp.rect(0, -3.4, 3.4, Math.min(Z(14), Z(46)), Math.max(Z(14), Z(46)), 0.3, 1, 0.4);
    sp.disc(1, 0, Z(30), 7.2, 0.5, 1, 0.5); sp.disc(0, 0, Z(30), 6.0, 0.4, 1, 0.5);
    sp.rect(0, -34, 34, Math.min(Z(38.5), Z(44.4)), Math.max(Z(38.5), Z(44.4)), 0.8, 1, 1.2); // base forecourts
    sp.rect(1, -17, 17, Math.min(Z(44.4), Z(46)), Math.max(Z(44.4), Z(46)), 0.3, 1, 0.5);
    // flower bed paths: 1 m paths between the embroideries
    for (const x of [-11.1, 11.1, -4.7, 4.7]) sp.rect(0, x - 0.55, x + 0.55, Math.min(Z(26.2), Z(40.2)), Math.max(Z(26.2), Z(40.2)), 0.25, 1, 0.3);
    for (const zz of [26.2, 31.1, 36.1, 40.2]) for (const sx of [-1, 1]) sp.rect(0, sx > 0 ? 4.7 : -17.6, sx > 0 ? 17.6 : -4.7, Z(zz) - 0.5, Z(zz) + 0.5, 0.25, 1, 0.3);
  }
  // Japanese garden: paths around the pond, dry garden, humus under the cherry trees; ravine: gravel bed of the stream, trail, humus of the undergrowth
  sp.path(0, [[-19.5, 0], [-21.0, 0]], 1.2, 0.3); sp.path(0, [[-21.2, -9.6], [-27, -10.6], [-33.4, -9.8], [-36.2, -6], [-36.4, 0], [-36.2, 6], [-33.4, 10.4], [-28.4, 10.8], [-24, 9.8], [-21.2, 7.4]], 1.0, 0.3);
  sp.rect(0, -36.4, -26.6, -15.4, -11.2, 0.3, 1, 0.3); sp.rect(0, -23, -21, -3, 3, 0.3, 1, 0.3); sp.rect(0, -30.3, -27.9, 8.6, 10.9, 0.4, 1, 0.3); // arrival of the straight bridge
  for (const [x, z, r] of [[-20.8, -10.4, 3], [-27.2, -12.6, 3], [-33.4, -11.2, 3], [-36, 7.5, 3], [-23.8, 11, 3], [-31, 12, 3], [-20.8, 7.2, 3]]) sp.disc(2, x, z, r, 1.2, 0.8, 1.2);
  sp.path(0, RAVINE_STREAM, 1.9, 0.5, 1, 0.5); sp.path(0, [[21, -14], [21.2, -8], [21, 0], [21.2, 8], [21, 15]], 0.9, 0.3); sp.rect(2, 19.6, 27.6, -14.2, 15.6, 1.2, 0.7, 1.4);
  for (const s of [1, -1]) sp.path(0, [[19.2, s * 6.5], [21.1, s * 7.0]], 0.9, 0.3); // the trail branches off to the mouth of each cave tunnel
  sp.rect(1, 9.6, 19.3, -7.5, 7.5, 0.1, 1, 0.1); // stone floor of the cave and its tunnels (no grass tufts sown there, footsteps on stone)
  sp.rect(1, 28.6, 32.4, -22.4, -13.2, 0.3, 1, 0.3); sp.rect(1, 28.6, 32.4, 13.2, 22.4, 0.3, 1, 0.3);
  // mazes, rose gardens, promenade
  for (const s of [1, -1]) {
    const Z = (z) => z * s, zz = (a, b) => [Math.min(Z(a), Z(b)), Math.max(Z(a), Z(b))];
    sp.rect(0, 19.2, 35.8, ...zz(23.2, 37.2), 0.3, 1, 0.4); sp.rect(0, -37, 37, ...zz(14.6, 16.6), 0.3, 1, 0.5); sp.rect(1, -37, 37, ...zz(14.1, 14.6), 0.25, 1, 0.3); sp.rect(1, -37, 37, ...zz(16.6, 17.1), 0.25, 1, 0.3);
    sp.rect(0, -26.6 - 0.8, -26.6 + 0.8, ...zz(24.5, 37.8), 0.3, 1, 0.3); sp.rect(0, -34.9 - 0.4, -18.0, ...zz(30.4, 32.0), 0.3, 1, 0.3); sp.disc(1, -26.6, Z(31.2), 3.0, 0.3, 1, 0.3);
    sp.rect(0, -34.9, -32.3, ...zz(24.8, 37.7), 0.3, 1, 0.3); sp.rect(0, -20.9, -18.3, ...zz(24.8, 37.7), 0.3, 1, 0.3);
    for (const [x, z] of [[-14, 19.8], [-8.6, 22.6], [14, 19.8], [8.8, 22.8], [24, 18.5], [19.2, 21.5], [-22.5, 19]]) sp.disc(2, x, Z(z), 2.6, 1.2, 0.7, 1.2);
  }
  // outside: paved sidewalks of the boulevard (the roadway is a cobbled backdrop, see 02y-paris.js)
  parisFrame(PARIS.walkIn[1], PARIS.walkIn[3], PARIS.walkIn[0], PARIS.walkIn[2], (a, b, c, d) => sp.rect(1, a, b, c, d, 0.3, 1, 0.3));
  parisFrame(PARIS.walkOut[1], PARIS.walkOut[3], PARIS.walkOut[0], PARIS.walkOut[2], (a, b, c, d) => sp.rect(1, a, b, c, d, 0.3, 1, 0.3));
  // the greenhouse: humus everywhere, paving of the path, the plaza, the vestibule, the pond bank and the foot of the ramps
  const [x0, x1, z0, z1] = FL.greenhouse;
  sp.rect(2, x0 + 0.3, x1 - 0.3, z0 + 0.3, z1 - 0.3, 0.4, 1, 0.5);
  sp.rect(1, -2.2, 2.2, z0 + 0.3, z1 - 0.3, 0.3, 1, 0.3); sp.rect(1, -11, 2.2, -6.8, 6.8, 0.3, 1, 0.3); sp.rect(1, x0 + 0.3, -10, -2.4, 2.4, 0.3, 1, 0.3);
  sp.rect(1, 6.5, 9.5, -7.5, 7.5, 0.3, 1, 0.3);
  for (const s of [-1, 1]) { sp.rect(1, -13.2, -10.8, Math.min(s * 6.8, s * 13), Math.max(s * 6.8, s * 13), 0.3, 1, 0.3); sp.rect(1, 2.2, 9.5, Math.min(s * 9.0, s * 12.6), Math.max(s * 9.0, s * 12.6), 0.3, 1, 0.3); }
}
/* ---------- After the rain: puddles on the gravel and the paving (puddleAdd, 02l-port.js) ---------- */
function floraliaPuddles() {
  // [x, z, w, d, rot] on the Alpha side (z > 0), Bravo's are the mirror (other shapes): path, forecourt, promenade, parterre and rose garden paths.
  // Only in the open: a puddle reflects the bright sky, under the trees it would shine in the shade
  const P = [[1.2, 40.2, 1.9, 1.3, 0.2], [-1.9, 27.6, 2.0, 1.3, 1.3], [-9.5, 41.6, 3.0, 1.9, 0.4], [13.2, 40.9, 2.6, 1.7, 2.1], [-24.5, 42.2, 2.2, 1.5, 0.9],
    [-17.5, 15.6, 2.6, 1.2, 0.05], [-6.6, 15.7, 2.4, 1.2, 3.1], [6.5, 15.5, 2.4, 1.3, 0.1], [-11.1, 33.4, 0.8, 1.7, 0], [-26.6, 26.2, 1.1, 1.9, 0.1]];
  for (const s of [1, -1]) P.forEach(([x, z, w, d, rot], i) => puddleAdd(x, s * z, w, d, s * rot, i + (s > 0 ? 1 : 21), 0.03));
  puddleAdd(-20.4, -1.4, 1.0, 1.4, 0, 41, 0.03); // in front of the west door (the Japanese garden is not mirrored)
}
/* ---------- Enclosure wall ---------- */
function floraliaPerimeter() {
  const [X, Z] = [38, 50], R = rngOf(4141);
  gardenWall(-X, -X + 1, -Z, Z, 3.2, { pil: 6.25 });
  // east wall: facing the plateau (terrace at 3.6 m), it rises to 4.6 m and acts as a 1 m low wall at the edge of the terrace; elsewhere, 3.2 m
  const PZ = PLATEAU.z1;
  gardenWall(X - 1, X, -Z, -PZ, 3.2, { pil: 6.25 }); gardenWall(X - 1, X, -PZ, PZ, FL.high + 1.0, { pil: 4.4 }); gardenWall(X - 1, X, PZ, Z, 3.2, { pil: 6.25 });
  for (const s of [1, -1]) {
    const [a, b] = [s * (Z - 1), s * Z].sort((p, q) => p - q);
    gardenWall(-X + 1, -17, a, b, 3.2, { pil: 5.5 }); gardenWall(17, X - 1, a, b, 3.2, { pil: 5.5 });
  }
  // invisible coping: the top of the wall (3.2 m) is within reach of the plateau terrace (3.6 m) at the edge of its low wall, nobody walks on it
  glassWall(-X, -X + 1, 3.1, 30, -Z, Z); glassWall(X - 1, X, 3.1, 30, -Z, Z); glassWall(-X, X, 3.1, 30, -Z, -Z + 1); glassWall(-X, X, 3.1, 30, Z - 1, Z);
  void R;
}
/* ---------- Bases: the Orangerie and the gardeners' sheds ---------- */
/* Arched glazing of a facade opening (wall at z = zc, x from a to b, y from y0 to y1, arch of height rise), fan of triangles */
function archGlass(zc, a, b, y0, y1, rise, n) {
  const M = DECOR, ys = y1 - rise, xc = (a + b) / 2, hw = (b - a) / 2, P = [[a, y0], [b, y0], [b, ys]];
  for (let i = 1; i < 10; i++) { const t = i / 10, ang = t * Math.PI, hx = Math.cos(ang) * hw; P.push([xc + hx, ys + Math.sin(ang) * rise]); }
  P.push([a, ys]);
  M.save().color([0.9, 1, 0.95]); M.cls = 1;
  for (let i = 1; i < P.length; i++) M.tri3('glassT', [xc, zc, y0].slice(0, 0).concat([xc, y0, zc]), [P[i][0], P[i][1], zc], [P[(i + 1) % P.length][0], P[(i + 1) % P.length][1], zc], [0, 0, n]);
  M.restore();
}
function floraliaBase(s) {
  const Z = (z) => z * s, zr = (a, b) => [Z(a), Z(b)].sort((p, q) => p - q), M = DECOR, R = rngOf(s > 0 ? 311 : 312);
  const X0 = -17, X1 = 17, H = 6.2, t = 0.5, [za, zb] = zr(44.4, 50), tint = [0.96, 0.92, 0.82], o = { tint, frames: false, m: 'concrete' };
  // garden-side facade: doors and large arched windows, 3.8 m bay
  const ops = [];
  for (let i = 0; i < 9; i++) { const c = -15.2 + i * 3.8, door = i === 1 || i === 4 || i === 7; ops.push(door ? { a0: c - 1.25, a1: c + 1.25, b0: 0, b1: 4.4, arch: 1.25 } : { a0: c - 1.0, a1: c + 1.0, b0: 0.9, b1: 4.7, arch: 1.0 }); }
  const zf = Z(44.4) + s * t / 2;
  wallOpen('ashlar', 'x', zf, t, X0, X1, 0, H, ops, o);
  const [sa, sb] = zr(44.4 + t, 50 - t); // between the facade and the back (doubled corners flickered)
  wallOpen('ashlar', 'z', X0 + t / 2, t, sa, sb, 0, H, [], o); wallOpen('ashlar', 'z', X1 - t / 2, t, sa, sb, 0, H, [], o); wallOpen('ashlar', 'x', Z(50) - s * t / 2, t, X0, X1, 0, H, [], o);
  // windows: arched glazing, mullions, sill; an invisible glass wall closes them to soldiers (not to bullets); the doors stay wide open (no glass, mullion or threshold)
  for (const op of ops) {
    if (op.b0 === 0) continue;
    const r = op.arch; archGlass(zf, op.a0, op.a1, op.b0, op.b1, r, s);
    M.save().color([0.92, 0.9, 0.84]).local(1); M.cls = 1; M.boxB('paintwood', op.a0, op.a1, op.b0 + 0.05, op.b0 + 0.08, zf - 0.03, zf + 0.03); M.boxB('paintwood', (op.a0 + op.a1) / 2 - 0.03, (op.a0 + op.a1) / 2 + 0.03, op.b0, op.b1 - r, zf - 0.03, zf + 0.03); M.restore();
    glassWall(op.a0, op.a1, op.b0, op.b1, zf - 0.1, zf + 0.1);
  }
  box('tiles', X0 + t, X1 - t, 0, 0.02, za + t, zb - t, { collide: false, ao: false, tint: [0.9, 0.88, 0.84] });
  box('plaster', X0 - 0.3, X1 + 0.3, H - 0.1, H + 0.3, Z(44.4) - s * 0.3, Z(44.4) + s * 0.1, { tint: [0.9, 0.87, 0.78], collide: false });
  slateRoof(X0 - 0.4, X1 + 0.4, za - 0.3, zb + 0.1, H, { alongX: true, pitch: 0.62, tint: [0.46, 0.5, 0.56], gable: tint, gableMat: 'plaster', chimneys: 2, dormers: [[-s, 5]], R });
  // plaster ceiling under the framework (without it, you see the underside of the roof and the sky from inside the hall)
  box('plaster', X0 + t, X1 - t, H - 0.25, H, Z(44.4) + s * t, Z(50) - s * t, { tint: [1, 0.97, 0.9], ao: false, uv: 3, collide: false });
  // glass canopy above the middle door
  M.save().color(GREENHOUSE_IRON).local(1); for (const x of [-1.6, 1.6]) M.tube('paint', 0.04, [[x, 3.4, Z(44.4) - s * 0.05], [x, 4.6, Z(44.4) - s * 0.05], [x, 4.6, Z(44.4) - s * 1.8]], 5);
  M.restore(); glassQuad(M, [-1.6, 4.6, Z(44.4) - s * 1.8], [1.6, 4.6, Z(44.4) - s * 1.8], [1.6, 4.6, Z(44.4)], [-1.6, 4.6, Z(44.4)], [0, 1, 0]);
  // interior: long collection table, cabinets against the back wall, pendant lights
  const zc = Z(47.2), [ca, cb] = zr(48.85, 49.6);
  box('wood', -6, 6, 0.0, 0.85, zc - 0.7, zc + 0.7, { tint: [0.55, 0.38, 0.22], bevel: 0.02 });
  for (const x of [-12.5, 12.5]) box('wood', x - 1.6, x + 1.6, 0, 2.4, ca, cb, { tint: [0.45, 0.32, 0.2] });
  for (const x of [-9, 0, 9]) pendantLamp(x, 3.4, zc, 5.6);
  // potting benches in the back corners (dead ends), boxwood beds between the orangerie and the sheds and behind the sheds
  // (recesses closed off by the enclosure wall)
  for (const sx of [-1, 1]) {
    const [p0, p1] = [sx * 14.25, sx * 16.45].sort((p, q) => p - q);
    box('wood', p0, p1, 0, 0.9, ...zr(47.3, 49.45), { tint: [0.5, 0.36, 0.22], bevel: 0.02 });
    for (const dz of [47.8, 48.6]) M.dyn('pot', sx * 15.3, 0.9, Z(dz), R() * TAU, { tint: [0.76, 0.42, 0.28], s: 0.9 });
    for (const [h0, h1] of [[17.3, 20.7], [34.3, 36.7]]) { const [q0, q1] = [sx * h0, sx * h1].sort((p, q) => p - q); hedge(q0, q1, ...zr(45.0, 49.0), 1.6, { bevel: 0.12 }); }
  }
  // the gardeners' sheds: shelter open onto the garden, benches, pots, straw bales, wheelbarrows
  for (const [a, b, sd] of [[21, 34, 1], [-34, -21, 2]]) {
    const [fa, fb] = zr(44.4, 49.8), zrf = Z(44.2);
    box('plaster', a, a + 0.3, 0, 3.4, fa, fb, { tint: [0.9, 0.86, 0.76] }); box('plaster', b - 0.3, b, 0, 3.4, fa, fb, { tint: [0.9, 0.86, 0.76] });
    M.save().color([0.62, 0.64, 0.6]).world(1); M.quad('corrugated', [a - 0.3, 3.0, zrf], [b + 0.3, 3.0, zrf], [b + 0.3, 3.9, Z(49.9)], [a - 0.3, 3.9, Z(49.9)], [0, 1, -0.3 * s]);
    M.quad('corrugated', [a - 0.3, 3.0, zrf], [a - 0.3, 3.9, Z(49.9)], [b + 0.3, 3.9, Z(49.9)], [b + 0.3, 3.0, zrf], [0, -1, 0.3 * s]); M.restore(); // and its underside
    DECOR.col(a, b, 3.0, 3.35, fa, fb, 'metal', true);
    for (let x = a + 0.5; x < b; x += 3.2) post(x, Z(44.5), 0, 3.0, 0.24, [0.4, 0.3, 0.22]);
    // bench against the enclosure wall (z 49): it sank 70 cm into it, and its pots with it
    box('wood', a + 0.6, b - 0.6, 0, 0.9, ...zr(48.2, 49.0), { tint: [0.5, 0.36, 0.22], bevel: 0.02 });
    for (let x = a + 1.2; x < b - 1; x += 1.7) { M.dyn('pot', x, 0.9, Z(48.6), R() * TAU, { tint: [0.76, 0.42, 0.28], s: 0.9 }); M.dyn('pot', x + 0.45, 0.9, Z(48.5), R() * TAU, { tint: [0.7, 0.38, 0.25], s: 0.7 }); }
    M.dyn('hayBale', a + 1.0, 0, Z(46.4), 0.2); M.dyn('hayBale', a + 1.0, 0.45, Z(46.4), 0.05); M.dyn('spiceSack', b - 1.2, 0, Z(46.0), 0.5, { tint: [0.8, 0.78, 0.7] }); M.dyn('spiceSack', b - 1.9, 0, Z(46.3), 1.2, { tint: [0.4, 0.34, 0.28] });
    M.dyn('jerrycan', a + 2.4, 0, Z(45.6), 0.3, { tint: [0.2, 0.5, 0.3] }); M.dyn('barrel', b - 2.0, 0, Z(47.4), 0.4); // in front of the bench, not inside it
    M.place(PF.wheelbarrow(), a + 3.3, 0, Z(46.6), 0.5 * (sd > 1 ? -1 : 1));
  }
}
/* Gardener's wheelbarrow: tray, wheel, handles (fixed scenery) */
PF.wheelbarrow = () => prefab('wheelbarrow', (M) => {
  M.save().local(1); M.color([0.2, 0.42, 0.3]); M.boxB('paint', -0.34, 0.34, 0.38, 0.62, -0.35, 0.45, { bevel: 0.05 });
  M.color([0.55, 0.38, 0.22]); for (const x of [-0.25, 0.25]) M.tube('wood', 0.025, [[x, 0.4, -0.2], [x, 0.4, -0.9]], 5);
  M.color([0.12, 0.12, 0.12]); M.save().move(0, 0.2, 0.62).rotZ(Math.PI / 2); M.cyl('rubber', 0.2, 0.08, 10); M.restore();
  M.color([0.3, 0.3, 0.3]); for (const x of [-0.12, 0.12]) M.tube('steel', 0.02, [[x, 0.2, 0.62], [x, 0.4, 0.4]], 4);
  M.restore(); M.col(-0.4, 0.4, 0, 0.7, -0.9, 0.7, 'metal');
});
/* ---------- Parterres: path, basin, boxwood embroideries and flower mosaic ---------- */
function floraliaParterre(s) {
  const Z = (z) => z * s, zr = (a, b) => [Z(a), Z(b)].sort((p, q) => p - q), M = DECOR, R = rngOf(s > 0 ? 511 : 512);
  basin(0, Z(36.5), 2.3);
  const kinds = ['tulipR', 'roseP', 'lavender', 'agapanthus', 'dahlia', 'tulipP', 'roseW', 'hydB', 'peony', 'roseY', 'iris', 'azalea'];
  let ki = s > 0 ? 0 : 5;
  for (const sx of [-1, 1]) for (const cx of [0, 1]) for (const rz of [0, 1, 2]) {
    const x0 = 5.2 + cx * 6.4, x1 = x0 + 5.4, z0 = 26.7 + rz * 5.0, z1 = z0 + 4.0, [a, b] = [sx * x0, sx * x1].sort((p, q) => p - q), [c, d] = zr(z0, z1);
    // low boxwood border and earth bed (the sides stop inside the ends: at the corners, two faces in the same plane flickered);
    // along the path, the middle beds have a 1.8 m hornbeam hedge (cut at the cross paths): A can no longer be seen from the spawns
    if (cx === 0) {
      const [ta, tb] = sx > 0 ? [a, a + 0.35] : [b - 0.35, b], [ea, eb] = sx > 0 ? [a + 0.35, b] : [a, b - 0.35], [oa, ob] = sx > 0 ? [b - 0.35, b] : [a, a + 0.35];
      hedge(ta, tb, c, d, 1.8, { bevel: 0.1 });
      for (const [hx0, hx1, hz0, hz1] of [[ea, eb, c, c + 0.35], [ea, eb, d - 0.35, d], [oa, ob, c + 0.3, d - 0.3]]) hedge(hx0, hx1, hz0, hz1, 0.42, { collide: false, bevel: 0.08 });
    } else for (const [hx0, hx1, hz0, hz1] of [[a, b, c, c + 0.35], [a, b, d - 0.35, d], [a, a + 0.35, c + 0.3, d - 0.3], [b - 0.35, b, c + 0.3, d - 0.3]]) hedge(hx0, hx1, hz0, hz1, 0.42, { collide: false, bevel: 0.08 });
    const k = kinds[ki++ % kinds.length];
    for (let x = a + 0.5; x < b - 0.4; x += 0.5) for (let z = c + 0.5; z < d - 0.4; z += 0.5) {
      M.place(PF.clump(k, 'leafB', 0.62, 0.62, 3, 1 + Math.floor(R() * 4), { cls: 2 }), x + R.range(-0.14, 0.14), 0, z + R.range(-0.14, 0.14), R() * TAU, { s: R.range(0.85, 1.2) });
    }
  }
  // linden trees of the path and topiaries at the corners
  for (const sx of [-1, 1]) for (let z = 25.0; z < 40; z += 7.5) M.place(PF.tree('linden', 11.5, 3.4, Math.round(z * 3 + sx * 7 + s), { shape: 'round' }), sx * 6.9, 0, Z(z), R() * TAU);
  for (const sx of [-1, 1]) for (const [x, z] of [[4.0, 25.4], [2.8, 41.4]]) M.place(PF.topiary(sx > 0 ? 'cone' : 'spiral', 1.1), sx * x, 0, Z(z), 0); // in the north, at the entrance of the path: neither in the bench at z = 40.5, nor on the spawns at z = 42.4
}
/* ---------- The Grande Serre ---------- */
function floraliaGreenhouse() { greenhouseShell(); greenhouseWalls(); greenhouseRock(); greenhousePond(); greenhouseCatwalk(); greenhouseOutcrops(); greenhousePlanting(); }

/* ---------- Sound ambience: murmur of waterfalls and fountains, birdsong ---------- */
const FLO_AMB = { out: null, nodes: [], on: false, next: 0 };
/* A spatialized water murmur (looped filtered noise) at (x, y, z), of strength k */
function floraliaRumble(x, y, z, k, f) {
  const ctx = AU.ctx, A = FLO_AMB, src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), hp = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createPanner();
  src.buffer = AU.noise; src.loop = true; src.playbackRate.value = rand(0.7, 0.95);
  bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 0.45; hp.type = 'highpass'; hp.frequency.value = 220; g.gain.value = k;
  p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = 4; p.rolloffFactor = 1.5; p.maxDistance = 90;
  if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z);
  src.connect(bp); bp.connect(hp); hp.connect(g); g.connect(p); p.connect(A.out); src.start(ctx.currentTime, rand(0, 1.5)); A.nodes.push(src, bp, hp, g, p);
}
/* Started when a match launches, stopped on return to the menus (setAmbience, 05-audio.js) */
function floraliaAmbience(on) {
  const A = FLO_AMB; A.on = on; if (!AU.ready) return;
  if (on && SFX_PACKS.amb_floralia) on = false; // recorded ambience (MAP_DEFS.floralia.sound): the synthesis is used only without it
  if (on && !A.out) {
    A.out = AU.ctx.createGain(); A.out.gain.value = 0; A.out.connect(AU.bus);
    for (const w of WFALLS) floraliaRumble(w.x, w.y + 1.2, w.z, 0.3 * Math.min(1.6, w.w / 2.2), 900);
    for (const sg of [1, -1]) floraliaRumble(0, 0.6, sg * 36.5, 0.07, 1800);
    floraliaRumble(24, 0.4, 2, 0.1, 1500); floraliaRumble(8.9, -0.3, 0, 0.12, 1700);
  }
  if (A.out) A.out.gain.setTargetAtTime(on ? 1 : 0, AU.ctx.currentTime, 0.6);
}
function floraliaAmbienceStop() {
  const A = FLO_AMB; A.on = false;
  for (const n of A.nodes) { try { if (n.stop) n.stop(); n.disconnect(); } catch (e) { /* already stopped */ } }
  A.nodes.length = 0; if (A.out) { try { A.out.disconnect(); } catch (e) { /* same */ } A.out = null; }
}
/* A bird song perched in the trees: rising whistles of a passerine, trill, cooing of a pigeon */
function sfxBird(pos) {
  if (!AU.ready) return;
  const t = AU.ctx.currentTime + 0.02, o = auOut(pos, 0.3, 0.55, 1.1, 3), k = Math.random();
  if (k < 0.4) { const n = 2 + Math.floor(Math.random() * 3), f = rand(2500, 3700); for (let i = 0; i < n; i++) tn(o, t + i * 0.14, 0.1, f * rand(0.92, 1.08), f * rand(1.25, 1.55), 'sine', 0.15); }
  else if (k < 0.8) { const f = rand(3000, 4300), n = 7 + Math.floor(Math.random() * 6); for (let i = 0; i < n; i++) tn(o, t + i * 0.05, 0.045, f * (i % 2 ? 1 : 1.2), f * (i % 2 ? 1.14 : 1.02), 'sine', 0.09); }
  else { const f = rand(380, 470); for (const dt of [0, 0.32, 0.56, 0.8]) tn(o, t + dt, 0.2, f, f * 0.88, 'sine', 0.2, 0.04); }
}
function floraliaBirds(dt) {
  const A = FLO_AMB; if (!A.on || !AU.ready || SFX_PACKS.amb_floralia) return;
  A.next -= dt; if (A.next > 0) return;
  A.next = rand(1.5, 5);
  const cam = camera.position, a = rand(0, TAU), d = rand(8, 28);
  sfxBird(new V3(clamp(cam.x + Math.cos(a) * d, MAP.x0, MAP.x1), rand(4, 10), clamp(cam.z + Math.sin(a) * d, MAP.z0, MAP.z1)));
}
/* Ground distribution of the loaded map (gravel, paving, humus, lawn): used for footstep sounds; released with the map */
let FLO_SPLAT = null;
/* Bot points of interest on the Alpha side (z > 0): [x, y, z, route, hold]; the Bravo side is the mirror in z.
   Route L: Japanese garden, rose garden and its pergolas; M: path, parterres, greenhouse nave; E: Rocher, cave and its tunnel, ravine, plateau, maze.
   Hold (1): post to hold, under cover or elevated (kiosk, pergolas, nave outcrop, Rocher terrace, plateau, maze). */
const FLO_POI = [
  [-26.6, 0.26, 31.2, 'L', 1], [-33.6, 0, 28, 'L', 1], [-19.6, 0, 34, 'L', 1], [-31, 0, 21, 'L'], [-24, 0, 17.6, 'L', 1], [-33, 0, 15.3, 'L'],
  [-27.5, 0, 11.4, 'L', 1], [-21.2, 0, 7.8, 'L'], [-21.2, 0, 3.4, 'L', 1], [-26, 0, 40.2, 'L'],
  [0, 0, 40.2, 'M'], [-4.7, 0, 33.6, 'M', 1], [4.7, 0, 33.6, 'M', 1], [-7, 0, 20.5, 'M', 1], [7, 0, 20.5, 'M', 1], [-4.2, 0, 15.6, 'M'], [4.2, 0, 15.6, 'M'],
  [0, 0, 11.4, 'M'], [-12, 0, 11.4, 'M'], [-14, 0, 8.5, 'M', 1], [-11.5, 0, 8.4, 'M'], [6, 0, 8.3, 'M'], [-3.4, 0, 4.5, 'M', 1],
  [12.5, 3.6, 10, 'E', 1], [16.5, 3.6, 6, 'E', 1], [12, 3.6, 2.5, 'E', 1], [12.5, 0, 4.5, 'E', 1], [16.5, 0, 6.5, 'E'],
  [24.5, 0, 17, 'E'], [26.5, 0, 21.5, 'E'], [33, 3.6, 8, 'E', 1], [33, 3.6, 4, 'E', 1], [30, 3.6, 12, 'E', 1], [22, 0, 8.5, 'E'], [25.4, 0, 3, 'E', 1],
  [30.5, 0, 25.5, 'E', 1], [27.5, 0, 34.5, 'E', 1], [21.5, 0, 28.5, 'E'], [36.2, 0, 30, 'E'], [26, 0, 40.2, 'E'],
];
// the two landmarks of Floralia, outside the play area (drawn by floraliaParis, 02y-paris.js): the dome in the north, the iron tower in the south
const PARIS_DOME = [-24, -104], PARIS_TOUR = [30, 114];
MAP_DEFS.floralia = {
  type: 'open', // large and open (lawns, paths): README "Map design rules"; sets the bots' weapon choice (botArmForMap)
  bounds: { x0: -38, x1: 38, z0: -50, z1: 50 },
  textures: ['plaster', 'stone', 'wood', 'lawn', 'humus', 'flagstone', 'pathgravel', 'bark', 'ashlar', 'slate', 'concrete', 'steel', 'timber', 'shutter'],
  surfaces: FLORA_SURFACES.concat(['slate']),
  // recorded ambience (05c-ambiance.js): breeze in the foliage and distant city, greenhouse waterfalls, fountains, ravine stream and
  // basin, birdsong (the floraliaAmbience synthesis is now used only as a fallback)
  sound: { pack: 'amb_floralia', bed: 0.4, fountain: 0.3,
    loops: () => WFALLS.map((w) => ({ id: 'a_waterfall', p: [w.x, w.y + 1.2, w.z], gain: 0.6 * Math.min(1.6, w.w / 2.2), ref: 4, roll: 1.4, max: 90 }))
      .concat([{ id: 'a_fountain', p: [24, 0.4, 2], gain: 0.25 }, { id: 'a_fountain', p: [8.9, -0.3, 0], gain: 0.2 }]),
    spots: [{ id: 'a_bird', every: [2, 6], gain: 0.35, dist: [8, 28], y: [4, 10] }] },
  kit: () => floraKit(),
  materials: (M) => { makeFloraMaterials(M); M('slate', { tex: 'slate', env: 0.7, macro: 0.3, grime: 0.3 }); },
  art: { cam: [0.0, 1.75, 42.9], look: [0.4, 4.6, 18], fov: 62 }, // on the axis of the path lined with hornbeam hedges
  // blades of grass of the lawns (02nb-lawn.js): mown lawn, short and dense, darker and greener after the rain; nothing on the paths, paving or humus of the beds
  grass: {
    density: (x, z) => { const S = FLO_SPLAT; return S && !(Math.abs(x) < 17.3 && Math.abs(z) > 44.1) ? clamp((0.75 - Math.max(S.at(0, x, z), S.at(1, x, z), S.at(2, x, z))) * 2, 0, 1) : 0; }, // plain lawn only (not on the tiling of the orangeries either)
    height: (x, z, r) => 0.16 + 0.14 * r,
    colors: [[0.05, 0.14, 0.03], [0.2, 0.4, 0.08], [0.38, 0.45, 0.16]],
    wind: [0.6, 0.8, 0.3], width: 0.011, amb: 0.4, seed: 6161,
  },
  splat: { x0: -92, z0: -108, w: 184, d: 216, ppm: 3 },
  far: 300,
  build() { bendInit(MAP); floraliaLevel(); },
  update(t, dt) { floraUpdate(t, dt); waterfallsUpdate(t, dt); koiUpdate(t, dt); floraliaBirds(dt); },
  ambience: floraliaAmbience,
  unload() { bendClear(); LIFE.mats.length = 0; KOI.list.length = 0; KOI.geos.length = 0; KOI.mat = null; floraliaAmbienceStop(); FLO_SPLAT = null; },
  // spawns of team Alpha (south, +z); those of Bravo are the mirror: in the Orangerie, facing its three doors, on the forecourt in front of the facade and in the two sheds
  spawns: [[-11.4, 45.6], [-10.0, 47.4], [0, 45.6], [2.3, 45.4], [11.4, 45.6], [12.6, 47.5], [-6.5, 43.5], [-4, 42.4], [4, 42.4], [8, 42.2], [-14.5, 43.5], [14.5, 42.4], [-20, 42.4], [20, 42.4], [-28.7, 46.2], [-25.5, 47.2], [26.3, 46.2], [29.5, 47.2]],
  poi: FLO_POI.flatMap((p) => [p, [p[0], p[1], -p[2], p[3], p[4]]]).concat([[-21, 0, 0, 'L'], [-27.4, 0.5, 0.8, 'L', 1], [12.5, 0, 0, 'E', 1], [23.5, 3.6, 0, 'E', 1], [33, 3.6, 0, 'E', 1]]),
  // domination: A and C on the approach to each base, in the path lined with hornbeam hedges (out of view of the spawns); B on the greenhouse plaza, in front of the west door
  dom: [[0, 30], [-12, 0], [0, -30]], // placed by the owner with the zones tool (?tool=zones, October 2026)
  mecha: [[12.5, 21.5], [-22, -23], [13, -22.5], [-23.5, 12.5]], // mecha drop zones (08f-mecha.js, mnavZones), placed likewise
  lane: (x) => (x < -15 ? 'L' : x > 15 ? 'E' : 'M'),
  // high landmarks, one per half, outside the garden (floraliaParis): in the north the dome (Bravo), in the south the iron tower (Alpha)
  landmarks: [[PARIS_DOME[0], 42, PARIS_DOME[1], 'dome'], [PARIS_TOUR[0], 70, PARIS_TOUR[1], 'iron tower']],
  sniper: [33.5, 3.6, 8.5], // the plateau: the ravine, the Rocher and the mazes in a row
  coverZ: 42, heli: [32, 50], cam: 52,
  // gravel of the paths, paving, humus of the greenhouse and the beds, otherwise lawn (the Rock's terrace is earth, above the stone floor of its cave)
  surface: (p) => { const S = FLO_SPLAT; if (!S) return 'grass'; if (p.y > 3 && p.x > 9.5 && p.x < 19) return 'dirt'; return S.at(1, p.x, p.z) > 0.5 ? 'concrete' : S.at(0, p.x, p.z) > 0.5 ? 'gravel' : S.at(2, p.x, p.z) > 0.5 ? 'dirt' : 'grass'; },
  zones: [
    [_t('Catwalk'), 19, 27.8, -1.4, 1.4], [_t('Grotto'), 9.5, 14.5, -7.5, 7.5], [_t('Grotto'), 14.5, 19.3, 5.5, 7.5], [_t('Grotto'), 14.5, 19.3, -7.5, -5.5], [_t('Rock'), 9.5, 19, -13, 13], [_t('Greenhouse pond'), 2.9, 9.5, -6, 6], [_t('Great Greenhouse'), -19, 19, -13, 13],
    [_t('Tea island'), -32.5, -25.5, -3.5, 3.5], [_t('Japanese garden'), -38, -19, -13.2, 13.2], [_t('Plateau'), 27.8, 38, -13.2, 13.2], [_t('Ravine'), 19, 27.8, -15, 15],
    [_t('Tool shed'), 21, 34, 44.4, 50], [_t('Tool shed'), -34, -21, 44.4, 50], [_t('Tool shed'), 21, 34, -50, -44.4], [_t('Tool shed'), -34, -21, -50, -44.4],
    [_t('Alpha Base'), -38, 38, 38.5, 50], [_t('Bravo Base'), -38, 38, -50, -38.5],
    [_t('Maze'), 19.2, 36.5, 23.2, 37.2], [_t('Maze'), 19.2, 36.5, -37.2, -23.2], [_t('Bandstand'), -29.5, -23.5, 28, 34.5], [_t('Bandstand'), -29.5, -23.5, -34.5, -28],
    [_t('Wisteria pergola'), -35.2, -32, 24.8, 37.7], [_t('Wisteria pergola'), -21.2, -18, 24.8, 37.7], [_t('Wisteria pergola'), -35.2, -32, -37.7, -24.8], [_t('Wisteria pergola'), -21.2, -18, -37.7, -24.8],
    [_t('Rose garden'), -37, -17, 23.5, 38.5], [_t('Rose garden'), -37, -17, -38.5, -23.5], [_t('Canal'), -3.4, 3.4, 14, 26], [_t('Canal'), -3.4, 3.4, -26, -14],
    [_t('Flowerbeds'), -18, 18, 25.5, 38.5], [_t('Flowerbeds'), -18, 18, -38.5, -25.5], [_t('Promenade'), -38, 38, 13.2, 17.8], [_t('Promenade'), -38, 38, -17.8, -13.2],
    [_t('Lawns'), -38, 38, 17.8, 25.5], [_t('Lawns'), -38, 38, -25.5, -17.8],
  ],
  // no photographed sky: the overcast is the computed sky of ATMO_FLORALIA (cloud deck and breaks)
  atmo: ATMO_FLORALIA,
};
