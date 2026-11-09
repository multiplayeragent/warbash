/* ==========================================================================
   OUTFIT ATLAS: one color texture, one relief texture and one roughness / metal texture
   shared by the soldiers and the first-person arms. Each zone of the atlas has a role:
     camouflage (tileable both ways, at the real scale of the fabric), glove fabric, MOLLE
     straps, face, rubber; and a column of plain tiles that carry only the roughness and the
     metal of a material (the color then comes from the vertex colors).
   One color texture per outfit (SKINS, 06ga-outfits.js): only the camouflage changes from one outfit to another. Relief
   and roughness are shared. The red channel of the roughness / metal texture, unused by three.js, marks the "tag" tile
   (recognition bands): the material patch puts the ally or enemy color there (skinTagPatch); at half value,
   it marks the "glow" tile (neons of the challenge outfits), which lights with its vertex color.
   The "art" zone (below the tiles) carries the emblem specific to an outfit (cape, jacket panels: SKINS.<id>.art).
   Everything is generated at load time, with no external image. A single-draw-call mesh can thus
   mix canvas, nylon, polymer, rubber, metal, skin and glass.
   ========================================================================== */
const ATLAS_N = 1024;
/* zones [x, y, width, height] in canvas pixels (y downward) */
const ATLAS_R = { camo: [0, 0, 768, 768], glove: [0, 768, 256, 128], leath: [0, 896, 256, 128], web: [256, 768, 256, 256], face: [512, 768, 256, 256], misc: [768, 768, 256, 256], art: [768, 384, 256, 384] };
/* plain tiles: name, roughness, metal (4 columns of 64 px in the band x 768 to 1024) */
const GEAR_TILES = [
  ['fab', 0.94, 0], ['nyl', 0.78, 0], ['poly', 0.52, 0.04], ['rub', 0.88, 0],
  ['met', 0.34, 0.92], ['metD', 0.52, 0.7], ['skin', 0.56, 0], ['lens', 0.05, 0.55],
  ['leat', 0.62, 0], ['paint', 0.72, 0.03], ['gloss', 0.28, 0], ['hair', 0.9, 0],
  ['plate', 0.66, 0.02], ['brass', 0.28, 1], ['eye', 0.12, 0], ['lip', 0.42, 0],
  ['tag', 0.6, 0], ['glow', 0.45, 0],
];
const GEAR_TILE = {};
/* centered value noise (-0.5 to 0.5), periodic with period p (tileable patterns) */
function noise2(seed) { const n = makeNoise(seed); return (x, y, p = 256) => n(x, y, p, p) - 0.5; }
GEAR_TILES.forEach(([n], i) => { GEAR_TILE[n] = [(768 + (i % 4) * 64 + 32) / ATLAS_N, 1 - (Math.floor(i / 4) * 64 + 32) / ATLAS_N]; });
/* texture coordinates within a zone (s, t from 0 to 1, 3 px border to avoid bleeding) */
function atlasUV(reg, s, t) {
  const r = ATLAS_R[reg];
  return [(r[0] + 3 + clamp(s, 0, 1) * (r[2] - 6)) / ATLAS_N, 1 - (r[1] + 3 + clamp(t, 0, 1) * (r[3] - 6)) / ATLAS_N];
}
/* Camouflage coordinates at real scale: phys is the size (m) of the zone; s0, t0 offset the pattern. A
   piece larger than the zone is cut by a seam, like a garment sewn from several panels. */
function camoUV(x, y, phys, s0 = 0, t0 = 0) {
  const s = x / phys + s0, t = y / phys + t0;
  return atlasUV('camo', s - Math.floor(s), t - Math.floor(t));
}

