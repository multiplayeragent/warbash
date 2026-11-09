/* ==========================================================================
   WATER: the sea and basins of a harbor map (Port-Maël), with their dedicated shader.
   - Water plane below the quay level (WATER.y): a fine grid (80 cm) along the coast, getting looser
     toward the open sea, out to 900 m. Gerstner waves computed on the graphics card: chop everywhere, swell beyond
     the breakwater (WATER.open), damped against the quays and hulls. The same waves, computed here in JavaScript
     (waterHeight), make the boats bob (floatAdd).
   - Material (waterMaterial): MeshStandardMaterial patched via userData.patch, to keep the cascaded shadows,
     the sun and the engine's fog. The shader adds:
       · ripples in three scrolling layers (procedural "ripple" surface from the texture lab), faded
         with distance (no sparkle far away);
       · the sky reflection, rendered once at load into a mipmapped cube map (waterReady): the reflected sky
         is the one you see (gradient, clouds, sunset glow), not that of the HDRI lighting;
       · the dark reflection of the quays and colored reflection of the hulls close to the water: the reflected ray advances in the
         obstacle distance field (waterField) and hits them if it passes under their edge;
       · light passing through the backlit crests (scattering, in RE_Direct: so it follows the shadows);
       · foam: a fringe lapping the quays and hulls, waves beating the breakwater, whitecaps of the swell offshore;
       · the bottom seen through clear water (floor, abs): the refracted ray descends to a sandy bottom that isn't modeled (deeper
         the farther from the quays), or hits the submerged foot of a quay or hull (obstacle field); the water
         absorbs each color along that path (red first), and sunlight draws caustics on it. A clear sea (Notos)
         shows its bottom at the foot of the quays, a murky harbor water (Port-Maël) hardly at all.
   - The rest of the game knows about water: a shot makes a splash there (rayWorld, material 'water'), a grenade sinks in and its
     splash replaces the fireball, a dropped weapon sinks in it (groundHeight). Quay edges carry invisible
     walls (waterEdge) that stop soldiers but not bullets or grenades, and that bots don't take
     for cover.
   Everything belongs to the map: mesh and material under its root, textures freed with the material (MAT.water).
   ========================================================================== */
const WATER = {
  on: false, y: -1.5, floor: -7, land: [], box: [-1e4, 1e4, -1e4, 1e4], obs: [], floats: [], t: 0,
  open: [-150, -112], east: -16, F: null, dist: null, cube: null, mat: null, U: null,
};
/* Waves: [propagation direction (rad, 0 = toward +x), wavelength (m), amplitude (m), steepness (horizontal
   displacement as a share of the amplitude), group: 0 chop (everywhere, damped near the quays), 1 swell (offshore)] */
const WAVES = [
  [0.35, 8.5, 0.045, 1.6, 0], [-0.45, 5.6, 0.03, 1.5, 0], [1.15, 3.6, 0.017, 1.2, 0], [-1.05, 2.4, 0.01, 1.0, 0],
  [0.08, 46, 0.4, 1.1, 1], [-0.22, 29, 0.22, 1.2, 1], [0.42, 18, 0.12, 1.3, 1], [-0.62, 11, 0.06, 1.2, 1],
];
const WAVES_C = WAVES.map(([a, L, A, Q, g], i) => { const k = TAU / L; return { dx: Math.cos(a), dz: Math.sin(a), k, A, Q, g, w: Math.sqrt(9.81 * k), ph: i * 1.7 }; });

/* ---------- Procedural ripple surface (normals), foam pattern (map.a) and caustics (map.rgb) ----------
   Caustics: network of fine bright lines and their halo (edges of deformed Voronoi cells, two sizes), which the water
   shaders read twice, at two scales scrolling in opposite directions, keeping the minimum: the network keeps breaking up and
   re-forming, like sunlight at the bottom of a pool. */
Object.assign(TEXLAB, {
  ripple: [512, 83, 1.6, `
    vec2 ww = vec2(gfbm(uv, vec2(4.0), 3, 7.0), gfbm(uv + 0.37, vec2(4.0), 3, 8.0)) - 0.5;
    float w1 = gfbm(uv + ww * 0.09, vec2(5.0, 7.0), 5, 1.0), w2 = gfbm(uv - ww * 0.07, vec2(12.0, 9.0), 4, 2.0);
    float cr = 1.0 - abs(gfbm(uv + ww * 0.05, vec2(8.0, 11.0), 4, 3.0) * 2.0 - 1.0);
    h = w1 * 0.5 + w2 * 0.25 + cr * cr * 0.25;
    vec4 v1 = vor(uv + ww * 0.12, vec2(18.0), 4.0, 1.0), v2 = vor(uv + 0.5, vec2(37.0), 5.0, 1.0);
    float lines = (1.0 - smoothstep(0.02, 0.1, v1.w)) * 0.75 + (1.0 - smoothstep(0.02, 0.08, v2.w)) * 0.5;
    float blot = gfbm(uv, vec2(5.0), 4, 9.0);
    x = clamp(lines * smoothstep(0.3, 0.6, blot) + smoothstep(0.5, 0.75, blot) * 0.7, 0.0, 1.0);
    vec2 cw = vec2(gfbm(uv, vec2(3.0), 3, 21.0), gfbm(uv + 0.31, vec2(3.0), 3, 22.0)) - 0.5;
    vec4 c1 = vor(uv + cw * 0.16, vec2(7.0), 31.0, 1.0), c2 = vor(uv - cw * 0.1 + 0.27, vec2(12.0), 33.0, 1.0);
    float cs = exp(-c1.w * c1.w * 420.0) + exp(-c1.w * c1.w * 45.0) * 0.3 + exp(-c2.w * c2.w * 520.0) * 0.55 + exp(-c2.w * c2.w * 60.0) * 0.15;
    a = vec3(clamp(cs * 0.85, 0.0, 1.0)); r = 0.1;`],
});
TEXSCALE.ripple = 8; OPT_TEX.add('ripple');

/* ---------- Plan: land, obstacles, edges ---------- */
/* Map settings: water level, zone where there can be water (box: x0, x1, z0, z1), swell limit
   (open: the swell is full west of open[0], zero east of open[1]), east edge of the water plane (under the quays) */
function waterSetup(o) {
  Object.assign(WATER, { on: true, y: o.y, floor: o.y - 5.5, box: o.box, open: o.open, east: o.east, land: [], obs: [], floats: [], F: null, dist: null });
}
/* Dry land (rectangle): no water for shots and grenades, no visible water plane above it */
function waterLand(x0, x1, z0, z1) { WATER.land.push([x0, x1, z0, z1]); }
/* Point (x, z) above the water? */
function waterAt(x, z) {
  const W = WATER, b = W.box;
  if (x < b[0] || x > b[1] || z < b[2] || z > b[3]) return false;
  for (const r of W.land) if (x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3]) return false;
  return true;
}
/* Obstacle in the water (quay, hull, breakwater, piles) for foam and reflections: polygon [[x, z], ...] or rectangle
   [x0, x1, z0, z1]; h: height above the water (m); c: sRGB tint of its base; foam: foam strength */
function waterObstacle(shape, h, c, foam = 1) {
  const poly = shape.length === 4 && typeof shape[0] === 'number' ? [[shape[0], shape[2]], [shape[1], shape[2]], [shape[1], shape[3]], [shape[0], shape[3]]] : shape;
  WATER.obs.push({ poly, h, c, foam });
}
/* Invisible wall at the water's edge: stops soldiers (and bodies), lets bullets and grenades through,
   is neither cover for bots nor a shadow for the baked lighting */
function waterEdge(x0, x1, z0, z1) {
  COL.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0: WATER.y - 2, y1: WATER.y + 7.5, z0: Math.min(z0, z1), z1: Math.max(z0, z1), m: 'concrete', ray: false, noRay: true, inv: true });
}

/* ---------- Walkable basins (ponds, streams, canals) ----------
   A basin is an outline you wade in: the bottom under the feet is at bed (m, negative for a dug pond, 0 for a stream
   laid on the ground) and the water at wl. groundHeight (02-map.js) returns the basin bottom instead of the ground, rayWorld the water surface
   (splash from shots), bot navigation goes along the bottom, surfaceAt answers 'water' (not in the water). Declared via pondAdd (wade). */
