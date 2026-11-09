/* ==========================================================================
   AIM ASSIST AND TOUCH AIDS (owner's feedback: "mobile controls even easier to play, inspired by
   market standards: PUBG, Call of Duty Mobile, Delta Force"). On touch, with a controller and with the touchpad (09qe-touchpad.js), never with the mouse.
   - slowdown: near a visible enemy, the look turns more slowly (you no longer overshoot the target with a thumb flick);
   - snap: when going to the shoulder, the view glides toward the enemy nearest the crosshair (about 60% of the way, in 0.2 s);
   - tracking: as long as the crosshair is on an enemy, the view partly follows its movement (and yours, when strafing);
   - auto-fire (on touch, enabled by default, Options): you fire on your own as long as the crosshair is on a visible enemy, at the weapon's rate (a semi-automatic
     weapon fires shot after shot); sniper rifle: only when aiming (the Dragunov also waits for the crosshair to settle and spaces its shots, def.autoFire). The fire button then disappears, the aim button takes its place and size
     (touchModeSync, 09qb-touch-layout.js);
   - vibration (option, on touch, Android: iPhone gives no access to it) on hit, on elimination and when hit.
   Fire-on-release for sniper rifles is in touchFire (09q-touch.js). Settings: Options, Game. Assist "Normal" or "Off": "Strong"
   (3.0.0) was removed, too favorable.
   ========================================================================== */
const AIM = { fr: 1, tgt: null, tYaw: 0, tPitch: 0, adsPrev: 0, snapT: -9, autoT: -9, auto: false, onT: -1 };
const AIM_K = { off: 0, normal: 1 };
const _aimV = new V3(), _aimC = new V3();
/* Visible enemy nearest the crosshair, within a cone of maxAng (rad) widened by the width of its torso; null otherwise */
function aimTarget(maxAng) {
  const cp = Math.cos(PL.pitch), fx = -Math.sin(PL.yaw) * cp, fy = Math.sin(PL.pitch), fz = -Math.cos(PL.yaw) * cp, o = camera.position;
  let best = null, bs = Infinity;
  for (const e of entities) {
    if (!e.alive || e === PL.ent || allied(e, PL.ent)) continue;
    entChest(e, _aimC); _aimV.subVectors(_aimC, o);
    const d = _aimV.length(); if (d < 0.5 || d > 75) continue;
    const ang = Math.acos(clamp((_aimV.x * fx + _aimV.y * fy + _aimV.z * fz) / d, -1, 1)), rad = Math.atan2(0.42, d);
    if (ang > maxAng + rad) continue;
    const score = ang - rad; if (score >= bs) continue;
    if (rayWorld(o.x, o.y, o.z, _aimV.x / d, _aimV.y / d, _aimV.z / d, d - 0.4) || smokeBlocks(o, _aimC)) continue; // hidden behind a wall, in a smoke grenade
    bs = score; best = { e, ang, rad, d, yaw: Math.atan2(-_aimV.x, -_aimV.z), pitch: Math.asin(clamp(_aimV.y / d, -1, 1)) };
  }
  return best;
}
/* Called by updatePlayer before applying the look: returns the look slowdown factor (1: none); snap, tracking, auto-fire */
function aimAssist(dt) {
  AIM.fr = 1;
  const k = AIM_K[Settings.aimAssist] === undefined ? 1 : AIM_K[Settings.aimAssist];
  const usable = (TOUCH.on || PAD.drive || trackpadOn()) && PL.ent.alive && MATCH.state === 'playing' && !KS.map.open;
  const ads = VM.ads, rising = ads > 0.15 && AIM.adsPrev <= 0.15; AIM.adsPrev = ads;
  if (!usable) { aimAutoFire(null); AIM.tgt = null; return 1; }
  const T = aimTarget((k ? 0.07 + 0.05 * k : 0) + ((TOUCH.on ? Settings.tcAuto : trackpadOn() && Settings.tpAuto !== false) ? 0.02 : 0));
  if (k > 0 && T) {
    // slowdown: up to half as fast on target
    const close = 1 - clamp((T.ang - T.rad * 0.5) / (T.rad + 0.04 * k), 0, 1);
    AIM.fr = 1 - close * Math.min(0.65, 0.5 * k);
    // snap: 0.2 s after going to the shoulder, if the enemy is within 7 degrees
    if (rising) AIM.snapT = MATCH.time;
    if (MATCH.time - AIM.snapT < 0.2 && T.ang < 0.12 * k + T.rad) {
      const a = (1 - Math.exp(-dt * 14)) * 0.65 * Math.min(1, k);
      PL.yaw += angDiff(PL.yaw, T.yaw) * a; PL.pitch += (T.pitch - PL.pitch) * a;
    }
    // tracking: the same target from one frame to the next, crosshair on it or very close
    if (AIM.tgt === T.e && T.ang < T.rad + 0.02) {
      const s = 0.35 * Math.min(1, k);
      PL.yaw += angDiff(AIM.tYaw, T.yaw) * s; PL.pitch += (T.pitch - AIM.tPitch) * s;
    }
  }
  if (T) { AIM.tgt = T.e; AIM.tYaw = T.yaw; AIM.tPitch = T.pitch; } else AIM.tgt = null;
  aimAutoFire(T);
  return AIM.fr;
}
/* Auto-fire (on touch): the crosshair ray hits an enemy (the same test as bullets, rayEntities, on the whole body) with no wall
   in front, within the weapon's range; sniper rifle: only when aiming; released 0.12 s after losing it. A semi-automatic weapon (pistol, shotgun,
   sniper) asks for a shot again every frame: it goes off as soon as it is ready (otherwise it fired only one bullet per locked-on enemy) */
