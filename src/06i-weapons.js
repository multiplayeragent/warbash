/* ==========================================================================
   WEAPONS: catalog (stats, feel, preset classes)
   Each weapon has an identifier (key of WEAPONS), a 3D model (model: key of GUN_MODELS, see 06j-models.js) and a
   family (fam: rifle, smg, sniper, shotgun, pistol) that sets what they all share: hand grips, hip
   position, reload and inspect choreographies.
   Fields:
     cat: menu category (ar, smg, sniper, shotgun, pistol) | sound: sound profile from GUNSND (05-audio.js)
     rpm, auto, bolt (manual bolt), pump (pump action), tube (cartridge-by-cartridge reload), pellets, scope (full-screen scope)
     dmg [near, far], range [start of falloff, end], head, legs: zone multipliers | spread [hip, aim]
     recoil { v, h, kick, rot } | pattern: recoil pattern (climb: rises then drifts, smg: bouncy, rand) | adsTime, adsFov (field of
     view when aiming, smaller = more zoom), move (speed) | stats: menu bars (0 to 1)
     slots: attachment slots open to the weapon | ai: bot settings (ideal: desired combat distance, aggr: aggressiveness,
     sniper, shotgun, rush: roles) | loud: the shot is heard from afar (bots react to it)
   A weapon equipped with attachments is a "derived" weapon (weaponDef, 06r-arsenal.js): same fields, modified values.
   ========================================================================== */
