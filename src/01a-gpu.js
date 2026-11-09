/* ==========================================================================
   GPU: HARDENING AND GRAPHICS REPORT
   On some phones (Pixel 10 Pro, PowerVR chip), the driver interrupts the WebGL context during shader compilation or texture
   generation: three.js crashes ("reading 'trim'", it reads the log of a program the driver took back) or the game resumes
   with black textures (those generated on the GPU do not survive the context loss). It is not reproducible off the
   device: this module prevents what it can and can tell what happened.
   - program logs are no longer null (that was what crashed three.js); a map's shader compilation is done in
     small groups, handing control back to the browser between each, with progress (gpuCompileScene); a program rejected by the driver is
     recorded (gpuCheckPrograms), not ignored;
   - context lost while the game is displayed: the game switches by itself to economy graphics mode (Settings.gfxSafe, see 01-core.js)
     and offers to relaunch (#gpuLost); lost in the background: it only offers to relaunch;
   - graphics report (gpuReport): driver, limits, extensions, render tests, latest errors (in English: technical, meant to be
     forwarded as is); reachable through ?diag, through Options
     (Video) and through the map load failure screen. See README, "Mobile version".
   ========================================================================== */
const GPUX = { lost: 0, restored: 0, lostVisible: true, lostPhase: '', armed: false, bad: [], errs: [], slow: [], culprits: [], badKeys: new Set(), fallbacks: 0, scan: false, preOk: false, bar: [], stage: '', lean: { tex: 1, sat: 0, hdri: 0, warm: 0, probe: 0 }, booting: false, booted: false, wait: 0, barTag: '', info: null, reloading: false, halt: false };
/* Interruption log, kept from one page to the next (reloading clears the page's memory, not storage): dc_gpu_last describes the latest
   (load step, last program requested, memory), dc_gpu_bad lists the program families rejected by the device for this build */
const GPU_LAST = 'dc_gpu_last', GPU_BAD = 'dc_gpu_bad';
const gpuRead = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const gpuWrite = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignored */ } };
/* Chronological log (dc_gpu_tl, 70 events), kept from one page to the next: what the game and the player did up to the interruption (install window,
   startup, screens opened, load steps, fences, context loss and restoration). A report's final state does not say what came before: it is
   the sequence that points to the step at fault (a report taken at the menu, with no map loaded, showed a loss that happened with no loading at all). */
const GPU_TL = "dc_gpu_tl", GPU_PAGE = Math.floor(Date.now() / 1000).toString(36).slice(-3);
const GPU_EV = (() => { const v = gpuRead(GPU_TL); return Array.isArray(v) ? v.slice(-70) : []; })();
function gpuLog(m) {
  m = String(m).slice(0, 90); const l = GPU_EV[GPU_EV.length - 1];
  if (l && l[1] === GPU_PAGE && l[2] === m) { l[0] = Date.now(); l[3] = (l[3] || 1) + 1; } // the same message repeated (an error on every frame): one line, counted
  else { GPU_EV.push([Date.now(), GPU_PAGE, m]); if (GPU_EV.length > 70) GPU_EV.shift(); }
  gpuWrite(GPU_TL, GPU_EV);
}
gpuLog(`page ${String(BUILD).slice(0, 7)} ${matchMedia("(display-mode: standalone)").matches ? "installed" : "browser"} ${innerWidth}x${innerHeight} ${document.visibilityState}`);
document.addEventListener("visibilitychange", () => gpuLog("page " + document.visibilityState));
addEventListener("pagehide", () => gpuLog("pagehide"));
document.addEventListener("fullscreenchange", () => gpuLog("fullscreen " + (document.fullscreenElement ? "on" : "off")));
try { screen.orientation.addEventListener("change", () => gpuLog("orientation " + screen.orientation.type)); } catch (e) { /* ignored */ }
{ let rt = 0; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => gpuLog(`resize ${innerWidth}x${innerHeight}`), 400); }); }
{ const b = gpuRead(GPU_BAD); if (b && b.b === BUILD && Array.isArray(b.keys)) for (const k of b.keys) GPUX.badKeys.add(k); } // from another build: shaders may have changed, so we retry
const GPU_LEAN = 'dc_gpu_lean';
/* Adaptation learned on this device: when a context loss is attributed to a load step (see gpuBarrier), the next step is lightened
   (smaller procedural textures, satellite capture at low resolution, procedural sky instead of the HDRI); kept per build, re-read at startup */
{ const l = gpuRead(GPU_LEAN); if (l && l.b === BUILD) Object.assign(GPUX.lean, { tex: l.tex || 1, sat: l.sat || 0, hdri: l.hdri || 0, warm: l.warm || 0, probe: l.probe || 0 }); }
function gpuJournal() {
  const m = performance.memory, L = typeof MAPL !== 'undefined' ? MAPL : {};
  gpuWrite(GPU_LAST, { b: BUILD, t: new Date().toISOString(), after: Math.round(performance.now()), visible: GPUX.lostVisible, map: L.id || '', step: L.msg || '', p: +(L.p || 0).toFixed(2), cur: GPUX.cur || '', safe: GFX_SAFE, tier: RQ.tier, heapMB: m ? Math.round(m.usedJSHeapSize / 1048576) : null, devMem: navigator.deviceMemory || null, culprits: GPUX.culprits.slice(0, 6) });
}
/* Texture units per program: 16 on desktop, 13 on a Pixel (PowerVR via ANGLE, per its graphics report). A program that asks for more is
   rejected, or causes context loss during its compilation: the blended floor wanted 16 on all maps. TEX_LEAN: materials that exceed
   the limit switch to a lean variant (see groundMat, 02c-materials.js; it is checked by tools/dev/visual/units.js). */
