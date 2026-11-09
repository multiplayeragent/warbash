/* ==========================================================================
   TOUCHPAD (trackpad)
   A player's feedback: "I play on a Magic Trackpad, I can't aim and shoot at the same time". On a trackpad you can't hold a click while
   moving the finger, nor two buttons at once. The controls stay those of the keyboard and mouse (movement, jumps, weapons on keys), but
   when the touchpad is the main pointer, it takes on the spirit of the touchscreen (09qd-aim.js, 09q-touch.js):
   - auto-fire (Settings.tpAuto): you fire on your own as long as the crosshair is on a visible enemy, as on touch; the click no longer fires;
   - aiming by double click or two-finger tap (Settings.tpDblAds; a pad's right click): two quick clicks shoulder, two more put
     the weapon away; aiming is a toggle, never "held";
   - aim assist (slowdown, snap, tracking) applies as on touch and with a controller (Options, Game: "Aim assist");
   - its own sensitivity (Settings.tpSens, Options, Game): the mouse's at first launch, then independent (08-player.js, updatePlayer);
   - the wheel no longer switches weapons (a pad's two-finger scroll would make it switch on every gesture): the 1, 2 and Q keys take care of that.
   The browser doesn't say whether the pointer is a pad or a mouse: Settings.tpMode is "auto" (detection), "on" or "off" (Options, Game).
   Detection (trackpadWheel): a pad's scroll gesture is a burst of at least five closely spaced wheel events that also moves sideways,
   or a long burst that dies out (the momentum of the lifted finger); a wheel notch is an isolated, round event (by lines, or a multiple of 100 or 120
   pixels). A fractional step proves nothing: a mouse produces them with browser zoom or screen scaling (a player's feedback:
   "after the settings, I can't shoot anymore", wheel scrolling in Options had mistaken it for a pad). Two pad gestures in a row set
   Settings.tpSeen (kept from one session to the next), two mouse notches clear it, and so does a held left click (trackpadHold): on a pad, you don't
   hold the click, that is the very reason for the mode. Menu scrolling is enough to see it before the match. Each switch made by the detection during a
   match is announced on screen (trackpadNote, on resume if it happened during the pause), the first one at match start too (Settings.tpHint).
   Toggle aiming (Settings.adsToggle, Options, Game) also exists with the mouse: a right click shoulders, another puts the weapon away.
   Check: node tools/dev/visual/touchpad.js
   ========================================================================== */
const TPAD = { n: 0, t: 0, t0: 0, fine: false, notch: false, big: 0, small: 0, max: 0, last: 0, trackB: 0, mouseB: 0, tap: 0, note: null, holdId: 0, down: false };
/* The touchpad is the main pointer (outside touchscreen and controller, which have their own controls) */
function trackpadOn() { return !TOUCH.on && !PAD.drive && (Settings.tpMode === 'on' || (Settings.tpMode !== 'off' && !!Settings.tpSeen)); }
/* Aiming toggles (instead of being held): on the touchpad, or with the mouse if the player chose it */
function adsToggleMode() { return trackpadOn() || !!Settings.adsToggle; }
/* Actions that make you leave toggle aiming: at the end of a reload or a sprint, you don't go back to aiming without having wanted to */
const ADS_UNAIM = new Set(['KeyR', 'Digit1', 'Digit2', 'KeyQ', 'KeyF', 'KeyG', 'KeyE', 'Digit4', 'Digit5', 'Digit6', 'ShiftLeft']);
/* Setting changed (Options) or touchpad seen: the previous controls are released, the body class shows or hides the touchpad option rows (shell.html,
   data-tp) without rebuilding the list, which may be scrolling right now under the finger */
