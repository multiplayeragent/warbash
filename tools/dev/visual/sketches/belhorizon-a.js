/* Sketch of Bel-Horizon (new map, October 2026): a provincial suburban housing estate, all the houses alike, the car
   parked in front, the roller shutters down. Small close-quarters combat map, in the spirit of Nuketown.
     node tools/dev/visual/plan.js sketches/belhorizon-a.js
   The plan: a straight street running west to east (rue des Hirondelles), ending in the east in a turnaround. On either side, a row
   of identical lots: front garden, house with its attached garage, back garden closed off by arborvitae hedges. Behind each row, the green
   belt (path, dry retention basin, street lamps) where you spawn. The two camps face each other across the street: the north half
   (Alpha) is copied in mirror to the south (Bravo).
   Three routes:
   - L, the Building Site: lot 12, a house under construction (slab, cinder-block walls at half height, upper floor poured over the rear
     half, rough staircase), open to the winds; it is the high post of the west half.
   - M, the Show Home: the only open house in each row (furnished, "for sale" flags). You enter through the open garage, the front
     door or the garden's glazed bay; upstairs, the bedroom looks onto the street. In the middle of the street, the moving truck
     (Nuketown's bus) blocks the view from one show home to the other.
   - E, the Turning Circle: the turnaround, its planted island and its maple, the sorting containers, the transformer; you come down to it from the
     green belt by the pedestrian footpath.
   Between the lots, the side alleys (3 m and more) and the gaps in the hedges make the links. Closed houses: a solid block, roof
   overhanging by 40 cm. Walls of the show home and of the building site as lines (25 cm), doors of 1.2 m at least. */
