/* ==========================================================================
   MAP OUTFITS: ten challenge outfits, each earned on its own map (challenges: 06s-challenges.js), built from the kit (06ge-outfit-kit.js)
   like the first six (06gc-outfits-challenge.js): same skeleton, animations and hit zones, light or dark by the relation to the player,
   recognition bands; built when first shown or worn, released after (skinRelease). Every face is covered, as on the first six, and every
   back carries a signature piece.
   - Dune Rider (Chergui): sand head-cloth wound around the head with a tail at the nape, indigo face wrap, dust goggles, indigo waist wrap
     with its knot, bandolier, long ragged indigo cloak with a sand crescent over dunes.
   - Whiteout (Saint-Givre): white and pale gray winter smock, hood with a thick fur ruff, glowing ice-blue snow goggles and cuffs, short
     white cape with a large ice crystal.
   - Corsair (Port-Maël): solid navy oilskin coat (body, sleeves, tails) with brass buttons, yellow sou'wester with a long back brim, red
     scarf pulled up, striped scarf, rope sling with a brass hook, amber lantern, brass anchor on the back.
   - Briar (Floralia): deep green with rose-red, thorn crown on the helmet, thorn pauldrons, cape of rose petals and thorned vines, rose emblems.
   - Argonaut (Notos): white linen and Aegean blue, thick plumed crest, bronze shoulder, knee and shin plates, linen wraps, blue back cloth.
   - Cinder (Scoria): charcoal heat suit with wide glowing lava cracks, close cap and respirator, heat plate, scorched cape with a burning hem.
   - Stratos (Cirrus): brown leather bomber with a fleece collar over a sky-blue flight suit, leather flight cap, raised goggles, oxygen mask,
     winged patch on the back, scarf tail to the waist.
   - Sandveil (Sirocco): dune camouflage, turban down to the brow and wrapped to the nape with a sun-gold band, goggles, veil, storm cloak
     with an eight-ray sun and a gold trim.
   - Dusk Patrol (Bel-Horizon): dark slate patrol jacket and cap, orange-pink trims, shoulder torch, sunset over the roofs on the back.
   - Jaguar (Selva): tiger-stripe jungle camouflage, boonie hat, painted balaclava, machete, ochre shoulder mantle with large rosettes.
   ========================================================================== */

/* ---------- Dune Rider ---------- */
/* Cloak: indigo canvas, two sand bands, emblem of a sand crescent over three dunes */
function ofDuneArt(g, W, H) {
  const R = ofkArtCloth(g, W, H, '#2e3768', 211, 0.35), cx = W / 2, sand = '#d2bb8e';
  g.fillStyle = sand; g.fillRect(0, H * 0.58, W, H * 0.035); g.fillRect(0, H * 0.64, W, H * 0.015);
  // crescent: a disc with a second one cut out of it
  g.beginPath(); g.arc(cx, H * 0.2, W * 0.12, 0, TAU); g.closePath(); g.moveTo(cx + W * 0.155, H * 0.185); g.arc(cx + W * 0.055, H * 0.185, W * 0.1, 0, TAU); g.fill('evenodd');
  for (let i = 0; i < 3; i++) { // dunes: filled humps, the nearest one widest
    const y = H * (0.42 - i * 0.045), w = W * (0.46 - i * 0.1), x = cx + (i - 1) * W * 0.12;
    g.globalAlpha = 1 - i * 0.18; g.beginPath(); g.moveTo(x - w / 2, y); g.quadraticCurveTo(x - w * 0.1, y - H * 0.09, x + w / 2, y); g.closePath(); g.fill();
  }
  g.globalAlpha = 1; g.fillRect(cx - W * 0.3, H * 0.42, W * 0.6, H * 0.012);
  g.strokeStyle = 'rgba(14,16,40,0.5)'; g.lineWidth = 1; // frayed hem
  for (let i = 0; i < 90; i++) { const x = R() * W, y = H * (0.82 + R() * 0.16); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 3, y + 6 + R() * 14); g.stroke(); }
}
/* Turban: indigo cloth wound low on the brow in two tones, dropping behind to wrap the nape */
const OF_DUNE_TURBAN = { rx: 0.093, rz: 0.113, prof: [[0, 0.136], [0.45, 0.134], [0.78, 0.123], [1.0, 0.107], [1.14, 0.089], [1.07, 0.075], [1.17, 0.059], [1.09, 0.045], [1.12, 0.033], [1.02, 0.023], [0.93, 0.018]],
  dy: (a, r, k) => (k > 3 ? 0.012 * Math.sin(a * 1.5 + k * 1.1) : 0) - (k >= 7 ? 0.12 * Math.pow(Math.max(0, -Math.cos(a)), 1.2) * (k - 6) / 4 : 0) };
/* Dune Rider pieces: head-cloth, dust goggles, indigo waist wrap and its knot, bandolier with pouches, leather bracers (the face wrap: parts.mask) */
function ofDuneModel(B, skin, hi) {
  const G = skinGear(skin);
  ofkLathe(B, hi, Object.assign({ col: (k) => (k % 2 ? G.indigo : G.indigo2), tile: 'fab' }, OF_DUNE_TURBAN));
  // indigo sash from the left shoulder to the right hip, crossing the bandolier
  for (const L of [[[-0.15, 1.475, -0.03], [-0.122, 1.41, -0.14], [-0.03, 1.29, -0.182], [0.07, 1.17, -0.184], [0.168, 1.1, -0.14]], [[-0.15, 1.475, -0.03], [-0.142, 1.42, 0.095], [-0.04, 1.27, 0.16], [0.08, 1.15, 0.155], [0.168, 1.1, 0.11]]])
    gBand(B, L.map(([x, y, z]) => new V3(x, y, z)), 0.07, 0.012, (p) => new V3(p.x * 0.4, (p.y - 1.25) * 0.3, p.z).normalize(), (p) => torsoW(p), G.indigo2, ofkTile('fab'), hi ? 10 : 5);
  dGoggles(B, G, hi, 0.36, 1.46, G.lens);
  // waist wrap: wide indigo cloth over the belt, darker at its edges, knot and short ends on the left hip
  const wr = [[0.985, 0.168, 0.114, 0.12], [1.0, 0.176, 0.12, 0.126], [1.06, 0.174, 0.122, 0.125], [1.12, 0.172, 0.126, 0.122], [1.14, 0.165, 0.12, 0.116]];
  skinLoft(B, wr.map(([y, w, f, bk]) => ({ c: new V3(0, y, 0), X: new V3(1, 0, 0), Y: new V3(0, 0, -1), r: [w, w, f, bk], n: 2.5, v: y })), hi ? 34 : 12,
    { wp: (p) => torsoW(p), col: (a, k) => (k === 0 || k === 4 ? G.indigo.clone().multiplyScalar(0.55) : k === 2 ? G.indigo2 : G.indigo), uv: () => GEAR_TILE.fab, bump: (a, k) => (k === 2 ? 0.003 * Math.sin(a * 3) : 0) });
  ofkClumps(B, hi, [{ p: new V3(-0.172, 1.06, -0.05), n: new V3(-1, 0, -0.4).normalize(), w: torsoW(new V3(-0.17, 1.06, -0.05)) }], 0.036, [G.indigo], 5);
  // bandolier from the right shoulder to the left hip, three pouches in front
  const front = [[0.15, 1.475, -0.03], [0.12, 1.405, -0.128], [0.03, 1.29, -0.168], [-0.07, 1.17, -0.17], [-0.165, 1.1, -0.128]].map(([x, y, z]) => new V3(x, y, z));
  let k = 0;
  dSling(B, front, 0.045, 0.01, G.belt, hi, 0.09, (p, T, n) => {
    if (k++ > 2) return;
    const y = new V3().crossVectors(T, n).normalize(), x = new V3().crossVectors(y, n), m = new THREE.Matrix4().makeBasis(x, y, n).setPosition(p.clone().addScaledVector(n, 0.018));
    gBox(B, 0.05, 0.06, 0.026, hi ? 0.006 : 0, m, torsoW(p), G.pouch, 'leat');
  });
  dSling(B, [[0.15, 1.475, -0.03], [0.14, 1.42, 0.09], [0.04, 1.27, 0.15], [-0.08, 1.15, 0.145], [-0.165, 1.1, 0.1]].map(([x, y, z]) => new V3(x, y, z)), 0.045, 0.01, G.belt, hi, 0, null);
  // the head-cloth's wrap: down the cheeks to the jaw, round the back of the head, then turns around the neck
  ofkSkullCap(B, hi, { th: (ph) => lerp(1.3, 2.55, smoothstep(0.55, 1.05, Math.abs(ph))), grow: 0.012, col: () => G.indigo2, tile: 'fab', bump: (th) => (th > 1.6 ? 0.003 * Math.sin(th * 14) : 0) });
  ofkScarf(B, hi, (k) => (k % 2 ? G.indigo : G.indigo2), 1.05);
  dArmor(B, G, hi, { fore: G.leather, shin: G.leather, plateTile: 'leat' });
}
function ofDuneTag(B, skin, hi) { ofkTagLathe(B, hi, OF_DUNE_TURBAN, 0.885, 0.115, 0.03, OFK_WHITE, 'tag', 0.004, 1.2); } // (on the crown's slope, not above it)
/* Dune Rider cloth: long ragged indigo cloak from the shoulders to the calves, the tail of the head-cloth at the nape, the wrap's ends */
function ofDuneCloth(skin) {
  const G = skinGear(skin), hm = ofkHM(), nape = new V3(0, -0.075, 0.108).applyMatrix4(hm);
  const cloak = ofkCape({ bottom: 0.34, span: 1.22, flare: 0.09, hem: dHem(71, 0.7, 0.16), slack: 0.75, cu: 15 });
  const tail = clothStrip({ p0: nape, dir: new V3(0.1, -1, 0.3).normalize(), side: new V3(1, 0, 0), len: 0.26, w0: 0.13, w1: 0.08, cu: 3, rv: 6,
    w: (p, t) => [[SB.HEA, Math.max(0, 0.8 - t * 2)], [SB.NEC, 0.5], [SB.CHE, Math.min(1, t * 1.5)]], maxD: (t) => 0.01 + t * 0.14, uv: () => GEAR_TILE.fab, col: G.indigo, shade: 0.7 });
  const ends = [0, 1].map((i) => clothStrip({ p0: new V3(-0.178, 1.04, -0.06 + i * 0.03), dir: new V3(-0.15, -1, 0.05).normalize(), side: new V3(0, 0, 1), len: 0.22 - i * 0.05, w0: 0.06, w1: 0.045, cu: 2, rv: 5,
    w: (p) => clothHipW(p), maxD: (t) => 0.015 + t * 0.2, uv: () => GEAR_TILE.fab, col: G.indigo2, shade: 0.7 }));
  return clothBuild([cloak, tail, ...ends]);
}