const WEAPON_CATS = [
  { id: 'ar', name: _t('Assault rifles') }, { id: 'smg', name: _t('Submachine guns') }, { id: 'sniper', name: _t('Sniper rifles') },
  { id: 'shotgun', name: _t('Shotguns') }, { id: 'pistol', name: _t('Pistols') },
];
/* Attachment slots per family (a weapon may open fewer: slots field) */
const SLOTS_BY_FAM = {
  rifle: ['optic', 'muzzle', 'barrel', 'under', 'side', 'mag', 'stock', 'ammo'],
  smg: ['optic', 'muzzle', 'barrel', 'under', 'side', 'mag', 'stock', 'ammo'],
  sniper: ['muzzle', 'under', 'mag', 'stock'],
  shotgun: ['optic', 'muzzle', 'side', 'mag', 'ammo'],
  pistol: ['optic', 'muzzle', 'side', 'mag', 'ammo'],
};
const WEAPONS = {
  m4: { id: 'm4', name: 'M4A1', type: _t('Assault rifle'), cat: 'ar', fam: 'rifle', model: 'm4', sound: 'rifle', auto: true, rpm: 780, dmg: [32, 22], range: [18, 50], head: 1.6, legs: 0.85, mag: 30, reserve: 150,
    reload: 2.1, reloadEmpty: 2.6, spread: [0.032, 0.0012], moveSpread: 0.03, recoil: { v: 0.0105, h: 0.0045, kick: 0.028, rot: 0.04 }, adsTime: 0.22, adsFov: 0.72, move: 0.95, pattern: 'climb',
    ai: { ideal: 22, aggr: 0.45 }, stats: { dmg: 0.62, acc: 0.74, rng: 0.7, rof: 0.72, mob: 0.66 },
    desc: _t('The benchmark carbine. Accurate and controllable at every range.') },
  mp5: { id: 'mp5', name: 'MP5', type: _t('Submachine gun'), cat: 'smg', fam: 'smg', model: 'mp5', sound: 'smg', auto: true, rpm: 900, dmg: [28, 15], range: [10, 28], head: 1.5, legs: 0.85, mag: 30, reserve: 180,
    reload: 1.9, reloadEmpty: 2.3, spread: [0.024, 0.0025], moveSpread: 0.012, recoil: { v: 0.0078, h: 0.0062, kick: 0.02, rot: 0.032 }, adsTime: 0.17, adsFov: 0.8, move: 1.07, pattern: 'smg',
    ai: { ideal: 11, aggr: 0.7, rush: true }, stats: { dmg: 0.5, acc: 0.64, rng: 0.4, rof: 0.86, mob: 0.88 },
    desc: _t('The submachine gun of intervention units. High rate of fire, soft recoil, fearsome up close.') },
  l96: { id: 'l96', name: 'L96A1', type: _t('Sniper rifle'), cat: 'sniper', fam: 'sniper', model: 'l96', sound: 'sniper', auto: false, bolt: true, rpm: 48, dmg: [110, 110], range: [120, 220], head: 2.5, legs: 0.8, mag: 5, reserve: 25,
    reload: 3.0, reloadEmpty: 3.4, spread: [0.09, 0.0], moveSpread: 0.06, recoil: { v: 0.045, h: 0.01, kick: 0.09, rot: 0.14 }, adsTime: 0.36, adsFov: 0.27, move: 0.88, scope: true, pattern: 'rand', loud: true,
    ai: { ideal: 45, aggr: 0.15, sniper: true }, stats: { dmg: 0.98, acc: 0.95, rng: 1.0, rof: 0.12, mob: 0.42 },
    desc: _t('British Army bolt-action rifle. One torso hit is enough, at any range.') },
  m1014: { id: 'm1014', name: 'M1014', type: _t('Shotgun'), cat: 'shotgun', fam: 'shotgun', model: 'm1014', sound: 'shotgun', auto: false, rpm: 240, pellets: 8, dmg: [22, 6], range: [6, 20], head: 1.2, legs: 0.9, mag: 8, reserve: 32,
    tube: true, shellTime: 0.46, spread: [0.075, 0.058], moveSpread: 0.01, recoil: { v: 0.046, h: 0.016, kick: 0.07, rot: 0.1 }, adsTime: 0.22, adsFov: 0.82, move: 1.0, pattern: 'rand', loud: true,
    ai: { ideal: 7, aggr: 0.85, shotgun: true, rush: true }, stats: { dmg: 0.95, acc: 0.3, rng: 0.22, rof: 0.4, mob: 0.74 },
    desc: _t('Navy semi-automatic. Eight pellets per shot, devastating indoors.') },
  m9: { id: 'm9', name: 'M9', type: _t('Pistol'), cat: 'pistol', fam: 'pistol', model: 'm9', sound: 'pistol', auto: false, rpm: 480, dmg: [38, 20], range: [8, 26], head: 1.5, legs: 0.85, mag: 15, reserve: 60,
    reload: 1.45, reloadEmpty: 1.75, spread: [0.026, 0.004], moveSpread: 0.01, recoil: { v: 0.019, h: 0.008, kick: 0.05, rot: 0.09 }, adsTime: 0.14, adsFov: 0.85, move: 1.05, pattern: 'rand',
    ai: { ideal: 12, aggr: 0.45 }, stats: { dmg: 0.4, acc: 0.6, rng: 0.3, rof: 0.5, mob: 0.95 },
    desc: _t('The standard-issue sidearm. Reliable and quick to draw.') },
  ak47: { id: 'ak47', name: 'AK-47', type: _t('Assault rifle'), cat: 'ar', fam: 'rifle', model: 'ak47', sound: 'ak', auto: true, rpm: 600, dmg: [38, 27], range: [18, 48], head: 1.5, legs: 0.85, mag: 30, reserve: 120,
    reload: 2.5, reloadEmpty: 3.0, spread: [0.036, 0.0016], moveSpread: 0.034, recoil: { v: 0.0145, h: 0.0075, kick: 0.036, rot: 0.052 }, adsTime: 0.25, adsFov: 0.72, move: 0.93, pattern: 'climb',
    ai: { ideal: 20, aggr: 0.5 }, stats: { dmg: 0.78, acc: 0.58, rng: 0.66, rof: 0.56, mob: 0.62 }, unlock: { from: 'm4', level: 5 },
    desc: _t('The most widespread rifle in the world. Heavy recoil, but every bullet hits hard.') },
  scarh: { id: 'scarh', name: 'SCAR-H', type: _t('Assault rifle'), cat: 'ar', fam: 'rifle', model: 'scarh', sound: 'battle', auto: true, rpm: 560, dmg: [42, 31], range: [22, 58], head: 1.55, legs: 0.85, mag: 20, reserve: 100,
    reload: 2.4, reloadEmpty: 2.9, spread: [0.034, 0.0012], moveSpread: 0.032, recoil: { v: 0.0165, h: 0.0058, kick: 0.04, rot: 0.056 }, adsTime: 0.26, adsFov: 0.7, move: 0.9, pattern: 'climb',
    ai: { ideal: 26, aggr: 0.4 }, stats: { dmg: 0.86, acc: 0.7, rng: 0.82, rof: 0.5, mob: 0.55 }, unlock: { from: 'ak47', level: 7 },
    desc: _t('Special forces battle rifle. Heavy cartridge, three torso hits are enough.') },
  famas: { id: 'famas', name: 'FAMAS F1', type: _t('Assault rifle'), cat: 'ar', fam: 'rifle', model: 'famas', sound: 'famas', auto: true, rpm: 1000, dmg: [26, 18], range: [16, 42], head: 1.55, legs: 0.85, mag: 25, reserve: 125,
    reload: 2.2, reloadEmpty: 2.7, spread: [0.03, 0.0011], moveSpread: 0.026, recoil: { v: 0.0072, h: 0.0042, kick: 0.02, rot: 0.03 }, adsTime: 0.2, adsFov: 0.74, move: 0.98, pattern: 'climb',
    ai: { ideal: 16, aggr: 0.6 }, stats: { dmg: 0.46, acc: 0.72, rng: 0.48, rof: 0.92, mob: 0.82 }, unlock: { from: 'm4', level: 10 },
    slots: ['optic', 'muzzle', 'barrel', 'under', 'side', 'mag', 'ammo'],
    desc: _t('The French "bugle". A compact bullpup that fires over a thousand rounds a minute.') },
  mp7: { id: 'mp7', name: 'MP7', type: _t('Submachine gun'), cat: 'smg', fam: 'smg', model: 'mp7', sound: 'mp7', auto: true, rpm: 950, dmg: [24, 14], range: [12, 30], head: 1.5, legs: 0.85, mag: 40, reserve: 160,
    reload: 1.9, reloadEmpty: 2.3, spread: [0.022, 0.0022], moveSpread: 0.01, recoil: { v: 0.0065, h: 0.0045, kick: 0.016, rot: 0.026 }, adsTime: 0.15, adsFov: 0.8, move: 1.09, pattern: 'smg',
    ai: { ideal: 12, aggr: 0.7, rush: true }, stats: { dmg: 0.42, acc: 0.7, rng: 0.44, rof: 0.9, mob: 0.92 }, unlock: { from: 'mp5', level: 5 },
    desc: _t('Ultra-compact. Forty rounds, almost no recoil, very quick to shoulder.') },
  ump45: { id: 'ump45', name: 'UMP-45', type: _t('Submachine gun'), cat: 'smg', fam: 'smg', model: 'ump45', sound: 'smg45', auto: true, rpm: 620, dmg: [34, 18], range: [11, 30], head: 1.5, legs: 0.85, mag: 25, reserve: 125,
    reload: 2.0, reloadEmpty: 2.4, spread: [0.026, 0.002], moveSpread: 0.014, recoil: { v: 0.0095, h: 0.0065, kick: 0.026, rot: 0.036 }, adsTime: 0.18, adsFov: 0.8, move: 1.04, pattern: 'smg',
    ai: { ideal: 13, aggr: 0.65, rush: true }, stats: { dmg: 0.66, acc: 0.62, rng: 0.46, rof: 0.6, mob: 0.8 }, unlock: { from: 'mp5', level: 9 },
    desc: _t('The .45 ACP in bursts. Measured rate of fire and heavy bullets, three are enough up close.') },
  vector: { id: 'vector', name: 'Vector', type: _t('Submachine gun'), cat: 'smg', fam: 'smg', model: 'vector', sound: 'vector', auto: true, rpm: 1200, dmg: [22, 13], range: [9, 26], head: 1.5, legs: 0.85, mag: 25, reserve: 125,
    reload: 1.8, reloadEmpty: 2.2, spread: [0.03, 0.003], moveSpread: 0.018, recoil: { v: 0.0052, h: 0.0048, kick: 0.014, rot: 0.022 }, adsTime: 0.16, adsFov: 0.8, move: 1.06, pattern: 'smg',
    ai: { ideal: 10, aggr: 0.75, rush: true }, stats: { dmg: 0.4, acc: 0.55, rng: 0.36, rof: 0.98, mob: 0.88 }, unlock: { from: 'mp7', level: 8 },
    desc: _t('Twelve hundred rounds a minute. A corridor chainsaw, but the magazine empties fast.') },
  svd: { id: 'svd', name: 'Dragunov SVD', type: _t('Sniper rifle'), cat: 'sniper', fam: 'sniper', rig: 'rifle', model: 'svd', sound: 'dmr', auto: false, rpm: 170, dmg: [80, 70], range: [70, 170], head: 2.2, legs: 0.8, mag: 10, reserve: 50,
    reload: 2.8, reloadEmpty: 3.3, spread: [0.085, 0.0], moveSpread: 0.05, recoil: { v: 0.026, h: 0.008, kick: 0.06, rot: 0.09 }, adsTime: 0.3, adsFov: 0.3, move: 0.92, scope: true, pattern: 'rand', loud: true,
    autoFire: { aimed: 0.3, between: 0.65 }, // auto-fire (finger, touchpad): reticle placed 0.3 s before the first shot, 0.65 s between two shots (09qd-aim.js)
    ai: { ideal: 38, aggr: 0.2, sniper: true }, stats: { dmg: 0.74, acc: 0.82, rng: 0.82, rof: 0.36, mob: 0.58 }, unlock: { from: 'l96', level: 5 },
    slots: ['muzzle', 'under', 'mag', 'stock'],
    desc: _t('Semi-automatic marksman rifle. Two torso hits, a single headshot.') },
  m82: { id: 'm82', name: 'Barrett M82', type: _t('Sniper rifle'), cat: 'sniper', fam: 'sniper', rig: 'rifle', model: 'm82', sound: 'sniper50', auto: false, rpm: 80, dmg: [150, 150], range: [150, 260], head: 2.0, legs: 0.85, mag: 10, reserve: 30,
    reload: 4.2, reloadEmpty: 4.8, spread: [0.12, 0.0], moveSpread: 0.1, recoil: { v: 0.06, h: 0.014, kick: 0.13, rot: 0.2 }, adsTime: 0.48, adsFov: 0.25, move: 0.74, scope: true, pattern: 'rand', loud: true,
    ai: { ideal: 50, aggr: 0.12, sniper: true }, stats: { dmg: 1.0, acc: 0.78, rng: 1.0, rof: 0.2, mob: 0.25 }, unlock: { from: 'svd', level: 8 },
    slots: ['muzzle', 'under', 'mag', 'stock'],
    desc: _t('.50 caliber anti-materiel rifle. Any body hit is fatal, but it is heavy and slow to aim.') },
  rem870: { id: 'rem870', name: 'Remington 870', type: _t('Shotgun'), cat: 'shotgun', fam: 'shotgun', model: 'rem870', sound: 'shotgun', auto: false, pump: true, rpm: 75, pellets: 9, dmg: [26, 7], range: [8, 24], head: 1.2, legs: 0.9, mag: 6, reserve: 30,
    tube: true, shellTime: 0.46, spread: [0.062, 0.044], moveSpread: 0.01, recoil: { v: 0.05, h: 0.016, kick: 0.075, rot: 0.11 }, adsTime: 0.24, adsFov: 0.82, move: 0.98, pattern: 'rand', loud: true, shell: 'shotgun',
    ai: { ideal: 9, aggr: 0.8, shotgun: true, rush: true }, stats: { dmg: 0.98, acc: 0.4, rng: 0.3, rof: 0.3, mob: 0.72 }, unlock: { from: 'm1014', level: 5 },
    desc: _t('The pump-action of police and hunters. Tight spread and longer reach, a pump between shots.') },
  aa12: { id: 'aa12', name: 'AA-12', type: _t('Shotgun'), cat: 'shotgun', fam: 'rifle', model: 'aa12', sound: 'shotgunauto', auto: true, rpm: 300, pellets: 8, dmg: [12, 3], range: [6, 18], head: 1.2, legs: 0.9, mag: 8, reserve: 48,
    reload: 3.4, reloadEmpty: 3.9, spread: [0.085, 0.066], moveSpread: 0.012, recoil: { v: 0.03, h: 0.012, kick: 0.06, rot: 0.08 }, adsTime: 0.28, adsFov: 0.82, move: 0.88, pattern: 'rand', loud: true, shell: 'shotgun',
    ai: { ideal: 7, aggr: 0.8, shotgun: true, rush: true }, stats: { dmg: 0.78, acc: 0.28, rng: 0.2, rof: 0.65, mob: 0.55 }, unlock: { from: 'rem870', level: 8 },
    slots: ['optic', 'muzzle', 'under', 'side', 'mag', 'ammo'],
    desc: _t('Fully automatic shotgun. Three hundred rounds a minute, twenty in the extended drum.') },
  usp: { id: 'usp', name: 'USP .45', type: _t('Pistol'), cat: 'pistol', fam: 'pistol', model: 'usp', sound: 'pistol45', auto: false, rpm: 420, dmg: [44, 24], range: [8, 26], head: 1.5, legs: 0.85, mag: 12, reserve: 60,
    reload: 1.5, reloadEmpty: 1.8, spread: [0.025, 0.0035], moveSpread: 0.01, recoil: { v: 0.024, h: 0.009, kick: 0.058, rot: 0.1 }, adsTime: 0.15, adsFov: 0.85, move: 1.04, pattern: 'rand',
    ai: { ideal: 12, aggr: 0.45 }, stats: { dmg: 0.5, acc: 0.62, rng: 0.32, rof: 0.44, mob: 0.93 }, unlock: { from: 'm9', level: 4 },
    desc: _t('The special forces .45 ACP. Fewer rounds than the M9, but more damage.') },
  glock18: { id: 'glock18', name: 'Glock 18', type: _t('Pistol'), cat: 'pistol', fam: 'pistol', model: 'glock18', sound: 'glock', auto: true, rpm: 1100, dmg: [19, 10], range: [7, 20], head: 1.5, legs: 0.85, mag: 20, reserve: 100,
    reload: 1.5, reloadEmpty: 1.8, spread: [0.034, 0.006], moveSpread: 0.012, recoil: { v: 0.012, h: 0.01, kick: 0.04, rot: 0.07 }, adsTime: 0.13, adsFov: 0.85, move: 1.07, pattern: 'smg',
    ai: { ideal: 8, aggr: 0.6 }, stats: { dmg: 0.3, acc: 0.4, rng: 0.2, rof: 0.95, mob: 0.97 }, unlock: { from: 'm9', level: 8 },
    desc: _t('Fully automatic pistol. It empties its magazine in under two seconds.') },
  deagle: { id: 'deagle', name: 'Desert Eagle', type: _t('Pistol'), cat: 'pistol', fam: 'pistol', model: 'deagle', sound: 'pistol50', auto: false, rpm: 230, dmg: [68, 46], range: [10, 32], head: 1.7, legs: 0.85, mag: 7, reserve: 35,
    reload: 2.0, reloadEmpty: 2.3, spread: [0.03, 0.0035], moveSpread: 0.012, recoil: { v: 0.036, h: 0.012, kick: 0.095, rot: 0.16 }, adsTime: 0.17, adsFov: 0.85, move: 1.0, pattern: 'rand', loud: true, shell: 'pistol50',
    ai: { ideal: 14, aggr: 0.35 }, stats: { dmg: 0.85, acc: 0.5, rng: 0.45, rof: 0.28, mob: 0.85 }, unlock: { from: 'usp', level: 8 },
    desc: _t('The .50 Action Express. Two torso hits, one headshot, but only seven rounds.') },
};
/* Feel: model recoil (kick, rot, roll), camera shake (shake) and view punch on each shot (punch), field-of-view
   jolt, flash size, stiffness and damping of the return, muzzle smoke and sparks.
   The pistol, a one-shot weapon, must be felt: it hits harder than the rifle, with a sharp return. */
