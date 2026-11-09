/* ==========================================================================
   THE GREAT GREENHOUSE of Floralia: sage-green painted iron framework and barrel-vault glasshouse roof (38 x 26 m nave, ridge at 11.5 m),
   the Rock (3.6 m high rockery mass at the back of the greenhouse) with its cave, its window onto the waterfall and its
   ramps, the canopy walkway that extends its terrace over the ravine. The glazing is transparent but stops
   soldiers and shots: the greenhouse is a shelter, neither the bots nor the helicopter see or shoot into it from outside, except through the doors
   and through the walkway passage (`solid` glass walls, `ray` box roof).
   Reference: x toward the east, z toward the south; the greenhouse occupies FL.greenhouse = [x0, x1, z0, z1].
   ========================================================================== */
/* Plan: the Great Greenhouse (x0, x1, z0, z1), the height of its glass walls, of its nave, and that of the high terraces (Rock, walkway, plateau) */
const FL = { greenhouse: [-19, 19, -13, 13], wallH: 3.8, apex: 11.5, high: 3.6 };
const GREENHOUSE_IRON = [0.5, 0.7, 0.52];
/* Invisible glass wall: stops soldiers, but not shots (railing, ramp sides); solid: also stops shots, grenades and the bots' view (greenhouse glazing) */
function glassWall(x0, x1, y0, y1, z0, z1, solid = false) { COL.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0, y1, z0: Math.min(z0, z1), z1: Math.max(z0, z1), m: 'glass', ray: false, noRay: !solid }); }
/* Barrel-vault profile of the nave: height of the vault at position z */
function greenhouseArchY(z) { const A = (FL.greenhouse[3] - FL.greenhouse[2]) / 2; return FL.wallH + (FL.apex - FL.wallH) * Math.sqrt(Math.max(0, 1 - (z / A) * (z / A))); }

/* Flat glazing: transparent glass quadrilateral (points in the current frame), with its normal */
function glassQuad(M, p0, p1, p2, p3, n) { M.save().color([0.88, 1, 0.94]); M.cls = 1; M.quad('glassT', p0, p1, p2, p3, n); M.restore(); }

