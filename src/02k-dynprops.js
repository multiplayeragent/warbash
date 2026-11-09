/* ==========================================================================
   PHYSICS PROPS: kit. Light scenery objects (fruit, pots, chairs, snowman, boat...) that are not
   merged with the map: they are rigid bodies (see 04b-physprops.js for the simulation), drawn as
   instances. They react to bullets, explosions and soldiers bumping them, without changing the game: a prop
   that had a collision keeps it as long as it hasn't been touched (same boxes as before), and gives it up only once dislodged.
   - A TYPE (propType) describes an object: its prefab, its contact shapes (sphere, box, cylinder), its mass and its
     reaction (shot, blast), what it becomes if it breaks. A parameter factory allows variants (carton: w, h, d).
   - A VARIANT is a type: one shared geometry and one InstancedMesh per material (one draw call per material, regardless
     of the number of objects). Each object's tint goes through the instance color (orange, red and green fruit
     are in the same mesh). Debris meshes stay invisible as long as nothing has burst.
   - A BODY (PBody) is an object placed on the map, with its position, orientation and velocities.
   Placing a prop: M.dyn('type', x, y, z, ry, { tint, s, a, rx, rz }) in the workshop (or from a prefab, which recreates it
   on every stamp). Everything is built during map construction (propsFinalize at the end of the scenery): nothing
   heavy mid-match, debris are dormant bodies reserved in advance.
   ========================================================================== */
const PHYS = {
  bodies: [], defs: new Map(), variants: new Map(), pcols: [], phash: new Map(), balls: [], awake: [], slept: [], stackers: [], moving: new Set(),
  live: false, ready: false, g: 15, maxAwake: 150, nextId: 0, pv: 0, acc: 0, // pv: number of the awake and slept lists (candidate pairs, 04b-physprops.js); acc: time not yet simulated (PH.hMin)
};
const PROPT = {}; // types: id -> definition, or factory (a) => definition
function propType(id, def) { PROPT[id] = def; return def; }
/* Contact shapes, in the prefab frame (set on y = 0): sphere, box (half-dimensions), vertical cylinder (half-height) */
const SPH = (cx, cy, cz, r) => ['s', cx, cy, cz, r];
const BOX = (cx, cy, cz, hx, hy, hz) => ['b', cx, cy, cz, hx, hy, hz];
const CYL = (cx, cy, cz, r, hh) => ['y', cx, cy, cz, r, hh];

/* Full definition of a type: shapes recentered on the center of mass, density and inertia, contact points */
function propDef(type, a) {
  const key = type + (a && a.length ? '|' + a.join(',') : '');
  let d = PHYS.defs.get(key); if (d) return d;
  const F = PROPT[type]; if (!F) throw new Error('unknown prop: ' + type);
  d = Object.assign({ mass: 1, mu: 0.6, e: 0.3, drag: 0.05, rr: 2.5, resp: 3, blast: 8, lift: 0.5, hp: Infinity, mat: 'concrete', snd: 'hard', ray: true, hold: 0, stack: false, spill: false, topple: 0, through: false, ball: false, debris: null }, typeof F === 'function' ? F(a || []) : F);
  d.type = type; d.key = key;
  // center of mass: the type's own, otherwise the center of the shapes' bounding box
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
  const ext = (cx, cy, cz, hx, hy, hz) => { x0 = Math.min(x0, cx - hx); x1 = Math.max(x1, cx + hx); y0 = Math.min(y0, cy - hy); y1 = Math.max(y1, cy + hy); z0 = Math.min(z0, cz - hz); z1 = Math.max(z1, cz + hz); };
  for (const s of d.shapes) {
    if (s[0] === 's') ext(s[1], s[2], s[3], s[4], s[4], s[4]); else if (s[0] === 'b') ext(s[1], s[2], s[3], s[4], s[5], s[6]); else ext(s[1], s[2], s[3], s[4], s[5], s[4]);
  }
  d.com = d.com || [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  const [mx, my, mz] = d.com;
  d.sh = d.shapes.map((s) => { const o = s.slice(); o[1] -= mx; o[2] -= my; o[3] -= mz; return o; });
  // principal inertia (for s = 1): sphere, cylinder or bounding box
  const m = d.mass, lx = x1 - x0, ly = y1 - y0, lz = z1 - z0;
  let I;
  if (d.sh.length === 1 && d.sh[0][0] === 's') { const q = 0.4 * m * d.sh[0][4] ** 2; I = [q, q, q]; }
  else if (d.sh.length === 1 && d.sh[0][0] === 'y') { const r = d.sh[0][4], h = 2 * d.sh[0][5], t = m * (3 * r * r + h * h) / 12; I = [t, m * r * r / 2, t]; }
  else I = [m * (ly * ly + lz * lz) / 12, m * (lx * lx + lz * lz) / 12, m * (lx * lx + ly * ly) / 12];
  d.ii = I.map((v) => 1 / Math.max(v, 1e-5));
  // bounding radius and contact points (x, y, z, radius), in the center-of-mass frame
  let rad = 0; const pts = [];
  for (const s of d.sh) {
    if (s[0] === 's') { rad = Math.max(rad, hyp3(s[1], s[2], s[3]) + s[4]); pts.push([s[1], s[2], s[3], s[4]]); }
    else if (s[0] === 'b') {
      rad = Math.max(rad, hyp3(s[1], s[2], s[3]) + hyp3(s[4], s[5], s[6]));
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) pts.push([s[1] + sx * s[4], s[2] + sy * s[5], s[3] + sz * s[6], 0]);
    } else {
      rad = Math.max(rad, hyp3(s[1], s[2], s[3]) + hyp(s[4], s[5]));
      for (const sy of [-1, 1]) for (let k = 0; k < 12; k++) { const t = (k / 12) * TAU; pts.push([s[1] + Math.cos(t) * s[4], s[2] + sy * s[5], s[3] + Math.sin(t) * s[4], 0]); }
    }
  }
  d.pts = d.contact ? d.contact.map((p) => [p[0] - mx, p[1] - my, p[2] - mz, p[3] || 0]) : pts;
  // probe points for body-to-body collisions (propDeepest): corners, face and base centers. Corners alone don't see
  // two boxes of the same footprint passing through each other vertically (their corners stay on the other's walls).
  d.qp = [];
  for (const s of d.sh) {
    if (s[0] === 's') d.qp.push([s[1], s[2], s[3]]);
    else if (s[0] === 'b') {
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) d.qp.push([s[1] + sx * s[4], s[2] + sy * s[5], s[3] + sz * s[6]]);
      for (const k of [-1, 1]) d.qp.push([s[1] + k * s[4], s[2], s[3]], [s[1], s[2] + k * s[5], s[3]], [s[1], s[2], s[3] + k * s[6]]);
    } else {
      for (const sy of [-1, 1]) { d.qp.push([s[1], s[2] + sy * s[5], s[3]]); for (let k = 0; k < 12; k++) { const t = (k / 12) * TAU; d.qp.push([s[1] + Math.cos(t) * s[4], s[2] + sy * s[5], s[3] + Math.sin(t) * s[4]]); } }
    }
  }
  d.rad = rad;
  // volume of the shapes (s = 1) and density: a body lighter than water floats in it (propStep), except d.sink (sand, metal, gas, pottery
  // full of earth); d.hy: half-height of the shapes, against which the submerged share is measured
  let vol = 0; for (const s of d.sh) vol += s[0] === 's' ? 4.19 * s[4] ** 3 : s[0] === 'b' ? 8 * s[4] * s[5] * s[6] : 6.283 * s[4] * s[4] * s[5];
  d.rho = d.sink ? 2500 : d.mass / Math.max(vol, 1e-6); d.hy = (y1 - y0) / 2;
  PHYS.defs.set(key, d);
  return d;
}

