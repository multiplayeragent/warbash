/* ==========================================================================
   PLAY-STYLE OUTFITS: ten challenge outfits, each earned by a way of playing (challenges: 06s-challenges.js), built from the kit
   (06ge-outfit-kit.js) like the map outfits (06gf-outfits-maps.js). Every face is covered and every back carries a signature piece.
   - Bulwark (staying alive): full helmet with a slit visor, big shoulder domes, riveted chest and back plates with hazard stripes, wide
     shin plates, steel gray and hazard yellow.
   - Standard-Bearer (Domination): crimson and ivory, banner cape with a bold emblem, pole on the back with a large pennant.
   - Sapper (explosives): padded blast suit quilted in diamonds, high collar, blast helmet and visor, charges wired on the chest, strapped
     satchel on the back, satchels on the hips, orange accents.
   - Skyhook (killstreaks): pale gray-blue technical suit, headset, antenna pack with a quad drone docked above the shoulders, cyan lines.
   - Marshal (pistols): wide-brim hat, bandana over the face, long open tan duster (body, sleeves, collar, tails) with a yoke cape carrying a
     large shield on the back, leather waistcoat, plain brass shield badge, two hip holsters.
   - Shade (knife and stealth): near-black, tight cowl and half mask, one red line across the eyes, a long sheathed blade across the lower
     back, a row of knives on the chest, a dark-red sash to the knees.
   - Aurum (mastery): flat black with bright glossy gold: gold visor and laurel band, gold plates and trim, short cape lined in gold.
   - Trapper (close range): chunky dark fur hat with ear flaps and a hanging tail, fur mantle and beard, patched leather, bone toggles,
     pack and bedroll.
   - Circuit (movement and multi-kills): a circuit board worn as a suit: board-green, copper traces with square solder pads, chips and
     capacitors on the chest, the back and the forearms, amber indicator lights, a helmet with a flat sensor bar.
   - Old Guard (wins everywhere): long olive greatcoat worn open with a unit mark on its back, beret and badge, ribbon bar, brass buttons.
   ========================================================================== */

/* ---------- Bulwark ---------- */
const OF_BULWARK_HELM = { c: [0, 0.012, -0.002], s: [0.132, 0.144, 0.144], jaw: 2.5, seg: 8, rows: 6, snout: 0.14, pinch: 0.1 };
/* Hazard stripes: alternating yellow and dark bars on a plate (matrix m, its +z outward), w x h */
function ofHazard(B, m, w, h, wt, G, n = 5) {
  for (let i = 0; i < n; i++) gBox(B, w / n * 0.62, h * 1.25, 0.004, 0, m.clone().multiply(gMat((i - (n - 1) / 2) * w / n, 0, 0, 0, 0, 0.6)), wt, i % 2 ? G.dark : G.hazard, 'paint', 0, 0);
}
/* Rivets along a plate (matrix m, +z outward): at the given [x, y] */
function ofRivets(B, hi, m, pts, wt, col) { for (const [x, y] of pts) gCyl(B, 0.008, 0.008, 0.006, hi ? 8 : 5, m.clone().multiply(gMat(x, y, 0, Math.PI / 2)), wt, col, 'met'); }
/* Bulwark pieces: full helmet and slit, brow plate, gorget, shoulder domes, riveted chest and back plates with hazard stripes, wide shin
   plates, plates on all limbs */
function ofBulwarkModel(B, skin, hi) {
  const G = skinGear(skin), H = OF_BULWARK_HELM, hm = ofkHM(), R = soldierRest(), J = R.J;
  ofkShell(B, hi, H, G.steel, 'plate');
  ofkVisor(B, hi, H, 0.95, 1.5, 0.12, G.slit, 'lens', 0.003);
  gBox(B, 0.16, 0.024, 0.012, hi ? 0.004 : 0, hm.clone().multiply(gMat(0, 0.044, -0.143, -0.3)), SB.HEA, G.steel2, 'plate');
  for (const s of [-1, 1]) gBox(B, 0.012, 0.06, 0.008, 0, hm.clone().multiply(gMat(s * 0.128, 0.05, 0.02, 0, 0, s * 0.3)), SB.HEA, G.hazard, 'paint', 0, 0);
  for (const ph of [Math.PI * 1.5, Math.PI / 2]) ofkShell(B, hi, H, G.hazard, 'paint', ph - 0.16, 0.32, 0, 1.25, 0.003, 0.4);
  const gor = [[1.43, 0.15, 0.115, 0.112], [1.47, 0.125, 0.105, 0.105], [1.52, 0.1, 0.098, 0.098]];
  skinLoft(B, gor.map(([y, w, f, bk]) => ({ c: new V3(0, y, -0.004), X: new V3(1, 0, 0), Y: new V3(0, 0, -1), r: [w, w, f, bk], n: 2.4, v: y })), hi ? 16 : 8, { wp: (p) => (p.y > 1.48 ? [[SB.NEC, 0.6], [SB.CHE, 0.4]] : torsoW(p)), col: () => G.steel2, uv: () => GEAR_TILE.plate });
  for (const sx of [-1, 1]) {
    const m = ofkDome(B, hi, sx, { r: [0.128, 0.085, 0.13], off: [0.035, 0.05, 0.0], col: G.steel, roll: 0.42, seg: 8 });
    ofHazard(B, m.clone().multiply(gMat(0, 1.0, 0, -Math.PI / 2)).scale(new V3(1 / 0.128, 1 / 0.13, 1 / 0.085)), 0.1, 0.05, dShoulderW(sx, 0.45), G, 3);
    // wide shin plates with a hazard strip
    const b = SIDE_B(sx), sm = dSeg(J[b.jKn], J[b.jFt], 0.38, new V3(sx * 0.15, 0, -1), 0.066), sw = legW(b)(SD.thigh + SD.shin * 0.38);
    dPlate(B, 0.122, 0.25, 0.02, sm, sw, G.steel, -2.0);
    gBox(B, 0.1, 0.022, 0.004, 0, sm.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.07, 0.014)), sw, G.hazard, 'paint', -2.0, 0);
    // thigh plate: wide, bevelled, a hazard band at its top
    const tm = dSeg(J[b.jHi], J[b.jKn], 0.45, new V3(sx * 0.55, 0, -0.85), 0.094), tw = legW(b)(SD.thigh * 0.45);
    dPlate(B, 0.13, 0.22, 0.02, tm, tw, G.steel, -2.4);
    gBox(B, 0.11, 0.024, 0.004, 0, tm.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.08, 0.014)), tw, G.hazard, 'paint', -2.4, 0);
  }
  // chest plate: bevelled, two hazard bands at the top, rivets around it; back plate with hazard stripes and rivets
  const cm = gMat(0, 1.3, -0.194, 0.12);
  gBox(B, 0.29, 0.2, 0.032, hi ? 0.016 : 0, cm, SB.CHE, G.steel, 'plate', 1.2, hi ? 2 : 0);
  ofHazard(B, cm.clone().multiply(new THREE.Matrix4().makeTranslation(-0.075, 0.068, 0.02)), 0.11, 0.032, SB.CHE, G, 5);
  ofHazard(B, cm.clone().multiply(new THREE.Matrix4().makeTranslation(0.075, 0.068, 0.02)), 0.11, 0.032, SB.CHE, G, 5);
  if (hi) ofRivets(B, hi, cm.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.017)), [[-0.125, 0.08], [0.125, 0.08], [-0.13, 0], [0.13, 0], [-0.125, -0.08], [0.125, -0.08], [0, -0.085]], SB.CHE, G.steel2);
  const bm = gMat(0, 1.27, 0.152, -0.07, Math.PI);
  ofHazard(B, bm.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.05, 0)), 0.27, 0.085, SB.CHE, G, 7);
  if (hi) ofRivets(B, hi, bm, [[-0.12, 0.12], [0.12, 0.12], [-0.12, -0.08], [0.12, -0.08], [0, -0.13]], SB.CHE, G.steel2);
  dArmor(B, G, hi, { fore: G.steel, foreAcc: G.hazard, knee: G.steel, kneeAcc: G.hazard, pauldron: G.steel2, pauldronAcc: G.hazard });
}
function ofBulwarkTag(B, skin, hi) { ofkTagShell(B, hi, OF_BULWARK_HELM, 2 / 6 * OF_BULWARK_HELM.jaw, 0.024); }

