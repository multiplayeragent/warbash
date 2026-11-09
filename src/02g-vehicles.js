/* ==========================================================================
   VEHICLES: cars (sedan, city car, 4x4) and trucks (military hooded, cab-forward rigid, van and refrigerated), each in
   several versions (clean, dusty, burnt-out wreck; tarped, flatbed, loaded); bicycle, moped, burnt bus.
   Frame: length along z, front at -z, wheels set on y = 0. A model's collisions are described next to it (vehCols,
   kept on the prefab: pf.vcols) and placed by the map (vehicle): simple boxes that follow the body, the cabin, the cab and
   the flatbed, without exceeding what is seen.
   ========================================================================== */
const G_SPH = new THREE.SphereGeometry(1, 6, 4);
/* Quad whose normal is computed from its vertices, turned toward the side of out ([x, y, z]) */
function vQuad(M, mat, a, b, c, d, out) {
  const ux = c[0] - a[0], uy = c[1] - a[1], uz = c[2] - a[2], vx = d[0] - b[0], vy = d[1] - b[1], vz = d[2] - b[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = hyp3(nx, ny, nz) || 1;
  nx /= l; ny /= l; nz /= l; if (nx * out[0] + ny * out[1] + nz * out[2] < 0) { nx = -nx; ny = -ny; nz = -nz; }
  M.quad(mat, a, b, c, d, [nx, ny, nz]);
}
/* Wheel: tire (revolution profile) and rim; axis along x, center at (0, r, 0). o.side: +1 if the outer face looks toward +x;
   o.rim: rim tint; o.hub: 'disc' (solid pierced hubcap), 'steel' (steel rim, lug nuts), 'army' (hollow rim, big hub,
   bolt circle); o.tread: number of lugs around the circumference (off-road tire, the relief shows on the silhouette); o.tire: tire
   tint (dust); o.noTire: rim alone (wreck) */
function wheel(M, r, w, o = {}) {
  const hw = w / 2, s = -(o.side || 1), k = r / 0.33;
  M.save().move(0, r, 0).rotZ(Math.PI / 2);
  if (!o.noTire) {
    M.color(o.tire || [1, 1, 1]); M.uvS = 1;
    const prof = [[r * 0.62, -hw], [r * 0.93, -hw - 0.006], [r, -hw * 0.5], [r, hw * 0.5], [r * 0.93, hw + 0.006], [r * 0.62, hw]];
    if (o.tread) {
      // lugs: the tread is hollowed into chevrons (two vertices per lug, out of phase toward the edges)
      const nb = o.tread, d = 0.03 * k, rows = prof.length - 1;
      M.surf('rubber', nb * 2, rows, (u, v) => {
        const f = v * rows, j = Math.min(rows - 1, Math.floor(f)), t = f - j, a = prof[j], b = prof[j + 1], ax = lerp(a[1], b[1], t);
        const band = 1 - smoothstep(0.55, 0.95, Math.abs(ax) / hw), rr = lerp(a[0], b[0], t) - d * band * (0.5 + 0.5 * Math.cos((u * nb + (Math.abs(ax) / hw) * 0.45) * TAU));
        return [Math.cos(u * TAU) * rr, ax, Math.sin(u * TAU) * rr];
      }, { closeU: true, flipN: true, uL: TAU * r * 1.4, vL: w });
    } else M.lathe('rubber', prof, 16, { sharp: 0.45, uR: r * 1.4 });
  }
  M.color(o.rim || [0.6, 0.6, 0.6]);
  // outer face of the rim on the o.side side; after the rotation, local +y points toward -x
  M.lathe('steel', [[0, -s * (hw - 0.03)], [r * 0.62, -s * (hw - 0.03)], [r * 0.62, s * (hw - 0.03)], [r * 0.55, s * (hw - 0.05)], [r * 0.35, s * (hw - 0.02)], [0, s * (hw - 0.025)]], 12, { sharp: 0.5 });
  const face = (y) => { M.save().move(0, s * y, 0); if (s < 0) M.rotX(Math.PI); }; // frame set on the face, +y outward
  if (o.hub === 'disc') {
    face(hw - 0.035); M.cyl('steel', r * 0.5, 0.012, 12, { caps: 't' }); M.color([0.08, 0.08, 0.08]); M.cls = 2;
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; M.save().move(Math.cos(a) * r * 0.42, 0.012, Math.sin(a) * r * 0.42).rotY(-a); M.boxB('dark', -0.012, 0.012, 0, 0.002, -0.035, 0.035); M.restore(); }
    M.cls = 0; M.restore();
  } else if (o.hub === 'steel' || o.hub === 'army') {
    const big = o.hub === 'army', n = big ? 6 : 4;
    face(hw - (big ? 0.06 : 0.03)); M.cyl('steel', r * (big ? 0.22 : 0.14), big ? 0.08 : 0.03, 8, { r1: r * (big ? 0.17 : 0.12), caps: 't' });
    M.color([0.2, 0.2, 0.18]); M.cls = 2;
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU; M.save().move(Math.cos(a) * r * (big ? 0.3 : 0.2), 0, Math.sin(a) * r * (big ? 0.3 : 0.2)); M.cyl('steel', big ? 0.022 : 0.012, big ? 0.04 : 0.02, 5, { caps: 't' }); M.restore(); }
    if (big) M.tube('steel', 0.014, Array.from({ length: 13 }, (_, i) => [Math.cos((i / 12) * TAU) * r * 0.57, 0.03, Math.sin((i / 12) * TAU) * r * 0.57]), 3);
    M.cls = 0; M.restore();
  }
  M.restore();
}

/* ---------- Cars ---------- */
/* (5.1, owner feedback, with photos: cars too angular, windows badly placed. The body is redone as a continuous surface
   with rounded edges and corners, the glazing as a second surface set on the body shoulder, cut into door windows, pillars and
   roof; glossy, varnished paint) */
/* Car spec sheets (carBuild, carGeo). Body: ends zf and zr, half-width w, wheels (radius r, width tw, track tx, axles ax), wheel arches
   (radius ra), body bottom yb (yf under the front bumper, yr under the rear), widest line ym, top line top ([z, y]:
   bumper, hood, beltline, tailgate or trunk; smoothed), section squareness n (2: ellipse, larger: squarer), end roundings
   [front, rear]: rc (corners seen from above), rt (upper lip), rb (lower lip).
   gh, glazing: windshield from wz0 to wz1, roof up to rz1 (top y1 at the front, y1r at the rear), rear window up to bz; ins (setback of the foot of the
   windows on the shoulder), b1 (half-width of the roof), rg (radius of the roof corners), cr (camber), win (side windows [z0, z1]: the
   first starts from the foot of the front pillar and follows the windshield, the one that goes behind rz1 follows the rear window), noir (black pillars and
   surrounds; otherwise body-colored pillars and chrome seals), seat (front seat and bench backs, z).
   Trim placed on the body surface: head, tail (lights: half-widths x0 to x1, heights y0 to y1, wrapped around the corners),
   grille (radiator grille x, y0, y1, chrome), intake (low air intake x, y0, y1), plate (bottom of the plates [front, rear]), lip (black lip at the
   bottom of the bumpers, height), clad (molding [bottom, top, tint]), seams (door seams, z), handles (handles, z; at handleY), mirror
   (mirror z), hub and rim (hubcap, rim tint), chrome (chrome window seals and handles), flare (black fender flares,
   thickness), rails (roof rails, tint), skid (gray skid plates), bumper (add-on bumpers [bottom, top, projection]) */
const CAR_SPECS = {
  // 80s sedan (4.4 m): three volumes, long flat hood, trunk, body-colored pillars, chrome seals, add-on bumpers
  sedan: {
    zf: -2.2, zr: 2.2, w: 0.88, r: 0.37, tw: 0.22, tx: 0.765, ax: [-1.4, 1.42], ra: 0.4, yb: 0.3, yf: 0.3, yr: 0.32, ym: 0.62, n: 5,
    top: [[-2.2, 0.76], [-1.95, 0.81], [-1.3, 0.85], [-0.9, 0.88], [0.2, 0.9], [1.4, 0.91], [2.0, 0.9], [2.2, 0.87]],
    rc: [0.2, 0.2], rt: [0.07, 0.08], rb: [0.06, 0.06],
    gh: { wz0: -0.88, wz1: -0.22, rz1: 0.76, bz: 1.38, y1: 1.4, y1r: 1.39, ins: 0.06, b1: 0.71, rg: 0.05, cr: 0.025, win: [[-0.76, 0.14], [0.26, 1.1]], noir: false, seat: [0.26, 0.86] },
    bumper: [0.3, 0.5, 0.07], head: { x0: 0.34, x1: 0.78, y0: 0.58, y1: 0.73 }, grille: { x: 0.28, y0: 0.52, y1: 0.76, chrome: true },
    tail: { x0: 0.4, x1: 0.82, y0: 0.6, y1: 0.8 }, plate: [0.34, 0.62], clad: [0.36, 0.5, [0.3, 0.3, 0.3]], seams: [-0.86, 0.2, 1.16], handles: [-0.3, 0.86], mirror: -0.72, hub: 'disc', chrome: true,
  },
  // city car (3.9 m, after the Clio): short, plunging hood, steeply raked windshield, beltline that rises toward the rear, black
  // pillars, big body-colored rear pillar, thin lights wrapped around the corners, high taillights on the fenders
  hatch: {
    zf: -1.95, zr: 1.95, w: 0.85, r: 0.34, tw: 0.21, tx: 0.74, ax: [-1.22, 1.3], ra: 0.375, yb: 0.28, yf: 0.22, yr: 0.3, ym: 0.62, n: 3.4,
    top: [[-1.95, 0.72], [-1.75, 0.82], [-1.35, 0.9], [-0.9, 0.95], [-0.5, 0.955], [0.6, 0.98], [1.05, 1.0], [1.3, 1.05], [1.72, 1.04], [1.95, 1.0]],
    rc: [0.36, 0.32], rt: [0.11, 0.2], rb: [0.1, 0.1],
    gh: { wz0: -0.9, wz1: -0.08, rz1: 1.2, bz: 1.74, y1: 1.42, y1r: 1.37, ins: 0.07, b1: 0.64, rg: 0.07, cr: 0.035, win: [[-0.76, 0.1], [0.2, 1.02]], noir: true, seat: [0.22, 1.0] },
    head: { x0: 0.42, x1: 0.8, y0: 0.72, y1: 0.8 }, grille: { x: 0.36, y0: 0.5, y1: 0.68 }, intake: { x: 0.58, y0: 0.3, y1: 0.4 },
    tail: { x0: 0.46, x1: 0.84, y0: 0.86, y1: 0.97 }, plate: [0.36, 0.64], lip: 0.06, clad: [0.3, 0.37, [0.07, 0.07, 0.07]], seams: [-0.86, 0.15, 1.08], handles: [-0.22, 0.9], handleY: 0.86, mirror: -0.74, hub: 'disc', rim: [0.22, 0.22, 0.24],
  },
  // small family SUV (4.3 m, after the Dacia Duster): tall body, ground clearance, black fender flares and rocker panels, gray skid plates,
  // roof rails, quarter window behind the rear door, body-colored rear pillar, almost vertical tailgate, gray steel rims
  suv: {
    zf: -2.16, zr: 2.16, w: 0.9, r: 0.39, tw: 0.24, tx: 0.77, ax: [-1.33, 1.34], ra: 0.43, yb: 0.44, yf: 0.4, yr: 0.44, ym: 0.78, n: 3.6,
    top: [[-2.16, 0.86], [-1.95, 0.97], [-1.55, 1.03], [-1.05, 1.07], [-0.6, 1.075], [1.0, 1.09], [1.95, 1.1], [2.16, 1.08]],
    rc: [0.34, 0.28], rt: [0.13, 0.12], rb: [0.12, 0.1],
    gh: { wz0: -1.05, wz1: -0.28, rz1: 1.84, bz: 2.06, y1: 1.64, y1r: 1.61, ins: 0.08, b1: 0.7, rg: 0.07, cr: 0.03, win: [[-0.92, 0.3], [0.42, 1.24], [1.34, 1.82]], noir: true, seat: [0.42, 1.5] },
    head: { x0: 0.42, x1: 0.84, y0: 0.88, y1: 0.98 }, grille: { x: 0.38, y0: 0.72, y1: 0.96 }, intake: { x: 0.5, y0: 0.52, y1: 0.62 },
    tail: { x0: 0.58, x1: 0.88, y0: 0.92, y1: 1.05 }, plate: [0.66, 0.8], clad: [0.44, 0.62, [0.07, 0.07, 0.07]], seams: [-0.98, 0.36, 1.3], handles: [0.14, 1.06], handleY: 0.98,
    mirror: -0.96, hub: 'steel', rim: [0.7, 0.71, 0.72], flare: 0.05, rails: [0.1, 0.1, 0.1], skid: true,
  },
  // compact minivan (4.4 m, after the Renault Scénic): one-stroke silhouette, short hood, steeply raked windshield that starts far
  // front, small front quarter window, high roof, nearly upright tailgate
  mpv: {
    zf: -2.18, zr: 2.18, w: 0.88, r: 0.37, tw: 0.23, tx: 0.76, ax: [-1.38, 1.36], ra: 0.41, yb: 0.34, yf: 0.28, yr: 0.32, ym: 0.7, n: 3.4,
    top: [[-2.18, 0.76], [-1.95, 0.86], [-1.65, 0.93], [-1.42, 0.96], [-0.5, 0.97], [1.2, 1.0], [1.95, 1.03], [2.18, 1.0]],
    rc: [0.38, 0.3], rt: [0.14, 0.14], rb: [0.1, 0.1],
    gh: { wz0: -1.42, wz1: -0.42, rz1: 1.92, bz: 2.1, y1: 1.62, y1r: 1.58, ins: 0.07, b1: 0.68, rg: 0.08, cr: 0.04, win: [[-1.3, -1.0], [-0.92, 0.3], [0.42, 1.3], [1.42, 1.9]], noir: true, seat: [0.4, 1.6] },
    head: { x0: 0.4, x1: 0.84, y0: 0.76, y1: 0.86 }, grille: { x: 0.3, y0: 0.62, y1: 0.72, chrome: true }, intake: { x: 0.56, y0: 0.36, y1: 0.48 },
    tail: { x0: 0.6, x1: 0.86, y0: 0.84, y1: 0.97 }, plate: [0.5, 0.66], lip: 0.06, clad: [0.4, 0.48, [0.12, 0.12, 0.12]], seams: [-0.98, 0.3, 1.34], handles: [0.06, 1.08], handleY: 0.9,
    mirror: -1.12, hub: 'disc', chrome: true,
  },
  // family crossover (4.4 m, after the Peugeot 3008): tall, curved body, plunging hood, rising beltline, roof that
  // slopes down onto a raked rear window, small quarter window, high taillights on the fenders, black rocker panels, alloy rims
  cross: {
    zf: -2.2, zr: 2.2, w: 0.9, r: 0.39, tw: 0.24, tx: 0.77, ax: [-1.32, 1.33], ra: 0.42, yb: 0.4, yf: 0.32, yr: 0.38, ym: 0.76, n: 3.5,
    top: [[-2.2, 0.84], [-1.95, 0.93], [-1.55, 0.99], [-1.15, 1.02], [-0.4, 1.04], [0.9, 1.09], [1.5, 1.13], [1.98, 1.12], [2.2, 1.06]],
    rc: [0.36, 0.32], rt: [0.12, 0.15], rb: [0.12, 0.1],
    gh: { wz0: -1.15, wz1: -0.3, rz1: 1.36, bz: 1.98, y1: 1.62, y1r: 1.54, ins: 0.09, b1: 0.66, rg: 0.07, cr: 0.035, win: [[-1.0, 0.26], [0.38, 1.18], [1.28, 1.58]], noir: true, seat: [0.36, 1.3] },
    head: { x0: 0.44, x1: 0.86, y0: 0.84, y1: 0.93 }, grille: { x: 0.42, y0: 0.6, y1: 0.86, chrome: true }, intake: { x: 0.6, y0: 0.4, y1: 0.5 },
    tail: { x0: 0.5, x1: 0.88, y0: 0.92, y1: 1.04 }, plate: [0.46, 0.76], lip: 0.07, clad: [0.4, 0.53, [0.08, 0.08, 0.08]], seams: [-1.0, 0.32, 1.26], handles: [0.08, 1.02], handleY: 0.95,
    mirror: -1.02, hub: 'disc', rim: [0.6, 0.61, 0.63], chrome: true,
  },
};
/* Smoothed line (corners cut, Chaikin), endpoints kept */
function carChaikin(P, it) {
  for (let k = 0; k < it; k++) {
    const Q = [P[0]];
    for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1]; Q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }
    Q.push(P[P.length - 1]); P = Q;
  }
  return P;
}
/* Height of a line [z, y] (increasing z) at z */
function carPoly(P, z) {
  if (z <= P[0][0]) return P[0][1];
  for (let i = 1; i < P.length; i++) if (z <= P[i][0]) { const a = P[i - 1], b = P[i]; return lerp(a[1], b[1], (z - a[0]) / (b[0] - a[0] || 1)); }
  return P[P.length - 1][1];
}
/* Body section s (superellipse of squareness s.n): half-width at height y, height of the top at abscissa x */
function carXAt(s, y) { const t = y >= s.ym ? (y - s.ym) / (s.yt - s.ym) : (s.ym - y) / (s.ym - s.yb); return t >= 1 ? 0 : s.w * Math.pow(1 - Math.pow(t, s.n), 1 / s.n); }
function carYTop(s, x) { const t = Math.abs(x) / s.w; return t >= 1 ? s.ym : s.ym + (s.yt - s.ym) * Math.pow(1 - Math.pow(t, s.n), 1 / s.n); }
/* Shapes of a car from its spec sheet (kept on the sheet): sec(z) body section (rounded ends, underside following the wheel arches),
   xAt and yTop, window base (b0, yBase), roofline (yRoof), half-profile of the glazing along z (gh: 6 side points, 3 corner points,
   4 roof points) */
