/* ==========================================================================
   HELD-KNIFE TUNING BENCH (development tool, README "Knife in hand")
   The game opens with ?knife=1 (https://localhost:8080/?knife=1): a panel on the left tunes live, in the real first-person view, the pose of the arm, the
   knife in the hand, the fingers and the stroke. Start a solo match, draw the knife (hold F or the panel button), and each slider takes effect immediately.
   - Game: play normally (walk, run, stab for real). Rest, Run and Stab force the pose, even when standing still: the stride can be frozen or played, the stab
     frozen at one instant or replayed in a loop (bare-handed: the original stab, without the held pose).
   - Copy: the whole configuration as one text (KNIFE_HELD, KNIFE_STAB and HAND_POSES.kgrip), to paste into the conversation; Apply: the reverse. The configuration is kept in the
     browser (localStorage, dc_knife) while the panel is open, "Reset all" goes back to the one in the code.
   - The mouse stays free (LOCK.fallback): the panel stops the events it receives, the game neither turns nor fires when a slider is touched. "Lock view" freezes
     the gaze outside the panel.
   The code does nothing without ?knife=1: the panel, its events and the KNIFE_DEBUG hook (06c-models.js, 08-player.js) do not exist for a player.
   ========================================================================== */
const KDBG_ON = /[?&]knife=1(&|$)/.test(location.search);
const KDBG = { mode: 'inGame', anim: true, ph: 0, t: 0.34, loop: true, bare: false, clock: 0, god: true, bots: null, lookLock: false, def: null, el: null, rows: [], ta: null, msg: null };

/* The settings: [path, label, min, max, step]; 'bool' in place of min: a checkbox. Path: H = KNIFE_HELD, G = HAND_POSES.kgrip, K = KNIFE_STAB, then the keys (a number: an array index) */
/* The settings of a full pose: P the arm path (wrist, roll, flexion, elbow, shoulder), GR the knife grip's, FG the fingers'; the same ones twice, for the held
   pose (H, H.grip, G) and for the start and end of the stab (K.start, K.start.grip, K.start.fingers...). The last element of a thumb section says where to put the starting poses. */
