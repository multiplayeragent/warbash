/* ==========================================================================
   MENU MUSIC
   The theme (dist/menu-theme.mp3, next to the HTML) plays in the main menus and fades out as soon as a match
   is launched (loading screen, class selection included; it comes back if canceled). On return from a match
   it restarts from the beginning of the track. Neither the pause nor the results have music.
   The file is not in the HTML: it is only downloaded (streamed) when the menus are displayed, and its address
   carries a version number (build.py) to stay cached. If it's missing, the game is simply silent.
   The volume is Music x Master volume (Options, Audio).
   ========================================================================== */
const MUS = { el: null, url: '', vol: 0, pending: false, blocked: false, dead: false };
const MUS_FADE_IN = 1.2, MUS_FADE_OUT = 3.5; // fade speeds (per second)

function musicInit() {
  const m = document.querySelector('meta[name="menu-music"]');
  MUS.url = m ? m.content : ''; if (!MUS.url) MUS.dead = true;
  // the browser only allows sound after a gesture: the first click or key press restarts playback
  // (Safari on iPhone only accepts playback inside a complete gesture: we also restart at the end of the touch and on click, directly in the gesture)
  const unlock = () => { MUS.blocked = false; if (MUS.el && MUS.el.paused && MATCH.state === 'menu') { const p = MUS.el.play(); if (p && p.catch) p.catch(() => { /* refused: musicTick will retry */ }); } };
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) addEventListener(ev, unlock, true);
  document.addEventListener('visibilitychange', () => { if (document.hidden && MUS.el) MUS.el.pause(); });
}
/* Back to the main menu (match left or finished): the theme restarts from the beginning of the track, with a fade */
function musicRestart() {
  MUS.vol = 0;
  if (!MUS.el) return;
  MUS.el.volume = 0;
  try { MUS.el.currentTime = 0; } catch (e) { /* stream not ready yet: it will start at the beginning anyway */ }
}
/* Called on every frame of the game loop */
function musicTick(dt) {
  const M = MUS; if (M.dead) return;
  const want = MATCH.state === 'menu' && !UI.flow && !document.hidden; // launching a match (loading included) cuts the music
  const target = want ? clamp(Settings.music * Settings.volume, 0, 1) : 0;
  M.vol += (target - M.vol) * Math.min(1, dt * (target > M.vol ? MUS_FADE_IN : MUS_FADE_OUT));
  if (!M.el) {
    if (!want) return;
    M.el = new Audio(); M.el.preload = 'none'; M.el.loop = true; M.el.volume = 0;
    M.el.addEventListener('error', () => { M.dead = true; });
    M.el.src = M.url;
  }
  if (want && M.el.paused && !M.blocked && !M.pending) {
    M.pending = true;
    const p = M.el.play();
    if (p && p.then) p.then(() => { M.pending = false; }, (e) => { M.pending = false; if (e && e.name === 'NotAllowedError') M.blocked = true; else M.dead = true; });
    else M.pending = false;
  }
  M.el.volume = clamp(M.vol, 0, 1);
  if (!want && M.vol < 0.003 && !M.el.paused) M.el.pause();
}