/* Variant: a type. Its bodies are stored in a group per map cell (PCELL m on a side); the group is an InstancedMesh
   per material, with the bounding sphere of its bodies. A single cell for now (huge PCELL): splitting the map into
   cells let off-screen groups be culled but multiplied draw calls far more than it avoided (160 more
   in open view, shadows included). */
const PCELL = Infinity;
function propCell(x, z) { return Math.floor(x / PCELL) + ',' + Math.floor(z / PCELL); }
function propVariant(d) {
  let V = PHYS.variants.get(d.key); if (V) return V;
  V = { key: d.key, d, pf: d.pf(), groups: new Map() };
  PHYS.variants.set(d.key, V);
  return V;
}
function propGroup(V, cell) {
  let G = V.groups.get(cell);
  if (!G) V.groups.set(cell, G = { V, cell, bodies: [], pool: [], reserve: 0, attr: null, colors: null, sphere: new THREE.Sphere(), meshes: [], lazy: false, on: false });
  return G;
}
/* Debris pool: each breakable body carries with it, in its cell, the dormant bodies it will need when breaking */
function propReserve(d, cell) {
  if (!d.debris) return;
  for (const [type, n, a] of d.debris) propGroup(propVariant(propDef(type, a)), cell).reserve += n;
}

const _phM = new Maker(null);
/* Places a prop: (x, y, z) is the prefab origin (on the ground). o: tint (sRGB), s (scale), a (factory arguments),
   rx and rz (initial tilt, in radians), nocol (without the prefab's collision), id (identifier of a reserve body) */
function propSpawn(type, x, y, z, ry = 0, o = {}) {
  const d = propDef(type, o.a), V = propVariant(d), s = o.s || 1;
  const b = new PBody(d, V, s);
  if (o.tint) { b.tintRaw = o.tint; b.tint = [sl(o.tint[0]), sl(o.tint[1]), sl(o.tint[2])]; }
  const q = b.q; q.setFromEuler(_peul.set(o.rx || 0, ry, o.rz || 0, 'YXZ'));
  propRot(b);
  b.p.set(x + (b.R[0] * d.com[0] + b.R[1] * d.com[1] + b.R[2] * d.com[2]) * s, y + (b.R[3] * d.com[0] + b.R[4] * d.com[1] + b.R[5] * d.com[2]) * s, z + (b.R[6] * d.com[0] + b.R[7] * d.com[1] + b.R[8] * d.com[2]) * s);
  b.origin = { x, y, z, ry, rx: o.rx || 0, rz: o.rz || 0 };
  // prefab collision: the same boxes as before, which shots ignore (the prop's shape handles that); given up on first impact
  if (!o.nocol && V.pf.cols.length) {
    _phM.m.makeTranslation(x, y, z); _phM.m.multiply(_pdm.makeRotationFromQuaternion(q)); _phM.m.multiply(_pdm.makeScale(s, s, s));
    for (const c of V.pf.cols) {
      const bb = _phM._aabb(c.x0, c.x1, c.y0, c.y1, c.z0, c.z1), e = { x0: bb.x0, x1: bb.x1, y0: bb.y0, y1: bb.y1, z0: bb.z0, z1: bb.z1, m: c.m, ray: !!c.ray, noRay: true, prop: b };
      e.o = [e.x0, e.x1, e.y0, e.y1, e.z0, e.z1];
      COL.push(e); b.cols.push(e);
      if (c.occ !== false && !c.ray) OCC.push({ x0: bb.x0, x1: bb.x1, y0: bb.y0, y1: bb.y1, z0: bb.z0, z1: bb.z1, k: 1 });
    }
  }
  const cell = propCell(x, z), G = propGroup(V, cell);
  propReserve(d, cell);
  b.id = PHYS.nextId++; b.G = G; b.cell = cell; b.vi = G.bodies.length; G.bodies.push(b); PHYS.bodies.push(b);
  if (d.ball) PHYS.balls.push(b);
  PHYS.live = true;
  return b;
}
const _peul = new THREE.Euler(), _pdm = new THREE.Matrix4();
/* Map collision box shared by the listed bodies (two jars against a wall): shots ignore it, soldiers
   run into it, and it disappears as soon as one of the bodies is dislodged */
