/* ==========================================================================
   GRASS: real blades of grass on the lawns (Cirrus, Floralia).
   Technique of the grass in Ghost of Tsushima (GDC 2021, "Procedural Grass in Ghost of Tsushima"), as SimonDev adapted it
   for three.js (Quick_Grass, MIT license), with what the three.js forum recommends to keep the frame rate up with many blades:
   tiles, culling outside the view, levels of detail, reduced geometry in the distance, all movement in the vertex shader.
   - Placement, at load time (once, in JavaScript): the play area is cut into 8 m tiles; in each one, blades are drawn
     on a jittered grid (GRASS.dens per m², 80) where the map wants grass (grass.density in its definition, from 0 to 1) and where it can
     grow (quarter-meter mask: ground at level 0, no void, no bridge, no terrace, no placed obstacle, no water or ramp).
     The blades of a tile are shuffled and numbered: a blade's rank (from 0 to 1) decides whether it stays when the density drops with
     distance or quality, with no jump from one tile to the next.
   - Rendering: one program, two blade templates (near: 7 tapered triangles; far: one triangle). Each tile is an instanced draw
     (per-blade attribute, in half-floats: x and z in the tile, height, rank; 8 bytes); each frame, tiles outside the view or beyond range are hidden, the
     others take the template for their distance and draw only the blades that are needed (instanceCount). The vertex shader shapes and
     bends the blade, lays it down with the wind (gusts that cross the lawn), under footsteps and blasts (BEND flex field of the
     flora), lights it (wraparound sun, backlight, sky and bounce read from the baked lighting volume; the sun shadow is that of the
     ground: the two near cascades of the shadow maps, read per vertex, and the baked shadow beyond them or without shadow maps) and pulls it back into the
     ground at the end of the range (no blade pops in); a blade is never thinner than a pixel (no flicker in the distance).
     The fragment shader only does color and fog: grass
     overlaps a lot, so each pixel must cost little.
   - Outside ambient occlusion (SSAO), the depth pre-pass and cast shadows. Density and range follow the quality profile
     (QUALITY.*.grass: share of blades, range, end of the near template); Video setting "Relief grass"; nothing in the low
     graphics mode. Everything belongs to the map and is released with it.
   Map definition: grass = { density(x, z) from 0 to 1, height(x, z, r) in m (r: draw from 0 to 1), colors [base, tip, dry
   grass] (sRGB), wind [direction x, direction z, strength], width (half-width at the base, m), amb (share of the sky color added:
   the ambient light the ground receives), dens (blades per m², GRASS.dens by default), seed }.
   ========================================================================== */