const FEEL = {
  m4: { kick: 1.2, rot: 1.15, roll: 0.35, shake: 0.18, fov: 1.1, flash: 1.15, spring: [260, 20], smoke: 0.2, punch: 1.25, spark: 5 },
  mp5: { kick: 0.85, rot: 0.75, roll: 0.6, shake: 0.12, fov: 0.6, flash: 0.85, spring: [350, 26], smoke: 0.1, punch: 1.2, spark: 3 },
  l96: { kick: 1.8, rot: 1.5, roll: 0.8, shake: 0.8, fov: 4.5, flash: 1.9, spring: [95, 9], smoke: 1.0, punch: 1.1, spark: 9 },
  m1014: { kick: 2.3, rot: 2.0, roll: 1.2, shake: 0.85, fov: 5.5, flash: 2.4, spring: [120, 10], smoke: 1.0, punch: 1.1, spark: 12 },
  ak47: { kick: 1.5, rot: 1.3, roll: 0.5, shake: 0.25, fov: 1.5, flash: 1.3, spring: [245, 19], smoke: 0.25, punch: 1.35, spark: 6 },
  scarh: { kick: 1.65, rot: 1.4, roll: 0.45, shake: 0.3, fov: 1.8, flash: 1.4, spring: [235, 19], smoke: 0.3, punch: 1.4, spark: 7 },
  famas: { kick: 0.95, rot: 0.9, roll: 0.4, shake: 0.14, fov: 0.8, flash: 0.95, spring: [320, 24], smoke: 0.15, punch: 1.15, spark: 4 },
  mp7: { kick: 0.7, rot: 0.6, roll: 0.5, shake: 0.1, fov: 0.5, flash: 0.7, spring: [370, 27], smoke: 0.08, punch: 1.15, spark: 3 },
  ump45: { kick: 1.0, rot: 0.9, roll: 0.6, shake: 0.16, fov: 0.9, flash: 1.0, spring: [330, 25], smoke: 0.12, punch: 1.25, spark: 4 },
  vector: { kick: 0.65, rot: 0.55, roll: 0.55, shake: 0.09, fov: 0.45, flash: 0.8, spring: [390, 28], smoke: 0.08, punch: 1.1, spark: 3 },
  svd: { kick: 1.9, rot: 1.6, roll: 0.7, shake: 0.6, fov: 3.2, flash: 1.6, spring: [105, 10], smoke: 0.8, punch: 1.1, spark: 7 },
  m82: { kick: 2.8, rot: 2.3, roll: 1.0, shake: 1.2, fov: 6.5, flash: 2.8, spring: [80, 8], smoke: 1.4, punch: 1.2, spark: 14 },
  rem870: { kick: 2.4, rot: 2.1, roll: 1.2, shake: 0.9, fov: 5.5, flash: 2.3, spring: [115, 10], smoke: 1.0, punch: 1.1, spark: 12 },
  aa12: { kick: 1.8, rot: 1.5, roll: 0.9, shake: 0.6, fov: 3.0, flash: 2.0, spring: [170, 13], smoke: 0.8, punch: 1.15, spark: 10 },
  usp: { kick: 1.6, rot: 1.6, roll: 0.3, shake: 0.5, fov: 2.7, flash: 1.5, spring: [350, 24], smoke: 0.25, punch: 1.8, spark: 7 },
  glock18: { kick: 0.9, rot: 0.9, roll: 0.5, shake: 0.2, fov: 1.2, flash: 1.0, spring: [380, 26], smoke: 0.15, punch: 1.4, spark: 4 },
  deagle: { kick: 2.5, rot: 2.4, roll: 0.5, shake: 0.9, fov: 4.2, flash: 2.4, spring: [260, 18], smoke: 0.6, punch: 2.2, spark: 12 },
  m9: { kick: 1.5, rot: 1.5, roll: 0.3, shake: 0.5, fov: 2.6, flash: 1.6, spring: [360, 24], smoke: 0.25, punch: 1.8, spark: 8 },
};
/* Grenades of choice (owner's request, after 5.0): each class carries a single type, two per life (NADE_COUNT). fuse: fuse,
   from the spoon release (s); name: short name (workshop, HUD); long: full name; icon: 24 x 24 SVG path; desc: the effect in one or two
   sentences (a piece of equipment: the throwing knife is stored with them); cook: can be cooked in hand (the fuse starts as soon as it is held, it bursts in the hand if you wait too long; the others only start on throw).
   Effects: explode (frag), flashBang and smokeStart (07-bots.js). */
