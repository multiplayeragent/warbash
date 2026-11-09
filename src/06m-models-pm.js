/* ==========================================================================
   WEAPON MODELS, SUBMACHINE GUNS: MP7, UMP-45, Vector
   Same context as 06k-models-base.js. The MP7 is a compact polymer weapon with the magazine housed in the grip, the UMP-45 a long single-piece receiver with rails and a magazine slanted in front of the trigger guard, the Vector a black and sand receiver cut at an angle, with a low barrel and vertical grip.
   ========================================================================== */

/* ---------- MP7: compact polymer receiver, top rail, side rails and notched rail under the front, vent slots,
   magazine housed in the grip (the long magazine protrudes below), angular trigger guard, sliding stock with plunging heel and
   slot. Dimensions taken from a side view (0.7 mm per pixel, fitted to the trigger); the grip is set back 3 cm and the
   trigger guard enlarged for the game's hand, the stock shortened to keep the reach of the soldiers' left arm. ---------- */
const MP7_MAG = { u: [0.0948, -0.9955], n: [0.9955, 0.0948] }; // axis of the grip and magazine [z, y] (the bottom goes toward the rear, 5°)
defineGun('mp7', 'smg', (c) => {
  const { g, M, info, bl } = c;
  // single-piece receiver, top rail; front: side rails, notched rail underneath (teeth visible), vent slots
  prof(g, M.poly, [[-0.22, 0.08, 0.004], [0.151, 0.08, 0.004], [0.155, 0.075, 0.004], [0.155, 0.006, 0.004], [-0.218, 0.01, 0.004]], 0.04, 0, 0.004, 0.004);
  rail(g, M, 0, 0.084, -0.03, 0.36);
  for (const sx of [-1, 1]) rail(g, M, sx * 0.021, 0.033, -0.153, 0.105, true);
  rb(g, M.dark, 0, 0.006, -0.153, 0.022, 0.008, 0.105, 0.002);
  for (let i = 0; i < 8; i++) bx(g, M.dark, 0, 0.001, -0.2 + i * 0.013, 0.022, 0.004, 0.006);
  for (const sx of [-1, 1]) {
    for (const [z0, z1] of [[-0.195, -0.14], [-0.133, -0.069]]) rb(g, M.rubber, sx * 0.0208, 0.069, (z0 + z1) / 2, 0.0016, 0.005, z1 - z0, 0.002);
    rb(g, M.rubber, sx * 0.0208, 0.064, 0.055, 0.0016, 0.002, 0.16, 0.0008); // joint of the rear receiver
    rb(g, M.rubber, sx * 0.0208, 0.054, 0.107, 0.0016, 0.008, 0.058, 0.003); // cocking handle slot
  }
  // T-shaped cocking handle at the rear, selector, ejection window, pins
  rb(g, M.metal, 0, 0.07, 0.158, 0.044, 0.012, 0.01, 0.003);
  rb(g, M.metal, -0.0215, 0.018, -0.005, 0.003, 0.007, 0.02, 0.001, 0.3);
  rb(g, M.rubber, 0.0208, 0.05, 0.03, 0.0016, 0.016, 0.045, 0.002);
  for (const [z, y] of [[0.002, 0.024], [0.043, 0.016], [0.142, 0.016]]) cy(g, M.dark, 0, y, z, 0.003, 0.0424, 0, 0, Math.PI / 2);
  // angular trigger guard (solid block above the opening), trigger, grip housing the magazine, textured panels, magazine button
  prof(g, M.poly, [[-0.094, 0.008, 0], [-0.094, -0.04, 0.008], [-0.082, -0.048, 0.008], [0.004, -0.048, 0.006], [0.012, -0.036, 0.004], [0.012, 0.008, 0]], 0.014, 0, 0.003, 0.004,
    [[[-0.084, -0.004, 0.003], [-0.084, -0.04, 0.006], [0.004, -0.04, 0.006], [0.004, -0.004, 0.003]]]);
  rb(g, M.metal, 0, -0.012, -0.046, 0.006, 0.034, 0.006, 0.002, 0.18);
  gripProf(g, M.poly, 0.033, 0.022, 0.045, -0.104, 0.058, 0.034, 0.002);
  for (const sx of [-1, 1]) rb(g, M.grip, sx * 0.0175, -0.06, 0.042, 0.002, 0.07, 0.03, 0.004, -0.095);
  for (const sx of [-1, 1]) cy(g, M.dark, sx * 0.017, -0.014, 0.018, 0.0045, 0.004, 0, 0, Math.PI / 2);
  // short barrel, nut on the front face, flash hider (replaced by the muzzle device if there is one)
  const tip = -0.265 - Math.max(bl, -0.02), mz = !!c.A.muzzle;
  cy(g, M.dark, 0, 0.034, -0.222, 0.01, 0.006);
  cy(g, M.metal, 0, 0.034, (-0.22 + (mz ? tip : tip + 0.03)) / 2, 0.0055, Math.abs((mz ? tip : tip + 0.03) + 0.22));
  if (!mz) { cy(g, M.dark, 0, 0.034, tip + 0.017, 0.0088, 0.034); for (const sx of [-1, 1]) rb(g, M.rubber, sx * 0.0084, 0.034, tip + 0.012, 0.0016, 0.004, 0.018, 0.0008); }
  // flip-up sighting parts on the rail (nothing if an optic replaces them); strokes as a fraction of the screen (06jb-shapes.js)
  info.sightY = 0.108; info.adsZ = 0.216;
  if (!c.optic) {
    rb(g, M.dark, 0, 0.091, -0.174, 0.02, 0.01, 0.018, 0.002);
    bx(g, M.sight, 0, 0.099, -0.174, ironW(c, -0.174, IRON.post), 0.018, 0.004);
    for (const sx of [-1, 1]) bx(g, M.dark, sx * 0.0085, 0.097, -0.174, ironW(c, -0.174, IRON.ear), 0.016, 0.012);
    rb(g, M.dark, 0, 0.092, 0.086, 0.022, 0.012, 0.022, 0.002);
    for (const sx of [-1, 1]) bx(g, M.dark, sx * 0.0102, 0.1, 0.086, ironW(c, 0.086, IRON.wing), 0.016, 0.006);
    ironFoot(c, M.dark, 0.086, 0.0975, ironRing(c, 0.086, IRON.hole.smg), 0.01);
  }
  // stock hinge and latch, then sliding stock: arm, body with plunging heel pierced by a slot, button, buttplate
  // (variants: no stock, short end cap; reinforced, thick heel and cheek)
  prof(g, M.poly, [[0.148, 0.07, 0.004], [0.19, 0.066, 0.004], [0.19, 0.01, 0.004], [0.148, 0.005, 0.004]], 0.036, 0, 0.004, 0.004);
  for (const sx of [-1, 1]) for (const y of [0.03, 0.055]) cy(g, M.metal, sx * 0.0185, y, 0.17, 0.0055, 0.004, 0, 0, Math.PI / 2);
  let butt;
  if (c.stock === 'none') {
    rb(g, M.rubber, 0, 0.038, 0.193, 0.038, 0.06, 0.008, 0.003);
    butt = 0.197;
  } else {
    const hv = c.stock === 'heavy', w = hv ? 0.044 : 0.04;
    rb(g, M.poly, 0, 0.0435, 0.2, 0.026, 0.03, 0.026, 0.004);
    prof(g, M.poly, [[0.21, 0.066, 0.004], [0.307, 0.066, 0.006], [0.31, 0.06, 0.004], [0.31, -0.044, 0.006], [0.27, -0.044, 0.006], [0.262, -0.03, 0.006], [0.262, 0.018, 0.006], [0.21, 0.018, 0.004]], w, 0, 0.004, 0.004,
      [[[0.272, 0.008, 0.003], [0.29, 0.008, 0.003], [0.29, -0.034, 0.003], [0.272, -0.034, 0.003]]]);
    rb(g, M.dark, -w / 2 - 0.0005, 0.05, 0.232, 0.002, 0.012, 0.018, 0.0008);
    if (hv) rb(g, M.poly, 0, 0.072, 0.255, 0.03, 0.014, 0.08, 0.004);
    const pd = hv ? 0.014 : 0.008;
    rb(g, M.rubber, 0, 0.011, 0.31 + pd / 2, w, 0.11, pd, 0.003);
    butt = 0.31 + pd;
  }
  info.butt = [0, 0.02, butt];
  // magazine in the grip: the top goes up into the grip, the rest protrudes below, overhanging base plate
  info.magHome.set(0, -0.104, 0.045);
  info.buildMag = (parent, ext) => {
    const { u, n } = MP7_MAG, h = 0.022, s0 = -0.1, s1 = 0.088 + (ext - 1) * 0.1, P = (s, k) => [u[0] * s + n[0] * k, u[1] * s + n[1] * k];
    prof(parent, M.poly, [P(s0, -h), P(s0, h), P(s1, h), P(s1, -h)], 0.026, 0, 0.003, 0.003);
    const b = P(s1 + 0.005, 0);
    rb(parent, M.dark, 0, b[1], b[0], 0.032, 0.012, 0.052, 0.003, -0.095);
  };
  info.magAxis = new V3(0, MP7_MAG.u[1], MP7_MAG.u[0]); info.magGrip = new V3(0, -0.0299, 0.0028);
  info.gripR.set(0, -0.045, 0.04); info.gripL.set(0, 0.034, -0.16);
  info.mount.optic = { y: 0.089, z: 0.0, len: 0.36, D: 0.21 };
  info.mount.muzzle = { x: 0, y: 0.034, z: tip, r: 0.0055 };
  info.mount.under = { y: 0.002, z: -0.16, len: 0.1 };
  info.mount.side = { x: -0.025, y: 0.033, z: -0.16 };
  info.muzzle.position.set(0, 0.034, tip - 0.01); info.eject.position.set(0.021, 0.05, 0.03);
  info.gripDef = {
    R: [{ c: [0, -0.045, 0.04], h: [0.017, 0.055, 0.029], r: 0.01, rx: -0.095 }, { c: [0, 0.03, 0.0], h: [0.02, 0.025, 0.09], r: 0.008 }],
    L: [{ c: [0, 0.034, -0.16], h: [0.02, 0.032, 0.06], r: 0.008 }, { c: [0, 0.006, -0.153], h: [0.011, 0.004, 0.053], r: 0.002 },
      { c: [-0.021, 0.033, -0.153], h: [0.005, 0.012, 0.053], r: 0.002 }, { c: [0.021, 0.033, -0.153], h: [0.005, 0.012, 0.053], r: 0.002 }],
  };
  info.trigDef = { at: [0.004, -0.03, -0.058], xTip: -0.004, guard: [{ c: [0, -0.044, -0.04], h: [0.007, 0.004, 0.045], r: 0.002 }, { c: [0, -0.02, -0.089], h: [0.007, 0.028, 0.005], r: 0.002 },
    { c: [0, -0.012, -0.046], h: [0.003, 0.017, 0.003], r: 0.002, rx: 0.18 }] };
});

