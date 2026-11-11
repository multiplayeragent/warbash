/* ==========================================================================
   CHALLENGES: what unlocks the challenge outfits (06gc-outfits-challenge.js, 06gf-outfits-maps.js, 06gg-outfits-play.js), three challenges
   per outfit. They push players to try each weapon family, the game modes, the killstreaks and the maps (the Yellow Vest: the French maps;
   each map outfit: its own map); neither too easy nor discouraging (around ten to fifteen matches per outfit), all of them reachable in solo
   against bots as well as online. An outfit unlocks when its three challenges are completed; counters start at zero (nothing played
   before the challenges counts).
   Counted during the match, when the action happens (player kill: killEnt, challengesKill; killstreak called: useUAV, ksPress and ksConfirm,
   challengesKs; point captured: domChanged, challengesCapture; match finished: endMatch, challengesMatchEnd), in solo as online; a
   completed challenge and an unlocked outfit are announced like weapon unlocks (arsShow), the end screen summarizes the match's progress.
   Kept with weapon progression (ARS.ch: counters, ARS.chMaps: maps where a match was finished; 06r-arsenal.js,
   arsSnapshot and arsApply): in the browser and, when logged in, on the account (the highest of each counter wins on
   merge). Like weapon progression, no server authority: they are only outfits. A counter id is letters only, 16 at most (arsApply).
   ========================================================================== */
