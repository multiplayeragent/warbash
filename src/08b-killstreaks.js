/* ==========================================================================
   KILLSTREAKS
   Tactical tablet in first person, satellite map rendered by three.js
   (orthographic camera + render target), cursor target selection,
   fighters, bombs and drone modeled with three.js geometries.
   ========================================================================== */
const KS = { mode: null, stage: '', t: 0, st: 0, pressT: -1, map: { open: false, x: 0, z: 0, yaw: 0, t0: 0 }, rig: null, mats: null, sat: null, plan: null, jets: [], bombs: [], drones: [], helis: [], geo: null, hgeo: null, warm: null };
/* Consecutive kills needed (without dying) for each streak (KSDEF catalog, 06i-weapons.js) */
const STREAK = {}; for (const id of KS_IDS) STREAK[id] = KSDEF[id].n;
/* Default keys for slots 1 to 3 (actions ks1 to ks3, 08a-binds.js) */
const KS_KEYS = ['Digit4', 'Digit5', 'Digit6'];
/* Calls the streak in slot slot (0 to 2) of the player's class */
function useKs(slot) {
  const id = PL.ksSel[slot]; if (!id) return;
  if (ksJammed(PL.ent.team) && PL.ks[id]) { hudMsg(_t('Killstreaks jammed by an EMP'), 'enemy', 1.8); return; }
  KSDEF[id].use();
}
/* Action (key, button) that calls streak id, '' if it is not in the class */
function ksAct(id) { const i = PL.ksSel.indexOf(id); return i < 0 ? '' : 'ks' + (i + 1); }
/* UAV: a sonar, not a live track. Every UAV.pulse seconds, it records each soldier's position (uavPulse); on the minimap, a wave
   leaves the player at UAV.speed m/s and each opponent only appears, at its recorded position, as the wave passes, stays UAV.hold s then fades out over
   UAV.fade s (uavBlip). Between two readings, you don't know where it went. The strike map and the team's bots read the same reading. */
const UAV = { life: 30, pulse: 3, speed: 60, hold: 1, fade: 1.6 };
function uavStart(team) { MATCH.uav[team] = UAV.life; uavPulse(team); }
function uavPulse(team) {
  const pts = [];
  for (const o of entities) if (o.alive && !o.off) pts.push({ o, x: o.pos.x, z: o.pos.z });
  MATCH.uavPing[team] = { t: MATCH.time, pts };
  if (team === PL.ent.team && PL.ent.alive) sfxPing();
}
function uavTick(dt) {
  for (const team of [0, 1]) {
    MATCH.sat[team] = Math.max(0, MATCH.sat[team] - dt); MATCH.emp[team] = Math.max(0, MATCH.emp[team] - dt);
    if (MATCH.uav[team] <= 0) continue;
    MATCH.uav[team] = Math.max(0, MATCH.uav[team] - dt);
    const p = MATCH.uavPing[team];
    if (MATCH.uav[team] > 0 && (!p || MATCH.time - p.t >= UAV.pulse)) uavPulse(team);
  }
}
/* Satellite: opponents live, with their orientation, for SAT.life seconds (minimap, strike map, team bots).
   EMP: the opposing team is jammed for EMP.life seconds (MATCH.emp[team], ksJammed): minimap without markers, UAV and satellite cut, streaks
   blocked (useKs, botStreak), helicopter unable to fire for EMP.stun seconds (heliBrain). Each call goes through satFire and empFire: player, bot or
   event received online (netEventIn); netSat and netEmp only publish the call of a local participant. */
const SAT = { life: 30 }, EMP = { life: 25, stun: 3 };
const ksJammed = (team) => MATCH.emp[team] > 0;
const satOn = (team) => MATCH.sat[team] > 0 && !ksJammed(team);
function satFire(owner) {
  const me = owner === PL.ent, ally = owner.team === PL.ent.team;
  MATCH.sat[owner.team] = SAT.life; netSat(owner);
  if (ally) sfxPing();
  sfxAnnounce(ksFriendly(owner) ? 'sat_on' : 'sat_enemy'); // radio announcement (05a-sfx.js)
  hudMsg(me ? _t('Satellite online') : ally ? _t('Allied satellite ({0})', owner.name) : _t('Enemy satellite online'), ally ? 'ally' : 'enemy', 2.5);
}
function empFire(owner) {
  const me = owner === PL.ent, ally = owner.team === PL.ent.team, foe = 1 - owner.team;
  MATCH.emp[foe] = EMP.life; MATCH.uav[foe] = 0; MATCH.sat[foe] = 0; MATCH.uavPing[foe] = null; // the UAV's drone leaves with it (updateAircraft)
  for (const h of KS.helis) if (h.team === foe && h.state !== 'crash') { h.stunT = MATCH.time + EMP.stun; h.burst = null; }
  const hit = !me && PL.ent.team === foe; // the player is on the jammed team: flash on screen, call in progress cut (the streak stays ready)
  netEmp(owner); sfxEmp(hit ? 1 : 0.5); sfxAnnounce(ksFriendly(owner) ? 'emp_on' : 'emp_enemy');
  if (hit) { if (KS.mode && KS.pressT < 0) ksAbort(); const fx = $('empFx'); fx.classList.remove('on'); void fx.offsetWidth; fx.classList.add('on'); }
  hudMsg(me ? _t('EMP triggered') : ally ? _t('Allied EMP ({0})', owner.name) : _t('Enemy EMP, your devices are jammed'), ally ? 'ally' : 'enemy', 2.5);
}
/* Streaks called by the terminal (UAV, helicopter, satellite, EMP) */
const KS_PHONE = new Set(['uav', 'heli', 'sat', 'emp', 'fpv']);
function usePhoneKs(id) { if (PL.ks[id] && ksStart(id)) { PL.ks[id] = false; updateStreakHud(); } }
/* Marker of an opponent o in the latest reading of me's team: { x, z, a } (a: opacity from 0 to 1), or null. wave: it only appears as the
   wave from me passes (minimap); otherwise from the reading on (strike map, overview) */
function uavBlip(o, me, wave) {
  const p = MATCH.uavPing[me.team]; if (!p || ksJammed(me.team)) return null;
  const q = p.pts.find((r) => r.o === o); if (!q) return null;
  const seen = p.t + (wave ? hyp(q.x - me.pos.x, q.z - me.pos.z) / UAV.speed : 0), age = MATCH.time - seen;
  if (age < 0 || age > UAV.hold + UAV.fade) return null;
  return { x: q.x, z: q.z, a: age < UAV.hold ? 1 : 1 - (age - UAV.hold) / UAV.fade };
}

/* ---------- Satellite map: orthographic render of the real scene ----------
   No longer displayed since the gray plan (KS.plan, 09ga-minimap.js): the strike map, the tablet and the minimap draw it instead. Its render stays
   at load because it also does the program sweep on phones (gpuDrawScan); KS.sat is now only read by the tests (gpu.js). */
