/* ==========================================================================
   OUTFIT KIT: reusable pieces of the twenty later challenge outfits (06gf-outfits-maps.js, 06gg-outfits-play.js), built in the rest
   frame like the rest of an outfit, next to the helpers of the first six (06gc-outfits-challenge.js: dSeg, dPlate, dHorn, dSling,
   dGoggles, dScarf, dArmor, dHem). Each outfit is its palette, camouflage and emblem, a choice of these pieces and one piece of its own.
   - head: lathe hats (boonie, wide brim, sou'wester, cap, beret, turban, fur hat) and their recognition band, close caps that follow the
     skull (flight cap), full helmets with a visor panel or a slit and their band, crest, respirator;
   - body: points on the jacket and on the limbs (neon trims, reflective bands, circuit traces, cracks), shoulder domes and thorns,
     packs and their straps, satchels, rope, fur clumps and mantle, buttons, coat body, sleeves, collar, emblem panels;
   - cloth: cape from the shoulders and tails from the belt, at any length, spread and span (06gb-cloth.js); emblem helpers.
   Neons use the "glow" tile (lit by their vertex color, SKINS.<id>.neon), recognition bands the "tag" tile, as in the first six.
   ========================================================================== */
const OFK_WHITE = new THREE.Color(1, 1, 1);
const ofkHM = () => soldierRest().mats[SB.HEA];
const ofkTile = (t) => () => GEAR_TILE[t];

/* ---------- Head ---------- */
/* Lathe in the head frame (hats): o.prof [[r, y]...] (r relative, 1 is the crown base, o.rx by o.rz around o.cz), from the top of the
   crown outward and back under the brim; o.reach(a) stretches the rows beyond r = 1 at angle a (0 in front, π/2 on the right: a brim
   longer at the back), o.dy(a, r, k) raises or lowers a point (droop, tilt, crease); o.col(k, a) or o.c: color; o.tile, o.uvf(a, k)
   (texture coordinates: a camouflaged hat), o.seg */
function ofkLathe(B, hi, o) {
  const hm = ofkHM(), P = o.prof, n = P.length, v = new V3(), rx = o.rx || 0.083, rz = o.rz || 0.106, cz = o.cz === undefined ? 0.004 : o.cz, T = GEAR_TILE[o.tile || 'fab'];
  skinSurf(B, hi ? o.seg || 28 : Math.max(10, (o.seg || 28) >> 1), n - 1, (u, vv, out) => {
    const k = Math.round(vv * (n - 1)), a = u * TAU, r0 = P[k][0], r = r0 > 1 && o.reach ? 1 + (r0 - 1) * o.reach(a) : r0;
    v.set(Math.sin(a) * r * rx, P[k][1] + (o.dy ? o.dy(a, r0, k) : 0), cz - Math.cos(a) * r * rz).applyMatrix4(hm);
    const uv = o.uvf ? o.uvf(a, k) : T; out.x = v.x; out.y = v.y; out.z = v.z; out.w = SB.HEA; out.col = o.col ? o.col(k, a) : o.c; out.U = uv[0]; out.V = uv[1];
  });
}
/* Band around a lathe hat at relative radius r and height y (it follows o.dy): the recognition band ('tag' tile, white), or a hat band of
   another tile and color (glow trim) */
function ofkTagLathe(B, hi, o, r, y, w = 0.022, col = OFK_WHITE, tile = 'tag', g = 0.004, tilt = 0) {
  const hm = ofkHM(), S = [], seg = hi ? 24 : 12, rx = (o.rx || 0.083) * r + g, rz = (o.rz || 0.106) * r + g, cz = o.cz === undefined ? 0.004 : o.cz;
  const c = new V3(0, y, cz).applyMatrix4(hm);
  for (let i = 0; i <= seg; i++) { const a = i / seg * TAU; S.push(new V3(Math.sin(a) * rx, y + (o.dy ? o.dy(a, r, -1) : 0), cz - Math.cos(a) * rz).applyMatrix4(hm)); }
  gBand(B, S, w, 0.004, (p) => { const n = p.clone().sub(c); n.y = 0; n.normalize(); n.y = tilt; return n; }, SB.HEA, col, ofkTile(tile), 4);
}
/* Brim of a cap or visor: front part of an annulus around a lathe hat (same o), from angle -half to half, length len(a) beyond the crown
   base (relative), at height y, falling by droop per meter; top and underside 4 mm apart */
