/* ==========================================================================
   CIRRUS: an archipelago of floating islands above a sea of clouds, linked by suspension bridges (in the style of the cartoon
   Skyland). 76 x 116 m, mirrored north-south (team Alpha in the north, +z; Bravo in the south, -z). No wall at the edge of the islands: you fall into the
   void (VOID, 02-map.js: death below 14 m, credit to the last opponent who hit you); only the bridges have railings that hold you back.
   WEST "Lookout and Lighthouse" : the Lookout and its watchtower, the Lighthouse bridge, the Lighthouse in the middle; the snipers' long views.
   CENTER "Rotunda and Sanctuary" : the ruined Rotunda and its two steles, then the Sanctuary (point B) under its big floating
   crystal, landmark of the whole map. Points A and C are in the wings of the bases (A west of Alpha's, C east of Bravo's), behind ruined walls.
   EAST "Ruins and Grove" : the Ruins and their terrace, the Grove and its trees in the middle; close combat.
   Links: a bridge from the Rotunda to the Lookout and to the Ruins, two bridges from the Sanctuary to the Lighthouse and the Grove. Each base has
   three bridges. The two halves can be told apart: azure, cherry trees in bloom and a blue airship in the north (Alpha); madder red, russet maples and a
   red airship in the south (Bravo).
   Sight lines: aligned islands can see each other from one end of the map to the other across the void. Floating rocks in the void
   corridors and steles at the bridgeheads and in the middle of the Rotundas (you walk around them) cut these lines; each base's Rock
   shelters its spawns from the central axis.
   The draws are reproducible (fixed seeds): every peer in a lobby builds the same map.
   ========================================================================== */
const STL = {
  // islands of the Alpha half (z > 0), rectangles [x0, x1, z0, z1] whose top is at y = 0; Bravo is the mirror in z
  half: {
    base: { rects: [[-16, 16, 42, 56], [-22, -10, 38, 46], [10, 30, 38, 48], [-10, 0, 37, 42]], depth: 36, tip: [2, 3], seed: 11 }, // wide east wing: two distinct exits to the Ruins
    lookout: { rects: [[-34, -16, 21, 30], [-30, -20, 17, 21]], depth: 28, tip: [-1, 0], seed: 21 },
    rotunda: { rects: [[-7, 7, 18, 31]], depth: 24, seed: 31 },
    ruins: { rects: [[16, 36, 18, 30], [19, 35, 16, 18]], depth: 30, tip: [1, 1], seed: 41 },
  },
  // middle islands, symmetric
  mid: {
    phare: { rects: [[-38, -20, -9, 9]], depth: 32, tip: [-1, 0], seed: 51 },
    sanctuary: { rects: [[-11, 11, -6, 6], [-8, 8, -9, 9]], depth: 44, seed: 61 },
    grove: { rects: [[20, 38, -9, 9]], depth: 30, tip: [1, 0], seed: 71 },
  },
  // bridges of the Alpha half: [axis, axis coordinate, start, end (island edges), width between the railings]
  // (the east has two parallel bridges from the base to the Ruins and from the Ruins to the Grove: four distinct routes from one camp to the other; the one from the
  // base to the Rotunda is offset west of point A: from its head you see neither the point nor the Sanctuary, and the stele that hides them stands
  // beside the exit, not in front of it; the one from the Rotunda to the Sanctuary, 4 m wide until November 2026, is 3 m wide like the others and
  // on the axis of point B: the straight rush down the middle is single file, the side routes weigh more)
  bridges: [['z', -18.5, 30, 38, 3], ['z', -4.5, 31, 37, 3], ['z', 18.5, 30, 38, 3], ['z', 27.5, 30, 38, 3], ['x', 24.5, -16, -7, 3], ['x', 24.5, 7, 16, 3], ['z', -26.5, 9, 17, 3], ['z', 0.5, 9, 18, 3], ['z', 22.5, 9, 16, 3], ['z', 32.5, 9, 16, 3]],
  midBridges: [['x', 0, -20, -11, 4], ['x', 0, 11, 20, 4]],
  seaDepth: 80, // the sea of clouds, below the top of the islands (m); 120 until November 2026: closer, its cumulus show under the noon sun instead of melting into the haze
  crystal: { y: 16 }, // big floating crystal above the Sanctuary
  A: 24.5, // center of the Rotundas: (0.5, ± A) (points A and C until October 2026)
};
/* Rectangle and bridge of the Bravo half (s = -1): mirror in z */
const stMirR = (q, s) => (s > 0 ? q : [q[0], q[1], -q[3], -q[2]]);
const stMirB = (b, s) => (s > 0 ? b : b[0] === 'z' ? ['z', b[1], -b[3], -b[2], b[4]] : ['x', -b[1], b[2], b[3], b[4]]);
/* All the bridges, in both halves (for the ground distribution and the footsteps on planks) */
function stAllBridges() { return [1, -1].flatMap((s) => STL.bridges.map((b) => stMirB(b, s))).concat(STL.midBridges); }

/* ---------- Plan ---------- */
function cirrusLevel() {
  ST_CUTS.length = 0;
  STR.rng = rngOf(9101); STR.anim = [];
  for (const s of [1, -1]) {
    for (const k of Object.keys(STL.half)) { const I = STL.half[k]; stIsland({ ...I, rects: I.rects.map((q) => stMirR(q, s)), seed: I.seed + (s < 0 ? 5 : 0), tip: I.tip ? [I.tip[0], I.tip[1] * s] : null }); }
    for (const b of STL.bridges) { const q = stMirB(b, s); stBridge(q[0], q[1], q[2], q[3], q[4]); }
    cirrusBase(s); cirrusLookout(s); cirrusRotunda(s); cirrusRuins(s);
  }
  for (const k of Object.keys(STL.mid)) stIsland(STL.mid[k]);
  for (const b of STL.midBridges) stBridge(b[0], b[1], b[2], b[3], b[4]);
  cirrusLighthouse(); cirrusSanctuary(); cirrusGrove();
  cirrusFloats();
  cirrusBackdrop();
  cirrusGround();
}
const STR = { rng: null, anim: [] };
/* Prefab placed on the ground (y = 0) at (x, z), rotated by ry */
function stPut(pf, x, z, ry = 0, o) { DECOR.place(pf, x, 0, z, ry, o); }
/* Crates and barrels of the sky merchants (physical props: they roll and fall into the void) */
function stCrates(x, z, ry, n = 2) {
  const R = STR.rng;
  for (let i = 0; i < n; i++) { const a = ry + (i - (n - 1) / 2) * 0.4; stPut(PF.crate(R.range(0.95, 1.15)), x + Math.cos(ry) * (i - (n - 1) / 2) * 1.5, z - Math.sin(ry) * (i - (n - 1) / 2) * 1.5, a + R.range(-0.15, 0.15)); } // side by side without overlapping (1.5 m, barely rotated)
}

/* ---------- Bases: the spawns on either side of the Rock, the airship dock at the back, tents and pennants in the camp's
   color ----------
   The middle of the Rotunda is hidden from the spawns by the stele at its north edge, the Sanctuary by its standing stones (without them, the
   base camps its point), points A and C by the ruined walls. Rule for the whole island: nothing tall at a bridgehead (5 m in its extension, tools/dev/visual/decor.js) */