/* Reading without the GPU (last resort of a device whose driver didn't support the overview render, GPUX.lean.sat = 2): plain ground and buildings */
function satelliteFlat(W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = VOID.on ? VOID_SAT : '#4a4638'; g.fillRect(0, 0, W, H);
  satFlatDraw(g, TAC_S, MAP.x0, MAP.z0);
  return c;
}
/* Plan drawn without a reading, at S pixels per meter from (X0, Z0): plain ground (above the void, only the islands and bridges) and buildings */
function satFlatDraw(g, S, X0, Z0) {
  const box = (b, col) => { g.fillStyle = col; g.fillRect((b.x0 - X0) * S, (b.z0 - Z0) * S, (b.x1 - b.x0) * S, (b.z1 - b.z0) * S); };
  if (!VOID.on) box(MAP, '#4a4638');
  else for (const b of COL) if (!b.ray && !b.inv && b.y1 > -1 && b.y1 < 2.4) box(b, '#4a4638');
  for (const b of COL) if (!b.ray && !b.inv && b.y1 >= 2.4) box(b, '#8d8470');
}
/* Floating islands: under the islands, the sea of clouds, which the sky (masked for the reading) doesn't draw. VOID_SAT is the tint wanted on screen;
   the render background is that tint brought back through the reading's final stage (satExp exposure, ACES then gamma: each step is undone) */
const VOID_SAT = '#9fb3c9';
function satVoidClear() {
  const e = CURMAP.def.atmo.satExp, h = parseInt(VOID_SAT.slice(1), 16);
  const lin = (v) => { const y = Math.min(Math.pow(v / 255, 2.2), 0.8), a = 2.43 * y - 2.51, b = 0.59 * y - 0.03; return (-b - Math.sqrt(b * b - 0.56 * y * a)) / (2 * a) / e; };
  return new THREE.Color().setRGB(lin(h >> 16 & 255), lin(h >> 8 & 255), lin(h & 255));
}
/* The reading is rendered in tiles on phones (GPUX.lean.sat: 0 full resolution, 1 quarter resolution without antialiasing, 2 no GPU render): each tile is
   a short render, followed by a barrier (gpuBarrier) that dates a context loss to the tile. It comes after program compilation (mapCompile): it is the
   first overview render of the scene, it must not also compile them all at once. */
async function buildSatelliteMap(tiles, scan) { // tiles: number of tiles per side, scan: sweep of the draws (true, false), forced by the tests (tools/dev/visual/gpu.js)
  const W = Math.round((MAP.x1 - MAP.x0) * TAC_S), H = Math.round((MAP.z1 - MAP.z0) * TAC_S);
  if (GPUX.lean.sat >= 2) { KS.sat = satelliteFlat(W, H); gpuLog('satellite drawn without the GPU'); return; }
  const lo = GPUX.lean.sat >= 1, RW = lo ? Math.max(64, W >> 2) : W, RH = lo ? Math.max(64, H >> 2) : H;
  const nt = tiles || (COARSE || GFX_SAFE ? (lo ? 2 : 3) : 1); // tiles per side
  const cam = new THREE.OrthographicCamera(MAP.x0, MAP.x1, -MAP.z0, -MAP.z1, 1, 120); cam.layers.enable(LAYER_NEAR);
  cam.up.set(0, 0, -1); cam.position.set(0, 60, 0); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
  const saved = { p: camera.position.clone(), r: camera.rotation.clone(), fog: scene.fog.density, dust: FX.dust.visible, cc: renderer.getClearColor(new THREE.Color()), ca: renderer.getClearAlpha() };
  // the shadow cascades are set for a plunging camera above the map
  camera.position.set(0, 50, 0); camera.rotation.set(-Math.PI / 2, 0, 0); updateShadows();
  scene.fog.density = 0; FX.dust.visible = false; sky.visible = false;
  const weather = MAPL.root ? MAPL.root.children.filter((o) => o.userData.weather && o.visible) : []; for (const o of weather) o.visible = false;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const quad = new THREE.FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: { t: { value: null }, uExp: { value: CURMAP.def.atmo.satExp } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D t; uniform float uExp; varying vec2 vUv; vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); } void main(){ vec3 c = aces(texture2D(t, vUv).rgb*uExp); gl_FragColor = vec4(pow(c, vec3(1.0/2.2)), 1.0); }',
    depthTest: false, depthWrite: false,
  }));
  try {
    // on phones, a tiny render per program family before the reading: a family the driver doesn't support is read here (gpuDrawScan, 01a-gpu.js)
    if (scan === undefined ? (COARSE || GFX_SAFE) && !gpuScanDone(MAPL.id) : scan) {
      // the sky, dust and weather, masked for the reading, are partly drawn: their families are part of the sweep
      FX.dust.visible = saved.dust; sky.visible = true; for (const o of weather) o.visible = true;
      try { await gpuDrawScan(scene, cam, MAPL.id); } finally { FX.dust.visible = false; sky.visible = false; for (const o of weather) o.visible = false; }
      if (csm) { updateShadows(); for (const l of csm.lights) l.shadow.needsUpdate = true; } // the shadow cameras now have their orientation (see the prior render below)
    }
    renderer.shadowMap.needsUpdate = true; // shadows are computed on the first render, the following tiles reuse them (autoUpdate is off, see 01-core.js)
    for (let ty = 0; ty < nt; ty++) for (let tx = 0; tx < nt; tx++) {
      const x0 = Math.floor(tx * RW / nt), x1 = Math.floor((tx + 1) * RW / nt), y0 = Math.floor(ty * RH / nt), y1 = Math.floor((ty + 1) * RH / nt), w = x1 - x0, h = y1 - y0;
      if (nt > 1) cam.setViewOffset(RW, RH, x0, y0, w, h);
      const rt = new THREE.WebGLRenderTarget(w, h, lo ? { type: THREE.HalfFloatType } : { type: THREE.HalfFloatType, samples: 4 });
      renderer.setRenderTarget(rt); renderer.setClearColor(VOID.on ? satVoidClear() : 0x2a2620, 1);
      // very first render (startup): CSM places its cascades from the orientation of the shadow cameras, which only exists
      // after a first shadow render; without this prior render, the reading came out with no shadows at all
      if (csm && csm.lights.some((l) => !l.shadow.map)) {
        renderer.clear(); renderer.render(scene, cam);
        updateShadows(); for (const l of csm.lights) l.shadow.needsUpdate = true;
        renderer.shadowMap.needsUpdate = true;
      }
      renderer.clear(); renderer.render(scene, cam);
      const out = new THREE.WebGLRenderTarget(w, h);
      quad.material.uniforms.t.value = rt.texture;
      renderer.setRenderTarget(out); quad.render(renderer);
      const px = new Uint8Array(w * h * 4); renderer.readRenderTargetPixels(out, 0, 0, w, h, px);
      renderer.setRenderTarget(null);
      rt.dispose(); out.dispose();
      const img = g.createImageData(w, h);
      for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
      if (lo) { const s2 = document.createElement('canvas'); s2.width = w; s2.height = h; s2.getContext('2d').putImageData(img, 0, 0); g.imageSmoothingQuality = 'high'; const dx = Math.floor(x0 * W / RW), dy = Math.floor(y0 * H / RH); g.drawImage(s2, dx, dy, Math.ceil(x1 * W / RW) - dx, Math.ceil(y1 * H / RH) - dy); }
      else g.putImageData(img, x0, y0);
      if (nt > 1) await gpuBarrier('satellite ' + (ty * nt + tx + 1) + '/' + nt * nt);
    }
  } finally {
    renderer.setRenderTarget(null); renderer.setClearColor(saved.cc, saved.ca);
    // a FullScreenQuad's geometry is shared by all post-processing passes: only the material is freed
    // (quad.dispose() would free it, and during loading, with no new frame, three.js wouldn't send it back to the GPU)
    quad.material.dispose(); cam.clearViewOffset();
    scene.fog.density = saved.fog; FX.dust.visible = saved.dust; sky.visible = true;
    for (const o of weather) o.visible = true;
    camera.position.copy(saved.p); camera.rotation.copy(saved.r); updateShadows();
  }
  KS.sat = c;
}
const TAC_S = 7.5; // pixels per meter on the tactical map
const tacX = (x) => (x - MAP.x0) * TAC_S, tacY = (z) => (z - MAP.z0) * TAC_S;

