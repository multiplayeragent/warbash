// Screenshots of the level-up banner in a bot match: node tools/gate/rankup-shot.mjs [level=20]
// GPU=soft (default) | igpu | dgpu; writes tools/gate/out/rankup-<t>.png and menu-rank.png
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { openGame, serve, OUT } from './lib.mjs';

const level = +(process.argv[2] || 20);
mkdirSync(OUT, { recursive: true });
const s = await serve();
const { browser, page, logs } = await openGame({ url: s.url, w: 1600, h: 900, gpu: process.env.GPU || 'soft',
  init: `try{localStorage.setItem('cod_arsenal', JSON.stringify({v:4,px:${Math.round(250 * Math.pow(level - 1.4, 1.6))},wxp:{},k:{},h:{},cfg:{},lt:0,custom:[]}));localStorage.setItem('cod_nick','Ghost')}catch(e){}` });
await page.waitForTimeout(1500);
await page.screenshot({ path: join(OUT, 'menu-rank.png'), clip: { x: 1000, y: 0, width: 600, height: 160 } });
await page.evaluate(async () => { await mapEnsure(Settings.map); LOCK.fallback = true; startMatch({}); });
await page.waitForFunction(() => MATCH.state === 'playing', null, { timeout: 300000, polling: 500 });
await page.evaluate(() => { PL.ent.protT = 1e9; });
await page.waitForFunction(() => !laneHeld(), null, { timeout: 30000, polling: 200 });
await page.waitForTimeout(500);
await page.evaluate((lv) => rankUpShow(lv, -1), level);
for (const t of [450, 900, 1600, 3000]) {
  await page.waitForTimeout(t === 450 ? 450 : t - [450, 900, 1600, 3000][[450, 900, 1600, 3000].indexOf(t) - 1]);
  await page.screenshot({ path: join(OUT, `rankup-${t}.png`), clip: { x: 300, y: 0, width: 1000, height: 330 } });
}
console.log(logs.length ? logs.join('\n') : 'no page errors');
await browser.close(); await s.close();
