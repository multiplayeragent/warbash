/* Graphics hardening for a phone: node tools/dev/visual/gpu.js [captures folder]
   Emulates a landscape Android and checks, in a real browser:
   - loading a map in small groups of shaders with progress ("Shader compilation: N%") and no rejected program;
   - the graphics report (render trials included);
   - a WebGL context loss while the game is displayed: the "3D display interrupted" window, the low-power graphics mode
     kept for the rest of the session, and the page relaunched in that mode (lightened Low profile, no pre-pass);
   - a loss during shader compilation: the load fails cleanly (message, report button) instead of crashing;
   - a loss at the install window or in the menus (unrelated to game rendering): no alert window and no low-power mode, startup waits
     for the recovery, the page relaunches itself in the menus; the report keeps its GPU characteristics and its chronological log;
   - the tiled satellite survey, after compilation, and the lightening ladder (low resolution, then survey without GPU).
   PAGE=path/to/another/version.html: checks another version (to compare with the published version).
   Exits with an error code on the first failure. */
const { openGame } = require('./common');
// limit of 13 texture units per program, that of a Pixel (see units.js): the game loads and is tested as on the phone
const LIMIT13 = '(() => { const f = WebGL2RenderingContext.prototype.getParameter; WebGL2RenderingContext.prototype.getParameter = function (p) { return p === 0x8872 ? 13 : f.call(this, p); }; })();';
// the Pixel itself: 13 units and its GPU name (PowerVR: no shadow map, see NO_SHADOWS in 01-core.js)
const PIXEL = "(() => { const f = WebGL2RenderingContext.prototype.getParameter; WebGL2RenderingContext.prototype.getParameter = function (p) { if (p === 0x8872) return 13; if (p === 0x9246) return 'ANGLE (Imagination Technologies, PowerVR D-Series DXT-48-1536, OpenGL ES 3.2)'; return f.call(this, p); }; })();";
const OUT = process.argv[2] || '/dev/null';
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL  :', m); } else console.log('ok    :', m); };
// wait timed out: the loading state and the game's chronological log are printed (otherwise a wait that does not complete says nothing)
const until = (page, expr, ms = 900000) => page.waitForFunction(expr, null, { timeout: ms, polling: 500 }).catch(async (e) => { console.log('WAIT TIMED OUT', expr.slice(0, 60), JSON.stringify(await page.evaluate(() => ({ st: MAPL.state, f: !!MAPL.fail, lost: GPUX.lost, rest: GPUX.restored, tl: GPU_EV.slice(-16).map((x) => x[2]) })).catch(() => 'page ?'))); throw e; });
(async () => {
  const { browser, page } = await openGame({ page: process.env.PAGE, mobile: true, w: 915, h: 412, dpr: 1, settings: { quality: 'low' }, noMap: true, noHdri: true, init: PIXEL });
  // openGame rewrites the settings on every page load: the low-power mode that was kept must be added to them to survive the reload
  // the automatic reload after a context loss (gpuAutoRetry) is turned off, except at step 10 which tests it
  await page.addInitScript(() => { try { if (sessionStorage.getItem('dc_gpu_auto') === null) sessionStorage.setItem('dc_gpu_auto', '9'); } catch (e) { /* ignored */ } });
  await page.addInitScript(() => { try { const m = sessionStorage.getItem('__safe'); if (m) { const s = JSON.parse(localStorage.getItem('dc_settings')); s.gfxSafe = true; s.gfxSafeAuto = m === '1' ? 'manual' : m; localStorage.setItem('dc_settings', JSON.stringify(s)); } } catch (e) { /* ignored */ } });
  // the first page opened before the initialization script above: the automatic reload counter is set by hand (otherwise a context recovery relaunches the page)
  await page.evaluate(() => { try { sessionStorage.setItem('dc_gpu_auto', '9'); } catch (e) { /* ignored */ } const b = document.getElementById('wnOk'); if (b) b.click(); window.__lc = renderer.getContext().getExtension('WEBGL_lose_context'); });

  // 1. loading with progress
  await page.evaluate(() => { window.__msgs = []; MAPL.subs.add((p, m) => { if (!window.__msgs.length || window.__msgs[window.__msgs.length - 1] !== m) window.__msgs.push(m); }); window.__job = mapEnsure('chergui').then(() => 'ok', (e) => 'ko ' + e.message); });
  await until(page, 'MAPL.state === "ready" || MAPL.fail');
  const r1 = await page.evaluate(() => ({ st: MAPL.state, msgs: window.__msgs, bad: gpuCheckPrograms().length, lean: TEX_LEAN, samp: GPUX.samp.n, progs: renderer.info.programs.length, safe: GFX_SAFE, pre: NO_PREPASS, lights: RQ.q.lights }));
  ok(r1.st === 'ready', `map loaded (${r1.progs} programs)`);
  ok(r1.msgs.some((m) => /Compiling shaders: \d+%/.test(m)), `compilation progress (${r1.msgs.filter((m) => /Compiling/.test(m)).slice(0, 3).join(' | ')} ...)`);
  ok(r1.bad === 0, 'no rejected program');
  ok(r1.lean === true && r1.samp <= 12, `13-unit limit: lean floor variant, at most ${r1.samp} units per program`);
  ok(r1.pre === true && r1.lights === 0, "phone: no pre-pass, no muzzle flashes");
  const sh = await page.evaluate(() => { const gl = renderer.getContext(); let n = 0; for (const p of renderer.info.programs) for (let i = 0, k = gl.getProgramParameter(p.program, gl.ACTIVE_UNIFORMS); i < k; i++) { const u = gl.getActiveUniform(p.program, i); if (u && /ShadowMap/.test(u.name)) { n++; break; } } return { no: NO_SHADOWS, why: SHADOWS.why, on: renderer.shadowMap.enabled, n, sun: LIGHT.tex && LIGHT.tex.image.data.some((v, i) => i % 4 === 3 && v < 128) }; });
  ok(sh.no && sh.why === 'PowerVR' && !sh.on && sh.n === 0, `PowerVR: no shadow map, no program reads a shadow (${JSON.stringify(sh)})`);
  ok(sh.sun, "sun shadow baked into the volume (channel a)");
  const tl = await page.evaluate(() => GPU_EV.map((e) => e[2]));
  const iC = tl.findIndex((m) => /Compiling shaders$/.test(m)), iS = tl.findIndex((m) => /satellite view/.test(m)), iB = tl.findIndex((m) => /barrier satellite 1\/9/.test(m));
  const iD = tl.findIndex((m) => /draw scan: \d+ families, 0 refused/.test(m));
  ok(iC >= 0 && iS > iC && iD > iS && iB > iD, `log: shader compilation, satellite survey: draw sweep then tiles (${tl.filter((m) => /^map|barrier|draw/.test(m)).slice(-8).join(' > ')})`);
  ok(await page.evaluate(() => { const v = JSON.parse(localStorage.getItem('dc_gpu_ok')); return !!v && v.b === BUILD && v.maps.includes('chergui'); }), 'map that passed the sweep: kept for this build (no new sweep)');

  // 2. graphics report
  const rep = await page.evaluate(() => { gpuReport(); return { hidden: document.getElementById('gpuRep').classList.contains('hidden'), txt: document.getElementById('grTxt').textContent }; });
  ok(!rep.hidden, 'graphics report displayed');
  ok(/RGBA16F target: ok/.test(rep.txt) && /3D texture read: ok/.test(rep.txt), `render probes (${(rep.txt.match(/probes: .*/) || [''])[0]})`);
  ok(/map: sable \(ready\)/.test(rep.txt) && /safe mode no/.test(rep.txt), 'report: map and mode');
  ok(/timeline \(UTC/.test(rep.txt) && /barrier textures/.test(rep.txt) && /phase now menu/.test(rep.txt), 'report: timeline and phase');
  await page.screenshot({ path: OUT + '/gpu-report.png' }).catch(() => {});
  await page.evaluate(() => document.getElementById('grClose').click());

  // 2b. weapon thumbnails: never during the aerial view (the GPU draws constantly there; rendered into the canvas then copied, they made a
  //     Pixel lose its context 0.6 s after the class choice opened); rendered afterwards in the menus, into an offscreen target
  const r2b = await page.evaluate(async () => {
    const id = Object.keys(WEAPONS)[0]; delete VTHUMB.img[id];
    UI.flow = { online: false, map: 'chergui', deploy() {} }; UI.busy = false; uiOpen('deploy', ['main']);
    thumbsStart(); await new Promise((r) => setTimeout(r, 2500));
    const during = VTHUMB.img[id] === undefined;
    uiOpen('main'); await new Promise((r) => setTimeout(r, 3000));
    return { during, after: !!VTHUMB.img[id] && VTHUMB.img[id].length > 1000 };
  });
  ok(r2b.during && r2b.after, `thumbnails: suspended during the aerial view, rendered afterwards in the menus (${JSON.stringify(r2b)})`);

  // 3. context loss while the game is drawing (aerial view of the class choice)
  await page.evaluate(() => { UI.flow = { online: false, map: 'chergui', deploy() {} }; UI.busy = false; uiOpen('deploy', ['main']); });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { (window.__lc || (window.__lc = renderer.getContext().getExtension('WEBGL_lose_context'))).loseContext(); });
  await until(page, '!document.getElementById("gpuLost").classList.contains("hidden")', 60000);
  const lostRep = await page.evaluate(() => gpuReportText(false));
  ok(/context: LOST/.test(lostRep) && /WebGL 2 · /.test(lostRep) && /units 13/.test(lostRep) && !/null/.test(lostRep.split('\n').slice(0, 9).join(' ')), 'report taken with context lost: GPU characteristics kept (no null)');
  ok(/context LOST \(aerial/.test(lostRep) && /phase aerial/.test(lostRep), 'report: loss timestamped in the log, aerial phase');
  ok(/frame 1 \(\+\d+ ms\) calls \d+/.test(lostRep) && /context LOST \(aerial, visible, frame \d+\)/.test(lostRep), 'report: first render frames and loss timestamped in frames');
  const lost = await page.evaluate(() => ({ msg: document.getElementById('glMsg').textContent, safe: JSON.parse(localStorage.getItem('dc_settings')).gfxSafe, auto: JSON.parse(localStorage.getItem('dc_settings')).gfxSafeAuto === BUILD && BUILD !== '', armed: GPUX.armed }));
  await page.evaluate(() => sessionStorage.setItem('__safe', '1'));
  ok(lost.safe === true && lost.auto && lost.armed && /Economy graphics mode is now on/.test(lost.msg), `context lost: low-power mode kept (" ${lost.msg.slice(0, 60)}... ")`);
  await page.screenshot({ path: OUT + '/gpu-lost.png' }).catch(() => {});
  await page.evaluate(() => (window.__lc || (window.__lc = renderer.getContext().getExtension('WEBGL_lose_context'))).restoreContext());

  // 4. relaunch: low-power mode
  await page.reload();
  await until(page, "typeof MATCH!=='undefined' && MATCH.state==='menu'", 600000);
  const r4 = await page.evaluate(() => ({ safe: GFX_SAFE, sh: RQ.q.shadow, pr: RQ.q.pr, pre: NO_PREPASS, tier: RQ.tier }));
  ok(r4.safe && r4.sh === 512 && r4.pr === 0.6 && r4.pre && r4.tier === 'low', `relaunched in low-power mode (shadows ${r4.sh}, render ${r4.pr})`);
  const opt = await page.evaluate(() => { const o = OPT_TABS.find((t) => t[0] === 'Video'); return o[1].some((r) => r[1] === 'gfxSafe') && o[1].some((r) => r[1] === 'Graphics report'); });
  ok(opt, 'Options, Video: low-power mode and graphics report');

  // 5. new loss while low-power mode is already active: different message, no loop
  await page.evaluate(() => { document.getElementById('wnOk') && document.getElementById('wnOk').click(); window.__lc = renderer.getContext().getExtension('WEBGL_lose_context'); (window.__lc || (window.__lc = renderer.getContext().getExtension('WEBGL_lose_context'))).loseContext(); });
  await until(page, '!document.getElementById("gpuLost").classList.contains("hidden")', 60000);
  ok(await page.evaluate(() => /interrupted again/.test(document.getElementById('glMsg').textContent)), 'already in low-power mode: the message says so');
  await page.evaluate(() => { (window.__lc || (window.__lc = renderer.getContext().getExtension('WEBGL_lose_context'))).restoreContext(); });
  await page.reload();
  await until(page, "typeof MATCH!=='undefined' && MATCH.state==='menu'", 600000);
  await page.evaluate(() => { document.getElementById('wnOk') && document.getElementById('wnOk').click(); window.__lc = renderer.getContext().getExtension('WEBGL_lose_context'); });

  // 6. loss during compilation: clean failure, loading screen with its buttons
  await page.evaluate(() => {
    Settings.gfxSafe = false; saveSettings();
    const c = renderer.compile.bind(renderer); let n = 0;
    renderer.compile = (s, k) => { c(s, k); if (++n === 4) (window.__lc || (window.__lc = renderer.getContext().getExtension('WEBGL_lose_context'))).loseContext(); };
    window.__flow = { online: false, map: 'chergui', deploy() {} }; menuLaunch(window.__flow);
  });
  await until(page, '!document.getElementById("mlBack").classList.contains("hidden")', 900000);
  const f = await page.evaluate(() => ({ msg: document.getElementById('mlMsg').textContent, rep: !document.getElementById('mlRep').classList.contains('hidden'), safeBtn: !document.getElementById('mlSafe').classList.contains('hidden'), lostBox: !document.getElementById('gpuLost').classList.contains('hidden') }));
  ok(/during loading/.test(f.msg) && !/trim/.test(f.msg), `loss during compilation: clear message (" ${f.msg.slice(0, 90)}... ")`);
  ok(f.rep, "\"Graphics report\" button on the failure screen");
  ok(f.lostBox, '"3D display interrupted" window on top');
  await page.screenshot({ path: OUT + '/gpu-failure.png' }).catch(() => {});

  // 7. low-power mode armed on its own by an older build: lifted at load (once only); chosen by the player: kept
  await page.evaluate(() => sessionStorage.setItem('__safe', 'build-old'));
  await page.reload();
  await until(page, "typeof MATCH!=='undefined' && MATCH.state==='menu'", 600000);
  const old7 = await page.evaluate(() => ({ safe: GFX_SAFE, st: JSON.parse(localStorage.getItem('dc_settings')) }));
  ok(old7.safe === false && !old7.st.gfxSafe, 'low-power mode armed by an older build: lifted, the game retries with the normal profile');
  await page.evaluate(() => sessionStorage.setItem('__safe', '1'));
  await page.reload();
  await until(page, "typeof MATCH!=='undefined' && MATCH.state==='menu'", 600000);
  ok(await page.evaluate(() => GFX_SAFE === true), 'low-power mode chosen in the Options: kept');

  // 8. a program rejected by the device (context lost during its compilation): full inventory despite the loss, log kept, window to relaunch
  await page.evaluate(() => { sessionStorage.removeItem('__safe'); localStorage.removeItem('dc_gpu_bad'); localStorage.removeItem('dc_gpu_last'); });
  await page.reload();
  await until(page, "typeof MATCH!=='undefined' && MATCH.state==='menu'", 600000);
  await page.evaluate(() => {
    document.getElementById('wnOk') && document.getElementById('wnOk').click();
    const lc = renderer.getContext().getExtension('WEBGL_lose_context'), c = renderer.compile.bind(renderer); let n = 0;
    renderer.compile = (s, k) => { c(s, k); if (++n === 4) { lc.loseContext(); setTimeout(() => lc.restoreContext(), 400); } };
    window.__p = mapEnsure('chergui').then(() => 'ok', () => 'ko');
  });
  await until(page, 'MAPL.fail || MAPL.state === "ready"', 900000);
  const r8 = await page.evaluate(() => ({ cul: GPUX.culprits.length, rest: GPUX.restored, bad: JSON.parse(localStorage.getItem('dc_gpu_bad')), last: JSON.parse(localStorage.getItem('dc_gpu_last')), overlay: !document.getElementById('gpuLost').classList.contains('hidden'), msg: document.getElementById('glMsg').textContent, rep: gpuReportText(false) }));
  ok(r8.cul === 1 && r8.rest >= 1, `rejected program: recorded after the context recovery (${r8.cul} rejected, ${r8.rest} resumed)`);
  ok(r8.bad && r8.bad.keys.length === 1 && r8.last && /\d+\/\d+/.test(r8.last.cur), 'rejected family and log kept in storage');
  ok(r8.overlay && /refused some of the game/.test(r8.msg), `window to relaunch (" ${r8.msg.slice(0, 60)}... ")`);
  ok(/programs the device refused/.test(r8.rep) && /previous interruption/.test(r8.rep), 'report: rejected program and last interruption');
  // next load: the rejected family is replaced by a simple version and the map loads
  await page.reload();
  await until(page, "typeof MATCH!=='undefined' && MATCH.state==='menu'", 600000);
  await page.evaluate(() => { document.getElementById('wnOk') && document.getElementById('wnOk').click(); window.__p = mapEnsure('chergui').then(() => 'ok', (e) => 'ko ' + e.message); });
  await until(page, 'MAPL.fail || MAPL.state === "ready"', 900000);
  const r9 = await page.evaluate(() => { let n = 0; scene.traverse((o) => { if (o.material && o.material.name === 'fallbackMode') n++; if (o.visible === false && o.userData.gpuFallback) n++; }); return { st: MAPL.state, fb: GPUX.fallbacks, n, cul: GPUX.culprits.length }; });
  ok(r9.st === 'ready' && r9.fb > 0 && r9.n > 0 && r9.cul === 0, `reloaded: ${r9.fb} objects in simple version, the map loads`);

  // 10. context loss detected by a barrier ("satellite" step): the step is lightened for the future, the page relaunches itself, the solo match
  //     resumes and loads, satellite survey at low resolution
  await page.evaluate(() => { sessionStorage.setItem('dc_gpu_auto', '0'); localStorage.removeItem('dc_gpu_lean'); localStorage.removeItem('dc_gpu_bad'); });
  await page.reload();
  await until(page, "typeof MATCH!=='undefined' && MATCH.state==='menu'", 600000);
  await page.evaluate(() => {
    document.getElementById('wnOk') && document.getElementById('wnOk').click();
    const gl = renderer.getContext(), lc = gl.getExtension('WEBGL_lose_context'), f = gl.fenceSync.bind(gl); let n = 0;
    gl.fenceSync = (c, fl) => { const r = f(c, fl); if (/^satellite/.test(GPUX.barTag) && ++n === 2) { lc.loseContext(); setTimeout(() => lc.restoreContext(), 300); } return r; }; // second tile of the satellite survey
    menuLaunch({ online: false, map: 'chergui', deploy() {} });
  });
  let r10 = null; const t10 = Date.now();
  while (Date.now() - t10 < 1500000) { // the page reloads: we query the new one
    await new Promise((r) => setTimeout(r, 2500));
    r10 = await page.evaluate(() => (typeof MAPL !== 'undefined' && typeof GPUX !== 'undefined' && MAPL.state === 'ready' ? { lean: GPUX.lean, auto: sessionStorage.getItem('dc_gpu_auto'), ls: JSON.parse(localStorage.getItem('dc_gpu_lean')), sat: !!KS.sat, rep: gpuReportText(false) } : null)).catch(() => null);
    if (r10) break;
  }
  ok(!!r10 && r10.lean.sat === 1 && r10.ls && r10.ls.sat === 1, '"satellite" barrier: step lightened and kept for the future');
  ok(!!r10 && r10.auto === '1', "the page relaunched itself (once)");
  ok(!!r10 && r10.sat && /satellite low-res/.test(r10.rep) && /barriers/.test(r10.rep), 'the match resumes and loads, satellite survey at low resolution, report completed');

  // 11. lightening ladder: a second loss at the satellite survey, already at low resolution: no more GPU rendering of the survey (drawn without it), the map loads
  await page.evaluate(() => { sessionStorage.setItem('dc_gpu_auto', '0'); });
  await page.reload();
  await until(page, "typeof MATCH!=='undefined' && MATCH.state==='menu'", 600000);
  await page.evaluate(() => {
    document.getElementById('wnOk') && document.getElementById('wnOk').click();
    const gl = renderer.getContext(), lc = gl.getExtension('WEBGL_lose_context'), f = gl.fenceSync.bind(gl); let n = 0;
    gl.fenceSync = (c, fl) => { const r = f(c, fl); if (/^satellite/.test(GPUX.barTag) && ++n === 1) { lc.loseContext(); setTimeout(() => lc.restoreContext(), 300); } return r; };
    menuLaunch({ online: false, map: 'chergui', deploy() {} });
  });
  let r11 = null; const t11 = Date.now();
  while (Date.now() - t11 < 1500000) {
    await new Promise((r) => setTimeout(r, 2500));
    r11 = await page.evaluate(() => (typeof MAPL !== 'undefined' && typeof GPUX !== 'undefined' && MAPL.state === 'ready' ? { sat: GPUX.lean.sat, ks: !!KS.sat, rep: gpuReportText(false) } : null)).catch(() => null);
    if (r11) break;
  }
  ok(!!r11 && r11.sat === 2 && r11.ks && /not rendered/.test(r11.rep), 'second loss at the survey: survey drawn without the GPU, the map loads');

  // 14. draw sweep: a family whose drawing makes the context lose is recorded (list, storage, window); at the next load it is replaced by a
  //     simple version without cast shadow and the map loads
  await page.evaluate(() => { sessionStorage.setItem('dc_gpu_auto', '9'); localStorage.removeItem('dc_gpu_lean'); localStorage.removeItem('dc_gpu_bad'); localStorage.removeItem('dc_gpu_ok'); });
  await page.reload();
  await until(page, "typeof MATCH!=='undefined' && MATCH.state==='menu'", 600000);
  await page.evaluate(() => {
    document.getElementById('wnOk') && document.getElementById('wnOk').click();
    const lc = renderer.getContext().getExtension('WEBGL_lose_context'), r = renderer.render.bind(renderer); let done = false;
    renderer.render = (s, c) => { r(s, c); if (!done && /^draw MeshStandardMaterial/.test(GPUX.cur || '')) { done = true; lc.loseContext(); setTimeout(() => lc.restoreContext(), 300); } };
    window.__p = mapEnsure('chergui').then(() => 'ok', () => 'ko');
  });
  await until(page, 'MAPL.fail || MAPL.state === "ready"', 900000);
  const r14 = await page.evaluate(() => ({ cul: GPUX.culprits.filter((c) => /^draw /.test(c)), bad: JSON.parse(localStorage.getItem('dc_gpu_bad')), ok: localStorage.getItem('dc_gpu_ok'), overlay: !document.getElementById('gpuLost').classList.contains('hidden'), tl: GPU_EV.map((e) => e[2]).filter((m) => /draw scan/.test(m)) }));
  ok(r14.cul.length === 1 && r14.bad && r14.bad.keys.length === 1 && r14.overlay, `sweep: a rejected family recorded and kept (${r14.cul[0] && r14.cul[0].slice(0, 70)})`);
  ok(r14.ok === null && r14.tl.some((m) => /1 refused/.test(m)), 'sweep: the map is not marked as incident-free');
  await page.reload();
  await until(page, "typeof MATCH!=='undefined' && MATCH.state==='menu'", 600000);
  await page.evaluate(() => { document.getElementById('wnOk') && document.getElementById('wnOk').click(); window.__p = mapEnsure('chergui').then(() => 'ok', (e) => 'ko ' + e.message); });
  await until(page, 'MAPL.fail || MAPL.state === "ready"', 900000);
  const r14b = await page.evaluate(() => { let n = 0, shadow = 0; scene.traverse((o) => { if (o.userData.gpuFallback) { n++; if (o.castShadow) shadow++; } }); return { st: MAPL.state, n, shadow, cul: GPUX.culprits.length, ok: JSON.parse(localStorage.getItem('dc_gpu_ok')) }; });
  ok(r14b.st === 'ready' && r14b.n > 0 && r14b.shadow === 0 && r14b.cul === 0 && r14b.ok && r14b.ok.maps.includes('chergui'), `sweep: family replaced (${r14b.n} objects, without cast shadow), the map loads and passes the sweep`);

  // 15. loss at the aerial view: no automatic reload (the loss is attributed to the page, Chrome may block it for a few minutes); the window stays with its report
  await page.evaluate(() => { sessionStorage.setItem('dc_gpu_auto', '0'); window.__l15 = GPUX.lost; UI.flow = { online: false, map: 'chergui', deploy() {} }; UI.busy = false; uiOpen('deploy', ['main']); });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { const lc = renderer.getContext().getExtension('WEBGL_lose_context'); lc.loseContext(); setTimeout(() => lc.restoreContext(), 400); });
  await page.waitForTimeout(6000);
  const r15 = await page.evaluate(async () => { const f0 = GPUF.last; await new Promise((r) => setTimeout(r, 600)); return { lost: GPUX.lost - window.__l15, auto: sessionStorage.getItem('dc_gpu_auto'), overlay: !document.getElementById('gpuLost').classList.contains('hidden'), halt: GPUX.halt, still: GPUF.last === f0 }; });
  ok(r15.lost === 1 && r15.auto === '0' && r15.overlay, `loss at the aerial view: no automatic reload, the window stays (${JSON.stringify(r15)})`);
  ok(r15.halt && r15.still, 'loss at the aerial view: the frame loop no longer draws');

  await browser.close();

  // 12. loss at the install window (nothing is built): no alert window and no low-power mode; startup waits for the context to recover
  const G = await openGame({ page: process.env.PAGE, mobile: true, w: 444, h: 839, dpr: 2.4375, settings: { quality: 'auto' }, noMap: true, noHdri: true, init: LIMIT13, pwa: true, gate: true });
  const gp = G.page;
  await gp.waitForFunction("typeof PWA !== 'undefined' && PWA.gate === true", null, { timeout: 60000 });
  await gp.evaluate(() => { window.__lc = renderer.getContext().getExtension('WEBGL_lose_context'); window.__lc.loseContext(); });
  await gp.waitForTimeout(1500);
  const g12 = await gp.evaluate(() => ({ lost: GPUX.lost, phase: gpuPhase(), overlay: !document.getElementById('gpuLost').classList.contains('hidden'), safe: JSON.parse(localStorage.getItem('dc_settings')).gfxSafe === true }));
  ok(g12.lost === 1 && g12.phase === 'gate' && !g12.overlay && !g12.safe, 'loss at the install window: no "3D display interrupted" window, no low-power mode');
  await gp.evaluate(() => { pwaBrowser(); setTimeout(() => window.__lc.restoreContext(), 1500); }); // the player gets through the install window during the loss: startup waits
  await gp.waitForFunction("typeof MATCH !== 'undefined' && MATCH.state === 'menu'", null, { timeout: 600000, polling: 500 });
  const g12b = await gp.evaluate(() => ({ lost: gpuLostNow(), rest: GPUX.restored, tl: GPU_EV.map((e) => e[2]), rep: gpuReportText(false), url: location.href }));
  ok(!g12b.lost && g12b.rest === 1 && !/automatic reload/.test(g12b.tl.join('|')), 'startup waited for the context to recover, no reload (nothing had been built)');
  ok(/install gate shown/.test(g12b.tl.join('|')) && /context LOST \(gate/.test(g12b.tl.join('|')) && /boot waits for the context/.test(g12b.tl.join('|')), 'log: install window, loss, wait for the context');

  // 13. loss in the menus then recovery: the page relaunches itself (textures generated on the GPU are lost), without low-power mode
  await gp.evaluate(() => { sessionStorage.setItem('dc_gpu_auto', '0'); document.getElementById('wnOk') && document.getElementById('wnOk').click(); window.__lc = renderer.getContext().getExtension('WEBGL_lose_context'); window.__lc.loseContext(); setTimeout(() => window.__lc.restoreContext(), 600); });
  let r13 = null, last13 = null; const t13 = Date.now();
  while (Date.now() - t13 < 600000) {
    await new Promise((r) => setTimeout(r, 2500));
    last13 = await gp.evaluate(() => { try { return { st: MATCH.state, auto: sessionStorage.getItem('dc_gpu_auto'), safe: GFX_SAFE, tl: GPU_EV.map((e) => e[2]).join('|') }; } catch (e) { return { err: String(e.message || e) }; } }).catch((e) => ({ nav: String(e.message || e).slice(0, 80) }));
    if (last13 && last13.st === 'menu' && last13.auto === '1') { r13 = last13; break; }
  }
  ok(!!r13 && !r13.safe && /context LOST \(menu/.test(r13.tl) && /automatic reload 1/.test(r13.tl), 'loss in the menus: the page relaunches itself, low-power mode not armed' + (!r13 ? ' ' + JSON.stringify(last13).slice(-900) : '') + (r13 && !(!r13.safe && /context LOST \(menu/.test(r13.tl) && /automatic reload 1/.test(r13.tl)) ? ' ' + JSON.stringify(r13).slice(0, 700) : ''));

  // 16. phone that is not a PowerVR: a loss while the game is drawing turns off computed shadows for later launches (learned, 30 days)
  await gp.evaluate(() => { document.getElementById('wnOk') && document.getElementById('wnOk').click(); window.__j = mapEnsure('chergui'); });
  await gp.waitForFunction("(() => { try { return MAPL.state === 'ready' || !!MAPL.fail; } catch (e) { return false; } })()", null, { timeout: 900000, polling: 1000 });
  const r16a = await gp.evaluate(async () => {
    const before = NO_SHADOWS; UI.flow = { online: false, map: 'chergui', deploy() {} }; UI.busy = false; uiOpen('deploy', ['main']);
    await new Promise((r) => setTimeout(r, 2000)); sessionStorage.setItem('dc_gpu_auto', '9');
    renderer.getContext().getExtension('WEBGL_lose_context').loseContext(); await new Promise((r) => setTimeout(r, 800));
    return { before, stored: !!localStorage.getItem('dc_gpu_noshadow') };
  });
  await gp.reload();
  await gp.waitForFunction("(() => { try { return MATCH.state === 'menu'; } catch (e) { return false; } })()", null, { timeout: 600000, polling: 500 });
  const r16b = await gp.evaluate(() => ({ no: NO_SHADOWS, why: SHADOWS.why, on: renderer.shadowMap.enabled }));
  ok(!r16a.before && r16a.stored && r16b.no && !r16b.on && /learned/.test(r16b.why), `loss at the aerial view (non-PowerVR): computed shadows turned off at later launches (${JSON.stringify([r16a, r16b])})`);
  await G.browser.close();
  console.log(fails ? `${fails} failure(s)` : 'all good');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
