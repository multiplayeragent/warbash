/* ==========================================================================
   SIROCCO: a round arena in the middle of the dunes, the biggest map in the game (70 m radius), with desert as far as the eye can see all around. Mirrored
   north-south: Alpha to the north (+z), Bravo to the south.
   - The terrain (smH): an erg (smErg), roughly east-west dune ridges, winding, cut across by north-south dunes and broken by passes, which
     you cross to advance and whose hollows give cover; their crests fall between the oasis, the camp and the base, while the camps and bases are
     in the hollows (flattened platforms, SM_PADS, where the erg fades out in a gentle slope). On top of that: a big hand-placed dune at the end
     of the sebkha and another between the camp and the base (SM_DUNES), the flat sebkha to the west (SM_PAN), snowdrift-like sand ramps that climb the
     rear flank of the plane up to its roof and up onto the rocks (SM_DRIFTS), the oasis basin; beyond the circle, ever taller
     dunes out to the horizon. Slopes: at most 0.6 m per meter almost everywhere (bots can walk them), steeper in places at the edge
     of the platforms, like a lee flank. The engine samples it (02-relief.js);
   - The weather: a sandstorm that blows all match long, with short lulls (ATMO_SIROCCO, SM_LULL);
   - The Oasis, in the center (B): a big pool you wade through, a flat island planted with palm trees in the middle (point B; two of them
     uprooted by the storm lie across its edge), the palm grove around, the ruined walls of two adobe houses on each side, wells;
   - The Camps, halfway (A and C): makeshift camps for close combat (sheet-metal shacks, open container, tent, watchtower, sandbags);
   - The Sea of Dunes, to the west: the sebkha, a flat dried-up lake where an airliner ran aground (broken fuselage, cabin you can enter,
     roof high up because of the dune covering it), cargo containers from its hold uncovered by the storm, lined with the tallest dunes and
     two garas (sandstone tables with a walkable top), for snipers;
   - The Rocks, to the east: a sandstone rock with a walkable top (reached by a sand ramp), the Bedouin Camp of each side and its
     rock, walkable too;
   - The west crest, between the lookout post and the base: a truck bogged down in the storm and boulders (point C on the Bravo side);
   - The bases: a stopped convoy (trucks, tents, sandbags);
   - Outside the circle, the screen darkens and you have 10 s to come back (RING, 02-relief.js); bots don't go there.
   ========================================================================== */
const SM_R = 70; // radius of the play area
const SM_OASIS = { wl: 0.95, bed: 0.6, isl: 1.25, rim: 2.2, rx: 15, rz: 12, plaza: 6.2 }; // water, bottom (you wade through it), top of the island,
// edge of the basin; pool half-axes; radius of the flat island of point B
const SM_PALM = { lite: true }; // the map's palm trees (PF.palm): lightened version
const SM_FALL = 0.455; // the island's uprooted palms (smFallenPalm) lie toward +x, 26° toward the north (Alpha half; Bravo mirrored)
const SMP = { life: null, devilTex: null, veilTex: null, plane: null };

/* ---------- The terrain ---------- */
/* The erg: roughly east-west dune ridges (you cross them to advance, you hide in the hollows), winding, cut across by north-south
   dunes, broken by passes, of varying height. Period lam along z: crests fall at |z| = 14 and 42 m (between the oasis, the camp
   and the base), hollows at 28 and 56 m (the camp, the base); xlam along x. In the middle lane, lower dunes (lane). */
const SM_ERG = { lam: 28, xlam: 36, amp: 4.4, warp: 3, cross: 0.8, gap: -0.5, fade: 7, lane: 0.5 };
/* Flattened platforms (Alpha half or on the axis, read in |z|): [x, z, radius in x, radius in z, falloff (m), height] */
const SM_PADS = [
  [0, 57, 17, 6, 5, 2.6], // base
  [0, 29.5, 12.5, 8.5, 5, 2.3], // camp (A)
  [36.5, 43, 9, 7.5, 5, 2.9], // the Bedouin camp
  [-29.5, 27.5, 6, 5, 4, 2.3], // the western lookout post
  [25.5, 24.5, 6, 4.5, 4, 2.4], // the eastern scrapyard
];
/* Around the rocks: the erg fades out (sand doesn't bury them) without flattening the ground: [x, z (read in |z|), radius in x, radius in z] */
const SM_CALM = [
  [55, 0, 10, 13], // the big eastern rock
  [44, 27, 6.5, 6.5], // the camp's rock
  [-57.5, 24, 6.5, 6.5], // the gara
];
/* The sebkha, to the west: a dried-up, flat lake where the plane ran aground (the snipers' ground): [x, radius in x, radius in z, falloff, height] */
const SM_PAN = [-44, 9, 26, 10, 2.0];
/* Big hand-placed dunes (Alpha half, the Bravo half mirrored): [cx, cz, half-length of the crest, windward flank (-u side),
   leeward flank (+u side), height, crest angle (rad, from +x), crescent (the horns advance downwind)] */