function carGeo(S) {
  if (S._geo) return S._geo;
  const g = S.gh, cy = S.r + 0.02, top = carChaikin(S.top, 3);
  const cut = (d, r) => (d >= r ? 0 : r - Math.sqrt(Math.max(0, r * r - (r - d) * (r - d)))); // quarter-circle setback of radius r, at d from the end
  const sec = (z) => {
    const k = z - S.zf < S.zr - z ? 0 : 1, d = Math.max(0, k ? S.zr - z : z - S.zf);
    let yb = (z < S.ax[0] ? S.yf : z > S.ax[1] ? S.yr : S.yb) + cut(d, S.rb[k]);
    for (const az of S.ax) { const dz = Math.abs(z - az); if (dz < S.ra) yb = Math.max(yb, cy + Math.sqrt(S.ra * S.ra - dz * dz)); }
    const yt = carPoly(top, z) - cut(d, S.rt[k]);
    return { z, w: S.w - cut(d, S.rc[k]), yb, yt, ym: clamp(Math.max(S.ym, yb + 0.08), yb + 0.02, yt - 0.04), n: S.n };
  };
  const xAt = (y, z) => carXAt(sec(z), y), yTop = (x, z) => carYTop(sec(z), x), b0 = (z) => sec(z).w - g.ins, yBase = (z) => yTop(b0(z), z) - 0.004;
  const roof = carChaikin([[g.wz0, sec(g.wz0).yt - 0.01], [g.wz1, g.y1], [g.rz1, g.y1r], [g.bz, sec(g.bz).yt - 0.01]], 3), yRoof = (z) => carPoly(roof, z);
  const belt = yBase((g.wz1 + g.rz1) / 2), slope = (S.w - g.ins - g.b1) / (g.y1 - belt); // (window inset per meter of height)
  const gh = (z) => {
    const yb = yBase(z), xb = b0(z), yT = Math.max(yb, yRoof(z) - g.cr), rc = Math.min(g.rg, yT - yb), L = yT - rc - yb, f = Math.min(1, L / 0.06), xT = xb - slope * L - rc;
    const P = [0, 0.02 * f, lerp(0.02 * f, L - 0.03 * f, 1 / 3), lerp(0.02 * f, L - 0.03 * f, 2 / 3), L - 0.03 * f, L].map((h) => [xb - slope * h, yb + h]);
    for (let i = 1; i <= 3; i++) { const a = (i / 3) * (Math.PI / 2); P.push([xT + rc * Math.cos(a), yT - rc + rc * Math.sin(a)]); }
    for (const x of [xT - 0.035, (xT - 0.035) * (2 / 3), (xT - 0.035) / 3, 0]) P.push([x, yT + g.cr * (1 - (x / xT) ** 2)]);
    return P;
  };
  return (S._geo = { sec, xAt, yTop, b0, yBase, yRoof, belt, gh, cy });
}
/* Mud splashed on the flanks: a thin plate of dirt with a jagged top edge, between the wheel arches
   (segs: [[z0, z1], ...]); from y0 to the top edge (toward y1), on both sides of a body of half-width w (2.2 cm above the sheet metal:
   the protective side moldings are 1.4) */
function mudSkirt(M, w, segs, y0, y1, seed) {
  const R = rngOf(seed);
  M.save().color([0.5, 0.43, 0.35]); M.cls = 1;
  for (const sd of [-1, 1]) for (const [z0, z1] of segs) {
    const n = Math.max(2, Math.round((z1 - z0) / 0.07)), pts = [[z0, y0], [z1, y0]], low = y0 + (y1 - y0) * 0.3, ph = R() * TAU;
    for (let i = n; i >= 0; i--) { const z = lerp(z0, z1, i / n), k = 0.5 + 0.28 * Math.sin(z * 9 + ph) + 0.22 * (R() - 0.5); pts.push([z, i === 0 || i === n ? low : y0 + (y1 - y0) * clamp(k, 0.3, 1)]); }
    M.save().move(sd * (w + 0.022) + (sd > 0 ? 0.004 : 0), 0, 0).rotY(-Math.PI / 2); M.extrude('dirt', pts, 0.004, { sharp: 0.2 }); M.restore();
  }
  M.restore();
}
/* Cabin seen behind the windows (car frame, front toward -z): dark trim at beltline height (the body is solid
   below), dashboard under the windshield, steering wheel on the left (driver's seat in France), front seats and rear bench with their
   headrests, at glazing height. o: x (interior half-width), za and zb (bottom of the windshield and rear window), Y0(z) and Y1(z)
   (beltline and roof), zSeat (front seatbacks), zRear (rear bench backrest), dash (dashboard depth), noFloor (without the flat
   floor: the car lays its own on its curved body top) */
function carInterior(M, o) {
  const { x, za, zb, Y0, Y1 } = o, fab = [0.075, 0.075, 0.08], trimI = [0.045, 0.045, 0.05]; // (dark: the cabin is in the shade of the roof)
  M.save(); M.cls = 1;
  // trim: a dark floor laid on the body, from the dashboard to the rear shelf (above the body top)
  if (!o.noFloor) { M.color(trimI); vQuad(M, 'dark', [-x, Y0(za) + 0.03, za], [x, Y0(za) + 0.03, za], [x, Y0(zb) + 0.03, zb], [-x, Y0(zb) + 0.03, zb], [0, 1, 0]); }
  // dashboard and steering wheel
  const yd = Y0(za) + 0.03, hd = Math.min(0.16, (Y1(za + o.dash) - Y0(za)) * 0.3);
  M.color(trimI); M.boxB('plastic', -x + 0.02, x - 0.02, yd, yd + hd, za + 0.02, za + o.dash, { bevel: 0.03 });
  // steering wheel: centered just above the beltline (its lower half is under the trim), tilted toward the driver (o.wheelR: radius)
  { const cx = -x * 0.5, cy = yd + 0.05, cz = za + o.dash + 0.08, r = o.wheelR || 0.17, pts = [];
    for (let i = 0; i <= 16; i++) { const a = (i / 16) * TAU; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9, cz + Math.sin(a) * r * 0.42]); }
    M.color([0.05, 0.05, 0.05]); M.tube('rubber', 0.018, pts, 5); M.tube('plastic', 0.02, [[cx, cy, cz], [cx, yd + hd * 0.5, za + o.dash - 0.04]], 5); M.save().move(cx, cy, cz).rotX(Math.PI / 2 - 0.4); M.cyl('plastic', 0.045, 0.03, 8); M.restore(); }
  // seats: backrest and headrest, at the height the roof allows
  const seat = (sx, w, z) => {
    const y0 = Y0(z) + 0.03, room = Y1(z) - y0, hb = room * 0.48, hh = room * 0.72;
    M.color(fab); M.save().move(sx, y0 - 0.05, z).rotX(0.16); M.boxB('canvas', -w / 2, w / 2, 0, hb, -0.06, 0.06, { bevel: 0.04 }); M.restore();
    for (const hx of w > 0.9 ? [-0.42, 0, 0.42] : [0]) { M.save().move(sx + hx, y0, z + 0.02).rotX(0.16); M.boxB('canvas', -0.12, 0.12, hb + 0.03, hh, -0.05, 0.05, { bevel: 0.03 }); M.restore(); }
  };
  for (const sx of [-x * 0.5, x * 0.5]) seat(sx, Math.min(0.5, x * 0.62), o.zSeat);
  if (o.zRear > o.zSeat + 0.4) seat(0, x * 1.7, o.zRear);
  M.restore();
}
/* Hollowed cabin of a block-style cab (4x4, trucks; vehicle frame, front toward -z): thin walls from yb to yt around the perimeter of
   [-X, X] x [z0, z1], pierced where the windows are, so the cabin shows behind them. wins: [face, a0, a1, y0, y1], face 'g' and
   'd' (flanks at x = -X and +X, a along z), 'av' and 'ar' (faces at z0 and z1, a along x). The underside (beltline) and the roof are
   the vehicle's; rc: rounded rear corners (the flanks and rear face stop at rc from the corner, the vehicle lays its own roundings).
   Returns the interior half-width */
function cabShell(M, mat, X, yb, yt, z0, z1, wins, th = 0.05, rc = 0) {
  const draw = (f, a0, a1, y0, y1) => {
    if (a1 - a0 < 0.005 || y1 - y0 < 0.005) return;
    if (f === 'g') M.boxB(mat, -X, -X + th, y0, y1, a0, a1); else if (f === 'd') M.boxB(mat, X - th, X, y0, y1, a0, a1);
    else if (f === 'av') M.boxB(mat, a0, a1, y0, y1, z0, z0 + th); else M.boxB(mat, a0, a1, y0, y1, z1 - th, z1);
  };
  const face = (f, A0, A1) => {
    const W = wins.filter((w) => w[0] === f), uniq = (v) => [...new Set(v.map((a) => +a.toFixed(4)))].sort((p, q) => p - q);
    const as = uniq([A0, A1, ...W.flatMap((w) => [clamp(w[1], A0, A1), clamp(w[2], A0, A1)])]), ys = uniq([yb, yt, ...W.flatMap((w) => [clamp(w[3], yb, yt), clamp(w[4], yb, yt)])]);
    for (let j = 0; j < ys.length - 1; j++) { // one row at a time, adjacent solid cells merged into a single wall
      const ym = (ys[j] + ys[j + 1]) / 2; let run = null;
      for (let i = 0; i < as.length - 1; i++) {
        const am = (as[i] + as[i + 1]) / 2, hole = W.some((w) => am > w[1] && am < w[2] && ym > w[3] && ym < w[4]);
        if (hole) { if (run !== null) draw(f, run, as[i], ys[j], ys[j + 1]); run = null; } else if (run === null) run = as[i];
      }
      if (run !== null) draw(f, run, as[as.length - 1], ys[j], ys[j + 1]);
    }
  };
  face('g', z0, z1 - rc); face('d', z0, z1 - rc); face('av', -X + th, X - th); face('ar', -X + Math.max(th, rc), X - Math.max(th, rc));
  return X - th;
}
/* Body of a car from its spec sheet (carGeo). o.dust: matte paint dirtied at the bottom (paint material, mud at the base), dusty windows
   and tires; o.wreck: burnt-out wreck (burnt sheet metal, rust, no windows or tires, sagging on its rims, empty cabin and bare seats) */