/* ---------- Whiteout ---------- */
/* Short cape: white canvas, an ice-blue band above the hem and a large hexagonal crystal */
function ofWhiteArt(g, W, H) {
  ofkArtCloth(g, W, H, '#dfe3e6', 401, 0.12, 80);
  const ice = '#4f9fd2', cx = W / 2, cy = H * 0.34, r = W * 0.3;
  g.fillStyle = ice; g.fillRect(0, H * 0.74, W, H * 0.04);
  g.strokeStyle = ice; g.lineWidth = W * 0.045; g.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + Math.PI / 6;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.stroke();
    for (const [f, l] of [[0.45, 0.32], [0.75, 0.22]]) {
      const xm = cx + Math.cos(a) * r * f, ym = cy + Math.sin(a) * r * f;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(xm, ym); g.lineTo(xm + Math.cos(a + s * 0.85) * r * l, ym + Math.sin(a + s * 0.85) * r * l); g.stroke(); }
    }
  }
  g.fillStyle = ice; g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.lineTo(cx + Math.cos(a) * r * 0.16, cy + Math.sin(a) * r * 0.16); } g.closePath(); g.fill();
}
/* Whiteout pieces: thick fur ruff around the hood opening, glowing snow goggles, ice-blue cuffs and knee accents */
function ofWhiteModel(B, skin, hi) {
  const G = skinGear(skin);
  ofkClumps(B, hi, ofkHoodEdge(HOOD_RINGS, 3, 7, 0.024, true), 0.027, G.fur, 41);
  dGoggles(B, G, hi, 0.34, 1.47, G.glowc, true);
  for (const sx of [-1, 1]) ofkLimbRing(B, hi, sx, true, 0.49, 0.022, 0.004, G.glowc, 'glow');
  dArmor(B, G, hi, { knee: G.knee, kneeAcc: G.glowc, kneeTile: 'glow' });
}
function ofWhiteCloth() { return clothBuild([ofkCape({ bottom: 0.96, span: 1.12, flare: 0.04, hem: dHem(43, 0.86, 0.08), slack: 0.6 })]); }

/* ---------- Corsair ---------- */
/* Coat tails: navy oilskin with waxed streaks, a brass anchor on the back */
function ofCorsairArt(g, W, H) {
  // top: the coat's body (the anchor between the shoulder blades); below: the tails and sleeves
  const R = ofkArtCloth(g, W, H, '#222c44', 503, 0.15, 60), cx = W / 2, top = H * 0.07, b = '#c49a42';
  for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(150,170,200,0.06)'; g.fillRect(R() * W, R() * H, 1 + R() * 2, 20 + R() * 60); }
  g.strokeStyle = b; g.fillStyle = b; g.lineCap = 'round'; g.lineWidth = W * 0.045;
  g.lineWidth = W * 0.03;
  g.beginPath(); g.arc(cx, top + H * 0.02, W * 0.026, 0, TAU); g.stroke(); // ring
  g.beginPath(); g.moveTo(cx, top + H * 0.04); g.lineTo(cx, top + H * 0.24); g.stroke(); // shank
  g.beginPath(); g.moveTo(cx - W * 0.08, top + H * 0.065); g.lineTo(cx + W * 0.08, top + H * 0.065); g.stroke(); // stock
  g.beginPath(); g.arc(cx, top + H * 0.16, W * 0.13, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); // arms
  for (const s of [-1, 1]) { const x = cx + s * Math.cos(Math.PI * 0.15) * W * 0.13, y = top + H * 0.16 + Math.sin(Math.PI * 0.15) * W * 0.13; ofkPoly(g, [[x + s * W * 0.035, y - H * 0.024], [x - s * W * 0.014, y - H * 0.004], [x + s * W * 0.02, y + H * 0.014]]); }
}
/* Sou'wester: round crown, short brim turned up in front, long brim sloping down at the back */
const OF_SOUWESTER = { rx: 0.086, rz: 0.108, prof: [[0, 0.14], [0.5, 0.138], [0.85, 0.124], [1.0, 0.09], [1.03, 0.05], [1.05, 0.04], [1.62, 0.032], [1.64, 0.026], [1.6, 0.022], [1.04, 0.034]],
  reach: (a) => 0.3 + 1.15 * Math.pow((1 - Math.cos(a)) / 2, 1.5), dy: (a, r) => (r > 1.05 ? (r - 1.05) * (0.14 * Math.max(0, Math.cos(a)) ** 2 - 0.22 * Math.max(0, -Math.cos(a))) : 0) };
/* Corsair pieces: sou'wester and its chin strap, oilskin coat (body, collar, sleeves), striped scarf, brass buttons, rope sling and brass
   hook, amber lantern on the left hip */