/* ---------- UMP-45: long single-piece polymer receiver, side rails and notched rail under the front, lightening slots,
   magazine well under the receiver and release paddle, integrated trigger guard, tilted grip with heel, long straight magazine
   slanted forward, folding stock with two arms and a large cutout. Dimensions taken from a side view (0.68 mm per pixel,
   fitted to the trigger; stock shortened by 15% so the soldiers' left arm reaches the handguard). ---------- */
const UMP_MAG = { u: [-0.181, -0.983], n: [0.983, -0.181] }; // magazine axis [z, y] (the bottom goes forward, 10°) and its normal
defineGun('ump45', 'smg', (c) => {
  const { g, M, info, bl } = c;
  // receiver: straight top, chamfered rear; top rail along the whole length
  prof(g, M.poly, [[-0.346, 0.073, 0.004], [0.026, 0.073, 0.004], [0.053, 0.06, 0.004], [0.058, 0.054, 0.004], [0.058, 0.004, 0.004], [-0.346, 0.002, 0.004]], 0.044, 0, 0.004, 0.004);
  rail(g, M, 0, 0.077, -0.17, 0.34);
  // handguard: side rails, notched rail underneath (teeth visible)
  for (const sx of [-1, 1]) rail(g, M, sx * 0.0225, 0.044, -0.283, 0.115, true);
  rb(g, M.dark, 0, 0.0, -0.284, 0.024, 0.008, 0.12, 0.002);
  for (let i = 0; i < 9; i++) bx(g, M.dark, 0, -0.005, -0.337 + i * 0.013, 0.024, 0.004, 0.006);
  // lightening slots and receiver joint on both flanks, cocking handle at the front left, selector, ejection window
  for (const sx of [-1, 1]) {
    for (const [zc, l] of [[-0.198, 0.04], [-0.125, 0.038], [-0.048, 0.04], [0.017, 0.036]]) rb(g, M.rubber, sx * 0.0228, 0.042, zc, 0.0016, 0.008, l, 0.003);
    rb(g, M.rubber, sx * 0.0228, 0.02, -0.028, 0.0016, 0.003, 0.11, 0.001);
  }
  rb(g, M.rubber, -0.0228, 0.064, -0.27, 0.0016, 0.005, 0.095, 0.002);
  rb(g, M.metal, -0.0255, 0.064, -0.31, 0.007, 0.009, 0.014, 0.002);
  rb(g, M.metal, -0.0232, 0.026, -0.01, 0.003, 0.007, 0.022, 0.001, 0.3);
  rb(g, M.rubber, 0.0228, 0.05, -0.06, 0.0016, 0.018, 0.05, 0.002);
  for (const [z, y] of [[-0.188, 0.013], [-0.094, 0.031], [-0.03, 0.009]]) cy(g, M.dark, 0, y, z, 0.003, 0.0464, 0, 0, Math.PI / 2);
  // magazine well under the receiver, release paddle behind it
  prof(g, M.poly, [[-0.2, 0.006, 0.002], [-0.181, -0.042, 0.004], [-0.116, -0.042, 0.004], [-0.104, -0.02, 0.004], [-0.094, 0.006, 0.002]], 0.046, 0, 0.003, 0.004);
  prof(g, M.poly, [[-0.114, -0.03, 0.002], [-0.098, -0.03, 0.002], [-0.096, -0.066, 0.004], [-0.108, -0.068, 0.004]], 0.03, 0, 0.003, 0.003);
  // integrated trigger guard (solid trigger block above the opening), trigger, tilted grip and its heel, textured panels
  prof(g, M.poly, [[-0.095, 0.006, 0], [-0.095, -0.046, 0.008], [-0.082, -0.055, 0.008], [0.008, -0.055, 0.004], [0.016, -0.04, 0.004], [0.016, 0.006, 0]], 0.016, 0, 0.003, 0.004,
    [[[-0.083, -0.014, 0.004], [-0.083, -0.046, 0.007], [-0.006, -0.046, 0.006], [0.0, -0.014, 0.004]]]);
  rb(g, M.metal, 0, -0.028, -0.046, 0.006, 0.03, 0.006, 0.002, 0.18);
  gripProf(g, M.poly, 0.02, 0.0, 0.058, -0.132, 0.042, 0.032);
  prof(g, M.poly, [[0.03, 0.006, 0.002], [0.058, 0.006, 0.002], [0.06, -0.012, 0.004], [0.046, -0.03, 0.004]], 0.03, 0, 0.003, 0.003);
  for (const sx of [-1, 1]) rb(g, M.grip, sx * 0.0165, -0.078, 0.0425, 0.002, 0.05, 0.022, 0.003, -0.28);
  // short barrel, nut on the front face, thread protector (replaced by the muzzle device if there is one)
  const tip = -0.378 - Math.max(bl, -0.02);
  cy(g, M.dark, 0, 0.037, -0.349, 0.012, 0.008);
  cy(g, M.metal, 0, 0.037, (-0.346 + tip) / 2, 0.0095, Math.abs(tip + 0.346));
  if (!c.A.muzzle) cy(g, M.dark, 0, 0.037, tip + 0.009, 0.011, 0.018);
  // flip-up sighting parts on the rail (nothing if an optic replaces them); strokes as a fraction of the screen (06jb-shapes.js), tip
  // of the front sight on the sight line (it exceeded it by 0.5 mm)
  info.sightY = 0.1015; info.adsZ = 0.136;
  if (!c.optic) {
    rb(g, M.dark, 0, 0.083, -0.327, 0.02, 0.012, 0.018, 0.002);
    bx(g, M.sight, 0, (0.084 + 0.1015) / 2, -0.327, ironW(c, -0.327, IRON.post), 0.1015 - 0.084, 0.004);
    for (const sx of [-1, 1]) bx(g, M.dark, sx * 0.0085, 0.091, -0.327, ironW(c, -0.327, IRON.ear), 0.016, 0.012);
    rb(g, M.dark, 0, 0.084, 0.006, 0.022, 0.014, 0.022, 0.002);
    for (const sx of [-1, 1]) bx(g, M.dark, sx * 0.0102, 0.094, 0.006, ironW(c, 0.006, IRON.wing), 0.016, 0.006);
    ironFoot(c, M.dark, 0.006, 0.0905, ironRing(c, 0.006, IRON.hole.smg), 0.01);
  }
  // stock hinge, then folding stock: top arm, slanted arm, heel and buttplate, large cutout
  // (variants: no stock, short end cap; reinforced, thick heel and cheek)
  prof(g, M.poly, [[0.05, 0.062, 0.004], [0.082, 0.056, 0.004], [0.084, -0.006, 0.004], [0.05, -0.004, 0.004]], 0.036, 0, 0.004, 0.004);
  rb(g, M.rubber, -0.0185, 0.03, 0.068, 0.0016, 0.02, 0.008, 0.003);
  let butt;
  if (c.stock === 'none') {
    rb(g, M.poly, 0, 0.026, 0.09, 0.034, 0.06, 0.016, 0.006);
    rb(g, M.rubber, 0, 0.026, 0.101, 0.036, 0.064, 0.008, 0.003);
    butt = 0.105;
  } else {
    const hv = c.stock === 'heavy';
    prof(g, M.poly, [[0.078, 0.046, 0.004], [0.29, 0.046, 0.006], [0.29, -0.068, 0.006], [0.248, -0.068, 0.006], [0.084, -0.006, 0.004]], hv ? 0.036 : 0.03, 0, 0.004, 0.004,
      [[[0.108, 0.026, 0.006], [0.236, 0.026, 0.008], [0.236, -0.043, 0.006], [0.118, 0.004, 0.006]]]);
    rb(g, M.rubber, -0.0155, 0.035, 0.262, 0.0016, 0.006, 0.026, 0.002);
    if (hv) rb(g, M.poly, 0, 0.055, 0.19, 0.03, 0.014, 0.12, 0.004);
    const pd = hv ? 0.018 : 0.012;
    rb(g, M.rubber, 0, -0.011, 0.29 + pd / 2, hv ? 0.044 : 0.038, 0.116, pd, 0.005);
    butt = 0.29 + pd;
  }
  info.butt = [0, -0.01, butt];
  // long straight magazine, slanted forward: the top goes up into the well, overhanging base plate
  info.magHome.set(0, -0.04, -0.15);
  info.buildMag = (parent, ext) => {
    const { u, n } = UMP_MAG, h = 0.022, s0 = -0.07, s1 = 0.19 + (ext - 1) * 0.15, P = (s, k) => [u[0] * s + n[0] * k, u[1] * s + n[1] * k];
    prof(parent, M.poly, [P(s0, -h), P(s0, h), P(s1, h), P(s1, -h)], 0.026, 0, 0.003, 0.003);
    for (const sx of [-1, 1]) { const a = P((s1 + 0.03) / 2, 0); rb(parent, M.rubber, sx * 0.0133, a[1], a[0], 0.0016, s1 - 0.09, 0.012, 0.004, 0.182); }
    const b = P(s1 + 0.005, 0);
    rb(parent, M.dark, 0, b[1], b[0], 0.032, 0.012, 0.05, 0.003, 0.182);
  };
  info.magAxis = new V3(0, UMP_MAG.u[1], UMP_MAG.u[0]); info.magGrip = new V3(0, -0.0344, -0.0063);
  info.gripR.set(0, -0.06, 0.043); info.gripL.set(0, 0.037, -0.285);
  info.mount.optic = { y: 0.082, z: -0.14, len: 0.34, D: 0.21 };
  info.mount.muzzle = { x: 0, y: 0.037, z: tip, r: 0.0095 };
  info.mount.under = { y: -0.007, z: -0.29, len: 0.12 };
  info.mount.side = { x: -0.0265, y: 0.044, z: -0.3 };
  info.muzzle.position.set(0, 0.037, tip - 0.01); info.eject.position.set(0.023, 0.05, -0.06);
  info.gripDef = {
    R: [{ c: [0, -0.068, 0.042], h: [0.016, 0.06, 0.021], r: 0.01, rx: -0.28 }, { c: [0, 0.03, -0.03], h: [0.022, 0.03, 0.1], r: 0.006 }],
    L: [{ c: [0, 0.037, -0.285], h: [0.022, 0.036, 0.06], r: 0.008 }, { c: [0, -0.003, -0.285], h: [0.012, 0.006, 0.06], r: 0.002 },
      { c: [-0.0225, 0.044, -0.283], h: [0.006, 0.012, 0.058], r: 0.002 }, { c: [0.0225, 0.044, -0.283], h: [0.006, 0.012, 0.058], r: 0.002 }],
  };
  info.trigDef = { at: [0.004, -0.036, -0.058], xTip: -0.004, guard: [{ c: [0, -0.0505, -0.04], h: [0.008, 0.0045, 0.045], r: 0.002 }, { c: [0, -0.025, -0.089], h: [0.008, 0.03, 0.006], r: 0.002 },
    { c: [0, -0.028, -0.046], h: [0.003, 0.015, 0.003], r: 0.002, rx: 0.18 }, { c: [0, -0.018, -0.148], h: [0.023, 0.024, 0.032], r: 0.004 }] };
});

