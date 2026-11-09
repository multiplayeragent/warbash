/* ==========================================================================
   DESERT KIT: surfaces, materials and objects of Sirocco, the round arena in the middle of the dunes.
   - The dune sand (procedural surface dune): curved wind ripples, with a long back and a steep face, smoothed patches, a grain; the
     relief itself is in 02-relief.js and the dune function in 02yl-sirocco.js;
   - Photo surfaces (Poly Haven, CC0; loaded only for a map that asks for them, `textures` of its definition): the rammed earth of the ruins
     (pisé), mud bricks, pebbles and the cracked mud of the oasis banks. Failing that (network cut), a similar procedural surface
     replaces them (siroccoKit);
   - Sandstone massifs (smMassif): collision rectangles, a wall made of a single loop of vertices that rises from foot to summit, its ledges
     fixed to the same layers from one massif to another, a desert patina in dark streaks and a top of rock or sand;
   - Rammed earth: ruined walls of the oasis (smRuin, broken top course);
   - Makeshift camps: Bedouin tent in wool strips (PF.smBedouin), cabin of sheet metal and planks (smShack), wooden watchtower and its
     staircase (smWatchtower), sandbag low walls (smSandbags), tarp stretched on poles (smTarp), fire pit (PF.smFire);
   - The wreck of a low-wing airliner (smPlane): fuselage broken in two that you can enter, cabin with 3 + 3 seats (PF.smSeats3),
     overhead bins and ceiling, walkable roof and wings (you climb onto the roof by the snowdrifts), blue tail outro, torn-off engines (PF.smJetEngine),
     cargo containers from the hold (PF.smULD);
   - Vegetation and objects: palm trees (PF.palm from 02h-nature.js, ribs and lightweight version), palm uprooted by the storm
     (smFallenPalm), reeds, acacia, well, jars, cart;
   - Desert life and the sandstorm: dust devils that wander over the sand, sand veils streaming over the rises, grains flying past the
     camera (smSandStream), vultures (in the lulls only).
   Everything is placed on the relief (gy0) and released with the map.
   ========================================================================== */
Object.assign(TEXSCALE, { pise: 2.4, adobe: 1.8, shingle: 1.7, vase: 4.4, sandstone: 9.0, dune: 3.2, reg: 2.8 });
Object.assign(TEXLAB, {
  /* red sandstone of the cliffs: beds of uneven thickness, wavy, cross-bedding in each bed, vertical joints specific to
     each bed, hollowed seams between two beds, dark streaks of desert patina, grain */
  sandstone: [1024, 83, 2.6, `
    float big = gfbm(uv, vec2(2.0), 5, 1.0), mid = gfbm(uv, vec2(8.0), 4, 2.0), fine = gfbm(uv, vec2(32.0), 3, 3.0), grain = gfbm(uv, vec2(96.0), 2, 4.0);
    float ly = uv.y * 5.0 + (big - 0.5) * 0.8 + (mid - 0.5) * 0.18;
    float band = fract(ly), bid = mod(floor(ly), 5.0), hb = hs(vec2(bid, 0.0), 7.0);
    float cr = fract(uv.x * 14.0 + band * (1.5 + hb * 2.5) + hs(vec2(bid, 2.0), 3.0) * 4.0);
    float xb = smoothstep(0.0, 0.07, cr) * (1.0 - smoothstep(0.07, 0.15, cr));
    float jx = uv.x * 7.0 + hs(vec2(bid, 3.0), 5.0) * 7.0 + (gfbm(uv, vec2(2.0, 8.0), 3, 6.0) - 0.5) * 0.5, jf = fract(jx);
    float joint = (1.0 - smoothstep(0.0, 0.035, min(jf, 1.0 - jf))) * step(0.45, hs(vec2(mod(floor(jx), 7.0), bid), 8.0)) * smoothstep(0.03, 0.12, band) * (1.0 - smoothstep(0.88, 0.97, band));
    float bed = 1.0 - smoothstep(0.0, 0.07, band) * (1.0 - smoothstep(0.92, 1.0, band));
    float streak = smoothstep(0.58, 0.8, gfbm(uv, vec2(24.0, 1.0), 3, 9.0)) * smoothstep(0.2, 0.9, band);
    h = 0.55 + (1.0 - bed) * 0.1 + (hb - 0.5) * 0.12 + mid * 0.2 + fine * 0.12 - joint * 0.3 - xb * 0.04;
    vec3 c0 = srgb(vec3(0.8, 0.5, 0.33)), c1 = srgb(vec3(0.9, 0.7, 0.52)), c2 = srgb(vec3(0.72, 0.42, 0.27)), c3 = srgb(vec3(0.86, 0.6, 0.42));
    a = hb < 0.3 ? c0 : hb < 0.55 ? c1 : hb < 0.8 ? c3 : c2;
    a *= (0.84 + mid * 0.22 + grain * 0.1) * (1.0 - joint * 0.4) * (1.0 - bed * 0.18) * (1.0 - xb * 0.1) * (1.0 - streak * 0.38);
    r = 0.88 + fine * 0.08; x = h;`],
  /* dune sand: curved wind ripples (long back, steep face), erased in patches, fine grain, shades from ocher to golden */
  dune: [1024, 61, 1.5, `
    float w = gfbm(uv, vec2(2.0), 4, 1.0), w2 = gfbm(uv, vec2(6.0), 3, 2.0);
    float ph = uv.y * 16.0 + uv.x * 3.0 + (w - 0.5) * 3.2 + (w2 - 0.5) * 0.9, f = fract(ph);
    float rip = smoothstep(0.0, 0.72, f) * (1.0 - smoothstep(0.72, 1.0, f));
    float fade = smoothstep(0.38, 0.8, gfbm(uv + 0.17, vec2(3.0), 3, 3.0));
    float big = gfbm(uv, vec2(3.0), 4, 4.0), gr = vn(uv * 512.0, vec2(512.0), 5.0);
    h = rip * (0.2 + 0.8 * fade) * 0.3 + big * 0.25 + gr * 0.07;
    vec3 c0 = srgb(vec3(0.9, 0.66, 0.43)), c1 = srgb(vec3(0.94, 0.74, 0.52)), c2 = srgb(vec3(0.82, 0.57, 0.36));
    a = mix(c2, c1, smoothstep(0.2, 0.8, big)); a = mix(a, c0, 0.3);
    a *= 0.93 + rip * fade * 0.09 + (gr - 0.5) * 0.12;
    r = 0.9 + gr * 0.05; x = h;`],
});
OPT_TEX.add('sandstone'); OPT_TEX.add('dune');
/* Procedural surfaces that Sirocco asks for (`surfaces` of its definition): the oasis water, the sandstone of the rocks, the dune sand */
const SIROCCO_SURFACES = ['ripple', 'sandstone', 'dune', 'palmbark', 'drystone'];

/* Colors. The two halves can be told apart: green tarps and green flags in the north (Alpha, +z), blue tarps in the south (Bravo, -z) */
const SM = {
  accent: [[0.16, 0.42, 0.26], [0.12, 0.3, 0.62]],
  wood: [0.62, 0.48, 0.36], palm: [0.58, 0.46, 0.34], rock: [1.0, 0.94, 0.9], rockP: [1.16, 0.88, 0.7], // rockP: on the cliff photo
  rust: [[0.62, 0.4, 0.28], [0.72, 0.52, 0.38], [0.55, 0.5, 0.46], [0.66, 0.6, 0.52], [0.5, 0.34, 0.26]],
  wool: [[0.2, 0.15, 0.11], [0.28, 0.2, 0.14], [0.16, 0.12, 0.09], [0.34, 0.26, 0.18]],
};
const smAccent = (z) => SM.accent[z >= 0 ? 0 : 1];
/* Noise of size f (m), periodic every 32 f meters */
function smN(N, x, z, f, oct = 3, o = 0) { return N.fbm(x / (f * 32) + o, z / (f * 32), 32, 32, oct); }
/* Height at which to place an object of radius r: the lowest of the relief beneath it (it sinks a little into the sand, never floats in the air) */
function smY(x, z, r = 0) {
  if (!r) return gy0(x, z);
  let h = gy0(x, z);
  for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; h = Math.min(h, gy0(x + Math.cos(a) * r, z + Math.sin(a) * r)); }
  return h - 0.04;
}
/* Footprint of a ground prefab (vertices under 2 m, local frame): center and half-sides, kept with it */
function smFoot(pf) {
  if (pf.foot) return pf.foot;
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const part of pf.parts.values()) { const P = part.g.P; for (let i = 0; i < part.g.nv; i++) { if (P[i * 3 + 1] > 2) continue; const x = P[i * 3], z = P[i * 3 + 2]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } }
  if (x0 > x1) x0 = x1 = z0 = z1 = 0;
  return (pf.foot = { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, hw: (x1 - x0) / 2, hd: (z1 - z0) / 2 });
}
/* Collisions of the prefabs that carry none (02f-props.js, 02g-vehicles.js: the map describes them), in the prefab's frame:
   [material, [x0, x1, y0, y1, z0, z1], ...]; vehicles carry their own (pf.vcols, 02g-vehicles.js). Tent: the walls up to 2.1 m, the gable roof in
   two steps; open container: the two walls and the roof (you pass through it); tank; antenna mast. Until 4.6.0, none:
   you walked through Sirocco's cars, trucks and tents */
const SM_COLS = {
  tent: ['dirt', [-3.5, 3.5, 0, 2.1, -2.2, 2.2], [-3.5, 3.5, 2.1, 2.7, -1.2, 1.2], [-3.5, 3.5, 2.7, 3.25, -0.5, 0.5]],
  containerOpen: ['metal', [-1.22, -1.1, 0, 2.6, -3.03, 3.03], [1.1, 1.22, 0, 2.6, -3.03, 3.03], [-1.22, 1.22, 2.5, 2.62, -3.03, 3.03]],
  waterTank: ['metal', [-0.55, 0.55, 0, 1.42, -0.55, 0.55]],
  antenna: ['metal', [-0.06, 0.06, 0, 3.2, -0.06, 0.06]],
};
/* Places a prefab on the sand flattened under its footprint (reliefFlat): it does not sink into a dune and does not float; o.margin (0.4 m);
   o.sink: sunk that much into the sand (a truck bogged down). The SM_COLS collisions are added to those of the prefab */
function smPlace(pf, x, z, rot = 0, o = {}) {
  const f = smFoot(pf), c = Math.cos(rot), s = Math.sin(rot);
  const y = reliefFlat(x + f.cx * c + f.cz * s, z - f.cx * s + f.cz * c, f.hw, f.hd, rot, { margin: o.margin !== undefined ? o.margin : 0.4 }), y0 = y - 0.02 - (o.sink || 0);
  DECOR.place(pf, x, y0, z, rot, o);
  const k = pf.vcols ? ['metal', ...pf.vcols] : SM_COLS[pf.name]; // vehicle: its collisions (vehCols)
  if (k && !o.nocol) colShape(x, y0, z, rot, k.slice(1), k[0]);
  return y;
}
/* Ground flattened under a hand-placed construction (cabin, watchtower, tarp, wall): like smPlace, returns the height at which to place it */
const smFlat = (x, z, hw, hd, rot = 0, margin = 0.4) => reliefFlat(x, z, hw, hd, rot, { margin }) - 0.02;

/* ---------- Materials and atlases ---------- */
function makeSiroccoMaterials(M) {
  M('pise', { tex: 'pise', grime: 1.3, streak: 0.9, dust: 0.35, macro: 0.5 });
  M('adobe', { tex: 'adobe', grime: 0.9, streak: 0.6, dust: 0.35, macro: 0.35, pom: 0.02, relief: 0.35 });
  // sandstone of the massifs: photo of a layered cliff (Poly Haven, cliff_side) tinted by the vertices; without it (network cut), the procedural surface
  if (TEX.strata) M('sandstone', { tex: 'strata', scale: 5.5, macro: 0.5, grime: 0.35, streak: 0.45, dust: 0.1, pom: 0.06 });
  else M('sandstone', { tex: 'sandstone', macro: 0.55, grime: 0.3, streak: 0.35, dust: 0.08, pom: 0.05 });
  M('shingle', { tex: 'shingle', macro: 0.35, dust: 0.2, pom: 0.03 });
  M('drystone', { tex: 'drystone', grime: 0.4, dust: 0.4, macro: 0.3, pom: 0.04 }); // the dry stone of Notos's well (cyWell)
  // airplane fuselage: matte, faded and dusty paint (less reflection than the cars' paint)
  M('hull', { tex: 'paint', metal: 0.2, ma: true, env: 0.3, grime: 1.2, dust: 1.0, macro: 0.45, streak: 0.7 });
  // airplane cabin: smooth panels and bins, leather seats, no pattern (the color comes from the vertices)
  M('cabin', { color: [1, 1, 1], rough: 0.5, env: 0.45, macro: 0.04 });
  // airplane windows: transparent, dusty and scratched glass, one half of the atlas cracked; neither shadow nor occlusion (like Floralia's canopy)
  const gt = smGlassTex(), gm = new THREE.MeshStandardMaterial({ map: gt, vertexColors: true, transparent: true, depthWrite: false, roughness: 0.08, metalness: 0, envMapIntensity: 1, side: THREE.DoubleSide });
  gm.userData.noShadow = true; gm.userData.noAO = true; gm.userData.noReceive = true; gm.userData.own = [gt]; MAT.glassAir = gm;
  // foliage as cut-out cards (atlas of Notos's Mediterranean flora: tamarisk, olive, reeds, grasses)
  M('cyfol', { tex: 'cyfol', cut: 0.42, rough: 0.8, env: 0.35, macro: 0.25, scale: 1, noNormal: true }); makeWind(MAT.cyfol, WIND_AMP.cyfol, { leaf: true, cards: true }); // foliage in the wind (02md-wind.js)
}
/* The map's atlas (called by buildTextures); a missing photo is replaced by a similar procedural surface */
function siroccoKit() {
  TEX.cyfol = cyFloraAtlas();
  if (!TEX.pise) TEX.pise = TEX.plaster2 || TEX.concrete;
  if (!TEX.adobe) TEX.adobe = TEX.ashlar || TEX.concrete;
  if (!TEX.shingle) TEX.shingle = TEX.gravel;
  if (!TEX.vase) TEX.vase = TEX.dirt || TEX.sand;
  if (!TEX.reg) TEX.reg = TEX.dirt || TEX.sand;
}

/* ---------- Sandstone massifs ---------- */
/* Hard layers of the sandstone (absolute heights, m): the wall juts out as a ledge there, at the same height from one massif to another */
const SM_BANDS = [2.6, 5.9, 9.4, 13.8, 18.5, 24.0, 30.5, 37.0];
/* Rock tint (linear): darker, redder foot, desert patina in streaks (vn: noise of the streak, from 0 to 1), top
   bleached by the sun; k: grain variation */
function smRockTint(y, y0, top, vn, k) {
  const foot = 1 - smoothstep(y0, y0 + 2.2, y), head = smoothstep(top - 2.5, top, y), streak = smoothstep(0.55, 0.85, vn) * smoothstep(top, top - 6, y) * 0.42;
  const C = TEX.strata ? SM.rockP : SM.rock; // the cliff photo is beige: a warmer tint for a desert sandstone
  const r = lerp(C[0], 0.86, foot) * (1 - streak) * k + head * 0.05, g = lerp(C[1], 0.6, foot) * (1 - streak * 1.1) * k + head * 0.06, b = lerp(C[2], 0.5, foot) * (1 - streak * 1.2) * k + head * 0.06;
  return [sl(clamp(r, 0, 1.2)), sl(clamp(g, 0, 1.2)), sl(clamp(b, 0, 1.2))];
}
/* Massif. I: { rects [x0, x1, z0, z1] (multiples of 0.5 m, see stOutline), top (height of the top), seed, y0 (foot, 0), walk (walkable
   top: flat, ground material, exact edge), col (false: no collision, distant scenery), cls (detail class, 0), bulge (maximum protrusion of
   the wall, m), cap (false: no top, hidden under another massif) }.
   Collisions: one box per rectangle, from foot to top. The wall never goes in behind the edge of the collisions (you can see where you bump);
   at the foot it protrudes only a few centimeters (legs do not go in), higher up it gets bumpy and juts out as a ledge on the
   hard layers. Returns the outline (stOutline). */