function kdbgPoseSpec(label, P, GR, FG, held) {
  const f = (path, lab, mn, mx, st) => [path, lab, mn, mx, st];
  return [
    [`${label}arm (the wrist is in meters, camera frame)`, [
      f(`${P}.pos.0`, 'wrist x (right)', -0.6, 0.6, 0.005), f(`${P}.pos.1`, 'wrist y (up)', -0.6, 0.4, 0.005), f(`${P}.pos.2`, 'wrist z (far: negative)', -0.9, -0.1, 0.005),
      f(`${P}.roll`, 'forearm roll (-1.57: thumb up)', -3.2, 3.2, 0.02), f(`${P}.flex`, 'wrist flexion (rad)', -1.2, 1.2, 0.02),
      f(`${P}.pole.0`, 'elbow x', -2, 2, 0.05), f(`${P}.pole.1`, 'elbow y (down: negative)', -2, 2, 0.05), f(`${P}.pole.2`, 'elbow z', -2, 2, 0.05),
      f(`${P}.S.0`, 'shoulder x', -0.8, 0.8, 0.01), f(`${P}.S.1`, 'shoulder y', -0.8, 0.4, 0.01), f(`${P}.S.2`, 'shoulder z', -0.2, 0.8, 0.01),
    ]],
    [`${label}knife in hand (degrees; hand frame: x pinky, y back of hand, z elbow)`, [
      ...(held ? [[`${GR}.flip`, 'reversed grip (blade on pinky side)', 'bool']] : []), f(`${GR}.phi`, 'angle in the palm (y axis)', -180, 180, 1),
      f(`${GR}.pitch`, 'pitch across the fist (x axis)', -180, 180, 1), f(`${GR}.tilt`, 'tilt around the forearm (z)', -180, 180, 1), f(`${GR}.roll`, 'spin around the handle', -180, 180, 1),
      f(`${GR}.mid.0`, 'handle midpoint x', -0.08, 0.08, 0.001), f(`${GR}.mid.1`, 'handle midpoint y (palm: negative)', -0.08, 0.08, 0.001), f(`${GR}.mid.2`, 'handle midpoint z (fingers: negative)', -0.08, 0.08, 0.001),
    ]],
    [`${label}fingers (flexion in rad: base, middle, tip; 0 straight)`, [
      ...[['i', 'index'], ['m', 'middle'], ['r', 'ring'], ['p', 'pinky']].flatMap(([k, n]) => [['base', 0], ['mid', 1], ['tip', 2]].map(([b, j]) => f(`${FG}.${k}.${j}`, `${n} ${b}`, 0, 1.9, 0.01))),
      f(`${FG}.spread`, 'finger spread', 0, 0.3, 0.005),
    ]],
    [`${label}thumb (rad; the base pivots in eight directions, from most natural to freest)`, [
      f(`${FG}.t.0`, 'thumb middle: flexion', -3, 3, 0.01), f(`${FG}.t.1`, 'thumb tip: flexion', -3, 3, 0.01),
      f(`${FG}.t.2`, 'base: toward the little finger', -3, 3, 0.01), f(`${FG}.t.3`, 'base: spread away from the palm', -3, 3, 0.01), f(`${FG}.t.4`, 'base: spin on its own axis (the nail)', -3, 3, 0.01),
      f(`${FG}.t.5`, 'base: pivot on x (across)', -3.2, 3.2, 0.02), f(`${FG}.t.6`, 'base: pivot on y (back of hand)', -3.2, 3.2, 0.02), f(`${FG}.t.7`, 'base: pivot on z (forearm)', -3.2, 3.2, 0.02),
    ], FG],
  ];
}
const KDBG_SPEC = [
  ...kdbgPoseSpec('Held pose: ', 'H', 'H.grip', 'G', true),
  ['Stab: timing and trajectory (from the held pose to the start, from the start to the end, then back)', [
    ['K.tStart', 'start reached at (0 to 1 of the stab duration)', 0.02, 0.6, 0.01], ['K.tEnd', 'end reached at', 0.1, 0.95, 0.01], ['K.ease', 'sweep: 0 constant, 1 smooth at start and end', 0, 1, 0.05],
    ['K.arc.0', 'detour at the middle of the sweep x', -0.3, 0.3, 0.005], ['K.arc.1', 'detour at the middle of the sweep y', -0.3, 0.3, 0.005], ['K.arc.2', 'detour at the middle of the sweep z', -0.3, 0.3, 0.005],
    ['K.low.0', 'no knife in hand: the hand rises from below, x', -0.6, 0.6, 0.01], ['K.low.1', 'rises from below, y', -0.8, 0.2, 0.01], ['K.low.2', 'rises from below, z', -0.6, 0.2, 0.01],
    ['K.rise.0', 'rise: start (0 to 1)', 0, 1, 0.01], ['K.rise.1', 'rise: end', 0, 1, 0.01], ['K.fall.0', 'drop: start', 0, 1, 0.01], ['K.fall.1', 'drop: end', 0, 1, 0.01],
  ]],
  ...kdbgPoseSpec('Stab start: ', 'K.start', 'K.start.grip', 'K.start.fingers', false),
  ...kdbgPoseSpec('Stab end: ', 'K.end', 'K.end.grip', 'K.end.fingers', false),
  ['Run (offset at full sprint, then stride amplitude)', [
    ['H.run.pos.0', 'offset x', -0.3, 0.3, 0.005], ['H.run.pos.1', 'offset y', -0.3, 0.3, 0.005], ['H.run.pos.2', 'offset z', -0.3, 0.3, 0.005],
    ['H.run.roll', 'roll', -1.5, 1.5, 0.02], ['H.run.flex', 'flexion', -1, 1, 0.02],
    ['H.run.amp.0', 'stride: lateral back-and-forth', 0, 0.1, 0.002], ['H.run.amp.1', 'stride: dip of each step', 0, 0.1, 0.002], ['H.run.amp.2', 'stride: the pumping arm', 0, 0.1, 0.002],
    ['H.run.wristRoll', 'stride: wrist roll', 0, 0.5, 0.01], ['H.run.flexAmp', 'stride: wrist flexion', 0, 0.5, 0.01], ['H.run.phase', 'stride phase (rad)', -3.2, 3.2, 0.05],
  ]],
];

