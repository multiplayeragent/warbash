/* Rework of Port-Maël (October 2026): the stairs of the ice factory. Owner feedback: "the first steps are way too close to the wall
   they face". On the survey of the built map:
     node tools/dev/visual/plan.js sketches/portmael-stairs-ice.js 13 30 -11 11
   Today, the two staircases run along the east wall (x 24.6 to 26.6) and go down from the middle (z ±2.2, upstairs, 3.8 m) to the back
   wall (z ±8.65): the last step touches the wall, you exit sideways. They cannot be shortened: 6.45 m for 3.8 m, the slope
   (0.59) is already close to the bots' limit (0.62 m per meter).
   Proposal: the two flights keep their length and slope but slide toward the middle, where their heads meet on a
   1.2 m walkway upstairs (z -0.6 to 0.6, instead of 4.4 m). The foot of each flight is at z ±7.05: 1.6 m of clear floor in front of the
   first step, up to the back wall and its door (x 21 to 23.6). Upstairs, the stairwell opening follows the flight; a slab covers the end of the
   strip (z ±7.05 to ±8.65), with a railing at the edge of the opening. On the ground, under the walkway, between the two heads, a
   1.2 m passage links the hall to the corridor along the east wall. North half, copied in mirror to the south. */
module.exports = {
  naming: 'portmael-stairs-ice',
  heading: 'Port-Maël, ice factory: stairs cleared from the back wall',
  mapKey: 'portmael',
  extent: [13, 30, -11, 11],
  mirrorAxis: 'z',
  things: [
    { n: 'staircase (goes up toward the middle, 3.8 m)', rampSlope: [24.6, 26.6, 0.6, 7.05] },
  ],
  // today's flights
  removals: [[24.6, 26.6, 2.2, 8.65]],
};
