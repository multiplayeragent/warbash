/* ==========================================================================
   WEAPON MODELS, FIRST SERIES: M4A1, MP5, L96A1, M1014, M9
   Each model receives the context c of buildGunModel: g (group), M (materials, possibly camouflaged), info (see
   06j-models.js), A (attachments per slot), bl (barrel extension, negative for a short barrel), stock
   (stock variant: null, 'heavy' or 'none') and optic (an optic replaces the metal sighting parts).
   The sighting parts (positions unchanged for alignment) are only built in the absence of an optic; the
   red dot sight, the former M4A1 accessory, is now the "red" attachment (06p-attachments.js).
   ========================================================================== */

/* ---------- M4A1 (short carbine, round handguards): built from a side view (P: 0.9 mm per pixel, fitted to the real
   length of 684 mm, stock retracted). The game's right hand holds the grip with the trigger 10.8 cm in front of it (the real
   weapon: 5 cm): as on the AK-47 and the SCAR-H, grip and trigger stay in place and the rear of the weapon (receiver behind the
   ejection window, grip, tube and stock: Q) moves back by D = 5.5 cm, the trigger guard hollow lengthens by the same amount.
   - Short barrel with A2 flash hider, triangular front sight (gas block, window, sight ears, bayonet lug, grenadier),
     cap and ring of the handguard; ribbed round handguards.
   - Upper receiver with rail (folding rear sight raised), charging handle, ejection window and forward assist on
     the right; lower receiver with flared magazine well, bolt catch and selector on the left, pins, trigger guard; A2 grip
     (bulge, checkered sides); stock tube and its ring, telescoping stock with slots, lever and sling swivel.
   - Accessory rails under the handguard and on its left flank only when an accessory is mounted there; with an optic, a
     low gas block replaces the front sight.
   Check: node tools/dev/visual/contour.js --firearm m4 --photo <left profile, 800 x 490> --mmpx 0.9 --anchorPt 483,197,-0.038,0.037
   (front of the weapon; the rear is shifted by D). ---------- */
