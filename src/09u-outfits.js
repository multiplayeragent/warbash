/* ==========================================================================
   OUTFIT CHOICE: Outfits screen of the main menu only (3D preview that can be rotated, as allies see it),
   not in a match; the chosen outfit (Settings.skin) applies whatever the class's weapon: first-person arms, the player's
   body (shadow, killcam) and, online, what the others see (sk field of presence, 09c-net.js). The outfits themselves:
   06ga-outfits.js.
   The preview is rendered by the game engine in the showcase scene (09o-showcase.js, vwDraw: render target read back, never the game's
   canvas), only when it changes (rotation, outfit, viewpoint, class); thumbnails go through the weapon thumbnail queue
   (one per task).
   The preview soldier stands as in a match: the pose comes from poseSoldier (06b-soldier.js), frozen in a combat stance (without the random
   idle movements), the chosen class's primary weapon in hand (the armory's model, same materials).
   Animated preview (skinLive), as soon as the animated menu background is there (09w-background.js): the soldier walks in place, weapon aimed, three-quarter
   view (SK_POSE.a, the angle of each arrival on the screen); it only turns by finger (it is the soldier who turns, not the camera: its simulated
   cape follows the movement, with the air of its walk and the breeze of a studio fan). It is drawn in the game canvas,
   during the frame loop and right after the background (same rate: the screen's on desktop, 60 frames per second at most on touch, 09w-background.js), in the preview frame (viewport and
   scissor), with no render target or read-back: a studio (gradient background, lit floor with the feet's contact shadows, main
   light, fill and rim light tinted green), no extra shadow map or texture. Reduced motion: motionless soldier,
   which only turns by finger. Without the animated background (economy graphics mode, lost context): the still image from before, rendered separately and
   copied (skinDraw).
   ========================================================================== */
const SKV = { host: null, cv: null, ctx: null, a: 0.6, drag: null, dirty: true, W: 0, H: 0, models: {}, mats: {}, guns: {}, pose: null, view: '', lmodels: {}, lguns: {},
  live: false, fail: false, acc: 0, ft: 0, lv: '', mine: '' };
/* All the screen's outfits: the base ones, then the challenge ones (06gc-outfits-challenge.js); SKV.view: the preview's (the worn outfit, or a locked
   challenge outfit being looked at before having it). A unique outfit (06gd-outfit-unique.js) is only added for its owner
   (skinListed): others see neither its card nor its thumbnail */
const SKIN_ALL = SKIN_IDS.concat(SKIN_CHALLENGE);
const skinOwned = () => SKIN_UNIQUE.filter(skinUnlocked);
const skinListed = () => SKIN_ALL.concat(skinOwned());
const SK_AIM = new V3(0, 0.93, 0);
/* Preview stance: aim share (0: weapon low, across the body; 1: shouldered) and gaze tilt (rad); a: camera azimuth
   (three-quarter view from the soldier's right, the weapon shows from the side) */
const SK_POSE = { aim: 0.5, pitch: -0.1, a: 0.6 };
/* Outfit preview material (without a lighting volume: no map is loaded in the menus); tint and stripes set at each render */
function skinPvMat(skin) { return SKV.mats[skin] || (SKV.mats[skin] = gearMaterial(skin, 'pv')); }
/* Preview soldier of an outfit (detailed model), with the same bones as the game's soldiers; S.gun carries the weapon (set by skinPvPlace) */
function skinPvModel(skin) { return SKV.models[skin] || (SKV.models[skin] = skinPvBuild(skin)); }
/* Preview soldier of the animated preview (its own: the thumbnails pose the other, and reset its cloth to rest), and its weapon */
function skinLiveModel(skin) { return SKV.lmodels[skin] || (SKV.lmodels[skin] = skinPvBuild(skin)); }
function skinLiveGun(key) { return SKV.lguns[key] || (SKV.lguns[key] = buildGunModel(key).group); }
function skinPvBuild(skin) {
  const R = soldierRest(), root = new THREE.Group(), bones = [];
  for (let i = 0; i < SOLDIER_NB; i++) { const b = new THREE.Object3D(); b.position.setFromMatrixPosition(R.mats[i]); b.quaternion.copy(R.q[i]); root.add(b); bones.push(b); }
  const skel = new THREE.Skeleton(bones, R.mats.map((m) => m.clone().invert()));
  const mesh = new THREE.SkinnedMesh(soldierGeometry(skin, 'hi'), skinPvMat(skin)); mesh.bind(skel, _RIG_ID); mesh.frustumCulled = false; bones[SB.PEL].add(mesh);
  const gun = new THREE.Group(); root.add(gun);
  const M = { root, bones, skel, J: R.J.map((v) => v.clone()), lastN: R.lastN.map((v) => v.clone()), fp: [0, 0], fy: [0, 0], sink: 0, gun, grips: null, kind: 'rifle', key: '' };
  if (SKINS[skin].cloth) { M.cloth = clothAttach(M, skin, skinPvMat(skin), skel); M.cloth.mesh.frustumCulled = false; } // simulated cloth (06gb-cloth.js), back to rest at each pose
  return M;
}
/* Primary weapon of the chosen class (the last played): the one the preview soldier holds */
function skinPvGunKey() { classFix(); return classWeapons(Settings.loadout)[0].key; }
/* Showcase weapon (armory model, in the soldiers' weapon frame: see worldGunGeometry), one per mounted weapon */
function skinPvGun(key) { return SKV.guns[key] || (SKV.guns[key] = buildGunModel(key).group); }
/* Frozen pose of a soldier holding weapon key: the game's procedural pose, replayed for a second at rest (the springs settle), in a combat
   stance (SK_POSE), with no random weight shift, gaze or readjustment; computed once per weapon, the same for all outfits */
