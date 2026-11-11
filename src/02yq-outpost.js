/* ==========================================================================
   JUNGLE OUTPOST: a military command post cut out of the rainforest. 76 x 100 m, mirrored north-south for play: Alpha to the north (+z),
   Bravo to the south.
   - CENTER: the fenced compound (46 x 42 m, OP_FENCE) in a clearing of wet mud: the two-level command building in the middle on its
     concrete apron (02yo-outpost-building.js); WEST the guard tower on the center line (deck at 3.3 m, lookout cabin at 6.6 m, one stair
     per side) with point B at its foot; EAST the utility shed, a way through from one yard to the other; NORTH and SOUTH the two yards
     (points A and C just inside the gates) with their cover: jersey barriers, olive crate stacks, wooden crates, the water tank, the
     parked 4x4 to the east (02yp-outpost-yard.js, 02ypa-outpost-tower.js).
   - Ways into the compound, for each team: the gate (main gate north, in front of the building's entrance; rear gate south), the
     middle cut and the corner cut in the same fence, the breaches in the side fences (west and east, reached by the flank trails).
   - OUTSIDE: the jungle (02ypb-outpost-jungle.js): the teams spawn in a clearing on either side; the jungle hides them from the tower, point
     B and the yard; the track to the gate, the path to the middle cut and the flank trails (which also reach the corner cut) cross it;
     forested hills in a blue-green haze in the distance.
   Ambience: a humid tropical late morning just after a shower: blue sky with cumulus, high sun from the east (both halves get the same
   light), damp trodden earth with puddles mirroring the sky and the scenery, paired wheel ruts from the gates, steam haze over the
   jungle and the forested ridges, butterflies along the trails.
   ========================================================================== */
const OPL = { splat: null };

/* ---------- Plan ---------- */
function outpostLevel() {
  opCommandPost();
  opYard();
  opJungle();
  opPuddles();
  opGround();
  opLife();
}

/* ---------- Ground: wet mud (base), damp trodden earth, the concrete (footsteps), the jungle floor (leaf litter) ---------- */
/* Layers: base opyMud (wet mud: what shows where the earth is cut), l1 opyEarth (damp trodden earth, grey-brown), l2 concrete (under the
   slabs only: the footsteps read it), l3 opyLitter (the jungle floor, dark leaf litter, and the weeds' fringe inside the fence); the dirt
   channel (a) darkens the mud (puddle rims, the trodden path). The slabs, the ruts and the mud lapping over the slab edges are geometry */
const GROUND_OP = { base: 'opyMud', l1: 'opyEarth', l2: 'concrete', l3: 'opyLitter', pom: [0, 0.02, 0.02, 0], dirt: [0.55, 0.5, 0.46], mul: 0, env: 0.75 };
/* Vehicle tracks of the Alpha half (mirrored): from the spawn clearing down the road and through the gate to the front of the building,
   past the parked load (the 4x4 south); a branch past the shed's door. Two ruts 1.8 m apart along each (OP_RUT) */
const OP_RUTS = [[[3.4, 40.4], [12.5, 35.0], [6.3, 33.0], [6.2, 27], [6.0, 21], [7.0, 17.0], [8.0, 13.6], [7.6, 9.0], [7.0, 7.8]], [[8.0, 13.6], [11.8, 9.6], [16.2, 6.2], [17.4, 4.6], [19.6, 4.2]]];
const OP_RUT = { gap: 1.8, w: 0.7 }; // (the rut decal 0.7 m across, the rut itself about 0.3 m in its middle, its width varying)
/* Puddles left by the shower (Alpha half, mirrored): [x, z, w, d, rot]; lying in the ruts (narrow, along them), in front of the porch, a
   group in the west quadrant; never under an object */
const OP_PUDDLES = [[5.2, 19.0, 1.8, 0.42, 1.5], [7.0, 18.2, 1.3, 0.4, 1.47], [6.4, 15.7, 1.4, 0.4, 1.28], [8.2, 15.3, 1.1, 0.38, 1.28], [11.1, 10.9, 1.5, 0.42, 0.82],
  [5.3, 25.6, 1.6, 0.42, 1.56], [7.1, 30.6, 1.2, 0.4, 1.56],
  [-2.6, 8.6, 2.8, 1.2, 0.15], [0.4, 9.5, 1.0, 0.6, -0.3], [2.1, 8.2, 1.6, 0.8, 0.4], [-4.5, 9.9, 0.7, 0.5, 1.0], [-0.9, 10.9, 1.2, 0.5, 0.2],
  [-16.8, 11.4, 1.4, 0.7, 0.4], [-15.2, 11.9, 0.9, 0.5, -0.2], [-17.7, 12.7, 0.8, 0.45, 1.1], [-14.4, 10.6, 1.1, 0.55, 0.9],
  [-1.0, 14.6, 1.6, 1.0, 0.3], [0.6, 18.2, 1.3, 0.8, -0.5], [-6.0, 16.4, 2.2, 1.2, 0.8], [-3.2, 19.2, 1.2, 0.7, 0.2], [-10.5, 15.4, 1.8, 1.0, -0.4],
  [-13.0, 17.8, 1.0, 0.6, 0.6], [-8.4, 12.2, 1.4, 0.8, 0.1]];
