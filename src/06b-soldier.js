/* ==========================================================================
   SOLDIERS: stylized silhouette driven by 15 joints.
   Alive: procedural pose (arm and leg IK). Dead: ragdoll (06h-ragdoll.js)
   with collisions against the map. Hitboxes follow the joints.
   ========================================================================== */
const J_PEL = 0, J_CHE = 1, J_HEAD = 2, J_SHL = 3, J_ELL = 4, J_HAL = 5, J_SHR = 6, J_ELR = 7, J_HAR = 8, J_HIL = 9, J_KNL = 10, J_FTL = 11, J_HIR = 12, J_KNR = 13, J_FTR = 14;
function setSoldierGun(model, key) {
  gunSoundPrepare(weaponDefByKey(key).sound);
  if (model.gun) model.root.remove(model.gun);
  const g = buildWorldGun(key);
  setGunLod(g.group, !!(model.lod && model.lod.hiOn), model.shadowOnly);
  model.root.add(g.group); model.gun = g.group; model.muzzleLocal = g.muzzle; model.gunKey = key; model.kind = g.kind; model.grips = gripsFor(key);
}

/* ---------- Procedural pose ---------- */
const _pz = { a: new V3(), b: new V3(), c: new V3(), q: new THREE.Quaternion(), qp: new THREE.Quaternion(), m: new THREE.Matrix4(), X: new V3(), Y: new V3(), Z: new V3() };
function ik2(S, T, a, b, pole, outE, outT) {
  const d = _pz.a.subVectors(T, S); const len = clamp(d.length(), 0.05, a + b - 0.002); d.normalize();
  const cosA = clamp((a * a + len * len - b * b) / (2 * a * len), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
  const p = _pz.b.subVectors(pole, S); p.addScaledVector(d, -p.dot(d)); if (p.lengthSq() < 1e-8) p.set(0, -1, 0); p.normalize();
  outE.copy(S).addScaledVector(d, a * cosA).addScaledVector(p, a * sinA);
  outT.copy(S).addScaledVector(d, len);
}
/* Arm toward a hand resting on the weapon (hand frame Q0, grip point G): the elbow is placed where the forearm
   extends the hand (straight wrist) instead of pointing in a fixed direction, so the whole arm follows the weapon when
   it aims high or low; if the wrist stays bent beyond 25°, the hand pivots a little on the grip toward
   the forearm. w: target wrist (modified in place); pole: natural elbow direction; k: 1 hand on the weapon, 0 free;
   align: share of the hand direction in the choice of the elbow (the rest follows the pole) */
const _ag = { z: new V3(), p: new V3(), f: new V3(), n: new V3(), q: new THREE.Quaternion(), i: new THREE.Quaternion() };
function armToGrip(sh, w, G, Q0, pole, k, jE, jH, align = 0.75) {
  const A = _ag;
  A.z.set(0, 0, 1).applyQuaternion(Q0);
  A.p.copy(w).addScaledVector(A.z, SD.fa).lerp(pole, 1 - align * k);
  ik2(sh, w, SD.ua, SD.fa, A.p, jE, jH);
  if (k <= 0) return;
  A.f.subVectors(jH, jE).normalize(); A.n.copy(A.z).negate();
  const ang = Math.acos(clamp(A.f.dot(A.n), -1, 1)), lim = 0.44;
  if (ang <= lim) return;
  A.q.setFromUnitVectors(A.n, A.f); A.i.identity().slerp(A.q, (ang - lim) / ang * k);
  w.sub(G).applyQuaternion(A.i).add(G);
  A.z.set(0, 0, 1).applyQuaternion(A.i.multiply(Q0));
  A.p.copy(w).addScaledVector(A.z, SD.fa).lerp(pole, 1 - align * k);
  ik2(sh, w, SD.ua, SD.fa, A.p, jE, jH);
}
/* Left arm toward a support hand that rolls around its grip (forend, support handle: axis F.axis of the hand frame,
   range F.range), as in first person: among nine rolls, the one that keeps the wrist straightest, instead of a free pivot
   that would lift the palm off the forend on one side and sink it into it on the other; for each roll, the palm stays at the height
   of the forend (soldierLift: grips _ar.grips, recoil _ar.sl set by poseSoldier). Same parameters as armToGrip; layoutSoldier
   recovers the roll from the wrist. */
const _ar = { grips: null, sl: 0, a: new V3(), d: new V3(), y: new V3(), z0: new V3(), w: new V3(), z: new V3(), p: new V3(), e: new V3(), h: new V3(), f: new V3(), r: new THREE.Quaternion() };
function armToGripRoll(sh, w, G, Q0, pole, k, jE, jH, align, F) {
  const A = _ar, N = 9, l0 = soldierLift(A.grips, A.sl), lo = F.lift ? F.lift.lo : l0;
  A.a.copy(F.axis).applyQuaternion(Q0); A.d.subVectors(w, G); A.y.set(0, 1, 0).applyQuaternion(Q0); A.z0.set(0, 0, 1).applyQuaternion(Q0);
  let best = 0, bc = 1e9;
  for (let i = 0; i < N; i++) {
    const phi = (i / (N - 1) * 2 - 1) * Math.min(F.range, SOLDIER_ROLL) * k;
    rollWrist(A, G, phi, F, l0);
    A.p.copy(A.w).addScaledVector(A.z, SD.fa).lerp(pole, 1 - align * k);
    ik2(sh, A.w, SD.ua, SD.fa, A.p, A.e, A.h);
    // straightest wrist; a roll that would lower the palm (protruding part under the forend) is discarded
    const ang = Math.acos(clamp(-A.f.subVectors(A.h, A.e).normalize().dot(A.z), -1, 1));
    const c = Math.max(0, ang - 0.44) ** 2 + 0.05 * phi * phi + 2000 * Math.max(0, soldierLift(A.grips, A.sl, phi) - lo - 0.003) ** 2;
    if (c < bc) { bc = c; best = phi; }
  }
  rollWrist(A, G, best, F, l0); w.copy(A.w);
  A.p.copy(w).addScaledVector(A.z, SD.fa).lerp(pole, 1 - align * k);
  ik2(sh, w, SD.ua, SD.fa, A.p, jE, jH);
}
/* wrist (A.w) and hand axis toward the forearm (A.z) when the hand has rolled by phi around its grip G; the palm is adjusted to the
   forend height for this roll (back of the hand: A.y) */
function rollWrist(A, G, phi, F, l0) {
  A.r.setFromAxisAngle(A.a, phi);
  A.w.copy(A.d).addScaledVector(A.y, soldierLift(A.grips, A.sl, phi) - l0).applyQuaternion(A.r).add(G);
  A.z.copy(A.z0).applyQuaternion(A.r);
}
const _L = []; for (let i = 0; i < 15; i++) _L.push(new V3());
/* maximum advance of the left shoulder toward an out-of-reach support hand (m); maximum roll of a soldier's support hand around
   its grip (rad, its fixed hand does not conform to the weapon like the first-person one) */
const SOLDIER_PROT = 0.09, SOLDIER_ROLL = 0.35, _gripLw = new V3();
const _tmpA = new V3(), _tmpB = new V3(), _tmpC = new V3(), _tmpD = new V3();
function rotX(v, a) { const c = Math.cos(a), s = Math.sin(a), y = v.y * c - v.z * s, z = v.y * s + v.z * c; v.y = y; v.z = z; return v; }

const _qA = new THREE.Quaternion(), _qB = new THREE.Quaternion(), _qT = new THREE.Quaternion(), _qH = new THREE.Quaternion(), _qG = new THREE.Quaternion(), _qY = new THREE.Quaternion(), _qW = new THREE.Quaternion();
const _eu = new THREE.Euler(0, 0, 0, 'YXZ'), _tmpE = new V3(), _tmpF = new V3(), _tmpG = new V3(), _tmpH = new V3();
/* Procedural pose: walk cycle with real footfalls (a planted foot does not slide),
   pelvis that rises, shifts, pivots and tilts at each step, shoulders counter-rotating,
   weapon and arms carried by the torso with a slight lag, run with an aerial phase,
   side steps, backward walk, static and moving crouch, shuffling pivot, breathing.
   Upper body: three postures that blend into one another through springs (never a pose jump):
     aiming: stock in the hollow of the right shoulder, torso in profile (left shoulder forward), cheek on the stock,
             torso that bends to aim high or low; pistol held with both hands, arms extended;
     low carry: barrel toward the ground, across the body;
     sprint: weapon across the chest, barrel up and to the left, pumping with the strides.
   Jump: legs tucked; landing cushioned by the knees. Feet land on steps (ground height
   under each foot), the pelvis drops so the leg reaches the lower step.
   Reload: the weapon tilts, the left hand pulls the magazine, goes to the vest magazine pouch, returns,
   inserts and slaps the magazine; pump shotgun: one shuttle per shell between the belt and the loading port. */
/* Damped spring on S[k], velocity in S[v] (keys written out in full by the caller: a recomposed key, k + 'V', allocated
   a string on every call). The fields exist from the first pose (poseSoldier): a property added through a computed key
   turned the model into a dictionary, every read became a lookup and every number written an allocation. */
/* Damped spring: new velocity of a value x with velocity v pulled toward target; the caller then advances the value
   ((S.kV = sprV(S.k, S.kV, ...), S.k += S.kV * dt), which is the new value). Up to 5.4.0, spr(S, 'k', 'kV', ...) read and
   wrote S[k] through a computed key: twelve keys in the same place, access went through V8's generic path and every number written
   was allocated (about 30 KB per frame for 12 soldiers at 280 frames per second, as many small garbage collections) */
function sprV(x, v, target, stiff, damping, dt) { return v + ((target - x) * stiff - v * damping) * dt; }
/* stock butt (shoulder rest) and magazine grip (left hand) in the weapon frame: GUN_BUTT and GUN_MAGP (06j-models.js), per weapon */
const _qS = new THREE.Quaternion(), _qL = new THREE.Quaternion(), _pk = new V3(), _sLp = new V3(), _mp = new V3(), _hl = new V3(), _ft = [new V3(), new V3()];
const _gl = [new V3(), new V3()], _tl = [new V3(), new V3()], _fpG = [0, 0], _fyW = [0, 0], _qC = new THREE.Quaternion(), _qD = new THREE.Quaternion(), _qE = new THREE.Quaternion(), _qF = new THREE.Quaternion(), _qI = new THREE.Quaternion(), _vA = new V3();
/* Footing at rest: each foot stays planted on the ground (world coordinates) instead of sliding toward its place. When one
   strays too far (stopping after a run, pivot in place, posture change), it takes a real step, one foot at a
   time: it lifts, moves in an arc to its place and sets down again, toe turned the right way, while the pelvis
   shifts onto the other foot. gl: walk feet, tl: target places (body frame), fyT: target yaws (relative
   to the hips), hipW: hip yaw. Result per foot: l (position, body frame), fy (yaw), pitch. */
function footPlant(e, S, pk, dt, cy, sy, hipW, gl, tl, fyT) {
  const P = S.plant || (S.plant = [0, 1].map(() => ({ x: 0, z: 0, yaw: 0, s: -1, fx: 0, fz: 0, fyaw: 0, dur: 0.3, d0: 0, l: new V3(), fy: 0, pitch: 0 })));
  S.stepSh = 0; S.stepDip = 0;
  if (pk <= 0.001) { S.plantOn = false; return P; }
  const wx = (l) => e.pos.x + l.x * cy + l.z * sy, wz = (l) => e.pos.z - l.x * sy + l.z * cy, by = e.yaw + hipW;
  if (!S.plantOn) {
    // entering rest: feet are planted where the walk left them
    // (a foot caught in the air finishes its step from its height instead of dropping at once)
    for (let i = 0; i < 2; i++) {
      const p = P[i]; p.x = wx(gl[i]); p.z = wz(gl[i]); p.yaw = by + S.fy[i]; p.s = -1; p.l0 = Math.max(0, gl[i].y - tl[i].y);
      if (p.l0 > 0.012) { p.s = 0; p.fx = p.x; p.fz = p.z; p.fyaw = p.yaw; p.d0 = 0.1; p.dur = 0.18; }
    }
    S.plantOn = true; S.stepCd = 0.12;
  }
  let worst = -1, we = 0;
  for (let i = 0; i < 2; i++) {
    const p = P[i], tx = wx(tl[i]), tz = wz(tl[i]), ty = by + fyT[i], d = hyp(p.x - tx, p.z - tz), da = Math.abs(angDiff(p.yaw, ty));
    if (d > 0.9) { p.x = tx; p.z = tz; p.yaw = ty; p.s = -1; continue; } // teleported (respawn): no step across the map
    if (p.s >= 0) {
      p.s += dt / p.dur;
      const s = Math.min(1, p.s), k = s * s * (3 - 2 * s), side = i === 0 ? -1 : 1;
      p.x = lerp(p.fx, tx, k); p.z = lerp(p.fz, tz, k); p.yaw = p.fyaw + angDiff(p.fyaw, ty) * k;
      p.lift = Math.max(Math.sin(Math.PI * s) * Math.min(0.075, 0.03 + p.d0 * 0.2), (p.l0 || 0) * (1 - k)); p.pitch = -0.22 * Math.sin(Math.PI * s);
      S.stepSh = -side * 0.028 * Math.sin(Math.PI * s); S.stepDip = 0.01 * Math.sin(Math.PI * s);
      if (p.s >= 1) { p.s = -1; p.lift = 0; p.pitch = 0; p.l0 = 0; S.stepCd = 0.06; }
    } else {
      p.lift = 0; p.pitch = 0;
      const err = d + 0.12 * da + (da > 1.0 ? 1 : 0);
      if (err > we) { we = err; worst = i; }
    }
  }
  // one foot at a time; beyond 7 cm (or a quarter turn of the toe) it will return to its place
  S.stepCd = (S.stepCd || 0) - dt;
  if (worst >= 0 && P[0].s < 0 && P[1].s < 0 && S.stepCd <= 0 && we > 0.075) {
    const p = P[worst]; p.s = 0; p.l0 = 0; p.fx = p.x; p.fz = p.z; p.fyaw = p.yaw; p.d0 = Math.min(we, 0.5); p.dur = clamp(0.2 + p.d0 * 0.3, 0.2, 0.34);
  }
  for (let i = 0; i < 2; i++) {
    const p = P[i], ex = p.x - e.pos.x, ez = p.z - e.pos.z;
    p.l.set(ex * cy - ez * sy, tl[i].y + (p.lift || 0), ex * sy + ez * cy);
    p.fy = clamp(angDiff(by, p.yaw), -1.1, 1.1);
  }
  return P;
}
/* orientation offset from q0 to q (body frame), turned by _qF (direction of the hit) and scaled by k; result in _qE */
function hitDelta(q, q0, k) {
  _qD.copy(q).multiply(_qI.copy(q0).invert()).premultiply(_qF).multiply(_qI.copy(_qF).invert());
  return _qE.identity().slerp(_qD, k);
}
function poseSoldier(e, dt) {
  const S = e.model, J = S.J, L = _L;
  for (let i = 0; i < 15; i++) S.Jp[i].copy(J[i]);
  if (dt > 0) S.pdt = dt; // duration of this frame: the ragdoll derives the joint velocity from it
  if (S.cyc === undefined) { S.cyc = Math.random(); S.hipYaw = 0; S.aimW = 1; S.aimWV = 0; S.ld = 0; S.ldV = 0; S.wt = 0; S.wtV = 0; S.lk = 0; S.lkV = 0; S.lkp = 0; S.lkpV = 0; S.rg = 0; S.rgV = 0; S.hr = 0; S.hrV = 0; S.lean = 0; S.leanV = 0; S.sroll = 0; S.srollV = 0; S.blade = 0; S.bladeV = 0; S.twist = 0; S.twistV = 0; S.gby = 0; S.gbyV = 0; S.gbw = 0; S.gbwV = 0; S.rk = 0; S.rkV = 0; S.runW = 0; S.sprW = 0; S.airW = 0; S.lastYaw = e.yaw; S.turn = 0; S.t = Math.random() * 10; S.lastV = 0; S.fp = [0, 0]; S.fy = [0, 0]; S.fyG = [0, 0]; S.amp = 0; S.wasAir = false; S.gyL = 0; S.gyR = 0; }
  S.t += dt;
  const v = hyp(e.vel.x, e.vel.z), c = e.crouchAmt || 0, K = S.kind || 'rifle', isP = K === 'pistol';
  // clips (06ac-loco.js)
  const clipOK = locoInit();
  const cy = Math.cos(e.yaw), sy = Math.sin(e.yaw);
  const lvx = e.vel.x * cy - e.vel.z * sy, lvz = e.vel.x * sy + e.vel.z * cy;
  const dyaw = dt > 0 ? angDiff(S.lastYaw, e.yaw) / dt : 0; S.lastYaw = e.yaw;
  S.turn = damp(S.turn, v < 0.8 ? clamp(Math.abs(dyaw) / 2.5, 0, 1) : 0, 8, dt);
  const sprinting = !!e.sprinting && v > 2.5;
  const aiming = e.isPlayer ? !PL.sprinting : !sprinting && ((e.visible && e.target && e.target.alive) || MATCH.time - e.lastShotT < 1.2 || MATCH.time - e.lastSeenT < 3 || (e.arms && e.arms.adsW > 0.5));
  // shouldering: lively, barely underdamped spring (the weapon reaches the target and settles), slower lowering
  S.aimWV = sprV(S.aimW, S.aimWV, aiming ? 1 : 0, aiming ? 120 : 34, aiming ? 17 : 11, dt); S.aimW += S.aimWV * dt; S.aimW = clamp(S.aimW, -0.05, 1.05);
  S.sprW = damp(S.sprW, sprinting ? 1 : 0, sprinting ? 6 : 8, dt);
  S.runW = damp(S.runW, clamp((v - 3.8) / 1.3, 0, 1) * (1 - c), 5, dt);
  // in the air: legs tucked; on landing, the knees cushion (spring on the pelvis height)
  const air = e.onGround === false;
  S.airW = damp(S.airW, air ? 1 : 0, air ? 9 : 16, dt);
  const landed = S.wasAir && !air;
  if (landed) { S.ldV = (S.ldV || 0) - clamp(-(S.airVy || 0) * 0.16, 0.35, 1.6); }
  if (clipOK) locoAirT(S, air, landed, e.vy || 0, S.airVy || 0, dt);
  S.wasAir = air; S.airVy = e.vy || 0;
  const land = (S.ldV = sprV(S.ld, S.ldV, 0, 170, 13, dt), S.ld += S.ldV * dt);
  const run = S.runW, aw = smoothstep(0, 1, clamp(S.aimW, 0, 1)), sw = smoothstep(0, 1, S.sprW) * (1 - aw), airW = S.airW;
  const acc = dt > 0 ? (v - S.lastV) / dt : 0; S.lastV = v;
  // overall cycle amplitude (0 at rest, 1 walking), smoothed for soft starts and stops
  // (pivot in place: standing, the planted feet take the real steps, see footPlant; crouched, the cycle shuffles)
  S.amp = damp(S.amp, Math.max(clamp(v / 2.2, 0, 1), S.turn * 0.5 * c) * (1 - airW), 6, dt);
  const amp = S.amp;
  // ---- clip-based locomotion (06ac-loco.js) for rifle bots: kc, clip share; ka, that share blended with the amplitude due to
  //      speed (ampV: at rest, posture and planted feet stay procedural, like the shuffling of a crouched pivot); ampP, what
  //      remains of the procedural cycle; wf, clip share in the cycle
  S.ampV = damp(S.ampV || 0, clamp(v / 2.2, 0, 1) * (1 - airW), 6, dt);
  const kc = clipOK ? 1 - airW : 0, ampV = Math.min(S.ampV, amp), ka = kc * ampV, ampP = amp - ka;
  const wf = amp > 1e-3 ? ka / amp : kc;
  // ---- combat stance at rest: knees bent over the toes, pelvis low and back, torso forward
  //      (more pronounced when aiming); st is 1 at rest, standing
  const st = (1 - amp) * (1 - c) * (1 - airW);
  // ---- idle life: weight shifts from one leg to the other, gaze sweeping the surroundings, weapon readjusted
  const idle = (1 - amp) * (1 - c * 0.5) * (1 - airW);
  if ((S.wtClk = (S.wtClk || 0) - dt) <= 0) { S.wtClk = rand(2.4, 5.8); S.wtT = (S.wtT > 0 ? -1 : 1) * rand(0.45, 1); }
  if ((S.lkClk = (S.lkClk || 0) - dt) <= 0) {
    S.lkClk = rand(1.4, 4.2); S.lkT = Math.random() < 0.3 ? 0 : rand(-0.75, 0.75); S.lkP = rand(-0.14, 0.1);
    if (!aiming && Math.random() < 0.35) S.rgV = (S.rgV || 0) + 3.2; // readjusts the weapon in hand
  }
  const wt = (S.wtV = sprV(S.wt, S.wtV, (S.wtT || 0) * idle * (1 - 0.5 * clamp(S.aimW, 0, 1)), 13, 7.2, dt), S.wt += S.wtV * dt);
  const look = (S.lkV = sprV(S.lk, S.lkV, (S.lkT || 0) * idle * (1 - clamp(S.aimW, 0, 1)), 26, 9.5, dt), S.lk += S.lkV * dt), lookP = (S.lkpV = sprV(S.lkp, S.lkpV, (S.lkP || 0) * idle * (1 - clamp(S.aimW, 0, 1)), 26, 9.5, dt), S.lkp += S.lkpV * dt);
  const regrip = (S.rgV = sprV(S.rg, S.rgV, 0, 95, 9, dt), S.rg += S.rgV * dt);
  // ---- impact: the body takes the hit in the direction of fire (damped impulse: it goes, overshoots slightly, returns)
  const kick = S.hitKick || 0;
  if (kick) { S.hrV = (S.hrV || 0) + 11 * kick; S.hitKick = 0; }
  const hr = (S.hrV = sprV(S.hr, S.hrV, 0, 150, 11.5, dt), S.hr += S.hrV * dt);
  let hx = 0, hz = 1;
  if (S.hitDir) { hx = S.hitDir.x * cy - S.hitDir.z * sy; hz = S.hitDir.x * sy + S.hitDir.z * cy; const l = hyp(hx, hz) || 1; hx /= l; hz /= l; }
  // clips: hit received as an additive layer (06ac-loco.js)
  if (clipOK && kick) locoHitStart(S, kick, hx, hz);
  const HIT = clipOK ? locoHit(S, dt, LOCO.mh) : null;
  if (HIT) _qF.setFromAxisAngle(UP, S.hA);
  // ---- firing recoil: the shoulder and torso absorb each shot
  const rec = e.recoil || 0;
  // movement direction in the body frame
  let dx = 0, dz = -1;
  if (v > 0.25) { dx = lvx / v; dz = lvz / v; S.lth = Math.atan2(-lvx, -lvz); } else if (S.turn > 0.05) { dx = Math.sign(dyaw) * -1; dz = 0; }
  const fwdc = -dz, back = smoothstep(-0.2, -0.6, fwdc);
  // stride and cadence: the ground foot moves back at exactly the body's speed
  const A = (lerp(0.17, 0.33, clamp(v / 4.5, 0, 1)) + run * 0.06) * (1 - c * 0.3) * (1 - back * 0.25) * Math.max(amp, 0.001);
  const D = lerp(lerp(0.62, 0.44, clamp(v / 5, 0, 1)), 0.36, run);
  let rate = v > 0.25 ? (D * v) / Math.max(0.06, 2 * A) : (S.turn > 0.05 ? 1.3 : 0);
  // clips: the stride is the clip's (reduced with the amplitude), the cadence follows the speed
  const useC = ka > 1e-3;
  if (useC) { locoSel(v, S.lth || 0, sw, c, isP); rate = lerp(rate, v / (LOCO.L * LOCO.k * Math.max(ampV, 0.15)), wf); }
  S.cyc = (S.cyc + Math.min(rate, 2.7) * dt * (1 - airW)) % 1;
  const LM = useC ? locoPose(S.cyc, LOCO.m) : null;
  // jump: clip pose in the air (share kA), pelvis dip and flexion on landing (REC); slide (S.slT, time since its start; the
  // player slides, a remote player sends e.slide): either one overlays the pose (OV, share kO)
  const LA = clipOK && airW > 0.01 ? locoAirPose(S, LOCO.ma) : null, kA = LA ? airW : 0, REC = clipOK ? locoRec(S, LOCO.mr) : null;
  const slOn = e.isRemote ? !!e.slide : (e.slideT || 0) > 0;
  S.slT = slOn ? (S.slOn ? S.slT + dt : 0) : S.slT || 0; S.slOn = slOn;
  const kS = clipOK ? clamp(e.slideAmt || 0, 0, 1) : 0, LS = kS > 0.01 ? locoSlidePose(S.slT, LOCO.ms) : null;
  const OV = LS && kS > kA ? LS : LA, kO = OV === LS ? kS : kA;
  const TW = TAU * S.cyc, mid = TW - D * Math.PI;
  // pelvis (aiming at rest, the hips fade out to the right with the torso)
  const stanceYaw = -0.3 * aw * (1 - amp) * (isP ? 0.4 : 1);
  // when side-stepping, the hips open decisively toward the movement (the legs walk in their axis, without crossing)
  // while the torso stays facing the target
  const latK = Math.abs(dx) * clamp(v / 1.5, 0, 1);
  const hipT = lerp(v > 0.5 ? clamp(-dx * (fwdc >= -0.25 ? 1 : -1) * 1.0, -1.0, 1.0) : stanceYaw, stanceYaw, kc); // clips: their hips
  S.hipYaw = damp(S.hipYaw, hipT, 10, dt);
  const steady = 1 - aw * 0.65; // aiming: braced torso, steady weapon, only the legs work
  S.flinch = damp(S.flinch || 0, 0, 9, dt);
  const bob = Math.cos(2 * mid) * lerp(0.013, 0.03, run) * ampP * lerp(1, 0.6, aw);
  const shift = -Math.cos(mid) * lerp(0.02, 0.012, run) * ampP * (1 - c * 0.5);
  const pYaw = -Math.cos(TW) * lerp(0.09, 0.14, run) * ampP;
  // hip on the side of the supporting leg higher (contrapposto), the other knee relaxes
  const pRoll = -Math.cos(mid) * 0.045 * ampP * (1 - run * 0.4) + wt * 0.05;
  // torso: leaning with effort and acceleration, bent to aim high or low, shoulders counter-rotating, profile when aiming
  const gp = clamp(e.pitch, -1.1, 1.1);
  const leanT = 0.05 + 0.08 * ampP + (0.26 * run + 0.04 * sw) * (1 - kc) + 0.22 * c * (1 - ka) - 0.12 * back * ampP + clamp(acc * 0.045, -0.15, 0.18) - hr * hz * 0.5 - gp * 0.38 * aw + 0.18 * airW * (1 - kA)
    + st * (0.07 + 0.07 * aw) - rec * 2.2 + lookP * 0.3;
  const lean = (S.leanV = sprV(S.lean, S.leanV, leanT, 150, 19, dt), S.lean += S.leanV * dt);
  const strafeRoll = (S.srollV = sprV(S.sroll, S.srollV, -dx * 0.14 * clamp(v / 3, 0, 1) * (1 - run * 0.4) * (1 - kc) - hr * hx * 0.4, 140, 18, dt), S.sroll += S.srollV * dt);
  const blade = (S.bladeV = sprV(S.blade, S.bladeV, (isP ? -0.15 : -0.62) * aw + -0.12 * (1 - aw) * (1 - sw), 90, 16, dt), S.blade += S.bladeV * dt); // torso in profile when aiming
  const twist = (S.twistV = sprV(S.twist, S.twistV, -pYaw * lerp(1.25, 0.95, aw) - S.hipYaw * lerp(0.35, -0.2, latK) + blade - stanceYaw + look * 0.3 - rec * 1.6 - hr * hx * 0.3, 180, 20, dt), S.twist += S.twistV * dt);
  const roll = (strafeRoll - pRoll * 0.8 + shift * 0.8) * lerp(1, 0.6, aw) - wt * 0.02;
  const breath = Math.sin(S.t * 1.7) * 0.008 * (1 - amp);
  const idleSway = Math.sin(S.t * 0.45) * 0.012 * (1 - amp);
  let pelY = lerp(SD.pel - 0.015 - st * (0.026 + 0.012 * aw), 0.62, c) - hr * 0.045 + bob - (0.035 * aw + 0.02) * ampP - run * 0.04 * (1 - kc) + Math.sin(S.t * 0.6) * 0.002 + (clipOK ? 0 : land * 0.13) - airW * 0.03;
  // clips: their pelvis, raised standing as much as the legs allow (5 cm at most), lowered crouched (more when aiming) to
  // keep the head at the height of the procedural crouch (bots' eye, cover, hit zones)
  if (LM) pelY += ka * (LM.pel.y + lerp(c < 1 ? locoLift(S.cyc) : 0, LOCO_CDY[0] + LOCO_CDY[1] * aw, c) - lerp(SD.pel - 0.015, 0.62, c));
  if (REC) pelY += S.rK * (REC.pel.y - LOCO.rec0.pel.y);
  // feet on the real ground (steps, sidewalks): ground height under each foot, the pelvis drops for the lowest leg
  const gL = e.onGround !== false ? S.gyL : 0, gR = e.onGround !== false ? S.gyR : 0;
  pelY += Math.min(0, Math.min(gL, gR)) * 0.95 + Math.max(0, Math.min(gL, gR)) * 0.5;
  // pelvis toward the supporting leg, and behind the feet in combat stance (rear back, weight on the ball of the foot)
  L[J_PEL].set(shift + idleSway + wt * 0.032 + (S.stepSh || 0) + (LM ? ka * LM.pel.x : 0), pelY - (S.stepDip || 0), st * (0.025 + 0.01 * aw) + (LM ? ka * LM.pel.z : 0));
  _eu.set(0, S.hipYaw + pYaw, pRoll); _qY.setFromEuler(_eu);
  if (LM) _qY.slerp(LM.qP, ka);
  // the impact also goes directly into the torso (without the springs' filter): the hit reads immediately
  _eu.set(-lean + hr * hz * 0.32, pYaw + twist, roll - hr * hx * 0.28); _qT.setFromEuler(_eu);
  if (LM) {
    // clip torso (without the mean yaw it holds when aiming: the aiming profile replaces it), calmer when aiming and sprinting,
    // then the intent terms (yaw, then lean and roll) on top
    _qC.setFromAxisAngle(UP, -LOCO.ty * aw).multiply(LM.qT); _qD.identity().slerp(_qC, ka * (1 - 0.3 * aw) * (1 - 0.4 * sw));
    _eu.set(0, pYaw + twist, 0); _qT.setFromEuler(_eu).multiply(_qD);
    _eu.set(-lean + hr * hz * 0.32, 0, roll - hr * hx * 0.28); _qT.multiply(_qD.setFromEuler(_eu));
  }
  if (OV) {
    // in the air or sliding: clip pelvis, hips and torso, composed like those of locomotion
    L[J_PEL].lerp(_vA.copy(OV.pel), kO); _qY.slerp(OV.qP, kO);
    _eu.set(0, pYaw + twist, 0); _qD.setFromEuler(_eu).multiply(OV.qT);
    _eu.set(-lean + hr * hz * 0.32, 0, roll - hr * hx * 0.28); _qD.multiply(_qE.setFromEuler(_eu)); _qT.slerp(_qD, kO);
    if (OV === LS) locoSlideUp(_qT, L[J_PEL].y, kO); // slide: head near 0.85 m, like the player's camera
  }
  // landing: clip torso flexion (in its own frame), scaled by the fall
  if (REC) { _qD.copy(LOCO.rec0.qT).invert().multiply(REC.qT); _qT.multiply(_qE.identity().slerp(_qD, S.rK)); }
  // hit received: clip offset from its first frame, turned toward the direction of fire and scaled by the hit (pelvis, hips, torso)
  if (HIT) {
    L[J_PEL].add(_vA.subVectors(HIT.pel, LOCO.hit0.pel).applyQuaternion(_qF).multiplyScalar(S.hK));
    _qY.premultiply(hitDelta(HIT.qP, LOCO.hit0.qP, S.hK)); _qT.premultiply(hitDelta(HIT.qT, LOCO.hit0.qT, S.hK));
  }
  // grenade throw and reload (except pump shotgun): clip torso twist, hands stay those of the game
  if (clipOK) {
    const RLg = e.arms && e.arms.reload, thr = e.throwT > 0, tt = thr ? 1 - e.throwT / 0.7 : RLg && !RLg.tube ? rhythm3p(RLg.t / RLg.dur) : -1;
    const G = tt >= 0 ? locoGesture(thr, tt, LOCO.mx) : null;
    if (G) {
      const w = (thr ? 0.8 : 0.6) * smoothstep(0, 0.08, tt) * (1 - smoothstep(0.92, 1, tt));
      _qD.copy(G.qT).multiply(_qI.copy(LOCO.x0.qT).invert()); _qT.premultiply(_qE.identity().slerp(_qD, w));
    }
  }
  L[J_CHE].set(0, SD.trunk + breath, 0).applyQuaternion(_qT).add(L[J_PEL]);
  const hunch = 0.02 + 0.03 * run + 0.02 * amp;
  const shc = _tmpA.set(0, SD.shY, -hunch).applyQuaternion(_qT).add(L[J_CHE]);
  L[J_SHL].set(-SD.shX, breath * 0.6, SD.shZ).applyQuaternion(_qT).add(shc); L[J_SHR].set(SD.shX, breath * 0.6 + 0.03 * aw * (isP ? 0 : 1), SD.shZ + rec * (isP ? 0.2 : 0.5)).applyQuaternion(_qT).add(shc);
  // head: compensates the torso to keep the gaze on the target; when aiming, cheek on the stock (head forward, lowered, tilted).
  // _qH is the head orientation in the body frame (not the torso's): its yaw keeps only a share of the torso's (when
  // aiming, none: the gaze follows the weapon; before, -tY counted it twice and the head looked 30 degrees left of the weapon)
  const tY = pYaw + twist;
  _eu.set(clamp(gp * 0.55, -0.45, 0.5) + lean * -0.62 - bob * 0.8 + 0.1 * aw * (isP ? 0 : 1) + lookP - hr * hz * (S.hitHead ? 0.9 : 0.35) + rec * 0.8,
    tY * lerp(0.3, 0, aw) + look - hr * hx * (S.hitHead ? 0.6 : 0.2), -roll * 0.7 - 0.22 * aw * (isP ? 0.2 : 1) + hr * hx * 0.25); _qH.setFromEuler(_eu);
  // (the clip head starts 30 degrees back: reduced, the impact spring already shakes it, and a second shot must remain possible)
  if (HIT) _qH.premultiply(hitDelta(HIT.qH, LOCO.hit0.qH, S.hK * (S.hitHead ? 0.6 : 0.35)));
  L[J_HEAD].set(0.05 * aw * (isP ? 0 : 1), SD.head[1] - 0.035 * aw * (isP ? 0.3 : 1), SD.head[2] - hunch * 0.4 - 0.025 * aw).applyQuaternion(_qH).add(L[J_CHE]);
  // ---- weapon: three blended postures
  const gunBobY = (S.gbyV = sprV(S.gby, S.gbyV, -bob * lerp(0.8, 0.25, aw), 220, 18, dt), S.gby += S.gbyV * dt), gunBobYaw = (S.gbwV = sprV(S.gbw, S.gbwV, (pYaw + twist - blade) * 0.35 * steady, 200, 18, dt), S.gbw += S.gbwV * dt);
  // aiming: gaze orientation; stock in the hollow of the right shoulder (rifles) or pistol with arms extended
  _eu.set(gp + gunBobY * 0.3 + hr * 0.22 + rec * 1.2, gunBobYaw * 0.45 - hr * hx * 0.18, roll * 0.25 - 0.04); _qA.setFromEuler(_eu);
  const aimP = _tmpB;
  if (!isP) {
    const bt = S.grips.butt;
    _pk.set(-0.045, 0.065, -0.035).applyQuaternion(_qT).add(L[J_SHR]);
    aimP.set(bt[0], bt[1], bt[2] - rec * 0.6).applyQuaternion(_qA).negate().add(_pk);
  } else aimP.set(0.02, 0.16, -0.46 + rec * 0.5).applyQuaternion(_qA).add(shc);
  aimP.y += gunBobY * 0.4;
  // low carry: barrel toward the ground, across the body
  const pump = Math.sin(TW) * run;
  _eu.set(-0.55 - run * 0.1 + gunBobY * 2.5 + pump * 0.06 + regrip * 0.22 - st * 0.08, (isP ? 0.2 : 0.5) + pump * 0.1, (isP ? 0.1 : 0.3) + roll * 1.2 - regrip * 0.12); _qB.setFromEuler(_eu); _qB.premultiply(_qT);
  const lowP = _tmpE.set(isP ? 0.02 : 0.03, isP ? -0.1 : -0.17, isP ? -0.3 : -0.27).applyQuaternion(_qT).add(shc);
  lowP.y += gunBobY + regrip * 0.025;
  // sprint: across the chest, barrel up and to the left, pumping with the strides
  const sp2 = Math.sin(TW) * sw, sp1 = Math.cos(2 * TW) * sw;
  _eu.set(isP ? -0.9 : 0.42 + sp1 * 0.08, isP ? 0.25 : 1.05 + sp2 * 0.12, isP ? 0.2 : -0.35 + sp2 * 0.18); _qS.setFromEuler(_eu); _qS.premultiply(_qT);
  _sLp.set((isP ? 0.14 : -0.02) + sp2 * 0.03, (isP ? -0.26 : -0.14) + sp1 * 0.025, isP ? -0.14 : -0.24).applyQuaternion(_qT).add(shc);
  const gunP = _tmpF.lerpVectors(lowP, aimP, aw).lerp(_sLp, sw);
  // shouldering / lowering: the weapon swings in an arc in front of the torso (not through it), barrel leading
  const arcK = Math.sin(Math.PI * clamp(S.aimW, 0, 1)) * (1 - sw) * (isP ? 0.6 : 1);
  gunP.add(_tmpG.set(0.01, 0.035, -0.08).applyQuaternion(_qT).multiplyScalar(arcK));
  _qG.slerpQuaternions(_qB, _qA, aw).slerp(_qS, sw);
  // in the air: the weapon rises slightly, on landing it sinks with the torso
  gunP.y += land * 0.08 + airW * 0.02;
  // ---- reload: the weapon tilts toward the body, the left hand makes the trip magazine, magazine pouch, insertion
  const RL = e.arms && e.arms.reload;
  let relK = 0, handL = null;
  if (RL) {
    const tube = RL.tube, tt = tube ? (RL.phase === 'shell' ? RL.t / 0.46 : RL.phase === 'end' ? 1 : 0) : rhythm3p(RL.t / RL.dur); // rhythm: 06d-reload.js
    relK = tube ? 1 - smoothstep(0.8, 1, RL.phase === 'end' ? 1 : 0) : smoothstep(0, 0.12, tt) * (1 - smoothstep(0.86, 1, tt));
    relK = (S.rkV = sprV(S.rk, S.rkV, relK, 260, 24, dt), S.rk += S.rkV * dt); // the weapon flips with a sharp jerk
    _qL.setFromAxisAngle(_tmpG.set(0, 0, -1), 0.6 * relK); _qG.multiply(_qL);
    _qL.setFromAxisAngle(_tmpG.set(1, 0, 0), 0.22 * relK); _qG.multiply(_qL);
    gunP.addScaledVector(_tmpG.set(-0.03, 0.04, 0.07).applyQuaternion(_qT), relK);
    const mg = S.grips.magP, magW = _mp.set(mg[0], mg[1], mg[2]).applyQuaternion(_qG).add(gunP);
    const pouch = _pk.set(tube ? -0.14 : -0.02, tube ? -0.36 : -0.3, tube ? -0.05 : -0.22).applyQuaternion(_qT).add(shc);
    let k = 0;
    if (tube) k = RL.phase === 'shell' ? Math.sin(clamp(tt, 0, 1) * Math.PI) : 0;
    else k = tt < 0.14 ? 0 : tt < 0.3 ? smoothstep(0.14, 0.3, tt) : tt < 0.5 ? 1 : tt < 0.62 ? 1 - smoothstep(0.5, 0.62, tt) : 0;
    const atMag = tube ? relK : smoothstep(0.05, 0.14, tt) * (1 - smoothstep(0.7, 0.84, tt));
    handL = _hl.copy(magW).lerp(pouch, k);
    handL.y += Math.sin(S.t * 11) * 0.006 * k;
    if (!tube && tt > 0.62 && tt < 0.72) handL.y += Math.sin((tt - 0.62) / 0.1 * Math.PI) * 0.03; // slaps under the magazine
    S.relAt = atMag;
  }
  // ---- wrists: the hand closes on the grip (first-person hand frame), the wrist is set back
  const HF = soldierHandFrames(S);
  const wR = _tmpC.copy(HF[1].off).negate().add(_tmpH.set(0, 0, WRIST_OFF)).applyQuaternion(HF[1].q).add(S.grips.R).applyQuaternion(_qG).add(gunP);
  const wL = _tmpD.copy(HF[0].off).negate().add(_tmpH.set(0, 0, WRIST_OFF)).applyQuaternion(HF[0].q).add(S.grips.L).applyQuaternion(_qG).add(gunP);
  // forend out of reach of the left arm: the shoulder moves toward the hand (shoulder blade), then the hand moves back along the forend
  // (gunGrips: without leaving it or approaching the magazine)
  const gripW = _gripLw.copy(S.grips.L).applyQuaternion(_qG).add(gunP); _ar.sl = 0; _ar.grips = S.grips;
  if (!isP) {
    const reach = (SD.ua + SD.fa) * 0.95, toW = _tmpG.subVectors(wL, L[J_SHL]), d0 = toW.length();
    if (d0 > reach) {
      const pr = Math.min(d0 - reach, SOLDIER_PROT); L[J_SHL].addScaledVector(toW.normalize(), pr);
      const ax = _tmpH.set(0, 0, 1).applyQuaternion(_qG), c = -ax.dot(toW), sl = c > 0.2 ? Math.min((d0 - pr - reach) / c, S.grips.slide || 0) : 0;
      if (sl > 0) {
        wL.addScaledVector(ax, sl); gripW.addScaledVector(ax, sl); _ar.sl = sl;
        // the palm follows the forend height (back of the hand: y of the hand frame)
        wL.addScaledVector(_tmpH.set(0, 1, 0).applyQuaternion(HF[0].q).applyQuaternion(_qG), soldierLift(S.grips, sl) - soldierLift(S.grips, 0));
      }
    }
  }
  if (handL) wL.lerp(handL, clamp(S.relAt || 0, 0, 1));
  // grenade throw: right arm cocked behind the head then thrown forward, torso twisting
  if (e.throwT > 0) {
    e.throwT -= dt;
    const tt = 1 - e.throwT / 0.7, h = keySpline([[0, 0.2, -0.05, -0.1], [0.3, 0.3, 0.3, 0.25], [0.48, 0.28, 0.34, 0.2], [0.66, 0.08, 0.22, -0.45], [1, 0.16, -0.2, -0.3]], tt);
    wR.copy(h.applyQuaternion(_qT).add(shc));
  }
  const elbowOut = 0.9 + 0.35 * run;
  _qW.copy(_qG).multiply(HF[1].q);
  // right elbow: when aiming it barely spreads and stays lower than the shoulder (arm bent downward, not horizontal)
  armToGrip(L[J_SHR], wR, _tmpH.copy(S.grips.R).applyQuaternion(_qG).add(gunP), _qW, _pz.c.set(elbowOut - 0.1 * aw, -0.45 - 0.25 * aw, 0.12).applyQuaternion(_qT).add(L[J_SHR]), e.throwT > 0 ? 0 : 1, L[J_ELR], L[J_HAR], lerp(0.75, 0.45, aw));
  _qW.copy(_qG).multiply(HF[0].q);
  // left elbow: under the forend, lower than the shoulder
  (HF[0].axis && !isP ? armToGripRoll : armToGrip)(L[J_SHL], wL, gripW, _qW, _pz.c.set(-elbowOut * 0.9 + 0.3 * aw, -0.6 - 0.35 * aw, -0.05).applyQuaternion(_qT).add(L[J_SHL]), 1 - clamp(S.relAt || 0, 0, 1) * (handL ? 1 : 0), L[J_ELL], L[J_HAL], lerp(0.75, 0.4, aw), HF[0]);
  // ---- legs: stance (foot fixed on the ground) then swing (foot raised in an arc), heel then toe; tucked in the air
  const lift0 = lerp(0.13, 0.26, run) * (1 - c * 0.5);
  const blP = isP ? 0.3 : 1; // pistol: front-facing shot (isosceles), feet at almost the same height
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    const u = (S.cyc + i * 0.5) % 1;
    let off, lift = 0, pitch = 0;
    if (u < D) { const k = u / D; off = A * (1 - 2 * k); pitch = k > 0.75 ? -((k - 0.75) / 0.25) * 0.55 : (k < 0.12 ? (1 - k / 0.12) * 0.25 : 0); }
    else { const k = (u - D) / (1 - D), ks = k * k * (3 - 2 * k); off = -A + 2 * A * ks; lift = Math.sin(Math.PI * k) * lift0 * Math.min(1, amp * 1.5) + (run * 0.12 * Math.sin(Math.PI * Math.min(1, k * 1.6))); pitch = k < 0.35 ? -0.5 * (1 - k / 0.35) : 0.25 * smoothstep(0.6, 1, k); }
    const moveC = Math.min(1, v / 1.5);
    // stance: slightly wider than the shoulders, left foot forward, right foot back (more when aiming);
    // the free foot (weight transfer) moves forward and opens slightly
    const free = Math.max(0, -wt * side);
    const baseX = side * (lerp(0.16 + 0.015 * aw, 0.11, amp) + free * 0.015), baseZ = ((side > 0 ? 0.075 + 0.045 * aw * blP : -0.075 - 0.045 * aw * blP) - free * 0.03) * (1 - amp);
    const cbx = side * 0.15, cbz = lerp(side < 0 ? -0.24 : 0.32, side < 0 ? -0.08 : 0.12, moveC);
    const bxL = lerp(baseX, cbx, c), bzL = lerp(baseZ, cbz, c);
    // planted foot in the body frame (the pelvis turns above the foot)
    _tmpG.set(bxL, 0, bzL);
    if (S.hipYaw) _tmpG.applyAxisAngle(UP, S.hipYaw);
    const gy = i === 0 ? gL : gR;
    const fyS = lerp(0.077, side < 0 ? 0.077 : lerp(0.097, 0.077, moveC), c) + gy;
    _tl[i].set(_tmpG.x + idleSway * 0.3, fyS, _tmpG.z); // target place at rest
    _gl[i].set(_tmpG.x + dx * off * (1 - airW) + idleSway * 0.3, fyS + lift + airW * (side < 0 ? 0.3 : 0.22), _tmpG.z + dz * off * (1 - airW) + airW * (side < 0 ? -0.1 : 0.06));
    // toes turned out (rear foot in profile when aiming, especially at rest)
    const out = 0.07 + st * (side > 0 ? 0.16 + 0.26 * aw * blP : 0.08 + 0.05 * aw) + free * 0.1;
    S.fyG[i] = damp(S.fyG[i], -side * out * (1 - airW), 10, dt);
    _fpG[i] = (pitch * Math.min(1, amp * 1.3) * (1 - c * 0.5)) * (1 - airW) - 0.35 * airW;
    _fyW[i] = S.fyG[i];
    if (LM) {
      // clip foot, set on the real ground, that moves away from its place at rest with the cycle amplitude (the foot lift, however, stays
      // full from low speeds: it does not scrape the ground)
      const yl = Math.min(1, ampV * 1.5);
      _tmpG.set(lerp(_tl[i].x, LM.ft[i].x, ampV), lerp(_tl[i].y, LM.ft[i].y + gy, yl), lerp(_tl[i].z, LM.ft[i].z, ampV)); _gl[i].lerp(_tmpG, wf);
      _fpG[i] = lerp(_fpG[i], LM.fp[i] * ampV, wf); _fyW[i] = lerp(S.fyG[i], LM.fy[i], ka);
    }
    if (OV) { _gl[i].lerp(_vA.copy(OV.ft[i]), kO); _fpG[i] = lerp(_fpG[i], OV.fp[i], kO); _fyW[i] = lerp(_fyW[i], OV.fy[i], kO); }
  }
  // at rest: feet planted on the ground (they no longer slide), a real step when one strays too far from its place
  // (according to actual speed: as soon as it brakes, the feet plant, without waiting for the stride to end)
  const pk = (1 - smoothstep(0.08, 0.35, clamp(v / 2.2, 0, 1))) * (1 - airW) * (1 - smoothstep(0.3, 0.6, c));
  const PLT = footPlant(e, S, pk, dt, cy, sy, S.hipYaw + pYaw, _gl, _tl, S.fyG);
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1, hip = L[i === 0 ? J_HIL : J_HIR], knee = L[i === 0 ? J_KNL : J_KNR], foot = L[i === 0 ? J_FTL : J_FTR];
    hip.set(side * SD.hipX, SD.hipY, 0).applyQuaternion(_qY).add(L[J_PEL]);
    _tmpG.lerpVectors(_gl[i], PLT[i].l, pk);
    _ft[i].copy(_tmpG);
    S.fy[i] = lerp(_fyW[i], PLT[i].fy, pk);
    // the knee follows the toe, slightly outward (clips: their knee direction, pelvis frame)
    _pz.c.set(side * (0.06 + 0.2 * st), -0.1, -1).applyAxisAngle(UP, S.fy[i]);
    if (LM) _pz.c.lerp(LM.kn[i], ka);
    if (OV) _pz.c.lerp(OV.kn[i], kO);
    ik2(hip, _tmpG, SD.thigh, SD.shin, _pz.c.applyQuaternion(_qY).add(hip), knee, foot);
    S.fp[i] = damp(S.fp[i], lerp(_fpG[i], PLT[i].pitch, pk), 20 + 100 * Math.max(wf, kO), dt);
  }
  // ground height under each foot (for the next frame), smoothed so it does not jump from one step to another
  if (e.onGround !== false) for (let i = 0; i < 2; i++) {
    const f = _ft[i], wx = e.pos.x + f.x * cy + f.z * sy, wz = e.pos.z - f.x * sy + f.z * cy;
    const gh = groundHeight(wx, wz, e.pos.y + 0.35, 0.06), g = VOID.on && gh <= VOID.floor + 1 ? 0 : clamp(gh - e.pos.y, -0.4, 0.35); // at the edge of a drop, the foot stays flat
    if (i === 0) S.gyL = damp(S.gyL, g, 18, dt); else S.gyR = damp(S.gyR, g, 18, dt);
  }
  // switch to world coordinates
  for (let i = 0; i < 15; i++) { const l = L[i]; J[i].set(e.pos.x + l.x * cy + l.z * sy, e.pos.y + l.y, e.pos.z - l.x * sy + l.z * cy); }
  _eu.set(0, e.yaw, 0); _qW.setFromEuler(_eu);
  S.headQ = (S.headQ || new THREE.Quaternion()).copy(_qW).multiply(_qH).multiply(soldierRest().q[SB.HEA]);
  S.gun.position.set(e.pos.x + gunP.x * cy + gunP.z * sy, e.pos.y + gunP.y, e.pos.z - gunP.x * sy + gunP.z * cy);
  S.gun.quaternion.copy(_qW).multiply(_qG);
  e.recoil = damp(e.recoil || 0, 0, 18, dt);
}

