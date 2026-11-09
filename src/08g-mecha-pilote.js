/* ==========================================================================
   PILOTED MECHA (streak at 13)
   Landed, the mecha waits in place and shoots on its own at the enemies it sees (08f-mecha.js). Its owner climbs aboard by coming
   within MECHA_P.reach m (E, Mecha button on touch, X held on gamepad: the prompt under the crosshair says so); their soldier disappears
   into the canopy, sheltered as long as the mecha holds (bullets and blasts make it heat). The same command makes them get out (landed
   on the ground, not mid-jump). When it overheats, it blinks, the alarm sounds, you must get out: at full overheat it explodes, and the pilot
   left on board dies (mechaOverheat).
   Aboard, first-person view from the cockpit (mechaCockpit). Soldier controls: forward, back, strafe (the legs
   turn toward the look), jump, look (the torso follows, slightly behind: the mass; the cockpit lags by as much in the view), aim
   (light zoom), fire (the guns spin up, then the two pods fire in alternation toward the center of the view). Each step shakes
   the view. Piloted, it has its own physics (mechaPhys): collision at its hull radius against the scenery (collideCircle), gravity, jump, fall
   from a roof; it passes through nothing and gets stuck nowhere.
   ========================================================================== */
const MECHA_P = { me: null, reach: 3.2, turn: 12, legs: 2.8, spin: 0.06, spinDown: 3, spread: 0.35, dmg: 20, splash: { r: 1.6, dmg: 14 }, cock: null, in: { fw: 0, st: 0, fire: false, jump: false }, jolt: 0, scrT: 0, t0: 0, alarmT: 0 };
const MECHA_J = { vy: 9.5, g: 22, r: 0.85, h: 2.6, crush: 1.6 }; // jump: launch speed (2 m high), gravity; hull: radius, height; squash on landing
const _mpA = new V3(), _mpB = new V3(), _mpC = new V3();

/* ---------- Aboard, on the ground ---------- */
/* A soldier is aboard (me) or not (null): hidden, neither aimed at nor hit (rayEntities, botSense, mechaPick) */
function mechaSeat(e, me) {
  if (!e || e.inMecha === me) return;
  e.inMecha = me; if (e.model) e.model.root.visible = !me && e.alive; // (the player's body is only used for its shadow: it disappears too)
}
/* The player's mecha they can climb into: their own, landed, without a pilot, within range */
function mechaNear() {
  const e = PL.ent; if (!e.alive || MECHA_P.me || KS.mode || PILOT.d) return null;
  for (const me of MECHAS) if (me.owner === e && me.local && me.state === 'fight' && !me.pilot && hyp(me.pos.x - e.pos.x, me.pos.z - e.pos.z) < MECHA_P.reach && Math.abs(me.pos.y - e.pos.y) < 2.5) return me;
  return null;
}
/* The use command (E, button, X held): get out, or get in; false if nothing to do (it then serves to pick up a weapon) */
function mechaUse() {
  if (MECHA_P.me) { if (!MECHA_P.me.air) mechaExit(MECHA_P.me); return true; } // (not mid-jump)
  const me = mechaNear(); if (!me) return false;
  mechaBoard(me); return true;
}
function mechaBoard(me) {
  const e = PL.ent;
  me.pilot = e; MECHA_P.me = me; mechaSeat(e, me);
  me.tgt = null; me.spinWant = 0; me.want.set(0, 0, 0); me.vy = 0; me.air = false;
  PL.held = PL.queued = PL.adsWant = false; PL.reload = null; VM.action = null;
  PL.yaw = me.yaw + (me.turret || 0); PL.pitch = 0; me.aimYaw = PL.yaw;
  me.m.root.visible = false; VM.root.visible = false;
  const C = mechaCockpit(); C.root.visible = true;
  $('hud').classList.add('mecha'); MECHA_P.scrT = 0; MECHA_P.t0 = MATCH.time;
  sfxMechaHiss(me.pos, 1); sfxMechaServo(me.pos, 1, 0.8); sfxMech('stow');
}
/* Get out (or be ejected): the soldier reappears next to the mecha, on the bots' network, on the clearest side */
function mechaExit(me) {
  const e = me.pilot; if (!e) return;
  me.pilot = null; me.want.set(0, 0, 0); me.firing = false; me.spinWant = 0; mechaSeat(e, null);
  if (e !== PL.ent) return;
  MECHA_P.me = null; MECHA_P.in.fire = false;
  const a = me.yaw + (me.turret || 0), c = _mpA.set(me.pos.x, me.pos.y + 1.2, me.pos.z);
  let spot = null;
  for (const da of [Math.PI, Math.PI / 2, -Math.PI / 2, 0]) {
    const x = me.pos.x - Math.sin(a + da) * 1.9, z = me.pos.z - Math.cos(a + da) * 1.9, id = navNode(x, me.pos.y, z);
    if (id < 0 || hyp(NAV.nx[id] - x, NAV.nz[id] - z) > 1.2 || !lineClear(c, _mpB.set(NAV.nx[id], NAV.ny[id] + 1.2, NAV.nz[id]))) continue;
    spot = _mpC.set(NAV.nx[id], NAV.ny[id], NAV.nz[id]); break;
  }
  if (spot) e.pos.copy(spot); else e.pos.copy(me.pos);
  if (e.vel) e.vel.set(0, 0, 0);
  PL.held = PL.queued = PL.adsWant = false; PL.pitch = clamp(PL.pitch, -0.6, 0.6);
  me.m.root.visible = true; VM.root.visible = e.alive;
  if (MECHA_P.cock) MECHA_P.cock.root.visible = MECHA_P.cock.hud.visible = MECHA_P.cock.alarm.visible = false;
  $('hud').classList.remove('mecha');
  sfxMechaHiss(me.pos, 0.8); sfxMech('draw');
}

