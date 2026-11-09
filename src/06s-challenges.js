/* ==========================================================================
   CHALLENGES: what unlocks the challenge outfits (06gc-outfits-challenge.js), three challenges per outfit. They push players to try each
   weapon family, the game modes, the killstreaks and the maps (the Yellow Vest: the French maps); neither too easy nor discouraging (around ten to fifteen
   matches per outfit). An outfit unlocks when its three challenges are completed; counters start at zero (nothing played
   before the challenges counts).
   Counted during the match, when the action happens (player kill: killEnt, challengesKill; UAV drone: useUAV;
   point captured: domChanged; match finished: endMatch, challengesMatchEnd), in solo as online; a completed challenge and an
   unlocked outfit are announced like weapon unlocks (arsShow), the end screen summarizes the match's progress.
   Kept with weapon progression (ARS.ch: counters, ARS.chMaps: maps where a match was finished; 06r-arsenal.js,
   arsSnapshot and arsApply): in the browser and, when logged in, on the account (the highest of each counter wins on
   merge). Like weapon progression, no server authority: they are only outfits.
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
];
/* French maps (Yellow Vest challenges): the pass station, the Breton harbor, the housing estate */
const CHALLENGE_FR = ['saintgivre', 'portmael', 'belhorizon'];
const CHALLENGE_BY_ID = {}; for (const d of CHALLENGES) CHALLENGE_BY_ID[d.id] = d;
/* Progress of a challenge (capped at its goal) */
function challengeCount(id) {
  const D = CHALLENGE_BY_ID[id]; if (!D) return 0;
  const n = id === 'fMaps' ? ARS.chMaps.filter((m) => MAPS.some((x) => x.id === m && x.ok)).length : ARS.ch[id] || 0;
  return Math.min(D.goal, n);
}
const challengeDone = (id) => challengeCount(id) >= CHALLENGE_BY_ID[id].goal;
const challengesOf = (skin) => CHALLENGES.filter((d) => d.skin === skin);
/* Is an outfit available to the player: base ones always, challenge ones once their challenges are completed, a unique outfit
   (06gd-outfit-unique.js) only for the one logged-in account that owns it (username verified by the server, me) */
function skinUnlocked(s) {
  const K = SKINS[s]; if (!K) return false;
  if (K.owner) return !!(ACCT.user && String(ACCT.user.username).toLowerCase() === K.owner);
  return !K.challenge || challengesOf(s).every((d) => challengeDone(d.id));
}
/* The player's outfit: the one they chose if available, otherwise Assault (choice from another device, challenges not completed here) */
function skinMine() { const s = skinId(Settings.skin); return skinUnlocked(s) ? s : 'assault'; }

/* ---------- Progress ---------- */
/* Adds n to challenge id; announces the completed challenge, then the unlocked outfit */
function challengeAdd(id, n = 1) {
  const D = CHALLENGE_BY_ID[id]; if (!D || challengeDone(id)) return;
  const was = skinUnlocked(D.skin);
  if (id === 'fMaps') { if (ARS.chMaps.includes(n)) return; ARS.chMaps.push(n); n = 1; } // (n: the map)
  else ARS.ch[id] = Math.min(D.goal, (ARS.ch[id] || 0) + n);
  ARS.chSess[id] = (ARS.chSess[id] || 0) + n;
  arsSaveSoon();
  if (!challengeDone(id)) return;
  arsShow(`<b>${_t('Challenge complete')}</b><span>${esc(D.label)} : ${D.goal}</span>`);
  if (!was && skinUnlocked(D.skin)) {
    arsShow(`<b>${_t('Outfit unlocked: {0}', SKINS[D.skin].name)}</b><span>${_t('Wear it from the Outfits screen')}</span>`);
    if (typeof skinRefresh === 'function') skinRefresh();
  }
}
/* A player kill (killEnt): weapon or means, distance, stance and movement at the moment of the shot */
function challengesKill(a, v, weapon, head) {
  const wid = WEAPON_ID_BY_NAME[weapon], cat = wid ? WEAPONS[wid].cat : null;
  if (weapon === NET_WSPECIAL.knife || weapon === NET_WSPECIAL.nade) challengeAdd('nMelee');
  if (a.comboN === 2) challengeAdd('rDouble'); // once per chain, at the second kill (whatever the means)
  if (CHALLENGE_FR.includes(CURMAP.id)) challengeAdd('gElim');
  if (!cat) return; // the rest only applies to a weapon (not the airstrike, the helicopter or a fall)
  challengeAdd({ shotgun: 'nShotgun', sniper: 'tPrec', smg: 'rPm', ar: 'vFa', pistol: 'vPist' }[cat]);
  if (a.pos.distanceTo(v.pos) >= 50) challengeAdd('tFar');
  const W = curW(); if (W && W.def.id === wid && W.def.silent) challengeAdd('fSil');
  if (a.crouch && !((a.slideT || 0) > 0)) challengeAdd('fAcc');
  if ((a.slideT || 0) > 0 || !a.onGround) challengeAdd('rMouv');
  void head;
}
/* End of a match played to completion (endMatch): deathmatch rank, map played, victory (result: 'win', 'loss' or 'draw') */
function challengesMatchEnd(result, rank) {
  if (MATCH.mode === 'ffa' && rank <= 3) challengeAdd('nFfa');
  if (CURMAP.id) challengeAdd('fMaps', CURMAP.id);
  if (CHALLENGE_FR.includes(CURMAP.id)) { challengeAdd('gMatches'); if (result === 'win') challengeAdd('gVict'); }
}
/* End screen: the challenges that progressed during the match */
function challengesEndHtml() {
  return CHALLENGES.filter((d) => ARS.chSess[d.id] > 0).map((d) => {
    const n = challengeCount(d.id), ok = n >= d.goal;
    return `<div class="ars-row${ok ? ' done' : ''}"><b>${esc(d.label)}</b><span>${ok ? _t('Complete') : `+${ARS.chSess[d.id]}`}</span><i>${n} / ${d.goal}${ok ? '' : ` · ${SKINS[d.skin].name}`}</i></div>`;
  }).join('');
}