function cirrusBase(s) {
  const col = stAccent(s), k = s < 0 ? 1 : 0;
  stRoche(s);
  stPut(PF.stTent(col), -12.4, s * 50.5, 0); stPut(PF.stTent(col), 12.4, s * 50.5, 0);
  // covers at the exits, which also hide the center of the map from the side spawns
  stPut(PF.stSpire(4.2, 1.3, 14 + k), -12.6, s * 39.8, s * 0.4);
  stPut(PF.stSpire(4.2, 1.3, 15 + k), 23.2, s * 39.8, s * -0.4);
  stPut(PF.stCrateStack(1 + k), -20.0, s * 44.0, s * 0.2); stCrates(23.0, s * 43.4, s * 0.1, 2); // between the heads of the two Ruins bridges
  // ruined walls on either side of the spawn yard (layout of November 2026), full height on the spawns' side, broken toward the bridges:
  // the spawns no longer see point A (west wing, Alpha) nor point C (east wing, Bravo), which can now be taken without being shot at from the
  // spawn, and the soldiers who come out of the Lookout and Ruins bridges no longer see into the spawn. The west one stands at the edge of the
  // spawns (0.65 m from the nearest), out of point A's disc, which keeps its walkable ground, and broken only at its south end; you go round
  // them by the south (5 m) or by the north (the spawns' side; in the east, 1.8 m between the wall and the tent)
  stPut(PF.stRuinWall(3.8, 2.28, 1 + k, 0.7), -8.5, s * 44.9, (s * Math.PI) / 2); stPut(PF.stRuinWall(3.8, 2.28, 3 + k), 12.5, s * 44.7, (s * Math.PI) / 2);
  stDock(s);
  for (const x of [-14.5, 14.5]) stBanner(x, s * 54.0, col);
}
/* The Rock: block of layered rock in the middle of the base, between the two spawn groups (it shelters them from the central axis), two
   fused blocks, a single collision; in front of it, a 3.4 m passage to the edge of the base (toward the Rotunda bridge) */
function stRoche(s) {
  const M = DECOR, R = rngOf(s > 0 ? 4401 : 4402), zc = s * 46.2;
  M.save().local(1); M.cls = 0;
  for (const [x, rx, ry, rz] of [[-1.3, 1.65, 2.6, 1.05], [1.6, 1.6, 2.3, 1.05]]) {
    M.save().move(x, 0, zc + R.range(-0.12, 0.12)).rotY(R.range(-0.25, 0.25));
    M.color([R.range(0.88, 1), R.range(0.84, 0.95), R.range(0.78, 0.88)]);
    rockMesh(M, R, rx, ry, rz, 3, 10, 7, 'strata'); M.restore();
  }
  M.restore();
  const z0 = s > 0 ? 45.4 : -47.0, z1 = s > 0 ? 47.0 : -45.4;
  DECOR.col(-2.8, 3.0, 0, 3.4, z0, z1, 'concrete'); DECOR.col(-2.2, 2.4, 3.4, 4.2, z0 + 0.2, z1 - 0.2, 'concrete');
}
/* Airship dock: plank platform at the edge of the back of the base (walkable, flush with the ground), mooring posts, and the camp's
   airship that floats beyond, held by two mooring lines */
function stDock(s) {
  const M = DECOR, z0 = s * 56, col = stAccent(s);
  M.save().local(1).color(ST.wood); M.cls = 0;
  for (let x = -6; x < 6; x += 0.26) M.boxB('wood', x, x + 0.22, -0.05, 0.02, Math.min(z0 - s * 3.5, z0 - s * 0.05), Math.max(z0 - s * 3.5, z0 - s * 0.05)); // not beyond the edge: you would see ground that does not carry
  M.restore();
  for (const x of [-5.5, 5.5]) { stPut(PF.bitt(), x, z0 - s * 0.4, 0); }
  const ship = { x: 0, y: 7.5, z: z0 + s * 15, s, col };
  stAirship(ship);
  M.save().local(1).color(ST.rope); M.cls = 1;
  for (const x of [-5.5, 5.5]) { const a = [x, 0.55, z0 - s * 0.4], b = [x * 0.45, ship.y - 1.2, ship.z - s * 3.2]; M.tube('rope', 0.03, [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.6, (a[2] + b[2]) / 2], b], 5); LINES.push({ k: 'mooring', a, b }); }
  M.restore();
}
/* Pennant in the camp's color on a wooden pole; it flutters in the wind (simulated flag) */
function stBanner(x, z, col) {
  const M = DECOR;
  M.save().move(x, 0, z).color([0.55, 0.45, 0.34]); M.cls = 0; M.cyl('wood', 0.07, 4.6, 8, { r1: 0.05 }); M.restore();
  DECOR.col(x - 0.08, x + 0.08, 0, 4.6, z - 0.08, z + 0.08, 'wood');
  M.save().move(x, 3.2, z).color(col).local(1); M.cls = 1;
  clothPiece(M, [0.06, 0.15, 0], [1.6, 0.0, 0], [1.6, 1.15, 0], [0.06, 1.3, 0], [0, 0, 1], { hoist: true, clothKind: 'flagCloth', grp: 'pennant' + x + ',' + z }); // flutters (simulated cloth, 02mc-cloths.js)
  M.restore();
}
/* Airship: spindle-shaped balloon in the camp's color, wooden gondola, tail fins, propellers; floats and pitches gently (stAnimate) */
function stAirship(o) {
  const g = new THREE.Group(), MK = new Maker({ parts: new Map(), buf(mat, cls) { const k = mat + '|' + cls; let p = this.parts.get(k); if (!p) this.parts.set(k, p = { mat, cls, g: new GeoBuf(256, 512, false) }); return p.g; }, col() {}, occ() {}, pcol() {}, dynAdd() {} });
  MK.color(o.col).local(1);
  const prof = []; for (let i = 0; i <= 16; i++) { const t = i / 16, r = 3.1 * Math.pow(Math.sin(Math.PI * t), 0.75); prof.push([Math.max(r, 0.01), (t - 0.5) * 17]); }
  MK.save().rotX(Math.PI / 2); MK.lathe('canvas', prof, 20); MK.restore();
  MK.color([0.92, 0.9, 0.84]);
  for (const k of [0, 1, 2, 3]) { MK.save().move(0, 0, -7.4).rotZ((k * Math.PI) / 2); MK.quad('canvas', [0, 0.5, 0], [0, 3.0, -1.6], [0, 3.0, 0.4], [0, 0.6, 1.4], [1, 0, 0]); MK.quad('canvas', [0, 0.5, 0], [0, 0.6, 1.4], [0, 3.0, 0.4], [0, 3.0, -1.6], [-1, 0, 0]); MK.restore(); }
  MK.color([0.58, 0.45, 0.32]); MK.boxB('wood', -0.9, 0.9, -4.4, -3.3, -2.6, 2.6, { bevel: 0.05 });
  MK.color([0.3, 0.28, 0.26]); for (const sd of [-1, 1]) { MK.save().move(sd * 1.3, -3.85, -2.7); MK.cyl('steel', 0.08, 0.5, 6); MK.restore(); }
  MK.color(ST.rope); for (const sd of [-1, 1]) for (const zz of [-2.2, 2.2]) MK.tube('rope', 0.02, [[sd * 0.8, -3.35, zz], [sd * 1.9, -2.1, zz * 1.3]], 4);
  for (const p of MK.T.parts.values()) { if (!p.g.ni) continue; const m = new THREE.Mesh(p.g.geometry(), MAT[p.mat]); m.castShadow = false; g.add(m); }
  g.position.set(o.x, o.y, o.z); if (o.s < 0) g.rotation.y = Math.PI;
  mapAdd(g); STR.anim.push({ k: 'ship', g, y: o.y, ph: o.s > 0 ? 0 : 1.7 });
  WORLD.col && DECOR.col(o.x - 3, o.x + 3, o.y - 4.4, o.y + 3.2, o.z - 8.5, o.z + 8.5, 'dirt', true); // it stops bullets
}

