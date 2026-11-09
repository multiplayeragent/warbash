/* ==========================================================================
   MATCH, HUD, MENU, LOOP
   ========================================================================== */
const MATCH = { state: 'loading', mode: 'tdm', time: 0, timeLeft: 600, score: [0, 0], limit: 75, uav: [0, 0], uavPing: [null, null], sat: [0, 0], emp: [0, 0], events: [], winner: -1 };
const $ = (id) => document.getElementById(id);
const LOCK = { rawNo: false, fallback: false, pending: false, manual: false, fails: 0, inputT: -1e9, resumeT: -1e9, escArmed: false, quiet: false, scriptExit: false, kbLock: false, fsPending: null };
function pointerActive() { return document.pointerLockElement === canvas || LOCK.fallback || TOUCH.on || PAD.drive; } // touch or gamepad, no mouse capture: always active

/* ---------- Damage and kills ---------- */
function applyDamage(victim, dmg, attacker, weapon, head, dir, srcPos, life) { // life: shooter's spawn when the grenade or strike was thrown (streakKill)
  if (!victim.alive || !(MATCH.state === 'playing' || MATCH.state === 'paused')) return;
  if (victim.inMecha) return; // aboard their mecha: hits go to the armor (rayMechas, mechaBlast)
  if ((TRIAL || TRIAL_MECHA) && victim.isPlayer && !(attacker === victim && weapon === NET_WSPECIAL.mecha)) return; // streak trial (?trial=, 09zm-trial.js): the player takes nothing (except their mecha exploding with them aboard, which is also tested)
  if (MATCH.online && attacker && attacker !== victim && allied(attacker, victim)) return; // no friendly fire (in deathmatch, nobody is an ally)
  if (victim.protT > 0) return; // respawn protection (deathmatch, domination)
  // remote victim: the hit is sent to them, they apply the damage themselves
  if (victim.isRemote) {
    if (attacker && netIsLocal(attacker)) {
      // predicted death: a lethal hit, based on the victim's health minus my hits still in flight (netPredHealth), shows up immediately
      // on the shooter's side (netPredictKill); shaky link (netLinkBad): the hit is sent, but no cross or predicted death, which would announce a
      // kill that might never come
      const sure = attacker === PL.ent && !netLinkBad(), lethal = sure && !victim.pred && dmg >= netPredHealth(victim) + 2;
      netSendHit(victim, dmg, weapon, head, dir, attacker); victim.dmgBy.set(attacker, MATCH.time);
      if (lethal) netPredictKill(victim, head, dir);
      if (sure) hitFeedback(head, lethal);
      kcEvent('hit', { sid: attacker.kcI, head: !!head, kill: lethal }); // (the hit cross, replayed in the killcam)
    }
    return;
  }
  victim.health -= dmg;
  victim.dmgBy.set(attacker, MATCH.time);
  if (victim.isPlayer) {
    PL.lastDmgT = MATCH.time; sfxHurt(dmg); padRumble(0.4 + dmg / 120, 0.8, 140 + dmg * 2); touchBuzz(clamp(dmg * 0.6, 12, 40));
    FinalShader.uniforms.uDamage.value = Math.min(0.8, FinalShader.uniforms.uDamage.value + dmg / 90);
    // the view takes the hit from the side it came from: upward jolt, yaw and roll away from the shooter
    let side = 0;
    if (attacker !== victim) {
      const sp = srcPos || attacker.pos; PL.dmgInd.push({ x: sp.x, z: sp.z, t: 1.6 });
      side = clamp(((sp.x - victim.pos.x) * Math.cos(PL.yaw) - (sp.z - victim.pos.z) * Math.sin(PL.yaw)) / 5, -1, 1);
    }
    PL.vpP += 0.8 + dmg * 0.012; PL.vpY += (Math.random() - 0.5) * 0.8 + side * 0.9; PL.vrollP += side * 0.45;
  } else {
    victim.model.flinch = 1; victim.lastHitT = MATCH.time;
    // impact reaction (06b-soldier.js): in the direction of fire, stronger on a headshot
    const M = victim.model; M.hitKick = (M.hitKick || 0) + (head ? 1.4 : 1); M.hitHead = !!head;
    if (dir) (M.hitDir = M.hitDir || new V3()).copy(dir);
    if (!srcPos && attacker !== victim) botHurt(victim, attacker, dmg, dir, MATCH.time); // no return fire against the helicopter: bots don't target it
  }
  const kill = victim.health <= 0;
  if (attacker.isPlayer && victim !== attacker) hitFeedback(head, kill);
  if (attacker && victim !== attacker) kcEvent('hit', { sid: attacker.kcI, head: !!head, kill }); // each shooter's hit cross, replayed in their killcam
  if (kill) killEnt(victim, attacker, weapon, head, dir || new V3(0, 0, -1), life);
}
/* Falling into the void (floating islands, VOID): the machine simulating this soldier (the player at home, bots on the host or offline)
   kills them itself, without applyDamage (respawn protection would block it), and announces it online like any death ('kill', cause
   'fall'). The opponent who hit them in the last 5 seconds (the time before health regenerates) is credited with the
   kill, as in games of this kind; otherwise it's a fall alone, counted as a suicide. No killcam, no body. */
function voidDeath(e) {
  if (!e.alive || !(MATCH.state === 'playing' || MATCH.state === 'paused')) return;
  let a = e, best = -1;
  for (const [ent, t] of e.dmgBy) if (ent !== e && !allied(ent, e) && MATCH.time - t < 5 && t > best) { best = t; a = ent; }
  const dir = new V3(e.vel.x, 0, e.vel.z); if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1); dir.normalize();
  e.voidDead = true;
  if (!e.isPlayer) e.lastForce = { dir: dir.clone(), mag: 1, part: 'body' };
  killEnt(e, a, NET_WSPECIAL.fall, false, dir);
}
/* After a local soldier moves: past the death plane, they die; during the end announcement (no more deaths possible), they stay
   suspended under the islands, out of sight. Returns true if the soldier just died. */
function voidCheck(e) {
  if (!VOID.on || !e.alive || e.pos.y >= VOID.kill) return false;
  if (MATCH.state === 'playing' || MATCH.state === 'paused') voidDeath(e); else { e.pos.y = VOID.kill; e.vy = 0; }
  return !e.alive;
}
/* A kill only raises the streak if the killer is alive and made it in their current life: not with the helicopter, not during
   the death screen, not with a grenade or airstrike thrown in a previous life (life: their spawn, spawnAt, at the throw) */
function streakKill(a, weapon, life) { return a.alive && weapon !== NET_WSPECIAL.heli && (life === undefined || life === a.spawnAt); }
function killEnt(v, a, weapon, head, dir, life) {
  v.alive = false; v.deaths++; v.streak = 0; v.health = 0; v.protT = 0; pfrEvent(2);
  noteDeath(v); botDeathNote(v, a);
  dropKilledWeapon(v, dir);
  const now = MATCH.time;
  // online, each local participant (me, or a bot simulated by the host) announces their own death
  if (MATCH.online && (v.isPlayer || v.netBot)) netEvent({ k: 'kill', by: netIdOf(a), h: head ? 1 : 0, w: netWeaponKey(weapon), x: +(dir ? dir.x : 0).toFixed(2), z: +(dir ? dir.z : 1).toFixed(2), q: NET.hitQ || undefined }, v); // q: the hit that killed (crossed deaths, netHeldCheck)
  if (v.isPlayer) {
    if (PILOT.d) fpvLeave(); // the view returns to the body; the drone falls (fpvStep)
    PL.deathT = 0; PL.killer = a !== v ? a : null; PL.reload = null; dropCookedNade(); PL.nadeState = null; PL.knifeT = 0; PL.knifeOut = false; PL.knifeHold = 0; PL.knifeBtn = null; vmClearHeld();
      KC.pending = a && a !== v && a.model && weapon !== NET_WSPECIAL.heli && weapon !== NET_WSPECIAL.drone && weapon !== NET_WSPECIAL.mecha && weapon !== NET_WSPECIAL.fall && weapon !== NET_WSPECIAL.zone ? a : null; KC.deathT = MATCH.time; // (the translated name: in English, 'Hélicoptère' never matched)
    if (KC.pending) KC.info = `<span class="enemy">${esc(a.name)}</span><i>${esc(weapon)}</i><i>${Math.round(a.pos.distanceTo(v.pos))} m</i>`;
    showDeathScreen(a, weapon, head);
  } else {
    v.respawnT = modeDef().botRespawn; v.target = null; v.path = null;
    if (!v.lastForce) v.lastForce = { dir: dir.clone().normalize(), mag: 2.5, part: head ? 'head' : 'body' };
    v.model.rag = null;
  }
  const enemyKill = a !== v && !allied(a, v) && !MATCH.finalPending && !MATCH.outro; // the announced match no longer scores
  if (enemyKill) {
    // a remote killer keeps their own counters and publishes them; up: the streak just went up (tiers are only read then, otherwise
    // a kill that doesn't count, the helicopter's for example, gave back the streak of the tier you were on: a helicopter
    // per helicopter kill, with the streak staying at 11)
    let combo = 0, up = false;
    if (!a.isRemote) {
      // combo: each kill within COMBO.win s of the previous one is worth one more step (death resets to zero, spawnEntity)
      a.comboN = MATCH.time - (a.comboT === undefined ? -99 : a.comboT) < COMBO.win ? (a.comboN || 0) + 1 : 1; a.comboT = MATCH.time;
      combo = Math.min(COMBO.max, (a.comboN - 1) * COMBO.step);
      a.kills++; a.score += 100 + (head ? 50 : 0) + combo; up = streakKill(a, weapon, life); if (up) a.streak++;
    }
    if (MATCH.mode === 'tdm') MATCH.score[a.team]++; // in domination, the score comes from held points
    domKillBonus(a, v);
    if (a.isPlayer) {
      PL.bestStreak = Math.max(PL.bestStreak, a.streak);
      xpPopup('+100', HUD.chain > 1 ? chainLabel(HUD.chain) : head ? _t('Headshot') : _t('Kill'), HUD.chain > 1 ? 'chain' : head ? 'head' : '');
      HUD.chain = 0;
      if (head) setTimeout(() => xpPopup('+50', _t('Headshot bonus'), 'small'), 160);
      if (combo) setTimeout(() => xpPopup('+' + combo, _t('Combo bonus'), 'small'), head ? 340 : 160);
      const wid = WEAPON_ID_BY_NAME[weapon]; if (wid) arsNotify(arsKill(wid, head)); // weapon XP (06r-arsenal.js)
      challengesKill(a, v, weapon, head); // outfit challenges (06s-challenges.js)
      // streak ready: its name and, on computer or gamepad, the key or button that calls it (input-mode glyph, 09x-invites.js)
      if (up) for (const id of PL.ksSel) if (a.streak === KSDEF[id].n) {
        const g = actGlyph(ksAct(id)), name = KSDEF[id].name;
        PL.ks[id] = true; sfxAnnounce(id + '_ready', 'st_ready'); hudMsg(g ? _t('{0} ready: {1}', name, g) : _t('{0} ready', name), 'xp', 3, !!g);
      }
      updateStreakHud();
    } else if (up) botStreak(a);
    for (const [ent, t] of v.dmgBy) {
      if (ent === a || allied(ent, v) || now - t > 8) continue;
      ent.assists++; ent.score += 20; if (ent.isPlayer) xpPopup('+20', _t('Assist'), 'small');
    }
  } else if (a === v) { a.score = Math.max(0, a.score - 50); }
  addKillfeed(a, v, weapon, head);
  const nocam = weapon === NET_WSPECIAL.fall || weapon === NET_WSPECIAL.zone; // a fall isn't replayed (the body fell into the void), nor is a death in the desert (nobody fired)
  if (MATCH.online && enemyKill) MATCH.lastKill = { killer: a, victim: v, t: now, info: killInfo(a, v, weapon), nocam }; // online, the host decides the end: the final killcam replays this last kill (matchFinish)
  if (!MATCH.online && !MATCH.finalPending && !MATCH.outro && killLimitReached()) {
    // the last kill decides the match: result announcement (09l-end.js), then final killcam on that kill
    MATCH.finalPending = { killer: a, victim: v, t: now, info: killInfo(a, v, weapon), nocam };
    matchFinishSoon(); // a short delay: the last victim has time to fall before the announcement
  }
}
function killInfo(a, v, weapon) { return `<span class="${teamCls(a)}">${esc(a.name)}</span><i>${esc(weapon)}</i><i>${Math.round(a.pos.distanceTo(v.pos))} m</i>`; }
/* A bot's streaks: three at random, at three different thresholds, drawn once and for all */
function botKs(b) { if (!b.ks) b.ks = ksSort(ksPick(KS_IDS.slice().sort(() => Math.random() - 0.5))); return b.ks; }
function botStreak(b) {
  if (MATCH.mode === 'ffa' || ksJammed(b.team)) return; // free-for-all: streaks stay with the player; jammed by an EMP: the streak is lost
  for (const id of botKs(b)) if (b.streak === KSDEF[id].n) KSDEF[id].bot(b);
}
function botUav(b) {
  const ally = b.team === PL.ent.team;
  uavStart(b.team); spawnDrone(b.team); netUav(b); sfxAnnounce(ally ? 'uav_on' : 'uav_enemy');
  hudMsg(ally ? `${_t('Allied UAV ({0})', b.name)}` : _t('Enemy UAV online'), ally ? 'ally' : 'enemy', 2.5);
}
/* A bot's mecha: dropped on the zone closest to a random enemy, facing them */
function botMecha(b) {
  const foes = entities.filter((e) => e.alive && !e.off && !allied(e, b)); if (!foes.length) return;
  const t = pick(foes), q = mnavZone(t.pos.x, t.pos.z); if (!q) return;
  mechaCall(b, new V3(q.x, q.y, q.z), Math.atan2(-(t.pos.x - q.x), -(t.pos.z - q.z)));
}
function botAirstrike(b) {
  const ally = b.team === PL.ent.team, foes = entities.filter((e) => e.alive && e.team !== b.team);
  if (!foes.length) return;
  netAirstrike(pick(foes).pos.clone(), rand(0, TAU), b);
  hudMsg(ally ? _t('Allied airstrike') : _t('Enemy airstrike!'), ally ? 'ally' : 'enemy', 2.5);
}

