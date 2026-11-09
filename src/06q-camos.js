/* ==========================================================================
   CAMOUFLAGES
   Ten procedural camouflages drawn on first use on a tileable 256-pixel 2D canvas (one fixed seed per
   camouflage), applied to the metal, polymer and trim of the weapon by a triplanar blend in the weapon
   frame: the pattern keeps the same scale on every piece, large or tiny, and on the weapon
   in hand as on a soldier's weapon. Dark pieces (rails, barrel, optics) keep their tint.
   A camouflage is unlocked by weapon level tiers (lvl), with no other condition (owner's choice: Gold also required
   30 headshots, Diamond 250 kills, Holo required Diamond); the unlock state is in 06r-arsenal.js.
   Holo: a holographic foil. Its canvas only carries a field of folds in grayscale; the shader derives from it a pastel
   iridescent tint (cyan, lilac, pink, pearly white, mint) that follows the view angle and the reflection direction, like a thin
   film: the color slides over the weapon as it moves, and drifts slowly with time. What makes it shine (owner
   feedback: the first version looked matte): a polished metal that reflects the scenery in this tint, crisp light bands along the folds that slide with the gaze (bright enough for the bloom),
   a light rim on the edges and
   glitter that lights up depending on the angle (not on Low quality: below the pixel, it would flicker). Same program
   as the other camouflages (uHolo), no extra texture.
   ========================================================================== */
