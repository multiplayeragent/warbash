/* ==========================================================================
   FIRST PERSON: HANDLING IMPACT AND PER-WEAPON SETTINGS
   The choreographies (reloads, bolt, pump: 06d-reload.js) keep their smoothed paths, the weapon and hands
   locked to each other. The impact comes from a separate layer, triggered at the exact moment of each event of the
   choreography (magazine torn out, magazine slapped in, bolt flying forward, weapon put back in place):
     - a shock on the weapon: a damped spring on its six axes (position and rotation of the weapon mount), launched all at once,
       that overshoots then returns. The hands, resting on the weapon, follow the shock without shifting;
     - a shake of the view (camera springs, applyCamera in 08-player.js);
     - a kick of the field of view (negative: the view narrows for a moment).
   Amplitudes are set in centimeters and degrees: they are the maximum offsets reached, whatever the spring.
   ========================================================================== */

/* Per-weapon settings. base: common values; fam: per family (that of the choreography: rig, otherwise fam);
   firearm: per weapon (identifier from WEAPONS). A weapon inherits its family, which inherits base; only the given keys
   change.
   recharge
     springParams : [frequency (Hz), damping] of the weapon shock (lower frequency: heavier weapon, slower shock;
                    damping 0: oscillates forever, 1: no rebound)
     viewKick     : strength of the weapon shocks (1: the amplitudes below)
     cam          : strength of the view shakes and field-of-view kicks
     ev           : per choreography event
                    vm  : weapon shock [right (cm), height (cm), toward the player (cm), barrel up (°),
                          barrel left (°), roll (°, positive: the top of the weapon goes left)]
                    cam : view shake [upward (°), leftward (°), roll (°)]
                    fov : field-of-view kick (degrees; negative: the view narrows)
   annul (a choreography cut or replaced by another)
     springParams : [frequency (Hz), damping] of the weapon's return to its new pose
     inertia      : share of the weapon's velocity it keeps at the moment of the cut (0: restarts from rest)
     mains        : duration (s) of the return of the handling hand (magazine, bolt) to its grip */
