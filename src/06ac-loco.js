/* ==========================================================================
   CLIP-BASED LOCOMOTION: walk, run and sprint taken from the baked animations (06ab-anim.js), in place of the procedural cycle of
   poseSoldier (06b-soldier.js) for all soldiers (bots, remote players, the player body that the killcam records), standing or
   crouched. The procedural cycle remains for stopping, transitions and the shuffling of a crouched pivot, and if the data is missing.
   Clip families by direction (walk, run and crouch walk: eight directions; sprint: forward and forward diagonals): the
   two clips neighboring the movement direction are blended, then walk and run according to speed (from 1.1 times the natural pace
   of the walk to 0.8 times that of the run, with the rifle 2 to 3.7 m/s: the walk clip, made for 1.9 m/s, does not run at twice
   its cadence), then sprint, then crouch walk according to the crouch amount. All clips of a blend are read at the
   same phase (0: left foot pose, like S.cyc). Handgun: walk and run from its clips forward and backward, side
   steps from its walk clips; diagonals, side run, sprint, crouch and jump: rifle clips (the upper body keeps the
   pistol posture, arms extended). The stride stays that of the clips (lengthening it would move the support point
   during the foot roll): only the cadence follows the speed.
   Jump (jump clips, "in place": the game makes the body rise): in the air, the takeoff impulse (from liftoff, 0.30 s)
   then the looping flight, rotated by their mean yaw (the aiming profile stays the game's), legs less tucked (LOCO_TUCK); on landing, the pelvis dip and
   the torso flexion of the clip (0.33 to 0.67 s) are added to the pose, scaled by the fall speed.
   Hit received (clip actions/hit-react): additive layer (offset from its first frame) on the pelvis, torso and head, turned toward the
   direction of fire and scaled by the hit (0.6 to the body, 0.84 to the head, accumulated up to 1), on top of the impact spring of
   poseSoldier.
   Slide (clip actions/slide): its 0.10 to 0.73 s segment stretched over the 0.8 s of the game's slide, torso straightened so the head stays near 0.85 m (the camera of the sliding player): their hit zones, for others, stay
   where he sees. Exit toward crouch.
   Grenade throw and reload (actions/throw-grenade, segment 1.2 to 1.9 s over the 0.7 s of the game's throw; actions/reload,
   stretched over the weapon's reload duration): torso twist and flexion of the clip as an additive layer; hands stay those of the
   game (keySpline, magazine). The pack's 90-degree pivots are not used: footPlant steps follow any angle.
   locoSel chooses the clips and their shares, and gives the cycle length (LOCO.L, m) and the share of speed kept by the blend of
   two directions (LOCO.k): the phase advances by v / (L k), the support foot then moves back at exactly the body's speed.
   locoPose reads the pose at a phase. No per-frame allocation.
   ========================================================================== */
