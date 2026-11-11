/* ==========================================================================
   JUNGLE OUTPOST, the yard: everything around the command building (02yo-outpost-building.js) inside the perimeter fence, and the
   kit shared with the guard tower and the utility shed (02ypa-outpost-tower.js) and the jungle (02ypb-outpost-jungle.js).
   - Kit: procedural chain-link mesh, olive painted corrugated sheet, the damp earth and the wet mud of the yard, its wheel ruts and the
     mud lapping over the concrete (optional surfaces, generated for this map only), a small drawn atlas (field map, pictograms),
     materials; military props on the sheet's palette (olive, khaki, tan wood, steel, rust: the building's ammunition crates, cot, field
     radio and telephone, searchlight, floodlight poles, flagpole, water tank, drum rack, guard booth, barrier arm, a tarped stack...).
   - Perimeter (OP_FENCE, 46 x 42 m), sheet 4: 2.4 m chain-link of dark wire (a band at any distance) on 12 cm galvanized posts, a
     heavy top rail, barbed wire on outward arms (stops soldiers, not shots
     nor sight), the main vehicle gate to the north in front of the command building (leaves swung open between concrete pillars, barrier
     arm, guard booth), the rear gate to the south (sandbag post), two cuts in the north and south fences (west corner, middle) and a
     breach in each side fence: five ways in for each team.
   - Yard, thinned to the sheet's cover and grouped in clusters along the edges (olive crate stacks, wooden crates on pallets, concrete
     jersey barriers, each turned off its axis) round an open middle; the parked 4x4 (south; a tarped load of its size north), the water
     tank, floodlight poles, the flagpole, the radio mast and the dish.
   Mirrored north-south (s = 1: Alpha half, north; -1: Bravo half), except the dressing of the gates (main gate north, rear gate south)
   and one landmark per half (flagpole north, radio mast south). The command building's front faces north (02yo-outpost-building.js).
   ========================================================================== */
/* ---------- Kit: surfaces, atlas, materials ---------- */
Object.assign(TEXLAB, {
  /* galvanized chain-link: diamonds of woven wire, rust spots; alpha = opacity */
  opyLink: [512, 611, 1.2, `
    vec2 p = uv * 8.0; float da = abs(fract(p.x + p.y) - 0.5), db = abs(fract(p.x - p.y) - 0.5), dm = min(da, db);
    float wire = 1.0 - smoothstep(0.075, 0.1, dm); // (a third of the panel: it reads as a band at distance, never a milky pane)
    float big = gfbm(uv, vec2(3.0), 3, 1.0), rs = smoothstep(0.62, 0.8, gfbm(uv, vec2(10.0), 4, 2.0));
    h = wire * (1.0 - dm / 0.1) * 0.8;
    a = mix(srgb(vec3(0.52, 0.53, 0.52)) * (0.85 + big * 0.2), srgb(vec3(0.34, 0.23, 0.15)), rs * 0.4);
    r = mix(0.42, 0.85, rs); x = wire;`],
  /* the same sheet, matte and soft (the shed, the booth, the guard room): ribs by their shading only, half the relief, no pale ridge */
  opyCorrS: [512, 653, 0.35, `
    float wv = sin(uv.x * 16.0 * 6.2831853) * 0.5 + 0.5;
    float big = gfbm(uv, vec2(3.0), 4, 1.0), mid = gfbm(uv, vec2(12.0), 3, 2.0), st = gfbm(vec2(uv.x, uv.y * 0.25), vec2(32.0, 1.0), 4, 3.0);
    float rs = clamp(smoothstep(0.74, 0.9, st + uv.y * 0.07 + big * 0.12) * 0.6, 0.0, 1.0), grime = smoothstep(0.35, 0.9, gfbm(vec2(uv.x, uv.y * 0.3), vec2(10.0, 2.0), 4, 6.0));
    h = wv * 0.5;
    a = vec3(0.84) * (0.92 + big * 0.08 + mid * 0.04) * (1.0 - grime * 0.15);
    a = mix(a, srgb(vec3(0.36, 0.24, 0.15)), rs * 0.4);
    r = mix(0.8, 0.9, grime); x = h;`],
  /* painted corrugated sheet (tinted by vertices: olive green of the shed, the gates, the booth): vertical ribs, chipped paint
     showing the zinc, rust streaks under the fixings, grime */
  opyCorr: [512, 613, 3.0, `
    float wv = sin(uv.x * 16.0 * 6.2831853) * 0.5 + 0.5;
    float big = gfbm(uv, vec2(3.0), 4, 1.0), mid = gfbm(uv, vec2(12.0), 3, 2.0);
    float st = gfbm(vec2(uv.x, uv.y * 0.25), vec2(32.0, 1.0), 4, 3.0);
    float rs = clamp(smoothstep(0.7, 0.86, st + uv.y * 0.07 + big * 0.12) * 0.8 + smoothstep(0.8, 0.9, gfbm(uv, vec2(7.0), 5, 4.0)) * 0.5, 0.0, 1.0);
    float chip = smoothstep(0.8, 0.83, gfbm(uv, vec2(22.0), 4, 5.0) + (big - 0.5) * 0.1);
    float grime = smoothstep(0.35, 0.9, gfbm(vec2(uv.x, uv.y * 0.3), vec2(10.0, 2.0), 4, 6.0));
    h = wv * 0.85 - chip * 0.08;
    a = vec3(0.86) * (0.9 + big * 0.1 + mid * 0.05) * (0.86 + wv * 0.14) * (1.0 - grime * 0.18);
    a = mix(a, srgb(vec3(0.66, 0.65, 0.62)), chip * 0.65);
    a = mix(a, srgb(vec3(0.4, 0.22, 0.12)), rs * 0.55);
    r = mix(0.55, 0.85, max(rs, grime * 0.4)); x = h;`],
  /* wet tropical mud (the yard after the shower, layer under the dry packed earth): grey-brown, smooth, hollows holding water (dark and
     glossy), now and then a pebble, boot and wheel scuffs; the hollows on a warped grid (no repeat that reads) */
  opyMud: [512, 619, 1.2, `
    vec2 w = uv + (vec2(gfbm(uv, vec2(4.0), 3, 7.0), gfbm(uv + 0.31, vec2(4.0), 3, 8.0)) - 0.5) * 0.12;
    float big = gfbm(uv, vec2(3.0), 5, 1.0), mid = gfbm(w, vec2(14.0), 4, 2.0), gr = vn(uv * 256.0, vec2(256.0), 3.0);
    vec4 st = vor(w, vec2(30.0), 6.0, 1.0); float stn = (1.0 - smoothstep(0.06, 0.18, st.x)) * step(0.96, st.z);
    vec4 bt = vor(w, vec2(9.0), 8.0, 1.0); float boot = (1.0 - smoothstep(0.1, 0.24, bt.x)) * step(0.78, bt.z) * 0.5;
    h = big * 0.45 + mid * 0.3 + gr * 0.05 + stn * 0.2 - boot * 0.25;
    float wet = 1.0 - smoothstep(0.34, 0.5, h);
    vec3 dry = srgb(vec3(0.46, 0.4, 0.32)), damp = srgb(vec3(0.38, 0.33, 0.26)), soaked = srgb(vec3(0.24, 0.21, 0.17));
    a = mix(dry, damp, smoothstep(0.3, 0.7, 1.0 - big)) * (0.9 + mid * 0.16 + gr * 0.06);
    a = mix(a, soaked, wet * 0.6);
    a = mix(a, srgb(vec3(0.5, 0.47, 0.42)) * (0.75 + st.z * 0.3), stn * 0.7);
    r = mix(0.88, 0.32, wet) - stn * 0.1; x = h;`],
});
Object.assign(TEXLAB, {
  /* weathered boards about 15 cm (the tower cabin): grey-brown, dark joints, grain along the boards, a knot now and then, grey bleaching */
  opyBoard: [512, 631, 1.4, `
    float n = 8.0, row = floor(uv.y * n), fy = fract(uv.y * n), id = hs(vec2(row, 3.0), 2.0);
    float off = id * 3.7, gr = gfbm(vec2(uv.x * 2.0 + off, fy * 0.25 + row), vec2(2.0, 8.0), 4, 3.0), streak = vn(vec2(uv.x * 40.0 + off * 9.0, fy * 3.0 + row * 7.0), vec2(40.0, 24.0), 4.0);
    float joint = 1.0 - smoothstep(0.0, 0.05, min(fy, 1.0 - fy)), bleach = smoothstep(0.45, 0.8, gfbm(uv, vec2(3.0), 4, 5.0));
    vec4 kn = vor(vec2(uv.x * 3.0, uv.y * n), vec2(3.0, n), 6.0, 0.8); float knot = (1.0 - smoothstep(0.05, 0.14, kn.x)) * step(0.86, kn.z);
    h = 0.6 + gr * 0.2 + streak * 0.08 - joint * 0.6 - knot * 0.2;
    vec3 c = srgb(vec3(0.6, 0.51, 0.42)) * (0.86 + id * 0.18) * (0.88 + gr * 0.16 + streak * 0.08);
    c = mix(c, srgb(vec3(0.58, 0.56, 0.53)), bleach * 0.35);
    a = c * (1.0 - joint * 0.6) * (1.0 - knot * 0.4);
    r = 0.93; x = h;`],
  /* trodden earth of the yard, damp: grey-brown, scuffed in broad patches, a rare small stone (no crack, no repeat that reads) */
  opyEarth: [512, 637, 2.0, `
    vec2 w = uv + (vec2(gfbm(uv, vec2(3.0), 3, 11.0), gfbm(uv + 0.47, vec2(3.0), 3, 12.0)) - 0.5) * 0.16;
    float big = gfbm(uv, vec2(3.0), 5, 1.0), mid = gfbm(w, vec2(14.0), 4, 2.0), gr = vn(uv * 256.0, vec2(256.0), 3.0), sc = gfbm(w, vec2(6.0), 4, 9.0);
    vec4 st = vor(w, vec2(26.0), 6.0, 1.0); float stn = (1.0 - smoothstep(0.06, 0.16, st.x)) * step(0.97, st.z);
    h = big * 0.4 + mid * 0.25 + gr * 0.08 + stn * 0.2 - smoothstep(0.55, 0.75, sc) * 0.08;
    a = mix(srgb(vec3(0.4, 0.34, 0.275)), srgb(vec3(0.5, 0.43, 0.35)), smoothstep(0.2, 0.8, big)) * (0.9 + mid * 0.14 + gr * 0.06);
    a *= 1.0 - smoothstep(0.55, 0.8, sc) * 0.1; a = mix(a, srgb(vec3(0.5, 0.47, 0.43)) * (0.75 + st.z * 0.3), stn * 0.7);
    r = 0.94 - stn * 0.1; x = h;`],
  /* a wheel rut (the tile 5.6 m along it, 0.7 m across; alpha = its extent): a worn wet track about 0.3 m wide whose width wanders and
     whose edges break up, tread marks across, water standing in its low spots, fading out here and there over a meter or two */
  opyRut: [512, 643, 0.7, `
    float v = abs(uv.y - 0.5) * 2.0, n = gfbm(uv, vec2(6.0, 1.0), 3, 3.0), hf = gfbm(uv, vec2(48.0, 6.0), 3, 4.0);
    float e = 0.43 + (n - 0.5) * 0.36 + (hf - 0.5) * 0.16, core = 1.0 - smoothstep(e - 0.12, e + 0.03, v);
    float fade = smoothstep(0.28, 0.6, gfbm(vec2(uv.x, 0.37), vec2(3.0, 1.0), 3, 7.0));
    float tread = smoothstep(0.3, 0.5, abs(fract(uv.x * 70.0 + v * 0.7) - 0.5)) * (1.0 - smoothstep(0.0, 0.6, v / max(e, 0.1)));
    float pool = smoothstep(0.6, 0.74, gfbm(uv, vec2(4.0, 1.0), 3, 5.0)) * (1.0 - smoothstep(0.2, 0.75, v / max(e, 0.1)));
    h = 0.5 - core * 0.35 + tread * core * 0.06;
    a = srgb(vec3(0.16, 0.13, 0.1)) * (0.85 + n * 0.25) * (1.0 - tread * 0.12);
    a = mix(a, srgb(vec3(0.08, 0.075, 0.07)), pool * 0.75);
    r = mix(0.6, 0.18, pool) - core * 0.1; x = clamp(core * (0.35 + 0.6 * fade), 0.0, 1.0) * (1.0 - smoothstep(0.86, 1.0, v));`],
  /* mud lapping over a concrete edge (the tile across it: 0.5 m, the edge at the bottom; alpha = its extent): a thin film of dried earth,
     thick at the edge, frayed and splashed inward */
  opyFilm: [256, 647, 0.5, `
    float n = gfbm(uv, vec2(16.0, 2.0), 4, 1.0), sp = gfbm(uv, vec2(48.0, 6.0), 3, 2.0);
    float t = n * 0.62, cov = 1.0 - smoothstep(t - 0.04, t + 0.04, uv.y);
    cov = max(cov, smoothstep(0.7, 0.78, sp) * (1.0 - smoothstep(0.0, 0.7, uv.y)) * 0.7);
    h = 0.5 + cov * 0.1;
    a = srgb(vec3(0.33, 0.28, 0.22)) * (0.85 + sp * 0.2);
    r = 0.95; x = cov * (0.55 + sp * 0.4);`],
  /* olive tarpaulin (tinted): heavy cloth, broad folds and creases, water stains, no fine weave (it would shimmer) */
  opyTarp: [512, 659, 1.0, `
    float big = gfbm(uv, vec2(3.0), 4, 1.0), fold = gfbm(vec2(uv.x, uv.y * 0.3), vec2(5.0, 2.0), 3, 2.0), cr = ridge(uv, vec2(4.0, 3.0), 3, 4.0);
    float stain = smoothstep(0.6, 0.85, gfbm(uv, vec2(4.0), 5, 3.0)), wv = vn(uv * 48.0, vec2(48.0), 5.0);
    h = fold * 0.5 + smoothstep(0.86, 0.97, cr) * 0.2 + wv * 0.03;
    a = vec3(0.86, 0.85, 0.8) * (0.86 + big * 0.12 + wv * 0.03) * (0.9 + fold * 0.14) * (1.0 - stain * 0.22) * (1.0 - smoothstep(0.86, 0.97, cr) * 0.12);
    r = 0.9; x = h;`],
  /* forest canopy seen from afar (the hills): tree crowns in clumps, lit on top, dark hollows between them, no fine grain (no speckle) */
  opjCanopy: [512, 661, 0.45, `
    vec2 w = uv + (vec2(gfbm(uv, vec2(3.0), 3, 2.0), gfbm(uv + 0.29, vec2(3.0), 3, 3.0)) - 0.5) * 0.1;
    vec4 c1 = vor(w, vec2(9.0), 4.0, 0.9), c2 = vor(w + 0.17, vec2(19.0), 6.0, 0.9);
    float d1 = 1.0 - smoothstep(0.0, 0.7, c1.x), d2 = 1.0 - smoothstep(0.0, 0.7, c2.x), big = gfbm(uv, vec2(2.0), 3, 4.0);
    float crev = 1.0 - smoothstep(0.0, 0.4, c1.y - c1.x); // (soft hollows where two crowns meet: no drawn outline)
    h = d1 * 0.35 + d2 * 0.25 - crev * 0.12;
    vec3 lo = srgb(vec3(0.13, 0.23, 0.1)), hi = mix(srgb(vec3(0.32, 0.45, 0.2)), srgb(vec3(0.36, 0.45, 0.21)), step(0.7, c1.z));
    a = mix(lo, hi, clamp(0.38 + d1 * 0.32 + d2 * 0.25, 0.0, 1.0)) * (0.9 + c1.z * 0.16) * (1.0 - crev * 0.3) * (0.92 + big * 0.16);
    r = 0.95; x = h;`],
  /* jungle floor: dark leaf litter (brown and olive leaves, twigs) */
  opyLitter: [512, 641, 1.6, `
    float big = gfbm(uv, vec2(3.0), 4, 1.0);
    vec4 l1 = vor(uv, vec2(22.0), 7.0, 1.0), l2 = vor(uv + 0.37, vec2(15.0), 8.0, 1.0);
    float a1 = 1.0 - smoothstep(0.25, 0.45, l1.x), a2 = 1.0 - smoothstep(0.3, 0.5, l2.x);
    float tw = smoothstep(0.82, 0.9, ridge(uv, vec2(9.0, 5.0), 3, 4.0));
    h = 0.3 + a1 * 0.3 + a2 * 0.25 + tw * 0.2;
    vec3 soil = srgb(vec3(0.2, 0.16, 0.11)) * (0.85 + big * 0.3);
    vec3 leafA = mix(srgb(vec3(0.33, 0.24, 0.14)), srgb(vec3(0.25, 0.26, 0.15)), step(0.6, l1.z)) * (0.8 + l1.z * 0.4);
    vec3 leafB = mix(srgb(vec3(0.28, 0.2, 0.12)), srgb(vec3(0.38, 0.3, 0.18)), l2.z) * (0.8 + l2.z * 0.3);
    a = mix(soil, leafA, a1 * 0.85); a = mix(a, leafB, a2 * 0.7 * (1.0 - a1 * 0.5)); a = mix(a, srgb(vec3(0.3, 0.25, 0.18)), tw);
    r = 0.9; x = h;`],
});
Object.assign(TEXSCALE, { opyLink: 0.5, opyCorr: 2.0, opyCorrS: 2.0, opyMud: 3.2, opyBoard: 1.2, opyEarth: 3.0, opyLitter: 2.2, opyRut: 0.7, opyFilm: 0.5, opyTarp: 1.0, opjCanopy: 2.5 });
for (const k of ['opyLink', 'opyCorr', 'opyCorrS', 'opyMud', 'opyBoard', 'opyEarth', 'opyLitter', 'opyRut', 'opyFilm', 'opyTarp', 'opjCanopy']) OPT_TEX.add(k);
/* What the yard and the jungle need from the map (same convention as OP_CP_TEX, 02yo-outpost-building.js): photo surfaces, procedural
   surfaces (ours, the port's steel grating), the atlas (opYardKit) and the materials (opYardMaterials) */
