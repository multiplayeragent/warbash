/* ==========================================================================
   GAMEPAD: playing with a controller (Xbox, PlayStation, 8BitDo, Switch Pro...), in the same game as on keyboard and mouse.
   "Standard Gamepad" standard of the Gamepad API (recent browsers): any controller that presents itself as one works, with no driver or setup. Buttons are named
   as on an Xbox controller (A bottom, B right, X left, Y top; LB/RB, LT/RT; L3/R3: stick press); other controllers have the same layout
   by position (Cross, Circle, Square, Triangle; L1/R1, L2/R2; an 8BitDo in Xbox or Switch mode).
   Call of Duty scheme (default layout):
   - left stick: move (analog: slow walk to full speed); L3: sprint (one press, until the stick stops or the first shot); when scoped, L3 holds breath;
   - right stick: look (small dead zone, responsive curve, acceleration at full tilt, slower when aiming); R3: knife;
   - RT: fire; LT: aim (held); RB: grenade (held: cook, released: throw);
   - A: jump; B: crouch (while sprinting: slide); X: reload (short press) or pick up the weapon on the ground (held); Y: switch weapon;
   - D-pad: up UAV, right airstrike, down helicopter, left inspect the weapon; Back: scoreboard; Menu (Start): pause.
   Other layouts (Options, Game, "Gamepad layout"): Southpaw (sticks swapped), Bumper jumper (jump on LB, crouch on A).
   In the menus: D-pad or left stick to navigate (left and right adjust a slider or a list), A confirms, B goes back, LB and RB switch tabs.
   Inputs go through the same variables as the keyboard and mouse (PL.held, PL.adsWant, KEYS, action functions): the player's behavior doesn't change;
   only analog look and movement have their own reading (PAD.lx/ly, PAD.mx/mz), added to the keyboard's in updatePlayer (08-player.js).
   The browser only hands over the controller on the first button press (gamepadconnected event). A controller is not a user gesture: neither mouse
   capture nor fullscreen nor sound can depend on it; pointerActive() is therefore true as long as the controller is in charge (PAD.drive), until a click or a key.
   See README, "Gamepad".
   ========================================================================== */
const PAD = {
  seen: false, id: '', drive: false, // seen: a controller has shown up; drive: it is the one playing (until the next click or key)
  mx: 0, mz: 0, lx: 0, ly: 0, // movement and look, from -1 to 1 (after dead zone and curve)
  sprint: false, l3: false, jumpOn: false, ramp: 0, fireOn: false, adsOn: false, mapOn: false, prev: [], navKey: '', navT: 0, rumT: 0, rumS: 0, rumW: 0, rumEnd: 0, xT: 0, useT: -1,
};
/* Layouts: button number (Standard Gamepad standard) to action. The sticks, RT and LT are not buttons to be reassigned. */
const PAD_LAYOUTS = {
  default: { 0: 'jump', 1: 'crouch', 2: 'reload', 3: 'swap', 5: 'nade', 10: 'sprint', 11: 'knife', 12: 'ks1', 13: 'ks3', 14: 'inspect', 15: 'ks2' },
  southpaw: { 0: 'jump', 1: 'crouch', 2: 'reload', 3: 'swap', 5: 'nade', 10: 'knife', 11: 'sprint', 12: 'ks1', 13: 'ks3', 14: 'inspect', 15: 'ks2' },
  bumper: { 0: 'crouch', 2: 'reload', 3: 'swap', 4: 'jump', 5: 'nade', 10: 'sprint', 11: 'knife', 12: 'ks1', 13: 'ks3', 14: 'inspect', 15: 'ks2' },
};
const PAD_KEYS = new Set(['padSens', 'padAdsMul', 'padDead', 'padCurve', 'padAccel', 'padRun', 'padLay', 'padVib']); // settings shown in Options once a controller is detected
/* Look stick response: the deflection v (0 to 1, after the dead zone) gives the share of the maximum speed. Responsive (default): a linear share so
   that looking starts as soon as the stick leaves the dead zone, then a rise that curves up to stay precise at the center and quick at full tilt; Progressive: the old
   curve, gentler at the start; Linear: speed follows the deflection. At 10% dead zone and sensitivity 1 (195 degrees per second at full tilt): stick at 25%,
   16 degrees per second (5 before), at 50%, 56 (46), at 75%, 121 (115). */
const PAD_CURVES = {
  reactive: (v) => 0.4 * v + 0.6 * Math.pow(v, 2.4),
  classic: (v) => Math.pow(v, 1.7),
  linear: (v) => v,
};
const PAD_MOVE = (v) => Math.pow(v, 1.15); // the movement stick: almost linear
/* Look acceleration: with the stick pushed to the edge, speed rises by (1 + gain) times over PAD_RAMP s, and drops back in 0.1 s as soon as it returns toward the center. The gain is
   halved when aiming. A full turn at full tilt takes 0.92 s without acceleration, 0.67 s on "Normal", 0.56 s on "Strong" (0.75 s with the old ramp). */
