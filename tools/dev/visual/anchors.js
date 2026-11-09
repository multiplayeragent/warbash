/* Taut lines: checks that each end of the laundry, power wires, garlands and mooring lines is attached to something
   (a wall, a post, a bollard; a mooring line only needs one end on the quay, the other is on the boat: a scenery collision box within 35 cm, at the right height).
   node anchors.js        Chergui;  MAP=saintgivre node anchors.js  or  MAP=portmael node anchors.js
   Exits with an error at the first end attached to nothing. */
const { openGame } = require('./common');
const MAP = process.env.MAP || 'chergui';
(async () => {
  const { browser, page } = await openGame({ settings: { quality: 'low', map: MAP }, page: process.env.PAGE });
  const R = await page.evaluate(() => {
    const m = 0.35, bad = [], per = {};
    const held = (p) => COL.some((c) => !c.prop && p[0] >= c.x0 - m && p[0] <= c.x1 + m && p[2] >= c.z0 - m && p[2] <= c.z1 + m && p[1] >= c.y0 - 0.1 && p[1] <= c.y1 + 0.5);
    for (const l of LINES) {
      per[l.k] = (per[l.k] || 0) + 1;
      // a mooring line is held on one side by a quay bollard, on the other by a boat (which floats and has no collision box)
      const ends = [['a', l.a], ['b', l.b]].filter(([, p]) => !held(p));
      if (l.k === 'mooring' ? ends.length === 2 : ends.length) for (const [name, p] of ends) bad.push(l.k + ' (' + p.map((v) => v.toFixed(1)).join(', ') + ') end ' + name + ' attached to nothing');
    }
    return { per, bad };
  });
  console.log(JSON.stringify(R.per));
  await browser.close();
  if (R.bad.length) { console.error('FAILURE:\n' + R.bad.join('\n')); process.exit(1); }
  console.log('anchors: everything is attached');
})();