function ofkBrim(B, hi, o, half, len, y, droop, col, tile) {
  const hm = ofkHM(), rx = o.rx || 0.083, rz = o.rz || 0.106, cz = o.cz === undefined ? 0.004 : o.cz, v = new V3(), T = GEAR_TILE[tile];
  for (const under of [false, true]) skinSurf(B, hi ? 12 : 6, hi ? 3 : 1, (u, vv, out) => {
    const a = (u - 0.5) * 2 * half, r = 1 + vv * len(a), d = (r - 1) * rz;
    v.set(Math.sin(a) * r * rx, y - d * droop - d * d * 2 - (under ? 0.004 : 0), cz - Math.cos(a) * r * rz).applyMatrix4(hm);
    out.x = v.x; out.y = v.y; out.z = v.z; out.w = SB.HEA; out.col = under ? col.clone().multiplyScalar(0.6) : col; out.U = T[0]; out.V = T[1];
  }, { out: !under });
}
/* Scarf rolled around the neck (dScarf's bulge) striped by turns: col(k) of each of its five rings */
function ofkScarf(B, hi, col, k = 1, tile = 'fab') {
  const rings = [[1.458, 0.142, 0.094, 0.097, 0.004], [1.474, 0.128, 0.1, 0.1, 0.006], [1.497, 0.107, 0.094, 0.095, 0.006], [1.522, 0.09, 0.081, 0.085, 0.004], [1.545, 0.075, 0.07, 0.076, 0.002]];
  skinLoft(B, rings.map(([y, w, f, bk, zc]) => ({ c: new V3(0, y, zc), X: new V3(1, 0, 0), Y: new V3(0, 0, -1), r: [w * k, w * k, f * k, bk * k], n: 2.2, v: y })), hi ? 14 : 8, {
    wp: (p) => (p.y > 1.5 ? [[SB.NEC, 0.7], [SB.CHE, 0.3]] : torsoW(p)), col: (a, kk) => col(kk), uv: () => GEAR_TILE[tile],
    bump: (a, kk) => (0.012 * Math.sin(a * 5 + kk * 1.9) + 0.005 * Math.sin(a * 9 - kk * 2.3)) * (kk > 0 && kk < 4 ? 1 : 0.3),
  });
}
/* Close cap following the skull (headPt), down to o.th(ph) (rad from the top: low on the sides for ear flaps), o.grow off the head */
function ofkSkullCap(B, hi, o) {
  const hm = ofkHM(), v = new V3(), T = GEAR_TILE[o.tile || 'leat'];
  skinSurf(B, hi ? 32 : 12, hi ? 8 : 3, (u, vv, out) => {
    const ph = (u - 0.5) * TAU, th = vv * o.th(ph);
    headPt(th, ph, v, o.grow + (o.bump ? o.bump(th, ph) : 0)).applyMatrix4(hm);
    out.x = v.x; out.y = v.y; out.z = v.z; out.w = th > 2.2 ? [[SB.HEA, 0.85], [SB.NEC, 0.15]] : SB.HEA; out.col = o.col ? o.col(th, ph, vv) : o.c; out.U = T[0]; out.V = T[1];
  }, { out: true });
}
/* Recognition band of a close cap: around the skull at polar angle th, from one temple to the other via the back when open is set */
function ofkTagSkull(B, hi, th, grow, open = 0, w = 0.024) {
  const hm = ofkHM(), S = [], seg = hi ? 20 : 10, c = new V3(0, 0.0, 0.006).applyMatrix4(hm);
  for (let i = 0; i <= seg; i++) { const ph = open + i / seg * (TAU - 2 * open); S.push(headPt(th, ph, new V3(), grow).applyMatrix4(hm)); }
  gBand(B, S, w, 0.004, (p) => { const n = p.clone().sub(c); n.y = 0; return n; }, SB.HEA, OFK_WHITE, ofkTile('tag'), 4);
}
/* Frame on the head surface at (th, ph), grow off it: x along the surface, y up, z the normal (head pieces: tubes, canisters) */
function ofkHeadFrame(th, ph, grow) {
  const c = headPt(th, ph, new V3(), grow), n = headPt(th, ph, new V3(), grow + 0.05).sub(c).normalize();
  const y = new V3(0, 1, 0).addScaledVector(n, -n.y).normalize(), x = new V3().crossVectors(y, n);
  return ofkHM().clone().multiply(new THREE.Matrix4().makeBasis(x, y, n).setPosition(c));
}
/* Full helmet: faceted ellipsoid (o.s [x, y, z] around o.c, head frame), closed down to o.jaw (rad from the top), pushed forward at the
   face by o.snout and narrower at the cheeks by o.pinch; the same deformation serves its visor and its band (ofkShellPt) */