/* ---------- HUD ---------- */
const HUD = { mmAt: 0, lastAmmo: '', msgT: 0, hitT: 0, xhairGap: 20, kick: 0, chain: 0, tagT: 0, board: false, boardT: 0, dMode: '', mm: null, mmStatic: null, mmFit: true, k: '', mode: '', rkT: 0, jam: null, fpvMode: '' }; // jam: snow on the jammed minimap (mmJamDraw)
addEventListener('resize', () => { HUD.mmFit = true; }); // minimap: bitmap at the displayed size (drawMinimap)
/* Message at top center (at --msg-top); html: the text carries a key glyph (actGlyph), already escaped */
function hudMsg(text, kind, dur, html) {
  const el = $('msg'); if (html) el.innerHTML = text; else el.textContent = text; el.className = 'msg show k-' + (kind || 'none'); HUD.msgT = dur || 2;
}
/* XP gain to the right of the reticle: the column (#xpbox, flex) lines up the gains, the newest closest to the reticle; three at most at once */
function xpPopup(big, small, cls = '') {
  const el = document.createElement('div'); el.className = 'xp ' + cls;
  el.innerHTML = `<b>${big}</b>${small ? `<span>${small}</span>` : ''}`;
  const box = $('xpbox'); box.appendChild(el); setTimeout(() => el.remove(), 1700);
  while (box.children.length > 3) box.firstChild.remove();
}
function showHitmarker(head, kill) {
  const h = $('hitmarker'); h.classList.remove('on', 'head', 'kill'); void h.offsetWidth;
  h.classList.add('on'); if (head) h.classList.add('head'); if (kill) h.classList.add('kill');
}
/* The player's kill chain: each kill within 4 s of the previous one goes up a step (sound and message). The score follows the same rule for
   everyone (killEnt, a.comboN): +25 points per step, up to +100 (owner feedback: "a combo that earns a few more points") */
const COMBO = { win: 4, step: 25, max: 100 };
const CHAIN = { n: 0, t: -99 };
function chainLabel(n) { return n === 2 ? _t('Double kill') : n === 3 ? _t('Triple kill') : n === 4 ? _t('Quadruple kill') : `${_t('{0}-kill streak', n)}`; }
/* Feedback for a bullet that hits: hit cross, sharp sound, and the reticle tightening on the target */
function hitFeedback(head, kill) {
  // a grenade dropped on death or thrown before it can kill someone after respawn: the credit stays, but not the cross
  // nor the sound at mid-screen as long as the player has done nothing (fired, thrown, called a streak) in this life
  if (PL.actT < (PL.ent.spawnAt || 0)) return;
  let ch = 1;
  if (head && kill) PL.hsKills = (PL.hsKills || 0) + 1; // kills at the head of the match (account statistics)
  if (kill) { ch = MATCH.time - CHAIN.t < 4 ? CHAIN.n + 1 : 1; CHAIN.n = ch; CHAIN.t = MATCH.time; HUD.chain = ch; }
  showHitmarker(head, kill); sfxHit(head, kill, ch); touchBuzz(kill ? 28 : 8); // finger vibration (09qd-aim.js)
  padRumble(kill ? 0.9 : head ? 0.55 : 0.3, kill ? 0.5 : 0.6, kill ? 110 : 40, true); // on gamepad: the hit is felt in the hand, the kill more strongly (09qc-gamepad.js)
  HUD.kick = Math.max(0, (HUD.kick || 0) - (kill ? 5 : 2));
}
function teamCls(e) { return allied(e, PL.ent) ? 'ally' : 'enemy'; }
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function addKillfeed(a, v, weapon, head) {
  const el = document.createElement('div'); el.className = a === PL.ent || v === PL.ent ? 'kf me' : 'kf'; // the player's kills (or their death): yellow outline
  el.innerHTML = a === v
    ? `<span class="${teamCls(v)}">${esc(v.name)}</span><i>${esc(weapon)}</i>`
    : `<span class="${teamCls(a)}">${esc(a.name)}</span><i>${esc(weapon)}${head ? ' ' + _t('<em>headshot</em>') : ''}</i><span class="${teamCls(v)}">${esc(v.name)}</span>`;
  const kf = $('killfeed'); kf.appendChild(el);
  while (kf.children.length > 5) kf.firstChild.remove();
  setTimeout(() => el.classList.add('fade'), 5500); setTimeout(() => el.remove(), 6200);
}
/* The three streak slots (#ks1 to #ks3), with the icon and name of the class's streak */
function updateStreakHud() {
  HUD.mode = inputMode(); // updateHud calls it again when the input mode changes (keyboard, gamepad): the glyph follows
  PL.ksSel.forEach((k, i) => {
    const el = $('ks' + (i + 1)), K = KSDEF[k];
    el.className = 'ks' + (PL.ks[k] ? ' ready' : '');
    hudHtml(el.querySelector('i'), `<svg viewBox="0 0 24 24" aria-hidden="true">${K.icon}</svg><span>${esc(K.name)}</span>`);
    // progress stays hidden: only the key or button that calls it appears, once the streak is earned (nothing on touch: its buttons are on screen)
    hudHtml(el.querySelector('b'), PL.ks[k] ? actGlyph('ks' + (i + 1)) : '');
  });
  if (TOUCH.on) touchKsIcons();
}
/* Death screen: card at bottom center ("Eliminated by" as the overline, the killer large, the weapon and distance), the respawn prompt with the
   key or button of the input mode and, with no killcam to follow, the bar counting down to the automatic respawn */
