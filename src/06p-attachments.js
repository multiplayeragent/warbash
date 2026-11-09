/* ==========================================================================
   ATTACHMENTS: catalog, effects on weapons, 3D models
   Eight technical slots (ATT_SLOTS) grouped into six attachment points (ATT_GROUPS: the muzzle and the barrel, the magazine and
   the ammunition share theirs), at most one attachment per point, and a weapon never carries more than ATT_MAX
   attachments (four, pistols included): on a rifle or a submachine gun (six points), each choice rules out another; a sniper
   rifle, a shotgun or a pistol (four points) can fill them all.
   An attachment modifies the weapon through factors (mods); weaponDef computes the resulting "derived" weapon, which all
   systems read like an ordinary weapon (controller, bots, network, menus):
     dmg, rng, rpm: damage, range and rate of fire | magx: magazine size (tubeAdd: extra shells in a tube magazine)
     reload: reload duration | ads: raise-to-aim time | zoom: magnification when aiming
     hip, adsAcc: spread from the hip, when aiming | vrec, hrec, kick: vertical, horizontal recoil, model recoil
     mob: speed | flash, shake: muzzle flash, view shake
     silent (suppressor), laser (pointer), bipod (bipod: recoil and spread reduced when crouched and still), slug (single slug)
   The level (lvl) is the one the weapon must reach to unlock the attachment (06r-arsenal.js).
   ========================================================================== */
const ATT_SLOTS = ['optic', 'muzzle', 'barrel', 'under', 'side', 'mag', 'stock', 'ammo'];
const ATT_SLOT_NAMES = { optic: _t('Optic'), muzzle: _t('Muzzle'), barrel: _t('Barrel'), under: _t('Underbarrel'), side: _t('Side rail'), mag: _t('Magazine'), stock: _t('Stock'), ammo: _t('Ammo') };
/* Attachment points offered to the player: at most one attachment per point (the models still read the technical slot of each attachment) */
const ATT_GROUP_SLOTS = { optic: ['optic'], canon: ['muzzle', 'barrel'], under: ['under'], side: ['side'], mun: ['mag', 'ammo'], stock: ['stock'] };
const ATT_GROUPS = Object.keys(ATT_GROUP_SLOTS);
const ATT_GROUP_NAMES = { optic: _t('Optic'), canon: _t('Muzzle and barrel'), under: _t('Underbarrel'), side: _t('Side rail'), mun: _t('Magazine and ammo'), stock: _t('Stock') };
const ATT_GROUP = {}; for (const g of ATT_GROUPS) for (const s of ATT_GROUP_SLOTS[g]) ATT_GROUP[s] = g;
const ATT_MAX = { primary: 4, secondary: 4 };
const ATT = {
  // optics: replace the metal sighting parts
  red: { slot: 'optic', name: _t('Red dot'), lvl: 2, fam: ['rifle', 'smg', 'shotgun', 'pistol'], mods: { ads: 1.03, zoom: 1.1, adsAcc: 0.95 },
    desc: _t('An illuminated dot on glass. Quick, clear sight picture.') },
  holo: { slot: 'optic', name: _t('Holographic'), lvl: 8, fam: ['rifle', 'smg', 'shotgun'], mods: { ads: 1.06, zoom: 1.2, adsAcc: 0.9 },
    desc: _t('Circle reticle in a large window. You keep both eyes open, but aiming is a little slower.') },
  acog: { slot: 'optic', name: 'ACOG 4x', lvl: 12, fam: ['rifle', 'smg'], mods: { ads: 1.16, zoom: 1.55, adsAcc: 0.85, mob: 0.98 },
    desc: _t('4x combat scope. More range and precision, at the cost of a narrower field of view and slower aiming.') },
  // muzzle
  sil: { slot: 'muzzle', name: _t('Suppressor'), lvl: 4, fam: ['rifle', 'smg', 'sniper', 'shotgun', 'pistol'], mods: { rng: 0.86, dmg: 0.97, vrec: 0.95, flash: 0.1, mob: 0.98, silent: true },
    desc: _t('Muffled shot, no flash or tracer. Range and damage slightly reduced.') },
  comp: { slot: 'muzzle', name: _t('Compensator'), lvl: 6, fam: ['rifle', 'smg', 'sniper', 'pistol'], mods: { vrec: 0.8, hrec: 1.08, ads: 1.04, flash: 0.9 },
    desc: _t('Upward-facing vents. The barrel climbs much less, but drifts a little more sideways.') },
  brake: { slot: 'muzzle', name: _t('Muzzle brake'), lvl: 14, fam: ['rifle', 'smg', 'sniper'], mods: { vrec: 0.9, hrec: 0.82, kick: 0.85, shake: 1.2, flash: 1.3 },
    desc: _t('Straighter recoil, but a wider flash and a shakier view.') },
  choke: { slot: 'muzzle', name: _t('Tight choke'), lvl: 4, fam: ['shotgun'], mods: { hip: 0.75, adsAcc: 0.75, rng: 1.12 },
    desc: _t('Tightens the spread. Pellets carry farther and scatter less.') },
  // canon
  long: { slot: 'barrel', name: _t('Long barrel'), lvl: 13, fam: ['rifle', 'smg'], mods: { rng: 1.2, adsAcc: 0.88, ads: 1.08, mob: 0.96 },
    desc: _t('More range and precision when aiming. The weapon is heavier to shoulder.') },
  short: { slot: 'barrel', name: _t('Short barrel'), lvl: 7, fam: ['rifle', 'smg'], mods: { rng: 0.82, ads: 0.88, mob: 1.04, hip: 0.9, vrec: 1.08 },
    desc: _t('A livelier, handier weapon. Less range and snappier recoil.') },
  // sous-canon
  vgrip: { slot: 'under', name: _t('Vertical grip'), lvl: 3, fam: ['rifle', 'smg'], mods: { vrec: 0.84, hrec: 0.9, ads: 1.05 },
    desc: _t('A good hold with the support hand. Recoil is tamed, but the weapon takes longer to aim.') },
  agrip: { slot: 'under', name: _t('Angled grip'), lvl: 9, fam: ['rifle', 'smg'], mods: { ads: 0.94, hip: 0.9, hrec: 0.9, vrec: 1.03 },
    desc: _t('Faster aiming and more accurate hip fire. Vertical recoil stays intact.') },
  bipod: { slot: 'under', name: _t('Bipod'), lvl: 3, fam: ['sniper', 'rifle'], mods: { ads: 1.05, mob: 0.97, bipod: true },
    desc: _t('Crouched and still, recoil and spread almost cancelled. Standing, the weapon is heavier.') },
  // side rail
  laser: { slot: 'side', name: _t('Laser sight'), lvl: 10, fam: ['rifle', 'smg', 'shotgun', 'pistol'], mods: { hip: 0.68, mob: 0.99, laser: true },
    desc: _t('A red dot marks the point of impact. Much more accurate hip fire.') },
  // magazine
  fmag: { slot: 'mag', name: _t('Fast mag'), lvl: 5, fam: ['rifle', 'smg', 'sniper', 'pistol'], mods: { reload: 0.72, mob: 0.99 },
    desc: _t('Magazine with an extraction strap. Reloading is a quarter shorter.') },
  xmag: { slot: 'mag', name: _t('Extended mag'), lvl: 11, fam: ['rifle', 'smg', 'sniper', 'shotgun', 'pistol'], mods: { magx: 1.5, tubeAdd: 2, reload: 1.12, mob: 0.97 },
    desc: _t('Half again as much ammo per magazine. Heavier and a little slower to swap.') },
  // crosse
  hstock: { slot: 'stock', name: _t('Reinforced stock'), lvl: 15, fam: ['rifle', 'smg', 'sniper'], mods: { vrec: 0.9, hrec: 0.88, adsAcc: 0.92, ads: 1.05, mob: 0.97 },
    desc: _t('Fully shouldered, the weapon holds its line of sight better. It is heavier to handle.') },
  nostock: { slot: 'stock', name: _t('No stock'), lvl: 17, fam: ['rifle', 'smg'], mods: { mob: 1.05, ads: 0.9, hip: 0.9, vrec: 1.12, hrec: 1.15, adsAcc: 1.15 },
    desc: _t('Compact and lively, but much harder to control.') },
  // ammunition
  hp: { slot: 'ammo', name: _t('Hollow point'), lvl: 16, fam: ['rifle', 'smg', 'pistol'], mods: { dmg: 1.12, rng: 0.82 },
    desc: _t('Expanding bullets. More damage, but effective range falls off.') },
  slug: { slot: 'ammo', name: _t('Slug'), lvl: 12, fam: ['shotgun'], mods: { slug: true },
    desc: _t('A single heavy slug instead of buckshot. Accurate and effective at medium range.') },
};
for (const id in ATT) ATT[id].id = id;
/* Name of an attachment on a given weapon (a shotgun's tube is not a magazine) */
function attName(id, def) { return id === 'xmag' && def && def.tube ? _t('Extended tube') : ATT[id].name; }
/* Does an attachment fit this weapon? (family and open slot) */
function attFits(base, id) {
  const a = ATT[id]; if (!a || !base.slots.includes(a.slot) || !a.fam.includes(base.fam)) return false;
  return !(base.noAtt && base.noAtt.includes(id));
}
function attMax(base) { return base.cat === 'pistol' ? ATT_MAX.secondary : ATT_MAX.primary; }
/* Attachment point (ATT_GROUPS) of an attachment, and those the weapon has */
const attGroup = (id) => ATT_GROUP[ATT[id].slot];
const attGroupsOf = (base) => ATT_GROUPS.filter((g) => ATT_GROUP_SLOTS[g].some((s) => base.slots.includes(s)));
/* Valid attachment set: those that fit the weapon, one per attachment point (the first listed wins), at most attMax */
function attNormalize(base, att) {
  const out = [], used = new Set();
  for (const id of att || []) {
    if (!attFits(base, id) || used.has(attGroup(id)) || out.length >= attMax(base)) continue;
    used.add(attGroup(id)); out.push(id);
  }
  return out.sort((x, y) => ATT_SLOTS.indexOf(ATT[x].slot) - ATT_SLOTS.indexOf(ATT[y].slot));
}