const TEXU = { max: renderer.capabilities.maxTextures || 16 };
const TEX_LEAN = TEXU.max < 16;
{
  // a program's or shader's log is null when the driver took back the context: three.js reads it with .trim() and crashed ("reading 'trim'");
  // empty, it reads "no error" and loading continues until the gpuCompileScene check (context lost: clear failure)
  const gl = renderer.getContext();
  for (const k of ['getProgramInfoLog', 'getShaderInfoLog']) { const f = gl[k].bind(gl); gl[k] = (o) => f(o) || ''; }
  canvas.addEventListener('webglcontextlost', () => gpuLost(), false);
  canvas.addEventListener('webglcontextrestored', () => gpuRestoredEvent(), false);
  // latest page errors, for the report
  const keep = (m) => { GPUX.errs.push(String(m).slice(0, 220)); if (GPUX.errs.length > 6) GPUX.errs.shift(); gpuLog("error: " + m); };
  addEventListener('error', (e) => keep((e && e.message) || 'error'));
  addEventListener('unhandledrejection', (e) => keep('promise: ' + ((e && e.reason && (e.reason.message || e.reason)) || '')));
}
const gpuLostNow = () => { try { return renderer.getContext().isContextLost(); } catch (e) { return false; } };
/* GPU characteristics, captured once at load (the context is healthy): after a loss, the driver no longer responds and the report would only have "null"s */
function gpuInfoLines() {
  const gl = renderer.getContext(), P = (n) => { try { return gl.getParameter(n); } catch (e) { return "?"; } };
  let ur = "?", uv = "?"; try { const x = gl.getExtension("WEBGL_debug_renderer_info"); if (x) { ur = P(x.UNMASKED_RENDERER_WEBGL); uv = P(x.UNMASKED_VENDOR_WEBGL); } } catch (e) { /* ignored */ }
  const hp = (() => { try { const f = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT); return f ? f.rangeMax + "/" + f.precision : "?"; } catch (e) { return "?"; } })();
  const ext = (n) => { try { return gl.getExtension(n) ? "yes" : "no"; } catch (e) { return "?"; } };
  return [
    `WebGL ${renderer.capabilities.isWebGL2 ? 2 : 1} · ${P(gl.VENDOR)} · ${P(gl.RENDERER)}`,
    `driver: ${uv} · ${ur}`,
    `max texture ${P(gl.MAX_TEXTURE_SIZE)} · 3D ${renderer.capabilities.isWebGL2 ? P(gl.MAX_3D_TEXTURE_SIZE) : "-"} · units ${P(gl.MAX_TEXTURE_IMAGE_UNITS)} · fragment uniforms ${P(gl.MAX_FRAGMENT_UNIFORM_VECTORS)} · varyings ${P(gl.MAX_VARYING_VECTORS)} · samples ${renderer.capabilities.isWebGL2 ? P(gl.MAX_SAMPLES) : "-"} · highp ${hp}`,
    `extensions: float target ${ext("EXT_color_buffer_float")} · half-float target ${ext("EXT_color_buffer_half_float")} · float linear ${ext("OES_texture_float_linear")}`,
  ];
}
GPUX.info = gpuInfoLines();

/* Error from a context loss (loading stops, the page may relaunch by itself, see gpuAutoRetry) */
const gpuError = () => Object.assign(new Error(_t('3D display interrupted by the device')), { gpuLost: true });
const GPU_LEAN_OF = { textures: 'tex', satellite: 'sat', environment: 'hdri', 'before compile': 'hdri', warmup: 'warm', probes: 'probe' }; // load step (gpuBarrier): what we lighten
/* Context loss attributed to a step: it is lightened for the next load. Textures shrink (0.7 then 0.5); the satellite capture goes to
   low resolution (1), then is no longer rendered on the GPU (2); the procedural sky replaces the HDRI; the warm-up frame (warmupRender) is skipped: the first
   render of the match then compiles what was left; the scenery reflections in the water (waterProbes) are no longer rendered: the water reflects the sky */
function gpuStageLost(tag) {
  GPUX.stage = tag; GPUX.culprits.push('(stage) ' + tag);
  const k = GPU_LEAN_OF[String(tag).split(' ')[0] === 'before' ? 'before compile' : String(tag).split(' ')[0]];
  if (k === 'tex') GPUX.lean.tex = Math.max(0.5, GPUX.lean.tex * 0.7); else if (k === 'sat') GPUX.lean.sat = Math.min(2, GPUX.lean.sat + 1); else if (k) GPUX.lean[k] = 1;
  { const v = gpuRead(GPU_OK); if (v && v.maps) gpuWrite(GPU_OK, { b: v.b, maps: v.maps.filter((m) => typeof MAPL === "undefined" || m !== MAPL.id) }); } // to be swept again on the next load
  gpuLog("lost at stage " + tag + " -> lean textures x" + GPUX.lean.tex.toFixed(2) + " satellite " + GPUX.lean.sat + " hdri " + GPUX.lean.hdri + " warm " + GPUX.lean.warm + " probe " + GPUX.lean.probe);
  gpuWrite(GPU_LEAN, Object.assign({ b: BUILD }, GPUX.lean)); gpuJournal();
}
/* Waits, without blocking the page, for the GPU to finish everything it was asked to do: a fence (fenceSync) whose state is polled every 8 ms. gl.finish() is not
   suitable: Chrome makes it a mere command submission, it does not wait for the GPU (a Pixel's report gave "0 ms" for a step that had just generated
   all the textures). Returns the wait duration in ms; the context loss, announced by a message from the graphics process, arrives during these pauses. */
async function gpuFence(maxMs = 20000) {
  const gl = renderer.getContext(), t0 = performance.now(); let sync = null;
  try { sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush(); } catch (e) { sync = null; }
  if (!sync) { try { gl.finish(); } catch (e) { /* ignored */ } await new Promise((r) => setTimeout(r, 30)); return Math.round(performance.now() - t0); }
  while (performance.now() - t0 < maxMs) {
    await new Promise((r) => setTimeout(r, 8));
    if (gpuLostNow()) break;
    let st = null; try { st = gl.getSyncParameter(sync, gl.SYNC_STATUS); } catch (e) { break; }
    if (st === gl.SIGNALED) break;
  }
  const ms = Math.round(performance.now() - t0);
  try { gl.deleteSync(sync); } catch (e) { /* ignored */ }
  await new Promise((r) => setTimeout(r, 24));
  return ms;
}
/* Step fence: the GPU has finished what precedes (gpuFence), the step's duration is measured (report, log), and a context loss is attributed to the step that has just
   finished, not to the first program compiled afterwards. On phones or in economy mode only; desktop: nothing. */
