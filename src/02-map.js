/* ==========================================================================
   MAP: infrastructure common to all maps. Bounds, map list, axis-aligned box collisions
   (COL) and ramps (RAMPS), queries (ground, sliding, ceiling, rays), simple blocks and stairs.
   The scenery is built by the workshop (02a-kit.js) and its libraries; each map's layout is in
   its own file (Chergui: 02s-chergui.js, Saint-Givre: 02t-saintgivre.js, Port-Maël: 02u-portmael.js, Floralia: 02v-floralia.js, Notos: 02yb to 02yf, Scoria: 02yg and 02yh, Cirrus: 02yi and 02yj, Bel-Horizon: 02ym and 02yn, Selva: 02yo to 02yq; a map's name is a proper noun, the same in both languages), which declares its
   definition (MAP_DEFS); the water of a harbor map is in 02m-water.js;
   loading is in 09a-loading.js, each map's own settings (ambience, zones...) in 02z-load.js.
   ========================================================================== */
/* Bounds of the loaded map's play area (copied from its definition at load) */
const MAP = { x0: -36, x1: 36, z0: -50, z1: 50 };
/* Void under the map (floating islands: MAP_DEFS.<id>.void = { kill }): outside the collision boxes and ramps, no floor (floor:
   very low but finite, never -Infinity, otherwise positions and the calculations that depend on them turn into NaN), no bounds
   that hold you back (you fall), and below kill a soldier dies (voidDeath, 09-game.js), an object disappears. Set by mapSetup, turned off on
   unload: the other maps keep their implicit floor at y = 0. */
const VOID = { on: false, floor: -200, kill: -1e9 };
/* Maps offered in the menus. A map is playable only if ok is true; the others display "Coming soon". */
const MAPS = [
  { id: 'chergui', name: 'Chergui', tag: _t('Desert town and souk'), ok: true,
    desc: _t('A desert town after dark. The siesta ended hours ago and nobody went to bed.') },
  { id: 'saintgivre', name: 'Saint-Givre', tag: _t('Snowed-in railway halt'), ok: true,
    desc: _t('A mountain village buried in snow. The snowplow has been on strike since last winter.') },
  { id: 'portmael', name: 'Port-Maël', tag: _t('Docks and fish auction hall'), ok: true,
    desc: _t('A fishing port as the sun goes down. The tide is rising, and so is the tension.') },
  { id: 'floralia', name: 'Floralia', tag: _t('Botanical park and palm house'), ok: true,
    desc: _t('A botanical park in spring. The rare plants are protected. The visitors, much less so.') },
  { id: 'notos', name: 'Notos', tag: _t('Whitewashed Aegean village'), ok: true,
    desc: _t('A whitewashed village facing the sea. The postcards never show the wind.') },
  { id: 'scoria', name: 'Scoria', tag: _t('Volcano observatory and power plant'), ok: true,
    desc: _t('A power plant built on the flank of an awakened volcano. The insurance does not cover eruptions.') },
  { id: 'cirrus', name: 'Cirrus', tag: _t('Sky archipelago'), ok: true,
    desc: _t('Rocks floating above the clouds, joined by creaking rope bridges. Don\u0027t look down.') },
  { id: 'sirocco', name: 'Sirocco', tag: _t('Oasis in the dune sea'), ok: true,
    desc: _t('An oasis lost in a sandstorm. The only well for a hundred kilometers, and everyone wants it.') },
  { id: 'belhorizon', name: 'Bel-Horizon', tag: _t('New-build suburb'), ok: true,
    desc: _t('New houses with perfect lawns. The neighbors notice everything except the gunfire.') },
  { id: 'outpost', name: 'Selva', tag: _t('Military compound in the rainforest'), ok: true,
    desc: _t('A command post cut out of the rainforest. The generator never stops, and neither do the mosquitoes.') },
];
const mapById = (id) => MAPS.find((m) => m.id === id && m.ok) || MAPS[0];
/* Loaded map: entry of MAPS and definition (null outside a match: startup builds no map) */
const CURMAP = { id: null, info: null, def: null };
/* Ground distribution map of the loaded map: origin, size (m), pixels per meter */
const SPLAT = { x0: -64, z0: -80, w: 128, d: 160, ppm: 4 };
/* Construction of each playable map, declared by its layout file (MAP_DEFS.id = { ... }):
   bounds (limits of the play area), textures (photo surfaces from assets/tex/ that it uses), art (camera of its
   illustration in the menus: cam, look, fov; see tools/dev/illustrations.js), build() (scenery and collisions),
   after() (optional: what needs the collisions, like light wells). The rest (scenery merging,
   baked lighting, navigation, satellite capture, shaders) is common: see mapBuild in 09a-loading.js.
   Map game and ambience settings (spawns, poi, zones, atmo...): see the top of 02z-load.js. */