function ofCorsairModel(B, skin, hi) {
  const G = skinGear(skin), hm = ofkHM();
  ofkLathe(B, hi, Object.assign({ c: G.hat, tile: 'paint' }, OF_SOUWESTER));
  if (hi) for (const s of [-1, 1]) gBand(B, [[s * 0.082, 0.035, 0.0], [s * 0.078, -0.04, -0.02], [s * 0.05, -0.105, -0.06], [s * 0.015, -0.124, -0.078]].map(([x, y, z]) => new V3(x, y, z).applyMatrix4(hm)), 0.008, 0.003, (p) => p.clone().sub(new V3().setFromMatrixPosition(hm)), SB.HEA, G.belt, null, 4);
  // the coat's body and sleeves in the canvas of its tails (the emblem zone below the anchor)
  ofkCoat(B, hi, { g: 0.018, gap0: 0.06, gap1: 0.1, flare: 0, col: OFK_WHITE, uv: (A, y) => atlasUV('art', 0.05 + A / TAU * 0.9, (1.49 - y) / 0.44 * 0.4) });
  for (const sx of [-1, 1]) ofkLimbTube(B, hi, sx, true, -0.03, 0.47, 0.009, OFK_WHITE, 'fab', { col: (u, v) => (v > 0.9 ? G.cuff : OFK_WHITE), uv: (u, v) => atlasUV('art', 0.1 + u * 0.8, 0.5 + v * 0.4) });
  ofkScarf(B, hi, (k) => (k % 2 ? G.cream : G.red), 1.1);
  for (const x of [-0.035, 0.035]) ofkButtons(B, hi, 1.38, 1.1, 5, G.brass, 'gloss', false, x, 0.022);
  ofkTagArms(B, hi, 0.014); ofkTagPatch(B, hi, 1.37, -0.55, 0.018);
  // rope sling from the right shoulder to the left hip, the hook hanging at its end
  const rope = [[0.14, 1.5, -0.02], [0.125, 1.42, -0.145], [0.02, 1.29, -0.175], [-0.09, 1.16, -0.172], [-0.18, 1.07, -0.13]].map(([x, y, z]) => new V3(x, y, z));
  ofkRope(B, hi, rope, 0.011, G.rope, (p) => torsoW(p));
  ofkRope(B, hi, [[0.14, 1.5, -0.02], [0.135, 1.43, 0.12], [0.02, 1.27, 0.155], [-0.1, 1.14, 0.145], [-0.18, 1.07, 0.1]].map(([x, y, z]) => new V3(x, y, z)), 0.011, G.rope, (p) => torsoW(p));
  const hw = [[SB.PEL, 0.7], [SB.THL, 0.3]];
  ofkRope(B, hi, [new V3(-0.18, 1.07, -0.13), new V3(-0.19, 1.0, -0.12)], 0.007, G.rope, hw);
  dHorn(B, [new V3(-0.19, 1.0, -0.12), new V3(-0.195, 0.95, -0.12), new V3(-0.205, 0.915, -0.105), new V3(-0.203, 0.925, -0.08), new V3(-0.195, 0.95, -0.075)], 0.009, 0.004, hw, G.brass, 'gloss', hi ? 6 : 4);
  // lantern hung on the coat's front, left: iron frame, four amber panes, cap and handle
  const lw = [[SB.PEL, 0.6], [SB.THL, 0.4]], lm = gMat(-0.1, 0.99, -0.19, 0, 0.3);
  gBox(B, 0.06, 0.08, 0.06, hi ? 0.006 : 0, lm, lw, G.iron, 'metD');
  for (const [x, z, ry] of [[0, -0.032, 0], [0, 0.032, 0], [-0.032, 0, Math.PI / 2], [0.032, 0, Math.PI / 2]]) gBox(B, 0.04, 0.055, 0.004, 0, lm.clone().multiply(gMat(x, -0.002, z, 0, ry)), lw, G.glowc, 'glow', 0, 0);
  gCyl(B, 0.036, 0.012, 0.032, hi ? 8 : 5, lm.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.056, 0)), lw, G.iron, 'metD');
  if (hi) gBand(B, [[-0.02, 0.07, 0], [0, 0.105, 0], [0.02, 0.07, 0]].map(([x, y, z]) => new V3(x, y, z).applyMatrix4(lm)), 0.006, 0.006, () => new V3(0, 0, -1), lw, G.iron, null, 4);
}
function ofCorsairTag(B, skin, hi) { ofkTagLathe(B, hi, OF_SOUWESTER, 1.03, 0.055); }
/* Corsair cloth: the oilskin coat's skirt from the belt to the knees, closed like the coat, starting on its waist ring */
function ofCorsairCloth() { return clothBuild([ofkTails({ bottom: 0.56, a0: 0.1, a1: TAU - 0.1, coat: 0.018, flare: 0.05, cu: 17, hem: dHem(57, 0.94, 0.03), slack: 0.32, uv: (s, t) => atlasUV('art', 1 - s, 0.45 + t * 0.55) })]); }

/* ---------- Briar ---------- */
/* Three strips: a rose petal (light canvas, veins: the vertex color dyes it), a thorned vine on green, the center petal with the rose emblem */
function ofBriarArt(g, W, H) {
  const R = mulberry32(611), w3 = W / 3;
  g.fillStyle = '#d4d4d4'; g.fillRect(0, 0, w3, H); g.fillStyle = '#3c6630'; g.fillRect(w3, 0, w3, H); g.fillStyle = '#34522a'; g.fillRect(2 * w3, 0, w3, H);
  for (const x0 of [0, 2 * w3]) {
    const cx = x0 + w3 / 2;
    g.strokeStyle = 'rgba(40,40,40,0.45)'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, H); g.stroke();
    g.lineWidth = 1.5; for (let y = 20; y < H; y += 34) for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx, y); g.quadraticCurveTo(cx + s * w3 * 0.2, y + 8, cx + s * w3 * 0.45, y + 26); g.stroke(); }
    const gr = g.createLinearGradient(x0, 0, x0 + w3, 0); gr.addColorStop(0, 'rgba(0,0,0,0.35)'); gr.addColorStop(0.2, 'rgba(0,0,0,0)'); gr.addColorStop(0.8, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.35)');
    g.fillStyle = gr; g.fillRect(x0, 0, w3, H);
  }
  // vine: thick wavy stem, thorns on both sides, small leaves
  const vx = (y) => w3 * 1.5 + Math.sin(y / H * TAU * 2) * w3 * 0.16;
  g.strokeStyle = '#1e3a16'; g.lineWidth = w3 * 0.22; g.lineCap = 'round'; g.beginPath(); for (let y = 0; y <= H; y += 8) (y ? g.lineTo(vx(y), y) : g.moveTo(vx(y), y)); g.stroke();
  g.fillStyle = '#5a2a1e';
  for (let y = 14; y < H; y += 22) for (const s of [-1, 1]) { const x = vx(y) + s * w3 * 0.1; ofkPoly(g, [[x, y - 6], [x + s * w3 * 0.2, y + 4], [x, y + 5]]); }
  g.fillStyle = '#4f8a3a'; for (let y = 40; y < H; y += 70) { g.beginPath(); g.ellipse(vx(y) + w3 * 0.2, y, w3 * 0.16, w3 * 0.07, 0.5, 0, TAU); g.fill(); }
  for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(R() * W, R() * H, 2 + R() * 8, 2 + R() * 8); }
  ofBriarRose(g, w3 * 2.5, H * 0.3, w3 * 0.36);
}
/* Rose: five rounded outer petals, an inner spiral, two leaves (canvas, center x y, radius r) */
function ofBriarRose(g, x, y, r) {
  g.fillStyle = '#3f6a32';
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(x + s * r * 0.9, y + r * 0.85, r * 0.55, r * 0.22, s * 0.5, 0, TAU); g.fill(); }
  g.fillStyle = '#b3203a';
  for (let i = 0; i < 5; i++) { const a = i * TAU / 5 - Math.PI / 2; g.beginPath(); g.arc(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, r * 0.55, 0, TAU); g.fill(); }
  g.strokeStyle = '#6e0f20'; g.lineWidth = Math.max(2, r * 0.1); g.beginPath();
  for (let t = 0; t < 14; t += 0.2) { const rr = r * 0.05 * t, a = t * 1.2; if (t) g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else g.moveTo(x, y); }
  g.stroke();
}
/* Rose badge: five extruded petals and a dark heart, at matrix m (facing its +z) */
function ofBriarBadge(B, m, wt, s, G) {
  const pet = []; for (let i = 0; i < 20; i++) { const a = i / 20 * TAU, k = 0.75 + 0.25 * Math.abs(Math.cos(a * 2.5)); pet.push([Math.cos(a) * s * k, Math.sin(a) * s * k]); }
  dExtrude(B, pet, 0.006, 0, m, wt, G.rose, 'paint');
  dExtrude(B, pet.map(([x, y]) => [x * 0.45, y * 0.45]), 0.006, 0, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.004)), wt, G.rose2, 'paint');
}
/* Briar pieces: thorn crown around the helmet, rose badge on the helmet and the chest, thorn pauldrons, rose knee pads */
function ofBriarModel(B, skin, hi) {
  const G = skinGear(skin), hm = ofkHM(), c = new V3(0, 0.024, 0.008), n = hi ? 11 : 7;
  for (let i = 0; i < n; i++) {
    const ph = (i / n) * TAU + 0.2, th = 1.12, d = new V3(Math.sin(th) * Math.sin(ph) * 0.108, Math.cos(th) * 0.118, -Math.sin(th) * Math.cos(ph) * 0.123), p = d.clone().add(c);
    const dir = d.clone().normalize().add(new V3(0, 0.55, 0)).normalize();
    dHorn(B, [p.clone().addScaledVector(dir, -0.004).applyMatrix4(hm), p.clone().addScaledVector(dir, 0.02).applyMatrix4(hm), p.clone().addScaledVector(dir, 0.04).add(new V3(0, 0.008, 0)).applyMatrix4(hm)], 0.008, 0.001, SB.HEA, G.thorn, 'paint', hi ? 5 : 3);
  }
  ofBriarBadge(B, hm.clone().multiply(gMat(0, 0.105, -0.112, -0.5)), SB.HEA, 0.016, G);
  if (hi) ofBriarBadge(B, gMat(0.075, 1.28, -0.172, 0.12, Math.PI), SB.CHE, 0.02, G);
  for (const sx of [-1, 1]) { const m = ofkDome(B, hi, sx, { r: [0.088, 0.058, 0.098], off: [0.02, 0.045, 0.0], col: G.plate, roll: 0.55 }); ofkSpikes(B, hi, sx, m, hi ? 7 : 4, 0.045, 0.009, G.thorn, 'paint', 13); }
  dArmor(B, G, hi, { knee: G.rosek, fore: G.plate, foreAcc: G.rose });
}
/* Briar cloth: cape of seven pieces from the shoulder blades: rose-red petals, thorned green vines between them, the center petal longest
   with the rose */
