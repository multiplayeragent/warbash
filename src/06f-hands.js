/* ==========================================================================
   GLOVED HANDS (first person)
   A hand is a continuous surface, smoothed over 16 bones: the palm (root), three phalanges per finger and,
   for the thumb, the metacarpal then two phalanges. The thumb metacarpal is not a visible segment:
   it is buried in the thenar eminence, the fleshy mass at the base of the thumb, and a thick web connects it to the edge
   of the palm up to the index knuckle. So you see, as on a real hand, a short two-phalanx thumb
   coming out of a thick palm (and not one more finger starting from the wrist). The metacarpal pivots on the
   two axes of the thumb base and rotates in opposition with them: transitions follow the path of a real thumb.

   Proportions of a gloved adult male hand: palm 10.5 cm from the wrist to the middle finger joint,
   8.5 cm wide at the knuckles, fingers 19 to 20 mm in diameter; index phalanges 41, 24 and 21 mm.
   The rest pose (the one the mesh is built in) has the fingers half bent: common poses
   (grip, forend) deviate little from it, which limits deformations at the joints.

   Hand frame: -z toward the fingers, +y the back of the hand, thumb on the x = side (radial side);
   side is +1 for the left hand and -1 for the right. Poses do not jump from one frame to the next:
   each hand glides toward its target pose (VM.handDt).
   A pose gives, per finger (i index, m middle, r ring, p pinky, f for missing ones), the flexions
   [base, middle, tip] (base 0 to 90°, middle 0 to 110°, tip 0 to 80° and never more bent than the middle);
   t: thumb [flexion of the proximal phalanx, flexion of the tip, flexion of the metacarpal toward the pinky, abduction away from the palm]
   (the thumb's opposition rotation follows from it, an optional fifth term corrects it); spread: spread; free: the index does not close on the object (trigger);
   topen: thumb approach pose for the procedural grip.
   ========================================================================== */
const HAND_POSES = {
  // fist around a grip: the middle, ring and pinky stack up, the index a bit less closed;
  // the thumb passes across, in front of the index and middle
  grip: { f: [1.3, 1.5, 0.95], i: [1.05, 1.35, 0.9], t: [0.35, 0.5, 0.9, 0.55, -0.9], spread: 0.0 },
  // knife held forward (handshake grip, 06c-models.js: KNIFE_HELD), tuned by hand with the tuning bench (09zk-knife-tuning.js): the fingers go
  // around the handle, each on its own, and the thumb has eight angles (the last three pivot its base around the hand's x, y and z: thumbQ)
  kgrip: { i: [1.37, 1.35, 0.67], m: [1.48, 1.5, 0.95], r: [1.3, 1.5, 0.95], p: [1.3, 1.5, 0.95], t: [0.42, 0.47, -0.16, 0.89, -1.37, 0.06, 0.28, -0.16], spread: 0 },
  // knife during the strike (06c-models.js: KNIFE_STAB): the fingers blended from the held pose at the start to the end of the strike, rewritten every frame
  kstab: { i: [0, 0, 0], m: [0, 0, 0], r: [0, 0, 0], p: [0, 0, 0], t: [0, 0, 0, 0, 0, 0, 0, 0], spread: 0 },
  // support hand on a support grip: same fist (the grip closes it on contact with the handle); the thumb starts spread on the side
  // of the back of the hand (otherwise it would be born inside the handle) and comes around it from behind
  fgrip: { f: [1.3, 1.5, 0.95], i: [1.05, 1.35, 0.9], t: [0.35, 0.5, 0.9, 0.55, -0.9], topen: [0.05, 0.05, 0.6, -0.25], spread: 0.0, unholster: true },
  // trigger hand of a rifle: index extended toward the trigger (free, the grip does not close it), the thumb going
  // around the back of the grip and folding onto its left side (angles found by optimization against the grip)
  trigger: { f: [1.3, 1.5, 0.95], i: [0.32, 0.5, 0.3], t: [0.28, 0.86, 1.4, 0.94, 2.05], topen: [0.05, 0.05, 0.3, 0.4], spread: 0.0, free: true },
  // pistol trigger hand, high "thumbs forward" grip: the thumb base wraps the back of the grip,
  // then the thumb, palm turned toward the frame, extends forward on the left side, above the thumb of the
  // support hand (angles found by optimization against the weapon's shape)
  ptrig: { f: [1.35, 1.55, 1.0], i: [0.3, 0.55, 0.3], t: [0.42, 0.63, 0.335, 1.04, -2.5], topen: [0.05, 0.05, 0.1, 0.3], spread: 0.0, free: true },
  // pistol support hand: palm on the left side of the grip, fingers closed over those of the right hand,
  // thumb extended forward under the slide
  psup: { f: [1.25, 1.35, 0.9], i: [1.15, 1.25, 0.85], t: [0.45, 0.0, 0.2, 0.34, -1.5], topen: [0.05, 0.0, 0.1, 0.1], spread: 0.0 },
  // support hand under the forend: the fingers wrap it from the right; the thumb, spread from the palm (abduction) and slightly
  // folded toward the fingers (the palm being raised forward, it would stand up; more folded, it would pass under the forend),
  // runs forward along the left side
  support: { f: [1.0, 1.15, 0.75], i: [0.85, 1.0, 0.7], p: [1.1, 1.2, 0.8], t: [0.1, 0.1, 0.3, 0.9], topen: [0.05, 0.05, 0.2, 0.3], spread: 0.0, unholster: true },
  // soldiers' frozen left hand (06g-body.js), based on the first-person grip: under a forend of about 3 cm radius
  // (the thumb, spread in the plane of the palm, runs along the left side without passing under the weapon, the palm being raised forward:
  // see frameUnder), around a vertical support grip
  tsup: { i: [0.45, 0.75, 0.6], m: [0.8, 0.9, 0.65], r: [0.92, 1.0, 0.7], p: [0.92, 1.0, 0.7], t: [0.05, 0.05, -0.3, 0], spread: 0.0 },
  tgrip: { i: [1.0, 1.4, 0.9], m: [1.19, 1.37, 0.79], r: [1.19, 1.25, 0.95], p: [1.08, 1.25, 0.87], t: [0.75, 0.9, 0.69, 0, -0.9], spread: 0.0 },
  // "C" grip: fingers curled under the forend, thumb extended over the top
  cclamp: { f: [0.95, 1.15, 0.7], i: [0.8, 0.95, 0.6], p: [1.05, 1.2, 0.8], t: [0.08, 0.05, 0.2, 0.25], spread: 0.02 },
  // streak terminal held in the palm: fingers closed on the left side, thumb over the right side, on the call button
  // (the index less closed: it would pass in front of the screen)
  hold: { f: [1.2, 1.25, 0.8], i: [0.85, 0.9, 0.6], t: [0.35, 0.3, 0.6, 0.6], spread: 0.02 },
  // tablet held by the sides: fingers behind, thumb extended on the frame
  tablet: { f: [1.1, 1.2, 0.7], t: [0.1, 0.15, 0.2, 0.6], spread: 0.03 },
  // grenade: the fingers conform to the sphere without clenching into a fist
  nade: { f: [0.95, 1.05, 0.7], i: [0.85, 1.0, 0.65], p: [1.1, 1.1, 0.75], t: [0.35, 0.3, 0.8, 0.8], spread: 0.1 },
  // the hand holding each grenade type (06c-models.js: NADE_GRIP), one finger per entry and the thumb in eight angles like kgrip; adjustable on the grenade
  // tuning bench (?grenade=1, 09zj-grenade-tuning.js). Poses tuned by the owner
  nfrag: { i: [1.32, 0.97, 0.65], m: [1.35, 1.05, 0.7], r: [1.32, 1.05, 0.7], p: [1.06, 1.1, 0.75], t: [0.55, 0.43, 0.71, 1.14, -2.63, -0.06, 0, 0], spread: 0 },
  nflash: { i: [1.32, 0.97, 0.65], m: [1.35, 1.05, 0.7], r: [1.32, 1.05, 0.7], p: [1.06, 1.1, 0.75], t: [0.55, 0.43, 0.71, 1.14, -2.63, -0.06, 0, 0], spread: 0 },
  nsmoke: { i: [1.32, 0.97, 0.65], m: [1.35, 1.05, 0.7], r: [1.32, 1.05, 0.7], p: [1.06, 1.1, 0.75], t: [0.55, 0.43, 0.71, 1.14, -2.63, -0.06, 0, 0], spread: 0 },
  nknife: { i: [1.9, 1.6, 0.94], m: [1.9, 1.6, 1.26], r: [1.9, 1.58, 1.16], p: [1.9, 1.82, 1.33], t: [0.9, 0.38, 0.74, 1.36, -2.86, 0.3, -0.5, 0], spread: 0 },
  pinch: { f: [1.5, 1.5, 0.9], i: [0.9, 1.2, 0.8], t: [0.5, 0.6, 1.1, 0.8], spread: 0.0 },
  open: { f: [0.05, 0.1, 0.06], p: [0.1, 0.12, 0.08], t: [0.05, 0.05, 0.0, 0.1], spread: 0.16 },
  relaxed: { f: [0.5, 0.6, 0.4], p: [0.65, 0.7, 0.45], t: [0.2, 0.3, 0.45, 0.2], spread: 0.06 },
  // hand that fetches or carries a magazine: hooked fingers
  mag: { f: [0.95, 1.1, 0.7], i: [0.9, 1.05, 0.65], p: [1.0, 1.1, 0.7], t: [0.3, 0.3, 0.7, 0.7], spread: 0.03 },
  // flat palm (slap on a magazine or a lever)
  slap: { f: [0.12, 0.15, 0.1], t: [0.1, 0.1, 0.1, 0.25], spread: 0.05 },
};
/* maximum extension of the index at its base (rad): an index laid along a frame arches back slightly */
const IDX_EXT = -0.45;
/* mesh construction pose (half flexion) */
const HAND_REST = { f: [0.45, 0.6, 0.35], t: [0.25, 0.2, 0.2, 0.45], spread: 0.0 };
/* index, middle, ring, pinky: base joint (x toward the thumb), phalanx lengths,
   radius, convergence (when closing, the fingers point toward the thumb base) */