const OP_YARD_TEX = ['steel', 'rust', 'wood', 'crate', 'timber', 'bark', 'palmbark', 'canvas', 'burlap', 'rubber', 'plastic', 'paintwood', 'cardboard', 'stone'];
const OP_YARD_SURF = ['opyLink', 'opyCorr', 'opyCorrS', 'opyMud', 'opyBoard', 'opyEarth', 'opyLitter', 'opyRut', 'opyFilm', 'opyTarp', 'opjCanopy', 'grating', 'hedge', 'rockery'];
/* Drawn atlas (512 x 512, four 256 cells): topographic field map, high-voltage triangle, flammable diamond, the outpost flag */
const OPY_ATL = { map: 0, volt: 1, fire: 2, flag: 3 };
function opyAtlas() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d'), R = rngOf(6203);
  const cell = (i, bg, draw) => { const x = (i % 2) * 256, y = Math.floor(i / 2) * 256; g.save(); g.beginPath(); g.rect(x, y, 256, 256); g.clip(); g.fillStyle = bg; g.fillRect(x, y, 256, 256); draw(x, y); g.restore(); };
  // field map: jungle greens, a river, contour lines, the grid, a red route and objective circles
  cell(OPY_ATL.map, '#e9e2c8', (x, y) => {
    for (let k = 0; k < 26; k++) { g.fillStyle = R() < 0.5 ? 'rgba(120,160,90,0.35)' : 'rgba(150,180,110,0.3)'; g.beginPath(); g.ellipse(x + R() * 256, y + R() * 256, 20 + R() * 50, 14 + R() * 40, R() * 3, 0, 6.3); g.fill(); }
    g.strokeStyle = 'rgba(140,95,50,0.55)'; g.lineWidth = 1.2;
    for (let k = 0; k < 7; k++) { const cx = x + 60 + R() * 140, cy = y + 60 + R() * 140; for (let r = 10; r < 70; r += 9) { g.beginPath(); g.ellipse(cx, cy, r * (1 + R() * 0.3), r * (0.7 + R() * 0.3), R(), 0, 6.3); g.stroke(); } }
    g.strokeStyle = '#3d74b8'; g.lineWidth = 4; g.beginPath(); g.moveTo(x, y + 200); g.bezierCurveTo(x + 80, y + 150, x + 120, y + 240, x + 256, y + 170); g.stroke();
    g.strokeStyle = 'rgba(40,40,40,0.35)'; g.lineWidth = 1; for (let k = 0; k <= 256; k += 32) { g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + k, y + 256); g.moveTo(x, y + k); g.lineTo(x + 256, y + k); g.stroke(); }
    g.strokeStyle = '#c0281e'; g.lineWidth = 3; g.setLineDash([8, 5]); g.beginPath(); g.moveTo(x + 30, y + 40); g.lineTo(x + 110, y + 95); g.lineTo(x + 150, y + 160); g.lineTo(x + 220, y + 210); g.stroke(); g.setLineDash([]);
    for (const [px, py] of [[110, 95], [220, 210]]) { g.beginPath(); g.arc(x + px, y + py, 11, 0, 6.3); g.stroke(); }
    g.fillStyle = 'rgba(30,30,30,0.85)'; g.fillRect(x + 140, y + 152, 14, 14);
  });
  // high voltage: yellow triangle, black border and lightning bolt
  cell(OPY_ATL.volt, '#f2f0ea', (x, y) => {
    g.fillStyle = '#111'; g.beginPath(); g.moveTo(x + 128, y + 22); g.lineTo(x + 240, y + 222); g.lineTo(x + 16, y + 222); g.closePath(); g.fill();
    g.fillStyle = '#f2c21b'; g.beginPath(); g.moveTo(x + 128, y + 48); g.lineTo(x + 218, y + 208); g.lineTo(x + 38, y + 208); g.closePath(); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.moveTo(x + 140, y + 80); g.lineTo(x + 104, y + 150); g.lineTo(x + 130, y + 150); g.lineTo(x + 112, y + 196); g.lineTo(x + 156, y + 128); g.lineTo(x + 130, y + 128); g.closePath(); g.fill();
  });
  // flammable: red diamond, white flame
  cell(OPY_ATL.fire, '#f2f0ea', (x, y) => {
    g.fillStyle = '#c62a1f'; g.beginPath(); g.moveTo(x + 128, y + 14); g.lineTo(x + 242, y + 128); g.lineTo(x + 128, y + 242); g.lineTo(x + 14, y + 128); g.closePath(); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 5; g.beginPath(); g.moveTo(x + 128, y + 30); g.lineTo(x + 226, y + 128); g.lineTo(x + 128, y + 226); g.lineTo(x + 30, y + 128); g.closePath(); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x + 128, y + 66); g.bezierCurveTo(x + 168, y + 110, x + 170, y + 160, x + 128, y + 176); g.bezierCurveTo(x + 86, y + 160, x + 92, y + 120, x + 112, y + 100); g.bezierCurveTo(x + 112, y + 124, x + 122, y + 128, x + 128, y + 130); g.bezierCurveTo(x + 138, y + 110, x + 128, y + 90, x + 128, y + 66); g.fill();
    g.fillRect(x + 92, y + 184, 72, 8);
  });
  // flag of the outpost: olive field, ochre band, white star
  cell(OPY_ATL.flag, '#4d5a32', (x, y) => {
    g.fillStyle = '#c9a23a'; g.fillRect(x, y + 96, 256, 64);
    g.fillStyle = '#f4f1e6'; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 18 : 42; g.lineTo(x + 64 + Math.cos(a) * r, y + 128 + Math.sin(a) * r); } g.closePath(); g.fill();
  });
  for (let k = 0; k < 3000; k++) { g.fillStyle = `rgba(${R() < 0.6 ? '255,255,250' : '50,45,40'},${R() * 0.05})`; g.fillRect(R() * 512, R() * 512, 1 + R() * 3, 1 + R() * 3); }
  const t = canvasOnce(new THREE.CanvasTexture(c)); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; t.flipY = false;
  return { map: t, normal: null };
}
function opYardKit() { TEX.opyAtlas = opyAtlas(); TEX.opyLeaf = opjLeafAtlas(); }
function opYardMaterials(M) {
  M('opyLink', { tex: 'opyLink', cut: 0.3, metal: 0.5, rough: 0.6, env: 0.6, macro: 0.1, dust: 0.25 });
  // blended rather than cut: in the distance the mesh fades to a grey veil (cut, its averaged alpha turned it into a solid grey wall)
  Object.assign(MAT.opyLink, { transparent: true, depthWrite: false, alphaTest: 0.04 }); MAT.opyLink.userData.noShadow = true;
  M('opyCorr', { tex: 'opyCorr', metal: 0.35, env: 0.7, grime: 0.7, streak: 0.5, dust: 0.4, macro: 0.25 });
  M('opyTarp', { tex: 'opyTarp', rough: 0.9, env: 0.15, macro: 0.2, dust: 0.3, grime: 0.3, side: THREE.DoubleSide });
  M('opjCanopy', { tex: 'opjCanopy', rough: 0.96, env: 0.03, macro: 0.15 });
  MAT.opjCanopy.emissiveMap = MAT.opjCanopy.map; MAT.opjCanopy.emissive = new THREE.Color(0.3, 0.32, 0.28); // (the slopes away from the sun stay green: sky light the hills' surface does not get)
  M('opyBoard', { tex: 'opyBoard', rough: 0.95, env: 0.15, grime: 0.4, streak: 0.3, dust: 0.25, macro: 0.2 });
  // the same corrugated sheet in matte paint (the guard room, the booth): the ribs by their shading only, no sheen along them
  M('opyCorrM', { tex: 'opyCorrS', metal: 0.05, rough: 0.92, env: 0.2, grime: 0.5, streak: 0.3, dust: 0.25, macro: 0.2 });
  // the shed's galvanized roof: neutral grey, a dull sheen (no sky blotches), rust and dirt from the sheet's own layers
  M('opyRoofS', { tex: 'opyCorr', metal: 0.45, rough: 0.62, env: 0.25, grime: 0.6, streak: 0.5, dust: 0.3, macro: 0.2 });
  // wheel ruts and the mud lapping over the concrete edges: decals laid on the ground (blended, no shadow, above the ground's depth)
  for (const k of ['opyRut', 'opyFilm']) {
    M(k, { tex: k, rough: 0.95, env: 0.12, macro: 0.1, noNormal: false });
    Object.assign(MAT[k], { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }); MAT[k].userData.noShadow = true;
    MAT[k].defines.WM_CUT = ''; // (their alpha kept: the track's broken edges, the spill's frayed one)
  }
  // the tower's roof: the same sheet, weathered matte (dark grey-brown, the sky hardly in it), streaked
  M('opyRoofT', { tex: 'opyCorr', metal: 0.05, rough: 0.95, env: 0.08, grime: 0.8, streak: 0.8, dust: 0.04, macro: 0.25 });
  M('rust', { tex: 'rust', metal: 0.75, ma: true, env: 0.55, macro: 0.25, grime: 0.6, streak: 0.4 });
  M('opyAtlas', { tex: 'opyAtlas', rough: 0.75, env: 0.3, macro: 0.08, scale: 1, noNormal: true });
  // the jungle's foliage (atlas of 02ypb-outpost-jungle.js): cut out, living (wind, soldiers push it), edges softened by multisampling
  M('opyLeaf', { tex: 'opyLeaf', cut: 0.4, rough: 0.82, env: 0.2, macro: 0.18, scale: 1, noNormal: true, snow: 0, color: [1, 1, 1] });
  makeLiving(MAT.opyLeaf, true); MAT.opyLeaf.alphaToCoverage = true;
  // (a floor under the leaves' shade: their own colour lit a little whatever the light, so the shadow side of a crown stays green)
  MAT.opyLeaf.emissiveMap = MAT.opyLeaf.map; MAT.opyLeaf.emissive = new THREE.Color(0.075, 0.09, 0.068);
}

