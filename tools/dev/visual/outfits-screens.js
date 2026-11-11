/* Outfits screen with the 30 outfits (4 base, 26 challenge) at 1280 x 720, 1920 x 1080 and on a phone in landscape: every card and its
   thumbnail, nothing overflowing the page, the cards list scrolling inside its column, a locked outfit's three challenges with their
   progress under the preview; and the end of a match where many challenges progressed at once. Screenshots in [folder].
   node tools/dev/visual/outfits-screens.js [folder] ; GPU=hw recommended; exits with an error code at the first failure. */
const fs = require('fs'), path = require('path');
const { openGame, HERE } = require('./common');
const out = process.argv[2] || path.join(HERE, 'shots', 'outfits-screens');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL  :', m); } else console.log('ok    :', m); };
const SIZES = [['1280x720', { w: 1280, h: 720 }], ['1920x1080', { w: 1920, h: 1080 }], ['phone', { mobile: true, w: 915, h: 412 }]];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  for (const [name, o] of SIZES) {
    const { browser, page } = await openGame(Object.assign({ settings: { quality: 'low', skin: 'assault' }, noMap: true, noHdri: true }, o));
    await page.evaluate(() => { ARS.ch = { drKill: 41, drWin: 3, woKill: 75, woWin: 4, woCrouch: 20, bwStreak: 3, auXp: 12400 }; ARS.chMaps = []; uiOpen('skins', ['main']); });
    // thumbnails of every listed outfit, by the thumbnail queue
    await page.waitForFunction(() => skinListed().every((s) => VTHUMB.img['skin:' + s]), null, { timeout: 480000, polling: 1000 }).catch(() => {});
    await page.evaluate(() => { const t = performance.now(); for (let k = 0; k < 3; k++) frame(t + k * 16); });
    const v = await page.evaluate(() => {
      const L = $('skList'), r = L.getBoundingClientRect(), cards = [...L.querySelectorAll('.sk-card')];
      return { cards: cards.length, thumbs: skinListed().filter((s) => VTHUMB.img['skin:' + s]).length, listed: skinListed().length,
        pageW: document.documentElement.scrollWidth, pageH: document.documentElement.scrollHeight, W: innerWidth, H: innerHeight,
        list: { top: r.top, bottom: r.bottom, left: r.left, right: r.right, scroll: L.scrollHeight > L.clientHeight + 2 },
        heads: [...L.querySelectorAll('.sk-h')].map((h) => h.textContent), wide: cards.filter((c) => c.scrollWidth > c.clientWidth + 1).map((c) => c.dataset.skin) };
    });
    ok(v.cards === 30 && v.thumbs === v.listed, `${name}: 30 cards, ${v.thumbs} / ${v.listed} thumbnails`);
    ok(v.pageW <= v.W && v.pageH <= v.H && v.list.bottom <= v.H + 1 && v.list.right <= v.W + 1 && v.wide.length === 0, `${name}: nothing overflows (page ${v.pageW}x${v.pageH} in ${v.W}x${v.H}, list ${Math.round(v.list.top)}..${Math.round(v.list.bottom)}, scrolls: ${v.list.scroll}, wide cards: ${v.wide})`);
    ok(v.heads.length === 3, `${name}: three group titles (${v.heads.join(' / ')})`);
    await page.screenshot({ path: path.join(out, `outfits-${name}-top.png`) });
    // a locked map outfit in the preview, its challenges under it; the list scrolled to its card
    await page.evaluate(() => { const c = document.querySelector('#skList .sk-card[data-skin="duneRider"]'); c.scrollIntoView({ block: 'center' }); c.click(); });
    await page.evaluate(() => { const t = performance.now(); for (let k = 0; k < 4; k++) frame(t + k * 16); });
    await page.waitForTimeout(300);
    const L = await page.evaluate(() => { const i = $('skInfo'); return { view: SKV.view, rows: i ? i.querySelectorAll('.sk-d').length : 0, text: i ? i.innerText.replace(/\s+/g, ' ') : '' }; });
    ok(L.view === 'duneRider' && L.rows === 3 && /Wins on Chergui 3 \/ 4/.test(L.text), `${name}: locked Dune Rider in the preview with its three challenges (${L.text.slice(0, 160)})`);
    await page.screenshot({ path: path.join(out, `outfits-${name}-map-outfit.png`) });
    await page.evaluate(() => { const c = document.querySelector('#skList .sk-card[data-skin="bulwark"]'); c.scrollIntoView({ block: 'center' }); c.click(); });
    await page.evaluate(() => { const t = performance.now(); for (let k = 0; k < 4; k++) frame(t + k * 16); });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, `outfits-${name}-play-outfit.png`) });
    // end of a match on Chergui where a dozen challenges moved
    if (name !== '1920x1080') {
      await page.evaluate(() => mapEnsure(Settings.map));
      await page.evaluate(() => { Settings.mode = 'tdm'; startMatch({}); });
      await page.waitForTimeout(800);
      await page.evaluate(() => {
        for (const [id, n] of [['drKill', 9], ['drFar', 3], ['vFa', 7], ['auXp', 1050], ['auHead', 2], ['trHip', 4], ['trClose', 2], ['rDouble', 1], ['cuTriple', 1], ['skRadar', 3], ['shBack', 2], ['bwLow', 1], ['woCrouch', 0]]) if (n) { ARS.chSess[id] = n; ARS.ch[id] = (ARS.ch[id] || 0) + n; }
        // (Wins on Chergui: 3 / 4 on the Outfits screen; the win of this match is counted by the end of the match itself, 4 / 4 on the end screen)
        // a coherent match: 30 to 24 for the player's team, 12 kills and 5 deaths for the player, the rest shared among the bots
        const me = PL.ent, al = entities.filter((e) => e !== me && allied(me, e)), en = entities.filter((e) => !allied(me, e));
        const share = (L, total, deaths) => L.forEach((e, i) => { e.kills = Math.floor(total / L.length) + (i < total % L.length ? 1 : 0); e.deaths = Math.floor(deaths / L.length) + (i < deaths % L.length ? 1 : 0); e.assists = i % 3; e.score = e.kills * 100 + e.assists * 20; });
        share(al, 18, 19); share(en, 24, 30);
        Object.assign(me, { kills: 12, deaths: 5, assists: 3, score: 12 * 100 + 4 * 50 + 3 * 20 }); PL.bestStreak = 6; PL.shots = 160; PL.hits = 58; PL.hsKills = 4;
        MATCH.score[me.team] = 30; MATCH.score[1 - me.team] = 24; endMatch();
      });
      await page.waitForTimeout(1500);
      const E = await page.evaluate(() => { const e = $('endArs'), r = e.getBoundingClientRect(), w = [...e.querySelectorAll('.ars-row')].find((x) => /Wins on Chergui/i.test(x.textContent)); return { rows: e.querySelectorAll('.ars-row').length, h: Math.round(r.height), bottom: Math.round(r.bottom), H: innerHeight, more: !!e.querySelector('.end-ch-sum .more'), map: CURMAP.id, win: ARS.ch.drWin, sess: ARS.chSess.drWin, row: w ? w.textContent : '' }; });
      ok(E.rows <= 8 && E.more && E.h > 40 && E.bottom > 0, `${name}: end screen, ${E.rows} challenge rows (the rest summed up), panel ${E.h} px`);
      ok(E.map === 'chergui' && E.win === 4 && E.sess === 1 && /4 \/ 4/.test(E.row), `${name}: the win on Chergui counted once by the end of the match: 3 / 4 before, ${E.win} / 4 after (${E.row})`);
      await page.screenshot({ path: path.join(out, `end-summary-${name}.png`) });
    }
    await browser.close();
  }
  console.log(fails ? `${fails} failure(s)` : 'all good');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