const FINGERS = [
  { x: 0.0295, y: -0.0015, z: -0.046, L: [0.039, 0.023, 0.02], r: 0.0094, conv: 0.0 },
  { x: 0.0098, y: 0.0, z: -0.0505, L: [0.043, 0.026, 0.021], r: 0.0097, conv: 0.04 },
  { x: -0.0102, y: -0.0008, z: -0.0475, L: [0.04, 0.025, 0.02], r: 0.0092, conv: 0.09 },
  { x: -0.0288, y: -0.0035, z: -0.0395, L: [0.032, 0.019, 0.018], r: 0.0083, conv: 0.16 },
];
/* thumb: trapeziometacarpal joint (near the wrist, palm side), rest direction of the metacarpal,
   nail side, lengths metacarpal / proximal phalanx / distal phalanx (tip included) */
const THUMB = { cmc: [0.022, 0.0, 0.036], dir: [0.6, -0.05, -0.8], nail: [0.9, 0.4, 0.15], L: [0.041, 0.027, 0.022] };
function thumbRestQ(side) {
  const z = new V3(-THUMB.dir[0] * side, -THUMB.dir[1], -THUMB.dir[2]).normalize();
  const y = new V3(THUMB.nail[0] * side, THUMB.nail[1], THUMB.nail[2]); y.addScaledVector(z, -y.dot(z)).normalize();
  const x = new V3().crossVectors(y, z);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
/* Applies the current angles (cur) to the hand's bones */
function handApply(u) {
  const cur = u.cur, side = u.side, per = [cur.i, cur.m, cur.r, cur.p];
  u.fingers.forEach((fg, i) => {
    const F = per[i], fl = clamp(F[0], i === 0 ? IDX_EXT : -0.15, 1.6);
    fg.base.rotation.set(-fl, ((1.5 - i) * cur.spread - FINGERS[i].conv * Math.max(0, fl)) * -side, 0);
    fg.mid.rotation.x = -clamp(F[1], 0, 1.92); fg.tip.rotation.x = -clamp(Math.min(F[2], F[1] + 0.1), 0, 1.4);
  });
  // trigger index: closes a notch when firing
  if (cur.trig) { const f = u.fingers[0]; f.base.rotation.x -= cur.trig * 0.22; f.mid.rotation.x -= cur.trig * 0.42; f.tip.rotation.x -= cur.trig * 0.18; }
  // thumb: the metacarpal pivots around the thumb base along two hand axes (flexion in the plane of the palm,
  // toward the pinky; abduction out of the palm, palm side), and rotates on itself by the same amount (opposition: the nail
  // presents face-on when the thumb comes over the palm), like a real thumb
  const T = cur.t;
  thumbQ(side, T, u.tq, u.tm.quaternion);
  u.tb.rotation.set(-T[0] - cur.press * 0.3, 0, 0);
  u.tt.rotation.x = -T[1] - cur.press * 0.45;
}
/* ---------- Procedural grip ----------
   A pose no longer says exactly where the fingers go: it gives how far they can close. Each finger starts from the
   almost-open hand and closes phalanx by phalanx; a phalanx that touches the held object stops, the following ones
   keep curling, like a real hand grasping. If a gap remains under the finger at the end of the pose, it
   closes a bit more to come into contact. The object is made of simple shapes in weapon space: rounded boxes
   (grip, frame, forend) and capsules (the other hand's fingers, for the pistol's support hand). */
function gripShape(o) { // { c, h (half-sides), r (rounding), rx: tilt around x } or { a, b, r } (capsule)
  if (o.a) return { cap: true, a: new V3(...o.a), b: new V3(...o.b), r: o.r };
  return { c: new V3(...o.c), h: new V3(o.h[0] - o.r, o.h[1] - o.r, o.h[2] - o.r), r: o.r, qi: new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), -(o.rx || 0)) };
}
/* Called thousands of times per frame (grip of both hands in first person, soldiers' hands): nothing is allocated in it,
   not even by Math.hypot (a built-in that allocates, unlike Math.sqrt) */
const _gp = new V3(), _gsq = new V3();
function gripSdf(shapes, p) {
  let d = 1e9;
  for (let k = 0; k < shapes.length; k++) {
    const S = shapes[k];
    let e;
    if (S.cap) {
      _gsq.subVectors(S.b, S.a); const t = clamp(_gp.subVectors(p, S.a).dot(_gsq) / Math.max(1e-9, _gsq.lengthSq()), 0, 1);
      e = _gp.copy(S.a).addScaledVector(_gsq, t).distanceTo(p) - S.r;
    } else {
      _gp.subVectors(p, S.c).applyQuaternion(S.qi);
      const qx = Math.abs(_gp.x) - S.h.x, qy = Math.abs(_gp.y) - S.h.y, qz = Math.abs(_gp.z) - S.h.z;
      const ox = qx > 0 ? qx : 0, oy = qy > 0 ? qy : 0, oz = qz > 0 ? qz : 0;
      e = Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0) - S.r;
    }
    if (e < d) d = e;
  }
  return d;
}
/* Forward kinematics of a finger (a: flexions of the three joints) or the thumb (a: [pp, pd, flexion, abduction]),
   in the hand frame: four points (base, two joints, tip) into out */
const _gk = { q: new THREE.Quaternion(), q2: new THREE.Quaternion(), e: new THREE.Euler(), v: new V3(), ax: new V3(), d: new V3() };
function digitFK(u, f, a, out) {
  const K = _gk, side = u.side, q = K.q;
  if (f < 4) {
    const F = FINGERS[f], fl = clamp(a[0], f === 0 ? IDX_EXT : -0.15, 1.6);
    out[0].set(F.x * side, F.y, F.z);
    q.setFromEuler(K.e.set(-fl, ((1.5 - f) * u.cur.spread - F.conv * Math.max(0, fl)) * -side, 0));
    out[1].copy(out[0]).add(K.v.set(0, 0, -F.L[0]).applyQuaternion(q));
    q.multiply(K.q2.setFromAxisAngle(K.ax.set(1, 0, 0), -clamp(a[1], 0, 1.92)));
    out[2].copy(out[1]).add(K.v.set(0, 0, -F.L[1]).applyQuaternion(q));
    q.multiply(K.q2.setFromAxisAngle(K.ax.set(1, 0, 0), -clamp(Math.min(a[2], a[1] + 0.1), 0, 1.4)));
    out[3].copy(out[2]).add(K.v.set(0, 0, -F.L[2] - 0.004).applyQuaternion(q));
    return out;
  }
  thumbQ(side, a, u.tq, q);
  out[0].set(THUMB.cmc[0] * side, THUMB.cmc[1], THUMB.cmc[2]);
  out[1].copy(out[0]).add(K.v.set(0, 0, -THUMB.L[0]).applyQuaternion(q));
  q.multiply(K.q2.setFromAxisAngle(K.ax.set(1, 0, 0), -a[0]));
  out[2].copy(out[1]).add(K.v.set(0, 0, -THUMB.L[1]).applyQuaternion(q));
  q.multiply(K.q2.setFromAxisAngle(K.ax.set(1, 0, 0), -a[1]));
  out[3].copy(out[2]).add(K.v.set(0, 0, -THUMB.L[2] - 0.004).applyQuaternion(q));
  return out;
}
/* Orientation of the thumb metacarpal: flexion (toward the pinky, in the plane of the palm), abduction (out of the
   palm, around the axis perpendicular to the thumb) and the opposition rotation that goes with them. T[5], T[6], T[7] (optional, zero
   by default) then rotate the whole thumb around its base, along the hand's x, y and z axes: enough to place it wherever wanted
   (knife tuning bench, 09zk-knife-tuning.js) */
function thumbQ(side, T, tq, out) {
  const K = _gk;
  out.setFromAxisAngle(K.ax.set(0, 1, 0), T[2] * side);
  K.d.set(THUMB.dir[0] * side, THUMB.dir[1], THUMB.dir[2]).normalize().applyQuaternion(out);
  K.ax.set(0, 1, 0).cross(K.d).normalize(); // d × (-y): abduction spreads the thumb toward the palm side
  out.premultiply(K.q2.setFromAxisAngle(K.ax, T[3])).multiply(tq).multiply(K.q2.setFromAxisAngle(K.ax.set(0, 0, 1), side * (0.5 * T[2] + 0.3 * T[3] + (T[4] || 0))));
  if (T[5] || T[6] || T[7]) out.premultiply(K.q2.setFromEuler(K.e.set(T[5] || 0, (T[6] || 0) * side, (T[7] || 0) * side, 'XYZ')));
  return out;
}
const _gP = [new V3(), new V3(), new V3(), new V3()], _gW = new V3(), _gM = new THREE.Matrix4();
const GAP_T = [0.4, 0.75, 1]; // points tested along each phalanx
/* Distance to contact of the chain from phalanx k (negative: it sinks in); M: hand to weapon */
function digitGap(u, f, a, k, shapes, M) {
  digitFK(u, f, a, _gP);
  let d = 1e9;
  for (let l = Math.max(1, k); l <= 3; l++) {
    const r = f < 4 ? FINGERS[f].r * (l === 3 ? 0.86 : 0.93) : 0.0106;
    for (let i = 0; i < 3; i++) {
      _gW.lerpVectors(_gP[l - 1], _gP[l], GAP_T[i]).applyMatrix4(M);
      d = Math.min(d, gripSdf(shapes, _gW) - r);
    }
  }
  return d;
}
/* Grip angles of a finger: closing from the approach pose O toward the pose P, joint by joint.
   J: parameters of each joint (the thumb moves its base on two parameters); out receives the angles */
const _gA = [0, 0, 0, 0, 0], _gS = [0, 0, 0, 0, 0];
/* fingers at their most open when a support grip must take them out of the object: index, other fingers, thumb (abduction on the back-of-hand
   side), and as a last resort the thumb also spread in the plane of the palm, opposite the fingers (it stands up: only if it does not get
   out otherwise, from an angled grip ramp for example) */