/* ---------- Colors (sRGB) ---------- */
/* (olive: the command building's drab olive (OPC.olive), the same family on the tank, the booth, the drums, the radio; leaf: its door leaves) */
const OPY = {
  olive: [0.318, 0.36, 0.272], oliveDk: [0.235, 0.265, 0.2], crate: [0.318, 0.36, 0.272], leaf: [0.34, 0.378, 0.3], galv: [0.62, 0.63, 0.62], steelDk: [0.28, 0.29, 0.29],
  clad: [0.43, 0.455, 0.325], concrete: [0.78, 0.76, 0.7], timber: [0.5, 0.4, 0.3], plank: [0.62, 0.52, 0.4], ochre: [0.78, 0.66, 0.3], canvas: [0.48, 0.5, 0.36], sand: [0.72, 0.64, 0.5],
};
/* Atlas cell on a quad facing +z of the current frame (center xc, bottom y), slightly off its support */
function opyDecal(M, idx, xc, y, w, h, z = 0.006) {
  const u0 = (idx % 2) * 0.5, v0 = Math.floor(idx / 2) * 0.5, B = M.buf('opyAtlas', xc, y + h / 2, z);
  M.save().color([1, 1, 1]);
  const a = M.v(B, xc - w / 2, y, z, 0, 0, 1, u0, v0 + 0.5), b = M.v(B, xc + w / 2, y, z, 0, 0, 1, u0 + 0.5, v0 + 0.5);
  const c = M.v(B, xc + w / 2, y + h, z, 0, 0, 1, u0 + 0.5, v0), d = M.v(B, xc - w / 2, y + h, z, 0, 0, 1, u0, v0);
  M.quadI(B, a, b, c, d); M.restore();
}
/* Frame placed at (x, y, z), rotated by ry (like DECOR.place) */
function opyAt(x, y, z, ry, fn) { const M = DECOR; M.save().move(x, y, z).rotY(ry); try { fn(M); } finally { M.restore(); } }