const MAP_DEFS = {};
/* Every 3D object of the map is stored under its root (MAPL.root), freed in one go on unload */
function mapAdd(o) { MAPL.root.add(o); return o; }
/* Collisions: {x0,x1,y0,y1,z0,z1,m,ray}; ray: stops shots only; noRay: stops soldiers, not shots;
   inv: invisible wall at the water's edge (waterEdge, 02m-water.js), neither cover for bots nor obstacle for grenades */
const COL = [];
const RAMPS = []; // ramps: {x0,x1,z0,z1,axis,h0,h1}
const LINES = []; // lines stretched between two scenery points (laundry, wires, garlands, mooring lines): {k, a, b}; tools/dev/visual/anchors.js checks that each end is attached to something
const BRIDGES = []; // suspension bridges (floating islands): {axis, c, a0, a1, w}; their ends stay clear (tools/dev/visual/decor.js)

/* ---------- Simple blocks ---------- */
/* Box centered (cx, cz), bottom at y0, optional Y rotation: scenery and collision. o: tint (sRGB), rot, collide,
   m (impact material), rayOnly (stops shots only), skip (omitted faces), uv (m per tile), localUV, ao,
   aoBase, bevel. Thin elements without collision cast no shadow (source of flicker). */
function boxC(key, cx, y0, cz, w, h, d, o = {}) {
  const thin = o.collide === false && Math.min(w, h, d) < 0.12 && key !== 'glass' && key !== 'lamp' && !o.cast;
  const k = LEGACY_KEY[key] || key, M = DECOR, rot = o.rot || 0;
  M.save().move(cx, y0, cz).rotY(rot).color(o.tint);
  M.cls = thin ? 1 : 0;
  if (rot === 0 && !o.localUV) M.world(1); else M.local(1);
  if (o.uv && TEXSCALE[k]) M.uvS = o.uv / TEXSCALE[k];
  M.aoFn = o.ao === false ? null : (x, y, z, nx, ny) => aoAt(y, o) * (ny < -0.5 ? 0.6 : 1);
  if (o.skip !== 'xXyYzZ') M.box(k, w, h, d, { skip: o.skip, bevel: o.bevel });
  if (o.collide !== false) M.col(-w / 2, w / 2, 0, h, -d / 2, d / 2, o.m || matKind(key), !!o.rayOnly);
  M.restore();
}
/* Collisions of an object placed like DECOR.place (center cx, cz, ground y, rotated by rot): boxes [x0, x1, y0, y1, z0, z1] in its frame, which
   follow its shape (crate, cabin interior, cab...); rotated off right angles, the workshop cuts them up so they hug the object (col, 02a-kit.js) */