function greenhouseShell() {
  const [x0, x1, z0, z1] = FL.greenhouse, A = (z1 - z0) / 2, wH = FL.wallH, apex = FL.apex, B = apex - wH, M = DECOR, NR = 12, bay = (x1 - x0) / NR, NA = 24;
  // doors of the long walls (x0, x1), identical on the north and south; no arch leg or rail crosses them
  const doors = [[-13.5, -10.5], [-2.1, 2.1]];
  // arches: one rib every 3 m (the two strongest are the gables)
  const arc = (x, j) => { const th = (j / NA) * Math.PI; return [x, wH + B * Math.sin(th), -A * Math.cos(th)]; };
  M.save().color(GREENHOUSE_IRON).local(1);
  for (let k = 0; k <= NR; k++) {
    const x = x0 + k * bay, pts = []; for (let j = 0; j <= NA; j++) pts.push(arc(x, j));
    M.tube('paint', k === 0 || k === NR ? 0.11 : 0.075, pts, 6, { uAround: 0.5 });
    // inner molding and knee braces: a second, smaller curve, linked by rungs
    const inner = []; for (let j = 2; j <= NA - 2; j++) { const q = arc(x, j); inner.push([q[0], q[1] - 0.32, q[2] * 0.985]); }
    M.tube('paint', 0.03, inner, 5);
    for (let j = 3; j <= NA - 3; j += 2) { const a = arc(x, j); M.tube('paint', 0.02, [a, [a[0], a[1] - 0.32, a[2] * 0.985]], 4); }
    if (!doors.some(([da, db]) => x > da - 0.1 && x < db + 0.1)) for (const sd of [-1, 1]) M.tube('paint', 0.09, [[x, 0, sd * A], [x, wH, sd * A]], 6);
  }
  // longitudinal purlins and ridge beam
  for (let j = 1; j < NA; j++) { const w = j === NA / 2 ? 0.07 : j % 2 ? 0.028 : 0.04; M.tube('paint', w, [arc(x0, j), arc(x1, j)], 5); }
  // gutters and edge beams; the two low rails stop at the doors (a bar across a door would look like it blocked the way)
  for (const sd of [-1, 1]) {
    // (3 cm set back from the gables: their end in the glazing plane flickered)
    M.boxB('paint', x0 + 0.03, x1 - 0.03, wH - 0.12, wH + 0.12, sd * A - 0.12, sd * A + 0.12);
    for (const [ya, yb, t] of [[0.9, 1.0, 0.06], [2.5, 2.58, 0.04]]) { let c = x0 + 0.03; for (const [da, db] of doors) { if (da > c) M.boxB('paint', c, da, ya, yb, sd * A - t, sd * A + t); c = db; } if (x1 - 0.03 > c) M.boxB('paint', c, x1 - 0.03, ya, yb, sd * A - t, sd * A + t); }
  }
  M.restore();
  // vault panes (normal: outward from the ellipse)
  for (let k = 0; k < NR; k++) for (let j = 0; j < NA; j++) {
    const a = arc(x0 + k * bay, j), b = arc(x0 + (k + 1) * bay, j), c = arc(x0 + (k + 1) * bay, j + 1), d = arc(x0 + k * bay, j + 1), th = ((j + 0.5) / NA) * Math.PI;
    glassQuad(M, a, b, c, d, [0, A * Math.sin(th), -B * Math.cos(th)]);
  }
  // gables: glazing between the uprights, under the vault curve (west: axial door; east: canopy walkway passage and, at ground level,
  // the two mouths of the cave tunnels, GREENHOUSE_TUNNELS). Each passage [za, zb, bottom, top] is truly open: no glass, mullion or crossbar between its jambs
  for (const [x, dir] of [[x0, -1], [x1, 1]]) {
    const ops = dir < 0 ? [[-2.3, 2.3, 0, 4.2]] : [[-1.4, 1.4, FL.high, FL.high + 2.8], ...GREENHOUSE_TUNNELS.map(([a, b]) => [a, b, 0, CRAG.roof])];
    const opAt = (z) => ops.find(([a, b]) => z > a + 1e-6 && z < b - 1e-6);
    // extent of the crossbars at height y (under the curve), minus the passages that cut across
    const rails = (y) => {
      const w = y <= wH ? A : A * Math.sqrt(Math.max(0, 1 - ((y - wH) / B) ** 2)), lo = Math.max(z0, -w + 0.1), hi = Math.min(z1, w - 0.1);
      if (hi - lo < 0.2) return [];
      let segs = [[lo, hi]];
      for (const [oa, ob, oy0, oy1] of ops) if (y >= oy0 - 0.02 && y <= oy1 + 0.1) segs = segs.flatMap(([p, q]) => [[p, Math.min(q, oa)], [Math.max(p, ob), q]]).filter((r) => r[1] - r[0] > 0.1);
      return segs;
    };
    M.save().color(GREENHOUSE_IRON).local(1);
    for (let z = z0 + 1; z < z1 - 0.5; z += 1.0) {
      const yt = greenhouseArchY(z) - 0.05, op = opAt(z), parts = op ? [[0.9, op[2]], [op[3] + 0.1, yt]] : [[0.9, yt]];
      for (const [lo, hi] of parts) if (hi - lo > 0.05) M.boxB('paint', x - 0.04, x + 0.04, lo, hi, z - 0.03, z + 0.03);
    }
    for (const y of [2.5, 4.6, 6.6, 8.3, 9.7]) for (const [ra, rb] of rails(y)) M.boxB('paint', x - 0.04, x + 0.04, y - 0.03, y + 0.03, ra, rb);
    M.restore();
    // glazing: one-meter strips, cut at the jambs of the passages
    const zs = [...new Set([...Array.from({ length: Math.round(z1 - z0) + 1 }, (_, k) => z0 + k), ...ops.flatMap((o) => [o[0], o[1]])])].sort((p, q) => p - q);
    for (let k = 0; k < zs.length - 1; k++) {
      const za = zs[k], zb = zs[k + 1], ya = greenhouseArchY(za) - 0.08, yb = greenhouseArchY(zb) - 0.08, op = opAt((za + zb) / 2);
      if (op) {
        if (op[2] > 0.9) glassQuad(M, [x, 0.9, za], [x, 0.9, zb], [x, op[2], zb], [x, op[2], za], [dir, 0, 0]);
        glassQuad(M, [x, op[3], za], [x, op[3], zb], [x, yb, zb], [x, ya, za], [dir, 0, 0]);
      } else glassQuad(M, [x, 0.9, za], [x, 0.9, zb], [x, yb, zb], [x, ya, za], [dir, 0, 0]);
    }
    // gable plinth: interrupted by the passages at ground level (west door, cave tunnels); under the east walkway, it stays whole.
    // At the tunnels, it stops 4 cm short of their rock walls (in their plane, the two flickered)
    let c = z0; const g = dir > 0 ? 0.04 : 0;
    for (const [oa, ob] of ops.filter((o) => o[2] < 0.9).sort((p, q) => p[0] - q[0])) { if (oa - g > c) box('ashlar', x - 0.25, x + 0.25, 0, 0.9, c, oa - g, { tint: [0.9, 0.86, 0.76], m: 'concrete', uv: 2.4 }); c = ob + g; }
    if (z1 > c) box('ashlar', x - 0.25, x + 0.25, 0, 0.9, c, z1, { tint: [0.9, 0.86, 0.76], m: 'concrete', uv: 2.4 });
  }
  // doorways of the cave tunnels in the east gable: iron jambs and lintel, like the walkway passage above
  M.save().color(GREENHOUSE_IRON).local(1);
  for (const [a, b] of GREENHOUSE_TUNNELS) { for (const z of [a, b]) M.boxB('paint', x1 - 0.12, x1 + 0.12, 0, CRAG.roof + 0.1, z - 0.07, z + 0.07, { bevel: 0.01 }); M.boxB('paint', x1 - 0.12, x1 + 0.12, CRAG.roof, CRAG.roof + 0.2, a, b); }
  M.restore();
  // long walls: stone plinth, glazing and uprights every 1.5 m, door openings
  for (const sd of [-1, 1]) {
    const zc = sd * A, d = doors;
    let cur = x0;
    const seg = (a, b) => {
      if (b - a < 0.05) return;
      box('ashlar', a, b, 0, 0.9, zc - 0.25, zc + 0.25, { tint: [0.9, 0.86, 0.76], m: 'concrete', uv: 2.4 });
      glassWall(a, b, 0.9, wH, zc - 0.1, zc + 0.1, true);
      glassQuad(M, [a, 0.9, zc], [b, 0.9, zc], [b, wH, zc], [a, wH, zc], [0, 0, sd]);
      M.save().color(GREENHOUSE_IRON).local(1); for (let x = Math.ceil(a / 1.5) * 1.5; x < b - 0.05; x += 1.5) M.boxB('paint', x - 0.035, x + 0.035, 0.9, wH, zc - 0.035, zc + 0.035); M.restore();
    };
    for (const [da, db] of d) { seg(cur, da); cur = db; // door: uprights and arched lintel
      M.save().color(GREENHOUSE_IRON).local(1); for (const x of [da, db]) M.boxB('paint', x - 0.07, x + 0.07, 0, 3.7, zc - 0.07, zc + 0.07, { bevel: 0.01 });
      M.boxB('paint', da, db, 3.4, 3.8, zc - 0.05, zc + 0.05); M.restore();
      glassQuad(M, [da, 3.4, zc], [db, 3.4, zc], [db, wH, zc], [da, wH, zc], [0, 0, sd]);
    }
    seg(cur, x1);
  }
  // west door (nave axis), large two-leaf glass door
  M.save().color(GREENHOUSE_IRON).local(1);
  for (const z of [-2.3, 2.3]) M.boxB('paint', x0 - 0.12, x0 + 0.12, 0, 4.4, z - 0.08, z + 0.08, { bevel: 0.01 });
  M.boxB('paint', x0 - 0.1, x0 + 0.1, 4.2, 4.6, -2.3, 2.3); M.restore();
}