const PAD_ACCEL = { off: 0, normal: 0.5, strong: 0.9 };
const PAD_RAMP = 0.3;
const PAD_HOLD = 0.3; // seconds of X held to pick up a weapon on the ground (a shorter press reloads)
const PAD_TRIG = { on: 0.25, off: 0.15 }; // triggers: press and release thresholds (LT, RT), low enough to fire at the very start of the travel
const PAD_HELP = [
  [_t('Left stick'), _t('Move (analog). L3 (press the stick) to sprint, in a scope to hold your breath')], [_t('Right stick'), _t('Look around. R3 (press the stick) for the knife, hold it to keep the knife in hand')],
  ['RT / LT', _t('Fire / aim (hold)')], ['RB', _t('Grenade (hold to keep it in hand)')],
  ['A', _t('Jump')], ['B', _t('Crouch (slide while sprinting)')], ['X', _t('Reload, hold to pick up the weapon on the ground')], ['Y', _t('Switch weapon')],
  [_t('D-pad'), _t('Up: UAV, right: airstrike, down: helicopter, left: inspect weapon')],
  [_t('Back'), _t('Scoreboard')], ['Menu', _t('Pause')], [_t('In menus'), _t('D-pad or left stick to navigate, A to confirm, B to go back, LB and RB to switch tabs')],
];
const padClamp = (v) => (v < -1 ? -1 : v > 1 ? 1 : v);
/* A usable controller: preferably with the standard mapping; failing that, a controller that has at least both sticks and the face buttons */
function padPick() {
  let best = null;
  for (const g of (navigator.getGamepads ? navigator.getGamepads() : [])) {
    if (!g || !g.connected || g.axes.length < 4 || g.buttons.length < 10) continue;
    if (g.mapping === 'standard') return g;
    if (!best) best = g;
  }
  return best;
}
/* Stick with a radial dead zone (the circle, not squares: no lost diagonal), full at 95% of travel (a stick that doesn't quite reach the edge
   still arrives at full) and response curve f (PAD_CURVES); returns the vector and the deflection v after the dead zone */
function padStick(x, y, dead, f) {
  const m = hyp(x, y); if (m <= dead) return [0, 0, 0];
  const v = Math.min(1, (m - dead) / (0.95 - dead)), k = f(v) / m;
  return [x * k, y * k, v];
}
const padDown = (g, i) => { const b = g.buttons[i]; return !!b && (b.pressed || b.value > 0.5); };
/* Mapping: a press on a button already held at the screen change (A of "Deploy") does nothing: we only react to the transition from released to pressed */
function padEdge(g, i) { const now = padDown(g, i), was = !!PAD.prev[i]; return now && !was ? 1 : !now && was ? -1 : 0; }
function padRumble(strong, weak, ms, force) { // strong: feedback that goes through even during the rumble of a shot (hit, elimination, pickup) and adds to it
  if (!Settings.padVib || !PAD.seen || !PAD.drive) return;
  const t = performance.now(), live = t < PAD.rumEnd; if (t < PAD.rumT && !force) return;
  if (live) { strong = Math.max(strong, PAD.rumS); weak = Math.max(weak, PAD.rumW); ms = Math.max(ms, PAD.rumEnd - t); } // the stronger of the two, without losing any of the shot in progress
  PAD.rumT = t + ms * 0.8; PAD.rumS = strong; PAD.rumW = weak; PAD.rumEnd = t + ms;
  const g = padPick(), a = g && g.vibrationActuator; if (!a || !a.playEffect) return;
  try { a.playEffect('dual-rumble', { startDelay: 0, duration: ms, strongMagnitude: clamp(strong, 0, 1), weakMagnitude: clamp(weak, 0, 1) }).catch(() => {}); } catch (e) { /* gamepad without vibration */ }
}