const _aimO = new V3(), _aimD = new V3();
function aimAutoFire(T) {
  let ok = false;
  if ((TOUCH.on ? Settings.tcAuto : trackpadOn() && Settings.tpAuto !== false) && !TC.qs && T && PL.ent.alive && performance.now() >= PL.noFireT) {
    const w = curW(), cp = Math.cos(PL.pitch), kn = PL.knifeOut, range = kn ? 2.4 : w.def.range[1] * 1.6; // knife in hand: the strike goes off on an enemy within blade range
    _aimO.copy(camera.position); _aimD.set(-Math.sin(PL.yaw) * cp, Math.sin(PL.pitch), -Math.cos(PL.yaw) * cp);
    const h = kn || (w.mag > 0 && (!w.def.scope || VM.ads > 0.85)) ? rayEntities(_aimO, _aimD, range, PL.ent) : null;
    ok = !!h && !rayWorld(_aimO.x, _aimO.y, _aimO.z, _aimD.x, _aimD.y, _aimD.z, h.t - 0.05);
  }
  if (!ok) AIM.onT = -1; else if (AIM.onT < 0) AIM.onT = MATCH.time;
  // Dragunov (def.autoFire): owner's feedback, on touch it fired shot after shot as soon as the crosshair touched, two bullets to the torso in 0.35 s, far more
  // quickly than with the mouse, where you have to aim and then recover from recoil. The shot waits for the crosshair to settle on the enemy (aimed) and for the gap between two shots (between)
  const at = ok && !PL.knifeOut ? curW().def.autoFire : null;
  if (at && (MATCH.time - AIM.onT < at.aimed || MATCH.time - PL.ent.arms.lastShotAt < at.between)) {
    AIM.autoT = MATCH.time; AIM.auto = true; if (!TC.fire.size) PL.held = PL.queued = false; return;
  }
  if (ok) { AIM.autoT = MATCH.time; if (!AIM.auto || !curW().def.auto) PL.queued = true; AIM.auto = true; PL.held = true; return; }
  if (AIM.auto && MATCH.time - AIM.autoT > 0.12) { AIM.auto = false; if (!TC.fire.size) PL.held = PL.queued = false; }
}
/* Short vibration on touch (Android; ms), only if the screen was touched recently (not with a controller or a keyboard) */
function touchBuzz(ms) {
  if (!TOUCH.on || Settings.tcVib === false || !navigator.vibrate || performance.now() - TOUCH.lastT > 15000) return;
  try { navigator.vibrate(Math.round(ms)); } catch (e) { /* denied: no consequence */ }
}
/* Button opacity on touch (Options) */
function touchAlpha() { if (TC.root) TC.root.style.setProperty('--tca', String(clamp(+Settings.tcAlpha || 1, 0.3, 1))); }
