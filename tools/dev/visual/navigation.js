/* Navigation check for a map (bot network): node navigation.js [x0 x1 z0 z1]   (MAP=notos for a map other than Chergui)
   - do the spawns of both sides, the points of interest and the domination points land on a node of the largest network
     (within 0.7 m for a spawn, 1 m for a point of interest, at the right height)? A point that lands in a wall, under a
     boat or on a roof without stairs sends the bots elsewhere, or nowhere;
   - the walkable share of each domination point's disc (at least 70%, see "Game modes and respawn" in the README);
   - the nodes outside the main network, by zone (roofs without access, interiors with doors too narrow, tops of crates);
   - the drawing of the requested zone (by default the south side, z from 0 to 48), one letter per 1 m cell: "." ground, ":" steps,
     "+" roof or walkway (more than 2.4 m above the ground, above the sand on a relief map), "#" very high, "x" only nodes outside the main network, "S" spawn, "P" point
     of interest, "D" domination point.
   The navigation grid (README, "Bot AI") has a node at the center of each 1 m cell and requires 0.42 m of clearance: a door, an
   arch or a parapet gap must be at least 1.2 m wide and centered on a cell center (n + 0.5), otherwise it can be crossed by hand
   but not by the bots; under a hatch, a ramp at least 1.9 m wide; a roof staircase ends on a solid landing, level with the roof.
   Exits with an error if a spawn, a point of interest or a domination point is off the network. */
const { openGame } = require('./common');
const [x0, x1, z0, z1] = process.argv.slice(2).map(Number);
(async () => {
  const { browser, page } = await openGame({ w: 480, h: 270, page: process.env.PAGE, settings: { quality: 'low', difficulty: 1, map: process.env.MAP || 'chergui', mode: 'dom' }, noHdri: true });
  const r = await page.evaluate(([x0, x1, z0, z1]) => {
    LOCK.fallback = true; startMatch({});
    const main = (id) => NAV.comp[id] === NAV.mainComp;
    const near = (x, y, z) => { const id = navNode(x, y, z); return id < 0 ? null : { d: Math.hypot(NAV.nx[id] - x, NAV.nz[id] - z), dy: NAV.ny[id] - y }; };
    const bad = [], marks = new Map();
    const note = (k, x, z) => marks.set(Math.floor(x) + ',' + Math.floor(z), k);
    SPAWNS.forEach((side, t) => side.forEach(([x, z], i) => { const c = near(x, gy0(x, z), z); note('S', x, z); if (!c || c.d > 0.7) bad.push(`spawn ${t === 0 ? 'Alpha' : 'Bravo'} ${i} (${x}, ${z}): ${c ? c.d.toFixed(1) + ' m from the nearest node' : 'no node'}`); }));
    POI.forEach((p, i) => { const c = near(p[0], p[1], p[2]); note('P', p[0], p[2]); if (!c || c.d > 1.0 || Math.abs(c.dy) > 1.0) bad.push(`point of interest ${i} (${p[0]}, ${p[1]}, ${p[2]}): ${c ? c.d.toFixed(1) + ' m, height difference ' + c.dy.toFixed(1) : 'no node'}`); });
    const dom = DOM.pts.map((p) => {
      let n = 0; const R = DOM.rad;
      for (let dz = -Math.ceil(R); dz <= Math.ceil(R); dz++) for (let dx = -Math.ceil(R); dx <= Math.ceil(R); dx++) {
        const x = Math.floor(p.x) + dx + 0.5, z = Math.floor(p.z) + dz + 0.5; if (Math.hypot(x - p.x, z - p.z) > R) continue;
        const cell = NAV.cells[(Math.floor(z) - NAV.z0) * NAV.W + Math.floor(x) - NAV.x0] || []; if (cell.some((id) => main(id) && NAV.ny[id] < 0.5 + (p.y || 0))) n++;
      }
      note('D', p.x, p.z); const frac = n / (Math.PI * R * R); if (frac < 0.7) bad.push(`domination point (${p.x}, ${p.z}): ${(frac * 100).toFixed(0)} % walkable (at least 70 %)`);
      return [p.x, p.z, +(frac * 100).toFixed(0)];
    });
    const zones = new Map(); let other = 0;
    for (let id = 0; id < NAV.count; id++) if (!main(id)) { other++; const z = zoneName(NAV.nx[id], NAV.nz[id]); zones.set(z, (zones.get(z) || 0) + 1); }
    const X0 = Number.isFinite(x0) ? x0 : MAP.x0, X1 = Number.isFinite(x1) ? x1 : MAP.x1, Z0 = Number.isFinite(z0) ? z0 : 0, Z1 = Number.isFinite(z1) ? z1 : MAP.z1 - 1, rows = [];
    for (let z = Z0; z <= Z1; z++) {
      let s = '';
      for (let x = X0; x < X1; x++) {
        const k = marks.get(x + ',' + z); if (k) { s += k; continue; }
        const cell = NAV.cells[(z - NAV.z0) * NAV.W + (x - NAV.x0)] || []; let c = ' ', top = -9;
        for (const id of cell) { if (main(id)) top = Math.max(top, NAV.ny[id] - gy0(NAV.nx[id], NAV.nz[id])); else if (c === ' ') c = 'x'; } // height above the sand (relief)
        if (top > -9) c = top > 5 ? '#' : top > 2.4 ? '+' : top > 0.3 ? ':' : '.';
        s += c;
      }
      rows.push(String(z).padStart(4) + ' ' + s);
    }
    return { count: NAV.count, mainCount: NAV.count - other, dom, zones: [...zones.entries()].sort((a, b) => b[1] - a[1]), bad, rows, X0, X1 };
  }, [x0, x1, z0, z1]);
  console.log(`${r.count} nodes, ${r.mainCount} in the main network, domination: ${JSON.stringify(r.dom)}`);
  console.log('nodes outside the network by zone:', r.zones.map(([k, v]) => `${k} ${v}`).join(', ') || 'none');
  let hdr = '     '; for (let x = r.X0; x < r.X1; x++) hdr += x % 10 === 0 ? String(Math.abs(x / 10) % 10) : ' ';
  console.log(hdr); console.log(r.rows.join('\n'));
  await browser.close();
  if (r.bad.length) { console.error('FAIL:\n' + r.bad.join('\n')); process.exit(1); }
  console.log("navigation: spawns, points of interest and domination on the network");
})();
