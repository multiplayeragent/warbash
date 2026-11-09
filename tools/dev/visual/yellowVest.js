/* Yellow Vest check (06gc-outfits-challenge.js): the vest never sinks into the body. A soldier in the Yellow Vest goes through the game's poses
   (idle, walk, run, sprint, walking backward, side steps, crouch, aiming, jump, pistol), simulated cloth; every frame, every point of the
   vest (sewn part, skinned the way the engine does it, and cloth particles) is measured:
   - torso: a cloth particle does not go under its target by more than the vest-to-jacket gap (GJ.g); the sewn part has the same
     weights as the jacket underneath;
   - arms and thighs: no point inside the sleeve or the trouser leg (their profile, in the frame of their bone, outside the junction with the
     trunk where the weights blend: the first 6 centimeters of the arm, 5 of the thigh, where this rigid profile overestimates the sleeve). A point
     is only at fault if the jacket just beneath is not already there, nor within 3 mm (the arm then rests on the chest, any garment crosses it): the base body pushes the arm root into the chest (up to
     5 cm, arm stretched toward the handguard), the vest placed 14 mm above inherits it without adding anything visible; these points are counted separately.
   Within 3 mm: the limb is measured by a round section, at its largest radius, whereas the sleeve is slightly flattened (4% less,
   2 mm, inner side).
   node tools/dev/visual/yellowVest.js ; DETAIL=1 lists the sewn points at fault (height, angle from the front); error code on the first failure. */
