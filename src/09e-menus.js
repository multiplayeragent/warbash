/* ==========================================================================
   MENUS: main menu, solo, multiplayer (lobby), classes, options,
   match loading, deployment (class selection) and pause menu.
   Screens are <section class="scr"> elements of #ui; only one is visible (UI.screen).
   Escape goes back, arrows move focus, Enter confirms.
   The online lobby keeps its elements and logic in 09c-net.js (netRender).
   ========================================================================== */
const UI = { screen: 'main', stack: [], busy: false, flow: null, timer: 0, pm: 'home', lobbyBack: false };
/* A class change is applied right away if the player just spawned (seconds); otherwise on respawn */
const CLASS_GRACE = 5;
const DEPLOY_AUTO = 30; // online, automatic deployment after this delay (seconds)
const DIFF_HINT = [_t('Slow reactions and inaccurate shots, to find your feet.'), _t('A fair opponent that aims and reacts like an average player.'), _t('Sharp reactions and accurate shots. They jump, slide and flank like real players.')];
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const uiWait = (ms) => new Promise((r) => setTimeout(r, ms));
const cls = (i) => CLASSES[i] || CLASSES[0];

/* ---------- Screens ---------- */
function uiOpen(name = 'main', stack = []) {
  UI.stack = stack.slice(); UI.busy = false; UI.flow = null; UI.timer = 0;
  $('matchload').classList.add('hidden'); $('ui').classList.remove('hidden');
  uiGo(name, false, true);
}
function uiHide() { $('ui').classList.add('hidden'); }
function uiGo(name, push = true, fresh = push) {
  const toLobby = name === 'play' && netInLobby(); if (toLobby) name = 'multi'; // already in a lobby: Play takes you back to it
  // a lobby opened without going through the lobby list (Play, With friends, the group following its leader): leaving it goes back to the previous screen
  if (name === 'multi' && UI.screen !== 'multi') UI.lobbyBack = toLobby;
  if (UI.screen === 'arsenal' && name !== 'arsenal') arsLeave(); // class models built in advance, trials freed
  if (push && UI.screen !== name) UI.stack.push(UI.screen);
  UI.screen = name; $('ui').dataset.screen = name; gpuLog('screen ' + name);
  for (const s of $$('.scr')) s.classList.toggle('on', s.id === 'scr-' + name);
  uiRefresh(name, fresh);
  const root = $('scr-' + name);
  // arriving on the screen: an element gets focus for keyboard and gamepad; not on touch, where it would show highlighted for nothing
  // (the first arrow or the first gamepad press then sets it: padNav finds the chosen element or the first one)
  if (TOUCH.on && !PAD.drive) { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); return; }
  if (LM.scr[name]) return; // menu list: it sets the focus itself (the row we were on)
  const first = root.querySelector('.mbtn') || root.querySelector('[data-focus]') || root.querySelector('.deploy:not(:disabled)') || root.querySelector('button:not(.back):not(:disabled)');
  if (first) requestAnimationFrame(() => first.focus({ preventScroll: true }));
}
function uiBack() {
  if (UI.busy) return false;
  const L = LM.scr[UI.screen]; if (L && lmPop(L)) { sfxUi('back'); return true; } // a submenu first
  if (UI.screen === 'multi' && netInLobby()) { netLeaveAsk(); return true; } // in a lobby, Back is the only exit: "Leave the lobby?" in the middle of the screen
  if (UI.screen === 'profile' && ACCT.code) return false; // backup code displayed: you only leave it by ticking "I've written it down" (Back, Escape and B do nothing)
  if (UI.screen === 'deploy') { if (UI.flow && !UI.flow.online) { menuCancelFlow(); return true; } return false; }
  const prev = UI.stack.pop(); if (!prev) return false;
  uiGo(prev, false); sfxUi('back'); return true;
}
function uiRefresh(name, fresh) {
  if (name === 'main') menuMainRefresh();
  else if (name === 'solo') { if (fresh) lmReset(LM.scr.solo); else lmRender(LM.scr.solo, { focus: true, restore: true }); }
  else if (name === 'multi') netRender({ focus: true, restore: true, fresh });
  else if (name === 'classes' || name === 'deploy') { if (name === 'classes') { CPV.view = -1; CPV.confirm = -1; classesHeader(); } PICKERS.forEach(renderPicker); if (name === 'deploy') renderDeploy(); }
  else if (name === 'options') syncOptions();
  else if (name === 'arsenal') renderArsenal();
  else if (name === 'skins') renderSkins(); // outfits (09u-outfits.js)
  else if (name === 'news') renderNews();
  else if (name === 'friends') friendsListScreen(); // friends (09ta-friends.js)
  else if (name === 'play') playRender();
  else if (name === 'profile') acctRefreshScreen();
  else if (name === 'main') acctChip(); // the level may have gone up during the match
  else if (name === 'ranking' || name === 'player' || name === 'notifs') socScreen(name); // social life (09t-social.js)
  else if (name === 'moderation') modScreen(); // moderation (09v-moderation.js)
  else if (name === 'community') commScreen(); // Community (09z-community.js)
  else if (name === 'legal') legalRender();
  friendsInviteCard(); // invitation received: the inset follows the screen (hidden on the Friends screen)
}
function menuMainRefresh() {
  deckCard(); // Steam Deck (09ra-deck.js)
  // Play: where you stand (open lobby), otherwise the ways to play
  $('mmPlay').textContent = SRV.on ? (SRV.st && SRV.st.ps ? srvTitle() : _t('Public lobby, {0}', srvTitle())) : NET.role !== 'off' ? _t('Lobby {0}', NET.code) : _t('Solo, with friends or online');
  newsBadge();
}
/* Called by netRender: the main menu's subtitle follows the lobby state */
function menuNetChanged() { if (UI.screen === 'main') menuMainRefresh(); }

/* ---------- Components ---------- */
/* Exclusive choice: items = [[value, label]] */
function seg(root, items, get, set) {
  root.innerHTML = '';
  for (const [v, label] of items) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.dataset.v = String(v); b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(v === get()));
    b.addEventListener('click', () => { for (const x of root.children) x.setAttribute('aria-checked', String(x === b)); sfxUi('tab'); set(v); }); // set() may rebuild the row: we tick first
    root.appendChild(b);
  }
}
/* Map illustrations (map selection, loading screen): a view of the scenery rendered by the game, published next
   to the page (dist/maps/, see tools/dev/illustrations.js), visible before any map loading */
const MAP_ART = /*__MAP_ART__*/ {};
/* Illustration of map m in the image el (hidden if the map has none) */
function setMapArt(el, m) {
  const src = m.ok && MAP_ART[m.id];
  el.classList.toggle('none', !src);
  if (src) { if (el.getAttribute('src') !== src) el.src = src; } else el.removeAttribute('src');
}

/* ---------- Class selector (menu, deployment, pause) ----------
   Four preset classes, then five custom class slots (06r-arsenal.js): locked (player level
   insufficient), free (to create) or created. The Classes menu shows all nine; deployment and pause, those you can choose. */