/* Effects of an attachment in plain language, for the menu: [{ t: text, good: better or worse }] */
const ATT_FX = {
  dmg: [_t('Damage'), 1], rng: [_t('Range'), 1], rpm: [_t('Rate of fire'), 1], magx: [_t('Magazine capacity'), 1], reload: [_t('Reload time'), -1], ads: [_t('Aim-down-sights time'), -1], zoom: [_t('Magnification'), 1],
  hip: [_t('Hip-fire spread'), -1], adsAcc: [_t('Aimed spread'), -1], vrec: [_t('Vertical recoil'), -1], hrec: [_t('Horizontal recoil'), -1], kick: [_t('Weapon kick'), -1],
  mob: [_t('Mobility'), 1], flash: [_t('Muzzle flash'), -1], shake: [_t('View shake'), -1],
};
const ATT_FLAGS = { silent: _t('Silent shot: bots only hear it from very close'), laser: _t('Laser dot visible when hip firing'), bipod: _t('Deployed (crouched, still), recoil and spread reduced'), slug: _t('A single heavy slug, no spread') };
function attEffects(id, def) {
  const out = [], m = ATT[id].mods;
  for (const k in m) {
    const v = m[k];
    if (ATT_FX[k] && typeof v === 'number') {
      if (k === 'magx' && def && def.tube) continue;
      const pct = Math.round((v - 1) * 100); if (!pct) continue;
      out.push({ t: `${ATT_FX[k][0]} ${pct > 0 ? '+' : '\u2212'}${Math.abs(pct)}${PCT}`, good: pct * ATT_FX[k][1] > 0 });
    } else if (k === 'tubeAdd' && def && def.tube) out.push({ t: _t('+{0} shells', v), good: true });
    else if (v === true && ATT_FLAGS[k]) out.push({ t: ATT_FLAGS[k], good: true });
  }
  return out;
}