function propLink(bodies, bb, m) {
  const e = { x0: bb.x0, x1: bb.x1, y0: bb.y0, y1: bb.y1, z0: bb.z0, z1: bb.z1, m, ray: false, noRay: true, prop: bodies[0] };
  e.o = [e.x0, e.x1, e.y0, e.y1, e.z0, e.z1];
  COL.push(e); OCC.push({ ...bb, k: 1 });
  for (const b of bodies) b.cols.push(e);
}
/* Collision reserved for props (walls of the fruit crate) */
function propBlock(bb, tag) { PHYS.pcols.push({ x0: bb.x0, x1: bb.x1, y0: bb.y0, y1: bb.y1, z0: bb.z0, z1: bb.z1, m: 'wood', ray: false, crate: tag === 'crate', o: [bb.x0, bb.x1, bb.y0, bb.y1, bb.z0, bb.z1] }); }

/* End of scenery construction: reserve bodies, shared geometries, instances. Called right after finalizeWorld. */
function propsFinalize() {
  // debris: a reserve of dormant bodies per group (debris types have no prefab placed on the map)
  for (const V of [...PHYS.variants.values()]) for (const G of V.groups.values()) {
    for (let i = 0; i < G.reserve; i++) {
      const b = new PBody(V.d, V, 1); b.state = 0; b.pooled = true; b.G = G; b.cell = G.cell; b.id = PHYS.nextId++; b.vi = G.bodies.length;
      G.bodies.push(b); G.pool.push(b); PHYS.bodies.push(b); if (V.d.ball) PHYS.balls.push(b);
    }
  }
  for (const V of PHYS.variants.values()) {
    const pf = V.pf, parts = [];
    for (const part of pf.parts.values()) { const mat = propMat(part.mat); if (part.g.nv && mat) parts.push({ part, mat, geo: propGeometry(V, part) }); }
    for (const G of V.groups.values()) {
      const n = Math.max(1, G.bodies.length), tinted = G.bodies.some((b) => b.tint);
      G.attr = new THREE.InstancedBufferAttribute(new Float32Array(n * 16), 16).setUsage(THREE.DynamicDrawUsage);
      if (tinted) {
        G.colors = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3);
        for (const b of G.bodies) if (b.tint) G.colors.array.set(b.tint, b.vi * 3);
      }
      G.lazy = G.bodies.every((b) => b.pooled); // debris: the mesh only exists on screen from the first burst
      for (const { part, mat, geo } of parts) {
        // one geometry per group (own bounding sphere), the vertex buffers stay shared
        const g2 = new THREE.BufferGeometry(); for (const k in geo.attributes) g2.setAttribute(k, geo.attributes[k]); g2.setIndex(geo.index); g2.boundingSphere = G.sphere;
        const mesh = new THREE.InstancedMesh(g2, mat, n), cls = part.cls >= 2 ? 1 : part.cls;
        mesh.instanceMatrix = G.attr; mesh.count = n; mesh.matrixAutoUpdate = false;
        // the object's tint (instance color) only affects the tintable parts of the prefab. All prop meshes have
        // an instance color, white by default: three.js picks a material's program at the first instanced mesh that
        // uses it, and a mesh without instance color on a program that reads one would be black (or, the other way around, the
        // tints would be ignored depending on the build order of the variants)
        if (tinted && (pf.tintable ? pf.tintable.includes(part.mat) : true)) mesh.instanceColor = G.colors;
        else mesh.instanceColor = G.white || (G.white = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3));
        mesh.name = 'prop:' + V.key + ':' + G.cell + ':' + part.mat;
        mesh.castShadow = cls === 0 && !mat.userData.noShadow; mesh.receiveShadow = !mat.userData.noReceive;
        if (mat.userData.noAO) mesh.userData.noAO = true;
        if (cls === 0 && NEAR_SHADOW.has(part.mat)) mesh.layers.set(LAYER_NEAR);
        mesh.userData.noPrepass = true; mesh.visible = !G.lazy;
        mapAdd(mesh); G.meshes.push(mesh);
      }
      for (const b of G.bodies) propWrite(b);
      G.attr.needsUpdate = true; propGroupBounds(G);
    }
    V.pf = null; // its buffers are no longer used: the geometry is shared
  }
  propsIndex();
  // volumes of the collisions reserved for props: 2 m hash table
  PHYS.phash.clear();
  PHYS.pcols.forEach((c, i) => {
    for (let x = Math.floor(c.x0 / 2); x <= Math.floor(c.x1 / 2); x++) for (let z = Math.floor(c.z0 / 2); z <= Math.floor(c.z1 / 2); z++) {
      const k = x * 1000 + z; let a = PHYS.phash.get(k); if (!a) PHYS.phash.set(k, a = []); a.push(i);
    }
  });
  PHYS.ready = true;
}
/* Material of a prop: a copy of the scenery's. three.js keeps only one program per material, and the program of an instanced mesh
   is not that of a plain mesh: shared between the scenery and the props, a material changed program twice per frame and
   three.js recomputed its key each time (getParameters, getProgramCacheKey: 13 materials on Chergui, 26 recomputations and 19 KB allocated per
   frame, stutters.js). One copy per material, kept for the map (freed with its meshes by mapUnload). It stays registered for cascaded
   shadows through the original material (same onBeforeCompile: they share the cascades array).
   The defines are the material's, shared: three.js's copy (MeshStandardMaterial.copy) resets them to { STANDARD }, and the prop
   lost the scenery's baked lighting (WM: it came out lighter and washed out) and the cascaded shadows. Shadows are installed after the copy
   (shadeMaterials): propMatsSync takes over the original material's chain there. */