/* ---------- Standard-Bearer ---------- */
/* Banner: crimson field, ivory border, ivory shield with a crimson chevron and a diamond above it */
function ofBannerArt(g, W, H) {
  const R = ofkArtCloth(g, W, H, '#741820', 991, 0.2, 80), cx = W / 2, iv = '#eee4cc', cr = '#741820';
  g.fillStyle = iv; g.fillRect(0, 0, W * 0.06, H); g.fillRect(W * 0.94, 0, W * 0.06, H); g.fillRect(0, H * 0.76, W, H * 0.03); g.fillRect(0, 0, W, H * 0.02);
  const top = H * 0.12, sw = W * 0.27, sh = H * 0.4;
  ofkPoly(g, [[cx - sw, top], [cx + sw, top], [cx + sw, top + sh * 0.55], [cx, top + sh], [cx - sw, top + sh * 0.55]]);
  g.fillStyle = cr; ofkPoly(g, [[cx - sw * 0.8, top + sh * 0.62], [cx, top + sh * 0.2], [cx + sw * 0.8, top + sh * 0.62], [cx + sw * 0.8, top + sh * 0.42], [cx, top + sh * 0.0 + H * 0.03], [cx - sw * 0.8, top + sh * 0.42]]);
  ofkPoly(g, [[cx, top + sh * 0.6], [cx + W * 0.05, top + sh * 0.72], [cx, top + sh * 0.84], [cx - W * 0.05, top + sh * 0.72]]);
  g.fillStyle = 'rgba(30,8,10,0.2)'; for (let i = 0; i < 30; i++) g.fillRect(W * (0.08 + R() * 0.84), R() * H * 0.74, 1 + R() * 2, 10 + R() * 30);
}
/* Standard-Bearer pieces: pole on the back, outside the head's outline, with a brass finial; ivory epaulettes and crest stripe */
function ofBannerModel(B, skin, hi) {
  const G = skinGear(skin), hm = ofkHM(), base = new V3(0.15, 1.42, 0.125), top = new V3(0.23, 1.9, 0.2), tw = torsoW(base.clone()), d = top.clone().sub(base).normalize();
  // pole, collar and finial: one rigid piece on the back, all on the same weights, the finial on the pole's axis
  dHorn(B, [base, base.clone().lerp(top, 0.5), top], 0.015, 0.013, tw, G.wood, 'leat', hi ? 7 : 4);
  dHorn(B, [top.clone().addScaledVector(d, -0.01), top.clone().addScaledVector(d, 0.03), top.clone().addScaledVector(d, 0.085)], 0.022, 0.002, tw, G.brass, 'gloss', hi ? 8 : 5);
  gCyl(B, 0.021, 0.021, 0.026, hi ? 8 : 5, new THREE.Matrix4().makeBasis(new V3(1, 0, 0).addScaledVector(d, -d.x).normalize(), d, new V3().crossVectors(new V3(1, 0, 0).addScaledVector(d, -d.x).normalize(), d)).setPosition(top.clone().addScaledVector(d, -0.004)), tw, G.brass, 'gloss');
  gBox(B, 0.03, 0.18, 0.012, hi ? 0.004 : 0, hm.clone().multiply(gMat(0, 0.13, 0.0, Math.PI / 2 - 0.05)), SB.HEA, G.ivory, 'paint');
  dArmor(B, G, hi, { pauldron: G.ivory, pauldronAcc: G.crimson, knee: G.ivory });
}
/* Standard-Bearer cloth: banner cape from the shoulders to the calves, a shallow swallowtail; a large crimson pennant at the top of the pole */
function ofBannerCloth(skin) {
  const G = skinGear(skin), base = new V3(0.15, 1.42, 0.125), top = new V3(0.23, 1.9, 0.2), d = top.clone().sub(base).normalize(), tw = torsoW(base.clone());
  const banner = ofkCape({ bottom: 0.46, span: 1.0, flare: 0.02, hem: (s) => 1 - 0.09 * Math.max(0, 1 - Math.abs(s - 0.5) * 5), slack: 0.65, cu: 13 });
  // the pennant's inner edge runs along the pole's axis (same weights as the pole, pinned), the cloth flies out from it
  const dir = new V3(0.25, -0.1, 1).addScaledVector(d, -new V3(0.25, -0.1, 1).dot(d)).normalize();
  const pennant = clothStrip({ p0: base.clone().lerp(top, 0.76), dir, side: d, len: 0.46, w0: 0.2, w1: 0.008, cu: 3, rv: 9,
    w: () => tw, maxD: (t) => (t < 0.01 ? 0.002 : 0.02 + t * 0.4), uv: () => GEAR_TILE.fab, col: G.crimson, shade: 0.75 });
  return clothBuild([banner, pennant], { drag: 1.05 });
}

/* ---------- Sapper ---------- */
const OF_SAPPER_HELM = { c: [0, 0.02, 0.0], s: [0.138, 0.148, 0.152], jaw: 2.15, seg: 12, rows: 6, snout: 0.04 };
/* Sapper pieces: padding quilted in diamonds over the torso, high collar, blast helmet with visor and orange stripe, three charges wired on
   the chest, strapped satchel on the back, satchels on the hips, crossed straps, orange accents */
function ofSapperModel(B, skin, hi) {
  const G = skinGear(skin), rows = SOLDIER_SHIRT.filter((r) => r[0] >= 1.0 && r[0] <= 1.43), H = OF_SAPPER_HELM;
  skinLoft(B, rows.map(([y, w, f, bk, zc]) => ({ c: new V3(0, y, zc), X: new V3(1, 0, 0), Y: new V3(0, 0, -1), r: [w + 0.036, w + 0.036, f + 0.042, bk + 0.036], n: 2.4, v: y })), hi ? 34 : 12, {
    wp: (p) => torsoW(p), col: (a, k) => ((k + Math.floor(a / TAU * 18)) % 2 ? G.pad : G.pad2), uv: () => GEAR_TILE.fab, bump: (a, k) => (k % 2 ? 0.008 : -0.004) + 0.004 * Math.abs(Math.sin(a * 9)) });
  // high collar: higher at the back than in front, flared clear of the chin
  const v = new V3();
  skinSurf(B, hi ? 24 : 10, hi ? 4 : 2, (u, vv, o) => {
    const a = u * TAU, h = lerp(1.43, 1.5 + 0.11 * (1 - Math.cos(a)) / 2, vv), r = lerp(0.135, 0.12 + 0.012 * Math.cos(a), vv);
    v.set(Math.sin(a) * r, h, -Math.cos(a) * (r + 0.005 * Math.cos(a)) + 0.004);
    o.x = v.x; o.y = v.y; o.z = v.z; o.w = vv > 0.4 ? [[SB.NEC, 0.5], [SB.CHE, 0.5]] : torsoW(v); o.col = vv > 0.85 ? G.orange : G.pad; o.U = GEAR_TILE.fab[0]; o.V = GEAR_TILE.fab[1];
  });
  ofkShell(B, hi, H, G.helm, 'plate');
  ofkVisor(B, hi, H, 1.05, 1.15, 0.92, G.visor, 'lens', 0.004);
  for (const ph of [Math.PI * 1.5, Math.PI / 2]) ofkShell(B, hi, H, G.orange, 'paint', ph - 0.14, 0.28, 0, ph > Math.PI ? 1.1 : 1.6, 0.003, 0.4);
  // three charges strapped across the chest, wired to a detonator
  for (const x of [-0.075, 0, 0.075]) gBox(B, 0.05, 0.08, 0.034, hi ? 0.006 : 0, gMat(x, 1.29, -0.184, 0.14), SB.CHE, G.orange, 'paint');
  gBox(B, 0.24, 0.018, 0.04, 0, gMat(0, 1.29, -0.18, 0.14), SB.CHE, G.strap, 'nyl', 0, 0);
  gBox(B, 0.05, 0.035, 0.03, hi ? 0.006 : 0, gMat(0.11, 1.18, -0.18, 0.1), SB.CHE, G.dark, 'poly');
  if (hi) for (const x of [-0.075, 0, 0.075]) gBand(B, [new V3(x, 1.25, -0.2), new V3((x + 0.11) / 2, 1.2, -0.205), new V3(0.1, 1.19, -0.198)], 0.006, 0.006, () => new V3(0, 0, -1), SB.CHE, G.wire, ofkTile('rub'), 4);
  // strapped satchel on the back
  ofkSatchel(B, hi, new V3(0, 1.22, 0.138), new V3(0, 0.05, 1), [0.23, 0.2, 0.08], G.bag, G.orange, null, SB.CHE);
  for (const x of [-0.137, 0.137]) gBox(B, 0.026, 0.22, 0.086, 0, gMat(x, 1.22, 0.178, 0.05), SB.CHE, G.strap, 'nyl', 0, 0); // (beside the flap, not across it)
  ofkSatchel(B, hi, new V3(0.17, 0.98, -0.04), new V3(1, 0, -0.35), [0.11, 0.1, 0.07], G.bag, G.orange, G.metal, [[SB.PEL, 0.6], [SB.THR, 0.4]]);
  ofkSatchel(B, hi, new V3(-0.17, 0.98, -0.04), new V3(-1, 0, -0.35), [0.11, 0.1, 0.07], G.bag, G.orange, G.metal, [[SB.PEL, 0.6], [SB.THL, 0.4]]);
  for (const s of [-1, 1]) gBand(B, [[s * 0.12, 1.47, 0.0], [s * 0.11, 1.43, -0.135], [-s * 0.02, 1.36, -0.184], [-s * 0.12, 1.16, -0.182], [-s * 0.18, 1.05, -0.11]].map(([x, y, z]) => new V3(x, y, z)), 0.04, 0.01, (p) => new V3(p.x * 0.3, 0.2, p.z).normalize(), (p) => torsoW(p), G.strap, (u, vv) => atlasUV('web', u * 0.3, vv), hi ? 8 : 4);
  for (const sx of [-1, 1]) ofkLimbRing(B, hi, sx, true, 0.46, 0.03, 0.005, G.orange, 'fab');
  dArmor(B, G, hi, { thigh: G.pad2, knee: G.orange, shin: G.pad2 });
}
function ofSapperTag(B, skin, hi) { ofkTagShell(B, hi, OF_SAPPER_HELM, 2 / 6 * OF_SAPPER_HELM.jaw, 0.024); }

/* ---------- Skyhook ---------- */
/* Skyhook pieces: antenna pack, a quad drone docked on a mast above it (above the shoulders: body, four arms, rotor discs, cyan lights), two
   thick whips with lit tips, a dish, glowing ear cups, controller on the chest, cyan lines on the sleeves and legs */
