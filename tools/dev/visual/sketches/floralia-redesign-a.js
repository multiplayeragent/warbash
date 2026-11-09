/* Rework of Floralia (map project, October 2026): points A and C, B, dead ends, walk from one camp to the other. On the survey of the built map:
   MAP=floralia node tools/dev/visual/plan.js sketches/floralia-redesign-a.js -38 38 12 50
   Starting measurements (audits/floralia.json): A and C seen from 16 spawns out of 18 (the bed alley opens straight onto the forecourt and the
   orangery bays), 2 covers at 9 m (6 at least); B seen from 3 spawns per camp (the passage between the two western beds
   runs straight to the greenhouse); 17 dead ends (2 at most); 87.5 m of walk from one camp to the other (90 at least).
   1. The alley becomes an alley lined with hornbeam hedges: the edge of the two middle beds, alley side, rises to 1.8 m (three sections of
      4 m per side, cut at the cross paths). A and C (0, ±30.8): seen from 3 spawns, 6 covers, 29.4 m from the base.
   2. A 3.2 m hedge on the west lawn (x -13.3 to -10.1, z ±18.7) cuts the spawns' view of B.
   3. Dead ends: the maze is braided (each cul-de-sac opens onto the neighboring cell); boxwood beds between the orangery and the sheds
      and behind the sheds (recesses closed by the perimeter wall); potting benches in the back corners of the orangery;
      rock in the two back alcoves of the grotto under the Rock. 17 down to 0.
   4. Two spawns of the west front row move back: (-8, 42.2) to (-6.5, 43.5), (-14.5, 42.4) to (-14.5, 43.5).
   North half (Alpha), copied in mirror to the south. */
module.exports = {
  naming: 'floralia-redesign-a',
  heading: 'Floralia, hedge alley, hidden B, dead ends',
  mapKey: 'floralia',
  extent: [-38, 38, 12, 50],
  mirrorAxis: 'z',
  things: [
    { n: 'hornbeam hedge (1.8 m)', x: -5.375, z: 28.7, w: 0.35, d: 4.0, h: 1.8 }, { n: 'hornbeam', x: -5.375, z: 33.7, w: 0.35, d: 4.0, h: 1.8 }, { n: 'hornbeam', x: -5.375, z: 38.7, w: 0.35, d: 4.0, h: 1.8 },
    { n: 'hornbeam hedge (1.8 m)', x: 5.375, z: 28.7, w: 0.35, d: 4.0, h: 1.8 }, { n: 'hornbeam', x: 5.375, z: 33.7, w: 0.35, d: 4.0, h: 1.8 }, { n: 'hornbeam', x: 5.375, z: 38.7, w: 0.35, d: 4.0, h: 1.8 },
    { n: 'B hornbeam hedge', x: -11.7, z: 18.65, w: 3.2, d: 0.5, h: 1.8 },
    { n: 'boxwood (1.6 m)', x: -19.0, z: 47.0, w: 3.4, d: 4.0, h: 1.6 }, { n: 'boxwood', x: 19.0, z: 47.0, w: 3.4, d: 4.0, h: 1.6 },
    { n: 'boxwood', x: -35.5, z: 47.0, w: 2.4, d: 4.0, h: 1.6 }, { n: 'boxwood', x: 35.5, z: 47.0, w: 2.4, d: 4.0, h: 1.6 },
    { n: 'workbench', x: -15.35, z: 48.4, w: 2.2, d: 2.15, h: 0.9 }, { n: 'workbench', x: 15.35, z: 48.4, w: 2.2, d: 2.15, h: 0.9 },
  ],
  spawnPoints: { alpha: [[-11.4, 45.6], [-10.0, 47.4], [0, 45.6], [2.3, 45.4], [11.4, 45.6], [12.6, 47.5], [-6.5, 43.5], [-4, 42.4], [4, 42.4], [8, 42.2], [-14.5, 43.5], [14.5, 42.4], [-20, 42.4], [20, 42.4], [-28.7, 46.2], [-25.5, 47.2], [26.3, 46.2], [29.5, 47.2]] },
  domination: [[0, 30.8, 'A'], [-12, 0, 'B'], [0, -30.8, 'C']],
};
