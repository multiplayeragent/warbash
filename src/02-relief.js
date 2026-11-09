/* ==========================================================================
   RELIEF AND ROUND ZONE: the terrain of a map that declares it (Sirocco's dunes), and the circle outside which you die.
   Without relief, the ground stays the implicit plane y = 0 of the other maps; without a zone, the definition's rectangular bounds hold you back.
   - Relief (MAP_DEFS.<id>.relief = { fn(x, z): height, pad }): a 1 m height grid covers the map bounds and pad m
     around them, sampled at load (reliefBuild). Each cell is cut into two triangles by its diagonal (x0, z0)-(x1, z1) and
     reliefAt interpolates over those triangles: this is exactly the displayed mesh (reliefMesh), feet and bullets are on the sand
     you see. Outside the grid, the height of its edge. The whole engine reads the implicit ground through gy0(x, z): groundHeight, rayWorld
     (reliefRay), navigation, props, bodies, particles, spawns and baked lighting (the grid fills the occlusion
     volume under the sand).
   - reliefFlat: under a placed object (car, tent, hut), the sand is flattened to its average height and blended in with a gentle slope; the
     scenery calls it before placing the object, so that no object sinks into a dune or floats above a hollow;
   - reliefRay: ray against the relief, in 4 m segments; a segment that passes above the highest point of its 8 m cells
     (RELIEF.mx) is skipped, the others are walked in 0.4 m steps then refined by bisection.
   - Round zone (MAP_DEFS.<id>.ring = { r, hard, t }): outside the circle of radius r, the screen darkens and a countdown of t s
     begins (ringCheck, called after each local soldier's movement, like voidCheck); at zero, the soldier dies (zoneDeath,
     NET_WSPECIAL.zone). Beyond hard m, you go no further (collideCircle). Bots have no navigation nodes outside the circle.
   ========================================================================== */
const RELIEF = { on: false, x0: 0, z0: 0, W: 0, H: 0, h: null, mc: 8, mW: 0, mH: 0, mx: null, fn: null, lock: null };
const RING = { on: false, x: 0, z: 0, r: 1e9, hard: 1e9, t: 10 };
/* Implicit ground height (relief, otherwise 0) */
const gy0 = (x, z) => (RELIEF.on ? reliefAt(x, z) : 0);

/* Height grid of the loaded map (after mapSetup: bounds known); D.relief absent: relief off */
function reliefBuild(D) {
  const R = RELIEF, P = D && D.relief;
  R.on = !!P; R.h = R.mx = R.lock = null; R.fn = null;
  RING.on = !!(D && D.ring); if (RING.on) Object.assign(RING, { x: 0, z: 0, t: 10 }, D.ring);
  if (!P) return;
  const pad = P.pad || 0;
  R.fn = P.fn; R.x0 = Math.floor(MAP.x0 - pad); R.z0 = Math.floor(MAP.z0 - pad);
  R.W = Math.ceil(MAP.x1 + pad) - R.x0; R.H = Math.ceil(MAP.z1 + pad) - R.z0;
  const n = R.W + 1, h = new Float32Array(n * (R.H + 1));
  for (let j = 0; j <= R.H; j++) for (let i = 0; i <= R.W; i++) h[j * n + i] = P.fn(R.x0 + i, R.z0 + j);
  R.h = h; R.lock = new Uint8Array(h.length);
  // maximum height per cell of mc m (edges included): rays that pass above skip the cell
  R.mW = Math.ceil(R.W / R.mc); R.mH = Math.ceil(R.H / R.mc); R.mx = new Float32Array(R.mW * R.mH);
  reliefMaxUpdate(0, 0, R.mW - 1, R.mH - 1);
}
/* Recomputes the maximum height of the mc m cells from (ci0, cj0) to (ci1, cj1) */
function reliefMaxUpdate(ci0, cj0, ci1, cj1) {
  const R = RELIEF, n = R.W + 1;
  for (let cj = Math.max(0, cj0); cj <= Math.min(R.mH - 1, cj1); cj++) for (let ci = Math.max(0, ci0); ci <= Math.min(R.mW - 1, ci1); ci++) {
    let m = -1e9;
    for (let j = cj * R.mc; j <= Math.min(R.H, (cj + 1) * R.mc); j++) for (let i = ci * R.mc; i <= Math.min(R.W, (ci + 1) * R.mc); i++) m = Math.max(m, R.h[j * n + i]);
    R.mx[cj * R.mW + ci] = m;
  }
}
/* Ground flattened under a placed object (car, tent, hut, watchtower): the sand must neither enter the object nor leave it in the air. Rectangle with
   center (cx, cz), half-sides hw (along local x) and hd (local z), rotated by rot like Maker.rotY, enlarged by o.margin (0.4 m): brought to its
   average height (o.y to force it), then blended into the relief over a width that keeps the slope under 0.6 m per meter (o.fade at least,
   2.5 m). A cell already flattened for another object no longer moves; if the rectangle overlaps some, it takes their height. To be called during
   map construction, before placing the object and before reliefMesh (the mesh reads the grid). Returns the height of the flattened ground. */
