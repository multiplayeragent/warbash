/* ==========================================================================
   KILLCAM
   Continuous recording (30 Hz, 5 s) of the joints, weapons and gazes of
   all soldiers, and of shots and explosions. On the player's death, replay
   from the killer's shoulder, slow motion on the fatal blow, then the
   victim's fall. Space, Enter or click: skip and respawn immediately.
   Online, the match doesn't stop for a replay: the death killcam plays while the world continues ("playing" state;
   KC.live: the recording is frozen for the duration of the replay then restarts from zero); the final killcam, though, freezes the world as in solo.
   The buffer is indexed by a stable slot per soldier (e.kcI): remote players, created and removed mid-match, take one
   from KC_EXTRA spare slots.
   Remote killer (online): the buffer keeps what the screen showed of them, a gaze smoothed toward the last received state (updateRemote, 09c-net.js),
   which advances in jerks at each state (15 per second); seen through their eyes, the replay stuttered (owner feedback). The killer's view is
   then rebuilt from the received states themselves, timestamped by their author's clock (netTrack): Hermite curve between two states, the sent
   velocity as the movement tangent (kcNetView). The replay is in the past, the next state is already there: nothing is guessed, and neither the network
   nor the live match loses anything. Between two states too far apart, or from one life to another, the recorded view takes over.
   ========================================================================== */
const KC_EXTRA = 24, KC_HZ = 30, KC_LEN = 5.2, KC_N = Math.ceil(KC_HZ * KC_LEN) + 4, KC_STRIDE = 69; // 69 numbers per soldier: 64 the share of the drawn knife (PL.knifeHold, the player only), 65 to 67 the soldier's position (kcNetView), 68 their view (KC_VIEW)
/* The soldier's view at the recorded instant: on foot (their arms and weapon), aboard their mecha (the cabin, without the soldier: owner feedback,
   the arms and weapon showed over the cabin), or with nothing in front of the eyes (drone, a streak's view) */
