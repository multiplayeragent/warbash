/* Model showcase: each prefab of a series placed alone on an empty terrain (the ground of Chergui, without the town), photographed from three-
   quarter front and rear, with its collisions in wireframe on a second view. Used to retouch a model and its variants without loading
   a whole map, and to check that what is seen and what is touched coincide.
   node showcase.js [series=carList] [quality=high] [--cols] [--profile] [--only=name,name]      (series: see SERIES; PAGE=other version)
   --profile adds a side view and a front view at human height (window placement), --only only photographs the named models.
   Output: showcase/<series>-<no.>-<name>-front.png, -rear.png (-side.png and -face.png with --profile, -cols.png with --cols) next to this file, ignored by git; on the console,
   the triangles and collision boxes of each model. */
const fs = require('fs'), path = require('path');
const { openGame, HERE } = require('./common');
const args = process.argv.slice(2), series = args.find((a) => !a.startsWith('-') && !/^(high|medium|low)$/.test(a)) || 'carList';
const Q = args.find((a) => /^(high|medium|low)$/.test(a)) || 'high', withCols = args.includes('--cols'), withSide = args.includes('--profile');
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const OUT = path.join(HERE, 'showcase');
/* A series: [name, prefab expression (evaluated in the page), tint, collision boxes (expression, optional), size (m)].
   A vehicle shows the boxes the map places (pf.vcols, vehCols); a prefab that carries its own (M.col) shows those too. */
