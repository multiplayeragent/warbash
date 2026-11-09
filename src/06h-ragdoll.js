/* ==========================================================================
   RAGDOLLS: the body of a dead soldier.
   15 points (the animation joints, see 06b-soldier.js) linked by rigid bars, simulated by
   positions (PBD) in small steps. What gives the body weight:
   - realistic masses (the torso and pelvis weigh, the hands weigh nothing): the limbs flop around a
     torso that hardly moves;
   - real Coulomb friction (static grip at rest, braked sliding): a lying body never slides on its own,
     and a thrown body stops quickly;
   - a shot impulse spread over the body (the top goes faster than the feet, which catch on the ground: the body
     tips over instead of flying) and knees that give way;
   - no bounce, a dull thud and a bit of dust when the body crashes down (sfxBodyFall, bodyDustFx);
   - sleep decided on actual stillness, never on a countdown.
   Collisions are swept: a point entering a box comes out through the face it came from, never the
   other side, and the ground does not lift it onto a neighboring crate.
   ========================================================================== */
const RAG_RIGID = [[0, 1], [1, 2], [1, 3], [1, 6], [3, 6], [3, 4], [4, 5], [6, 7], [7, 8], [0, 9], [0, 12], [9, 12], [9, 10], [10, 11], [12, 13], [13, 14], [3, 0], [6, 0], [9, 1], [12, 1], [2, 3], [2, 6], [3, 12], [6, 9]];
const RAG_MIN = [[3, 5, 0.24], [6, 8, 0.24], [9, 11, 0.5], [12, 14, 0.5], [2, 0, 0.62], [11, 14, 0.16], [10, 13, 0.16], [5, 2, 0.18], [8, 2, 0.18], [5, 8, 0.1], [4, 0, 0.2], [7, 0, 0.2], [5, 1, 0.2], [8, 1, 0.2]];
/* contact radius of each point (the thickness of the body: vest, thighs, boots), then those of the two ends of the weapon */
const RAG_RAD = [0.15, 0.17, 0.13, 0.09, 0.065, 0.055, 0.09, 0.065, 0.055, 0.09, 0.075, 0.07, 0.09, 0.075, 0.07, 0.05, 0.035];
/* relative mass (kg of an equipped man, brought back to his points): torso 36%, thighs 12%, hands and feet almost nothing */
const RAG_MASS = [10, 14, 5, 3, 2, 1, 3, 2, 1, 6, 3.5, 1.8, 6, 3.5, 1.8, 1.2, 0.8];
/* one-way joints: [anchor, joint, end, direction]; direction 1: the joint stays in front of the chord
   (knee); the opposite would be a hyperextension. No stop at the elbow: the forearm folds in every direction
   depending on the pose, and the stop made the arm tremble there. */
const RAG_HINGE = [[J_HIL, J_KNL, J_FTL, 1], [J_HIR, J_KNR, J_FTR, 1]];
/* points that take the fall (pelvis, torso, head, hips): their impact is heard and raises dust */
const RAG_HEAVY = [J_PEL, J_CHE, J_HEAD, J_HIL, J_HIR];
const RAG = {
  hMax: 1 / 120,      // maximum step (s): the frame is cut into equal steps, 2 to 60 frames per second
  g: 24,              // gravity (m/s2): stronger than 9.8, the body falls like dead weight
  drag: 0.35,         // air resistance (1/s)
  slow: 5,            // extra resistance to slow movements (1/s)
  vMax: 11,           // maximum speed of a point (m/s): no tunneling through a wall, no absurd projection
  iters: 5,           // constraint passes per step
  hingeMax: 0.004,    // maximum correction of a joint stop per pass (m)
  mu: 0.85, muK: 0.55, // static and sliding friction
  stick: 0.12,        // minimum grip (m/s): a slide slower than this is cancelled on contact (a body leaning against a wall does not slump quietly)
  stairs: 1.8,        // ramps are staircases: the steps hold the body back (friction multiplied)
  bounce: 0.04, bounceWall: 0.1, // bounces (almost zero)
  knock: 0.8,         // upper-body speed = shot force x knock (m/s)
  sleepD: 0.006, sleepT: 0.4, maxT: 12, // sleep: less than 6 mm in 0.1 s for 0.4 s
};
const _rg = { a: new V3(), b: new V3(), n: new V3(), f: new V3(), r: new V3(), u: new V3() };

