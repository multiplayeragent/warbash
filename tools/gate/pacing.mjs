// tools/gate/pacing.mjs: how smooth does a live bot match look on this display?
// Real Chrome, vsync on, pinned GPU, player defaults (quality auto, dynres on),
// immortal player with scripted move/turn/fire. Reports:
//   presented   intervals between rAF frames the game actually rendered, in
//               display refreshes: share held 1 / 2 / 3+ refreshes
//   main thread frame() duration p50/p90/p99/max (JS + GL submission)
//   long        Long Animation Frames >= 50 ms, presented gaps >= 50 ms
//   noise       system CPU% and NVIDIA util sampled during the run
//
//   node tools/gate/pacing.mjs <igpu|dgpu|any> [seconds=30] [label]   DIST=dist PAGE=index.html WARM=10. Keep the window in front (a covered window is throttled).
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHROME, gpuArgs, onTarget, serve, ROOT, OUT } from './lib.mjs';

const TARGET = process.argv[2] || 'any', SECS = +(process.argv[3] || 30), LABEL = process.argv[4] || '';
const WARM = +(process.env.WARM || 10);
const DIST = resolve(process.env.DIST || join(ROOT, 'dist')), PAGE = process.env.PAGE || 'index.html';

// ---- system noise: CPU% (os.cpus deltas), CPU clock vs nominal (% Processor Performance: <100 = throttled),
// NVIDIA util, and which processes burned CPU during the run
function cpuSnap() { return os.cpus().reduce((a, c) => { const t = c.times; a.idle += t.idle; a.tot += t.user + t.nice + t.sys + t.idle + t.irq; return a; }, { idle: 0, tot: 0 }); }
function procSnap() {
  return new Promise((ok) => {
    const p = spawn('powershell.exe', ['-NoProfile', '-Command', 'Get-Process | Where-Object CPU | ForEach-Object { "{0}`t{1}`t{2}" -f $_.Id,$_.ProcessName,$_.CPU }'], { windowsHide: true });
    let s = ''; p.stdout.on('data', (d) => { s += d; });
    p.on('close', () => { const m = new Map(); for (const l of s.split(/\r?\n/)) { const [id, n, c] = l.split('\t'); if (c) m.set(id, [n, +c]); } ok(m); });
  });
}
function procDiff(a, b, secs) {
  const by = new Map();
  for (const [id, [n, c]] of b) by.set(n, (by.get(n) || 0) + c - (a.get(id)?.[1] ?? c));
  return [...by].filter(([, v]) => v > 0.3).sort((x, y) => y[1] - x[1]).slice(0, 6).map(([n, v]) => `${n} ${(100 * v / secs).toFixed(0)}%`);
}
function sampler(secs) {
  const cpu = [], gpu = [], perf = [];
  let last = cpuSnap();
  const iv = setInterval(() => { const c = cpuSnap(); cpu.push(100 * (1 - (c.idle - last.idle) / (c.tot - last.tot))); last = c; }, 1000);
  const tp = spawn('typeperf', [String.raw`\Processor Information(_Total)\% Processor Performance`, '-si', '1', '-sc', String(secs)], { windowsHide: true });
  let tps = ''; tp.stdout.on('data', (d) => { tps += d; });
  const tpDone = new Promise((ok) => tp.on('close', ok));
  const ns = spawn('nvidia-smi', ['--query-gpu=utilization.gpu', '--format=csv,noheader,nounits', '-lms', '1000'], { windowsHide: true });
  ns.stdout.on('data', (d) => { for (const l of String(d).split(/\r?\n/)) if (/^\d+/.test(l.trim())) gpu.push(+l.trim()); });
  return { stop: async () => {
    clearInterval(iv); ns.kill();
    await Promise.race([tpDone, new Promise((r) => setTimeout(r, 6000))]); tp.kill();
    for (const l of tps.split(/\r?\n/)) { const m = /^"[^"]+","([\d.]+)"/.exec(l); if (m) perf.push(+m[1]); }
    return { cpu, gpu, perf };
  } };
}

