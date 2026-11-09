/* ==========================================================================
   WAVES: the water reacts. A ripple field simulated on the graphics card, shared by all the waters of a map (the sea
   and the basins of the 02m-water.js shaders).
   - The field is a 32 m square window (256 x 256 points, 12.5 cm) that follows the camera in one-point steps: outside the
     window, the water is calm. Each point carries the water height h, its velocity v and the foam (channels R, G, B).
   - Each frame advances the wave equation (v += c2 · laplacian(h), damped, then h += v; an imprint displaces h): an imprint digs the water and
     rings go out, cross and die out at the edges; a walking soldier leaves a V-shaped wake.
   - Imprints (rippleAdd) come from soldiers' steps in a basin, bullets hitting the water, explosions and
     grenades, fountain jets and the foot of waterfalls. If nothing moves: no pass, no cost (the field goes to sleep
     RIP.sleep seconds after the last imprint).
   - The shaders read the field (ripple, in RIP_GLSL): slope for the normals (undulating reflections), foam on steep crests
     and at the heart of splashes, curvature for the caustics.
   - Waves bounce off the water's edges: a map mask (rippleMask, 4 points per meter: basins, fountains,
     streams, puddles, the sea without its quays or hulls) says where there is water; a dry cell stays at zero and its
     neighbors see it as a mirror (the water height is reflected at the coping, the bank, the quay).
   Everything belongs to the map: targets and material freed with the water (rippleUnload).
   ========================================================================== */
const RIP = {
  N: 256, size: 32, sleep: 6, rt: null, cur: 0, cx: 0, cz: 0, pend: [], idle: 99, U: null, quad: null, mat: null, awake: false, jets: [],
  c: 1.8, damp: 0.9945, hDamp: 0.9995, foamDamp: 0.965, step: 1 / 60, acc: 0, gain: 6.5,
  maxSteps: () => (RQ.q.lean ? 1 : 3),
};
/* GLSL functions shared by the water shaders: surface slope (in the units of a normal), height, foam and curvature (laplacian,
   in 1 / m: negative on a bump, which concentrates light on the bottom like a lens) at world (x, z) */
const RIP_GLSL = `
uniform sampler2D tRip; uniform vec4 uRipB; uniform float uRipG; // window x0, z0 (m), 1 / size (1 / m), 1 / N; normal gain
void ripple(vec2 xz, out vec2 slope, out float foam, out float height, out float lap) {
  vec2 uv = (xz - uRipB.xy) * uRipB.z;
  float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  slope = vec2(0.0); foam = 0.0; height = 0.0; lap = 0.0;
  if (edge < 0.0) return;
  float k = smoothstep(0.0, 0.07, edge);
  vec4 c = texture2D(tRip, uv);
  float hl = texture2D(tRip, uv - vec2(uRipB.w, 0.0)).r, hr = texture2D(tRip, uv + vec2(uRipB.w, 0.0)).r;
  float hd = texture2D(tRip, uv - vec2(0.0, uRipB.w)).r, hu = texture2D(tRip, uv + vec2(0.0, uRipB.w)).r;
  float texel = uRipB.w / uRipB.z;
  slope = vec2(hl - hr, hd - hu) / (2.0 * texel) * k;
  height = c.r * k; lap = (hl + hr + hd + hu - 4.0 * c.r) / (texel * texel) * k;
  // foam: heart of the splashes (channel B) and steep flanks and crests of the rings (a white line that draws them)
  foam = clamp(max(c.b, max(smoothstep(0.04, 0.16, length(slope)) * 0.6, smoothstep(0.012, 0.05, c.r) * 0.5)), 0.0, 1.0) * k;
}`;
/* Simulation pass: one step of the wave equation, the window slid by uShift (whole points: the read falls at the center of the points,
   so exact), and the frame's imprints (up to 24) */