const PICKERS = [];
/* Slot (neither chosen nor available) displayed in detail in the menu: locked or free slot; confirm: deletion to confirm */
const CPV = { view: -1, confirm: -1 };
const cname = (i) => esc(cls(i).name);
function mountClassPicker(root, mode) {
  root.className = 'cp'; root.innerHTML = '<div class="cp-list" role="listbox" aria-label="Classes"></div><div class="cp-detail" aria-live="polite"></div>';
  const P = { root, mode, list: root.firstChild, detail: root.lastChild };
  P.list.dataset.lm = '.cls'; // list navigation (09ea-list.js, padListNav)
  P.list.addEventListener('click', (e) => { const b = e.target.closest('.cls'); if (b) { pickClass(+b.dataset.i); sfxUi('click'); } });
  if (mode === 'deploy') P.list.addEventListener('dblclick', (e) => { const b = e.target.closest('.cls'); if (b && classAvail(+b.dataset.i)) menuDeploy(); });
  P.detail.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const v = P.mode === 'menu' && CPV.view >= 0 ? CPV.view : Settings.loadout, act = b.dataset.act;
    if (act === 'edit') arsOpen(v);
    else if (act === 'create') { const i = classCreate(CLASSES[v].slot); if (i >= 0) { pickClass(i); arsOpen(i); } }
    else if (act === 'delete') { CPV.confirm = v; PICKERS.forEach(renderPicker); return; }
    else if (act === 'delete-yes') { classDelete(v); CPV.confirm = -1; CPV.view = -1; PICKERS.forEach(renderPicker); if (UI.screen === 'main') menuMainRefresh(); if (UI.screen === 'solo') renderSolo(); }
    else if (act === 'delete-no') { CPV.confirm = -1; PICKERS.forEach(renderPicker); return; }
    sfxUi('click');
  });
  PICKERS.push(P); renderPicker(P); return P;
}
function pickClass(i) {
  if (classAvail(i)) { Settings.loadout = i; saveSettings(); CPV.view = -1; } else CPV.view = i; // locked or free slot: preview only
  CPV.confirm = -1;
  PICKERS.forEach(renderPicker);
  if (UI.screen === 'main') menuMainRefresh();
  if (MATCH.state === 'paused') pmClassRefresh();
  if (UI.screen === 'solo') renderSolo();
  if (UI.screen === 'deploy') renderDeploy();
}
/* Classes menu subtitle: player level and next custom slot */
function classesHeader() {
  const lvl = playerLevel(), next = CUSTOM_UNLOCK.find((v) => v > lvl), n = CUSTOM_UNLOCK.filter((v) => v <= lvl).length;
  $('clsSub').textContent = `${_tn(n, 'Level {1}: {0} custom class slot out of {2}', 'Level {1}: {0} custom class slots out of {2}', lvl, CUSTOM_MAX)}` + (next ? `${_t(', the next one at level {0}.', next)}` : _t(', all unlocked.'));
  if (ACCT.state === 'ready' && !ACCT.user) $('clsSub').textContent += ' ' + _t('Not signed in. Your progress stays on this device.'); // the copy to the account (06r-arsenal.js) requires being logged in
}
/* Image preview of a weapon (thumbnail from 09o-showcase.js, filled in as soon as it's ready) */
const thumbImg = (d) => `<img data-thumb="${d.key}"${VTHUMB.img[d.key] ? '' : ' data-pend'} alt="" src="${weaponThumbKey(d.key, d.id)}" decoding="async">`;
function renderPicker(P) {
  const sel = Settings.loadout, inMatch = MATCH.state === 'paused' || MATCH.state === 'playing', menu = P.mode === 'menu';
  const view = menu && CPV.view >= 0 ? CPV.view : sel, ids = menu ? CLASSES.map((c, i) => i) : classIds(), lvl = playerLevel();
  const act = document.activeElement, keep = act && act.dataset && act.dataset.i && P.list.contains(act) ? act.dataset.i : null;
  let html = '', group = '';
  const withGroups = menu || ids.some((i) => CLASSES[i].custom);
  for (const i of ids) {
    const c = CLASSES[i], g = c.custom ? _t('Custom') : _t('Preset');
    if (withGroups && g !== group) html += `<div class="cls-h">${g}</div>`;
    group = g;
    const sl = c.custom ? `aria-selected="${i === view}"` : `aria-selected="${i === view}"`;
    if (c.custom && !c.made) {
      const lock = lvl < CUSTOM_UNLOCK[c.slot];
      html += `<button type="button" class="cls ${lock ? 'lock' : 'free'}" role="option" data-i="${i}" ${sl}><span class="cn">${lock ? _t('Locked') : _t('+ Create a class')}</span><span class="cw">${lock ? _t('Level {0} required', CUSTOM_UNLOCK[c.slot]) : _t('Slot {0}', c.slot + 1)}</span></button>`;
      continue;
    }
    const W = classWeapons(i);
    // in a match: "In progress" on the equipped class, "Next" on the one equipped at the next respawn; in the menu, "Selected" on the starting class
    const badge = inMatch && i === PL.classIdx ? _t('<span class="cb">Active</span>') : inMatch && i === sel ? `<span class="cb next">${_t('Next')}</span>` : menu && i === sel ? `<span class="cb next">${_t('Selected')}</span>` : '';
    html += `<button type="button" class="cls" role="option" data-i="${i}" ${sl}><span class="cn">${esc(c.name)}</span><span class="cw">${_t('{0} and {1}', W[0].name, W[1].name)}</span>${badge}</button>`;
  }
  P.list.innerHTML = html;
  if (keep) { const el = P.list.querySelector(`[data-i="${keep}"]`); if (el) el.focus({ preventScroll: true }); }
  P.detail.innerHTML = classDetailHtml(P, view);
}
function classDetailHtml(P, v) {
  const c = CLASSES[v], lvl = playerLevel();
  if (c.custom && !c.made) {
    const n = c.slot, need = CUSTOM_UNLOCK[n];
    if (lvl < need) {
      const prev = n ? CUSTOM_UNLOCK[n - 1] : 1, pct = clamp((lvl - 1) / (need - 1), 0, 1);
      return `<div class="cp-lock"><p class="wtype">${_t('Custom slot {0}', n + 1)}</p><b>${_t('Level {0} required', need)}</b><p class="cdesc">${_t('Level up by playing to unlock this slot. You will build your own class there (weapons, attachments, camos) and you will be able to rename it.')}</p><div class="bar"><i style="width:${(pct * 100).toFixed(0)}%"></i></div><p class="hint">${_t('Your level: {0}{1}', lvl, ACCT.user ? '' : ' ' + _t('(on this device, sign in to track your account level)'))}</p></div>`;
    }
    return `<div class="cp-lock"><p class="wtype">${_t('Custom slot {0}', n + 1)}</p><b>${_t('Free slot')}</b><p class="cdesc">${_t('Build your class. Primary weapon, pistol, attachments placed on a 3D view of the weapon, camos. You will be able to rename it.')}</p>${P.mode === 'pause' ? '' : _t('<div class="cp-btns"><button type="button" class="btn cp-edit" data-act="create">Create this class</button></div>')}</div>`;
  }
  const [p, s] = classWeapons(v);
  // a weapon's attachments and camo; h: preceded by the "Attachments" overline (primary weapon)
  const chips = (d, h) => `<div class="acs">${h ? `<span class="acs-h">${_t('Attachments')}</span>` : ''}${d.att.map((a) => `<span class="ac">${esc(attName(a, d))}</span>`).join('')}${d.camo ? `<span class="ac camo">${CAMOS[d.camo].name}</span>` : ''}${d.att.length || d.camo ? '' : `<span class="hint">${h ? _t('None') : _t('No attachment')}</span>`}</div>`;
  // actions, always in the same place (under the description): edit and delete a custom class, otherwise whatever stands in for them
  let foot = '';
  if (P.mode === 'pause') foot = _t('<p class="hint">Build your custom classes in the workshop, from the main menu (Classes) or at deployment.</p>');
  else if (c.custom) {
    foot = CPV.confirm === v
      ? `<div class="cp-btns"><span class="hint">${_t('Delete class {0}?', esc(c.name))}</span><button type="button" class="btn danger" data-act="delete-yes">${_t('Delete')}</button><button type="button" class="btn" data-act="delete-no">${_t('Keep')}</button></div>`
      : `<div class="cp-btns"><button type="button" class="btn cp-edit" data-act="edit">${_t('Edit class')}</button>${P.mode === 'menu' ? `<button type="button" class="btn danger" data-act="delete">${_t('Delete')}</button>` : ''}</div>`;
  } else foot = _t('<p class="hint">Preset class: it cannot be edited. Build your own in a custom slot (Classes).</p>');
  // two blocks: the weapon (visuals, name, description, actions always in this place, attachments) and its numbers (statistics, equipment with
  // the pistol and its attachments); side by side when the detail is wide (Classes menu), one under the other otherwise
  return `<div class="cp-cols"><div class="cp-a">
    <div class="cp-img"><figure>${thumbImg(p)}<figcaption>${p.name}</figcaption></figure><figure class="sec">${thumbImg(s)}<figcaption>${s.name}</figcaption></figure></div>
    <p class="wtype">${p.type}</p>
    <h3 class="wname">${p.name}<span class="lvtag">${_t('level {0}', wLevel(p.id))}</span></h3>
    <p class="cdesc">${esc(c.desc)}</p>
    ${foot}
    ${chips(p, true)}
    </div><div class="cp-b">
    ${STAT_NAMES.map(([k, n]) => statBar(n, p.base.stats[k], p.stats[k])).join('')}
    <dl class="kit"><div><dt>${_t('Secondary')}</dt><dd>${s.name}<span class="lvtag">${_t('level {0}', wLevel(s.id))}</span>${chips(s)}</dd></div><div><dt>${_t('Equipment')}</dt><dd>${nadeCount(c.nade, c.nades)}</dd></div><div><dt>${_t('Magazine')}</dt><dd>${_t('{0} rounds', p.mag)}</dd></div><div><dt>${_t('Killstreaks')}</dt><dd>${classKs(v).map((id) => `${esc(KSDEF[id].short)} <span class="lvtag">${KSDEF[id].n}</span>`).join(' ')}</dd></div></dl>
    </div></div>`;
}