/* ---------- Tablet in first person ----------
   Rugged tablet held in both hands by the bottom of the sides: thumbs on the frame, fingers behind (hidden by the tablet),
   forearms rising from the bottom of the screen. Frame: x to the right, y up, z toward the front of the screen. */
const TABLET = { w: 0.26, h: 0.172, d: 0.022, scr: [0.208, 0.13, 0.012] };
/* right hand (the left mirrored): palm center just outside the side and behind the tablet, fingers up,
   inward and backward (they go behind), back of the hand outward; the thumb, radial side, comes onto the frame */
const TABLET_GRIP = { p: [0.142, -0.03, -0.04], f: [-0.5, 0.8, -0.4], b: [1, 0, -0.6] };
function buildTabletRig() {
  const M = gunMaterials(), K = ksDevMats(), g = new THREE.Group(), T = TABLET; g.visible = false; VM.root.add(g);
  // olive shell, dark screen frame, big rubber corners, grained rubber strips on the sides (where the hands are)
  rb(g, K.shell, 0, 0, 0, T.w, T.h, T.d, 0.01);
  rb(g, K.face, 0, 0.002, T.d / 2 + 0.0004, 0.232, 0.154, 0.002, 0.005);
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) rb(g, K.rubber, sx * (T.w / 2 - 0.011), sy * (T.h / 2 - 0.011), 0, 0.034, 0.034, T.d + 0.007, 0.01);
    rb(g, K.rubber, sx * (T.w / 2 - 0.0015), 0, 0, 0.007, T.h - 0.07, T.d + 0.003, 0.003);
    // shell screws and strap handle on the back
    for (const sy of [-1, 1]) cy(g, K.metal, sx * 0.108, sy * 0.074, T.d / 2 + 0.0006, 0.0022, 0.0012);
    rb(g, K.rubber, sx * 0.07, 0, -T.d / 2 - 0.003, 0.03, 0.11, 0.006, 0.003);
  }
  // below the screen: three keys and an indicator; above: lens; short antenna on the top right corner
  for (let i = 0; i < 3; i++) rb(g, K.metal, -0.024 + i * 0.024, -0.065, T.d / 2 + 0.0012, 0.016, 0.006, 0.002, 0.0015);
  const led = new THREE.Mesh(G_CYL12, M.dot); led.scale.set(0.0018, 0.001, 0.0018); led.rotation.x = Math.PI / 2; led.position.set(0.09, -0.065, T.d / 2 + 0.0012); g.add(led);
  cy(g, M.glass, 0, 0.071, T.d / 2 + 0.0008, 0.0032, 0.0016);
  cy(g, K.metal, 0.1, T.h / 2 + 0.004, -0.003, 0.006, 0.01, 0);
  cy(g, K.rubber, 0.1, T.h / 2 + 0.024, -0.003, 0.0048, 0.032, 0);
  part(g, new THREE.SphereGeometry(1, 10, 8), K.rubber, 0.1, T.h / 2 + 0.04, -0.003, 0.0048, 0.0048, 0.0048);
  const sc = document.createElement('canvas'); sc.width = 320; sc.height = 200;
  const tex = new THREE.CanvasTexture(sc); tex.encoding = THREE.sRGBEncoding;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(T.scr[0], T.scr[1]), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color().setRGB(1.5, 1.5, 1.5) }));
  scr.position.set(0, T.scr[2], T.d / 2 + 0.0016); g.add(scr);
  const grips = {};
  for (const s of [-1, 1]) { const G = TABLET_GRIP; grips[s > 0 ? 'R' : 'L'] = devGrip(g, [s * G.p[0], G.p[1], G.p[2]], [s * G.f[0], G.f[1], G.f[2]], [s * G.b[0], G.b[1], G.b[2]]); }
  bakeRig(g);
  KS.rig = { g, tex, sc, grips, armR: makeArm(M, VM.root, -1), armL: makeArm(M, VM.root, 1) };
  setArmVisible(KS.rig.armR, false); setArmVisible(KS.rig.armL, false);
}
function drawTabletScreen() {
  const R = KS.rig, g = R.sc.getContext('2d'), W = R.sc.width, H = R.sc.height, t = MATCH.time;
  g.fillStyle = '#07120b'; g.fillRect(0, 0, W, H);
  if (KS.mode === 'uav') {
    const cx = W / 2, cy = H / 2 + 6;
    g.strokeStyle = 'rgba(120,230,140,0.45)'; g.lineWidth = 1.5;
    for (const r of [22, 44, 66, 86]) { g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke(); }
    g.beginPath(); g.moveTo(cx - 90, cy); g.lineTo(cx + 90, cy); g.moveTo(cx, cy - 90); g.lineTo(cx, cy + 90); g.stroke();
    const a = t * 3.2;
    const grd = g.createConicGradient ? g.createConicGradient(a - 0.8, cx, cy) : null;
    if (grd) { grd.addColorStop(0, 'rgba(120,230,140,0)'); grd.addColorStop(0.12, 'rgba(120,230,140,0.35)'); grd.addColorStop(0.13, 'rgba(120,230,140,0)'); g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, 86, 0, TAU); g.fill(); }
    g.strokeStyle = '#8fe89a'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 86, cy + Math.sin(a) * 86); g.stroke();
    if (KS.pressT >= 0) for (const e of entities) if (e.alive && !allied(e, PL.ent)) { g.fillStyle = '#ff5a48'; g.beginPath(); g.arc(cx + e.pos.x * 1.1, cy + e.pos.z * 0.72, 3.5, 0, TAU); g.fill(); }
    g.fillStyle = '#b6f3bd'; g.font = '600 20px "Barlow Condensed", sans-serif';
    g.fillText(KS.pressT >= 0 ? _t('UAV online') : _t('Drone link'), 12, 26);
  } else {
    const h = H - 20, w = h * ((MAP.x1 - MAP.x0) / (MAP.z1 - MAP.z0));
    if (KS.plan) g.drawImage(KS.plan, 12, 10, w, h);
    g.fillStyle = 'rgba(7,18,11,0.22)'; g.fillRect(12, 10, w, h); // (the screen is lit: a veil so the buildings don't dazzle)
    // the strike zone, at the plan's scale: red disc, outline that blinks during the choice
    // mecha: the drop zones, the chosen one in solid green
    const mk = KS.mode === 'mecha', sx = (x) => 12 + (x - MAP.x0) / (MAP.x1 - MAP.x0) * w, sz = (z) => 10 + (z - MAP.z0) / (MAP.z1 - MAP.z0) * h, sel = mk ? mnavZone(KS.map.x, KS.map.z) : null;
    const zr = (mk ? MECHA_D.blast : AIR.r) / (MAP.x1 - MAP.x0) * w, mx = sel ? sx(sel.x) : sx(KS.map.x), my = sel ? sz(sel.z) : sz(KS.map.z);
    if (mk) for (const q of MNAV.zones) if (q !== sel) { g.strokeStyle = 'rgba(143,209,106,0.55)'; g.lineWidth = 1.5; g.beginPath(); g.arc(sx(q.x), sz(q.z), Math.max(zr, 3), 0, TAU); g.stroke(); }
    if (!mk || sel) {
      g.fillStyle = mk ? 'rgba(143,209,106,0.4)' : 'rgba(228,71,59,0.35)'; g.beginPath(); g.arc(mx, my, Math.max(zr, 3), 0, TAU); g.fill();
      if (Math.floor(t * 4) % 2 === 0 || KS.stage === 'confirm') { g.strokeStyle = mk ? '#8fd16a' : '#ff5a48'; g.lineWidth = 2; g.stroke(); }
    }
    g.fillStyle = '#b6f3bd'; g.font = '600 20px "Barlow Condensed", sans-serif';
    g.fillText(mk ? _t('Mecha airdrop') : _t('Air support'), w + 24, 30);
    g.font = '500 16px "Barlow Condensed", sans-serif';
    g.fillText(KS.stage === 'confirm' ? _t('Target confirmed') : KS.stage === 'cancel' ? _t('Canceled') : _t('Select a target'), w + 24, 54);
    const zp = mk && mnavZone(KS.map.x, KS.map.z) || KS.map; g.fillText(zoneName(zp.x, zp.z), w + 24, 76);
  }
  g.strokeStyle = 'rgba(180,240,190,0.25)'; g.strokeRect(2, 2, W - 4, H - 4);
  R.tex.needsUpdate = true;
}

