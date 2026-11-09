/* ==========================================================================
   TOUCH CONTROL LAYOUT: the player moves, enlarges, removes their buttons (Options, Game, "Controls layout").
   A moved button is stored in Settings.tcLay[id] = [x, y, size, removed]: x and y are the center's place as a fraction of the width and height of
   the screen (the layout thus follows the phone's size), the size a diameter in "u" (1% of the height, like --s). A button without an entry keeps its default place
   (shell.html). Edit mode shows all the buttons on a darkened background, including those that only appear when needed (streaks, pickup, chat),
   and works from the menus as from the pause. "Share" gives the layout as text (to copy, to paste): a tuning tool, to be removed later.
   Auto-fire (Settings.tcAuto, default on touch): no more fire button, aiming takes the place and size of the right fire button. Its place in this
   mode is stored separately (entry adsA): the manual mode's does not move. Double tap to aim (Settings.tcDblAds, default): no more Aim button.
   ========================================================================== */
function touchLayoutIds() { return TC_BTNS.map((x) => x[0]).filter((id) => id !== 'boom').concat('stick'); } // (the drone button takes the fire button's place: touchLayoutOne)
/* Element that carries a setting's place: the button, or for the joystick its circle */
function touchHit(id) { return id === 'stick' ? TC.el.stick.firstChild : TC.el[id]; }
/* A button's layout entry: aiming has its own in auto-fire (a function: touchInit, at the bottom of 09q-touch.js, uses it at load) */
function touchLayKey(id) { return id === 'ads' && Settings.tcAuto ? 'adsA' : id; }
/* Fire and aim modes (Options): auto-fire (class auto, shell.html: fire buttons hidden, aim moved) and double tap to aim
   (class dbl: Aim button hidden) */
function touchModeSync() {
  const a = !!Settings.tcAuto, d = !!Settings.tcDblAds; if (!TC.root || (TC.autoOn === a && TC.dblOn === d)) return;
  TC.dblOn = d; TC.root.classList.toggle('dbl', d);
  if (TC.autoOn !== a) { TC.autoOn = a; TC.root.classList.toggle('auto', a); touchLayoutOne('ads'); }
}

/* 2.23.1: fixed joystick, finger sprint by default and the player's original layout: the touch settings of previous versions (never chosen, the default ones)
   are reset once */
function touchLayoutMigrate() { if (Settings.tcV === 2) return; Settings.tcV = 2; Settings.tcRun = 'stick'; Settings.tcLay = null; saveSettings(); }

/* Applies the saved layout (or resets it to default) to all the buttons */
function touchLayoutApply() {
  TC.lay = Settings.tcLay && typeof Settings.tcLay === 'object' ? Settings.tcLay : JSON.parse(JSON.stringify(TC_DEFAULT_LAY)); // without a saved layout: the original one (copy)
  TC.autoOn = !!Settings.tcAuto; TC.dblOn = !!Settings.tcDblAds; if (TC.root) { TC.root.classList.toggle('auto', TC.autoOn); TC.root.classList.toggle('dbl', TC.dblOn); }
  for (const id of touchLayoutIds()) touchLayoutOne(id);
}
function touchLayoutOne(id) {
  const b = TC.el[id], F = TC.lay.fire; if (!b) return;
  let L = TC.lay[touchLayKey(id)];
  if (!L && id === 'ads' && Settings.tcAuto && F) L = [F[0], F[1], F[2], 0]; // auto-fire: in place of the fire button (without a set place: shell.html's, .auto)
  if (id !== 'stick') { b.classList.toggle('ov', !!L); b.classList.toggle('off', !!(L && L[3])); }
  for (const k of ['--fx', '--fy', '--s']) b.style.removeProperty(k);
  if (L) { b.style.setProperty('--fx', L[0]); b.style.setProperty('--fy', L[1]); b.style.setProperty('--s', L[2]); }
  if (id === 'fire' && TC.el.boom) { const B = TC.el.boom; B.classList.toggle('ov', !!F); for (const k of ['--fx', '--fy', '--s']) B.style.removeProperty(k); if (F) { B.style.setProperty('--fx', F[0]); B.style.setProperty('--fy', F[1]); B.style.setProperty('--s', F[2]); } } // kamikaze drone: in place of fire
}
/* A button's entry, created from its current place if it has none yet */
function touchLayoutGet(id) {
  const k = touchLayKey(id);
  if (TC.lay[k]) { Settings.tcLay = TC.lay; return TC.lay[k]; }
  const b = touchHit(id), r = b.getBoundingClientRect(), u = TOUCH.R / 12.5; // one "u" unit (see touchSize)
  const L = [round4(touchFrac(r.left + r.width / 2, 'x')), round4(touchFrac(r.top + r.height / 2, 'y')), Math.round((r.height / u) * 10) / 10, 0];
  TC.lay[k] = L; Settings.tcLay = TC.lay; return L; // (the layout is saved in full from the first tweak)
}
function round4(v) { return Math.round(v * 1e4) / 1e4; }