const POOLS = [];
function poolAdd(poly, bed, wl) {
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  POOLS.push({ poly, bed, wl, x0, x1, z0, z1 });
}
function poolAt(x, z) {
  for (const p of POOLS) {
    if (x < p.x0 || x > p.x1 || z < p.z0 || z > p.z1) continue;
    const P = p.poly; let inside = false;
    for (let a = 0, b = P.length - 1; a < P.length; b = a++) if ((P[a][1] > z) !== (P[b][1] > z) && x < ((P[b][0] - P[a][0]) * (z - P[a][1])) / (P[b][1] - P[a][1]) + P[a][0]) inside = !inside;
    if (inside) return p;
  }
  return null;
}
/* Water level under point (x, z): the sea (above its plane), a basin, or null if there is no water */
function waterSurfaceAt(x, z) {
  if (WATER.on && waterAt(x, z)) return WATER.y;
  if (POOLS.length) { const p = poolAt(x, z); if (p) return p.wl; }
  return null;
}

/* ---------- Waves (JavaScript, same formulas as the shader, vertical displacement only) ---------- */
function waterCalm(x, z) {
  const F = WATER.F; if (!F) return 1;
  const i = Math.floor((x - F.x0) * F.ppm), j = Math.floor((z - F.z0) * F.ppm);
  if (i < 0 || j < 0 || i >= F.w || j >= F.h) return 1;
  return lerp(0.35, 1, smoothstep(0.5, 8, WATER.dist[j * F.w + i]));
}
function waterHeight(x, z, t) {
  const calm = waterCalm(x, z), open = 1 - smoothstep(WATER.open[0], WATER.open[1], x);
  let h = 0;
  for (const w of WAVES_C) {
    const a = w.A * (w.g ? open : calm); if (a < 1e-4) continue;
    h += a * Math.sin(w.k * (w.dx * x + w.dz * z) - w.w * t + w.ph);
  }
  return h;
}

/* ---------- Obstacle distance field (foam, reflections, wave damping) ----------
   2 pixels per meter over the harbor zone. Each cell keeps the nearest obstacle cell (vector propagation
   in two passes): distance, direction of the obstacle, its height, its tint and the strength of its foam. */
function waterField() {
  const W = WATER, F = { x0: -144, z0: -128, ppm: 2, w: 256, h: 512 }, N = F.w * F.h;
  const id = new Int16Array(N).fill(-1), sx = new Int16Array(N).fill(-1), sz = new Int16Array(N).fill(-1);
  W.obs.forEach((o, k) => {
    const P = o.poly; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const [x, z] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const i0 = Math.max(0, Math.floor((x0 - F.x0) * F.ppm)), i1 = Math.min(F.w - 1, Math.ceil((x1 - F.x0) * F.ppm));
    const j0 = Math.max(0, Math.floor((z0 - F.z0) * F.ppm)), j1 = Math.min(F.h - 1, Math.ceil((z1 - F.z0) * F.ppm));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = F.x0 + (i + 0.5) / F.ppm, z = F.z0 + (j + 0.5) / F.ppm;
      let inside = false;
      for (let a = 0, b = P.length - 1; a < P.length; b = a++) {
        if ((P[a][1] > z) !== (P[b][1] > z) && x < ((P[b][0] - P[a][0]) * (z - P[a][1])) / (P[b][1] - P[a][1]) + P[a][0]) inside = !inside;
      }
      if (inside) { const c = j * F.w + i; id[c] = k; sx[c] = i; sz[c] = j; }
    }
  });
  const d2 = (c, i, j) => (sx[c] < 0 ? 1e9 : (sx[c] - i) ** 2 + (sz[c] - j) ** 2);
  const take = (c, n, i, j) => { if (sx[n] >= 0 && d2(n, i, j) < d2(c, i, j)) { sx[c] = sx[n]; sz[c] = sz[n]; id[c] = id[n]; } };
  for (let j = 0; j < F.h; j++) {
    for (let i = 0; i < F.w; i++) { const c = j * F.w + i; if (i > 0) take(c, c - 1, i, j); if (j > 0) { take(c, c - F.w, i, j); if (i > 0) take(c, c - F.w - 1, i, j); if (i < F.w - 1) take(c, c - F.w + 1, i, j); } }
    for (let i = F.w - 2; i >= 0; i--) { const c = j * F.w + i; take(c, c + 1, i, j); }
  }
  for (let j = F.h - 1; j >= 0; j--) {
    for (let i = F.w - 1; i >= 0; i--) { const c = j * F.w + i; if (i < F.w - 1) take(c, c + 1, i, j); if (j < F.h - 1) { take(c, c + F.w, i, j); if (i < F.w - 1) take(c, c + F.w + 1, i, j); if (i > 0) take(c, c + F.w - 1, i, j); } }
    for (let i = 1; i < F.w; i++) { const c = j * F.w + i; take(c, c - 1, i, j); }
  }
  const a = new Uint8Array(N * 4), b = new Uint8Array(N * 4), dist = new Float32Array(N);
  for (let c = 0; c < N; c++) {
    const i = c % F.w, j = (c / F.w) | 0, o = c * 4;
    if (sx[c] < 0) { dist[c] = 16; a[o] = 255; a[o + 1] = a[o + 2] = 128; continue; }
    const dx = sx[c] - i, dz = sz[c] - j, l = hyp(dx, dz), d = l / F.ppm, ob = W.obs[id[c]];
    dist[c] = d;
    a[o] = Math.round(clamp(d / 16, 0, 1) * 255);
    a[o + 1] = Math.round(((l > 0 ? dx / l : 0) * 0.5 + 0.5) * 255); a[o + 2] = Math.round(((l > 0 ? dz / l : 0) * 0.5 + 0.5) * 255);
    a[o + 3] = Math.round(clamp(ob.h / 16, 0, 1) * 255);
    b[o] = Math.round(ob.c[0] * 255); b[o + 1] = Math.round(ob.c[1] * 255); b[o + 2] = Math.round(ob.c[2] * 255); b[o + 3] = Math.round(clamp(ob.foam, 0, 1) * 255);
  }
  const tex = (data, srgb) => {
    const t = new THREE.DataTexture(data, F.w, F.h, THREE.RGBAFormat);
    t.minFilter = t.magFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.generateMipmaps = false;
    if (srgb) t.encoding = THREE.sRGBEncoding; t.needsUpdate = true; return t;
  };
  W.F = F; W.dist = dist;
  return { field: tex(a, false), col: tex(b, true) };
}

/* ---------- Mesh: fine grid near the coast, loose offshore ---------- */
function waterGeometry() {
  const W = WATER, xs = [], zp = [0];
  for (let x = W.east, s = 0.8; x > -900; x -= s) { xs.push(x); if (x < -72) s = Math.min(s * 1.07, 45); }
  xs.push(-900); xs.reverse();
  for (let z = 0, s = 0.8; z < 900;) { if (z > 75) s = Math.min(s * 1.07, 45); z = Math.min(900, z + s); zp.push(z); }
  const zs = zp.slice(1).map((v) => -v).reverse().concat(zp), nx = xs.length, nz = zs.length;
  const P = new Float32Array(nx * nz * 3), idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  for (let j = 0, o = 0; j < nz; j++) for (let i = 0; i < nx; i++, o += 3) { P[o] = xs[i]; P[o + 1] = W.y; P[o + 2] = zs[j]; }
  let k = 0;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nx * nz * 3).fill(0), 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

