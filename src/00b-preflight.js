/* ==========================================================================
   STARTUP CHECK
   The sources are a single script: if three.js failed to download or if the browser refuses to create the WebGL context (01-core.js), the script stops
   silently and the screen stays on "Loading three.js", without a word. A Pixel ended up there right after a 3D display interruption: Chrome
   then blocks the creation of a context for the site ("Web page caused context loss and was blocked") and, according to the Chromium code (per-domain blocking of the 3D
   APIs, with no expiry), only lifts it at its own restart: reloads and waiting do nothing, Chrome has to be stopped. This module runs before everything else:
   - three.js missing: message and retry (reload);
   - WebGL context impossible to create: message telling to stop Chrome, retry every 3 s anyway (a block on all sites, by contrast, lasts
     a few seconds), the page reloads as soon as possible;
   - startup that hasn't succeeded after 25 s (outside the install window): message with the first error of the page and a button to reload.
   Everything logged also goes into the chronological log of the graphics report (dc_gpu_tl, see 01a-gpu.js).
   ========================================================================== */
const PRE = { err: [], booted: false, blocked: false };
/* Departure wanted by the game (reload after a context loss, update): the in-match exit confirmation is not shown (09-game.js) */
const PAGE_LEAVE = { ok: false };
addEventListener('error', (e) => { if (PRE.err.length < 3) PRE.err.push(String((e && e.message) || 'error') + (e && e.filename ? ' @' + String(e.filename).split('/').pop() + ':' + e.lineno : '')); });
function preLog(m) {
  try { const k = 'dc_gpu_tl', v = JSON.parse(localStorage.getItem(k) || '[]'); v.push([Date.now(), 'pre', String(m).slice(0, 90)]); localStorage.setItem(k, JSON.stringify(v.slice(-70))); } catch (e) { /* ignored */ }
}
/* Attempt to create a WebGL 2 context on a throwaway canvas, released right away (attrs: the attributes requested by the game, see 01-core.js) */
function preGlTest(attrs) {
  let ok = false, why = '';
  try {
    const c = document.createElement('canvas');
    c.addEventListener('webglcontextcreationerror', (e) => { why = (e && e.statusMessage) || ''; });
    const gl = c.getContext('webgl2', attrs);
    ok = !!gl && !gl.isContextLost() && !!gl.getParameter(gl.VERSION);
    if (!ok && !why) why = gl ? 'context lost at creation' : 'no context';
    if (gl) { const x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); }
  } catch (e) { why = String((e && e.message) || e); }
  return { ok, why };
}
(function preflight() {
  const msg = document.getElementById('loadMsg'); if (!msg) return;
  const say = (t) => { msg.textContent = t; };
  if (typeof THREE === 'undefined') {
    preLog('three.js not loaded'); say(_t('three.js could not be downloaded. Check your connection. Trying again in a few seconds.'));
    setTimeout(() => location.reload(), 5000); return;
  }
  const r = preGlTest();
  if (!r.ok) {
    preLog('WebGL unavailable at start: ' + r.why); PRE.blocked = true;
    const t0 = Date.now(), show = (why) => say(_t('Chrome blocked the game\u0027s 3D display after an interruption and only gives it back when it restarts. Close the game, stop Chrome (phone Settings, Apps, Chrome, Force stop), then reopen the game.') + ' ' + _t('Waiting: {0} s', Math.round((Date.now() - t0) / 1000)) + (why ? ' (' + why + ')' : ''));
    show(r.why);
    const tick = () => {
      const t = preGlTest();
      if (t.ok) { preLog('WebGL available again after ' + Math.round((Date.now() - t0) / 1000) + ' s: reload'); location.reload(); return; }
      show(t.why); setTimeout(tick, 3000);
    };
    setTimeout(tick, 3000);
  }
  // startup that doesn't succeed, for another reason (a script error, for example)
  setTimeout(() => {
    let gate = false; try { gate = !!PWA.gate; } catch (e) { /* the script stopped before PWA */ }
    if (PRE.booted || PRE.blocked || gate || !document.getElementById('loading') || document.getElementById('loading').classList.contains('hidden')) return;
    // the error of a script from another site (three.js) arrives without detail ("Script error."): we retry creating the context with the game's attributes
    const a = preGlTest({ powerPreference: 'high-performance', antialias: false, stencil: false });
    const why = (PRE.err[0] || '?') + (a.ok ? '' : ' ; WebGL: ' + a.why); preLog('startup stuck: ' + why);
    say(_t('Startup did not complete: {0}', why));
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn primary'; b.textContent = _t('Reload');
    b.onclick = () => location.reload(); msg.parentNode.insertBefore(b, msg.nextSibling);
  }, window.__PRE_WATCH || 25000);
})();
