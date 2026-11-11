/* ==========================================================================
   JUNGLE OUTPOST, the jungle outside the fence (plants: 02p-plants.js, Floralia's library; rocks: PF.rockG, 02r-greenhouse.js).
   - Walkable network (OPJ): the cleared strip along the fence, the spawn clearings (north for Alpha, south for Bravo), the dirt track to
     each gate, the trails that leave each clearing by its two ends (one to the corner cut and down the west side to the breach, one down
     the east side to the other breach), a shorter branch from the clearing's south-west edge to the fence strip, and a few clearings
     beside them. The track and the trails bend: no straight line of sight runs along
     them from the compound to a clearing.
   - Everything else in the play area is solid jungle: leaf masses (broad veined leaves from the ground up, a banana or elephant-ear leaf
     in their skirt, banana plants, elephant ears, fan palms and ferns at their edge), 4.4 to 5.6 m high. Their collision is one raster
     (opjSolid): every 0.5 m cell farther than 0.5 m from the walkable network stops soldiers, shots and sight up to 4.2 m, merged into
     boxes (no slit between two masses, no gap a shot slips through); the masses hide the spawns from the guard tower and from the yard.
   - Above them, the skyline (sheet 4: the tree line crosses above the building's roof): a mid-storey of 7 to 8 m trees and palms right
     behind the fence strips, canopy trees of 16 to 19 m and tall coconut palms 9 to 15 m out, on the three sides of each half.
   - In the open: canopy trees with rounded crowns and coconut palms (0.38 m stipes, crowns 6 to 7 m wide), fallen logs and mossy rocks
     (cover), ferns, elephant ears, fan palms, grass; vines climbing some fence panels.
   - Out of bounds: the jungle wall (leaf masses, tall trees and palms, no collision), then the canopy, a bumpy leafy surface out to the
     horizon, and a ring of rounded forested hills veiled by the haze.
   - The leaves: one atlas drawn at load (no image to download): a twig of broad leaves, two pinnate palm fronds, banana, elephant ear,
     fan palm, fern and vine sprites in dark desaturated olive, varied leaf to leaf, darker bases.
   Cost: the masses are leaf cards only (a trunk inside them is never seen); deep in the jungle and beyond the bounds they cast no shadow
   (detail class 1: drawn once, not in the shadow cascades), like the canopy, the far trees and the hills.
   Mirrored north-south like the rest of the map; the random draws are reproducible (fixed seeds).
   ========================================================================== */
/* Walkable network of the Alpha half (z > 0, mirrored): paths [[x, z], ...] with their half-width, clearings [x, z, rx, rz] */
/* (the gate road: 12 m straight out of the gate between two walls of jungle, then a hairpin east and back west into the spawn clearing: no
   line of sight runs along it from the gate into the clearing) */
const OPJ_TRACK = [[6, 21], [6.2, 27], [6.3, 33.0], [12.5, 35.0], [3.4, 40.4], [3.2, 51]];
const OPJ_ROAD = [[5.6, 21], [5.75, 27], [5.8, 31.5]]; // (its first 10.5 m: 5.2 m wide, the gate's width; its east edge, the bend's inner side, where it was)
const OPJ_CUTPATH = [[-7.0, 21], [-7.0, 25.0], [-7.4, 30.0], [-4.4, 33.4], [0.2, 34.2], [0.6, 39.6]];
const OPJ = {
  paths: [
    [[[-25.4, 22.5], [25.4, 22.5]], 1.3], // cleared strip along the north fence
    [[[-24.5, 0], [-24.5, 22.5]], 1.3], [[[24.5, 0], [24.5, 22.5]], 1.3], // strips along the side fences
    [OPJ_TRACK, 1.8], [OPJ_ROAD, 2.6], // dirt road to the gate: straight out (4.4 m wide), then a bend east across the lines of sight from the gate and the tower
    [OPJ_CUTPATH, 1.6], // path from the middle cut: north, then east along the clearing (a wall of jungle between them), then a short way north into it
    // west and east trails: to the fence strip (corner cut), then down the side in wide zigzags (no long line of sight along them) to the breach and on
    [[[-21.8, 44.0], [-26.4, 38.6], [-27.4, 34.2], [-24.6, 29.6], [-24.5, 22.5]], 1.6], [[[-27.4, 34.2], [-32.0, 29.6], [-27.2, 24.0], [-32.2, 18.6], [-27.4, 13.9], [-22.5, 13.9]], 1.8],
    [[[-12.0, 39.8], [-20.5, 35.0], [-24.6, 29.6]], 1.5], // (a shorter way from the clearing's south-west edge down to the fence strip)
    [[[-27.4, 13.9], [-32.4, 8.6], [-27.4, 3.4], [-29.6, 0]], 1.8],
    [[[20.8, 44.0], [26.4, 38.6], [27.4, 34.2], [24.6, 29.6], [24.5, 22.5]], 1.6], [[[27.4, 34.2], [32.0, 29.6], [27.2, 24.0], [32.2, 18.6], [27.4, 13.9], [22.5, 13.9]], 1.8],
    [[[27.4, 13.9], [32.4, 8.6], [27.4, 3.4], [29.6, 0]], 1.8],
  ],
  clears: [[-1, 44.0, 23.0, 5.2], [-32.0, 18.6, 2.4, 2.4], [32.0, 18.6, 2.4, 2.4], [-32.2, 8.6, 2.4, 2.4], [32.2, 8.6, 2.4, 2.4]], // (the spawn clearing; small round ones at the tips of the zigzags: no bay beyond a tip)
};
/* Signed distance to the walkable network (negative inside a path or a clearing), for both halves */
function opjWalk(x, z) {
  const az = Math.abs(z); let d = 1e9;
  for (const [P, w] of OPJ.paths) for (let i = 0; i < P.length - 1; i++) {
    const [ax, aa] = P[i], [bx, bb] = P[i + 1], dx = bx - ax, dz = bb - aa, t = clamp(((x - ax) * dx + (az - aa) * dz) / (dx * dx + dz * dz), 0, 1);
    d = Math.min(d, hyp(x - ax - dx * t, az - aa - dz * t) - w);
  }
  for (const [cx, cz, rx, rz] of OPJ.clears) { const q = hyp((x - cx) / rx, (az - cz) / rz); d = Math.min(d, (q - 1) * Math.min(rx, rz)); }
  return d;
}
/* Distance to the gate road's first 12 m (both halves) */
function opjRoadD(x, z) { let d = 1e9; const az = Math.abs(z); for (let i = 0; i < OPJ_ROAD.length - 1; i++) { const [ax, aa] = OPJ_ROAD[i], [bx, bb] = OPJ_ROAD[i + 1], dx = bx - ax, dz = bb - aa, t = clamp(((x - ax) * dx + (az - aa) * dz) / (dx * dx + dz * dz), 0, 1); d = Math.min(d, hyp(x - ax - dx * t, az - aa - dz * t)); } return d; }
const opjInside = (x, z, m = 0) => Math.abs(x) < OP_FENCE.x1 + m && Math.abs(z) < OP_FENCE.z1 + m;
/* Solid jungle: farther than this from the walkable network (cell center), height of its collision */
const OPJ_SOLID = { edge: 0.5, h: 4.2, cell: 0.5 };
const opjSolidAt = (x, z) => !opjInside(x, z, 0.5) && opjWalk(x, z) > OPJ_SOLID.edge;

/* ---------- The jungle's leaves: a photo atlas (assets/fx/opLeaves.webp, 2048 x 2048 with alpha, pack fx_opLeaves) ---------- */
/* Eight photographed cut-outs packed by tools/art/process.py (leaves; its LEAF_CELLS table is this one in pixels): two clumps of small
   leaves (the masses and the crowns: a leaf about 0.2 m on a 1.6 m card), two side-view palm fronds (base on the left, the rachis on
   the middle line; the second drier, its leaflets on the other side), a banana leaf, an elephant ear, a fan palm leaf, a fern frond (base
   at the bottom of their cell) and a vine (hung from the top). No outline, no drawn vein: the photo's own; the scenery tints them by
   vertex and the leaf lighting adds the sun through them. Loaded when the map starts, in the meantime (and if the pack is missing)
   soft olive shapes in the same cells */
const OPJ_LEAF = { twig: [0, 0, 0.5, 0.5], twigB: [0.5, 0, 0.5, 0.5], palm: [0, 0.5, 0.5, 0.25], palm2: [0.5, 0.75, 0.5, 0.25], ear: [0.5, 0.5, 0.25, 0.25],
  fan: [0.75, 0.5, 0.25, 0.25], banana: [0, 0.75, 0.15625, 0.25], fern: [0.15625, 0.75, 0.1875, 0.25], vine: [0.34375, 0.75, 0.0625, 0.25] };
