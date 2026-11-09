/* Ambience trial: a map rendered with a modified ambience, without touching its code. node ambiance.js trial.json [quality=high]
   trial.json: { "map": "saintgivre", "prefix": "night", "atmo": { ...ambience fields to replace (sky: merged field by field) },
                  "skyPhoto": { "key": "kloppenheim_02", "rot": 0.3, "gain": 0.4 } or null (computed sky), "cams": [["name", [x, y, z], [cx, cy, cz], fov], ...],
                  "js": "SMS.force = 1" (optional: run once the map is ready, here Sirocco's storm at its strongest) }
   Without "cams": the shot.js views for Chergui, otherwise the framing of the map's illustration (MAP_DEFS.<id>.art). The photographed skies
   must be in assets/sky/ and the page built (build.py). Output: ambiences/<prefix>-<name>.png next to this file (ignored by git).
   Used to look for an ambience (time of day, sky, fog, color grade, street lighting atmo.lit, strength of the lamps atmo.lamps, lit
   windows winLit) before copying it into the map definition. */
const fs = require('fs'), path = require('path');
const { openGame, HERE } = require('./common');
const E = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), Q = process.argv[3] || 'high', OUT = path.join(HERE, 'ambiences');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { browser, page, logs } = await openGame({ noMap: true, page: process.env.PAGE, settings: { quality: Q, map: E.map } });
  const cams = await page.evaluate((E) => {
    const D = MAP_DEFS[E.map], A = Object.assign({}, D.atmo, E.atmo || {});
    if (E.atmo && E.atmo.sky) A.sky = Object.assign({}, D.atmo.sky, E.atmo.sky);
    if (E.atmo && E.atmo.grade) A.grade = Object.assign({}, D.atmo.grade, E.atmo.grade);
    D.atmo = A;
    if (E.skyPhoto !== undefined) D.skyPhoto = E.skyPhoto;
    const art = D.art || { cam: [30, 20, 40], look: [0, 0, 0], fov: 60 };
    return E.cams || [['art', art.cam, art.look, art.fov]];
  }, E);
  await page.evaluate(() => mapEnsure(Settings.map));
  if (E.js) await page.evaluate(E.js);
  await page.evaluate(() => { document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; }); MATCH.state = 'capture'; });
  for (const [name, p, t, fov] of cams) {
    await page.evaluate(([p, t, fov]) => { camera.position.set(...p); camera.lookAt(...t); camera.fov = fov || 70; camera.updateProjectionMatrix(); for (const l of csm.lights) l.shadow.needsUpdate = true; }, [p, t, fov]);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, `${E.prefix || E.map}-${name}.png`), timeout: 240000 });
    console.log(name);
  }
  const err = logs.filter((l) => /pageerror|TypeError|ReferenceError/.test(l));
  if (err.length) console.log(err.slice(0, 5).join('\n'));
  await browser.close();
})();
