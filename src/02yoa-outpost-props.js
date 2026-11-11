/* ==========================================================================
   JUNGLE OUTPOST, kit of the command building (02yo-outpost-building.js): the cast concrete surface in 1 m formwork panels and the
   painted inner faces, the building's materials, its atlas (jungle terrain maps, whiteboard, clock, safety pictograms, screens) and
   the atlas of its weathering (run-off, mud), then the furniture and
   equipment of the owner's two object kits (sheets 2 and 3): office furniture, radio console, briefing room, kitchenette and
   restroom upstairs; reception desk, preparation tables, benches, workbenches, shelving, lockers, ammunition crates, utility room
   and hall equipment downstairs; the roof equipment. Prefabs in local coordinates (02a-kit.js): on y = 0, main face toward +z;
   a wall-mounted object has its back at z = 0. Furniture you bump into carries its collision; chairs, bins and small objects do not
   (they would cut the bots' network in rooms 2.6 m deep).
   ========================================================================== */
Object.assign(TEXLAB, {
  /* cast-in-place concrete in 1 m formwork panels (one tile: 2 x 2 panels): smooth faces, fine recessed joints, four tie holes per panel,
     panel-to-panel shade, pale clouds, pores, faint vertical run-off and stains */
  opPanel: [1024, 431, 0.45, `
    vec4 t = tiles(uv, vec2(2.0), 0.0);
    float joint = 1.0 - smoothstep(0.002, 0.006, t.w);
    float big = gfbm(uv, vec2(3.0), 5, 1.0), mid = gfbm(uv, vec2(10.0), 4, 2.0), gr = vn(uv * 256.0, vec2(256.0), 3.0);
    vec4 po = vor(uv, vec2(96.0), 4.0, 1.0); float pore = (1.0 - smoothstep(0.04, 0.12, po.x)) * step(0.86, po.z) * 0.6;
    vec2 q = fract(uv * 4.0) - 0.5; float tie = 1.0 - smoothstep(0.014, 0.024, length(q));
    float run = smoothstep(0.55, 0.9, gfbm(vec2(uv.x, uv.y * 0.25), vec2(20.0, 2.0), 4, 6.0));
    float stain = smoothstep(0.45, 0.85, gfbm(uv + 0.37, vec2(4.0), 5, 8.0));
    h = 0.55 + mid * 0.02 + gr * 0.012 - pore * 0.3 - joint * 0.5 - tie * 0.5;
    a = srgb(vec3(0.75, 0.735, 0.7)) * (0.88 + big * 0.2 + mid * 0.04 + gr * 0.03 + (t.z - 0.5) * 0.16);
    a *= 1.0 - pore * 0.2 - joint * 0.5 - tie * 0.5 - run * 0.1 - stain * 0.1;
    // rust around some of the tie holes, a short trail under them
    float tk = step(0.45, hs(floor(uv * 4.0), 21.0));
    float halo = (1.0 - smoothstep(0.02, 0.07, length(q * vec2(1.0, 0.75) + vec2(0.0, 0.012)))) * tk;
    float trail = (1.0 - smoothstep(0.012, 0.03, abs(q.x))) * (1.0 - smoothstep(0.0, 0.02, q.y)) * smoothstep(-0.28, -0.03, q.y) * tk;
    a = mix(a, srgb(vec3(0.62, 0.42, 0.26)) * (0.8 + big * 0.3), clamp(halo * 0.5 + trail * 0.3, 0.0, 0.6));
    r = 0.9 - mid * 0.06; x = h;`],
  /* inner faces of the concrete walls and the columns: grey-beige painted concrete, faint formwork joints, the lanes of the roller, soft
     grime clouds (scuffs and hand-height grime are decals: opScuffRun, 02yo) */
  opWallIn: [512, 433, 0.3, `
    vec4 t = tiles(uv, vec2(2.0), 0.0);
    float joint = 1.0 - smoothstep(0.002, 0.006, t.w);
    float big = gfbm(uv, vec2(3.0), 5, 1.0), mid = gfbm(uv, vec2(9.0), 4, 2.0), gr = vn(uv * 256.0, vec2(256.0), 3.0);
    vec4 po = vor(uv, vec2(64.0), 4.0, 1.0); float pore = (1.0 - smoothstep(0.03, 0.09, po.x)) * step(0.9, po.z) * 0.5;
    float roll = gfbm(vec2(uv.x, uv.y * 0.25), vec2(28.0, 2.0), 3, 5.0);
    float cloud = gfbm(uv + 0.21, vec2(4.0), 4, 7.0);
    h = 0.5 + mid * 0.03 + gr * 0.012 + roll * 0.02 - pore * 0.25 - joint * 0.3;
    a = srgb(vec3(0.75, 0.735, 0.69)) * (0.9 + big * 0.1 + (roll - 0.5) * 0.05 + gr * 0.02 + (t.z - 0.5) * 0.04);
    a *= 1.0 - pore * 0.15 - joint * 0.16 - smoothstep(0.35, 0.9, cloud) * 0.07;
    r = 0.86 - mid * 0.05; x = h;`],
  /* underside of the slabs: the walls' pale concrete, faint joints, grey tie holes (no rust) */
  opCeilTx: [512, 443, 0.3, `
    vec4 t = tiles(uv, vec2(2.0), 0.0);
    float joint = 1.0 - smoothstep(0.002, 0.006, t.w);
    float big = gfbm(uv, vec2(3.0), 5, 1.0), mid = gfbm(uv, vec2(9.0), 4, 2.0), gr = vn(uv * 256.0, vec2(256.0), 3.0);
    vec2 q = fract(uv * 4.0) - 0.5; float tie = 1.0 - smoothstep(0.012, 0.022, length(q));
    h = 0.5 + mid * 0.03 + gr * 0.012 - joint * 0.3 - tie * 0.4;
    a = srgb(vec3(0.75, 0.735, 0.69)) * (0.92 + big * 0.08 + gr * 0.02 + (t.z - 0.5) * 0.04);
    a *= 1.0 - joint * 0.16 - tie * 0.35;
    r = 0.86 - mid * 0.05; x = h;`],
  /* wood of the tops, bench seats and frames: one matte honey tan, a fine straight grain along u (no clouds, no gloss) */
  opWood: [512, 437, 0.25, `
    float big = gfbm(uv, vec2(2.0, 4.0), 3, 1.0), g1 = gfbm(vec2(uv.x * 0.5, uv.y), vec2(2.0, 48.0), 4, 2.0);
    float ring = sin((uv.y * 40.0 + g1 * 2.2 + big * 3.0) * 6.2831853) * 0.5 + 0.5;
    float fine = vn(vec2(uv.x * 48.0, uv.y * 512.0), vec2(48.0, 512.0), 3.0);
    h = 0.5 + ring * 0.03 + fine * 0.04;
    a = mix(srgb(vec3(0.74, 0.53, 0.37)), srgb(vec3(0.9, 0.68, 0.51)), ring * 0.3 + g1 * 0.5 + fine * 0.2) * (0.96 + big * 0.08);
    r = 0.88; x = h;`],
  /* drab matte paint on steel (doors, cabinets, lockers, crates), tinted by the vertices: faint mottling, a fine grain, a few small chips
     down to the primer (no gouges) */
  opPaintTx: [512, 439, 0.25, `
    float big = gfbm(uv, vec2(3.0), 4, 1.0), mid = gfbm(uv, vec2(12.0), 4, 2.0), gr = vn(uv * 256.0, vec2(256.0), 3.0);
    vec4 po = vor(uv, vec2(36.0), 4.0, 1.0); float chip = (1.0 - smoothstep(0.02, 0.07, po.x)) * step(0.94, po.z);
    h = 0.5 + mid * 0.02 + gr * 0.012 - chip * 0.2;
    a = vec3(0.88 + big * 0.06 + mid * 0.04 + gr * 0.02);
    a = mix(a, vec3(0.5, 0.48, 0.43), chip * 0.6);
    r = 0.66 - mid * 0.06; x = h;`],
  /* steel of the stairs, rails, posts and fittings, tinted by the vertices: brushed along u, an even grain, a few rust specks */
  opSteelTx: [512, 441, 0.3, `
    float big = gfbm(uv, vec2(3.0), 4, 1.0), br = vn(vec2(uv.x * 8.0, uv.y * 256.0), vec2(8.0, 256.0), 2.0), gr = vn(uv * 200.0, vec2(200.0), 3.0);
    vec4 po = vor(uv, vec2(24.0), 4.0, 1.0); float rust = (1.0 - smoothstep(0.03, 0.12, po.x)) * step(0.9, po.z);
    h = 0.5 + br * 0.03 + gr * 0.01;
    a = vec3(0.8 + big * 0.12 + br * 0.08 + gr * 0.03);
    a = mix(a, vec3(0.75, 0.42, 0.22), rust * 0.6);
    r = 0.5 + br * 0.15; x = h;`],
});
TEXSCALE.opPanel = 2.0; TEXSCALE.opWallIn = 2.0; TEXSCALE.opWood = 1.2; TEXSCALE.opPaintTx = 1.0; TEXSCALE.opSteelTx = 1.0; TEXSCALE.opCeilTx = 2.0;
OPT_TEX.add('opPanel'); OPT_TEX.add('opWallIn'); OPT_TEX.add('opWood'); OPT_TEX.add('opPaintTx'); OPT_TEX.add('opSteelTx'); OPT_TEX.add('opCeilTx');

/* ---------- Colors (sRGB tints) ---------- */
const OPC = {
  wall: [0.688, 0.683, 0.678], // pale warm grey weathered concrete, outside
  wallIn: [0.71, 0.706, 0.715], // inner faces (the surface carries its greige)
  ochre: [0.648, 0.598, 0.45], // painted lower band: a muted matte ochre (the band's cell is near white)
  ochreIn: [0.648, 0.598, 0.45], // the same paint inside (ground floor)
  olive: [0.308, 0.343, 0.258], // drab olive green: one family for all the painted steel
  leaf: [0.298, 0.331, 0.246], // door leaves and their frames (the frames a small step darker) // drab painted steel: doors, cabinets, lockers, crates
  oliveDk: [0.235, 0.265, 0.2], // door frames, trims
  frame: [0.16, 0.19, 0.14], // window frames
  glass: [0.285, 0.3, 0.27], glassSky: [0.33, 0.345, 0.325], glassSkyUp: [0.325, 0.345, 0.27], glassLeaf: [0.25, 0.285, 0.225], // (a pane: lighter toward its head, greener toward its foot; upstairs, seen from below, less blue: it mirrors the zenith)
  // dark tinted glazing (mostly a mirror of the sky and the jungle)
  awning: [0.271, 0.29, 0.199], // corrugated sheet of the awning
  vent: [0.5, 0.5, 0.47], // louvered vents of the facades
  acCase: [0.47, 0.47, 0.44], // grey-beige casings of the AC units
  slab: [0.55, 0.545, 0.535], plinth: [0.6, 0.594, 0.578], coping: [0.55, 0.546, 0.542], // porch slab, plinth course
  stain: [0.2, 0.18, 0.16], mud: [0.4, 0.34, 0.27], shade: [0.07, 0.065, 0.06], // run-off, splashed mud, contact shadows and floor wear
  steel: [0.4, 0.41, 0.41], // galvanized steel: stair, railings
  steelDk: [0.27, 0.28, 0.28], steelWorn: [0.5, 0.5, 0.49], handle: [0.36, 0.37, 0.36], // (worn rails and nosings; handles)
  black: [0.12, 0.12, 0.12],
  wood: [1, 1, 1], // wooden tops (the veneer carries its own color); the same wood where a room is brighter (upstairs, hall): tinted down
  woodUp: [0.49, 0.49, 0.49], woodHall: [0.55, 0.55, 0.55], woodBench: [0.71, 0.735, 0.78],
  floor: [0.762, 0.728, 0.707], // ground floor slab
  tiles: [0.425, 0.39, 0.36], // upper floor
  ceil: [0.74, 0.74, 0.755],
  stair: [0.78, 0.76, 0.72],
  white: [0.92, 0.92, 0.9],
  fabric: [0.344, 0.381, 0.285], // olive seats (the lockers' olive, one step lighter)
};
/* The olive of one kind of object: the shared paint, a little lighter or darker (f), greener or greyer (g) */
const opOl = (f = 1, g = 1, b = 1) => [OPC.olive[0] * f, OPC.olive[1] * f * g, OPC.olive[2] * f * b];
/* The same on the hall's kit (lockers, crates, bin): darker and yellower */
const opOlH = (f = 1) => opOl(f * 0.972, 0.966, 0.969);

/* ---------- Atlas of the building (1024 x 1024): terrain maps, whiteboard, clock, pictograms, screens ---------- */
const OPS = { mapW: 0, mapT: 1, board: 2, clock: 3, aid: 4, fire: 5, volt: 6, exit: 7, scrMap: 8, scrTxt: 9, scrRad: 10, scrCam: 11, radio: 12 };
const OPS_CELL = [[0, 0, 512, 320], [512, 0, 512, 320], [0, 320, 512, 320], [512, 320, 256, 256], [768, 320, 128, 128], [896, 320, 128, 128], [768, 448, 128, 128], [896, 448, 128, 128],
  [0, 640, 256, 160], [256, 640, 256, 160], [512, 640, 256, 160], [768, 640, 256, 160], [0, 800, 512, 96]];
