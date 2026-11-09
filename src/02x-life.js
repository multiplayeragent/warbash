/* ==========================================================================
   THE LIFE OF THE GARDEN of Floralia: butterflies above the beds, falling cherry blossom petals, pollen in the greenhouse light,
   koi carp in the basins.
   Each swarm is a single point cloud whose shader computes everything (trajectories, wing beats, fall) from
   the wind clock (LIVE_U.uLvT, advanced by floraUpdate): nothing to update per frame on the JavaScript side, one draw call per swarm
   (the carp, for their part, are small meshes that koiUpdate moves).
   ========================================================================== */
const LIFE = { mats: [], uScale: { value: 600 } };
/* Swarm: one point per anchor position (x, y, z), four draws per point (aRnd) and its color (aCol, sRGB) */
function lifeSwarm(anchors, colors, vert, frag, o = {}) {
  const n = anchors.length, R = rngOf(o.seed || 1), p = new Float32Array(n * 3), rn = new Float32Array(n * 4), col = new Float32Array(n * 3);
  anchors.forEach((a, i) => { p.set(a, i * 3); for (let k = 0; k < 4; k++) rn[i * 4 + k] = R(); col.set(colors[i % colors.length], i * 3); });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aRnd', new THREE.BufferAttribute(rn, 4)); g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  const m = new THREE.ShaderMaterial({ uniforms: { uT: LIVE_U.uLvT, uScale: LIFE.uScale }, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 6; pts.userData.noPrepass = true; pts.userData.noAO = true;
  mapAdd(pts); LIFE.mats.push(m); return pts;
}
const LIFE_HEAD = 'uniform float uT, uScale; attribute vec4 aRnd; attribute vec3 aCol; varying vec3 vCol;';
/* Butterflies: flight in slow loops around their bed, wing beat in the shader (the wings draw in toward the body) */
const LIFE_BF_VERT = `
${LIFE_HEAD} varying float vFlap;
void main() {
  float t = uT + aRnd.x * 97.0, r = 1.4 + aRnd.y * 2.8; vec3 p = position;
  p.x += sin(t * (0.2 + aRnd.z * 0.16)) * r + sin(t * 0.73 + aRnd.w * 6.0) * 0.5;
  p.z += cos(t * (0.17 + aRnd.w * 0.18)) * r + cos(t * 0.81 + aRnd.z * 6.0) * 0.5;
  p.y += 0.8 + aRnd.y * 1.0 + sin(t * 1.1 + aRnd.z * 6.0) * 0.4 + sin(t * 2.3 + aRnd.w * 6.0) * 0.12;
  vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(0.22 * uScale / max(-mv.z, 0.4), 2.5, 56.0);
  vCol = aCol; vFlap = 0.5 + 0.5 * sin(t * (14.0 + aRnd.z * 6.0));
}`;
const VIE_BF_FRAG = `
varying vec3 vCol; varying float vFlap;
void main() {
  vec2 p = (gl_PointCoord - 0.5) * 2.0; float fl = mix(0.3, 1.0, vFlap); vec2 q = vec2(abs(p.x) / fl, p.y);
  float up = length((q - vec2(0.5, -0.2)) / vec2(0.5, 0.42)), lo = length((q - vec2(0.36, 0.42)) / vec2(0.34, 0.3));
  float wing = max(1.0 - smoothstep(0.82, 1.0, up), 1.0 - smoothstep(0.82, 1.0, lo));
  float body = (1.0 - smoothstep(0.05, 0.09, abs(p.x))) * (1.0 - smoothstep(0.5, 0.58, abs(p.y + 0.05)));
  float a = max(wing, body); if (a < 0.04) discard;
  vec3 c = mix(vCol, vCol * 0.35, smoothstep(0.55, 1.0, min(up, lo))); c = mix(c, vec3(0.06, 0.05, 0.04), body); c *= c;
  gl_FragColor = vec4(c * 1.15, a);
}`;
/* Petals: fall of 7 m in about ten seconds, drift, rotation and flipping */
const LIFE_PE_VERT = `
${LIFE_HEAD} varying float vRot, vFlip, vA;
void main() {
  float f = fract(uT * (0.07 + aRnd.y * 0.05) + aRnd.x); vec3 p = position;
  p.y = 7.2 * (1.0 - f) + 0.02;
  p.x += sin(uT * 0.6 + aRnd.z * 6.0 + f * 5.0) * 0.9 + f * 2.2 + (aRnd.z - 0.5) * 6.0;
  p.z += cos(uT * 0.5 + aRnd.w * 6.0 + f * 4.0) * 0.9 + f * 0.8 + (aRnd.w - 0.5) * 6.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(0.1 * uScale / max(-mv.z, 0.4), 2.0, 30.0);
  vCol = aCol; vRot = uT * (1.2 + aRnd.y * 1.6) + aRnd.x * 6.28; vFlip = 0.3 + 0.7 * abs(sin(uT * (1.5 + aRnd.z) + aRnd.w * 6.0));
  vA = smoothstep(0.0, 0.05, f) * (1.0 - smoothstep(0.94, 1.0, f));
}`;
const VIE_PE_FRAG = `
varying vec3 vCol; varying float vRot, vFlip, vA;
void main() {
  vec2 q = gl_PointCoord - 0.5; float c = cos(vRot), s = sin(vRot); q = vec2(c * q.x - s * q.y, s * q.x + c * q.y) * 2.0; q.y /= vFlip;
  float a = (1.0 - smoothstep(0.7, 1.0, length(q * vec2(1.0, 0.62)))) * vA; if (a < 0.04) discard;
  vec3 col = vCol * vCol * (0.9 + 0.2 * q.x); gl_FragColor = vec4(col, a);
}`;
/* Pollen: grains that drift and sparkle, visible only up close */
const LIFE_PO_VERT = `
${LIFE_HEAD} varying float vA;
void main() {
  float t = uT + aRnd.x * 50.0; vec3 p = position;
  p.x += sin(t * 0.13 + aRnd.y * 6.0) * 2.0; p.y += sin(t * 0.21 + aRnd.z * 6.0) * 1.2; p.z += cos(t * 0.11 + aRnd.w * 6.0) * 2.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; float d = -mv.z;
  gl_PointSize = clamp(0.035 * uScale / max(d, 0.4), 1.6, 5.0);
  vA = (1.0 - smoothstep(12.0, 20.0, d)) * smoothstep(1.5, 3.0, d) * (0.45 + 0.55 * sin(t * 1.3 + aRnd.w * 20.0));
  vCol = aCol;
}`;
const VIE_PO_FRAG = `
varying vec3 vCol; varying float vA;
void main() { float r = length(gl_PointCoord - 0.5) * 2.0; float a = (1.0 - smoothstep(0.1, 1.0, r)) * vA * 0.55; if (a < 0.004) discard; gl_FragColor = vec4(vCol * a, a); }`;
/* The swarms of Floralia: butterflies around the beds, meadows and banks, petals under the cherry trees, pollen in the nave */
function floraliaLife() {
  const R = rngOf(6161), M2 = (x, z, r, n) => [x, z, r, n];
  // [x, z, scatter radius, count] on the Alpha side (z > 0); the Bravo side is the mirror, the rest is unique
  const spots = [M2(-9, 33, 4, 3), M2(9, 33, 4, 3), M2(-9, 28.5, 3, 2), M2(9, 28.5, 3, 2), M2(-26.6, 31, 4, 3), M2(-22, 21, 4, 2), M2(30, 21, 4, 2), M2(27, 30, 3, 2), M2(0, 18, 3, 2), M2(-14, 6, 4, 2), M2(-6, 9, 3, 1), M2(-12, 40, 5, 2)];
  const once = [M2(-24, 8, 3, 2), M2(-24, -8, 3, 2), M2(23, 5, 3, 2), M2(23, -5, 3, 2), M2(33, 6, 3, 1), M2(33, -6, 3, 1)];
  const A = [];
  for (const [x, z, r, n] of spots) for (const sg of [1, -1]) for (let i = 0; i < n; i++) A.push([x + R.range(-r, r), 0, sg * z + R.range(-r, r)]);
  for (const [x, z, r, n] of once) for (let i = 0; i < n; i++) A.push([x + R.range(-r, r), 0, z + R.range(-r, r)]);
  lifeSwarm(A, [[1, 0.55, 0.1], [1, 0.85, 0.2], [0.95, 0.95, 1], [0.55, 0.72, 1], [1, 0.45, 0.62], [0.9, 0.38, 0.18], [0.78, 0.5, 1]], LIFE_BF_VERT, VIE_BF_FRAG, { seed: 11 });
  const P = [];
  for (const [x, z] of [[-20.8, -10.4], [-27.2, -12.6], [-33.4, -11.2], [-36, 7.5], [-23.8, 11], [-31, 12], [-20.8, 7.2], [-35.5, -10.5], [-33.8, 11.8], [-33, 19.5], [-27.5, 22], [35, 19.5], [-33, -19.5], [-27.5, -22], [35, -19.5]]) for (let i = 0; i < 9; i++) P.push([x + R.range(-1.5, 1.5), 0, z + R.range(-1.5, 1.5)]);
  lifeSwarm(P, [[1, 0.78, 0.85], [1, 0.88, 0.92], [0.98, 0.7, 0.8], [1, 0.93, 0.95]], LIFE_PE_VERT, VIE_PE_FRAG, { seed: 12 });
  const D = []; for (let i = 0; i < 180; i++) D.push([R.range(-18, 8), R.range(0.6, 9), R.range(-12, 12)]);
  lifeSwarm(D, [[1.2, 1.0, 0.7]], LIFE_PO_VERT, VIE_PO_FRAG, { seed: 13, add: true });
  // carp: the large Japanese basin (outside the island and bridges) and the greenhouse pond
  const I = JAPAN_ISLE;
  koiAdd(JAPAN_POND, -0.3, 10, (x, z) => hyp(x - I.x, z - I.z) > I.r + 1.4 && !JAPAN_WALK.some((r) => x > r[0] - 1.3 && x < r[1] + 1.3 && z > r[2] - 1.3 && z < r[3] + 1.3), 3);
  koiAdd(GREENHOUSE_POND, -0.3, 4, (x, z) => x < 9.0, 5);
  onResizeFx();
}