/* Thumb starting poses (the eight angles of HAND_POSES.kgrip.t): pick one, then refine with the sliders */
const KDBG_THUMBS = [
  ['Hidden behind the handle', [0.8, 0.9, 0.5, -0.2, -1.2, 0, 0, 0]], ['Resting on the handle, toward the guard', [0.2, 0.3, 0.2, 0.5, 0, 0, 0, 0]],
  ['Over the fist', [0.35, 0.5, 0.9, 0.55, -0.9, 0, 0, 0.8]], ['Rifle thumb (across)', [0.35, 0.5, 0.9, 0.55, -0.9, 0, 0, 0]],
];
/* The held pose in the form of a stab pose (to copy the held pose into the start or the end) */
function kdbgHeldPose() {
  const H = JSON.parse(JSON.stringify(KNIFE_HELD)), G = JSON.parse(JSON.stringify(HAND_POSES.kgrip));
  return { pos: H.pos, roll: H.roll, flex: H.flex, pole: H.pole, S: H.S, grip: { phi: H.grip.phi, tilt: H.grip.tilt, pitch: H.grip.pitch, roll: H.grip.roll, mid: H.grip.mid }, fingers: G };
}
function kdbgRef(path) { // 'H.pos.0' : [array or object, key]
  const k = path.split('.'); let o = k[0] === 'H' ? KNIFE_HELD : k[0] === 'K' ? KNIFE_STAB : HAND_POSES.kgrip;
  for (let i = 1; i < k.length - 1; i++) o = o[k[i]];
  return [o, k[k.length - 1]];
}
function kdbgGet(path) { const [o, k] = kdbgRef(path); return o[k]; }
function kdbgSet(path, v) { const [o, k] = kdbgRef(path); o[k] = v; if (path.startsWith('H.grip')) knifeGripSet(); kdbgSave(); }
const kdbgSnap = () => JSON.parse(JSON.stringify({ KNIFE_HELD, KNIFE_STAB, kgrip: HAND_POSES.kgrip }));
/* the copied text: one line per set, numbers to four decimals */
function kdbgText() {
  const s = kdbgSnap(), f = (v) => JSON.stringify(v, (k, x) => (typeof x === 'number' ? +x.toFixed(4) : x));
  return `{\n"KNIFE_HELD": ${f(s.KNIFE_HELD)},\n"KNIFE_STAB": ${f(s.KNIFE_STAB)},\n"kgrip": ${f(s.kgrip)}\n}`;
}
/* copies into dst the values of src for the keys that dst knows, of the same type (nothing else gets in) */
function kdbgMerge(dst, src) {
  if (!src || typeof src !== 'object') return;
  for (const k of Object.keys(dst)) {
    if (!(k in src)) continue;
    const a = dst[k], b = src[k];
    if (Array.isArray(a)) { if (Array.isArray(b)) for (let i = 0; i < a.length; i++) { if (Array.isArray(a[i])) { if (Array.isArray(b[i])) for (let j = 0; j < a[i].length; j++) if (Number.isFinite(b[i][j])) a[i][j] = b[i][j]; } else if (Number.isFinite(b[i])) a[i] = b[i]; } }
    else if (a && typeof a === 'object') kdbgMerge(a, b);
    else if (typeof a === 'number') { if (Number.isFinite(b)) dst[k] = b; }
    else if (typeof a === 'boolean') dst[k] = !!b;
  }
}
function kdbgLoad(text) {
  const c = JSON.parse(text);
  kdbgMerge(KNIFE_HELD, c.KNIFE_HELD); kdbgMerge(KNIFE_STAB, c.KNIFE_STAB); kdbgMerge(HAND_POSES.kgrip, c.kgrip); knifeGripSet(); kdbgRefresh(); kdbgSave();
}
function kdbgSave() { try { localStorage.setItem('dc_knife', kdbgText()); } catch (e) { /* storage refused: the configuration does not survive a reload */ } }
function kdbgSay(t) { if (KDBG.msg) KDBG.msg.textContent = t; }

