/* Level up and pause previews: node tools/dev/visual/levelling.js [captures folder]
   On a phone in landscape, in a match:
   - the pause shows the equipped class's weapons with their attachments (thumbnail different from the bare weapon);
   - a level up starts the ritual (09s-rankup.js) and the fanfare once per level, not for an attachment unlock;
   - the ritual fits on the screen, does not take the keys, and withdraws on its own. Captures at the animation steps. */
const { openGame } = require('./common');
const path = require('path');
const out = process.argv[2];
if (out) require('fs').mkdirSync(out, { recursive: true });
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL  :', msg); } else console.log('ok    :', msg); };

(async () => {
  const g = await openGame({ mobile: true, w: 915, h: 412, dpr: 1.5, settings: { quality: 'low', map: 'chergui', touch: 'on' }, noHdri: true, init: "try{localStorage.setItem('dc_touch_help','1')}catch(e){}" });
  const { page } = g, P = (e) => page.evaluate(e);
  await page.evaluate(() => { const b = document.getElementById('wnOk'); if (b) b.click(); });
  await page.evaluate(() => { toMenu('solo'); menuLaunch({ online: false, map: Settings.map, deploy: () => startMatch() }); });
  await page.waitForFunction("UI.screen==='deploy'", null, { timeout: 120000 });
  await page.evaluate(() => document.getElementById('depGo').click());
  await page.waitForFunction("MATCH.state==='playing' && PL.ent.alive", null, { timeout: 120000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => { const h = document.getElementById('tcHelp'); if (h) h.classList.add('hidden'); });

  // 1. pause: the equipped class shows its attachments
  const setup = await P(`(() => {
    ARS.wxp = Object.fromEntries(Object.keys(WEAPONS).map((k) => [k, 1e6])); ARS.px = 1e6;
    const i = classCreate(0); if (i < 0) return { err: 'class not created' };
    const base = WEAPONS[CLASSES[i].primary], ids = Object.keys(ATT).filter((a) => attFits(base, a));
    const msgs = []; for (const a of ids.slice(0, 3)) msgs.push(classToggleAtt(i, 'p', a));
    const sb = WEAPONS[CLASSES[i].secondary]; for (const a of Object.keys(ATT).filter((a) => attFits(sb, a)).slice(0, 1)) msgs.push(classToggleAtt(i, 's', a)); // the pistol is fitted too
    Settings.loadout = i; return { i, pa: CLASSES[i].pa, key: classWeapons(i)[0].key, id: CLASSES[i].primary, msgs };
  })()`);
  ok(!setup.err && setup.pa.length > 0, `test class: ${setup.id} with ${setup.pa.length} attachment(s) (${setup.key})`);
  await P('pauseGame(); document.querySelector("[data-pm=class]").click()');
  console.log('  state:', JSON.stringify(await P('({ allowed: thumbsAllowed(), ready: VTHUMB.ready, busy: UI.busy, screen: UI.screen, mapl: MAPL.state, st: MATCH.state, done: Object.keys(VTHUMB.img).length })')));
  const got = await page.waitForFunction(`(() => { const im = document.querySelector('#cpPause img[alt=""]'); return VTHUMB.img[${JSON.stringify(setup.key)}] && [...document.querySelectorAll('#cpPause img')].some((e) => e.src === VTHUMB.img[${JSON.stringify(setup.key)}]); })()`, null, { timeout: 60000, polling: 300 }).then(() => true, () => false);
  const th = await P(`({ own: !!VTHUMB.img[${JSON.stringify(setup.key)}], same: VTHUMB.img[${JSON.stringify(setup.key)}] === VTHUMB.img[${JSON.stringify(setup.id)}], imgs: [...document.querySelectorAll('#cpPause img')].map((e) => e.src.slice(0, 22)), state: MATCH.state })`);
  ok(got && th.own && !th.same, `pause in match: the equipped weapon is shown with its attachments (own thumbnail, different from the bare weapon) ${JSON.stringify(th)}`);
  const both = await page.waitForFunction(`(() => { const im = [...document.querySelectorAll('#cpPause .cp-img img')]; return im.length === 2 && im.every((e) => e.src.startsWith('data:image/webp') && !e.hasAttribute('data-pend')); })()`, null, { timeout: 60000, polling: 300 }).then(() => true).catch(() => false);
  ok(both, 'pause in match: both class weapons (primary and secondary fitted) are drawn, none is the bare placeholder weapon');
  if (out) await page.screenshot({ path: path.join(out, 'pause-class.png') });
  await P('resumeGame()'); await page.waitForTimeout(400);

  // 2. level-up ritual
  await P('ARS.lvSeen = playerLevelLive(); rankUpClear()'); // (the test level must not trigger a ritual by itself)
  ok(await until(page, 'AU.ready && !!AU.rankBuf', 20000), 'fanfare decoded (MP3)');
  await P(`window.__snd = []; const st = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function (...a) { window.__snd.push(this.buffer === AU.rankBuf ? 'rank' : 'other'); return st.apply(this, a); };`);
  await P('rankUpShow(7, -1)');
  await page.waitForTimeout(450);
  ok(await P("document.getElementById('rankUp').classList.contains('show')"), 'level up: the ritual is displayed');
  ok((await P('window.__snd.filter((s) => s === "rank").length')) === 1, 'level up: the fanfare plays once');
  if (out) await page.screenshot({ path: path.join(out, 'rankup-1.png') });
  await page.waitForTimeout(1100); if (out) await page.screenshot({ path: path.join(out, 'rankup-2.png') });
  await page.waitForTimeout(1400); if (out) await page.screenshot({ path: path.join(out, 'rankup-3.png') });
  const box = await P(`(() => { const o = []; for (const s of ['.ru-kick', '.ru-badge', '.ru-sub']) { const r = document.querySelector(s).getBoundingClientRect(); o.push([s, r.left, r.right, r.top, r.bottom]); } return { o, W: innerWidth, H: innerHeight, pe: getComputedStyle(document.getElementById('rankUp')).pointerEvents, num: document.querySelector('.ru-new').textContent }; })()`);
  ok(box.num === '7' && box.o.every(([s, l, r, t, b]) => l >= 0 && r <= box.W && t >= 0 && b <= box.H), `the ritual fits on the screen (${box.W}x${box.H}) and announces level ${box.num}`);
  ok(box.pe === 'none', 'the ritual does not take the keys');
  ok(await until(page, "!document.getElementById('rankUp').classList.contains('show')", 12000), 'the ritual withdraws on its own');
  // attachment unlock: no fanfare; several levels in a row: one fanfare each
  await P(`arsNotify({ weapon: 'm4', up: false, level: 3, items: ['att:' + Object.keys(ATT)[0]] })`); await page.waitForTimeout(500);
  ok((await P('window.__snd.filter((s) => s === "rank").length')) === 1, 'attachment unlock: no fanfare');
  await P('rankUpShow(8, -1); rankUpShow(9, 1)'); await page.waitForTimeout(500);
  ok((await P('window.__snd.filter((s) => s === "rank").length')) === 2, 'two levels in a row: the second waits for the first to end');
  ok(await until(page, 'window.__snd.filter((s) => s === "rank").length === 3', 20000), 'the second level has its own fanfare');
  if (out) await page.screenshot({ path: path.join(out, 'rankup-slot.png') });
  await P('rankUpClear()'); ok(!(await P("document.getElementById('rankUp').classList.contains('show')")), 'end of match: no rank-up ceremony pending');
  await g.browser.close();
  console.log(fails ? `${fails} failure(s)` : 'all good');
  process.exit(fails ? 1 : 0);

  function until(pg, cond, ms) { return pg.waitForFunction(cond, null, { timeout: ms || 30000, polling: 100 }).then(() => true, () => false); }
})().catch((e) => { console.error(e); process.exit(2); });