function ofBriarCloth(skin) {
  const G = skinGear(skin), sheets = [], n = 7;
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1), A = Math.PI + (f - 0.5) * 1.8, mid = 1 - Math.abs(f - 0.5) * 2, out = new V3(Math.sin(A), 0, -Math.cos(A)), vine = i !== 3 && i % 2 === 0;
    const p0 = new V3(Math.sin(A) * 0.19, 1.43 - (1 - mid) * 0.05 - (i % 2) * 0.05, -Math.cos(A) * 0.165 + 0.012 + (i % 2) * 0.012);
    sheets.push(ofkPetal({ p0, dir: new V3(0, -1, 0).addScaledVector(out, 0.2).normalize(), side: new V3(Math.cos(A), 0, Math.sin(A)), nrm: out, len: 0.46 + mid * 0.24, wd: (vine ? 0.16 : 0.23) + mid * 0.04, cup: 0.02,
      w: (p) => ponchoWeights(p, A), uv: (s, t) => atlasUV('art', ((i === 3 ? 2 : vine ? 1 : 0) + (1 - s)) / 3, t), col: i === 3 || vine ? G.leaf : G.rose }));
  }
  return clothBuild(sheets, { drag: 1.0 });
}

/* ---------- Argonaut ---------- */
/* Back cloth: Aegean blue linen, white border, a white running wave across it */
function ofArgoArt(g, W, H) {
  // top half: the back cloth (white border, a running wave); bottom half: the tunic skirt (white band at its hem)
  ofkArtCloth(g, W, H, '#2a62a6', 359, 0.1, 80);
  g.fillStyle = '#eceae2'; g.fillRect(0, 0, W * 0.07, H * 0.5); g.fillRect(W * 0.93, 0, W * 0.07, H * 0.5); g.fillRect(0, H * 0.42, W, H * 0.03); g.fillRect(0, H * 0.9, W, H * 0.05);
  g.strokeStyle = '#eceae2'; g.lineWidth = W * 0.035; g.lineCap = 'round'; g.beginPath();
  for (let x = W * 0.12; x <= W * 0.88; x += 2) { const t = (x - W * 0.12) / (W * 0.19), y = H * 0.18 + Math.sin(t * Math.PI * 2) * H * 0.03; x <= W * 0.12 ? g.moveTo(x, y) : g.lineTo(x, y); }
  g.stroke();
}
/* Crest: bronze ridge and Aegean blue plume along the top of the helmet (soldierHelmet's shell), front to back, as thick as a hand */
function ofArgoCrest(B, hi, G) {
  const hm = ofkHM(), c = new V3(0, 0.024, 0.008), outer = [], inner = [], base = [], n = hi ? 18 : 9;
  for (let i = 0; i <= n; i++) {
    const f = -0.55 + i / n * 2.1, y = c.y + Math.cos(f) * 0.118, z = c.z + Math.sin(f) * 0.123, nn = new V3(0, Math.cos(f) / 0.118, Math.sin(f) / 0.123).normalize();
    const h = (0.018 + 0.075 * smoothstep(-0.55, 0.0, f) * (1 - 0.75 * smoothstep(0.4, 1.55, f))) * (i % 2 && i < n ? 0.78 : 1); // (tapered, notched)
    inner.push([-(z - nn.z * 0.004), y - nn.y * 0.004]); outer.push([-(z + nn.z * h), y + nn.y * h]); base.push([-(z + nn.z * 0.014), y + nn.y * 0.014]);
  }
  const m = hm.clone().multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
  dExtrude(B, outer.concat(base.slice().reverse()), 0.042, hi ? 0.012 : 0, m, SB.HEA, G.blue, 'fab');
  dExtrude(B, base.concat(inner.slice().reverse()), 0.07, hi ? 0.003 : 0, m, SB.HEA, G.bronze, 'gloss');
}
/* Argonaut pieces: crest, bronze shoulder domes and shin and knee plates, linen wraps on the forearms */
function ofArgoModel(B, skin, hi) {
  const G = skinGear(skin);
  ofArgoCrest(B, hi, G);
  for (const sx of [-1, 1]) {
    ofkDome(B, hi, sx, { r: [0.086, 0.052, 0.094], off: [0.022, 0.045, 0.0], col: G.bronze, tile: 'gloss', roll: 0.5, seg: 12 });
    for (const d of [0.36, 0.4, 0.44, 0.48]) ofkLimbRing(B, hi, sx, true, d, 0.03, 0.003 + (d - 0.36) * 0.01, G.linen, 'fab');
  }
  dArmor(B, G, hi, { shin: G.bronze, knee: G.bronze, plateTile: 'gloss' });
}
/* Argonaut cloth: blue back cloth with a white border from the shoulders, hanging loose, and the blue tunic skirt from the belt */
function ofArgoCloth() {
  return clothBuild([ofkCape({ bottom: 0.92, span: 0.95, flare: 0.07, hem: dHem(37, 0.84, 0.1), slack: 0.85, cu: 11, uv: (s, t) => atlasUV('art', 1 - s, t * 0.48) }),
    ofkTails({ bottom: 0.8, a0: 0.3, a1: TAU - 0.3, flare: 0.03, cu: 17, hem: dHem(39, 0.9, 0.12), slack: 0.3, uv: (s, t) => atlasUV('art', 1 - s, 0.52 + t * 0.46) })]);
}

