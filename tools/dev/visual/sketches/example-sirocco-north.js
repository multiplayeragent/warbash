/* Example sketch: the north half of Sirocco (camp A, Alpha base, scrapyard, lookout post, Bedouin camp) as it has been built
   since 4.6.x. It serves as the model of the format; a new map starts with a file like this one, before any asset.
     node tools/dev/visual/plan.js sketches/example-sirocco-north.js [x0 x1 z0 z1]
   Format (CommonJS module; everything is in meters, x toward the east, z toward the north, rot in radians as in DECOR.place):
     naming, heading     name of the produced file (plans/<naming>.png) and title of the drawing
     extent              [x0, x1, z0, z1] of the drawing
     mirrorAxis: 'z'     optional: each object is copied in mirror (z -> -z, rot -> PI - rot, like rot() of mirrored plans), except
                         those marked onAxis: true; the Bravo spawns too, if they are not given
     circle              { r, hard }: round zone (the play area of an arena)
     zones               [[name, x0, x1, z0, z1], ...]: the minimap zones
     things              an object is one of:
       { pf: ['car'], x, z, rot }                     game prefab (PF.car(), PF.smBedouin(7.5, 4.6, 1)...): its footprint (all its vertices:
                                                       guy lines, roof) and its collisions (the prefab's, or SM_COLS) are read from the model
       { n, x, z, rot, w, d, h, overhang }            hand-built construction: solid rectangle w x d, h tall; overhang (m, or [mx, mz]):
                                                       roof or guy lines that overhang, dashed
       { n, x, z, rot, w, d, isEmpty: true, cornerPoles: true }  tarp: nothing solid under the canvas, a pole at each corner
       { n, x, z, r, h }                              solid circle (drum, trunk, antenna base)
       { rampSlope: [x0, x1, z0, z1] }                staircase or ramp (against its landing by default)
       { lineRope: [[xa, za], [xb, zb]] }             clothesline between two poles (the laundry hangs down to 0.5 m from the ground)
       { n, poly: [[x, z], ...] | ellipse: [cx, cz, rx, rz], type }  convex polygon: 'solid' (default), 'zone' (overhang only),
                                                       'water' or 'terrain' (drawn, unchecked: a dune, a sebkha)
       flags: underCover: true (placed on purpose under a tarp, a roof or in guy lines), against: true (placed on purpose against another
       object: no passage to keep), onAxis: true (on the axis, not copied in mirror)
     spawnPoints         { alpha: [[x, z], ...], bravo: [...] }
     domination          [[x, z, 'A'], ...]
     routes              [{ n: 'L' | 'M' | 'E', pts: [[x, z], ...] }, ...]: the corridors, as colored dashes
   Colors of the solids: yellow, low cover (up to 1.3 m: you shoot over it); orange, high cover (up to 2.4 m); brown, taller. */