/* ---------- Props ---------- */
/* Olive supply crate (1.2 x 0.6 x 0.8 or 0.6 x 0.4 x 0.4) */
PF.opyCrate = (w = 1.2, h = 0.6, d = 0.8, v = 0) => (w > 1 ? PF.opAmmo(0) : PF.opAmmo(1)); // the command building's ammunition crates: the under-stair olive
/* Steel locker (0.6 x 0.45, 1.85 m), olive; door toward +z: louvers, handle */
PF.opyLocker = () => prefab('opyLocker', (M, P) => {
  P.tintable = ['opPaint'];
  M.local(1); M.color([1, 1, 1]);
  M.boxB('opPaint', -0.3, 0.3, 0.05, 1.85, -0.225, 0.225, { bevel: 0.01 });
  M.color([0.2, 0.2, 0.2]); M.boxB('steel', -0.29, 0.29, 0, 0.05, -0.21, 0.21);
  M.color([0.85, 0.85, 0.85]); M.cls = 1;
  M.boxB('opPaint', -0.003, 0.003, 0.1, 1.8, 0.225, 0.229);
  for (const sx of [-0.15, 0.15]) for (let k = 0; k < 4; k++) M.boxB('dark', sx - 0.08, sx + 0.08, 1.52 + k * 0.05, 1.53 + k * 0.05, 0.226, 0.23);
  M.color([0.3, 0.3, 0.3]); for (const sx of [-0.04, 0.04]) M.boxB('steel', sx - 0.01, sx + 0.01, 0.95, 1.1, 0.225, 0.245);
  M.col(-0.3, 0.3, 0, 1.85, -0.225, 0.225, 'metal');
});
/* Folding army cot (2 x 0.72 m): olive canvas bed, steel X legs, folded blanket and pillow at one end */
PF.opyCot = () => prefab('opyCot', (M) => {
  M.local(1); M.color([0.3, 0.3, 0.28]);
  for (const sz of [-1, 1]) M.tube('steel', 0.016, [[-1.0, 0.42, sz * 0.36], [1.0, 0.42, sz * 0.36]], 5);
  for (const x of [-0.85, 0, 0.85]) for (const sd of [-1, 1]) M.tube('steel', 0.012, [[x - sd * 0.12, 0, -0.36], [x + sd * 0.12, 0.42, 0.36]], 4);
  M.color(OPY.canvas); M.surf('canvas', 6, 2, (u, v) => [lerp(-0.98, 0.98, u), 0.42 - Math.sin(u * Math.PI) * 0.04 * Math.sin(v * Math.PI), lerp(-0.35, 0.35, v)], { uL: 2, vL: 0.7, flipN: true });
  M.color([0.36, 0.38, 0.3]); M.boxB('canvas', 0.35, 0.9, 0.42, 0.52, -0.33, 0.33, { bevel: 0.04 });
  M.color([0.8, 0.78, 0.7]); M.boxB('canvas', -0.98, -0.62, 0.42, 0.53, -0.25, 0.25, { bevel: 0.05 });
  M.col(-1.0, 1.0, 0, 0.5, -0.37, 0.37, 'wood');
});
/* Field radio set (on a table): olive case, dial panel, handset on its cord, whip antenna */
PF.opyRadio = () => prefab('opyRadio', (M) => {
  M.local(1); M.color(OPY.oliveDk);
  M.boxB('opPaint', -0.22, 0.22, 0, 0.28, -0.15, 0.15, { bevel: 0.015 });
  M.color([0.12, 0.12, 0.12]); M.boxB('dark', -0.2, 0.2, 0.05, 0.25, 0.15, 0.152);
  M.color([0.75, 0.75, 0.7]); M.cls = 2;
  for (const [x, y] of [[-0.12, 0.18], [0, 0.18], [0.12, 0.18], [-0.08, 0.1], [0.08, 0.1]]) { M.save().move(x, y, 0.152).rotX(Math.PI / 2); M.cyl('steel', 0.022, 0.02, 8); M.restore(); }
  M.color([0.15, 0.15, 0.15]); M.save().move(0.17, 0.28, -0.1); M.cyl('steel', 0.006, 0.6, 4, { r1: 0.003 }); M.restore();
  M.boxB('plastic', 0.26, 0.31, 0, 0.05, -0.12, 0.08, { bevel: 0.01 });
  M.tube('rubber', 0.006, [[0.2, 0.06, 0.15], [0.27, 0.01, 0.16], [0.29, 0.03, 0.08]], 3);
});
/* Field telephone: olive box with its crank, handset on the cradle */
PF.opyPhone = () => prefab('opyPhone', (M) => {
  M.local(1); M.color(OPY.oliveDk);
  M.boxB('opPaint', -0.14, 0.14, 0, 0.12, -0.1, 0.1, { bevel: 0.01 });
  M.color([0.14, 0.14, 0.13]); M.boxB('plastic', -0.12, 0.12, 0.12, 0.17, -0.025, 0.025, { bevel: 0.015 });
  M.save().move(0.14, 0.07, 0.04).rotZ(-Math.PI / 2); M.cyl('steel', 0.008, 0.05, 4); M.restore();
  M.boxB('steel', 0.19, 0.2, 0.02, 0.08, 0.03, 0.05);
});
/* Searchlight on its post (post m): steel tube, a U-yoke on a turntable, the drum with its bezel and glass face, its cable; aimed toward +z, slightly down */
PF.opySearchlight = (post = 1.3) => prefab('opySearchlight' + post, (M) => {
  M.local(1); M.color([0.26, 0.27, 0.26]);
  M.cyl('steel', 0.12, 0.04, 10); M.cyl('steel', 0.03, post, 8);
  M.save().move(0, post, 0);
  M.cyl('steel', 0.06, 0.05, 8); // (the turntable)
  for (const sx of [-1, 1]) M.boxB('steel', sx * 0.28 - 0.02, sx * 0.28 + 0.02, 0.02, 0.36, -0.035, 0.035); // the U-yoke's arms
  M.boxB('steel', -0.3, 0.3, 0.02, 0.06, -0.04, 0.04);
  M.save().move(0, 0.3, -0.12).rotX(-0.15 - Math.PI / 2);
  M.color(OPY.oliveDk); M.cyl('opPaint', 0.24, 0.42, 14, { r1: 0.25 }); M.save().move(0, -0.06, 0); M.cyl('opPaint', 0.15, 0.08, 10); M.restore();
  M.color([0.2, 0.2, 0.19]); M.save().move(0, 0.42, 0); M.cyl('steel', 0.262, 0.035, 14, { r1: 0.258 }); M.restore(); // (the bezel)
  M.color([0.86, 0.88, 0.84]); M.save().move(0, 0.44, 0); M.cyl('lampOff', 0.225, 0.01, 14); M.restore(); // (the glass face)
  M.color([0.12, 0.12, 0.12]); M.tube('rubber', 0.008, [[0, -0.1, 0.2], [0.1, -0.3, 0.32], [0.05, -0.6, 0.4]], 4); // (the cable)
  M.restore(); M.restore();
  M.col(-0.25, 0.25, 0, post + 0.6, -0.25, 0.25, 'metal');
});
/* Binoculars set down on a ledge */
PF.opyBinoculars = () => prefab('opyBinoculars', (M) => {
  M.local(1); M.color([0.12, 0.12, 0.11]);
  for (const sx of [-0.04, 0.04]) { M.save().move(sx, 0.035, -0.08).rotX(Math.PI / 2); M.cyl('rubber', 0.033, 0.16, 8); M.restore(); }
  M.boxB('rubber', -0.04, 0.04, 0.02, 0.05, -0.02, 0.03);
});
/* Folding steel chair (olive): seat, back, tube legs */
PF.opyChair = () => prefab('opyChair', (M, P) => {
  P.tintable = ['opPaint'];
  M.local(1); M.color([1, 1, 1]);
  M.boxB('opPaint', -0.21, 0.21, 0.44, 0.47, -0.2, 0.2, { bevel: 0.01 });
  M.save().move(0, 0.47, -0.21).rotX(-0.12); M.boxB('opPaint', -0.2, 0.2, 0.18, 0.42, -0.012, 0.012, { bevel: 0.008 }); M.restore();
  M.color([0.35, 0.35, 0.33]);
  for (const sx of [-0.19, 0.19]) { M.tube('steel', 0.012, [[sx, 0, 0.2], [sx, 0.45, -0.12], [sx, 0.9, -0.27]], 4); M.tube('steel', 0.012, [[sx, 0, -0.22], [sx, 0.45, 0.12]], 4); }
  M.col(-0.22, 0.22, 0, 0.47, -0.22, 0.22, 'metal');
});
/* Field table (1.2 x 0.7 m): olive steel frame, plywood top */
PF.opyTable = (w = 1.2, d = 0.7) => prefab(`opyTable${w}_${d}`, (M) => {
  M.local(1); M.color([0.66, 0.56, 0.42]);
  M.boxB('wood', -w / 2, w / 2, 0.72, 0.75, -d / 2, d / 2, { bevel: 0.006 });
  M.color(OPY.oliveDk); M.boxB('opPaint', -w / 2 + 0.03, w / 2 - 0.03, 0.66, 0.72, -d / 2 + 0.03, d / 2 - 0.03, { skip: 'yY' });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.boxB('opPaint', sx * (w / 2 - 0.05) - 0.02, sx * (w / 2 - 0.05) + 0.02, 0, 0.72, sz * (d / 2 - 0.05) - 0.02, sz * (d / 2 - 0.05) + 0.02);
  M.col(-w / 2, w / 2, 0, 0.75, -d / 2, d / 2, 'wood');
});
/* Steel shelving (w along x, 0.5 deep, h high), four levels loaded with boxes, crates, cans and jerrycans (seeded) */
PF.opyShelf = (w = 1.8, h = 1.85, seed = 1, dbl = false) => prefab(`opyShelf${w}_${h}_${seed}_${dbl ? 1 : 0}`, (M) => {
  const R = rngOf(seed * 97 + 11), d = dbl ? 0.36 : 0.25, lv = [0.12, 0.6, 1.08, 1.56].filter((y) => y < h - 0.2);
  M.local(1); M.color([0.42, 0.44, 0.42]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.boxB('steel', sx * w / 2 - (sx > 0 ? 0.04 : 0), sx * w / 2 + (sx < 0 ? 0.04 : 0), 0, h, sz * d - (sz > 0 ? 0.04 : 0), sz * d + (sz < 0 ? 0.04 : 0));
  for (const y of lv) M.boxB('steel', -w / 2, w / 2, y, y + 0.03, -d, d);
  M.boxB('steel', -w / 2, w / 2, h - 0.03, h, -d, d);
  for (const y of lv) {
    let x = -w / 2 + 0.06;
    while (x < w / 2 - 0.25) {
      const k = R(), bw = k < 0.4 ? R.range(0.3, 0.5) : k < 0.7 ? 0.36 : R.range(0.18, 0.28), bh = Math.min(0.42, k < 0.4 ? R.range(0.22, 0.4) : k < 0.7 ? 0.32 : R.range(0.2, 0.32));
      if (x + bw > w / 2 - 0.04) break;
      if (R() < 0.18) { x += bw; continue; }
      if (k >= 0.4 && k < 0.75 && bw >= 0.3 && d * 2 >= 0.42 && y + 0.45 < h) { M.place(PF.opAmmo(1), x + 0.3, y + 0.03, 0, R.range(-0.08, 0.08), { nocol: true }); x += 0.64; continue; } // (a small olive crate)
      M.color(k < 0.4 ? R.pick([[0.3, 0.29, 0.27], [0.34, 0.32, 0.29]]) : R.pick([[0.36, 0.33, 0.27], [0.3, 0.33, 0.24], [0.33, 0.25, 0.18]]));
      M.boxB(k < 0.4 || k >= 0.75 ? 'cardboard' : 'opPaint', x, x + bw, y + 0.03, y + 0.03 + bh, -d + 0.03, d - 0.03, { bevel: 0.01 });
      x += bw + 0.04;
    }
  }
  M.col(-w / 2, w / 2, 0, h, -d, d, 'metal');
});
/* Workbench (2.4 x 0.8 m): thick plank top, olive steel drawers, vise, tools, pegboard behind (toward -z) */
PF.opyWorkbench = () => prefab('opyWorkbench', (M) => {
  M.local(1); M.color([0.62, 0.48, 0.32]);
  M.boxB('wood', -1.2, 1.2, 0.84, 0.9, -0.4, 0.4, { bevel: 0.01 });
  M.color(OPY.olive);
  for (const x0 of [-1.15, 0.55]) { M.boxB('opPaint', x0, x0 + 0.6, 0.08, 0.84, -0.36, 0.36, { bevel: 0.01 }); M.color([0.85, 0.85, 0.8]); M.cls = 1; for (let k = 0; k < 4; k++) M.boxB('steel', x0 + 0.22, x0 + 0.38, 0.22 + k * 0.17, 0.24 + k * 0.17, 0.36, 0.38); M.cls = 0; M.color(OPY.olive); }
  M.color([0.3, 0.3, 0.3]); M.boxB('steel', -0.6, 0.5, 0.08, 0.12, -0.34, 0.34);
  M.color([0.36, 0.37, 0.36]); M.boxB('opPaint', 0.9, 1.1, 0.9, 1.05, 0.15, 0.32); M.color([0.2, 0.2, 0.2]); M.boxB('steel', 0.95, 1.05, 1.05, 1.12, 0.18, 0.3); // vise
  M.color(OPY.oliveDk); M.boxB('opPaint', -0.6, -0.15, 0.9, 1.08, -0.3, -0.05, { bevel: 0.01 }); // tool box
  M.color([0.36, 0.36, 0.34]); M.boxB('paintwood', -1.2, 1.2, 0.9, 1.9, -0.42, -0.4); // pegboard
  M.cls = 2; M.color([0.25, 0.25, 0.25]);
  for (let k = 0; k < 9; k++) { const x = -1.0 + k * 0.24, l = 0.18 + (k % 3) * 0.06; M.boxB('steel', x - 0.012, x + 0.012, 1.55 - l, 1.55, -0.4, -0.38); M.boxB('steel', x - 0.03, x + 0.03, 1.55 - l - 0.04, 1.55 - l, -0.4, -0.38); }
  M.col(-1.2, 1.2, 0, 0.9, -0.4, 0.4, 'wood');
});
/* Floodlight pole (7 m): galvanized tapered pole on a concrete footing, crossbar with two lamps aimed toward +z, junction box */
PF.opyFlood = () => prefab('opyFlood', (M) => {
  M.local(1); M.color(OPY.concrete); M.boxB('concrete', -0.3, 0.3, 0, 0.35, -0.3, 0.3, { bevel: 0.03 });
  M.color(OPY.galv); M.save().move(0, 0.35, 0); M.cyl('steel', 0.11, 6.7, 8, { r1: 0.06 }); M.restore();
  M.boxB('steel', -0.6, 0.6, 6.85, 6.92, -0.04, 0.04);
  for (const sx of [-0.4, 0.4]) {
    M.save().move(sx, 6.8, 0.05).rotX(0.5); M.color([0.25, 0.26, 0.25]); M.boxB('opPaint', -0.2, 0.2, -0.14, 0.14, 0, 0.18, { bevel: 0.02 }); M.color([0.9, 0.9, 0.85]); M.boxB('lampOff', -0.17, 0.17, -0.11, 0.11, 0.18, 0.19); M.restore();
  }
  M.color([0.55, 0.56, 0.55]); M.boxB('opPaint', -0.14, 0.14, 1.2, 1.6, 0.11, 0.24, { bevel: 0.01 });
  M.col(-0.3, 0.3, 0, 0.35, -0.3, 0.3, 'concrete'); M.col(-0.12, 0.12, 0.35, 6.9, -0.12, 0.12, 'metal');
});
/* Tarped stack: two pallets end to end, two crates high (the building's ammunition crates), under an olive canvas tarp that sags between
   them and hangs in folds down the sides, lashed with a rope; mud splashed at its foot (1.4 x 1.8 m, 1.45 m) */
PF.opyTarpStack = () => prefab('opyTarpStack', (M) => {
  M.local(1);
  for (const z of [-0.42, 0.42]) { M.place(PF.pallet(), 0, 0, z, 0, { nocol: true, tint: [0.66, 0.6, 0.52] }); for (const y of [0.122, 0.722]) M.place(PF.opAmmo(0), 0, y, z, 0, { nocol: true }); }
  // the tarp: a draped surface over the top (sagging in the middle, along the join), down the sides in folds to about half height
  const hx = 0.75, hz = 0.93, top = 1.42;
  M.save().color([0.33, 0.34, 0.25]);
  M.surf('opyTarp', 16, 20, (u, v) => {
    const a = (u - 0.5) * 2, b = (v - 0.5) * 2, ea = Math.abs(a), eb = Math.abs(b), m = Math.max(ea, eb);
    // the top (inside 0.7) flat but for the sag; beyond, the cloth turns down the sides, its hem wavy
    const k = smoothstep(0.62, 1, m), fold = Math.sin((ea > eb ? b : a) * 11 + (ea > eb ? 1 : 2)) * 0.03 * k;
    const y = top - 0.05 * (1 - Math.abs(b)) * (1 - k) - k * (0.6 + 0.25 * Math.sin(a * 5 + b * 3)), sx = ea > eb ? Math.sign(a) * (hx + fold) : a * hx, sz = ea > eb ? b * hz : Math.sign(b) * (hz + fold);
    return [m > 0.62 ? sx : a * hx, y, m > 0.62 ? sz : b * hz];
  }, { uL: 1.5, vL: 1.9, flipN: true });
  M.color([0.42, 0.37, 0.27]); M.cls = 2; for (const z of [-0.5, 0.5]) M.tube('canvas', 0.012, [[-hx - 0.02, 0.75, z], [-hx - 0.01, top + 0.02, z], [hx + 0.01, top + 0.02, z], [hx + 0.02, 0.75, z]], 4); // (the rope)
  M.cls = 1; M.color([0.33, 0.27, 0.21]); for (let k = 0; k < 4; k++) { M.save().rotY((k * Math.PI) / 2); const w = k % 2 ? hx : hz, o = k % 2 ? hz : hx; opyStainQ(M, OPW.splash, [[-w, 0, o + 0.02], [w, 0, o + 0.02], [w, 0.38, o + 0.02], [-w, 0.38, o + 0.02]], [0, 0, 1]); M.restore(); }
  M.restore();
  M.col(-0.62, 0.62, 0, 1.42, -0.84, 0.84, 'wood');
});
/* Generator set on its skid (1.4 x 1.5 m, 1.75 m to the top of its hood; the exhaust to 2 m): olive enclosure with louvres, a door
   panel and its latches, the exhaust stack with its rain cap, a lifting eye, the cable to the building on the
   ground, oil and mud at its foot (it stops sight lines: the long view down the gate lane ends there) */
PF.opyGenset = () => prefab('opyGenset', (M) => {
  M.local(1); M.color(OPY.steelDk);
  for (const sx of [-1, 1]) M.boxB('steel', sx * 0.68 - 0.04, sx * 0.68 + 0.04, 0, 0.12, -0.75, 0.75);
  for (const z of [-0.7, 0.7]) M.boxB('steel', -0.68, 0.68, 0.02, 0.1, z - 0.04, z + 0.04);
  M.color(OPY.olive); M.boxB('opPaint', -0.64, 0.64, 0.12, 1.67, -0.7, 0.7, { bevel: 0.025 });
  M.color(OPY.oliveDk); M.boxB('opPaint', -0.66, 0.66, 1.64, 1.7, -0.72, 0.72, { bevel: 0.015 }); // (the hood's lip)
  M.cls = 2; M.color([0.13, 0.14, 0.11]);
  for (const sx of [-1, 1]) for (let k = 0; k < 7; k++) { const y = 0.95 + k * 0.08; M.boxB('opPaint', sx * 0.64 - 0.008, sx * 0.64 + 0.008, y, y + 0.035, -0.5, 0.5); } // louvres, both flanks
  M.color([0.2, 0.22, 0.16]); for (const z of [-0.45, 0.45]) M.boxB('opPaint', -0.5, 0.5, 0.3, 0.31, z > 0 ? 0.7 : -0.71, z > 0 ? 0.71 : -0.7); // (the door panel's seams)
  for (const x of [-0.5, 0.5]) M.boxB('opPaint', x - 0.005, x + 0.005, 0.3, 1.45, 0.7, 0.712);
  M.boxB('opPaint', -0.5, 0.5, 1.44, 1.45, 0.7, 0.712);
  M.color([0.62, 0.63, 0.6]); for (const y of [0.55, 1.2]) M.boxB('steel', 0.36, 0.44, y, y + 0.03, 0.71, 0.74); // latches
  M.cls = 0; M.color([0.24, 0.23, 0.22]);
  M.save().move(-0.35, 1.7, -0.35); M.cyl('steel', 0.05, 0.3, 8); M.save().move(0, 0.3, 0); M.cyl('steel', 0.07, 0.03, 8, { r1: 0.02 }); M.restore(); M.restore(); // exhaust, rain cap
  M.save().move(0.2, 1.7, 0); M.lathe('steel', [[0.0, 0.0], [0.04, 0.0], [0.04, 0.02], [0.0, 0.08]], 8); M.restore(); // (lifting eye's boss)
  M.cls = 2; M.color([0.08, 0.08, 0.08]); M.tube('opPaint', 0.02, [[-0.64, 0.4, 0.3], [-0.9, 0.05, 0.4], [-1.3, 0.02, 0.6]], 5); M.cls = 0; // (the cable, to the building)
  M.cls = 1; M.color([0.2, 0.18, 0.15]); for (let k = 0; k < 4; k++) { M.save().rotY((k * Math.PI) / 2); const w = k % 2 ? 0.72 : 0.66, o = k % 2 ? 0.66 : 0.72; opyStainQ(M, OPW.splash, [[-w, 0, o + 0.02], [w, 0, o + 0.02], [w, 0.3, o + 0.02], [-w, 0.3, o + 0.02]], [0, 0, 1]); M.restore(); }
  M.col(-0.7, 0.7, 0, 1.75, -0.75, 0.75, 'metal');
});
/* Drum rack (the water tank's footprint, 2.2 x 2.2 m): a low steel frame with two tiers of drums, a third on top in one corner */
PF.opyDrumRack = () => prefab('opyDrumRack', (M) => {
  M.local(1); M.color(OPY.steelDk);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.boxB('steel', sx * 1.0 - 0.04, sx * 1.0 + 0.04, 0, 1.9, sz * 1.0 - 0.04, sz * 1.0 + 0.04);
  for (const y of [0.08, 0.98]) { M.boxB('steel', -1.04, 1.04, y, y + 0.06, -1.04, 1.04); }
  const R = rngOf(57); for (const y of [0.14, 1.04]) for (const x of [-0.6, 0, 0.6]) for (const z of [-0.6, 0, 0.6]) { if (R() < 0.12) continue; M.place(PF.barrel(), x, y, z, R() * TAU, { tint: R.pick([OPY.olive, OPY.oliveDk, [0.46, 0.43, 0.32], [0.38, 0.23, 0.15]]), nocol: true }); }
  M.col(-1.05, 1.05, 0, 1.95, -1.05, 1.05, 'metal');
});
/* Water tank on its steel stand: 2.3 m vertical olive drab tank (matte paint) on a 1.6 m platform, ladder, outlet pipe and tap */
PF.opyWaterTank = () => prefab('opyWaterTank', (M) => {
  M.local(1); M.color(OPY.steelDk);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { M.boxB('steel', sx * 1.0 - 0.05, sx * 1.0 + 0.05, 0, 1.6, sz * 1.0 - 0.05, sz * 1.0 + 0.05); M.save().move(sx * 1.0, 0, sz * 1.0); M.boxB('concrete', -0.15, 0.15, 0, 0.12, -0.15, 0.15); M.restore(); }
  for (const y of [0.5, 1.5]) { M.boxB('steel', -1.0, 1.0, y, y + 0.08, -1.04, -0.96); M.boxB('steel', -1.0, 1.0, y, y + 0.08, 0.96, 1.04); M.boxB('steel', -1.04, -0.96, y, y + 0.08, -1.0, 1.0); M.boxB('steel', 0.96, 1.04, y, y + 0.08, -1.0, 1.0); }
  M.cls = 1; for (const sd of [-1, 1]) { M.tube('steel', 0.02, [[-1.0, 0.1, sd * 1.0], [1.0, 1.5, sd * 1.0]], 4); M.tube('steel', 0.02, [[sd * 1.0, 0.1, -1.0], [sd * 1.0, 1.5, 1.0]], 4); } M.cls = 0;
  M.boxB('steel', -1.1, 1.1, 1.6, 1.68, -1.1, 1.1);
  M.color([0.29, 0.33, 0.25]); M.save().move(0, 1.68, 0); M.lathe('opPaint', [[0, 0], [1.05, 0], [1.08, 0.08], [1.08, 2.2], [1.02, 2.3], [0.5, 2.42], [0, 2.44]], 18, { sharp: 0.5, uR: 1.08 });
  M.color([0.24, 0.27, 0.2]); for (const y of [0.35, 0.8, 1.25, 1.7]) { M.save().move(0, y, 0); M.cyl('opPaint', 1.095, 0.05, 18); M.restore(); } // (ribs)
  M.color([0.22, 0.25, 0.19]); M.cls = 1; for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU + 0.4; M.save().move(Math.cos(a) * 1.085, 0, Math.sin(a) * 1.085).rotY(-a); M.boxB('opPaint', -0.012, 0.012, 0.08, 2.2, -0.014, 0.014); M.restore(); } // (weld seams)
  for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU + 0.15; M.save().move(Math.cos(a) * 1.087, 0, Math.sin(a) * 1.087).rotY(Math.PI / 2 - a); M.color(k % 2 ? [0.34, 0.24, 0.15] : [0.26, 0.27, 0.22]); opyStainQ(M, k % 2 ? OPW.drip0 : OPW.drip1, [[-0.32, 1.1, 0], [0.32, 1.1, 0], [0.32, 2.25, 0], [-0.32, 2.25, 0]], [0, 0, 1]); M.restore(); } // (streaks from the top)
  M.save().move(0, 0, 1.088); M.color([0.8, 0.79, 0.7]); for (let k = 0; k < 5; k++) M.boxB('opPaint', -0.34 + k * 0.15, -0.34 + k * 0.15 + 0.09, 1.15, 1.32, 0, 0.004); M.boxB('opPaint', -0.34, 0.37, 1.02, 1.05, 0, 0.004); M.restore(); M.cls = 0; // (a stencil: WATER)
  M.color([0.3, 0.3, 0.3]); M.save().move(0.4, 2.42, 0); M.cyl('steel', 0.18, 0.08, 8); M.restore(); M.restore();
  M.color([0.32, 0.32, 0.3]); M.tube('steel', 0.04, [[0, 1.68, 0], [0, 1.2, 0], [0.6, 0.8, 0.3], [0.6, 0.6, 1.25]], 6);
  M.boxB('steel', 0.55, 0.65, 0.5, 0.62, 1.2, 1.32);
  for (let k = 0; k < 7; k++) M.boxB('steel', -1.25, -1.13, 0.25 + k * 0.48, 0.28 + k * 0.48, -0.25, 0.25); // ladder rungs
  for (const sz of [-0.25, 0.25]) M.boxB('steel', -1.22, -1.16, 0, 3.6, sz - 0.03, sz + 0.03);
  M.col(-1.1, 1.1, 0.0, 1.68, -1.1, 1.1, 'metal', true); // (open stand: the legs stop soldiers, see below; the frame shots)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.col(sx * 1.0 - 0.08, sx * 1.0 + 0.08, 0, 1.68, sz * 1.0 - 0.08, sz * 1.0 + 0.08, 'metal');
  M.col(-1.1, 1.1, 1.68, 4.12, -1.1, 1.1, 'metal');
});
/* Guard booth (1.9 x 1.9 m): olive corrugated walls, window band on three sides, door on the back (-z), flat roof with an overhang;
   closed: a block of cover (its glass stops soldiers, not shots) */