/* ---------- Controls (called by updatePlayer in place of the soldier's gestures) ---------- */
function mechaPilot(dt, now) {
  const e = PL.ent, me = MECHA_P.me, I = e.input;
  // the soldier is in the canopy: it follows the mecha, neither moves nor shoots; it recovers health as usual
  I.mz = I.mx = 0; I.sprint = I.jump = I.ads = I.fire = I.firePressed = I.crouch = false;
  e.busy = true; e.pos.copy(me.pos); if (e.vel) e.vel.set(0, 0, 0); e.yaw = PL.yaw; e.pitch = PL.pitch;
  if (now - PL.lastDmgT > 4.5 && e.health < 100) e.health = Math.min(100, e.health + 45 * dt);
  const P = MECHA_P.in;
  P.fw = padClamp((TOUCH.on ? TOUCH.mz : (KEYS.KeyW || KEYS.ArrowUp ? 1 : 0) - (KEYS.KeyS || KEYS.ArrowDown ? 1 : 0)) + PAD.mz);
  P.st = padClamp((TOUCH.on ? TOUCH.mx : (KEYS.KeyD || KEYS.ArrowRight ? 1 : 0) - (KEYS.KeyA || KEYS.ArrowLeft ? 1 : 0)) + PAD.mx);
  P.fire = PL.held || PL.queued; PL.queued = false; P.jump = !!KEYS.Space; // (Space, the Jump button on touch, A on gamepad)
  PL.pitch = clamp(PL.pitch, -0.75, 0.6);
}
/* The piloted mecha, each frame (mechaTick, before mechaStep): wanted walk, torso, guns, shots */
function mechaPilotStep(me, dt) {
  const P = MECHA_P.in, F = MECHA_F, sy = Math.sin(PL.yaw), cy = Math.cos(PL.yaw);
  me.life = (me.life || 0) + dt;
  // walk: in the look frame; backing up and sideways, slower
  let x = -sy * P.fw + cy * P.st, z = -cy * P.fw - sy * P.st; const l = hyp(x, z);
  if (l > 1) { x /= l; z /= l; }
  const v = MECHA_W.speed * (P.fw > 0.3 && Math.abs(P.st) < 0.5 ? 1 : 0.7);
  me.want.set(x * v, 0, z * v);
  // the legs turn toward the look while walking, or when the torso hits its limit
  if (l > 0.15 || Math.abs(angDiff(me.yaw, PL.yaw)) > 1.2) me.wantYaw = PL.yaw;
  me.yaw += clamp(angDiff(me.yaw, me.wantYaw), -(MECHA_P.legs - MECHA_W.turn) * dt, (MECHA_P.legs - MECHA_W.turn) * dt); // (mechaStep already turns by MECHA_W.turn)
  me.aimYaw = PL.yaw; me.aimPitch = clamp(PL.pitch, -0.6, 0.5);
  // guns: the shot goes off almost immediately (owner feedback: the 0.6 s spin-up and the wait for an aligned torso made it
  // insignificant in a player's hands); they keep spinning 3 s after, to chain; bullets go toward the center of the view
  me.spinWant = P.fire ? 1 : 0;
  me.spin = clamp((me.spin || 0) + (me.spinWant ? dt / MECHA_P.spin : -dt / MECHA_P.spinDown), 0, 1);
  for (const g of me.m.guns) g.rotation.z += me.spin * 38 * dt;
  me.firing = P.fire && me.spin > 0.9;
  me.kick = me.kick || [0, 0];
  if (me.firing) {
    me.shotT = (me.shotT || 0) - dt;
    while (me.shotT <= 0) { me.shotT += 1 / F.rate; me.pod = 1 - (me.pod || 0); mechaPilotShot(me, me.pod); }
  }
  for (let i = 0; i < 2; i++) me.kick[i] = damp(me.kick[i], 0, 14, dt);
}
/* A bullet from a pod, from its muzzle (in the cockpit view) toward what is at the center of the view */
function mechaPilotShot(me, i) {
  const C = MECHA_P.cock, f = camFwd(_mpA), o = camera.position; camera.updateMatrixWorld(); // (the previous frame's view: its matrix is only redone at render)
  const h = rayWorld(o.x, o.y, o.z, f.x, f.y, f.z, MECHA_F.range + 15, 0), eh = rayEntities(o, f, h ? h.t : MECHA_F.range + 15, me.owner);
  const aim = o.clone().addScaledVector(f, eh ? eh.t : h ? h.t : MECHA_F.range + 15);
  const from = C ? C.muzzle[i].getWorldPosition(new V3()) : null;
  if (from) { from.applyMatrix4(vmCamera.matrixWorldInverse).applyMatrix4(camera.matrixWorld); } // (the cockpit lives in the first-person scene)
  mechaShoot(me, i, aim, from); if (me.pilot === PL.ent) PL.actT = MATCH.time; // (the player acts: their hits have their marker, hitFeedback)
  MECHA_P.jolt = Math.max(MECHA_P.jolt, 0.18); vmFlash.intensity = 6;
}
/* Physics of the piloted mecha (mechaTick, after mechaPilotStep, before mechaStep): the wanted speed (heavy to pick up, even more in the air),
   the jump, the hull's collision against the scenery (collideCircle: it slides along a wall), gravity, landing, the drop
   from a step or a roof. Fallen into the void (floating islands), it explodes. */