LIVING.add('opyLeaf');
function opjLeafAtlas() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = 'rgb(84,96,58)';
  for (const [u, v, du, dv] of Object.values(OPJ_LEAF)) { g.beginPath(); g.ellipse((u + du / 2) * 256, (v + dv / 2) * 256, du * 110, dv * 110, 0, 0, TAU); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; t.flipY = false;
  fetchTexPack('fx_opLeaves').then((d) => d && new THREE.ImageLoader().load(d.map, (img) => { t.image = img; t.needsUpdate = true; }));
  return { map: t, normal: null };
}
// the sprites in the herbarium's registry (PF.rosette, PF.clump and PF.tree read their regions there), the jungle's tree kinds; tints
// (multipliers on the photo sprites): about 15 % lighter or darker, some yellower, some bluer and greyer
Object.assign(HERB, { opjTwig: OPJ_LEAF.twig, opjTwigB: OPJ_LEAF.twigB, opjEar: OPJ_LEAF.ear, opjFan: OPJ_LEAF.fan, opjFern: OPJ_LEAF.fern, opjVine: OPJ_LEAF.vine, opjBanana: OPJ_LEAF.banana });
const OPJ_TINT = [[0.86, 0.86, 0.86], [0.76, 0.78, 0.74], [0.88, 0.85, 0.74], [0.74, 0.79, 0.8], [0.82, 0.85, 0.79], [0.7, 0.72, 0.68]];
const OPJ_TINT_LOW = [0.4, 0.44, 0.34]; // (low plants in the open, in full sun: duller, olive)
TREE_KINDS.opj = { reg: 'opjTwig', mat: 'opyLeaf', tints: OPJ_TINT };
TREE_KINDS.opjB = { reg: 'opjTwigB', mat: 'opyLeaf', tints: OPJ_TINT };

/* ---------- Leaf masses ---------- */
/* Leaf mass r (radius), h (height): an ellipsoid sitting on the ground (squashed at random: no round outline), its lower half widened to a
   cylinder (a skirt of leaves down to the ground; now and then a broad banana or elephant-ear leaf in it). Its cards: half lie on its surface
   at a random tilt (the clumped outline, no pinwheel from any side, no lettuce head from above), half are twigs radiating from inside; one
   in four darker (the shade inside the foliage); deep: fewer, larger cards and no shadow (deep in the jungle, beyond the bounds); near
   (within 8 m of a path or the fence): only the clumps of small leaves, on cards of 2 m at most (a leaf about 0.25 m), and half the outer
   cards without shadow (a dappled shadow on the ground, not a black blob). Cores and bases shaded, never black */
PF.opjMass = (r, h, seed, deep, near) => prefab(`opjMass_${r}_${h}_${seed}_${deep ? 1 : 0}_${near ? 1 : 0}`, (M) => {
  const R = rngOf(seed * 977 + 13 + Math.round(r * 10) + h * 101), rr = r, ry = h * 0.5, cy = h * 0.47, ex = R.range(0.8, 1.2), ez = R.range(0.8, 1.2);
  const n = Math.round(deep ? 11 + rr * rr * 3 : Math.max(27, 17 + rr * rr * 5)), crown = [0, cy, 0, rr / ry]; // (a small mass stays dense: no gap to see through)
  M.save();
  for (let i = 0; i < n; i++) {
    let dx, dy, dz, d; do { dx = R.range(-1, 1); dy = R.range(-1, 1); dz = R.range(-1, 1); d = hyp3(dx, dy, dz); } while (d > 1 || d < 0.2);
    dx /= d; dy /= d; dz /= d; if (dy < -0.5) dy = -0.5 + (dy + 0.5) * 0.3;
    if (dy < 0.1) { const hz = hyp(dx, dz) || 1; dx /= hz; dz /= hz; } // (the lower half on a cylinder: a skirt of leaves down to the ground, no gap at the foot)
    const tang = R() < 0.5, f0 = tang ? R.range(0.7, 1.0) : R.range(0.3, 0.68), sz0 = R.range(1.0, 1.4) * clamp(0.3 * rr + 0.7, 1.2, 2.2) * (deep ? 1.35 : 1.16), sz = near ? Math.min(sz0, 2.0) : sz0;
    const k = dy < 0.1 && R() < 0.22 ? (R() < 0.5 ? 'banana' : 'ear') : near || R() < 0.6 ? 'twig' : 'twigB', asp = k === 'banana' ? 0.6 : 1, ln = k === 'banana' ? 1.25 : 1;
    const bx = dx * rr * ex * f0, by = cy + dy * ry * f0, bz = dz * rr * ez * f0;
    let L, W, l0 = 0;
    if (tang) { // on the surface: the card's normal near the radial direction, tilted up to about 40 degrees, centered on its point
      const nn = [dx + R.range(-0.45, 0.45), dy + 0.25 + R.range(-0.45, 0.45), dz + R.range(-0.45, 0.45)], nl = hyp3(...nn) || 1, N = [nn[0] / nl, nn[1] / nl, nn[2] / nl];
      const [u, v] = leafBasis(N), rot = R() * TAU, cs = Math.cos(rot), sn = Math.sin(rot);
      L = [u[0] * cs + v[0] * sn, u[1] * cs + v[1] * sn, u[2] * cs + v[2] * sn]; W = [-u[0] * sn + v[0] * cs, -u[1] * sn + v[1] * cs, -u[2] * sn + v[2] * cs]; l0 = -0.5;
    } else {
      const ax = [dx * rr, dy * ry - 0.25 * ry * R(), dz * rr], al = Math.hypot(...ax) || 1; L = [ax[0] / al, ax[1] / al, ax[2] / al];
      const [u, v] = leafBasis(L), rot = R() * TAU, cs = Math.cos(rot), sn = Math.sin(rot); W = [u[0] * cs + v[0] * sn, u[1] * cs + v[1] * sn, u[2] * cs + v[2] * sn];
    }
    const hw = sz * 0.5 * asp, P = (w, l) => [bx + W[0] * w * hw + L[0] * (l + l0) * sz * ln, Math.max(0.02, by + W[1] * w * hw + L[1] * (l + l0) * sz * ln), bz + W[2] * w * hw + L[2] * (l + l0) * sz * ln];
    const t = R.pick(OPJ_TINT), dark = R() < 0.25 ? 0.7 : 1; M.color([t[0] * dark, t[1] * dark, t[2] * dark]);
    M.cls = deep || (near && tang && R() < 0.5) ? 1 : 0;
    const aoB = lerp(0.58, 0.72, f0), aoT = lerp(0.76, 1, clamp(d * 0.4 + f0 + 0.3, 0.3, 1));
    leafQuad(M, 'opyLeaf', [P(-1, 0), P(1, 0), P(1, 1), P(-1, 1)], OPJ_LEAF[k], { crown, w: [0.2, 0.2, 0.75, 0.75], ao: [aoB, aoB, aoT, aoT] });
  }
  // the dense core of a mass on a trail side (no shadow): a closed ring of shaded leaf cards at body height, what shows between the outer
  // cards is foliage, never daylight
  if (!deep) {
    M.cls = 1; const yT = Math.min(h * 0.78, 2.8), rc = rr * 0.72, hw = rr * 0.33;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU + 0.2, cx = Math.cos(a) * rc * ex, cz = Math.sin(a) * rc * ez, tx = -Math.sin(a) * hw, tz = Math.cos(a) * hw, t = R.pick(OPJ_TINT);
      M.color([t[0] * 0.8, t[1] * 0.8, t[2] * 0.8]); leafQuad(M, 'opyLeaf', [[cx - tx, -0.05, cz - tz], [cx + tx, -0.05, cz + tz], [cx + tx, yT, cz + tz], [cx - tx, yT, cz - tz]], OPJ_LEAF.twig, { crown, w: [0, 0, 0.3, 0.3], ao: [0.52, 0.52, 0.66, 0.66] });
    }
  }
  M.restore();
  M.occ(-rr * 0.8, rr * 0.8, 0.3, h * 0.95, -rr * 0.8, rr * 0.8, 0.55);
});
/* Broadleaf canopy tree (h, crown radius r, bare trunk th; lite: no branches, fewer cards): a leaning trunk forking into three to five
   clumps of foliage round the top, each a small mass of tilted and radiating cards (one in four darker): a broken, clumpy crown */