function carBuild(M, P, S, o) {
  const wreck = !!o.wreck, body = wreck || o.dust ? 'paint' : 'carpaint', lo = wreck ? -S.r * 0.38 : 0, g = S.gh, G = carGeo(S), { sec, cy } = G;
  const trim = wreck ? [0.16, 0.15, 0.14] : [0.035, 0.035, 0.04], chrome = wreck ? [0.26, 0.23, 0.2] : S.chrome ? [0.85, 0.85, 0.85] : trim;
  const glassC = o.dust ? [0.6, 0.57, 0.52] : [0.2, 0.23, 0.26], rust = [0.3, 0.2, 0.14], burnt = [0.19, 0.18, 0.17], one = wreck ? burnt : [1, 1, 1], trimI = [0.05, 0.05, 0.055];
  P.tintable = wreck ? null : [body];
  M.local(1); M.save().move(0, lo, 0);
  // body: one continuous surface, tight sections at the rounded ends and around the wheel arches
  const zs = [S.zr];
  for (let z = S.zf; z < S.zr; z += 0.25) zs.push(z);
  for (const [z0, d, k] of [[S.zf, 1, 0], [S.zr, -1, 1]]) { const R = Math.max(S.rc[k], S.rt[k], S.rb[k]); for (let i = 0; i <= 7; i++) zs.push(z0 + d * R * (1 - Math.cos((i / 7) * (Math.PI / 2)))); }
  for (const az of S.ax) { for (let i = 0; i <= 10; i++) zs.push(az + S.ra * Math.cos((i / 10) * Math.PI)); zs.push(az - S.ra - 0.004, az + S.ra + 0.004); }
  const Z = [...new Set(zs.map((z) => +clamp(z, S.zf, S.zr).toFixed(4)))].sort((a, b) => a - b).filter((z, i, A) => i === 0 || z - A[i - 1] > 0.006);
  M.aoFn = (x, y) => lerp(o.dust ? 0.45 : 0.55, 1, smoothstep(S.yb, S.ym + 0.25, y - lo));
  M.color(one); M.loft(body, Z.map(sec), 20);
  M.aoFn = null;
  // bottom of the wheel arches (behind the tire) and underbody
  M.color([0.03, 0.03, 0.03]);
  for (const az of S.ax) M.boxB('dark', -S.w + 0.24, S.w - 0.24, S.yb - 0.06, cy + S.ra + 0.01, az - S.ra, az + S.ra);
  M.boxB('dark', -S.w + 0.15, S.w - 0.15, S.yb - 0.12, S.yb + 0.04, S.ax[0] + S.ra, S.ax[1] - S.ra);
  // trim glued to the body: flank strip (side sd, from z0 to z1, between heights y0(s, z) and y1(s, z)) and end piece (d = -1 front,
  // +1 rear; from x0 to x1 and from y0 to y1), offset by off along the normal
  const sideSkin = (mat, sd, z0, z1, y0, y1, off, nu, nv) => M.surf(mat, nu, nv, (u, v) => {
    const z = lerp(z0, z1, u), s = sec(z), y = lerp(y0(s, z), y1(s, z), v), e = 0.004, x = carXAt(s, y);
    const hy = (carXAt(s, y + e) - carXAt(s, y - e)) / (2 * e), hz = (G.xAt(y, z + e) - G.xAt(y, z - e)) / (2 * e), l = hyp3(1, hy, hz);
    return [sd * (x + off / l), y - (hy * off) / l, z - (hz * off) / l];
  }, { flipN: sd > 0, uL: z1 - z0, vL: 0.5 });
  const zEnd = (x, y, d) => {
    const inside = (z) => { if (z < S.zf || z > S.zr) return false; const s = sec(z); return y <= s.yt && y >= s.yb && Math.abs(x) <= carXAt(s, y); };
    let a = d < 0 ? S.zf - 0.01 : S.zr + 0.01, b = d < 0 ? S.ax[0] - S.ra : S.ax[1] + S.ra;
    if (!inside(b)) return b;
    for (let i = 0; i < 24; i++) { const m = (a + b) / 2; if (inside(m)) b = m; else a = m; }
    return b;
  };
  const endSkin = (mat, d, x0, x1, y0, y1, off, nu = 6, nv = 2) => M.surf(mat, nu, nv, (u, v) => {
    const x = lerp(x0, x1, u), y = lerp(y0, y1, v), e = 0.004, z = zEnd(x, y, d);
    const fx = (zEnd(x + e, y, d) - zEnd(x - e, y, d)) / (2 * e), fy = (zEnd(x, y + e, d) - zEnd(x, y - e, d)) / (2 * e), nx = -d * fx, ny = -d * fy, l = hyp3(nx, ny, 1);
    return [x + (nx * off) / l, y + (ny * off) / l, z + (d * off) / l];
  }, { flipN: d < 0, uL: x1 - x0, vL: y1 - y0 });
  const xEnd = (y, d) => carXAt(sec(d < 0 ? S.ax[0] - S.ra : S.ax[1] + S.ra), y) - 0.025; // (an end piece stops before the flank)
  const pair = (mat, d, x0, x1, y0, y1, off, nu) => { const a = Math.min(x1, xEnd(y0, d), xEnd(y1, d)); if (a > x0) { endSkin(mat, d, x0, a, y0, y1, off, nu); endSkin(mat, d, -a, -x0, y0, y1, off, nu); } };
  if (o.dust) { // mud at the base of the flanks, jagged top edge
    M.color([0.5, 0.43, 0.35]); M.cls = 1;
    for (const sd of [-1, 1]) for (const [z0, z1] of [[S.ax[0] + S.ra + 0.02, S.ax[1] - S.ra - 0.02]]) sideSkin('dirt', sd, z0, z1, (s) => s.yb + 0.01, (s, z) => s.yb + 0.1 + 0.12 * clamp(0.5 + 0.3 * Math.sin(z * 9 + sd) + 0.2 * Math.sin(z * 23), 0, 1), 0.008, Math.round((z1 - z0) / 0.07), 1);
    M.cls = 0;
  }
  // glazing: a surface laid on the body shoulder, from the windshield base to the rear window base; each cell is window (transparent:
  // the cabin shows, carInterior), pillar, seal or sheet metal; the pillars have a dark inner lining. The wreck no longer has windows
  const cuts = [g.wz0, g.wz0 + 0.035, g.wz1 - 0.05, g.wz1, g.rz1, g.rz1 + 0.05, g.bz - 0.03, g.bz, ...g.win.flat()].filter((z) => z >= g.wz0 && z <= g.bz).sort((a, b) => a - b).filter((z, i, A) => i === 0 || z - A[i - 1] > 0.005);
  const Zg = [];
  for (let i = 0; i < cuts.length - 1; i++) { const n = Math.max(1, Math.ceil((cuts[i + 1] - cuts[i]) / 0.2)); for (let k = 0; k < n; k++) Zg.push(lerp(cuts[i], cuts[i + 1], k / n)); }
  Zg.push(cuts[cuts.length - 1]);
  const cols = Zg.map((z) => { const R = G.gh(z); return [...R.map(([x, y]) => [-x, y, z]), ...R.slice(0, 12).reverse().map(([x, y]) => [x, y, z])]; }), NP = 25, NZ = cols.length;
  const arc = cols.map((F) => { let s = 0; return F.map((p, i) => (s += i ? hyp(p[0] - F[i - 1][0], p[1] - F[i - 1][1]) : 0)); });
  const nrm = cols.map((F, j) => F.map((p, i) => {
    const a = F[Math.max(0, i - 1)], b = F[Math.min(NP - 1, i + 1)], c = cols[Math.max(0, j - 1)][i], d = cols[Math.min(NZ - 1, j + 1)][i];
    const tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2], ux = d[0] - c[0], uy = d[1] - c[1], uz = d[2] - c[2];
    let nx = ty * uz - tz * uy, ny = tz * ux - tx * uz, nz = tx * uy - ty * ux; const l = hyp3(nx, ny, nz);
    if (l < 1e-9) { const q = hyp(p[0], 1); return [p[0] / q, 1 / q, 0]; }
    nx /= l; ny /= l; nz /= l;
    return nx * p[0] + ny * (p[1] - G.belt + 0.4) < 0 ? [-nx, -ny, -nz] : [nx, ny, nz];
  }));
  const wsZ = (z) => z > g.wz0 + 0.035 && z < g.wz1 - 0.05, rgZ = (z) => z > g.rz1 + 0.05 && z < g.bz - 0.03, lastW = g.win[g.win.length - 1][1];
  // s: row on the half-profile (0 beltline seal, 1 to 3 window, 4 top frame, 5 to 7 roof corner, 8 roof edge, 9 to 11 roof)
  const kind = (s, z) => {
    const win = g.win.some(([a, b]) => z > a && z < b), pil = z < lastW && g.noir ? 'noir' : 'body';
    if (s === 0 || s === 4) return win ? 'joint' : pil;
    if (s <= 3) return win ? 'glass' : pil;
    if (s <= 7) return z < g.wz1 && g.noir ? 'noir' : 'body';
    if (z < g.wz1 || z > g.rz1) return s >= 9 && (wsZ(z) || rgZ(z)) ? 'glass' : 'noir';
    return 'body';
  };
  const gm = o.dust ? 'carglassD' : 'carglass', look = {
    glass: [gm, glassC, 1], body: [body, wreck ? rust : one, 0], noir: [wreck ? 'charred' : 'glass', trim, 0], joint: S.chrome && !wreck ? ['steel', chrome, 0] : [wreck ? 'charred' : 'glass', trim, 0],
  }; // (lacquered black pillars: smooth glass; the grainy plastic drew patterns under the reflections)
  const face = (mat, pts, ns, uvs, inner) => {
    const c = pts.map((p, k) => (inner ? [p[0] - ns[k][0] * 0.012, p[1] - ns[k][1] * 0.012, p[2] - ns[k][2] * 0.012] : p)), nn = inner ? ns.map((n) => [-n[0], -n[1], -n[2]]) : ns;
    const B = M.buf(mat, (c[0][0] + c[2][0]) / 2, (c[0][1] + c[2][1]) / 2, (c[0][2] + c[2][2]) / 2);
    const ids = c.map((p, k) => M.v(B, p[0], p[1], p[2], nn[k][0], nn[k][1], nn[k][2], uvs[k][0], uvs[k][1]));
    const ax = c[2][0] - c[0][0], ay = c[2][1] - c[0][1], az = c[2][2] - c[0][2], bx = c[3][0] - c[1][0], by = c[3][1] - c[1][1], bz = c[3][2] - c[1][2];
    const s = (ay * bz - az * by) * (nn[0][0] + nn[2][0]) + (az * bx - ax * bz) * (nn[0][1] + nn[2][1]) + (ax * by - ay * bx) * (nn[0][2] + nn[2][2]);
    if (s >= 0) M.quadI(B, ids[0], ids[1], ids[2], ids[3]); else M.quadI(B, ids[0], ids[3], ids[2], ids[1]);
  };
  for (let j = 0; j < NZ - 1; j++) for (let p = 0; p < NP - 1; p++) {
    const k = kind(p < 12 ? p : 23 - p, (Zg[j] + Zg[j + 1]) / 2);
    if (k === 'glass' && wreck) continue;
    const [mat, col, cls] = look[k], q = [[p, j], [p + 1, j], [p + 1, j + 1], [p, j + 1]];
    const pts = q.map(([i, jj]) => cols[jj][i]), ns = q.map(([i, jj]) => nrm[jj][i]), uvs = q.map(([i, jj]) => [Zg[jj], arc[jj][i]]);
    M.color(col); M.cls = cls; face(mat, pts, ns, uvs, false);
    if (k !== 'glass') { M.color(wreck ? burnt : trimI); M.cls = 1; face(wreck ? 'charred' : 'plastic', pts, ns, uvs, true); }
  }
  M.cls = 0;
  // cabin: dark trim on the body top, dashboard, steering wheel, seats; the wreck: blackened tub, bare seats
  const b0 = G.b0((g.wz1 + g.rz1) / 2), dash = Math.min(0.42, (g.wz1 - g.wz0) * 0.5);
  M.color(trimI); M.cls = 1;
  M.surf('dark', 8, Math.ceil((g.bz - g.wz0) / 0.15), (u, v) => { const z = lerp(g.wz0 + 0.03, g.bz - 0.03, v), x = lerp(-1, 1, u) * (G.b0(z) - 0.015); return [x, G.yTop(x, z) + 0.006, z]; }, { flipN: true });
  M.cls = 0;
  if (!wreck) carInterior(M, { x: b0 - 0.07, za: g.wz0, zb: g.bz, Y0: (z) => sec(z).yt, Y1: G.yRoof, zSeat: g.seat[0], zRear: g.seat[1], dash, noFloor: true });
  else {
    const y0 = G.belt; M.color([0.3, 0.26, 0.22]);
    for (const z of [g.seat[0] - 0.42, g.seat[1] - 0.45]) for (const sd of [-1, 1]) { M.boxB('charred', sd * 0.12, sd * (b0 - 0.14), y0 - 0.25, y0 - 0.2, z, z + 0.48); M.boxB('charred', sd * 0.12, sd * (b0 - 0.14), y0 - 0.2, y0 + 0.3, z + 0.42, z + 0.48); }
    M.color([0.2, 0.19, 0.18]); M.boxB('charred', -b0 + 0.1, b0 - 0.1, sec(g.wz0).yt - 0.05, sec(g.wz0).yt + 0.08, g.wz0 + 0.04, g.wz0 + dash, { bevel: 0.02 });
    M.tube('steel', 0.016, Array.from({ length: 11 }, (_, i) => { const a = (i / 10) * TAU; return [-b0 * 0.5 + Math.cos(a) * 0.17, sec(g.wz0).yt + 0.12 + Math.sin(a) * 0.15, g.wz0 + dash + 0.08 + Math.sin(a) * 0.07]; }), 4);
  }
  // wiper cowl (glued to the hood), wipers laid on the windshield
  M.color(trim); M.surf('plastic', 10, 2, (u, v) => { const z = lerp(g.wz0 - 0.1, g.wz0 + 0.03, v), x = lerp(-1, 1, u) * (G.b0(z) - 0.01); return [x, G.yTop(x, z) + 0.007, z]; }, { flipN: true });
  if (!wreck) {
    const wa = Math.atan2(g.y1 - G.yRoof(g.wz0), g.wz1 - g.wz0); M.cls = 2;
    for (const x of [-0.36, 0.16]) { M.save().move(x, G.yRoof(g.wz0 + 0.04) + 0.012, g.wz0 + 0.04).rotY(0.25).rotX(-wa); M.boxB('dark', -0.006, 0.006, 0, 0.012, 0, 0.5); M.restore(); }
    M.cls = 0;
  }
  // flanks: moldings, door seals, handles, mirrors, fender flares, roof rails
  for (const sd of [-1, 1]) {
    if (S.clad) { const [c0, c1, cc] = S.clad; M.color(wreck ? trim : cc); sideSkin('plastic', sd, S.ax[0] + S.ra + 0.03, S.ax[1] - S.ra - 0.03, (s) => Math.max(c0, s.yb + 0.004), () => c1, 0.006, 10, 2); }
    M.color([0.04, 0.04, 0.04]); M.cls = 2;
    for (const z of S.seams) sideSkin('dark', sd, z - 0.004, z + 0.004, (s) => s.yb + 0.05, (s, zz) => G.yBase(zz) - 0.012, 0.0025, 1, 6);
    const hy = S.handleY || 0.76; M.color(wreck ? burnt : S.chrome ? chrome : one);
    for (const z of S.handles) { const x = G.xAt(hy + 0.015, z + 0.075); M.boxB(S.chrome ? 'steel' : body, sd * (x - 0.008), sd * (x + 0.012), hy, hy + 0.032, z, z + 0.15, { bevel: 0.01 }); }
    M.cls = 0;
    const mz = S.mirror, mx = G.b0(mz), my = G.yBase(mz) + 0.03; M.color(one);
    M.save().move(sd * mx, my, mz).rotY(sd * 0.12); M.boxB(body, sd > 0 ? 0 : -0.18, sd > 0 ? 0.18 : 0, 0, 0.12, -0.04, 0.08, { bevel: 0.04 });
    if (!wreck) { M.color([0.7, 0.72, 0.74]); M.cls = 1; M.boxB('glass', sd > 0 ? 0.02 : -0.16, sd > 0 ? 0.16 : -0.02, 0.02, 0.1, 0.08, 0.085); M.cls = 0; }
    M.restore();
    if (S.flare) {
      M.color(trim); const a0 = -Math.asin(clamp((cy - S.yb) / S.ra, -1, 1)), R = S.ra + S.flare * 0.6;
      for (const az of S.ax) M.tube('plastic', S.flare, Array.from({ length: 13 }, (_, i) => { const a = lerp(a0, Math.PI - a0, i / 12), z = az + R * Math.cos(a), y = cy + R * Math.sin(a), s = sec(z); return [sd * (carXAt(s, Math.max(y, s.yb + (s.ym - s.yb) * 0.4)) + S.flare * 0.2), y, z]; }), 5);
    }
    if (S.rails && !wreck) { const x = g.b1 - 0.1, dy = -g.cr * (x / g.b1) ** 2; M.color(S.rails); M.cls = 1; M.tube('steel', 0.022, [[sd * x, G.yRoof(g.wz1 + 0.12) + dy, g.wz1 + 0.12], [sd * x, G.yRoof(g.wz1 + 0.3) + dy + 0.06, g.wz1 + 0.3], [sd * x, G.yRoof(g.rz1 - 0.25) + dy + 0.06, g.rz1 - 0.25], [sd * x, G.yRoof(g.rz1 - 0.06) + dy, g.rz1 - 0.06]], 5); M.cls = 0; }
  }
  // add-on bumpers (sedan): a bead that hugs the end of the body and wraps back onto the fenders
  const [pb0, pb1, bs] = S.bumper || [0, 0, 0];
  if (S.bumper) {
    M.color(wreck ? burnt : trim);
    for (const [zt, d] of [[S.zf, -1], [S.zr, 1]]) {
      const ym = (pb0 + pb1) / 2, w = (z) => carXAt(sec(z), ym) + 0.025, secs = [{ z: zt + d * bs, w: w(zt) - 0.04, yb: pb0 + 0.01, yt: pb1 - 0.01, n: 6 }];
      for (let i = 0; i <= 6; i++) { const z = zt - d * 0.38 * (1 - Math.cos((i / 6) * (Math.PI / 2))); secs.push({ z: z + d * (i ? 0 : bs * 0.5), w: w(z), yb: pb0, yt: pb1, n: 8 }); }
      M.loft('plastic', d < 0 ? secs : secs.reverse(), 16);
    }
    if (S.chrome && !wreck) { M.color(chrome); M.cls = 1; for (const [zt, d] of [[S.zf, -1], [S.zr, 1]]) M.boxB('steel', -S.w + 0.2, S.w - 0.2, pb1 - 0.035, pb1 - 0.012, zt + d * bs - 0.004, zt + d * bs + 0.004); M.cls = 0; }
  }
  // ends: black lips, skid plates, grille, air intake, lights wrapped around the corners, plates; the wreck has smashed lights
  if (S.lip) { M.color(wreck ? burnt : trim); endSkin('plastic', -1, -S.w + 0.15, S.w - 0.15, S.yf + 0.025, S.yf + S.lip, 0.004, 16, 1); endSkin('plastic', 1, -S.w + 0.15, S.w - 0.15, S.yr + 0.025, S.yr + S.lip, 0.004, 16, 1); }
  if (S.skid && !wreck) { M.color([0.62, 0.63, 0.64]); M.cls = 1; endSkin('plastic', -1, -0.44, 0.44, S.yf + 0.03, S.yf + 0.13, 0.007, 8, 1); endSkin('plastic', 1, -0.44, 0.44, S.yr + 0.03, S.yr + 0.12, 0.007, 8, 1); M.cls = 0; }
  const h = S.head, gr = S.grille, t = S.tail;
  M.color([0.03, 0.03, 0.03]); endSkin('dark', -1, -gr.x, gr.x, gr.y0, gr.y1, 0.004, 8, 2);
  if (S.intake) endSkin('dark', -1, -S.intake.x, S.intake.x, S.intake.y0, S.intake.y1, 0.004, 10, 1);
  if (!wreck) {
    M.color(gr.chrome ? chrome : [0.16, 0.16, 0.16]); M.cls = 2;
    for (let y = gr.y0 + 0.035; y < gr.y1 - 0.03; y += 0.045) endSkin('steel', -1, -gr.x + 0.02, gr.x - 0.02, y, y + 0.014, 0.009, 4, 1);
    if (gr.chrome) endSkin('steel', -1, -gr.x, gr.x, gr.y1 - 0.022, gr.y1, 0.011, 8, 1);
    M.cls = 1;
    M.color(trim); pair('plastic', -1, h.x0 - 0.012, h.x1 + 0.012, h.y0 - 0.012, h.y1 + 0.012, 0.005);
    M.color([1, 1, 1]); pair('lampOff', -1, h.x0, h.x1 - 0.07, h.y0, h.y1, 0.009); // (clear glass, a glow: a reflective glass stayed black facing the ground)
    M.color([0.95, 0.55, 0.12]); pair('plastic', -1, h.x1 - 0.07, h.x1, h.y0, h.y1, 0.009, 4);
    M.color(trim); pair('plastic', 1, t.x0 - 0.012, t.x1 + 0.012, t.y0 - 0.012, t.y1 + 0.012, 0.005);
    M.color([0.7, 0.06, 0.04]); pair('plastic', 1, t.x0, t.x1, t.y0 + (t.y1 - t.y0) * 0.45, t.y1, 0.009);
    M.color([0.95, 0.5, 0.1]); pair('plastic', 1, t.x0, t.x1, t.y0 + (t.y1 - t.y0) * 0.2, t.y0 + (t.y1 - t.y0) * 0.45, 0.009);
    M.color([0.9, 0.9, 0.88]); pair('plastic', 1, t.x0, t.x1, t.y0, t.y0 + (t.y1 - t.y0) * 0.2, 0.009);
    M.color([0.95, 0.95, 0.9]); endSkin('plastic', -1, -0.26, 0.26, S.plate[0], S.plate[0] + 0.11, (S.bumper && S.plate[0] < pb1 ? bs : 0) + 0.012, 4, 1); endSkin('plastic', 1, -0.26, 0.26, S.plate[1], S.plate[1] + 0.11, 0.012, 4, 1);
    M.cls = 0;
  } else {
    M.color([0.03, 0.03, 0.03]); pair('dark', -1, h.x0, h.x1, h.y0, h.y1, 0.005); pair('dark', 1, t.x0, t.x1, t.y0, t.y1, 0.005);
  }
  { const y = S.yr + 0.03, ze = zEnd(S.w * 0.55, y + 0.03, 1); M.color([0.25, 0.25, 0.25]); M.cls = 2; M.tube('steel', 0.028, [[S.w * 0.55, y, ze - 0.4], [S.w * 0.55, y, ze + 0.03]], 6); M.cls = 0; } // exhaust, just out of the bumper
  M.restore();
  // wheels; the wreck rests on its rims, one is missing
  for (const az of S.ax) for (const sd of [-1, 1]) {
    if (wreck && az === S.ax[1] && sd > 0) continue;
    M.save().move(sd * S.tx, wreck ? lo : 0, az);
    wheel(M, S.r, S.tw, { noTire: wreck, side: sd, hub: wreck ? null : S.hub, rim: wreck ? [0.36, 0.3, 0.26] : S.rim || (S.hub === 'steel' ? [0.4, 0.4, 0.4] : [0.72, 0.72, 0.7]), tire: o.dust ? [0.78, 0.72, 0.64] : null });
    M.restore();
  }
  if (wreck) { M.save().move(S.tx + 0.05, 0, S.ax[1]).rotZ(-0.12); M.color([0.3, 0.26, 0.22]); M.boxB('charred', -0.05, 0.05, 0, S.r * 0.75, -0.18, 0.18); M.restore(); } // bare hub on a block
}
/* Off-road 4x4 (4.4 m spare wheel included, modeled on the four-door Jeep Wrangler; 5.1, owner feedback): tub-style body with
   rounded corners, flat hood between two detached front fenders, seven-slot grille between two round headlights, trapezoidal black
   fender flares, upright windshield, one window per door and a quarter window, exposed door hinges, running boards, spare wheel on
   the rear door. o.rack: loaded roof rack (jerrycans, trunk, shovel), snorkel; o.dust: mud and dust;
   o.wreck: burnt-out wreck */