function mechaPhys(me, dt) {
  const J = MECHA_J, k = 1 - Math.exp(-(me.air ? 1.2 : MECHA_W.acc) * dt);
  me.vel.x += (me.want.x - me.vel.x) * k; me.vel.z += (me.want.z - me.vel.z) * k;
  if (MECHA_P.in.jump && !me.air && !me.jumpHeld) {
    me.vy = J.vy; me.air = true; MECHA_P.jolt = Math.max(MECHA_P.jolt, 0.45);
    sfxMechaHiss(me.pos, 1.2); sfxMechaServo(me.pos, 1, 0.75); sfxMechaStep(me.pos, 0.8);
    const c = CURMAP.def.atmo.snow ? [0.88, 0.91, 0.95] : CURMAP.def.atmo.impact;
    for (let i = 0; i < 16; i++) { const a = i * TAU / 16; FX.smoke.spawn(me.pos.x + Math.cos(a) * 0.8, me.pos.y + 0.1, me.pos.z + Math.sin(a) * 0.8, Math.cos(a) * rand(3, 5), rand(0.2, 0.6), Math.sin(a) * rand(3, 5), rand(0.7, 1.1), 0.4, 1.6, c[0], c[1], c[2], 0.45, 0, 0.3, 2, rand(-1, 1)); }
  }
  me.jumpHeld = MECHA_P.in.jump;
  const x0 = me.pos.x, z0 = me.pos.z;
  me.pos.x += me.vel.x * dt; me.pos.z += me.vel.z * dt;
  collideCircle(me.pos, J.r, J.h);
  if (dt > 0) { me.vel.x = (me.pos.x - x0) / dt; me.vel.z = (me.pos.z - z0) / dt; } // (against a wall: the real speed, the feet don't land in the wall)
  me.vy = (me.vy || 0) - J.g * dt; me.pos.y += me.vy * dt;
  const g = groundHeight(me.pos.x, me.pos.z, Math.max(me.pos.y, me.pos.y - me.vy * dt), 0.6);
  if (me.vy > 0) { const c = ceilingAbove(me.pos.x, me.pos.z, me.pos.y + 0.3, 0.6); if (c < me.pos.y + J.h + 0.05) me.vy = 0; }
  if (me.pos.y <= g) { const v = -(me.airVy || 0); me.pos.y = g; me.vy = 0; if (me.air) { me.air = false; mechaTouch(me, v); } }
  else if (!me.air && me.vy <= 0 && me.pos.y - g < STEP + 0.05) { me.pos.y = g; me.vy = 0; }
  else me.air = true; // a jump, or the edge of a roof
  me.airVy = me.vy;
  if (VOID.on && me.pos.y < VOID.kill + 2) mechaOverheat(me);
}
/* In the air: feet tucked under the body */
function mechaAirFeet(me) {
  for (const f of me.feet) { mechaFootHome(me, f.sx, 0.1, f.p); f.p.y = (me.ry === undefined ? me.pos.y : me.ry) + 0.35; f.air = false; f.landT = me.t; }
}
/* Landing from a jump or a fall (v: fall speed, m/s): feet planted, the body squashes onto its actuators, dust, shake; an
   enemy just underneath is crushed */
function mechaTouch(me, v) {
  for (const f of me.feet) { mechaFootHome(me, f.sx, 0, f.p); f.a.copy(f.p); f.b.copy(f.p); f.air = false; f.landT = me.t; }
  const k = clamp(v / 12, 0.2, 1);
  me.bobV -= 0.6 + 1.6 * k; MECHA_P.jolt = Math.max(MECHA_P.jolt, 0.5 + 0.5 * k);
  sfxMechaStep(me.pos, 1 + k); if (k > 0.5) { sfxMechaHiss(me.pos, 1); sfxAt('m_land', me.pos, 1.2 * k, { ref: 12, prop: false }); }
  const c = CURMAP.def.atmo.snow ? [0.88, 0.91, 0.95] : CURMAP.def.atmo.impact;
  for (let i = 0; i < 20; i++) { const a = i * TAU / 20; FX.smoke.spawn(me.pos.x + Math.cos(a) * 0.7, me.pos.y + 0.1, me.pos.z + Math.sin(a) * 0.7, Math.cos(a) * rand(4, 7) * k, rand(0.2, 0.7), Math.sin(a) * rand(4, 7) * k, rand(0.8, 1.3), 0.4, 2 * k + 0.6, c[0], c[1], c[2], 0.5, 0, 0.3, 2.2, rand(-1, 1)); }
  const d = me.pos.distanceTo(camera.position); if (d < 30) PL.shake = Math.max(PL.shake, (1 - d / 30) * 1.4 * k);
  if (v > 7 && me.local) for (const e of entities) if (e.alive && !e.off && !e.inMecha && !allied(e, me.owner) && hyp(e.pos.x - me.pos.x, e.pos.z - me.pos.z) < MECHA_J.crush && Math.abs(e.pos.y - me.pos.y) < 2) applyDamage(e, 400, me.owner, NET_WSPECIAL.mecha, false, new V3(0, -1, 0), me.pos, -1);
}

