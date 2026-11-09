/* ==========================================================================
   KAMIKAZE DRONE (streak at 6)
   It is launched at the terminal, then piloted like a free camera: the look (mouse, right stick, right thumb) orients it,
   the movement keys (left stick, joystick) make it advance where it looks, back up and slide sideways;
   Space climbs, Ctrl descends, sprint pushes it. With no input, it slows down and stays in place. The pilot's body stays
   where it was, motionless and exposed. The drone explodes against a soldier, a helicopter or water, against scenery if it
   hits it faster than FPV.crash m/s (below that, it stops and slides along), when shot, or on empty battery (FPV.life); shot down
   (FPV.hp), it falls without doing damage. Its kills don't raise
   the streak (explode, life -1).
   Each drone is simulated by the participant who launched it (d.local: the player, or a bot on the host); the others see it
   through its owner's presence (p.dr, netPresence) and hit it with the dh event; its explosion goes out in dx.
   Bots launch it too: it climbs, speeds toward the nearest enemy and dives on it (fpvAi). Bots shoot at a
   nearby enemy drone they see (fpvBotsShoot).
   ========================================================================== */
/* crash: speed toward the obstacle (m/s) above which an impact against scenery makes it explode; below that, it stops against the wall and slides along */
const FPV = { life: 30, speed: 10, boost: 16, accel: 3.4, hp: 70, r: 0.28, blast: 4.5, dmg: 150, fov: 18, botSpeed: 9, crash: 6 };
const DRONES = [];
/* Drone piloted by the player; yaw, pitch: orientation of their body left on the ground */
const PILOT = { d: null, yaw: 0, pitch: 0 };
const _fpA = new V3(), _fpB = new V3(), _fpC = new V3(), _fpN = new V3(), FPV_BOOM = { boom: true };

/* ---------- Model ----------
   Seven-inch FPV drone (30 cm from one motor to the other diagonally, 50 cm with propellers), like those at the front: carbon X frame with two
   plates and standoffs, four black motors and their three-blade propellers (which spin, fpvSpin, with a blur veil), camera cage at the front,
   loaf-shaped payload wrapped in khaki plastic and strapped with three black bands on top, mushroom video antenna and its red wire, receiver antenna
   and yellow connector at the back. Frame: front toward -z, up toward +y. The frame and its parts are merged into one geometry with vertex colors;
   the payload, the lens, the propellers, their blur and the indicator each have their own. */
