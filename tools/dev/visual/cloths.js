/* Simulated scenery cloths (02me-canvases.js): survey and screenshots. MAP=<map> node cloths.js [x z] [kind]
   Surveys the map's cloths (count, particles, kind), then picks the cloth of the wanted kind ('hung' by default; or flag, weighted, taut) closest to the
   point (x, z) and films it: at rest, while a soldier (a capsule, as in the game) runs through it, then under the blast
   of a grenade at 3 m (SIDE=-1: filmed from the other side; CAM=x,y,z: imposed camera). Screenshots: cloths/<map>-<n>.png next to this file (ignored by git). */
const fs = require('fs'), path = require('path');
const { openGame, HERE } = require('./common');
const MAP = process.env.MAP || 'chergui', SIDE = +(process.env.SIDE || 1), CAM = process.env.CAM ? process.env.CAM.split(',').map(Number) : null, X = +(process.argv[2] || 0), Z = +(process.argv[3] || 0), CLOTH_KIND = process.argv[4] || 'hung', OUT = path.join(HERE, 'cloths');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { browser, page, logs } = await openGame({ noMap: true, page: process.env.PAGE, settings: { quality: process.env.Q || 'medium', map: MAP } });
  await page.evaluate(() => mapEnsure(Settings.map));
  await page.evaluate(() => { document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; }); MATCH.state = 'capture'; });
  const info = await page.evaluate(([X, Z, CLOTH_KIND]) => {
    const g = (S) => (S.body ? (S.T.g < 5 ? 'flag' : S.T.drag < 0.5 ? 'weighted' : 'hung') : S.shot ? 'flag' : 'taut');
    const list = CANVASES.map((S, i) => ({ i, clothKind: g(S), n: S.T.n, clothSheets: S.T.sheets.length, c: [S.sph.center.x, S.sph.center.y, S.sph.center.z].map((v) => +v.toFixed(1)), r: +S.sph.radius.toFixed(1) }));
    const cand = list.filter((t) => t.clothKind === CLOTH_KIND).sort((a, b) => Math.hypot(a.c[0] - X, a.c[2] - Z) - Math.hypot(b.c[0] - X, b.c[2] - Z));
    return { list, pick: cand[0] || null };
  }, [X, Z, CLOTH_KIND]);
  console.log(`${info.list.length} cloths, ${info.list.reduce((s, t) => s + t.n, 0)} particles`);
  for (const t of info.list) console.log(`  #${t.i} ${t.clothKind} ${t.clothSheets} sheet(s) ${t.n} part. center ${t.c.join(' ')} r ${t.r}`);
  if (!info.pick) { console.log('no cloth of kind ' + CLOTH_KIND); await browser.close(); return; }
  const shot = async (name) => { await page.screenshot({ path: path.join(OUT, `${MAP}-${name}.png`), timeout: 240000 }); console.log(name); };
  // camera 4 m from the cloth, facing it (normal of its first sheet), at human height or the cloth's height
  await page.evaluate(([i, SIDE, CAM]) => {
    const S = CANVASES[i], c = S.sph.center, N = S.sim.nor, n = new V3(N[0], 0, N[2]).normalize();
    if (!(n.lengthSq() > 0.5)) n.set(1, 0, 0);
    n.multiplyScalar(SIDE);
    window._tis = { S, c: c.clone(), n };
    if (CAM) camera.position.set(...CAM); else camera.position.set(c.x + n.x * 4.2, Math.max(c.y, groundHeight(c.x, c.z) + 1.7), c.z + n.z * 4.2);
    camera.lookAt(c.x, c.y - 0.2, c.z); camera.fov = 65; camera.updateProjectionMatrix();
  }, [info.pick.i, SIDE, CAM]);
  // the bench renders only about one frame per second (two simulation steps per frame): the simulation is advanced by hand
  const steps = (n) => page.evaluate((n) => { for (let i = 0; i < n; i++) canvasesUpdate(CANVAS_H); }, n);
  await steps(Math.round(4 / (1 / 60))); await page.waitForTimeout(400); await shot('rest');
  // a soldier runs through the cloth (6 m/s), from one side to the other, along its center; the software bench renders only about one frame per
  // second: the simulation advances here step by step (1/60 s) while the soldier moves, then we film
  await page.evaluate(() => {
    const T = window._tis, y = groundHeight(T.c.x, T.c.z), e = { alive: true, off: false, crouchAmt: 0, pos: new V3(), fake: true };
    entities.push(e); T.e = e; T.k = -3;
    T.go = (k1) => { while (T.k < k1) { T.k += 6 * CANVAS_H; e.pos.set(T.c.x - T.n.x * T.k, y, T.c.z - T.n.z * T.k); canvasesUpdate(CANVAS_H); } };
    T.go(-0.35);
  });
  await page.waitForTimeout(400); await shot('crossing1');
  await page.evaluate(() => window._tis.go(0.05)); await page.waitForTimeout(400); await shot('crossing2');
  await page.evaluate(() => window._tis.go(0.5)); await page.waitForTimeout(400); await shot('crossing3');
  await page.evaluate(() => window._tis.go(3));
  await page.evaluate(() => { const T = window._tis; entities.splice(entities.indexOf(T.e), 1); canvasesBlast(new V3(T.c.x + T.n.x * 3, groundHeight(T.c.x, T.c.z) + 0.3, T.c.z + T.n.z * 3), 5); });
  await steps(15); await page.waitForTimeout(400); await shot('blast');
  await steps(210); await page.waitForTimeout(400); await shot('afterwards');
  const err = logs.filter((l) => /pageerror|TypeError|ReferenceError/.test(l));
  if (err.length) console.log(err.slice(0, 5).join('\n'));
  await browser.close();
})();