function offroadBuild(M, P, o) {
  const wreck = !!o.wreck, body = wreck || o.dust ? 'paint' : 'carpaint', r = 0.44, lo = wreck ? -r * 0.38 : 0; // (0.38 m wheels before 5.1: too small in their arches)
  const W = 0.82, zf = -2.0, zr = 2.0, ax = [-1.4, 1.4], tx = 0.74, sill = 0.5, belt = 1.12, roof = 1.9, zw = -0.66, rc = 0.14; // (roof at 1.98 m before 5.1: windows too tall)
  const trim = wreck ? [0.16, 0.15, 0.14] : [0.05, 0.05, 0.05], burnt = [0.19, 0.18, 0.17], rust = [0.3, 0.2, 0.14], one = wreck ? burnt : [1, 1, 1];
  P.tintable = wreck ? null : [body];
  M.local(1); M.save().move(0, lo, 0);
  M.aoFn = (x, y) => lerp(o.dust ? 0.42 : 0.55, 1, smoothstep(sill, belt + 0.1, y - lo));
  // trapezoidal wheel arch (side, [z, y]) around axle az, enlarged by g
  const arch = (az, g) => [[az - 0.52 - g, 0.6], [az - 0.42 - g * 0.8, 0.88 + g * 0.5], [az - 0.28 - g * 0.4, 0.98 + g], [az + 0.28 + g * 0.4, 0.98 + g], [az + 0.42 + g * 0.8, 0.88 + g * 0.5], [az + 0.52 + g, 0.6]];
  const archTop = (z) => { const A = arch(ax[1], 0); if (z <= A[0][0] || z >= A[5][0]) return 0; return carPoly(A, z); };
  // tub (from cowl to tailgate): one continuous, almost square surface, rounded rear corners, rear wheel arch cut out
  const cut = (d, k) => (d >= k ? 0 : k - Math.sqrt(Math.max(0, k * k - (k - d) * (k - d))));
  const tub = (z) => { const d = zr - z, yb = Math.max(sill, archTop(z)), yt = belt - cut(d, 0.06); return { z, w: W - cut(d, rc), yb, yt, ym: clamp(Math.max(0.8, yb + 0.08), yb + 0.02, yt - 0.04), n: 8 }; };
  const zs = [zw - 0.1, zr]; for (let z = zw - 0.1; z < zr; z += 0.2) zs.push(z);
  for (const [z] of arch(ax[1], 0)) zs.push(z - 0.004, z + 0.004);
  for (let i = 0; i <= 6; i++) zs.push(zr - rc * (1 - Math.cos((i / 6) * (Math.PI / 2))));
  M.color(one); M.loft(body, [...new Set(zs.map((z) => +z.toFixed(4)))].sort((a, b) => a - b).map(tub), 20);
  if (o.dust) mudSkirt(M, W, [[ax[0] + 0.55, ax[1] - 0.55], [ax[1] + 0.55, zr - 0.1]], sill, sill + 0.3, 11);
  // detached front fenders (flat top, trapezoidal cutout), flat hood between them, front face of the grille
  const fender = [[zf + 0.02, 0.66], [zf + 0.02, 1.0], [zf + 0.14, 1.06], [zw - 0.04, 1.08], [zw - 0.04, 0.56], ...arch(ax[0], 0).reverse()];
  for (const sd of [-1, 1]) { M.save().move(sd > 0 ? 0.84 : -0.56, 0, 0).rotY(-Math.PI / 2); M.extrude(body, fender, 0.28, { sharp: 0.4 }); M.restore(); }
  M.boxB(body, -0.6, 0.6, 0.98, 1.13, zf + 0.04, zw - 0.02, { bevel: 0.045 });
  M.boxB(body, -0.62, 0.62, 0.6, 1.1, zf - 0.02, zf + 0.12, { bevel: 0.035 });
  M.boxB(body, -0.62, 0.62, 0.56, 1.0, zw - 0.14, zw - 0.04); // firewall, behind the hood
  // fender flares: a thick black band following each cutout
  M.color(trim);
  for (const [az, x0, x1] of [[ax[0], 0.8, 0.95], [ax[1], 0.78, 0.93]]) for (const sd of [-1, 1]) {
    const ring = [...arch(az, -0.02), ...arch(az, 0.12).reverse()];
    M.save().move(sd > 0 ? x1 : -x0, 0, 0).rotY(-Math.PI / 2); M.extrude('plastic', ring, x1 - x0, { sharp: 0.4 }); M.restore();
  }
  // bottom of the wheel arches
  M.color([0.03, 0.03, 0.03]); for (const az of ax) M.boxB('dark', -W + 0.28, W - 0.28, sill - 0.04, 0.98, az - 0.5, az + 0.5);
  M.color(wreck ? rust : [1, 1, 1]);
  M.aoFn = null;
  // cabin: hollowed behind its windows (the wreck keeps its block, without windows or interior); rounded rear corners, roof with round corners
  const wins = [[zw + 0.2, 0.3], [0.46, 1.02], [1.18, 1.84]], wy0 = belt + 0.1, wy1 = roof - 0.14;
  if (wreck) M.boxB(body, -W, W, belt, roof - 0.06, zw + 0.06, zr - rc, { bevel: 0.03 });
  else cabShell(M, body, W, belt, roof - 0.06, zw + 0.06, zr, [['av', -0.72, 0.72, belt + 0.06, roof - 0.12], ['ar', -0.42, 0.42, 1.5, roof - 0.16],
    ...['g', 'd'].flatMap((f) => wins.map(([a, b]) => [f, a, b, wy0, wy1]))], 0.05, rc);
  for (const sd of [-1, 1]) { M.save().move(sd * (W - rc), belt, zr - rc); M.cyl(body, rc, roof - 0.06 - belt, 8, { a0: sd > 0 ? 0 : Math.PI / 2, a1: sd > 0 ? Math.PI / 2 : Math.PI, caps: '' }); M.restore(); }
  { const rr = [], n = 4; // roof: rectangle with rounded rear corners, extruded downward
    rr.push([-W + 0.02, zw + 0.02], [W - 0.02, zw + 0.02]);
    for (let i = 0; i <= n; i++) { const a = (i / n) * (Math.PI / 2); rr.push([W - rc + (rc - 0.02) * Math.cos(a), zr - rc + (rc - 0.02) * Math.sin(a)]); }
    for (let i = 0; i <= n; i++) { const a = Math.PI / 2 + (i / n) * (Math.PI / 2); rr.push([-W + rc + (rc - 0.02) * Math.cos(a), zr - rc + (rc - 0.02) * Math.sin(a)]); }
    M.save().move(0, roof, 0).rotX(Math.PI / 2); M.extrude(body, rr.map(([x, z]) => [x, z]), 0.08, { sharp: 0.6 }); M.restore(); }
  M.color(trim); M.boxB('plastic', -W - 0.012, W + 0.012, belt - 0.025, belt + 0.02, zw + 0.04, zr - rc); // hardtop seal on the tub
  if (!wreck) carInterior(M, { x: W - 0.1, za: zw + 0.12, zb: zr - 0.1, Y0: () => belt - 0.02, Y1: () => roof - 0.06, zSeat: 0.4, zRear: 1.3, dash: 0.32 });
  // glazing: upright windshield, one window per door, quarter windows, rear window (rubber frames)
  const gl = wreck ? 'dark' : o.dust ? 'carglassD' : 'carglass'; M.color(wreck ? [0.04, 0.04, 0.04] : o.dust ? [0.6, 0.57, 0.52] : [0.2, 0.23, 0.26]); M.cls = 1;
  vQuad(M, gl, [-0.74, belt + 0.06, zw - 0.02], [0.74, belt + 0.06, zw - 0.02], [0.72, roof - 0.12, zw + 0.06], [-0.72, roof - 0.12, zw + 0.06], [0, 0.2, -1]);
  for (const sd of [-1, 1]) for (const [z0, z1] of wins) { const xx = sd * (W + 0.006); vQuad(M, gl, [xx, wy0, z0], [xx, wy0, z1], [xx, wy1, z1], [xx, wy1, z0], [sd, 0, 0]); }
  vQuad(M, gl, [-0.42, 1.5, zr + 0.006], [0.42, 1.5, zr + 0.006], [0.42, roof - 0.16, zr + 0.006], [-0.42, roof - 0.16, zr + 0.006], [0, 0, 1]);
  M.cls = 0; M.color(trim);
  // windshield frame (body color), black seals around the windows, door seals, exposed hinges, handles, mirrors
  M.color(one); M.boxB(body, -0.8, 0.8, belt + 0.01, belt + 0.07, zw - 0.07, zw + 0.03, { bevel: 0.02 }); M.boxB(body, -0.78, 0.78, roof - 0.13, roof - 0.04, zw - 0.02, zw + 0.1, { bevel: 0.03 });
  for (const sd of [-1, 1]) M.tube(body, 0.04, [[sd * 0.77, belt + 0.05, zw - 0.02], [sd * 0.76, roof - 0.1, zw + 0.06]], 6);
  M.color(trim); M.cls = 2;
  for (const sd of [-1, 1]) {
    for (const [z0, z1] of wins) for (const [a, b, c, d] of [[z0 - 0.02, z1 + 0.02, wy0 - 0.02, wy0], [z0 - 0.02, z1 + 0.02, wy1, wy1 + 0.02], [z0 - 0.02, z0, wy0, wy1], [z1, z1 + 0.02, wy0, wy1]]) M.boxB('rubber', sd * (W - 0.002), sd * (W + 0.01), c, d, a, b);
    for (const z of [zw + 0.08, 0.4, 1.1]) M.boxB('dark', sd * W - 0.004, sd * W + 0.004, sill + 0.06, roof - 0.1, z - 0.004, z + 0.004);
    for (const z of [zw + 0.12, 0.44]) for (const y of [0.72, 1.0]) M.boxB('plastic', sd * (W - 0.004), sd * (W + 0.025), y, y + 0.07, z, z + 0.08, { bevel: 0.01 });
    for (const z of [0.12, 0.88]) M.boxB('plastic', sd * (W - 0.004), sd * (W + 0.022), belt - 0.1, belt - 0.07, z, z + 0.14, { bevel: 0.008 });
  }
  M.cls = 0;
  for (const sd of [-1, 1]) { M.save().move(sd * (W + 0.02), belt + 0.06, zw + 0.24).rotY(sd * 0.1); M.boxB('plastic', sd > 0 ? 0 : -0.2, sd > 0 ? 0.2 : 0, 0, 0.16, -0.04, 0.06, { bevel: 0.035 }); if (!wreck) { M.color([0.7, 0.72, 0.74]); M.cls = 1; M.boxB('glass', sd > 0 ? 0.02 : -0.18, sd > 0 ? 0.18 : -0.02, 0.02, 0.14, 0.06, 0.066); M.cls = 0; M.color(trim); } M.restore(); }
  // seven-slot grille, ringed round headlights at its two ends, turn signals on the fenders; beam bumper, fog lights, hooks
  M.color([0.03, 0.03, 0.03]); for (let i = 0; i < 7; i++) { const x = (i - 3) * 0.105; M.boxB('dark', x - 0.034, x + 0.034, 0.68, 1.02, zf - 0.03, zf - 0.015, { bevel: 0.012 }); }
  for (const sd of [-1, 1]) {
    M.save().move(sd * 0.5, 0.88, zf - 0.02).rotX(-Math.PI / 2);
    M.color(wreck ? burnt : [0.6, 0.6, 0.6]); M.cyl('steel', 0.12, 0.03, 16, { caps: 't' });
    M.color(wreck ? [0.04, 0.04, 0.04] : [1, 1, 1]); M.cyl(wreck ? 'dark' : 'lampOff', 0.095, 0.036, 16, { r1: 0.09, caps: 't' });
    M.restore();
    if (!wreck) { M.color([0.95, 0.55, 0.12]); M.cls = 1; M.boxB('plastic', sd * 0.64, sd * 0.8, 0.98, 1.02, zf + 0.06, zf + 0.16); M.color([0.7, 0.06, 0.04]); M.boxB('plastic', sd * 0.66, sd * 0.8, 0.62, 0.92, zr - 0.06, zr + 0.012); M.cls = 0; }
  }
  M.color(wreck ? burnt : trim);
  M.boxB('steel', -0.92, 0.92, 0.46, 0.66, zf - 0.18, zf - 0.02, { bevel: 0.03 }); M.boxB('steel', -0.86, 0.86, 0.5, 0.64, zr - 0.03, zr + 0.1, { bevel: 0.03 });
  if (!wreck) { M.color([0.95, 0.95, 0.9]); M.cls = 1; for (const sd of [-1, 1]) { M.save().move(sd * 0.68, 0.56, zf - 0.185).rotX(-Math.PI / 2); M.cyl('lampOff', 0.045, 0.012, 10, { caps: 't' }); M.restore(); } M.boxB('plastic', -0.26, 0.26, 0.5, 0.61, zf - 0.19, zf - 0.182); M.cls = 0; }
  M.color(trim); M.cls = 2; for (const sd of [-1, 1]) M.tube('steel', 0.022, [[sd * 0.42, 0.5, zf - 0.18], [sd * 0.42, 0.46, zf - 0.26], [sd * 0.42, 0.56, zf - 0.26]], 5); M.cls = 0;
  for (const sd of [-1, 1]) { M.color(trim); M.boxB('steel', sd * 0.6, sd * 0.9, sill - 0.1, sill - 0.03, ax[0] + 0.56, ax[1] - 0.56, { bevel: 0.015 }); }
  // spare wheel on the rear door, hinges
  M.save().move(0.1, 1.02 - r, zr + 0.17).rotY(Math.PI / 2); wheel(M, r, 0.26, { noTire: wreck, side: -1, hub: wreck ? null : 'steel', rim: wreck ? [0.36, 0.3, 0.26] : [0.85, 0.85, 0.82], tread: wreck ? 0 : 14, tire: o.dust ? [0.72, 0.66, 0.58] : null }); M.restore();
  M.color(trim); M.cls = 2; for (const y of [0.75, 1.55]) M.boxB('steel', -0.8, -0.72, y, y + 0.08, zr - 0.01, zr + 0.03); M.cls = 0;
  // roof rack and snorkel
  if (o.rack) {
    M.color([0.12, 0.12, 0.12]); M.cls = 1;
    for (const sd of [-1, 1]) M.tube('steel', 0.02, [[sd * 0.74, roof + 0.02, zw + 0.2], [sd * 0.74, roof + 0.14, zw + 0.3], [sd * 0.74, roof + 0.14, zr - 0.1], [sd * 0.74, roof + 0.02, zr - 0.05]], 5);
    for (let z = zw + 0.4; z < zr - 0.1; z += 0.45) M.tube('steel', 0.016, [[-0.74, roof + 0.13, z], [0.74, roof + 0.13, z]], 4);
    M.cls = 0;
    M.color(wreck ? burnt : [0.3, 0.36, 0.24]); for (const x of [-0.5, -0.2]) M.boxB('paint', x - 0.12, x + 0.12, roof + 0.14, roof + 0.6, 1.2, 1.55, { bevel: 0.02 });
    M.color(wreck ? burnt : [0.24, 0.26, 0.2]); M.boxB('paint', 0.05, 0.65, roof + 0.14, roof + 0.44, 0.2, 1.0, { bevel: 0.03 });
    M.color(wreck ? burnt : [0.42, 0.4, 0.34]); M.boxB('canvas', -0.65, -0.05, roof + 0.14, roof + 0.36, -0.2, 0.75, { bevel: 0.06 });
    M.color(trim); M.tube('steel', 0.05, [[0.9, 0.9, zf + 0.5], [0.92, belt + 0.05, zw - 0.05], [0.86, roof - 0.05, zw + 0.02], [0.86, roof + 0.08, zw + 0.06]], 6);
  }
  M.restore();
  // wheels (off-road tires); the wreck rests on its rims, one is missing
  for (const az of ax) for (const sd of [-1, 1]) {
    if (wreck && az === ax[1] && sd > 0) continue;
    M.save().move(sd * tx, lo, az);
    wheel(M, r, 0.26, { noTire: wreck, side: sd, hub: wreck ? null : 'steel', rim: wreck ? [0.36, 0.3, 0.26] : [0.85, 0.85, 0.82], tread: 14, tire: o.dust ? [0.72, 0.66, 0.58] : null });
    M.restore();
  }
}
/* Car: model 'sedan', 'hatch' (city car), 'suv', 'mpv', 'cross' (tall family cars), 'offroad' (4x4); o: { dust, wreck, rack } (see carBuild, offroadBuild).
   Old form: PF.car(true) for the burnt-out sedan. The model's collisions are in pf.vcols */