const KC_VIEW = { onFoot: 0, mecha: 1, nothing: 2 };
const KC = {
  buf: null, times: new Float64Array(KC_N), head: 0, count: 0, lastRec: -9, events: [],
  pending: null, active: false, t: 0, t0: 0, tEnd: 0, phase: '', post: 0, killer: null, body: null, bodyEnt: null,
  cam: new V3(), look: new V3(), evIdx: 0, info: null, live: false, free: [], cap: 0,
  knifeT: 0, knifeNew: false, knifeSnd: false, knifeUp: false, // killer's knife stab being replayed
};
function kcInit() {
  KC.cap = entities.length + KC_EXTRA;
  KC.buf = []; for (let i = 0; i < KC_N; i++) KC.buf.push(new Float32Array(KC.cap * KC_STRIDE));
  entities.forEach((e, i) => { e.kcI = i; });
  KC.free = []; for (let i = KC.cap - 1; i >= entities.length; i--) KC.free.push(i);
}
/* Slot of a remote soldier (none while a replay is in progress: a freed slot would only be reused afterward) */
function kcAssign(e) {
  if (e.kcI !== undefined || KC.active || !KC.free.length) return;
  e.kcI = KC.free.pop();
  for (const b of KC.buf) { b[e.kcI * KC_STRIDE + 54] = 0; b[e.kcI * KC_STRIDE + 55] = 0; } // nothing recorded for them before their arrival
}
function kcRelease(e) { if (e.kcI !== undefined && e.kcI >= KC.cap - KC_EXTRA) KC.free.push(e.kcI); e.kcI = undefined; }
function kcReset() { KC.head = 0; KC.count = 0; KC.events.length = 0; KC.pending = null; KC.active = false; KC.lastRec = -9; }
function kcRecord() {
  const now = MATCH.time;
  if (now - KC.lastRec < 1 / KC_HZ - 1e-4) return;
  KC.lastRec = now;
  const b = KC.buf[KC.head]; KC.times[KC.head] = now;
  for (let k = 0; k < entities.length; k++) {
    const e = entities[k], S = e.model;
    if (e.kcI === undefined) { kcAssign(e); if (e.kcI === undefined) continue; } // a remote that arrived during a replay takes their slot here
    const o = e.kcI * KC_STRIDE;
    if (!S || !S.gun) { b[o + 55] = 0; continue; }
    for (let j = 0; j < 15; j++) { b[o + j * 3] = S.J[j].x; b[o + j * 3 + 1] = S.J[j].y - (S.sink || 0); b[o + j * 3 + 2] = S.J[j].z; }
    const g = S.gun; b[o + 45] = g.position.x; b[o + 46] = g.position.y; b[o + 47] = g.position.z;
    b[o + 48] = g.quaternion.x; b[o + 49] = g.quaternion.y; b[o + 50] = g.quaternion.z; b[o + 51] = g.quaternion.w;
    b[o + 52] = e.yaw; b[o + 53] = e.pitch; b[o + 54] = e.alive ? 1 : 0;
    b[o + 55] = e.isPlayer ? (e.alive ? 1 : 0) : (S.root.visible ? 1 : 0);
    if (e.isPlayer) { b[o + 56] = camera.position.x; b[o + 57] = camera.position.y; b[o + 58] = camera.position.z; b[o + 52] = camera.rotation.y; b[o + 53] = camera.rotation.x; }
    else { entEye(e, _kh); b[o + 56] = _kh.x; b[o + 57] = _kh.y; b[o + 58] = _kh.z; }
    b[o + 59] = e.arms ? e.arms.adsW : 0; b[o + 60] = e.sprinting ? 1 : 0; b[o + 61] = e.crouch ? 1 : 0;
    b[o + 62] = hyp(e.vel.x, e.vel.z); b[o + 63] = e.onGround === false ? 0 : 1;
    b[o + 64] = e.isPlayer ? PL.knifeHold : 0;
    b[o + 65] = e.pos.x; b[o + 66] = e.pos.y; b[o + 67] = e.pos.z;
    b[o + 68] = e.inMecha ? KC_VIEW.mecha : e.isPlayer && !VM.root.visible ? KC_VIEW.nothing : KC_VIEW.onFoot;
  }
  KC.head = (KC.head + 1) % KC_N; KC.count = Math.min(KC_N, KC.count + 1);
  while (KC.events.length && KC.events[0].t < now - KC_LEN - 0.5) KC.events.shift();
}
function kcEvent(type, data) { if (MATCH.state !== 'playing' || (KC.active && KC.live)) return; data.type = type; data.t = MATCH.time; KC.events.push(data); if (KC.events.length > 600) KC.events.shift(); }

/* index of a snapshot in chronological order (0 = oldest) */
function kcSlot(i) { return (KC.head - KC.count + i + KC_N) % KC_N; }
function kcSample(t, fn) {
  let lo = 0, hi = KC.count - 1;
  if (KC.count < 2) return false;
  if (t <= KC.times[kcSlot(0)]) { fn(KC.buf[kcSlot(0)], KC.buf[kcSlot(0)], 0); return true; }
  if (t >= KC.times[kcSlot(hi)]) { fn(KC.buf[kcSlot(hi)], KC.buf[kcSlot(hi)], 0); return true; }
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (KC.times[kcSlot(m)] <= t) lo = m; else hi = m; }
  const a = kcSlot(lo), b = kcSlot(hi), ta = KC.times[a], tb = KC.times[b];
  fn(KC.buf[a], KC.buf[b], tb > ta ? (t - ta) / (tb - ta) : 0);
  return true;
}
const _kq1 = new THREE.Quaternion(), _kq2 = new THREE.Quaternion();
function kcApplyPose(model, A, Bf, u, o) {
  for (let j = 0; j < 15; j++) model.J[j].set(lerp(A[o + j * 3], Bf[o + j * 3], u), lerp(A[o + j * 3 + 1], Bf[o + j * 3 + 1], u), lerp(A[o + j * 3 + 2], Bf[o + j * 3 + 2], u));
  model.sink = 0;
  // the weapon first: the soldier's hands rest on it
  model.gun.position.set(lerp(A[o + 45], Bf[o + 45], u), lerp(A[o + 46], Bf[o + 46], u), lerp(A[o + 47], Bf[o + 47], u));
  _kq1.set(A[o + 48], A[o + 49], A[o + 50], A[o + 51]); _kq2.set(Bf[o + 48], Bf[o + 49], Bf[o + 50], Bf[o + 51]);
  model.gun.quaternion.slerpQuaternions(_kq1, _kq2, u);
  // a bot's weapon leaves its body on death (dropKilledWeapon, 08c-pickups.js) and only comes back on respawn: replayed, it is
  // in hand as long as the bot is alive at the replayed instant (otherwise, the final killcam's victim fell empty-handed)
  if (model !== KC.body) model.gun.visible = A[o + 54] > 0.5 && Bf[o + 54] > 0.5; // (alive at both blended instants: never on a falling body)
  layoutSoldier(model, A[o + 54] > 0.5);
}
/* View of a remote killer at instant t, from their received states (netTrack): KCV { yaw, pitch, x, y, z } (soldier's position), or null outside the track
   (no state after t, two states more than 0.35 s apart, a death or respawn between the two) */
