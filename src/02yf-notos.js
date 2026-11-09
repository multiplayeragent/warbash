/* ==========================================================================
   NOTOS: an island in the Cyclades, a whitewashed village by the sea. 72 x 96 m, mirrored north-south (team Alpha in the south,
   +z; Bravo in the north, -z). The sea runs along the whole west side; the summer wind that gives it its name turns the mills.
   The plan is a 2 m grid (NOTOS_ROWS: the south half, the north half is its mirror) that the Cycladic kit
   (02yb to 02ye) turns into houses; what the grid does not say is placed by hand (church, cafe, chapel, staircases).
   WEST "Marine"  : the stone quay, the caiques afloat and those hauled out on their cradles, the tavern with a flat roof
                       (reached from the inside, and from the central block's roof by a bridge over Harbor Street), the kiosk, the
                       tamarisks. Long sight lines at sea level; in the middle, the jetty and the blue chapel at its end, a caique
                       hauled out across its head (point B).
   CENTER "Square" : the Plane Tree square (the Kafeneio, the tree, the tables), the church of Sainte-Marina that closes it off to the east: you can
                       walk around it (ring), and two blocks of houses with arches between the square and the base plazas (points A and C).
   EAST "Chora"    : the upper village, 2 m alleys in a bayonet pattern (never a sight line of more than 30 m), arches, staircases,
                       flat roofs (the Terraces), the Apse alley along the church; at the end, the threshing floor.
   A camp appears in its courtyard (shipyard in the west, well courtyard in the center, threshing floor in the east), sheltered from fire
   from the plazas. Behind each base, a mill on the roof of a house overlooks the perimeter: from almost everywhere you can see the one
   of your camp or the enemy's, and you know which way you are headed. The draws are reproducible (fixed seed): every peer in a lobby builds the same map.
   ========================================================================== */
/* South half: one 2 m row per line (z from 0 to 48), 30 columns (x from -30 to 30). Columns: Marine 0-4 | facade 5-6 | 7-13 | 14-18 | Apse alley | east
   Small buildings (k): only the isolated ones (Marine, end of the Apse alley). Those that were stuck to a house
   (fountains of the Arch and Apse alleys, ovens of the well plaza, sheds of Port Street and of the Apse
   alley) bit into the street, got in the way and let you see through the neighboring wall (a house does not draw its wall
   behind a small building): removed, owner feedback. */
const NOTOS_ROWS = [
  '.....|..|XX....X|XXXXX|..|.......22',
  '.....|..|XX....X|XXXXX|..|222.22.22',
  '..k..|..|.......|.....|..|222.22.22',
  '.....|..|.......|.....|..|222.22.22',
  '.....|..|.......|.2222|..|222.22.22',
  '.....|..|.......|.2222|..|222.22.22',
  'k....|..|..2222.|.2222|..|........2',
  '....X|XX|..2222.|.2222|..|2222.22.2',
  '....X|XX|..2222.|.2222|..|2222.22.2',
  '....X|XX|..2222.|.2222|..|2222.22.2',
  '....X|XX|...aa..|.2222|..|........2',
  '....X|XX|..tttt.|..aa.|..|2222.22.2',
  '.k...|22|..tttt.|.2222|..|2222.22.2',
  '.....|22|..tttt.|.2222|..|2222.22.2',
  '....k|..|.......|22222|..|........2',
  '.....|..|.......|22222|..|tttttt..2',
  '.....|22|.......|22222|..|tttttt..2',
  '.....|22|.......|22222|..|tttttt..2',
  '.....|22|.......|22222|..|tttttt..2',
  '.....|..|.......|.....|.k|.........',
  '.....|..|.......|.....|..|.........',
  '.....|..|..11111|.....|..|.........',
  '.....|..|..11111|.....|..|.........',
  '.....|..|.......|.....|..|.........',
].map((r) => r.replace(/\|/g, ''));

const ATMO_NOTOS = Object.assign({}, ATMO_DEFAULT, {
  // golden hour over the Aegean (ambience workshop, November 2026; a late-summer morning until then): the sun is low over the open sea
  // to the west (12°), square to the map's north-south axis, so neither team looks into it down its lanes and both catch it on the quay.
  // Orange-gold light rakes the walls that face the sea, the alleys lie in long blue shadows (sky light, hemi and aoFloor, kept high
  // enough to read a soldier there); computed sky, pink and orange around the sun, deep blue overhead and to the east; a warm haze over
  // the water (fogSun) that leaves a soldier at 40 m clear (under 2 % of fog). The street lamps and wall lamps are on, dimmer than at night
  // (lamps), and a quarter of the windows glow (glassLit, Cycladic kit)
  sun: [-0.977, 0.21, 0], sunColor: 0xff8c44, sunI: 2.4, vmSun: 0xff8c44,
  fog: [0.5, 0.4, 0.38], fogD: 0.0024, fogSun: 0.6, fogH: [26, 0],
  hemi: [0x6078b8, 0x7a5a48, 0.6], vmHemi: [0x6078b8, 0x7a5a48],
  sky: {
    zen: [0.012, 0.04, 0.18], mid: [0.07, 0.13, 0.34], hor: [0.5, 0.42, 0.5], gnd: [0.2, 0.17, 0.2],
    glow: [2.0, 0.75, 0.25], halo: [1.1, 0.5, 0.18], disk: [14, 7, 2.5], cloudLo: [0.26, 0.22, 0.34], cloudHi: [1.7, 0.8, 0.38], cloud: [0.52, 0.86, 0.75],
    ridge: [0, 0, 0], ridgeSnow: [1, 1, 1], ridgeRock: [0.5, 0.5, 0.5],
  },
  envGround: 0x4a3a38, hdri: null, lit: true, lamps: 0.65,
  bounce: [1.15, 0.72, 0.42], dust: [0.78, 0.7, 0.6], motes: [1.4, 0.95, 0.6],
  grade: { lo: [0.86, 0.95, 1.14], hi: [1.14, 0.98, 0.82], exp: 0.95, sat: 1.05, con: 1.08 }, rays: [1.0, 0.6, 0.32],
  impact: [0.7, 0.62, 0.55], wind: [420, 0.09],
  bloom: [0.3, 0.55, 1.5], aoFloor: 0.45, raysThr: 2.0, raysCap: 4, satExp: 0.88,
  volOpen: true,
});
/* Ground: packed earth of the courtyards, schist slabs of the alleys, pebbles of the quay, whitewash of the borders and the forecourt */
const GROUND_NOTOS = { base: 'sand', l1: 'slabs', l2: 'cobble', l3: 'limewash', pom: [0, 0, 0.04, 0], dirt: [0.74, 0.7, 0.62], mul: 0, env: 0.4 };
const MEL = {
  wl: -0.9, coast: -30,
  millX: -10, // each base's mill, on its house behind the perimeter
  lowWalls: [[11.5, 17.0, 41.0, 41.4], [25.5, 29.6, 40.0, 40.4], [14.0, 14.4, 43.6, 47.8]], // dry-stone low walls of the threshing floor (south half; mirrored in the north)
  // roof bridge over Harbor Street, from the tavern's roof to the central block's (south half; mirrored in the north): x0, x1, z0, z1.
  // 2.4 m: between its parapets, the two rows of navigation cells (z 22.5 and 23.5, 0.42 m radius) pass; at 2 m none did, and the
  // tavern's south parapet leaves only the first row at its end, the central block's north parapet only the second at the other
  bridge: [-16, -12, 21.8, 24.2],
  // the two halves can be told apart (you know which side you are on): blue joinery in the south (Alpha), green, red and ocher in the north (Bravo),
  // white sails on the south mill, red canvas on the north one; the center (church, Kafeneio) keeps its blue
  paint: [
    [[0.07, 0.3, 0.62], [0.07, 0.3, 0.62], [0.07, 0.3, 0.62], [0.07, 0.3, 0.62], [0.07, 0.3, 0.62], [0.05, 0.2, 0.45], [0.05, 0.2, 0.45], [0.05, 0.2, 0.45], [0.1, 0.55, 0.6], [0.1, 0.55, 0.6]],
    [[0.16, 0.42, 0.34], [0.16, 0.42, 0.34], [0.16, 0.42, 0.34], [0.16, 0.42, 0.34], [0.62, 0.17, 0.12], [0.62, 0.17, 0.12], [0.62, 0.17, 0.12], [0.85, 0.62, 0.2], [0.85, 0.62, 0.2], [0.1, 0.55, 0.6]],
  ],
  sail: [[0.97, 0.96, 0.92], [0.7, 0.22, 0.14]],
};

/* ---------- Plan ---------- */
function notosLevel() {
  SR.rng = rngOf(2607); // props shared with Chergui (crates, barrels): same draws for everyone
  CYC.mill = null; CYC.doors = []; CYC.holes = []; CYC.paintAt = (z) => MEL.paint[z > 0 ? 0 : 1];
  const P = cyPlan(NOTOS_ROWS); CYC.P = P;
  P.xh = {};
  for (let k = 0; k < P.H; k++) for (let i = 0; i < P.W; i++) if (P.G[k][i] === 'X') P.xh[`${i},${k}`] = i >= 13 ? 6.2 : i >= 7 ? 3.6 : 3.5;
  notosWater();
  notosPier();
  notosTown(P);
  cyChurch();
  cyKafeneio(-16, -12, -4, 4);
  for (const s of [1, -1]) { notosTaverna(s); notosMarine(s); notosPlace(s); notosChora(s); notosBase(s); }
  // corner between the Terraces' big roof and the northwest house: the two boxes left a 5 cm diagonal gap that bullets
  // went through under a full render (tools/dev/visual/slits.js)
  for (const s of [1, -1]) DECOR.col(11.95, 12.0, 0, 2.9, Math.min(s * 37.95, s * 38.05), Math.max(s * 37.95, s * 38.05), 'concrete');
  notosCenter();
  notosBackdrop();
  notosGround(P);
}

