/* ==========================================================================
   WEAPON MODELS: registry, build key, assembly
   A weapon model (GUN_MODELS) is a function that places the body pieces in a group and fills in the info object
   (positions of the hands, magazine, muzzle, sight, attachment mount points). A mounted weapon
   is designated by its key "model~attachments~camo" (gunKey), for example "m4~red.sil~desert": the same model
   can thus exist with several attachment sets, each built once then shared (first person, soldiers,
   ground weapons).
   Mount points (info.mount), in the weapon frame (the barrel points toward -z):
     optic  { y: top of the rail, z: center, len, D: distance from the eye to the rear plane of the sighting parts }
     muzzle { y, z: end of the barrel, r: barrel radius } | under { y: underside of the handguard, z } | side { x, y, z: left flank }
   A model without its own optical sight builds its metal sighting parts (info.irons) only if no
   attachment occupies the optic slot.
   ========================================================================== */
const GUN_MODELS = {};
function defineGun(id, fam, build) { GUN_MODELS[id] = { id, fam, build }; }

/* ---------- Build key ---------- */
const _gunSpecs = {};
function gunKey(model, att, camo) {
  const a = (att || []).slice().sort((x, y) => ATT_SLOTS.indexOf(ATT[x].slot) - ATT_SLOTS.indexOf(ATT[y].slot));
  return model + (a.length || camo ? '~' + a.join('.') : '') + (camo ? '~' + camo : '');
}
function gunSpec(key) {
  let s = hasKey(_gunSpecs, key) ? _gunSpecs[key] : null; if (s) return s;
  const [model, a = '', camo = ''] = key.split('~');
  const att = a ? a.split('.').filter((id) => hasKey(ATT, id)) : [], A = {};
  for (const id of att) A[ATT[id].slot] = id;
  return (_gunSpecs[key] = { key, model, att, A, camo: camo && hasKey(CAMOS, camo) ? camo : null });
}
/* Animation family of a model (rifle, smg, sniper, shotgun, pistol) */
function gunFam(key) { return GUN_MODELS[gunSpec(key).model].fam; }

/* ---------- Assembly ---------- */
function buildGunModel(key) {
  const spec = gunSpec(key), B = GUN_MODELS[spec.model], M = camoMaterials(spec.camo), g = new THREE.Group();
  const info = {
    group: g, muzzle: new THREE.Object3D(), eject: new THREE.Object3D(), mag: new THREE.Group(), magHome: new V3(), gripR: new V3(), gripL: new V3(),
    sightY: 0.1, adsZ: 0.26, bolt: null, kind: B.fam, model: spec.model, key, spec, keep: [], mount: {}, gripDef: null, trigDef: null,
    butt: null, magP: null, tubeFed: false, pump: null, laser: null, magExt: 1, lFrame: null,
  };
  g.add(info.muzzle, info.eject, info.mag);
  const A = spec.A;
  const c = { g, M, info, A, spec, bl: A.barrel === 'long' ? 0.07 : A.barrel === 'short' ? -0.07 : 0, stock: A.stock || null, optic: !!A.optic };
  B.build(c);
  attachAll(c); // attachments (06p-attachments.js): optic, muzzle, underbarrel, laser, magazine
  if (info.buildMag) {
    const raw = info.buildMag, ext = info.magExt;
    info.buildMag = (parent) => raw(parent, ext);
    info.buildMag(info.mag);
  }
  info.mag.position.copy(info.magHome);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return info;
}

/* ---------- Hand grips ----------
   Grip shapes (weapon space): what the fingers of each hand touch as they close (see handGrasp).
   Rounded boxes { c, h: half-sides, r: rounding, rx: tilt }; the pistol's support hand also touches the
   fingers of the right hand. gripDef { R, L }: shapes of the two hands; trigDef: weapon trigger for the index finger (see
   indexToTrigger): at, point where the finger axis comes at the middle of the last phalanx (in front of the trigger face);
   xTip, limit of the fingertip on the left side; guard, pieces the index finger goes around in addition to the shapes of the right hand
   (trigger guard, trigger, magazine well). */