/* Tileable drawing canvas: each shape is also drawn on the other side of the edges */
function wrapShape(g, W, H, x, y, rad, fn) {
  for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) {
    if (x + dx + rad < 0 || x + dx - rad > W || y + dy + rad < 0 || y + dy - rad > H) continue;
    fn(x + dx, y + dy);
  }
}
/* Organic shape: lobed outline (sum of sinusoids) and jagged edge (per-vertex noise), stretched and rotated */
function camoShape(g, x, y, r, R, stretch, rot, rag = 0.25) {
  const n = 24, ph = [R() * TAU, R() * TAU, R() * TAU], am = [0.22 + R() * 0.2, 0.12 + R() * 0.1, 0.06 + R() * 0.05], pts = [];
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let k = 0; k < n; k++) {
    const a = k / n * TAU, rr = r * (1 + am[0] * Math.sin(a * 2 + ph[0]) + am[1] * Math.sin(a * 3 + ph[1]) + am[2] * Math.sin(a * 5 + ph[2])) * (1 - rag * 0.5 + R() * rag);
    const lx = Math.cos(a) * rr * stretch, ly = Math.sin(a) * rr;
    pts.push([x + lx * c - ly * s, y + lx * s + ly * c]);
  }
  const m = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  g.beginPath(); let st = m(pts[n - 1], pts[0]); g.moveTo(st[0], st[1]);
  for (let k = 0; k < n; k++) { const e = m(pts[k], pts[(k + 1) % n]); g.quadraticCurveTo(pts[k][0], pts[k][1], e[0], e[1]); }
  g.closePath(); g.fill();
}
/* Branch: irregular, mostly vertical stroke, that thins and sometimes branches out */
function camoBranch(g, x, y, len, w, R, depth = 0) {
  let a = Math.PI / 2 + (R() - 0.5) * 0.9, px = x, py = y, d = 0;
  const step = Math.max(1.5, len / 9);
  g.lineCap = 'round'; g.lineJoin = 'round';
  while (d < len) {
    a += (R() - 0.5) * 0.7; const nx = px + Math.cos(a) * step, ny = py + Math.sin(a) * step;
    g.lineWidth = Math.max(0.8, w * Math.pow(Math.sin(Math.PI * clamp((d + step * 0.5) / len, 0.05, 0.95)), 0.6) * (0.7 + R() * 0.5));
    g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke();
    if (depth < 1 && R() < 0.14) camoBranch(g, nx, ny, len * 0.45, w * 0.6, R, depth + 1);
    px = nx; py = ny; d += step;
  }
}
/* Angular flat fill ("poly" style): polygon of 4 to 7 vertices with sharp angles, stretched and rotated, like a facet of a
   flat-faced model */
function camoFacet(g, x, y, r, R, stretch, rot) {
  const n = 4 + Math.floor(R() * 4), c = Math.cos(rot), s = Math.sin(rot), a0 = R() * TAU;
  g.beginPath();
  for (let k = 0; k < n; k++) {
    const a = a0 + (k + (R() - 0.5) * 0.6) / n * TAU, rr = r * (0.55 + R() * 0.65), lx = Math.cos(a) * rr * stretch, ly = Math.sin(a) * rr;
    if (k) g.lineTo(x + lx * c - ly * s, y + lx * s + ly * c); else g.moveTo(x + lx * c - ly * s, y + lx * s + ly * c);
  }
  g.closePath(); g.fill();
}
/* Pointed leaf ("leaf" style): two arcs meeting at the tips, length len, relative width wr */
function camoLeaf(g, x, y, len, wr, rot) {
  const c = Math.cos(rot), s = Math.sin(rot), h = len / 2, w = len * wr;
  const P = (lx, ly) => [x + lx * c - ly * s, y + lx * s + ly * c], A = P(-h, 0), B = P(h, 0), U = P(0, w), D = P(0, -w);
  g.beginPath(); g.moveTo(A[0], A[1]); g.quadraticCurveTo(U[0], U[1], B[0], B[1]); g.quadraticCurveTo(D[0], D[1], A[0], A[1]); g.closePath(); g.fill();
}
/* Camouflage pattern of outfit skin in a canvas of W px representing phys meters of fabric (ks: pattern scale).
   Three styles (SKINS[skin].camo.style): "blot" (organic blotches and dark branches, multicam-like), "poly" (angular
   faceted flat fills, the one in the outfit illustrations), "leaf" (tight pointed leaves, the canvas of a ghillie outfit). */