/* ---------- Cockpit ----------
   A separate scene, the first-person one (vmScene, drawn on top of the world): the cabin never clips through a wall. Frame of the
   pilot's eye (x right, y up, -z forward), in meters. Owner feedback: the view must stay clear (you can see the ground when
   looking down), but the cabin must be packed with detail, like mecha cockpits (Hawken references). It follows the gaze,
   up and down; only the torso lag makes it drag slightly sideways (inner). It shows:
   - an arched canopy: a curved spar with rounded corners that dips in the middle, two round lights, rivets, reinforced corners;
   - bottom center, a narrow, busy console: round heat gauge (its number), two screens (heat and radar on the left,
     cannons on the right), switches, buttons, indicator lights, grille, cables;
   - in the low corners, two low consoles covered in buttons and switches, and the hoses running up to the cannons;
   - the tips of the rotary cannons on either side; a dirty windshield (dust and stains toward the top and edges);
   - on overheat, a flashing red veil and the indicator lights turning red. */
function mechaCockpit() {
  if (MECHA_P.cock) return MECHA_P.cock;
  const G = mechaGeometry(), armorMap = G.mat.armor.map;
  const frame = new THREE.MeshStandardMaterial({ color: 0x7c7f72, map: armorMap, roughness: 0.72, metalness: 0.3, envMapIntensity: 0.45 }); // armor plating, darker inside
  const dark = new THREE.MeshStandardMaterial({ color: 0x1f2325, roughness: 0.6, metalness: 0.55, envMapIntensity: 0.35 });
  const gun = new THREE.MeshStandardMaterial({ color: 0x3a3e40, roughness: 0.45, metalness: 0.7, envMapIntensity: 0.5 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x141516, roughness: 0.9, metalness: 0.05 });
  const hoseM = new THREE.MeshStandardMaterial({ color: 0x2f3b2c, roughness: 0.7, metalness: 0.15 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x9a9fa3, roughness: 0.3, metalness: 0.85, envMapIntensity: 0.8 });
  const lamp = (c) => new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(...c), toneMapped: false });
  const ledO = lamp([2.4, 0.7, 0.12]), ledG = lamp([0.35, 2.0, 0.45]), ledR = lamp([2.2, 0.15, 0.1]), ledW = lamp([1.6, 1.7, 1.5]);
  const root = new THREE.Group(), inner = new THREE.Group(); root.add(inner); root.visible = false;
  let cur = inner; // (the group where the parts are placed)
  const put = (o, x, y, z, rx = 0, ry = 0, rz = 0, par = cur) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); par.add(o); return o; };
  const box = (m, w, h, d, x, y, z, rx, ry, rz, par) => put(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), x, y, z, rx, ry, rz, par);
  const cyl = (m, r0, r1, h, n, x, y, z, rx, ry, rz, par) => put(new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, n), m), x, y, z, rx, ry, rz, par);
  const tube = (m, pts, r, n = 6, seg = 48) => { const o = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new V3(...p))), seg, r, n, false), m); cur.add(o); return o; };
  // canopy: arched spar (two thicknesses) that dips in the middle; two round lights, rivets; reinforced top corners
  const arch = [[-0.7, -0.1, -0.4], [-0.62, 0.17, -0.47], [-0.42, 0.29, -0.52], [-0.16, 0.27, -0.55], [0, 0.235, -0.56], [0.16, 0.27, -0.55], [0.42, 0.29, -0.52], [0.62, 0.17, -0.47], [0.7, -0.1, -0.4]];
  tube(frame, arch, 0.032, 8, 64);
  tube(dark, arch.map(([x, y, z]) => [x * 1.03, y + 0.035, z + 0.03]), 0.03, 6, 64);
  for (const s of [-1, 1]) {
    const lt = cyl(dark, 0.028, 0.028, 0.03, 14, s * 0.055, 0.218, -0.55, Math.PI / 2 + 0.2); cyl(ledW, 0.019, 0.019, 0.004, 14, 0, -0.016, 0, 0, 0, 0, lt); // spar lights
    for (const t of [0.12, 0.28, 0.42]) { const i = Math.round(t * (arch.length - 1)), p = arch[s < 0 ? i : arch.length - 1 - i]; cyl(steel, 0.007, 0.007, 0.012, 6, p[0], p[1] - 0.03, p[2] + 0.01, Math.PI / 2); } // rivets
    box(gun, 0.2, 0.08, 0.12, s * 0.62, 0.3, -0.42, 0.2, 0, s * 0.5); box(dark, 0.12, 0.05, 0.1, s * 0.66, 0.24, -0.4, 0.2, 0, s * 0.9); // reinforced corners
  }
  // central console: narrow block, round heat gauge, two screens, switches, buttons, indicator lights, grille, cables (raised slightly so the gauge reads in full)
  cur = put(new THREE.Group(), 0, 0.03, 0);
  box(dark, 0.36, 0.2, 0.2, 0, -0.36, -0.5, 0.35);
  box(gun, 0.3, 0.04, 0.16, 0, -0.27, -0.48, 0.55);
  const gcv = document.createElement('canvas'); gcv.width = gcv.height = 128; const gaugeTex = new THREE.CanvasTexture(gcv);
  put(new THREE.Mesh(new THREE.CircleGeometry(0.048, 32), new THREE.MeshBasicMaterial({ map: gaugeTex, toneMapped: false })), 0, -0.22, -0.46, -0.6); // (above the console plate, which was eating its bottom)
  put(new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.008, 8, 32), steel), 0, -0.22, -0.462, -0.6);
  box(dark, 0.13, 0.12, 0.03, 0, -0.225, -0.475, -0.6);
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const scrTex = new THREE.CanvasTexture(cv); scrTex.encoding = THREE.sRGBEncoding;
  const screens = [];
  [[-0.125, 0, -0.25], [0.125, 1, 0.25]].forEach(([x, i, ry]) => {
    const b = box(rubber, 0.09, 0.07, 0.025, x, -0.245, -0.47); b.rotation.order = 'YXZ'; b.rotation.set(-0.6, ry, 0);
    const g = new THREE.PlaneGeometry(0.075, 0.055), uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setX(k, (uv.getX(k) + i) / 2);
    const o = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false })); o.rotation.order = 'YXZ'; put(o, x, -0.24, -0.456, -0.6, ry); screens.push(o);
  });
  const leds = [];
  for (let k = 0; k < 7; k++) leds.push(box(k % 3 === 2 ? ledR : k % 2 ? ledG : ledO, 0.008, 0.008, 0.008, -0.06 + k * 0.02, -0.288, -0.43, 0.55));
  for (let k = 0; k < 4; k++) { cyl(steel, 0.003, 0.003, 0.03, 6, -0.07 + k * 0.045, -0.31, -0.4, -0.3); box(dark, 0.02, 0.008, 0.02, -0.07 + k * 0.045, -0.318, -0.41, 0.55); } // toggle switches
  for (let k = 0; k < 3; k++) cyl(k === 1 ? ledR : rubber, 0.009, 0.009, 0.01, 10, -0.03 + k * 0.03, -0.33, -0.43, 0.55 + Math.PI / 2); // buttons
  for (let k = 0; k < 5; k++) box(rubber, 0.2, 0.004, 0.01, 0, -0.34 - k * 0.012, -0.392, 0.35); // ventilation grille
  tube(rubber, [[-0.16, -0.25, -0.45], [-0.22, -0.3, -0.42], [-0.26, -0.4, -0.38]], 0.008, 5, 16); tube(ledO, [[0.16, -0.26, -0.44], [0.2, -0.32, -0.42], [0.24, -0.42, -0.38]], 0.004, 4, 12); // cables
  cur = inner;
  // low-corner consoles: tilted plates, buttons, switches, a small screen on each side
  for (const s of [-1, 1]) {
    const P = new THREE.Group(); put(P, s * 0.5, -0.33, -0.44, 0.6, -s * 0.35, 0);
    box(dark, 0.3, 0.16, 0.03, 0, 0, 0, 0, 0, 0, P); box(gun, 0.32, 0.02, 0.05, 0, 0.085, 0.01, 0, 0, 0, P);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
      const x = -0.11 + c * 0.044, y = 0.05 - r * 0.04, q = (r * 6 + c) * 7 % 11;
      if (q < 3) cyl(q === 0 ? ledR : q === 1 ? ledO : ledG, 0.006, 0.006, 0.01, 8, x, y, 0.02, Math.PI / 2, 0, 0, P);
      else if (q < 7) { cyl(steel, 0.0025, 0.0025, 0.025, 6, x, y, 0.025, Math.PI / 2 + 0.4, 0, 0, P); box(rubber, 0.016, 0.016, 0.006, x, y, 0.018, 0, 0, 0, P); }
      else cyl(rubber, 0.008, 0.008, 0.012, 10, x, y, 0.02, Math.PI / 2, 0, 0, P);
    }
    // hose: from the side to the cannon, sheathed, with its clamps
    const hp = [[s * 0.66, -0.42, -0.2], [s * 0.7, -0.3, -0.36], [s * 0.74, -0.22, -0.52], [s * 0.77, -0.2, -0.66]];
    tube(hoseM, hp, 0.022, 8, 24);
    const cv3 = new THREE.CatmullRomCurve3(hp.map((p) => new V3(...p)));
    for (let k = 1; k < 6; k++) { const pt = cv3.getPoint(k / 6), tg = cv3.getTangent(k / 6), r = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.005, 6, 14), steel); r.position.copy(pt); r.quaternion.setFromUnitVectors(new V3(0, 0, 1), tg); inner.add(r); }
  }
  // windshield: a dirty veil (dust, stains, streaks) toward the top and edges
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), new THREE.MeshBasicMaterial({ map: mechaGlassTex(), transparent: true, depthWrite: false, toneMapped: false }));
  put(glass, 0, 0.02, -0.6);
  // red overheat veil (in front of the whole cabin) and projected sight
  const alarm = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8), new THREE.MeshBasicMaterial({ map: mechaAlarmTex(), transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  alarm.position.set(0, 0, -0.35); alarm.renderOrder = 8; alarm.visible = false; vmScene.add(alarm);
  const hcv = document.createElement('canvas'); hcv.width = 256; hcv.height = 256;
  const hudTex = new THREE.CanvasTexture(hcv);
  const hud = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ map: hudTex, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  hud.position.set(0, 0, -0.5); hud.renderOrder = 9; hud.visible = false; vmScene.add(hud); // (fixed at the center of the view, no lag: that's where the bullets go)
  // pods, on either side (the mecha's parts, scaled down like it); the muzzle of each cannon bundle
  // (their own materials: the mecha's wait for the world scene's cascaded shadows)
  const M = { armor: frame, dark, steel, glow: lamp([3.0, 0.62, 0.1]) };
  const part = (parts) => { const g = new THREE.Group(); for (const k in parts) if (M[k]) g.add(new THREE.Mesh(parts[k], M[k])); return g; };
  const pods = [], guns = [], muzzle = [];
  for (const s of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(s * 0.8, -0.22, -0.25); p.scale.setScalar(MECHA.k); p.add(part(G.pod)); inner.add(p); // (further forward than on the model: the cannon tips enter the lower corners of the windshield)
    const gn = new THREE.Group(); gn.position.set(0, -0.02, -0.82); gn.add(part(G.guns)); p.add(gn);
    const mz = new THREE.Object3D(); mz.position.set(0, 0, -0.66); gn.add(mz);
    pods.push(p); guns.push(gn); muzzle.push(mz);
  }
  root.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = false; o.frustumCulled = false; } });
  hud.frustumCulled = alarm.frustumCulled = false; vmScene.add(root);
  MECHA_P.cock = { root, inner, pods, guns, muzzle, cv, scrTex, gcv, gaugeTex, hcv, hudTex, hud, alarm, ledO, ledG, base: [ledO.color.clone(), ledG.color.clone()], mats: { frame, dark, gun } };
  if (G.photo) mechaCockpitTex();
  return MECHA_P.cock;
}
/* The windshield: almost transparent; sky reflection at the top, dust and dark stains along the top edge and in the corners, a few
   streaks, fine scratches */