function opPuddles() {
  // dark brown-grey water over the mud, a strong reflection at grazing angles: the sky's (a probe of the scenery, taken at 1.1 m over
  // the ground, filled them with the dark earth round them: they no longer read as water), still enough to mirror it; a soft edge
  const groups = new Map();
  for (const s of [1, -1]) OP_PUDDLES.forEach(([x, z, w, d, r], i) => {
    const m = pondAdd({ shape: 'blob', x, y: 0.025, z: s * z, w, d, rot: s * r, seed: i + (s > 0 ? 1 : 31), seg: 20, rings: 4, alpha: 0.86, depth: 0.25, foam: 0,
      deep: [0.028, 0.024, 0.02], shallow: [0.042, 0.037, 0.031], scatter: [0.01, 0.009, 0.008], tone: 0.5, calm: 0.2, probe: false });
    if (!m) return; if (m.material) m.material.envMapIntensity = 1.5;
    if (!groups.has(s)) groups.set(s, []); groups.get(s).push(m); // (one mesh per half)
  });
  for (const list of groups.values()) opMergePonds(list);
}
/* The puddles of a group drawn as one mesh (the first one's material: the shader works in world space, its center only drives the
   fountains' rings): their geometry moved into the first one's frame, the others taken out of the scene (they stay registered for the
   ripples' mask) */
function opMergePonds(list) {
  if (list.length < 2) return;
  const base = list[0], inv = new THREE.Matrix4().copy(base.matrix).invert(), T = new THREE.Matrix4(), v = new V3(), P = [], E = [], I = [];
  let off = 0;
  for (const m of list) {
    T.multiplyMatrices(inv, m.matrix); const g = m.geometry, pos = g.attributes.position, rim = g.attributes.aRim, ix = g.index;
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(T); P.push(v.x, v.y, v.z); E.push(rim.getX(i)); }
    for (let i = 0; i < ix.count; i++) I.push(ix.getX(i) + off);
    off += pos.count;
    if (m !== base && m.parent) m.parent.remove(m);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(P.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setAttribute('aRim', new THREE.Float32BufferAttribute(E, 1)); g.setIndex(I); g.computeBoundingSphere(); g.computeBoundingBox();
  base.geometry = g;
}
/* Smoothed polyline (Chaikin, three passes, the ends kept) */
function opRutSmooth(Q, n = 3) {
  for (let k = 0; k < n; k++) { const R = [Q[0]]; for (let i = 0; i < Q.length - 1; i++) { const [ax, az] = Q[i], [bx, bz] = Q[i + 1]; R.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]); } R.push(Q[Q.length - 1]); Q = R; }
  return Q;
}
/* Ribbon decal along a polyline Q ([[x, z], ...]) offset o to its left, w wide, at height y, in material mat (u along it, v across: the
   texture's tile across the whole width) */
