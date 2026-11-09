/* Compares the collisions of the play area between two built versions of the game (by default: the version of a
   git commit and the current dist/). Any box difference changes gameplay (movement, shooting, bot navigation).
   node colcmp.js [commit=HEAD] [page2=dist/index.html] */
const fs = require('fs'), path = require('path'), os = require('os'), { execSync } = require('child_process');
const { openGame, REPO } = require('./common');
async function dump(page) {
  const { browser, page: pg } = await openGame({ page, w: 480, h: 270, settings: { quality: 'low' }, noHdri: true });
  const r = await pg.evaluate(() => ({
    col: COL.filter((c) => c.x1 > MAP.x0 - 0.5 && c.x0 < MAP.x1 + 0.5 && c.z1 > MAP.z0 - 0.5 && c.z0 < MAP.z1 + 0.5).map((c) => [c.x0, c.x1, c.y0, c.y1, c.z0, c.z1].map((v) => Math.round(v * 1000) / 1000).concat([c.m, c.ray ? 1 : 0]).join('|')),
    ramps: JSON.stringify(RAMPS), nav: NAV.count,
  }));
  await browser.close();
  return r;
}
(async () => {
  const ref = process.argv[2] || 'HEAD', tmp = path.join(os.tmpdir(), 'cod-ref.html');
  fs.writeFileSync(tmp, execSync(`git show ${ref}:dist/index.html`, { cwd: REPO, maxBuffer: 64 << 20 }));
  const A = await dump(tmp), B = await dump(process.argv[3] || path.join(REPO, 'dist/index.html'));
  const count = (l) => l.reduce((m, k) => m.set(k, (m.get(k) || 0) + 1), new Map());
  const ca = count(A.col), cb = count(B.col);
  const onlyA = [...ca.keys()].filter((k) => !cb.has(k)), onlyB = [...cb.keys()].filter((k) => !ca.has(k));
  console.log(`boxes: ${A.col.length} (${ref}) / ${B.col.length} (current); navigation nodes: ${A.nav} / ${B.nav}; identical ramps: ${A.ramps === B.ramps}`);
  console.log(`only in ${ref} :`, onlyA.length); for (const k of onlyA) console.log('  -', k);
  console.log('only in the current one:', onlyB.length); for (const k of onlyB) console.log('  +', k);
})();