/* ---------- Derived weapons ---------- */
const WDEFS = {};
/* Base weapon with its attachments and its camouflage: the bare weapon is WEAPONS[id] itself */
function weaponDef(id, att, camo) {
  const base = hasKey(WEAPONS, id) ? WEAPONS[id] : null; if (!base) return null;
  att = attNormalize(base, att); camo = camo && hasKey(CAMOS, camo) ? camo : null;
  if (!att.length && !camo) return base;
  const key = gunKey(base.model, att, camo);
  return WDEFS[key] || (WDEFS[key] = deriveDef(base, att, camo, key));
}
function weaponDefByKey(key) { const s = gunSpec(key); return weaponDef(s.model, s.att, s.camo); }
const _clamp01 = (v) => Math.max(0.04, Math.min(1, v));
function deriveDef(base, att, camo, key) {
  const m = { dmg: 1, rng: 1, rpm: 1, magx: 1, tubeAdd: 0, reload: 1, ads: 1, zoom: 1, hip: 1, adsAcc: 1, vrec: 1, hrec: 1, kick: 1, mob: 1, flash: 1, shake: 1 }, flags = {};
  for (const id of att) for (const k in ATT[id].mods) { const v = ATT[id].mods[k]; if (typeof v === 'boolean') flags[k] = v; else if (k === 'tubeAdd') m.tubeAdd += v; else m[k] *= v; }
  const d = Object.assign({}, base);
  d.base = base; d.key = key; d.att = att; d.camo = camo;
  d.dmg = base.dmg.map((v) => v * m.dmg); d.range = base.range.map((v) => v * m.rng); d.rpm = base.rpm * m.rpm;
  d.mag = base.tube ? base.mag + m.tubeAdd : Math.round(base.mag * m.magx);
  if (base.reload) { d.reload = base.reload * m.reload; d.reloadEmpty = base.reloadEmpty * m.reload; }
  d.spread = [base.spread[0] * m.hip, base.spread[1] * m.adsAcc];
  d.recoil = { v: base.recoil.v * m.vrec, h: base.recoil.h * m.hrec, kick: base.recoil.kick * m.kick, rot: base.recoil.rot * m.kick };
  d.adsTime = base.adsTime * m.ads; d.adsFov = Math.max(0.12, Math.min(1, base.adsFov / m.zoom)); d.move = base.move * m.mob;
  d.feel = Object.assign({}, base.feel, { flash: base.feel.flash * m.flash, shake: base.feel.shake * m.shake, smoke: base.feel.smoke * (flags.silent ? 0.4 : 1), spark: Math.round(base.feel.spark * m.flash) });
  if (flags.slug) {
    // single slug: one precise bullet that carries far, instead of the buckshot spray
    delete d.pellets; d.dmg = [86 * m.dmg, 46 * m.dmg]; d.range = [16 * m.rng, 52 * m.rng]; d.spread = [0.03 * m.hip, 0.004 * m.adsAcc]; d.head = 1.5; d.legs = 0.85;
  }
  if (flags.silent) { d.silent = true; d.loud = false; d.sound = base.sound + '_s'; }
  if (flags.laser) d.laser = true;
  if (flags.bipod) d.bipod = true;
  // menu bars: those of the bare weapon, corrected by the factors
  const S = base.stats, ex = (k, w) => (1 - m[k]) * w;
  d.stats = {
    dmg: _clamp01(S.dmg * m.dmg), rng: _clamp01(S.rng * m.rng), rof: _clamp01(S.rof * m.rpm),
    acc: _clamp01(S.acc * (1 + ex('vrec', 0.6) + ex('hrec', 0.3) + ex('adsAcc', 0.5) + ex('hip', 0.2))),
    mob: _clamp01(S.mob * m.mob * (1 + ex('ads', 0.4))),
  };
  d.mods = m; d.flags = flags;
  return d;
}

/* ---------- 3D models ---------- */
/* Mounting of the attachments on the built model (c: context of buildGunModel, see 06j-models.js) */
function attachAll(c) {
  const A = c.A;
  for (const slot of ['optic', 'muzzle', 'under', 'side', 'mag']) if (A[slot] && ATT_BUILD[A[slot]]) ATT_BUILD[A[slot]](c);
}
const ATT_BUILD = {};
/* Window of an optic: glass painted in transparency, rendered after the rest */
function optLens(p, M, x, y, z, w, h) { const l = rb(p, M.lens, x, y, z, w, h, 0.002, 0.0005); l.renderOrder = 5; return l; }
/* Flat glass with outline pts (x, y around its center), facing the eye (+z) or the front (front): a single face, invisible from the other
   side. Two glasses back to back give a lens that does not have the same tint seen from the front and from the back */
const OPT_GLASS = new Map();
function optGlass(p, mat, pts, x, y, z, front = false) {
  const k = JSON.stringify(pts);
  let geo = OPT_GLASS.get(k);
  if (!geo) { const sh = new THREE.Shape(); profTrace(sh, pts, 0.0012); geo = new THREE.ShapeGeometry(sh, 6); OPT_GLASS.set(k, geo); }
  const l = part(p, geo, mat, x, y, z, 1, 1, 1, 0, front ? Math.PI : 0, 0); l.renderOrder = 5; return l;
}
/* Reticle: luminous piece of the sight, kept out of the merging of pieces (bakeRig) */
function optReticle(c, mesh) { c.info.keep.push(mesh); return mesh; }
/* Flat single-piece reticle (a single draw call), facing the eye: invisible from the front, like the image of a real sight.
   marks: [flat geometry, x, y] around the center (0, y, z) */
function optMarks(c, p, marks, y, z, mat = c.M.dot) {
  const geo = mergeGunParts(marks.map(([gm, x, yy]) => ({ geo: gm, m: new THREE.Matrix4().makeTranslation(x, yy, 0) })));
  for (const [gm] of marks) gm.dispose();
  return optReticle(c, part(p, geo, mat, 0, y, z, 1, 1, 1));
}
/* Sets the sight: height of the sight line and position of the model relative to the eye (adsZ) */
function optSight(c, centerY, zRear, k = 1) { c.info.sightY = centerY; c.info.adsZ = c.info.mount.optic.D * k + zRear; }
const G_TRI = new THREE.CylinderGeometry(1, 1, 1, 3); // triangular prism: embossed arrows of the buttons

/* Red dot, from an open reflex sight (Hawke, owner's image). Low housing at the rear, below the sight line: brightness knob on
   the top right, + and - buttons on the left flank, emitter flush with the top, at the rear. Front hood in a rounded octagon around a
   coated lens, orange seen from the front and almost neutral seen from the back (optGlass). Base with rail clamp,
   tightening lever on the left; on the pistol, reduced to 75% and set on the slide by a simple plate. On the rifle, enlarged to 115% (when
   aiming, the window of a micro reflex looked tiny) and moved back 2 cm on the rail: 6.2 cm long, 3.9 cm wide, window of
   3.2 x 2.3 cm, sight line 2.9 cm from the rail (3.1 cm with the old tube). The dot covers 0.55% of the screen height when aiming
   (ironW; 0.85% up to 4.20.0, reduced to aim more finely at the owner's request); the eye stays where it was with the old model (adsZ) */
