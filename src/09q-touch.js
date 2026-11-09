/* ==========================================================================
   TOUCH CONTROLS: playing by finger on a phone or tablet (Android mostly), in the same game as on desktop.
   Active on a touchscreen (coarse pointer, see COARSE in 01-core.js) or on demand (Options, Game, "Touch controls").
   - joystick (Options, Joystick): floating by default, absent from the screen until the left thumb touches the left half: it then appears under the finger, stays there
     as long as the finger slides (it doesn't follow) and disappears on release; or fixed, at the place set in the layout (grabbed near its circle). The analog stick goes from
     slow walking to full speed, and sprinting starts by pushing past the circle (dotted ring: like Call of Duty Mobile or Delta Force). As an
     option in Options (Finger sprint): the "Sprint" button instead (one press: you run as long as you move forward, lifting the joystick finger stops it);
   - the finger that fires (or aims) can also slide to look around, without releasing the button;
   - layout editable by the player (09qb-touch-layout.js): buttons moved, enlarged, removed; saved in the settings (Settings.tcLay);
   - the right thumb slides to look around (right half) and presses the buttons: fire (also on the left; in auto-fire, the default setting,
     there is no fire button: aiming takes its place, 09qd-aim.js), aim (two quick taps on the look zone, default setting, without an
     Aim button; otherwise the button: one press shoulders and
     holds, a long press aims for as long as the finger stays), jump, crouch (while sprinting: slide), reload, switch weapon, grenade (press:
     pull the pin, release: throw), knife, pick up, hold breath (when scoped), killstreaks (when they are ready),
     pause, scoreboard, online chat;
   - the game no longer needs mouse capture: pointerActive() is true (09-game.js), inputs go through the same variables
     as the keyboard and mouse (mouseDX, PL.held, KEYS...), so the player's behavior doesn't change;
   - fullscreen and landscape when a match starts, screen kept on, pause when the page goes to the background.
   See README, "Mobile version".
   ========================================================================== */
const TOUCH = { on: false, mx: 0, mz: 0, sprint: false, lastT: -1e9, lookK: 2.8, R: 51, kx: 1, ky: 1 }; // lookK: one finger pixel is worth lookK mouse pixels (2.3 before 3.0.1, too slow); R: joystick radius in pixels (12.5 u, see touchSize)
const TC = { root: null, el: {}, move: null, look: null, fire: new Set(), ads: null, autoOn: null, dblOn: null, tap: null, show: false, dead: false, wake: null, hint: false, runOn: false, stickRun: false, edit: false, sel: null, drag: null, lay: {} };

/* Limits and original layout of the buttons (09qb-touch-layout.js: declared here because touchInit, at the bottom of this file, uses them at load) */
const TC_MINU = 6, TC_MAXU = 26;
/* Original layout: that of the player who set the buttons on their Pixel (2.23.1); the absent buttons (streaks, pickup, pause, scores, chat, joystick)
   keep their default place from shell.html. The last number of an entry: 1 = removed. */