/* pelvis of the crouch walk (m, without aiming and share of aiming): lowered to keep the head at the height of the previous crouch */
const LOCO_CDY = [-0.05, -0.08];
const LOCO = { fam: null, a: null, b: null, r: null, rc: null, m: null, ma: null, mr: null, mh: null, ms: null, mx: null, rec0: null, hit0: null, thr0: null, rld0: null, hit: null, slide: null, thr: null, rld: null, jump: null, sel: [{}, {}, {}, {}], g: 0, sw: 0, c: 0, L: 1, k: 1, ty: 0, v: new V3() };
/* families (once): clips sorted by direction (rad, 0 forward, positive toward the left) */
function locoInit() {
  if (LOCO.fam !== null) return LOCO.fam;
  LOCO.fam = false;
  if (!animInit()) return false;
  const fam = (pre, names) => names.map((n) => animClip(pre + n)).filter((c) => c && c.dir !== null)
    .map((c) => { const a = Math.atan2(Math.sin((c.dir * Math.PI) / 180), Math.cos((c.dir * Math.PI) / 180)); return { c, a, ux: -Math.sin(a), uz: -Math.cos(a) }; })
    .sort((x, y) => x.a - y.a);
  const D8 = ['forward', 'forward-left', 'left', 'backward-left', 'backward', 'backward-right', 'right', 'forward-right'];
  const F = { walk: fam('rifle/standing/walk-', D8), run: fam('rifle/standing/run-', D8), sprint: fam('rifle/standing/sprint-', ['forward', 'forward-left', 'forward-right']), crouch: fam('rifle/crouched/walk-', D8) };
  if (F.walk.length < 8 || F.run.length < 8 || F.sprint.length < 3 || F.crouch.length < 8) return false;
  // handgun: its own clips where the pack has them, rifle ones elsewhere
  const P = (pre, rifle) => D8.map((d) => (pre[d] && animClip('pistol/' + pre[d])) || animClip(rifle + d));
  const pw = P({ forward: 'walk-forward', backward: 'walk-backward', left: 'strafe-left', right: 'strafe-right' }, 'rifle/standing/walk-');
  const pr = P({ forward: 'course-avant', backward: 'run-backward' }, 'rifle/standing/run-');
  const byDir = (L) => L.filter(Boolean).map((c) => { const a = Math.atan2(Math.sin((c.dir * Math.PI) / 180), Math.cos((c.dir * Math.PI) / 180)); return { c, a, ux: -Math.sin(a), uz: -Math.cos(a) }; }).sort((x, y) => x.a - y.a);
  F.pwalk = byDir(pw); F.prun = byDir(pr);
  if (F.pwalk.length < 8 || F.prun.length < 8) { F.pwalk = F.walk; F.prun = F.run; }
  for (const k of ['walk', 'run', 'sprint', 'pwalk', 'prun']) for (const e of F[k]) locoLiftTab(e.c);
  LOCO.a = animSmp(); LOCO.b = animSmp(); LOCO.r = animSmp(); LOCO.rc = animSmp(); LOCO.m = animSmp(); LOCO.ma = animSmp(); LOCO.mr = animSmp(); LOCO.rec0 = animSmp();
  const J = { dep: animClip('rifle/jump/takeoff'), vol: animClip('rifle/jump/air'), rec: animClip('rifle/jump/land') };
  if (J.dep && J.vol && J.rec) { LOCO.jump = J; animSample(J.rec, 0.33, LOCO.rec0); }
  LOCO.hit = animClip('actions/hit-react'); LOCO.mh = animSmp(); LOCO.hit0 = animSmp();
  LOCO.slide = animClip('actions/slide'); LOCO.ms = animSmp();
  LOCO.thr = animClip('actions/throw-grenade'); LOCO.rld = animClip('actions/reload'); LOCO.mx = animSmp(); LOCO.thr0 = animSmp(); LOCO.rld0 = animSmp();
  if (LOCO.thr) animSample(LOCO.thr, 1.2, LOCO.thr0);
  if (LOCO.rld) animSample(LOCO.rld, 0, LOCO.rld0);
  if (LOCO.hit) animSample(LOCO.hit, 0, LOCO.hit0);
  return (LOCO.fam = F);
}
/* clips neighboring direction th in family F: s.A, s.B, share s.t of B; cycle length and share of speed kept */
function locoFamSel(F, th, s) {
  const n = F.length;
  let i = 0; while (i < n && F[i].a <= th) i++;
  const A = F[(i - 1 + n) % n], B = F[i % n];
  let span = B.a - A.a, d = th - A.a;
  if (span <= 0) span += TAU; if (d < 0) d += TAU;
  const t = clamp(d / span, 0, 1);
  s.A = A.c; s.B = B.c; s.t = t; s.v = lerp(A.c.v, B.c.v, t); s.cyc = lerp(A.c.cyc, B.c.cyc, t); s.k = hyp(lerp(A.ux, B.ux, t), lerp(A.uz, B.uz, t)); s.ty = lerp(A.c.ty, B.c.ty, t);
  return s;
}
/* choice of clips for a speed v (m/s), a direction th (rad, body frame), a sprint share sw, a crouch amount c, and
   the handgun flag isP */
