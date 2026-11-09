/* ==========================================================================
   CYCLADIC KIT (1/4): surfaces, materials and drawn atlases of Notos, the Greek island.
   - Procedural surfaces: schist slabs with lime joints (the alleys and the squares), brushed lime
     (walls, flat roofs, steps), dry stone of the low walls;
   - Drawn atlases: signs painted in Greek (cafe, taverna, bakery...), decals (boat names,
     menu boards, posters, drips), Mediterranean flora in cutout cards (olive, cypress, tamarisk,
     fig, plane tree, agave, prickly pear, geranium, bougainvillea, jasmine, grapevine, oleander, lemon tree).
   The other files of the kit: 02yc (buildings: whitewashed houses, church, chapel, mill, stairs), 02yd (scenery:
   trees, plants, boats, nets, furniture), 02ye (the map plan, MAP_DEFS.notos).
   Everything is built when the map loads and released with it (optional surfaces, see OPT_TEX).
   ========================================================================== */
Object.assign(TEXLAB, {
  /* irregular gray-beige schist slabs, with joints painted in lime (in places: the lime flakes off) */
  slabs: [1024, 301, 2.0, `
    vec4 v = vor(uv, vec2(5.0), 3.0, 0.8);
    float big = gfbm(uv, vec2(3.0), 5, 1.0), mid = gfbm(uv, vec2(16.0), 4, 2.0), gr = vn(uv * 256.0, vec2(256.0), 3.0);
    float joint = 1.0 - smoothstep(0.012, 0.045, v.w), edge = 1.0 - smoothstep(0.045, 0.12, v.w);
    float lime = joint * smoothstep(0.22, 0.5, gfbm(uv, vec2(7.0), 3, 5.0) + 0.3);
    h = (1.0 - joint) * 0.6 + mid * 0.14 + gr * 0.04 - edge * 0.1 + v.z * 0.14;
    vec3 tone = mix(srgb(vec3(0.5, 0.48, 0.45)), srgb(vec3(0.7, 0.67, 0.6)), v.z);
    a = tone * (0.86 + big * 0.2 + mid * 0.1 + gr * 0.08);
    a = mix(a, srgb(vec3(0.94, 0.93, 0.9)), lime * 0.92);
    a = mix(a, a * 0.78, joint * (1.0 - lime));
    r = 0.88 - lime * 0.08 + gr * 0.05; x = h;`],
  /* brushed lime: thicker brush strokes, microcracks, dust veil; tint by vertices */
  limewash: [512, 303, 1.2, `
    float big = gfbm(uv, vec2(3.0), 4, 1.0), mid = gfbm(uv, vec2(10.0), 4, 2.0), fine = vn(uv * 256.0, vec2(256.0), 3.0);
    float br = gfbm(vec2(uv.x * 0.6 + uv.y * 0.25, uv.y * 0.9 - uv.x * 0.2), vec2(9.0, 5.0), 3, 5.0);
    float thick = smoothstep(0.45, 0.7, br);
    float crack = (1.0 - smoothstep(0.0, 0.02, vor(uv, vec2(5.0), 7.0, 1.0).w)) * smoothstep(0.55, 0.75, gfbm(uv, vec2(3.0), 3, 9.0));
    h = thick * 0.35 + mid * 0.25 + fine * 0.1 - crack * 0.14;
    a = srgb(vec3(0.97, 0.96, 0.93)) * (0.93 + big * 0.07 + thick * 0.04 + fine * 0.02);
    a = mix(a, srgb(vec3(0.66, 0.64, 0.6)), crack * 0.4);
    r = 0.9 - thick * 0.1; x = h;`],
  /* dry stone: flat rubble stones of varied tints, dark recessed joints, lichens (tinted by vertices) */
  drystone: [512, 305, 2.6, `
    vec4 t = tiles(uv, vec2(5.0, 9.0), 0.37);
    float big = gfbm(uv, vec2(3.0), 5, 1.0), mid = gfbm(uv, vec2(14.0), 4, 2.0), gr = vn(uv * 256.0, vec2(256.0), 3.0);
    float joint = 1.0 - smoothstep(0.02, 0.09, t.w);
    float lich = smoothstep(0.62, 0.78, gfbm(uv, vec2(8.0), 4, 7.0));
    h = (1.0 - joint) * 0.7 + t.z * 0.2 + mid * 0.15 + gr * 0.06;
    vec3 tone = mix(srgb(vec3(0.5, 0.46, 0.4)), srgb(vec3(0.78, 0.74, 0.66)), t.z);
    a = tone * (0.8 + big * 0.22 + mid * 0.1 + gr * 0.06);
    a = mix(a, srgb(vec3(0.14, 0.12, 0.1)), joint * 0.78);
    a = mix(a, srgb(vec3(0.62, 0.66, 0.46)), lich * 0.35);
    r = 0.93 - joint * 0.05; x = h;`],
});
Object.assign(TEXSCALE, { slabs: 3.2, limewash: 2.4, drystone: 2.0 });
for (const k of ['slabs', 'limewash', 'drystone']) OPT_TEX.add(k);
/* Surfaces a Cycladic map asks for (to put in surfaces of its definition): sea ripples, our three surfaces, planks (jetty, boats), rock (riprap) */
const NOTOS_SURFACES = ['ripple', 'slabs', 'limewash', 'drystone', 'boards', 'rock', 'rust', 'hull', 'net'];