PF.opjTree = (h, r, seed, th, lite) => prefab(`opjTree_${h}_${r}_${seed}_${th}_${lite ? 1 : 0}`, (M) => {
  const R = rngOf(seed * 577 + 41 + h * 13), lean = R.range(0.2, 0.7), ld = R() * TAU, lx = Math.cos(ld) * lean, lz = Math.sin(ld) * lean, tr = 0.14 + h * 0.017;
  const path = [], seg = lite ? 4 : 8; for (let i = 0; i <= seg; i++) { const t = i / seg; path.push([lx * t * t, t * th, lz * t * t]); }
  M.save().color([0.6, 0.56, 0.5]).local(1); M.aoFn = (x, y) => lerp(0.6, 1, smoothstep(0, 1.6, y));
  M.sweep('bark', circleShape(1, lite ? 5 : 7), path, { scale: (t) => tr * (1 + 0.9 * Math.pow(1 - t, 6)) * (1 - 0.35 * t), uAround: 0.7 }); M.aoFn = null;
  const nC = 3 + Math.floor(R() * 3), cl = [];
  for (let c = 0; c < nC; c++) {
    const a = (c / nC) * TAU + R.range(-0.4, 0.4), d = r * R.range(0.25, 0.55), cr = r * R.range(0.42, 0.62), cyy = th + (h - th) * R.range(0.4, 0.62);
    cl.push([lx + Math.cos(a) * d, cyy, lz + Math.sin(a) * d, cr]);
    if (!lite) M.tube('bark', tr * 0.4, [[lx * 0.9, th * 0.92, lz * 0.9], [lx + Math.cos(a) * d * 0.6, cyy - cr * 0.4, lz + Math.sin(a) * d * 0.6]], 4, { scale: (t) => 1 - t * 0.6 });
  }
  M.restore();
  M.save(); M.cls = 0;
  const crown = [lx, th + (h - th) * 0.5, lz, 1.2];
  for (const [cx, cyy, cz, cr] of cl) {
    const n = Math.round((lite ? 10 : 16) + cr * cr * 2.2);
    for (let i = 0; i < n; i++) {
      let dx, dy, dz, d; do { dx = R.range(-1, 1); dy = R.range(-1, 1); dz = R.range(-1, 1); d = hyp3(dx, dy, dz); } while (d > 1 || d < 0.25);
      dx /= d; dy /= d; dz /= d; dy *= 0.75;
      const tang = R() < 0.55, f0 = tang ? R.range(0.75, 1.05) : R.range(0.35, 0.7), sz = R.range(1.5, 2.2) * (lite ? 1.25 : 1);
      const bx = cx + dx * cr * f0, by = cyy + dy * cr * 0.8 * f0, bz = cz + dz * cr * f0;
      let L, W, l0 = 0;
      if (tang) { const nn = [dx + R.range(-0.5, 0.5), dy + 0.3 + R.range(-0.5, 0.5), dz + R.range(-0.5, 0.5)], nl = hyp3(...nn) || 1, [u, v] = leafBasis([nn[0] / nl, nn[1] / nl, nn[2] / nl]), rot = R() * TAU, cs = Math.cos(rot), sn = Math.sin(rot); L = [u[0] * cs + v[0] * sn, u[1] * cs + v[1] * sn, u[2] * cs + v[2] * sn]; W = [-u[0] * sn + v[0] * cs, -u[1] * sn + v[1] * cs, -u[2] * sn + v[2] * cs]; l0 = -0.5; }
      else { L = [dx, dy - 0.2, dz]; const ll = hyp3(...L) || 1; L = [L[0] / ll, L[1] / ll, L[2] / ll]; const [u, v] = leafBasis(L), rot = R() * TAU; W = [u[0] * Math.cos(rot) + v[0] * Math.sin(rot), u[1] * Math.cos(rot) + v[1] * Math.sin(rot), u[2] * Math.cos(rot) + v[2] * Math.sin(rot)]; }
      const P = (w, l) => [bx + W[0] * w * sz * 0.5 + L[0] * (l + l0) * sz, by + W[1] * w * sz * 0.5 + L[1] * (l + l0) * sz, bz + W[2] * w * sz * 0.5 + L[2] * (l + l0) * sz];
      const t = R.pick(OPJ_TINT), dark = R() < 0.25 ? 0.7 : 1; M.color([t[0] * dark, t[1] * dark, t[2] * dark]);
      const aoB = lerp(0.55, 0.72, f0), aoT = lerp(0.75, 1, clamp(dy * 0.5 + f0, 0.3, 1));
      leafQuad(M, 'opyLeaf', [P(-1, 0), P(1, 0), P(1, 1), P(-1, 1)], OPJ_LEAF[R() < 0.6 ? 'twig' : 'twigB'], { crown, w: [0.3, 0.3, 0.9, 0.9], ao: [aoB, aoB, aoT, aoT] });
    }
  }
  M.restore();
  M.occ(lx - r * 0.8, lx + r * 0.8, th + 0.5, h, lz - r * 0.8, lz + r * 0.8, 0.5);
  M.col(-tr * 0.8, tr * 0.8, 0, th + 0.6, -tr * 0.8, tr * 0.8, 'wood');
});

/* Bare trunk of the second row (h m): the stem of a tree whose crown is lost in the canopy above, a fork near the top */
PF.opjTrunk = (h, seed) => prefab(`opjTrunk_${h}_${seed}`, (M) => {
  const R = rngOf(seed * 61 + 3), lx = R.range(-0.4, 0.4), lz = R.range(-0.4, 0.4), path = []; for (let i = 0; i <= 4; i++) { const t = i / 4; path.push([lx * t * t, t * h, lz * t * t]); }
  M.save().color([0.46, 0.43, 0.38]).local(1); M.aoFn = (x, y) => lerp(0.5, 0.9, smoothstep(0, 3, y));
  M.sweep('bark', circleShape(1, 5), path, { scale: (t) => R.range(0.13, 0.18) * (1 + 0.6 * Math.pow(1 - t, 5)) * (1 - 0.3 * t), uAround: 0.7 }); M.aoFn = null;
  for (const a of [R() * TAU, R() * TAU]) M.tube('bark', 0.06, [[lx, h * 0.8, lz], [lx + Math.cos(a) * 1.2, h + 0.4, lz + Math.sin(a) * 1.2]], 3, { scale: (t) => 1 - t * 0.6 });
  M.restore();
});