/* ---------- Trigger ---------- */
function ksBusy() { return !!KS.mode; }
function ksStart(mode) {
  if (KS.mode || !PL.ent.alive || PL.knifeT > 0 || PL.nadeState || PL.switching > 0) return false;
  KS.mode = mode; KS.stage = 'raise'; KS.t = 0; KS.st = 0; KS.pressT = -1; KS.drawn = false;
  PL.reload = null; VM.action = null; PL.adsWant = false; PL.held = false;
  // the weapon goes behind the back, the device then comes out
  sfxMech('stow'); if (mode === 'air' || mode === 'mecha') sfxKs('up');
  return true;
}
function useUAV() { if (PL.ks.uav && ksStart('uav')) { PL.ks.uav = false; updateStreakHud(); challengeAdd('tUav'); } }
function useAirstrike() {
  if (!PL.ks.air || !ksStart('air')) return;
  const f = camFwd(new V3()), h = rayWorld(camera.position.x, camera.position.y, camera.position.z, f.x, f.y, f.z, 120);
  const p = h ? camera.position.clone().addScaledVector(f, h.t) : PL.ent.pos.clone().addScaledVector(new V3(f.x, 0, f.z).normalize(), 35);
  // the zone opens on the aimed point; the planes arrive behind the player (look heading), nothing to orient
  KS.map.x = clamp(p.x, MAP.x0 + 2, MAP.x1 - 2); KS.map.z = clamp(p.z, MAP.z0 + 2, MAP.z1 - 2); KS.map.yaw = PL.yaw;
}
/* Mecha: the tablet opens on the drop zone closest to the aimed point (mnavZone, 08f-mecha.js); you choose one of the map's zones */
function useMecha() {
  if (!PL.ks.mecha || !ksStart('mecha')) return;
  const f = camFwd(new V3()), h = rayWorld(camera.position.x, camera.position.y, camera.position.z, f.x, f.y, f.z, 60);
  const p = h ? camera.position.clone().addScaledVector(f, h.t) : PL.ent.pos.clone().addScaledVector(new V3(f.x, 0, f.z).normalize(), 20);
  const q = mnavZone(p.x, p.z) || p;
  KS.map.x = clamp(q.x, MAP.x0 + 2, MAP.x1 - 2); KS.map.z = clamp(q.z, MAP.z0 + 2, MAP.z1 - 2); KS.map.yaw = PL.yaw;
}
function ksOpenMap() {
  const mk = KS.mode === 'mecha'; hudText($('tacTitle'), mk ? _t('Mecha airdrop') : _t('Airstrike')); hudText($('tcMapHint'), mk ? _t('Tap a drop zone') : _t('Tap the map to call in the strike'));
  KS.map.open = true; KS.map.t0 = MATCH.time; tacLegend(); $('tacmap').classList.add('show'); $('hud').classList.add('dim'); }
/* Strike map legend: the keys or buttons of the input mode (on touch, the #tcMapBar buttons replace it) */
function tacLegend() {
  KS.map.lm = inputMode(); const pad = KS.map.lm === 'pad';
  const L = pad
    ? [[keyGlyph('LS', 'pad sh') + keyGlyph('RS', 'pad sh'), _t('Aim')], [padGlyph(0) + padGlyph(7), _t('Confirm')], [padGlyph(1), _t('Cancel')]]
    : [[keyGlyph(_t('Mouse'), 'mouse'), _t('Aim')], [actGlyph('fire'), _t('Confirm')], [actGlyph('ads'), _t('Cancel')]];
  hudHtml($('tacKeys'), L.map(([g, t]) => `<span>${g}<b>${esc(t)}</b></span>`).join(''));
}
function ksCloseMap() { KS.map.open = false; $('tacmap').classList.remove('show'); $('hud').classList.remove('dim'); }
function ksConfirm() {
  if (!KS.map.open || MATCH.time - KS.map.t0 < KS_MAP_GRACE) return; // a button already pressed when the map opens (jump, fire) doesn't launch the strike
  if (KS.mode === 'mecha') {
    const q = mnavZone(KS.map.x, KS.map.z);
    if (!q) { hudMsg(_t('No drop zone on this map'), 'none', 1.6); sfxUi('locked'); return; }
    const p = new V3(q.x, q.y, q.z);
    ksCloseMap(); KS.stage = 'confirm'; KS.st = 0; KS.pressT = 0; PL.ks.mecha = false; updateStreakHud(); sfxKs('confirm');
    mechaCall(PL.ent, p, Math.atan2(-(p.x - PL.ent.pos.x), -(p.z - PL.ent.pos.z)) + Math.PI); // it lands turned away from the player, toward the front
    return;
  }
  ksCloseMap(); KS.stage = 'confirm'; KS.st = 0; KS.pressT = 0; PL.ks.air = false; updateStreakHud();
  sfxKs('confirm');
  netAirstrike(new V3(KS.map.x, 0, KS.map.z), KS.map.yaw, PL.ent);
  hudMsg(_t('Airstrike incoming'), 'ally', 2.5);
}
function ksCancel() {
  if (KS.mode !== 'air' && KS.mode !== 'mecha') return;
  ksCloseMap(); KS.stage = 'cancel'; KS.st = 0; sfxKs('cancel');
}
function ksAbort() {
  // call cut before the button (died during the gesture): the streak wasn't used, it stays ready (the strike, for its part, is only spent on confirmation)
  if (KS_PHONE.has(KS.mode) && KS.pressT < 0) { PL.ks[KS.mode] = true; updateStreakHud(); }
  if (KS.map.open) ksCloseMap(); KS.mode = null; VM.sling = 0;
  if (KS.rig) { KS.rig.g.visible = false; setArmVisible(KS.rig.armR, false); setArmVisible(KS.rig.armL, false); }
  if (KS.phone) { KS.phone.g.visible = false; setArmVisible(KS.phone.arm, false); }
}
/* Movement of the aimed point, in meters */
function ksMapMove(dx, dz) {
  const m = KS.map;
  m.x = clamp(m.x + dx, MAP.x0 + 1, MAP.x1 - 1); m.z = clamp(m.z + dz, MAP.z0 + 1, MAP.z1 - 1);
}
/* Captured mouse: the point follows the mouse like a cursor, 1 mouse pixel for 1 pixel of the displayed map (before, 0.07 m per pixel: a little over half
   a cursor's speed). The gamepad goes through padMapMove (09qc-gamepad.js). */