const NADE_COUNT = 2;
const NADE_TYPES = {
  frag: { fuse: 3.5, cook: true, name: _t('Frag'), long: _t('Frag grenade'), icon: '<ellipse cx="12" cy="14" rx="5.5" ry="6.5"/><path d="M10 7.6V5.5h4v2.1M14 5.5l3.4 3.2"/><circle cx="8.6" cy="4.6" r="1.6"/>',
    desc: _t('It goes off 3.5 seconds after the spoon flies. Holding it shortens the fuse.') },
  flash: { fuse: 1.5, name: _t('Flash'), long: _t('Flashbang'), icon: '<rect x="8" y="6.5" width="8" height="14" rx="1.5"/><path d="M8 10.5h8M8 16.5h8M10 6.5V4.5h4v2M14 4.5l3 2.4"/>',
    desc: _t('It blinds and deafens, more so up close and facing it. No damage.') },
  smoke: { fuse: 1.6, name: _t('Smoke'), long: _t('Smoke grenade'), icon: '<rect x="8.5" y="10" width="7" height="11" rx="1.2"/><path d="M8.5 13.5h7M10.5 10V8.5h3V10"/><path d="M11 7.4c-2.4-.2-2.8-3.1-.3-3.6.8-1.9 3.9-1.7 4.2.4 2.1.1 2.5 2.7.4 3.2"/>',
    desc: _t('A thick cloud about seven meters wide, for around fifteen seconds. Nobody sees through it.') },
  // throwing knife: no fuse or explosion, it flies almost straight and kills in one hit (THROW_KNIFE, 07-bots.js), then stays stuck and can be picked up
  knife: { fuse: 0, name: _t('Knife'), long: _t('Throwing knife'), icon: '<path d="M12 2.5l2.2 4.2-1 8.3h-2.4l-1-8.3z"/><path d="M10.4 15h3.2v6.5h-3.2zM10.4 17.2h3.2M10.4 19.3h3.2"/>',
    desc: _t('It flies almost straight and kills in one hit. Walk over it to pick it up.') },
};
const NADE_IDS = Object.keys(NADE_TYPES);
/* "2 stun grenades": the number and the type, for the detail of a class */
function nadeCount(id, n) {
  return id === 'flash' ? _tn(n, '{0} flashbang', '{0} flashbangs') : id === 'smoke' ? _tn(n, '{0} smoke grenade', '{0} smoke grenades')
    : id === 'knife' ? _tn(n, '{0} throwing knife', '{0} throwing knives')
    : _tn(n, '{0} frag grenade', '{0} frag grenades');
}
const nadeSvg = (id) => `<svg viewBox="0 0 24 24" aria-hidden="true">${(NADE_TYPES[id] || NADE_TYPES.frag).icon}</svg>`;
/* The four preset classes: starting weapons, no attachments, not modifiable. Custom classes (five slots
   unlocked by the player's level) are added after them in 06r-arsenal.js, which keeps and restores their composition */