function animSoldier(e, dt) {
  const S = e.model;
  if (e.alive) {
    S.sink = 0; S.rag = null; S.root.visible = true; e.voidDead = false; if (S.gun) S.gun.visible = true; // the weapon leaves the body on death (dropKilledWeapon)
    poseSoldier(e, dt);
    layoutSoldier(S, true);
  } else if (e.respawnT === Infinity || S.cyc === undefined) {
    // bot out of play (removed from the deathmatch: modeRoster; inactive online: netBotOff, startMatch): no body. The end of a killcam and
    // the end screen animate all the dead: it appeared standing in its last pose (at the center of the map if it had not played),
    // and, its update stopping there (updateBot), stayed there until the end of the match.
    // Never posed (S.cyc, see poseSoldier): a remote player or bot already dead when joining the match. Its ragdoll would start from the
    // model's rest pose, at the center of the map: no body until it respawns
    S.rag = null; S.root.visible = false;
  } else {
    if (!S.rag) startRagdoll(e);
    stepRagdoll(e, dt);
    S.sink = e.respawnT !== undefined && e.respawnT < 0.9 && MATCH.state === 'playing' ? (0.9 - e.respawnT) * 0.9 : 0;
    layoutSoldier(S, false);
    S.root.visible = !e.voidDead && !(e.respawnT !== undefined && e.respawnT < 0.1 && MATCH.state === 'playing'); // fell into the void: no body
  }
}

