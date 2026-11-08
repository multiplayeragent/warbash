// Screenshot of the main menu or another screen: node tools/gate/shot.mjs [out.png] [screen]
// GPU=soft (default, SwiftShader headless) | igpu | dgpu | any ; W, H: window size ; WAIT: ms before the shot
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { openGame, serve, OUT } from './lib.mjs';

const out = process.argv[2] || join(OUT, 'menu.png'), screen = process.argv[3];
mkdirSync(OUT, { recursive: true });
const s = await serve();
const { browser, page, logs } = await openGame({ url: s.url, w: +process.env.W || 1600, h: +process.env.H || 900, gpu: process.env.GPU || 'soft' });
if (screen) await page.evaluate((sc) => uiGo(sc), screen);
await page.waitForTimeout(+process.env.WAIT || 2500);
await page.screenshot({ path: out });
console.log(out, logs.length ? logs.join('\n') : 'no page errors');
await browser.close();
await s.close();