const GRASS = { on: false, size: 8, dens: 80, width: 0.012, bytes: 0, chunks: [], root: null, mat: null, tplN: null, tplF: null, blades: 0, drawn: 0, ms: 0, frustum: new THREE.Frustum(), pv: new THREE.Matrix4(), box: new THREE.Box3() };
/* Grass uniforms; the time, the flex field and the lighting volume are those of the flora and the scenery (same objects) */
const GRASS_U = {
  uGrT: { value: 0 }, uGrW: { value: new THREE.Vector4(1, 0, 0.5, 0) }, uGrD: { value: new THREE.Vector4(40, 14, 1, 0.012) }, uGrP: { value: 0.0013 },
  uGrSun: { value: new THREE.Color() }, uGrL: { value: new THREE.Vector3(0, 1, 0) }, uGrSky: { value: new THREE.Color() }, uGrGnd: { value: new THREE.Color() }, uGrAmb: { value: new THREE.Color() },
  uGrC0: { value: new THREE.Color() }, uGrC1: { value: new THREE.Color() }, uGrC2: { value: new THREE.Color() },
  // sun shadow: maps of the two near cascades (same textures and matrices as the scenery), bias, read or not (maps ready)
  uGrSh0: { value: null }, uGrSh1: { value: null }, uGrShM0: { value: new THREE.Matrix4() }, uGrShM1: { value: new THREE.Matrix4() }, uGrShB: { value: -0.0001 }, uGrShOn: { value: 0 },
};
const GRASS_VERT = `#include <common>
#include <fog_pars_vertex>
attribute vec4 aGr;
uniform float uGrT, uGrP; uniform vec4 uGrW, uGrD;
uniform vec3 uGrSun, uGrL, uGrSky, uGrGnd, uGrAmb, uGrC0, uGrC1, uGrC2;
uniform sampler2D tLvB; uniform vec4 uLvBnd, uLvW;
uniform highp sampler3D tVol; uniform vec3 uVolMin, uVolInv, uBounce; uniform float uAOFloor; uniform vec4 uVolL;
${VOL_Q}
${VOL_L}
varying vec3 vGrC; varying float vGrS;
float grH(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
#ifdef GR_SH
uniform highp sampler2DShadow uGrSh0, uGrSh1; uniform mat4 uGrShM0, uGrShM1; uniform float uGrShB, uGrShOn;
// sun shadow at p from the shadow maps (near cascade, then the next one); -1 outside both: the baked shadow takes over
float grShadow(vec3 p) {
  if (uGrShOn < 0.5) return -1.0;
  vec4 c = uGrShM0 * vec4(p, 1.0); c.xyz /= c.w;
  if (c.x > 0.002 && c.x < 0.998 && c.y > 0.002 && c.y < 0.998 && c.z <= 1.0) return texture(uGrSh0, vec3(c.xy, c.z + uGrShB));
  c = uGrShM1 * vec4(p, 1.0); c.xyz /= c.w;
  if (c.x > 0.002 && c.x < 0.998 && c.y > 0.002 && c.y < 0.998 && c.z <= 1.0) return texture(uGrSh1, vec3(c.xy, c.z + uGrShB));
  return -1.0;
}
#endif
void main() {
  vec3 root = (modelMatrix * vec4(aGr.x, 0.0, aGr.y, 1.0)).xyz; // x and z in the tile: the tile is placed by its matrix
  float rank = aGr.w, t = position.y, sd = position.x, dist = distance(cameraPosition, root);
  // share of blades kept at this distance (and by quality): a blade stays if its rank is below it; at the end of the range, it sinks into the ground
  float keep = uGrD.z * (1.0 - 0.86 * smoothstep(uGrD.y * 0.6, uGrD.x, dist));
  float on = step(rank, keep) * (1.0 - smoothstep(uGrD.x * 0.8, uGrD.x, dist));
  float r1 = grH(rank + 0.13), r2 = grH(rank + 0.71), r3 = grH(rank + 0.37);
  float H = aGr.z * on, ang = r1 * 6.2831853;
  vec2 face = vec2(cos(ang), sin(ang)), side = vec2(-face.y, face.x);
  // almost constant width then pointed, larger as the blades thin out (the meadow stays covered in the distance), never under one pixel
  float w = uGrD.w * (0.7 + 0.6 * r2) * mix(1.0, 2.0, 1.0 - keep / max(uGrD.z, 0.01));
  w = max(w, dist * uGrP * 0.5) * (1.0 - t * t * 0.95) * on;
  // natural curvature, gusts that cross the lawn in the wind direction, flutter, footsteps and blasts (flex field)
  vec2 wd = uGrW.xy, wp = vec2(-wd.y, wd.x);
  float wave = sin(dot(root.xz, wd) * 0.32 - uGrT * 1.7 + sin(dot(root.xz, wp) * 0.11 + uGrT * 0.3) * 1.5);
  float gust = uGrW.z * (0.3 + 0.7 * (wave * 0.5 + 0.5));
  float flut = sin(uGrT * (4.0 + 3.0 * r2) + rank * 40.0) * 0.07 * uGrW.z;
  vec4 bd = texture2D(tLvB, (root.xz - uLvBnd.xy) * uLvBnd.zw);
  vec2 push = (bd.xy - 0.5) * 2.0 * uLvW.z;
  vec2 bend = (face * (0.15 + 0.4 * r3) + wd * gust + side * flut) * H + push * 1.1;
  // blade length roughly constant: the tip drops when it bends
  float b = min(length(bend) / max(H, 0.02), 0.95), tip = H * sqrt(1.0 - b * b);
  vec3 pos = root + vec3(side.x * sd * w + bend.x * t * t, tip * t, side.y * sd * w + bend.y * t * t);
  // per-vertex light: wraparound sun and backlight, sky and bounce from the baked volume, baked sun shadow, blade base in the shadow of the others
  vec3 V = normalize(cameraPosition - pos);
  float fs = dot(V.xz, face) < 0.0 ? -1.0 : 1.0;
  vec3 N = normalize(vec3(face.x * fs, 0.0, face.y * fs) * 0.55 + vec3(side.x, 0.0, side.y) * sd * 0.25 + vec3(0.0, 0.85, 0.0));
  vec3 vq = (root + vec3(0.0, 0.3, 0.0) - uVolMin) * uVolInv;
  vec4 vol = texture(tVol, VOL_Q(vq));
  float sky = mix(uAOFloor, 1.0, vol.r);
  float dif = clamp((dot(N, uGrL) + 0.45) / 1.45, 0.0, 1.0), back = pow(clamp(dot(-V, uGrL), 0.0, 1.0), 4.0) * 0.6 * t;
  vec3 hemi = mix(uGrGnd, uGrSky, N.y * 0.5 + 0.5);
  // patches of dry grass and meadow tones, which vary slowly from place to place
  float dry = smoothstep(0.3, 0.95, sin(root.x * 0.21 + sin(root.z * 0.17) * 1.7) * sin(root.z * 0.19 + 1.3)) * 0.75;
  float tone = 0.86 + 0.12 * sin(root.x * 0.13 + root.z * 0.07) + 0.2 * r3;
  vec3 alb = mix(mix(uGrC0, uGrC1, t), uGrC2, dry * t) * tone;
  float sunV = vol.a;
#ifdef GR_SH
  float shv = grShadow(pos + uGrL * 0.15); // slightly toward the sun: the blade base does not shadow itself against the ground
  if (shv >= 0.0) sunV = shv;
#endif
  vec3 c = alb * (uGrSun * (dif + back) * sunV + (hemi + uGrAmb) * sky + uBounce * vol.g * 0.32 + volLamp(vq)); // volLamp: scenery lamps
  vGrC = c * mix(0.42, 1.0, smoothstep(0.0, 0.75, t)); vGrS = sd;
  vec4 mvPosition = viewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const GRASS_FRAG = `#include <common>