/* What the panel forces in the hand state (called by updatePlayer, 08-player.js, just before updateRigs) */
function kdbgFilter(S, dt) {
  const K = KDBG;
  if (K.god) PL.ent.health = 100;
  if (K.lookLock) { mouseDX = 0; mouseDY = 0; }
  if (K.mode === 'inGame' || !PL.ent.alive) return;
  if (!PL.knifeOut) knifeDraw();
  S.nadeState = null; S.knifeHold = K.bare && K.mode === 'blow' ? 0 : 1; S.knifeNew = true; VM.lowerTarget = 1; // the tuned stab is the one with the knife in hand
  const still = () => { VM.bobAmt = 0; VM.bobO.set(0, 0, 0); VM.bobR.set(0, 0, 0); };
  if (K.mode === 'rest') { S.knifeT = 0; S.sprint = 0; still(); }
  else if (K.mode === 'run') {
    S.knifeT = 0; S.sprint = 1; VM.bobAmt = 1.2;
    if (K.anim) K.ph = (K.ph + dt * 9) % TAU; else { VM.bobO.set(0, 0, 0); VM.bobR.set(0, 0, 0); }
    VM.bobT = K.ph;
    if (K.phEl) K.phEl.value = K.ph;
  } else if (K.mode === 'blow') {
    S.sprint = 0; still();
    let t = K.t;
    if (K.loop) { K.clock = (K.clock + dt) % (KNIFE_DUR + 0.7); t = K.clock / KNIFE_DUR; if (K.tEl) K.tEl.value = Math.min(1, t); }
    S.knifeT = t >= 0 && t <= 1 ? Math.max(0.0001, KNIFE_DUR * (1 - t)) : 0;
  }
}