/* An action of the chosen layout: press (down true) or release */
function padAction(act, down) {
  if (MECHA_P.me && act !== 'reload') { if (act === 'jump') KEYS.Space = PAD.jumpOn = down; return; } // aboard the mecha: sticks, triggers, A to jump, X held to get out
  if (PILOT.d && act !== 'jump' && act !== 'sprint' && act !== 'crouch') return; // drone in flight: climb, push, descend (crouch, below)
  if (PILOT.d) { if (act === 'crouch') KEYS.ControlLeft = down; else if (act === 'jump') KEYS.Space = PAD.jumpOn = down; else { PAD.l3 = down; if (down) PAD.sprint = !PAD.sprint; } return; }
  if (act === 'jump') { KEYS.Space = PAD.jumpOn = down; return; }
  if (act === 'nade') { if (down) cookNade(); else releaseNade(); return; }
  if (act === 'knife') { knifeButton(down); return; } // short press: one strike; held: knife in hand (08-player.js)
  if (act === 'sprint') {
    PAD.l3 = down; // scoped, held: hold your breath (PL.holding, 08-player.js)
    if (down && !PL.adsWant) PAD.sprint = !PAD.sprint && PAD.mz > 0.2;
    return;
  }
  if (act === 'reload') { padReloadUse(down); return; }
  if (!down) return;
  if (act === 'crouch') { if (!trySlide()) PL.crouchToggle = !PL.crouchToggle; }
  else if (act === 'swap') quickSwap();
  else if (act === 'ks1') useKs(0);
  else if (act === 'ks2') useKs(1);
  else if (act === 'ks3') useKs(2);
  else if (act === 'inspect') inspectWeapon();
}

/* X: reload (short press) or pick up the weapon on the ground within reach (held PAD_HOLD s), as in the Call of Duty games. With no weapon in reach, the reload starts
   on press, with no wait; with a weapon in reach, we wait to find out: released before PAD_HOLD, it reloads, held to the end, it swaps (padUseTick) */
function padReloadUse(down) {
  if (down) { if (DROP.cur || MECHA_P.me || mechaNear()) PAD.useT = 0; else startReload(); return; }
  if (PAD.useT >= 0 && PAD.useT < PAD_HOLD) startReload();
  PAD.useT = -1;
}
function padUseTick(dt) {
  if (PAD.useT < 0 || PAD.useT >= PAD_HOLD) return; // no press pending, or pickup already done (the release won't reload)
  PAD.useT += dt;
  if (PAD.useT < PAD_HOLD) return;
  PAD.useT = PAD_HOLD + 1;
  if (mechaUse()) padRumble(0.7, 0.5, 140, true); // get into your mecha, or out of it
  else if (DROP.cur) { swapWithDrop(); padRumble(0.55, 0.35, 80, true); } else startReload(); // the weapon vanished or moved away during the press: reload
}

/* Airstrike map: both sticks move the aimed point (their vectors add up, the sum is capped at 1), whatever the layout.
   Precise at small deflection (7 m/s at 25%), quick at full tilt (85 m/s: the width of the map in one second); before, 43 m/s at full tilt and 13 m/s at half. */
const PAD_MAP_SPEED = 85;
const padMapCurve = (v) => 0.12 * v + 0.88 * v * v;
function padMapMove(g, dt) {
  const a = padStick(g.axes[0], g.axes[1], Settings.padDead, padMapCurve), b = padStick(g.axes[2], g.axes[3], Settings.padDead, padMapCurve);
  let x = a[0] + b[0], y = a[1] + b[1]; const m = hyp(x, y); if (m > 1) { x /= m; y /= m; }
  ksMapMove(x * PAD_MAP_SPEED * dt, y * PAD_MAP_SPEED * dt);
}