PF.opyBooth = () => prefab('opyBooth', (M) => {
  const h = 2.5, e = 0.95;
  M.local(1); M.color(OPY.concrete); M.boxB('concrete', -1.05, 1.05, 0, 0.12, -1.05, 1.05, { bevel: 0.02 });
  M.color(OPY.clad); M.world(1);
  M.boxB('opyCorrM', -e, e, 0.12, 1.1, -e, e); // lower half
  for (const [x0, x1] of [[-e, -e + 0.12], [e - 0.12, e]]) M.boxB('opyCorrM', x0, x1, 1.1, h, -e, e); // corner posts (x sides)
  M.boxB('opyCorrM', -e, e, 2.1, h, -e, e, { skip: 'y' });
  M.local(1); M.color([0.2, 0.24, 0.26]);
  for (const [n, p0, p1, p2, p3] of [[[0, 0, 1], [-e + 0.12, 1.1, e + 0.002], [e - 0.12, 1.1, e + 0.002], [e - 0.12, 2.1, e + 0.002], [-e + 0.12, 2.1, e + 0.002]],
    [[1, 0, 0], [e + 0.002, 1.1, e - 0.05], [e + 0.002, 1.1, -e + 0.05], [e + 0.002, 2.1, -e + 0.05], [e + 0.002, 2.1, e - 0.05]],
    [[-1, 0, 0], [-e - 0.002, 1.1, -e + 0.05], [-e - 0.002, 1.1, e - 0.05], [-e - 0.002, 2.1, e - 0.05], [-e - 0.002, 2.1, -e + 0.05]]]) M.quad('glass', p0, p1, p2, p3, n);
  M.color([0.12, 0.12, 0.12]); M.quad('dark', [-e + 0.12, 1.1, -e - 0.002], [e - 0.12, 1.1, -e - 0.002], [e - 0.12, 2.1, -e - 0.002], [-e + 0.12, 2.1, -e - 0.002], [0, 0, -1]);
  M.color(OPY.leaf); M.boxB('opPaint', -0.4, 0.4, 0.12, 2.05, -e - 0.03, -e, { bevel: 0.01 }); // door
  M.color([0.55, 0.55, 0.52]); M.boxB('steel', -1.25, 1.25, h, h + 0.1, -1.25, 1.25, { bevel: 0.02 });
  M.color([0.9, 0.9, 0.85]); M.boxB('lampOff', -0.15, 0.15, h - 0.08, h, e, e + 0.12);
  M.col(-1.0, 1.0, 0, h + 0.1, -1.0, 1.0, 'metal');
});
/* Barrier arm (5.5 m) raised on its post: concrete footing, olive housing, red and white pole at about 80 degrees, counterweight */
PF.opyBarrier = () => prefab('opyBarrier', (M) => {
  M.local(1); M.color(OPY.concrete); M.boxB('concrete', -0.35, 0.35, 0, 0.15, -0.35, 0.35, { bevel: 0.02 });
  M.color(OPY.olive); M.boxB('opPaint', -0.2, 0.2, 0.15, 1.1, -0.2, 0.2, { bevel: 0.02 });
  M.save().move(0, 1.0, 0.24).rotX(-0.22);
  for (let k = 0; k < 11; k++) { M.color(k % 2 ? [0.92, 0.92, 0.9] : [0.75, 0.12, 0.08]); M.boxB('opPaint', -0.05, 0.05, k * 0.5, (k + 1) * 0.5, -0.05, 0.05); }
  M.color([0.25, 0.25, 0.25]); M.boxB('steel', -0.09, 0.09, -0.7, 0, -0.09, 0.09);
  M.restore();
  M.col(-0.25, 0.25, 0, 1.1, -0.25, 0.25, 'metal');
});
/* Flagpole (8 m) on a concrete base, with the outpost flag (simulated cloth: it floats in the wind) */
function opyFlagpole(x, z) {
  const M = DECOR;
  M.save().move(x, 0, z).color(OPY.concrete).local(1);
  M.boxB('concrete', -0.45, 0.45, 0, 0.3, -0.45, 0.45, { bevel: 0.03 });
  M.color([0.85, 0.85, 0.82]); M.save().move(0, 0.3, 0); M.cyl('steel', 0.055, 7.7, 8, { r1: 0.035 }); M.restore();
  M.save().move(0, 8.0, 0); M.color([0.75, 0.62, 0.25]); M.lathe('steel', [[0, 0], [0.06, 0.02], [0.07, 0.08], [0.04, 0.14], [0, 0.15]], 8); M.restore();
  M.color([0.85, 0.85, 0.82]); M.cls = 2; M.tube('plastic', 0.004, [[0.06, 0.6, 0], [0.06, 7.9, 0]], 3);
  M.restore();
  DECOR.col(x - 0.45, x + 0.45, 0, 0.3, z - 0.45, z + 0.45, 'concrete'); DECOR.col(x - 0.07, x + 0.07, 0.3, 8.0, z - 0.07, z + 0.07, 'metal');
  // the flag (1.8 x 1.2 m, olive): simulated cloth held by the pole, it floats in the wind
  M.save().move(x + 0.06, 6.6, z).color(OPY.olive).local(1);
  clothPiece(M, [0, 0.05, 0], [1.8, 0, 0], [1.8, 1.15, 0], [0, 1.2, 0], [0, 0, 1], { hoist: true, clothKind: 'flagCloth', grp: 'opyFlag' + x + ',' + z });
  M.restore();
}
/* Steel radio mast (h m): self-supporting triangular lattice tapering from 0.75 to 0.3 m, antennas and a small dish at the top */
function opyMast(x, z, h) {
  const M = DECOR, r0 = 0.75, r1 = 0.3;
  M.save().move(x, 0, z).color(OPY.concrete).local(1);
  M.boxB('concrete', -0.9, 0.9, 0, 0.25, -0.9, 0.9, { bevel: 0.03 });
  M.color([0.72, 0.72, 0.7]); M.cls = 1;
  const leg = (k, y) => { const r = lerp(r0, r1, y / h); return [Math.cos((k / 3) * TAU) * r, y, Math.sin((k / 3) * TAU) * r]; };
  for (let k = 0; k < 3; k++) M.tube('steel', 0.03, [leg(k, 0.25), leg(k, h)], 5);
  for (let y = 0.25; y < h - 0.5; y += 0.9) for (let k = 0; k < 3; k++) { M.tube('steel', 0.012, [leg(k, y), leg(k + 1, y + 0.9)], 3); M.tube('steel', 0.012, [leg(k, y), leg(k + 1, y)], 3); }
  M.color([0.85, 0.86, 0.85]);
  for (let k = 0; k < 3; k++) { const [a, , b] = leg(k, h); M.save().move(a * 1.6, h - 1.6, b * 1.6); M.cyl('plastic', 0.06, 1.8, 6); M.restore(); }
  M.save().move(0.45, h - 3, 0).rotZ(-Math.PI / 2); M.lathe('steel', [[0, 0], [0.3, 0.06], [0.42, 0.14], [0.43, 0.16]], 12); M.restore();
  M.restore();
  DECOR.col(x - 0.9, x + 0.9, 0, 0.25, z - 0.9, z + 0.9, 'concrete'); DECOR.col(x - 0.45, x + 0.45, 0.25, h, z - 0.45, z + 0.45, 'metal', true);
  glassWall(x - 0.5, x + 0.5, 0.25, h, z - 0.5, z + 0.5);
}