function mechaGlassTex() {
  const W = 512, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(190,210,225,0.12)'); gr.addColorStop(0.3, 'rgba(160,180,195,0.02)'); gr.addColorStop(1, 'rgba(120,130,120,0.04)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  let sd = 7; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  // mud stains and splatters: dense at the top and edges, sparse at the center (the view stays clear)
  for (let i = 0; i < 420; i++) {
    const x = rnd() * W, y = Math.pow(rnd(), 2.2) * H * 0.5, edge = Math.min(x, W - x) / (W / 2), keep = y < H * 0.18 || edge < 0.22 || rnd() < 0.15;
    if (!keep) continue;
    const r = 0.6 + Math.pow(rnd(), 3) * 7; g.fillStyle = `rgba(${40 + rnd() * 30 | 0},${34 + rnd() * 25 | 0},${26 + rnd() * 20 | 0},${(0.12 + rnd() * 0.35).toFixed(2)})`;
    g.beginPath(); g.ellipse(x, y, r, r * (0.6 + rnd() * 0.6), rnd() * 3, 0, TAU); g.fill();
  }
  g.strokeStyle = 'rgba(60,52,40,0.18)'; g.lineWidth = 2;
  for (let i = 0; i < 14; i++) { const x = rnd() * W, y = rnd() * H * 0.15; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 6, y + 20 + rnd() * 50); g.stroke(); } // drips
  g.strokeStyle = 'rgba(220,225,230,0.07)'; g.lineWidth = 1;
  for (let i = 0; i < 30; i++) { const x = rnd() * W, y = rnd() * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 90, y + (rnd() - 0.5) * 16); g.stroke(); }
  for (const [x, y] of [[0, H], [W, H], [0, 0], [W, 0]]) { const r = g.createRadialGradient(x, y, 0, x, y, 120); r.addColorStop(0, 'rgba(120,105,85,0.25)'); r.addColorStop(1, 'rgba(120,105,85,0)'); g.fillStyle = r; g.fillRect(0, 0, W, H); }
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  return t;
}
/* Mecha photo surfaces (mechaTexApply, 08f-mecha.js) on the cabin: the spar gets the armor plating, the console and dark parts get the scratched sheet metal */
function mechaCockpitTex() {
  const C = MECHA_P.cock, T = MECHA_G.tex; if (!C || !T || C.photo) return;
  const { frame, dark, gun } = C.mats;
  if (T.mecha) { frame.map = T.mecha.map; frame.normalMap = T.mecha.normal; frame.roughnessMap = T.mecha.rough; frame.roughness = 1; frame.needsUpdate = true; }
  if (T.mechadark) for (const m of [dark, gun]) { m.map = T.mechadark.map; m.normalMap = T.mechadark.normal; m.roughnessMap = T.mechadark.rough; m.roughness = 1; m.normalScale.set(0.6, 0.6); m.color.multiplyScalar(1 / 0.51); m.needsUpdate = true; }
  C.photo = true;
}
/* Alarm veil: red at the edges, transparent at the center */
function mechaAlarmTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160; const g = c.getContext('2d');
  const r = g.createRadialGradient(128, 80, 30, 128, 80, 150); r.addColorStop(0, 'rgba(255,40,20,0)'); r.addColorStop(0.55, 'rgba(255,40,20,0.15)'); r.addColorStop(1, 'rgba(255,30,10,0.9)');
  g.fillStyle = r; g.fillRect(0, 0, 256, 160);
  return new THREE.CanvasTexture(c);
}

