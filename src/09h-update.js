/* ==========================================================================
   AUTOMATIC UPDATE
   A tab left open, a page restored by the browser (back button, tabs reopened at startup, mobile)
   or an overzealous cache can run an old version of the game. build.py gives each version an
   identifier (cod-build meta) and publishes dist/version.json, which Vercel serves uncached (vercel.json). The game compares
   the two at launch, when returning to the tab, then every 3 minutes:
   - outside a match and outside an online lobby (loading, menus), it reloads the page immediately, with the new
     version's identifier in the address to bypass any cache;
   - in a match or a lobby, a banner warns and the reload waits for the return to the menu: a match is never
     interrupted.
   One automatic attempt per version and per tab: if the server still serves the old page, no loop,
   the banner stays with a button to reload. Page opened from disk (file://): nothing to check.
   ========================================================================== */
const BUILD_ID = (document.querySelector('meta[name="cod-build"]') || {}).content || '';
const UPD = { latest: '', pending: false, lastCheck: -1e9, busy: false, el: null, closed: false, playT: 0 };
const updOn = () => /^https?:$/.test(location.protocol) && /^[0-9a-f]{12}$/.test(BUILD_ID);
/* safe reload: not in a match (including pause, killcam, end screen), nor in an online lobby */
const updSafe = () => !['playing', 'paused', 'killcam', 'ended'].includes(MATCH.state) && !netInLobby() && !UI.flow && !ACCT.code && !ACCT.busy; // not during a launch, nor while the recovery code is displayed (it lives only in memory) or an account request is in progress
async function updCheck(force = false) {
  if (!updOn() || UPD.busy) return;
  const now = performance.now();
  if (!force && now - UPD.lastCheck < 20000) return;
  UPD.lastCheck = now; UPD.busy = true;
  try {
    const r = await fetch(new URL('/version.json?t=' + Date.now(), location.href), { cache: 'no-store' });
    const j = r.ok ? await r.json() : null;
    if (j && /^[0-9a-f]{12}$/.test(j.build) && j.build !== BUILD_ID) { UPD.latest = j.build; UPD.pending = true; updApply(); }
  } catch (e) { /* offline or file missing: try again at the next check */ } finally { UPD.busy = false; }
}
function updApply() {
  if (!UPD.pending) return;
  if (updSafe() && updReload()) return;
  updBanner();
}
/* reloads to the new version; returns false if this was already done once in this tab for this version */
function updReload() {
  let tried = ''; try { tried = sessionStorage.getItem('cod_upd_try') || ''; } catch (e) { /* storage unavailable */ }
  if (tried === UPD.latest) return false;
  try { sessionStorage.setItem('cod_upd_try', UPD.latest); } catch (e) { /* storage unavailable */ }
  const u = new URL(location.href); u.searchParams.set('v', UPD.latest); // fresh address: no cache can serve it
  PAGE_LEAVE.ok = true; location.replace(u.href);
  return true;
}
/* Banner (#updBar, style in shell.html): top center, below the safe area; the player can close it. During action, it sits below the score
   and fades after 8 s (it hides nothing of the game); it returns when back in the menus, unless it was closed. */
function updBanner() {
  if (UPD.el) return;
  const el = UPD.el = document.createElement('div'); el.id = 'updBar'; el.setAttribute('role', 'status');
  el.innerHTML = '<span id="updMsg"></span><button type="button" class="btn primary"></button><button type="button" class="upd-x"></button>';
  const [go, x] = el.querySelectorAll('button');
  go.textContent = _t('Reload'); x.setAttribute('aria-label', _t('Close')); x.title = _t('Close');
  go.addEventListener('click', () => { try { sessionStorage.removeItem('cod_upd_try'); } catch (e) { /* ignored */ } updReload(); });
  x.addEventListener('click', () => { UPD.closed = true; el.classList.add('hidden'); });
  document.body.appendChild(el);
  updMsgSet();
}
/* Banner text: when the update will load; its position and visibility depending on the moment (called every second) */
function updMsgSet() {
  if (!UPD.el) return;
  const msg = updSafe() ? _t('A new version of the game is available.')
    : netInLobby() && !['playing', 'paused', 'killcam', 'ended'].includes(MATCH.state) ? _t('A new version of the game is available. It will load when you leave the lobby.') : _t('A new version of the game is available. It will load when the match ends.');
  const m = UPD.el.querySelector('#updMsg'); if (m.textContent !== msg) m.textContent = msg;
  const play = MATCH.state === 'playing' || MATCH.state === 'killcam';
  if (!play) UPD.playT = 0; else if (!UPD.playT) UPD.playT = performance.now();
  UPD.el.classList.toggle('play', play);
  UPD.el.classList.toggle('main', MATCH.state === 'menu' && UI.screen === 'main' && !$('ui').classList.contains('hidden'));
  UPD.el.classList.toggle('hidden', UPD.closed || (play && performance.now() - UPD.playT > 8000));
}
function updInit() {
  // the reload address (?v=...) is only used once: remove it, without touching the rest (invite link ?lobby=...)
  const u = new URL(location.href);
  if (u.searchParams.has('v')) { u.searchParams.delete('v'); history.replaceState(history.state, '', u.pathname + u.search + u.hash); }
  if (!updOn()) return;
  updCheck(true);
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') updCheck(); });
  addEventListener('pageshow', (e) => { if (e.persisted) updCheck(true); }); // page restored as is by the browser
  addEventListener('focus', () => updCheck());
  setInterval(() => updCheck(true), 180000);
  // a pending update happens as soon as back at the menu (end of match, lobby left)
  setInterval(() => {
    if (UPD.pending && updSafe()) updApply();
    updMsgSet();
  }, 1000);
}
updInit();