function showDeathScreen(a, weapon, head) {
  const d = $('death'), by = a && a !== PL.ent, W = NET_WSPECIAL;
  d.classList.add('show'); clearHitmarker();
  $('deathBy').innerHTML = by ? `<small>${_t('Killed by')}</small><b class="${teamCls(a)}">${esc(a.name)}</b>` : `<b>${weapon === W.fall ? _t('Fell into the void') : weapon === W.zone ? _t('Lost in the desert') : _t('You killed yourself')}</b>`;
  const far = by && weapon !== W.fall && weapon !== W.zone && weapon !== W.air && weapon !== W.heli && weapon !== W.drone && weapon !== W.mecha; // distance only makes sense for a shot or a throw
  $('deathWeap').innerHTML = (far ? esc(_t('{0} · {1} m', weapon, Math.round(a.pos.distanceTo(PL.ent.pos)))) : esc(weapon)) + (by && head ? ` <em>${_t('Headshot')}</em>` : '');
  d.classList.toggle('kcnext', !!KC.pending); d.style.setProperty('--rs', modeDef().respawn + 's'); // killcam to follow: no countdown
  HUD.dMode = ''; deathPrompt();
  if (document.activeElement) document.activeElement.blur();
}
/* Respawn prompt (Space, click, Enter; A or X on gamepad; a touch): rewritten if the input mode changes while waiting */
function deathPrompt() {
  const mode = inputMode(); if (mode === HUD.dMode) return; HUD.dMode = mode;
  hudHtml($('death').querySelector('.skip'), mode === 'touch' ? esc(_t('Tap: respawn right away')) : mode === 'pad' ? _t('{0} Respawn now', actGlyph('confirm'))
    : _t('{0} or {1} Respawn now', keyGlyph(_t('Space')), actGlyph('fire')));
}
function clearHitmarker() { $('hitmarker').classList.remove('on', 'head', 'kill'); }
function hideDeathScreen() { $('death').classList.remove('show'); clearHitmarker(); }
function fmtTime(s) { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

/* Minimap, every frame: drawn in units of 240 (W, H), on a bitmap at the displayed size and the screen density (at most 2), recomputed
   only when the size changes (HUD.mmFit: window, size setting, switch to touch) */
function drawMinimap() {
  const cv = $('minimap'), g = HUD.mm, W = 240, H = 240, scale = MM_ZOOM, now = MATCH.time, C = HUD.mmCol;
  if (HUD.mmFit) { HUD.mmFit = false; const px = clamp(Math.round((cv.clientWidth || 200) * Math.min(2, devicePixelRatio || 1)), 120, 600); if (cv.width !== px) cv.width = cv.height = px; }
  const e = PL.ent, yaw = PL.yaw, k0 = cv.width / W;
  g.setTransform(k0, 0, 0, k0, 0, 0);
  g.save(); g.clearRect(0, 0, W, H);
  g.fillStyle = HUD.mmBg; g.fillRect(0, 0, W, H);
  g.translate(W / 2, H / 2 + 14); g.rotate(yaw);
  g.translate(-e.pos.x * scale, -e.pos.z * scale);
  const k = scale / HUD.mmS;
  g.imageSmoothingEnabled = true;
  g.drawImage(HUD.mmStatic, HUD.mmX0 * scale, HUD.mmZ0 * scale, HUD.mmStatic.width * k, HUD.mmStatic.height * k);
  domMinimap(g, scale, yaw);
  // oriented marker (allies, opponents seen by the satellite); dark outline: it stands out against a light building
  const arrow = (o, col) => {
    g.save(); g.translate(o.pos.x * scale, o.pos.z * scale); g.rotate(-o.yaw);
    g.fillStyle = col; g.beginPath(); g.moveTo(0, -6); g.lineTo(4.5, 4.5); g.lineTo(0, 2.5); g.lineTo(-4.5, 4.5); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.75)'; g.lineWidth = 1; g.stroke(); g.restore();
  };
  const jam = ksJammed(e.team), sat = satOn(e.team);
  for (const o of entities) {
    if (!o.alive || o === e || jam) continue; // jammed by an EMP: no marker
    if (allied(o, e)) arrow(o, C.ally);
    else if (sat) arrow(o, C.enemy);
    else {
      const shot = now - o.lastShotT < 1.4, b = shot ? null : uavBlip(o, e, true); // firing: in place; otherwise the UAV's last reading
      if (!shot && !b) continue;
      g.globalAlpha = shot ? 1 : b.a;
      g.fillStyle = C.enemy; g.beginPath(); g.arc((shot ? o.pos.x : b.x) * scale, (shot ? o.pos.z : b.z) * scale, 4.2, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1; g.stroke(); g.globalAlpha = 1;
    }
  }
  if (!jam) for (const n of NADES) { g.fillStyle = C.acc; g.fillRect(n.p.x * scale - 2, n.p.z * scale - 2, 4, 4); }
  g.restore();
  if (jam) mmJamDraw(g, W, H, now);
  // player
  g.save(); g.translate(W / 2, H / 2 + 14);
  g.fillStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 70, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6); g.closePath(); g.fill();
  g.fillStyle = C.acc; g.beginPath(); g.moveTo(0, -8); g.lineTo(6, 6); g.lineTo(0, 3); g.lineTo(-6, 6); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 1.2; g.stroke();
  g.restore();
  // UAV sonar wave: starts from the player at each reading, at the speed at which it reveals opponents (uavBlip)
  const ping = MATCH.uav[e.team] > 0 && MATCH.uavPing[e.team], r = ping ? (now - ping.t) * UAV.speed * scale : 999;
  if (r < 170) { g.strokeStyle = `rgba(143,209,106,${(0.7 * (1 - r / 170)).toFixed(3)})`; g.lineWidth = 2; g.beginPath(); g.arc(W / 2, H / 2 + 14, r, 0, TAU); g.stroke(); }
}
/* Minimap jammed by an EMP: animated snow over the map, and the jamming notice */
function mmJamDraw(g, W, H, now) {
  if (!HUD.jam) {
    const c = document.createElement('canvas'); c.width = c.height = 96; const q = c.getContext('2d'), im = q.createImageData(96, 96);
    for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 200; }
    q.putImageData(im, 0, 0); HUD.jam = c;
  }
  const k = Math.floor(now * 24); // different snow each frame (24 per second), without recomputing pixels
  g.save(); g.imageSmoothingEnabled = false; g.globalAlpha = 0.55;
  g.drawImage(HUD.jam, (k * 37) % 48, (k * 53) % 48, 48, 48, 0, 0, W, H);
  g.globalAlpha = 1; g.fillStyle = 'rgba(10,11,9,0.72)'; g.fillRect(0, H / 2 - 16, W, 32);
  g.fillStyle = '#E4473B'; g.font = '700 20px "Barlow Condensed", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(_t('Signal jammed'), W / 2, H / 2 + 1); g.restore();
}
/* HUD writes: it is updated every frame, but most of its values rarely change.
   Rewriting identical text still replaces its node (layout and a new paint of the shadowed text), and the
   browser recomposites the area: on an integrated chip, this compositor work is paid for on the same GPU as the
   3D scene. So we only write what changes (value cached on the element). */