function opGroundRibbon(mat, Q, o, w, y, ph) {
  const M = DECOR, P = [], N = []; let run = 0;
  for (let i = 0; i < Q.length; i++) {
    const a = Q[Math.max(0, i - 1)], b = Q[Math.min(Q.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = hyp(dx, dz) || 1;
    if (i) run += hyp(Q[i][0] - Q[i - 1][0], Q[i][1] - Q[i - 1][1]);
    const oo = ph === undefined ? o : o + 0.05 * Math.sin(run * 0.45 + ph) + 0.03 * Math.sin(run * 1.3 + ph * 1.7); // (a wheel's line wanders a little)
    N.push([-dz / l, dx / l]); P.push([Q[i][0] - (dz / l) * oo, Q[i][1] + (dx / l) * oo]);
  }
  M.save().color([1, 1, 1]).local(1); M.cls = 1; let u = ph ? ph * 3.1 : 0;
  for (let i = 0; i < P.length - 1; i++) {
    const [ax, az] = P[i], [bx, bz] = P[i + 1], [nax, naz] = N[i], [nbx, nbz] = N[i + 1], du = hyp(bx - ax, bz - az), h = w / 2;
    // (wound counter-clockwise seen from above: M.quad keeps the order, so the given uv stay on their corners)
    const k = 0.7 / 5.6; // (the rut and spill textures: their tile 8 times longer along than across)
    M.quad(mat, [ax + nax * h, y, az + naz * h], [bx + nbx * h, y, bz + nbz * h], [bx - nbx * h, y, bz - nbz * h], [ax - nax * h, y, az - naz * h], [0, 1, 0], { uv: [[u * k, w], [(u + du) * k, w], [(u + du) * k, 0], [u * k, 0]] });
    u += du;
  }
  M.restore();
}
/* Concrete slabs (3 cm, straight edges) round the building (the apron) and at the shed's doors, the mud lapping over their outer edges */
const OP_SLABS = [[-7.0, 8.4, 4.0, 7.3], [-7.0, 8.4, -7.9, -7.0], [-7.0, -2.5, -7.0, -4.0], [2.5, 8.4, -7.0, -4.0], [-7.0, -6.0, -4.0, 4.0], [6.0, 8.4, -4.0, 4.0], [15.0, 19.0, 3.65, 5.4], [15.0, 19.0, -5.4, -3.65]];
function opApronSlabs() {
  const M = DECOR, y = 0.03;
  M.save().color(OPY.concrete.map((v) => v * 0.45)).world(1); M.cls = 1;
  for (const [x0, x1, z0, z1] of OP_SLABS) M.boxB('concrete', x0, x1, 0, y, z0, z1, { skip: 'y' });
  M.restore();
  // tyre and boot dirt on the slabs: smears where the tracks cross the apron, by the stair foot and the doors (the building's stain cells)
  M.save().color([0.36, 0.3, 0.23]); M.cls = 1;
  for (const s of [1, -1]) for (const [x0, x1, z0, z1, c] of [[6.0, 8.2, 5.2, 7.2, 'splash'], [6.4, 7.9, 3.0, 4.6, 'wear'], [-4.9, -2.1, 6.4, 7.2, 'wear'], [15.4, 18.6, 3.8, 5.2, 'splash'], [-6.9, -6.1, -0.8, 1.4, 'wear']]) {
    const za = Math.min(s * z0, s * z1), zb = Math.max(s * z0, s * z1); opStainFlat(M, OPW[c], x0, x1, za, zb, y + 0.003);
  }
  M.restore();
  // the spill on the outer edges only: each edge of a slab that no other slab (or the building) continues
  const outer = (x, z) => !OP_SLABS.some(([a, b, c, d]) => x > a - 0.01 && x < b + 0.01 && z > c - 0.01 && z < d + 0.01) && !(Math.abs(x) < 6.05 && Math.abs(z + 1.5) < 5.55);
  for (const [x0, x1, z0, z1] of OP_SLABS) {
    for (const [ax, az, bx, bz, nx, nz] of [[x0, z0, x1, z0, 0, -1], [x1, z0, x1, z1, 1, 0], [x1, z1, x0, z1, 0, 1], [x0, z1, x0, z0, -1, 0]]) {
      const mx = (ax + bx) / 2 + nx * 0.05, mz = (az + bz) / 2 + nz * 0.05; if (!outer(mx, mz)) continue;
      opGroundRibbon('opyFilm', [[ax, az], [bx, bz]], 0.2, 0.4, y + 0.002); // (offset inward by the ribbon's half width: the spill's ragged edge 0 to 0.3 m in)
    }
  }
}
/* Lowers layer ch (and raises the wet darkening ka) where d(x, z) > 0 (soft edge, the same wobble as Splat.paint): Splat.paint only raises */
function opCut(sp, box, d, soft = 0.6, k = 1, ka = 0, ch = 0) {
  const S = sp.S, W = sp.W, H = sp.H, N = sp.N, ppm = S.ppm, px = sp.px;
  const i0 = Math.max(0, Math.floor((box[0] - soft - 1 - S.x0) * ppm)), i1 = Math.min(W - 1, Math.ceil((box[1] + soft + 1 - S.x0) * ppm));
  const j0 = Math.max(0, Math.floor((box[2] - soft - 1 - S.z0) * ppm)), j1 = Math.min(H - 1, Math.ceil((box[3] + soft + 1 - S.z0) * ppm));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const x = S.x0 + (i + 0.5) / ppm, z = S.z0 + (j + 0.5) / ppm, w = smoothstep(-soft, soft, d(x, z) + (N.fbm(x * 0.09, z * 0.09, 32, 32, 3) - 0.5) * 0.8) * k, o = (j * W + i) * 4;
    if (w <= 0) continue;
    px[o + ch] *= 1 - w; if (ka) px[o + 3] = Math.max(px[o + 3], w * ka);
  }
}
function opGround() {
  const sp = new Splat(), F = OP_FENCE, N = sp.N, Sx = sp.S, all = [Sx.x0, Sx.x0 + Sx.w, Sx.z0, Sx.z0 + Sx.d];
  // (distance to a polyline, and its bounding box with a margin; a z range in either order)
  const segD = (Q, x, z) => { let d = 1e9; for (let i = 0; i < Q.length - 1; i++) { const [ax, az] = Q[i], [bx, bz] = Q[i + 1], dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1); d = Math.min(d, hyp(x - ax - dx * t, z - az - dz * t)); } return d; };
  const boxOf = (Q, m) => [Math.min(...Q.map((q) => q[0])) - m, Math.max(...Q.map((q) => q[0])) + m, Math.min(...Q.map((q) => q[1])) - m, Math.max(...Q.map((q) => q[1])) + m];
  const zr = (a, b) => [Math.min(a, b), Math.max(a, b)];
  // jungle floor (leaf litter) everywhere outside the compound and off the trails (it grows 0.5 m into their edges)
  sp.paint(2, all, (x, z) => (opjInside(x, z, 1.0) ? -1.5 : opjWalk(x, z) + 0.5), 0.7, 1, 1.4);
  // trodden earth: the compound (to the fence), the trodden middle of the trails and of the clearings, the road (its whole 4 m width)
  sp.rect(0, F.x0 - 1.0, F.x1 + 1.0, F.z0 - 1.0, F.z1 + 1.0, 0.8, 1, 0.9);
  for (const [P, w] of OPJ.paths) for (const s of [1, -1]) sp.path(0, P.map(([x, z]) => [x, s * z]), w * (P === OPJ_TRACK || P === OPJ_ROAD ? 1.0 : 0.7), 0.9, 0.85, 1.2);
  for (const [cx, cz, rx, rz] of OPJ.clears) for (const s of [1, -1]) sp.ellipse(0, cx, s * cz, rx * 0.75, rz * 0.75, 0, 1.4, 0.55, 1.3);
  // the weeds' fringe inside the fence (sheet 4: green creeping in 1 to 2 m, more in the corners): an irregular band 0.5 to 1.5 m, wider
  // in the corners, none in the gates, the cuts, the breaches; around the water tanks
  const gaps = [OPY_GATE, OPY_CUT, OPY_CUT2].map(([a, b]) => [a - 0.4, b + 0.4]);
  sp.paint(2, [F.x0 - 0.5, F.x1 + 0.5, F.z0 - 0.5, F.z1 + 0.5], (x, z) => {
    const dx = F.x1 - Math.abs(x), dz = F.z1 - Math.abs(z), d = Math.min(dx, dz), corner = Math.max(0, 1 - Math.max(dx, dz) / 4);
    const band = 0.5 + (0.5 + 0.5 * Math.sin(x * 0.53 + 1.7) * Math.cos(z * 0.47 + 0.4)) + corner * 1.5;
    if (dz < dx && gaps.some(([a, b]) => x > a && x < b)) return -1;
    if (dx <= dz && Math.abs(z) > OPY_BREACH[0] - 0.4 && Math.abs(z) < OPY_BREACH[1] + 0.4) return -1;
    return band - d;
  }, 0.35, 0.85, 1.1);
  for (const s of [1, -1]) sp.disc(2, -20.2, s * 13.9, 1.6, 0.8, 0.5, 1);
  // concrete (for the footsteps: the slabs are geometry) a little inside the slabs, and the tower's pad
  for (const [x0, x1, z0, z1] of OP_SLABS) sp.rect(1, x0 + 0.25, x1 - 0.25, z0 + 0.25, z1 - 0.25, 0.05, 1, 0);
  sp.rect(1, -19.1, -12.9, -3.0, 3.0, 0.15, 0.9, 0.3);
  // dry and wet patches 2 to 6 m across all over the yard (the wet mud shows through the earth)
  opCut(sp, [F.x0, F.x1, F.z0, F.z1], (x, z) => (N.fbm(x * 0.22 + 7.3, z * 0.22 + 2.1, 32, 32, 3) - 0.56) * 5, 0.7, 0.8, 0.12);
  // a ragged band of weeds at the slabs' outer edges (the litter channel: the grass grows on it)
  for (const [x0, x1, z0, z1] of OP_SLABS) sp.paint(2, [x0 - 0.8, x1 + 0.8, z0 - 0.8, z1 + 0.8], (x, z) => { const d = Math.max(x0 - x, x - x1, z0 - z, z - z1); return d < 0 ? -1 : 0.25 + (N.fbm(x * 0.9, z * 0.9, 32, 32, 2) - 0.5) * 0.9 - d; }, 0.12, 0.7, 0.6);
  // damp: the earth darkens toward the building, the shed and the gates (the mud shows through it)
  opCut(sp, [-10, 11, -11, 11], (x, z) => 2.2 - Math.max(Math.abs(x - 0.7) - 7.7, Math.abs(z) - 7.6, 0), 1.6, 0.55, 0.05);
  for (const s of [1, -1]) { opCut(sp, [1, 11, ...zr(s * (F.z1 - 6), s * F.z1)], (x, z) => 3 - hyp(x - 6, z - s * F.z1), 1.4, 0.6, 0.05); opCut(sp, [12, 22, ...zr(s * 2.5, s * 8)], (x, z) => 2.4 - hyp(x - 17, z - s * 4.5), 1.2, 0.5, 0.05); }
  // the trails: wet in their trodden middle here and there
  for (const [P, w] of OPJ.paths) for (const s of [1, -1]) {
    const Q = P.map(([x, z]) => [x, s * z]);
    opCut(sp, boxOf(Q, w + 2), (x, z) => Math.min(w * 0.45 - segD(Q, x, z), (N.fbm(x * 0.08 + 3, z * 0.08, 32, 32, 3) - 0.55) * 6), 0.8, 0.75, 0.1);
  }
  // the tracks churned and damp along the ruts; the trodden path from the tower's yard door to the building's west gable (on the center
  // line), the west quadrants' wet patch
  for (const s of [1, -1]) for (const P of OP_RUTS) { const Q = P.map(([x, z]) => [x, s * z]); opCut(sp, boxOf(Q, 3), (x, z) => 1.6 - segD(Q, x, z), 0.8, 0.5, 0.08); }
  opCut(sp, [-14, -6, -1.5, 2.5], (x, z) => 0.6 - Math.abs(z - 0.5 - Math.sin(x * 0.7) * 0.3), 0.4, 0.6, 0.3);
  for (const s of [1, -1]) opCut(sp, [-19, -13, ...zr(s * 9.5, s * 13.5)], (x, z) => 1 - hyp((x + 16) / 2.6, (z - s * 11.6) / 1.6), 0.8, 0.7, 0.15);
  for (const s of [1, -1]) opCut(sp, [-6, 4, ...zr(s * 6.8, s * 12)], (x, z) => 1 - hyp((x + 0.8) / 4.6, (z - s * 9.4) / 2.0), 0.8, 0.85, 0.15);
  // puddle rims: dark wet mud, 20 to 30 cm
  for (const s of [1, -1]) for (const [x, z, w, d, r] of OP_PUDDLES) {
    const c = Math.cos(s * r), sn = Math.sin(s * r), zz = s * z;
    opCut(sp, [x - w - 1, x + w + 1, zz - w - 1, zz + w + 1], (px, pz) => { const dx = px - x, dz = pz - zz, a = (dx * c + dz * sn) / (w * 0.5 + 0.28), b = (-dx * sn + dz * c) / (d * 0.5 + 0.25); return (1 - hyp(a, b)) * 0.6; }, 0.2, 1, 0.75);
  }
  OPL.splat = sp;
  MAT.ground = groundMat(sp.finish(0.06), [SPLAT.x0, SPLAT.z0, SPLAT.w, SPLAT.d], GROUND_OP);
  MAT.ground.emissive = new THREE.Color(0.016, 0.014, 0.011); // (a floor under the shade of the jungle and the props: it stays readable)
  const M = DECOR; WORLD.force = 'g';
  M.save().color([0.52, 0.52, 0.52]).local(1); M.aoFn = null; M.plane('ground', 660, 660, 1, 1); M.restore();
  WORLD.force = null;
  // the ruts: two lines 1.8 m apart along each track, dark and wet, a little sunk (decals on the ground)
  for (const s of [1, -1]) for (const P of OP_RUTS) { const Q = opRutSmooth(P.map(([x, z]) => [x, s * z])); for (const o of [-OP_RUT.gap / 2, OP_RUT.gap / 2]) for (const [j, ph] of [[0, 0], [0.07, 2.1]]) opGroundRibbon('opyRut', Q, o + j, OP_RUT.w, 0.008 + j * 0.01, ph); }
  opApronSlabs();
}
/* Footsteps: concrete apron and floors, packed earth and mud of the compound and the tracks, otherwise the jungle floor */
function opSurface(p) {
  const S = OPL.splat; if (!S) return 'dirt';
  if (S.at(1, p.x, p.z) > 0.5) return 'concrete';
  if (S.at(2, p.x, p.z) > 0.55) return 'grass';
  return 'dirt';
}

