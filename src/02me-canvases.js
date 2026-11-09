/* ==========================================================================
   SCENERY CLOTHS: cloths simulated on the processor (the cloth roof of Chergui's souk, laundry, rugs, flags; then
   tents, tarps and awnings). Owner feedback, October 2026: "several taut cloths, one above the other, with
   real taut-cloth physics, like the capes, that react to the environment, to the blast of an explosion, without flying everywhere
   or passing through each other", then "every cloth in the game becomes a physics element; laundry and sheets have real physics, like the capes: if
   my character runs through the cloth, it deforms; cloths react to explosions".
   Each cloth is made of one or more sheets of particles driven by the cape engine (ClothSim, 06gb-cloth.js): structural,
   shear and bending constraints, gravity, the map's wind (gusts, eddies, and a vertical breath that makes a flat cloth
   breathe) that pushes the fabric along its normal. Its target is its rest shape:
   - pinned: attached to a pole, a beam, a rope (clothespin), a flagpole;
   - the other particles never stray from their rest place by more than their slack (maxD): a cloth doesn't run away, and two
     cloths stacked more than twice their slack apart never touch. A taut cloth has a slack of a few centimeters and
     a strong pull toward its shape (home); hanging laundry has a slack the size of the piece and almost no pull: it swings,
     lifts in the wind, moves aside when a soldier passes and falls back;
   - soldiers (o.body): each is a capsule (feet to head, 28 cm radius) that pushes the fabric away; the cloth keeps the velocity
     the passage gives it (Verlet): it opens in front of the soldier, slides over his shoulders and closes behind him;
   - blast: an explosion pushes nearby particles (canvasesBlast, called by explode): the cloth billows and falls back in a few
     seconds; a bullet crossing laundry pushes it in its direction (canvasesShot, called by fireRay), without stopping there.
   None of this changes the game (no collision follows the fabric): each machine simulates its cloths for itself alone.
   Declaration: a build places its sheets via Maker.fabric (in local coordinates, in a prefab as in the scenery); at the end of
   construction (clothsBuild), the sheets of the same group (f.grp: a clothesline; otherwise the 16 m square) and with the same settings
   become a single cloth, hence a single draw call.
   Rendering: one mesh per cloth, two sheets, top and underside (flipped, 7 mm further), in a scenery material without back face
   (o.mat). The underside can be lightened (glow): sunlight passing through the fabric. No depth pre-pass (the cloth moves);
   cast shadow (the near cascade is redone every frame). The map places the game collisions needed (noRay boxes that stop
   grenades under a cloth roof, occlusion volumes of the rest shape for the baked lighting, which don't move).
   Cost: fixed step of 1/60 s (1/30 on phones, with fewer passes), at most two per frame; out of view or more than 60 m from the
   camera (45 m for laundry; 35 m for a taut cloth on phones), a cloth keeps its last pose (except during the 3 s following
   a blast or a passage). Beyond 20 m, a cloth is simulated only every other frame, beyond 40 m one in four (it then moves
   in slow motion, which can't be seen from so far). Measured on Chergui and Sirocco (11,400 and 10,500 particles in all): 1.3 to 1.9 ms
   per frame for all the visible cloths at once, on the bench processor, before these levels of detail.
   ========================================================================== */
const CANVASES = [];
const FABRICS = []; // sheets declared during construction (Maker.fabric), gathered by clothsBuild
const CANVAS_H = COARSE || ULTRA ? 1 / 30 : 1 / 60;
const _tlw = new V3(), _tfr = new THREE.Frustum(), _tpm = new THREE.Matrix4();
let CANVAS_F = 0; // counted frames, to simulate distant cloths every other or every fourth frame
/* Settings for each kind of fabric: wind grip, share of the map's wind, gravity (m/s²), pull toward the rest shape (per step
   of 1/60 s), soldiers that deform it, bullets that push it, distance beyond which it no longer moves */
const CLOTH_KINDS = {
  taut: { drag: 0.6, wind: 1, g: 2.5, home: 0.006, body: false, shot: false, far: COARSE || ULTRA ? 35 : 60 },
  hung: { drag: 0.85, wind: 0.75, g: 9.8, home: 0.0012, body: true, shot: true, far: 45 },
  weighted: { drag: 0.45, wind: 0.5, g: 9.8, home: 0.002, body: true, shot: true, far: 45 }, // rug, blanket
  flagCloth: { drag: 0.9, wind: 1.2, g: 4, home: 0.004, body: false, shot: true, far: 70, flap: 1.6 }, // flap: snapping (ClothSim.step)
};
/* A sheet as functions (o.cu x o.rv particles; u across, v along, from 0 to 1): o.rest(u, v) -> [x, y, z]; o.pin(u, v);
   o.maxD(u, v); o.uv(u, v) -> [s, t]; o.color [r, g, b] (sRGB); o.glow(u, v) -> 0 to 1, light passing through (underside) */