const SM_DUNES = [
  [-50, 46, 11, 10, 10, 4.5, 0.3, 0.2], // the big crest at the end of the sebkha
  [0, 44.5, 16, 6.5, 6, 2.6, 0, 0], // between the camp and the base: the base can't see point A
];
/* Ramp-shaped sand drifts (read in |z|): [x, z of the top (against the object), z of the foot, half-width of the top, height of the top, flank slope] */
const SM_DRIFTS = [
  [-53.5, 0.5, 9, 1.2, 5.0, 2.0], // the dune that climbs the rear flank of the plane, up to its roof (sand gets into the closed fuselage)
  [53.5, 9.0, 24, 2.2, 8.95, 0.8], // up onto the top of the eastern rock (the top against the edge of the rock, z = 9: at 9.4, the sand dropped back to 8.42 m at the
  // foot of the edge and you had to jump 58 cm to get up, the bots stayed down below)
  [44.0, 23.4, 15.5, 1.4, 6.5, 0.8], // up onto the top of the camp's rock
  [-57.0, 19.4, 11, 1.6, 6.0, 0.8], // up onto the top of the gara, at the edge of the sebkha
];
const SMH = { base: 2.4, N: null };
function smDune(d, x, z) {
  const c = Math.cos(d[6]), s = Math.sin(d[6]), dx = x - d[0], dz = z - d[1], t = dx * c + dz * s;
  if (Math.abs(t) >= d[2]) return 0;
  const e = 1 - (t / d[2]) ** 2, u = -dx * s + dz * c - d[7] * (t / d[2]) ** 2 * d[3], q = u / (u < 0 ? d[3] : d[4]);
  if (Math.abs(q) >= 1) return 0;
  const k = 1 - q * q;
  return d[5] * e * e * k * k;
}
/* Noise of size f (m), periodic every 64 f meters, and its z-symmetric version (from -1 to 1, zero mean) */
const smNz = (x, z, f, oct) => SMH.N.fbm(x / (f * 64) + 0.37, z / (f * 64) + 0.11, 64, 64, oct);
const smSym = (x, z, f, oct) => smNz(x, z, f, oct) + smNz(x, -z, f, oct) - 1;
/* Height of the erg (0 at the hollow); |z| smoothed on the axis (sqrt(z² + 25)): symmetric without a crease */
function smErg(x, z) {
  const E = SM_ERG, sa = Math.sqrt(z * z + 25), w = (smSym(x, z, 22, 2) + smSym(x, z, 70, 2)) * E.warp;
  const p = 0.5 - 0.5 * Math.cos(((sa + w) / E.lam) * TAU);
  const q = 0.5 - 0.5 * Math.cos(((x + smSym(x + 77, z, 26, 2) * E.warp) / E.xlam) * TAU);
  const lane = lerp(E.lane, 1, smoothstep(9, 22, Math.abs(x)));
  const a = E.amp * lane * (0.6 + 0.7 * (smSym(x + 200, z, 30, 2) * 0.5 + 0.5)), gap = smoothstep(E.gap, E.gap + 0.4, smSym(x + 500, z, 14, 2));
  return a * gap * lerp(p, Math.max(p, q * 0.85), E.cross);
}
/* Weight of a platform at (x, |z|): 1 on top, then falling off over f m */
function smPadW(p, x, az, f) { const q = hyp((x - p[0]) / p[2], (az - p[1]) / p[3]); return q <= 1 ? 1 : 1 - smoothstep(0, f, (q - 1) * Math.min(p[2], p[3])); }
/* The oasis basin: 1 at the shore, less inside */
const smPondQ = (x, z) => hyp(x / SM_OASIS.rx, z / SM_OASIS.rz);
function smH(x, z) {
  if (!SMH.N) SMH.N = makeNoise(4242);
  const az = Math.abs(z), r = hyp(x, z), O = SM_OASIS, P = SM_PAN, F = SM_ERG.fade;
  // where the erg fades out: sebkha, oasis basin, platforms (the dunes slope gently down into them)
  const qPan = hyp((x - P[0]) / P[1], z / P[2]), wPan = qPan <= 1 ? 1 : 1 - smoothstep(0, P[3], (qPan - 1) * Math.min(P[1], P[2]));
  const qo = smPondQ(x, z), qp = r / O.plaza;
  let m = (1 - wPan) * smoothstep(1.3, 2.3, qo);
  for (const p of SM_PADS) m *= 1 - smPadW(p, x, az, F);
  for (const p of SM_CALM) m *= 1 - smPadW(p, x, az, F);
  let h = SMH.base - 0.4 + smSym(x, z, 30, 3) * 0.5 + smSym(x, z, 9, 2) * 0.15 + smErg(x, z) * m;
  for (const d of SM_DUNES) h = Math.max(h, SMH.base - 0.4 + smDune(d, x, z) + smDune(d, x, -z));
  if (wPan > 0) h = lerp(h, P[4] + smSym(x, z, 12, 2) * 0.05, wPan);
  for (const p of SM_PADS) { const w = smPadW(p, x, az, 4); if (w > 0) h = lerp(h, p[5], w); }
  for (const d of SM_DRIFTS) {
    const L = d[2] - d[1], t = (az - d[1]) / L;
    if (t > 1.2) continue;
    let hd = t >= 0 ? lerp(d[4], SMH.base - 0.4, t) : d[4] - Math.abs(az - d[1]) * 1.2; // behind the top: under the object
    hd -= Math.max(0, Math.abs(x - d[0]) - d[3]) * d[5];
    if (hd > h) h = hd;
  }
  // the oasis: a big pool you wade through, a flat island in the middle (point B), gentle banks up to the edge of the basin
  if (qo < 2) {
    const q = qo * (1 + smSym(x * 2, z * 2, 6, 2) * 0.06); // slightly irregular shoreline
    let o = q < 0.8 ? O.bed : q < 1 ? lerp(O.bed, O.wl + 0.06, smoothstep(0.8, 1, q)) : lerp(O.wl + 0.06, O.rim, smoothstep(1, 1.5, q));
    o = lerp(o, O.isl, smoothstep(1.3, 1.0, qp * (1 + smSym(x * 3, z * 3, 5, 2) * 0.04)));
    h = lerp(o, h, smoothstep(1.4, 2, q));
  }
  // beyond the circle: big dunes out to the horizon
  if (r > 76) {
    const k = smoothstep(76, 140, r) * lerp(1, 2.4, smoothstep(140, 420, r)), ridge = 1 - Math.abs(smSym(x, z, 60, 3));
    h += k * (ridge * ridge * 8 + (smSym(x + 900, z, 170, 3) + 1) * 3.5);
  }
  return h;
}

/* ---------- The oasis ---------- */
/* Varied palm tree (PF.palm, o.v): height, trunk thickness (g) and crown size (c) are chosen for a pair of mirrored palm trees
   (the cover stays the same on both sides); the rest is rolled for each one (number of fronds, skirt of dry fronds, curvature,
   dates, shoots at the base, extra trunks, upright or open crown, tint). RP: the palm trees' randomness, separate from the oasis's (nothing
   else moves) */
function smPalmV(RP, g, c, kids = true) {
  const r2 = (v) => Math.round(v * 100) / 100, k = RP();
  return { g: r2(g), c: r2(c), n: 26 + Math.floor(RP() * 12), dry: 4 + Math.floor(RP() * 12), lean: r2(RP.range(0.05, 1.5)), dates: Math.floor(RP() * 5), kids: kids && k < 0.35 ? 1 + Math.floor(RP() * 2) : 0, trunks: kids && k > 0.88 ? 1 + Math.floor(RP() * 2) : 0, open: r2(RP.range(0.1, 0.9)), tint: RP.pick([[1.08, 0.95, 0.86], [1.14, 0.96, 0.78], [1.02, 0.92, 0.86], [1.2, 0.98, 0.74]]) }; // dusty green, olive to yellowed (a pure green screamed against the sand)
}
function smOasis(R) {
  const M = DECOR, O = SM_OASIS, RP = rngOf(5155);
  // the pool: ellipse slightly bigger than the shoreline (sand covers the edge); you wade on the bottom
  const poly = []; for (let i = 0; i < 56; i++) { const a = (i / 56) * TAU; poly.push([Math.round(Math.cos(a) * O.rx * 1.1 * 100) / 100, Math.round(Math.sin(a) * O.rz * 1.1 * 100) / 100]); }
  pondAdd({ shape: 'poly', poly, y: O.wl, wade: O.bed, slope: 0.35, vis: 0.45, calm: 0.5, probeAt: [0, O.isl + 1.2, 0.5], depth: 0.7, deep: [0.02, 0.07, 0.07], shallow: [0.1, 0.16, 0.11], scatter: [0.03, 0.08, 0.07], tone: 0.45, cell: 0.5 });
  // the island of point B: four palm trees in the circle (trunks to take cover behind, one thick, the other thinner), reeds on the bank.
  // The storm uprooted the two big ones, on the west side (November 2026): they lie toward the north-east and the south-east, root ball
  // on the island, trunk across its edge, crown in the pool; B, which only had the four trunks, gets cover against the two camps
  for (const [x, z, h, g, c, fall] of [[-3.6, 3.9, 9.2, 1.25, 1.05, true], [4.1, 3.4, 8.4, 0.95, 0.95, false]]) for (const sz of [1, -1]) {
    const seed = Math.round(x * 7 + z * 3) + 40 + (sz > 0 ? 0 : 5), v = smPalmV(RP, g, c, false), ry = R() * TAU;
    if (fall) smFallenPalm(x, sz * z, -sz * SM_FALL, h, seed, v);
    else M.place(PF.palm(h, seed, { ...SM_PALM, v }), x, smY(x, sz * z, 0.3), sz * z, ry);
  }
  for (const a of [0.35, 1.2, 2.3, 2.9]) for (const sz of [1, -1]) {
    const r = O.plaza + R.range(0.5, 1.0), x = Math.cos(a) * r, z = sz * Math.sin(a) * r, s = R.range(0.7, 1.0), ry = R() * TAU;
    if (a !== 1.2) M.place(PF.smReeds(s), x, smY(x, z) - 0.05, z, ry, { cls: 1 }); // (the tuft at 1.2 rad: under the fallen trunk)
  }
  // reeds along the shoreline, in tufts, the same way on both sides
  for (let i = 0; i < 30; i++) {
    const a = R.range(0.12, Math.PI - 0.12), q = R.range(0.93, 1.05), s = R.range(0.8, 1.25);
    for (const sz of [1, -1]) { const x = Math.cos(a) * O.rx * q, z = sz * Math.sin(a) * O.rz * q; M.place(PF.smReeds(s), x, smY(x, z) - 0.05, z, R() * TAU, { cls: 1 }); }
  }
  // the palm grove: around the pool, outside the ruins and the north-south passage
  const palms = [];
  for (let i = 0; i < 60 && palms.length < 16; i++) {
    const a = R.range(0.05, Math.PI - 0.05), q = R.range(1.12, 1.75), x = Math.cos(a) * O.rx * q, z = Math.sin(a) * O.rz * q;
    if (Math.abs(x) < 2.5) continue;
    if (palms.some((p) => hyp(p[0] - x, p[1] - z) < 3.4) || SM_RUINS.some((u) => Math.abs(x - u[0]) < u[2] / 2 + 1.5 && Math.abs(z - u[1]) < u[3] / 2 + 1.5)) continue;
    palms.push([x, z, R.range(7, 9.6)]);
  }
  // young palm trees (4 to 6 m, stocky trunks), adults (6.5 to 10 m), a few old ones (10 to 12.5 m); thin to thick trunks
  for (const [x, z] of palms) {
    const k = RP(), h = Math.round((k < 0.2 ? RP.range(4.2, 5.6) : k < 0.82 ? RP.range(6.5, 9.8) : RP.range(10.2, 12.5)) * 10) / 10;
    const g = h < 6 ? RP.range(1.0, 1.3) : RP.range(0.75, 1.45), c = h < 6 ? RP.range(0.82, 0.95) : RP.range(0.9, 1.15);
    for (const sz of [1, -1]) M.place(PF.palm(h, Math.round(x * 5 + z) + 60 + (sz > 0 ? 0 : 7), { ...SM_PALM, v: smPalmV(RP, g, c) }), x, smY(x, sz * z, 0.3), sz * z, R() * TAU);
  }
  // the ruins: roofless adobe houses, broken walls, one or two doors
  for (const [cx, cz, w, d, gx, gz] of SM_RUINS) for (const sz of [1, -1]) {
    const z0 = sz * cz, y0 = smFlat(cx, z0, w / 2, d / 2, 0, 0.6) - 0.3, tint = R.pick(SM_MUD); // foot buried 30 cm in the flattened sand
    const zS = z0 - sz * d / 2, zN = z0 + sz * d / 2;
    smRuin('x', zS, 0.5, cx - w / 2, cx + w / 2, y0, 1.0, 2.6, [[gx - 0.7, gx + 0.7]], R, tint); // face toward the axis: the door
    smRuin('x', zN, 0.5, cx - w / 2, cx + w / 2, y0, 1.4, 2.9, [], R, tint);
    smRuin('z', cx - w / 2, 0.5, Math.min(zS, zN) + 0.25, Math.max(zS, zN) - 0.25, y0, 1.2, 2.7, gz < 0 ? [[z0 - 0.7, z0 + 0.7]] : [], R, tint);
    smRuin('z', cx + w / 2, 0.5, Math.min(zS, zN) + 0.25, Math.max(zS, zN) - 0.25, y0, 1.2, 2.7, gz > 0 ? [[z0 - 0.7, z0 + 0.7]] : [], R, tint);
  }
  // well at the water's edge, jars
  for (const sz of [1, -1]) smWell(9.5, sz * 13.5);
  for (const [x, z] of [[-6.5, 13.8], [1.8, 4.4], [-21, 9.5]]) for (const sz of [1, -1]) smJar(x, sz * z, R.range(0.9, 1.15), R); // (the island's: clear of the fallen trunk)
}
/* Raw earth of the ruins, warmer than the whitewashed adobe of the villages */
const SM_MUD = [[0.92, 0.7, 0.52], [0.86, 0.64, 0.46], [0.95, 0.76, 0.58]];
/* Ruined houses of the oasis (Alpha half): [x, z, width (x), depth (z), x of the door toward the axis, side of the side door (-1, 0, 1)] */
const SM_RUINS = [[-18.5, 13.5, 6, 5, -17.5, 1], [19.5, 13.5, 5, 4.4, 18.5, -1]];