function skinPvPose(key) {
  if (SKV.pose && SKV.pose.key === key) return SKV.pose;
  const R = soldierRest(), G = worldGunGeometry(key);
  const P = { key, J: R.J.map((v) => v.clone()), Jp: R.J.map((v) => v.clone()), gun: new THREE.Object3D(), grips: G.grips, kind: G.kind };
  const e = { model: P, pos: new V3(), vel: new V3(), yaw: 0, pitch: SK_POSE.pitch, crouchAmt: 0, sprinting: false, onGround: true, isPlayer: false, visible: false, target: null, lastShotT: -1e9, lastSeenT: -1e9, recoil: 0, throwT: 0, arms: null };
  for (let i = 0; i < 30; i++) {
    Object.assign(P, { wtClk: 1e9, lkClk: 1e9, wtT: 0, lkT: 0, lkP: 0, gyL: 0, gyR: 0 }); // (the preview floor is flat, at height 0)
    if (P.cyc !== undefined) Object.assign(P, { aimW: SK_POSE.aim, aimWV: 0, cyc: 0, t: 1.2 });
    poseSoldier(e, 1 / 30);
  }
  return (SKV.pose = P);
}
/* Places preview soldier S in the pose of weapon key and puts the weapon in hand */
function skinPvPlace(S, key) {
  const P = skinPvPose(key), g = skinPvGun(key);
  if (g.parent !== S.gun) { S.gun.clear(); S.gun.add(g); } // only one weapon in hand (the previous class's goes away)
  if (S.key === key) return;
  for (let i = 0; i < 15; i++) S.J[i].copy(P.J[i]);
  S.fp = P.fp.slice(); S.fy = P.fy.slice(); S.headQ = P.headQ.clone(); S.grips = P.grips; S.kind = P.kind;
  S.gun.position.copy(P.gun.position); S.gun.quaternion.copy(P.gun.quaternion);
  layoutSoldier(S, true); if (S.cloth) clothSettle(S, S.cloth); S.root.updateMatrixWorld(true); S.key = key;
}
/* Bones of preview soldier M recomputed for the following render: the engine only does it once per frame of its counter (renderer.info),
   which only advances in a match (09-game.js), not in the menus; without this, the body would keep its first pose (the weapon would follow).
   The counter advances too: the engine only sends modified vertices back to the GPU once per frame of that counter, and the displayed simulated
   cloth stayed that of the first frame (a frozen cape, stuck to the pelvis, that the arms went through) */