const CLASSES = [
  { name: _t('Assault'), desc: _t('The all-rounder, at ease at every range.'), primary: 'm4', secondary: 'm9', nades: NADE_COUNT, nade: 'frag' },
  { name: _t('Cleaner'), desc: _t('Speed and rate of fire for close quarters.'), primary: 'mp5', secondary: 'm9', nades: NADE_COUNT, nade: 'flash' },
  { name: _t('Sniper'), desc: _t('One torso hit is enough. While aiming, hold your breath to steady the scope.'), primary: 'l96', secondary: 'm9', nades: NADE_COUNT, nade: 'smoke' },
  { name: _t('Breacher'), desc: _t('Devastating indoors, harmless beyond twenty meters.'), primary: 'm1014', secondary: 'm9', nades: NADE_COUNT, nade: 'frag' },
];
/* Killstreaks of choice: each class carries three (c.ks), at three different thresholds, sorted by threshold; they are slots 1, 2 and 3
   (keys 4, 5 and 6, actions ks1 to ks3; touch and gamepad buttons likewise). n: kills in a row without dying; short: touch
   button label; icon: 24 x 24 SVG path (HUD, touch buttons, workshop); use: call by the player (08b-killstreaks.js, 08d-heli.js); bot: call by a
   bot (botStreak, 09-game.js). The catalog is here and not in 08b-killstreaks.js: the loading of saved classes (arsLoad, 06r-arsenal.js) uses it. */