function ofSkyModel(B, skin, hi) {
  const G = skinGear(skin), C = G.glowc, hm = ofkHM();
  const pm = ofkPack(B, hi, { y: 1.23, z: 0.137, w: 0.22, h: 0.3, d: 0.08, col: G.pack, flap: G.pack2 });
  for (const x of [-0.075, 0.075]) gBox(B, 0.014, 0.22, 0.004, 0, pm.clone().multiply(new THREE.Matrix4().makeTranslation(x, 0, 0.042)), SB.CHE, C, 'glow', 0, 0);
  // the docked drone
  const dc = new V3(0, 1.605, 0.245);
  gBox(B, 0.034, 0.23, 0.034, hi ? 0.006 : 0, gMat(0, 1.47, 0.215, -0.15), SB.CHE, G.pack2, 'poly');
  gBox(B, 0.13, 0.042, 0.12, hi ? 0.012 : 0, gMat(dc.x, dc.y, dc.z), SB.CHE, G.drone, 'poly');
  gBox(B, 0.05, 0.014, 0.05, hi ? 0.005 : 0, gMat(dc.x, dc.y + 0.027, dc.z), SB.CHE, C, 'glow');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const a = new V3(dc.x + sx * 0.05, dc.y, dc.z + sz * 0.045), b = new V3(dc.x + sx * 0.17, dc.y + 0.012, dc.z + sz * 0.125);
    gBand(B, [a, a.clone().lerp(b, 0.5), b], 0.022, 0.018, () => new V3(0, 1, 0), SB.CHE, G.drone, ofkTile('poly'), 4);
    gCyl(B, 0.014, 0.014, 0.03, hi ? 8 : 5, gMat(b.x, b.y + 0.012, b.z), SB.CHE, G.pack2, 'poly');
    gCyl(B, 0.062, 0.062, 0.005, hi ? 16 : 8, gMat(b.x, b.y + 0.03, b.z), SB.CHE, G.rotor, 'poly');
    gCyl(B, 0.064, 0.064, 0.003, hi ? 16 : 8, gMat(b.x, b.y + 0.026, b.z), SB.CHE, C, 'glow');
  }
  for (const [x, h] of [[0.125, 0.55], [-0.125, 0.44]]) {
    const p0 = new V3(x, 1.27, 0.225), pts = [p0, p0.clone().add(new V3(x * 0.35, h * 0.5, 0.05)), p0.clone().add(new V3(x * 0.6, h, 0.075))];
    gBand(B, pts, 0.03, 0.03, () => new V3(0, 0, 1), SB.CHE, G.poly, ofkTile('rub'), 4);
    gCyl(B, 0.024, 0.024, 0.04, hi ? 8 : 5, gMat(p0.x, p0.y + 0.012, p0.z), SB.CHE, G.poly, 'poly');
    B.geo(dFlat(new THREE.IcosahedronGeometry(1, hi ? 1 : 0)), new THREE.Matrix4().compose(pts[2], new THREE.Quaternion(), new V3(0.026, 0.026, 0.026)), SB.CHE, C, ofkTile('glow'));
  }
  gCyl(B, 0.06, 0.03, 0.028, hi ? 14 : 7, gMat(0.14, 1.2, 0.2, 0, 0, -1.2), SB.CHE, G.pack2, 'poly');
  for (const s of [-1, 1]) gCyl(B, 0.03, 0.03, 0.004, hi ? 12 : 6, hm.clone().multiply(gMat(s * 0.104, -0.006, 0.012, 0, 0, Math.PI / 2)), SB.HEA, C, 'glow');
  const cm = gMat(0.0, 1.335, -0.19, 0.25);
  gBox(B, 0.11, 0.07, 0.025, hi ? 0.008 : 0, cm, SB.CHE, G.poly, 'poly');
  gBox(B, 0.07, 0.04, 0.004, 0, cm.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.004, 0.013)), SB.CHE, C, 'glow', 0, 0);
  for (const sx of [-1, 1]) {
    ofkLimbLine(B, hi, sx, true, 0.2, 0.28, 0, 0.022, 0.003, C, 'glow', 2);
    ofkLimbLine(B, hi, sx, true, 0.32, 0.5, 0, 0.022, 0.003, C, 'glow', 4);
    ofkLimbLine(B, hi, sx, false, 0.03, 0.62, 0, 0.024, 0.003, C, 'glow', 8);
  }
  dArmor(B, G, hi, { knee: G.knee, kneeAcc: C, kneeTile: 'glow' });
}

/* ---------- Marshal ---------- */
/* Duster: plain tan canvas, darker stitched seams, a vent up the back */
function ofMarshalArt(g, W, H) {
  // top: the duster's body and sleeves; middle: the yoke cape with the shield; bottom: the tails, seams and a vent
  const R = ofkArtCloth(g, W, H, '#ad9068', 1103, 0.25, 100), cx = W / 2;
  g.strokeStyle = 'rgba(70,50,30,0.6)'; g.lineWidth = 2; g.setLineDash([5, 4]);
  for (const x of [W * 0.12, W * 0.88, W * 0.5]) { g.beginPath(); g.moveTo(x, H * 0.62); g.lineTo(x, H); g.stroke(); }
  g.beginPath(); g.moveTo(0, H * 0.6); g.lineTo(W, H * 0.6); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#9a7e58'; g.fillRect(0, H * 0.3, W, H * 0.3);
  g.strokeStyle = 'rgba(60,40,24,0.7)'; g.setLineDash([5, 4]); g.strokeRect(W * 0.04, H * 0.31, W * 0.92, H * 0.27); g.setLineDash([]);
  const top = H * 0.34, sw = W * 0.2, sh = H * 0.2; // the shield, large, in brass
  g.fillStyle = '#8a5c16'; ofkPoly(g, [[cx - sw, top], [cx + sw, top], [cx + sw, top + sh * 0.5], [cx, top + sh], [cx - sw, top + sh * 0.5]]);
  g.fillStyle = '#3a2412'; ofkPoly(g, [[cx - sw * 0.7, top + sh * 0.1], [cx + sw * 0.7, top + sh * 0.1], [cx + sw * 0.7, top + sh * 0.47], [cx, top + sh * 0.84], [cx - sw * 0.7, top + sh * 0.47]]);
  for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(90,70,40,0.15)'; g.fillRect(R() * W, H * (0.66 + R() * 0.34), 2 + R() * 6, 2 + R() * 6); }
}
/* Wide-brim hat: pinched crown with a crease, brim curled up at the sides */
const OF_WIDEBRIM = { rx: 0.086, rz: 0.108, prof: [[0, 0.168], [0.35, 0.17], [0.7, 0.16], [0.92, 0.12], [1.0, 0.075], [1.02, 0.04], [1.03, 0.032], [1.9, 0.03], [1.92, 0.022], [1.88, 0.018], [1.03, 0.024]],
  dy: (a, r) => (r < 0.8 ? -0.02 * Math.exp(-((Math.sin(a) * r / 0.22) ** 2)) * (1 - r) : r > 1.05 ? (r - 1.05) * (0.04 * Math.sin(a) ** 2 - 0.012 * Math.cos(a) ** 2) : 0) };
