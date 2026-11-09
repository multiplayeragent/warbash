/* Rework of Port-Maël (map project, October 2026): points A, B, C, elevated network, dead ends. On the survey of the built
   map: MAP=portmael node tools/dev/visual/plan.js sketches/portmael-redesign-a.js -40 40 -6 52
   Starting measurements (audits/portmael.json): A and C seen from 11 spawns out of 12 of their camp (the base opens straight onto Harbor
   Street, A 7 m from its edge); B walkable at 42 % (70 at least: the sales floor, three 0.8 m tiers and their backrest wall);
   elevated network 3.9 % (5 to 12); 4 dead ends (2 at most).
   1. A and C move from (8, ±33) to (8.5, ±30.5), and a 2.1 m stack of crates across Harbor Street (x 5.4 to 7.6, z ±34) hides
      them from the base: 3 spawns out of 12 (4 at most). Measured before building (leveldesign.js, DOM=...).
   2. B stays in the middle of the sale: two 0.9 m tiers with no backrest wall (walkable), the "Ventes" sign hangs from the
      roof frame. 74 % walkable (leveldesign.js, which counts the tiers; plan.js only counts the ground: 58 %).
   3. The base container (x 18.5 to 24.5, z ±45.6) becomes a lookout over Harbor Street: loading ramp on the street side, landing on
      posts at roof level (2.6 m); the ground stays walkable under the landing. Elevated network 5.1 %.
   4. Dead ends: a stall fills the end of the strip between the Criée mezzanine staircase and the east wall (beyond it, the door at
      z = ±11); what remains is the end of the pile jetties of the bases, intended (2).
   North half (Alpha), copied in mirror to the south; the Criée (axis) in the middle. */
module.exports = {
  naming: 'portmael-redesign-a',
  heading: 'Port-Maël, points A, B, C, base lookout and dead ends',
  mapKey: 'portmael',
  extent: [-40, 40, -6, 52],
  mirrorAxis: 'z',
  things: [
    { n: 'crates (2.1 m)', x: 6.5, z: 34.0, w: 2.3, d: 1.2, h: 2.1 },
    { n: 'steps (0.4 and 0.8 m)', x: -5, z: 2.1, w: 10, d: 1.8, h: 0.8, underCover: true },
    { n: 'ramp to the container roof', rampSlope: [18.5, 23.4, 42.95, 44.35] },
    { n: 'landing on posts (2.6 m)', x: 24.5, z: 43.2, w: 2.2, d: 2.4, h: 2.6, onScenery: true },
    { n: 'stall', x: 7.6, z: 7.5, w: 1.1, d: 2.4, h: 0.9 },
  ],
  // the third tier and the backrest wall of the sale
  removals: [[-10, 0, 3.0, 3.85]],
  domination: [[8.5, 30.5, 'A'], [-3, 0, 'B'], [8.5, -30.5, 'C']],
};