function trackpadSync() {
  PL.held = false; PL.queued = false; if (adsToggleMode()) PL.adsWant = false; TPAD.tap = 0;
  document.body.classList.toggle('trackpad', trackpadOn());
}
/* Left click on the touchpad: the second click of a double click shoulders or puts the weapon away; the first only fires without auto-fire */
function trackpadClick(e) {
  TPAD.down = true; trackpadHold();
  const dbl = Settings.tpDblAds !== false && TPAD.tap && e.timeStamp - TPAD.tap <= 380;
  TPAD.tap = dbl ? 0 : e.timeStamp;
  if (dbl) { PL.adsWant = !PL.adsWant; return; }
  if (Settings.tpAuto === false) { PL.held = true; PL.queued = true; }
}
/* Right click (on a pad: two-finger tap): shoulder or put the weapon away in toggle mode */
function adsToggleClick() { PL.adsWant = !PL.adsWant; }
/* Wheel event (menus included): looks for the signature of a touchpad or a mouse */
function trackpadWheel(e) {
  const now = e.timeStamp;
  if (now - TPAD.t > 140) trackpadBurst(); // a burst is over
  if (!TPAD.n) TPAD.t0 = now;
  TPAD.t = now; TPAD.n++;
  const dy = Math.abs(e.deltaY), dx = Math.abs(e.deltaX), wd = e.wheelDeltaY;
  TPAD.max = Math.max(TPAD.max, dy); TPAD.last = dy;
  if (e.deltaMode === 1) TPAD.notch = true; // by lines: a wheel
  else if (e.deltaMode === 0) {
    if (dx > 0) TPAD.fine = true;
    if (dy >= 100 && dx === 0 && Number.isInteger(e.deltaY) && (dy % 100 === 0 || dy % 120 === 0 || (wd && wd % 120 === 0))) TPAD.big++; // a round notch
  }
}
function trackpadBurst() {
  // pad: sideways steps, or a long burst that dies out (the momentum of the lifted finger, which only a pad or a touch mouse gives)
  const n = TPAD.n, notch = TPAD.notch || (TPAD.big >= 1 && n <= 3), long = n >= 10 && TPAD.t - TPAD.t0 >= 300 && TPAD.max < 80 && TPAD.last <= Math.max(3, TPAD.max * 0.3);
  const fine = (n >= 5 && TPAD.fine) || long;
  TPAD.n = 0; TPAD.fine = false; TPAD.notch = false; TPAD.big = 0; TPAD.max = 0; TPAD.last = 0;
  if (!n) return;
  if (notch) { TPAD.trackB = 0; if (++TPAD.mouseB >= 2) trackpadSeen(false); }
  else if (fine) { TPAD.mouseB = 0; if (++TPAD.trackB >= 2) trackpadSeen(true); }
}
function trackpadSeen(v) {
  if (!!Settings.tpSeen === v) return;
  Settings.tpSeen = v; saveSettings();
  trackpadSync();
  if (Settings.tpMode !== 'auto') return;
  TPAD.note = v ? 'pad' : 'mouse';
  if (MATCH.state === 'playing') trackpadNote();
}
/* Detection toggle: announced on screen in a match (on resume if it happened during the pause, at match start if it was in the menus) */
function trackpadNote() {
  if (!TPAD.note || MATCH.state !== 'playing') return;
  Settings.tpHint = true; saveSettings();
  hudMsg(TPAD.note === 'pad' ? _t('Trackpad detected. Auto fire and double click to aim (Options, Game)') : _t('Mouse detected. Left click fires again (Options, Game)'), 'xp', 5);
  TPAD.note = null;
}
/* Left click held in detected pad mode: it's a mouse (on a pad, you don't hold the click). The mode turns off and the shot goes off, without releasing. */
function trackpadHold() {
  clearTimeout(TPAD.holdId);
  if (Settings.tpMode !== 'auto') return;
  TPAD.holdId = setTimeout(() => {
    if (!trackpadOn() || !TPAD.down || MATCH.state !== 'playing') return;
    trackpadSeen(false); PL.held = true; PL.queued = true;
  }, 350);
}
/* At the start of a match (countdown) or as soon as it's seen in a match: once, a word about the touchpad detected on its own */
function trackpadHint() {
  if (TPAD.note && Settings.tpMode === 'auto') { TPAD.note = trackpadOn() ? 'pad' : 'mouse'; trackpadNote(); return; }
  if (!trackpadOn() || Settings.tpMode !== 'auto' || Settings.tpHint) return;
  Settings.tpHint = true; saveSettings();
  hudMsg(_t('Trackpad detected. Auto fire and double click to aim (Options, Game)'), 'xp', 5);
}
addEventListener('wheel', trackpadWheel, { passive: true });
setInterval(() => { if (TPAD.n && performance.now() - TPAD.t > 200) trackpadBurst(); }, 250); // one last burst, once the gesture is over
if (document.body) document.body.classList.toggle('trackpad', trackpadOn());