/* ---------- Static cover pieces (one collision each) ---------- */
/* Olive supply crates on pallets at (x, z), rotated by ry (sheet 4: stacks one or two high, mixed footprints; three high one in four at
   most). kind 'S': a crate on its pallet, a small one on top (1.1 m); 'D': two pallets of two (2.6 x 0.8 x 1.3 m); 'Q': four pallets in a
   square, two of them two high (2.6 x 1.7, 0.7 and 1.3 m); 'L': an L of three pallets, one two high; 'H': one column of three (1.8 m, stops
   sight); 'B': two pallets of three (2.6 x 0.8 x 1.9 m, stops sight; a top crate sometimes missing). Crates in three finish variants */
function opyCrateStack(x, z, ry, kind, seed = 1) {
  const R = rngOf(seed * 13 + 7), tint = () => [OPY.crate[0] * R.range(0.94, 1.05), OPY.crate[1] * R.range(0.95, 1.04), OPY.crate[2] * R.range(0.92, 1.05)];
  const crate = (M, lx, y, lz, rot = 0) => M.place(PF.opyCrate(1.2, 0.6, 0.8), lx, y, lz, rot + R.range(-0.02, 0.02), { nocol: true });
  const small = (M, lx, y, lz) => M.place(PF.opyCrate(0.6, 0.4, 0.4, Math.floor(R() * 3)), lx, y, lz, R.range(-0.3, 0.3), { nocol: true });
  const pal = (M, lx, lz, rot = 0) => M.place(PF.pallet(), lx, 0, lz, rot + R.range(-0.02, 0.02), { nocol: true, tint: [0.66, 0.6, 0.52] }), P0 = 0.122;
  let cols;
  opyAt(x, 0, z, ry, (M) => {
    if (kind === 'S') { pal(M, 0, 0); crate(M, 0, P0, 0); small(M, R.range(-0.2, 0.2), P0 + 0.6, R.range(-0.1, 0.1)); cols = [[-0.62, 0.62, 0, P0 + 1.0, -0.42, 0.42]]; }
    else if (kind === 'D') { for (const lx of [-0.64, 0.64]) { pal(M, lx, 0); crate(M, lx, P0, 0); crate(M, lx, P0 + 0.6, 0); } cols = [[-1.26, 1.26, 0, P0 + 1.2, -0.42, 0.42]]; }
    else if (kind === 'Q') { for (const lx of [-0.64, 0.64]) for (const lz of [-0.43, 0.43]) { pal(M, lx, lz); crate(M, lx, P0, lz); } for (const lx of [-0.64, 0.64]) crate(M, lx, P0 + 0.6, -0.43); cols = [[-1.26, 1.26, 0, P0 + 0.6, -0.85, 0.85], [-1.26, 1.26, P0 + 0.6, P0 + 1.2, -0.85, 0.0]]; }
    else if (kind === 'L') { for (const lx of [-0.64, 0.64]) { pal(M, lx, 0); crate(M, lx, P0, 0); } crate(M, -0.64, P0 + 0.6, 0); pal(M, 1.06, 1.05, Math.PI / 2); crate(M, 1.06, P0, 1.05, Math.PI / 2); small(M, 0.6, P0 + 0.6, 0.05); cols = [[-1.26, 1.26, 0, P0 + 0.6, -0.42, 0.42], [-1.26, 0.0, P0 + 0.6, P0 + 1.2, -0.42, 0.42], [0.62, 1.5, 0, P0 + 0.6, 0.42, 1.68]]; }
    else if (kind === 'H') { pal(M, 0, 0); for (const y of [0, 0.6, 1.2]) crate(M, 0, P0 + y, 0); cols = [[-0.62, 0.62, 0, P0 + 1.8, -0.42, 0.42]]; }
    else { for (const lx of [-0.64, 0.64]) { pal(M, lx, 0); for (const y of [0, 0.6, 1.2]) if (y < 1 || lx < 0 || R() < 0.6) crate(M, lx, P0 + y, 0); } cols = [[-1.26, 1.26, 0, P0 + 1.8, -0.42, 0.42]]; }
  });
  colShape(x, 0, z, ry, cols, 'wood');
  // mud splashed up the stack's foot (the pallets and the bottom crates), a stencilled number on its long faces
  opyAt(x, 0, z, ry, (M) => {
    const [x0, x1, , yt, z0, z1] = cols[0]; M.save(); M.cls = 1;
    for (const [a, b, c, d, n] of [[x0, x1, z1 + 0.01, z1 + 0.01, [0, 0, 1]], [x1, x0, z0 - 0.01, z0 - 0.01, [0, 0, -1]]]) {
      M.color([0.33, 0.27, 0.21]); opyStainQ(M, OPW.splash, [[a, 0.0, c], [b, 0.0, d], [b, 0.4, d], [a, 0.4, c]], n);
      M.color([0.78, 0.76, 0.68]); const xm = (a + b) / 2 + R.range(-0.3, 0.3), sg = Math.sign(b - a); if (yt > 0.6) opyStainQ(M, OPW.wear, [[xm - sg * 0.22, 0.32, c + n[2] * 0.004], [xm + sg * 0.22, 0.32, c + n[2] * 0.004], [xm + sg * 0.22, 0.42, d + n[2] * 0.004], [xm - sg * 0.22, 0.42, d + n[2] * 0.004]], n);
    }
    M.restore();
  });
}
/* Wooden crates on a pallet (cover 1 to 1.7 m), weathered tan-brown */
function opyWoodStack(x, z, ry, seed = 1) {
  const R = rngOf(seed * 17 + 3), t = () => [0.6 * R.range(0.93, 1.05), 0.6 * R.range(0.94, 1.04), 0.62 * R.range(0.92, 1.04)]; // (the crate texture is orange: weathered, greyer)
  opyAt(x, 0, z, ry, (M) => {
    M.place(PF.pallet(), 0, 0, 0, 0, { nocol: true, tint: [0.62, 0.6, 0.6] });
    M.place(PF.crate(0.9), -0.15, 0.122, 0.0, R.range(-0.1, 0.1), { nocol: true, tint: t() });
    if (R() < 0.7) M.place(PF.crate(0.7), 0.2, 1.022, -0.02, R.range(-0.3, 0.3), { nocol: true, tint: t() });
  });
  colShape(x, 0, z, ry, [[-0.6, 0.6, 0, 0.122, -0.4, 0.4], [-0.6, 0.3, 0.122, 1.02, -0.45, 0.45]], 'wood');
}
/* Static sandbag wall (scenery bags, one collision): centered (cx, cz), len long, rotated by rot (along x at 0), rows of 0.22 m */
function opyBags(cx, cz, len, rot, rows = 4, seed = 1, y = 0) {
  const R = rngOf(seed * 29 + Math.round(cx * 7 + cz * 13)), n = Math.max(1, Math.round(len / 0.6)), step = len / n;
  opyAt(cx, y, cz, rot, (M) => {
    for (let r = 0; r < rows; r++) {
      const odd = r % 2, cnt = n - odd;
      for (let i = 0; i < cnt; i++) {
        if (r === rows - 1 && (i === 0 || i === cnt - 1) && R() < 0.35) continue;
        const a = -len / 2 + step * (i + 0.5 + odd * 0.5), t = sandbagTint([0.5, 0.47, 0.36], R); // (matte khaki burlap)
        M.place(PF.sandbagFat(), a, r * 0.22, R.range(-0.02, 0.02), R.range(-0.05, 0.05) + (R() < 0.5 ? Math.PI : 0), { tint: t, nocol: true, s: step / 0.6 });
      }
    }
  });
  colShape(cx, y, cz, rot, [[-len / 2, len / 2, 0, rows * 0.22 - 0.06, -0.2, 0.2]], 'dirt');
}
/* Jersey barrier (sheet 4: mid-grey cast concrete, streaked, mud splashed on its foot, two lifting slots); along x or z, full collision */
/* A stain decal (the building's wear atlas, OPW) on a quad P0..P3 (bottom left, bottom right, top right, top left), normal n */
function opyStainQ(M, cell, P, n) {
  const [cx, cy, cw, ch] = cell, u0 = cx / 1024, du = cw / 1024, v0 = cy / 1024, dv = ch / 1024;
  M.save().local(1); M.uvS = 1; M.uvO = [0, 0];
  const B = M.buf('opStain', (P[0][0] + P[2][0]) / 2, (P[0][1] + P[2][1]) / 2, (P[0][2] + P[2][2]) / 2);
  const ids = P.map((q, k) => M.v(B, q[0], q[1], q[2], n[0], n[1], n[2], u0 + du * (k === 1 || k === 2 ? 1 : 0), v0 + dv * (k < 2 ? 1 : 0)));
  M.quadI(B, ids[0], ids[1], ids[2], ids[3]); M.restore();
}
/* Jersey barrier (len m, along z): mid-grey weathered concrete, drip stains running down from the top, mud splashed up its foot in the
   earth's colour (a soft gradient, 10 to 25 cm) */