function kdbgRefresh() {
  for (const r of KDBG.rows) { const v = kdbgGet(r.path); if (r.bool) r.input.checked = !!v; else { r.input.value = v; r.num.value = +v.toFixed(4); } }
}
function kdbgInit() {
  if (KDBG.el) return;
  KDBG.def = kdbgSnap();
  LOCK.fallback = true; showLockPrompt(false); // the mouse stays free: we touch sliders
  try { const s = localStorage.getItem('dc_knife'); if (s) kdbgLoad(s); } catch (e) { /* stored configuration unreadable: use the code's one */ }
  KNIFE_DEBUG = kdbgFilter;
  const css = document.createElement('style');
  css.textContent = `#kdbg{position:fixed;left:0;top:0;bottom:0;width:420px;z-index:100000;overflow:auto;background:rgba(8,10,8,.86);color:#e8e8e0;font:11px/1.35 monospace;padding:6px 8px;box-sizing:border-box}
#kdbg.right{left:auto;right:0}#kdbg.min{bottom:auto;overflow:hidden;width:230px}#kdbg.min .body{display:none}
#kdbg h1{font:700 12px monospace;margin:0 0 4px;cursor:pointer}#kdbg details{margin:5px 0;border-top:1px solid #444;padding-top:3px}#kdbg summary{cursor:pointer;font-weight:700;color:#ffd24a}
#kdbg .row{display:grid;grid-template-columns:208px 1fr 58px;gap:4px;align-items:center;margin:1px 0}#kdbg .row label{cursor:pointer;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
#kdbg .row input[type=range]{width:100%;margin:0}#kdbg .row input[type=number]{width:58px;background:#222;color:#eee;border:1px solid #555;font:11px monospace}
#kdbg button{background:#333;color:#eee;border:1px solid #666;margin:1px 2px 1px 0;padding:2px 6px;font:11px monospace;cursor:pointer}#kdbg button.on{background:#ffd24a;color:#111}
#kdbg textarea{width:100%;height:96px;background:#111;color:#cfc;border:1px solid #555;font:10px monospace;box-sizing:border-box}`;
  document.head.appendChild(css);
  const el = KDBG.el = document.createElement('div'); el.id = 'kdbg';
  // the game must receive nothing of what is done in the panel
  for (const t of ['mousedown', 'mouseup', 'mousemove', 'keydown', 'keyup', 'wheel', 'contextmenu', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'click', 'dblclick']) el.addEventListener(t, (e) => e.stopPropagation());
  const h = document.createElement('h1'); h.textContent = 'Knife tuning bench (click: collapse)'; h.onclick = () => el.classList.toggle('min'); el.appendChild(h);
  const body = document.createElement('div'); body.className = 'body'; el.appendChild(body);
  const mk = (tag, o = {}, kids = []) => { const e = document.createElement(tag); Object.assign(e, o); for (const k of kids) e.appendChild(k); return e; };
  const btn = (txt, fn, cls) => { const b = mk('button', { textContent: txt, onclick: fn }); if (cls) b.className = cls; return b; };
  // modes
  const modes = [['inGame', 'Game'], ['rest', 'Rest'], ['run', 'Run'], ['blow', 'Stab']], mb = {};
  const setMode = (m) => { KDBG.mode = m; for (const k in mb) mb[k].classList.toggle('on', k === m); };
  const mrow = mk('div');
  for (const [m, n] of modes) { mb[m] = btn(n, () => setMode(m)); mrow.appendChild(mb[m]); }
  body.appendChild(mrow); setMode('inGame');
  const chk = (txt, key, fn) => { const c = mk('input', { type: 'checkbox', checked: !!KDBG[key], onchange: () => { KDBG[key] = c.checked; if (fn) fn(); } }), lb = mk('label', {}, [c, document.createTextNode(' ' + txt + ' ')]); lb.cb = c; return lb; };
  const rng = (txt, key, max, step, ref) => { const r = mk('input', { type: 'range', min: 0, max, step, value: KDBG[key], oninput: () => { KDBG[key] = +r.value; if (key === 'ph') { KDBG.anim = false; a.cb.checked = false; } if (key === 't') { KDBG.loop = false; l.cb.checked = false; } } }); KDBG[ref] = r; return [mk('div', { textContent: txt }), r]; };
  const a = chk('animated', 'anim'), l = chk('loop', 'loop');
  const [t1, r1] = rng('Run: stride (rad)', 'ph', 6.3, 0.05, 'phEl'), [t2, r2] = rng('Stab: moment (0 armed, 1 back)', 't', 1, 0.01, 'tEl');
  const keyRow = mk('div'), see = (txt, get) => btn(txt, () => { setMode('blow'); KDBG.loop = false; l.cb.checked = false; KDBG.t = get(); r2.value = KDBG.t; });
  keyRow.append(see('See the start', () => KNIFE_STAB.tStart), see('See the contact', () => KNIFE_HIT), see('See the end', () => KNIFE_STAB.tEnd));
  body.append(t1, r1, a, t2, r2, l, chk('bare-handed (the hand rises from below)', 'bare'), keyRow);
  // tools
  const tools = mk('div', { style: 'margin-top:4px' });
  tools.append(
    btn('Draw / stow the knife', () => { if (PL.knifeOut) knifeStow(PL.cur); else knifeDraw(); }),
    btn('Freeze bots', function () { if (KDBG.bots) { botsTick = KDBG.bots; KDBG.bots = null; } else { KDBG.bots = botsTick; botsTick = () => {}; } this.classList.toggle('on', !!KDBG.bots); }),
    btn('Hide HUD', function () { const hud = $('hud'); hud.style.display = hud.style.display === 'none' ? '' : 'none'; this.classList.toggle('on', hud.style.display === 'none'); }),
    btn('Lock view', function () { KDBG.lookLock = !KDBG.lookLock; this.classList.toggle('on', KDBG.lookLock); }),
    btn('Panel right / left', () => el.classList.toggle('right')), // the start of the stab plays on the left, its end on the right: the panel goes to the other side
    btn('Give control back to the game', () => { if (document.activeElement) document.activeElement.blur(); }),
    btn('Grenade and throwing knife bench', () => { location.search = '?grenade=1'; }), // (?grenade=1, 09zj-grenade-tuning.js)
    chk('invincible', 'god'));
  body.appendChild(tools);
  // settings
  for (const [title, list, thumbRoot] of KDBG_SPEC) {
    const d = mk('details', { open: /^Held pose: (arm|knife|thumb)|^Stab: timing/.test(title) }, [mk('summary', { textContent: title })]);
    for (const [path, label, min, max, step] of list) {
      const def = kdbgGet(path), row = mk('div', { className: 'row' });
      const lab = mk('label', { textContent: label, title: label + ' (click: code value)' });
      if (min === 'bool') {
        const input = mk('input', { type: 'checkbox', checked: !!def, onchange: () => kdbgSet(path, input.checked) });
        lab.onclick = () => { kdbgSet(path, !!kdbgDefault(path)); kdbgRefresh(); };
        row.append(lab, input, mk('span')); KDBG.rows.push({ path, input, bool: true });
      } else {
        const input = mk('input', { type: 'range', min, max, step, value: def }), num = mk('input', { type: 'number', min, max, step, value: +def.toFixed(4) });
        input.oninput = () => { kdbgSet(path, +input.value); num.value = +(+input.value).toFixed(4); };
        num.onchange = () => { if (!Number.isFinite(+num.value)) return; kdbgSet(path, +num.value); input.value = num.value; };
        lab.onclick = () => { kdbgSet(path, kdbgDefault(path)); kdbgRefresh(); };
        row.append(lab, input, num); KDBG.rows.push({ path, input, num });
      }
      d.appendChild(row);
    }
    if (thumbRoot) {
      const pr = mk('div');
      for (const [n, t] of KDBG_THUMBS) pr.appendChild(btn(n, () => { for (let j = 0; j < 8; j++) kdbgSet(`${thumbRoot}.t.${j}`, t[j]); kdbgRefresh(); }));
      d.insertBefore(pr, d.children[1]);
    }
    if (title.startsWith('Stab: timing')) { // copy one pose into another: start from the held pose, or from the other end of the stab
      const cp = mk('div'), put = (to, from) => () => { kdbgMerge(KNIFE_STAB[to], from()); kdbgRefresh(); kdbgSave(); };
      cp.append(btn('Start: take the held pose', put('start', kdbgHeldPose)), btn('End: take the held pose', put('end', kdbgHeldPose)),
        btn('End: take the start', put('end', () => JSON.parse(JSON.stringify(KNIFE_STAB.start)))), btn('Start: take the end', put('start', () => JSON.parse(JSON.stringify(KNIFE_STAB.end)))));
      d.insertBefore(cp, d.children[1]);
    }
    body.appendChild(d);
  }
  // configuration: copy, apply, reset all
  const cfg = mk('details', { open: true }, [mk('summary', { textContent: 'Configuration (paste into the conversation)' })]);
  const ta = KDBG.ta = mk('textarea', { spellcheck: false }); KDBG.msg = mk('div');
  cfg.append(ta, btn('Copy', async () => {
    const t = kdbgText(); ta.value = t; ta.select(); let ok = false;
    try { await navigator.clipboard.writeText(t); ok = true; } catch (e) { try { ok = document.execCommand('copy'); } catch (e2) { ok = false; } }
    kdbgSay(ok ? 'Copied to clipboard.' : 'Text selected above: Ctrl+C.');
  }), btn('Apply text', () => { try { kdbgLoad(ta.value); kdbgSay('Applied.'); } catch (e) { kdbgSay('Unreadable text: ' + e.message); } }),
  btn('Reset all', () => { kdbgLoad(JSON.stringify(KDBG.def)); ta.value = ''; kdbgSay('Code configuration restored.'); }), KDBG.msg);
  body.appendChild(cfg);
  document.body.appendChild(el);
  kdbgRefresh();
  // view locked: the gaze no longer follows the mouse, which leaves the hand free to touch the panel without taking your eyes off the scene
  addEventListener('mousemove', (e) => { if (KDBG.lookLock) e.stopImmediatePropagation(); }, true);
}
function kdbgDefault(path) { let v = KDBG.def; const k = path.split('.'); v = k[0] === 'H' ? v.KNIFE_HELD : k[0] === 'K' ? v.KNIFE_STAB : v.kgrip; for (let i = 1; i < k.length; i++) v = v[k[i]]; return v; }
if (KDBG_ON) setTimeout(kdbgInit, 0);
