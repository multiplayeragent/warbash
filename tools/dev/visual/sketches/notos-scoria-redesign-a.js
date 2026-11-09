/* Rework of Notos and Scoria (map project, October 2026): point B of both maps. On the surveys of the built maps:
   MAP=notos node tools/dev/visual/plan.js sketches/notos-scoria-redesign-a.js -16 0 -10 10
   Notos, starting measurements (audits/notos.json): B not equal in walking distance (56.4 and 63 m, 5 apart at most). B is on the curb of the
   plane tree; the trunk collision (a 1.24 m square) closed the curb cells on either side of the axis, and the point's node
   held only on one side. Trunk as a 1.2 m octagon: 58.8 and 57.8 m, 75 % walkable. A fifth entrance then opened (the
   church forecourt): the planter at the northeast corner of the square (and southeast) goes away, the north and the forecourt make only one
   entrance: 3 entrances.
   Scoria (MAP=scoria, -30 0 -14 14): B has 5 entrances (2 to 4). The west moss planter (3.2 x 1.1 m across, z ±7.2) cut in two
   the northwest access and the north one; turned along the point's axis (1.1 x 3.2 m, z ±7.6): 3 entrances.
   What remains at Notos: 12 intersections on the shortest route (8 at most), which comes from the village's tight layout. */
module.exports = {
  naming: 'notos-scoria-redesign-a',
  heading: 'Notos and Scoria, point B',
  mapKey: 'notos',
  extent: [-16, 0, -10, 10],
  mirrorAxis: 'z',
  things: [
    { n: 'plane tree trunk (octagon)', x: -8.5, z: 0, w: 1.2, d: 1.2, h: 5 },
  ],
  // the planter at the corner of the square
  removals: [[-7.7, -6.7, 5.1, 6.9]],
  domination: [[-9, 34, 'A'], [-8.5, 0, 'B'], [-9, -34, 'C']],
};