/* ---------- Cinder ---------- */
/* Scorched cape: charcoal canvas charred toward the hem, burnt holes edged in orange, sparks */
function ofCinderArt(g, W, H) {
  const R = ofkArtCloth(g, W, H, '#3c3835', 703, 0.2, 120);
  const gr = g.createLinearGradient(0, H * 0.45, 0, H); gr.addColorStop(0, 'rgba(10,8,6,0)'); gr.addColorStop(1, 'rgba(10,8,6,0.95)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 26; i++) { const x = W * (0.1 + R() * 0.8), y = H * (0.55 + R() * 0.35), r = 3 + R() * 8; g.fillStyle = '#0c0a08'; g.beginPath(); g.ellipse(x, y, r, r * 0.7, R() * 3, 0, TAU); g.fill(); g.strokeStyle = 'rgba(230,100,20,0.9)'; g.lineWidth = 2; g.stroke(); }
  for (let i = 0; i < 80; i++) { g.fillStyle = R() < 0.5 ? '#ff7a20' : '#ffb040'; g.fillRect(W * (0.05 + R() * 0.9), H * (0.6 + R() * 0.3), 1 + R() * 2, 1 + R() * 2); }
}
/* Cinder pieces: close cap, respirator, glowing goggles, heat plates on the shoulders and the chest, wide lava cracks on the jacket, the
   sleeves and the legs */
function ofCinderModel(B, skin, hi) {
  const G = skinGear(skin), E = G.glowc, w = 0.024;
  ofkSkullCap(B, hi, { th: (ph) => (Math.abs(ph) < 0.6 ? 1.12 : Math.abs(ph) < 1.2 ? lerp(1.12, 2.35, smoothstep(0.6, 1.2, Math.abs(ph))) : 2.35), grow: 0.008, c: G.hood, tile: 'fab' });
  ofkRespirator(B, G, hi, G.poly, G.can, G.metal);
  dGoggles(B, G, hi, 0.34, 1.47, E, true);
  ofkPackStraps(B, hi, G.strap, 0.04);
  gBox(B, 0.2, 0.09, 0.022, hi ? 0.008 : 0, gMat(0, 1.37, -0.125, 0.25), SB.CHE, G.metal, 'metD', 1.2, hi ? 2 : 0);
  for (const sx of [-1, 1]) {
    ofkDome(B, hi, sx, { r: [0.084, 0.052, 0.094], off: [0.02, 0.042, 0.0], col: G.metal, tile: 'metD', roll: 0.5 });
    ofkLimbLine(B, hi, sx, true, 0.2, 0.5, (d) => 0.2 * sx + 0.55 * Math.sin(d * 21 + sx), w, 0.003, E, 'glow', hi ? 12 : 6);
    ofkLimbLine(B, hi, sx, false, 0.04, 0.62, (d) => 0.6 + 0.5 * Math.sin(d * 15 + sx * 2), w, 0.003, E, 'glow', hi ? 14 : 7);
    ofkLimbLine(B, hi, sx, false, 0.1, 0.38, (d) => -0.9 + 0.4 * Math.sin(d * 19), w * 0.8, 0.003, E, 'glow', hi ? 8 : 4);
  }
  for (const L of [[[1.28, 0.32], [1.22, 0.5], [1.17, 0.36], [1.12, 0.58], [1.06, 0.45]], [[1.29, -0.15], [1.23, -0.36], [1.17, -0.18], [1.1, -0.42]], [[1.24, 0.08], [1.16, -0.02], [1.09, 0.1]],
    [[1.4, 2.6], [1.3, 2.9], [1.2, 2.7], [1.1, 3.0]], [[1.38, 3.6], [1.28, 3.4], [1.16, 3.62]]]) ofkShirtLine(B, hi, L, { w, col: E, g: 0.005 });
  dArmor(B, G, hi, { knee: G.metal, plateTile: 'metD' });
}
function ofCinderTag(B, skin, hi) { ofkTagSkull(B, hi, 1.0, 0.012, 0, 0.024); }
/* Cinder cloth: scorched cape to the knees, a burning hem and embers glowing above it */
function ofCinderCloth(skin) {
  const G = skinGear(skin), T = clothBuild([ofkCape({ bottom: 0.6, span: 1.02, flare: 0.05, hem: dHem(73, 0.82, 0.12), slack: 0.7 })]), R = mulberry32(77), st = [];
  for (let s = 0.14; s < 0.87; s += 0.028) st.push([s, 0.9, 1.2 + R() * 0.4]);
  for (let i = 0; i < 14; i++) st.push([0.16 + R() * 0.68, 0.7 + R() * 0.15, 0.6 + R() * 0.4]);
  for (let i = 0; i <= 26; i++) { const t = 0.92 - i * 0.032; st.push([0.5 + 0.07 * Math.sin(i * 1.7) + 0.03 * Math.sin(i * 4.3), t, 0.75]); } // fissure up the cape
  return clothSatBuild(T, ofkClothDots(T, 0, st, 0.011, G.glowc, 'glow', 0.002));
}

/* ---------- Stratos ---------- */
/* Patch on the bomber's back: a ring with two swept wings, on brown leather */
function ofStratosArt(g, W, H) {
  g.fillStyle = '#4a2e1a'; g.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2, c = '#e8dcc0';
  g.fillStyle = c; g.strokeStyle = c; g.lineWidth = W * 0.05;
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) ofkPoly(g, [[cx + s * W * 0.1, cy - H * 0.08 + k * H * 0.05], [cx + s * W * (0.46 - k * 0.07), cy - H * (0.22 - k * 0.06)], [cx + s * W * (0.42 - k * 0.07), cy - H * (0.14 - k * 0.06)], [cx + s * W * 0.1, cy - H * 0.02 + k * H * 0.05]]);
  g.beginPath(); g.arc(cx, cy, W * 0.11, 0, TAU); g.stroke();
  g.fillStyle = '#7fa8cf'; g.beginPath(); g.arc(cx, cy, W * 0.07, 0, TAU); g.fill();
}
/* Flight cap: down to the brow in front, ear flaps on the sides, the nape behind */
const ofStratosCapTh = (ph) => { const a = Math.abs(ph); return a < 0.55 ? 1.04 : a < 1.25 ? lerp(1.04, 2.2, smoothstep(0.55, 1.25, a)) : a < 2.0 ? 2.2 : lerp(2.2, 1.9, smoothstep(2.0, 2.6, a)); };
/* Stratos pieces: leather flight cap and raised goggles, oxygen mask and hose, leather bomber (body, sleeves, fleece collar, waistband,
   winged patch on the back), leg loops */
function ofStratosModel(B, skin, hi) {
  const G = skinGear(skin), hm = ofkHM();
  ofkSkullCap(B, hi, { th: ofStratosCapTh, grow: 0.01, col: (th, ph, vv) => (vv > 0.86 ? G.fleece : G.leather), tile: 'leat', bump: (th, ph) => (Math.abs(Math.abs(ph) - 1.57) < 0.5 && th > 1.6 ? 0.004 : 0) + (th > ofStratosCapTh(ph) * 0.88 ? 0.005 : 0) });
  dGoggles(B, G, hi, 0.37, 0.96, G.lens);
  const om = ofkHeadFrame(2.25, 0, 0.012).multiply(gMat(0, 0, 0.02, Math.PI / 2));
  gCyl(B, 0.04, 0.032, 0.045, hi ? 12 : 6, om, SB.HEA, G.rubber, 'rub');
  if (hi) gBand(B, [[0, -0.1, -0.12], [0.03, -0.17, -0.12], [0.07, -0.24, -0.1]].map(([x, y, z]) => new V3(x, y, z).applyMatrix4(hm)), 0.016, 0.016, () => new V3(0, 0, -1), [[SB.HEA, 0.5], [SB.NEC, 0.5]], G.rubber, ofkTile('rub'), 6);
  ofkCoat(B, hi, { g: 0.016, gap0: 0.07, gap1: 0.07, col: G.leather, tile: 'leat', flare: 0.08 });
  for (const sx of [-1, 1]) ofkLimbTube(B, hi, sx, true, -0.03, 0.47, 0.011, G.leather, 'leat', { col: (u, v) => (v > 0.88 ? G.knit2 : G.leather), bulge: (v) => 0.004 * Math.sin(v * Math.PI) });
  ofkCollar(B, hi, 0.35, 1.44, 1.53, 0.115, 0.035, G.fleece, 'hair');
  ofkTagArms(B, hi, 0.02); ofkTagPatch(B, hi, 1.36, -0.5, 0.016);
  const wb = [[1.04, 0.17, 0.124, 0.124], [1.08, 0.168, 0.124, 0.122]];
  skinLoft(B, wb.map(([y, w, f, bk]) => ({ c: new V3(0, y, 0), X: new V3(1, 0, 0), Y: new V3(0, 0, -1), r: [w, w, f, bk], n: 2.5, v: y })), hi ? 30 : 12, { wp: (p) => torsoW(p), col: () => G.knit2, uv: () => GEAR_TILE.fab });
  ofkArtBox(B, 0.2, 0.15, 0.008, gMat(0, 1.3, 0.128, -0.1), SB.CHE, OFK_WHITE, 0.0, 0.0, 1.0, 1.0);
  for (const sx of [-1, 1]) ofkLimbRing(B, hi, sx, false, 0.07, 0.04, 0.004, G.strap, 'nyl');
  dArmor(B, G, hi, { knee: G.knee });
}
function ofStratosTag(B, skin, hi) { ofkTagSkull(B, hi, 0.6, 0.012, 0, 0.022); }
/* Stratos cloth: the white scarf's tail from the left of the collar down the left of the back to the waist, tapered, clear of the patch */
function ofStratosCloth(skin) {
  const G = skinGear(skin);
  return clothBuild([clothStrip({ p0: new V3(-0.135, 1.47, 0.075), dir: new V3(-0.15, -0.9, 0.4).normalize(), side: new V3(0.95, 0, 0.3).normalize(), len: 0.44, w0: 0.09, w1: 0.03, taper: 1.4, cu: 3, rv: 9,
    w: (p, t) => [[SB.NEC, Math.max(0.2, 0.7 - t)], [SB.CHE, 0.3 + t]], maxD: (t) => 0.02 + t * 0.55, uv: () => GEAR_TILE.fab, col: G.scarf, shade: 0.8 })], { drag: 1.3 });
}

/* ---------- Sandveil ---------- */
/* Storm cloak: rust canvas with wind-swept darker bands, a gold sun of eight rays */
function ofSandArt(g, W, H) {
  const R = ofkArtCloth(g, W, H, '#8e5c34', 809, 0.35, 120), cx = W / 2, cy = H * 0.26;
  g.strokeStyle = 'rgba(60,36,20,0.35)'; g.lineCap = 'round';
  for (let i = 0; i < 14; i++) { g.lineWidth = 4 + R() * 10; const y = H * (0.46 + R() * 0.46); g.beginPath(); g.moveTo(-10, y); g.bezierCurveTo(W * 0.3, y - 30 + R() * 60, W * 0.7, y - 30 + R() * 60, W + 10, y + (R() - 0.5) * 40); g.stroke(); }
  g.fillStyle = '#e8b848';
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8 - Math.PI / 2, L = i % 2 ? 0.2 : 0.27; ofkPoly(g, [[cx + Math.cos(a - 0.2) * W * 0.12, cy + Math.sin(a - 0.2) * W * 0.12], [cx + Math.cos(a) * W * L, cy + Math.sin(a) * W * L], [cx + Math.cos(a + 0.2) * W * 0.12, cy + Math.sin(a + 0.2) * W * 0.12]]); }
  g.beginPath(); g.arc(cx, cy, W * 0.12, 0, TAU); g.fill();
  g.fillStyle = '#8e5c34'; g.beginPath(); g.arc(cx, cy, W * 0.06, 0, TAU); g.fill();
  g.fillStyle = '#c99a3a'; g.fillRect(0, H * 0.86, W, H * 0.025);
}
/* Turban: wound cloth, two tones by turn, slanted folds; down to the brow in front, wrapped down to the nape behind */
const OF_TURBAN = { rx: 0.09, rz: 0.112, prof: [[0, 0.19], [0.45, 0.19], [0.8, 0.181], [1.02, 0.163], [1.13, 0.14], [1.08, 0.124], [1.16, 0.104], [1.09, 0.087], [1.13, 0.068], [1.05, 0.05], [1.0, 0.034], [0.93, 0.022]],
  dy: (a, r, k) => (k > 2 ? 0.009 * Math.sin(a + k * 0.9) : 0) - (k >= 8 ? 0.11 * Math.pow(Math.max(0, -Math.cos(a)), 1.3) * (k - 7) / 4 : 0) };