/* The walls of the west gable around the door (the gable plinth lets the axis through): no collision on the door */
function greenhouseWalls() {
  const [x0, x1, z0, z1] = FL.greenhouse, wH = FL.wallH, A = (z1 - z0) / 2;
  // gables: impassable glass wall except the west door; the canopy walkway opens the east gable (see greenhouseCatwalk), and so do
  // the two cave tunnels at ground level (the glass starts above their lintel)
  glassWall(x0 - 0.05, x0 + 0.05, 0, 11.5, z0, -2.3, true); glassWall(x0 - 0.05, x0 + 0.05, 0, 11.5, 2.3, z1, true);
  const [ta, tb] = GREENHOUSE_TUNNELS[1];
  for (const [a, b, y0] of [[z0, -tb, 0], [-tb, -ta, CRAG.roof], [-ta, -1.4, 0], [1.4, ta, 0], [ta, tb, CRAG.roof], [tb, z1, 0]]) glassWall(x1 - 0.05, x1 + 0.05, y0, 11.5, a, b, true);
  // roof: one box per mesh cell of the vault (stops shots only: you do not walk on it), following the curve from one arch to the next
  const B = FL.apex - wH, NA = 24;
  for (let j = 0; j < NA; j++) {
    const a = (j / NA) * Math.PI, b = ((j + 1) / NA) * Math.PI, za = -A * Math.cos(a), zb = -A * Math.cos(b), ya = wH + B * Math.sin(a), yb = wH + B * Math.sin(b);
    COL.push({ x0, x1, y0: Math.min(ya, yb) - 0.12, y1: Math.max(ya, yb) + 0.12, z0: Math.min(za, zb), z1: Math.max(za, zb), m: 'glass', ray: true });
  }
}

/* ---------- Rockery: blocks, walls ---------- */
/* Faceted rock block (like PF.boulder) in the rockery material: pinkish ochre sandstone, tint of your choice */
PF.rockG = (seed = 1, rx = 1.2, ry = 1, rz = 1.2) => prefab(`rockG${seed}_${rx}_${ry}_${rz}`, (M) => {
  const R = rngOf(seed * 131 + 11), P = [], ph = [R() * TAU, R() * TAU, R() * TAU];
  for (let i = 0; i < 9; i++) { const a = R() * TAU, b = Math.acos(R.range(-0.6, 1)); P.push([Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a), R.range(0.62, 0.9)]); }
  const k = R.range(0.86, 1.04);
  M.save().color([k, k * 0.97, k * 0.94]).world(1).move(0, ry * 0.7, 0);
  M.aoFn = (x, y) => lerp(0.6, 1, smoothstep(-ry * 0.5, ry * 0.4, y));
  M.surf('rockery', 14, 9, (u, v) => {
    const a = u * TAU, b = v * Math.PI, sb = Math.sin(b), dx = sb * Math.cos(a), dy = -Math.cos(b), dz = sb * Math.sin(a);
    let r = 1 + sb * (0.09 * Math.sin(3 * a + ph[0]) * Math.sin(2 * b + ph[1]) + 0.05 * Math.sin(5 * a + ph[2]));
    for (const p of P) { const d = dx * p[0] + dy * p[1] + dz * p[2]; if (d > 0.05) r = Math.min(r, p[3] / d); }
    return [dx * r * rx, dy * r * ry, dz * r * rz];
  }, { closeU: true, flipN: true, pole: (v) => [0, v < 0.5 ? -1 : 1, 0], uL: TAU * Math.max(rx, rz), vL: Math.PI * ry });
  M.restore();
});
/* Bumpy rockery wall: plane x = o.x, from z0 to z1 and from y0 to y1, advancing by o.bulge m toward o.out (+1: toward +x, -1: toward -x).
   Strata in steps, overhang at the top. o: seed, bulge, tint, top (overhang, m) */
function rockFace(o) {
  const M = DECOR, N = makeNoise(o.seed || 3), alongX = o.axis === 'x', a0 = alongX ? o.x0 : o.z0, a1 = alongX ? o.x1 : o.z1, L = a1 - a0, H = o.y1 - o.y0, out = o.out || 1;
  const bl = o.bulge !== undefined ? o.bulge : 0.5, tp = o.top !== undefined ? o.top : 0.5, base = alongX ? o.z : o.x;
  M.save().color(o.tint || [1, 1, 1]).world(1); M.cls = 0;
  M.aoFn = (x, y) => lerp(0.55, 1, smoothstep(o.y0, o.y0 + 1.6, y));
  M.surf('rockery', Math.max(3, Math.round(L / 0.7)), Math.max(3, Math.round(H / 0.5)), (u, v) => {
    const t = a0 + u * L, y = o.y0 + v * H, n = N.fbm(t * 0.05 + 3, y * 0.07, 32, 32, 4), n2 = N.fbm(t * 0.2, y * 0.25 + 9, 32, 32, 3), st = Math.floor(y / 0.9) * 0.9;
    const d = bl * (0.1 + n * 0.85) + smoothstep(st + 0.45, st + 0.9, y) * 0.1 * n2 + Math.max(0, v - 0.8) * 5 * tp * (0.5 + n2) * 0.25;
    return alongX ? [t, y, base + out * d] : [base + out * d, y, t];
  }, { uL: L, vL: H, flipN: alongX ? out < 0 : out > 0 });
  M.aoFn = null; M.restore();
}
/* Cluster of rock blocks along a segment (wall foot, banks): n blocks between (xa, za) and (xb, zb) at height y */
function rockPile(xa, za, xb, zb, y, n, seed, sc = 1, tint) {
  const R = rngOf(seed), M = DECOR;
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0.5, rx = R.range(0.5, 1.1) * sc, ry = R.range(0.35, 0.8) * sc, rz = R.range(0.5, 1.1) * sc;
    M.place(PF.rockG(1 + Math.floor(R() * 9), Math.round(rx * 4) / 4, Math.round(ry * 4) / 4, Math.round(rz * 4) / 4), lerp(xa, xb, t) + R.range(-0.3, 0.3), y - ry * 0.3, lerp(za, zb, t) + R.range(-0.3, 0.3), R() * TAU, { nocol: true, tint });
  }
}