/* ---------- Materials ---------- */
function makeNotosMaterials(M) {
  M('limewash', { tex: 'limewash', grime: 0.5, streak: 0.5, dust: 0.25, macro: 0.3 });
  M('slab', { tex: 'slabs', grime: 0.2, dust: 0.3, macro: 0.3 });
  M('drystone', { tex: 'drystone', grime: 0.4, dust: 0.4, macro: 0.3, pom: 0.04 });
  M('rock', { tex: 'rock', grime: 0.4, macro: 0.5, dust: 0.1, pom: 0.03 });
  M('boards', { tex: 'boards', grime: 0.7, streak: 0.4, macro: 0.25 });
  // fittings, hull and nets of the caiques (port surfaces, declared in `surfaces` of the map)
  M('rust', { tex: 'rust', metal: 0.75, ma: true, env: 0.55, macro: 0.25, grime: 0.6, streak: 0.4 });
  M('hull', { tex: 'hull', metal: 0.25, ma: true, env: 0.8, macro: 0.2, grime: 0.6, streak: 0.5 });
  M('net', { tex: 'net', cut: 0.5, rough: 0.8, env: 0.3, macro: 0.2 });
  // fittings, hull and nets of the caiques (port surfaces, declared in `surfaces` of the map)
  M('rust', { tex: 'rust', metal: 0.75, ma: true, env: 0.55, macro: 0.25, grime: 0.6, streak: 0.4 });
  M('hull', { tex: 'hull', metal: 0.25, ma: true, env: 0.8, macro: 0.2, grime: 0.6, streak: 0.5 });
  M('net', { tex: 'net', cut: 0.5, rough: 0.8, env: 0.3, macro: 0.2 });
  // wet stone at the foot of the quays: dark, almost smooth
  M('wetstone', { tex: 'ashlar', rough: 0.45, env: 0.9, macro: 0.4, grime: 0, dust: 0 });
  M('glassLit', { tex: 'glass', metal: 0.4, ma: true, env: 0.9, macro: 0.1, emissive: [0.95, 0.58, 0.28], polyOff: -2 });
  // foliage: cutout cards from the map's atlas (like the foliage material, with its own atlas)
  M('cyfol', { tex: 'cyfol', cut: 0.42, rough: 0.8, env: 0.35, macro: 0.25, scale: 1, noNormal: true }); makeWind(MAT.cyfol, WIND_AMP.cyfol, { leaf: true, cards: true }); // foliage in the wind (02md-wind.js)
  M('signs4', { tex: 'signs4', rough: 0.45, env: 0.6, macro: 0.05, scale: 1, noNormal: true });
  M('decals4', { tex: 'decals4', rough: 0.75, env: 0.35, macro: 0.15, scale: 1, noNormal: true, polyOff: -4 });
  Object.assign(MAT.decals4, { transparent: true, depthWrite: false }); MAT.decals4.defines.WM_CUT = ''; MAT.decals4.side = THREE.FrontSide;
  MAT.decals4.userData.noShadow = true;
  // cloth of a flag, a sail or an awning: double-sided fabric
  M('cloth', { tex: 'canvas', macro: 0.2, dust: 0.2, side: THREE.DoubleSide }); makeCloth(MAT.cloth); // the laundry sways in the wind (02mc-cloths.js)
  // the Greek flag: its own texture (cyFlagTex), double-sided like a cloth; same samplers as the signs
  M('cyflag', { tex: 'cyflag', rough: 0.85, env: 0.3, macro: 0.1, scale: 1, noNormal: true, side: THREE.DoubleSide }); makeCloth(MAT.cyflag); // the flag flutters (02mc-cloths.js)
}
/* Atlas of the map (called by buildTextures) */
function notosKit() { TEX.signs4 = cySignAtlas(); TEX.decals4 = cyDecalAtlas(); TEX.cyfol = cyFloraAtlas(); TEX.cyflag = cyFlagTex(); }

/* ---------- The Greek flag (512², laid on a 3 x 2 cloth): nine equal stripes, blue at the top and bottom, a blue square of five stripes
   at the hoist (pole side, u = 0) and its white cross one stripe wide; official blue #0D5EAF ---------- */