function skinSkel(M) { renderer.info.render.frame++; M.root.updateMatrixWorld(true); M.skel.update(); }
/* Renders outfit skin as seen by rel (0 ally, 1 enemy), camera at azimuth a, into ctx (dw x dh); the showcase shows only it */
const SKRIM = { l: null }, SK_THUMB_BG = 0x30352a;
function skinDraw(ctx, dw, dh, skin, rel, a) {
  const S = vwScene(), M = skinPvModel(skin), m = skinPvMat(skin), live = VW.model && VW.model.visible ? VW.model : null;
  if (!SKRIM.l) SKRIM.l = new THREE.DirectionalLight(0xe4ecff, 2.6);
  skinPvPlace(M, skinPvGunKey());
  skinTone(skin, rel, m.color); skinRelColor(rel, m.userData.skU.tag.value);
  skinSkel(M);
  if (live) live.visible = false;
  S.scene.add(M.root);
  S.cam.aspect = dw / dh; S.cam.updateProjectionMatrix();
  const d = 1.08 / Math.tan(THREE.MathUtils.degToRad(VW_FOV) / 2) * Math.max(1, 0.62 / (dw / dh));
  vwCamPlace(S.cam, a + Math.PI / 2, 0.06, d, SK_AIM);
  // rim light: from behind the soldier as the camera sees him, high, so the outline stands out of the ground
  SKRIM.l.position.set(Math.cos(a + Math.PI / 2) * 2, 2.4, Math.sin(a + Math.PI / 2) * 2); S.scene.add(SKRIM.l);
  try { vwDraw(ctx, dw, dh, dw, dh, SK_THUMB_BG); } finally { S.scene.remove(M.root); S.scene.remove(SKRIM.l); if (live) live.visible = true; }
}
/* An outfit's thumbnail (three-quarter view from its right, by an ally), in the weapon thumbnail queue (thumbsStep: "skin:..." keys); SKTH.gun: the weapon
   held on the thumbnails, which are redone when the chosen class changes it (skinThumbsCheck) */
const SKTH = { w: 200, h: 300, ctx: null, gun: '' };
function skinThumbRender(skin) {
  const key = 'skin:' + skin;
  try {
    if (!SKTH.ctx) { const cv = document.createElement('canvas'); cv.width = SKTH.w; cv.height = SKTH.h; SKTH.ctx = cv.getContext('2d'); }
    SKTH.gun = skinPvGunKey();
    skinDraw(SKTH.ctx, SKTH.w, SKTH.h, skin, 0, SK_POSE.a);
    VTHUMB.img[key] = SKTH.ctx.canvas.toDataURL('image/webp', 0.9);
  } catch (e) { VTHUMB.fails[key] = (VTHUMB.fails[key] || 0) + 1; delete VTHUMB.img[key]; gpuLog('skin thumbnail failed: ' + skin + ' (' + (e && e.message) + ')'); return ''; }
  skinRelease(skin); // a challenge outfit that nothing else shows doesn't stay in memory for a thumbnail
  return VTHUMB.img[key];
}
const skinThumbImg = (s) => `<img data-thumb="skin:${s}"${VTHUMB.img['skin:' + s] ? '' : ' data-pend'} alt="" src="${VTHUMB.img['skin:' + s] || VBLANK}" decoding="async">`;

/* ---------- Choice ---------- */
/* The player takes outfit s: saved, and applied right away (arms, body, online). A locked challenge outfit can't be taken:
   it only goes into the preview, with the detail of its challenges at the bottom of the preview (skinInfoHtml). */
function skinPick(s) {
  s = skinId(s); skinView(s);
  if (!skinUnlocked(s)) { skinRefresh(); return; }
  if (s === skinMine() && s === skinId(Settings.skin)) { skinRefresh(); return; }
  Settings.skin = s; saveSettings();
  if (VM_LOOK.hand) vmSetLook(s, 0);
  soldierLookAll();
  if (NET.on) NET.flush = true; // the next presence announces the new outfit
  skinRefresh();
}
/* The logged-in account has changed (login, logout, other account): a unique outfit is worn or dropped with it (skinMine); arms,
   body, what others see online and the Outfits screen follow */
function skinAcct() {
  const m = skinMine(); if (m === SKV.mine) return;
  const was = SKV.mine; SKV.mine = m;
  if (VM_LOOK.hand) vmSetLook(m, 0);
  soldierLookAll();
  if (NET.on) NET.flush = true;
  if (SKV.host) { if (SKV.view === was) skinView(m); skinRefresh(); }
  if (was) setTimeout(() => skinRelease(was), 0);
}
/* A challenge outfit only takes memory while it is shown: geometries, materials, textures and preview soldier are freed when neither the
   player, nor the preview, nor a soldier, nor the killcam wears it (it is rebuilt on demand: soldierGeometry, soldierMaterial) */
