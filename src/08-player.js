/* ==========================================================================
   PLAYER
   ========================================================================== */
const PL = {
  ent: { id: 0, name: _t('You'), team: 0, isPlayer: true, pos: new V3(), vel: new V3(), vy: 0, yaw: 0, pitch: 0, alive: false, health: 100, crouch: false, crouchAmt: 0,
    kills: 0, deaths: 0, score: 0, assists: 0, streak: 0, lastShotT: -9, dmgBy: new Map() },
  actT: -1e9, // player's last action in the match (shot, grenade, streak): see hitFeedback
  classIdx: 0, nades: 2, held: false, queued: false, noFireT: 0,
  knifeT: 0, knifeNew: false, knifeHit: false, nadeState: null, nadeT: 0, cookT: 0, knifeHold: 0, knifeBtn: null, // knifeHold: share of the knife drawn (0 to 1, for the hand); knifeBtn: knife button press in progress (knifeButton)
  lastDmgT: -9, shake: 0, suppress: 0, punchP: 0, vpP: 0, punchY: 0, vpY: 0, rollP: 0, vrollP: 0, lunge: 0, vlunge: 0,
  shots: 0, hits: 0, bestStreak: 0, ks: {}, ksSel: KS_DEFAULT.slice(), breath: 1, holding: false, deathT: 0, killer: null,
  bobT: 0, bobA: 0, stepPh: 0, wasAir: false, runShot: false, dmgInd: [], lastRegenSnd: 0, heartT: 0, crouchToggle: false, adsWant: false,
  stepOff: 0, stepV: 0, lastY: 0, lastOn: false, // view gliding over a step (applyCamera)
  wasSprint: false, fovK: 0, // sprint start; field-of-view kick (degrees)
};
entities.push(PL.ent);
initCtl(PL.ent, ['m4', 'm9']);
/* The player's old fields point to the common controller (same code as the bots). They are not in the object literal: putting them
   there and then removing them (delete) turned PL into a dictionary (slow reads, boxed numbers written) for the whole session. */
for (const [k, obj, key] of [['weapons', 'arms', 'slots'], ['cur', 'arms', 'cur'], ['fireCd', 'arms', 'fireCd'], ['reload', 'arms', 'reload'], ['switching', 'arms', 'switching'], ['switchTo', 'arms', 'switchTo'], ['bloom', 'arms', 'bloom'], ['boltT', 'arms', 'boltT'], ['onGround', null, 'onGround'], ['eyeH', null, 'eyeH'], ['airVy', null, 'airVy'], ['sprinting', null, 'sprinting'], ['knifeOut', 'arms', 'knife']]) {
  Object.defineProperty(PL, k, { get: () => (obj ? PL.ent[obj][key] : PL.ent[key]), set: (v) => { if (obj) PL.ent[obj][key] = v; else PL.ent[key] = v; }, configurable: true });
}
const KEYS = {};
let mouseDX = 0, mouseDY = 0;

function giveLoadout() {
  classFix(); // the chosen class still exists (06r-arsenal.js)
  const C = CLASSES[PL.classIdx = Settings.loadout];
  PL.ent.arms = makeArms(classWeapons(PL.classIdx));
  PL.ksSel = TRIAL ? trialKs() : classKs(PL.classIdx); updateStreakHud(); // the class's streaks; those already ready from another class wait until it is picked again
  PL.nades = C.nades; PL.nadeType = NADE_TYPES[C.nade] ? C.nade : 'frag'; PL.flashT = 0; PL.knifeT = 0; PL.nadeState = null; PL.knifeOut = false; PL.knifeHold = 0; PL.knifeBtn = null;
  vmSetLook(skinOf(PL.ent), 0); vmEquip(PL.weapons[0].def); VM.action = null;
  if (MATCH.state === 'paused') { PL.pendingDraw = true; VM.lower = 1; VM.lowerTarget = 1; return; } // class change in the pause: the weapon comes out on resume (resumeGame)
  PL.pendingDraw = false; VM.lower = 1; VM.lowerTarget = 0; VM.lowerRate = 16; sfxMech('draw');
}
function curW() { return armsW(PL.ent); }

/* ---------- Inputs ---------- */
function onKey(e, down) {
  if (CHAT.open) return; // message entry: the keys no longer control the soldier
  if (down && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyF') && (MATCH.state === 'killcam' || (MATCH.state === 'playing' && !PL.ent.alive))) { e.preventDefault(); kcSkip(); return; }
  if (MATCH.state !== 'playing' && MATCH.state !== 'paused') return;
  const c = keyCanon(e.code); // key bound to an action: we receive the default key of that action (08a-binds.js)
  if (!c) return;
  if (c === 'Tab') { e.preventDefault(); showScoreboard(down); return; }
  if (MATCH.state !== 'playing' || !pointerActive()) return;
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(c)) e.preventDefault();
  if (KS.map.open && down) { ksMapKey(c); if (c !== 'Escape') { e.preventDefault(); return; } }
  const was = KEYS[c]; KEYS[c] = down;
  if (!down || was) { if (!down && c === 'KeyG') releaseNade(); if (!down && c === 'KeyF') knifeButton(false); return; }
  if (PILOT.d) return; // drone in flight: the keys only fly it (KEYS, read by fpvPlayer)
  if (MECHA_P.me) { if (c === 'KeyE') mechaUse(); return; } // aboard the mecha: the keys pilot it (mechaPilot), E makes you get out
  if (adsToggleMode() && ADS_UNAIM.has(c)) PL.adsWant = false; // toggle aim: reloading, switching weapon, running put it away
  if (c === 'KeyR') startReload();
  else if (c === 'Digit1') switchWeapon(0);
  else if (c === 'Digit2') switchWeapon(1);
  else if (c === 'KeyQ' && e.getModifierState && !e.getModifierState('Control')) quickSwap();
  else if (c === 'KeyF') knifeButton(true, true);
  else if (c === 'KeyG') cookNade();
  else if (c === 'KeyE') { if (!mechaUse()) swapWithDrop(); } // within reach of your mecha: climb aboard
  else if (c === 'KeyC') { if (!trySlide()) PL.crouchToggle = !PL.crouchToggle; }
  else if (c === 'ControlLeft') trySlide();
  else if (c === 'Digit4') useKs(0);
  else if (c === 'Digit5') useKs(1);
  else if (c === 'Digit6') useKs(2);
  else if (c === 'KeyI') inspectWeapon();
}
/* Look speed when aiming compared to hip: mul = 1 changes nothing, 0.6 gives 60% of the speed without zoom. The factor follows the aim (VM.ads, 0 to 1) so
   the transition between the two is gradual. Adds to the reduction due to the field of view (0.35 + 0.65 x zoom), common to mouse and gamepad. */