const RIP_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const RIP_FRAG = `precision highp float;
varying vec2 vUv;
uniform sampler2D tPrev, tMask; uniform vec2 uShift, uOrigin; uniform vec4 uMaskB; uniform float uTexel, uSize, uC2, uDamp, uHDamp, uFoamDamp, uMaskOut; uniform int uNS; uniform vec4 uS[24], uQ[24];
vec4 at(vec2 uv) { return (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) ? vec4(0.0) : texture2D(tPrev, uv); }
// water at this world point? (map mask; beyond it, uMaskOut: the open sea, otherwise land)
float wet(vec2 wp) { vec2 m = (wp - uMaskB.xy) * uMaskB.zw; return (m.x < 0.0 || m.x > 1.0 || m.y < 0.0 || m.y > 1.0) ? uMaskOut : step(0.5, texture2D(tMask, m).r); }
void main() {
  vec2 uv = vUv + uShift; vec4 c = at(uv), wp = vec4(uOrigin + vUv * uSize, uTexel * uSize, 0.0);
  if (wet(wp.xy) < 0.5) { gl_FragColor = vec4(0.0); return; } // land: no wave
  // neighbors: a dry cell returns this one's height (the wave reflects off it like off a wall)
  float hl = at(uv - vec2(uTexel, 0.0)).r, hr = at(uv + vec2(uTexel, 0.0)).r, hd = at(uv - vec2(0.0, uTexel)).r, hu = at(uv + vec2(0.0, uTexel)).r;
  hl = mix(c.r, hl, wet(wp.xy - vec2(wp.z, 0.0))); hr = mix(c.r, hr, wet(wp.xy + vec2(wp.z, 0.0))); hd = mix(c.r, hd, wet(wp.xy - vec2(0.0, wp.z))); hu = mix(c.r, hu, wet(wp.xy + vec2(0.0, wp.z)));
  float v = (c.g + uC2 * (hl + hr + hd + hu - 4.0 * c.r)) * uDamp, h = (c.r + v) * uHDamp, foam = c.b * uFoamDamp;
  // edges: the wave dies out there (no reflection coming back toward the player)
  vec2 e = min(vUv, 1.0 - vUv) / (8.0 * uTexel); float ab = clamp(min(e.x, e.y), 0.0, 1.0); ab = ab * ab * (3.0 - 2.0 * ab);
  v *= mix(0.55, 1.0, ab); h *= mix(0.9, 1.0, ab);
  for (int i = 0; i < 24; i++) {
    if (i >= uNS) break;
    vec2 d = wp.xy - uS[i].xy; float r = uS[i].z, q = dot(d, d) / (r * r), w = exp(-q);
    h += uS[i].w * (2.0 * w - exp(-0.5 * q)); foam += uQ[i].x * w; // hollow surrounded by a rim: without volume, the water doesn't sink
  }
  gl_FragColor = vec4(h, v, clamp(foam, 0.0, 1.0), 0.0);
}`;
/* Creates the field (once per map that has water): to be called by pondAdd and waterBuild before the first render of the materials */
function rippleEnsure() {
  if (RIP.U) return RIP.U;
  const mk = () => new THREE.WebGLRenderTarget(RIP.N, RIP.N, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping, depthBuffer: false, stencilBuffer: false });
  RIP.rt = [mk(), mk()]; RIP.cur = 0;
  RIP.U = { tRip: { value: RIP.rt[0].texture }, uRipB: { value: new THREE.Vector4(-1e5, -1e5, 1 / RIP.size, 1 / RIP.N) }, uRipG: { value: RIP.gain } };
  if (!RIP.one) { RIP.one = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat); RIP.one.needsUpdate = true; } // default mask: water everywhere
  const sn = RIP.size / RIP.N, dx = RIP.c * RIP.step / sn;
  RIP.mat = new THREE.ShaderMaterial({
    uniforms: {
      tPrev: { value: null }, uShift: { value: new THREE.Vector2() }, uOrigin: { value: new THREE.Vector2() }, uTexel: { value: 1 / RIP.N }, uSize: { value: RIP.size },
      uC2: { value: dx * dx }, uDamp: { value: RIP.damp }, uHDamp: { value: RIP.hDamp }, uFoamDamp: { value: RIP.foamDamp }, uNS: { value: 0 },
      uS: { value: Array.from({ length: 24 }, () => new THREE.Vector4()) }, uQ: { value: Array.from({ length: 24 }, () => new THREE.Vector4()) },
      tMask: { value: RIP.one }, uMaskB: { value: new THREE.Vector4(0, 0, 1, 1) }, uMaskOut: { value: 1 },
    },
    vertexShader: RIP_VERT, fragmentShader: RIP_FRAG, depthTest: false, depthWrite: false, blending: THREE.NoBlending,
  });
  RIP.quad = new THREE.FullScreenQuad(RIP.mat);
  RIP.cx = camera.position.x; RIP.cz = camera.position.z; RIP.idle = 99; RIP.awake = false; RIP.acc = 0;
  return RIP.U;
}
function rippleUnload() {
  if (RIP.rt) for (const r of RIP.rt) r.dispose();
  if (RIP.mat) RIP.mat.dispose();
  if (RIP.mask) { RIP.mask.dispose(); RIP.mask = null; }
  Object.assign(RIP, { rt: null, U: null, quad: null, mat: null, pend: [], jets: [], awake: false });
}
/* Imprint on the water at (x, z): r (m, radius), amp (dip in m: negative digs the water, positive raises it), foam (foam, 0 to 1) */
function rippleAdd(x, z, r, amp, foam = 0, wake = true) {
  if (!RIP.U || RIP.pend.length >= 24) return;
  const h = RIP.size / 2 - 1;
  if (Math.abs(x - camera.position.x) > h || Math.abs(z - camera.position.z) > h) return; // outside the window: nothing to see
  RIP.pend.push([x, z, r, amp, foam]); if (wake) RIP.idle = 0;
}
/* Clears both targets (field to zero: the engine's clear color may be something else) */
function rippleClear() {
  const prevT = renderer.getRenderTarget(), cc = renderer.getClearColor(_ripC), ca = renderer.getClearAlpha();
  renderer.setClearColor(0x000000, 0);
  for (const r of RIP.rt) { renderer.setRenderTarget(r); renderer.clear(); }
  renderer.setClearColor(cc, ca); renderer.setRenderTarget(prevT);
  RIP.cur = 0; RIP.U.tRip.value = RIP.rt[0].texture;
}
const _ripC = new THREE.Color();
/* Water mask of the map (4 points per meter over its bounds, 2 m margin): the triangles of each small water (PONDS), then the sea
   (waterAt) minus its obstacles (quays, hulls, breakwater, piles: WATER.obs). Computed once at load (ripplePrime) */