function reliefFlat(cx, cz, hw, hd, rot = 0, o = {}) {
  const R = RELIEF; if (!R.on) return 0;
  const n = R.W + 1, m = o.margin !== undefined ? o.margin : 0.4, c = Math.cos(rot), s = Math.sin(rot), ex = hw + m, ez = hd + m;
  const dist = (x, z) => { const dx = x - cx, dz = z - cz, lx = dx * c - dz * s, lz = dx * s + dz * c; return hyp(Math.max(0, Math.abs(lx) - ex), Math.max(0, Math.abs(lz) - ez)); };
  const span = (r) => [Math.max(0, Math.floor(cx - r - R.x0)), Math.min(R.W, Math.ceil(cx + r - R.x0)), Math.max(0, Math.floor(cz - r - R.z0)), Math.min(R.H, Math.ceil(cz + r - R.z0))];
  // underside height: that of the already flattened cells it covers, otherwise the average
  let [i0, i1, j0, j1] = span(hyp(ex, ez)), sum = 0, cnt = 0, lsum = 0, lcnt = 0;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    if (dist(R.x0 + i, R.z0 + j) > 0) continue;
    const k = j * n + i; sum += R.h[k]; cnt++; if (R.lock[k]) { lsum += R.h[k]; lcnt++; }
  }
  if (!cnt) return reliefAt(cx, cz);
  const y = o.y !== undefined ? o.y : lcnt ? lsum / lcnt : sum / cnt;
  // blend width: the slope of the transition (at most 1.5 times the delta over the width, with smoothstep) stays under 0.6
  let gap = 0; [i0, i1, j0, j1] = span(hyp(ex, ez) + 2.5);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const d = dist(R.x0 + i, R.z0 + j); if (d > 0 && d <= 2.5) gap = Math.max(gap, Math.abs(R.h[j * n + i] - y)); }
  const F = Math.max(o.fade || 2.5, gap * 2.5);
  [i0, i1, j0, j1] = span(hyp(ex, ez) + F);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const k = j * n + i, d = dist(R.x0 + i, R.z0 + j);
    if (d === 0) { R.h[k] = y; R.lock[k] = 1; } else if (!R.lock[k] && d < F) R.h[k] = lerp(R.h[k], y, 1 - smoothstep(0, F, d));
  }
  reliefMaxUpdate(Math.floor((i0 - 1) / R.mc), Math.floor((j0 - 1) / R.mc), Math.floor((i1 + 1) / R.mc), Math.floor((j1 + 1) / R.mc));
  return y;
}
function reliefFree() {
  RELIEF.on = false; RELIEF.h = RELIEF.mx = RELIEF.lock = null; RELIEF.fn = null; RING.on = false;
  if (WMU.tGround.value !== WMU.tGround.zero) { WMU.tGround.value.dispose(); WMU.tGround.value = WMU.tGround.zero; WMU.uGroundB.value.set(0, 0, 0, 0); }
}
/* Relief heights for the scenery shaders (WMU.tGround, half-floats, one texel per point of the 1 m grid), after construction (objects
   have flattened the sand): the grime and dust at the foot of walls are counted from the sand. The lowest within 2 m around: under a
   rock, the relief rises (the snowdrift that climbs onto its back continues there), and the foot band fell in the middle of the wall */