async function gpuBarrier(tag) {
  if (!(COARSE || GFX_SAFE)) return;
  GPUX.barTag = tag;
  const ms = await gpuFence();
  GPUX.bar.push([tag, ms]); if (GPUX.bar.length > 14) GPUX.bar.shift();
  gpuLog(`barrier ${tag} ${ms} ms${gpuLostNow() ? " LOST" : ""}`);
  if (gpuLostNow()) { gpuStageLost(tag); throw gpuError(); }
}
/* Automatic reload after a context loss during a load (textures generated on the GPU are lost, the page must be redone): at most
   three times per session (each loss attributed to the page can get it blocked by Chrome for a few minutes: 00b-preflight.js), then the "3D display interrupted" window takes over; launching a solo match then resumes by itself */
function gpuAutoRetry(mapId) {
  if (GPUX.reloading) return true; // a reload is already planned (context restoration often arrives between the load failure and the reload): only one attempt counted
  let n = 0; try { n = +sessionStorage.getItem('dc_gpu_auto') || 0; } catch (e) { n = 9; }
  if (n >= 3) { gpuLog("no more automatic reloads (" + n + ")"); return false; }
  try { sessionStorage.setItem('dc_gpu_auto', String(n + 1)); if (mapId) sessionStorage.setItem('dc_gpu_resume', JSON.stringify({ map: mapId, t: Date.now() })); } catch (e) { return false; }
  GPUX.reloading = true; gpuLog("automatic reload " + (n + 1) + " map " + (mapId || "-"));
  const m = document.getElementById('mlMsg'); if (m) m.textContent = _t('The 3D display was interrupted. The game is adapting to your device and restarting...');
  setTimeout(() => { PAGE_LEAVE.ok = true; location.reload(); }, 1500);
  return true;
}
/* When the menu is ready: the solo match interrupted by an automatic reload resumes (less than ten minutes later: Chrome may block 3D display for a few minutes, see 00b-preflight.js) */
function gpuResume() {
  let r = null; try { r = JSON.parse(sessionStorage.getItem('dc_gpu_resume') || 'null'); sessionStorage.removeItem('dc_gpu_resume'); } catch (e) { r = null; }
  if (!r || Date.now() - r.t > 600000 || !MAP_DEFS[r.map]) return;
  Settings.map = r.map; saveSettings();
  menuLaunch({ online: false, map: r.map, deploy: () => startMatch() });
}
/* "3D display interrupted" window: message depending on the case */
function gpuShowOverlay() {
  const el = document.getElementById('gpuLost'); if (!el) return;
  document.getElementById('glMsg').textContent = !GPUX.lostVisible
    ? _t('The 3D display was interrupted while the game was in the background. Restart the game to resume.')
    : GPUX.culprits.length ? _t('Your device refused some of the game\u0027s rendering programs. Restart the game. They will be replaced by simple versions (see the graphics report).')
      : GPUX.armed ? _t('Your device interrupted the game\u0027s 3D display (graphics memory or compute time). Economy graphics mode is now on. Restart the game.')
        : !GFX_SAFE ? _t("The device interrupted the 3D display. Restart the game to resume.")
          : _t('The 3D display was interrupted again, even in economy graphics mode. Restart the game. If it keeps happening, open the graphics report.');
  el.classList.remove('hidden');
}
/* First frames of continuous 3D rendering (aerial view, match): a Pixel's report showed a map load carried through to the end (fences, sweep, capture,
   warm-up frame: all healthy) then the context lost 0.7 s after the start of the aerial view. The log therefore keeps the frame number, its rate, the work requested
   and, thanks to a non-blocking fence (gpuFence), the real GPU time of a few frames; a loss is dated in frames. GPUF.t0: start of the current rendering (a 2.5
   second pause resets it to zero); dynamic resolution does not touch it for 5 s (updateDynRes, 01-core.js). */
const GPUF = { n: 0, last: -1e9, t0: -1e9, progs: 0, beat: 0 };
/* Programs compiled since index from: which scene (or first-person view) objects they serve. Only when there are new ones during a match
   (rare: compilation itself already freezes the frame); a shadow or depth program, with no object of its own, gives only its shader name. */