/* id, unlocked outfit, goal, label (what is counted), hint (how to get there) */
const CHALLENGES = [
  { id: 'nShotgun', skin: 'nomad', goal: 100, label: _t('Shotgun kills') },
  { id: 'nMelee', skin: 'nomad', goal: 20, label: _t('Knife or grenade kills') },
  { id: 'nFfa', skin: 'nomad', goal: 5, label: _t('Free-for-all matches finished in the top three'), hint: _t('Free-for-all mode, solo or online') },
  { id: 'tPrec', skin: 'tempest', goal: 100, label: _t('Sniper rifle kills') },
  { id: 'tFar', skin: 'tempest', goal: 15, label: _t('Kills from 50 m or more') },
  { id: 'tUav', skin: 'tempest', goal: 5, label: _t('UAV drones called in'), hint: _t('The drone is earned with a 4-kill streak') },
  { id: 'fSil', skin: 'verdant', goal: 75, label: _t('Suppressed kills'), hint: _t('The suppressor unlocks at weapon level 4, in the class workshop') },
  { id: 'fAcc', skin: 'verdant', goal: 40, label: _t('Crouched kills') },
  { id: 'fMaps', skin: 'verdant', goal: MAPS.filter((m) => m.ok).length, label: _t('Maps where you finished a match') },
  { id: 'rPm', skin: 'raptor', goal: 150, label: _t('Submachine gun kills') },
  { id: 'rMouv', skin: 'raptor', goal: 25, label: _t('Kills while sliding or mid-jump') },
  { id: 'rDouble', skin: 'raptor', goal: 15, label: _t('Double kills'), hint: _t('Two kills less than 4 seconds apart') },
  { id: 'vFa', skin: 'void', goal: 200, label: _t('Assault rifle kills') },
  { id: 'vPist', skin: 'void', goal: 50, label: _t('Pistol kills') },
  { id: 'vDom', skin: 'void', goal: 25, label: _t('Points captured in Domination') },
  { id: 'gMatches', skin: 'yellowVest', goal: 12, label: _t('Matches finished on a French map'), hint: _t('Saint-Givre, Port-Maël or Bel-Horizon') },
  { id: 'gVict', skin: 'yellowVest', goal: 5, label: _t('Wins on a French map'), hint: _t('Saint-Givre, Port-Maël or Bel-Horizon') },
  { id: 'gElim', skin: 'yellowVest', goal: 150, label: _t('Kills on a French map') },
  // map outfits: kills and wins on their map, and a feat there
  { id: 'drKill', skin: 'duneRider', goal: 75, label: _t('Kills on Chergui') },
  { id: 'drWin', skin: 'duneRider', goal: 4, label: _t('Wins on Chergui'), hint: _t('Any mode, solo or online') },
  { id: 'drFar', skin: 'duneRider', goal: 20, label: _t('Kills from 30 m or more on Chergui') },
  { id: 'woKill', skin: 'whiteout', goal: 75, label: _t('Kills on Saint-Givre') },
  { id: 'woWin', skin: 'whiteout', goal: 4, label: _t('Wins on Saint-Givre'), hint: _t('Any mode, solo or online') },
  { id: 'woCrouch', skin: 'whiteout', goal: 20, label: _t('Crouched kills on Saint-Givre') },
  { id: 'coKill', skin: 'corsair', goal: 75, label: _t('Kills on Port-Maël') },
  { id: 'coWin', skin: 'corsair', goal: 4, label: _t('Wins on Port-Maël'), hint: _t('Any mode, solo or online') },
  { id: 'coKnife', skin: 'corsair', goal: 8, label: _t('Knife kills on Port-Maël'), hint: _t('Throwing knives count too') },
  { id: 'brKill', skin: 'briar', goal: 75, label: _t('Kills on Floralia') },
  { id: 'brWin', skin: 'briar', goal: 4, label: _t('Wins on Floralia'), hint: _t('Any mode, solo or online') },
  { id: 'brSil', skin: 'briar', goal: 20, label: _t('Suppressed kills on Floralia'), hint: _t('The suppressor unlocks at weapon level 4, in the class workshop') },
  { id: 'arKill', skin: 'argonaut', goal: 75, label: _t('Kills on Notos') },
  { id: 'arWin', skin: 'argonaut', goal: 4, label: _t('Wins on Notos'), hint: _t('Any mode, solo or online') },
  { id: 'arHead', skin: 'argonaut', goal: 25, label: _t('Headshot kills on Notos') },
  { id: 'ciKill', skin: 'cinder', goal: 75, label: _t('Kills on Scoria') },
  { id: 'ciWin', skin: 'cinder', goal: 4, label: _t('Wins on Scoria'), hint: _t('Any mode, solo or online') },
  { id: 'ciBoom', skin: 'cinder', goal: 8, label: _t('Grenade or airstrike kills on Scoria'), hint: _t('The airstrike is earned with an 8-kill streak') },
  { id: 'stKill', skin: 'stratos', goal: 75, label: _t('Kills on Cirrus') },
  { id: 'stWin', skin: 'stratos', goal: 4, label: _t('Wins on Cirrus'), hint: _t('Any mode, solo or online') },
  { id: 'stAir', skin: 'stratos', goal: 12, label: _t('Kills while in the air on Cirrus'), hint: _t('Jump or drop off a ledge, then shoot') },
  { id: 'svKill', skin: 'sandveil', goal: 75, label: _t('Kills on Sirocco') },
  { id: 'svWin', skin: 'sandveil', goal: 4, label: _t('Wins on Sirocco'), hint: _t('Any mode, solo or online') },
  { id: 'svDouble', skin: 'sandveil', goal: 5, label: _t('Double kills on Sirocco'), hint: _t('Two kills less than 4 seconds apart') },
  { id: 'dpKill', skin: 'duskPatrol', goal: 75, label: _t('Kills on Bel-Horizon') },
  { id: 'dpWin', skin: 'duskPatrol', goal: 4, label: _t('Wins on Bel-Horizon'), hint: _t('Any mode, solo or online') },
  { id: 'dpCap', skin: 'duskPatrol', goal: 8, label: _t('Points captured in Domination on Bel-Horizon') },
  { id: 'jaKill', skin: 'jaguar', goal: 75, label: _t('Kills on Selva') },
  { id: 'jaWin', skin: 'jaguar', goal: 4, label: _t('Wins on Selva'), hint: _t('Any mode, solo or online') },
  { id: 'jaClose', skin: 'jaguar', goal: 20, label: _t('Kills within 5 m on Selva') },
  // play-style outfits
  { id: 'bwStreak', skin: 'bulwark', goal: 8, label: _t('5-kill streaks'), hint: _t('Five kills in a row without dying') },
  { id: 'bwSolid', skin: 'bulwark', goal: 4, label: _t('Matches with 8 kills or more and 3 deaths or fewer') },
  { id: 'bwLow', skin: 'bulwark', goal: 20, label: _t('Kills while under a third of your health'), hint: _t('Your health comes back after a few seconds out of fire') },
  { id: 'sbWin', skin: 'standard', goal: 5, label: _t('Domination wins') },
  { id: 'sbOn', skin: 'standard', goal: 30, label: _t('Kills while standing in a Domination point') },
  { id: 'sbAll', skin: 'standard', goal: 4, label: _t('Times your team held all three points'), hint: _t('In Domination, A, B and C held by your team at the same time') },
  { id: 'spNade', skin: 'sapper', goal: 20, label: _t('Grenade kills') },
  { id: 'spAir', skin: 'sapper', goal: 10, label: _t('Airstrike kills'), hint: _t('The airstrike is earned with an 8-kill streak') },
  { id: 'spMulti', skin: 'sapper', goal: 4, label: _t('Double kills with explosives'), hint: _t('Two kills less than a second apart with grenades or the airstrike') },
  { id: 'skCall', skin: 'skyhook', goal: 12, label: _t('Killstreaks called in'), hint: _t('Every kind counts, the UAV included') },
  { id: 'skKill', skin: 'skyhook', goal: 15, label: _t('Killstreak kills'), hint: _t('Airstrike, helicopter, kamikaze drone or mecha') },
  { id: 'skRadar', skin: 'skyhook', goal: 30, label: _t('Kills while an allied UAV or satellite is up'), hint: _t('Called by you or by a teammate') },
  { id: 'maHead', skin: 'marshal', goal: 25, label: _t('Pistol headshot kills') },
  { id: 'maHeavy', skin: 'marshal', goal: 30, label: _t('Desert Eagle or USP .45 kills') },
  { id: 'maFar', skin: 'marshal', goal: 10, label: _t('Pistol kills from 25 m or more') },
  { id: 'shKnife', skin: 'shade', goal: 25, label: _t('Knife kills') },
  { id: 'shThrow', skin: 'shade', goal: 8, label: _t('Throwing knife kills'), hint: _t('Pick throwing knives as the grenade of a custom class') },
  { id: 'shBack', skin: 'shade', goal: 30, label: _t('Kills on enemies facing away from you') },
  { id: 'auXp', skin: 'aurum', goal: 30000, label: _t('Weapon XP earned'), hint: _t('100 per kill with a weapon, 150 with a headshot') },
  { id: 'auMvp', skin: 'aurum', goal: 4, label: _t('Matches finished first on the scoreboard') },
  { id: 'auHead', skin: 'aurum', goal: 60, label: _t('Headshot kills') },
  { id: 'trClose', skin: 'trapper', goal: 40, label: _t('Kills within 5 m') },
  { id: 'trHip', skin: 'trapper', goal: 40, label: _t('Kills without aiming down the sights'), hint: _t('Fire from the hip') },
  { id: 'trShot', skin: 'trapper', goal: 15, label: _t('Shotgun headshot kills') },
  { id: 'cuTriple', skin: 'circuit', goal: 5, label: _t('Triple kills'), hint: _t('Three kills, each less than 4 seconds after the one before') },
  { id: 'cuLand', skin: 'circuit', goal: 20, label: _t('Kills within 3 seconds of landing a jump') },
  { id: 'cuSlide', skin: 'circuit', goal: 20, label: _t('Kills within 3 seconds after a slide') },
  { id: 'ogModes', skin: 'oldGuard', goal: 6, label: _t('Wins in every mode, two in each'), hint: _t('Team deathmatch, free for all and Domination') },
  { id: 'ogMaps', skin: 'oldGuard', goal: 6, label: _t('Maps where you won a match') },
  { id: 'ogVet', skin: 'oldGuard', goal: 8, label: _t('Wins against Veteran bots'), hint: _t('Veteran is the highest bot level, in Solo or in the lobby') },
];
/* French maps (Yellow Vest challenges): the pass station, the Breton harbor, the housing estate */
const CHALLENGE_FR = ['saintgivre', 'portmael', 'belhorizon'];
/* The map of each map outfit, by the prefix of its challenges (<prefix>Kill, <prefix>Win) */
const CHALLENGE_MAPS = { chergui: 'dr', saintgivre: 'wo', portmael: 'co', floralia: 'br', notos: 'ar', scoria: 'ci', cirrus: 'st', sirocco: 'sv', belhorizon: 'dp', outpost: 'ja' };
/* Challenges kept on hidden sub-counters (Old Guard: a win per mode, per map), each sub-counter capped: progress is their sum */
const CHALLENGE_SUB = {
  ogModes: { keys: () => MODE_IDS.map((m) => 'ogW' + m), cap: 2 },
  ogMaps: { keys: () => MAPS.filter((m) => m.ok).map((m) => 'ogM' + m.id), cap: 1 },
};
const CHALLENGE_BY_ID = {}; for (const d of CHALLENGES) CHALLENGE_BY_ID[d.id] = d;
/* Player moments read by the challenges (08-player.js writes them): last landing after a jump or a fall, end of the last slide, last
   explosive kill (double kills with explosives), life in which a 5-kill streak was counted; reset at each match (arsSessionReset) */