function reliefGroundTex() {
  const R = RELIEF; if (!R.on || !R.h) return;
  const n = R.W + 1, m = R.H + 1, d = new Uint16Array(n * m), K = 2;
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
    let lo = 1e9;
    for (let b = Math.max(0, j - K); b <= Math.min(m - 1, j + K); b++) for (let a = Math.max(0, i - K); a <= Math.min(n - 1, i + K); a++) lo = Math.min(lo, R.h[b * n + a]);
    d[j * n + i] = THREE.DataUtils.toHalfFloat(lo);
  }
  const t = new THREE.DataTexture(d, n, m, THREE.RedFormat, THREE.HalfFloatType);
  t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  if (WMU.tGround.value !== WMU.tGround.zero) WMU.tGround.value.dispose();
  WMU.tGround.value = t; WMU.uGroundB.value.set(R.x0 - 0.5, R.z0 - 0.5, 1 / n, 1 / m);
}
/* Relief height at (x, z), interpolated over the cell's two triangles */
function reliefAt(x, z) {
  const R = RELIEF;
  let u = x - R.x0, v = z - R.z0;
  if (u < 0) u = 0; else if (u > R.W - 1e-4) u = R.W - 1e-4;
  if (v < 0) v = 0; else if (v > R.H - 1e-4) v = R.H - 1e-4;
  const i = u | 0, j = v | 0, fu = u - i, fv = v - j, n = R.W + 1, k = j * n + i, h = R.h, h00 = h[k], h11 = h[k + n + 1];
  return fu >= fv ? h00 + (h[k + 1] - h00) * fu + (h11 - h[k + 1]) * fv : h00 + (h11 - h[k + n]) * fu + (h[k + n] - h00) * fv;
}
/* Relief normal at (x, z) (central differences over 0.5 m) into out [x, y, z] */
function reliefNormal(x, z, out = [0, 1, 0]) {
  const sx = (reliefAt(x + 0.5, z) - reliefAt(x - 0.5, z)), sz = (reliefAt(x, z + 0.5) - reliefAt(x, z - 0.5)), l = hyp3(sx, 1, sz);
  out[0] = -sx / l; out[1] = 1 / l; out[2] = -sz / l;
  return out;
}
/* Maximum height of the 8 m cells that contain (x, z); outside the grid, that of the edge */
function reliefMaxAt(x, z) {
  const R = RELIEF, ci = clamp(Math.floor((x - R.x0) / R.mc), 0, R.mW - 1), cj = clamp(Math.floor((z - R.z0) / R.mc), 0, R.mH - 1);
  return R.mx[cj * R.mW + ci];
}
/* Distance along the ray (unit direction) to the relief, or -1 beyond maxD */
function reliefRay(ox, oy, oz, dx, dy, dz, maxD) {
  if (oy < reliefAt(ox, oz) - 0.05) return 0; // origin under the sand: the ray goes nowhere
  const SEG = 4, ST = 0.4;
  for (let t0 = 0; t0 < maxD; t0 += SEG) {
    const t1 = Math.min(maxD, t0 + SEG), xa = ox + dx * t0, za = oz + dz * t0, xb = ox + dx * t1, zb = oz + dz * t1;
    const top = Math.max(reliefMaxAt(xa, za), reliefMaxAt(xb, zb), reliefMaxAt(xa, zb), reliefMaxAt(xb, za));
    if (Math.min(oy + dy * t0, oy + dy * t1) > top) continue;
    let ta = t0;
    for (let t = Math.min(t1, t0 + ST); ; t = Math.min(t1, t + ST)) {
      if (oy + dy * t <= reliefAt(ox + dx * t, oz + dz * t)) {
        let a = ta, b = t;
        for (let k = 0; k < 7; k++) { const m = (a + b) / 2; if (oy + dy * m <= reliefAt(ox + dx * m, oz + dz * m)) b = m; else a = m; }
        return b;
      }
      ta = t; if (t >= t1) break;
    }
  }
  return -1;
}

/* Is a ground hole (HOLES, a well shaft) in the middle of this 1 m cell with corner (x, z)? */
function holeInCell(x, z) { for (const h of HOLES) if (h.x > x && h.x < x + 1 && h.z > z && h.z < z + 1) return true; return false; }
/* Relief mesh in the workshop (ground material, splat included): the 1 m grid over the disc of radius rIn (8 m tiles, stored
   per segment for culling), then increasingly loose rings out to rOut, on the relief function (beyond the grid).
   The inner edge of the rings picks up the grid at radius rIn: no seam. o: tint (sRGB), tintAt(x, z, h) (linear per-vertex tint:
   lighter crests, darker hollows), ring (ring ranks), seg (directions) */