function gpuProgNames(from) {
  const P = (renderer.info.programs || []).slice(from), set = new Set(P), out = new Set();
  const look = (root) => root && root.traverse((o) => {
    if (!o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (set.has(renderer.properties.get(m).currentProgram)) out.add(`${o.name || (o.parent && o.parent.name) || o.type}/${m.name || m.type}`);
  });
  look(scene); if (typeof vmScene !== 'undefined') look(vmScene);
  return out.size ? [...out].slice(0, 4).join(', ') : P.map((p) => p.name).join(', ');
}
/* GPU benchmark: an always identical computation (256 x 256 pixels of a loop shader, off the game canvas), timed every 15 s of the match. It
   depends on neither the map nor the scene: if it takes more and more time, it is the chip slowing down (heat, power limit of a laptop that falls
   back after its first tens of seconds of momentum), not the game asking more of it. Only with timing queries (never on phones). */
const GREF = { rt: null, sc: null, cam: null, q: null, ms: 0, first: 0 };
/* Target, scene and program of the benchmark, prepared and drawn once at map load (mapCompile): no compilation mid-match */
function gpuRefPrep() {
  if (!GPUT || GREF.rt) return;
  GREF.rt = new THREE.WebGLRenderTarget(256, 256, { depthBuffer: false });
  GREF.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const m = new THREE.ShaderMaterial({
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'void main() { vec2 p = gl_FragCoord.xy / 256.0; float a = p.x + p.y; for (int i = 0; i < 96; i++) { a = sin(a * 1.31 + p.x) * cos(a * 0.73 + p.y) + fract(a * 3.17); } gl_FragColor = vec4(a, 0.0, 0.0, 1.0); }',
    depthTest: false, depthWrite: false,
  });
  const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m); q.frustumCulled = false;
  GREF.sc = new THREE.Scene(); GREF.sc.add(q);
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(GREF.rt); renderer.render(GREF.sc, GREF.cam); renderer.setRenderTarget(prev);
}
function gpuRefRun() {
  if (!GPUT || GREF.q) return;
  gpuRefPrep();
  const gl = GPUT.gl, prev = renderer.getRenderTarget();
  GREF.q = gl.createQuery(); gl.beginQuery(GPUT.ext.TIME_ELAPSED_EXT, GREF.q);
  renderer.setRenderTarget(GREF.rt); renderer.render(GREF.sc, GREF.cam); renderer.setRenderTarget(prev);
  gl.endQuery(GPUT.ext.TIME_ELAPSED_EXT);
}
/* Result of the previous measurement (available a few frames later); GREF.first: the first of the page, the reference */
function gpuRefPoll() {
  if (!GREF.q) return;
  const gl = GPUT.gl; if (!gl.getQueryParameter(GREF.q, gl.QUERY_RESULT_AVAILABLE)) return;
  if (!gl.getParameter(GPUT.ext.GPU_DISJOINT_EXT)) { GREF.ms = gl.getQueryParameter(GREF.q, gl.QUERY_RESULT) / 1e6; if (!GREF.first) GREF.first = GREF.ms; }
  gl.deleteQuery(GREF.q); GREF.q = null;
}
function gpuFrame(now) {
  if (now - GPUF.last > 2500) { GPUF.n = 0; GPUF.t0 = now; }
  const gap = now - GPUF.last; GPUF.last = now; const n = ++GPUF.n;
  // match: one state every 15 s (rate, work, memory), an abnormally long frame, and any program compiled mid-match (on iPhone, a compilation
  // takes nearly a second and blocks the frame): the log shows what precedes an interruption
  const np = (renderer.info.programs || []).length;
  if (MATCH.state === 'playing') {
    if (np > GPUF.progs && GPUF.progs) gpuLog(`match: ${np - GPUF.progs} new program(s) compiled (total ${np}): ${gpuProgNames(GPUF.progs)}`);
    if (gap > 250 && gap < 2500 && n > 1) gpuLog(`match: long frame ${Math.round(gap)} ms`);
    if (now - GPUF.beat > 15000) {
      GPUF.beat = now; const i = renderer.info.render, m = renderer.info.memory, h = performance.memory;
      gpuLog(`match ${Math.round(MATCH.time)} s: ${Math.round(DYN.stat.fps)} fps, calls ${i.calls}, tris ${Math.round(i.triangles / 1000)}k, tex ${m.textures}, geo ${m.geometries}, prog ${np}${h ? ', heap ' + Math.round(h.usedJSHeapSize / 1048576) + ' MB' : ''}`);
      if (GPUT) gpuRefPoll();
      gpuLog(`  cpu ${DYN.cpu.toFixed(1)} ms${DYN.gpu ? ', gpu ' + DYN.gpu.toFixed(1) + ' ms' : ''}${GREF.ms ? ', gpu ref ' + GREF.ms.toFixed(2) + ' ms (x' + (GREF.ms / GREF.first).toFixed(2) + ')' : ''}, ${RQ.tier} ${RQ.scale.toFixed(2)}${LAG.on || LAG.n ? ', short queue ' + (LAG.on ? 'on' : 'off') + ' (' + LAG.n + ' skipped)' : ''}`); LAG.n = 0;
      if (GPUT) gpuRefRun(); // benchmark: measured now, read at the next state
      { const c = typeof AU !== 'undefined' && AU.ctx, ps = c && c.playbackStats; if (c) gpuLog(`audio ${c.state}: ${ps ? 'underruns ' + ps.underrunEvents + ' (' + Math.round(ps.underrunDuration * 1000) + ' ms), ' : ''}shed ${AU.shed}`); }
    }
  }
  GPUF.progs = np;
  if (n === 1 || n === 2 || n === 5 || n === 10 || n === 20 || n === 40 || n === 80) {
    const i = renderer.info.render;
    gpuLog(`frame ${n} (+${Math.round(now - GPUF.t0)} ms) calls ${i.calls} tris ${Math.round(i.triangles / 1000)}k scale ${RQ.scale.toFixed(2)}`);
    if (n === 1 || n === 10 || n === 40) gpuFence(4000).then((ms) => gpuLog(`frame ${n} done by the GPU after ${ms} ms`));
  }
}
/* Where the game stands: install window (nothing is built yet), startup, menus, aerial view of the class choice, map load, match */
function gpuPhase() {
  if (!GPUX.booted) return GPUX.booting ? "boot" : "gate";
  if (MAPL.state === "loading") return "loading";
  if (MATCH.state === "menu") return UI.screen === "deploy" ? "aerial" : "menu";
  return "match";
}
/* The driver has taken back the context. Only a loss while the game is drawing (map load, aerial view, match) says the device is overwhelmed: economy
   mode for what follows if the game was displayed. At the install window, at startup, in menus or in the background, the driver may take back the
   context unrelated to the game (a report showed one at install, 137 s after opening, with no render having taken place): no economy
   mode, and the "3D display interrupted" window waits for restoration (gpuRestoredEvent) instead of imposing itself. */
function gpuLost() {
  GPUX.lost++; GPUX.lostVisible = document.visibilityState !== "hidden";
  const ph = GPUX.lostPhase = gpuPhase();
  gpuLog(`context LOST (${ph}, ${GPUX.lostVisible ? "visible" : "background"}${GPUF.n && performance.now() - GPUF.last < 5000 ? ", frame " + GPUF.n : ""})`);
  if (GPUX.lostVisible && !Settings.gfxSafe && (ph === "loading" || ph === "aerial" || ph === "match")) { Settings.gfxSafe = true; Settings.gfxSafeAuto = BUILD; saveSettings(); GPUX.armed = true; }
  // phone: a loss while the game is drawing also turns off the shadows computed for 30 days (shadow maps are what a Pixel's driver does not support,
  // see NO_SHADOWS in 01-core.js); since each loss gets the site blocked by Chrome until its restart, we do not retry on every load
  if (COARSE && !NO_SHADOWS && GPUX.lostVisible && (ph === "loading" || ph === "aerial" || ph === "match")) { gpuWrite("dc_gpu_noshadow", { t: Date.now(), b: BUILD }); gpuLog("real-time shadows off for the next launches"); }
  // in a match or in the aerial view: the frame loop stops drawing (what the game had generated on the GPU is lost; three.js raised an error on every frame, an
  // iPhone drowned its log in them); the "3D display interrupted" window offers to relaunch
  if (ph === "match" || ph === "aerial") GPUX.halt = true;
  gpuJournal();
  if (ph === "gate" || ph === "boot" || ph === "menu") { clearTimeout(GPUX.wait); GPUX.wait = setTimeout(() => { if (gpuLostNow()) gpuShowOverlay(); }, 8000); return; } // the browser gives the context back by itself
  if (!GPUX.scan) gpuShowOverlay(); // during the program inventory (gpuCompileScene), the window waits for the end
}
/* Context restored: at the install window, nothing had been built, there is nothing to redo; at startup or in menus, what the game
   had generated on the GPU (procedural textures, lighting) is lost: the page relaunches by itself (gpuAutoRetry, at most three times per session) */