function canvasSheet(o) {
  const cu = o.cu, rv = o.rv, P = [], pin = [], maxD = [], uv = [], glow = [];
  for (let j = 0; j < rv; j++) for (let i = 0; i < cu; i++) {
    const u = i / (cu - 1), v = j / (rv - 1);
    P.push(o.rest(u, v)); pin.push(o.pin(u, v) ? 1 : 0); maxD.push(o.maxD(u, v)); uv.push(o.uv(u, v)); glow.push(o.glow ? o.glow(u, v) : 0);
  }
  const c = o.color || [1, 1, 1];
  return { cu, rv, P, pin, maxD, uv, glow, side: [0, 1, 0], lin: [sl(c[0]), sl(c[1]), sl(c[2])] };
}
/* Adds a cloth. Its sheets: o.sheets (like Maker.fabric: cu, rv, P, pin, maxD, uv, glow (number or list), side, lin), otherwise a
   sheet described by functions (canvasSheet). o.mat: material (MAT); o.clothKind: settings (CLOTH_KINDS, 'taut' by default), which
   o.drag, o.wind, o.g, o.home, o.body, o.shot override. Returns the cloth. */
function canvasAdd(o) {
  const sheets = o.sheets || [canvasSheet(o)], G0 = CLOTH_KINDS[o.clothKind || 'taut'], opt = (k) => (o[k] !== undefined ? o[k] : G0[k]);
  let n = 0; for (const s of sheets) n += s.cu * s.rv;
  const rest = new Float32Array(n * 3), pin = new Float32Array(n), maxD = new Float32Array(n), C = [], L = [], K = [], out = [];
  const N2 = n * 2, pos = new Float32Array(N2 * 3), nor = new Float32Array(N2 * 3), uvs = new Float32Array(N2 * 2), col = new Float32Array(N2 * 3), aoc = new Float32Array(N2).fill(1), idx = [];
  let o0 = 0;
  for (const s of sheets) {
    const cu = s.cu, rv = s.rv, m = cu * rv;
    for (let k = 0; k < m; k++) {
      const q = o0 + k, p = s.P[k], g = 1 + (Array.isArray(s.glow) ? s.glow[k] : s.glow || 0), c = s.lin || [1, 1, 1];
      rest[q * 3] = p[0]; rest[q * 3 + 1] = p[1]; rest[q * 3 + 2] = p[2];
      pin[q] = s.pin[k] ? 1 : 0; maxD[q] = pin[q] ? 0 : s.maxD[k];
      for (const [r, f] of [[q, 1], [q + n, g]]) { uvs[r * 2] = s.uv[k][0]; uvs[r * 2 + 1] = s.uv[k][1]; col[r * 3] = c[0] * f; col[r * 3 + 1] = c[1] * f; col[r * 3 + 2] = c[2] * f; }
    }
    const G = clothGridCons(rest, cu, rv, o0);
    for (let c = 0; c < G.stf.length; c++) { C.push(G.con[c * 2], G.con[c * 2 + 1]); L.push(G.len[c]); K.push(G.stf[c]); }
    const sd = s.side || [0, 1, 0], sgn = clothSign(rest, o0, cu, rv, (v) => v.set(sd[0], sd[1], sd[2]));
    out.push({ o: o0, cu, rv, sgn });
    // front face of the top on the side of the sheet's normal; the underside the opposite
    for (let j = 0; j + 1 < rv; j++) for (let i = 0; i + 1 < cu; i++) {
      const a = o0 + j * cu + i, b = a + 1, d = a + cu, e = d + 1;
      if (sgn > 0) idx.push(a, b, d, b, e, d, a + n, d + n, b + n, b + n, d + n, e + n); else idx.push(a, d, b, b, d, e, a + n, b + n, d + n, b + n, e + n, d + n);
    }
    o0 += m;
  }
  // gravity and pull toward the rest shape (per step of 1/60 s, step squared otherwise: same frequency, same sag): the tension
  // of a taut cloth carries a share of its weight and brings it back to its shape
  const T = { n, rest, pin, maxD, con: new Uint16Array(C), len: new Float32Array(L), stf: new Float32Array(K), drag: opt('drag'), g: opt('g'),
    home: opt('home') * (CANVAS_H * 60) ** 2, flap: opt('flap') || 0, sheets: out };
  const sim = new ClothSim(T); sim.tgt.set(rest); sim.reset(); sim.normals();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('aoc', new THREE.BufferAttribute(aoc, 1));
  geo.setIndex(new THREE.BufferAttribute(N2 > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), 1));
  // fixed bounding sphere: the rest shape and its slack (positions change every frame)
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9, md = 0;
  for (let k = 0; k < n; k++) { const x = rest[k * 3], y = rest[k * 3 + 1], z = rest[k * 3 + 2]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); z0 = Math.min(z0, z); z1 = Math.max(z1, z); md = Math.max(md, maxD[k]); }
  const ctr = new V3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  geo.boundingSphere = new THREE.Sphere(ctr, Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2 + (z1 - z0) ** 2) / 2 + md + 0.1);
  sim.ground = y0 - md - 0.05; // (no particle goes lower than its slack)
  const mat = canvasMat(o.mat || 'canvasCloth'), mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'map:cloth'; mesh.castShadow = true; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; mesh.userData.noPrepass = true;
  mapAdd(mesh);
  const S = { T, sim, mesh, pos, nor, sph: geo.boundingSphere, acc: 0, kick: 0, wind: opt('wind'), body: opt('body'), shot: opt('shot'), far2: opt('far') ** 2 };
  canvasWrite(S); CANVASES.push(S);
  return S;
}
/* Material of a cloth: the scenery's, without its back face (the cloth has its two sheets, 7 mm apart: both seen from both
   sides, they fought over depth, a moiré); one copy per material, kept for the map */