const _hudV = [new V3(), new V3(), new V3()];
function hudText(el, v) { v = String(v); if (el.__t !== v) { el.__t = v; el.textContent = v; } }
function hudStyle(el, prop, v) { const k = '__s' + prop; if (el[k] !== v) { el[k] = v; el.style[prop] = v; } }
function hudVar(el, name, v) { const k = '__v' + name; if (el[k] !== v) { el[k] = v; el.style.setProperty(name, v); } }
function hudHtml(el, v) { if (el.__h !== v) { el.__h = v; el.innerHTML = v; } } // text that carries a key glyph (actGlyph)
function hudCls(el, c, on) { const k = '__c' + c; if (el[k] !== on) { el[k] = on; el.classList.toggle(c, on); } }
function updateHud(dt) {
  const e = PL.ent, w = curW(), d = w.def, now = MATCH.time, mode = inputMode(), hud = $('hud');
  // in-game interface size (Options, Game): --hud-k multiplies --hu; on touch, the HUD is in u and doesn't change
  const k = TOUCH.on ? '1' : String(Settings.hudScale || 1);
  if (HUD.k !== k + TOUCH.on) { HUD.k = k + TOUCH.on; hud.style.setProperty('--hud-k', k); HUD.mmFit = true; } // (switching to touch also changes the minimap size)
  if (mode !== HUD.mode) { updateStreakHud(); if (!e.alive) deathPrompt(); } // glyphs for ready streaks and respawn: keyboard, gamepad or touch
  hudText($('scA'), MATCH.score[0]); hudText($('scB'), MATCH.score[1]);
  hudStyle($('barA'), 'transform', `scaleX(${MATCH.score[0] / MATCH.limit})`); hudStyle($('barB'), 'transform', `scaleX(${MATCH.score[1] / MATCH.limit})`);
  hudText($('timer'), fmtTime(MATCH.timeLeft));
  // deathmatch: the rank sorts all soldiers, four times a second is enough
  if (MATCH.mode === 'ffa' && (HUD.rkT -= dt) <= 0) { HUD.rkT = 0.25; hudText($('scLim'), `${_t('First to {0} · you are {1}', MATCH.limit, ordinal(ffaRank()))}`); }
  domHud(dt); ringHud(e);
  const kn = PL.knifeOut; // knife in hand: its name instead of the weapon, no magazine or reserve (the digits' place stays, nothing moves at bottom right)
  const ammo = `${kn ? 'k' : w.mag + '|' + w.reserve + '|' + d.name}|${PL.nades}${PL.nadeType}|${mode}`;
  if (ammo !== HUD.lastAmmo) {
    HUD.lastAmmo = ammo;
    $('mag').textContent = w.mag; $('reserve').textContent = w.reserve; $('wname').textContent = kn ? _t('Knife') : d.name;
    $('mag').parentNode.style.visibility = kn ? 'hidden' : '';
    $('mag').classList.toggle('low', !kn && w.mag <= Math.ceil(d.mag * 0.25));
    // grenades: the key that throws them (nothing on touch) then one icon per grenade, full or empty, shaped like the class's grenade type
    const nn = Math.max(PL.nades, CLASSES[PL.classIdx].nades), ty = PL.nadeType === 'frag' ? '' : ` ${PL.nadeType}`;
    $('nades').innerHTML = (nn ? actGlyph('nade') : '') + Array.from({ length: nn }, (x, i) => `<i class="${i < PL.nades ? '' : 'off'}${ty}"></i>`).join('');
    const pips = $('pips'); const n = kn ? 0 : Math.min(d.mag, 40);
    if (pips.children.length !== n) { pips.innerHTML = ''; for (let i = 0; i < n; i++) pips.appendChild(document.createElement('i')); }
    for (let i = 0; i < n; i++) pips.children[i].className = i < w.mag ? '' : 'spent';
  }
  // reload prompt: magazine at a quarter or empty (in red), with the key or button of the input mode
  const rh = $('reloadHint'), low = e.alive && !PL.knifeOut && w.mag <= Math.ceil(d.mag * 0.25) && !PL.reload && w.reserve > 0;
  hudStyle(rh, 'opacity', low ? '1' : '0');
  if (low) { const g = actGlyph('reload'); hudHtml(rh, g ? _t('{0} Reload', g) : _t('Reload')); hudCls(rh, 'empty', w.mag === 0); }
  if ((HUD.zT = (HUD.zT || 0) - dt) <= 0) { hudText($('zone'), zoneName(e.pos.x, e.pos.z)); HUD.zT = 0.3; }
  arsLevelTick(dt); // player level crossed during a match (06r-arsenal.js)
  { const t = performance.now(); if (t - HUD.mmAt >= 8) { HUD.mmAt = t; drawMinimap(); } } // minimap: 120 times per second at most (at 280 frames per second, it was redrawn on every one)
  // reticle
  const ads = VM.ads, spd = hyp(e.vel.x, e.vel.z);
  let spread = lerp(d.spread[0], d.spread[1], ads) + d.moveSpread * clamp(spd / MOVE_SPEED, 0, 1.5) + PL.bloom + (PL.onGround ? 0 : 0.05);
  if (e.crouch) spread *= 0.8;
  const focal = VIEW.h / (2 * Math.tan((camera.fov * Math.PI) / 360));
  HUD.xhairGap = damp(HUD.xhairGap, 6 + Math.tan(spread) * focal, 20, dt);
  HUD.kick = damp(HUD.kick, 0, 14, dt);
  const xh = $('xhair'), gap = HUD.xhairGap + HUD.kick;
  hudStyle(xh, 'opacity', !e.alive || ads > 0.6 || PL.sprinting || PL.knifeT > 0 || PL.knifeOut || KS.mode || playHold() ? '0' : '0.9'); // (countdown: the ring takes its place)
  hudVar(xh, '--gap', (Math.round(gap * 2) / 2).toFixed(1) + 'px'); // half a pixel: no new style for an invisible difference
  const scoped = !!(d.scope && ads > 0.92 && e.alive);
  $('scope').classList.toggle('on', scoped);
  if (scoped) {
    hudStyle($('breath'), 'transform', `scaleX(${clamp(PL.breath, 0, 1).toFixed(3)})`);
    const g = actGlyph('sprint'); hudHtml($('breathHint'), g ? _t('{0} Hold your breath', g) : ''); // on touch: the button (if kept)
  }
  FinalShader.uniforms.uAberr.value = Math.max(d.scope && ads > 0.92 ? 1.6 : 0.0, PL.aberr || 0);
  { const k = PL.boltT > 0 ? Math.sin(clamp((1 - PL.boltT / 1.05) * 1.25, 0, 1) * Math.PI) : 0; hudStyle($('scopeMask'), 'transform', k ? `translate(${k * 6}px, ${k * 22}px) rotate(${k * 1.6}deg)` : ''); }
  // damage indicators
  const box = $('dmgind');
  while (box.children.length < PL.dmgInd.length) box.appendChild(document.createElement('i'));
  PL.dmgInd = PL.dmgInd.filter((k) => (k.t -= dt) > 0);
  for (let i = 0; i < box.children.length; i++) {
    const el = box.children[i], k = PL.dmgInd[i];
    if (!k) { hudStyle(el, 'opacity', '0'); continue; }
    const dx = k.x - e.pos.x, dz = k.z - e.pos.z;
    const f = [-Math.sin(PL.yaw), -Math.cos(PL.yaw)], r = [Math.cos(PL.yaw), -Math.sin(PL.yaw)];
    const ang = Math.atan2(dx * r[0] + dz * r[1], dx * f[0] + dz * f[1]);
    hudStyle(el, 'opacity', String(Math.min(1, k.t * 1.3))); hudStyle(el, 'transform', `translate(-50%,-50%) rotate(${ang}rad) scale(${(1 + Math.max(0, k.t - 1.4) * 1.5).toFixed(2)})`);
  }
  // nearby grenade
  let nd = null;
  for (const n of NADES) { if (allied(n.owner, e) && n.owner !== e) continue; if (n.p.distanceTo(e.pos) < 8) { nd = n; break; } }
  const nw = $('nadeWarn');
  if (nd && e.alive) {
    const dx = nd.p.x - e.pos.x, dz = nd.p.z - e.pos.z;
    const ang = Math.atan2(dx * Math.cos(PL.yaw) - dz * Math.sin(PL.yaw), -dx * Math.sin(PL.yaw) - dz * Math.cos(PL.yaw));
    hudStyle(nw, 'opacity', '1'); hudVar(nw, '--a', ang + 'rad'); hudCls(nw, 'on', true);
  } else { hudStyle(nw, 'opacity', '0'); hudCls(nw, 'on', false); } // the pulse only runs while visible
  // name under the reticle: never for an enemy (recognized by the absence of a marker); for an ally only if the ally
  // markers are off, since otherwise their name is already above their head (09m-markers.js)
  if ((HUD.tagT -= dt) <= 0) {
    HUD.tagT = 0.1; let tag = null;
    if (!Settings.allyMarks && e.alive && !(d.scope && ads > 0.9)) {
      const f = camFwd(_hudV[0]), c = _hudV[1], to = _hudV[2];
      for (const o of entities) {
        if (!o.alive || o === e || !allied(o, e)) continue;
        entChest(o, c); to.subVectors(c, camera.position); const dist = to.length();
        if (dist > 70) continue; to.divideScalar(dist);
        if (to.dot(f) < Math.cos(Math.max(0.02, 0.5 / dist))) continue;
        if (!lineClear(camera.position, c)) continue;
        tag = o; break;
      }
    }
    const nt = $('nameTag');
    if (tag) { hudText(nt, tag.name); nt.className = 'nametag show ally'; }
    else if (nt.className !== 'nametag') nt.className = 'nametag';
  }
  if (HUD.msgT > 0) { HUD.msgT -= dt; if (HUD.msgT <= 0) $('msg').classList.remove('show'); }
  if (HUD.board && (HUD.boardT -= dt) <= 0) fillScoreboard(); // four times a second, and the DOM only if the table changed
  const hp = $('hp');
  const hpv = Math.max(0, Math.ceil(e.health)); // the displayed number: health only appears below 100
  hudStyle(hp, 'opacity', e.alive && hpv < 100 ? '1' : '0');
  hudStyle($('hpFill'), 'transform', `scaleX(${clamp(e.health / 100, 0, 1)})`);
  hudText($('hpN'), hpv); hudCls(hp, 'crit', hpv <= 35);
}
function showScoreboard(on) { HUD.board = on && MATCH.state !== 'ended'; $('board').classList.toggle('show', !!HUD.board); if (on) fillScoreboard(); }
const boardName = (x) => (x.isPlayer && MATCH.online ? NET.nick : x.name) + (MATCH.online && (x.netBot || x.remoteBot) ? ' ' + _t('(bot)') : '');
/* A team's players, from best to worst (online: only those who are participating) */
const boardCmp = (a, b) => b.score - a.score || b.kills - a.kills || a.deaths - b.deaths;
function boardList(t) { return entities.filter((x) => x.team === t && (!MATCH.online || x.isPlayer || x.isRemote || x.netBot)).sort(boardCmp); }
/* Scoreboard (Tab, Back, touch button): one panel per team, header (name, score), columns in tabular figures; my row marked
   (yellow bar and bold), the dead faded. Rewritten four times a second at most (updateHud), and only if its content changed (hudHtml) */
function fillScoreboard() {
  HUD.boardT = 0.25;
  const ffa = MATCH.mode === 'ffa'; hudCls($('board'), 'one', ffa);
  const head = `<thead><tr><th>${_t('Name')}</th><th>${_t('Score')}</th><th>${_t('Kills')}</th><th>${_t('Deaths')}</th><th>${_t('Assists')}</th></tr></thead>`;
  const row = (x) => `<tr class="${x.isPlayer ? 'me' : ''}${x.alive ? '' : ' dead'}"><td>${esc(boardName(x))}</td><td>${x.score}</td><td>${x.kills}</td><td>${x.deaths}</td><td>${x.assists}</td></tr>`;
  if (ffa) { // a single ranking, all soldiers
    hudHtml($('board0'), `<caption class="ally"><span>${_t('Ranking, first to {0}', MATCH.limit)}</span></caption>${head}<tbody>${ffaList().sort(ffaCmp).map(row).join('')}</tbody>`);
    return;
  }
  for (const t of [0, 1]) { // my team on the left, like the score at the top of the screen
    const team = t === 0 ? PL.ent.team : 1 - PL.ent.team, mine = team === PL.ent.team;
    hudHtml($('board' + t), `<caption class="${mine ? 'ally' : 'enemy'}"><span>${TEAM_NAMES[team]}${mine ? ` <em>${_t('You')}</em>` : ''}</span><b>${MATCH.score[team]}</b></caption>${head}<tbody>${boardList(team).map(row).join('')}</tbody>`);
  }
}

/* ---------- Results screen: ranking of both teams, shown a few seconds after the final killcam ---------- */
const END = { t: 0, shown: -1 };
const END_SECONDS = 15;
const ordinal = (n) => n + ((n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10]) || 'th');
/* Results screen tables: my team on the left (like the score and the in-match scoreboard), rank, name (MVP), score, kills, deaths,
   ratio, assists; my row marked (yellow bar and bold) */
const endHead = () => `<thead><tr><th>#</th><th>${_t('Name')}</th><th>${_t('Score')}</th><th>${_t('Kills')}</th><th>${_t('Deaths')}</th><th>${_t('Ratio')}</th><th>${_t('Assists')}</th></tr></thead>`;
function endRow(x, k, mvp) {
  const ratio = (x.deaths ? x.kills / x.deaths : x.kills).toFixed(2);
  return `<tr class="${x.isPlayer ? 'me' : ''}"><td>${k + 1}</td><td><span>${esc(boardName(x))}</span>${x === mvp ? ` <em class="mvp">MVP</em>` : ''}</td><td>${x.score}</td><td>${x.kills}</td><td>${x.deaths}</td><td>${ratio}</td><td>${x.assists}</td></tr>`;
}
function fillEnd() {
  if (MATCH.mode === 'ffa') return fillEndFfa();
  const me = PL.ent, all = [0, 1].flatMap(boardList).sort(boardCmp), mvp = all[0], rank = all.indexOf(me) + 1;
  [me.team, 1 - me.team].forEach((t, i) => {
    const mine = t === me.team, win = MATCH.winner === t;
    $('endC' + i).className = 'eb-cap ' + (mine ? 'ally' : 'enemy');
    $('endC' + i).innerHTML = `<span><span>${TEAM_NAMES[t]}</span>${mine ? ` <em class="you">${_t('You')}</em>` : ''}${win ? ` <em class="win">${_t('Winner')}</em>` : ''}</span><b>${MATCH.score[t]}</b>`;
    $('endT' + i).innerHTML = `${endHead()}<tbody>${boardList(t).map((x, k) => endRow(x, k, mvp)).join('')}</tbody>`;
  });
  return { rank, total: all.length };
}
/* Deathmatch: a single ranking (left column), the second doesn't exist */
function fillEndFfa() {
  const me = PL.ent, all = ffaList().sort(ffaCmp), mvp = all[0];
  $('endC0').className = 'eb-cap ally';
  $('endC0').innerHTML = `<span><span>${_t('Ranking')}</span> <em class="win">${_t('Winner: {0}', esc(boardName(mvp)))}</em></span><b>${mvp.kills}</b>`;
  $('endT0').innerHTML = `${endHead()}<tbody>${all.map((x, k) => endRow(x, k, mvp)).join('')}</tbody>`;
  return { rank: all.indexOf(me) + 1, total: all.length };
}
/* XP block of the results screen (#endXp, written by acctMatchEnd, 09j-account.js): level badge, the match's gain, bar toward the next
   level (it fills from the XP before the match), progress in plain text; o: { xp, level, into, need, up, notes } */