/* Sandveil pieces: turban and its sun-gold band, goggles, gold cuffs (the veil and the mask: cloth and parts) */
function ofSandModel(B, skin, hi) {
  const G = skinGear(skin);
  ofkLathe(B, hi, Object.assign({ col: (k) => (k % 2 ? G.wrap : G.wrap2), tile: 'fab' }, OF_TURBAN));
  ofkTagLathe(B, hi, OF_TURBAN, 1.1, 0.06, 0.014, G.glowc, 'glow', 0.008);
  dGoggles(B, G, hi, 0.35, 1.47, G.lens);
  for (const sx of [-1, 1]) ofkLimbRing(B, hi, sx, true, 0.48, 0.02, 0.004, G.glowc, 'glow');
  dArmor(B, G, hi, { knee: G.knee });
}
function ofSandTag(B, skin, hi) { ofkTagLathe(B, hi, OF_TURBAN, 1.0, 0.165, 0.024, OFK_WHITE, 'tag', 0.012); }
/* Sandveil cloth: storm cloak to the ankles with gold dots along its edges, and the veil hanging from under the eyes */
function ofSandCloth(skin) {
  const G = skinGear(skin), hm = ofkHM(), nose = headPt(1.66, 0, new V3(), 0.03).applyMatrix4(hm);
  const cloak = ofkCape({ bottom: 0.14, span: 1.28, flare: 0.15, hem: dHem(83, 0.86, 0.08), slack: 0.8, cu: 17 });
  const veil = clothStrip({ p0: nose, dir: new V3(0, -0.96, -0.28).normalize(), side: new V3(1, 0, 0), len: 0.16, w0: 0.13, w1: 0.02, taper: 0.8, cu: 3, rv: 5,
    w: (p, t) => [[SB.HEA, Math.max(0.2, 1 - t * 2)], [SB.NEC, Math.min(0.8, t * 1.6)]], maxD: (t) => 0.01 + t * 0.12, uv: () => GEAR_TILE.fab, col: G.veil, shade: 0.7 });
  const T = clothBuild([cloak, veil], { drag: 1.0 }), st = [];
  for (let s = 0.12; s < 0.89; s += 0.04) st.push([s, 0.9]);
  for (let t = 0.14; t < 0.86; t += 0.07) st.push([0.09, t], [0.91, t]);
  return clothSatBuild(T, ofkClothDots(T, 0, st, 0.007, G.glowc, 'glow', 0.002));
}

/* ---------- Dusk Patrol ---------- */
/* Patrol cape: navy at the shoulders fading to an orange-pink dusk, the sun going down behind the roofs of the estate, a lit hem */
function ofDuskArt(g, W, H) {
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1c2440'); gr.addColorStop(0.35, '#3a2c52'); gr.addColorStop(0.65, '#d2566a'); gr.addColorStop(0.9, '#ff9a5a'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(W * 0.5, H * 0.8, W * 0.2, Math.PI, TAU); g.fill();
  g.fillStyle = '#16181f';
  ofkPoly(g, [[0, H], [0, H * 0.78], [W * 0.12, H * 0.72], [W * 0.24, H * 0.78], [W * 0.24, H * 0.84], [W * 0.36, H * 0.74], [W * 0.5, H * 0.82], [W * 0.62, H * 0.7], [W * 0.62, H * 0.64], [W * 0.68, H * 0.64], [W * 0.68, H * 0.73],
    [W * 0.78, H * 0.76], [W * 0.88, H * 0.7], [W, H * 0.76], [W, H]]);
  g.fillStyle = '#ffd27a'; for (const [x, y] of [[0.1, 0.86], [0.3, 0.9], [0.45, 0.91], [0.72, 0.88], [0.9, 0.9]]) g.fillRect(W * x, H * y, W * 0.04, H * 0.03);
  g.fillStyle = '#ff7a5a'; g.fillRect(0, H * 0.95, W, H * 0.03); g.fillRect(0, 0, W * 0.03, H); g.fillRect(W * 0.97, 0, W * 0.03, H);
}
/* Patrol cap: crown with a raised front panel, visor, recognition band around the crown */
const OF_PCAP = { rx: 0.084, rz: 0.106, prof: [[0, 0.132], [0.55, 0.131], [0.86, 0.12], [0.98, 0.088], [1.02, 0.05], [1.025, 0.03], [0.98, 0.028]],
  dy: (a, r) => (r < 0.95 ? 0.014 * Math.max(0, Math.cos(a)) * (1 - r * 0.4) : 0) };
/* Dusk Patrol pieces: cap, visor and badge, orange-pink trims on the cap and the vest, torch on the left strap, radio on the right one */
function ofDuskModel(B, skin, hi) {
  const G = skinGear(skin), hm = ofkHM(), A = G.glowc;
  ofkLathe(B, hi, Object.assign({ c: G.cap, tile: 'fab' }, OF_PCAP));
  ofkBrim(B, hi, OF_PCAP, 1.15, (a) => 0.62 * Math.pow(Math.cos(a / 1.15 * Math.PI / 2), 0.4), 0.034, 0.18, G.cap.clone().multiplyScalar(0.8), 'paint');
  ofkTagLathe(B, hi, OF_PCAP, 1.02, 0.036, 0.008, A, 'glow', 0.003);
  dExtrude(B, [[-0.013, 0.012], [0.013, 0.012], [0.013, -0.004], [0, -0.016], [-0.013, -0.004]], 0.004, 0, hm.clone().multiply(gMat(0, 0.085, -0.118, -0.35)), SB.HEA, G.brass, 'gloss');
  // the patrol cape's shoulder mantle, orange-pink, over the shoulders and the top of the vest (the front sees it)
  ofkMantle(B, hi, 1.34, 0.9, 0.003, G.cape, 'fab', null, 0.032);
  // orange-pink reflective strip flat on the vest's front plate, under the mantle
  gBox(B, 0.24, 0.016, 0.004, 0, gMat(0, 1.25, -0.173, 0.12), SB.CHE, A, 'glow', 1.0, 0);
  // torch on the mantle over the left shoulder strap, its lens lit
  const tm = gMat(-0.11, 1.42, -0.232, Math.PI / 2 - 0.2);
  gCyl(B, 0.02, 0.02, 0.09, hi ? 10 : 6, tm, SB.CHE, G.poly, 'poly');
  gCyl(B, 0.027, 0.022, 0.026, hi ? 10 : 6, tm.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.055, 0)), SB.CHE, G.poly, 'poly');
  gCyl(B, 0.023, 0.023, 0.004, hi ? 10 : 6, tm.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.069, 0)), SB.CHE, G.lamp, 'glow');
  const rm = gMat(0.11, 1.39, -0.244, 0.25);
  gBox(B, 0.055, 0.085, 0.032, hi ? 0.008 : 0, rm, SB.CHE, G.poly, 'poly');
  gBox(B, 0.012, 0.012, 0.004, 0, rm.clone().multiply(new THREE.Matrix4().makeTranslation(0.012, 0.028, 0.017)), SB.CHE, A, 'glow', 0, 0);
  dHorn(B, [new V3(0.125, 1.43, -0.237), new V3(0.13, 1.55, -0.229)], 0.007, 0.004, SB.CHE, G.poly, 'rub', hi ? 6 : 4);
  dArmor(B, G, hi, { knee: G.knee, kneeAcc: A, kneeTile: 'glow' });
}
function ofDuskTag(B, skin, hi) { ofkTagLathe(B, hi, OF_PCAP, 1.02, 0.062, 0.018); }
/* Dusk Patrol cloth: the short patrol cape, wrapping the shoulders so it shows from the front, down to the belt */
function ofDuskCloth() { return clothBuild([ofkCape({ bottom: 1.0, span: 1.45, flare: 0.06, hem: dHem(673, 0.92, 0.05), slack: 0.6, cu: 15 })]); }