const KCV = { yaw: 0, pitch: 0, x: 0, y: 0, z: 0 };
function kcHermite(p1, p2, m1, m2, h, u) {
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p1 + (u3 - 2 * u2 + u) * h * m1 + (-2 * u3 + 3 * u2) * p2 + (u3 - u2) * h * m2;
}
function kcNetView(e, t) {
  const H = e.isRemote && e.net ? e.net.hist : null;
  if (!H || H.length < 2 || t < H[0].t || t >= H[H.length - 1].t) return null;
  let lo = 0, hi = H.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (H[m].t <= t) lo = m; else hi = m; }
  const a = H[lo], b = H[hi], h = b.t - a.t;
  if (h <= 1e-4 || h > 0.35 || !a.alive || !b.alive || hyp(b.x - a.x, b.z - a.z) > 4) return null;
  const p0 = lo > 0 && H[lo - 1].alive && a.t - H[lo - 1].t <= 0.35 ? H[lo - 1] : a, p3 = hi + 1 < H.length && H[hi + 1].alive && H[hi + 1].t - b.t <= 0.35 ? H[hi + 1] : b;
  const u = (t - a.t) / h;
  // gaze: angles unwrapped around the first state, Catmull-Rom tangents (slope between neighboring states)
  const ya = a.yaw, yb = ya + angDiff(ya, b.yaw), y0 = ya + angDiff(ya, p0.yaw), y3 = yb + angDiff(yb, p3.yaw);
  const tan = (v0, v2, t0, t2) => (t2 - t0 > 1e-4 ? (v2 - v0) / (t2 - t0) : 0);
  KCV.yaw = kcHermite(ya, yb, tan(y0, yb, p0.t, b.t), tan(ya, y3, a.t, p3.t), h, u);
  KCV.pitch = clamp(kcHermite(a.pitch, b.pitch, tan(p0.pitch, b.pitch, p0.t, b.t), tan(a.pitch, p3.pitch, a.t, p3.t), h, u), -1.5, 1.5);
  // movement: the sent velocity serves as the tangent on the ground, the height follows the neighboring states
  KCV.x = kcHermite(a.x, b.x, a.vx, b.vx, h, u); KCV.z = kcHermite(a.z, b.z, a.vz, b.vz, h, u);
  KCV.y = kcHermite(a.y, b.y, tan(p0.y, b.y, p0.t, b.t), tan(a.y, p3.y, a.t, p3.t), h, u);
  return KCV;
}
/* Replayed view (KC_VIEW): the soldier's arms and weapon, the mecha's cabin (its cross at the center, without the alarm), or nothing; outside a replay
   (v absent), the player's real state comes back */
function kcView(v) {
  const C = MECHA_P.cock, mecha = v === undefined ? !!MECHA_P.me : v === KC_VIEW.mecha;
  if (v !== undefined) VM.root.visible = v === KC_VIEW.onFoot;
  if (C) { C.root.visible = C.hud.visible = mecha; if (v !== undefined) C.alarm.visible = false; }
}
/* End of a replay: no more knife in hand in the view, no blow in progress */
function kcKnifeEnd() { KC.knifeT = 0; KC.knifeUp = false; if (VM.knifeRig) VM.knifeRig.visible = false; }
/* After a replay: each bot gets back the weapon of their real state (in hand if alive, on the ground if dead) */
function kcRestoreGuns() { for (const e of entities) if (e.model && !e.isPlayer && e.model.gun) e.model.gun.visible = !!e.alive; }

