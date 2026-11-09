/* ==========================================================================
   KEYBOARD KEYS
   Each player action has a default key (BIND_DEFS); Options, Controls lets you pick another (Settings.binds:
   action => key code, only the deviations). The rest of the game keeps reading the default keys (KEYS.KeyW, 'KeyR'...): onKey
   passes each key through keyCanon, which returns the default key of the action it is bound to (or '' for a freed default
   key, which no longer controls anything). Touch controls and the gamepad, which write KEYS.Space directly, are not affected.
   Reserved keys (not bindable): Escape, P (pause), T (chat), Enter (skip the killcam), function keys.
   Outside fullscreen, the browser keeps some shortcuts (Ctrl+W, Ctrl+N, Ctrl+T): they can only be overridden by keyboard
   lock (syncKeyboardLock, 09-game.js), which covers Escape and all bound keys; the rest is refused by bindGuard.
   ========================================================================== */
const BIND_DEFS = [
  ['fwd', 'KeyW', _t('Move forward')], ['back', 'KeyS', _t('Move back')], ['left', 'KeyA', _t('Strafe left')], ['right', 'KeyD', _t('Strafe right')],
  ['jump', 'Space', _t('Jump')], ['sprint', 'ShiftLeft', _t('Sprint, hold your breath when scoped')],
  ['crouch', 'ControlLeft', _t('Crouch (hold), slide while sprinting')], ['crouchT', 'KeyC', _t('Crouch (toggle), slide while sprinting')],
  ['reload', 'KeyR', _t('Reload')], ['w1', 'Digit1', _t('Primary weapon')], ['w2', 'Digit2', _t('Secondary weapon')], ['swap', 'KeyQ', _t('Switch weapon')],
  ['knife', 'KeyF', _t('Knife (hold to keep it in hand)')], ['nade', 'KeyG', _t('Grenade (hold to keep it in hand)')], ['use', 'KeyE', _t('Pick up the weapon on the ground')], ['inspect', 'KeyI', _t('Inspect weapon')],
  ['ks1', 'Digit4', _t('First killstreak')], ['ks2', 'Digit5', _t('Second killstreak')], ['ks3', 'Digit6', _t('Third killstreak')], ['board', 'Tab', _t('Scoreboard')],
];
const BIND_RESERVED = new Set(['Escape', 'KeyP', 'KeyT', 'Enter', 'NumpadEnter', 'MetaLeft', 'MetaRight', 'ContextMenu', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const BIND = { rev: new Map(), dead: new Set(), layout: null, capture: null };
const bindDefault = (a) => BIND_DEFS.find((d) => d[0] === a)[1];
const bindValid = (c) => typeof c === 'string' && /^[A-Za-z0-9]{1,20}$/.test(c) && !BIND_RESERVED.has(c) && !/^F\d{1,2}$/.test(c);
function bindOf(a) { const o = Settings.binds && Settings.binds[a]; return bindValid(o) ? o : bindDefault(a); }
function bindRebuild() {
  BIND.rev = new Map(); BIND.dead = new Set();
  for (const [a, def] of BIND_DEFS) { const c = bindOf(a); if (!BIND.rev.has(c)) BIND.rev.set(c, def); } // two actions on the same key: the first wins
  for (const [a, def] of BIND_DEFS) if (!BIND.rev.has(def)) BIND.dead.add(def);                         // freed default key: it does nothing anymore
}
function keyCanon(code) { if (BIND.rev.has(code)) return BIND.rev.get(code); return BIND.dead.has(code) ? '' : code; }
/* Keys to keep for the game when the keyboard is locked (fullscreen) */
function bindCodes() { return ['Escape', ...BIND_DEFS.map((d) => bindOf(d[0])), 'ShiftLeft', 'ControlLeft']; }
/* Readable name: the keyboard layout's own when the browser provides it (AZERTY, QWERTZ...), otherwise from the code */
function keyLabel(code) {
  const L = BIND.layout && BIND.layout.get(code);
  if (L && L.length === 1) return L.toUpperCase();
  const m = /^(Key|Digit)(.)$/.exec(code); if (m) return m[2];
  const names = { Space: _t('Space'), ShiftLeft: _t('Left Shift'), ShiftRight: _t('Right Shift'), ControlLeft: _t('Left Ctrl'), ControlRight: _t('Right Ctrl'), AltLeft: _t('Left Alt'), AltRight: _t('Right Alt'), Tab: _t('Tab'), CapsLock: _t('Caps Lock'), Backquote: '²', Backspace: _t('Backspace') };
  return names[code] || (/^Numpad/.test(code) ? _t('Numpad {0}', code.slice(6)) : code);
}
/* Binds an action to a key: if another action had it, it takes this one's old key (swap) */
function bindSet(a, code) {
  if (!bindValid(code)) return false;
  Settings.binds = Settings.binds || {};
  const old = bindOf(a), other = BIND_DEFS.find((d) => d[0] !== a && bindOf(d[0]) === code);
  if (other) Settings.binds[other[0]] = old;
  Settings.binds[a] = code;
  for (const k of Object.keys(Settings.binds)) if (Settings.binds[k] === bindDefault(k)) delete Settings.binds[k]; // only the deviations
  saveSettings(); bindRebuild(); for (const k in KEYS) KEYS[k] = false; syncKeyboardLock();
  return true;
}
function bindReset() { Settings.binds = {}; saveSettings(); bindRebuild(); for (const k in KEYS) KEYS[k] = false; syncKeyboardLock(); }
if (navigator.keyboard && navigator.keyboard.getLayoutMap) navigator.keyboard.getLayoutMap().then((m) => { BIND.layout = m; }).catch(() => { /* unknown layout */ });
bindRebuild();

/* Browser shortcuts during the match (Ctrl+Shift+letter opens a window, a tab search, or releases the mouse from the game):
   as long as the mouse is captured, any combination with Ctrl or Alt is held by the game. Shortcuts reserved to the browser (Ctrl+W, Ctrl+N,
   Ctrl+T) can only be overridden with the keyboard locked, in fullscreen. */
function bindGuard(e) {
  if (!(e.ctrlKey || e.altKey) || MATCH.state === 'menu' || !pointerActive() || CHAT.open) return;
  if (e.code === 'F12' || e.code === 'F11') return; // developer tools and fullscreen are left to the user
  e.preventDefault();
}
addEventListener('keydown', bindGuard, true);
addEventListener('keyup', bindGuard, true);

/* Key editor (Options, Controls): one row per action, a click then the desired key; Escape cancels, Backspace restores the default */
function bindEditor(root) {
  const h = document.createElement('dl'); h.className = 'keys binds'; const note = document.createElement('p');
  const draw = () => {
    h.innerHTML = '';
    for (const [a, , label] of BIND_DEFS) {
      const kp = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd'), b = document.createElement('button'); kp.className = 'kp'; // an action-key pair (two columns on a wide screen)
      dt.textContent = label; b.type = 'button'; b.className = 'kb' + (bindOf(a) !== bindDefault(a) ? ' changed' : '');
      b.textContent = BIND.capture === a ? _t('Press a key...') : keyLabel(bindOf(a));
      if (BIND.capture === a) b.classList.add('wait');
      b.addEventListener('click', () => { BIND.capture = a; draw(); b.focus(); });
      dd.appendChild(b); kp.append(dt, dd); h.appendChild(kp);
    }
  };
  const onKeyCap = (e) => {
    if (!BIND.capture) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.type === 'keyup') return;
    const a = BIND.capture;
    if (e.code === 'Escape') { BIND.capture = null; draw(); return; }
    if (e.code === 'Backspace' || e.code === 'Delete') { bindSet(a, bindDefault(a)); BIND.capture = null; draw(); return; }
    if (!bindValid(e.code)) { note.textContent = _t('This key is reserved (Esc, P, T, Enter, arrow keys and function keys).'); return; }
    bindSet(a, e.code); BIND.capture = null; draw();
  };
  addEventListener('keydown', onKeyCap, true); addEventListener('keyup', onKeyCap, true);
  draw(); root.appendChild(h);
  const row = document.createElement('div'); row.className = 'orow';
  const r = document.createElement('button'); r.type = 'button'; r.className = 'btn'; r.textContent = _t('Restore default keys');
  r.addEventListener('click', () => { bindReset(); BIND.capture = null; draw(); sfxUi('click'); });
  row.append(document.createElement('span'), r); root.appendChild(row);
  note.className = 'hint'; note.textContent = _t('Click a key, then press the new key (Backspace: restore the default). Outside fullscreen, Ctrl+Shift with a letter can trigger a browser shortcut. Prefer other keys or play in fullscreen.');
  root.appendChild(note);
  return draw;
}