/* ---------- Water: the quay, the jetty ---------- */
function notosWater() {
  const c = MEL.coast, H = -MEL.wl;
  waterSetup({ y: MEL.wl, box: [-2000, -15, -2000, 2000], open: [-150, -112], east: -16 });
  waterLand(c, 1e4, -1e4, 1e4);
  waterObstacle([c, -10, -140, 140], H, [0.6, 0.58, 0.52], 0.45);
  waterObstacle([-37.4, c, -1.5, 1.5], 1.0, [0.45, 0.38, 0.3], 0.3);
  waterObstacle([-42, -37.4, -2.4, 2.4], 1.0, [0.82, 0.8, 0.76], 0.4);
  edgeRun('z', c - 0.4, c, -48, 48, [[-1.5, 1.5]]);
  waterEdge(-37.4, c - 0.4, 1.5, 1.9); waterEdge(-37.4, c - 0.4, -1.9, -1.5);
  // quay: limestone wall below ground level, whitewashed border
  const M = DECOR;
  box('ashlar', c, c + 1.2, MEL.wl - 2.5, 0, -140, 140, { tint: [0.74, 0.72, 0.66], skip: 'yY', ao: false, m: 'concrete' });
  M.save().color([0.18, 0.22, 0.14]).world(1); M.boxB('wetstone', c - 0.012, c, MEL.wl - 0.7, MEL.wl + 0.5, -140, 140, { skip: 'yY' }); M.restore();
  M.save().color([0.9, 0.89, 0.85]).world(1); M.boxB('limewash', c - 0.06, c + 0.3, -0.12, 0.09, -140, 140, { bevel: 0.03 }); M.restore();
}
/* Plank jetty on piles, from the quay to the chapel of Saint Nicholas: 3 m wide, white wood railing, bollards and ladder */
function notosPier() {
  const M = DECOR, c = MEL.coast, x0 = -37.4;
  box('boards', x0, c, -0.28, 0, -1.5, 1.5, { tint: [0.62, 0.55, 0.48], m: 'wood' });
  M.save().local(1).color([0.4, 0.33, 0.26]);
  for (let x = x0 + 0.3; x < c; x += 2.2) for (const z of [-1.3, 1.3]) { M.save().move(x, MEL.wl - 2.5, z); M.cyl('wood', 0.16, 2.3 - MEL.wl + 0.17, 8); M.restore(); } // heads 3 cm below the top of the deck
  M.restore();
  for (const z of [-1.42, 1.42]) { railing(z, z, 0, x0 + 0.2, c - 0.4, 'x', undefined, [0.95, 0.95, 0.93]); }
  for (const x of [-34.5, -32.5]) for (const z of [-1.2, 1.2]) M.place(PF.bitt(), x, 0, z, 0, { nocol: true });
  M.place(PF.lifeRingStand(), -33.4, 0, -1.2, Math.PI);
  cyChapel(-39.6, 0);
  // the flag flies on the chapel roof, at the northeast corner near the bell gable, unfurled over the water (planted on the jetty, it touched
  // its railing): from the jetty and the village, you see it next to the dome
  cyFlag(-37.75, 3.25, -1.85, Math.PI / 2, 2.4);
}

/* ---------- The town ---------- */
function notosTown(P) {
  const R = rngOf(2607), stairs = notosStairs();
  // parapet opening of the central block's flat roof (z 22 to 28) where the roof bridge from the tavern lands (notosRoofBridge)
  const bridges = [1, -1].map((s) => { const [a0, a1] = [Math.max(22, MEL.bridge[2]) * s, MEL.bridge[3] * s].sort((p, q) => p - q); return { side: 'w', at: MEL.bridge[1], a0, a1 }; });
  // no door within 1.7 m of a staircase or its landing (the 1.5 m corridor in front of a door stays clear): the staircase runs along
  // the wall without hiding an entrance; nor in the corner of the quay (mooring bollards), nor behind a low wall of the threshing floor
  const corner = [[-30, -26, 46, 48.5], [-30, -26, -48.5, -46]].concat(MEL.lowWalls.flatMap(([x0, x1, z0, z1]) => [[x0 - 1.6, x1 + 1.6, z0 - 1.6, z1 + 1.6], [x0 - 1.6, x1 + 1.6, -z1 - 1.6, -z0 + 1.6]]));
  // no ground-floor window behind a staircase or its landing: the shutters would open into the steps
  // (S.nz: original x footprint of a flight since shortened: the same doors and windows, hence the same scenery draws)
  CYC.noWin = stairs.flatMap((S) => [[(S.nz ? S.nz[0] : S.x0) - 0.7, (S.nz ? S.nz[1] : S.x1) + 0.7, S.z0 - 0.7, S.z1 + 0.7]].concat(S.land ? [[S.land.x0 - 0.7, S.land.x1 + 0.7, S.land.z0 - 0.7, S.land.z1 + 0.7]] : []));
  CYC.noDoor = corner.concat(stairs.flatMap((S) => [[(S.nz ? S.nz[0] : S.x0) - 1.7, (S.nz ? S.nz[1] : S.x1) + 1.7, S.z0 - 1.7, S.z1 + 1.7]].concat(S.land ? [[S.land.x0 - 1.7, S.land.x1 + 1.7, S.land.z0 - 1.7, S.land.z1 + 1.7]] : [])));
  // outside staircases and their parapet openings
  for (const S of stairs) {
    let { z0, z1 } = S;
    // level landing at the top of a straight flight (z axis): you step out sideways onto the roof without a ledge. Without it, the parapet opening
    // fell on the top of the flight, 52 cm below the roof: you had to jump, and the bots stayed down below
    if (S.landing) {
      const up = S.h1 > S.h0, hi = Math.max(S.h0, S.h1), [pa, pb] = up ? [z1 - S.landing, z1] : [z0, z0 + S.landing];
      if (up) z1 = pa; else z0 = pb;
      box('limewash', S.x0, S.x1, 0, hi, pa, pb, { tint: CY_WHITE, bevel: 0.03 });
      const zc = up ? pb : pa; railing(zc, zc, hi, S.x0, S.x1, 'x', undefined, CY_BLUE); // head
      for (const sd of S.sides) { const xs = sd ? S.x1 : S.x0; railing(xs, xs, hi, pa, pb, 'z', undefined, CY_BLUE); } // open side
    }
    cyStair(S.x0, S.x1, z0, z1, S.axis, S.h0, S.h1, { sides: S.sides });
    // railing across the head of the straight flights: no more steps into the void, you climb onto the roof through the parapet opening
    if (S.axis === 'z' && !S.land && !S.landing) { const up = S.h1 > S.h0, zc = up ? S.z1 : S.z0; railing(zc, zc, up ? S.h1 : S.h0, S.x0, S.x1, 'x', undefined, CY_BLUE); }
    // solid landing at the top of the flight, level with the roof: you enter it through the parapet opening
    if (S.land) { const L = S.land; box('limewash', L.x0, L.x1, 0, L.h, L.z0, L.z1, { tint: CY_WHITE, bevel: 0.03 }); const zo = S.flip ? L.z0 : L.z1; railing(zo, zo, L.h, L.x0, L.x1, 'x', undefined, CY_BLUE); railing(L.x0, L.x0, L.h, L.z0, L.z1, 'z', undefined, CY_BLUE); }
  }
  cyBuildTown(P, {
    R,
    tint: (h, Rh) => (Math.abs(h.z0) < 15 && h.x0 > -14 && h.x1 < 10 ? Rh.pick(CYP.wash.slice(0, 6)) : Rh.pick(CYP.wash)),
    paintOf: (h, Rh) => Rh.pick(MEL.paint[h.z0 + h.z1 > 0 ? 0 : 1]),
    gaps: (h) => stairs.filter((S) => S.gap && cyGapHits(h, S.gap)).map((S) => S.gap).concat(bridges.filter((g) => cyGapHits(h, g))),
    special: (h, f, F) => {
      // the flat-roof staircase runs along the whole side of the block that faces the plaza (|z| = 28): blind wall, no half-buried window or climbing plant behind the steps
      if (h.walk && Math.abs(f.fixed) === 28 && (f.face === 's' || f.face === 'n')) return { plain: true, climber: false };
      if (F.len < 3.4 || f.ya > 0.05 || h.walk) return null;
      const ax = Math.abs(f.fixed), mx = F.ox + F.len / 2 * Math.cos(F.rot), key = Math.abs(Math.round(h.x0 * 3 + Math.abs(h.z0 + h.z1) * 5));
      // on the square (the block's facades facing the Kafeneio): bakery and grocery
      if ((Math.abs(f.fixed) === 12) && h.x0 >= -12 && h.x1 <= -4) return { sign: { x: F.len / 2, y: 3.0, w: Math.min(F.len - 0.6, 3.2), h: 0.7, i: key % 2 ? CYS.artopoieio : CYS.bakaliko, frame: [0.1, 0.28, 0.55] }, door: Math.floor(Math.max(1, Math.round(F.len / 2.9)) / 2) };
      // on the Marine: the ψαροταβέρνα and the rooms to let
      if (f.face === 'w' && f.fixed === -20) return { sign: { x: F.len / 2, y: 2.75, w: Math.min(F.len - 0.6, 3.0), h: 0.7, i: key % 2 ? CYS.taverne : CYS.domatia, frame: [0.1, 0.28, 0.55] } };
      if (key % 5 === 0 && ax > 12 && F.len >= 4) return { sign: { x: F.len / 2 + 0.3, y: 2.9, w: 1.6, h: 0.45, i: CYS.domatia, frame: [0.1, 0.28, 0.55] } };
      void mx;
      return null;
    },
  });
}
/* Does the parapet opening g fall on a side of house h? */
function cyGapHits(h, g) {
  const at = g.side === 'n' ? h.z0 : g.side === 's' ? h.z1 : g.side === 'w' ? h.x0 : h.x1;
  if (Math.abs(at - g.at) > 0.01) return false;
  return g.side === 'n' || g.side === 's' ? g.a0 >= h.x0 - 0.01 && g.a1 <= h.x1 + 0.01 : g.a0 >= h.z0 - 0.01 && g.a1 <= h.z1 + 0.01;
}
/* Outside staircases (south half, then their mirror in the north): x0..x1 by z0..z1, axis, heights h0 (x0 or z0 side) and h1, sides with railings, roof parapet opening */
function notosStairs() {
  const S = [
    // central block, flat roof: a staircase runs along the south side (the well plaza) and climbs west to a landing level with the roof
    // (slope of 0.58, 2 m landing, 1.6 m parapet opening: the navigation grid, with a 1 m step and 0.42 radius, passes through). The first
    // step is 2 m from the house opposite (x = -2): until October 2026, the flight went as far as x = -3.4 (slope of 0.52) and you turned at
    // 1.4 m from the wall (owner feedback: first steps too close to the wall they face)
    { x0: -9.9, x1: -4.0, nz: [-9.9, -3.4], z0: 28.0, z1: 29.4, axis: 'x', h0: 3.4, h1: 0, sides: [1], gap: { side: 's', at: 28, a0: -11.4, a1: -9.8 }, land: { x0: -11.9, x1: -9.9, z0: 28.0, z1: 29.4, h: 3.4 } },
    // Terraces: two staircases at the two opposite corners of the big east roof
    // (1 m landing at the top, facing the parapet opening: 6.2 m flight, slope of 0.55, under the 0.62 m from one cell to the next of the network)
    { x0: 10.6, x1: 12.0, z0: 30.4, z1: 37.6, axis: 'z', h0: 0, h1: 3.4, sides: [0], landing: 1.0, gap: { side: 'w', at: 12, a0: 36.0, a1: 37.7 } },
    { x0: 24.0, x1: 25.4, z0: 30.4, z1: 37.6, axis: 'z', h0: 3.4, h1: 0, sides: [1], landing: 1.0, gap: { side: 'e', at: 24, a0: 30.2, a1: 31.8 } },
  ];
  const out = [];
  for (const s of S) {
    out.push(s);
    const m = { ...s, flip: true, land: s.land && { ...s.land, z0: -s.land.z1, z1: -s.land.z0 }, z0: -s.z1, z1: -s.z0, h0: s.axis === 'z' ? s.h1 : s.h0, h1: s.axis === 'z' ? s.h0 : s.h1, sides: s.axis === 'x' ? s.sides.map((q) => 1 - q) : s.sides };
    if (s.gap) m.gap = s.gap.side === 'n' || s.gap.side === 's' ? { side: s.gap.side === 's' ? 'n' : 's', at: -s.gap.at, a0: s.gap.a0, a1: s.gap.a1 } : { side: s.gap.side, at: s.gap.at, a0: -s.gap.a1, a1: -s.gap.a0 };
    out.push(m);
  }
  return out;
}