/* ---------- Cascades ---------- */
const WFALLS = [];
const WF_VERT = `varying vec2 vUv; uniform float uT;
void main() { vUv = uv; vec3 p = position;
  float k = 1.0 - uv.y; p.x *= 1.0 + 0.22 * k; p.z += sin(uv.y * 15.0 - uT * 6.5 + p.x * 3.0) * 0.035 + k * k * 0.1;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`;
const WF_FRAG = `varying vec2 vUv; uniform float uT; uniform vec3 uTint;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }
void main() {
  float y = vUv.y;
  vec2 q = vec2(vUv.x * 14.0, y * 3.0 + uT * 2.7);
  float a = n(q) * 0.5 + n(q * vec2(2.3, 2.1) + 7.0) * 0.3 + n(vec2(vUv.x * 44.0, y * 10.0 + uT * 5.2)) * 0.2;
  float streak = smoothstep(0.34, 0.78, a), edge = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x), foam = smoothstep(0.16, 0.0, y), top = smoothstep(0.97, 0.9, y);
  vec3 col = mix(vec3(0.5, 0.74, 0.8), vec3(1.0), streak * 0.85 + foam) * uTint;
  float alpha = (0.32 + 0.52 * streak + foam * 0.45) * edge * (0.55 + 0.45 * top);
  gl_FragColor = vec4(col, alpha);
}`;
/* Falling sheet of water: vertical plane in x (face toward +x if dir = 1), from yTop to yBot, from z0 to z1. Returns the mesh */
function waterfallAdd(x, yTop, yBot, z0, z1, dir = -1, tint = [1.05, 1.08, 1.05]) {
  const m = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uTint: { value: new V3(...tint) } }, vertexShader: WF_VERT, fragmentShader: WF_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  m.userData.noAO = true;
  const g = new THREE.PlaneGeometry(z1 - z0, yTop - yBot, 8, 18), mesh = new THREE.Mesh(g, m);
  mesh.position.set(x, (yTop + yBot) / 2, (z0 + z1) / 2); mesh.rotation.y = Math.PI / 2 * (dir > 0 ? 1 : -1);
  mesh.updateMatrix(); mesh.matrixAutoUpdate = false; mesh.userData.noPrepass = true; mesh.userData.noAO = true; mesh.renderOrder = 4;
  mapAdd(mesh); WFALLS.push({ mesh, m, x, y: yBot, z: (z0 + z1) / 2, w: z1 - z0 });
  return mesh;
}
/* Waterfall animation: clock of the sheets, mist and droplets at the foot */
function waterfallsUpdate(t, dt) {
  const cam = camera.position;
  for (const w of WFALLS) {
    w.m.uniforms.uT.value = t;
    if (Math.abs(w.x - cam.x) > 40 || Math.abs(w.z - cam.z) > 40) continue;
    const n = (w.w * 9 * dt); let k = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
    while (k-- > 0) {
      const z = w.z + (Math.random() - 0.5) * w.w, px = w.x + (Math.random() - 0.5) * 0.8;
      FX.smoke.spawn(px, w.y + 0.05, z, rand(-0.5, 0.5), rand(0.5, 1.4), rand(-0.5, 0.5), rand(0.9, 1.6), 0.15, rand(0.5, 0.9), 0.9, 0.95, 0.97, 0.15, 0, 0.8, 1.0, rand(-1, 1));
    }
  }
}

/* ---------- The Rocher: rockery massif, cave, ramps, terrace ---------- */
/* East edge of the greenhouse and of the Rock, terrace level */
const CRAG = { x0: 9.5, x1: 18.8, y: FL.high, cave: [11.5, 14.5], roof: 2.8 };
/* The two cave tunnels (z ranges, north then south): from the ends of the cave, behind the outermost jambs, they run east under the
   terrace and come out through the east gable into the ravine, under the walkway's level. Each side has its own, mirrored */