const GRIP_SHAPES = {};
function gripShapes(m) {
  if (!GRIP_SHAPES[m.key] && m.gripDef) {
    const D = m.gripDef, R = D.R.map(gripShape), T = m.trigDef;
    if (T) R.trig = { at: new V3(...T.at), xTip: T.xTip, shapes: R.concat(T.guard.map(gripShape)) };
    GRIP_SHAPES[m.key] = { R, L: D.L.map(gripShape) };
  }
  return GRIP_SHAPES[m.key];
}
/* Support hand under the handguard (hand frame q, hand origin on the palm normal through the grip point G):
   distance from G to the hand origin so that the palm rests on the weapon without entering it. Grid of 2.5 mm cells in the palm
   plane: each cell keeps the depth of the underside of the palm (faces of the palm of the hand mesh) and the height of the weapon
   toward the hand (faces of the pieces); the palm goes down to the tightest cell. The weapon mesh, not its approximate
   grip shapes: rails, lights, folded bipod or magazine under the palm count. The hand can roll around the
   handguard (poseArmToHand): one height per roll (n values over [-range, range], barrel axis in the hand frame),
   interpolated by liftAt. Once per mounted weapon (lHandFrame). */
const PG = { c: 0.0025, x0: -0.05, z0: -0.06, nx: 40, nz: 60, pad: 0.008, soft: 0.0025, softT: 0.0045 };
const PALM_GRIDS = {}; // by squashing the base of the fingers
/* samples the triangle (a, b, c) at most every step, in proportion to its area (rows parallel to the longest edge,
   getting shorter toward the opposite vertex): f(point) for each sample */
const _tsP = new V3(), _tsU = new V3(), _tsW = new V3();
function triSamples(a, b, c, step, f) {
  const lab = a.distanceToSquared(b), lbc = b.distanceToSquared(c), lca = c.distanceToSquared(a);
  let P = a, Q = b, R = c;
  if (lbc >= lab && lbc >= lca) { P = b; Q = c; R = a; } else if (lca >= lab && lca >= lbc) { P = c; Q = a; R = b; }
  const L = P.distanceTo(Q), h = L > 1e-9 ? _tsU.subVectors(Q, P).cross(_tsW.subVectors(R, P)).length() / L : 0;
  const nL = Math.max(1, Math.ceil(L / step)), nh = Math.max(1, Math.ceil(h / step));
  for (let j = 0; j <= nh; j++) {
    const t = j / nh, k = Math.max(1, Math.round(nL * (1 - t)));
    _tsU.lerpVectors(P, R, t); _tsW.lerpVectors(Q, R, t);
    for (let i = 0; i <= k; i++) f(_tsP.lerpVectors(_tsU, _tsW, i / k));
  }
}
const pgCell = (p) => { const ix = Math.floor((p.x - PG.x0) / PG.c), iz = Math.floor((p.z - PG.z0) / PG.c); return ix >= 0 && ix < PG.nx && iz >= 0 && iz < PG.nz ? iz * PG.nx + ix : -1; };
function palmGrid(soft = PG.soft) {
  if (PALM_GRIDS[soft]) return PALM_GRIDS[soft];
  const H = handBones(1), g = handGeometry(1, H.u, H.h), pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, idx = g.index;
  const D = new Float32Array(PG.nx * PG.nz).fill(1), T = [new V3(), new V3(), new V3()];
  const palm = (i) => { let w = 0; for (let j = 0; j < 4; j++) if (si.array[i * 4 + j] === 0) w += sw.array[i * 4 + j]; return w > 0.99 && pos.getY(i) < -0.004; };
  for (let t = 0; t < idx.count; t += 3) { // faces of the underside of the palm (palm bone)
    const i0 = idx.getX(t), i1 = idx.getX(t + 1), i2 = idx.getX(t + 2);
    if (!palm(i0) || !palm(i1) || !palm(i2)) continue;
    T[0].fromBufferAttribute(pos, i0); T[1].fromBufferAttribute(pos, i1); T[2].fromBufferAttribute(pos, i2);
    triSamples(T[0], T[1], T[2], 0.0015, (p) => { const k = pgCell(p); if (k >= 0 && p.y < D[k]) D[k] = p.y; });
  }
  // base of the fingers, fingers extended: underside of the proximal phalanx, from the joint up to PG.pad (m) further, pulp squashed by
  // soft (m). A grip does not make it rise (the fingers close toward the weapon): if it touches the corner of a flat-bottomed
  // handguard (FAMAS), the hand goes down by the same amount instead of the base of the index finger entering the weapon. The soldiers' frozen hand holds less of it
  // counts (PG.softT): otherwise its palm floats above a folded bipod, which its fingers cannot wrap around
  const p = new V3();
  for (const F of FINGERS) for (let s = 0; s <= PG.pad; s += 0.0015) for (let dx = -0.7 * F.r; dx <= 0.7 * F.r + 1e-6; dx += 0.0015) {
    p.set(F.x + dx, F.y - Math.sqrt(F.r * F.r - dx * dx) + soft, F.z - s); const k = pgCell(p); if (k >= 0 && p.y < D[k]) D[k] = p.y;
  }
  return (PALM_GRIDS[soft] = D);
}
function palmLift(group, G, q, oz, axis, range, n, soft = PG.soft) { return palmLifts(group, [G], q, oz, axis, range, n, soft)[0]; }
/* palmLift for several grip points Gs at once (along a recoil): the weapon faces are sampled once and
   each sample rotated once per roll, for all the points */