/* ---------- Lookout (west, each camp's side): watchtower (elevated position), spire, rocks, crystals ---------- */
function cirrusLookout(s) {
  const k = s < 0 ? 2 : 0;
  stTower(-31.3, s * 26.5, s);
  stPut(PF.stSpire(4.6, 1.5, 21 + k), -23.0, s * 28.8, s * 0.3);
  stPut(PF.stBlock(1.4, 0.95, 0.8, 21), -25.0, s * 23.0, s * 0.6); stPut(PF.stBlock(1.2, 0.9, 1.0, 22), -31.0, s * 22.2, s * 0.3);
  stPut(PF.stCrystals(1.7, 21 + (s < 0 ? 1 : 0)), -26.6, s * 29.2, 0);
}
/* Wooden watchtower: 5 x 5 m platform at 4 m (walkable, no railing: you fall off it onto the island), four posts, staircase
   along x from the east */
function stTower(cx, cz, s) {
  const M = DECOR, H = 4, half = 2.5;
  M.save().local(1).color([0.7, 0.58, 0.44]); M.cls = 0;
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) { M.boxB('wood', cx + dx * (half - 0.12) - 0.12, cx + dx * (half - 0.12) + 0.12, 0, H - 0.08, cz + dz * (half - 0.12) - 0.12, cz + dz * (half - 0.12) + 0.12); DECOR.col(cx + dx * (half - 0.12) - 0.12, cx + dx * (half - 0.12) + 0.12, 0, H, cz + dz * (half - 0.12) - 0.12, cz + dz * (half - 0.12) + 0.12, 'wood'); }
  for (let x = cx - half; x < cx + half; x += 0.27) M.boxB('wood', x, Math.min(x + 0.24, cx + half), H - 0.08, H, cz - half, cz + half); // the last plank stops at the edge: past it, it lay in the plane of the top step of the staircase (z-fighting)
  M.boxB('wood', cx - half + 0.01, cx + half - 0.01, H - 0.32, H - 0.08, cz - half + 0.01, cz - half + 0.15); M.boxB('wood', cx - half + 0.01, cx + half - 0.01, H - 0.32, H - 0.08, cz + half - 0.15, cz + half - 0.01); // girts 1 cm back from the posts
  // Saint Andrew's cross on two faces
  M.color([0.62, 0.5, 0.38]);
  for (const dz of [-1, 1]) M.tube('wood', 0.05, [[cx - half + 0.1, 0.3, cz + dz * (half - 0.12)], [cx + half - 0.1, H - 0.4, cz + dz * (half - 0.12)]], 4);
  // canvas roof
  M.color(stAccent(s)); M.quad('canvas', [cx - half - 0.3, H + 2.3, cz - half - 0.3], [cx + half + 0.3, H + 2.3, cz - half - 0.3], [cx + half + 0.3, H + 2.3, cz + half + 0.3], [cx - half - 0.3, H + 2.3, cz + half + 0.3], [0, 1, 0]);
  M.quad('canvas', [cx - half - 0.3, H + 2.3, cz - half - 0.3], [cx - half - 0.3, H + 2.3, cz + half + 0.3], [cx + half + 0.3, H + 2.3, cz + half + 0.3], [cx + half + 0.3, H + 2.3, cz - half - 0.3], [0, -1, 0]);
  M.color([0.62, 0.5, 0.38]); for (const dx of [-1, 1]) for (const dz of [-1, 1]) M.boxB('wood', cx + dx * (half - 0.1) - 0.06, cx + dx * (half - 0.1) + 0.06, H, H + 2.3, cz + dz * (half - 0.1) - 0.06, cz + dz * (half - 0.1) + 0.06);
  M.restore();
  DECOR.col(cx - half, cx + half, H - 0.32, H, cz - half, cz + half, 'wood');
  // stone base under the platform: no dead-end nook between the posts
  box('stone', cx - half + 0.05, cx + half - 0.05, 0, 1.1, cz - half + 0.05, cz + half - 0.05, { tint: ST.stone });
  // staircase: from the east (x = cx + half + 6) to the edge of the platform
  ramp(cx + half, cx + half + 7.2, cz - 0.7, cz + 0.7, 'x', H, 0, 'wood', ST.wood, { mat: 'wood' }); // slope under NAV_DH per meter: the bots climb it
}

/* ---------- Rotunda (points A and C until October 2026): columns around its center, two steles, spires at the corners; its four bridgeheads
   (the base's bridge arrives in the northwest, those of the Lookout, the Ruins and the Sanctuary on the center's axes) draw a clear cross ---------- */
function cirrusRotunda(s) {
  const cx = 0.5, cz = s * STL.A, R = 5.0, k = s < 0 ? 7 : 0;
  // three columns on the diagonals (in the northwest, the head of the base's bridge): they frame the exits without blocking them
  [40, 220, 320].forEach((deg, i) => { const a = (deg * Math.PI) / 180; stPut(PF.stColumn(4.2, i % 2 === 1, 31 + i + k), cx + Math.cos(a) * R, cz + s * Math.sin(a) * R, s * a); });
  // stele at the north edge, beside the head of the base's bridge: it hides the point from the spawns and closes off the corridor of the Sanctuary bridges
  stPut(PF.stStele(4.6, 3.6, 0.9, 37 + k), 0.1, s * 28.75, 0);
  // a second, lower stele in the middle (layout of November 2026), across the axis of the Lookout and Ruins bridges: the 50 m line from one
  // of these islands to the other through the Rotunda is cut, and you cross it from the base bridge to the Sanctuary bridge sheltered from one
  // of the two sides; its crystals face them
  stPut(PF.stStele(2.8, 2.6, 0.8, 38 + k), 0.5, s * 24.8, Math.PI / 2);
  // spikes at the corners
  stPut(PF.stSpire(4.4, 1.3, 34 + k), 6.0, s * 28.6, s * 1.1);
  stPut(PF.stSpire(4.0, 1.2, 35 + k), -5.6, s * 19.8, s * 2.1); stPut(PF.stSpire(4.0, 1.2, 36 + k), 6.0, s * 19.8, s * 0.7);
}