const GREENHOUSE_TUNNELS = [[-7.5, -5.5], [5.5, 7.5]];
function greenhouseRock() {
  const M = DECOR, { x0, x1, y } = CRAG, tint = [0.97, 0.96, 0.95], U = 3.2, [ta, tb] = GREENHOUSE_TUNNELS[1];
  const solid = (a, b, c, d, e, f, o = {}) => box('rockery', a, b, c, d, e, f, Object.assign({ tint, m: 'concrete', uv: U, skip: 'Y' }, o));
  // (4 cm from the glass walls, z = ±13: in their plane, the rock and the glazing flickered)
  solid(x0, x1, 0, y, -12.96, -tb); solid(x0, x1, 0, y, tb, 12.96); solid(14.5, x1, 0, y, -ta, ta);
  for (const [a, b] of [[-7.5, -5.5], [-3.5, -1.5], [1.5, 3.5], [5.5, 7.5]]) solid(x0, 11.5, 0, CRAG.roof, a, b); // jambs, under the vault (not inside it)
  // behind the outermost jambs, the ends of the cave are no longer dead-end alcoves: the tunnels to the ravine start there (rock above them up to the terrace)
  solid(x0, 14.5, CRAG.roof, y, -7.5, 7.5); for (const sg of [-1, 1]) solid(14.5, x1, CRAG.roof, y, Math.min(sg * ta, sg * tb), Math.max(sg * ta, sg * tb));
  // terrace: ground of earth and leaves at the top (planted further on)
  M.save().color([0.8, 0.72, 0.6]).world(1); M.cls = 1; M.quad('mulch', [x0, y + 0.005, -13], [x1, y + 0.005, -13], [x1, y + 0.005, 13], [x0, y + 0.005, 13], [0, 1, 0]); M.restore();
  // outer walls: west face (pierced by the two cave entrances and the window onto the waterfall), east face, feet
  for (const [a, b, s, yb] of [[-9.6, -5.5, 5, 0], [-3.5, -1.5, 6, -0.7], [1.5, 3.5, 7, -0.7], [5.5, 9.6, 8, 0]]) rockFace({ x: x0, out: -1, z0: a, z1: b, y0: yb, y1: y, seed: s, bulge: 0.55 });
  // east face, over the ravine: whole, except the mouths of the two tunnels (the face only continues above their lintel)
  for (const [a, b, yb] of [[-12.6, -tb, 0], [-tb, -ta, CRAG.roof], [-ta, ta, 0], [ta, tb, CRAG.roof], [tb, 12.6, 0]]) rockFace({ x: x1, out: 1, z0: a, z1: b, y0: yb, y1: y, seed: 11, bulge: 0.7 });
  // lintels and jambs of the entrances: big blocks
  for (const z of [-4.5, 0, 4.5]) { const w = z === 0 ? 3.2 : 2.2; M.place(PF.rockG(2 + Math.abs(z), w * 0.6, 0.55, 1.0), x0 - 0.2, CRAG.roof + 0.5, z, Math.PI / 2, { nocol: true }); }
  // and those of the tunnel mouths on the ravine side: a lintel block, a standing block against each jamb (outside the passage)
  for (const sg of [-1, 1]) {
    const zm = sg * (ta + tb) / 2;
    M.place(PF.rockG(12 + sg, 1.5, 0.5, 0.9), x1 + 0.2, CRAG.roof + 0.35, zm, Math.PI / 2, { nocol: true });
    for (const z of [sg * (ta - 0.5), sg * (tb + 0.5)]) M.place(PF.rockG(14 + sg + Math.sign(z - zm), 0.6, 1.4, 0.5), x1 + 0.15, -0.3, z, 0, { nocol: true });
  }
  rockPile(x0 - 0.5, -9.4, x0 - 0.5, 9.4, 0.1, 18, 71, 1.0);
  // inside the cave and the tunnels: wet stone floor, a few stalactites, light band from the window
  M.save().color([0.6, 0.62, 0.58]).local(1); M.cls = 1; M.quad('flagstone', [x0, 0.02, -7.5], [14.5, 0.02, -7.5], [14.5, 0.02, 7.5], [x0, 0.02, 7.5], [0, 1, 0]);
  for (const [a, b] of GREENHOUSE_TUNNELS) M.quad('flagstone', [14.5, 0.02, a], [x1 + 0.45, 0.02, a], [x1 + 0.45, 0.02, b], [14.5, 0.02, b], [0, 1, 0]);
  M.restore();
  for (let i = 0; i < 14; i++) { const R = rngOf(300 + i), xx = R.range(10, 14.2), zz = R.range(-6.5, 6.5); M.save().move(xx, CRAG.roof, zz).color([0.95, 0.9, 0.86]).world(1); M.cyl('rockery', R.range(0.1, 0.2), -R.range(0.3, 0.7), 6, { r1: 0.01, caps: '' }); M.restore(); }
  for (let i = 0; i < 8; i++) { const R = rngOf(330 + i), xx = R.range(15, 18.3), zz = (i % 2 ? 1 : -1) * R.range(ta + 0.25, tb - 0.25); M.save().move(xx, CRAG.roof, zz).color([0.95, 0.9, 0.86]).world(1); M.cyl('rockery', R.range(0.08, 0.15), -R.range(0.2, 0.45), 6, { r1: 0.01, caps: '' }); M.restore(); }
  // cave lanterns (warm glow), one more halfway along each tunnel
  for (const [x, z] of [[12.5, -4.8], [12.5, 4.8], [13.4, 0], [16.6, -(ta + tb) / 2], [16.6, (ta + tb) / 2]]) { M.save().move(x, CRAG.roof - 0.1, z); M.cls = 1; M.color([1, 0.8, 0.5]); M.cyl('lamp', 0.07, 0.12, 8); M.restore(); M.occ(x - 0.1, x + 0.1, 2.3, 2.7, z - 0.1, z + 0.1, 0); }
  // access ramps to the terrace, north and south, along the glass walls
  for (const s of [-1, 1]) {
    const [a, b] = [s * 9.6, s * 12.4].sort((p, q) => p - q);
    ramp(3.0, x0, a, b, 'x', 0, y, 'flagstone', [0.78, 0.74, 0.66], { mat: 'rockery' });
    rampGuard(3.0, x0, a, b, 'x', 0, y, [s < 0 ? 1 : 0]); // the side facing the nave (the glass wall closes the other)
  }
  // railings at the edge of the terrace (pond side), except in front of the ramps
  railing(x0 + 0.05, x0 + 0.05, y, -9.6, 9.6, 'z'); glassWall(x0 - 0.1, x0 + 0.1, y, y + 1.0, -9.6, 9.6);
  // end of the terrace on the north and south side: the ramps come out there (z from 9.6 to 12.4), no obstacle at their exit; only 0.6 m of edge remains between them and the glass wall
  for (const sg of [-1, 1]) { const za = sg * 12.4, zb = sg * 13; railing(x0 + 0.05, x0 + 0.05, y, Math.min(za, zb), Math.max(za, zb), 'z'); glassWall(x0 - 0.1, x0 + 0.1, y, y + 1.0, za, zb); }
  // ledge above the waterfall: stone lip from which the water pours
  M.save().color([0.9, 0.86, 0.8]).world(1); M.boxB('rockery', x0 - 0.9, x0 + 0.1, y - 0.5, y, -2.4, 2.4, { bevel: 0.08 }); M.restore();
}

