/* ==========================================================================
   DETAILED MODELS (replace the base versions)
   Weapons made of rounded pieces with their functional details, gloved articulated
   hands (two-phalanx fingers, thumb), per-action poses, UAV terminal
   held in hand and operated with the thumb, M67 grenade with spoon and pin.
   The sighting parts keep exactly their positions (ADS alignment).
   ========================================================================== */
const RBG = new Map();
function rgeo(w, h, d, r) {
  const k = `${w}|${h}|${d}|${r}`;
  // dimensions kept for the lightweight version of weapons seen from afar (lowPolyGeometry: simple box)
  if (!RBG.has(k)) { const g = new THREE.RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)); g.userData.box = [w, h, d]; RBG.set(k, g); }
  return RBG.get(k);
}
const rb = (p, mat, x, y, z, w, h, d, r = 0.004, rx = 0, ry = 0, rz = 0) => part(p, rgeo(w, h, d, r), mat, x, y, z, 1, 1, 1, rx, ry, rz);
const G_CYL12 = new THREE.CylinderGeometry(1, 1, 1, 20), G_CAP = new THREE.CapsuleGeometry(1, 1, 4, 10), G_TOR = new THREE.TorusGeometry(1, 0.18, 8, 20);
const cy = (p, mat, x, y, z, r, len, rx = Math.PI / 2, ry = 0, rz = 0, geo = G_CYL12) => part(p, geo, mat, x, y, z, r, len, r, rx, ry, rz);
function rail(p, M, x, y, z, len, vertical) {
  // Picatinny rail: base and teeth
  rb(p, M.dark, x, y, z, vertical ? 0.008 : 0.022, vertical ? 0.022 : 0.008, len, 0.002);
  for (let i = 0; i < Math.floor(len / 0.012); i++) { const zz = z - len / 2 + 0.006 + i * 0.012; if (vertical) bx(p, M.dark, x + Math.sign(x) * 0.005, y, zz, 0.004, 0.024, 0.006); else bx(p, M.dark, x, y + 0.005, zz, 0.024, 0.004, 0.006); }
}
function curvedMag(parent, M, n, len, w, d, curve, mat) {
  // curved magazine: a single profile along an arc (the arc leans forward), heel plate and ribs on the front face
  const N = Math.max(8, n * 2), pts = [], front = [], rear = [], ds = len / N;
  let y = 0, z = 0;
  for (let i = 0; i <= N; i++) {
    const a = curve * i / N, nz = Math.cos(a), ny = -Math.sin(a), h = d / 2;
    front.push([z - nz * h, y - ny * h]); rear.push([z + nz * h, y + ny * h]);
    if (i < N) { y -= Math.cos(a + curve / N / 2) * ds; z -= Math.sin(a + curve / N / 2) * ds; }
  }
  front[0][1] += 0.012; rear[0][1] += 0.012; // the top protrudes into the well
  for (const q of front) pts.push([q[0], q[1], 0]); for (let i = N; i >= 0; i--) pts.push([rear[i][0], rear[i][1], 0]);
  prof(parent, mat || M.poly, pts, w, 0, 0.0035, 0.002);
  const a = curve;
  for (let i = 1; i < n; i += 2) {
    const t = i / n, aa = curve * t, k = Math.round(t * N), q = front[k];
    bx(parent, M.dark, 0, q[1], q[0] - 0.0005, w + 0.002, 0.004, 0.003, aa);
  }
  rb(parent, M.dark, 0, y - 0.006, z, w + 0.004, 0.014, d + 0.008, 0.003, a);
}

/* buildGunModel (assembly of a mounted weapon) and the models themselves: 06j-models.js and following */

/* ---------- M67 grenade: body, spoon, pin ---------- */
/* Grenade in hand, by type (NADE_TYPES): frag (M67, ovoid), flash (M84, pierced gray cylinder), smoke (M18, khaki box with light band); same
   plug, spoon and ring, in the same place */
function buildGrenadeModel(M, type = 'frag') {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0x2f3421, roughness: 0.62, metalness: 0.12, normalMap: M.poly.normalMap, normalScale: new THREE.Vector2(0.3, 0.3) });
  if (type === 'flash') {
    cy(g, M.metal, 0, -0.01, 0, 0.021, 0.085, 0);
    for (const y of [-0.035, 0.015]) cy(g, body, 0, y, 0, 0.0225, 0.012, 0); // dark bands
  } else if (type === 'smoke') {
    cy(g, body, 0, -0.012, 0, 0.029, 0.1, 0);
    cy(g, M.metal, 0, 0.026, 0, 0.0295, 0.014, 0); // light band
  } else if (type === 'knife') {
    throwKnifeBuild(g, throwKnifeSteel(), M.rubber);
    g.userData.spoon = new THREE.Object3D(); g.userData.ring = new THREE.Object3D(); g.add(g.userData.ring); // (no spoon or ring)
    return g;
  } else part(g, new THREE.SphereGeometry(1, 18, 14), body, 0, 0, 0, 0.032, 0.037, 0.032);
  cy(g, M.metal, 0, 0.038, 0, 0.011, 0.018, 0);
  const spoon = rb(g, M.metal, 0.02, 0.018, 0, 0.008, 0.07, 0.016, 0.003, 0, 0, 0.35); g.userData.spoon = spoon;
  const ring = part(g, G_TOR, M.metal, -0.018, 0.045, 0, 0.012, 0.012, 0.012, 0, Math.PI / 2, 0); g.userData.ring = ring;
  return g;
}
/* One-piece throwing knife (frame: tip toward +y, the blade ends at y = 0.115, the pommel at y = -0.08; flat in the xy plane), in hand
   (buildGrenadeModel) and in flight (tknifeTemplate, 07-bots.js): a single steel cutout, spearpoint blade and solid handle, extruded with a
   bevel all around that forms the edge (no gap between blade and handle: owner's feedback, the old box model left one);
   on the handle, a black cord wound in tight, slightly tilted coils. Geometries built once, shared */
const THROW_KNIFE_G = { steel: null, cord: null };
function throwKnifeSteel() { return THROW_KNIFE_G.mat || (THROW_KNIFE_G.mat = new THREE.MeshStandardMaterial({ color: 0xa3a7ab, roughness: 0.32, metalness: 0.9 })); }
function throwKnifeBuild(g, steel, cord) {
  const G = THROW_KNIFE_G;
  if (!G.steel) {
    const sh = new THREE.Shape(); // outline: from the rounded pommel to the blade tip, symmetric
    sh.moveTo(-0.0105, -0.072); sh.quadraticCurveTo(-0.0105, -0.08, 0, -0.08); sh.quadraticCurveTo(0.0105, -0.08, 0.0105, -0.072);
    sh.lineTo(0.0105, -0.002); sh.lineTo(0.0135, 0.018); sh.quadraticCurveTo(0.0142, 0.05, 0.0085, 0.084); sh.lineTo(0, 0.115);
    sh.lineTo(-0.0085, 0.084); sh.quadraticCurveTo(-0.0142, 0.05, -0.0135, 0.018); sh.lineTo(-0.0105, -0.002); sh.closePath();
    G.steel = new THREE.ExtrudeGeometry(sh, { depth: 0.0012, bevelEnabled: true, bevelThickness: 0.0011, bevelSize: 0.0028, bevelOffset: -0.0028, bevelSegments: 1, curveSegments: 6, steps: 1 });
    G.steel.translate(0, 0, -0.0006); G.steel.computeVertexNormals();
    G.cord = rgeo(0.0252, 0.0086, 0.0086, 0.0038); // one coil of cord around the handle (flat of 2.1 x 0.34 cm)
  }
  const m = new THREE.Mesh(G.steel, steel); m.castShadow = true; g.add(m);
  for (let i = 0; i < 8; i++) { const c = new THREE.Mesh(G.cord, cord); c.position.set(0, -0.069 + i * 0.0084, 0); c.rotation.z = (i % 2 ? -1 : 1) * 0.08; c.castShadow = true; g.add(c); }
  return g;
}
const NADE_RIG = { g: null, arm: null, left: null, nade: null, ring: null };
function initNadeRig() {
  const M = gunMaterials(), g = new THREE.Group(); g.visible = false; VM.root.add(g);
  const R = makeArm(M, g, -1), L = makeArm(M, g, 1);
  const models = {}; for (const id of NADE_IDS) { models[id] = buildGrenadeModel(M, id); models[id].visible = false; g.add(models[id]); }
  const nade = models.frag, ring = nade.userData.ring;
  Object.assign(NADE_RIG, { g, R, L, nade, ring, M, models });
  if (VM.nadeRig) VM.nadeRig.visible = false;
}
function rigArm(a, S, T, pole, pose, roll, flex = 0) {
  placeArm(a, S, T, 0.34, 0.34, pole, 0.05, 0.043, roll, flex); a.hand.userData.set(pose);
}
const _nv = (x, y, z) => new V3(x, y, z);
function keyLerp(keys, t) {
  // smooth interpolation between key positions [time, x, y, z]
  if (t <= keys[0][0]) return _nv(keys[0][1], keys[0][2], keys[0][3]);
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const a = keys[i - 1], b = keys[i], u = smoothstep(0, 1, (t - a[0]) / (b[0] - a[0])); return _nv(lerp(a[1], b[1], u), lerp(a[2], b[2], u), lerp(a[3], b[3], u)); }
  const k = keys[keys.length - 1]; return _nv(k[1], k[2], k[3]);
}
/* Catmull-Rom curve through key positions [time, x, y, z]: unlike keyLerp, the hand does not
   stop at each key, the velocity is continuous (essential for a throwing gesture) */