/* Launch of the ragdoll of a soldier who has just died (e.lastForce: { dir, mag, lift, part, radial }) */
function startRagdoll(e) {
  const S = e.model, f = e.lastForce, J = S.J, Jp = S.Jp;
  const gun = !!S.gun && S.gun.visible !== false, n = gun ? 17 : 15;
  const R = S.rag = { n, p: [], v: [], q: [], vin: [], hit: new Int8Array(n), fr: new Float32Array(n), dep: new Float64Array(n), nx: new Float64Array(n), ny: new Float64Array(n), nz: new Float64Array(n),
    links: gun ? RAG_RIGID.concat([[15, 16]]) : RAG_RIGID, rest: [], boxes: [], ramps: [], snap: [], snapT: 0, t: 0, still: 0, sleep: false, thud: 0, dust: 1 };
  for (let i = 0; i < 15; i++) R.p.push(J[i].clone());
  // velocity inherited from the animation (run, fall, recoil): capped, slightly damped
  const pdt = S.pdt || 1 / 60;
  for (let i = 0; i < 15; i++) {
    const v = _rg.a.subVectors(J[i], Jp[i]).multiplyScalar(0.85 / pdt), s = v.length();
    R.v.push(s > 6 ? v.multiplyScalar(6 / s).clone() : v.clone());
  }
  if (gun) {
    S.gun.updateWorldMatrix(true, false);
    const a = S.gun.localToWorld(new V3(0, 0.02, 0.2)), b = S.gun.localToWorld(S.muzzleLocal.clone());
    R.p.push(a, b); R.v.push(R.v[J_HAR].clone(), R.v[J_HAR].clone());
  }
  for (let i = 0; i < n; i++) { R.q.push(R.p[i].clone()); R.vin.push(new V3()); }
  for (const [a, b] of R.links) R.rest.push(R.p[a].distanceTo(R.p[b]));
  // pose already sunk into a wall (a hand sticking out): cleared before the first display, with no limb snapping
  ragBounds(R, 0.1);
  for (let it = 0; it < 12; it++) { ragLinks(R); for (let i = 0; i < n; i++) ragCollide(R, i); }
  for (let i = 0; i < n; i++) { R.q[i].copy(R.p[i]); R.snap.push(R.p[i].clone()); }
  ragKnock(e, R, f);
}

/* The hit: velocity spread over the body. The top goes faster than the feet (which catch on the ground): the body
   tips over around them; the knees give way; the angle of the shot decides the fall (on the back, forward, sideways). */