const CHX = { landT: -99, slideT: -99, airT: 0, boomT: -99, boomDone: false, streakLife: -1 };
function challengesReset() { CHX.landT = CHX.slideT = CHX.boomT = -99; CHX.airT = 0; CHX.boomDone = false; CHX.streakLife = -1; }
/* Progress of a challenge (capped at its goal) */
function challengeCount(id) {
  const D = CHALLENGE_BY_ID[id]; if (!D) return 0;
  const S = CHALLENGE_SUB[id];
  const n = id === 'fMaps' ? ARS.chMaps.filter((m) => MAPS.some((x) => x.id === m && x.ok)).length
    : S ? S.keys().reduce((a, k) => a + Math.min(S.cap, ARS.ch[k] || 0), 0) : ARS.ch[id] || 0;
  return Math.min(D.goal, n);
}
const challengeDone = (id) => challengeCount(id) >= CHALLENGE_BY_ID[id].goal;
const challengesOf = (skin) => CHALLENGES.filter((d) => d.skin === skin);
/* Is an outfit available to the player: base ones always, challenge ones once their challenges are completed, a unique outfit
   (06gd-outfit-unique.js) only for the one logged-in account that owns it (username verified by the server, me). Review: on the preview
   address (PREVIEW_HOST, 06r-arsenal.js) with ?outfits in the address, every challenge outfit can be worn (never on the published game) */