/* ---------- Life: butterflies along the trails, the clearings and the weeds of the fence (Floralia's swarms, 02x-life.js) ---------- */
function opLife() {
  const R = rngOf(6262), A = [];
  // [x, z, scatter radius, count] on the Alpha side, mirrored
  for (const [x, z, r, n] of [[-12, 44, 5, 3], [10, 45, 5, 3], [-27, 34, 3, 2], [27, 34, 3, 2], [-32, 18.6, 2, 2], [32, 18.6, 2, 2], [-30, 8.6, 3, 2], [30, 8.6, 3, 2], [-14, 22.6, 4, 2], [14, 22.6, 4, 2], [0, 33, 3, 2]])
    for (const s of [1, -1]) for (let i = 0; i < n; i++) A.push([x + R.range(-r, r), 0, s * z + R.range(-r, r)]);
  // (at their real size: about 8 cm across)
  lifeSwarm(A, [[0.25, 0.5, 0.85], [0.85, 0.66, 0.15], [0.85, 0.42, 0.1], [0.82, 0.82, 0.74]], LIFE_BF_VERT.replace('0.22 * uScale', '0.08 * uScale').replace('2.5, 56.0', '1.2, 24.0'), VIE_BF_FRAG, { seed: 21 });
  onResizeFx();
}