const KSDEF = {
  uav: { n: 4, name: _t('UAV'), short: _t('UAV'), icon: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><path d="M12 12l6-6"/>',
    desc: _t('For 30 seconds, the minimap shows enemies every 3 seconds.'),
    use: () => useUAV(), bot: (b) => botUav(b) },
  fpv: { n: 6, name: _t('Kamikaze drone'), short: _t('Drone'), icon: '<path d="M9.5 10.5h5v3h-5zM9.5 10.5L6 7M14.5 10.5L18 7M9.5 13.5L6 17M14.5 13.5L18 17"/><circle cx="5" cy="6" r="2.6"/><circle cx="19" cy="6" r="2.6"/><circle cx="5" cy="18" r="2.6"/><circle cx="19" cy="18" r="2.6"/>',
    desc: _t('You fly an explosive drone for 30 seconds. It blows up on contact or when you fire. Your soldier is left defenseless.'),
    use: () => usePhoneKs('fpv'), bot: (b) => fpvLaunch(b) },
  air: { n: 8, name: _t('Airstrike'), short: _t('Strike'), icon: '<path d="M12 2.5c1 0 1.6 1.4 1.6 3.4V10l7.4 4.3v2l-7.4-2.2v4.3l2.4 2v1.6L12 21l-4 1v-1.6l2.4-2v-4.3L3 16.3v-2l7.4-4.3V5.9c0-2 .6-3.4 1.6-3.4z"/>',
    desc: _t('Two fighter jets bomb the area you pick on the map. A roof gives good cover.'),
    use: () => useAirstrike(), bot: (b) => botAirstrike(b) },
  emp: { n: 8, name: _t('EMP'), short: _t('EMP'), icon: '<circle cx="12" cy="12" r="8.5"/><path d="M13.2 6.2L8.8 12.6h3.6l-1.6 5.2 4.4-6.4h-3.6z"/>',
    desc: _t('Jams the enemy team for 25 seconds. No minimap or killstreaks, and its UAV and satellite shut down.'),
    use: () => usePhoneKs('emp'), bot: (b) => empFire(b) },
  sat: { n: 10, name: _t('Satellite'), short: _t('Satellite'), icon: '<rect x="9" y="9.5" width="6" height="5" rx="1"/><path d="M2.5 9.5h4.5v5H2.5zM17 9.5h4.5v5H17zM7 12h2M15 12h2M12 9.5V6.5M9.8 4.8a3.2 3.2 0 0 1 4.4 0"/>',
    desc: _t('For 30 seconds, the minimap shows enemies live and where they look. Only an EMP cuts it off.'),
    use: () => usePhoneKs('sat'), bot: (b) => satFire(b) },
  mecha: { n: 13, name: _t('Mecha'), short: _t('Mecha'), icon: '<path d="M7 5.5h10l1.5 3.5-1.5 3H7L5.5 9zM3 7.5h2.5M18.5 7.5H21M9 12l-1.5 4 1.5 3.5M15 12l1.5 4-1.5 3.5M6.5 19.5h3.5M14 19.5h3.5"/>',
    desc: _t('A mecha drops onto the area you pick and holds its position. Climb aboard to pilot it. It ends up exploding, so get out first.'),
    use: () => useMecha(), bot: (b) => botMecha(b) },
  heli: { n: 11, name: _t('Helicopter'), short: _t('Heli'), icon: '<path d="M3 5.5h18M12 5.5v3.5M7.5 9h7a4.5 4.5 0 0 1 0 9h-5a4 4 0 0 1-4-4v-1a4 4 0 0 1 2-4zM6.5 13H2M9 18v2.5h7"/>',
    desc: _t('A helicopter fires at enemies in the open for 34 seconds. It can be shot down.'),
    use: () => useHeli(), bot: (b) => callHeli(b) },
};
const KS_IDS = Object.keys(KSDEF), KS_DEFAULT = ['uav', 'air', 'heli'], KS_SLOTS = 3;
/* Killstreaks sorted by threshold */
const ksSort = (l) => l.slice().sort((a, b) => KSDEF[a].n - KSDEF[b].n || KS_IDS.indexOf(a) - KS_IDS.indexOf(b));
/* The killstreaks of list in order, without duplicates, without two at the same threshold, three at most */
function ksPick(list) {
  const out = [];
  for (const id of list) if (out.length < KS_SLOTS && KSDEF[id] && !out.includes(id) && !out.some((x) => KSDEF[x].n === KSDEF[id].n)) out.push(id);
  return out;
}
/* Three valid killstreaks, those of list first, completed by the original ones then by the catalog */
const ksFill = (list) => ksSort(ksPick((Array.isArray(list) ? list : []).concat(KS_DEFAULT, KS_IDS)));
for (const k in FEEL) WEAPONS[k].feel = FEEL[k];
/* Pacing (5.1, owner feedback: "more nervous"): reloads (and each shotgun shell) shortened by 10%, raise-to-aim
   by 12%; the values written above are the ones from before. The choreographies follow (they last the weapon's reload time),
   the hands stay under the speeds of reloadAnim.js */
const TEMPO_WEAPONS = { reload: 0.9, ads: 0.88 };
for (const k in WEAPONS) {
  const d = WEAPONS[k];
  for (const f of ['reload', 'reloadEmpty', 'shellTime']) if (d[f]) d[f] = +(d[f] * TEMPO_WEAPONS.reload).toFixed(3);
  if (d.adsTime) d.adsTime = +(d.adsTime * TEMPO_WEAPONS.ads).toFixed(3);
}
for (const k in WEAPONS) { const d = WEAPONS[k]; d.base = d; d.key = k; d.att = []; d.camo = null; if (!d.slots) d.slots = SLOTS_BY_FAM[d.fam].slice(); }