function endXpHtml(o) {
  const x1 = o.need ? clamp(o.into / o.need, 0, 1) : 1, x0 = o.up || !o.need ? 0 : clamp((o.into - o.xp) / o.need, 0, 1);
  const notes = (o.notes || []).filter(Boolean).map((n) => `<span>${n}</span>`).join('');
  return `<div class="ex-badge"><svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,3 93,26.5 93,73.5 50,97 7,73.5 7,26.5"/></svg><b>${o.level}</b></div>
    <div class="ex-main"><p class="ex-top"><b>${_t('+{0} XP', fmtNum(o.xp))}</b>${o.up ? `<em>${_t('Level {0}!', o.level)}</em>` : ''}</p>
      <div class="ex-bar" style="--x0:${x0.toFixed(3)};--x1:${x1.toFixed(3)}"><i></i></div>
      <p class="ex-sub"><span>${o.need ? _t('{0} / {1} XP to level {2}', fmtNum(o.into), fmtNum(o.need), o.level + 1) : _t('Max level')}</span>${notes}</p></div>`;
}
function updateEnd(dt) {
  END.t -= dt;
  const n = Math.max(0, Math.ceil(END.t));
  if (n !== END.shown) { END.shown = n; $('endTimer').textContent = `${_t('{0} in {1} s', MATCH.online ? _t('Back to lobby') : _t('Back to menu'), n)}`; }
  if (END.t <= 0) toMenu(MATCH.online ? undefined : 'solo');
}

/* ---------- Match flow ---------- */
function startMatch(opt = {}) {
  gpuLog('match start');
  initAudio(); setAmbience(true); saveSettings(); applyQuality();
  // dynamic resolution: the scale stays the best estimate, but the wait before scaling back up (doubled at each failed attempt) starts again from zero
  Object.assign(DYN, { good: 0, slow: 0, need: 4, lastUp: -1e9 }); DYN.win.length = 0;
  if (!opt.online && netInLobby()) netQuit();
  MATCH.online = !!opt.online; if (MATCH.online) hostBgInit(); // host in the background: the match continues (hostBgTick)
  const want = MATCH.online ? NET.cfg.mode : Settings.mode, mode = !MODES[want] || !CURMAP.def || (want === 'dom' && !CURMAP.def.dom) ? 'tdm' : want; // online, the mode is the lobby's
  MATCH.limit = MATCH.online ? NET.cfg.limit : Settings[MODES[mode].key];
  SMOKES.length = 0; PL.flashT = 0; MATCH.score = [0, 0]; MATCH.time = 0; MATCH.timeLeft = (MATCH.online ? NET.cfg.time : Settings.minutes) * 60; MATCH.uav = [0, 0]; MATCH.uavPing = [null, null]; MATCH.sat = [0, 0]; MATCH.emp = [0, 0]; MATCH.events = []; MATCH.winner = -1;
  for (const n of NADES) scene.remove(n.mesh); NADES.length = 0; clearThrowKnives(); soundEvents.length = 0; clearAircraft(); clearDrops();
  FX.holes.clear(); FX.splats.clear(); FX.scorch.clear(); propsReset();
  for (const e of entities) { e.kills = e.deaths = e.score = e.assists = e.streak = e.comboN = 0; e.comboT = -99; e.alive = false; e.lastShotT = -9; }
  MATCH.state = 'playing'; kcReset(); MATCH.finalPending = null; MATCH.lastKill = null; MATCH.outro = null; MATCH.outroSoon = false; outroClear(); MATCH.startAt = MATCH.time;
  modeStart(mode);
  // bot weapons by map type (07-bots.js): the first match after loading keeps the draw made during compilation
  // (mapCompile); later ones draw again, and whatever is missing is built here, at deploy time, not at first spawn
  if (BOT_ARM.map !== MAPL.id) { botArmForMap(); botArmPrebuild(); }
  BOT_ARM.map = null;
  if (MATCH.online) { PL.ent.team = NET.team; for (const e of entities) if (!e.isPlayer && !e.isRemote) { e.netBot = false; e.alive = false; e.respawnT = Infinity; e.model.root.visible = false; e.model.rag = null; } }
  else { PL.ent.team = 0; for (const e of entities) if (!e.isPlayer && !e.off) spawnEntity(e); }
  spawnEntity(PL.ent);
  soldierLookAll(); // allies in light, enemies in dark, based on the player's team (online, they may play Bravo)
  // my side (class a: left of the timer, in green) and the opposing one (b: right, in red); online, you can play Bravo. In deathmatch, the first
  // row is always mine ("You"), whatever the original team
  const mine = MATCH.mode === 'ffa' ? 0 : PL.ent.team;
  document.querySelectorAll('.score .row').forEach((r, t) => { r.classList.toggle('a', t === mine); r.classList.toggle('b', t !== mine); });
  HUD.rkT = 0;
  PL.held = false; PL.queued = false; PL.adsWant = false; PL.noFireT = performance.now() + 450; // no firing until the player has released and pressed again
  PL.yaw = PL.ent.yaw; PL.pitch = 0; PL.shots = 0; PL.hits = 0; PL.bestStreak = 0; PL.ks = {}; PL.dmgInd = []; PL.crouchToggle = false; CHAIN.n = 0; CHAIN.t = -99; HUD.chain = 0;
  FinalShader.uniforms.uDamage.value = 0; FinalShader.uniforms.uDesat.value = 0; FinalShader.uniforms.uHurt.value = 0;
  giveLoadout(); updateStreakHud(); hideDeathScreen();
  VM.root.visible = true; VM.holder.visible = true;
  uiHide(); $('end').classList.remove('show'); $('pause').classList.remove('show'); $('hud').classList.remove('hidden');
  HUD.lastAmmo = '';
  // the switch to fullscreen (requested on the deploy click) makes a capture requested during the transition get refused: we wait for it
  if (LOCK.fsPending) { const fs = LOCK.fsPending; LOCK.fsPending = null; LOCK.quiet = true; fs.then(() => setTimeout(() => { if (MATCH.state === 'playing') requestLock(); }, 80)); }
  else requestLock();
  hudText($('scLim'), MATCH.mode === 'dom' ? _t('First to {0} points', MATCH.limit) : _t('First to {0}', MATCH.limit));
  PL.hsKills = 0; arsSessionReset(); acctMatchStart(); // account match token (09j-account.js)
  skinTrim(); // challenge outfits nobody is wearing: freed (09u-outfits.js)
  pfrStart(); // performance recorder, with "Show performance" (09zo-perfs.js)
  cdStart(); // "The match starts in 10": nobody moves before the start (09y-countdown.js)
}
function endMatch() {
  if (MATCH.state === 'ended') return;
  pfrStop(); showLockPrompt(false);
  if (KC.active) { KC.active = false; $('killcam').classList.remove('show'); KC.body.root.visible = false; }
  MATCH.state = 'ended'; arsShowClear(); cdClear();
  const me = PL.ent, o = MATCH.outro ? MATCH.outro.out : matchOutcome(); // frozen by the announcement: both say the same thing
  $('end').classList.toggle('one', MATCH.mode === 'ffa');
  MATCH.winner = o.winner;
  $('endKick').textContent = outroKicker(); // what ended the match: limit reached or time elapsed
  $('endTitle').textContent = OUTRO_TEXT[o.result];
  $('endTitle').className = OUTRO_CLS[o.result]; $('end').dataset.res = o.result;
  $('endScore').textContent = o.sub;
  $('endMeta').textContent = [mapById(MATCH.online ? NET.cfg.map : Settings.map).name, modeDef().name, MATCH.online ? _t('Online match') : _t('Solo')].join(' · ');
  const acc = PL.shots ? Math.round((PL.hits / PL.shots) * 100) : 0;
  const ratio = me.deaths ? (me.kills / me.deaths).toFixed(2) : me.kills.toFixed(2);
  const R = fillEnd(); challengesMatchEnd(o.result, R.rank); arsEndFill(); // challenges: rank in deathmatch, map completed (06s-challenges.js)
  END.t = END_SECONDS; END.shown = -1; $('end').style.setProperty('--es', END_SECONDS + 's'); updateEnd(0); // (timer written right away; its bar is in CSS)
  // personal statistics: one tile per figure, ranking first
  const st = (v, l, c) => `<div class="st${c ? ' ' + c : ''}"><span>${l}</span><b>${v}</b></div>`;
  $('endStats').innerHTML = st(`${ordinal(R.rank)}<small>/${R.total}</small>`, _t('Ranking'), 'hi') + st(me.score, _t('Score')) + st(me.kills, _t('Kills')) + st(me.deaths, _t('Deaths'))
    + st(ratio, _t('Ratio')) + st(`${acc}<small>%</small>`, _t('Accuracy')) + st(PL.bestStreak, _t('Best streak'));
  $('end').classList.add('show'); $('pause').classList.remove('show'); $('hud').classList.add('hidden'); showScoreboard(false); hideDeathScreen();
  $('againBtn').textContent = MATCH.online ? _t('Back to lobby') : _t('Play again');
  $('menuBtn').classList.toggle('hidden', !!MATCH.online);
  if (document.pointerLockElement) document.exitPointerLock();
  for (const k in KEYS) KEYS[k] = false; PL.held = false; PL.adsWant = false;
  if (MATCH.online) netMatchEnded();
  arsLocalXp(o.result); // without an account: XP kept in the browser (06r-arsenal.js)
  acctMatchEnd(o.result, true); // account XP and statistics
}
/* Return to the menus: the requested screen, otherwise the lobby if still in it, otherwise the main menu */
function toMenu(screen) {
  pfrStop(); acctMatchAbandon(); netLeaveMatch(); modeEnd(); arsShowClear();
  if (KC.active) { KC.active = false; $('killcam').classList.remove('show'); KC.body.root.visible = false; }
  kcReset(); MATCH.outro = null; outroClear(); cdClear();
  MATCH.state = 'menu'; showLockPrompt(false); setAmbience(false); musicRestart();
  if (document.fullscreenElement && Settings.fsGame && document.exitFullscreen) document.exitFullscreen().catch(() => {}); // the menus keep Escape (back) and exiting fullscreen
  for (const e of entities) { e.alive = false; if (e.model) e.model.root.visible = false; }
  for (const n of NADES) scene.remove(n.mesh); NADES.length = 0; clearThrowKnives(); clearAircraft();
  VM.root.visible = false;
  $('hud').classList.add('hidden'); $('end').classList.remove('show'); $('pause').classList.remove('show');
  hideDeathScreen(); showScoreboard(false);
  if (document.pointerLockElement) document.exitPointerLock();
  const to = screen || (netInLobby() ? 'multi' : 'main');
  uiOpen(to, to === 'main' ? [] : ['main']);
}
function pauseGame() {
  if (MATCH.state !== 'playing') return;
  MATCH.state = 'paused'; LOCK.escArmed = false; LOCK.quiet = false; $('pause').classList.add('show'); showLockPrompt(false);
  // the match continues behind the menu (online and solo alike): bots play, time runs
  $('quitBtn').firstElementChild.textContent = !MATCH.online ? _t('Quit the match') : NET.role === 'host' ? _t('End the match') : _t('Back to lobby');
  chatClose(); laneSuspend(); // a corridor announcement will resume on resume (09s-rankup.js)
  for (const k in KEYS) KEYS[k] = false; PL.held = false; PL.adsWant = false;
  pmOpen();
}
function resumeGame() {
  if (MATCH.state !== 'paused') return;
  MATCH.state = 'playing'; $('pause').classList.remove('show');
  LOCK.resumeT = performance.now(); LOCK.quiet = true; // resume: no prompt, the first key press or click gives the mouse back
  requestLock(); lanePump(); trackpadNote(); // detection switched between mouse and pad during the pause (09qe-touchpad.js)
  // weapon equipped during the pause: it comes out now, in front of the player (see giveLoadout)
  if (PL.pendingDraw) { PL.pendingDraw = false; VM.raiseRate = 7; VM.lowerTarget = 0; sfxMech('draw'); VM.rec.vy += 0.5; VM.rec.vrx -= 0.9; VM.rec.vz += 0.15; }
  if (Settings.loadout !== PL.classIdx && PL.ent.alive) hudMsg(`${_t('{0}: equipped at your next respawn', CLASSES[Settings.loadout].name)}`, 'xp', 3);
}
/* Fullscreen and keyboard lock: in fullscreen, Chrome delivers Escape to the page instead of releasing the mouse capture itself.
   The game then pauses by releasing the capture itself, and resumes without a click (the browser only requires a gesture
   when it is the one that released it, via Escape). Without fullscreen or keyboard lock, resuming requires a click. */