/* ---------- Flow ---------- */
function kcDef(k) { return k.isPlayer ? curW().def : k.weapon; }
/* Killer's weapon at the start of the replay: the one from before their first recorded weapon change after that start (from), otherwise their current
   weapon. The current weapon alone isn't enough: taken just after the kill (change, picked-up weapon), it appeared in the
   final killcam, with the previous weapon's shots. A change in progress at the start of the replay finishes within it (KC.equipAt). */
function kcStartWeapon(k, t0) {
  KC.equipAt = -1;
  for (const ev of KC.events) {
    if (ev.type !== 'vma' || ev.name !== 'switch' || ev.sid !== k.kcI || ev.t + 0.24 <= t0) continue;
    if (ev.t < t0) { KC.equipAt = ev.t + 0.24; KC.equipDef = (ev.data.to && weaponDefByKey(ev.data.to)) || kcDef(k); }
    return (ev.data.from && weaponDefByKey(ev.data.from)) || kcDef(k);
  }
  return kcDef(k);
}
/* opts : { killer, victim, tEnd, final, info } */
function startKillcam(opts) {
  const k = opts && opts.killer;
  if (!k || !k.model || k.kcI === undefined || PL.ent.kcI === undefined || KC.count < 10) return false;
  KC.pending = null;
  KC.killer = k; KC.killerIdx = k.kcI; KC.victim = opts.victim; KC.final = !!opts.final;
  KC.live = MATCH.online && !KC.final; // online, only the final killcam freezes the world
  KC.tEnd = opts.tEnd; KC.t0 = Math.max(KC.times[kcSlot(0)], KC.tEnd - 4.2); KC.t = KC.t0; KC.post = 0; KC.phase = 'replay';
  KC.tLast = KC.times[kcSlot(KC.count - 1)];
  KC.evIdx = 0; while (KC.evIdx < KC.events.length && KC.events[KC.evIdx].t < KC.t0) KC.evIdx++;
  KC.active = true; if (!KC.live) MATCH.state = 'killcam';
  if (KC.body.gunKey !== curW().def.key) setSoldierGun(KC.body, curW().def.key);
  KC.body.root.visible = false; KC.body.rag = null;
  if (PL.ent.model) PL.ent.model.root.visible = false;
  soldierLook(KC.body, skinOf(PL.ent), 0); // the player's body (victim): their outfit of the moment
  vmSetLook(skinOf(k), skinRel(k)); // first-person arms: killer's outfit, in dark (an enemy; in deathmatch, everyone)
  vmEquip(kcStartWeapon(k, KC.t0)); VM.action = null; VM.lower = 0; VM.lowerTarget = 0; VM.ads = 0; VM.root.visible = true; VM.holder.visible = true;
  vmClearHeld(); // (the player may watch the replay of a death that happened during a throw: nothing is left in hand)
  KC.adsW = 0; KC.lastShot = -9; KC.yaw = null; KC.prevYaw = null; kcKnifeEnd();
  kcSample(KC.t0, (A, Bf, u) => { const o = KC.killerIdx * KC_STRIDE; if (lerp(A[o + 64], Bf[o + 64], u) > 0.5) { KC.knifeUp = true; VM.lower = 1; VM.lowerTarget = 1; } }); // the killer already had the knife in hand: the weapon is already lowered
  $('death').classList.remove('show'); clearHitmarker(); $('hud').classList.remove('hidden'); $('hud').classList.add('kcmode'); $('killcam').classList.add('show');
  laneSuspend(); // a corridor announcement (level up, unlock) will resume after the replay (09s-rankup.js)
  $('kcTitle').textContent = KC.final ? _t('Final killcam') : _t('Killcam');
  KC.mode = ''; kcPrompt();
  $('kcInfo').innerHTML = opts.info || '';
  camera.fov = Settings.fov; camera.updateProjectionMatrix(); onResizeFx();
  sfxKs('killcam');
  return true;
}
/* Prompt to skip the replay: the key or button of the input mode (nothing but a touch on touch screens); rewritten when the mode changes */
function kcPrompt() {
  const mode = inputMode(); if (mode === KC.mode) return; KC.mode = mode;
  const f = KC.final, g = actGlyph('confirm'), sp = keyGlyph(_t('Space')), cl = actGlyph('fire');
  const h = mode === 'touch' ? esc(f ? _t('Tap: skip to the results') : _t('Tap: skip and respawn'))
    : mode === 'pad' ? (f ? _t('{0} Skip to results', g) : _t('{0} Skip and respawn', g))
    : f ? _t('{0} or {1} Skip to results', sp, cl) : _t('{0} or {1} Skip and respawn', sp, cl);
  hudHtml($('kcSkip'), h);
}
function endKillcam() {
  KC.active = false; KC.phase = ''; kcKnifeEnd();
  $('killcam').classList.remove('show'); hudCls($('killcam'), 'slow', false); clearHitmarker(); $('hud').classList.remove('kcmode'); $('scope').classList.remove('on');
  KC.body.root.visible = false; KC.body.rag = null;
  vmSetLook(skinOf(PL.ent), 0); kcView();
  kcRestoreGuns(); for (const e of entities) if (e.model && !e.isPlayer) animSoldier(e, 0);
  camera.fov = Settings.fov; camera.updateProjectionMatrix(); onResizeFx();
  if (KC.final) { MATCH.state = 'playing'; endMatch(); return; }
  clearHitmarker(); $('hud').classList.remove('hidden');
  if (KC.live) { KC.head = 0; KC.count = 0; KC.events.length = 0; KC.lastRec = -9; } // the recording was frozen: it restarts from zero (no gap in the buffer)
  else MATCH.state = 'playing';
  respawnPlayer();
  VM.root.visible = true;
  lanePump(); // an announcement held during the replay goes through now
}
/* The match is decided during a replay (online): we cut it off without respawning, the result announcement takes over */
function kcAbort() {
  if (!KC.active) return;
  KC.active = false; KC.phase = ''; kcKnifeEnd();
  $('killcam').classList.remove('show'); hudCls($('killcam'), 'slow', false); clearHitmarker(); $('hud').classList.remove('kcmode'); $('scope').classList.remove('on');
  KC.body.root.visible = false; KC.body.rag = null;
  vmSetLook(skinOf(PL.ent), 0); kcView(); VM.root.visible = PL.ent.alive && !MECHA_P.me && !PILOT.d;
  kcRestoreGuns(); for (const e of entities) if (e.model && !e.isPlayer) animSoldier(e, 0);
  camera.fov = Settings.fov; camera.updateProjectionMatrix(); onResizeFx(); // the buffer stays intact (frozen during the replay): the final killcam can still use it
}
function kcSkip() {
  if (KC.active) { endKillcam(); return; }
  if (MATCH.state === 'playing' && !PL.ent.alive && PL.deathT > 0.35 && !MATCH.finalPending) { KC.pending = null; respawnPlayer(); }
}

