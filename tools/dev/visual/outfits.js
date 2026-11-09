/* Outfit screenshots (06ga-outfits.js) in a map: each outfit seen by an ally (light) then, just to its right, by an
   enemy (dark), from the front, back, side (turned a quarter turn), close up and the heads; plus a distant view to judge the ally / enemy readability.
   node tools/dev/visual/outfits.js [folder] ; MAP=saintgivre for another map (by default, Chergui), XZ=x,z for the location of the row
   (clear over 8 m wide and 30 m toward +z ; by default 0,30, a street of Chergui) ; Q=low for Low quality ;
   PAGE=path/to/another/version.html for another version ; OUTFITS=challenge for challenge outfits (06gc-outfits-challenge.js), or a
   list (OUTFITS=nomad,void) ; by default, the four base outfits ; VIEW_LIST=face,afar to render only those views. */
const fs = require('fs'), path = require('path');
const { openGame, HERE } = require('./common');
const out = process.argv[2] || path.join(HERE, 'shots');
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { browser, page, logs } = await openGame({ settings: { quality: process.env.Q || 'high', map: process.env.MAP || 'chergui' }, page: process.env.PAGE });
  await page.evaluate(() => { document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; }); MATCH.state = 'capture'; });
  // row: each outfit light then dark (same lighting for both), facing the camera; clear spot of the map
  const spot = await page.evaluate(([XZ, list]) => {
    const x0 = XZ[0], z0 = XZ[1], y0 = groundHeight(x0, z0, 3, 0.3);
    for (const e of entities) if (e.model) e.model.root.visible = false;
    window.__T = [];
    let i = 0;
    const skins = list === 'challenge' ? SKIN_CHALLENGE : list ? list.split(',') : SKIN_IDS, n = skins.length * 2;
    for (const s of skins) for (const rel of [0, 1]) {
      const M = makeSoldier(s, rel, { assault: 'm4', smg: 'mp5', sniper: 'l96', shotgun: 'm1014', nomad: 'm1014', tempest: 'l96', verdant: 'l96', raptor: 'mp5', void: 'm4', yellowVest: 'm4' }[s]);
      const e = { model: M, pos: new V3(x0 - (n - 1) * 0.55 + i * 1.1, y0, z0), vel: new V3(), yaw: 0, pitch: 0, alive: true, crouchAmt: 0, onGround: true, isPlayer: false, visible: false, target: null, lastShotT: -9, lastSeenT: -99, arms: { adsW: 0 }, recoil: 0 };
      setSoldierLod(M, true); __T.push(e); i++;
    }
    window.__n = n;
    // (these soldiers are not entities: their simulated cloth, 06gb-cloth.js, is computed here)
    window.__pose = (yaw) => { for (const e of __T) { e.yaw = yaw; for (let k = 0; k < 30; k++) { animSoldier(e, 1 / 30); if (e.model.cloth) clothSimulate(e.model, e.model.cloth, 1 / 30); } } };
    __pose(Math.PI);
    return { x0, y0, z0 };
  }, [(process.env.XZ || '0,30').split(',').map(Number), process.env.OUTFITS || '']);
  const far = Math.max(1, (await page.evaluate(() => __n)) / 8); // a row longer than eight soldiers: the overview shots pull back
  const views = [
    ['face', [0, 1.35, 6.2 * far], [0, 1.0, 0], 50, Math.PI], ['back', [0, 1.35, 6.2 * far], [0, 1.0, 0], 50, 0], ['sideView', [0, 1.35, 6.2 * far], [0, 1.0, 0], 50, Math.PI / 2],
    ['close-1', [-2.2, 1.5, 2.6], [-2.2, 1.25, 0], 45, Math.PI], ['close-2', [2.2, 1.5, 2.6], [2.2, 1.25, 0], 45, Math.PI],
    ['headsView', [-0.55, 1.72, 1.1], [-0.55, 1.6, 0], 40, Math.PI], ['afar', [2.5, 1.7, -24], [0, 1.0, 0], 62, 0.15],
  ];
  for (const [name, c, t, fov, yaw] of views.filter((v) => !process.env.VIEW_LIST || process.env.VIEW_LIST.split(',').includes(v[0]))) {
    await page.evaluate(([c, t, fov, yaw, S]) => {
      __pose(yaw);
      camera.position.set(S.x0 + c[0], S.y0 + c[1], S.z0 + c[2]); camera.lookAt(S.x0 + t[0], S.y0 + t[1], S.z0 + t[2]); camera.fov = fov; camera.updateProjectionMatrix();
      for (const l of csm.lights) l.shadow.needsUpdate = true;
    }, [c, t, fov, yaw, spot]);
    await page.evaluate(() => { const t = performance.now(); for (let k = 0; k < 3; k++) frame(t + k * 16); }); // the frame loop does not run by itself without a display
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, `outfits-${name}.png`), timeout: 240000 });
    console.log(name);
  }
  if (logs.length) console.log(logs.slice(0, 30).join('\n'));
  await browser.close();
})();