ATT_BUILD.red = (c) => {
  const { g, M, info } = c, o = info.mount.optic, p = o.slide || g, small = !!o.slide, s = small ? 0.75 : 1.15, y0 = o.y, S = M.sight, K = M.rubber;
  const z0 = small ? o.z : o.z + 0.02; // on the rifle, back on the rail: the window gets closer to the eye
  const hb = small ? 0.0015 : 0.0075, yB = y0 + hb - 0.0004; // base (plate or rail clamp), bottom of the housing
  const L = 0.054 * s, zR = z0 + L / 2, zF = z0 - L / 2, wb = 0.027 * s, dH = 0.012 * s; // housing, depth of the hood
  const a = 0.014 * s, h = 0.02 * s, t = 0.003 * s, ch = 0.0035 * s; // window (half-width, height, chamfer), thickness of the hood
  const yb = yB + 0.0094 * s, yc = yb + h * 0.47, ym = yb + h * 0.62, A = a + t; // bottom of the window (top of the housing), sight line
  // hood: rounded octagon, flanks tucked in toward the bottom, wide chamfers at the top; solid below the window down to the base
  const win = [[-a * 0.88 + ch, yb], [a * 0.88 - ch, yb], [a * 0.9, yb + ch], [a, ym], [a - ch * 1.8, yb + h], [-a + ch * 1.8, yb + h], [-a, ym], [-a * 0.9, yb + ch]];
  const hood = [[-A * 0.9, yB, 0.001 * s], [A * 0.9, yB, 0.001 * s], [A, ym + t * 0.45], [A - ch * 1.8 + t * 0.45, yb + h + t], [-A + ch * 1.8 - t * 0.45, yb + h + t], [-A, ym + t * 0.45]];
  zSection(p, S, hood, zF, zF + dH, 0.0008 * s, { holes: [win], rc: 0.0013 * s, seg: 5, bev: 2 });
  const yw = yb + h / 2, zL = zF + dH * 0.55, lens = win.map(([x, y]) => [x * (1 + 0.0007 / a), (y - yw) * (1 + 0.0014 / h)]);
  optGlass(p, M.lens, lens, 0, yw, zL); optGlass(p, M.lensR, lens, 0, yw, zL - 0.0004, true);
  // housing: from the hood to the rounded rear, its top flush with the bottom of the window
  prof(p, S, [[zF + 0.003 * s, yB, 0], [zF + 0.003 * s, yb - 0.0003, 0], [zR, yb - 0.0003, 0.0045 * s], [zR, yB, 0.0012 * s]], wb, 0, 0.0014 * s, 0.001 * s);
  rb(p, S, 0, yb + 0.0008 * s, zR - 0.0065 * s, 0.0062 * s, 0.0024 * s, 0.005 * s, 0.0009 * s); // emitter
  bx(p, K, 0, yb + 0.001 * s, zR - 0.009 * s, 0.0036 * s, 0.0012 * s, 0.001 * s); // its window, facing the lens
  const xd = 0.0062 * s, zd = zR - 0.019 * s; // brightness knob: knurled ring, cap, screw
  cy(p, M.metal, xd, yb + 0.0006 * s, zd, 0.0058 * s, 0.0016 * s, 0); cy(p, S, xd, yb + 0.0016 * s, zd, 0.0049 * s, 0.0012 * s, 0); cy(p, K, xd, yb + 0.0023 * s, zd, 0.0014 * s, 0.0004 * s, 0);
  // + (front) and - buttons on the left flank, in an oval plate
  const yk = yB + 0.0047 * s, xk = -wb / 2;
  rb(p, S, xk, yk, zR - 0.025 * s, 0.0014 * s, 0.0058 * s, 0.017 * s, 0.0006 * s);
  for (const [dz, plus] of [[0.0295, true], [0.0205, false]]) {
    cy(p, K, xk - 0.0007 * s, yk, zR - dz * s, 0.0021 * s, 0.0012 * s, 0, 0, Math.PI / 2);
    bx(p, M.metal, xk - 0.0013 * s, yk, zR - dz * s, 0.0003, 0.0004 * s, 0.0022 * s);
    if (plus) bx(p, M.metal, xk - 0.0013 * s, yk, zR - dz * s, 0.0003, 0.0022 * s, 0.0004 * s);
  }
  if (small) rb(p, S, 0, y0 + hb / 2 - 0.0002, z0, wb, hb + 0.0004, L - 0.004, 0.0005); // plate on the slide
  else {
    // base with clamp: jaws on either side of the rail, tightening lever on the left and its screw, screw end on the right
    const bw = wb + 0.002;
    rb(p, S, 0, y0 + hb / 2 - 0.0002, z0 + 0.003, bw, hb, L * 0.82, 0.0012);
    for (const sx of [-1, 1]) rb(p, S, sx * 0.0137, y0 - 0.0012, z0 + 0.003, 0.0034, 0.0075, L * 0.5, 0.0008);
    rb(p, M.metal, -bw / 2 - 0.0007, y0 + 0.0002, z0 + 0.003, 0.0016, 0.0082, 0.026, 0.0007);
    cy(p, M.metal, -bw / 2 - 0.0018, y0 + 0.001, z0 + 0.012, 0.0023, 0.0012, 0, 0, Math.PI / 2);
    cy(p, M.metal, bw / 2 + 0.0005, y0 - 0.001, z0 + 0.003, 0.0022, 0.0012, 0, 0, Math.PI / 2);
  }
  optSight(c, yc, o.z + (small ? 0.016 : 0.0325));
  const zD = zL + 0.0005;
  info.dot = optMarks(c, p, [[new THREE.CircleGeometry(ironW(c, zD, 0.0055) / 2, 20), 0, 0]], yc, zD);
};
/* Holographic, from an EOTech 552 (owner's images). Base with rail clamp (tightening knob on the left); low housing along the whole
   length, housing the battery at the front; hood with solid flanks at the rear, sloping front, bridge on top; rear face pierced by the
   window (3.4 x 2.5 cm), the glass recessed 9 mm in a frame; control panel under the window (two arrow buttons, round button,
   four screws); elevation and windage adjustments in two cups on the right flank. 10 cm long, 4.6 cm wide, 5.3 cm above the rail,
   sight line at 3.4 cm. Single-piece reticle (ring with four strokes and a dot), sized as a fraction of the screen when aiming (ironW):
   ring of 3%, stroke of 0.3%, dot of 0.4% (a 7% ring covered too much screen and its dot could no longer be seen; 4%, 0.35% and 0.65%
   up to 4.20.0, reduced to aim more finely at the owner's request). The eye stays where it
   was with the old model (adsZ): the window, closer to it, looks larger */