const PROP_MATS = new Map();
function propMat(k) {
  const m = MAT[k]; if (!m) return m;
  let c = PROP_MATS.get(m); if (c) return c;
  c = m.clone(); c.defines = m.defines; c.onBeforeCompile = m.onBeforeCompile; c.userData = m.userData; c.customProgramCacheKey = m.customProgramCacheKey;
  c.uuid = 'decor-' + k + '-prop'; // fixed identifier, like the material's (shadeMaterials, called later): three.js's shadow material cache doesn't grow from one match to the next
  PROP_MATS.set(m, c); return c;
}
/* After the shadows are installed on the scenery materials (shadeMaterials): the prop copies take over their compile chain */
function propMatsSync() {
  for (const [m, c] of PROP_MATS) { c.defines = m.defines; c.onBeforeCompile = m.onBeforeCompile; c.customProgramCacheKey = m.customProgramCacheKey; }
}
/* Shared geometry of a prefab piece, recentered on the center of mass */
function propGeometry(V, part) {
  const g = part.g, n = g.nv, com = V.d.com;
  const P = new Float32Array(n * 3), C = g.C.slice(0, n * 3);
  for (let i = 0; i < n; i++) { P[i * 3] = g.P[i * 3] - com[0]; P[i * 3 + 1] = g.P[i * 3 + 1] - com[1]; P[i * 3 + 2] = g.P[i * 3 + 2] - com[2]; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(g.N.slice(0, n * 3), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(g.U.slice(0, n * 2), 2));
  geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
  geo.setAttribute('aoc', new THREE.BufferAttribute(g.A.slice(0, n), 1));
  geo.setIndex(new THREE.BufferAttribute(n > 65535 ? g.I.slice(0, g.ni) : Uint16Array.from(g.I.subarray(0, g.ni)), 1));
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  return geo;
}

/* ---------- Prop prefabs ---------- */
const G_FRUIT = new THREE.SphereGeometry(1, 9, 6);
/* Fruit: sphere of 6 cm radius (the tint makes it an orange, an apple, a lemon) */
PF.fruitBall = () => prefab('fruitBall', (M) => {
  M.color([1, 1, 1]).local(1);
  M.cls = 1; // no cast shadow: a 12 cm fruit casts no visible one
  M.save().move(0, 0.06, 0).scl(0.06); M.geo('plastic', G_FRUIT, { uvs: 0.12 }); M.restore();
});
/* Slats and floor of a fruit crate (60 x 40 x 19 cm): a physics body, which carries its fruit away when it goes */
PF.fruitBox = () => prefab('fruitBox', (M) => {
  M.save().color([0.8, 0.7, 0.55]).local(1);
  for (const y of [0.02, 0.12]) for (const s of [-1, 1]) { M.boxB('crate', -0.3, 0.3, y, y + 0.07, s * 0.2 - 0.01, s * 0.2 + 0.01); M.boxB('crate', s * 0.3 - 0.01, s * 0.3 + 0.01, y, y + 0.07, -0.2, 0.2); }
  M.boxB('crate', -0.3, 0.3, 0, 0.02, -0.2, 0.2);
  M.restore();
});
/* Fruit crate: the crate itself (`fruitBox` body), the walls that hold the fruit (collision reserved for props,
   'crate' tag) and 15 dynamic fruits in the stamp's tint. A shot at the crate or a blast moves it: its
   walls disappear with it and the fruit spills out. The fruits alone roll and push each other. */
PF.fruitCrate = () => prefab('fruitCrate', (M, P) => {
  P.tintable = []; // the stamp's tint is the fruit's, not the slats'
  M.dyn('fruitBox', 0, 0, 0, 0);
  M.pcol(-0.3, 0.3, 0, 0.03, -0.2, 0.2, 'crate');
  for (const s of [-1, 1]) { M.pcol(s * 0.3 - 0.01, s * 0.3 + 0.01, 0, 0.2, -0.2, 0.2, 'crate'); M.pcol(-0.3, 0.3, 0, 0.2, s * 0.2 - 0.01, s * 0.2 + 0.01, 'crate'); }
  const R = rngOf(5);
  for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) M.dyn('fruit', -0.21 + i * 0.14, 0.03, (j - 1) * 0.12, R() * TAU, { tintFrom: true });
  for (let i = 0; i < 3; i++) M.dyn('fruit', -0.14 + i * 0.14, 0.1275, 0, R() * TAU, { tintFrom: true });
});
propType('fruitBox', { pf: () => PF.fruitBox(), shapes: [BOX(0, 0.095, 0, 0.3, 0.095, 0.2)], mass: 1.4, mu: 0.55, e: 0.2, rr: 3, resp: 4, blast: 10, spill: 'fruit', mat: 'wood', snd: 'wood' });
/* What the fruits have in common: small spheres that roll and push each other */
propType('fruit', { pf: () => PF.fruitBall(), shapes: [SPH(0, 0.06, 0, 0.06)], mass: 0.2, mu: 0.5, e: 0.4, rr: 1.2, resp: 6, blast: 11, lift: 1.2, through: true, ball: true, mat: 'dirt', snd: 'fruit' });

/* Terracotta shard: fragment of a pot or jar that breaks (propKid, 04b-physprops.js). It was called PF.shard, like the tile shard
   in the ground dust (02h-nature.js), which it replaced everywhere (concatenated files: the last definition wins) */