/* Holster on the hip at p, the revolver's grip leaning out of it (side sx) */
function ofHolster(B, hi, p, sx, G) {
  const wt = [[SB.PEL, 0.6], [sx > 0 ? SB.THR : SB.THL, 0.4]], m = gMat(p.x, p.y, p.z, 0.1, sx * 0.5, sx * 0.12);
  gBox(B, 0.05, 0.13, 0.034, hi ? 0.008 : 0, m, wt, G.leather, 'leat');
  gBox(B, 0.024, 0.06, 0.03, hi ? 0.006 : 0, m.clone().multiply(gMat(sx * 0.008, 0.085, 0.004, 0, 0, sx * 0.35)), wt, G.grip, 'leat');
}
/* Marshal pieces: hat, bandana, duster (body, sleeves, collar), leather waistcoat, brass shield badge, cartridge belt, two hip holsters */
function ofMarshalModel(B, skin, hi) {
  const G = skinGear(skin);
  ofkLathe(B, hi, Object.assign({ c: G.hat, col: (k) => (k === 5 || k === 6 ? G.hatband : G.hat), tile: 'fab' }, OF_WIDEBRIM));
  dScarf(B, G.kerchief, hi, 0.9, 'fab', 0.1);
  const rows = SOLDIER_SHIRT.filter((r) => r[0] >= 1.06 && r[0] <= 1.35);
  skinLoft(B, rows.map(([y, w, f, bk, zc]) => ({ c: new V3(0, y, zc), X: new V3(1, 0, 0), Y: new V3(0, 0, -1), r: [w + 0.008, w + 0.008, f + 0.01, bk + 0.008], n: 2.4, v: y })), hi ? 34 : 12,
    { wp: (p) => torsoW(p), col: (a) => (Math.abs(Math.cos(a)) < 0.05 && Math.sin(a) > 0 ? G.leather.clone().multiplyScalar(0.55) : G.leather), uv: () => GEAR_TILE.leat });
  // the duster's body, sleeves and collar in the canvas of its tails (emblem zone)
  ofkCoat(B, hi, { g: 0.024, gap0: 0.38, gap1: 0.46, flare: 0, col: OFK_WHITE, uv: (A, y) => atlasUV('art', 0.02 + A / TAU * 0.96, (1.49 - y) / 0.44 * 0.28) });
  for (const sx of [-1, 1]) ofkLimbTube(B, hi, sx, true, -0.03, 0.47, 0.01, OFK_WHITE, 'fab', { col: (u, v) => (v > 0.9 ? G.cuff : OFK_WHITE), bulge: (v) => 0.004 * Math.sin(v * Math.PI), uv: (u, v) => atlasUV('art', 0.6 + u * 0.3, 0.03 + v * 0.24) });
  ofkCollar(B, hi, 0.62, 1.46, 1.55, 0.13, 0.03, G.collar, 'fab');
  ofkTagArms(B, hi, 0.019);
  if (hi) gBox(B, 0.05, 0.034, 0.004, 0.0015, gMat(-0.048, 1.215, -0.14, 0.1), SB.CHE, OFK_WHITE, 'tag'); // (chest patch on the vest under the badge, in the coat's opening)
  const shield = [[-0.022, 0.026], [0.022, 0.026], [0.022, -0.004], [0, -0.03], [-0.022, -0.004]];
  dExtrude(B, shield, 0.006, hi ? 0.0015 : 0, gMat(-0.05, 1.29, -0.134, 0.1), SB.CHE, G.brass, 'gloss');
  for (let i = 0; i < (hi ? 12 : 6); i++) {
    const a = -1.3 + i * (2.6 / ((hi ? 12 : 6) - 1)), x = Math.sin(a) * 0.164, z = -Math.cos(a) * 0.114;
    dShell(B, G, new V3(x, 1.035, z), new V3(0, 1, 0), new V3(Math.sin(a), 0, -Math.cos(a)), hi, 0.036);
  }
  for (const sx of [-1, 1]) ofHolster(B, hi, new V3(sx * 0.14, 0.965, -0.105), sx, G);
}
function ofMarshalTag(B, skin, hi) { ofkTagLathe(B, hi, OF_WIDEBRIM, 1.02, 0.05); }
/* Marshal cloth: duster tails from the coat's waist ring to mid-calf, open in front like the coat; a yoke cape over the shoulders with the shield */
function ofMarshalCloth() {
  return clothBuild([ofkTails({ bottom: 0.27, a0: 0.38, a1: TAU - 0.38, coat: 0.024, flare: 0.08, cu: 15, hem: (s) => 1 - 0.1 * Math.max(0, 1 - Math.abs(s - 0.5) * 30), slack: 0.36, uv: (s, t) => atlasUV('art', 1 - s, 0.62 + t * 0.37) }),
    ofkCape({ bottom: 1.12, span: 1.25, flare: 0.05, back: 0.012, slack: 0.45, cu: 13, uv: (s, t) => atlasUV('art', 1 - s, 0.31 + t * 0.28) })]);
}

/* ---------- Shade ---------- */
/* Tight cowl: down to the brow in front, to the jaw on the sides, the nape covered */
const ofShadeCowlTh = (ph) => { const a = Math.abs(ph); return a < 0.6 ? 1.14 : a < 1.3 ? lerp(1.14, 2.62, smoothstep(0.6, 1.3, a)) : lerp(2.62, 2.95, smoothstep(1.3, 2.6, a)); };
/* Shade pieces: cowl and neck gaiter, a red line across the eyes, dark wraps on the torso and limbs, dark-red sash and its knot, a long
   sheathed blade across the lower back, a row of knives on a chest strap, throwing knives on the thigh */
function ofShadeModel(B, skin, hi) {
  const G = skinGear(skin), hm = ofkHM(), v = new V3();
  ofkSkullCap(B, hi, { th: ofShadeCowlTh, grow: 0.009, c: G.cowl, tile: 'fab', bump: (th, ph) => 0.002 * Math.sin(th * 9 + ph * 3) });
  const ng = [[1.45, 0.11, 0.09, 0.095], [1.5, 0.085, 0.078, 0.082], [1.56, 0.075, 0.07, 0.074]];
  skinLoft(B, ng.map(([y, w, f, bk]) => ({ c: new V3(0, y, 0.004), X: new V3(1, 0, 0), Y: new V3(0, 0, -1), r: [w, w, f, bk], n: 2.2, v: y })), hi ? 18 : 8, { wp: (p) => (p.y > 1.5 ? [[SB.NEC, 0.7], [SB.CHE, 0.3]] : torsoW(p)), col: () => G.cowl, uv: () => GEAR_TILE.fab });
  skinSurf(B, hi ? 14 : 6, 1, (u, vv, o) => {
    const ph = (u - 0.5) * 1.8, th = 1.47 + (vv - 0.5) * 0.06;
    headPt(th, ph, v, 0.013 + 0.003 * Math.cos(ph)).applyMatrix4(hm); o.x = v.x; o.y = v.y; o.z = v.z; o.w = SB.HEA; o.col = G.glowc; o.U = GEAR_TILE.glow[0]; o.V = GEAR_TILE.glow[1];
  }, { out: true });
  for (const [a0, a1] of [[-0.6, 5.4], [0.6, -5.4]]) {
    const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push([lerp(1.36, 1.15, t), lerp(a0, a1, t)]); }
    ofkShirtLine(B, hi, pts, { w: 0.034, g: 0.005, col: G.wrap, tile: 'fab' });
  }
  for (const sx of [-1, 1]) {
    for (const d of [0.34, 0.39, 0.44]) ofkLimbRing(B, hi, sx, true, d, 0.03, 0.002, G.wrap, 'fab');
    for (const d of [0.5, 0.55, 0.6]) ofkLimbRing(B, hi, sx, false, d, 0.034, 0.002, G.wrap, 'fab');
  }
  const sr = [[0.99, 0.166, 0.112, 0.118], [1.02, 0.174, 0.118, 0.124], [1.08, 0.17, 0.12, 0.122], [1.11, 0.164, 0.116, 0.116]];
  skinLoft(B, sr.map(([y, w, f, bk]) => ({ c: new V3(0, y, 0), X: new V3(1, 0, 0), Y: new V3(0, 0, -1), r: [w, w, f, bk], n: 2.5, v: y })), hi ? 30 : 12, { wp: (p) => torsoW(p), col: (a, k) => (k === 0 || k === 3 ? G.sash.clone().multiplyScalar(0.6) : G.sash), uv: () => GEAR_TILE.fab });
  ofkClumps(B, hi, [{ p: new V3(-0.172, 1.05, -0.05), n: new V3(-1, 0, -0.3).normalize(), w: torsoW(new V3(-0.17, 1.05, -0.05)) }], 0.036, [G.sash], 9);
  // the blade across the lower back: sheath, guard, wrapped grip out past the right hip, chape at the left end
  const bw = [[SB.PEL, 0.55], [SB.SPI, 0.45]], bm = gMat(-0.02, 1.1, 0.142, 0, 0, -0.3);
  gBox(B, 0.5, 0.05, 0.026, hi ? 0.01 : 0, bm, bw, G.sheath, 'leat');
  gBox(B, 0.5, 0.008, 0.028, 0, bm.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.016, 0)), bw, G.glowd, 'paint', 0, 0);
  gBox(B, 0.016, 0.075, 0.04, hi ? 0.004 : 0, bm.clone().multiply(new THREE.Matrix4().makeTranslation(0.258, 0, 0)), bw, G.blade, 'met');
  gBox(B, 0.13, 0.03, 0.03, hi ? 0.008 : 0, bm.clone().multiply(new THREE.Matrix4().makeTranslation(0.33, 0, 0)), bw, G.glowd, 'fab');
  gBox(B, 0.03, 0.054, 0.03, hi ? 0.008 : 0, bm.clone().multiply(new THREE.Matrix4().makeTranslation(-0.255, 0, 0)), bw, G.blade, 'met');
  // knives on a chest strap: from the right shoulder to the left ribs, four grips up
  const sp = [[0.12, 1.47, -0.02], [0.1, 1.42, -0.125], [0.02, 1.32, -0.15], [-0.07, 1.22, -0.15], [-0.14, 1.14, -0.11]].map(([x, y, z]) => new V3(x, y, z));
  let kn = 0;
  dSling(B, sp, 0.04, 0.01, G.strap, hi, 0.055, (p, T, n) => {
    if (kn++ > 3) return;
    const m = new THREE.Matrix4().makeBasis(new V3().crossVectors(new V3(0, 1, 0), n).normalize(), new V3(0, 1, 0), n).setPosition(p.clone().addScaledVector(n, 0.014));
    gBox(B, 0.024, 0.07, 0.012, hi ? 0.004 : 0, m, torsoW(p), G.sheath, 'leat');
    gBox(B, 0.014, 0.05, 0.014, hi ? 0.004 : 0, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.055, 0.002)), torsoW(p), G.grip, 'leat');
  });
  const R = soldierRest(), J = R.J, b = SIDE_B(1);
  for (let i = 0; i < 3; i++) {
    const m = dSeg(J[b.jHi], J[b.jKn], 0.35 + i * 0.12, new V3(1, 0, -0.35), 0.095).multiply(gMat(0, 0, 0, 0, 0, Math.PI / 2)), wt = legW(b)(SD.thigh * (0.35 + i * 0.12));
    gBox(B, 0.09, 0.018, 0.006, 0, m, wt, G.blade, 'met', 0, 0);
  }
}
function ofShadeTag(B, skin, hi) { ofkTagSkull(B, hi, 0.78, 0.014, 0, 0.026); }
/* Shade cloth: two wide dark-red sash tails from the knot on the left hip to the knee */
function ofShadeCloth(skin) {
  const G = skinGear(skin), sheets = [];
  sheets.push(clothStrip({ p0: new V3(-0.18, 1.03, -0.06), dir: new V3(-0.12, -1, -0.05).normalize(), side: new V3(0, 0, 1), len: 0.64, w0: 0.15, w1: 0.11, cu: 3, rv: 11,
    w: (p) => clothHipW(p), maxD: (t) => 0.015 + t * 0.4, uv: () => GEAR_TILE.fab, col: G.sash, shade: 0.7 }));
  sheets.push(clothStrip({ p0: new V3(-0.176, 1.03, 0.03), dir: new V3(-0.1, -1, 0.1).normalize(), side: new V3(0, 0, 1), len: 0.56, w0: 0.12, w1: 0.09, cu: 3, rv: 10,
    w: (p) => clothHipW(p), maxD: (t) => 0.015 + t * 0.4, uv: () => GEAR_TILE.fab, col: G.sash2, shade: 0.7 }));
  return clothBuild(sheets, { drag: 1.1 });
}