/* ---------- The harbor tavern (Ψαροταβέρνα): through-building, with the flat-roof staircase inside ---------- */
function notosTaverna(s) {
  const M = DECOR, Z = (z) => z * s, zr = (a, b) => [Z(a), Z(b)].sort((p, q) => p - q), R = rngOf(s > 0 ? 311 : 312);
  const X0 = -22, X1 = -16, [zA, zB] = zr(14, 24), t = 0.36, H = 3.4, o = { tint: CY_WHITE, frames: true, frameTint: CY_BLUE, m: 'concrete', top: false }; // top: the flat roof's paving covers the course
  const za = (a, b) => { const [p, q] = zr(a, b); return { a0: p, a1: q }; };
  cyDoorMark(X0, Z(19.5), -1, 0, 1.2, 'tavern'); cyDoorMark(X1, Z(22.5), 1, 0, 1.2, 'tavern');
  wallOpen('limewash', 'z', X0 + t / 2, t, zA, zB, 0, H, [{ ...za(18.9, 20.1), b0: 0, b1: 2.35, arch: 0.45 }, { ...za(15.4, 16.8), b0: 0.95, b1: 2.35 }, { ...za(21.4, 22.8), b0: 0.95, b1: 2.35 }], o);
  wallOpen('limewash', 'z', X1 - t / 2, t, zA, zB, 0, H, [{ ...za(21.9, 23.1), b0: 0, b1: 2.35, arch: 0.4 }, { ...za(16.8, 18.2), b0: 0.95, b1: 2.35 }], o);
  wallOpen('limewash', 'x', Z(14) + s * t / 2, t, X0 + t, X1 - t, 0, H, [{ a0: -20.0, a1: -18.0, b0: 0.95, b1: 2.35 }], o);
  wallOpen('limewash', 'x', Z(24) - s * t / 2, t, X0 + t, X1 - t, 0, H, [{ a0: -20.0, a1: -18.0, b0: 0.95, b1: 2.35 }], o);
  M.save().color([0.62, 0.7, 0.76]); M.cls = 1;
  for (const [a, b] of [zr(15.4, 16.8), zr(21.4, 22.8)]) M.quad('glass', [X0 + t / 2, 0.95, a], [X0 + t / 2, 0.95, b], [X0 + t / 2, 2.35, b], [X0 + t / 2, 2.35, a], [-1, 0, 0]);
  { const [a, b] = zr(16.8, 18.2); M.quad('glass', [X1 - t / 2, 0.95, a], [X1 - t / 2, 0.95, b], [X1 - t / 2, 2.35, b], [X1 - t / 2, 2.35, a], [1, 0, 0]); }
  for (const [z, nz] of [[Z(24) - s * t / 2, s], [Z(14) + s * t / 2, -s]]) M.quad('glass', [-20.0, 0.95, z], [-18.0, 0.95, z], [-18.0, 2.35, z], [-20.0, 2.35, z], [0, 0, nz]);
  M.restore();
  box('tiles', X0 + t, X1 - t, 0, 0.03, zA + t, zB - t, { collide: false, ao: false, tint: [0.88, 0.86, 0.8] });
  // plank ceiling: pierced above the ramp, which climbs along the east wall toward the north (from z = 23.4 to z = 16 in the south, mirrored in the north) and comes out level onto the roof
  const hx0 = -18.4, hx1 = -16.36, hz = zr(16.0, 21.0);
  // (no top face: the flat roof's paving, laid by cyRoof at the same level, replaces it; the two were flickering)
  box('limewash', X0, hx0, H - 0.3, H, zA, zB, { tint: CY_WHITE, skip: 'Y' });
  box('limewash', hx0, X1, H - 0.3, H, hz[1], zB, { tint: CY_WHITE, skip: 'Y' });
  box('limewash', hx0, X1, H - 0.3, H, zA, hz[0], { tint: CY_WHITE, skip: 'Y' });
  if (s > 0) ramp(hx0 + 0.1, X1 - t, 16.0, 22.0, 'z', H, 0, 'limewash', [0.9, 0.88, 0.84], { mat: 'limewash' }); else ramp(hx0 + 0.1, X1 - t, -22.0, -16.0, 'z', 0, H, 'limewash', [0.9, 0.88, 0.84], { mat: 'limewash' }); // slope of 0.57; the flat landing in front of the east door (z 22 to 23.4) leaves the threshold clear
  railing(hx0, hx0, H, hz[0], hz[1], 'z', undefined, CY_BLUE);
  railing(hz[s > 0 ? 1 : 0], 0, H, hx0, hx1, 'x', undefined, CY_BLUE);
  // counter, tables, shelves and lamps
  M.save().local(1).color([0.4, 0.28, 0.18]); const [ca, cb] = zr(14.7, 17.6);
  M.boxB('wood', X0 + t + 0.3, X0 + t + 0.9, 0, 1.06, ca, cb); M.color([0.7, 0.72, 0.74]); M.boxB('steel', X0 + t + 0.25, X0 + t + 0.95, 1.06, 1.12, ca - 0.05, cb + 0.05, { bevel: 0.01 });
  M.restore();
  WORLD.col({ x0: X0 + t + 0.3, x1: X0 + t + 0.9, y0: 0, y1: 1.12, z0: ca, z1: cb }, 'wood');
  for (const [x, z] of [[-19.6, 15.4], [-19.6, 17.3]]) cafeSet(M, x, Z(z), [Math.PI * 0.5, -Math.PI * 0.5], [0.1, 0.3, 0.6]);
  for (const [x, z] of [[-19.6, 19.6], [-19.6, 16.4]]) pendantLamp(x, 2.5, Z(z), H - 0.3);
  // sign, awning and tables in the shade of a reed arbor, sea side
  // (menu board on the pier between the door and the window, z = ±20.75: straddling the window, it half floated in the void)
  inFrame(facadeFrame('w', X0, X1, zA, zB), (MM) => { cySignBoard(MM, s > 0 ? 4.6 : 5.4, 2.7, 3.4, 0.78, CYS.psaro); cyWallDecal(MM, CYD.menu, s > 0 ? 6.75 : 3.25, 1.1, 0.7, 0.7); });
  // arbor attached to the facade: its east posts against the wall (x -22.1); at x -22.6, they left a 52 cm gap with it where you
  // got stuck (snags.js)
  cyPergola(-27.0, -22.1, ...zr(15.2, 23.0), 2.7, s > 0 ? 601 : 602, { vine: true });
  for (const z of [16.4, 22.2]) for (const [x, ang] of [[-25.2, 0], [-23.8, Math.PI]]) cafeSet(M, x, Z(z), [Math.PI * 0.5 + ang, -Math.PI * 0.5 + ang, ang], [0.1, 0.3, 0.6]);
  // walkable flat roof: parapet, tables, flower tubs, view of the sea. Its parapet opens on Harbor Street, at the corner on the base side:
  // the roof bridge (notosRoofBridge) leads to the flat roof of the central block
  const house = { x0: X0, x1: X1, z0: zA, z1: zB, h: H, tint: CY_WHITE }, [ga, gb] = zr(MEL.bridge[2], MEL.bridge[3]);
  cyRoof(house, { n: [[X0, X1]], s: [[X0, X1]], e: [[zA, zB]], w: [[zA, zB]] }, { R, walk: true, hole: [hx0, X1 - t, hz[0], hz[1]], gaps: [{ side: 'e', at: X1, a0: ga, a1: gb }] });
  notosRoofBridge(s);
  for (const [x, z, w, d] of [[-21.3, 17.6, 0.6, 2.0], [-21.3, 21.4, 0.6, 2.0]]) { const a = zr(z - d / 2, z + d / 2), bx = [x - w / 2, x + w / 2]; box('limewash', bx[0], bx[1], H, H + 0.85, a[0], a[1], { tint: CY_WHITE, bevel: 0.04 }); M.place(PF.cyBush(1.1, 2 + Math.round(x)), x, H + 0.85, Z(z), 0); }
}