/* ---------- Shader ---------- */
const WTR_VERT_HEAD = `#include <common>
uniform float uWTime; uniform vec4 uWv[8], uWw[8]; uniform vec2 uWOpen; uniform sampler2D tWField; uniform vec4 uWFieldB;
varying vec3 vWtr; varying vec3 vWtrN; varying float vWtrC;
/* Gerstner waves: displaced position, normal, relative crest height (-1 to 1) */
void wtrWaves(vec2 p, out vec3 P, out vec3 N, out float crest) {
  vec2 fuv = (p - uWFieldB.xy) * uWFieldB.zw;
  float d = (fuv.x >= 0.0 && fuv.x <= 1.0 && fuv.y >= 0.0 && fuv.y <= 1.0) ? texture2D(tWField, fuv).r * 16.0 : 16.0;
  float calm = mix(0.35, 1.0, smoothstep(0.5, 8.0, d)), open = 1.0 - smoothstep(uWOpen.x, uWOpen.y, p.x);
  P = vec3(p.x, 0.0, p.y); float nx = 0.0, ny = 1.0, nz = 0.0, h = 0.0, am = 1e-4;
  for (int i = 0; i < 8; i++) {
    vec4 a = uWv[i], b = uWw[i];
    float A = a.w * (b.w > 0.5 ? open : calm);
    float th = a.z * dot(a.xy, p) - b.x * uWTime + b.z, s = sin(th), c = cos(th);
    P.x += b.y * A * a.x * c; P.z += b.y * A * a.y * c; P.y += A * s;
    nx -= a.x * a.z * A * c; nz -= a.y * a.z * A * c; ny -= b.y * a.z * A * s;
    h += A * s; am += A;
  }
  N = normalize(vec3(nx, ny, nz)); crest = h / am;
}`;
const WTR_FRAG_HEAD = `#include <common>
uniform float uWTime, uWReflI; uniform vec2 uWOpen; uniform sampler2D tWField, tWFieldC, tWRip, tWFoam; uniform vec4 uWFieldB;
uniform samplerCube tWRefl; uniform vec3 uWDeep, uWShallow, uWScat, uWFoamC, uWAmb, uWSunC, uWSunD, uWFloor, uWAbs, uWSand; uniform float uWCaus, uWFoamK;
varying vec3 vWtr; varying vec3 vWtrN; varying float vWtrC;
vec3 wtrN, wtrTr, wtrSand; float wtrFoam, wtrRough, wtrD, wtrCK; vec4 wtrF, wtrFC;`;
/* Color, normal and foam (in place of color_fragment, before roughness and normal) */
const WTR_COLOR = `{
  vec3 V = cameraPosition - vWtr; float dist = length(V);
  vec2 fuv = (vWtr.xz - uWFieldB.xy) * uWFieldB.zw;
  bool inF = fuv.x >= 0.0 && fuv.x <= 1.0 && fuv.y >= 0.0 && fuv.y <= 1.0;
  wtrF = inF ? texture2D(tWField, fuv) : vec4(1.0, 0.5, 0.5, 0.0); wtrFC = inF ? texture2D(tWFieldC, fuv) : vec4(0.0);
  wtrD = wtrF.r * 16.0;
  // ripples: three scrolling layers, less and less pronounced with distance
  vec2 p = vWtr.xz, t = vec2(uWTime);
  vec3 r1 = texture2D(tWRip, p * 0.085 + t * vec2(0.011, 0.004)).xyz * 2.0 - 1.0;
  vec3 r2 = texture2D(tWRip, p.yx * 0.19 + t * vec2(-0.017, 0.021)).xyz * 2.0 - 1.0;
  vec3 r3 = texture2D(tWRip, p * 0.024 + t * vec2(0.0035, -0.002)).xyz * 2.0 - 1.0;
  float fade = 1.0 / (1.0 + dist * 0.03), calm = mix(0.55, 1.0, smoothstep(0.5, 6.0, wtrD));
  vec2 sl = (r1.xy / max(r1.z, 0.25) * 0.9 + r2.yx / max(r2.z, 0.25) * 0.55) * fade * calm + r3.xy / max(r3.z, 0.25) * 0.7 * (0.35 + 0.65 * fade);
  vec3 Nw = normalize(vWtrN);
  vec2 rps; float rpf, rph, rpl; ripple(vWtr.xz, rps, rpf, rph, rpl); // ripples from soldiers, shots and explosions (02mb-waves.js)
  wtrN = normalize(vec3(Nw.x / Nw.y + sl.x * 0.34 + rps.x * uRipG * 1.3, 1.0, Nw.z / Nw.y + sl.y * 0.34 + rps.y * uRipG * 1.3));
  // foam: fringe against the quays and hulls, breakwater surf, whitecaps of the swell
  float pat = texture2D(tWFoam, p * 0.19 + t * vec2(0.006, 0.0015)).a, pat2 = texture2D(tWFoam, p * 0.07 - t * vec2(0.002, 0.004)).a;
  float k = wtrFC.a, open = 1.0 - smoothstep(uWOpen.x, uWOpen.y, vWtr.x);
  float shore = (1.0 - smoothstep(0.0, 0.25 + pat2 * 0.7 + k * 0.9, wtrD)) * k * uWFoamK;
  float lap = smoothstep(0.7, 1.0, sin(wtrD * 2.6 - uWTime * 1.4 + pat2 * 5.0)) * (1.0 - smoothstep(0.2, 1.0 + k * 1.6, wtrD)) * k * 0.35 * uWFoamK;
  float caps = smoothstep(0.55, 0.95, vWtrC) * open * smoothstep(0.35, 0.7, pat2);
  wtrFoam = clamp((shore + lap) * (pat * 1.5 - 0.15) + caps * pat * 0.9, 0.0, 1.0) * (0.45 + 0.55 * fade);
  wtrFoam = max(wtrFoam, clamp(rpf * (0.6 + pat * 0.5), 0.0, 1.0));
  // water: murky verdigris near the quays, darker and bluer offshore
  vec3 body = mix(uWShallow, uWDeep, smoothstep(0.5, 9.0, wtrD)) * (0.9 + pat2 * 0.2);
  // the bottom seen through the water (uWFloor: depth at the foot of obstacles, offshore, distance from one to the other; x = 0: no visible bottom)
  wtrTr = vec3(0.0); wtrCK = 0.0; wtrSand = uWSand;
  if (uWFloor.x > 0.0) {
    vec3 Vn = normalize(V), T = refract(-Vn, normalize(mix(wtrN, vec3(0.0, 1.0, 0.0), 0.4)), 0.75);
    float D = mix(uWFloor.x, uWFloor.y, smoothstep(0.0, uWFloor.z, wtrD)), ty = max(-T.y, 0.25), tl = length(T.xz), L = D / ty;
    bool wall = false; vec3 hitC = uWSand;
    // the submerged foot of a quay or hull: the ray advances in the obstacle field until it hits one of them before the bottom
    if (wtrD < 6.0 && tl > 1e-3) {
      vec2 d2 = T.xz / tl; float s = 0.0, Dd = wtrD;
      for (int i = 0; i < 5; i++) {
        s += max(Dd, 0.2); float dep = s * ty / tl;
        if (dep > D) break;
        vec2 fuv = (vWtr.xz + d2 * s - uWFieldB.xy) * uWFieldB.zw;
        if (fuv.x < 0.0 || fuv.x > 1.0 || fuv.y < 0.0 || fuv.y > 1.0) break;
        Dd = texture2D(tWField, fuv).r * 16.0;
        if (Dd < 0.3) { L = dep / ty; hitC = texture2D(tWFieldC, fuv).rgb * vec3(0.55, 0.6, 0.55); wall = true; break; } // stone slightly greened under the water
      }
    }
    wtrTr = exp(-uWAbs * L);
    vec2 fp = vWtr.xz + T.xz * L;
    if (!wall) { // sand: grain, patches, caustics (two scrolling reads of the network)
      hitC *= 0.8 + texture2D(tWFoam, fp * 0.11).a * 0.35;
      float c1 = texture2D(tWFoam, fp * 0.21 + t * vec2(0.012, 0.007)).r, c2 = texture2D(tWFoam, fp.yx * 0.17 - t * vec2(0.009, 0.014) + 0.37).r, cn = (c1 + c2) * 0.5;
      wtrCK = cn * cn * 2.2 * uWCaus * exp(-D * 0.22);
    }
    float Fv = 0.02 + 0.98 * pow(1.0 - clamp(dot(Vn, wtrN), 0.0, 1.0), 5.0);
    wtrSand = hitC * (1.0 - Fv); wtrTr *= 1.0 - wtrFoam;
    body = body * (1.0 - wtrTr) + wtrSand * wtrTr;
  }
  diffuseColor.rgb = mix(body, uWFoamC, wtrFoam);
  wtrRough = mix(mix(0.02, 0.14, smoothstep(12.0, 220.0, dist)), 0.85, wtrFoam);
}`;
const WTR_ROUGH = 'float roughnessFactor = wtrRough;';
const WTR_NORMAL = 'normal = normalize((viewMatrix * vec4(normalize(mix(wtrN, vec3(0.0, 1.0, 0.0), wtrFoam * 0.7)), 0.0)).xyz);';
/* Backlight through the crests: added to the sun (and to lightning), so off in shadow */
const WTR_DIRECT = `#include <lights_physical_pars_fragment>
void RE_Direct_Water( const in IncidentLight directLight, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
  RE_Direct_Physical( directLight, geometry, material, reflectedLight );
  float back = saturate( dot( geometry.viewDir, - directLight.direction ) ), crest = saturate( vWtrC * 0.5 + 0.5 );
  float sss = ( pow( back, 4.0 ) * ( 0.12 + crest * crest * 1.1 ) + 0.02 ) * ( 1.0 - wtrFoam );
  reflectedLight.directDiffuse += directLight.color * uWScat * sss;
  reflectedLight.directDiffuse += directLight.color * wtrCK * wtrTr * wtrSand * 0.3 * saturate( dot( directLight.direction, geometry.normal ) ); // caustics on the bottom
}
#undef RE_Direct
#define RE_Direct RE_Direct_Water`;
/* Reflections: sky and distance (map cube map), quays and hulls up close (obstacle field) */
const WTR_REFL = `#if defined( RE_IndirectDiffuse ) && defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
iblIrradiance += getIBLIrradiance( geometry.normal );
#endif
#if defined( RE_IndirectSpecular )
{
  vec3 V = normalize(cameraPosition - vWtr), Nw = normalize(mix(wtrN, vec3(0.0, 1.0, 0.0), wtrFoam * 0.7));
  vec3 R = reflect(-V, Nw); R.y = max(R.y, 0.012);
  vec3 env = textureLod(tWRefl, R, clamp(wtrRough * 9.0, 0.0, 6.0)).rgb * uWReflI;
  // near-reflection ray: normal of the swell alone, softened, for an image of the quays and hulls that undulates
  // without breaking into shards
  vec3 Rh = reflect(-V, normalize(mix(normalize(vWtrN), vec3(0.0, 1.0, 0.0), 0.5))); Rh.y = max(Rh.y, 0.012);
  // the reflected ray advances in the distance field (step equal to the free distance) until an obstacle: it
  // hits it if it still passes under its top. Correct for any shape (hull corner, quay end, pile)
  float rl = length(Rh.xz);
  // (no obstacle rises more than 4.5 m above the water: a higher ray no longer hits anything)
  if (rl > 1e-3 && wtrD < 12.0 && Rh.y / rl * wtrD < 4.5) {
    vec2 d2 = Rh.xz / rl; float rise = Rh.y / rl, s = 0.0, D = wtrD;
    for (int i = 0; i < 6; i++) {
      s += max(D, 0.25);
      if (s > 14.0 || rise * s > 4.5) break;
      vec2 fuv = (vWtr.xz + d2 * s - uWFieldB.xy) * uWFieldB.zw;
      if (fuv.x < 0.0 || fuv.x > 1.0 || fuv.y < 0.0 || fuv.y > 1.0) break;
      vec4 f = texture2D(tWField, fuv); D = f.r * 16.0;
      if (D < 0.3) {
        float H = f.a * 16.0, hy = rise * s;
        float hit = (1.0 - smoothstep(H * 0.75, H * 1.05, hy)) * (1.0 - smoothstep(9.0, 14.0, s));
        vec2 dir = f.gb * 2.0 - 1.0; vec2 dn = dot(dir, dir) > 0.1 ? normalize(dir) : d2;
        vec3 wn = -vec3(dn.x, 0.0, dn.y);
        vec3 lit = texture2D(tWFieldC, fuv).rgb * (uWAmb + uWSunC * max(dot(wn, uWSunD), 0.0) * 0.32) * (0.75 + 0.25 * smoothstep(0.0, H, hy));
        env = mix(env, lit, hit);
        break;
      }
    }
  }
  radiance += env;
}
#endif`;
function waterPatch(s) {
  Object.assign(s.uniforms, WATER.U, RIP.U);
  s.vertexShader = s.vertexShader.replace('#include <common>', WTR_VERT_HEAD)
    .replace('#include <beginnormal_vertex>', 'vec3 wtrP, wtrNv; float wtrC; wtrWaves(position.xz, wtrP, wtrNv, wtrC);\nvec3 objectNormal = wtrNv;')
    .replace('#include <begin_vertex>', 'vec3 transformed = vec3(wtrP.x, position.y + wtrP.y, wtrP.z);')
    .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWtr = (modelMatrix * vec4(transformed, 1.0)).xyz; vWtrN = wtrNv; vWtrC = wtrC;');
  s.fragmentShader = s.fragmentShader.replace('#include <common>', WTR_FRAG_HEAD + RIP_GLSL).replace('#include <color_fragment>', WTR_COLOR)
    .replace('#include <roughnessmap_fragment>', WTR_ROUGH).replace('#include <normal_fragment_maps>', WTR_NORMAL)
    .replace('#include <lights_physical_pars_fragment>', WTR_DIRECT).replace('#include <lights_fragment_maps>', WTR_REFL);
}
/* Water material; map colors (linear): deep, shallow, scatter, foam; the bottom seen through: floor ([depth at the foot of
   obstacles, offshore, distance from one to the other], m; without: no visible bottom), abs (absorption per meter of each color), sand (albedo
   of the bottom), caus (caustics); foamK: strength of the foam fringe against the quays */