const GRASP_EXT = [[IDX_EXT * 0.6, 0, 0], [-0.15, 0, 0], [0, 0, 0, -0.3, 0], [0, 0, -0.5, -0.3, 0]];
const GRASP_J = [[[0], [1], [2]], [[2, 3, 4], [0], [1]]], _gLock = [false, false, false];
function graspDigit(u, f, O, P, shapes, M, out, unholster = false) {
  const J = GRASP_J[f < 4 ? 0 : 1], n = O.length, lock = _gLock, N = 10;
  lock[0] = lock[1] = lock[2] = false;
  for (let j = 0; j < n; j++) _gA[j] = O[j];
  const g0 = digitGap(u, f, _gA, 1, shapes, M);
  if (g0 < 0 && !unholster) { for (let j = 0; j < n; j++) out[j] = P[j]; return out; } // already inside the object: pose as is
  if (g0 < 0) {
    // support poses of long weapons (exit, see HAND_POSES): instead of keeping its pose inside the object, the finger looks for the
    // nearest exit, opening step by step (up to the open hand, then slightly into extension) or closing toward P (an index
    // pointing into the forend above a grip curls underneath), and stops as soon as it gets out; otherwise the thumb
    // spreads (GRASP_EXT[3]); with no exit, it keeps the least sunken position tried
    const at = (s, X) => { for (let j = 0; j < n; j++) _gA[j] = X ? (f === 4 && j === 4 ? O[j] : O[j] + (X[j] - O[j]) * s / N) : O[j] + (P[j] - O[j]) * s / N; };
    let bg = -1e9, bs = 0, bX = null;
    const pathway = (X, m) => {
      for (let s = 1; s <= m; s++) { at(s, X); const g = digitGap(u, f, _gA, 1, shapes, M); if (g >= 0) return s; if (g > bg) { bg = g; bs = s; bX = X; } }
      return 0;
    };
    let X = f < 4 ? GRASP_EXT[f ? 1 : 0] : GRASP_EXT[2], s = pathway(X, N);
    const sc = pathway(null, s ? s - 1 : N);
    if (sc) { X = null; s = sc; } else if (!s && f === 4) s = pathway((X = GRASP_EXT[3]), N);
    if (!s) { X = bX; s = bs; }
    at(s, X);
    for (let j = 0; j < n; j++) out[j] = _gA[j];
    return out;
  }
  // phase 1: from O to P; phase 2: beyond P (up to +0.4 rad) if the finger grazes the object without touching it
  for (let s = 1; s <= N + 4; s++) {
    const t = s / N;
    if (s === N + 1 && digitGap(u, f, _gA, 1, shapes, M) > 0.012) break;
    for (let j = 0; j < 3; j++) {
      if (lock[j]) continue;
      const Jj = J[j];
      for (let q = 0; q < Jj.length; q++) { const i = Jj[q]; _gS[i] = _gA[i]; _gA[i] = t <= 1 ? O[i] + (P[i] - O[i]) * t : P[i] + Math.sign(P[i] - O[i] || 1) * 0.1 * (s - N); }
      if (digitGap(u, f, _gA, j + 1, shapes, M) < 0) { for (let q = 0; q < Jj.length; q++) _gA[Jj[q]] = _gS[Jj[q]]; lock[j] = true; }
    }
    if (lock[0] && lock[1] && lock[2]) break;
  }
  for (let j = 0; j < n; j++) out[j] = _gA[j];
  return out;
}
/* Trigger index: the pad of the last phalanx comes onto the trigger (weapon point T, finger axis), without
   the finger entering the weapon (S shapes: frame, trigger guard, magazine well) nor its tip coming out the other side
   (x < xTip). Coordinate descent from the previous solution: the finger follows the hand when it rolls on the
   grip, without jumping. a: angles [base, middle, tip], modified in place. */
const _ti = [new V3(), new V3(), new V3(), new V3()], _tw = new V3(), _tp = new V3(), _ta = [0, 0, 0];
const TRIG_T = [0.35, 0.7, 1];
function trigCost(u, a, M, T, S, xTip) {
  digitFK(u, 0, a, _ti);
  for (let l = 0; l < 4; l++) _ti[l].applyMatrix4(M);
  let pen = 0;
  for (let l = 1; l <= 3; l++) for (let i = 0; i < 3; i++) {
    const k = TRIG_T[i];
    _tw.lerpVectors(_ti[l - 1], _ti[l], k);
    // the base of the proximal phalanx is buried in the palm: a few millimeters of overlap allowed
    pen = Math.min(pen, gripSdf(S, _tw) - FINGERS[0].r * (l === 3 ? 0.86 : 0.93) + (l === 1 && k < 0.5 ? 0.006 : 0));
  }
  _tp.lerpVectors(_ti[2], _ti[3], 0.6);
  return _tp.distanceToSquared(T) * 1e4 + pen * pen * 4e5 + Math.max(0, xTip - _ti[3].x) ** 2 * 1e5 + 0.02 * (a[1] - 0.6) ** 2;
}
const TRIG_LIM = [[IDX_EXT, 1.2], [0, 1.8], [0, 1.3]], TRIG_H = [0.08, 0.04, 0.02];
function indexToTrigger(u, M, TR, a) {
  const T = TR.at, S = TR.shapes, x0 = TR.xTip, lim = TRIG_LIM;
  if (!a.init) { // first call: coarse grid
    let best = 1e9;
    for (let b = IDX_EXT; b <= 0.8; b += 0.15) for (let m = 0; m <= 1.8; m += 0.2) for (let t = 0; t <= Math.min(1.3, m + 0.1); t += 0.2) {
      _ta[0] = b; _ta[1] = m; _ta[2] = t; const c = trigCost(u, _ta, M, T, S, x0);
      if (c < best) { best = c; a[0] = b; a[1] = m; a[2] = t; }
    }
    a.init = true;
  }
  let c0 = trigCost(u, a, M, T, S, x0);
  for (let ih = 0; ih < 3; ih++) for (let it = 0; it < 2; it++) for (let j = 0; j < 3; j++) for (let sg = 1; sg >= -1; sg -= 2) {
    const h = TRIG_H[ih], v = a[j]; a[j] = clamp(v + sg * h, lim[j][0], j === 2 ? Math.min(lim[j][1], a[1] + 0.1) : lim[j][1]);
    const c = trigCost(u, a, M, T, S, x0);
    if (c < c0) c0 = c; else a[j] = v;
  }
  return a;
}
/* Full grip pose of a hand (hand frame to weapon: M): result in G { i, m, r, p, t } */
const _gO = [0, 0, 0], _gOt = [0, 0, 0, 0, 0], _gT = [0, 0, 0, 0, 0], GRASP_KEYS = ['i', 'm', 'r', 'p'];
function handGrasp(u, P, shapes, M, G) {
  const keys = GRASP_KEYS;
  for (let f = 0; f < 4; f++) {
    const k = keys[f], Pf = P[k] || P.f;
    if (f === 0 && P.free) { // trigger index: on the weapon's trigger if described, otherwise follows its pose
      if (shapes.trig) { if (!G[k] || !G[k].init || G.tk !== shapes.trig) { G[k] = Pf.slice(); G.tk = shapes.trig; } indexToTrigger(u, M, shapes.trig, G[k]); } else G[k] = Pf.slice();
      continue;
    }
    for (let j = 0; j < 3; j++) _gO[j] = Pf[j] * 0.15;
    G[k] = graspDigit(u, f, _gO, Pf, shapes, M, G[k] || [0, 0, 0], P.unholster);
  }
  const T = P.t, To = P.topen || [0.05, 0.05, T[2] * 0.4, T[3] * 0.6];
  for (let j = 0; j < 5; j++) { _gT[j] = T[j] || 0; _gOt[j] = j < 4 ? To[j] : _gT[4]; }
  G.t = graspDigit(u, 4, _gOt, _gT, shapes, M, G.t || [0, 0, 0, 0, 0], P.unholster);
  return G;
}
/* Capsules of a hand's fingers (for the hand that closes over it), in weapon space */
function handCapsules(u, M, out, fingers = [1, 2, 3, 4]) {
  const c = u.cur, per = [c.i, c.m, c.r, c.p, c.t];
  out.length = 0;
  for (const f of fingers) {
    digitFK(u, f, per[f], _gP);
    for (let l = 1; l <= 3; l++) {
      if (f === 4 && l === 1) continue;
      const r = f < 4 ? FINGERS[f].r * 0.95 : 0.0106;
      out.push({ cap: true, a: _gP[l - 1].clone().applyMatrix4(M), b: _gP[l].clone().applyMatrix4(M), r });
    }
  }
  return out;
}
/* Geometry of a hand (side side), built in the rest pose; shared by all hands of the same side.
   Tactical glove: fabric back, darker synthetic palm, reinforced fingertips, knuckle shell and
   rubber knuckle guards molded into the surface (bumps and color, no attached pieces). */