PF.potShard = () => prefab('potShard', (M) => {
  M.color([0.72, 0.42, 0.28]).local(1);
  M.cls = 1;
  M.boxB('concrete', -0.05, 0.05, 0, 0.014, -0.035, 0.035, { bevel: 0.004 });
});
propType('shard', { sink: true, pf: () => PF.potShard(), shapes: [BOX(0, 0.007, 0, 0.05, 0.007, 0.035)], mass: 0.05, mu: 0.7, e: 0.2, rr: 3, ray: false, through: true, mat: 'dirt', snd: 'clay' });
/* Terracotta pot and jar: a shot breaks them into shards */
propType('pot', { sink: true, pf: () => PF.pot(), shapes: [CYL(0, 0.125, 0, 0.14, 0.125)], mass: 6, mu: 0.7, e: 0.2, resp: 2.6, blast: 7, hp: 20, mat: 'dirt', snd: 'clay', brk: 'clay', debris: [['shard', 6]] });
propType('jar', { pf: () => PF.jar(1), shapes: [CYL(0, 0.32, 0, 0.22, 0.32)], mass: 7, mu: 0.7, e: 0.2, resp: 3, blast: 8, hp: 28, mat: 'dirt', snd: 'clay', brk: 'clay', debris: [['shard', 7]] });

/* Plank crate (PF.crate, side s as argument: 0.55 to 1.2 m): it withstands a few bullets, then moves and falls off its stack. The big ones (0.9 m and up)
   block passages: they are fixed obstacles (fixed), placed like ordinary scenery that neither bullet nor explosion moves; the small ones stay props */
propType('crate', (a) => { const s = a[0] || 1.1; return { pf: () => PF.crate(s), shapes: [BOX(0, s / 2, 0, s / 2, s / 2, s / 2)], mass: 22 * s * s * s, mu: 0.6, e: 0.15, rr: 3, resp: 2.4, blast: 6, hold: 12 + 28 * s, stack: true, mat: 'wood', snd: 'wood', fixed: s >= 0.9 }; });
/* Open spice sack (48 x 41 cm), low sandbag (PF.sandbag), bar bottle (height as argument, bursts on the first bullet).
   noNav: bot navigation places no node on top (a chipped wall of sacks made a 0.44 m step, higher on a
   dune, which bots climbed without being able to clear; they go around walls and step over a fallen sack) */
propType('spiceSack', { sink: true, pf: () => PF.spiceSack(), shapes: [BOX(0, 0.205, 0, 0.24, 0.205, 0.23)], mass: 9, mu: 0.9, e: 0.05, rr: 6, resp: 2.6, blast: 7, hold: 6, stack: true, mat: 'dirt', snd: 'soft' });
propType('sandbagLow', { sink: true, noNav: true, pf: () => PF.sandbag(), shapes: [BOX(0, 0.075, 0, 0.29, 0.075, 0.165)], mass: 12, mu: 0.9, e: 0.05, rr: 6, resp: 2, blast: 5, hold: 40, stack: true, mat: 'dirt', snd: 'soft' });
propType('bottle', (a) => { const h = a[0] || 0.26; return { pf: () => PF.bottle(h), shapes: [CYL(0, h / 2, 0, 0.035, h / 2)], mass: 0.7, mu: 0.4, e: 0.2, rr: 2, resp: 5, blast: 12, hp: 1, mat: 'glass', snd: 'plastic', brk: 'glass' }; });
/* Coiled rope (PF.ropeCoil) */
propType('ropeCoil', { pf: () => PF.ropeCoil(), shapes: [CYL(0, 0.09, 0, 0.34, 0.09)], mass: 6, mu: 0.8, e: 0.1, rr: 5, resp: 3, blast: 8, stack: true, mat: 'dirt', snd: 'soft' });
/* Glass bottle (body and neck), tint of the stamp */
PF.bottle = (h = 0.26) => prefab('bottle' + h.toFixed(2), (M) => {
  M.color([1, 1, 1]).local(1); M.cls = 1;
  M.cyl('glass', 0.035, h * 0.62, 6); M.save().move(0, h * 0.62, 0); M.cyl('glass', 0.014, h * 0.38, 6); M.restore();
});

/* Furniture and everyday objects */
propType('chair', { sink: true, pf: () => PF.chair(), shapes: [BOX(0, 0.45, 0, 0.23, 0.45, 0.23)], mass: 2.5, mu: 0.5, e: 0.25, resp: 3.2, blast: 9, mat: 'metal', snd: 'plastic' });
propType('cafeTable', { sink: true, pf: () => PF.cafeTable(), shapes: [CYL(0, 0.35, 0, 0.35, 0.35)], mass: 6, mu: 0.5, e: 0.25, resp: 2.2, blast: 7, mat: 'metal', snd: 'metal' });
propType('jerrycan', { pf: () => PF.jerrycan(), shapes: [BOX(0, 0.24, 0, 0.09, 0.24, 0.17)], mass: 1.6, mu: 0.55, e: 0.25, resp: 4.5, blast: 10, mat: 'metal', snd: 'metal' });
propType('gasBottle', { sink: true, pf: () => PF.gasBottle(), shapes: [CYL(0, 0.33, 0, 0.15, 0.33)], mass: 14, mu: 0.5, e: 0.2, rr: 1.2, resp: 1.8, blast: 6, mat: 'metal', snd: 'metal' });
propType('trashBag', { pf: () => PF.trashBag(), shapes: [SPH(0, 0.24, 0, 0.23)], mass: 3, mu: 1, e: 0.05, rr: 6, resp: 3, blast: 8, mat: 'dirt', snd: 'soft' });
propType('cardboard', (a) => {
  const w = a[0] || 0.5, h = a[1] || 0.4, d = a[2] || 0.4;
  return { pf: () => PF.cardboard(w, h, d), shapes: [BOX(0, h / 2, 0, w / 2, h / 2, d / 2)], mass: 12 * w * h * d, mu: 0.7, e: 0.15, resp: 4, blast: 10, mat: 'dirt', snd: 'soft' };
});
propType('sled', { pf: () => PF.sled(), shapes: [BOX(0, 0.12, -0.03, 0.23, 0.12, 0.5)], mass: 6, mu: 0.35, e: 0.2, resp: 3, blast: 8, mat: 'wood', snd: 'wood' });
/* Skis and poles: each is a body, leaning against the rack's board (skiRackAt); a shot knocks one down, not the others */
propType('ski', { pf: () => PF.skiOne(), shapes: [BOX(0, 0.875, 0, 0.04, 0.875, 0.012)], mass: 2.2, mu: 0.4, e: 0.2, rr: 3, resp: 3.5, blast: 9, mat: 'wood', snd: 'wood' });
propType('skiPole', { pf: () => PF.skiPole(), shapes: [BOX(0, 0.625, 0, 0.02, 0.625, 0.02)], mass: 0.4, mu: 0.5, e: 0.2, rr: 3, resp: 5, blast: 11, mat: 'wood', snd: 'wood' });