function opSignAtlas() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024; const g = c.getContext('2d'), R = rngOf(5507);
  g.fillStyle = '#808080'; g.fillRect(0, 0, 1024, 1024);
  // smooth value noise on a periodic lattice (terrain of the maps)
  const L = 24, lat = []; for (let i = 0; i < L * L; i++) lat.push(R());
  const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), at = (i, j) => lat[(((j % L) + L) % L) * L + (((i % L) + L) % L)];
    return lerp(lerp(at(xi, yi), at(xi + 1, yi), u), lerp(at(xi, yi + 1), at(xi + 1, yi + 1), u), v); };
  // jungle terrain map: hills in shades of green (contour lines every band), a river, tracks, a grid with its references, objective markers
  const terrain = (i, ox, oy) => {
    const [x0, y0, w, h] = OPS_CELL[i], img = g.createImageData(w, h), d = img.data;
    const hgt = (px, py) => vn(px * 5 + ox, py * 5 + oy) * 0.58 + vn(px * 11 + oy, py * 11 + ox) * 0.3 + vn(px * 23, py * 23 + 7) * 0.12;
    const riv = (px) => 0.55 + Math.sin(px * 7.5 + ox) * 0.12 + Math.sin(px * 17 + oy) * 0.04;
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      const X = px / w, Y = (py / w), H = hgt(X, Y), band = H * 14, f = band - Math.floor(band), o = (py * w + px) * 4;
      let r = lerp(216, 138, H), gg = lerp(204, 142, H), b = lerp(160, 96, H);
      const vg = vn(X * 9 + oy * 3, Y * 9 + ox * 3); if (vg > 0.5) { const m = Math.min(1, (vg - 0.5) * 7) * 0.7; r = lerp(r, 112, m); gg = lerp(gg, 150, m); b = lerp(b, 92, m); } // forest
      if (f < 0.07 || f > 0.93) { r = r * 0.62 + 50; gg = gg * 0.62 + 30; b = b * 0.62 + 10; } // contour line
      const dr = Math.abs(Y * w / h * (h / w) - riv(X) * (h / w));
      if (dr < 0.012) { r = 70; gg = 130; b = 196; } else if (dr < 0.02) { r = r * 0.7 + 30; gg = gg * 0.7 + 50; b = b * 0.7 + 70; }
      d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255;
    }
    g.putImageData(img, x0, y0);
    g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
    // tracks (dashed brown), grid, references, markers
    g.strokeStyle = '#8a4b22'; g.lineWidth = 3; g.setLineDash([10, 6]); g.beginPath();
    g.moveTo(x0, y0 + h * 0.3); g.bezierCurveTo(x0 + w * 0.3, y0 + h * 0.1, x0 + w * 0.5, y0 + h * 0.6, x0 + w, y0 + h * 0.45); g.stroke();
    g.beginPath(); g.moveTo(x0 + w * 0.62, y0); g.bezierCurveTo(x0 + w * 0.55, y0 + h * 0.4, x0 + w * 0.75, y0 + h * 0.7, x0 + w * 0.68, y0 + h); g.stroke(); g.setLineDash([]);
    g.strokeStyle = 'rgba(30,40,30,0.45)'; g.lineWidth = 1;
    for (let k = 1; k < 8; k++) { g.beginPath(); g.moveTo(x0 + (w * k) / 8, y0); g.lineTo(x0 + (w * k) / 8, y0 + h); g.stroke(); }
    for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(x0, y0 + (h * k) / 5); g.lineTo(x0 + w, y0 + (h * k) / 5); g.stroke(); }
    g.fillStyle = '#1d261d'; g.font = 'bold 13px Arial, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'top';
    for (let k = 0; k < 8; k++) g.fillText(String.fromCharCode(65 + k), x0 + (w * k) / 8 + 4, y0 + 4);
    for (let k = 0; k < 5; k++) g.fillText(String(k + 1), x0 + 4, y0 + (h * k) / 5 + 18);
    const RR = rngOf(91 + i);
    for (let k = 0; k < 6; k++) {
      const mx = x0 + w * (0.12 + RR() * 0.76), my = y0 + h * (0.15 + RR() * 0.7);
      g.strokeStyle = k < 3 ? '#c0281e' : '#1e3fa0'; g.lineWidth = 3;
      if (k % 2) { g.beginPath(); g.arc(mx, my, 9, 0, TAU); g.stroke(); } else { g.beginPath(); g.moveTo(mx, my - 10); g.lineTo(mx + 9, my + 7); g.lineTo(mx - 9, my + 7); g.closePath(); g.stroke(); }
    }
    g.strokeStyle = '#c0281e'; g.lineWidth = 4; g.beginPath(); g.moveTo(x0 + w * 0.2, y0 + h * 0.75); g.lineTo(x0 + w * 0.45, y0 + h * 0.5); g.lineTo(x0 + w * 0.7, y0 + h * 0.32); g.stroke();
    g.beginPath(); g.moveTo(x0 + w * 0.7, y0 + h * 0.32); g.lineTo(x0 + w * 0.655, y0 + h * 0.32); g.moveTo(x0 + w * 0.7, y0 + h * 0.32); g.lineTo(x0 + w * 0.69, y0 + h * 0.4); g.stroke();
    g.strokeStyle = '#2a2a24'; g.lineWidth = 6; g.strokeRect(x0 + 3, y0 + 3, w - 6, h - 6);
    g.restore();
  };
  terrain(OPS.mapW, 3.1, 1.7); terrain(OPS.mapT, 11.3, 6.2);
  // whiteboard: blue boxes and arrows (an operation's sequence), red circles, sticky notes, a few scribbled lines
  { const [x0, y0, w, h] = OPS_CELL[OPS.board]; g.fillStyle = '#f4f5f2'; g.fillRect(x0, y0, w, h);
    g.strokeStyle = '#2148a8'; g.lineWidth = 3; g.fillStyle = '#2148a8';
    const bx = [[40, 50], [200, 50], [360, 50], [120, 170], [290, 170]];
    for (const [x, y] of bx) g.strokeRect(x0 + x, y0 + y, 110, 60);
    for (const [a, b] of [[0, 1], [1, 2], [1, 3], [2, 4], [3, 4]]) { const p = bx[a], q = bx[b]; g.beginPath(); g.moveTo(x0 + p[0] + 55, y0 + p[1] + 60); g.lineTo(x0 + q[0] + 55, y0 + q[1]); g.stroke(); }
    g.lineWidth = 2;
    for (const [x, y] of bx) for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x0 + x + 12, y0 + y + 16 + k * 14); g.lineTo(x0 + x + 40 + R() * 55, y0 + y + 16 + k * 14); g.stroke(); }
    g.strokeStyle = '#c42a22'; g.lineWidth = 3; g.beginPath(); g.ellipse(x0 + 345, y0 + 200, 75, 45, 0, 0, TAU); g.stroke();
    for (let k = 0; k < 4; k++) { g.fillStyle = ['#f2d84a', '#f2d84a', '#9fd36c', '#f29a4a'][k]; g.fillRect(x0 + 420 + (k % 2) * 40, y0 + 160 + Math.floor(k / 2) * 44, 34, 34); }
    g.strokeStyle = '#222222'; g.lineWidth = 2; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(x0 + 40, y0 + 260 + k * 14); g.lineTo(x0 + 120 + R() * 120, y0 + 260 + k * 14); g.stroke(); }
    const sm = g.createLinearGradient(x0, y0, x0 + w, y0 + h); sm.addColorStop(0, 'rgba(120,130,140,0.06)'); sm.addColorStop(1, 'rgba(120,130,140,0.14)'); g.fillStyle = sm; g.fillRect(x0, y0, w, h); }
  // wall clock: white face, black ticks and hands at ten past ten, red second hand
  { const [x0, y0, w] = OPS_CELL[OPS.clock], cx = x0 + w / 2, cy = y0 + w / 2, r = w / 2 - 4;
    g.fillStyle = '#f6f6f2'; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
    g.strokeStyle = '#151515'; for (let k = 0; k < 60; k++) { const a = (k / 60) * TAU, l = k % 5 ? 8 : 20; g.lineWidth = k % 5 ? 2 : 6; g.beginPath(); g.moveTo(cx + Math.sin(a) * (r - 10), cy - Math.cos(a) * (r - 10)); g.lineTo(cx + Math.sin(a) * (r - 10 - l), cy - Math.cos(a) * (r - 10 - l)); g.stroke(); }
    g.fillStyle = '#151515'; g.font = 'bold 34px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [n, a] of [[12, 0], [3, 0.25], [6, 0.5], [9, 0.75]]) g.fillText(String(n), cx + Math.sin(a * TAU) * (r - 52), cy - Math.cos(a * TAU) * (r - 52));
    const hand = (a, l, wd, col) => { g.strokeStyle = col; g.lineWidth = wd; g.beginPath(); g.moveTo(cx - Math.sin(a) * 14, cy + Math.cos(a) * 14); g.lineTo(cx + Math.sin(a) * l, cy - Math.cos(a) * l); g.stroke(); };
    hand((10.17 / 12) * TAU, r * 0.5, 9, '#151515'); hand((2 / 12) * TAU, r * 0.75, 6, '#151515'); hand((7 / 12) * TAU, r * 0.82, 2, '#c42a22'); }
  // pictograms: first aid (red cross on white), extinguisher (white on red), high voltage (black bolt on yellow), exit (white on green)
  { const [x0, y0, w] = OPS_CELL[OPS.aid]; g.fillStyle = '#f4f4f0'; g.fillRect(x0, y0, w, w); g.fillStyle = '#c8241c'; g.fillRect(x0 + w * 0.38, y0 + w * 0.18, w * 0.24, w * 0.64); g.fillRect(x0 + w * 0.18, y0 + w * 0.38, w * 0.64, w * 0.24); }
  { const [x0, y0, w] = OPS_CELL[OPS.fire]; g.fillStyle = '#c8241c'; g.fillRect(x0, y0, w, w); g.fillStyle = '#ffffff';
    g.fillRect(x0 + w * 0.38, y0 + w * 0.3, w * 0.22, w * 0.56); g.fillRect(x0 + w * 0.42, y0 + w * 0.2, w * 0.1, w * 0.12); g.fillRect(x0 + w * 0.5, y0 + w * 0.2, w * 0.22, w * 0.06); g.fillRect(x0 + w * 0.66, y0 + w * 0.2, w * 0.06, w * 0.2); }
  { const [x0, y0, w] = OPS_CELL[OPS.volt]; g.fillStyle = '#f2c81e'; g.fillRect(x0, y0, w, w); g.fillStyle = '#151515';
    g.beginPath(); g.moveTo(x0 + w * 0.5, y0 + w * 0.08); g.lineTo(x0 + w * 0.94, y0 + w * 0.9); g.lineTo(x0 + w * 0.06, y0 + w * 0.9); g.closePath(); g.fill();
    g.fillStyle = '#f2c81e'; g.beginPath(); g.moveTo(x0 + w * 0.52, y0 + w * 0.3); g.lineTo(x0 + w * 0.4, y0 + w * 0.6); g.lineTo(x0 + w * 0.5, y0 + w * 0.6); g.lineTo(x0 + w * 0.44, y0 + w * 0.82); g.lineTo(x0 + w * 0.62, y0 + w * 0.5); g.lineTo(x0 + w * 0.52, y0 + w * 0.5); g.closePath(); g.fill(); }
  { const [x0, y0, w] = OPS_CELL[OPS.exit]; g.fillStyle = '#1d8a3c'; g.fillRect(x0, y0, w, w); g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(x0 + w * 0.42, y0 + w * 0.22, w * 0.08, 0, TAU); g.fill(); g.lineWidth = w * 0.09; g.strokeStyle = '#ffffff'; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0 + w * 0.4, y0 + w * 0.34); g.lineTo(x0 + w * 0.34, y0 + w * 0.6); g.lineTo(x0 + w * 0.2, y0 + w * 0.82); g.moveTo(x0 + w * 0.34, y0 + w * 0.6); g.lineTo(x0 + w * 0.5, y0 + w * 0.7); g.lineTo(x0 + w * 0.48, y0 + w * 0.86);
    g.moveTo(x0 + w * 0.4, y0 + w * 0.36); g.lineTo(x0 + w * 0.58, y0 + w * 0.48); g.moveTo(x0 + w * 0.6, y0 + w * 0.6); g.lineTo(x0 + w * 0.86, y0 + w * 0.6); g.lineTo(x0 + w * 0.78, y0 + w * 0.52); g.stroke(); g.lineCap = 'butt'; }
  // screens: terrain view with a cursor, text console, radar sweep, gray camera view
  const scr = (i, fn) => { const [x0, y0, w, h] = OPS_CELL[i]; g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip(); g.fillStyle = '#0c1a2a'; g.fillRect(x0, y0, w, h); fn(x0, y0, w, h); g.restore(); };
  scr(OPS.scrMap, (x0, y0, w, h) => { g.globalAlpha = 0.8; g.drawImage(c, OPS_CELL[OPS.mapW][0] + 60, 40, 300, 190, x0 + 8, y0 + 8, w - 16, h - 28); g.globalAlpha = 1; g.fillStyle = '#2a6fd6'; g.fillRect(x0, y0 + h - 18, w, 18); g.strokeStyle = '#ffea3a'; g.lineWidth = 2; g.strokeRect(x0 + w * 0.45, y0 + h * 0.35, 22, 22); });
  scr(OPS.scrTxt, (x0, y0, w, h) => { g.fillStyle = '#b9c79a'; for (let k = 0; k < 9; k++) g.fillRect(x0 + 10, y0 + 10 + k * 16, 30 + R() * (w - 60), 7); });
  scr(OPS.scrRad, (x0, y0, w, h) => { const cx = x0 + w / 2, cy = y0 + h / 2; g.strokeStyle = '#3fe07a'; g.lineWidth = 2; for (const r of [20, 40, 62]) { g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke(); } g.beginPath(); g.moveTo(cx - 70, cy); g.lineTo(cx + 70, cy); g.moveTo(cx, cy - 70); g.lineTo(cx, cy + 70); g.stroke(); g.fillStyle = 'rgba(63,224,122,0.35)'; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, 62, -0.9, -0.3); g.fill(); g.fillStyle = '#ffd23a'; for (let k = 0; k < 4; k++) g.fillRect(cx - 50 + R() * 100, cy - 40 + R() * 80, 5, 5); });
  scr(OPS.scrCam, (x0, y0, w, h) => { for (let k = 0; k < 600; k++) { const v = 60 + Math.floor(R() * 90); g.fillStyle = `rgb(${v},${v + 8},${v})`; g.fillRect(x0 + R() * w, y0 + R() * h, 8, 6); } g.fillStyle = 'rgba(30,60,30,0.55)'; g.fillRect(x0, y0 + h * 0.55, w, h * 0.45); g.fillStyle = '#d42a22'; g.beginPath(); g.arc(x0 + 14, y0 + 14, 5, 0, TAU); g.fill(); });
  // radio front panels: amber frequency readouts, green bars
  { const [x0, y0, w, h] = OPS_CELL[OPS.radio]; g.fillStyle = '#16181a'; g.fillRect(x0, y0, w, h);
    for (let k = 0; k < 4; k++) { const x = x0 + 10 + k * 126; g.fillStyle = '#2a1a08'; g.fillRect(x, y0 + 12, 110, 34); g.fillStyle = '#ffb02a'; for (let d = 0; d < 5; d++) g.fillRect(x + 8 + d * 20, y0 + 18, 14, 22); g.fillStyle = '#3fe07a'; for (let b = 0; b < 8; b++) g.fillRect(x + b * 13, y0 + 80 - b * 3 - R() * 10, 9, 6 + b * 3); } }
  // light wear
  for (let k = 0; k < 2500; k++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,255,250' : '40,40,35'},${R() * 0.05})`; g.fillRect(R() * 1024, R() * 640, 1 + R() * 3, 1 + R() * 2); }
  const t = canvasOnce(new THREE.CanvasTexture(c)); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; t.flipY = false;
  return { map: t, normal: null };
}
/* Atlas cell i on a quad of the current frame (local uv): facing +z at depth z, or laid flat (o.flat: facing +y at height z) */
function opAtlas(M, mat, i, x0, x1, y0, y1, z, flat) {
  const [cx, cy, cw, ch] = OPS_CELL[i], u0 = cx / 1024, v0 = cy / 1024, du = cw / 1024, dv = ch / 1024;
  M.save().local(1); M.uvS = 1; M.uvO = [0, 0];
  const B = flat ? M.buf(mat, (x0 + x1) / 2, z, (y0 + y1) / 2) : M.buf(mat, (x0 + x1) / 2, (y0 + y1) / 2, z);
  const P = flat ? [[x0, z, y1], [x1, z, y1], [x1, z, y0], [x0, z, y0]] : [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], n = flat ? [0, 1, 0] : [0, 0, 1];
  const UV = [[u0, v0 + dv], [u0 + du, v0 + dv], [u0 + du, v0], [u0, v0]];
  const ids = P.map((p, k) => M.v(B, p[0], p[1], p[2], n[0], n[1], n[2], UV[k][0], UV[k][1]));
  M.quadI(B, ids[0], ids[1], ids[2], ids[3]);
  M.restore();
}
/* ---------- Atlas of the weathering (1024 x 1024, white with an opacity: tinted by the vertices): run-off under a coping (two 2 m lengths),
   under a window sill, under a vent, mud splashed at the foot of a wall (a 2 m length) ---------- */
const OPW = { drip0: [0, 0, 512, 368], drip1: [512, 0, 512, 368], sill: [0, 376, 640, 240], streak: [656, 376, 160, 240], splash: [0, 624, 512, 160], wear: [512, 624, 512, 152],
  blob: [832, 384, 176, 176], bandOut: [0, 792, 512, 228], bandIn: [512, 792, 512, 160], edge: [520, 964, 496, 52], chip: [836, 566, 168, 46] };
