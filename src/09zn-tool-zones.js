/* ==========================================================================
   ZONES TOOL (development tool)
   The game opened with ?tool=zones (https://localhost:8080/?tool=zones, &map=<id> to start on a map) shows a top-down plan
   of a map, with its mecha drop zones (MNAV.zones, green circles the size of the landing blast), its three domination points
   (MAP_DEFS.<id>.dom, gold circles A, B, C the size of the capture zone) and the spawns of both sides. Drag a zone
   with the mouse or a finger; with Mirror, its twin on the other side (x, -z) follows; drop zones can be added or removed. A drop
   zone where the mecha cannot land (roof, alley too narrow, under an awning) is crossed out in red; if the mecha lands a bit to the side,
   a line leads to the real point (mnavSnap, 08f-mecha.js); a domination point off walkable ground (on a roof, inside a building) is
   crossed out too. Copy configuration puts one line per edited map on the clipboard,
   "<id> mecha [[x, z], ...] dom [[x, z], [x, z], [x, z]]", to carry over into MAP_DEFS.<id>.mecha and .dom. Edits are kept in the
   browser from one visit to the next (OZ_KEY). Without ?tool=zones, nothing changes: TOOL is false for a player.
   ========================================================================== */
const TOOL = new URLSearchParams(location.search).get('tool') === 'zones';
const OZ_KEY = 'dc_tool_zones';
const OZ = { maps: {}, base: {}, id: null, sel: null, drag: null, mirror: true, plan: null, v: null, snap: new Map(), busy: false, msg: '' };
const ozRound = ([x, z]) => [Math.round(x * 2) / 2, Math.round(z * 2) / 2];
/* Once the game is ready (main menu displayed): the tool on top, then the requested map */
function ozStart() {
  if (!GPUX.booted || MATCH.state !== 'menu' || UI.busy) { setTimeout(ozStart, 300); return; }
  try { const s = JSON.parse(localStorage.getItem(OZ_KEY) || '{}'); for (const id in s) if (MAP_DEFS[id]) OZ.maps[id] = Object.assign(s[id], { edited: true }); } catch (e) { /* storage unavailable: start from the game's zones */ }
  ozBuild();
  const c = new URLSearchParams(location.search).get('map'), ok = MAPS.filter((m) => m.ok);
  ozMap(ok.some((m) => m.id === c) ? c : ok.some((m) => m.id === Settings.map) ? Settings.map : ok[0].id);
}
function ozBuild() {
  const el = document.createElement('div'); el.id = 'ozRoot';
  el.innerHTML = `<canvas id="ozCv"></canvas><aside>
    <b>${esc(_t('Map zones'))}</b>
    <select id="ozMap">${MAPS.filter((m) => m.ok).map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select>
    <p class="oz-leg"><i class="m"></i>${esc(_t('Mecha airdrop'))}<i class="d"></i>${esc(_t('Domination'))}</p>
    <p id="ozInfo"></p>
    <label><input type="checkbox" id="ozMir" checked>${esc(_t('Mirror'))}</label>
    <div class="oz-row"><button class="btn" id="ozAdd" type="button">${esc(_t('Add'))}</button><button class="btn" id="ozDel" type="button">${esc(_t('Delete'))}</button></div>
    <button class="btn" id="ozReset" type="button">${esc(_t('Undo my changes'))}</button>
    <button class="btn primary" id="ozCopy" type="button">${esc(_t('Copy the configuration'))}</button></aside>`;
  document.body.appendChild(el);
  const cv = $('ozCv');
  $('ozMap').addEventListener('change', (e) => ozMap(e.target.value));
  $('ozMir').addEventListener('change', (e) => { OZ.mirror = e.target.checked; });
  $('ozAdd').addEventListener('click', ozAdd); $('ozDel').addEventListener('click', ozDel);
  $('ozReset').addEventListener('click', ozReset); $('ozCopy').addEventListener('click', ozCopy);
  cv.addEventListener('pointerdown', ozDown); cv.addEventListener('pointermove', ozMove);
  cv.addEventListener('pointerup', () => { if (OZ.drag) { OZ.drag = null; ozSave(); ozDraw(); } });
  addEventListener('resize', () => ozDraw());
  addEventListener('keydown', (e) => { if (e.code === 'Delete' || e.code === 'Backspace') ozDel(); else if (e.code === 'Escape') { OZ.sel = null; ozDraw(); } });
}
/* Loads a map (as when starting a match, without the match): plan, mecha network and its zones */
async function ozMap(id) {
  OZ.busy = true; OZ.id = id; OZ.sel = null; OZ.drag = null; OZ.plan = null; OZ.snap.clear(); $('ozMap').value = id; ozDraw();
  try { await mapEnsure(id); } catch (e) { OZ.busy = false; OZ.msg = String(e); ozDraw(); return; }
  if (OZ.id !== id) return; // another map was chosen during loading
  const d = MAP_DEFS[id];
  OZ.plan = mapPlanPaint(TAC_S, 0, 0, false).c;
  OZ.base[id] = { mecha: (d.mecha || MNAV.zones.map((q) => [q.x, q.z])).map(ozRound), dom: (d.dom || []).map(ozRound) };
  if (!OZ.maps[id]) OZ.maps[id] = { mecha: OZ.base[id].mecha.map((p) => p.slice()), dom: OZ.base[id].dom.map((p) => p.slice()), edited: false };
  OZ.busy = false; OZ.msg = ''; ozDraw();
}
/* The zones of the displayed map, each with its kind (m: drop, d: domination) and its place in its list */
function ozItems() {
  const M = OZ.maps[OZ.id]; if (!M) return [];
  return M.mecha.map((p, i) => ({ k: 'm', i, p })).concat(M.dom.map((p, i) => ({ k: 'd', i, p })));
}
const ozSame = (a, b) => !!a && !!b && a.k === b.k && a.i === b.i;
/* Where the mecha will land for a zone placed at (x, z) (memoized: the computation casts rays) */
function ozSnap(p) {
  const key = p[0] + ',' + p[1];
  if (!OZ.snap.has(key)) OZ.snap.set(key, mnavSnap(p[0], p[1]));
  return OZ.snap.get(key);
}
function ozView() {
  const cv = $('ozCv'), W = cv.clientWidth, H = cv.clientHeight, MW = MAP.x1 - MAP.x0, MH = MAP.z1 - MAP.z0, s = Math.min((W - 16) / MW, (H - 16) / MH);
  return { W, H, s, ox: (W - MW * s) / 2, oy: (H - MH * s) / 2 };
}
const ozX = (x) => OZ.v.ox + (x - MAP.x0) * OZ.v.s, ozY = (z) => OZ.v.oy + (z - MAP.z0) * OZ.v.s;
function ozDraw() {
  const cv = $('ozCv'); if (!cv) return;
  const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#0b0d0c'; g.fillRect(0, 0, W, H);
  ozInfo();
  if (OZ.busy || !OZ.plan) { g.fillStyle = '#e6e2d6'; g.font = '600 18px "Barlow Condensed", sans-serif'; g.textAlign = 'center'; g.fillText(OZ.msg || _t('Loading the map'), W / 2, H / 2); g.textAlign = 'left'; return; }
  const v = OZ.v = ozView(), s = v.s;
  g.drawImage(OZ.plan, v.ox, v.oy, (MAP.x1 - MAP.x0) * s, (MAP.z1 - MAP.z0) * s);
  // place names, as on the tactical map
  g.font = '600 12px "Barlow Condensed", sans-serif'; g.textAlign = 'center';
  const done = new Set();
  for (const z of ZONES) {
    const key = z[0] + Math.sign(z[3] + z[4]); if (done.has(key)) continue; done.add(key);
    const x = ozX((z[1] + z[2]) / 2), y = ozY((z[3] + z[4]) / 2);
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillText(z[0], x + 1, y + 1); g.fillStyle = 'rgba(236,229,211,0.8)'; g.fillText(z[0], x, y);
  }
  // spawns: Alpha in blue, Bravo in red
  SPAWNS.forEach((L, t) => {
    g.fillStyle = t ? '#e4473b' : '#4aa3ff';
    for (const [x, z] of L) { g.beginPath(); g.arc(ozX(x), ozY(z), Math.max(2.5, 0.5 * s), 0, TAU); g.fill(); }
    const cx = L.reduce((a, p) => a + p[0], 0) / L.length, cz = L.reduce((a, p) => a + p[1], 0) / L.length;
    g.font = '700 14px "Barlow Condensed", sans-serif'; g.fillText(t ? 'Bravo' : 'Alpha', ozX(cx), ozY(cz) + (cz > 0 ? -12 : 20)); // (on the center side: the map edge does not cut it off)
  });
  // zones
  g.font = '700 15px "Barlow Condensed", sans-serif'; g.textBaseline = 'middle';
  for (const it of ozItems()) {
    const x = ozX(it.p[0]), y = ozY(it.p[1]), on = ozSame(it, OZ.sel), m = it.k === 'm';
    const R = (m ? MECHA_D.blast : DOM.rad) * s, col = m ? '143,209,106' : '244,190,58';
    let bad = !m && !ozGround(it.p);
    if (m) {
      const q = ozSnap(it.p);
      if (!q) bad = true;
      else if (hyp(q.x - it.p[0], q.z - it.p[1]) > 0.8) { // the mecha will land there
        g.strokeStyle = `rgba(${col},0.9)`; g.lineWidth = 2; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(x, y); g.lineTo(ozX(q.x), ozY(q.z)); g.stroke(); g.setLineDash([]);
        g.fillStyle = `rgb(${col})`; g.beginPath(); g.arc(ozX(q.x), ozY(q.z), 3.5, 0, TAU); g.fill();
      }
    }
    g.fillStyle = bad ? 'rgba(228,71,59,0.25)' : `rgba(${col},${on ? 0.35 : 0.2})`; g.strokeStyle = bad ? '#ff5a48' : `rgb(${col})`; g.lineWidth = on ? 3.5 : 2;
    g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill(); g.stroke();
    if (on) { g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, R + 3, 0, TAU); g.stroke(); }
    if (bad) { const d = R * 0.6; g.strokeStyle = '#ff5a48'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - d, y - d); g.lineTo(x + d, y + d); g.moveTo(x + d, y - d); g.lineTo(x - d, y + d); g.stroke(); }
    g.fillStyle = '#fff'; g.fillText(m ? String(it.i + 1) : DOM.names[it.i], x, y);
  }
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
}
/* A domination point is placed on the walkable ground under it (domInit): within 1.5 m, otherwise it would fall into a building */
function ozGround(p) { const id = navNode(p[0], gy0(p[0], p[1]), p[1]); return id >= 0 && hyp(NAV.nx[id] - p[0], NAV.nz[id] - p[1]) < 1.5; }
/* Panel: the chosen zone (position, distance to the spawns, where the mecha lands), or the instructions */
function ozInfo() {
  const el = $('ozInfo'), it = OZ.sel; $('ozDel').disabled = !it || it.k !== 'm';
  let t = OZ.msg && !OZ.busy ? OZ.msg : '';
  if (!t && it && OZ.maps[OZ.id]) {
    const p = it.p, far = (L) => Math.round(Math.min(...L.map(([x, z]) => hyp(x - p[0], z - p[1]))));
    t = (it.k === 'm' ? _t('Drop {0}', it.i + 1) : _t('Domination {0}', DOM.names[it.i])) + ` (${p[0]}, ${p[1]}). ` + _t('Alpha {0} m away, Bravo {1} m away.', far(SPAWNS[0]), far(SPAWNS[1]));
    if (it.k === 'd' && !ozGround(p)) t += ' ' + _t('No walkable ground under this point.');
    if (it.k === 'm') { const q = ozSnap(p); t += ' ' + (!q ? _t('The mecha cannot land here.') : hyp(q.x - p[0], q.z - p[1]) > 0.8 ? _t('The mecha will land {0} m away.', Math.round(hyp(q.x - p[0], q.z - p[1]))) : ''); }
  }
  if (!t) t = _t('Drag a zone to move it.');
  el.textContent = t;
}
/* Finger or mouse: the nearest zone under the pointer (inside its circle, or within 22 pixels of its center) is picked up and follows */
function ozDown(e) {
  if (OZ.busy || !OZ.v) return;
  const r = $('ozCv').getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
  let best = null, bd = 1e9;
  for (const it of ozItems()) {
    const d = hyp(ozX(it.p[0]) - px, ozY(it.p[1]) - py), R = Math.max(22, (it.k === 'm' ? MECHA_D.blast : DOM.rad) * OZ.v.s);
    if (d < R && d < bd) { bd = d; best = it; }
  }
  OZ.sel = best; OZ.msg = '';
  if (best) {
    // the twin: the opposite domination point (A and C), or the drop zone that mirrors this one
    let twin = null;
    if (OZ.mirror && Math.abs(best.p[1]) > 1.5) {
      if (best.k === 'd') { const j = 2 - best.i; if (j !== best.i) twin = { k: 'd', i: j, p: OZ.maps[OZ.id].dom[j] }; }
      else for (const it of ozItems()) if (it.k === 'm' && it.i !== best.i && hyp(it.p[0] - best.p[0], it.p[1] + best.p[1]) < 3) twin = it;
    }
    OZ.drag = { it: best, twin, dx: best.p[0] - ((px - OZ.v.ox) / OZ.v.s + MAP.x0), dz: best.p[1] - ((py - OZ.v.oy) / OZ.v.s + MAP.z0) }; // (the grab point stays under the finger)
    $('ozCv').setPointerCapture(e.pointerId);
  }
  ozDraw();
}
function ozMove(e) {
  const D = OZ.drag; if (!D) return;
  const r = $('ozCv').getBoundingClientRect(), x = (e.clientX - r.left - OZ.v.ox) / OZ.v.s + MAP.x0 + D.dx, z = (e.clientY - r.top - OZ.v.oy) / OZ.v.s + MAP.z0 + D.dz;
  const p = ozRound([clamp(x, MAP.x0 + 1, MAP.x1 - 1), clamp(z, MAP.z0 + 1, MAP.z1 - 1)]);
  D.it.p[0] = p[0]; D.it.p[1] = p[1];
  if (D.twin) { D.twin.p[0] = p[0]; D.twin.p[1] = -p[1]; }
  OZ.maps[OZ.id].edited = true; ozDraw();
}
/* Add: a drop zone in the middle of the map (with Mirror, a pair on either side) */
function ozAdd() {
  const M = OZ.maps[OZ.id]; if (!M || OZ.busy) return;
  const x = Math.round((MAP.x0 + MAP.x1) / 2);
  if (OZ.mirror) M.mecha.push([x, 10], [x, -10]); else M.mecha.push([x, 0]);
  OZ.sel = { k: 'm', i: M.mecha.length - 1, p: M.mecha[M.mecha.length - 1] }; M.edited = true; ozSave(); ozDraw();
}
function ozDel() {
  const M = OZ.maps[OZ.id], it = OZ.sel; if (!M || !it || it.k !== 'm') return;
  M.mecha.splice(it.i, 1); OZ.sel = null; M.edited = true; ozSave(); ozDraw();
}
/* Cancel edits: the map goes back to the game's zones */
function ozReset() {
  const B = OZ.base[OZ.id]; if (!B) return;
  OZ.maps[OZ.id] = { mecha: B.mecha.map((p) => p.slice()), dom: B.dom.map((p) => p.slice()), edited: false }; OZ.sel = null; ozSave(); ozDraw();
}
function ozSave() {
  const o = {}; for (const id in OZ.maps) if (OZ.maps[id].edited) o[id] = { mecha: OZ.maps[id].mecha, dom: OZ.maps[id].dom };
  try { localStorage.setItem(OZ_KEY, JSON.stringify(o)); } catch (e) { /* storage unavailable: edits last for the life of the page */ }
}
/* The text to send back: the edited maps (at least the displayed one) */
function ozText() {
  const f = (L) => '[' + L.map(([x, z]) => `[${x}, ${z}]`).join(', ') + ']';
  return Object.keys(OZ.maps).filter((id) => OZ.maps[id].edited || id === OZ.id).map((id) => `${id} mecha ${f(OZ.maps[id].mecha)} dom ${f(OZ.maps[id].dom)}`).join('\n');
}
function ozCopy() {
  const t = ozText();
  const done = () => { OZ.msg = _t('Configuration copied.'); ozDraw(); };
  const fail = () => { window.prompt(_t('Copy this text'), t); }; // clipboard refused (insecure page, old browser)
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, fail); else fail();
}
if (TOOL) setTimeout(ozStart, 500);