/* ---------- Pilot view (updateMechas, after movement) ---------- */
function mechaCockpitTick(dt) {
  const me = MECHA_P.me, C = MECHA_P.cock; if (!me || !C) return;
  me.m.root.updateMatrixWorld(true);
  const eye = me.m.turret.localToWorld(_mpA.set(0, 0.66, -0.4)); // (in the middle of the torso: the eye stays inside the hull, never in a wall)
  // each footstep, each burst: the view dips and shakes for a moment
  MECHA_P.jolt = Math.max(0, MECHA_P.jolt - dt * 2.2);
  const j = MECHA_P.jolt, sh = j * j;
  camera.position.set(eye.x, eye.y - j * 0.06, eye.z);
  camera.rotation.set(PL.pitch + (Math.random() - 0.5) * sh * 0.02, PL.yaw + (Math.random() - 0.5) * sh * 0.015, (me.roll || 0) * 0.6);
  const fovT = Settings.fov * (PL.adsWant ? 0.72 : 1);
  if (Math.abs(camera.fov - fovT) > 0.01) { camera.fov = damp(camera.fov, fovT, 10, dt); camera.updateProjectionMatrix(); onResizeFx(); }
  if (Math.abs(vmCamera.fov - camera.fov) > 0.01) { vmCamera.fov = camera.fov; vmCamera.updateProjectionMatrix(); }
  VM.root.visible = false; C.root.visible = true; C.hud.visible = true;
  // the cabin follows the gaze; only the torso lag makes it drag sideways
  C.inner.rotation.set(0, angDiff(PL.yaw, me.yaw + (me.turret || 0)), 0);
  for (let i = 0; i < 2; i++) { C.pods[i].rotation.x = me.aimPitch || 0; C.guns[i].rotation.z += (me.spin || 0) * 38 * dt; C.pods[i].children[0].position.z = (me.kick ? me.kick[i] : 0) * 0.09; }
  vmFlash.intensity = damp(vmFlash.intensity, 0, 30, dt);
  // overheat: red veil and flashing indicator lights, alarm
  const hot = me.heat >= MECHA_HEAT.warn, blink = hot && Math.floor(MATCH.time * 3) % 2 === 0;
  C.alarm.visible = hot; C.alarm.material.opacity = blink ? 0.55 : 0.18;
  C.ledO.color.copy(blink ? _mpRed : C.base[0]); C.ledG.color.copy(blink ? _mpRed : C.base[1]);
  if (hot && (MECHA_P.alarmT -= dt) <= 0) { MECHA_P.alarmT = 0.5; sfxKs('lock'); }
  MECHA_P.scrT -= dt; if (MECHA_P.scrT <= 0) { MECHA_P.scrT = 0.1; mechaScreens(me); }
  mechaReticle(me);
}
const _mpRed = new THREE.Color().setRGB(2.4, 0.12, 0.08);
/* A planted foot shakes the pilot's view (mechaLand) */
function mechaPilotJolt(me, k) { if (me.pilot === PL.ent) MECHA_P.jolt = Math.max(MECHA_P.jolt, k); }
/* Console screens (one texture, two panels): on the left the radar of enemies in view, on the right the cannons (spin rate, fire); the round gauge
   shows heat as a percentage */