/* ---------- Aurum ---------- */
const OF_AURUM_HELM = { c: [0, 0.016, -0.004], s: [0.124, 0.136, 0.138], jaw: 2.35, seg: 10, rows: 7, snout: 0.09, pinch: 0.08, crest: 0.05 };
/* Short cape: flat black, gold lining shown as a border, gold ring and diamond */
function ofAurumArt(g, W, H) {
  g.fillStyle = '#141416'; g.fillRect(0, 0, W, H);
  const gold = '#8a6418', cx = W / 2, cy = H * 0.3;
  g.fillStyle = gold; g.fillRect(0, 0, W * 0.06, H); g.fillRect(W * 0.94, 0, W * 0.06, H); g.fillRect(0, H * 0.84, W, H * 0.07);
  g.strokeStyle = gold; g.lineWidth = W * 0.035; g.beginPath(); g.arc(cx, cy, W * 0.16, 0, TAU); g.stroke();
  ofkPoly(g, [[cx, cy - W * 0.11], [cx + W * 0.06, cy], [cx, cy + W * 0.11], [cx - W * 0.06, cy]]);
}
/* Aurum pieces: black helmet with a gold visor, a gold laurel band around the back and a gold diamond on the brow, gold shoulder domes, gold
   trim on the vest, gold plates on the limbs */
function ofAurumModel(B, skin, hi) {
  const G = skinGear(skin), H = OF_AURUM_HELM, hm = ofkHM(), f = ofkShellPt(H), th = 4 / 7 * H.jaw;
  ofkShell(B, hi, H, G.black, 'gloss');
  ofkVisor(B, hi, H, 1.0, 1.2, 0.5, G.gold, 'gloss', 0.004);
  ofkShell(B, hi, H, G.gold, 'gloss', Math.PI / 2 - 1.15, 2.3, th - 0.07, 0.14, 0.004, 0.7);
  if (hi) for (let i = 0; i < 14; i++) { // leaves along the band, pointing forward on each side
    const s = i < 7 ? 1 : -1, k = i % 7, ph = Math.PI / 2 + s * (0.2 + k * 0.14), p = f(-Math.cos(ph) * Math.sin(th - 0.1), Math.cos(th - 0.1), Math.sin(ph) * Math.sin(th - 0.1), 0.007), d = f(-Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th), 0).sub(new V3(...H.c)).normalize();
    const y = new V3(0, 1, 0), x = new V3().crossVectors(y, d).normalize(), m = new THREE.Matrix4().makeBasis(x, new V3().crossVectors(d, x), d).setPosition(p).multiply(gMat(0, 0, 0, 0, 0, s * 0.9));
    B.geo(dFlat(new THREE.IcosahedronGeometry(1, 0)), hm.clone().multiply(m).multiply(new THREE.Matrix4().makeScale(0.016, 0.007, 0.004)), SB.HEA, G.gold, ofkTile('gloss'));
  }
  const dp = f(0, Math.cos(0.95), -Math.sin(0.95), 0.005), dn = dp.clone().sub(new V3(...H.c)).normalize(), dx = new V3(1, 0, 0), dm = new THREE.Matrix4().makeBasis(dx, new V3().crossVectors(dn, dx), dn).setPosition(dp);
  dExtrude(B, [[0, 0.024], [0.018, 0], [0, -0.024], [-0.018, 0]], 0.008, 0, hm.clone().multiply(dm), SB.HEA, G.gold, 'gloss');
  for (const sx of [-1, 1]) ofkDome(B, hi, sx, { r: [0.095, 0.06, 0.1], off: [0.025, 0.048, 0.0], col: G.gold, tile: 'gloss', roll: 0.5, seg: 10 });
  for (const [x, y, z, w, h, rx] of [[0, 1.4, -0.168, 0.24, 0.014, 0.12], [0, 1.065, -0.16, 0.28, 0.014, 0.12], [0, 1.42, 0.14, 0.26, 0.014, -0.07]]) gBox(B, w, h, 0.008, 0, gMat(x, y, z, rx), SB.CHE, G.gold, 'gloss', 0, 0);
  dArmor(B, G, hi, { fore: G.gold, shin: G.gold, knee: G.black, kneeAcc: G.gold, plateTile: 'gloss' });
}
function ofAurumTag(B, skin, hi) { ofkTagShell(B, hi, OF_AURUM_HELM, 3 / 7 * OF_AURUM_HELM.jaw, 0.022); }
function ofAurumCloth() { return clothBuild([ofkCape({ bottom: 0.55, span: 1.05, flare: 0.07, slack: 0.7, cu: 13 })]); }

/* ---------- Trapper ---------- */
/* Fur hat: round shaggy crown */
const OF_FURHAT = { rx: 0.095, rz: 0.118, prof: [[0, 0.17], [0.5, 0.167], [0.85, 0.152], [1.05, 0.112], [1.13, 0.07], [1.14, 0.036], [1.07, 0.018], [1.0, 0.024]],
  dy: (a, r, k) => (k > 0 && k < 7 ? 0.009 * Math.sin(a * 7 + k * 2.3) : 0) };
/* Trapper pieces: fur hat (crown, band of clumps, thick ear flaps, a long ringed tail), fur mantle with its fringe and lighter clumps, bone
   toggles, pack and bedroll, leather patches, knife */
function ofTrapperModel(B, skin, hi) {
  const G = skinGear(skin), hm = ofkHM(), v = new V3(), F = G.furs;
  ofkLathe(B, hi, Object.assign({ col: (k, a) => F[(k + Math.floor(a * 2.5)) % F.length], tile: 'hair' }, OF_FURHAT));
  const hp = []; for (let i = 0; i < 22; i++) { const a = i / 22 * TAU; hp.push({ p: new V3(Math.sin(a) * 0.106, 0.045, 0.004 - Math.cos(a) * 0.13).applyMatrix4(hm), n: new V3(Math.sin(a), 0.2, -Math.cos(a)).transformDirection(hm), w: SB.HEA }); }
  ofkClumps(B, hi, hp, 0.036, F, 23);
  // ear flaps: thick fur pads hanging down past the jaw, lighter at their edge
  for (const s of [-1, 1]) for (const inner of [false, true]) skinSurf(B, hi ? 6 : 3, hi ? 5 : 2, (u, vv, o) => {
    const ph = s * (Math.PI / 2 + (u - 0.5) * 1.2), th = lerp(1.2, 2.5 - 0.35 * Math.abs(u - 0.5) * 2, vv);
    headPt(th, ph, v, (inner ? 0.012 : 0.04) + 0.016 * Math.sin(u * Math.PI) * Math.sin(vv * Math.PI)).applyMatrix4(hm); o.x = v.x; o.y = v.y; o.z = v.z; o.w = th > 2.0 ? [[SB.HEA, 0.85], [SB.NEC, 0.15]] : SB.HEA;
    o.col = vv > 0.8 ? G.furL : F[3]; o.U = GEAR_TILE.hair[0]; o.V = GEAR_TILE.hair[1];
  }, { out: !inner });
  // the tail hanging from the back of the hat, ringed dark and light
  const t0 = new V3(0.03, 0.04, 0.125).applyMatrix4(hm), tp = [0, 1, 2, 3, 4, 5].map((i) => t0.clone().add(new V3(0.012 + i * 0.006, -i * 0.06, 0.035 + 0.012 * Math.sin(i * 0.8))));
  const tw = (p) => { const k = clamp((t0.y - p.y) / 0.3, 0, 1); return [[SB.HEA, 1 - k], [SB.NEC, k * 0.5], [SB.CHE, k * 0.5]]; };
  for (let i = 0; i < 5; i++) dHorn(B, [tp[i], tp[i + 1]], 0.04 - i * 0.004, 0.036 - i * 0.005, tw, i % 2 ? G.furL : F[0], 'hair', hi ? 8 : 5);
  ofkMantle(B, hi, 1.3, 0.86, 0.024, F[0], 'hair', F);
  // its ragged fur hem: short thick locks hanging all around
  const RF = mulberry32(53), mp = [];
  for (let i = 0; i < (hi ? 34 : 17); i++) {
    const A = (i + RF() * 0.6) / (hi ? 34 : 17) * TAU; if (Math.abs(Math.sin(A / 2)) < 0.4) continue; // (not in front: the weapon's place)
    const c = Math.cos(A), s = Math.sin(A), e = 2 / 2.2, p = new V3(Math.sign(s) * Math.abs(s) ** e * 0.262, 1.315, -Math.sign(c) * Math.abs(c) ** e * (c > 0 ? 0.21 : 0.186)), o = new V3(s, 0, -c).normalize(), L = 0.045 + RF() * 0.035;
    dHorn(B, [p.clone().addScaledVector(o, -0.008).add(new V3(0, 0.02, 0)), p.clone().addScaledVector(o, 0.006).add(new V3(0, -L * 0.5, 0)), p.clone().addScaledVector(o, 0.012).add(new V3(0, -L, 0))], 0.022, 0.004, ponchoWeights(p, A), F[i % F.length], 'hair', hi ? 6 : 4);
    if (i % 2) mp.push({ p: p.clone().addScaledVector(o, 0.01).add(new V3(0, 0.012, 0)), n: o.clone().add(new V3(0, 0.3, 0)).normalize(), w: ponchoWeights(p, A) });
  }
  ofkClumps(B, hi, mp, 0.034, [G.furL, G.furL2], 61); // lighter clumps along the mantle's edge
  ofkClumps(B, hi, [[0.12, 1.47, 0.04], [-0.12, 1.47, 0.04], [0.0, 1.45, 0.12], [0.17, 1.43, -0.02], [-0.17, 1.43, -0.02], [0.08, 1.45, 0.11], [-0.08, 1.45, 0.11]].map(([x, y, z]) => { const p = new V3(x, y, z); return { p, n: new V3(x, 0.8, z - 0.01).normalize(), w: torsoW(p) }; }), 0.05, F, 31);
  ofkButtons(B, hi, 1.33, 1.12, 4, G.bone, 'plate', true, 0.03);
  ofkPack(B, hi, { y: 1.24, z: 0.103, w: 0.21, h: 0.24, d: 0.08, col: G.leather, flap: G.leather2, tile: 'leat' });
  ofkPackStraps(B, hi, G.leather2, 0.04);
  gCyl(B, 0.06, 0.06, 0.38, hi ? 12 : 6, gMat(0, 1.41, 0.155, 0, 0, Math.PI / 2), SB.CHE, G.roll, 'fab');
  for (const x of [-0.11, 0.11]) gCyl(B, 0.064, 0.064, 0.02, hi ? 12 : 6, gMat(x, 1.41, 0.155, 0, 0, Math.PI / 2), SB.CHE, G.leather2, 'leat');
  gBox(B, 0.03, 0.14, 0.02, hi ? 0.006 : 0, gMat(0.16, 1.0, -0.07, 0, 0.4, 0.15), [[SB.PEL, 0.7], [SB.THR, 0.3]], G.leather2, 'leat');
  dArmor(B, G, hi, { fore: G.patch2, knee: G.patch2, plateTile: 'leat' });
}
function ofTrapperTag(B, skin, hi) { ofkTagLathe(B, hi, OF_FURHAT, 1.07, 0.1, 0.024, OFK_WHITE, 'tag', 0.008); }