/* ---------- Plants of the jungle's edge ---------- */
/* Banana plant: olive false trunk, large torn leaves that droop (PF.banana on the jungle's sprites) */
PF.opjBanana = (h = 3.2, seed = 1, leaf = 0) => prefab(`opjBanana_${h}_${seed}_${leaf}`, (M) => {
  const R = rngOf(seed * 29 + 3), lx = R.range(-0.2, 0.2), lz = R.range(-0.2, 0.2), path = [];
  for (let i = 0; i <= 4; i++) { const t = i / 4; path.push([lx * t * t, t * h, lz * t * t]); }
  M.save().color([0.46, 0.48, 0.3]).local(1); M.aoFn = (x, y) => lerp(0.55, 1, smoothstep(0, 1.2, y));
  M.sweep('bark', circleShape(1, 6), path, { scale: (t) => 0.13 * (1.15 - 0.4 * t), uAround: 0.5 }); M.aoFn = null; M.restore();
  const top = [lx, h, lz]; M.save().cls = 0;
  for (let i = 0; i < 9; i++) {
    const az = (i / 9) * TAU * 1.9 + R() * 0.4, e0 = R.range(0.55, 1.2), L = leaf ? leaf * R.range(0.85, 1.15) : R.range(2.2, 3.0);
    M.color(i === 8 ? [0.72, 0.6, 0.4] : R.pick(OPJ_TINT)); // (one old leaf drying out)
    frondStrip(M, 'opyLeaf', OPJ_LEAF.banana, frondPath(L, e0, R.range(0.5, 1.4), az, 6, [top[0], top[1] - 0.1 - i * 0.04, top[2]]), (t) => L * 0.3 * (0.35 + 0.65 * Math.sin(Math.min(1, t * 1.0 + 0.08) * Math.PI)), R.range(0.0, 0.5), { w0: 0.1, wp: 1.0 });
  }
  M.restore();
  M.col(-0.14, 0.14, 0, h * 0.9, -0.14, 0.14, 'wood');
});
/* Ground fern: fronds that arch out from the crown and droop (PF.fern on the jungle's sprites), one in three darker */
PF.opjFern = (s = 1, seed = 1, n = 9) => prefab(`opjFern_${s}_${seed}_${n}`, (M) => {
  const R = rngOf(seed * 37 + 17); M.save().cls = 2;
  for (let i = 0; i < n; i++) {
    const az = (i / n) * TAU + R() * 0.5, e0 = R.range(0.7, 1.25), L = s * R.range(0.7, 1.15), t = R.pick(OPJ_TINT), dk = R() < 0.3 ? 0.75 : 1;
    M.color([t[0] * dk, t[1] * dk, t[2] * dk]);
    frondStrip(M, 'opyLeaf', OPJ_LEAF.fern, frondPath(L, e0, R.range(1.3, 2.1), az, 5), (t) => L * 0.36, R.range(0.1, 0.9), { w0: 0.05, wp: 1.1 });
  }
  M.restore();
});
/* Fan palm: a short ringed trunk, fan leaves on long stalks, held up and out, the old ones hanging */
PF.opjFan = (h = 1.8, seed = 1) => prefab(`opjFan_${h}_${seed}`, (M) => {
  const R = rngOf(seed * 89 + 7), path = [], lx = R.range(-0.15, 0.15), lz = R.range(-0.15, 0.15);
  for (let i = 0; i <= 4; i++) { const t = i / 4; path.push([lx * t * t, t * h, lz * t * t]); }
  M.save().color([0.5, 0.42, 0.32]).local(1); M.aoFn = (x, y) => lerp(0.55, 1, smoothstep(0, 1.0, y));
  M.sweep('bark', circleShape(1, 5), path, { scale: (t) => 0.12 * (1.1 - 0.3 * t), uAround: 0.5 }); M.aoFn = null;
  const top = [lx, h, lz], n = 10, tips = [];
  M.color([0.44, 0.44, 0.28]);
  for (let i = 0; i < n; i++) {
    const az = (i / n) * TAU + R() * 0.4, el = i < 3 ? R.range(-0.5, -0.1) : R.range(0.35, 1.0), pl = R.range(0.8, 1.3), d = [Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)];
    const tip = [top[0] + d[0] * pl, top[1] + d[1] * pl, top[2] + d[2] * pl]; tips.push([tip, d, az, i < 3]);
    M.tube('bark', 0.02, [[top[0], top[1] - 0.05, top[2]], tip], 3);
  }
  M.restore();
  M.save().cls = 0;
  for (const [B, d, az, old] of tips) {
    // the blade: the sprite's base at the stalk's tip, its axis continuing the stalk (lifted a little), seen face on from the side
    const s = R.range(1.0, 1.4), up = old ? -0.6 : 0.35, L = [d[0], d[1] + up, d[2]], l = hyp3(...L), A = [L[0] / l, L[1] / l, L[2] / l], Wd = [-Math.sin(az), 0, Math.cos(az)];
    const P = (w, t) => [B[0] + Wd[0] * w * s * 0.75 + A[0] * t * s, B[1] + A[1] * t * s, B[2] + Wd[2] * w * s * 0.75 + A[2] * t * s];
    M.color(old ? [0.7, 0.58, 0.38] : R.pick(OPJ_TINT));
    leafQuad(M, 'opyLeaf', [P(-1, 0), P(1, 0), P(1, 1), P(-1, 1)], OPJ_LEAF.fan, { up: 0.5, w: [0.3, 0.3, 1, 1], ao: [0.55, 0.55, 1, 1] });
  }
  M.restore();
  M.col(-0.12, 0.12, 0, h, -0.12, 0.12, 'wood');
});
/* A large plant for a trail side (banana, elephant ear, fan palm, fern), and a low one */
function opjEdgePlant(R, big) {
  const k = R(), sd = 1 + Math.floor(R() * 5);
  if (!big) return k < 0.55 ? PF.rosette('opjEar', 'opyLeaf', Math.round(R.range(0.9, 1.3) * 10) / 10, 6, sd, { lean: 0.6, tint: OPJ_TINT_LOW }) : PF.opjFern(Math.round(R.range(1.1, 1.6) * 10) / 10, sd, 8);
  return k < 0.34 ? PF.opjBanana(Math.round(R.range(2.8, 3.8) * 2) / 2, sd) : k < 0.6 ? PF.rosette('opjEar', 'opyLeaf', Math.round(R.range(1.3, 1.8) * 10) / 10, 7, sd, { lean: 0.6, tint: OPJ_TINT_LOW })
    : k < 0.82 ? PF.opjFan(Math.round(R.range(1.4, 2.6) * 2) / 2, sd) : PF.opjFern(Math.round(R.range(1.5, 2.0) * 10) / 10, sd, 10);
}
/* Placed masses (x, z, r) of the Alpha half: the filler only puts a mass where none covers the ground */
const OPJ_MASSES = [];
/* Leaf mass at (x, z) and its large plants at the edge (edge: on a trail side, turned toward it); deep: inside a mass or beyond the bounds;
   fill: a filler between the others (no shadow) */
function opjThicket(x, z, r, h, R, o = {}) {
  const kr = Math.round(r * 2) / 2, kh = Math.round(h * 2) / 2, seed = 1 + Math.floor(R() * 4);
  // (mz -1: the south copy is the true mirror of the north one, not the same mass turned)
  const near = o.near !== undefined ? o.near : opjWalk(x, z) - r < 8; // (small leaves only, within 8 m of a path or the fence)
  DECOR.save().move(x, -0.1, z).scl(1, 1, o.mz || 1).rotY(R() * TAU).put(PF.opjMass(kr, kh, seed, !!o.deep, near), Object.assign(o.fill ? { nocol: true, cls: 1 } : { nocol: true }, o.tint ? { tint: o.tint } : {})).restore(); // (fill: no shadow)
  // (the second row behind the edge: a bare trunk now and then, seen through the gaps of the lower plants in front)
  if (o.trunk) DECOR.place(PF.opjTrunk(Math.round(R.range(6, 9)), 1 + Math.floor(R() * 4)), x + R.range(-0.5, 0.5), 0, z + R.range(-0.5, 0.5), R() * TAU, { nocol: true, cls: 1 });
  // one large plant (banana, elephant ear, fan palm, fern) on a trail side about every other mass, and a low one (elephant ear, fern) on most
  const big = o.edge && R() < 0.45, low = o.edge && R() < 0.7;
  for (const i of [big ? 0 : -1, low ? 1 : -1]) {
    if (i < 0) continue;
    const a = o.toward !== undefined ? o.toward + R.range(-0.8, 0.8) : R() * TAU, d = r * R.range(0.65, 0.95), px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
    const pf = opjEdgePlant(R, !i);
    DECOR.place(pf, px, 0, pz, R() * TAU, { nocol: true });
  }
}

/* Solid jungle collision: cells of OPJ_SOLID.cell over the bounds (both halves), height per cell (0: open), plus extra discs [x, z, r, h]
   (the chicane shrubs in the fence strips); merged into boxes: runs of equal height along x, then equal runs on consecutive rows */
function opjSolid(discs) {
  const B = MAP_DEFS.outpost.bounds, c = OPJ_SOLID.cell, nx = Math.round((B.x1 - B.x0) / c), nz = Math.round((B.z1 - B.z0) / c), H = new Float32Array(nx * nz);
  const cx = (i) => B.x0 + (i + 0.5) * c, cz = (j) => B.z0 + (j + 0.5) * c;
  // (not in the last half meter before the bounds: they stop soldiers there, and a sliver of box would show through the leaves)
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) if (Math.abs(cx(i)) < B.x1 - 0.5 && Math.abs(cz(j)) < B.z1 - 0.5 && opjSolidAt(cx(i), cz(j))) H[j * nx + i] = OPJ_SOLID.h;
  for (const [x, z, r, h] of discs) for (let i = Math.max(0, Math.floor((x - r - B.x0) / c)); i <= Math.min(nx - 1, Math.floor((x + r - B.x0) / c)); i++) for (let j = Math.max(0, Math.floor((z - r - B.z0) / c)); j <= Math.min(nz - 1, Math.floor((z + r - B.z0) / c)); j++) {
    if (hyp(cx(i) - x, cz(j) - z) < r) H[j * nx + i] = Math.max(H[j * nx + i], h);
  }
  let open = new Map();
  const close = (b, j1) => DECOR.col(B.x0 + b.i0 * c, B.x0 + (b.i1 + 1) * c, 0, b.h, B.z0 + b.j0 * c, B.z0 + j1 * c, 'leaf');
  for (let j = 0; j <= nz; j++) {
    const next = new Map();
    if (j < nz) for (let i = 0; i < nx; ) {
      const h = H[j * nx + i]; if (!h) { i++; continue; }
      let k = i; while (k + 1 < nx && H[j * nx + k + 1] === h) k++;
      const key = i + ',' + k + ',' + h, b = open.get(key);
      if (b) { next.set(key, b); open.delete(key); } else next.set(key, { i0: i, i1: k, h, j0: j });
      i = k + 1;
    }
    for (const b of open.values()) close(b, j);
    open = next;
  }
}