/* Furniture and crates: what stands in balance (pile of sacks, tires, crates) falls when its support goes (stack),
   what is heavy withstands the first hits (hold: damage points absorbed before moving) */
propType('table', { pf: () => PF.table(), shapes: [BOX(0, 0.4, 0, 1.0, 0.4, 0.5)], mass: 26, mu: 0.5, e: 0.2, rr: 3, resp: 1.5, blast: 5, hold: 20, mat: 'wood', snd: 'wood' });
propType('barrel', { pf: () => PF.barrel(), shapes: [CYL(0, 0.45, 0, 0.29, 0.45)], mass: 24, mu: 0.45, e: 0.2, rr: 0.9, resp: 1.7, blast: 5, hold: 25, mat: 'metal', snd: 'metal' });
propType('sandbag', { sink: true, noNav: true, pf: () => PF.sandbagFat(), shapes: [BOX(0, 0.11, 0, 0.3, 0.11, 0.2)], mass: 16, mu: 0.9, e: 0.05, rr: 6, resp: 1.8, blast: 5, hold: 70, stack: true, mat: 'dirt', snd: 'soft' });
propType('sandbagHalf', { sink: true, noNav: true, pf: () => PF.sandbagHalf(), shapes: [BOX(0, 0.11, 0, 0.15, 0.11, 0.2)], mass: 8, mu: 0.9, e: 0.05, rr: 6, resp: 2.2, blast: 6, hold: 45, stack: true, mat: 'dirt', snd: 'soft' }); // closes the end of a staggered row
propType('tire', { pf: () => PF.tire(), shapes: [CYL(0, 0.1, 0, 0.4, 0.1)], mass: 9, mu: 0.8, e: 0.45, rr: 1.2, resp: 2.2, blast: 6, hold: 25, stack: true, mat: 'dirt', snd: 'soft' });
propType('hayBale', { pf: () => PF.hayBale(), shapes: [BOX(0, 0.225, 0, 0.45, 0.225, 0.25)], mass: 22, mu: 0.85, e: 0.05, rr: 6, resp: 1.3, blast: 5, hold: 45, stack: true, mat: 'dirt', snd: 'soft' });
propType('lobsterPot', { sink: true, pf: () => PF.lobsterPot(), shapes: [BOX(0, 0.15, 0, 0.3, 0.15, 0.3)], mass: 8, mu: 0.6, e: 0.2, rr: 3, resp: 2.2, blast: 6, hold: 20, stack: true, mat: 'metal', snd: 'metal' });
/* Fish bins (80 x 50 x 30 cm): the top bin of a pile carries its ice bed (`fishBinIce`) and its fish, which spill out
   when it goes; the bins below fall when their support goes */
propType('fishBin', { pf: () => PF.fishBinSolid(), shapes: [BOX(0, 0.15, 0, 0.42, 0.15, 0.25)], mass: 1.3, mu: 0.5, e: 0.2, rr: 3, resp: 3.2, blast: 9, stack: true, mat: 'metal', snd: 'plastic' });
propType('fishBinIce', { pf: () => PF.fishBinIce(), shapes: [BOX(0, 0.15, 0, 0.42, 0.15, 0.25)], mass: 4, mu: 0.5, e: 0.2, rr: 3, resp: 2.4, blast: 7, stack: true, spill: 'fish', mat: 'metal', snd: 'plastic' });
/* 30 cm fish (scale by its length, tint by species): bullets pass through it and it's pushed like a fruit */
propType('fish', { pf: () => PF.fishOne(), shapes: [BOX(0, 0, 0, 0.025, 0.035, 0.17)], mass: 0.45, mu: 0.7, e: 0.1, rr: 4, resp: 6, blast: 11, lift: 1.0, through: true, mat: 'dirt', snd: 'fruit' });
propType('buoy', (a) => {
  const r = a[0] || 0.3;
  return { pf: () => PF.buoy([a[1], a[2], a[3]], r), shapes: [SPH(0, r, 0, r)], mass: 14 * r * r * r * 10, mu: 0.5, e: 0.4, rr: 0.7, resp: 4, blast: 8, mat: 'dirt', snd: 'soft' };
});
/* Bicycle: standing on its two wheels, it falls on its side as soon as a shot hits it (topple), handlebar and saddle as supports */
propType('bicycle', (a) => {
  const rim = [];
  for (const z of [-0.52, 0.52]) for (let i = 0; i < 10; i++) { const t = (i / 10) * TAU; rim.push([0, 0.34 + 0.34 * Math.cos(t), z + 0.34 * Math.sin(t)]); }
  return {
    pf: () => PF.bicycle(), shapes: [BOX(0, 0.5, 0, 0.14, 0.5, 0.55)], com: [0, 0.5, 0],
    contact: [...rim, [0, 0.9, -0.12], [0, 0.86, -0.28], [-0.25, 0.98, 0.34], [0.25, 0.98, 0.34], [0, 0.98, 0.4]],
    mass: 13, mu: 0.5, e: 0.2, rr: 2, resp: 1.6, blast: 6, topple: 3, mat: 'metal', snd: 'metal',
  };
});