function skinUnlocked(s) {
  const K = SKINS[s]; if (!K) return false;
  if (K.owner) return !!(ACCT.user && String(ACCT.user.username).toLowerCase() === K.owner);
  if (K.challenge && SKIN_PREVIEW) return true;
  return !K.challenge || challengesOf(s).every((d) => challengeDone(d.id));
}
const SKIN_PREVIEW = PREVIEW_HOST && /[?&]outfits\b/.test(location.search);
/* The player's outfit: the one they chose if available, otherwise Assault (choice from another device, challenges not completed here) */
function skinMine() { const s = skinId(Settings.skin); return skinUnlocked(s) ? s : 'assault'; }

/* ---------- Progress ---------- */
/* Adds n to challenge id; announces the completed challenge, then the unlocked outfit. fMaps: n is the map; a challenge on
   sub-counters (CHALLENGE_SUB): n is the sub-counter */
function challengeAdd(id, n = 1) {
  const D = CHALLENGE_BY_ID[id]; if (!D || challengeDone(id)) return;
  const was = skinUnlocked(D.skin), S = CHALLENGE_SUB[id];
  if (id === 'fMaps') { if (ARS.chMaps.includes(n)) return; ARS.chMaps.push(n); n = 1; } // (n: the map)
  else if (S) {
    if (!S.keys().includes(n)) return;
    const c0 = challengeCount(id); ARS.ch[n] = Math.min(S.cap, (ARS.ch[n] || 0) + 1); n = challengeCount(id) - c0;
    if (n <= 0) return;
  } else ARS.ch[id] = Math.min(D.goal, (ARS.ch[id] || 0) + n);
  ARS.chSess[id] = (ARS.chSess[id] || 0) + n;
  arsSaveSoon();
  if (!challengeDone(id)) return;
  arsShow(`<b>${_t('Challenge complete')}</b><span>${esc(D.label)} : ${fmtNum(D.goal)}</span>`);
  if (!was && skinUnlocked(D.skin)) {
    arsShow(`<b>${_t('Outfit unlocked: {0}', SKINS[D.skin].name)}</b><span>${_t('Wear it from the Outfits screen')}</span>`);
    if (typeof skinRefresh === 'function') skinRefresh();
  }
}
/* Is victim v facing away from attacker a (a within 60 degrees of the back of v) */
function challengeBehind(a, v) {
  const dx = a.pos.x - v.pos.x, dz = a.pos.z - v.pos.z, l = hyp(dx, dz) || 1;
  return (-Math.sin(v.yaw || 0) * dx - Math.cos(v.yaw || 0) * dz) / l < -0.5;
}
/* Is soldier e standing in a Domination point's zone */
const challengeOnPoint = (e) => MATCH.mode === 'dom' && DOM.pts.some((p) => Math.abs(e.pos.y - p.y) <= DOM.dy && hyp(e.pos.x - p.x, e.pos.z - p.z) <= DOM.rad);
/* A player kill (killEnt): weapon or means, distance, stance and movement at the moment of the shot, health, streak, map */
function challengesKill(a, v, weapon, head) {
  const wid = WEAPON_ID_BY_NAME[weapon], cat = wid ? WEAPONS[wid].cat : null, W = NET_WSPECIAL, t = MATCH.time, d = a.pos.distanceTo(v.pos);
  const pre = CHALLENGE_MAPS[CURMAP.id], boom = weapon === W.nade || weapon === W.air;
  if (weapon === W.knife || weapon === W.nade) challengeAdd('nMelee');
  if (a.comboN === 2) challengeAdd('rDouble'); // once per chain, at the second kill (whatever the means)
  if (a.comboN === 3) challengeAdd('cuTriple');
  if (CHALLENGE_FR.includes(CURMAP.id)) challengeAdd('gElim');
  // any means: map, streak, health, Domination point, killstreaks, explosives, knives, range, facing away
  if (pre) {
    challengeAdd(pre + 'Kill');
    if (pre === 'sv' && a.comboN === 2) challengeAdd('svDouble');
    if (pre === 'ja' && d <= 5) challengeAdd('jaClose');
    if (pre === 'ci' && boom) challengeAdd('ciBoom');
    if (pre === 'co' && (weapon === W.knife || weapon === W.tknife)) challengeAdd('coKnife');
    if (pre === 'ar' && head) challengeAdd('arHead');
  }
  if (a.streak === 5 && CHX.streakLife !== a.spawnAt) { CHX.streakLife = a.spawnAt; challengeAdd('bwStreak'); } // (once per life: a helicopter kill leaves the streak at 5)
  if (a.alive && a.health < 100 / 3) challengeAdd('bwLow');
  if (challengeOnPoint(a)) challengeAdd('sbOn');
  if (weapon === W.nade) challengeAdd('spNade');
  if (weapon === W.air) challengeAdd('spAir');
  if (boom) {
    if (t - CHX.boomT < 1 && t >= CHX.boomT) { if (!CHX.boomDone) { challengeAdd('spMulti'); CHX.boomDone = true; } } else CHX.boomDone = false;
    CHX.boomT = t;
  }
  if (weapon === W.air || weapon === W.heli || weapon === W.drone || weapon === W.mecha) challengeAdd('skKill');
  if (MATCH.uav && ((MATCH.uav[a.team] > 0 && !ksJammed(a.team)) || satOn(a.team))) challengeAdd('skRadar');
  if (weapon === W.knife) challengeAdd('shKnife');
  if (weapon === W.tknife) challengeAdd('shThrow');
  if (challengeBehind(a, v)) challengeAdd('shBack');
  if (head) challengeAdd('auHead');
  if (d <= 5) challengeAdd('trClose');
  if (!cat) return; // the rest only applies to a weapon (not the airstrike, the helicopter or a fall)
  challengeAdd({ shotgun: 'nShotgun', sniper: 'tPrec', smg: 'rPm', ar: 'vFa', pistol: 'vPist' }[cat]);
  challengeAdd('auXp', ARS_XP.kill + (head ? ARS_XP.head : 0));
  if (d >= 50) challengeAdd('tFar');
  const Wc = curW(), sil = Wc && Wc.def.id === wid && Wc.def.silent;
  if (sil) challengeAdd('fSil');
  const slide = (a.slideT || 0) > 0;
  if (a.crouch && !slide) { challengeAdd('fAcc'); if (pre === 'wo') challengeAdd('woCrouch'); }
  if (slide || !a.onGround) challengeAdd('rMouv');
  if (pre === 'dr' && d >= 30) challengeAdd('drFar');
  if (pre === 'br' && sil) challengeAdd('brSil');
  if (pre === 'st' && !a.onGround) challengeAdd('stAir');
  if (cat === 'pistol') { if (head) challengeAdd('maHead'); if (d >= 25) challengeAdd('maFar'); if (wid === 'deagle' || wid === 'usp') challengeAdd('maHeavy'); }
  if (!a.adsActive) challengeAdd('trHip');
  if (cat === 'shotgun' && head) challengeAdd('trShot');
  if (a.onGround && !slide) {
    if (t - CHX.landT <= 3 && t >= CHX.landT) challengeAdd('cuLand');
    if (t - CHX.slideT <= 3 && t >= CHX.slideT) challengeAdd('cuSlide');
  }
}
/* A killstreak called in by the player (its effect starts: phone pressed, strike or drop zone confirmed) */
function challengesKs() { challengeAdd('skCall'); }
/* A Domination point captured by the player's team (domChanged): with the player in the zone (captured), and all three held */
function challengesCapture(mine, all) {
  if (mine) { challengeAdd('vDom'); if (CURMAP.id === 'belhorizon') challengeAdd('dpCap'); }
  if (all) challengeAdd('sbAll');
}
/* End of a match played to completion (endMatch): deathmatch rank, map played, victory (result: 'win', 'loss' or 'draw') */
function challengesMatchEnd(result, rank) {
  const me = PL.ent, win = result === 'win', pre = CHALLENGE_MAPS[CURMAP.id];
  if (MATCH.mode === 'ffa' && rank <= 3) challengeAdd('nFfa');
  if (CURMAP.id) challengeAdd('fMaps', CURMAP.id);
  if (CHALLENGE_FR.includes(CURMAP.id)) { challengeAdd('gMatches'); if (win) challengeAdd('gVict'); }
  if (me.kills >= 8 && me.deaths <= 3) challengeAdd('bwSolid');
  if (rank === 1) challengeAdd('auMvp');
  if (!win) return;
  if (pre) challengeAdd(pre + 'Win');
  if (MATCH.mode === 'dom') challengeAdd('sbWin');
  challengeAdd('ogModes', 'ogW' + MATCH.mode);
  if (CURMAP.id) challengeAdd('ogMaps', 'ogM' + CURMAP.id);
  const top = DIFF.length - 1, vet = MATCH.online ? !!(NET.cfg.bots && +NET.cfg.diff === top) : +Settings.difficulty === top;
  if (vet) challengeAdd('ogVet');
}
/* End screen: the challenges that progressed during the match, completed ones first, then by outfit; beyond CHALLENGE_END_MAX rows, the
   rest is summed up in one line (a match on a map with its own outfit can move a dozen at once) */