/* In a match: reading the sticks and triggers, button actions */
function padPlay(g, dt) {
  const south = Settings.padLay === 'southpaw', dead = Settings.padDead;
  const L = padStick(g.axes[south ? 2 : 0], g.axes[south ? 3 : 1], dead, PAD_MOVE), R = padStick(g.axes[south ? 0 : 2], g.axes[south ? 1 : 3], dead, PAD_CURVES[Settings.padCurve] || PAD_CURVES.reactive);
  const lay = PAD_LAYOUTS[Settings.padLay] || PAD_LAYOUTS.default;
  const alive = PL.ent.alive, map = KS.map.open;
  // movement: analog, from slow walk to full speed (forward = stick up)
  PAD.mx = alive && !map ? L[0] : 0; PAD.mz = alive && !map ? -L[1] : 0;
  // sprint: a press on L3 starts it, it lasts as long as the stick pushes forward; as an option, the stick pushed all the way is enough
  if (Settings.padRun === 'auto') PAD.sprint = alive && !map && !PL.adsWant && (PAD.sprint ? L[2] > 0.9 && -L[1] > 0.3 : L[2] > 0.98 && -L[1] > 0.6);
  else if (PAD.sprint && (!alive || PAD.mz < 0.1 || PL.adsWant || map)) PAD.sprint = false;
  if (!alive) PAD.sprint = false;
  // look: maximum angular speed 3.4 rad/s, slower when aiming as with the mouse; the stick pushed to the edge accelerates (PAD_ACCEL, PAD_RAMP) for U-turns:
  // the ramp rises toward the share of edge reached (from 80% to 98% of the useful travel) in PAD_RAMP s and drops back in 0.1 s
  PAD.lx = R[0]; PAD.ly = R[1];
  const rampTo = smoothstep(0.8, 0.98, R[2]);
  PAD.ramp = PAD.ramp < rampTo ? Math.min(rampTo, PAD.ramp + dt / PAD_RAMP) : Math.max(rampTo, PAD.ramp - dt / 0.1);
  // triggers
  const rt = g.buttons[7] ? g.buttons[7].value : 0, lt = g.buttons[6] ? g.buttons[6].value : 0;
  const fire = PAD.fireOn ? rt > PAD_TRIG.off : rt > PAD_TRIG.on, ads = PAD.adsOn ? lt > PAD_TRIG.off : lt > PAD_TRIG.on;
  if (map) {
    PAD.useT = -1;
    if ((fire && !PAD.fireOn) || padEdge(g, 0) > 0) ksConfirm(); // RT or A
    PAD.fireOn = fire; PAD.adsOn = ads;
    padMapMove(g, dt);
    if (padEdge(g, 1) > 0) ksCancel();
    return;
  }
  if (fire !== PAD.fireOn) { PAD.fireOn = fire; if (alive && performance.now() >= PL.noFireT) { if (fire) PL.queued = true; PL.held = fire; } else if (!fire) PL.held = false; if (fire) PAD.sprint = false; } // firing stops the sprint: L3 to restart it
  if (ads !== PAD.adsOn) { PAD.adsOn = ads; if (alive) PL.adsWant = ads; else PL.adsWant = false; }
  if (ads && PAD.sprint) PAD.sprint = false;
  if (!alive) { PAD.useT = -1; if (padEdge(g, 0) > 0 || padEdge(g, 2) > 0) kcSkip(); return; }
  for (const k in lay) { const e = padEdge(g, +k); if (e) padAction(lay[k], e > 0); }
  padUseTick(dt);
  const back = padDown(g, 8); if (back !== !!HUD.board) showScoreboard(back);
}

/* Menu navigation: focus goes to the nearest element in the requested direction; left and right adjust a slider or a list.
   Focus remembers its place per screen (PAD.mem): a screen that rebuilds under the finger (choosing a mode, a tab) gives it back to the element nearest
   the old position, and a screen that opens takes focus right away (the last element touched, otherwise the main button). */
const PAD_FOCUS = 'button:not(:disabled):not(.ro), select:not(:disabled), input:not([readonly]):not(:disabled):not([type=hidden]), textarea:not(:disabled), [data-focus], [role=button][tabindex="0"], .lcard[tabindex="0"], .onav, summary'; // .lcard: thumbnail (a card), .onav: option row; summary: collapsed Profile sections (password, account deletion), A opens them
const PAD_MAIN = '.mbtn, .lrow.on, [data-focus], [role=radiogroup] [aria-checked="true"], .lrow, .lcard'; // where focus lands: the menu, otherwise the chosen element (card, mode), otherwise the first one other than "Back"
const PAD_PRIMARY = '.deploy:not(:disabled), .btn.primary:not(:disabled), [data-primary]:not(:disabled)'; // the screen's main action (Menu key)
PAD.mem = new WeakMap(); PAD.scope = null; PAD.stickDir = '';
function padScope() {
  // window opened on top: it keeps focus (the last opened first)
  const dlg = [...document.querySelectorAll('[role=dialog], [role=alertdialog]')].filter((e) => !e.classList.contains('hidden') && e.getClientRects().length > 0).pop();
  if (dlg) return dlg;
  const st = MATCH.state;
  // match load failure: its buttons (back, economy mode, report) are handled like a screen
  if (!$('matchload').classList.contains('hidden') && !$('mlBack').classList.contains('hidden')) return $('matchload');
  if (st === 'menu') return UI.busy ? null : $('scr-' + UI.screen);
  if (st === 'paused') return document.querySelector('.pm');
  if (st === 'ended') return $('end');
  return null;
}
function padVisible(el) { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && el.tabIndex >= 0 && getComputedStyle(el).visibility !== 'hidden'; }
const padCenter = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
// every focus (controller, mouse, keyboard) is remembered: a rebuilt screen finds its place again
addEventListener('focusin', (e) => { const sc = padScope(); if (sc && e.target instanceof Element && sc.contains(e.target) && e.target.matches(PAD_FOCUS)) { const [x, y] = padCenter(e.target); PAD.mem.set(sc, { el: e.target, x, y }); } });
function padFocus(scope, el) {
  if (!el) return;
  el.focus({ preventScroll: false }); const [x, y] = padCenter(el); PAD.mem.set(scope, { el, x, y });
  sfxUi('hover');
}
/* Where to put focus back: the remembered element if it still exists, otherwise the nearest to its position, otherwise the screen's main button */
function padRestore(scope, list) {
  const m = PAD.mem.get(scope);
  if (m) {
    if (m.el.isConnected && list.includes(m.el)) return m.el;
    let best = null, bd = 1e9;
    for (const el of list) { const [x, y] = padCenter(el), d = hyp(x - m.x, y - m.y); if (d < bd) { bd = d; best = el; } }
    if (best && bd < 480) return best;
  }
  return list.find((el) => el.matches(PAD_MAIN)) || list.find((el) => !el.matches('.back')) || list[0];
}
/* Neighbor in a direction, like browsers' spatial navigation: first what is clearly beyond the element's edge (minimal gap between the
   edges) AND overlaps on the other axis (same row or same column), the best aligned first; a neighboring offset row is costly (x4), never an
   element "askew" before an aligned one. Nothing like that: fall back to the nearest whose center is in the right direction, so as never to get stuck. */