const HAND_GEO = {};
function handGeometry(side, u, h, lod) {
  const key = side + (lod || 'fp');
  if (HAND_GEO[key]) return HAND_GEO[key];
  const B = new SkinBuilder(), hi = lod !== 'lo' && lod !== 'xlo', xlo = lod === 'xlo', seg = hi ? 16 : xlo ? 4 : 6;
  const WHITE = new THREE.Color(1, 1, 1), PALM = new THREE.Color(0.58, 0.57, 0.55), RUB = new THREE.Color(0.2, 0.2, 0.2), SEAM = new THREE.Color(0.8, 0.8, 0.8);
  // fabric back, synthetic palm and fingertips ("leath" zone: more satin)
  const phys = 0.14, guv = (x, z, palm) => atlasUV(palm ? 'leath' : 'glove', 0.5 + x / phys, (z + 0.085) / phys);
  const mix = (a, b, t) => (t <= 0 ? a : t >= 1 ? b : a.clone().lerp(b, t));
  // ---- palm: sections from the wrist to the knuckles [z, half-width thumb side, pinky side, back, palm, y offset]
  const rows = [[0.08, 0.027, 0.027, 0.018, 0.017, 0], [0.066, 0.0285, 0.0285, 0.0168, 0.0172, 0], [0.05, 0.0325, 0.0315, 0.0158, 0.0176, 0], [0.032, 0.0365, 0.036, 0.015, 0.0168, 0.0004],
    [0.014, 0.0395, 0.039, 0.0145, 0.0158, 0.0008], [-0.005, 0.0415, 0.041, 0.0141, 0.0148, 0.001], [-0.022, 0.0425, 0.0415, 0.0136, 0.0138, 0.001], [-0.034, 0.042, 0.041, 0.0128, 0.0122, 0.0006], [-0.041, 0.0405, 0.0395, 0.0118, 0.0108, 0.0003]];
  const last = rows[rows.length - 1];
  for (let i = 1; i <= 4; i++) { const t = i / 4 * Math.PI / 2, k = i === 4 ? 0.02 : Math.cos(t); rows.push([last[0] - Math.sin(t) * 0.009, last[1] * (0.35 + 0.65 * k), last[2] * (0.35 + 0.65 * k), last[3] * k, last[4] * k, last[5]]); }
  // extra rows (interpolated) so the knuckle shell has a clean shape
  const R2 = []; for (let i = 0; i < rows.length - 1; i++) { R2.push(rows[i]); if (i >= 4 && i < 9) R2.push(rows[i].map((x, j) => (x + rows[i + 1][j]) / 2)); }
  R2.push(rows[rows.length - 1]);
  const R3 = xlo ? R2.filter((r, i) => i % 3 === 0 || i === R2.length - 1) : R2;
  const nr = R3.length, nu = hi ? 36 : xlo ? 8 : 12, bIdx = (f, k) => 1 + f * 3 + k;
  skinSurf(B, nu, nr - 1, (uu, vv, o) => {
    const r = R3[Math.round(vv * (nr - 1))], a = uu * TAU, c = Math.cos(a), s = Math.sin(a), e = 2 / 2.35;
    let x = Math.sign(c) * Math.pow(Math.abs(c), e) * (c >= 0 ? r[1] : r[2]), y = Math.sign(s) * Math.pow(Math.abs(s), e) * (s >= 0 ? r[3] : r[4]) + r[5];
    let z = r[0], col = WHITE;
    // back of the hand tilted toward the pinky, hypothenar eminence, hollow of the palm
    y += x * 0.06 * Math.max(0, s);
    if (s < 0) {
      y -= 0.003 * Math.exp(-(((x + 0.028) / 0.013) ** 2) - (((z - 0.012) / 0.03) ** 2)) * -s;
      y += 0.0024 * Math.exp(-((x / 0.016) ** 2) - (((z + 0.004) / 0.022) ** 2)) * -s;
    }
    // knuckle shell: molded band across the back, one bump per knuckle
    const kz = smoothstep(-0.026, -0.031, z) * smoothstep(-0.056, -0.049, z), kd = smoothstep(0.35, 0.6, s);
    if (kz * kd > 0) {
      let ridge = 0; for (const F of FINGERS) ridge = Math.max(ridge, Math.exp(-(((x - F.x) / 0.0075) ** 2)));
      y += (0.0022 + 0.0012 * ridge) * kz * kd;
      col = mix(WHITE, RUB, smoothstep(0.3, 0.6, kz * kd));
    }
    // seam between back and palm
    if (Math.abs(s + 0.25) < 0.06) col = SEAM;
    else if (s < -0.25) col = PALM;
    if (z < -0.02) z += (x < 0 ? -x / 0.042 * 0.0075 : x / 0.042 * 0.0015) * smoothstep(-0.02, -0.045, z);
    o.x = x * side; o.y = y; o.z = z;
    // weights: palm; thumb base (thenar); knuckle edge following the fingers
    const w = [[0, 1]];
    const th = Math.exp(-(((x - 0.024) / 0.016) ** 2) - (((y + 0.012) / 0.015) ** 2) - (((z - 0.018) / 0.022) ** 2)) * 0.4;
    if (th > 0.01) w.push([13, th]);
    const tw = smoothstep(-0.034, -0.054, z) * 0.6 * (s < 0 ? 1 : 0.5);
    if (tw > 0.01) {
      let f0 = 3; for (let f = 0; f < 3; f++) if (x > (FINGERS[f].x + FINGERS[f + 1].x) / 2) { f0 = f; break; }
      w[0][1] = 1 - tw; w.push([bIdx(f0, 0), tw]);
    }
    o.w = w; o.col = col;
    const uv = guv(x, z, s < -0.25); o.U = uv[0]; o.V = uv[1];
  });
  // ---- fingers: sweep along the three phalanges, prominent knuckles on the back, pads on the palm side,
  //      rubber knuckle guard on the proximal phalanx
  const X = new V3(1, 0, 0), Y = new V3(0, 1, 0), AX = new V3(0, 0, -1);
  u.fingers.forEach((fg, f) => {
    const F = FINGERS[f], L = F.L, r = F.r, d1 = L[0], d2 = L[0] + L[1], dt = d2 + L[2];
    const chain = [{ M: restMatrix(fg.base, h), L: L[0] }, { M: restMatrix(fg.mid, h), L: L[1] }, { M: restMatrix(fg.tip, h), L: L[2] }];
    const secs = [[-0.017, 0.93], [-0.01, 1.0, 0.0012], [-0.003, 1.08, 0.0026], [0.004, 1.03, 0.001], [0.01, 1.0], [0.0135, 1.0, 0, 0.0008, 1], [d1 * 0.5, 0.97, 0, 0.0012, 1], [d1 - 0.011, 0.95, 0, 0, 1], [d1 - 0.0075, 0.94], [d1 - 0.004, 0.93],
      [d1 - 0.0015, 0.95, 0.0014], [d1 + 0.002, 0.95, 0.0012], [d1 + 0.006, 0.9], [d1 + L[1] * 0.5, 0.87, 0, 0.001], [d2 - 0.004, 0.84], [d2, 0.86, 0.001], [d2 + 0.004, 0.84], [dt - 0.009, 0.85, 0, 0.0012], [dt - 0.004, 0.8]];
    const S = secs.filter((x, i) => hi || i % (xlo ? 3 : 2) === 0 || i === secs.length - 1).map(([d, k, kn, pad, guard]) => ({ d, r: [r * 1.06 * k, r * 1.06 * k, r * 0.9 * k, r * 1.0 * k], n: 2.3, kn: kn || 0, pad: pad || 0, guard: guard || 0 }));
    const J = [{ s: 0, h: 0.009, a: 0, b: bIdx(f, 0) }, { s: d1, h: 0.0055, a: bIdx(f, 0), b: bIdx(f, 1) }, { s: d2, h: 0.0045, a: bIdx(f, 1), b: bIdx(f, 2) }];
    const gd = (a, s) => s.guard * smoothstep(0.45, 0.7, Math.sin(a));
    skinSweep(B, chain, [0.0045, 0.0038], AX, X, Y, S, seg, {
      cap1: 0.0065,
      w: (d) => chainW(d, J),
      bump: (a, k, s) => s.kn * Math.pow(Math.max(0, Math.sin(a)), 4) + s.pad * Math.pow(Math.max(0, -Math.sin(a)), 2) + gd(a, s) * 0.0021 - 0.0006 * Math.exp(-(((s.v - d1) / 0.0025) ** 2)) * Math.max(0, -Math.sin(a)),
      col: (a, k, p, s) => (gd(a, s) > 0.5 ? RUB : Math.abs(Math.sin(a) + 0.2) < 0.08 ? SEAM : Math.sin(a) < -0.2 || s.v > dt - 0.011 ? PALM : WHITE),
      uv: (uu, v, s, px, py) => atlasUV(py < -r * 0.2 || v > dt - 0.011 ? 'leath' : 'glove', 0.2 + f * 0.2 + px / phys, (v + 0.02) / phys),
    });
  });
  // ---- thumb: fleshy thenar around the metacarpal (which starts inside the palm), then two short and
  //      thick phalanges; no attached piece on the thumb (a rubber ring there read as a crease)
  const tchain = [{ M: restMatrix(u.tm, h), L: THUMB.L[0] }, { M: restMatrix(u.tb, h), L: THUMB.L[1] }, { M: restMatrix(u.tt, h), L: THUMB.L[2] }];
  const t1 = THUMB.L[0], t2 = t1 + THUMB.L[1], tt = t2 + THUMB.L[2];
  // [d, x+, x-, back (nail), pad]
  const tsec = [[0.0, 0.0095, 0.0095, 0.0075, 0.009], [0.01, 0.0125, 0.012, 0.0088, 0.0118], [0.021, 0.0135, 0.0135, 0.0094, 0.0132], [0.031, 0.0128, 0.013, 0.0095, 0.0122],
    [t1 - 0.004, 0.0118, 0.0118, 0.0097, 0.0108], [t1, 0.0116, 0.0116, 0.0101, 0.0106], [t1 + 0.007, 0.0112, 0.0112, 0.0097, 0.0106], [t1 + 0.016, 0.0109, 0.0109, 0.0094, 0.0104],
    [t2 - 0.003, 0.0107, 0.0107, 0.0094, 0.0102], [t2 + 0.001, 0.0108, 0.0108, 0.0095, 0.0103], [t2 + 0.006, 0.0109, 0.0109, 0.009, 0.0108], [tt - 0.008, 0.011, 0.011, 0.0087, 0.0112], [tt - 0.004, 0.0101, 0.0101, 0.008, 0.01]];
  const TJ = [{ s: 0.012, h: 0.016, a: 0, b: 13 }, { s: t1, h: 0.0105, a: 13, b: 14 }, { s: t2, h: 0.0062, a: 14, b: 15 }];
  skinSweep(B, tchain, [0.008, 0.005], AX, X, Y, tsec.filter((x, i) => hi || i % (xlo ? 3 : 2) === 0 || i === tsec.length - 1).map(([d, a, b, c, e]) => ({ d, r: [a, b, c, e], n: 2.2 })), seg + 2, {
    cap1: 0.0062,
    w: (d) => chainW(d, TJ),
    bump: (a, k, s) => 0.0008 * Math.exp(-(((s.v - t1) / 0.004) ** 2)) * Math.pow(Math.max(0, Math.sin(a)), 4),
    col: (a, k, p, s) => (Math.sin(a) < -0.3 || s.v > tt - 0.012 ? PALM : WHITE),
    uv: (uu, v, s, px, py) => atlasUV(py < -0.003 || v > tt - 0.012 ? 'leath' : 'glove', 0.85 + px / phys, (v + 0.02) / phys),
  });
  // ---- web: thick membrane between thumb and index. It connects the inner edge of the thumb (from the metacarpal to the middle
  //      of the first phalanx) to the edge of the palm (from the thumb base to the index knuckle); its two edges are
  //      buried in the thumb and in the palm, its vertices shared between their bones: it stretches when the thumb spreads and
  //      folds when it closes. Without it, the thumb seems to start from the wrist.
  {
    const Mt = [restMatrix(u.tm, h), restMatrix(u.tb, h)], half = (z) => {
      for (let i = 0; i < rows.length - 1; i++) if (z <= rows[i][0] && z >= rows[i + 1][0]) return rows[i][1] + (rows[i + 1][1] - rows[i][1]) * (rows[i][0] - z) / (rows[i][0] - rows[i + 1][0]);
      return z > rows[0][0] ? rows[0][1] : rows[rows.length - 1][1];
    };
    const dA = (v) => 0.012 + (t1 + 0.45 * THUMB.L[1] - 0.012) * v, zB = (v) => 0.03 - 0.068 * v;
    const pA = (v, o) => { const d = dA(v); return d <= t1 ? o.set(0, 0, -d).applyMatrix4(Mt[0]) : o.set(0, 0, -(d - t1)).applyMatrix4(Mt[1]); };
    const pB = (v, o) => { const z = zB(v); return o.set(half(z) * 0.7 * side, 0.005, z); };
    const A = new V3(), Bp = new V3(), A1 = new V3(), B1 = new V3(), D = new V3(), N = new V3(), T = new V3(), P = new V3();
    pA(0, A); pB(0, Bp); pA(1, A1); pB(1, B1);
    D.addVectors(A1, B1).sub(A).sub(Bp).normalize();
    const nv = hi ? 10 : xlo ? 3 : 5, nu = hi ? 20 : xlo ? 6 : 10;
    skinSurf(B, nu, nv, (uu, vv, o) => {
      const th = uu * TAU, sAB = (1 - Math.cos(th)) / 2;
      pA(vv, A); pB(vv, Bp);
      // inner point of the thumb: slightly toward the palm, so the membrane's edge stays inside the thumb
      T.subVectors(Bp, A); const len = T.length(); T.multiplyScalar(1 / len); A.addScaledVector(T, 0.004); Bp.addScaledVector(T, -0.002);
      N.crossVectors(T, D).normalize(); if (N.y < 0) N.negate();
      const ht = (0.0095 + (0.005 - 0.0095) * vv) * (vv > 0.8 ? Math.sqrt(Math.max(0, 1 - ((vv - 0.8) / 0.2) ** 2)) : 1) * (0.7 + 0.3 * Math.abs(2 * sAB - 1));
      P.lerpVectors(A, Bp, sAB).addScaledVector(N, ht * Math.sin(th)).addScaledVector(D, -0.011 * Math.sin(Math.PI * sAB) * vv * vv);
      o.x = P.x; o.y = P.y; o.z = P.z;
      const wp = smoothstep(0.2, 0.85, sAB), wt = chainW(dA(vv), TJ), w = [[0, wp]];
      for (const [bi, bw] of wt) { if (bi === 0) w[0][1] += bw * (1 - wp); else w.push([bi, bw * (1 - wp)]); }
      o.w = w;
      const dorsal = Math.sin(th) > 0;
      o.col = dorsal ? WHITE : PALM;
      const uv = atlasUV(dorsal ? 'glove' : 'leath', 0.75 + P.x * side / phys, (P.z + 0.085) / phys); o.U = uv[0]; o.V = uv[1];
    });
  }
  const geo = B.build();
  geo.userData.shared = true;
  return (HAND_GEO[key] = geo);
}
/* Materials of the first-person arms: gloves (outfit hue) and sleeves (outfit camouflage) */
const VM_LOOK = { key: '', fp: '', hand: null, arm: null };
function vmGearMats() {
  const s = skinMine();
  if (!VM_LOOK.hand) { VM_LOOK.hand = gearMaterial(s, 'fp'); VM_LOOK.arm = gearMaterial(s, 'fp'); vmSetLook(s, 0); }
  return VM_LOOK;
}
/* Outfit of the arms on screen: the player's (seen by an ally: light hue), or the killer's during the killcam (dark
   hue). The fine first-person camouflage only exists for the player's outfit (one texture: built at startup,
   redone when they change it, in the menus or in the pause); a killer in another outfit takes that of their model (wider pattern). */