/* ---------- Atmosphere: humid tropical late morning, just after a shower ---------- */
/* High sun from the east, slightly south (both halves lit alike); deep blue sky with cumulus, pale and hazy toward the horizon; green hills
   painted in the sky (two veiled ridges); warm sun, warm sky fill strong enough to read a soldier in the shade of the canopy; light
   blue-green steam haze (fog thinned with altitude) that never hides a soldier within 40 m. Sun, fill, bounce and grade were set with the
   command building (judged under them); the haze, the sky and the wind belong to the yard */
const ATMO_OP = Object.assign({}, ATMO_DEFAULT, {
  sun: [0.52, 0.8, 0.2], sunColor: 0xfff0d6, sunI: 1.65, vmSun: 0xfff0d6,
  fog: [0.4, 0.51, 0.57], fogD: 0.0052, fogH: [16, 0], fogSun: 0.32,
  hemi: [0xd6d8d6, 0x8c7c62, 1.75], vmHemi: [0xbcd2ec, 0x4a5236],
  sky: {
    zen: [0.2, 0.32, 0.58], mid: [0.4, 0.56, 0.8], hor: [0.76, 0.83, 0.86], gnd: [0.22, 0.27, 0.2],
    glow: [0.5, 0.46, 0.38], halo: [0.7, 0.66, 0.56], disk: [26, 24, 20], cloudLo: [0.58, 0.63, 0.7], cloudHi: [1.32, 1.3, 1.26], cloud: [0.47, 0.67, 0.92],
    ridge: [0, 0.025, 0.5], // (no ridge painted in the sky: the hills are the scenery's own, forested) ridgeSnow: [0.26, 0.36, 0.34], ridgeRock: [0.17, 0.25, 0.24],
  },
  envGround: 0x4a5236, hdri: null, // (the environment comes from this sky: the sunny 'park' HDRI turned the steel blue)
  bounce: [1.15, 1.05, 0.86], dust: [0.6, 0.62, 0.55], motes: [0.85, 0.95, 0.8],
  grade: { lo: [0.99, 1.0, 1.0], hi: [1.04, 1.01, 0.95], exp: 0.91, sat: 1.08, con: 1.08 }, rays: [0.9, 0.85, 0.7],
  impact: [0.34, 0.3, 0.22], wind: [340, 0.07],
  bloom: [0.3, 0.55, 1.1], aoFloor: 0.38, raysThr: 2.2, raysCap: 6, satExp: 0.92,
});