function opStainAtlas() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024; const g = c.getContext('2d'), R = rngOf(5521);
  g.clearRect(0, 0, 1024, 1024);
  // a streak running down from (x, y): three nested strips (soft edges), fading toward its end
  const streak = (x, y, w, len, a) => {
    a = Math.min(1, a * 1.35);
    for (const [k, q] of [[1, 0.35], [0.6, 0.35], [0.28, 0.3]]) {
      const gr = g.createLinearGradient(0, y, 0, y + len); gr.addColorStop(0, `rgba(255,255,255,${a * q})`); gr.addColorStop(0.55, `rgba(255,255,255,${a * q * 0.55})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(x - (w * k) / 2, y, w * k, len);
    }
  };
  const band = (x0, y0, w, h, a) => { const gr = g.createLinearGradient(0, y0, 0, y0 + h); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x0, y0, w, h); };
  const clip = (cell, fn) => { const [x0, y0, w, h] = cell; g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip(); fn(x0, y0, w, h); g.restore(); };
  for (const cell of [OPW.drip0, OPW.drip1]) clip(cell, (x0, y0, w, h) => {
    band(x0, y0, w, h * 0.14, 0.4); band(x0, y0, w, h * 0.45, 0.12);
    for (let k = 0; k < 20; k++) streak(x0 + 14 + R() * (w - 28), y0, 5 + R() * R() * 40, h * (0.2 + R() * 0.75), 0.18 + R() * 0.4);
    for (let k = 0; k < 4; k++) streak(x0 + 30 + R() * (w - 60), y0, 40 + R() * 50, h * (0.3 + R() * 0.4), 0.1 + R() * 0.1);
  });
  clip(OPW.sill, (x0, y0, w, h) => {
    band(x0 + w * 0.05, y0, w * 0.9, h * 0.3, 0.32);
    for (const u of [0.065, 0.935]) { streak(x0 + w * u, y0, 22, h * 0.95, 0.75); streak(x0 + w * u + (R() - 0.5) * 16, y0, 46, h * 0.6, 0.3); }
    for (let k = 0; k < 12; k++) streak(x0 + w * (0.1 + R() * 0.8), y0, 5 + R() * 18, h * (0.25 + R() * 0.6), 0.2 + R() * 0.3);
  });
  clip(OPW.streak, (x0, y0, w, h) => {
    band(x0 + 8, y0, w - 16, h * 0.12, 0.35);
    for (let k = 0; k < 6; k++) streak(x0 + 22 + R() * (w - 44), y0, 8 + R() * 22, h * (0.4 + R() * 0.58), 0.3 + R() * 0.45);
  });
  clip(OPW.splash, (x0, y0, w, h) => {
    const gr = g.createLinearGradient(0, y0, 0, y0 + h); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0.88)'); g.fillStyle = gr; g.fillRect(x0, y0, w, h);
    for (let k = 0; k < 1500; k++) { const v = Math.pow(R(), 0.45), r = 0.8 + R() * R() * 5; g.fillStyle = `rgba(255,255,255,${0.12 + R() * 0.5})`; g.beginPath(); g.arc(x0 + R() * w, y0 + v * h, r, 0, TAU); g.fill(); }
    // (its two ends fade out: the lengths butt against doorways and corners)
    g.globalCompositeOperation = 'destination-out';
    for (const [xa, xb] of [[x0, x0 + 10], [x0 + w, x0 + w - 10]]) { const e = g.createLinearGradient(xa, 0, xb, 0); e.addColorStop(0, 'rgba(0,0,0,0.6)'); e.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = e; g.fillRect(Math.min(xa, xb), y0, 10, h); }
    g.globalCompositeOperation = 'source-over';
  });
  // contact shadow: a soft dark pad; floor wear: a soft lane with patches
  clip(OPW.blob, (x0, y0, w, h) => { const gr = g.createRadialGradient(x0 + w / 2, y0 + h / 2, w * 0.18, x0 + w / 2, y0 + h / 2, w * 0.5); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.62)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x0, y0, w, h); });
  clip(OPW.wear, (x0, y0, w, h) => {
    const gr = g.createLinearGradient(0, y0, 0, y0 + h); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x0, y0, w, h);
    for (let k = 0; k < 60; k++) { g.fillStyle = `rgba(255,255,255,${0.03 + R() * 0.07})`; g.beginPath(); g.ellipse(x0 + 20 + R() * (w - 40), y0 + h * (0.25 + R() * 0.5), 8 + R() * 30, 4 + R() * 10, 0, 0, TAU); g.fill(); }
  });
  // painted band (2 m lengths, cut out): mottled and faded, dirty toward the foot, a ragged top edge and chips; the inside one rubbed and
  // more chipped; the outside one keeps the formwork joints
  const bandCell = (cell, worn) => clip(cell, (x0, y0, w, h) => {
    g.fillStyle = '#f2efe6'; g.fillRect(x0, y0, w, h);
    // fine mottling (patches of 1 to 7 cm), a light dirt toward the foot, the formwork joints outside, rubbing marks inside
    for (let k = 0; k < 420; k++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,250,235' : '120,100,70'},${(0.04 + R() * 0.08) * (worn ? 0.25 : 1)})`; g.beginPath(); g.ellipse(x0 + R() * w, y0 + R() * h, 3 + R() * 16, 2 + R() * 9, R() * 3, 0, TAU); g.fill(); }
    const gr = g.createLinearGradient(0, y0 + h * 0.45, 0, y0 + h); gr.addColorStop(0, 'rgba(110,100,85,0)'); gr.addColorStop(1, 'rgba(110,100,85,0.22)'); g.fillStyle = gr; g.fillRect(x0, y0 + h * 0.45, w, h * 0.55);
    if (worn) { const gf = g.createLinearGradient(0, y0 + h * 0.82, 0, y0 + h); gf.addColorStop(0, 'rgba(85,75,60,0)'); gf.addColorStop(1, 'rgba(85,75,60,0.42)'); g.fillStyle = gf; g.fillRect(x0, y0 + h * 0.82, w, h * 0.18); } // (inside: the lowest 10 cm dirty)
    if (!worn) { g.fillStyle = 'rgba(70,60,45,0.5)'; for (const u of [0.002, 0.5]) g.fillRect(x0 + w * u, y0, 2, h); }
    if (worn) for (let k = 0; k < 14; k++) { g.strokeStyle = `rgba(60,55,45,${0.1 + R() * 0.25})`; g.lineWidth = 1 + R() * 3; const sx = x0 + R() * w, sy = y0 + h * (0.3 + R() * 0.65); g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + (R() - 0.5) * 60, sy + (R() - 0.5) * 8); g.stroke(); }
    // chips of 3 cm at most, down to the grey concrete (painted in, not cut out: no white behind them)
    for (let k = 0; k < (worn ? 8 : 0); k++) { // (outside: the chips are decals at the jambs and corners, opBand)
      const r = 1 + R() * 1.5, cy = worn && R() < 0.5 ? y0 + h * (0.55 + R() * 0.4) : y0 + 3 + Math.pow(R(), 1.8) * h * 0.5;
      g.fillStyle = `rgba(${150 + Math.floor(R() * 20)},${146 + Math.floor(R() * 18)},${136 + Math.floor(R() * 16)},0.95)`; g.beginPath(); g.ellipse(x0 + R() * w, cy, r * (1 + R() * 0.8), r, R() * 3, 0, TAU); g.fill();
    }
    // top edge: straight and barely uneven inside, uneven by 2 to 3 cm outside (its two ends at the same height: the lengths butt)
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
    g.beginPath(); g.moveTo(x0, y0); if (worn) { for (let x = x0; x < x0 + w; x += 10 + R() * 30) g.lineTo(x, y0 + 1 + R() * 2); g.lineTo(x0 + w, y0 + 2); }
    else { g.lineTo(x0, y0 + 4); for (let x = x0 + 5; x < x0 + w - 5; x += 5 + R() * 14) g.lineTo(x, y0 + 1.5 + R() * 6.5); g.lineTo(x0 + w, y0 + 4); }
    g.lineTo(x0 + w, y0); g.closePath(); g.fill();
    g.globalCompositeOperation = 'source-over';
  });
  bandCell(OPW.bandOut, false); bandCell(OPW.bandIn, true);
  // the shade at the foot of a wall or of an object: dark along the cell's top edge, gone at the other
  { const [x0, y0, w, h] = OPW.edge, gr = g.createLinearGradient(0, y0 - 2, 0, y0 + h); gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.3)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.11)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x0 - 6, y0 - 3, w + 10, h + 3); }
  // chips of the painted band at a jamb or a corner (denser toward the cell's left end)
  clip(OPW.chip, (x0, y0, w, h) => { g.fillStyle = 'rgba(255,255,255,0.95)'; for (let k = 0; k < 16; k++) { const u = Math.pow(R(), 2.2), r = 2.5 + R() * 4.5; g.beginPath(); g.ellipse(x0 + 6 + u * (w - 14), y0 + 7 + R() * (h - 14), r * (1 + R() * 0.9), r, R() * 3, 0, TAU); g.fill(); } });
  const t = canvasOnce(new THREE.CanvasTexture(c)); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; t.flipY = false;
  return { map: t, normal: null };
}
/* A cell of the weathering atlas on a quad of the current frame, facing +z at depth z (flip: mirrored left to right; uf: share of the cell's
   width used, for a shorter length) */
function opStain(M, cell, x0, x1, y0, y1, z, flip, uf = 1, mat = 'opStain') {
  const [cx, cy, cw, ch] = cell, du = (cw / 1024) * uf, u0 = cx / 1024 + (flip ? du : 0), us = flip ? -du : du, v0 = cy / 1024, dv = ch / 1024;
  M.save().local(1); M.uvS = 1; M.uvO = [0, 0];
  const B = M.buf(mat, (x0 + x1) / 2, (y0 + y1) / 2, z);
  const ids = [[x0, y0, 0, 1], [x1, y0, 1, 1], [x1, y1, 1, 0], [x0, y1, 0, 0]].map(([x, y, a, b]) => M.v(B, x, y, z, 0, 0, 1, u0 + us * a, v0 + dv * b));
  M.quadI(B, ids[0], ids[1], ids[2], ids[3]);
  M.restore();
}
/* The same laid flat on a floor at height y */
function opStainFlat(M, cell, x0, x1, z0, z1, y) {
  const [cx, cy, cw, ch] = cell, u0 = cx / 1024, du = cw / 1024, v0 = cy / 1024, dv = ch / 1024;
  M.save().local(1); M.uvS = 1; M.uvO = [0, 0];
  const B = M.buf('opStain', (x0 + x1) / 2, y, (z0 + z1) / 2);
  const ids = [[x0, z1, 0, 1], [x1, z1, 1, 1], [x1, z0, 1, 0], [x0, z0, 0, 0]].map(([x, z, a, b]) => M.v(B, x, y, z, 0, 1, 0, u0 + du * a, v0 + dv * b));
  M.quadI(B, ids[0], ids[1], ids[2], ids[3]);
  M.restore();
}
/* Materials of the building (called by opCpMaterials): concrete panels, painted olive corrugated sheet, grating, upper floor vinyl,
   ceilings lit by their fittings (a face turned downward far from the windows stays black otherwise), clear window glass, atlas and lit
   screens */