function colShape(cx, y, cz, rot, boxes, m = 'metal') {
  const M = DECOR; M.save().move(cx, y, cz).rotY(rot);
  for (const b of boxes) {
    // b[6] 'glassPane': a glazed cabin stops soldiers, not bullets or sight (like a scenery window, glassWall)
    if (b[6] === 'glassPane') { const w = M._aabb(b[0], b[1], b[2], b[3], b[4], b[5], true); COL.push({ x0: w.x0, x1: w.x1, y0: w.y0, y1: w.y1, z0: w.z0, z1: w.z1, m: 'glass', ray: false, noRay: true }); }
    else M.col(b[0], b[1], b[2], b[3], b[4], b[5], m);
  }
  M.restore();
}
/* Box by bounds, axis-aligned */
function box(key, x0, x1, y0, y1, z0, z1, o = {}) {
  if (x1 < x0) [x0, x1] = [x1, x0]; if (z1 < z0) [z0, z1] = [z1, z0];
  boxC(key, (x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, o);
}
/* Old material keys */
const LEGACY_KEY = { metal: 'corrugated', fabric: 'burlap', trim: 'paintwood', leaf: 'foliage' };
function aoAt(y, o) { return o.ao === false ? 1 : lerp(0.7, 1, smoothstep(0.0, 2.2, y - (o.aoBase || 0))); }
function matKind(key) {
  if (key === 'metal' || key === 'steel' || key === 'paint' || key === 'corrugated' || key === 'carpaint') return 'metal';
  if (key === 'wood' || key === 'crate' || key === 'paintwood') return 'wood';
  if (key === 'dirt' || key === 'fabric' || key === 'canvas' || key === 'burlap' || key === 'sand') return 'dirt';
  if (key === 'glass') return 'glass';
  return 'concrete';
}

/* ---------- Stairs ---------- */
/* Walkable ramp (RAMPS) doubled with visible steps. The steps' collisions stop shots only,
   as before; the scenery: steps with rounded nosing, side stringer. o: tint, mat (material of the steps) */
function ramp(x0, x1, z0, z1, axis, h0, h1, key = 'pavers', tint = [0.8, 0.78, 0.74], o = {}) {
  RAMPS.push({ x0, x1, z0, z1, axis, h0, h1 });
  const len = axis === 'x' ? x1 - x0 : z1 - z0;
  const steps = Math.max(2, Math.round(Math.abs(h1 - h0) / 0.2));
  const M = DECOR, mat = o.mat || (key === 'pavers' ? 'concrete' : key);
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps, t1 = (i + 1) / steps;
    const hTop = Math.max(0.05, lerp(h0, h1, (t0 + t1) / 2) + Math.abs(h1 - h0) / steps / 2);
    const bx0 = axis === 'x' ? x0 + len * t0 : x0, bx1 = axis === 'x' ? x0 + len * t1 : x1, bz0 = axis === 'x' ? z0 : z0 + len * t0, bz1 = axis === 'x' ? z1 : z0 + len * t1;
    M.col(bx0, bx1, 0, hTop, bz0, bz1, 'concrete', true);
    // step: full riser and overhanging tread (nosing)
    M.save().color(tint).world(1);
    M.aoFn = (x, y) => lerp(0.72, 1, smoothstep(0, 0.6, y - hTop + 0.6));
    M.boxB(mat, bx0, bx1, 0, hTop - 0.04, bz0, bz1, { skip: 'y' });
    const up = h1 > h0 ? 1 : -1, nose = 0.03;
    const nx0 = axis === 'x' ? (up > 0 ? bx0 - nose : bx0) : bx0, nx1 = axis === 'x' ? (up > 0 ? bx1 : bx1 + nose) : bx1;
    const nz0 = axis === 'z' ? (up > 0 ? bz0 - nose : bz0) : bz0, nz1 = axis === 'z' ? (up > 0 ? bz1 : bz1 + nose) : bz1;
    M.local(1); M.boxB(mat, nx0, nx1, hTop - 0.045, hTop, nz0, nz1, { bevel: 0.015 });
    M.restore();
  }
}
function rampHeight(r, x, z) {
  const t = r.axis === 'x' ? (x - r.x0) / (r.x1 - r.x0) : (z - r.z0) / (r.z1 - r.z0);
  return lerp(r.h0, r.h1, clamp(t, 0, 1));
}