function keySpline(keys, t) {
  const n = keys.length;
  if (t <= keys[0][0]) return _nv(keys[0][1], keys[0][2], keys[0][3]);
  if (t >= keys[n - 1][0]) { const k = keys[n - 1]; return _nv(k[1], k[2], k[3]); }
  let i = 0; while (t > keys[i + 1][0]) i++;
  const p0 = keys[Math.max(0, i - 1)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(n - 1, i + 2)];
  const u = (t - p1[0]) / (p2[0] - p1[0]), u2 = u * u, u3 = u2 * u;
  const c = (j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * u + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * u2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * u3);
  return _nv(c(1), c(2), c(3));
}
/* Grenade, three beats as in CoD:
   pull  : the weapon lowers, the grenade rises in the right hand, the left tears off the ring;
   cook  : right arm cocked behind the shoulder, grenade at upper right, left arm extended forward;
   throw : the arm comes over the shoulder, the grenade leaves forward, the arm finishes its sweep at lower left. */
const NADE_POSE = {
  armed: [0.24, -0.02, -0.26], guide: [-0.14, -0.14, -0.46],
  rollPull: [-1.9, -1.4], rollArmed: -1.4, rollThrow: -0.6, guidePose: 'relaxed', rollL: 0.9,
  pole: [0.8, -0.5, 0.35], poleThrow: [0.7, 0.4, 0.2], shoulderUp: 0.12, shoulderThrow: 0.16,
  pullR: [[0, 0.28, -0.4, -0.3], [0.1, 0.13, -0.2, -0.36], [0.24, 0.16, -0.18, -0.35], [0.42, 0.24, -0.02, -0.26]],
  pullL: [[0, -0.24, -0.42, -0.3], [0.1, 0.03, -0.22, -0.37], [0.2, 0.08, -0.16, -0.35], [0.28, -0.06, -0.2, -0.42], [0.42, -0.14, -0.14, -0.46]],
  // cocked far behind the shoulder, whipped very short to the release point (0.12 s), then the arm crosses down to the left
  throwR: [[0, 0.24, -0.02, -0.26], [0.07, 0.31, 0.08, -0.1], [0.12, 0.07, 0.09, -0.5], [0.2, -0.1, -0.2, -0.53], [0.38, -0.08, -0.68, -0.36]],
  throwL: [[0, -0.14, -0.14, -0.46], [0.07, -0.1, -0.11, -0.52], [0.16, -0.28, -0.34, -0.38], [0.34, -0.32, -0.74, -0.2]],
  // torso rotation during the throw (yaw, roll): to the right when cocked, to the left at the release
  twist: [[0, 0, 0, 0], [0.07, 0.08, -0.05, 0], [0.15, -0.1, 0.07, 0], [0.38, 0, 0, 0]],
};
/* Each grenade in the right hand, by type: p, its center in the hand frame (m; x little finger, y back of the hand, z elbow); r, its
   rotation in that frame (degrees, x then y then z); the fingers: HAND_POSES.n<type> (06f-hands.js). Adjustable on the grenade tuning bench
   (?grenade=1, 09zj-grenade-tuning.js), which gives the configuration to copy */
const NADE_GRIP = { // (tuned by the owner on the bench)
  frag: { p: [-0.003, -0.03, -0.021], r: [-136, 180, -80] },
  flash: { p: [-0.003, -0.03, -0.021], r: [-136, 180, -80] },
  smoke: { p: [-0.01, -0.027, -0.019], r: [-136, 180, -85] },
  knife: { p: [-0.081, -0.03, -0.021], r: [-66, 174, 86] },
};
const _ngE = new THREE.Euler(), _ngQ = new THREE.Quaternion();
/* Combat dagger (trench knife): 18 cm blade with a "clip" point, flat ground down to the edge,
   saw teeth on the spine near the guard, straight guard, grooved rubber handle, pommel with its ring.
   Frame: blade toward -z, blade spine (teeth) toward +y, edge toward -y, guard at z = 0, handle toward +z.
   The blade is a lofted surface: at each slice, five points (flat spine, flat, edge); each face has its
   own vertices, so its edges stay sharp. */
const KNIFE_L = 0.185;
function knifeBladeGeometry() {
  const L = KNIFE_L, pitch = 0.0046, serr0 = 0.014, serr1 = 0.088, depth = 0.0019;
  const ss = [];
  for (let s = 0; s < L - 1e-6; s += (s >= serr0 && s < serr1 ? pitch / 6 : 0.004)) ss.push(s);
  ss.push(L);
  const top = (s) => {
    let y = 0.0155;
    if (s > 0.108) y -= (0.0155 + 0.0016) * Math.pow((s - 0.108) / (L - 0.108), 1.7); // spine that dips toward the tip
    if (s >= serr0 && s < serr1) { const u = ((s - serr0) / pitch) % 1; y -= depth * (u < 0.72 ? u / 0.72 : 1 - (u - 0.72) / 0.28); } // teeth
    return y;
  };
  const bot = (s) => -0.0185 + (s > 0.095 ? 0.0165 * Math.pow((s - 0.095) / (L - 0.095), 2.3) : 0); // belly then rise toward the tip
  const pos = [], idx = [], N = ss.length;
  for (let i = 0; i < N; i++) {
    const s = ss[i], last = i === N - 1;
    let yt = top(s), yb = bot(s); if (yt - yb < 0.0006) { const m = (yt + yb) / 2; yt = m + 0.0003; yb = m - 0.0003; }
    const t = last ? 0 : 0.0024 * (1 - 0.55 * smoothstep(0.1, L, s)) * (1 - 0.9 * smoothstep(L - 0.012, L, s)), ym = yt - 0.52 * (yt - yb);
    const R = [[-t, yt], [t, yt], [t * 0.92, ym], [0, yb], [-t * 0.92, ym]];
    for (let f = 0; f < 5; f++) { const A = R[f], B = R[(f + 1) % 5]; pos.push(A[0], A[1], -s, B[0], B[1], -s); }
  }
  for (let i = 0; i < N - 1; i++) for (let f = 0; f < 5; f++) {
    const a = i * 10 + f * 2, c = (i + 1) * 10 + f * 2;
    idx.push(a, a + 1, c + 1, a, c + 1, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function buildKnifeModel(M) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(knifeBladeGeometry(), M.knifeSteel));
  // painted fuller (dark groove along the flat, on both sides)
  for (const sx of [-1, 1]) bx(g, M.dark, sx * 0.0023, 0.004, -0.058, 0.0008, 0.0042, 0.075);
  // heel (ricasso) and straight guard with rounded quillons
  bx(g, M.knifeSteel, 0, -0.001, -0.004, 0.0055, 0.034, 0.012);
  bx(g, M.metal, 0, -0.001, 0.0045, 0.0125, 0.062, 0.0085);
  for (const sy of [-1, 1]) part(g, G_CYL, M.metal, 0, -0.001 + sy * 0.031, 0.0045, 0.0064, 0.0085, 0.0064, Math.PI / 2, 0, 0);
  // handle: alternating rings (finger grooves), oval (taller than wide), black rubber
  for (let i = 0; i < 11; i++) {
    const ridge = i % 2 === 0;
    part(g, G_CYL, ridge ? M.poly : M.dark, 0, -0.002, 0.0125 + i * 0.0104 + 0.005, ridge ? 0.0136 : 0.0123, 0.0104, ridge ? 0.0158 : 0.0145, Math.PI / 2, 0, 0);
  }
  // pommel: steel cap and ring for the lanyard
  part(g, G_CYL, M.metal, 0, -0.002, 0.1305, 0.0135, 0.012, 0.0155, Math.PI / 2, 0, 0);
  part(g, new THREE.TorusGeometry(0.0072, 0.0019, 8, 16), M.metal, 0, -0.002, 0.1425, 1, 1, 1, 0, Math.PI / 2, 0);
  bakeRig(g);
  return g;
}
/* Knife strike: a sweep from left to right, like a sword stroke. The knife stays held as in hand (KNIFE_HELD.grip, HAND_POSES.kgrip); the arm starts on the left, the
   wrist cocked, then sweeps to the right while turning the blade around the forearm like a clock hand (KNIFE_STAB below). Before, a strike flipped the
   knife into a reverse grip, as in Modern Warfare 2, then stabbed: the change from the held hand to the strike was visible. */
const KNIFE_DUR = 0.42, KNIFE_HIT = 0.34; // duration of the gesture (s); instant of contact (share of the duration)
/* Knife magnetism (as in the old Call of games): within near m, aim is pulled toward the target's torso, more
   weakly out to range m, by at most max radians in total (about 11 degrees); cone: cosine of the very-close selection angle */
const KNIFE_MAG = { near: 1.9, range: 2.8, cone: 0.7, rate: 6, max: 0.2 };
/* The original strike, that of a simple press of the knife button when the knife is not in hand: the hand comes up from below, cuts the air and goes back down, with
   the base grip (_km) and the fingers of HAND_POSES.grip. Wrist (camera space), then [t, forearm roll, wrist flexion, 0]: the hand extends the forearm */
const KNIFE_ANIM = {
  pos: [[0, 0.3, -0.45, -0.22], [0.09, 0.25, -0.14, -0.29], [0.2, 0.21, -0.08, -0.31], [0.27, 0.1, -0.07, -0.39], [0.34, -0.04, -0.08, -0.41], [0.41, -0.19, -0.11, -0.37], [0.53, -0.26, -0.18, -0.29], [0.76, -0.1, -0.42, -0.21], [1, 0.3, -0.45, -0.22]],
  rot: [[0, 0.3, 0, 0], [0.09, 0.4, 0, 0], [0.2, 0.45, 0.1, 0], [0.27, 0.35, 0, 0], [0.34, 0.25, 0, 0], [0.41, 0.15, 0, 0], [0.53, 0.15, 0, 0], [0.76, 0.25, 0, 0], [1, 0.3, 0, 0]],
  S: [0.24, -0.18, 0.2], pole: [0.8, -0.1, 0.15],
};
/* Base of the knife grip (knifeGripMatrix flips and turns it), found on the debug screen against the reference (hand frame: x toward the little finger,
   y toward the back of the hand, z toward the elbow). Here: the blade comes back toward the elbow (back: angle with the fist axis) while
   overhanging the forearm (lift), toothed spine against the forearm, edge up; then fine tuning: guard
   position (cm), rotation in the hand frame (rotH, degrees) and in the knife frame (rotK, degrees). */
const KNIFE_POSE = { back: 1.5, lift: 0.6, guard: [0.012, 0.014, -0.034], pos: [7.1, -3.7, 0], rotH: [-23, 57, -80], rotK: [3, 0, 2] };
const _km = (() => {
  const P = KNIFE_POSE, D = Math.PI / 180, cb = Math.cos(P.back), sb = Math.sin(P.back), cl = Math.cos(P.lift), sl = Math.sin(P.lift);
  const blade = new V3(cb * cl, sl, sb * cl).normalize(), up = new V3(0, 1, 0);
  const edge = up.clone().addScaledVector(blade, -up.dot(blade)).normalize();
  const B = new THREE.Matrix4().makeBasis(new V3().crossVectors(edge, blade), edge.clone().negate(), blade.clone().negate());
  const rot = (r) => new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(r[0] * D, r[1] * D, r[2] * D, 'XYZ'));
  return rot(P.rotH).multiply(B).multiply(rot(P.rotK)).setPosition(P.guard[0] + P.pos[0] / 100, P.guard[1] + P.pos[1] / 100, P.guard[2] + P.pos[2] / 100);
})();
const _kg = new THREE.Matrix4();
/* Nothing left in hand in the first-person view (player death, start of a replay): knife, throwing arm and grenade, terminal and
   streak computer. updateRigs only runs while the player is alive: a death in the middle of a throw or a knife strike left
   the arms frozen on screen, over the view of the falling body and during the killcam */
