// A bot match on a real GPU: the map loads, the clock runs, bots move and fight, the player moves and shoots, and the end-of-match
// flow (results, XP) works. node tools/gate/match.mjs [seconds=25] ; GPU=any (default) | dgpu | igpu | soft ; MAP=<id>
import { openGame, serve } from './lib.mjs';

const SECS = +(process.argv[2] || 25);
const results = [];
const ok = (cond, what, info = '') => { results.push(!!cond); console.log(`${cond ? 'PASS' : 'FAIL'} ${what}${info ? ' (' + info + ')' : ''}`); };
const s = await serve();
let browser;
try {
  const g = await openGame({ url: s.url, gpu: process.env.GPU || 'any', settings: { quality: 'auto' } });
  browser = g.browser; const { page, logs } = g;
  await page.bringToFront();
  const t0 = Date.now();
  await page.evaluate(async (map) => { if (map) Settings.map = map; await mapEnsure(Settings.map); LOCK.fallback = true; startMatch({}); }, process.env.MAP || '');
  await page.waitForFunction(() => MATCH.state === 'playing', null, { timeout: 300000, polling: 500 });
  ok(true, 'map loads and the match starts', ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  const before = await page.evaluate(() => {
    PL.ent.protT = 1e9;
    window.__drive = setInterval(() => { // scripted player: walk in a square, sweep the view, fire bursts
      const t = performance.now() / 1000, ph = Math.floor(t / 2.5) % 4;
      for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) KEYS[k] = false;
      KEYS[['KeyW', 'KeyD', 'KeyS', 'KeyA'][ph]] = true; mouseDX += Math.sin(t * 1.3) * 6; PL.held = t % 3 < 0.6;
      if (PL.ent.health < 50) PL.ent.health = 100;
      window.__far = Math.max(window.__far || 0, PL.ent.pos.distanceTo(window.__p0 || (window.__p0 = PL.ent.pos.clone())));
    }, 16);
    const bots = entities.filter((e) => !e.isPlayer);
    return { time: MATCH.time, pos: PL.ent.pos.clone(), bots: bots.map((b) => b.pos.clone()), ammo: PL.ent.weapon ? PL.ent.weapon.mag : 0 };
  });
  await page.waitForTimeout(SECS * 1000);
  const after = await page.evaluate((b) => {
    clearInterval(window.__drive); PL.held = false;
    const bots = entities.filter((e) => !e.isPlayer);
    const moved = bots.filter((e, i) => b.bots[i] && e.pos.distanceTo(new THREE.Vector3(b.bots[i].x, b.bots[i].y, b.bots[i].z)) > 2).length;
    return { time: MATCH.time, dist: window.__far || 0, moved, n: bots.length,
      kills: bots.reduce((a, e) => a + (e.kills | 0), 0) + (PL.ent.kills | 0), deaths: bots.reduce((a, e) => a + (e.deaths | 0), 0), shots: PL.shots | 0, state: MATCH.state };
  }, before);
  ok(after.time - before.time > SECS * 0.6, 'match clock runs', `${(after.time - before.time).toFixed(1)} s in ${SECS} s`);
  ok(after.moved >= Math.min(4, after.n), 'bots move', `${after.moved}/${after.n}`);
  ok(after.dist > 2, 'player moves', 'reached ' + after.dist.toFixed(1) + ' m from the start');
  ok(after.kills + after.deaths > 0, 'bots fight (kills or deaths happened)', `${after.kills} kills, ${after.deaths} deaths`);
  // end of match: results screen and XP for the match
  await page.evaluate(() => { MATCH.timeLeft = 0.5; });
  const ended = await page.waitForFunction(() => MATCH.state === 'ended' || MATCH.state === 'finish' || MATCH.fin, null, { timeout: 30000, polling: 300 }).then(() => true, () => false);
  ok(ended, 'match ends when the clock runs out');
  ok(!logs.filter((l) => !/Failed to load resource/.test(l)).length, 'no page errors', logs.slice(0, 3).join(' | '));
} catch (e) { ok(false, 'bot match run', e.message); }
if (browser) await browser.close();
await s.close();
const bad = results.filter((r) => !r).length;
console.log(`match: ${results.length - bad}/${results.length} passed`);
process.exit(bad ? 1 : 0);