function padTarget(cur, list, dx, dy) {
  const c = cur.getBoundingClientRect(), horiz = !!dx, cc = horiz ? (c.top + c.bottom) / 2 : (c.left + c.right) / 2;
  let best = null, bs = 1e9;
  for (const el of list) {
    if (el === cur) continue;
    const r = el.getBoundingClientRect();
    const gap = dx > 0 ? r.left - c.right : dx < 0 ? c.left - r.right : dy > 0 ? r.top - c.bottom : c.top - r.bottom; // negative: they overlap in this direction
    if (gap < -8) continue;
    const orth = horiz ? Math.max(0, r.top - c.bottom, c.top - r.bottom) : Math.max(0, r.left - c.right, c.left - r.right); // 0: same row or same column
    const off = Math.abs((horiz ? (r.top + r.bottom) / 2 : (r.left + r.right) / 2) - cc);
    const sc = Math.max(0, gap) + orth * 4 + off * 0.3;
    if (sc < bs) { bs = sc; best = el; }
  }
  if (best) return best;
  const cx = (c.left + c.right) / 2, cy = (c.top + c.bottom) / 2;
  for (const el of list) {
    if (el === cur) continue;
    const [x, y] = padCenter(el), along = dx ? (x - cx) * dx : (y - cy) * dy;
    if (along < (dx ? c.width : c.height) / 2) continue; // the center must go past the middle of the element: a neighbor barely offset from one edge to the other is not "in that direction"
    const sc = hyp(x - cx, y - cy); if (sc < bs) { bs = sc; best = el; }
  }
  return best;
}
/* Menu lists (09ea-list.js, Options): in a [data-lm] column, up and down move to the next or previous row (never a sideways
   jump), then to the "extra" rows at the foot of the screen ([data-lm-extra]: the main action), and at the end leave toward the nearest
   neighbor; left and right adjust the row's value (_adj), otherwise leave the column toward the side neighbor (a destination column
   gives the row where we were). In the menu, right opens a row's submenu; in a submenu, left closes it. A grid of
   thumbnails ([data-lm-grid]: the cards) is traversed in both directions. True if the movement is handled. */