function reliefMesh(rIn, rOut, o = {}) {
  const R = RELIEF, M = DECOR, n = R.W + 1, fn = R.fn, nv = (x, z, f) => { const sx = f(x + 0.5, z) - f(x - 0.5, z), sz = f(x, z + 0.5) - f(x, z - 0.5), l = hyp3(sx, 1, sz); return [-sx / l, 1 / l, -sz / l]; };
  M.save().color(o.tint || [1, 1, 1]).world(1); M.aoFn = null;
  // grid: 8 m tiles, a cell is placed only if one of its corners is in the disc
  const T = 8, i0 = Math.max(0, Math.floor((-rIn - 1 - R.x0))), i1 = Math.min(R.W, Math.ceil(rIn + 1 - R.x0)), j0 = Math.max(0, Math.floor(-rIn - 1 - R.z0)), j1 = Math.min(R.H, Math.ceil(rIn + 1 - R.z0));
  const inD = (i, j) => { const x = R.x0 + i, z = R.z0 + j; return x * x + z * z <= rIn * rIn; };
  for (let tj = j0; tj < j1; tj += T) for (let ti = i0; ti < i1; ti += T) {
    const ie = Math.min(i1, ti + T), je = Math.min(j1, tj + T);
    let any = false;
    for (let j = tj; j < je && !any; j++) for (let i = ti; i < ie; i++) if (inD(i, j) || inD(i + 1, j) || inD(i, j + 1) || inD(i + 1, j + 1)) { any = true; break; }
    if (!any) continue;
    const B = M.buf('ground', R.x0 + (ti + ie) / 2, 0, R.z0 + (tj + je) / 2), ids = new Map();
    const vid = (i, j) => { const k = j * n + i; let v = ids.get(k); if (v === undefined) { const x = R.x0 + i, z = R.z0 + j, nn = nv(x, z, reliefAt); if (o.tintAt) M.tint = o.tintAt(x, z, R.h[k]); v = M.v(B, x, R.h[k], z, nn[0], nn[1], nn[2], x, -z); ids.set(k, v); } return v; };
    for (let j = tj; j < je; j++) for (let i = ti; i < ie; i++) {
      if (!(inD(i, j) || inD(i + 1, j) || inD(i, j + 1) || inD(i + 1, j + 1))) continue;
      if (HOLES.length && holeInCell(R.x0 + i, R.z0 + j)) continue; // a well's cell: the shaft goes down beneath it, the curb covers it
      const a = vid(i, j), b = vid(i + 1, j), c = vid(i + 1, j + 1), d = vid(i, j + 1);
      M.tri(B, a, c, b); M.tri(B, a, d, c);
    }
  }
  // rings: from the grid outline (placed cells go up to rIn + 1.5 m) toward the horizon, ranks tightened near the edge
  const NU = o.seg || 192, rings = o.ring || 26, r0 = rIn - 0.5;
  for (let s = 0; s < NU; s++) {
    const a0 = (s / NU) * TAU, a1 = ((s + 1) / NU) * TAU, B = M.buf('ground', Math.cos((a0 + a1) / 2) * 200, 0, Math.sin((a0 + a1) / 2) * 200);
    let prev = null;
    for (let k = 0; k <= rings; k++) {
      const t = k / rings, r = r0 + (rOut - r0) * t * t;
      const row = [a0, a1].map((a) => {
        const x = Math.cos(a) * r, z = Math.sin(a) * r, f = r < rIn + 2 ? reliefAt : fn, nn = nv(x, z, f), y = f(x, z);
        if (o.tintAt) M.tint = o.tintAt(x, z, y);
        return M.v(B, x, y - (k === 0 ? 0.03 : 0), z, nn[0], nn[1], nn[2], x, -z);
      });
      if (prev) { M.tri(B, prev[0], row[1], row[0]); M.tri(B, prev[0], prev[1], row[1]); }
      prev = row;
    }
  }
  M.tint = null; M.restore();
}

/* ---------- Round zone: countdown outside the circle ---------- */
/* After a local soldier moves (player, bot on this machine): outside the circle for RING.t s, he dies. Returns true if he has just
   died. The time spent outside (e.outT) resets to zero as soon as he comes back. */
function ringCheck(e, dt) {
  if (!RING.on || !e.alive) { e.outT = 0; return false; }
  const out = (e.pos.x - RING.x) ** 2 + (e.pos.z - RING.z) ** 2 > RING.r * RING.r;
  e.outT = out ? (e.outT || 0) + dt : 0;
  if (e.outT < RING.t || !(MATCH.state === 'playing' || MATCH.state === 'paused')) return false;
  e.outT = 0; zoneDeath(e);
  return !e.alive;
}
/* Death in the desert: credited, like a fall into the void, to the last opponent who hit him less than 5 s ago */
function zoneDeath(e) {
  if (!e.alive || !(MATCH.state === 'playing' || MATCH.state === 'paused')) return;
  let a = e, best = -1;
  for (const [ent, t] of e.dmgBy) if (ent !== e && !allied(ent, e) && MATCH.time - t < 5 && t > best) { best = t; a = ent; }
  const dir = new V3(e.vel.x, 0, e.vel.z); if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1); dir.normalize();
  if (!e.isPlayer) e.lastForce = { dir: dir.clone(), mag: 1, part: 'body' };
  killEnt(e, a, NET_WSPECIAL.zone, false, dir);
}
/* Player screen outside the zone: veil that darkens as time passes, message and seconds remaining */
const RINGHUD = { on: false, n: -1 };
function ringHud(e) {
  const el = $('ringOut'); if (!el) return;
  const show = RING.on && e && e.alive && (e.outT || 0) > 0;
  if (show !== RINGHUD.on) { RINGHUD.on = show; el.classList.toggle('show', show); RINGHUD.n = -1; }
  if (!show) return;
  const left = Math.max(0, RING.t - e.outT), n = Math.ceil(left);
  el.style.setProperty('--k', (0.45 + 0.5 * clamp(e.outT / RING.t, 0, 1)).toFixed(3));
  if (n !== RINGHUD.n) { RINGHUD.n = n; $('ringN').textContent = n; }
}