function waterMaterial(field, o) {
  const A = CURMAP.def.atmo, lin = (h) => new THREE.Color(h).convertSRGBToLinear();
  const hemi = lin(A.hemi[0]), sun = lin(A.sunColor);
  WATER.U = {
    uWTime: { value: 0 }, uWReflI: { value: o.refl || 1 }, uWOpen: { value: new THREE.Vector2(...WATER.open) },
    uWv: { value: WAVES_C.map((w) => new THREE.Vector4(w.dx, w.dz, w.k, w.A)) }, uWw: { value: WAVES_C.map((w) => new THREE.Vector4(w.w, w.Q, w.ph, w.g)) },
    tWField: { value: field.field }, tWFieldC: { value: field.col }, uWFieldB: { value: new THREE.Vector4(WATER.F.x0, WATER.F.z0, 1 / (WATER.F.w / WATER.F.ppm), 1 / (WATER.F.h / WATER.F.ppm)) },
    tWRip: { value: TEX.ripple.normal }, tWFoam: { value: TEX.ripple.map }, tWRefl: { value: null },
    uWDeep: { value: new V3(...o.deep) }, uWShallow: { value: new V3(...o.shallow) }, uWScat: { value: new V3(...o.scatter) }, uWFoamC: { value: new V3(...o.foam) },
    uWAmb: { value: new V3(hemi.r, hemi.g, hemi.b).multiplyScalar(A.hemi[2] * 0.9) }, uWSunC: { value: new V3(sun.r, sun.g, sun.b).multiplyScalar(A.sunI) }, uWSunD: { value: SUN_DIR },
    uWFloor: { value: new V3(...(o.floor || [0, 0, 1])) }, uWAbs: { value: new V3(...(o.abs || [1, 1, 1])) }, uWSand: { value: new V3(...(o.sand || [0.5, 0.45, 0.35])) },
    uWCaus: { value: o.caus || 0 }, uWFoamK: { value: o.foamK !== undefined ? o.foamK : 1 },
  };
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0, envMapIntensity: 1 });
  m.defines = { WATER: '' };
  m.userData.patch = waterPatch; m.onBeforeCompile = waterPatch;
  m.userData.noShadow = true; m.userData.noAO = true;
  m.userData.own = [field.field, field.col];
  return m;
}