const padLmRows = (box) => [...box.querySelectorAll(box.dataset.lm)].filter((e) => padVisible(e) && e.getAttribute('aria-disabled') !== 'true');
function padLmEntry(box) {
  const rows = padLmRows(box);
  return (box._lastKey != null && rows.find((e) => e.dataset.key === box._lastKey)) || rows.find((e) => e.matches('.on, [aria-selected="true"], [aria-checked="true"]')) || rows[0];
}
addEventListener('focusin', (e) => { // the row where we were in each column (padLmEntry)
  const b = e.target.closest && e.target.closest('[data-lm]'), it = b && e.target.closest(b.dataset.lm);
  if (it && it.dataset.key != null) b._lastKey = it.dataset.key;
});
/* The column an "extra" element belongs to: the last visible column that precedes it in the page (a screen's foot follows its list) */
function padLmOwner(scope, el) {
  let own = null;
  for (const b of scope.querySelectorAll('[data-lm]')) if (b.getClientRects().length > 0 && (b.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) own = b;
  return own;
}
function padListNav(scope, cur, dx, dy, list) {
  const own = cur.closest('[data-lm]'), box = own && scope.contains(own) ? own : null, extra = cur.matches('[data-lm-extra]');
  const main = box || (extra ? padLmOwner(scope, cur) : null);
  if (!main) return false;
  const row = extra ? cur : cur.closest(main.dataset.lm) || cur;
  if (dx && !extra) {
    if (cur.tagName === 'INPUT' && cur.type !== 'range' && cur.type !== 'checkbox') return true; // the text cursor, not the list
    if (row._adj && row._adj(dx)) return true; // an adjusted value
  }
  const sub = LM.all.find((l) => l.pbody === main), menu = LM.all.find((l) => l.col === main);
  if (main.hasAttribute('data-lm-grid')) { // thumbnails: movement within the grid; at the left edge, the submenu closes
    const n = padTarget(row, padLmRows(main), dx, dy);
    if (n) padFocus(scope, n); else if (dx < 0 && sub && lmPop(sub)) sfxUi('back');
    return true;
  }
  const seq = padLmRows(main).concat([...scope.querySelectorAll('[data-lm-extra]')].filter((e) => padVisible(e) && padLmOwner(scope, e) === main)), i = seq.indexOf(row);
  if (i < 0) return false;
  if (dy && seq[i + dy]) { padFocus(scope, seq[i + dy]); return true; }
  if (dx < 0 && sub) { if (lmPop(sub)) sfxUi('back'); return true; } // at the left edge of a submenu: it closes
  if (dx > 0 && menu && row._r && row._r.k === 'link' && row._r.page) { row.click(); return true; } // the submenu opens to the right of the menu
  if (extra && dx) return true;
  // exit (sideways, or at the end of the column): the nearest neighbor outside the column; another column gives its row
  const out = list.filter((el) => !main.contains(el) && !el.matches('[data-lm-extra]'));
  let n = padTarget(row, out, dx, dy);
  if (n) { const b = n.closest('[data-lm]'); if (b && scope.contains(b)) n = padLmEntry(b) || n; padFocus(scope, n); }
  return true;
}
function padNav(scope, dx, dy) {
  const a = document.activeElement, cur = a && scope.contains(a) && a.matches(PAD_FOCUS) ? a : null;
  const list = [...scope.querySelectorAll(PAD_FOCUS)].filter(padVisible);
  if (!list.length) return;
  if (!cur) { padFocus(scope, padRestore(scope, list)); return; }
  if (!dx && !dy) return; // (0, 0): only make sure an element has focus
  if (padListNav(scope, cur, dx, dy, list)) return;
  // left and right on a slider or a dropdown list: adjust the value
  if (dx && cur.tagName === 'INPUT' && cur.type === 'range') {
    const st = parseFloat(cur.step) || 1, v = clamp(parseFloat(cur.value) + dx * st, parseFloat(cur.min), parseFloat(cur.max));
    if (v !== parseFloat(cur.value)) { cur.value = String(v); cur.dispatchEvent(new Event('input', { bubbles: true })); sfxUi('hover'); } return;
  }
  if (dx && cur.tagName === 'SELECT') {
    const i = clamp(cur.selectedIndex + dx, 0, cur.options.length - 1);
    if (i !== cur.selectedIndex) { cur.selectedIndex = i; cur.dispatchEvent(new Event('change', { bubbles: true })); sfxUi('hover'); } return;
  }
  const best = padTarget(cur, list, dx, dy);
  if (best) padFocus(scope, best);
}
/* Scrolling a long list with the right stick: the scrolling parent of the focused element, otherwise of the screen; otherwise the screen's [data-scroll] area
   (results: focus is on the foot buttons, the body scrolls beside it) */
function padScrollMenu(scope, v, dt) {
  let el = document.activeElement && scope.contains(document.activeElement) ? document.activeElement : scope;
  for (; el && el !== document.body; el = el.parentElement) {
    const oy = getComputedStyle(el).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 2) { el.scrollTop += v * dt * 900; return; }
  }
  const z = scope.querySelector('[data-scroll]'); if (z && z.scrollHeight > z.clientHeight + 2) z.scrollTop += v * dt * 900;
}
function padMenu(g, dt) {
  const scope = padScope(); if (!scope) { PAD.navKey = ''; PAD.scope = null; return; }
  const a = document.activeElement, inScope = a && scope.contains(a) && a.matches(PAD_FOCUS);
  // screen opening, or focus lost because the screen rebuilt: focus comes back on its own (not onto an input field elsewhere)
  if (scope !== PAD.scope || (!inScope && (!a || a === document.body || !a.isConnected))) { PAD.scope = scope; padNav(scope, 0, 0); }
  // direction: D-pad or left stick; a first press acts right away, then repeat takes over (0.38 s then every 0.11 s).
  // The stick has hysteresis (0.6 to start, 0.35 to stop): a stick trembling around the threshold no longer bounces from one element to another.
  const sx = g.axes[0], sy = g.axes[1], thr = PAD.navKey ? 0.35 : 0.6;
  let dx = (padDown(g, 15) || sx > thr ? 1 : 0) - (padDown(g, 14) || sx < -thr ? 1 : 0), dy = (padDown(g, 13) || sy > thr ? 1 : 0) - (padDown(g, 12) || sy < -thr ? 1 : 0);
  if (dx && dy) { if (Math.abs(sx) > Math.abs(sy)) dy = 0; else dx = 0; }
  const key = dx + ',' + dy;
  if (!dx && !dy) PAD.navKey = '';
  else if (key !== PAD.navKey) { PAD.navKey = key; PAD.navT = 0.38; padNav(scope, dx, dy); }
  else if ((PAD.navT -= dt) <= 0) { PAD.navT = 0.11; padNav(scope, dx, dy); }
  if (Math.abs(g.axes[3]) > 0.3) padScrollMenu(scope, g.axes[3], dt);
  const cur = document.activeElement;
  if (padEdge(g, 0) > 0) {
    if (cur && scope.contains(cur) && cur.matches(PAD_FOCUS)) {
      if (cur.tagName === 'SELECT') { // the browser's list can't be handled with a controller: A moves to the next option (back to the start after the last)
        cur.selectedIndex = (cur.selectedIndex + 1) % cur.options.length; cur.dispatchEvent(new Event('change', { bubbles: true })); sfxUi('hover');
      } else cur.click();
    } else padNav(scope, 0, 0);
  }
  if (padEdge(g, 1) > 0) { // B: same path as Esc (back, closing a window, resume in the pause)
    const t = (cur && scope.contains(cur) ? cur : scope);
    t.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true, cancelable: true }));
    t.dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape', key: 'Escape', bubbles: true, cancelable: true }));
  }
  const tab = (padEdge(g, 5) > 0 ? 1 : 0) - (padEdge(g, 4) > 0 ? 1 : 0);
  if (tab) {
    // the focused tab row (a screen can have several), otherwise the first visible one
    const groups = [...scope.querySelectorAll('.tabs')].filter((t) => t.getClientRects().length > 0);
    const grp = groups.find((t) => cur && t.contains(cur)) || groups[0];
    const tabs = grp ? [...grp.querySelectorAll('button')].filter(padVisible) : [], i = tabs.findIndex((b) => b.getAttribute('aria-selected') === 'true');
    if (tabs.length && i >= 0 && tabs[i + tab]) { tabs[i + tab].click(); padFocus(scope, tabs[i + tab]); }
  }
  const primary = [...scope.querySelectorAll(PAD_PRIMARY)].find(padVisible);
  if (padEdge(g, 9) > 0) { // Menu: the screen's main action (start the match, deploy, replay); in the pause, resume the match
    if (MATCH.state === 'paused') resumeGame();
    else if (primary) { sfxUi('click'); primary.click(); }
  }
  padHints(scope, primary, [...scope.querySelectorAll('.tabs')].some((t) => t.getClientRects().length > 0));
}
/* Prompt bar at the bottom right, as long as the controller is in charge in a menu, the pause or the results (not on touch): what A, B, LB RB
   and Menu do on the displayed screen, with the button glyphs (padGlyph); written only if it changes */