const CANVAS_MATS = new Map();
function canvasMat(k) {
  const m = MAT[k]; if (m.side !== THREE.DoubleSide) return m;
  let c = CANVAS_MATS.get(m); if (c) return c;
  c = m.clone(); c.side = THREE.FrontSide; c.onBeforeCompile = m.onBeforeCompile; c.userData = m.userData; c.customProgramCacheKey = m.customProgramCacheKey;
  c.uuid = 'decor-' + k + '-cloth'; // fixed identifier (see shadeMaterials, called later)
  CANVAS_MATS.set(m, c); return c;
}
/* Positions and normals of the two sheets, from the simulation */
function canvasWrite(S) {
  const n = S.T.n, p = S.sim.p, N = S.sim.nor, P = S.pos, Q = S.nor;
  for (let k = 0; k < n * 3; k++) { P[k] = p[k]; Q[k] = N[k]; P[k + n * 3] = p[k] - N[k] * 0.007; Q[k + n * 3] = -N[k]; }
  const g = S.mesh.geometry; g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
}
/* Soldiers touching the cloth: one capsule each (feet to head), within the engine's capsule limit; true if there are any */
function canvasBodies(S) {
  const sim = S.sim, c = S.sph.center, R = S.sph.radius + 0.5;
  sim.nc = 0;
  for (const e of entities) {
    if (!e.alive || e.off || sim.nc >= sim.cap.length) continue;
    const dx = e.pos.x - c.x, dz = e.pos.z - c.z, top = e.pos.y + 1.62 * (1 - (e.crouchAmt || 0) * 0.33);
    if (dx * dx + dz * dz > R * R || top < c.y - R || e.pos.y > c.y + R) continue;
    const C = sim.cap[sim.nc++]; C.a.set(e.pos.x, e.pos.y + 0.3, e.pos.z); C.b.set(e.pos.x, top - 0.14, e.pos.z); C.r = 0.28; C.o = null;
  }
  return sim.nc > 0;
}
/* Every frame (mapUpdate): the map's wind, then the nearby cloths and those in view */
function canvasesUpdate(dt) {
  if (!CANVASES.length || !dt) return;
  const id = CURMAP.id, b = CLOTH_BREEZE[id] || CLOTH_BREEZE_DEF, t = CLOTH.t, l = Math.sqrt(b[0] * b[0] + b[1] * b[1]) || 1;
  const gust = 0.6 + 0.3 * Math.sin(t * 0.45) + 0.25 * Math.sin(t * 1.3 + 1.7) + 0.15 * Math.sin(t * 2.9 + 0.4), k = b[2] * gust;
  // wind passing over a flat cloth lifts it and lets it fall back (low pressure above, eddies): it breathes
  _tlw.set(b[0] / l * k, k * (0.35 * Math.sin(t * 0.9) + 0.2 * Math.sin(t * 2.3 + 0.6)), b[1] / l * k);
  camera.updateMatrixWorld(); _tfr.setFromProjectionMatrix(_tpm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const it = COARSE || ULTRA ? 2 : 3; CANVAS_F++;
  for (let i = 0; i < CANVASES.length; i++) {
    const S = CANVASES[i];
    S.kick = Math.max(0, S.kick - dt);
    if (S.body && canvasBodies(S)) S.kick = Math.max(S.kick, 1.5); // a soldier in contact: the cloth lives, even out of view (it closes behind him)
    const d2 = S.sph.center.distanceToSquared(camera.position);
    if (S.kick <= 0 && (d2 > S.far2 || !_tfr.intersectsSphere(S.sph))) { S.acc = 0; continue; }
    const rate = S.kick > 0 || d2 < 400 ? 1 : d2 < 1600 ? 2 : 4; // one frame in rate, offset from one cloth to the next
    if ((CANVAS_F + i) % rate) continue;
    const w = _tlw, f = S.wind;
    if (f !== 1) w.multiplyScalar(f);
    S.acc = Math.min(S.acc + dt, CANVAS_H * 2);
    while (S.acc >= CANVAS_H) { S.sim.step(CANVAS_H, w, it); S.sim.normals(); S.acc -= CANVAS_H; }
    if (f !== 1) w.multiplyScalar(1 / f);
    canvasWrite(S);
  }
}
/* Blast of an explosion at p (radius r of its damage): particles within 1.8 r are pushed away from the center, up to 9 m/s
   up close; each particle's slack bounds the billowing */
function canvasesBlast(p, r) {
  const R = r * 1.8;
  for (const S of CANVASES) {
    if (S.sph.center.distanceTo(p) > S.sph.radius + R) continue;
    const P = S.sim.p, Q = S.sim.q, pin = S.T.pin;
    for (let k = 0; k < S.T.n; k++) {
      if (pin[k] >= 1) continue;
      const dx = P[k * 3] - p.x, dy = P[k * 3 + 1] - p.y, dz = P[k * 3 + 2] - p.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d >= R) continue;
      const f = 9 * (1 - d / R) * (1 - d / R) / Math.max(d, 0.3) * CANVAS_H; // given velocity (m/s), in Verlet steps
      Q[k * 3] -= dx * f; Q[k * 3 + 1] -= dy * f; Q[k * 3 + 2] -= dz * f;
    }
    S.kick = 3;
  }
}
/* Bullet from o, direction d (unit), up to distance maxT: the particles of a piece of laundry within 25 cm of its path take
   up to 4 m/s in its direction; the bullet continues (the fabric doesn't stop it) */
