/* Screenshots of the map from free cameras, all post-processing included.
   node shot.js [folder] [prefix] [quality] [cameras.json]
   cameras.json: [["name", [x, y, z], [targetX, targetY, targetZ], fov, near, fog], ...]
   near (optional, m): what is closer than this to the camera is cut away. A camera straight above a building, with near = its height
   minus the level to cut at, gives the plan of a floor with the roof and the floors above removed.
   fog (optional, 0 to 1): share of the map's fog kept for this view. An elevation shot from far away with a long lens looks through
   much more haze than a player ever does: 0 shows the true colors of the facade.
   PAGE=path/to/another/version.html: shoot another version (before/after comparison).
   MAP=saintgivre: map to load (by default, Chergui). */
const fs = require('fs'), path = require('path');
const { openGame, HERE } = require('./common');
const out = process.argv[2] || path.join(HERE, 'shots'), prefix = process.argv[3] || 'sightline', Q = process.argv[4] || 'high';
const CAMS = process.argv[5] ? JSON.parse(fs.readFileSync(process.argv[5], 'utf8')) : [
  ['aerial', [30, 28, 58], [0, 0, 20]], ['long', [-30, 1.7, 44], [-30, 1.5, 0]], ['street', [0, 1.7, 38], [0, 2, 0]],
  ['blockedDoors', [-2, 1.7, 8], [-2, 2, -6]], ['souk', [8, 1.7, 6], [18, 1.5, -4]], ['hangar', [22, 1.7, 32], [34, 1.5, 22]],
  ['containers', [22, 1.7, 18], [32, 1.5, 4]], ['base', [-10, 1.7, 47], [10, 2, 40]], ['house', [-22, 1.7, 19], [-15, 1.5, 28]],
  ['passage', [8, 1.7, 16], [18, 3, 16]],
];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const t0 = Date.now(), { browser, page, logs } = await openGame({ settings: { quality: Q, map: process.env.MAP || 'chergui' }, page: process.env.PAGE });
  console.log('loaded in', ((Date.now() - t0) / 1000).toFixed(1), 's ; steps:', JSON.stringify(await page.evaluate(() => (typeof MAPL !== 'undefined' ? BOOT_T.concat(MAPL.T) : BOOT_T))));
  await page.evaluate(() => { document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; }); MATCH.state = 'capture'; });
  for (const [name, p, t, fov, near, fog] of CAMS) {
    await page.evaluate(([p, t, fov, near, fog]) => {
      if (camera.userData.near0 === undefined) camera.userData.near0 = camera.near;
      camera.near = near || camera.userData.near0;
      if (scene.fog) {
        if (scene.userData.fogD0 === undefined) scene.userData.fogD0 = scene.fog.density;
        scene.fog.density = scene.userData.fogD0 * (typeof fog === 'number' ? fog : 1);
      }
      camera.position.set(...p); camera.lookAt(...t); camera.fov = fov || 70; camera.updateProjectionMatrix(); for (const l of csm.lights) l.shadow.needsUpdate = true;
    }, [p, t, fov, near, fog]);
    await page.waitForTimeout(1200);
    // software rendering: a view full of relief can take several tens of seconds per image
    await page.screenshot({ path: path.join(out, `${prefix}-${name}.png`), timeout: 240000 });
    console.log(name, JSON.stringify(await page.evaluate(() => ({ invocations: renderer.info.render.calls, triangles: renderer.info.render.triangles }))));
  }
  if (logs.length) console.log(logs.slice(0, 30).join('\n'));
  await browser.close();
})();