/* ---------- Greenhouse pond and waterfall ---------- */
const GREENHOUSE_POND = [[9.5, -2.6], [8.2, -3.0], [7.4, -3.9], [7.0, -5.0], [6.0, -5.9], [4.6, -6.0], [3.5, -5.0], [3.0, -3.2], [2.9, -1.2], [3.2, 1.0], [3.0, 3.0], [3.6, 4.8], [5.0, 5.9], [6.5, 5.7], [7.3, 4.8], [7.6, 3.6], [8.4, 3.0], [9.5, 2.6]];
function greenhousePond() {
  pondBasin(GREENHOUSE_POND, { wl: -0.12, bed: -0.5, jet: 0.9, jc: [8.9, 0], foam: 0.7, deep: [0.004, 0.034, 0.03], shallow: [0.03, 0.12, 0.1], scatter: [0.01, 0.08, 0.06], tint: [0.5, 0.56, 0.46] });
  waterfallAdd(CRAG.x0 - 0.95, FL.high - 0.5, -0.2, -2.2, 2.2, -1);
  for (const z of [-1.7, -0.85, 0, 0.85, 1.7]) rippleSource(CRAG.x0 - 1.2, z, 0.42, -0.008, 0.18, 0.12); // the sheet pounds the pond at its foot
  floatingLilies();
}
/* Canopy walkway: steel deck from the Rock's terrace to the east plateau, through the greenhouse gable */
function greenhouseCatwalk() {
  const M = DECOR, y = FL.high, xa = CRAG.x1, xb = 27.8, hw = 1.1;
  box('steel', xa, xb, y - 0.16, y, -hw, hw, { tint: [0.5, 0.56, 0.54], m: 'metal', ao: false, uv: 1.2 });
  // lattice edge beams and crossbars
  M.save().color(GREENHOUSE_IRON).local(1);
  for (const sd of [-1, 1]) { M.boxB('paint', xa, xb, y - 0.55, y - 0.16, sd * hw - 0.06, sd * hw + 0.06); for (let x = xa + 0.6; x < xb - 0.3; x += 1.2) M.tube('paint', 0.025, [[x, y - 0.55, sd * hw], [x + 0.6, y - 0.16, sd * hw]], 4); }
  for (let x = xa + 1; x < xb; x += 1.6) M.boxB('paint', x - 0.04, x + 0.04, y - 0.35, y - 0.17, -hw, hw);
  // pylons
  for (const x of [22.2, 25.2]) for (const sd of [-1, 1]) { M.save().move(x, 0, sd * 0.9); M.cyl('paint', 0.13, y - 0.4, 8); M.restore(); DECOR.col(x - 0.14, x + 0.14, 0, y - 0.4, sd * 0.9 - 0.14, sd * 0.9 + 0.14, 'metal'); }
  M.restore();
  for (const sd of [-1, 1]) railing(sd * hw, sd * hw, y, xa, xb, 'x');
  glassWall(xa, xb, y, y + 1.0, -hw - 0.1, -hw + 0.05); glassWall(xa, xb, y, y + 1.0, hw - 0.05, hw + 0.1);
  // framing of the passage in the gable
  M.save().color(GREENHOUSE_IRON).local(1); for (const sd of [-1, 1]) M.boxB('paint', 18.88, 19.12, y, y + 2.9, sd * 1.4 - 0.07, sd * 1.4 + 0.07, { bevel: 0.01 }); M.boxB('paint', 18.88, 19.12, y + 2.8, y + 3.0, -1.4, 1.4); M.restore();
}

/* Rockery outcrops of the nave: one on each half of the central path, inside the plaza, facing the pond (x0..x1 and z0..z1 on the
   south side, mirrored in the north: the planes of its four bumpy faces and of its collision; h, height). The path goes around them by the plaza
   (on the paving: the jungle stays out of the way) or wades along the bank. They close the line of fire that ran from one base to the other through
   the two middle doors, and leave between them a nook in front of the waterfall */