const { args: GA, adapter } = await gpuArgs(TARGET);
const S = await serve(DIST);
const url = `http://127.0.0.1:${S.port}/${PAGE}`;
const browser = await chromium.launch({ executablePath: CHROME, headless: false,
  args: ['--use-gl=angle', '--use-angle=d3d11', ...GA, '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--start-maximized'] });
const ctx = await browser.newContext({ viewport: null });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
await page.addInitScript(() => {
  try {
    localStorage.setItem('dc_settings', JSON.stringify({ sv: 8, lang: 'en' }));
    localStorage.setItem('cod_seen_version', '99');
  } catch (e) {}
  window.MATCH_COUNTDOWN = 0;
});
const tBoot = Date.now();
await page.goto(url, { waitUntil: 'load', timeout: 180000 });
await page.waitForFunction(() => typeof MATCH !== 'undefined' && MATCH.state === 'menu', null, { timeout: 300000, polling: 250 });
const bootS = (Date.now() - tBoot) / 1000;
const setup = await page.evaluate(async ([WARM]) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // display refresh, measured on the menu
  const refresh = await new Promise((done) => {
    const t = []; let last = 0;
    const f = (now) => { if (last) t.push(now - last); last = now; if (t.length < 150) requestAnimationFrame(f); else { t.sort((a, b) => a - b); done(t[75]); } };
    requestAnimationFrame(f);
  });
  const tMap = performance.now();
  await mapEnsure(Settings.map); LOCK.fallback = true; startMatch({});
  while (MATCH.state !== 'playing') await sleep(100);
  const mapS = (performance.now() - tMap) / 1000;
  // scripted player: immortal, moves in phases, sweeps the camera, fires bursts
  let t0 = 0, driving = true;
  const drive = () => {
    if (!driving) return;
    if (!t0) t0 = performance.now();
    const s = (performance.now() - t0) / 1000, ph = Math.floor(s / 2.5) % 6;
    PL.ent.protT = 1e9; if (PL.ent.health < 50) PL.ent.health = 100;
    for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft']) KEYS[k] = false;
    for (const k of [['KeyW'], ['KeyW', 'KeyA'], ['KeyW', 'KeyD'], ['KeyS'], ['KeyW', 'ShiftLeft'], ['KeyA']][ph]) KEYS[k] = true;
    mouseDX += Math.sin(s * 0.9) * 9; mouseDY += Math.sin(s * 0.37) * 1.5;
    const fire = (s % 3) < 0.6; if (fire && !PL.held) PL.queued = true; PL.held = fire;
    requestAnimationFrame(drive);
  };
  requestAnimationFrame(drive);
  await sleep(WARM * 1000);
  window.__stopDrive = () => { driving = false; };
  return { refresh, mapS };
}, [WARM]);
await page.bringToFront();
const p0 = await procSnap();
const smp = sampler(SECS);
const r = await page.evaluate(async ([SECS]) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // record
  const rows = []; // [rAF now, frame() ms, rendered 0/1, shader programs compiled, quality tier/scale changed]
  const T0 = performance.now();
  let drew = 0, lastTier = RQ.tier, lastScale = RQ.scale;
  const rf = window.renderFrame; window.renderFrame = function () { drew = 1; return rf.apply(this, arguments); };
  const fr = window.frame;
  window.frame = function (now) { drew = 0; const P0 = renderer.info.programs.length, a = performance.now(); fr(now); const d = performance.now() - a, ch = RQ.tier !== lastTier || RQ.scale !== lastScale ? 1 : 0; lastTier = RQ.tier; lastScale = RQ.scale; rows.push(now - T0, d, drew, renderer.info.programs.length - P0, ch); };
  const loaf = [];
  let po = null;
  try { po = new PerformanceObserver((l) => { for (const e of l.getEntries()) loaf.push([e.duration, e.blockingDuration || 0]); }); po.observe({ type: 'long-animation-frame', buffered: false }); } catch (e) {}
  const states = [];
  const tEnd = performance.now() + SECS * 1000;
  while (performance.now() < tEnd) { states.push([RQ.tier, +RQ.scale.toFixed(2), HF.k]); await sleep(1000); }
  window.frame = fr; window.renderFrame = rf; window.__stopDrive(); po && po.disconnect();
  for (const k in KEYS) KEYS[k] = false; PL.held = false;
  const gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info');
  return { rows, loaf, states, renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '?',
    canvas: [renderer.domElement.width, renderer.domElement.height], css: [innerWidth, innerHeight, devicePixelRatio],
    q: RQ.q && RQ.q.label, map: CURMAP.id, ents: entities.length, fps: DYN.stat };
}, [SECS]);
const noise = await smp.stop();
const p1 = await procSnap();
Object.assign(r, setup);
await browser.close(); await S.close();