/* ---------- Koi carp ---------- */
/* Fish swimming under the surface of a basin: one small mesh each (spindle with elliptical cross-section, fan tail, white, orange or black coat
   spotted per vertex), which follows waypoints drawn in the open water; the body undulates in a yaw. Updated by koiUpdate (map hook). */
const KOI = { list: [], geos: [], mat: null };
function koiGeometry(seed) {
  const R = rngOf(seed * 53 + 7), N = 14, S = 8, pos = [], col = [], idx = [], ph = [R() * 6, R() * 6, R() * 6], kind = seed % 3; // 0 orange and white, 1 spotted white, 2 gold
  const lin = (r, g, b) => [sl(r), sl(g), sl(b)];
  for (let i = 0; i <= N; i++) {
    const u = i / N, x = (0.5 - u) * 0.8, rw = Math.sin(Math.pow(u, 0.75) * Math.PI) * 0.1 + 0.006;
    for (let k = 0; k < S; k++) {
      const a = (k / S) * TAU, sp = Math.sin(u * 8 + ph[0]) * Math.sin(a * 2 + ph[1]) + Math.sin(u * 15 + ph[2]) * 0.4;
      pos.push(x, Math.cos(a) * rw * 0.75, Math.sin(a) * rw);
      let c;
      if (kind === 2) c = lin(0.95, 0.68 - 0.1 * (u > 0.8 ? 1 : 0), 0.2);
      else if (sp > (kind === 0 ? 0.25 : 0.8) && Math.cos(a) > -0.2) c = lin(0.95, 0.38, 0.1);
      else if (u < 0.16 && kind === 1) c = lin(0.9, 0.3, 0.1);
      else c = lin(0.95, 0.93, 0.88);
      if (Math.cos(a) < -0.3) c = lin(0.9, 0.86, 0.8); // belly
      col.push(...c);
    }
  }
  for (let i = 0; i < N; i++) for (let k = 0; k < S; k++) { const a = i * S + k, b = i * S + (k + 1) % S; idx.push(a, b, a + S, b, b + S, a + S); }
  // tail: flat fan of two triangles, slightly darker at the tip
  const tx = -0.4, base = pos.length / 3; pos.push(tx, 0, 0, tx - 0.26, 0, 0.17, tx - 0.26, 0, -0.17, tx - 0.18, 0, 0); col.push(...lin(0.95, 0.5, 0.15), ...lin(0.95, 0.62, 0.3), ...lin(0.95, 0.62, 0.3), ...lin(0.95, 0.55, 0.2));
  idx.push(base, base + 1, base + 3, base, base + 3, base + 2, base, base + 3, base + 1, base, base + 2, base + 3);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeBoundingSphere();
  return g;
}
/* n carp in the poly basin, at depth y; free(x, z): the water where they can swim (outside the island and bridges) */
function koiAdd(poly, y, n, isFree, seed) {
  if (!KOI.mat) KOI.mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const R = rngOf(seed), ok = (x, z) => polyDist(poly, x, z) > 1.0 && isFree(x, z);
  const spot = () => { for (let t = 0; t < 200; t++) { const p = poly[Math.floor(R() * poly.length)], q = poly[Math.floor(R() * poly.length)], u = R(), x = (p[0] + q[0]) / 2 + (R() - 0.5) * 4 * u, z = (p[1] + q[1]) / 2 + (R() - 0.5) * 4 * u; if (ok(x, z)) return [x, z]; } return poly[0].slice(); };
  for (let i = 0; i < n; i++) {
    const g = KOI.geos[(seed + i) % 6] || (KOI.geos[(seed + i) % 6] = koiGeometry((seed + i) % 6)), m = new THREE.Mesh(g, KOI.mat), s = R.range(0.65, 1.05);
    m.scale.setScalar(s); m.frustumCulled = true; m.userData.noPrepass = true; m.userData.noAO = true; m.renderOrder = 1;
    const [x, z] = spot(), w = spot(); m.position.set(x, y, z); mapAdd(m);
    KOI.list.push({ m, y, h: R() * TAU, w, v: R.range(0.45, 0.9), ph: R() * 6, ok, spot, poly });
  }
}
/* Swimming: heading toward the waypoint (bounded turn), new point on arrival or near the bank */
function koiUpdate(t, dt) {
  const cam = camera.position;
  for (const k of KOI.list) {
    const m = k.m; if (Math.abs(m.position.x - cam.x) > 55 || Math.abs(m.position.z - cam.z) > 55) continue;
    const dx = k.w[0] - m.position.x, dz = k.w[1] - m.position.z;
    if (dx * dx + dz * dz < 0.8 || !k.ok(m.position.x + Math.cos(k.h) * 0.9, m.position.z - Math.sin(k.h) * 0.9)) k.w = k.spot();
    let d = Math.atan2(-dz, dx) - k.h; d = Math.atan2(Math.sin(d), Math.cos(d));
    k.h += clamp(d, -1.5 * dt, 1.5 * dt);
    const v = k.v * (0.75 + 0.25 * Math.sin(t * 0.7 + k.ph));
    m.position.x += Math.cos(k.h) * v * dt; m.position.z -= Math.sin(k.h) * v * dt;
    m.rotation.y = k.h + Math.sin(t * 7 * (v + 0.4) + k.ph) * 0.2;
  }
}
