/* Stutters: what the player feels when the camera moves and the median frames per second does not show (an isolated slow frame from time to
   time). Plays the real frame() loop (bots in a match, protected player advancing, camera sweeping right then left), times
   each step of the loop, records the garbage collector pauses (V8 traces) and the bytes allocated, then gives: the distribution of frame times
   (median, 99th percentile, worst), the costliest steps and those that cause the spikes, the garbage collector pauses, and the slow frames
   with the step responsible.
   Software rendering (SwiftShader) takes seconds per frame: it is suppressed. The game does all its CPU work (computations, scene
   traversal, three.js states and uniforms, WebGL calls), only the draw commands (drawArrays, drawElements, their variants) are ignored once
   the match has started: what is measured is the main thread time, independent of the graphics card, apart from those draw commands (a
   thousand calls cost 1 to 2 ms more on a real machine). Frames are played one by one at FPS simulated frames per second
   (dt of 1/FPS: the same computations, the same number of allocations per frame as at that rate).
   node stutters.js [frames=2000]   MAP=sirocco (default) ; MODE=tdm (default), ffa or dom ; FPS=280 ; Q=high ; TURN=3 (mouse pixels per frame, 0: fixed camera) ; RUN=0 (player
   still) ; PAGE=other/version.html ; TOP=8 ; ALLOC=25 (bytes allocated per function, the first 25) ; OLD=1 (with ALLOC: only objects that survive a minor garbage collection, those that end up in the old generation and trigger the big pauses) ; STEPS=3 (steps cited per slow frame) ; EXTRA=f,g (additional functions timed) ; PROF=25 (self time per function; do not combine with ALLOC, which slows everything down) ; W=128 H=72 (window size: small,
   so that the commands not suppressed, clearing render targets for example, cost nothing) ; JSON=1 (writes stutters-<map>.json). */