ATT_BUILD.holo = (c) => {
  const { g, M, info } = c, o = info.mount.optic, p = o.slide || g, y0 = o.y, z0 = o.z, S = M.sight, K = M.rubber;
  const W = 0.046, hw = W / 2, zR = z0 + 0.048, zF = zR - 0.1, zH = zR - 0.058, zc = (zR + zF) / 2; // width, rear, front, front of the hood
  const yc = y0 + 0.034, yT = y0 + 0.0525, yB = y0 + 0.0195, ww = 0.034, wh = 0.025; // sight line, top of the hood and housing, window
  const win = (w, h, r) => [[-w / 2, yc - h / 2, r], [w / 2, yc - h / 2, r], [w / 2, yc + h / 2, r], [-w / 2, yc + h / 2, r]];
  // base and rail clamp: jaws on either side of the rail, tightening knob on the left, screw end on the right
  rb(p, S, 0, y0 + 0.003, zc, 0.032, 0.006, 0.094, 0.0015);
  for (const sx of [-1, 1]) rb(p, S, sx * 0.0137, y0 - 0.0012, zc + 0.006, 0.0034, 0.0075, 0.034, 0.0008);
  cy(p, M.metal, -0.0182, y0 - 0.0008, zc + 0.006, 0.0058, 0.0056, 0, 0, Math.PI / 2);
  cy(p, M.metal, 0.0158, y0 - 0.0008, zc + 0.006, 0.0026, 0.0014, 0, 0, Math.PI / 2);
  // low housing, from the rear face to the rounded front (battery housing), its top under the window; screws on the flanks
  prof(p, S, [[zF, y0 + 0.005, 0], [zF, yB, 0.007], [zR - 0.004, yB, 0.001], [zR - 0.004, y0 + 0.005, 0]], W - 0.001, 0, 0.0015, 0.002);
  rb(p, S, 0, y0 + 0.011, zF - 0.0005, W - 0.012, 0.008, 0.0016, 0.0012); // battery cover
  for (const sx of [-1, 1]) for (const z of [zR - 0.012, zF + 0.012]) cy(p, M.metal, sx * (hw - 0.0004), y0 + 0.0105, z, 0.0016, 0.001, 0, 0, Math.PI / 2);
  // hood: solid flanks with a sloping front that rounds off toward the top (chamfers with small roundings: the lightweight version, in bevels, keeps the same
  // outline); bridge on top, with the same outline as the flanks (their top, over 4.5 mm)
  const side = [[zH - 0.012, yB - 0.001, 0.002], [zH - 0.002, yT - 0.012, 0.004], [zH + 0.006, yT - 0.0025, 0.004], [zH + 0.016, yT, 0.004], [zR - 0.004, yT, 0.002], [zR - 0.004, yB - 0.001, 0]];
  for (const sx of [-1, 1]) prof(p, S, side, 0.004, sx * (hw - 0.002), 0.0012, 0.002);
  prof(p, S, profAbove(side, 0.002, yT - 0.0045), W - 0.006, 0, 0.0012, 0);
  // rear face: frame pierced by the window, very rounded top corners; glass recessed in its frame
  zSection(p, S, [[-hw - 0.0008, y0 + 0.0045, 0.0015], [hw + 0.0008, y0 + 0.0045, 0.0015], [hw + 0.0008, yT + 0.0008, 0.009], [-hw - 0.0008, yT + 0.0008, 0.009]], zR - 0.0055, zR + 0.001, 0.0012, { holes: [win(ww, wh, 0.0035)], seg: 6, bev: 2 });
  const zG = zR - 0.009;
  zSection(p, S, win(ww + 0.003, wh + 0.003, 0.004), zG - 0.0016, zR - 0.005, 0.0006, { holes: [win(ww - 0.003, wh - 0.003, 0.0025)], seg: 6 });
  optLens(p, M, 0, yc, zG, ww - 0.001, wh - 0.001);
  // control panel under the window: arrow buttons (bottom left, top right), round button, four screws
  const yp = y0 + 0.0135, zp = zR + 0.001;
  rb(p, S, 0, yp, zp + 0.0009, 0.036, 0.013, 0.0022, 0.001);
  for (const sx of [-1, 1]) {
    rb(p, K, sx * 0.0088, yp - 0.0016, zp + 0.0024, 0.0088, 0.0062, 0.0018, 0.0008);
    part(p, G_TRI, K, sx * 0.0088, yp - 0.0016, zp + 0.0034, 0.0019, 0.0008, 0.0019, Math.PI / 2, sx > 0 ? Math.PI : 0, 0);
    for (const dy of [-0.0045, 0.0045]) cy(p, M.metal, sx * 0.0155, yp + dy, zp + 0.0022, 0.0012, 0.0009);
  }
  cy(p, K, 0, yp + 0.0035, zp + 0.0024, 0.0026, 0.0018);
  // elevation and windage adjustments: two cups on the right flank, slotted screw at the bottom
  for (const [dz, ang] of [[0.017, 0.5], [0.034, -0.4]]) {
    const z = zR - dz, y = yc - 0.002;
    part(p, G_TOR, S, hw, y, z, 0.0052, 0.0052, 0.0052, 0, Math.PI / 2, 0);
    cy(p, K, hw - 0.0002, y, z, 0.0047, 0.001, 0, 0, Math.PI / 2);
    cy(p, M.metal, hw + 0.0002, y, z, 0.0028, 0.001, 0, 0, Math.PI / 2);
    bx(p, K, hw + 0.0007, y, z, 0.0004, 0.0048, 0.0007, ang, 0, 0);
  }
  optSight(c, yc, z0 + 0.025, 0.97);
  const zr = zG + 0.0013, f = (k) => ironW(c, zr, k), R = f(0.03) / 2, lw = f(0.003), tk = f(0.008), d = R - lw * 1.5 + tk / 2;
  const tick = (w, h, x, y) => [new THREE.PlaneGeometry(w, h), x, y];
  info.dot = optMarks(c, p, [[new THREE.RingGeometry(R - lw, R, 64), 0, 0], [new THREE.CircleGeometry(f(0.004) / 2, 16), 0, 0],
    tick(lw, tk, 0, d), tick(lw, tk, 0, -d), tick(tk, lw, d, 0), tick(tk, lw, -d, 0)], yc, zr);
};
/* ACOG 4x, from an ACOG TA31 on its base (owner's images). Dimensions taken from the 512 px side view (P: x, y of the photo,
   0.607 mm per pixel, optical axis at y = 148, the objective on the left). Front to back: round objective hood, beveled front face (the
   top forward, zRing and o.cut), front sight on top, lens recessed at the bottom of the hood; body tapering to the tube; elevation
   turret on top, windage cap on the right; eyepiece collar and its two screws; eyepiece, rubber eyecup and small
   rear sight blade; base with riser, two tightening knobs on the left. 14.7 cm long, axis 3.7 cm from the rail.
   When aiming, you are right up against the eyepiece as in the second image: the weapon view narrows (info.vmFov, vmFovAt) until the
   eyecup fills the screen height, the lens about 75%. The eyepiece disc only writes depth and is drawn before
   the rest of the weapon (info.ocular, when aiming only): nothing of the weapon is drawn behind it, you see the world there, tinted cyan and
   darkened at the edge. TA31 reticle: red chevron, black drop line underneath, black horizontal strokes at the edge of the field,
   sized as a fraction of the screen when aiming. The eye stays where it was with the old model (adsZ) */
