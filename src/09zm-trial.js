/* ==========================================================================
   STREAK TRIAL (development tool)
   The game opens with ?trial=<streak> (https://localhost:8080/?trial=drone): a solo match loads right away (the settings map, or
   &map=<id>), you deploy, and the streak being tried is in the first slot (key 4, first button on touch), always ready: one second after
   each use, it comes back. The player takes no damage, to try things in peace among the bots (except the mecha's overheating if it stays on board). Streaks: drone, uav, airStrike, emp, satellite,
   helicopter, mecha (or their catalog name, KSDEF). ?trial=patrol: a mecha patrols in front of the player, back and forth with a turn on the spot,
   its torso turned toward the player (trialMecha), to judge the walk.
   ?trial=series: all the streaks, as in a match (09zm-trial.js, trialSeries): an ordinary solo match against the bots (you take
   damage), and a small panel, "Streaks", at the top left: for each streak, Ready puts it in a slot, ready to call as
   if it had been earned (announcement included), and Enemy has an enemy bot call it (its announcements, its threat). On desktop, the mouse
   stays on the view: K opens and closes the panel, 1 to 7 make a streak ready, Shift and 1 to 7 have an enemy call it (with the panel open,
   the digits go only to it); Escape (pause) also frees the mouse for clicking.
   The code does nothing without ?trial=: TRIAL is empty, TRIAL_MECHA and TRIAL_ALL false for a player.
   ========================================================================== */
const TRIAL = (() => {
  const v = new URLSearchParams(location.search).get('trial'); if (!v) return '';
  const id = { drone: 'fpv', airStrike: 'air', helicopter: 'heli', satellite: 'sat' }[v] || v;
  return KSDEF[id] ? id : '';
})();
const TRIAL_MECHA = new URLSearchParams(location.search).get('trial') === 'patrol';
const TRIAL_ALL = ['series', 'all'].includes(new URLSearchParams(location.search).get('trial'));
const TRIAL_S = { t: 0, me: null, a: null, b: null, go: 1, wait: 0 };
/* Player streaks during the trial: the one being tried in the first slot (key 4), whatever its threshold, then two others */
function trialKs() { return [TRIAL].concat(ksFill([TRIAL]).filter((k) => k !== TRIAL)); }
/* On each frame of the match: the streak comes back one second after being used */
function trialTick(dt) {
  if (TRIAL_MECHA) { trialMecha(dt); return; }
  if (!PL.ent.alive || PL.ks[TRIAL] || KS.mode || PILOT.d) { TRIAL_S.t = 0; return; }
  TRIAL_S.t += dt; if (TRIAL_S.t < 1) return;
  TRIAL_S.t = 0; PL.ks[TRIAL] = true; updateStreakHud();
}
/* Mecha patrol: placed 5 m from the player in the clearest direction (two rays 0.9 m to either side, at hip height),
   it goes to the end, stops, turns around on the spot and comes back; its torso follows the player */