defineGun('m4', 'rifle', (c) => {
  const { g, M, info, bl } = c, K = M.rubber, sx2 = [-1, 1];
  const S = 0.0009, D = 0.0549, P = (x, y, r) => { const q = [-0.038 + (x - 483) * S, 0.037 - (y - 197) * S]; if (r !== undefined) q.push(r); return q; };
  const Q = (x, y, r) => { const q = P(x, y, r); q[0] += D; return q; }, Pz = (x) => P(x, 0)[0], Qz = (x) => Pz(x) + D, Py = (y) => P(0, y)[1];
  const by = 0.037, rH = 0.0328;

  // ----- upper receiver: body, rail (teeth along the whole length), charging handle; on the right, ejection window, cover,
  // deflector, forward assist -----
  prof(g, M.metal, [P(349, 168, 0.002), Q(565, 166, 0.003), Q(569, 172, 0.003), Q(569, 214, 0.002), P(352, 216, 0.002), P(349, 210, 0.002)], 0.032, 0, 0.003, 0.003);
  rail(g, M, 0, 0.066, (Pz(352) + Qz(548)) / 2, Qz(548) - Pz(352));
  rb(g, M.metal, 0, Py(163), Qz(556), 0.03, 0.007, 0.022, 0.002);
  rb(g, M.metal, -0.018, Py(163), Qz(560), 0.008, 0.006, 0.012, 0.002);
  rb(g, K, 0.0161, Py(184), (Pz(395) + Pz(465)) / 2, 0.0012, Py(172) - Py(196), Pz(465) - Pz(395), 0.0006);
  rb(g, M.dark, 0.0168, Py(196), (Pz(395) + Pz(465)) / 2, 0.0014, 0.0028, Pz(465) - Pz(395) + 0.004, 0.0006);
  rb(g, M.metal, 0.0172, Py(176), Pz(472) + 0.004, 0.006, 0.012, 0.012, 0.003);
  cy(g, M.metal, 0.0185, Py(185), Qz(538), 0.0072, 0.03);
  part(g, new THREE.SphereGeometry(1, 10, 8), M.dark, 0.0185, Py(185), Qz(538) + 0.015, 0.008, 0.008, 0.008);

  // ----- lower receiver: flared magazine well, trigger guard hollow, rear under the tube; trigger guard; bolt catch, selector, pins,
  // magazine button (right) -----
  prof(g, M.metal, [P(352, 216, 0.002), Q(578, 216, 0.002), Q(587, 220, 0.002), Q(587, 232, 0.002), Q(578, 236, 0.004), Q(559, 240, 0.006), Q(549, 250, 0.004), Q(500, 250, 0.002),
    P(449, 250, 0.002), P(447, 262, 0.002), P(445, 284, 0.003), P(441, 293, 0.003), P(368, 289, 0.003), P(358, 284, 0.003), P(366, 276, 0.002), P(366, 240, 0.004), P(356, 230, 0.002)], 0.03, 0, 0.0025, 0.002);
  prof(g, M.metal, [P(444, 283, 0.002), Q(507, 283, 0.003), Q(516, 291, 0.002), P(441, 292, 0.003)], 0.009, 0, 0.0016, 0.002);
  rb(g, M.dark, 0, Py(266), Pz(486), 0.006, Py(250) - Py(282) + 0.006, 0.005, 0.002, 0.25); // trigger
  { const a = P(425, 206), b = P(429, 238); rb(g, M.dark, -0.0157, (a[1] + b[1]) / 2, (a[0] + b[0]) / 2, 0.0028, a[1] - b[1], 0.009, 0.0015, 0.05); }
  { const q = Q(527, 231); cy(g, M.dark, -0.0155, q[1], q[0], 0.0045, 0.002, 0, 0, Math.PI / 2); rb(g, M.dark, -0.017, q[1] + 0.0045, q[0] - 0.001, 0.0022, 0.009, 0.004, 0.001, -0.5); }
  for (const z of [Pz(357), Qz(568)]) cy(g, M.dark, 0, Py(232), z, 0.003, 0.0312, 0, 0, Math.PI / 2);
  cy(g, M.dark, 0.016, Py(228), Pz(440), 0.0042, 0.003, 0, 0, Math.PI / 2);
  // A2 grip (place and angle of the game's hand: axis tilted by 0.33 rad, GA(d, b): d along the axis downward from the underside
  // of the receiver, b toward the rear): front almost straight under the index and middle fingers, spur between the middle and ring fingers (at two thirds), flared bottom
  // and heel that sets back, curved back that joins the receiver; checkered panels in slight relief on the sides
  const ga = 0.33, GA = (d, b, r) => { const q = [0.0506 + Math.sin(ga) * d + Math.cos(ga) * b, -0.0107 - Math.cos(ga) * d + Math.sin(ga) * b]; if (r !== undefined) q.push(r); return q; };
  prof(g, M.poly, [GA(-0.006, -0.019, 0.002), GA(0.004, -0.0215, 0.006), GA(0.03, -0.0222, 0.012), GA(0.049, -0.0236, 0.006), GA(0.057, -0.0285, 0.004), GA(0.064, -0.0262, 0.004),
    GA(0.072, -0.0215, 0.008), GA(0.09, -0.0212, 0.01), GA(0.1, -0.0232, 0.004), GA(0.106, -0.022, 0.004), GA(0.108, 0.0, 0.006), GA(0.105, 0.0262, 0.004), GA(0.096, 0.0262, 0.006),
    GA(0.07, 0.0226, 0.012), GA(0.035, 0.0222, 0.012), GA(0.012, 0.023, 0.008), GA(0.001, 0.027, 0.004), GA(-0.006, 0.03, 0.002)], 0.031, 0, 0.0045, 0.003);
  for (const sx of sx2) {
    const pl = prof(g, M.grip, [GA(0.012, -0.0168, 0.004), GA(0.036, -0.0182, 0.006), GA(0.058, -0.0172, 0.006), GA(0.094, -0.0168, 0.004), GA(0.097, 0.0, 0.004), GA(0.093, 0.0185, 0.004),
      GA(0.012, 0.018, 0.004), GA(0.008, 0.0, 0.004)], 0.0012, sx * 0.0152, 0.0004, 0.004);
    pl.geometry = pl.geometry.clone(); const uv = pl.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2.5, uv.getY(i) * 2.5); // fine grid
  }
  // ----- front: ring and cap of the handguards, ribbed round handguards, barrel, triangular front sight, flash hider -----
  cz(g, M.dark, 0, by, (Pz(326) + Pz(349)) / 2, 0.0234, Pz(349) - Pz(326));
  cz(g, M.dark, 0, by, Pz(330), 0.0262, 0.004);
  cz(g, M.poly, 0, by, (Pz(149) + Pz(324)) / 2, rH, Pz(324) - Pz(149), new THREE.CylinderGeometry(1, 1, 1, 18));
  for (const z of [Pz(152), Pz(321)]) cz(g, M.poly, 0, by, z, rH + 0.0012, 0.006); // rims at both ends
  for (let k = 0; k < 8; k++) { const a = (k + 0.5) * TAU / 8; bx(g, M.poly, Math.sin(a) * rH, by + Math.cos(a) * rH, (Pz(158) + Pz(316)) / 2, 0.0035, 0.0035, Pz(316) - Pz(158), 0, 0, -a); }
  for (let k = 0; k < 9; k++) cz(g, K, 0, by, Pz(168 + k * 19), rH + 0.0003, 0.0028, G_CYL_O); // grooves between the ribs
  cz(g, M.dark, 0, by, (Pz(138) + Pz(148)) / 2, 0.0216, Pz(148) - Pz(138));
  const bv = bl < 0 ? bl * 0.45 : bl, tip = Pz(16) - bv;
  cz(g, M.metal, 0, by, (tip + Pz(352)) / 2, 0.0075, Pz(352) - tip);
  if (!c.optic) {
    // gas block and triangular front sight: front leg, rear ramp, window; above, two ears and, between them, the blade of the
    // front sight, whose tip is on the sight line (seen from behind: the thin blade in a U, like on the real weapon); bayonet
    // lug
    prof(g, M.dark, [P(86, 214, 0.003), P(86, 184, 0.002), P(88, 146, 0.002), P(116, 146, 0.002), P(140, 180, 0.003), P(141, 214, 0.003)], 0.018, 0, 0.002, 0.002,
      [[P(99, 154, 0.002), P(125, 181, 0.002), P(95, 181, 0.002)]]);
    for (const sx of sx2) prof(g, M.dark, [P(88, 147), P(88, 118, 0.001), P(101, 118, 0.001), P(116, 147)], 0.0018, sx * 0.0065, 0.0005, 0.001);
    prof(g, M.dark, [P(91, 147), P(92, 123, 0.0005), P(97, 123, 0.0005), P(99, 147)], 0.0024, 0, 0.0004, 0.0006);
    prof(g, M.dark, [P(80, 207), P(98, 207), P(98, 222, 0.002), P(82, 222, 0.002)], 0.008, 0, 0.0014, 0.002);
    part(g, G_TOR, M.metal, 0, Py(232), Pz(134), 0.011, 0.011, 0.011, 0, Math.PI / 2, 0);
  } else cz(g, M.dark, 0, by + 0.002, Pz(114), 0.0135, Pz(140) - Pz(88)); // low gas block: the front sight does not get in the way of the optic
  if (!c.A.muzzle) {
    cz(g, M.dark, 0, by, tip + 0.0155, 0.0099, 0.031);
    for (let k = 0; k < 4; k++) { const a = Math.PI / 2 + (k - 1.5) * 0.75; bx(g, K, Math.sin(a) * 0.0097, by + Math.cos(a) * 0.0097, tip + 0.012, 0.0028, 0.0012, 0.017, 0, 0, -a); }
    cz(g, K, 0, by, tip - 0.0001, 0.0062, 0.0006);
  }

  // ----- stock tube, ring, telescoping stock (variants: no stock, end cap; reinforced, cheek) -----
  cz(g, M.dark, 0, by, Qz(573), 0.0172, Qz(578) - Qz(568));
  let butt;
  if (c.stock === 'none') {
    cz(g, M.metal, 0, by, (Qz(578) + 0.235) / 2, 0.0149, 0.235 - Qz(578));
    rb(g, K, 0, by, 0.24, 0.034, 0.034, 0.012, 0.008);
    butt = 0.246;
  } else {
    cz(g, M.metal, 0, by, (Qz(578) + Qz(740)) / 2, 0.0149, Qz(740) - Qz(578));
    prof(g, M.poly, [Q(592, 173, 0.003), Q(760, 174, 0.004), Q(776, 170, 0.002), Q(772, 250, 0.004), Q(766, 280, 0.004), Q(762, 312, 0.004), Q(758, 320, 0.002), Q(742, 316, 0.003),
      Q(740, 292, 0.004), Q(732, 280, 0.004), Q(713, 274, 0.004), Q(696, 262, 0.004), Q(687, 256, 0.004), Q(635, 250, 0.004), Q(627, 244, 0.003), Q(627, 226, 0.003), Q(592, 226, 0.003)],
    0.04, 0, 0.004, 0.004, [[Q(717, 262, 0.002), Q(722, 262, 0.002), Q(730, 279, 0.002), Q(719, 279, 0.002)]]);
    for (let k = 0; k < 5; k++) for (const y of [201, 209, 217]) for (const sx of sx2) rb(g, K, sx * 0.0202, Py(y), Qz(622 + k * 33), 0.0012, 0.0036, 0.025, 0.0014);
    rb(g, M.dark, 0, Py(258), Qz(656), 0.012, 0.012, 0.012, 0.003);
    rb(g, K, 0, Py(245), Qz(773), 0.042, Py(172) - Py(318), 0.008, 0.003);
    part(g, G_TOR, M.metal, 0, Py(322), Qz(748), 0.01, 0.01, 0.01, 0, Math.PI / 2, 0);
    if (c.stock === 'heavy') rb(g, M.poly, 0, Py(166), Qz(690), 0.034, 0.016, 0.1, 0.006);
    butt = Qz(776) + 0.004;
  }
  info.butt = [0, 0.01, butt];

  // ----- sighting parts: folding rear sight raised, on the rear of the rail: base, post, fine aperture and two protective ears
  // (thin: the aim stays clear; strokes as a fraction of the screen, 06jb-shapes.js); nothing if an optic replaces them -----
  const sy = Py(123), zr = Qz(528);
  info.sightY = sy; info.adsZ = zr + 0.19; // sight line: center of the aperture and tip of the front sight blade
  if (!c.optic) {
    rb(g, M.dark, 0, 0.0765, zr, 0.03, 0.008, 0.03, 0.002);
    ironFoot(c, M.dark, zr, 0.0795, ironRing(c, zr, IRON.hole.rifle), 0.02);
    for (const sx of sx2) bx(g, M.dark, sx * 0.0102, (0.0795 + sy - 0.001) / 2, zr, ironW(c, zr, IRON.wing), sy - 0.001 - 0.0795, 0.006);
  }

  // ----- magazine: curved, in gray aluminum -----
  info.magHome.set(0, -0.021, -0.11);
  info.buildMag = (parent, ext) => curvedMag(parent, M, 5, 0.112 * ext, 0.026, 0.062, 0.28, M.gray);
  info.magAxis = new V3(0, -0.99, -0.12); info.magGrip = new V3(0, -0.07, -0.012);

  // ----- hands, aiming, mounts -----
  info.gripR.set(0, -0.0282, 0.062); info.gripL.set(0, by, -0.235);
  info.mount.optic = { y: 0.071, z: (Pz(352) + Qz(548)) / 2 - 0.01, len: Qz(548) - Pz(352) - 0.02, D: 0.2675 };
  info.mount.muzzle = { x: 0, y: by, z: tip, r: 0.0075 };
  // accessory rails: under the handguards and on their left flank, placed only if an accessory occupies them
  if (c.A.under) rail(g, M, 0, by - rH + 0.0006, -0.27, 0.13);
  info.mount.under = { y: by - rH - 0.0034, z: -0.27, len: 0.13 };
  if (c.A.side) rail(g, M, -(rH + 0.0016), by, -0.3, 0.07, true);
  info.mount.side = { x: -(rH + 0.0056), y: by, z: -0.3 };
  info.muzzle.position.set(0, by, tip - 0.01); info.eject.position.set(0.02, Py(184), (Pz(395) + Pz(465)) / 2);
  info.gripDef = {
    R: [{ c: [0, -0.0382, 0.06], h: [0.0155, 0.0525, 0.022], r: 0.01, rx: -0.33 }, { c: [0, 0.006, -0.04], h: [0.015, 0.017, 0.12], r: 0.006 }],
    L: [{ c: [0, by, -0.26], h: [rH, rH, 0.088], r: rH - 0.002 }, { c: [0, by, (Pz(326) + Pz(349)) / 2], h: [0.0234, 0.0234, 0.012], r: 0.01 }],
  };
  info.trigDef = { at: [0.004, -0.0242, -0.046], xTip: -0.004, guard: [{ c: [0, Py(287), (Pz(444) + Qz(507)) / 2], h: [0.0045, 0.0045, (Qz(507) - Pz(444)) / 2], r: 0.002 },
    { c: [0, Py(268), Pz(446)], h: [0.004, 0.017, 0.003], r: 0.002 }, { c: [0, Py(268), Pz(405)], h: [0.015, 0.024, 0.036], r: 0.006 }, { c: [0, Py(266), Pz(486)], h: [0.003, 0.015, 0.003], r: 0.002, rx: 0.25 }] };
});