function gpuRestoredEvent() {
  GPUX.restored++; clearTimeout(GPUX.wait);
  const ph = gpuPhase(); gpuLog(`context restored (${ph})`);
  // the aerial view is not relaunched by itself: the loss is attributed to the page there (Chrome may then block it for a few minutes), the "3D display interrupted" window stays, with the report
  if (ph === "boot" || ph === "menu") { if (!gpuAutoRetry(null)) gpuShowOverlay(); }
}
/* Waits for the context to be restored (the browser gives it back by itself, three.js has then reinitialized everything) */
async function gpuRestored(ms) {
  const r0 = GPUX.restored;
  for (let t = 0; t < ms; t += 100) { if (GPUX.restored > r0) return true; await new Promise((r) => setTimeout(r, 100)); }
  return GPUX.restored > r0;
}
/* Family of a program: material type, definitions, textures, skin and instances; stable from one load to the next (used to find the rejected renders) */
function gpuProgKey(o, m) {
  const maps = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'envMap', 'alphaMap', 'emissiveMap', 'bumpMap'].filter((k) => m[k]).join('+');
  const wm = m.userData && m.userData.wmU ? Object.keys(m.userData.wmU).filter((k) => /^t[A-Z]/.test(k)).sort().join('+') : '';
  return [m.type, Object.keys(m.defines || {}).sort().join(','), maps, wm, o.isSkinnedMesh ? 'S' : '', o.isInstancedMesh ? 'I' : '', m.isShaderMaterial ? m.name || '' : ''].join('|');
}
/* Replaces, in root, the renders the device rejected during a previous load of this build: a standard material by a simple unlit material
   (texture and tint, darkened), any other material: hidden object. The game stays playable, less pretty. */
function gpuApplyFallbacks(root) {
  if (!GPUX.badKeys.size) return 0;
  let n = 0; const cache = new Map();
  root.traverse((o) => {
    const m = o.material; if (!m || Array.isArray(m) || o.userData.gpuFallback) return;
    if (!GPUX.badKeys.has(gpuProgKey(o, m))) return;
    if (!cache.has(m)) {
      const f = m.isMeshStandardMaterial ? new THREE.MeshBasicMaterial({ map: m.map || null, color: m.color ? m.color.clone().multiplyScalar(0.6) : 0x999999, side: m.side, transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest, vertexColors: m.vertexColors }) : null;
      if (f) f.name = 'fallbackMode';
      cache.set(m, f);
    }
    const f = cache.get(m); if (f) o.material = f; else o.visible = false;
    o.castShadow = false; o.userData.gpuFallback = 1; n++;
  });
  GPUX.fallbacks += n; return n;
}

/* Compiles a scene's programs in small groups, handing control back to the browser between each (live page, visible progress, driver
   not saturated); renderer.compile(scene) in one go tied up the main thread for the whole compilation, tens of seconds on a
   phone, and that is when the driver took back the context. three.js r147 waits for each program to link (getUniforms): the
   browser's parallel compilation changes nothing there. One object per material and per attribute set is enough (the program is shared);
   slow compilations are recorded for the report. onProg(done, total). */
async function gpuCompileScene(sc, cam, onProg) {
  // parallel compilation (desktop, KHR_parallel_shader_compile): three.js no longer reads each program's state right after editing its
  // links (checkShaderErrors, which forced the driver to compile them one by one); we then wait for them all to be ready (gpuProgramsReady),
  // then gpuCheckPrograms verifies them. On phones, compilation stays one by one: it pinpoints the program that would cause the context loss
  const par = !COARSE && renderer.extensions.has('KHR_parallel_shader_compile');
  if (par) renderer.debug.checkShaderErrors = false;
  const seen = new Map();
  sc.traverse((o) => {
    const m = o.material; if (!m) return;
    const g = o.geometry && o.geometry.attributes ? Object.keys(o.geometry.attributes).join() : '';
    for (const mm of Array.isArray(m) ? m : [m]) {
      const k = mm.uuid + '|' + o.type + (o.isInstancedMesh ? (o.instanceColor ? 'ic' : 'i') : '') + (o.isSkinnedMesh ? 's' : '') + '|' + g;
      if (!seen.has(k)) seen.set(k, o);
    }
  });
  const objs = [...seen.values()], total = objs.length; let n = 0, t = performance.now();
  GPUX.scan = true;
  try {
    for (const o of objs) {
      sc.traverse = (f) => f(o); // renderer.compile visits only this object (lights, for their part, come from traverseVisible)
      const mt = Array.isArray(o.material) ? o.material[0] : o.material, key = gpuProgKey(o, mt);
      GPUX.cur = `${key} ${mt.name || o.name || o.type} ${n + 1}/${total}`; // last program requested: the one that caused the context loss, if any
      const t1 = performance.now(); renderer.compile(sc, cam); const ms = performance.now() - t1;
      if (gpuLostNow()) {
        // the driver took back the context during this program: we note it (page and storage), wait for restoration and continue, to draw up in a single
        // load the complete list of rejected programs; the load will fail anyway (textures generated on the GPU are lost)
        GPUX.culprits.push(GPUX.cur); if (GPUX.preOk) { GPUX.badKeys.add(key); gpuWrite(GPU_BAD, { b: BUILD, keys: [...GPUX.badKeys] }); } gpuJournal(); // family retained only if the context was healthy before this program
        if (GPUX.culprits.length > 12 || !(await gpuRestored(8000))) break;
        n++; continue;
      }
      if (ms > 200) { GPUX.slow.push([(o.material && (o.material.type || '')) + ' ' + (o.name || o.type), Math.round(ms)]); GPUX.slow.sort((a, b) => b[1] - a[1]); GPUX.slow.length = Math.min(GPUX.slow.length, 4); }
      n++;
      if (performance.now() - t > 120) {
        if (onProg) onProg(n, total);
        await new Promise((r) => setTimeout(r, 0)); t = performance.now();
        if (gpuLostNow()) { GPUX.culprits.push('(between programs) ' + GPUX.cur); gpuJournal(); break; }
      }
    }
  } finally { delete sc.traverse; GPUX.scan = false; if (par) renderer.debug.checkShaderErrors = true; }
  if (par) await gpuProgramsReady();
  if (GPUX.culprits.length || gpuLostNow()) { gpuShowOverlay(); throw gpuError(); }
  if (onProg) onProg(total, total);
}
/* Waits for the driver to finish compiling all the programs launched in parallel (COMPLETION_STATUS_KHR), control handed back to the browser between
   two polls; at most 60 s (beyond that, the first use of a program will wait by itself) */