/* ---------- Map definition (see MAP_DEFS in 02-map.js and 02z-load.js) ---------- */
/* Bot points of interest of the yard and the jungle (Alpha half, copied to the south): [x, y, z, route, hold]; L (west: tower, corner cut,
   west trail), M (gate, yard, track), E (east: shed, motor pool, east trail); then the points on the center line (once) */
const OP_POI = [
  [-17.5, 0, 12.5, 'L'], [-13.5, 0, 15.5, 'L'], [-19.5, 0, 22.5, 'L'], [-25.5, 0, 13.5, 'L'], [-30.5, 0, 29.5, 'L'], [-16.5, OPT.deck, 1.5, 'L', 1], [-20.5, OPT.cab, 3.5, 'L'], [-14.5, 0, 11.5, 'L', 1], [-16.5, 0, 6.5, 'L'],
  [0.5, 0, 10.5, 'M'], [4.5, 0, 17.5, 'M', 1], [1.5, 0, 18.5, 'M'], [6.5, 0, 24.5, 'M'], [6.5, 0, 16.5, 'M', 1], [-4.5, 0, 16.5, 'M', 1], [-7.5, 0, 19.5, 'M'], [-6.5, 0, 31.0, 'M'],
  [11.5, 0, 6.5, 'E'], [13.5, 0, 12.5, 'E'], [16.5, 0.12, 2.5, 'E', 1], [25.5, 0, 13.5, 'E'], [30.5, 0, 29.5, 'E'], [18.5, 0, 11.5, 'E', 1],
];
const OP_POI_MID = [[-16.5, OPT.cab, 0.5, 'L', 1], [-16.5, 0, 0.5, 'L'], [-10.5, 0, 0.5, 'L', 1], [10.5, 0, 0.5, 'E'], [15.5, 0.12, 0.5, 'E', 1]];
// a point in the jungle outside the compound, for the ambience: d0 to d1 m from the camera, y0 to y1 high; a point inside the fence
// (or its 4 m strip) is moved out past the nearest side
function opJungleAt(d0, d1, y0, y1) {
  const c = camera.position, a = rand(0, TAU), d = rand(d0, d1), F = OP_FENCE, m = 4;
  let x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
  const ex = Math.min(x - F.x0, F.x1 - x) + m, ez = Math.min(z - F.z0, F.z1 - z) + m;
  if (ex > 0 && ez > 0) { if (ex < ez) x += (x < 0 ? -1 : 1) * (ex + rand(0, 8)); else z += (z < 0 ? -1 : 1) * (ez + rand(0, 8)); }
  return new V3(x, rand(y0, y1), z);
}
MAP_DEFS.outpost = {
  type: 'mid', // compound yard, two-level building, tower, jungle trails: README "Map design rules"; sets the bots' weapon choice
  bounds: { x0: -38, x1: 38, z0: -50, z1: 50 },
  textures: [...new Set(['concrete', 'dirt', 'humus', 'lawn', 'pathgravel', 'sand', ...OP_CP_TEX, ...OP_YARD_TEX])],
  surfaces: [...new Set([...FLORA_SURFACES, ...OP_CP_SURF, ...OP_YARD_SURF])],
  // recorded ambience (05c-ambiance.js, pack amb_outpost): insect chorus and palm fronds in the bed; in the canopy outside the fence, toucan,
  // oropendola, piha and macaw calls and now and then a cicada; a howler troop far off; drips and a frog at the jungle edge; rarely a fly
  // at the player's ear
  sound: { pack: 'amb_outpost', bed: 0.28, spots: [
    { id: 'a_bird', every: [5, 12], gain: 0.4, at: () => opJungleAt(20, 60, 8, 22), ref: 12, roll: 0.9 },
    { id: 'a_monkey', every: [50, 120], gain: 0.45, at: () => opJungleAt(80, 140, 15, 28), ref: 30, roll: 0.6 },
    { id: 'a_cicada', every: [30, 70], gain: 0.35, at: () => opJungleAt(12, 35, 6, 14), ref: 8 },
    { id: 'a_drip', every: [4, 10], gain: 0.3, at: () => opJungleAt(5, 20, 2, 6), ref: 4 },
    { id: 'a_frog', every: [18, 40], gain: 0.3, at: () => opJungleAt(8, 25, 0, 1), ref: 5 },
    { id: 'a_fly', every: [40, 90], gain: 0.2, at: () => camera.position.clone().add(new V3(rand(-2.5, 2.5), rand(-0.4, 0.5), rand(-2.5, 2.5))), ref: 1.5 },
  ] },
  kit: () => { floraKit(); opCpKit(); opYardKit(); },
  materials: (M) => { makeFloraMaterials(M); opCpMaterials(M); opYardMaterials(M); },
  // menu illustration (tools/dev/illustrations.js): hero view of sheet 4, from the north yard by the main gate: the command building front,
  // the guard tower behind it on the left, the shed and the building's stair on the right, the jungle and the hills behind
  art: { cam: [-3.5, 2.2, 19.6], look: [-2.5, 4.6, 0], fov: 68 },
  // blades of grass (02nb-lawn.js): rank jungle grass on the trail verges and the clearings, weeds along the fence; none on the mud,
  // the packed earth or the concrete
  grass: {
    dens: 45,
    density: (x, z) => { const S = OPL.splat; if (!S || !opjInside(x, z, 0.6)) return 0; const g = S.at(2, x, z), m = S.at(0, x, z), c = S.at(1, x, z); return c > 0.2 ? 0 : clamp(g * 1.3 - m * 0.9 - 0.15, 0, 1); },
    height: (x, z, r) => 0.22 + 0.32 * r,
    colors: [[0.05, 0.07, 0.03], [0.2, 0.25, 0.11], [0.36, 0.37, 0.2]],
    wind: [0.6, 0.8, 0.35], width: 0.013, amb: 0.42, seed: 9393,
  },
  splat: { x0: -80, z0: -100, w: 160, d: 200, ppm: 3 },
  far: 300,
  build() { bendInit(MAP); outpostLevel(); },
  update(t, dt) { floraUpdate(t, dt); },
  unload() { bendClear(); OPL.splat = null; LIFE.mats.length = 0; },
  // Alpha spawns in the jungle clearing north of the compound (Bravo: the mirror), hidden from the tower and the yard by the jungle; in its
  // middle and east part, 24 to 28 m of walking from the gate (point A within 30 m, the other side's spawns 90 m away at least)
  spawns: [[0.5, 41.5], [12.5, 41.5], [-1.5, 43.5], [1.5, 43.5], [4.5, 43.5], [10.5, 47.6], [11.5, 43.5], [14.5, 43.5], [0.5, 45.5], [3.5, 45.5], [6.5, 45.5], [9.5, 45.5], [12.5, 45.5], [5.5, 47.5], [8.0, 47.7]],
  poi: OP_POI.flatMap((p) => [p, [p[0], p[1], -p[2], p[3], p[4]]]).concat(OP_POI_MID, OP_CP_POI),
  // domination: A and C in the north and south yards, inside the gate; B at the foot of the guard tower (center line)
  dom: [[6.5, 19.5], [-10.5, 0], [6.5, -19.5]],
  lane: (x) => (x < -9 ? 'L' : x > 9 ? 'E' : 'M'),
  // landmarks: the guard tower, the flagpole (north, in front of the command building), the radio mast (south)
  landmarks: [[-16.0, 10.0, 0, 'guard tower'], [13.6, 8.2, 18.9, 'flagpole'], [21.2, 6.8, -19.4, 'radio mast']],
  sniper: typeof OP_CP_SNIPER !== 'undefined' ? OP_CP_SNIPER : [-16.5, OPT.cab, 0], // the building's sniper post, otherwise the lookout cabin
  coverZ: 38, heli: [34, 46], cam: 52,
  surface: (p) => opSurface(p),
  zones: [
    ...OP_CP_ZONES,
    [_t('Guard Room'), -18.6, -13.4, -2.6, 2.6, 0, 2.5], [_t('Lookout Cabin'), -18.6, -13.4, -2.6, 2.6, 6.0, 11], [_t('Guard Tower'), -21.6, -11.9, -5.3, 5.3, 2.5, 11],
    [_t('Guard Tower'), -21.6, -11.9, -5.3, 5.3], [_t('Utility Shed'), 13.9, 20.1, -3.7, 3.7],
    [_t('Main Gate'), 1, 13, 17, 24], [_t('Rear Gate'), 1, 13, -24, -17],
    [_t('Motor Pool'), 7.6, 23, -21, 21], [_t('North Yard'), -23, 23, 0, 21], [_t('South Yard'), -23, 23, -21, 0],
    [_t('Alpha Base'), -38, 38, 35, 50], [_t('Bravo Base'), -38, 38, -50, -35],
    [_t('West Trail'), -38, -23, -35, 35], [_t('East Trail'), 23, 38, -35, 35], [_t('Jungle'), -38, 38, -50, 50],
  ],
  // photographed sky (assets/sky, 02z-load.js): deep blue with cumulus, the computed sky's green ridges in front of it
  skyPhoto: { key: 'kloofendal_48d', rot: 0.25, gain: 0.85 },
  // the photographed sky half way to the computed one (sheet 4: a pale azure zenith in every direction, a pale haze band at the
  // horizon), set once the map's lighting is baked: the scenery's light and its reflections stay those of the photo
  ready() { const P = SkyShader.uniforms.uSkyP.value; P.z = 0.42; P.y *= 1.55; }, // (and the photo a little brighter: a paler upper sky)
  atmo: ATMO_OP,
};
