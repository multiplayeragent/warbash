/* ==========================================================================
   WEAPON SHAPES: extruded profiles, sections, trigger guards, cones, metal sighting parts
   The large volumes of a weapon (stock, receiver, handguard, grip, magazine) are side-view profiles, extruded over
   the width of the piece, with softened edges: a single-piece silhouette rather than boxes placed side by side.
   A profile is a sequence of points [z, y] in the weapon frame (the barrel points toward -z); a third number
   sets the rounding radius of that corner (0: sharp corner), otherwise it is the profile's default radius. The pieces of a weapon
   must all touch each other: tools/dev/visual/floating.js checks it (README, "Weapons, attachments and progression").
   ========================================================================== */
const PROF_GEO = new Map();
/* Traces the outline pts on a path (shape or hole), corners rounded by quadratic Bézier curves */
function profTrace(s, pts, rc) {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const P = pts[(i + n - 1) % n], V = pts[i], N = pts[(i + 1) % n], r0 = V.length > 2 ? V[2] : rc;
    const a = hyp(P[0] - V[0], P[1] - V[1]) || 1e-9, b = hyp(N[0] - V[0], N[1] - V[1]) || 1e-9, r = Math.min(r0, a * 0.5, b * 0.5);
    if (r < 1e-5) { if (i) s.lineTo(V[0], V[1]); else s.moveTo(V[0], V[1]); continue; }
    const sx = V[0] + (P[0] - V[0]) * r / a, sy = V[1] + (P[1] - V[1]) * r / a;
    if (i) s.lineTo(sx, sy); else s.moveTo(sx, sy);
    s.quadraticCurveTo(V[0], V[1], V[0] + (N[0] - V[0]) * r / b, V[1] + (N[1] - V[1]) * r / b);
  }
  s.closePath();
}
/* Geometry of a profile extruded over width w (centered at x = 0), edges rounded with radius r; holes: hollowed outlines */
function profGeo(pts, w, r, rc, holes) {
  const k = JSON.stringify([pts, w, r, rc, holes]);
  let geo = PROF_GEO.get(k); if (geo) return geo;
  const sh = new THREE.Shape(); profTrace(sh, pts, rc);
  if (holes) for (const h of holes) { const hp = new THREE.Path(); profTrace(hp, h, rc); sh.holes.push(hp); }
  r = Math.min(r, w * 0.45);
  const depth = Math.max(w - 2 * r, 0.0006);
  geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: r > 0.0003, bevelThickness: r, bevelSize: r, bevelOffset: -r, bevelSegments: 2, curveSegments: 4, steps: 1 });
  geo.translate(0, 0, -depth / 2); geo.rotateY(-Math.PI / 2); // shape (x, y) of the profile → (z, y) of the weapon, thickness along x
  // texture coordinates: planar mapping along the dominant face, one repeat every ~11 cm (like the rounded boxes)
  const P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv;
  for (let i = 0; i < P.count; i++) {
    const nx = Math.abs(N.getX(i)), ny = Math.abs(N.getY(i)), nz = Math.abs(N.getZ(i));
    if (nx >= ny && nx >= nz) U.setXY(i, P.getZ(i) * 9, P.getY(i) * 9); else if (ny >= nz) U.setXY(i, P.getX(i) * 9, P.getZ(i) * 9); else U.setXY(i, P.getX(i) * 9, P.getY(i) * 9);
  }
  geo.userData.low = { pts, w, rc, holes };
  PROF_GEO.set(k, geo); return geo;
}
/* Lightweight version of a profile (weapons seen from afar, shadows): same outline, no softened edges, corners with a simple bevel */
function profLow(geo) {
  const L = geo.userData.low, k = 'low' + JSON.stringify(L);
  let g = PROF_GEO.get(k); if (g) return g;
  const sh = new THREE.Shape(); profTrace(sh, L.pts, Math.min(L.rc, 0.004));
  if (L.holes) for (const h of L.holes) { const hp = new THREE.Path(); profTrace(hp, h, 0); sh.holes.push(hp); }
  g = new THREE.ExtrudeGeometry(sh, { depth: L.w, bevelEnabled: false, curveSegments: 1, steps: 1 });
  g.translate(0, 0, -L.w / 2); g.rotateY(-Math.PI / 2);
  PROF_GEO.set(k, g); return g;
}
/* Piece from a profile: pts [[z, y], ...], width w, center x, edge rounding r, rounding of the profile corners rc */
function prof(p, mat, pts, w, x = 0, r = 0.003, rc = 0.004, holes = null) { return part(p, profGeo(pts, w, r, rc, holes), mat, x, 0, 0, 1, 1, 1); }