/* ---------- Construction (after the scenery: the obstacles are placed) ---------- */
function waterBuild(o) {
  rippleEnsure();
  const field = waterField();
  // sky reflection cube map, rendered by waterReady once the map lighting is in place
  const rt = new THREE.WebGLCubeRenderTarget(o.cube || 256, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  rt.texture.userData.rt = rt; WATER.cube = rt;
  const m = waterMaterial(field, o); MAT.water = m; WATER.mat = m;
  m.userData.own.push(rt.texture);
  WATER.U.tWRefl.value = rt.texture;
  const mesh = new THREE.Mesh(waterGeometry(), m);
  mesh.name = 'map:water'; mesh.castShadow = false; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
  mesh.userData.noPrepass = true; mesh.userData.noAO = true; mesh.frustumCulled = false;
  mapAdd(mesh); WATER.mesh = mesh;
}
/* Layer of the objects reflected by the water (the sky) while rendering the cube map */
const LAYER_REFL = 5;
/* Reflection cube map: the sky seen from the outer harbor, at water level. The scenery isn't in it: seen from a single point,
   it would be reflected in the wrong place (quays and hulls have their own reflection, see WTR_REFL). The sun
   disc is removed from it (the sun is already reflected through the direct light, with its shadows) */
function waterReady(o = {}) {
  if (!WATER.cube) return;
  const cc = new THREE.CubeCamera(0.5, 1200, WATER.cube), p = new V3(...(o.from || [-70, WATER.y + 2.5, 0]));
  cc.position.copy(p); cc.updateMatrixWorld(true);
  for (const c of cc.children) c.layers.set(LAYER_REFL);
  sky.layers.enable(LAYER_REFL);
  const sp = sky.position.clone(), disk = SkyShader.uniforms.uDisk.value.clone();
  sky.position.copy(p); sky.updateMatrixWorld(); SkyShader.uniforms.uDisk.value.set(0, 0, 0);
  // each face is cleared before its render
  const sm = renderer.shadowMap.needsUpdate, ac = renderer.autoClear; renderer.shadowMap.needsUpdate = false; renderer.autoClear = true;
  try { cc.update(renderer, scene); } finally {
    renderer.shadowMap.needsUpdate = sm; renderer.autoClear = ac; SkyShader.uniforms.uDisk.value.copy(disk); sky.position.copy(sp); sky.updateMatrixWorld();
    sky.layers.disable(LAYER_REFL);
  }
}

/* ---------- Floating objects (boats, sailboats at anchor) ----------
   A prefab becomes a group of meshes (just one per material, detail classes merged: each mesh costs
   a draw call per pass) that the waves lift and rock. No collision: reserve for what soldiers
   can't reach. In the distance (background), no shadow or pre-pass: a few pixels on screen.
   o: draft (sinkage, m), L and B (length and beam over which the wave slope is measured), roll
   (natural rocking, rad) */
function floatAdd(pf, x, z, ry, o = {}) {
  const g = new THREE.Group(); g.matrixAutoUpdate = false; g.name = 'float:' + pf.name;
  const far = Math.abs(x) > CHUNK_NEAR.x || Math.abs(z) > CHUNK_NEAR.z, byMat = new Map();
  for (const part of pf.parts.values()) {
    if (!part.g.nv || !MAT[part.mat]) continue;
    let e = byMat.get(part.mat); if (!e) byMat.set(part.mat, e = { parts: [], cls: 9 });
    e.parts.push(part.g); e.cls = Math.min(e.cls, part.cls);
  }
  for (const [name, e] of byMat) {
    const mat = MAT[name]; let gb = e.parts[0];
    if (e.parts.length > 1) { gb = new GeoBuf(256, 512, LIVING.has(name)); for (const p of e.parts) gb.append(p); }
    const mesh = new THREE.Mesh(gb.geometry(), mat);
    mesh.matrixAutoUpdate = false; mesh.castShadow = !far && e.cls === 0 && !mat.userData.noShadow; mesh.receiveShadow = !mat.userData.noReceive;
    if (far || e.cls > 0 || NEAR_SHADOW.has(name)) { mesh.userData.noPrepass = true; if (mesh.castShadow) mesh.layers.set(LAYER_NEAR); }
    if (mat.userData.noAO) mesh.userData.noAO = true;
    g.add(mesh);
  }
  mapAdd(g);
  const R = rngOf(Math.round(x * 31 + z * 17) + 77);
  WATER.floats.push({ g, x, z, ry, draft: o.draft || 0, L: o.L || 4, B: o.B || 1.6, roll: o.roll !== undefined ? o.roll : 0.03, ph: R() * TAU, f: R.range(0.55, 0.85) });
}
const _wq = new THREE.Quaternion(), _we = new THREE.Euler(0, 0, 0, 'YXZ'), _wp = new V3(), _ws = new V3(1, 1, 1);
function waterUpdate(t) {
  if (!WATER.on || !WATER.U) return;
  WATER.t = t; WATER.U.uWTime.value = t;
  for (const f of WATER.floats) {
    const c = Math.cos(f.ry), s = Math.sin(f.ry), hl = f.L / 2, hb = f.B / 2;
    const hf = waterHeight(f.x + s * hl, f.z + c * hl, t), ha = waterHeight(f.x - s * hl, f.z - c * hl, t);
    const hp = waterHeight(f.x + c * hb, f.z - s * hb, t), hs = waterHeight(f.x - c * hb, f.z + s * hb, t);
    _wp.set(f.x, WATER.y + (hf + ha + hp + hs) / 4 - f.draft, f.z);
    _we.set(-Math.atan2(hf - ha, f.L) + Math.sin(t * f.f * 1.3 + f.ph) * f.roll * 0.4, f.ry, Math.atan2(hp - hs, f.B) + Math.sin(t * f.f + f.ph) * f.roll);
    f.g.matrix.compose(_wp, _wq.setFromEuler(_we), _ws); f.g.matrixWorldNeedsUpdate = true;
  }
}
/* New map or unload: the water state starts from zero (mesh and textures leave with the map) */
function waterUnload() {
  for (const rt of WPROBES) rt.dispose(); WPROBES.length = 0;
  Object.assign(WATER, { on: false, land: [], obs: [], floats: [], F: null, dist: null, cube: null, mat: null, U: null, mesh: null });
  POOLS.length = 0; PONDAREAS.length = 0; rippleUnload();
}

/* ==========================================================================
   SMALL WATERS: fountains, basins, canals, streams, ponds, drinking troughs, puddles. SCENERY RULE: all water, however small, is placed
   with pondAdd (never a 'glass' face or a flat tint) to get the same rendering as the sea. The shader renders water as water:
   - transparent according to its depth: the bottom is at bed m under the surface (the bottom of the basin you wade in, otherwise a given
     depth), the banks descend at slope from the edge (aRim: distance to the edge); along the refracted ray, the body of the water
     becomes opaque over vis m (Beer-Lambert), tinted from shallow to deep; so you see the real bottom (gravel, sand, slabs) where the water
     is thin, and the water blends into the bank instead of cutting off sharply;
   - Fresnel: rendered in premultiplied alpha, the water lets the bottom through for (1 - Fresnel) x (1 - opacity) and adds its reflection on top,
     so the reflection stays strong at grazing angles when you see the bottom looking down;
   - the scenery reflection (waterProbes): a cube map rendered at load around the water (trees, walls, bridge, palms), reprojected onto a
     box (parallax); failing that (puddles, wells, fragile device), the map's sky;
   - caustics: sunlight concentrated by the ripples draws a rippling network on the bottom (pattern of the "ripple"
     surface read at the bottom point the refracted ray hits, twice, at two scrolling scales), tightened and shifted by the
     undulations of the wave field (02mb-waves.js: a bump acts as a lens), off in shadow like the rest of the sunlight;
   - scrolling ripples, backlight through the water, foam fringe against the coping (shore), rings of a jet (jet).
   A puddle (shape 'blob') is the same water as a very thin, dark sheet (murk), without caustics or scenery reflection.
   One water = its own mesh and material (freed with the map); the 'ripple' texture must be listed in the map's `textures`.
   ========================================================================== */
const PONDS = [];
const PONDAREAS = []; // raised waters (fountains): surface where a shot makes a splash and ripples, under the basin's collision lid
const POND_VERT_HEAD = `#include <common>
attribute float aRim; varying float vRim; varying vec3 vPw;`;
const POND_FRAG_HEAD = `#include <common>
uniform float uPT, uPRing, uPFoam, uPAlpha, uPTone, uPBed, uPSlope, uPVis, uPMurk, uPCaus, uPCalm; uniform vec2 uPC, uPFlow; uniform vec3 uPDeep, uPShal, uPScat;
uniform vec4 uPProbe; uniform vec3 uPBoxA, uPBoxB; uniform sampler2D tPRip, tPFoam; uniform samplerCube tPRefl;
varying float vRim; varying vec3 vPw; vec3 pdN, pdUp, pdCL; float pdFoam, pdA, pdF, pdK;`;
const POND_COLOR = `{
  vec2 p = vPw.xz - uPFlow * uPT, t = vec2(uPT);
  vec3 r1 = texture2D(tPRip, p * 0.9 + t * vec2(0.03, 0.012)).xyz * 2.0 - 1.0;
  vec3 r2 = texture2D(tPRip, p.yx * 1.7 + t * vec2(-0.045, 0.05)).xyz * 2.0 - 1.0;
  vec3 r3 = texture2D(tPRip, p * 0.35 + t * vec2(0.01, -0.007)).xyz * 2.0 - 1.0;
  vec2 sl = (r1.xy / max(r1.z, 0.25) * 0.42 + r2.yx / max(r2.z, 0.25) * 0.3 + r3.xy / max(r3.z, 0.25) * 0.4) * uPCalm; // still water: weak ripples, clean reflection
  vec2 dv = vPw.xz - uPC; float rr = length(dv);
  float ring = uPRing * cos(rr * 15.0 - uPT * 3.4) * exp(-rr * 1.4) / (1.0 + rr * 2.0);
  sl += dv / max(rr, 1e-3) * ring * 0.8;
  vec2 rps; float rpf, rph, rpl; ripple(vPw.xz, rps, rpf, rph, rpl); // ripples from soldiers, shots and explosions (02mb-waves.js)
  pdN = normalize(vec3(sl.x * 0.5 + rps.x * uRipG, 1.0, sl.y * 0.5 + rps.y * uRipG));
  float pat = texture2D(tPFoam, p * 0.8 + t * vec2(0.008, 0.002)).a, pat2 = texture2D(tPFoam, p * 0.3 - t * vec2(0.003, 0.005)).a;
  float shore = (1.0 - smoothstep(0.0, 0.05 + pat2 * 0.09, vRim)) * uPFoam;
  pdFoam = clamp(max(shore * (pat * 1.5 - 0.1), rpf * 0.28 * (0.5 + pat)), 0.0, 0.4); // off the sea: no white, only the water lightening in the splash
  // depth under this point (flat bottom at uPBed, banks sloping uPSlope from the edge), refracted ray (air to water), path in the water
  vec3 V = normalize(cameraPosition - vPw), T = refract(-V, pdN, 0.75);
  float dep = min(uPBed, vRim * uPSlope), cosT = max(-T.y, 0.3), L = dep / cosT;
  // opacity of the water body: Beer-Lambert over uPVis m, a minimum for murky water (uPMurk), capped (uPAlpha), zero right at the edge
  pdA = clamp(max(1.0 - exp(-L / uPVis), uPMurk) * uPAlpha, 0.0, 1.0) * smoothstep(0.0, 0.03, vRim);
  // Fresnel of the water (Schlick, 0.03 head-on) on the rippled normal
  pdF = 0.03 + 0.97 * pow(1.0 - clamp(dot(V, pdN), 0.0, 1.0), 5.0);
  // caustics at the bottom point the refracted ray hits: two reads of the network scrolling in opposite directions, blended then
  // tightened; the curvature of the undulations concentrates them (a bump acts as a lens), they fade with depth
  vec2 bp = vPw.xz + T.xz / cosT * dep - uPFlow * uPT * 0.6;
  float c1 = texture2D(tPFoam, bp * 0.47 + t * vec2(0.019, 0.011)).r, c2 = texture2D(tPFoam, bp.yx * 0.39 - t * vec2(0.014, 0.022) + 0.37).r;
  float cn = (c1 + c2) * 0.5;
  pdK = cn * cn * 2.2 * clamp(1.0 - rpl * dep * 0.25, 0.5, 2.0) * uPCaus * smoothstep(0.0, 0.06, dep) * exp(-dep * 1.6 - dep / uPVis);
  pdCL = vec3(0.0); pdUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  vec3 body = mix(uPShal, uPDeep, pdA) * (0.9 + pat2 * 0.2) * uPTone;
  diffuseColor.rgb = mix(body, body * 3.0 + vec3(0.03, 0.04, 0.04), pdFoam * 2.0);
}`;
const POND_DIRECT = `#include <lights_physical_pars_fragment>
void RE_Direct_Pond( const in IncidentLight directLight, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
  RE_Direct_Physical( directLight, geometry, material, reflectedLight );
  float back = saturate( dot( geometry.viewDir, - directLight.direction ) );
  reflectedLight.directDiffuse += directLight.color * uPScat * ( pow( back, 4.0 ) * 0.5 + 0.05 ) * ( 1.0 - pdFoam );
  pdCL += directLight.color * saturate( dot( directLight.direction, pdUp ) ); // the light reaching the bottom (caustics), in shadow like the rest
}
#undef RE_Direct
#define RE_Direct RE_Direct_Pond`;
/* Reflection: the scenery cube map around the water, reprojected onto its box (the box point the reflected ray hits, seen from the probe),
   failing that the sky (ambience cube map, 01-core.js); without it (WebGL 1), three.js's reflection */
const POND_REFL = `#if defined( RE_IndirectDiffuse ) && defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
iblIrradiance += getIBLIrradiance( geometry.normal );
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
#ifdef POND_CUBE
{
  vec3 V = normalize(cameraPosition - vPw), R = reflect(-V, pdN); R.y = max(R.y, 0.015);
  vec3 dir = R;
  if (uPProbe.w > 0.5) { vec3 ta = (uPBoxB - vPw) / R, tb = (uPBoxA - vPw) / R, tf = max(ta, tb); dir = vPw + R * min(min(tf.x, tf.y), tf.z) - uPProbe.xyz; }
  radiance += textureLod(tPRefl, dir, uPProbe.w > 0.5 ? 0.7 : 0.0).rgb * envMapIntensity;
}
#else
radiance += getIBLRadiance( geometry.viewDir, geometry.normal, material.roughness );
#endif
#endif`;
/* Premultiplied alpha output: the bottom passes through for (1 - Fresnel) x (1 - opacity); added to it are the water body, the caustics on the bottom
   (bottom albedo taken as 0.45) and the reflection. Fog covers the water and the bottom seen through it in the same proportion. */
const POND_OUT = `float pdO = max(pdA, pdFoam * 2.0), pdT = (1.0 - pdF) * (1.0 - pdO);
gl_FragColor = vec4((totalDiffuse * pdO + pdCL * pdK * 0.045 * (1.0 - pdO)) * (1.0 - pdF) + totalSpecular + totalEmissiveRadiance, 1.0 - pdT);`;
const POND_FOG = `#ifdef USE_FOG
#ifdef FOG_EXP2
float fogFactor = fogPath( fogDensity * vFogDepth ); // fog thinned with altitude, sun glow (01-core.js)
#else
float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
#endif
gl_FragColor.rgb = mix( gl_FragColor.rgb, fogTint( fogColor ) * gl_FragColor.a, fogFactor );
#endif`;
function pondPatch(s, U) {
  Object.assign(s.uniforms, U, RIP.U);
  s.vertexShader = s.vertexShader.replace('#include <common>', POND_VERT_HEAD)
    .replace('#include <project_vertex>', '#include <project_vertex>\nvRim = aRim; vPw = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  s.fragmentShader = (ENVC.on ? '#define POND_CUBE\n' : '') + s.fragmentShader.replace('#include <common>', POND_FRAG_HEAD + RIP_GLSL).replace('#include <color_fragment>', POND_COLOR)
    .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(0.035, 0.7, pdFoam);')
    .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(pdN, 0.0)).xyz);')
    .replace('#include <lights_physical_pars_fragment>', POND_DIRECT).replace('#include <lights_fragment_maps>', POND_REFL)
    .replace('#include <output_fragment>', POND_OUT).replace('#include <fog_fragment>', POND_FOG);
}
/* Flat mesh of a water: local vertices around (0, 0, 0), distance to the edge (m) in aRim. disc: r, seg, rings;
   rect: w, d, n; blob: w, d, seed (irregular sheet) */