/* ---------- Jaguar ---------- */
/* Mantle: ochre with large black rosettes, a dark frayed edge */
function ofJaguarArt(g, W, H) {
  const R = ofkArtCloth(g, W, H, '#b8883a', 307, 0.25, 80);
  for (let i = 0; i < 42; i++) {
    const x = ((i % 6) + 0.2 + R() * 0.6) / 6 * W, y = (Math.floor(i / 6) + 0.2 + R() * 0.6) / 7 * H * 0.96, r = 11 + R() * 7;
    g.fillStyle = '#8a5e22'; g.beginPath(); g.ellipse(x, y, r * 0.75, r * 0.6, R() * 3, 0, TAU); g.fill();
    g.fillStyle = '#16120a'; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU + R() * 0.5; g.beginPath(); g.ellipse(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.85, r * (0.32 + R() * 0.12), r * (0.22 + R() * 0.08), a, 0, TAU); g.fill(); }
  }
  g.strokeStyle = 'rgba(30,22,10,0.7)'; g.lineWidth = 1.5;
  for (let i = 0; i < 70; i++) { const x = R() * W, y = H * (0.9 + R() * 0.08); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 3, y + 5 + R() * 10); g.stroke(); }
}
/* Boonie hat: soft crown, wavy drooping brim, camouflaged like the outfit */
const OF_BOONIE = { rx: 0.084, rz: 0.106, prof: [[0, 0.145], [0.5, 0.143], [0.82, 0.133], [0.97, 0.108], [1.02, 0.064], [1.04, 0.036], [1.42, 0.022], [1.74, 0.002], [1.76, -0.007], [1.72, -0.011], [1.4, 0.01], [1.0, 0.03]],
  dy: (a, r) => (r > 1.05 ? -(r - 1.05) * (0.04 + 0.025 * Math.sin(a * 3 + 1)) : 0), uvf: (a, k) => camoUV(a / TAU * 0.6, k * 0.018, 0.7, 0.21, 0.12) };
/* Face paint on the balaclava: black bands across the brow, the eyes and the cheeks */
function ofFacePaint(B, hi, cols) {
  const hm = ofkHM(), v = new V3(), T = GEAR_TILE.fab;
  const band = (th0, ph0, th1, ph1, wd, col) => skinSurf(B, hi ? 6 : 2, 1, (u, vv, o) => {
    const th = lerp(th0, th1, u) + (vv - 0.5) * wd, ph = lerp(ph0, ph1, u);
    headPt(th, ph, v, 0.0018).applyMatrix4(hm); o.x = v.x; o.y = v.y; o.z = v.z; o.w = SB.HEA; o.col = col; o.U = T[0]; o.V = T[1];
  }, { out: true });
  band(1.24, -0.85, 1.24, 0.85, 0.11, cols[0]);
  for (const s of [-1, 1]) { band(1.66, s * 0.18, 1.98, s * 1.05, 0.13, cols[0]); band(1.98, s * 0.15, 2.3, s * 0.85, 0.09, cols[1]); }
  band(2.45, -0.5, 2.45, 0.5, 0.1, cols[0]);
}
/* Jaguar pieces: boonie hat, painted balaclava, machete on the left thigh */
function ofJaguarModel(B, skin, hi) {
  const G = skinGear(skin);
  ofkLathe(B, hi, Object.assign({ c: OFK_WHITE }, OF_BOONIE));
  ofFacePaint(B, hi, [G.paint1, G.paint2]);
  const R = soldierRest(), J = R.J, b = SIDE_B(-1), m = dSeg(J[b.jHi], J[b.jKn], 0.4, new V3(-1, 0, 0.3), 0.1), wt = legW(b)(SD.thigh * 0.4);
  dPlate(B, 0.05, 0.36, 0.016, m, wt, G.leather, 0, 'leat');
  gBox(B, 0.028, 0.11, 0.026, hi ? 0.008 : 0, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.23, 0)), wt, G.poly, 'rub');
  dArmor(B, G, hi, { knee: G.knee });
}
function ofJaguarTag(B, skin, hi) { ofkTagLathe(B, hi, OF_BOONIE, 1.035, 0.05); }
/* Jaguar cloth: rosette mantle around the shoulders, down to the chest in front and to the waist behind */
function ofJaguarCloth() {
  const rings = [[1.49, 0.14, 0.1, 0.1], [1.44, 0.235, 0.165, 0.155], [1.35, 0.265, 0.21, 0.195], [1.2, 0.27, 0.23, 0.215], [1.0, 0.275, 0.235, 0.23]], R = mulberry32(19);
  const front = (s) => smoothstep(0.06, 0.3, Math.min(s, 1 - s)), hm = [];
  const mantle = clothRing({ rings, a0: 0.42, a1: TAU - 0.42, cu: 17, rv: 12, hem: (s, i) => { while (hm.length <= i) hm.push(0.88 + R() * 0.12); return lerp(0.24, 1, front(s)) * hm[i]; },
    w: (p, a) => ponchoWeights(p, a), maxD: (p) => 0.02 + Math.max(0, 1.47 - p.y) * 0.55, uv: (s, t) => atlasUV('art', 1 - s, t), shade: 0.55 });
  return clothBuild([mantle], { drag: 1.0 });
}