function palmLifts(group, Gs, q, oz, axis, range, n, soft = PG.soft) {
  // samples (every 3 mm) of the weapon faces near the grip and facing the palm (weapon frame, origin at G)
  const G = Gs[0], dG = Gs.map((g) => g.clone().sub(G)), M = new THREE.Matrix4(), gi = new THREE.Matrix4(), P = [], R0 = 0.12, down = new V3(0, 1, 0).applyQuaternion(q);
  const R = R0 + Math.max(...dG.map((d) => d.length()));
  let V = new Float32Array(0);
  group.updateMatrixWorld(true); gi.copy(group.matrixWorld).invert();
  // a face is kept if its bounding box passes within R of G (a large face, a simple box for example, has its
  // vertices far from the grip) and if it is not entirely on the other side of the axis
  const A = new V3(), B = new V3(), C = new V3(), near = (a, b, c) => {
    let d2 = 0, side = -1e9;
    for (let k = 0; k < 3; k++) {
      const lo = Math.min(V[a + k], V[b + k], V[c + k]), hi = Math.max(V[a + k], V[b + k], V[c + k]), e = lo > 0 ? lo : hi < 0 ? hi : 0; d2 += e * e;
    }
    for (const i of [a, b, c]) side = Math.max(side, V[i] * down.x + V[i + 1] * down.y);
    return d2 < R * R && side > -0.03;
  };
  group.traverse((o) => {
    if (!o.isMesh || !o.visible || o.material.transparent || !o.geometry.attributes.position) return;
    M.multiplyMatrices(gi, o.matrixWorld);
    const pos = o.geometry.attributes.position, idx = o.geometry.index, nv = pos.count, n3 = idx ? idx.count : nv;
    if (V.length < nv * 3) V = new Float32Array(nv * 3);
    for (let i = 0; i < nv; i++) { A.fromBufferAttribute(pos, i).applyMatrix4(M).sub(G); V[i * 3] = A.x; V[i * 3 + 1] = A.y; V[i * 3 + 2] = A.z; }
    for (let t = 0; t < n3; t += 3) {
      const a = (idx ? idx.getX(t) : t) * 3, b = (idx ? idx.getX(t + 1) : t + 1) * 3, c = (idx ? idx.getX(t + 2) : t + 2) * 3;
      if (!near(a, b, c)) continue;
      triSamples(A.fromArray(V, a), B.fromArray(V, b), C.fromArray(V, c), 0.003, (p) => { if (p.lengthSq() < R * R) P.push(p.x, p.y, p.z); });
    }
  });
  // for each hand roll around the handguard (n values from -range to range) and each grip point: height of the palm
  const D = palmGrid(soft), m = Gs.length, Hg = Gs.map(() => new Float32Array(D.length)), Q = new THREE.Quaternion(), r = new THREE.Quaternion();
  const p = new V3(), w = new V3(), o = dG.map(() => new V3()), out = Gs.map(() => new Float32Array(n));
  for (let k = 0; k < n; k++) {
    Q.copy(q).multiply(r.setFromAxisAngle(axis, n > 1 ? (k / (n - 1) * 2 - 1) * range : 0)).invert();
    for (let j = 0; j < m; j++) { Hg[j].fill(-1); o[j].copy(dG[j]).applyQuaternion(Q); }
    for (let i = 0; i < P.length; i += 3) {
      p.set(P[i], P[i + 1], P[i + 2]).applyQuaternion(Q); // hand frame
      for (let j = 0; j < m; j++) {
        w.subVectors(p, o[j]); if (w.lengthSq() >= R0 * R0) continue;
        w.z -= oz; // origin under the palm
        const c = pgCell(w); if (c >= 0 && w.y > Hg[j][c]) Hg[j][c] = w.y;
      }
    }
    for (let j = 0; j < m; j++) {
      let d = 0.02;
      for (let i = 0; i < D.length; i++) if (D[i] < 0 && Hg[j][i] > -1) d = Math.max(d, Hg[j][i] - D[i]);
      out[j][k] = d + 0.0005;
    }
  }
  return out;
}
/* palm height for a roll psi (palmLift table over [-range, range]) */
function liftAt(L, psi) {
  const n = L.v.length, t = clamp((psi / L.range + 1) / 2 * (n - 1), 0, n - 1), i = Math.min(n - 2, Math.floor(t));
  return L.v[i] + (L.v[i + 1] - L.v[i]) * (t - i);
}
/* Grip positions of a soldier seen from outside, once per mounted weapon (stored with its geometry): those of the first-person
   view (same support hand frame), unless the model gives its soldiers another grip point (info.gripLs: the soldier's arm does not
   reach the first-person one). The soldier's arm stays shorter than the distance from the shoulder to the handguard on
   some weapons: poseSoldier then moves the left shoulder forward (shoulder blade), then moves the hand back along the handguard, by slide at
   most (soldierSlide); the palm follows the handguard height over this travel (liftS: distance from the grip to the hand origin for
   each roll, at a third, two thirds and the end of the travel, because a bipod folded under the handguard stops on the way;
   soldierLift). */