function pondGeometry(o) {
  const P = [], I = [], E = [];
  const rings = o.rings || 6, seg = o.seg || 24;
  if (o.shape === 'rect') {
    const nx = o.n || 8, nz = Math.max(2, Math.round(nx * o.d / o.w));
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const x = (i / nx - 0.5) * o.w, z = (j / nz - 0.5) * o.d;
      P.push(x, 0, z); E.push(Math.max(0, Math.min(o.w / 2 - Math.abs(x), o.d / 2 - Math.abs(z))));
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; I.push(a, c, b, b, c, d); }
  } else if (o.shape === 'poly') {
    // free outline (local points [x, z]): regular grid whose vertices outside the outline are pulled back onto it; aRim = distance to the edge
    const Q = o.poly, st = o.cell || 0.5; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const [x, z] of Q) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const nx = Math.ceil((x1 - x0) / st) + 1, nz = Math.ceil((z1 - z0) / st) + 1, sd = new Float32Array(nx * nz), idx = new Int32Array(nx * nz).fill(-1);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) sd[j * nx + i] = polyDist(Q, x0 + i * st, z0 + j * st);
    const vert = (i, j) => {
      const k = j * nx + i; if (idx[k] >= 0) return idx[k];
      let x = x0 + i * st, z = z0 + j * st, d = sd[k];
      if (d < 0) { const q = polyNearest(Q, x, z); x = q[0]; z = q[1]; d = 0; }
      P.push(x, 0, z); E.push(d); return (idx[k] = P.length / 3 - 1);
    };
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const c = [sd[j * nx + i], sd[j * nx + i + 1], sd[(j + 1) * nx + i], sd[(j + 1) * nx + i + 1]];
      if (Math.max(...c) <= 0) continue; // cell entirely outside
      const a = vert(i, j), b = vert(i + 1, j), cc = vert(i, j + 1), d = vert(i + 1, j + 1);
      I.push(a, cc, b, b, cc, d);
    }
  } else {
    const blob = o.shape === 'blob', R = rngOf((o.seed || 1) * 31 + 7), ph = [R() * TAU, R() * TAU, R() * TAU];
    const rx = blob ? o.w / 2 : o.r, rz = blob ? o.d / 2 : o.r, rmin = Math.min(rx, rz) * (blob ? 0.8 : 1);
    P.push(0, 0, 0); E.push(rmin);
    for (let k = 1; k <= rings; k++) {
      const f = k / rings;
      for (let i = 0; i < seg; i++) {
        const a = (i / seg) * TAU, wob = blob ? 1 + 0.16 * Math.sin(3 * a + ph[0]) + 0.1 * Math.sin(5 * a + ph[1]) + 0.05 * Math.sin(7 * a + ph[2]) : 1;
        P.push(Math.cos(a) * rx * f * wob, 0, Math.sin(a) * rz * f * wob); E.push((1 - f) * rmin * (blob ? 1 : 1) );
      }
    }
    for (let i = 0; i < seg; i++) I.push(0, 1 + (i + 1) % seg, 1 + i);
    for (let k = 1; k < rings; k++) for (let i = 0; i < seg; i++) {
      const a = 1 + (k - 1) * seg + i, b = 1 + (k - 1) * seg + (i + 1) % seg, c = 1 + k * seg + i, d = 1 + k * seg + (i + 1) % seg;
      I.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(P.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setAttribute('aRim', new THREE.Float32BufferAttribute(E, 1));
  g.setIndex(I); g.computeBoundingSphere();
  return g;
}
/* Places a water. o: shape ('disc': r, seg; 'rect': w, d; 'poly': outline; 'blob': w, d, seed), x, y, z (center, y = surface), rot;
   the water itself: bed (depth of the bottom under the surface, m; by default that of the basin you wade in, otherwise depth), slope (slope of the
   banks from the edge, 4 by default: a basin with coping; less for a natural bank), vis (distance over which the water becomes
   opaque, m), murk (minimum opacity: murky water, well), alpha (maximum opacity), deep / shallow / scatter (linear colors of the water
   body, from thin to thick, and of the light passing through it), tone (lightness of these colors, 0.2 by default), caus (strength of the
   caustics, 1), calm (strength of the ripples: 1, less for still water that reflects sharply); shore (foam fringe against the coping, 0 by default: off the sea, water has no foam), jet (rings of a jet at the
   center, 0 to 1), flow (current, m/s), wade (level of the bottom you wade on); scenery reflection: probe (false: the sky alone), probeAt
   (probe point), probeBox (parallax box [x0, y0, z0, x1, y1, z1]) */
function pondAdd(o) {
  rippleEnsure();
  // water you wade in (o.wade: bottom level, 0 for a stream laid on the ground): outline in world coordinates, before any recentering
  if (o.wade !== undefined) {
    let wp = null;
    if (o.shape === 'poly') wp = o.poly;
    else if (o.shape === 'rect') { const c = Math.cos(o.rot || 0), s = Math.sin(o.rot || 0); wp = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [o.x + (a * o.w / 2) * c - (b * o.d / 2) * s, o.z + (a * o.w / 2) * s + (b * o.d / 2) * c]); }
    if (wp) poolAdd(wp, o.wade, o.y);
  }
  if (o.shape === 'poly') { // the mesh is local, around the center of the outline's box
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of o.poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; o = Object.assign({}, o, { x: cx, z: cz, poly: o.poly.map(([x, z]) => [x - cx, z - cz]) });
  }
  const puddle = o.shape === 'blob', carved = o.wade !== undefined ? o.y - o.wade : 0;
  const bed = o.bed !== undefined ? o.bed : puddle ? 0.03 : carved > 0.1 ? carved : (o.depth || 0.5);
  // uPFoam: foam fringe at the edge, zero off the sea (o.shore to put one back)
  const U = {
    uPT: { value: 0 }, uPRing: { value: o.jet || 0 }, uPFoam: { value: o.shore || 0 }, uPAlpha: { value: o.alpha || 1 }, uPTone: { value: o.tone !== undefined ? o.tone : 0.2 },
    uPBed: { value: bed }, uPSlope: { value: o.slope || 4 }, uPVis: { value: o.vis || (puddle ? 0.2 : 0.7) }, uPMurk: { value: o.murk !== undefined ? o.murk : puddle ? 0.35 : 0 }, uPCaus: { value: o.caus !== undefined ? o.caus : puddle ? 0 : 1 }, uPCalm: { value: o.calm !== undefined ? o.calm : puddle ? 0.2 : 1 },
    uPC: { value: new THREE.Vector2(...(o.jc || [o.x, o.z])) }, uPFlow: { value: new THREE.Vector2(...(o.flow || [0, 0])) }, uPDeep: { value: new V3(...(o.deep || [0.006, 0.03, 0.04])) }, uPShal: { value: new V3(...(o.shallow || [0.025, 0.085, 0.09])) },
    uPScat: { value: new V3(...(o.scatter || [0.008, 0.04, 0.04])) }, tPRip: { value: TEX.ripple.normal }, tPFoam: { value: TEX.ripple.map },
    tPRefl: { value: null }, uPProbe: { value: new THREE.Vector4(0, 0, 0, 0) }, uPBoxA: { value: new V3() }, uPBoxB: { value: new V3() },
  };
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0, envMapIntensity: puddle ? 1.1 : 0.62 });
  m.defines = { POND: '' };
  m.userData.patch = (s) => pondPatch(s, U); m.onBeforeCompile = m.userData.patch;
  m.userData.noShadow = true; m.userData.noAO = true;
  // premultiplied alpha (see POND_OUT); drawn before the other transparent objects (splashes, smoke: over the water)
  Object.assign(m, { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
  if (puddle) { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; }
  const geo = pondGeometry(o), mesh = new THREE.Mesh(geo, m);
  mesh.name = 'map:pond'; mesh.position.set(o.x, o.y, o.z); mesh.rotation.y = o.rot || 0; mesh.castShadow = false; mesh.receiveShadow = true; mesh.renderOrder = -1;
  mesh.userData.noPrepass = true; mesh.userData.noAO = true;
  mesh.updateMatrix(); mesh.matrixAutoUpdate = false;
  geo.computeBoundingBox(); const wb = geo.boundingBox.clone().applyMatrix4(mesh.matrix);
  mapAdd(mesh);
  PONDS.push({ U, mesh, y: o.y, b: [wb.min.x, wb.min.z, wb.max.x, wb.max.z], probe: o.probe !== undefined ? o.probe : !puddle && !(o.murk >= 1), at: o.probeAt, box: o.probeBox });
  if (o.wade === undefined && o.y > 0.3) { // fountain: the basin is full of collision (you can't enter it), but a shot that lands in it hits the water
    const c = Math.cos(o.rot || 0), s = Math.sin(o.rot || 0);
    let inside;
    if (o.shape === 'disc') { const r = o.r * 0.97; inside = (x, z) => (x - o.x) * (x - o.x) + (z - o.z) * (z - o.z) < r * r; }
    else if (o.shape === 'rect') inside = (x, z) => { const dx = x - o.x, dz = z - o.z, lx = dx * c + dz * s, lz = -dx * s + dz * c; return Math.abs(lx) < o.w / 2 && Math.abs(lz) < o.d / 2; };
    else inside = (x, z) => { const poly = o.poly.map(([a, b]) => [a + o.x, b + o.z]); let n = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if ((poly[i][1] > z) !== (poly[j][1] > z) && x < ((poly[j][0] - poly[i][0]) * (z - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0]) n = !n; return n; };
    PONDAREAS.push({ y: o.y, inside });
  }
  if (o.jet > 0) AMBW.push({ x: o.jc ? o.jc[0] : o.x, y: o.y, z: o.jc ? o.jc[1] : o.z }); // fountain: ambience sound source (05c-ambiance.js)
  if (o.jet > 0) rippleSource(o.jc ? o.jc[0] : o.x, o.jc ? o.jc[1] : o.z, 0.26 + 0.1 * o.jet, -0.034 * o.jet, 0.24, 0.3); // the jet constantly digs into the basin water
  return mesh;
}

/* ---------- Scenery reflections in small waters ----------
   One cube map per group of neighboring waters (a fountain and its basin, a canal, a pond), rendered only once at map load,
   after shader compilation (mapCompile), with a GPU barrier in between: the scenery seen from a point at water level, with its shadows
   (the cascades are recentered on the probe), without the water itself or the soldiers, the sun disc removed (it is already reflected by the
   direct light). The shader reprojects the reflection onto a box around the water and its scenery (parallax: a tree on the bank is reflected at the
   foot of the tree). The probe is placed 1.1 m above the water (above water lilies and copings), off the middle (the
   column of a fountain), or at probeAt (above the ferns of a stream, an island). 64 pixels on phones, 128
   elsewhere; at most 6 or 12 probes, the largest waters first; skipped on a device that lost its context at this step
   (GPUX.lean.probe): the water keeps the sky reflection. */
const WPROBES = [];
async function waterProbes() {
  if (!ENVC.on || GPUX.lean.probe || !PONDS.some((q) => q.probe)) return;
  const groups = [];
  for (const q of PONDS) {
    if (!q.probe) continue;
    const g = !q.at && groups.find((e) => !e.at && q.b[0] < e.b[2] + 3 && q.b[2] > e.b[0] - 3 && q.b[1] < e.b[3] + 3 && q.b[3] > e.b[1] - 3);
    if (g) { g.ponds.push(q); g.b = [Math.min(g.b[0], q.b[0]), Math.min(g.b[1], q.b[1]), Math.max(g.b[2], q.b[2]), Math.max(g.b[3], q.b[3])]; g.y = Math.min(g.y, q.y); }
    else groups.push({ ponds: [q], b: q.b.slice(), y: q.y, at: q.at, box: q.box });
  }
  const area = (g) => (g.b[2] - g.b[0]) * (g.b[3] - g.b[1]);
  groups.sort((a, b) => area(b) - area(a)); groups.length = Math.min(groups.length, COARSE || GFX_SAFE || ULTRA ? 6 : 12);
  const size = COARSE || GFX_SAFE || ULTRA ? 64 : 128, mask = camera.layers.mask;
  const saved = { p: camera.position.clone(), r: camera.rotation.clone(), dust: FX.dust.visible, sp: sky.position.clone(), disk: SkyShader.uniforms.uDisk.value.clone(), ac: renderer.autoClear };
  const hidden = PONDS.map((q) => q.mesh).concat(WATER.mesh ? [WATER.mesh] : []).concat(MAPL.root ? MAPL.root.children.filter((o) => o.userData.weather) : []).concat(entities.map((e) => e.model.root));
  const vis = hidden.map((o) => o.visible);
  try {
    for (const o of hidden) o.visible = false;
    FX.dust.visible = false; SkyShader.uniforms.uDisk.value.set(0, 0, 0); renderer.autoClear = true;
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i], hx = (g.b[2] - g.b[0]) / 2, hz = (g.b[3] - g.b[1]) / 2;
      const c = g.at ? new V3(...g.at) : new V3(g.b[0] + hx * 1.45, g.y + 1.1, g.b[1] + hz * 1.45);
      const B = g.box || [g.b[0] - 6, g.y - 1, g.b[1] - 6, g.b[2] + 6, g.y + 12, g.b[3] + 6];
      const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
      WPROBES.push(rt);
      const cc = new THREE.CubeCamera(0.05, 600, rt); cc.position.copy(c); cc.updateMatrixWorld(true);
      for (const k of cc.children) k.layers.mask = mask;
      // shadows: cascades recentered on the probe (plunging camera above it), recomputed on first render
      camera.position.set(c.x, c.y + 30, c.z); camera.rotation.set(-Math.PI / 2, 0, 0); updateShadows();
      if (csm) for (const l of csm.lights) l.shadow.needsUpdate = true;
      renderer.shadowMap.needsUpdate = true;
      sky.position.copy(c); sky.updateMatrixWorld();
      cc.update(renderer, scene);
      for (const q of g.ponds) {
        q.U.tPRefl.value = rt.texture; q.U.uPProbe.value.set(c.x, c.y, c.z, 1); q.U.uPBoxA.value.set(B[0], B[1], B[2]); q.U.uPBoxB.value.set(B[3], B[4], B[5]);
        q.mesh.material.envMapIntensity = 1;
      }
      await gpuBarrier('probes ' + (i + 1) + '/' + groups.length);
    }
  } finally {
    hidden.forEach((o, k) => { o.visible = vis[k]; });
    FX.dust.visible = saved.dust; SkyShader.uniforms.uDisk.value.copy(saved.disk); sky.position.copy(saved.sp); sky.updateMatrixWorld(); renderer.autoClear = saved.ac;
    renderer.setRenderTarget(null);
    camera.position.copy(saved.p); camera.rotation.copy(saved.r); updateShadows();
    if (csm) for (const l of csm.lights) l.shadow.needsUpdate = true;
  }
}
/* Surface of a fountain hit by an impact point (above the water, below the edge): water y, otherwise null */
function pondHitAt(p) {
  for (const a of PONDAREAS) if (p.y > a.y - 0.1 && p.y < a.y + 0.6 && a.inside(p.x, p.z)) return a.y;
  return null;
}
// a water without a probe reflects the map's sky: its cube map only exists after the map lighting (mapEnvironment), well after pondAdd
function pondUpdate(t) { for (const q of PONDS) { q.U.uPT.value = t; if (q.U.uPProbe.value.w < 0.5) q.U.tPRefl.value = ENVC.gloss.value; } }