function skinRelease(s) {
  if (!SKINS[s] || !(SKINS[s].challenge || SKINS[s].owner) || s === skinMine() || s === SKV.view) return;
  for (const e of entities) if (e.model && e.model.lod && e.model.lod.skin === s) return;
  if (KC.body && KC.body.lod && KC.body.lod.skin === s) return;
  const M = SKV.models[s]; if (M) { if (M.cloth) clothDetach(M); delete SKV.models[s]; }
  const L = SKV.lmodels[s]; if (L) { if (L.cloth) clothDetach(L); delete SKV.lmodels[s]; }
  if (SKV.mats[s]) { SKV.mats[s].dispose(); delete SKV.mats[s]; }
  for (const k of ['hi', 'lo']) if (SOLDIER_GEOS[s + k]) { SOLDIER_GEOS[s + k].dispose(); delete SOLDIER_GEOS[s + k]; delete SOLDIER_GEOS['stats' + s + k]; }
  for (const r of [0, 1]) { const m = SOLDIER_MATS[s + r]; if (m) { m.dispose(); if (csm && csm.shaders) csm.shaders.delete(m); delete SOLDIER_MATS[s + r]; } }
  for (const k of ['tp', 'fp']) { const T = GEAR.maps[s + k]; if (T) { T.map.dispose(); delete GEAR.maps[s + k]; } }
}
/* Match start: the challenge outfits nobody wears are freed */
function skinTrim() { for (const s of SKIN_CHALLENGE.concat(SKIN_UNIQUE)) skinRelease(s); }
/* Outfit shown by the preview; the one being left is freed if nothing shows it anymore */
function skinView(s) { const old = SKV.view; SKV.view = s; SKV.dirty = true; if (old && old !== s) setTimeout(() => skinRelease(old), 0); }
const SK_LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3h1.5v11h-13V10zm2 0h6V7a3 3 0 0 0-6 0z"/></svg>';
/* Progress bar (0 to 1) */
const skinBar = (f) => `<span class="sk-pb"><i style="width:${Math.round(clamp(f, 0, 1) * 100)}%"></i></span>`;
/* A card: thumbnail, name, role; "Selected" on the worn outfit; a locked challenge outfit carries a padlock and the progress of its
   challenges; the one in the preview is marked with a light rule, and the detail of its challenges shows at the bottom of the preview (skinInfoHtml):
   the card keeps its size, nothing moves in the list */
function skinCardHtml(s) {
  const K = SKINS[s], cur = skinMine(), lock = !skinUnlocked(s), viewing = lock && SKV.view === s, D = K.challenge ? challengesOf(s) : [], done = D.filter((d) => challengeDone(d.id)).length;
  // locked: the padlock and progress take the place of the role (a phone card has only two lines): the challenges completed (the same
  // words as the preview), with the bar of the share of the way done; an unlocked challenge outfit says so, with the cue to wear it
  const f = D.length ? D.reduce((a, d) => a + challengeCount(d.id) / d.goal, 0) / D.length : 0;
  let tx = `<span class="cn">${K.name}</span>${!lock ? `<span class="cw">${skinRoleHtml(K)}</span>` : ''}`;
  if (s === cur) tx += `<span class="cb next">${_t('Selected')}</span>`;
  else if (lock) tx += `<span class="sk-lk">${SK_LOCK}${_t('{0} of {1} done', done, D.length)}</span>${skinBar(f)}`;
  else if (K.challenge) tx += `<span class="sk-uw"><span class="cb un">${_t('Unlocked')}</span><span class="cb wear">${_t('Wear')}</span></span>`;
  return `<button type="button" class="sk-card${lock ? ' locked' : ''}${viewing ? ' viewing' : ''}${K.challenge ? ' challenge' : ''}" role="option" data-skin="${s}" aria-selected="${s === cur}">${skinThumbImg(s)}<span class="sk-tx">${tx}</span></button>`;
}
/* An outfit's role, a map name in it kept on one line (Saint-Givre did not break at its hyphen) */
function skinRoleHtml(K) { const m = K.map && MAPS.find((x) => x.id === K.map); return m ? K.role.replace(m.name, `<span class="nw">${m.name}</span>`) : K.role; }
/* Detail of a locked challenge outfit (name, role, progress, each challenge with its bar): at the bottom of the Outfits screen preview;
   '' for an outfit that can be taken */
function skinInfoHtml(s) {
  const K = SKINS[s]; if (!K || !K.challenge || skinUnlocked(s)) return '';
  const D = challengesOf(s), done = D.filter((d) => challengeDone(d.id)).length;
  return `<div class="sk-info-h"><b>${K.name}</b><span class="sk-lk">${SK_LOCK}${_t('{0} of {1} done', done, D.length)}</span></div><span class="cw">${skinRoleHtml(K)}</span>`
    + `<span class="sk-dl">${D.map((d) => { const n = challengeCount(d.id), ok = n >= d.goal; return `<span class="sk-d${ok ? ' ok' : ''}"><span class="sk-dt"><b>${esc(d.label)}</b><em>${ok ? _t('Done') : `${n} / ${d.goal}`}</em></span>${d.hint && !ok ? `<small>${esc(d.hint)}</small>` : ''}${skinBar(n / d.goal)}</span>`; }).join('')}</span>`;
}
/* Outfit list (cards): the base ones, then the challenge ones in three groups under their titles (the first six, the map outfits, the
   play-style outfits), each title with the count of unlocked ones */
