/* ==========================================================================
   ALLY MARKERS
   Recognizing an enemy at a glance is hard in a busy scene (Floralia: foliage, greenhouse, flowerbeds); the
   outfits of the two sides are no longer enough. Rather than highlighting enemies or touching up the models, it is the allies who
   signal themselves, as in most team shooters: a green chevron above the head, with the name up close. Any
   soldier without a marker is therefore an opponent, and the view of enemies stays natural (no outline, no glow).
   - The marker follows the head (projected on screen), keeps a readable size that shrinks with distance (up to 120 m) and fades
     out up close (under 6 m) so as not to get in the way of aiming.
   - An ally hidden behind scenery stays marked, paler: you know where your team is without seeing them. Visibility is
     tested about every 150 ms per ally (and only if on screen), the CSS fade smooths the changes.
   - Nothing in deathmatch (nobody is an ally), when scoped, in killcam, dead or outside a match. "Ally markers" setting (Game).
   - HUD elements (#allyMarks), one per ally, created on demand then reused; they are only written when their value changes
     (hudText, hudStyle) and move by transform. Called just before rendering: the camera then has its final position.
   ========================================================================== */
const AM = { els: [], root: null, shown: 0, range: 120, nameRange: 32 };
const _amP = new V3(), _amH = new V3(), _amC = new V3();

/* Elements of marker no. i (created on first request) */
function amEl(i) {
  if (!AM.root) AM.root = $('allyMarks');
  while (AM.els.length <= i) {
    const el = document.createElement('div'); el.className = 'am';
    el.innerHTML = '<b></b><svg viewBox="0 0 22 16" aria-hidden="true"><path d="M2.5 2.5h17L11 14z"/></svg>';
    AM.root.appendChild(el); AM.els.push({ el, nm: el.firstChild });
  }
  return AM.els[i];
}
function allyMarksHide() {
  if (!AM.shown) return;
  AM.shown = 0;
  for (const m of AM.els) hudStyle(m.el, 'opacity', '0');
}
function allyMarksUpdate() {
  const me = PL.ent;
  if (!Settings.allyMarks || MATCH.mode === 'ffa' || !me.alive || (MATCH.state !== 'playing' && MATCH.state !== 'paused') || $('scope').classList.contains('on')) return allyMarksHide();
  camera.updateMatrixWorld();
  const W = VIEW.w, H = VIEW.h, cp = camera.position;
  const now = performance.now();
  let n = 0;
  for (const o of entities) {
    if (o === me || !o.alive || o.off || !allied(o, me)) continue;
    const m = amEl(n++);
    entHead(o, _amH); _amH.y += 0.35; // above the head
    const d = _amH.distanceTo(cp);
    _amP.copy(_amH).project(camera);
    let a = 0;
    if (d > 0.5 && d < AM.range && _amP.z < 1 && Math.abs(_amP.x) < 1.04 && Math.abs(_amP.y) < 1.04) {
      // visibility (head, otherwise chest): tested at intervals, the value stays between two tests
      if (o.markT === undefined || now - o.markT > 150) { o.markT = now - Math.random() * 40; o.markVis = lineClear(cp, _amH) || (entChest(o, _amC), lineClear(cp, _amC)); }
      a = (o.markVis ? 0.9 : 0.42) * clamp((d - 3) / 3, 0, 1); // up close: it fades out
    }
    if (a <= 0) { hudStyle(m.el, 'opacity', '0'); continue; }
    const s = lerp(1, 0.62, clamp((d - 14) / 70, 0, 1)), px = Math.round((_amP.x * 0.5 + 0.5) * W), py = Math.round((-_amP.y * 0.5 + 0.5) * H);
    hudStyle(m.el, 'transform', `translate3d(${px}px,${py}px,0) translate(-50%,-100%) scale(${s.toFixed(2)})`);
    hudStyle(m.el, 'opacity', a.toFixed(2));
    hudText(m.nm, o.name);
    hudStyle(m.nm, 'opacity', clamp((AM.nameRange - d) / 8, 0, 1).toFixed(1)); // the name only shows up close
  }
  for (let i = n; i < AM.els.length; i++) hudStyle(AM.els[i].el, 'opacity', '0');
  AM.shown = n;
}