const VM_ANIM = {
  base: {
    reloadAnim: {
      // 5.1, punchier (owner feedback: "very punchy and impactful animations, like the recent Call of Duty games"): stiffer
      // and less damped spring (7 Hz and 0.42 before), shocks and shakes 35% stronger
      springParams: [8.5, 0.36], viewKick: 1.35, cam: 1.35,
      ev: {
        lifted: { cam: [-0.5, 0.15, 0.9] }, // the weapon tilts: the torso follows
        magout: { vm: [0, -1.4, 0.35, -2.4, 0.45, 3.3], cam: [-0.8, 0.1, 0.8], fov: -0.4 }, // magazine torn out: the weapon follows the hand downward (shock reduced in 5.1, with the stronger shocks: the magazine stays under 4.2 m/s, reloadAnim.js)
        insert: { vm: [0, -3, 1.2, 5.5, 0, -3.5], cam: [-2.2, 0.3, -1.1], fov: -2 }, // magazine slapped in
        catch: { vm: [0, 0.7, 2.3, 4.5, 0, -2.6], cam: [1.7, -0.25, 0.8], fov: -1.4 }, // bolt release lever: the bolt flies forward
        slide: { vm: [0, 0.6, 2.3, 5, 0, 2], cam: [1.4, 0, 0.6], fov: -1.3 }, // slide released
        boltsnd: { vm: [0, 0.3, 0.6, 1.5, 0, -1.2], cam: [0.3, 0, 0.3] }, // bolt handle raised
        boltfwd: { vm: [0, 0, 1.6, 2.6, 0, 0], cam: [0.5, 0, 0.15], fov: -0.5 }, // bolt closed (bolt-action rifle)
        shellin: { vm: [0, -1.9, 0.8, 3.3, 0, 0], cam: [-0.8, 0, -0.3], fov: -0.6 }, // shell pushed into the tube
        pumpsnd: { vm: [0, 0, 2.3, 3.5, 0, 0], cam: [1, 0, 0.4], fov: -1 }, // pump
        readied: { vm: [0, -0.8, 1, -2, 0, 1.3], cam: [0.5, 0, -0.4] }, // weapon put back in place, ready to fire
        unholster: { vm: [0, -1, 1.4, 3.5, 0, -1.8], cam: [-0.9, 0.2, -0.9], fov: -1.2 }, // weapon drawn (weapon switch): it arrives in place and settles there
        aimIn: { vm: [0, -0.35, 0.7, 1.1, 0, 0], cam: [-0.3, 0, 0.1], fov: -0.5 }, // shouldering: the stock settles into the shoulder
        lowered: { cam: [0.3, -0.1, 0.5] }, // weapon stowed (weapon switch): the torso accompanies the motion
      },
    },
    cancelAnim: { springParams: [5, 0.8], inertia: 0.4, handReturn: 0.12 },
  },
  fam: {
    pistol: { reloadAnim: { springParams: [10, 0.36] } },
    sniper: { reloadAnim: { springParams: [6.5, 0.4], viewKick: 1.45, cam: 1.45 } },
    shotgun: { reloadAnim: { springParams: [7.5, 0.36], viewKick: 1.45 } },
  },
  firearm: {
    ak47: { reloadAnim: { viewKick: 1.15, cam: 1.15 } },
    scarh: { reloadAnim: { viewKick: 1.15, cam: 1.15 } },
    aa12: { reloadAnim: { springParams: [6, 0.45], viewKick: 1.25, cam: 1.25 } },
    svd: { reloadAnim: { springParams: [6, 0.45], viewKick: 1.1 } },
    m82: { reloadAnim: { springParams: [5, 0.48], viewKick: 1.3, cam: 1.5 } },
    deagle: { reloadAnim: { viewKick: 1.2, cam: 1.4 } },
    mp7: { reloadAnim: { viewKick: 0.85 } },
    vector: { reloadAnim: { viewKick: 0.85 } },
  },
};
const _vmaC = {};
function vmaMerge(a, b) {
  const o = Object.assign({}, a);
  for (const k in b) { const v = b[k]; o[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' ? vmaMerge(a[k], v) : v; }
  return o;
}
/* settings of a weapon (def from WEAPONS or derived with attachments) */
function vmaCfg(def) {
  const fam = def.rig || def.fam, key = fam + ':' + def.id;
  return _vmaC[key] || (_vmaC[key] = vmaMerge(vmaMerge(VM_ANIM.base, VM_ANIM.fam[fam] || {}), VM_ANIM.firearm[def.id] || {}));
}

/* Maximum offset reached by a damped spring (angular frequency w, damping z) launched at velocity 1 from rest: to
   get an offset A, launch it at velocity A / vmaPeak(w, z) */
function vmaPeak(w, z) {
  z = clamp(z, 0.05, 0.98);
  const wd = w * Math.sqrt(1 - z * z), zw = z * w, t = Math.atan2(wd, zw) / wd;
  return (Math.exp(-zw * t) * Math.sin(wd * t)) / wd;
}
/* Damped spring on an array of values (o: offsets, v: velocities); R: [frequency (Hz), damping]. Step of
   1/120 s at most: stable even at 30 frames per second on a phone. */
function vmaSpring(o, v, R, dt) {
  const w = TAU * R[0], k = w * w, c = 2 * R[1] * w, n = Math.max(1, Math.ceil(dt * 120)), h = dt / n;
  for (let s = 0; s < n; s++) for (let j = 0; j < o.length; j++) { v[j] += (-k * o[j] - c * v[j]) * h; o[j] += v[j] * h; }
}

/* Weapon shock: vm in cm and degrees (see VM_ANIM), C: the weapon's recharge settings; picked up by updateViewmodel */
const _vmaU = [0.01, 0.01, 0.01, Math.PI / 180, Math.PI / 180, Math.PI / 180];
function vmViewKick(vm, C) {
  if (!vm) return;
  const k = C.viewKick / vmaPeak(TAU * C.springParams[0], C.springParams[1]);
  for (let j = 0; j < 6; j++) VM.viewKickV[j] += vm[j] * _vmaU[j] * k;
}
/* View shake (degrees) and field-of-view kick, picked up by applyCamera (08-player.js). The view springs
   are fixed there: pitch and yaw stiffness 180, damping 16; roll 150 and 15. */
const VMA_CAM = [vmaPeak(Math.sqrt(180), 8 / Math.sqrt(180)), vmaPeak(Math.sqrt(180), 8 / Math.sqrt(180)), vmaPeak(Math.sqrt(150), 7.5 / Math.sqrt(150))];
function vmCamKick(cam, fov, k) {
  const K = VM.camK;
  if (cam) for (let j = 0; j < 3; j++) K[j] += ((cam[j] * Math.PI) / 180 / VMA_CAM[j]) * k;
  if (fov) K[3] += fov * k;
}