ATT_BUILD.acog = (c) => {
  const { g, M, info } = c, o = info.mount.optic, p = o.slide || g, y0 = o.y, z0 = o.z, S = M.sight, K = M.rubber, k = 0.000607;
  const yA = y0 + 0.0367; // optical axis
  const P = (x, y, r) => { const q = [z0 + (x - 262.5) * k, yA - (y - 148) * k]; if (r !== undefined) q.push(r); return q; };
  const Pz = (x) => z0 + (x - 262.5) * k, Py = (y) => yA - (y - 148) * k, len = (a, b) => Math.abs(b - a) * k;
  // base: sole (jaws on either side of the rail), riser sloping forward under the body, slotted knobs on the left
  prof(p, S, [P(128.3, 193.3, 0.002), P(285, 193.3, 0.002), P(285, 211.7, 0.001), P(128.3, 211.7, 0.001)], 0.032, 0, 0.0015, 0.002);
  for (const sx of [-1, 1]) rb(p, S, sx * 0.0137, y0 - 0.0045, Pz(206), 0.0034, 0.006, len(140, 275), 0.0008);
  prof(p, S, [P(168.3, 193.6, 0), P(190, 186.5, 0.002), P(208.3, 179.5, 0.003), P(271.7, 173, 0.002), P(272, 172, 0.001), P(291.7, 172, 0.002), P(291.7, 193.6, 0)], 0.022, 0, 0.0015, 0.002);
  for (const x of [151.7, 261.7]) {
    cy(p, M.metal, -0.0185, Py(203.3), Pz(x), 0.006, 0.005, 0, 0, Math.PI / 2);
    bx(p, K, -0.0211, Py(203.3), Pz(x), 0.0006, 0.0085, 0.0013);
    cy(p, M.metal, 0.0165, Py(203.3), Pz(x), 0.0032, 0.0012, 0, 0, Math.PI / 2);
  }
  // round objective hood, beveled front face (the top forward); at the bottom, bulkhead, ring and lens (seen from the front); front sight on top
  const RB = 0.0205;
  zRing(p, S, RB, 0.0176, Pz(139.5), Pz(205), yA, { rr: 0.0012, seg: 48, cut: [yA + RB, Pz(139.5), yA - RB, Pz(168.3)] });
  cy(p, S, 0, yA, Pz(201), 0.0178, len(196, 206));
  zRing(p, S, 0.0178, 0.0158, Pz(193.5), Pz(196.5), yA);
  part(p, new THREE.CircleGeometry(0.0162, 32), M.glass, 0, yA, Pz(195.5), 1, 1, 1, 0, Math.PI, 0);
  prof(p, S, [P(147, 116), P(147, 96, 0.001), P(150, 93.3, 0.001), P(160, 93.3, 0.001), P(163.3, 96, 0.001), P(163.3, 116)], 0.004, 0, 0.0008, 0.001); // front sight
  // tapered body, tube; elevation turret (top), windage cap (right), flat cap (left)
  cone(p, S, 0, yA, (Pz(203) + Pz(271.7)) / 2, 0.0198, 0.0154, len(203, 271.7), 32);
  cy(p, S, 0, yA, (Pz(271) + Pz(316)) / 2, 0.0154, len(271, 316));
  cy(p, S, 0, yA + 0.0165, Pz(284), 0.0095, 0.005, 0); cy(p, S, 0, Py(115), Pz(284), 0.0086, 0.01, 0); cy(p, K, 0, Py(112.5), Pz(284), 0.0088, 0.0012, 0);
  cy(p, S, 0.0165, yA, Pz(285), 0.0075, 0.005, 0, 0, Math.PI / 2); cy(p, S, 0.0215, yA, Pz(285), 0.0062, 0.008, 0, 0, Math.PI / 2);
  cy(p, S, -0.0158, yA - 0.0005, Pz(285), 0.006, 0.004, 0, 0, Math.PI / 2);
  // eyepiece collar: ring, snap ring, two screws in their lugs (top, bottom), boss on the right
  cy(p, S, 0, yA, (Pz(315) + Pz(345)) / 2, 0.0172, len(315, 345)); cy(p, M.metal, 0, yA, Pz(333), 0.0185, 0.003);
  for (const sy of [1, -1]) { rb(p, S, 0, yA + sy * 0.0176, Pz(326), 0.008, 0.0045, len(315, 337), 0.0012); cz(p, M.metal, 0, yA + sy * 0.0186, Pz(328.5), 0.0022, len(315, 342)); }
  cy(p, M.metal, 0.0188, yA, Pz(347), 0.003, 0.004, 0, 0, Math.PI / 2);
  // eyepiece, rubber eyecup (the lens recessed 9 mm), rear sight blade on top
  cy(p, S, 0, yA, (Pz(344) + Pz(369)) / 2, 0.017, len(344, 369));
  zRing(p, K, 0.0172, 0.0136, Pz(368), Pz(383.3), yA, { rr: 0.0018, seg: 48 });
  prof(p, S, [P(362, 121), P(362, 103, 0.001), P(366, 95, 0.001), P(369.5, 95, 0.001), P(373.3, 103, 0.001), P(373.3, 121)], 0.0022, 0, 0.0006, 0.001);
  optSight(c, yA, z0 + 0.073, 0.72);
  // field of the weapon view when aiming: the eyecup (radius 17.2 mm) fills the screen height
  const tanH = 0.0175 / (info.adsZ - Pz(383.3));
  info.vmFov = Math.atan(tanH) * 360 / Math.PI;
  // eyepiece: depth mask (before everything else of the weapon), tint, darkened edge, reticle; H: screen height at its distance
  const zl = Pz(369) + 0.0005, rl = 0.0137, H = 2 * tanH * (info.adsZ - zl), f = (q) => q * H;
  const mask = optReticle(c, part(p, new THREE.CircleGeometry(rl, 32), M.ocMask, 0, yA, zl, 1, 1, 1)); mask.renderOrder = -10; mask.visible = false; info.ocular = mask;
  optReticle(c, part(p, new THREE.CircleGeometry(rl, 32), M.ocTint, 0, yA, zl + 0.0002, 1, 1, 1)).renderOrder = 5;
  optMarks(c, p, Array.from({ length: 12 }, (_, i) => [new THREE.RingGeometry(rl * (0.64 + i * 0.03), rl, 48), 0, 0]), yA, zl + 0.0003, M.ocShade).renderOrder = 6;
  // red chevron: tip on the sight line, two arms; drop line and edge strokes in black
  const ch = f(0.05), cw = f(0.036), t = f(0.005), al = hyp(cw / 2, ch), ang = Math.atan2(cw / 2, ch);
  const arm = (s) => { const gm = new THREE.PlaneGeometry(t, al); gm.rotateZ(s * ang); return [gm, s * cw / 4, -ch / 2]; };
  info.dot = optMarks(c, p, [arm(1), arm(-1)], yA, zl + 0.0004);
  const lw = f(0.0035), bl = f(0.15), el = rl * 0.18;
  optMarks(c, p, [[new THREE.PlaneGeometry(lw, bl), 0, -ch * 1.08 - bl / 2], [new THREE.PlaneGeometry(el, lw), rl - el / 2, 0], [new THREE.PlaneGeometry(el, lw), -rl + el / 2, 0]], yA, zl + 0.0004, M.ink);
};