/* ---------- The makeshift camps (A and C) ---------- */
function smCamp(sz, R) {
  const M = DECOR, Z = (z) => sz * z, Y = (x, z, r = 1.5) => smY(x, Z(z), r), acc = smAccent(sz);
  // sheet-metal shacks, door toward the yard (cell centers: the 1.2 m door is centered on a cell)
  // a back door in each one: you go through, no dead end
  smShack(-7.5, smFlat(-7.5, Z(34.5), 2.0, 1.7, Math.PI / 2, 1.2), Z(34.5), Math.PI / 2, 4.0, 3.4, 2.6, R, { win: 1, back: true });
  smShack(8.5, smFlat(8.5, Z(35.5), 2.2, 1.7, -Math.PI / 2, 1.2), Z(35.5), -Math.PI / 2, 4.4, 3.4, 2.7, R, { win: -1, back: true });
  smShack(-10.5, smFlat(-10.5, Z(25.5), 1.8, 1.6, 0, 1.2), Z(25.5), sz > 0 ? 0 : Math.PI, 3.6, 3.2, 2.5, R, { win: 1, back: true });
  // container open at both ends: a covered passage along x
  smPlace(PF.container(true), -4.5, Z(24.5), Math.PI / 2, { tint: { paint: sz > 0 ? [0.42, 0.5, 0.36] : [0.36, 0.44, 0.58] } });
  // canvas tent, watchtower and its staircase (toward the base), tank, generator; the tent 1.5 m from the staircase (you can't pass from
  // one to the other)
  smPlace(PF.tent(), 7.5, Z(24.5), 0);
  smTower(12.5, Z(30.5), R, -sz); // staircase toward the yard
  smPlace(PF.waterTank(), -12.5, Z(31.5), 0);
  smPlace(PF.generator(), -2.5, Z(38.5), sz > 0 ? 0 : Math.PI, { tint: { paint: [0.42, 0.46, 0.36] } });
  // tarp on the north of the yard, abandoned pickup, sandbags
  smTarp(0.5, smFlat(0.5, Z(35.2), 2.7, 1.6, 0, 0.3), Z(35.2), 0, 5.4, 3.2, 2.6, 2.1, acc);
  // pickup in the yard, between point A and the watchtower (at the foot of the dune, the flattened sand under it dug a breach there: the base could see
  // point A; in 4.6.0, it clipped into the tent)
  smPlace(PF.car('offroad', { dust: 1 }), 7.5, Z(30.2), sz * 1.4, { tint: [0.72, 0.66, 0.56] });
  smSandbags(-0.5, Z(23.0), 3.6, 'x', 3, R); smSandbags(3.5, Z(31.2), 2.4, 'z', 3, R); smSandbags(-16.0, Z(29.5), 3.0, 'z', 3, R);
  smSandbags(-4.0, Z(30.5), 2.4, 'z', 3, R); smSandbags(1.5, Z(27.0), 2.4, 'x', 2, R);
  // drums, jerrycans, crates, tires
  for (const [x, z] of [[-9.6, 30.2], [-9.0, 29.4], [3.3, 28.4], [-3.6, 33.6]]) M.dyn('barrel', x, Y(x, z, 0), Z(z), R() * TAU, { tint: R.pick([[0.36, 0.42, 0.3], [0.62, 0.2, 0.14], [0.3, 0.36, 0.48]]) });
  // (the north crate clear of the house corner, at (-5, 39.6): at (-5.2, 37.2), it blocked the passage at the corner, crossing.js)
  for (const [x, z] of [[3.2, 26.4], [-5.0, 39.6], [15.6, 33.8]]) M.dyn('crate', x, Y(x, z, 0), Z(z), R.range(-0.4, 0.4), { a: [0.9] });
  for (const [x, z] of [[-0.9, 38.9], [6.4, 38.6], [-8.4, 28.2]]) M.dyn('jerrycan', x, Y(x, z, 0), Z(z), R() * TAU);
  for (const [x, z] of [[15.8, 25.4], [-14.2, 34.6]]) M.dyn('tire', x, Y(x, z, 0) + 0.02, Z(z), R() * TAU);
  smRugLine(4.6, Z(33.9), 5.8, Z(37.6), Y(5.2, 35.7, 0) + 1.9, R); // between the tarp and the eastern shack
}

