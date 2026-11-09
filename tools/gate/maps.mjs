// Every map: it loads, a short bot match runs on it (bots move and fight) and nothing throws. Run after touching a map, a kit or
// anything shared by the maps. node tools/gate/maps.mjs [seconds=12]; GPU=any (default) | dgpu | igpu | soft; MAPS=id1,id2 to pick
import { openGame, serve } from './lib.mjs';

const SECS = +(process.argv[2] || 12);
const results = [];
const ok = (cond, what, info = '') => { results.push(!!cond); console.log(`${cond ? 'PASS' : 'FAIL'} ${what}${info ? ' (' + info + ')' : ''}`); };
const s = await serve();
let browser;
try {
  const g = await openGame({ url: s.url, gpu: process.env.GPU || 'any', settings: { quality: 'auto' } });
  browser = g.browser; const { page, logs } = g;
  await page.bringToFront();
  const ids = process.env.MAPS ? process.env.MAPS.split(',') : await page.evaluate(() => MAPS.filter((m) => m.ok).map((m) => m.id));
  for (const id of ids) {
    const n0 = logs.length, t0 = Date.now();
    try {
      await page.evaluate(async (map) => { Settings.map = map; await mapEnsure(map); LOCK.fallback = true; startMatch({}); }, id);
      await page.waitForFunction(() => MATCH.state === 'playing', null, { timeout: 300000, polling: 500 });
      const name = await page.evaluate(() => CURMAP.info && CURMAP.info.name);
      const before = await page.evaluate(() => { PL.ent.protT = 1e9; return entities.filter((e) => !e.isPlayer).map((b) => b.pos.clone()); });
      await page.waitForTimeout(SECS * 1000);
      const r = await page.evaluate((b) => {
        const bots = entities.filter((e) => !e.isPlayer);
        const moved = bots.filter((e, i) => b[i] && e.pos.distanceTo(new THREE.Vector3(b[i].x, b[i].y, b[i].z)) > 2).length;
        return { moved, n: bots.length, fights: bots.reduce((a, e) => a + (e.kills | 0) + (e.deaths | 0), 0) };
      }, before);
      const errs = logs.slice(n0).filter((l) => !/Failed to load resource/.test(l));
      ok(r.moved >= Math.min(4, r.n) && !errs.length, `${id} (${name}) loads, bots move`, `${((Date.now() - t0) / 1000).toFixed(0)} s, ${r.moved}/${r.n} moved, ${r.fights} kills+deaths${errs.length ? ', ' + errs.slice(0, 2).join(' | ') : ''}`);
    } catch (e) { ok(false, `${id} loads`, e.message.split('\n')[0]); }
    await page.evaluate(() => { try { toMenu(); } catch (e) { /* already in the menus */ } });
    await page.waitForTimeout(1500);
  }
} catch (e) { ok(false, 'maps run', e.message); }
if (browser) await browser.close();
await s.close();
const bad = results.filter((r) => !r).length;
console.log(`maps: ${results.length - bad}/${results.length} passed`);
process.exit(bad ? 1 : 0);