PF.opyJersey = (len) => prefab('opyJersey' + len.toFixed(2), (M) => {
  const pr = [[-0.31, 0], [0.31, 0], [0.31, 0.075], [0.2, 0.3], [0.085, 0.8], [0.06, 0.87], [-0.06, 0.87], [-0.085, 0.8], [-0.2, 0.3], [-0.31, 0.075]], R = rngOf(Math.round(len * 100) + 7);
  M.local(1); M.color([0.47, 0.47, 0.48]); M.aoFn = (x, y) => lerp(0.78, 1, smoothstep(0, 0.35, y));
  M.save().move(0, 0, -len / 2 + 0.03); M.extrude('concrete', pr, len - 0.06, { sharp: 0.3 }); M.restore(); M.aoFn = null;
  M.cls = 1;
  for (const sx of [-1, 1]) {
    // the faces: lower slope (0.075 to 0.3 m) and upper (0.3 to 0.8 m), 3 mm proud; their outward normals
    const lo = (z, y) => [sx * (0.31 - ((y - 0.075) / 0.225) * 0.11 + 0.003), y, z], up = (z, y) => [sx * (0.2 - ((y - 0.3) / 0.5) * 0.115 + 0.003), y, z];
    const nl = [sx * 0.9, 0.44, 0], nu = [sx * 0.975, 0.22, 0], zs = (z) => sx > 0 ? z : -z; // (the quads wound outward on both sides)
    const z0 = -len / 2 + 0.05, z1 = len / 2 - 0.05;
    M.color([0.33, 0.27, 0.21]); // mud in the earth's colour, splashed up the foot
    opyStainQ(M, OPW.splash, [[0.31 * sx + 0.003 * sx, 0.002, zs(z0)], [0.31 * sx + 0.003 * sx, 0.002, zs(z1)], lo(zs(z1), 0.2), lo(zs(z0), 0.2)].map((q, k) => (k === 0 || k === 1 ? q : q)), nl);
    opyStainQ(M, OPW.splash, [lo(zs(z0), 0.075), lo(zs(z1), 0.075), lo(zs(z1), 0.29), lo(zs(z0), 0.29)], nl);
    M.color([0.28, 0.27, 0.25]); // drips from the top
    for (let k = 0; k < 2; k++) { const zc = R.range(-len / 2 + 0.5, len / 2 - 0.5), wd = R.range(0.35, 0.6); opyStainQ(M, k ? OPW.drip0 : OPW.drip1, [up(zs(zc - wd), 0.36), up(zs(zc + wd), 0.36), up(zs(zc + wd), 0.79), up(zs(zc - wd), 0.79)], nu); }
  }
});
/* Barrier at (cx, cz), len m long, along x (axis 'x') or z, turned a by off its axis (rad): its collision turned with it */
function opyJersey(cx, cz, len, axis, a = 0) {
  const ry = (axis === 'x' ? Math.PI / 2 : 0) + a;
  DECOR.place(PF.opyJersey(len), cx, 0, cz, ry, { nocol: true });
  colShape(cx, 0, cz, ry, [[-0.26, 0.26, 0, 0.87, -len / 2 + 0.05, len / 2 - 0.05]], 'concrete');
}
/* Drums: a cluster of n 200 L drums at (x, y, z) (olive, khaki, rust), 0.66 m apart in a triangle (their boxes do not enter each other);
   fixed scenery with their collisions (as physics props they rendered untinted, white, on this map) */
function opyDrums(x, z, n, seed = 1, tint, y = 0) {
  const R = rngOf(seed * 41 + 9), P = [[0, 0], [0.66, 0], [0.33, 0.58], [-0.33, 0.58], [0.99, 0.58], [1.32, 0]];
  for (let i = 0; i < n; i++) { const [dx, dz] = P[i % P.length]; DECOR.place(PF.barrel(), x + dx, y, z + dz, (Math.floor(R() * 4) * Math.PI) / 2, { tint: tint || R.pick([OPY.olive, OPY.oliveDk, [0.46, 0.43, 0.32], [0.38, 0.23, 0.15]]) }); }
}

/* ---------- Perimeter fence ---------- */
/* Compound fence (sheet 4: compact, the building dominant): rectangle x -23 to 23, z -21 to 21 */
const OP_FENCE = { x0: -23, x1: 23, z0: -21, z1: 21 };
/* Ways in: gates (x range, on the north and south fences), cuts in the same fences (x range: west corner, middle), side breaches (z range, both halves), fence height */
const OPY_GATE = [3, 9], OPY_CUT = [-21.4, -18.6], OPY_CUT2 = [-8.4, -5.6], OPY_BREACH = [12.4, 15.4], OPY_FH = 2.4;
/* Straight chain-link run from (xa, za) to (xb, zb) (along x or z): galvanized posts (12 cm) about every 3 m on concrete footings, mesh
   panels of dark wire (a third of their area: a band at any distance) between a heavy top rail and a tension wire, three strands of barbed wire on arms leaning outward
   (out: +1 or -1 along the normal); collision for soldiers only (shots and sight go through the mesh) up to 3.2 m */
function opyFence(xa, za, xb, zb, out = 1) {
  const M = DECOR, L = hyp(xb - xa, zb - za); if (L < 0.2) return;
  const n = Math.max(1, Math.round(L / 3)), ux = (xb - xa) / L, uz = (zb - za) / L, nx = uz * out, nz = -ux * out, H = OPY_FH;
  const p = (t, y, o = 0) => [xa + ux * t + nx * o, y, za + uz * t + nz * o];
  M.save().color([0.9, 0.9, 0.88]).local(1); M.cls = 1;
  for (let i = 0; i < n; i++) { const a = (i / n) * L, b = ((i + 1) / n) * L; M.quad('opyLink', p(a, 0.05), p(b, 0.05), p(b, H - 0.03), p(a, H - 0.03), [nx, 0, nz], { uv: [[a, 0.05], [b, 0.05], [b, H - 0.03], [a, H - 0.03]] }); }
  M.color(OPY.galv);
  M.tube('steel', 0.036, [p(0, H - 0.02), p(L, H - 0.02)], 6); M.tube('steel', 0.008, [p(0, 0.08), p(L, 0.08)], 3);
  M.color([0.34, 0.34, 0.32]);
  for (let k = 0; k < 3; k++) M.tube('steel', 0.011, [p(0, H + 0.12 + k * 0.14, 0.1 + k * 0.12), p(L, H + 0.12 + k * 0.14, 0.1 + k * 0.12)], 3); // barbed wire strands
  M.cls = 2;
  for (let t = 0.3; t < L; t += 0.3) for (let k = 0; k < 3; k++) { const q = p(t + k * 0.1, H + 0.12 + k * 0.14, 0.1 + k * 0.12); M.boxB('steel', q[0] - 0.022, q[0] + 0.022, q[1] - 0.022, q[1] + 0.022, q[2] - 0.022, q[2] + 0.022, { skip: 'yY' }); } // barbs
  M.cls = 0; M.color(OPY.galv);
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * L, q = p(t, 0);
    M.save().move(q[0], 0, q[2]); M.cyl('steel', 0.06, H + 0.06, 8); M.color([0.62, 0.61, 0.58]); M.cyl('concrete', 0.14, 0.1, 8);
    M.color([0.36, 0.21, 0.12]); M.cls = 1; for (let k = 0; k < 4; k++) { M.save().rotY((k * Math.PI) / 2); opyStainQ(M, OPW.splash, [[-0.06, 0.1, 0.062], [0.06, 0.1, 0.062], [0.06, 0.55, 0.062], [-0.06, 0.55, 0.062]], [0, 0, 1]); M.restore(); } M.cls = 0; // (rust at the foot)
    M.color(OPY.galv); M.restore();
    M.tube('steel', 0.03, [p(t, H, 0), p(t, H + 0.46, 0.38)], 4); // arm
  }
  M.restore();
  const t = 0.06, x0 = Math.min(xa, xb) - (Math.abs(uz) > 0.5 ? t : 0), x1 = Math.max(xa, xb) + (Math.abs(uz) > 0.5 ? t : 0), z0 = Math.min(za, zb) - (Math.abs(ux) > 0.5 ? t : 0), z1 = Math.max(za, zb) + (Math.abs(ux) > 0.5 ? t : 0);
  COL.push({ x0, x1, y0: 0, y1: 3.2, z0, z1, m: 'metal', ray: false, noRay: true });
}
/* Concrete pillar (sheet 4: plain weathered concrete, square, capped, 2.9 m) */
function opyGatePost(x, z) {
  const M = DECOR;
  M.save().move(x, 0, z).color([0.6, 0.585, 0.56]).world(1);
  M.boxB('opPanel', -0.25, 0.25, 0, 2.8, -0.25, 0.25, { bevel: 0.02 }); M.local(1); M.color([0.62, 0.6, 0.57]); M.boxB('concrete', -0.31, 0.31, 2.8, 2.96, -0.31, 0.31, { bevel: 0.03 });
  M.color([0.33, 0.27, 0.21]); M.cls = 1; // mud splashed up the foot (a soft gradient), drips under the cap
  for (let k = 0; k < 4; k++) { M.save().rotY((k * Math.PI) / 2); opyStainQ(M, OPW.splash, [[-0.25, 0.0, 0.253], [0.25, 0.0, 0.253], [0.25, 0.32, 0.253], [-0.25, 0.32, 0.253]], [0, 0, 1]); M.color([0.36, 0.35, 0.33]); opyStainQ(M, k % 2 ? OPW.drip0 : OPW.drip1, [[-0.24, 1.9, 0.253], [0.24, 1.9, 0.253], [0.24, 2.78, 0.253], [-0.24, 2.78, 0.253]], [0, 0, 1]); M.color([0.33, 0.27, 0.21]); M.restore(); }
  M.restore();
  DECOR.col(x - 0.31, x + 0.31, 0, 2.96, z - 0.31, z + 0.31, 'concrete');
}
/* Gate leaf (w wide, 2.3 m): galvanized tube frame, diagonal brace, chain-link; hinged at (x, z), open toward angle a (direction of the leaf
   from its hinge, like rotY: (cos a, -sin a)); collision for soldiers only */
function opyGateLeaf(x, z, w, a) {
  const M = DECOR, h = 2.3;
  M.save().move(x, 0, z).rotY(a).color(OPY.galv).local(1);
  for (const [p, q] of [[[0.05, 0.08, 0], [0.05, h, 0]], [[w, 0.08, 0], [w, h, 0]], [[0.05, h, 0], [w, h, 0]], [[0.05, 0.1, 0], [w, 0.1, 0]], [[0.05, h / 2, 0], [w, h / 2, 0]]]) M.tube('steel', 0.032, [p, q], 6);
  M.cls = 1; M.tube('steel', 0.02, [[0.08, 0.12, 0], [w - 0.03, h - 0.03, 0]], 5);
  M.color([0.9, 0.9, 0.88]); M.quad('opyLink', [0.05, 0.1, 0], [w, 0.1, 0], [w, h, 0], [0.05, h, 0], [0, 0, 1]);
  M.cls = 0; M.color([0.3, 0.3, 0.3]); for (const y of [0.3, h - 0.3]) M.boxB('steel', -0.05, 0.08, y - 0.06, y + 0.06, -0.05, 0.05);
  M.save().move(w - 0.06, 0, 0); M.cyl('rubber', 0.08, 0.1, 8); M.restore(); // wheel
  M.restore();
  colShape(x, 0, z, a, [[0, w, 0, h, -0.06, 0.06, 'glassPane']]);
}
/* A breach between two posts at (xa, za) and (xb, zb) (out: the side of the jungle), each one different: kind 'peel' (the panel cut along
   one post and the bottom, peeled back outward from the other post, its far corner lifted), 'flat' (trampled flat outside), 'hang' (hanging
   outside from one top corner); in all of them the top rail bent down across the gap, the barbed wire cut, its ends curling, one strand
   sagging. No collision: the panel lies outside the opening */