function locoSel(v, th, sw, c, isP) {
  const F = LOCO.fam, S = LOCO.sel;
  locoFamSel(isP ? F.pwalk : F.walk, th, S[0]); locoFamSel(isP ? F.prun : F.run, th, S[1]);
  // from walk to run: between slightly more than the natural pace of the walk and slightly less than that of the run
  const g = smoothstep(S[0].v * 1.1, Math.max(S[0].v * 1.1 + 0.5, S[1].v * 0.8), v);
  // sprint: forward and forward diagonals (beyond that, the direction is brought back to 45 degrees)
  locoFamSel(F.sprint, clamp(th, -Math.PI / 4, Math.PI / 4), S[2]);
  locoFamSel(F.crouch, th, S[3]);
  LOCO.g = g; LOCO.sw = sw; LOCO.c = c;
  const m = (k) => lerp(lerp(lerp(S[0][k], S[1][k], g), S[2][k], sw), S[3][k], c);
  LOCO.L = m('cyc'); LOCO.k = Math.max(0.5, m('k')); LOCO.ty = m('ty');
}
/* pose at phase ph (0 to 1) according to the last locoSel; out: animSmp() */
function locoFam(s, ph, out) { animPhase(s.A, ph, LOCO.a); animPhase(s.B, ph, LOCO.b); return animMix(LOCO.a, LOCO.b, s.t, out); }
function locoPose(ph, out) {
  const S = LOCO.sel, g = LOCO.g, sw = LOCO.sw, c = LOCO.c;
  if (c < 1) {
    if (g < 1) locoFam(S[0], ph, out);
    if (g > 0) { if (g < 1) animMix(out, locoFam(S[1], ph, LOCO.r), g, out); else locoFam(S[1], ph, out); }
    if (sw > 0.001) animMix(out, locoFam(S[2], ph, LOCO.r), sw, out);
  }
  if (c > 0) { if (c < 1) animMix(out, locoFam(S[3], ph, LOCO.rc), c, out); else locoFam(S[3], ph, out); }
  return out;
}
/* Pelvis lift (m, at most max) that the legs of pose m allow (99% of their length): the clips walk with knees bent,
   pelvis lower than the game, which raises it to keep the head (bots' eye, hit zones) near its previous height; negative
   (5 cm at most) when the clip extends the legs beyond their length (the foot would come off the ground). Frame by frame, it dipped
   when a leg extended backward limits it (forward walk: from 5 cm to 0.8 cm and back in 0.07 s, at the right foot pose):
   a jerk of the pelvis and knees every cycle; so we use its smoothed curve (locoLiftTab, locoLift) */
function locoRaise(m, max) {
  const Lm = 0.99 * (SD.thigh + SD.shin), d = LOCO.v;
  let r = max;
  for (let i = 0; i < 2; i++) {
    d.set((i ? 1 : -1) * SD.hipX, SD.hipY, 0).applyQuaternion(m.qP).add(m.pel).sub(m.ft[i]);
    const h2 = d.x * d.x + d.z * d.z;
    r = Math.min(r, h2 < Lm * Lm ? Math.sqrt(Lm * Lm - h2) - d.y : 0);
  }
  return Math.max(-0.05, r);
}
/* Lift curve of a locomotion loop (c.lift, one value per frame): the lift of each frame (locoRaise), the same for both
   steps (minimum with that of the opposite half-cycle: otherwise every other step went lower, like a limp), eroded then averaged over
   a window of 0.1 cycle on either side (opening): everywhere below the allowed lift (legs never over-extend), without
   sudden dips (the pelvis lowers smoothly before the step that requires it) */
function locoLiftTab(c) {
  if (c.lift) return;
  const n = c.n, m = animSmp(), raw = new Float32Array(n), ero = new Float32Array(n), out = new Float32Array(n), w = Math.max(1, Math.round(n * 0.1));
  for (let f = 0; f < n; f++) raw[f] = locoRaise(animRead(c, f, m), 0.05);
  const sym = raw.slice(); for (let f = 0; f < n; f++) raw[f] = Math.min(sym[f], sym[Math.round(f + n / 2) % n]);
  for (let f = 0; f < n; f++) { let v = 1; for (let k = -w; k <= w; k++) v = Math.min(v, raw[(f + k + n) % n]); ero[f] = v; }
  for (let f = 0; f < n; f++) { let s = 0; for (let k = -w; k <= w; k++) s += ero[(f + k + n) % n]; out[f] = s / (2 * w + 1); }
  c.lift = out;
}
/* smoothed lift at phase ph, blended like the pose (locoPose: directions, walk and run, sprint; crouch has its own offsets) */
function locoLift(ph) {
  const S = LOCO.sel, g = LOCO.g, sw = LOCO.sw;
  const tab = (c) => { const L = c.lift; if (!L) return 0.05; const x = ph * L.length, i = Math.floor(x) % L.length, u = x - Math.floor(x); return lerp(L[i], L[(i + 1) % L.length], u); };
  const fam = (s) => lerp(tab(s.A), tab(s.B), s.t);
  let v = g < 1 ? fam(S[0]) : 0;
  if (g > 0) v = g < 1 ? lerp(v, fam(S[1]), g) : fam(S[1]);
  if (sw > 0.001) v = lerp(v, fam(S[2]), sw);
  return v;
}
/* Jump timing, each frame: S.aT, time in the air (-1 on the ground); S.jmp, jump (not a fall); S.rT, time since landing;
   S.rK, landing intensity (0 to 1 according to the fall speed airVy, zero for a small jump) */