/* Top of a profile outline, above y: the outline is traced and rounded the way profTrace does, then cut. For a piece that hugs
   the top of another (bridge of a cover between its two flanks) */
function profAbove(pts, rc, y) {
  const sh = new THREE.Shape(); profTrace(sh, pts, rc);
  const P = sh.getPoints(6).filter((q, i, a) => !i || q.distanceTo(a[i - 1]) > 1e-6), out = [];
  if (P.length > 1 && P[0].distanceTo(P[P.length - 1]) < 1e-6) P.pop();
  for (let i = 0; i < P.length; i++) {
    const A = P[i], B = P[(i + 1) % P.length];
    if (A.y >= y) out.push([A.x, A.y, 0]);
    if (A.y >= y !== B.y >= y) out.push([A.x + (B.x - A.x) * (y - A.y) / (B.y - A.y), y, 0]);
  }
  return out;
}

/* Trigger guard: D-shaped ring under the receiver, from zF (front) to zR (rear), from the top yTop (sunk into the receiver) to the bottom yBot,
   thickness th; the trigger passes through the empty space. The top of the empty space is yTop - hTop (the underside of the receiver). */
function guard(p, mat, zF, zR, yTop, yBot, th, hTop = 0.006, w = 0.006) {
  const rr = Math.min(0.014, Math.abs(yTop - yBot) * 0.45), ri = Math.max(0.001, rr - th);
  const outer = [[zF, yTop, 0], [zF, yBot, rr], [zR, yBot, rr], [zR, yTop, 0]];
  const hole = [[zF + th, yTop - hTop, 0.001], [zF + th, yBot + th, ri], [zR - th, yBot + th, ri], [zR - th, yTop - hTop, 0.001]];
  return prof(p, mat, outer, w, 0, Math.min(0.0015, w * 0.3), 0.002, [hole]);
}

/* Cone or tube oriented along z: rFront (-z side, toward the muzzle) and rRear (+z side, toward the shoulder), length len */
const CONE_GEO = new Map();
function cone(p, mat, x, y, z, rFront, rRear, len, seg = 20, open = false) {
  const k = rRear + '|' + rFront + '|' + seg + '|' + open;
  let geo = CONE_GEO.get(k); if (!geo) { geo = new THREE.CylinderGeometry(rRear, rFront, 1, seg, 1, open); CONE_GEO.set(k, geo); }
  return part(p, geo, mat, x, y, z, 1, len, 1, Math.PI / 2, 0, 0); // the top of the cylinder (rRear) faces +z
}

/* Piece of constant section along the barrel: outline pts [[x, y], ...] (seen from the front, a third number rounds that corner), from z0 (front)
   to z1, softened edges r; o.holes: hollowed outlines (window of an optic), o.rc: default corner rounding, o.seg: points per rounded
   corner, o.bev: segments of the softened edges */
const SEC_GEO = new Map();
function zSection(p, mat, pts, z0, z1, r = 0.001, o = {}) {
  const holes = o.holes || null, rc = o.rc != null ? o.rc : 0.0015, seg = o.seg || 3, bev = o.bev || 1;
  const k = JSON.stringify([pts, z1 - z0, r, holes, rc, seg, bev]);
  let geo = SEC_GEO.get(k);
  if (!geo) {
    const sh = new THREE.Shape(); profTrace(sh, pts, rc);
    if (holes) for (const h of holes) { const hp = new THREE.Path(); profTrace(hp, h, rc); sh.holes.push(hp); }
    const depth = Math.max(z1 - z0 - 2 * r, 0.0005);
    geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelOffset: -r, bevelSegments: bev, curveSegments: seg, steps: 1 });
    geo.translate(0, 0, -depth / 2);
    const P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv; // planar mapping, like profGeo
    for (let i = 0; i < P.count; i++) {
      const nx = Math.abs(N.getX(i)), ny = Math.abs(N.getY(i)), nz = Math.abs(N.getZ(i));
      if (nx >= ny && nx >= nz) U.setXY(i, P.getZ(i) * 9, P.getY(i) * 9); else if (ny >= nz) U.setXY(i, P.getX(i) * 9, P.getZ(i) * 9); else U.setXY(i, P.getX(i) * 9, P.getY(i) * 9);
    }
    geo.userData.sec = { pts, holes, rc, depth: z1 - z0 };
    SEC_GEO.set(k, geo);
  }
  return part(p, geo, mat, 0, 0, (z0 + z1) / 2, 1, 1, 1);
}
/* Lightweight version of a section (weapons seen from afar, shadows): same outline, no softened edges, corners with a simple bevel */
function secLow(geo) {
  const L = geo.userData.sec, k = 'low' + JSON.stringify(L);
  let g = SEC_GEO.get(k); if (g) return g;
  const sh = new THREE.Shape(); profTrace(sh, L.pts, Math.min(L.rc, 0.004));
  if (L.holes) for (const h of L.holes) { const hp = new THREE.Path(); profTrace(hp, h, Math.min(L.rc, 0.004)); sh.holes.push(hp); }
  g = new THREE.ExtrudeGeometry(sh, { depth: L.depth, bevelEnabled: false, curveSegments: 1, steps: 1 });
  g.translate(0, 0, -L.depth / 2);
  SEC_GEO.set(k, g); return g;
}