function opMakeMaterials(M) {
  M('opPanel', { tex: 'opPanel', grime: 0.25, streak: 0.6, dust: 0.25, macro: 0.35, relief: 0.02 });
  M('opWallIn', { tex: 'opWallIn', macro: 0.16, dust: 0.08, grime: 0.05, streak: 0, relief: 0.02 });
  // run-off, mud, contact shadows: blended onto the surfaces, no shadow (like the decals of the library)
  M('opStain', { tex: 'opStain', rough: 0.95, env: 0.15, macro: 0, scale: 1, noNormal: true, polyOff: -4 });
  Object.assign(MAT.opStain, { transparent: true, depthWrite: false }); MAT.opStain.defines.WM_CUT = ''; MAT.opStain.userData.noShadow = true;
  // the painted band: the same atlas, cut out (its ragged edge and chips), drawn with the walls
  M('opDado', { tex: 'opStain', cut: 0.5, rough: 0.92, env: 0.15, macro: 0.2, grime: 0.06, dust: 0.06, scale: 1, noNormal: true, polyOff: -2 });
  MAT.opDado.userData.noShadow = true;
  M('opWood', { tex: 'opWood', env: 0.04, macro: 0, dust: 0.04, grime: 0 });
  M('opFabric', { tex: 'canvas', scale: 0.6, macro: 0.1, dust: 0.2 }); // chair fabric: the canvas weave at half its scale
  M('opSheetUnder', { tex: 'opPaintTx', metal: 0.05, env: 0.1, emissive: [0.03, 0.035, 0.024] }); // underside of the awning's sheet (it faces the shaded porch)
  // smooth enamel and plastic casings, ceramics (tinted by vertices); brushed steel of tops, sinks, shelves, conduits and rails; mirror
  M('opEnamel', { rough: 0.42, env: 0.5, macro: 0.16, dust: 0.2, grime: 0.2 });
  M('opInox', { rough: 0.42, metal: 0.6, env: 0.9, macro: 0.12, dust: 0.12 });
  M('opCeramic', { rough: 0.1, env: 1.1, macro: 0.02, dust: 0.03 }); // clean glossy sanitary ware
  M('opMirror', { rough: 0.03, metal: 1, env: 1.9, macro: 0, emissive: [0.03, 0.033, 0.035] });
  M('opPaint', { tex: 'opPaintTx', metal: 0.1, env: 0.2, grime: 0.14, dust: 0.2, macro: 0.12 });
  M('opCase', { tex: 'paint', metal: 0.1, ma: true, env: 0.3, grime: 0.6, streak: 0.6, dust: 0.45, macro: 0.3, normalScale: 0.2 });
  M('opSheet', { tex: 'paint', metal: 0.05, ma: true, env: 0.15, grime: 0.8, streak: 0.8, dust: 0.04, macro: 0.4, normalScale: 0.2 });
  M('opSteel', { tex: 'opSteelTx', metal: 0.4, env: 0.3, dust: 0.25, grime: 0.15, macro: 0.12 });
  M('opRoof', { tex: 'opWallIn', macro: 0.12, dust: 0.12, grime: 0.05 }); // roof deck: the cast slab, even
  M('opCorr', { tex: 'corrugated', metal: 0.3, ma: true, env: 0.55, grime: 0.7, streak: 0.7, dust: 0.3, macro: 0.25 });
  M('opGrating', { tex: 'grating', cut: 0.5, metal: 0.7, env: 0.8, macro: 0.15 });
  M('opVinyl', { tex: 'vinyl', env: 0.25, macro: 0.12, dust: 0.12, grime: 0.07 });
  M('opFloor', { tex: 'concrete', env: 0.3, macro: 0.12, dust: 0.15, rough: 0.88 });
  M('opCeil', { tex: 'opCeilTx', macro: 0.1, emissive: [0.06, 0.058, 0.054], noShadow: true });
  M('opCeilUp', { tex: 'opCeilTx', macro: 0.1, emissive: [0.12, 0.117, 0.108], noShadow: true }); // (upstairs: one fitting a room, the slab would stay dark)
  M('opSigns', { tex: 'opSigns', rough: 0.55, env: 0.45, macro: 0.05, scale: 1, noNormal: true, polyOff: -2 });
  // dark tinted glazing: the sky and the jungle reflect in it, a lit room shows faintly through
  // (two faces: opGlass seen from outside, nearly opaque; opGlassIn seen from the rooms, clear enough to watch the yard through it)
  for (const [k, op, mt, env] of [['opGlass', 0.94, 0.9, 1.7], ['opGlassIn', 0.3, 0.1, 0.7]]) {
    const g = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: op, depthWrite: false, roughness: 0.04, metalness: mt, envMapIntensity: env, side: THREE.FrontSide });
    g.userData.noShadow = true; g.userData.noAO = true; g.userData.noReceive = true; MAT[k] = g;
  }
  // what casts a pane's shadow: drawn nowhere, seen by the sun only (near cascades, no depth pre-pass: see NEAR_SHADOW, 02a-kit.js)
  MAT.opShade = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide }); MAT.opShade.userData.noReceive = true;
  NEAR_SHADOW.add('opShade');
  // a dark veil across an open sash, seen from outside only: the lit room behind would otherwise shine out of the facade
  MAT.opVeil = new THREE.MeshBasicMaterial({ color: 0x101816, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.FrontSide }); MAT.opVeil.userData.noShadow = true;
  // warm strip lights (about 3000 K) and their screens
  MAT.opLamp = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(1.5, 1.02, 0.46) }); MAT.opLamp.userData.noShadow = true;
  // the glow around a fitting: a cell of the weathering atlas added to what is behind it
  MAT.opGlow = new THREE.MeshBasicMaterial({ map: TEX.opStain.map, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  MAT.opGlow.userData.noShadow = true;
  MAT.opLed = new THREE.MeshBasicMaterial({ vertexColors: true }); MAT.opLed.userData.noShadow = true; // indicator lights, tinted by the vertices
  MAT.opScreen = new THREE.MeshBasicMaterial({ map: TEX.opSigns.map, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }); MAT.opScreen.userData.noShadow = true;
}

/* ---------- Upper floor: office kit (sheet 2) ---------- */
/* 01 Office desk (w x d, 0.75 m): warm wood top, olive steel drawer pedestals (o.ped: 2 sides, 1, 0), modesty panel */
PF.opDesk = (w = 1.6, d = 0.8, ped = 2, tone = 1) => prefab('opDesk' + w + d + ped + (tone === 1 ? '' : tone), (M) => { // (tone: the top's tint where a desk stands out of the sun)
  M.local(1); M.color(OPC.woodUp.map((v) => v * tone)); M.boxB('opWood', -w / 2, w / 2, 0.715, 0.75, -d / 2, d / 2, { bevel: 0.008 });
  M.color(OPC.olive);
  const sides = ped === 2 ? [-1, 1] : ped === 1 ? [1] : [];
  for (const s of sides) {
    const x0 = s > 0 ? w / 2 - 0.42 : -w / 2 + 0.02, x1 = x0 + 0.4;
    M.boxB('opPaint', x0, x1, 0.04, 0.715, -d / 2 + 0.04, d / 2 - 0.03, { bevel: 0.006 });
    M.color(OPC.oliveDk); M.boxB('opPaint', x0 + 0.02, x1 - 0.02, 0, 0.04, -d / 2 + 0.06, d / 2 - 0.05); M.color(OPC.olive);
    M.cls = 2; M.color(OPC.handle);
    for (const y of [0.17, 0.39, 0.6]) M.boxB('opSteel', (x0 + x1) / 2 - 0.06, (x0 + x1) / 2 + 0.06, y, y + 0.02, d / 2 - 0.03, d / 2 - 0.005);
    M.color(OPC.oliveDk); for (const y of [0.29, 0.5]) M.boxB('opPaint', x0 + 0.01, x1 - 0.01, y, y + 0.006, d / 2 - 0.031, d / 2 - 0.025);
    M.cls = 0; M.color(OPC.olive);
  }
  if (ped < 2) for (const sx of ped === 1 ? [-1] : [-1, 1]) M.boxB('opPaint', sx * (w / 2 - 0.02) - 0.02, sx * (w / 2 - 0.02) + 0.02, 0, 0.715, -d / 2 + 0.04, d / 2 - 0.04);
  M.boxB('opPaint', -w / 2 + 0.05, w / 2 - 0.05, 0.3, 0.7, -d / 2 + 0.05, -d / 2 + 0.07);
  M.col(-w / 2, w / 2, 0, 0.75, -d / 2, d / 2, 'wood', false, false);
});
/* 02 Swivel chair: five-star base on casters, gas column, olive seat and backrest, armrests; seated facing +z. No collision */
PF.opSwivel = () => prefab('opSwivel', (M) => {
  M.local(1); M.cls = 1; M.color(OPC.black);
  for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; M.save().rotY(a); M.boxB('plastic', -0.02, 0.02, 0.06, 0.1, 0, 0.3); M.save().move(0, 0, 0.3); M.cyl('rubber', 0.03, 0.06, 6); M.restore(); M.restore(); }
  M.save().move(0, 0.08, 0); M.cyl('opSteel', 0.025, 0.36, 6); M.restore();
  M.cls = 0; M.color(OPC.fabric);
  M.boxB('opFabric', -0.24, 0.24, 0.44, 0.52, -0.22, 0.24, { bevel: 0.03 });
  M.save().move(0, 0.56, -0.25).rotX(-0.12); M.boxB('opFabric', -0.22, 0.22, 0, 0.56, -0.03, 0.04, { bevel: 0.035 }); M.restore();
  M.cls = 1; M.color(OPC.black);
  M.boxB('plastic', -0.04, 0.04, 0.45, 0.6, -0.27, -0.24);
  for (const s of [-1, 1]) { M.boxB('plastic', s * 0.26 - 0.015, s * 0.26 + 0.015, 0.48, 0.66, -0.05, -0.01); M.boxB('plastic', s * 0.26 - 0.03, s * 0.26 + 0.03, 0.66, 0.69, -0.16, 0.12, { bevel: 0.01 }); }
});
/* 03 Visitor chair (also the briefing chair, sheet item 13): black steel tube frame, olive seat and back; facing +z. No collision */
PF.opVisitor = (arms = true) => prefab('opVisitor' + arms, (M) => {
  M.local(1); M.cls = 1; M.color(OPC.black);
  for (const s of [-1, 1]) {
    M.tube('opSteel', 0.012, [[s * 0.23, 0, 0.22], [s * 0.23, 0.44, 0.22], [s * 0.23, 0.44, -0.2], [s * 0.23, 0, -0.22]], 5);
    M.tube('opSteel', 0.012, [[s * 0.21, 0.44, -0.21], [s * 0.21, 0.88, -0.27]], 5);
    if (arms) M.tube('opSteel', 0.012, [[s * 0.25, 0.44, 0.18], [s * 0.25, 0.64, 0.16], [s * 0.25, 0.64, -0.16], [s * 0.23, 0.6, -0.22]], 5);
  }
  M.cls = 0; M.color(OPC.fabric);
  M.boxB('opFabric', -0.23, 0.23, 0.44, 0.49, -0.21, 0.23, { bevel: 0.02 });
  M.save().move(0, 0.6, -0.25).rotX(-0.15); M.boxB('opFabric', -0.22, 0.22, 0, 0.27, -0.025, 0.02, { bevel: 0.015 }); M.restore();
});
/* 04 Monitor (0.6 m, on a desk): black stand, bezel, lit screen (atlas cell scr); 05 keyboard and mouse in front; 06 computer tower (o.tower:
   beside, on the floor: dx) */