function vmClearHeld() {
  if (VM.knifeRig) VM.knifeRig.visible = false;
  if (VM.nadeRig) VM.nadeRig.visible = false;
  if (NADE_RIG.g) { NADE_RIG.g.visible = false; NADE_RIG.nade.userData.spoon.visible = true; }
  if (typeof ksAbort === 'function') ksAbort();
}
/* Knife in hand (knife button held, see knifeButton) and knife strike: a single grip, that of the fist closed on the handle, a handshake grip as in
   Counter-Strike (blade almost vertical). Everything is tuned live with the tuning bench (?knife=1, 09zk-knife-tuning.js), which gives the configuration to copy,
   or frame by frame with knifeBench.js; everything must stay in the field of view, from drawing to running and striking, on a 16:9 screen as well as 2.05:1 (knife-hand.js).
   KNIFE_HELD: the wrist (camera space, in meters), the forearm roll (-1.57: thumb up) and the wrist flexion (rad), the elbow (pole) and the shoulder (S);
   grip: flip, blade on the thumb side rather than the little finger side; pitch, phi and tilt, degrees by which the knife turns around x (across the fist), y (in the palm) and z
   (of the forearm) in the hand frame; roll, degrees around the handle; mid, middle of the handle in the hand.
   run: running. Offset of the wrist, roll and flexion at full sprint, then stride amplitude (amp: x, lateral back-and-forth; y, dip of each step; z, the
   arm pumping front to back; wristRoll and flexAmp: wrist roll and flexion), stride phase in radians. */
const KNIFE_HELD = {
  pos: [0.205, -0.18, -0.41], roll: -1.02, flex: -0.12, pole: [1.2, -0.85, 0], S: [0.24, -0.18, 0.2],
  grip: { flip: true, phi: -16, tilt: 3, pitch: 0, roll: -3, mid: [-0.01, -0.022, -0.015] },
  run: { pos: [0, 0.05, 0], roll: -0.1, flex: 0.15, amp: [0.02, 0.02, 0.04], wristRoll: 0.12, flexAmp: 0.15, phase: 0 },
};
/* The strike, from the held pose to two full poses: start (the cocked gesture, on the left) and end (the end of the sweep, on the right), each with all the settings of the held hand:
   wrist (meters, camera), forearm roll and wrist flexion (rad), elbow (pole), shoulder (S), knife grip (phi, tilt, pitch, roll in degrees, mid: middle of the handle
   in the hand; flip stays that of KNIFE_HELD.grip) and fingers (fingers: same fields as HAND_POSES.kgrip, the thumb in eight angles). Owner's tuning: the sweep comes from the
   wrist (from -0.285 to 0.6 in x), the elbow and the shoulder, the roll staying around -0.9; the grip turns at the end of the strike (phi from -13 to -49, tilt 9, pitch 27).
   Time t goes from 0 to 1 over KNIFE_DUR: from the held pose to start (up to tStart), from start to end (up to tEnd, with ease: 0 at constant speed, 1 soft at start and arrival,
   and arc, a detour of the wrist in the middle of the sweep, in meters), then from end to the held pose. Contact falls at KNIFE_HIT. With no knife in hand, the hand rises by low
   (out of view) during rise and goes back down there during fall. */
const KNIFE_STAB = {
  low: [0.3, -0.45, -0.22], rise: [0, 0.18], fall: [0.72, 1], tStart: 0.14, tEnd: 0.46, ease: 0.5, arc: [0, 0, -0.08],
  start: {
    pos: [-0.285, 0.015, -0.415], roll: -0.94, flex: -0.06, pole: [2, -0.8, 0.45], S: [0.27, -0.18, 0.2],
    grip: { phi: -13, tilt: 3, pitch: 0, roll: -3, mid: [-0.01, -0.022, -0.015] },
    fingers: { i: [1.37, 1.35, 0.67], m: [1.48, 1.5, 0.95], r: [1.3, 1.5, 0.95], p: [1.3, 1.5, 0.95], t: [0.42, 0.47, -0.16, 0.89, -1.37, 0.06, 0.28, -0.16], spread: 0 },
  },
  end: {
    pos: [0.6, -0.325, -0.425], roll: -0.88, flex: -0.1, pole: [0.55, 0.2, -1.45], S: [0.15, -0.19, 0.5],
    grip: { phi: -49, tilt: 9, pitch: 27, roll: -3, mid: [-0.01, -0.022, -0.015] },
    fingers: { i: [1.37, 1.35, 0.67], m: [1.48, 1.5, 0.95], r: [1.3, 1.5, 0.95], p: [1.3, 1.5, 0.95], t: [0.42, 0.47, -0.16, 0.89, -1.37, 0.06, 0.28, -0.16], spread: 0 },
  },
};
/* A flat pose, to blend two poses at once: wrist (3), roll, flexion, elbow (3), shoulder (3), grip phi tilt pitch roll (4) and middle of the handle (3), fingers i m r p
   (12), thumb (8), spread (1): 39 numbers. P: wrist, elbow, shoulder and grip; G: the fingers (HAND_POSES.kgrip for the held pose, start.fingers for the start of the strike). */