function ofkShellPt(o) {
  return (x, y, z, g = 0) => {
    const xx = x * (1 - (o.pinch || 0) * Math.max(0, -y)), zz = z < 0 ? z * (1 + (o.snout || 0) * (1 - Math.abs(x))) : z * (1 + (o.back || 0) * Math.max(0, y + 0.3));
    return new V3(xx * (o.s[0] + g), (y + (o.crest || 0) * Math.max(0, -z) * Math.max(0, y)) * (o.s[1] + g), zz * (o.s[2] + g)).add(new V3(...o.c));
  };
}
function ofkShell(B, hi, o, col, tile, phi0 = 0, phiLen = TAU, th0 = 0, thLen = o.jaw, g = 0, segK = 1) {
  const sh = dFlat(new THREE.SphereGeometry(1, Math.max(3, Math.round((hi ? o.seg || 10 : 6) * segK)), hi ? o.rows || 6 : 3, phi0, phiLen, th0, thLen)), P = sh.attributes.position, f = ofkShellPt(o);
  for (let i = 0; i < P.count; i++) { const p = f(P.getX(i), P.getY(i), P.getZ(i), g); P.setXYZ(i, p.x, p.y, p.z); }
  sh.computeVertexNormals();
  B.geo(sh, ofkHM(), SB.HEA, col, ofkTile(tile));
}
/* Visor of a full helmet: band of its shell centered in front, half-width hw (rad), from th0 over thLen, g in front of the shell */
function ofkVisor(B, hi, o, hw, th0, thLen, col, tile, g = 0.006) { ofkShell(B, hi, o, col, tile, Math.PI * 1.5 - hw, hw * 2, th0, thLen, g, hw / Math.PI * 1.4 + 0.3); }
/* Recognition band of a full helmet at polar angle th (on the shell's own vertex ring: no facet passes over it) */
function ofkTagShell(B, hi, o, th, w = 0.02) {
  const hm = ofkHM(), f = ofkShellPt(o), S = [], seg = hi ? o.seg || 10 : 6, c = new V3(...o.c).applyMatrix4(hm);
  for (let i = 0; i <= seg; i++) { const ph = i / seg * TAU; S.push(f(-Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th), 0.006).applyMatrix4(hm)); }
  gBand(B, S, w, 0.004, (p) => { const n = p.clone().sub(c); n.y = 0; return n; }, SB.HEA, OFK_WHITE, ofkTile('tag'), 4);
}
/* Respirator: snout in front of the mouth and two canisters on the cheeks, angled forward and down */
function ofkRespirator(B, G, hi, body, can, ring) {
  const sg = hi ? 12 : 6, H = SB.HEA;
  const m0 = ofkHeadFrame(2.3, 0, 0.012).multiply(gMat(0, 0, 0.018, Math.PI / 2));
  gCyl(B, 0.034, 0.03, 0.04, sg, m0, H, body, 'rub');
  gCyl(B, 0.024, 0.024, 0.006, sg, m0.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.022, 0)), H, ring, 'met');
  for (const s of [-1, 1]) {
    const m = ofkHeadFrame(2.25, s * 0.78, 0.01).multiply(gMat(0, 0, 0.026, Math.PI / 2 + 0.25, 0, -s * 0.3));
    gCyl(B, 0.027, 0.027, 0.05, sg, m, H, can, 'poly');
    gCyl(B, 0.029, 0.029, 0.008, sg, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.022, 0)), H, ring, 'met');
  }
}
/* Point of a hood's own rings (skinHood: same superellipse) at ring k and angle a */
function ofkHoodPt(R, k, a, g = 0) { const r = R[k], c = Math.cos(a), s = Math.sin(a), e = 2 / 2.3; return new V3(Math.sign(s) * Math.pow(Math.abs(s), e) * (r[2] + g), r[0], r[1] - Math.sign(c) * Math.pow(Math.abs(c), e) * (c >= 0 ? r[3] + g : r[4] + g)); }
/* Weights of a hood point (skinHood's): the head at the top, the torso at the bottom */
function ofkHoodW(p) { const t = smoothstep(1.47, 1.56, p.y); if (t >= 1) return SB.HEA; const w = torsoW(p).map((e) => [e[0], e[1] * (1 - t)]); if (t > 0) w.push([SB.HEA, t * 0.7], [SB.NEC, t * 0.3]); return w; }
/* Points along the face opening of a hood (rings R, from ring k0 to k1 on both sides and across the top), every step meters, with their
   outward direction and weights (fur trim) */
function ofkHoodEdge(R, k0, k1, step, closed = false) {
  const o = [], add = (p) => o.push({ p, n: new V3(p.x, 0, p.z + 0.03).normalize().add(new V3(0, 0, -0.6)).normalize(), w: ofkHoodW(p) });
  const edge = (k, t, sd) => { const a = lerp(R[k][5], R[k + 1][5], t); return ofkHoodPt(R, k, sd * a).lerp(ofkHoodPt(R, k + 1, sd * a), t); };
  for (const sd of [-1, 1]) {
    let prev = null;
    for (let k = k0; k < k1; k++) for (let t = 0; t < 1; t += 0.1) { const p = edge(k, t, sd); if (!prev || p.distanceTo(prev) >= step) { add(p); prev = p; } }
  }
  const g = R[k0][5]; for (let a = -g + step / 0.12; a < g; a += step / 0.12) add(ofkHoodPt(R, k0, a));
  if (closed) { const h = R[k1][5]; for (let a = -h + step / 0.13; a < h; a += step / 0.13) add(ofkHoodPt(R, k1, a)); } // (a ring: under the chin too)
  return o;
}