/* Watchtower (smWatchtower) on the flattened sand under its platform and its staircase, which starts from side dir */
function smTower(x, z, R, dir) { smWatchtower(x, smFlat(x + 0.3, z + dir * 3.1, 2.2, 4.8, 0, 0.3), z, R, dir); }

/* ---------- Small flank camps: the western lookout post, the eastern scrapyard (cover in the middle of the dunes) ---------- */
function smOutposts(sz, R) {
  const M = DECOR, Z = (z) => sz * z, Y = (x, z, r = 1.5) => smY(x, Z(z), r), rot = (a) => (sz > 0 ? a : Math.PI - a);
  // the lookout post: a watchtower (staircase toward the oasis), a walk-through shack, sandbags, a tarp, drums
  smTower(-27.5, Z(29.5), R, -sz);
  smShack(-32.5, smFlat(-32.5, Z(28.5), 1.7, 1.5, -Math.PI / 2, 1.2), Z(28.5), -Math.PI / 2, 3.4, 3.0, 2.5, R, { win: 1, back: true });
  smSandbags(-22.5, Z(25.5), 3.0, 'z', 3, R); smSandbags(-23.0, Z(30.0), 2.4, 'z', 3, R); smSandbags(-30.0, Z(32.6), 3.0, 'x', 2, R);
  smTarp(-31.0, smFlat(-31.0, Z(23.5), 1.8, 1.3, rot(0.2), 0.3), Z(23.5), rot(0.2), 3.6, 2.6, 2.4, 2.0, smAccent(sz));
  for (const [x, z] of [[-34.8, 24.2], [-35.3, 24.9], [-24.5, 22.5]]) M.dyn('barrel', x, Y(x, z, 0), Z(z), R() * TAU, { tint: R.pick([[0.36, 0.42, 0.3], [0.62, 0.2, 0.14]]) });
  M.dyn('crate', -30.4, Y(-30.4, 23.6, 0), Z(23.6), R.range(-0.4, 0.4), { a: [0.9] });
  // the scrapyard: wrecks of cars and a truck, tires, sheet metal, crates
  smPlace(PF.truck('army', { wreck: 1 }), 28.0, Z(27.0), rot(0.35));
  // the wrecks more than a meter from each other and from the acacia (smDress): you can pass between them
  smPlace(PF.car('sedan', { wreck: 1 }), 21.5, Z(23.3), rot(-1.1));
  smPlace(PF.car('offroad', { wreck: 1 }), 30.5, Z(20.8), rot(2.6));
  for (const [x, z] of [[24.6, 26.8], [25.4, 28.2], [31.2, 24.0], [21.6, 26.4]]) M.dyn('tire', x, Y(x, z, 0) + 0.02, Z(z), R() * TAU);
  for (const [x, z] of [[22.6, 20.0], [31.2, 27.4]]) M.dyn('crate', x, Y(x, z, 0), Z(z), R.range(-0.4, 0.4), { a: [0.9] });
  M.dyn('barrel', 26.2, Y(26.2, 20.4, 0), Z(20.4), R() * TAU, { tint: [0.62, 0.2, 0.14] });
}

/* ---------- The bogged-down truck (west crest, between the lookout post and the base; November 2026) ----------
   The dune crest that carries point C (on the Bravo side; the same crest on the Alpha side) was bare: no cover within 9 m of C, and nothing
   on the way from the end of the sebkha. Three sandstone boulders now stick out of the crest around the point (out of the 5.5 m capture disc:
   you hold C from them), and a convoy truck caught by the storm lies bogged down on the saddle to the west, wheels sunk in the sand, crates
   fallen off it: cover for the approach from the sebkha, 11 to 18 m from C (out of the ring of its entrances, at 8 to 10 m: C stays open on
   all sides). Far from the mecha drop zone at (-20, 37.5) and from the base */
function smBogged(sz, R) {
  const M = DECOR, Z = (z) => sz * z, Y = (x, z, r = 1.5) => smY(x, Z(z), r);
  smPlace(PF.truck('army', { load: 'tarp' }), -40.5, Z(42.0), Math.PI / 2, { tint: [0.6, 0.55, 0.44], sink: 0.2 }); // along the saddle (level ground), cab to the west
  for (const [x, z] of [[-39.0, 44.1], [-41.6, 44.3]]) M.dyn('crate', x, Y(x, z, 0), Z(z), R.range(-0.6, 0.6), { a: [0.9] });
  M.dyn('jerrycan', -38.2, Y(-38.2, 40.0, 0), Z(40.0), R() * TAU);
  for (const [x, z, s, k] of [[-32.0, 41.5, 1.7, 8], [-30.5, 37.4, 1.4, 9], [-29.8, 46.8, 1.3, 10]]) DECOR.place(PF.smRock(s, k + (sz > 0 ? 0 : 20)), x, smY(x, Z(z), s * 0.5) - 0.15, Z(z), R() * TAU);
}

/* ---------- The Bedouin camp (to the east, on each side) ---------- */
function smNomads(sz, R) {
  const M = DECOR, Z = (z) => sz * z, Y = (x, z, r = 1.5) => smY(x, Z(z), r), rot = (a) => (sz > 0 ? a : Math.PI - a);
  // the two tents open onto the hearth, their guy ropes clear of the hearth, the cart and the tarp
  smPlace(PF.smBedouin(7.5, 4.6, 1), 32.0, Z(47.1), rot(2.5));
  smPlace(PF.smBedouin(6, 4.2, 2), 40.5, Z(38.5), rot(-0.79));
  smPlace(PF.smFire(), 36.5, Z(43.5), 0);
  // dry-stone enclosure (0.9 m low wall) to the north, open toward the hearth
  for (const [axis, f, a0, a1] of [['x', 49.5, 38, 44], ['z', 44.0, 46, 49.5]]) {
    const ff = axis === 'x' ? Z(f) : f, aa = axis === 'x' ? [a0, a1] : [Z(a0), Z(a1)].sort((p, q) => p - q);
    const yw = axis === 'x' ? smFlat((a0 + a1) / 2, Z(f), (a1 - a0) / 2, 0.25, 0, 0.3) : smFlat(f, Z((a0 + a1) / 2), 0.25, (a1 - a0) / 2, 0, 0.3);
    wallOpen('stone', axis, ff, 0.5, aa[0], aa[1], yw - 0.2, 1.1, [], { tint: [0.86, 0.72, 0.6], frames: false });
  }
  smPlace(PF.smCart(), 29.6, Z(40.4), rot(-2.36));
  M.place(PF.smAcacia(5.2, 3), 42.6, smY(42.6, Z(46.6), 0.4), Z(46.6), R() * TAU); // in the enclosure, clear of the low wall
  for (const [x, z] of [[34.8, 40.2], [35.4, 39.6], [38.8, 46.2]]) smJar(x, Z(z), R.range(0.9, 1.15), R);
  for (const [x, z] of [[33.6, 41.0], [39.5, 45.0]]) M.dyn('spiceSack', x, Y(x, z, 0), Z(z), R() * TAU, { tint: R.pick([[0.75, 0.62, 0.42], [0.62, 0.5, 0.36]]) });
  smTarp(33.0, smFlat(33.0, Z(38.0), 2.0, 1.3, sz > 0 ? 0.25 : -0.25, 0.3), Z(38.0), sz > 0 ? 0.25 : -0.25, 4.0, 2.6, 2.3, 1.9, [0.72, 0.58, 0.42]);
  smRugLine(38.4, Z(48.6), 41.6, Z(48.6), Y(40.0, 48.6, 0) + 1.8, R); // along the enclosure's low wall (it went through the big tent)
}