function touchEditBuild(root) {
  const ed = document.createElement('div'); ed.id = 'tcEd'; ed.className = 'hidden';
  ed.innerHTML = `<div class="ed-row"><b id="tcEdName"></b><button type="button" data-ed="minus">-</button><button type="button" data-ed="plus">+</button><button type="button" data-ed="toggle"></button></div>
    <div class="ed-row"><button type="button" class="pri" data-ed="done">${esc(_t('Done'))}</button><button type="button" data-ed="reset">${esc(_t('Reset'))}</button><button type="button" data-ed="share">${esc(_t('Share'))}</button></div>
    <div class="ed-share hidden"><textarea rows="3" spellcheck="false" aria-label="${esc(_t('Layout as text'))}"></textarea><div class="ed-row"><button type="button" data-ed="copy">${esc(_t('Copy'))}</button><button type="button" data-ed="apply">${esc(_t('Apply'))}</button></div><p></p></div>`;
  root.appendChild(ed); TC.el.ed = ed;
  const ring = TC.el.stick.firstChild; // when editing, the joystick circle is grabbed like a button
  ring.addEventListener('pointerdown', (e) => { if (!TC.edit) return; e.preventDefault(); e.stopPropagation(); touchEditDown('stick', e); });
  ring.addEventListener('pointermove', touchEditMove); ring.addEventListener('pointerup', touchEditUp); ring.addEventListener('pointercancel', touchEditUp); ring.addEventListener('lostpointercapture', touchEditUp);
  ed.addEventListener('pointerdown', (e) => e.stopPropagation());
  ed.addEventListener('click', (e) => { const a = e.target.closest('[data-ed]'); if (a) touchEditAct(a.dataset.ed); });
}
/* Opens editing: from the menus (the background is darkened) or from the pause (the pause menu fades out for the duration of the edit) */
function touchEditOpen() {
  if (!TOUCH.on || TC.edit) return;
  TC.edit = true; TC.sel = null; touchReset(); touchModeSync();
  TC.fromPause = MATCH.state === 'paused'; if (TC.fromPause) $('pause').classList.remove('show');
  TC.root.classList.remove('hidden', 'dead', 'map'); TC.root.classList.add('edit'); TC.el.ed.classList.remove('hidden'); TC.el.help.classList.add('hidden');
  for (const [id] of TC_BTNS) TC.el[id].classList.remove('gone');
  TC.el.stick.classList.add('on'); TC.root.classList.toggle('float', Settings.tcStick !== 'fixed'); touchEditSelect(null); sfxUi('click');
}
function touchEditClose() {
  TC.edit = false; TC.drag = null; saveSettings();
  TC.el.stick.classList.remove('on'); TC.root.classList.remove('edit'); TC.el.ed.classList.add('hidden'); TC.el.ed.querySelector('.ed-share').classList.add('hidden');
  for (const b of TC.root.querySelectorAll('.sel')) b.classList.remove('sel');
  TC.root.classList.toggle('hidden', !TC.show); // in menu or pause: the controls hide again
  if (TC.fromPause && MATCH.state === 'paused') $('pause').classList.add('show');
  TC.fromPause = false; sfxUi('back');
}
function touchEditSelect(id) {
  TC.sel = id;
  for (const k of touchLayoutIds()) touchHit(k).classList.toggle('sel', k === id);
  const ed = TC.el.ed, def = id === 'stick' ? [0, 0, 0, Settings.tcStick === 'fixed' ? _t('Joystick') : _t('Joystick (its size, it appears under the finger)')] : id && TC_BTNS.find((x) => x[0] === id);
  ed.querySelector('#tcEdName').textContent = def ? def[3] : _t('Touch a button, then drag it');
  for (const a of ed.querySelectorAll('[data-ed=minus],[data-ed=plus],[data-ed=toggle]')) a.disabled = !def;
  ed.querySelector('[data-ed=toggle]').disabled = !def || id === 'stick'; // the joystick can't be removed
  const L = id && TC.lay[touchLayKey(id)], off = !!(L && L[3]);
  ed.querySelector('[data-ed=toggle]').textContent = off ? _t('Put back') : _t('Remove');
}
function touchEditDown(id, e) {
  touchEditSelect(id);
  if (id === 'stick' && Settings.tcStick !== 'fixed') return; // floating: its place is the finger's, only its size is set
  const b = touchHit(id), r = b.getBoundingClientRect();
  TC.drag = { id, pid: e.pointerId, dx: e.clientX - (r.left + r.width / 2), dy: e.clientY - (r.top + r.height / 2) };
  try { b.setPointerCapture(e.pointerId); } catch (er) { /* ignored */ }
}
function touchEditMove(e) {
  const D = TC.drag; if (!TC.edit || !D || e.pointerId !== D.pid) return;
  const L = touchLayoutGet(D.id);
  L[0] = round4(clamp(touchFrac(e.clientX - D.dx, 'x'), 0.03, 0.97)); L[1] = round4(clamp(touchFrac(e.clientY - D.dy, 'y'), 0.05, 0.95));
  touchLayoutOne(D.id);
}
function touchEditUp(e) { if (TC.drag && e.pointerId === TC.drag.pid) { TC.drag = null; saveSettings(); } }