const NAVE_OUTCROP = { x0: -2.2, x1: 2.3, z0: 3.6, z1: 5.4, h: 2.2 };
function greenhouseOutcrops() {
  const M = DECOR, { x0, x1, z0, z1, h } = NAVE_OUTCROP, tint = [0.97, 0.96, 0.95], k = 0.15;
  for (const s of [1, -1]) {
    const R = rngOf(s > 0 ? 9311 : 9312), [a, b] = [s * z0, s * z1].sort((p, q) => p - q), zm = (a + b) / 2;
    // the collision follows the planes of the faces, whose bumps stand out of it (like the Rock): a shot or a ray aimed at the outcrop always
    // meets rock. Behind the faces, a core set back by k fills the corners where two faces part (set back: no flicker against them)
    box('rockery', x0 + k, x1 - k, 0, h, a + k, b - k, { tint, collide: false, m: 'concrete', uv: 3.2, skip: 'Y' });
    DECOR.col(x0, x1, 0, h, a, b, 'concrete');
    rockFace({ x: x0, out: -1, z0: a, z1: b, y0: -0.1, y1: h, seed: 40 + s, bulge: 0.4 }); rockFace({ x: x1, out: 1, z0: a, z1: b, y0: -0.1, y1: h, seed: 42 + s, bulge: 0.4 });
    rockFace({ axis: 'x', z: a, out: -1, x0, x1, y0: -0.1, y1: h, seed: 44 + s, bulge: 0.4 }); rockFace({ axis: 'x', z: b, out: 1, x0, x1, y0: -0.1, y1: h, seed: 46 + s, bulge: 0.4 });
    // boulders along the top edges: the outcrop does not end in a flat box
    for (const [x, z, rx, ry, rz, sd] of [[x0 + 0.5, a + 0.35, 0.7, 0.45, 0.5, 1], [x1 - 0.6, b - 0.3, 0.8, 0.5, 0.45, 2], [(x0 + x1) / 2 + 0.3, s > 0 ? a + 0.25 : b - 0.25, 0.6, 0.35, 0.4, 3], [x1 - 0.35, a + 0.4, 0.45, 0.4, 0.4, 4]]) M.place(PF.rockG(20 + sd + (s > 0 ? 0 : 4), rx, ry, rz), x, h - ry * 0.7, z, R() * TAU, { nocol: true });
    // top: earth, ferns and bromeliads around a tree fern; vines hanging down the long faces
    M.save().color([0.8, 0.72, 0.6]).world(1); M.cls = 1; M.quad('mulch', [x0, h + 0.01, a], [x1, h + 0.01, a], [x1, h + 0.01, b], [x0, h + 0.01, b], [0, 1, 0]); M.restore();
    M.place(PF.treeFern(2.6, s > 0 ? 3 : 5), (x0 + x1) / 2 - 0.4, h, zm, R() * TAU);
    plantBed(R, [x0 + 0.2, x1 - 0.2, a + 0.2, b - 0.2], 26, (RR) => { const k = RR(); return k < 0.45 ? [PF.fern(['fernA', 'fernB', 'fernC'][Math.floor(RR() * 3)], RR.range(0.8, 1.2), 1 + Math.floor(RR() * 6)), 1] : k < 0.75 ? [PF.clump('bromel', 'leafA', 0.9, 0.9, 2, 1 + Math.floor(RR() * 4)), 1] : [PF.clump(['anthurium', 'orchidW', 'orchidP'][Math.floor(RR() * 3)], 'leafA', 0.9, 0.9, 2, 1 + Math.floor(RR() * 4)), 1]; }, () => true, h);
    for (const [z, ry] of [[a - 0.12, Math.PI], [b + 0.12, 0]]) for (let i = 0; i < 3; i++) { const lh = R.range(1.0, 1.6); M.place(PF.liana(R.range(1.0, 1.5), lh, 1 + ((i + (s > 0 ? 0 : 3)) % 6)), lerp(x0 + 0.6, x1 - 0.6, i / 2), h - lh + 0.3, z, ry); }
  }
}
/* Water lilies on the greenhouse pond (the leaves lie flat at water level) */
function floatingLilies() {
  const M = DECOR;
  for (const [x, z, r, n, seed] of [[5.2, -3.6, 1.6, 8, 1], [4.4, 2.4, 1.8, 9, 2], [6.4, 0.4, 1.0, 5, 3]]) M.place(PF.lilies(r, n, seed, 0.4), x, -0.1, z, 0, { cls: 2 });
}