function vmSetLook(skin, rel) {
  const L = VM_LOOK, key = skin + rel; if (!L.hand || L.key === key) return;
  L.key = key;
  const mine = skinMine();
  if (skin === mine && L.fp !== mine) { if (L.fp) gearFreeFp(L.fp); L.fp = mine; }
  const T = skin === mine ? gearTextures(skin, true) : gearTextures(skin, false), G = skinGear(skin);
  skinTone(skin, rel, L.arm.color); L.hand.color.copy(G.glove).multiply(L.arm.color).multiplyScalar(1.15);
  L.arm.map = T.map; L.hand.map = T.map;
}
/* Bones of a hand (groups): root (palm), phalanges of the four fingers, metacarpal and phalanges of the thumb */
function handBones(side) {
  const h = new THREE.Group(), fingers = [];
  for (let i = 0; i < 4; i++) {
    const F = FINGERS[i];
    const base = new THREE.Group(); base.position.set(F.x * side, F.y, F.z); h.add(base);
    const mid = new THREE.Group(); mid.position.z = -F.L[0]; base.add(mid);
    const tip = new THREE.Group(); tip.position.z = -F.L[1]; mid.add(tip);
    fingers.push({ base, mid, tip });
  }
  const tm = new THREE.Group(); tm.position.set(THUMB.cmc[0] * side, THUMB.cmc[1], THUMB.cmc[2]); h.add(tm);
  const tb = new THREE.Group(); tb.position.z = -THUMB.L[0]; tm.add(tb);
  const tt = new THREE.Group(); tt.position.z = -THUMB.L[1]; tb.add(tt);
  const P0 = HAND_REST, cur = { f: [0, 0, 0], i: P0.f.slice(), m: P0.f.slice(), r: P0.f.slice(), p: P0.f.slice(), t: [0, 0, 0, 0, 0, 0, 0, 0].map((x, j) => P0.t[j] || 0), spread: 0, press: 0, trig: 0 };
  const u = { fingers, tm, tb, tt, side, cur, init: false, tq: thumbRestQ(side) };
  h.userData = u;
  handApply(u);
  const bones = [h]; for (const f of fingers) bones.push(f.base, f.mid, f.tip); bones.push(tm, tb, tt);
  const rest = bones.map((b) => (b === h ? new THREE.Matrix4() : restMatrix(b, h)));
  return { h, u, bones, rest };
}
/* Frozen geometry of a hand in a pose (soldiers' hands, which do not move their fingers): vertices deformed once
   by the hand's bones, expressed in the palm frame; returns { p, n, uv, c, idx } */
const HAND_BAKED = {};
function handBaked(side, pose, lod = 'lo') {
  const key = side + pose + lod;
  if (HAND_BAKED[key]) return HAND_BAKED[key];
  const H = handBones(side), g = handGeometry(side, H.u, H.h, lod), P = HAND_POSES[pose] || HAND_POSES.grip, c = H.u.cur;
  c.i = (P.i || P.f).slice(); c.m = (P.m || P.f).slice(); c.r = (P.r || P.f).slice(); c.p = (P.p || P.f).slice(); c.t = P.t.slice(); c.spread = P.spread;
  handApply(H.u);
  const K = H.bones.map((b, i) => (b === H.h ? new THREE.Matrix4() : restMatrix(b, H.h)).multiply(H.rest[i].clone().invert()));
  const pos = g.attributes.position, nor = g.attributes.normal, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, n = pos.count;
  const out = { p: new Float32Array(n * 3), n: new Float32Array(n * 3), uv: g.attributes.uv.array, c: g.attributes.color.array, idx: g.index.array };
  const v = new V3(), a = new V3(), t = new V3(), nm = new THREE.Matrix3();
  for (let k = 0; k < n; k++) {
    a.set(0, 0, 0); t.set(0, 0, 0);
    for (let j = 0; j < 4; j++) {
      const w = sw.array[k * 4 + j]; if (!w) continue;
      const M = K[si.array[k * 4 + j]];
      a.addScaledVector(v.fromBufferAttribute(pos, k).applyMatrix4(M), w);
      t.addScaledVector(v.fromBufferAttribute(nor, k).applyMatrix3(nm.setFromMatrix4(M)), w);
    }
    t.normalize(); a.toArray(out.p, k * 3); t.toArray(out.n, k * 3);
  }
  return (HAND_BAKED[key] = out);
}
function makeHand(M, side = 1) {
  const H = handBones(side), h = H.h, u = H.u, cur = u.cur;
  const mesh = skinnedMesh(handGeometry(side, u, h), vmGearMats().hand, H.bones, H.rest);
  mesh.frustumCulled = false; h.add(mesh); u.mesh = mesh;
  /* target pose (name), thumb pressure, trigger index (0 to 1) */
  u.set = (name, press = 0, trig = 0, shapes = null) => {
    let P = HAND_POSES[name] || HAND_POSES.grip;
    if (P.free && u.trigSrc) trig = Math.max(trig, u.trigSrc());
    // held object: the fingers close until contact (computed every other frame, the hand glides toward the result)
    if (shapes) {
      if (!u.G || u.gName !== name || (u.gTick = (u.gTick || 0) + 1) % 2 === 0) { h.updateMatrix(); u.G = handGrasp(u, P, shapes, h.matrix, u.G || {}); u.gName = name; }
      u.G.spread = P.spread; P = u.G;
    } else u.gName = null;
    const k = u.init ? 1 - Math.exp(-22 * (VM.handDt || 0)) : 1; u.init = true;
    const go = (a, b) => { for (let j = 0; j < a.length; j++) a[j] += ((b[j] || 0) - a[j]) * k; };
    go(cur.i, P.i || P.f); go(cur.m, P.m || P.f); go(cur.r, P.r || P.f); go(cur.p, P.p || P.f); go(cur.t, P.t);
    cur.spread += (P.spread - cur.spread) * k; cur.press += (press - cur.press) * Math.min(1, k * 2);
    cur.trig += (trig - cur.trig) * Math.min(1, k * 2.5);
    handApply(u);
  };
  u.set('grip');
  return h;
}

