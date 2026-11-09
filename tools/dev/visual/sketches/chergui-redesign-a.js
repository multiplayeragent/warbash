/* Rework of Chergui (map project, October 2026): sightlines over 60 m and dead ends. On the survey of the built map:
   MAP=chergui node tools/dev/visual/plan.js sketches/chergui-redesign-a.js -40 40 -6 56
   Starting measurements (audits/chergui.json): 13.1 % of ground sightlines over 60 m (10 at most), 8 dead ends (2 at most).
   1. The sightlines over 60 m go through the openings in the middle: the arch of the Gate (x -32 to -28) onto the Long (the burnt car,
      low, let the view pass over it), the door of Main Street (x -4.1 to -1.6), and an east-west row at z = 14.5 through
      the Passage. The Long stays a sniper's street up to the Gate (about thirty meters from the base).
   2. Dead ends: the strip behind the base tent (the generator blocked its east exit), the northeast corner of the hangar (the forklift
      closed off a pocket against the walls), the corner of the backyard behind the dumpster, the underside of the landing of the House staircase.
   North half (Alpha), copied in mirror to the south. */
module.exports = {
  naming: 'chergui-redesign-a',
  heading: 'Chergui, long sightlines in the middle and dead ends',
  mapKey: 'chergui',
  extent: [-40, 40, -6, 56],
  mirrorAxis: 'z',
  things: [
    // 1. a truck stopped across in front of the Gate (x -33.2 to -25.8), in place of the burnt car: you go around it by both ends
    //    (1.6 m in the west, 1.9 m in the east); the "xbox" in front of the Doors takes a crate on top on its east half; a stack of crates of
    //    2.1 m at the exit of the Passage, in the container yard (the row at z = 14.5 ran all the way to the Long)
    { n: 'lorry', x: -29.5, z: 7.2, w: 7.4, d: 2.5, h: 3.1 },
    { n: 'tall crate', x: -2.2, z: 3.3, w: 0.9, d: 0.9, h: 1.9 },
    { n: 'crates (2.1 m)', x: 22.6, z: 15.15, w: 1.2, d: 2.4, h: 2.1 },
    // 2. the generator slides 2 m to the east: the strip behind the tent opens on both sides
    { n: 'generator', x: -11.5, z: 49.3, w: 1.9, d: 1.1, h: 1.4 },
    // the forklift leaves the corner of the hangar for the backyard; the dumpster goes to the back of the backyard, against the base
    { n: 'forklift', x: 30.5, z: 39.2, w: 1.6, d: 2.2, h: 1.5 },
    { n: 'skip', x: 34.9, z: 39.8, w: 2.0, d: 1.2, h: 1.4 },
    // under the landing of the House, three crates (the nook is no longer walkable)
    { n: 'crates', x: -15.3, z: 27.6, w: 1.1, d: 3.5, h: 1.1 },
  ],
  // the burnt car, the generator, the forklift, the former dumpster
  removals: [[-33.8, -31.2, 5.0, 9.0], [-14.45, -12.55, 48.75, 49.85], [33.2, 34.8, 27.5, 29.7], [33.1, 35.3, 36.4, 37.6]],
  domination: [[1, 31, 'A'], [11, 0, 'B'], [1, -31, 'C']],
};