function locoAirT(S, air, landed, vy, airVy, dt) {
  if (air) { if (!(S.aT >= 0)) { S.aT = 0; S.jmp = vy > 2; } else S.aT += dt; S.rT = -1; return; }
  S.aT = -1;
  if (landed) { S.rT = 0; S.rK = clamp((-airVy - 3) / 8, 0, 1); } else if (S.rT >= 0) S.rT += dt;
}
/* in-air pose: takeoff impulse (jump), then looping flight; null without the jump clips */
/* legs less tucked than in the clip (feet 55 cm above the base of the body): the game's body already rises 1 m at the top
   of a jump, the full tuck made the jump look much higher; share kept of the foot lift and their pitch */
const LOCO_TUCK = 0.5;
function locoAirPose(S, out) {
  const J = LOCO.jump; if (!J) return null;
  const d0 = J.dep.dur - 0.3, dep = S.jmp && S.aT < d0;
  if (dep) animSample(J.dep, 0.3 + S.aT, out); else animSample(J.vol, S.aT - (S.jmp ? d0 : 0), out);
  for (let i = 0; i < 2; i++) { out.ft[i].y = 0.085 + (out.ft[i].y - 0.085) * LOCO_TUCK; out.fp[i] *= LOCO_TUCK; }
  return animYaw(out, -(dep ? J.dep.ty : J.vol.ty));
}
/* landing: clip pose at 0.33 s + S.rT (compare with LOCO.rec0); null outside of landing */
function locoRec(S, out) {
  const J = LOCO.jump;
  return J && S.rT >= 0 && S.rT < 0.34 && S.rK > 0 ? animSample(J.rec, 0.33 + S.rT, out) : null;
}
/* Hit received: clip start (kick: 1 to the body, 1.4 to the head, accumulated; hx, hz: direction of fire in the body frame), then clip pose
   at S.hT (compare with LOCO.hit0) while it lasts; S.hA: yaw that turns the clip (leaning backward) toward the direction of fire */
function locoHitStart(S, kick, hx, hz) { if (LOCO.hit) { S.hT = 0; S.hK = Math.min(1, 0.6 * kick); S.hA = Math.atan2(hx, hz); } }
function locoHit(S, dt, out) {
  if (!LOCO.hit || !(S.hT >= 0)) return null;
  if (S.hT > LOCO.hit.dur) { S.hT = -1; return null; }
  animSample(LOCO.hit, S.hT, out); S.hT += dt;
  return out;
}
/* slide: pose at time t (s) since its start; null without the clip (no yaw removed: lying down, the torso has no meaningful yaw) */
function locoSlidePose(t, out) {
  const C = LOCO.slide; if (!C) return null;
  return animSample(C, 0.1 + clamp(t / 0.8, 0, 1) * 0.63, out);
}
/* torso q straightened toward vertical, by share k, as long as the head would go below 0.85 m (pelvis at height py) */
const _lsQ = new THREE.Quaternion(), _lsA = new V3();
function locoSlideUp(q, py, k) {
  const u = LOCO.v.set(0, 1, 0).applyQuaternion(q), cMin = clamp((0.85 - 0.17 - py) / SD.trunk, -1, 1);
  if (u.y >= cMin) return;
  _lsA.set(u.z, 0, -u.x); // u x (0, 1, 0): axis that brings u back toward vertical
  if (_lsA.lengthSq() < 1e-8) return;
  q.premultiply(_lsQ.setFromAxisAngle(_lsA.normalize(), -(Math.acos(clamp(u.y, -1, 1)) - Math.acos(cMin)) * k));
}
/* Torso gesture: throw (tt, progress from 0 to 1 of the game's throw) or reload (tt, reload progress); clip pose
   into out, and LOCO.x0, its starting pose; null without the clip */
function locoGesture(throwing, tt, out) {
  const C = throwing ? LOCO.thr : LOCO.rld; if (!C) return null;
  LOCO.x0 = throwing ? LOCO.thr0 : LOCO.rld0;
  return animSample(C, throwing ? 1.2 + clamp(tt, 0, 1) * 0.7 : clamp(tt, 0, 1) * C.dur, out);
}