function padHints(scope, primary, tabs) {
  const el = $('padHints'); if (!el) return;
  if (!scope || TOUCH.on) { if (!el.classList.contains('hidden')) { el.classList.add('hidden'); document.body.classList.remove('padbar'); } return; }
  const paused = MATCH.state === 'paused', it = (g, t) => `<span>${g}<b>${esc(t)}</b></span>`;
  const noBack = scope.id === 'scr-main' || scope.id === 'scr-deploy' || scope.id === 'end'; // (nothing to leave: B does nothing there)
  const cur = document.activeElement, crow = cur && cur.closest && cur.closest('.lrow, .onav'), adj = !!crow && scope.contains(crow) && (crow._adjK || (crow._r && (crow._r.k === 'seg' || crow._r.k === 'check' || crow._r.k === 'range'))); // a row being adjusted
  const html = (adj ? it(padGlyph(12), _t('Adjust')) : '') + it(padGlyph(0), _t('Confirm'))
    + (noBack ? '' : it(padGlyph(1), paused && UI.pm === 'home' ? _t('Resume') : _t('Back')))
    + (tabs ? it(padGlyph(4) + padGlyph(5), _t('Tabs')) : '')
    + (paused ? it(padGlyph(9), _t('Resume')) : primary ? it(padGlyph(9), (primary.textContent || '').trim()) : '');
  if (el.dataset.k !== html) { el.dataset.k = html; el.innerHTML = html; }
  if (el.classList.contains('hidden')) { el.classList.remove('hidden'); document.body.classList.add('padbar'); }
}

