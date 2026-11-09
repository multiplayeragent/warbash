/* Review of outfit models (low poly reference, see README "Outfit modeling rules"): for each outfit, in the studio
   of the Outfits screen (09u-outfits.js), soldier standing, weapon lowered, cloth settled: full body from the front, three-quarter, side and
   back, head from the front and back, bust, legs; one sheet per outfit (review-<outfit>.png). Aiming (AIM_VIEW=1), same thing with the weapon shouldered.
   node tools/dev/visual/outfits-review.js [folder] ; OUTFITS=assault,nomad (by default all ten) ; PAGE=other/version.html */
const fs = require('fs'), path = require('path');
const { openGame, HERE } = require('./common');
const out = process.argv[2] || path.join(HERE, 'shots');
const VIEW_LIST = [
  ['face', 'bodypart', 0, 2.7, 40], ['34', 'bodypart', 0.75, 2.7, 40], ['sideView', 'bodypart', 1.57, 2.7, 40], ['back', 'bodypart', 3.14, 2.7, 40],
  ['head', 'head', 0.35, 0.8, 38], ['head-back', 'head', 2.7, 0.8, 38], ['bustView', 'bustView', 0.5, 1.2, 40], ['legsPart', 'legsPart', 0.6, 1.6, 40],
];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { browser, page, logs } = await openGame({ w: 1500, h: 1050, settings: { quality: 'high', map: 'chergui' }, noMap: true, noHdri: true, page: process.env.PAGE });
  await page.evaluate(() => uiOpen('skins', ['main']));
  await page.waitForFunction(() => MBG.live && SKV.live, null, { timeout: 120000, polling: 500 });
  const skins = process.env.OUTFITS ? process.env.OUTFITS.split(',') : await page.evaluate(() => SKIN_ALL);
  const box = await page.evaluate((aimIn) => {
    GPUX.halt = true; // game loop suspended: each frame is rendered here, at a fixed step
    const f = skinLivePose;
    skinLivePose = (M, key, d) => { const e = skinLiveEnt(M, key); e.arms.adsW = aimIn ? 1 : 0; f(M, key, d, false); }; // standing, not walking
    const r = $('skView').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height };
  }, !!process.env.AIM_VIEW);
  const { execFileSync } = require('child_process');
  for (const sk of skins) {
    await page.evaluate((sk) => { skinView(sk); SKV.a = 0; for (let i = 0; i < 60; i++) { SKV.acc = 1 / 30; skinLiveDraw(); } }, sk);
    const files = [];
    for (const [nm, objective, az, dist, fov] of VIEW_LIST) {
      await page.evaluate(([objective, az, dist, fov]) => {
        vwCamPlace = (cam) => {
          const M = skinLiveModel(SKV.view), B = M.bones, t = new THREE.Vector3();
          if (objective === 'head') t.copy(B[SB.HEA].position).add(new THREE.Vector3(0, 0.06, 0));
          else if (objective === 'bustView') t.copy(B[SB.CHE].position).add(new THREE.Vector3(0, -0.05, 0));
          else if (objective === 'legsPart') t.set(B[SB.PEL].position.x, 0.5, B[SB.PEL].position.z);
          else t.set(B[SB.PEL].position.x, 0.92, B[SB.PEL].position.z);
          // soldier facing -z (SKV.a = 0) ; az: the camera turns around him, toward his right
          cam.position.set(t.x + Math.sin(az) * dist, t.y + dist * 0.12, t.z - Math.cos(az) * dist); cam.up.set(0, 1, 0); cam.lookAt(t); cam.fov = fov; cam.updateProjectionMatrix();
        };
        SKV.acc = 0; skinLiveDraw();
      }, [objective, az, dist, fov]);
      const f = path.join(out, `review-${sk}-${nm}.png`); await page.screenshot({ path: f, clip: box, timeout: 240000 }); files.push(f);
    }
    // sheet: two rows of four
    try { execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw
fs = sys.argv[2:]; ims = []
for f in fs:
    im = Image.open(f).convert('RGB'); s = 420 / im.size[1]; im = im.resize((int(im.size[0] * s), 420)); ImageDraw.Draw(im).text((4, 4), f.split('review-')[-1][:-4], fill=(255, 255, 0)); ims.append(im)
W = ims[0].size[0]; o = Image.new('RGB', (W * 4, 840))
for i, im in enumerate(ims): o.paste(im, ((i % 4) * W, (i // 4) * 420))
o.save(sys.argv[1])`, path.join(out, `review-${sk}.png`), ...files]); } catch (e) { console.log('sheet:', e.message); }
    console.log('review', sk);
  }
  const errs = logs.filter((l) => !l.includes('HDRI') && !l.includes('FILE_NOT_FOUND')); if (errs.length) console.log(errs.join('\n'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(2); });
