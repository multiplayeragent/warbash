/* ==========================================================================
   END OF MATCH: "VICTORY" / "DEFEAT" / "DRAW" ANNOUNCEMENT
   When the match is decided (elimination or point limit reached, time up), the game no longer jumps straight
   to the killcam or the scoreboard: MATCH.state goes to 'finish' for OUTRO_LEN seconds. The result shows as an
   overlay (#outro: veils, cinema bars, a word that slams down, a rule, the score), the game continues behind it in slow motion, without
   controls or damage counting (applyDamage and the controls only work in 'playing'), and the HUD fades out.
   Then: final killcam if a last elimination decided the match (solo, teams or free-for-all), otherwise the
   scoreboard directly (domination, time up, online matches, which have no killcam).
   The result is frozen at the start (MATCH.outro.out): the announcement, the results screen and the player's account say the same thing.
   Callers: killEnt and netUpdate (via matchFinishSoon, with a short delay after the last elimination), domUpdate (09i-modes.js), the loop (time elapsed) and the 'end' message (09c-net.js).
   ========================================================================== */
const OUTRO_LEN = 3.6;    // announcement duration (real seconds)
const OUTRO_DELAY = 0;    // delay between the last elimination and the announcement (game seconds): none, the announcement starts on the next frame and the victim's fall is seen in slow motion behind it (1.3 s until 2.32, then 0.45 s: the player still had time to switch weapons, owner's feedback)
const OUTRO_SLOW = 0.18;  // game speed behind the announcement, once the slow motion is set
const OUTRO_TEXT = { win: _t('Victory'), loss: _t('Defeat'), draw: _t('Draw') };
const OUTRO_CLS = { win: 'ally', loss: 'enemy', draw: 'draw' };
/* Crest above the word (assets/crests.webp, two cells: victory, defeat; build.py): it slams down just before it; none for a draw */
const CREST_ART = /*__CREST_ART__*/ '';
if (CREST_ART) document.documentElement.style.setProperty('--crests', `url("${CREST_ART}")`);
let outroTimer = 0;

/* The match result as it stands at this moment: result (win, loss or draw), winner (team, -1 with no team winner), sub (score sentence) */
function matchOutcome() {
  const me = PL.ent, [a, b] = MATCH.score;
  if (MATCH.mode === 'ffa') { // the winner is first in the ranking, nobody else wins with them
    const top = ffaList().sort(ffaCmp)[0], win = top === me;
    return { result: win ? 'win' : 'loss', winner: -1, sub: win ? `${_t('You win with {0} kills', me.kills)}` : `${_t('{0} wins with {1} kills, you finish {2}', top.name, top.kills, ordinal(ffaRank()))}` };
  }
  const w = a > b ? 0 : b > a ? 1 : -1;
  return { result: w === -1 ? 'draw' : w === me.team ? 'win' : 'loss', winner: w, sub: _t('{0} {1} vs {2} {3}', TEAM_NAMES[0], a, b, TEAM_NAMES[1]) };
}
/* What ended the match: the mode's limit, otherwise time */
function outroByLimit() {
  const ffaDone = MATCH.mode === 'ffa' && ffaList().some((e) => e.kills >= MATCH.limit);
  return ffaDone || (MATCH.mode !== 'ffa' && (MATCH.score[0] >= MATCH.limit || MATCH.score[1] >= MATCH.limit));
}
function outroKicker() {
  if (!outroByLimit()) return _t('Time is up');
  return MATCH.mode === 'dom' ? _t('Score reached') : _t('Kill limit reached');
}

/* The elimination limit has just been reached: the announcement follows after OUTRO_DELAY, on the next frame (a single deadline, reset by
   startMatch; no direct call: killEnt is in the middle of the player's frame) */
function matchFinishSoon() {
  if (MATCH.outro || MATCH.outroSoon) return;
  MATCH.outroSoon = true;
  MATCH.events.push({ t: MATCH.time + OUTRO_DELAY, fn: matchFinish });
}
/* The match is decided: announcement, slow motion, controls cut. No effect if it is already announced or over. */
function matchFinish() {
  if (MATCH.outro || (MATCH.state !== 'playing' && MATCH.state !== 'paused')) return;
  kcAbort(); // online, a death replay in progress yields to the announcement
  // online, the match is decided by the host: the last elimination (if it is the one that reached the limit) has its final killcam, as in solo
  const L = MATCH.lastKill;
  if (MATCH.online && !MATCH.finalPending && MATCH.mode !== 'dom' && L && MATCH.time - L.t < 4 && outroByLimit()) MATCH.finalPending = L;
  const out = matchOutcome();
  MATCH.outro = { t: 0, t0: performance.now(), out, faded: false }; // t follows the real clock, like the announcement's CSS animations
  MATCH.over = true;
  if (MATCH.online && NET.role === 'host') netBroadcast({ t: 'end' }); // the other players announce the result at the same time as the host
  showLockPrompt(false); chatClose(); ksAbort(); hideDeathScreen(); showScoreboard(false); laneSuspend();
  $('pause').classList.remove('show');
  for (const k in KEYS) KEYS[k] = false; PL.held = false; PL.adsWant = false; LOCK.escArmed = false;
  MATCH.state = 'finish';
  const el = $('outro');
  $('outroKick').textContent = outroKicker();
  $('outroWord').textContent = OUTRO_TEXT[out.result];
  $('outroSub').textContent = out.sub;
  clearTimeout(outroTimer); el.className = 'outro show ' + out.result; // the animation restarts from zero
  $('hud').classList.add('finish');
  sfxMatchEnd(out.result); sfxOutroMuffle(true);
}
/* Frame by frame during the announcement: returns the game speed (1 normal, OUTRO_SLOW in slow motion). The announcement time is real time:
   a struggling machine doesn't stretch the announcement relative to its animations. */
function outroTick() {
  const F = MATCH.outro; F.t = (performance.now() - F.t0) / 1000;
  if (!F.faded && F.t >= OUTRO_LEN - 0.35) { F.faded = true; $('outro').classList.add('out'); } // fade to black before what follows
  const u = clamp(F.t / 0.5, 0, 1), s = u * u * (3 - 2 * u);
  return 1 - (1 - OUTRO_SLOW) * s;
}
/* End of the announcement: final killcam if an elimination decided the match, otherwise scoreboard */
function outroDone() {
  const F = MATCH.finalPending;
  outroClear(true);
  MATCH.state = 'playing';
  if (F && !F.nocam && startKillcam({ killer: F.killer, victim: F.victim, tEnd: F.t, final: true, info: F.info })) return; // a fall into the void is not replayed
  endMatch();
}
/* Removes the announcement. fade: a last fade from black reveals what follows (killcam or results), otherwise a hard cut */
function outroClear(fade) {
  const el = $('outro'); if (!el) return;
  $('hud').classList.remove('finish'); sfxOutroMuffle(false);
  clearTimeout(outroTimer);
  if (fade && el.classList.contains('show')) {
    el.className = 'outro show from ' + (MATCH.outro ? MATCH.outro.out.result : 'win');
    outroTimer = setTimeout(() => { el.className = 'outro'; }, 520);
  } else el.className = 'outro';
}