function canvasesShot(o, d, maxT) {
  for (const S of CANVASES) {
    if (!S.shot) continue;
    const c = S.sph.center, cx = c.x - o.x, cy = c.y - o.y, cz = c.z - o.z, tc = cx * d.x + cy * d.y + cz * d.z;
    if (tc < -S.sph.radius || tc > maxT + S.sph.radius) continue;
    const ex = cx - d.x * tc, ey = cy - d.y * tc, ez = cz - d.z * tc;
    if (ex * ex + ey * ey + ez * ez > S.sph.radius * S.sph.radius) continue;
    const P = S.sim.p, Q = S.sim.q, pin = S.T.pin, k0 = 4 * CANVAS_H; let hit = false;
    for (let k = 0; k < S.T.n; k++) {
      if (pin[k] >= 1) continue;
      const px = P[k * 3] - o.x, py = P[k * 3 + 1] - o.y, pz = P[k * 3 + 2] - o.z, t = px * d.x + py * d.y + pz * d.z;
      if (t < 0 || t > maxT) continue;
      const qx = px - d.x * t, qy = py - d.y * t, qz = pz - d.z * t, e2 = qx * qx + qy * qy + qz * qz;
      if (e2 > 0.0625) continue;
      const f = k0 * (1 - Math.sqrt(e2) / 0.25);
      Q[k * 3] -= d.x * f; Q[k * 3 + 1] -= d.y * f; Q[k * 3 + 2] -= d.z * f; hit = true;
    }
    if (hit) S.kick = Math.max(S.kick, 2);
  }
}
/* End of construction: the declared sheets (FABRICS) become cloths, one per group (f.grp, otherwise the CLOTH_CELL m square) and
   per setting (material, kind). 12 m squares added 70 draw calls on Chergui (+12%, bench.js): 16 m, 24 m on phones */
const CLOTH_CELL = COARSE || ULTRA ? 24 : 16;
function clothsBuild() {
  const groups = new Map();
  for (const f of FABRICS) {
    const c = f.P[0], key = (f.mat || 'canvas') + '|' + (f.clothKind || 'hung') + '|' + (f.grp || Math.floor(c[0] / CLOTH_CELL) + ',' + Math.floor(c[2] / CLOTH_CELL));
    let g = groups.get(key); if (!g) groups.set(key, g = { mat: f.mat || 'canvas', clothKind: f.clothKind || 'hung', sheets: [] });
    g.sheets.push(f);
  }
  for (const g of groups.values()) canvasAdd({ sheets: g.sheets, mat: g.mat, clothKind: g.clothKind });
  FABRICS.length = 0;
}
/* Map unload (the meshes leave with its root) */
function canvasesClear() { CANVASES.length = 0; FABRICS.length = 0; for (const c of CANVAS_MATS.values()) c.dispose(); CANVAS_MATS.clear(); }
