/* Reading of the animation pack clips (/anim-source/, Mixamo GLBs) and poseSoldier quantities (src/06b-soldier.js) in the game's
   frame. Shared by the baking (bake.mjs) and the comparison page (tools/dev/visual/anim.js).
   Pack frame: Y up, the character looks toward +z, its left is +x. Game (body) frame: gaze toward -z, right toward +x,
   feet at y = 0. Going from one to the other is a half-turn around Y, (x, y, z) -> (-x, y, -z): a rotation, not a mirror.
   Quantities per frame (game body frame, meters and radians):
   - pelvis: position (J_PEL, Hips bone) and orientation (hip frame: x from the left hip to the right, y toward the spine);
   - torso: orientation carrying the pelvis-neck segment (y toward the Neck bone, J_CHE) and the shoulder line (x toward the right shoulder);
   - head: rotation of the Head bone relative to its rest pose (T-pose);
   - feet: ankles (Foot bone, J_FTL and J_FTR), tilt (ankle toward the sole, relative to rest, positive toe up),
     yaw (lateral axis of the foot, relative to the front of the hips, positive toward the left, like S.fyG);
   - knees: knee direction from the hip-ankle axis, in the pelvis frame (IK pole of the legs).
   Positions are scaled to the soldier (ratio of leg lengths, SD.thigh + SD.shin against those of the clip). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const NM = [path.join(HERE, 'node_modules/three'), path.join(HERE, '../visual/node_modules/three'), path.join(HERE, '../node_modules/three')].find((p) => fs.existsSync(p)) || path.join(HERE, 'node_modules/three'); // npm --prefix tools/dev/anim install
const THREE = await import(pathToFileURL(path.join(NM, 'build/three.module.js')).href); // (URL: an absolute Windows path is not importable as is)
const { GLTFLoader } = await import(pathToFileURL(path.join(NM, 'examples/jsm/loaders/GLTFLoader.js')).href);
export { THREE };
export const REPO = path.resolve(HERE, '../../..'), SRC = path.join(REPO, 'anim-source');
/* soldier's leg (SD.thigh + SD.shin, src/06g-body.js) */
export const LEG = 0.43 + 0.425;
export const FPS = 30;

export async function loadGlb(file) {
  const b = fs.readFileSync(file);
  const g = await new Promise((res, rej) => new GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '', res, rej));
  const bones = {};
  g.scene.traverse((o) => { const k = o.name.replace(/^mixamorig\d*:?/, ''); if (!bones[k] && o.name.startsWith('mixamorig')) bones[k] = o; });
  g.scene.updateMatrixWorld(true);
  // rest pose (T-pose): world positions and orientations before any animation
  const rest = {};
  for (const k in bones) rest[k] = { p: bones[k].getWorldPosition(new THREE.Vector3()), q: bones[k].getWorldQuaternion(new THREE.Quaternion()) };
  const leg = rest.LeftUpLeg.p.distanceTo(rest.LeftLeg.p) + rest.LeftLeg.p.distanceTo(rest.LeftFoot.p);
  const clip = g.animations[0] || null;
  let mixer = null, act = null;
  if (clip) { mixer = new THREE.AnimationMixer(g.scene); act = mixer.clipAction(clip); act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = true; act.play(); }
  return { scene: g.scene, bones, rest, leg, k: LEG / leg, clip, dur: clip ? clip.duration : 0,
    /* pose at time t (s): world positions and orientations of each bone */
    at(t) {
      if (mixer) { act.paused = false; act.enabled = true; mixer.setTime(Math.min(t, clip.duration)); }
      g.scene.updateMatrixWorld(true);
      const P = {};
      for (const k in bones) P[k] = { p: bones[k].getWorldPosition(new THREE.Vector3()), q: bones[k].getWorldQuaternion(new THREE.Quaternion()) };
      return P;
    } };
}