function mechaScreens(me) {
  const C = MECHA_P.cock, g = C.cv.getContext('2d'), W = 256, H = 256, F = '"Barlow Condensed", sans-serif', hot = me.heat >= MECHA_HEAT.warn;
  g.fillStyle = '#04100a'; g.fillRect(0, 0, 512, H);
  // radar: 40 m around, top is forward; enemies the mecha sees in red, allies in green, rotating sweep
  const cx = W / 2, cy = H / 2, R = 110, k = R / 40, a = me.yaw + (me.turret || 0), ca = Math.cos(a), sa = Math.sin(a), sw = MATCH.time * 2.4;
  g.strokeStyle = 'rgba(159,230,168,0.35)'; g.lineWidth = 3;
  for (const r of [R / 2, R]) { g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke(); }
  g.beginPath(); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.moveTo(cx - R, cy); g.lineTo(cx + R, cy); g.stroke();
  g.strokeStyle = 'rgba(159,230,168,0.8)'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(sw) * R, cy + Math.sin(sw) * R); g.stroke();
  const eye = mechaEye(me, _mpB);
  for (const e of entities) {
    if (!e.alive || e.off || e.inMecha || e === me.owner) continue;
    const dx = e.pos.x - me.pos.x, dz = e.pos.z - me.pos.z; if (dx * dx + dz * dz > 1600) continue;
    const ally = allied(e, me.owner); if (!ally && !lineClear(eye, entChest(e, _mpC))) continue;
    const rx = dx * ca - dz * sa, rz = dx * sa + dz * ca; // in the torso frame (top: forward)
    g.fillStyle = ally ? '#8fd16a' : '#ff5a48'; g.beginPath(); g.arc(cx + rx * k, cy + rz * k, 9, 0, TAU); g.fill();
  }
  g.fillStyle = '#cfe9d3'; g.beginPath(); g.moveTo(cx, cy - 12); g.lineTo(cx + 9, cy + 9); g.lineTo(cx - 9, cy + 9); g.closePath(); g.fill();
  // cannons: spin rate as bars, a rotating beam, orange when firing
  const spin = me.spin || 0;
  g.fillStyle = '#9fe6a8'; g.font = `700 40px ${F}`; g.textBaseline = 'middle'; g.fillText(_t('Guns'), W + 20, 40);
  for (let i = 0; i < 10; i++) { g.fillStyle = spin * 10 > i + 0.05 ? (me.firing ? '#ffbe5a' : '#8fe89a') : 'rgba(159,230,168,0.15)'; g.fillRect(W + 20 + i * 22, 80, 16, 40); }
  g.fillStyle = me.firing ? '#ffbe5a' : 'rgba(159,230,168,0.35)'; g.beginPath(); g.arc(W + W / 2, 186, 42, 0, TAU); g.fill();
  me.gunA = (me.gunA || 0) + spin * 0.6;
  for (let i = 0; i < 6; i++) { const t = me.gunA + i * TAU / 6; g.fillStyle = '#04100a'; g.beginPath(); g.arc(W + W / 2 + Math.cos(t) * 24, 186 + Math.sin(t) * 24, 8, 0, TAU); g.fill(); }
  C.scrTex.needsUpdate = true;
  // round gauge: heat large, with an arc that follows it
  const q = C.gcv.getContext('2d'), h = clamp(me.heat, 0, 1), col = hot ? '#ff5a48' : '#8fe89a';
  q.fillStyle = '#04100a'; q.fillRect(0, 0, 128, 128);
  q.strokeStyle = 'rgba(159,230,168,0.2)'; q.lineWidth = 10; q.beginPath(); q.arc(64, 64, 50, Math.PI * 0.75, Math.PI * 2.25); q.stroke();
  q.strokeStyle = col; q.beginPath(); q.arc(64, 64, 50, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * h); q.stroke();
  q.fillStyle = col; q.font = `700 44px ${F}`; q.textAlign = 'center'; q.fillText(String(Math.round(h * 100)), 64, 64); q.font = `600 18px ${F}`; q.fillText(_t('Heat'), 64, 100); q.textAlign = 'left';
  C.gaugeTex.needsUpdate = true;
}
/* Projected sight: circle and cross, the cannons' spin-up arc, heat as two arcs on either side (red and flashing
   near overheat) */