const TC_DEFAULT_LAY = {
  run: [0.2321, 0.7788, 11, 1], fireL: [0.1016, 0.5981, 13, 1], fire: [0.8033, 0.671, 20, 0], knife: [0.6482, 0.8913, 10, 0], nade: [0.9509, 0.4836, 11, 0],
  breath: [0.3424, 0.8944, 12, 1], ads: [0.8729, 0.5006, 14, 0], crouch: [0.8188, 0.9048, 11, 0], swap: [0.8987, 0.8797, 10, 0], jump: [0.9089, 0.7206, 13, 0], reload: [0.7333, 0.8559, 10.5, 0],
};
/* One "u" unit of the touch HUD: 1% of the screen height, capped like --u in shell.html; the joystick depends on it */
function touchSize() {
  TOUCH.R = 12.5 * clamp(innerHeight / 100, 3.3, 5.6);
  // beyond 560 px tall (tablet, iPad), u caps out: the layout is pulled toward the edges as on a phone 100 u tall and at most 222 u
  // wide (shell.html, .tcb.ov; inverse: touchFrac), otherwise its buttons would drift away from the thumbs as the screen size grows
  TOUCH.ky = innerHeight > 560 ? 560 / innerHeight : 1; TOUCH.kx = TOUCH.ky < 1 ? Math.min(1, 1244 / innerWidth) : 1;
  document.documentElement.style.setProperty('--tkx', TOUCH.kx); document.documentElement.style.setProperty('--tky', TOUCH.ky);
  // "1% of the height" measured on the actually visible window: in a phone browser, 1vh counts the height without the address bar, and everything
  // sized in u (compact menus, touch HUD) would overflow the screen as long as it is there
  document.documentElement.style.setProperty('--vh', innerHeight / 100 + 'px');
}
/* Fraction of the layout whose place falls in px (axis 'x' or 'y'): the inverse of the .tcb.ov calculation in shell.html (transition zone from 0.4 to 0.6 in width,
   from 0.2 to 0.4 in height); the fraction itself on a phone */
function touchFrac(px, ax) {
  const x = ax === 'x', p = px / (x ? innerWidth : innerHeight), k = (x ? TOUCH.kx : TOUCH.ky) || 1, a = x ? 0.4 : 0.2;
  if (p <= k * a) return p / k;
  if (p >= 1 - k * (0.8 - a)) return 1 - (1 - p) / k;
  return (p + 5 * (1 - k) * a) / (k + 5 * (1 - k));
}
/* Touchscreen used as the main pointer? (Options > Touch controls: Automatic, On, Off) */
function touchDetect() {
  const pref = Settings.touch;
  TOUCH.on = pref === 'on' || (pref !== 'off' && COARSE);
  document.body.classList.toggle('touch', TOUCH.on);
  if (TC.root) { touchReset(); if (!TOUCH.on) { TC.show = false; TC.root.classList.add('hidden'); } }
}
/* Releases everything: joystick, look, shots, buttons (pause, end of match, screen change) */
function touchReset() {
  TC.move = null; TC.look = null; TC.fire.clear(); TC.ads = null; TC.qs = null; TC.tap = null; PL.knifeBtn = null;
  TOUCH.mx = TOUCH.mz = 0; TOUCH.sprint = false; TC.runOn = false; TC.stickRun = false;
  KEYS.Space = false; KEYS.ShiftLeft = false;
  if (!TOUCH.on) return;
  PL.held = false; PL.adsWant = false;
  if (TC.root) { TC.el.stick.classList.remove('on'); TC.el.stick.querySelector('b').style.transform = ''; for (const b of TC.root.querySelectorAll('.tcb.on')) b.classList.remove('on'); }
}