/* ---------- MP5 (A3): black stamped receiver topped by the cocking tube, cocking handle at the front left, front sight under tunnel
   and drum rear sight, thin handguard pierced with round holes, three-lug flash hider and front tab, polymer frame
   (selector, rounded trigger guard, tilted grip), curved magazine and release paddle, retractable stock with two rods and
   curved buttplate. Dimensions taken from a side view (0.4 mm per pixel, fitted to the trigger); the grip is
   set back 2 cm for the game's hand, the stock rods half retracted (reach of the soldiers' left arm). ---------- */
defineGun('mp5', 'smg', (c) => {
  const { g, M, info } = c, bl = Math.max(c.bl, -0.03);
  // stamped receiver, cocking tube, side groove, ejection window, cocking handle and its slot
  prof(g, M.dark, [[-0.216, 0.056, 0.003], [0.04, 0.056, 0.003], [0.04, 0.006, 0.003], [-0.216, 0.006, 0.003]], 0.042, 0, 0.003, 0.003);
  cy(g, M.dark, 0, 0.065, -0.139, 0.0095, 0.358);
  for (const sx of [-1, 1]) rb(g, M.rubber, sx * 0.0213, 0.034, -0.074, 0.0016, 0.012, 0.2, 0.004);
  rb(g, M.rubber, 0.0213, 0.046, -0.09, 0.0016, 0.016, 0.05, 0.002);
  rb(g, M.rubber, -0.0096, 0.064, -0.272, 0.0016, 0.004, 0.08, 0.0008);
  rb(g, M.metal, -0.014, 0.068, -0.3, 0.012, 0.004, 0.006, 0.0015);
  cy(g, M.dark, -0.025, 0.07, -0.3, 0.0068, 0.012, 0, 0, Math.PI / 2);
  // thin handguard and its round holes, front tab under the barrel
  prof(g, M.poly, [[-0.33, 0.054, 0.008], [-0.214, 0.056, 0.004], [-0.214, 0.006, 0.004], [-0.33, 0.01, 0.008]], 0.05, 0, 0.006, 0.006);
  for (const sx of [-1, 1]) for (const [z, y] of [[-0.282, 0.044], [-0.242, 0.044], [-0.302, 0.026], [-0.262, 0.026]]) cy(g, M.rubber, sx * 0.0252, y, z, 0.0078, 0.002, 0, 0, Math.PI / 2);
  prof(g, M.dark, [[-0.347, 0.03, 0.002], [-0.329, 0.03, 0.002], [-0.329, -0.012, 0.003], [-0.335, -0.017, 0.003], [-0.347, -0.014, 0.003]], 0.012, 0, 0.002, 0.002);
  // front sight base (holds the tube and barrel), barrel, three-lug flash hider (replaced by the muzzle device)
  prof(g, M.dark, [[-0.347, 0.074, 0.003], [-0.31, 0.074, 0.003], [-0.31, 0.04, 0.003], [-0.347, 0.024, 0.003]], 0.022, 0, 0.003, 0.003);
  const tip = -0.386 - bl;
  cy(g, M.metal, 0, 0.03, (-0.346 + tip) / 2, 0.0065, Math.abs(tip + 0.346));
  if (!c.A.muzzle) {
    cy(g, M.dark, 0, 0.03, tip + 0.012, 0.0098, 0.024);
    for (let i = 0; i < 3; i++) bx(g, M.metal, Math.cos(i * 2.1) * 0.0105, 0.03 + Math.sin(i * 2.1) * 0.0105, tip + 0.018, 0.004, 0.004, 0.01);
  }
  // front sight under tunnel and drum rear sight; claw rail placed on the tube if there is an optic. The eye is 10.5 cm from the rear sight:
  // its ring, small and thin, surrounds the front sight tunnel (two concentric circles, the tip at the center); its wings, thin and
  // shallow, no longer show their side
  info.sightY = 0.088; info.adsZ = 0.105;
  if (!c.optic) {
    bx(g, M.dark, 0, 0.078, -0.331, 0.006, 0.01, 0.012);
    cz(g, M.dark, 0, 0.088, -0.331, 0.013, 0.016, G_CYL_O).material = M.tube;
    bx(g, M.sight, 0, 0.081, -0.331, ironW(c, -0.331, IRON.post), 0.014, 0.004);
    bx(g, M.dark, 0, 0.0765, 0.0, 0.018, 0.006, 0.024);
    for (const sx of [-1, 1]) bx(g, M.dark, sx * 0.0085, 0.087, 0.0, ironW(c, 0, IRON.wing), 0.022, 0.006); // wings, on the base
    ironFoot(c, M.dark, 0, 0.079, ironRing(c, 0, IRON.hole.smg), 0.008);
  } else {
    rb(g, M.dark, 0, 0.0775, -0.07, 0.026, 0.008, 0.18, 0.002);
    for (let i = 0; i < 14; i++) bx(g, M.dark, 0, 0.0825, -0.15 + i * 0.012, 0.026, 0.004, 0.006);
  }
  // rear end cap of the receiver (carries the stock), sling ring
  prof(g, M.dark, [[0.036, 0.074, 0.003], [0.082, 0.074, 0.006], [0.086, 0.062, 0.004], [0.086, 0.004, 0.004], [0.036, 0.002, 0.003]], 0.04, 0, 0.003, 0.004);
  part(g, G_TOR, M.metal, -0.021, 0.004, 0.08, 0.008, 0.008, 0.008, 0, Math.PI / 2, 0);
  // polymer frame: magazine well, paddle, rounded trigger guard, trigger, selector, pins, tilted grip
  prof(g, M.dark, [[-0.182, 0.008, 0.002], [-0.124, 0.008, 0.002], [-0.124, -0.044, 0.004], [-0.182, -0.044, 0.004]], 0.034, 0, 0.003, 0.003);
  rb(g, M.metal, 0, -0.042, -0.122, 0.012, 0.032, 0.004, 0.0015, -0.2);
  prof(g, M.poly, [[-0.128, 0.008, 0.002], [0.044, 0.008, 0.004], [0.044, -0.03, 0.006], [0.02, -0.056, 0.004], [-0.104, -0.048, 0.006], [-0.128, -0.04, 0.004]], 0.036, 0, 0.003, 0.004);
  prof(g, M.poly, [[-0.112, -0.044, 0.004], [-0.09, -0.084, 0.012], [-0.016, -0.084, 0.01], [0.004, -0.06, 0.004], [0.006, -0.044, 0]], 0.012, 0, 0.002, 0.004,
    [[[-0.1, -0.046, 0.002], [-0.084, -0.076, 0.008], [-0.02, -0.076, 0.007], [-0.006, -0.058, 0.003], [-0.006, -0.046, 0]]]);
  rb(g, M.metal, 0, -0.06, -0.058, 0.006, 0.024, 0.006, 0.002, 0.18);
  cy(g, M.metal, -0.0185, -0.012, -0.034, 0.007, 0.004, 0, 0, Math.PI / 2);
  rb(g, M.metal, -0.0195, -0.026, -0.031, 0.003, 0.026, 0.006, 0.001, -0.2);
  for (const [z, y] of [[0.05, 0.005], [-0.12, -0.02]]) cy(g, M.metal, 0, y, z, 0.0048, 0.0392, 0, 0, Math.PI / 2);
  gripProf(g, M.poly, 0.025, -0.02, 0.066, -0.144, 0.048, 0.034, 0.004);
  // retractable stock: two rods and curved buttplate (variants: no stock, end cap; reinforced, fixed stock)
  let butt;
  if (c.stock === 'none') {
    rb(g, M.rubber, 0, 0.038, 0.089, 0.04, 0.06, 0.006, 0.003);
    butt = 0.092;
  } else if (c.stock === 'heavy') {
    prof(g, M.poly, [[0.084, 0.07, 0.004], [0.13, 0.072, 0.01], [0.262, 0.074, 0.006], [0.262, -0.05, 0.006], [0.19, -0.03, 0.012], [0.1, -0.006, 0.006], [0.084, 0.0, 0.004]], 0.044, 0, 0.004, 0.004);
    rb(g, M.rubber, 0, 0.012, 0.266, 0.046, 0.12, 0.008, 0.004);
    butt = 0.27;
  } else {
    for (const sx of [-1, 1]) cy(g, M.metal, sx * 0.0155, 0.031, 0.161, 0.0055, 0.154);
    prof(g, M.dark, [[0.226, 0.05, 0.004], [0.262, 0.052, 0.006], [0.264, 0.035, 0.004], [0.258, -0.07, 0.006], [0.252, -0.078, 0.004], [0.238, -0.075, 0.006], [0.238, 0.02, 0.006], [0.226, 0.03, 0.004]], 0.044, 0, 0.004, 0.005);
    rb(g, M.rubber, 0, -0.015, 0.2625, 0.042, 0.095, 0.006, 0.003, 0.05);
    butt = 0.266;
  }
  info.butt = [0, 0.0, butt];
  // curved magazine: top in the well, the arc leans forward
  info.magHome.set(0, -0.036, -0.153);
  info.buildMag = (parent, ext) => curvedMag(parent, M, 6, 0.165 * ext, 0.024, 0.036, 0.5, M.dark);
  info.magAxis = new V3(0, -0.99, -0.14); info.magGrip = new V3(0, -0.06, -0.011);
  info.gripR.set(0, -0.07, 0.047); info.gripL.set(0, 0.03, -0.262);
  info.mount.optic = { y: 0.083, z: -0.07, len: 0.18, D: 0.22 };
  info.mount.muzzle = { x: 0, y: 0.03, z: tip, r: 0.0075 };
  info.mount.under = { y: 0.0075, z: -0.272, len: 0.1 };
  info.mount.side = { x: -0.025, y: 0.03, z: -0.3 };
  info.muzzle.position.set(0, 0.03, tip - 0.01); info.eject.position.set(0.022, 0.046, -0.09);
  info.gripDef = {
    R: [{ c: [0, -0.075, 0.046], h: [0.017, 0.055, 0.024], r: 0.01, rx: -0.32 }, { c: [0, -0.02, -0.04], h: [0.018, 0.03, 0.085], r: 0.008 }],
    // handguard (holes included), cocking tube, front tab under the barrel (the thumb stretched toward the muzzle stops there)
    L: [{ c: [0, 0.031, -0.272], h: [0.0265, 0.025, 0.058], r: 0.006 }, { c: [0, 0.065, -0.27], h: [0.0095, 0.0095, 0.05], r: 0.009 }, { c: [0, 0.007, -0.338], h: [0.006, 0.024, 0.009], r: 0.002 }],
  };
  info.trigDef = { at: [0.004, -0.064, -0.07], xTip: -0.004, guard: [{ c: [0, -0.08, -0.05], h: [0.006, 0.004, 0.04], r: 0.002 }, { c: [0, -0.062, -0.1], h: [0.006, 0.018, 0.006], r: 0.002 },
    { c: [0, -0.06, -0.058], h: [0.003, 0.012, 0.003], r: 0.002, rx: 0.18 }, { c: [0, -0.02, -0.153], h: [0.017, 0.024, 0.029], r: 0.004 }] };
});