/* ---------- Collision queries ---------- */
const HASH = new Map(), HCELL = 4;
function buildHash() {
  for (let i = 0; i < COL.length; i++) {
    const c = COL[i];
    for (let x = Math.floor(c.x0 / HCELL); x <= Math.floor(c.x1 / HCELL); x++)
      for (let z = Math.floor(c.z0 / HCELL); z <= Math.floor(c.z1 / HCELL); z++) {
        const k = x * 1000 + z; let a = HASH.get(k); if (!a) HASH.set(k, a = []); a.push(i);
      }
  }
}
/* A box stored in several cells is returned only once: it keeps the number of the last query that returned it
   (_qstamp). A Set cleared on every query reallocated its table: the bots' lines of sight made up a good part of a
   frame's allocations. */
const _qarr = [];
let _qn = 0, _qstamp = new Uint32Array(0);
function queryBegin() {
  _qarr.length = 0;
  if (_qstamp.length < COL.length) _qstamp = new Uint32Array(COL.length + 256);
  if (++_qn === 0xffffffff) { _qstamp.fill(0); _qn = 1; }
}
function queryCell(a) { for (let k = 0; k < a.length; k++) { const i = a[k]; if (_qstamp[i] !== _qn) { _qstamp[i] = _qn; _qarr.push(COL[i]); } } }
function queryBoxes(x0, z0, x1, z1) {
  queryBegin();
  for (let x = Math.floor(x0 / HCELL); x <= Math.floor(x1 / HCELL); x++)
    for (let z = Math.floor(z0 / HCELL); z <= Math.floor(z1 / HCELL); z++) {
      const a = HASH.get(x * 1000 + z); if (a) queryCell(a);
    }
  return _qarr;
}
const STEP = 0.45;
/* Ground holes (a well shaft): circles (x, z, r) where the ground y = 0 opens down to the bottom y (of the water, m); placed by the map at
   load, cleared with it (mapTeardown). Shots go down them to the bottom or the wall, a grenade falls in. */