/* ---------- Ruins (east, each camp's side): stone terrace (elevated position), spires, column, block, a tree ---------- */
function cirrusRuins(s) {
  // terrace: slab at 2.6 m on a stone mass against the east edge, staircase toward the west (the two eastern routes pass beside it);
  // its south foot stays 6 m from the edge: you leave the Grove bridge onto a landing, not facing a wall
  const x0 = 29.8, x1 = 36, z0 = s > 0 ? 22 : -30, z1 = s > 0 ? 30 : -22, H = 2.6, k = s < 0 ? 3 : 0; // up to the east and north edges
  box('stone', x0, x1, 0, H, z0, z1, { tint: ST.stone });
  ramp(x0 - 4.8, x0, s * 24 - 0.8, s * 24 + 0.8, 'x', 0, H, 'stone', ST.stone, { mat: 'stone' });
  stPut(PF.stSpire(4.8, 1.6, 41 + k), 17.6, s * 19.4, s * 0.6);
  stPut(PF.stSpire(4.2, 1.4, 42 + k), 23.0, s * 28.4, s * 1.7);
  stPut(PF.stColumn(3.2, true, 43 + k), 20.6, s * 21.7, 0); // beside the heads of the base and Grove bridges: cuts the view along the base's bridge
  DECOR.place(PF.stColumn(4.2, false, 42 + k), 34.4, H, s * 28.6, 0); // standing on the terrace
  stPut(PF.stBlock(1.2, 0.9, 1.2, 42), 26.8, s * 19.0, s * 0.7);
  stPut(PF.tree(s > 0 ? 'cherry' : 'maple', 7, 2.8, 41), 24.6, s * 26.6, 0);
}
/* ---------- Lighthouse (west, in the middle): stone tower and its crystal lantern, scaffolding (elevated position), crates ---------- */
function cirrusLighthouse() {
  const cx = -31.5, cz = 0.5, M = DECOR;
  M.save().move(cx, 0, cz).color(ST.stone).local(1); M.cls = 0;
  M.cyl('stone', 2.2, 9.5, 20, { r1: 1.7 });
  M.save().move(0, 9.5, 0); M.cyl('stone', 2.0, 0.35, 20); M.restore();
  M.color([0.9, 1, 1]); M.save().move(0, 9.85, 0); M.cyl('crystalSt', 0.9, 1.8, 6, { r1: 0.6 }); M.restore();
  M.color(ST.stone); M.save().move(0, 11.65, 0); M.cyl('stone', 1.4, 0.4, 12, { r1: 0.2 }); M.restore();
  M.restore();
  DECOR.col(cx - 2.0, cx + 2.0, 0, 9.85, cz - 2.0, cz + 2.0, 'concrete');
  // scaffolding west of the tower: platform at 3 m (elevated position that sees the Sanctuary), a ramp toward each camp, away from the
  // north-south passage of the bridges
  stDeck(-37.6, -33.6, -1.4, 2.4, -36.4, -35.0); // a 1.5 m passage between the ramps and the tower
  stPut(PF.stSpire(4.4, 1.5, 51), -22.6, 5.6, 0.3); stPut(PF.stSpire(4.4, 1.5, 52), -22.6, -4.6, -0.3);
  stCrates(-30.4, 6.8, 0, 2); stCrates(-30.4, -6.8, 0, 2); // beside the head of the Lookout bridge
}

/* Plank platform at 3 m on four posts (you pass underneath), a ramp toward each camp along z, from rx0 to rx1;
   hole: [x, z, r], square opening of half-side r around the trunk of a tree that passes through the platform (planks cut, frame around it) */
function stDeck(px0, px1, pz0, pz1, rx0, rx1, hole) {
  const M = DECOR, H = 3;
  M.save().local(1).color([0.68, 0.56, 0.42]); M.cls = 0;
  for (const x of [px0 + 0.12, px1 - 0.12]) for (const z of [pz0 + 0.12, pz1 - 0.12]) { M.boxB('wood', x - 0.12, x + 0.12, 0, H - 0.08, z - 0.12, z + 0.12); DECOR.col(x - 0.12, x + 0.12, 0, H, z - 0.12, z + 0.12, 'wood'); }
  for (let x = px0; x < px1; x += 0.27) {
    if (hole && x + 0.24 > hole[0] - hole[2] && x < hole[0] + hole[2]) { M.boxB('wood', x, x + 0.24, H - 0.08, H, pz0, hole[1] - hole[2]); M.boxB('wood', x, x + 0.24, H - 0.08, H, hole[1] + hole[2], pz1); }
    else M.boxB('wood', x, x + 0.24, H - 0.08, H, pz0, pz1);
  }
  if (hole) { // frame of the opening: four headers slightly thicker than the planks
    const [hx, hz, r] = hole; M.color([0.6, 0.48, 0.36]);
    for (const sd of [-1, 1]) { M.boxB('wood', hx - r - 0.08, hx + r + 0.08, H - 0.16, H + 0.02, hz + sd * r - (sd < 0 ? 0.08 : 0.01), hz + sd * r + (sd > 0 ? 0.08 : 0.01)); M.boxB('wood', hx + sd * r - (sd < 0 ? 0.08 : 0), hx + sd * r + (sd > 0 ? 0.08 : 0), H - 0.16, H + 0.02, hz - r + 0.01, hz + r - 0.01); } // 1 cm into the opening: not in the plane of the plank ends
  }
  M.restore();
  if (!hole) DECOR.col(px0, px1, H - 0.3, H, pz0, pz1, 'wood');
  else { // the floor without the opening (its whole collision went through the trunk)
    const [hx, hz, r] = hole;
    DECOR.col(px0, hx - r, H - 0.3, H, pz0, pz1, 'wood'); DECOR.col(hx + r, px1, H - 0.3, H, pz0, pz1, 'wood');
    DECOR.col(hx - r, hx + r, H - 0.3, H, pz0, hz - r, 'wood'); DECOR.col(hx - r, hx + r, H - 0.3, H, hz + r, pz1, 'wood');
  }
  ramp(rx0, rx1, pz1, pz1 + 5.4, 'z', H, 0, 'wood', ST.wood, { mat: 'wood' }); // slope of 0.56: under NAV_DH, the bots climb it
  ramp(rx0, rx1, pz0 - 5.4, pz0, 'z', 0, H, 'wood', ST.wood, { mat: 'wood' });
}

/* ---------- Sanctuary (point B): circular paving, ring of columns, blocks, large floating crystal ---------- */
function cirrusSanctuary() {
  // four trilithons on the diagonals; two standing stones north and south of the point, more than 5 m from the bridgeheads (they hide it from the
  // spawns of both camps), two low blocks to the west and east; the corners stay clear (sniper map: the long views
  // from one island to the other are intended)
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + Math.PI / 4; stPut(PF.stTrilithon(61), 0.5 + Math.cos(a) * 6.6, Math.sin(a) * 6.4, -a + Math.PI / 2); }
  stPut(PF.stMenhir(3.8, 1.6, 65), 0.5, 3.3, 0.04); stPut(PF.stMenhir(3.8, 1.6, 66), 0.5, -3.3, -0.04);
  stPut(PF.stBlock(1.5, 1.0, 0.85, 61), -2.7, 0.5, Math.PI / 2 + 0.1); stPut(PF.stBlock(1.5, 1.0, 0.85, 62), 3.7, 0.5, Math.PI / 2 - 0.1);
  for (const [x, z] of [[-10.0, 3.8], [10.4, -3.8], [-10.0, -3.8], [10.4, 3.8]]) stPut(PF.stCrystals(1.5, 61 + Math.round(x + z)), x, z, 0);
  stCrystal();
}
/* Big floating crystal above the Sanctuary: luminous hexagonal bipyramid that turns slowly, and shards that orbit
   around it (stAnimate); no collision (above everything) */