/* ---------- Splashes ---------- */
/* Bullet impact in water: falling droplets, column of drizzle, veil */
function waterSplashFx(p, big) {
  const sea = WATER.on && waterAt(p.x, p.z), y = (sea ? WATER.y + waterHeight(p.x, p.z, WATER.t) : p.y) + 0.02, k = big ? 1.4 : 1;
  rippleAdd(p.x, p.z, big ? 0.55 : 0.36, big ? -0.34 : -0.17, big ? 0.38 : 0.24); // the shot digs into the water: rings and foam spray (02mb-waves.js)
  for (let i = 0; i < (big ? 14 : 9); i++) FX.smoke.spawn(p.x, y, p.z, rand(-0.9, 0.9) * k, rand(2.2, 4.6) * k, rand(-0.9, 0.9) * k, rand(0.45, 0.8), 0.05 * k, 0.035 * k, 0.82, 0.87, 0.9, 0.95, 0.3, 9.8, 0.4);
  FX.smoke.spawn(p.x, y + 0.05, p.z, 0, 1.5 * k, 0, 0.6, 0.18 * k, 0.7 * k, 0.86, 0.9, 0.93, 0.6, 0, 1.2, 1.4, rand(-1, 1));
  FX.smoke.spawn(p.x, y, p.z, 0, 0.25, 0, 1.1, 0.35 * k, 1.2 * k, 0.8, 0.85, 0.88, 0.32, 0, 0, 0.8, rand(-1, 1));
}
/* Grenade falling into the water (k = 0.6) or exploding under the surface (k = 1): high splash, curtain of droplets, spray */
function waterBlastFx(p, k = 1) {
  const sea = WATER.on && waterAt(p.x, p.z), y = (sea ? WATER.y + waterHeight(p.x, p.z, WATER.t) : (waterSurfaceAt(p.x, p.z) || p.y)) + 0.02;
  rippleAdd(p.x, p.z, 1.3 * k, -0.5 * k, 1); rippleAdd(p.x, p.z, 0.6 * k, -0.3 * k, 1); // shock wave: a large circle and a heart of foam
  for (let i = 0; i < 46 * k; i++) { const a = rand(0, TAU), r = rand(0, 2.2) * k; FX.smoke.spawn(p.x, y, p.z, Math.cos(a) * r, rand(5, 13) * k, Math.sin(a) * r, rand(0.9, 1.6), rand(0.08, 0.14) * k, rand(0.06, 0.1), 0.84, 0.88, 0.9, 0.95, 0.3, 9.8, 0.3); }
  for (let i = 0; i < 10 * k; i++) FX.smoke.spawn(p.x + rand(-0.6, 0.6), y + rand(0, 1.5) * k, p.z + rand(-0.6, 0.6), rand(-1, 1), rand(3, 8) * k, rand(-1, 1), rand(1.2, 2.2), rand(0.6, 1.1) * k, rand(2, 3.5) * k, 0.88, 0.91, 0.94, 0.55, 0, 2.5, 1.0, rand(-0.5, 0.5));
  for (let i = 0; i < 8 * k; i++) { const a = rand(0, TAU); FX.smoke.spawn(p.x, y + 0.1, p.z, Math.cos(a) * rand(2, 4) * k, 0.3, Math.sin(a) * rand(2, 4) * k, rand(1.4, 2.4), 0.6 * k, 2.2 * k, 0.8, 0.84, 0.87, 0.4, 0, 0, 1.2, rand(-0.5, 0.5)); }
}