function rippleMask() {
  const ppm = 4, x0 = MAP.x0 - 2, z0 = MAP.z0 - 2, w = Math.ceil((MAP.x1 - MAP.x0 + 4) * ppm), h = Math.ceil((MAP.z1 - MAP.z0 + 4) * ppm), M = new Uint8Array(w * h);
  // small waters: each triangle of their mesh, filled
  const a = new V3(), b = new V3(), c = new V3();
  for (const q of PONDS) {
    const g = q.mesh.geometry, P = g.attributes.position, I = g.index, mm = q.mesh.matrix;
    for (let t = 0; t < I.count; t += 3) {
      a.fromBufferAttribute(P, I.getX(t)).applyMatrix4(mm); b.fromBufferAttribute(P, I.getX(t + 1)).applyMatrix4(mm); c.fromBufferAttribute(P, I.getX(t + 2)).applyMatrix4(mm);
      const i0 = Math.max(0, Math.floor((Math.min(a.x, b.x, c.x) - x0) * ppm)), i1 = Math.min(w - 1, Math.ceil((Math.max(a.x, b.x, c.x) - x0) * ppm));
      const j0 = Math.max(0, Math.floor((Math.min(a.z, b.z, c.z) - z0) * ppm)), j1 = Math.min(h - 1, Math.ceil((Math.max(a.z, b.z, c.z) - z0) * ppm));
      const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z); if (Math.abs(d) < 1e-9) continue;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = x0 + (i + 0.5) / ppm, z = z0 + (j + 0.5) / ppm, l1 = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / d, l2 = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / d;
        if (l1 >= -0.02 && l2 >= -0.02 && 1 - l1 - l2 >= -0.02) M[j * w + i] = 255;
      }
    }
  }
  // the sea, without its obstacles
  if (WATER.on) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const x = x0 + (i + 0.5) / ppm, z = z0 + (j + 0.5) / ppm; if (waterAt(x, z)) M[j * w + i] = 255; }
    for (const o of WATER.obs) {
      const Q = o.poly; let qx0 = 1e9, qx1 = -1e9, qz0 = 1e9, qz1 = -1e9;
      for (const [x, z] of Q) { qx0 = Math.min(qx0, x); qx1 = Math.max(qx1, x); qz0 = Math.min(qz0, z); qz1 = Math.max(qz1, z); }
      for (let j = Math.max(0, Math.floor((qz0 - z0) * ppm)); j <= Math.min(h - 1, Math.ceil((qz1 - z0) * ppm)); j++) for (let i = Math.max(0, Math.floor((qx0 - x0) * ppm)); i <= Math.min(w - 1, Math.ceil((qx1 - x0) * ppm)); i++) {
        const x = x0 + (i + 0.5) / ppm, z = z0 + (j + 0.5) / ppm; let n = false;
        for (let p = 0, q = Q.length - 1; p < Q.length; q = p++) if ((Q[p][1] > z) !== (Q[q][1] > z) && x < ((Q[q][0] - Q[p][0]) * (z - Q[p][1])) / (Q[q][1] - Q[p][1]) + Q[p][0]) n = !n;
        if (n) M[j * w + i] = 0;
      }
    }
  }
  if (RIP.mask) RIP.mask.dispose();
  const tex = new THREE.DataTexture(M, w, h, THREE.RedFormat, THREE.UnsignedByteType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.generateMipmaps = false; tex.needsUpdate = true;
  RIP.mask = tex;
  const U = RIP.mat.uniforms; U.tMask.value = tex; U.uMaskB.value.set(x0, z0, 1 / (w / ppm), 1 / (h / ppm)); U.uMaskOut.value = WATER.on ? 1 : 0;
}
/* At map load (mapCompile, after shader compilation): an empty step compiles the pass program and allocates
   the two targets, instead of at the field's first wake-up, mid-match (a hitch: compilation, two textures) */