/* ---------- Setup: chairs facing their table, ski rack ---------- */
/* Chair placed at (cx, cz) and turned toward (tx, tz): a chair always faces the table it serves (the front of the prefab is +z) */
function chairFacing(M, cx, cz, tx, tz, tint, jit = 0, y = 0) { return M.dyn('chair', cx, y, cz, Math.atan2(tx - cx, tz - cz) + jit, { tint }); }
/* Round cafe table at (x, z) and its chairs (angle around the table in radians, 0 = toward +x) 0.6 m from the axis. M: world frame. */
function cafeSet(M, x, z, angles, tint) {
  M.dyn('cafeTable', x, 0, z, 0);
  angles.forEach((a, i) => chairFacing(M, x + Math.cos(a) * 0.6, z + Math.sin(a) * 0.6, x, z, tint, (i % 2 ? 0.1 : -0.08)));
}
/* 2 x 1 m wooden table (angle ry) and its chairs: seats = [[lx, lz]...] in the table frame (lz = ±0.72 along the long sides) */
function tableSet(M, x, z, ry, seats, tint) {
  M.dyn('table', x, 0, z, ry);
  const c = Math.cos(ry), s = Math.sin(ry);
  seats.forEach(([lx, lz], i) => chairFacing(M, x + lx * c + lz * s, z - lx * s + lz * c, x, z, tint, (i % 2 ? 0.12 : -0.1)));
}
/* Ski rack placed at (x, z), back toward -z rotated by ry: 4 pairs of skis and their poles, each an independent body.
   cols: tints of the pairs. Nothing holds the skis but the back board: a shot knocks one down, the others stay. */
function skiRackAt(M, x, z, ry, cols) {
  M.save().move(x, 0, z).rotY(ry); M.put(PF.skiRack());
  cols.forEach((c, k) => {
    const x0 = -0.85 + k * 0.45;
    M.dyn('ski', x0, 0, 0, 0, { rx: -0.2, tint: c }); M.dyn('ski', x0 + 0.14, 0, 0, 0, { rx: -0.2, tint: c });
    M.dyn('skiPole', x0 + 0.28, 0, 0, 0, { rx: -0.2757 }); M.dyn('skiPole', x0 + 0.34, 0, 0.01, 0, { rx: -0.2757 });
  });
  M.restore();
}

/* Snowman: on the first shot it bursts into three balls, hat, carrot, scarf and branches */
propType('snowman', {
  pf: () => PF.snowman(), shapes: [SPH(0, 0.32, 0, 0.4), SPH(0, 0.9, 0, 0.3), SPH(0, 1.33, 0, 0.2)], mass: 120, mu: 0.4, e: 0.1, resp: 0.8, blast: 7, hp: 18, mat: 'snow', snd: 'snow', brk: 'snowman',
  debris: [['snowball', 3], ['snowHat', 1], ['carrot', 1], ['scarf', 1], ['twig', 2]],
});
/* Snowball: radius-1 sphere, scaled (the snowman's bottom: 0.4; its middle: 0.3; its head: 0.2) */
PF.snowball = () => prefab('snowball', (M) => { M.color([1, 1, 1]).local(1); M.geo('snowmat', new THREE.SphereGeometry(1, 14, 10), { uvs: 2 }); });
propType('snowball', { pf: () => PF.snowball(), shapes: [SPH(0, 0, 0, 1)], mass: 900, mu: 0.4, e: 0.1, rr: 0.9, resp: 1, blast: 8, ball: true, ray: false, mat: 'snow', snd: 'snow' });
PF.snowHat = () => prefab('snowHat', (M) => {
  M.color([0.2, 0.32, 0.55]).local(1);
  M.lathe('canvas', [[0, 0.23], [0.12, 0.2], [0.19, 0.09], [0.205, 0.03], [0.205, 0], [0, 0]], 12);
  M.save().move(0, 0.26, 0).scl(0.05); M.geo('canvas', G_SPH); M.restore();
});
propType('snowHat', { pf: () => PF.snowHat(), shapes: [SPH(0, 0.12, 0, 0.17)], mass: 0.3, mu: 0.6, e: 0.3, rr: 1.5, resp: 6, blast: 12, through: true, ray: false, ball: true, mat: 'snow', snd: 'soft' });
PF.carrot = () => prefab('carrot', (M) => {
  M.color([0.95, 0.45, 0.12]).local(1);
  M.save().move(0, 0.03, 0).rotX(Math.PI / 2); M.cyl('plastic', 0.03, 0.17, 6, { r1: 0.002 }); M.restore();
});
propType('carrot', { pf: () => PF.carrot(), shapes: [BOX(0, 0.03, 0.085, 0.03, 0.03, 0.085)], mass: 0.1, mu: 0.6, e: 0.3, rr: 3, through: true, ray: false, mat: 'snow', snd: 'soft' });
PF.scarf = () => prefab('scarf', (M) => {
  M.color([0.72, 0.12, 0.1]).local(1);
  M.cyl('canvas', 0.21, 0.08, 12);
});
propType('scarf', { pf: () => PF.scarf(), shapes: [CYL(0, 0.04, 0, 0.21, 0.04)], mass: 0.3, mu: 0.8, e: 0.1, rr: 4, through: true, ray: false, mat: 'snow', snd: 'soft' });
PF.twig = () => prefab('twig', (M) => {
  M.color([0.35, 0.25, 0.17]).local(1);
  M.tube('wood', 0.015, [[-0.3, 0.015, 0], [0, 0.015, 0.03], [0.3, 0.015, 0]], 4);
});
propType('twig', { pf: () => PF.twig(), shapes: [BOX(0, 0.015, 0.01, 0.3, 0.015, 0.025)], mass: 0.1, mu: 0.7, e: 0.2, rr: 3, through: true, ray: false, mat: 'snow', snd: 'wood' });