/* ---------- The eastern rocks ---------- */
function smRocks(R) {
  // the big rock, on the axis: walkable top at 8.2 m, a sand ramp climbs it on each side
  smMassif({ rects: [[48, 61, -9, 9], [47, 48, -7, 7], [61, 62.5, -6, 6], [49, 51, 9, 10], [56.5, 59.5, 9, 10.5], [49, 51, -10, -9], [56.5, 59.5, -10.5, -9], [62.5, 63.5, -3, 3]], top: 9.0, walk: true, y0: 1.0, seed: 301, bulge: 1.12 });
  for (const [x, z, s, k] of [[59.5, 4.5, 1.4, 31], [59.5, -4.5, 1.4, 31], [50.5, 0, 1.1, 33]]) DECOR.place(PF.smRock(s, k), x, 8.95, z, 0);
  for (const sz of [1, -1]) {
    const Z = (z) => sz * z;
    // the camp's rock: not walkable, a tall cover
    const zz = (a, b) => [Math.min(Z(a), Z(b)), Math.max(Z(a), Z(b))];
    smMassif({ rects: [[41.5, 46.5, ...zz(24.5, 29.5)], [42, 46, ...zz(29.5, 30.5)], [40.5, 41.5, ...zz(25.5, 28.5)], [46.5, 47.5, ...zz(25, 28)], [43, 45.5, ...zz(23.5, 24.5)]], top: 6.5, walk: true, y0: 1.0, seed: 311 + (sz > 0 ? 0 : 1), bulge: 0.98 });
    // the gara: a sandstone table on the west edge of the sebkha, firing position for both sides
    smMassif({ rects: [[-61, -53.5, ...zz(20, 26.5)], [-60, -54.5, ...zz(26.5, 28)], [-62, -61, ...zz(21.5, 25.5)], [-58.5, -55.5, ...zz(19.5, 20)]], top: 6.0, walk: true, y0: 1.0, seed: 321 + (sz > 0 ? 0 : 1), bulge: 0.98 });
    // (the rock at (38.5, ±21.5) in 2 m: in 1.6 m, on the slope, its top was only 43 cm above the sand on the uphill side, which you climbed in one step,
    // and 76 cm on the downhill side, where you got stuck: snags.js)
    for (const [x, z, s, k] of [[38.5, 21.5, 2.0, 1], [49.5, 19.5, 2.2, 2], [56.5, 25.5, 1.8, 3], [33.5, 9.5, 1.4, 4], [-33.5, 35.5, 1.5, 5], [-55.5, 41.5, 2.0, 6], [22.5, 60.5, 1.7, 7]]) DECOR.place(PF.smRock(s, k + (sz > 0 ? 0 : 20)), x, smY(x, Z(z), s * 0.5) - 0.15, Z(z), R() * TAU);
  }
}

/* ---------- The bases: a stopped convoy ---------- */
function smBase(sz, R) {
  const M = DECOR, Z = (z) => sz * z, Y = (x, z, r = 1.5) => smY(x, Z(z), r), rot = (a) => (sz > 0 ? a : Math.PI - a);
  smPlace(PF.truck('army'), -9.5, Z(64.0), rot(0.25), { tint: [0.62, 0.56, 0.44] }); // more than a meter from the guy ropes of the western tent
  smPlace(PF.truck('cargo', { load: 'tarp' }), 11.0, Z(63.5), rot(-0.25), { tint: [0.62, 0.56, 0.44] });
  smPlace(PF.car('offroad', { dust: 1, rack: 1 }), 16.5, Z(53.5), rot(-0.9), { tint: [0.66, 0.6, 0.48] });
  smPlace(PF.tent(), -16.5, Z(57.5), Math.PI / 2);
  smPlace(PF.tent(), 0.5, Z(65.5), 0);
  smPlace(PF.antenna(), -4.5, Z(64.5), 0);
  smPlace(PF.generator(), 5.5, Z(65.5), rot(0.2), { tint: { paint: [0.42, 0.46, 0.36] } });
  smSandbags(-6.5, Z(51.0), 3.6, 'x', 3, R); smSandbags(7.0, Z(50.5), 3.6, 'x', 3, R); smSandbags(-15.5, Z(52.0), 3.0, 'z', 3, R); smSandbags(17.5, Z(59.5), 3.0, 'z', 3, R);
  for (const [x, z] of [[-13.4, 61.7], [-12.8, 62.4], [-13.7, 62.6], [15.8, 61.0], [16.4, 60.3]]) M.dyn('barrel', x, Y(x, z, 0), Z(z), R() * TAU, { tint: R.pick([[0.36, 0.42, 0.3], [0.32, 0.38, 0.28]]) });
  for (const [x, z] of [[-4.6, 60.4], [7.0, 61.8], [-18.6, 53.0]]) M.dyn('crate', x, Y(x, z, 0), Z(z), R.range(-0.4, 0.4), { a: [1.0] });
  // the tarp along the western truck, yard side (it was stretched across the truck)
  smTarp(-6.0, smFlat(-6.0, Z(61.0), 2.2, 1.6, rot(0.25), 0.3), Z(61.0), rot(0.25), 4.4, 3.2, 2.7, 2.2, smAccent(sz));
  // the camp's flag, in the wind
  const yf = Y(-1.5, 51.5, 0);
  M.save().color([0.4, 0.38, 0.34]); M.save().move(-1.5, yf, Z(51.5)); M.cyl('steel', 0.04, 5.2, 6); M.restore();
  M.color(smAccent(sz)); clothPiece(M, [-1.46, yf + 4.25, Z(51.5)], [-0.06, yf + 4.25, Z(51.5)], [-0.06, yf + 5.1, Z(51.5)], [-1.46, yf + 5.1, Z(51.5)], [0, 0, 1], { hoist: true, clothKind: 'flagCloth', grp: 'flagCloth' + sz }); M.restore(); // held by the pole
}

/* ---------- Dressing: dry grasses, acacias, background ---------- */
function smDress(R) {
  const M = DECOR;
  // tufts of dry grass and isolated acacias, outside the platforms and the water
  for (let i = 0; i < 260; i++) {
    const a = R() * TAU, r = Math.sqrt(R()) * (SM_R + 8), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (smPondQ(x, z) < 1.15 || hyp((x - SM_PAN[0]) / SM_PAN[1], z / SM_PAN[2]) < 1 || SM_PADS.some((p) => hyp((x - p[0]) / (p[2] + 1), (Math.abs(z) - p[1]) / (p[3] + 1)) < 1)) continue;
    M.place(PF.cyGrass(R.range(0.5, 1.0)), x, smY(x, z) - 0.03, z, R() * TAU, { cls: 2, nocol: true });
  }
  for (const [x, z, h] of [[-20, 22, 4.4], [24, 21, 4.0], [-46, 50, 4.8], [55, 14, 3.8], [-61, 11, 4.2]]) for (const sz of [1, -1]) M.place(PF.smAcacia(h, Math.round(x + z) + (sz > 0 ? 0 : 9)), x, smY(x, sz * z, 0.3), sz * z, R() * TAU);
  // far away, between two dunes: another oasis
  for (let i = 0; i < 26; i++) { const x = -250 + R.range(-30, 30), z = 205 + R.range(-18, 18); M.place(PF.smPalmFar(R.range(5, 12.5), 1 + (i % 12)), x, smH(x, z) - 0.3, z, R() * TAU, { nocol: true }); }
  // patches of dry vegetation (separate randomness: the rest doesn't move): grasses and gray rosemary bushes in tight tufts, in the hollows
  // and at the foot of the rocks, outside the platforms, the water and the sebkha; low (under 0.9 m) and without collision: the layout doesn't change
  const RV = rngOf(5160), off = (x, z) => smPondQ(x, z) < 1.2 || hyp((x - SM_PAN[0]) / SM_PAN[1], z / SM_PAN[2]) < 1.05 || SM_PADS.some((p) => hyp((x - p[0]) / (p[2] + 1.5), (Math.abs(z) - p[1]) / (p[3] + 1.5)) < 1);
  for (let c = 0; c < 90; c++) {
    const a = RV() * TAU, r = Math.sqrt(RV()) * (SM_R + 6), cx = Math.cos(a) * r, cz = Math.sin(a) * r;
    if (off(cx, cz)) continue;
    for (let k = 0, n = 3 + Math.floor(RV() * 6); k < n; k++) {
      const b = RV() * TAU, d = Math.sqrt(RV()) * 2.6, x = cx + Math.cos(b) * d, z = cz + Math.sin(b) * d; if (off(x, z)) continue;
      if (RV() < 0.28) M.place(PF.cyBush(Math.round(RV.range(0.55, 0.85) * 20) / 20, 1), x, smY(x, z) - 0.04, z, RV() * TAU, { cls: 2, nocol: true, tint: RV.pick([[0.9, 0.96, 0.6], [0.84, 0.86, 0.56], [0.96, 0.94, 0.62]]) }); // grayed olive green (the rosemary flowers were turning lilac)
      else M.place(PF.cyGrass(Math.round(RV.range(0.45, 1.0) * 20) / 20), x, smY(x, z) - 0.03, z, RV() * TAU, { cls: 2, nocol: true, tint: RV.pick([[1, 0.94, 0.8], [0.94, 0.86, 0.7], [1.04, 0.98, 0.84]]) });
    }
  }
}