/* Buttons: [id, place class, icon, label, type, action(s)]. "hold": press and release; "tap": a single press. */
const TC_ICONS = {
  fire: '<circle cx="12" cy="12" r="5.5"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  aim: '<circle cx="12" cy="12" r="8.5"/><path d="M12 5v4M12 15v4M5 12h4M15 12h4"/>',
  jump: '<path d="M6 11l6-6 6 6M6 18l6-6 6 6"/>',
  crouch: '<path d="M6 6l6 6 6-6M6 13l6 6 6-6"/>',
  reload: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4.5h-4.5"/>',
  swap: '<path d="M6 8h12l-3-3.2M18 16H6l3 3.2"/>',
  nade: '<circle cx="12" cy="14.5" r="6"/><path d="M9.5 8.5V4.5h4.5l1.5 2.5"/>',
  knife: '<path d="M20 4c-.6 5-4 9-9 10l-1-1c1-5 5-8.4 10-9z"/><path d="M8.2 12.2l3.6 3.6M10.5 14.5L5 20"/>',
  pick: '<path d="M12 3.5v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
  pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
  board: '<path d="M5 7h14M5 12h14M5 17h9"/>',
  chat: '<path d="M4.5 5.5h15v10h-8l-4.5 4v-4h-2.5z"/>',
  run: '<path d="M13 3.5L6.5 13.5H12l-1 7 6.5-10H12z"/>',
  breath: '<path d="M4 12c2-4 4-4 6 0s4 4 6 0 3-3 4-1.5"/>',
  boom: '<path d="M12 3l1.8 5 5-2-2.6 4.6 4.8 2.2-5.2 1 1 5.2-4.8-3-4.8 3 1-5.2-5.2-1 4.8-2.2L5.2 6l5 2z"/>',
  // streaks (the same as the desktop HUD's, KSDEF catalog): the slot buttons take the icon of the class's streak (touchKsIcons)
  ...Object.fromEntries(KS_IDS.map((k) => [k, KSDEF[k].icon])),
};
const TC_BTNS = [
  ['fire', 'tc-fire', 'fire', _t('Shoot'), 'hold', (d) => touchFire(d, 'r')],
  ['fireL', 'tc-fire-l l', 'fire', _t('Shoot'), 'hold', (d) => touchFire(d, 'l')],
  ['ads', 'tc-ads', 'aim', _t('Aim'), 'ads'],
  ['jump', 'tc-jump', 'jump', _t('Jump'), 'hold', (d) => { KEYS.Space = d; }],
  ['run', 'tc-run l', 'run', _t('Run'), 'tap', () => { TC.runOn = !TC.runOn; touchSprint(); }],
  ['crouch', 'tc-crouch', 'crouch', _t('Crouch'), 'tap', () => { if (!trySlide()) PL.crouchToggle = !PL.crouchToggle; }],
  ['reload', 'tc-reload', 'reload', _t('Reload'), 'tap', () => startReload()],
  ['swap', 'tc-swap', 'swap', _t('Switch weapon'), 'tap', () => quickSwap()],
  ['nade', 'tc-nade', 'nade', _t('Grenade'), 'hold', (d) => { if (d) cookNade(); else releaseNade(); }],
  ['knife', 'tc-knife', 'knife', _t('Knife'), 'hold', (d) => knifeButton(d)], // short press: one strike; held: knife in hand (08-player.js)
  ['pick', 'tc-pick', 'pick', _t('Pick up'), 'tap', () => { if (!mechaUse()) swapWithDrop(); }], // within reach of their mecha, or aboard: get in, get out (08g-mecha-pilote.js)
  ['breath', 'tc-breath', 'breath', _t('Hold your breath'), 'hold', (d) => { KEYS.ShiftLeft = d; }],
  ['ks1', 'tc-ks tc-ks0', 'uav', _t('First killstreak'), 'tap', () => useKs(0)],
  ['ks2', 'tc-ks tc-ks1', 'air', _t('Second killstreak'), 'tap', () => useKs(1)],
  ['ks3', 'tc-ks tc-ks2', 'heli', _t('Third killstreak'), 'tap', () => useKs(2)],
  ['boom', 'tc-boom', 'boom', _t('Detonate'), 'tap', () => { PL.queued = true; }], // kamikaze drone in flight (08e-fpv.js)
  ['pause', 'tc-pause', 'pause', _t('Pause'), 'tap', () => pauseGame()],
  ['board', 'tc-board', 'board', _t('Scoreboard'), 'tap', () => showScoreboard(!HUD.board)],
  ['chat', 'tc-chat', 'chat', _t('Chat'), 'tap', () => chatOpen()],
];
/* Action buttons that make you leave aiming (reload, switch weapon, pick up, knife, streaks): at the end of the reload, you don't go back to
   aiming without having wanted to */