function ksMapMouse(dx, dy) {
  const r = $('tacCanvas').getBoundingClientRect(), k = r.height > 0 ? (MAP.z1 - MAP.z0) / r.height : 0.12;
  ksMapMove(dx * k, dy * k);
}
function ksMapKey(code) {
  if (code === 'Enter' || code === 'Space') ksConfirm();
  else if (code === KS_KEYS[PL.ksSel.indexOf(KS.mode)] || code === 'KeyX' || code === 'Backspace') ksCancel(); // the streak's key cancels it
}

/* Common streak sequence: the weapon goes behind the back over the shoulder (0.26 s), the device
   comes out from behind, it is used, stowed, then the weapon comes back from the shoulder with a small
   bounce. Freedom of movement is kept throughout (except on the targeting map). */
const KS_T = { stow: 0.26, draw: 0.36 };
/* Terminal: moment of the button press, start of the return to the hip (seconds since the call) */
const KS_PH = { press: 0.48, down: 0.74 };
/* Poses of the devices in camera space, out (up) and stowed (down): position x, y, z then rotation x, y, z */
const PHONE_POSE = { up: [0.072, -0.058, -0.295, -0.3, -0.22, 0.12], down: [0.3, -0.46, -0.16, -1.2, -0.9, 0.9] };
const TABLET_POSE = { up: [0, -0.055, -0.36, -0.3, 0, 0], down: [0.06, -0.62, -0.3, -1.35, 0.25, 0.3] };
/* the device and its arms are only visible when the weapon is far enough behind the back (weapon arms hidden, see updateViewmodel) */
const KS_GATE = 0.55;
function ksSling(dt, stowing) {
  // stowing: soft curve; drawing: quick arrival then slight overshoot that settles
  if (stowing) VM.sling = Math.min(1, VM.sling + dt / KS_T.stow);
  else {
    if (!KS.drawn) { KS.drawn = true; KS.drawT = 0; sfxMech('draw'); }
    KS.drawT += dt; const u = clamp(KS.drawT / KS_T.draw, 0, 1);
    VM.sling = (1 - smoothstep(0, 1, u)) - Math.sin(u * Math.PI) * 0.06 * u;
  }
  return !stowing && KS.drawT >= KS_T.draw;
}
function updateKillstreak(dt) {
  const R = KS.rig; if (!R) return;
  if (!KS.mode) { if (R.g.visible || (KS.phone && KS.phone.g.visible)) ksAbort(); return; }
  if (!PL.ent.alive) { ksAbort(); return; }
  KS.t += dt; KS.st += dt;
  const B = VM.bobO, BR = VM.bobR, run = VM.sprint;
  if (KS_PHONE.has(KS.mode)) {
    const P = KS.phone, t = KS.t;
    // the terminal comes out from behind the right hip once the weapon is behind the back, the thumb presses the call button, we keep the
    // terminal in front of the eyes for a moment (the screen confirms the call), then it returns to the hip
    const up = smoothstep(0.16, 0.38, t) * (1 - smoothstep(KS_PH.down, KS_PH.down + 0.16, t));
    if (KS.pressT < 0 && t > KS_PH.press) {
      KS.pressT = 0; sfxKs('press');
      // helicopter refused (an ally called one during the gesture): the streak stays ready
      if (KS.mode === 'heli') { if (!callHeli(PL.ent)) { PL.ks.heli = true; updateStreakHud(); hudMsg(_t('A helicopter is already airborne'), 'none', 1.8); } }
      else if (KS.mode === 'sat') satFire(PL.ent);
      else if (KS.mode === 'emp') empFire(PL.ent);
      else if (KS.mode === 'fpv') fpvLaunch(PL.ent);
      else {
        uavStart(PL.ent.team); spawnDrone(PL.ent.team); netUav(PL.ent); sfxAnnounce('uav_on');
        hudMsg(_t('UAV online'), 'ally', 2);
      }
    }
    if (KS.pressT >= 0) KS.pressT += dt;
    P.g.visible = up > 0.01 && VM.sling > KS_GATE;
    const U = PHONE_POSE.up, D = PHONE_POSE.down, pk = KS.pressT >= 0 ? Math.sin(clamp(KS.pressT / 0.22, 0, 1) * Math.PI) : 0;
    // the thumb press dips the terminal a few millimeters
    P.g.position.set(lerp(D[0], U[0], up) + B.x - run * 0.02, lerp(D[1], U[1], up) + B.y - run * 0.03 + Math.sin(MATCH.time * 2) * 0.002 - pk * 0.004, lerp(D[2], U[2], up) - pk * 0.004);
    P.g.rotation.set(lerp(D[3], U[3], up) + BR.x - run * 0.12 - pk * 0.06, lerp(D[4], U[4], up) + BR.y, lerp(D[5], U[5], up) + BR.z);
    P.press(pk);
    if (P.g.visible) drawPhoneScreen(KS.pressT >= 0);
    armOnDevice(P.arm, P.grip, 'P', 'hold', pk, P.g.visible, 0.35);
    if (P.g.visible) attachToHand(P.g, P.grip, P.arm.hand);
    if (ksSling(dt, t < KS_PH.down + 0.12)) { KS.mode = null; P.g.visible = false; setArmVisible(P.arm, false); VM.sling = 0; }
    return;
  }
  let raise = 0, stowing = true;
  if (KS.stage === 'raise') { raise = smoothstep(0.14, 0.45, KS.t); if (KS.t > 0.5) { KS.stage = 'select'; ksOpenMap(); } }
  else if (KS.stage === 'select') raise = 1;
  else {
    const hold = KS.stage === 'confirm' ? 0.55 : 0.1;
    raise = 1 - smoothstep(hold, hold + 0.26, KS.st);
    // the weapon only returns once the tablet is almost put away: never both on screen
    stowing = raise > 0.4;
  }
  if (KS.pressT >= 0) KS.pressT += dt;
  if (ksSling(dt, stowing)) { KS.mode = null; VM.sling = 0; }
  // tablet pose, held in both hands; the right thumb touches the screen to confirm
  const g = R.g; g.visible = raise > 0.01 && KS.mode !== null && VM.sling > KS_GATE;
  const b = Math.sin(MATCH.time * 1.7) * 0.004, U = TABLET_POSE.up, D = TABLET_POSE.down;
  g.position.set(lerp(D[0], U[0], raise) + B.x, lerp(D[1], U[1], raise) + b + B.y, lerp(D[2], U[2], raise));
  g.rotation.set(lerp(D[3], U[3], raise) + BR.x, lerp(D[4], U[4], raise) + BR.y, lerp(D[5], U[5], raise) + BR.z);
  const pk = KS.pressT >= 0 ? Math.sin(clamp(KS.pressT / 0.32, 0, 1) * Math.PI) : 0;
  armOnDevice(R.armR, R.grips.R, 'R', 'tablet', pk, g.visible);
  armOnDevice(R.armL, R.grips.L, 'L', 'tablet', 0, g.visible);
  if (g.visible) drawTabletScreen();
}