const KP_N = 39, _kpB = new Float64Array(KP_N), _kpS = new Float64Array(KP_N), _kpE = new Float64Array(KP_N), _kpF = new Float64Array(KP_N);
function knifePut(out, n, a) { for (let j = 0; j < a.length; j++) out[n++] = a[j]; return n; }
function knifeFlat(P, G, out) {
  const g = P.grip; let n = knifePut(out, 0, P.pos); out[n++] = P.roll; out[n++] = P.flex; n = knifePut(out, n, P.pole); n = knifePut(out, n, P.S);
  out[n++] = g.phi; out[n++] = g.tilt; out[n++] = g.pitch; out[n++] = g.roll; n = knifePut(out, n, g.mid);
  n = knifePut(out, n, G.i); n = knifePut(out, n, G.m); n = knifePut(out, n, G.r); n = knifePut(out, n, G.p); n = knifePut(out, n, G.t); out[n] = G.spread;
  return out;
}
function knifeMix(a, b, w, out) { for (let j = 0; j < KP_N; j++) out[j] = a[j] + (b[j] - a[j]) * w; return out; }
/* Knife-to-hand matrix of a grip: the base (_km, blade toward the elbow), flipped end for end (flip) and turned around the handle (roll), then turned in the hand
   frame: pitch around x, phi around y, tilt around z; the middle of the handle set at mid. Written into out if one is given (nothing allocated). */
const _gmX = new THREE.Matrix4(), _gmC = new V3();
function knifeGripMatrix(P, out = new THREE.Matrix4()) {
  const D = Math.PI / 180, R = out.extractRotation(_km);
  if (P.flip) R.multiply(_gmX.makeRotationY(Math.PI));
  if (P.roll) R.multiply(_gmX.makeRotationZ(P.roll * D));
  if (P.pitch) R.premultiply(_gmX.makeRotationX(P.pitch * D));
  R.premultiply(_gmX.makeRotationY((P.phi || 0) * D));
  if (P.tilt) R.premultiply(_gmX.makeRotationZ(P.tilt * D));
  const c = _gmC.set(0, -0.002, 0.07).applyMatrix4(R); // middle of the handle, in the turned knife frame
  return R.setPosition(P.mid[0] - c.x, P.mid[1] - c.y, P.mid[2] - c.z);
}
const _kgmH = new THREE.Matrix4(), _kgmS = new THREE.Matrix4(), _gpS = { flip: true, phi: 0, tilt: 0, pitch: 0, roll: 0, mid: [0, 0, 0] }, _knP = new V3();
function knifeGripSet() { knifeGripMatrix(KNIFE_HELD.grip, _kgmH); } // the held grip, once and for all (the tuning bench recomputes it)
knifeGripSet();
const _knH = { p: new V3(), roll: 0, flex: 0 };
/* The held pose: raised from below according to hold (0 out of view, 1 in hand), then running (S.sprint, stride of VM.bobT) */
function knifeHeld(S, hold) {
  const H = KNIFE_HELD, R = H.run, r0 = KNIFE_STAB.low, e = smoothstep(0, 1, hold), sp = clamp(S.sprint || 0, 0, 1.08), k = sp * Math.min(1, VM.bobAmt || 0), p = _knH.p;
  const ph = VM.bobT + R.phase, s1 = Math.sin(ph), c1 = Math.cos(ph), c2 = (Math.cos(2 * ph) - 1) * 0.5;
  p.set(lerp(r0[0], H.pos[0], e), lerp(r0[1], H.pos[1], e), lerp(r0[2], H.pos[2], e));
  p.x += R.pos[0] * sp + c1 * R.amp[0] * k; p.y += R.pos[1] * sp + Math.sin(VM.breath * 1.6) * 0.003 * (1 - sp) + c2 * R.amp[1] * k; p.z += R.pos[2] * sp + s1 * R.amp[2] * k;
  _knH.roll = H.roll - (1 - e) * 0.9 + R.roll * sp + s1 * R.wristRoll * k; _knH.flex = H.flex + R.flex * sp + c1 * R.flexAmp * k;
  return _knH;
}
/* The strike pose at time t (0 to 1), in F: from the held pose (B) to start, from start to end, from end to the held pose */
function knifeStabPose(t, B, F) {
  const Z = KNIFE_STAB, t0 = Math.max(0.001, Z.tStart), t1 = Math.max(t0 + 0.001, Z.tEnd);
  knifeFlat(Z.start, Z.start.fingers, _kpS); knifeFlat(Z.end, Z.end.fingers, _kpE);
  if (t < t0) return knifeMix(B, _kpS, smoothstep(0, 1, t / t0), F);
  if (t < t1) {
    const u = (t - t0) / (t1 - t0), w = lerp(u, smoothstep(0, 1, u), clamp(Z.ease, 0, 1)), bump = Math.sin(Math.PI * u);
    knifeMix(_kpS, _kpE, w, F); F[0] += Z.arc[0] * bump; F[1] += Z.arc[1] * bump; F[2] += Z.arc[2] * bump;
    return F;
  }
  return knifeMix(_kpE, B, smoothstep(0, 1, (t - t1) / Math.max(0.001, 1 - t1)), F);
}
/* Hook of the tuning bench (09zk-knife-tuning.js, opened with ?knife=1): it can force the state passed to updateRigs (rest, run, strike) */
let KNIFE_DEBUG = null;
let NADE_DEBUG = null; // hook of the grenade tuning bench (09zj-grenade-tuning.js, ?grenade=1): it can force the state passed to updateRigs (held, pin pulled, throw)
function updateRigs(dt, S) {
  const k = VM.knifeRig, hold = S.knifeHold || 0, stab = S.knifeT > 0;
  if (stab && !S.knifeNew) { // simple press, the knife was not in hand: the original strike
    const t = 1 - S.knifeT / KNIFE_DUR, A = KNIFE_ANIM, arm = VM.knifeArm; k.visible = true;
    k.position.copy(VM.bobO); k.rotation.set(VM.bobR.x, VM.bobR.y, VM.bobR.z);
    const p = keySpline(A.pos, t), r = keySpline(A.rot, t);
    placeArm(arm, _nv(...A.S), p, 0.34, 0.34, _nv(A.S[0] + A.pole[0], A.S[1] + A.pole[1], A.S[2] + A.pole[2]), 0.05, 0.043, r.x, r.y);
    arm.hand.userData.set('grip');
    arm.hand.updateMatrix(); _kg.copy(arm.hand.matrix).multiply(_km); _kg.decompose(VM.knife.position, VM.knife.quaternion, VM.knife.scale);
  } else if (stab || hold > 0.01) {
    const arm = VM.knifeArm, Z = KNIFE_STAB, F = _kpF, B = _kpB, low = Z.low;
    const H = knifeHeld(S, stab ? 1 : hold); // the held pose (running included): the one the strike starts from and returns to, or the rise of the knife being drawn
    knifeFlat(KNIFE_HELD, HAND_POSES.kgrip, B); B[0] = H.p.x; B[1] = H.p.y; B[2] = H.p.z; B[3] = H.roll; B[4] = H.flex;
    if (stab) {
      const t = 1 - S.knifeT / KNIFE_DUR, up = Math.max(hold, smoothstep(Z.rise[0], Z.rise[1], t) * (1 - smoothstep(Z.fall[0], Z.fall[1], t))), e = smoothstep(0, 1, up);
      knifeStabPose(t, B, F);
      for (let j = 0; j < 3; j++) F[j] = lerp(low[j], F[j], e); F[3] -= (1 - e) * 0.9; // bare-handed, the hand rises from below and goes back down there
    } else F.set(B);
    k.visible = true;
    k.position.copy(VM.bobO); k.rotation.set(VM.bobR.x, VM.bobR.y, VM.bobR.z);
    placeArm(arm, _nv(F[8], F[9], F[10]), _knP.set(F[0], F[1], F[2]), 0.34, 0.34, _nv(F[8] + F[5], F[9] + F[6], F[10] + F[7]), 0.05, 0.043, F[3], F[4]);
    // the fingers and the dagger follow the pose: during the strike, the fingers go through HAND_POSES.kstab and the grip is recomputed every frame
    let M = _kgmH, pose = 'kgrip';
    if (stab) {
      const D = HAND_POSES.kstab, g = _gpS;
      for (let j = 0; j < 3; j++) { D.i[j] = F[18 + j]; D.m[j] = F[21 + j]; D.r[j] = F[24 + j]; D.p[j] = F[27 + j]; }
      for (let j = 0; j < 8; j++) D.t[j] = F[30 + j];
      D.spread = F[38]; pose = 'kstab';
      g.flip = KNIFE_HELD.grip.flip; g.phi = F[11]; g.tilt = F[12]; g.pitch = F[13]; g.roll = F[14]; g.mid[0] = F[15]; g.mid[1] = F[16]; g.mid[2] = F[17];
      M = knifeGripMatrix(g, _kgmS);
    }
    arm.hand.userData.set(pose);
    arm.hand.updateMatrix(); _kg.copy(arm.hand.matrix).multiply(M); _kg.decompose(VM.knife.position, VM.knife.quaternion, VM.knife.scale);
  } else k.visible = false;
  if (!NADE_RIG.g) initNadeRig();
  const N = NADE_RIG, g = N.g, P = NADE_POSE;
  if (VM.nadeRig) VM.nadeRig.visible = false;
  if (!S.nadeState) { g.visible = false; N.nade.userData.spoon.visible = true; return; }
  const want = N.models[PL.nadeType] || N.models.frag; // the class's grenade
  if (N.nade !== want) { if (N.ring.parent !== N.nade) N.nade.add(N.ring); N.nade.visible = false; N.nade = want; N.ring = want.userData.ring; }
  g.visible = true;
  // the arms follow the step and the gaze like the weapon
  g.position.copy(VM.bobO); g.rotation.set(VM.bobR.x, VM.bobR.y, VM.bobR.z);
  const t = S.nadeT || 0;
  // the right shoulder rises when the arm cocks, the elbow rises during the throw
  const up = S.nadeState === 'pull' ? smoothstep(0.2, 0.42, t) : S.nadeState === 'cook' ? 1 : 1 - smoothstep(0.12, 0.3, t);
  const th = S.nadeState === 'throw' ? Math.sin(clamp(t / 0.24, 0, 1) * Math.PI) : 0;
  // at the whip, the shoulder rises further: the arm comes over the top instead of arriving from below
  const SR = _nv(0.22, -0.34 + P.shoulderUp * up + P.shoulderThrow * th, 0.22), SL = _nv(-0.24, -0.36, 0.2);
  const pole = _nv(lerp(P.pole[0], P.poleThrow[0], th), lerp(P.pole[1], P.poleThrow[1], th), lerp(P.pole[2], P.poleThrow[2], th));
  const ty = NADE_GRIP[PL.nadeType] ? PL.nadeType : 'frag', NG = NADE_GRIP[ty], hPose = 'n' + ty; // the grip and fingers of the type
  let hr, hl, lVis = true, nadeInHand = true, rRoll = P.rollArmed, lRoll = P.rollL, rPose = hPose, lPose = 'pinch', ringL = true;
  if (S.nadeState === 'pull') {
    hr = keySpline(P.pullR, t); hl = keySpline(P.pullL, t);
    // jerk of the right hand when the ring is torn off
    hr.x += Math.sin(clamp((t - 0.22) / 0.08, 0, 1) * Math.PI) * 0.012;
    rRoll = lerp(P.rollPull[0], P.rollPull[1], smoothstep(0.22, 0.42, t));
    ringL = t >= NADE_ANIM.pin; lPose = t < 0.12 || t > 0.34 ? 'open' : 'pinch';
    lRoll = lerp(1.9, P.rollL, smoothstep(0.28, 0.42, t));
  } else if (S.nadeState === 'cook') {
    // cocked arm: slight sway, tremor that grows as the fuse nears its end
    const c = S.cookT || 0, f = nadeFuse(PL.nadeType), tr = f > 0 ? smoothstep(f * 0.43, f, c) * 0.004 : 0; // (the throwing knife has no fuse)
    hr = _nv(P.armed[0] + Math.sin(c * 1.7) * 0.003 + (Math.random() - 0.5) * tr, P.armed[1] + Math.sin(c * 2.3) * 0.004 + (Math.random() - 0.5) * tr, P.armed[2]);
    hl = _nv(P.guide[0], P.guide[1] + Math.sin(c * 1.9 + 1) * 0.003, P.guide[2]);
    rRoll = P.rollArmed; lPose = P.guidePose;
  } else {
    hr = keySpline(P.throwR, t); hl = keySpline(P.throwL, t);
    rRoll = lerp(P.rollArmed, P.rollThrow, smoothstep(0.07, 0.2, t));
    const tw = keySpline(P.twist, t); g.rotation.y += tw.x; g.rotation.z += tw.y;
    nadeInHand = t < NADE_ANIM.release; rPose = nadeInHand ? hPose : t < NADE_ANIM.release + 0.1 ? 'open' : 'relaxed';
    lVis = t < 0.33; lPose = 'relaxed';
  }
  rigArm(N.R, SR, hr, pole, rPose, rRoll);
  rigArm(N.L, SL, hl, _nv(-0.7, -0.7, 0), lPose, lRoll);
  setArmVisible(N.L, lVis);
  // the ring and its pin stay on the left hand's finger once torn off
  if (ringL) { if (N.ring.parent !== N.L.hand) N.L.hand.add(N.ring); N.ring.position.set(0.004, -0.018, -0.075); N.ring.visible = lVis; }
  else { if (N.ring.parent !== N.nade) N.nade.add(N.ring); N.ring.position.set(-0.018, 0.045, 0); N.ring.visible = true; }
  if (S.nadeState === 'pull' && t < 0.05) N.nade.userData.spoon.visible = true;
  N.nade.visible = nadeInHand;
  if (nadeInHand) {
    const D = Math.PI / 180;
    N.nade.position.copy(N.R.hand.position).add(_nv(NG.p[0], NG.p[1], NG.p[2]).applyQuaternion(N.R.hand.quaternion));
    N.nade.quaternion.copy(N.R.hand.quaternion).multiply(_ngQ.setFromEuler(_ngE.set(NG.r[0] * D, NG.r[1] * D, NG.r[2] * D)));
  }
}