function enterGameFullscreen() {
  if (TOUCH.on) { touchFullscreen(); return; } // phone: fullscreen and landscape (09q-touch.js)
  if (!Settings.fsGame || document.fullscreenElement || !document.documentElement.requestFullscreen) return;
  try { LOCK.fsPending = document.documentElement.requestFullscreen().catch(() => {}); } catch (e) { /* ignored */ }
}
function syncKeyboardLock() {
  const kb = navigator.keyboard;
  if (!kb || !kb.lock) return;
  if (document.fullscreenElement) kb.lock([...bindCodes(), ...closeKeyCodes()]).then(() => { LOCK.kbLock = true; }).catch(() => { LOCK.kbLock = false; });
  else { LOCK.kbLock = false; try { kb.unlock(); } catch (e) { /* ignored */ } }
}
document.addEventListener('fullscreenchange', syncKeyboardLock);
/* Ctrl+W (close the tab) is easy to hit while playing: Ctrl crouches, W moves forward in QWERTY. No browser lets a page intercept it,
   except in fullscreen with keyboard lock: the key that gives W in the player's layout (KeyW in QWERTY, KeyZ in AZERTY) is
   then locked too, Ctrl+W reaches the page, which ignores it (closeKeyBlock). Outside fullscreen (the default on desktop),
   the browser asks for confirmation before closing or reloading the page during a match (its own dialog, fixed text). Reloads
   intended by the game go through (PAGE_LEAVE). */
function closeKeyCodes() {
  const L = BIND.layout, out = ['KeyW', 'KeyZ'];
  if (L) for (const [code, ch] of L) if (ch === 'w' && !out.includes(code)) out.push(code);
  return out;
}
function closeKeyBlock(e) {
  if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'w' && (MATCH.state === 'playing' || MATCH.state === 'paused')) e.preventDefault();
}
addEventListener('keydown', closeKeyBlock, true);
addEventListener('beforeunload', (e) => {
  if (PAGE_LEAVE.ok || !(MATCH.state === 'playing' || MATCH.state === 'paused')) return;
  e.preventDefault(); e.returnValue = ''; // (returnValue: older Chrome and Safari)
});
/* Mouse capture. The browser only grants it in response to a user gesture:
   a match started by a network message (lobby guests) or a "Resume" clicked too quickly
   after Escape is refused, without the capture being impossible for that. We then show
   "Click to play"; cursor aiming (without capture) is only used if the capture fails
   twice in a row despite a click, for example in a sandboxed frame that forbids it. */
function userGesture() {
  const ua = navigator.userActivation;
  return ua ? ua.isActive : performance.now() - LOCK.inputT < 1500;
}
addEventListener('pointerdown', () => { LOCK.inputT = performance.now(); }, true);
addEventListener('keydown', () => { LOCK.inputT = performance.now(); }, true);
function showLockPrompt(on) { $('lockPrompt').classList.toggle('show', on && MATCH.state === 'playing' && !LOCK.fallback); }
/* manual: the request follows a click on "Click to play" or on the scene. Only those refusals count toward cursor aiming:
   resuming with Escape is refused by the browser for a moment after the capture is released (no gesture, no delay
   elapsed), which doesn't mean the capture is impossible. */
function requestLock(manual = false) {
  if (TOUCH.on || PAD.drive) return;
  if (LOCK.fallback || document.pointerLockElement === canvas) return;
  // after an exit requested by the page (pause via Escape in fullscreen), the browser gives the capture back without a gesture
  if (!LOCK.scriptExit && !userGesture()) { if (!LOCK.quiet) showLockPrompt(true); return; }
  LOCK.pending = true; LOCK.manual = manual;
  lockAsk();
}
/* Pointer capture with raw movement (unadjustedMovement): without the system's acceleration or smoothing (Windows "Enhance pointer precision",
   macOS acceleration), the camera follows the hand at the same pace whatever the speed, and doesn't change from one machine to another. A
   browser that doesn't support it (Linux, old versions) refuses with NotSupportedError: we then request the ordinary capture again,
   and remember it (LOCK.rawNo). */
function lockAsk() {
  try {
    const p = LOCK.rawNo ? canvas.requestPointerLock() : canvas.requestPointerLock({ unadjustedMovement: true });
    if (p && p.catch) p.catch((err) => { if (!LOCK.rawNo && err && err.name === 'NotSupportedError') { LOCK.rawNo = true; lockAsk(); } else lockFailed(); });
  } catch (e) { if (!LOCK.rawNo) { LOCK.rawNo = true; lockAsk(); } else lockFailed(); }
}
function lockFailed() {
  // the rejected promise and the pointerlockerror event report the same refusal: count it only once
  if (!LOCK.pending || document.pointerLockElement === canvas) return;
  LOCK.pending = false;
  if (!LOCK.manual) {
    // automatic refusal (resume with Escape): the prompt is shown, and a new attempt follows once the browser's delay has passed
    if (!LOCK.quiet) showLockPrompt(true);
    setTimeout(() => { if (MATCH.state === 'playing' && !pointerActive()) requestLock(); }, 1400);
    return;
  }
  if (++LOCK.fails < 2) { showLockPrompt(true); return; }
  LOCK.fallback = true; showLockPrompt(false);
  $('lockNote').classList.add('show');
  setTimeout(() => $('lockNote').classList.remove('show'), 7000);
}
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) { LOCK.pending = false; LOCK.fails = 0; LOCK.quiet = false; LOCK.scriptExit = false; showLockPrompt(false); PL.noFireT = Math.max(PL.noFireT, performance.now() + 300); return; }
  if (MATCH.state !== 'playing' || LOCK.fallback) return;
  // capture lost at the moment of a resume: the browser undid the requested capture, it's not a player's Escape
  if (performance.now() - LOCK.resumeT < 500) return;
  pauseGame();
});
document.addEventListener('pointerlockerror', lockFailed);
$('lockPrompt').addEventListener('click', () => { LOCK.inputT = performance.now(); requestLock(true); });
// "Click to play": a key press (except Escape, which doesn't count as a gesture) also gives the capture back
addEventListener('keydown', (e) => {
  if (e.code !== 'Escape' && MATCH.state === 'playing' && ($('lockPrompt').classList.contains('show') || LOCK.quiet) && !pointerActive()) { LOCK.inputT = performance.now(); requestLock(true); }
});
addEventListener('keydown', (e) => {
  if (e.code === 'KeyP' && MATCH.state === 'playing') { if (document.pointerLockElement) { LOCK.scriptExit = true; document.exitPointerLock(); } else pauseGame(); }
});
document.addEventListener('mousemove', (e) => {
  if (!KS.map.open || document.pointerLockElement || (TOUCH.on && performance.now() - TOUCH.lastT < 800)) return; // (the mouse the browser simulates after a touch doesn't count)
  const r = $('tacCanvas').getBoundingClientRect(); if (!r.width) return;
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return; // free cursor off the map: the dot doesn't move (it used to slide to the edge)
  KS.map.x = clamp(MAP.x0 + ((e.clientX - r.left) / r.width) * (MAP.x1 - MAP.x0), MAP.x0 + 1, MAP.x1 - 1);
  KS.map.z = clamp(MAP.z0 + ((e.clientY - r.top) / r.height) * (MAP.z1 - MAP.z0), MAP.z0 + 1, MAP.z1 - 1);
});
canvas.addEventListener('click', () => { if (MATCH.state === 'playing' && !pointerActive()) requestLock(true); });

/* ---------- Menu ---------- */
let menuT = 0; // time of the aerial camera in class selection
function buildMenu() { menuInit(); } // screens, options, classes: see 09e-menus.js