const TC_UNAIM = new Set(['reload', 'swap', 'pick', 'knife', 'ks1', 'ks2', 'ks3']);
function touchUnaim() {
  PL.adsWant = false; TC.ads = null; // Aim button held: its release restores nothing
  if (TC.qs) TC.qs.was = false; // sniper rifle fire-on-release in progress: the earlier aim doesn't come back
}
function touchFire(down, side) {
  // sniper rifle, fire on release (option, like Call of Duty Mobile): pressing aims, sliding aims, releasing fires, then the earlier aim returns
  const w = PL.ent.alive ? curW() : null;
  if (Settings.tcQuick !== false && ((down && w && w.def.scope) || (!down && TC.qs))) {
    if (down) { if (!TC.qs) TC.qs = { was: PL.adsWant }; TC.fire.add(side); PL.adsWant = true; return; }
    TC.fire.delete(side); if (TC.fire.size) return;
    if (VM.ads > 0.6 && performance.now() >= PL.noFireT) PL.queued = true;
    PL.adsWant = TC.qs.was; TC.qs = null; return;
  }
  if (down) TC.fire.add(side); else TC.fire.delete(side);
  const on = TC.fire.size > 0;
  if (on && !PL.held) PL.queued = true;
  PL.held = on;
}
/* Double tap to aim (Settings.tcDblAds, default; the Aim button is then hidden): two quick taps at the same spot of the look zone shoulder,
   two more put the weapon away. The second counts as soon as it lands; a tap that slides or lasts doesn't count (it's a look). Delays on the event
   timestamps (ms) */
const TC_TAP = { dur: 260, move: 14, gap: 330, dist: 80 };
function touchTapDown(e) {
  const T = TC.tap; TC.look.dbl = false;
  if (!Settings.tcDblAds || !T || e.timeStamp - T.t > TC_TAP.gap || hyp(e.clientX - T.x, e.clientY - T.y) > TC_TAP.dist) return;
  TC.tap = null; TC.look.dbl = true;
  if (PL.ent.alive && MATCH.state === 'playing') { PL.adsWant = !PL.adsWant; touchBuzz(6); }
}
function touchTapUp(e) {
  const L = TC.look; if (!Settings.tcDblAds || L.dbl) return;
  const short = e.timeStamp - L.t0 < TC_TAP.dur && hyp(e.clientX - L.x0, e.clientY - L.y0) < TC_TAP.move;
  TC.tap = short ? { t: e.timeStamp, x: e.clientX, y: e.clientY } : null;
}
/* Aim (button): a short press shoulders (another puts it away), a long press aims for as long as the finger stays down */
function touchAds(down, ts) {
  if (down) { TC.ads = { was: PL.adsWant, t: ts }; PL.adsWant = true; return; }
  const a = TC.ads; TC.ads = null; if (!a) return;
  if (ts - a.t > 350 || a.was) PL.adsWant = false; // long: released; short on an aim already held: put away (duration measured on the event timestamps)
}