/* Roof bridge over Harbor Street (layout of November 2026; south half, mirrored in the north): a whitewashed walkway level with the
   two flat roofs it joins (3.4 m), the tavern's (the sniper's post, until then reached only by its inside ramp) and the central block's
   (until then a dead end above the well plaza's staircase). 2.4 m wide, 1.05 m parapets like the roofs', 3 m of headroom in the street.
   Two new routes: from the Marine up through the tavern and across, onto the roof that overlooks the well plaza (A, C); from the well
   plaza up the block's staircase to the sniper's roof, which can now be taken from two sides. */
function notosRoofBridge(s) {
  const [x0, x1, za, zb] = MEL.bridge, [z0, z1] = [za * s, zb * s].sort((p, q) => p - q);
  cyBridge(x0, x1, z0, z1, CY_H.t);
}

/* Pot or jar at the foot of the wall nearest to (x, z): never in the middle of an alley or in front of a door (slide along the wall to a free spot) */
function notosPot(type, x, z, R, o = {}) {
  const w = cyWallSpot(x, z, 0.3, 1.6); if (!w) return false;
  const tx = Math.cos(w.ry), tz = -Math.sin(w.ry); // along the wall
  for (const t of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
    const px = w.x + tx * t, pz = w.z + tz * t, q = cyWallSpot(px, pz, 0.3, 0.7);
    if (!q || hyp(q.x - px, q.z - pz) > 0.12 || !cyDoorClear(px, pz, 0.3)) continue;
    DECOR.dyn(type, px, 0, pz, R() * TAU, o); return true;
  }
  return false;
}
/* Plant, bale of straw or tree placed at the nearest free spot to (x, z): outside the corridor in front of doors */
function notosPlant(pf, x, y, z, ry, r = 0.6, reach = 3) {
  const D = MAP_DEFS.notos, keep = (px, pz) => !D.spawns.some(([sx, sz]) => hyp(px - sx, pz - sz) < 1.5 || hyp(px - sx, pz + sz) < 1.5) && !D.poi.some((p) => p[1] < 1 && hyp(px - p[0], pz - p[2]) < 1.1); // neither on a spawn nor on a point of interest
  const sp = cyClearSpot(x, z, r, reach, (px, pz) => Math.abs(pz) < 47.2 && px > -29.4 && px < 29.4 && !cyNearWall(px, pz, Math.min(r * 0.7, 0.7)) && keep(px, pz), r > 1 ? 3.2 : 2.0); // in the play area, outside the walls, and the crown does not cover an entrance
  if (!sp) return false;
  DECOR.place(pf, sp[0], y, sp[1], ry); return true;
}

/* ---------- The Marine (quay, tamarisks, kiosk, boats): south half ---------- */
function notosMarine(s) {
  const Z = (z) => z * s, zr = (a, b) => [Z(a), Z(b)].sort((p, q) => p - q), M = DECOR, R = rngOf(s > 0 ? 701 : 702), c = MEL.coast, rot = (a) => (s > 0 ? a : Math.PI - a);
  // caiques moored side by side along the quay, one more row further out
  const kaikis = [
    [7.5, [0.94, 0.94, 0.9], [0.1, 0.3, 0.62], 0, 1], [16.5, [0.15, 0.4, 0.62], [0.95, 0.95, 0.92], 1, 2], [25.5, [0.92, 0.9, 0.84], [0.62, 0.16, 0.12], 2, 3], [36, [0.94, 0.94, 0.9], [0.16, 0.42, 0.34], 3, 4], [44.5, [0.2, 0.38, 0.6], [0.92, 0.72, 0.2], 0, 5],
  ];
  for (const [z, hull, accent, name, seed] of kaikis) {
    floatAdd(PF.cyKaiki({ hull, accent, name, seed }), c - 1.9, Z(z), s > 0 ? 0.04 : Math.PI - 0.04, { L: 7.6, B: 2.7, draft: 0, roll: 0.03 });
    const bz = (q) => (Math.abs(q - 13.5) < 0.1 ? 15.2 : q); // the bollard at z = 13.5 would fall into the fountain block stuck to the border: on the other side of the ladder
    for (const dz of [-3, 3]) M.place(PF.bitt(), c + 0.65, 0, Z(bz(z + dz)), 0); // a bollard under each mooring line
    mooringLine([c + 0.65, 0.55, Z(bz(z - 3))], [c - 1.9, MEL.wl + 0.9, Z(z - 2.6)], 0.5); mooringLine([c + 0.65, 0.55, Z(bz(z + 3))], [c - 1.9, MEL.wl + 0.9, Z(z + 2.6)], 0.5);
  }
  for (const [z, hull, accent, name, seed] of [[13, [0.94, 0.94, 0.9], [0.16, 0.42, 0.34], 1, 6], [31, [0.9, 0.9, 0.86], [0.1, 0.3, 0.62], 2, 7]]) floatAdd(PF.cyKaiki({ hull, accent, name, seed }), c - 5.2, Z(z), s > 0 ? -0.1 : Math.PI + 0.1, { L: 7.6, B: 2.7, draft: 0, roll: 0.04 });
  // quay ladders, life rings
  M.place(PF.quayLadder(2.4), c - 0.02, 0, Z(30.75), -Math.PI / 2); // a ladder, on the facing, in the 2.9 m gap between the caiques moored side by side
  M.place(PF.lifeRingStand(), c + 0.5, 0, Z(22), -Math.PI / 2);
  // waterfront tamarisks, with a bench beneath and facing the sea (at z = 27, the bench moves closer to the trunk: at 1.6 m it went under the caique
  // hauled ashore at z = 32.6)
  // (not at z = 13.5, in front of the fountain's niche, nor at z = 21, in the tavern's arbor; the angle is drawn anyway)
  for (const z of [7, 13.5, 21, 27]) { const ry = R() * TAU; if (z === 13.5 || z === 21) continue; M.place(PF.cyTamarisk(3.6 + (Math.round(z) % 3) * 0.3, Math.round(z) + (s > 0 ? 0 : 20)), c + 3.2, 0, Z(z), ry); { const bz = Z(z + (z === 27 ? 1.0 : 1.6)); benchAt(c + 3.9, bz, c - 4, bz); } }
  // kiosk (periptero), drying octopuses, nets and traps
  cyKiosk(-23.2, Z(9.0), -Math.PI / 2); // at x = -23.2: with the four small blocks of the quay, it cuts every firing line along the Marine
  cyOctopusLine(c + 2.3, Z(30.7), Math.PI / 2, 3.2);
  // (no pile of nets on the Marine: on the quay, at x -27.5, z ±10.6, it closed off, with the tamarisk and its bench, the walkway along the water;
  // between the caiques hauled ashore, it covered a point of interest, and north of them, the spawns: crossing.js, audit.js)
  M.place(PF.lobsterPots(2, 2, 2, s > 0 ? 3 : 4), -20.7, 0, Z(26.6), Math.PI / 2);
  // shipyard: caiques hauled ashore on their cradles, winch and tools
  cyHauledBoat(-25.5, Z(32.6), s > 0 ? 0 : Math.PI, { hull: [0.9, 0.9, 0.86], accent: [0.1, 0.3, 0.62], name: 3, seed: 8 });
  cyHauledBoat(-26.2, Z(42.4), s > 0 ? Math.PI : 0, { hull: [0.62, 0.2, 0.14], accent: [0.94, 0.94, 0.9], name: 0, seed: 9 });
  cyHauledBoat(-20.6, Z(45.0), Math.PI / 2, { hull: [0.94, 0.94, 0.9], accent: [0.16, 0.42, 0.34], name: 1, seed: 10 });
  for (const [x, z, n, k] of [[-22.0, 37.6, 2, 0], [-22.9, 37.8, 3, 1]]) M.place(PF.fishBinStackDyn(n, k), x, 0, Z(z), R() * 0.3);
  M.dyn('jerrycan', -23.4, 0, Z(39.6), 0.3, { tint: [0.85, 0.2, 0.1] }); M.dyn('gasBottle', -23.1, 0, Z(39.9), 0.2, { tint: [0.2, 0.35, 0.65] });
  for (const [x, z] of [[-27.4, 37.4], [-28.2, 38.2]]) M.dyn('barrel', x, 0, Z(z), R() * TAU, { tint: [0.15, 0.32, 0.55] });
  lampPost(-22.0, Z(26), 0); lampPost(-21.2, Z(41), 0);
  // cats: in the sun on the quay and on the steps
  M.place(PF.cyCat(1 + (s > 0 ? 0 : 1)), -29.2, 0.1, Z(15.8), 0.6, { nocol: true }); M.place(PF.cyCat(3), -22.2, 0, Z(31.0), -0.8, { nocol: true });
}