PF.opMonitor = (scr) => prefab('opMonitor' + scr, (M) => {
  M.local(1); M.cls = 1; M.color(OPC.black);
  M.boxB('plastic', -0.12, 0.12, 0, 0.015, -0.08, 0.08); M.boxB('plastic', -0.03, 0.03, 0.015, 0.16, -0.05, -0.02);
  M.boxB('plastic', -0.3, 0.3, 0.1, 0.46, -0.03, 0.0, { bevel: 0.006 });
  M.color([1, 1, 1]); opAtlas(M, 'opScreen', scr, -0.285, 0.285, 0.115, 0.445, 0.002);
  // keyboard and mouse
  M.color([0.045, 0.045, 0.045]); M.boxB('plastic', -0.22, 0.22, 0, 0.02, 0.14, 0.29, { bevel: 0.005 });
  M.color([0.085, 0.085, 0.085]); for (let r = 0; r < 4; r++) M.boxB('plastic', -0.205, 0.205, 0.02, 0.026, 0.155 + r * 0.033, 0.18 + r * 0.033);
  M.color([0.045, 0.045, 0.045]); M.boxB('plastic', 0.28, 0.34, 0, 0.03, 0.17, 0.27, { bevel: 0.012 });
});
PF.opTower = () => prefab('opTower', (M) => {
  M.local(1); M.color([0.1, 0.1, 0.11]); M.boxB('plastic', -0.1, 0.1, 0, 0.42, -0.22, 0.22, { bevel: 0.01 });
  M.cls = 2; M.color([0.3, 0.9, 1.0]); M.boxB('lamp', 0.03, 0.07, 0.36, 0.37, 0.22, 0.226); M.color([0.25, 0.25, 0.25]); M.boxB('plastic', -0.07, 0.07, 0.25, 0.3, 0.22, 0.225);
});
/* 07 Task lamp: weighted base, two arms, shade with a lit bulb (no light of its own: the room's fittings light it) */
PF.opTaskLamp = () => prefab('opTaskLamp', (M) => {
  // round weighted base, two arm segments with a joint, dome shade with its lit bulb
  M.local(1); M.cls = 1; M.color(OPC.black);
  M.cyl('opSteel', 0.08, 0.025, 12);
  M.tube('opSteel', 0.009, [[0, 0.02, 0], [0, 0.25, -0.09]], 5); M.tube('opSteel', 0.009, [[0, 0.25, -0.09], [0, 0.44, 0.08]], 5);
  M.save().move(-0.016, 0.25, -0.09).rotZ(-Math.PI / 2); M.cyl('opSteel', 0.02, 0.032, 8); M.restore();
  M.save().move(0, 0.45, 0.1).rotX(Math.PI - 0.45);
  M.lathe('opPaint', [[0.012, 0], [0.05, 0.012], [0.08, 0.04], [0.09, 0.075], [0.084, 0.075], [0.074, 0.042], [0.045, 0.018], [0.012, 0.008]], 12, { uR: 0.09 });
  M.color([1, 1, 1]); M.save().move(0, 0.06, 0); M.cyl('opLamp', 0.07, 0.008, 10, { caps: 't' }); M.restore();
  M.restore();
});
/* 08 Filing cabinet: four olive drawers with handles and label holders (0.46 x 0.62, 1.32 m) */
PF.opFiling = () => prefab('opFiling', (M) => {
  M.local(1); M.color(opOl(0.96)); M.boxB('opPaint', -0.23, 0.23, 0, 1.32, -0.31, 0.31, { bevel: 0.01 });
  M.cls = 2;
  for (let k = 0; k < 4; k++) {
    const y = 0.06 + k * 0.315;
    M.color(OPC.oliveDk); M.boxB('opPaint', -0.21, 0.21, y + 0.29, y + 0.297, 0.31, 0.316);
    M.color(OPC.handle); M.boxB('opSteel', -0.08, 0.08, y + 0.18, y + 0.2, 0.31, 0.335); M.boxB('opSteel', -0.04, 0.04, y + 0.23, y + 0.26, 0.31, 0.318);
  }
  M.cls = 0; M.col(-0.23, 0.23, 0, 1.32, -0.31, 0.31, 'metal', false, false);
});
/* 09 Bookcase (w, 1.8 m, 0.4 deep): olive steel shelves, binders in colors, file boxes (collision placed with it, like the shelving) */
PF.opBookcase = (w = 1.2, seed = 0) => prefab('opBookcase' + w + '_' + seed, (M) => {
  const R = rngOf(Math.round(w * 37) + seed * 101); M.local(1); M.color(OPC.olive);
  for (const x of [-w / 2, w / 2 - 0.025]) M.boxB('opPaint', x, x + 0.025, 0, 1.8, -0.2, 0.2);
  M.boxB('opPaint', -w / 2, w / 2, 0, 1.8, -0.2, -0.185);
  for (const y of [0.05, 0.47, 0.89, 1.31, 1.775]) M.boxB('opPaint', -w / 2 + 0.025, w / 2 - 0.025, y - 0.025, y, -0.185, 0.2);
  M.cls = 1;
  // muted binders (greys, slate blues, a dull green), tan file boxes, gaps; each unit its own filling (seed)
  const cols = [[0.36, 0.4, 0.46], [0.5, 0.52, 0.54], [0.27, 0.3, 0.36], [0.6, 0.57, 0.5], [0.4, 0.44, 0.39], [0.68, 0.67, 0.63], [0.3, 0.31, 0.3]];
  for (const y of [0.05, 0.47, 0.89, 1.31]) {
    let x = -w / 2 + 0.04;
    while (x < w / 2 - 0.12) {
      const k = R();
      if (k < 0.2) { const bw = 0.26 + R() * 0.06; if (x + bw > w / 2 - 0.03) break; M.color([0.6, 0.54, 0.45]); M.boxB('opEnamel', x, x + bw, y, y + 0.2 + R() * 0.06, -0.16, 0.15); x += bw + 0.02; continue; }
      if (k < 0.34) { x += 0.1 + R() * 0.2; continue; }
      const n = 2 + Math.floor(R() * 5), c = cols[Math.floor(R() * cols.length)], th = 0.045 + R() * 0.02;
      for (let i = 0; i < n && x < w / 2 - 0.08; i++) { M.color(c); M.boxB('opEnamel', x, x + th - 0.004, y, y + 0.27 + R() * 0.05, -0.15, 0.12 + R() * 0.02); x += th; }
      x += 0.02 + R() * 0.06;
    }
  }
});
/* 10 Wall map board (2.0 x 1.2): the jungle terrain map in a wooden frame; 11 whiteboard (1.8 x 1.2): aluminum frame, marker tray */
PF.opMapBoard = (w = 2.0, h = 1.2, cell = OPS.mapW) => prefab('opMapBoard' + w + cell, (M) => {
  M.local(1); M.color([0.62, 0.64, 0.7]);
  M.boxB('opWood', -w / 2 + 0.01, w / 2 - 0.01, -h / 2 + 0.01, h / 2 - 0.01, 0, 0.02);
  for (const [x0, x1, y0, y1] of [[-w / 2, w / 2, -h / 2, -h / 2 + 0.05], [-w / 2, w / 2, h / 2 - 0.05, h / 2], [-w / 2, -w / 2 + 0.05, -h / 2, h / 2], [w / 2 - 0.05, w / 2, -h / 2, h / 2]]) M.boxB('opWood', x0, x1, y0, y1, 0, 0.045, { bevel: 0.008 });
  M.color([1, 1, 1]); opAtlas(M, 'opSigns', cell, -w / 2 + 0.05, w / 2 - 0.05, -h / 2 + 0.05, h / 2 - 0.05, 0.022);
  M.color([0.85, 0.15, 0.1]); M.cls = 2; for (const [x, y] of [[-0.3, 0.2], [0.4, -0.1], [0.1, 0.3]]) M.boxB('plastic', x - 0.012, x + 0.012, y - 0.012, y + 0.012, 0.022, 0.04);
});
PF.opWhiteboard = () => prefab('opWhiteboard', (M) => {
  M.local(1); M.color([0.75, 0.76, 0.78]);
  M.boxB('opInox', -0.9, 0.9, -0.6, 0.6, 0, 0.015);
  for (const [x0, x1, y0, y1] of [[-0.9, 0.9, -0.6, -0.57], [-0.9, 0.9, 0.57, 0.6], [-0.9, -0.87, -0.6, 0.6], [0.87, 0.9, -0.6, 0.6]]) M.boxB('opInox', x0, x1, y0, y1, 0, 0.03);
  M.color([0.8, 0.8, 0.8]); opAtlas(M, 'opSigns', OPS.board, -0.87, 0.87, -0.57, 0.57, 0.017);
  M.color([0.75, 0.76, 0.78]); M.boxB('opInox', -0.5, 0.5, -0.64, -0.6, 0, 0.07);
  M.cls = 2; for (const [x, c] of [[-0.3, [0.15, 0.25, 0.7]], [-0.2, [0.75, 0.15, 0.1]], [0.25, [0.1, 0.1, 0.1]]]) { M.color(c); M.boxB('plastic', x, x + 0.12, -0.6, -0.585, 0.025, 0.045); }
});
/* 12 Planning table (2.0 x 1.0, 0.75 m): wood top, steel legs and stretcher, the terrain map laid on it, rolled maps */
PF.opPlanTable = (L = 2.0, D = 1.0, map = true) => prefab('opPlanTable' + L + D + map, (M) => {
  const hl = L / 2, hd = D / 2, lx = hl - 0.08, lz = hd - 0.08;
  M.local(1); M.color(OPC.woodUp); M.boxB('opWood', -hl, hl, 0.71, 0.75, -hd, hd, { bevel: 0.008 });
  M.color(OPC.steelDk);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.boxB('opSteel', sx * lx - 0.03, sx * lx + 0.03, 0, 0.71, sz * lz - 0.03, sz * lz + 0.03);
  for (const sz of [-1, 1]) M.boxB('opSteel', -lx, lx, 0.6, 0.66, sz * lz - 0.015, sz * lz + 0.015);
  if (map) {
    M.color([1, 1, 1]); opAtlas(M, 'opSigns', OPS.mapT, -hl + 0.28, hl - 0.38, -hd + 0.12, hd - 0.1, 0.752, true);
    M.cls = 1; M.color([0.93, 0.92, 0.86]);
    for (const [z, r] of [[-0.2 * D, 0.2], [0.12 * D, -0.15]]) { M.save().move(hl - 0.2, 0.785, z).rotY(r).rotZ(Math.PI / 2); M.cyl('canvas', 0.035, 0.55, 8, { caps: 'bt' }); M.restore(); }
  }
  M.col(-hl, hl, 0, 0.75, -hd, hd, 'wood', false, false);
});
/* 14 Radio console (1.8 x 0.8): desk with olive radio sets (front panels from the atlas, knobs), handset, headset, microphone */
PF.opRadioConsole = () => prefab('opRadioConsole', (M) => {
  M.local(1); M.put(PF.opDesk(1.8, 0.8, 2), { nocol: true });
  const sets = [[-0.8, -0.28, 0.26, 0.22], [-0.26, 0.24, 0.3, 0.24], [0.28, 0.82, 0.22, 0.2]];
  M.color(OPC.olive);
  for (const [x0, x1, h, d] of sets) M.boxB('opPaint', x0, x1, 0.75, 0.75 + h, -0.38, -0.38 + d + 0.2, { bevel: 0.01 });
  M.color(OPC.oliveDk); M.boxB('opPaint', -0.24, 0.22, 0.75 + 0.3, 0.75 + 0.46, -0.36, -0.06, { bevel: 0.01 }); // a speaker on the middle set
  M.cls = 2; M.color([0.1, 0.1, 0.1]); M.boxB('dark', -0.2, 0.18, 1.07, 1.19, -0.062, -0.056); M.cls = 0;
  M.cls = 1; M.color([1, 1, 1]);
  for (const [x0, x1, h, d] of sets) { M.save().move(0, 0, -0.18 + d); opAtlas(M, 'opScreen', OPS.radio, x0 + 0.03, x1 - 0.03, 0.75 + h * 0.45, 0.75 + h - 0.03, 0.001); M.restore(); }
  M.color([0.1, 0.1, 0.1]);
  for (const [x0, x1, h, d] of sets) for (let k = 0; k < 4; k++) { M.save().move(x0 + 0.06 + k * (x1 - x0 - 0.12) / 3, 0.75 + h * 0.22, -0.18 + d).rotX(Math.PI / 2); M.cyl('plastic', 0.02, 0.025, 8); M.restore(); }
  // handset on its hook, headset, desk microphone
  M.boxB('plastic', 0.55, 0.62, 0.75, 0.79, 0.1, 0.32, { bevel: 0.015 });
  M.save().move(-0.4, 0.75, 0.2); M.cyl('plastic', 0.05, 0.02, 8); M.tube('opSteel', 0.006, [[0, 0.02, 0], [0, 0.12, 0], [0.01, 0.2, 0.03], [0.02, 0.25, 0.09], [0.02, 0.25, 0.13]], 4); M.save().move(0.02, 0.25, 0.14); M.boxB('plastic', -0.012, 0.012, -0.012, 0.012, 0, 0.035); M.restore(); M.restore();
  M.tube('plastic', 0.008, Array.from({ length: 9 }, (_, i) => { const a = (i / 8) * Math.PI; return [0.15 - Math.cos(a) * 0.085, 0.79 + Math.sin(a) * 0.1, 0.15]; }), 5);
  for (const x of [0.065, 0.235]) { M.save().move(x - 0.014, 0.79, 0.15).rotZ(-Math.PI / 2); M.cyl('plastic', 0.04, 0.028, 10); M.restore(); }
  M.col(-0.9, 0.9, 0, 0.75, -0.4, 0.4, 'wood', false, false);
});
/* 15 Equipment rack (0.6 x 0.8, 1.8 m): black cabinet, perforated door frame, units with indicator lights */
PF.opRack = () => prefab('opRack', (M) => {
  const R = rngOf(73); M.local(1); M.color([0.13, 0.14, 0.15]);
  M.boxB('opEnamel', -0.3, 0.3, 0, 1.8, -0.4, 0.36, { bevel: 0.01 });
  M.cls = 1;
  // front: two rails, rack units (grey faces, handles, a row of green and amber lights each), blank panels
  M.color([0.4, 0.41, 0.42]); for (const x of [-0.27, 0.25]) M.boxB('opInox', x, x + 0.02, 0.08, 1.74, 0.36, 0.372);
  for (let y = 0.12, k = 0; y < 1.62; y += 0.2, k++) {
    const blank = k === 3;
    M.color(blank ? [0.2, 0.21, 0.22] : [0.3, 0.31, 0.33]); M.boxB('opEnamel', -0.24, 0.24, y, y + 0.17, 0.36, 0.378);
    if (blank) continue;
    M.color([0.12, 0.12, 0.13]); for (const x of [-0.22, 0.2]) M.boxB('plastic', x, x + 0.02, y + 0.04, y + 0.13, 0.378, 0.4);
    for (let i = 0; i < 6; i++) { M.color(R() < 0.65 ? [0.25, 1, 0.4] : [1, 0.62, 0.12]); M.boxB('opLed', -0.17 + i * 0.035, -0.152 + i * 0.035, y + 0.11, y + 0.128, 0.378, 0.383); }
    M.color([0.08, 0.08, 0.09]); M.boxB('dark', 0.02, 0.17, y + 0.035, y + 0.075, 0.378, 0.381);
  }
  M.cls = 0; M.col(-0.3, 0.3, 0, 1.8, -0.4, 0.4, 'metal', false, false);
});
/* 16 Storage locker (n doors of dw, h high: 1.8 m upstairs, 2.0 m for the hall's three-door one, 0.5 deep): olive, louvered vents, handles */
PF.opLocker = (n = 2, dw = 0.45, h = 1.8) => prefab('opLocker' + n + dw + h, (M) => {
  const w = n * dw; M.local(1); M.color(h > 1.9 ? opOlH(1.42) : opOl(0.94)); // (the hall's tall one stands in a dim corner)
  M.boxB('opPaint', -w / 2, w / 2, 0.05, h, -0.25, 0.25, { bevel: 0.008 });
  M.color(OPC.oliveDk); M.boxB('opPaint', -w / 2 + 0.01, w / 2 - 0.01, 0, 0.05, -0.23, 0.23);
  M.cls = 2;
  for (let k = 0; k < n; k++) {
    const x0 = -w / 2 + k * dw;
    M.color(OPC.oliveDk); M.boxB('opPaint', x0 + dw - 0.004, x0 + dw + 0.004, 0.08, h - 0.03, 0.25, 0.256);
    for (let v = 0; v < 4; v++) M.boxB('opPaint', x0 + dw * 0.25, x0 + dw * 0.75, h - 0.3 + v * 0.04, h - 0.285 + v * 0.04, 0.25, 0.256);
    for (let v = 0; v < 3; v++) M.boxB('opPaint', x0 + dw * 0.25, x0 + dw * 0.75, 0.2 + v * 0.04, 0.215 + v * 0.04, 0.25, 0.256);
    M.color(OPC.handle); M.boxB('opSteel', x0 + dw - 0.07, x0 + dw - 0.05, 0.9, 1.05, 0.25, 0.28);
  }
  M.cls = 0; M.col(-w / 2, w / 2, 0, h, -0.25, 0.25, 'metal', false, false);
});
/* 17 Wall clock (0.4 m): black rim, face from the atlas */
PF.opClock = () => prefab('opClock', (M) => {
  M.local(1); M.cls = 1; M.color(OPC.black);
  M.save().rotX(Math.PI / 2); M.cyl('plastic', 0.2, 0.05, 16, { r1: 0.19 }); M.restore();
  // face: a disc cut out of its cell
  M.color([1, 1, 1]); M.uvS = 1; M.uvO = [0, 0];
  const [cx, cy, cw] = OPS_CELL[OPS.clock], B = M.buf('opSigns', 0, 0, 0.051), uv = (x, y) => [(cx + cw / 2 + (x / 0.185) * (cw / 2 - 4)) / 1024, (cy + cw / 2 - (y / 0.185) * (cw / 2 - 4)) / 1024];
  const c0 = M.v(B, 0, 0, 0.051, 0, 0, 1, ...uv(0, 0)), ring = [];
  for (let k = 0; k <= 20; k++) { const a = (k / 20) * TAU, x = Math.cos(a) * 0.185, y = Math.sin(a) * 0.185; ring.push(M.v(B, x, y, 0.051, 0, 0, 1, ...uv(x, y))); }
  for (let k = 0; k < 20; k++) M.tri(B, c0, ring[k], ring[k + 1]);
});
/* 18 Waste bin (0.28 m, 0.32 high): black wire-mesh basket */
PF.opBin = () => prefab('opBin', (M) => {
  M.local(1); M.cls = 1; M.color([0.13, 0.13, 0.13]);
  // wire basket: solid bottom, rim, two hoops, twenty uprights; crumpled paper inside
  M.cyl('opSteel', 0.12, 0.012, 10, { caps: 'bt' });
  const hoop = (r, y, t) => M.tube('opSteel', t, Array.from({ length: 15 }, (_, i) => { const a = (i / 14) * TAU; return [Math.cos(a) * r, y, Math.sin(a) * r]; }), 4);
  hoop(0.142, 0.32, 0.008); hoop(0.127, 0.11, 0.004); hoop(0.134, 0.215, 0.004);
  for (let k = 0; k < 20; k++) { const a = (k / 20) * TAU, c = Math.cos(a), sn = Math.sin(a); M.tube('opSteel', 0.0035, [[c * 0.12, 0.01, sn * 0.12], [c * 0.142, 0.32, sn * 0.142]], 3); }
  M.color([0.85, 0.85, 0.8]); M.save().move(0.03, 0.02, 0.02); M.cyl('cardboard', 0.06, 0.1, 5); M.restore();
  M.color([0.8, 0.79, 0.72]); M.save().move(-0.04, 0.02, -0.03).rotY(0.7); M.cyl('cardboard', 0.045, 0.07, 5); M.restore();
});
/* 19 Ceiling light, LED strip (1.2 x 0.18 x 0.08): hung under the ceiling (origin at the ceiling, body below), lit diffuser */
PF.opCeilLight = (L = 1.2) => prefab('opCeilLight' + L, (M) => {
  M.local(1); M.cls = 1; M.color([0.2, 0.21, 0.2]);
  M.boxB('opEnamel', -L / 2, L / 2, -0.07, -0.005, -0.09, 0.09, { bevel: 0.008 });
  for (const s of [-1, 1]) M.boxB('opEnamel', s * (L / 2 - 0.02) - 0.02, s * (L / 2 - 0.02) + 0.02, -0.095, -0.005, -0.095, 0.095, { bevel: 0.006 });
  M.color([1, 1, 1]); M.boxB('opLamp', -L / 2 + 0.04, L / 2 - 0.04, -0.088, -0.07, -0.07, 0.07);
});
/* Wall strip light (L x 0.1, back at z = 0): dark housing, lit diffuser */
PF.opWallStrip = (L = 0.9) => prefab('opWallStrip' + L, (M) => {
  M.local(1); M.cls = 1; M.color([0.2, 0.21, 0.2]); M.boxB('opEnamel', -L / 2, L / 2, -0.06, 0.06, 0, 0.06, { bevel: 0.008 });
  M.color([1, 1, 1]); M.boxB('opLamp', -L / 2 + 0.04, L / 2 - 0.04, -0.04, 0.04, 0.06, 0.068);
});
/* Small olive crate of the reception counter (0.35 x 0.25, 0.25 m): lid seam, dark corners, a latch */
PF.opMiniCrate = () => prefab('opMiniCrate', (M) => {
  M.local(1); M.cls = 1; M.color(opOlH(1.0)); M.boxB('opPaint', -0.175, 0.175, 0, 0.25, -0.125, 0.125, { bevel: 0.008 });
  M.cls = 2; M.color(opOlH(0.8)); M.boxB('opPaint', -0.178, 0.178, 0.185, 0.193, -0.128, 0.128);
  M.color([0.2, 0.21, 0.2]); for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.boxB('opInox', sx * 0.171 - 0.006, sx * 0.171 + 0.006, 0, 0.252, sz * 0.121 - 0.006, sz * 0.121 + 0.006);
  M.boxB('opInox', -0.02, 0.02, 0.15, 0.2, 0.125, 0.133);
});
/* 20 Wall vent (0.4 x 0.3): frame and slanted louvers */
PF.opVent = (w = 0.4, h = 0.3, tint = [0.86, 0.86, 0.84]) => prefab('opVent' + w + h + tint.join(), (M) => {
  M.local(1); M.cls = 1; M.color([0.08, 0.08, 0.08]); M.boxB('dark', -w / 2 + 0.02, w / 2 - 0.02, -h / 2 + 0.02, h / 2 - 0.02, 0, 0.004);
  M.color(tint);
  for (const [x0, x1, y0, y1] of [[-w / 2, w / 2, -h / 2, -h / 2 + 0.025], [-w / 2, w / 2, h / 2 - 0.025, h / 2], [-w / 2, -w / 2 + 0.025, -h / 2, h / 2], [w / 2 - 0.025, w / 2, -h / 2, h / 2]]) M.boxB('opCase', x0, x1, y0, y1, 0, 0.03);
  const n = Math.max(3, Math.round((h - 0.05) / 0.045));
  for (let k = 0; k < n; k++) { const y = -h / 2 + 0.035 + (k + 0.5) * ((h - 0.07) / n); M.save().move(0, y, 0.015).rotX(0.6); M.boxB('opCase', -w / 2 + 0.025, w / 2 - 0.025, -0.002, 0.002, -0.018, 0.018); M.restore(); }
});
/* 21 Kitchenette counter (w x 0.6, 0.9 m): olive base cabinets, steel top with its inset basin and faucet, wall cabinet; 22 mini fridge (0.55 x 0.6, 0.85 m) */
PF.opKitchen = (w = 1.6, front = false) => prefab('opKitchen' + w + front, (M) => { // (front: the sink at the +x end)
  const hw = w / 2, n = Math.max(2, Math.round(w / 0.4)), bx = front ? hw - 0.325 : -hw + 0.325, b0 = bx - 0.225, b1 = bx + 0.225, z0 = -0.17, z1 = 0.23;
  // base cabinets around the basin's recess, kick strip, door seams and handles
  M.local(1); M.color(OPC.olive);
  M.boxB('opPaint', -hw, b0, 0.08, 0.86, -0.3, 0.28); M.boxB('opPaint', b1, hw, 0.08, 0.86, -0.3, 0.28);
  M.boxB('opPaint', b0, b1, 0.08, 0.86, -0.3, z0); M.boxB('opPaint', b0, b1, 0.08, 0.86, z1, 0.28); M.boxB('opPaint', b0, b1, 0.08, 0.76, z0, z1);
  M.color(OPC.oliveDk); M.boxB('opPaint', -hw + 0.02, hw - 0.02, 0, 0.08, -0.28, 0.24);
  M.cls = 2; for (let k = 1; k < n; k++) { const x = -hw + (k * w) / n; M.boxB('opPaint', x - 0.003, x + 0.003, 0.1, 0.84, 0.28, 0.286); }
  M.color(OPC.handle); for (let k = 0; k < n; k++) { const x = -hw + ((k + 0.5) * w) / n; M.boxB('opSteel', x - 0.05, x + 0.05, 0.74, 0.755, 0.28, 0.3); }
  // steel top around the inset basin (0.45 x 0.4, 13 cm deep): its lining, the drain, the faucet over it
  M.cls = 0; M.color([0.62, 0.615, 0.6]);
  M.boxB('opInox', -hw, b0, 0.86, 0.91, -0.3, 0.3); M.boxB('opInox', b1, hw, 0.86, 0.91, -0.3, 0.3);
  M.boxB('opInox', b0, b1, 0.86, 0.91, -0.3, z0); M.boxB('opInox', b0, b1, 0.86, 0.91, z1, 0.3);
  M.color([0.47, 0.468, 0.46]);
  M.boxB('opInox', b0, b1, 0.76, 0.775, z0, z1);
  M.boxB('opInox', b0, b0 + 0.012, 0.775, 0.9, z0, z1); M.boxB('opInox', b1 - 0.012, b1, 0.775, 0.9, z0, z1);
  M.boxB('opInox', b0 + 0.012, b1 - 0.012, 0.775, 0.9, z0, z0 + 0.012); M.boxB('opInox', b0 + 0.012, b1 - 0.012, 0.775, 0.9, z1 - 0.012, z1);
  M.cls = 2; M.color([0.2, 0.21, 0.21]); M.save().move(bx, 0.775, 0.03); M.cyl('opSteel', 0.03, 0.004, 8); M.restore();
  M.cls = 1; M.color([0.8, 0.8, 0.8]); M.tube('opSteel', 0.012, [[bx, 0.91, -0.24], [bx, 1.15, -0.24], [bx, 1.18, -0.14], [bx, 1.1, -0.06]], 5);
  // wall cabinet and the lit strip under it; a kettle and a small appliance on the top
  M.cls = 0; M.color(OPC.olive); M.boxB('opPaint', -hw, hw, 1.45, 2.05, -0.3, 0.02);
  M.cls = 2; M.color(OPC.oliveDk); M.boxB('opPaint', -0.003, 0.003, 1.47, 2.03, 0.02, 0.026);
  M.color([1, 0.95, 0.85]); M.boxB('opLamp', -hw + 0.1, hw - 0.1, 1.435, 1.45, -0.1, -0.02);
  M.cls = 1; M.color([0.2, 0.2, 0.2]); M.save().move(front ? b0 - 0.16 : b1 + 0.16, 0.91, -0.05); M.cyl('opSteel', 0.07, 0.2, 8); M.restore();
  if (w > 1.3) { // microwave: steel grey case, dark door window, control strip, handle
    M.save().move(front ? -hw + 0.33 : hw - 0.33, 0.91, -0.08); M.color([0.42, 0.43, 0.44]); M.boxB('opInox', -0.23, 0.23, 0, 0.27, -0.17, 0.17, { bevel: 0.008 });
    M.cls = 2; M.color([0.07, 0.07, 0.08]); M.boxB('dark', -0.2, 0.09, 0.035, 0.235, 0.17, 0.174); M.color([0.2, 0.2, 0.21]); M.boxB('plastic', 0.12, 0.2, 0.035, 0.235, 0.17, 0.176);
    M.color([0.6, 0.61, 0.62]); M.boxB('opInox', 0.095, 0.108, 0.05, 0.22, 0.174, 0.195); M.cls = 1; M.restore();
  }
  M.col(-hw, hw, 0, 0.9, -0.3, 0.3, 'metal', false, false);
});
PF.opFridge = () => prefab('opFridge', (M) => {
  M.local(1); M.color([0.56, 0.57, 0.57]); M.boxB('opInox', -0.275, 0.275, 0.03, 0.85, -0.3, 0.26, { bevel: 0.012 });
  M.color([0.16, 0.16, 0.17]); M.boxB('plastic', -0.26, 0.26, 0, 0.03, -0.28, 0.24);
  // door: its seam around, a vertical handle, a small badge
  M.color([0.6, 0.61, 0.61]); M.boxB('opInox', -0.265, 0.265, 0.05, 0.84, 0.262, 0.285, { bevel: 0.008 });
  M.cls = 2; M.color([0.2, 0.2, 0.21]); M.boxB('opInox', 0.19, 0.215, 0.38, 0.76, 0.285, 0.32); M.color([0.1, 0.1, 0.1]); M.boxB('plastic', -0.22, -0.14, 0.76, 0.79, 0.285, 0.288);
  M.cls = 0; M.col(-0.275, 0.275, 0, 0.85, -0.3, 0.3, 'metal', false, false);
});
/* 23 Toilet (white ceramic bowl, seat and lid, cistern against the wall at z = 0); 24 handwash basin, faucet, mirror (wall-mounted) */
PF.opToilet = () => prefab('opToilet', (M) => {
  M.local(1); M.color([0.84, 0.83, 0.79]);
  // rounded bowl (its outside, the rim, the inside down to the water), seat ring, cistern with its lid against the wall, flush button
  M.save().move(0, 0, 0.4);
  M.lathe('opCeramic', [[0, 0], [0.1, 0], [0.12, 0.14], [0.19, 0.34], [0.205, 0.4], [0.17, 0.4], [0.13, 0.3], [0, 0.27]], 16, { uR: 0.2 });
  M.color([0.8, 0.81, 0.78]); M.lathe('opCeramic', [[0.125, 0.4], [0.212, 0.4], [0.212, 0.425], [0.125, 0.425]], 16, { uR: 0.2 });
  M.restore();
  M.color([0.84, 0.83, 0.79]); M.boxB('opCeramic', -0.2, 0.2, 0.42, 0.8, 0, 0.18, { bevel: 0.02 });
  M.boxB('opCeramic', -0.21, 0.21, 0.8, 0.83, 0, 0.19, { bevel: 0.01 });
  M.boxB('opCeramic', -0.09, 0.09, 0, 0.42, 0.08, 0.3, { bevel: 0.02 });
  M.cls = 2; M.color([0.7, 0.7, 0.7]); M.save().move(0, 0.83, 0.09); M.cyl('opSteel', 0.025, 0.008, 8); M.restore();
});
PF.opBasin = () => prefab('opBasin', (M) => {
  // wall-hung (0.55 x 0.45): a shelf against the wall, the round bowl in front of it, chrome trap and faucet, framed mirror
  M.local(1); M.color([0.9, 0.9, 0.88]);
  M.boxB('opCeramic', -0.275, 0.275, 0.79, 0.86, 0, 0.14, { bevel: 0.02 });
  M.save().move(0, 0, 0.235); M.lathe('opCeramic', [[0, 0.7], [0.1, 0.71], [0.19, 0.79], [0.215, 0.86], [0.19, 0.86], [0.15, 0.79], [0, 0.765]], 16, { uR: 0.2 }); M.restore();
  M.cls = 1; M.color([0.8, 0.81, 0.82]); M.tube('opInox', 0.016, [[0, 0.7, 0.235], [0, 0.6, 0.235], [0, 0.56, 0.16], [0, 0.56, 0.0]], 6);
  M.tube('opInox', 0.012, [[0, 0.86, 0.05], [0, 0.98, 0.05], [0, 0.98, 0.15]], 5);
  M.color([0.85, 0.88, 0.9]); M.boxB('opMirror', -0.25, 0.25, 1.1, 1.65, 0, 0.012);
  M.cls = 2; M.color([0.95, 0.97, 1.0]); for (const [x, wd] of [[-0.08, 0.035], [0.02, 0.012]]) { M.save().move(x, 1.375, 0.0125).rotZ(-0.5); M.boxB('opCeramic', -wd, wd, -0.27, 0.27, 0, 0.001, { skip: 'xXyYz' }); M.restore(); }
  M.cls = 1; M.color([0.3, 0.3, 0.3]); for (const [x0, x1, y0, y1] of [[-0.265, 0.265, 1.085, 1.1], [-0.265, 0.265, 1.65, 1.665], [-0.265, -0.25, 1.1, 1.65], [0.25, 0.265, 1.1, 1.65]]) M.boxB('opSteel', x0, x1, y0, y1, 0, 0.02);
});