/* Pickup button: the mecha icon when it serves to get aboard or get out */
function touchPickIcon(mk) {
  const b = TC.el.pick; if (b.dataset.mk === String(mk)) return;
  b.dataset.mk = String(mk); b.setAttribute('aria-label', mk ? (MECHA_P.me ? _t('Leave the mecha') : _t('Board the mecha')) : _t('Pick up'));
  b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${mk ? KSDEF.mecha.icon : TC_ICONS.pick}</svg>`;
}
/* Streak slot buttons: icon and name of the class's streak (updateStreakHud); Grenade button: the class's */
function touchKsIcons() {
  if (!TC.root) return;
  PL.ksSel.forEach((k, i) => {
    const b = TC.el['ks' + (i + 1)]; if (b.dataset.ks === k) return;
    b.dataset.ks = k; b.setAttribute('aria-label', KSDEF[k].name); b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${KSDEF[k].icon}</svg>`;
  });
  // Grenade button: the class's type (NADE_TYPES)
  const g = TC.el.nade, N = NADE_TYPES[PL.nadeType]; if (!g || !N || g.dataset.ty === PL.nadeType) return;
  g.dataset.ty = PL.nadeType; g.setAttribute('aria-label', N.long); g.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${N.icon}</svg>`;
}
function touchBuild() {
  const root = document.createElement('div'); root.id = 'touch'; root.className = 'hidden'; TC.root = root;
  const stick = document.createElement('div'); stick.id = 'tcStick'; stick.innerHTML = '<i></i><b></b><u></u>'; root.appendChild(stick); TC.el.stick = stick; // circle, button that follows the finger, sprint ring
  for (const [id, pos, icon, label, kind, act] of TC_BTNS) {
    const b = document.createElement('div'); b.className = 'tcb ' + pos; b.dataset.tc = id; b.setAttribute('role', 'button'); b.setAttribute('aria-label', label);
    // icon only (streaks included: their name is no longer written, it stays in aria-label); text for a button without an icon
    b.innerHTML = icon ? `<svg viewBox="0 0 24 24" aria-hidden="true">${TC_ICONS[icon]}</svg>` : `<span>${esc(label)}</span>`;
    TC.el[id] = b; root.appendChild(b);
    const look = id === 'fire' || id === 'fireL' || id === 'ads';
    const press = (d, ts) => { b.classList.toggle('on', d); if (d && TC_UNAIM.has(id)) touchUnaim(); if (kind === 'ads') touchAds(d, ts); else if (kind === 'hold') act(d); else if (d) act(); };
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (TC.edit) { touchEditDown(id, e); return; } TOUCH.lastT = performance.now(); b.setPointerCapture(e.pointerId); if (look) b._lk = { id: e.pointerId, x: e.clientX, y: e.clientY }; if (kind === 'tap') b.classList.add('on'); press(true, e.timeStamp); if (kind === 'tap') setTimeout(() => b.classList.remove('on'), 130); });
    // fire and aim: the finger resting on the button also turns the view when it slides (without it the view stayed frozen while firing)
    b.addEventListener('pointermove', (e) => {
      if (TC.edit) { touchEditMove(e); return; }
      const L = b._lk; if (!L || e.pointerId !== L.id) return;
      TOUCH.lastT = performance.now(); mouseDX += (e.clientX - L.x) * TOUCH.lookK; mouseDY += (e.clientY - L.y) * TOUCH.lookK; L.x = e.clientX; L.y = e.clientY;
    });
    const up = (e) => { b._lk = null; if (TC.edit) { touchEditUp(e); return; } if (kind === 'tap') return; TOUCH.lastT = performance.now(); press(false, e.timeStamp); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', (e) => { if (TC.edit) touchEditUp(e); else if (b.classList.contains('on') && kind !== 'tap') up(e); });
  }
  const help = document.createElement('div'); help.id = 'tcHelp'; help.className = 'hidden';
  help.innerHTML = `<div><b>${esc(_t('Joystick on the left'))}</b> ${esc(_t('to move. Pushed past the circle, it sprints.'))}</div><div><b>${esc(_t('Drag on the right'))}</b> ${esc(_t('to look around.'))}</div><div class="tch-b"></div><p>${esc(_t('Tap to start'))}</p>`;
  root.appendChild(help); TC.el.help = help;
  help.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); help.classList.add('hidden'); try { localStorage.setItem('dc_touch_help', '1'); } catch (er) { /* ignored */ } });
  // zones: fixed joystick (grabbed near its circle), look everywhere else; dead or killcam: a tap skips the wait
  root.addEventListener('pointerdown', (e) => {
    e.preventDefault(); TOUCH.lastT = performance.now();
    if (TC.edit) return;
    if (TC.dead) { kcSkip(); return; }
    if (KS.map.open || CHAT.open) return;
    const fixed = Settings.tcStick === 'fixed', G = touchStickGeom();
    // fixed: grabbed near its circle; floating: the whole left half, the circle lands under the finger and no longer moves
    const near = fixed ? hyp(e.clientX - G.cx, e.clientY - G.cy) <= G.R * 2 : e.clientX < innerWidth * 0.46;
    if (near && !TC.move) {
      if (!fixed) { G.cx = e.clientX; G.cy = e.clientY; TC.el.stick.style.setProperty('--fx', touchFrac(e.clientX, 'x')); TC.el.stick.style.setProperty('--fy', touchFrac(e.clientY, 'y')); }
      TC.move = { id: e.pointerId, g: G }; root.setPointerCapture(e.pointerId); TC.el.stick.classList.add('on'); touchStick(e);
    } else if (!near && !TC.look) { TC.look = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: e.timeStamp }; root.setPointerCapture(e.pointerId); touchTapDown(e); }
  });
  root.addEventListener('pointermove', (e) => {
    TOUCH.lastT = performance.now();
    if (TC.move && e.pointerId === TC.move.id) touchStick(e);
    else if (TC.look && e.pointerId === TC.look.id) {
      const k = TOUCH.lookK; mouseDX += (e.clientX - TC.look.x) * k; mouseDY += (e.clientY - TC.look.y) * k; TC.look.x = e.clientX; TC.look.y = e.clientY;
    }
  });
  const end = (e) => {
    if (TC.move && e.pointerId === TC.move.id) { TC.move = null; TOUCH.mx = TOUCH.mz = 0; TC.runOn = false; TC.stickRun = false; touchSprint(); TC.el.stick.classList.remove('on'); TC.el.stick.classList.remove('run'); TC.el.stick.querySelector('b').style.transform = ''; touchLayoutOne('stick'); }
    if (TC.look && e.pointerId === TC.look.id) { touchTapUp(e); TC.look = null; }
  };
  root.addEventListener('pointerup', end); root.addEventListener('pointercancel', end);
  touchLayoutMigrate(); touchEditBuild(root); touchLayoutApply();
  document.body.appendChild(root); touchAlpha();
}
/* Sprint: the "Sprint" button (latch: you run as long as the joystick moves forward) or, depending on the option, the joystick pushed all the way */
function touchSprint() {
  const run = TC.stickRun || (TC.runOn && !!TC.move && TOUCH.mz > 0.2);
  TOUCH.sprint = run; if (TC.el.stick) TC.el.stick.classList.toggle('run', run);
}
/* Joystick circle on screen (center and radius in pixels): its place comes from the layout (09qb-touch-layout.js) */
function touchStickGeom() {
  const r = TC.el.stick.firstChild.getBoundingClientRect();
  return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, R: Math.max(20, r.width / 2) };
}
/* Fixed, analog joystick: m is the finger's offset from the center in circle radii. Proportional walking up to the edge (full pace at 0.9), then sprinting
   starts by pushing the finger past the circle forward (dotted ring, 1.15) and lasts as long as it stays near the edge (0.95): the more you push, the
   faster you go, up to sprinting, as in Call of Duty Mobile. */
const TC_SPRINT_ON = 1.15, TC_SPRINT_OFF = 0.95;
function touchStick(e) {
  const G = TC.move.g, dx = e.clientX - G.cx, dy = e.clientY - G.cy, len = hyp(dx, dy), m = len / G.R;
  const dead = 0.14, v = m < dead ? 0 : Math.min(1, (m - dead) / (0.9 - dead)), fwd = len ? -dy / len : 0;
  TOUCH.mx = len ? (dx / len) * v : 0; TOUCH.mz = len ? (-dy / len) * v : 0;
  TC.stickRun = Settings.tcRun === 'stick' && (TC.stickRun ? m > TC_SPRINT_OFF && fwd > 0.35 : m > TC_SPRINT_ON && fwd > 0.55);
  touchSprint();
  const k = len > G.R ? G.R / len : 1; TC.el.stick.querySelector('b').style.transform = `translate(${dx * k}px, ${dy * k}px)`;
}

/* Every frame: controls visible in a match, contextual buttons (streaks ready, weapon on the ground, scope, chat). During the result
   announcement ('finish'), nothing: the controls no longer serve there, the HUD fades out (#hud.finish), and so do the buttons (owner's feedback:
   they stayed displayed behind "Victory" or "Defeat"). During a killcam, the layer stays, without its buttons or joystick
   ("dead" mode): a tap skips the replay */
function touchTick() {
  touchModeSync();
  if (TC.edit) return; // layout being edited: nothing hides or shows on its own
  const st = MATCH.state, playing = st === 'playing', dead = st === 'killcam' || (playing && !PL.ent.alive);
  const show = playing || st === 'killcam';
  if (show !== TC.show) {
    TC.show = show; TC.root.classList.toggle('hidden', !show);
    if (show) { touchWake(); if (!TC.hint) { TC.hint = true; let seen = false; try { seen = !!localStorage.getItem('dc_touch_help'); } catch (e) { /* ignored */ } if (!seen) touchHelpShow(); } }
    else touchReset();
  }
  if (!show) return;
  if (dead !== TC.dead) { TC.dead = dead; TC.root.classList.toggle('dead', dead); if (dead) touchReset(); }
  const map = KS.map.open || CHAT.open; TC.root.classList.toggle('map', map); TC.root.classList.toggle('fpv', !!PILOT.d); TC.root.classList.toggle('mecha', !!MECHA_P.me);
  const vis = (id, on) => TC.el[id].classList.toggle('gone', !on);
  touchKsIcons(); PL.ksSel.forEach((k, i) => vis('ks' + (i + 1), !!PL.ks[k]));
  const mk = !!MECHA_P.me || !!mechaNear(); vis('pick', !!DROP.cur || mk); touchPickIcon(mk); vis('run', Settings.tcRun !== 'stick'); TC.el.run.classList.toggle('lit', TC.runOn); TC.root.classList.toggle('runbtn', Settings.tcRun === 'button'); TC.root.classList.toggle('float', Settings.tcStick !== 'fixed');
  const w = PL.ent.alive ? curW() : null; vis('breath', !!(w && w.def.scope && VM.ads > 0.6));
  vis('chat', MATCH.online && !!NET.on); vis('nade', PL.nades > 0 || !!PL.nadeState);
  TC.el.ads.classList.toggle('lit', !!PL.adsWant);
}
/* First-launch help: the buttons depend on auto-fire (no fire button) */
function touchHelpShow() {
  const a = Settings.tcAuto, d = Settings.tcDblAds;
  TC.el.help.querySelector('.tch-b').textContent = a && d ? _t('You fire on your own when the crosshair is on an enemy. Double-tap the screen to aim. Buttons: jump, crouch (slide while sprinting), reload, grenade, knife.')
    : a ? _t('You fire on your own when the crosshair is on an enemy. Buttons: aim, jump, crouch (slide while sprinting), reload, grenade, knife.')
    : d ? _t('Double-tap the screen to aim. Buttons: shoot, jump, crouch (slide while sprinting), reload, grenade, knife.')
    : _t('Buttons: shoot, aim, jump, crouch (slide while sprinting), reload, grenade, knife.');
  TC.el.help.classList.remove('hidden');
}
/* Screen kept on during the match (if the browser allows it) */
async function touchWake() {
  try { if (navigator.wakeLock && !TC.wake) { TC.wake = await navigator.wakeLock.request('screen'); TC.wake.addEventListener('release', () => { TC.wake = null; }); } } catch (e) { /* denied: no consequence */ }
}
/* Fullscreen and landscape when a match starts (the gesture is the tap on "Deploy"). Also in the installed app: Android already opens it fullscreen
   (manifest), but Chrome leaves a black band there along the camera in landscape, because it only applies viewport-fit=cover (the image under the notch) to an HTML
   fullscreen page (requestFullscreen). Without the API (iPhone), nothing. */
function touchFullscreen() {
  if (!TOUCH.on) return;
  gpuLog('fullscreen + landscape requested');
  if (!document.fullscreenElement && document.documentElement.requestFullscreen) { try { LOCK.fsPending = document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {}); } catch (e) { /* ignored */ } }
  try { const o = screen.orientation; if (o && o.lock) o.lock('landscape').catch(() => {}); } catch (e) { /* ignored */ }
}

/* Browser gestures that have no business in the game, especially on iPhone and iPad: text selection, the "Copy" menu and magnifier on long press,
   zoom on double tap or two fingers (Safari ignores user-scalable=no). CSS does most of it (shell.html: -webkit-user-select, -webkit-touch-callout,
   touch-action: manipulation); here, what Safari only listens to through its own events (gesturestart, touch scale). Input fields, the recovery
   code and the graphics report stay selectable. */
function touchNoBrowserGestures() {
  const free = (t) => { const el = t && t.nodeType === 3 ? t.parentElement : t; return !!(el && el.closest && el.closest('input, textarea, select, [contenteditable], .ac-code, #grTxt')); };
  document.addEventListener('selectstart', (e) => { if (!free(e.target)) e.preventDefault(); });
  if (!('ongesturestart' in window)) return; // Safari only
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', (e) => { if (e.scale !== undefined && e.scale !== 1) e.preventDefault(); }, { passive: false });
}
function touchInit() {
  touchDetect(); touchSize(); addEventListener('resize', touchSize);
  touchNoBrowserGestures();
  // a touch anywhere (interface button, strike map): the mouse the browser then simulates (mousemove, mousedown, click) doesn't count. Without this,
  // touching a button next to the strike map sent the aimed point racing to the map's edge then confirmed the strike (TOUCH.lastT guards in 08-player.js and 09-game.js)
  for (const ev of ['pointerdown', 'pointerup']) addEventListener(ev, (e) => { if (e.pointerType === 'touch') TOUCH.lastT = performance.now(); }, true);
  touchBuild();
  if (TOUCH.on && !localStorageHas('dc_settings')) { Settings.fsGame = true; saveSettings(); } // first visit on a phone: fullscreen by default
  // airstrike map: the finger places the zone, it can be dragged, and the strike goes where the finger lifts (lifted off the map: nothing goes,
  // can resume); a button cancels
  const tac = $('tacCanvas'), place = (e) => {
    if (!TOUCH.on || !KS.map.open) return; const r = tac.getBoundingClientRect(); if (!r.width) return;
    KS.map.x = clamp(MAP.x0 + ((e.clientX - r.left) / r.width) * (MAP.x1 - MAP.x0), MAP.x0 + 1, MAP.x1 - 1);
    KS.map.z = clamp(MAP.z0 + ((e.clientY - r.top) / r.height) * (MAP.z1 - MAP.z0), MAP.z0 + 1, MAP.z1 - 1);
  };
  tac.addEventListener('pointerdown', (e) => { TOUCH.lastT = performance.now(); place(e); tac.setPointerCapture(e.pointerId); }); tac.addEventListener('pointermove', (e) => { if (e.buttons || e.pressure) place(e); });
  tac.addEventListener('pointerup', (e) => {
    if (!TOUCH.on || !KS.map.open) return; const r = tac.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    place(e); ksConfirm();
  });
  $('tcMapNo').addEventListener('click', () => ksCancel());
  // fullscreen from the first touch in the game, installed or not: in landscape, Chrome otherwise leaves a black band next to the screen notch, on the
  // menus as on loading (see touchFullscreen). Not during the install window (its button needs the gesture).
  const firstTap = () => { if (PWA.gate) return; removeEventListener('pointerup', firstTap, true); if (TOUCH.on && MATCH.state !== 'playing') touchFullscreen(); };
  addEventListener('pointerup', firstTap, true);
  // the page goes to the background or the screen goes to portrait: pause
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (TOUCH.on && MATCH.state === 'playing') pauseGame(); } else if (TC.show) touchWake(); });
  addEventListener('orientationchange', () => { if (TOUCH.on && MATCH.state === 'playing') pauseGame(); });
}
const localStorageHas = (k) => { try { return localStorage.getItem(k) !== null; } catch (e) { return false; } };
touchInit();