/* ---------- Body surfaces ---------- */
/* Point of the jacket (SOLDIER_SHIRT) at height y and angle A (0 in front, π/2 on the soldier's right), g off the fabric */
function ofkShirtPt(y, A, g = 0, o = new V3()) {
  const c = Math.cos(A), s = Math.sin(A), e = 2 / 2.4, r = (i) => gjShirt(y, i) + g;
  return o.set(Math.sign(s) * Math.pow(Math.abs(s), e) * r(1), y, gjShirt(y, 4) - Math.sign(c) * Math.pow(Math.abs(c), e) * (c >= 0 ? r(2) : r(3)));
}
/* Band along the jacket through [[y, A]...] (neon trim, crack, reflective band); o: w, g, col, tile */
function ofkShirtLine(B, hi, pts, o) {
  const S = pts.map(([y, A]) => ofkShirtPt(y, A, o.g || 0.006));
  gBand(B, S, o.w || 0.01, 0.004, (p) => new V3(p.x, 0, p.z - gjShirt(p.y, 4)), (p) => torsoW(p), o.col, ofkTile(o.tile || 'glow'), hi ? 5 : 4);
}
/* Radius of the sleeve and of the trouser leg at distance d along the limb (soldierBase profiles, highest side, without folds) */
const OFK_ARM = [[-0.04, 0.061], [0.04, 0.062], [0.09, 0.055], [0.14, 0.054], [0.2, 0.051], [0.25, 0.046], [0.29, 0.045], [0.33, 0.049], [0.37, 0.048], [0.42, 0.043], [0.47, 0.038], [0.505, 0.035], [0.53, 0.039]];
const OFK_LEG = [[-0.09, 0.098], [-0.03, 0.1], [0.03, 0.1], [0.1, 0.092], [0.18, 0.084], [0.26, 0.075], [0.33, 0.066], [0.39, 0.06], [0.43, 0.063], [0.47, 0.062], [0.53, 0.07], [0.58, 0.066], [0.625, 0.059], [0.66, 0.068], [0.7, 0.07]];
function ofkLimbR(arm, d) { const T = arm ? OFK_ARM : OFK_LEG; let k = 0; while (k < T.length - 2 && T[k + 1][0] < d) k++; return lerp(T[k][1], T[k + 1][1], clamp((d - T[k][0]) / (T[k + 1][0] - T[k][0]), 0, 1)); }
/* Frame of a limb (side sx, arm or leg) at distance d: pt(ang, g) is the point at angle ang around it (0: outward, π/2 toward the front
   for a leg, toward the top for an arm), g off the fabric; c: the axis; w: weights */
function ofkLimb(sx, arm, d) {
  const R = soldierRest(), b = SIDE_B(sx), L1 = arm ? SD.ua : SD.thigh, two = d > L1, m = R.mats[arm ? (two ? b.fa : b.ua) : (two ? b.sh : b.th)], dd = two ? d - L1 : d;
  const inv = new THREE.Matrix4().copy(m).invert(), out = new V3(sx, 0, 0).transformDirection(inv); out.z = 0; out.normalize();
  const sec = new V3(0, 0, -1).cross(out).normalize(), ref = new V3(0, arm ? 1 : 0, arm ? 0 : -1).transformDirection(inv);
  if (sec.dot(ref) < 0) sec.negate();
  const r = ofkLimbR(arm, d) * (arm ? 1.03 : 1);
  return { m, r, c: new V3(0, 0, -dd).applyMatrix4(m), w: arm ? armW(b)(d) : legW(b)(d),
    pt: (ang, g) => new V3().addScaledVector(out, Math.cos(ang) * (r + g)).addScaledVector(sec, Math.sin(ang) * (r + g)).setZ(-dd).applyMatrix4(m) };
}
/* Ring around a limb (cuff, reflective band, bracer edge) */
function ofkLimbRing(B, hi, sx, arm, d, w, g, col, tile) {
  const F = ofkLimb(sx, arm, d), S = [], seg = hi ? 14 : 8;
  for (let i = 0; i <= seg; i++) S.push(F.pt(i / seg * TAU, g));
  gBand(B, S, w, 0.004, (p) => p.clone().sub(F.c), F.w, col, ofkTile(tile), 4);
}
/* Recognition marks over a coat or jacket that hides the body's: an armband on each sleeve (g off the arm: over the sleeve) and, up close,
   the chest patch at (y, A) on the coat front (gc: the coat's g) */
function ofkTagArms(B, hi, g) { for (const sx of [-1, 1]) ofkLimbRing(B, hi, sx, true, 0.15, 0.07, g, OFK_WHITE, 'tag'); }
function ofkTagPatch(B, hi, y, A, gc) {
  if (!hi) return;
  const p = ofkShirtPt(y, A, gc + 0.004), n = ofkShirtPt(y, A, gc + 0.03).sub(p).normalize(), x = new V3().crossVectors(new V3(0, 1, 0), n).normalize();
  gBox(B, 0.055, 0.04, 0.004, 0.0015, new THREE.Matrix4().makeBasis(x, new V3().crossVectors(n, x), n).setPosition(p), torsoW(p), OFK_WHITE, 'tag');
}
/* Line along a limb from d0 to d1 at angle ang (or ang(d) for a zigzag), g off the fabric */
function ofkLimbLine(B, hi, sx, arm, d0, d1, ang, w, g, col, tile, n = 6) {
  const S = [], C = [], W = [];
  for (let i = 0; i <= n; i++) { const d = lerp(d0, d1, i / n), F = ofkLimb(sx, arm, d); S.push(F.pt(typeof ang === 'function' ? ang(d) : ang, g)); C.push(F.c); W.push(F.w); }
  gBand(B, S, w, 0.004, (p) => { let k = 0, b = 1e9; S.forEach((q, i) => { const e = q.distanceToSquared(p); if (e < b) { b = e; k = i; } }); return p.clone().sub(C[k]); },
    (p, a, s) => W[Math.round(s.v * n)], col, ofkTile(tile), 4);
}