/* Muzzle devices: placed at the end of the barrel (info.mount.muzzle), the flash emission point moves back by the same amount */
const SIL_LEN = { rifle: 0.17, smg: 0.16, sniper: 0.21, shotgun: 0.18, pistol: 0.115 };
ATT_BUILD.sil = (c) => {
  const { g, M, info } = c, mz = info.mount.muzzle, len = SIL_LEN[info.kind], r = Math.max(mz.r * 1.9, info.kind === 'pistol' ? 0.0125 : 0.0185);
  cy(g, M.dark, 0, mz.y, mz.z - len / 2 + 0.01, r, len);
  cy(g, M.metal, 0, mz.y, mz.z + 0.004, r * 0.92, 0.014);
  cy(g, M.metal, 0, mz.y, mz.z - len + 0.012, r * 0.96, 0.008);
  for (let i = 1; i < 4; i++) part(g, G_TOR, M.metal, 0, mz.y, mz.z - len * i / 4, r * 1.02, r * 1.02, r * 0.35);
  info.muzzle.position.z = mz.z - len - 0.008;
};
ATT_BUILD.comp = (c) => {
  const { g, M, info } = c, mz = info.mount.muzzle, r = Math.max(mz.r * 1.55, 0.0125), len = info.kind === 'pistol' ? 0.034 : 0.052;
  cy(g, M.metal, 0, mz.y, mz.z - len / 2 + 0.004, r, len);
  cy(g, M.dark, 0, mz.y, mz.z - len + 0.004, r * 0.7, 0.004);
  for (let i = 0; i < 3; i++) bx(g, M.dark, 0, mz.y + r * 0.96, mz.z - 0.01 - i * len / 4, r * 0.9, 0.003, len / 8);
  for (let i = 0; i < 2; i++) for (const sx of [-1, 1]) bx(g, M.dark, sx * r * 0.98, mz.y + r * 0.2, mz.z - 0.014 - i * len / 3, 0.003, r * 0.55, len / 9);
  info.muzzle.position.z = mz.z - len - 0.006;
};
ATT_BUILD.brake = (c) => {
  const { g, M, info } = c, mz = info.mount.muzzle, r = Math.max(mz.r * 1.9, 0.016), len = info.kind === 'sniper' ? 0.085 : 0.064;
  cy(g, M.dark, 0, mz.y, mz.z - len / 2 + 0.004, r, len);
  for (let i = 0; i < 3; i++) cy(g, M.metal, 0, mz.y, mz.z - 0.012 - i * (len - 0.02) / 3, r * 1.18, 0.004);
  for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) bx(g, M.poly, sx * r * 0.99, mz.y, mz.z - 0.022 - i * (len - 0.03) / 2, 0.003, r * 0.9, 0.012);
  info.muzzle.position.z = mz.z - len - 0.008;
};
ATT_BUILD.choke = (c) => {
  const { g, M, info } = c, mz = info.mount.muzzle, r = mz.r * 1.32, len = 0.05;
  cy(g, M.dark, 0, mz.y, mz.z - len / 2 + 0.005, r, len);
  for (let i = 0; i < 3; i++) part(g, G_TOR, M.metal, 0, mz.y, mz.z - 0.008 - i * 0.015, r * 1.02, r * 1.02, r * 0.3);
  cy(g, M.metal, 0, mz.y, mz.z - len + 0.007, r * 0.78, 0.004);
  info.muzzle.position.z = mz.z - len - 0.006;
};

/* Underbarrel: support grip (grip shape shape, added to those of the handguard: the fingers close on both).
   Vertical grip: the hand grabs it (frame Lv, grip point at the center of the grip). Angled grip: the hand stays under
   the handguard (frame L), just behind the ramp, the hollow between thumb and index finger against it, the way a real angled
   grip is held (see lHandFrame) */