/* Seconds remaining during which a class change is applied immediately */
function classGraceLeft() {
  const e = PL.ent; if (!e.alive || (MATCH.state !== 'paused' && MATCH.state !== 'playing')) return 0;
  if (cdOn()) return CLASS_GRACE + (CD.wait ? cdLen() : MATCH.cd); // start countdown: the delay starts from the start (09y-countdown.js)
  return Math.max(0, CLASS_GRACE - (MATCH.time - (e.spawnAt || 0)));
}
/* Pause: class selection state (message and button) */
function pmClassRefresh() {
  const sel = Settings.loadout, act = PL.classIdx, left = classGraceLeft(), ok = $('pmClassOk'), n = cls(sel).name;
  let msg;
  ok.textContent = _t('Equip now');
  if (sel === act) { msg = `${_t('Current class: {0}.', n)}`; ok.disabled = true; }
  else if (left > 0) { msg = `${_t('You just spawned. Class {0} can be equipped right away{1}.', n, MATCH.online ? ' ' + _t('({0} s left)', left.toFixed(1)) : '')}`; ok.disabled = false; }
  else { msg = `${_t('Class {0} will be equipped at your next respawn.', n)}`; ok.disabled = true; }
  ok.classList.toggle('hidden', ok.disabled);
  $('pmClassMsg').textContent = msg;
  $('pmClassHint').textContent = sel === act ? cls(act).name : _t('{0}, then {1}', cls(act).name, n);
}
function commitClass() {
  if (classGraceLeft() <= 0 || Settings.loadout === PL.classIdx) return;
  giveLoadout(); pmClassRefresh(); PICKERS.forEach(renderPicker);
  hudMsg(`${_t('Class {0} equipped', cls(PL.classIdx).name)}`, 'xp', 2.5);
}

/* Texts that the CSS displays (shell.html: content: var(--t-...)): the language comes from here */
for (const [k, v] of [['sel', _t('Selected')], ['soon', _t('Soon')], ['slow', _t('slow motion')]]) document.documentElement.style.setProperty('--t-' + k, JSON.stringify(v));

/* ---------- Options ---------- */
const OPTS = [];
function toggleFullscreen() {
  const r = document.documentElement;
  if (!document.fullscreenElement && r.requestFullscreen) r.requestFullscreen().catch(() => {}); else if (document.exitFullscreen) document.exitFullscreen();
}
/* Economy graphics mode: read at load time, the page reloads (like the language); outside a match only */
function gfxApply() {
  if (netInLobby() && !confirm(_t('Changing graphics mode reloads the game. You will leave the lobby. Continue?'))) { Settings.gfxSafe = GFX_SAFE; saveSettings(); syncOptions(true); return; }
  Settings.gfxSafeAuto = Settings.gfxSafe ? 'manual' : ''; saveSettings(); // player's choice: it persists from one build to the next
  location.reload();
}
/* Minimal quality chosen or left: its baked shadows and the absence of a pre-pass only change at launch (ULTRA, 01-core.js). From the menus,
   we offer to relaunch; in a match, the rest of the profile applies right away and the shadows will follow at the next launch. */