function ripplePrime() {
  if (!RIP.U) return;
  rippleMask();
  rippleClear();
  const M = RIP.mat.uniforms, prevT = renderer.getRenderTarget(), ac = renderer.autoClear;
  M.uNS.value = 0; M.uShift.value.set(0, 0); M.tPrev.value = RIP.rt[0].texture;
  renderer.autoClear = false; renderer.setRenderTarget(RIP.rt[1]); RIP.quad.render(renderer);
  renderer.autoClear = ac; renderer.setRenderTarget(prevT);
}
/* Advances the field by one frame (called by mapUpdate): imprints from soldiers and jets, window recentered on the camera, simulation step */
function rippleUpdate(dt) {
  if (!RIP.U) return;
  const sn = RIP.size / RIP.N, cx = Math.round(camera.position.x / sn) * sn, cz = Math.round(camera.position.z / sn) * sn, U = RIP.U.uRipB.value;
  rippleSources(dt);
  RIP.idle += dt;
  if (RIP.idle > RIP.sleep) { // calm field: the window follows the camera without computing, everything in it is at zero
    if (RIP.awake) { RIP.awake = false; rippleClear(); }
    RIP.cx = cx; RIP.cz = cz; U.set(cx - RIP.size / 2, cz - RIP.size / 2, 1 / RIP.size, 1 / RIP.N);
    return;
  }
  RIP.awake = true;
  RIP.acc = Math.min(RIP.acc + dt, RIP.maxSteps() * RIP.step); // at the low profile, one pass per frame: a slow frame doesn't ask for more
  const steps = Math.floor(RIP.acc / RIP.step); RIP.acc -= steps * RIP.step;
  if (!steps) return; // frame shorter than a step: the imprints wait, and so does the window
  const shiftX = Math.round((cx - RIP.cx) / sn), shiftZ = Math.round((cz - RIP.cz) / sn);
  const M = RIP.mat.uniforms, prevT = renderer.getRenderTarget(), ac = renderer.autoClear;
  M.uOrigin.value.set(cx - RIP.size / 2, cz - RIP.size / 2);
  renderer.autoClear = false;
  for (let s = 0; s < steps; s++) {
    // imprints and window shift on the first pass only
    const n = s === 0 ? Math.min(24, RIP.pend.length) : 0;
    for (let i = 0; i < n; i++) { const p = RIP.pend[i]; M.uS.value[i].set(p[0], p[1], Math.max(0.14, p[2]), p[3]); M.uQ.value[i].set(p[4], 0, 0, 0); }
    M.uNS.value = n; if (s === 0) RIP.pend.splice(0, n);
    M.uShift.value.set(s === 0 ? shiftX / RIP.N : 0, s === 0 ? shiftZ / RIP.N : 0);
    M.tPrev.value = RIP.rt[RIP.cur].texture;
    renderer.setRenderTarget(RIP.rt[1 - RIP.cur]); RIP.quad.render(renderer);
    RIP.cur = 1 - RIP.cur;
  }
  renderer.autoClear = ac; renderer.setRenderTarget(prevT);
  RIP.cx = cx; RIP.cz = cz; U.set(cx - RIP.size / 2, cz - RIP.size / 2, 1 / RIP.size, 1 / RIP.N);
  RIP.U.tRip.value = RIP.rt[RIP.cur].texture;
}