/* ---------- Arms: skeleton with joint limits ----------
   Long fatigue-uniform sleeve (team camouflage), smoothed over five bones: arm, elbow helper bone (oriented
   halfway, it keeps the volume of the bent elbow), forearm, twist bone at mid-forearm and wrist bone. The forearm
   twist (pronation) is thus distributed from elbow to wrist instead of twisting all at once. The sleeve wrinkles
   at the elbow crease and bunches above the glove; the glove cuff, with its strap, covers the bottom of the sleeve.

   The arm is a real chain: shoulder (anchored to the body, it moves forward or back by an inch or two
   like a shoulder blade), hinged elbow (never fully extended, never bent beyond
   145°), forearm whose twist is free, two-axis wrist (flexion/extension,
   radial/ulnar deviation) with the ranges of a gloved wrist. A hand aimed at the weapon is no
   longer followed blindly: first the elbow position is searched (rotation around the shoulder-wrist
   axis) that keeps the wrist most neutral, then, if the weapon still demands it, the
   hand lets itself turn around its support point rather than the wrist breaking. */
const ARM_REACH = 0.965, ARM_MINLEN = 0.235, WRIST_OFF = 0.056;
const WRIST_LIM = { flex: 1.25, ext: 1.1, uln: 0.66, rad: 0.36 }; // 72°, 63°, 38°, 21°: ranges of a gloved wrist, below the anatomical maximum
/* construction lengths (shoulder-elbow, elbow-wrist); in game, the bones stretch slightly if the pose requires */
const ARM_LU = 0.34, ARM_LF = 0.33;
const _af = { du: new V3(), df: new V3(), n: new V3(), x: new V3(), y: new V3(), z: new V3(), m: new THREE.Matrix4(), q: new THREE.Quaternion(), q2: new THREE.Quaternion() };
function _basisQ(x, y, z, out) { _af.m.makeBasis(x, y, z); return out.setFromRotationMatrix(_af.m); }
/* Places the arm bones between the shoulder S, the elbow E and the wrist W, the hand (oriented by Qh) being at the end.
   Bone frame: -z along the limb, +y on the back-of-hand side when the forearm is neutral (thumb up). */
function armFrames(arm, S, E, W, Qh) {
  const A = _af, b = arm.bones;
  A.du.subVectors(E, S).normalize(); A.df.subVectors(W, E).normalize();
  A.n.crossVectors(A.du, A.df);
  if (A.n.lengthSq() < 1e-6) A.n.copy(arm.lastN); else A.n.normalize();
  if (A.n.dot(arm.lastN) < -0.2) A.n.lerp(arm.lastN, 0.5).normalize();
  arm.lastN.copy(A.n);
  A.y.copy(A.n).multiplyScalar(-arm.side);
  A.z.copy(A.du).negate(); A.x.crossVectors(A.y, A.z); _basisQ(A.x, A.y, A.z, b.up.quaternion); b.up.position.copy(S);
  A.z.copy(A.df).negate(); A.x.crossVectors(A.y, A.z); _basisQ(A.x, A.y, A.z, b.fo.quaternion); b.fo.position.copy(E);
  b.el.quaternion.slerpQuaternions(b.up.quaternion, b.fo.quaternion, 0.5); b.el.position.copy(E);
  // wrist: same axis as the forearm, turned like the hand (back of the hand projected perpendicular to the forearm)
  A.y.set(0, 1, 0).applyQuaternion(Qh); A.y.addScaledVector(A.z, -A.y.dot(A.z));
  if (A.y.lengthSq() < 1e-6) A.y.set(0, 1, 0).applyQuaternion(b.fo.quaternion); A.y.normalize();
  A.x.crossVectors(A.y, A.z); _basisQ(A.x, A.y, A.z, b.wr.quaternion); b.wr.position.copy(W);
  b.tw.quaternion.slerpQuaternions(b.fo.quaternion, b.wr.quaternion, 0.5); b.tw.position.addVectors(E, W).multiplyScalar(0.5);
}
/* Geometry of an arm (side side): sleeve (sleeve material) and glove cuff (glove material);
   bones: 0 arm, 1 elbow helper, 2 forearm, 3 twist, 4 wrist, 5 hand */
const ARM_GEO = {};
function armGeometry(side, rest) {
  if (ARM_GEO[side]) return ARM_GEO[side];
  const LU = ARM_LU, LF = ARM_LF, dW = LU + LF, X = new V3(1, 0, 0), Y = new V3(0, 1, 0), AX = new V3(0, 0, -1);
  const chain = [{ M: rest[0], L: LU }, { M: rest[2], L: LF }];
  // weights: arm / elbow helper / forearm group, itself divided among forearm, twist and wrist
  const wArm = (d, handK = 0) => {
    const te = clamp((d - (LU - 0.07)) / 0.14, 0, 1), t = clamp((d - LU) / LF, 0, 1);
    const g = te * te, w = [[0, (1 - te) * (1 - te)], [1, 2 * te * (1 - te)], [2, g * (1 - t) * (1 - t)], [3, g * 2 * t * (1 - t)], [4, g * t * t * (1 - handK)]];
    if (handK > 0) w.push([5, g * t * t * handK]);
    return w;
  };
  // ---- sleeve: wide arm, elbow, tapering forearm, fabric bunched above the glove
  const B = new SkinBuilder(), R = mulberry32(side > 0 ? 3 : 4);
  const ph = []; for (let i = 0; i < 8; i++) ph.push(R() * TAU);
  const prof = [[-0.08, 0.056], [-0.03, 0.058], [0.05, 0.056], [0.14, 0.053], [0.22, 0.05], [LU - 0.06, 0.047], [LU - 0.03, 0.046], [LU, 0.047], [LU + 0.03, 0.049], [LU + 0.07, 0.048],
    [LU + 0.12, 0.0435], [LU + 0.17, 0.0405], [LU + 0.21, 0.038], [LU + 0.235, 0.0372], [LU + 0.25, 0.036], [dW - 0.066, 0.031], [dW - 0.05, 0.0295], [dW - 0.03, 0.0285]];
  const S = [];
  for (let i = 0; i < prof.length - 1; i++) { const [d0, r0] = prof[i], [d1, r1] = prof[i + 1], n = Math.max(1, Math.round((d1 - d0) / 0.012)); for (let k = 0; k < n; k++) { const t = k / n; S.push({ d: lerp(d0, d1, t), rr: lerp(r0, r1, t) }); } }
  S.push({ d: prof[prof.length - 1][0], rr: prof[prof.length - 1][1] });
  skinSweep(B, chain, [0.035], AX, X, Y, S.map((s) => ({ d: s.d, r: [s.rr * 1.02, s.rr * 1.02, s.rr * 0.92, s.rr * 0.96], n: 2.1, rr: s.rr })), 30, {
    a0: side > 0 ? Math.PI : 0, // sleeve seam under the arm, flexor side
    w: (d) => wArm(d),
    bump: (a, k, s) => {
      const d = s.v, fl = Math.cos(a) * side; // fl = 1: elbow crease side
      let b = 0;
      // elbow: olecranon point behind, fan-shaped wrinkles in the elbow crease
      b += 0.006 * Math.exp(-(((d - LU) / 0.03) ** 2)) * Math.pow(Math.max(0, -fl), 3);
      b += 0.0035 * Math.sin((d - LU) * 150 + ph[0]) * Math.exp(-(((d - LU) / 0.045) ** 2)) * Math.pow(Math.max(0, fl), 1.5);
      // long wrinkles of the forearm and arm, turning slightly around the limb
      b += 0.0016 * Math.sin(a * 3 + d * 18 + ph[1]) + 0.0009 * Math.sin(a * 5 - d * 31 + ph[2]);
      // fabric bunched above the glove: irregular rolls
      const acc = smoothstep(LU + 0.15, LU + 0.22, d) * (1 - smoothstep(dW - 0.085, dW - 0.07, d));
      b += acc * (0.0032 * Math.sin(d * 230 + Math.sin(a * 2 + ph[3]) * 1.6) + 0.0018 * Math.sin(a * 4 + d * 90 + ph[4]));
      return b;
    },
    col: (a, k, p, s) => { const c = 0.92 + 0.08 * Math.sin(a * 3 + s.v * 18 + ph[1]); return new THREE.Color(c, c, c); },
    uv: (u, v) => camoUV(u * 0.34, v, 0.34, side > 0 ? 0.13 : 0.61, 0.07),
  });
  // ---- glove cuff: flared at the opening, tight at the wrist, hook-and-loop strap across, rolled edge
  const C = new SkinBuilder(), WHITE = new THREE.Color(1, 1, 1), NEO = new THREE.Color(0.55, 0.55, 0.55), STRAP = new THREE.Color(0.42, 0.42, 0.42);
  const cs = [[dW - 0.062, 0.031, 0], [dW - 0.059, 0.0372, 0], [dW - 0.055, 0.0378, 0], [dW - 0.049, 0.0372, 0], [dW - 0.043, 0.0364, 1], [dW - 0.036, 0.0356, 1], [dW - 0.029, 0.0348, 1], [dW - 0.022, 0.0334, 0], [dW - 0.014, 0.0322, 0],
    [dW - 0.006, 0.031, 0], [dW + 0.004, 0.0302, 0], [dW + 0.014, 0.0296, 0]];
  skinSweep(C, chain, [0.035], AX, X, Y, cs.map(([d, r, st]) => ({ d, r: [r * 1.05, r * 1.05, r * 0.95, r * 0.98], n: 2.3, st })), 30, {
    w: (d) => wArm(d, clamp((d - (dW - 0.02)) / 0.03, 0, 1) * 0.55),
    bump: (a, k, s) => (s.st ? 0.0022 + 0.0006 * Math.sin(a * 22) * 0 : 0) + (k === 1 || k === 2 ? 0.001 : 0),
    col: (a, k, p, s) => (s.st ? STRAP : k <= 3 ? NEO : WHITE),
    uv: (u, v, s, px, py) => atlasUV('glove', 0.5 + Math.atan2(py, px) / TAU * 0.9, (v - dW + 0.07) / 0.1),
  });
  // strap tab (on the back of the wrist) and buckle: placed in the forearm frame, which starts at the elbow
  // (distance counted from the elbow, not from the shoulder like the sections: otherwise it floats 34 cm farther)
  const tab = new THREE.Matrix4().compose(new V3(0, 0.0352, -(dW - 0.036 - LU)), new THREE.Quaternion(), new V3(1, 1, 1));
  C.geo(rgeo(0.022, 0.004, 0.02, 0.0015), rest[2].clone().multiply(tab), [[3, 0.4], [4, 0.6]], STRAP, () => GEAR_TILE.nyl);
  const out = { sleeve: B.build(), cuff: C.build() };
  out.sleeve.userData.shared = out.cuff.userData.shared = true;
  return (ARM_GEO[side] = out);
}
/* side: +1 left hand, -1 right hand (the thumb is on the x = side of the hand) */
function makeArm(M, parent, side) {
  const P = parent || VM.holder, L = vmGearMats();
  const hand = makeHand(M, side);
  const bones = { up: new THREE.Object3D(), el: new THREE.Object3D(), fo: new THREE.Object3D(), tw: new THREE.Object3D(), wr: new THREE.Object3D() };
  const arm = { hand, bones, side, phi: 0, psi: 0, chi: 0, jt: { fl: 0, dv: 0, r: 0, elbow: 0, reach: 0 }, lastN: new V3(-1, 0, 0) };
  // construction pose: arm along -z, elbow slightly bent downward, neutral wrist
  const S = new V3(0, 0, 0), E = new V3(0, 0, -ARM_LU), W = E.clone().add(new V3(0, -Math.sin(0.35), -Math.cos(0.35)).multiplyScalar(ARM_LF));
  const fd = new V3().subVectors(W, E).normalize(), yv = new V3(-1, 0, 0).multiplyScalar(-side);
  const Qh = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new V3().crossVectors(yv, fd.clone().negate()), yv, fd.clone().negate()));
  armFrames(arm, S, E, W, Qh);
  hand.position.copy(W).addScaledVector(fd, WRIST_OFF); hand.quaternion.copy(Qh);
  const list = [bones.up, bones.el, bones.fo, bones.tw, bones.wr, hand];
  const rest = list.map((b) => { b.updateMatrix(); return b.matrix.clone(); });
  const G = armGeometry(side, rest);
  arm.mesh = skinnedMesh(G.sleeve, L.arm, list, rest); arm.mesh.frustumCulled = false;
  arm.cuffMesh = new THREE.SkinnedMesh(G.cuff, L.hand); arm.cuffMesh.bind(arm.mesh.skeleton, _RIG_ID); arm.cuffMesh.frustumCulled = false;
  P.add(bones.up, bones.el, bones.fo, bones.tw, bones.wr, hand, arm.mesh, arm.cuffMesh);
  return arm;
}
function setArmVisible(arm, v) { arm.mesh.visible = v; arm.cuffMesh.visible = v; arm.hand.visible = v; if (arm.watch) arm.watch.visible = v; }
const _aS = new V3(), _aE = new V3(), _aD = new V3(), _aP = new V3(), _aN = new V3(), _aF = new V3(), _aH = new V3(), _aW = new V3(), _aG = new V3(), _aB = new V3(), _aX = new V3();
const _aQ = new THREE.Quaternion(), _aQi = new THREE.Quaternion(), _aQf = new THREE.Quaternion(), _aM = new THREE.Matrix4();
/* Shoulder possibly displaced, then elbow for a rotation angle phi around the shoulder-wrist axis
   (phi = 0: the elbow points toward the pole). Results in oS (shoulder) and oE (elbow); returns the inner angle of the elbow. */