function qualityBootCheck() {
  if (ultraAtBoot(gfxSet('quality')) === ULTRA || MATCH.state !== 'menu' || netInLobby()) return;
  if (confirm(_t('Shadows change the next time the game starts. Restart now?'))) location.reload();
}
/* Lock of an image row (seventh element of a select or check row): under power saving, the imposed value (gfxSet), otherwise null */
const ecoLock = (k) => () => (Settings.eco ? gfxSet(k) : null);
const OPT_TABS = [
  [_t('Game'), [
    ['head', _t('Touch screen')], // group title (mountOptions): displayed only if one of its rows is
    ['select', 'touch', _t('Touch controls'), [['auto', _t('Automatic')], ['on', _t('On')], ['off', _t('Off')]], () => touchDetect()],
    ['select', 'tcRun', _t('Running by touch'), [['button', _t('Run button')], ['stick', _t('Joystick pushed past the circle')]], null, 'touch'],
    ['select', 'tcStick', _t('Joystick'), [['float', _t('Appears under the finger')], ['fixed', _t('Fixed on screen')]], null, 'touch'],
    ['check', 'tcAuto', _t('Auto-fire (when the crosshair is on an enemy, the aim button replaces the fire button)'), null, null, 'touch'],
    ['check', 'tcDblAds', _t('Double-tap aiming (no Aim button)'), null, null, 'touch'],
    ['check', 'tcQuick', _t('Fire on release (sniper rifles, press to aim and release to fire)'), null, null, 'touch'],
    ['check', 'tcVib', _t('Vibration (hit, kill, damage taken)'), null, null, 'touch'],
    ['select', 'tcAlpha', _t('Button opacity'), [['1', '100 %'], ['0.75', '75 %'], ['0.5', '50 %']], () => touchAlpha(), 'touch'],
    ['button', _t('Touch controls layout'), () => touchEditOpen(), null, null, 'touch'],
    ['head', _t('Trackpad')], // detection is in 09qe-touchpad.js; the "trackpad" rows only appear with the mode (body.trackpad)
    ['select', 'tpMode', _t('Trackpad controls (auto fire, double click to aim)'), [['auto', _t('Automatic')], ['on', _t('On')], ['off', _t('Off')]], () => trackpadSync(), 'desk'],
    ['check', 'tpAuto', _t('Auto fire (when the crosshair is on an enemy, clicking no longer fires)'), null, null, 'trackpad'],
    ['check', 'tpDblAds', _t('Aim with a double click or a two finger tap (another one lowers the weapon)'), null, null, 'trackpad'],
    ['range', 'tpSens', _t('Trackpad sensitivity'), 0.2, 3, 0.05, (v) => v.toFixed(2), null, 'trackpad'], // independent of the mouse (Settings.sens): see 08-player.js
    ['head', _t('Aiming')],
    ['range', 'sens', _t('Sensitivity'), 0.2, 3, 0.05, (v) => v.toFixed(2)],
    ['range', 'adsMul', _t('Zoomed aim (speed relative to hip)'), 0.2, 1.5, 0.05, (v) => Math.round(v * 100) + PCT],
    ['range', 'fov', _t('Field of view'), 50, 80, 1, (v) => Math.round(v) + '°', () => { if (MATCH.state === 'menu') { camera.fov = Settings.fov; camera.updateProjectionMatrix(); } }],
    ['check', 'invertY', _t('Invert vertical axis')],
    ['check', 'adsToggle', _t('Toggle aim with the mouse (one right click aims, another lowers the weapon)'), () => trackpadSync(), null, 'desk'],
    ['select', 'aimAssist', _t('Aim assist (touch, controller, trackpad)'), [['normal', _t('Normal')], ['off', _t('Off')]], null, 'assist'],
    ['head', _t('Controller')],
    ['range', 'padSens', _t('Controller sensitivity'), 0.3, 2.5, 0.05, (v) => v.toFixed(2)],
    ['range', 'padAdsMul', _t('Zoomed aim (controller, speed relative to hip)'), 0.2, 1.5, 0.05, (v) => Math.round(v * 100) + PCT],
    ['range', 'padDead', _t('Stick dead zone'), 0.05, 0.4, 0.01, (v) => Math.round(v * 100) + PCT],
    ['select', 'padCurve', _t('Aim response (controller)'), [['reactive', _t('Responsive')], ['classic', _t('Progressive')], ['linear', _t('Linear')]]],
    ['select', 'padAccel', _t('Aim acceleration (controller, stick pushed all the way)'), [['off', _t('None')], ['normal', _t('Normal')], ['strong', _t('Strong')]]],
    ['select', 'padLay', _t('Controller layout'), [['default', _t('Default')], ['southpaw', _t('Southpaw (sticks swapped)')], ['bumper', _t('Bumper jumper (jump on LB)')]]],
    ['select', 'padRun', _t('Sprinting with a controller'), [['click', _t('Press the left stick (L3)')], ['auto', _t('Stick pushed all the way')]]],
    ['check', 'padVib', _t('Controller vibration')],
    ['head', _t('Interface')],
    ['check', 'allyMarks', _t('Ally markers (above their heads)')],
    ['check', 'nadeArc', _t('Grenade trajectory (while holding a grenade)')],
    ['select', 'hudScale', _t('In-game interface size'), [['0.85', '85' + PCT], ['1', '100' + PCT], ['1.15', '115' + PCT], ['1.3', '130' + PCT]], null, 'desk'], // --hud-k (updateHud); on touch, the HUD follows the screen height
    ['check', 'fsGame', _t('Fullscreen in match (when a match starts, Esc resumes without a click)')],
  ]],
  [_t('Audio'), [
    ['range', 'volume', _t('Master volume'), 0, 1, 0.05, (v) => Math.round(v * 100) + PCT, () => setVolume(Settings.volume)],
    ['range', 'music', _t('Menu music'), 0, 1, 0.05, (v) => Math.round(v * 100) + PCT],
    ['check', 'voice', _t('Voice announcements (killstreaks, objectives)')],
  ]],
  [_t('Video'), [
    ['head', _t('Image')],
    // power saving: master setting, the image rows below are greyed out and show what the game imposes (ECO_GFX, CAP, 01-core.js)
    ['check', 'eco', _t('Power saving (30 frames per second, the game sets the picture for your device so the battery lasts longer)'), () => ecoApply()],
    ['select', 'quality', _t('Quality'), [['auto', _t('Automatic')], ['high', _t('High')], ['medium', _t('Medium')], ['low', _t('Low')], ['ultra', _t('Minimum')]], () => { qualityReset(); qualityBootCheck(); }, null, ecoLock('quality')],
    ['check', 'ao', _t('Ambient occlusion'), () => applyQuality(), null, null, ecoLock('ao')],
    ['check', 'rays', _t('Sun rays'), () => applyQuality(), null, null, ecoLock('rays')],
    ['check', 'grass', _t('3D grass on lawns'), null, null, null, ecoLock('grass')],
    ['check', 'dynres', _t('Dynamic resolution'), () => { if (!Settings.dynres) RQ.scale = 1; applyResolution(); }, null, null, ecoLock('dynres')],
    ['select', 'fpsMax', _t('Frame rate limit'), [['0', _t('No limit')], ['120', '120'], ['90', '90'], ['60', '60'], ['30', '30'], ['half', _t('Half refresh rate')]], null, null, () => (Settings.eco ? '30' : null)], // frame rate limit (CAP)
    ['head', _t('Display and troubleshooting')],
    ['check', 'perf', _t('Show performance'), () => { $('perf').classList.toggle('hidden', !Settings.perf); if (!Settings.perf) pfrStop(); else if (!PFR.on && ['playing', 'paused', 'finish', 'killcam'].includes(MATCH.state)) pfrStart(); }],
    ['button', _t('Performance report'), () => pfrShow()], // each frame of the last match played with performance displayed (09zo-perfs.js)
    ['check', 'gfxSafe', _t('Economy graphics mode (if the game gets interrupted or shows black, reloads the game)'), () => gfxApply(), null, 'menu'],
    ['button', _t('Graphics report'), () => gpuReport(), null, null, 'menu'],
    ['button', _t('Fullscreen'), toggleFullscreen],
  ]],
  [_t('Controls'), null],
];
const KEYS_HELP = [ // what can't be changed: the action keys are in the editor (08a-binds.js)
  [_t('Mouse'), _t('Aim, left click to fire, right click to aim down sights')], [_t('Wheel'), _t('Switch weapon')], [_t('Esc'), _t('Pause menu: class, options, quit')],
];
const TRACKPAD_HELP = [ // touchpad (09qe-touchpad.js): the mouse, without wheel or firing click
  [_t('Trackpad'), _t('Slide to look, double click or two finger tap to aim down sights. Fire starts on its own when the crosshair is on an enemy')], [_t('Esc'), _t('Pause menu: class, options, quit')],
];
const TOUCH_HELP = [
  [_t('Joystick (left)'), _t('Move. Pushed past the circle, it sprints (adjustable with the Run button)')], [_t('Drag (right)'), _t('Look around')],
  [_t('Fire buttons'), _t('Shoot. The finger can slide to look around')], [_t('Aim'), _t('One tap shoulders the weapon, another lowers it. A long press aims while your finger stays down')],
  [_t('Jump, crouch'), _t('Crouching while sprinting makes a slide')], [_t('Reload, switch weapon'), _t('Buttons on the right of the screen')],
  [_t('Grenade'), _t('Press to pull the pin, release to throw')], [_t('Knife'), _t('Tap to stab. Hold to take the knife out and run faster. Switching weapons puts it away')], [_t('Pick up'), _t('The pickup button appears near a weapon on the ground')],
  [_t('Killstreaks'), _t('Yellow buttons on the left, when they are ready')], [_t('Pause, scores, chat'), _t('Buttons at the top right')], [_t('Layout'), _t('Options, Game: move, resize or remove each button')],
];
/* Gamepad help (Options, Controls): button names become the prompt glyphs (09x-invites.js) */
const PAD_HELP_BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, Menu: 9 };
function padHelpKey(k) {
  if (k === _t('Back')) return padGlyph(8);
  if (k === _t('D-pad')) return padGlyph(12);
  const parts = k.split(' / ');
  return parts.every((p) => p in PAD_HELP_BTN) ? parts.map((p) => padGlyph(PAD_HELP_BTN[p])).join(' ') : k;
}
/* Options: tabs (Game, Audio, Video, Controls), one row per setting (segmented choices, sliders, switches). On gamepad and
   keyboard, the row is the unit: up and down move from row to row (yellow bar), left and right adjust, A toggles or moves to the
   next choice, LB and RB change tab. Mouse and touch hit the choices directly. */
/* Row handled as a whole: adj(d) adjusts it by one step (left, right), act() answers A, Enter or a click on the row itself; the
   controls it contains no longer take focus (mouse and touch still hit them) */