function underGrip(c, shape, frame) {
  const { info } = c;
  info.gripDef.L = info.gripDef.L.concat([shape]);
  if (frame) { info.gripL.set(...shape.c); info.lFrame = frame; }
}
ATT_BUILD.vgrip = (c) => {
  const { g, M, info } = c, u = info.mount.under;
  rb(g, M.dark, 0, u.y - 0.006, u.z, 0.032, 0.012, 0.046, 0.003);
  rb(g, M.poly, 0, u.y - 0.047, u.z, 0.024, 0.075, 0.028, 0.009);
  for (let i = 0; i < 3; i++) rb(g, M.dark, 0, u.y - 0.034 - i * 0.016, u.z - 0.0138, 0.02, 0.006, 0.003, 0.001);
  rb(g, M.dark, 0, u.y - 0.088, u.z, 0.028, 0.006, 0.032, 0.003);
  underGrip(c, { c: [0, u.y - 0.047, u.z], h: [0.012, 0.0375, 0.014], r: 0.009 }, 'Lv');
};
ATT_BUILD.agrip = (c) => {
  // angled grip: short shaft tilted backward (the bottom toward the shooter, AGRIP_RAKE), tapered, finger grooves on the front,
  // rounded, slightly flared heel, on a rail clamp; the hand grabs it (frame La)
  const { g, M, info } = c, u = info.mount.under, A = AGRIP_RAKE, L = 0.066, y0 = u.y - 0.011;
  const d = [Math.sin(A), -Math.cos(A)], p = [Math.cos(A), Math.sin(A)]; // along the shaft (downward), across (backward)
  const at = (t, k) => [u.z + d[0] * t + p[0] * k, y0 + d[1] * t + p[1] * k];
  const hw = (t) => 0.0155 - 0.003 * t / L;
  rb(g, M.dark, 0, u.y - 0.006, u.z, 0.032, 0.012, 0.056, 0.003);
  const front = [-0.004, 0.012, 0.02, 0.028, 0.036, 0.044, 0.052].map((t, i) => [...at(t, -hw(t) + (i > 1 && i % 2 === 0 ? 0.0022 : 0)), i > 1 ? 0.006 : 0.004]);
  const pts = [...front, [...at(L, -hw(L) - 0.002), 0.008], [...at(L + 0.004, 0), 0.01], [...at(L, hw(L) + 0.002), 0.008], [...at(-0.004, hw(0)), 0.004]];
  prof(g, M.poly, pts, 0.027, 0, 0.005, 0.004);
  rb(g, M.dark, 0, ...[at(L + 0.001, 0)[1], at(L + 0.001, 0)[0]], 0.028, 0.008, 0.03, 0.003, -A); // sole of the heel
  const ce = at(L * 0.5, 0);
  underGrip(c, { c: [0, ce[1], ce[0]], h: [0.0135, L / 2 + 0.004, 0.015], r: 0.009, rx: -A }, 'La');
};
ATT_BUILD.bipod = (c) => {
  const { g, M, info } = c, u = info.mount.under, y = u.y - 0.003;
  rb(g, M.metal, 0, y - 0.004, u.z, 0.04, 0.012, 0.034, 0.003);
  // lugs folded forward, along the underside
  for (const sx of [-1, 1]) {
    rb(g, M.dark, sx * 0.014, y - 0.014, u.z - 0.05, 0.007, 0.01, 0.13, 0.002);
    cy(g, M.metal, sx * 0.014, y - 0.011, u.z + 0.012, 0.0055, 0.014, 0, 0, Math.PI / 2);
    rb(g, M.rubber, sx * 0.014, y - 0.014, u.z - 0.119, 0.008, 0.011, 0.012, 0.003);
  }
  // the fingers of the support hand stop on the base and the folded lugs
  if (info.gripDef) info.gripDef.L = info.gripDef.L.concat([{ c: [0, y - 0.01, u.z - 0.045], h: [0.02, 0.01, 0.083], r: 0.003 }]);
};

/* Laser pointer: housing on the left flank (or under the frame of a pistol) and emitter; info.laser keeps the
   point where the beam starts for the red dot displayed on the scenery (see laserUpdate) */
ATT_BUILD.laser = (c) => {
  const { g, M, info } = c, s = info.mount.side;
  if (s.under) {
    rb(g, M.dark, 0, s.y - 0.011, s.z, 0.016, 0.018, 0.038, 0.002);
    optReticle(c, cz(g, M.dot, 0, s.y - 0.011, s.z - 0.0205, 0.003, 0.003));
    info.laser = new V3(0, s.y - 0.011, s.z - 0.024);
    return;
  }
  const x = s.x - 0.0095;
  rb(g, M.metal, s.x - 0.002, s.y, s.z, 0.008, 0.008, 0.022, 0.0015); // clamp on the rail
  rb(g, M.dark, x, s.y, s.z - 0.004, 0.011, 0.022, 0.048, 0.0025); // housing
  rb(g, M.metal, x - 0.0062, s.y + 0.004, s.z - 0.004, 0.0016, 0.006, 0.01, 0.0006); // adjustment knob
  optReticle(c, cz(g, M.dot, x, s.y + 0.003, s.z - 0.0295, 0.003, 0.003));
  info.laser = new V3(x, s.y + 0.003, s.z - 0.032);
};

/* Magazines: the extended magazine is lengthened (buildMag receives info.magExt); the fast one carries a pull tab */
ATT_BUILD.xmag = (c) => { c.info.magExt = c.info.tubeFed ? 1 : 1.35; };
ATT_BUILD.fmag = (c) => {
  const { M, info } = c, raw = info.buildMag;
  if (!raw) return;
  info.buildMag = (parent, ext) => {
    raw(parent, ext);
    // the lowest piece (base plate) carries the pull tab and the color band
    const b = new THREE.Box3().setFromObject(parent), w = b.max.x - b.min.x; let low = null;
    parent.traverse((o) => { if (o.isMesh) { const bb = new THREE.Box3().setFromObject(o); if (!low || bb.min.y < low.min.y) low = bb; } });
    rb(parent, M.dotW, 0, low.min.y + 0.002, low.max.z - 0.006, Math.min(0.02, w * 0.8), 0.014, 0.006, 0.001);
    rb(parent, M.dark, 0, low.min.y + 0.026, (low.min.z + low.max.z) / 2, w + 0.002, 0.006, (low.max.z - low.min.z) - 0.006, 0.001);
  };
};

/* ---------- Laser pointer dot ----------
   A red dot placed on what the player aims at from the hip (the line of fire starts from the center of the screen); it disappears when aiming,
   sprinting, or when the weapon has no laser. A single sprite, created on first use, never destroyed. */
const LASER = { dot: null, k: 0 };
function laserUpdate(on, dt) {
  if (!LASER.dot) {
    if (!on) return;
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.9)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    LASER.dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color: new THREE.Color().setRGB(5, 0.25, 0.15), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    LASER.dot.visible = false; LASER.dot.renderOrder = 8; LASER.dot.userData.noPrepass = true; scene.add(LASER.dot);
  }
  LASER.k = damp(LASER.k, on ? 1 : 0, 18, dt);
  if (!on) { LASER.dot.visible = LASER.k > 0.03; if (!LASER.dot.visible) return; }
  const f = camFwd(_v1), h = rayWorld(camera.position.x, camera.position.y, camera.position.z, f.x, f.y, f.z, 90);
  if (!h) { LASER.dot.visible = false; return; }
  LASER.dot.position.set(camera.position.x + f.x * (h.t - 0.02), camera.position.y + f.y * (h.t - 0.02), camera.position.z + f.z * (h.t - 0.02));
  const s = (0.012 + h.t * 0.0045) * LASER.k; LASER.dot.scale.set(s, s, s); LASER.dot.visible = true;
}