/* Dense shrub (radius r, about 2.5 m) grown into the cleared strip along the fence: two of them, one against each edge a few meters apart,
   make a chicane that breaks the long lines of sight along the strip; its collision goes into the raster (returned disc) */
function opjShrub(x, z, r, seed) {
  DECOR.place(PF.opjMass(Math.round(r * 1.35 * 4) / 4, 3.0, 1 + (seed % 4), false, true), x, -0.05, z, seed * 1.7, { nocol: true });
  DECOR.place(PF.rosette('opjEar', 'opyLeaf', 1.2, 6, 1 + (seed % 5), { lean: 0.6, tint: OPJ_TINT_LOW }), x + r * 0.5, 0, z - r * 0.3, seed, { nocol: true });
  return [x, z, r * 0.7, 2.2]; // (well inside its leaves)
}

/* ---------- Open-ground cover ---------- */
/* Fallen log along angle a (like rotY), length L, radius rr: mossy trunk with a root plate at one end; collision in sections */
function opjLog(x, z, a, L, rr) {
  const M = DECOR, c = Math.cos(a), s = -Math.sin(a), P = [];
  for (let i = 0; i <= 6; i++) { const t = i / 6; P.push([x + c * (t - 0.5) * L, rr * 0.92 + Math.sin(t * 3 + x) * 0.03, z + s * (t - 0.5) * L]); }
  M.save().color([0.5, 0.48, 0.4]).local(1);
  M.sweep('bark', circleShape(1, 9), P, { scale: (t) => rr * (1 + 0.25 * Math.pow(1 - t, 6)) * (1 - 0.15 * t), uAround: 0.7 });
  M.color([0.36, 0.44, 0.24]); M.cls = 1; // moss along the top
  M.sweep('hedge', circleShape(1, 7), P.map((p) => [p[0], p[1] + rr * 0.55, p[2]]), { scale: () => rr * 0.55 });
  M.color([0.42, 0.36, 0.28]); M.cls = 0;
  M.save().move(P[0][0] - c * 0.1, rr * 0.95, P[0][2] - s * 0.1).rotY(a + Math.PI / 2).rotX(Math.PI / 2); M.cyl('bark', rr * 2.0, 0.25, 10, { r1: rr * 1.6 }); M.restore(); // root plate
  M.restore();
  const n = Math.max(1, Math.ceil(L / 1.4));
  for (let i = 0; i < n; i++) { const t0 = i / n - 0.5, t1 = (i + 1) / n - 0.5, xa = x + c * t0 * L, xb = x + c * t1 * L, za = z + s * t0 * L, zb = z + s * t1 * L, e = rr * 0.85; DECOR.col(Math.min(xa, xb) - e, Math.max(xa, xb) + e, 0, rr * 1.75, Math.min(za, zb) - e, Math.max(za, zb) + e, 'wood'); }
}
/* Mossy boulder (rx x ry x rz), its collision a box a little inside it */
function opjRock(x, z, rx, ry, rz, a, seed) {
  DECOR.place(PF.rockG(1 + (seed % 9), rx, ry, rz), x, -0.25 * ry, z, a, { nocol: true, tint: [0.47, 0.52, 0.43] });
  const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a)), ex = (rx * c + rz * s) * 0.72, ez = (rx * s + rz * c) * 0.72;
  DECOR.col(x - ex, x + ex, 0, ry * 1.25, z - ez, z + ez, 'concrete');
}
/* Coconut palm: a stipe about 0.38 m thick at the foot, leaning and curving; a crown 6 to 7 m wide of 14 pinnate fronds (upright,
   spreading, drooping) and two dead ones hanging brown; there are many of them, all of them seen from far away */
PF.opjPalm = (h = 10, seed = 1, kind = 'palm') => prefab(`opjPalm_${h}_${seed}_${kind}`, (M) => {
  const R = rngOf(seed * 71 + 5), lean = R.range(0.5, 1.5), ld = R() * TAU, lx = Math.cos(ld) * lean, lz = Math.sin(ld) * lean, path = [], N = 7;
  for (let i = 0; i <= N; i++) { const t = i / N; path.push([lx * t * t, t * h, lz * t * t]); }
  M.save().color([0.66, 0.62, 0.54]).local(1); M.aoFn = (x, y) => lerp(0.55, 1, smoothstep(0, 1.5, y));
  M.sweep('bark', circleShape(1, 7), path, { scale: (t) => 0.19 - 0.055 * t, uAround: 0.6 });
  M.save().move(0, -0.05, 0); M.cyl('bark', 0.32, 0.35, 7, { r1: 0.2 }); M.restore(); M.aoFn = null;
  const top = [lx, h, lz]; M.save().move(top[0], h - 0.45, top[2]); M.color([0.46, 0.4, 0.28]); M.cyl('bark', 0.16, 0.55, 7, { r1: 0.21 }); M.restore();
  M.restore();
  const n = 14, crownTop = [top[0], top[1] - 0.05, top[2]];
  M.save(); M.cls = 0;
  for (let i = 0; i < n + 2; i++) {
    const dead = i >= n, az = (i / n) * TAU * 2.4 + R() * 0.4, tier = dead ? 3 : i % 3;
    const e0 = [R.range(0.75, 1.0), R.range(0.3, 0.55), R.range(-0.05, 0.2), R.range(-1.0, -0.7)][tier], L = [R.range(2.9, 3.4), R.range(3.6, 4.1), R.range(3.5, 4.0), R.range(2.4, 2.9)][tier];
    const drop = [0.7, 1.15, 1.35, 0.4][tier];
    M.color(dead ? [0.66, 0.54, 0.36] : R.pick(OPJ_TINT));
    palmStrip(M, 'opyLeaf', OPJ_LEAF[dead || tier === 2 ? 'palm2' : kind], frondPath(L, e0, drop, az, 5, crownTop), (t) => (0.48 + 0.3 * Math.sin(Math.min(1, t * 1.15 + 0.08) * Math.PI)) * (dead ? 0.7 : 1), dead ? 0.25 : 0.55);
  }
  M.restore();
  M.occ(top[0] - 3, top[0] + 3, h - 1.2, h + 0.8, top[2] - 3, top[2] + 3, 0.35);
  M.col(-0.22, 0.22, 0, h * 0.7, -0.22, 0.22, 'wood');
});
/* Canopy tree (a rounded dense crown on a trunk of 4.5 to 6.5 m: no umbrella) or coconut palm; lite: beyond the bounds or inside a mass
   (no branches, larger and fewer cards) */
function opjTreePf(R, kind, lite) {
  return kind === 'palm' ? PF.opjPalm(R.range(9, 15) | 0, 1 + Math.floor(R() * 6), R() < 0.5 ? 'palm' : 'palm2')
    : PF.opjTree(Math.round(R.range(13, 18)), Math.round(R.range(4.2, 5.6) * 2) / 2, 1 + Math.floor(R() * 4), Math.round(R.range(4.5, 6.5)), lite);
}
/* Canopy out to the horizon: a bumpy leafy surface around the play area, from the foot of the jungle wall (hidden behind it) up to 9 to 15 m;
   no shadow (it is drawn once) */
function opjCanopy() {
  const M = DECOR, B = MAP_DEFS.outpost.bounds, ex = B.x1 + 11, ez = B.z1 + 11, L = 230;
  const hAt = (x, z) => {
    const d = Math.max(Math.abs(x) - ex, Math.abs(z) - ez), k = smoothstep(0, 9, d);
    return k * (10 + 2.5 * Math.sin(x * 0.21 + z * 0.13) + 2.0 * Math.sin(x * 0.07 - z * 0.19 + 1.3) + 1.5 * Math.sin(x * 0.53 + 0.7) * Math.sin(z * 0.47)) - 2 * (1 - k);
  };
  WORLD.force = 'far';
  M.save().color([0.42, 0.46, 0.34]).local(1); M.cls = 1;
  // four bands: west and east (full length), north and south (between them); finer near the wall, where the bumps are seen
  for (const [x0, x1, z0, z1] of [[-L, -ex, -L, L], [ex, L, -L, L], [-ex, ex, ez, L], [-ex, ex, -L, -ez]]) {
    const nu = Math.max(4, Math.round((x1 - x0) / 5)), nv = Math.max(4, Math.round((z1 - z0) / 5));
    M.surf('opjCanopy', nu, nv, (u, v) => { const x = lerp(x0, x1, u), z = lerp(z0, z1, v); return [x, hAt(x, z), z]; }, { uL: (x1 - x0) / 12.6, vL: (z1 - z0) / 12.6, flipN: true });
  }
  M.restore();
  WORLD.force = null;
}
/* Forested hills round the horizon (sheet 4: overlapping ridges in a blue-green haze, a bumpy tree line): three rings of ridges 120, 160
   and 205 m out (the haze takes about a third, a half and two thirds of them), each rolling at its own pace, its crest broken into
   tree crowns; and the near hill of sheet 4 hero (upper left, behind the tower): a rounded forested hill 175 m south-west, its top left
   of the tower and higher than its roof from the hero spot, covered in tree crowns 13 to 19 m across (bumps, darker in the hollows
   between them). All on the clumpy canopy surface (no fine grain: no speckle at any distance); no shadow */