const PI = Math.PI;
// straight wall from (x0, z0) to (x1, z1), 25 cm thick (aligned on x or on z)
const wallSeg = (x0, z0, x1, z1, h, o = {}) => ({ n: o.n || 'wall', x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: Math.abs(x1 - x0) || 0.25, d: Math.abs(z1 - z0) || 0.25, h, against: true, ...o });
// arborvitae hedge (2 m, opaque) and low hedge (0.9 m), from (x0, z0) to (x1, z1)
const arborvitae = (x0, z0, x1, z1, o = {}) => ({ n: 'arborvitae', x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: Math.abs(x1 - x0) || 0.8, d: Math.abs(z1 - z0) || 0.8, h: 2.0, ...o });
const lowHedge = (x0, z0, x1, z1, o = {}) => ({ n: 'low hedge', x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: Math.abs(x1 - x0) || 0.6, d: Math.abs(z1 - z0) || 0.6, h: 0.9, ...o });
const smallItem = (n, r, h) => (x, z, o = {}) => ({ n, x, z, r, h, ...o });
const mailbox = smallItem('mailbox', 0.2, 1.2), trashCan = smallItem('trash can', 0.35, 1.1), streetLamp = smallItem('street lamp', 0.12, 4.5), shrub = smallItem('young tree', 0.15, 3);
// closed house: body of 8.5 m by 8 (two levels, gable roof overhanging by 40 cm), attached garage of 3.2 m by 6 on side gx
// (+1 to the east, -1 to the west), all placed with its facade on the street (z0); roller shutters down
const detachedHouse = (n, x0, z0, gx) => {
  const gxa = gx > 0 ? x0 + 8.5 : x0 - 3.2;
  return [
    { n, x: x0 + 4.25, z: z0 + 4, w: 8.5, d: 8, h: 7.6, overhang: 0.4 },
    { n: 'garage', x: gxa + 1.6, z: z0 + 3, w: 3.2, d: 6, h: 3.4, against: true, underCover: true },
  ];
};
module.exports = {
  naming: 'belhorizon-a',
  heading: 'Bel-Horizon, Bel-Horizon housing estate (north half copied to the south)',
  extent: [-37, 37, -42, 42],
  mirrorAxis: 'z',
  zones: [
    ['Green Belt (Alpha)', -36, 36, 28, 41], ['Green Belt (Bravo)', -36, 36, -41, -28],
    ['Building Site', -36, -21, 4.5, 28], ['Building Site', -36, -21, -28, -4.5],
    ['Show Home', -3.6, 8.3, 9.8, 18.2], ['Show Home', -3.6, 8.3, -18.2, -9.8],
    ['Rue des Hirondelles', -36, 14, -4.5, 4.5], ['Turning Circle', 14, 36, -13, 13],
  ],
  things: [
    // ---- the street and the turnaround, on the axis ----
    { n: 'rue des Hirondelles (6 m roadway, 1.5 m sidewalks)', poly: [[-36, -3], [15.5, -3], [15.5, 3], [-36, 3]], type: 'terrain', onAxis: true },
    { n: 'turning circle', ellipse: [24, 0, 9.5, 9.5], type: 'terrain', onAxis: true },
    { n: 'planted island and its maple', x: 24, z: 0, r: 3, h: 0.3, onAxis: true },
    // the moving truck in the middle of the street, tailgate open toward the east, boxes on the ramp
    { n: 'moving truck', x: 2, z: 0, w: 7.2, d: 2.5, h: 3.4, onAxis: true }, { rampSlope: [5.6, 7.8, -0.9, 0.9], n: 'tailgate', onAxis: true },
    // two cars parked along the sidewalk, one on each side, staggered (not copied in mirror)
    { n: 'car', pf: ['car', 'hatch'], x: -15.5, z: 2.0, rot: PI / 2, onAxis: true }, { n: 'car', pf: ['car', 'sedan'], x: 13, z: -2.0, rot: -PI / 2, onAxis: true },
    { n: 'speed bump', x: -24, z: 0, w: 1.2, d: 6, h: 0.1, onAxis: true },
    streetLamp(-24, 3.9), streetLamp(-6, 3.9), streetLamp(12, 3.9),

    // ---- lot 12, the Building Site (x -34 to -21) ----
    { n: 'slab (20 cm)', poly: [[-32, 10], [-23, 10], [-23, 18], [-32, 18]], type: 'terrain' },
    wallSeg(-32, 10, -29.2, 10, 2.4, { underCover: true }), wallSeg(-26.4, 10, -23, 10, 1.2, { underCover: true }), // facade: the living-room bay (2.8 m) not yet fitted, the low sill wall in the east
    wallSeg(-32, 10.1, -32, 17.9, 2.4, { underCover: true }), // west gable, built up to the floor
    wallSeg(-23, 10.1, -23, 13.2, 2.4, { underCover: true }), wallSeg(-23, 14.6, -23, 17.9, 1.0, { underCover: true }), // east gable: the future garage door (1.4 m), then a sill wall
    wallSeg(-32, 18, -28.4, 18, 1.2, { underCover: true }), wallSeg(-26.8, 18, -23, 18, 2.4, { underCover: true }), // rear: the French door (1.6 m)
    wallSeg(-32, 14, -29.6, 14, 2.4, { underCover: true }), // kitchen partition wall
    { n: "upper floor (2.7 m), 1 m low wall", poly: [[-32, 14], [-23, 14], [-23, 18], [-32, 18]], type: 'zone', against: true },
    { rampSlope: [-29.4, -28.2, 10.4, 13.9], n: 'rough staircase' }, // goes up toward the north, comes out onto the floor
    { n: 'cement mixer', x: -30.5, z: 6.5, r: 0.7, h: 1.4 }, { n: 'pallet of cinder blocks', x: -26.2, z: 6.3, w: 1.2, d: 1.0, h: 1.0 }, { n: 'pallet of cinder blocks', x: -24.6, z: 6.3, w: 1.2, d: 1.0, h: 1.0, against: true },
    { n: 'sand pile', x: -33.6, z: 22.5, r: 1.3, h: 0.8 }, { n: 'construction skip', x: -27.5, z: 23, w: 3.6, d: 1.8, h: 1.4 },
    { n: 'sign "lot 12 available"', x: -21.8, z: 5.2, r: 0.1, h: 2.2 },
    { n: 'construction barrier', x: -33.5, z: 27.5, w: 4, d: 0.15, h: 2 }, { n: 'construction barrier', x: -23.3, z: 27.5, w: 3.8, d: 0.15, h: 2, against: true },

    // ---- no. 10, closed house (x -19 to -7.3) ----
    ...detachedHouse('no. 10', -19, 10, 1),
    { n: 'car', pf: ['car', 'hatch'], x: -8.9, z: 6.6 }, // in front of the garage
    lowHedge(-19, 4.9, -12.6, 4.9), mailbox(-11.8, 4.9), trashCan(-7, 5.0), trashCan(-6.2, 5.0),
    { n: 'above-ground pool', x: -14.2, z: 22.8, r: 2.2, h: 1.25 }, { n: 'garden shed', x: -17.8, z: 25.85, w: 2.2, d: 2.0, h: 2.3, against: true },
    arborvitae(-21, 20, -21, 27, { against: true }), // between the building site and no. 10 (the alley stays open up to z = 20)
    arborvitae(-5.4, 18.6, -5.4, 21.2, { against: true }), arborvitae(-5.4, 22.6, -5.4, 27, { against: true }), // between no. 10 and the show home: the kids' gap (1.4 m)

    // ---- no. 8, the show home (x -3.5 to 8.2): garage open to the west, two-level body ----
    { n: 'show home roof', poly: [[-0.7, 9.6], [8.6, 9.6], [8.6, 18.4], [-0.7, 18.4]], type: 'zone', against: true },
    wallSeg(-3.5, 10, -3.5, 16, 3, { n: 'garage', underCover: true }), wallSeg(-3.4, 16, -2.6, 16, 3, { underCover: true }), wallSeg(-1.4, 16, -0.4, 16, 3, { underCover: true }), // back door (1.2 m)
    wallSeg(-0.3, 10, 2.4, 10, 5.6, { underCover: true }), wallSeg(3.6, 10, 8.2, 10, 5.6, { underCover: true }), // facade: front door (1.2 m)
    wallSeg(-0.3, 10.1, -0.3, 12.6, 5.6, { underCover: true }), wallSeg(-0.3, 13.8, -0.3, 17.9, 5.6, { underCover: true }), // garage-utility room: door (1.2 m)
    wallSeg(8.2, 10.1, 8.2, 17.9, 5.6, { underCover: true }),
    wallSeg(-0.3, 18, 2.0, 18, 5.6, { underCover: true }), wallSeg(4.6, 18, 8.2, 18, 5.6, { underCover: true }), // open glazed bay (2.6 m)
    wallSeg(5.6, 11.6, 5.6, 15.6, 2.6, { n: 'partition', underCover: true }), { rampSlope: [6.1, 8.0, 10.6, 15.0], n: 'stairway', against: true }, // the staircase along the east gable
    { n: 'sofa', x: 2.2, z: 15.2, w: 2.0, d: 0.9, h: 0.85, underCover: true }, { n: 'kitchen island', x: 3.0, z: 12.4, w: 1.6, d: 0.8, h: 0.95, underCover: true },
    { n: "upper floor (2.8 m): two bedrooms, the front one onto the street", poly: [[-0.3, 10], [8.2, 10], [8.2, 18], [-0.3, 18]], type: 'zone', against: true, underCover: true },
    { n: 'car', pf: ['car', 'sedan'], x: -1.9, z: 6.4 }, lowHedge(4, 4.9, 8.2, 4.9), mailbox(3.2, 4.9),
    { n: '"for sale" flag', x: 9.0, z: 5.4, r: 0.1, h: 4 },
    { n: 'trampoline (net)', x: 5.2, z: 23.2, r: 1.8, h: 2.6 }, { n: 'patio set', x: 0.6, z: 20.4, r: 0.6, h: 0.75 }, { n: 'barbecue', x: -1.6, z: 19.2, r: 0.35, h: 1 },
    { n: 'umbrella clothes dryer', x: -1.5, z: 24.6, r: 0.1, h: 1.8 },
    arborvitae(9.35, 18.6, 9.35, 27, { against: true }), // between the show home and no. 6

    // ---- no. 6, closed house against the turnaround (x 10.5 to 22.2) ----
    ...detachedHouse('no. 6', 10.5, 11, 1),
    trashCan(20.2, 9.6), trashCan(21.0, 9.6), mailbox(10.8, 10), { n: 'swing set', x: 15, z: 23.6, w: 3, d: 1.6, h: 2.2 }, { n: 'shed', x: 21.5, z: 25.8, w: 2.2, d: 2.2, h: 2.3, against: true },
    arborvitae(23.0, 11.6, 23.0, 27, { against: true }), // the back of no. 6 onto the footpath

    // ---- the pedestrian footpath and the turnaround (x 23 to 36) ----
    { n: 'transformer', x: 31.6, z: 18.5, w: 2.6, d: 2.0, h: 2.4 },
    { n: 'sorting containers', x: 29.8, z: 11.6, w: 4.8, d: 1.5, h: 1.7 },
    { n: 'slide', x: 28, z: 23.5, w: 1, d: 3.2, h: 2.2 }, { n: 'bench', x: 34, z: 13.5, w: 0.6, d: 1.8, h: 0.8 },
    shrub(26, 16), shrub(34.5, 22), shrub(26.4, 26.5),

    // ---- back of the gardens (arborvitae hedges, garden gates) and green belt ----
    arborvitae(-21, 27.3, -15.4, 27.3), arborvitae(-14, 27.3, 1.0, 27.3), arborvitae(2.4, 27.3, 23.4, 27.3), // garden gates of no. 10 and of the show home (1.4 m)
    { n: 'retention basin (dry, gentle slope)', ellipse: [-24, 35.5, 7, 3], type: 'terrain' },
    streetLamp(-12, 30), streetLamp(6, 30), streetLamp(24, 30), { n: 'bench', x: -2, z: 38.5, w: 1.8, d: 0.6, h: 0.8 },
    { n: 'rigid fence (end of the map)', x: 0, z: 41.2, w: 72, d: 0.2, h: 1.8 },
  ],
  spawnPoints: { alpha: [[-16.5, 31.5], [-12.5, 33.5], [-8.5, 31.5], [-4.5, 33.5], [-0.5, 31.5], [3.5, 33.5], [8.5, 31.5], [12.5, 33.5], [16.5, 31.5], [20.5, 33.5], [-14.5, 36.5], [-6.5, 36.5], [1.5, 36.5], [10.5, 36.5], [18.5, 36.5]] },
  domination: [[-12, 22, 'A'], [2, 0, 'B'], [-12, -22, 'C']], // A and C in the garden of no. 10, around the pool (moved closer to the bases at the owner's request)
  routes: [
    { n: 'L', pts: [[-16, 32], [-26, 26], [-27.8, 16], [-27.6, 10], [-28, 4]] },
    { n: 'M', pts: [[1, 31], [1.7, 27.3], [3.3, 18], [3, 10], [3, 4]] },
    { n: 'E', pts: [[18, 32], [27, 26], [28, 15], [24, 9.5]] },
  ],
};