function ragKnock(e, R, f) {
  const P = R.p, V = R.v;
  if (!f) f = { dir: new V3(rand(-1, 1), 0, rand(-1, 1)), mag: 2, lift: 0.5, part: 'body' };
  const dir = _rg.a.set(f.dir.x, 0, f.dir.z); if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1); dir.normalize();
  const dx = dir.x, dz = dir.z, mag = f.mag;
  const idx = f.part === 'head' ? J_HEAD : f.part === 'legs' ? (Math.random() < 0.5 ? J_KNL : J_KNR) : J_CHE;
  const add = (i, x, y, z) => { V[i].x += x; V[i].y += y; V[i].z += z; };
  for (let i = 0; i < 15; i++) {
    const hi = clamp((P[i].y - e.pos.y) / 1.6, 0, 1);
    if (f.radial) {
      // explosion: the whole body goes, like a thrown sack
      add(i, dx * mag * 0.85, f.lift * 0.8 * (0.75 + hi * 0.25), dz * mag * 0.85);
    } else {
      const near = Math.exp(-P[i].distanceTo(P[idx]) / 0.5), w = (0.3 + 0.7 * hi) * (0.8 + 0.4 * near);
      add(i, dx * mag * RAG.knock * w, f.lift * 0.1 * hi, dz * mag * RAG.knock * w);
    }
  }
  if (!f.radial) {
    const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw), along = dx * fx + dz * fz, side = dx * fz - dz * fx;
    const up = [J_HEAD, J_CHE, J_SHL, J_SHR], low = [J_KNL, J_KNR, J_FTL, J_FTR];
    const m = Math.min(mag, 6.5) * clamp(1 - (mag - 5) * 0.12, 0.35, 1) * 0.5; // rotation caps out, translation keeps growing with the weapon
    if (along < -0.35) { for (const i of up) add(i, dx * m * 0.5, 0.3, dz * m * 0.5); for (const i of low) add(i, -dx * m * 0.1, 0, -dz * m * 0.1); } // from the front: on the back
    else if (along > 0.35) { for (const i of up) add(i, dx * m * 0.6, -0.5, dz * m * 0.6); for (const i of low) add(i, -dx * m * 0.12, 0.15, -dz * m * 0.12); } // from behind: forward
    else { // from the side: the body pivots around the vertical axis
      const spin = Math.sign(side || 1) * (1.2 + m * 0.5);
      for (const i of [J_SHL, J_SHR, J_ELL, J_ELR, J_HAL, J_HAR, J_HIL, J_HIR]) add(i, -(P[i].z - P[J_PEL].z) * spin, 0, (P[i].x - P[J_PEL].x) * spin);
      for (const i of up) add(i, dx * m * 0.3, 0.15, dz * m * 0.3);
    }
    if (f.part === 'head') { add(J_HEAD, dx * m * 1.1, 0.9, dz * m * 1.1); for (const i of [J_PEL, J_KNL, J_KNR]) add(i, 0, -1.2, 0); } // the head goes, the legs give way
    else if (f.part === 'legs') { for (const i of low) add(i, dx * m * 1.0, 0.7, dz * m * 1.0); for (const i of up) add(i, -dx * m * 0.15, 0, -dz * m * 0.15); } // mown down
    // the legs give way: all the more so as the weapon is light (the push does not carry the body)
    const buckle = lerp(1.7, 0.9, clamp((mag - 3) / 5, 0, 1));
    for (const i of [J_PEL, J_KNL, J_KNR, J_HIL, J_HIR]) add(i, 0, -buckle, 0);
    const tw = rand(-1, 1) * 1.0; for (const i of [J_SHL, J_SHR]) add(i, -(P[i].z - P[J_CHE].z) * tw, 0, (P[i].x - P[J_CHE].x) * tw);
  }
  // the weapon, if still in the hands, is dropped along with the arm
  if (R.n > 15) { V[15].addScaledVector(dir, mag * 0.3); V[16].addScaledVector(dir, mag * 0.3); }
}

/* Boxes and ramps around the body, a single query per frame: the margin covers the distance traveled during the frame */
function ragBounds(R, span) {
  const P = R.p; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let i = 0; i < R.n; i++) { const p = P[i]; if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; if (p.z < z0) z0 = p.z; if (p.z > z1) z1 = p.z; }
  const m = 0.35 + RAG.vMax * span;
  R.boxes.length = 0; R.ramps.length = 0;
  for (const c of queryBoxes(x0 - m, z0 - m, x1 + m, z1 + m)) if (!c.ray && c.y1 > y0 - m && c.y0 < y1 + m) R.boxes.push(c);
  for (const rp of RAMPS) if (rp.x1 > x0 - m && rp.x0 < x1 + m && rp.z1 > z0 - m && rp.z0 < z1 + m) R.ramps.push(rp);
}