function mechaReticle(me) {
  const C = MECHA_P.cock, g = C.hcv.getContext('2d'), S = 256, c = S / 2, spin = me.spin || 0, h = clamp(me.heat, 0, 1), hot = h >= MECHA_HEAT.warn, blink = hot && Math.floor(MATCH.time * 3) % 2;
  const key = Math.round(spin * 40) + ':' + (blink ? 1 : 0) + ':' + (me.firing ? 1 : 0) + ':' + Math.round(h * 50);
  if (key === C.hudKey) return; C.hudKey = key;
  g.clearRect(0, 0, S, S);
  const col = blink ? 'rgba(255,110,80,0.95)' : 'rgba(140,255,170,0.9)';
  g.strokeStyle = col; g.lineWidth = 3;
  g.beginPath(); g.arc(c, c, 26, 0, TAU); g.stroke();
  g.beginPath(); for (const [x, y] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { g.moveTo(c + x * 36, c + y * 36); g.lineTo(c + x * 52, c + y * 52); } g.stroke();
  g.fillStyle = col; g.beginPath(); g.arc(c, c, 3, 0, TAU); g.fill();
  // heat: an 80° arc on each side, filling from the bottom (canvas: y down)
  for (const [a0, a1, low] of [[Math.PI * 0.78, Math.PI * 1.22, Math.PI * 0.78], [-Math.PI * 0.22, Math.PI * 0.22, Math.PI * 0.22]]) {
    g.lineWidth = 5; g.strokeStyle = 'rgba(140,255,170,0.18)'; g.beginPath(); g.arc(c, c, 96, a0, a1); g.stroke();
    const f = (a1 - a0) * h; g.strokeStyle = hot ? 'rgba(255,110,80,0.95)' : 'rgba(140,255,170,0.8)'; g.beginPath();
    if (low === a0) g.arc(c, c, 96, a0, a0 + f); else g.arc(c, c, 96, a1 - f, a1);
    g.stroke();
  }
  if (spin > 0) { g.lineWidth = 6; g.strokeStyle = me.firing ? 'rgba(255,190,90,0.95)' : 'rgba(140,255,170,0.75)'; g.beginPath(); g.arc(c, c, 66, -Math.PI / 2, -Math.PI / 2 + TAU * spin); g.stroke(); }
  C.hudTex.needsUpdate = true;
}
/* Prompt under the reticle: board when within range of your mecha, get out once aboard (08c-pickups.js), bail out quickly on overheat; '' otherwise */
function mechaPrompt() {
  if (!MECHA_P.me && !mechaNear()) return '';
  const hot = MECHA_P.me && MECHA_P.me.heat >= MECHA_HEAT.warn;
  if (MECHA_P.me && !hot && MATCH.time - MECHA_P.t0 > 5) return ''; // aboard: shown for five seconds, then the view stays clear (the button stays on screen for touch)
  const g = actGlyph('use'), hold = inputMode() === 'pad', up = !MECHA_P.me;
  if (hot) return !g ? esc(_t('Overheating! Get out of the mecha')) : hold ? _t('Overheating! Hold {0} to get out', g) : _t('Overheating! {0} Get out of the mecha', g);
  if (!g) return esc(up ? _t('Board the mecha') : _t('Leave the mecha'));
  return hold ? (up ? _t('Hold {0} to board the mecha', g) : _t('Hold {0} to leave the mecha', g)) : (up ? _t('{0} Board the mecha', g) : _t('{0} Leave the mecha', g));
}
