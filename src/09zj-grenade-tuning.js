/* ==========================================================================
   HELD-GRENADE TUNING BENCH (development tool, README "Grenades")
   The game opens with ?grenade=1 (https://localhost:8080/?grenade=1): a panel on the left tunes live, in the real first-person view, each grenade and the throwing knife in the hand (position and angles: NADE_GRIP), the fingers and thumb holding them (HAND_POSES.nfrag, nflash, nsmoke, nknife), the armed arm and the left hand
   (NADE_POSE). Start a solo match, pick the type in the panel, and each slider takes effect immediately.
   - Game: play normally (G throws for real). Hold forces the armed arm, grenade in hand, even when standing still; Pin pull and Throw freeze the motion
     at one instant or replay it in a loop.
   - Copy: the whole configuration as one text, to paste into the conversation; Apply: the reverse. It is kept in the browser
     (localStorage, dc_grenade) while the panel is open, "Reset all" goes back to the one in the code.
   - Works like the knife bench (09zk-knife-tuning.js, from which it reuses kdbgMerge and the thumb starting poses): the mouse stays free,
     the panel stops the events it receives, "Lock view" freezes the gaze.
   The code does nothing without ?grenade=1: the panel, its events and the NADE_DEBUG hook (06c-models.js, 08-player.js) do not exist for a player.
   ========================================================================== */
const NDBG_ON = /[?&]grenade=1(&|$)/.test(location.search);
const NDBG = { type: 'frag', mode: 'hold', t: 0.3, loop: true, clock: 0, god: true, bots: null, lookLock: false, def: null, el: null, rows: [], secs: [], ta: null, msg: null, tEl: null };