/* half-turn around Y (pack frame to the game's) */
const RY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI), RYi = RY.clone().invert();
export const toGameV = (v, out = new THREE.Vector3()) => out.set(-v.x, v.y, -v.z);
export const toGameQ = (q, out = new THREE.Quaternion()) => out.copy(RY).multiply(q).multiply(RYi);
const _m = new THREE.Matrix4();
/* frame (x, y nearly perpendicular) to quaternion; y is kept, x made perpendicular */
function frameQ(x, y) {
  const Y = y.clone().normalize(), X = x.clone().addScaledVector(Y, -x.dot(Y)).normalize(), Z = new THREE.Vector3().crossVectors(X, Y);
  return new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(X, Y, Z));
}

/* front of the soldier's hips (layoutSoldier): perpendicular, horizontal, to the hip line set by the pelvis qP */
export function hipFwd(qP) { const x = new THREE.Vector3(1, 0, 0).applyQuaternion(qP); return new THREE.Vector3(x.z, 0, -x.x).normalize(); }
/* orientation of the soldier's foot (soldierFrames): flat along the hip axis, yaw fy around the vertical, tilt fp */
export function footQ(qP, fy, fp) {
  const z = hipFwd(qP).negate(), y = new THREE.Vector3(0, 1, 0), x = new THREE.Vector3().crossVectors(y, z);
  const q = new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(x, y, z));
  q.premultiply(new THREE.Quaternion().setFromAxisAngle(y, fy));
  return q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), fp));
}
/* Support points of the boot sole (soldierBoots; foot frame: origin at the ankle, -z toward the toe, ground at y = -0.075),
   in the ankle frame a: heel, and ball under the toe bone (SD.ball), which folds back by 85% when the foot extends
   (soldierFrames): in the roll-off, it is the one that stays on the ground. */
const HEEL = new THREE.Vector3(0, -0.075, 0.07), BALL = new THREE.Vector3(0, -0.052, -0.122), PAD = new THREE.Vector3(0, -0.023, -0.03), X1 = new THREE.Vector3(1, 0, 0);
export function soleW(qP, fy, fp, a) {
  const qf = footQ(qP, fy, fp), qt = fp < 0 ? qf.clone().multiply(new THREE.Quaternion().setFromAxisAngle(X1, -fp * 0.85)) : qf;
  return [HEEL.clone().applyQuaternion(qf).add(a), PAD.clone().applyQuaternion(qt).add(BALL.clone().applyQuaternion(qf)).add(a)];
}

/* Quantities of a pose P (output of at), in the game frame, at scale k; root: ground point (pack frame) removed from the positions */
export function quantities(A, P, root) {
  const k = A.k, g = (v) => toGameV(new THREE.Vector3().subVectors(v, root)).multiplyScalar(k);
  const pel = g(P.Hips.p), hL = g(P.LeftUpLeg.p), hR = g(P.RightUpLeg.p), sp = g(P.Spine.p), neck = g(P.Neck.p), sL = g(P.LeftArm.p), sR = g(P.RightArm.p);
  const qP = frameQ(new THREE.Vector3().subVectors(hR, hL), new THREE.Vector3().subVectors(sp, pel));
  const qT = frameQ(new THREE.Vector3().subVectors(sR, sL), new THREE.Vector3().subVectors(neck, pel));
  // head: rotation of the bone from the T-pose (looking straight ahead), converted to the game frame
  const qH = toGameQ(P.Head.q.clone().multiply(A.rest.Head.q.clone().invert()));
  // front of the hips (like layoutSoldier: perpendicular to the soldier's hip line, which follows qP, horizontal)
  const fwd = hipFwd(qP);
  const feet = [], pitch = [], yaw = [], knee = [], qPi = qP.clone().invert();
  for (const s of ['Left', 'Right']) {
    const a = g(P[s + 'Foot'].p), b = g(P[s + 'ToeBase'].p), d = new THREE.Vector3().subVectors(b, a);
    const r0 = new THREE.Vector3().subVectors(toGameV(A.rest[s + 'ToeBase'].p), toGameV(A.rest[s + 'Foot'].p));
    const el = Math.atan2(d.y, Math.hypot(d.x, d.z)), el0 = Math.atan2(r0.y, Math.hypot(r0.x, r0.z));
    feet.push(a); pitch.push(el - el0);
    // yaw: front of the foot taken from its lateral axis (which stays horizontal when the foot extends or lifts), angle from the front of the
    // hips, positive toward the left (-x), like S.fyG
    const lat = toGameV(new THREE.Vector3(1, 0, 0).applyQuaternion(P[s + 'Foot'].q.clone().multiply(A.rest[s + 'Foot'].q.clone().invert())));
    const h = new THREE.Vector3().crossVectors(lat, new THREE.Vector3(0, 1, 0)).setY(0).normalize();
    yaw.push(Math.atan2(fwd.z * h.x - fwd.x * h.z, fwd.dot(h)));
    // knee: direction from the hip-ankle midpoint, perpendicular to that axis, in the pelvis frame (IK pole of the legs)
    const hip = g(P[s + 'UpLeg'].p), kn = g(P[s + 'Leg'].p), ax = new THREE.Vector3().subVectors(a, hip).normalize();
    const kd = new THREE.Vector3().subVectors(kn, hip); kd.addScaledVector(ax, -kd.dot(ax));
    knee.push(kd.lengthSq() > 1e-8 ? kd.normalize().applyQuaternion(qPi) : new THREE.Vector3(0, 0, -1));
  }
  // point equivalent to J_HEAD: 40% of the way from the Head bone to HeadTop_End (middle of the head), to measure the head height
  const head = g(P.Head.p).lerp(g(P.HeadTop_End.p), 0.4);
  return { pel, qP, qT, qH, feet, pitch, yaw, knee, head, neck, hips: [hL, hR], sh: [sL, sR] };
}