/* ---------- The Plane Tree square, the church forecourt (south half) ---------- */
function notosPlace(s) {
  const Z = (z) => z * s, M = DECOR, R = rngOf(s > 0 ? 811 : 812);
  // at the Kafeneio: tables and parasols on the square, in front of the east door (north and south of the axis)
  cafeSet(M, -10.8, Z(4.6), [Math.PI, 0, -Math.PI / 2], [0.1, 0.3, 0.6]);
  M.place(PF.cyUmbrella(), -10.8, 0, Z(4.6), 0, { nocol: true });
  // low whitewashed stone planters at the four corners of the square: cover and flowers
  for (const [x, z, w, d, k] of [[-13.3, 6.2, 1.8, 0.8, 1], [-13.3, 10.2, 1.8, 0.8, 2], [-6.0, 8.8, 2.4, 0.8, 3]]) notosPlanter(x, Z(z), w, d, k + (s > 0 ? 0 : 4));
  // cypresses on either side of the forecourt
  for (const dz of [5.2]) M.place(PF.cyCypress(8.2, 1 + (s > 0 ? 0 : 3)), -5.0, 0, Z(dz), 0);
  // street lamps, benches and pots along the facades of the block
  lampPost(-14.6, Z(10.8), 0); lampPost(-4.3, Z(11.4), 0);
  for (const x of [-11.2, -5.6]) benchAt(x, Z(11.4), x, Z(8.5));
  for (const [x, z] of [[-12.6, 11.6], [-3.6, 11.6]]) notosPot('cyPot', x, Z(z), R, { a: [R() < 0.5 ? 0 : 2] });
  // the square's cat, on the plane tree's ledge
  M.place(PF.cyCat(2), -9.2, 0.45, Z(1.5), 0.5, { nocol: true });
}
/* Whitewashed stone planter with its flowers (low collision: a cover to crouch behind) */
function notosPlanter(x, z, w, d, seed) {
  const M = DECOR;
  M.save().color(CY_WHITE).world(1); M.boxB('limewash', x - w / 2, x + w / 2, 0, 0.7, z - d / 2, z + d / 2, { bevel: 0.05 }); M.restore();
  DECOR.col(x - w / 2, x + w / 2, 0, 0.7, z - d / 2, z + d / 2, 'concrete');
  const n = Math.max(1, Math.round(Math.max(w, d) / 1.0));
  for (let i = 0; i < n; i++) { const t = n === 1 ? 0 : (i / (n - 1) - 0.5) * (Math.max(w, d) - 0.9); M.place(PF.cyBush(1.0, seed + i), w >= d ? x + t : x, 0.66, w >= d ? z : z + t, i * 1.3, { nocol: true }); }
}

/* ---------- In the center: the plane tree, the stone ring, the benches (around z = 0) ---------- */
function notosCenter() {
  const M = DECOR, x = -8.5;
  // the trunk keeps its collision above the curb (the prefab placed it from the ground up, inside the curb's)
  M.place(PF.cyPlane(10.5, 1), x, 0, 0, 0.7, { nocol: true }); for (const [hx, hz] of [[0.58, 0.24], [0.24, 0.58], [0.45, 0.45]]) DECOR.col(x - hx, x + hx, 0.45, 10.5 * 0.5, -hz, hz, 'wood'); // octagon: as a 1.24 m square, it closed off the curb cells on either side of the axis, and B (on the curb) was not equally easy to reach from the two bases
  // round curb of whitewashed dry stone, filled with earth, that serves as a bench: 45 cm, the height of a bench and of the automatic step
  // (STEP); at 55 cm you had to jump, and the bots did not climb onto point B that it occupies
  M.save().move(x, 0, 0).local(1).color([0.9, 0.88, 0.82]); M.lathe('drystone', [[2.15, 0], [2.15, 0.4], [2.0, 0.45], [1.82, 0.45], [1.8, 0.1]], 16, { sharp: 0.5, uR: 1.2 }); M.restore();
  M.save().move(x, 0, 0).local(1).color([0.4, 0.3, 0.22]); M.save().move(0, 0.38, 0); M.cyl('dirt', 1.84, 0.03, 16); M.restore(); M.restore();
  // collision: an octagon of three crossed boxes (like the mill) instead of a square whose corners stick out of the round curb
  for (const [hx, hz] of [[1.9, 0.8], [0.8, 1.9], [1.6, 1.6]]) DECOR.col(x - hx, x + hx, 0, 0.45, -hz, hz, 'concrete');
  // the Kafeneio's flag, on its facade
  cyFlag(-12.1, 3.3, 2.6, Math.PI / 2);
  // a caique hauled out on its cradle for repainting, across the quay at the head of the jetty, on point B (layout of November 2026):
  // until then the quay in front of the Kafeneio was bare (5 pieces of cover within 9 m of B, against 13 and 12 for A and C) and the
  // jetty fired straight into the cafe's door. Along x on the axis: its own mirror, the same cover for both teams. A small one (6 m by
  // 2.3, the moored caiques' shape): its collision (x -27.25 to -21.55, z ±1.04) frees the rows of navigation cells at z = ±1.5 alongside
  // and 2.7 m of quay at the head of the jetty, so the walk around it stays short. With the 7.6 m caique, B's disc fell to 67 % walkable
  // (70 % at least) and the head of the jetty, cut in two behind the hull, counted as two more ways onto B (6, 4 at most)
  cyHauledBoat(-24.4, 0, Math.PI / 2, { hull: [0.15, 0.4, 0.62], accent: [0.95, 0.95, 0.92], name: 1, seed: 2, L: 6.0, B: 2.3 });
}

/* ---------- The upper village: arbors, trees, laundry, pots, cats (south half) ---------- */
function notosChora(s) {
  const Z = (z) => z * s, M = DECOR, R = rngOf(s > 0 ? 901 : 902);
  // laundry strung across the 2 m alleys, from one two-story wall to the other
  for (const z of [3.6, 8.4]) clothesLine(17.97, Z(z), 20.03, Z(z), 4.9);
  for (const z of [3.6, 9.2]) clothesLine(23.97, Z(z), 26.03, Z(z), 4.9);
  clothesLine(19.97, Z(16.4), 22.03, Z(16.4), 4.7);
  // pots in front of doors, bougainvilleas and jars along the walls
  for (const [x, z] of [[19.1, 5.4], [25.2, 6.0], [21.0, 18.2], [27.0, 17.0], [27.2, 24.6], [16.2, 13.0]]) notosPot('cyPot', x, Z(z), R, { a: [Math.floor(R() * 4)] });
  notosPot('jar', 26.9, Z(25.6), R); notosPot('jar', 26.9, Z(26.2), R, { s: 0.8 });
  // isolated trees: an olive tree in the Apse alley, a trellis on the terraces
  notosPlant(PF.cyOlive(4.4, 1 + (s > 0 ? 0 : 2)), 9.8, 0, Z(19.0), 0.3, 1.5, 4);
  // low planters in the Apse alley (layout of November 2026), set against the walls on alternating sides: the 76 m alley along the church,
  // until then bare from one base to the other but for the olive tree, gets cover to move up it crouching, one stretch at a time.
  // Flush with the wall (no slit behind), away from the doors (x = 8, z 28.5 and -36.3) and from the alleys that open onto it (z 12 to 14, 22 to 24)
  // (the square's bushes: no new prefab)
  notosPlanter(11.6, Z(9.0), 0.8, 2.2, 2 + (s > 0 ? 0 : 4));
  notosPlanter(8.4, Z(25.2), 0.8, 2.2, 3 + (s > 0 ? 0 : 4));
  // cats on the steps
  M.place(PF.cyCat(4), 25.0, 0.1, Z(37.3), 0.4, { nocol: true }); M.place(PF.cyCat(1), 11.2, 0.2, Z(30.6), -0.5, { nocol: true });
}