function optNav(row, adj, act) {
  row.tabIndex = 0; row.classList.add('onav');
  if (adj) { row._adj = adj; row._adjK = true; }
  for (const c of row.querySelectorAll('button, input')) c.tabIndex = -1;
  if (act) row.addEventListener('click', (e) => { if (e.target === row || (e.target.parentNode === row && e.target.tagName === 'SPAN')) act(); });
  row.addEventListener('keydown', (e) => { if (e.target === row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); row.click(); } });
}
function mountOptions(root) {
  root.innerHTML = '<div class="tabs" role="tablist"></div><div class="orows"></div>';
  const tabs = root.firstChild, body = root.lastChild, O = { root, syncs: [] };
  body.dataset.lm = '.onav';
  // a single highlight: the mouse sets focus on the hovered row (not during gamepad or keyboard navigation)
  body.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse' || document.body.classList.contains('padnav') || document.body.classList.contains('kbnav')) return;
    const row = e.target.closest && e.target.closest('.onav'), a = document.activeElement;
    if (!row || row.contains(a) || (a && a.tagName === 'INPUT' && a.type === 'text')) return;
    row.focus({ preventScroll: true });
  });
  let cur = 0;
  const show = (t) => {
    cur = t; O.syncs = []; body.innerHTML = '';
    [...tabs.children].forEach((b, i) => b.setAttribute('aria-selected', String(i === t)));
    const rows = OPT_TABS[t][1];
    if (!rows) {
      if (!TOUCH.on) { const hb = document.createElement('h4'); hb.className = 'keys-h'; hb.textContent = _t('Keyboard keys'); body.appendChild(hb); bindEditor(body); } // editable keyboard keys (08a-binds.js)
      const hk = document.createElement('h4'); hk.className = 'keys-h'; hk.textContent = TOUCH.on ? _t('Touch screen') : _t('Mouse and fixed keys'); body.appendChild(hk);
      const dl = document.createElement('dl'); dl.className = 'keys'; dl.innerHTML = (TOUCH.on ? TOUCH_HELP : trackpadOn() ? TRACKPAD_HELP : KEYS_HELP).map(([k, d]) => `<dt>${k}</dt><dd>${d}</dd>`).join(''); body.appendChild(dl);
      if (!PAD.seen && !PAD.drive) return; // the gamepad only appears once a gamepad has made itself known (09qc-gamepad.js)
      const h = document.createElement('h4'); h.className = 'keys-h'; h.textContent = _t('Controller (Xbox, PlayStation, 8BitDo...)'); body.appendChild(h);
      const dp = document.createElement('dl'); dp.className = 'keys'; dp.innerHTML = PAD_HELP.map(([k, d]) => `<dt>${padHelpKey(k)}</dt><dd>${d}</dd>`).join(''); body.appendChild(dp); return;
    }
    let head = null; // pending group title: placed before the group's first displayed row
    for (const r of rows) {
      if (r[0] === 'head') { head = r[1]; continue; }
      const cls = r[0] === 'range' ? r[8] : r[5]; // the visibility class: after the ramp and its reminder for a slider, sixth for the rest
      if (cls === 'menu' && root.id !== 'optMenu') continue; // outside-match setting: absent from the pause menu
      if (PAD_KEYS.has(r[1]) && !PAD.seen) continue; // gamepad settings: once a gamepad has made itself known
      if (cls === 'touch' && !TOUCH.on) continue; // touch controls setting: only with touch controls
      if (cls === 'desk' && TOUCH.on) continue; // computer and gamepad HUD setting: pointless on touch
      if (head) { const h = document.createElement('h4'); h.className = 'og'; h.textContent = head; body.appendChild(h); head = null; }
      const kind = r[0], row = document.createElement(kind === 'button' || kind === 'select' ? 'div' : 'label'); row.className = 'orow';
      if (cls === 'trackpad' || (cls === 'assist' && !TOUCH.on && !PAD.seen)) row.dataset.tp = '1'; // touchpad only (shell.html); aim assist: on touch, gamepad or touchpad, never with the mouse
      if (kind === 'button') {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = r[1]; b.addEventListener('click', r[2]);
        row.append(document.createElement('span'), b); body.appendChild(row); optNav(row, null, () => b.click()); continue;
      }
      const [, key, label] = r, name = document.createElement('span'), part = /^(.*?) \((.*)\)$/.exec(label); // "Label (precision)": the precision small below
      name.textContent = part ? part[1] : label; if (part) name.appendChild(Object.assign(document.createElement('small'), { className: 'oh', textContent: part[2] })); row.appendChild(name);
      if (kind === 'range') {
        const [, , , min, max, step, fmt, cb] = r;
        const inp = document.createElement('input'); inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step;
        const out = document.createElement('output');
        const fill = () => inp.style.setProperty('--p', ((Settings[key] - min) / (max - min)) * 100 + '%'); // filled part of the track (shell.html, .orow input[type=range])
        const sync = () => { inp.value = Settings[key]; out.textContent = fmt(Settings[key]); fill(); };
        inp.addEventListener('input', () => { Settings[key] = parseFloat(inp.value); out.textContent = fmt(Settings[key]); fill(); saveSettings(); if (cb) cb(); syncOptions(); sfxUi('tick'); });
        row.append(inp, out); O.syncs.push(sync); sync();
        const dec = Math.max(0, (String(step).split('.')[1] || '').length);
        optNav(row, (d) => { // one notch (four when holding the direction)
          const v = clamp(parseFloat((parseFloat(inp.value) + d * step * (lmStep.fast ? 4 : 1)).toFixed(dec)), min, max);
          if (v !== parseFloat(inp.value)) { inp.value = String(v); inp.dispatchEvent(new Event('input', { bubbles: true })); }
          return true;
        });
      } else if (kind === 'check') {
        const cb = r[3];
        const inp = document.createElement('input'); inp.type = 'checkbox'; inp.setAttribute('role', 'switch'); // drawn as a switch (shell.html)
        const lock = r[6] || (() => null); // lock: as for a segmented choice, further down
        const sync = () => { const f = lock(); inp.checked = f === null ? !!Settings[key] : !!f; inp.disabled = f !== null; row.setAttribute('aria-disabled', String(f !== null)); };
        inp.addEventListener('change', () => { Settings[key] = inp.checked; saveSettings(); if (cb) cb(); syncOptions(); sfxUi('click'); });
        row.appendChild(inp); O.syncs.push(sync); sync();
        optNav(row, (d) => { if (lock() !== null) return true; const on = d > 0; if (inp.checked !== on) { inp.checked = on; inp.dispatchEvent(new Event('change', { bubbles: true })); } return true; }); // A: a click on the label toggles
      } else if (kind === 'select') { // segmented choice, like the match settings
        // r[6]: lock, returns the value imposed by another setting (null: free); the row shows it, greyed out, without changing the kept choice
        const cb = r[4], lock = r[6] || (() => null), box = document.createElement('div'); box.className = 'seg'; box.setAttribute('role', 'radiogroup'); box.setAttribute('aria-label', label);
        seg(box, r[3], () => String(Settings[key]), (v) => { Settings[key] = v; saveSettings(); if (cb) cb(); syncOptions(); }); // the gesture's sound is the segmented choice's (sfxUi('tab'))
        const sync = () => {
          const f = lock(), v = f === null ? String(Settings[key]) : f;
          for (const b of box.children) { b.setAttribute('aria-checked', String(b.dataset.v === v)); b.disabled = f !== null; }
          row.setAttribute('aria-disabled', String(f !== null));
        };
        row.appendChild(box); O.syncs.push(sync); sync();
        const at = () => [...box.children].findIndex((b) => b.getAttribute('aria-checked') === 'true');
        optNav(row, (d) => { if (lock() !== null) return true; const n = box.children.length, i = at(), j = clamp(i + d, 0, n - 1); if (j !== i && box.children[j]) box.children[j].click(); return true; },
          () => { if (lock() !== null) return; const n = box.children.length; box.children[(at() + 1) % n].click(); });
      }
      body.appendChild(row);
    }
  };
  OPT_TABS.forEach(([name], i) => {
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = name;
    b.addEventListener('click', () => { show(i); sfxUi('tab'); }); tabs.appendChild(b);
  });
  O.rebuild = () => show(cur);
  show(0); OPTS.push(O); return O;
}
/* Updates the other instances (menu and pause) after a change */
function syncOptions() { for (const O of OPTS) for (const f of O.syncs) f(); }
function syncSettings() { syncOptions(); }

/* ---------- Solo ---------- */
/* Match settings, shared by Solo and the lobby ("Match settings" submenu): mode and its explanation, players, bots and their
   level, limit, duration, and online the lobby's visibility. All choices are visible; left and right move to the neighbor, a click chooses.
   o = { map, mode, diff, bots (online: 0 or 1), limit, time, online, edit, pubOk, pub, set(key, value) }; edit false: read-only (lobby guest). */