/* ---------- Plan ---------- */
function siroccoLevel() {
  const R = rngOf(5150);
  smGround();
  smOasis(rngOf(5151));
  SMP.plane = smPlane(-44, 2.0, rngOf(5152), 0.5); // fuselage axis at z = 0.5: the cabin aisle on a row of cell centers
  // cargo containers thrown out of the hold, uncovered by the storm on the sebkha (November 2026): the snipers' bare ground (seen from the
  // garas) gets two pieces of cover per half, on the way from the lookout post to the plane, out of the wings and 7 m from the engines
  for (const sz of [1, -1]) for (const [x, z, a, k] of [[-44.0, 20.5, 0.5, 1], [-37.5, 15.0, -0.4, 2]]) smPlace(PF.smULD(k + (sz > 0 ? 0 : 2)), x, sz * z, sz > 0 ? a : Math.PI - a);
  smRocks(rngOf(5153));
  for (const sz of [1, -1]) { smCamp(sz, rngOf(sz > 0 ? 5161 : 5162)); smNomads(sz, rngOf(sz > 0 ? 5171 : 5172)); smBase(sz, rngOf(sz > 0 ? 5181 : 5182)); smOutposts(sz, rngOf(sz > 0 ? 5191 : 5192)); smBogged(sz, rngOf(sz > 0 ? 5193 : 5194)); }
  smDress(R);
  // life: two dust devils (the Sea of Dunes, the Rocks), four vultures (in the lulls), the flying sand of the storm
  SMP.devilTex = smDevilTex(); SMP.veilTex = smVeilTex();
  SMP.life = [
    smDustDevil({ cx: -44, cz: 0, rx: 6, rz: 22, T: 70, ph: 0 }, SMP.devilTex), smDustDevil({ cx: 44, cz: 0, rx: 8, rz: 26, T: 85, ph: 0.45 }, SMP.devilTex),
    smVulture({ cx: -20, cz: 10, r: 38, y: 46, w: 0.09, a0: 0 }), smVulture({ cx: -24, cz: 6, r: 30, y: 52, w: 0.08, a0: 2.1 }),
    smVulture({ cx: 30, cz: -20, r: 34, y: 44, w: -0.1, a0: 1 }), smVulture({ cx: 10, cz: 30, r: 50, y: 58, w: 0.07, a0: 4 }),
    smSandStream(RQ.q.lean ? 800 : 2000),
  ];
  { const v = smSandVeils(rngOf(5199), SMP.veilTex); if (v) SMP.life.push(v); } // veils of sand on the rises
  // sand last: the mesh reads the grid, flattened under placed objects (reliefFlat)
  // sand tint per vertex: crests bleached by the sun, hollows redder, big patches more or less golden
  reliefMesh(SM_R + 12, 760, { tint: [1, 0.97, 0.94], tintAt: (x, z, h) => {
    const n = smNz(x, z, 22, 3), k = 0.9 + n * 0.2, up = smoothstep(2.6, 8, h) * 0.08, low = smoothstep(2.0, 0.8, h);
    return [sl(clamp(k + up, 0, 1.2)), sl(clamp((k + up) * (1 - low * 0.06) * (0.98 + n * 0.04), 0, 1.2)), sl(clamp((k + up) * (1 - low * 0.12) * (0.95 + n * 0.08), 0, 1.2))];
  } });
}

/* ---------- The ground: layer distribution ---------- */
/* Red: pebbles (foot of the rocks, hollows between dunes); green: cracked mud (oasis banks); blue: reg, gravel and packed sand (camps,
   bases, tracks); alpha: dust */
const GROUND_SIROCCO = { base: 'dune', l1: 'shingle', l2: 'vase', l3: 'reg', pom: [0, 0.03, 0, 0], dirt: [0.86, 0.72, 0.58], mul: 0.6, env: 0.3 };
function smGround() {
  const S = SPLAT, W = Math.round(S.w * S.ppm), H = Math.round(S.d * S.ppm), out = new Uint8Array(W * H * 4), N = makeNoise(5501);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = S.x0 + (i + 0.5) / S.ppm, z = S.z0 + (j + 0.5) / S.ppm, o = (j * W + i) * 4, az = Math.abs(z);
    const n1 = smN(N, x, z, 4, 3), n2 = smN(N, x, z, 1.2, 2, 0.3), n3 = smN(N, x, z, 9, 3, 0.7);
    let r = 0, g = 0, b = 0;
    // pebbles: at the foot of the eastern rocks and in the hollows (below the mean height)
    const foot = (cx, cz, rx, rz) => 1 - smoothstep(0.9, 1.35, hyp((x - cx) / rx, (az - cz) / rz) + (n1 - 0.5) * 0.4);
    r = Math.max(foot(54, 0, 9.5, 11.5), foot(44, 27.5, 4.5, 4.5)) * (1 - smoothstep(4.5, 6.5, smH(x, z))) * smoothstep(0.35, 0.6, n1) * 0.85;
    r = Math.max(r, smoothstep(0.66, 0.8, n3 + (n1 - 0.5) * 0.4) * 0.3 * smoothstep(40, 70, hyp(x, z)));
    // mud: the banks and bottom of the pool, the sebkha (cracked clay)
    g = (1 - smoothstep(1.0, 1.4, smPondQ(x, z) + (n2 - 0.5) * 0.3)) * 0.95;
    g = Math.max(g, (1 - smoothstep(0.8, 1.15, hyp((x - SM_PAN[0]) / SM_PAN[1], z / SM_PAN[2]) + (n1 - 0.5) * 0.3)) * smoothstep(SM_PAN[4] + 0.6, SM_PAN[4] + 0.25, smH(x, z)) * 0.9); // not on the sand ramps
    // packed earth: camps, bases, encampment, tracks between them
    for (const p of SM_PADS) { const d = hyp((x - p[0]) / (p[2] + 2), (az - p[1]) / (p[3] + 2)); b = Math.max(b, (1 - smoothstep(0.55, 1.05, d + (n1 - 0.5) * 0.35)) * 0.8); }
    g *= smoothstep(0.85, 1.05, hyp(x, z) / SM_OASIS.plaza + (n2 - 0.5) * 0.2); // the island: sand
    let path = 0;
    for (const [ax, az0, bx, bz0] of [[0, 51, 0, 38], [0, 21, 0, 7], [12, 54, 31, 45]]) { const dx = bx - ax, dz = bz0 - az0, L2 = dx * dx + dz * dz, t = clamp(((x - ax) * dx + (az - az0) * dz) / L2, 0, 1), d = hyp(x - ax - dx * t, az - az0 - dz * t); path = Math.max(path, (1 - smoothstep(0.8, 2.2, d + (n2 - 0.5) * 1.2)) * 0.6); }
    b = Math.max(b, path);
    r *= 1 - b * 0.8; g *= 1 - b * 0.5;
    r = Math.max(r, path * smoothstep(0.35, 0.65, n1) * 0.75); // patches of pebbles on the tracks (reg alone made them look smooth)
    out[o] = Math.round(clamp(r, 0, 1) * 255); out[o + 1] = Math.round(clamp(g, 0, 1) * 255); out[o + 2] = Math.round(clamp(b, 0, 1) * 255); out[o + 3] = Math.round(clamp(0.1 + n2 * 0.3 + b * 0.2, 0, 1) * 255);
  }
  const t = new THREE.DataTexture(out, W, H, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  MAT.ground = groundMat(t, [S.x0, S.z0, S.w, S.d], GROUND_SIROCCO);
}