/* ---------- Streak terminal (UAV, helicopter): hardened case held in the right hand, call button pressed with the thumb ----------
   Case frame: x toward the right, y up, z toward the front of the screen. The back rests in the palm, the fingers
   go behind and close on the left side, the thumb goes over the right side and onto the call button,
   under the screen. */
const PHONE = { w: 0.074, h: 0.142, d: 0.022, btn: [0, -0.044], scr: [0.058, 0.07, 0.024] };
/* Materials of the streak devices (terminal, tablet): olive shell, dark smooth front, without the weapons' grain (on a 26 cm shell,
   the weapons' relief map, stretched over each face, looked like stone) */
function ksDevMats() {
  if (KS.mats) return KS.mats;
  const M = gunMaterials();
  return (KS.mats = { shell: new THREE.MeshStandardMaterial({ color: 0x565c40, roughness: 0.66, metalness: 0.04 }), face: new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.38, metalness: 0.15 }), rubber: M.rubber, metal: M.metal });
}
function buildPhoneRig() {
  const M = gunMaterials(), K = ksDevMats(), g = new THREE.Group(), D = PHONE;
  g.visible = false; VM.root.add(g);
  const dev = new THREE.Group(); g.add(dev);
  // olive shell, rubber strips on the sides, reinforced corners
  rb(dev, K.shell, 0, 0, 0, D.w, D.h, D.d, 0.009);
  for (const sx of [-1, 1]) {
    rb(dev, K.rubber, sx * (D.w / 2 - 0.002), -0.006, 0, 0.007, D.h - 0.036, D.d + 0.002, 0.003);
    for (const sy of [-1, 1]) rb(dev, K.rubber, sx * (D.w / 2 - 0.006), sy * (D.h / 2 - 0.007), 0, 0.016, 0.018, D.d + 0.004, 0.005);
  }
  // front: dark screen frame, speaker grille, call button in its guard, two keys
  rb(dev, K.face, 0, 0.014, D.d / 2 + 0.0004, 0.064, 0.096, 0.002, 0.004);
  for (let i = 0; i < 4; i++) rb(dev, K.rubber, -0.012 + i * 0.008, 0.063, D.d / 2 + 0.0006, 0.005, 0.0014, 0.001, 0.0005);
  const ring = new THREE.Mesh(G_TOR, K.metal); ring.scale.set(0.0118, 0.0118, 0.016); ring.position.set(D.btn[0], D.btn[1], D.d / 2 + 0.0008); dev.add(ring);
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.004, 20), new THREE.MeshStandardMaterial({ color: 0x8fd16a, emissive: new THREE.Color().setRGB(0.2, 0.5, 0.15), roughness: 0.4 }));
  btn.rotation.x = Math.PI / 2; btn.position.set(D.btn[0], D.btn[1], D.d / 2 + 0.0015); dev.add(btn);
  for (const sx of [-1, 1]) rb(dev, K.face, sx * 0.024, D.btn[1], D.d / 2 + 0.0006, 0.012, 0.007, 0.002, 0.002);
  // short rubber antenna on the upper left corner, notched base; lanyard ring at the bottom
  cy(dev, K.metal, -0.022, D.h / 2 + 0.003, -0.002, 0.0062, 0.008, 0);
  cy(dev, K.rubber, -0.022, D.h / 2 + 0.022, -0.002, 0.0045, 0.032, 0);
  part(dev, new THREE.SphereGeometry(1, 10, 8), K.rubber, -0.022, D.h / 2 + 0.038, -0.002, 0.0045, 0.0045, 0.0045);
  const loop = new THREE.Mesh(G_TOR, K.face); loop.scale.set(0.006, 0.006, 0.02); loop.position.set(0.022, -D.h / 2 - 0.002, -0.004); loop.rotation.y = Math.PI / 2; dev.add(loop);
  const sc = document.createElement('canvas'); sc.width = 144; sc.height = 174;
  const tex = new THREE.CanvasTexture(sc); tex.encoding = THREE.sRGBEncoding;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(D.scr[0], D.scr[1]), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color().setRGB(1.5, 1.5, 1.5) }));
  scr.position.set(0, D.scr[2], D.d / 2 + 0.0016); dev.add(scr);
  // right hand: palm behind the right half of the case, fingers toward the left and back (they close on the left side),
  // back of the hand outward; the thumb, on the radial side, goes over the right side to the button
  const grip = devGrip(dev, PHONE_GRIP.p, PHONE_GRIP.f, PHONE_GRIP.b);
  const arm = makeArm(M, VM.root, -1); setArmVisible(arm, false);
  bakeRig(g, { keep: [btn] });
  KS.phone = { g, tex, sc, grip, arm, btn, press: (pk) => { btn.position.z = D.d / 2 + 0.0015 - pk * 0.0018; } };
}
const PHONE_GRIP = { p: [0.042, -0.046, -0.024], f: [-0.6, 0.6, -0.5], b: [0.55, 0.2, -0.85] };
/* Terminal screen: title (streak called), radar sweep, status; texts are fitted to the screen width */
function drawPhoneScreen(pressed) {
  const P = KS.phone, g = P.sc.getContext('2d'), W = P.sc.width, H = P.sc.height, t = MATCH.time;
  g.fillStyle = '#081109'; g.fillRect(0, 0, W, H);
  const fit = (txt, y, size, col) => { g.font = `700 ${size}px "Barlow Condensed", sans-serif`; const k = Math.min(1, (W - 16) / Math.max(1, g.measureText(txt).width)); g.save(); g.translate(W / 2, y); g.scale(k, 1); g.fillStyle = col; g.fillText(txt, 0, 0); g.restore(); };
  g.textAlign = 'center';
  g.fillStyle = 'rgba(143,209,106,0.16)'; g.fillRect(0, 0, W, 30);
  fit(KSDEF[KS.mode] ? KSDEF[KS.mode].name : _t('UAV'), 22, 20, '#d4f7d8');
  const cx = W / 2, cy = 96, R = 50;
  g.strokeStyle = 'rgba(140,230,150,0.35)'; g.lineWidth = 1.5;
  for (const r of [R / 3, R * 2 / 3, R]) { g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke(); }
  g.beginPath(); g.moveTo(cx - R, cy); g.lineTo(cx + R, cy); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.stroke();
  const a = t * 3;
  if (g.createConicGradient) { const grd = g.createConicGradient(a - 0.9, cx, cy); grd.addColorStop(0, 'rgba(140,230,150,0)'); grd.addColorStop(0.14, 'rgba(140,230,150,0.38)'); grd.addColorStop(0.145, 'rgba(140,230,150,0)'); g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill(); }
  g.strokeStyle = '#9fe6a8'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.stroke();
  if (pressed) { g.fillStyle = '#ff5a48'; for (const [x, y] of [[0.4, -0.5], [-0.55, 0.2], [0.15, 0.6]]) { g.beginPath(); g.arc(cx + x * R, cy + y * R, 3.5, 0, TAU); g.fill(); } }
  const on = pressed && Math.floor(t * 5) % 2 === 0;
  g.fillStyle = pressed ? (on ? 'rgba(143,209,106,0.5)' : 'rgba(143,209,106,0.28)') : 'rgba(143,209,106,0.16)'; g.fillRect(8, H - 32, W - 16, 24);
  const done = { heli: _t('Helicopter inbound'), sat: _t('Satellite online'), emp: _t('EMP triggered'), fpv: _t('Drone in flight') }[KS.mode] || _t('UAV online');
  fit(pressed ? done : _t('Press to call'), H - 14, 17, '#d4f7d8');
  g.textAlign = 'left'; P.tex.needsUpdate = true;
}