/* ---------- Shoulders, packs, straps ---------- */
/* Shoulder dome (pauldron): faceted ellipsoid cap r [x, y, z] over shoulder sx, off [out, up, forward], rolled outward by roll;
   o.k: share of the arm in its weights */
function ofkDome(B, hi, sx, o) {
  const sh = soldierRest().J[SIDE_B(sx).jSh], g = dFlat(new THREE.SphereGeometry(1, hi ? o.seg || 9 : 6, hi ? o.rows || 4 : 2, 0, TAU, 0, o.cut || 1.6));
  const m = new THREE.Matrix4().compose(new V3(sh.x + sx * o.off[0], sh.y + o.off[1], sh.z + o.off[2]), new THREE.Quaternion().setFromEuler(new THREE.Euler(o.pitch || 0, 0, -sx * (o.roll === undefined ? 0.5 : o.roll))), new V3(...o.r));
  B.geo(g, m, dShoulderW(sx, o.k === undefined ? 0.45 : o.k), o.col, ofkTile(o.tile || 'plate'));
  return m;
}
/* Thorns or spikes on a dome (matrix m from ofkDome): n of them along its top, length len */
function ofkSpikes(B, hi, sx, m, n, len, r, col, tile, seed = 3) {
  const R = mulberry32(seed + (sx > 0 ? 1 : 0)), wS = dShoulderW(sx, 0.45);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + R() * 0.4, th = 0.35 + R() * 0.7, p = new V3(Math.cos(a) * Math.sin(th), Math.cos(th), Math.sin(a) * Math.sin(th));
    const b = p.clone().applyMatrix4(m), dir = b.clone().sub(new V3().setFromMatrixPosition(m)).normalize().add(new V3(0, 0.6, 0)).normalize();
    dHorn(B, [b.clone().addScaledVector(dir, -0.006), b.clone().addScaledVector(dir, len * (0.7 + R() * 0.5))], r, 0.001, wS, col, tile, hi ? 5 : 3);
  }
}
/* Back pack: box at height y against the back (z: its front face), w x h x d, slightly tilted; returns its matrix */
function ofkPack(B, hi, o) {
  const m = gMat(o.x || 0, o.y, o.z + o.d / 2, -0.07);
  gBox(B, o.w, o.h, o.d, 0.014, m, SB.CHE, o.col, o.tile || ((u, v) => atlasUV('web', u * 0.4, v * 0.4)), -0.4, hi ? 2 : 0);
  if (o.flap) gBox(B, o.w * 1.02, o.h * 0.32, 0.012, 0.004, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, o.h * 0.36, o.d / 2 + 0.004)), SB.CHE, o.flap, 'nyl');
  return m;
}
/* Pack shoulder straps (without plate carrier): from the top of the pack over the trapezius down to the chest */
function ofkPackStraps(B, hi, col, w = 0.045) {
  for (const sx of [-1, 1]) {
    const pts = [[0.085, 1.33, 0.13], [0.1, 1.45, 0.075], [0.105, 1.49, -0.0], [0.105, 1.44, -0.085], [0.1, 1.33, -0.128], [0.105, 1.2, -0.13]].map(([x, y, z]) => new V3(x * sx, y, z));
    gBand(B, pts, w, 0.01, (p) => new V3(p.x * 0.3, p.y - 1.3, p.z).normalize(), (p) => torsoW(p), col, (u, v) => atlasUV('web', u * 0.3, v), hi ? 8 : 4);
  }
}
/* Satchel (bag with a flap and a buckle) at p, facing out, size [w, h, d]; wt: weights */
function ofkSatchel(B, hi, p, out, s, col, flap, buckle, wt) {
  const z = out.clone().normalize(), y = new V3(0, 1, 0).addScaledVector(z, -z.y).normalize(), x = new V3().crossVectors(y, z), m = new THREE.Matrix4().makeBasis(x, y, z).setPosition(p.clone().addScaledVector(z, s[2] / 2));
  gBox(B, s[0], s[1], s[2], hi ? 0.01 : 0, m, wt, col, 'nyl');
  gBox(B, s[0] * 1.04, s[1] * 0.5, 0.008, hi ? 0.003 : 0, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, s[1] * 0.27, s[2] / 2 + 0.003)), wt, flap, 'leat');
  if (hi && buckle) gBox(B, 0.018, 0.022, 0.006, 0, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, s[1] * 0.05, s[2] / 2 + 0.008)), wt, buckle, 'brass', 0, 0);
}
/* Rope (round tube) along pts */
function ofkRope(B, hi, pts, r, col, wt) { dHorn(B, pts, r, r, wt, col, 'fab', hi ? 6 : 4); }
/* Fur: thick faceted clumps at points { p, n (outward), w (weights) }, overlapping (size s, a third of it sunk in), flattened along n and
   drooping a little, in fur colors cols (a ruff, a collar, a hat: one mass, not strands or pebbles) */