/* ---------- L96A1: single-piece taupe stock (forearm with notched side rail, sling slot,
   sling base, receiver cradle, magazine well, thumb hole behind a narrower grip, bolted cheek riser, spacers and
   buttplate), round receiver and ball bolt, heavy barrel with rings, folding front sight, muzzle brake with two vents on
   its ring, straight magazine, scope with flared objective (turrets, collars with knobs on their base, eyepiece with
   magnification ring, lenses visible at both ends). Dimensions taken from a side view (0.73 mm per pixel, length 1.18 m);
   trigger, grip and bolt at the dimensions of the old model for the game's hand and the bolt animation, stock set back
   by the same amount (4.5 cm). ---------- */
defineGun('l96', 'sniper', (c) => {
  const { g, M, info } = c, S = M.taupe, heavy = c.stock === 'heavy';
  // stock: forearm with sloping nose, receiver cradle (lower above the ejection), magazine well, wrist above
  // the thumb hole, cheek riser, heel; the narrower grip closes the thumb hole from the front
  prof(g, S, [[-0.437, 0.0425, 0.005], [-0.1, 0.0425, 0.002], [-0.096, 0.035, 0.002], [0.086, 0.035, 0.004], [0.094, 0.028, 0.004], [0.315, 0.03, 0.002],
    [0.318, 0.033, 0.002], [0.361, 0.033, 0.004], [0.361, -0.1, 0.004], [0.125, -0.101, 0.006], [0.125, -0.066, 0.004], [0.135, -0.062, 0.008], [0.15, -0.05, 0.006],
    [0.15, -0.0074, 0.008], [0.09, -0.0074, 0.004], [-0.058, -0.0074, 0.003], [-0.062, -0.0206, 0.003], [-0.148, -0.0206, 0.004], [-0.186, -0.0074, 0.008],
    [-0.403, -0.0074, 0.01]], 0.05, 0, 0.004, 0.004);
  prof(g, S, [[0.042, 0.0, 0.002], [0.05, -0.012, 0.004], [0.073, -0.104, 0.006], [0.128, -0.104, 0.004], [0.128, -0.07, 0.002], [0.118, -0.058, 0.006],
    [0.094, -0.0074, 0.004], [0.094, 0.0, 0.002]], 0.04, 0, 0.006, 0.004);
  cy(g, M.dark, 0, -0.07, 0.098, 0.003, 0.0412, 0, 0, Math.PI / 2);
  // side rail of the forearm (protrudes by 2 mm), notches under the rail, screws; sling slot; sling base (removed under
  // an accessory)
  prof(g, S, [[-0.402, 0.0198, 0.012], [-0.15, 0.0198, 0.01], [-0.144, 0.012, 0.004], [-0.144, -0.0074, 0.002], [-0.402, -0.0074, 0.004]], 0.054, 0, 0.0015, 0.004);
  for (let i = 0; i < 6; i++) rb(g, M.dark, 0, -0.0035, -0.308 + i * 0.018, 0.0546, 0.009, 0.0055, 0.001);
  cy(g, M.dark, 0, 0.0095, -0.392, 0.003, 0.0556, 0, 0, Math.PI / 2);
  for (const z of [-0.047, -0.159]) cy(g, M.dark, 0, z < -0.1 ? 0.002 : 0.014, z, 0.003, 0.0506, 0, 0, Math.PI / 2);
  prof(g, M.rubber, [[-0.007, 0.0033], [0.007, 0.0033], [0.007, -0.0033], [-0.007, -0.0033]], 0.0506, 0, 0, 0.0033).position.set(0, 0.024, -0.415);
  if (!c.A.under) {
    cy(g, M.metal, 0, -0.012, -0.362, 0.008, 0.01, 0);
    bx(g, M.metal, 0, -0.021, -0.362, 0.003, 0.01, 0.004);
    part(g, G_TOR, M.metal, 0, -0.031, -0.362, 0.0075, 0.009, 0.0075, 0, Math.PI / 2, 0);
  }
  // cheek riser (higher with the reinforced stock) on its bolted plate, spacers, buttplate, rear base
  rb(g, S, 0, heavy ? 0.04 : 0.0355, 0.25, 0.046, heavy ? 0.026 : 0.017, 0.13, 0.006);
  rb(g, S, 0, 0.006, 0.258, 0.052, 0.044, 0.12, 0.004);
  for (const [y, z, w] of [[0.0124, 0.2164, 0.0532], [0.0124, 0.2458, 0.0532], [-0.0338, 0.1995, 0.0512], [-0.0338, 0.3029, 0.0512]]) cy(g, M.dark, 0, y, z, 0.0028, w, 0, 0, Math.PI / 2);
  for (const z of [0.3155, 0.3495]) rb(g, M.dark, 0, -0.0335, z, 0.0505, 0.133, 0.0015, 0.001);
  rb(g, M.rubber, 0, -0.0335, 0.373, 0.052, 0.137, 0.024, 0.006);
  cy(g, M.metal, 0, -0.106, 0.3, 0.0085, 0.01, 0);
  part(g, G_TOR, M.metal, 0, -0.119, 0.3, 0.007, 0.0085, 0.007, 0, Math.PI / 2, 0);
  info.butt = [0, -0.02, 0.38];
  // round receiver, bolt sleeve and cocking indicator, ejection window (right), bolt catch (left)
  cy(g, M.metal, 0, 0.044, -0.0625, 0.017, 0.295);
  cy(g, M.dark, 0, 0.044, 0.1, 0.0145, 0.03);
  cy(g, M.metal, 0, 0.044, 0.117, 0.006, 0.006);
  rb(g, M.dark, 0.0162, 0.05, -0.035, 0.002, 0.013, 0.065, 0.001);
  rb(g, M.dark, -0.0172, 0.04, -0.045, 0.003, 0.006, 0.03, 0.001);
  // bolt: bent ball handle (the right hand grabs it, the animation turns it and pulls it back)
  info.bolt = new THREE.Group(); info.bolt.position.set(0.02, 0.045, 0.07); g.add(info.bolt);
  part(info.bolt, G_CYL, M.metal, -0.004, 0.008, 0, 0.007, 0.018, 0.007, 0, 0, Math.PI / 2);
  part(info.bolt, G_CYL, M.metal, 0.03, 0, 0, 0.006, 0.06, 0.006, 0, 0, Math.PI / 2 - 0.4);
  part(info.bolt, new THREE.SphereGeometry(1, 12, 10), M.dark, 0.058, -0.012, 0, 0.012, 0.012, 0.012);
  // heavy barrel and its seat, rings, folding front sight (base, fins, front sight, folded cover), muzzle brake with two vents on
  // its ring (replaced by the muzzle device if there is one)
  const tip = -0.767;
  cy(g, M.metal, 0, 0.044, -0.2275, 0.0128, 0.025);
  cy(g, M.metal, 0, 0.044, (tip - 0.215) / 2, 0.011, -0.215 - tip);
  for (const z of [-0.6505, -0.5968]) cy(g, M.dark, 0, 0.044, z, 0.0113, 0.0095);
  rb(g, M.dark, 0, 0.0445, -0.7337, 0.026, 0.028, 0.025, 0.004);
  for (const sx of [-1, 1]) rb(g, M.dark, sx * 0.0075, 0.069, -0.7357, 0.003, 0.022, 0.02, 0.001);
  bx(g, M.dark, 0, 0.0665, -0.7357, 0.002, 0.016, 0.003);
  rb(g, M.dark, 0, 0.067, -0.7115, 0.016, 0.01, 0.033, 0.004);
  if (!c.A.muzzle) {
    cy(g, M.metal, 0, 0.044, -0.7795, 0.0147, 0.0257);
    cy(g, M.dark, 0, 0.0285, -0.78, 0.003, 0.004, 0);
    cy(g, M.metal, 0, 0.044, -0.8147, 0.0128, 0.0446);
    cone(g, M.metal, 0, 0.044, -0.8386, 0.0106, 0.0128, 0.0031);
    cy(g, M.rubber, 0, 0.044, -0.8402, 0.004, 0.0004);
    for (const z of [-0.8218, -0.802]) bx(g, M.rubber, 0, 0.046, z, 0.0262, 0.016, 0.0147);
  }
  // scope: flared objective (lens at the bottom), tube, saddle and turrets (top, right) and its left plate, eyepiece with
  // magnification ring (visible lens); two collars on their base, clamping knobs on the left, level
  const sy = 0.0946;
  rb(g, M.dark, 0, 0.065, -0.102, 0.026, 0.012, 0.154, 0.002);
  rb(g, M.dark, -0.004, 0.0715, -0.0555, 0.018, 0.009, 0.027, 0.002);
  for (const z of [-0.1697, -0.0838]) {
    cy(g, M.dark, 0, sy, z, 0.0148, 0.017);
    rb(g, M.dark, 0, 0.0755, z, 0.024, 0.011, 0.017, 0.002);
    cy(g, M.metal, -0.016, 0.066, z, 0.0095, 0.008, 0, 0, Math.PI / 2);
    cy(g, M.dark, -0.0205, 0.066, z, 0.004, 0.002, 0, 0, Math.PI / 2);
  }
  scopeEnd(g, M, sy, -0.2798, 0.0262, 0.0262, -1, 0.0147, M.dark, M.metal);
  cone(g, M.dark, 0, sy, -0.23315, 0.025, 0.0125, 0.0639);
  cy(g, M.dark, 0, sy, -0.1223, 0.0125, 0.1578);
  rb(g, M.dark, 0, sy, -0.1285, 0.029, 0.029, 0.042, 0.009);
  rb(g, M.metal, -0.0148, sy, -0.1285, 0.002, 0.012, 0.04, 0.005);
  cy(g, M.dark, 0, sy + 0.0211, -0.1304, 0.0115, 0.014, 0);
  cy(g, M.metal, 0, sy + 0.0262, -0.1304, 0.0118, 0.005, 0);
  cy(g, M.dark, 0, sy + 0.0294, -0.1304, 0.009, 0.0022, 0);
  cy(g, M.dark, 0.0211, sy, -0.1304, 0.0105, 0.014, 0, 0, Math.PI / 2);
  cy(g, M.metal, 0.0262, sy, -0.1304, 0.0108, 0.005, 0, 0, Math.PI / 2);
  cone(g, M.dark, 0, sy, -0.0374, 0.0125, 0.0185, 0.012);
  cy(g, M.dark, 0, sy, -0.0274, 0.0188, 0.008);
  for (const z of [-0.0302, -0.0274, -0.0246]) cy(g, M.rubber, 0, sy, z, 0.0191, 0.0012);
  cy(g, M.dark, 0, sy, 0.0037, 0.0205, 0.0542);
  scopeEnd(g, M, sy, 0.0388, 0.022, 0.0205, 1, 0.008);
  // straight magazine, slanted base plate
  info.magHome.set(0, -0.0206, -0.1047);
  info.buildMag = (parent, ext) => {
    const yb = -0.033 - (ext - 1) * 0.06;
    prof(parent, M.dark, [[-0.0404, 0.012, 0.001], [-0.0404, yb, 0.004], [0.0404, yb - 0.0035, 0.004], [0.0404, 0.012, 0.001]], 0.03, 0, 0.003, 0.003);
    rb(parent, M.metal, 0, yb - 0.0012, 0, 0.032, 0.005, 0.084, 0.002, 0.043);
  };
  info.magAxis = new V3(0, -1, 0); info.magGrip = new V3(0, -0.02, 0);
  // trigger guard and trigger, between the magazine and the grip
  guard(g, M.dark, -0.052, 0.024, -0.005, -0.062, 0.005, 0.004, 0.01);
  rb(g, M.metal, 0, -0.028, -0.021, 0.006, 0.046, 0.006, 0.002, 0.18);
  info.gripR.set(0, -0.055, 0.075); info.gripL.set(0, 0.018, -0.25);
  info.sightY = sy; info.adsZ = 0.13;
  info.mount.muzzle = { x: 0, y: 0.044, z: tip, r: 0.011 };
  info.mount.under = { y: -0.0074, z: -0.345, len: 0.12 };
  info.muzzle.position.set(0, 0.044, c.A.muzzle ? tip - 0.01 : -0.845); info.eject.position.set(0.02, 0.05, -0.035);
  info.gripDef = {
    R: [{ c: [0, -0.058, 0.088], h: [0.02, 0.046, 0.027], r: 0.01, rx: -0.23 }, { c: [0, 0.01, 0.12], h: [0.025, 0.018, 0.035], r: 0.006 }, { c: [0, 0.03, -0.06], h: [0.025, 0.035, 0.15], r: 0.01 }],
    L: [{ c: [0, 0.0175, -0.29], h: [0.027, 0.025, 0.11], r: 0.005 }],
  };
  info.trigDef = { at: [0.004, -0.044, -0.033], xTip: -0.004, guard: [{ c: [0, -0.0595, -0.014], h: [0.005, 0.0025, 0.038], r: 0.002 }, { c: [0, -0.033, -0.0495], h: [0.0045, 0.028, 0.0025], r: 0.002 },
    { c: [0, -0.028, -0.021], h: [0.003, 0.023, 0.003], r: 0.002, rx: 0.18 }, { c: [0, -0.038, -0.1047], h: [0.016, 0.018, 0.041], r: 0.004 }] };
});