/* ---------- Hands resting on the weapon ----------
   Each hand's frame is defined in weapon space: the grip is in the hollow
   of the closed fingers (and no longer at the wrist), then the forearm reaches the wrist by IK. */
const _hm = new THREE.Matrix4(), _hx = new V3(), _hy = new V3(), _hz = new V3();
/* frame from the wrist axis (z, from the palm toward the forearm) and a hint for the back of the hand (y) */
function frameZY(z, y) { _hz.set(...z).normalize(); _hy.set(...y); _hx.crossVectors(_hy, _hz).normalize(); _hy.crossVectors(_hz, _hx).normalize(); _hm.makeBasis(_hx, _hy, _hz); return new THREE.Quaternion().setFromRotationMatrix(_hm); }
/* Support hand under a forend (left hand): the palm rests on the lower left of the forend (roll roll around the
   barrel, rad); the fingers go to the right and forward, at yaw (rad) from the barrel, and rise up the right side; the thumb (x side
   of the hand) runs toward the muzzle along the left side. With zero pitch, the palm is tangent to the forend, but the wrist
   bends: the forearm, which comes from below, is not in the plane of the palm. pitch (rad) tilts the palm forward (base of the
   fingers against the forend, heel lower, like a real hand) and puts the wrist back in line with the forearm; the
   height measured on the mesh (palmLift) keeps the palm clear of the weapon. */
function frameUnder(roll, yaw, pitch = 0) {
  const sr = Math.sin(roll), cr = Math.cos(roll), sy = Math.sin(yaw), cy = Math.cos(yaw);
  _hy.set(-sr, -cr, 0); _hz.set(-sy * cr, sy * sr, cy); _hx.crossVectors(_hy, _hz); _hm.makeBasis(_hx, _hy, _hz);
  return new THREE.Quaternion().setFromRotationMatrix(_hm).multiply(new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), -pitch));
}
function frameQ(x, y) { _hx.set(...x).normalize(); _hy.set(...y).normalize(); _hz.crossVectors(_hx, _hy).normalize(); _hy.crossVectors(_hz, _hx).normalize(); _hm.makeBasis(_hx, _hy, _hz); return new THREE.Quaternion().setFromRotationMatrix(_hm); }
const HAND_FRAMES = {
  // x: knuckle alignment (along the grip), y: back of the hand; off: position of the held object in the hand frame
  R: { q: frameQ([0, -0.946, 0.324], [1, 0, 0]), off: new V3(0.008, -0.03, -0.015), pose: 'trigger', side: -1, axis: new V3(1, 0, 0), range: 0.6 },
  Rp: { q: frameQ([0, -0.976, 0.218], [1, 0, 0]), off: new V3(0.012, -0.028, -0.018), pose: 'ptrig', side: -1, axis: new V3(1, 0, 0), range: 0.5, axis2: new V3(0, 1, 0), range2: 0.5 },
  // left hand under the forend: see frameUnder; off.y is replaced by the distance measured on each weapon (lHandFrame)
  L: { q: frameUnder(0.55, 1.0, 0.5), off: new V3(0, -0.048, -0.012), pose: 'support', side: 1, range: 0.5 },
  Lp: { q: frameQ([0, 0.976, -0.218], [-1, 0, 0]), off: new V3(-0.004, -0.028, -0.028), pose: 'psup', side: 1, axis: new V3(1, 0, 0), range: 0.5, axis2: new V3(0, 1, 0), range2: 0.5 },
  // pistol slide gripped from the left side: hand flat against the slide, fingers forward, thumb up;
  // nothing above the slide, the sighting parts stay clear
  Lr: { q: frameQ([0, 1, 0], [-1, 0, 0]), off: new V3(0, -0.015, -0.02), pose: 'slap', side: 1, axis: new V3(1, 0, 0), range: 0.4 },
  // bolt handle gripped from above, fingers closed on the knob
  // the forearm arrives from behind and from the right (not perpendicular to the weapon, which no wrist accepts);
  // the hand can turn around the handle knob
  Rb: { q: frameQ([0.66, -0.15, -0.75], [0, 1, -0.2]), off: new V3(0, -0.02, -0.03), pose: 'pinch', side: -1, axis: new V3(0, 1, 0), range: 0.55 },
};
// "C" grip of modern rifles: palm on the left side of the forend, thumb extended over the top toward the front,
// fingers passing underneath; the wrist arrives from behind and from the left (hand clearly visible on screen)
HAND_FRAMES.Lcc = { q: frameZY([-0.15, -0.12, 1], [-0.92, 0.28, 0.1]), off: new V3(0.012, -0.046, -0.042), pose: 'cclamp', side: 1, range: 0.35 };
// the forend is a cylinder: the left hand can roll around the barrel without letting go
for (const k of ['L', 'Lcc']) HAND_FRAMES[k].axis = new V3(0, 0, -1).applyQuaternion(HAND_FRAMES[k].q.clone().invert());
// vertical support grip, grasped like the right hand holds its own (mirrored): knuckles along the grip, index at the
// top under the grip's base, palm on its left side, fingers passing in front and closing on the right side, thumb
// wrapping around the back. Like a real grasping hand, the grip passes across the palm (0.35 rad around its
// normal) and the hand is turned 0.55 rad around it: the forearm, which arrives from below, from behind and from the left,
// then extends the wrist instead of bending it; it holds the grip 2 cm below the forend, where the tilted index fits.
// The hand can turn around the grip, and slightly across (axis2). frameFgrip: same grip on a grip tilted toward
// the rear by rake (rad, the bottom toward the shooter), across the palm by diag (rad)
function frameFgrip(rake, diag) {
  return new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), -rake).multiply(frameQ([0, 1, -0.05], [-1, 0, 0]))
    .multiply(new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), -0.55)).multiply(new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), diag));
}
HAND_FRAMES.Lv = { q: frameFgrip(0, -0.35), off: new V3(0.02, -0.03, -0.015), pose: 'fgrip', side: 1, axis: new V3(1, 0, 0), range: 0.6, axis2: new V3(0, 1, 0), range2: 0.5 };
// angled grip (06p-attachments.js): tilted back by AGRIP_RAKE, grasped like the vertical one but much more
// across the palm (its bottom comes toward the forearm, which arrives from below: otherwise the wrist bends, especially when aiming), the
// hand 2.8 cm lower on the handguard (the top of the fist would touch the forend). Soldiers, whose frozen fist is made for a
// straight grip in the hand (SOLDIER_LGRIP), take it like the vertical one (soldier)
const AGRIP_RAKE = 0.5;
HAND_FRAMES.La = { q: frameFgrip(AGRIP_RAKE, -0.85), off: new V3(0.028, -0.03, -0.015), pose: 'fgrip', side: 1, axis: new V3(1, 0, 0), range: 0.6, axis2: new V3(0, 1, 0), range2: 0.5 };
HAND_FRAMES.La.soldier = Object.assign({}, HAND_FRAMES.La, { q: frameFgrip(AGRIP_RAKE, -0.35) });
/* Grip shapes of the hands (gripDef) and trigger (trigDef) of each weapon: in the model (06j-models.js, gripShapes) */
/* Frame of a weapon's support hand (first person and soldiers): under the forend (L) on all long weapons (the hand
   supports the weapon, elbow bent), around the support grip when the weapon carries one (info.lFrame, set by the accessory), on the
   right hand for the pistol; the "C" grip (Lcc) remains available. The palm rests on the forend (or against the grip), at the
   distance measured on the weapon mesh for each hand roll (palmLift). One frame per mounted weapon and per grip
   point G (the first-person one, or the soldiers' when the model gives another: tag tells them apart), and per squash
   of the finger base (soft: that of the soldiers' frozen hand is larger, see palmGrid). */
