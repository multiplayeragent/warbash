/* Rework of Saint-Givre (map project, October 2026): the border post yard, A, and the station hall, B. On the survey of the built
   map: MAP=saintgivre node tools/dev/visual/plan.js sketches/val-blanc-redesign-a.js -24 10 16 48 (the yard), ... -12 8 -9 9 (the hall)
   Starting measurements (audits/saintgivre.json): A seen from 10 Alpha spawns out of 12 (whoever takes it fires into the base), 19.8 m of walking
   from the base, 4 covers at 9 m, 2 entrances; B walkable at 67 % (the ticket counter takes up the middle of the hall), 5 doors in the hall.
   North half (Alpha), copied in mirror to the south; the hall (onAxis: true) is in the middle. */
const PI = Math.PI;
const woodCrate = (x, z, s = 1.0, o = {}) => ({ n: 'crates', x, z, w: s, d: s, h: 1.1, ...o });
module.exports = {
  naming: 'val-blanc-redesign-a',
  heading: 'Saint-Givre, the border post yard (A) and the hall (B)',
  mapKey: 'saintgivre',
  extent: [-24, 24, -48, 48],
  mirrorAxis: 'z',
  things: [
    // 1. the customs office: the yard is called "Border post yard" and had no post. It blocks the base's view of A (the
    //    west and center spawns), running north-south with a 1.4 m door (one more entrance for A), flat roof
    { n: 'customs house (3.2 m)', x: -11.25, z: 38.85, w: 4.5, d: 2.5, h: 3.2 },
    { n: 'customs house', x: -6.3, z: 38.85, w: 2.6, d: 2.5, h: 3.2 },
    { n: 'passage 1.4 m', poly: [[-9.0, 37.6], [-7.6, 37.6], [-7.6, 40.1], [-9.0, 40.1]], type: 'zone' },
    // 2. a pile of snowy logs east of the yard: screen against the east spawns (the High Street), high cover for A
    { n: 'logs (2.4 m)', x: -2.0, z: 37.2, w: 3.0, d: 1.6, h: 2.4 },
    // 3. covers in front of A, on the side where you arrive from the center (the tracks, the signal box passage): the defense holds in front of the point
    { n: 'luggage cart', x: -12.8, z: 29.4, w: 1.2, d: 2.4, h: 1.1 },
    woodCrate(-6.2, 34.3), woodCrate(-5.2, 34.4, 0.8),
    // 4. the hall: a smaller ticket counter (2.6 x 2.1 m instead of 3 x 2.6), and the east door is walled up (five doors, one too many to hold B)
    { n: 'ticket window 2.6 x 2.1', x: 1.3, z: 0, w: 2.6, d: 2.1, h: 2.6, onAxis: true },
    { n: 'east door walled up', x: 4.775, z: 0, w: 0.45, d: 2.4, h: 4.4, onAxis: true },
  ],
  // the bench placed in front of the customs office (a prop) is moved against its west facade, out of the passage; the old ticket counter; the east door of the hall
  removals: [[-9.3, -7.3, 39.0, 40.0], [-0.3, 2.7, -1.3, 1.3], [4.55, 5.0, -1.2, 1.2]],
  // A moves back 1.5 m to the west (the customs office takes the north of its disc); B in the middle of the hall, as before
  domination: [[-11.5, 33.5, 'A'], [-2, 0, 'B'], [-11.5, -33.5, 'C']],
  routes: [
    { n: 'L', pts: [[-15, 44], [-15.5, 34], [-14.5, 20], [-14.5, 8]] },
    { n: 'M', pts: [[-8.3, 42], [-8.3, 38.8], [-11.5, 33.5], [-6, 22], [-4, 9]] },
    { n: 'E', pts: [[6, 42], [2, 34], [1, 20], [2, 9]] },
  ],
};
