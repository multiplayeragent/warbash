/* Texture units of a phone: node tools/dev/visual/units.js [screenshots folder]   (MAP=chergui for a single map)
   A Pixel (PowerVR via ANGLE) offers only 13 texture units per program (MAX_TEXTURE_IMAGE_UNITS), computers 16 or more. A program
   that asks for more is rejected or makes the context get lost while compiling shaders: the blended ground wanted 16 on every
   map, none would load. This check emulates the limit of 13 (SwiftShader has none) and verifies, for each map:
   - the game adapts (TEX_LEAN) and the map loads, no program rejected or above the limit;
   - no program asks for more than 12 units (one spare);
   - the ground displays (screenshot of the aerial view, to look at).
   With the limit of 16 (computer), the full ground is kept: 16 units. Exits with an error code at the first failure. */
const { openGame } = require('./common');
const path = require('path');
const out = process.argv[2];
if (out) require('fs').mkdirSync(out, { recursive: true });
const MAPS = process.env.MAP ? [process.env.MAP] : ['chergui', 'saintgivre', 'portmael', 'floralia', 'notos', 'scoria', 'cirrus', 'sirocco', 'belhorizon', 'outpost'];
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL  :', m); } else console.log('ok    :', m); };
const LIMIT = (n) => `(() => { const f = WebGL2RenderingContext.prototype.getParameter; WebGL2RenderingContext.prototype.getParameter = function (p) { return p === 0x8872 ? ${n} : f.call(this, p); }; })();`;

async function load(id, limit) {
  const g = await openGame({ mobile: true, w: 987, h: 444, dpr: 1, settings: { quality: 'low', map: id, touch: 'on' }, noMap: true, noHdri: true, init: limit ? LIMIT(limit) : undefined });
  const { page } = g;
  await page.evaluate(() => { const b = document.getElementById('wnOk'); if (b) b.click(); });
  await page.evaluate((m) => { window.__job = mapEnsure(m).catch((e) => e); }, id);
  await page.waitForFunction('MAPL.state === "ready" || MAPL.fail', null, { timeout: 900000, polling: 1000 });
  const r = await page.evaluate(() => { const bad = gpuCheckPrograms(); return { state: MAPL.state, err: MAPL.fail && String((MAPL.fail.err && MAPL.fail.err.message) || MAPL.fail.err), lean: TEX_LEAN, max: TEXU.max, bad: bad.map((b) => b.name + ' ' + b.log), samp: GPUX.samp, progs: renderer.info.programs.length }; });
  return { g, r };
}

(async () => {
  for (const id of MAPS) {
    const { g, r } = await load(id, 13);
    ok(r.max === 13 && r.lean === true, `${id}: limit of 13 units seen by the game, lean ground variant`);
    ok(r.state === 'ready', `${id}: map loaded (${r.progs} programs)${r.err ? ': ' + r.err : ''}`);
    ok(r.bad.length === 0, `${id}: no program rejected or above the limit${r.bad.length ? ': ' + r.bad.join(' | ') : ''}`);
    ok(r.samp && r.samp.n <= 12, `${id}: at most ${r.samp && r.samp.n} units in a program (${r.samp && r.samp.name.slice(0, 90)})`);
    if (out) {
      // aerial view of the class selection: the ground is in the picture
      await g.page.evaluate((m) => { menuLaunch({ online: false, map: m, deploy() {} }); }, id);
      await g.page.waitForFunction("UI.screen==='deploy'", null, { timeout: 300000, polling: 1000 }).catch(() => {});
      await g.page.waitForTimeout(3000);
      await g.page.screenshot({ path: path.join(out, `units-${id}.png`) });
    }
    await g.browser.close();
  }
  if (!process.env.MAP || process.env.MAP === 'chergui') {
    const { g, r } = await load('chergui', 0);
    ok(r.lean === false && r.state === 'ready' && r.bad.length === 0 && r.samp.n === 16, `computer: full ground kept (${r.samp && r.samp.n} units, limit ${r.max})`);
    await g.browser.close();
  }
  console.log(fails ? `${fails} failure(s)` : 'all good');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