const L_FRAMES = {};
function lHandFrame(m, G = m.gripL, tag = '', soft = PG.soft) {
  if (m.kind === 'pistol') return HAND_FRAMES.Lp;
  const k = m.key + tag + (soft === PG.soft ? '' : '~t');
  if (L_FRAMES[k]) return L_FRAMES[k];
  const F0 = HAND_FRAMES[m.lFrame || 'L'], F = soft !== PG.soft && F0.soldier ? F0.soldier : F0;
  // soldiers' frozen hand: it rolls less (SOLDIER_ROLL), 7 rolls are enough
  const v = palmLift(m.group, G, F.q, -F.off.z, F.axis, F.range, soft === PG.soft ? 13 : 7, soft), lift = { v, range: F.range, lo: Math.min(...v) };
  return (L_FRAMES[k] = Object.assign({}, F, { off: new V3(F.off.x, -liftAt(lift, 0), F.off.z), lift }));
}

/* Shoulders fixed to the body (camera space) and no longer to the weapon: when aiming, and especially with the
   pistol, the arms start from the bottom of the screen instead of passing in front of the lens. They are
   converted into the weapon frame every frame. Poles: direction the elbow points from the
   shoulder. Values come from an offline calculation of the wrist angles: the shoulder is high and set back
   (like a real shooter's, the camera being at eye level). On long weapons the elbow is at the level of
   the hand; on the pistol it is lower, which makes the forearms come out of the bottom of the screen as in CoD4. */