function drawCamo(g, skin, W, phys, ks = 1) {
  const S = SKINS[skin], P = S.camo, R = mulberry32(S.seed), pm = W / phys * ks, area = phys * phys / ks / ks;
  g.fillStyle = P.base; g.fillRect(0, 0, W, W);
  // background layers with very soft edges: drawn at low resolution then enlarged (tiling preserved)
  const lo = document.createElement('canvas'), L = Math.max(16, Math.round(W / 8)); lo.width = lo.height = L;
  const gl = lo.getContext('2d'); gl.fillStyle = P.base; gl.fillRect(0, 0, L, L);
  const lpm = L / phys * ks;
  P.soft.forEach((col, i) => {
    gl.fillStyle = col;
    for (let k = 0, n = Math.round(area * 60); k < n; k++) { const x = R() * L, y = R() * L, r = (0.035 + R() * 0.05) * lpm; wrapShape(gl, L, L, x, y, r * 2.4, (a, b) => camoShape(gl, a, b, r, R, 0.8 + R() * 1.0, R() * TAU, 0.35)); }
  });
  const big = document.createElement('canvas'); big.width = big.height = W * 3;
  const gb = big.getContext('2d'); gb.imageSmoothingEnabled = true; gb.imageSmoothingQuality = 'high';
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) gb.drawImage(lo, i * W, j * W, W, W);
  g.drawImage(big, W, W, W, W, 0, 0, W, W);
  if (P.style === 'poly') {
    // facets: large then medium, each color in solid overlapping fills
    P.mid.forEach((col, i) => {
      g.fillStyle = col;
      for (let k = 0, n = Math.round(area * (P.n ? P.n[i] : 40)); k < n; k++) { const x = R() * W, y = R() * W, r = (0.018 + R() * 0.038) * pm; wrapShape(g, W, W, x, y, r * 2.2, (a, b) => camoFacet(g, a, b, r, R, 1 + R() * 1.1, R() * TAU)); }
    });
    P.branch.forEach((col) => {
      g.fillStyle = col;
      for (let k = 0, n = Math.round(area * 45); k < n; k++) { const x = R() * W, y = R() * W, r = (0.008 + R() * 0.016) * pm; wrapShape(g, W, W, x, y, r * 2.2, (a, b) => camoFacet(g, a, b, r, R, 1.2 + R() * 1.4, R() * TAU)); }
    });
  } else if (P.style === 'leaf') {
    // tight leaves, in all the palette colors, mostly drooping
    [...P.mid, ...P.branch].forEach((col, i) => {
      g.fillStyle = col;
      for (let k = 0, n = Math.round(area * (P.n ? P.n[i] || 260 : 260)); k < n; k++) { const x = R() * W, y = R() * W, len = (0.016 + R() * 0.03) * pm; wrapShape(g, W, W, x, y, len, (a, b) => camoLeaf(g, a, b, len, 0.18 + R() * 0.16, Math.PI / 2 + (R() - 0.5) * 1.6)); }
    });
  } else {
    // medium shapes: organic, stretched, jagged edges
    P.mid.forEach((col, i) => {
      g.fillStyle = col; g.globalAlpha = 0.9;
      for (let k = 0, n = Math.round(area * [95, 70, 30][i]); k < n; k++) { const x = R() * W, y = R() * W, r = (0.009 + R() * 0.02) * pm; wrapShape(g, W, W, x, y, r * 3, (a, b) => camoShape(g, a, b, r, R, 1 + R() * 1.4, (R() - 0.5) * 1.2 + (R() < 0.5 ? Math.PI / 2 : 0))); }
    });
    g.globalAlpha = 1;
    // dark branches (the characteristic stroke of multicam patterns)
    P.branch.forEach((col, i) => {
      g.strokeStyle = col;
      for (let k = 0, n = Math.round(area * [150, 90][i]); k < n; k++) { const x = R() * W, y = R() * W, len = (0.022 + R() * 0.05) * pm, w = (0.0022 + R() * 0.0035) * pm; wrapShape(g, W, W, x, y, len * 1.3, (a, b) => camoBranch(g, a, b, len, w, mulberry32((k + 1) * 7919 + i * 13))); }
    });
  }
  // slashes (challenge outfits: P.slash = { col, n, len, w, rot }): long tapered diagonal facets, in a vivid color
  if (P.slash) {
    const L = P.slash;
    L.col.forEach((col, i) => {
      g.fillStyle = col;
      for (let k = 0, n = Math.round(area * L.n[i]); k < n; k++) {
        const x = R() * W, y = R() * W, len = (L.len[0] + R() * L.len[1]) * pm, w = (L.w[0] + R() * L.w[1]) * pm, rot = L.rot + (R() - 0.5) * 0.35, c = Math.cos(rot), sn = Math.sin(rot), sk = (R() - 0.5) * w * 1.5;
        wrapShape(g, W, W, x, y, len, (a, b2) => {
          // pointed parallelogram: two points at the end of the length, the width in the middle (offset: a facet, not an ellipse)
          const P4 = [[-len / 2, 0], [sk, -w / 2], [len / 2, 0], [-sk, w / 2]];
          g.beginPath(); P4.forEach(([lx, ly], j) => { const X = a + lx * c - ly * sn, Y = b2 + lx * sn + ly * c; if (j) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.closePath(); g.fill();
        });
      }
    });
  }
  // light, rare and small highlights
  g.fillStyle = P.hi;
  for (let k = 0, n = Math.round(area * 120); k < n; k++) { const x = R() * W, y = R() * W, r = (0.002 + R() * 0.004) * pm; wrapShape(g, W, W, x, y, r * 3, (a, b) => camoShape(g, a, b, r, R, 1 + R(), R() * TAU, 0.5)); }
  // washed out: fine grain (small repeated noise canvas) and broad hue variations, in soft light
  const grain = document.createElement('canvas'); grain.width = grain.height = 128;
  const gg = grain.getContext('2d'), gi = gg.createImageData(128, 128), R2 = mulberry32(S.seed + 3);
  for (let i = 0; i < 128 * 128; i++) { const v = 128 + (R2() - 0.5) * 90; gi.data[i * 4] = gi.data[i * 4 + 1] = gi.data[i * 4 + 2] = v; gi.data[i * 4 + 3] = 255; }
  gg.putImageData(gi, 0, 0);
  const wash = document.createElement('canvas'); wash.width = wash.height = 12;
  const gw = wash.getContext('2d'); for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) { const v = Math.round(128 + (R2() - 0.5) * 70); gw.fillStyle = `rgb(${v},${v},${v})`; gw.fillRect(x, y, 1, 1); }
  g.save(); g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.5;
  g.fillStyle = g.createPattern(grain, 'repeat'); g.fillRect(0, 0, W, W);
  g.globalAlpha = 0.45; g.imageSmoothingEnabled = true; g.drawImage(wash, 0, 0, W, W);
  g.restore();
}
/* Head (face zone) in cylindrical projection: s goes around the head (0.5 in front, 0 and 1 behind), t goes down from the
   top (0) to the chin (1). Skin, few-day beard, eyebrows, lips, buzz-cut hair on the skull and nape. */