function opyBreach(xa, za, xb, zb, out, kind, seed) {
  const M = DECOR, R = rngOf(seed), L = hyp(xb - xa, zb - za), ux = (xb - xa) / L, uz = (zb - za) / L, nx = uz * out, nz = -ux * out, H = OPY_FH;
  const P = (t, o, y) => [xa + ux * t + nx * o, y, za + uz * t + nz * o];
  M.save().color([0.9, 0.9, 0.88]).local(1); M.cls = 1;
  if (kind === 'flat') {
    const w = 2.2, off = R.range(0.7, 1.2);
    M.quad('opyLink', P(0.2, off - w / 2, 0.05), P(L - 0.2, off - w / 2, 0.11), P(L - 0.25, off + w / 2, 0.22), P(0.25, off + w / 2, 0.12), [0, 1, 0]);
    M.color(OPY.galv); M.tube('steel', 0.02, [P(0.2, off + w / 2, 0.14), P(L / 2, off + w / 2 + 0.2, 0.32), P(L - 0.25, off + w / 2, 0.22)], 4);
  } else {
    // the panel as a frame turned about a vertical hinge at the far post (peel) or hanging from the top corner of the near post (hang)
    const hinge = kind === 'peel' ? L : 0, sgn = kind === 'peel' ? -1 : 1, ang = R.range(1.15, 1.45), ca = Math.cos(ang), sa = Math.sin(ang), w = L - 0.25;
    const Q = (u, y, lift) => { const t = hinge + sgn * u * ca, o = u * sa; return P(t, o, y + lift); };
    if (kind === 'peel') M.quad('opyLink', Q(0, 0.1, 0), Q(w, 0.1, 0.5), Q(w, H - 0.1, 0.3), Q(0, H - 0.05, 0), [nx, 0, nz]);
    else M.quad('opyLink', Q(0.05, H - 0.1, 0), Q(w * 0.8, H - 0.1, -1.0), Q(w * 0.9, 0.1, -0.2), Q(0.05, 0.6, 0), [nx, 0, nz]);
    M.color(OPY.galv); M.tube('steel', 0.022, kind === 'peel' ? [Q(0, H - 0.05, 0), Q(w, H - 0.1, 0.3)] : [Q(0.05, H - 0.1, 0), Q(w * 0.8, H - 0.1, -1.0)], 4);
  }
  // flaps of mesh left on both posts (cut along the post, peeled back a little), the top rail torn off the far post and hanging down to the
  // ground, the barbed wire: cut ends curling at both posts, one strand sagging
  M.color([0.9, 0.9, 0.88]);
  for (const [t0, d] of [[0.06, 1], [L - 0.06, -1]]) { const wf = R.range(0.35, 0.55), y0 = R.range(0.1, 0.5), o = R.range(0.15, 0.35) * (d > 0 ? 1 : -1);
    M.quad('opyLink', P(t0, 0, y0), P(t0 + d * wf, o, y0 + 0.15), P(t0 + d * wf * 0.8, o * 0.7, H - 0.15), P(t0, 0, H - 0.05), [nx, 0, nz]); }
  M.color(OPY.galv); M.tube('steel', 0.034, [P(0, H - 0.02, 0), P(L * 0.45, H - R.range(0.4, 0.7), 0.06), P(L * 0.8, 0.9, 0.18), P(L * 0.86, 0.04, 0.3)], 6);
  M.color([0.42, 0.42, 0.4]); M.tube('steel', 0.006, [P(0, H + 0.12, 0.1), P(L * 0.45, H - R.range(0.6, 1.1), 0.2), P(L, H + 0.12, 0.1)], 4);
  M.cls = 2;
  for (const t of [0.05, L - 0.05]) for (let k = 0; k < 4; k++) { const yy = 0.3 + k * 0.5, d = t < 1 ? 1 : -1; M.tube('steel', 0.004, [P(t, 0, yy), P(t + d * 0.15, 0.12, yy + 0.08), P(t + d * 0.22, 0.05, yy - 0.06)], 3); }
  for (const t of [0.05, L - 0.05]) for (let k = 1; k < 3; k++) { const d = t < 1 ? 1 : -1; M.tube('steel', 0.005, [P(t, 0.1 + k * 0.12, H + 0.12 + k * 0.14), P(t + d * 0.3, 0.2 + k * 0.12, H + k * 0.1), P(t + d * 0.35, 0.35, H - 0.3 + k * 0.1)], 3); }
  M.restore();
}
function opyPerimeter() {
  const F = OP_FENCE, [g0, g1] = OPY_GATE, kinds = { 1: ['peel', 'hang', 'flat', 'peel'], [-1]: ['flat', 'peel', 'hang', 'hang'] };
  for (const s of [1, -1]) {
    const zf = s * F.z1, K = kinds[s];
    // north (s = 1) and south fences (barbed wire leaning outward: out = -s along their normal): west corner to the corner cut, cut to the gate
    // pillar, gate pillar to the east corner; a second concrete pillar 6 m out on each side of the gate
    opyFence(F.x0, zf, OPY_CUT[0], zf, -s); opyFence(OPY_CUT[1], zf, OPY_CUT2[0], zf, -s); opyFence(OPY_CUT2[1], zf, g0 - 0.56, zf, -s); opyFence(g1 + 0.56, zf, F.x1, zf, -s);
    for (const x of [g0 - 0.25, g1 + 0.25, g0 - 6.25, g1 + 6.25]) opyGatePost(x, zf);
    opyBreach(OPY_CUT[0], zf, OPY_CUT[1], zf, -s, K[0], s > 0 ? 71 : 72); opyBreach(OPY_CUT2[1], zf, OPY_CUT2[0], zf, s, K[1], s > 0 ? 77 : 78);
    // side fences: center line to the breach, breach to the corner (the other half does its own)
    const zb = [s * OPY_BREACH[0], s * OPY_BREACH[1]];
    for (const [xf, o] of [[F.x0, -1], [F.x1, 1]]) { opyFence(xf, 0, xf, zb[0], o * s); opyFence(xf, zb[1], xf, zf, o * s); }
    opyBreach(F.x0, zb[1], F.x0, zb[0], s, K[2], s > 0 ? 73 : 74); opyBreach(F.x1, zb[0], F.x1, zb[1], s, K[3], s > 0 ? 75 : 76);
  }
}

/* ---------- Gates ---------- */
/* Main vehicle gate (north, in front of the command building): two leaves swung open outward between concrete pillars, the barrier arm
   (raised) and the guard booth inside; rear gate (south): the same leaves, a sandbag post inside in place of the booth */
function opyGates() {
  const [g0, g1] = OPY_GATE, F = OP_FENCE, w = (g1 - g0) / 2;
  for (const s of [1, -1]) {
    const zo = s * (F.z1 + 0.06), open = s > 0 ? 1.33 : 1.25;
    // leaves hinged at the pillars, swung open outward until they nearly lie along the fence (direction of a leaf from its hinge: (cos a, -sin a))
    opyGateLeaf(g0, zo, w, s > 0 ? -(Math.PI / 2 + open) : Math.PI / 2 + open);
    opyGateLeaf(g1, zo, w, s > 0 ? -(Math.PI / 2 - open) : Math.PI / 2 - open);
    if (s > 0) {
      DECOR.place(PF.opyBooth(), 11.6, 0, F.z1 - 2.3, 0);
      DECOR.place(PF.opyBarrier(), g1 + 0.95, 0, F.z1 - 0.8, Math.PI / 2);
    } else {
      opyBags(11.4, -F.z1 + 3.0, 2.4, 0, 5, 41); opyBags(12.45, -F.z1 + 1.85, 1.8, Math.PI / 2, 5, 42);
    }
  }
}

/* ---------- Yard layout ---------- */
/* One half of the yard (s = 1: north, Alpha; -1: south, Bravo), as on sheet 4: cover in clusters at the edges and against the walls (a
   supply dump on the west fence, a row along the east fence by the shed, stacks against the building and the shed, a three-barrier
   chicane inside the gate), aligned with the fence and the building; a clear lane at least 6 m wide from the gate to the building, an open
   patch of about 10 x 10 m between the tower and the building */
function opyHalf(s) {
  const M = DECOR, Z = (z) => s * z, R = rngOf(s > 0 ? 8101 : 8102), Q = Math.PI / 2;
  // --- west (the tower side, point B at its foot): the water tank in front of the breach (it screens the line of sight through it), the
  // supply dump on the fence north of it, wooden crates north of B, a jersey screening the tower's stair, floodlight
  M.place(s > 0 ? PF.opyWaterTank() : PF.opyDrumRack(), -20.2, 0, Z(13.9), 0); // (south: a drum rack on the tank's footprint)
  opyCrateStack(-21.85, Z(18.2), Q, 'B', s > 0 ? 3 : 4);
  opyCrateStack(-19.9, Z(18.5), Q, 'Q', s > 0 ? 5 : 6);
  opyCrateStack(-21.7, Z(20.25), s > 0 ? 0 : 0.42, 'S', s > 0 ? 7 : 8);
  if (s > 0) opyWoodStack(-12.8, Z(9.0), 0, 9); else opyCrateStack(-12.8, Z(9.0), 0.3, 'S', 10); // (south: an olive stack in its place)
  opyJersey(-16.4, Z(8.6), 3.0, 'x', s * 0.24);
  opyCrateStack(-15.0, Z(13.0), s * 0.3, 'S', s > 0 ? 33 : 34); // (a low cluster in the west quadrant, 8 m from the fences)
  M.place(PF.opyFlood(), -22.0, 0, Z(9.4), s > 0 ? 2.4 : Math.PI - 2.4);
  // --- center: the chicane inside the gate (three barriers, staggered), stacks against the building's west end, the jeep parked on the
  // track beside the lane
  opyJersey(2.6, Z(15.0), 3.0, 'x', s * 0.26); opyJersey(5.6, Z(13.0), 3.0, 'x', -s * 0.33); opyJersey(2.6, Z(11.0), 3.0, 'x', s * 0.2);
  opyJersey(-3.4, Z(12.4), 3.0, 'x', -s * 0.3); // (front-left of the porch, 6 m out)
  opyCrateStack(10.4, Z(16.4), 0, 'D', s > 0 ? 31 : 32); // (inside the gate, east: cover at the gate's point)
  opyCrateStack(-7.4, Z(3.9), Q, 'D', s > 0 ? 11 : 12);
  opyCrateStack(-7.5, Z(6.3), 0, 'S', s > 0 ? 13 : 14);
  M.place(PF.opyGenset(), 8.24, 0, Z(2.9), Math.PI / 2); // (beside the exterior stair, its door to the yard; the gate lane's long view ends on it)
  // the 4x4 parked on its track south (it turns the straight run through both gates aside), a tarped stack north 2.5 m off the ruts
  // toward the tower (the two halves do not mirror from above)
  if (s < 0) vehicle(PF.car('offroad', { dust: 1 }), 8.3, 0, Z(10.8), 0, { tint: { paint: [0.25, 0.28, 0.17], carglassD: [0.12, 0.13, 0.15], steel: [0.2, 0.2, 0.19], rubber: [0.14, 0.14, 0.13], dirt: [0.4, 0.33, 0.25] } });
  else M.place(PF.opyTarpStack(), 5.5, 0, Z(10.6), 0.05);
  // --- east (by the shed): a row along the fence, a crate block in front of the breach, a stack against the shed's west wall, drums by
  // the shed door, wooden crates by the booth, floodlight
  // (two clusters of mixed height along the east fence, a gap of 2.5 m between them, a wooden crate in the second)
  opyCrateStack(21.7, Z(6.3), Q, 'D', s > 0 ? 15 : 16);
  opyCrateStack(21.5, Z(8.5), Q + (s > 0 ? 0.08 : -0.4), 'S', s > 0 ? 17 : 18);
  opyCrateStack(21.6, Z(11.6), Q, 'H', s > 0 ? 19 : 20); opyWoodStack(19.9, Z(12.0), s * 0.35, s > 0 ? 35 : 36);
  opyCrateStack(20.8, Z(13.9), Q, 'B', s > 0 ? 21 : 22);
  opyCrateStack(13.3, Z(1.9), Q + (s > 0 ? 0 : 0.35), 'S', s > 0 ? 23 : 24);
  opyDrums(12.9, Z(4.6), 3, s > 0 ? 25 : 26);
  opyWoodStack(13.8, Z(16.4), 0, s > 0 ? 29 : 30);
  M.place(PF.opyFlood(), 22.0, 0, Z(4.6), s > 0 ? -2.0 : Math.PI + 2.0);
  for (const y of [0, 0.2]) M.place(PF.tire(), 18.6 + y * 0.5, y, Z(9.6), R() * TAU, { tint: [0.07, 0.07, 0.065] }); // (near-black rubber)
}
function opYard() {
  opyPerimeter(); opyGates();
  opyTower(); opyShed();
  for (const s of [1, -1]) opyHalf(s);
  // north: the flagpole beside the gate booth and the satellite dish; south: the radio mast, 6.5 m (one landmark per half)
  opyMast(21.2, -OP_FENCE.z1 + 1.6, 6.5);
  opyFlagpole(13.6, 18.9);
  DECOR.place(PF.dish(), 21.3, 0, OP_FENCE.z1 - 1.6, Math.PI * 0.2, { s: 2.0 });
}