/* ---------- Tactical map overlay ---------- */
function drawTacMap() {
  if (!KS.map.open) return;
  const cv = $('tacCanvas'), g = cv.getContext('2d'), W = cv.width, H = cv.height, t = MATCH.time, me = PL.ent;
  if (KS.plan) g.drawImage(KS.plan, 0, 0); else { g.fillStyle = MMPAL.bg; g.fillRect(0, 0, W, H); }
  // military grid
  g.strokeStyle = 'rgba(255,255,255,0.13)'; g.lineWidth = 1; g.font = '600 14px "Barlow Condensed", sans-serif'; g.fillStyle = 'rgba(230,234,236,0.75)';
  const MW = MAP.x1 - MAP.x0, MH = MAP.z1 - MAP.z0;
  for (let i = 0; i <= MW; i += 12) { g.beginPath(); g.moveTo(i * TAC_S, 0); g.lineTo(i * TAC_S, H); g.stroke(); if (i < MW) g.fillText(String.fromCharCode(65 + i / 12), i * TAC_S + 4, 14); }
  for (let j = 0; j <= MH; j += 12) { g.beginPath(); g.moveTo(0, j * TAC_S); g.lineTo(W, j * TAC_S); g.stroke(); if (j < MH) g.fillText(String(j / 12 + 1), 4, j * TAC_S + 28); }
  // zone names
  g.font = '600 15px "Barlow Condensed", sans-serif'; g.textAlign = 'center';
  const done = new Set();
  for (const z of ZONES) {
    const key = z[0] + Math.sign(z[3] + z[4]); if (done.has(key) || z[0] === _t('Alpha Base') || z[0] === _t('Bravo Base')) continue; done.add(key);
    const x = tacX((z[1] + z[2]) / 2), y = tacY((z[3] + z[4]) / 2);
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillText(z[0], x + 1, y + 1); g.fillStyle = 'rgba(236,229,211,0.85)'; g.fillText(z[0], x, y);
  }
  g.textAlign = 'left';
  // strike zone: a red disc of AIR.r meters and a wave spreading from it, under the units; mecha: the drop zones
  const m = KS.map, cx = tacX(m.x), cy = tacY(m.z), R = AIR.r * TAC_S, w = (t * 0.8) % 1, mk = KS.mode === 'mecha';
  if (mk) tacDrop(g, m, t);
  else {
  g.fillStyle = 'rgba(228,71,59,0.24)'; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(239,85,67,0.95)'; g.lineWidth = 3; g.stroke();
  g.strokeStyle = `rgba(239,85,67,${(0.6 * (1 - w)).toFixed(3)})`; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, R * (1 + w * 0.35), 0, TAU); g.stroke();
  g.strokeStyle = 'rgba(239,85,67,0.6)'; g.lineWidth = 1.5; g.setLineDash([8, 7]); g.beginPath(); g.arc(cx, cy, R * 0.55, 0, TAU); g.stroke(); g.setLineDash([]);
  }
  // units
  for (const o of entities) {
    if (!o.alive) continue;
    const x = tacX(o.pos.x), y = tacY(o.pos.z);
    if (o === me) {
      g.save(); g.translate(x, y); g.rotate(-o.yaw); g.fillStyle = '#F4BE3A'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(0, -11); g.lineTo(8, 8); g.lineTo(0, 4); g.lineTo(-8, 8); g.closePath(); g.fill(); g.stroke(); g.restore();
    } else if (allied(o, me)) {
      g.save(); g.translate(x, y); g.rotate(-o.yaw); g.fillStyle = '#8FD16A'; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, -8); g.lineTo(6, 6); g.lineTo(0, 3); g.lineTo(-6, 6); g.closePath(); g.fill(); g.stroke(); g.restore();
    } else {
      const shot = t - o.lastShotT < 1.5 || satOn(me.team), b = shot ? null : uavBlip(o, me, false); // shot or satellite: at its place; otherwise the UAV's latest reading
      if (!shot && !b) continue;
      g.globalAlpha = shot ? 1 : b.a;
      g.fillStyle = '#E4473B'; g.beginPath(); g.arc(shot ? x : tacX(b.x), shot ? y : tacY(b.z), 5.5, 0, TAU); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.6)'; g.stroke();
      g.globalAlpha = 1;
    }
  }
  // crosshair at the center of the zone
  const pr = 14;
  g.strokeStyle = '#fff'; g.lineWidth = 2;
  g.beginPath(); g.arc(cx, cy, pr, 0, TAU); g.moveTo(cx - pr - 10, cy); g.lineTo(cx - pr + 6, cy); g.moveTo(cx + pr - 6, cy); g.lineTo(cx + pr + 10, cy);
  g.moveTo(cx, cy - pr - 10); g.lineTo(cx, cy - pr + 6); g.moveTo(cx, cy + pr - 6); g.lineTo(cx, cy + pr + 10); g.stroke();
  const zp = mk && mnavZone(m.x, m.z) || m; hudText($('tacZone'), zoneName(zp.x, zp.z)); if (KS.map.lm !== inputMode()) tacLegend(); // (the hand switches from mouse to gamepad: the legend follows)
  const near = !mk && hyp(me.pos.x - m.x, me.pos.z - m.z) < AIR.r + 2;
  hudStyle($('tacWarn'), 'opacity', near ? '1' : '0');
}

/* Mecha drop zones on the map (MNAV.zones): each at the size of its drop's blast, a diamond at the center; the chosen one (the
   closest to the cursor or finger) in solid green, with a wave, linked to the cursor if it is elsewhere */