function touchEditAct(a) {
  const ed = TC.el.ed, share = ed.querySelector('.ed-share'), ta = share.querySelector('textarea'), msg = share.querySelector('p');
  if (a === 'done') return touchEditClose();
  if (a === 'minus' || a === 'plus') { if (!TC.sel) return; const L = touchLayoutGet(TC.sel); L[2] = Math.round(clamp(L[2] + (a === 'plus' ? 1 : -1), TC.sel === 'stick' ? 16 : TC_MINU, TC.sel === 'stick' ? 40 : TC_MAXU) * 10) / 10; touchLayoutOne(TC.sel); saveSettings(); return; }
  if (a === 'toggle') { if (!TC.sel) return; const L = touchLayoutGet(TC.sel); L[3] = L[3] ? 0 : 1; touchLayoutOne(TC.sel); touchEditSelect(TC.sel); saveSettings(); return; }
  if (a === 'reset') { Settings.tcLay = null; touchLayoutApply(); touchEditSelect(null); saveSettings(); sfxUi('back'); return; }
  if (a === 'share') { share.classList.toggle('hidden'); if (!share.classList.contains('hidden')) { ta.value = touchLayoutExport(); msg.textContent = ''; } return; }
  if (a === 'copy') {
    ta.value = touchLayoutExport(); ta.select();
    const ok = () => { msg.textContent = _t('Copied.'); }, no = () => { msg.textContent = _t('Select the text and copy it.'); };
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(ok, no); else no(); } catch (e) { no(); }
    return;
  }
  if (a === 'apply') { msg.textContent = touchLayoutImport(ta.value) ? _t('Layout applied.') : _t('Text not recognized.'); touchEditSelect(null); }
}
/* Layout as text: {"v":1,"run":"button","b":{"fire":[0.88,0.78,20,0],...}} (only the moved buttons appear in it; adsA: aiming in auto-fire) */
function touchLayoutExport() { return JSON.stringify({ v: 1, run: Settings.tcRun, b: TC.lay }); }
function touchLayoutImport(txt) {
  let o; try { o = JSON.parse(txt); } catch (e) { return false; }
  if (!o || o.v !== 1 || !o.b || typeof o.b !== 'object') return false;
  const lay = {}, ids = new Set(touchLayoutIds().concat('adsA'));
  for (const id in o.b) {
    const v = o.b[id]; if (!ids.has(id) || !Array.isArray(v) || v.length < 3 || !v.slice(0, 3).every((n) => typeof n === 'number' && isFinite(n))) return false;
    lay[id] = [clamp(v[0], 0.03, 0.97), clamp(v[1], 0.05, 0.95), clamp(v[2], id === 'stick' ? 16 : TC_MINU, id === 'stick' ? 40 : TC_MAXU), id !== 'stick' && v[3] ? 1 : 0];
  }
  if (o.run === 'button' || o.run === 'stick') Settings.tcRun = o.run;
  Settings.tcLay = Object.keys(lay).length ? lay : null; saveSettings(); touchLayoutApply(); syncOptions(); return true; // (text without a button: original layout)
}
