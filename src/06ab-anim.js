/* ==========================================================================
   BAKED ANIMATIONS: Mixamo clips (Pro Rifle Pack, Pistol Handgun Locomotion Pack, Basic Shooter Pack) reduced to the quantities that
   poseSoldier computes (src/06b-soldier.js), frame by frame, by tools/dev/anim/bake.mjs (the pack itself stays out of the repo: license).
   Data shipped in the page base by build.py (window.BASE_ASSETS.anim: assets/anim/clips.bin in base64, index from clips.json): 30 frames per second, 31 16-bit
   integers per frame, in the game's body frame (looking toward -z, right toward +x, feet at y = 0), at soldier scale:
     pelvis: position (J_PEL) and orientation (hip frame); torso: orientation carrying the pelvis-neck segment and the shoulders;
     head: orientation; left and right ankles (J_FTL, J_FTR); foot pitch (positive points up, like S.fp); foot
     yaw relative to the hips (positive toward the left, like S.fyG); knee direction in the pelvis frame (pole of
     the leg IK).
   Index of a clip (ANIM.clips[id], id: path in the pack without .glb, e.g. 'rifle/standing/walk-forward'): n frames, o first frame,
   loop, dur (s), v (m/s, game frame), dir (degrees: 0 forward, 90 left, like atan2(-lvx, -lvz)), cyc (m per cycle: the phase advances by
   v / cyc), ty (mean torso yaw, rad, positive toward the left), head (head height, min and max). Phase 0 of a locomotion clip: left foot pose (like S.cyc = 0).
   ========================================================================== */
const ANIM_DATA = (window.BASE_ASSETS || {}).anim || null; // base (build.py)
const ANIM = { clips: null, d: null, st: 31 };
function animInit() {
  if (ANIM.clips) return !!ANIM.d;
  ANIM.clips = {};
  if (!ANIM_DATA) return false;
  const s = atob(ANIM_DATA.b), u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  ANIM.d = new Int16Array(u.buffer); ANIM.st = ANIM_DATA.stride; ANIM.fps = ANIM_DATA.fps;
  for (const c of ANIM_DATA.clips) ANIM.clips[c.id] = c;
  return true;
}
function animClip(id) { animInit(); return ANIM.clips[id] || null; }
/* a pose (output of animSample) */
function animSmp() { return { pel: new V3(), qP: new THREE.Quaternion(), qT: new THREE.Quaternion(), qH: new THREE.Quaternion(), ft: [new V3(), new V3()], fp: [0, 0], fy: [0, 0], kn: [new V3(), new V3()] }; }
const _anA = animSmp(), _anB = animSmp();
/* (whole) frame f of clip c into out */
function animRead(c, f, out) {
  const d = ANIM.d, i = (c.o + f) * ANIM.st, P = 1e-4, Q = 1 / 32767;
  out.pel.set(d[i] * P, d[i + 1] * P, d[i + 2] * P);
  out.qP.set(d[i + 3] * Q, d[i + 4] * Q, d[i + 5] * Q, d[i + 6] * Q).normalize();
  out.qT.set(d[i + 7] * Q, d[i + 8] * Q, d[i + 9] * Q, d[i + 10] * Q).normalize();
  out.qH.set(d[i + 11] * Q, d[i + 12] * Q, d[i + 13] * Q, d[i + 14] * Q).normalize();
  out.ft[0].set(d[i + 15] * P, d[i + 16] * P, d[i + 17] * P); out.ft[1].set(d[i + 18] * P, d[i + 19] * P, d[i + 20] * P);
  out.fp[0] = d[i + 21] * P; out.fp[1] = d[i + 22] * P; out.fy[0] = d[i + 23] * P; out.fy[1] = d[i + 24] * P;
  out.kn[0].set(d[i + 25] * P, d[i + 26] * P, d[i + 27] * P); out.kn[1].set(d[i + 28] * P, d[i + 29] * P, d[i + 30] * P);
  return out;
}
/* blend of two poses (w: share of b); out may be a */
function animMix(a, b, w, out) {
  out.pel.lerpVectors(a.pel, b.pel, w);
  out.qP.slerpQuaternions(a.qP, b.qP, w); out.qT.slerpQuaternions(a.qT, b.qT, w); out.qH.slerpQuaternions(a.qH, b.qH, w);
  for (let k = 0; k < 2; k++) { out.ft[k].lerpVectors(a.ft[k], b.ft[k], w); out.fp[k] = lerp(a.fp[k], b.fp[k], w); out.fy[k] = lerp(a.fy[k], b.fy[k], w); out.kn[k].lerpVectors(a.kn[k], b.kn[k], w); }
  return out;
}
/* pose of clip c at time t (s): between two frames; a loop restarts at the beginning (its n frames cover exactly its duration, which
   is not always a whole number of frames at 30 per second), a simple clip stops on its last frame */
function animSample(c, t, out) {
  let x;
  if (c.loop) { x = (t / c.dur) * c.n; x = ((x % c.n) + c.n) % c.n; } else x = clamp(t * ANIM.fps, 0, c.n - 1);
  const i0 = Math.floor(x), i1 = c.loop ? (i0 + 1) % c.n : Math.min(i0 + 1, c.n - 1);
  animRead(c, i0, _anA); animRead(c, i1, _anB);
  return animMix(_anA, _anB, x - i0, out);
}
/* pose rotated by a (rad) around the vertical (pelvis, ankles, orientations; knees are in the pelvis frame) */
const _anQ = new THREE.Quaternion(), _anY = new V3(0, 1, 0);
function animYaw(m, a) {
  _anQ.setFromAxisAngle(_anY, a);
  m.pel.applyQuaternion(_anQ); m.ft[0].applyQuaternion(_anQ); m.ft[1].applyQuaternion(_anQ);
  m.qP.premultiply(_anQ); m.qT.premultiply(_anQ); m.qH.premultiply(_anQ);
  return m;
}
/* pose of a loop at phase ph (0 to 1, 0: left foot pose) */
function animPhase(c, ph, out) { return animSample(c, ph * c.dur, out); }
