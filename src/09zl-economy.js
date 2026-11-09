/* ---------- Power saving: the first-launch question on touch ----------
   On touch (phone, tablet), power saving (30 frames per second, CAP, and image settings chosen by the game, ECO_GFX, 01-core.js) starts enabled and the game asks once whether to
   keep it (#ecoAsk, in the middle of the screen): Enable (in yellow, where focus lands) or No thanks. Escape, B or a click on the background keep it.
   The question waits for the main menu to be free ("What's new" window, app installation, match resumed after a reload).
   Settings.ecoAsk stays true until the player has answered: a page closed before the answer asks the question again at the next launch. */
function ecoBusy() {
  if (MATCH.state !== 'menu' || UI.screen !== 'main' || document.body.classList.contains('gated')) return true;
  return [...document.querySelectorAll('[role=dialog], [role=alertdialog]')].some((e) => e.id !== 'ecoAsk' && !e.classList.contains('hidden') && e.getClientRects().length > 0);
}
function ecoAsk() {
  if (!Settings.ecoAsk || !$('ecoAsk').classList.contains('hidden')) return;
  if (ecoBusy()) { setTimeout(ecoAsk, 1500); return; }
  const el = $('ecoAsk'); el._from = document.activeElement; el.classList.remove('hidden');
  if (lmWantFocus()) $('ecoOn').focus({ preventScroll: true });
}
function ecoClose(on) {
  const el = $('ecoAsk'); if (el.classList.contains('hidden')) return;
  el.classList.add('hidden'); sfxUi('click');
  const was = Settings.eco; Settings.eco = on; Settings.ecoAsk = false; saveSettings(); syncOptions(); if (was !== on) ecoApply();
  const f = el._from; el._from = null; if (f && f.isConnected && f.focus && lmWantFocus()) f.focus({ preventScroll: true });
}
/* Power saving enabled or turned off: the quality in effect (gfxSet) changes, the automatic mode restarts from its starting step;
   a switch to or from Minimal offers to restart (shadows are decided at launch) */
function ecoApply() { qualityReset(); qualityBootCheck(); }
function ecoInit() {
  $('ecoOn').addEventListener('click', () => ecoClose(true)); $('ecoOff').addEventListener('click', () => ecoClose(false));
  $('ecoAsk').addEventListener('click', (e) => { if (e.target === e.currentTarget) ecoClose(true); }); // a click on the background: it stays enabled
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && !$('ecoAsk').classList.contains('hidden')) { e.preventDefault(); e.stopImmediatePropagation(); ecoClose(true); } }, true);
}
ecoInit();