/* ---------- Circuit ---------- */
const OF_CIRCUIT_HELM = { c: [0, 0.018, 0.004], s: [0.116, 0.128, 0.13], jaw: 2.25, seg: 12, rows: 6, snout: 0.16, pinch: 0.1, back: 0.22 };
/* Circuit board: a frame on the jacket at (y, A), its z the outward normal */
function ofCircuitAt(y, A, g) {
  const p = ofkShirtPt(y, A, g), n = ofkShirtPt(y, A, g + 0.03).sub(p).normalize(), x = new V3().crossVectors(new V3(0, 1, 0), n).normalize();
  return { p, n, x, w: torsoW(p), m: new THREE.Matrix4().makeBasis(x, new V3().crossVectors(n, x), n).setPosition(p) };
}
/* Square solder pad (copper, a dark hole in it) at frame m */
function ofCircuitPad(B, m, wt, s, G) {
  gBox(B, s, s, 0.004, 0, m, wt, G.copper, 'gloss', 0, 0);
  gBox(B, s * 0.38, s * 0.38, 0.002, 0, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.0025)), wt, G.chip, 'poly', 0, 0);
}
/* Chip at frame m: black body, copper legs on two sides (up close), an amber indicator light in a corner */
function ofCircuitChip(B, hi, m, wt, w, h, G, legs = 4) {
  gBox(B, w, h, 0.012, hi ? 0.002 : 0, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.006)), wt, G.chip, 'poly');
  if (hi) for (const sx of [-1, 1]) for (let i = 0; i < legs; i++) gBox(B, 0.012, 0.005, 0.004, 0, m.clone().multiply(new THREE.Matrix4().makeTranslation(sx * (w / 2 + 0.004), (i - (legs - 1) / 2) * h * 0.8 / legs, 0.002)), wt, G.copper, 'gloss', 0, 0);
  gBox(B, 0.009, 0.009, 0.003, 0, m.clone().multiply(new THREE.Matrix4().makeTranslation(w * 0.3, h * 0.3, 0.013)), wt, G.glowc, 'glow', 0, 0);
}
/* Capacitor standing on the board at frame F (from ofCircuitAt): dark can, copper top */
function ofCircuitCap(B, hi, F, r, h, G) {
  const z = new V3().crossVectors(F.x, F.n), m = new THREE.Matrix4().makeBasis(F.x, F.n, z).setPosition(F.p.clone().addScaledVector(F.n, h / 2));
  gCyl(B, r, r, h, hi ? 10 : 6, m, F.w, G.cap, 'gloss');
  gCyl(B, r * 0.8, r * 0.8, 0.004, hi ? 10 : 6, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, h / 2 + 0.001, 0)), F.w, G.copper, 'gloss');
}
/* Circuit pieces: a circuit board worn as a suit. Helmet with a flat sensor bar and amber lights; copper traces in angles on the jacket
   ending in square solder pads; chips and capacitors on the chest, the back and the forearms; a collar of pads; short traces on the thighs;
   amber indicator lights (no light running along the limbs) */
function ofCircuitModel(B, skin, hi) {
  const G = skinGear(skin), C = G.copper, H = OF_CIRCUIT_HELM, w = 0.016, hm = ofkHM();
  ofkShell(B, hi, H, G.shell, 'gloss');
  // sensor bar: a flat dark bar across the face, copper frame, three amber lights
  const f = ofkShellPt(H), bp = f(0, Math.cos(1.4), -Math.sin(1.4), 0.004);
  const bm = hm.clone().multiply(new THREE.Matrix4().makeTranslation(bp.x, bp.y, bp.z - 0.014));
  gBox(B, 0.13, 0.034, 0.03, hi ? 0.004 : 0, bm, SB.HEA, G.chip, 'gloss');
  gBox(B, 0.136, 0.006, 0.026, 0, bm.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.019, 0)), SB.HEA, C, 'gloss', 0, 0);
  for (const x of [-0.04, 0, 0.04]) gBox(B, 0.014, 0.008, 0.004, 0, bm.clone().multiply(new THREE.Matrix4().makeTranslation(x, -0.002, -0.016)), SB.HEA, G.glowc, 'glow', 0, 0);
  // copper traces in angles over the chest, the sides and the back, each ending in a square pad
  const lines = [[[1.27, 0.25], [1.27, 0.42], [1.2, 0.55], [1.08, 0.55]], [[1.27, -0.25], [1.27, -0.42], [1.2, -0.55], [1.08, -0.55]], [[1.36, 0.12], [1.42, 0.3], [1.42, 0.55]], [[1.36, -0.12], [1.42, -0.3], [1.42, -0.55]],
    [[1.2, 0.12], [1.12, 0.12], [1.08, 0.25]], [[1.2, -0.12], [1.12, -0.12], [1.08, -0.25]],
    [[1.4, 2.6], [1.24, 2.6], [1.17, 2.8], [1.07, 2.8]], [[1.4, 3.68], [1.24, 3.68], [1.17, 3.48], [1.07, 3.48]], [[1.3, 2.86], [1.22, 2.9]], [[1.3, 3.42], [1.22, 3.38]]];
  for (const L of lines) {
    ofkShirtLine(B, hi, L, { w, col: C, tile: 'gloss', g: 0.005 });
    for (const [y, A] of [L[0], L[L.length - 1]]) { const F = ofCircuitAt(y, A, 0.007); ofCircuitPad(B, F.m, F.w, 0.026, G); }
  }
  // chest: a large chip at the center, two capacitors, a small chip
  { const F = ofCircuitAt(1.29, 0, 0.006); ofCircuitChip(B, hi, F.m, F.w, 0.075, 0.075, G, 5); }
  { const F = ofCircuitAt(1.16, 0.3, 0.006); ofCircuitChip(B, hi, F.m, F.w, 0.04, 0.03, G, 3); }
  for (const A of [-0.3, 0.42]) ofCircuitCap(B, hi, ofCircuitAt(A > 0 ? 1.34 : 1.18, A, 0.004), 0.013, 0.03, G);
  // collar of pads around the base of the neck: copper and black in turn
  for (let i = 0; i < 8; i++) { const A = (i + 0.5) / 8 * TAU, p = ofkShirtPt(1.468, A, 0.01), n = new V3(p.x, 0.5, p.z - 0.007).normalize(), x = new V3().crossVectors(new V3(0, 1, 0), n).normalize(); gBox(B, 0.03, 0.016, 0.01, 0, new THREE.Matrix4().makeBasis(x, new V3().crossVectors(n, x), n).setPosition(p), torsoW(p), i % 2 ? G.chip : C, i % 2 ? 'poly' : 'gloss', 0, 0); }
  // back: a large chip between the shoulder blades, two below it, a capacitor
  { const F = ofCircuitAt(1.36, Math.PI, 0.008); ofCircuitChip(B, hi, F.m, F.w, 0.11, 0.1, G, 6); }
  for (const [y, A] of [[1.22, Math.PI - 0.3], [1.15, Math.PI + 0.25]]) { const F = ofCircuitAt(y, A, 0.006); ofCircuitChip(B, hi, F.m, F.w, 0.05, 0.04, G, 3); }
  ofCircuitCap(B, hi, ofCircuitAt(1.23, Math.PI + 0.3, 0.004), 0.014, 0.032, G);
  // forearms: a chip on the outer side of each, a pad toward the wrist
  for (const sx of [-1, 1]) {
    const F = ofkLimb(sx, true, 0.4), p = F.pt(0.7, 0.008), n = p.clone().sub(F.c).normalize(), ax = ofkLimb(sx, true, 0.46).c.sub(F.c).normalize();
    const x = new V3().crossVectors(ax, n).normalize(), m = new THREE.Matrix4().makeBasis(x, ax, n).setPosition(p);
    ofCircuitChip(B, hi, m, F.w, 0.04, 0.06, G, 4);
    // short traces on the thighs, each from a pad
    ofkLimbLine(B, hi, sx, false, 0.06, 0.2, (d) => (d < 0.13 ? 0.35 : 0.1), w, 0.003, C, 'gloss', hi ? 4 : 2);
    const T = ofkLimb(sx, false, 0.06), q = T.pt(0.35, 0.006), nq = q.clone().sub(T.c).normalize(), aq = ofkLimb(sx, false, 0.1).c.sub(T.c).normalize(), xq = new V3().crossVectors(aq, nq).normalize();
    ofCircuitPad(B, new THREE.Matrix4().makeBasis(xq, aq, nq).setPosition(q), T.w, 0.026, G);
  }
  gBox(B, 0.03, 0.012, 0.01, 0, gMat(0.05, 1.04, -0.118), SB.PEL, G.glowc, 'glow', 0, 0);
  dArmor(B, G, hi, { knee: G.shell, kneeAcc: G.glowc, kneeTile: 'glow', plateTile: 'gloss' });
}
function ofCircuitTag(B, skin, hi) { ofkTagShell(B, hi, OF_CIRCUIT_HELM, 3 / 6 * OF_CIRCUIT_HELM.jaw, 0.022); }