/* Every frame (09-game.js): reads the controller and translates it into actions */
function padTick(dt) {
  const g = padPick();
  if (!PAD.drive || !(MATCH.state === 'menu' || MATCH.state === 'paused' || MATCH.state === 'ended')) padHints(null);
  if (!g) { if (PAD.mx || PAD.mz || PAD.lx || PAD.ly || PAD.fireOn || PAD.adsOn || PAD.sprint || PAD.useT >= 0) padIdle(); return; }
  const st = MATCH.state;
  // the controller takes charge as soon as a button goes down or a stick leaves its dead zone; a click or a key takes it back
  if (!PAD.drive) {
    let act = false; for (let i = 0; i < g.buttons.length && !act; i++) act = padDown(g, i);
    for (let i = 0; i < 4 && !act; i++) act = Math.abs(g.axes[i]) > 0.4;
    if (act) { PAD.drive = true; document.body.classList.add('padnav'); }
  }
  if (PAD.drive) {
    if (st === 'playing') {
      if (!CHAT.open) padPlay(g, dt); else padIdle();
      if (padEdge(g, 9) > 0 && !CHAT.open) pauseGame();
      if ($('lockPrompt').classList.contains('show')) showLockPrompt(false);
    } else {
      if (PAD.mx || PAD.mz || PAD.lx || PAD.ly || PAD.fireOn || PAD.adsOn || PAD.sprint || PAD.useT >= 0) padIdle();
      if (st === 'killcam' && padEdge(g, 0) > 0) kcSkip();
      else if (st === 'menu' || st === 'paused' || st === 'ended') padMenu(g, dt);
    }
  }
  for (let i = 0; i < g.buttons.length; i++) PAD.prev[i] = padDown(g, i);
}
/* Nothing active anymore (pause, chat, controller unplugged): release everything the controller held */
function padIdle() {
  if (PAD.fireOn) PL.held = false;
  if (PAD.adsOn) PL.adsWant = false;
  if (PAD.l3) PAD.l3 = false;
  PAD.mx = PAD.mz = PAD.lx = PAD.ly = 0; PAD.sprint = false; PAD.fireOn = PAD.adsOn = false; PAD.ramp = 0; PAD.useT = -1;
  if (PAD.jumpOn) { PAD.jumpOn = false; KEYS.Space = false; }
}
/* Controller look, called by updatePlayer: radians per second, slower when the field of view narrows (scope) */
function padLook(dt) {
  if (!(PAD.lx || PAD.ly) || KS.map.open) return;
  const zoom = camera.fov / Settings.fov, acc = PAD_ACCEL[Settings.padAccel], gain = 1 + (acc === undefined ? PAD_ACCEL.normal : acc) * PAD.ramp * (1 - 0.5 * clamp(VM.ads, 0, 1));
  const k = Settings.padSens * 3.4 * gain * (0.35 + 0.65 * zoom) * adsLookMul(Settings.padAdsMul) * AIM.fr * dt; // AIM.fr: slowdown on target (09qd-aim.js)
  PL.yaw -= PAD.lx * k; PL.pitch -= PAD.ly * k * 0.8 * (Settings.invertY ? -1 : 1);
  VM.swayTX += PAD.lx * k * 0.35; VM.swayTY += PAD.ly * k * 0.35;
}

addEventListener('gamepadconnected', (e) => {
  PAD.id = e.gamepad ? e.gamepad.id : '';
  if (PAD.seen) return;
  PAD.seen = true;
  if (!Settings.padSeen) { Settings.padSeen = true; saveSettings(); }
  for (const O of OPTS) if (O.rebuild) O.rebuild(); // the controller settings appear in Options
});
addEventListener('gamepaddisconnected', () => { if (!padPick()) { padIdle(); PAD.drive = false; document.body.classList.remove('padnav'); if (MATCH.state === 'playing') pauseGame(); } });
// a click or a key hands control back to the mouse and keyboard (mouse capture requested again at the next click in the game)
const padHand = (e) => { if (!PAD.drive || !e.isTrusted) return; PAD.drive = false; document.body.classList.remove('padnav'); padIdle(); padHints(null); };
addEventListener('pointerdown', padHand, true); addEventListener('keydown', padHand, true);
// the mouse takes over as soon as it moves (a few pixels: a still cursor, or one that moves by itself under a scrolling screen, doesn't take it back); otherwise the cursor stays hidden
// and hovers over nothing (body.padnav: see shell.html), so no more double highlight with the controller focus
let padMouse = null, padMoved = 0;
addEventListener('mousemove', (e) => {
  if (!e.isTrusted) return;
  const p = padMouse; padMouse = [e.screenX, e.screenY];
  if (!PAD.drive || !p) { padMoved = 0; return; }
  padMoved += Math.abs(e.screenX - p[0]) + Math.abs(e.screenY - p[1]);
  if (padMoved >= 6) { padMoved = 0; padHand(e); }
}, true);
// controller already known from a previous visit: the settings are visible as soon as Options opens
if (Settings.padSeen) PAD.seen = true;