function matchRows(o) {
  const MD = MODES[o.mode] || MODES.tdm, ffa = o.mode === 'ffa', diffs = DIFF.map((d, i) => [i, d.name]), set = (k) => (v) => o.set(k, v), dis = !o.edit;
  const teams = !o.online ? MD.teams : ffa ? (o.bots ? _t('Up to 8 players, filled with bots') : _t('Free for all, human players only'))
    : o.bots ? _t('6 vs 6, filled with bots') : _t('Two teams, human players only');
  const rows = [];
  if (dis) rows.push({ k: 'note', text: o.note || _t('Set by the host') });
  rows.push(
    { k: 'seg', full: true, wide: true, key: 'mode', label: _t('Mode'), items: MODE_IDS.filter((id) => id !== 'dom' || MAP_DEFS[o.map].dom).map((id) => [id, MODES[id].btn]), get: () => o.mode, set: set('mode'), disabled: dis },
    { k: 'note', cls: 'hint', text: MD.hint },
    { k: 'info', label: _t('Players'), value: teams },
    { k: 'seg', full: true, wide: o.online, key: 'bots', label: o.online ? _t('Bots') : _t('Bot difficulty'), items: o.online ? [['off', _t('None')], ...diffs] : diffs, get: () => (o.online && !o.bots ? 'off' : o.diff), set: set('bots'), disabled: dis });
  if (!o.online || o.bots) rows.push({ k: 'note', cls: 'hint', text: DIFF_HINT[o.diff] });
  rows.push(
    { k: 'seg', full: true, key: 'limit', label: MD.lim, items: MD.limits.map((v) => [v, String(v)]), get: () => o.limit, set: set('limit'), disabled: dis },
    { k: 'seg', full: true, key: 'time', label: _t('Maximum duration'), items: [5, 10, 15].map((v) => [v, v + ' min']), get: () => o.time, set: set('time'), disabled: dis });
  if (o.pubOk) rows.push({ k: 'seg', full: true, key: 'pub', label: _t('Lobby'), items: [[0, _t('Private')], [1, _t('Public')]], get: () => (o.pub ? 1 : 0), set: set('pub'), disabled: dis }); // online, with the game server: private or listed
  return rows;
}
/* Size of a map: close combat, medium with three lanes, large and open (README, "Map design rules") */
const mapSize = (m) => (m.ok && MAP_DEFS[m.id] ? { close: _t('Small'), mid: _t('Medium'), open: _t('Large') }[MAP_DEFS[m.id].type] || '' : '');
/* Maps to choose from (Map submenu): illustrated thumbnails, the caption and the size; pick null: display only (lobby guest) */
function mapCards(selId, pick) {
  return MAPS.map((m) => ({
    k: 'card', key: m.id, label: m.name, tag: [m.tag, mapSize(m)].filter(Boolean).join(' · '), art: (m.ok && MAP_ART[m.id]) || '', on: m.id === selId, lock: !m.ok,
    badge: !m.ok ? _t('Soon') : m.id === selId ? _t('Selected') : '', disabled: !m.ok || !pick, pick: () => pick(m.id),
  }));
}
/* The map inset, under the menu (like the old Call of Duty games): its illustration, its name, the mode, the limit and the match duration.
   o: the match settings (matchRows) */
function mapPreview(m, o) {
  const MD = MODES[o.mode] || MODES.tdm, art = m.ok && MAP_ART[m.id], mode = o.mode === 'ffa' ? MD.btn : MD.name;
  return (art ? `<img class="mapart" alt="" decoding="async" src="${art}">` : '<span class="mapart none"></span>')
    + `<div class="pv-t"><b>${esc(m.name)}</b><span class="pv-m">${esc(mode)}</span><span class="pv-i">${esc(o.limit + ' ' + MD.unit + ' · ' + o.time + ' min')}</span></div>`;
}
/* The player, at the head of their team: their name (the account's) and their level */
function lobbyMe(tags) {
  const n = ACCT.user ? ACCT.user.displayName : NET.nick;
  return { k: 'player', key: 'me', label: n || _t('You'), lv: playerLevel(), tags: n ? [_t('you'), ...tags] : tags, me: true };
}
/* Solo stage: the two teams, you and the bots, with the names they will carry (BOT_NAMES); free-for-all, the seven bots in play (modeRoster) */
function soloStage() {
  const ffa = Settings.mode === 'ffa', MD = MODES[Settings.mode] || MODES.tdm;
  const me = lobbyMe([]), bot = (n, i) => ({ k: 'player', key: 'b' + i, label: n, bot: true }); // (their level is in the settings summary)
  if (ffa) {
    const all = [...BOT_NAMES[0], ...BOT_NAMES[1]], idx = all.map((n, i) => i), cut = all.length - FFA_BOTS;
    const off = new Set(idx.filter((i) => i % 3 === 1).concat(idx.slice().reverse()).filter((e, i, a) => a.indexOf(e) === i).slice(0, cut));
    return { head: `<b>${esc(_t('Players'))}</b><span>${esc(MD.teams)}</span>`, cols: [{ head: esc(_t('Free for all')), rows: [me, ...all.filter((n, i) => !off.has(i)).map(bot)] }] };
  }
  return { head: `<b>${esc(_t('Players'))}</b><span>${esc(MD.teams)}</span>`, cols: [
    { cls: 'ally', head: esc(TEAM_NAMES[0]), rows: [me, ...BOT_NAMES[0].map(bot)] },
    { cls: 'enemy', head: esc(TEAM_NAMES[1]), rows: BOT_NAMES[1].map((n, i) => bot(n, 10 + i)) },
  ] };
}
function soloSet(k, v) {
  if (k === 'mode') Settings.mode = v; else if (k === 'bots') Settings.difficulty = v; else if (k === 'limit') Settings[MODES[Settings.mode].key] = v; else Settings.minutes = v;
  saveSettings();
}
function soloCfg() { const MD = MODES[Settings.mode] || MODES.tdm; return { map: Settings.map, mode: Settings.mode, diff: Settings.difficulty, limit: Settings[MD.key], time: Settings.minutes, online: false, edit: true, set: soloSet }; }
const SOLO_PAGES = {
  solo: () => {
    const m = mapById(Settings.map);
    if (!MODES[Settings.mode] || (Settings.mode === 'dom' && !MAP_DEFS[m.id].dom)) Settings.mode = 'tdm';
    const MD = MODES[Settings.mode];
    const rows = [ // the map and settings are in the inset, under the menu
      { k: 'link', key: 'map', label: _t('Map'), page: 'map' },
      { k: 'link', key: 'setup', label: _t('Match settings'), page: 'setup' },
      { k: 'link', key: 'class', label: _t('Edit class'), open: () => uiGo('classes') },
    ];
    if (netInLobby()) rows.push({ k: 'note', text: SRV.on ? _t('You are in a public lobby. Starting a match here leaves it.') : _t('You are in lobby {0}. Starting a match here leaves it.', NET.code) });
    return { title: _t('Solo'), sub: MD.sub, rows, stage: soloStage, preview: mapPreview(m, soloCfg()) };
  },
  map: () => ({ head: _t('Map'), grid: true, rows: mapCards(Settings.map, (id) => { Settings.map = id; saveSettings(); sfxUi('click'); lmPop(LM.scr.solo); }) }),
  setup: () => ({ head: _t('Match settings'), rows: matchRows(soloCfg()) }),
};
function renderSolo() { lmRender(LM.scr.solo); $('soloGo').title = netInLobby() ? _t('Starting a solo match makes you leave the lobby') : ''; }