const PI = Math.PI;
const sandbagRow = (x, z, axis, long, rows_count = 3) => ({ n: 'sandbag row', x, z, w: axis === 'x' ? long : 0.5, d: axis === 'x' ? 0.5 : long, h: rows_count * 0.22 + 0.2 });
const drum = (x, z, o = {}) => ({ n: 'drum', x, z, r: 0.3, h: 0.9, ...o });
const woodCrate = (x, z, s = 0.9, o = {}) => ({ n: 'crate', x, z, w: s, d: s, h: s, ...o });
const smallItem = (n, r, h) => (x, z, o = {}) => ({ n, x, z, r, h, ...o });
const canister = smallItem('canister', 0.2, 0.45), oldTire = smallItem('tire', 0.4, 0.2), amphora = smallItem('amphora', 0.25, 0.6), bag = smallItem('bag', 0.35, 0.5), treeTrunk = smallItem('tree', 0.2, 4);
// sheet-metal shack (smShack): the roof overhangs by 25 cm on the sides and 30 cm at the front and back
const hut = (x, z, rot, w, d, h) => ({ n: 'hut', x, z, rot, w, d, h, overhang: [0.25, 0.3] });
// watchtower (smWatchtower): 3.2 m platform at 3 m, overhanging roof; its staircase starts from the dir side, on the half x > x0
const watchtower = (x, z, dir) => [{ n: 'watchtower', x, z, w: 3.4, d: 3.4, h: 5.3, overhang: 0.3, against: true }, { rampSlope: [x, x + 1.6, Math.min(z + dir * 1.6, z + dir * 7.8), Math.max(z + dir * 1.6, z + dir * 7.8)] }];
module.exports = {
  naming: 'example-sirocco-north',
  heading: 'Sirocco, north half (example)',
  extent: [-40, 50, 16, 72],
  circle: { r: 70, hard: 80 },
  zones: [['Alpha Base', -70, 70, 48, 82], ['North camp', -20, 20, 19, 46], ['Encampment', 26, 50, 34, 52]],
  things: [
    // the terrain in broad strokes
    { n: 'dune (2.6 m): the base does not see A', ellipse: [0, 44.5, 16, 5.5], type: 'terrain' },
    // camp A: through-shacks, open container, tent, watchtower, pickup, tarp
    hut(-7.5, 34.5, PI / 2, 4.0, 3.4, 2.6), hut(8.5, 35.5, -PI / 2, 4.4, 3.4, 2.7), hut(-10.5, 25.5, 0, 3.6, 3.2, 2.5),
    { n: 'container', pf: ['container', true], x: -4.5, z: 24.5, rot: PI / 2 },
    { n: 'tent', pf: ['tent'], x: 7.5, z: 24.5 }, ...watchtower(12.5, 30.5, -1),
    { n: 'cistern', pf: ['waterTank'], x: -12.5, z: 31.5 }, { n: 'genset', pf: ['generator'], x: -2.5, z: 38.5 },
    { n: 'tarp', x: 0.5, z: 35.2, w: 5.4, d: 3.2, isEmpty: true, cornerPoles: true },
    { n: 'pick-up', pf: ['car'], x: 7.5, z: 30.2, rot: 1.4 },
    { ...sandbagRow(-0.5, 23.0, 'x', 3.6), against: true }, sandbagRow(3.5, 31.2, 'z', 2.4), sandbagRow(-16.0, 29.5, 'z', 3.0), sandbagRow(-4.0, 30.5, 'z', 2.4), sandbagRow(1.5, 27.0, 'x', 2.4, 2),
    drum(-9.6, 30.2), drum(-9.0, 29.4), drum(3.3, 28.4), drum(-3.6, 33.6),
    woodCrate(3.2, 26.4), woodCrate(-5.2, 37.2, 0.9, { against: true }), woodCrate(15.6, 33.8),
    canister(-0.9, 38.9), canister(6.4, 38.6), canister(-8.4, 28.2), oldTire(15.8, 25.4), oldTire(-14.2, 34.6),
    { lineRope: [[4.6, 33.9], [5.8, 37.6]] },
    // west lookout post
    ...watchtower(-27.5, 29.5, -1), hut(-32.5, 28.5, -PI / 2, 3.4, 3.0, 2.5),
    sandbagRow(-22.5, 25.5, 'z', 3.0), sandbagRow(-23.0, 30.0, 'z', 2.4), sandbagRow(-30.0, 32.6, 'x', 3.0, 2),
    { n: 'tarp', x: -31.0, z: 23.5, rot: 0.2, w: 3.6, d: 2.6, isEmpty: true, cornerPoles: true }, woodCrate(-30.4, 23.6, 0.9, { underCover: true }),
    drum(-34.8, 24.2), drum(-35.3, 24.9), drum(-24.5, 22.5), treeTrunk(-20, 22), { pf: ['smRock', 1.5, 5], x: -33.5, z: 35.5 },
    // the scrapyard in the east
    { n: 'lorry', pf: ['truck'], x: 28.0, z: 27.0, rot: 0.35 }, { n: 'wreck', pf: ['car'], x: 21.5, z: 23.3, rot: -1.1 }, { n: 'wreck', pf: ['car'], x: 30.5, z: 20.8, rot: 2.6 },
    oldTire(24.6, 26.8), oldTire(25.4, 28.2), oldTire(31.2, 24.0), oldTire(21.6, 26.4), woodCrate(22.6, 20.0), woodCrate(31.2, 27.4), drum(26.2, 20.4), treeTrunk(24, 21),
    // the Bedouin camp, two tents open onto the hearth, a dry-stone pen
    { n: 'Bedouin tent', pf: ['smBedouin', 7.5, 4.6, 1], x: 32.0, z: 47.1, rot: 2.5 }, { n: 'Bedouin tent', pf: ['smBedouin', 6, 4.2, 2], x: 40.5, z: 38.5, rot: -0.79 },
    { n: 'firepit', x: 36.5, z: 43.5, r: 0.7, h: 0.3 },
    { n: 'low wall', x: 41.0, z: 49.5, w: 6, d: 0.5, h: 0.9, against: true }, { n: 'low wall', x: 44.0, z: 47.625, w: 0.5, d: 3.25, h: 0.9, against: true },
    { n: 'cart', pf: ['smCart'], x: 29.6, z: 40.4, rot: -2.36 }, treeTrunk(42.6, 46.6),
    amphora(34.8, 40.2), amphora(35.4, 39.6), amphora(38.8, 46.2), bag(33.6, 41.0), bag(39.5, 45.0),
    { n: 'tarp', x: 33.0, z: 38.0, rot: 0.25, w: 4.0, d: 2.6, isEmpty: true, cornerPoles: true },
    { lineRope: [[38.4, 48.6], [41.6, 48.6]] },
    { n: 'rock', poly: [[41.5, 24.5], [46.5, 24.5], [46.5, 29.5], [41.5, 29.5]], h: 6.5 }, { pf: ['smRock', 1.6, 1], x: 38.5, z: 21.5 }, { pf: ['smRock', 1.7, 7], x: 22.5, z: 60.5 },
    // Alpha base: a stopped convoy
    { n: 'lorry', pf: ['truck'], x: -9.5, z: 64.0, rot: 0.25 }, { n: 'lorry', pf: ['truck'], x: 11.0, z: 63.5, rot: -0.25 }, { n: 'car', pf: ['car'], x: 16.5, z: 53.5, rot: -0.9 },
    { n: 'tent', pf: ['tent'], x: -16.5, z: 57.5, rot: PI / 2 }, { n: 'tent', pf: ['tent'], x: 0.5, z: 65.5 }, { n: 'antenna', pf: ['antenna'], x: -4.5, z: 64.5 },
    { n: 'genset', pf: ['generator'], x: 5.5, z: 65.5, rot: 0.2, against: true }, // placed against the tent
    { ...sandbagRow(-6.5, 51.0, 'x', 3.6) }, sandbagRow(7.0, 50.5, 'x', 3.6), { ...sandbagRow(-15.5, 52.0, 'z', 3.0), against: true }, sandbagRow(17.5, 59.5, 'z', 3.0),
    drum(-13.4, 61.7), drum(-12.8, 62.4), drum(-13.7, 62.6), drum(15.8, 61.0), drum(16.4, 60.3),
    woodCrate(-4.6, 60.4, 1.0, { underCover: true }), woodCrate(7.0, 61.8, 1.0), woodCrate(-18.6, 53.0, 1.0),
    { n: 'tarp', x: -6.0, z: 61.0, rot: 0.25, w: 4.4, d: 3.2, isEmpty: true, cornerPoles: true, against: true }, // along the truck
    { n: 'flag', x: -1.5, z: 51.5, r: 0.05, h: 5.2 },
  ],
  spawnPoints: { alpha: [[-12.5, 53.5], [-8.5, 54.5], [-4.5, 53.5], [-0.5, 54.5], [3.5, 53.5], [7.5, 54.5], [11.5, 53.5], [-11.5, 57.5], [-6.5, 57.5], [-2.5, 58.5], [1.5, 57.5], [5.5, 58.5], [9.5, 57.5], [13.5, 56.5], [-1.5, 61.5]] },
  domination: [[0.5, 31.5, 'A']],
  routes: [
    { n: 'L', pts: [[-12, 56], [-20, 44], [-27, 33], [-30, 18]] },
    { n: 'M', pts: [[0, 56], [0, 46], [0.5, 31.5], [0, 18]] },
    { n: 'E', pts: [[12, 56], [24, 46], [37, 41], [40, 30], [38, 18]] },
  ],
};