PF.car = (model = 'sedan', o = {}) => {
  if (model === true || model === false) { o = { wreck: model }; model = 'sedan'; }
  const key = `car_${model}_${o.dust ? 1 : 0}${o.wreck ? 1 : 0}${o.rack ? 1 : 0}`;
  return prefab(key, (M, P) => {
    if (model === 'offroad') offroadBuild(M, P, o); else carBuild(M, P, CAR_SPECS[model], o);
    P.vcols = vehCols(model, o);
  });
};
/* Collisions of a vehicle (prefab frame): [[x0, x1, y0, y1, z0, z1], ...]. Cars: the body in three sections (hood, beltline,
   trunk or tailgate), from bumper to bumper, then the cabin in two tiers that stay under the raked glazing; the wreck is lower (sagging on its rims) */
function vehCols(model, o = {}) {
  const S = CAR_SPECS[model];
  if (S) {
    const g = S.gh, G = carGeo(S), lo = o.wreck ? -S.r * 0.38 : 0, y0 = G.belt, b0 = S.w - g.ins, ym = (y0 + g.y1) / 2, bs = S.bumper ? S.bumper[2] : 0;
    const hood = G.sec((S.zf + g.wz0) / 2).yt, deck = G.sec((g.bz + S.zr) / 2).yt;
    return [[-S.w - 0.01, S.w + 0.01, 0, hood + lo, S.zf - bs, g.wz0], [-S.w - 0.01, S.w + 0.01, 0, y0 + lo, g.wz0, g.bz], [-S.w - 0.01, S.w + 0.01, 0, deck + lo, g.bz, S.zr + bs],
      [-(b0 + g.b1) / 2, (b0 + g.b1) / 2, y0 + lo, ym + lo, (g.wz0 + g.wz1) / 2, (g.rz1 + g.bz) / 2, 'glassPane'],
      [-g.b1, g.b1, ym + lo, Math.min(g.y1, g.y1r) + 0.02 + lo, g.wz1, g.rz1, 'glassPane']]; // (glazed cabin: bullets and sight lines pass)
  }
  if (model === 'offroad') {
    const lo = o.wreck ? -0.38 * 0.38 : 0;
    return [[-0.95, 0.95, 0, 1.12 + lo, -2.18, 2.1], [-0.82, 0.82, 1.12 + lo, 1.9 + lo, -0.6, 2.0, o.wreck ? undefined : 'glassPane'], [-0.26, 0.46, 0.66 + lo, 1.38 + lo, 2.1, 2.28]];
  }
  return truckCols(model, o);
}
/* Places a vehicle and its collisions (pf.vcols) at point (x, y, z), rotated by rot; o: DECOR.place options (tint...) */
function vehicle(pf, x, y, z, rot, o) {
  DECOR.place(pf, x, y, z, rot, o);
  if (pf.vcols && !(o && o.nocol)) colShape(x, y, z, rot, pf.vcols, 'metal');
}
PF.bicycle = () => prefab('bicycle', (M, P) => {
  P.tintable = ['paint'];
  M.local(1);
  for (const z of [-0.52, 0.52]) { M.save().move(0, 0.34, z); M.color([0.1, 0.1, 0.1]); M.save().rotZ(Math.PI / 2); M.lathe('rubber', [[0.3, -0.018], [0.34, -0.012], [0.345, 0.0], [0.34, 0.012], [0.3, 0.018], [0.3, -0.018]], 16, { sharp: 1.2 }); M.restore(); M.color([0.7, 0.7, 0.7]); M.cls = 2; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI; M.tube('steel', 0.003, [[0, Math.cos(a) * 0.3, Math.sin(a) * 0.3], [0, -Math.cos(a) * 0.3, -Math.sin(a) * 0.3]], 3); } M.cls = 0; M.restore(); }
  M.color([1, 1, 1]);
  const bb = [0, 0.3, 0.02], seat = [0, 0.8, -0.12], head = [0, 0.82, 0.38];
  M.tube('paint', 0.02, [bb, seat], 6); M.tube('paint', 0.02, [bb, head], 6); M.tube('paint', 0.018, [seat, [0, 0.8, 0.36]], 6);
  M.tube('paint', 0.014, [bb, [0, 0.34, -0.52]], 5); M.tube('paint', 0.014, [seat, [0, 0.34, -0.52]], 5);
  M.tube('paint', 0.016, [head, [0, 0.34, 0.52]], 5);
  M.color([0.12, 0.12, 0.12]); M.tube('steel', 0.012, [[-0.25, 0.98, 0.34], [0, 0.95, 0.38], [0.25, 0.98, 0.34]], 5); M.tube('steel', 0.014, [head, [0, 0.95, 0.38]], 5);
  M.save().move(0, 0.82, -0.14); M.boxB('rubber', -0.06, 0.06, 0, 0.05, -0.12, 0.1, { bevel: 0.02 }); M.restore();
});
/* Moped on its kickstand */
PF.moped = () => prefab('moped', (M, P) => {
  P.tintable = ['carpaint'];
  M.local(1);
  for (const z of [-0.58, 0.55]) { M.save().move(0, 0, z); wheel(M, 0.25, 0.07, { rim: [0.6, 0.6, 0.58] }); M.restore(); }
  M.color([1, 1, 1]);
  M.loft('carpaint', [{ z: -0.62, w: 0.12, yb: 0.45, yt: 0.62, n: 3 }, { z: -0.2, w: 0.15, yb: 0.38, yt: 0.66, n: 3 }, { z: 0.05, w: 0.1, yb: 0.36, yt: 0.5, n: 3 }], 10, { smooth: true });
  M.loft('carpaint', [{ z: 0.2, w: 0.14, yb: 0.45, yt: 0.8, n: 3 }, { z: 0.36, w: 0.16, yb: 0.4, yt: 0.95, n: 3 }], 10);
  M.color([0.12, 0.12, 0.12]); M.save().move(0, 0.66, -0.35); M.boxB('rubber', -0.12, 0.12, 0, 0.08, -0.3, 0.2, { bevel: 0.03 }); M.restore();
  M.color([0.55, 0.55, 0.55]);
  M.tube('steel', 0.02, [[0, 0.25, 0.55], [0, 0.95, 0.42]], 5); M.tube('steel', 0.015, [[-0.3, 1.0, 0.4], [0.3, 1.0, 0.4]], 5);
  M.save().move(0, 0.93, 0.47).rotX(Math.PI / 2); M.cyl('glass', 0.06, 0.05, 8); M.restore();
  M.tube('steel', 0.02, [[0.1, 0.3, -0.1], [0.14, 0.28, -0.5], [0.14, 0.34, -0.72]], 5);
  M.tube('steel', 0.012, [[0, 0.25, -0.1], [0.12, 0.02, -0.02]], 4);
});
/* ---------- Trucks ---------- */
/* Shared colors: black trim, burnt sheet metal and rust of the wrecks */
const TRK = { trim: [0.1, 0.1, 0.1], burnt: [0.19, 0.18, 0.17], rust: [0.3, 0.2, 0.14], tarp: [0.6, 0.6, 0.46] };
/* Truck mirror on two arms, side sd, attached to the cab at (x, y, z) */
function truckMirror(M, sd, x, y, z, wreck) {
  M.color(wreck ? TRK.burnt : TRK.trim); M.cls = 1;
  M.tube('steel', 0.016, [[sd * x, y + 0.25, z], [sd * (x + 0.26), y + 0.25, z], [sd * (x + 0.28), y + 0.2, z]], 4);
  M.tube('steel', 0.016, [[sd * x, y - 0.2, z], [sd * (x + 0.26), y - 0.2, z], [sd * (x + 0.28), y - 0.15, z]], 4);
  M.boxB('plastic', sd * (x + 0.24), sd * (x + 0.33), y - 0.25, y + 0.3, z - 0.06, z + 0.04, { bevel: 0.015 });
  if (!wreck) { M.color([0.7, 0.72, 0.74]); M.boxB('glass', sd * (x + 0.25), sd * (x + 0.32), y - 0.23, y + 0.28, z + 0.04, z + 0.046); }
  M.cls = 0;
}
/* Window laid flat on a cab face, with its rubber seal: rectangle (a0..a1, y0..y1) on the face normal to axis ax
   ('x': side face at x = c, side sd; 'z': front or rear face at z = c, side sd) */