/* ---------- Launching a match: loading, class selection, deployment ---------- */
/* F = { online, map, deploy }: deploy() actually starts the match once the class is chosen */
function menuLaunch(F) {
  if (UI.busy) return;
  if (!F.online && netInLobby()) netQuit(); // a solo match leaves the lobby (main menu: "Lobby XXXX" disappears)
  UI.busy = true; UI.flow = F;
  uiHide(); if (UI.screen === 'deploy') UI.screen = UI.stack.pop() || 'main';
  menuLoading(F).then((ok) => {
    if (!ok || UI.flow !== F) return;
    UI.busy = false;
    $('matchload').classList.add('hidden'); $('ui').classList.remove('hidden');
    $('depSub').textContent = `${mapById(F.map || Settings.map).name} · ${F.online ? _t('Online match') : _t('Solo')}`;
    $('depBack').classList.toggle('hidden', !!F.online);
    UI.timer = F.online ? DEPLOY_AUTO : 0;
    uiGo('deploy');
  });
}
/* Loading screen: real map progress (09a-loading.js); online, waiting for the other players */
async function menuLoading(F) {
  const m = mapById(F.map || Settings.map), bar = $('mlBar'), msg = $('mlMsg');
  $('mlName').textContent = m.name; $('mlDesc').textContent = m.desc; $('mlMode').textContent = (F.online ? MODES[NET.cfg.mode] || MODES.tdm : MODES[Settings.mode] || MODES.tdm).name + ' · ' + (F.online ? _t('online') : _t('solo'));
  // illustration as background, with a slow forward tracking shot restarted at each load
  const art = $('mlMap'); setMapArt(art, m); art.style.animation = 'none'; void art.offsetWidth; art.style.animation = '';
  $('mlWait').classList.add('hidden'); $('mlBack').classList.add('hidden'); $('mlRep').classList.add('hidden'); $('mlSafe').classList.add('hidden');
  const show = (p, t, id) => { if (id === m.id && UI.flow === F) { bar.style.transform = `scaleX(${p})`; if (t) msg.textContent = t; } };
  bar.style.transition = 'none'; bar.style.transform = 'scaleX(0)'; msg.textContent = _t('Loading the map');
  if (MAPL.id === m.id) show(MAPL.p, MAPL.msg, m.id); // map already loaded, or in progress (lobby)
  void bar.offsetWidth; bar.style.transition = '';
  $('matchload').classList.remove('hidden');
  const t0 = performance.now();
  MAPL.subs.add(show);
  // map construction occupies the main thread for several seconds: we first let the loading screen paint (otherwise the click "blocks" the interface)
  if (MAPL.id !== m.id) await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  try { await mapEnsure(m.id); } catch (e) {
    if (UI.flow !== F) return false;
    msg.textContent = GPUX.culprits.length ? _t('Your device refused some of the game\u0027s rendering programs during loading. Restart the game. They will be replaced by simple versions (see the graphics report).') : GPUX.lost || gpuLostNow() ? _t('The device interrupted the 3D display during loading ({0}). Restart the game. Economy graphics mode is now on.', (e && e.message) || e)
      : _t('Loading the map failed ({0}). Reload the page or set quality to Low.', (e && e.message) || e);
    $('mlBack').classList.remove('hidden'); $('mlRep').classList.remove('hidden'); $('mlSafe').classList.toggle('hidden', GFX_SAFE || !!Settings.gfxSafe); $('mlBack').focus();
    if (F.online) netLoadFailed();
    return false;
  } finally { MAPL.subs.delete(show); }
  if (UI.flow !== F) return false;
  bar.style.transform = 'scaleX(1)'; msg.textContent = _t('Ready to deploy');
  // map already ready (Replay, preloaded lobby): the screen stays for a moment, long enough to read the map
  const left = 900 - (performance.now() - t0); if (left > 0) await uiWait(left);
  if (F.online) return menuWaitPlayers(F);
  return UI.flow === F;
}
/* Online: the match only starts when all players have loaded the map (or after NET_LOAD_WAIT s) */
async function menuWaitPlayers(F) {
  netLoadReport(true);
  while (UI.flow === F && !netGo()) {
    $('mlMsg').textContent = _t('Waiting for the other players');
    const w = $('mlWait'); w.innerHTML = netWaitHtml(); w.classList.toggle('hidden', !w.innerHTML);
    await uiWait(250);
  }
  $('mlWait').classList.add('hidden');
  return UI.flow === F;
}
/* Loading failure: back to the lobby or the menu */
function menuLoadBack() {
  if (!UI.flow) return;
  UI.flow = null; UI.busy = false;
  uiOpen(netInLobby() ? 'multi' : 'solo', ['main']);
}
function menuCancelFlow() {
  UI.flow = null; UI.busy = false; UI.timer = 0;
  uiGo(UI.stack.pop() || 'main', false); sfxUi('back');
}
function renderDeploy() {
  const c = cls(Settings.loadout);
  $('depGo').textContent = _t('Deploy');
  $('depTimer').innerHTML = UI.timer > 0 ? `${_t('Automatic deployment in')} <b>${Math.ceil(UI.timer)} s</b>` : `${_t('Class:')} <b>${esc(c.name)}</b>`;
}
function menuDeploy() {
  const F = UI.flow; if (!F || UI.screen !== 'deploy' || UI.busy) return;
  UI.flow = null; UI.timer = 0; uiHide(); sfxUi('go');
  enterGameFullscreen(); // within the player's gesture: fullscreen allows resuming without a click (see 09-game.js)
  F.deploy();
}
setInterval(() => {
  if (MATCH.state === 'menu' && UI.screen === 'deploy' && UI.flow && UI.timer > 0) {
    UI.timer -= 0.25; if (UI.timer <= 0) menuDeploy(); else renderDeploy();
  }
  if (MATCH.state === 'paused' && UI.pm === 'class') pmClassRefresh();
  if (MATCH.state === 'paused' && UI.pm === 'home') pmSummaryTick();
}, 250);

/* ---------- Pause menu ---------- */
function pmView(name) {
  UI.pm = name;
  for (const v of ['home', 'class', 'options']) $('pm' + v[0].toUpperCase() + v.slice(1)).classList.toggle('on', v === name);
  if (name === 'class') { PICKERS.forEach(renderPicker); pmClassRefresh(); }
  if (name === 'home') pmSummary();
  if (name === 'options') syncOptions();
}
/* Pause home: the map (its illustration), the mode and the limit, then tiles: score of both sides (my side first, bars toward
   the limit), time remaining, my kills and my deaths, my class; the match continues behind, the numbers follow (pmSummaryTick) */
function pmSummary() {
  const m = mapById(MATCH.online ? NET.cfg.map : Settings.map), ffa = MATCH.mode === 'ffa', art = m.ok && MAP_ART[m.id];
  const lim = MATCH.mode === 'dom' ? _t('{0} · first to {1} points', modeDef().name, `<b>${MATCH.limit}</b>`) : _t('{0} · first to {1}', modeDef().name, `<b>${MATCH.limit}</b>`);
  const side = (k, name, you) => `<div class="ps-t ${k}"><span><span>${name}</span>${you ? ` <em>${_t('You')}</em>` : ''}</span><b data-ps="s${k}"></b><i class="ps-bar"><i data-ps="b${k}"></i></i></div>`;
  const mine = ffa ? 0 : PL.ent.team;
  $('pmSummary').innerHTML = `<div class="ps-map">${art ? `<img class="mapart" alt="" decoding="async" src="${art}">` : ''}<div class="ps-mt"><b>${esc(m.name)}</b><span>${lim}</span><span>${MATCH.online ? _t('Online match') : _t('Solo')}</span></div></div>
    <div class="ps-card ps-score"><p class="lbl">${_t('Score')}</p><div class="ps-teams">${ffa ? side('a', _t('You'), false) + side('b', _t('Top opponent'), false) : side('a', TEAM_NAMES[mine], true) + side('b', TEAM_NAMES[1 - mine], false)}</div>${ffa ? `<p class="ps-rank" data-ps="rank"></p>` : ''}</div>
    <div class="ps-card ps-time"><p class="lbl">${_t('Time left')}</p><b class="ps-big" data-ps="time"></b></div>
    <div class="ps-card ps-me"><p class="lbl">${_t('Your match')}</p><div class="ps-kd"><div><b data-ps="k"></b><span>${_t('Kills')}</span></div><div><b data-ps="d"></b><span>${_t('Deaths')}</span></div><div><b data-ps="sc"></b><span>${_t('Score')}</span></div></div></div>
    <div class="ps-card ps-cls"><p class="lbl">${_t('Class')}</p><b data-ps="cls"></b><span data-ps="next"></span></div>`;
  PMSUM.el = {}; for (const e of $('pmSummary').querySelectorAll('[data-ps]')) PMSUM.el[e.dataset.ps] = e;
  pmSummaryTick();
  $('pmClassHint').textContent = Settings.loadout === PL.classIdx ? cls(PL.classIdx).name : _t('{0}, then {1}', cls(PL.classIdx).name, cls(Settings.loadout).name);
  $('pmSub').textContent = MATCH.online ? _t('The match continues during the pause') : _t('Match paused');
}
const PMSUM = { el: {} };
/* Pause home numbers (four times a second: the match continues); written only if they change */
function pmSummaryTick() {
  const E = PMSUM.el; if (!E.time) return;
  const ffa = MATCH.mode === 'ffa', me = PL.ent, mine = ffa ? 0 : me.team, a = MATCH.score[mine], b = MATCH.score[1 - mine];
  hudText(E.sa, a); hudText(E.sb, b);
  hudStyle(E.ba, 'transform', `scaleX(${clamp(a / MATCH.limit, 0, 1)})`); hudStyle(E.bb, 'transform', `scaleX(${clamp(b / MATCH.limit, 0, 1)})`);
  if (E.rank) hudText(E.rank, _t('You are {0}', ordinal(ffaRank())));
  hudText(E.time, fmtTime(MATCH.timeLeft)); hudText(E.k, me.kills); hudText(E.d, me.deaths); hudText(E.sc, me.score);
  hudText(E.cls, cls(PL.classIdx).name); hudText(E.next, Settings.loadout !== PL.classIdx ? _t('Then {0} on your next respawn', cls(Settings.loadout).name) : '');
}
function pmOpen() { pmView('home'); if (!(TOUCH.on && !PAD.drive)) requestAnimationFrame(() => $('resumeBtn').focus({ preventScroll: true })); } // on touch, no arrival highlight
/* Escape in the pause: goes back to the pause home, then resumes the match */
function pmEscape() { if (UI.pm !== 'home') { pmView('home'); sfxUi('back'); } else resumeGame(); }