/* ---------- The bases: well courtyard (center), shipyard (west, see notosMarine), threshing floor (east); the mill behind ---------- */
function notosBase(s) {
  const Z = (z) => z * s, M = DECOR, R = rngOf(s > 0 ? 1001 : 1002), zr = (a, b) => [Z(a), Z(b)].sort((p, q) => p - q);
  // well plaza (point A / C): well, three fig trees, benches, pots, shadows
  cyWell(-4.2, Z(38.8));
  for (const [x, z, h, sd] of [[-14.6, 31.2, 4.4, 1], [-14.8, 37.8, 4.2, 3]]) notosPlant(PF.cyFig(h, sd + (s > 0 ? 0 : 3)), x, 0, Z(z), R() * TAU, 1.4, 3.5); // no fig tree at the foot of the roof staircase (-3.2; 31.6): it pinched Source Street
  R();
  for (const [x, z] of [[-15.3, 33.0], [-15.3, 36.0]]) benchAt(x, Z(z), -9, Z(34)); // no bench east of the plaza: it touched the house's door (x = -2)
  for (const [x, z] of [[-15.7, 34.5]]) M.dyn('cyPot', x, 0, Z(z), R() * TAU, { a: [1] });
  R(); R();
  // central cistern: four basins, jars, tools
  M.dyn('jar', -12.6, 0, Z(41.6), 0.2); M.dyn('jar', -2.4, 0, Z(41.5), 1.0, { s: 0.9 });
  notosPlant(PF.cyOlive(4.8, 5 + (s > 0 ? 0 : 1)), -0.4, 0, Z(44.0), 0.5, 1.5, 4);
  notosMillHouse(s);
  // threshing floor: the round paving, dry-stone low walls, bales of straw, olive trees
  M.save().move(21.0, 0.0, Z(44.5)).color([0.82, 0.78, 0.7]).world(1); M.lathe('slab', [[4.4, 0.0], [4.4, 0.05], [3.8, 0.07], [0, 0.07]], 28, { sharp: 0.9, uR: 1 }); M.restore();
  for (const [x0, x1, z0, z1] of MEL.lowWalls) { const a = zr(z0, z1); box('drystone', x0, x1, 0, 1.15, a[0], a[1], { tint: [0.9, 0.88, 0.82], m: 'concrete' }); }
  for (const [x, z] of [[28.0, 46.4], [10.4, 43.6]]) notosPlant(PF.hayBale(), x, 0, Z(z), R() * TAU, 0.9);
  for (const [x, z, h] of [[8.4, 45.8, 4.2], [28.6, 43.0, 4.0]]) notosPlant(PF.cyOlive(h, 7), x, 0, Z(z), R() * TAU, 1.5, 4);
  for (const [x, z] of [[6.6, 41.6], [24.4, 47.2], [9.8, 47.4]]) notosPlant(PF.cyOpuntia(1.0 + R() * 0.3), x, 0, Z(z), R() * TAU, 0.7);
  for (const [x, z] of [[27.6, 41.2], [12.0, 47.2]]) notosPlant(PF.cyAgave(1.1), x, 0, Z(z), R() * TAU, 0.7);
  for (const z of [47.6]) for (const x of [-4, 6, 29]) notosPlant(PF.cyCypress(7 + R() * 1.5, Math.round(x) + 5), x, 0, Z(z), 0, 0.8); // none on the threshing floor's paving (center 21, radius 4.4)
}

/* The mill house, behind the base and outside the play area: a whitewashed cube a bit taller than the perimeter, the mill on its roof,
   sails turned toward the village. It replaces the mill set on the ground in the corner of the courtyard, which could only be seen from that courtyard. */
function notosMillHouse(s) {
  const Z = (z) => z * s, zr = (a, b) => [Z(a), Z(b)].sort((p, q) => p - q), H = 10.8, x0 = MEL.millX - 5, x1 = MEL.millX + 5, [z0, z1] = zr(50, 58);
  box('limewash', x0, x1, 0, H, z0, z1, { tint: CY_WHITE, m: 'concrete' });
  // low parapet and its coping, like the town's roofs
  for (const [a0, a1, b0, b1] of [[x0, x1, z0, z0 + 0.22], [x0, x1, z1 - 0.22, z1], [x0, x0 + 0.22, z0, z1], [x1 - 0.22, x1, z0, z1]]) {
    box('limewash', a0, a1, H, H + 0.45, b0, b1, { tint: CY_WHITE, collide: false });
    box('limewash', a0 - 0.03, a1 + 0.03, H + 0.45, H + 0.52, b0 - 0.03, b1 + 0.03, { tint: [0.97, 0.96, 0.94], collide: false, bevel: 0.03 });
  }
  cyWindmill(MEL.millX, Z(54), s > 0 ? Math.PI : 0, { y: H, face: s > 0 ? -Math.PI / 2 : Math.PI / 2, roof: true, sail: s > 0 ? null : MEL.sail[1] });
}

/* Relief of the east hill (x > 52): same function for the surface and for the houses placed on it */
function notosHillY(x, z) {
  MEL.hn = MEL.hn || makeNoise(75);
  const u = (z + 250) / 500, v = (x - 52) / 278, n = MEL.hn.fbm(u * 4, v * 2, 32, 32, 4);
  return -1 + Math.pow(smoothstep(0, 0.9, v), 1.4) * (30 + n * 58);
}
/* ---------- Background: hills and distant village, mills on the ridge, islands, breakwater and lighthouse ---------- */
function notosBackdrop() {
  const M = DECOR, R = rngOf(6262);
  WORLD.force = 'far';
  // the east hill: dry slopes, white houses climbing up, mills, chapel on the summit; to the north and south, the sea to the horizon (headlands seen edge-on gave only dark shards)
  M.save().color([0.7, 0.67, 0.56]).local(1); M.cls = 1;
  M.surf('rock', 36, 6, (u, v) => { const z = lerp(-250, 250, u), x = lerp(52, 330, v); return [x, notosHillY(x, z), z]; }, { uL: 520, vL: 300 });
  M.restore();
  // the village climbing up: white cubes in tiers, blue domes, mills on the ridge
  for (let i = 0; i < 110; i++) {
    const x = R.range(40, 150), z = R.range(-150, 150);
    if (x < 52 && Math.abs(z) < 62) continue;
    farCyclad(x, Math.max(0, notosHillY(x, z) - 0.5), z, R.range(6, 11), R.range(5, 9), R.range(3.4, 7), R);
  }
  for (const [x, z] of [[100, -60], [112, -20], [96, 40], [118, 90], [120, -110]]) farWindmill(x, notosHillY(x, z) + 1.5, z);
  for (const [x, z] of [[160, 10], [140, -80]]) farChapel(x, notosHillY(x, z) + 1.5, z);
  // lighthouse and breakwater of the outer harbor, island offshore
  lighthouse(-120, -28, 13, CY_BLUE, 2.4);
  M.save().color([0.78, 0.76, 0.7]).world(1);
  for (const [ax, az, bx, bz] of [[-30, -170, -118, -60], [-30, 175, -140, 60]]) { const L = hyp(bx - ax, bz - az), ang = Math.atan2(bx - ax, bz - az); M.save().move(ax, 0, az).rotY(ang); M.boxB('concrete', -2.4, 2.4, MEL.wl - 1, 2.0, 0, L, { bevel: 0.05 }); M.restore(); waterObstacle([[ax - 5, az], [ax + 5, az], [bx + 5, bz], [bx - 5, bz]], 3, [0.7, 0.68, 0.62], 1); }
  M.restore();
  for (const [x, z, r, h] of [[-330, -90, 70, 22], [-420, 120, 90, 30], [-260, 210, 50, 14]]) { M.save().move(x, 0, z).color([0.62, 0.58, 0.46]).local(1); M.lathe('rock', [[r, MEL.wl - 2], [r * 0.9, h * 0.2], [r * 0.6, h * 0.55], [r * 0.25, h * 0.9], [0, h]], 14, { sharp: 1.2 }); M.restore(); }
  WORLD.force = null;
  // sailboats and caiques at anchor
  for (const [x, z, k] of [[-62, -44, 1], [-78, 18, 2], [-66, 62, 3], [-92, -8, 4], [-84, 92, 5]]) floatAdd(PF.sailboat(k), x, z, R() * TAU, { L: 9, B: 3, draft: 0.05, roll: 0.05 });
  for (const [x, z, k] of [[-50, 26, 1], [-60, -70, 2], [-46, -30, 3]]) floatAdd(PF.cyKaiki({ hull: R.pick([[0.94, 0.94, 0.9], [0.15, 0.4, 0.62], [0.9, 0.9, 0.84]]), accent: R.pick([[0.1, 0.3, 0.62], [0.62, 0.16, 0.12], [0.16, 0.42, 0.34]]), name: k % 4, seed: 20 + k }), x, z, R() * TAU, { L: 7.6, B: 2.7, draft: 0, roll: 0.05 });
}
/* Distant house: white cube, dark windows, flat roof with a rim, sometimes a blue dome; no collision */
function farCyclad(cx, y0, cz, w, d, h, R) {
  const M = DECOR;
  M.save().move(cx, y0, cz).rotY(R() < 0.5 ? 0 : Math.PI / 2).color(R.pick(CYP.wash)).world(1);
  M.boxB('limewash', -w / 2, w / 2, -6, h, -d / 2, d / 2, { skip: 'y' });
  M.color([0.97, 0.96, 0.94]).local(1); M.boxB('limewash', -w / 2 - 0.1, w / 2 + 0.1, h, h + 0.35, -d / 2 - 0.1, d / 2 + 0.1);
  M.color([0.12, 0.2, 0.34]);
  for (const sd of [-1, 1]) for (let x = -w / 2 + 1.2; x < w / 2 - 0.8; x += 2.3) M.quad('dark', [x, h * 0.45, sd * (d / 2 + 0.01)], [x + 0.8, h * 0.45, sd * (d / 2 + 0.01)], [x + 0.8, h * 0.45 + 1.1, sd * (d / 2 + 0.01)], [x, h * 0.45 + 1.1, sd * (d / 2 + 0.01)], [0, 0, sd]);
  if (R() < 0.12) { M.color(CY_DOME); M.save().move(0, h + 0.35, 0); M.lathe('limewash', [[1.8, 0], [1.9, 0.2], [1.3, 1.1], [0.5, 1.7], [0, 1.8]], 10, { sharp: 0.9 }); M.restore(); }
  M.restore();
}
function farWindmill(x, y, z) {
  const M = DECOR;
  M.save().move(x, y, z).color(CY_WHITE).local(1); M.cyl('limewash', 3.6, 9, 12, { r1: 2.8, caps: '' }); M.save().move(0, 9, 0).color([0.7, 0.58, 0.34]); M.lathe('burlap', [[3.4, 0], [2.4, 1.4], [1, 2.6], [0, 3.2]], 12, { sharp: 0.9 }); M.restore();
  M.color([0.9, 0.9, 0.86]);
  for (let i = 0; i < 4; i++) { M.save().move(-3.2, 10.2, 0).rotX(i * Math.PI / 2 + 0.3); M.boxB('wood', -0.06, 0.06, 0.4, 7.0, -0.06, 0.06); M.boxB('cloth', -0.02, 0.02, 1.0, 6.8, 0, 1.4); M.restore(); }
  M.restore();
}
function farChapel(x, y, z) {
  const M = DECOR;
  M.save().move(x, y, z).color(CY_WHITE).world(1); M.boxB('limewash', -3, 3, -6, 4.2, -2.6, 2.6, { bevel: 0.1 });
  M.local(1); M.color(CY_DOME); M.save().move(0, 4.2, 0); M.lathe('limewash', [[2.3, 0], [2.4, 0.2], [1.7, 1.5], [0.7, 2.3], [0, 2.5]], 12, { sharp: 0.9 }); M.restore(); M.restore();
}