const { openGame } = require('./common');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL  :', m); } else console.log('ok    :', m); };
(async () => {
  const { browser, page, logs } = await openGame({ settings: { quality: 'low' }, noMap: true, noHdri: true });
  const r = await page.evaluate(() => {
    const R = soldierRest(), one = new V3(1, 1, 1);
    const POSES = [
      ['rest', {}], ['walking', { v: 2 }], ['running', { v: 4.2 }], ['sprint', { v: 6.5, sprint: true }], ['backward', { v: -2.5 }], ['sidestep', { vx: 3 }],
      ['crouched', { crouch: 1 }], ['crouch-walk', { crouch: 1, v: 1.6 }], ['aim', { ads: 1 }], ['aim-walk', { ads: 1, v: 2 }], ['jumping', { air: true, v: 3 }],
      ['pistol', { gun: 'm9', v: 2 }],
    ];
    // sleeve and trouser leg profiles (soldierBase): largest radius at distance d from the joint
    const ARM = [[-0.085, 0.02], [-0.075, 0.04], [-0.06, 0.053], [-0.04, 0.061], [-0.01, 0.065], [0.04, 0.06], [0.09, 0.054], [0.14, 0.053], [0.2, 0.05], [0.25, 0.045], [SD.ua, 0.044]];
    const LEG = [[-0.09, 0.098], [-0.03, 0.1], [0.03, 0.1], [0.1, 0.092], [0.18, 0.084], [0.26, 0.075], [0.33, 0.066], [0.39, 0.06], [0.43, 0.063]];
    const prof = (P, d, k) => { if (d < P[0][0] || d > P[P.length - 1][0]) return 0; let i = 0; while (i < P.length - 2 && P[i + 1][0] < d) i++; return lerp(P[i][1], P[i + 1][1], (d - P[i][0]) / (P[i + 1][0] - P[i][0])) * k; };
    // sewn part of the vest, alone (rest positions, normals, weights)
    const B = new SkinBuilder(), U = []; GEAR_HI = true; gjVest(B, true, U); const nv = B.count; // (U: the jacket under each vertex)
    const out = { poses: {}, whereAt: {} };
    for (const [nm, o] of POSES) {
      const M = makeSoldier('yellowVest', 0, o.gun || 'm4');
      const e = { model: M, pos: new V3(0, 0, 0), vel: new V3(), yaw: Math.PI, pitch: 0, alive: true, crouchAmt: o.crouch || 0, onGround: !o.air, isPlayer: false, visible: false, target: null, lastShotT: -9, lastSeenT: -99, arms: { adsW: o.ads || 0 }, recoil: 0, sprinting: !!o.sprint, hp: 100, team: 0, throwT: 0 };
      setSoldierLod(M, true);
      const mats = [], inv = [], rinv = []; for (let i = 0; i < SOLDIER_NB; i++) { mats.push(new THREE.Matrix4()); inv.push(new THREE.Matrix4()); rinv.push(R.mats[i].clone().invert()); }
      const p = new V3(), q = new V3(), s = new V3(), jp = new V3(), lq = new V3(), sk = new V3(), stat = { n: 0, torsoPart: 0, armPart: 0, thighPart: 0, inherited: 0, max: 0, whereAt: '' };
      // deepest penetration of x into an arm or a thigh
      const inLimb = (x, tol = 0.003) => {
        let best = null;
        for (const sx of [-1, 1]) {
          const b = SIDE_B(sx);
          for (const [bone, P, k, d0, d1, nmL] of [[b.ua, ARM, 1.02, 0.06, SD.ua, 'armPart'], [b.th, LEG, 1, 0.05, SD.thigh, 'thighPart']]) {
            lq.copy(x).applyMatrix4(inv[bone]); const d = -lq.z; if (d < d0 || d > d1) continue;
            const pen = prof(P, d, k) - Math.hypot(lq.x, lq.y);
            if (pen > tol && (!best || pen > best.pen)) best = { pen, nmL, side: sx > 0 ? 'right' : 'left', d };
          }
        }
        return best;
      };
      // x: vest point; under: the jacket just beneath (same pose)
      const check = (x, under, part, key) => {
        const L = inLimb(x); if (!L) return;
        if (inLimb(under, -0.003)) { stat.inherited++; return; } // (the jacket beneath inside the limb, or within 3 mm: the arm already rests on it)
        stat[L.nmL]++;
        if (key) out.whereAt[key] = (out.whereAt[key] || 0) + 1;
        if (L.pen > stat.max) { stat.max = L.pen; stat.whereAt = `${part} in ${L.nmL} ${L.side} (d ${L.d.toFixed(2)}, ${(L.pen * 1000).toFixed(0)} mm)`; }
      };
      const skinned = (P0, v, o2) => { o2.set(0, 0, 0); for (let k = 0; k < 4; k++) { const w = B.sw[v * 4 + k]; if (w > 0) o2.addScaledVector(sk.copy(P0).applyMatrix4(mats[B.si[v * 4 + k]]), w); } return o2; };
      for (let f = 0; f < 90; f++) {
        e.vel.set(o.vx || 0, 0, o.v || 0); e.pos.x += (o.vx || 0) / 60; e.pos.z += (o.v || 0) / 60;
        animSoldier(e, 1 / 60);
        if (M.cloth) clothSimulate(M, M.cloth, 1 / 60);
        CLOTH.t += 1 / 60;
        if (f < 30 || f % 3) continue;
        for (let i = 0; i < SOLDIER_NB; i++) { const b = M.bones[i]; mats[i].compose(b.position, b.quaternion, one); inv[i].copy(mats[i]).invert(); mats[i].multiply(rinv[i]); } // (current bone x inverse of the rest pose, like clothBones)
        // sewn part: skinned the way the engine does it; the jacket beneath (gjVest), same weights
        for (let v = 0; v < nv; v++) {
          const P0 = new V3(B.p[v * 3], B.p[v * 3 + 1], B.p[v * 3 + 2]);
          skinned(P0, v, p); skinned(U[v], v, jp);
          stat.n++; check(p, jp, 'sewn vest', `${P0.y.toFixed(2)} ${(Math.atan2(P0.x, -P0.z) * 180 / Math.PI).toFixed(0)}`);
        }
        // cloth: under its target (the torso), and inside the limbs; the jacket beneath: the target, GJ.g lower along its normal
        const C = M.cloth; if (!C) continue;
        const sim = C.sim, T = sim.T, N = new Float32Array(T.n * 3); clothNormals(T, sim.tgt, N);
        for (let i = 0; i < T.n; i++) {
          if (T.pin[i] >= 1) continue;
          p.fromArray(sim.p, i * 3); q.fromArray(sim.tgt, i * 3); s.fromArray(N, i * 3);
          const pen = -p.clone().sub(q).dot(s) - (GJ.g - 0.002);
          stat.n++;
          if (pen > 0) { stat.torsoPart++; if (pen > stat.max) { stat.max = pen; stat.whereAt = `cloth under the jacket (particle ${i}, ${(pen * 1000).toFixed(0)} mm)`; } }
          check(p, jp.copy(q).addScaledVector(s, -GJ.g), 'textile', null);
        }
      }
      out.poses[nm] = stat;
      if (M.cloth) clothDetach(M);
      M.root.removeFromParent();
    }
    return out;
  });
  if (process.env.DETAIL) console.log('sewn points at fault (y, angle from the front in degrees: count):', Object.entries(r.whereAt).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, n]) => k + ':' + n).join('  '));
  for (const [nm, s] of Object.entries(r.poses)) ok(s.torsoPart + s.armPart + s.thighPart === 0, `${nm}: ${s.n} points measured, torso ${s.torsoPart}, bras ${s.armPart}, thighs ${s.thighPart}${s.whereAt ? ', worst: ' + s.whereAt : ''} (inherited from the base body: ${s.inherited})`);
  const errs = logs.filter((l) => !/ERR_FILE_NOT_FOUND|favicon|HDRI/.test(l));
  ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
  await browser.close();
  console.log(fails ? `${fails} failure(s)` : 'all good');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