/* ---------- Keyboard, mouse, sounds ---------- */
addEventListener('keyup', (e) => {
  if (e.code === 'Escape' && LOCK.escArmed && MATCH.state === 'paused') { LOCK.escArmed = false; e.preventDefault(); pmEscape(); }
});
addEventListener('keydown', (e) => {
  const st = MATCH.state;
  // without mouse capture, Escape doesn't trigger the pause by itself
  // fullscreen with keyboard lock: Escape reaches the page, which releases the capture itself (resume without a click)
  if (st === 'playing' && e.code === 'Escape' && LOCK.kbLock && document.pointerLockElement && !e.repeat) { e.preventDefault(); pauseGame(); LOCK.scriptExit = true; document.exitPointerLock(); return; }
  // (not on a key repeat, nor right after a resume: the same press must not reopen the pause)
  if (st === 'playing' && e.code === 'Escape' && (LOCK.fallback || LOCK.quiet || $('lockPrompt').classList.contains('show'))) { if (!e.repeat && performance.now() - LOCK.resumeT > 600) pauseGame(); return; }
  if (e.code === 'Escape' && e.repeat && (st === 'paused' || st === 'playing')) return;
  if (st !== 'menu' && st !== 'paused') return;
  const a = document.activeElement, typing = a && (a.tagName === 'SELECT' || (a.tagName === 'INPUT' && a.type !== 'checkbox' && a.type !== 'range'));
  if (e.code === 'Escape' && !$('matchload').classList.contains('hidden') && !$('mlBack').classList.contains('hidden')) { e.preventDefault(); $('mlBack').click(); return; } // loading failure: Escape (and B) go back to the menu
  if (e.code === 'Escape') {
    // resuming happens on release: requesting mouse capture during the press lets the browser undo it immediately (Escape)
    if (st === 'paused') { e.preventDefault(); LOCK.escArmed = true; return; }
    if (UI.screen === 'arsenal' && arsEscape()) { e.preventDefault(); return; } // the attachment list closes first
    if (UI.screen === 'deploy') { e.preventDefault(); return; } // class selection at launch: Escape doesn't cancel the match (the Cancel button does)
    if (!UI.busy && uiBack()) e.preventDefault();
    return;
  }
  if (st === 'menu' && UI.screen === 'deploy' && !UI.busy) {
    // Enter with no focused element deploys; on a button ("Cancel", a class), that button acts
    if ((e.code === 'Enter' || e.code === 'NumpadEnter') && !(a && a.matches && a.matches('button, input'))) { e.preventDefault(); menuDeploy(); return; }
    const n = parseInt(e.key, 10), ids = classIds(); if (n >= 1 && n <= ids.length) { pickClass(ids[n - 1]); sfxUi('click'); return; }
  }
  if (typing) return;
  // arrows: the same navigation as the gamepad (09qc-gamepad.js: scope, nearest neighbor in the direction, screen memory);
  // navigating never changes a setting, except a slider, which left and right adjust (the browser handles it)
  const dir = { ArrowDown: [0, 1], ArrowUp: [0, -1], ArrowRight: [1, 0], ArrowLeft: [-1, 0] }[e.code];
  if (!dir || e.defaultPrevented) return;
  if (dir[0] && a && a.type === 'range') return;
  const scope = padScope(); if (!scope) return;
  e.preventDefault(); document.body.classList.add('kbnav');
  padNav(scope, dir[0], dir[1]);
});
// a moving mouse or a touch brings back hover (body.kbnav turns it off during keyboard navigation)
addEventListener('pointermove', (e) => { if (e.isTrusted && (e.movementX || e.movementY)) document.body.classList.remove('kbnav'); }, true);
addEventListener('pointerdown', () => document.body.classList.remove('kbnav'), true);
// sounds: the audio context can only start on a user gesture
/* The audio context is created or restarted on the first gesture; Safari on iPhone only unlocks it at the end of the touch (touchend, click), hence the extra listeners
   and the restart as long as it isn't running */
const uiAudio = () => { if ((!AU.ctx || AU.ctx.state !== 'running') && (MATCH.state === 'menu' || MATCH.state === 'paused')) initAudio(); };
for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) addEventListener(ev, uiAudio, true);
/* A sound on click only, never on hover (owner request). Everything clickable in the menus sounds: buttons, icons (ranking,
   notifications), tabs, cards, ranking rows; when the button plays its own sound (back, tab, confirm), sfxUi keeps only the most
   important of the sounds from the same gesture. The gamepad keeps its little tick on focus movement (09qc-gamepad.js). */
const UI_CLICK = 'button, [role="button"], a[href], [data-go], [data-open], .mbtn, .cls, .lcard, .btn, .back, .link, .ars-card, .hp-opt';
document.addEventListener('click', (e) => {
  const h = e.target.closest && e.target.closest(UI_CLICK); if (h && !h.disabled && (MATCH.state === 'menu' || MATCH.state === 'paused')) sfxUi('click');
});

/* Menu background: visible as long as we're in the menus (the game loop calls it every frame) */
let menuBgOn = false;
function menuBgShow(on) { if (on !== menuBgOn) { menuBgOn = on; $('menuBg').style.display = on ? 'block' : 'none'; document.body.classList.toggle('mbg', on); if (on) mbgShown(); } } // animated background: 09w-background.js

/* ---------- Initialization ---------- */
function menuInit() {
  // navigation by data-go / data-back
  for (const b of $$('[data-go]')) b.addEventListener('click', () => uiGo(b.dataset.go));
  playInit(); // Play screen (09ta-groupe.js)
  for (const b of $$('.back[data-back]')) b.addEventListener('click', () => uiBack());
  $('depBack').addEventListener('click', () => { if (UI.flow && !UI.flow.online) menuCancelFlow(); });
  $('depGo').addEventListener('click', menuDeploy);
  $('mlBack').addEventListener('click', menuLoadBack);
  $('mlRep').addEventListener('click', gpuReport);
  $('mlSafe').addEventListener('click', () => { Settings.gfxSafe = true; Settings.gfxSafeAuto = BUILD; saveSettings(); location.reload(); });
  lmMount($('scr-solo'), { pages: SOLO_PAGES, home: 'solo', col: $('soloList'), stage: $('soloStage'), panel: $('soloPanel'), preview: $('soloPrev'), preview2: $('soloPrev2'), title: $('scr-solo').querySelector('h2'), sub: $('soloSub'), screen: 'solo' });
  $('soloGo').addEventListener('click', () => menuLaunch({ online: false, map: Settings.map, deploy: () => startMatch() }));
  $('fsBtn').addEventListener('click', toggleFullscreen);
  // public source code (MIT license, README "Public source code"): a button rather than a link, so the gamepad can reach it
  $('srcBtn').addEventListener('click', () => window.open('https://github.com/BenDBSS/Riposte-Frontline-Source', '_blank', 'noopener'));
  mountClassPicker($('cpMenu'), 'menu'); mountClassPicker($('cpDeploy'), 'deploy'); mountClassPicker($('cpPause'), 'pause');
  mountOptions($('optMenu')); mountOptions($('optPause'));
  arsInit(); skinScreenInit(); skinRefresh();
  // pause
  $('resumeBtn').addEventListener('click', resumeGame);
  $('quitBtn').addEventListener('click', () => toMenu());
  for (const b of $$('[data-pm]')) b.addEventListener('click', () => pmView(b.dataset.pm));
  $('pmClassOk').addEventListener('click', commitClass);
  // end of match
  $('againBtn').addEventListener('click', () => {
    if (MATCH.online) { toMenu(); return; }
    toMenu('solo'); menuLaunch({ online: false, map: Settings.map, deploy: () => startMatch() });
  });
  $('menuBtn').addEventListener('click', () => toMenu());
  $('perf').classList.toggle('hidden', !Settings.perf);
  newsInit();
  musicInit();
  mbgInit(); // animated menu background (09w-background.js)
  netInit();
  acctInit(); socInit();
}