/* ---------- Sources: wading soldiers, fountain jets ---------- */
const _rpV = new V3();
function rippleSources(dt) {
  const cam = camera.position, h = RIP.size / 2 - 1;
  for (const e of entities) {
    if (!e.alive || e.off || !e.vel) continue;
    if (Math.abs(e.pos.x - cam.x) > h || Math.abs(e.pos.z - cam.z) > h) continue;
    const surf = waterSurfaceAt(e.pos.x, e.pos.z); if (surf === null || e.pos.y > surf + 0.12) continue;
    const sp = hyp(e.vel.x, e.vel.z); if (sp < 0.15) continue;
    // wake: one imprint per frame under the feet, wider and deeper the faster you run (the soldier's movement makes the V)
    // (in front of the feet: the soldier's bow pushes the water in front of the player's eyes, rather than the wake staying behind them)
    rippleAdd(e.pos.x + e.vel.x / sp * 0.8, e.pos.z + e.vel.z / sp * 0.8, 0.26 + Math.min(sp, 6.5) * 0.045, -0.0055 * (0.5 + Math.min(sp, 6.5) / 2.2) * Math.min(dt * 60, 2), Math.min(0.035, sp * 0.006) * Math.min(dt * 60, 2));
  }
  // jets: they only wake the field in front of the player (or very close); behind them, they only imprint if the field is already awake
  // (a step, a shot): a basin behind you no longer keeps the simulation running endlessly
  camera.getWorldDirection(_rpV);
  const awake = RIP.idle <= RIP.sleep;
  for (const j of RIP.jets) {
    j.t -= dt; if (j.t > 0) continue;
    j.t = j.every;
    const dx = j.x - cam.x, dz = j.z - cam.z, d2 = dx * dx + dz * dz, fw = dx * _rpV.x + dz * _rpV.z, seen = d2 < 16 || fw > 0.3 * Math.sqrt(d2);
    if (seen || awake) rippleAdd(j.x, j.z, j.r, j.amp, j.foam, seen);
  }
}
/* Continuous source: a fountain jet or the foot of a waterfall (one imprint every `every` s, at a fixed point) */
function rippleSource(x, z, r, amp, every, foam = 0) { if (RIP.U) RIP.jets.push({ x, z, r, amp, every, foam, t: Math.random() * every }); }

/* Splash of a step in the water: a few droplets, a sharper imprint; sp: soldier's speed, vel: its velocity (the splash goes out in front of the foot) */
function stepSplashFx(pos, sp, vel) {
  const surf = waterSurfaceAt(pos.x, pos.z); if (surf === null) return;
  const k = clamp(sp / 5, 0.4, 1.3), vl = vel ? hyp(vel.x, vel.z) : 0, ox = vl > 0.1 ? vel.x / vl * 0.6 : 0, oz = vl > 0.1 ? vel.z / vl * 0.6 : 0;
  rippleAdd(pos.x + ox, pos.z + oz, 0.26 + 0.1 * k, -0.17 * k, 0.2 * k);
  for (let i = 0; i < 4 + Math.floor(3 * k); i++) FX.smoke.spawn(pos.x + ox + rand(-0.15, 0.15), surf + 0.04, pos.z + oz + rand(-0.15, 0.15), rand(-0.6, 0.6) * k, rand(1.2, 2.6) * k, rand(-0.6, 0.6) * k, rand(0.3, 0.55), 0.035 * k, 0.025, 0.84, 0.89, 0.92, 0.9, 0.3, 9.8, 0.4);
}