/* The settings: [path, label, min, max, step]. Path: G = NADE_GRIP, H = HAND_POSES, N = NADE_POSE, then the keys (a number: an array index) */
function ndbgTypeSpec(id) {
  const n = NADE_TYPES[id].long, G = `G.${id}`, F = `H.n${id}`, f = (path, lab, mn, mx, st) => [path, lab, mn, mx, st];
  return [
    [`${n}: position in hand (hand frame: x pinky, y back of hand, z elbow)`, [
      f(`${G}.p.0`, 'center x (toward the pinky)', -0.1, 0.1, 0.001), f(`${G}.p.1`, 'center y (palm: negative)', -0.12, 0.06, 0.001), f(`${G}.p.2`, 'center z (fingers: negative)', -0.14, 0.06, 0.001),
      f(`${G}.r.0`, 'angle around x (degrees)', -180, 180, 1), f(`${G}.r.1`, 'angle around y', -180, 180, 1), f(`${G}.r.2`, 'angle around z', -180, 180, 1),
    ], id],
    [`${n}: fingers (flexion in rad: base, middle, tip; 0 straight)`, [
      ...[['i', 'index'], ['m', 'middle'], ['r', 'ring'], ['p', 'pinky']].flatMap(([k, nm]) => [['base', 0], ['mid', 1], ['tip', 2]].map(([b, j]) => f(`${F}.${k}.${j}`, `${nm} ${b}`, 0, 1.9, 0.01))),
      f(`${F}.spread`, 'finger spread', 0, 0.3, 0.005),
    ], id],
    [`${n}: thumb (rad; the base pivots in eight directions, from most natural to freest)`, [
      f(`${F}.t.0`, 'thumb middle: flexion', -3, 3, 0.01), f(`${F}.t.1`, 'thumb tip: flexion', -3, 3, 0.01),
      f(`${F}.t.2`, 'base: toward the little finger', -3, 3, 0.01), f(`${F}.t.3`, 'base: spread away from the palm', -3, 3, 0.01), f(`${F}.t.4`, 'base: spin on its own axis (the nail)', -3, 3, 0.01),
      f(`${F}.t.5`, 'base: pivot on x (across)', -3.2, 3.2, 0.02), f(`${F}.t.6`, 'base: pivot on y (back of hand)', -3.2, 3.2, 0.02), f(`${F}.t.7`, 'base: pivot on z (forearm)', -3.2, 3.2, 0.02),
    ], id, F],
  ];
}
const NDBG_SPEC = () => [
  ...NADE_IDS.flatMap(ndbgTypeSpec),
  ['Armed arm (the held pose, shared by all three; wrist in meters, camera frame)', [
    ['N.armed.0', 'wrist x (right)', -0.4, 0.6, 0.005], ['N.armed.1', 'wrist y (up)', -0.5, 0.4, 0.005], ['N.armed.2', 'wrist z (far: negative)', -0.8, -0.05, 0.005],
    ['N.rollArmed', 'forearm roll', -3.2, 3.2, 0.02], ['N.pole.0', 'elbow x', -2, 2, 0.05], ['N.pole.1', 'elbow y (down: negative)', -2, 2, 0.05], ['N.pole.2', 'elbow z', -2, 2, 0.05],
    ['N.shoulderUp', 'shoulder raised', -0.2, 0.4, 0.005],
  ]],
  ['Left hand during the hold', [
    ['N.guide.0', 'wrist x', -0.6, 0.3, 0.005], ['N.guide.1', 'wrist y', -0.6, 0.3, 0.005], ['N.guide.2', 'wrist z', -0.9, -0.1, 0.005], ['N.rollL', 'roll', -3.2, 3.2, 0.02],
  ]],
];
/* What the copied text takes from NADE_POSE (the pin-pull and throw trajectories stay in the code) */
const NDBG_POSE_KEYS = ['armed', 'rollArmed', 'pole', 'shoulderUp', 'guide', 'rollL'];
function ndbgRoot(k) { return k === 'G' ? NADE_GRIP : k === 'H' ? HAND_POSES : NADE_POSE; }
function ndbgRef(path) { // 'G.frag.p.0' : [array or object, key]
  const k = path.split('.'); let o = ndbgRoot(k[0]);
  for (let i = 1; i < k.length - 1; i++) o = o[k[i]];
  return [o, k[k.length - 1]];
}
function ndbgGet(path) { const [o, k] = ndbgRef(path); return o[k]; }
function ndbgSet(path, v) { const [o, k] = ndbgRef(path); o[k] = v; ndbgSave(); }
function ndbgSnap() {
  const hands = {}; for (const id of NADE_IDS) hands['n' + id] = HAND_POSES['n' + id];
  const pose = {}; for (const k of NDBG_POSE_KEYS) pose[k] = NADE_POSE[k];
  return JSON.parse(JSON.stringify({ NADE_GRIP, NADE_POSE: pose, hands }));
}
/* the copied text: one line per set, numbers to four decimals */
function ndbgText() {
  const s = ndbgSnap(), f = (v) => JSON.stringify(v, (k, x) => (typeof x === 'number' ? +x.toFixed(4) : x));
  return `{\n"NADE_GRIP": ${f(s.NADE_GRIP)},\n"NADE_POSE": ${f(s.NADE_POSE)},\n"hands": ${f(s.hands)}\n}`;
}
function ndbgLoad(text) {
  const c = JSON.parse(text);
  kdbgMerge(NADE_GRIP, c.NADE_GRIP); // kdbgMerge only takes known keys, of the same type
  if (c.NADE_POSE && typeof c.NADE_POSE === 'object') { const P = {}; for (const k of NDBG_POSE_KEYS) if (k in c.NADE_POSE) P[k] = c.NADE_POSE[k]; kdbgMerge(NADE_POSE, P); } // not the trajectories
  if (c.hands) for (const id of NADE_IDS) kdbgMerge(HAND_POSES['n' + id], c.hands['n' + id]);
  ndbgRefresh(); ndbgSave();
}
function ndbgSave() { try { localStorage.setItem('dc_grenade', ndbgText()); } catch (e) { /* storage refused: the configuration does not survive a reload */ } }
function ndbgSay(t) { if (NDBG.msg) NDBG.msg.textContent = t; }
function ndbgDefault(path) { const k = path.split('.'), d = NDBG.def; let v = k[0] === 'G' ? d.NADE_GRIP : k[0] === 'H' ? d.hands : d.NADE_POSE; for (let i = 1; i < k.length; i++) v = v[k[i]]; return v; }