function tacDrop(g, m, t) {
  const sel = mnavZone(m.x, m.z), cx = tacX(m.x), cy = tacY(m.z), R = MECHA_D.blast * TAC_S, d = 1.4 * TAC_S, w = (t * 0.8) % 1;
  for (const q of MNAV.zones) {
    const x = tacX(q.x), y = tacY(q.z), on = q === sel;
    g.fillStyle = on ? 'rgba(143,209,106,0.3)' : 'rgba(143,209,106,0.1)'; g.strokeStyle = on ? '#8fd16a' : 'rgba(143,209,106,0.6)'; g.lineWidth = on ? 3 : 2;
    g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = on ? '#8fd16a' : 'rgba(143,209,106,0.6)'; g.beginPath(); g.moveTo(x, y - d); g.lineTo(x + d, y); g.lineTo(x, y + d); g.lineTo(x - d, y); g.closePath(); g.fill();
    if (!on) continue;
    g.strokeStyle = `rgba(143,209,106,${(0.6 * (1 - w)).toFixed(3)})`; g.lineWidth = 2; g.beginPath(); g.arc(x, y, R * (1 + w * 0.35), 0, TAU); g.stroke();
    if (hyp(x - cx, y - cy) > R) { g.strokeStyle = 'rgba(143,209,106,0.7)'; g.lineWidth = 2; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(cx, cy); g.lineTo(x, y); g.stroke(); g.setLineDash([]); }
  }
}
/* ---------- Aircraft: fighters, bombs, drone ---------- */
function aircraftGeometry() {
  if (KS.geo) return KS.geo;
  const hull = csmMaterial(new THREE.MeshStandardMaterial({ color: 0x80888f, roughness: 0.42, metalness: 0.55, envMapIntensity: 1 }));
  const dark = csmMaterial(new THREE.MeshStandardMaterial({ color: 0x2a2d30, roughness: 0.5, metalness: 0.5 }));
  const glass = csmMaterial(new THREE.MeshStandardMaterial({ color: 0x1c2a33, roughness: 0.05, metalness: 0.9, envMapIntensity: 1.6 }));
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(6, 3.2, 1.2), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const prof = [[0.0, -6.3], [0.5, -6.2], [0.62, -5.3], [0.82, -2], [0.86, 1.5], [0.7, 3.6], [0.44, 5.2], [0.16, 6.4], [0, 6.9]].map(([r, y]) => new THREE.Vector2(r, y));
  const fus = new THREE.LatheGeometry(prof, 16); fus.rotateX(-Math.PI / 2);
  const wing = new THREE.Shape(); wing.moveTo(0, 2.6); wing.lineTo(4.7, -1.7); wing.lineTo(4.7, -2.5); wing.lineTo(0, -2.9); wing.lineTo(-4.7, -2.5); wing.lineTo(-4.7, -1.7); wing.closePath();
  const wg = new THREE.ExtrudeGeometry(wing, { depth: 0.14, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 1 }); wg.rotateX(-Math.PI / 2); wg.translate(0, -0.1, 0.6);
  const outro = new THREE.Shape(); outro.moveTo(0, 0); outro.lineTo(2.3, 0); outro.lineTo(3.3, 2.5); outro.lineTo(2.4, 2.5); outro.closePath();
  const fg = new THREE.ExtrudeGeometry(outro, { depth: 0.1, bevelEnabled: false }); fg.rotateY(-Math.PI / 2); fg.translate(0.05, 0.45, 2.9);
  const tail = new THREE.Shape(); tail.moveTo(0, 1); tail.lineTo(2.1, -0.4); tail.lineTo(2.1, -0.9); tail.lineTo(0, -1); tail.lineTo(-2.1, -0.9); tail.lineTo(-2.1, -0.4); tail.closePath();
  const tg = new THREE.ExtrudeGeometry(tail, { depth: 0.08, bevelEnabled: false }); tg.rotateX(-Math.PI / 2); tg.translate(0, 0, 5.1);
  const canopy = new THREE.SphereGeometry(1, 16, 10); canopy.scale(0.46, 0.42, 1.5); canopy.translate(0, 0.55, -3.3);
  const nozzle = new THREE.CylinderGeometry(0.5, 0.58, 0.8, 16, 1, true); nozzle.rotateX(Math.PI / 2); nozzle.translate(0, 0, 6.5);
  const flame = new THREE.ConeGeometry(0.42, 2.6, 12, 1, true); flame.rotateX(-Math.PI / 2); flame.translate(0, 0, 8.1);
  // drone: thin fuselage, wide wingspan, V tail
  const dprof = [[0, -2.2], [0.25, -2.1], [0.3, -1.2], [0.32, 0.8], [0.22, 1.8], [0, 2.3]].map(([r, y]) => new THREE.Vector2(r, y));
  const dfus = new THREE.LatheGeometry(dprof, 12); dfus.rotateX(-Math.PI / 2);
  const dwing = new THREE.BoxGeometry(11, 0.07, 0.55); dwing.translate(0, 0.1, -0.2);
  const dv1 = new THREE.BoxGeometry(1.6, 0.05, 0.4); dv1.rotateZ(0.6); dv1.translate(0.6, 0.45, 1.9);
  const dv2 = new THREE.BoxGeometry(1.6, 0.05, 0.4); dv2.rotateZ(-0.6); dv2.translate(-0.6, 0.45, 1.9);
  const bomb = new THREE.CylinderGeometry(0.16, 0.16, 1.3, 10); bomb.rotateX(Math.PI / 2);
  // drone lamp (green seen from an ally, red from an enemy): shared by all drones
  const lamp = new THREE.SphereGeometry(0.12, 8, 6), lampMat = [0, 1].map((en) => new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(en ? 6 : 0.5, en ? 0.4 : 6, 0.4) }));
  KS.geo = { hull, dark, glass, glow, fus, wg, fg, tg, canopy, nozzle, flame, dfus, dwing, dv1, dv2, bomb, lamp, lampMat };
  return KS.geo;
}
function makeJet() {
  const G = aircraftGeometry(), g = new THREE.Group();
  for (const [geo, mat] of [[G.fus, G.hull], [G.wg, G.hull], [G.fg, G.hull], [G.tg, G.hull], [G.canopy, G.glass], [G.nozzle, G.dark]]) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); }
  const f = new THREE.Mesh(G.flame, G.glow); g.add(f); g.userData.flame = f;
  scene.add(g); return g;
}
/* Airstrike: a round zone of AIR.r meters, no axis to set. AIR.n bombs fall in the disc, their centers within AIR.spread meters at
   most of the middle, in a sunflower pattern (golden angle) rotated by the planes' heading: the pattern only depends on the target and the heading, sent online (rounded
   as in the message, netAirstrike), so every player sees the bombs fall where the owner computes the damage. With a blast of
   AIR.blast meters, the whole disc is lethal up to 10 m from the center and about three fifths at the edge (11 m), measured in the engine (airStrike.js):
   AIR.r is the displayed radius, the one where the zone stays lethal for most. Ten bombs over 8.5 m cover 430 m² in the open (351 m² with eight bombs
   over 7.2 m, 337 m² for the old band of six) and 23 m long in a 12 m street (21 m, 30 m).
   Shelter: a bomb bursts on the first surface it meets while falling (airImpact: a roof, even of those you can't walk on, which
   are only shot boxes; a skylight's glass doesn't stop it). The blast of a bomb that fell in the open does only AIR.roof of its damage
   to whoever stands under a roof (explode, roofK): in a house, you mostly survive a strike, unless standing on the threshold or against a
   window where several bombs fall; under an open awning, neighboring bombs remain lethal. Strike centered on the target, on all eight maps:
   at the back of a building, 16% deaths (30% without shelter), under an awning 76% (86%), in the open 98% (unchanged). Check: airStrike.js, part 4. */
const AIR = { r: 11, n: 10, spread: 8.5, blast: 8.5, dmg: 180, roof: 0.5 };
/* Roof above a point (up to h meters): a box that stops shots, glass aside */
function roofAbove(x, y, z, h) {
  for (let k = 0; k < 4; k++) {
    const r = rayWorld(x, y, z, 0, 1, 0, h, 2);
    if (!r) return false;
    if (r.m !== 'glass') return true;
    y += r.t + 0.3; h -= r.t + 0.3; if (h <= 0) return false;
  }
  return false;
}
/* Impact point of a bomb: the first surface hit when falling vertically (without props, which move: the same computation for all players),
   glass passed through. groundHeight, for its part, only sees what can be walked on. */