/* ---------- M1014 (Benelli M4): built from a side view, right side (P: 1.322 mm per pixel, real length 1010 mm;
   the muzzle is on the right of the photo, z grows toward the left). Black receiver with rail and ejection window (bolt and handle visible),
   "ghost ring" rear sight on its ears at the rear of the rail, barrel and magazine tube joined by a collar with sling swivel, front sight with
   ears, ribbed handguard around the tube, fixed stock with pistol grip (grooved panels), sling slot, buttplate.
   The game's right hand holds the trigger 10.8 cm in front of its grip (the real weapon: 6.4 cm): the stock and grip (Q)
   move back by D = 3.6 cm, the trigger guard lengthens by the same amount.
   Check: node tools/dev/visual/contour.js --firearm m1014 --photo <right profile, 800 x 600> --mmpx 1.322 --side right
   --anchorPt 297,268,-0.0285,0.037 (front; the rear is shifted by D). ---------- */
defineGun('m1014', 'shotgun', (c) => {
  const { g, M, info } = c, B = M.polyM, D0 = M.dark, K = M.rubber, sx2 = [-1, 1], ext = c.A.mag === 'xmag' ? 0.04 : 0; // fine-grain polymer (the stock is under the eye when aiming); tube extended by the extended magazine
  const S = 0.001322, D = 0.0364, P = (x, y, r) => { const q = [-0.0285 - (x - 297) * S, 0.037 - (y - 268) * S]; if (r !== undefined) q.push(r); return q; };
  const Q = (x, y, r) => { const q = P(x, y, r); q[0] += D; return q; }, R = (x, y, r) => (x < 282 ? Q(x, y, r) : P(x, y, r));
  const Pz = (x) => P(x, 0)[0], Qz = (x) => Pz(x) + D, Py = (y) => P(0, y)[1];
  const by = Py(268), ty = Py(289.5), fine = (m, k = 2.5) => { m.geometry = m.geometry.clone(); const uv = m.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k); return m; };

  // ----- receiver: top sloping down toward the stock, rail, ejection window (chrome bolt, handle) on the right -----
  fine(prof(g, D0, [P(425, 257, 0.003), P(425, 300, 0.002), P(320, 300, 0.002), P(282, 302, 0.002), Q(281, 302, 0.002), Q(262, 296, 0.004), Q(262, 262, 0.004), Q(280, 254, 0.004), P(300, 253, 0.004),
    P(330, 253, 0.002)], 0.032, 0, 0.003, 0.003), 6); // fine grain: the top is under the eye when aiming
  rb(g, D0, 0, Py(251), (Pz(330) + Pz(423)) / 2, 0.02, 0.005, Pz(330) - Pz(423), 0.001);
  for (let x = 333; x < 420; x += 7.4) bx(g, D0, 0, Py(248), Pz(x + 1.8), 0.022, 0.003, 0.0045);
  rb(g, K, 0.0161, Py(271), (Pz(333) + Pz(420)) / 2, 0.0012, Py(262) - Py(281), Pz(333) - Pz(420), 0.0006);
  rb(g, M.steel, 0.0158, Py(271), (Pz(340) + Pz(410)) / 2, 0.002, Py(264) - Py(279), Pz(340) - Pz(410), 0.0008);
  { const q = P(398, 272); cy(g, M.steel, 0.024, q[1], q[0], 0.0028, 0.014, 0, 0, Math.PI / 2); part(g, new THREE.SphereGeometry(1, 8, 6), M.steel, 0.031, q[1], q[0], 0.0042, 0.0042, 0.0042); }
  // receiver seen from below: loading port (in front of the trigger guard), catch button
  rb(g, K, 0, Py(300) - 0.0003, (Pz(330) + Pz(415)) / 2, 0.016, 0.0012, Pz(330) - Pz(415), 0.0005);
  cy(g, M.metal, 0.0164, Py(291), Pz(334), 0.0028, 0.002, 0, 0, Math.PI / 2);

  // ----- barrel, magazine tube, collar with sling swivel, ribbed handguard -----
  const tip = Pz(778);
  cz(g, M.metal, 0, by, (tip + Pz(420)) / 2, 0.0106, Pz(420) - tip);
  cz(g, K, 0, by, tip - 0.0001, 0.0076, 0.0006);
  const tEnd = Pz(742) - ext;
  cz(g, M.metal, 0, ty, (tEnd + Pz(420)) / 2, 0.0126, Pz(420) - tEnd);
  cz(g, D0, 0, ty, tEnd - 0.012, 0.0142, 0.024); cone(g, D0, 0, ty, tEnd - 0.0285, 0.0105, 0.0142, 0.009);
  if (ext) part(g, G_TOR, D0, 0, ty, Pz(742) + 0.002, 0.0131, 0.0131, 0.025); // extension joint
  prof(g, D0, [P(616, 262, 0.004), P(650, 262, 0.004), P(650, 303, 0.004), P(616, 303, 0.004)], 0.03, 0, 0.003, 0.003);
  part(g, G_TOR, M.metal, 0, Py(312), Pz(628), 0.0085, 0.0095, 0.0085, 0, Math.PI / 2, 0);
  fine(prof(g, B, [P(487, 271, 0.006), P(606, 271, 0.006), P(613, 282, 0.004), P(612, 306, 0.006), P(600, 310, 0.004), P(495, 310, 0.004), P(486, 300, 0.006)], 0.046, 0, 0.008, 0.004));
  for (let x = 498; x < 600; x += 5.2) for (const sx of sx2) bx(g, K, sx * 0.0232, Py(298), Pz(x), 0.0012, Py(287) - Py(308), 0.0016);

  // ----- sighting parts (nothing if an optic replaces them): front sight with ears on its collar, ghost ring on its ears -----
  // sight line at the top of the front sight blade (y 243 on the photo, 4 mm above the measured dimension: at 1.2 mm from the receiver rail,
  // the blade only protruded by 3 mm when aiming, and its ears, taller, read in its place; they now stop
  // below its tip). The eye is 10.5 cm from the ring: fine stroke and wide opening (12% of the screen), on a post; thin wings
  // and shallow (their side no longer shows)
  const SY = Py(243);
  info.sightY = SY; info.adsZ = Pz(289) + 0.105; // ghost ring: the eye right next to the ring
  if (!c.optic) {
    rb(g, D0, 0, Py(258), Pz(748), 0.016, 0.008, 0.02, 0.002);
    prof(g, M.sight, [P(744, 256), [Pz(745), SY, 0.0005], [Pz(751), SY, 0.0005], P(753, 256)], 0.0026, 0, 0.0004, 0.0006);
    for (const sx of sx2) prof(g, D0, [P(738, 258), P(741, 244.5, 0.001), P(752, 244.5, 0.001), P(758, 258)], 0.002, sx * 0.0068, 0.0005, 0.001);
    rb(g, D0, 0, Py(251.5), Pz(289), 0.026, 0.004, 0.02, 0.0015);
    ironFoot(c, D0, Pz(289), Py(250.5), ironRing(c, Pz(289), 0.12), 0.008);
    for (const sx of sx2) bx(g, D0, sx * 0.0125, (Py(253) + SY + 0.003) / 2, Pz(289), ironW(c, Pz(289), IRON.wing), SY + 0.003 - Py(253), 0.006);
  }

  // ----- trigger guard (lengthened up to the grip), trigger -----
  prof(g, D0, [P(322, 300, 0.001), P(322, 316, 0.004), P(316, 322, 0.004), Q(285, 323, 0.004), Q(279, 318, 0.003), Q(279, 300, 0.001)], 0.008, 0, 0.0015, 0.002,
    [[P(318, 301, 0.001), P(318, 315, 0.003), P(314, 319, 0.003), Q(286, 320, 0.003), Q(282, 316, 0.002), Q(282, 301, 0.001)]]);
  prof(g, M.metal, [P(304, 300), P(302, 306, 0.003), P(296, 312, 0.004), P(290, 318, 0.002), P(293, 319, 0.001), P(299, 314, 0.004), P(305, 307, 0.003), P(308, 300)], 0.006, 0, 0.0012, 0.0015);

  // ----- fixed stock and pistol grip (Q) -----
  fine(prof(g, B, [Q(281, 254, 0.002), Q(262, 262, 0.004), Q(240, 271, 0.01), Q(210, 280, 0.01), Q(150, 288, 0.01), Q(90, 296, 0.008), Q(40, 302, 0.006), Q(30, 304, 0.003), Q(30, 394, 0.003),
    Q(40, 395, 0.006), Q(100, 368, 0.01), Q(160, 340, 0.01), Q(200, 321, 0.008), Q(212, 316, 0.006), Q(232, 318, 0.006), Q(272, 303, 0.004), Q(281, 302, 0.002)], 0.042, 0, 0.005, 0.004), 6);
  fine(prof(g, B, [Q(272, 302, 0.002), Q(271, 324, 0.004), Q(267, 334, 0.008), Q(263, 344, 0.01), Q(258, 356, 0.01), Q(254, 370, 0.006), Q(256, 378, 0.004), Q(262, 384, 0.004),
    Q(258, 390, 0.003), Q(238, 389, 0.006), Q(214, 380, 0.004), Q(212, 372, 0.006), Q(218, 360, 0.01), Q(223, 348, 0.01), Q(228, 336, 0.008), Q(231, 324, 0.004), Q(226, 316, 0.002)], 0.031, 0, 0.004, 0.003));
  for (let k = 0; k < 10; k++) { const y = 334 + k * 5, xm = 244 - (y - 334) * 0.33, a = Q(xm - 10, y), b = Q(xm + 10, y); for (const sx of sx2) bx(g, K, sx * 0.0158, a[1], (a[0] + b[0]) / 2, 0.0012, 0.0014, Math.abs(b[0] - a[0])); }
  prof(g, K, [Q(14, 312, 0.004), Q(30, 304, 0.002), Q(30, 394, 0.002), Q(26, 398, 0.003), Q(14, 360, 0.006)], 0.044, 0, 0.004, 0.003);
  for (const sx of sx2) rb(g, K, sx * 0.0212, Py(331), (Qz(75) + Qz(100)) / 2, 0.0012, Py(318) - Py(345), Qz(75) - Qz(100), 0.002);

  // ----- shell (the one the left hand brings to the loading port) -----
  info.magHome.set(0, Py(300), Pz(372));
  info.buildMag = (parent) => { part(parent, G_CYL, SHELL_RED, 0, -0.012, 0, 0.011, 0.05, 0.011); part(parent, G_CYL, M.brass, 0, -0.045, 0, 0.0115, 0.02, 0.0115); };
  info.magGrip = new V3(0, -0.03, 0);
  info.tubeFed = true; info.mag.visible = false;

  // ----- hands, aiming, mounts -----
  info.butt = [0, Py(350), Qz(16)];
  info.gripR.set(0, Py(316), Qz(250)); info.gripL.set(0, ty, Pz(491));
  info.mount.optic = { y: Py(250), z: (Pz(333) + Pz(420)) / 2, len: Pz(333) - Pz(420), D: 0.2 };
  info.mount.muzzle = { x: 0, y: by, z: tip, r: 0.0106 };
  info.mount.side = { x: -0.0146, y: ty, z: Pz(690) };
  info.muzzle.position.set(0, by, tip - 0.01); info.eject.position.set(0.02, Py(271), (Pz(333) + Pz(420)) / 2);
  info.gripDef = {
    R: [{ c: [0, Py(350), Qz(242)], h: [0.0155, 0.048, 0.024], r: 0.01, rx: -0.33 }, { c: [0, Py(285), Pz(360)], h: [0.016, 0.022, 0.06], r: 0.006 }],
    L: [{ c: [0, Py(290.5), Pz(550)], h: [0.023, (310 - 271) / 2 * S, (Pz(487) - Pz(612)) / 2], r: 0.012 }],
  };
  info.trigDef = { at: [0.004, Py(314), Pz(305) - 0.0085], xTip: -0.004, guard: [] };
});