async function gpuProgramsReady() {
  const gl = renderer.getContext(), ext = renderer.extensions.get('KHR_parallel_shader_compile'), t0 = performance.now();
  if (!ext) return;
  for (;;) {
    let wait = false;
    for (const p of renderer.info.programs || []) if (!gl.getProgramParameter(p.program, ext.COMPLETION_STATUS_KHR)) { wait = true; break; }
    if (!wait || gpuLostNow() || performance.now() - t0 > 60000) return;
    await new Promise((r) => setTimeout(r, 8));
  }
}
/* Draw sweep: a tiny render per program family, of its objects alone (shadows included), with a fence after each. A Pixel's report
   showed the context lost at the first whole-scene render (the satellite capture), even at low definition and without anti-aliasing, after a dozen
   programs: it is not the image size, it is a specific draw. gpuCompileScene does not see it (compiling is not drawing). The first attempt is an empty
   render (target, shadows: the base); a loss on that one incriminates no family. A family that causes context loss is noted as by gpuCompileScene
   (dc_gpu_bad, then replaced by gpuApplyFallbacks), we wait for restoration and continue: the complete list in a single load. cam: the capture
   camera, in the state it requires (buildSatelliteMap). Maps passed without incident are kept per build (dc_gpu_ok): no new sweep. */
const GPU_OK = "dc_gpu_ok";
const gpuScanDone = (id) => { const v = gpuRead(GPU_OK); return !!(v && v.b === BUILD && v.maps && v.maps.includes(id)); };
async function gpuDrawScan(sc, cam, id) {
  const all = [], reps = new Map();
  sc.traverse((o) => {
    const m = o.material; if (!m || !(o.isMesh || o.isPoints || o.isLine || o.isSprite)) return;
    all.push([o, o.visible]);
    if (!o.visible) return;
    const mt = Array.isArray(m) ? m[0] : m, key = gpuProgKey(o, mt);
    if (!reps.has(key)) reps.set(key, o);
  });
  const keys = [null, ...reps.keys()], bad = []; let empty = false; const t0 = performance.now();
  const rt = new THREE.WebGLRenderTarget(96, 96, { type: THREE.HalfFloatType }), cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
  GPUX.scan = true; GPUX.barTag = "draw";
  try {
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i], rep = key === null ? null : reps.get(key);
      for (const [o] of all) o.visible = o === rep;
      GPUX.cur = `draw ${key === null ? "(empty)" : key} ${i}/${keys.length - 1}`;
      renderer.shadowMap.needsUpdate = true;
      renderer.setRenderTarget(rt); renderer.setClearColor(0x2a2620, 1); renderer.clear(); renderer.render(sc, cam); renderer.setRenderTarget(null);
      await gpuFence();
      if (gpuLostNow()) {
        gpuLog("draw scan LOST at " + GPUX.cur);
        if (key === null) { empty = true; break; }
        GPUX.culprits.push(GPUX.cur); GPUX.badKeys.add(key); bad.push(key); gpuJournal();
        if (bad.length >= 3 || !(await gpuRestored(8000))) break; // no more than three: each loss attributed to the page can get it blocked by Chrome
      }
    }
  } finally {
    for (const [o, v] of all) o.visible = v;
    renderer.setRenderTarget(null); renderer.setClearColor(cc, ca); try { rt.dispose(); } catch (e) { /* ignored */ }
    GPUX.scan = false;
  }
  gpuLog(`draw scan: ${keys.length - 1} families, ${bad.length} refused, ${Math.round(performance.now() - t0)} ms`);
  if (empty) { gpuStageLost("satellite (empty render)"); throw gpuError(); }
  if (bad.length) { gpuWrite(GPU_BAD, { b: BUILD, keys: [...GPUX.badKeys] }); gpuShowOverlay(); throw gpuError(); }
  const v = gpuRead(GPU_OK); gpuWrite(GPU_OK, { b: BUILD, maps: [...new Set([...(v && v.b === BUILD && v.maps || []), id])] });
}
/* Programs rejected by the driver (failed link) or that ask for more texture units than the limit; GPUX.samp: the hungriest */
function gpuCheckPrograms() {
  const gl = renderer.getContext(), bad = [];
  const SAMP = new Set([0x8B5E, 0x8B5F, 0x8B60, 0x8B62, 0x8DC1, 0x8DC2, 0x8DC3, 0x8DC4, 0x8DCA, 0x8DCB, 0x8DCC, 0x8DCF, 0x8DD1, 0x8DD2, 0x8DD3, 0x8DD4, 0x8DD5]);
  GPUX.samp = { n: 0, name: '' };
  for (const p of renderer.info.programs || []) {
    if (!gl.getProgramParameter(p.program, gl.LINK_STATUS)) {
      let log = ''; try { log = String(gl.getProgramInfoLog(p.program) || '').replace(/\s+/g, ' ').slice(0, 240); } catch (e) { /* ignored */ }
      bad.push({ name: p.name, log }); continue;
    }
    let n = 0; const names = [];
    for (let i = 0, k = gl.getProgramParameter(p.program, gl.ACTIVE_UNIFORMS); i < k; i++) { const u = gl.getActiveUniform(p.program, i); if (u && SAMP.has(u.type)) { n += u.size; names.push(u.name.replace(/\[0\]$/, '')); } }
    if (n > GPUX.samp.n) GPUX.samp = { n, name: p.name + ' ' + names.join(' ') };
    if (n > TEXU.max) bad.push({ name: p.name, log: `${n} texture units for ${TEXU.max} : ${names.join(' ')}`.slice(0, 240) });
  }
  GPUX.bad = bad; return bad;
}