function fpvGeometry() {
  if (KS.fgeo) return KS.fgeo;
  const body = csmMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.62, metalness: 0.12, envMapIntensity: 0.35 })); // (barely metallic: under a clear sky, the carbon and straps stay black)
  const wrap = csmMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, map: fpvWrapTex(), roughness: 0.58, metalness: 0.05, envMapIntensity: 0.45 })); // (crumpled plastic: a little luster, not a mirror of the sky)
  const glass = csmMaterial(new THREE.MeshStandardMaterial({ color: 0x0e1822, roughness: 0.06, metalness: 0.9, envMapIntensity: 1.6 }));
  const prop = csmMaterial(new THREE.MeshStandardMaterial({ color: 0x2b2d2f, roughness: 0.5, metalness: 0.1, envMapIntensity: 0.35 }));
  const blur = new THREE.MeshBasicMaterial({ color: 0x3a3d3f, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false });
  const led = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(3.2, 0.25, 0.15) });
  const ledW = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(2.6, 3.0, 3.4) });
  // LED halos (additive sprites, like the laser dot): cold white at the front, red at the back
  const hc = document.createElement('canvas'); hc.width = hc.height = 64; const hg = hc.getContext('2d'), hr = hg.createRadialGradient(32, 32, 0, 32, 32, 32);
  // small core, soft glow that fades quickly
  hr.addColorStop(0, 'rgba(255,255,255,1)'); hr.addColorStop(0.12, 'rgba(255,255,255,0.6)'); hr.addColorStop(0.4, 'rgba(255,255,255,0.12)'); hr.addColorStop(1, 'rgba(255,255,255,0)'); hg.fillStyle = hr; hg.fillRect(0, 0, 64, 64);
  const halo = (r, g, b) => new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(hc), color: new THREE.Color().setRGB(r, g, b), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
  const haloF = halo(1.6, 1.9, 2.2), haloR = halo(2.1, 0.14, 0.08);
  const B = [], W = [], GL = [], e = new THREE.Euler(), q = new THREE.Quaternion();
  const M = (x, y, z, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(new V3(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), new V3(1, 1, 1));
  const CARBON = 0x1e1f21, BLACK = 0x111213, ALU = 0x2a2c2f, STEEL = 0x9aa0a6, RED = 0xa3161a, YELLOW = 0xd9a32a, PCB = 0x1d3a2a;
  const box = (L, c, w, h, d, ...a) => L.push({ geo: new THREE.BoxGeometry(w, h, d), m: M(...a), c });
  const cyl = (L, c, r0, r1, h, seg, ...a) => L.push({ geo: new THREE.CylinderGeometry(r0, r1, h, seg), m: M(...a), c });
  // tube between two points (spacers, antennas, wires)
  const tube = (L, c, A, Bp, r, seg = 6) => {
    const a0 = new V3(...A), b0 = new V3(...Bp), dv = b0.clone().sub(a0), len = dv.length();
    L.push({ geo: new THREE.CylinderGeometry(r, r, len, seg), m: new THREE.Matrix4().compose(a0.clone().add(b0).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), dv.normalize()), new V3(1, 1, 1)), c });
  };
  // frame: low plate, X arms (slightly longer toward the front and back), round feet under the motors, top plate on standoffs, flight controller
  box(B, CARBON, 0.062, 0.005, 0.2, 0, 0, 0);
  const MOT = [[-0.112, -0.106], [0.112, -0.106], [-0.112, 0.106], [0.112, 0.106]];
  for (const [x, z] of MOT) {
    const len = hyp(x, z) - 0.01;
    box(B, CARBON, 0.03, 0.007, len, x / 2, 0.001, z / 2, 0, Math.atan2(x, z), 0);
    cyl(B, CARBON, 0.021, 0.021, 0.007, 14, x, 0.001, z);
  }
  box(B, CARBON, 0.056, 0.004, 0.15, 0, 0.034, 0.005);
  for (const sx of [-1, 1]) for (const z of [-0.06, 0.07]) tube(B, ALU, [sx * 0.022, 0.003, z], [sx * 0.022, 0.032, z], 0.0032);
  box(B, PCB, 0.034, 0.012, 0.034, 0, 0.012, 0.01); box(B, BLACK, 0.026, 0.008, 0.026, 0, 0.022, 0.01);
  // motors: stator, black bell, ring, shaft and nut
  for (const [x, z] of MOT) {
    cyl(B, ALU, 0.017, 0.018, 0.012, 16, x, 0.01, z);
    cyl(B, BLACK, 0.019, 0.019, 0.014, 16, x, 0.022, z);
    cyl(B, STEEL, 0.006, 0.006, 0.012, 8, x, 0.034, z);
  }
  // camera cage at the front, between the plates: two side plates, the camera tilted upward, its lens
  for (const sx of [-1, 1]) box(B, ALU, 0.004, 0.032, 0.03, sx * 0.019, 0.018, -0.094);
  box(B, BLACK, 0.026, 0.026, 0.022, 0, 0.019, -0.096, 0.35, 0, 0);
  const lens = new THREE.CylinderGeometry(0.0095, 0.011, 0.014, 14); lens.rotateX(Math.PI / 2);
  B.push({ geo: lens.clone(), m: M(0, 0.024, -0.11, 0.35, 0, 0), c: BLACK });
  const glassG = new THREE.CircleGeometry(0.0078, 14); GL.push({ geo: glassG, m: M(0, 0.0265, -0.1175, 0.35 - Math.PI, 0, 0) });
  // loaf-shaped payload on the top plate, under khaki plastic, three black straps going around it
  W.push({ geo: new THREE.BoxGeometry(0.068, 0.058, 0.15, 1, 1, 1), m: M(0, 0.066, 0.004) });
  for (const z of [-0.048, 0.004, 0.056]) box(B, BLACK, 0.072, 0.062, 0.016, 0, 0.066, z);
  // back: mushroom video antenna (mast, red wire, cap), receiver antenna, yellow connector and its wires
  tube(B, BLACK, [0.014, 0.04, 0.09], [0.022, 0.13, 0.112], 0.0035);
  tube(B, RED, [0.016, 0.04, 0.086], [0.019, 0.09, 0.098], 0.0022);
  cyl(B, BLACK, 0.013, 0.011, 0.018, 14, 0.023, 0.136, 0.114, 0.25, 0, 0);
  tube(B, BLACK, [-0.016, 0.036, 0.085], [-0.03, 0.09, 0.105], 0.0022);
  box(B, YELLOW, 0.016, 0.01, 0.012, 0.03, 0.043, 0.08, 0, 0.4, 0);
  tube(B, RED, [0.024, 0.044, 0.074], [0.016, 0.06, 0.068], 0.0025); tube(B, BLACK, [0.028, 0.044, 0.074], [0.02, 0.058, 0.062], 0.0025);
  // three-blade propeller: twisted blades around the hub (one geometry, placed on each motor and rotated every frame)
  const P = [];
  for (let k = 0; k < 3; k++) { const a = k * TAU / 3; P.push({ geo: new THREE.BoxGeometry(0.008, 0.0025, 0.07), m: new THREE.Matrix4().compose(new V3(Math.sin(a) * 0.04, 0, Math.cos(a) * 0.04), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, 0.32)), new V3(1, 1, 1)) }); }
  P.push({ geo: new THREE.CylinderGeometry(0.008, 0.008, 0.008, 10), m: new THREE.Matrix4() });
  const disc = new THREE.CircleGeometry(0.078, 22); disc.rotateX(-Math.PI / 2);
  KS.fgeo = { body, wrap, glass, prop, blur, led, mot: MOT, gB: fpvMergeColored(B), gW: heliMerge(W), gG: heliMerge(GL), gP: heliMerge(P), gD: disc, gL: new THREE.SphereGeometry(0.005, 6, 4), ledW, haloF, haloR, gS: new THREE.BoxGeometry(0.013, 0.005, 0.034) };
  return KS.fgeo;
}
/* Merges parts { geo, m, c } into one geometry, each in its own color (vertex colors, converted to linear like those of materials) */
function fpvMergeColored(parts) {
  const g = heliMerge(parts), col = new Float32Array(g.attributes.position.count * 3), c = new THREE.Color();
  let o = 0;
  for (const p of parts) { c.setHex(p.c).convertSRGBToLinear(); for (let k = 0; k < p.geo.attributes.position.count; k++, o++) c.toArray(col, o * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
/* Payload plastic: crumpled dark khaki, lighter highlights and black creases, drawn once */
function fpvWrapTex() {
  const N = 128, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d');
  g.fillStyle = '#474a32'; g.fillRect(0, 0, N, N);
  let sd = 11; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) { g.fillStyle = rnd() < 0.5 ? `rgba(104,104,78,${(0.15 + rnd() * 0.25).toFixed(2)})` : `rgba(20,20,14,${(0.2 + rnd() * 0.3).toFixed(2)})`; g.beginPath(); g.moveTo(rnd() * N, rnd() * N); for (let k = 0; k < 3; k++) g.lineTo(rnd() * N, rnd() * N); g.closePath(); g.fill(); }
  g.strokeStyle = 'rgba(10,10,8,0.55)'; g.lineWidth = 1.2; for (let i = 0; i < 18; i++) { g.beginPath(); g.moveTo(rnd() * N, rnd() * N); g.lineTo(rnd() * N, rnd() * N); g.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
  return t;
}
/* A drone for the scene; at 1.15 times real size so it can be seen and hit at twenty meters. mesh.userData.props: the spinning propellers */
function fpvMesh() {
  const G = fpvGeometry(), g = new THREE.Group(), add = (geo, m, shadow = true) => { const o = new THREE.Mesh(geo, m); o.castShadow = shadow; g.add(o); return o; };
  add(G.gB, G.body); add(G.gW, G.wrap); add(G.gG, G.glass, false);
  const props = [];
  G.mot.forEach(([x, z], i) => {
    const p = add(G.gP, G.prop); p.position.set(x, 0.043, z); p.rotation.y = i; props.push(p);
    const d = add(G.gD, G.blur, false); d.position.set(x, 0.043, z);
  });
  for (const sx of [-1, 1]) { const l = add(G.gL, G.led, false); l.position.set(sx * 0.02, 0.006, 0.1); }
  // little lights: an LED under each arm (white in front, red behind) and its halo, visible from afar at night (maps with street lighting, litOn);
  // by day, smaller and paler halos. The rear lights blink (fpvSpin)
  const night = litOn(), blink = [];
  G.haloF.opacity = night ? 0.7 : 0.35; G.haloR.opacity = night ? 0.75 : 0.4;
  G.mot.forEach(([x, z], i) => {
    const front = i < 2, l = add(G.gS, front ? G.ledW : G.led, false); l.position.set(x * 0.78, -0.005, z * 0.78); l.rotation.y = Math.atan2(x, z);
    const h = new THREE.Sprite(front ? G.haloF : G.haloR), k = night ? 0.17 : 0.12;
    h.scale.set(k, k, k); h.position.set(x * 0.78, -0.012, z * 0.78); h.renderOrder = 8; h.userData.noPrepass = true; g.add(h);
    if (!front) blink.push(h);
  });
  g.userData.blink = blink; g.userData.props = props; g.rotation.order = 'YXZ'; g.scale.setScalar(1.15); scene.add(g);
  return g;
}
/* Propellers: alternating directions, faster when it pushes; rear lights: a double flash every 1.2 s */
function fpvSpin(d, dt) {
  const w = (40 + d.vel.length() * 2) * dt;
  d.mesh.userData.props.forEach((p, i) => { p.rotation.y += (i === 0 || i === 3 ? w : -w); });
  const t = (MATCH.time + d.mesh.id * 0.37) % 1.2, on = t < 0.09 || (t > 0.2 && t < 0.29); // (the match clock: a remote drone doesn't have its own)
  for (const h of d.mesh.userData.blink) h.visible = on;
}

/* ---------- Launch and end ---------- */
const fpvOf = (owner) => DRONES.find((d) => d.owner === owner && !d.dead);
function fpvSpawn(owner, pos, yaw, pitch, local) {
  const d = { owner, team: owner.team, local, pos: pos.clone(), vel: new V3(), yaw, pitch, roll: 0, hp: FPV.hp, t: 0, mesh: fpvMesh(), snd: null, in: { fw: 0, st: 0, up: 0, boost: false }, boom: false, dead: false, ai: false, tgt: null, tgtT: 0, seen: MATCH.time };
  d.snd = fpvSoundStart(d);
  DRONES.push(d); fpvPose(d);
  return d;
}
/* The player launches theirs (at the terminal button): it leaves their hands, toward where they look, and the view moves into the drone */
function fpvLaunch(owner) {
  if (fpvOf(owner)) return;
  sfxAnnounce(ksFriendly(owner) ? 'fpv_on' : 'fpv_enemy'); // radio announcement (05a-sfx.js)
  if (owner === PL.ent) {
    // it leaves above the head with a bit of upward momentum: looking at the ground or a wall very close, it hits nothing at launch
    const f = camFwd(_fpA), p = camera.position.clone(); p.y += 0.35;
    const d = fpvSpawn(owner, p, PL.yaw, PL.pitch, true); d.vel.set(f.x * 3, 2, f.z * 3);
    PILOT.d = d; PILOT.yaw = PL.yaw; PILOT.pitch = PL.pitch; d.mesh.visible = false; // (the camera is in the drone)
    PL.actT = MATCH.time; // the player acts: the drone's explosion has its hit marker (hitFeedback)
    PL.held = false; PL.queued = false; PL.adsWant = false;
    $('hud').classList.add('fpv'); fpvHudText(); hudMsg(_t('Drone in flight'), 'ally', 1.6);
  } else {
    const p = owner.pos.clone(); p.y += 2.1; // above the bot's head
    const d = fpvSpawn(owner, p, owner.yaw, 0.3, true); d.ai = true; d.vel.set(0, 4, 0);
    hudMsg(owner.team === PL.ent.team ? _t('Allied kamikaze drone ({0})', owner.name) : _t('Enemy kamikaze drone!'), owner.team === PL.ent.team ? 'ally' : 'enemy', 2.2);
  }
}
/* End of a drone: boom (explosion that hurts, on contact, when shot or on empty battery) or shot down (debris, no damage); send: the owner publishes the end */
function fpvEnd(d, boom, send = d.local) {
  if (d.dead) return; d.dead = true;
  const p = d.pos.clone();
  if (boom) explode(p, d.owner, NET_WSPECIAL.drone, FPV.blast, FPV.dmg, -1); // life -1: its kills don't raise the streak (streakKill)
  else { explosionFx(p, 0.35); sfxExplosion(p, 0.35); }
  if (send && MATCH.online && netIsLocal(d.owner)) netEvent({ k: 'dx', x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), h: boom ? 1 : 0 }, d.owner);
  fpvRemove(d);
  if (!boom && d.owner === PL.ent && d.local) hudMsg(_t('Drone shot down'), 'enemy', 1.6);
}
function fpvRemove(d) {
  d.dead = true; scene.remove(d.mesh); fpvSoundStop(d.snd); d.snd = null;
  const i = DRONES.indexOf(d); if (i >= 0) DRONES.splice(i, 1);
  if (PILOT.d === d) fpvLeave();
}
/* The view returns to the pilot's body */
function fpvLeave() {
  PILOT.d = null; PL.yaw = PILOT.yaw; PL.pitch = PILOT.pitch; PL.held = false; PL.queued = false;
  $('hud').classList.remove('fpv'); if (PL.ent.alive) VM.root.visible = true;
}
function fpvClear() { for (const d of DRONES.slice()) fpvRemove(d); }

/* ---------- Player piloting (called by updatePlayer in place of the soldier's gestures) ---------- */
function fpvPlayer(dt, now) {
  const e = PL.ent, d = PILOT.d, I = e.input;
  // the body stays in place, turned toward where it looked at launch; it recovers health as usual
  I.mz = I.mx = 0; I.sprint = I.jump = I.ads = I.fire = I.firePressed = I.crouch = false;
  e.busy = true; e.yaw = PILOT.yaw; e.pitch = PILOT.pitch;
  ctlMove(e, dt);
  if (voidCheck(e) || ringCheck(e, dt)) return;
  if (now - PL.lastDmgT > 4.5 && e.health < 100) e.health = Math.min(100, e.health + 45 * dt);
  // controls: the same as for walking (09q-touch.js on touch, 09qc-gamepad.js on gamepad)
  d.in.fw = padClamp((TOUCH.on ? TOUCH.mz : (KEYS.KeyW || KEYS.ArrowUp ? 1 : 0) - (KEYS.KeyS || KEYS.ArrowDown ? 1 : 0)) + PAD.mz);
  d.in.st = padClamp((TOUCH.on ? TOUCH.mx : (KEYS.KeyD || KEYS.ArrowRight ? 1 : 0) - (KEYS.KeyA || KEYS.ArrowLeft ? 1 : 0)) + PAD.mx);
  d.in.up = (KEYS.Space ? 1 : 0) - (KEYS.ControlLeft ? 1 : 0);
  d.in.boost = (TOUCH.on ? TOUCH.sprint : !!KEYS.ShiftLeft) || PAD.sprint;
  if (PL.queued || PL.held) { PL.queued = false; PL.held = false; d.boom = true; }
  d.yaw = PL.yaw; d.pitch = PL.pitch;
}
/* Pilot's view: in the drone, wider field of view, roll when sliding */
function fpvCamera(dt) {
  const d = PILOT.d;
  camera.position.copy(d.pos);
  camera.rotation.set(d.pitch, d.yaw, d.roll * 0.6);
  const fovT = Settings.fov + FPV.fov;
  if (Math.abs(camera.fov - fovT) > 0.01) { camera.fov = damp(camera.fov, fovT, 10, dt); camera.updateProjectionMatrix(); onResizeFx(); }
  VM.root.visible = false;
}

/* ---------- Flight ---------- */
/* Direction wanted by the controls, in the drone's look frame (advancing follows the look, climbing and descending follow the vertical) */
function fpvWish(d, out) {
  const cp = Math.cos(d.pitch), sp = Math.sin(d.pitch), cy = Math.cos(d.yaw), sy = Math.sin(d.yaw);
  out.set(-sy * cp * d.in.fw + cy * d.in.st, sp * d.in.fw + d.in.up, -cy * cp * d.in.fw - sy * d.in.st);
  const l = out.length(); if (l > 1) out.multiplyScalar(1 / l);
  return out.multiplyScalar(d.in.boost && d.in.fw > 0.2 ? FPV.boost : d.ai ? FPV.botSpeed : FPV.speed);
}
/* Bot: climbs for a moment, speeds toward the nearest enemy above the rooftops, then dives on it as soon as it sees it */
function fpvAi(d, dt) {
  d.tgtT -= dt;
  if (d.tgtT <= 0 || !d.tgt || !d.tgt.alive) {
    d.tgtT = 0.5; let best = null, bd = 1e9;
    for (const o of entities) if (o.alive && !o.off && !o.inMecha && !allied(o, d.owner)) { const k = o.pos.distanceToSquared(d.pos); if (k < bd) { bd = k; best = o; } }
    d.tgt = best;
  }
  const want = _fpB;
  if (!d.tgt || d.t < 0.7) want.set(0, 1, 0);
  else {
    const c = entChest(d.tgt, _fpA), hd = hyp(c.x - d.pos.x, c.z - d.pos.z);
    // stuck (almost stopped for over a second): it tries to arrive from another side
    d.stuckT = d.vel.length() < 1.5 && d.t > 1.5 ? (d.stuckT || 0) + dt : 0;
    if (d.stuckT > 1.2) { d.stuckT = 0; d.side = (d.side || 0) + Math.PI / 2; }
    if (hd < 12 && lineClear(d.pos, c)) want.subVectors(c, d.pos).normalize(); // in view and within 12 m (in plan): it dives
    else if (hd < 12) {
      // very close but hidden (under an awning, a balcony): it descends to 5 m from the target, at chest height, to arrive from the side
      const a = Math.atan2(d.pos.x - c.x, d.pos.z - c.z) + (d.side || 0);
      want.set(c.x + Math.sin(a) * 5 - d.pos.x, c.y + 0.6 - d.pos.y, c.z + Math.cos(a) * 5 - d.pos.z).normalize();
    } else {
      // far: it speeds toward the target at 8 m above it; an obstacle within 7 m ahead (roof, wall, tree): it climbs instead of advancing
      want.set(c.x - d.pos.x, c.y + 8 - d.pos.y, c.z - d.pos.z).normalize();
      if (rayWorld(d.pos.x, d.pos.y, d.pos.z, want.x, want.y, want.z, 7, 1)) want.set(want.x * 0.15, 1, want.z * 0.15).normalize();
    }
  }
  d.yaw = Math.atan2(-want.x, -want.z); d.pitch = Math.asin(clamp(want.y, -1, 1));
  d.in.fw = 1; d.in.st = 0; d.in.up = 0; d.in.boost = false;
}
/* What the drone hits going from from to to: null; FPV_BOOM (soldier, helicopter, water, void, map edge: it explodes whatever happens);
   or scenery and objects, { n }: their normal (the impact speed decides, fpvStep) */
function fpvHit(d, from, to) {
  if (to.x < MAP.x0 || to.x > MAP.x1 || to.z < MAP.z0 || to.z > MAP.z1 || to.y < (VOID.on ? VOID.floor - 2 : -2)) return FPV_BOOM;
  const ws = waterSurfaceAt(to.x, to.z); if (ws !== null && to.y < ws + 0.1) return FPV_BOOM;
  for (const o of entities) {
    if (!o.alive || o.off || o === d.owner) continue;
    if (Math.abs(o.pos.x - to.x) > 1.5 || Math.abs(o.pos.z - to.z) > 1.5) continue;
    if (entChest(o, _fpC).distanceTo(to) < 0.55 || entHead(o, _fpC).distanceTo(to) < 0.4) return FPV_BOOM;
  }
  for (const h of KS.helis) if (h.state !== 'crash' && h.pos.distanceTo(to) < 2.6) return FPV_BOOM;
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z, len = hyp3(dx, dy, dz);
  const w = len > 1e-4 ? rayWorld(from.x, from.y, from.z, dx / len, dy / len, dz / len, len + FPV.r, 1) : null;
  return w ? { n: _fpN.set(w.nx, w.ny, w.nz) } : null;
}
function fpvStep(d, dt) {
  d.t += dt;
  if (d.ai) fpvAi(d, dt);
  const want = fpvWish(d, _fpB), k = 1 - Math.exp(-FPV.accel * dt);
  d.vel.x += (want.x - d.vel.x) * k; d.vel.y += (want.y - d.vel.y) * k; d.vel.z += (want.z - d.vel.z) * k;
  // ceiling: 40 m above the ground, you can't leave through the top
  const g = groundHeight(d.pos.x, d.pos.z, d.pos.y); if (d.pos.y > g + 40 && d.vel.y > 0) d.vel.y = 0;
  if (d.boom || d.t >= FPV.life || !d.owner.alive && !d.ai) { fpvEnd(d, d.owner.alive || d.boom); return; } // pilot killed: the drone falls, without exploding
  const to = _fpA.copy(d.pos).addScaledVector(d.vel, dt);
  let h = fpvHit(d, d.pos, to);
  if (h && h !== FPV_BOOM) {
    const vn = -d.vel.dot(h.n); // speed toward the wall
    if (vn > FPV.crash) { d.pos.copy(to); fpvEnd(d, true); return; }
    // soft impact: it stops against the wall and keeps what slides along; stuck (a corner), it stays in place
    if (vn > 2 && MATCH.time - (d.bumpT || -9) > 0.3) { d.bumpT = MATCH.time; sfxImpact(d.pos, 'metal'); }
    d.vel.addScaledVector(h.n, Math.max(0, vn));
    to.copy(d.pos).addScaledVector(d.vel, dt); h = fpvHit(d, d.pos, to);
    if (h && h !== FPV_BOOM) { to.copy(d.pos); d.vel.multiplyScalar(0.5); h = null; }
  }
  if (h === FPV_BOOM) { d.pos.copy(to); fpvEnd(d, true); return; }
  d.pos.copy(to);
  // roll and pitch of the airframe: it leans toward where it accelerates
  const side = (d.vel.x * Math.cos(d.yaw) - d.vel.z * Math.sin(d.yaw)) / FPV.speed;
  d.roll = damp(d.roll, -clamp(side, -1, 1) * 0.45, 6, dt);
  fpvPose(d);
}
function fpvPose(d) {
  d.mesh.position.copy(d.pos);
  const sp = hyp(d.vel.x, d.vel.z) / FPV.boost;
  d.mesh.rotation.set(d.pitch * 0.35 - sp * 0.35, d.yaw, d.roll);
}
/* Another participant's drone: published position (fpvNet), smoothed */
function fpvFollow(d, dt) {
  const k = 1 - Math.exp(-12 * dt);
  d.pos.x += (d.net.x - d.pos.x) * k; d.pos.y += (d.net.y - d.pos.y) * k; d.pos.z += (d.net.z - d.pos.z) * k;
  d.yaw += angDiff(d.yaw, d.net.yaw) * k; d.pitch += (d.net.pitch - d.pitch) * k;
  fpvPose(d);
  if (MATCH.time - d.seen > 1) fpvRemove(d); // no longer published (owner left, end lost)
}
function updateDrones(dt) {
  for (const d of DRONES.slice()) {
    if (d.dead) continue;
    if (d.local) fpvStep(d, dt); else fpvFollow(d, dt);
    if (!d.dead) { fpvSoundUpdate(d.snd, d); fpvSpin(d, dt); }
  }
  if (DRONES.length) fpvBotsShoot(dt);
  if (PILOT.d) { if (PL.ent.alive) fpvCamera(dt); fpvHud(); }
}

/* ---------- Shots at drones ---------- */
/* Ray of a bullet against enemy drones: 0.45 m sphere */
function rayDrones(shooter, o, dir, maxT) {
  let best = null, bt = maxT;
  for (const d of DRONES) {
    if (d.dead || allied(shooter, d.owner)) continue;
    const cx = d.pos.x - o.x, cy = d.pos.y - o.y, cz = d.pos.z - o.z, t = cx * dir.x + cy * dir.y + cz * dir.z;
    if (t < 0 || t > bt) continue;
    const d2 = cx * cx + cy * cy + cz * cz - t * t; if (d2 > 0.2) continue;
    bt = t - Math.sqrt(0.2 - d2); best = d;
  }
  return best ? { d: best, t: bt } : null;
}
function fpvDamage(d, dmg, shooter) {
  if (d.dead || !shooter || shooter.isRemote) return;
  if (shooter.isPlayer) hitFeedback(false, d.hp - dmg <= 0 && d.local);
  if (d.local) { d.hp -= dmg; if (d.hp <= 0) fpvEnd(d, false); }
  else if (MATCH.online && netIsLocal(shooter)) netEvent({ k: 'dh', to: netIdOf(d.owner), d: Math.round(dmg) }, shooter);
}
/* This match's bots shoot at an enemy drone they see within 30 m: a reaction time, then shots, one bullet in three on target */
function fpvBotsShoot(dt) {
  for (const b of entities) {
    if (b.isPlayer || b.isRemote || !b.alive || b.off || !b.weapon) continue;
    let tgt = null, bd = 900;
    for (const d of DRONES) { if (d.dead || allied(b, d.owner)) continue; const k = d.pos.distanceToSquared(b.pos); if (k < bd) { bd = k; tgt = d; } }
    if (!tgt) { b.fpvSeeT = 0; continue; }
    const eye = new V3(b.pos.x, b.pos.y + (b.crouch ? 1.1 : 1.55), b.pos.z); // eye height (the model's head may be a frame old)
    if (!lineClear(eye, tgt.pos)) { b.fpvSeeT = Math.max(0, (b.fpvSeeT || 0) - dt); continue; }
    b.fpvSeeT = (b.fpvSeeT || 0) + dt; botLookAt(b, tgt.pos, MATCH.time, 0.4);
    if (b.fpvSeeT < 0.6) continue;
    b.fpvShotT = (b.fpvShotT || 0) - dt; if (b.fpvShotT > 0) continue;
    b.fpvShotT = 0.16 + Math.random() * 0.12;
    const hit = Math.random() < 0.34 * clamp(1.3 - Math.sqrt(bd) / 30, 0.3, 1), end = tgt.pos.clone();
    if (!hit) end.add(_fpB.set(rand(-1, 1), rand(-0.6, 0.8), rand(-1, 1)));
    sfxGun(b.weapon.sound, eye, b); FX.tracers.add(eye, end); b.lastShotT = MATCH.time;
    if (hit) { impactFx(end, _fpB.subVectors(eye, end).normalize(), 'metal', false, true); fpvDamage(tgt, 12, b); }
  }
}

/* ---------- Online ---------- */
/* Owner's presence: [x, y, z, heading, pitch] of their drone; null without a drone */
function fpvPub(e) {
  const d = DRONES.find((x) => x.owner === e && x.local && !x.dead); if (!d) return null;
  const r = (v) => Math.round(v * 100) / 100;
  return [r(d.pos.x), r(d.pos.y), r(d.pos.z), r(d.yaw), r(d.pitch)];
}
function fpvNet(e, a) {
  if (!Array.isArray(a) || a.length < 5 || !e.alive) return;
  const v = a.map((x) => clamp(numOr(x), -1e4, 1e4));
  let d = DRONES.find((x) => x.owner === e && !x.local && !x.dead);
  if (!d) { d = fpvSpawn(e, new V3(v[0], v[1], v[2]), v[3], v[4], false); d.net = {}; sfxAnnounce(ksFriendly(e) ? 'fpv_on' : 'fpv_enemy'); } // (another player's drone: its announcement)
  Object.assign(d.net, { x: v[0], y: v[1], z: v[2], yaw: v[3], pitch: v[4] }); d.seen = MATCH.time;
}
/* End published by the owner: explosion (view and sound; the damage is counted by the owner) or debris */
function fpvNetEnd(e, ev) {
  const d = DRONES.find((x) => x.owner === e && !x.local && !x.dead), p = new V3(numOr(ev.x), numOr(ev.y), numOr(ev.z));
  if (d) { d.pos.copy(p); fpvEnd(d, !!ev.h, false); } else if (ev.h) explode(p, e, NET_WSPECIAL.drone, FPV.blast, FPV.dmg, -1);
}
/* Hit received from a remote shooter on a local participant's drone */
function fpvNetHit(owner, dmg) {
  const d = DRONES.find((x) => x.owner === owner && x.local && !x.dead);
  if (d) { d.hp -= clamp(+dmg || 0, 0, 100); if (d.hp <= 0) fpvEnd(d, false); }
}

/* ---------- Pilot's screen ---------- */
function fpvHudText() {
  const g = actGlyph('fire');
  hudHtml($('fpvKey'), g ? _t('{0} Detonate', g) : esc(_t('Detonate')));
}
function fpvHud() {
  const d = PILOT.d, left = clamp(1 - d.t / FPV.life, 0, 1);
  hudStyle($('fpvBat'), 'transform', `scaleX(${left.toFixed(3)})`);
  hudCls($('fpvHud'), 'low', left < 0.25);
  if (HUD.fpvMode !== inputMode()) { HUD.fpvMode = inputMode(); fpvHudText(); }
}