/* ---------- Ground floor: hall kit (sheet 3) ---------- */
/* 1 Reception desk (2.4 x 0.8, 1.1 m): concrete-look front with an olive kick strip, warm wood counter top, work top behind at 0.75 */
PF.opReception = (w = 2.4) => prefab('opReception' + w, (M) => {
  M.local(1); M.color([0.8, 0.79, 0.75]); M.boxB('opPanel', -w / 2, w / 2, 0.12, 1.05, 0.1, 0.4);
  M.color(OPC.olive); M.boxB('opPaint', -w / 2 + 0.01, w / 2 - 0.01, 0, 0.12, 0.12, 0.38);
  M.color(OPC.wood); M.boxB('opWood', -w / 2 - 0.02, w / 2 + 0.02, 1.05, 1.09, 0.06, 0.44, { bevel: 0.008 });
  M.boxB('opWood', -w / 2 + 0.03, w / 2 - 0.03, 0.72, 0.75, -0.4, 0.1);
  M.color(OPC.olive); for (const x of [-w / 2 + 0.05, w / 2 - 0.45]) M.boxB('opPaint', x, x + 0.4, 0, 0.72, -0.36, 0.1);
  M.col(-w / 2, w / 2, 0, 1.09, -0.4, 0.44, 'wood', false, false);
});
/* 3 Preparation table (2.4 x 1.2, 0.9 m): galvanized steel frame and top, green work mat, lower shelf; small crates on the shelf, one on the mat */
PF.opPrepTable = () => prefab('opPrepTable', (M) => {
  M.local(1); M.color([0.46, 0.455, 0.44]); M.boxB('opInox', -1.2, 1.2, 0.86, 0.9, -0.6, 0.6, { bevel: 0.006 });
  M.color(OPC.steelDk);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.boxB('opInox', sx * 1.15 - 0.025, sx * 1.15 + 0.025, 0, 0.86, sz * 0.55 - 0.025, sz * 0.55 + 0.025);
  for (const sz of [-1, 1]) M.boxB('opInox', -1.15, 1.15, 0.8, 0.86, sz * 0.55 - 0.015, sz * 0.55 + 0.015);
  M.boxB('opInox', -1.15, 1.15, 0.2, 0.23, -0.55, 0.55);
  // olive green cutting mat (1.0 x 0.6), left clear; crates on the lower shelf, a small one at the end of the top
  M.color([0.19, 0.27, 0.13]); M.boxB('opEnamel', -0.7, 0.3, 0.9, 0.906, -0.3, 0.3);
  M.save().move(0, 0.23, 0); M.place(PF.opAmmo(1), -0.6, 0, 0.1, 0.1, { nocol: true }); M.place(PF.opAmmo(1), 0.1, 0, 0.12, -0.05, { nocol: true }); M.place(PF.opAmmo(2), 0.75, 0, -0.1, -0.08, { nocol: true }); M.restore();
  M.save().move(0, 0.9, 0); M.place(PF.opAmmo(1), 0.82, 0, 0.3, 0.2, { nocol: true }); M.restore();
  M.col(-1.2, 1.2, 0, 0.9, -0.6, 0.6, 'metal', false, false);
});
/* 4 Bench (L x 0.4, 0.45 m): wooden seat on two steel frames */
PF.opBench = (L = 2.0) => prefab('opBench' + L, (M) => {
  M.local(1); M.color(OPC.woodBench); M.boxB('opWood', -L / 2, L / 2, 0.41, 0.45, -0.2, 0.2, { bevel: 0.01 });
  M.color(OPC.steelDk); for (const x of [-L / 2 + 0.12, L / 2 - 0.12]) { M.boxB('opSteel', x - 0.025, x + 0.025, 0, 0.41, -0.16, -0.12); M.boxB('opSteel', x - 0.025, x + 0.025, 0, 0.41, 0.12, 0.16); M.boxB('opSteel', x - 0.025, x + 0.025, 0.36, 0.41, -0.17, 0.17); }
  M.col(-L / 2, L / 2, 0, 0.45, -0.2, 0.2, 'wood', false, false);
});
/* 5 Workbench (L x 0.8, 0.9 m): thick wood top, olive drawer cabinets under both ends, back rail; vise */
PF.opWorkbench = (L = 2.4) => prefab('opWorkbench' + L, (M) => {
  M.local(1); M.color(OPC.woodHall); M.boxB('opWood', -L / 2, L / 2, 0.85, 0.905, -0.4, 0.4, { bevel: 0.01 });
  M.color(OPC.olive);
  for (const s of [-1, 1]) { const x0 = s > 0 ? L / 2 - 0.5 : -L / 2 + 0.02; M.boxB('opPaint', x0, x0 + 0.48, 0, 0.85, -0.38, 0.36, { bevel: 0.006 }); M.cls = 2; M.color(OPC.handle); for (const y of [0.2, 0.45, 0.68]) M.boxB('opSteel', x0 + 0.17, x0 + 0.31, y, y + 0.02, 0.36, 0.38); M.color(OPC.olive); M.cls = 0; }
  M.boxB('opPaint', -L / 2 + 0.5, L / 2 - 0.5, 0.12, 0.16, -0.35, 0.35);
  M.color(OPC.steelDk); M.boxB('opSteel', -L / 2, L / 2, 0.9, 1.0, -0.4, -0.37);
  M.save().move(L / 2 - 0.25, 0.9, 0.3); M.boxB('opSteel', -0.1, 0.1, 0, 0.12, -0.08, 0.08); M.boxB('opSteel', -0.08, 0.08, 0.04, 0.1, 0.08, 0.16); M.restore();
  M.col(-L / 2, L / 2, 0, 0.9, -0.4, 0.4, 'wood', false, false);
});
/* 6 Tool pegboard (1.8 x 0.9, wall-mounted, centered at its middle): perforated gray board, wrenches, pliers, hammers, yellow bins */
PF.opPegboard = () => prefab('opPegboard', (M) => {
  M.local(1); M.color([0.31, 0.32, 0.34]); M.boxB('opEnamel', -0.9, 0.9, -0.45, 0.45, 0, 0.02);
  M.color([0.2, 0.21, 0.22]); for (const [x0, x1, y0, y1] of [[-0.9, 0.9, -0.45, -0.43], [-0.9, 0.9, 0.43, 0.45], [-0.9, -0.88, -0.45, 0.45], [0.88, 0.9, -0.45, 0.45]]) M.boxB('opInox', x0, x1, y0, y1, 0.02, 0.028);
  // the holes (5 cm grid)
  M.cls = 2; M.color([0.08, 0.08, 0.09]);
  for (let y = -0.4; y < 0.41; y += 0.05) for (let x = -0.85; x < 0.86; x += 0.05) M.boxB('dark', x - 0.005, x + 0.005, y - 0.005, y + 0.005, 0.02, 0.0205, { skip: 'xXyYz' });
  M.cls = 1;
  // open-end wrenches by size: shaft, a jaw at the top (two prongs), a ring at the bottom
  for (let k = 0; k < 6; k++) {
    const x = -0.78 + k * 0.085, l = 0.16 + k * 0.03, w = 0.009 + k * 0.0012, yt = 0.33;
    M.color([0.7, 0.71, 0.72]); M.boxB('opInox', x - w, x + w, yt - l, yt, 0.022, 0.03);
    for (const sd of [-1, 1]) M.boxB('opInox', x + sd * (w + 0.008) - 0.006, x + sd * (w + 0.008) + 0.006, yt - 0.005, yt + 0.035, 0.022, 0.03);
    M.boxB('opInox', x - w - 0.008, x + w + 0.008, yt - l - 0.03, yt - l, 0.022, 0.03);
  }
  // pliers with red handles, screwdrivers with colored handles, a hammer, a hacksaw
  for (const x of [-0.2, -0.06]) {
    M.color([0.7, 0.71, 0.72]); M.boxB('opInox', x - 0.014, x + 0.014, 0.2, 0.32, 0.022, 0.032);
    M.color([0.72, 0.12, 0.08]); for (const sd of [-1, 1]) { M.save().move(x + sd * 0.008, 0.2, 0.027).rotZ(sd * 0.16); M.boxB('rubber', -0.009, 0.009, -0.17, 0, -0.006, 0.006); M.restore(); }
  }
  for (const [x, c] of [[0.08, [0.85, 0.65, 0.1]], [0.16, [0.72, 0.12, 0.08]], [0.24, [0.15, 0.25, 0.6]], [0.32, [0.85, 0.65, 0.1]]]) {
    M.color(c); M.boxB('plastic', x - 0.016, x + 0.016, 0.22, 0.33, 0.022, 0.05, { bevel: 0.006 });
    M.color([0.7, 0.71, 0.72]); M.boxB('opInox', x - 0.004, x + 0.004, 0.06 + (x * 0.2), 0.22, 0.03, 0.038);
  }
  M.color([0.55, 0.38, 0.22]); M.boxB('wood', 0.5, 0.53, -0.02, 0.3, 0.022, 0.05); M.color([0.3, 0.31, 0.32]); M.boxB('opInox', 0.44, 0.59, 0.3, 0.35, 0.022, 0.06);
  M.color([0.72, 0.12, 0.08]); M.boxB('plastic', 0.66, 0.84, 0.2, 0.33, 0.022, 0.04); M.color([0.7, 0.71, 0.72]); M.boxB('opInox', 0.68, 0.82, 0.19, 0.2, 0.024, 0.03); M.color([0.55, 0.56, 0.57]); M.boxB('opEnamel', 0.69, 0.81, 0.22, 0.31, 0.03, 0.041);
  // lower half: a coil of cable, a level, a square, three yellow bins
  M.color([0.1, 0.1, 0.1]); M.tube('rubber', 0.012, Array.from({ length: 13 }, (_, i) => { const a = (i / 12) * TAU; return [-0.62 + Math.cos(a) * 0.11, -0.2 + Math.sin(a) * 0.11, 0.035]; }), 5);
  M.color([0.85, 0.65, 0.1]); M.boxB('plastic', -0.38, 0.1, -0.12, -0.07, 0.022, 0.045);
  M.color([0.7, 0.71, 0.72]); M.boxB('opInox', -0.36, -0.33, -0.36, -0.16, 0.022, 0.028); M.boxB('opInox', -0.36, -0.16, -0.36, -0.33, 0.022, 0.028);
  for (let k = 0; k < 3; k++) { const x = 0.2 + k * 0.23; M.color([0.92, 0.74, 0.12]); M.boxB('plastic', x, x + 0.2, -0.38, -0.24, 0.022, 0.14, { bevel: 0.006 }); M.color([0.5, 0.4, 0.06]); M.boxB('dark', x + 0.015, x + 0.185, -0.25, -0.24, 0.03, 0.13, { skip: 'y' }); }
});
/* 7 Steel shelving (L x d, h: 1.3 m in the hall): galvanized posts and shelves, olive crates on each level (medium ones, or small ones turned,
   on a deep shelf; small ones lengthwise on a shallow one). Its collision is placed with it (opSoftPlace, 02yo): open shelves stop soldiers, not shots */