/* ---------- Planting: the greenhouse jungle ---------- */
/* Can a point be planted in the nave (outside the pond, path, plaza, vestibule, banks, ramps and rock)? */
function greenhouseFree(x, z) {
  const [x0, x1, z0, z1] = FL.greenhouse;
  if (x < x0 + 0.7 || x > x1 - 0.7 || z < z0 + 0.7 || z > z1 - 0.7) return false;
  if (polyDist(GREENHOUSE_POND, x, z) > -1.0) return false;
  if (Math.abs(x) < 2.4 || x >= 9.4) return false;
  if (x > -11.2 && x < 2.4 && Math.abs(z) < 7.0) return false;
  if (x < -10.6 && Math.abs(z) < 2.8) return false;
  if (x > -13.4 && x < -10.6 && Math.abs(z) > 6.6) return false;
  if (x > 2.3 && x < 9.6 && Math.abs(z) > 8.8) return false;
  if (x > 6.2 && Math.abs(z) < 7.6) return false;
  return true;
}
function greenhousePlanting() {
  const R = rngOf(9091), M = DECOR, [x0, x1, z0, z1] = FL.greenhouse, nave = [x0 + 0.8, 9.4, z0 + 0.8, z1 - 0.8];
  const lush = (n, seedBase) => (RR) => {
    const k = RR();
    if (k < 0.2) return [PF.rosette('monstera', 'leafA', 1.0, 6, seedBase + Math.floor(RR() * 6)), RR.range(0.8, 1.4)];
    if (k < 0.34) return [PF.rosette('alocasia', 'leafA', 0.85, 6, seedBase + Math.floor(RR() * 6)), RR.range(0.8, 1.4)];
    if (k < 0.44) return [PF.rosette('philo', 'leafA', 0.75, 6, seedBase + Math.floor(RR() * 6)), RR.range(0.8, 1.3)];
    if (k < 0.54) return [PF.rosette('calathea', 'leafA', 0.85, 3, seedBase + Math.floor(RR() * 6)), RR.range(0.8, 1.2)];
    if (k < 0.7) return [PF.fern(['fernA', 'fernB', 'fernC'][Math.floor(RR() * 3)], RR.range(0.9, 1.4), seedBase + Math.floor(RR() * 6)), 1];
    if (k < 0.78) return [PF.clump(['orchidW', 'orchidP', 'orchidY'][Math.floor(RR() * 3)], 'leafA', 0.9, 0.9, 2, seedBase + Math.floor(RR() * 6)), RR.range(0.9, 1.3)];
    if (k < 0.84) return [PF.clump('bromel', 'leafA', 0.9, 0.9, 2, seedBase + Math.floor(RR() * 4)), 1];
    if (k < 0.9) return [PF.clump(['heliconia', 'bird', 'hibiscus'][Math.floor(RR() * 3)], 'leafA', 1.0, 1.0, 2, seedBase + Math.floor(RR() * 4)), RR.range(0.9, 1.5)];
    if (k < 0.95) return [PF.clump(['anthurium', 'arum'][Math.floor(RR() * 2)], 'leafA', 0.9, 0.9, 2, seedBase + Math.floor(RR() * 4)), 1];
    return [PF.rosette('strap', 'leafA', 1.0, 4, seedBase + Math.floor(RR() * 4), { aspect: 1.9 }), RR.range(0.8, 1.3)];
  };
  // understory: dense carpet of large leaves, ferns and exotic flowers
  plantBed(R, nave, 1000, lush(0, 100), greenhouseFree);
  // middle layer: palms, banana plants, tree ferns, trees with glossy leaves; height is limited by the vault (the crown overshoots by 3 m)
  for (let i = 0; i < 190; i++) {
    const x = R.range(nave[0], nave[1]), z = R.range(nave[2], nave[3]), k = R(), s1 = 1 + Math.floor(R() * 6), r1 = R(), r2 = R();
    if (!greenhouseFree(x, z) || polyDist(GREENHOUSE_POND, x, z) > -2.2) continue;
    const H = greenhouseArchY(Math.min(12.6, Math.abs(z) + 3.4)) - 1.3; if (H < 2.4) continue;
    // a trunk is not placed inside another (plantFits); the orientation is drawn as before, so that the rest does not change
    const pf = k < 0.3 && H > 5 ? PF.palmG(Math.min(H, 6.5 + r1 * 4), s1, r2 < 0.5 ? 'palm' : 'palm2') : k < 0.55 && H > 3.2 ? PF.banana(Math.min(H, 2.8 + r1 * 1.4), s1)
      : k < 0.82 ? PF.treeFern(Math.min(H - 0.4, 1.8 + r1 * 1.6), s1) : H > 6 ? PF.tree('ficus', Math.min(H, 7 + r1 * 2.5), 2.6 + r2, s1, { th: 3.2 }) : null;
    if (!pf) continue;
    const ry = R() * TAU;
    if (plantFits(pf, x, z)) M.place(pf, x, 0, z, ry);
  }
  // pond bank: papyrus, iris, a few reeds
  const shore = (RR) => (RR() < 0.5 ? [PF.papyrus(RR.range(1.8, 2.8), 1 + Math.floor(RR() * 6)), 1] : [PF.clump('iris', 'leafB', 0.9, 0.9, 3, 1 + Math.floor(RR() * 6)), RR.range(0.9, 1.3)]);
  plantBed(R, [2.2, 9.5, -7.5, 7.5], 120, shore, (x, z) => { const d = polyDist(GREENHOUSE_POND, x, z); return d < -0.5 && d > -1.9 && x < 9.2 && !(x < 4.2 && Math.abs(z) > 2.8 && Math.abs(z) < 6.4); }); // (not in the passage between the outcrops and the bank)
  // jungle of the Rock: on the terrace, at the foot of the wall and in drooping vines
  const top = [CRAG.x0 + 0.5, CRAG.x1 - 0.5, -12.4, 12.4], tfree = (x, z) => !(x < CRAG.x0 + 1.4 && Math.abs(z) < 9.8) && !(Math.abs(z) > 9.6 && x < CRAG.x0 + 1.2);
  plantBed(R, top, 200, lush(0, 200), tfree, FL.high);
  plantBed(R, top, 28, (RR) => { const k = RR(); return k < 0.35 ? [PF.palmG(RR.range(5.2, 6.8), 1 + Math.floor(RR() * 6), RR() < 0.5 ? 'palm' : 'palm2'), 1] : k < 0.65 ? [PF.banana(RR.range(2.8, 3.8), 1 + Math.floor(RR() * 6)), 1] : [PF.treeFern(RR.range(2, 3.2), 1 + Math.floor(RR() * 6)), 1]; }, tfree, FL.high);
  plantBed(R, [CRAG.x0 - 1.4, CRAG.x0 - 0.2, -9.4, 9.4], 36, (RR) => lush(0, 300)(RR), (x, z) => polyDist(GREENHOUSE_POND, x, z) < -0.7 && (Math.abs(z) > 3.0 || x < 8));
  for (let i = 0; i < 46; i++) { const z = R.range(-9.4, 9.4), h = R.range(1.6, 3.2); if (Math.abs(z) < 1.9) continue; M.place(PF.liana(R.range(1.1, 1.8), h, 1 + (i % 6)), CRAG.x0 - 0.12, FL.high - h + 0.35, z, -Math.PI / 2); }
  // vines of the vault: they hang from the arches, at all heights
  for (let i = 0; i < 90; i++) {
    const k = R.range(0.5, 12 - 0.5), x = x0 + k * 3 + R.range(-0.3, 0.3), th = R.range(0.22, 0.78) * Math.PI, z = -13 * Math.cos(th), ya = FL.wallH + (FL.apex - FL.wallH) * Math.sin(th), h = R.range(2.2, 4.0);
    if (x > 8.5 && ya - h < FL.high + 1.0 && Math.abs(z) < 11) continue;
    M.place(PF.liana(R.range(1.1, 1.9), h, 1 + (i % 6)), x, ya - h + 0.35, z, R() * TAU);
  }
  // around the plaza: benches and stone basin at the center
  basin(-4.5, 0, 1.4, { pillar: false, jet: 0.35, tint: [0.88, 0.86, 0.8] });
  for (const [x, z] of [[-10.3, -4.2], [-10.3, 4.2], [-8, -6.3], [-8, 6.3]]) benchAt(x, z, -4.5, 0); // around the basin
  // (the two benches at the edge of the plaza, facing the pond, made way for the rockery outcrops: greenhouseOutcrops)
}