const SERIES = {
  // common map objects (October 2026 review)
  things: [
    ['genset', 'PF.generator()', 'null', null, 3], ['skipBin', 'PF.dumpster()', '[0.25, 0.42, 0.3]', null, 3], ['cableReel', 'PF.reel()', 'null', null, 2.5],
    ['barrel', 'PF.barrel()', '[0.3, 0.42, 0.55]', null, 1.5], ['jerrycan', 'PF.jerrycan()', '[0.75, 0.15, 0.1]', null, 1], ['gas-bottle', 'PF.gasBottle()', '[0.2, 0.35, 0.65]', null, 1],
    ['chair', 'PF.chair()', 'null', null, 1.5], ['table', 'PF.cafeTable()', 'null', null, 1.5], ['amphora', 'PF.jar()', 'null', null, 1.5],
    ['pole', 'PF.pole()', 'null', null, 9], ['bollard', 'PF.bollard()', 'null', null, 1.2], ['cinder-blocks', 'PF.blocks()', 'null', null, 2],
  ],
  // harbor and winter objects (October 2026 review)
  quay: [
    ['ice-machine', 'PF.iceMachine()', 'null', null, 5], ['cold-room', 'PF.coldRoom(4, 3, 3)', 'null', null, 8], ['conveyor', 'PF.conveyor(4)', 'null', null, 4],
    ['ice-pallet', 'PF.icePallet()', 'null', null, 2], ['bitt', 'PF.bitt()', 'null', null, 1], ['life-ring-stand', 'PF.lifeRingStand()', 'null', null, 2],
    ['sled', 'PF.sled()', 'null', null, 1.5], ['pyre', 'PF.woodpile()', 'null', null, 3], ['barrier', 'PF.fence()', 'null', null, 4],
    ['planks', 'PF.plankStack()', 'null', null, 4], ['hay', 'PF.hayBale()', 'null', null, 1.5], ['marketStall', 'PF.marketStall(1)', 'null', null, 3],
  ],
  // roofs and streets (October 2026 review)
  streets: [
    ['ac-unit', 'PF.acUnit()', 'null', null, 1.5], ['cistern', 'PF.waterTank()', 'null', null, 2.5], ['dish', 'PF.dish()', 'null', null, 1.5],
    ['solar-heater', 'PF.solarHeater()', 'null', null, 2.5], ['tv-antenna', 'PF.antenna()', 'null', null, 3], ['streetLamp', 'PF.lampPost()', 'null', null, 6],
    ['tyres', 'PF.tire()', 'null', null, 1.2], ['counter', 'PF.counter()', 'null', null, 3], ['market-stall', 'PF.stall([0.7, 0.2, 0.15])', 'null', null, 3.5],
    ['lantern', 'PF.lantern()', 'null', null, 1], ['table', 'PF.table()', 'null', null, 2.5], ['chair', 'PF.chair()', '[0.2, 0.35, 0.65]', null, 1.2],
  ],
  // harbor machinery and large objects (redone from photos, October 2026)
  port: [
    ['trolley', 'PF.forklift()', '[0.95, 0.75, 0.15]', null, 4.5],
    ['crane', 'PF.quayCrane(9)', 'null', null, 14],
  ],
  carList: [
    ['saloon', "PF.car('sedan')", "[0.86, 0.84, 0.78]", "vehCols('sedan')", 5],
    ['dusty-sedan', "PF.car('sedan', { dust: 1 })", "[0.55, 0.12, 0.1]", "vehCols('sedan')", 5],
    ['sedan-wreck', "PF.car('sedan', { wreck: 1 })", 'null', "vehCols('sedan', { wreck: 1 })", 5],
    ['hatchback', "PF.car('hatch')", "[0.2, 0.32, 0.5]", "vehCols('hatch')", 4.5],
    ['hatchback-wreck', "PF.car('hatch', { wreck: 1 })", 'null', "vehCols('hatch', { wreck: 1 })", 4.5],
    ['suv', "PF.car('suv')", "[0.55, 0.12, 0.1]", "vehCols('suv')", 5],
    ['minivan', "PF.car('mpv')", "[0.2, 0.32, 0.5]", "vehCols('mpv')", 5],
    ['crossover', "PF.car('cross')", "[0.86, 0.86, 0.84]", "vehCols('cross')", 5],
    ['4x4', "PF.car('offroad')", "[0.12, 0.5, 0.62]", "vehCols('offroad')", 5],
    ['muddy-4x4', "PF.car('offroad', { dust: 1, rack: 1 })", "[0.62, 0.58, 0.48]", "vehCols('offroad')", 5],
    ['4x4-wreck', "PF.car('offroad', { wreck: 1 })", 'null', "vehCols('offroad', { wreck: 1 })", 5],
  ],
  trucks: [
    ['army-tarp', "PF.truck('army', { load: 'tarp' })", '[0.42, 0.44, 0.32]', "vehCols('army', { load: 'tarp' })", 8],
    ['army-flatbed', "PF.truck('army', { load: 'open' })", '[0.66, 0.58, 0.44]', "vehCols('army', { load: 'open' })", 8],
    ['army-wreck', "PF.truck('army', { wreck: 1 })", 'null', "vehCols('army', { wreck: 1 })", 8],
    ['cargo-stakes', "PF.truck('cargo', { load: 'cargo' })", '[0.72, 0.62, 0.42]', "vehCols('cargo', { load: 'cargo' })", 8],
    ['cargo-tarp', "PF.truck('cargo', { load: 'tarp' })", '[0.36, 0.42, 0.3]', "vehCols('cargo', { load: 'tarp' })", 8],
    ['van', "PF.truck('box')", '[0.9, 0.9, 0.88]', "vehCols('box')", 8],
    ['fridge', "PF.truck('box', { reefer: 1 })", '[0.9, 0.3, 0.12]', "vehCols('box', { reefer: 1 })", 8],
    ['box-truck-wreck', "PF.truck('box', { wreck: 1 })", 'null', "vehCols('box', { wreck: 1 })", 8],
  ],
  sandbagRow: [
    ['bag-jute', 'PF.sandbagFat()', 'SANDBAG_TINT.jute', '', 1.2],
    ['bag-khaki', 'PF.sandbagFat()', 'SANDBAG_TINT.khaki', '', 1.2],
    ['bag-white', 'PF.sandbagFat()', 'SANDBAG_TINT.white', '', 1.2],
    ['bag-low', 'PF.sandbag()', 'SANDBAG_TINT.sand', '', 1.2],
  ],
  // sandbag walls: physics bodies placed by the builders (sandbags, sandbagArc, sandbagU, sandbagPile)
  wallSegs: [
    ['straight', "(x, z) => sandbags(x, z, 3.6, 'x', 4)", '', '', 5],
    ['double', "(x, z) => sandbagWall(x, z, 3.6, 0, { rows: 5, deep: 2 })", '', '', 5],
    ['arc', "(x, z) => sandbagArc(x, z + 2.4, 3.2, -2.2, -0.9, { rows: 4 })", '', '', 5],
    ['horseshoe', "(x, z) => sandbagU(x, z, 3.0, 1.8, 0, { rows: 4 })", '', '', 5],
    ['pile', "(x, z) => sandbagPile(x, z, 2.6, 0, { seed: 3 })", '', '', 4],
    ['khaki', "(x, z) => sandbagWall(x, z, 3.0, 0, { rows: 3, color: 'khaki' })", '', '', 5],
  ],
};
(async () => {
  const list = SERIES[series];
  if (!list) { console.error('unknown series: ' + series + ' (' + Object.keys(SERIES).join(', ') + ')'); process.exit(2); }
  fs.mkdirSync(OUT, { recursive: true });
  const { browser, page, logs } = await openGame({ noMap: true, noHdri: false, page: process.env.PAGE, settings: { quality: Q, map: 'chergui' } });
  // the map: the ground of Chergui alone, each model in a row (8 per row, 10 m apart on x, 14 m between rows)
  const info = await page.evaluate((list) => {
    const D = MAP_DEFS.chergui, spots = list.map((it, i) => [-31.5 + (i % 8) * 9, -20 + Math.floor(i / 8) * 14]), out = [];
    D.build = function () {
      SR.rng = rngOf(1337);
      list.forEach(([name, pfx, tint, colx], i) => {
        const [x, z] = spots[i], f = (0, eval)(pfx);
        if (typeof f === 'function' && !f.parts) { f(x, z); out.push({ name, tris: 0, cols: [] }); return; }
        const t = (0, eval)('(' + (tint || 'null') + ')');
        DECOR.place(f, x, 0, z, 0, t ? { tint: t } : undefined);
        const boxes = f.vcols || (colx ? (0, eval)(colx) : []);
        if (boxes.length) colShape(x, 0, z, 0, boxes);
        out.push({ name, tris: Math.round(f.tris()), cols: boxes.concat(f.cols.map((c) => [c.x0, c.x1, c.y0, c.y1, c.z0, c.z1])) });
      });
    };
    D.after = () => {}; D.update = () => {};
    return mapEnsure('chergui').then(() => ({ spots, out }));
  }, list);
  await page.evaluate(() => { document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; }); MATCH.state = 'capture'; });
  const shot = async (file, p, t, fov) => {
    await page.evaluate(([p, t, fov]) => { camera.position.set(...p); camera.lookAt(...t); camera.fov = fov; camera.updateProjectionMatrix(); for (const l of csm.lights) l.shadow.needsUpdate = true; }, [p, t, fov]);
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT, file), timeout: 240000 });
  };
  for (let i = 0; i < list.length; i++) {
    const [name, , , , size] = list[i], [x, z] = info.spots[i], s = size || 5, o = info.out[i], tag = `${series}-${String(i + 1).padStart(2, '0')}-${name}`;
    console.log(`${name}: ${o.tris} triangles, ${o.cols.length} box${o.cols.length > 1 ? 'es' : ''}${o.cols.length ? ': ' + o.cols.map((b) => '[' + b.map((v) => +(+v).toFixed(2)).join(' ') + ']').join(' ') : ''}`);
    if (only.length && !only.includes(name)) continue;
    await shot(tag + '-front.png', [x + s * 0.62, s * 0.34, z - s * 0.9], [x, s * 0.12, z], 50);
    await shot(tag + '-rear.png', [x - s * 0.7, s * 0.3, z + s * 0.85], [x, s * 0.12, z], 50);
    if (withSide) {
      await shot(tag + '-side.png', [x + s * 1.25, s * 0.16, z], [x, s * 0.16, z], 40);
      await shot(tag + '-face.png', [x + s * 0.12, s * 0.2, z - s * 1.3], [x, s * 0.16, z], 40);
    }
    if (withCols && o.cols.length) {
      await page.evaluate(([x, z, cols]) => {
        const g = new THREE.Group(); g.name = 'showcaseCols';
        for (const b of cols) { const m = new THREE.Mesh(new THREE.BoxGeometry(b[1] - b[0], b[3] - b[2], b[5] - b[4]), new THREE.MeshBasicMaterial({ color: 0xff2060, wireframe: true, depthTest: false })); m.position.set(x + (b[0] + b[1]) / 2, (b[2] + b[3]) / 2, z + (b[4] + b[5]) / 2); m.renderOrder = 9; g.add(m); }
        scene.add(g);
      }, [x, z, o.cols]);
      await shot(tag + '-cols.png', [x + s * 1.1, s * 0.25, z], [x, s * 0.12, z], 50);
      await page.evaluate(() => { const g = scene.getObjectByName('showcaseCols'); if (g) scene.remove(g); });
    }
  }
  if (logs.length) console.log(logs.slice(0, 20).join('\n'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(2); });