function drawFace(g, x0, y0, S) {
  const R = mulberry32(71), im = g.getImageData(x0, y0, S, S), d = im.data, N = noise2(21);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4, u = x / S - 0.5, v = y / S, au = Math.abs(u);
    let r = 176, gg = 132, b = 101;
    // redder cheeks and nose
    const cheek = Math.exp(-(((au - 0.085) / 0.04) ** 2 + ((v - 0.56) / 0.07) ** 2)), nose = Math.exp(-((u / 0.022) ** 2 + ((v - 0.56) / 0.07) ** 2));
    r += 18 * cheek + 14 * nose; gg -= 5 * cheek; b -= 5 * cheek;
    // short beard: jaw and mustache, irregular edge
    const nz = N(x / S * 14, y / S * 14) * 0.08;
    const jaw = smoothstep(0.64, 0.72, v + nz - au * 0.25) * (1 - smoothstep(0.22, 0.27, au + nz));
    const must = Math.exp(-((u / 0.05) ** 2 + ((v - 0.675) / 0.018) ** 2));
    const lips = Math.exp(-((u / 0.03) ** 2 + ((v - 0.715) / 0.014) ** 2));
    const beard = clamp(Math.max(jaw, must) * (0.6 + 0.4 * R()) * (1 - lips * 0.95), 0, 1);
    r = lerp(r, 58, beard * 0.85); gg = lerp(gg, 44, beard * 0.85); b = lerp(b, 34, beard * 0.85);
    r = lerp(r, 148, lips * 0.65); gg = lerp(gg, 88, lips * 0.65); b = lerp(b, 80, lips * 0.65);
    // eyebrows
    const brow = Math.exp(-(((au - 0.045) / 0.026) ** 2 + ((v - 0.36 + au * 0.25) / 0.012) ** 2));
    r = lerp(r, 52, brow * 0.9); gg = lerp(gg, 40, brow * 0.9); b = lerp(b, 31, brow * 0.9);
    // buzz-cut hair: skull, temples and nape
    const hair = Math.max(smoothstep(0.31, 0.27, v + nz * 0.5 - au * 0.08), smoothstep(0.17, 0.2, au + nz) * smoothstep(0.66, 0.6, v + nz) * smoothstep(0.26, 0.3, au + nz * 0.5 + (0.6 - v) * 0.15));
    r = lerp(r, 44, hair * 0.88); gg = lerp(gg, 34, hair * 0.88); b = lerp(b, 27, hair * 0.88);
    const n = N(x / S * 60, y / S * 60) * 14 + (R() - 0.5) * 6;
    d[i] = clamp(r + n, 0, 255); d[i + 1] = clamp(gg + n, 0, 255); d[i + 2] = clamp(b + n, 0, 255); d[i + 3] = 255;
  }
  g.putImageData(im, x0, y0);
}
/* Fabric scans (Poly Haven, CC0: tools/build_outfits.py), shipped in the page base (build.py): a canvas, a knit and a
   leather. They give the canvas, glove and leather zones of the atlas the relief and roughness of a real fabric, and the shades of its hue, in
   place of the computed weave (too regular: the light slid over it like on plastic). Decoded at startup (gearScanLoad,
   awaited before the soldiers are prepared); when absent (base not loaded), the atlas keeps its computed weave. */
const GEAR_SCAN = { n: null, t: null }; // decoded images: fabrics (normal in red and green, roughness in blue) and hue (luminance)
const GEAR_SCAN_K = { camo: 1.7, glove: 1.4, leath: 1.2 }; // strength of the scanned relief, per zone
const GEAR_SCAN_R = { camo: 0.7, glove: 0.6, leath: 1.1 }; // share of the scan's roughness deviations carried over to the zone
function gearScanLoad() {
  const S = window.BASE_ASSETS || {};
  if (!S.cloths || !S.tintScan) return Promise.resolve();
  const img = (src) => { const im = new Image(); im.src = src; return im.decode().then(() => im); };
  return Promise.all([img(S.cloths), img(S.tintScan)]).then(([n, t]) => { GEAR_SCAN.n = n; GEAR_SCAN.t = t; }).catch(() => {});
}
/* One scan image (k: its scale, 1 for fabrics, 0.5 for hue) laid out like the atlas. The canvas repeats a whole number
   of times in the camouflage zone, to tile at its edges like the pattern: once in first person (34 cm of fabric for a
   27 cm tile), three times on a soldier (70 cm). The knit and the leather fill their zone (14 and 20 cm of scan). */