function airImpact(x, z) {
  let y = 60;
  for (let k = 0; k < 4; k++) {
    const r = rayWorld(x, y, z, 0, -1, 0, y + 260, 2);
    if (!r) return groundHeight(x, z, 12); // above the void (floating islands): see airstrike
    if (r.m !== 'glass') return y - r.t;
    y -= r.t + 0.3;
  }
  return groundHeight(x, z, 12);
}
const KS_MAP_GRACE = 0.2; // seconds after the map opens during which you can't confirm
function airPattern(target, yaw) {
  const pts = [], dir = new V3(-Math.sin(yaw), 0, -Math.cos(yaw));
  for (let i = 0; i < AIR.n; i++) {
    const r = AIR.spread * Math.sqrt((i + 0.5) / AIR.n), a = yaw + i * 2.39996;
    pts.push(new V3(clamp(target.x + Math.cos(a) * r, MAP.x0 + 1, MAP.x1 - 1), 0, clamp(target.z + Math.sin(a) * r, MAP.z0 + 1, MAP.z1 - 1)));
  }
  // in the order of the planes' passage: the first bombs fall at the entrance of the zone
  return pts.sort((p, q) => (p.x - q.x) * dir.x + (p.z - q.z) * dir.z);
}
function airstrike(target, yaw, owner) {
  const dir = new V3(-Math.sin(yaw), 0, -Math.cos(yaw)), side = new V3(-dir.z, 0, dir.x);
  const T0 = MATCH.time, speed = 115, lead = 2.4, alt = 44, life = owner.spawnAt; // life: the strike only counts in the streak in the life where it was called
  for (let j = 0; j < 2; j++) {
    const start = target.clone().addScaledVector(dir, -speed * lead).addScaledVector(side, j ? 7 : -7); start.y = alt + j * 4;
    const mesh = makeJet(); mesh.position.copy(start); mesh.quaternion.setFromUnitVectors(new V3(0, 0, -1), dir);
    KS.jets.push({ mesh, pos: start, dir: dir.clone(), speed, t: 0, life: 5.5, bank: j ? 0.15 : -0.15, puff: 0 });
  }
  // planes passing (recorded, it follows the lead plane; otherwise synthesized) and radio announcement
  if (!sfxJetPass(KS.jets[KS.jets.length - 2])) MATCH.events.push({ t: T0 + 0.9, fn: () => sfxJet() });
  sfxAnnounce(ksFriendly(owner) ? 'air_on' : 'air_enemy');
  airPattern(target, yaw).forEach((p, i) => {
    p.y = airImpact(p.x, p.z);
    if (VOID.on && p.y <= VOID.floor + 1) p.y = target.y; // above the void: the bomb bursts in the air, at the aimed level
    const tr = T0 + 1.35 + i * 0.11, fall = 1.05;
    MATCH.events.push({ t: tr, fn: () => {
      const rel = target.clone().addScaledVector(dir, speed * ((tr - T0) - lead)).addScaledVector(side, i % 2 ? 7 : -7); rel.y = alt - 1;
      const G = aircraftGeometry(), m = new THREE.Mesh(G.bomb, G.dark); m.castShadow = true; scene.add(m);
      KS.bombs.push({ mesh: m, a: rel, b: p.clone(), t: 0, dur: fall });
      if (i % 2 === 0) sfxBomb(p, fall);
    } });
    MATCH.events.push({ t: tr + fall, fn: () => explode(p, owner, _t('Airstrike'), AIR.blast, AIR.dmg, life, AIR.roof) });
  });
}
function spawnDrone(team) {
  if (KS.drones.some((d) => d.team === team)) return;
  const G = aircraftGeometry(), g = new THREE.Group();
  for (const geo of [G.dfus, G.dwing, G.dv1, G.dv2]) { const m = new THREE.Mesh(geo, G.hull); m.castShadow = true; g.add(m); }
  const lamp = new THREE.Mesh(G.lamp, G.lampMat[team === PL.ent.team ? 0 : 1]);
  lamp.position.set(0, -0.3, 0); g.add(lamp);
  scene.add(g);
  KS.drones.push({ mesh: g, team, a: team ? Math.PI : 0, lamp, snd: sfxDrone(new V3(0, 72, 0)) });
}
function updateAircraft(dt) {
  updateHelis(dt); updateDrones(dt); updateMechas(dt);
  for (let i = KS.jets.length - 1; i >= 0; i--) {
    const j = KS.jets[i]; j.t += dt;
    j.pos.addScaledVector(j.dir, j.speed * dt); j.pos.y += Math.sin(j.t * 0.7) * 0.05;
    j.mesh.position.copy(j.pos); sfxEmitterMove(j.snd, j.pos);
    j.mesh.quaternion.setFromUnitVectors(new V3(0, 0, -1), j.dir); j.mesh.rotateZ(j.bank + Math.sin(j.t * 1.3) * 0.05);
    j.mesh.userData.flame.scale.set(1, 1, 0.8 + Math.random() * 0.5);
    j.puff += dt;
    if (j.puff > 0.03) {
      j.puff = 0;
      const back = j.pos.clone().addScaledVector(j.dir, 7.5);
      FX.smoke.spawn(back.x, back.y, back.z, rand(-0.5, 0.5), rand(-0.2, 0.3), rand(-0.5, 0.5), 2.2, 0.8, 3.2, 0.75, 0.72, 0.7, 0.22, 0, 0, 0.4);
      FX.add.spawn(back.x, back.y, back.z, 0, 0, 0, 0.06, 1.6, 0.6, 5, 2.6, 1, 0.8, 0);
    }
    if (j.t > j.life) { scene.remove(j.mesh); KS.jets.splice(i, 1); }
  }
  for (let i = KS.bombs.length - 1; i >= 0; i--) {
    const b = KS.bombs[i]; b.t += dt; const u = clamp(b.t / b.dur, 0, 1);
    const x = lerp(b.a.x, b.b.x, u), z = lerp(b.a.z, b.b.z, u), y = lerp(b.a.y, b.b.y, u * u);
    const prev = b.mesh.position.clone(); b.mesh.position.set(x, y, z);
    const v = b.mesh.position.clone().sub(prev); if (v.lengthSq() > 1e-6) b.mesh.quaternion.setFromUnitVectors(new V3(0, 0, -1), v.normalize());
    if (u >= 1) { scene.remove(b.mesh); KS.bombs.splice(i, 1); }
  }
  for (let i = KS.drones.length - 1; i >= 0; i--) {
    const d = KS.drones[i];
    if (MATCH.uav[d.team] <= 0) { scene.remove(d.mesh); sfxEmitterStop(d.snd, 1.5); KS.drones.splice(i, 1); continue; }
    d.a += dt * 0.16;
    const x = Math.cos(d.a) * 55, z = Math.sin(d.a) * 78, y = 72 + d.team * 6;
    const nx = Math.cos(d.a + 0.01) * 55, nz = Math.sin(d.a + 0.01) * 78;
    d.mesh.position.set(x, y, z);
    d.mesh.quaternion.setFromUnitVectors(new V3(0, 0, -1), new V3(nx - x, 0, nz - z).normalize()); d.mesh.rotateZ(-0.25);
    d.lamp.visible = Math.floor(MATCH.time * 2) % 2 === 0;
    sfxEmitterMove(d.snd, d.mesh.position);
  }
}
function clearAircraft() {
  for (const a of [...KS.jets, ...KS.bombs, ...KS.drones]) { scene.remove(a.mesh); sfxEmitterStop(a.snd, 0.05); }
  KS.jets.length = 0; KS.bombs.length = 0; KS.drones.length = 0; clearHelis(); fpvClear(); mechaClear(); ksAbort();
}