function cyFlagTex() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), b = S / 9, cw = (S * 5) / 9 / 1.5; // one stripe; width of the square (5 stripes on a cloth 1.5 times wider than tall)
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
  g.fillStyle = '#0d5eaf';
  for (let i = 0; i < 9; i += 2) g.fillRect(0, i * b, S, b);
  g.fillRect(0, 0, cw, 5 * b);
  g.fillStyle = '#ffffff'; g.fillRect((cw * 2) / 5, 0, cw / 5, 5 * b); g.fillRect(0, 2 * b, cw, b);
  // a bit of cloth grain and sun wear
  const R = rngOf(613);
  for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '20,30,50'},${R() * 0.05})`; g.fillRect(R() * S, R() * S, 1 + R() * 3, 1); }
  const t = canvasOnce(new THREE.CanvasTexture(c)); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; t.flipY = false;
  return { map: t, normal: null };
}

/* ---------- Signs (1024², 8 panels of 512 x 256), in Greek as on site ---------- */
const CYS = { cafe: 0, taverne: 1, psaro: 2, artopoieio: 3, periptero: 4, domatia: 5, naos: 6, bakaliko: 7 };
function cySignAtlas() {
  const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d'), R = rngOf(311);
  const sans = '"Liberation Sans", Arial, "DejaVu Sans", sans-serif', serif = '"Liberation Serif", Georgia, "DejaVu Serif", serif';
  // background, text, font, size, title of line 1, line 2 (optional), color of the rule
  const P = [
    ['#f4f1e8', '#1b4f9c', 'ΚΑΦΕΝΕΙΟ', 'Ο ΠΛΑΤΑΝΟΣ', serif, 84, '#1b4f9c'],
    ['#1b4f9c', '#f6f2e6', 'ΤΑΒΕΡΝΑ', 'ΜΕΛΤΕΜΙ', sans, 80, '#f6f2e6'],
    ['#f6f2e6', '#16407f', 'ΨΑΡΟΤΑΒΕΡΝΑ', 'Ο ΚΑΠΕΤΑΝ ΜΙΧΑΛΗΣ', sans, 58, '#16407f'],
    ['#e9b949', '#3a2a14', 'ΑΡΤΟΠΟΙΕΙΟ', 'ΦΡΕΣΚΟ ΨΩΜΙ', serif, 70, '#3a2a14'],
    ['#2f7f93', '#f6f2e6', 'ΠΕΡΙΠΤΕΡΟ', '', sans, 82, '#f6f2e6'],
    ['#f6f2e6', '#1b4f9c', 'ΔΩΜΑΤΙΑ', 'ROOMS TO LET', sans, 76, '#1b4f9c'],
    ['#f6f2e6', '#5a3a1e', 'ΙΕΡΟΣ ΝΑΟΣ', 'ΑΓΙΑΣ ΜΑΡΙΝΑΣ', serif, 60, '#5a3a1e'],
    ['#c9442e', '#f6f2e6', 'ΜΠΑΚΑΛΙΚΟ', 'ΠΑΝΤΟΠΩΛΕΙΟ', sans, 66, '#f6f2e6'],
  ];
  P.forEach(([bg, fg, l1, l2, font, size, border], i) => {
    const x = (i % 2) * 512, y = Math.floor(i / 2) * 256;
    g.fillStyle = bg; g.fillRect(x, y, 512, 256);
    g.strokeStyle = border; g.lineWidth = 8; g.strokeRect(x + 14, y + 14, 484, 228);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `bold ${size}px ${font}`;
    const fs1 = Math.min(size, (size * 430) / g.measureText(l1).width);
    g.font = `bold ${fs1}px ${font}`; g.fillText(l1, x + 256, y + (l2 ? 100 : 132));
    if (l2) { g.font = `bold ${size * 0.5}px ${font}`; const fs2 = Math.min(size * 0.5, (size * 0.5 * 430) / g.measureText(l2).width); g.font = `bold ${fs2}px ${font}`; g.fillText(l2, x + 256, y + 178); }
    // salt and sun: flaking paint, dust
    for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(${R() < 0.6 ? '240,236,224' : '60,48,36'},${0.2 + R() * 0.4})`; const ex = x + (R() < 0.5 ? 8 + R() * 28 : 476 + R() * 28), ey = y + (R() < 0.5 ? 8 + R() * 28 : 220 + R() * 28); g.beginPath(); g.arc(ex, ey, 2 + R() * 6, 0, TAU); g.fill(); }
    for (let k = 0; k < 700; k++) { g.fillStyle = `rgba(${R() < 0.6 ? '255,255,250' : '60,50,40'},${R() * 0.07})`; g.fillRect(x + R() * 512, y + R() * 256, 1 + R() * 4, 1 + R() * 3); }
    const gr = g.createLinearGradient(0, y, 0, y + 256); gr.addColorStop(0, 'rgba(255,255,255,0.05)'); gr.addColorStop(1, 'rgba(60,50,40,0.18)'); g.fillStyle = gr; g.fillRect(x, y, 512, 256);
  });
  const t = canvasOnce(new THREE.CanvasTexture(c)); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; t.flipY = false;
  return { map: t, normal: null };
}
function cySignUV(i) { return [(i % 2) * 0.5, Math.floor(i / 2) * 0.25, 0.5, 0.25]; }
/* Sign laid flat on a facade (facade frame, z = 0: the wall), with its painted wooden frame; z: protrusion of the sign (greater
   when it passes over a band, otherwise the frame is in the plane of its front) */
function cySignBoard(M, xc, y, w, h, idx, frame = [0.12, 0.28, 0.55], z = 0.07) {
  const [u0, v0, du, dv] = cySignUV(idx), B = M.buf('signs4', xc, y, 0.05);
  M.save().color([1, 1, 1]);
  const a = M.v(B, xc - w / 2, y, z, 0, 0, 1, u0, v0 + dv), b = M.v(B, xc + w / 2, y, z, 0, 0, 1, u0 + du, v0 + dv);
  const c = M.v(B, xc + w / 2, y + h, z, 0, 0, 1, u0 + du, v0), d = M.v(B, xc - w / 2, y + h, z, 0, 0, 1, u0, v0);
  M.quadI(B, a, b, c, d);
  if (frame) { M.color(frame).local(1); lbox(M, 'paintwood', xc - w / 2 - 0.03, xc + w / 2 + 0.03, y - 0.03, y + h + 0.03, 0, z - 0.002); }
  M.restore();
}

/* ---------- Decals (1024², 4 x 4 grid, alpha): 0 to 3 boat names, 4 menu board, 5 festival poster, 6 boat
   timetable, 7 "for sale", 8 gray drips, 9 rust drip, 10 painted evil eye, 11 lime line at the foot of a wall,
   12 soft-serve ice cream, 13 house numbers, 14 cat paw print, 15 painted cross ---------- */
