/* Minimap check (src/09ga-minimap.js, drawMinimap in src/09-game.js): node minimap-check.js [page=dist/index.html]
   MAP_LIST=chergui,cirrus to limit the number (default all nine); PHONE=1: phone in landscape instead of a desktop screen; outputs in
   minimaps/ (ignored by git): each map's background (<id>.png), the minimap drawn at 368 px and 184 px (<id>-view.png, <id>-view-small.png)
   the airstrike map as the tablet opens it (<id>-strike.png)
   and the top left corner of the in-game screen, minimap included, with allies and enemies (<id>-screen.png; without the 3D rendering, which slows
   captures a lot in software rendering: KEEP_RENDER=1 to keep it).
   For each map, match started without satellite survey (the minimap no longer depends on it):
   - the background is drawn, at the size of the play area with its margins (mmDensity px per meter), and the airstrike background (KS.plan) at that of the
     play area at TAC_S px per meter;
   - it carries dark ground and light objects (neither empty nor a white slab), and no wall is drawn where the teams spawn;
   - the drawing takes no more than 400 ms (software rendering, a phone is several times slower);
   - drawMinimap passes with allies, enemies revealed by the UAV, a grenade and, in domination (Saint-Givre), the points. */
const fs = require('fs'), path = require('path');
const { openGame, HERE } = require('./common');
const fails = [];
const ok = (c, msg, extra) => { console.log((c ? 'ok    ' : 'FAIL ') + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails.push(msg); };
const OUT = path.join(HERE, 'minimaps');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const maps = (process.env.MAP_LIST || 'chergui,saintgivre,portmael,floralia,notos,scoria,cirrus,sirocco,belhorizon').split(',');
  for (const id of maps) {
    console.log(id);
    const { browser, page, logs } = await openGame({ page: process.argv[2], ...(process.env.PHONE ? { mobile: true } : { w: 1280, h: 720 }), settings: { quality: 'low', map: id, mode: id === 'saintgivre' ? 'dom' : 'tdm' }, noHdri: true });
    const r = await page.evaluate((KEEP_RENDER) => {
      LOCK.fallback = true; startMatch({});
      KS.sat = null; // the minimap does without the satellite survey
      if (!KEEP_RENDER) composer.render = () => {};
      const t0 = performance.now(); buildMinimapStatic(); const ms = performance.now() - t0;
      const c = HUD.mmStatic, g = c.getContext('2d'), S = HUD.mmS;
      // luminance of the background: share of the play area's ground that is dark or light
      const x0 = Math.round((MAP.x0 - HUD.mmX0) * S), z0 = Math.round((MAP.z0 - HUD.mmZ0) * S), w = Math.round((MAP.x1 - MAP.x0) * S), h = Math.round((MAP.z1 - MAP.z0) * S);
      const d = g.getImageData(x0, z0, w, h).data; let dark = 0, light = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; n++; if (l < 70) dark++; else if (l > 150) light++; }
      const at = (x, z) => { const p = g.getImageData(Math.round((x - HUD.mmX0) * S), Math.round((z - HUD.mmZ0) * S), 1, 1).data; return (p[0] + p[1] + p[2]) / 3; };
      const spawns = SPAWNS.flatMap((a) => a.map((s) => at(s[0], s[1])));
      // allies, enemies (UAV), a grenade, domination: drawMinimap must pass
      let err = null;
      try {
        MATCH.uav[PL.ent.team] = 30;
        for (const e of entities) if (e.alive && !e.isPlayer) { e.pos.x = PL.ent.pos.x + (Math.random() - 0.5) * 30; e.pos.z = PL.ent.pos.z + (Math.random() - 0.5) * 30; }
        if (typeof NADES !== 'undefined') NADES.push({ p: new V3(PL.ent.pos.x + 3, 0, PL.ent.pos.z) });
        HUD.mmFit = true; drawMinimap(); drawMinimap();
        if (typeof NADES !== 'undefined') NADES.pop();
      } catch (e) { err = String(e); }
      const plan = KS.plan ? [KS.plan.width, KS.plan.height] : null, tacW = Math.round((MAP.x1 - MAP.x0) * TAC_S), tacH = Math.round((MAP.z1 - MAP.z0) * TAC_S);
      let tac = null; try { KS.map.open = true; KS.map.x = 0; KS.map.z = 0; drawTacMap(); tac = $('tacCanvas').toDataURL('image/png'); KS.map.open = false; } catch (e) { err = err || 'strike: ' + e; }
      return { ms, tac, plan, tacW, tacH, W: c.width, H: c.height, S, mapW: MAP.x1 - MAP.x0, mapH: MAP.z1 - MAP.z0, darkPart: dark / n, lightPart: light / n, spawns, err, mode: MATCH.mode, dom: typeof DOM !== 'undefined' && DOM.pts ? DOM.pts.length : 0 };
    }, !!process.env.KEEP_RENDER);
    ok(r.W === Math.ceil((r.mapW + 28) * r.S) && r.H === Math.ceil((r.mapH + 36) * r.S), 'background at the size of the play area with its margins', [r.W, r.H, r.S]);
    ok(r.plan && r.plan[0] === r.tacW && r.plan[1] === r.tacH, 'airstrike background at the size of the play area', [r.plan, r.tacW, r.tacH]);
    ok(r.darkPart > 0.3 && r.lightPart > 0.01 && r.lightPart < 0.6, 'dark ground and light objects', { dusky: +r.darkPart.toFixed(2), lightShare: +r.lightPart.toFixed(2) });
    ok(r.spawns.every((l) => l < 100), "the ground is not a wall at any spawn (dark, or mid gray under a roof)", r.spawns.map((l) => Math.round(l)));
    ok(r.ms < 400, 'background drawn in under 400 ms', +r.ms.toFixed(0));
    ok(!r.err, 'drawMinimap passes (allies, enemies, grenade' + (r.dom ? ', domination' : '') + ')', r.err || undefined);
    await page.waitForTimeout(500);
    const box = await page.evaluate(() => { const r = $('minimap').getBoundingClientRect(); return { x: 0, y: 0, width: Math.min(innerWidth, r.right + 120), height: Math.min(innerHeight, r.bottom + 90), mm: Math.round(r.width) }; });
    await page.screenshot({ path: path.join(OUT, id + (process.env.PHONE ? '-phone' : '') + '-screen.png'), clip: { x: 0, y: 0, width: box.width, height: box.height } });
    console.log('minimap displayed at', box.mm, 'px');
    // images: the background, then the minimap at 184 px (desktop) and 92 px (phone), player at the center of the map
    const png = await page.evaluate(() => {
      const out = { background: HUD.mmStatic.toDataURL('image/png') };
      const cv = $('minimap');
      for (const [k, px] of [['largeSize', 368], ['smallItem', 184]]) {
        cv.width = cv.height = px; HUD.mmFit = false; PL.ent.pos.set(0, 0, 0); drawMinimap(); out[k] = cv.toDataURL('image/png');
      }
      return out;
    });
    fs.writeFileSync(path.join(OUT, id + '.png'), Buffer.from(png.background.split(',')[1], 'base64'));
    if (r.tac) fs.writeFileSync(path.join(OUT, id + '-strike.png'), Buffer.from(r.tac.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(OUT, id + '-view.png'), Buffer.from(png.largeSize.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(OUT, id + '-view-small.png'), Buffer.from(png.smallItem.split(',')[1], 'base64'));
    const errs = logs.filter((l) => /pageerror/.test(l) || (/^\[error\]/.test(l) && !/ERR_/.test(l)));
    ok(!errs.length, 'no errors in the page', errs.slice(0, 3));
    await browser.close();
  }
  console.log(fails.length ? `${fails.length} failure(s)` : 'all good');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