function truckPane(M, ax, sd, c, a0, a1, y0, y1, wreck, dust) {
  const t = 0.012, e = 0.025;
  M.color(TRK.trim); M.cls = 1;
  // seal: a frame of four strips around the window (a solid plate hid the cab behind the transparent window)
  const n0 = sd * c - (sd > 0 ? 0.003 : t + 0.004), n1 = sd * c + (sd > 0 ? t + 0.004 : 0.003);
  for (const [b0, b1, h0, h1] of [[a0 - e, a1 + e, y0 - e, y0], [a0 - e, a1 + e, y1, y1 + e], [a0 - e, a0, y0, y1], [a1, a1 + e, y0, y1]]) {
    if (ax === 'x') M.boxB('rubber', n0, n1, h0, h1, b0, b1); else M.boxB('rubber', b0, b1, h0, h1, n0, n1);
  }
  M.color(wreck ? [0.04, 0.04, 0.04] : dust ? [0.6, 0.57, 0.52] : [0.2, 0.23, 0.26]); const m = wreck ? 'dark' : dust ? 'carglassD' : 'carglass', o = t + 0.008; // (transparent window: cab hollowed behind, cabShell)
  // a single face of glass (a box stacked two, the cab no longer showed behind); the wreck keeps its blackened windows
  const p = sd * (c + o);
  if (wreck) { if (ax === 'x') M.boxB(m, sd * c - (sd > 0 ? 0 : o), sd * c + (sd > 0 ? o : 0), y0, y1, a0, a1); else M.boxB(m, a0, a1, y0, y1, sd * c - (sd > 0 ? 0 : o), sd * c + (sd > 0 ? o : 0)); }
  else if (ax === 'x') vQuad(M, m, [p, y0, a0], [p, y0, a1], [p, y1, a1], [p, y1, a0], [sd, 0, 0]);
  else vQuad(M, m, [a0, y0, p], [a1, y0, p], [a1, y1, p], [a0, y1, p], [0, 0, sd]);
  M.cls = 0;
}
/* Wheels of a truck: axles [[z, dual], ...], radius r, width tw, track tx; o: { tread, hub, rim, wreck, lo } */
function truckWheels(M, axles, r, tw, tx, o) {
  for (const [z, dual] of axles) for (const sd of [-1, 1]) for (const k of dual ? [0, 1] : [0]) {
    if (o.wreck && z === axles[axles.length - 1][0] && sd > 0) continue; // the wreck has lost a wheel
    M.save().move(sd * (tx - k * (tw + 0.03)), o.wreck ? o.lo : 0, z);
    wheel(M, r, tw, { side: sd, noTire: !!o.wreck, tread: o.tread, hub: o.wreck ? null : o.hub, rim: o.wreck ? [0.34, 0.28, 0.24] : o.rim });
    M.restore();
  }
}
/* Flatbed with side boards: floor (yf) from z0 to z1, side boards up to ys, stakes, top rail, tailgate, front board up to yh; half-width W.
   Mudguard behind each rear wheel (zm) */
function truckBed(M, body, z0, z1, yf, ys, yh, W, zm, wreck) {
  M.color(wreck ? TRK.rust : [1, 1, 1]);
  M.boxB(body, -W, W, yf - 0.16, yf, z0, z1, { bevel: 0.02 });
  for (const sd of [-1, 1]) M.boxB(body, sd * (W - 0.05), sd * W, yf, ys, z0, z1, { bevel: 0.01 });
  M.boxB(body, -W, W, yf, ys, z1 - 0.06, z1, { bevel: 0.01 });
  M.boxB(body, -W, W, yf, yh, z0, z0 + 0.06, { bevel: 0.01 });
  // stakes, rails, tailgate hinges, longitudinal beams under the floor, rear underrun bar
  M.color(wreck ? TRK.burnt : [0.82, 0.82, 0.8]); M.cls = 1;
  const n = Math.max(2, Math.round((z1 - z0) / 1.1));
  for (const sd of [-1, 1]) {
    for (let i = 0; i <= n; i++) M.boxB(body, sd * W - (sd > 0 ? 0.004 : 0.03), sd * W + (sd > 0 ? 0.03 : 0.004), yf - 0.05, ys + 0.02, lerp(z0 + 0.05, z1 - 0.05, i / n) - 0.04, lerp(z0 + 0.05, z1 - 0.05, i / n) + 0.04);
    M.boxB(body, sd * W - (sd > 0 ? 0.004 : 0.024), sd * W + (sd > 0 ? 0.024 : 0.004), (yf + ys) / 2 - 0.025, (yf + ys) / 2 + 0.025, z0, z1);
  }
  M.color(TRK.trim);
  for (const x of [-0.75, 0.75]) M.boxB('steel', x - 0.04, x + 0.04, ys - 0.16, ys - 0.08, z1, z1 + 0.035);
  for (const sd of [-1, 1]) M.boxB('steel', sd * 0.45, sd * 0.6, yf - 0.36, yf - 0.16, z0, z1);
  M.boxB('steel', -W + 0.1, W - 0.1, 0.5, 0.62, z1 - 0.12, z1 - 0.04);
  M.cls = 0;
  for (const sd of [-1, 1]) { M.color(wreck ? TRK.burnt : [0.06, 0.06, 0.06]); M.boxB('rubber', sd * (W - 0.4), sd * (W - 0.02), 0.22, yf - 0.2, zm, zm + 0.025); }
}
/* Tarp over hoops: from z0 to z1, from the side boards (ys) up to yt, half-width W; raised hoops, straps, rolled rear flap.
   The tarp is a simulated cloth (Maker.canvasCloth): strapped to the side boards and held by the hoops, it billows between them in the wind and
   flaps in a gust; the two gables stay rigid. Wreck: bare hoops and a scrap of cloth hanging and flapping in the wind */
function truckTarp(M, z0, z1, ys, yt, W, wreck) {
  if (wreck) {
    M.color(TRK.burnt); M.cls = 1;
    for (let i = 0; i <= 4; i++) { const z = lerp(z0 + 0.1, z1 - 0.1, i / 4), arc = []; for (let k = 0; k <= 8; k++) { const a = (k / 8) * Math.PI; arc.push([Math.cos(a) * (W - 0.04), ys + Math.pow(Math.sin(a), 0.35) * (yt - ys - 0.05), z]); } if (i !== 2) M.tube('steel', 0.025, arc, 4); }
    M.color([0.24, 0.22, 0.18]); M.canvasCloth(4, 2, (u, v) => [lerp(-W + 0.05, -W + 0.6, u), lerp(yt - 0.2, ys + 0.2, v * v), z1 - 0.6 + Math.sin(u * 3) * 0.06], { uL: 0.6, vL: 1, clothKind: 'hung', play: 0.5, glow: 0, pin: (u, v) => v <= 0 && (u <= 0 || u >= 1) });
    M.cls = 0; return;
  }
  const ym = ys; // the cloth falls onto the top of the side boards
  M.color(TRK.tarp);
  // profile: the skirt strapped to the side board (12 cm), then the arc of the hoops (superellipse); u from the left side board to the right
  const sk = 0.06, Wt = W + 0.015, prof = (u) => {
    if (u < sk) return [-Wt, ys - 0.12 + (u / sk) * 0.12];
    if (u > 1 - sk) return [Wt, ys - 0.12 + ((1 - u) / sk) * 0.12];
    const a = Math.PI * (1 - (u - sk) / (1 - 2 * sk)), c = Math.cos(a), sn = Math.max(0, Math.sin(a));
    return [Math.sign(c) * Math.pow(Math.abs(c), 1 / 3) * Wt, ym + Math.pow(sn, 1 / 3) * (yt - ym)];
  };
  const arches = [1, 2, 3, 4].map((i) => lerp(z0, z1, i / 5)), dz = (z1 - z0) / 12;
  M.canvasCloth(22, 8, (u, v) => { const q = prof(u); return [q[0], q[1], lerp(z0, z1, v)]; }, { uL: 2 * Wt + 2 * (yt - ym), vL: z1 - z0, flipN: true, play: 0.1, glow: 0.15,
    pin: (u, v) => u <= sk || u >= 1 - sk || v <= 0 || v >= 1 || arches.some((z) => Math.abs(lerp(z0, z1, v) - z) < dz * 0.6) });
  // gables (rigid)
  for (const [z, s] of [[z0, -1], [z1, 1]]) M.surf('canvas', 16, 1, (u, v) => { const q = prof(u); return [q[0] * (1 - v), lerp(q[1], ys - 0.12, v), z]; }, { uL: 2 * Wt, vL: yt - ys, flipN: s > 0 });
  M.color([0.52, 0.52, 0.4]); M.cls = 1;
  for (let i = 1; i < 5; i++) {
    const z = lerp(z0, z1, i / 5), arc = [];
    for (let k = 0; k <= 12; k++) { const a = (k / 12) * Math.PI, c = Math.cos(a), sn = Math.sin(a); arc.push([Math.sign(c) * Math.pow(Math.abs(c), 1 / 3) * (W + 0.02), ym + Math.pow(sn, 1 / 3) * (yt - ym + 0.008), z]); }
    M.tube('canvas', 0.03, arc.filter((p) => p[1] > ys - 0.02), 5);
  }
  // rolled rear flap, straps on the side boards
  M.color([0.48, 0.48, 0.37]); M.save().move(-W + 0.08, yt - 0.28, z1 + 0.05).rotZ(-Math.PI / 2); M.cyl('canvas', 0.09, 2 * W - 0.16, 8); M.restore();
  M.color([0.18, 0.18, 0.15]); M.cls = 2;
  for (let i = 0; i <= 5; i++) for (const sd of [-1, 1]) { const z = lerp(z0 + 0.25, z1 - 0.25, i / 5); M.boxB('dark', sd * (W + 0.018) - 0.006, sd * (W + 0.018) + 0.006, ys - 0.25, ys + 0.12, z - 0.02, z + 0.02); }
  M.cls = 0;
}
/* Secured load of an open flatbed (wooden crates, tarped pile, straps) between z0 and z1, on floor yf; returns its boxes */
function truckCargo(M, z0, z1, yf, W, wreck) {
  const boxes = [[-W + 0.15, -0.05, yf, yf + 0.75, z0 + 0.25, z0 + 1.35], [0.1, W - 0.15, yf, yf + 0.6, z0 + 0.25, z0 + 1.15], [-W + 0.15, W - 0.15, yf, yf + 0.9, z1 - 1.6, z1 - 0.3]];
  M.color(wreck ? TRK.burnt : [0.85, 0.8, 0.7]); for (const b of boxes.slice(0, 2)) M.boxB(wreck ? 'charred' : 'crate', b[0], b[1], b[2], b[3], b[4], b[5], { bevel: 0.02 });
  const c = boxes[2]; M.color(wreck ? TRK.burnt : [0.44, 0.46, 0.34]);
  M.loft('canvas', [{ z: c[4], w: (c[1] - c[0]) / 2, yb: yf, yt: c[3], ym: yf + 0.3, n: 5 }, { z: c[5], w: (c[1] - c[0]) / 2, yb: yf, yt: c[3], ym: yf + 0.3, n: 5 }], 14, { caps: true });
  M.color([0.16, 0.16, 0.13]); M.cls = 2;
  for (const b of boxes) for (const z of [b[4] + 0.25, b[5] - 0.25]) M.tube('dark', 0.012, [[b[0] - 0.01, yf + 0.01, z], [b[0] - 0.01, b[3] + 0.01, z], [b[1] + 0.01, b[3] + 0.01, z], [b[1] + 0.01, yf + 0.01, z]], 3);
  M.cls = 0;
  return boxes;
}
/* 6x6 military truck (7.7 x 2.5 m, modeled on the French army's Renault GBC; 5.1, owner feedback: it had a hood):
   forward cab set on the front axle, flat two-piece windshield, black slatted grille between two round headlight blocks, large
   rounded fenders over the front wheels, black bumper with round lights and shackles, running boards under the door, spare wheel behind the cab,
   stack and air intake, fuel tank, storage box, flatbed with side boards; load: 'tarp' (tarped), 'open' (secured load) */
