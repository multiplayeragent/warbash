/* Rework of Saint-Givre (map project, October 2026): the dead ends. On the survey of the built map:
   MAP=saintgivre node tools/dev/visual/plan.js sketches/val-blanc-redesign-c.js -26 26 -50 50
   Starting measurements (audits/saintgivre.json): 8 dead ends (2 at most), mirrored two by two:
   - (-23.5, ±47.5): the strip between the cliff and the base's flatbed wagon, which the wagon (z 37 to 49) closes against the back wall;
   - (-4.5, -10.5) and (-5.5, 9.5): under the mezzanine of the goods hall, the pocket between the head of the ramp, the east wall and the
     row of crates;
   - (7.5, ±10.5): in the Hôtel des Cimes, the corner between the fireplace, the table and the west wall;
   - (21.5, ±9.5): south of the Sawmill, behind the log pile of the Square chalet (the alley stops at the east wall).
   North half (Alpha), copied in mirror to the south. */
module.exports = {
  naming: 'val-blanc-redesign-c',
  heading: 'Saint-Givre, the dead ends',
  mapKey: 'saintgivre',
  extent: [-26, 26, 0, 50],
  mirrorAxis: 'z',
  things: [
    // 1. the wagons of the west track move back: the flatbed (12 m) from z 43 to 41, the tank car from 30.5 to 29.9 (next to the flatbed). Between the end of the flatbed and the back wall,
    //    1.4 m of passage: the strip behind the wagon joins the base by both ends
    { n: 'flatbed wagon', x: -19.6, z: 41.0, w: 2.7, d: 12.0, h: 2.4 },
    { n: 'tank car', x: -19.6, z: 29.9, w: 2.7, d: 10.2, h: 3.5 },
    { n: 'passage 1.4 m', poly: [[-24, 47.0], [-18.25, 47.0], [-18.25, 48.4], [-24, 48.4]], type: 'zone' },
    // 2. under the mezzanine, no more row of crates along the station wall: a single pile in the west corner (the pocket between the head of
    //    the ramp, the east wall and the row opens; what remains is the northeast corner of the hall, counted as a dead end: 2, the threshold)
    { n: 'crates', x: -8.05, z: 8.4, w: 1.1, d: 2.4, h: 2.0 },
    // 3. Hôtel des Cimes: the back table slides from z 11.6 to 12.6 (you pass between it and the fireplace)
    { n: 'table and chairs', x: 7.0, z: 12.6, w: 1.8, d: 2.0, h: 0.8 },
    // 4. the Square chalet loses its log pile on the Sawmill side, and the pile of planks across the back of the Sawmill goes away: the
    //    end of the 1.8 m alley opens onto the lean-to
    // 5. three spawns of the west front row move back (87.4 m of walking from one camp to the other, 90 at least): (-15, 41.5) to (-15, 43),
    //    (-10.5, 41.5) to (-10.5, 42.4), (-5, 41.2) to (-8.2, 44.2), west of the tent
  ],
  spawnPoints: { alpha: [[-15, 43.0], [-15.5, 46], [-10.5, 42.4], [-11.5, 45.5], [-8.2, 44.2], [0.5, 41.8], [3.4, 45.4], [5.5, 41.2], [13.5, 41.8], [15.5, 46.5], [20.8, 42.2], [20.5, 46.2]] },
  // the previous wagons and crates, the log pile
  removals: [[-21, -18.2, 37, 49], [-21, -18.2, 25.4, 35.6], [-8.55, -3.85, 7.7, 8.95], [6.0, 8.0, 10.8, 12.4], [18, 21, 9.42, 9.97], [21.9, 23.1, 6.1, 8.5]],
  domination: [[-11.5, 33.5, 'A'], [-2, 0, 'B'], [-11.5, -33.5, 'C']],
};