function smMassif(I) {
  const M = DECOR, O = stOutline(I.rects), N = makeNoise(I.seed), R = rngOf(I.seed * 7 + 3), y0 = I.y0 || 0, top = I.top, bulge = I.bulge !== undefined ? I.bulge : 0.9;
  if (I.col !== false) for (const q of I.rects) DECOR.col(q[0], q[1], y0, top, q[2], q[3], 'concrete');
  // edge loop, at most every 0.6 m; outward horizontal normal (averaged at reentrant corners). At convex corners, a fan
  // of normals at the same point: with the wall's minimum protrusion (dmin, lower down), the right angle of the collisions becomes an arc, always
  // outside (owner feedback, October 2026: very angular rocks, botched geometry)
  const P = O.pts, loop = [], NF = 7;
  for (let k = 0; k < P.length; k++) {
    const a = P[k], b = P[(k + 1) % P.length], L = hyp(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 0.6));
    const nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L, pa = P[(k + P.length - 1) % P.length], Lp = hyp(a[0] - pa[0], a[1] - pa[1]);
    const px = (a[1] - pa[1]) / Lp, pz = -(a[0] - pa[0]) / Lp, convex = (b[0] - a[0]) * px + (b[1] - a[1]) * pz < 0;
    if (convex) { const t0 = Math.atan2(pz, px); let dt = Math.atan2(nz, nx) - t0; if (dt > Math.PI) dt -= TAU; if (dt < -Math.PI) dt += TAU; for (let f = 1; f < NF; f++) loop.push({ x: a[0], z: a[1], nx: Math.cos(t0 + dt * f / NF), nz: Math.sin(t0 + dt * f / NF), fan: true }); }
    for (let i = 0; i < n; i++) loop.push({ x: lerp(a[0], b[0], i / n), z: lerp(a[1], b[1], i / n), nx, nz, corner: i === 0, convex: i === 0 && convex, arms: i === 0 ? Math.min(L, Lp) : 0 });
  }
  for (let k = 0; k < loop.length; k++) if (loop[k].corner && !loop[k].convex) { const p = loop[(k + loop.length - 1) % loop.length], q = loop[k], l = hyp(p.nx + q.nx, p.nz + q.nz) || 1; q.nx = (p.nx + q.nx) / l; q.nz = (p.nz + q.nz) / l; }
  // normals smoothed over a few points on either side: at the small steps of banded massifs, two neighboring almost
  // opposite normals folded the wall onto itself (thin vertical blades); damping near reentrant corners
  { const n = loop.length, nx = loop.map((p) => p.nx), nz = loop.map((p) => p.nz);
    for (let it = 0; it < 4; it++) for (let k = 0; k < n; k++) { const a = (k + n - 1) % n, b = (k + 1) % n; nx[k] = nx[a] + 2 * loop[k].nx + nx[b]; nz[k] = nz[a] + 2 * loop[k].nz + nz[b]; }
    for (let k = 0; k < n; k++) { const l = hyp(nx[k], nz[k]); loop[k].damp = clamp(l / (4 * 4), 0.15, 1); if (l > 1e-6) { loop[k].nx = nx[k] / l; loop[k].nz = nz[k] / l; } } }
  let s = 0; for (let k = 0; k < loop.length; k++) { loop[k].s = s; const q = loop[(k + 1) % loop.length]; s += hyp(q.x - loop[k].x, q.z - loop[k].z); }
  // distance (along the outline) to the nearest corner: faces bulge more than corners, which look worn and rounded
  { const cs = loop.filter((p) => p.corner).map((p) => p.s); for (const p of loop) { let m = 1e9; for (const c of cs) { const d = Math.abs(p.s - c); m = Math.min(m, d, s - d); } p.face = smoothstep(0, 3, m); } }
  const per = s, K = Math.max(4, Math.round(per / 7)), K2 = Math.max(6, Math.round(per / 3)), K3 = Math.max(4, Math.round(per / 6.5));
  // rows: below ground, at the foot, then every 1.2 to 2 m, two on either side of each hard layer, the top of the wall and the top
  let Ys = I.under ? [y0, y0 + 0.3] : [y0 - 0.5, y0 + 0.3];
  for (let y = y0 + R.range(0.9, 1.2); y < top - 0.8; y += R.range(0.8, 1.2)) Ys.push(y);
  const bands = SM_BANDS.filter((b) => b > y0 + 1.2 && b < top - 0.6);
  for (const b of bands) Ys.push(b - 0.3, b + 0.08);
  Ys = Ys.filter((y) => !bands.some((b) => y > b - 0.75 && y < b + 0.55 && Math.abs(y - (b - 0.3)) > 1e-6 && Math.abs(y - (b + 0.08)) > 1e-6));
  Ys.push(top - (I.walk ? 0.12 : 0.4), top); if (I.walk) Ys.push(top - 0.35, top - 0.7); Ys.sort((a, b) => a - b);
  Ys = Ys.filter((y, i) => i === 0 || y - Ys[i - 1] > 0.05);
  const nR = Ys.length, nL = loop.length;
  const ring = Ys.map((y, j) => loop.map((p) => {
    const foot = smoothstep(y0 + 0.2, y0 + 2.4, y), t = p.s / per;
    const lump = smN(N, p.s, y, 6, 3) - 0.38, crag = 0.5 - Math.abs(2 * N.fbm(t + 0.37, y / 9, K2, 6, 2) - 1);
    // vertical ribs (joints: the wall breaks into columns), bumps, edges, ledges on the hard layers
    const rib = smoothstep(0.4, 0.75, N.fbm(t + 0.13, y / 70, K3, 1, 2)) * 0.7;
    let d = Math.max(0, lump) * lerp(0.2, bulge, foot) + Math.max(0, crag) * 0.4 * foot * bulge + rib * bulge * lerp(0.15, 1, foot);
    // buttresses: large rounded masses of 6 to 12 m, above head height only (at the foot, the wall follows the collision); they
    // swell over 4 m of height: any faster, their underside made an overhang facing the ground, with no sun or sky (large dark patches)
    const high = smoothstep(y0 + 2.4, y0 + 6.6, y), mass = smoothstep(0.36, 0.74, N.fbm(t + 0.71, y / 26, Math.max(3, Math.round(per / 9)), 2, 2));
    d += mass * high * bulge * 0.9 * lerp(0.35, 1, p.face);
    // ledges of the hard layers: barely protruding, in places (the photo already carries the beds; a continuous band made a tiered cake,
    // and a sharp, interrupted ledge left a patch of shadow beneath)
    for (const b of bands) d += 0.32 * bulge * Math.exp(-(((y - b + 0.12) / 0.45) ** 2)) * foot * smoothstep(0.3, 0.62, N.fbm(t, b / 40, K, 2, 2)) * (TEX.strata ? 0.35 : 1.3);
    d *= p.damp;
    d = Math.max(d, lerp(0.22, 0.75, foot) * lerp(0.75, 1, p.face)); // minimum protrusion: convex corners are rounded (fan of normals), outside
    if (I.walk) d *= smoothstep(top + 0.01, top - 1.2, y); // the edge of the top follows the collision exactly
    else if (y >= top - 1e-6) d = 0; // the top closes on the outline (without a fold)
    if (y < y0) d = Math.max(d, 0.2);
    const jy = j > 1 && j < nR - 2 ? (N.fbm(t, j / 7, K, 2, 2) - 0.5) * 0.35 : 0;
    return [p.x + p.nx * d, y + jy, p.z + p.nz * d];
  }));
  // normals: differences along the loop and from one row to the next; outward
  const norm = [];
  for (let j = 0; j < nR; j++) for (let k = 0; k < nL; k++) {
    const a = ring[j][(k + 1) % nL], b = ring[j][(k + nL - 1) % nL], c = ring[Math.min(nR - 1, j + 1)][k], d = ring[Math.max(0, j - 1)][k];
    const tx = a[0] - b[0], ty = a[1] - b[1], tz = a[2] - b[2], vx = c[0] - d[0], vy = c[1] - d[1], vz = c[2] - d[2];
    let nx = ty * vz - tz * vy, ny = tz * vx - tx * vz, nz = tx * vy - ty * vx;
    const p = loop[k]; if (nx * p.nx + nz * p.nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const l = hyp3(nx, ny, nz) || 1; norm.push([nx / l, ny / l, nz / l]);
  }
  M.save().local(1); M.cls = I.cls || 0; M.aoFn = null;
  let cx = 0, cz = 0; for (const p of loop) { cx += p.x; cz += p.z; } cx /= nL; cz /= nL;
  const B = M.buf('sandstone', cx, (y0 + top) / 2, cz), ids = [];
  for (let j = 0; j < nR; j++) for (let k = 0; k < nL; k++) {
    const q = ring[j][k], n = norm[j * nL + k], vn = N.fbm(loop[k].s / per + 0.61, 0.5, Math.max(8, Math.round(per / 2.2)), 1, 2);
    M.tint = smRockTint(q[1], y0, top, vn, 0.92 + (N.fbm(loop[k].s / per, j / 9, 8, 2, 2) - 0.5) * 0.3);
    ids.push(M.v(B, q[0], q[1], q[2], n[0], n[1], n[2], loop[k].s, q[1], lerp(0.55, 1, smoothstep(y0, y0 + 1.6, Ys[j]))));
  }
  // faces turned outward (the outline loop turns in the direction in which its normal (dz, -dx) points out)
  for (let j = 0; j < nR - 1; j++) for (let k = 0; k < nL; k++) M.quadI(B, ids[j * nL + k], ids[(j + 1) * nL + k], ids[(j + 1) * nL + (k + 1) % nL], ids[j * nL + (k + 1) % nL]);
  M.restore();
  // scree at the foot: small blocks fallen from the wall, in irregular trails outside the collision boxes; no collision (under 35 cm
  // high, like the ground debris), they break the straight line between sand and rock
  if (I.col !== false && I.scree !== false) {
    const inRect = (x, z) => I.rects.some((q) => x > q[0] - 0.25 && x < q[1] + 0.25 && z > q[2] - 0.25 && z < q[3] + 0.25);
    for (let k = 0; k < nL; k++) {
      const p = loop[k]; if (N.fbm(p.s / per + 0.29, 0.3, Math.max(4, Math.round(per / 5)), 1, 2) < 0.47) continue;
      for (let i = 0, n = 1 + Math.floor(R() * 2); i < n; i++) {
        const o = R.range(0.35, 1.7), w = R.range(-0.45, 0.45), x = p.x + p.nx * o - p.nz * w, z = p.z + p.nz * o + p.nx * w;
        if (inRect(x, z)) continue;
        DECOR.place(PF.smScree(1 + Math.floor(R() * 6)), x, smY(x, z) - 0.04, z, R() * TAU, { nocol: true, s: R.range(0.6, 1.25) });
      }
    }
  }
  if (I.under) { // underside of a rock bridge (vault of a cave): the rock seen from below, dark
    M.save().local(1); M.cls = I.cls || 0; M.aoFn = null; M.color([0.6, 0.46, 0.38]);
    const U = M.buf('sandstone', cx, y0, cz);
    for (const q of I.rects) { const a = M.v(U, q[0], y0, q[2], 0, -1, 0, q[0], q[2], 0.5), b = M.v(U, q[1], y0, q[2], 0, -1, 0, q[1], q[2], 0.5), c = M.v(U, q[1], y0, q[3], 0, -1, 0, q[1], q[3], 0.5), d = M.v(U, q[0], y0, q[3], 0, -1, 0, q[0], q[3], 0.5); M.quadI(U, a, b, c, d); }
    M.restore();
  }
  if (I.cap === false) return O;
  // detached blocks along the edge of the walkable top, a bigger one on each convex corner: they break the straight line and the right
  // angle of the plateau; half on the edge, no collision (under 45 cm above the top: you walk through them like pebbles)
  if (I.walk && I.rim !== false) {
    let last = -9;
    for (let k = 0; k < nL; k++) {
      const p = loop[k]; if (p.fan) continue;
      const big = p.convex && p.arms >= 2.5, nz = N.fbm(p.s / per + 0.83, 0.7, Math.max(6, Math.round(per / 3)), 1, 2); // big block: sharp corner, not a small ledge
      if (!big && (nz < 0.62 || p.s - last < 4.5 || p.corner)) continue;
      last = p.s;
      const sc = big ? R.range(0.95, 1.25) : R.range(0.7, 1.0), o = big ? -0.45 : R.range(-0.4, -0.1);
      DECOR.place(PF.smRock(sc, 1 + Math.floor(R() * 6), 0.42), p.x + p.nx * o, top - sc * 0.16, p.z + p.nz * o, R() * TAU, { nocol: true });
    }
  }
  if (I.walk) {
    // walkable top: the covered 0.5 m cells, joined by rows, in the ground material (distribution included)
    M.save().local(1).color([0.92, 0.9, 0.86]); M.cls = 0; M.aoFn = null;
    const T = M.buf('ground', O.bx0 + O.W * O.r / 2, top, O.bz0 + O.H * O.r / 2);
    for (let j = 0; j < O.H; j++) for (let i = 0; i < O.W; i++) {
      if (!O.on[j * O.W + i] || (i > 0 && O.on[j * O.W + i - 1])) continue;
      let k = i; while (k + 1 < O.W && O.on[j * O.W + k + 1]) k++;
      const x0 = O.bx0 + i * O.r, x1 = O.bx0 + (k + 1) * O.r, z0 = O.bz0 + j * O.r, z1 = z0 + O.r;
      const a = M.v(T, x0, top, z0, 0, 1, 0, x0, -z0), b = M.v(T, x1, top, z0, 0, 1, 0, x1, -z0), c = M.v(T, x1, top, z1, 0, 1, 0, x1, -z1), d = M.v(T, x0, top, z1, 0, 1, 0, x0, -z1);
      M.quadI(T, a, d, c, b);
    }
    M.restore();
  } else {
    // rock top: the top of the wall (last row) triangulated, in the ground material (sand and pebbles of the plateau)
    const top2 = ring[nR - 1].map((q) => q.slice()), contour = top2.map((q) => new THREE.Vector2(q[0], q[2]));
    const tri = THREE.ShapeUtils.triangulateShape(contour, []);
    M.save().local(1); M.cls = I.cls || 0; M.aoFn = null;
    M.color([0.98, 0.86, 0.74]);
    const T = M.buf('ground', cx, top, cz), vids = top2.map((q) => M.v(T, q[0], q[1], q[2], 0, 1, 0, q[0], -q[2]));
    for (const t of tri) { const a = top2[t[0]], b = top2[t[1]], c = top2[t[2]], cr = (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]); if (cr > 0) M.tri(T, vids[t[0]], vids[t[2]], vids[t[1]]); else M.tri(T, vids[t[0]], vids[t[1]], vids[t[2]]); }
    M.restore();
  }
  return O;
}

/* Scree: two to four small angular blocks of sandstone fallen from the wall (30 cm at most), no collision */
PF.smScree = (seed = 1) => prefab('smScree' + seed, (M) => {
  const R = rngOf(seed * 37 + 11); M.cls = 2; M.local(1);
  for (let i = 0, n = 2 + Math.floor(R() * 3); i < n; i++) {
    const a = R() * TAU, d = i ? R.range(0.15, 0.5) : 0, s = i ? R.range(0.06, 0.16) : R.range(0.14, 0.26), g = R.range(0.86, 1.06);
    M.color([1.06 * g, 0.8 * g, 0.62 * g]);
    M.save().move(Math.cos(a) * d, -s * 0.15, Math.sin(a) * d).rotY(R() * TAU).rotZ(R.range(-0.3, 0.3));
    rockMesh(M, R, s * R.range(1, 1.5), s * R.range(0.55, 0.9), s * R.range(0.8, 1.2), 3 + Math.floor(R() * 4), 7, 5, 'sandstone');
    M.restore();
  }
});
/* Isolated sandstone rock (cover): block cut into facets, collision of its tightened box; s: size (m), squash: flattening */
PF.smRock = (s = 1.6, seed = 1, squash = 0.75) => prefab(`smRock${s}_${seed}_${squash}`, (M) => {
  const R = rngOf(seed * 13 + 7);
  M.color([R.range(0.92, 1.02), R.range(0.74, 0.84), R.range(0.6, 0.7)]).local(1);
  rockMesh(M, R, s * 0.62, s * 0.62 * squash, s * 0.55, 8, 11, 8, 'sandstone');
  M.col(-s * 0.5, s * 0.5, 0, s * 0.62 * squash * 1.7, -s * 0.44, s * 0.44, 'concrete');
});

/* ---------- Rammed earth: ruins ---------- */
/* Ruined wall: from a0 to a1, pierced by passages gaps [[a0, a1], ...] (no lintel), in sections 0.8 to 2 m wide with heights drawn between h0 and h1 (top
   course broken in steps), foot sunk under the sand (y0); a few fallen bricks at the foot */
function smRuin(axis, fixed, t, a0, a1, y0, h0, h1, gaps, R, tint) {
  const segs = []; let cur = a0;
  for (const g of gaps.slice().sort((p, q) => p[0] - q[0])) { if (g[0] - cur > 0.3) segs.push([cur, g[0]]); cur = g[1]; }
  if (a1 - cur > 0.3) segs.push([cur, a1]);
  for (const [s0, s1] of segs) {
    let a = s0;
    let h = R.range(h0, h1);
    while (a < s1 - 1e-3) {
      const b = Math.min(s1, a + R.range(0.5, 1.1));
      h = clamp(h + R.range(-0.35, 0.35), h0, h1);
      wallOpen('pise', axis, fixed, t, a, s1 - b < 0.3 ? s1 : b, y0, h, [], { tint, frames: false });
      a = s1 - b < 0.3 ? s1 : b;
    }
  }
  const M = DECOR; M.save().color(tint); M.cls = 2;
  for (let i = 0; i < Math.round((a1 - a0) / 2.5); i++) {
    const a = R.range(a0, a1), off = (R() < 0.5 ? -1 : 1) * R.range(t / 2 + 0.15, t / 2 + 0.7), x = axis === 'x' ? a : fixed + off, z = axis === 'x' ? fixed + off : a, s = R.range(0.18, 0.3);
    M.save().move(x, smY(x, z) + s * 0.25, z).rotY(R() * TAU).rotX(R.range(-0.4, 0.4)); M.boxB('adobe', -s, s, -s * 0.4, s * 0.4, -s * 0.6, s * 0.6, { bevel: 0.03 }); M.restore();
  }
  M.restore();
}

/* ---------- Desert objects ---------- */
function smJar(x, z, s = 1, R) { DECOR.dyn('jar', x, smY(x, z, 0.25), z, R ? R() * TAU : 0, { s }); }
/* Sandbag low wall: one physical prop per bag, in staggered rows, placed on the relief; shots shake them and eventually make them
   fall, along with those they carried */
function smSandbags(cx, cz, len, axis, rows, R) {
  const bl = 0.6, n = Math.max(1, Math.round(len / bl)), step = len / n, k = step / bl, dx = axis === 'x' ? 1 : 0, dz = axis === 'x' ? 0 : 1, rot = axis === 'x' ? 0 : Math.PI / 2;
  const W = rngOf(Math.round(cx * 131 + cz * 17 + len * 7 + 99)), fallen = [], top = rows - 1, base = [0.95, 0.85, 0.71];
  // wear (sandbagWear): top row never complete, ends mostly gone, missing bags often lying at the foot of the wall
  const wr = rows > 1 ? sandbagWear(n - (top % 2), top % 2 === 1, (top - 1) % 2 === 1, W) : null, fall = (x, z, type) => sandbagFallen(x, z, dx, dz, 0.2 * k, rot, (px, pz) => smY(px, pz), k, base, W, fallen, type);
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * step * 0.5;
    for (let i = 0; i < n - (r % 2); i++) {
      const a = -len / 2 + step * (i + 0.5) + off, j = (R() - 0.5) * 0.03, x = axis === 'x' ? cx + a : cx + j, z = axis === 'x' ? cz + j : cz + a;
      const tint = [0.9 + R() * 0.1, 0.8 + R() * 0.1, 0.66 + R() * 0.1];
      if (wr && r === top && wr.gone.has(i)) { fall(x, z); continue; }
      DECOR.dyn('sandbag', x, smY(x, z) + r * 0.22 * k, z, rot + j * 2, { s: k, tint }); // off-axis by 3° at most
    }
    // a staggered row closes with two half bags (draw specific to the wall: the rest of the scenery does not change)
    if (r % 2) sandbagHalves(cx, cz, len, dx, dz, (x, z) => smY(x, z) + r * 0.22 * k, k, base, rngOf(Math.round(cx * 131 + cz * 17 + r * 7 + 9000)), wr ? (r === top ? wr.half : r === top - 1 ? wr.low : null) : null, fall);
  }
}
/* Tarp stretched on four poles: from (x, z), w along rot, d across, high edge h0 and low edge h1 above the ground y; the canvas has no
   collision (a shadow and a shelter for the eyes), simulated (Maker.canvasCloth: held at the four corners and along the high and low edges, its
   free sides flap), the poles have a collision, guy lines */
function smTarp(x, y, z, rot, w, d, h0, h1, col) {
  const M = DECOR; M.save().move(x, y, z).rotY(rot);
  M.color(col); M.cls = 1;
  M.canvasCloth(4, 3, (u, v) => { const xx = (u - 0.5) * w, zz = (v - 0.5) * d; return [xx, lerp(h0, h1, v) - Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.12, zz]; }, { uL: w, vL: d, flipN: true, play: 0.22, pin: (u, v) => v <= 0 || v >= 1 });
  M.color(SM.palm); M.cls = 1;
  for (const sx of [-1, 1]) for (const [sz, h] of [[-1, h0], [1, h1]]) { M.save().move(sx * w / 2, 0, sz * d / 2); M.cyl('wood', 0.04, h + 0.05, 6); M.restore(); M.col(sx * w / 2 - 0.06, sx * w / 2 + 0.06, 0, h, sz * d / 2 - 0.06, sz * d / 2 + 0.06, 'wood'); }
  M.color([0.62, 0.56, 0.46]);
  for (const sx of [-1, 1]) for (const [sz, h] of [[-1, h0], [1, h1]]) M.tube('burlap', 0.008, [[sx * w / 2, h, sz * d / 2], [sx * (w / 2 + 0.9), 0, sz * (d / 2 + 0.9)]], 3);
  M.restore();
}
/* Fire pit: ring of blackened stones, dead embers, pot on three stones */
PF.smFire = () => prefab('smFire', (M) => {
  const R = rngOf(9177); M.local(1);
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; M.save().move(Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55).rotY(a); M.color([0.42, 0.36, 0.32]); rockMesh(M, R, 0.16, 0.1, 0.13, 5, 6, 5, 'stone'); M.restore(); }
  M.color([0.12, 0.1, 0.09]); M.boxB('charred', -0.4, 0.4, 0, 0.04, -0.4, 0.4, { bevel: 0.02 });
  for (let i = 0; i < 4; i++) { M.save().move(0, 0.06, 0).rotY(i * 0.8).rotZ(0.2); M.cyl('charred', 0.04, 0.6, 6); M.restore(); }
  M.color([0.2, 0.19, 0.18]); M.save().move(0.15, 0.08, 0.1); M.lathe('steel', [[0, 0], [0.18, 0.02], [0.22, 0.14], [0.2, 0.24], [0.17, 0.25]], 10); M.restore();
});
/* Bedouin tent: low, wide roof in strips of dark wool (a light band from time to time), sagging between the posts, raised at the front (the
   open side, +z), closed at the back and on the sides down to the ground; rugs and cushions inside, guy lines and stakes in front. Collisions of the walls
   (you enter from the front); the roof has none. Strips and walls are simulated cloths (Maker.canvasCloth): each strip is sewn to its neighbors
   (its edges hold) and rests on the row of posts, the middle of the strips ripples and sags under a gust */