/* ---------- Hitboxes ---------- */
const HB = [{ y: 1.63, r: 0.15, part: 'head' }, { y: 1.34, r: 0.24, part: 'body' }, { y: 1.06, r: 0.23, part: 'body' }, { y: 0.72, r: 0.19, part: 'legs' }, { y: 0.34, r: 0.17, part: 'legs' }];
const HS = []; for (let i = 0; i < 11; i++) HS.push({ c: new V3(), r: 0, part: 'body' });
function hitSpheres(e) {
  if (!e.model || e.isPlayer) {
    const k = 1 - (e.crouchAmt || 0) * 0.33;
    for (let i = 0; i < HB.length; i++) { HS[i].c.set(e.pos.x, e.pos.y + HB[i].y * k, e.pos.z); HS[i].r = HB[i].r; HS[i].part = HB[i].part; }
    return HB.length;
  }
  const J = e.model.J; let n = 0;
  const s = (c, r, part) => { HS[n].c.copy(c); HS[n].r = r; HS[n].part = part; n++; };
  s(_tmpA.copy(J[J_HEAD]).add(_tmpB.set(0, 0.02, 0)), 0.155, 'head');
  s(_tmpA.lerpVectors(J[J_PEL], J[J_CHE], 0.72), 0.24, 'body');
  s(_tmpA.lerpVectors(J[J_PEL], J[J_CHE], 0.22), 0.22, 'body');
  s(_tmpA.lerpVectors(J[J_HIL], J[J_KNL], 0.5), 0.11, 'legs'); s(_tmpA.lerpVectors(J[J_KNL], J[J_FTL], 0.5), 0.1, 'legs');
  s(_tmpA.lerpVectors(J[J_HIR], J[J_KNR], 0.5), 0.11, 'legs'); s(_tmpA.lerpVectors(J[J_KNR], J[J_FTR], 0.5), 0.1, 'legs');
  s(_tmpA.lerpVectors(J[J_SHL], J[J_ELL], 0.5), 0.08, 'legs'); s(_tmpA.lerpVectors(J[J_SHR], J[J_ELR], 0.5), 0.08, 'legs');
  s(_tmpA.lerpVectors(J[J_ELL], J[J_HAL], 0.5), 0.07, 'legs'); s(_tmpA.lerpVectors(J[J_ELR], J[J_HAR], 0.5), 0.07, 'legs');
  return n;
}
function entEye(e, out) {
  if (e.isPlayer) return out.set(e.pos.x, e.pos.y + PL.eyeH, e.pos.z);
  if (e.model && e.alive) return out.copy(e.model.J[J_HEAD]).add(_tmpB.set(0, 0.03, 0));
  return out.set(e.pos.x, e.pos.y + lerp(1.62, 1.12, e.crouchAmt || 0), e.pos.z);
}
function entChest(e, out) {
  if (!e.isPlayer && e.model) return out.lerpVectors(e.model.J[J_PEL], e.model.J[J_CHE], 0.62);
  const k = 1 - (e.crouchAmt || 0) * 0.33; return out.set(e.pos.x, e.pos.y + 1.2 * k, e.pos.z);
}
function entHead(e, out) {
  if (!e.isPlayer && e.model) return out.copy(e.model.J[J_HEAD]);
  const k = 1 - (e.crouchAmt || 0) * 0.33; return out.set(e.pos.x, e.pos.y + 1.63 * k, e.pos.z);
}
function rayEntities(o, d, maxT, shooter) {
  let best = null, bt = maxT, bp = null;
  for (const e of entities) {
    if (!e.alive || e.inMecha || e === shooter || allied(e, shooter)) continue; // (a pilot is inside its mecha: it is the armor that gets hit)
    const cx = e.pos.x - o.x, cy = e.pos.y + 0.9 - o.y, cz = e.pos.z - o.z;
    const tc = cx * d.x + cy * d.y + cz * d.z; if (tc < -1.5 || tc > bt + 1.5) continue;
    if (cx * cx + cy * cy + cz * cz - tc * tc > 1.6) continue;
    const n = hitSpheres(e);
    for (let i = 0; i < n; i++) {
      const h = HS[i];
      const hx = h.c.x - o.x, hy = h.c.y - o.y, hz = h.c.z - o.z;
      const t = hx * d.x + hy * d.y + hz * d.z; if (t < 0) continue;
      const d2 = hx * hx + hy * hy + hz * hz - t * t;
      if (d2 > h.r * h.r) continue;
      const th = t - Math.sqrt(h.r * h.r - d2);
      if (th < bt) { bt = th; best = e; bp = h.part; }
    }
  }
  return best ? { ent: best, t: bt, part: bp } : null;
}
