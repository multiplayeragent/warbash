/* ==========================================================================
   START COUNTDOWN
   At the start of every match (solo and online, all modes, "Replay" included), once the player has deployed: "The match starts
   in 5", as in Call of Duty (it lasted 10 s, too long according to a player). During the countdown (MATCH.cd > 0, or CD.wait: a guest
   waiting for the instant set by the host), cdOn() is true, and with it playHold() (also true during the online host migration,
   09c-net.js), which the game and the bots read:
   the match timer doesn't run, nobody moves or shoots (player: updatePlayer; bots: updateBot;
   remote players: each on their own machine), no knife or grenade, no capture or score (modeUpdate waits), the announcement lane
   waits; you can look around, reload, switch weapon or class (the class chosen in the pause is equipped right away).
   Respawning after a death has no countdown.
   Time: in solo, the countdown stops with the pause (real time only counts outside the pause); online, the match continues during the
   pause, and so does the countdown. The host sets the start instant at its deployment (that's where the match really begins for it: its bots,
   the timer) and transmits it with each "ps" send (cd: seconds remaining, protocol 10); a guest deployed before the host waits
   ("Waiting for the host"), one who deploys during the countdown receives the remaining time, one who joins a match already started has none.
   Styling (#cd, shell.html): at the center, in place of the crosshair, the stencil digit that slams in every second (it arrives big, settles, then an
   outline echo widens and fades) with "The match starts in" as the overline, with no bar or reminder of the objective (it is already in the score);
   the last three seconds in yellow; then "Go!" (#cdGo) which slams in and fades, with the start
   punctuation. Sounds: a tick per second, a beep for 3, 2, 1 (ui and series packs). No voice: no radio line at the start, no digits, nor
   "Go!" spoken (the digit and the on-screen text are enough). All in transforms and opacity, one write per second.
   Test tools: window.MATCH_COUNTDOWN (seconds, 0: no countdown), set before the page by tools/dev/visual/common.js.
   ========================================================================== */
const CD = { len: 5, wait: false, waitT: 0, done: true, shown: -2, last: 0, end: 0 };
const CD_HOT = 3, CD_WAIT_SHOW = 0.6;

/* Countdown duration: 5 s, or what a test tool asks for */
function cdLen() { const v = window.MATCH_COUNTDOWN; return v != null && v !== '' && isFinite(+v) ? clamp(+v, 0, 30) : CD.len; }
/* The start hasn't been given yet: nobody moves or shoots */
function cdOn() { return !CD.done && (MATCH.cd > 0 || CD.wait); }
/* The match is frozen: start countdown, or online host migration (MIG, 09c-net.js); same effects (player, bots, timer) */
function playHold() { return cdOn() || MIG.on; }

/* Match start (startMatch): the host and solo count right away; a guest waits for the instant set by the host (cdNet) */
function cdStart() {
  const len = cdLen(), el = $('cd');
  CD.done = false; CD.shown = -2; CD.last = performance.now(); CD.waitT = 0;
  CD.wait = MATCH.online && NET.role === 'client';
  MATCH.cd = CD.wait ? 0 : len; CD.end = CD.last + MATCH.cd * 1000;
  $('cdGo').classList.remove('show');
  el.className = 'cd';
  if (!cdOn()) { cdGo(true); trackpadHint(); return; } // no countdown (test tool): immediate start, as before
  $('hud').classList.add('counting'); trackpadHint();
}
/* Every match frame (frame): the time, the display (one write per second) and the sounds */
function cdTick() {
  if (CD.done) return;
  if (MATCH.state !== 'playing' && MATCH.state !== 'paused') { cdClear(); return; } // match end announced during the countdown (the host left)
  const now = performance.now(), rdt = Math.min(0.25, (now - CD.last) / 1000); CD.last = now; // (tab in the background: the countdown isn't skipped)
  hudStyle($('prot'), 'opacity', '0');
  if (CD.wait) { // guest: the host hasn't given the start instant yet
    CD.waitT += rdt;
    if (CD.waitT > CD_WAIT_SHOW && CD.shown !== -1) { CD.shown = -1; cdShowWait(); }
    return;
  }
  if (MATCH.online) MATCH.cd = Math.max(0, (CD.end - now) / 1000);
  else if (MATCH.state === 'playing') MATCH.cd = Math.max(0, MATCH.cd - rdt); // solo: the pause stops the countdown
  if (MATCH.cd <= 0) { cdGo(false); return; }
  const n = Math.ceil(MATCH.cd);
  if (n !== CD.shown) { const first = CD.shown < 0; CD.shown = n; cdShow(n, first); cdSound(n); }
}
/* Second n (5 to 1): digit set again (two alternating animation names: it restarts without re-reading the layout; data-n feeds its
   echo), last three seconds in yellow */