const _kf = new V3(), _kr = new V3(), _kd = new V3(), _kh = new V3();
function updateKillcam(dt) {
  const K = KC.killer, ki = KC.killerIdx, pi = PL.ent.kcI, V = KC.victim, playerVictim = V === PL.ent;
  const toEnd = KC.tEnd - KC.t;
  // slow motion reserved for the final killcam; the others run at real speed
  const slow = KC.final && KC.phase === 'replay' && toEnd < 0.8;
  const speed = slow ? 0.3 : KC.final && KC.phase === 'post' ? 0.6 : 1;
  const sdt = dt * speed;
  const postLen = playerVictim ? 2.0 : Math.min(1.5, Math.max(0.3, KC.tLast - KC.tEnd));
  KC.t += sdt;
  while (KC.evIdx < KC.events.length && KC.events[KC.evIdx].t <= KC.t) {
    const ev = KC.events[KC.evIdx++];
    if (ev.type === 'shot') {
      // recoil and shell casing of the weapon shown at this instant of the replay (not the killer's current weapon)
      if (ev.sid === ki) { const d = VM.curDef; vmKick(d, KC.adsW > 0.5); if (!d.bolt && !d.pump) vmShell(d); sfxGun(ev.kind, null); flashLight(camera.position, 3, 8, 0.05); KC.lastShot = ev.t; }
      else { const mute = ev.kind.endsWith('_s'); muzzleWorldFx(ev.m, ev.d, mute); if (!mute) flashLight(ev.m, 2.5, 7, 0.05); sfxGun(ev.kind, ev.m); }
    } else if (ev.type === 'knife') {
      if (ev.sid === ki) { KC.knifeT = KNIFE_DUR; KC.knifeNew = ev.neu; KC.knifeSnd = false; } // the shot fires: the same motion as in the match
    } else if (ev.type === 'melee') {
      if (ev.sid === ki) sfxMelee(); // the knife hits: the sound, and blood where it strikes
      bloodFx(ev.p, ev.dir, false);
    } else if (ev.type === 'vma') {
      if (ev.sid === ki) {
        if (ev.name === 'switch') { VM.lowerTarget = 1; KC.equipAt = ev.t + 0.24; KC.equipDef = weaponDefByKey(ev.data.to) || WEAPONS.m4; }
        else vmStartAction(ev.name, ev.dur, { ...ev.data });
      }
    } else if (ev.type === 'ray') { if (ev.tr) FX.tracers.add(ev.a, ev.b); if (ev.flesh) bloodFx(ev.b, ev.dir, ev.head); else FX.smoke.spawn(ev.b.x, ev.b.y, ev.b.z, 0, 0.4, 0, 0.8, 0.15, 0.7, 0.6, 0.56, 0.5, 0.45, 0, 0, 1.5); }
    else if (ev.type === 'boom') { explosionFx(ev.p, 1, true); sfxExplosion(ev.p); }
    else if (ev.type === 'hit') { if (ev.sid === ki) { showHitmarker(ev.head, ev.kill); sfxHit(ev.head, ev.kill, 1); } } // the killer's hit cross, with its sound
  }
  if (KC.phase === 'replay' && KC.t >= KC.tEnd) {
    KC.phase = 'post'; KC.post = 0;
    if (playerVictim) {
      // the victim (you): ragdoll launched from the last two snapshots
      kcSample(KC.tEnd, (A, Bf, u) => kcApplyPose(KC.body, A, Bf, u, pi * KC_STRIDE));
      kcSample(KC.tEnd - 1 / KC_HZ, (A, Bf, u) => { for (let j = 0; j < 15; j++) KC.body.Jp[j].set(lerp(A[pi * KC_STRIDE + j * 3], Bf[pi * KC_STRIDE + j * 3], u), lerp(A[pi * KC_STRIDE + j * 3 + 1], Bf[pi * KC_STRIDE + j * 3 + 1], u), lerp(A[pi * KC_STRIDE + j * 3 + 2], Bf[pi * KC_STRIDE + j * 3 + 2], u)); });
      KC.bodyEnt.lastForce = PL.ent.lastForce || { dir: new V3().subVectors(PL.ent.pos, K.pos).normalize(), mag: 4, lift: 1.5, part: 'body' };
      KC.bodyEnt.yaw = PL.yaw; KC.bodyEnt.pos.copy(PL.ent.pos);
      KC.body.pdt = 1 / KC_HZ; // the two snapshots are one recording sample apart
      startRagdoll(KC.bodyEnt); KC.body.root.visible = true;
    }
    sfxDown();
  }
  if (KC.phase === 'post') {
    KC.post += sdt;
    if (playerVictim) { stepRagdoll(KC.bodyEnt, sdt); KC.body.sink = 0; layoutSoldier(KC.body, false); }
    if (KC.post > postLen + (KC.final ? 0.6 : 0.2)) { endKillcam(); return; }
  }
  // poses at the replayed instant (after the blow: frozen for you, recorded for a bot)
  const tSample = playerVictim ? Math.min(KC.t, KC.tEnd) : Math.min(KC.t, KC.tLast);
  kcSample(tSample, (A, Bf, u) => {
    for (let k = 0; k < entities.length; k++) {
      const e = entities[k], o = e.kcI * KC_STRIDE;
      if (e.kcI === undefined) { if (e.model && !e.isPlayer) e.model.root.visible = false; continue; } // arrived during the replay: absent from the recording
      if (e.isPlayer) {
        if (e.kcI === ki) { KC.body.root.visible = false; continue; }
        if (!(playerVictim && KC.phase === 'post')) { KC.body.root.visible = A[o + 55] > 0.5 || Bf[o + 55] > 0.5; if (KC.body.root.visible) kcApplyPose(KC.body, A, Bf, u, o); }
        continue;
      }
      if (!e.model) continue;
      const vis = e.kcI !== ki && (A[o + 55] > 0.5 || Bf[o + 55] > 0.5);
      e.model.root.visible = vis;
      if (vis) kcApplyPose(e.model, A, Bf, u, o);
    }
    // killer's real view: eye, gaze (recoil included) and weapon state as recorded
    const o = ki * KC_STRIDE;
    let yaw = lerp(A[o + 52], A[o + 52] + angDiff(A[o + 52], Bf[o + 52]), u), pitch = lerp(A[o + 53], Bf[o + 53], u);
    _kh.set(lerp(A[o + 56], Bf[o + 56], u), lerp(A[o + 57], Bf[o + 57], u), lerp(A[o + 58], Bf[o + 58], u));
    // remote killer: their gaze and position from their received states (the eye keeps its height above the soldier, crouching included)
    const nv = kcNetView(K, tSample);
    if (nv) { yaw = nv.yaw; pitch = nv.pitch; _kh.x += nv.x - lerp(A[o + 65], Bf[o + 65], u); _kh.y += nv.y - lerp(A[o + 66], Bf[o + 66], u); _kh.z += nv.z - lerp(A[o + 67], Bf[o + 67], u); }
    if (KC.phase === 'post') {
      const tgt = playerVictim ? KC.body.J[J_PEL] : V.model.J[J_PEL];
      const dx = tgt.x - _kh.x, dz = tgt.z - _kh.z, dy = tgt.y - _kh.y, w = smoothstep(0, 0.7, KC.post);
      yaw = yaw + angDiff(yaw, Math.atan2(-dx, -dz)) * w; pitch = lerp(pitch, Math.atan2(dy, hyp(dx, dz)), w);
    }
    camera.position.copy(_kh); camera.rotation.set(pitch, yaw, 0);
    kcView(A[o + 68]);
    // weapon sway computed as for the player's mouse
    if (KC.prevYaw !== null) { VM.swayTX += -angDiff(KC.prevYaw, yaw) * 0.286; VM.swayTY += -(pitch - KC.prevPitch) * 0.286; }
    KC.prevYaw = yaw; KC.prevPitch = pitch;
    if (KC.equipAt > 0 && KC.t >= KC.equipAt) { vmEquip(KC.equipDef); VM.lowerTarget = 0; KC.equipAt = -1; }
    const d = VM.curDef, adsW = lerp(A[o + 59], Bf[o + 59], u), kh = lerp(A[o + 64], Bf[o + 64], u);
    // the killer's knife: in hand (drawn) or a blow in progress, the weapon lowers and the knife hand replaces it
    if (KC.knifeT > 0) { KC.knifeT -= sdt; if (!KC.knifeSnd && KC.knifeT < KNIFE_DUR * 0.8) { KC.knifeSnd = true; sfxMech('knife'); } }
    const knifeOn = KC.knifeT > 0 || kh > 0.01;
    if (knifeOn !== KC.knifeUp) { KC.knifeUp = knifeOn; VM.lowerTarget = knifeOn ? 1 : 0; }
    updateViewmodel(sdt, { ads: adsW > 0.5, sprint: A[o + 60] > 0.5, speed: lerp(A[o + 62], Bf[o + 62], u), grounded: A[o + 63] > 0.5, crouch: A[o + 61] > 0.5, empty: false });
    KC.adsW = VM.ads;
    updateRigs(sdt, { knifeT: KC.knifeT, knifeNew: KC.knifeNew, knifeHold: kh, nadeState: null, nadeT: 0, cookT: 0, sprint: VM.sprint, speed: lerp(A[o + 62], Bf[o + 62], u) });
    const fovT = Settings.fov * lerp(1, d.adsFov, smoothstep(0, 1, VM.ads));
    if (Math.abs(camera.fov - fovT) > 0.05) { camera.fov = damp(camera.fov, fovT, 18, dt); camera.updateProjectionMatrix(); onResizeFx(); }
    const vf = vmFovAt(54, VM.ads); if (Math.abs(vmCamera.fov - vf) > 0.01) { vmCamera.fov = vf; vmCamera.updateProjectionMatrix(); }
    $('scope').classList.toggle('on', !!(d.scope && VM.ads > 0.92));
  });
  hudCls($('killcam'), 'slow', slow);
  kcPrompt();
}