/* ---------- Fisherman's rowboat ---------- */
/* 3.4 m by 1.3 m hull, flat bottom, raised bow, transom; white gunwale, two thwarts, two oars.
   Frame: bow toward +z, keel on y = 0. */
PF.rowboat = () => prefab('rowboat', (M, P) => {
  const L = 3.4, W = 1.3, D = 0.56, T = 0.035;
  // half-width at the gunwale, height of the gunwale and the keel, from the stern (t = 0) to the bow (t = 1)
  const hw = (t) => (W / 2) * (t < 0.45 ? lerp(0.6, 1, Math.sin((t / 0.45) * Math.PI / 2)) : Math.pow(Math.max(0, 1 - Math.pow((t - 0.45) / 0.55, 2.2)), 0.6));
  const gy = (t) => D + 0.2 * Math.pow(Math.max(0, (t - 0.6) / 0.4), 2) + 0.05 * Math.pow(1 - t, 3);
  const ky = (t) => 0.22 * Math.pow(Math.max(0, (t - 0.68) / 0.32), 2.2);
  const zt = (t) => lerp(-L / 2, L / 2, t);
  const sec = (t, s, inner) => { const w = Math.max(0, hw(t) - (inner ? T : 0)), y0 = ky(t) + (inner ? T : 0), y1 = gy(t); return [s * w, y0 + (y1 - y0) * Math.pow(Math.abs(s), 2.6), zt(t)]; };
  M.local(1);
  M.save().color([0.2, 0.44, 0.52]);
  M.aoFn = (x, y) => lerp(0.55, 1, smoothstep(0, 0.4, y));
  M.surf('paintwood', 16, 20, (u, v) => sec(v, u * 2 - 1, false), { uL: 2.6, vL: 3.4 });
  M.restore();
  M.save().color([0.62, 0.5, 0.36]);
  M.aoFn = (x, y) => lerp(0.5, 1, smoothstep(0, 0.45, y));
  M.surf('wood', 16, 20, (u, v) => sec(v, u * 2 - 1, true), { uL: 2.6, vL: 3.4, flipN: true });
  M.restore();
  M.aoFn = null;
  // transom: solid disc closing the hull (from gunwale to gunwale via the bottom)
  M.save().color([0.2, 0.44, 0.52]);
  { const ring = []; for (let i = 0; i <= 16; i++) ring.push(sec(0, (i / 16) * 2 - 1, false));
    const c = [0, 0.3, zt(0)]; for (let i = 0; i < 16; i++) M.tri3('paintwood', c, ring[i], ring[i + 1], [0, 0, -1]); }
  M.restore();
  // gunwale: rail swept from one gunwale to the other around the bow, transom across
  const rim = [];
  for (let i = 0; i <= 18; i++) { const t = i / 18; rim.push([-hw(t) + 0.01, gy(t) + 0.012, zt(t)]); }
  for (let i = 17; i >= 0; i--) { const t = i / 18; rim.push([hw(t) - 0.01, gy(t) + 0.012, zt(t)]); }
  M.save().color([0.9, 0.88, 0.82]); M.sweep('paintwood', rectShape(0.07, 0.03), rim, { uAround: 1 }); M.restore();
  M.save().color([0.9, 0.88, 0.82]).move(0, gy(0) + 0.012, zt(0) + 0.03); M.boxB('paintwood', -hw(0), hw(0), 0, 0.03, -0.035, 0.035); M.restore();
  // thwarts, keel skids and two oars laid across
  M.save().color([0.66, 0.52, 0.36]);
  for (const t of [0.27, 0.6]) { const w = hw(t) - T; M.boxB('wood', -w, w, 0.27 + ky(t), 0.31 + ky(t), zt(t) - 0.12, zt(t) + 0.12, { bevel: 0.006 }); }
  for (const x of [-0.26, 0.26]) M.boxB('wood', x - 0.03, x + 0.03, -0.03, 0.02, -1.3, 0.5, { bevel: 0.006 });
  M.restore();
  M.save().color([0.55, 0.4, 0.26]);
  for (const [x, a] of [[-0.12, 0.05], [0.12, -0.05]]) { M.save().move(x, 0.32, -0.3).rotY(a); M.boxB('wood', -0.02, 0.02, 0, 0.04, -1.0, 1.1, { bevel: 0.006 }); M.boxB('wood', -0.07, 0.07, 0, 0.012, 1.1, 1.65, { bevel: 0.004 }); M.restore(); }
  M.restore();
  // the hull rests on its keel: the same boxes as the collision of a long crate (removed on first impact)
  M.col(-0.6, 0.6, 0, 0.5, -1.65, 1.0, 'wood');
});
propType('rowboat', {
  pf: () => PF.rowboat(), shapes: [BOX(0, 0.3, -0.6, 0.62, 0.3, 1.1), BOX(0, 0.33, 0.85, 0.42, 0.33, 0.35), BOX(0, 0.42, 1.5, 0.15, 0.42, 0.2)], com: [0, 0.2, -0.1],
  contact: [[-0.3, 0, -1.5], [0.3, 0, -1.5], [-0.3, 0, -0.4], [0.3, 0, -0.4], [-0.3, 0, 0.7], [0.3, 0, 0.7], [0, 0.12, 1.4], [0, 0.4, 1.68],
    [-0.62, 0.55, -0.4], [0.62, 0.55, -0.4], [-0.39, 0.6, -1.7], [0.39, 0.6, -1.7], [-0.5, 0.15, -0.4], [0.5, 0.15, -0.4], [-0.35, 0.58, 0.7], [0.35, 0.58, 0.7]],
  mass: 70, mu: 0.6, e: 0.15, rr: 2, resp: 1.0, blast: 8.5, lift: 0.5, mat: 'wood', snd: 'wood',
});