/* ---------- Graphics report ---------- */
/* Render tests: full HalfFloat target, 3D texture read (baked lighting), write to an 8-bit target */
function gpuProbes() {
  const out = [];
  try {
    const gl = renderer.getContext(), prev = renderer.getRenderTarget();
    const half = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, format: THREE.RGBAFormat });
    renderer.setRenderTarget(half); out.push('RGBA16F target: ' + (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE ? 'ok' : 'INCOMPLETE'));
    half.dispose();
    const d = new Uint8Array(4 * 4 * 4 * 4); for (let i = 0; i < d.length; i += 4) { d[i] = 200; d[i + 1] = 100; d[i + 2] = 50; d[i + 3] = 255; }
    const t3 = new THREE.Data3DTexture(d, 4, 4, 4); t3.format = THREE.RGBAFormat; t3.type = THREE.UnsignedByteType; t3.minFilter = t3.magFilter = THREE.LinearFilter; t3.unpackAlignment = 1; t3.needsUpdate = true;
    const mat = new THREE.ShaderMaterial({
      uniforms: { t: { value: t3 } }, depthTest: false,
      vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform highp sampler3D t; void main() { gl_FragColor = texture(t, vec3(0.5)); }',
    });
    const rt = new THREE.WebGLRenderTarget(4, 4), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat), sc = new THREE.Scene(); quad.frustumCulled = false; sc.add(quad);
    renderer.setRenderTarget(rt); renderer.clear(); renderer.render(sc, new THREE.Camera());
    const px = new Uint8Array(4); renderer.readRenderTargetPixels(rt, 0, 0, 1, 1, px);
    out.push('3D texture read: ' + (Math.abs(px[0] - 200) < 4 && Math.abs(px[1] - 100) < 4 ? 'ok' : 'FAILED (' + px.join(',') + ')'));
    rt.dispose(); t3.dispose(); mat.dispose(); quad.geometry.dispose();
    renderer.setRenderTarget(prev);
  } catch (e) { out.push('probe aborted: ' + ((e && e.message) || e)); }
  return out;
}
/* Sound: audio context state, latencies, and playback dropouts counted by Chrome (playbackStats: duration and number of output buffer underruns, which is
   what makes the sound skip); shed: sounds ignored by the phone's voice budget (auAfford, 05-audio.js) */