function skinCardsHtml() {
  const own = skinOwned(), first = SKIN_CHALLENGE.filter((s) => !SKIN_MAP_OUT.includes(s) && !SKIN_PLAY_OUT.includes(s));
  const group = (L, title, sub) => `<p class="sk-h">${title}<span>${sub} · ${_t('{0} / {1} unlocked', L.filter(skinUnlocked).length, L.length)}</span></p>` + L.map(skinCardHtml).join('');
  return SKIN_IDS.map(skinCardHtml).join('')
    + (own.length ? `<p class="sk-h">${_t('One-of-a-kind outfit')}<span>${_t('Made for you, nobody else can wear it')}</span></p>` + own.map(skinCardHtml).join('') : '')
    + group(first, _t('Challenge outfits'), _t('Complete their challenges to unlock them'))
    + group(SKIN_MAP_OUT, _t('Map outfits'), _t('Each one is earned on its own map'))
    + group(SKIN_PLAY_OUT, _t('Play-style outfits'), _t('Each one is earned by a way of playing'));
}
/* The chosen class has changed weapon since the thumbnails: they go back into the queue (at the head), the new weapon in hand */
function skinThumbsCheck() {
  if (!SKTH.gun || SKTH.gun === skinPvGunKey()) return;
  for (const s of skinListed()) { delete VTHUMB.img['skin:' + s]; thumbsWant('skin:' + s); }
}
/* Refreshes the Outfits screen (the outfit can only be changed in the menu, not in a match) */
function skinRefresh() {
  skinThumbsCheck();
  const a = document.activeElement, k = a && a.classList && a.classList.contains('sk-card') ? a.dataset.skin : null, el = $('skList');
  const had = k && el.contains(a);
  el.innerHTML = skinCardsHtml();
  if (had) { const f = el.querySelector(`[data-skin="${k}"]`); if (f) f.focus({ preventScroll: true }); } // the controller and keyboard keep their place
  // detail of the locked outfit's challenges being looked at: at the bottom of the preview
  const info = skinInfoHtml(SKV.view);
  const si = $('skInfo'); if (si) { if (si.__h !== info) { si.__h = info; si.innerHTML = info; } si.classList.toggle('hidden', !info); SKV.host.classList.toggle('has-info', !!info); }
  SKV.dirty = true;
}

/* ---------- Outfits screen: preview ---------- */
function skinScreenInit() {
  const host = $('skView'); if (!host) return;
  SKV.host = host;
  host.innerHTML = _t('<canvas class="vw-cv" aria-hidden="true"></canvas><div class="vw-help">Drag to rotate</div>');
  SKV.cv = host.firstChild; SKV.ctx = SKV.cv.getContext('2d');
  const info = document.createElement('div'); info.id = 'skInfo'; info.className = 'sk-info hidden'; info.setAttribute('aria-live', 'polite'); host.appendChild(info);
  // the list fades at the top too once it has scrolled (cards above)
  const L = $('skList'); if (L) L.addEventListener('scroll', () => L.classList.toggle('sk-up', L.scrollTop > 6), { passive: true });
  SKV.cv.addEventListener('pointerdown', (e) => { SKV.drag = { x: e.clientX, a: SKV.a }; SKV.cv.setPointerCapture(e.pointerId); host.classList.add('drag'); });
  SKV.cv.addEventListener('pointermove', (e) => { if (!SKV.drag) return; SKV.a = SKV.drag.a - (e.clientX - SKV.drag.x) * 0.01; SKV.dirty = true; });
  const up = () => { SKV.drag = null; host.classList.remove('drag'); };
  SKV.cv.addEventListener('pointerup', up); SKV.cv.addEventListener('pointercancel', up);
  SKV.cv.addEventListener('dblclick', () => { SKV.a = SK_POSE.a; SKV.dirty = true; });
  SKV.cv.tabIndex = 0; SKV.cv.setAttribute('aria-label', _t('Outfit in 3D, arrow keys to rotate it'));
  SKV.cv.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); SKV.a += e.key === 'ArrowLeft' ? 0.15 : -0.15; SKV.dirty = true; } });
  $('skList').addEventListener('click', (e) => { const b = e.target.closest('.sk-card'); if (b) { sfxUi('click'); skinPick(b.dataset.skin); } });
}
/* Arrival on the Outfits screen */
function renderSkins() {
  skinView(skinMine()); skinRefresh(); SKV.W = 0; SKV.a = SK_POSE.a; SKV.lv = ''; SKV.dirty = true; // three-quarter view on each arrival
  // outfit thumbnails: at the head of the queue (they were waiting at the end of the queue, thumbsStart)
  if (!VTHUMB.ready) return;
  const want = skinListed().map((s) => 'skin:' + s).filter((k) => !VTHUMB.img[k]);
  VTHUMB.queue = VTHUMB.queue.filter((k) => !want.includes(k));
  for (const k of want.reverse()) thumbsWant(k);
}
/* One frame of the preview: called by the main loop as long as the Outfits screen is displayed, before the background; animated preview: asks the
   background to redraw if the preview changed (reduced motion: the background doesn't redraw itself); still image: only renders if
   something changed */
