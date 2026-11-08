// Boot and menus: the page reaches the main menu, every main screen opens and closes without a page error, and the War Bash
// identity is in place (logo, rank chip, no upstream name). node tools/gate/menus.mjs ; GPU=soft (default) | any | dgpu | igpu
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { openGame, serve, OUT } from './lib.mjs';

const results = [];
const ok = (cond, what, info = '') => { results.push(!!cond); console.log(`${cond ? 'PASS' : 'FAIL'} ${what}${info ? ' (' + info + ')' : ''}`); };
mkdirSync(OUT, { recursive: true });
const s = await serve();
const t0 = Date.now();
let browser;
try {
  const g = await openGame({ url: s.url, w: 1280, h: 720, gpu: process.env.GPU || 'soft' });
  browser = g.browser; const { page, logs } = g;
  ok(true, 'boots to the main menu', ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  const id = await page.evaluate(() => ({
    title: document.title, logo: getComputedStyle(document.querySelector('.logo')).backgroundImage.length > 100,
    chip: document.getElementById('acctChip').classList.contains('rank'), text: document.body.innerText,
    html: document.documentElement.outerHTML.length,
  }));
  ok(/War Bash/.test(id.title), 'page title says War Bash', id.title);
  ok(id.logo, 'logo is drawn');
  ok(id.chip, 'rank chip shown on the main menu');
  ok(!/Riposte/i.test(id.text.replace(/D'après Riposte: Frontline|Based on Riposte: Frontline/g, '')), 'no upstream name in visible text (credit line aside)');
  ok(!/PeerJS|WebRTC|Multiplayer Agent|Colyseus/i.test(id.text), 'no networking tech name in visible text');
  for (const scr of ['play', 'classes', 'skins', 'options', 'multi', 'news', 'legal']) {
    await page.evaluate((n) => uiGo(n), scr);
    await page.waitForTimeout(600);
    const st = await page.evaluate((n) => ({ on: UI.screen === n, text: (document.getElementById('scr-' + n) || {}).innerText || '' }), scr);
    ok(st.on && st.text.trim().length > 20, `screen ${scr} opens`);
    if (/PeerJS|WebRTC|Multiplayer Agent|Colyseus/i.test(st.text)) ok(false, `screen ${scr} names the networking tech`);
    await page.screenshot({ path: join(OUT, `menu-${scr}.png`) });
    await page.evaluate(() => uiGo('main'));
    await page.waitForTimeout(200);
  }
  ok(!logs.filter((l) => !/Failed to load resource/.test(l)).length, 'no page errors', logs.slice(0, 3).join(' | '));
} catch (e) { ok(false, 'menus run', e.message); }
if (browser) await browser.close();
await s.close();
const bad = results.filter((r) => !r).length;
console.log(`menus: ${results.length - bad}/${results.length} passed`);
process.exit(bad ? 1 : 0);