#include <fog_pars_fragment>
varying vec3 vGrC; varying float vGrS;
void main() {
  gl_FragColor = vec4(vGrC * (0.86 + 0.14 * abs(vGrS)), 1.0); // midrib slightly darker in the middle of the blade
  #include <fog_fragment>
}`;
function grassMaterial() {
  const U = Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), GRASS_U, { tLvB: LIVE_U.tLvB, uLvBnd: LIVE_U.uLvBnd, uLvW: LIVE_U.uLvW, tVol: WMU.tVol, uVolMin: WMU.uVolMin, uVolInv: WMU.uVolInv, uVolL: WMU.uVolL, uBounce: WMU.uBounce, uAOFloor: WMU.uAOFloor });
  const m = new THREE.ShaderMaterial({ uniforms: U, vertexShader: GRASS_VERT, fragmentShader: GRASS_FRAG, fog: true, side: THREE.DoubleSide });
  if (!NO_SHADOWS && CSM_HW.on) m.defines = { GR_SH: '' }; // without shadow maps (PowerVR): no shadow map reads in the program
  m.name = 'grassBlades';
  return m;
}
/* Blade templates (x: side, -1 to 1; y: relative height): near, four tiers and the tip (9 vertices, 7 triangles: a long blade
   bends without breaking); far, one triangle */
function grassTemplates() {
  const mk = (p, idx) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(idx); return g; };
  GRASS.tplN = mk([-1, 0, 0, 1, 0, 0, -1, 0.27, 0, 1, 0.27, 0, -1, 0.52, 0, 1, 0.52, 0, -1, 0.76, 0, 1, 0.76, 0, 0, 1, 0],
    [0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6, 6, 5, 7, 6, 7, 8]);
  GRASS.tplF = mk([-1, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2]);
}
/* Mask of the cells (25 cm) where grass can grow: ground at level 0 (floating islands: the top of the islands only, not the bridges),
   with no placed obstacle (collision box that rises above the ground), no ramp, no water (sea, basins), and not under a roof (opaque
   occlusion volume within 6 m: interiors) */
function grassMask() {
  const r = 4, x0 = MAP.x0, z0 = MAP.z0, W = Math.ceil((MAP.x1 - MAP.x0) * r), H = Math.ceil((MAP.z1 - MAP.z0) * r), m = new Uint8Array(W * H).fill(VOID.on ? 0 : 1);
  const fill = (ax, bx, az, bz, v) => {
    const i0 = Math.max(0, Math.floor((ax - x0) * r)), i1 = Math.min(W - 1, Math.ceil((bx - x0) * r) - 1), j0 = Math.max(0, Math.floor((az - z0) * r)), j1 = Math.min(H - 1, Math.ceil((bz - z0) * r) - 1);
    for (let j = j0; j <= j1; j++) m.fill(v, j * W + i0, j * W + i1 + 1);
  };
  if (VOID.on) for (const c of COL) if (!c.inv && Math.abs(c.y1) < 0.06 && c.y1 - c.y0 >= 1) fill(c.x0, c.x1, c.z0, c.z1, 1); // island bodies (a bridge deck is thin)
  for (const c of COL) if (!c.inv && c.y1 > 0.06 && c.y0 < 0.3) fill(c.x0 - 0.1, c.x1 + 0.1, c.z0 - 0.1, c.z1 + 0.1, 0);
  for (const rp of RAMPS) fill(rp.x0, rp.x1, rp.z0, rp.z1, 0);
  for (const o of OCC) if ((o.k === undefined ? 1 : o.k) >= 0.85 && o.y0 < 6 && o.y1 > 1) fill(o.x0, o.x1, o.z0, o.z1, 0);
  if (WATER.on || POOLS.length) for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = j * W + i; if (m[k] && waterSurfaceAt(x0 + (i + 0.5) / r, z0 + (j + 0.5) / r) !== null) m[k] = 0; }
  for (const p of PONDS) { const b = new THREE.Box3().setFromObject(p.mesh); if (b.max.y > 0.25) fill(b.min.x, b.max.x, b.min.z, b.max.z, 0); } // fountain basins
  return (x, z) => { const i = Math.floor((x - x0) * r), j = Math.floor((z - z0) * r); return i >= 0 && j >= 0 && i < W && j < H && m[j * W + i] === 1; };
}
/* Builds the map's grass (after the scenery and the collision index) */
function grassBuild(G) {
  if (!G || GFX_SAFE || ULTRA) return;
  const t0 = performance.now(), ok = grassMask(), R = rngOf(G.seed || 5150), S = GRASS.size, step = 1 / Math.sqrt(G.dens || GRASS.dens), n1 = Math.round(S / step);
  grassTemplates(); GRASS.mat = grassMaterial(); GRASS.width = G.width || 0.012;
  GRASS.root = new THREE.Group(); GRASS.root.name = 'grassBlades'; GRASS.root.matrixAutoUpdate = false; GRASS.root.visible = false; MAPL.root.add(GRASS.root);
  let total = 0;
  for (let cz = Math.floor(MAP.z0 / S); cz * S < MAP.z1; cz++) for (let cx = Math.floor(MAP.x0 / S); cx * S < MAP.x1; cx++) {
    const x0 = cx * S, z0 = cz * S, b = [];
    for (let j = 0; j < n1; j++) for (let i = 0; i < n1; i++) {
      const x = x0 + (i + R()) * step, z = z0 + (j + R()) * step;
      if (!ok(x, z)) continue;
      const d = G.density(x, z); if (d <= 0 || R() >= d) continue;
      b.push(x - x0, z - z0, G.height(x, z, R()), 0);
    }
    const n = b.length / 4; if (!n) continue;
    // shuffle (Fisher-Yates): the first k blades form a uniform sample of the tile; the rank decides which ones remain in the distance
    const a = new Float32Array(b);
    for (let i = n - 1; i > 0; i--) { const k = Math.floor(R() * (i + 1)); for (let c = 0; c < 4; c++) { const t = a[i * 4 + c]; a[i * 4 + c] = a[k * 4 + c]; a[k * 4 + c] = t; } }
    for (let i = 0; i < n; i++) a[i * 4 + 3] = (i + 0.5) / n;
    // half-floats (8 bytes per blade): x and z in the tile (8 m, accurate to 4 mm), height, rank
    const hf = new Uint16Array(n * 4); for (let i = 0; i < n * 4; i++) hf[i] = THREE.DataUtils.toHalfFloat(a[i]);
    const attr = new THREE.InstancedBufferAttribute(hf, 4); attr.isFloat16BufferAttribute = true;
    const sph = new THREE.Sphere(new THREE.Vector3(x0 + S / 2, 0.4, z0 + S / 2), S * 0.75 + 1.2);
    const mesh = (tpl) => {
      const g = new THREE.InstancedBufferGeometry(); g.index = tpl.index; g.setAttribute('position', tpl.attributes.position); g.setAttribute('aGr', attr); g.instanceCount = 0; g.boundingSphere = sph;
      const o = new THREE.Mesh(g, GRASS.mat); o.position.set(x0, 0, z0); o.updateMatrix(); o.frustumCulled = false; o.matrixAutoUpdate = false; o.visible = false; o.castShadow = o.receiveShadow = false;
      o.userData.noAO = true; o.userData.noPrepass = true; GRASS.root.add(o); return o;
    };
    GRASS.chunks.push({ x0, z0, x1: x0 + S, z1: z0 + S, n, mN: mesh(GRASS.tplN), mF: mesh(GRASS.tplF), box: new THREE.Box3(new THREE.Vector3(x0 - 0.6, -0.2, z0 - 0.6), new THREE.Vector3(x0 + S + 0.6, 1.2, z0 + S + 0.6)) });
    total += n;
  }
  GRASS.bytes = total * 8;
  const C = G.colors || [[0.14, 0.27, 0.06], [0.42, 0.58, 0.16], [0.62, 0.58, 0.3]];
  GRASS_U.uGrC0.value.setRGB(sl(C[0][0]), sl(C[0][1]), sl(C[0][2])); GRASS_U.uGrC1.value.setRGB(sl(C[1][0]), sl(C[1][1]), sl(C[1][2])); GRASS_U.uGrC2.value.setRGB(sl(C[2][0]), sl(C[2][1]), sl(C[2][2]));
  const w = G.wind || [0.8, 0.6, 0.5], wl = hyp(w[0], w[1]) || 1; GRASS_U.uGrW.value.set(w[0] / wl, w[1] / wl, w[2], 0);
  GRASS.amb = G.amb !== undefined ? G.amb : 0.4;
  GRASS.blades = total; GRASS.on = total > 0; GRASS.ms = Math.round(performance.now() - t0);
}
function grassClear() {
  if (GRASS.tplN) { GRASS.tplN.dispose(); GRASS.tplF.dispose(); }
  Object.assign(GRASS, { on: false, chunks: [], root: null, mat: null, tplN: null, tplF: null, blades: 0, drawn: 0 });
}
/* Each frame, once the camera is placed: visible tiles, template and number of blades by distance; map lights */
function grassUpdate(t) {
  if (!GRASS.on) return;
  const q = RQ.q.grass, on = !!q && gfxSet('grass') !== false;
  GRASS.root.visible = on; if (!on) return;
  const [qd, far, near] = q, U = GRASS_U, p = camera.position;
  U.uGrT.value = t; U.uGrD.value.set(far, near, qd, GRASS.width); U.uGrL.value.copy(SUN_DIR);
  U.uGrP.value = (2 * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, VIEW.h * renderPixelRatio()); // angle of a pixel
  const sl0 = csm ? csm.lights[0] : null;
  if (sl0) U.uGrSun.value.copy(sl0.color).multiplyScalar(sl0.intensity); else U.uGrSun.value.setRGB(0, 0, 0);
  U.uGrSky.value.copy(hemi.color).multiplyScalar(hemi.intensity); U.uGrGnd.value.copy(hemi.groundColor).multiplyScalar(hemi.intensity);
  U.uGrAmb.value.copy(U.uGrSky.value).multiplyScalar(GRASS.amb);
  // shadow maps of the two near cascades: ready (depth texture allocated) or not
  const sh = CSM_HW.uniform.value, L = csm ? csm.lights : [];
  U.uGrShOn.value = sh[0] && sh[1] && L[1] && renderer.shadowMap.enabled ? 1 : 0;
  if (U.uGrShOn.value) { U.uGrSh0.value = sh[0]; U.uGrSh1.value = sh[1]; U.uGrShM0.value = L[0].shadow.matrix; U.uGrShM1.value = L[1].shadow.matrix; U.uGrShB.value = L[0].shadow.bias; }
  camera.updateMatrixWorld(); GRASS.pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); GRASS.frustum.setFromProjectionMatrix(GRASS.pv);
  let drawn = 0;
  for (const c of GRASS.chunks) {
    const dx = Math.max(c.x0 - p.x, 0, p.x - c.x1), dz = Math.max(c.z0 - p.z, 0, p.z - c.z1), d = hyp3(dx, Math.max(0, p.y - 1), dz);
    const k = d < far && GRASS.frustum.intersectsBox(c.box) ? qd * (1 - 0.86 * smoothstep(near * 0.6, far, d)) : 0, n = Math.ceil(c.n * k), close = d < near;
    c.mN.visible = n > 0 && close; c.mF.visible = n > 0 && !close;
    if (n > 0) { (close ? c.mN : c.mF).geometry.instanceCount = n; drawn += n; }
  }
  GRASS.drawn = drawn;
}