const GUN_BUTT = { rifle: [0, 0.02, 0.3], smg: [0, 0.012, 0.25], sniper: [0, -0.02, 0.38], shotgun: [0, -0.012, 0.325], pistol: [0, 0.02, 0.3] };
const GUN_MAGP = { rifle: [0, -0.12, -0.122], smg: [0, -0.1, -0.13], sniper: [0, -0.075, -0.1], shotgun: [0, -0.02, -0.06], pistol: [0, -0.115, 0.03] };
function gunGrips(info) {
  const fam = info.kind, G = info.gripLs || info.gripL, LF = lHandFrame(info, G, info.gripLs ? '~s' : '', PG.softT), slide = soldierSlide(info, LF, G);
  const liftS = slide ? palmLifts(info.group, [1 / 3, 2 / 3, 1].map((t) => G.clone().setZ(G.z + slide * t)), LF.q, -LF.off.z, LF.axis, LF.range, 7, PG.softT).map((v) => ({ v, range: LF.range })) : null;
  return { R: info.gripR.clone(), L: G.clone(), LF, slide, liftS, butt: info.butt || GUN_BUTT[fam], magP: info.magP || GUN_MAGP[fam] };
}
/* Allowed travel of a soldier's support hand along the handguard (toward the receiver, +z) from the grip point G: the hand stays
   on the part of the handguard that carries G (grip shape, 3 cm before its rear end) and at least 15 mm from the magazine; no travel
   around a vertical grip or on a pistol */
function soldierSlide(info, F, G) {
  if (info.kind === 'pistol' || F.pose !== 'support' || !info.gripDef) return 0;
  let end = -1e9;
  for (const S of info.gripDef.L) if (Math.abs(S.c[0]) < 0.01 && !S.rx && Math.abs(G.z - S.c[2]) <= S.h[2] + S.r) end = Math.max(end, S.c[2] + S.h[2]);
  const max = Math.min(0.1, end - 0.03 - G.z);
  if (max <= 0) return 0;
  const mag = info.tubeFed || !info.mag.children.length ? null : new THREE.Box3().setFromObject(info.mag);
  if (!mag) return max;
  const hb = handBaked(1, SOLDIER_LPOSE, 'lo'), v = new V3(), H = new V3();
  for (let d = max; d > 0; d -= 0.005) {
    H.copy(G).z += d; H.sub(v.copy(F.off).applyQuaternion(F.q));
    let m = 1; for (let k = 0; k < hb.p.length && m >= 0.015; k += 3) m = Math.min(m, mag.distanceToPoint(v.fromArray(hb.p, k).applyQuaternion(F.q).add(H)));
    if (m >= 0.015) return d;
  }
  return 0;
}
/* Distance from the grip to the origin of a soldier's support hand whose hand has moved back by s along the handguard and rolled by phi
   around it: heights measured at the grip point and along the travel (liftS), blended according to the travel */
function soldierLift(grips, s, phi = 0) {
  const a = grips.LF.lift ? liftAt(grips.LF.lift, phi) : -grips.LF.off.y, L = grips.liftS;
  if (!L) return a;
  const u = clamp(s / grips.slide, 0, 1) * L.length, i = Math.min(L.length - 1, Math.floor(u)), b = i ? liftAt(L[i - 1], phi) : a;
  return b + (liftAt(L[i], phi) - b) * (u - i);
}
function gripsFor(key) { return worldGunGeometry(key).grips; }