function opjHills() {
  const M = DECOR, ring = (r0, r1, base, amp, ph, col) => {
    const segs = Math.round((TAU * r1) / 3.6), k1 = Math.round(r1 / 4.6), k2 = Math.round(r1 / 2.9), crown = (a) => 2.2 * Math.pow(Math.abs(Math.sin(a * k1 + ph)), 0.6) + 1.2 * Math.pow(Math.abs(Math.sin(a * k2 + 1.7 * ph)), 0.8); // (whole numbers of crowns round the ring: no seam where it closes)
    const H = (a) => base + amp * (0.55 * Math.sin(2 * a + ph) + 0.3 * Math.sin(5 * a + 2.1 * ph) + 0.15 * Math.sin(11 * a + 0.7));
    M.save().color(col).local(1); M.cls = 1;
    M.aoFn = (x, y, z) => 0.74 + 0.26 * (0.5 + 0.5 * Math.sin(x * 0.061 + z * 0.043) * Math.sin(x * 0.037 - z * 0.071 + ph));
    M.surf('opjCanopy', segs, 6, (u, v) => { const a = u * TAU, r = lerp(r0, r1, v), k = Math.sin(Math.min(1, v * 1.15) * Math.PI * 0.5); return [Math.cos(a) * r, 8 + (H(a) + crown(a) * smoothstep(0.55, 1, v)) * k, Math.sin(a) * r]; }, { uL: 60, vL: 4, closeU: true });
    M.aoFn = null; M.restore();
  };
  WORLD.force = 'far';
  ring(112, 128, 24, 10, 0.3, [0.34, 0.45, 0.26]);
  ring(150, 168, 38, 15, 1.9, [0.31, 0.42, 0.3]);
  ring(192, 212, 54, 20, 3.4, [0.29, 0.4, 0.34]);
  // the near hill: a dome (its flanks concave toward the foot), tree crowns on a jittered 10 m grid raised on it
  const C = [-130, -120], Rb = 95, Hh = 86, R = rngOf(8803), cr = [];
  for (let gx = -Rb; gx <= Rb; gx += 10) for (let gz = -Rb; gz <= Rb; gz += 10) { const x = gx + R.range(-3.5, 3.5), z = gz + R.range(-3.5, 3.5); if (hyp(x, z) < Rb * 1.05) cr.push([x, z, R.range(6.5, 9.5), R.range(3, 6)]); }
  const bump = (x, z) => { let b = 0; for (const [cx, cz, r, h] of cr) { const d2 = ((x - cx) ** 2 + (z - cz) ** 2) / (r * r); if (d2 < 1) b = Math.max(b, h * Math.sqrt(1 - d2)); } return b; };
  const hy = (x, z) => { const q = hyp(x, z) / Rb; return q >= 1 ? 6 - (q - 1) * 80 : 6 + Hh * Math.pow(Math.cos(q * Math.PI * 0.5), 1.4) + bump(x, z) * (1 - smoothstep(0.85, 1, q)); };
  const E = Rb * 1.1;
  M.save().color([0.56, 0.62, 0.44]).local(1); M.cls = 1;
  M.aoFn = (x, y, z) => 0.6 + 0.4 * clamp(bump(x - C[0], z - C[1]) / 4.5, 0, 1);
  M.surf('opjCanopy', 54, 54, (u, v) => { const x = lerp(-E, E, u), z = lerp(-E, E, v); return [C[0] + x, hy(x, z), C[1] + z]; }, { uL: (2 * E) / 12.6, vL: (2 * E) / 12.6, flipN: true });
  M.aoFn = null; M.restore();
  WORLD.force = null;
}