const CYD = { boat0: 0, boat1: 1, boat2: 2, boat3: 3, menu: 4, fete: 5, horaires: 6, vendre: 7, drip: 8, rust: 9, mati: 10, lime: 11, glace: 12, numero: 13, paws: 14, croix: 15 };
const CY_BOATS = [['ΜΕΛΙΝΑ', 'ΠΕΙ 4471'], ['ΑΓΙΟΣ ΝΙΚΟΛΑΟΣ', 'ΣΥΡ 218'], ['ΕΛΠΙΣ', 'ΠΕΙ 3092'], ['ΘΑΛΑΣΣΑ', 'ΝΑΞ 76']];
function cyDecalAtlas() {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), R = rngOf(317), T = S / 4;
  const sans = '"Liberation Sans", Arial, "DejaVu Sans", sans-serif', serif = '"Liberation Serif", Georgia, "DejaVu Serif", serif';
  const cell = (i, fn) => { g.save(); g.translate((i % 4) * T, Math.floor(i / 4) * T); g.beginPath(); g.rect(0, 0, T, T); g.clip(); fn(); g.restore(); };
  const wear = (n, a) => { g.globalCompositeOperation = 'destination-out'; for (let j = 0; j < n; j++) { g.fillStyle = `rgba(0,0,0,${R() * a})`; g.fillRect(R() * T, R() * T, 2 + R() * 4, 1 + R() * 3); } g.globalCompositeOperation = 'source-over'; };
  CY_BOATS.forEach(([name, reg], k) => cell(k, () => {
    g.fillStyle = 'rgba(244,242,232,0.96)'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `bold ${name.length > 8 ? 30 : 40}px ${sans}`; g.fillText(name, T / 2, 30, T - 16);
    g.font = `bold 26px ${sans}`; g.fillText(reg, T / 2, 62, T - 16);
    wear(140, 0.6);
  }));
  cell(4, () => { // chalk menu board
    g.fillStyle = '#20231f'; g.fillRect(16, 12, T - 32, T - 24); g.strokeStyle = '#7a5a36'; g.lineWidth = 10; g.strokeRect(16, 12, T - 32, T - 24);
    g.fillStyle = 'rgba(244,244,236,0.92)'; g.font = `bold 24px ${sans}`; g.textAlign = 'center'; g.fillText('ΜΕΝΟΥ', T / 2, 46);
    g.font = `italic 20px ${serif}`; g.textAlign = 'left';
    [['ΧΤΑΠΟΔΙ ΣΧΑΡΑΣ', '14'], ['ΓΑΥΡΟΣ ΤΗΓΑΝΗΤΟΣ', '9'], ['ΣΑΛΑΤΑ ΧΩΡΙΑΤΙΚΗ', '8'], ['ΤΖΑΤΖΙΚΙ', '5'], ['ΜΟΥΣΑΚΑΣ', '10']].forEach(([n, p], j) => { g.textAlign = 'left'; g.fillText(n, 34, 84 + j * 30); g.textAlign = 'right'; g.fillText(p + ' €', T - 34, 84 + j * 30); });
    wear(200, 0.4);
  });
  cell(5, () => { // panigiri poster
    const x = 40, y = 18, w = T - 80, h = T - 36;
    g.fillStyle = '#1b4f9c'; g.fillRect(x, y, w, h);
    g.fillStyle = '#f6f2e6'; g.textAlign = 'center'; g.font = `bold 34px ${sans}`; g.fillText('ΠΑΝΗΓΥΡΙ', x + w / 2, y + 52);
    g.font = `bold 22px ${sans}`; g.fillText('17 ΙΟΥΛΙΟΥ', x + w / 2, y + 86); g.font = `italic 15px ${serif}`; g.fillText('Μουσική · Χορός · Φαγητό', x + w / 2, y + h - 22);
    g.fillStyle = '#f6f2e6'; g.beginPath(); g.arc(x + w / 2, y + 150, 38, 0, TAU); g.fill(); g.fillStyle = '#e9b949'; g.beginPath(); g.arc(x + w / 2, y + 150, 24, 0, TAU); g.fill();
    wear(120, 0.7);
  });
  cell(6, () => { // boat timetable
    g.fillStyle = '#f2efe6'; g.fillRect(16, 16, T - 32, T - 32); g.strokeStyle = '#16407f'; g.lineWidth = 5; g.strokeRect(18, 18, T - 36, T - 36);
    g.fillStyle = '#16407f'; g.font = `bold 20px ${sans}`; g.textAlign = 'center'; g.fillText('ΔΡΟΜΟΛΟΓΙΑ ΠΛΟΙΩΝ', T / 2, 46);
    g.font = `16px ${sans}`; g.textAlign = 'left';
    [['ΠΕΙΡΑΙΑΣ', '07:30'], ['ΣΥΡΟΣ', '10:15'], ['ΠΑΡΟΣ', '13:40'], ['ΠΕΙΡΑΙΑΣ', '17:55']].forEach(([p, h], j) => { g.fillText(p, 34, 88 + j * 34); g.fillText(h, 170, 88 + j * 34); });
    g.fillStyle = '#b3261e'; g.font = `bold 14px ${sans}`; g.fillText('ΜΕΤΑ ΤΟΥΣ ΑΝΕΜΟΥΣ', 34, 232);
  });
  cell(7, () => { g.fillStyle = '#f6f2e6'; g.fillRect(40, 70, T - 80, T - 140); g.strokeStyle = '#b3261e'; g.lineWidth = 8; g.strokeRect(44, 74, T - 88, T - 148); g.fillStyle = '#b3261e'; g.font = `bold 30px ${sans}`; g.textAlign = 'center'; g.fillText('ΠΩΛΕΙΤΑΙ', T / 2, 116); g.font = `bold 16px ${sans}`; g.fillStyle = '#1a1a1a'; g.fillText('ΤΗΛ. 22850 71234', T / 2, 150); wear(80, 0.5); });
  cell(8, () => { for (let j = 0; j < 14; j++) { const x = T * 0.12 + R() * T * 0.76, w = 4 + R() * 12, gr = g.createLinearGradient(0, 0, 0, T * (0.3 + R() * 0.7)); gr.addColorStop(0, 'rgba(120,112,100,0.5)'); gr.addColorStop(1, 'rgba(120,112,100,0)'); g.fillStyle = gr; g.fillRect(x, 0, w, T); } });
  cell(9, () => { const gr = g.createLinearGradient(0, 0, 0, T); gr.addColorStop(0, 'rgba(120,56,28,0.6)'); gr.addColorStop(1, 'rgba(120,56,28,0)'); g.fillStyle = gr; for (let j = 0; j < 10; j++) { const x = T * 0.15 + R() * T * 0.7, w = 3 + R() * 9; g.fillRect(x, 0, w, T * (0.25 + R() * 0.75)); } });
  cell(10, () => { // evil eye
    const cx = T / 2, cy = T / 2;
    for (const [r, col] of [[84, '#1b4f9c'], [64, '#f6f2e6'], [44, '#2f86d6'], [24, '#0d1b3a']]) { g.fillStyle = col; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill(); }
    wear(100, 0.5);
  });
  cell(11, () => { const gr = g.createLinearGradient(0, T, 0, 0); gr.addColorStop(0, 'rgba(250,248,242,0.95)'); gr.addColorStop(0.5, 'rgba(250,248,242,0.9)'); gr.addColorStop(1, 'rgba(250,248,242,0)'); g.fillStyle = gr; g.fillRect(0, 0, T, T); wear(160, 0.5); });
  cell(12, () => { g.fillStyle = '#f6f2e6'; g.fillRect(30, 40, T - 60, T - 80); g.strokeStyle = '#2f7f93'; g.lineWidth = 6; g.strokeRect(34, 44, T - 68, T - 88); g.fillStyle = '#e9669e'; g.beginPath(); g.arc(T / 2, 112, 34, Math.PI, TAU); g.fill(); g.fillStyle = '#e9b949'; g.beginPath(); g.moveTo(T / 2 - 28, 116); g.lineTo(T / 2 + 28, 116); g.lineTo(T / 2, 188); g.closePath(); g.fill(); g.fillStyle = '#2f7f93'; g.font = `bold 20px ${sans}`; g.textAlign = 'center'; g.fillText('ΠΑΓΩΤΟ', T / 2, 218); });
  cell(13, () => { g.fillStyle = '#1b4f9c'; g.fillRect(70, 78, T - 140, T - 156); g.fillStyle = '#f6f2e6'; g.font = `bold 60px ${sans}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('14', T / 2, T / 2 + 2); wear(60, 0.5); });
  cell(14, () => { g.fillStyle = 'rgba(70,64,56,0.55)'; for (let j = 0; j < 7; j++) { const x = 36 + j * 28, y = 60 + (j % 2) * 46 + R() * 8; g.beginPath(); g.ellipse(x, y, 8, 6, 0, 0, TAU); g.fill(); for (let q = -1; q <= 1; q++) { g.beginPath(); g.ellipse(x + q * 8, y - 11, 3, 3.6, 0, 0, TAU); g.fill(); } } });
  cell(15, () => { g.strokeStyle = 'rgba(30,70,150,0.9)'; g.lineWidth = 14; g.lineCap = 'round'; g.beginPath(); g.moveTo(T / 2, 40); g.lineTo(T / 2, T - 40); g.moveTo(T / 2 - 52, 100); g.lineTo(T / 2 + 52, 100); g.stroke(); wear(80, 0.5); });
  const t = canvasOnce(new THREE.CanvasTexture(c)); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; t.flipY = false;
  return { map: t, normal: null };
}
/* Decal of the map on a wall (facade frame) and on the ground */
function cyWallDecal(M, i, xc, y, w, h, z = 0.008, sub) { decal3Quad(M, i, [xc - w / 2, y, z], [xc + w / 2, y, z], [xc + w / 2, y + h, z], [xc - w / 2, y + h, z], [0, 0, 1], sub, 'decals4'); }
function cyGroundDecal(i, x, z, w, d, rot = 0, y = 0.014) {
  const c = Math.cos(rot), s = Math.sin(rot), P = (a, b) => [x + a * c - b * s, y, z + a * s + b * c];
  decal3Quad(DECOR, i, P(-w / 2, d / 2), P(w / 2, d / 2), P(w / 2, -d / 2), P(-w / 2, -d / 2), [0, 1, 0], [0, 0, 1, 1], 'decals4');
}

/* ---------- Mediterranean flora (1024², 4 x 4 grid of 256 px, alpha) ----------
   0 olive (silvery leaves), 1 cypress (dense dark green), 2 fig and plane tree (large lobed leaves), 3 tamarisk (blue-green plumes),
   4 agave (rosette of blades), 5 prickly pear (pads and yellow flowers), 6 geranium (red), 7 magenta bougainvillea, 8 jasmine (white flowers),
   9 golden dry grasses, 10 ivy, 11 rosemary and lavender, 12 reeds (kalami), 13 grapevine, 14 oleander, 15 lemon tree (lemons) */
const CYF = Object.fromEntries(['olive', 'cypress', 'fig', 'tamarisk', 'agave', 'opuntia', 'geranium', 'bougain', 'jasmine', 'grass', 'ivy', 'rosemary', 'reed', 'vine', 'oleander', 'lemon'].map((k, i) => [k, [(i % 4) * 0.25, Math.floor(i / 4) * 0.25, 0.25, 0.25]]));
function cyFloraAtlas() {
  const S = 1024, T = S / 4, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), R = rngOf(331);
  const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
  const cell = (i, fn) => { g.save(); g.translate((i % 4) * T, Math.floor(i / 4) * T); g.beginPath(); g.rect(0, 0, T, T); g.clip(); fn(); g.restore(); };
  // almond-shaped leaf, from (x, y) toward angle a, length l, width w
  const leaf = (x, y, a, l, w, fill) => { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = fill; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(l * 0.5, -w, l, 0); g.quadraticCurveTo(l * 0.5, w, 0, 0); g.fill(); g.restore(); };
  const blob = (n, cx, cy, rx, ry, draw) => { for (let i = 0; i < n; i++) { const a = R() * TAU, d = Math.sqrt(R()), x = cx + Math.cos(a) * d * rx, y = cy + Math.sin(a) * d * ry; draw(x, y, d); } };
  cell(0, () => { // olive: small gray-green lanceolate leaves, silvery underside
    blob(520, T / 2, T / 2, 112, 98, (x, y, d) => leaf(x, y, R() * TAU, 15 + R() * 8, 2.6, R() < 0.5 ? hsl(86 + R() * 12, 18 + R() * 10, 30 + R() * 14 - d * 6) : hsl(90 + R() * 10, 14, 52 + R() * 12)));
    blob(40, T / 2, T / 2, 100, 90, (x, y) => { g.fillStyle = hsl(34, 20, 22, 0.8); g.fillRect(x, y, 1.6, 8); });
  });
  cell(1, () => { // cypress: dense dark green foliage
    blob(420, T / 2, T / 2, 96, 110, (x, y, d) => leaf(x, y, -Math.PI / 2 + (R() - 0.5) * 2.2, 14 + R() * 10, 4, hsl(118 + R() * 22, 24 + R() * 14, 11 + R() * 10 + (1 - d) * 4)));
  });
  cell(2, () => { // large lobed leaves (fig, plane tree)
    const lobed = (x, y, a, s, fill) => { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = fill; g.beginPath(); for (let k = 0; k < 5; k++) { const th = -Math.PI / 2 + (k - 2) * 0.62, rr = s * (k === 2 ? 1.0 : k % 2 ? 0.62 : 0.78); g.lineTo(Math.cos(th - 0.2) * rr * 0.35, Math.sin(th - 0.2) * rr * 0.35); g.lineTo(Math.cos(th) * rr, Math.sin(th) * rr); g.lineTo(Math.cos(th + 0.2) * rr * 0.35, Math.sin(th + 0.2) * rr * 0.35); } g.closePath(); g.fill(); g.restore(); };
    blob(70, T / 2, T / 2, 96, 92, (x, y, d) => lobed(x, y, R() * TAU, 30 + R() * 14, hsl(88 + R() * 22, 38 + R() * 14, 24 + R() * 14 - d * 4)));
  });
  cell(3, () => { // tamarisk: fine drooping plumes, dense, ash green, foam of small pink flowers
    blob(260, T / 2, T * 0.42, 104, 74, (x, y, d) => leaf(x, y, Math.PI / 2 + (R() - 0.5) * 2.4, 12 + R() * 8, 2.6, hsl(104 + R() * 22, 20 + R() * 12, 22 + R() * 14 - d * 3)));
    for (let i = 0; i < 110; i++) { const x0 = T * 0.12 + R() * T * 0.76, y0 = T * (0.1 + R() * 0.4), len = 46 + R() * 70, bend = (R() - 0.5) * 50; g.strokeStyle = hsl(100 + R() * 24, 22 + R() * 12, 28 + R() * 14, 0.95); g.lineWidth = 1.4 + R() * 1.2; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + bend * 0.4, y0 + len * 0.5, x0 + bend, y0 + len); g.stroke();
      for (let k = 0; k < 16; k++) { const t = k / 16, px = x0 + bend * t * t * 1.4, py = y0 + len * t; g.strokeStyle = hsl(104 + R() * 22, 24, 34 + R() * 16, 0.9); g.lineWidth = 1.2; g.beginPath(); g.moveTo(px, py); g.lineTo(px + (R() - 0.5) * 18, py + 4 + R() * 7); g.stroke(); } }
    for (let i = 0; i < 40; i++) { g.fillStyle = hsl(332, 42, 72, 0.95); g.beginPath(); g.arc(T * 0.16 + R() * T * 0.68, T * (0.12 + R() * 0.5), 1.8 + R() * 2, 0, TAU); g.fill(); }
  });
  cell(4, () => { // agave: radiating fleshy blades, dark tips
    const cx = T / 2, cy = T * 0.96;
    for (let i = 0; i < 26; i++) { const a = -Math.PI / 2 + (i / 25 - 0.5) * 2.5 + (R() - 0.5) * 0.18, l = T * (0.52 + R() * 0.38) * (1 - Math.abs(a + Math.PI / 2) * 0.22);
      const fill = hsl(160 + R() * 20, 20 + R() * 12, 34 + R() * 14); g.save(); g.translate(cx, cy); g.rotate(a + Math.PI / 2); g.fillStyle = fill; g.beginPath(); g.moveTo(-9, 0); g.quadraticCurveTo(-13, -l * 0.55, 0, -l); g.quadraticCurveTo(13, -l * 0.55, 9, 0); g.fill();
      g.strokeStyle = hsl(160, 20, 55, 0.5); g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, -4); g.lineTo(0, -l * 0.9); g.stroke(); g.fillStyle = hsl(20, 40, 16); g.beginPath(); g.moveTo(-2.4, -l * 0.9); g.lineTo(0, -l); g.lineTo(2.4, -l * 0.9); g.fill(); g.restore(); }
  });
  cell(5, () => { // prickly pear: oval pads, spines, yellow flowers
    const pad = (x, y, a, rx, ry) => { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = hsl(98 + R() * 16, 34 + R() * 10, 30 + R() * 10); g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.fill(); g.fillStyle = hsl(50, 40, 70, 0.8); for (let k = 0; k < 14; k++) g.fillRect((R() - 0.5) * rx * 1.5, (R() - 0.5) * ry * 1.5, 1.4, 1.4); g.restore(); };
    const pads = [[T * 0.5, T * 0.85, 0, 36, 46]]; for (let i = 0; i < 9; i++) { const p = pads[Math.floor(R() * pads.length)]; pads.push([p[0] + (R() - 0.5) * 70, p[1] - 42 - R() * 14, (R() - 0.5) * 1.1, 30 + R() * 8, 40 + R() * 8]); }
    for (const p of pads) pad(...p);
    for (const p of pads.slice(4)) { g.fillStyle = hsl(46 + R() * 8, 90, 55); g.beginPath(); g.arc(p[0] + (R() - 0.5) * 26, p[1] - p[4] + 6, 8, 0, TAU); g.fill(); g.fillStyle = hsl(352, 60, 40); g.beginPath(); g.ellipse(p[0] + 20, p[1] - p[4] + 14, 5, 8, 0.4, 0, TAU); g.fill(); }
  });
  cell(6, () => { // geranium: round leaves and red umbels
    blob(70, T / 2, T * 0.6, 100, 70, (x, y) => { g.fillStyle = hsl(104 + R() * 14, 38, 24 + R() * 12); g.beginPath(); g.arc(x, y, 12 + R() * 6, 0, TAU); g.fill(); });
    for (let i = 0; i < 14; i++) { const x = T * 0.15 + R() * T * 0.7, y = T * (0.25 + R() * 0.4); g.fillStyle = hsl(R() < 0.8 ? 356 : 340, 78, 46 + R() * 8); for (let k = 0; k < 11; k++) { g.beginPath(); g.arc(x + (R() - 0.5) * 30, y + (R() - 0.5) * 22, 4.4, 0, TAU); g.fill(); } }
  });
  cell(7, () => { // magenta bougainvillea
    blob(240, T / 2, T / 2, 110, 100, (x, y) => leaf(x, y, R() * TAU, 14 + R() * 6, 6, hsl(100 + R() * 20, 38, 22 + R() * 12)));
    blob(520, T / 2, T / 2, 112, 102, (x, y) => { g.fillStyle = hsl(322 + R() * 14, 66 + R() * 20, 42 + R() * 14); g.save(); g.translate(x, y); g.rotate(R() * TAU); g.beginPath(); g.ellipse(0, 0, 7, 5, 0, 0, TAU); g.fill(); g.restore(); });
  });
  cell(8, () => { // jasmine: fine leaves, star-shaped white flowers
    blob(260, T / 2, T / 2, 108, 100, (x, y) => leaf(x, y, R() * TAU, 13 + R() * 6, 3.6, hsl(110 + R() * 18, 40, 24 + R() * 12)));
    blob(120, T / 2, T / 2, 108, 100, (x, y) => { g.fillStyle = hsl(60, 30, 95); for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(x + Math.cos(k * 1.256) * 4, y + Math.sin(k * 1.256) * 4, 3.2, 2, k * 1.256, 0, TAU); g.fill(); } });
  });
  cell(9, () => { // dry grasses
    for (let i = 0; i < 150; i++) { const x = T * 0.5 + (R() - 0.5) * T * 0.7, h = T * (0.3 + R() * 0.55), bend = (R() - 0.5) * T * 0.3; g.strokeStyle = hsl(40 + R() * 16, 36 + R() * 18, 40 + R() * 22); g.lineWidth = 1.6 + R() * 1.8; g.beginPath(); g.moveTo(x, T); g.quadraticCurveTo(x + bend * 0.3, T - h * 0.6, x + bend, T - h); g.stroke(); }
  });
  cell(10, () => { // ivy
    blob(150, T / 2, T / 2, 110, 104, (x, y, d) => { g.save(); g.translate(x, y); g.rotate(R() * TAU); g.fillStyle = hsl(112 + R() * 18, 40, 18 + R() * 12 - d * 3); g.beginPath(); g.moveTo(0, -11); g.lineTo(9, -2); g.lineTo(5, 3); g.lineTo(0, 11); g.lineTo(-5, 3); g.lineTo(-9, -2); g.closePath(); g.fill(); g.restore(); });
  });
  cell(11, () => { // rosemary and lavender: gray stems, small purple flowers
    for (let i = 0; i < 60; i++) { const x = T * 0.5 + (R() - 0.5) * T * 0.7, y = T * (0.35 + R() * 0.6), a = -Math.PI / 2 + (R() - 0.5) * 1.6, l = 50 + R() * 70; g.save(); g.translate(x, y); g.rotate(a); g.strokeStyle = hsl(92 + R() * 20, 12 + R() * 10, 42 + R() * 14); g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, 0); g.lineTo(l, 0); g.stroke();
      for (let k = 0; k < 10; k++) leaf(l * (k / 10), 0, (k % 2 ? 1 : -1) * 0.7, 10, 2, hsl(94 + R() * 12, 14 + R() * 8, 40 + R() * 14)); if (R() < 0.5) { g.fillStyle = hsl(262, 40, 62); for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(l - k * 3, (R() - 0.5) * 3, 2.6, 0, TAU); g.fill(); } } g.restore(); }
  });
  cell(12, () => { // reeds (kalami): golden canes and plumes
    for (let i = 0; i < 70; i++) { const x = T * 0.5 + (R() - 0.5) * T * 0.8, h = T * (0.55 + R() * 0.42), bend = (R() - 0.5) * 24; g.strokeStyle = hsl(44 + R() * 10, 40 + R() * 16, 52 + R() * 14); g.lineWidth = 2.4 + R() * 1.8; g.beginPath(); g.moveTo(x, T); g.quadraticCurveTo(x + bend * 0.3, T - h * 0.55, x + bend, T - h); g.stroke();
      g.fillStyle = hsl(36 + R() * 10, 30, 62, 0.9); g.beginPath(); g.ellipse(x + bend, T - h - 8, 4, 14, bend * 0.02, 0, TAU); g.fill(); }
  });
  cell(13, () => { // grapevine: light lobed leaves and bunches
    const lobed = (x, y, a, s, fill) => { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = fill; g.beginPath(); for (let k = 0; k < 5; k++) { const th = -Math.PI / 2 + (k - 2) * 0.7, rr = s * (k === 2 ? 1.0 : 0.82); g.lineTo(Math.cos(th - 0.25) * rr * 0.42, Math.sin(th - 0.25) * rr * 0.42); g.lineTo(Math.cos(th) * rr, Math.sin(th) * rr); g.lineTo(Math.cos(th + 0.25) * rr * 0.42, Math.sin(th + 0.25) * rr * 0.42); } g.closePath(); g.fill(); g.restore(); };
    blob(90, T / 2, T / 2, 104, 98, (x, y, d) => lobed(x, y, R() * TAU, 24 + R() * 10, hsl(84 + R() * 22, 46 + R() * 12, 30 + R() * 14 - d * 4)));
    for (let i = 0; i < 6; i++) { const x = T * 0.2 + R() * T * 0.6, y = T * (0.45 + R() * 0.3); g.fillStyle = hsl(R() < 0.5 ? 88 : 300, 40, 38); for (let k = 0; k < 16; k++) { g.beginPath(); g.arc(x + (R() - 0.5) * 16, y + k * 2.2 + (R() - 0.5) * 4, 3.6, 0, TAU); g.fill(); } }
  });
  cell(14, () => { // oleander: dark lanceolate leaves, pink flowers
    blob(260, T / 2, T / 2, 106, 98, (x, y) => leaf(x, y, R() * TAU, 22 + R() * 10, 3.8, hsl(112 + R() * 14, 38, 20 + R() * 10)));
    for (let i = 0; i < 16; i++) { const x = T * 0.2 + R() * T * 0.6, y = T * (0.2 + R() * 0.55); g.fillStyle = hsl(332 + R() * 10, 66, 62 + R() * 10); for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(x + Math.cos(k * 1.256) * 6, y + Math.sin(k * 1.256) * 6, 6, 4, k * 1.256, 0, TAU); g.fill(); } g.fillStyle = hsl(50, 80, 70); g.beginPath(); g.arc(x, y, 2.4, 0, TAU); g.fill(); }
  });
  cell(15, () => { // lemon tree: shiny leaves and lemons
    blob(240, T / 2, T / 2, 106, 98, (x, y, d) => leaf(x, y, R() * TAU, 22 + R() * 8, 7, hsl(104 + R() * 16, 46, 24 + R() * 14 - d * 4)));
    for (let i = 0; i < 12; i++) { const x = T * 0.2 + R() * T * 0.6, y = T * (0.25 + R() * 0.5); g.fillStyle = hsl(50 + R() * 6, 88, 54); g.beginPath(); g.ellipse(x, y, 9, 7, R() * 3, 0, TAU); g.fill(); g.fillStyle = hsl(52, 90, 70, 0.7); g.beginPath(); g.ellipse(x - 3, y - 2, 3, 2, 0, 0, TAU); g.fill(); }
  });
  const t = canvasOnce(new THREE.CanvasTexture(c)); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; t.flipY = false;
  return { map: t, normal: null };
}
