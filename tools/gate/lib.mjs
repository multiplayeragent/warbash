// Shared helpers for the War Bash test gate (tools/gate/run.mjs): static server, Chrome on a chosen GPU, game page opener.
import http from 'node:http';
import os from 'node:os';
import { createReadStream, statSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, normalize, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OUT = join(ROOT, 'tools', 'gate', 'out');
const CANDIDATES = [process.env.CHROME_BIN, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
export const CHROME = CANDIDATES.find((p) => p && existsSync(p));

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.mjs': 'application/javascript', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.xml': 'application/xml', '.sh': 'text/plain' };

/** Static server for dist/ on 127.0.0.1 (random port); GATE_URL=<address> runs the checks against a hosted copy instead */
export function serve(dir = join(ROOT, 'dist'), port = 0) {
  if (process.env.GATE_URL) return Promise.resolve({ url: process.env.GATE_URL, close: async () => {} });
  return new Promise((ok) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const f = normalize(join(dir, p));
      if (!f.startsWith(normalize(dir))) { res.writeHead(403); return res.end(); }
      let st; try { st = statSync(f); } catch { res.writeHead(404); return res.end(); }
      if (!st.isFile()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': MIME[extname(f).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-cache' });
      createReadStream(f).pipe(res);
    });
    srv.listen(port, '127.0.0.1', () => ok({ port: srv.address().port, url: `http://127.0.0.1:${srv.address().port}/`, close: () => new Promise((r) => srv.close(r)) }));
  });
}

/* One GPU on a machine that has two (laptop iGPU + discrete): Chrome ignores powerPreference, so the gate pins the adapter with
   --use-adapter-luid, read off chrome://gpu. LUIDs change on reboot, so the list is cached against the boot time. */
const NV = 0x10de, IGPU = new Set([0x1002, 0x8086]);
async function listAdapters() {
  const b = await chromium.launch({ executablePath: CHROME, headless: false, args: ['--use-gl=angle', '--window-size=400,300'] });
  try {
    const p = await b.newPage();
    await p.goto('chrome://gpu');
    await p.waitForFunction(() => { const iv = document.querySelector('info-view'); return iv && iv.shadowRoot && /GPU\d+\s*:\s*VENDOR=[^{]*LUID=\{/.test(iv.shadowRoot.textContent); }, null, { timeout: 30000, polling: 250 });
    const txt = await p.evaluate(() => document.querySelector('info-view').shadowRoot.textContent);
    const out = [];
    for (const m of txt.matchAll(/GPU\d+\s*:\s*VENDOR=\s*0x([0-9a-f]+),\s*DEVICE=0x[0-9a-f]+\s*\[([^\]]*)\][^{]*LUID=\{(-?\d+),(-?\d+)\}/gi))
      out.push({ vendor: parseInt(m[1], 16), name: m[2], luid: `${m[3]},${m[4]}` });
    return out;
  } finally { await b.close(); }
}
/** Chrome args to run on 'igpu', 'dgpu' or 'any' (no pinning); adapter is null when not pinned or not found */
export async function gpuArgs(target = 'any') {
  if (target === 'any' || process.platform !== 'win32') return { args: [], adapter: null };
  const cache = join(OUT, '.gpu.json'), boot = Math.round((Date.now() / 1000 - os.uptime()) / 60);
  let adapters = null;
  try { const c = JSON.parse(readFileSync(cache, 'utf8')); if (Math.abs(c.boot - boot) <= 1 && c.adapters?.length) adapters = c.adapters; } catch {}
  if (!adapters) { adapters = await listAdapters(); mkdirSync(OUT, { recursive: true }); writeFileSync(cache, JSON.stringify({ boot, adapters }, null, 1)); }
  const pick = adapters.find((a) => (target === 'dgpu' ? a.vendor === NV : IGPU.has(a.vendor)));
  return pick ? { args: [`--use-adapter-luid=${pick.luid}`], adapter: pick } : { args: [], adapter: null };
}
export function onTarget(adapter, renderer) {
  if (!adapter) return true;
  return adapter.vendor === NV ? /NVIDIA/i.test(renderer) : /AMD|Radeon|Intel/i.test(renderer);
}

/** Opens the game. o.url (default: served dist/), o.gpu ('soft' = SwiftShader headless, 'hw' = the machine's graphics card headless
 *  (no window, light on the processor), or 'igpu' | 'dgpu' | 'any' headful),
 *  o.settings (merged into dc_settings), o.init (extra init script), o.w/o.h. Resolves once the main menu is up.
 *  Returns { browser, page, logs } where logs collects page errors and console errors. */
export async function openGame(o = {}) {
  const soft = (o.gpu || 'soft') === 'soft', hw = o.gpu === 'hw', headless = soft || hw;
  const g = headless ? { args: [], adapter: null } : await gpuArgs(o.gpu);
  const args = soft ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
    : hw ? ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist']
    : ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--start-maximized', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', ...g.args];
  if (o.autoplay) args.push('--autoplay-policy=no-user-gesture-required');
  const browser = await chromium.launch({ executablePath: CHROME, headless, args });
  const ctx = await browser.newContext(headless ? { viewport: { width: o.w || 1280, height: o.h || 720 } } : { viewport: null });
  const page = await ctx.newPage();
  const settings = Object.assign({ sv: 8, lang: 'en', quality: soft ? 'low' : 'auto' }, o.settings || {});
  await page.addInitScript(`try{localStorage.setItem('dc_settings', ${JSON.stringify(JSON.stringify(settings))});localStorage.setItem('cod_seen_version','99')}catch(e){}`);
  await page.addInitScript(`window.MATCH_COUNTDOWN = ${o.countdown === undefined ? 0 : +o.countdown}`);
  if (o.init) await page.addInitScript(o.init);
  const logs = [];
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') logs.push(`[console] ${m.text()}`); });
  await page.route('**/*', (r) => (/fonts\.g|_vercel/.test(r.request().url()) ? r.abort() : r.continue()));
  await page.goto(o.url);
  await page.waitForFunction(() => typeof MATCH !== 'undefined' && MATCH.state === 'menu', null, { timeout: o.timeout || 120000, polling: 250 });
  return { browser, page, logs, adapter: g.adapter };
}
