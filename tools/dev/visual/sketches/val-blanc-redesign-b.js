/* Rework of Saint-Givre (map project, October 2026): high landmarks per half and one more floor. On the survey:
   MAP=saintgivre node tools/dev/visual/plan.js sketches/val-blanc-redesign-b.js -34 6 2 46
   Starting measurements (audits/saintgivre.json): landmark seen from 46.9 % of the ground (60 at least), elevated network 2.2 % (3 to 10).
   1. On the ledge of the west cliff (outside the play area, top of the rock at 15.5 m), one tower per half, same size (3.4 m on a side,
      top around 29 m): in the south (Alpha) the bell tower of the pass chapel, slate spire; in the north (Bravo) the lookout tower of the old
      fort, crenellations and flag. You know which side you are on by looking up. Measured (landmarkList.js): the pair seen from 72 % of the ground.
   2. In each goods hall, a storage mezzanine against the station wall (z 7 to 11.6, floor at 2.5 m), ramp of
      1.75 m along the east wall; its east window, raised to 2.75 m, looks onto the High Street and the north door of the hall (B). The platform
      door slides from z 10.5-13.5 to 12-15 (the mezzanine passed above it). The crates of the east wall (in the ramp) go under the mezzanine.
      Built: elevated network 2.2 % -> 3.3 %, landmark seen from 46.9 % -> over 60 %. */
module.exports = {
  naming: 'val-blanc-redesign-b',
  heading: 'Saint-Givre, landmark towers and hall mezzanine',
  mapKey: 'saintgivre',
  extent: [-34, 24, -48, 48],
  mirrorAxis: 'z',
  things: [
    { n: 'bell tower / fort tower (outside the play area, on the cliff)', x: -30.5, z: 40, w: 3.4, d: 3.4, h: 13.5, onScenery: true },
    { n: 'mezzanine (2.5 m)', poly: [[-8.7, 7.0], [-3.3, 7.0], [-3.3, 11.6], [-8.7, 11.6]], type: 'zone' },
    { rampSlope: [-5.05, -3.3, 11.6, 15.8] },
    { n: 'crates', x: -4.25, z: 8.3, w: 1.1, d: 1.1, h: 2.0, underCover: true },
  ],
  removals: [[-4.7, -3.5, 11.7, 12.9]],
  domination: [[-11.5, 33.5, 'A'], [-2, 0, 'B'], [-11.5, -33.5, 'C']],
};