const CAMOS = {
  desert: { name: _t('Desert'), lvl: 3, seed: 11 },
  forest: { name: _t('Forest'), lvl: 5, seed: 23 },
  urban: { name: _t('Urban'), lvl: 7, seed: 37 },
  snowy: { name: _t('Snow'), lvl: 9, seed: 41 },
  tiger: { name: _t('Tiger'), lvl: 11, seed: 53 },
  cobalt: { name: _t('Cobalt'), lvl: 13, seed: 67 },
  ember: { name: _t('Ember'), lvl: 15, seed: 71 },
  or: { name: 'Gold', lvl: 18, seed: 83, metal: 0.95, rough: 0.28 },
  diamond: { name: _t('Diamond'), lvl: 20, seed: 97, metal: 0.85, rough: 0.16 },
  holo: { name: 'Holo', lvl: 30, seed: 101, metal: 1, rough: 0.1, scale: 0.24 },
};
for (const id in CAMOS) CAMOS[id].id = id;
const CAMO_N = 256;
/* Draws fn at the nine neighboring positions: what overflows an edge reappears on the opposite side (tileable pattern) */
function camoWrap(g, fn) { for (const dx of [-CAMO_N, 0, CAMO_N]) for (const dy of [-CAMO_N, 0, CAMO_N]) { g.save(); g.translate(dx, dy); fn(); g.restore(); } }
/* Irregular blotch centered at (x, y), optionally elongated (sq) and rotated (ang) */
function camoBlob(g, rnd, x, y, r, col, sq = 1, ang = 0) {
  camoWrap(g, () => {
    g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = col; g.beginPath();
    for (let i = 0; i < 11; i++) { const a = i / 11 * TAU, rr = r * (0.55 + rnd() * 0.75), px = Math.cos(a) * rr, py = Math.sin(a) * rr * sq; if (i) g.lineTo(px, py); else g.moveTo(px, py); }
    g.closePath(); g.fill(); g.restore();
  });
}
/* Pixelated pattern: a tileable value noise chooses the color of each cell */
function camoDigital(g, rnd, cols, cell) {
  const L = 12, lat = Array.from({ length: L * L }, () => rnd());
  const v = (x, y) => {
    x = x / CAMO_N * L; y = y / CAMO_N * L; const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = lat[(yi % L) * L + (xi % L)], b = lat[(yi % L) * L + ((xi + 1) % L)], c = lat[(((yi + 1) % L)) * L + (xi % L)], d = lat[((yi + 1) % L) * L + ((xi + 1) % L)];
    return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
  };
  for (let y = 0; y < CAMO_N; y += cell) for (let x = 0; x < CAMO_N; x += cell) {
    const k = Math.floor((v(x + cell / 2, y + cell / 2) * 1.5 - 0.25 + (rnd() - 0.5) * 0.5) * cols.length);
    g.fillStyle = cols[Math.max(0, Math.min(cols.length - 1, k))]; g.fillRect(x, y, cell, cell);
  }
}
const CAMO_DRAW = {
  desert: (g, rnd) => {
    for (let i = 0; i < 46; i++) camoBlob(g, rnd, rnd() * CAMO_N, rnd() * CAMO_N, 16 + rnd() * 26, ['#d6c08a', '#8a6a3e', '#a58a52'][i % 3], 0.6 + rnd() * 0.4, rnd() * TAU);
    for (let i = 0; i < 26; i++) camoBlob(g, rnd, rnd() * CAMO_N, rnd() * CAMO_N, 5 + rnd() * 9, '#5e4d2e', 0.5 + rnd() * 0.5, rnd() * TAU);
  },
  forest: (g, rnd) => {
    for (let i = 0; i < 52; i++) camoBlob(g, rnd, rnd() * CAMO_N, rnd() * CAMO_N, 14 + rnd() * 24, ['#2c3a1e', '#6b5b36', '#7d8a4a', '#1b1f14'][i % 4], 0.55 + rnd() * 0.45, rnd() * TAU);
    for (let i = 0; i < 24; i++) camoBlob(g, rnd, rnd() * CAMO_N, rnd() * CAMO_N, 4 + rnd() * 7, '#0f120c', 0.6, rnd() * TAU);
  },
  urban: (g, rnd) => camoDigital(g, rnd, ['#3b3d40', '#5a5d60', '#7a7d80', '#9a9da0', '#b5b8bb'], 8),
  snowy: (g, rnd) => {
    for (let i = 0; i < 90; i++) camoBlob(g, rnd, rnd() * CAMO_N, rnd() * CAMO_N, 10 + rnd() * 24, ['#aab4bd', '#c9d1d8', '#7d8a96', '#d9dee3'][i % 4], 0.22 + rnd() * 0.2, (rnd() < 0.5 ? 0.45 : -0.45) + (rnd() - 0.5) * 0.4);
  },
  tiger: (g, rnd) => {
    for (let i = 0; i < 20; i++) camoBlob(g, rnd, rnd() * CAMO_N, rnd() * CAMO_N, 14 + rnd() * 20, i % 2 ? '#e0a04a' : '#8f4d1a', 0.5, rnd() * TAU);
    for (let i = 0; i < 17; i++) {
      const x0 = (i + rnd() * 0.5) * CAMO_N / 17, w = 5 + rnd() * 9, ph = rnd() * TAU, amp = 6 + rnd() * 10;
      camoWrap(g, () => {
        g.fillStyle = '#16110c'; g.beginPath();
        const L = [], R = [];
        for (let y = -8; y <= CAMO_N + 8; y += 4) { const cx = x0 + Math.sin(y * 0.045 + ph) * amp + Math.sin(y * 0.11 + ph * 2) * amp * 0.35, ww = w * (0.35 + 0.65 * Math.abs(Math.sin(y * 0.03 + ph))); L.push([cx - ww, y]); R.push([cx + ww, y]); }
        L.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); R.reverse().forEach(([x, y]) => g.lineTo(x, y)); g.closePath(); g.fill();
      });
    }
  },
  cobalt: (g, rnd) => camoDigital(g, rnd, ['#0a1020', '#14264a', '#1c3768', '#2f5fb0', '#4b86d8'], 6),
  ember: (g, rnd) => {
    for (let i = 0; i < 30; i++) camoBlob(g, rnd, rnd() * CAMO_N, rnd() * CAMO_N, 10 + rnd() * 22, i % 2 ? '#22171a' : '#0c0808', 0.7, rnd() * TAU);
    for (let k = 0; k < 24; k++) {
      let x = rnd() * CAMO_N, y = rnd() * CAMO_N, a = rnd() * TAU; const pts = [[x, y]];
      for (let s = 0; s < 6 + Math.floor(rnd() * 8); s++) { a += (rnd() - 0.5) * 1.5; x += Math.cos(a) * (8 + rnd() * 14); y += Math.sin(a) * (8 + rnd() * 14); pts.push([x, y]); }
      for (const [col, wd] of [['#b32a0c', 4.5], ['#ff6a1f', 2.6], ['#ffd57a', 1.1]]) camoWrap(g, () => { g.strokeStyle = col; g.lineWidth = wd; g.lineCap = g.lineJoin = 'round'; g.beginPath(); pts.forEach(([px, py], j) => (j ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke(); });
    }
  },
  or: (g, rnd) => {
    for (let i = 0; i < 2600; i++) { g.fillStyle = i % 2 ? 'rgba(255,232,150,0.16)' : 'rgba(110,72,0,0.14)'; g.fillRect(rnd() * CAMO_N, rnd() * CAMO_N, 1 + rnd() * 3, 1 + rnd() * 2); }
    for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(255,245,190,0.07)'; g.fillRect(rnd() * CAMO_N, 0, 1 + rnd() * 2, CAMO_N); }
  },
  diamond: (g, rnd) => {
    const cell = 32, cols = ['#8fc5f0', '#bfe3ff', '#e6f6ff', '#6ea8d8', '#a8d4f5'];
    for (let y = 0; y < CAMO_N; y += cell) for (let x = 0; x < CAMO_N; x += cell) for (const flip of [0, 1]) {
      g.fillStyle = cols[Math.floor(rnd() * cols.length)]; g.beginPath();
      if (flip) { g.moveTo(x + cell, y); g.lineTo(x + cell, y + cell); g.lineTo(x, y + cell); } else { g.moveTo(x, y); g.lineTo(x + cell, y); g.lineTo(x, y + cell); }
      g.closePath(); g.fill();
    }
    for (let i = 0; i < 70; i++) { g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(rnd() * CAMO_N, rnd() * CAMO_N, 1.5, 1.5); }
  },
  // folds of the foil: waves of integer frequencies (tileable) in a domain warped by other waves, long soft bands
  holo: (g, rnd) => {
    const N = CAMO_N, W = [], img = g.createImageData(N, N), p = [0, 1, 2, 3].map(() => rnd() * TAU);
    for (let i = 0; i < 4; i++) W.push([1 + Math.floor(rnd() * 2), Math.floor(rnd() * 3) - 1, rnd() * TAU, 0.6 + rnd() * 0.4]);
    const A = W.reduce((s, w) => s + w[3], 0);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / N * TAU, v = y / N * TAU, wu = u + 0.9 * Math.sin(2 * v + p[0]) + 0.5 * Math.sin(u + v + p[1]), wv = v + 0.9 * Math.sin(2 * u + p[2]) + 0.5 * Math.sin(u - v + p[3]);
      let f = 0; for (const [kx, ky, ph, a] of W) f += a * Math.sin(kx * wu + ky * wv + ph);
      const c = Math.round((f / A * 0.5 + 0.5) * 255), k = (y * N + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = c; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  },
};
/* Tints of the holographic foil, cycled through (holoColor here for the menu thumbnail, HOLO_GLSL in the shader) */
const HOLO_COLS = [[0.5, 0.95, 1], [0.72, 0.64, 1], [1, 0.62, 0.92], [0.95, 0.96, 1], [0.62, 1, 0.86]];
function holoColor(t) {
  const n = HOLO_COLS.length, u = (t - Math.floor(t)) * n, i = Math.floor(u) % n, f = u - Math.floor(u), s = f * f * (3 - 2 * f), a = HOLO_COLS[i], b = HOLO_COLS[(i + 1) % n];
  return a.map((v, k) => v + (b[k] - v) * s);
}
const HOLO_GLSL = `vec3 holoColor(float t) {
  float u = fract(t) * ${HOLO_COLS.length}.0, s = smoothstep(0.0, 1.0, fract(u));
  ${HOLO_COLS.map((c, i) => `${i ? 'else ' : ''}if (u < ${i + 1}.0) return mix(vec3(${c.join(', ')}), vec3(${HOLO_COLS[(i + 1) % HOLO_COLS.length].join(', ')}), s);`).join('\n  ')}
  return vec3(1.0);
}`;
/* Holo tint at a point: folds (0 to 1), view angle (1 - |n.v|, 0 face-on), position in the weapon; same formula as the shader */
const holoPhase = (fold, rim, x, y, z) => fold * 0.85 + rim * 0.9 + x * 0.6 + y * 1.2 + z * 1.4;
const CAMO_BASE = { desert: '#b89a64', forest: '#4a5a30', urban: '#7a7d80', snowy: '#e8ecef', tiger: '#c77a2d', cobalt: '#0f1b33', ember: '#151012', or: '#c9a02c', diamond: '#bfe3ff', holo: '#808080' };
const CAMO_CANVAS = {}, CAMO_TEX = {}, CAMO_MATS = {};
function camoCanvas(id) {
  if (CAMO_CANVAS[id]) return CAMO_CANVAS[id];
  const cv = document.createElement('canvas'); cv.width = cv.height = CAMO_N;
  const g = cv.getContext('2d'); g.fillStyle = CAMO_BASE[id]; g.fillRect(0, 0, CAMO_N, CAMO_N);
  CAMO_DRAW[id](g, dspRng(CAMOS[id].seed * 7919));
  return (CAMO_CANVAS[id] = cv);
}
function camoTexture(id) {
  if (!CAMO_TEX[id]) { const t = new THREE.CanvasTexture(camoCanvas(id)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; CAMO_TEX[id] = t; }
  return CAMO_TEX[id];
}
/* Menu thumbnail: the reduced pattern, as an image (the Holo, its folds run through its tints, seen face-on) */
const CAMO_SWATCH = {};
function camoSwatch(id) {
  if (!CAMO_SWATCH[id]) {
    const c = document.createElement('canvas'), g = c.getContext('2d'); c.width = c.height = 64; g.drawImage(camoCanvas(id), 0, 0, 64, 64);
    if (id === 'holo') {
      const d = g.getImageData(0, 0, 64, 64);
      for (let k = 0; k < 64 * 64; k++) { const col = holoColor(holoPhase(d.data[k * 4] / 255, 0.25, 0, -(k >> 6) / 64 * 0.12, (k & 63) / 64 * 0.12)); for (let j = 0; j < 3; j++) d.data[k * 4 + j] = Math.round(col[j] * 255); }
      g.putImageData(d, 0, 0);
    }
    CAMO_SWATCH[id] = c.toDataURL('image/png');
  }
  return CAMO_SWATCH[id];
}
/* Shader patch: the color comes from the pattern, read on three planes according to the normal (weapon frame, no UV). The Holo
   (uHolo): thin-film tint according to the folds, view angle and reflection direction (view frame: it slides when
   you move) and time; polished metal that reflects in this tint, crisp light bands along the folds (band), edge
   rim (rim), glitter (spark); CAMO_U: time and glitter (0 on Low quality), updated every frame (frame,
   09-game.js). A single program for all camouflages */
const CAMO_U = { uCamoT: { value: 0 }, uHoloFx: { value: 1 } };
function camoPatch(m, id) {
  m.onBeforeCompile = (shader) => {
    envCubeHook(shader);
    shader.uniforms.uCamo = { value: camoTexture(id) }; shader.uniforms.uCamoK = { value: 1 / (CAMOS[id].scale || 0.17) };
    shader.uniforms.uHolo = { value: id === 'holo' ? 1 : 0 }; shader.uniforms.uCamoT = CAMO_U.uCamoT; shader.uniforms.uHoloFx = CAMO_U.uHoloFx;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCamoP;\nvarying vec3 vCamoN;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvCamoP = position; vCamoN = normal;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
uniform sampler2D uCamo; uniform float uCamoK; uniform float uHolo; uniform float uCamoT; uniform float uHoloFx; varying vec3 vCamoP; varying vec3 vCamoN; vec3 camoGlow = vec3(0.0);
vec3 camoTri() {
  vec3 w = pow(abs(normalize(vCamoN)), vec3(5.0)); w /= (w.x + w.y + w.z);
  vec3 p = vCamoP * uCamoK;
  return texture2D(uCamo, p.zy).rgb * w.x + texture2D(uCamo, p.xz).rgb * w.y + texture2D(uCamo, p.xy).rgb * w.z;
}
${HOLO_GLSL}`).replace('#include <map_fragment>', `#include <map_fragment>
  {
    vec3 cc = camoTri();
    if (uHolo > 0.5) {
      vec3 hN = normalize(vNormal), hV = normalize(vViewPosition), hR = reflect(-hV, hN);
      float rim = 1.0 - clamp(dot(hN, hV), 0.0, 1.0), fold = cc.r;
      vec3 hc = pow(holoColor(fold * 0.7 + rim * 1.1 + hR.x * 0.55 + hR.y * 0.75 + dot(vCamoP, vec3(0.6, 1.2, 1.4)) + uCamoT * 0.025), vec3(2.2));
      diffuseColor.rgb = hc;
      float band = pow(0.5 + 0.5 * sin((hR.y * 2.6 + hR.x * 1.3 + fold * 1.6) * 6.2832 + uCamoT * 0.35), 14.0);
      vec3 cq = vCamoP * 380.0, cf = fract(cq) - 0.5;
      float hs = fract(sin(dot(floor(cq), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      float spark = step(0.97, hs) * smoothstep(0.42, 0.1, length(cf)) * pow(max(0.0, sin(hs * 91.0 + dot(hR, vec3(23.0, 31.0, 17.0)) + uCamoT * 1.5)), 12.0) * uHoloFx;
      camoGlow = (hc + 0.12) * (0.06 + rim * rim * rim * 0.55 + band * 1.7) + vec3(spark * 3.5);
    } else diffuseColor.rgb = pow(cc, vec3(2.2)) * 0.74;
  }`).replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += camoGlow;');
    if (m.userData.gunU) gunSurfPatch(shader, m.userData.gunU); // weapon in hand: paint wear (06-weapons.js)
  };
  const key = m.userData.gunU ? 'camo-wear' : 'camo'; // the weapon in hand has wear, the soldiers' do not: two programs
  m.customProgramCacheKey = () => key;
  m.userData.camo = id;
  return m;
}
/* First-person materials: those of the weapon, except the metal, polymer and trim, painted */
function camoMaterials(id) {
  const M = gunMaterials();
  if (!id) return M;
  if (!CAMO_MATS[id]) {
    const C = CAMOS[id], o = {};
    for (const k of ['metal', 'steel', 'poly', 'olive', 'tan', 'wood', 'woodR', 'woodB', 'taupe', 'gray', 'blued', 'polyM', 'fde', 'drab']) {
      const m = M[k].clone(); m.color.set(0xffffff);
      const met = k === 'metal' || k === 'steel';
      m.metalness = C.metal != null ? C.metal : met ? 0.4 : 0.08; m.roughness = C.rough != null ? C.rough : met ? 0.5 : 0.66;
      o[k] = camoPatch(gunWear(m, 'camo'), id); // (the copy has wear uniforms copied as plain objects: redone here)
    }
    CAMO_MATS[id] = Object.assign(Object.create(M), o);
  }
  return CAMO_MATS[id];
}
/* Material of the weapon seen from outside (soldiers, ground weapons) */
const CAMO_WORLD = {};
function camoWorldMaterial(id) {
  if (!CAMO_WORLD[id]) { const C = CAMOS[id]; CAMO_WORLD[id] = camoPatch(new THREE.MeshStandardMaterial({ roughness: C.rough != null ? C.rough : 0.62, metalness: C.metal != null ? C.metal : 0.2 }), id); }
  return CAMO_WORLD[id];
}