const CHALLENGE_END_MAX = 4;
function challengesEndHtml() {
  const L = CHALLENGES.filter((d) => ARS.chSess[d.id] > 0).map((d) => ({ d, n: challengeCount(d.id) })).sort((x, y) => (y.n >= y.d.goal) - (x.n >= x.d.goal) || y.n / y.d.goal - x.n / x.d.goal);
  // a row: the challenge, the gain (or Done), its count, its outfit, each in its own column; then one line: how far the outfits of these rows
  // now are from unlocking (two at most), and the rest summed up
  const shown = L.slice(0, CHALLENGE_END_MAX), rows = shown.map(({ d, n }) => {
    const ok = n >= d.goal;
    return `<div class="ars-row${ok ? ' done' : ''}"><b>${esc(d.label)}</b><span>${ok ? `<em>${_t('Done')}</em>` : `+${fmtNum(ARS.chSess[d.id])}`}</span><i>${fmtNum(n)} / ${fmtNum(d.goal)}</i><u>${SKINS[d.skin].name}</u></div>`;
  });
  const far = [...new Set(shown.map(({ d }) => d.skin))].slice(0, 2).map((s) => {
    const D = challengesOf(s), k = D.filter((x) => challengeDone(x.id)).length, nm = `<b>${SKINS[s].name}</b>`;
    return skinUnlocked(s) ? _t('{0} unlocked: wear it from the Outfits screen', nm) : _t('{0}: {1} of {2} done', nm, k, D.length);
  });
  const more = L.length - rows.length;
  if (far.length || more > 0) rows.push(`<div class="end-ch-sum"><span>${far.join(' · ')}</span>${more > 0 ? `<span class="more">${_tn(more, '{0} more challenge progressed', '{0} more challenges progressed')}</span>` : ''}</div>`);
  return rows.join('');
}