function skinTick() {
  if (!SKV.host) return;
  const live = MBG.live && !MBG.failed && !SKV.fail;
  if (live !== SKV.live) { SKV.live = live; SKV.host.classList.toggle('live', live); document.body.classList.toggle('sk-live', live); if (live && SKV.ctx) SKV.ctx.clearRect(0, 0, SKV.cv.width, SKV.cv.height); SKV.dirty = true; }
  if (live) { if (SKV.dirty) mbgShown(); return; }
  const r = SKV.host.getBoundingClientRect(), W = Math.round(r.width), H = Math.round(r.height);
  if (W < 20 || H < 20) return;
  if (W !== SKV.W || H !== SKV.H) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), bs = renderer.getDrawingBufferSize(_vwV2), k = Math.min(dpr, bs.x / W, bs.y / H);
    SKV.W = W; SKV.H = H; SKV.cv.width = Math.max(2, Math.floor(W * k)); SKV.cv.height = Math.max(2, Math.floor(H * k)); SKV.dirty = true;
  }
  if (!SKV.dirty) return;
  SKV.dirty = false;
  try { skinDraw(SKV.ctx, SKV.cv.width, SKV.cv.height, SKINS[SKV.view] ? SKV.view : skinMine(), 0, SKV.a); } catch (e) { gpuLog('skin view failed: ' + (e && e.message)); }
}

/* ---------- Outfits screen: animated preview (studio) ---------- */
/* Pose entity of preview soldier M (one per outfit): walks in place, weapon key aimed, on the preview's flat ground */
function skinLiveEnt(M, key) {
  if (!M.ent) {
    M.Jp = M.J.map((v) => v.clone());
    M.ent = { model: M, pos: new V3(), vel: new V3(), yaw: SKV.a, pitch: -0.05, crouchAmt: 0, sprinting: false, onGround: true, isPlayer: false, visible: false, target: null, lastShotT: -1e9, lastSeenT: -1e9, recoil: 0, throwT: 0, arms: { adsW: 1 } };
  }
  if (M.liveKey !== key) { const G = worldGunGeometry(key); M.grips = G.grips; M.kind = G.kind; M.liveKey = key; }
  // one weapon per mounted weapon, specific to the animated preview (passed from one outfit to another)
  const g = skinLiveGun(key); if (g.parent !== M.gun) { M.gun.clear(); M.gun.add(g); }
  return M.ent;
}
/* Air around the preview soldier (world, m/s): studio fan breeze (head-on, rippling) and the air of its walk in place (it
   advances at vel without moving: the air comes toward it at -vel, the cape flies behind it); simulated cloth of the preview (06gb-cloth.js), the same
   as in a match: turned by finger, the soldier drags its cape, which lags behind, spreads with momentum and carries on.
   The walk's air follows the soldier's direction with a lag (SK_WL, 1/s: a walker who turns changes direction only gradually); glued to it, it
   pressed the cape back against its back at the very moment the soldier turns */
const SK_FAN = new V3(), SK_WL = 1.2;
function skinCloth(M, C, d) {
  const sim = C.sim, e = M.ent;
  clothBones(M, C); if (!clothTargets(M, C)) return;
  if (!sim.live || sim.fresh) { sim.reset(); sim.normals(); sim.live = true; sim.acc = 0; C.wy = e.yaw; }
  SKV.ft += d; const t = SKV.ft, k = 0.8 + 0.35 * Math.sin(t * 0.7) + 0.25 * Math.sin(t * 1.9 + 1.3);
  C.wy += angDiff(C.wy, e.yaw) * (1 - Math.exp(-SK_WL * d)); const v = e.vel.length();
  SK_FAN.set(0.35 * k + Math.sin(C.wy) * v, 0, 1.1 * k + Math.cos(C.wy) * v);
  sim.acc = Math.min(sim.acc + d, CLOTH_H * 4);
  while (sim.acc >= CLOTH_H) { sim.step(CLOTH_H, SK_FAN, 4); sim.normals(); sim.acc -= CLOTH_H; }
  clothWrite(M, C);
}
/* Frame pose: walking in place at 2 m/s (clips from 06ac-loco.js), weapon aimed, with no random gaze or weight shift;
   motionless if motion is reduced */