/* Ring on the z axis (ring, eyecup, round cover of an optic): radii rOut and rIn, from z0 (front) to z1, centered at (0, y), edges rounded
   by o.rr, o.seg segments; a revolution (LatheGeometry), smooth shaded, rather than an extruded section (facets visible up close, when aiming).
   o.cut: slanted front face, [ya, za, yb, zb] (two points of its outline seen from the side, weapon frame): each vertex moves forward or back
   all the more as it is near the front, the rear stays straight; the face normals take that of the plane, the sides keep
   theirs. Lightweight version: 12 segments, no rounding (lowPolyGeometry) */
const RING_GEO = new Map();
function ringGeo(rOut, rIn, z0, z1, y, rr, seg, cut) {
  const k = JSON.stringify([rOut, rIn, z1 - z0, rr, seg, cut, cut ? [z0, y] : 0]);
  let geo = RING_GEO.get(k); if (geo) return geo;
  const h = (z1 - z0) / 2, pts = [];
  const arc = (cr, cz, a0) => { for (let i = 0; i <= (rr > 0 ? 3 : 0); i++) { const a = a0 + i / 3 * Math.PI / 2; pts.push(new THREE.Vector2(cr + Math.cos(a) * rr, cz + Math.sin(a) * rr)); } };
  arc(rIn + rr, -h + rr, Math.PI); arc(rOut - rr, -h + rr, Math.PI * 1.5); arc(rOut - rr, h - rr, 0); arc(rIn + rr, h - rr, Math.PI / 2); pts.push(pts[0].clone());
  geo = new THREE.LatheGeometry(pts, seg); geo.rotateX(Math.PI / 2); // axis of the revolution (y): barrel axis, the rear toward +z
  if (cut) {
    const [ya, za, yb, zb] = cut, s = (za - zb) / (ya - yb), zc = (z0 + z1) / 2, L = hyp(1, s), P = geo.attributes.position, N = geo.attributes.normal;
    for (let i = 0; i < P.count; i++) {
      const z = P.getZ(i), w = (h - z) / (2 * h);
      P.setZ(i, z + w * (za + (P.getY(i) + y - ya) * s - zc + h));
      const nz = N.getZ(i);
      if (nz < 0) { const v = _v1.set(N.getX(i), N.getY(i) - nz * s / L, nz / L).normalize(); N.setXYZ(i, v.x, v.y, v.z); }
    }
    geo.computeBoundingBox(); geo.computeBoundingSphere();
  }
  geo.userData.ring = [rOut, rIn, z0, z1, y, 0, 12, cut];
  RING_GEO.set(k, geo); return geo;
}
function zRing(p, mat, rOut, rIn, z0, z1, y, o = {}) { return part(p, ringGeo(rOut, rIn, z0, z1, y, o.rr || 0, o.seg || 32, o.cut || null), mat, 0, y, (z0 + z1) / 2, 1, 1, 1); }