function adsLookMul(mul) { return lerp(1, clamp(+mul || 1, 0.1, 2), smoothstep(0, 1, VM.ads)); }
/* Crouching during a sprint: slide (the final decision is made by ctlMove, which checks momentum, ground and wait) */
function trySlide() {
  const e = PL.ent;
  // while sprinting, or already sliding / just after with Shift held (chaining): the request is held by ctlMove
  if (!(PL.sprinting || e.slideT > 0 || (e.slideCd > 0 && (KEYS.ShiftLeft || TOUCH.sprint || PAD.sprint)))) return false;
  e.input.slide = true; return true;
}
addEventListener('keydown', (e) => onKey(e, true));
addEventListener('keyup', (e) => onKey(e, false));
addEventListener('mousemove', (e) => {
  if (MATCH.state !== 'playing' || !pointerActive() || CHAT.open || (TOUCH.on && performance.now() - TOUCH.lastT < 800)) return; // the mouse the browser simulates after a touch doesn't count
  mouseDX += e.movementX || 0; mouseDY += e.movementY || 0;
});
addEventListener('mousedown', (e) => {
  if (TOUCH.on && performance.now() - TOUCH.lastT < 800) return;
  if (e.button === 0 && (MATCH.state === 'killcam' || (MATCH.state === 'playing' && !PL.ent.alive && pointerActive()))) { kcSkip(); return; }
  if (MATCH.state !== 'playing' || !pointerActive() || CHAT.open) return;
  if (performance.now() < PL.noFireT) return; // second click of a double-click on Deploy or Resume: not a shot
  if (KS.map.open) { if (e.button === 0) ksConfirm(); else if (e.button === 2) ksCancel(); return; }
  if (e.button === 0) { if (trackpadOn()) trackpadClick(e); else { PL.held = true; PL.queued = true; } } // touchpad: auto-fire, double-click to aim (09qe-touchpad.js)
  if (e.button === 2) { if (adsToggleMode()) adsToggleClick(); else PL.adsWant = true; }
});
addEventListener('mouseup', (e) => { if (TOUCH.on && performance.now() - TOUCH.lastT < 800) return; if (e.button === 0) { PL.held = false; TPAD.down = false; } if (e.button === 2 && !adsToggleMode()) PL.adsWant = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('wheel', (e) => {
  if (MATCH.state !== 'playing' || !pointerActive()) return;
  if (KS.map.open || trackpadOn()) return; // on the touchpad, two-finger scrolling doesn't switch weapons
  quickSwap();
}, { passive: true });
addEventListener('blur', () => { for (const k in KEYS) KEYS[k] = false; PL.held = false; TPAD.down = false; PL.adsWant = false; PL.knifeBtn = null; });

/* ---------- Actions ---------- */
function busy() { return PL.switching > 0 || PL.knifeT > 0 || PL.nadeState || !PL.ent.alive || !!KS.mode || !!PILOT.d || !!MECHA_P.me; }
function startReload() { PL.ent.busy = busy(); ctlStartReload(PL.ent); }
function switchWeapon(i) {
  if (PL.knifeT > 0 || PL.nadeState || !PL.ent.alive || KS.mode) return;
  if (PL.knifeOut) { knifeStow(i); return; }
  PL.ent.busy = false; ctlSwitch(PL.ent, i);
}
/* Switch weapon (Q, wheel, button): the other weapon, or, with the knife in hand, the one held before */
function quickSwap() { switchWeapon(PL.knifeOut ? PL.cur : 1 - PL.cur); }
function knife() {
  if (PL.knifeT > 0 || PL.nadeState || !PL.ent.alive || KS.mode || playHold()) return;
  kcEvent('knife', { sid: PL.ent.kcI, neu: PL.knifeOut }); // the killcam replays the shot
  PL.actT = MATCH.time; // the player acts: their hit has its marker (hitFeedback), like a bullet
  PL.knifeT = KNIFE_DUR; PL.knifeNew = PL.knifeOut; PL.knifeHit = false; PL.knifePull = 0; PL.knifeKick = false; VM.lowerTarget = 1; PL.reload = null; VM.action = null;
  setTimeout(() => { if (PL.knifeT > 0) sfxMech('knife'); }, KNIFE_DUR * 200); // the blade's whoosh goes with the sweep, not the wind-up
  PL.knifeTarget = knifePick();
}
/* Target of a knife lunge: a nearby enemy in front of you */
function knifePick() {
  const f = camFwd(new V3());
  let best = null, bd = 4.2;
  for (const e of entities) {
    if (!e.alive || allied(e, PL.ent)) continue;
    const d = e.pos.distanceTo(PL.ent.pos); if (d > bd) continue;
    const to = entChest(e, new V3()).sub(camera.position).normalize();
    if (to.dot(f) < (d < KNIFE_MAG.near ? KNIFE_MAG.cone : 0.82)) continue; // at very close range, the cone is a bit wider
    if (!lineClear(camera.position, entChest(e, new V3()))) continue;
    best = e; bd = d;
  }
  return best;
}
/* Knife in hand, as in Counter-Strike: you run faster (KNIFE_MOVE), a click strikes, the weapon no longer fires or aims. Holding the knife
   button (F, on-screen button, R3) draws it; a weapon key (1, 2, Q, wheel, Switch weapon) puts it away. A brief press remains a knife strike. It goes off on
   release, so that we know whether the knife was to be drawn, unless an enemy is within reach or the knife is already in hand: then the strike goes off right away,
   in the middle of close combat the wait isn't worth it. */
const KNIFE_HOLD = 0.3;
function knifeButton(down, key) {
  if (down) {
    if (PL.knifeBtn) return;
    const hit = PL.knifeOut || !!knifePick();
    if (hit) knife();
    PL.knifeBtn = { t: 0, hit, eq: false, key: !!key }; // eq: the knife was drawn by this press; key: keyboard press (KEYS.KeyF says whether it lasts)
  } else {
    const b = PL.knifeBtn; PL.knifeBtn = null;
    if (b && !b.hit && !b.eq) knife();
  }
}
function knifeButtonTick(dt) {
  const b = PL.knifeBtn; if (!b) return;
  if (MATCH.state !== 'playing' || (b.key && !KEYS.KeyF)) { PL.knifeBtn = null; return; } // pause, or key released without the game knowing (window left): the release won't come
  if (PL.knifeOut || b.eq) return;
  if ((b.t += dt) >= KNIFE_HOLD && knifeDraw()) b.eq = true; // (a gesture in progress, grenade or weapon switch, delays the draw until it finishes)
}
function knifeDraw() {
  const A = PL.ent.arms;
  if (PL.knifeOut || PL.nadeState || !PL.ent.alive || KS.mode || playHold() || A.switching > 0) return false;
  PL.knifeOut = true; PL.knifeHold = PL.knifeT > 0 && PL.knifeNew ? 1 : 0; // in the middle of a knife strike in hand, the arm is already there; after the original strike, it comes back up
  A.reload = null; A.boltT = 0; VM.action = null; VM.lowerTarget = 1;
  sfxMech('draw');
  return true;
}
/* Put the knife away and bring out weapon i (the one held before, or the other): same animation as a weapon switch, the weapon is already lowering */
function knifeStow(i) {
  PL.knifeOut = false; PL.ent.busy = false;
  ctlSwitch(PL.ent, i, true);
}
/* Weapon inspection: only at rest (no reload, no aim, no sprint); any combat action interrupts it */
function inspectWeapon() {
  if (busy() || PL.knifeOut || PL.reload || PL.ads || PL.sprinting || VM.action || PL.boltT > 0) return;
  vmStartAction('inspect', curW().def.fam === 'pistol' ? INSPECT_PISTOL.dur : INSPECT_LONG.dur);
}
/* Grenade, as in CoD: press = pin pull (always played in full), hold = cooking
   (the fuse runs as soon as the spoon pops), release = overhand throw.
   A brief press throws as soon as the pin is out, full fuse. Times in seconds. */
const NADE_ANIM = { pin: 0.24, pull: 0.42, release: 0.12, raise: 0.19, throw: 0.38 };
function cookNade() {
  if (PL.nades <= 0 || PL.nadeState || PL.knifeT > 0 || PL.switching > 0 || !PL.ent.alive || KS.mode || playHold()) return;
  PL.nadeState = 'pull'; PL.nadeT = 0; PL.cookT = 0; PL.nadeQueued = false; PL.nadePin = false; PL.nadeFuse = false; PL.nadeThrown = false;
  if (PL.nadeType === 'knife') { PL.nadeT = NADE_ANIM.pin + 0.01; PL.nadePin = true; } // throwing knife: no pin, it is in hand right away
  // the weapon dips out of view while the grenade rises (a bit slower than a weapon switch)
  VM.lowerTarget = 1; VM.lowerRate = 8; PL.reload = null; VM.action = null;
  sfxMech('ads');
}
function releaseNade() {
  if (PL.nadeState === 'pull') PL.nadeQueued = true;
  else if (PL.nadeState === 'cook') startThrow();
}
function startThrow() {
  PL.nades--; PL.nadeState = 'throw'; PL.nadeT = 0; PL.nadeThrown = false;
  // wind-up: the torso pivots to the right and arches, the view follows
  PL.vpP += 0.55; PL.vpY -= 0.45; PL.vrollP -= 0.55; PL.vlunge -= 0.35;
  sfxMech('windup');
}
/* Start of a player's throw (p, v): from the hand, at the top right of the screen, without going through a very close wall; the speed follows the look and
   keeps only the forward momentum (NADE.carry: until 5.0, all the momentum, and a sidestep made it drift) */
function nadeLaunch(p, v) {
  // (direction: the aimed look, not the camera, which the throw's wind-up tilts before the grenade leaves)
  const e = PL.ent, cp = Math.cos(PL.pitch), f = _nlF.set(-Math.sin(PL.yaw) * cp, Math.sin(PL.pitch), -Math.cos(PL.yaw) * cp), right = _nlR.crossVectors(f, UP).normalize();
  const want = _nlW.copy(camera.position).addScaledVector(f, 0.5).addScaledVector(right, 0.08); want.y += 0.08;
  const to = _nlT.copy(want).sub(camera.position), len = to.length(); to.divideScalar(len);
  const h = rayWorld(camera.position.x, camera.position.y, camera.position.z, to.x, to.y, to.z, len + 0.1);
  if (h) p.copy(camera.position).addScaledVector(to, Math.max(0.05, h.t - 0.12)); else p.copy(want);
  const fl = hyp(f.x, f.z) || 1, fx = f.x / fl, fz = f.z / fl, ahead = Math.max(0, e.vel.x * fx + e.vel.z * fz) * NADE.carry;
  v.copy(f).multiplyScalar(NADE.speed); v.x += fx * ahead; v.z += fz * ahead; v.y += NADE.up + Math.max(0, e.vy) * 0.5;
}
const _nlF = new V3(), _nlR = new V3(), _nlW = new V3(), _nlT = new V3();
function throwNadeNow() {
  const e = PL.ent, p = new V3(), v = new V3(); nadeLaunch(p, v);
  if (PL.nadeType === 'knife') { throwKnifeNow(p); return; }
  const fuse = Math.max(0.1, nadeFuse(PL.nadeType) - PL.cookT);
  spawnNade(e, p, v, fuse, PL.nadeType); PL.actT = MATCH.time;
  if (MATCH.online) netEvent({ k: 'nade', px: +p.x.toFixed(2), py: +p.y.toFixed(2), pz: +p.z.toFixed(2), vx: +v.x.toFixed(2), vy: +v.y.toFixed(2), vz: +v.z.toFixed(2), fu: +fuse.toFixed(2), ty: PL.nadeType });
  if (!PL.nadeFuse) { PL.nadeFuse = true; sfxMech('spoon'); vmSpoon(); } // direct throw: the spoon pops as it leaves the hand
  sfxMech('throw');
  // release: the torso tilts forward and left, the view dips, tilts and widens for a moment
  PL.vpP -= 1.5; PL.vpY += 0.75; PL.vrollP += 1.25; PL.vlunge += 1.4; PL.fovK = (PL.fovK || 0) + 5; VM.swayTX -= 0.05;
}
/* Throwing knife: from the hand toward what is at the center of the view (scenery or a soldier, 80 m at most), at THROW_KNIFE.speed m/s (07-bots.js), aiming
   slightly above so that gravity brings it back onto the aimed point */
function throwKnifeNow(p) {
  const e = PL.ent, c = camera.position, cp = Math.cos(PL.pitch), f = _nlF.set(-Math.sin(PL.yaw) * cp, Math.sin(PL.pitch), -Math.cos(PL.yaw) * cp);
  const h = rayWorld(c.x, c.y, c.z, f.x, f.y, f.z, 80, 1), eh = rayEntities(c, f, h ? h.t : 80, e);
  const aim = c.clone().addScaledVector(f, eh ? eh.t : h ? h.t : 80), to = aim.sub(p), T = to.length() / THROW_KNIFE.speed, v = to.normalize().multiplyScalar(THROW_KNIFE.speed);
  v.y += 0.5 * THROW_KNIFE.g * T; // gravity compensated: it arrives where you aim, in a slight arc at long range
  spawnThrowKnife(e, p, v); PL.actT = MATCH.time;
  if (MATCH.online) netEvent({ k: 'nade', px: +p.x.toFixed(2), py: +p.y.toFixed(2), pz: +p.z.toFixed(2), vx: +v.x.toFixed(2), vy: +v.y.toFixed(2), vz: +v.z.toFixed(2), fu: 0, ty: 'knife' });
  sfxMech('throw');
  PL.vpP -= 1.2; PL.vpY += 0.6; PL.vrollP += 1; PL.vlunge += 1.1; VM.swayTX -= 0.04;
}
/* Predicted trajectory while holding a grenade (Settings.nadeArc; reference: Apex, Battlefield): dots along the path, up to the
   first impact (ground, scenery), one every NADE_ARC.gap m, and a circle where it lands. Same throw and same gravity as the real one (nadeLaunch, NADE); bounces are not
   predicted. Objects placed once (nadeWarm, 07-bots.js: compiled at load), hidden out of the grab */
const NADE_ARC = { n: 60, dt: 1 / 30, gap: 0.7, pts: null, ring: null, p: new V3(), v: new V3(), q: new V3() };
function nadeArcUpdate() {
  const A = NADE_ARC, on = Settings.nadeArc !== false && (PL.nadeState === 'pull' || PL.nadeState === 'cook') && PL.ent.alive && !KS.mode && PL.nadeType !== 'knife'; // (the knife goes straight: aim with the crosshair)
  if (!A.pts) return;
  A.pts.visible = A.ring.visible = on; if (!on) return;
  const p = A.p, v = A.v, q = A.q, pos = A.pts.geometry.attributes.position, R = NADE.r;
  A.pts.material.size = 4 * (RS.h > 1 ? RS.h : VIEW.h * renderPixelRatio()) / Math.max(1, VIEW.h); // 5 px of the screen, whatever the image resolution (pointScale)
  nadeLaunch(p, v);
  let k = 0, hit = null, run = A.gap * 0.6;
  for (let i = 0; i < A.n * 2 && !hit; i++) { // 2 s of flight at most, in half steps
    q.copy(p); v.y -= NADE.g * A.dt / 2; p.addScaledVector(v, A.dt / 2); run += p.distanceTo(q);
    const g = groundHeight(p.x, p.z, q.y, 0.05, true);
    if (p.y < g + R) { p.y = g + R; hit = 'y'; break; }
    for (const c of queryBoxes(p.x - 0.1, p.z - 0.1, p.x + 0.1, p.z + 0.1)) {
      if (c.inv || c.ray || (c.noRay && c.m === 'glass')) continue;
      if (p.x < c.x0 - R || p.x > c.x1 + R || p.z < c.z0 - R || p.z > c.z1 + R || p.y < c.y0 - R || p.y > c.y1 + R) continue;
      if (q.y >= c.y1 + R - 0.02) { p.y = c.y1 + R; hit = 'y'; } else if (q.x < c.x0 - R || q.x > c.x1 + R) hit = 'x'; else if (q.z < c.z0 - R || q.z > c.z1 + R) hit = 'z'; else hit = 'y';
      if (hit !== 'y') p.copy(q);
      break;
    }
    if (!hit && run >= A.gap && k < A.n) { pos.setXYZ(k++, p.x, p.y, p.z); run = 0; }
  }
  for (let i = k; i < A.n; i++) pos.setXYZ(i, p.x, p.y, p.z); // the extra dots on the landing point
  pos.needsUpdate = true; A.pts.geometry.setDrawRange(0, Math.max(1, k));
  // landing circle: flat on a floor, upright against a wall
  A.ring.position.copy(p); A.ring.visible = !!hit;
  if (hit === 'y') A.ring.rotation.set(-Math.PI / 2, 0, 0); else A.ring.rotation.set(0, hit === 'x' ? Math.PI / 2 : 0, 0);
}
/* Death with a cooked grenade in hand: it falls at the feet, fuse running (as in CoD) */
function dropCookedNade() {
  if (!PL.nadeState || !PL.nadeFuse || PL.nadeThrown) return;
  const e = PL.ent, p = e.pos.clone().add(new V3(0, 1.1, 0)), v = new V3(e.vel.x * 0.5, 0.5, e.vel.z * 0.5);
  const fuse = Math.max(0.1, nadeFuse(PL.nadeType) - PL.cookT);
  spawnNade(e, p, v, fuse, PL.nadeType);
  if (MATCH.online) netEvent({ k: 'nade', px: +p.x.toFixed(2), py: +p.y.toFixed(2), pz: +p.z.toFixed(2), vx: +v.x.toFixed(2), vy: +v.y.toFixed(2), vz: +v.z.toFixed(2), fu: +fuse.toFixed(2), ty: PL.nadeType });
}
function camFwd(out) { return camera.getWorldDirection(out); }

/* ---------- Firing ---------- */
function playerShotFx(d, ads, f, muzzle, kv, kh, hitAny) {
  PL.shots++; NET.shots++; if (hitAny) PL.hits++;
  PL.yaw = PL.ent.yaw; PL.pitch = PL.ent.pitch;
  const F = d.feel;
  PL.vpP += kv * 30 * (1 + F.shake) * F.punch; PL.vpY += kh * 20 + (Math.random() - 0.5) * F.shake * 0.6; PL.vrollP += (Math.random() - 0.5) * F.roll * 0.35;
  PL.shake = Math.max(PL.shake, F.shake); PL.fovK = (PL.fovK || 0) + F.fov;
  if (F.shake > 0.3) { FinalShader.uniforms.uFlash.value = Math.max(FinalShader.uniforms.uFlash.value, 0.05 * F.shake); PL.aberr = 2.2 * F.shake; }
  const mw = camera.position.clone().addScaledVector(f, 0.9);
  for (let i = 0; i < Math.ceil(F.smoke * 5); i++) FX.smoke.spawn(mw.x, mw.y - 0.05, mw.z, f.x * rand(0.5, 2) + rand(-0.3, 0.3), rand(0.1, 0.5), f.z * rand(0.5, 2) + rand(-0.3, 0.3), rand(0.6, 1.4), 0.12, rand(0.5, 1.1) * (0.5 + F.smoke), 0.62, 0.6, 0.57, 0.14 * F.smoke + 0.05, 0, 0, 1.4, rand(-1, 1));
  if (d.bolt) { for (let s2 = 2; s2 < 90; s2 += 1.6) { const p = camera.position.clone().addScaledVector(f, s2); FX.smoke.spawn(p.x, p.y, p.z, rand(-0.05, 0.05), rand(0, 0.06), rand(-0.05, 0.05), rand(1.2, 2.2), 0.08, 0.35, 0.75, 0.74, 0.72, 0.1, 0, 0, 0.3); } }
  // burst of sparks at the muzzle and crosshair jolt: the shot is seen before it is heard
  for (let i = 0; i < F.spark; i++) FX.add.spawn(mw.x, mw.y - 0.06, mw.z, f.x * rand(3, 11) + rand(-2.5, 2.5), f.y * rand(3, 11) + rand(-1.5, 3), f.z * rand(3, 11) + rand(-2.5, 2.5), rand(0.06, 0.16), 0.007, 0.002, 4, 2.4, 1.0, 1, 0, 2, 2);
  HUD.kick = Math.min(16, HUD.kick + 2 + d.recoil.kick * 80);
  vmKick(d, ads > 0.5);
  padRumble(0.18 + d.recoil.kick * 40, 0.5, 45);
  if (!d.bolt && !d.pump) vmShell(d);
  sfxGun(d.sound, null);
  if (!d.silent) flashLight(muzzle, 3, 8, 0.05);
}

/* ---------- Update ---------- */
function updatePlayer(dt, now) {
  const e = PL.ent;
  if (!e.alive) { updateDeadPlayer(dt); return; }
  const w = curW(), d = w.def;
  // regard
  if (KS.map.open) { ksMapMouse(mouseDX, mouseDY); mouseDX = 0; mouseDY = 0; }
  const zoom = camera.fov / Settings.fov;
  const s = 0.0021 * (trackpadOn() ? Settings.tpSens : Settings.sens) * (0.35 + 0.65 * zoom) * adsLookMul(Settings.adsMul); // on the touchpad, its own sensitivity (09qe-touchpad.js)
  const ak = PILOT.d ? 1 : aimAssist(dt); // (aboard the mecha too: on touch, its auto-fire holds the trigger, mechaPilot) // aim assist on touch and gamepad: slowdown, snap, tracking, auto-fire (09qd-aim.js)
  const pitch0 = PL.pitch;
  PL.yaw -= mouseDX * s * ak; PL.pitch -= mouseDY * s * ak * (Settings.invertY ? -1 : 1);
  VM.swayTX += mouseDX * 0.0006; VM.swayTY += mouseDY * 0.0006;
  mouseDX = 0; mouseDY = 0;
  if (PAD.drive) padLook(dt); // gamepad (09qc-gamepad.js)
  recoilTick(dt, now, PL.pitch - pitch0); // aim recovery after a shot; what the player just pulled back by hand counts (07ca-recoil.js)
  PL.pitch = clamp(PL.pitch, -1.5, 1.5);
  if (MECHA_P.me) { mechaPilot(dt, now); return; } // aboard the mecha (08g-mecha-pilote.js)
  if (PILOT.d) { fpvPlayer(dt, now); return; } // kamikaze drone: look and movement fly it, the body stays in place (08e-fpv.js)

  // keyboard and mouse inputs to the common controller; only the airstrike's fullscreen map
  // immobilizes the player (drone, tablet being drawn or stowed: we keep moving forward), and the start countdown
  // (09y-countdown.js: you look around, reload, switch weapon, but no steps, jump, aim or shot)
  const hold = playHold(), I = e.input, lockMove = KS.map.open || hold;
  // on touch: analog joystick and sprint at full forward push (09q-touch.js); Shift then holds the breath (button)
  const fw = lockMove ? 0 : padClamp((TOUCH.on ? TOUCH.mz : (KEYS.KeyW || KEYS.ArrowUp ? 1 : 0) - (KEYS.KeyS || KEYS.ArrowDown ? 1 : 0)) + PAD.mz);
  const st = lockMove ? 0 : padClamp((TOUCH.on ? TOUCH.mx : (KEYS.KeyD || KEYS.ArrowRight ? 1 : 0) - (KEYS.KeyA || KEYS.ArrowLeft ? 1 : 0)) + PAD.mx);
  const run = (TOUCH.on ? TOUCH.sprint : !!KEYS.ShiftLeft) || PAD.sprint;
  if (run && fw > 0 && PL.crouchToggle) PL.crouchToggle = false;
  if (KEYS.Space && e.crouch && PL.onGround) PL.crouchToggle = false;
  // shooting during a run interrupts it, whatever the input (the controller doesn't shoot while sprinting, ctlWeapon): while the
  // trigger is held, and for a shot requested while running until it has gone off (runShot: leaving the run takes a moment,
  // a brief press must still fire, automatic weapon included). The run then resumes if it is still requested (Shift held,
  // joystick fully pushed); on gamepad, the sprint started by L3 is cancelled (padPlay), as in the Call of Duty games
  const canShoot = !hold && !busy() && !PL.knifeOut && !PL.reload && PL.switching <= 0 && curW().mag > 0;
  if (PL.queued && (PL.sprinting || e.arms.sprintW > 0.3)) PL.runShot = true;
  if (!canShoot) PL.runShot = false;
  I.mz = fw; I.mx = st; I.sprint = run && !lockMove && !(canShoot && (PL.held || PL.runShot)); I.crouch = PL.crouchToggle || !!KEYS.ControlLeft; I.jump = !!KEYS.Space && !lockMove;
  I.ads = PL.adsWant && !hold; I.fire = (PL.held || PL.runShot) && !hold; I.firePressed = PL.queued && !hold;
  if (hold) PL.queued = false; // a shot requested during the countdown doesn't go off at the start (a held trigger does)
  e.busy = busy(); e.blockSprint = !!PL.nadeState; e.sprintBusyOk = KS_PHONE.has(KS.mode);
  e.yaw = PL.yaw; e.pitch = PL.pitch;
  const mv = ctlMove(e, dt);
  if (voidCheck(e) || ringCheck(e, dt)) return; // fell into the void (floating islands), or stayed too long outside the round zone
  // end of a slide on the ground (not a jump): the player stays crouched; Shift while moving forward, jump or C raise them
  if (PL.wasSliding && !(e.slideT > 0) && !mv.jumped && e.onGround && e.alive) PL.crouchToggle = true;
  PL.wasSliding = e.slideT > 0;
  // (5.1, more pronounced: slide, jump, landing and sprint start marked more)
  if (mv.slid) { sfxSlide(); e.dustT = 0; VM.vland += 0.65; PL.fovK = 6.5; PL.vpP += 0.7; PL.vrollP += 0.35; }
  if (mv.jumped) { VM.vland -= 0.75; sfxJump(surfaceAt(e.pos)); }
  if (e.slideT > 0) slideDust(e, dt);
  if (mv.landed) { const lk = clamp(-mv.landed * 0.08, 0.3, 1.3); VM.vland += lk * 1.5; sfxLand(surfaceAt(e.pos), lk); PL.punchP -= 0.016 + 0.026 * lk; PL.vrollP += (Math.random() < 0.5 ? -1 : 1) * 0.32 * lk; }
  const ads = !!e.adsActive; if (ads !== !!PL.ads && e.alive) sfxMech('ads'); PL.ads = ads; // shouldered and released: cloth rustle, click
  if (VM.action === 'inspect' && (PL.held || PL.adsWant || PL.sprinting || PL.reload || !PL.onGround)) VM.actFade = true;
  const hs = hyp(e.vel.x, e.vel.z);
  // sway synced to real strides (half a cycle per step, 2.1 m walking, 2.7 m sprinting);
  // the footstep sound falls at the low point of the sway, when the foot lands
  PL.bobA = damp(PL.bobA, PL.onGround && !e.slideT ? clamp(hs / 5, 0, 1.5) : 0, 8, dt);
  PL.bobT += dt * Math.PI * hs / (PL.sprinting ? 2.7 : 2.1);
  const stepPh = Math.floor((PL.bobT * 2 + Math.PI / 2) / TAU);
  if (stepPh !== PL.stepPh) {
    PL.stepPh = stepPh;
    if (PL.onGround && hs > 0.8 && !e.slideT && !(e.crouch && !PL.sprinting)) {
      const sf = surfaceAt(e.pos); sfxStep(null, PL.sprinting ? 0.3 : 0.18, sf); if (sf === 'water') stepSplashFx(e.pos, hs, e.vel);
      // each planted foot is felt: the weapon sinks slightly, the head dips when sprinting (a small damped bump, not a tremor)
      const sk = (1 - VM.ads) * clamp(hs / 6.5, 0, 1); VM.vland += (PL.sprinting ? 0.16 : 0.06) * sk; if (PL.sprinting) { PL.vpP -= 0.16 * sk; PL.vrollP += (stepPh & 1 ? 0.1 : -0.1) * sk; }
    }
  }
  // sprint start: the view widens at once and the head dives forward
  if (PL.sprinting && !PL.wasSprint && PL.onGround) { PL.fovK = (PL.fovK || 0) + 3; PL.vpP -= 0.45; }
  PL.wasSprint = PL.sprinting;

  if (PL.knifeT > 0) {
    PL.knifeT -= dt;
    const T = PL.knifeTarget;
    if (T && T.alive && PL.knifeT > KNIFE_DUR * (1 - KNIFE_HIT) - 0.01) { const to = new V3().subVectors(T.pos, e.pos); to.y = 0; const dd = to.length(); if (dd > 1.1) { to.normalize(); if (!VOID.on || groundHeight(e.pos.x + to.x * 0.8, e.pos.z + to.z * 0.8, e.pos.y, 0.3) > e.pos.y - 0.6) { e.vel.x = to.x * 14; e.vel.z = to.z * 14; } } } // no lunge toward the void
    // start of the sweep: slight lunge of the view (field of view, pitch)
    if (!PL.knifeKick && PL.knifeT < KNIFE_DUR * 0.8) { PL.knifeKick = true; PL.fovK = (PL.fovK || 0) + 4; PL.vpP -= 0.7; }
    // magnetism: until the strike lands, the aim is pulled toward the torso of a very close target (at most
    // KNIFE_MAG.max radians in all, the mouse stays in charge: the gesture remains yours)
    if (T && T.alive && !PL.knifeHit && PL.knifePull < KNIFE_MAG.max) {
      const c = entChest(T, new V3()), dx = c.x - camera.position.x, dz = c.z - camera.position.z, dy = c.y - camera.position.y, hd = hyp(dx, dz);
      const w = 1 - smoothstep(KNIFE_MAG.near, KNIFE_MAG.range, hd);
      if (w > 0) {
        const ay = angDiff(e.yaw, Math.atan2(-dx, -dz)), ap = Math.atan2(dy, hd) - e.pitch, k = 1 - Math.exp(-KNIFE_MAG.rate * w * dt);
        let sy = ay * k, sp = ap * k; const m = hyp(sy, sp), room = KNIFE_MAG.max - PL.knifePull;
        if (m > room) { sy *= room / m; sp *= room / m; }
        e.yaw += sy; e.pitch = clamp(e.pitch + sp, -1.5, 1.5); PL.knifePull += hyp(sy, sp);
      }
    }
    if (!PL.knifeHit && PL.knifeT < KNIFE_DUR * (1 - KNIFE_HIT)) {
      PL.knifeHit = true;
      if (T && T.alive && T.pos.distanceTo(e.pos) < 2.2) { sfxMelee(); bloodFx(entChest(T, new V3()), camFwd(new V3()), false); kcEvent('melee', { sid: e.kcI, p: entChest(T, new V3()), dir: camFwd(new V3()) }); T.lastForce = { dir: camFwd(new V3()), mag: 6, lift: 1.4, part: 'body' }; applyDamage(T, 200, e, _t('Knife'), false, camFwd(new V3())); PL.vpY += 1.5; }
    }
    if (PL.knifeT <= 0) { VM.lowerTarget = PL.knifeOut ? 1 : 0; PL.knifeTarget = null; }
  }
  nadeArcUpdate();
  if (PL.nadeState) {
    PL.nadeT += dt;
    if (PL.nadeFuse && !PL.nadeThrown) {
      // fuse running in the hand: one click per second, then explosion if you wait too long
      PL.cookT += dt;
      if (Math.floor(PL.cookT) !== Math.floor(PL.cookT - dt)) sfxClick(null, 2600, 0.15);
      if (PL.cookT >= nadeFuse(PL.nadeType)) { if (PL.nadeState !== 'throw') PL.nades--; PL.nadeState = null; VM.lowerTarget = PL.knifeOut ? 1 : 0; VM.lowerRate = 16; nadeBurst(PL.nadeType, e.pos.clone().add(new V3(0, 1, 0)), e); } // held too long: in the hand
    }
    if (PL.nadeState === 'pull') {
      if (!PL.nadePin && PL.nadeT >= NADE_ANIM.pin) { PL.nadePin = true; sfxMech('pin'); PL.vpY += 0.25; }
      if (PL.nadeT >= NADE_ANIM.pull) {
        if (PL.nadeQueued) startThrow();
        else { PL.nadeState = 'cook'; PL.nadeT = 0; if (NADE_TYPES[PL.nadeType].cook) { PL.nadeFuse = true; sfxMech('spoon'); vmSpoon(); } } // flash, smoke: the spoon stays, the fuse only starts at the throw
      }
    } else if (PL.nadeState === 'throw') {
      if (!PL.nadeThrown && PL.nadeT >= NADE_ANIM.release) { PL.nadeThrown = true; throwNadeNow(); }
      if (PL.nadeT >= NADE_ANIM.raise) VM.lowerTarget = PL.knifeOut ? 1 : 0;
      if (PL.nadeT >= NADE_ANIM.throw) { PL.nadeState = null; VM.lowerRate = 16; }
    }
  }
  // knife in hand: the click delivers strikes (as long as it is held, one strike after another) in place of shots; the hand comes out and goes back with knifeHold
  knifeButtonTick(dt);
  if (PL.knifeOut) { if ((PL.queued || PL.held) && !hold) knife(); PL.queued = false; }
  PL.knifeHold = damp(PL.knifeHold, PL.knifeOut && !PL.nadeState && !KS.mode && !(PL.knifeT > 0 && !PL.knifeNew) ? 1 : 0, PL.knifeOut ? 8 : 12, dt); // the draw is visible (0.3 s), the stowing is snappier
  // weapon: same controller as the bots
  const shotsBefore = e.arms.shots;
  ctlWeapon(e, dt, now);
  if (e.arms.shots !== shotsBefore || curW().mag <= 0 || PL.sprinting) PL.queued = false;
  if (e.arms.shots !== shotsBefore) PL.runShot = false;
  PL.yaw = e.yaw; PL.pitch = e.pitch;
  // held breath while scoped
  const scoped = d.scope && VM.ads > 0.9;
  PL.holding = scoped && (KEYS.ShiftLeft || PAD.l3) && PL.breath > 0;
  PL.breath = clamp(PL.breath + (PL.holding ? -dt / 4 : dt / 5), 0, 1);
  // regeneration
  if (now - PL.lastDmgT > 4.5 && e.health < 100) e.health = Math.min(100, e.health + 45 * dt);
  if (e.health < 40) { PL.heartT -= dt; if (PL.heartT <= 0) { sfxHeart(); PL.heartT = 0.9; } }
  PL.suppress = Math.max(0, PL.suppress - dt * 0.8);
  PL.ent.pitch = PL.pitch; PL.ent.yaw = PL.yaw;
  applyCamera(dt, now, scoped);
  // sun on the weapon: visible if the ray toward the sun is clear
  if ((PL.sunTick = (PL.sunTick || 0) + 1) % 6 === 0) {
    const h = rayWorld(camera.position.x, camera.position.y, camera.position.z, SUN_DIR.x, SUN_DIR.y, SUN_DIR.z, 120);
    PL.sunTarget = h ? 0 : 1;
  }
  VM.sunVis = damp(VM.sunVis, PL.sunTarget ?? 1, 4, dt);
  // speed in the look frame (strafe steps, push) and distance to the wall straight ahead (weapon retracted)
  const lat = e.vel.x * Math.cos(PL.yaw) - e.vel.z * Math.sin(PL.yaw), fwd = -e.vel.x * Math.sin(PL.yaw) - e.vel.z * Math.cos(PL.yaw);
  let wall = 0;
  if ((PL.wallTick = (PL.wallTick || 0) + 1) % 2 === 0) {
    const f = camFwd(_v1), h = rayWorld(camera.position.x, camera.position.y, camera.position.z, f.x, f.y, f.z, 0.95);
    PL.wall = h ? clamp((0.9 - h.t) / 0.45, 0, 1) : 0;
  }
  wall = PL.wall || 0;
  laserUpdate(!!d.laser && e.alive && !PL.sprinting && VM.ads < 0.35 && !PL.nadeState && PL.knifeT <= 0 && VM.lower < 0.3, dt);
  updateViewmodel(dt, { ads, sprint: PL.sprinting, speed: hs, grounded: PL.onGround, crouch: e.crouch, empty: curW().mag === 0, lat, fwd, fire: PL.held, wall, slide: e.slideAmt });
  // the player's invisible body: only used to cast their shadow
  const sm = e.model;
  if (sm) {
    if (sm.gunKey !== d.key) setSoldierGun(sm, d.key);
    e.recoil = 0; poseSoldier(e, dt); layoutSoldier(sm, true);
    sm.root.visible = false; // the invisible body's shadow created a stray black silhouette in front of the player
  }
  const rigS = { knifeT: PL.knifeT, knifeNew: PL.knifeNew, nadeState: PL.nadeState, nadeT: PL.nadeT, cookT: PL.cookT, knifeHold: PL.knifeHold, sprint: VM.sprint, speed: hs };
  if (KNIFE_DEBUG) KNIFE_DEBUG(rigS, dt); // knife tuning bench (?knife=1)
  if (NADE_DEBUG) NADE_DEBUG(rigS, dt); // grenade tuning bench (?grenade=1)
  updateRigs(dt, rigS);
}
/* Dust kicked up behind the feet during the slide */
function slideDust(e, dt) { // e: the player or a bot
  e.dustT = (e.dustT || 0) - dt;
  if (e.dustT > 0) return;
  e.dustT = 0.03;
  const dx = e.slideDx, dz = e.slideDz, k = clamp(e.slideT / 0.5, 0.3, 1), c = CURMAP.def.atmo.snow ? [0.88, 0.91, 0.95] : [0.58, 0.53, 0.45];
  FX.smoke.spawn(e.pos.x - dx * 0.4 + rand(-0.15, 0.15), e.pos.y + 0.05, e.pos.z - dz * 0.4 + rand(-0.15, 0.15), -dx * rand(0.4, 1.4) + rand(-0.4, 0.4), rand(0.3, 0.9), -dz * rand(0.4, 1.4) + rand(-0.4, 0.4), rand(0.5, 0.9), 0.1, 0.5, c[0], c[1], c[2], 0.32 * k, 0, 0, 1.6, rand(-1, 1));
}
function surfaceAt(p) {
  const g0 = RELIEF.on ? reliefAt(p.x, p.z) : 0; // implicit ground: the terrain of a dune map
  if (POOLS.length && (RELIEF.on || p.y < 0.25)) { const pl = poolAt(p.x, p.z); if (pl && (!RELIEF.on || p.y < pl.wl)) return 'water'; } // in a pool: you wade (steps, splashes, ripples); on an islet, no
  if (p.y > g0 + 0.1) { for (const c of queryBoxes(p.x, p.z, p.x, p.z)) if (Math.abs(c.y1 - p.y) < 0.05 && p.x >= c.x0 && p.x <= c.x1 && p.z >= c.z0 && p.z <= c.z1) return c.m; return 'concrete'; }
  return CURMAP.def.surface(p);
}
/* View spring on a step: angular frequency (rad/s) of a critically damped spring; the view catches up with the ground in about 0.2 s, without overshooting */
const STEP_CAM_W = 21;
function applyCamera(dt, now, scoped) {
  const e = PL.ent, d = curW().def;
  PL.vpP += (-180 * PL.punchP - 16 * PL.vpP) * dt; PL.punchP += PL.vpP * dt;
  // view shakes and field-of-view kicks from weapon gestures (magazine slammed, bolt: vmCamKick, 06cy-springs.js)
  const K = VM.camK; if (K[0] || K[1] || K[2] || K[3]) { PL.vpP += K[0]; PL.vpY += K[1]; PL.vrollP += K[2]; PL.fovK = (PL.fovK || 0) + K[3]; K.fill(0); }
  PL.vpY += (-180 * PL.punchY - 16 * PL.vpY) * dt; PL.punchY += PL.vpY * dt;
  // roll and torso lunge (grenade throw)
  PL.vrollP += (-150 * PL.rollP - 15 * PL.vrollP) * dt; PL.rollP += PL.vrollP * dt;
  PL.vlunge += (-120 * PL.lunge - 14 * PL.vlunge) * dt; PL.lunge += PL.vlunge * dt;
  PL.shake = Math.max(0, PL.shake - dt * 1.6);
  const sh = PL.shake * PL.shake * 0.04 + PL.suppress * 0.004;
  let sx = 0, sy = 0;
  if (scoped) {
    const k = PL.holding ? 0.08 : 1, t = now;
    sx = (Math.sin(t * 0.83) * 0.0065 + Math.sin(t * 1.91) * 0.003) * k; sy = (Math.sin(t * 1.13) * 0.005 + Math.cos(t * 0.57) * 0.0035) * k;
  }
  const bob = PL.bobA * (1 - VM.ads * 0.8), sw = e.arms.sprintW; // when sprinting, the head marks the strides more
  // scope re-cocking: the aim moves with the bolt without leaving the zoom
  if (scoped && PL.boltT > 0) { const k = 1 - PL.boltT / 1.05, w = Math.sin(clamp(k * 1.25, 0, 1) * Math.PI); sy -= w * 0.01; sx += w * 0.004; }
  PL.aberr = damp(PL.aberr || 0, 0, 9, dt);
  // step, curb, staircase: the ground snap (07c-controller.js) changes the player's height at once, up to STEP. The view doesn't follow this jump: the gap
  // made on foot is absorbed in a view offset (stepOff), brought back to zero by a critically damped spring (about 0.2 s).
  // In the air, the jump, fall and landing keep their exact height (the offset fades quickly); a gap larger than a step (spawn,
  // teleport) resets the view to zero.
  const dy = e.pos.y - PL.lastY;
  PL.lastY = e.pos.y;
  if (Math.abs(dy) > STEP + 0.1) { PL.stepOff = 0; PL.stepV = 0; }
  else if (e.onGround && PL.lastOn) {
    // exact solution of the damped spring over dt: the same curve at any frame rate (an Euler step gave, at 24 frames per second, half the step at once)
    const x = clamp(PL.stepOff - dy, -STEP - 0.1, STEP + 0.1), w = STEP_CAM_W, q = PL.stepV + w * x, ex = Math.exp(-w * dt);
    PL.stepOff = ex * (x + q * dt); PL.stepV = ex * (PL.stepV - w * q * dt);
  } else { PL.stepOff = damp(PL.stepOff, 0, 14, dt); PL.stepV = 0; }
  PL.lastOn = e.onGround;
  // stable head CoD-style: small camera movement, the weapon carries most of the sway
  camera.position.set(e.pos.x, e.pos.y + PL.stepOff + PL.eyeH + Math.sin(PL.bobT * 2) * (0.012 + 0.008 * sw) * bob, e.pos.z);
  camera.position.x += Math.cos(PL.yaw) * Math.cos(PL.bobT) * 0.007 * bob; camera.position.z -= Math.sin(PL.yaw) * Math.cos(PL.bobT) * 0.007 * bob;
  camera.position.x -= Math.sin(PL.yaw) * PL.lunge; camera.position.z -= Math.cos(PL.yaw) * PL.lunge;
  camera.rotation.set(PL.pitch + PL.punchP + sy + (Math.random() - 0.5) * sh + Math.sin(PL.bobT * 2) * 0.004 * sw * bob, PL.yaw + PL.punchY + sx + (Math.random() - 0.5) * sh, Math.cos(PL.bobT) * (0.003 + 0.005 * sw) * bob + VM.swayX * -0.02 + PL.rollP + (e.slideAmt || 0) * 0.045);
  PL.yawReal = PL.yaw;
  PL.fovK = damp(PL.fovK || 0, 0, 7, dt);
  const fovT = Settings.fov * lerp(1, d.adsFov, smoothstep(0, 1, VM.ads)) * (1 + 0.085 * sw + (e.slideAmt || 0) * 0.09) + PL.fovK * lerp(1, 0.35, VM.ads);
  if (Math.abs(camera.fov - fovT) > 0.01) { camera.fov = damp(camera.fov, fovT, 26, dt); camera.updateProjectionMatrix(); onResizeFx(); }
  const vf = vmFovAt(VM.fovHip, VM.ads);
  if (Math.abs(vmCamera.fov - vf) > 0.01) { vmCamera.fov = vf; vmCamera.updateProjectionMatrix(); }
}
function updateDeadPlayer(dt) {
  PL.deathT += dt;
  if (KC.active && KC.live) return; // online replay: the camera and weapon are the killer's (09b-killcam.js), what follows comes from endKillcam
  const e = PL.ent, k = smoothstep(0, 0.8, PL.deathT);
  if (e.voidDead) {
    // fall into the void: the view keeps falling while slowing down, turned toward the receding islands
    camera.position.set(e.pos.x, e.pos.y + PL.eyeH - 9 * (1 - Math.exp(-0.9 * PL.deathT)), e.pos.z);
    camera.rotation.set(lerp(PL.pitch, 0.8, smoothstep(0, 1.6, PL.deathT)), PL.yaw, 0);
  } else {
    camera.position.set(e.pos.x, e.pos.y + lerp(PL.eyeH, 0.35, k), e.pos.z);
    let yaw = PL.yaw;
    if (PL.killer && PL.killer.alive && PL.deathT > 0.9) { const dx = PL.killer.pos.x - e.pos.x, dz = PL.killer.pos.z - e.pos.z; yaw = PL.yaw + angDiff(PL.yaw, Math.atan2(-dx, -dz)) * smoothstep(0.9, 2, PL.deathT); }
    camera.rotation.set(lerp(PL.pitch, -0.1, k), yaw, lerp(0, 0.5, k));
  }
  VM.holder.visible = false; vmClearHeld();
  if (e.model) e.model.root.visible = false;
  if (KC.pending && PL.deathT > 1.2 && MATCH.state === 'playing' && !MATCH.finalPending) { if (startKillcam({ killer: KC.pending, victim: PL.ent, tEnd: KC.deathT, info: KC.info })) return; KC.pending = null; $('death').classList.remove('kcnext'); } // (no replay: the respawn bar comes back)
  if (PL.deathT > modeDef().respawn && MATCH.state === 'playing' && !KC.pending && !MATCH.finalPending) respawnPlayer();
}
function respawnPlayer() {
  spawnEntity(PL.ent);
  PL.yaw = PL.ent.yaw; PL.pitch = 0; PL.eyeH = 1.62; PL.onGround = true; PL.crouchToggle = false;
  giveLoadout(); PL.ent.arms.recPend = 0;
  // the weapon in hand always comes back: the kamikaze drone and the mecha hide it while you pilot them, and a death at the controls (fpvLeave,
  // mechaExit, player already dead) didn't give it back; without a killcam (death by explosion, drone, helicopter), you respawned empty-handed
  VM.root.visible = true; VM.holder.visible = true;
  hideDeathScreen();
}