/* ---------- M9 (Beretta 92): slide open on top (the barrel shows), full nose and white-dot front sight, rear
   serrations, ambidextrous safety-decocker levers, two-dot rear sight; smooth dust-cover frame, spurred hammer, beavertail,
   takedown lever and slide stop on the left, round hooked trigger guard, curved trigger; wide grip with black
   panels (screw, medallion), lanyard ring, steel magazine with base plate. Dimensions taken from a side view (0.2 mm per pixel, real height
   140 mm); the grip keeps the place and angle of the other pistols' (hands, magazine, reload), the rear of the weapon
   moved back by the same amount (1.1 cm). ---------- */
defineGun('m9', 'pistol', (c) => {
  const { g, M, info } = c, D = M.blued, K = M.rubber, by = 0.0375, sx2 = [-1, 1], dotG = new THREE.SphereGeometry(1, 6, 4);
  // grip frame (the same as the other pistols'): b toward the rear, d downward, from its center
  const G = (b, d, r) => { const q = [0.012 + b * 0.976 + d * 0.218, -0.05 + b * 0.218 - d * 0.976]; if (r !== undefined) q.push(r); return q; };

  // ----- slide (recoils on firing): full nose, flanks open on top up to the solid rear -----
  const sl = new THREE.Group(); g.add(sl); info.slide = sl; info.slideTravel = 0.034;
  prof(sl, M.blued, [[-0.177, 0.0214, 0.002], [-0.177, 0.0445, 0.003], [-0.1589, 0.0445, 0.002], [-0.1565, 0.0355, 0.002], [-0.0604, 0.0355, 0.001], [-0.0604, 0.0445, 0.001],
    [0.025, 0.0445, 0.006], [0.028, 0.04, 0.003], [0.028, 0.0214, 0.002]], 0.03, 0, 0.003, 0.002);
  // rear serrations, safety-decocker levers (axis, red dot underneath)
  for (let k = 0; k < 18; k++) for (const sx of sx2) bx(sl, K, sx * 0.0151, 0.0275, -0.0565 + k * 0.0029, 0.0012, 0.012, 0.0013);
  for (const sx of sx2) {
    prof(sl, D, [[0.001, 0.034, 0.004], [0.004, 0.0395, 0.003], [0.0135, 0.0445, 0.002], [0.016, 0.042, 0.002], [0.0105, 0.033, 0.004], [0.0055, 0.0295, 0.004]], 0.0022, sx * 0.0158, 0.0007, 0.003);
    cy(sl, D, sx * 0.0168, 0.0345, 0.0059, 0.0032, 0.0016, 0, 0, Math.PI / 2);
    part(sl, dotG, M.dot, sx * 0.0151, 0.0244, 0.0039, 0.0003, 0.0011, 0.0011);
  }
  // notch rear sight with two dots, white-dot front sight (nothing if an optic replaces them)
  if (!c.optic) {
    prof(sl, D, [[-0.0001, 0.0445, 0], [0.0025, 0.0468, 0.001], [0.0069, 0.0468, 0.0005], [0.0069, 0.0445, 0]], 0.019, 0, 0.0006, 0.001);
    for (const sx of sx2) {
      prof(sl, D, [[0.0012, 0.0465, 0], [0.0032, 0.0496, 0.0006], [0.0069, 0.0496, 0.0005], [0.0069, 0.0465, 0]], 0.0072, sx * 0.0058, 0.0005, 0.0006);
      part(sl, dotG, M.dotW, sx * 0.0058, 0.0483, 0.007, 0.001, 0.001, 0.0004);
    }
    prof(sl, D, [[-0.1755, 0.0442, 0], [-0.172, 0.0496, 0.001], [-0.1665, 0.0496, 0.0005], [-0.1665, 0.0442, 0]], 0.0035, 0, 0.0005, 0.0008);
    part(sl, dotG, M.dotW, 0, 0.0483, -0.1663, 0.0011, 0.0011, 0.0005);
  }

  // ----- fixed barrel: visible in the slide opening, crown and bore in front of the nose -----
  cz(g, M.metal, 0, by, -0.1225, 0.0066, 0.125);
  cz(g, K, 0, by, -0.1852, 0.0045, 0.0006);

  // ----- frame -----
  // smooth dust cover, underside of the trigger guard, beavertail
  prof(g, D, [[-0.1764, 0.0214, 0.002], [0.029, 0.0214, 0.002], [0.037, 0.0165, 0.004], [0.0435, 0.0095, 0.002], [0.0405, 0.0065, 0.002], [0.034, 0.0033, 0.004],
    [0.026, -0.004, 0], [-0.03, -0.004, 0], [-0.096, 0.0074, 0.002], [-0.1609, 0.0074, 0.001], [-0.1609, 0.0094, 0.001], [-0.1764, 0.0094, 0.002]], 0.027, 0, 0.002, 0.002);
  // spurred hammer (pierced), behind the slide
  prof(g, D, [[0.024, 0.02, 0], [0.024, 0.0385, 0.002], [0.0275, 0.0435, 0.002], [0.0335, 0.0425, 0.002], [0.034, 0.039, 0.002], [0.0305, 0.035, 0.003], [0.0305, 0.02, 0]], 0.009, 0, 0.0012, 0.002);
  cy(g, K, 0, 0.0395, 0.0295, 0.0018, 0.0094, 0, 0, Math.PI / 2);
  // takedown lever and its button, slide stop (left), trigger pin, magazine catch button
  prof(g, D, [[-0.0895, 0.018, 0.002], [-0.077, 0.018, 0.002], [-0.0755, 0.012, 0.003], [-0.08, 0.0065, 0.003], [-0.089, 0.0065, 0.002]], 0.002, -0.0142, 0.0006, 0.002);
  cy(g, D, -0.0148, 0.0068, -0.0855, 0.0025, 0.0024, 0, 0, Math.PI / 2);
  prof(g, D, [[-0.0634, 0.0194, 0.002], [-0.0142, 0.0194, 0.002], [-0.0142, 0.0165, 0.001], [-0.051, 0.0165, 0.002], [-0.053, 0.0094, 0.003], [-0.0634, 0.0094, 0.003]], 0.002, -0.0145, 0.0006, 0.002);
  cy(g, D, 0, 0.0053, -0.0594, 0.0022, 0.0282, 0, 0, Math.PI / 2);
  cy(g, D, -0.0152, -0.0214, -0.0172, 0.0045, 0.004, 0, 0, Math.PI / 2);
  // round trigger guard and its ridged hook, curved trigger
  guard(g, D, -0.096, -0.024, 0.0074, -0.0312, 0.0048, 0.004, 0.008);
  rb(g, D, 0, -0.0215, -0.0972, 0.007, 0.013, 0.004, 0.0015, -0.2);
  for (let k = 0; k < 4; k++) { const ly = 0.004 - k * 0.003; bx(g, K, 0, -0.022 + 0.98 * ly, -0.09955 - 0.1987 * ly, 0.0072, 0.0008, 0.0012, -0.2); } // ridges on the slanted front face of the hook
  prof(g, D, [[-0.0625, 0.003], [-0.0605, -0.006, 0.006], [-0.0645, -0.017, 0.008], [-0.0715, -0.0245, 0.001], [-0.0705, -0.0255, 0.001], [-0.0655, -0.0215, 0.006],
    [-0.0575, -0.01, 0.006], [-0.0565, 0.003]], 0.0055, 0, 0.0012, 0.0015);
  // grip: frame (straight front, curved back), black panels protruding from the flanks, screw and medallion, lanyard ring
  prof(g, D, [G(-0.032, -0.062), G(-0.03, 0.038, 0.003), G(0.025, 0.038, 0.004), G(0.028, 0.02, 0.008), G(0.029, 0.0, 0.01), G(0.027, -0.03, 0.008), G(0.022, -0.05, 0.004), G(0.02, -0.062)], 0.028, 0, 0.003, 0.003);
  prof(g, M.grip, [G(-0.012, -0.06, 0.003), G(-0.026, -0.052, 0.004), G(-0.024, 0.032, 0.004), G(0.02, 0.032, 0.004), G(0.022, 0.0, 0.006), G(0.018, -0.045, 0.006), G(0.012, -0.058, 0.004)], 0.036, 0, 0.003, 0.003);
  for (const [b, d] of [[-0.004, -0.05], [0.0, 0.022]]) { const q = G(b, d); cy(g, M.metal, 0, q[1], q[0], 0.0028, 0.0372, 0, 0, Math.PI / 2); }
  { const q = G(-0.002, -0.022); cy(g, D, 0, q[1], q[0], 0.0068, 0.0366, 0, 0, Math.PI / 2); }
  { const q = G(0.024, 0.04); part(g, RING_REAR, M.metal, 0, q[1], q[0], 0.7, 0.7, 0.7, 0, Math.PI / 2, 0); }

  // ----- magazine: steel body in the grip (witness holes at the back), black base plate below; extended: longer -----
  const mw = 0.024, mh = 0.098, md = 0.04, c0 = G(0, -0.008);
  info.magHome.set(0, 0, 0);
  info.buildMag = (parent, ext) => {
    const ex = (ext - 1) * 0.1, t = new THREE.Group(); t.position.set(0, c0[1], c0[0]); t.rotation.x = -0.22; parent.add(t);
    rb(t, M.metal, 0, -ex / 2, 0.0, mw, mh + ex, md, 0.003);
    for (let k = 0; k < 4; k++) part(t, dotG, M.dotW, 0.0, -0.01 - k * 0.011 - ex / 2, md / 2 + 0.0008, 0.0012, 0.0012, 0.0004);
    rb(t, D, 0, -mh / 2 - 0.006 - ex, -0.002, mw + 0.009, 0.012, md + 0.006, 0.003);
  };
  info.magAxis = new V3(0, -0.976, 0.218); info.magGrip = new V3(0, -0.092, 0.018);
  info.gripR.set(0, -0.05, 0.015); info.gripL.set(-0.02, -0.06, 0.005);

  // ----- aiming, mounts, muzzle, ejection -----
  info.sightY = 0.0496; info.adsZ = 0.41 + 0.0069; // sight line at the top of the front sight and rear sight ears, the eye 41 cm from it
  info.mount.optic = { y: 0.0445, z: -0.018, len: 0.08, D: 0.4, slide: sl }; // on the solid top, behind the opening
  info.mount.muzzle = { x: 0, y: by, z: -0.185, r: 0.0066 };
  info.mount.side = { x: 0, y: 0.0092, z: -0.13, under: true }; // laser pointer under the dust cover (its top 2 mm below y)
  info.muzzle.position.set(0, by, -0.1855); info.eject.position.set(0.012, 0.045, -0.04);
  // hand grip shapes: grip (its angle), frame, slide, trigger guard
  const gc = G(-0.0025, -0.012);
  info.gripDef = {
    R: [{ c: [0, gc[1], gc[0]], h: [0.018, 0.05, 0.0295], r: 0.008, rx: -0.22 }, { c: [0, 0.0144, -0.13], h: [0.0135, 0.007, 0.047], r: 0.003 }, { c: [0, 0.01, 0.012], h: [0.0135, 0.012, 0.025], r: 0.005 },
      { c: [0, 0.033, -0.074], h: [0.015, 0.0116, 0.1025], r: 0.003 }, { c: [0, -0.0288, -0.06], h: [0.004, 0.0025, 0.036], r: 0.002 }, { c: [0, -0.012, -0.0935], h: [0.004, 0.019, 0.0025], r: 0.002 }],
  };
  info.gripDef.L = info.gripDef.R;
  info.trigDef = { at: [0.004, -0.011, -0.073], xTip: -0.003, guard: [{ c: [0, -0.011, -0.064], h: [0.00275, 0.013, 0.0025], r: 0.0015, rx: 0.4 }] };
});