PF.smBedouin = (w = 7, d = 4.4, seed = 1) => prefab(`smBedouin${w}_${d}_${seed}`, (M) => {
  const R = rngOf(seed * 37 + 5), hw = w / 2, hd = d / 2, hR = 2.05, hF = 1.6, hB = 0.85, rz = -0.3, np = Math.max(2, Math.round(w / 2.4));
  const yz = (z) => (z < rz ? lerp(hB, hR, smoothstep(-hd, rz, z)) : lerp(hR, hF, smoothstep(rz, hd, z)));
  const sag = (x) => { const t = ((x + hw) / w) * np, f = t - Math.floor(t); return 0.2 * Math.sin(f * Math.PI); };
  const Y = (x, z) => yz(z) - sag(x) * (1 - 0.4 * Math.abs(z - rz) / hd);
  M.local(1); M.cls = 0;
  const nb = Math.round(w / 0.75), wool = (b) => (R() < 0.12 ? [0.6, 0.52, 0.4] : SM.wool[(b % 2) + (R() < 0.3 ? 2 : 0)]);
  for (let b = 0; b < nb; b++) {
    const x0 = -hw + (w * b) / nb, x1 = -hw + (w * (b + 1)) / nb;
    M.color(wool(b));
    M.canvasCloth(2, 10, (u, v) => { const x = lerp(x0, x1, u), z = lerp(-hd, hd, v); return [x, Y(x, z), z]; }, { mat: 'woolen', uL: x1 - x0, vL: d, flipN: true, play: 0.07, pin: (u, v) => u <= 0 || u >= 1 || v <= 0 || v >= 1 || Math.abs(lerp(-hd, hd, v) - rz) < 0.12, glow: 0.05 });
    M.canvasCloth(2, 2, (u, v) => { const x = lerp(x0, x1, u); return [x, lerp(Y(x, -hd), 0, v), -hd - v * 0.2]; }, { mat: 'woolen', uL: x1 - x0, vL: 1, play: 0.06, glow: 0.05 });
  }
  M.color(SM.wool[0]);
  for (const s of [-1, 1]) M.canvasCloth(6, 2, (u, v) => { const z = lerp(-hd, 0.4, u); return [s * hw, lerp(Y(s * hw, z), 0, v), z]; }, { mat: 'woolen', uL: hd, vL: 1.6, flipN: s < 0, play: 0.08, glow: 0.05 });
  M.color(SM.palm);
  for (let i = 0; i <= np; i++) { const x = -hw + (w * i) / np; M.save().move(x, 0, rz); M.cyl('wood', 0.05, Y(x, rz) + 0.08, 6); M.restore(); M.save().move(x, 0, hd); M.cyl('wood', 0.045, Y(x, hd) + 0.06, 6); M.restore(); }
  M.color([0.6, 0.54, 0.44]);
  for (let i = 0; i <= np; i++) { const x = -hw + (w * i) / np; M.tube('burlap', 0.008, [[x, Y(x, hd), hd], [x * 1.08, 0, hd + 1.7]], 3); }
  M.save().color([1, 1, 1]); M.uvS = 2.4 / TEXSCALE.rug; M.uvO = [0.5, 0.5]; M.cls = 1;
  for (const x of [-hw * 0.5, hw * 0.45]) { M.save().move(x, 0.015, -0.4).rotY(R.range(-0.1, 0.1)); M.boxB('rug', -1.2, 1.2, 0, 0.012, -0.8, 0.8); M.restore(); }
  M.restore();
  for (let i = 0; i < 4; i++) { M.color(R.pick([[0.62, 0.14, 0.12], [0.75, 0.42, 0.15], [0.2, 0.25, 0.5], [0.55, 0.2, 0.3]])); const x = R.range(-hw + 0.6, hw - 0.6); M.save().move(x, 0, -hd + 0.45).rotY(R.range(-0.2, 0.2)); M.boxB('canvas', -0.35, 0.35, 0, 0.32, -0.25, 0.25, { bevel: 0.1 }); M.restore(); }
  M.col(-hw, hw, 0, 1.0, -hd - 0.2, -hd + 0.05, 'dirt');
  for (const s of [-1, 1]) M.col(s * hw - 0.08, s * hw + 0.08, 0, 1.3, -hd, 0.3, 'dirt');
});
/* Makeshift cabin (frame at its foot: (x, y, z), rotated by rot): wooden posts, walls of rusty corrugated sheets and planks, of
   mixed tints; a doorless opening in the front face (+z, from o.door to o.door + 1.2 m from the middle), a window on one side, sheet-metal
   roof sloping to the back (tires and stones on top); o.back: the same door in the back face (you pass through). Collisions of the walls
   and the roof: you enter by the door */