/* One matrix update per frame: composer.render calls renderer.render about fifteen times (pre-pass, world, weapon, halo...) and each call
   on the scene walked all its objects again (matrixWorldAutoUpdate), i.e. 1.7 walks of some 900 objects per frame. We update them once, here,
   after all the frame's movements, then turn off the automatic update for the duration of the render. */
function renderFrame(dt) {
  scene.updateMatrixWorld(); vmScene.updateMatrixWorld();
  scene.matrixWorldAutoUpdate = false; vmScene.matrixWorldAutoUpdate = false;
  try { composer.render(dt); } finally { scene.matrixWorldAutoUpdate = true; vmScene.matrixWorldAutoUpdate = true; }
}
/* Bot update. At a high rate (HF.k > 1, see 01-core.js), each bot is only updated one frame in k, in alternation (the cost is spread
   over the frames rather than bunched), with the time elapsed since its last update: a bot's intelligence, movement, aiming and animation
   then run at 120 Hz on a 240 Hz screen, which nothing distinguishes from 240. */
function botsTick(dt, t) {
  const k = HF.k;
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i]; if (e.isPlayer) continue;
    e.hfDt = (e.hfDt || 0) + dt; // (remote players, created elsewhere, don't have the field)
    if (k > 1 && (frameN + i) % k !== 0) continue;
    const d = e.hfDt; e.hfDt = 0; updateBot(e, d, t);
  }
}
/* One match frame (in game, paused online, result announcement): time, rules, player, bots, projectiles, network;
   returns the time step (slowed during the result announcement). bg: simulation only, host tab in the background (hostBgTick);
   no tactical map, no HUD, no killcam recording */
function matchTick(dt, bg) {
  const outro = MATCH.state === 'finish';
  if (outro) dt *= outroTick(); // result announcement: the game continues behind it, in slow motion (09l-end.js)
  cdTick(); const hold = playHold(); // start countdown, host migration: the timer doesn't run, nor do points or score (09y-countdown.js)
  MATCH.time += dt; if (!outro && !hold) MATCH.timeLeft -= dt;
  const t = MATCH.time;
  for (let i = MATCH.events.length - 1; i >= 0; i--) if (MATCH.events[i].t <= t) { const ev = MATCH.events[i]; MATCH.events.splice(i, 1); ev.fn(); }
  uavTick(dt);
  if (!outro && !hold) modeUpdate(dt);
  pfrLap(3); updatePlayer(dt, t); pfrLap(0); // pfrLap: performance recorder steps (09zo-perfs.js)
  botsTick(dt, t); pfrLap(1);
  updateNades(dt); updateThrowKnives(dt); updateSmokes(dt); updateDrops(dt); updateProps(dt); pfrLap(2);
  updateKillstreak(dt); updateAircraft(dt);
  if (!bg) { drawTacMap(); if (TRIAL || TRIAL_MECHA) trialTick(dt); updateHud(dt); }
  if (!outro && MATCH.timeLeft <= 0) matchFinish();
  if (!bg && !(KC.active && KC.live)) kcRecord(); // online replay: frozen buffer
  netUpdate(dt);
  return dt;
}
/* Host of an online match whose tab goes to the background (another tab, another window, screen off): the browser stops calling
   requestAnimationFrame, and the match used to stop on their side; their bots, which only they run, stayed frozen for all players
   until their return (reported by a player: "at the start of the match, the bots are AFK"). A small worker then sets the pace (20 times per
   second: its messages aren't throttled like a hidden tab's timers) and the host runs the match, drawing nothing.
   A phone that suspends the browser stops everything: host migration then takes over (09c-net.js). */
const HOSTBG = { wk: null, last: 0 };
function hostBgInit() {
  if (HOSTBG.wk) return;
  try {
    const url = URL.createObjectURL(new Blob(['setInterval(function () { postMessage(0); }, 50);'], { type: 'text/javascript' }));
    HOSTBG.wk = new Worker(url);
    HOSTBG.wk.onmessage = hostBgTick;
  } catch (e) { HOSTBG.wk = null; } // no worker: as before, the match stops with the tab
}
function hostBgTick() {
  const now = performance.now(), dt = clamp((now - (HOSTBG.last || now)) / 1000, 0, 0.1); HOSTBG.last = now;
  if (!document.hidden || !MATCH.online || !NET.on || NET.role !== 'host') return;
  if (MATCH.state !== 'playing' && MATCH.state !== 'paused' && MATCH.state !== 'finish') return;
  const outro = MATCH.state === 'finish';
  matchTick(dt, true);
  if (outro && MATCH.outro && MATCH.outro.t >= OUTRO_LEN) outroDone();
}
/* ---------- Loop ---------- */
let lastT = performance.now(), frameN = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (GPUX.halt) return; // WebGL context lost during a match: nothing left to draw, the "3D display interrupted" window offers to restart (01a-gpu.js)
  vsyncTrack(now); if (capWait(now)) return; // frame rate limit, power saving (01-core.js)
  if (LAG.on && MATCH.state === 'playing' && lagSkip()) return; // the GPU hasn't finished the previous frame: we don't lengthen the queue, the mouse will be read next frame (01-core.js)
  capTake(now);
  if (TOUCH.on) touchTick();
  const t0 = performance.now(), interval = now - lastT;
  // time step never negative (frame timestamp earlier than the previous one): the exponential smoothings would diverge
  let dt = clamp(interval / 1000, 0, 0.05); lastT = now;
  if (PAD.seen) padTick(dt); // gamepad (09qc-gamepad.js)
  // menus: 3D scene not rendered, except at class selection (aerial view of the map); the animated background (09w-background.js) replaces the CSS image (#menuBg) once ready
  musicTick(dt); sfxTick(dt);
  CAMO_U.uCamoT.value = now / 1000; CAMO_U.uHoloFx.value = RQ.q.lean ? 0 : 1; // the Holo also drifts in the workshop showcase; its sparkles, not at Low quality (06q-camos.js)
  const aerial = MATCH.state === 'menu' && UI.screen === 'deploy';
  if (MATCH.state === 'menu' && !aerial) { menuBgShow(true); if (UI.screen === 'arsenal' && ARSUI.tab !== 'k') vwTick(dt); else if (UI.screen === 'skins') skinTick(); const drew = mbgDraw(dt); if (UI.screen === 'skins') skinLive(drew, dt); return; } // the class workshop draws the weapon in its frame (09o-showcase.js), then the animated background (09w-background.js), and on top, the Outfits screen its animated soldier (09u-outfits.js)
  menuBgShow(false);
  renderer.info.reset();
  if (PFR.on) { PFR.inFrame = true; PFR.lt = performance.now(); } // performance recorder (09zo-perfs.js)
  // objects created during a match (picked-up weapons, projectiles): admitted into the pre-pass one second later at most
  if (++frameN % 60 === 0) markPrepass(scene);
  const U = FinalShader.uniforms;
  if (aerial) {
    menuT += dt;
    const a = menuT * 0.035 + 0.6, r = CURMAP.def ? CURMAP.def.cam : 46;
    camera.position.set(Math.sin(a) * r * 0.75, 17 + Math.sin(menuT * 0.1) * 3, Math.cos(a) * r);
    camera.lookAt(0, 2, 0);
    if (Math.abs(camera.fov - Settings.fov) > 0.01) { camera.fov = Settings.fov; camera.updateProjectionMatrix(); }
    U.uDamage.value = 0; U.uHurt.value = 0; U.uDesat.value = 0.05;
  } else if (MATCH.state === 'playing' || MATCH.state === 'paused' || MATCH.state === 'finish') {
    const outro = MATCH.state === 'finish';
    dt = matchTick(dt, false); pfrLap(3);
    U.uDamage.value = Math.max(0, U.uDamage.value - dt * 0.9);
    const hurt = PL.ent.alive ? clamp(1 - PL.ent.health / 100, 0, 1) : 0.85;
    U.uHurt.value = damp(U.uHurt.value, hurt, hurt > U.uHurt.value ? 14 : 2.2, dt);
    U.uDesat.value = damp(U.uDesat.value, outro ? (MATCH.outro.out.result === 'loss' ? 0.55 : MATCH.outro.out.result === 'win' ? 0.12 : 0.3) : PL.ent.alive ? 0 : 0.85, 3, dt);
    if (KC.active && KC.live) { updateKillcam(dt); U.uDesat.value = damp(U.uDesat.value, 0.35, 3, dt); U.uHurt.value = damp(U.uHurt.value, 0, 3, dt); U.uDamage.value = 0; } // online death killcam: the match continues behind it
    if (outro && MATCH.outro.t >= OUTRO_LEN) outroDone(); // what follows (final killcam or results) changes the state: at the very end of the frame
  } else if (MATCH.state === 'killcam') {
    netUpdate(dt);
    updateKillcam(dt);
    U.uDesat.value = damp(U.uDesat.value, 0.35, 3, dt); U.uHurt.value = damp(U.uHurt.value, 0, 3, dt); U.uDamage.value = 0;
  } else if (MATCH.state === 'ended') {
    for (const e of entities) if (!e.isPlayer && !e.alive) animSoldier(e, dt);
    updateEnd(dt); if (MATCH.state !== 'ended') return;
    updateAircraft(dt); if (KS.map.open) ksCloseMap();
    const a = performance.now() * 0.00005;
    const r = (CURMAP.def ? CURMAP.def.cam : 46) * 0.65; camera.position.set(Math.sin(a) * r, 22, Math.cos(a) * r); camera.lookAt(0, 2, 0);
    VM.root.visible = false; U.uDesat.value = damp(U.uDesat.value, 0.3, 2, dt); U.uHurt.value = damp(U.uHurt.value, 0, 3, dt); PL.ent.model.root.visible = false;
  }
  U.uFlash.value = Math.max(0, U.uFlash.value - dt * 1.4);
  flashTick(dt); smokeView(); // blinded by a flash, in a smoke cloud (07-bots.js)
  U.uTime.value = now / 1000; CLOTH_U.uClT.value = now / 1000; WIND_U.uWnT.value = now / 1000; // cloth and flora in the wind (02mc-cloths.js, 02md-wind.js)
  skyMat.uniforms.uTime.value = now / 1000; mapUpdate(now / 1000, dt); updatePostFx();
  sky.position.copy(camera.position);
  updateFx(dt); updateFlashLights(dt);
  updateListener();
  allyMarksUpdate(); // ally markers (09m-markers.js): the camera is final
  updateSoldierLods(); clothUpdate(dt); updateMapDetail(); grassUpdate(now / 1000); // clothUpdate: soldiers' cloth (06gb-cloth.js), after the choice of detailed models
  pfrLap(4); updateShadows(); pfrLap(5);
  if (GPUT) GPUT.begin();
  renderFrame(dt); pfrLap(6);
  if (GPUT) GPUT.end();
  lagMark();
  gpuFrame(now);
  updateDynRes(now, interval, performance.now() - t0);
  if (PFR.on) pfrFrame(now, interval, performance.now() - t0);
  if (Settings.perf) updatePerfHud();
}
/* Performance indicator ("Show performance" setting) */
let perfT = 0;
function updatePerfHud() {
  const t = performance.now(); if (t - perfT < 250) return; perfT = t;
  const el = $('perf'), i = renderer.info.render, st = dynStat();
  el.textContent = `${_t('{0} fps', Math.round(st.fps))} · ${st.ms.toFixed(1)} ms · ${_t('worst {0} ms (CPU {1})', st.worst.toFixed(1), st.worstC.toFixed(1))} · CPU ${DYN.cpu.toFixed(1)} ms${DYN.gpu ? ' · GPU ' + DYN.gpu.toFixed(1) + ' ms' : ''}\n` +
    `${RQ.q.label}${QUALITY[gfxSet('quality')] ? '' : ' ' + _t('(auto)')}${LAG.on ? ' · ' + _t('short queue') : ''}${LAG.n ? ' · ' + _tn(LAG.n, '{0} frame skipped', '{0} frames skipped') : ''} · ${_t('render {0}%', Math.round(renderPixelRatio() / canvasPixelRatio() * 100))} · ${_t('{0} draw calls', i.calls)} · ${_t('{0}k triangles', Math.round(i.triangles / 1000))}`;
}