function stCrystal() {
  const geo = new THREE.CylinderGeometry(1.6, 1.6, 4.2, 6, 1, true), top = new THREE.ConeGeometry(1.6, 2.6, 6, 1, true), bot = new THREE.ConeGeometry(1.6, 3.4, 6, 1, true);
  const g = new THREE.Group(), mat = MAT.crystalSt, c = new THREE.Color(1, 1, 1);
  for (const [G, y, flip] of [[geo, 0, false], [top, 3.4, false], [bot, -3.8, true]]) {
    const col = new Float32Array(G.attributes.position.count * 3); for (let i = 0; i < col.length; i += 3) { col[i] = c.r * 0.85; col[i + 1] = c.g * 0.95; col[i + 2] = c.b; }
    G.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.Mesh(G, mat); m.position.y = y; if (flip) m.rotation.x = Math.PI; g.add(m);
  }
  g.position.set(0, STL.crystal.y, 0); mapAdd(g); STR.anim.push({ k: 'crystal', g, y: STL.crystal.y });
  const R = rngOf(6161);
  for (let i = 0; i < 9; i++) {
    const s = R.range(0.35, 0.8), G = new THREE.OctahedronGeometry(s, 0), col = new Float32Array(G.attributes.position.count * 3).fill(0.9);
    G.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.Mesh(G, mat); mapAdd(m);
    STR.anim.push({ k: 'shard', m, r: R.range(4.5, 7.5), a: R() * TAU, w: R.range(0.15, 0.35) * (R() < 0.5 ? -1 : 1), y: STL.crystal.y + R.range(-3, 3), ph: R() * TAU });
  }
}

/* ---------- Grove (east, in the middle): trees, rocks, fallen trunk ---------- */
function cirrusGrove() {
  // trees and rocks between the bridgeheads (two in the north toward the Ruins, two in the south, one in the west toward the Sanctuary), never in front
  const trees = [[25.9, 5.9, 'oak'], [30.6, 3.4, 'linden'], [35.0, 0.5, 'oak'], [25.9, -5.7, 'oak'], [30.6, -3.2, 'linden'], [29.8, 0.5, 'ginkgo']];
  // (the Cabin's oak, straight, only forks above the platform: its branches started from the floor)
  trees.forEach(([x, z, k], i) => stPut(PF.tree(k, 7.5 + (i % 3), 3.0, 71 + i, i === 2 ? { th: 4.4, lean: 0 } : {}), x, z, 0));
  // the Cabin: platform perched around the east oak, elevated position that answers the Lighthouse scaffolding; its ramps on the east side;
  // the trunk passes through an opening (the planks went through it)
  stDeck(31.4, 37.6, -1.6, 2.6, 35.4, 36.8, [35.0, 0.5, 0.36]);
  for (const [x, z, i] of [[27.6, 7.7, 4], [27.6, -7.5, 5]]) stPut(PF.stRock(1.7, 71 + i, 0.8), x, z, i);
  stPut(PF.stBlock(2.2, 0.8, 0.8, 71), 26.4, -3.1, 0.1);
  stPut(PF.stRock(1.4, 73, 0.7), 26.2, 3.6, 0.8);
  stPut(PF.stCrystals(1.4, 71), 38.4, -5.4, 0); // beside the Cabin's north ramp, no longer in front: 30 cm from the last step, they got in the way of the exit (October 2026)
}

/* ---------- Floating rocks ----------
   In the void corridors that run from one end of the map to the other (between the middle islands, between the Lookout, the Rotunda and the
   Ruins, between the Ruins and the Grove), rocks whose top is above head height: they cut the long views, stop
   bullets, and you cannot get a foothold on them (at least 1 m from the islands). Farther away, outside the play area or very high up, small rocks
   without collision populate the sky. */
const CIRRUS_FLOATS = [
  // [x0, x1, z0, z1] (Alpha half, Bravo mirrored), top, depth
  [[-19, -12, 3, 8], 5.8, 14], [[12, 19, 3, 8], 6.4, 15],
  [[-13.5, -8.5, 27.5, 31.5], 7.2, 13], [[8.5, 13.5, 27.5, 31.5], 6.6, 13],
  [[25.5, 29.5, 10.5, 14.5], 5.4, 12],
  // on the axis of the bridges from the base to the Lookout and the Ruins, beyond those islands: you cannot see from one base to the other along these bridges
  [[-21.5, -16, 10.5, 14.5], 6.0, 12], [[15.5, 20, 10.5, 14.5], 5.6, 12],
];
function cirrusFloats() {
  let seed = 8100;
  for (const s of [1, -1]) for (const [q, top, depth] of CIRRUS_FLOATS) stFloatRock(stMirR(q, s), top + (s < 0 ? 0.4 : 0), depth, seed++);
  // sky scenery: outside the play area (|x| > 44 or |z| > 62) or more than 20 m away, no collision
  for (const [x, y, z, w, d, depth] of [
    [-50, 8, 30, 5, 4, 9], [-56, -6, -12, 6, 5, 10], [-48, 18, -40, 4, 4, 7], [-62, 4, 10, 4, 3, 7],
    [52, 10, -25, 5, 4, 9], [58, -4, 18, 6, 5, 10], [49, 20, 44, 4, 4, 7], [64, 6, -6, 4, 3, 7],
    [-14, 12, 68, 5, 4, 8], [20, -2, 74, 6, 5, 9], [14, 12, -68, 5, 4, 8], [-20, -2, -74, 6, 5, 9],
    [-10, 24, 12, 3, 3, 6], [16, 22, -14, 3, 3, 6],
  ]) stIsland({ rects: [[x - w / 2 + 0.5, x + w / 2 - 0.5, z - d / 2, z + d / 2], [x - w / 2, x + w / 2, z - d / 2 + 0.5, z + d / 2 - 0.5]], depth, seed: seed++, y, nocol: true });
}