function gearScanLayout(img, k, fp) {
  const c = document.createElement('canvas'); c.width = c.height = ATLAS_N;
  const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high';
  const C = ATLAS_R.camo, n = fp ? 1 : 3, st = (C[2] - 6) / n;
  g.save(); g.beginPath(); g.rect(C[0], C[1], C[2], C[3]); g.clip();
  for (let i = -1; i <= n; i++) for (let j = -1; j <= n; j++) g.drawImage(img, 0, 0, 512 * k, 512 * k, C[0] + 3 + i * st, C[1] + 3 + j * st, st, st);
  g.restore();
  const G = ATLAS_R.glove, L = ATLAS_R.leath;
  g.drawImage(img, 512 * k, 0, 256 * k, 256 * k, G[0], G[1], G[2], G[3]);
  g.drawImage(img, 512 * k, 256 * k, 256 * k, 256 * k, L[0], L[1], L[2], L[3]);
  return c;
}
/* Heights (relief) of the atlas, in arbitrary units; converted to normals afterward. With the scans, the canvas, glove and leather
   keep only their folds and the reinforcing thread here: the weave comes from the scan (gearScanNormals) */
function gearHeights(fp) {
  const H = new Float32Array(ATLAS_N * ATLAS_N), N = noise2(3), N2 = noise2(8), sc = GEAR_SCAN.n ? 0 : 1;
  const put = (reg, fn) => { const r = ATLAS_R[reg]; for (let y = 0; y < r[3]; y++) for (let x = 0; x < r[2]; x++) H[(r[1] + y) * ATLAS_N + r[0] + x] = fn(x, y, r[2], r[3]); };
  // camouflage: cross-woven canvas, ripstop reinforcing thread about every 5 mm, light wrinkling
  const phys = fp ? 0.34 : 0.7, pmm = 768 / (phys * 1000), rip = Math.max(3, Math.round(5 * pmm));
  put('camo', (x, y, W) => {
    const weave = Math.sin(x * 2.1) * Math.sin(y * 2.1) * 0.35 * sc;
    const grid = ((x % rip < 1.2 ? 0.5 : 0) + (y % rip < 1.2 ? 0.5 : 0)) * (sc ? 1 : 0.25); // with the scan, barely marked: regular, it looked like a grid
    const wr = N(x / W * 6, y / W * 6, 6) * 5 + N2(x / W * 13, y / W * 13, 13) * 1.8;
    return weave + grid + wr;
  });
  // glove: fine knit and seams
  put('glove', (x, y) => (Math.sin(x * 2.4 + Math.sin(y * 0.9) * 0.6) * 0.12 + Math.sin(y * 2.9) * 0.1 + N2(x / 5, y / 5) * 0.12) * sc + N(x / 14, y / 14) * 0.35);
  // synthetic: fine grain and a few folds
  put('leath', (x, y) => N(x / 2.2, y / 2.2) * 0.35 * sc + N2(x / 9, y / 9) * 0.5 + Math.sin(x * 0.21 + N(x / 30, y / 30) * 3) * 0.12);
  // MOLLE straps: 25 mm bands every 38 mm, stitching, weave
  put('web', (x, y) => {
    const band = (y % 38) < 25 ? 1 : 0, edge = band && ((y % 38) < 2 || (y % 38) > 22) ? -0.4 : 0;
    const stitch = band && (x % 38 < 3) ? -0.8 : 0;
    return band * 1.2 + edge + stitch + Math.sin(x * 2.4) * 0.12 * band + Math.sin(y * 2.4) * 0.1;
  });
  // skin: pores and micro-relief
  put('face', (x, y, W) => N(x / W * 60, y / W * 60) * 0.5 + N2(x / W * 16, y / W * 16) * 0.7);
  // emblems (capes, panels): looser cross-woven canvas and a few wrinkles
  put('art', (x, y, W) => Math.sin(x * 1.9) * Math.sin(y * 1.9) * 0.3 + N(x / W * 5, y / W * 5, 5) * 3.5 + N2(x / W * 11, y / W * 11, 11) * 1.2);
  // rubber: diamond studs (soles, knuckle guards)
  put('misc', (x, y) => ((Math.abs(((x + y) % 24) - 12) < 5) && (Math.abs(((x - y + 240) % 24) - 12) < 5) ? 1.4 : 0) + N(x / 30, y / 30) * 0.4);
  return H;
}
function heightsToNormals(H, k, fp) {
  const c = document.createElement('canvas'); c.width = c.height = ATLAS_N;
  const g = c.getContext('2d'), im = g.createImageData(ATLAS_N, ATLAS_N), d = im.data, n = ATLAS_N;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x, hx = H[y * n + Math.min(n - 1, x + 1)] - H[y * n + Math.max(0, x - 1)], hy = H[Math.min(n - 1, y + 1) * n + x] - H[Math.max(0, y - 1) * n + x];
    const nx = -hx * k, ny = hy * k, l = hyp3(nx, ny, 1);
    d[i * 4] = (nx / l * 0.5 + 0.5) * 255; d[i * 4 + 1] = (ny / l * 0.5 + 0.5) * 255; d[i * 4 + 2] = (1 / l * 0.5 + 0.5) * 255; d[i * 4 + 3] = 255;
  }
  if (GEAR_SCAN.n) gearScanNormals(d, fp);
  g.putImageData(im, 0, 0);
  return c;
}
/* Scan relief overlaid on that of the folds ("whiteout" blend: slopes added, heights multiplied), canvas, glove and leather zones */
function gearScanNormals(d, fp) {
  const S = gearScanLayout(GEAR_SCAN.n, 1, fp).getContext('2d').getImageData(0, 0, ATLAS_N, ATLAS_N).data;
  for (const reg in GEAR_SCAN_K) {
    const r = ATLAS_R[reg], k = GEAR_SCAN_K[reg];
    for (let y = r[1]; y < r[1] + r[3]; y++) for (let x = r[0]; x < r[0] + r[2]; x++) {
      const i = (y * ATLAS_N + x) * 4, sx = S[i] / 127.5 - 1, sy = S[i + 1] / 127.5 - 1;
      const nx = d[i] / 127.5 - 1 + sx * k, ny = d[i + 1] / 127.5 - 1 + sy * k, nz = (d[i + 2] / 127.5 - 1) * Math.sqrt(Math.max(0.04, 1 - sx * sx - sy * sy));
      const l = Math.sqrt(nx * nx + ny * ny + nz * nz);
      d[i] = (nx / l * 0.5 + 0.5) * 255; d[i + 1] = (ny / l * 0.5 + 0.5) * 255; d[i + 2] = (nz / l * 0.5 + 0.5) * 255;
    }
  }
}
/* Roughness (green) and metal (blue) */
function gearRM() {
  const c = document.createElement('canvas'); c.width = c.height = ATLAS_N;
  const g = c.getContext('2d', { willReadFrequently: true }), R = mulberry32(5); // canvas in memory: reread for the scans' roughness
  const reg = (name, r, m) => { const a = ATLAS_R[name]; g.fillStyle = `rgb(0,${Math.round(r * 255)},${Math.round(m * 255)})`; g.fillRect(a[0], a[1], a[2], a[3]); };
  reg('camo', 0.9, 0); reg('glove', 0.9, 0); reg('leath', 0.52, 0); reg('web', 0.84, 0); reg('face', 0.55, 0); reg('misc', 0.86, 0); reg('art', 0.88, 0);
  // red: mask of the recognition bands (1) and neons (0.5), read by skinTagPatch
  GEAR_TILES.forEach(([n, r, m], i) => { g.fillStyle = `rgb(${n === 'tag' ? 255 : n === 'glow' ? 128 : 0},${Math.round(r * 255)},${Math.round(m * 255)})`; g.fillRect(768 + (i % 4) * 64, Math.floor(i / 4) * 64, 64, 64); });
  // a bit of variation in the canvas (wear, glossy areas)
  const a = ATLAS_R.camo; g.globalAlpha = 0.08;
  for (let i = 0; i < 400; i++) { g.fillStyle = R() < 0.5 ? '#00c000' : '#00ff00'; g.fillRect(a[0] + R() * a[2], a[1] + R() * a[3], 4 + R() * 30, 4 + R() * 30); }
  g.globalAlpha = 1;
  // scan roughness: its deviations from its mean, around the zone's value (soldier layout, shared by both views)
  if (GEAR_SCAN.n) {
    const S = gearScanLayout(GEAR_SCAN.n, 1, false).getContext('2d').getImageData(0, 0, ATLAS_N, ATLAS_N).data;
    const im = g.getImageData(0, 0, ATLAS_N, ATLAS_N), d = im.data;
    for (const reg in GEAR_SCAN_R) {
      const r = ATLAS_R[reg], k = GEAR_SCAN_R[reg];
      let m = 0; for (let y = r[1]; y < r[1] + r[3]; y++) for (let x = r[0]; x < r[0] + r[2]; x++) m += S[(y * ATLAS_N + x) * 4 + 2];
      m /= r[2] * r[3];
      for (let y = r[1]; y < r[1] + r[3]; y++) for (let x = r[0]; x < r[0] + r[2]; x++) { const i = (y * ATLAS_N + x) * 4; d[i + 1] = clamp(d[i + 1] + (S[i + 2] - m) * k, 0, 255); }
    }
    g.putImageData(im, 0, 0);
  }
  return c;
}
/* Color: outfit camouflage, light zones modulated by the vertex colors */
function gearAlbedo(skin, fp) {
  const c = document.createElement('canvas'); c.width = c.height = ATLAS_N;
  const g = c.getContext('2d', { willReadFrequently: true }); // canvas in memory: fast pixel reads
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, ATLAS_N, ATLAS_N);
  const cam = document.createElement('canvas'); cam.width = cam.height = 768;
  drawCamo(cam.getContext('2d', { willReadFrequently: true }), skin, 768, fp ? 0.34 : 0.7, fp ? 0.7 : 1);
  g.drawImage(cam, 0, 0);
  // glove fabric: slightly textured white (the glove color comes from the vertices)
  const G = ATLAS_R.glove, R = mulberry32(12), LT = ATLAS_R.leath;
  g.fillStyle = 'rgb(222,222,222)'; g.fillRect(LT[0], LT[1], LT[2], LT[3]);
  for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(0,0,0,${0.03 + R() * 0.05})`; g.fillRect(G[0] + R() * G[2], G[1] + R() * G[3], 1 + R() * 3, 1); g.fillRect(LT[0] + R() * LT[2], LT[1] + R() * LT[3], 1, 1); }
  // shades of the real fabric (threads more or less dyed, wear): the scan's luminance as an overlay, neutral at mid-gray
  if (GEAR_SCAN.t) {
    const T = gearScanLayout(GEAR_SCAN.t, 0.5, fp);
    g.save(); g.globalCompositeOperation = 'overlay';
    for (const [reg, al] of [['camo', 0.45], ['glove', 0.6], ['leath', 0.6]]) { const r = ATLAS_R[reg]; g.globalAlpha = al; g.drawImage(T, r[0], r[1], r[2], r[3], r[0], r[1], r[2], r[3]); }
    g.restore();
  }
  // straps: light bands, dark gaps between the bands, stitching
  const Wb = ATLAS_R.web;
  for (let y = 0; y < Wb[3]; y++) { const inb = (y % 38) < 25; g.fillStyle = inb ? 'rgb(236,236,236)' : 'rgb(150,150,150)'; g.fillRect(Wb[0], Wb[1] + y, Wb[2], 1); }
  g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 0; y < Wb[3]; y += 38) for (let x = 0; x < Wb[2]; x += 38) g.fillRect(Wb[0] + x, Wb[1] + y + 2, 3, 21);
  // face drawn on its own small canvas (reading pixels from the large canvas would force its whole deferred rendering)
  const fc = document.createElement('canvas'); fc.width = fc.height = ATLAS_R.face[2];
  drawFace(fc.getContext('2d', { willReadFrequently: true }), 0, 0, ATLAS_R.face[2]); g.drawImage(fc, ATLAS_R.face[0], ATLAS_R.face[1]);
  // rubber: neutral gray
  const M = ATLAS_R.misc; g.fillStyle = '#d8d8d8'; g.fillRect(M[0], M[1], M[2], M[3]);
  // outfit emblem (cape, panels), drawn on its own canvas; white otherwise
  const A = ATLAS_R.art, art = SKINS[skin].art;
  if (art) { const ac = document.createElement('canvas'); ac.width = A[2]; ac.height = A[3]; art(ac.getContext('2d'), A[2], A[3], skin); g.drawImage(ac, A[0], A[1]); }
  return c;
}
const GEAR = { maps: {} };
const _gearTex = (canvas, srgb) => { const t = new THREE.CanvasTexture(canvas); if (srgb) t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; };
/* Textures of an outfit (cached): fp = first person (finer camouflage, closest to the screen) */
function gearTextures(skin, fp) {
  const key = skin + (fp ? 'fp' : 'tp');
  if (GEAR.maps[key]) return GEAR.maps[key];
  const nk = fp ? 'nfp' : 'ntp';
  if (!GEAR[nk]) GEAR[nk] = _gearTex(heightsToNormals(gearHeights(fp), 1.2, fp), false);
  if (!GEAR.rm) GEAR.rm = _gearTex(gearRM(), false);
  return (GEAR.maps[key] = { map: _gearTex(gearAlbedo(skin, fp), true), normal: GEAR[nk], rm: GEAR.rm });
}
/* First-person color texture of an outfit no longer worn: freed (only one outfit at a time in the arms) */
function gearFreeFp(skin) { const T = GEAR.maps[skin + 'fp']; if (T) { T.map.dispose(); delete GEAR.maps[skin + 'fp']; } }
/* Recognition bands: the "tag" tile (red channel of the roughness / metal texture at 1) takes the uSkTag color, ally or
   enemy, whatever the outfit's hue; uSkGlow adds a slight light of its own. Neons of the challenge outfits: the
   "glow" tile (red channel at 0.5) lights with its vertex color (uSkNeon: intensity), ally as enemy (the vertex
   color, not the material hue). No extra texture. */
function skinTagPatch(s, U) {
  s.uniforms.uSkTag = U.tag; s.uniforms.uSkGlow = U.glow; s.uniforms.uSkNeon = U.neon;
  s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uSkTag; uniform float uSkGlow; uniform float uSkNeon;')
    .replace('#include <color_fragment>', '#include <color_fragment>\n  float skR = texture2D(roughnessMap, vUv).r, skTag = smoothstep(0.7, 0.9, skR), skNeon = smoothstep(0.3, 0.42, skR) - skTag;\n  diffuseColor.rgb = mix(diffuseColor.rgb, uSkTag, skTag);')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += uSkTag * skTag * uSkGlow + vColor * skNeon * uSkNeon;');
}
/* Outfit material: vertex colors × atlas; roughness and metal read from the atlas.
   mode: 'fp' first-person arms (separate scene, tuned globally), 'tp' soldier in the scenery (baked lighting,
   recognition bands), 'pv' menu preview (bands, no lighting volume: no map is loaded) */
function gearMaterial(skin, mode) {
  const fp = mode === 'fp', T = gearTextures(skin, fp);
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, map: T.map, normalMap: T.normal, normalScale: new THREE.Vector2(fp ? 0.65 : 0.36, fp ? 0.65 : 0.36), roughnessMap: T.rm, metalnessMap: T.rm, roughness: 1, metalness: 1, envMapIntensity: fp ? 0.9 : 0.7 });
  m.defines = { USE_SHEEN: '' };
  if (fp) { m.onBeforeCompile = (s) => { envCubeHook(s); gearSheenPatch(s); }; return m; }
  const U = (m.userData.skU = { tag: { value: new THREE.Color(1, 1, 1) }, glow: { value: 0 }, neon: { value: SKINS[skin].neon || 0 } });
  m.defines.SK_TAG = '';
  if (mode === 'pv') { m.userData.patch = (s) => { skAoPatch(s); skinTagPatch(s, U); gearSheenPatch(s); }; m.onBeforeCompile = m.userData.patch; return m; }
  volumeLit(m);
  const vl = m.userData.patch;
  m.userData.patch = (s) => { skAoPatch(s); vl(s); skinTagPatch(s, U); gearSheenPatch(s); };
  m.onBeforeCompile = m.userData.patch;
  return m;
}
/* Fabric's own sheen (three.js "sheen": grazing light catches the fiber fuzz): it softly lights the edge of the
   sleeves, legs and shoulders, which makes it read as canvas rather than matte plastic. Only textile zones take it:
   high roughness and no metal (canvas, knit, straps, fabric and nylon tiles; not leather, skin, glass or
   metal). Tinted by the fabric color. No extra texture, a single program for all outfits; sheltered from the sky, the baked
   lighting volume turns it off like the rest of the indirect light (VL_AO, 02c-materials.js). */
/* Baked occlusion of the soldiers (aoc attribute, soldierBakeAO in 06g-body.js): where one piece covers another, it cuts the indirect light
   and the fabric sheen, and slightly the sun (a shadow of a few millimeters that the shadow maps do not see). Placed
   before the baked lighting volume patch (volumeLit): the latter keeps the aomap_fragment include at the head of its own code, which
   is therefore inserted before this one. */
function skAoPatch(s) {
  s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float aoc; varying float vSkAo;').replace('#include <begin_vertex>', '#include <begin_vertex>\n  vSkAo = aoc;');
  s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vSkAo;').replace('#include <aomap_fragment>', `#include <aomap_fragment>
{
  float skAo = 1.0 - vSkAo * 0.85;
  reflectedLight.indirectDiffuse *= skAo; reflectedLight.indirectSpecular *= skAo;
  reflectedLight.directDiffuse *= 1.0 - vSkAo * 0.3;
#ifdef USE_SHEEN
  sheenSpecular *= skAo;
#endif
}`);
}
const GEAR_SHEEN = { color: { value: new THREE.Color(0.45, 0.45, 0.45) }, rough: { value: 0.55 } };
function gearSheenPatch(s) {
  s.uniforms.sheenColor = GEAR_SHEEN.color; s.uniforms.sheenRoughness = GEAR_SHEEN.rough;
  s.fragmentShader = s.fragmentShader.replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n  material.sheenColor *= mix(diffuseColor.rgb, vec3(1.0), 0.15) * smoothstep(0.74, 0.86, roughnessFactor) * (1.0 - smoothstep(0.1, 0.3, metalnessFactor));');
}