/* reading of the manifest */
export function manifest() { return JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8')); }

/* cyclic runs of true values of an array: [{ s, l }] (start, length) */
function runs(a) {
  const N = a.length, out = [];
  if (a.every(Boolean)) return [{ s: 0, l: N }];
  const z = a.indexOf(false);
  for (let k = 1; k <= N; k++) { const i = (z + k) % N; if (a[i] && !a[(i - 1 + N) % N]) { let l = 0; while (a[(i + l) % N]) l++; out.push({ s: i, l }); } }
  return out;
}
/* Foot planting lock (locomotion loops), on the boot's support points (soleW), the body advancing at the clip's speed:
   - during each stance, the supporting point (heel at the strike, ball afterwards, blended according to the lower of the two) no longer moves in the
     world; the caught-up gap is centered on the stance (the leg stretches half as much) and passes from one stance to the next during the airborne
     phase;
   - the sole does not go below its stance level (the X Bot's foot, shorter, rolls differently from the boot), and a foot in the air
     keeps 4.5 cm under the sole from the frame after takeoff until the one before landing: the capture often plants and lifts
     the foot dragging it, which would scrape the ground between two frames.
   Fixes the capture's sliding and the gap between the X Bot's foot and the soldier's.
   Stance: sole within 3 cm of its lowest with a support point slower than 30% of the clip speed (0.35 m/s at least),
   or within 1.2 cm and slower than 60% (end of roll-off, which slides in the capture; a foot skimming the ground in the air goes
   faster). Speed: the lower of those toward the previous frame and toward the next frame (the last frame of a stance does not count the
   takeoff, the first does not count the landing). */
function lockFeet(Q, N, dur, gv, spd) {
  const dt = dur / N, thr = Math.max(0.35, spd * 0.3), ss = THREE.MathUtils.smoothstep, CLEARANCE = 0.045;
  for (let f = 0; f < 2; f++) {
    // sole in the world over two cycles (frame i + N: frame i, one cycle later)
    const W = [];
    for (let i = 0; i <= 2 * N; i++) { const q = Q[i % N]; W.push(soleW(q.qP, q.yaw[f], q.pitch[f], gv.clone().multiplyScalar(i * dt).add(q.feet[f]))); }
    const wb = W.map(([h, b]) => ss(h.y - b.y, -0.01, 0.01)), piv = (i, w) => W[i][0].clone().lerp(W[i][1], w);
    const step = (i, w) => { const d = piv(i + 1, w).sub(piv(i, w)); d.y = 0; return d; };
    const low = W.slice(0, N).map(([h, b]) => Math.min(h.y, b.y)), lo = Math.min(...low);
    const sp = low.map((y, i) => Math.min(step(i + N - 1, wb[i + N]).length(), step(i, wb[i]).length()) / dt);
    const on = low.map((y, i) => y < lo + 0.03 && sp[i] < (y < lo + 0.012 ? 2 : 1) * thr);
    // gaps of two frames at most filled, stances shorter than three frames ignored
    for (const r of runs(on.map((x) => !x))) if (r.l <= 2 && r.l < N) for (let j = 0; j < r.l; j++) on[(r.s + j) % N] = true;
    for (const r of runs(on)) if (r.l < 3) for (let j = 0; j < r.l; j++) on[(r.s + j) % N] = false;
    const R = runs(on);
    if (!R.length || R[0].l >= N) continue;
    // stance level: median of the lowest point during the stances
    const gl = low.filter((y, i) => on[i]).sort((a, b) => a - b), gnd = gl[gl.length >> 1];
    const c = new Array(N), up = new Array(N);
    for (const r of R) {
      const v = new THREE.Vector3(), a = [v.clone()];
      for (let j = 1; j < r.l; j++) { v.sub(step(r.s + j - 1, wb[r.s + j])); a.push(v.clone()); }
      const m = a[0].clone().add(a[r.l - 1]).multiplyScalar(0.5);
      a.forEach((x, j) => { const i = (r.s + j) % N; c[i] = x.sub(m); up[i] = Math.max(0, gnd - low[i]); });
    }
    R.forEach((r, k) => {
      const n = R[(k + 1) % R.length], e = r.s + r.l - 1, g = (((n.s - e) % N) + N) % N || N, c0 = c[e % N], c1 = c[n.s], u0 = up[e % N], u1 = up[n.s];
      for (let j = 1; j < g; j++) {
        const i = (e + j) % N, u = ss(j / g, 0, 1);
        c[i] = c0.clone().lerp(c1, u);
        up[i] = Math.max(u0 + (u1 - u0) * u, gnd + CLEARANCE - low[i]);
      }
    });
    for (let i = 0; i < N; i++) { Q[i].feet[f].x += c[i].x; Q[i].feet[f].y += up[i]; Q[i].feet[f].z += c[i].z; }
  }
}

/* Bones drawn for the reference (comparison page) */
export const DRAW_BONES = ['Hips', 'Spine2', 'Neck', 'Head', 'HeadTop_End', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];
/* A clip of the manifest (entry c), ready to quantize, at 30 frames per second:
   - motion removed: for a loop, the linear part of the pelvis's horizontal track (the sway stays); for a clip that
     advances without looping (slide), the whole horizontal track; speed gv and direction dir (game body frame, scaled);
   - loop seamed: the gap between the pose at t = duration (which should repeat the first) and the first is blended over the last quarter;
   - phase aligned: frame 0 of a locomotion clip is the left foot pose (start of its longest stance: foot stopping on the ground),
     like S.cyc = 0 in the game; stances locked (lockFeet); no sole below the ground;
   Q: quantities per frame (quantities); R: bone points (DRAW_BONES) in the game frame, same anchoring and same phase as Q. */
export async function bakeClip(c) {
  const id = c.filepath.replace(/\.glb$/, ''), A = await loadGlb(path.join(SRC, c.filepath));
  const loop = !!c.looping, dur = A.dur;
  const N = loop ? Math.round(dur * FPS) : Math.round(dur * FPS) + 1;
  const T = []; for (let i = 0; i < N; i++) T.push(loop ? (i * dur) / N : Math.min(i / FPS, dur));
  const P = T.map((t) => A.at(t)), Pend = A.at(dur);
  const h0 = P[0].Hips.p, h1 = Pend.Hips.p, vel = new THREE.Vector3(h1.x - h0.x, 0, h1.z - h0.z).divideScalar(dur || 1);
  const moving = vel.length() > 0.3, lin = (t) => new THREE.Vector3(h0.x + vel.x * t, 0, h0.z + vel.z * t);
  let roots;
  if (!loop && moving) roots = P.map((p) => new THREE.Vector3(p.Hips.p.x, 0, p.Hips.p.z)); // slide: the pelvis stays above the anchor
  else {
    const m = new THREE.Vector3(); P.forEach((p, i) => m.add(new THREE.Vector3(p.Hips.p.x, 0, p.Hips.p.z).sub(lin(T[i])))); m.divideScalar(N);
    roots = T.map((t) => lin(t).add(m));
  }
  let Q = P.map((p, i) => quantities(A, p, roots[i]));
  let seam = 0;
  if (loop) {
    const qe = quantities(A, Pend, lin(dur).add(roots[0].clone().sub(lin(0)))), q0 = Q[0];
    seam = THREE.MathUtils.radToDeg(Math.max(qe.qT.angleTo(q0.qT), qe.qP.angleTo(q0.qP), qe.qH.angleTo(q0.qH)));
    const B = Math.max(2, Math.round(N / 4));
    for (let i = N - B; i < N; i++) {
      const s = (i - (N - B) + 1) / (B + 1), w = s * s * (3 - 2 * s), q = Q[i];
      const fix = (a, e0, e1) => a.addScaledVector(new THREE.Vector3().subVectors(e1, e0), -w);
      fix(q.pel, q0.pel, qe.pel); for (let f = 0; f < 2; f++) fix(q.feet[f], q0.feet[f], qe.feet[f]);
      for (const k of ['qP', 'qT', 'qH']) { const d = q0[k].clone().multiply(qe[k].clone().invert()); q[k].premultiply(new THREE.Quaternion().slerp(d, w)); }
      for (let f = 0; f < 2; f++) { q.pitch[f] -= (qe.pitch[f] - q0.pitch[f]) * w; q.yaw[f] -= (qe.yaw[f] - q0.yaw[f]) * w; fix(q.knee[f], q0.knee[f], qe.knee[f]).normalize(); }
    }
  }
  let ph = 0;
  if (loop && moving) {
    const sp = P.map((p, i) => (i < N - 1 ? p.LeftFoot.p.distanceTo(P[i + 1].LeftFoot.p) : p.LeftFoot.p.distanceTo(Pend.LeftFoot.p)) * N / dur);
    const thr = Math.max(0.3, vel.length() * 0.3), st = sp.map((v) => v < thr);
    let best = -1, bl = 0;
    for (let i = 0; i < N; i++) if (st[i] && !st[(i - 1 + N) % N]) { let l = 0; while (l < N && st[(i + l) % N]) l++; if (l > bl) { bl = l; best = i; } }
    if (best > 0) { ph = best; Q = Q.slice(ph).concat(Q.slice(0, ph)); }
    lockFeet(Q, N, dur, new THREE.Vector3(-vel.x, 0, -vel.z).multiplyScalar(A.k), vel.length() * A.k);
  }
  // floor: no boot sole below the ground (its heel extends past the X Bot's: extended foot of the slide, toe raised)
  for (const q of Q) for (let f = 0; f < 2; f++) { const lo = Math.min(...soleW(q.qP, q.yaw[f], q.pitch[f], q.feet[f]).map((p) => p.y)); if (lo < 0.004) q.feet[f].y += 0.004 - lo; }
  for (const k of ['qP', 'qT', 'qH']) for (let i = 1; i < N; i++) if (Q[i][k].dot(Q[i - 1][k]) < 0) { const q = Q[i][k]; q.set(-q.x, -q.y, -q.z, -q.w); }
  const R = []; for (let i = 0; i < N; i++) { const j = (i + ph) % N; R.push(DRAW_BONES.map((b) => toGameV(new THREE.Vector3().subVectors(P[j][b].p, roots[j])).multiplyScalar(A.k))); }
  const gv = new THREE.Vector3(-vel.x, 0, -vel.z).multiplyScalar(A.k), spd = gv.length();
  const dir = spd > 0.3 ? Math.round(THREE.MathUtils.radToDeg(Math.atan2(-gv.x, -gv.z))) : null;
  return { id, loop, dur, N, T, Q, ph, seam, k: A.k, gv, spd, dir, R };
}