/* ---------- Atmosphere: sandstorm ---------- */
/* Sandstorm (owner request, map variations, November 2026; before: a clear golden late afternoon, crossed every 4 minutes by an orange
   storm): the storm blows all match long. Dense ochre-orange dust that swallows the horizon and the far side of the map (a soldier still
   stands out against it at 40 to 50 m: fog 0.0135, the bots see through it the same way, botSense), the sun a pale disc behind the dust that
   casts only faint shadows, the light coming from the whole orange sky (ambient lighting derived from the computed sky: no HDRI, no sky
   photo), strong wind: palms, tarps and flags whipping (vent of the definition, CLOTH_BREEZE set by smStorm), sand streaming over the
   crests (smSandVeils) and grains flying past the eye (smSandStream) */
const ATMO_SIROCCO = Object.assign({}, ATMO_DEFAULT, {
  sun: [-0.72, 0.52, 0.2], sunColor: 0xffd9a8, sunI: 0.3, vmSun: 0xffd9a8,
  fog: [0.56, 0.25, 0.075], fogD: 0.0135, fogSun: 0.5,
  hemi: [0xdcae80, 0x8a6442, 1.25], vmHemi: [0xdcae80, 0x8a6442], aoFloor: 0.38,
  // sky of the dust: the color of the fog at the horizon (the far dunes melt into it), browner at the zenith, a broad glow around the pale
  // disc of the sun; the computed clouds become slow streaks of thicker dust
  sky: Object.assign({}, ATMO_DEFAULT.sky, {
    zen: [0.36, 0.17, 0.055], mid: [0.48, 0.22, 0.068], hor: [0.56, 0.25, 0.075], gnd: [0.4, 0.18, 0.055],
    glow: [0.55, 0.34, 0.14], halo: [0.5, 0.38, 0.22], disk: [1.6, 1.45, 1.15], cloudLo: [0.44, 0.2, 0.06], cloudHi: [0.66, 0.34, 0.13], cloud: [0.35, 0.85, 0.45],
  }),
  envGround: 0x5a3c24, hdri: null,
  bounce: [1.0, 0.8, 0.56], dust: [0.9, 0.68, 0.46], motes: [1.5, 1.1, 0.7],
  grade: { lo: [1.0, 0.95, 0.9], hi: [1.05, 0.99, 0.9], exp: 1.05, sat: 0.95, con: 1.0 }, rays: [1.0, 0.75, 0.45], raysThr: 2.5, raysCap: 2,
  bloom: [0.2, 0.5, 1.4],
  impact: [0.7, 0.52, 0.34], wind: [700, 0.12],
});
/* Lulls: every 4 minutes the wind drops for a while (20 s to calm down, 35 s of lull, 20 s to pick up again) and the dust thins without
   clearing: you see to about 90 m, the sun's disc sharpens, the shadows come back, a window for the snipers of the garas; then the
   storm closes in again. The timing is drawn from the match time, that of the online host (MATCH.timeLeft): everyone sees it at the same
   time. Nothing is recompiled, each frame we blend the storm (ATMO_SIROCCO, or the atmosphere of a trial, ambiance.js) and the lull (SM_LULL)
   into the same uniforms as applyAtmosphere: fog, sun and shadows, ambient and bounced light, sky, color grading, suspended grains, wind
   you can see and hear, flying sand. Bots see as far as the players (botSense accounts for fog). */
const SM_LULL = {
  fog: [0.66, 0.42, 0.22], fogD: 0.0072, fogSun: 0.8, sunI: 1.4, sunColor: 0xffcf9a, vmSun: 0xffcf9a,
  hemi: [0xd2b090, 0x8a6040, 0.9], vmHemi: [0xd2b090, 0x8a6040], bounce: [1.3, 1.0, 0.7],
  sky: { zen: [0.42, 0.3, 0.18], mid: [0.58, 0.4, 0.22], hor: [0.66, 0.42, 0.22], gnd: [0.45, 0.3, 0.17], glow: [0.9, 0.6, 0.3], halo: [0.9, 0.7, 0.45], disk: [6, 5, 3.6] },
  grade: { lo: [0.98, 0.98, 1.0], hi: [1.06, 1.0, 0.9], exp: 1.0, sat: 0.95, con: 1.05 },
  rays: [1.0, 0.75, 0.45], motes: [1.4, 1.05, 0.72], wind: [460, 0.07],
  vent: 0.45, cloth: 3.4, sand: 0.2, // share of the storm's wind (flora), cloth breeze (m/s), density of the flying sand
  period: 240, rise: [140, 160], fall: [195, 215], // cycle and windows (s): the first lull comes 2 min 20 after the start
};
const SM_CLOTH = 7.5; // breeze of the cloths in the storm (m/s; CLOTH_BREEZE, 06gb-cloth.js: 3.4 for a clear day)
const SMS = { s: -1, force: null, c: new THREE.Color(), d: new THREE.Color(), vent: null }; // applied level; force: imposed level (tools)
/* Storm level (1: the storm, 0: the heart of a lull) at the elapsed match time; outside a match, the clock t */
function smStormLevel(t) {
  if (SMS.force !== null) return SMS.force;
  const total = (MATCH.online ? NET.cfg.time : Settings.minutes) * 60, P = SM_LULL.period;
  const e = MATCH.state === 'playing' || MATCH.state === 'killcam' || MATCH.state === 'finish' ? Math.max(0, total - MATCH.timeLeft) : t;
  const p = e % P;
  return 1 - smoothstep(SM_LULL.rise[0], SM_LULL.rise[1], p) * (1 - smoothstep(SM_LULL.fall[0], SM_LULL.fall[1], p));
}
function smStorm(t) {
  if (!sky.visible) return; // aerial view of a streak (08b-killstreaks.js): it sets the fog itself
  const s = smStormLevel(t);
  if (Math.abs(s - SMS.s) < 0.002) return;
  SMS.s = s;
  const A = SM_LULL, B = CURMAP.def.atmo, L = (a, b) => a + (b - a) * s, LA = (a, b) => a.map((v, i) => v + (b[i] - v) * s);
  const hx = (a, b) => SMS.c.setHex(a).lerp(SMS.d.setHex(b), s);
  scene.fog.color.setRGB(...LA(A.fog, B.fog)); scene.fog.density = L(A.fogD, B.fogD) * (B.fogH && B.fogH[0] > 0 ? 1.3 : 1);
  hemi.color.copy(hx(A.hemi[0], B.hemi[0])); hemi.groundColor.copy(hx(A.hemi[1], B.hemi[1])); hemi.intensity = L(A.hemi[2], B.hemi[2]);
  vmHemi.color.copy(hx(A.vmHemi[0], B.vmHemi[0])); vmHemi.groundColor.copy(hx(A.vmHemi[1], B.vmHemi[1])); vmSun.color.copy(hx(A.vmSun, B.vmSun));
  const U = SkyShader.uniforms;
  for (const [k, u] of [['zen', 'uZen'], ['mid', 'uMid'], ['hor', 'uHor'], ['gnd', 'uGnd'], ['glow', 'uGlow'], ['halo', 'uHalo'], ['disk', 'uDisk']]) U[u].value.set(...LA(A.sky[k], B.sky[k]));
  const F = FinalShader.uniforms, G = Object.assign({}, GRADE_DEF, A.grade), H = Object.assign({}, GRADE_DEF, B.grade);
  F.uGradeLo.value.set(...LA(G.lo, H.lo)); F.uGradeHi.value.set(...LA(G.hi, H.hi)); F.uRayTint.value.set(...LA(A.rays, B.rays));
  F.uExposure.value = L(G.exp, H.exp) * G.gain; F.uSat.value = L(G.sat, H.sat); F.uCon.value = L(G.con, H.con);
  const sc = hx(A.sunColor, B.sunColor);
  FOG_U.fogSun.value[3] = L(A.fogSun, B.fogSun); FOG_U.fogSunCol.value.set([sc.r, sc.g, sc.b]);
  if (csm) for (const l of csm.lights) { l.color.copy(sc); l.intensity = L(A.sunI, B.sunI); }
  WMU.uBounce.value.setRGB(...LA(A.bounce, B.bounce));
  if (FX && FX.dust) FX.dust.material.uniforms.uColor.value.setRGB(...LA(A.motes, B.motes));
  if (SMS.vent === null) SMS.vent = WIND_U.uWnD.value.z; // wind strength of the storm (vent of the definition, windInit at load)
  WIND_U.uWnD.value.z = SMS.vent * L(A.vent, 1);
  // the cloths' breeze (flags, tarps, rugs, the soldiers' ponchos), in the direction of the flora's wind
  CLOTH_BREEZE.sirocco = [MAP_DEFS.sirocco.vent[0], MAP_DEFS.sirocco.vent[1], L(A.cloth, SM_CLOTH)];
  if (AU.ambience && AU.windG) { // the wind you hear: deeper and stronger in the storm, on top of the recorded ambience
    AU.windF.frequency.value = L(A.wind[0], B.wind[0]); AU.windG.gain.value = L(A.wind[1], B.wind[1]);
    if (AMB.bed && AU.windOut) AU.windOut.gain.value = s;
  }
}
/* Points of interest of the Alpha half: [x, z, route, to hold, height above the terrain (or absolute if abs)]; the Bravo half mirrored,
   a point on the axis only once */