// ---- analysis
const ref = r.refresh, W = 5, n = r.rows.length / W;
const ts = [], cpu = [], all = [];
const worst = [];
for (let i = 0; i < n; i++) {
  const now = r.rows[W * i], c = r.rows[W * i + 1], d = r.rows[W * i + 2], np = r.rows[W * i + 3], ch = r.rows[W * i + 4];
  all.push(c); if (d) { ts.push(now); cpu.push(c); }
  if (c > 40) worst.push(`${(now / 1000).toFixed(1)}s ${c.toFixed(0)}ms${np ? ' +' + np + 'shaders' : ''}${ch ? ' TIERCHANGE' : ''}`);
}
const progs = r.rows.filter((_, i) => i % W === 3).reduce((a, b) => a + b, 0), tierCh = r.rows.filter((_, i) => i % W === 4).reduce((a, b) => a + b, 0);
const iv = []; for (let i = 1; i < ts.length; i++) iv.push(ts[i] - ts[i - 1]);
const rafAll = []; for (let i = 1; i < n; i++) rafAll.push(r.rows[W * i] - r.rows[W * (i - 1)]);
const held = iv.map((x) => Math.max(1, Math.round(x / ref)));
const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const share = (k) => +(100 * held.filter((h) => (k === 3 ? h >= 3 : h === k)).length / held.length).toFixed(2);
let run = 0, best = 0; for (const h of held) { run = h === 1 ? run + 1 : 0; best = Math.max(best, run); }
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const out = {
  label: LABEL, target: TARGET, throttled: pct(rafAll, 0.5) > 2.5 * ref, adapter: adapter?.name || null, renderer: r.renderer, onTarget: onTarget(adapter, r.renderer),
  refreshMs: +ref.toFixed(3), hz: +(1000 / ref).toFixed(1), bootS: +bootS.toFixed(1), mapS: +r.mapS.toFixed(1), secs: SECS,
  canvas: r.canvas, css: r.css, quality: r.q, tiers: [...new Set(r.states.map((s) => s.join('/')))], map: r.map, ents: r.ents,
  presented: ts.length, fps: +(ts.length / SECS).toFixed(1), skipped: n - ts.length,
  held: { '1': share(1), '2': share(2), '3+': share(3) }, steadyRun: best,
  ivMs: { p50: +pct(iv, 0.5).toFixed(2), p99: +pct(iv, 0.99).toFixed(2), max: +Math.max(...iv).toFixed(1) },
  mainMs: { p50: +pct(cpu, 0.5).toFixed(2), p90: +pct(cpu, 0.9).toFixed(2), p99: +pct(cpu, 0.99).toFixed(2), max: +Math.max(...cpu).toFixed(1) },
  overBudget: +(100 * cpu.filter((c) => c > ref).length / cpu.length).toFixed(2),
  loaf50: r.loaf.length, loafMax: r.loaf.length ? +Math.max(...r.loaf.map((x) => x[0])).toFixed(0) : 0,
  gaps50: iv.filter((x) => x >= 50).length,
  slowFrames: worst.slice(0, 12), shadersCompiled: progs, tierChanges: tierCh,
  noise: { cpuAvg: +mean(noise.cpu).toFixed(1), cpuMax: +Math.max(0, ...noise.cpu).toFixed(0), clockPct: +mean(noise.perf).toFixed(0), clockMin: +Math.min(...noise.perf, 999).toFixed(0), nvAvg: +mean(noise.gpu).toFixed(0), procs: procDiff(p0, p1, SECS) },
  errors: errors.slice(0, 5),
};
mkdirSync(OUT, { recursive: true });
const f = join(OUT, `pacing-${TARGET}-${Date.now()}.json`);
writeFileSync(f, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out));