/* ---------- The jungle ---------- */
function opJungle() {
  const R = rngOf(7301), B = MAP_DEFS.outpost.bounds, onTrack = (x, z) => { let d = 1e9; for (let i = 0; i < OPJ_TRACK.length - 1; i++) { const [ax, az] = OPJ_TRACK[i], [bx, bz] = OPJ_TRACK[i + 1], dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (Math.abs(z) - az) * dz) / (dx * dx + dz * dz), 0, 1); d = Math.min(d, hyp(x - ax - dx * t, Math.abs(z) - az - dz * t)); } return d < 2.7; };
  OPJ_MASSES.length = 0;
  // masses in bounds on a jittered 2.3 m grid over the Alpha half, mirrored to the south (each with its own draw, repeated for its mirror),
  // wherever the walkable network is far enough, outside the compound: those on a trail side (edge) get a large plant turned toward it;
  // deep inside the jungle, the light mass without shadow
  for (let gx = B.x0 - 1; gx <= B.x1 + 1; gx += 2.3) for (let gz = 0.4; gz <= B.z1 + 1; gz += 2.3) {
    const x = gx + R.range(-0.7, 0.7), z = gz + R.range(-0.7, 0.7), h0 = R.range(4.4, 5.6), w = opjWalk(x, z), seed = Math.floor(R() * 1e6);
    // (between two trails close together, a smaller one: no gap of open ground for a line of sight; its leaves reach the face of the solid
    // jungle, 0.5 m beyond the walkable ground, or stand a little back from it: 0.45 m along the gate road, 0.2 m along the trails, the
    // strip between them for the ferns)
    const back = opjRoadD(x, z) < 4 ? 0.45 : 0.2, r = Math.min(R.range(1.7, 2.5), (w - back) / 0.95);
    // (the edge row's top varies from 2.3 to 5.2 m (no lower: a sight line over it would see through the solid jungle behind), a shrub row of 2.3 to 2.9 m along the gate
    // roads' first 10 m; the second row stands taller behind it, darker, a trunk now and then)
    const ed = w < r + 2.5, second = !ed && w < r + 6, hv = 0.5 + 0.5 * Math.sin(x * 0.71 + z * 0.43 + 1.3) * Math.cos(x * 0.29 - z * 0.83), h = ed ? (opjRoadD(x, z) < 4.6 ? R.range(2.3, 2.9) : lerp(2.3, 5.2, clamp(hv + R.range(-0.2, 0.2), 0, 1))) : second ? h0 + 0.6 : h0;
    if (opjInside(x, z, r + 0.5) || r < 0.8) continue;
    // direction of the nearest walkable ground (sampled), for the edge plants
    let toward; if (w < r + 2.5) { let best = 1e9; for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU, v = opjWalk(x + Math.cos(a) * 2, z + Math.sin(a) * 2); if (v < best) { best = v; toward = a; } } }
    const trunk = second && hv > 0.35, tint = second ? [0.78, 0.8, 0.76] : undefined;
    for (const s of z > 1.2 ? [1, -1] : [1]) opjThicket(x, s * z, r, h, rngOf(seed), { edge: ed, toward: toward === undefined ? undefined : s * toward, deep: w > r + 4, mz: s, tint, trunk });
    OPJ_MASSES.push([x, z, r]);
  }
  // filler: solid ground (the raster) that no mass covers yet gets a small one (bays along the trails, between two masses)
  for (let x = B.x0 + 0.5; x < B.x1; x += 1) for (let z = 0.5; z < B.z1; z += 1) {
    if (!opjSolidAt(x, z) || OPJ_MASSES.some(([mx, mz, mr]) => hyp(mx - x, mz - z) < mr * (opjWalk(x, z) < 2 ? 0.65 : 0.85))) continue; // (closer together near a trail)
    const w = opjWalk(x, z), r = clamp((w - 0.1) / 0.95, 0.9, 1.6);
    for (const s of z > 1 ? [1, -1] : [1]) opjThicket(x, s * z, r, R.range(4.4, 5.2), rngOf(Math.round(x * 31 + z * 7)), { edge: false, deep: w > r + 4, fill: true, mz: s });
    OPJ_MASSES.push([x, z, r]);
  }
  // the corners where the path from the middle cut opens into the spawn clearing (narrow wedges of solid jungle), faces of solid jungle by
  // the east trail's bend and the middle path's, two thin strips at the clearing's south edge
  for (const [x, z, r] of [[-1.8, 38.4, 0.9], [2.7, 38.4, 0.9], [-3.9, 37.9, 1.0], [28.4, 18.6, 0.9], [-2.9, 31.2, 0.9], [-5.3, 38.1, 0.9], [22.2, 39.1, 0.9]]) for (const s of [1, -1]) opjThicket(x, s * z, r, 4.6, rngOf(Math.round(x * 13 + 5)), { edge: false, mz: s });
  // the jungle wall beyond the bounds: masses, tall trees and palms, no collision, no shadow
  for (let gx = B.x0 - 14; gx <= B.x1 + 14; gx += 3.4) for (let gz = B.z0 - 14; gz <= B.z1 + 14; gz += 3.4) {
    const x = gx + R.range(-1, 1), z = gz + R.range(-1, 1);
    if (Math.abs(x) < B.x1 + 1.5 && Math.abs(z) < B.z1 + 1.5) continue;
    if (R() < 0.16) { const k = R() < 0.5 ? 'palm' : 'tree'; DECOR.place(opjTreePf(R, k, true), x, 0, z, R() * TAU, { nocol: true, cls: 1 }); }
    else opjThicket(x, z, R.range(2.4, 3.4), R.range(5.5, 8), R, { deep: true, tint: hyp(x, z) > 50 ? [0.86, 0.94, 1.0] : undefined });
  }
  opjCanopy(); opjHills();
  // chicanes in the cleared strips along the fence (each a shrub against the jungle edge and one beside the fence, 4 m apart; the latter's
  // collision stops 0.4 m short of the fence: no slit between them)
  const discs = [];
  for (const s of [1, -1]) {
    for (const [x, z, r] of [[-12.5, 23.5, 1.1], [-15.5, 22.2, 0.85], [14.5, 23.5, 1.1], [18.5, 22.2, 0.85], [-24.2, 6.0, 0.85], [-25.3, 10.5, 1.1], [24.2, 6.0, 0.85], [25.3, 10.5, 1.1],
      [-25.3, 17.4, 1.1], [-24.2, 20.4, 0.85], [25.3, 17.4, 1.1], [24.2, 20.4, 0.85]]) discs.push(opjShrub(x, s * z, r, Math.round(Math.abs(x * 7 + z * 3)) + (s > 0 ? 0 : 1)));
  }
  // the solid jungle (before the trees and the cover: they keep clear of it)
  opjSolid(discs);
  // cover in the open: logs and rocks along the trails and in the clearings (both halves, mirrored)
  const cover = [
    ['log', -8.0, 40.0, 0.1, 4.0, 0.4], ['log', -17.5, 46.4, 0.4, 4.5, 0.4], ['log', -29.6, 26.8, 0.85, 4.2, 0.38], ['log', 29.8, 11.2, -0.75, 4.4, 0.4],
    ['rock', 16.5, 45.5, 1.1, 0.8, 0.9], ['rock', -28.3, 36.4, 0.9, 0.8, 0.8], ['rock', 28.6, 36.2, 0.95, 0.85, 0.9], ['rock', -30.6, 8.0, 1.0, 0.8, 1.1], ['rock', 30.4, 16.6, 1.0, 0.8, 1.1],
    ['rock', -9.8, 22.9, 1.0, 0.65, 0.7], ['rock', 12.4, 39.8, 0.9, 0.7, 0.9],
    // (the spawn clearing: cover between the spawn points, it is not one open plaza)
    ['log', -15.4, 41.8, -0.25, 4.0, 0.4], ['rock', -2.0, 41.0, 0.9, 0.7, 0.8],
  ];
  for (const s of [1, -1]) cover.forEach(([k, x, z, a, p, q], i) => {
    if (k === 'log') opjLog(x, s * z, s * a, p, q); else opjRock(x, s * z, a, p, q, i * 0.7 + (s > 0 ? 0 : 1.3), i + (s > 0 ? 3 : 6));
  });
  // canopy trees and palms (Alpha half, mirrored): on the edges of the network (they overhang the trails), in the clearings; and emergent
  // ones standing in the masses (no collision there: the raster already stops everything)
  for (let i = 0; i < 200; i++) {
    const x = R.range(B.x0, B.x1), z = R.range(1.5, B.z1), w = opjWalk(x, z), kind = R() < 0.55 ? 'palm' : 'tree', seed = Math.floor(R() * 1e6);
    if (opjInside(x, z, 1.5) || w < -7) continue;
    const [kx, kz, krx, krz] = OPJ.clears[0], inClear = hyp((x - kx) / krx, (z - kz) / krz) < 0.85;
    if (w < -0.5 && R() < 0.6) continue; // (fewer trunks in the middle of a trail or a clearing)
    if (w < -0.2 && !inClear) continue; // (and none inside a trail: they would narrow it below a soldier's width)
    if (onTrack(x, z) || MAP_DEFS.outpost.spawns.some(([sx, sz]) => hyp(sx - x, sz - z) < 1.6)) continue; // (no trunk on the gate track nor on a spawn point)
    if (opjInside(x, z, 3.4) && w < 1.2) continue; // (nor in the cleared strips along the fence: their chicanes stay passable)
    if (kind !== 'palm' && Math.abs(z) < OP_FENCE.z1 + 5 && Math.abs(x) < OP_FENCE.x1 + 5) continue; // (no broadleaf crown over the front and rear fences)
    const ry = rngOf(seed + 1)() * TAU;
    if (w > 1.2) { if (R() < 0.22) { const pf = opjTreePf(rngOf(seed), kind, true); DECOR.place(pf, x, 0, z, ry, { nocol: true }); DECOR.place(pf, x, 0, -z, -ry, { nocol: true }); } continue; }
    const pf = opjTreePf(rngOf(seed), kind);
    if (plantFits(pf, x, z) && plantFits(pf, x, -z)) { DECOR.place(pf, x, 0, z, ry); DECOR.place(pf, x, 0, -z, -ry); }
  }
  // the skyline: a mid-storey of 7 to 8 m trees and palms 3 to 7 m out from the fence strips, canopy trees of 16 to 19 m and tall palms
  // 9 to 15 m out, on the three sides of the half (mirrored); standing in the solid jungle (no collision: the raster stops everything)
  const sky = [];
  for (let x = -22; x <= 22; x += 4.6) sky.push([x, 27.0, 0], [x + 2.3, 32.5, 1]);
  for (const sx of [-1, 1]) for (let z = 2.5; z <= 20; z += 4.4) sky.push([sx * 28.4, z, 0], [sx * 34.0, z + 2.2, 1]);
  sky.forEach(([x0, z0, far], i) => {
    const Q = rngOf(5101 + i * 17), x = x0 + Q.range(-1.4, 1.4), z = z0 + Q.range(-1.2, 1.2), w = opjWalk(x, z), ry = Q() * TAU, palm = Q() < 0.42;
    if (w < 1.6 || Math.abs(z) > B.z1 - 1 || Math.abs(x) > B.x1 - 1) return;
    const pf = palm ? PF.opjPalm(far ? Math.round(Q.range(13, 17)) : Math.round(Q.range(9, 12)), 1 + Math.floor(Q() * 6), Q() < 0.5 ? 'palm' : 'palm2')
      : far ? PF.opjTree(Math.round(Q.range(16, 19)), Math.round(Q.range(5, 6) * 2) / 2, 1 + Math.floor(Q() * 4), Math.round(Q.range(5, 6.5)), true)
        : PF.opjTree(Math.round(Q.range(7, 8.5)), Math.round(Q.range(2.6, 3.2) * 2) / 2, 1 + Math.floor(Q() * 4), Math.round(Q.range(2.5, 3.5) * 2) / 2, true);
    for (const s of [1, -1]) DECOR.place(pf, x, 0, s * z, s * ry, far ? { nocol: true, cls: 1 } : { nocol: true });
  });
  // the fence line seen from the yard (sheet 4: palms most of the perimeter crowns, banana plants between): a coconut palm about every
  // 5.5 m along the jungle's edge beyond the cleared strips, leaning over toward the yard, a banana plant (2 to 3 m) every 4 m;
  // in the solid jungle (no collision); mirrored (the south copy a true mirror); none in the yard (sheet 4 overhead: no tree inside)
  const leanTo = (pf, seed, x, z, tx, tz, col) => {
    const R0 = rngOf(seed * 71 + 5); R0(); const ld = R0() * TAU, th = ld - Math.atan2(tz - z, tx - x);
    for (const s of [1, -1]) DECOR.save().move(x, 0, s * z).scl(1, 1, s).rotY(th).put(pf, col ? {} : { nocol: true, cls: 1 }).restore(); // (the fence line's: no shadow)
  };
  const line = [];
  for (let x = -21.5; x <= 22; x += 5.4) line.push([x, 25.0, 'p']);
  for (let x = -21.0; x <= 22; x += 4) line.push([x, 24.2, 'b']);
  for (const sx of [-1, 1]) { for (let z = 2.2; z <= 20.5; z += 5.4) line.push([sx * 27.0, z, 'p']); for (let z = 1.5; z <= 21; z += 4) line.push([sx * 26.2, z, 'b']); }
  line.forEach(([x0, z0, k], i) => {
    const Q = rngOf(6203 + i * 13), xg = x0 + Q.range(-0.8, 0.8), x = k === 'p' && z0 > 24 && Math.abs(xg - 6) < 6 ? xg + Math.sign(xg - 6) * 4 : xg, z = z0 + Q.range(-0.4, 0.6); // (none over the gate seen from above: those beside it 4 m aside)
    if (!opjSolidAt(x, z)) return; // (the openings: the gate road, the cuts, the trails)
    if (k === 'b') { const pf = PF.opjBanana(Math.round(Q.range(2.0, 3.0) * 2) / 2, 1 + Math.floor(Q() * 5), 1.5), ry = Q() * TAU; for (const s of [1, -1]) DECOR.save().move(x, 0, s * z).scl(1, 1, s).rotY(ry).put(pf, { nocol: true, cls: 1 }).restore(); return; }
    const seed = 1 + Math.floor(Q() * 6); leanTo(PF.opjPalm(Math.round(Q.range(8, 13)), seed, Q() < 0.5 ? 'palm' : 'palm2'), seed, x, z, x * 0.6, z * 0.6);
  });
  // vines climbing the fence from the jungle side on some panels: [x or z along the fence, width, hanging length], north fence, west, east
  for (const s of [1, -1]) {
    const F = OP_FENCE, top = OPY_FH + 0.12, card = (a, b, h) => leafQuad(DECOR, 'opyLeaf', [[a[0], top - h, a[1]], [b[0], top - h, b[1]], [b[0], top, b[1]], [a[0], top, a[1]]], OPJ_LEAF.vine, { up: 0.3, w: [0.6, 0.6, 0, 0], ao: [0.75, 0.75, 1, 1] });
    DECOR.save().local(1); DECOR.cls = 1;
    // (each panel: two or three strands of a quarter of their length in width, the sprite's own proportions)
    const strands = (c, h, along) => { for (let k = 0; k < 3; k++) { const hh = h * (1 - k * 0.22), wd = hh * 0.26, o = (k - 1) * 0.42; DECOR.color(R.pick(OPJ_TINT)); along(c + o - wd / 2, c + o + wd / 2, hh); } };
    for (const [x, , h] of [[-16.6, 1.4, 2.1], [-12.3, 1.1, 1.5], [-1.6, 1.5, 2.2], [0.9, 1.0, 1.4], [11.6, 1.6, 2.2], [17.4, 1.2, 1.8]]) { const z = s * (F.z1 + 0.04); strands(x, h, (a, b, hh) => card(s > 0 ? [a, z] : [b, z], s > 0 ? [b, z] : [a, z], hh)); }
    for (const [xf, o] of [[F.x0, -1], [F.x1, 1]]) for (const [z, , h] of [[3.6, 1.4, 2.0], [8.8, 1.1, 1.5], [17.8, 1.5, 2.2]]) { const x = xf + o * 0.04, d = o * s; strands(s * z, h, (a, b, hh) => card(d > 0 ? [x, b] : [x, a], d > 0 ? [x, a] : [x, b], hh)); }
    DECOR.restore();
  }
  // understory on the walkable ground: ferns, elephant ears, low fern tufts (no collision), dense at the edges of the trails
  const under = (RR) => {
    const k = RR();
    if (k < 0.26) return [PF.opjFern(Math.round(RR.range(0.9, 1.4) * 10) / 10, 1 + Math.floor(RR() * 6), 7), 1];
    if (k < 0.56) return [PF.rosette('opjEar', 'opyLeaf', 0.8, 5, 1 + Math.floor(RR() * 6), { lean: 0.6, tint: OPJ_TINT_LOW }), RR.range(0.8, 1.25)];
    return [PF.clump('opjFern', 'opyLeaf', 0.8, 0.7, 3, 1 + Math.floor(RR() * 4), { cls: 3, tint: OPJ_TINT_LOW }), RR.range(0.8, 1.3)];
  };
  const bed = (n, free) => {
    for (let i = 0; i < n; i++) {
      const x = R.range(B.x0, B.x1), z = R.range(B.z0, B.z1), ry = R() * TAU, [pf, sc, tint] = under(R);
      if (free(x, z)) DECOR.place(pf, x, 0, z, ry, { s: sc, nocol: true, tint });
    }
  };
  const gateAxis = (x, z) => Math.abs(x - 6) < 3.6 && Math.abs(z) < 34; // (nothing grows in the gate's axis: the road stays a clear lane)
  bed(2000, (x, z) => { const w = opjWalk(x, z); return !opjInside(x, z, 0.4) && w < 1.2 && w > -1.2 && !onTrack(x, z) && !gateAxis(x, z); });
  bed(420, (x, z) => !opjInside(x, z, 0.4) && opjWalk(x, z) < -1.2 && !onTrack(x, z) && !gateAxis(x, z) && R() < 0.5);
  // inside the fence (sheet 4: green creeping in along the fence and in the corners): an irregular fringe 0.5 to 1.5 m wide, wider in the
  // corners, and clumps by the props; low fern tufts, elephant ears, a fern now and then; none on the tracks, the gates, the cuts
  const F = OP_FENCE, gaps = [OPY_GATE, OPY_CUT, OPY_CUT2], onRut = (x, z) => OP_RUTS.some((P) => P.some(([px, pz], k) => k < P.length - 1 && hyp(x - px, Math.abs(z) - pz) < 2.4));
  const weed = (Q, x, z, s) => {
    const k = Q(), pf = k < 0.5 ? PF.clump('opjFern', 'opyLeaf', 0.7, 0.6, 3, 1 + Math.floor(Q() * 4), { cls: 3, tint: OPJ_TINT_LOW }) : PF.rosette('opjEar', 'opyLeaf', 0.6, 4, 1 + Math.floor(Q() * 5), { lean: 0.7, cls: 3, tint: OPJ_TINT_LOW });
    DECOR.place(pf, x, 0, s * z, Q() * TAU, { s: Q.range(0.7, 1.2), nocol: true });
  };
  const QW = rngOf(9091);
  for (let i = 0; i < 440; i++) {
    const side = QW(), t = QW(), x = side < 0.5 ? lerp(F.x0, F.x1, t) : side < 0.75 ? F.x0 : F.x1, z = side < 0.5 ? F.z1 : lerp(0.6, F.z1, t);
    const corner = Math.max(0, 1 - Math.min(Math.abs(Math.abs(x) - F.x1), F.z1 - z) / 4), band = 0.5 + 1.0 * (0.5 + 0.5 * Math.sin(x * 0.53 + 1.7) * Math.cos(z * 0.47 + 0.4)) + corner * 1.2, d = QW() * band;
    const wx = side < 0.5 ? x : x - Math.sign(x) * d, wz = side < 0.5 ? z - d : z;
    if (side < 0.5 && gaps.some(([a, b]) => wx > a - 0.6 && wx < b + 0.6)) continue;
    if (side >= 0.5 && Math.abs(wz) > OPY_BREACH[0] - 0.6 && Math.abs(wz) < OPY_BREACH[1] + 0.6) continue;
    if (onRut(wx, wz) || QW() > 0.55 + corner * 0.45) continue;
    for (const s of [1, -1]) weed(rngOf(i * 7 + (s > 0 ? 1 : 2)), wx, wz, s);
  }
  // by the props (the stacks, the tank, the barriers): a few tufts at their feet
  for (const [x, z] of [[-21.0, 16.4], [-19.0, 17.6], [-20.6, 12.4], [-11.8, 9.6], [-15.0, 8.0], [1.4, 15.6], [6.6, 12.2], [1.6, 10.4], [-8.4, 4.4], [-8.2, 7.0], [20.8, 7.6], [20.6, 11.6], [19.8, 14.2], [12.4, 2.6], [12.0, 5.4], [12.8, 17.2], [9.4, 16.9], [-14.6, 12.6]])
    for (const s of [1, -1]) { const Q = rngOf(Math.round(x * 13 + z * 7) + (s > 0 ? 0 : 5)); for (let k = 0; k < 2; k++) weed(Q, x + Q.range(-0.7, 0.7), z + Q.range(-0.5, 0.5), s); }
}
