/* ==========================================================================
   PERFORMANCE RECORDER
   With the "Show performance" setting (Options, Video), each frame of a match is recorded, from deployment to the end
   screen (or the return to the menus): interval between two frames, time spent in our code and its breakdown by step (player, bots,
   props and projectiles, rest of the logic, scene preparation, shadows, rendering), measured GPU time, draw calls, awake
   props, explosions, flashes, eliminations, long browser tasks and JavaScript heap. The report ("Performance report",
   Options, Video, even when paused) gives the distribution of frame times over the match, one line per second and
   the worst hitches with what was going on. It is in English, technical like the graphics report, and kept in the browser
   (dc_perf_last) after the match. Requested by the owner to analyze the frame drops of a whole match (Port-Maël:
   from 280 to 140, sometimes 40 frames per second, on an RTX 3070).
   Cost: about ten clock reads per frame, no per-frame allocation (typed arrays reserved up front), one
   line per second.
   ========================================================================== */
const PFR_STEPS = ['player', 'bots', 'props', 'logic', 'prep', 'shadow', 'render'];
const PFR_BINS = [4, 5, 7.5, 9, 12, 17.5, 25, 34, 50, 100]; // interval class limits (ms): 240 Hz, 200, 144, 120, 90, 60, 40, 30, 20, 10 frames per second
const PFR_MAX = 1 << 20; // intervals kept for the match percentiles (one hour at 290 frames per second)
const PFR = {
  on: false, inFrame: false, lt: 0, t0: 0, map: '', mode: '', net: '', date: '',
  lap: new Float64Array(7), // time of the current frame by step (ms), in PFR_STEPS order
  all: new Float32Array(4096), n: 0, // all the intervals of the match (the array doubles when full, up to PFR_MAX)
  bins: new Uint32Array(11), stepSum: new Float64Array(7), cpuSum: 0,
  iv: new Float32Array(4096), ivN: 0, med: 0, // intervals of the current second, median of the previous one
  sec: [], s0: 0, // one line per second (array of numbers, see pfrSecond)
  c: { n: 0, iv: 0, ivMax: 0, cpu: 0, cpuMax: 0, step: new Float64Array(7), calls: 0, tris: 0, awake: 0, lagN: 0 },
  ev: new Uint16Array(3), evAll: new Uint32Array(3), evT: new Float64Array(3), // explosions, flashes, eliminations: in the current second, over the match, last hour (s)
  lt0: 0, ltN: 0, ltMs: 0, ltAll: 0, ltAllMs: 0, obs: null, // long tasks (PerformanceObserver)
  slow: [], last: '', // worst hitches; last report built
};
/* Start of recording: at the start of a match (startMatch), or when the setting is checked mid-match */
function pfrStart() {
  PFR.on = !!Settings.perf; PFR.inFrame = false; if (!PFR.on) return;
  PFR.t0 = performance.now(); PFR.s0 = PFR.t0; PFR.n = 0; PFR.ivN = 0; PFR.med = 0; PFR.cpuSum = 0;
  PFR.bins.fill(0); PFR.stepSum.fill(0); PFR.lap.fill(0); PFR.ev.fill(0); PFR.evAll.fill(0); PFR.evT.fill(-99);
  PFR.sec.length = 0; PFR.slow.length = 0; PFR.ltN = PFR.ltMs = PFR.ltAll = PFR.ltAllMs = 0;
  pfrSecReset();
  PFR.map = MATCH.online ? NET.cfg.map : Settings.map; PFR.mode = MATCH.mode;
  PFR.net = !MATCH.online ? 'solo' : 'online ' + NET.role; PFR.date = new Date().toISOString();
  if (!PFR.obs && typeof PerformanceObserver === 'function') {
    try {
      PFR.obs = new PerformanceObserver((l) => { if (!PFR.on) return; for (const e of l.getEntries()) { PFR.ltN++; PFR.ltMs += e.duration; PFR.ltAll++; PFR.ltAllMs += e.duration; } });
      PFR.obs.observe({ type: 'longtask', buffered: false });
    } catch (e) { PFR.obs = null; } // long tasks not tracked by this browser
  }
}
/* End of the match (end screen, return to the menus): the report is built and kept in the browser */
function pfrStop() {
  if (!PFR.on) return;
  PFR.on = false; PFR.inFrame = false;
  if (PFR.n < 30) return;
  PFR.last = pfrReport();
  try { localStorage.setItem('dc_perf_last', PFR.last); } catch (e) { /* storage full or unavailable */ }
}
function pfrSecReset() { const c = PFR.c; c.n = 0; c.iv = 0; c.ivMax = 0; c.cpu = 0; c.cpuMax = 0; c.step.fill(0); c.calls = 0; c.tris = 0; c.awake = 0; c.lagN = LAG.n; }
/* Time elapsed since the last mark, added to step i (called in frame and matchTick; nothing outside a drawn frame) */
function pfrLap(i) { if (!PFR.inFrame) return; const t = performance.now(); PFR.lap[i] += t - PFR.lt; PFR.lt = t; }
/* Match event: 0 explosion, 1 flash, 2 elimination */
function pfrEvent(k) { if (!PFR.on) return; PFR.ev[k]++; PFR.evAll[k]++; PFR.evT[k] = (performance.now() - PFR.t0) / 1000; }
/* End of a drawn frame: interval since the previous one, time spent in our code (cpu) */
function pfrFrame(now, interval, cpu) {
  PFR.inFrame = false;
  if (interval <= 0 || interval > 1000) { PFR.lap.fill(0); return; } // first frame, tab back from the background
  const c = PFR.c, L = PFR.lap, i = renderer.info.render;
  if (PFR.n < PFR.all.length) PFR.all[PFR.n] = interval;
  else if (PFR.n < PFR_MAX) { const a = new Float32Array(PFR.all.length * 2); a.set(PFR.all); PFR.all = a; PFR.all[PFR.n] = interval; }
  PFR.n++;
  let b = 0; while (b < PFR_BINS.length && interval >= PFR_BINS[b]) b++; PFR.bins[b]++;
  PFR.cpuSum += cpu;
  for (let k = 0; k < 7; k++) { c.step[k] += L[k]; PFR.stepSum[k] += L[k]; }
  c.n++; c.iv += interval; c.cpu += cpu; c.calls += i.calls; c.tris += i.triangles;
  if (interval > c.ivMax) c.ivMax = interval; if (cpu > c.cpuMax) c.cpuMax = cpu;
  const awake = typeof PHYS !== 'undefined' ? PHYS.awake.length : 0; if (awake > c.awake) c.awake = awake;
  if (PFR.ivN < PFR.iv.length) PFR.iv[PFR.ivN++] = interval;
  // hitch: more than twice the previous second's median, and more than 8 ms
  if (PFR.med > 0 && interval > 2 * PFR.med && interval > 8) pfrSlow(now, interval, cpu, i.calls, awake);
  L.fill(0);
  if (now - PFR.s0 >= 1000) pfrSecond(now);
}
function pfrSlow(now, interval, cpu, calls, awake) {
  const s = (now - PFR.t0) / 1000, L = PFR.lap, ev = [];
  if (s - PFR.evT[0] < 1) ev.push('explosion'); if (s - PFR.evT[1] < 1) ev.push('flash'); if (s - PFR.evT[2] < 1) ev.push('kill');
  PFR.slow.push([s, interval, cpu, L[0], L[1], L[2], L[3], L[4], L[5], L[6], calls, awake, DYN.gpu, ev.join('+')]);
  if (PFR.slow.length > 400) { PFR.slow.sort((a, b) => b[1] - a[1]); PFR.slow.length = 200; }
}
/* End of a second: its line, the median that serves as the hitch threshold for the next one */
function pfrSecond(now) {
  const c = PFR.c, n = Math.max(1, c.n), v = PFR.iv.subarray(0, PFR.ivN).sort();
  PFR.med = PFR.ivN ? v[PFR.ivN >> 1] : 0;
  const m = performance.memory, heap = m ? m.usedJSHeapSize / 1048576 : 0;
  PFR.sec.push([(PFR.s0 - PFR.t0) / 1000, c.n * 1000 / (now - PFR.s0), PFR.med, c.ivMax, c.cpu / n, c.cpuMax, DYN.gpu,
    c.step[0] / n, c.step[1] / n, c.step[2] / n, c.step[3] / n, c.step[4] / n, c.step[5] / n, c.step[6] / n,
    c.calls / n, c.tris / n / 1000, c.awake, heap, RQ.tier, RQ.scale, HF.k, LAG.n - c.lagN, PFR.ev[0], PFR.ev[1], PFR.ev[2], PFR.ltN, PFR.ltMs]);
  PFR.ev.fill(0); PFR.ltN = 0; PFR.ltMs = 0; PFR.ivN = 0; PFR.s0 = now;
  pfrSecReset();
}
/* The report, as text: to paste as is for analysis */
function pfrReport() {
  const f1 = (x) => (+x).toFixed(1), f2 = (x) => (+x).toFixed(2), N = Math.min(PFR.n, PFR_MAX);
  const all = PFR.all.slice(0, N).sort(), pct = (p) => (N ? all[Math.min(N - 1, Math.floor(N * p))] : 0);
  const dur = PFR.n ? PFR.all.subarray(0, N).reduce((a, x) => a + x, 0) / 1000 : 0;
  const bm = document.querySelector('meta[name="cod-build"]');
  // screen refresh rate: the most common interval among the shortest ones (the on-time frames)
  const refresh = N ? 1000 / pct(0.05) : 0;
  const L = [
    `War Bash ${bm ? bm.content : '?'} · performance report · ${PFR.date}`,
    navigator.userAgent,
    `screen ${screen.width}x${screen.height} · window ${innerWidth}x${innerHeight} · DPR ${devicePixelRatio} · GPU ${GPU.name || '?'} (class ${GPU.tier}) · cores ${navigator.hardwareConcurrency || '?'}${navigator.deviceMemory ? ' · memory ' + navigator.deviceMemory + ' GB' : ''}`,
    `settings: quality ${Settings.quality} (now ${RQ.tier} at scale ${f2(RQ.scale)}) · fps cap ${Settings.fpsMax === 'half' ? 'half the display (' + (VSYNC.ms ? Math.round(500 / VSYNC.ms) : '?') + ')' : +Settings.fpsMax || 'none'} · power saving ${Settings.eco ? 'on' : 'off'} · dynamic resolution ${Settings.dynres === false ? 'off' : 'on'} · AO ${Settings.ao ? 'on' : 'off'} · sun rays ${Settings.rays ? 'on' : 'off'} · grass ${Settings.grass === false ? 'off' : 'on'} · shadows ${NO_SHADOWS ? 'off' : 'on'} · GPU timer ${GPUT ? 'on' : 'off'}`,
    `match: map ${PFR.map} · mode ${PFR.mode} · ${PFR.net} · ${f1(dur)} s recorded · ${PFR.n} frames${PFR.n > PFR_MAX ? ' (percentiles on the first ' + PFR_MAX + ')' : ''}`,
    '',
    `frame interval (ms): median ${f2(pct(0.5))} · p90 ${f2(pct(0.9))} · p99 ${f2(pct(0.99))} · p99.9 ${f2(pct(0.999))} · worst ${f1(N ? all[N - 1] : 0)}`,
    `fps: average ${f1(dur ? PFR.n / dur : 0)} · median ${f1(N ? 1000 / pct(0.5) : 0)} · 1% low ${f1(N ? 1000 / pct(0.99) : 0)} · 0.1% low ${f1(N ? 1000 / pct(0.999) : 0)} · display about ${Math.round(refresh)} Hz`,
    'frames by interval: ' + [...PFR.bins].map((k, i) => `${i === 0 ? '<' + PFR_BINS[0] : i === PFR_BINS.length ? '>=' + PFR_BINS[i - 1] : PFR_BINS[i - 1] + '-' + PFR_BINS[i]} ms ${k} (${f1(PFR.n ? (100 * k) / PFR.n : 0)}%)`).join(' · '),
    `our code per frame (ms, average): total ${f2(PFR.n ? PFR.cpuSum / PFR.n : 0)} · ` + PFR_STEPS.map((s, k) => `${s} ${f2(PFR.n ? PFR.stepSum[k] / PFR.n : 0)}`).join(' · '),
    `events: ${PFR.evAll[0]} explosions · ${PFR.evAll[1]} flashbangs · ${PFR.evAll[2]} kills · ${PFR.ltAll} long tasks (${Math.round(PFR.ltAllMs)} ms)${PFR.obs ? '' : ' (long tasks not reported by this browser)'}`,
    '',
    'per second: t(s) fps median(ms) worst(ms) cpu(ms) cpuMax gpu(ms) | ' + PFR_STEPS.join(' ') + ' | calls tris(k) awakeProps heap(MB) tier scale hf skipped | explosions flashes kills longTasks(ms)',
  ];
  for (const r of PFR.sec) L.push(`${Math.round(r[0])} ${Math.round(r[1])} ${f2(r[2])} ${f1(r[3])} ${f2(r[4])} ${f1(r[5])} ${f2(r[6])} | ${r.slice(7, 14).map(f2).join(' ')} | ${Math.round(r[14])} ${Math.round(r[15])} ${r[16]} ${Math.round(r[17])} ${r[18]} ${f2(r[19])} ${r[20]} ${r[21]} | ${r[22]} ${r[23]} ${r[24]} ${r[25]}(${Math.round(r[26])})`);
  const slow = PFR.slow.slice().sort((a, b) => b[1] - a[1]).slice(0, 150);
  L.push('', `worst hitches (frames over twice the median of the second before and over 8 ms): ${PFR.slow.length >= 200 ? 'top 150' : slow.length}`,
    't(s) interval(ms) cpu(ms) | ' + PFR_STEPS.join(' ') + ' | calls awakeProps gpu(ms) | events in the last second');
  for (const r of slow) L.push(`${f2(r[0])} ${f1(r[1])} ${f2(r[2])} | ${r.slice(3, 10).map(f2).join(' ')} | ${r[10]} ${r[11]} ${f2(r[12])} | ${r[13] || '-'}`);
  return L.join('\n');
}
/* "Performance report" button (Options, Video): the current or last match, otherwise the one kept in the browser */
function pfrShow() {
  let txt = PFR.on && PFR.n >= 30 ? pfrReport() : PFR.last;
  if (!txt) { try { txt = localStorage.getItem('dc_perf_last') || ''; } catch (e) { txt = ''; } }
  repShow(_t('Performance report'), _t('It tracks every frame of the last match played with the performance display on. Copy it to have the frame drops analysed.'),
    txt || _t('No match recorded. Tick {0} in Options, Video, then play a match.', '"' + _t('Show performance') + '"'));
}