function elbowAt(S, W, a, b, pole, phi, oS, oE) {
  _aD.subVectors(W, S); let len = _aD.length(); _aD.multiplyScalar(1 / Math.max(1e-6, len));
  oS.copy(S);
  const max = (a + b) * ARM_REACH;
  // too far: the shoulder blade moves forward; too close: it moves back (the elbow does not bend beyond 145°)
  if (len > max) { oS.addScaledVector(_aD, len - max); len = max; } else if (len < ARM_MINLEN) { oS.addScaledVector(_aD, len - ARM_MINLEN); len = ARM_MINLEN; }
  const cosA = clamp((a * a + len * len - b * b) / (2 * a * len), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
  _aP.subVectors(pole, oS); _aP.addScaledVector(_aD, -_aP.dot(_aD));
  if (_aP.lengthSq() < 1e-8) _aP.set(0, -1, 0).addScaledVector(_aD, _aD.y);
  _aP.normalize(); _aN.crossVectors(_aD, _aP);
  const c = Math.cos(phi), s = Math.sin(phi);
  oE.copy(oS).addScaledVector(_aD, a * cosA).addScaledVector(_aP, a * sinA * c).addScaledVector(_aN, a * sinA * s);
  return len;
}
/* Wrist flexion and deviation when the elbow is at E: in the hand frame, the elbow is
   in the +z direction when the wrist is straight. If the elbow ends up on the back-of-hand side, the hand is
   tilted toward that same side relative to the forearm: that is an extension. fl > 0: palmar flexion;
   dv > 0: ulnar deviation (toward the little finger). The ratio to the limit is 1 at the stop. */
const _bend = { fl: 0, dv: 0, r: 0 };
function wristBend(Qinv, E, W, side) {
  _aB.subVectors(E, W).normalize().applyQuaternion(Qinv);
  const fl = -Math.atan2(_aB.y, _aB.z), dv = -Math.atan2(_aB.x * side, _aB.z);
  _bend.fl = fl; _bend.dv = dv;
  const rf = fl / (fl >= 0 ? WRIST_LIM.flex : WRIST_LIM.ext), rd = dv / (dv >= 0 ? WRIST_LIM.uln : WRIST_LIM.rad); _bend.r = Math.sqrt(rf * rf + rd * rd);
  return _bend;
}
const _sE = new V3(), _sS = new V3();
const _bs = { phi: 0, cost: 0 }; // (fields of an object: a module variable receiving a floating-point number allocates it on every write)
/* Best elbow angle: wrist as neutral as possible, without straying from the pole for no reason,
   with a preference for the previous frame's angle (no jump from one frame to the next).
   Result in _bs.phi (angle) and _bs.cost (cost) */
const _bsC = new Float32Array(27);
function bestSwivel(arm, S, W, Qinv, a, b, pole) {
  let bi = 0, bc = 1e9;
  for (let k = -13; k <= 13; k++) {
    const phi = k * 0.1;
    elbowAt(S, W, a, b, pole, phi, _sS, _sE);
    const r = wristBend(Qinv, _sE, W, arm.side).r;
    const cost = r * r * 0.8 + 40 * Math.max(0, r - 0.85) ** 2 + 0.4 * phi * phi + 0.3 * (phi - arm.phi) ** 2;
    _bsC[k + 13] = cost;
    if (cost < bc) { bc = cost; bi = k + 13; }
  }
  _bs.phi = (bi - 13) * 0.1 + parabolaStep(_bsC, bi, 27) * 0.1; _bs.cost = bc;
}
/* Vertex of the parabola through sample i of a cost survey and its two neighbors, as a fraction of a step (from -0.5 to 0.5):
   the optimum then varies continuously instead of jumping from one sample to another (the elbow advanced in 0.1 rad notches) */
function parabolaStep(C, i, n, stride = 1) {
  if (i < stride || i + stride >= n) return 0;
  const c0 = C[i - stride], c1 = C[i], c2 = C[i + stride], den = c0 - 2 * c1 + c2;
  return den > 1e-9 ? clamp((0.5 * (c0 - c2)) / den, -0.5, 0.5) : 0;
}
/* Places the arm between the shoulder and the wrist, the hand already being oriented */
function drawArm(arm, S, E, W, r0, r1, elbowFlex) {
  arm.wrist = (arm.wrist || new V3()).copy(W); arm.foreDir = (arm.foreDir || new V3()).subVectors(W, E).normalize();
  armFrames(arm, S, E, W, arm.hand.quaternion);
}
/* Watch on the left wrist, dial on the back of the wrist, just behind the glove cuff */
function placeWatch(w, arm) {
  if (!arm.foreDir) return;
  const fd = arm.foreDir, dorsal = new V3(0, 1, 0).applyQuaternion(arm.hand.quaternion);
  dorsal.addScaledVector(fd, -dorsal.dot(fd)).normalize();
  w.position.copy(arm.wrist).addScaledVector(fd, -0.1).addScaledVector(dorsal, 0.029);
  const x = new V3().crossVectors(dorsal, fd).normalize();
  _m1.makeBasis(x, dorsal, fd); w.quaternion.setFromRotationMatrix(_m1);
}
/* Camera arm to a hand held at a support point (off, in the hand frame): the hand is
   oriented by Q0. A hand gripping a handle or a forend can pivot around that object without letting go:
   axis (in the hand frame) and range give this free rotation; lift (support hand, lHandFrame) gives the distance from
   the palm to the grip for each roll (liftAt): it stays on a forend or a grip that is not round. We search for
   the pair (hand rotation,
   elbow position) that keeps the wrist most neutral. If the weapon still forces an out-of-limits wrist, the hand
   pivots around its support point rather than breaking the wrist. */
const _pQ = new THREE.Quaternion(), _pQi = new THREE.Quaternion(), _pQc = new THREE.Quaternion(), _pO = new V3(), _pH = new V3(), _pW = new V3(), _pG = new V3(), _pS = new V3(), _pE = new V3(), _pV = new V3(), _pV2 = new V3();
function handAt(Q) { // hand origin and wrist for an orientation Q, the support point staying fixed
  _pH.copy(_pO).applyQuaternion(Q).negate().add(_pG);
  _pW.set(0, 0, WRIST_OFF).applyQuaternion(Q).add(_pH);
}
const _pC = new Float32Array(25);
function poseArmToHand(arm, S, H0, Q0, pole, pose, press = 0, a = 0.34, b = 0.33, off = null, axis = null, range = 0.6, axis2 = null, range2 = 0.3, shapes = null, lift = null) {
  if (off) _pO.copy(off); else _pO.set(0, 0, 0);
  _pG.copy(_pO).applyQuaternion(Q0).add(H0); // support point, fixed during the search
  const side = arm.side, dt = Math.min(VM.handDt || 1 / 60, 0.05);
  if (VM.debugArms) arm.dbg = { S: S.clone(), G: _pG.clone(), Q0: Q0.clone(), pole: pole.clone(), axis: axis ? axis.clone() : null, range, axis2: axis2 ? axis2.clone() : null, range2, a, b, off: _pO.clone() };
  // 1. free rotations around the held object (rolling around a grip, tilting slightly on it), with the elbow
  //    adapting to each trial
  const Q = _pQ, N = axis ? 5 : 1, N2 = axis2 ? 5 : 1;
  let bestPsi = 0, bestChi = 0, bestPhi = 0, bc = 1e9, bn = 0, bn2 = 0;
  for (let n = 0; n < N; n++) {
    const psi = N > 1 ? (n / (N - 1) * 2 - 1) * range : 0;
    for (let n2 = 0; n2 < N2; n2++) {
      const chi = N2 > 1 ? (n2 / (N2 - 1) * 2 - 1) * range2 : 0;
      Q.copy(Q0); if (N > 1) Q.multiply(_pQc.setFromAxisAngle(axis, psi)); if (N2 > 1) Q.multiply(_pQc.setFromAxisAngle(axis2, chi));
      if (lift) _pO.y = -liftAt(lift, psi);
      handAt(Q); _pQi.copy(Q).invert(); bestSwivel(arm, S, _pW, _pQi, a, b, pole);
      // under a forend, a roll that would lower the palm (protruding part, magazine) is discarded
      const cost = _bs.cost + (N > 1 ? 0.4 * (psi / range) ** 2 : 0) + (N2 > 1 ? 0.6 * (chi / range2) ** 2 : 0) + 0.4 * (psi - arm.psi) ** 2 + 0.4 * (chi - arm.chi) ** 2
        + (lift ? 2000 * Math.max(0, -_pO.y - lift.lo - 0.003) ** 2 : 0);
      _pC[n * N2 + n2] = cost;
      if (cost < bc) { bc = cost; bestPsi = psi; bestChi = chi; bestPhi = _bs.phi; bn = n; bn2 = n2; }
    }
  }
  // refinement between samples (parabola vertex), as for the elbow: the hand rolls continuously
  if (N > 1) bestPsi += parabolaStep(_pC, bn * N2 + bn2, N * N2, N2) * (2 * range) / (N - 1) * (bn > 0 && bn < N - 1 ? 1 : 0);
  if (N2 > 1) bestChi += parabolaStep(_pC, bn * N2 + bn2, N * N2, 1) * (2 * range2) / (N2 - 1) * (bn2 > 0 && bn2 < N2 - 1 ? 1 : 0);
  // 2. the angles reach their target smoothly (exponential approach, at most 9 rad/s): no elbow jump nor hand turning
  //    all at once, and no more jerky motion at constant speed
  const step = 9 * dt, f = 1 - Math.exp(-25 * dt);
  if (!arm._init) { arm.psi = bestPsi; arm.chi = bestChi; arm.phi = bestPhi; arm._init = true; }
  else { arm.psi += clamp((bestPsi - arm.psi) * f, -step, step); arm.chi += clamp((bestChi - arm.chi) * f, -step, step); arm.phi += clamp((bestPhi - arm.phi) * f, -step, step); }
  Q.copy(Q0); if (N > 1) Q.multiply(_pQc.setFromAxisAngle(axis, arm.psi)); if (N2 > 1) Q.multiply(_pQc.setFromAxisAngle(axis2, arm.chi));
  if (lift) _pO.y = -liftAt(lift, arm.psi);
  // 3. wrist still at the stop: the hand pivots around its support point, in several passes
  let bd = null;
  for (let it = 0; it < 4; it++) {
    handAt(Q); _pQi.copy(Q).invert(); elbowAt(S, _pW, a, b, pole, arm.phi, _pS, _pE);
    bd = wristBend(_pQi, _pE, _pW, side);
    if (bd.r <= 1) break;
    const k = 1 / bd.r * 0.98, fl = bd.fl * k, dv = bd.dv * k;
    _pV.set(-Math.tan(dv) * side, -Math.tan(fl), 1).normalize();
    _pV2.subVectors(_pE, _pW).normalize().applyQuaternion(_pQi);
    _pQc.setFromUnitVectors(_pV, _pV2); Q.multiply(_pQc);
    if (it === 3) { // last resort: pivot around the wrist, the contact slides a few millimeters
      _pH.set(0, 0, -WRIST_OFF).applyQuaternion(Q).add(_pW); _pQi.copy(Q).invert(); bd = wristBend(_pQi, _pE, _pW, side);
    }
  }
  // 4. final orientation smoothed (in the weapon frame): a grip change (a free axis appearing, the wrist entering
  //    the stop) no longer turns the hand all at once from one frame to the next; it reaches the computed orientation in a few
  //    frames (exponential approach, at most 14 rad/s), around the same support point. A deviation of more than 70° (weapon switch)
  //    is taken as is.
  if (arm._qs && VM.handDt) {
    const ang = 2 * Math.acos(Math.min(1, Math.abs(arm._qs.dot(Q))));
    if (ang > 1e-4 && ang < 1.2) {
      let k = 1 - Math.exp(-30 * dt); if (ang * k > 14 * dt) k = (14 * dt) / ang;
      Q.copy(arm._qs.slerp(Q, k)); handAt(Q); _pQi.copy(Q).invert(); elbowAt(S, _pW, a, b, pole, arm.phi, _pS, _pE); bd = wristBend(_pQi, _pE, _pW, side);
    }
  }
  (arm._qs = arm._qs || new THREE.Quaternion()).copy(Q);
  const J = arm.jt; J.fl = bd.fl; J.dv = bd.dv; J.r = bd.r; J.reach = _pS.distanceTo(S); J.psi = arm.psi; J.chi = arm.chi;
  J.turn = 2 * Math.acos(Math.min(1, Math.abs(Q.dot(Q0)))); // orientation offset from the target pose
  _pV.subVectors(_pS, _pE).normalize(); _pV2.subVectors(_pW, _pE).normalize(); J.elbow = Math.PI - Math.acos(clamp(_pV.dot(_pV2), -1, 1));
  arm.hand.position.copy(_pH); arm.hand.quaternion.copy(Q);
  (arm.elbowAt = arm.elbowAt || new V3()).copy(_pE); (arm.wristAt = arm.wristAt || new V3()).copy(_pW);
  drawArm(arm, _pS, _pE, _pW, 0.046, 0.039, J.elbow);
  arm.hand.userData.set(pose, press, 0, shapes);
}
/* Arm whose hand extends the forearm (grenade): the wrist is straight, plus an optional flexion (wrist snap
   at release), and a free forearm roll around its axis */
const _alq = new THREE.Quaternion(), _alr = new THREE.Quaternion(), _alv = new V3();
function placeArm(arm, S, T, a, b, pole, r0, r1, roll = 0, flex = 0) {
  const len = elbowAt(S, T, a, b, pole, 0, _pS, _pE);
  _alv.subVectors(T, _pE).normalize();
  _m1.lookAt(new V3(0, 0, 0), _alv, UP); _alq.setFromRotationMatrix(_m1);
  _alq.multiply(_alr.setFromAxisAngle(_alv.set(0, 0, 1), roll));
  _alq.multiply(_alr.setFromAxisAngle(_alv.set(1, 0, 0), -flex));
  arm.hand.quaternion.copy(_alq);
  arm.hand.position.copy(T).add(_pV.set(0, 0, -(WRIST_OFF - 0.02)).applyQuaternion(_alq));
  _alv.subVectors(_pS, _pE).normalize(); _pV2.subVectors(T, _pE).normalize();
  const J = arm.jt; J.elbow = Math.PI - Math.acos(clamp(_alv.dot(_pV2), -1, 1)); J.fl = flex; J.dv = 0; J.r = Math.abs(flex) / (flex >= 0 ? WRIST_LIM.flex : WRIST_LIM.ext); J.reach = _pS.distanceTo(S);
  drawArm(arm, _pS, _pE, T, r0, r1, J.elbow);
}
function buildWatch(M) {
  const w = new THREE.Group();
  rb(w, M.dark, 0, 0, 0, 0.032, 0.01, 0.036, 0.005);
  rb(w, M.lens, 0, 0.0055, 0, 0.024, 0.002, 0.026, 0.004);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.02, 20, 1, true), M.tube || M.dark);
  band.rotation.x = Math.PI / 2; band.position.y = -0.029; w.add(band);
  return w;
}

