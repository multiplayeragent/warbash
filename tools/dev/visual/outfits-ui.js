/* Check of outfit selection (src/09u-outfits.js) on a phone in landscape: node tools/dev/visual/outfits-ui.js [screenshots folder]
   - Outfits screen: the 3D preview is drawn (animated, in the game canvas: light pixels of the soldier; static: pixels outside the background), the displayed
     simulated cloth follows the simulation, choosing a card changes the outfit (Settings.skin), the first-person view arms
     and the player's body, and the online announcement (sk field of the presence);
   - challenge outfits: a locked card goes into the preview and details its challenges without being worn; once its challenges are done, it
     unlocks, is announced and can be worn (body, killcam, arms, online presence); a challenge outfit that nothing shows is freed;
   - thumbnails of the nine outfits built by the thumbnail queue;
   - in a match: each bot wears the outfit of its weapon's family, allies light and enemies dark (relation to the player),
     all as enemies in deathmatch; the Outfit view of the pause changes the outfit right away.
   Exits with an error code at the first failure. */
const path = require('path');
const { openGame } = require('./common');
const out = process.argv[2];
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL  :', m); } else console.log('ok    :', m); };
(async () => {
  if (out) require('fs').mkdirSync(out, { recursive: true });
  const { browser, page, logs } = await openGame({ mobile: true, w: 915, h: 412, settings: { quality: 'low', skin: 'assault' }, page: process.env.PAGE }); // PAGE: another built version
  // Outfits screen
  await page.evaluate(() => uiOpen('skins', ['main']));
  await page.evaluate(() => { const t = performance.now(); for (let k = 0; k < 3; k++) frame(t + k * 16); });
  await page.waitForTimeout(300);
  const v = await page.evaluate(() => {
    const cards = document.querySelectorAll('#skList .sk-card').length;
    if (SKV.live) {
      // animated preview: drawn in the game canvas after the background (09u-outfits.js), read back right after the frame, before the browser
      // composites it; the soldier: pixels clearly lighter than the studio, which is dark
      MBG.drawn = ''; MBG.acc = 1; frame(performance.now() + 100);
      const gl = renderer.getContext(), r = SKV.host.getBoundingClientRect(), cr = renderer.domElement.getBoundingClientRect(), bs = renderer.getDrawingBufferSize(new THREE.Vector2());
      const sx = bs.x / cr.width, sy = bs.y / cr.height, x = Math.round((r.left - cr.left) * sx), y = Math.round((cr.bottom - r.bottom) * sy), w = Math.round(r.width * sx), h = Math.round(r.height * sy);
      const d = new Uint8Array(w * h * 4); gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, d); let n = 0;
      for (let i = 0; i < d.length; i += 16) if (d[i] + d[i + 1] + d[i + 2] > 150) n++;
      return { live: true, w, h, frac: n / (d.length / 16), cards };
    }
    const c = SKV.cv, g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data; let n = 0;
    for (let i = 0; i < d.length; i += 16) if (Math.abs(d[i] - 0x18) + Math.abs(d[i + 1] - 0x1b) + Math.abs(d[i + 2] - 0x14) > 30) n++;
    return { live: false, w: c.width, h: c.height, frac: n / (d.length / 16), cards };
  });
  const nAll = await page.evaluate(() => SKIN_ALL.length);
  ok(v.cards === nAll && v.frac > (v.live ? 0.03 : 0.05), `Outfits screen: ${nAll} cards, ${v.live ? 'animated' : 'static'} preview drawn (${v.w}x${v.h}, ${(v.frac * 100).toFixed(1)} % of pixels ${v.live ? 'of the soldier' : 'outside the background'})`);
  if (out) await page.screenshot({ path: path.join(out, 'outfits-screen.png') });
  // animated preview: the displayed simulated cloth is the simulation's. The engine only sends modified vertices back to the GPU once per
  // frame of its counter, which does not advance in menus (skinSkel advances it): without this, the displayed cape stayed that of the
  // first frame. Cloth moved by 60 cm without a simulation step: the preview image must change.
  if (v.live) {
    const c = await page.evaluate(() => {
      const prev = SKV.view; skinView('tempest');
      for (let i = 0; i < 20; i++) { SKV.acc = 1 / 30; skinLiveDraw(); }
      const gl = renderer.getContext(), r = SKV.host.getBoundingClientRect(), cr = renderer.domElement.getBoundingClientRect(), bs = renderer.getDrawingBufferSize(new THREE.Vector2());
      const sx = bs.x / cr.width, sy = bs.y / cr.height, x = Math.round((r.left - cr.left) * sx), y = Math.round((cr.bottom - r.bottom) * sy), w = Math.round(r.width * sx), h = Math.round(r.height * sy);
      const shot = () => { SKV.acc = 0; skinLiveDraw(); const d = new Uint8Array(w * h * 4); gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, d); return d; };
      const A = shot(), C = skinLiveModel('tempest').cloth, P = C.sim.p;
      for (let i = 0; i < C.sim.n; i++) P[i * 3] += 0.6;
      const B = shot(); let n = 0;
      for (let i = 0; i < A.length; i += 16) if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 40) n++;
      C.sim.live = false; skinView(prev);
      return n / (A.length / 16);
    });
    ok(c > 0.02, `animated preview: the displayed simulated cloth follows the simulation (${(c * 100).toFixed(1)} % of the image changes when the cape is moved)`);
  }
  // locked challenge outfit: it goes into the preview (its card is marked, without changing size) and its challenges show at the bottom of
  // the preview (#skInfo), but it cannot be worn
  await page.click('#skList .sk-card[data-skin="nomad"]');
  await page.evaluate(() => { const t = performance.now(); for (let k = 0; k < 2; k++) frame(t + k * 16); });
  await page.waitForTimeout(200);
  const L = await page.evaluate(() => { const o = document.querySelector('#skList .sk-card.viewing'), i = document.getElementById('skInfo'), c = document.querySelectorAll('#skList .sk-card'); return { s: Settings.skin, mine: skinMine(), view: SKV.view, open: o && o.dataset.skin, challenges: i && !i.classList.contains('hidden') ? i.querySelectorAll('.sk-d').length : 0, inCard: document.querySelectorAll('#skList .sk-card .sk-d').length, sameH: o && Math.abs(o.getBoundingClientRect().height - c[c.length - 1].getBoundingClientRect().height) < 2, locked: document.querySelectorAll('#skList .sk-card.locked').length, nChallenge: SKIN_CHALLENGE.length }; });
  ok(L.s === 'assault' && L.mine === 'assault' && L.view === 'nomad' && L.open === 'nomad' && L.challenges === 3 && L.inCard === 0 && L.sameH && L.locked === L.nChallenge, `locked challenge outfit: preview and challenges under the preview, same-size card, without wearing it (${JSON.stringify(L)})`);
  if (out) await page.screenshot({ path: path.join(out, 'outfits-challenge-locked.png') });
  await page.click('#skList .sk-card[data-skin="sniper"]');
  await page.evaluate(() => { const t = performance.now(); frame(t + 16); });
  const p = await page.evaluate(() => ({ s: Settings.skin, vm: VM_LOOK.key, body: PL.ent.model.lod.skin, kc: KC.body.lod.skin, sk: netPresence(PL.ent, performance.now()).sk, sel: document.querySelector('#skList .sk-card[aria-selected="true"]').dataset.skin }));
  ok(p.s === 'sniper' && p.vm === 'sniper0' && p.body === 'sniper' && p.kc === 'sniper' && p.sk === 'sniper' && p.sel === 'sniper', `picking a card: outfit, arms, body, killcam, online presence (${JSON.stringify(p)})`);
  if (out) await page.screenshot({ path: path.join(out, 'outfits-screen-ghillie.png') });
  // its three challenges done: the Nomad unlocks, is announced and can be worn
  const U = await page.evaluate(() => { for (const d of challengesOf('nomad')) challengeAdd(d.id, d.goal); return { un: skinUnlocked('nomad'), ann: ARSQ.list.length + (ARSQ.on ? 1 : 0) }; });
  ok(U.un && U.ann >= 2, `challenges done: outfit unlocked and announced (${JSON.stringify(U)})`);
  await page.click('#skList .sk-card[data-skin="nomad"]');
  await page.evaluate(() => { const t = performance.now(); frame(t + 16); });
  const N = await page.evaluate(() => ({ s: Settings.skin, vm: VM_LOOK.key, body: PL.ent.model.lod.skin, kc: KC.body.lod.skin, sk: netPresence(PL.ent, performance.now()).sk, cloth: !!KC.body.cloth, save: JSON.parse(localStorage.getItem('cod_arsenal') || '{}').ch ? 1 : 0 }));
  ok(N.s === 'nomad' && N.vm === 'nomad0' && N.body === 'nomad' && N.kc === 'nomad' && N.sk === 'nomad' && N.cloth, `challenge outfit worn: arms, body, killcam (with its cloth), online presence (${JSON.stringify(N)})`);
  if (out) await page.screenshot({ path: path.join(out, 'outfits-challenge-worn.png') });
  // thumbnails (thumbnail queue, in the menus)
  await page.evaluate(() => uiOpen('main'));
  await page.waitForFunction(() => SKIN_ALL.every((s) => VTHUMB.img['skin:' + s]), null, { timeout: 240000, polling: 500 }).catch(() => {});
  const th = await page.evaluate(() => SKIN_ALL.map((s) => (VTHUMB.img['skin:' + s] || '').length));
  ok(th.every((n) => n > 1000), `thumbnails of the ${th.length} outfits (${th.join(', ')} bytes)`);
  await page.waitForTimeout(300);
  const fr = await page.evaluate(() => SKIN_CHALLENGE.filter((s) => s !== skinMine()).filter((s) => SOLDIER_GEOS[s + 'hi'] || SOLDIER_GEOS[s + 'lo'] || GEAR.maps[s + 'tp'] || SKV.models[s]));
  ok(fr.length === 0, `challenge outfits that nothing shows: freed (${fr.join(', ') || 'everything'})`);
  // in a match: bot outfits by weapon, relation to the player
  await page.evaluate(() => { Settings.mode = 'tdm'; startMatch({}); });
  await page.waitForTimeout(500);
  const b = await page.evaluate(() => entities.filter((e) => !e.isPlayer && !e.off).map((e) => ({ cat: e.weapon.cat, skin: e.skin, look: e.model.lod.skin, rel: e.model.lod.rel, team: e.team })));
  const want = { ar: 'assault', pistol: 'assault', smg: 'smg', sniper: 'sniper', shotgun: 'shotgun' };
  ok(b.length && b.every((e) => e.skin === want[e.cat] && e.look === e.skin), `bots: outfit of the weapon's family (${b.map((e) => e.cat + '>' + e.look).join(' ')})`);
  ok(b.every((e) => e.rel === (e.team === 0 ? 0 : 1)), `by team: allies light (0), enemies dark (1) (${b.map((e) => e.team + ':' + e.rel).join(' ')})`);
  // pause: no outfit choice in a match (only on the Outfits screen of the menu)
  await page.evaluate(() => pauseGame());
  ok(await page.evaluate(() => !document.querySelector('#pause [data-pm="skin"]') && !document.getElementById('pmSkin')), 'pause: no Outfit view');
  // deathmatch: everyone as an enemy
  await page.evaluate(() => { resumeGame(); Settings.mode = 'ffa'; startMatch({}); });
  await page.waitForTimeout(500);
  const f = await page.evaluate(() => entities.filter((e) => !e.isPlayer && !e.off).map((e) => e.model.lod.rel));
  ok(f.length && f.every((r) => r === 1), `deathmatch: all seen as enemies (${f.join('')})`);
  const errs = logs.filter((l) => !/ERR_FILE_NOT_FOUND|favicon/.test(l));
  ok(errs.length === 0, `no page error${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
  await browser.close();
  console.log(fails ? `${fails} failure(s)` : 'all good');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
