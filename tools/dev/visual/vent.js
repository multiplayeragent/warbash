/* Foliage wind (see "Foliage wind" in the README): node vent.js        MAP_LIST=chergui,sirocco to limit the list.
   For each map (at Low quality, in a view chosen on foliage: VIEW_LIST):
   - no shader program rejected (gpuCheckPrograms), the console stays clean;
   - each mesh of a wind material (WM_WIND: foliage, cyfol, conifer, stem; WM_LIVE: leafA, leafB, cane of Floralia and Cirrus) carries
     the sway attribute aSw (the weights themselves are freed from RAM once sent to the GPU);
   - the same view taken a few seconds apart changes where there is foliage (a share of the pixels differs): the wind does animate the image.
   A map without wind foliage (Port-Maël, Scoria) must have no wind material and no image that moves because of it. Exits with an error at the
   first defect. Variables: CHROMIUM (browser). */
const { openGame } = require('./common');
const MAPS = (process.env.MAP_LIST || 'chergui,saintgivre,portmael,floralia,notos,scoria,cirrus,sirocco').split(',');
// maps whose scenery carries wind foliage
const FLORA = { chergui: true, saintgivre: true, portmael: false, floralia: true, notos: true, scoria: false, cirrus: true, sirocco: true };
// view of each map on foliage: [camera, target, fov] (base palm tree, little-square fir, Floralia alley, plaza plane tree, grove, oasis) ;
// maps without foliage keep the view of their artwork (`art`)
const VIEW_LIST = {
  chergui: [[-15, 2, 43], [-9, 5.5, 48.5], 60], saintgivre: [[14, 2, 20.6], [20.6, 3.5, 20.6], 60], floralia: [[0, 1.75, 42.9], [0.4, 4.6, 18], 62],
  notos: [[-2, 4, 12], [-8.5, 8, 0], 60], cirrus: [[18, 2, 12], [27, 6, 3], 60], sirocco: [[-6, 2, -9], [-3.6, 7, 3.9], 60],
};
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL  :', m); } else console.log('ok    :', m); };

(async () => {
  for (const id of MAPS) {
    const { browser, page, logs } = await openGame({ settings: { quality: 'low', map: id } });
    await page.evaluate(() => { document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; }); MATCH.state = 'capture'; });
    const R = await page.evaluate((viewList) => {
      const bad = gpuCheckPrograms().map((b) => b.name + ' ' + b.log), mats = {};
      for (const m of WORLD.meshes) {
        const mat = m.material, wind = mat.defines && (mat.defines.WM_WIND !== undefined || mat.defines.WM_LIVE !== undefined);
        if (!wind) continue;
        const a = m.geometry.attributes.aSw, k = m.name.split(':')[1], r = mats[k] || (mats[k] = { meshes: 0, verts: 0, noAttr: 0 });
        r.meshes++; if (!a) { r.noAttr++; continue; }
        r.verts += a.count;
      }
      const art = CURMAP.def.art, v = viewList || [art.cam, art.look, art.fov || 60];
      camera.position.set(...v[0]); camera.lookAt(...v[1]); camera.fov = v[2]; camera.updateProjectionMatrix();
      for (const l of csm.lights) l.shadow.needsUpdate = true;
      return { bad, mats, wind: [...WIND_U.uWnD.value.toArray()] };
    }, VIEW_LIST[id] || null);
    ok(R.bad.length === 0, `${id}: no program rejected${R.bad.length ? ': ' + R.bad.join(' | ') : ''}`);
    const names = Object.keys(R.mats);
    if (FLORA[id]) {
      ok(names.length > 0, `${id}: wind materials (${names.join(', ') || 'none'})`);
      for (const k of names) ok(R.mats[k].noAttr === 0 && R.mats[k].verts > 0, `${id}: ${k} carries the sway weights (${R.mats[k].meshes} meshes, ${R.mats[k].verts} vertices)`);
    } else ok(names.length === 0, `${id}: no wind material (${names.join(', ') || 'none'})`);
    ok(R.wind[2] > 0.5 && R.wind[2] < 1.6 && Math.abs(Math.hypot(R.wind[0], R.wind[1]) - 1) < 1e-3, `${id}: map wind (direction ${R.wind[0].toFixed(2)}, ${R.wind[1].toFixed(2)}, force ${R.wind[2].toFixed(2)})`);
    // three frames of the same view, 1.7 s apart: the largest difference is the one that counts (two instants may fall in phase)
    const shots = [];
    for (let i = 0; i < 3; i++) { await page.waitForTimeout(i ? 1700 : 2500); shots.push((await page.screenshot({ timeout: 240000 })).toString('base64')); }
    const diff = await page.evaluate(async (S) => {
      const load = (b) => new Promise((res) => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); res(g.getImageData(0, 0, im.width, im.height).data); }; im.src = 'data:image/png;base64,' + b; });
      const D = await Promise.all(S.map(load)); let best = 0;
      for (let a = 0; a < D.length; a++) for (let b = a + 1; b < D.length; b++) { let n = 0; for (let i = 0; i < D[a].length; i += 4) if (Math.abs(D[a][i] - D[b][i]) + Math.abs(D[a][i + 1] - D[b][i + 1]) + Math.abs(D[a][i + 2] - D[b][i + 2]) > 60) n++; best = Math.max(best, n / (D[a].length / 4)); }
      return best;
    }, shots);
    if (FLORA[id]) ok(diff > 0.0015, `${id}: the foliage moves (${(diff * 100).toFixed(2)} % of pixels change from one frame to the next)`);
    else console.log(`      ${id}: ${(diff * 100).toFixed(2)} % of pixels change (water, sky, flags: indicative)`);
    const errs = logs.filter((l) => !l.includes('ERR_FILE_NOT_FOUND'));
    ok(errs.length === 0, `${id}: clean console${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
    await browser.close();
  }
  console.log(fails ? `${fails} failure(s)` : 'all good');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