/* What the panel forces in the hand state (called by updatePlayer, 08-player.js, just before updateRigs). The real player state does not change:
   the panel's grenade is not thrown, not cooked, and does not explode */
function ndbgFilter(S, dt) {
  const K = NDBG;
  if (K.god) PL.ent.health = 100;
  if (K.lookLock) { mouseDX = 0; mouseDY = 0; }
  if (!PL.nadeState) PL.nadeType = K.type; // the type chosen in the panel, even after a respawn (otherwise the class's one)
  if (K.mode === 'inGame' || !PL.ent.alive || PL.nadeState) return;
  if (PL.knifeOut) knifeStow(PL.cur);
  S.knifeT = 0; S.knifeHold = 0; S.cookT = 0; VM.lowerTarget = 1;
  VM.bobAmt = 0; VM.bobO.set(0, 0, 0); VM.bobR.set(0, 0, 0);
  if (K.mode === 'hold') { S.nadeState = 'cook'; S.nadeT = 1; return; }
  const dur = K.mode === 'pull' ? NADE_ANIM.pull : NADE_ANIM.throw;
  let t = K.t;
  if (K.loop) { K.clock = (K.clock + dt) % (dur + 0.6); t = Math.min(1, K.clock / dur); if (K.tEl) K.tEl.value = t; }
  S.nadeState = K.mode; S.nadeT = t * dur * (K.mode === 'pull' ? 0.999 : 1);
}