function ofkClumps(B, hi, pts, s, cols, seed = 7) {
  const R = mulberry32(seed), g = dFlat(new THREE.IcosahedronGeometry(1, hi ? 1 : 0)), q = new THREE.Quaternion(), up = new V3(0, 1, 0);
  pts.forEach((P, i) => {
    const k = s * (0.8 + R() * 0.45), col = cols[Math.floor(R() * cols.length)], tw = R() * TAU, sq = 0.62 + R() * 0.2;
    if (!hi && i % 2) return;
    q.setFromUnitVectors(up, P.n).multiply(new THREE.Quaternion().setFromAxisAngle(up, tw));
    const m = new THREE.Matrix4().compose(P.p.clone().addScaledVector(P.n, k * 0.25).add(new V3(0, -k * 0.12, 0)), q, new V3(k * (hi ? 1.1 : 1.4), k * sq, k * (hi ? 1.1 : 1.4)));
    B.geo(g, m, P.w, col, ofkTile('hair'));
  });
}
/* Sleeve or trouser cover over a limb (side sx), from d0 to d1 along it, g off the fabric (coat sleeves, a leather jacket's arms,
   puttees): rings on the limb frames, weighted like the limb; o.bulge(v): extra thickness along it, o.col(u, v), o.uv(u, v) (the coat's
   canvas from the emblem zone, matching its tails) */
function ofkLimbTube(B, hi, sx, arm, d0, d1, g, col, tile, o = {}) {
  const n = hi ? o.n || 8 : 3, F = []; for (let j = 0; j <= n; j++) F.push(ofkLimb(sx, arm, lerp(d0, d1, j / n)));
  const T = GEAR_TILE[tile];
  skinSurf(B, hi ? 16 : 8, n, (u, v, out) => {
    const f = F[Math.round(v * n)], p = f.pt(u * TAU, g + (o.bulge ? o.bulge(v) : 0));
    const q = o.uv ? o.uv(u, v) : T; out.x = p.x; out.y = p.y; out.z = p.z; out.w = f.w; out.col = o.col ? o.col(u, v) : col; out.U = q[0]; out.V = q[1];
  });
}
/* Coat body over the jacket (without plate carrier): from the belt to the base of the neck, open in front (gap0 rad each side of the front at
   the belt, gap1 at the chest), g off the jacket and flaring by o.flare at the belt to meet tails from the belt (ofkTails); edges darker; o.uv(A, y)
   (an emblem on the back), o.col, o.tile */
function ofkCoat(B, hi, o) {
  const Y = [1.05, 1.1, 1.17, 1.24, 1.31, 1.37, 1.41, 1.445, 1.47, 1.485], v = new V3(), T = GEAR_TILE[o.tile || 'fab'], edge = o.col.clone().multiplyScalar(0.6);
  for (const inner of [false, true]) skinSurf(B, hi ? 30 : 14, Y.length - 1, (u, vv, out) => {
    const y = Y[Math.round(vv * (Y.length - 1))], gap = lerp(o.gap0, o.gap1, smoothstep(1.08, 1.42, y)) * (1 - smoothstep(1.45, 1.485, y) * 0.6), A = gap + u * (TAU - 2 * gap);
    ofkShirtPt(y, A, o.g + Math.max(0, 1.17 - y) * (o.flare === undefined ? 0.22 : o.flare) - (inner ? 0.004 : 0), v);
    out.x = v.x; out.y = v.y; out.z = v.z; out.w = torsoW(v); out.col = inner ? edge : u < 0.025 || u > 0.975 ? edge : o.col;
    const q = o.uv ? o.uv(A, y) : T; out.U = q[0]; out.V = q[1];
  }, { out: inner }); // (the grid runs around then up: its natural faces look inward)
}
/* Standing collar around the neck, open in front by gap (rad each side), from y0 to y1, flaring out by flare at the top */
function ofkCollar(B, hi, gap, y0, y1, r0, flare, col, tile) {
  const v = new V3(), T = GEAR_TILE[tile];
  for (const inner of [false, true]) skinSurf(B, hi ? 18 : 8, 2, (u, vv, out) => {
    const A = gap + u * (TAU - 2 * gap), y = lerp(y0, y1, vv), r = r0 + flare * vv * vv - (inner ? 0.004 : 0);
    v.set(Math.sin(A) * r, y, 0.006 - Math.cos(A) * r * 0.92);
    out.x = v.x; out.y = v.y; out.z = v.z; out.w = y > 1.5 ? [[SB.NEC, 0.6], [SB.CHE, 0.4]] : torsoW(v); out.col = inner ? col.clone().multiplyScalar(0.6) : col; out.U = T[0]; out.V = T[1];
  }, { out: inner });
}
/* Mantle over the shoulders (fur cape collar): from the neck to y bottom, rings like a short poncho, lumpy by bump; weighted like the
   poncho (it rides the deltoids when the arms rise) */