/* ---------- Metal sighting parts (assault rifles, submachine guns, shotguns) ----------
   When aiming, the eye is on the sight line (info.sightY), info.adsZ behind the weapon origin, and the first-person view has a vertical
   field of 44° (08-player.js): a piece of width w, at distance d from the eye, covers w / (IRON_K d) of the screen height. The
   strokes of the sighting parts are therefore sized as a fraction of the screen (IRON), so that a sight is equally fine from one weapon
   to another, the eye at 10 cm from the rear sight (MP5, M1014) or at 19 cm (M4A1). Owner feedback: circles too fat, strokes too
   thick, it has to be precise for aiming (the ring stroke covered from 1.4 to 5.7% of the screen height; at 0.55%, a
   hair too thin: 0.75%).
     ring   stroke of the rear sight ring (aperture)           foot   width of its post (foot), under the ring
     hole   aperture opening (inner diameter)                  wing   thickness of the rear sight wings
     post   width of the front sight, its tip on the sight line  ear    width of the front sight ears
   Floor: on phone (Low quality), the 3D image is about 300 pixels tall, without antialiasing; a 0.45% stroke keeps
   more than one pixel there. Check: node tools/dev/visual/weaponry.js --viewList ads. */
const IRON = { ring: 0.0075, foot: 0.035, wing: 0.009, post: 0.0045, ear: 0.0034, hole: { rifle: 0.095, smg: 0.13 } };
const IRON_K = 2 * Math.tan(THREE.MathUtils.degToRad(22));
/* Width of a piece placed at z (weapon frame) that covers the fraction f of the screen height when aiming */
function ironW(c, z, f) { return f * IRON_K * (c.info.adsZ - z); }
/* Aperture: ring on the z axis, inner radius r, stroke t, depth dep. Flat rear face with a sharp edge on the eye side, opening
   flared toward the front (beveled): its inner wall turns its back to the eye. Seen when aiming, a single crisp stroke of a single tint (a
   torus picks up highlights on its rounding and, with the eye at 10 cm, its inner wall thickens the stroke). Doubled corners in the profile:
   sharp edges, no averaged normals. */
const IRON_GEO = new Map();
function ironRingGeo(r, t, dep) {
  const k = [r, t, dep].map((v) => v.toFixed(5)).join('|');
  let geo = IRON_GEO.get(k); if (geo) return geo;
  const h = dep / 2, R = r + t, f = r + Math.min(t * 0.8, dep * 0.3);
  const P = [[R, -h], [R, h], [R, h], [r, h], [r, h], [f, -h], [f, -h], [R, -h]].map((q) => new THREE.Vector2(q[0], q[1]));
  geo = new THREE.LatheGeometry(P, 40); geo.rotateX(Math.PI / 2); // axis of the revolution (y): barrel axis, rear face toward the eye (+z)
  IRON_GEO.set(k, geo); return geo;
}
/* Places the aperture at z, centered on the sight line, with opening hole (fraction of the screen, IRON.hole), in M.sight (dark, matte and
   smooth, which the camouflage leaves black). Returns the bottom of its stroke, where to place its post or base (ironFoot) */
function ironRing(c, z, hole) {
  const t = ironW(c, z, IRON.ring), r = ironW(c, z, hole) / 2;
  part(c.g, ironRingGeo(r, t, 0.0025), c.M.sight, 0, c.info.sightY, z, 1, 1, 1);
  return c.info.sightY - r - t * 0.4;
}
/* Post of the aperture, at z: from y0 (sunk into its base) to the bottom of the ring stroke (y1, returned by ironRing), width IRON.foot */
function ironFoot(c, mat, z, y0, y1, dep) { return bx(c.g, mat, 0, (y0 + y1) / 2, z, ironW(c, z, IRON.foot), y1 - y0, dep); }

/* Pistol grip tilted backward: from its top (zT, yT, sunk into the receiver) to its bottom (zB, yB), depth d, width w;
   the curved back and the widened heel give the grip */
function gripProf(p, mat, zT, yT, zB, yB, d, w = 0.032, bulge = 0.003) {
  const dz = zB - zT, dy = yB - yT, L = hyp(dz, dy), ux = dz / L, uy = dy / L, nx = -uy, ny = ux, h = d / 2;
  const P = (t, off) => [zT + ux * t * L + nx * off, yT + uy * t * L + ny * off];
  return prof(p, mat, [P(0, -h), P(0, h), P(0.4, h + bulge), P(0.88, h + bulge * 0.4), P(1, h + 0.002, 0.004), P(1, -h - 0.001, 0.004), P(0.7, -h - bulge * 0.2), P(0.3, -h + bulge * 0.4)], w, 0, 0.003, 0.006);
}