function ragTouch(R, i, pen, x, y, z) {
  R.hit[i] = 1;
  if (pen >= R.dep[i]) { R.dep[i] = pen; R.nx[i] = x; R.ny[i] = y; R.nz[i] = z; }
}
/* Contact of a point with the ground, ramps and boxes: projection of the position, remembering the normal and the
   penetration (friction depends on it, see ragStep). Exit from boxes through the face the point came from. */
function ragCollide(R, i) {
  const p = R.p[i], q = R.q[i], r = RAG_RAD[i];
  // ground (y = 0; none above the void) and ramps (the normal follows the slope: a body stays on a staircase, but slides on a steep slope)
  let gy = VOID.on ? -1e9 : 0, sx = 0, sz = 0, ramp = false;
  if (RELIEF.on) { gy = reliefAt(p.x, p.z); sx = (reliefAt(p.x + 0.5, p.z) - reliefAt(p.x - 0.5, p.z)); sz = (reliefAt(p.x, p.z + 0.5) - reliefAt(p.x, p.z - 0.5)); ramp = true; } // dunes: the slope of the sand
  for (const rp of R.ramps) {
    if (p.x < rp.x0 || p.x > rp.x1 || p.z < rp.z0 || p.z > rp.z1) continue;
    const h = rampHeight(rp, p.x, p.z);
    if (h > gy && h <= p.y + r + 0.35) { gy = h; ramp = true; const s = (rp.h1 - rp.h0) / (rp.axis === 'x' ? rp.x1 - rp.x0 : rp.z1 - rp.z0); sx = rp.axis === 'x' ? s : 0; sz = rp.axis === 'z' ? s : 0; }
  }
  if (ramp) {
    const il = 1 / Math.sqrt(1 + sx * sx + sz * sz), ux = -sx * il, uy = il, uz = -sz * il;
    const d = (p.y - gy) * uy - r;
    if (d < 0) { p.x -= ux * d; p.y -= uy * d; p.z -= uz * d; ragTouch(R, i, -d, ux, uy, uz); R.fr[i] = RAG.stairs; }
  } else if (!VOID.on && p.y - r < 0) { ragTouch(R, i, r - p.y, 0, 1, 0); p.y = r; }
  for (const c of R.boxes) {
    const x0 = c.x0 - r, x1 = c.x1 + r, y0 = c.y0 - r, y1 = c.y1 + r, z0 = c.z0 - r, z1 = c.z1 + r;
    if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1 || p.z < z0 || p.z > z1) continue;
    // entry face: the one the point crossed since the start of the step; failing that (point born inside the box), the nearest
    const mg = [x0 - q.x, q.x - x1, y0 - q.y, q.y - y1, z0 - q.z, q.z - z1], pen = [p.x - x0, x1 - p.x, p.y - y0, y1 - p.y, p.z - z0, z1 - p.z];
    if (c.y0 < 0.05) { mg[2] = -1e9; pen[2] = 1e9; } // box resting on the ground: no exit from underneath
    let k = 0, best = -1e9;
    for (let a = 0; a < 6; a++) if (mg[a] > best) { best = mg[a]; k = a; }
    if (best < -0.004) { k = 0; for (let a = 1; a < 6; a++) if (pen[a] < pen[k]) k = a; }
    switch (k) {
      case 0: ragTouch(R, i, pen[0], -1, 0, 0); p.x = x0; break; case 1: ragTouch(R, i, pen[1], 1, 0, 0); p.x = x1; break;
      case 2: ragTouch(R, i, pen[2], 0, -1, 0); p.y = y0; break; case 3: ragTouch(R, i, pen[3], 0, 1, 0); p.y = y1; break;
      case 4: ragTouch(R, i, pen[4], 0, 0, -1); p.z = z0; break; default: ragTouch(R, i, pen[5], 0, 0, 1); p.z = z1;
    }
  }
}