/* ---------- Background: distant islands (cliff and green top, no collision), which populate the sky on all sides ---------- */
function cirrusBackdrop() {
  const R = rngOf(9200); WORLD.force = 'far';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + R.range(-0.15, 0.15), d = R.range(130, 420), y = R.range(-40, 25), w = R.range(14, 46) * (d / 260), dd = w * R.range(0.6, 1.1);
    const x = Math.cos(a) * d, z = Math.sin(a) * d * 1.15;
    stFarIsland(x, y, z, w, dd, R.range(0.6, 1.2) * w, 9300 + i);
  }
  WORLD.force = null;
}
/* Distant island: flat top (grass) and rock mass, few peaks; look drawn at random like that of the map's islands (stUnderShape) */
function stFarIsland(x, y, z, w, d, depth, seed) {
  const M = DECOR, N = makeNoise(seed), K = 18, rings = [0, -0.06, -0.15, -0.27, -0.4, -0.54, -0.68, -0.82, -0.92, -1], S = stUnderShape(rngOf(seed * 5 + 1), false);
  M.save().local(1); M.cls = 1; M.aoFn = null;
  const B = M.buf('strata', x, y - depth / 2, z), ids = [];
  const pt = (k, j) => { const a = (k / K) * TAU, t = -rings[j], f = j === rings.length - 1 ? 0.03 : t < 0.06 ? 1 : stUnderScale(S, (t - 0.06) / 0.94, a), r = 1 + (N.fbm(k / K, t, 6, 2, 2) - 0.5) * (0.3 + t * 0.5); return [x + Math.cos(a) * w * 0.5 * r * f, y + rings[j] * depth, z + Math.sin(a) * d * 0.5 * r * f]; };
  for (let j = 0; j < rings.length; j++) for (let k = 0; k <= K; k++) {
    const p = pt(k % K, j), a = (k / K) * TAU, top = smoothstep(-0.25, 0, rings[j]);
    M.tint = [sl(lerp(0.9, ST.moss[0], top)), sl(lerp(0.86, ST.moss[1], top)), sl(lerp(0.84, ST.moss[2], top))];
    ids.push(M.v(B, p[0], p[1], p[2], Math.cos(a), 0.15 - rings[j] * 0.2, Math.sin(a), (k / K) * w * 3, rings[j] * depth));
  }
  for (let j = 0; j < rings.length - 1; j++) for (let k = 0; k < K; k++) { const a = ids[j * (K + 1) + k], b = ids[j * (K + 1) + k + 1], c = ids[(j + 1) * (K + 1) + k + 1], dd = ids[(j + 1) * (K + 1) + k]; M.quadI(B, a, dd, c, b); }
  M.color([0.62, 0.74, 0.45]);
  const T = M.buf('ground', x, y, z), c0 = M.v(T, x, y + 0.05, z, 0, 1, 0, x, -z), rim = [];
  for (let k = 0; k <= K; k++) { const p = pt(k % K, 0); rim.push(M.v(T, p[0], p[1] + 0.05, p[2], 0, 1, 0, p[0], -p[2])); }
  for (let k = 0; k < K; k++) M.tri(T, c0, rim[k + 1], rim[k]);
  M.restore();
}