function ofkMantle(B, hi, bottom, spread, bump, col, tile, cols, fz = 0) {
  const R = [[1.5, 0.08, 0.068, 0.075], [1.48, 0.15, 0.115 + fz * 0.5, 0.118], [1.45, 0.235, 0.16 + fz, 0.15], [1.41, 0.29 * spread, 0.19 + fz, 0.17], [bottom, 0.31 * spread, 0.215 + fz, 0.19]];
  const S = R.map(([y, w, f, bk]) => ({ c: new V3(0, y, 0), X: new V3(1, 0, 0), Y: new V3(0, 0, -1), r: [w, w, f, bk], n: 2.2, v: y }));
  skinLoft(B, S, hi ? 30 : 12, { wp: (p, a) => ponchoWeights(p, Math.PI / 2 - a), uv: () => GEAR_TILE[tile], col: (a, k) => (cols ? cols[(Math.round(a * 3) + k) % cols.length] : col),
    bump: (a, k) => (k > 0 ? bump * (0.6 + 0.4 * Math.sin(a * 9 + k * 2.1)) : 0) });
}
/* Box showing a region of the emblem ("art" zone, u0..u1 x v0..v1 from the top) on its front face: a patch, a back panel */
function ofkArtBox(B, w, h, d, m, wt, col, u0, v0, u1, v1) {
  gBox(B, w, h, d, 0, m, wt, col, (u, v) => atlasUV('art', lerp(u0, u1, u), lerp(v0, v1, 1 - v)), 0, 0);
}
/* Points of a collar around the base of the neck (rows of rings on the trapezius), for fur */
function ofkCollarPts(rows, n, g) {
  const o = [];
  rows.forEach(([y, k], j) => { for (let i = 0; i < n; i++) { const A = (i + (j % 2) * 0.5) / n * TAU, p = ofkShirtPt(y, A, g * k); o.push({ p, n: new V3(p.x, 0.6, p.z - gjShirt(y, 4)).normalize(), w: y > 1.47 ? [[SB.NEC, 0.4], [SB.CHE, 0.6]] : torsoW(p) }); } });
  return o;
}
/* Buttons or toggles down the front of the jacket: from y0 to y1, n of them, round (brass) or bar (bone) */
function ofkButtons(B, hi, y0, y1, n, col, tile, bar = false, x = 0, g = 0.004) {
  for (let i = 0; i < n; i++) {
    const y = lerp(y0, y1, n > 1 ? i / (n - 1) : 0), A = x / 0.105, p = ofkShirtPt(y, A, g), m = gMat(p.x, p.y, p.z, Math.PI / 2, 0, 0);
    if (bar) gCyl(B, 0.007, 0.007, 0.038, hi ? 6 : 4, m.multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)), torsoW(p), col, tile);
    else gCyl(B, 0.012, 0.012, 0.007, hi ? 8 : 5, m, torsoW(p), col, tile);
  }
}

/* ---------- Cloth ---------- */
/* Cape from the shoulders: collar ring, shoulders, then down to y bottom spreading by flare (half-width gained at the bottom); swept around
   the back from a0 to a1 (π: middle of the back; numbers or functions of the relative height); o.uv(s, t) (the emblem: 'art', default),
   o.hem (dHem), o.slack (free play per meter below the collar), o.cu, o.rv */