function armyTruckBuild(M, P, o) {
  const wreck = !!o.wreck, body = 'paint', r = 0.6, lo = wreck ? -r * 0.38 : 0, W = 1.25, one = wreck ? TRK.burnt : [1, 1, 1]; // (0.56 m wheels before 5.1)
  const z0 = -3.62, z1 = -1.92, zA = -2.55, X = 1.2;
  P.tintable = wreck ? null : [body];
  M.local(1); M.save().move(0, lo, 0);
  M.aoFn = (x, y) => lerp(0.5, 1, smoothstep(0.7, 1.7, y - lo));
  // chassis, black bumper with round lights, shackles
  M.color([0.12, 0.12, 0.11]); for (const x of [-0.5, 0.5]) M.boxB('steel', x - 0.07, x + 0.07, 0.8, 1.05, -3.6, 3.5);
  M.color(wreck ? TRK.burnt : TRK.trim); M.boxB('steel', -1.25, 1.25, 0.62, 0.94, -3.86, -3.64, { bevel: 0.03 });
  for (const sd of [-1, 1]) {
    M.save().move(sd * 1.02, 0.78, -3.865).rotX(-Math.PI / 2); M.color(wreck ? TRK.burnt : [0.55, 0.55, 0.55]); M.cyl('steel', 0.08, 0.02, 12, { caps: 't' }); if (!wreck) { M.color([1, 1, 1]); M.cyl('lampOff', 0.064, 0.026, 12, { caps: 't' }); } M.restore();
    if (!wreck) { M.color([0.95, 0.55, 0.12]); M.cls = 1; M.boxB('plastic', sd * 0.72, sd * 0.86, 0.74, 0.82, -3.875, -3.855); M.cls = 0; }
  }
  M.cls = 2; for (const sd of [-1, 1]) { M.save().move(sd * 0.55, 0.66, -3.87).rotX(Math.PI / 2); M.color([0.65, 0.12, 0.08]); M.tube('steel', 0.025, Array.from({ length: 9 }, (_, i) => { const a = (i / 8) * Math.PI; return [Math.cos(a) * 0.07, 0, Math.sin(a) * 0.1]; }), 4); M.restore(); } M.cls = 0;
  // front face: black slatted grille in the middle, body-colored flanks, round headlight blocks at the top of the flanks
  M.color(one); for (const sd of [-1, 1]) M.boxB(body, sd * 0.8, sd * X, 0.94, 1.36, z0, z0 + 0.34, { bevel: 0.04 });
  M.color([0.03, 0.03, 0.03]); M.boxB('dark', -0.82, 0.82, 0.94, 1.88, z0 - 0.02, z0 + 0.5);
  M.color(wreck ? TRK.burnt : [0.07, 0.07, 0.07]); M.cls = 1; for (let i = 0; i < 9; i++) { const y = 1.0 + i * 0.1; M.boxB('steel', -0.78, 0.78, y, y + 0.045, z0 - 0.04, z0 - 0.015); } M.cls = 0;
  for (const sd of [-1, 1]) {
    M.color(TRK.trim); M.boxB('plastic', sd * 0.86, sd * 1.15, 1.44, 1.74, z0 - 0.07, z0 + 0.01, { bevel: 0.02 });
    for (const dx of [0.94, 1.07]) { M.save().move(sd * dx, 1.6, z0 - 0.07).rotX(-Math.PI / 2); M.color(wreck ? TRK.burnt : [0.6, 0.6, 0.6]); M.cyl('steel', 0.06, 0.012, 12, { caps: 't' }); if (!wreck) { M.color([1, 1, 1]); M.cyl('lampOff', 0.048, 0.018, 12, { caps: 't' }); } M.restore(); }
  }
  // cab: solid lower part above the front wheels, upper part hollowed behind its windows, domed roof
  M.color(wreck ? TRK.rust : [1, 1, 1]);
  M.boxB(body, -X, X, 1.32, 1.9, z0, z1, { bevel: 0.07 });
  const win = [[-3.42, -2.66, 1.96, 2.56], [-2.5, -2.14, 2.1, 2.56]];
  if (wreck) M.boxB(body, -X, X, 1.9, 2.7, z0, z1, { bevel: 0.07 });
  else {
    cabShell(M, body, X, 1.9, 2.7, z0, z1, [['av', -1.06, -0.06, 1.98, 2.58], ['av', 0.06, 1.06, 1.98, 2.58], ['ar', -0.45, 0.45, 2.05, 2.45], ...['g', 'd'].flatMap((f) => win.map(([a, b, c, d]) => [f, a, b, c, d]))]);
    carInterior(M, { x: 1.08, za: z0 + 0.06, zb: z1 - 0.06, Y0: () => 1.88, Y1: () => 2.68, zSeat: -2.3, zRear: -9, dash: 0.32, wheelR: 0.22 });
  }
  for (const sd of [-1, 1]) M.boxB(body, sd * (X - 0.08), sd * X, 1.9, 2.7, z0, z0 + 0.08, { bevel: 0.03 }); // front pillars
  M.loft(body, [{ z: z0 + 0.02, w: X - 0.02, yb: 2.64, yt: 2.86, ym: 2.66, n: 4 }, { z: z1 - 0.02, w: X - 0.02, yb: 2.64, yt: 2.88, ym: 2.66, n: 4 }], 16, { caps: true });
  M.color(wreck ? TRK.burnt : [0.16, 0.16, 0.15]); M.cls = 1; M.save().move(0.4, 2.85, -2.55); M.cyl('steel', 0.32, 0.06, 14); M.restore(); M.cls = 0; // roof hatch
  for (const x of [-0.56, 0.56]) truckPane(M, 'z', -1, -z0, x - 0.5, x + 0.5, 1.98, 2.58, wreck, o.dust);
  for (const sd of [-1, 1]) for (const [a, b, c, d] of win) truckPane(M, 'x', sd, X, a, b, c, d, wreck, o.dust);
  truckPane(M, 'z', 1, z1, -0.45, 0.45, 2.05, 2.45, wreck, o.dust);
  M.color(TRK.trim); M.cls = 2;
  for (const sd of [-1, 1]) {
    M.boxB('rubber', sd * X - 0.006, sd * X + 0.02, 1.96, 2.56, -3.2, -3.17); // door window deflector
    for (const z of [-3.48, -2.58]) M.boxB('dark', sd * X - 0.004, sd * X + 0.004, 1.34, 2.62, z - 0.004, z + 0.004);
    M.boxB('steel', sd * X, sd * (X + 0.02), 1.72, 1.76, -2.78, -2.64);
  }
  M.boxB('rubber', -0.06, 0.06, 1.97, 2.59, z0 - 0.025, z0 + 0.01); // center pillar of the windshield
  M.cls = 0;
  for (const sd of [-1, 1]) truckMirror(M, sd, X, 2.2, -3.5, wreck);
  // large rounded front fenders (body color) and mud flaps; running boards under the door
  for (const sd of [-1, 1]) {
    const ring = [], n = 12; for (let i = 0; i <= n; i++) { const a = lerp(0.45, Math.PI - 0.12, i / n); ring.push([zA + 0.72 * Math.cos(a), r + 0.72 * Math.sin(a)]); }
    for (let i = n; i >= 0; i--) { const a = lerp(0.45, Math.PI - 0.12, i / n); ring.push([zA + 0.9 * Math.cos(a), r + 0.84 * Math.sin(a)]); }
    M.color(one); M.save().move(sd > 0 ? 1.27 : -0.95, 0, 0).rotY(-Math.PI / 2); M.extrude(body, ring, 0.32, { sharp: 0.5 }); M.restore();
    M.color(wreck ? TRK.burnt : [0.06, 0.06, 0.06]); M.boxB('rubber', sd * 0.98, sd * 1.24, 0.32, 0.72, zA + 0.7, zA + 0.725);
    M.color(TRK.trim); for (const y of [0.6, 0.86]) M.boxB('steel', sd * 1.0, sd * 1.24, y, y + 0.04, -1.9, -1.74);
    M.boxB('steel', sd * 1.18, sd * 1.21, 0.58, 1.32, -1.9, -1.87); M.boxB('steel', sd * 1.18, sd * 1.21, 0.58, 0.92, -1.77, -1.74);
  }
  // upright spare wheel behind the cab, stack, air intake, fuel tank, battery box
  M.save().move(0.35, 1.12, -1.72).rotY(Math.PI / 2); wheel(M, r, 0.36, { side: -1, noTire: wreck, tread: 16, hub: wreck ? null : 'army', rim: wreck ? [0.34, 0.28, 0.24] : [0.32, 0.33, 0.26] }); M.restore();
  M.color(wreck ? TRK.burnt : [0.16, 0.16, 0.15]); M.cls = 1; M.tube('steel', 0.07, [[-0.85, 1.1, -1.84], [-0.85, 3.0, -1.84]], 8); M.cls = 0;
  M.color(one); M.tube(body, 0.09, [[-1.12, 1.5, -1.86], [-1.18, 2.4, -1.86], [-1.18, 2.92, -1.86]], 8); M.boxB(body, -1.28, -1.08, 2.9, 3.0, -1.96, -1.76, { bevel: 0.02 });
  M.color(one); M.save().move(-1.0, 0.86, -1.5); M.rotX(Math.PI / 2); M.cyl(body, 0.24, 1.0, 12); M.restore();
  M.boxB(body, 0.72, 1.16, 0.62, 1.05, -1.4, -0.6, { bevel: 0.02 });
  // bed, load
  M.aoFn = null;
  truckBed(M, body, -1.5, 3.62, 1.36, 1.9, 2.3, W, 3.25, wreck);
  P.cargo = null;
  if ((o.load || 'tarp') === 'tarp') truckTarp(M, -1.44, 3.58, 1.9, 3.05, W, wreck);
  else P.cargo = truckCargo(M, -1.44, 3.56, 1.36, W, wreck);
  M.restore();
  truckWheels(M, [[zA], [1.2], [2.6]], r, 0.4, 0.98, { tread: 16, hub: 'army', rim: wreck ? null : [0.32, 0.33, 0.26], wreck, lo });
}
/* 6x6 forward-cab carrier (7.4 x 2.5 m), in the style of Russian trucks: tall cab over the front axle, two-piece windshield,
   slatted grille, round headlights in the bumper, marker lights on the roof, upright spare wheel behind the cab, flatbed with
   high side boards; load: 'open' (side boards), 'tarp' (tarped), 'cargo' (side boards and load) */
function cargoTruckBuild(M, P, o) {
  const wreck = !!o.wreck, body = 'paint', r = 0.59, lo = wreck ? -r * 0.38 : 0, W = 1.25, one = wreck ? TRK.burnt : [1, 1, 1]; // (0.55 m wheels before 5.1)
  P.tintable = wreck ? null : [body];
  M.local(1); M.save().move(0, lo, 0);
  M.aoFn = (x, y) => lerp(0.5, 1, smoothstep(0.7, 1.8, y - lo));
  M.color([0.12, 0.12, 0.11]); for (const x of [-0.5, 0.5]) M.boxB('steel', x - 0.07, x + 0.07, 0.82, 1.1, -3.6, 3.5);
  // bumpers, round headlights, running boards
  M.color(one); M.boxB(body, -1.22, 1.22, 0.78, 1.12, -3.82, -3.62, { bevel: 0.03 });
  for (const sd of [-1, 1]) {
    M.color(TRK.trim); M.save().move(sd * 0.86, 0.96, -3.83).rotX(-Math.PI / 2); M.cyl('steel', 0.13, 0.04, 12); M.restore();
    if (!wreck) { M.color([0.95, 0.95, 0.9]); M.cls = 1; M.save().move(sd * 0.86, 0.96, -3.86).rotX(-Math.PI / 2); M.cyl('glass', 0.105, 0.02, 12); M.restore(); M.color([0.95, 0.55, 0.12]); M.boxB('plastic', sd * 0.5, sd * 0.64, 0.9, 1.0, -3.85, -3.82); M.cls = 0; }
    M.color(TRK.trim); for (const y of [0.62, 0.94]) M.boxB('steel', sd * 1.0, sd * 1.22, y, y + 0.04, -3.68, -3.46);
  }
  // cab: tall body, slightly raked front face, slatted grille, domed roof, marker lights
  M.color(wreck ? TRK.rust : [1, 1, 1]);
  if (wreck) M.boxB(body, -1.2, 1.2, 1.25, 2.66, -3.72, -2.0, { bevel: 0.07 });
  else {
    M.boxB(body, -1.2, 1.2, 1.25, 1.9, -3.72, -2.0, { bevel: 0.07 });
    cabShell(M, body, 1.2, 1.9, 2.64, -3.72, -2.0, [['av', -1.08, -0.04, 1.98, 2.56], ['av', 0.04, 1.08, 1.98, 2.56], ...['g', 'd'].flatMap((f) => [[f, -3.5, -2.85, 1.94, 2.5], [f, -2.7, -2.25, 2.1, 2.5]])]);
    carInterior(M, { x: 1.08, za: -3.66, zb: -2.06, Y0: () => 1.88, Y1: () => 2.62, zSeat: -2.36, zRear: -9, dash: 0.32, wheelR: 0.22 });
  }
  for (const [z0, z1] of [[-3.72, -3.46], [-2.24, -2.0]]) M.boxB(body, -1.2, 1.2, 1.06, 1.3, z0, z1, { bevel: 0.03 });
  M.loft(body, [{ z: -3.68, w: 1.17, yb: 2.6, yt: 2.86, ym: 2.62, n: 4 }, { z: -2.04, w: 1.17, yb: 2.6, yt: 2.88, ym: 2.62, n: 4 }], 16, { caps: true });
  for (const x of [-0.56, 0.56]) truckPane(M, 'z', -1, 3.72, x - 0.52, x + 0.52, 1.98, 2.56, wreck, o.dust);
  M.color([0.03, 0.03, 0.03]); M.boxB('dark', -0.9, 0.9, 1.36, 1.84, -3.735, -3.715);
  M.color(wreck ? TRK.burnt : [0.84, 0.84, 0.82]); M.cls = 1; for (let i = 0; i < 6; i++) { const y = 1.4 + i * 0.08; M.boxB(body, -0.88, 0.88, y, y + 0.035, -3.75, -3.72); } M.cls = 0;
  for (const sd of [-1, 1]) { truckPane(M, 'x', sd, 1.2, -3.5, -2.85, 1.94, 2.5, wreck, o.dust); truckPane(M, 'x', sd, 1.2, -2.7, -2.25, 2.1, 2.5, wreck, o.dust); }
  M.color(TRK.trim); M.cls = 2;
  for (const sd of [-1, 1]) { for (const z of [-3.58, -2.78]) M.boxB('dark', sd * 1.2 - 0.004, sd * 1.2 + 0.004, 1.2, 2.58, z - 0.004, z + 0.004); M.boxB('steel', sd * 1.2, sd * 1.22, 1.74, 1.78, -2.98, -2.84); }
  M.cls = 0;
  if (!wreck) { M.color([0.95, 0.55, 0.12]); M.cls = 2; for (const x of [-0.4, 0, 0.4]) M.boxB('plastic', x - 0.06, x + 0.06, 2.86, 2.93, -3.62, -3.52); M.cls = 0; }
  for (const sd of [-1, 1]) truckMirror(M, sd, 1.2, 2.2, -3.55, wreck);
  // mudguards of the front wheels (under the cab)
  M.color(TRK.trim); for (const sd of [-1, 1]) M.tube('plastic', 0.045, Array.from({ length: 9 }, (_, i) => { const a = lerp(0.15, Math.PI - 0.15, i / 8); return [sd * 1.18, r + (r + 0.07) * Math.sin(a), -2.85 + (r + 0.07) * Math.cos(a)]; }), 5); // tightened clearance around the wheel (0.12 gap before 5.1)
  // upright spare wheel behind the cab, stack, tank, storage box
  M.save().move(0.35, 1.12, -1.78).rotY(Math.PI / 2); wheel(M, r, 0.36, { side: -1, noTire: wreck, tread: 16, hub: wreck ? null : 'army', rim: wreck ? [0.34, 0.28, 0.24] : [0.32, 0.33, 0.26] }); M.restore();
  M.color(wreck ? TRK.burnt : [0.16, 0.16, 0.15]); M.cls = 1; M.tube('steel', 0.07, [[-0.85, 1.1, -1.88], [-0.85, 3.0, -1.88]], 8); M.cls = 0;
  M.color(one); M.save().move(-1.0, 0.86, -1.5); M.rotX(Math.PI / 2); M.cyl(body, 0.24, 1.0, 12); M.restore();
  M.boxB(body, 0.72, 1.16, 0.62, 1.05, -1.45, -0.6, { bevel: 0.02 });
  M.aoFn = null;
  const load = o.load || 'open';
  truckBed(M, body, -1.55, 3.62, 1.45, 2.15, 2.4, W, 3.28, wreck);
  P.cargo = null;
  if (load === 'tarp') truckTarp(M, -1.49, 3.58, 2.15, 3.0, W, wreck);
  else if (load === 'cargo') P.cargo = truckCargo(M, -1.49, 3.56, 1.45, W, wreck);
  M.restore();
  truckWheels(M, [[-2.85], [1.35], [2.65]], r, 0.38, 0.98, { tread: 16, hub: 'army', rim: wreck ? null : [0.32, 0.33, 0.26], wreck, lo });
}
/* Forward-cab delivery carrier (7.6 x 2.45 m): flat cab with a large chrome grille and dual round headlights, ribbed van
   body, rear doors with espagnolette locks, color band (the cab's tint); o.reefer: refrigeration unit on the front face of the body */