function skinLivePose(M, key, d, move) {
  const e = skinLiveEnt(M, key), v = move ? 2 : 0;
  e.yaw = SKV.a; e.vel.set(-Math.sin(e.yaw) * v, 0, -Math.cos(e.yaw) * v);
  M.gyL = 0; M.gyR = 0; M.wtClk = 1e9; M.lkClk = 1e9; M.wtT = 0; M.lkT = 0; M.lkP = 0;
  poseSoldier(e, d); layoutSoldier(M, true);
  if (M.cloth) skinCloth(M, M.cloth, d);
}
/* Studio: gradient background (drawn separately, in image coordinates), lit floor and contact shadows, three lights and the sky */
const SKS = { scene: null, cam: null, bg: null, bgCam: null, floor: null, rim: null };
const SK_BG_FS = `uniform vec2 uRes; uniform vec3 uTint; varying vec2 vS;
void main() {
  vec2 p = vS - vec2(0.5, 0.6); p.x *= uRes.x / uRes.y;
  float d = length(p);
  vec3 col = mix(vec3(0.13, 0.14, 0.11), vec3(0.03, 0.034, 0.028), smoothstep(0.0, 0.9, d));
  col += uTint * 0.07 * smoothstep(0.75, 0.0, d);
  vec2 q = vS - 0.5; col *= 1.0 - 0.9 * dot(q, q);
  col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;
const SK_FLOOR_VS = `varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const SK_FLOOR_FS = `uniform vec4 uFeet; uniform vec2 uPel; uniform vec3 uTint; varying vec3 vW;
void main() {
  float r = length(vW.xz);
  float pool = smoothstep(1.7, 0.0, r);
  float ring = smoothstep(0.014, 0.0, abs(r - 0.92));
  float sh = 0.5 * smoothstep(0.5, 0.0, length((vW.xz - uPel) * vec2(1.0, 1.3)))
    + 0.45 * smoothstep(0.17, 0.02, length(vW.xz - uFeet.xy)) + 0.45 * smoothstep(0.17, 0.02, length(vW.xz - uFeet.zw));
  vec3 col = vec3(0.15, 0.16, 0.13) * (0.3 + 0.95 * pool) + uTint * 0.22 * ring * pool;
  col *= 1.0 - clamp(sh, 0.0, 0.8);
  gl_FragColor = vec4(col, smoothstep(2.3, 1.1, r));
}`;
function skinStudio() {
  if (SKS.scene) return SKS;
  const sc = new THREE.Scene();
  const key = new THREE.DirectionalLight(0xfff0dc, 2.5); key.position.set(-1.6, 2.6, -2.3); sc.add(key);
  const fill = new THREE.DirectionalLight(0xb4c6e6, 0.65); fill.position.set(2.3, 1.0, -1.3); sc.add(fill);
  SKS.rim = new THREE.DirectionalLight(0xffffff, 2.4); SKS.rim.position.set(0.9, 2.1, 2.7); sc.add(SKS.rim);
  sc.add(new THREE.HemisphereLight(0xdfe6f0, 0x1a1712, 0.35));
  const fm = new THREE.ShaderMaterial({ vertexShader: SK_FLOOR_VS, fragmentShader: SK_FLOOR_FS, transparent: true, depthWrite: false, toneMapped: false,
    uniforms: { uFeet: { value: new THREE.Vector4() }, uPel: { value: new THREE.Vector2() }, uTint: { value: new THREE.Color() } } });
  SKS.floor = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), fm); SKS.floor.rotation.x = -Math.PI / 2; SKS.floor.position.y = 0.002; SKS.floor.renderOrder = -1; sc.add(SKS.floor);
  SKS.scene = sc; SKS.cam = new THREE.PerspectiveCamera(VW_FOV, 1, 0.05, 30);
  const bm = new THREE.ShaderMaterial({ vertexShader: MBG_VS, fragmentShader: SK_BG_FS, depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: { uRes: { value: new THREE.Vector2() }, uTint: { value: new THREE.Color() } } });
  const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const bg = new THREE.Mesh(tri, bm); bg.frustumCulled = false;
  SKS.bg = new THREE.Scene(); SKS.bg.add(bg); SKS.bgCam = new THREE.Camera();
  return SKS;
}
/* studio tint: the green of the ally stripes (the preview shows the outfit as allies see it, the enemy view is only used in a match) */
const SK_TINT = new THREE.Color(0x8fe0a2);
const _skR = new THREE.Vector4(), _skS = new THREE.Vector4(), _skC = new THREE.Color();
/* Called by the frame loop right after the menu background (drew: the background has just been drawn, so the canvas is up to date elsewhere):
   poses the soldier for the time elapsed since its previous frame, then renders into the preview frame */