const fs = require('fs'), path = require('path');
const { openGame, HERE } = require('./common');
const N = +(process.argv[2] || 2000), MAP = process.env.MAP || 'sirocco', TOP = +(process.env.TOP || 8), FPS = +(process.env.FPS || 280);
(async () => {
  const { browser, page, logs } = await openGame({ page: process.env.PAGE, w: +(process.env.W || 128), h: +(process.env.H || 72), noHdri: true,
    init: `window.__DRAWS = 0; window.__noDraw = false; (() => { for (const k of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements']) { const o = WebGL2RenderingContext.prototype[k]; WebGL2RenderingContext.prototype[k] = function () { if (window.__noDraw) { window.__DRAWS++; return; } return o.apply(this, arguments); }; } })();`,
    settings: { quality: process.env.Q || 'high', dynres: false, difficulty: 1, map: MAP, mode: process.env.MODE || 'tdm' } });
  const cdp = await page.context().newCDPSession(page);
  const evts = []; cdp.on('Tracing.dataCollected', (d) => evts.push(...d.value));
  await page.evaluate(() => { LOCK.fallback = true; startMatch({}); PL.ent.protT = 1e9; });
  await page.waitForFunction(() => MATCH.state === 'playing' && frameN > 3, null, { timeout: 600000, polling: 500 });
  // from here on: no more draw commands, no more browser frame loop (frames are played one by one by this script)
  await page.evaluate(([FPS, TURN, RUN, COUNT, EXTRA]) => {
    window.__noDraw = true;
    const rafReal = window.requestAnimationFrame; window.requestAnimationFrame = () => 0; window.__rafReal = rafReal;
    const R = { frames: [], cur: null };
    window.__R = R;
    const wrap = (name) => { const f = window[name]; if (typeof f !== 'function' || f.__w) return; const g = function () { const t = performance.now(); try { return f.apply(this, arguments); } finally { if (R.cur) R.cur[name] = (R.cur[name] || 0) + performance.now() - t; } }; g.__w = 1; window[name] = g; };
    for (const n of ['padTick', 'musicTick', 'sfxTick', 'modeUpdate', 'updatePlayer', 'updateBot', 'updateNades', 'updateDrops', 'updateProps', 'updateKillstreak', 'updateAircraft',
      'drawTacMap', 'updateHud', 'netUpdate', 'kcRecord', 'mapUpdate', 'updatePostFx', 'updateFx', 'updateFlashLights', 'updateListener', 'allyMarksUpdate', 'updateSoldierLods',
      'clothUpdate', 'updateMapDetail', 'grassUpdate', 'updateShadows', 'gpuFrame', 'updateDynRes', 'markPrepass', 'touchTick', 'findPath', 'animSoldier', 'botSense', 'decideTactic', 'botsTick', 'renderFrame', ...(EXTRA ? EXTRA.split(',') : [])]) wrap(n);
    const r0 = composer.render.bind(composer); composer.render = function (dt) { const t = performance.now(); r0(dt); if (R.cur) R.cur.render = (R.cur.render || 0) + performance.now() - t; };
    // shadow cascades redrawn on this frame: needsUpdate is reset to false by three.js at render, read it right after updateShadows
    const us = window.updateShadows; window.updateShadows = function () { us(); if (R.cur) R.cur.cascades = csm ? csm.lights.filter((l) => l.shadow.needsUpdate).length : 0; };
    // muzzle flashes: frame where a flash starts, frame where the last one goes out (the number of lights declared to the shader changes: all lit materials are re-evaluated)
    const fl = window.flashLight; window.flashLight = function () { if (R.cur) R.cur.flash = 1; return fl.apply(this, arguments); };
    let anyOn = false; const ul = window.updateFlashLights; window.updateFlashLights = function (dt) { ul(dt); const on = flashLights.some((f) => f.light.visible); if (R.cur && on !== anyOn) R.cur.flashEdge = 1; anyOn = on; };
    // each renderer.render call: the scene (or the weapon scene, or a full-screen post-processing quad), its time and its draw calls
    const rr = renderer.render.bind(renderer); let nq = 0;
    renderer.render = function (sc, cam) {
      const t = performance.now(), c0 = renderer.info.render.calls; rr(sc, cam);
      if (R.cur) { const kd = sc === scene ? 'pass:scene' : sc === vmScene ? 'pass:weapon' : 'pass:fullscreen'; R.cur[kd] = (R.cur[kd] || 0) + performance.now() - t; R.cur[kd + ' (calls)'] = (R.cur[kd + ' (calls)'] || 0) + renderer.info.render.calls - c0; R.cur['passes'] = (R.cur['passes'] || 0) + 1; }
    };
    // three.js operation counters, per frame (COUNT=1): they do not depend on machine noise, unlike times
    window.__cnt = { mm: 0, um: 0, umw: 0, bones: 0 };
    if (COUNT) {
      const C = window.__cnt, M4 = THREE.Matrix4.prototype, O3 = THREE.Object3D.prototype, mm = M4.multiplyMatrices, um = O3.updateMatrix, umw = O3.updateMatrixWorld;
      M4.multiplyMatrices = function (a, b) { C.mm++; return mm.call(this, a, b); }; O3.updateMatrix = function () { C.um++; return um.call(this); };
      O3.updateMatrixWorld = function (f) { C.umw++; return umw.call(this, f); };
    }
    const fr = window.frame; let now = performance.now(), k = 0;
    window.__play = (n) => {
      for (let i = 0; i < n; i++) {
        const C0 = window.__cnt ? { ...window.__cnt } : null;
        now += 1000 / FPS; k++;
        if (TURN) mouseDX += TURN * (Math.sin(k / FPS / 1.5) > -0.2 ? 1 : -1); // the camera sweeps right then left
        if (RUN) KEYS.KeyW = true;
        R.cur = {}; const P0 = renderer.info.programs ? renderer.info.programs.length : 0, t0 = performance.now();
        try { fr(now); } finally { R.cur.total = performance.now() - t0; R.cur.newProg = (renderer.info.programs ? renderer.info.programs.length : 0) - P0; R.cur.calls = renderer.info.render.calls; if (C0) { R.cur.mm = window.__cnt.mm - C0.mm; R.cur.um = window.__cnt.um - C0.um; R.cur.umw = window.__cnt.umw - C0.umw; } R.frames.push(R.cur); R.cur = null; }
      }
      return R.frames.length;
    };
  }, [FPS, +(process.env.TURN === undefined ? 3 : process.env.TURN), process.env.RUN !== '0', !!process.env.COUNT, process.env.EXTRA || '']);
  // warm-up (late compilations, first garbage collections), no trace
  await page.evaluate(() => window.__play(200)); await page.evaluate(() => { window.__R.frames.length = 0; });
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,v8,disabled-by-default-v8.gc', transferMode: 'ReportEvents' });
  if (process.env.ALLOC) await cdp.send('HeapProfiler.enable'), await cdp.send('HeapProfiler.startSampling', { samplingInterval: 256, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: !process.env.OLD });
  if (process.env.PROF) await cdp.send('Profiler.enable'), await cdp.send('Profiler.setSamplingInterval', { interval: 200 }), await cdp.send('Profiler.start');
  const t0 = Date.now();
  for (let done = 0; done < N; done += 250) await page.evaluate((n) => window.__play(n), Math.min(250, N - done));
  const wall = (Date.now() - t0) / 1000;
  let cpu = null; if (process.env.PROF) cpu = (await cdp.send('Profiler.stop')).profile;
  let prof = null; if (process.env.ALLOC) prof = (await cdp.send('HeapProfiler.stopSampling')).profile;
  await new Promise((res) => { cdp.once('Tracing.tracingComplete', res); cdp.send('Tracing.end'); });
  const R = await page.evaluate(() => window.__R.frames), info = await page.evaluate(() => ({ hf: typeof HF === 'undefined' ? '-' : HF.k, finite: entities.every((e) => Number.isFinite(e.pos.x + e.pos.y + e.pos.z)), kills: entities.reduce((a, e) => a + e.kills, 0), deaths: entities.reduce((a, e) => a + e.deaths, 0), map: CURMAP.id, q: RQ.q.label, scale: RQ.scale, ents: entities.length, draws: window.__DRAWS, bodies: PHYS.bodies.length }));
  const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
  const tot = R.map((f) => f.total), f1 = (v) => v.toFixed(2), f0 = (v) => v.toFixed(0);
  const budget = 1000 / FPS;
  console.log(`high rate HF.k = ${info.hf} · finite positions: ${info.finite} · kills ${info.kills}, deaths ${info.deaths}`);
  console.log(`${info.map}: ${R.length} frames played at ${FPS} simulated f/s (${f0(wall)} real s), ${info.q}, ${info.ents} soldiers, ${f0(info.draws / R.length)} draw commands ignored per frame, ${info.bodies} props`);
  console.log(`main thread time per frame (ms): median ${f1(pct(tot, 0.5))} · p95 ${f1(pct(tot, 0.95))} · p99 ${f1(pct(tot, 0.99))} · p99.9 ${f1(pct(tot, 0.999))} · worst ${f1(Math.max(...tot))}   (budget at ${FPS} f/s: ${f1(budget)} ms)`);
  const over = tot.filter((t) => t > budget * 1.5).length;
  console.log(`frames beyond 1.5 times the budget: ${over} (${(100 * over / tot.length).toFixed(1)} %)`);
  const cl = R.map((f) => f.calls), cs = R.map((f) => f.cascades || 0);
  console.log(`render calls per frame: median ${f0(pct(cl, 0.5))} (from ${f0(Math.min(...cl))} to ${f0(Math.max(...cl))}) · shadow cascades redrawn per frame: ${f1(cs.reduce((a, b) => a + b, 0) / cs.length)} on average`);
  { const edge = R.filter((f) => f.flashEdge), calm = R.filter((f) => !f.flashEdge), mean = (a, k) => a.reduce((s, f) => s + (f[k] || 0), 0) / Math.max(1, a.length);
    console.log(`frames where the flash light state changes: ${edge.length} of ${R.length} · average render time ${f1(mean(edge, 'render'))} ms versus ${f1(mean(calm, 'render'))} ms for the others (worst ${f1(Math.max(0, ...edge.map((f) => f.render || 0)))} ms)`); }
  { const pr = R.map((f) => f.passes || 0), mean = (k) => R.reduce((s, f) => s + (f[k] || 0), 0) / R.length;
    console.log(`renders per frame: ${f1(pr.reduce((a, b) => a + b, 0) / R.length)} · scene ${f1(mean('pass:scene'))} ms for ${f0(mean('pass:scene (calls)'))} calls (shadows included) · weapon ${f1(mean('pass:weapon'))} ms for ${f0(mean('pass:weapon (calls)'))} calls · full screen ${f1(mean('pass:fullscreen'))} ms for ${f0(mean('pass:fullscreen (calls)'))} calls`); }
  if (process.env.COUNT) { const m = (k) => R.reduce((s, f) => s + (f[k] || 0), 0) / R.length; console.log(`three.js operations per frame: ${f0(m('mm'))} matrix multiplications · ${f0(m('um'))} updateMatrix · ${f0(m('umw'))} updateMatrixWorld (all objects)`); }
  const names = new Set(); for (const f of R) for (const k of Object.keys(f)) if (!['total', 'calls', 'cascades', 'flash', 'flashEdge', 'passes', 'mm', 'um', 'umw', 'newProg'].includes(k) && !/\(calls\)/.test(k)) names.add(k);
  const rows = [...names].map((k) => { const v = R.map((f) => f[k] || 0); return { k, moy: v.reduce((a, b) => a + b, 0) / v.length, p99: pct(v, 0.99), max: Math.max(...v) }; }).sort((a, b) => b.moy - a.moy);
  console.log('step                        mean      99th pct      worst   (ms)');
  for (const r of rows.slice(0, 14)) console.log(`  ${r.k.padEnd(22)} ${f1(r.moy).padStart(8)}  ${f1(r.p99).padStart(10)}  ${f1(r.max).padStart(7)}`);
  // garbage collector (V8 traces): duration and bytes allocated between two runs
  const gcs = evts.filter((e) => /^(MinorGC|MajorGC)$/.test(e.name) && e.ph === 'X').sort((a, b) => a.ts - b.ts);
  const minor = gcs.filter((g) => g.name === 'MinorGC'), major = gcs.filter((g) => g.name === 'MajorGC');
  let bytes = 0, prev = null; for (const g of gcs) { const a = g.args || {}, before = a.usedHeapSizeBefore, after = a.usedHeapSizeAfter; if (prev !== null && before !== undefined) bytes += Math.max(0, before - prev); if (after !== undefined) prev = after; }
  if (process.env.GCDETAIL) { for (const g of major) console.log('  major garbage collection', JSON.stringify({ ms: +(g.dur / 1000).toFixed(1), args: g.args })); const kinds = new Map(); for (const e of evts) if (/GC/i.test(e.name) && e.ph === 'X') kinds.set(e.name, (kinds.get(e.name) || 0) + 1); console.log('  GC events:', JSON.stringify([...kinds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12))); }
  const sum = (a) => a.reduce((s, g) => s + g.dur / 1000, 0), mx = (a) => Math.max(0, ...a.map((g) => g.dur / 1000));
  console.log(`garbage collector: ${minor.length} minor (${f1(sum(minor))} ms in total, longest ${f1(mx(minor))} ms) · ${major.length} major (${f1(sum(major))} ms, longest ${f1(mx(major))} ms)`);
  console.log(`allocated: about ${(bytes / R.length / 1024).toFixed(1)} KB per frame (${(bytes / R.length * FPS / 1048576).toFixed(0)} MB per second at ${FPS} f/s), a minor garbage collection every ${(R.length / Math.max(1, minor.length)).toFixed(0)} images`);
  if (prof) { // bytes allocated per function (heap sampling), biggest first
    // by call stack (the function and its three callers): a native function that allocates, like join or hypot, is attributed to its caller
    const by = new Map(); let all = 0; const nm = (n) => (n.callFrame.functionName || '(anonymous)') + ':' + n.callFrame.lineNumber;
    const walk = (n, st) => { const stack = [n, ...st].slice(0, 4); const k = stack.map(nm).join(' <- '); by.set(k, (by.get(k) || 0) + n.selfSize); all += n.selfSize; for (const c of n.children) walk(c, [n, ...st]); };
    walk(prof.head, []);
    console.log(`allocations by call stack (${(all / R.length / 1024).toFixed(0)} KB per sampled frame):`);
    for (const [k, v] of [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, +process.env.ALLOC)) console.log(`  ${(v / R.length / 1024).toFixed(1).padStart(7)} KB/image  ${k}`);
  }
  if (cpu) { // self CPU time of each function (sampling profiler), per frame
    const self = new Map(), byId = new Map(cpu.nodes.map((n) => [n.id, n])); let tot2 = 0;
    for (let i = 0; i < cpu.samples.length; i++) { const n = byId.get(cpu.samples[i]), dt = (cpu.timeDeltas[i] || 0) / 1000, f = n.callFrame, k = (f.functionName || '(anonymous)') + ' ' + path.basename(f.url || '') + ':' + f.lineNumber; self.set(k, (self.get(k) || 0) + dt); tot2 += dt; }
    console.log(`self time per function (ms per frame, ${(tot2 / R.length).toFixed(2)} ms sampled):`);
    for (const [k, v] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, +process.env.PROF)) console.log(`  ${(v / R.length).toFixed(3).padStart(8)} ms/image  ${k}`);
    // cumulative time (the function and everything it calls), once per stack even if the function calls itself
    const par = new Map(); for (const n of cpu.nodes) for (const c of n.children || []) par.set(c, n.id);
    const incl = new Map(), key = (n) => (n.callFrame.functionName || '(anonymous)') + ' ' + path.basename(n.callFrame.url || '') + ':' + n.callFrame.lineNumber;
    for (let i = 0; i < cpu.samples.length; i++) { const dt = (cpu.timeDeltas[i] || 0) / 1000, seen = new Set(); for (let id = cpu.samples[i]; id !== undefined; id = par.get(id)) { const k = key(byId.get(id)); if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) || 0) + dt); } } }
    console.log('cumulative time per function (ms per frame):');
    for (const [k, v] of [...incl.entries()].sort((a, b) => b[1] - a[1]).slice(0, +process.env.PROF + 8)) console.log(`  ${(v / R.length).toFixed(3).padStart(8)} ms/image  ${k}`);
  }
  const comp = R.map((f, i) => ({ f, i })).filter((x) => x.f.newProg > 0);
  console.log(`frames that compile a shader program: ${comp.length} (${comp.reduce((a, x) => a + x.f.newProg, 0)} programs)${comp.length ? ' at frames ' + comp.slice(0, 12).map((x) => x.i + ' (' + f1(x.f.total) + ' ms)').join(', ') : ''}`);
  // slow frames: more than three times the median and at least 1 ms more
  const med = pct(tot, 0.5), slow = R.map((f, i) => ({ f, i })).filter((x) => x.f.total > Math.max(med * 3, med + 1)).sort((a, b) => b.f.total - a.f.total);
  console.log(`slow frames (more than 3 times the median): ${slow.length} of ${R.length}`);
  for (const { f, i } of slow.slice(0, TOP)) {
    const main = Object.entries(f).filter(([k]) => !['total', 'calls', 'cascades', 'flash', 'flashEdge', 'passes', 'mm', 'um', 'umw', 'newProg'].includes(k) && !/\(calls\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, +(process.env.STEPS || 3)).map(([k, v]) => `${k} ${f1(v)}`).join(', ');
    console.log(`  frame ${i}: ${f1(f.total)} ms (${main})${f.newProg ? ` · ${f.newProg} shader program(s) compiled` : ''}`);
  }
  if (process.env.JSON) fs.writeFileSync(path.join(HERE, 'stutters-' + MAP + '.json'), JSON.stringify({ info, n: tot.length, med, p99: pct(tot, 0.99), max: Math.max(...tot), rows, gc: { minor: minor.length, major: major.length, bytes } }));
  if (logs.filter((l) => !/ERR_FILE/.test(l)).length) console.log(logs.filter((l) => !/ERR_FILE/.test(l)).slice(0, 5).join('\n'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(2); });