/* ---------- The map outfits ---------- */
Object.assign(SKINS, {
  duneRider: {
    name: _t('Dune Rider'), role: _t('Raids across the sand of Chergui'), seed: 761, sym: 'L', challenge: true, map: 'chergui',
    camo: { style: 'blot', base: '#a88d66', soft: ['#b39a72', '#9a805c'], mid: ['#c2a982', '#7e6648', '#39406a'], branch: ['#5a4632', '#2a2f52'], hi: '#d8c7a4' },
    gear: ofkGear({ vest: '#8a7458', glove: '#6a5640', boot: '#9a8262', belt: '#4a3c2e', mask: '#2c3566', lens: '#3a2410', knit: '#b39a72' },
      { indigo: '#2c3566', indigo2: '#3a4680', leather: '#6e5236', sand: '#c9b089', sand2: '#b09370' }),
    parts: { mask: 'fab', glasses: false, carrier: false, patch: false, cape: true },
    tone: [[1.12, 1.1, 1.06], [0.46, 0.45, 0.44]], art: ofDuneArt, model: ofDuneModel, cloth: ofDuneCloth, tagHead: ofDuneTag, neon: 0,
  },
  whiteout: {
    name: _t('Whiteout'), role: _t('Unseen in the snow of Saint-Givre'), seed: 883, sym: 'L', challenge: true, map: 'saintgivre',
    camo: { style: 'poly', base: '#d3d8dc', soft: ['#ccd2d7', '#dde1e4'], mid: ['#b8c0c7', '#e9ecee', '#a5aeb7'], n: [40, 35, 25], branch: ['#8e98a2'], hi: '#f4f6f7' },
    gear: ofkGear({ vest: '#b9c0c6', pouch: '#c6ccd1', glove: '#9aa3ab', boot: '#c4cacf', sole: '#4a4e52', belt: '#9aa2a9', mask: '#d8dcdf', knit: '#c9ced3', knee: '#c4cacf' },
      { glowc: '#6fc6ff', fur: ['#dcdcd8', '#c9c9c5', '#e8e8e4', '#b9b9b5'] }),
    parts: { hood: { inner: true }, mask: 'fab', glasses: false, pouches: 'sn', patch: false, cape: true },
    tone: [[0.94, 0.95, 0.97], [0.4, 0.4, 0.42]], art: ofWhiteArt, model: ofWhiteModel, cloth: ofWhiteCloth, neon: 1.4,
  },
  corsair: {
    name: _t('Corsair'), role: _t('Boarding party on the docks of Port-Maël'), seed: 547, sym: 'L', challenge: true, map: 'portmael',
    camo: { style: 'poly', base: '#1f2942', soft: ['#212b45', '#1d273f'], mid: ['#232e49', '#1b2440', '#25304b'], n: [10, 10, 6], branch: ['#1a223a'], hi: '#2a3552' },
    gear: ofkGear({ vest: '#252e42', glove: '#3a2c22', boot: '#2a2622', belt: '#3a2c22', knee: '#2c3550', knit: '#1c2436', mask: '#9a2a28' },
      { hat: '#d09a2a', cuff: '#7a7a80', red: '#a3262a', cream: '#d9cfb8', brass: '#c49a40', rope: '#a8946a', iron: '#2a2826', glowc: '#ffae3a' }),
    parts: { mask: 'fab', glasses: false, carrier: false, patch: false, holster: false },
    tone: [[1.9, 1.9, 1.92], [0.5, 0.5, 0.52]], art: ofCorsairArt, model: ofCorsairModel, cloth: ofCorsairCloth, tagHead: ofCorsairTag, neon: 1.7,
  },
  briar: {
    name: _t('Briar'), role: _t('Thorns among the flowers of Floralia'), seed: 941, sym: 'L', challenge: true, map: 'floralia',
    camo: { style: 'leaf', base: '#24361f', soft: ['#2b4024', '#1f2f1b'], mid: ['#33502b', '#1a2a17', '#5a1824'], n: [230, 200, 22], branch: ['#13200f', '#4a1820'], hi: '#6a2e36' },
    gear: ofkGear({ vest: '#25361f', pouch: '#2e4226', helm: '#23341d', glove: '#1c2618', boot: '#2a2a1e', belt: '#1e2a19', knee: '#2a3a22', lens: '#7a1020' },
      { plate: '#2a3d22', thorn: '#4a2a1e', rose: '#a3203a', rose2: '#5e0e1c', rosek: '#6a1424', leaf: '#ffffff' }),
    parts: { helmet: 'paint', pouches: 'sn', patch: false, cape: true },
    tone: [[1.45, 1.44, 1.45], [0.5, 0.5, 0.5]], art: ofBriarArt, model: ofBriarModel, cloth: ofBriarCloth, neon: 0,
  },
  argonaut: {
    name: _t('Argonaut'), role: _t('Holds the white lanes of Notos'), seed: 359, sym: 'L', challenge: true, map: 'notos',
    camo: { style: 'poly', base: '#d6d3c9', soft: ['#dedbd2', '#cbc7bc'], mid: ['#3c6ea6', '#bab5a8', '#e6e3db'], n: [16, 35, 30], branch: ['#9a948a'], hi: '#f2f0ea' },
    gear: ofkGear({ vest: '#2c5c94', pouch: '#d2cdbf', helm: '#e2dfd6', glove: '#8a7a62', boot: '#8a6e4c', belt: '#6a5238', knee: '#2c5c94', lens: '#10202e', knit: '#ddd8cb', mask: '#2a5c9c' },
      { bronze: '#a87436', blue: '#2a64a8', linen: '#e4e0d4' }),
    parts: { helmet: 'paint', mask: 'fab', pouches: 'ar', patch: false, cape: true, holster: false },
    tone: [[1.0, 1.0, 1.0], [0.42, 0.42, 0.43]], art: ofArgoArt, model: ofArgoModel, cloth: ofArgoCloth, neon: 0,
  },
  cinder: {
    name: _t('Cinder'), role: _t('Walks through the fires of Scoria'), seed: 431, sym: 'X', challenge: true, map: 'scoria',
    camo: { style: 'poly', base: '#383431', soft: ['#3d3936', '#332f2c'], mid: ['#45403c', '#2a2725', '#4e4640'], n: [45, 40, 30], branch: ['#1e1c1a'], hi: '#6a5e54' },
    gear: ofkGear({ vest: '#2c2927', glove: '#232120', boot: '#2e2a28', belt: '#232120', mask: '#1e1d1c', knee: '#3a3532' },
      { metal: '#55504a', can: '#2e2a28', hood: '#2a2725', strap: '#2a2624', glowc: '#ff6418' }),
    parts: { mask: 'poly', glasses: false, carrier: false, patch: false, cape: true },
    tone: [[1.7, 1.68, 1.66], [0.52, 0.51, 0.51]], art: ofCinderArt, model: ofCinderModel, cloth: ofCinderCloth, tagHead: ofCinderTag, neon: 2.6,
  },
  stratos: {
    name: _t('Stratos'), role: _t('Rides the winds of Cirrus'), seed: 293, sym: 'L', challenge: true, map: 'cirrus',
    camo: { style: 'poly', base: '#6f93b8', soft: ['#779bc0', '#678baf'], mid: ['#8aaccc', '#5b7fa4', '#9ab8d4'], n: [30, 35, 30], branch: ['#4a6a8e'], hi: '#c6d8ea' },
    gear: ofkGear({ vest: '#5a7ea6', glove: '#4a2e1c', boot: '#3e2c1e', belt: '#3a2a1c', knee: '#8a6a4c', lens: '#3a6a8a', knit: '#5a3c26', mask: '#2a2a2a' },
      { leather: '#6a4228', knit2: '#3e2a1a', fleece: '#e6dcc4', scarf: '#f2efe6', strap: '#3a2a1c', rubber: '#2a2a2a' }),
    parts: { mask: 'poly', glasses: false, carrier: false, patch: false, cape: true },
    tone: [[1.12, 1.1, 1.08], [0.46, 0.45, 0.45]], art: ofStratosArt, model: ofStratosModel, cloth: ofStratosCloth, tagHead: ofStratosTag, neon: 0,
  },
  sandveil: {
    name: _t('Sandveil'), role: _t('Comes with the storms of Sirocco'), seed: 977, sym: 'L', challenge: true, map: 'sirocco',
    camo: { style: 'blot', base: '#c2a271', soft: ['#cbab7a', '#b6965f'], mid: ['#d8be8e', '#9c7b4b', '#e3cfa6'], branch: ['#7a5d3a', '#a8875a'], hi: '#f0e2c0' },
    gear: ofkGear({ vest: '#9c845e', pouch: '#a88f68', glove: '#7a6448', boot: '#a48a62', belt: '#6a5438', mask: '#7a4e24', knit: '#6a4420', knee: '#a48a62', lens: '#5a3a10' },
      { wrap: '#e2d6bc', wrap2: '#cbbb98', veil: '#7a4e24', glowc: '#ffc23a' }),
    parts: { mask: 'fab', glasses: false, pouches: 'ar', patch: false, cape: true },
    tone: [[1.0, 1.0, 1.0], [0.42, 0.42, 0.42]], art: ofSandArt, model: ofSandModel, cloth: ofSandCloth, tagHead: ofSandTag, neon: 1.8,
  },
  duskPatrol: {
    name: _t('Dusk Patrol'), role: _t('Night rounds in Bel-Horizon'), seed: 673, sym: 'X', challenge: true, map: 'belhorizon',
    camo: { style: 'poly', base: '#2a3038', soft: ['#2f353e', '#252b33'], mid: ['#353c46', '#1f242b', '#3b434e'], n: [40, 35, 25], branch: ['#161a20'], hi: '#525c6a' },
    gear: ofkGear({ vest: '#1e2329', pouch: '#262c34', glove: '#15181e', boot: '#1a1c22', belt: '#15181e', knee: '#262c34', lens: '#16181c', knit: '#1e2228', mask: '#22262c' },
      { cap: '#222830', brass: '#c49a40', glowc: '#ff7a5a', lamp: '#fff0c8', cape: '#a8483f' }),
    parts: { mask: 'fab', pouches: 'smg', patch: false, cape: true },
    tone: [[1.9, 1.9, 1.92], [0.5, 0.5, 0.52]], art: ofDuskArt, model: ofDuskModel, cloth: ofDuskCloth, tagHead: ofDuskTag, neon: 1.6,
  },
  jaguar: {
    name: _t('Jaguar'), role: _t('Stalks the rainforest of Selva'), seed: 619, sym: 'L', challenge: true, map: 'outpost',
    camo: { style: 'blot', base: '#66713f', soft: ['#6e7944', '#5c6738'], mid: ['#8a8550', '#46512c', '#9a9058'], branch: ['#2b2a1c', '#4a4128'], hi: '#b0a46a',
      slash: { col: ['#15160c', '#262412'], n: [140, 90], len: [0.07, 0.1], w: [0.012, 0.012], rot: 0.1 } },
    gear: ofkGear({ vest: '#4e5531', pouch: '#5c6339', glove: '#3a3d26', boot: '#4a4430', belt: '#3c3f26', knee: '#565c38', knit: '#7a7446' },
      { leather: '#4a3622', paint1: '#0e100a', paint2: '#2c3a18' }),
    parts: { glasses: false, pouches: 'ar', patch: false, cape: true },
    tone: [[1.28, 1.28, 1.22], [0.5, 0.5, 0.48]], art: ofJaguarArt, model: ofJaguarModel, cloth: ofJaguarCloth, tagHead: ofJaguarTag, neon: 0,
  },
});
/* In the order of the Outfits screen, under their own title (09u-outfits.js) */
const SKIN_MAP_OUT = ['duneRider', 'whiteout', 'corsair', 'briar', 'argonaut', 'cinder', 'stratos', 'sandveil', 'duskPatrol', 'jaguar'];
SKIN_CHALLENGE.push(...SKIN_MAP_OUT);