/* Bars, minimum distances (limit bends) and joint directions, solved by mass */
function ragLinks(R) {
  const P = R.p, L = R.links, rest = R.rest;
  for (let k = 0; k < L.length; k++) {
    const a = L[k][0], b = L[k][1], pa = P[a], pb = P[b];
    const dx = pb.x - pa.x, dy = pb.y - pa.y, dz = pb.z - pa.z, len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
    const wa = 1 / RAG_MASS[a], wb = 1 / RAG_MASS[b], d = (len - rest[k]) / (len * (wa + wb));
    pa.x += dx * d * wa; pa.y += dy * d * wa; pa.z += dz * d * wa; pb.x -= dx * d * wb; pb.y -= dy * d * wb; pb.z -= dz * d * wb;
  }
  for (const [a, b, mn] of RAG_MIN) {
    const pa = P[a], pb = P[b], dx = pb.x - pa.x, dy = pb.y - pa.y, dz = pb.z - pa.z, len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
    if (len >= mn) continue;
    const wa = 1 / RAG_MASS[a], wb = 1 / RAG_MASS[b], d = (len - mn) / (len * (wa + wb));
    pa.x += dx * d * wa; pa.y += dy * d * wa; pa.z += dz * d * wa; pb.x -= dx * d * wb; pb.y -= dy * d * wb; pb.z -= dz * d * wb;
  }
  // front of the body: (top of torso) x (from left hip to right)
  const F = _rg.f, A = _rg.a, B = _rg.b;
  A.subVectors(P[J_CHE], P[J_PEL]); B.subVectors(P[J_HIR], P[J_HIL]); F.crossVectors(A, B);
  if (F.lengthSq() < 1e-8) return; F.normalize();
  for (const [a, k, b, s] of RAG_HINGE) {
    const pk = P[k], m = _rg.r.addVectors(P[a], P[b]).multiplyScalar(0.5), o = (pk.x - m.x) * F.x + (pk.y - m.y) * F.y + (pk.z - m.z) * F.z;
    // brought back toward the chord, beyond that it is a hyperextension; the correction is capped per pass: a joint bent
    // the wrong way returns smoothly (a knee pulled back at once would whip the whole leg)
    if (o * s < 0) { const c = clamp(o * 0.3, -RAG.hingeMax, RAG.hingeMax); pk.x -= F.x * c; pk.y -= F.y * c; pk.z -= F.z * c; }
  }
}

/* One simulation step of duration h: integration, constraints and contacts alternating, then friction, bounce and
   velocities derived from the positions. Says whether the body touches anything. */