function ndbgRefresh() {
  for (const r of NDBG.rows) { const v = ndbgGet(r.path); r.input.value = v; r.num.value = +v.toFixed(4); }
}
/* the chosen type: the one the hand holds, its settings open, the others' collapsed */
function ndbgType(id) {
  NDBG.type = id; if (!PL.nadeState) PL.nadeType = id;
  for (const s of NDBG.secs) if (s.type) s.d.open = s.type === id && (s.d.open || s.first);
  for (const b of NDBG.typeBtns) b.classList.toggle('on', b.dataset.ty === id);
}
function ndbgInit() {
  if (NDBG.el) return;
  NDBG.def = ndbgSnap();
  LOCK.fallback = true; showLockPrompt(false); // the mouse stays free: we touch sliders
  try { const s = localStorage.getItem('dc_grenade'); if (s) ndbgLoad(s); } catch (e) { /* stored configuration unreadable: use the code's one */ }
  NADE_DEBUG = ndbgFilter;
  const css = document.createElement('style');
  css.textContent = `#ndbg{position:fixed;left:0;top:0;bottom:0;width:420px;z-index:100000;overflow:auto;background:rgba(8,10,8,.86);color:#e8e8e0;font:11px/1.35 monospace;padding:6px 8px;box-sizing:border-box}
#ndbg.right{left:auto;right:0}#ndbg.min{bottom:auto;overflow:hidden;width:230px}#ndbg.min .body{display:none}
#ndbg h1{font:700 12px monospace;margin:0 0 4px;cursor:pointer}#ndbg details{margin:5px 0;border-top:1px solid #444;padding-top:3px}#ndbg summary{cursor:pointer;font-weight:700;color:#ffd24a}
#ndbg .row{display:grid;grid-template-columns:208px 1fr 58px;gap:4px;align-items:center;margin:1px 0}#ndbg .row label{cursor:pointer;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
#ndbg .row input[type=range]{width:100%;margin:0}#ndbg .row input[type=number]{width:58px;background:#222;color:#eee;border:1px solid #555;font:11px monospace}
#ndbg button{background:#333;color:#eee;border:1px solid #666;margin:1px 2px 1px 0;padding:2px 6px;font:11px monospace;cursor:pointer}#ndbg button.on{background:#ffd24a;color:#111}
#ndbg textarea{width:100%;height:96px;background:#111;color:#cfc;border:1px solid #555;font:10px monospace;box-sizing:border-box}`;
  document.head.appendChild(css);
  const el = NDBG.el = document.createElement('div'); el.id = 'ndbg';
  // the game must receive nothing of what is done in the panel
  for (const t of ['mousedown', 'mouseup', 'mousemove', 'keydown', 'keyup', 'wheel', 'contextmenu', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'click', 'dblclick']) el.addEventListener(t, (e) => e.stopPropagation());
  const h = document.createElement('h1'); h.textContent = 'Grenade and throwing knife tuning bench (click: collapse)'; h.onclick = () => el.classList.toggle('min'); el.appendChild(h);
  const body = document.createElement('div'); body.className = 'body'; el.appendChild(body);
  const mk = (tag, o = {}, kids = []) => { const e = document.createElement(tag); Object.assign(e, o); for (const k of kids) e.appendChild(k); return e; };
  const btn = (txt, fn, cls) => { const b = mk('button', { textContent: txt, onclick: fn }); if (cls) b.className = cls; return b; };
  const chk = (txt, key) => { const c = mk('input', { type: 'checkbox', checked: !!NDBG[key], onchange: () => { NDBG[key] = c.checked; } }), lb = mk('label', {}, [c, document.createTextNode(' ' + txt + ' ')]); lb.cb = c; return lb; };
  // held type
  const trow = mk('div', {}, [mk('span', { textContent: 'Equipment: ' })]);
  NDBG.typeBtns = NADE_IDS.map((id) => { const b = btn(NADE_TYPES[id].name, () => ndbgType(id)); b.dataset.ty = id; trow.appendChild(b); return b; });
  body.appendChild(trow);
  // modes
  const modes = [['inGame', 'Game'], ['hold', 'Hold'], ['pull', 'Pin pull'], ['throw', 'Throw']], mb = {};
  const setMode = (m) => { NDBG.mode = m; for (const k in mb) mb[k].classList.toggle('on', k === m); };
  const mrow = mk('div');
  for (const [m, n] of modes) { mb[m] = btn(n, () => setMode(m)); mrow.appendChild(mb[m]); }
  body.appendChild(mrow); setMode(NDBG.mode);
  const l = chk('loop', 'loop');
  const tr = mk('input', { type: 'range', min: 0, max: 1, step: 0.01, value: NDBG.t, oninput: () => { NDBG.t = +tr.value; NDBG.loop = false; l.cb.checked = false; } }); NDBG.tEl = tr;
  body.append(mk('div', { textContent: 'Pin pull, throw: moment (0 to 1)' }), tr, l);
  // tools
  const tools = mk('div', { style: 'margin-top:4px' });
  tools.append(
    btn('Freeze bots', function () { if (NDBG.bots) { botsTick = NDBG.bots; NDBG.bots = null; } else { NDBG.bots = botsTick; botsTick = () => {}; } this.classList.toggle('on', !!NDBG.bots); }),
    btn('Hide HUD', function () { const hud = $('hud'); hud.style.display = hud.style.display === 'none' ? '' : 'none'; this.classList.toggle('on', hud.style.display === 'none'); }),
    btn('Lock view', function () { NDBG.lookLock = !NDBG.lookLock; this.classList.toggle('on', NDBG.lookLock); }),
    btn('Look at hand', () => { PL.pitch = -0.1; }), // the held pose is at the top right: an almost level gaze keeps it in the field of view
    btn('Panel right / left', () => el.classList.toggle('right')),
    btn('Give control back to the game', () => { if (document.activeElement) document.activeElement.blur(); }),
    btn('Melee knife bench', () => { location.search = '?knife=1'; }), // (?knife=1, 09zk-knife-tuning.js: the hand that holds the close-combat knife)
    chk('invincible', 'god'));
  body.appendChild(tools);
  // settings
  for (const [title, list, type, thumbRoot] of NDBG_SPEC()) {
    const first = /in hand|thumb/.test(title);
    const d = mk('details', { open: !type || (type === NDBG.type && first) }, [mk('summary', { textContent: title })]);
    NDBG.secs.push({ d, type, first });
    for (const [path, label, min, max, step] of list) {
      const def = ndbgGet(path), row = mk('div', { className: 'row' });
      const lab = mk('label', { textContent: label, title: label + ' (click: code value)' });
      const input = mk('input', { type: 'range', min, max, step, value: def }), num = mk('input', { type: 'number', min, max, step, value: +def.toFixed(4) });
      input.oninput = () => { ndbgSet(path, +input.value); num.value = +(+input.value).toFixed(4); };
      num.onchange = () => { if (!Number.isFinite(+num.value)) return; ndbgSet(path, +num.value); input.value = num.value; };
      lab.onclick = () => { ndbgSet(path, ndbgDefault(path)); ndbgRefresh(); };
      row.append(lab, input, num); NDBG.rows.push({ path, input, num });
      d.appendChild(row);
    }
    if (thumbRoot) { // thumb starting poses: the grenades' one, then the knife's
      const pr = mk('div');
      for (const [n, t] of [['Grenade starting pose', [0.35, 0.3, 0.8, 0.8, 0, 0, 0, 0]], ...KDBG_THUMBS]) pr.appendChild(btn(n, () => { for (let j = 0; j < 8; j++) ndbgSet(`${thumbRoot}.t.${j}`, t[j]); ndbgRefresh(); }));
      d.insertBefore(pr, d.children[1]);
    }
    if (type && title.includes('in hand')) { // copy the grip and fingers of another type
      const cp = mk('div');
      for (const o of NADE_IDS) if (o !== type) cp.appendChild(btn(`Take grip from: ${NADE_TYPES[o].name}`, () => {
        kdbgMerge(NADE_GRIP[type], JSON.parse(JSON.stringify(NADE_GRIP[o]))); kdbgMerge(HAND_POSES['n' + type], JSON.parse(JSON.stringify(HAND_POSES['n' + o]))); ndbgRefresh(); ndbgSave();
      }));
      d.insertBefore(cp, d.children[1]);
    }
    body.appendChild(d);
  }
  // configuration: copy, apply, reset all
  const cfg = mk('details', { open: true }, [mk('summary', { textContent: 'Configuration (paste into the conversation)' })]);
  const ta = NDBG.ta = mk('textarea', { spellcheck: false }); NDBG.msg = mk('div');
  cfg.append(ta, btn('Copy', async () => {
    const t = ndbgText(); ta.value = t; ta.select(); let ok = false;
    try { await navigator.clipboard.writeText(t); ok = true; } catch (e) { try { ok = document.execCommand('copy'); } catch (e2) { ok = false; } }
    ndbgSay(ok ? 'Copied to clipboard.' : 'Text selected above: Ctrl+C.');
  }), btn('Apply text', () => { try { ndbgLoad(ta.value); ndbgSay('Applied.'); } catch (e) { ndbgSay('Unreadable text: ' + e.message); } }),
  btn('Reset all', () => { ndbgLoad(JSON.stringify(NDBG.def)); ta.value = ''; ndbgSay('Code configuration restored.'); }), NDBG.msg);
  body.appendChild(cfg);
  document.body.appendChild(el);
  ndbgRefresh(); ndbgType(NDBG.type);
  // view locked: the gaze no longer follows the mouse, which leaves the hand free to touch the panel without taking your eyes off the scene
  addEventListener('mousemove', (e) => { if (NDBG.lookLock) e.stopImmediatePropagation(); }, true);
}
if (NDBG_ON) setTimeout(ndbgInit, 0);