/* ---------- Ground ---------- */
function notosGround(P) {
  const S = SPLAT, W = S.w * S.ppm, H = S.d * S.ppm, out = new Uint8Array(W * H * 4), N = makeNoise(2607);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = S.x0 + (i + 0.5) / S.ppm, z = S.z0 + (j + 0.5) / S.ppm, o = (j * W + i) * 4;
    const ci = P.ix(x), ck = P.kz(z), n1 = N.fbm(x * 0.09, z * 0.09, 32, 32, 3), n2 = N.fbm(x * 0.21 + 3.1, z * 0.21, 32, 32, 2);
    let r = 0, g = 0, b = 0, a = 0.15 + n2 * 0.3;
    if (x < MEL.coast) { g = 1; } // the quay goes under water: unimportant
    else if (ci >= 0 && ci < P.W && ck >= 0 && ck < P.H) {
      const ch = P.G[ck][ci], base = Math.abs(z) > 40 && !(ci < 5);
      if (ch === '.' || ch === 'a') {
        if (ci < 5) g = 1;                                                       // quay: pebbles
        else if (Math.abs(z) > 40 || (Math.abs(z) > 38 && ci > 13)) { r = Math.abs(z) > 40 ? 0.15 + 0.35 * smoothstep(0.35, 0.65, n1) * 0 : 1; a = 0.35 + n2 * 0.4; r = Math.abs(z) > 41 ? 0.0 : r; }
        else r = 1;                                                              // alleys and squares: paving slabs
        if (base && ci >= 5 && Math.abs(z) > 40.5) { r = Math.min(r, 0.12 * (1 - smoothstep(0.3, 0.6, n1))); a = 0.4 + n2 * 0.4; }
        // whitewash border at the foot of the walls (0.3 m), white forecourt in front of the church
        const fx = (x - P.cx(ci)) / P.c, fz = (z - P.cz(ck)) / P.c;
        const dw = Math.min(fx < 0.5 ? (P.at(ci - 1, ck) !== '.' && P.at(ci - 1, ck) !== '~' ? fx * P.c : 9) : (P.at(ci + 1, ck) !== '.' && P.at(ci + 1, ck) !== '~' ? (1 - fx) * P.c : 9),
          fz < 0.5 ? (P.at(ci, ck - 1) !== '.' && P.at(ci, ck - 1) !== '~' ? fz * P.c : 9) : (P.at(ci, ck + 1) !== '.' && P.at(ci, ck + 1) !== '~' ? (1 - fz) * P.c : 9));
        if (dw < 0.3 + n2 * 0.08 && ci >= 5 && r > 0.5) { b = 1; r = 0; }
        if (x > -9.4 && x < -3.6 && Math.abs(z) < 5.2) { b = Math.max(b, 0.9 * (1 - smoothstep(0.6, 0.9, n1))); r *= 1 - b; } // forecourt
      } else { r = 0; }
    } else if (x >= MEL.coast) { r = 0; a = 0.3 + n2 * 0.4; }
    out[o] = Math.round(clamp(r, 0, 1) * 255); out[o + 1] = Math.round(clamp(g, 0, 1) * 255); out[o + 2] = Math.round(clamp(b, 0, 1) * 255); out[o + 3] = Math.round(clamp(a, 0, 1) * 255);
  }
  const t = new THREE.DataTexture(out, W, H, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  MAT.ground = groundMat(t, [S.x0, S.z0, S.w, S.d], GROUND_NOTOS);
  // dry land only: no ground above the sea
  // pierced at the wells' shaft (CYC.holes, cyWell): a wall laid flat (its y goes toward -z), the holes as squares that the curb covers
  const M = DECOR; WORLD.force = 'g';
  M.save().color([0.8, 0.8, 0.76]).local(1); M.aoFn = null;
  M.save().move(MEL.coast, 0, 330).rotX(-Math.PI / 2);
  M.wall('ground', 330 - MEL.coast, 660, (CYC.holes || []).map(([x0, x1, z0, z1]) => ({ x0: x0 - MEL.coast, x1: x1 - MEL.coast, y0: 330 - z1, y1: 330 - z0 })));
  M.restore();
  M.restore(); WORLD.force = null;
}