function skinLive(drew, dt) {
  SKV.acc += dt;
  if (!SKV.live || !drew || !SKV.host) return;
  try { skinLiveDraw(); } catch (e) { SKV.fail = true; gpuLog('skin live view failed: ' + (e && e.message)); } // the still image resumes (skinTick)
}
function skinLiveDraw() {
  const d = Math.min(SKV.acc, 0.1); SKV.acc = 0;
  const r0 = SKV.host.getBoundingClientRect(), cr = renderer.domElement.getBoundingClientRect(), si = $('skInfo');
  // a locked outfit's challenges cover the bottom of the preview (tall screens) or its right side (short screens, phone: a larger soldier):
  // the soldier is drawn in the part left free, whole (cape, legs, boots); on the side, the studio runs under the panel's fade
  const ib = si && !si.classList.contains('hidden') ? si.getBoundingClientRect() : null, side = !!ib && ib.left > r0.left + r0.width * 0.2;
  const cut = ib && !side && ib.height > 20 ? Math.max(0, Math.min(r0.height * 0.55, r0.bottom - ib.top - 18)) : 0;
  const cutX = side ? Math.max(0, Math.min(r0.width * 0.6, r0.right - ib.left - ib.width * 0.14)) : 0;
  const r = { left: r0.left, top: r0.top, width: r0.width - cutX, height: r0.height - cut, bottom: r0.bottom - cut };
  if (r.width < 20 || r.height < 20 || cr.width < 20 || r.bottom <= cr.top || r.top >= cr.bottom) return;
  const k = VIEW.w / cr.width, x = (r.left - cr.left + 1) * k, y = (cr.bottom - r.bottom + 1) * k, w = (r.width - 2) * k, h = (r.height - 2) * k; // (in the border)
  const move = mbgMotion(), skin = SKINS[SKV.view] ? SKV.view : skinMine(), M = skinLiveModel(skin), m = skinPvMat(skin), key = skinPvGunKey();
  // other outfit, or return to the screen (soldier put back in three-quarter view at once): its cloth restarts from rest, without taking the jump for momentum
  if (SKV.lv !== skin) { SKV.lv = skin; if (M.cloth) M.cloth.sim.live = false; }
  skinLivePose(M, key, d, move);
  skinTone(skin, 0, m.color); skinRelColor(0, m.userData.skU.tag.value);
  const S = skinStudio(), tint = SK_TINT, U = S.floor.material.uniforms, J = M.J;
  U.uFeet.value.set(J[J_FTL].x, J[J_FTL].z, J[J_FTR].x, J[J_FTR].z); U.uPel.value.set(J[J_PEL].x, J[J_PEL].z); U.uTint.value.copy(tint);
  S.bg.children[0].material.uniforms.uRes.value.set(w, h); S.bg.children[0].material.uniforms.uTint.value.copy(tint);
  S.rim.color.copy(_skC.setRGB(1, 1, 1).lerp(tint, 0.35));
  S.cam.aspect = w / h; S.cam.updateProjectionMatrix();
  const dist = 1.08 / Math.tan(THREE.MathUtils.degToRad(VW_FOV) / 2) * Math.max(1, 0.62 / (w / h));
  vwCamPlace(S.cam, Math.PI / 2, 0.05, dist, SK_AIM);
  const R = renderer, keep = { tm: R.toneMapping, ex: R.toneMappingExposure, oe: R.outputEncoding, ac: R.autoClear, st: R.getScissorTest() };
  R.getViewport(_skR); R.getScissor(_skS);
  S.scene.environment = envMap; S.scene.add(M.root); skinSkel(M);
  try {
    R.setRenderTarget(null); R.setViewport(x, y, w, h); R.setScissor(x, y, w, h); R.setScissorTest(true);
    R.autoClear = false; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1; R.outputEncoding = THREE.sRGBEncoding;
    R.render(S.bg, S.bgCam); R.clearDepth(); R.render(S.scene, S.cam);
  } finally {
    S.scene.remove(M.root);
    R.toneMapping = keep.tm; R.toneMappingExposure = keep.ex; R.outputEncoding = keep.oe; R.autoClear = keep.ac;
    R.setScissorTest(keep.st); R.setScissor(_skS); R.setViewport(_skR);
  }
  SKV.dirty = false;
}