/* ---------- Old Guard ---------- */
/* Beret: soft disc pulled down over the right side, leather headband */
const OF_BERET = { rx: 0.088, rz: 0.11, prof: [[0, 0.142], [0.5, 0.147], [0.95, 0.133], [1.14, 0.108], [1.12, 0.084], [1.03, 0.054], [1.0, 0.036], [0.98, 0.03]],
  dy: (a, r, k) => (k >= 0 && k < 5 ? -0.042 * Math.max(0, Math.sin(a)) * smoothstep(0.3, 1.1, r) : 0) };
/* Greatcoat: olive wool; top: the body, a unit mark (a ring with a 7) between the shoulder blades; below: the skirts and their back vent */
function ofGuardArt(g, W, H) {
  ofkArtCloth(g, W, H, '#5c5e40', 1381, 0.12, 30);
  const cx = W / 2, cy = H * 0.12, c = '#d8d0a8';
  g.strokeStyle = c; g.lineWidth = W * 0.026; g.beginPath(); g.arc(cx, cy, W * 0.09, 0, TAU); g.stroke();
  g.fillStyle = c; g.font = `bold ${Math.round(W * 0.12)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('7', cx, cy + 1);
  g.fillStyle = 'rgba(30,30,18,0.5)'; g.fillRect(0, H * 0.38, W, 2);
  g.strokeStyle = 'rgba(30,30,18,0.6)'; g.lineWidth = 2; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(cx, H * 0.6); g.lineTo(cx, H); g.stroke(); g.setLineDash([]);
}
/* Old Guard pieces: beret and its brass badge, the open greatcoat (body, sleeves, wide collar, brass buttons on both edges, ribbon bar), the
   belt and its pouches in the opening */
function ofGuardModel(B, skin, hi) {
  const G = skinGear(skin), hm = ofkHM();
  ofkLathe(B, hi, Object.assign({ col: (k) => (k >= 6 ? G.band : G.beret), tile: 'fab' }, OF_BERET));
  dExtrude(B, [[-0.019, 0.022], [0.019, 0.022], [0.019, -0.006], [0, -0.026], [-0.019, -0.006]], 0.005, hi ? 0.0015 : 0, hm.clone().multiply(gMat(-0.045, 0.056, -0.101, -0.3, -0.42)), SB.HEA, G.brass, 'gloss');
  ofkCoat(B, hi, { g: 0.022, gap0: 0.42, gap1: 0.48, flare: 0, col: OFK_WHITE, uv: (A, y) => atlasUV('art', 0.98 - A / TAU * 0.96, (1.49 - y) / 0.44 * 0.34) }); // (mirrored: the mark reads from behind)
  for (const sx of [-1, 1]) ofkLimbTube(B, hi, sx, true, -0.03, 0.48, 0.011, OFK_WHITE, 'fab', { col: (u, v) => (v > 0.9 ? G.cuff : OFK_WHITE), bulge: (v) => 0.004 * Math.sin(v * Math.PI), uv: (u, v) => atlasUV('art', 0.05 + u * 0.3, 0.42 + v * 0.16) });
  ofkCollar(B, hi, 0.5, 1.44, 1.535, 0.125, 0.045, G.collar, 'fab');
  const wb = [[1.04, 0.166, 0.113, 0.12], [1.08, 0.163, 0.112, 0.116]];
  skinLoft(B, wb.map(([y, w, f, bk]) => ({ c: new V3(0, y, 0), X: new V3(1, 0, 0), Y: new V3(0, 0, -1), r: [w, w, f, bk], n: 2.5, v: y })), hi ? 30 : 12, { wp: (p) => torsoW(p), col: () => G.web, uv: () => GEAR_TILE.nyl });
  for (const x of [-0.06, 0.06]) gBox(B, 0.06, 0.07, 0.035, hi ? 0.008 : 0, gMat(x, 1.075, -0.13), SB.PEL, G.web, (u, vv) => atlasUV('web', u * 0.4, vv * 0.4));
  for (const x of [-0.06, 0.06]) ofkButtons(B, hi, 1.42, 1.12, 4, G.brass, 'gloss', false, x, 0.028);
  ofkTagArms(B, hi, 0.02); ofkTagPatch(B, hi, 1.33, -0.085, 0.0); // (the chest patch in the coat's opening, where the six wear it)
  // ribbon bar on the coat's right chest: three ribbons of plain colors
  [G.rib1, G.rib2, G.rib3].forEach((c, i) => { const p = ofkShirtPt(1.355, 0.82, 0.03); gBox(B, 0.02, 0.012, 0.004, 0, gMat(p.x + (i - 1) * 0.021 * 0.8, p.y, p.z + (i - 1) * 0.021 * 0.5, 0.06, 0.62), SB.CHE, c, 'fab', 0, 0); }); // (mirrored)
}
function ofGuardTag(B, skin, hi) { ofkTagLathe(B, hi, OF_BERET, 1.0, 0.042, 0.016); }
/* Old Guard cloth: the greatcoat's skirts from its waist ring to mid-calf, open in front */
function ofGuardCloth() { return clothBuild([ofkTails({ bottom: 0.28, a0: 0.42, a1: TAU - 0.42, coat: 0.022, flare: 0.07, cu: 15, slack: 0.36, uv: (s, t) => atlasUV('art', 1 - s, 0.4 + t * 0.6) })]); }

/* ---------- The play-style outfits ---------- */
Object.assign(SKINS, {
  bulwark: {
    name: _t('Bulwark'), role: _t('Holds the line and stays standing'), seed: 1301, sym: 'X', challenge: true,
    camo: { style: 'poly', base: '#5a5f64', soft: ['#62676c', '#53585d'], mid: ['#6e7378', '#44484c', '#7a7f84'], n: [45, 40, 30], branch: ['#2f3236'], hi: '#9aa0a6' },
    gear: ofkGear({ vest: '#4a4f54', pouch: '#555a5f', glove: '#2e3134', boot: '#3a3d40', belt: '#2e3134', knee: '#5a5f64' },
      { steel: '#7a8086', steel2: '#5f656b', hazard: '#e8b81c', dark: '#1e1e1e', slit: '#0a0a0a' }),
    parts: { glasses: false, pouches: 'ar', patch: false },
    tone: [[1.35, 1.35, 1.35], [0.5, 0.5, 0.5]], model: ofBulwarkModel, tagHead: ofBulwarkTag, neon: 0,
  },
  standard: {
    name: _t('Standard-Bearer'), role: _t('Carries the colors onto every point'), seed: 1307, sym: 'L', challenge: true,
    camo: { style: 'poly', base: '#6c141b', soft: ['#741820', '#641219'], mid: ['#7c1a22', '#560f15', '#84202a'], n: [30, 30, 20], branch: ['#3d0f12'], hi: '#8e2a32' },
    gear: ofkGear({ vest: '#e2d8c0', pouch: '#d6cbb0', helm: '#ece4d0', glove: '#3a1416', boot: '#3a2a22', belt: '#3a1416', knit: '#5a161a', knee: '#e2d8c0', lens: '#18100c' },
      { ivory: '#efe6d0', crimson: '#7e1820', wood: '#6a4a2c', brass: '#c49a40' }),
    parts: { helmet: 'paint', pouches: 'ar', patch: false, cape: true },
    tone: [[1.25, 1.24, 1.24], [0.5, 0.49, 0.49]], art: ofBannerArt, model: ofBannerModel, cloth: ofBannerCloth, neon: 0,
  },
  sapper: {
    name: _t('Sapper'), role: _t('Grenades, strikes, things that go boom'), seed: 1311, sym: 'X', challenge: true,
    camo: { style: 'poly', base: '#4a4d3f', soft: ['#525546', '#424538'], mid: ['#5c5f4f', '#3a3c31', '#6a6d5a'], n: [45, 40, 30], branch: ['#2b2d24'], hi: '#8a8c78' },
    gear: ofkGear({ vest: '#45483b', glove: '#2a2b24', boot: '#33332a', belt: '#2a2b24', knee: '#c4561a' },
      { pad: '#6a6e58', pad2: '#4a4d3e', orange: '#e0661c', helm: '#6a6e58', visor: '#2e3a3a', bag: '#3e4034', metal: '#8a8a82', strap: '#2e3028', dark: '#222320', wire: '#a01e1e' }),
    parts: { glasses: false, carrier: false, patch: false },
    tone: [[1.5, 1.5, 1.46], [0.5, 0.5, 0.49]], model: ofSapperModel, tagHead: ofSapperTag, neon: 0,
  },
  skyhook: {
    name: _t('Skyhook'), role: _t('Calls in the sky'), seed: 1319, sym: 'X', challenge: true,
    camo: { style: 'poly', base: '#8a98a8', soft: ['#92a0b0', '#8290a0'], mid: ['#a0aebd', '#74849a', '#acb8c6'], n: [30, 25, 20], branch: ['#66768c'], hi: '#c6d0dc' },
    gear: ofkGear({ vest: '#3a3d40', pouch: '#44474a', helm: '#b8bcbf', glove: '#3a3d40', boot: '#4a4d50', belt: '#3a3d40', knee: '#9a9ea2', lens: '#0e3a44', cup: '#5a5e62' },
      { pack: '#3e4144', pack2: '#55595d', drone: '#2a2d30', rotor: '#1e2124', glowc: '#20d8ff' }),
    parts: { helmet: 'paint', pouches: 'smg', patch: false },
    tone: [[0.92, 0.93, 0.96], [0.44, 0.44, 0.46]], model: ofSkyModel, neon: 1.8,
  },
  marshal: {
    name: _t('Marshal'), role: _t('One shot, one kill, at high noon'), seed: 1321, sym: 'L', challenge: true,
    camo: { style: 'poly', base: '#a48a66', soft: ['#a88e6a', '#a08662'], mid: ['#aa906c', '#9c8260', '#ae9470'], n: [6, 6, 4], branch: ['#94795a'], hi: '#b49a76' },
    gear: ofkGear({ vest: '#6a4c30', glove: '#5a4028', boot: '#5a3e26', belt: '#4a3420', knee: '#6a4c30', knit: '#7a6448', mask: '#8e2e22' },
      { hat: '#5b4330', hatband: '#2e2018', kerchief: '#8e2e22', leather: '#6a4a2e', collar: '#d6c4a2', cuff: '#a8987c', grip: '#3a2618', brass: '#c49a40', shell: '#8a3a22' }),
    parts: { mask: 'fab', glasses: false, carrier: false, patch: false, holster: false },
    tone: [[1.1, 1.08, 1.04], [0.46, 0.45, 0.44]], art: ofMarshalArt, model: ofMarshalModel, cloth: ofMarshalCloth, tagHead: ofMarshalTag, neon: 0,
  },
  shade: {
    name: _t('Shade'), role: _t('Close, silent, unseen'), seed: 1327, sym: 'X', challenge: true,
    camo: { style: 'poly', base: '#101113', soft: ['#131416', '#0d0e10'], mid: ['#17181b', '#0a0b0c', '#1b1c20'], n: [40, 35, 25], branch: ['#060607'], hi: '#26272c' },
    gear: ofkGear({ vest: '#121315', glove: '#0c0d0e', boot: '#121314', belt: '#0c0d0e', mask: '#111214', knit: '#111214' },
      { cowl: '#141518', wrap: '#2a2b31', sash: '#6a1018', sash2: '#4a0c12', grip: '#1e1a1a', glowd: '#7a121c', glowc: '#ff0010', sheath: '#1a1614', strap: '#1c1d21', blade: '#7a7e84' }),
    parts: { mask: 'fab', glasses: false, carrier: false, patch: false, cape: true },
    tone: [[1.7, 1.7, 1.74], [0.5, 0.5, 0.52]], model: ofShadeModel, cloth: ofShadeCloth, tagHead: ofShadeTag, neon: 1.1,
  },
  aurum: {
    name: _t('Aurum'), role: _t('Mastery, worn in gold'), seed: 1361, sym: 'X', challenge: true,
    camo: { style: 'poly', base: '#121214', soft: ['#151517', '#101012'], mid: ['#18181a', '#0d0d0f', '#1c1b18'], n: [30, 25, 20], branch: ['#08080a'], hi: '#2a2822' },
    gear: ofkGear({ vest: '#121214', pouch: '#18181a', glove: '#0e0e10', boot: '#121214', belt: '#0e0e10', knee: '#121214' },
      { black: '#151517', gold: '#b39a58' }),
    parts: { glasses: false, pouches: 'ar', patch: false, cape: true },
    tone: [[1.6, 1.6, 1.6], [0.52, 0.52, 0.52]], art: ofAurumArt, model: ofAurumModel, cloth: ofAurumCloth, tagHead: ofAurumTag, neon: 0,
  },
  trapper: {
    name: _t('Trapper'), role: _t('Waits up close, in fur and leather'), seed: 1367, sym: 'L', challenge: true,
    camo: { style: 'poly', base: '#4e443c', soft: ['#554a40', '#484038'], mid: ['#5e5246', '#3c342c', '#66584a'], n: [14, 14, 10], branch: ['#2e2620'], hi: '#7a6c5e' },
    gear: ofkGear({ vest: '#4a3a2c', glove: '#3a2c20', boot: '#3e3024', belt: '#33261a', knee: '#4a3a2c', knit: '#3a2a1e' },
      { furs: ['#3e2c1e', '#4e3826', '#33241a', '#5c442c'], furL: '#8a6a46', furL2: '#7a5c3c', bone: '#e6dcc4', leather: '#6a4a2e', leather2: '#3e2c1c', roll: '#6b5d48', patch2: '#7a5a3a' }),
    parts: { glasses: false, carrier: false, patch: false },
    tone: [[1.2, 1.18, 1.15], [0.48, 0.47, 0.46]], model: ofTrapperModel, tagHead: ofTrapperTag, neon: 0,
  },
  circuit: {
    name: _t('Circuit'), role: _t('Always moving, chaining kills'), seed: 1373, sym: 'X', challenge: true,
    camo: { style: 'poly', base: '#10301b', soft: ['#11331d', '#0f2c19'], mid: ['#123620', '#0e2a18', '#113220'], n: [4, 4, 3], branch: ['#0d2616'], hi: '#164026' },
    gear: ofkGear({ vest: '#13241a', glove: '#0e1a12', boot: '#121a14', belt: '#0e1a12', knee: '#16281c' },
      { shell: '#12201a', glowc: '#ffa020', copper: '#c8873a', chip: '#141515', cap: '#25365e' }),
    parts: { glasses: false, carrier: false, patch: false },
    tone: [[1.0, 1.0, 1.0], [0.48, 0.47, 0.46]], model: ofCircuitModel, tagHead: ofCircuitTag, neon: 1.6,
  },
  oldGuard: {
    name: _t('Old Guard'), role: _t('Has won everywhere, in every mode'), seed: 1381, sym: 'L', challenge: true,
    camo: { style: 'poly', base: '#4f5232', soft: ['#525535', '#4c4f30'], mid: ['#545736', '#4a4d2f', '#575a38'], n: [6, 6, 4], branch: ['#45482c'], hi: '#5c5f3c' },
    gear: ofkGear({ vest: '#4a4c30', glove: '#3a3a28', boot: '#3a2e22', belt: '#5a5638', knee: '#4a4c30', knit: '#4a4c30', mask: '#7a7656' },
      { beret: '#5c1c24', band: '#2a1a14', brass: '#c49a40', web: '#8a8460', collar: '#4e5034', cuff: '#8a8a70', rib1: '#9a2a2a', rib2: '#2a3a7a', rib3: '#c8a040' }),
    parts: { mask: 'fab', glasses: false, carrier: false, cape: true, holster: false },
    tone: [[1.42, 1.42, 1.38], [0.5, 0.5, 0.49]], art: ofGuardArt, model: ofGuardModel, cloth: ofGuardCloth, tagHead: ofGuardTag, neon: 0,
  },
});
/* In the order of the Outfits screen, under their own title (09u-outfits.js) */
const SKIN_PLAY_OUT = ['bulwark', 'standard', 'sapper', 'skyhook', 'marshal', 'shade', 'aurum', 'trapper', 'circuit', 'oldGuard'];
SKIN_CHALLENGE.push(...SKIN_PLAY_OUT);