function gpuAudioLine() {
  const c = typeof AU !== 'undefined' && AU.ctx; if (!c) return 'audio: not started';
  let st = ''; try { const p = c.playbackStats; if (p) st = ` · underruns ${p.underrunEvents} (${Math.round(p.underrunDuration * 1000)} ms of ${Math.round(p.totalDuration)} s) · avg latency ${Math.round(p.averageLatency * 1000)} ms`; } catch (e) { /* absent */ }
  return `audio: ${c.state} ${c.sampleRate} Hz · base latency ${Math.round(c.baseLatency * 1000)} ms · output ${Math.round((c.outputLatency || 0) * 1000)} ms${st} · voices shed ${AU.shed}`;
}
function gpuReportText(withProbes) {
  const bm = document.querySelector('meta[name="cod-build"]'), m = renderer.info.memory;
  const L = [
    'War Bash ' + (bm ? bm.content : '?') + ' · ' + new Date().toISOString(),
    navigator.userAgent,
    `screen ${screen.width}x${screen.height} · window ${innerWidth}x${innerHeight} · DPR ${devicePixelRatio} · touch ${COARSE ? 'yes' : 'no'} · installed ${typeof PWA !== 'undefined' && PWA.standalone ? 'yes' : 'no'}`,
    ...(gpuLostNow() || !GPUX.info ? GPUX.info || [] : gpuInfoLines()), // lost: the values captured at load, the driver no longer responds
    `quality ${Settings.quality}${Settings.eco ? ` (power saving: ${gfxSet('quality')}, ${Math.round(1000 / capMs())} fps)` : ''} (tier ${RQ.tier}, scale ${RQ.scale.toFixed(2)}) · safe mode ${GFX_SAFE ? (Settings.gfxSafeAuto === 'manual' ? 'yes (chosen)' : 'yes (automatic)') : 'no'}${Settings.gfxSafe && !GFX_SAFE ? ' (next launch)' : ''} · minimum profile at launch ${ULTRA ? 'yes' + (GPU_WEAK ? ' (weak GPU)' : GPU_SOFT ? ' (software)' : '') : 'no'} · no prepass ${NO_PREPASS ? 'yes' : 'no'} · GPU class ${GPU.tier}`,
    gpuAudioLine(),
    `performance: ${dynStat().fps.toFixed(0)} fps · ${DYN.stat.ms.toFixed(1)} ms per frame (worst of the last 256: ${DYN.stat.worst.toFixed(1)} ms of which ${DYN.stat.worstC.toFixed(1)} ms of our own work, slowest 1 %: ${DYN.stat.low1.toFixed(1)} ms) · JS ${DYN.cpu.toFixed(1)} ms · GPU ${DYN.gpu ? DYN.gpu.toFixed(1) + ' ms' : 'not measured'} · short frame queue ${LAG.ban ? 'disabled (late fences)' : LAG.on ? 'on' : 'off'}, ${LAG.n} frames skipped · ${renderer.info.render.calls} draw calls · ${Math.round(renderer.info.render.triangles / 1000)} k triangles`,
    `real-time shadows ${NO_SHADOWS ? 'off (' + SHADOWS.why + ')' : 'on'} · frame timer queries ${typeof GPUT !== 'undefined' && GPUT ? 'on' : 'off'} · frames since the render started ${GPUF.n}`,
    `context: ${gpuLostNow() ? 'LOST' : 'active'} · losses ${GPUX.lost} · restores ${GPUX.restored}${GPUX.lost ? ` (${GPUX.lostVisible ? 'game visible' : 'in background'}, phase ${GPUX.lostPhase})` : ''} · phase now ${gpuPhase()}`,
    `memory: ${m.textures} textures · ${m.geometries} geometries · ${(renderer.info.programs || []).length} programs · rejected ${GPUX.bad.length}${GPUX.bad.length ? ' : ' + GPUX.bad.slice(0, 3).map((b) => b.name + ' ' + b.log).join(' | ') : ''}`,
    `map: ${MAPL.id || '-'} (${MAPL.state}) ${MAPL.fail ? ' · failed: ' + ((MAPL.fail.err && MAPL.fail.err.message) || MAPL.fail.err) : ''}${MAPL.T && MAPL.T.length ? ' · steps ms ' + MAPL.T.map((s) => s[1]).join('/') : ''}`,
  ];
  L.push(`texture units: limit ${TEXU.max} · lean ground ${TEX_LEAN ? 'yes' : 'no'}${GPUX.samp ? ' · most samplers in one program: ' + GPUX.samp.n + ' (' + GPUX.samp.name.slice(0, 120) + ')' : ''}`);
  if (GPUX.cur) L.push('last program requested: ' + GPUX.cur);
  L.push(`barriers (ms): ${GPUX.bar.length ? GPUX.bar.map((b) => b[0] + ' ' + b[1]).join(' · ') : '-'} · lost at stage: ${GPUX.stage || '-'} · lean: textures x${GPUX.lean.tex}, satellite ${['full', 'low-res', 'not rendered'][GPUX.lean.sat] || GPUX.lean.sat}, HDRI ${GPUX.lean.hdri ? 'off' : 'on'}, warmup render ${GPUX.lean.warm ? 'skipped' : 'on'}`);
  if (GPUX.culprits.length) L.push('programs the device refused (context lost while compiling): ' + GPUX.culprits.join(' || '));
  if (GPUX.badKeys.size) L.push(`known refused families for this build: ${GPUX.badKeys.size} · replaced by simple materials: ${GPUX.fallbacks}`);
  { const j = gpuRead(GPU_LAST); if (j) L.push(`previous interruption: ${j.t} build ${j.b} map ${j.map || '-'} step "${j.step}" ${j.p} after ${j.after} ms · visible ${j.visible} · safe ${j.safe} · tier ${j.tier} · heap ${j.heapMB} MB · memory ${j.devMem} GB · last program ${j.cur || '-'}${j.culprits && j.culprits.length ? ' · refused: ' + j.culprits.join(' || ') : ''}`); }
  if (GPUX.slow.length) L.push('slow compiles (ms): ' + GPUX.slow.map((x) => x[0] + ' ' + x[1]).join(' | '));
  if (GPUX.errs.length) L.push('errors: ' + GPUX.errs.join(' | '));
  if (GPU_EV.length) L.push("timeline (UTC, page id, event):\n" + GPU_EV.slice(-45).map((e) => `${new Date(e[0]).toISOString().slice(11, 21)} ${e[1]} ${e[2]}${e[3] ? ' (x' + e[3] + ')' : ''}`).join("\n"));
  if (withProbes) L.push('probes: ' + gpuProbes().join(' · '));
  return L.join('\n');
}
function gpuReport() {
  repShow(_t('Graphics report'), _t('It describes the device and the rendering. Copy or share it to understand a black display or a loading that fails.'), gpuReportText(!gpuLostNow()));
}
/* Report window (#gpuRep of shell.html), shared by the graphics report and the performance report (09zo-perfs.js): title, explanatory
   sentence, text to copy or share */
function repShow(title, lead, txt) {
  const el = document.getElementById('gpuRep'); if (!el) return;
  document.getElementById('grTitle').textContent = title; el.querySelector('.gr-lead').textContent = lead;
  document.getElementById('grTxt').textContent = txt;
  if (el.classList.contains('hidden')) el._from = document.activeElement; // on close, focus returns to whatever opened it (Options, loading, 3D window)
  document.getElementById('grCopy').textContent = _t('Copy');
  el.classList.remove('hidden'); document.getElementById('grCopy').focus({ preventScroll: true });
}
{ // buttons of the two windows of shell.html (the script is at the end of the page: the elements already exist)
  const $$ = (id) => document.getElementById(id), on = (id, f) => { const e = $$(id); if (e) e.addEventListener('click', f); };
  on('glGo', () => { PAGE_LEAVE.ok = true; location.reload(); });
  on('glRep', () => gpuReport());
  const close = () => { const el = $$('gpuRep'), f = el._from; el.classList.add('hidden'); el._from = null; if (f && f.isConnected && f.focus) f.focus({ preventScroll: true }); };
  on('grClose', close);
  // Escape (and the gamepad's B, which goes through Escape) closes the report without triggering anything underneath (back, pause)
  addEventListener('keydown', (e) => { const el = $$('gpuRep'); if (e.code !== 'Escape' || !el || el.classList.contains('hidden')) return; e.preventDefault(); e.stopImmediatePropagation(); close(); }, true);
  on('grCopy', () => {
    const t = $$('grTxt').textContent, done = () => { $$('grCopy').textContent = _t('Copied'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => { const r = document.createRange(); r.selectNodeContents($$('grTxt')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
    else { const r = document.createRange(); r.selectNodeContents($$('grTxt')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  });
  on('grShare', () => { if (navigator.share) navigator.share({ title: 'War Bash', text: $$('grTxt').textContent }).catch(() => { /* cancelled */ }); });
  if (!navigator.share) { const b = $$('grShare'); if (b) b.classList.add('hidden'); }
}