function smShack(x, y, z, rot, w, d, h, R, o = {}) {
  const M = DECOR, hw = w / 2, hd = d / 2, dr = o.door !== undefined ? o.door : -0.6, t = 0.06, win = o.win !== undefined ? o.win : 1;
  M.save().move(x, y, z).rotY(rot); M.cls = 0;
  const panel = (x0, x1, y0, y1, z0, z1) => { const tin = R() < 0.72; M.color(tin ? R.pick(SM.rust) : [0.55, 0.44, 0.34]); M.boxB(tin ? 'corrugated' : 'wood', x0, x1, y0, y1, z0, z1); };
  const run = (a0, a1, y0, y1, fixed, axis, holes) => { // one face, in panels of 0.9 to 1.3 m, pierced with [a0, a1, b0, b1]
    let a = a0;
    while (a < a1 - 1e-3) {
      const b = Math.min(a1, a + R.range(0.9, 1.3)), c = a1 - b < 0.35 ? a1 : b;
      let segs = [[a, c, y0, y1]];
      for (const q of holes) segs = segs.flatMap((s) => { const u0 = Math.max(s[0], q[0]), u1 = Math.min(s[1], q[1]); return q[0] >= s[1] || q[1] <= s[0] ? [s] : [[s[0], u0, s[2], s[3]], [u0, u1, s[2], q[2]], [u0, u1, q[3], s[3]], [u1, s[1], s[2], s[3]]].filter((p) => p[1] - p[0] > 0.02 && p[3] - p[2] > 0.02); }); // the opening trimmed from the panel: no overlap between two panels
      for (const s of segs) {
        if (axis === 'x') { panel(s[0], s[1], s[2], s[3], fixed - t / 2, fixed + t / 2); M.col(s[0], s[1], s[2], s[3], fixed - 0.07, fixed + 0.07, 'metal'); }
        else { panel(fixed - t / 2, fixed + t / 2, s[2], s[3], s[0], s[1]); M.col(fixed - 0.07, fixed + 0.07, s[2], s[3], s[0], s[1], 'metal'); }
      }
      a = c;
    }
  };
  const hb = h - 0.35;
  run(-hw, hw, 0, h, hd, 'x', [[dr, dr + 1.2, 0, 2.05]]);
  run(-hw, hw, 0, hb, -hd, 'x', o.back ? [[dr, dr + 1.2, 0, 2.05]] : []);
  run(-hd, hd, 0, hb, -hw, 'z', win < 0 ? [[-0.4, 0.4, 1.0, 1.55]] : []);
  run(-hd, hd, 0, hb, hw, 'z', win > 0 ? [[-0.4, 0.4, 1.0, 1.55]] : []);
  // posts, lintel, roof
  M.color([0.5, 0.4, 0.3]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.boxB('wood', sx * hw - 0.06, sx * hw + 0.06, 0, (sz > 0 ? h : hb) - 0.025, sz * hd - 0.06, sz * hd + 0.06); // under the sheet (not in its plane)
  M.boxB('wood', dr - 0.05, dr + 1.25, 2.0, 2.13, hd - 0.05, hd + 0.05); // lintel: its underside sticks out under the sheet (not in its plane)
  if (o.back) M.boxB('wood', dr - 0.05, dr + 1.25, 2.0, 2.13, -hd - 0.05, -hd + 0.05);
  M.color(R.pick(SM.rust));
  const B = [[-hw - 0.25, h + 0.04, hd + 0.3], [hw + 0.25, h + 0.04, hd + 0.3], [hw + 0.25, hb - 0.04, -hd - 0.3], [-hw - 0.25, hb - 0.04, -hd - 0.3]];
  M.quad('corrugated', B[0], B[1], B[2], B[3], [0, 1, 0]); M.quad('corrugated', B[0], B[3], B[2], B[1], [0, -1, 0]);
  M.col(-hw, hw, hb - 0.05, h + 0.05, -hd, hd, 'metal');
  M.color([0.18, 0.17, 0.16]); M.cls = 1;
  M.save().move(R.range(-hw * 0.5, hw * 0.5), (h + hb) / 2 + 0.06, R.range(-hd * 0.3, hd * 0.3)); M.lathe('rubber', [[0.2, 0], [0.36, 0.02], [0.4, 0.11], [0.36, 0.2], [0.2, 0.22], [0.18, 0.11], [0.2, 0]], 12); M.restore();
  M.restore();
}
/* Wooden watchtower (frame at the foot, (x, y, z), x and z at the center of a 1 m cell): four posts, 3.2 m platform at 3 m, sheet-metal
   railing on three and a half sides, sheet-metal roof; the staircase (6.2 m ramp along z, 1.6 m wide, slope 0.48) starts from the dir side
   (1: +z, -1: -z), on the x > x0 half of the front, open in the railing */
function smWatchtower(x, y, z, R, dir = 1) {
  const M = DECOR, P = 3.0, hw = 1.6;
  M.save().move(x, y, z); M.cls = 0; M.color([0.52, 0.4, 0.3]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { M.boxB('wood', sx * hw - 0.09, sx * hw + 0.09, 0, P + 2.3, sz * hw - 0.09, sz * hw + 0.09); M.col(sx * hw - 0.09, sx * hw + 0.09, 0, P + 2.3, sz * hw - 0.09, sz * hw + 0.09, 'wood'); }
  // bracing: Saint Andrew's cross on both sides and the back (two levels of crosses, rails between them), front open under
  // the staircase; each braced face blocks passage (you walked through it: owner feedback, October 2026), not bullets
  const braced = [['x', -1], ['x', 1], ['z', -dir]], seg = (ax, f, y0b, y1b, u0, u1) => { // bar from (u0, y0b) to (u1, y1b) in the face
    const L = hyp(u1 - u0, y1b - y0b), ang = Math.atan2(y1b - y0b, u1 - u0);
    M.save().move(ax === 'x' ? f * hw : (u0 + u1) / 2, (y0b + y1b) / 2, ax === 'x' ? (u0 + u1) / 2 : f * hw);
    if (ax === 'x') M.rotX(-ang); else M.rotZ(ang);
    if (ax === 'x') M.boxB('wood', -0.045, 0.045, -0.05, 0.05, -L / 2, L / 2); else M.boxB('wood', -L / 2, L / 2, -0.05, 0.05, -0.045, 0.045);
    M.restore();
  };
  for (const [ax, f] of braced) {
    for (const [a, b] of [[0.25, 1.6], [1.6, 2.86]]) { seg(ax, f, a, b, -hw + 0.09, hw - 0.09); seg(ax, f, a, b, hw - 0.09, -hw + 0.09); }
    for (const yy of [0.22, 1.6]) { if (ax === 'x') M.boxB('wood', f * hw - 0.05, f * hw + 0.05, yy - 0.06, yy + 0.06, -hw, hw); else M.boxB('wood', -hw, hw, yy - 0.06, yy + 0.06, f * hw - 0.05, f * hw + 0.05); }
    const c = ax === 'x' ? [f * hw - 0.06, f * hw + 0.06, -hw, hw] : [-hw, hw, f * hw - 0.06, f * hw + 0.06];
    COL.push({ x0: x + c[0], x1: x + c[1], y0: y, y1: y + P - 0.3, z0: z + c[2], z1: z + c[3], m: 'wood', ray: false, noRay: true });
  }
  M.boxB('wood', -hw - 0.1, hw + 0.1, P - 0.14, P, -hw - 0.1, hw + 0.1);
  M.col(-hw - 0.1, hw + 0.1, P - 0.3, P, -hw - 0.1, hw + 0.1, 'wood');
  const back = -dir * hw, front = dir * hw;
  for (const [x0, x1, z0, z1] of [[-hw, hw, back - 0.04, back + 0.04], [-hw - 0.04, -hw + 0.04, -hw, hw], [hw - 0.04, hw + 0.04, -hw, hw], [-hw, -0.1, front - 0.04, front + 0.04]]) {
    M.color(R.pick(SM.rust)); M.boxB('corrugated', x0, x1, P, P + 1.1, z0, z1); M.col(x0, x1, P, P + 1.1, z0, z1, 'metal');
  }
  M.color(R.pick(SM.rust)); M.boxB('corrugated', -hw - 0.3, hw + 0.3, P + 2.3, P + 2.36, -hw - 0.3, hw + 0.3);
  M.col(-hw - 0.3, hw + 0.3, P + 2.3, P + 2.36, -hw - 0.3, hw + 0.3, 'metal', true); // the roof stops bullets; you cannot hoist yourself onto it from the railing
  M.restore();
  const za = z + dir * hw, zb = z + dir * (hw + 6.2);
  ramp(x, x + 1.6, Math.min(za, zb), Math.max(za, zb), 'z', dir > 0 ? y + P : y, dir > 0 ? y : y + P, 'pavers', [0.62, 0.5, 0.38], { mat: 'wood' });
}

/* Reed tuft (Notos atlas) */
PF.smReeds = (s = 1) => prefab('smReeds' + s, (M) => {
  // reed tuft: about thirty thin, tapered stems (two canvas triangles, green to yellow), leaning, a few brown ears
  const R = rngOf(Math.round(s * 100) + 17); M.local(1); M.cls = 1;
  M.swFn = swHeight(0, 2 * s, 1.4, 1); // the stems bend from the top, in the wind (02md-wind.js); soft 'stem' material
  for (let i = 0; i < 30; i++) {
    const a = R() * TAU, r = R() * 0.32 * s, x = Math.cos(a) * r, z = Math.sin(a) * r, h = R.range(1.1, 2.0) * s, lean = R.range(0.05, 0.35), la = R() * TAU, w = R.range(0.02, 0.035);
    const tx = x + Math.cos(la) * lean * h, tz = z + Math.sin(la) * lean * h, mx = (x + tx) / 2 + Math.cos(la) * 0.05, mz = (z + tz) / 2 + Math.sin(la) * 0.05, px = -Math.sin(la) * w, pz = Math.cos(la) * w;
    M.color(R.pick([[0.46, 0.56, 0.26], [0.58, 0.62, 0.3], [0.7, 0.66, 0.38], [0.52, 0.5, 0.28]]));
    M.quad('stem', [x - px, 0, z - pz], [x + px, 0, z + pz], [mx + px * 0.7, h * 0.55, mz + pz * 0.7], [mx - px * 0.7, h * 0.55, mz - pz * 0.7], [Math.cos(la), 0.3, Math.sin(la)]);
    M.quad('stem', [mx - px * 0.7, h * 0.55, mz - pz * 0.7], [mx + px * 0.7, h * 0.55, mz + pz * 0.7], [tx + px * 0.1, h, tz + pz * 0.1], [tx - px * 0.1, h, tz - pz * 0.1], [Math.cos(la), 0.3, Math.sin(la)]);
    if (R() < 0.2) { M.color([0.4, 0.28, 0.18]); M.save().move(tx, h - 0.05, tz); M.cyl('stem', 0.025, 0.2, 5); M.restore(); }
  }
});
/* Acacia (umbrella tree of the wadis): twisted trunk, flat crown in a sheet, no leaves below (you can see under it) */
PF.smAcacia = (h = 4.6, seed = 1, dead = false) => prefab(`smAcacia${h}_${seed}_${dead ? 1 : 0}`, (M) => {
  const R = rngOf(seed * 23 + 11);
  M.color(dead ? [0.62, 0.56, 0.5] : [0.46, 0.38, 0.32]).local(1);
  const path = []; for (let k = 0; k <= 6; k++) { const t = k / 6; path.push([Math.sin(t * 3 + seed) * 0.35 * t, t * h * 0.62, Math.cos(t * 2 + seed) * 0.25 * t]); }
  M.sweep('wood', circleShape(1, 7), path, { scale: (t) => lerp(0.2, 0.09, t), uAround: 0.6 });
  const top = path[path.length - 1], tips = [];
  M.swFn = swCrown(top[0], top[2], h * 0.5, h, h * 0.5, 0.7); // the sheet of leaves quivers and sways (02md-wind.js)
  for (let b = 0; b < 4; b++) {
    const a = b * 1.6 + seed + R() * 0.5, reach = h * R.range(0.38, 0.55), P2 = [];
    for (let k = 0; k <= 4; k++) { const t = k / 4; P2.push([top[0] + Math.cos(a) * reach * t, top[1] + Math.sin(t * Math.PI * 0.6) * h * 0.22, top[2] + Math.sin(a) * reach * t]); }
    M.sweep('wood', circleShape(1, 5), P2, { scale: (t) => lerp(0.08, 0.025, t), uAround: 0.6 }); tips.push(P2[4], P2[2]);
  }
  if (!dead) for (let i = 0; i < Math.round(h * 9); i++) {
    const c = tips[Math.floor(R() * tips.length)], a = R() * TAU, r = R() * h * 0.22;
    cyPatch(M, [c[0] + Math.cos(a) * r, c[1] + R.range(-0.05, 0.25), c[2] + Math.sin(a) * r], R.range(0.9, 1.3), CYF.olive, R, R.pick([[0.72, 0.82, 0.55], [0.8, 0.86, 0.6], [0.66, 0.76, 0.5]]), { tilt: R.range(0, 0.35), up: 0.8 });
  }
  M.col(-0.2, 0.2, 0, h * 0.6, -0.2, 0.2, 'wood');
  M.occ(-h * 0.45, h * 0.45, h * 0.6, h, -h * 0.45, h * 0.45, 0.3);
});
/* Distant palm tree prefab (few vertices, no collision or shadow of its own): same fronds as PF.palm, in three segments; trunk more or less
   thick and crown more or less large depending on the seed */
PF.smPalmFar = (h = 8, seed = 1) => prefab(`smPalmFar${h}_${seed}`, (M) => {
  const R = rngOf(seed * 7 + 5), lx = R.range(-0.6, 0.6), lz = R.range(-0.6, 0.6), g = 0.75 + ((seed * 5) % 7) * 0.09, cr = 0.85 + ((seed * 3) % 5) * 0.08;
  M.color([0.6, 0.52, 0.42]).local(1); M.cls = 1;
  M.sweep('palmbark', circleShape(1, 5), [[0, 0, 0], [lx * 0.3, h * 0.5, lz * 0.3], [lx, h, lz]], { scale: (t) => (0.22 - 0.08 * t) * g, uAround: 1 });
  for (let i = 0; i < 14; i++) {
    const u = i / 13;
    M.color([R.range(0.85, 1), R.range(0.9, 1), R.range(0.75, 0.9)]);
    palmFrond(M, [lx, h, lz], i * 2.39996 + R() * 0.3, lerp(1.3, 0.25, u), lerp(1.2, -1, u), R.range(3.1, 4) * cr * lerp(0.7, 1, u), { w: 0.5, segs: 3, fw: 0 });
  }
});
/* Date palm uprooted by the storm (the island of point B), built into the scenery at (x, z), lying in the direction rot (like Maker.rotY:
   toward (cos rot, -sin rot)): the ball of earth and roots torn from the sand stands on edge at the foot and raises it, the trunk then
   rests on the relief it crosses (the island, its bank, the bottom of the pool), the crown at the far end, its fronds splayed, the
   lowest flattened against the ground (or the bottom, under the water). Looks of PF.palm (h, v: smPalmV), seed: its randomness.
   Collisions: the root ball (1.3 m: cover for a crouching soldier) and the trunk in four sections (0.6 to 0.85 m on the island: you jump
   over it, the bots walk around it), down to the ground under each (no gap over the water) */
function smFallenPalm(x, z, rot, h, seed, v) {
  const M = DECOR, R = rngOf(seed * 7 + 3), S = { ...PALM_KINDS.datePalm, ...v }, g = S.g, L = h * 0.9, c = Math.cos(rot), s = Math.sin(rot);
  const gr = (lx, lz) => gy0(x + lx * c + lz * s, z - lx * s + lz * c); // the sand under a point of the local frame (x along the trunk)
  const rad = (t) => g * (0.245 - 0.085 * t + 0.11 * Math.pow(1 - clamp((t * h) / 0.9, 0, 1), 2.2) + 0.03 * smoothstep(0.88, 1, t));
  const g0 = gr(0, 0), zc = (t) => Math.sin(t * Math.PI) * 0.12 * S.lean;
  // resting height: the highest sand under the width of the trunk, the root ball raising the foot
  const at = (t) => { const lx = 0.25 + t * L, r = rad(t), lz = zc(t), base = Math.max(gr(lx, lz), gr(lx, lz - r * 0.7), gr(lx, lz + r * 0.7)); return [lx, base + r + 0.38 * (1 - smoothstep(0, 0.3, t)) - 0.03, lz]; };
  const ts = []; for (let i = 0; i <= 16; i++) ts.push(i / 16);
  const P = ts.map(at), k = R.range(0.74, 0.96);
  M.save().move(x, 0, z).rotY(rot);
  M.color([k, k * 0.92, k * 0.82]).local(1);
  M.sweep('palmbark', circleShape(1, 10), P, { scale: (f) => rad(ts[Math.round(f * (ts.length - 1))]), uAround: 1 });
  // the root ball, axis along x (lathe turned onto its side), and the torn roots that bristle from its face
  M.color([0.66, 0.5, 0.36]);
  M.save().move(0.05, g0 + 0.62, 0).rotZ(-Math.PI / 2);
  M.lathe('dirt', [[0, -0.45], [0.42, -0.4], [0.68, -0.22], [0.74, 0.02], [0.6, 0.22], [0.3, 0.32], [0, 0.34]], 10, { sharp: 0.9 });
  M.restore();
  M.color([0.48, 0.37, 0.27]);
  for (let i = 0; i < 18; i++) {
    const a = R() * TAU, r0 = R.range(0.1, 0.6), y0 = g0 + 0.62 + Math.sin(a) * r0, z0 = Math.cos(a) * r0, lr = R.range(0.35, 0.85), dy = Math.sin(a) * 0.6, dz = Math.cos(a) * 0.6;
    M.tube('palmbark', 0.028 * R.range(0.7, 1.4), [[-0.3, y0, z0], [-0.3 - lr * 0.55, y0 + dy * lr * 0.55, z0 + dz * lr * 0.55], [-0.3 - lr, Math.max(g0 + 0.04, y0 + dy * lr - 0.22), z0 + dz * lr]], 5);
  }
  // the crown: bulb of frond bases at the tip, fronds splayed forward and to the sides, the low ones lying on the ground (floor), some dry
  const tp = P[P.length - 1], gc = gr(tp[0] + 0.5, tp[2]), c0 = [tp[0] + 0.5, Math.min(tp[1] + 0.05, gc + 0.32), tp[2]];
  M.color([0.6, 0.5, 0.36]);
  M.save().move(tp[0], tp[1], tp[2]).rotZ(-Math.PI / 2 + Math.atan2(c0[1] - tp[1], 0.5));
  M.lathe('palmbark', [[0.2 * g, -0.25], [0.28 * g, 0.1], [0.32 * g, 0.42], [0.24 * g, 0.66], [0.08 * g, 0.8], [0, 0.82]], 8, { sharp: 0.9 });
  M.restore();
  const n = Math.round(S.n * 0.6);
  for (let i = 0; i < n; i++) {
    const u = i / Math.max(1, n - 1), side = i % 2 ? 1 : -1, az = side * lerp(0.1, 2.3, Math.pow(u, 0.8)) + R.range(-0.15, 0.15), dry = R() < 0.3;
    const e0 = lerp(0.9, -0.05, u) + R.range(-0.1, 0.1), e1 = e0 - R.range(0.5, 1.1);
    M.color(dry ? [0.95, 0.84, 0.7] : [R.range(0.88, 1) * S.tint[0], R.range(0.92, 1) * S.tint[1], R.range(0.8, 0.95) * S.tint[2]]);
    palmFrond(M, c0, az, e0, e1, 3.2 * S.c * R.range(0.8, 1.1), { w: 0.48 * Math.sqrt(S.c), segs: 5, fw: 0.8, floor: gc + 0.03, dry, fold: dry ? 0.3 : 0.5 });
  }
  M.col(-0.45, 0.4, g0 - 0.1, g0 + 1.32, -0.72, 0.72, 'wood');
  for (let i = 0; i < 4; i++) {
    const t0 = 0.06 + i * 0.235, t1 = t0 + 0.235, a = at(t0), b = at(t1), r = rad(t0);
    const lo = Math.min(gr(a[0], a[2]), gr(b[0], b[2]), gr((a[0] + b[0]) / 2, (a[2] + b[2]) / 2)) - 0.05;
    M.col(a[0], b[0], lo, Math.max(a[1], b[1]) + r, Math.min(a[2], b[2]) - r, Math.max(a[2], b[2]) + r, 'wood');
  }
  M.restore();
}
/* Well: Notos's (cyWell, 02ye-cyclades-deco.js), on flattened sand: same hollow well (dry-stone curb, shaft down to the water,
   gallows, pulley), same bucket that hangs and swings when touched (hangAdd), same collisions, shots and grenades that go down the
   shaft (HOLES). 1 m shaft (rw 0.5): the relief grid is 1 m, the well is in the middle of a cell (x and z are brought to the center
   of their cell) that reliefMesh skips, the curb covers it. To be placed during map construction, before reliefMesh. */
function smWell(x, z) {
  x = Math.floor(x) + 0.5; z = Math.floor(z) + 0.5;
  cyWell(x, z, { y: reliefFlat(x, z, 1.0, 1.0, 0, { margin: 0.5 }), rw: 0.5, relief: true });
}
/* Rugs drying on a rope stretched between two poles planted in the sand (simulated cloths, heavy: 02mc-cloths.js); the rope at y. Until
   4.6.0, the rope hung between two hooks in the air */
function smRugLine(xa, za, xb, zb, y, R) {
  LINES.push({ k: 'linen', a: [xa, y, za], b: [xb, y, zb] }); lineHooks([xa, y, za], [xb, y, zb]);
  const M = DECOR; M.save().color(SM.palm); M.cls = 1;
  for (const [px, pz] of [[xa, za], [xb, zb]]) { const g = smY(px, pz, 0.1); M.save().move(px, g - 0.1, pz); M.cyl('wood', 0.045, y - g + 0.22, 6); M.restore(); M.col(px - 0.06, px + 0.06, g, y + 0.1, pz - 0.06, pz + 0.06, 'wood'); }
  M.color([0.7, 0.62, 0.5]); M.cls = 2;
  M.tube('plastic', 0.008, sagPath([xa, y, za], [xb, y, zb], 0.18, 10), 3);
  const dx = xb - xa, dz = zb - za, l = hyp(dx, dz), ux = dx / l, uz = dz / l, rugs = [[0.62, 0.14, 0.12], [0.75, 0.42, 0.15], [0.2, 0.25, 0.5], [0.55, 0.2, 0.3], [0.85, 0.75, 0.55]];
  for (let t = 0.2; t < 0.85; t += 0.32) {
    const w = R.range(0.8, 1.1), h = R.range(1.0, 1.4), x = xa + dx * t, z = za + dz * t, yy = y - Math.sin(t * Math.PI) * 0.18;
    M.color(R.pick(rugs));
    clothPiece(M, [x - ux * w / 2, yy - h, z - uz * w / 2], [x + ux * w / 2, yy - h, z + uz * w / 2], [x + ux * w / 2, yy, z + uz * w / 2], [x - ux * w / 2, yy, z - uz * w / 2], [uz, 0, -ux], { clothKind: 'weighted', grp: 'rug' + xa + ',' + za });
  }
  M.restore();
}

/* Handcart (wood, two solid wheels on an axle), resting on its shafts; collisions of the bed and the wheels, and a
   low box under the shafts (you step over it, you no longer bump into it). Shafts fixed under the bed and resting on the ground by their end,
   push bar between them (they used to start from the ground under the bed and rise toward the front); symmetric wheels, with hub */
PF.smCart = () => prefab('smCart', (M) => {
  M.color(SM.wood).local(1);
  M.boxB('wood', -0.7, 0.7, 0.55, 0.62, -1.0, 1.0, { bevel: 0.01 });
  for (const sx of [-1, 1]) M.boxB('wood', sx * 0.7 - 0.04, sx * 0.7 + 0.04, 0.62, 0.95, -1.0, 1.0);
  M.boxB('wood', -0.7, 0.7, 0.62, 0.95, 0.96, 1.0); M.boxB('wood', -0.7, 0.7, 0.62, 0.95, -1.0, -0.96);
  for (const sx of [-1, 1]) M.boxB('wood', sx * 0.45 - 0.05, sx * 0.45 + 0.05, 0.47, 0.55, -0.95, 1.0); // side members under the bed
  const tilt = Math.asin(0.46 / 1.75);
  for (const sx of [-1, 1]) { M.save().move(sx * 0.45, 0.51, 0.95).rotX(tilt); M.boxB('wood', -0.04, 0.04, -0.04, 0.04, 0, 1.75); M.restore(); }
  M.save().move(0.49, 0.51 - Math.sin(tilt) * 1.55, 0.95 + Math.cos(tilt) * 1.55).rotZ(Math.PI / 2); M.cyl('wood', 0.03, 0.98, 8); M.restore(); // push bar
  M.color([0.36, 0.28, 0.2]);
  for (const sx of [-1, 1]) { M.save().move(sx > 0 ? 0.85 : -0.77, 0.45, 0).rotZ(Math.PI / 2); M.cyl('wood', 0.45, 0.08, 16); M.restore(); }
  M.color([0.25, 0.22, 0.2]);
  M.save().move(0.93, 0.45, 0).rotZ(Math.PI / 2); M.cyl('steel', 0.035, 1.86, 8); M.restore(); // axle and hubs
  for (const sx of [-1, 1]) { M.save().move(sx > 0 ? 0.92 : -0.85, 0.45, 0).rotZ(Math.PI / 2); M.cyl('steel', 0.09, 0.07, 10); M.restore(); }
  M.col(-0.75, 0.75, 0, 0.95, -1.0, 1.0, 'wood');
  for (const sx of [-1, 1]) M.col(sx > 0 ? 0.75 : -0.93, sx > 0 ? 0.93 : -0.75, 0, 0.9, -0.42, 0.42, 'wood');
  M.col(-0.5, 0.5, 0, 0.3, 1.0, 2.62, 'wood');
});

/* ---------- Pierced surfaces (airplane windows) ---------- */
/* Windows (256 x 128): on the left, a clear pane, dusty toward the bottom (v = 0) and scratched; on the right, the same one cracked in a star around a hole */
function smGlassTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d'), R = rngOf(4747);
  for (const x0 of [0, 128]) {
    g.save(); g.beginPath(); g.rect(x0, 0, 128, 128); g.clip();
    g.fillStyle = 'rgba(206,220,228,0.14)'; g.fillRect(x0, 0, 128, 128);
    const gr = g.createLinearGradient(0, 0, 0, 70); gr.addColorStop(0, 'rgba(200,172,128,0.5)'); gr.addColorStop(1, 'rgba(200,172,128,0)'); g.fillStyle = gr; g.fillRect(x0, 0, 128, 70);
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(205,180,140,${(0.15 + R() * 0.25).toFixed(2)})`; g.fillRect(x0 + R() * 128, R() * 128 * R(), 1 + R() * 1.5, 1 + R() * 1.5); }
    g.strokeStyle = 'rgba(255,255,255,0.13)'; g.lineWidth = 0.7;
    for (let i = 0; i < 6; i++) { const x = x0 + R() * 128, y = R() * 128, a = R() * Math.PI, l = 10 + R() * 30; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    g.restore();
  }
  // the crack: a halo of shards, star cracks, arcs between them, a jagged hole at the point of impact
  const ix = 198, iy = 74, rays = [];
  g.save(); g.beginPath(); g.rect(128, 0, 128, 128); g.clip();
  g.fillStyle = 'rgba(232,238,238,0.42)'; g.beginPath(); for (let k = 0; k <= 16; k++) { const a = (k / 16) * TAU, r = 24 + R() * 10; g.lineTo(ix + Math.cos(a) * r, iy + Math.sin(a) * r); } g.fill();
  g.strokeStyle = 'rgba(244,248,248,0.8)'; g.lineWidth = 1.1;
  for (let k = 0; k < 11; k++) { const a = (k / 11) * TAU + R() * 0.4; rays.push(a); let x = ix, y = iy; g.beginPath(); g.moveTo(x, y); for (let i = 0; i < 8; i++) { const b = a + (R() - 0.5) * 0.5; x += Math.cos(b) * 16; y += Math.sin(b) * 16; g.lineTo(x, y); } g.stroke(); }
  g.lineWidth = 0.8;
  for (const r of [34, 52, 74]) for (let k = 0; k < 11; k++) if (R() < 0.75) { const a = rays[k], b = rays[(k + 1) % 11], r2 = r + (R() - 0.5) * 8; g.beginPath(); g.moveTo(ix + Math.cos(a) * r, iy + Math.sin(a) * r); g.lineTo(ix + Math.cos(b) * r2, iy + Math.sin(b) * r2); g.stroke(); }
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.beginPath();
  for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU, r = (k % 2 ? 9 : 17) + R() * 7; g.lineTo(ix + Math.cos(a) * r, iy + Math.sin(a) * r); }
  g.fill(); g.restore();
  const t = canvasOnce(new THREE.CanvasTexture(c)); t.encoding = THREE.sRGBEncoding; t.flipY = false; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
/* Rounded rectangle: convex outline counterclockwise in (u, v), center (cu, cv), half-sizes (hu, hv), corners of radii (ru, rv) */
function smRound(cu, cv, hu, hv, ru, rv, n = 4) {
  const pts = [];
  for (let k = 0; k < 4; k++) {
    const su = k === 0 || k === 3 ? 1 : -1, sv = k < 2 ? 1 : -1;
    for (let i = 0; i < n; i++) { const a = ((k + i / (n - 1)) * Math.PI) / 2; pts.push([cu + su * (hu - ru) + ru * Math.cos(a), cv + sv * (hv - rv) + rv * Math.sin(a)]); }
  }
  return { c: [cu, cv], pts };
}
/* Point (x, y) in the convex polygon q, edge included */
function smConvexIn(q, x, y) {
  let pos = 0, neg = 0;
  for (let k = 0; k < q.length; k++) { const a = q[k], b = q[(k + 1) % q.length], c = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]); if (c > 1e-12) pos++; else if (c < -1e-12) neg++; }
  return !(pos && neg);
}
/* Grid surface: vertices f(u, v) at the values us x vs (increasing), normals by finite differences (o.pole at degenerate poles, like
   M.surf), texture coordinates o.uv(u, v) in meters; o.flip: visible face on the -(du x dv) side. Two ways to open windows in it:
   - o.holes: convex outlines { c, pts } (smRound), each in the middle of a single cell, triangulated between its four corners and the outline
     (no extra vertex on its edges: neighboring cells stay joined);
   - o.snap(u, v) -> [u, v] | null sets a vertex near the edge of an opening onto that edge, o.drop(u, v) removes the triangle whose
     center it is: a fine enough grid thus hugs windows of any shape, with no gap between cells. */
function smGrid(M, mat, us, vs, f, o = {}) {
  const nu = us.length, nv = vs.length, eu = (us[nu - 1] - us[0]) * 1e-4, ev = (vs[nv - 1] - vs[0]) * 1e-4, sg = o.flip ? -1 : 1;
  const c = f((us[0] + us[nu - 1]) / 2, (vs[0] + vs[nv - 1]) / 2), B = M.buf(mat, c[0], c[1], c[2]);
  const vert = (u, v) => {
    const a = f(u - eu, v), b = f(u + eu, v), a2 = f(u, v - ev), b2 = f(u, v + ev);
    const ax = b[0] - a[0], ay = b[1] - a[1], az = b[2] - a[2], bx = b2[0] - a2[0], by = b2[1] - a2[1], bz = b2[2] - a2[2];
    let nx = (ay * bz - az * by) * sg, ny = (az * bx - ax * bz) * sg, nz = (ax * by - ay * bx) * sg; const l = hyp3(nx, ny, nz);
    if (l < 1e-12) [nx, ny, nz] = o.pole ? o.pole(u, v) : [0, 1, 0]; else { nx /= l; ny /= l; nz /= l; }
    const p = f(u, v), t = o.uv ? o.uv(u, v) : [u, v]; // f last: the tint it sets (M.tint) is that of the vertex
    return { id: M.v(B, p[0], p[1], p[2], nx, ny, nz, t[0], t[1]), u, v };
  };
  // triangle kept if it turns counterclockwise in (u, v) (fix: turned back that way); degenerate or inside an opening, removed
  const tri = (a, b, d, fix) => {
    let ar = (b.u - a.u) * (d.v - a.v) - (b.v - a.v) * (d.u - a.u);
    if (fix && ar < 0) { [b, d] = [d, b]; ar = -ar; }
    if (ar <= 1e-12 || (o.drop && o.drop((a.u + b.u + d.u) / 3, (a.v + b.v + d.v) / 3))) return;
    if (o.flip) M.tri(B, a.id, d.id, b.id); else M.tri(B, a.id, b.id, d.id);
  };
  const G = [];
  for (const v of vs) for (const u of us) { const q = (o.snap && o.snap(u, v)) || [u, v]; G.push(vert(q[0], q[1])); }
  for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu - 1; i++) {
    const k = j * nu + i, O = [G[k], G[k + 1], G[k + nu + 1], G[k + nu]];
    const h = o.holes && o.holes.find((q) => q.c[0] > us[i] && q.c[0] < us[i + 1] && q.c[1] > vs[j] && q.c[1] < vs[j + 1]);
    if (!h) { tri(O[0], O[1], O[2]); tri(O[0], O[2], O[3]); continue; }
    // ring between the cell and the hole: we go around the center, advancing on whichever of the two edges whose next vertex comes first
    const I = h.pts.map((p) => vert(p[0], p[1])), a0 = Math.atan2(O[0].v - h.c[1], O[0].u - h.c[0]);
    const at = (q) => { let a = Math.atan2(q.v - h.c[1], q.u - h.c[0]) - a0; while (a < 0) a += TAU; while (a >= TAU) a -= TAU; return a; };
    let s0 = 0; for (let m = 1; m < I.length; m++) if (at(I[m]) < at(I[s0])) s0 = m;
    const In = I.map((_, m) => I[(s0 + m) % I.length]), nI = In.length, aO = (m) => (m < 4 ? at(O[m]) : TAU), aI = (m) => (m < nI ? at(In[m]) : TAU + at(In[0]));
    let p = 0, q = 0;
    while (p < 4 || q < nI) {
      if (p < 4 && (q >= nI || aO(p + 1) <= aI(q + 1))) { tri(O[p], O[(p + 1) % 4], In[q % nI], true); p++; }
      else { tri(O[p % 4], In[q], In[(q + 1) % nI], true); q++; }
    }
  }
}
/* Flat fan (center c, outline pts) with normal n; uv optional: [center, then each point of the outline] */
function smFan(M, mat, c, pts, n, uv) {
  const B = M.buf(mat, c[0], c[1], c[2]), vt = (p, k) => M.v(B, p[0], p[1], p[2], n[0], n[1], n[2], uv ? uv[k][0] : 0, uv ? uv[k][1] : 0);
  const ic = vt(c, 0), ids = pts.map((p, k) => vt(p, k + 1)), a = pts[0], b = pts[1];
  const cr = [(a[1] - c[1]) * (b[2] - c[2]) - (a[2] - c[2]) * (b[1] - c[1]), (a[2] - c[2]) * (b[0] - c[0]) - (a[0] - c[0]) * (b[2] - c[2]), (a[0] - c[0]) * (b[1] - c[1]) - (a[1] - c[1]) * (b[0] - c[0])];
  const ok = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] > 0;
  for (let k = 0; k < ids.length; k++) { const i = ids[k], j = ids[(k + 1) % ids.length]; if (ok) M.tri(B, ic, i, j); else M.tri(B, ic, j, i); }
}

/* ---------- The airliner wreck ---------- */
/* Medium-haul twin-engine low-wing jet (4 m diameter fuselage), lying on its belly in the salt flat and broken in two, along x (nose
   toward +x). (cx, y0): the break, the sand under the fuselage; fuselage axis at z = zc (0.5 m at Sirocco: the cabin aisle runs over a
   row of cell centers, where the bots walk). Fuselage of 2 m radius sunk by one meter, floor at y0 + 0.25 (you enter
   level); the doors and exits are 1.2 m, centered on a cell center.
   - Front section (from cx + 2.2 to cx + 14.4): the cabin, 3 + 3 seats (PF.smSeats3) on either side of a 1.2 m aisle, overhead bins
     and their blue trim, ceiling and light strips, open windows (transparent, cracked or missing glass, shade), curtain; front doors
     open on both sides (you pass through), bulkhead and cockpit, nose with an airliner profile and its windshield of six transparent
     panes (one missing, two cracked).
   - Rear section (from cx - 12 to cx): from the break to a bulkhead (cx - 7), overturned seats, luggage, the wing exits open;
     beyond, the fuselage is full of the sand of a dune that rises on its flank: by it you reach the roof (walkable, collision steps
     follow the curve). The raised tail, the blue outro with light bands, the stabilizers.
   - Swept low wings, walkable top, blue winglets; the two engines torn off, lying in the sand in front of the wings.
   Livery without name or marking: white fuselage, blue rear belly and outro. Returns { top } */
function smPlane(cx, y0, R, zc = 0) {
  const M = DECOR, Rf = 2.0, Ri = Rf - 0.07, cy = y0 + 1.0, top = cy + Rf, yf = cy - 0.75, N = makeNoise(3131), Z = (dz) => zc + dz;
  const white = [0.83, 0.84, 0.85], blue = [0.12, 0.22, 0.56], dirt = [0.78, 0.7, 0.6], insul = [0.5, 0.54, 0.46];
  const XF0 = cx + 2.2, XF1 = cx + 14.4, XR0 = cx - 12, XR1 = cx, RB = cx - 7, P = (x, r, th) => [x, cy + r * Math.sin(th), Z(r * Math.cos(th))];
  const jag = (th, s) => (N.fbm(Math.sin(th) * 1.5 + 2.3 + s, Math.abs(Math.cos(th)) * 1.5 + 0.7, 8, 8, 2) - 0.5) * 1.4;
  // openings: front doors, wing exits; 1.2 m, centered on a cell center, threshold at the floor, 1.95 m high
  const thA = Math.asin((yf - 0.05 - cy) / Rf), thB = Math.asin((yf + 1.95 - cy) / Rf), OPEN = [cx + 13.5, cx - 5.5].map((x) => [x - 0.6, x + 0.6]);
  // livery: white, soiled with sand at ground level, blue belly at the rear (a band that rises toward the tail)
  // weathered by the desert: plates dulled by sand, dark streaks under the windows and the joints, dust rising from the belly
  const liv = (x, y) => {
    const b = x < cx - 2 ? smoothstep(0.1, -0.1, y - (cy - 0.45 + (cx - 2 - x) * 0.17)) : 0, d = 1 - smoothstep(y0 - 0.1, y0 + 1.2, y);
    const n = N.fbm(x * 0.21 + 3.1, y * 0.35 + 1.7, 64, 64, 3), st = smoothstep(0.56, 0.8, N.fbm(x * 0.45 + 9.3, y * 0.05 + 0.4, 64, 64, 2)) * smoothstep(cy + 1.7, cy - 0.5, y);
    const dd = Math.max(d * 0.7, (1 - smoothstep(y0 + 0.3, cy + 0.7, y)) * 0.32);
    return [0, 1, 2].map((k) => sl(lerp(lerp(white[k], blue[k], b), dirt[k], dd) * (0.84 + n * 0.24) * (1 - st * 0.36)));
  };
  // windows, level with the rows of seats, glass (clear or cracked) and shade drawn at random; near the breaks, more damage. Never a window
  // without glass: you would see through the hull, which stops bullets (slits.js).
  // Behind the bulkhead of the rear section, the fuselage is full of sand: the glass stays there, opaque, sand-colored
  const winTh = Math.asin((yf + 1.25 - cy) / Rf), inOpen = (x, m = 0.25) => OPEN.some((o) => x > o[0] - m && x < o[1] + m), WINS = [];
  for (const x0 of [XF0 + 1.2, XR0 + 1.0]) for (let x = x0; x <= (x0 > cx ? cx + 11.7 : XR1 - 0.6); x += 0.82) for (const s of [1, -1]) {
    if (inOpen(x)) continue;
    const open = (x > XF0 && x < XF1) || (x > RB + 0.25 && x < XR1), near = Math.min(Math.abs(x - XF0), Math.abs(x - XR1)) < 2.6, r = R();
    WINS.push({ x, s, th: s > 0 ? winTh : Math.PI - winTh, open, glass: !open ? 'sand' : r < (near ? 0.7 : 0.25) ? 'crack' : 'ok', shade: R() });
  }
  // opening of a window [half-width, half-height as an angle, corner radius]: in the skin and the insulation (HO), larger in the cabin
  // lining (HL: the reveal flares toward the inside)
  const HO = [0.115, 0.165 / Rf, 0.085], HL = [0.155, 0.215 / 1.84, 0.1], hole = (w, r, H) => smRound(w.x, w.th, H[0], H[1], H[2], H[2] / r);
  // columns of a piece [a, b]: one 0.82 m cell per open window (the window in the middle), elsewhere at most every `step` m
  const cols = (a, b, ws, step) => {
    const xs = [a, b, ...ws.flatMap((w) => [w.x - 0.41, w.x + 0.41])].map((x) => clamp(x, a, b)).sort((p, q) => p - q), us = [a];
    for (const q of xs) { const p = us[us.length - 1]; if (q - p < 0.02) continue; const n = ws.some((w) => Math.abs((p + q) / 2 - w.x) < 0.3) ? 1 : Math.max(1, Math.round((q - p) / step)); for (let m = 1; m <= n; m++) us.push(p + ((q - p) * m) / n); }
    return us;
  };
  // rows of the hull (every 0.12 rad at most), common to all the pieces; the band of windows fits in a single row
  const ROWS = (() => {
    const k = [-Math.PI / 2, 1.5 * Math.PI, thA, thB, Math.PI - thB, Math.PI - thA, winTh - 0.12, winTh + 0.12, Math.PI - winTh - 0.12, Math.PI - winTh + 0.12].sort((p, q) => p - q), out = [k[0]];
    for (let i = 1; i < k.length; i++) { const p = k[i - 1], q = k[i], band = Math.abs((p + q) / 2 - winTh) < 1e-6 || Math.abs((p + q) / 2 - Math.PI + winTh) < 1e-6, n = band ? 1 : Math.max(1, Math.ceil((q - p) / 0.12)); for (let m = 1; m <= n; m++) out.push(p + ((q - p) * m) / n); }
    return out;
  })();
  // hull of a piece [a, b], from rows t0 to t1: skin (livery) and lining (insulation), pierced at the open windows; at the breaks (ja, jb),
  // the end cell folds onto the jagged edge
  const hull = (a, b, ja, jb, t0, t1) => {
    const ws = WINS.filter((w) => w.open && w.x > a && w.x < b), us = cols(a, b, ws, 0.6), vs = ROWS.filter((t) => t > t0 - 1e-9 && t < t1 + 1e-9), n = us.length;
    const X = (x, th) => x + (ja ? jag(th, 0) * Math.max(0, 1 - (x - us[0]) / (us[1] - us[0])) : 0) + (jb ? jag(th, 5) * Math.max(0, 1 - (us[n - 1] - x) / (us[n - 1] - us[n - 2])) : 0);
    const holes = ws.filter((w) => w.th > t0 && w.th < t1).map((w) => hole(w, Rf, HO));
    for (const [r, inner] of [[Rf, false], [Ri, true]]) {
      M.save().local(1); M.cls = 0; M.color(insul);
      smGrid(M, 'hull', us, vs, (x, th) => { const p = P(X(x, th), r, th); if (!inner) M.tint = liv(p[0], p[1]); return p; }, { flip: inner, uv: (x, th) => [x, th * r], holes });
      M.restore();
    }
  };
  // a section: the hull cut out around the openings (both sides at once)
  const tube = (x0, x1, j0, j1) => {
    const cuts = [x0, x1, ...OPEN.flat().filter((x) => x > x0 && x < x1)].sort((a, b) => a - b);
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i], b = cuts[i + 1], open = OPEN.some((o) => a >= o[0] - 1e-6 && b <= o[1] + 1e-6), ja = j0 && a === x0, jb = j1 && b === x1;
      if (!open) { hull(a, b, ja, jb, -Math.PI / 2, 1.5 * Math.PI); continue; }
      hull(a, b, ja, jb, -Math.PI / 2, thA); hull(a, b, ja, jb, thB, Math.PI - thB); hull(a, b, ja, jb, Math.PI - thA, 1.5 * Math.PI);
    }
  };
  tube(XR0, XR1, false, true); tube(XF0, XF1, true, false);
  // the windows: reveal (from skin to insulation, then flared out to the cabin lining), glass, shade of variable height
  const ring = (w, H, rH, r) => hole(w, rH, H).pts.map(([x, t]) => P(x, r, t));
  M.save().local(1);
  for (const w of WINS) {
    const out = [0, Math.sin(w.th), Math.cos(w.th)], cen = (r) => P(w.x, r, w.th);
    if (!w.open) { M.cls = 1; M.color([0.58, 0.47, 0.34]); smFan(M, 'glass', cen(Rf + 0.004), ring(w, HO, Rf, Rf + 0.004), out); continue; }
    const A0 = ring(w, HO, Rf, Rf), A1 = ring(w, HO, Rf, Ri), A2 = ring(w, HL, 1.84, 1.84);
    for (const [S0, S1, col] of [[A0, A1, [0.66, 0.68, 0.7]], [A1, A2, [0.86, 0.86, 0.84]]]) {
      M.cls = 1; M.color(col);
      for (let k = 0; k < S0.length; k++) {
        const k1 = (k + 1) % S0.length, m = [0, 1, 2].map((i) => (S0[k][i] + S0[k1][i] + S1[k][i] + S1[k1][i]) / 4), c = cen(hyp(m[1] - cy, m[2] - Z(0)));
        M.quad('cabin', S0[k], S0[k1], S1[k1], S1[k], [c[0] - m[0], c[1] - m[1], c[2] - m[2]]);
      }
    }
    if (w.glass !== 'none') {
      const pts = hole(w, Rf, HO).pts, tile = w.glass === 'crack' ? 0.5 : 0, uv = (x, t) => [tile + (0.5 * (x - w.x + HO[0])) / (2 * HO[0]), 0.5 + (w.s * (t - w.th)) / (2 * HO[1])];
      M.cls = 1; M.color([0.82, 0.88, 0.9]);
      smFan(M, 'glassAir', cen(Rf - 0.03), pts.map(([x, t]) => P(x, Rf - 0.03, t)), out, [uv(w.x, w.th), ...pts.map(([x, t]) => uv(x, t))]);
    }
    const f = w.shade < 0.4 ? 0 : w.shade < 0.75 ? 0.5 : 0.96; // shade raised, half lowered, closed
    if (f) {
      const t0 = w.th + w.s * 0.125, t1 = t0 - w.s * 0.25 * f, q = [P(w.x - 0.15, 1.87, t0), P(w.x + 0.15, 1.87, t0), P(w.x + 0.15, 1.87, t1), P(w.x - 0.15, 1.87, t1)];
      M.cls = 1; M.color([0.9, 0.9, 0.88]); M.quad('cabin', ...q, out.map((v) => -v)); M.quad('cabin', ...q, out);
    }
  }
  M.restore();
  // cabin: floor, aisle carpet, white lining of the walls, overhead bins, ceiling and its light strips, bulkheads
  const thLo = Math.asin((yf + 0.04 - cy) / 1.84), thHi = Math.asin((yf + 1.56 - cy) / 1.84);
  for (const [a, b] of [[RB, XR1], [XF0, XF1 - 0.12]]) {
    M.save().local(1); M.cls = 1; // the interior casts no shadow in the sun (the hull takes care of that)
    M.color([0.24, 0.25, 0.27]); M.boxB('cabin', a, b, yf - 0.12, yf, Z(-1.8), Z(1.8), { skip: 'y' });
    M.color([0.16, 0.19, 0.32]); M.boxB('canvas', a + 0.3, b - 0.1, yf, yf + 0.008, Z(-0.5), Z(0.5), { skip: 'y' });
    DECOR.col(a, b, yf - 0.5, yf, Z(-1.9), Z(1.9), 'metal');
    // lining, cut at the openings
    const segs = [[a, b]]; for (const o of OPEN) for (let i = segs.length - 1; i >= 0; i--) { const sg = segs[i]; if (o[1] <= sg[0] || o[0] >= sg[1]) continue; segs.splice(i, 1, ...[[sg[0], o[0]], [o[1], sg[1]]].filter((p) => p[1] - p[0] > 0.05)); }
    M.color([0.9, 0.9, 0.88]);
    const seg = (p, q) => { const n = Math.max(1, Math.ceil((q - p) / 0.13)); return Array.from({ length: n }, (_, k) => lerp(p, q, (k + 1) / n)); };
    for (const [s0, s1] of segs) for (const s of [1, -1]) {
      const c = s > 0 ? winTh : Math.PI - winTh, t0 = s > 0 ? thLo : Math.PI - thHi, t1 = s > 0 ? thHi : Math.PI - thLo, ws = WINS.filter((w) => w.open && w.s === s && w.x > s0 && w.x < s1);
      smGrid(M, 'cabin', cols(s0, s1, ws, 0.8), [t0, ...seg(t0, c - 0.15), c + 0.15, ...seg(c + 0.15, t1)], (x, t) => P(x, 1.84, t), { flip: true, uv: (x, t) => [x, t * 1.84], holes: ws.map((w) => hole(w, 1.84, HL)) });
    }
    // bins: underside, curved face, blue trim underneath along the edge, handles; not above the doors
    const bins = []; for (const [s0, s1] of segs) { const c0 = s0 + 0.15, c1 = s1 - 0.15; if (c1 - c0 > 0.6) bins.push([c0, c1]); }
    for (const [b0, b1] of bins) for (const s of [1, -1]) {
      const zz = (d) => Z(s * d), A = [1.08, yf + 1.55], Bm = [1.0, yf + 1.8], C = [1.04, yf + 2.05], D = [1.45, yf + 2.05], E = [1.72, yf + 1.55], pt = (x, p) => [x, p[1], zz(p[0])];
      M.color([0.93, 0.93, 0.92]);
      M.quad('cabin', pt(b0, A), pt(b1, A), pt(b1, E), pt(b0, E), [0, -1, 0]);
      M.quad('cabin', pt(b0, A), pt(b1, A), pt(b1, Bm), pt(b0, Bm), [0, -0.3, -s]);
      M.quad('cabin', pt(b0, Bm), pt(b1, Bm), pt(b1, C), pt(b0, C), [0, 0.15, -s]);
      M.quad('cabin', pt(b0, C), pt(b1, C), pt(b1, [1.04, yf + 2.2]), pt(b0, [1.04, yf + 2.2]), [0, 0, -s]);
      for (const xe of [b0, b1]) { const n = [xe === b0 ? -1 : 1, 0, 0]; M.quad('cabin', pt(xe, A), pt(xe, Bm), pt(xe, C), pt(xe, D), n); M.tri3('cabin', pt(xe, A), pt(xe, D), pt(xe, E), n); }
      M.color([0.35, 0.72, 1.0]); M.quad('lampOff', [b0, yf + 1.544, zz(1.09)], [b1, yf + 1.544, zz(1.09)], [b1, yf + 1.544, zz(1.16)], [b0, yf + 1.544, zz(1.16)], [0, -1, 0]);
      { const t0 = Math.asin((yf + 1.47 - cy) / 1.828), t1 = Math.asin((yf + 1.53 - cy) / 1.828), w = (x, t) => P(x, 1.828, s > 0 ? t : Math.PI - t); M.quad('lampOff', w(b0, t0), w(b1, t0), w(b1, t1), w(b0, t1), [0, 0, -s]); } // the blue light under the bins
      M.color([0.62, 0.63, 0.64]); M.quad('cabin', [b0, yf + 1.546, zz(1.075)], [b1, yf + 1.546, zz(1.075)], [b1, yf + 1.546, zz(1.09)], [b0, yf + 1.546, zz(1.09)], [0, -1, 0]);
      M.color([0.55, 0.56, 0.57]);
      for (let x = b0 + 0.82; x < b1 - 0.1; x += 1.64) M.quad('cabin', [x - 0.008, yf + 1.555, zz(1.072)], [x + 0.008, yf + 1.555, zz(1.072)], [x + 0.008, yf + 1.79, zz(0.997)], [x - 0.008, yf + 1.79, zz(0.997)], [0, -0.3, -s]);
      M.color([0.42, 0.43, 0.45]);
      for (let x = b0 + 0.41; x < b1 - 0.1; x += 0.82) M.boxB('cabin', x - 0.08, x + 0.08, yf + 1.78, yf + 1.82, zz(0.985) - 0.02, zz(0.985) + 0.02);
      // service panels under the bins, above each row: reading lights and air vents
      for (let x = b0 + 0.25; x < b1 - 0.4; x += 0.82) {
        M.color([0.78, 0.79, 0.8]); M.quad('cabin', [x, yf + 1.543, zz(1.2)], [x + 0.36, yf + 1.543, zz(1.2)], [x + 0.36, yf + 1.543, zz(1.5)], [x, yf + 1.543, zz(1.5)], [0, -1, 0]);
        M.color([1, 0.96, 0.85]); for (const d of [1.26, 1.36, 1.46]) M.quad('lampOff', [x + 0.08, yf + 1.539, zz(d - 0.025)], [x + 0.13, yf + 1.539, zz(d - 0.025)], [x + 0.13, yf + 1.539, zz(d + 0.025)], [x + 0.08, yf + 1.539, zz(d + 0.025)], [0, -1, 0]);
      }
    }
    // ceiling and light strip in the middle
    M.color([0.95, 0.95, 0.94]); M.quad('cabin', [a, yf + 2.2, Z(-1.04)], [b, yf + 2.2, Z(-1.04)], [b, yf + 2.2, Z(1.04)], [a, yf + 2.2, Z(1.04)], [0, -1, 0]);
    M.color([1, 0.97, 0.9]);
    for (let x = a + 0.4; x < b - 0.9; x += 1.64) M.quad('lampOff', [x, yf + 2.192, Z(-0.14)], [x + 1.3, yf + 2.192, Z(-0.14)], [x + 1.3, yf + 2.192, Z(0.14)], [x, yf + 2.192, Z(0.14)], [0, -1, 0]);
    M.restore();
  }
  // bulkheads: the cockpit's (door closed), the one at the back of the rear section (behind it, the tail is full of sand); the
  // emergency exit sign in green above the doors
  const bulk = (x, nx, door) => {
    M.save().local(1); M.cls = 1; M.color([0.88, 0.88, 0.86]);
    M.surf('cabin', 1, 24, (u, v) => P(x, u * Ri, v * TAU), { uL: Ri, vL: TAU * Ri, flipN: nx > 0 });
    M.color([0.42, 0.44, 0.48]); M.quad('cabin', [x + nx * 0.01, yf, Z(-0.42)], [x + nx * 0.01, yf, Z(0.42)], [x + nx * 0.01, yf + 1.92, Z(0.42)], [x + nx * 0.01, yf + 1.92, Z(-0.42)], [nx, 0, 0]);
    if (door) { M.color([0.12, 0.13, 0.15]); M.quad('cabin', [x + nx * 0.016, yf + 1.4, Z(-0.08)], [x + nx * 0.016, yf + 1.4, Z(0.08)], [x + nx * 0.016, yf + 1.58, Z(0.08)], [x + nx * 0.016, yf + 1.58, Z(-0.08)], [nx, 0, 0]); }
    M.color([0.1, 0.72, 0.32]); M.boxB('lampOff', x + nx * 0.02 - 0.015, x + nx * 0.02 + 0.015, yf + 2.0, yf + 2.13, Z(-0.2), Z(0.2));
    M.restore();
    DECOR.col(Math.min(x, x - nx * 0.15), Math.max(x, x - nx * 0.15), yf, top - 0.75, Z(-1.9), Z(1.9), 'metal');
  };
  bulk(XF1 - 0.12, -1, true); bulk(RB, 1, false);
  for (const [a, b] of OPEN) { M.save().local(1); M.color([0.1, 0.72, 0.32]); M.boxB('lampOff', (a + b) / 2 - 0.18, (a + b) / 2 + 0.18, yf + 2.06, yf + 2.17, Z(0.98), Z(1.0)); M.boxB('lampOff', (a + b) / 2 - 0.18, (a + b) / 2 + 0.18, yf + 2.06, yf + 2.17, Z(-1.0), Z(-0.98)); M.restore(); }
  // 3 + 3 seats of the front cabin (11 rows); at the rear, one block left in place, two overturned, luggage near the break
  // (fine details: hidden at a distance, only seen up close, through the doors and the break)
  for (let x = XF0 + 1.2; x <= cx + 11.7; x += 0.82) for (const s of [1, -1]) M.place(PF.smSeats3(), x, yf, Z(s * 1.19), 0, { cls: 2 });
  M.place(PF.smSeats3(), RB + 0.4, yf, Z(1.19), 0, { cls: 2 });
  for (const [x, dz, ry, rz] of [[cx - 3.4, 0.75, 0.25, Math.PI / 2], [cx - 1.6, -0.6, -0.2, -Math.PI / 2]]) { M.save().move(x, yf + 0.6, Z(dz)).rotY(ry).rotX(rz); M.put(PF.smSeats3(), { cls: 2 }); M.restore(); }
  M.save().move(cx + 1.0, smY(cx + 1.0, Z(3.6), 0.8) + 0.42, Z(3.6)).rotY(2.2).rotZ(Math.PI / 2); M.put(PF.smSeats3()); M.restore();
  const bags = [[cx - 4.6, -0.9, 0.3], [cx - 3.0, -0.2, 2.1], [cx - 1.0, 1.2, 0.9], [cx + 2.6, 1.0, 1.4], [cx + 0.8, -2.6, 0.2], [cx + 1.6, 2.2, 2.6], [cx - 1.0, -3.4, 1.1]];
  bags.forEach(([x, dz, ry], i) => {
    const inside = Math.abs(dz) < 1.8 && (x > RB && x < XR1 || x > XF0 && x < XF1), y = inside ? yf : smY(x, Z(dz), 0.4) + 0.02;
    M.save().local(1).move(x, y, Z(dz)).rotY(ry); M.color([[0.12, 0.16, 0.3], [0.5, 0.12, 0.1], [0.24, 0.25, 0.27], [0.36, 0.38, 0.28]][i % 4]);
    M.boxB('cabin', -0.34, 0.34, 0, 0.24, -0.23, 0.23, { bevel: 0.04 }); M.color([0.15, 0.15, 0.16]); M.boxB('rubber', -0.1, 0.1, 0.24, 0.27, -0.02, 0.02);
    M.col(-0.34, 0.34, 0, 0.24, -0.23, 0.23, 'wood'); M.restore();
  });
  // curtain drawn at the edge of the aisle, on its rod
  M.save().local(1); M.cls = 1; M.color([0.12, 0.15, 0.26]);
  for (let i = 0; i < 8; i++) { const x0 = cx + 6.98 + i * 0.025, z0 = Z(-0.56 - (i % 2) * 0.04), z1 = Z(-0.56 - ((i + 1) % 2) * 0.04); M.quad('canvas', [x0, yf + 0.06, z0], [x0 + 0.025, yf + 0.06, z1], [x0 + 0.025, yf + 2.16, z1], [x0, yf + 2.16, z0], [0, 0, -1]); }
  M.color([0.6, 0.6, 0.62]); M.boxB('steel', cx + 6.96, cx + 7.2, yf + 2.16, yf + 2.19, Z(-1.0), Z(-0.55));
  M.restore();
  // open doors, folded forward along the fuselage; cables hanging at the break
  M.save().local(1); M.cls = 1;
  for (const [, b] of [OPEN[0]]) for (const s of [1, -1]) {
    M.color(white); M.boxB('hull', b + 0.15, b + 1.05, yf - 0.02, yf + 1.92, Z(s * 2.32) - 0.06, Z(s * 2.32) + 0.06, { bevel: 0.03 }); DECOR.col(b + 0.15, b + 1.05, yf - 0.02, yf + 1.92, Z(s * 2.32) - 0.06, Z(s * 2.32) + 0.06, 'metal');
    M.color([0.6, 0.62, 0.62]); M.boxB('steel', b + 0.05, b + 0.2, yf + 0.9, yf + 1.0, Z(s * 2.05), Z(s * 2.27));
  }
  M.color([0.16, 0.16, 0.17]);
  for (const [x, sx] of [[XR1, 1], [XF0, -1]]) for (const dz of [-0.7, 0.2, 0.9]) M.tube('rubber', 0.012, [[x - sx * 0.1, yf + 2.15, Z(dz)], [x + sx * 0.25, yf + 1.5, Z(dz + 0.1)], [x + sx * 0.35, yf + 0.9, Z(dz + 0.05)]], 4);
  M.restore();
  // fuselage collisions: walls (open at the doors), roof in steps that follow the curve (walkable)
  for (const [a, b] of [[XR0, XR1], [XF0, XF1]]) {
    for (const s of [-1, 1]) {
      const z0 = Z(s > 0 ? 1.85 : -2.1), z1 = Z(s > 0 ? 2.1 : -1.85), cuts = [a, b, ...OPEN.flat().filter((x) => x > a && x < b)].sort((p, q) => p - q);
      for (let i = 0; i < cuts.length - 1; i++) { const p = cuts[i], q = cuts[i + 1], open = OPEN.some((o) => p >= o[0] - 1e-6 && q <= o[1] + 1e-6); DECOR.col(p, q, open ? yf + 1.95 : yf, cy + 1.25, z0, z1, 'metal'); }
    }
    for (const [d0, d1, h] of [[0, 0.75, top - 0.05], [0.75, 1.3, cy + Math.sqrt(Rf * Rf - 1)], [1.3, 1.75, cy + Math.sqrt(Rf * Rf - 2.25)]]) {
      if (d0 === 0) DECOR.col(a, b, cy + 1.25, h, Z(-d1), Z(d1), 'metal');
      else for (const s of [-1, 1]) DECOR.col(a, b, cy + 1.25, h, Math.min(Z(s * d0), Z(s * d1)), Math.max(Z(s * d0), Z(s * d1)), 'metal');
    }
  }
  // nose: airliner profile. The radome points below the axis, the top descends through the windshield, the chin rises; elliptical sections.
  // d: distance from the tip; table [d, top, bottom, half-width] (relative to the axis), read as √d to round off the tip (keyM, 06d-reload.js)
  const NL = 5.2, NK = [[0, -0.5, -0.5, 0], [0.25, -0.12, -0.85, 0.42], [0.6, 0.2, -1.1, 0.72], [1, 0.45, -1.3, 0.98], [1.4, 0.72, -1.47, 1.2],
    [1.8, 1.05, -1.62, 1.42], [2.2, 1.38, -1.73, 1.6], [2.6, 1.62, -1.82, 1.74], [3, 1.78, -1.88, 1.85], [3.5, 1.9, -1.94, 1.93], [4.2, 1.97, -1.98, 1.98],
    [5.2, Rf, -Rf, Rf]].map((k) => [Math.sqrt(k[0]), k[1], k[2], k[3]]);
  const sec = (d) => { const k = keyM(NK, Math.sqrt(Math.max(0, d))); return { yc: cy + (k[0] + k[1]) / 2, ry: (k[0] - k[1]) / 2, rz: k[2] }; };
  const NP = (d, th, dr = 0) => { const s = sec(d); return [XF1 + NL - d, s.yc + (s.ry + dr) * Math.sin(th), Z((s.rz + dr) * Math.cos(th))]; };
  // cockpit windows: the windshield in two, then the sliding window and the rear window on each side. A corner is [d, angle from the
  // top]; Wp takes it seen from the side (d, height on the axis), the edges of neighboring panes follow the same post (13 cm) offset by g
  const Wp = (d, y) => { const s = sec(d); return [d, Math.PI / 2 - Math.asin(clamp((cy + y - s.yc) / s.ry, -1, 1))]; }, g = 0.045;
  const A = Wp(1.7, 0.55), B = Wp(2.45, 1.2), C = Wp(2.95, 0.55), D = Wp(2.95, 1.28), sh = (p, dd, da) => [p[0] + dd, p[1] + da];
  const PANES = [[[1.45, g], sh(A, 0, -g), sh(B, 0, -g), [2.13, g]], [sh(A, 0, g), sh(C, -0.065, 0), sh(D, -0.065, 0), sh(B, 0, g)], [sh(C, 0.065, 0), Wp(3.55, 0.6), Wp(3.4, 1.16), sh(D, 0.065, 0)]];
  const onNose = (q, s, dr) => (u, v) => { const lo = [lerp(q[0][0], q[1][0], u), lerp(q[0][1], q[1][1], u)], hi = [lerp(q[3][0], q[2][0], u), lerp(q[3][1], q[2][1], u)]; return NP(lerp(lo[0], hi[0], v), Math.PI / 2 - s * lerp(lo[1], hi[1], v), dr); };
  const inward = (f) => { // true if the normal of f (du x dv) points into the hull
    const p = f(0.5, 0.5), a = f(0.6, 0.5), b = f(0.5, 0.6), c = sec(XF1 + NL - p[0]), u = [a[0] - p[0], a[1] - p[1], a[2] - p[2]], v = [b[0] - p[0], b[1] - p[1], b[2] - p[2]];
    return (u[2] * v[0] - u[0] * v[2]) * (p[1] - c.yc) + (u[0] * v[1] - u[1] * v[0]) * (p[2] - Z(0)) < 0;
  };
  // nose hull and cockpit lining: 9 cm grid around the windows; a vertex within 6.6 cm of a window's edge is set onto it, a
  // triangle whose center is in a window is dropped. PN: the six windows as (d, signed angle from the top, + side +z), distances with
  // the angle x 1.5 (the cockpit's mean radius)
  const PN = [1, -1].flatMap((s) => PANES.map((q) => q.map(([d, a]) => [d, s * a]))), KF = 1.5, thr = 0.066;
  const nSnap = (d, th) => {
    const a = Math.PI / 2 - th; if (d < 1.2 || d > 3.9 || Math.abs(a) > 1.4) return null;
    let best = thr, out = null;
    for (const q of PN) for (const c of q) { const e = hyp(d - c[0], (a - c[1]) * KF); if (e < best) { best = e; out = c; } }
    if (!out) for (const q of PN) for (let k = 0; k < 4; k++) {
      const p = q[k], r = q[(k + 1) % 4], ex = r[0] - p[0], ey = (r[1] - p[1]) * KF, t = clamp(((d - p[0]) * ex + (a - p[1]) * KF * ey) / (ex * ex + ey * ey), 0, 1);
      const x = p[0] + ex * t, y = p[1] + (r[1] - p[1]) * t, e = hyp(d - x, (a - y) * KF);
      if (e < best) { best = e; out = [x, y]; }
    }
    return out && [out[0], Math.PI / 2 - out[1]];
  };
  const nDrop = (d, th) => PN.some((q) => smConvexIn(q, d, Math.PI / 2 - th)), NU = [], NV = [], T0 = Math.PI / 2 - 1.35, T1 = Math.PI / 2 + 1.35;
  for (let k = 0; k <= 7; k++) NU.push(1.3 * (k / 7) ** 2);
  for (let k = 1; k <= 29; k++) NU.push(1.3 + (2.55 * k) / 29);
  for (let k = 1; k <= 5; k++) NU.push(3.85 + ((NL - 3.85) * k) / 5);
  for (let k = 0; k < 9; k++) NV.push(-Math.PI / 2 + ((T0 + Math.PI / 2) * k) / 9);
  for (let k = 0; k < 45; k++) NV.push(T0 + ((T1 - T0) * k) / 45);
  for (let k = 0; k <= 9; k++) NV.push(T1 + ((1.5 * Math.PI - T1) * k) / 9);
  M.save().local(1); M.cls = 0;
  smGrid(M, 'hull', NU, NV, (d, th) => { const p = NP(d, th); M.tint = liv(p[0], p[1]); return p; }, { flip: true, snap: nSnap, drop: nDrop, uv: (d, th) => [NL - d, (th + Math.PI / 2) * Rf], pole: () => [0.98, -0.2, 0] });
  M.cls = 1; M.color([0.42, 0.45, 0.48]);
  smGrid(M, 'cabin', NU.filter((d) => d > 0.9), NV.filter((th) => th > -0.8 && th < Math.PI + 0.8), (d, th) => NP(d, th, -0.05), { snap: nSnap, drop: nDrop });
  // window reveals (from hull to lining); transparent windows: the left sliding one is gone, two others are cracked
  M.color([0.3, 0.31, 0.33]);
  for (const q of PN) {
    const mc = [0, 1].map((i) => (q[0][i] + q[1][i] + q[2][i] + q[3][i]) / 4), at = (e, dr) => NP(e[0], Math.PI / 2 - e[1], dr);
    for (let k = 0; k < 4; k++) {
      const p = q[k], r = q[(k + 1) % 4], n = Math.max(1, Math.ceil(hyp(r[0] - p[0], (r[1] - p[1]) * KF) / 0.08));
      for (let i = 0; i < n; i++) {
        const e0 = [lerp(p[0], r[0], i / n), lerp(p[1], r[1], i / n)], e1 = [lerp(p[0], r[0], (i + 1) / n), lerp(p[1], r[1], (i + 1) / n)], em = [(e0[0] + e1[0]) / 2, (e0[1] + e1[1]) / 2];
        const m = at(em, -0.025), c = at([lerp(em[0], mc[0], 0.2), lerp(em[1], mc[1], 0.2)], -0.025);
        M.quad('cabin', at(e0, 0), at(e1, 0), at(e1, -0.05), at(e0, -0.05), [c[0] - m[0], c[1] - m[1], c[2] - m[2]]);
      }
    }
  }
  const PST = ['ok', 'ok', 'crack', 'crack', 'none', 'ok']; // in the order of PN: +z side (windshield, sliding, rear), then -z side
  M.color([0.8, 0.87, 0.88]);
  PN.forEach((q, i) => { if (PST[i] === 'none') return; const f = onNose(q, 1, -0.02); M.uvO = [PST[i] === 'crack' ? 0.5 : 0, 0]; M.surf('glassAir', 4, 4, f, { uL: 0.5, vL: 1, flipN: inward(f) }); });
  M.uvO = [0, 0];
  // wipers at rest, probes under the side windows
  M.cls = 2;
  for (const s of [-1, 1]) {
    M.color([0.12, 0.12, 0.13]); M.tube('rubber', 0.014, [NP(1.6, Math.PI / 2 - s * 0.62, 0.035), NP(1.52, Math.PI / 2 - s * 0.36, 0.035), NP(1.5, Math.PI / 2 - s * 0.14, 0.035)], 4);
    M.color([0.55, 0.56, 0.58]);
    for (const [d, y] of [[2.3, -0.2], [2.65, -0.45]]) { const th = Math.PI / 2 - s * Wp(d, y)[1]; M.tube('steel', 0.016, [NP(d, th, -0.02), NP(d - 0.16, th, 0.07)], 4); }
  }
  M.restore();
  // the cockpit, seen through the windows: floor, black glare shield above the dashboard and its dark screens, center console,
  // two seats, ceiling panel, bulkhead and back door
  const xd = (d) => XF1 + NL - d, wz = (d, y) => { const c = sec(d), t = (y - c.yc) / (c.ry - 0.06); return Math.abs(t) >= 1 ? 0 : (c.rz - 0.06) * Math.sqrt(1 - t * t); };
  const strip = (d0, d1, y, n) => { for (let i = 0; i < n; i++) { const a = lerp(d0, d1, i / n), b = lerp(d0, d1, (i + 1) / n), wa = wz(a, y), wb = wz(b, y); if (wa + wb > 0.02) M.quad('cabin', [xd(a), y, Z(-wa)], [xd(b), y, Z(-wb)], [xd(b), y, Z(wb)], [xd(a), y, Z(wa)], [0, 1, 0]); } };
  const yg = cy + 0.5, xp = xd(1.98);
  M.save().local(1); M.cls = 1;
  M.color([0.2, 0.21, 0.22]); strip(1.9, NL + 0.12, yf, 8);
  M.color([0.07, 0.075, 0.08]); strip(0.95, 2.05, yg, 6);
  { const w = wz(2.05, yg); M.quad('cabin', [xd(2.05), yg - 0.12, Z(-w)], [xd(2.05), yg - 0.12, Z(w)], [xd(2.05), yg, Z(w)], [xd(2.05), yg, Z(-w)], [-1, 0, 0]); }
  M.color([0.15, 0.16, 0.18]);
  for (let i = 0; i < 4; i++) { const y0 = lerp(yf, yg - 0.12, i / 4), y1 = lerp(yf, yg - 0.12, (i + 1) / 4), w0 = wz(1.98, y0), w1 = wz(1.98, y1); M.quad('cabin', [xp, y0, Z(-w0)], [xp, y0, Z(w0)], [xp, y1, Z(w1)], [xp, y1, Z(-w1)], [-1, 0, 0]); }
  M.cls = 2; M.color([0.035, 0.04, 0.045]);
  for (const [z, y] of [[-0.8, 0.15], [-0.52, 0.15], [0, 0.18], [0, -0.06], [0.52, 0.15], [0.8, 0.15]]) M.quad('glass', [xp - 0.006, cy + y - 0.09, Z(z - 0.1)], [xp - 0.006, cy + y - 0.09, Z(z + 0.1)], [xp - 0.006, cy + y + 0.09, Z(z + 0.1)], [xp - 0.006, cy + y + 0.09, Z(z - 0.1)], [-1, 0, 0]);
  M.color([0.2, 0.21, 0.23]); M.boxB('cabin', xd(2.95), xp, yf, cy - 0.22, Z(-0.2), Z(0.2));
  M.color([0.55, 0.56, 0.58]); for (const z of [-0.06, 0.06]) M.boxB('cabin', xd(2.2) - 0.03, xd(2.2) + 0.03, cy - 0.22, cy - 0.06, Z(z) - 0.015, Z(z) + 0.015);
  M.cls = 1; M.color([0.22, 0.24, 0.27]);
  const ov = (u, v, dr) => NP(lerp(2.45, 3.3, u), Math.PI / 2 + lerp(-0.32, 0.32, v), dr);
  { const f = (u, v) => ov(u, v, -0.075); M.surf('cabin', 3, 3, f, { uL: 1, vL: 1, flipN: !inward(f) }); }
  M.cls = 2; M.color([0.75, 0.76, 0.78]);
  for (let i = 0; i < 4; i++) for (let k = 0; k < 7; k++) { const f = (a, b) => ov(0.12 + i * 0.22 + a * 0.06, 0.08 + k * 0.135 + b * 0.05, -0.08); M.surf('cabin', 1, 1, f, { uL: 1, vL: 1, flipN: !inward(f) }); }
  M.cls = 1; M.color([0.36, 0.38, 0.41]);
  M.surf('cabin', 1, 24, (u, v) => P(XF1 - 0.1, u * Ri, v * TAU), { uL: Ri, vL: TAU * Ri, flipN: true, pole: () => [1, 0, 0] });
  M.color([0.28, 0.3, 0.33]); M.quad('cabin', [XF1 - 0.094, yf, Z(-0.42)], [XF1 - 0.094, yf, Z(0.42)], [XF1 - 0.094, yf + 1.92, Z(0.42)], [XF1 - 0.094, yf + 1.92, Z(-0.42)], [1, 0, 0]);
  M.restore();
  for (const s of [1, -1]) M.place(PF.smPilotSeat(), xd(2.8), yf, Z(s * 0.56), 0, { cls: 2 });
  // nose collisions: in slices, a core and steps that follow the section (from the roof, you step down onto the nose)
  const ncut = [0.3, 0.7, 1.1, 1.6, 2.2, 2.9, 3.7, 4.5, NL];
  for (let i = 0; i < ncut.length - 1; i++) {
    const d0 = ncut[i], d1 = ncut[i + 1], s = sec(d0 + (d1 - d0) * 0.35), x0 = XF1 + NL - d1, x1 = XF1 + NL - d0;
    for (const [f0, f1, fh] of [[0, 0.35, 0.2], [0.35, 0.6, 0.48], [0.6, 0.8, 0.7], [0.8, 0.97, 0.9]]) {
      const h = s.yc + s.ry * Math.sqrt(1 - fh * fh);
      if (!f0) DECOR.col(x0, x1, y0 - 0.5, h, Z(-f1 * s.rz), Z(f1 * s.rz), 'metal');
      else for (const sg of [-1, 1]) DECOR.col(x0, x1, y0 - 0.5, h, Math.min(Z(sg * f0 * s.rz), Z(sg * f1 * s.rz)), Math.max(Z(sg * f0 * s.rz), Z(sg * f1 * s.rz)), 'metal');
    }
  }
  // tail: the raised cone, the blue outro with bands, the stabilizers, the APU exhaust
  const TL = 7.5, ts = (t) => { const r = lerp(Rf, 0.32, Math.pow(t, 1.15)); return { x: XR0 - TL * t, y: cy + (Rf - r) * 0.86, r }; };
  M.save().local(1); M.cls = 0; M.color([1, 1, 1]);
  M.surf('hull', 10, 24, (u, v) => { const s = ts(u), th = v * TAU - Math.PI / 2, p = [s.x, s.y + s.r * Math.sin(th), Z(s.r * Math.cos(th))]; M.tint = liv(p[0], p[1] - 0.35 * u); return p; }, { uL: TL, vL: TAU * 1.2, flipN: true });
  M.tint = null; M.color([0.1, 0.1, 0.11]); const te = ts(1); M.save().move(te.x + 0.05, te.y, Z(0)).rotZ(Math.PI / 2); M.cyl('dark', 0.2, 0.3, 10, { r1: 0.24 }); M.restore();
  const fa = ts(0.12), fb = ts(0.86), fy = (s) => s.y + s.r - 0.12, F = [[fa.x - 0.6, fy(fa)], [fb.x + 0.2, fy(fb)], [fb.x - 1.6, fy(fb) + 5.6], [fa.x - 4.2, fy(fa) + 5.6]];
  const outro = (k, d) => [F[k][0], F[k][1], Z(d)], fth = (k) => (k < 2 ? 0.16 : 0.07);
  M.color(blue);
  for (const s of [-1, 1]) M.quad('hull', outro(0, s * fth(0)), outro(1, s * fth(1)), outro(2, s * fth(2)), outro(3, s * fth(3)), [0, 0, s]);
  M.quad('hull', outro(0, -fth(0)), outro(0, fth(0)), outro(3, fth(3)), outro(3, -fth(3)), [0.94, 0.35, 0]); M.quad('hull', outro(3, -fth(3)), outro(3, fth(3)), outro(2, fth(2)), outro(2, -fth(2)), [0, 1, 0]);
  M.quad('hull', outro(2, -fth(2)), outro(2, fth(2)), outro(1, fth(1)), outro(1, -fth(1)), [-0.96, -0.27, 0]);
  // light bands in arcs on both faces of the outro
  const fpt = (u, w) => { const yA = lerp(F[0][1], F[3][1], w), xLE = lerp(F[0][0], F[3][0], w), xTE = lerp(F[1][0], F[2][0], w); return [lerp(xLE, xTE, u), yA]; };
  for (const [w0, w1, col] of [[0.28, 0.36, [0.36, 0.55, 0.86]], [0.42, 0.5, [0.64, 0.78, 0.95]], [0.56, 0.62, [0.92, 0.94, 0.97]], [0.68, 0.75, [0.36, 0.55, 0.86]]]) {
    M.color(col);
    for (let i = 0; i < 6; i++) {
      const u0 = i / 6, u1 = (i + 1) / 6, sag = (u) => -0.12 * Math.sin(u * Math.PI) - 0.1 * u, p00 = fpt(u0, w0 + sag(u0)), p10 = fpt(u1, w0 + sag(u1)), p11 = fpt(u1, w1 + sag(u1)), p01 = fpt(u0, w1 + sag(u0));
      for (const s of [-1, 1]) { const d = (p) => s * (lerp(fth(0), fth(3), (p[1] - F[0][1]) / 5.6) + 0.006); M.quad('hull', [p00[0], p00[1], Z(d(p00))], [p10[0], p10[1], Z(d(p10))], [p11[0], p11[1], Z(d(p11))], [p01[0], p01[1], Z(d(p01))], [0, 0, s]); }
    }
  }
  M.color(white);
  const hs = ts(0.62);
  for (const s of [-1, 1]) {
    const r0 = [hs.x + 1.4, hs.y + 0.1, Z(s * 0.45)], r1 = [hs.x - 1.1, hs.y + 0.1, Z(s * 0.45)], t1 = [hs.x - 2.6, hs.y + 0.5, Z(s * 6.0)], t0 = [hs.x - 1.5, hs.y + 0.5, Z(s * 6.0)];
    M.quad('hull', r0, r1, t1, t0, [0, 1, 0]); M.quad('hull', [r0[0], r0[1] - 0.14, r0[2]], [t0[0], t0[1] - 0.06, t0[2]], [t1[0], t1[1] - 0.06, t1[2]], [r1[0], r1[1] - 0.14, r1[2]], [0, -1, 0]);
    M.quad('hull', [r0[0], r0[1] - 0.14, r0[2]], r0, t0, [t0[0], t0[1] - 0.06, t0[2]], [0.9, 0, -0.4 * s]);
    for (let k = 0; k < 3; k++) { const f0 = k / 3, f1 = (k + 1) / 3, la = lerp(r0[0], t0[0], f1), tb = lerp(r1[0], t1[0], f0); DECOR.col(tb, la, r0[1] - 0.14, t0[1], Math.min(Z(s * lerp(0.45, 6, f0)), Z(s * lerp(0.45, 6, f1))), Math.max(Z(s * lerp(0.45, 6, f0)), Z(s * lerp(0.45, 6, f1))), 'metal'); }
  }
  M.restore();
  DECOR.col(F[2][0], F[0][0], fy(fb), fy(fa) + 5.6, Z(-0.18), Z(0.18), 'metal');
  for (let t = 0; t < 1; t += 0.25) { const a = ts(t), b = ts(t + 0.25), r = Math.min(a.r, b.r) * 0.8; DECOR.col(b.x, a.x, Math.min(a.y, b.y) - r, Math.max(a.y, b.y) + r, Z(-r), Z(r), 'metal'); }
  // swept low wings: walkable upper surface, lower surface, edges, underlined flaps, blue winglets; track fairings under the trailing edge.
  // Lying on the belly, they sink toward the tip into the sand (from 37 to 13 cm above the ground): you can step over them walking along their whole
  // length (with the dihedral of a plane on the ground, the tip rose to 1.3 m and the wing cut the salt flat in two: crossing.js)
  const W0 = 1.85, W1 = 15.3, LE = (d) => cx - 1.0 - (d - W0) * (7.3 / (W1 - W0)), TE = (d) => cx - 7.4 - (d - W0) * (2.5 / (W1 - W0)), WY = (d) => yf + 0.12 - (d - W0) * 0.018, WT = (d) => lerp(0.62, 0.16, (d - W0) / (W1 - W0));
  M.save().local(1); M.cls = 0;
  for (const s of [-1, 1]) {
    const pt = (x, y, d) => [x, y, Z(s * d)], n = (v) => [v[0], v[1], v[2] * s];
    M.color([0.86, 0.87, 0.88]);
    M.quad('hull', pt(LE(W0), WY(W0), W0), pt(TE(W0), WY(W0), W0), pt(TE(W1), WY(W1), W1), pt(LE(W1), WY(W1), W1), [0, 1, 0]);
    M.quad('hull', pt(LE(W0), WY(W0) - WT(W0), W0), pt(TE(W0), WY(W0) - WT(W0), W0), pt(TE(W1), WY(W1) - WT(W1), W1), pt(LE(W1), WY(W1) - WT(W1), W1), [0, -1, 0]);
    M.quad('hull', pt(LE(W0), WY(W0), W0), pt(LE(W0) + 0.18, WY(W0) - WT(W0) * 0.5, W0), pt(LE(W1) + 0.06, WY(W1) - WT(W1) * 0.5, W1), pt(LE(W1), WY(W1), W1), n([0.8, 0.5, 0.3]));
    M.quad('hull', pt(LE(W0) + 0.18, WY(W0) - WT(W0) * 0.5, W0), pt(LE(W0), WY(W0) - WT(W0), W0), pt(LE(W1), WY(W1) - WT(W1), W1), pt(LE(W1) + 0.06, WY(W1) - WT(W1) * 0.5, W1), n([0.8, -0.5, 0.3]));
    M.quad('hull', pt(TE(W0), WY(W0), W0), pt(TE(W0), WY(W0) - WT(W0), W0), pt(TE(W1), WY(W1) - WT(W1), W1), pt(TE(W1), WY(W1), W1), n([-0.95, 0, -0.3]));
    M.quad('hull', pt(LE(W1), WY(W1), W1), pt(TE(W1), WY(W1), W1), pt(TE(W1), WY(W1) - WT(W1), W1), pt(LE(W1), WY(W1) - WT(W1), W1), n([0, 0, 1]));
    M.color([0.62, 0.64, 0.66]);
    for (const f of [0.72, 0.9]) { const xa = (d) => lerp(LE(d), TE(d), f); M.quad('hull', pt(xa(W0 + 0.3) + 0.02, WY(W0 + 0.3) + 0.006, W0 + 0.3), pt(xa(W0 + 0.3) - 0.02, WY(W0 + 0.3) + 0.006, W0 + 0.3), pt(xa(W1 - 0.4) - 0.02, WY(W1 - 0.4) + 0.006, W1 - 0.4), pt(xa(W1 - 0.4) + 0.02, WY(W1 - 0.4) + 0.006, W1 - 0.4), [0, 1, 0]); }
    M.color([0.84, 0.85, 0.86]);
    for (const d of [5.0, 8.4, 11.6]) { const yb = WY(d) - WT(d); M.boxB('hull', TE(d) - 0.9, TE(d) + 1.4, yb - 0.32, yb + 0.02, Z(s * d) - 0.14, Z(s * d) + 0.14, { bevel: 0.08 }); }
    M.color([0.8, 0.81, 0.82]); M.boxB('hull', LE(5.7) - 2.4, LE(5.7) - 0.4, WY(5.7) - WT(5.7) - 0.45, WY(5.7) - WT(5.7) + 0.02, Z(s * 5.7) - 0.18, Z(s * 5.7) + 0.18); // engine pylon, torn off
    // winglet
    M.color(blue);
    const wa = [LE(W1), WY(W1), W1], wb = [TE(W1), WY(W1), W1], wc = [TE(W1) - 0.5, WY(W1) + 1.6, W1 + 0.3], wd = [TE(W1) + 0.2, WY(W1) + 1.6, W1 + 0.3];
    for (const k of [-1, 1]) M.quad('hull', pt(wa[0], wa[1], wa[2] + k * 0.04), pt(wb[0], wb[1], wb[2] + k * 0.04), pt(wc[0], wc[1], wc[2] + k * 0.02), pt(wd[0], wd[1], wd[2] + k * 0.02), n([0, 0, k]));
    for (let d = W0; d < W1 - 0.01; d += 1) { const d1 = Math.min(W1, d + 1), y = WY((d + d1) / 2); DECOR.col(Math.max(TE(d), TE(d1)), Math.min(LE(d), LE(d1)), y - WT(d), y, Math.min(Z(s * d), Z(s * d1)), Math.max(Z(s * d), Z(s * d1)), 'metal'); }
  }
  M.restore();
  // the engines, torn off, lying in the sand in front of the wings
  smPlace(PF.smJetEngine(), cx + 3.6, Z(7.6), 0.42); smPlace(PF.smJetEngine(), cx + 3.0, Z(-7.6), -0.42);
  return { top };
}
/* Block of three cabin seats (frame: the floor, the middle of the block; looking toward +x): navy blue seat and back, headrest with a gray and white
   striped cover on the back, gray-green armrests, steel legs; one collision for the block */
PF.smSeats3 = () => prefab('smSeats3', (M) => {
  const navy = [0.1, 0.13, 0.22], light = [0.88, 0.87, 0.84], stripe = [0.52, 0.5, 0.46];
  M.local(1);
  for (let k = 0; k < 3; k++) {
    const z = -0.4 + k * 0.4;
    M.color(navy); M.boxB('cabin', -0.22, 0.24, 0.36, 0.5, z - 0.18, z + 0.18, { bevel: 0.03 });
    M.save().move(-0.2, 0.46, z).rotZ(0.16);
    M.color(navy); M.boxB('cabin', -0.06, 0.05, 0, 0.74, -0.18, 0.18, { bevel: 0.025 });
    for (let i = 0; i < 5; i++) { M.color(i % 2 ? light : stripe); const za = -0.17 + (i / 5) * 0.34, zb = -0.17 + ((i + 1) / 5) * 0.34; M.quad('canvas', [-0.066, 0.5, za], [-0.066, 0.5, zb], [-0.066, 0.72, zb], [-0.066, 0.72, za], [-1, 0, 0]); }
    M.color(light); M.quad('canvas', [0.056, 0.5, -0.17], [0.056, 0.5, 0.17], [0.056, 0.72, 0.17], [0.056, 0.72, -0.17], [1, 0, 0]);
    M.restore();
  }
  M.color([0.3, 0.31, 0.27]);
  for (const z of [-0.6, -0.2, 0.2, 0.6]) M.boxB('cabin', -0.16, 0.2, 0.58, 0.64, z - 0.025, z + 0.025, { bevel: 0.01 });
  M.color([0.55, 0.56, 0.58]);
  for (const z of [-0.42, 0.42]) { M.boxB('steel', -0.14, -0.1, 0, 0.36, z - 0.02, z + 0.02); M.boxB('steel', 0.14, 0.18, 0, 0.36, z - 0.02, z + 0.02); }
  M.boxB('steel', -0.16, 0.2, 0.3, 0.34, -0.55, 0.55);
  M.col(-0.3, 0.28, 0, 1.0, -0.6, 0.6, 'wood');
});
/* Pilot seat (toward +x): base, anthracite seat and back, light sheepskin cover, headrest, armrests */
PF.smPilotSeat = () => prefab('smPilotSeat', (M) => {
  const dark = [0.13, 0.13, 0.14];
  M.local(1);
  M.color([0.3, 0.31, 0.33]); M.boxB('steel', -0.2, 0.2, 0, 0.34, -0.16, 0.16);
  M.color(dark); M.boxB('cabin', -0.26, 0.26, 0.34, 0.47, -0.25, 0.25, { bevel: 0.03 });
  M.save().move(-0.24, 0.45, 0).rotZ(0.12);
  M.color(dark); M.boxB('cabin', -0.07, 0.04, 0, 0.82, -0.25, 0.25, { bevel: 0.03 }); M.boxB('cabin', -0.04, 0.06, 0.84, 1.0, -0.15, 0.15, { bevel: 0.03 });
  M.color([0.74, 0.68, 0.58]); M.boxB('canvas', 0.04, 0.07, 0.06, 0.66, -0.21, 0.21, { bevel: 0.02 });
  M.restore();
  M.color(dark); for (const z of [-0.29, 0.29]) M.boxB('cabin', -0.18, 0.16, 0.6, 0.66, z - 0.03, z + 0.03, { bevel: 0.01 });
});
/* Turbofan engine torn off its pylon (frame: the sand under it, the air intake toward +x): gray nacelle, fan and cone, nozzle and
   exhaust cone, the torn pylon above; sunk by 12 cm; one collision */
PF.smJetEngine = () => prefab('smJetEngine', (M) => {
  M.local(1); const ay = 0.92;
  M.save().move(-1.8, ay, 0).rotZ(-Math.PI / 2);
  M.color([0.8, 0.81, 0.82]); M.lathe('hull', [[0.62, 0], [0.8, 0.45], [0.98, 1.4], [1.04, 2.6], [1.02, 3.3], [0.94, 3.6], [0.86, 3.52], [0.84, 3.3]], 20);
  M.color([0.08, 0.08, 0.09]); M.save().move(0, 3.24, 0); M.cyl('dark', 0.85, 0.02, 20); M.restore();
  M.color([0.62, 0.63, 0.65]); M.save().move(0, 3.26, 0); M.cyl('steel', 0.3, 0.32, 14, { r1: 0.02 }); M.restore();
  M.color([0.3, 0.31, 0.33]);
  for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU; M.save().move(0, 3.27, 0).rotY(a); M.quad('steel', [0.3, 0, -0.06], [0.84, 0, -0.1], [0.84, 0.03, 0.1], [0.3, 0.03, 0.06], [0, 1, 0]); M.restore(); }
  M.color([0.5, 0.5, 0.52]); M.lathe('steel', [[0, -1.05], [0.22, -0.9], [0.44, -0.35], [0.5, 0]], 14);
  M.color([0.12, 0.12, 0.12]); M.lathe('dark', [[0.5, 0.02], [0.6, 0.02]], 16);
  M.restore();
  M.color([0.78, 0.79, 0.8]); M.boxB('hull', -1.2, 1.0, ay + 0.9, ay + 1.3, -0.17, 0.17);
  M.color([0.4, 0.4, 0.42]); M.boxB('steel', 0.6, 1.0, ay + 1.28, ay + 1.36, -0.12, 0.12);
  M.col(-2.6, 1.8, 0, ay + 1.0, -0.95, 0.95, 'metal');
});
/* Airliner cargo container (LD3) thrown out of the hold, that the storm has uncovered (frame: the sand under it): aluminum box 1.53 m deep (x), 1.56
   m wide at the base and 2 m at the top, the contoured side (+z) slanted above 0.45 m, ribs at the edges, the door side (-x) a torn net over
   suitcases; sunk by 15 cm. Two collisions (body, overhang) */
PF.smULD = (seed = 1) => prefab('smULD' + seed, (M) => {
  const R = rngOf(seed * 13 + 7), hw = 0.765, z0 = -0.78, z1 = 0.78, z2 = 1.23, y0 = -0.15, yk = 0.3, yt = 1.48;
  M.local(1);
  M.color([0.7, 0.69, 0.66]); // dull, dusty aluminum
  M.save().move(-hw, 0, 0).rotY(Math.PI / 2); // extrusion along x, profile in (z, y): local x of the profile -> -z
  M.extrude('hull', [[-z0, y0], [-z1, y0], [-z1, yk], [-z2, yk + 0.45], [-z2, yt], [-z0, yt]], hw * 2);
  M.restore();
  // ribs: the edges of the box and of the contoured side, darker
  M.color([0.55, 0.56, 0.58]);
  for (const x of [-hw, hw]) {
    M.boxB('steel', x - 0.03, x + 0.03, y0, yt + 0.02, z0 - 0.03, z0 + 0.03); M.boxB('steel', x - 0.03, x + 0.03, y0, yk + 0.02, z1 - 0.03, z1 + 0.03);
    M.boxB('steel', x - 0.03, x + 0.03, yk + 0.45, yt + 0.02, z2 - 0.03, z2 + 0.03); M.boxB('steel', x - 0.03, x + 0.03, yt - 0.03, yt + 0.03, z0, z2);
  }
  // the door side: torn net (dark straps), suitcases spilled on the sand in front of it (no collision: under the step height)
  M.color([0.12, 0.12, 0.13]); M.cls = 1;
  for (let i = 0; i < 4; i++) { const z = lerp(z0 + 0.2, z2 - 0.25, i / 3); M.boxB('fabric', -hw - 0.04, -hw - 0.01, y0 + 0.4, yt - R.range(0.1, 0.6), z - 0.025, z + 0.025); }
  for (let i = 0; i < 5; i++) {
    M.color(R.pick([[0.12, 0.13, 0.18], [0.45, 0.12, 0.1], [0.2, 0.28, 0.4], [0.5, 0.48, 0.42], [0.16, 0.16, 0.16]]));
    M.save().move(-hw - R.range(0.45, 1.4), i === 4 ? 0.2 : -0.04, R.range(z0, z1 + 0.3)).rotY(R.range(-0.8, 0.8)).rotZ(R.range(-0.08, 0.08));
    M.box('plastic', R.range(0.5, 0.75), R.range(0.2, 0.28), R.range(0.36, 0.55), { bevel: 0.03 }); M.restore();
  }
  M.cls = 0;
  M.col(-hw, hw, y0, yt, z0, z1, 'metal'); M.col(-hw, hw, yk + 0.3, yt, z1, z2 - 0.1, 'metal');
});

/* ---------- Desert life: dust devils, vultures ---------- */
/* Dust devil texture (128 x 256, alpha): trails of dust that spiral upward, denser at the bottom, frayed at the top */
function smDevilTex() {
  const t = canvasTex(256, (g, S) => {
    const R = rngOf(818); g.clearRect(0, 0, S, S);
    for (let i = 0; i < 900; i++) {
      const x = R() * S, y = R() * S, h = 8 + R() * 60, w = 2 + R() * 6, a = 0.04 + 0.1 * Math.pow(y / S, 1.5);
      const gr = g.createLinearGradient(0, y - h, 0, y); gr.addColorStop(0, 'rgba(255,240,220,0)'); gr.addColorStop(0.5, `rgba(255,240,220,${a})`); gr.addColorStop(1, 'rgba(255,240,220,0)');
      g.fillStyle = gr; g.save(); g.translate(x, y); g.rotate(-0.35); g.fillRect(-w / 2, -h, w, h); g.restore();
      if (x < 12) { g.save(); g.translate(x + S, y); g.rotate(-0.35); g.fillStyle = gr; g.fillRect(-w / 2, -h, w, h); g.restore(); }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1);
  return t;
}
/* Dust devil: two nested open cones that turn and slowly wander along a circuit (cx, cz, rx, rz, period);
   no collision, no shadow, transparent (you see through); animated by smLife */
function smDustDevil(o, tex) {
  const g = new THREE.Group(), mats = [];
  for (const [r0, r1, h, op] of [[0.9, 3.2, 14, 0.34], [0.5, 1.8, 9, 0.26]]) {
    const geo = new THREE.CylinderGeometry(r1, r0, h, 20, 6, true); geo.translate(0, h / 2, 0);
    const m = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color().setRGB(sl(0.92), sl(0.76), sl(0.58)), transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, fog: true });
    const mesh = new THREE.Mesh(geo, m); mesh.userData.noAO = true; mesh.userData.noPrepass = true; mesh.castShadow = false; mesh.renderOrder = 4;
    g.add(mesh); mats.push(m);
  }
  mapAdd(g);
  return { k: 'devil', g, mats, o, ph: o.ph || 0 };
}
/* Sand veils: the wind tears sand off the dune crests and drags it along the ground. Thin vertical sheets of 0.7 m laid in the direction of the
   wind, draped over the relief, transparent, no collision or shadow; a single material whose trail texture scrolls (smLife). On the crests
   only (higher than the sand 4 m upwind), outside the camps and bases */
function smVeilTex() {
  const t = canvasTex(256, (g, S) => {
    const R = rngOf(919); g.clearRect(0, 0, S, S);
    for (let i = 0; i < 700; i++) {
      const y = S * (1 - Math.pow(R(), 1.8)), x = R() * S, w = 20 + R() * 90, h = 1 + R() * 3, a = 0.05 + 0.16 * Math.pow(y / S, 2);
      const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, 'rgba(255,236,210,0)'); gr.addColorStop(0.5, `rgba(255,236,210,${a})`); gr.addColorStop(1, 'rgba(255,236,210,0)');
      g.fillStyle = gr; g.fillRect(x, y - h, w, h); if (x + w > S) g.fillRect(x - S, y - h, w, h);
    }
  });
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
function smSandVeils(R, tex) {
  // (sandstorm, November 2026: 60 sheets of 1.1 m on every windward rise, instead of 26 of 0.75 m on the crests only: the ground smokes)
  const D = WIND_U.uWnD.value, dx = D.x, dz = D.y, tile = 6, pos = [], uv = [], idx = [];
  for (let i = 0, n = 0; i < 900 && n < 60; i++) {
    const a = R() * TAU, r = Math.sqrt(R()) * (SM_R + 24), cx = Math.cos(a) * r, cz = Math.sin(a) * r, h = smH(cx, cz);
    if (h < smH(cx - dx * 4, cz - dz * 4) + 0.15 || SM_PADS.some((p) => hyp((cx - p[0]) / (p[2] + 4), (Math.abs(cz) - p[1]) / (p[3] + 4)) < 1) || smPondQ(cx, cz) < 1.6) continue;
    const L = R.range(9, 18), off = R.range(-0.6, 0.6), base = pos.length / 3;
    for (let k = 0; k <= 12; k++) {
      const u = k / 12, x = cx + dx * (u * L - 1.5) - dz * off * u, z = cz + dz * (u * L - 1.5) + dx * off * u, y = smY(x, z) - 0.05;
      pos.push(x, y, z, x, y + 1.1, z); uv.push((u * L) / tile, 0, (u * L) / tile, 1);
      if (k) { const b = base + (k - 1) * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    }
    n++;
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const m = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color().setRGB(sl(0.95), sl(0.82), sl(0.66)), transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide, fog: true });
  const mesh = new THREE.Mesh(g, m); mesh.userData.noAO = true; mesh.userData.noPrepass = true; mesh.castShadow = false; mesh.renderOrder = 4; mesh.frustumCulled = false;
  mapAdd(mesh);
  return { k: 'veil', g: mesh, mats: [m], o: {}, tile };
}
/* Sand carried by the storm: grains that streak past in the wind, in a 32 x 7 x 32 m box that follows the camera. Nothing per grain on
   the processor: the vertex shader moves each grain with the clock (uT) and wraps it into the box around the camera (uCam), and draws it
   as a short streak along the wind's direction on screen (its length: the path of the grain in a fiftieth of a second, foreshortened when
   the wind comes toward you). Hidden under a roof and indoors (share of sky of the baked lighting, like the snowfall, 02i-winter.js), faded
   near the eye (never on the weapon) and toward the edges of the box. uA: density, uCol: color (smLife, from the storm's level) */
function smSandStream(n) {
  const R = rngOf(931), p = new Float32Array(n * 3), s = new Float32Array(n);
  for (let i = 0; i < n; i++) { p[i * 3] = R(); p[i * 3 + 1] = R(); p[i * 3 + 2] = R(); s[i] = R(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aS', new THREE.BufferAttribute(s, 1));
  const D = WIND_U.uWnD.value;
  const m = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 540 }, uT: { value: 0 }, uA: { value: 1 }, uCam: { value: new V3() }, uWind: { value: new V3(D.x, D.y, 12) }, uCol: { value: new THREE.Color() }, tVol: WMU.tVol, uVolMin: WMU.uVolMin, uVolInv: WMU.uVolInv, uVolL: WMU.uVolL },
    vertexShader: `uniform float uScale, uT, uA; uniform vec3 uCam, uWind; uniform highp sampler3D tVol; uniform vec3 uVolMin, uVolInv; uniform vec4 uVolL;
      ${VOL_Q}
      attribute float aS; varying float vA, vL, vW; varying vec2 vDir;
      const vec3 BOX = vec3(32.0, 7.0, 32.0);
      void main() {
        vec3 w = vec3(uWind.x, 0.0, uWind.y), o = uCam - vec3(16.0, 2.5, 16.0), sp = w * uWind.z * (0.75 + 0.5 * aS);
        vec3 p = position * BOX + sp * uT + vec3(0.0, sin(uT * (1.1 + aS) + aS * 40.0) * 0.35, 0.0);
        p = o + mod(p - o, BOX);
        float sky = texture(tVol, VOL_Q(clamp((p - uVolMin) * uVolInv, 0.0, 1.0))).b;
        vec4 mv = modelViewMatrix * vec4(p, 1.0), c0 = projectionMatrix * mv, c1 = projectionMatrix * (modelViewMatrix * vec4(p + sp * 0.02, 1.0));
        float asp = projectionMatrix[1][1] / projectionMatrix[0][0], d = -mv.z;
        vec2 sd = (c1.xy / c1.w - c0.xy / c0.w) * vec2(asp, 1.0) * uScale / projectionMatrix[1][1]; // path in a fiftieth of a second, in pixels
        float len = length(sd), size = clamp(len + 2.0, 2.0, 24.0);
        vDir = len > 0.01 ? sd / len : vec2(1.0, 0.0); vL = clamp(len / size, 0.08, 1.0); vW = 1.3 / size;
        float e = max(abs(p.x - uCam.x), abs(p.z - uCam.z));
        vA = uA * smoothstep(0.32, 0.6, sky) * smoothstep(1.5, 3.5, d) * (1.0 - smoothstep(11.0, 15.5, e)) * step(0.0, c0.w);
        gl_PointSize = size; gl_Position = c0;
      }`,
    fragmentShader: `uniform vec3 uCol; varying float vA, vL, vW; varying vec2 vDir;
      void main() {
        vec2 c = gl_PointCoord * 2.0 - 1.0; c.y = -c.y;
        float a = abs(dot(c, vDir)), b = abs(dot(c, vec2(-vDir.y, vDir.x)));
        float k = (1.0 - smoothstep(vL * 0.35, vL, a)) * (1.0 - smoothstep(vW * 0.4, vW, b)) * vA * 0.7;
        if (k < 0.01) discard;
        gl_FragColor = vec4(uCol, k);
      }`,
    transparent: true, depthWrite: false,
  });
  const o = new THREE.Points(g, m); o.frustumCulled = false; o.renderOrder = 4; o.userData.weather = true; o.userData.noAO = true;
  mapAdd(o);
  return { k: 'sand', g: o, mats: [m], o: {} };
}
/* Vulture: dark silhouette with board-like wings (fingers spread at the tip), circling in a spiral above the dunes */
function smVulture(o) {
  const shape = new THREE.Shape(); shape.moveTo(0, 0.5); shape.lineTo(1.1, 0.2); shape.lineTo(1.6, 0.25); shape.lineTo(1.75, 0.05); shape.lineTo(1.2, -0.1); shape.lineTo(0.25, -0.3); shape.lineTo(0, -0.7);
  shape.lineTo(-0.25, -0.3); shape.lineTo(-1.2, -0.1); shape.lineTo(-1.75, 0.05); shape.lineTo(-1.6, 0.25); shape.lineTo(-1.1, 0.2); shape.lineTo(0, 0.5);
  const geo = new THREE.ShapeGeometry(shape); geo.rotateX(-Math.PI / 2);
  const m = new THREE.MeshBasicMaterial({ color: 0x1c1612, side: THREE.DoubleSide, fog: true });
  const mesh = new THREE.Mesh(geo, m); mesh.castShadow = false; mesh.userData.noAO = true; mapAdd(mesh);
  return { k: 'bird', g: mesh, mats: [m], o };
}
/* Animation: the dust devil turns, wanders along its circuit, fades and is reborn (it lives 70% of the time); the vultures circle, only
   when a lull thins the dust (no bird flies in the storm); the flying sand follows the camera, denser in the storm (smStorm) */
function smLife(list, t) {
  const st = clamp(SMS.s, 0, 1);
  for (const A of list) {
    if (A.k === 'sand') {
      const U = A.mats[0].uniforms; U.uT.value = t % 3600; U.uCam.value.copy(camera.position); U.uScale.value = pointScale();
      U.uA.value = lerp(SM_LULL.sand, 1, st); U.uCol.value.copy(scene.fog.color).multiplyScalar(1.25);
      continue;
    }
    if (A.k === 'bird') { A.g.visible = st < 0.4; if (!A.g.visible) continue; }
    const o = A.o;
    if (A.k === 'devil') {
      const u = (t / o.T + A.ph) % 1, life = smoothstep(0, 0.12, u) * (1 - smoothstep(0.58, 0.7, u)), w = (t / o.T + A.ph) * TAU;
      A.g.visible = life > 0.01;
      if (!A.g.visible) continue;
      const px = o.cx + Math.sin(w * 1.3) * o.rx, pz = o.cz + Math.sin(w * 0.7 + 1.1) * o.rz;
      A.g.position.set(px, gy0(px, pz) - 0.3, pz); // on the sand
      A.g.children.forEach((c, i) => { c.rotation.y = t * (i ? 2.6 : 1.7); c.scale.set(0.6 + 0.4 * life, 0.5 + 0.5 * life, 0.6 + 0.4 * life); c.rotation.z = Math.sin(t * 0.7 + i) * 0.06; });
      A.mats[0].map.offset.y = -t * 0.25; A.mats.forEach((m, i) => { m.opacity = (i ? 0.26 : 0.34) * life; });
    } else if (A.k === 'veil') {
      // the sand streams in the direction of the wind (3 m/s), in gusts
      A.mats[0].map.offset.x = -((t * 3) / A.tile) % 1; A.mats[0].opacity = Math.min(1, 0.42 * (0.55 + 0.45 * Math.sin(t * 0.37) * Math.sin(t * 0.23 + 1.3)) * (1 + 1.4 * Math.max(0, SMS.s))); // denser in the storm (smStorm)
    } else {
      const a = t * o.w + o.a0;
      A.g.position.set(o.cx + Math.cos(a) * o.r, o.y + Math.sin(t * 0.13 + o.a0) * 3, o.cz + Math.sin(a) * o.r);
      A.g.rotation.set(0, (o.w > 0 ? Math.PI : 0) - a, (o.w > 0 ? 1 : -1) * 0.32);
    }
  }
}