/* Hand frame on a held device (terminal, tablet), in the device frame: p, palm center; f, direction of the extended
   fingers; b, back of the hand. The thumb places itself on the radial side (up for a right hand whose fingers point left,
   palm forward). */
function devGrip(parent, p, f, b) {
  const ref = new THREE.Object3D(); ref.position.set(p[0], p[1], p[2]);
  ref.quaternion.copy(frameZY([-f[0], -f[1], -f[2]], b)); parent.add(ref); return ref;
}
/* Places a streak arm on the hand frame of a held device (terminal, tablet) */
const _devP = new V3(), _devQ = new THREE.Quaternion();
const DEV_AXIS = new V3(1, 0, 0); // the grip is vertical, along the knuckle line: the hand can roll around it
function armOnDevice(arm, ref, sideKey, pose, press, visible, range = 0.3) {
  setArmVisible(arm, visible); if (!visible) return;
  ref.updateWorldMatrix(true, false); ref.getWorldPosition(_devP); ref.getWorldQuaternion(_devQ);
  const D = VM_BODY.dev[sideKey], S = D.S, pole = S.clone().add(D.pole);
  poseArmToHand(arm, S, _devP.clone(), _devQ.clone(), pole, pose, press, 0.34, 0.33, null, DEV_AXIS, range);
}

/* The held object follows the hand, not the other way around: when the wrist cannot follow the target pose, the hand stays
   on the object and it is the object that tilts with it. ref: grip frame in the object (direct child or grandchild
   with no offset), hand: the already placed hand, in the same space as the object. */
const _ahM = new THREE.Matrix4(), _ahR = new THREE.Matrix4(), _ahS = new V3();
function attachToHand(obj, ref, hand) {
  ref.updateMatrix(); hand.updateMatrix();
  _ahR.copy(ref.matrix).invert(); _ahM.copy(hand.matrix).multiply(_ahR);
  _ahM.decompose(obj.position, obj.quaternion, _ahS);
  obj.updateMatrix();
}