function cdShow(n, first) {
  const el = $('cd');
  const num = $('cdNum'); num.textContent = num.dataset.n = String(n);
  $('cdDial').className = 'cd-dial ' + (n % 2 ? 'a' : 'b');
  $('cdKick').textContent = _t('Match begins in');
  el.className = 'cd show' + (n <= CD_HOT ? ' last' : '') + (first ? ' in' : '');
}
/* Guest deployed before the host: the overline breathes, with no digit */
function cdShowWait() {
  const el = $('cd');
  $('cdNum').textContent = $('cdNum').dataset.n = ''; $('cdDial').className = 'cd-dial';
  $('cdKick').textContent = _t('Waiting for the host');
  el.className = 'cd show wait in';
}
/* Sounds: a tick per second, then the radio link beep for 3, 2, 1 (no voice) */
function cdSound(n) {
  if (!AU.ready) return;
  const t = AU.ctx.currentTime;
  if (n > CD_HOT) { sfxPlay('ui_tick', uiOut(0.62), t, { rate: 0.82 }) || sfxClick(null, 900, 0.22); return; }
  const B = SFX.bank.get('r_beep');
  if (!(B && B.length && sfxPlay('r_beep', uiOut(0.42), t, { e: B[0] }))) sfxBeep(1500, 1); // always the same take (the second is a double beep)
}

/* Start: the match begins (timer, bots, controls). late: without a countdown (test tool, or a guest arriving in a match already started):
   the objective reminder then goes through a message, as before the countdown */
function cdGo(late) {
  if (CD.done) return;
  CD.done = true; CD.wait = false; MATCH.cd = 0; OPEN.on = false; // end of the start: spawns follow the mode's rules (chooseSpawn)
  MATCH.startAt = MATCH.time; // the bots rush forward for the first seconds (07-bots.js): from the start
  for (const e of entities) if (e.alive) e.spawnAt = MATCH.time; // class change delay and protection: counted from the start
  $('hud').classList.remove('counting');
  const el = $('cd'); if (el.classList.contains('show')) el.className = 'cd out';
  sfxAnnounce(null, 'st_start'); // the punctuation alone, with no voice
  if (late) { const MD = modeDef(); hudMsg(`${MD.name} : ${MATCH.limit} ${MD.unit}`, 'xp', 3); return; }
  const go = $('cdGo'); go.textContent = _t('Move out!'); go.classList.remove('show'); void go.offsetWidth; go.classList.add('show');
  lanePump(); // an announcement held during the countdown goes through now
}
/* Match end or return to the menus during the countdown */
function cdClear() {
  CD.done = true; CD.wait = false; MATCH.cd = 0; OPEN.on = false;
  $('hud').classList.remove('counting'); $('cd').className = 'cd'; $('cdGo').classList.remove('show');
}
/* Online: the host attaches the remaining seconds to each "ps" send (nothing once the match has started) */
function cdNetOut() { return !CD.done && MATCH.cd > 0 ? Math.round(MATCH.cd * 100) / 100 : undefined; }
/* Guest: the host's "ps" send (its own, the one carrying tl). cd: seconds remaining, absent once the match has started. A gap of more
   than 0.15 s resyncs the countdown (latency isn't compensated: the guest starts at most one one-way trip after the host) */
function cdNetIn(cd) {
  if (CD.done || !MATCH.online || NET.role !== 'client') return;
  const now = performance.now();
  if (!(typeof cd === 'number' && isFinite(cd) && cd > 0)) { cdGo(CD.wait); return; } // match already started on the host: start (without a countdown if we were waiting)
  cd = Math.min(cd, CD.len);
  if (CD.wait) { CD.wait = false; CD.end = now + cd * 1000; MATCH.cd = cd; CD.shown = -2; return; }
  if (Math.abs((CD.end - now) / 1000 - cd) > 0.15) CD.end = now + cd * 1000;
}
$('cdGo').addEventListener('animationend', (e) => { if (e.target.id === 'cdGo') e.target.classList.remove('show'); });