const VM_BODY = {
  // long guns
  R: new V3(0.2, -0.14, 0.3), L: new V3(-0.3, -0.14, -0.02),
  poleR: new V3(0.14, -0.12, -0.27), poleL: new V3(-0.04, -0.3, -0.14),
  poleRs: new V3(0.1, -0.4, 0), poleLs: new V3(-0.1, -0.4, 0), // sprint: elbows down, under the shoulder
  RA: new V3(0.2, -0.14, 0.3), LA: new V3(-0.3, -0.14, -0.02),
  poleRA: new V3(0.06, -0.12, -0.3), poleLA: new V3(0.0, -0.3, -0.12),
  // pistol: shoulders low and set back, so the forearms come out of the bottom of the screen instead of crossing it
  // horizontally; when aiming, the elbows spread (isosceles stance, arms almost straight) instead of dropping: the forearm
  // then extends the grip and the wrist stays almost straight (deviation reduced from 29° to 14°)
  Rp: new V3(0.1, -0.2, 0.3), Lp: new V3(-0.15, -0.25, 0.3), RAp: new V3(0.1, -0.19, 0.32), LAp: new V3(-0.15, -0.22, 0.32),
  poleRp: new V3(0.5, -0.8, 0), poleLp: new V3(-0.5, -0.8, 0), poleRAp: new V3(0.7, -0.6, 0), poleLAp: new V3(-0.7, -0.6, 0),
  // left hand far from the forend (belt, magazine): the elbow drops, the forearm rises toward the hand
  poleLD: new V3(-0.1, -1, 0.15),
  // devices: tablet held with both hands by the bottom of the sides, shoulders low and elbows spread downward (the forearms rise from the
  // bottom of the screen); terminal held in one hand, elbow under the body
  dev: {
    R: { S: new V3(0.24, -0.36, 0.1), pole: new V3(0.7, -0.5, 0.1) },
    L: { S: new V3(-0.24, -0.36, 0.1), pole: new V3(-0.7, -0.5, 0.1) },
    P: { S: new V3(0.25, -0.45, 0.05), pole: new V3(0.5, -0.6, 0.1) },
  },
};
const _sR = new V3(), _sL = new V3(), _pR = new V3(), _pL = new V3(), _pLd = new V3();
const _hInv = new THREE.Matrix4();
function placeHands(m, gR, gL) {
  const pistol = m.kind === 'pistol', M = gunMaterials(), LF = lHandFrame(m);
  VM.holder.updateMatrix(); _hInv.copy(VM.holder.matrix).invert();
  const toGun = (v) => v.clone().applyMatrix4(_hInv);
  const ka = smoothstep(0, 1, VM.ads), sp = VM.sprK; // (effective sprint pose: cleared during a reload, updateViewmodel)
  _sR.lerpVectors(pistol ? VM_BODY.Rp : VM_BODY.R, pistol ? VM_BODY.RAp : VM_BODY.RA, ka); _sL.lerpVectors(pistol ? VM_BODY.Lp : VM_BODY.L, pistol ? VM_BODY.LAp : VM_BODY.LA, ka);
  _pR.lerpVectors(pistol ? VM_BODY.poleRp : VM_BODY.poleR, pistol ? VM_BODY.poleRAp : VM_BODY.poleRA, ka); _pL.lerpVectors(pistol ? VM_BODY.poleLp : VM_BODY.poleL, pistol ? VM_BODY.poleLAp : VM_BODY.poleLA, ka);
  // sprint: the lowered weapon puts the left hand in the shoulder-pole axis, where the elbow frame becomes unstable (it flips
  // from one frame to the next and the elbow shoots into the screen); the pole therefore goes under the shoulder, outward
  if (sp > 0) { _pR.lerp(VM_BODY.poleRs, sp); _pL.lerp(VM_BODY.poleLs, sp); }
  // pistol sprinting: right shoulder forward (torso leaning) and elbow down and outward, as in pistolRunPose
  if (pistol && sp > 0 && !VM.action) { const k = smoothstep(0, 1, sp); _sR.lerp(_vRun.set(...VM_PRUN.S), k); _pR.lerp(_vRun.set(...VM_PRUN.pole), k); }
  // choreography in progress (reload, bolt): each hand can follow its own path, between the weapon and the belt
  // choreography cut: the hand returns to its grip within a few frames (vmHandExit, 06d-reload.js)
  const lho = vmHandExit(VM_HX.L, VM.rlT ? vmLeftHand(m, (v) => v.applyMatrix4(_hInv)) : null, gL, 'support');
  const rho = vmHandExit(VM_HX.R, VM.rlT ? vmRightHand(m) : null, gR, 'trigger');
  const pairs = [[VM.arms.R, rho ? rho.G : gR, _sR, _pR, HAND_FRAMES[pistol ? 'Rp' : 'R'], 0.33], [VM.arms.L, lho ? lho.G : gL, _sL, _pL, LF, 0.34]];
  const GS = gripShapes(m);
  // pistol sprint: the left hand lets go of the weapon and swings along the body with the strides (you don't run with
  // the weapon clenched in both hands, the wrists would bend); it returns to wrap the grip as soon as you slow down
  const pRun = pistol && !lho ? smoothstep(0.15, 0.85, sp) : 0;
  for (const [arm, G0, Sb, Pb0, F0, fore] of pairs) {
    let F = F0, Pb = Pb0, G = G0, shapes = GS ? (arm === VM.arms.R ? GS.R : GS.L) : null;
    if (pRun > 0 && arm === VM.arms.L) {
      const c = Math.cos(VM.bobT), s2 = Math.sin(2 * VM.bobT), kb = Math.min(1, VM.bobAmt);
      G = _gRun.copy(G0).lerp(toGun(_vRun.set(-0.2 + c * 0.015 * kb, -0.47 + s2 * 0.025 * kb, -0.06 + c * 0.1 * kb)), pRun);
      _qRun.copy(VM.holder.quaternion).invert().multiply(VM_RUNQ);
      F = { q: _fq3.copy(F0.q).slerp(_qRun, pRun), off: _fo3.copy(F0.off).multiplyScalar(1 - pRun), pose: pRun > 0.4 ? 'relaxed' : F0.pose, side: F0.side, axis: pRun < 0.5 ? F0.axis : null, range: F0.range, axis2: pRun < 0.5 ? F0.axis2 : null, range2: F0.range2 };
      Pb = _pLd.lerpVectors(_pL, VM_BODY.poleLD, pRun);
      if (pRun > 0.15) shapes = null;
    }
    if (lho && arm === VM.arms.L) {
      // fb 0 to 1: from the forend toward the magazine grip (or, frame 1, toward the pistol slide gripped by the side)
      const Fb = lho.frame === 1 ? HAND_FRAMES.Lr : HAND_FRAMES.Lp, kf = lho.fb;
      F = { q: _fq.copy(F0.q).slerp(Fb.q, kf), off: _fo.lerpVectors(F0.off, Fb.off, kf), pose: lho.pose === 'support' || (pistol && lho.pose === 'grip') ? F0.pose : lho.pose, side: F0.side, axis: kf < 0.5 ? F0.axis : Fb.axis, range: kf < 0.5 ? F0.range : Fb.range, axis2: kf < 0.5 ? F0.axis2 : Fb.axis2, range2: kf < 0.5 ? F0.range2 : Fb.range2 };
      if (kf > 0.25 || F.pose !== F0.pose) shapes = null; // the hand leaves the grip: no more grip
      // off the forend, the elbow drops: the forearm rises toward the hand instead of crossing the screen horizontally
      Pb = _pLd.lerpVectors(_pL, VM_BODY.poleLD, smoothstep(0.03, 0.16, G.distanceTo(gL)));
    } else if (rho && arm === VM.arms.R) { const Fb = HAND_FRAMES.Rb; if (rho.fb > 0.25) shapes = null; F = { q: _fq2.copy(F0.q).slerp(Fb.q, rho.fb), off: _fo2.lerpVectors(F0.off, Fb.off, rho.fb), pose: rho.pose === 'trigger' ? F0.pose : rho.pose, side: F0.side, axis: rho.fb < 0.5 ? F0.axis : Fb.axis, range: rho.fb < 0.5 ? F0.range : Fb.range, axis2: rho.fb < 0.5 ? F0.axis2 : Fb.axis2, range2: rho.fb < 0.5 ? F0.range2 : Fb.range2 }; }
    const H = G.clone().sub(F.off.clone().applyQuaternion(F.q));
    // pistol: the left hand also closes over the fingers of the right hand
    if (pistol && shapes && arm === VM.arms.L) { VM.arms.R.hand.updateMatrix(); shapes = handCapsules(VM.arms.R.hand.userData, VM.arms.R.hand.matrix, _gCaps).concat(shapes); }
    poseArmToHand(arm, toGun(Sb), H, F.q, toGun(Sb.clone().add(Pb)), F.pose, 0, 0.34, fore, F.off, F.axis, F.range, F.axis2, F.range2, shapes, F === F0 ? F.lift : null);
  }
  vmAttachMags(m, lho ? lho.carry : 0);
}
const _fq = new THREE.Quaternion(), _fo = new V3(), _fq2 = new THREE.Quaternion(), _fo2 = new V3(), _gCaps = [];
const _fq3 = new THREE.Quaternion(), _fo3 = new V3(), _gRun = new V3(), _vRun = new V3(), _qRun = new THREE.Quaternion();
/* Pistol sprint, driven by the arm: the right arm goes down along the side, elbow back and out, the forearm
   rises forward; the whole arm pumps with the strides. The hand extends the forearm (straight wrist) and the
   pistol is placed in the hand: the weapon follows the arm, rather than the wrist catching up with a weapon placed separately.
   k: weight (0 to 1) of the sprint; the weapon mount pose is blended toward this one. */
const _ra = { s: new V3(), e: new V3(), w: new V3(), p: new V3(), df: new V3(), x: new V3(), y: new V3(), z: new V3(), g: new V3(), m: new THREE.Matrix4(), qh: new THREE.Quaternion(), qg: new THREE.Quaternion(), q: new THREE.Quaternion() };
/* camera space: shoulder (advanced by the torso tilt when sprinting), target wrist, elbow direction, back of the hand,
   wrist sway at each stride (up-down, front-back) */
const VM_PRUN = { S: [0.15, -0.22, 0.05], W: [0.11, -0.195, -0.3], pole: [0.7, -0.6, 0.3], back: [0.3, 1, 0.0], swing: [0.008, 0.016, 0.03] };
function pistolRunPose(m, k) {
  const A = _ra, F = HAND_FRAMES.Rp, P = VM_PRUN;
  const c = Math.cos(VM.bobT), s2 = Math.sin(2 * VM.bobT), kb = Math.min(1, VM.bobAmt);
  A.s.set(...P.S); A.w.set(P.W[0] + c * P.swing[0] * kb, P.W[1] + s2 * P.swing[1] * kb, P.W[2] + c * P.swing[2] * kb);
  elbowAt(A.s, A.w, ARM_LU, ARM_LF, A.p.set(...P.pole).add(A.s), 0, A.s, A.e);
  A.df.subVectors(A.w, A.e).normalize();
  // hand in the forearm axis: -z toward the fingers, back of the hand up (pistol laid toward the left,
  // low and forward, ready to come back to aiming)
  A.z.copy(A.df).negate(); A.y.set(...P.back); A.y.addScaledVector(A.z, -A.y.dot(A.z)).normalize(); A.x.crossVectors(A.y, A.z);
  A.m.makeBasis(A.x, A.y, A.z); A.qh.setFromRotationMatrix(A.m);
  // weapon: hand frame in the weapon (Rp) inverted; the grip in the hollow of the hand
  A.qg.copy(A.qh).multiply(A.q.copy(F.q).invert());
  A.g.set(0, 0, -WRIST_OFF).applyQuaternion(A.qh).add(A.w).add(A.x.copy(F.off).applyQuaternion(A.qh));
  A.g.sub(A.y.copy(m.gripR).applyQuaternion(A.qg));
  VM.holder.position.lerp(A.g, k); VM.holder.quaternion.slerp(A.qg, k);
}
/* running left hand (camera space): fingers forward and down, back of the hand outward */
const VM_RUNQ = frameZY([-0.25, 0.75, 0.6], [-1, 0.1, 0.2]);

/* Level of detail of a soldier and their weapon: detailed model up close, lightweight from afar. The lightweight model
   always casts the shadow; when the detailed one is shown, the lightweight one moves to the shadow-only layer (LAYER_SHADOW): it
   is no longer drawn on screen, not even with an invisible material. */
function setSoldierLod(S, hi) {
  const L = S.lod; L.hiOn = hi;
  L.hi.visible = hi; L.hi.layers.mask = MASK_SCREEN;
  L.lo.layers.mask = hi ? MASK_SHADOW : MASK_SCREEN;
  if (S.gun) setGunLod(S.gun, hi);
}
/* Chosen by apparent size (height of a 1.8 m body on screen, current focal length): a soldier seen through the
   scope switches to the detailed model much farther away. Threshold per quality profile (lodPx), with hysteresis. */
function updateSoldierLods() {
  const k = 1.8 * VIEW.h / (2 * Math.tan(camera.fov * Math.PI / 360)), th = RQ.q.lodPx;
  const one = (S) => {
    const L = S && S.lod; if (!L || !L.hi || !S.root.visible) return;
    const px = k / (camera.position.distanceTo(S.P.pelvis.position) + 0.01);
    const hi = L.hiOn ? px > th * 0.85 : px > th;
    if (hi !== L.hiOn) setSoldierLod(S, hi);
  };
  for (const e of entities) one(e.model);
  if (KC.body) one(KC.body);
}