function trialMecha(dt) {
  const S = TRIAL_S, e = PL.ent;
  if (!S.me) {
    let best = 0, dir = null;
    for (let k = 0; k < 24; k++) {
      const a = k * Math.PI / 12, v = new V3(-Math.sin(a), 0, -Math.cos(a)), side = new V3(-v.z, 0, v.x);
      let t = 40; for (const o of [-0.9, 0, 0.9]) { const p = e.pos.clone().addScaledVector(side, o); const h = rayWorld(p.x, p.y + 1.2, p.z, v.x, 0, v.z, 40, 1); t = Math.min(t, h ? h.t : 40); }
      if (t > best) { best = t; dir = v; }
    }
    const a0 = e.pos.clone().addScaledVector(dir, 5); a0.y = groundHeight(a0.x, a0.z, e.pos.y + 0.6);
    S.a = a0; S.b = e.pos.clone().addScaledVector(dir, Math.max(9, Math.min(best - 2.5, 22))); S.go = 1; S.wait = 0;
    S.me = mechaSpawn(null, a0, Math.atan2(-dir.x, -dir.z)); S.me.hum = sfxMechaHum(a0);
  }
  const me = S.me, to = S.go ? S.b : S.a, dx = to.x - me.pos.x, dz = to.z - me.pos.z, d = hyp(dx, dz);
  if (S.wait > 0) { S.wait -= dt; me.want.set(0, 0, 0); if (S.wait <= 0) S.go = 1 - S.go; }
  else if (d < 0.6) { S.wait = 1.6; me.want.set(0, 0, 0); }
  else {
    me.wantYaw = Math.atan2(-dx, -dz);
    const turned = Math.abs(angDiff(me.yaw, me.wantYaw)) < 0.5; // it first turns on the spot, then advances
    me.want.set(dx / d, 0, dz / d).multiplyScalar(turned ? MECHA_W.speed * Math.min(1, d / 2) : 0);
  }
  const c = e.pos, ox = c.x - me.pos.x, oz = c.z - me.pos.z;
  me.aimYaw = Math.atan2(-ox, -oz); me.aimPitch = clamp(Math.atan2(c.y + 1.2 - (me.pos.y + 2.0), hyp(ox, oz)), -0.5, 0.4);
}
/* Once the game is ready (main menu displayed): load the solo match, then the deploy screen (one click: the mouse is captured) */
function trialStart() {
  if (!GPUX.booted || MATCH.state !== 'menu' || UI.busy) { setTimeout(trialStart, 300); return; }
  if (TRIAL_ALL) trialSeries();
  const mapKey = new URLSearchParams(location.search).get('map');
  if (mapKey && MAPS.some((m) => m.id === mapKey)) Settings.map = mapKey;
  menuLaunch({ online: false, map: Settings.map, deploy: () => startMatch() });
}
/* ?trial=series: the streaks panel (above the pause, so it can be used with the mouse) */
function trialSeries() {
  if ($('esRoot')) return;
  const el = document.createElement('div'); el.id = 'esRoot';
  const ids = ksSort(KS_IDS);
  el.innerHTML = `<button id="esTog" class="btn" type="button">${esc(_t('Killstreaks'))}<kbd>K</kbd></button><div id="esList"><p class="es-kb">${esc(_t('Keys 1 to 7 ready, Shift and 1 to 7 enemy'))}</p>${ids.map((id, i) =>
    `<div class="es-row"><kbd>${i + 1}</kbd>${ksSvg(id)}<b>${esc(KSDEF[id].name)}</b><em>${KSDEF[id].n}</em><button class="btn" type="button" data-me="${id}">${esc(_t('Ready'))}</button><button class="btn" type="button" data-foe="${id}">${esc(_t('Enemy'))}</button></div>`).join('')}</div>`;
  document.body.appendChild(el);
  $('esTog').addEventListener('click', () => el.classList.toggle('open'));
  // on keyboard, with the mouse staying on the view: K, then 1 to 7 (Shift: enemy); before the game keys (capture phase)
  addEventListener('keydown', (e) => {
    if (MATCH.state !== 'playing' && MATCH.state !== 'paused') return;
    if (e.code === 'KeyK' && !e.repeat) { el.classList.toggle('open'); e.preventDefault(); e.stopImmediatePropagation(); return; }
    const m = /^Digit([1-7])$/.exec(e.code); if (!m || !el.classList.contains('open')) return;
    e.preventDefault(); e.stopImmediatePropagation(); if (e.repeat) return;
    const id = ids[+m[1] - 1]; if (e.shiftKey) trialFoe(id); else trialGrant(id);
  }, true);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || MATCH.state === 'menu') return;
    if (b.dataset.me) trialGrant(b.dataset.me); else if (b.dataset.foe) trialFoe(b.dataset.foe);
  });
}
/* The streak made ready, as if earned: in a slot (in place of the one with the same threshold, or of the oldest ready one if all are), its
   announcement, the key that calls it */
function trialGrant(id) {
  if (!PL.ent.alive) return;
  const ready = PL.ksSel.filter((k) => PL.ks[k] && k !== id && KSDEF[k].n !== KSDEF[id].n); // those already ready keep their place (three slots)
  PL.ksSel = ksFill([id].concat(ready.slice(-2), PL.ksSel)); PL.ks[id] = true;
  const g = actGlyph(ksAct(id)), name = KSDEF[id].name;
  sfxAnnounce(id + '_ready', 'st_ready'); hudMsg(g ? _t('{0} ready: {1}', name, g) : _t('{0} ready', name), 'xp', 3, !!g);
  updateStreakHud();
}
/* A living enemy bot calls it (at random) */
function trialFoe(id) {
  const foes = entities.filter((e) => !e.isPlayer && !e.isRemote && e.alive && !e.off && !allied(e, PL.ent));
  if (foes.length) KSDEF[id].bot(pick(foes));
}
if (TRIAL || TRIAL_MECHA || TRIAL_ALL) setTimeout(trialStart, 500);