PF.opShelving = (L = 1.8, h = 1.3, d = 0.6) => prefab('opShelving' + L + h + d, (M) => {
  // bays of 0.6 m (deep shelves: a small crate turned across each) or 0.9 m (shallow ones: a small crate lengthwise), posts between the bays;
  // levels at least 0.45 m apart: every crate stands clear of the posts and of the shelf above
  const R = rngOf(Math.round(L * 100 + h * 7)), deep = d >= 0.55, nb = Math.max(1, Math.round(L / (deep ? 0.6 : 0.9))), bw = (L - 0.04) / nb;
  M.local(1); M.color([0.25, 0.26, 0.27]);
  for (let k = 0; k <= nb; k++) { const x = -L / 2 + 0.02 + k * bw; for (const sz of [-1, 1]) M.boxB('opInox', x - 0.02, x + 0.02, 0, h, sz * (d / 2 - 0.02) - 0.02, sz * (d / 2 - 0.02) + 0.02); }
  const ni = Math.max(1, Math.round((h - 0.15) / 0.5)), lv = Array.from({ length: ni + 1 }, (_, i) => 0.12 + (i * (h - 0.15)) / ni);
  M.color([0.32, 0.33, 0.34]); for (const y of lv) M.boxB('opInox', -L / 2, L / 2, y, y + 0.03, -d / 2, d / 2);
  for (const y of lv.slice(0, h < 1.5 ? ni + 1 : ni)) for (let k = 0; k < nb; k++) { // (a low unit carries crates on its top shelf too)
    if (R() < 0.12) continue;
    M.place(PF.opAmmo(1), -L / 2 + 0.02 + (k + 0.5) * bw + (R() - 0.5) * 0.01, y + 0.03, 0, (deep ? Math.PI / 2 : 0) + (R() - 0.5) * 0.02, { nocol: true });
  }
});
/* 8, 9 Olive ammunition crates: 0 large (1.2 x 0.8 x 0.6), 1 small (0.6 x 0.4 x 0.4), 2 medium (0.6 x 0.5 x 0.35): ribbed lid, handles,
   latches, yellow stencil bands */
PF.opAmmo = (k = 0) => prefab('opAmmo' + k, (M) => {
  const [w, d, h] = [[1.2, 0.8, 0.6], [0.6, 0.4, 0.4], [0.6, 0.5, 0.35]][k];
  const ol = [0.98, 1.03, 0.96][k]; M.local(1); M.color(opOlH(ol));
  M.boxB('opPaint', -w / 2, w / 2, 0, h - 0.05, -d / 2, d / 2, { bevel: 0.012 });
  M.color(opOlH(ol * 1.04)); M.boxB('opPaint', -w / 2 - 0.008, w / 2 + 0.008, h - 0.06, h, -d / 2 - 0.008, d / 2 + 0.008, { bevel: 0.01 });
  M.cls = 2;
  // ribs on the lid, a rail at the foot, steel corner fittings, handles on the ends, two small latches on the front and the back
  M.color(opOlH(ol * 0.9)); for (const z of [-d * 0.22, d * 0.22]) M.boxB('opPaint', -w / 2 + 0.05, w / 2 - 0.05, h, h + 0.008, z - 0.025, z + 0.025);
  for (const s of [-1, 1]) { M.boxB('opPaint', -w / 2 + 0.04, w / 2 - 0.04, 0.03, 0.06, s * d / 2 - 0.006, s * d / 2 + 0.006); M.boxB('opPaint', s * w / 2 - 0.006, s * w / 2 + 0.006, 0.03, 0.06, -d / 2 + 0.04, d / 2 - 0.04); }
  M.color([0.17, 0.18, 0.16]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { // thin dark steel strips (3 cm) on the four vertical edges
    const ex = sx * (w / 2 + 0.003), ez = sz * (d / 2 + 0.003);
    M.boxB('opInox', Math.min(ex, ex - sx * 0.03), Math.max(ex, ex - sx * 0.03), 0.01, h - 0.06, ez - 0.0015, ez + 0.0015);
    M.boxB('opInox', ex - 0.0015, ex + 0.0015, 0.01, h - 0.06, Math.min(ez, ez - sz * 0.03), Math.max(ez, ez - sz * 0.03));
  }
  for (const s of [-1, 1]) { M.boxB('opInox', s * w / 2 - 0.004, s * w / 2 + 0.016 * s, h * 0.55, h * 0.62, -0.07, 0.07); for (const x of [-w / 4, w / 4]) M.boxB('opInox', x - 0.02, x + 0.02, h - 0.11, h - 0.05, s * d / 2, s * (d / 2 + 0.012)); }
  M.cls = 0; M.col(-w / 2, w / 2, 0, h, -d / 2, d / 2, 'wood', false, false);
});
/* 11 Rolling cart (1.2 x 0.6, 0.9 m): two steel shelves on casters, push handle */
PF.opCart = () => prefab('opCart', (M) => {
  M.local(1); M.color([0.52, 0.53, 0.53]);
  for (const y of [0.2, 0.8]) M.boxB('opInox', -0.6, 0.6, y, y + 0.03, -0.3, 0.3, { bevel: 0.005 });
  M.color(OPC.steelDk); for (const sx of [-1, 1]) for (const sz of [-1, 1]) { M.boxB('opInox', sx * 0.57 - 0.015, sx * 0.57 + 0.015, 0.1, 0.83, sz * 0.27 - 0.015, sz * 0.27 + 0.015); M.save().move(sx * 0.52, 0, sz * 0.25).rotZ(Math.PI / 2).move(0.05, 0, 0); M.cyl('rubber', 0.05, 0.03, 8); M.restore(); }
  M.tube('opInox', 0.014, [[-0.57, 0.83, -0.25], [-0.585, 0.93, -0.25], [-0.585, 0.93, 0.25], [-0.57, 0.83, 0.25]], 5);
  M.save().move(0, 0.23, 0); M.place(PF.opAmmo(1), 0.1, 0, 0, 0.05, { nocol: true }); M.restore();
  M.col(-0.6, 0.6, 0, 0.9, -0.3, 0.3, 'metal', false, false);
});
/* 12 Hand truck (dolly), leaning: yellow frame, nose plate, two wheels. No collision */
PF.opHandTruck = () => prefab('opHandTruck', (M) => {
  M.local(1); M.cls = 1; M.save().rotX(-0.18); M.color([0.92, 0.72, 0.1]);
  for (const s of [-1, 1]) M.tube('opPaint', 0.016, [[s * 0.18, 0.05, 0], [s * 0.18, 1.15, 0], [s * 0.1, 1.25, 0]], 5);
  M.tube('opPaint', 0.016, [[-0.1, 1.25, 0], [0.1, 1.25, 0]], 5); for (const y of [0.4, 0.8]) M.tube('opPaint', 0.012, [[-0.18, y, 0], [0.18, y, 0]], 4);
  M.color(OPC.steelDk); M.boxB('opSteel', -0.2, 0.2, 0, 0.012, 0, 0.22);
  M.color([0.1, 0.1, 0.1]); for (const s of [-1, 1]) { M.save().move(s * 0.24, 0.12, -0.08).rotZ(Math.PI / 2); M.cyl('rubber', 0.12, 0.06, 10); M.restore(); }
  M.restore();
});
/* 13 First aid cabinet (0.45 x 0.55, wall-mounted, centered); 14 fire extinguisher on its bracket (wall-mounted, bottom at y = 0); 15 electrical panel */
PF.opFirstAid = () => prefab('opAidBox', (M) => {
  M.local(1); M.cls = 1; M.color([0.84, 0.84, 0.8]); M.boxB('opEnamel', -0.22, 0.22, -0.27, 0.27, 0, 0.17, { bevel: 0.012 });
  M.color([0.6, 0.6, 0.57]); M.boxB('opEnamel', -0.225, 0.225, -0.275, 0.275, 0, 0.02); M.color([0.5, 0.5, 0.48]); M.boxB('opSteel', 0.17, 0.19, -0.04, 0.04, 0.17, 0.185);
  M.color([1, 1, 1]); opAtlas(M, 'opSigns', OPS.aid, -0.16, 0.16, -0.16, 0.16, 0.171);
});
PF.opExtinguisher = () => prefab('opExtinguisher', (M) => {
  M.local(1); M.cls = 1; M.color([0.2, 0.2, 0.2]); M.boxB('opInox', -0.05, 0.05, 0.35, 0.5, 0, 0.03);
  // red enamel cylinder, a darker foot ring, its label, valve, gauge, hose and nozzle
  M.color([0.62, 0.07, 0.05]); M.save().move(0, 0, 0.11); M.lathe('opEnamel', [[0, 0], [0.085, 0], [0.09, 0.02], [0.09, 0.46], [0.07, 0.52], [0.025, 0.55], [0, 0.55]], 12, { uR: 0.09 });
  M.color([0.3, 0.04, 0.03]); M.lathe('opEnamel', [[0.091, 0.0], [0.093, 0.0], [0.093, 0.05], [0.091, 0.05]], 12, { uR: 0.09 });
  M.color([0.88, 0.86, 0.8]); M.lathe('opEnamel', [[0.0915, 0.2], [0.0925, 0.2], [0.0925, 0.36], [0.0915, 0.36]], 12, { a0: 0.9, a1: 2.3, uR: 0.09 });
  M.color([0.12, 0.12, 0.12]); M.lathe('plastic', [[0.0925, 0.25], [0.0935, 0.25], [0.0935, 0.28], [0.0925, 0.28]], 8, { a0: 1.1, a1: 2.1, uR: 0.09 });
  M.restore();
  M.color([0.12, 0.12, 0.12]); M.boxB('opInox', -0.02, 0.06, 0.54, 0.6, 0.09, 0.13); M.boxB('opInox', -0.05, 0.07, 0.6, 0.62, 0.095, 0.125);
  M.color([0.85, 0.85, 0.8]); M.save().move(-0.03, 0.57, 0.14).rotX(Math.PI / 2); M.cyl('opEnamel', 0.018, 0.01, 8); M.restore();
  M.color([0.1, 0.1, 0.1]); M.tube('rubber', 0.01, [[0.04, 0.56, 0.11], [0.1, 0.5, 0.14], [0.1, 0.25, 0.15]], 4); M.boxB('plastic', 0.085, 0.115, 0.2, 0.26, 0.135, 0.165);
  M.color([1, 1, 1]); opAtlas(M, 'opSigns', OPS.fire, -0.08, 0.08, 0.72, 0.88, 0.002);
});
PF.opElecPanel = () => prefab('opElecPanel', (M) => {
  M.local(1); M.color([0.72, 0.73, 0.72]); M.boxB('opEnamel', -0.3, 0.3, 0, 0.9, 0, 0.2, { bevel: 0.01 });
  M.cls = 2; M.color([0.55, 0.56, 0.55]); M.boxB('opEnamel', -0.28, 0.28, 0.02, 0.88, 0.2, 0.205); M.color([0.15, 0.15, 0.15]); M.boxB('opSteel', 0.2, 0.24, 0.4, 0.52, 0.2, 0.23);
  M.cls = 1; M.color([1, 1, 1]); opAtlas(M, 'opSigns', OPS.volt, -0.09, 0.09, 0.62, 0.8, 0.207);
  M.color([0.62, 0.63, 0.62]); for (const x of [-0.18, -0.06, 0.06, 0.18]) M.tube('opSteel', 0.022, [[x, 0.0, 0.1], [x, -0.15, 0.1], [x, -0.3, 0.1]], 6);
});
/* 16 Utility sink (0.9 x 0.6, 0.9 m): stainless basin on legs, faucet; 17 water cooler (0.35 x 0.35, 1.3 m with its blue bottle); 18 industrial
   waste bin (0.4 x 0.4, 0.8 m, olive with lid) */
PF.opSink = () => prefab('opSink', (M) => {
  // stainless tub: bottom, four walls, the drain
  M.local(1); M.color([0.6, 0.62, 0.63]);
  M.boxB('opInox', -0.45, 0.45, 0.62, 0.66, -0.3, 0.3);
  for (const [x0, x1, z0, z1] of [[-0.45, 0.45, -0.3, -0.27], [-0.45, 0.45, 0.27, 0.3], [-0.45, -0.42, -0.27, 0.27], [0.42, 0.45, -0.27, 0.27]]) M.boxB('opInox', x0, x1, 0.66, 0.9, z0, z1);
  M.color([0.2, 0.21, 0.21]); M.save().move(0, 0.66, 0.05); M.cyl('opSteel', 0.035, 0.004, 8); M.restore();
  M.color(OPC.steelDk); for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.boxB('opSteel', sx * 0.4 - 0.02, sx * 0.4 + 0.02, 0, 0.62, sz * 0.25 - 0.02, sz * 0.25 + 0.02);
  M.boxB('opInox', -0.4, 0.4, 0.15, 0.18, -0.27, 0.27);
  M.color([0.6, 0.62, 0.63]); M.boxB('opInox', -0.45, 0.45, 0.9, 1.15, -0.3, -0.275); // splash-back
  M.color([0.8, 0.8, 0.8]); M.tube('opSteel', 0.014, [[0, 0.9, -0.25], [0, 1.2, -0.25], [0, 1.22, -0.12], [0, 1.1, -0.05]], 5);
  M.col(-0.45, 0.45, 0, 0.9, -0.3, 0.3, 'metal', false, false);
});
PF.opCooler = () => prefab('opCooler', (M) => {
  M.local(1); M.color([0.82, 0.82, 0.79]); M.boxB('opEnamel', -0.17, 0.17, 0, 0.9, -0.17, 0.17, { bevel: 0.02 });
  M.color([0.55, 0.56, 0.55]); M.boxB('opEnamel', -0.172, 0.172, 0, 0.06, -0.172, 0.172); M.boxB('opEnamel', -0.13, 0.13, 0.5, 0.56, 0.165, 0.2);
  M.cls = 2; M.color([0.2, 0.2, 0.2]); M.boxB('plastic', -0.1, 0.1, 0.62, 0.78, 0.17, 0.19); M.color([0.85, 0.2, 0.15]); M.boxB('plastic', -0.06, -0.03, 0.72, 0.76, 0.18, 0.21); M.color([0.2, 0.4, 0.85]); M.boxB('plastic', 0.03, 0.06, 0.72, 0.76, 0.18, 0.21);
  M.cls = 0; M.color([0.45, 0.65, 0.95]); M.save().move(0, 0.9, 0); M.lathe('plastic', [[0.04, 0], [0.04, 0.05], [0.135, 0.1], [0.135, 0.34], [0.09, 0.4], [0, 0.4]], 12); M.restore();
  M.col(-0.17, 0.17, 0, 0.9, -0.17, 0.17, 'metal', false, false);
});
PF.opWasteBin = () => prefab('opWasteBin', (M) => {
  M.local(1); M.color(opOlH(1.36)); M.boxB('opPaint', -0.19, 0.19, 0, 0.72, -0.19, 0.19, { bevel: 0.02 });
  M.color(opOlH(1.46)); M.boxB('opPaint', -0.21, 0.21, 0.72, 0.8, -0.21, 0.21, { bevel: 0.02 });
  // recycling mark on the front: three arrows chasing each other around a triangle
  M.cls = 2; M.color([0.88, 0.88, 0.84]);
  for (let k = 0; k < 3; k++) { M.save().move(0, 0.43, 0.19).rotZ((k / 3) * TAU); M.boxB('opEnamel', -0.05, 0.03, 0.036, 0.054, 0, 0.004); M.save().move(-0.05, 0.045, 0).rotZ(Math.PI / 4); M.boxB('opEnamel', -0.02, 0.02, -0.02, 0.02, 0, 0.004); M.restore(); M.restore(); }
  M.cls = 0; M.col(-0.21, 0.21, 0, 0.8, -0.21, 0.21, 'metal', false, false);
});
/* Water heater of the utility annex (0.5 m across, 1.5 m): white enamel tank on three feet, two pipes up the wall, a small control box */
PF.opHeater = () => prefab('opHeater', (M) => {
  M.local(1); M.color([0.7, 0.7, 0.67]);
  M.save().move(0, 0.12, 0); M.lathe('opCase', [[0, 0], [0.2, 0], [0.25, 0.06], [0.25, 1.3], [0.2, 1.38], [0, 1.38]], 14, { uR: 0.25 });
  M.color([0.45, 0.46, 0.46]); for (const y of [0.3, 1.05]) M.lathe('opInox', [[0.251, y], [0.256, y], [0.256, y + 0.03], [0.251, y + 0.03]], 14, { uR: 0.25 });
  M.restore();
  M.cls = 1; M.color([0.3, 0.3, 0.3]); for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU; M.save().move(Math.cos(a) * 0.17, 0, Math.sin(a) * 0.17); M.cyl('opInox', 0.02, 0.13, 6); M.restore(); }
  M.color([0.62, 0.42, 0.26]); for (const x of [-0.1, 0.1]) M.tube('opInox', 0.014, [[x, 1.48, 0], [x, 1.7, 0], [x, 1.75, -0.2], [x, 2.6, -0.2]], 5);
  M.color([0.2, 0.2, 0.2]); M.boxB('plastic', -0.07, 0.07, 0.4, 0.56, 0.24, 0.27); M.color([0.85, 0.8, 0.6]); M.boxB('opEnamel', -0.09, 0.09, 0.75, 0.9, 0.245, 0.252);
});
/* Potted plant (0.75 m): grey pot, long green leaves */
PF.opPlant = () => prefab('opPlant', (M) => {
  const R = rngOf(311); M.local(1); M.cls = 1; M.color([0.5, 0.48, 0.44]);
  M.lathe('opEnamel', [[0, 0], [0.1, 0], [0.14, 0.24], [0.13, 0.25], [0.11, 0.22], [0, 0.22]], 10, { uR: 0.14 });
  M.color([0.16, 0.12, 0.08]); M.save().move(0, 0.2, 0); M.cyl('opEnamel', 0.115, 0.01, 10, { caps: 't' }); M.restore();
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * TAU + R() * 0.4, tl = 0.25 + R() * 0.5, l = 0.3 + R() * 0.25, g = 0.3 + R() * 0.16;
    M.color([0.13 + R() * 0.05, g * 0.72, 0.105 + R() * 0.04]);
    M.save().move(0, 0.2, 0).rotY(a).rotX(tl); M.boxB('opEnamel', -0.03, 0.03, 0, l * 0.6, -0.003, 0.003);
    M.save().move(0, l * 0.6, 0).rotX(0.35); M.boxB('opEnamel', -0.024, 0.024, 0, l * 0.4, -0.003, 0.003); M.restore(); M.restore();
  }
});
/* Stand of rolled maps (0.4 x 0.4, 0.8 m): open wooden box, five rolls standing in it */
PF.opMapStand = () => prefab('opMapStand', (M) => {
  M.local(1); M.color(OPC.woodUp);
  for (const [x0, x1, z0, z1] of [[-0.2, 0.2, -0.2, -0.18], [-0.2, 0.2, 0.18, 0.2], [-0.2, -0.18, -0.18, 0.18], [0.18, 0.2, -0.18, 0.18]]) M.boxB('opWood', x0, x1, 0.04, 0.8, z0, z1);
  M.boxB('opWood', -0.2, 0.2, 0.04, 0.06, -0.2, 0.2); M.color(OPC.steelDk); for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.boxB('opInox', sx * 0.17 - 0.02, sx * 0.17 + 0.02, 0, 0.04, sz * 0.17 - 0.02, sz * 0.17 + 0.02);
  M.cls = 1;
  for (const [x, z, h, rx, rz, c] of [[-0.09, -0.08, 1.0, 0.06, 0.05, 0.9], [0.07, -0.09, 1.08, -0.05, 0.07, 0.86], [0.0, 0.03, 0.95, 0.04, -0.06, 0.92], [-0.1, 0.1, 1.05, 0.08, -0.03, 0.84], [0.1, 0.09, 0.98, -0.07, -0.05, 0.88]]) {
    M.color([c, c * 0.97, c * 0.88]); M.save().move(x, 0.06, z).rotX(rx).rotZ(rz); M.cyl('canvas', 0.04, h, 8, { caps: 't' }); M.restore();
  }
  M.cls = 0; M.col(-0.2, 0.2, 0, 0.8, -0.2, 0.2, 'wood', false, false);
});
/* 20 Wall fan (wall-mounted, back at z = 0): bracket, motor, blades in a wire cage */
PF.opFan = () => prefab('opFan', (M) => {
  M.local(1); M.cls = 1; M.color([0.2, 0.2, 0.2]);
  M.boxB('opInox', -0.06, 0.06, -0.1, 0.1, 0, 0.03); M.boxB('opInox', -0.02, 0.02, -0.02, 0.02, 0.03, 0.18);
  M.save().move(0, 0, 0.2).rotX(Math.PI / 2 - 0.35);
  // motor housing, hub, four blades; the guard: two rims, rings on the front, sixteen spokes
  M.color([0.24, 0.25, 0.26]); M.cyl('opEnamel', 0.08, 0.17, 10);
  M.color([0.1, 0.1, 0.1]); M.save().move(0, 0.17, 0); M.cyl('plastic', 0.05, 0.06, 8); M.restore();
  M.color([0.5, 0.52, 0.54]); for (let k = 0; k < 4; k++) { M.save().move(0, 0.2, 0).rotY((k / 4) * TAU).rotX(0.35); M.boxB('opEnamel', -0.06, 0.06, -0.003, 0.003, 0.04, 0.26); M.restore(); }
  M.color([0.16, 0.16, 0.17]);
  const ring = (r, y, t) => M.tube('opInox', t, Array.from({ length: 17 }, (_, i) => { const a = (i / 16) * TAU; return [Math.cos(a) * r, y, Math.sin(a) * r]; }), 4);
  ring(0.3, 0.12, 0.006); ring(0.3, 0.27, 0.006); ring(0.2, 0.285, 0.004); ring(0.1, 0.295, 0.004);
  for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU, c = Math.cos(a), sn = Math.sin(a); M.tube('opInox', 0.003, [[c * 0.3, 0.12, sn * 0.3], [c * 0.3, 0.27, sn * 0.3], [c * 0.04, 0.3, sn * 0.04]], 3); }
  M.color([0.3, 0.3, 0.3]); M.save().move(0, 0.295, 0); M.cyl('plastic', 0.045, 0.012, 8); M.restore();
  M.restore();
});
/* 22 Floor drain (0.5 x 0.5): steel grate on a dark sump, flush with the floor */
PF.opDrain = () => prefab('opDrain', (M) => {
  M.local(1); M.cls = 1; M.color([0.06, 0.06, 0.06]); M.boxB('dark', -0.24, 0.24, 0.014, 0.016, -0.24, 0.24);
  M.color([0.4, 0.41, 0.41]); M.boxB('opSteel', -0.25, 0.25, 0.016, 0.022, -0.25, -0.22); M.boxB('opSteel', -0.25, 0.25, 0.016, 0.022, 0.22, 0.25);
  for (let k = 0; k < 8; k++) { const x = -0.21 + k * 0.06; M.boxB('opSteel', x - 0.008, x + 0.008, 0.016, 0.022, -0.22, 0.22); }
});