const HOLES = [];
function holeAt(x, z) { for (const h of HOLES) { const dx = x - h.x, dz = z - h.z; if (dx * dx + dz * dz < h.r * h.r) return h; } return null; }
/* Highest surface under (x,z) reachable from height y; noInv: without the invisible walls (a grenade does not land on them) */
function groundHeight(x, z, y, r = 0.2, noInv = false) {
  const g0 = RELIEF.on ? reliefAt(x, z) : 0; // implicit ground: the relief (dunes, 02-relief.js), otherwise y = 0
  let g = VOID.on ? VOID.floor : WATER.on && waterAt(x, z) ? WATER.floor : g0; // above water (harbor map): the bottom; above the void: nothing
  if (POOLS.length && (g === g0 || VOID.on)) { const pl = poolAt(x, z); if (pl) g = RELIEF.on ? Math.max(g0, pl.bed) : pl.bed; } // in a basin: the basin floor (02m-water.js); on a map with relief, an islet sticks out of the bottom
  if (HOLES.length && g === g0) { const hh = holeAt(x, z); if (hh) g = hh.y; }
  const arr = queryBoxes(x - r, z - r, x + r, z + r);
  for (let k = 0; k < arr.length; k++) {
    const c = arr[k];
    if (c.ray || (noInv && c.inv)) continue;
    if (x + r * 0.5 < c.x0 || x - r * 0.5 > c.x1 || z + r * 0.5 < c.z0 || z - r * 0.5 > c.z1) continue;
    if (c.y1 <= y + STEP && c.y1 > g) g = c.y1;
  }
  for (const rp of RAMPS) {
    if (x < rp.x0 || x > rp.x1 || z < rp.z0 || z > rp.z1) continue;
    const h = rampHeight(rp, x, z);
    if (h <= y + STEP && h > g) g = h;
  }
  return g;
}
/* Horizontal movement of a cylinder with sliding */
function collideCircle(pos, r, height) {
  const feet = pos.y;
  for (let it = 0; it < 3; it++) {
    let moved = false;
    const arr = queryBoxes(pos.x - r, pos.z - r, pos.x + r, pos.z + r);
    for (let k = 0; k < arr.length; k++) {
      const c = arr[k];
      if (c.ray) continue;
      if (c.y1 <= feet + STEP || c.y0 >= feet + height) continue;
      const cx = clamp(pos.x, c.x0, c.x1), cz = clamp(pos.z, c.z0, c.z1);
      let dx = pos.x - cx, dz = pos.z - cz; const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2), push = r - d; pos.x += (dx / d) * push; pos.z += (dz / d) * push;
      } else {
        const l = pos.x - c.x0, rr = c.x1 - pos.x, f = pos.z - c.z0, bb = c.z1 - pos.z, m = Math.min(l, rr, f, bb);
        if (m === l) pos.x = c.x0 - r; else if (m === rr) pos.x = c.x1 + r; else if (m === f) pos.z = c.z0 - r; else pos.z = c.z1 + r;
      }
      moved = true;
    }
    for (const rp of RAMPS) {
      const cx = clamp(pos.x, rp.x0, rp.x1), cz = clamp(pos.z, rp.z0, rp.z1);
      let dx = pos.x - cx, dz = pos.z - cz; const d2 = dx * dx + dz * dz;
      if (d2 >= r * r || d2 < 1e-8) continue;
      const h = rampHeight(rp, cx, cz);
      if (h <= feet + STEP) continue;
      const d = Math.sqrt(d2), push = r - d; pos.x += (dx / d) * push; pos.z += (dz / d) * push; moved = true;
    }
    if (!moved) break;
  }
  if (!VOID.on) { pos.x = clamp(pos.x, MAP.x0 + r, MAP.x1 - r); pos.z = clamp(pos.z, MAP.z0 + r, MAP.z1 - r); } // at the edge of the void, no invisible wall: you fall
  if (RING.on) { const dx = pos.x - RING.x, dz = pos.z - RING.z, d = hyp(dx, dz); if (d > RING.hard) { pos.x = RING.x + dx * RING.hard / d; pos.z = RING.z + dz * RING.hard / d; } } // round zone: no further than hard
}
function ceilingAbove(x, z, y, r) {
  let c = 99;
  for (const b of queryBoxes(x - r, z - r, x + r, z + r)) {
    if (b.ray) continue;
    if (x + r * 0.7 < b.x0 || x - r * 0.7 > b.x1 || z + r * 0.7 < b.z0 || z - r * 0.7 > b.z1) continue;
    if (b.y0 >= y - 0.05 && b.y0 < c) c = b.y0;
  }
  return c;
}
/* Ray against static geometry and physics props. Returns distance, normal, material, and the prop hit if there is one
   (RAYHIT.prop). mode: 0 aiming and lines of sight (small props, which bullets pass through, are ignored), 1 shot (all
   props), 2 the map alone. A prop's collision boxes (noRay) do not count: its shape is what answers. */