function boxTruckBuild(M, P, o) {
  const wreck = !!o.wreck, cab = wreck ? 'paint' : o.dust ? 'paint' : 'carpaint', r = 0.5, lo = wreck ? -r * 0.38 : 0, W = 1.22, one = wreck ? TRK.burnt : [1, 1, 1];
  const chrome = wreck ? TRK.burnt : [0.85, 0.85, 0.85];
  P.tintable = wreck ? null : [cab];
  M.local(1); M.save().move(0, lo, 0);
  M.aoFn = (x, y) => lerp(0.55, 1, smoothstep(0.6, 1.6, y - lo));
  M.color([0.12, 0.12, 0.11]); for (const x of [-0.45, 0.45]) M.boxB('steel', x - 0.07, x + 0.07, 0.62, 0.9, -3.6, 3.45);
  // flat cab, chrome grille, dual headlights, chrome bumper
  M.color(wreck ? TRK.rust : [1, 1, 1]);
  if (wreck) M.boxB(cab, -1.2, 1.2, 1.05, 2.62, -3.72, -2.2, { bevel: 0.06 });
  else {
    M.boxB(cab, -1.2, 1.2, 1.05, 1.88, -3.72, -2.2, { bevel: 0.06 });
    cabShell(M, cab, 1.2, 1.88, 2.62, -3.72, -2.2, [['av', -1.07, -0.07, 1.96, 2.52], ['av', 0.07, 1.07, 1.96, 2.52], ...['g', 'd'].flatMap((f) => [[f, -3.5, -2.85, 1.92, 2.5], [f, -2.7, -2.4, 2.05, 2.5]])]);
    carInterior(M, { x: 1.08, za: -3.66, zb: -2.26, Y0: () => 1.86, Y1: () => 2.62, zSeat: -2.5, zRear: -9, dash: 0.32, wheelR: 0.22 });
  }
  for (const [z0, z1] of [[-3.72, -3.44], [-2.38, -2.2]]) M.boxB(cab, -1.2, 1.2, 0.86, 1.1, z0, z1, { bevel: 0.03 });
  M.color(TRK.trim); for (const sd of [-1, 1]) M.tube('plastic', 0.04, Array.from({ length: 9 }, (_, i) => { const a = lerp(0.2, Math.PI - 0.2, i / 8); return [sd * 1.17, r + (r + 0.07) * Math.sin(a), -2.9 + (r + 0.1) * Math.cos(a)]; }), 5);
  M.color(wreck ? TRK.rust : [1, 1, 1]);
  M.boxB(cab, -1.17, 1.17, 2.62, 2.76, -3.68, -2.24, { bevel: 0.05 });
  for (const x of [-0.57, 0.57]) truckPane(M, 'z', -1, 3.72, x - 0.5, x + 0.5, 1.96, 2.52, wreck, o.dust);
  for (const sd of [-1, 1]) { truckPane(M, 'x', sd, 1.2, -3.5, -2.85, 1.92, 2.5, wreck, o.dust); truckPane(M, 'x', sd, 1.2, -2.7, -2.4, 2.05, 2.5, wreck, o.dust); }
  M.color(chrome); M.boxB('steel', -0.66, 0.66, 1.0, 1.86, -3.75, -3.7, { bevel: 0.015 });
  M.color([0.03, 0.03, 0.03]); M.boxB('dark', -0.6, 0.6, 1.05, 1.81, -3.755, -3.74);
  if (!wreck) {
    M.color(chrome); M.cls = 1; for (let i = 0; i < 11; i++) { const x = -0.55 + i * 0.11; M.boxB('steel', x - 0.015, x + 0.015, 1.05, 1.81, -3.765, -3.75); }
    for (const sd of [-1, 1]) for (const dx of [0, 0.22]) { M.save().move(sd * (0.82 + dx), 1.5, -3.73).rotX(-Math.PI / 2); M.color(chrome); M.cyl('steel', 0.1, 0.03, 12); M.color([0.95, 0.95, 0.9]); M.cyl('glass', 0.08, 0.045, 12); M.restore(); }
    M.color([0.95, 0.55, 0.12]); for (const sd of [-1, 1]) M.boxB('plastic', sd * 0.8, sd * 1.05, 1.22, 1.3, -3.74, -3.72);
    M.cls = 2; for (const x of [-0.4, 0, 0.4]) M.boxB('plastic', x - 0.06, x + 0.06, 2.76, 2.82, -3.6, -3.5); M.cls = 0;
  }
  M.color(chrome); M.boxB('steel', -1.22, 1.22, 0.58, 0.88, -3.84, -3.68, { bevel: 0.03 });
  M.color(TRK.trim); M.cls = 2; for (const sd of [-1, 1]) for (const z of [-3.58, -2.78]) M.boxB('dark', sd * 1.2 - 0.004, sd * 1.2 + 0.004, 1.0, 2.55, z - 0.004, z + 0.004); M.cls = 0;
  for (const sd of [-1, 1]) { truckMirror(M, sd, 1.2, 2.15, -3.58, wreck); M.color(TRK.trim); for (const y of [0.5, 0.8]) M.boxB('steel', sd * 1.0, sd * 1.22, y, y + 0.04, -3.68, -3.44); }
  // van body: panels, ribs, rails, color band, rear doors; fridge refrigeration unit
  M.color(wreck ? TRK.rust : [0.94, 0.94, 0.92]);
  M.boxB('paint', -W, W, 1.0, 3.55, -2.1, 3.6, { bevel: 0.04 });
  M.color(wreck ? TRK.burnt : [0.8, 0.8, 0.78]); M.cls = 1;
  for (let z = -1.85; z < 3.4; z += 0.58) for (const sd of [-1, 1]) M.boxB('steel', sd * W - (sd > 0 ? 0.004 : 0.022), sd * W + (sd > 0 ? 0.022 : 0.004), 1.02, 3.53, z - 0.035, z + 0.035);
  for (const y of [1.0, 3.5]) for (const sd of [-1, 1]) M.boxB('steel', sd * W - (sd > 0 ? 0.004 : 0.03), sd * W + (sd > 0 ? 0.03 : 0.004), y, y + 0.06, -2.1, 3.6);
  M.cls = 0;
  if (!wreck) { M.color([1, 1, 1]); M.cls = 1; for (const sd of [-1, 1]) M.boxB(cab, sd * W - (sd > 0 ? 0.004 : 0.03), sd * W + (sd > 0 ? 0.03 : 0.004), 1.45, 1.7, -1.9, 3.4); M.cls = 0; }
  M.color(wreck ? TRK.burnt : [0.85, 0.85, 0.83]); M.boxB('steel', -W + 0.04, W - 0.04, 1.06, 3.5, 3.6, 3.64);
  M.color(TRK.trim); M.cls = 1;
  M.boxB('dark', -0.006, 0.006, 1.1, 3.45, 3.64, 3.645);
  for (const x of [-0.85, -0.3, 0.3, 0.85]) M.tube('steel', 0.016, [[x, 1.12, 3.665], [x, 3.43, 3.665]], 4);
  for (const sd of [-1, 1]) for (const y of [1.4, 2.3, 3.2]) M.boxB('steel', sd * 1.08, sd * 1.2, y, y + 0.1, 3.64, 3.67);
  M.cls = 0;
  if (o.reefer) {
    M.color(wreck ? TRK.burnt : [0.86, 0.87, 0.88]); M.boxB('paint', -0.85, 0.85, 2.8, 3.45, -2.4, -2.1, { bevel: 0.04 });
    M.color([0.06, 0.06, 0.06]); M.cls = 1; for (const x of [-0.42, 0.42]) { M.save().move(x, 3.12, -2.41).rotX(-Math.PI / 2); M.cyl('dark', 0.24, 0.01, 14); M.restore(); }
    M.color(wreck ? TRK.burnt : [0.7, 0.71, 0.72]); M.cls = 2; for (const x of [-0.42, 0.42]) for (let k = 0; k < 4; k++) M.boxB('steel', x - 0.24, x + 0.24, 2.92 + k * 0.08, 2.935 + k * 0.08, -2.43, -2.415); M.cls = 0;
  }
  // side skirts, tank, rear bar, mudguards
  M.color(TRK.trim); for (const sd of [-1, 1]) M.boxB('steel', sd * (W - 0.08), sd * (W - 0.04), 0.5, 0.96, -1.6, 1.3);
  M.color(wreck ? TRK.burnt : [0.75, 0.76, 0.78]); M.save().move(1.0, 0.72, -2.38).rotX(Math.PI / 2); M.cyl('steel', 0.22, 0.7, 12); M.restore();
  M.color(TRK.trim); M.boxB('steel', -1.05, 1.05, 0.45, 0.58, 3.45, 3.56); for (const sd of [-1, 1]) M.boxB('rubber', sd * 0.6, sd * 1.15, 0.2, 0.95, 2.82, 2.845);
  M.aoFn = null;
  M.restore();
  truckWheels(M, [[-2.9], [2.25, true]], r, 0.28, 0.98, { hub: 'steel', rim: wreck ? null : [0.82, 0.82, 0.8], wreck, lo });
}
/* Truck: model 'army' (military forward cab, GBC style), 'cargo' (forward-cab carrier), 'box' (delivery van); o: { load, reefer, dust,
   wreck }. Old form: PF.truck() for the tarped military one. The model's collisions are in pf.vcols */
PF.truck = (model = 'army', o = {}) => {
  const key = `truck_${model}_${o.load || ''}_${o.reefer ? 1 : 0}${o.dust ? 1 : 0}${o.wreck ? 1 : 0}`;
  return prefab(key, (M, P) => {
    if (model === 'cargo') cargoTruckBuild(M, P, o); else if (model === 'box') boxTruckBuild(M, P, o); else armyTruckBuild(M, P, o);
    P.vcols = truckCols(model, o, P.cargo);
  });
};
/* Collisions of a truck: bumper, chassis and floor, cab, flatbed (up to the top of the side boards, the
   tarp or the load); the wreck is lower */
function truckCols(model, o = {}, cargo) {
  const lo = o.wreck ? (model === 'box' ? -0.48 : -0.55) * 0.38 : 0, L = (b) => [b[0], b[1], b[2] + (b[2] > 0 ? lo : 0), b[3] + lo, b[4], b[5], o.wreck ? undefined : b[6]];
  // (b[6] 'glassPane': the cab above the beltline, hollowed behind its windows, lets bullets and sight lines through)
  let B;
  if (model === 'cargo') {
    const top = o.wreck ? 2.15 : o.load === 'tarp' ? 3.0 : 2.15;
    B = [[-1.22, 1.22, 0, 1.45, -3.82, 3.62], [-1.2, 1.2, 1.45, 1.9, -3.72, -2.0], [-1.2, 1.2, 1.9, 2.86, -3.72, -2.0, 'glassPane'], [-1.25, 1.25, 1.45, top, -1.55, 3.62], [-1.25, 1.25, top, Math.max(top, 2.4), -1.55, -1.49]];
  } else if (model === 'box') {
    B = [[-1.22, 1.22, 0, 1.0, -3.84, 3.64], [-1.2, 1.2, 1.0, 1.88, -3.72, -2.2], [-1.2, 1.2, 1.88, 2.76, -3.72, -2.2, 'glassPane'], [-1.22, 1.22, 1.0, 3.55, -2.1, 3.64]];
    if (o.reefer) B.push([-0.85, 0.85, 2.8, 3.45, -2.4, -2.1]);
  } else {
    const top = o.wreck ? 1.9 : (o.load || 'tarp') === 'tarp' ? 3.05 : 1.9;
    B = [[-1.25, 1.25, 0, 0.94, -3.86, -3.62], [-1.25, 1.25, 0, 1.36, -3.62, 3.62], [-1.2, 1.2, 1.36, 1.9, -3.62, -1.92], [-1.2, 1.2, 1.9, 2.86, -3.62, -1.92, 'glassPane'],
      [-1.25, 1.25, 1.36, top, -1.5, 3.62], [-1.25, 1.25, top, Math.max(top, 2.3), -1.5, -1.44]];
  }
  if (cargo) for (const c of cargo) B.push(c);
  return B.filter((b) => b[3] > b[2] + 0.01).map(L);
}
/* Burnt-out bus (11 m): shell pierced with empty bays, charred interior, on its rims */
PF.busWreck = () => prefab('busWreck', (M) => {
  M.local(1);
  const L = 11, W = 2.5, H = 2.75, hl = L / 2, hw = W / 2, y0 = 0.3;
  M.aoFn = (x, y) => lerp(0.5, 1, smoothstep(0.3, 1.2, y));
  for (const s of [1, -1]) {
    M.save().move(s * hw, y0, s * hl).rotY(s > 0 ? Math.PI / 2 : -Math.PI / 2);
    const ops = []; for (let i = 0; i < 7; i++) { const x = 1.3 + i * 1.3; ops.push({ x0: x, x1: x + 1.05, y0: 1.0, y1: 1.9, depth: 0.06 }); }
    M.color([1, 1, 1]); wallPierced(M, 'charred', L, 0, H, ops, { depth: 0.06 });
    M.restore();
  }
  for (const s of [1, -1]) { M.save().move(0, y0, s * hl); M.boxB('charred', -hw, hw, 0, 1.0, -0.04, 0.04); M.boxB('charred', -hw, hw, 2.2, H, -0.04, 0.04); M.restore(); }
  M.boxB('charred', -hw, hw, y0 + H, y0 + H + 0.06, -hl, hl);
  M.color([0.08, 0.08, 0.08]); M.boxB('dark', -hw + 0.05, hw - 0.05, y0, y0 + 0.2, -hl, hl);
  M.aoFn = null; M.ao = 0.5;
  // seat skeletons
  M.color([0.3, 0.26, 0.22]);
  for (let z = -hl + 1.2; z < hl - 1; z += 0.85) for (const s of [-1, 1]) { M.boxB('charred', s * 0.3, s * 1.1, y0 + 0.2, y0 + 0.65, z, z + 0.45); M.boxB('charred', s * 0.3, s * 1.1, y0 + 0.65, y0 + 1.2, z + 0.38, z + 0.45); }
  M.ao = 1;
  for (const z of [-3.8, 3.4]) for (const s of [-1, 1]) { M.save().move(s * 1.1, -0.2, z); wheel(M, 0.45, 0.28, { noTire: true, rim: [0.25, 0.22, 0.2], side: s }); M.restore(); }
});