/* ---------- Vector (KRISS Vector, two-tone): black upper receiver with rail along the whole length, sand front part cut
   at an angle, notched front upright running diagonally down to the magazine well, low barrel in line with the hand, vertical
   grip under the front, large angular trigger guard, long magazine slanted backward, skeleton stock with large heel.
   Dimensions taken from a side view (1.22 mm per pixel, fitted to the trigger). ---------- */
const VEC_MAG = { u: [0.208, -0.978], n: [0.978, 0.208] }; // magazine axis [z, y] (the bottom goes toward the rear, 12°) and its normal
defineGun('vector', 'smg', (c) => {
  const { g, M, info, bl } = c;
  // upper receiver and rail, front plate
  prof(g, M.dark, [[-0.31, 0.058, 0.004], [0.086, 0.058, 0.006], [0.086, 0.016, 0.004], [-0.306, 0.016, 0.002], [-0.31, 0.022, 0.002]], 0.046, 0, 0.003, 0.004);
  rail(g, M, 0, 0.062, -0.135, 0.33);
  rb(g, M.poly, 0, 0.005, -0.3105, 0.046, 0.106, 0.008, 0.003);
  // sand front part: straight top, angled cut toward the trigger guard, magazine well, bottom that rises along the upright
  prof(g, M.tan, [[-0.306, 0.02, 0.003], [-0.117, 0.02, 0.004], [-0.086, -0.012, 0.006], [-0.062, -0.055, 0.004], [-0.062, -0.112, 0.004],
    [-0.154, -0.118, 0.003], [-0.199, -0.022, 0.004], [-0.204, -0.014, 0.002], [-0.306, -0.014, 0.003]], 0.05, 0, 0.003, 0.004);
  // front block under the barrel (short grip rail), notched front upright, well lip
  prof(g, M.poly, [[-0.31, -0.008, 0.003], [-0.206, -0.008, 0.002], [-0.212, -0.048, 0.004], [-0.308, -0.048, 0.004]], 0.044, 0, 0.003, 0.004);
  rail(g, M, 0, -0.052, -0.27, 0.07);
  prof(g, M.poly, [[-0.219, -0.008, 0.002], [-0.204, -0.008, 0.002], [-0.151, -0.123, 0.003], [-0.167, -0.123, 0.003]], 0.052, 0, 0.002, 0.002);
  for (let i = 1; i <= 7; i++) { const t = i * 0.0155; bx(g, M.poly, 0, -0.008 - 0.911 * t - 0.0006, -0.219 + 0.412 * t - 0.0012, 0.05, 0.004, 0.003, -0.42); }
  rb(g, M.poly, 0, -0.118, -0.108, 0.052, 0.008, 0.094, 0.003);
  // pins, angled slot on the flanks
  for (const [z, y] of [[-0.296, -0.002], [-0.228, -0.002], [-0.139, -0.038], [-0.12, -0.094], [-0.098, -0.05]]) cy(g, M.dark, 0, y, z, 0.0038, 0.0532, 0, 0, Math.PI / 2);
  for (const sx of [-1, 1]) rb(g, M.rubber, sx * 0.0255, -0.062, -0.172, 0.0016, 0.064, 0.011, 0.005, -0.44);
  // black rear: frame above the trigger guard, massive trigger guard pierced by an opening (the index finger enters it in front of the trigger), trigger,
  // grip and its heel
  prof(g, M.poly, [[-0.119, 0.019, 0.002], [0.086, 0.019, 0.004], [0.086, -0.006, 0.006], [0.03, -0.02, 0.004], [-0.052, -0.02, 0.003], [-0.058, -0.04, 0.003], [-0.064, -0.058, 0.002], [-0.088, -0.012, 0.002]], 0.042, 0, 0.003, 0.004);
  prof(g, M.poly, [[-0.066, -0.014, 0], [-0.066, -0.088, 0.006], [-0.056, -0.1, 0.008], [0.03, -0.1, 0.008], [0.046, -0.088, 0.006], [0.04, -0.014, 0]], 0.018, 0, 0.003, 0.004,
    [[[-0.056, -0.022, 0.002], [-0.056, -0.084, 0.005], [0.03, -0.084, 0.005], [0.02, -0.022, 0.002]]]);
  rb(g, M.metal, 0, -0.039, -0.04, 0.006, 0.034, 0.006, 0.002, 0.18);
  gripProf(g, M.poly, 0.036, -0.002, 0.078, -0.122, 0.044, 0.032);
  prof(g, M.poly, [[0.064, -0.004, 0.002], [0.092, -0.004, 0.004], [0.094, -0.02, 0.006], [0.074, -0.03, 0.004]], 0.03, 0, 0.003, 0.003);
  // cocking handle at the front left and its slot, selector, ejection window on the right, sling plate
  rb(g, M.metal, -0.0245, 0.026, -0.262, 0.005, 0.008, 0.07, 0.002);
  rb(g, M.rubber, -0.0232, 0.026, -0.175, 0.0016, 0.004, 0.1, 0.0008);
  rb(g, M.metal, -0.0222, 0.002, -0.004, 0.003, 0.007, 0.022, 0.0012, 0.25);
  rb(g, M.rubber, 0.0237, 0.036, -0.035, 0.0016, 0.016, 0.056, 0.001);
  rb(g, M.metal, -0.0235, 0.036, 0.07, 0.004, 0.014, 0.02, 0.0015);
  // low barrel, nut of the front plate, thread protector (replaced by the muzzle device if there is one)
  const tip = -0.37 - Math.max(bl, -0.04);
  cy(g, M.dark, 0, 0, -0.318, 0.011, 0.012);
  cy(g, M.metal, 0, 0, (-0.314 + tip) / 2, 0.0075, Math.abs(tip + 0.314));
  if (!c.A.muzzle) { cy(g, M.dark, 0, 0, tip + 0.011, 0.0092, 0.022); cy(g, M.metal, 0, 0, tip + 0.002, 0.0085, 0.004); }
  // flip-up sighting parts on the rail: front sight with ears, aperture rear sight (nothing if an optic replaces them); strokes as a
  // fraction of the screen (06jb-shapes.js)
  info.sightY = 0.0895; info.adsZ = 0.124;
  if (!c.optic) {
    rb(g, M.dark, 0, 0.0715, -0.285, 0.02, 0.009, 0.02, 0.002);
    bx(g, M.sight, 0, 0.0805, -0.285, ironW(c, -0.285, IRON.post), 0.018, 0.004);
    for (const sx of [-1, 1]) bx(g, M.dark, sx * 0.0085, 0.079, -0.285, ironW(c, -0.285, IRON.ear), 0.016, 0.012);
    rb(g, M.dark, 0, 0.0725, -0.006, 0.022, 0.011, 0.024, 0.002);
    for (const sx of [-1, 1]) bx(g, M.dark, sx * 0.0102, 0.0855, -0.006, ironW(c, -0.006, IRON.wing), 0.016, 0.006);
    ironFoot(c, M.dark, -0.006, 0.0775, ironRing(c, -0.006, IRON.hole.smg), 0.01);
  }
  // skeleton stock: arm in line with the receiver, slanted leg, thick heel and buttplate
  // (variants: retracted, simple end cap; reinforced, wider heel and cheek)
  let butt;
  if (c.stock === 'none') {
    rb(g, M.poly, 0, 0.026, 0.096, 0.034, 0.05, 0.024, 0.006);
    rb(g, M.rubber, 0, 0.026, 0.111, 0.036, 0.054, 0.008, 0.003);
    butt = 0.115;
  } else {
    const hv = c.stock === 'heavy';
    prof(g, M.poly, [[0.08, 0.054, 0.004], [0.205, 0.05, 0.006], [0.218, 0.036, 0.006], [0.218, 0.004, 0.006], [0.18, 0.002, 0.004], [0.11, 0.006, 0.006], [0.08, -0.004, 0.004]], 0.032, 0, 0.004, 0.004);
    prof(g, M.poly, [[0.168, 0.008, 0.002], [0.192, 0.008, 0.002], [0.226, -0.098, 0.003], [0.206, -0.104, 0.003]], 0.024, 0, 0.003, 0.003);
    prof(g, M.poly, [[0.208, 0.044, 0.008], [0.25, 0.048, 0.006], [0.25, -0.112, 0.006], [0.2, -0.11, 0.008]], hv ? 0.048 : 0.04, 0, 0.005, 0.006);
    const pd = hv ? 0.02 : 0.014;
    rb(g, M.rubber, 0, -0.032, 0.249 + pd / 2, hv ? 0.052 : 0.044, 0.164, pd, 0.006);
    if (hv) rb(g, M.poly, 0, 0.061, 0.15, 0.03, 0.014, 0.1, 0.004);
    butt = 0.249 + pd;
  }
  info.butt = [0, 0.0, butt];
  // straight, slanted magazine: the top goes up into the well, the base plate protrudes on all sides
  info.magHome.set(0, -0.114, -0.12);
  info.buildMag = (parent, ext) => {
    const { u, n } = VEC_MAG, h = 0.021, s0 = -0.062, s1 = 0.128 + (ext - 1) * 0.13, P = (s, k) => [u[0] * s + n[0] * k, u[1] * s + n[1] * k];
    prof(parent, M.poly, [P(s0, -h), P(s0, h), P(s1, h), P(s1, -h)], 0.026, 0, 0.003, 0.003);
    const b = P(s1 + 0.005, 0);
    rb(parent, M.dark, 0, b[1], b[0], 0.032, 0.012, 0.05, 0.003, -0.21);
  };
  info.magAxis = new V3(0, VEC_MAG.u[1], VEC_MAG.u[0]); info.magGrip = new V3(0, -0.034, 0.0073);
  info.gripR.set(0, -0.06, 0.064); info.gripL.set(0, -0.02, -0.27);
  info.mount.optic = { y: 0.0665, z: -0.11, len: 0.3, D: 0.21 };
  info.mount.muzzle = { x: 0, y: 0, z: tip, r: 0.0075 };
  info.mount.under = { y: -0.056, z: -0.272, len: 0.07 };
  info.mount.side = { x: -0.0255, y: -0.002, z: -0.262 };
  info.muzzle.position.set(0, 0, tip - 0.01); info.eject.position.set(0.024, 0.036, -0.035);
  info.gripDef = {
    R: [{ c: [0, -0.068, 0.062], h: [0.016, 0.054, 0.022], r: 0.01, rx: -0.33 }, { c: [0, 0.0, -0.01], h: [0.021, 0.02, 0.095], r: 0.006 }],
    L: [{ c: [0, -0.028, -0.262], h: [0.022, 0.02, 0.048], r: 0.006 }, { c: [0, 0.003, -0.262], h: [0.025, 0.018, 0.048], r: 0.006 }],
  };
  info.trigDef = { at: [0.004, -0.05, -0.05], xTip: -0.004, guard: [{ c: [0, -0.092, -0.013], h: [0.009, 0.008, 0.05], r: 0.003 }, { c: [0, -0.055, -0.061], h: [0.009, 0.041, 0.005], r: 0.002 }, { c: [0, -0.039, -0.04], h: [0.003, 0.017, 0.003], r: 0.002, rx: 0.18 }] };
  // vertical grip under the front, held by the left hand; an accessory under the barrel replaces it
  if (!c.A.under) {
    rb(g, M.dark, 0, -0.061, -0.264, 0.03, 0.01, 0.04, 0.003);
    rb(g, M.poly, 0, -0.1, -0.264, 0.026, 0.072, 0.032, 0.009);
    for (let i = 0; i < 4; i++) rb(g, M.rubber, 0, -0.078 - i * 0.015, -0.264, 0.0275, 0.004, 0.0335, 0.002);
    rb(g, M.poly, 0, -0.138, -0.264, 0.03, 0.006, 0.036, 0.003);
    underGrip(c, { c: [0, -0.1, -0.264], h: [0.013, 0.036, 0.016], r: 0.009 }, 'Lv');
  }
});