/* ---------- Exterior and roof equipment ---------- */
/* Rooftop AC unit (w x d, h; the main one 1.9 x 1.3, 0.95 m): grey-beige casing, horizontal louvers on the long sides, fan grille on top,
   base rails */
PF.opAcBig = (w = 1.9, d = 1.3, h = 0.95) => prefab('opAcBig' + w + d + h, (M) => {
  const hw = w / 2, hd = d / 2, n = Math.max(4, Math.round((h - 0.25) / 0.055)), fr = Math.min(hd, hw) * 0.62;
  M.local(1); M.color([0.5, 0.5, 0.48]); for (const x of [-hw + 0.15, hw - 0.15]) M.boxB('opSteel', x - 0.05, x + 0.05, 0, 0.08, -hd, hd);
  M.color(OPC.acCase); M.boxB('opCase', -hw, hw, 0.08, 0.08 + h, -hd, hd, { bevel: 0.015 });
  M.cls = 1;
  for (const s of [-1, 1]) {
    M.color([0.2, 0.2, 0.2]); M.boxB('dark', -hw + 0.07, hw - 0.07, 0.18, h - 0.02, s * hd - 0.002, s * hd + s * 0.006);
    M.color(OPC.acCase); for (let k = 0; k < n; k++) { M.save().move(0, 0.21 + k * 0.055, s * (hd + 0.008)).rotX(s * 0.6); M.boxB('opCase', -hw + 0.07, hw - 0.07, -0.003, 0.003, -0.025, 0.025); M.restore(); }
    M.boxB('opCase', -0.02, 0.02, 0.18, h - 0.02, s * hd, s * (hd + 0.03));
  }
  M.color([0.12, 0.12, 0.12]); M.save().move(hw * 0.3, 0.08 + h, 0); M.cyl('dark', fr, 0.005, 14); M.restore();
  M.color([0.4, 0.4, 0.4]); for (let k = -3; k <= 3; k++) M.boxB('opSteel', hw * 0.3 - fr, hw * 0.3 + fr, 0.085 + h, 0.095 + h, k * fr * 0.28 - 0.006, k * fr * 0.28 + 0.006);
});
/* Telecom mast (about 3.4 m with its antennas): three-legged lattice, three sector panel antennas, a small dish, cable ladder */
PF.opMast = () => prefab('opMast', (M) => {
  M.local(1); M.cls = 1; M.color([0.5, 0.51, 0.5]);
  const T = 2.8, leg = (k, y) => { const a = (k / 3) * TAU, r = lerp(0.32, 0.16, y / T); return [Math.cos(a) * r, y, Math.sin(a) * r]; };
  for (let k = 0; k < 3; k++) M.tube('opSteel', 0.025, [leg(k, 0), leg(k, T)], 5);
  for (let y = 0.4; y < T - 0.1; y += 0.48) for (let k = 0; k < 3; k++) { M.tube('opSteel', 0.008, [leg(k, y), leg((k + 1) % 3, y)], 3); M.tube('opSteel', 0.008, [leg(k, y), leg((k + 1) % 3, y + 0.48)], 3); }
  M.cls = 0; M.color([0.45, 0.46, 0.46]); M.boxB('opSteel', -0.4, 0.4, 0, 0.08, -0.4, 0.4);
  M.save().move(0, T - 0.2, 0); M.cyl('opSteel', 0.04, 0.8, 6); M.restore();
  M.color([0.9, 0.9, 0.88]);
  for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU + 0.5; M.save().move(Math.cos(a) * 0.22, T - 0.25, Math.sin(a) * 0.22).rotY(-a + Math.PI / 2); M.boxB('opEnamel', -0.09, 0.09, 0, 0.75, -0.04, 0.04, { bevel: 0.015 }); M.restore(); }
  M.save().move(0.25, T - 0.95, 0).rotY(-0.6); M.lathe('opEnamel', [[0, 0], [0.18, 0.04], [0.25, 0.1]], 10, { a0: 0 }); M.restore();
  M.color([0.12, 0.12, 0.12]); M.tube('rubber', 0.02, [[0.05, T - 0.2, 0.05], [0.1, 1.4, 0.12], [0.12, 0.1, 0.15]], 5);
});
/* Roof hatch box (1.0 x 1.0, 0.55 m): concrete upstand, olive steel lid, hinges, latch */
PF.opHatch = () => prefab('opHatch', (M) => {
  M.local(1); M.color([0.85, 0.83, 0.78]); M.boxB('opPanel', -0.5, 0.5, 0, 0.5, -0.5, 0.5);
  M.color(OPC.olive); M.boxB('opPaint', -0.55, 0.55, 0.5, 0.56, -0.55, 0.55, { bevel: 0.01 });
  M.cls = 2; M.color(OPC.steelDk); for (const x of [-0.3, 0.3]) M.boxB('opSteel', x - 0.05, x + 0.05, 0.47, 0.57, -0.57, -0.53); M.boxB('opSteel', -0.06, 0.06, 0.4, 0.55, 0.55, 0.58);
});
/* Bulkhead wall lamp over a door (wall-mounted): dark housing, lit lens below */
PF.opWallLamp = () => prefab('opWallLamp', (M) => {
  M.local(1); M.cls = 1; M.color([0.18, 0.19, 0.18]);
  M.boxB('opSteel', -0.22, 0.22, -0.06, 0.08, 0, 0.18, { bevel: 0.01 }); M.boxB('opSteel', -0.26, 0.26, 0.08, 0.1, 0, 0.22);
  M.color([1, 1, 1]); M.boxB('opLamp', -0.19, 0.19, -0.075, -0.055, 0.02, 0.16); M.boxB('opLamp', -0.19, 0.19, -0.045, 0.035, 0.18, 0.186); // (lens below and in front)
});
/* Exterior electrical cabinet (0.55 x 0.75, wall-mounted, bottom at y = 0): gray steel, warning pictogram, conduits down into the ground */
PF.opElecBox = (down = 1.0) => prefab('opElecBox' + down, (M) => {
  M.local(1); M.color([0.66, 0.67, 0.66]); M.boxB('opEnamel', -0.27, 0.27, 0, 0.75, 0, 0.22, { bevel: 0.01 });
  M.color([0.55, 0.56, 0.55]); M.boxB('opEnamel', -0.3, 0.3, 0.75, 0.79, 0, 0.26);
  M.cls = 1; M.color([1, 1, 1]); opAtlas(M, 'opSigns', OPS.volt, -0.08, 0.08, 0.45, 0.61, 0.222);
  M.color([0.15, 0.15, 0.15]); M.boxB('opSteel', 0.18, 0.21, 0.3, 0.42, 0.22, 0.245);
  M.color([0.6, 0.61, 0.6]); for (const x of [-0.15, -0.03, 0.09]) M.tube('opSteel', 0.025, [[x, 0.0, 0.08], [x, -down * 0.5, 0.08], [x, -down - 0.05, 0.08]], 6);
});