/* ---------- Map definition (see MAP_DEFS in 02-map.js and 02z-load.js) ---------- */
MAP_DEFS.notos = {
  type: 'close', // close combat (whitewashed alleys): README "Map design rules"; drives the bots' weapon choice (botArmForMap)
  bounds: { x0: -42, x1: 30, z0: -48, z1: 48 },
  textures: ['plaster', 'stone', 'cobble', 'pavers', 'wood', 'shutter', 'drystone', 'sand', 'canvas', 'linen', 'steel', 'paintwood', 'burlap', 'timber'], // low walls and base ground in photo (replace the procedural ones)
  // recorded ambience (05c-ambiance.js, amb_notos pack): sea wind and distant surf, lapping against the quay, cicadas on the hills,
  // creaking of the mills; every now and then, gulls above the harbor, bell of the jetty chapel, goat bells on the
  // hill, notos gusts. The bed is mostly the sea (surf, with a little wind and cicadas): it follows the distance to the coast (x < MEL.coast,
  // quay and jetty included), as at Port-Maël (owner feedback: "the sound of the water can be heard all over the map")
  sound: { pack: 'amb_notos', bed: 0.55,
    water: (x) => Math.max(0, x - MEL.coast),
    loops: () => [-36, -12, 12, 36].map((z) => ({ id: 'a_waves', p: [MEL.coast - 1.5, -0.4, z], gain: 0.4, ref: 5, roll: 1.3, max: 110 }))
      .concat([[40, -30], [40, 30], [-6, 70], [-6, -70]].map(([x, z]) => ({ id: 'a_cicadas', p: [x, 3, z], gain: 0.3, ref: 8, roll: 1.2, max: 140 })))
      .concat((CYC.mill || []).map((m) => { const p = m.g.getWorldPosition(new V3()); return { id: 'a_mill', p: [p.x, p.y, p.z], gain: 0.22, ref: 5, roll: 1.4, max: 70 }; })),
    spots: [
      { id: 'a_gull', every: [7, 18], gain: 0.4, at: () => new V3(rand(-70, -34), rand(10, 22), clamp(camera.position.z + rand(-25, 25), MAP.z0 - 10, MAP.z1 + 10)), ref: 10 },
      { id: 'a_bell', every: [70, 160], gain: 0.3, at: () => new V3(-39.6, 4, 0), ref: 14, roll: 0.8 },
      { id: 'a_goats', every: [35, 80], gain: 0.25, at: () => new V3(rand(50, 90), rand(4, 12), rand(-60, 60)), ref: 10, roll: 0.9 },
      { id: 'a_gust', every: [10, 24], gain: 0.35, dist: [4, 12], y: [2, 7] },
    ] },
  surfaces: NOTOS_SURFACES,
  kit: () => notosKit(),
  materials: (M) => makeNotosMaterials(M),
  // menu illustration (tools/dev/illustrations.js): plunging view from the open sea, to the northwest; the jetty chapel and its flag on the right
  // (the loading screen darkens the left), the caiques, the Marine and the village, the south mill and the mountain in the background
  art: { cam: [-52, 8.5, -12], look: [-8, 3.5, 6], fov: 54 },
  // landmarks for orientation (measured by tools/dev/visual/leveldesign.js): the dome of Sainte-Marina, the jetty chapel, the sail hub of the two mills
  landmarks: [[2.2, 8.6, 0, 'dome'], [-39.6, 5.9, 0, 'chapel'], [-10, 18.2, 50.6, 'south mill'], [-10, 18.2, -50.6, 'north mill']],
  splat: { x0: -52, z0: -70, w: 104, d: 140, ppm: 4 },
  far: 460,
  build() { notosLevel(); },
  after() { waterBuild({ deep: [0.0, 0.035, 0.12], shallow: [0.0, 0.1, 0.17], scatter: [0.01, 0.08, 0.13], foam: [0.82, 0.86, 0.86], refl: 1.0, floor: [2.6, 9, 28], abs: [0.45, 0.12, 0.04], sand: [0.55, 0.56, 0.56], caus: 1, foamK: 0.4 }); },
  ready() { waterReady({ from: [-60, MEL.wl + 2.5, 0] }); },
  update(t) { cyUpdateMills(t); },
  unload() { CYC.mill = null; CYC.holes = null; CYC.P = null; CYC.doors = null; CYC.noDoor = null; CYC.noWin = null; CYC.paintAt = null; },
  // Alpha team spawns (south); Bravo's are the mirror: shipyard, well courtyard behind the cistern, threshing floor
  spawns: [[-23.5, 42.5], [-20.5, 42.5], [-22.5, 40.5], [-16.5, 45.5], [-12.5, 46.5], [-9.5, 47.5], [-5.5, 46.5], [-1.5, 45.5], [1.5, 43.5], [6.5, 46.5], [13.5, 44.5], [17.6, 46.2], [19.5, 40.5], [26.5, 46.5], [26.5, 41.5]],
  /* Bot points of interest: [x, y, z, route, hold]; route L (Marine, tavern, shipyard), M (square, block, plazas), E (Apse alley, Chora, Terraces) */
  poi: [
    [-25.5, 0, 37.5, 'L'], [-25.5, 0, -37.5, 'L'], [-23.5, 0, 28.5, 'L', 1], [-23.5, 0, -28.5, 'L', 1], [-25, 0, 19, 'L'], [-25, 0, -19, 'L'], [-19, 3.5, 19, 'L', 1], [-19, 3.5, -19, 'L', 1],
    [-19, 0, 19, 'L', 1], [-19, 0, -19, 'L', 1], [-24.5, 0, 10.5, 'L', 1], [-24.5, 0, -10.5, 'L', 1], [-28, 0, 7, 'L'], [-28, 0, -7, 'L'], [-33, 0, 0, 'L', 1], [-18, 0, 9, 'L'], [-18, 0, -9, 'L'],
    [-8, 0, 7.5, 'M'], [-8, 0, -7.5, 'M'], [-11.5, 0, 8.5, 'M'], [-11.5, 0, -8.5, 'M'], [-5.5, 0, 6.5, 'M', 1], [-5.5, 0, -6.5, 'M', 1], [-15, 0, 15, 'M'], [-15, 0, -15, 'M'],
    [-3, 0, 14, 'M'], [-3, 0, -14, 'M'], [-8, 0, 21, 'M', 1], [-8, 0, -21, 'M', 1], [-7.5, 3.5, 26.5, 'M', 1], [-7.5, 3.5, -26.5, 'M', 1], [-9, 0, 34, 'M'], [-9, 0, -34, 'M'],
    [-13, 0, 30, 'M'], [-13, 0, -30, 'M'], [-6.5, 0, 36.5, 'M'], [-6.5, 0, -36.5, 'M'], [-7, 0, 41, 'M'], [-7, 0, -41, 'M'], [-1, 0, 41, 'M'], [-1, 0, -41, 'M'], [-1.5, 0, 17.5, 'M'], [-1.5, 0, -17.5, 'M'],
    [10, 0, 14.5, 'E'], [10, 0, -14.5, 'E'], [10, 0, 22, 'E'], [10, 0, -22, 'E'], [9, 0, 30, 'E'], [9, 0, -30, 'E'], [8.5, 0, 38.5, 'E'], [8.5, 0, -38.5, 'E'],
    [16, 0, 13, 'E'], [16, 0, -13, 'E'], [20, 0, 13, 'E'], [20, 0, -13, 'E'], [26, 0, 13, 'E'], [26, 0, -13, 'E'], [16, 0, 21, 'E'], [16, 0, -21, 'E'], [26, 0, 29, 'E'], [26, 0, -29, 'E'],
    [18, 3.5, 34, 'E', 1], [18, 3.5, -34, 'E', 1], [15.5, 3.5, 33.5, 'E', 1], [15.5, 3.5, -33.5, 'E', 1], [22, 3.5, 36, 'E', 1], [22, 3.5, -36, 'E', 1],
    [20, 0, 1, 'E', 1], [25, 0, 0, 'E', 1], [15, 0, 1, 'E'], [19.5, 0, 40, 'E'], [19.5, 0, -40, 'E'], [14, 0, 39.5, 'E'], [14, 0, -39.5, 'E'], [26.5, 0, 41.5, 'E'], [26.5, 0, -41.5, 'E'],
  ],
  // domination: A and C on the well plazas, in front of each base; B on the Plane Tree square, in the center
  dom: [[-10, 36], [-20, 0], [-10.5, -36]], // placed by the owner with the zones tool (?tool=zones, October 2026)
  mecha: [[-8.5, -5.5], [10, 17.5], [9.5, -17.5]], // mech drop zones (08f-mecha.js, mnavZones), placed the same way
  lane: (x) => (x < -19.5 ? 'L' : x > 12.5 ? 'E' : 'M'),
  sniper: [-19, 3.5, 19], // the tavern's flat roof: the whole Marine and the square in a straight line
  coverZ: 42,
  heli: [34, 52],
  cam: 50,
  // not on the planks of the pontoon, the bridges and the chapel: wood; in the courtyards: earth; elsewhere, slabs and pebbles
  surface: (p) => (p.x < -30 ? 'wood' : Math.abs(p.z) > 41 && p.x > -18 ? 'dirt' : 'concrete'),
  zones: [
    [_t('Alpha Base'), -30, 30, 40, 48], [_t('Bravo Base'), -30, 30, -48, -40],
    [_t('Pier chapel'), -42, -37.4, -2.4, 2.4], [_t('Pier'), -42, -30, -3, 3],
    [_t('Boatyard'), -30, -17, 39, 48], [_t('Boatyard'), -30, -17, -48, -39],
    [_t('Harbor tavern'), -22, -16, 14, 24], [_t('Harbor tavern'), -22, -16, -24, -14],
    [_t('Kafeneio'), -16, -12, -4, 4], [_t('St Marina church'), -4, 8.4, -4, 4],
    [_t('Plane Tree Square'), -16, -4, -12, 12], [_t('Well Square'), -16, -2, 28, 40], [_t('Well Square'), -16, -2, -40, -28],
    [_t('Arch Alley'), -12, 8, 20, 24], [_t('Arch Alley'), -12, 8, -24, -20],
    [_t('Block rooftop'), -12, -4, 22, 28], [_t('Block rooftop'), -12, -4, -28, -22],
    [_t('Harbor Street'), -16, -12, 12, 28], [_t('Harbor Street'), -16, -12, -28, -12], [_t('Spring Street'), -4, 0, 12, 28], [_t('Spring Street'), -4, 0, -28, -12],
    [_t('Apse Lane'), 8, 12, -40, 40],
    [_t('Terraces'), 12, 24, 30, 38], [_t('Terraces'), 12, 24, -38, -30],
    [_t('Threshing floor'), 8, 30, 40, 48], [_t('Threshing floor'), 8, 30, -48, -40],
    [_t('Waterfront'), -30, -20, -48, 48], [_t('Chora'), 12, 30, -40, 40], [_t('Alleys'), -20, 12, -40, 40],
  ],
  // computed sky (ATMO_NOTOS): the morning photo (kloofendal_48d, sun at 47°) until November 2026
  atmo: ATMO_NOTOS,
};