/* ---------- Ground: lawn, packed-earth paths from one bridge to the other, paving of the ruins, humus under the trees ---------- */
const GROUND_CIRRUS = { base: 'lawn', l1: 'dirt', l2: 'flagstone', l3: 'humus', pom: [0, 0, 0.03, 0], dirt: [0.62, 0.56, 0.44], mul: 0, env: 0.4 };
function cirrusGround() {
  const S = SPLAT, W = Math.round(S.w * S.ppm), H = Math.round(S.d * S.ppm), out = new Uint8Array(W * H * 4), N = makeNoise(9301);
  // paths: from one bridgehead to the other on each island (segments), paving: circles of the Rotunda, the Sanctuary, the Ruins terrace
  const paths = [], link = (p, q) => paths.push([p[0], p[1], q[0], q[1]]);
  for (const s of [1, -1]) {
    // base: spawns, around the Rock, toward the four bridges
    link([-6.5, s * 47.5], [-4.5, s * 42.4]); link([-4.5, s * 42.4], [-4.5, s * 37.5]); link([7.0, s * 47.5], [2.6, s * 42.4]); link([-4.5, s * 42.4], [2.6, s * 42.4]);
    link([0.2, s * 48.4], [-6.5, s * 47.5]); link([0.2, s * 48.4], [7.0, s * 47.5]);
    link([-6.5, s * 47.5], [-8.0, s * 42.2]); link([-8.0, s * 42.2], [-18.5, s * 38.5]); link([7.0, s * 47.5], [12.5, s * 41.6]); link([12.5, s * 41.6], [18.5, s * 38.5]); link([12.5, s * 41.6], [27.5, s * 38.5]); // round the south end of the ruined walls
    // Lookout, Rotunda, Ruins: from one bridgehead to the other (in the Rotunda, round the middle stele by the south)
    link([-18.5, s * 29.5], [-17, s * 24.5]); link([-18.5, s * 29.5], [-26.5, s * 17.5]); link([-17, s * 24.5], [-26.5, s * 17.5]);
    link([-4.5, s * 30.5], [-2.6, s * 26.8]); link([-2.6, s * 26.8], [-1.0, s * 22.4]); link([-1.0, s * 22.4], [0.5, s * 18.5]); link([-6.5, s * 24.5], [-1.0, s * 22.4]); link([-1.0, s * 22.4], [2.0, s * 22.4]); link([2.0, s * 22.4], [6.5, s * 24.5]);
    link([18.5, s * 29.5], [17.8, s * 24.5]); link([17.8, s * 24.5], [20.6, s * 20.8]); link([20.6, s * 20.8], [22.5, s * 16.5]); link([16.5, s * 24.5], [17.8, s * 24.5]);
    link([27.5, s * 29.5], [28.4, s * 22.0]); link([28.4, s * 22.0], [30.2, s * 18.8]); link([30.2, s * 18.8], [32.5, s * 16.5]); link([20.6, s * 20.8], [28.4, s * 22.0]);
  }
  link([-26.5, 8.5], [-26.5, -8.5]); link([-26.5, 0], [-20.5, 0]); link([22.5, 8.5], [22.5, -8.5]); link([32.5, 8.5], [32.5, -8.5]); link([20.5, 0], [32.5, 0]);
  const plaza = [[0.5, 0, 8.6], [0.5, STL.A, 6.0], [0.5, -STL.A, 6.0]];
  const segD = (x, z, p) => { const dx = p[2] - p[0], dz = p[3] - p[1], t = clamp(((x - p[0]) * dx + (z - p[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1); return hyp(x - p[0] - dx * t, z - p[1] - dz * t); };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = S.x0 + (i + 0.5) / S.ppm, z = S.z0 + (j + 0.5) / S.ppm, o = (j * W + i) * 4;
    const n1 = N.fbm(x * 0.07, z * 0.07, 32, 32, 3), n2 = N.fbm(x * 0.21 + 3.1, z * 0.21, 32, 32, 2);
    let pd = 99; for (const p of paths) pd = Math.min(pd, segD(x, z, p));
    let r = 1 - smoothstep(0.7, 1.5, pd + (n2 - 0.5) * 0.9), g = 0, b = 0;
    for (const [px, pz, pr] of plaza) { const d = hyp(x - px, z - pz); g = Math.max(g, 1 - smoothstep(pr - 0.8, pr + 0.4, d + (n1 - 0.5) * 1.2)); }
    if (x > 29.4 && x < 36.4 && Math.abs(z) > 21.6 && Math.abs(z) < 30.4) g = 1; // Ruins terrace
    if (x > 19 && x < 38 && Math.abs(z) < 9.5) b = smoothstep(0.42, 0.62, n1) * (1 - r) * 0.85; // Grove humus
    r *= 1 - g;
    out[o] = Math.round(clamp(r, 0, 1) * 255); out[o + 1] = Math.round(clamp(g, 0, 1) * 255); out[o + 2] = Math.round(clamp(b, 0, 1) * 255); out[o + 3] = Math.round(clamp(0.25 + n2 * 0.45 + (r + g) * 0.25, 0, 1) * 255);
  }
  const t = new THREE.DataTexture(out, W, H, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  MAT.ground = groundMat(t, [S.x0, S.z0, S.w, S.d], GROUND_CIRRUS);
  STR.splat = { d: out, W, H, x0: S.x0, z0: S.z0, ppm: S.ppm }; // kept for the lawn (density of the blades)
}
/* Share of a ground layer at (x, z), from 0 to 1: 0 paths, 1 paving, 2 humus */
function stSplat(ch, x, z) {
  const S = STR.splat; if (!S) return 0;
  const i = Math.floor((x - S.x0) * S.ppm), j = Math.floor((z - S.z0) * S.ppm);
  return i < 0 || j < 0 || i >= S.W || j >= S.H ? 0 : S.d[(j * S.W + i) * 4 + ch] / 255;
}
/* Same thing, read smoothed (bilinear interpolation between texels, like the graphics card): for the lawn, without 33 cm steps */
function stSplatL(ch, x, z) {
  const S = STR.splat; if (!S) return 0;
  const fx = (x - S.x0) * S.ppm - 0.5, fz = (z - S.z0) * S.ppm - 0.5, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, d = S.d;
  if (i >= 0 && j >= 0 && i + 1 < S.W && j + 1 < S.H) { const o = (j * S.W + i) * 4 + ch, p = o + S.W * 4; return lerp(lerp(d[o], d[o + 4], u), lerp(d[p], d[p + 4], u), v) / 255; }
  const at = (a, b) => (a < 0 || b < 0 || a >= S.W || b >= S.H ? 0 : d[(b * S.W + a) * 4 + ch] / 255); // edge of the distribution: 0 beyond
  return lerp(lerp(at(i, j), at(i + 1, j), u), lerp(at(i, j + 1), at(i + 1, j + 1), u), v);
}
/* Footstep material: planks on the bridges, slabs on the paving, earth on the paths, grass elsewhere */
function stSurface(p) {
  if (p.y < -0.05) return 'wood';
  for (const b of STR.bridgeRects || (STR.bridgeRects = stAllBridges().map(([ax, c, a0, a1, w]) => (ax === 'z' ? [c - w / 2, c + w / 2, a0 - 0.6, a1 + 0.6] : [a0 - 0.6, a1 + 0.6, c - w / 2, c + w / 2])))) if (p.x > b[0] && p.x < b[1] && p.z > b[2] && p.z < b[3]) return 'wood';
  if (hyp(p.x - 0.5, p.z) < 8.6 || hyp(p.x - 0.5, Math.abs(p.z) - STL.A) < 6.0 || p.y > 2) return 'concrete';
  return stSplat(0, p.x, p.z) > 0.5 ? 'dirt' : 'grass';
}

/* A point on a bridge near the camera (the creaking of ropes and planks); failing that, on any bridge */
function stCreakAt() {
  const R = STR.bridgeRects || (stSurface(new V3(1e4, 0, 1e4)), STR.bridgeRects) || [], c = camera.position, near = R.filter((b) => hyp((b[0] + b[1]) / 2 - c.x, (b[2] + b[3]) / 2 - c.z) < 30);
  const b = (near.length ? near : R)[Math.floor(Math.random() * (near.length || R.length))];
  return b ? new V3(rand(b[0], b[1]), -0.3, rand(b[2], b[3])) : new V3(c.x, c.y - 1, c.z);
}

/* ---------- Motion: crystal that turns and breathes, shards that orbit, airships that pitch; sea of clouds attached to the camera ---------- */
function stAnimate(t) {
  for (const A of STR.anim) {
    if (A.k === 'crystal') { A.g.rotation.y = t * 0.12; A.g.position.y = A.y + Math.sin(t * 0.6) * 0.35; }
    else if (A.k === 'shard') { const a = A.a + t * A.w; A.m.position.set(Math.cos(a) * A.r, A.y + Math.sin(t * 0.8 + A.ph) * 0.6, Math.sin(a) * A.r); A.m.rotation.set(t * 0.4 + A.ph, t * 0.3, 0); }
    else if (A.k === 'ship') { A.g.position.y = A.y + Math.sin(t * 0.35 + A.ph) * 0.4; A.g.rotation.z = Math.sin(t * 0.27 + A.ph) * 0.025; }
  }
}
function cirrusSkyAnchor() { SkyShader.uniforms.uSea.value.set(camera.position.y + STL.seaDepth, camera.position.x, camera.position.z, ATMO_CIRRUS.sky.sea[3]); }

/* ---------- Ambience: big high-altitude sun, deep sky, sea of clouds ---------- */
const ATMO_CIRRUS = Object.assign({}, ATMO_DEFAULT, {
  // high noon above the clouds (November 2026; dawn with a photographed sky until then): white sun high in the east (to the side for both
  // camps, short shadows that fall west), computed sky of a deep saturated blue that pales toward the horizon, a few thin cirrus wisps,
  // bright white sea of clouds with blue gaps onto the depths, very clear air (thin blue-white fog, little glow in the haze);
  // a softened sun halo and a restrained bloom so the planks and the clouds do not burn out; the ambient light stays high enough
  // for a soldier in the shade to read
  sun: [0.36, 0.9, 0.12], sunColor: 0xfff8f0, sunI: 2.55, vmSun: 0xfff8f0,
  fog: [0.7, 0.8, 0.93], fogD: 0.0013, fogSun: 0.16,
  hemi: [0xa0c0f0, 0xc8d0d8, 0.58], vmHemi: [0xa8c0f0, 0xc0c8d0],
  sky: {
    zen: [0.012, 0.075, 0.38], mid: [0.08, 0.26, 0.7], hor: [0.6, 0.76, 0.96], gnd: [0.2, 0.34, 0.56],
    glow: [0.45, 0.45, 0.42], halo: [0.65, 0.65, 0.62], disk: [30, 28, 24], cloudLo: [0.52, 0.6, 0.74], cloudHi: [1.25, 1.24, 1.2], cloud: [0.6, 0.9, 0.35],
    ridge: [0, 0, 0], ridgeSnow: [1, 1, 1], ridgeRock: [0.5, 0.5, 0.5], volc: [0, 0, 0, 0], plume: [0, 0, 0, 0], erupt: [0, 0, 0, 0],
    sea: [STL.seaDepth, 0, 0, 0.42],
  },
  envGround: 0xd0d4dc, hdri: 'sky',
  bounce: [1.1, 1.08, 1.02], dust: [0.76, 0.74, 0.7], motes: [1.15, 1.12, 1.05],
  grade: { lo: [0.95, 0.99, 1.06], hi: [1.04, 1.02, 0.97], exp: 0.8, con: 1.1, sat: 1.06 }, rays: [1.0, 0.97, 0.9],
  impact: [0.5, 0.46, 0.38], wind: [520, 0.09],
  bloom: [0.2, 0.5, 1.5], aoFloor: 0.38, raysThr: 2.0, raysCap: 6, satExp: 0.88,
});

MAP_DEFS.cirrus = {
  type: 'open', // large and open (islands, long views from one bridge to the other): README "Map design rules"
  void: { kill: -14 }, // floating islands: no ground outside the islands, you die 14 m below their top (VOID, 02-map.js)
  bounds: { x0: -41, x1: 41, z0: -59, z1: 59 },
  // CC0 photos: in addition to wood and stone, the cliff rock and the ground layers (they replace the procedural surfaces of the same
  // name for Cirrus only)
  textures: ['wood', 'stone', 'strata', 'lawn', 'dirt', 'flagstone', 'humus', 'canvas', 'burlap', 'timber', 'bark'],
  surfaces: CIRRUS_SURFACES,
  // recorded ambience (05c-ambiance.js, amb_cirrus pack): summit wind, its gusts; the ropes and planks of the bridges that
  // creak (near a bridge), buzzards crying far off in the void, a canvas that flaps
  sound: { pack: 'amb_cirrus', bed: 0.5, spots: [
    { id: 'a_gust', every: [7, 16], gain: 0.5, dist: [4, 12], y: [3, 8] },
    { id: 'a_creak', every: [8, 20], gain: 0.35, at: () => stCreakAt(), ref: 5 },
    { id: 'a_bird', every: [30, 70], gain: 0.25, dist: [60, 120], y: [-10, 30], ref: 20, roll: 0.8 },
    { id: 'a_flap', every: [14, 32], gain: 0.25, dist: [6, 20], y: [1, 4] },
  ] },
  kit: () => cirrusKit(),
  materials: (M) => makeCirrusMaterials(M),
  art: { cam: [-50, 20, 54], look: [0, 0, 6], fov: 50 }, // the archipelago seen from above, above the sea of clouds
  // grass blades on the top of the islands (02nb-lawn.js): dense wild meadow (120 blades per m²), taller far from the paths, bent by the wind
  // at altitude; nothing on the airship dock or under the tents (their canvas goes down farther than their collision), and only where the
  // lawn shows: the ground blends its layers according to the height of their textures, a path (earth and pebbles) or paving shows up
  // as soon as it weighs a quarter of the blend, the humus a third (groundMat); the distribution is read smoothed
  grass: {
    dens: 120,
    density: (x, z) => {
      if (stCut(x, z)) return 0; // rounded corners of the islands (stRoundLoop)
      if ((Math.abs(x) < 6.4 && Math.abs(z) > 52.2) || (Math.abs(Math.abs(x) - 12.4) < 1.9 && Math.abs(Math.abs(z) - 50.5) < 2.4)) return 0;
      const a = stSplatL(0, x, z); if (a >= 0.18) return 0;
      const b = stSplatL(1, x, z); if (b >= 0.14) return 0;
      const c = stSplatL(2, x, z); return c >= 0.12 ? 0 : (1 - smoothstep(0.05, 0.18, a)) * (1 - smoothstep(0.04, 0.14, b)) * (1 - smoothstep(0.03, 0.12, c));
    },
    height: (x, z, r) => (0.4 + 0.32 * r) * (0.8 + 0.4 * (0.5 + 0.5 * Math.sin(x * 0.23 + Math.sin(z * 0.19) * 2.1))) * (1 - 0.35 * smoothstep(0, 0.18, stSplatL(0, x, z))), // shorter at the edge of the paths (trampled)
    colors: [[0.08, 0.17, 0.035], [0.3, 0.46, 0.1], [0.52, 0.5, 0.24]],
    wind: [0.82, -0.57, 0.55], width: 0.012, amb: 0.4, seed: 7171,
  },
  landmarks: [[0, STL.crystal.y, 0, 'crystal'], [-31.5, 10.5, 0.5, 'lighthouse']],
  splat: { x0: -42, z0: -60, w: 84, d: 120, ppm: 3 },
  far: 700,
  build() { bendInit(MAP); cirrusLevel(); }, // flexibility field: soldiers flatten the grass and foliage
  after() { cirrusSkyAnchor(); },
  update(t, dt) { floraUpdate(t, dt); stAnimate(t); cirrusSkyAnchor(); },
  unload() { bendClear(); stCrystalTexFree(); STR.anim = []; STR.bridgeRects = null; STR.splat = null; SkyShader.uniforms.uSea.value.set(0, 0, 0, 0); },
  // on either side of the Rock: none sees the middle of the Rotunda (its stele) or the Sanctuary (standing stones, spires), and since
  // November 2026 few see the point of their own base (A or C, behind the ruined walls)
  spawns: [[-4.5, 45.5], [-7.5, 45.5], [-3.5, 47.5], [-6.5, 47.5], [-9.5, 47.5], [-4.5, 49.5], [-7.5, 49.5], [0.5, 47.5], [-1.5, 49.5], [2.5, 49.5], [4.5, 45.5], [7.5, 45.5], [5.5, 47.5], [8.5, 47.5], [6.5, 49.5]],
  poi: [
    [-24.5, 0, 23.5, 'L'], [-24.5, 0, -23.5, 'L'], [-31.5, 4, 26.5, 'L', 1], [-31.5, 4, -26.5, 'L', 1], [-26.5, 0, 5, 'L'], [-26.5, 0, -5, 'L'], [-35.5, 3, 0.5, 'L', 1], [-24, 0, 0.5, 'L'],
    [-2.5, 0, 24.8, 'M'], [-2.5, 0, -24.8, 'M'], [-4.5, 0, 0.5, 'M', 1], [5.5, 0, 0.5, 'M', 1], [0.5, 0, 13.5, 'M'], [0.5, 0, -13.5, 'M'], // (Rotunda: beside its middle stele, on the base bridge's side)
    [23.5, 0, 24.5, 'E'], [23.5, 0, -24.5, 'E'], [32.5, 2.6, 24.5, 'E', 1], [32.5, 2.6, -24.5, 'E', 1], [27, 0, 4, 'E'], [27, 0, -4, 'E'], [30.5, 0, 0.5, 'E'], [33.6, 3, 0.5, 'E', 1],
  ],
  dom: [[-14.5, 42.5], [0.5, 0], [23, -42.5]], // placed by the owner with the zones tool (?tool=zones, October 2026)
  mecha: [[-24.5, -23], [24, 23.5], [-23.5, 0.5], [27, 0]], // mech drop zones (08f-mecha.js, mnavZones), placed the same way
  lane: (x) => (x < -14 ? 'L' : x > 14 ? 'E' : 'M'),
  sniper: [-31.5, 4, 26.5],
  coverZ: 44,
  heli: [34, 50],
  cam: 58,
  surface: (p) => stSurface(p),
  zones: [
    [_t('Airship dock'), -8, 8, 52, 59], [_t('Airship dock'), -8, 8, -59, -52],
    [_t('Alpha Base'), -23, 31, 37.5, 59], [_t('Bravo Base'), -23, 31, -59, -37.5],
    [_t('Lookout'), -35, -15, 16, 31], [_t('Lookout'), -35, -15, -31, -16],
    [_t('Rotunda'), -8, 8, 17, 31], [_t('Rotunda'), -8, 8, -31, -17],
    [_t('Ruins'), 15, 37, 15, 31], [_t('Ruins'), 15, 37, -31, -15],
    [_t('Lighthouse'), -39, -19, -10, 10], [_t('Sanctuary'), -12, 12, -10, 10], [_t('Grove'), 19, 39, -10, 10],
    [_t('Suspension bridge'), -41, 41, -59, 59],
  ],
  atmo: ATMO_CIRRUS, // computed sky (no photographed sky: above the sea of clouds, the noon sky is clear)
};