function ofkCapeRings(bottom, flare = 0.045, back = 0) {
  const R = [[1.47, 0.19, 0.12, 0.095], [1.31, 0.225, 0.2, 0.205 + back]], n = Math.max(1, Math.round((1.31 - bottom) / 0.3));
  for (let i = 1; i <= n; i++) { const t = i / n; R.push([lerp(1.31, bottom, t), 0.225 + flare * t, 0.2 + flare * 0.6 * t, 0.205 + back + flare * 0.6 * t]); }
  return R;
}
function ofkCape(o) {
  const span = o.span || 1.05;
  return clothRing({ rings: o.rings || ofkCapeRings(o.bottom, o.flare, o.back), a0: o.a0 === undefined ? Math.PI - span : o.a0, a1: o.a1 === undefined ? Math.PI + span : o.a1,
    cu: o.cu || 13, rv: o.rv || Math.round((1.47 - o.bottom) / 0.085) + 3, hem: o.hem, col: o.col,
    w: (p, a) => ponchoWeights(p, a), maxD: (p) => 0.02 + Math.max(0, 1.47 - p.y) * (o.slack || 0.7), uv: o.uv || ((s, t) => atlasUV('art', 1 - s, t)), shade: o.shade === undefined ? 0.6 : o.shade });
}
/* Tails from the belt down to y bottom (coat tails, skirt, jacket hem), swept from a0 to a1 */
function ofkTails(o) {
  // o.coat: g of a coat body (ofkCoat, flare 0) above: the tails start exactly on its waist ring, same shape (no shelf at the belt)
  const r0 = o.coat !== undefined ? [gjShirt(1.05, 1) + o.coat, gjShirt(1.05, 2) + o.coat, gjShirt(1.05, 3) + o.coat] : [0.176, 0.12, 0.123];
  const R = [[1.05, ...r0]], n = Math.max(1, Math.round((1.05 - o.bottom) / 0.25)), f = o.flare || 0.04;
  for (let i = 1; i <= n; i++) { const t = i / n; R.push([lerp(1.05, o.bottom, t), lerp(r0[0], 0.18, Math.min(1, t * 2)) + f * t, lerp(r0[1], 0.135, Math.min(1, t * 2)) + f * 1.1 * t, lerp(r0[2], 0.15, Math.min(1, t * 2)) + f * 1.4 * t]); }
  return clothRing({ rings: R, a0: o.a0, a1: o.a1, cu: o.cu || 11, rv: o.rv || Math.round((1.05 - o.bottom) / 0.07) + 3, hem: o.hem, col: o.col, e: o.coat !== undefined ? 2 / 2.4 : undefined,
    w: (p) => clothHipW(p), maxD: (p, t) => 0.015 + t * (o.slack || 0.34), uv: o.uv || ((s, t) => atlasUV('art', 1 - s, t)), shade: o.shade === undefined ? 0.55 : o.shade });
}
/* Petal (leaf) hanging from p0 toward dir over len: narrow at the base, widest at 40 %, pointed at the tip, width wd along side; o.uv(s, t) */
function ofkPetal(o) {
  const p = new V3();
  return { cu: o.cu || 3, rv: o.rv || 7, shade: o.shade === undefined ? 0.6 : o.shade, node: (i, j, nd) => {
    const s = i / ((o.cu || 3) - 1), t = j / ((o.rv || 7) - 1), wd = o.wd * Math.pow(Math.sin(Math.PI * (0.18 + 0.82 * t)), 0.75) * (1 - 0.15 * t);
    p.copy(o.p0).addScaledVector(o.dir, o.len * t).addScaledVector(o.side, (s - 0.5) * wd).addScaledVector(o.nrm, o.cup ? o.cup * Math.sin(Math.PI * s) * t : 0);
    nd.p.copy(p); nd.w = o.w(p, t); nd.maxD = 0.015 + t * o.len * 0.6;
    const q = o.uv(s, t); nd.uv[0] = q[0]; nd.uv[1] = q[1]; if (o.col) nd.col = o.col;
  } };
}
/* Rest point of a cloth model T at grid (s, t) of its sheet number q: satellite pieces sewn on it (glow trims, embers) follow the nearest particle */
function ofkClothAt(T, q, s, t) {
  const S = T.sheets[q], i = Math.round(s * (S.cu - 1)), j = Math.round(t * (S.rv - 1)), k = S.o + j * S.cu + i;
  return { k, p: new V3().fromArray(T.rest, k * 3) };
}
/* Glowing (or plain) quads sewn on a cloth along its grid: list of [s, t] per sheet q, size r; returns the quads for clothSatBuild */
function ofkClothDots(T, q, st, r, col, tile = 'glow', lift = 0.005) {
  const N = new Float32Array(T.n * 3); clothNormals(T, T.rest, N);
  const tl = GEAR_TILE[tile], out = [], nn = new V3(), sd = new V3(), d = new V3();
  for (const [s, t, k2] of st) {
    const A = ofkClothAt(T, q, s, t); nn.fromArray(N, A.k * 3);
    sd.set(1, 0, 0).addScaledVector(nn, -nn.x).normalize(); d.crossVectors(nn, sd);
    const c = A.p.clone().addScaledVector(nn, lift), rr = r * (k2 || 1), P = [c.clone().addScaledVector(d, rr), c.clone().addScaledVector(sd, rr * 1.4), c.clone().addScaledVector(d, -rr), c.clone().addScaledVector(sd, -rr * 1.4)];
    out.push({ k: A.k, P, uv: [tl, tl, tl, tl], col, colB: col });
  }
  return out;
}

/* ---------- Emblems ---------- */
/* Woven canvas: base color, fine diagonal twill ribs (crisp, no blotches: those read as stains), grime toward the bottom */
function ofkArtCloth(g, W, H, base, seed, grime = 0.4, n = 140) {
  const R = mulberry32(seed);
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  g.save(); g.beginPath(); g.rect(0, 0, W, H); g.clip(); g.lineWidth = 1;
  for (let x = -H, i = 0; x < W; x += 4, i++) { g.strokeStyle = i % 2 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.035)'; g.beginPath(); g.moveTo(x, H); g.lineTo(x + H * 0.6, 0); g.stroke(); }
  g.restore();
  for (let i = 0; i < n * 6; i++) R(); // (the same draws as the former patches: what the caller places with R next does not move)
  const gr = g.createLinearGradient(0, H * 0.5, 0, H); gr.addColorStop(0, 'rgba(30,24,18,0)'); gr.addColorStop(1, `rgba(30,24,18,${grime})`); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  return R;
}
function ofkPoly(g, pts) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); }
/* Gear colors of an outfit: the common keys of the body (vest, belt, boots...) from a few colors, plus its own */
function ofkGear(c, own) {
  return Object.assign({ vest: c.vest, pouch: c.pouch || c.vest, helm: c.helm || c.vest, glove: c.glove, boot: c.boot, sole: c.sole || '#1a1a1a', belt: c.belt || c.vest, poly: c.poly || '#1c1c1c',
    cup: c.cup || c.vest, knee: c.knee || c.vest, knit: c.knit || c.glove, mask: c.mask || c.glove, lens: c.lens || '#0c0e10', patch: c.patch || c.vest, symc: c.symc || '#d8d3c8' }, own);
}