const RAYHIT = { t: 0, nx: 0, ny: 0, nz: 0, m: 'concrete', prop: null }, _rn = [0, 1, 0];
function rayWorld(ox, oy, oz, dx, dy, dz, maxD, mode = 0) {
  let best = maxD, bn = 0, bm = 'concrete', found = false, pb = null;
  if (RELIEF.on && !VOID.on) {
    // relief (dunes): in all directions; above a basin, the water surface
    const t = reliefRay(ox, oy, oz, dx, dy, dz, best);
    if (t >= 0) {
      best = t; bm = 'ground'; bn = 9; found = true;
      if (POOLS.length && dy < -1e-6) { const pl = poolAt(ox + dx * t, oz + dz * t); if (pl && oy > pl.wl) { const tw = (pl.wl - oy) / dy; if (tw < best) { best = tw; bm = 'water'; bn = 2; } } }
      if (HOLES.length && dy < -1e-6 && bm === 'ground') { // well hole in the sand: the shot continues into the shaft (see below, on flat ground)
        const hh = holeAt(ox + dx * t, oz + dz * t);
        if (hh) {
          const px = ox + dx * t - hh.x, pz = oz + dz * t - hh.z, a = dx * dx + dz * dz, b = 2 * (px * dx + pz * dz), c = px * px + pz * pz - hh.r * hh.r;
          const sw = a > 1e-9 ? (-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a) : Infinity, sf = (hh.y - (oy + dy * t)) / dy;
          if (sw < sf) { const wx = px + dx * sw, wz = pz + dz * sw; best = t + sw; bm = hh.wall; bn = Math.abs(wx) > Math.abs(wz) ? (wx > 0 ? -1 : 1) : (wz > 0 ? -3 : 3); }
          else { best = t + sf; bm = hh.m; bn = 2; }
        }
      }
    }
  } else if (dy < -1e-6 && !VOID.on) {
    // ground (y = 0); above water, the water surface (02m-water.js), lower; above the void, none (the tops of islands are made of boxes)
    let t = -oy / dy, gm = 'ground', gn = 2;
    if (WATER.on && t > 0 && t < best && waterAt(ox + dx * t, oz + dz * t)) { t = (WATER.y - oy) / dy; gm = 'water'; }
    else if (POOLS.length && t > 0 && t < best) { const pl = poolAt(ox + dx * t, oz + dz * t); if (pl && oy > pl.wl) { t = (pl.wl - oy) / dy; gm = 'water'; } } // basin: the shot hits the water surface
    if (HOLES.length && t > 0 && t < best && gm === 'ground') {
      // well hole: the shot continues into the shaft down to the wall (stone) or the bottom (water)
      const hh = holeAt(ox + dx * t, oz + dz * t);
      if (hh) {
        const px = ox + dx * t - hh.x, pz = oz + dz * t - hh.z, a = dx * dx + dz * dz, b = 2 * (px * dx + pz * dz), c = px * px + pz * pz - hh.r * hh.r;
        const sw = a > 1e-9 ? (-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a) : Infinity, sf = hh.y / dy;
        if (sw < sf) { const wx = px + dx * sw, wz = pz + dz * sw; t += sw; gm = hh.wall; gn = Math.abs(wx) > Math.abs(wz) ? (wx > 0 ? -1 : 1) : (wz > 0 ? -3 : 3); }
        else { t += sf; gm = hh.m; }
      }
    }
    if (t > 0 && t < best) { best = t; bn = gn; bm = gm; found = true; }
  }
  const ex = ox + dx * maxD, ez = oz + dz * maxD;
  const arr = queryBoxesRay(ox, oz, ex, ez);
  const ix = 1 / (Math.abs(dx) < 1e-9 ? 1e-9 : dx), iy = 1 / (Math.abs(dy) < 1e-9 ? 1e-9 : dy), iz = 1 / (Math.abs(dz) < 1e-9 ? 1e-9 : dz);
  for (let k = 0; k < arr.length; k++) {
    const c = arr[k];
    if (c.noRay) continue;
    let t1 = (c.x0 - ox) * ix, t2 = (c.x1 - ox) * ix;
    let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2), ax = 0;
    t1 = (c.y0 - oy) * iy; t2 = (c.y1 - oy) * iy;
    let a = Math.min(t1, t2), b = Math.max(t1, t2);
    if (a > tmin) { tmin = a; ax = 1; } if (b < tmax) tmax = b;
    t1 = (c.z0 - oz) * iz; t2 = (c.z1 - oz) * iz;
    a = Math.min(t1, t2); b = Math.max(t1, t2);
    if (a > tmin) { tmin = a; ax = 2; } if (b < tmax) tmax = b;
    if (tmax < Math.max(tmin, 0) || tmin > best || tmin < 0) continue;
    best = tmin; bm = c.m; found = true;
    bn = ax === 0 ? (dx > 0 ? -1 : 1) : ax === 1 ? (dy > 0 ? -2 : 2) : (dz > 0 ? -3 : 3);
  }
  if (PHYS.live && mode !== 2) { const h = propsRay(ox, oy, oz, dx, dy, dz, best, mode); if (h) { best = h.t; bm = h.b.d.mat; found = true; pb = h; } }
  if (!found) return null;
  RAYHIT.t = best; RAYHIT.m = bm; RAYHIT.prop = pb ? pb.b : null;
  if (pb) { RAYHIT.nx = pb.nx; RAYHIT.ny = pb.ny; RAYHIT.nz = pb.nz; return RAYHIT; }
  if (bn === 9) { const n = reliefNormal(ox + dx * best, oz + dz * best, _rn); RAYHIT.nx = n[0]; RAYHIT.ny = n[1]; RAYHIT.nz = n[2]; return RAYHIT; } // dune slope
  RAYHIT.nx = Math.abs(bn) === 1 ? Math.sign(bn) : 0; RAYHIT.ny = Math.abs(bn) === 2 ? Math.sign(bn) : 0; RAYHIT.nz = Math.abs(bn) === 3 ? Math.sign(bn) : 0;
  return RAYHIT;
}
/* Walk through the cells crossed by the segment (DDA on the hash grid) */
function queryBoxesRay(x0, z0, x1, z1) {
  queryBegin();
  let cx = Math.floor(x0 / HCELL), cz = Math.floor(z0 / HCELL);
  const ex = Math.floor(x1 / HCELL), ez = Math.floor(z1 / HCELL);
  const dx = x1 - x0, dz = z1 - z0;
  const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
  const tdx = Math.abs(dx) < 1e-9 ? 1e9 : Math.abs(HCELL / dx), tdz = Math.abs(dz) < 1e-9 ? 1e9 : Math.abs(HCELL / dz);
  let tmx = Math.abs(dx) < 1e-9 ? 1e9 : ((sx > 0 ? (cx + 1) * HCELL - x0 : x0 - cx * HCELL) / Math.abs(dx));
  let tmz = Math.abs(dz) < 1e-9 ? 1e9 : ((sz > 0 ? (cz + 1) * HCELL - z0 : z0 - cz * HCELL) / Math.abs(dz));
  for (let n = 0; n < 400; n++) {
    const a = HASH.get(cx * 1000 + cz);
    if (a) queryCell(a);
    if (cx === ex && cz === ez) break;
    if (tmx < tmz) { if (tmx > 1) break; tmx += tdx; cx += sx; } else { if (tmz > 1) break; tmz += tdz; cz += sz; }
  }
  return _qarr;
}
function lineClear(a, b) {
  _v4.subVectors(b, a); const d = _v4.length(); if (d < 1e-4) return true;
  _v4.divideScalar(d);
  const h = rayWorld(a.x, a.y, a.z, _v4.x, _v4.y, _v4.z, d);
  return !h || h.t >= d - 0.05;
}

/* ---------- Named zones (shown under the minimap) ----------
   [name, x0, x1, z0, z1, y0, y1]; the first one that contains the point wins. Copied from the map definition. y0, y1 (optional): a
   floor of a building (its rooms upstairs and downstairs differ); a point given without height is taken on the ground. */
const ZONES = [];
function zoneName(x, z, y = 0) { for (const zn of ZONES) if (x >= zn[1] && x <= zn[2] && z >= zn[3] && z <= zn[4] && (zn[5] === undefined || (y >= zn[5] && y <= zn[6]))) return zn[0]; return CURMAP.info ? CURMAP.info.name : ''; }