function smPoi(list) {
  const out = [];
  for (const [x, z, lane, hold, dy, abs] of list) for (const s of z === 0 ? [1] : [1, -1]) out.push([x, abs ? dy : smH(x, s * z) + (dy || 0), s * z, lane, hold ? 1 : 0].slice(0, hold ? 5 : 4));
  return out;
}
const SM_SPAWNS = [[-12.5, 53.5], [-8.5, 54.5], [-4.5, 53.5], [-0.5, 54.5], [3.5, 53.5], [7.5, 54.5], [11.5, 53.5], [-11.5, 57.5], [-6.5, 57.5], [-2.5, 58.5], [1.5, 57.5], [5.5, 58.5], [9.5, 57.5], [13.5, 56.5], [-1.5, 61.5]];

MAP_DEFS.sirocco = {
  type: 'open', // big and open (the snipers' Sea of Dunes, the oasis and the camps under cover): README "Map design rules"
  bounds: { x0: -82, x1: 82, z0: -82, z1: 82 },
  near: { x: 84, z: 84 }, // scenery segments across the whole play area (beyond: the background)
  relief: { fn: smH, pad: 6 }, // dune ground (02-relief.js)
  ring: { r: SM_R, hard: SM_R + 10, t: 10 }, // round zone: 10 s to come back, no farther than 80 m
  light: { d: 0.75 }, // lighting baked in 0.75 m cells (the map is big)
  textures: ['stone', 'wood', 'sand', 'dirt', 'pise', 'adobe', 'shingle', 'vase', 'strata', 'reg', 'canvas', 'woolen', 'steel', 'burlap', 'timber', 'palmbark'], // strata: the stratified cliff (photo) of the sandstone massifs; reg: the ground of the camps
  texRelief: ['strata'], // parallax relief of the cliff ledges
  surfaces: SIROCCO_SURFACES,
  kit: () => siroccoKit(),
  materials: (M) => makeSiroccoMaterials(M),
  // recorded ambience (05c-ambiance.js): Cirrus's, a strong wind that never drops, frequent gusts and flapping canvas; no birds in the storm
  sound: { pack: 'amb_cirrus', bed: 0.6, spots: [
    { id: 'a_gust', every: [5, 12], gain: 0.55, dist: [4, 12], y: [2, 7] },
    { id: 'a_flap', every: [8, 20], gain: 0.3, dist: [5, 18], y: [1, 4] },
  ] },
  vent: [0.8, 0.6, 2.4], // the storm's wind (02md-wind.js): toward the north-east, strong (the flora leans and whips; SM_LULL.vent in a lull)
  art: { cam: [-48, 21.5, 46], look: [2, 3.25, -2], fov: 52 }, // above the western dunes: the wreck, the lookout post, the oasis, the camps
  landmarks: [[0, 11, 0, 'oasis'], [-62, 10, 0.5, 'plane'], [54, 10, 0, 'rock']],
  splat: { x0: -100, z0: -100, w: 200, d: 200, ppm: 2 },
  far: 760,
  build() { siroccoLevel(); },
  update(t) { smStorm(t); smLife(SMP.life || [], t); },
  unload() { SMS.s = -1; SMS.vent = null; SMP.life = null; SMP.plane = null; for (const k of ['devilTex', 'veilTex']) if (SMP[k]) { SMP[k].dispose(); SMP[k] = null; } },
  spawns: SM_SPAWNS,
  poi: smPoi([
    // (-41, 18): between the two cargo containers; (-27, 41): the crest of point C, among its boulders, held
    [-50, 45, 'L', 1], [-60, 14, 'L', 1], [-35, 8, 'L'], [-50, 6, 'L'], [-41, 18, 'L'], [-27, 41, 'L', 1], [-27.5, 29.5, 'L', 1, 5.3, true],
    [0.5, 32.5, 'M', 1], [-8, 37, 'M'], [9, 27, 'M'], [0, 15, 'M'], [-18.5, 13.5, 'M', 1], [0, 45, 'M'], [12.5, 30.5, 'M', 1, 5.3, true],
    [36.5, 43.5, 'E', 1], [44, 21, 'E'], [53.5, 4.5, 'E', 1, 9.0, true], [38, 10, 'E'], [26, 36, 'E'],
  ]).concat([[-46.5, 4.95, 0.5, 'L', 1], [-37.5, 2.25, 0.5, 'L'], [-46.5, 2.25, 0.5, 'L']]), // the plane: the roof, the two cabins
  dom: [[37.5, 40.5], [0, 0], [-26, -42]], // placed by the owner with the zones tool (?tool=zones, October 2026)
  mecha: [[-34.5, -12.5], [-20, 37.5], [35, -26], [54, 0.5]], // mecha drop zones (08f-mecha.js, mnavZones), placed the same way
  lane: (x) => (x < -24 ? 'L' : x > 24 ? 'E' : 'M'),
  sniper: [-57.5, 6.0, 23.5], // its side's gara, at the edge of the sebkha
  coverZ: 52,
  heli: [50, 50],
  cam: 70,
  surface: () => 'dirt', // footstep sound: sand
  zones: [
    [_t('Alpha Base'), -70, 70, 48, 82], [_t('Bravo Base'), -70, 70, -82, -48],
    [_t('Oasis'), -26, 26, -16, 16],
    [_t('North camp'), -20, 20, 19, 46], [_t('South camp'), -20, 20, -46, -19],
    [_t('Wreck'), -60, -28, -24, 24], [_t('Dune sea'), -82, -24, -48, 48],
    [_t('Encampment'), 26, 50, 34, 52], [_t('Encampment'), 26, 50, -52, -34],
    [_t('Rocks'), 24, 82, -46, 46],
  ],
  atmo: ATMO_SIROCCO, // (no sky photo: the sky of the storm is computed)
};