/* Full render during loading: also compiles what renderer.compile doesn't see (pre-pass variants,
   shadows of animated bodies, sun rays), otherwise compiled the first time a match is displayed. */
function warmupRender() {
  const saved = [], U = FinalShader.uniforms, sun = U.uSunOn.value;
  for (const M of [...entities.map((e) => e.model), KC.body]) {
    if (!M || !M.lod) continue;
    saved.push([M.root, M.root.visible, M.root.frustumCulled, M.root.layers.mask]); M.root.visible = true;
    // the two levels of detail of the body and weapon, shown together while their variants compile
    for (const m of [M.lod.hi, M.lod.lo, ...(M.gun ? M.gun.children : [])]) if (m) {
      saved.push([m, m.visible, m.frustumCulled, m.layers.mask]);
      m.frustumCulled = false; m.visible = true; m.layers.mask = MASK_SCREEN;
    }
  }
  U.uSunOn.value = 1;
  for (const lit of RQ.q.lights > 0 ? [true, false] : [false]) {
    setFlashLightsVisible(lit); updateShadows();
    for (const l of csm.lights) l.shadow.needsUpdate = true;
    renderer.shadowMap.needsUpdate = true; renderer.info.reset(); composer.render(0);
  }
  for (const [m, v, fc, mask] of saved.reverse()) { m.visible = v; m.frustumCulled = fc; m.layers.mask = mask; }
  U.uSunOn.value = sun; setFlashLightsVisible(false);
}
/* Shadow warm-up: a material's depth program depends on its side (a front face casts its shadow through its back
   face, a double-sided material both) and is only compiled the first time one of its objects passes through a cascade. warmupRender only sees
   the cascades around the loading camera: the others were compiled mid-match (October 2026 probe: a Chergui canvas, the Sirocco well
   bucket, the Port-Maël boats, 13 to 32 ms at once). A tiny triangle per shadow-casting material (instanced if the object is),
   no culling, rendered with its shadows through the game's frame chain (composer.render: a direct render didn't give the same variants),
   with and without muzzle flashes (three.js counts lights even in a depth program's key), the rest of the scene hidden: the programs are
   ready, almost nothing is drawn (safe on phones). The cascades are
   redrawn on the next frame.
   Each material first receives its own depth material (depthOwn): three.js shared a single one among all objects, copying the object's side and
   texture onto it without saying so; the program picked then depended on draw order, and a variant
   never drawn at load time was compiled mid-match. */
const DEPTH_OWN = new Map();
function depthOwn(m) {
  let d = DEPTH_OWN.get(m);
  if (!d) { d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }); d.uuid = 'depth-' + m.uuid; DEPTH_OWN.set(m, d); }
  return d;
}
function shadowWarm() {
  if (!csm || !renderer.shadowMap.enabled) return;
  const seen = new Map();
  scene.traverse((o) => {
    if (!o.castShadow || !o.material || !o.isMesh || o.isSkinnedMesh || Array.isArray(o.material)) return;
    if (!o.customDepthMaterial) o.customDepthMaterial = depthOwn(o.material);
    const m = o.material, k = m.uuid + (o.isInstancedMesh ? '|i' : '');
    if (!seen.has(k)) seen.set(k, [m, o.isInstancedMesh, o.customDepthMaterial]);
  });
  const geo = new THREE.BufferGeometry(), tmp = new THREE.Group();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.001, 0, 0, 0, 0.001, 0], 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
  for (const [m, inst, cd] of seen.values()) {
    const d = inst ? new THREE.InstancedMesh(geo, m, 1) : new THREE.Mesh(geo, m);
    if (inst) d.setMatrixAt(0, new THREE.Matrix4());
    d.castShadow = true; d.frustumCulled = false; if (cd) d.customDepthMaterial = cd;
    d.position.copy(camera.position); tmp.add(d);
  }
  const vis = scene.children.map((c) => c.visible), sm = renderer.shadowMap;
  scene.children.forEach((c) => { if (!c.isLight) c.visible = false; });
  scene.add(tmp); scene.updateMatrixWorld(true);
  try {
    for (const lit of RQ.q.lights > 0 ? [true, false] : [false]) {
      setFlashLightsVisible(lit); updateShadows();
      for (const l of csm.lights) l.shadow.needsUpdate = true;
      sm.needsUpdate = true; composer.render(0);
    }
  } finally {
    scene.remove(tmp); setFlashLightsVisible(false);
    scene.children.forEach((c, i) => { c.visible = vis[i]; });
    for (const l of csm.lights) l.shadow.needsUpdate = true; // the maps only show the triangles: redrawn on the next frame
    sm.needsUpdate = true;
    for (const d of tmp.children) if (d.isInstancedMesh) d.dispose();
    geo.dispose();
  }
}

/* ---------- Loading ---------- */
const BOOT_T = [];
/* Startup: the base common to all maps, then the menu. Maps are loaded when a match is launched
   (09a-loading.js). */
async function boot() {
  // duration of each step (ms), viewable in the console: BOOT_T
  let tStep = performance.now(), lastMsg = 'start';
  PRE.booted = true; // startup has begun (the check in 00b-preflight.js no longer handles it)
  // context lost during the install window and not yet restored: we wait for it before building anything on it (01a-gpu.js)
  if (gpuLostNow()) { gpuLog('boot waits for the context'); await gpuRestored(10000); }
  GPUX.booting = true; gpuLog('boot');
  const step = (msg, p) => new Promise((r) => {
    const t = performance.now(); BOOT_T.push([lastMsg, Math.round(t - tStep)]); tStep = t; lastMsg = msg; gpuLog('boot: ' + msg);
    $('loadMsg').textContent = msg; $('loadBar').style.transform = `scaleX(${p / 100})`; setTimeout(r, 20);
  });
  try {
    await step(_t('Preparing effects'), 5);
    const scan = gearScanLoad(); // outfit cloth scans (06e-gear.js), decoded during the following steps
    FXT = buildFxTextures();
    await step(_t('Lighting the scene'), 20);
    setupComposer(); buildEnvironment(); initFx();
    // HDRI lighting of the last map chosen: downloaded in the background, awaited by its loading
    { const h = MAP_DEFS[mapById(Settings.map).id].atmo.hdri; if (h) hdriFetch(h); }
    await step(_t('Preparing soldiers'), 45);
    await scan;
    buildGunTextures(); initViewmodel();
    // held weapons and externally viewed weapons of the available classes built at startup (and at each edit of a class
    // in the workshop): no construction during the match (a weapon change froze it for 8 to 22 ms)
    classFix(); arsenalPrebuild(); setTimeout(thumbsStart, 1500); // weapon thumbnails (09o-showcase.js), one per task
    soldierPrebuild(); // the four outfits (06ga-outfits.js), seen by an ally and by an enemy
    for (let i = 0; i < 5; i++) makeBot(0, i);
    for (let i = 0; i < 6; i++) makeBot(1, i);
    vmEquip(WEAPONS.m4); VM.root.visible = false;
    PL.ent.model = makeSoldier(skinOf(PL.ent), 0, 'm4', { shadowOnly: true }); PL.ent.model.root.visible = false;
    KC.body = makeSoldier(skinOf(PL.ent), 0, 'm4'); KC.body.root.visible = false; KC.bodyEnt = { model: KC.body, pos: new V3(), yaw: 0, alive: false, lastForce: null };
    kcInit();
    setupShadows(); soldierMatsCsm(); nadeWarm(); ksWarm();
    await step(_t('Preparing menus'), 85);
    buildTabletRig(); buildPhoneRig();
    buildMenu();
    await step(_t('Ready'), 100);
    GPUX.booted = true; GPUX.booting = false;
    MATCH.state = 'menu';
    $('loading').classList.add('hidden'); uiOpen('main'); newsPopup(); acctArrive(); ecoAsk(); // "What's new" window; links received by email (09j-account.js); touch power saving (09zl-economy.js)
    if (/[?&]diag\b/.test(location.search)) gpuReport(); // ?diag: graphics report (01a-gpu.js)
    setTimeout(gpuResume, 400); // solo match interrupted by an automatic reload (01a-gpu.js)
    requestAnimationFrame(frame);
    netAutoJoin();
  } catch (err) {
    console.error(err);
    $('loadMsg').textContent = _t('Loading failed: {0}. Reload the page or set quality to Low.', err.message);
    $('loadFail').classList.remove('hidden'); $('loadSafe').classList.toggle('hidden', GFX_SAFE);
    $('loadSafe').onclick = () => { Settings.gfxSafe = true; Settings.gfxSafeAuto = BUILD; saveSettings(); location.reload(); }; $('loadRep').onclick = () => gpuReport();
  }
}
/* The startup itself is launched by 99-start.js, once all the modules are loaded */