function ragStep(R, h) {
  const P = R.p, V = R.v, Q = R.q, n = R.n, g = RAG.g * h, drag = Math.max(0, 1 - RAG.drag * h);
  for (let i = 0; i < n; i++) {
    const p = P[i], v = V[i];
    Q[i].copy(p);
    // slow movements are braked much more than fast ones: a free elbow does not spin for seconds around its axis
    const sl = v.length(), k = Math.max(0, drag - RAG.slow * h * (1 - smoothstep(0.4, 2.5, sl)));
    v.x *= k; v.y = v.y * k - g; v.z *= k;
    const s = v.length(); if (s > RAG.vMax) v.multiplyScalar(RAG.vMax / s);
    R.vin[i].copy(v); R.hit[i] = 0; R.dep[i] = 0; R.fr[i] = 1;
    p.addScaledVector(v, h);
  }
  for (let it = 0; it < RAG.iters; it++) {
    ragLinks(R);
    for (let i = 0; i < n; i++) ragCollide(R, i);
  }
  const inv = 1 / h; let grounded = false;
  for (let i = 0; i < n; i++) {
    const p = P[i], q = Q[i], v = V[i];
    if (R.hit[i]) {
      grounded = true;
      const nx = R.nx[i], ny = R.ny[i], nz = R.nz[i], d = Math.min(R.dep[i], 0.03);
      // Coulomb friction on the step's displacement: grip below mu x penetration, otherwise braked sliding
      const dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z, dn = dx * nx + dy * ny + dz * nz;
      const tx = dx - dn * nx, ty = dy - dn * ny, tz = dz - dn * nz, ts = Math.sqrt(tx * tx + ty * ty + tz * tz);
      if (ts > 1e-9) {
        const fr = R.fr[i], k = ts <= RAG.mu * fr * d + RAG.stick * h ? 1 : RAG.muK * fr * d / ts;
        p.x -= tx * k; p.y -= ty * k; p.z -= tz * k;
      }
      v.set((p.x - q.x) * inv, (p.y - q.y) * inv, (p.z - q.z) * inv);
      // almost no bounce; the impact of a heavy point is heard and raises dust
      const vi = R.vin[i], vin = vi.x * nx + vi.y * ny + vi.z * nz, vn = v.x * nx + v.y * ny + v.z * nz;
      if (vin < -1.5) {
        const want = -vin * (ny > 0.7 ? RAG.bounce : RAG.bounceWall);
        if (vn < want) { v.x += nx * (want - vn); v.y += ny * (want - vn); v.z += nz * (want - vn); }
        if (R.thud <= 0 && ny > 0.7 && -vin > 2.2 && RAG_HEAVY.includes(i)) ragThud(R, p, -vin);
      }
    } else v.set((p.x - q.x) * inv, (p.y - q.y) * inv, (p.z - q.z) * inv);
  }
  R.thud -= h;
  return { grounded };
}
/* Impact of a body on the ground: dull thud and dust, at most one per instant */
function ragThud(R, p, speed) {
  R.thud = 0.2;
  const k = clamp(speed / 7, 0.35, 1.2);
  sfxBodyFall(p, k);
  if (R.dust > 0) { R.dust--; bodyDustFx(p, k); }
}

function stepRagdoll(e, dt) {
  const S = e.model, R = S.rag; if (!R) return;
  R.t += dt;
  if (!R.sleep && dt > 0) {
    dt = Math.min(dt, 0.05);
    const ns = Math.max(1, Math.ceil(dt / RAG.hMax - 1e-6)), h = dt / ns;
    ragBounds(R, dt);
    for (let s = 0; s < ns; s++) {
      const r = ragStep(R, h);
      // sleep: the body has barely moved (displacement, not velocity: a point trembling by 1 mm does not count)
      // for sleepT while resting, or it lasts too long for nothing
      R.snapT += h;
      if (R.snapT >= 0.1) {
        let far = 0;
        // the weapon (player's killcam) counts toward sleep for 3 s; after that, it slides off a crate edge on its own without holding the body back
        for (let i = 0; i < R.n; i++) { const d = R.p[i].distanceTo(R.snap[i]); if (d > far && (i < 15 || R.t < 3)) far = d; R.snap[i].copy(R.p[i]); }
        R.still = r.grounded && far < RAG.sleepD ? R.still + R.snapT : 0; R.snapT = 0;
      }
      if (R.still > RAG.sleepT || R.t > RAG.maxT) {
        R.sleep = true;
        for (let i = 0; i < R.n; i++) R.v[i].set(0, 0, 0);
        break;
      }
    }
  }
  // fell into the void: the body disappears (it does not fall asleep in mid-air under the islands)
  if (VOID.on && R.p[0].y < VOID.kill) { R.sleep = true; e.voidDead = true; }
  for (let i = 0; i < 15; i++) S.J[i].copy(R.p[i]);
  if (R.n > 15) {
    const d = _rg.u.subVectors(R.p[16], R.p[15]).normalize();
    S.gun.position.copy(R.p[15]).addScaledVector(d, -0.2); S.gun.position.y -= S.sink;
    _pz.q.setFromUnitVectors(_rg.n.set(0, 0, -1), d);
    S.gun.quaternion.copy(_pz.q);
  }
}
