/* ==========================================================================
   RIGID SKELETONS: merging meshes for rendering
   Models stay described piece by piece (boxes, cylinders, spheres placed in groups), which keeps them
   easy to modify. Once built, bakeRig merges all the fixed pieces of a hierarchy
   into a single mesh per material: each group that carries pieces becomes a bone of a rigid skeleton
   (a vertex follows a single bone, with a weight of 1). Groups are still animated exactly as before,
   the vertices follow; a 150-piece model goes from 150 draw calls to a handful.
   ========================================================================== */
const _RIG_ID = new THREE.Matrix4();
/* Material of meshes that only cast a shadow (nothing is written to the screen) */
const SHADOW_ONLY_MAT = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
/* Shadow map material for animated meshes. three.js shares a single one between all objects: each
   switch from an animated mesh (soldier) to a fixed mesh (its weapon, the scenery) forced it to pick its program again,
   dozens of times per frame (three cascades). A separate material for animated meshes removes these switches. */
const SKIN_DEPTH_MAT = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });

/* Skeleton whose bones are ordinary groups. A hidden bone (itself or a parent up to the model root)
   has its matrix zeroed: its vertices collapse to a point and are no longer drawn, which
   preserves the visibility toggles of subgroups (magazine, hidden pieces). */
function rigidSkeleton(bones, root) {
  const sk = new THREE.Skeleton(bones, bones.map(() => new THREE.Matrix4()));
  const up = sk.update.bind(sk);
  sk.update = function () {
    up();
    const bm = this.boneMatrices;
    for (let i = 0; i < bones.length; i++) {
      let o = bones[i], vis = true;
      while (o && o !== root) { if (!o.visible) { vis = false; break; } o = o.parent; }
      if (!vis) bm.fill(0, i * 16, i * 16 + 16);
    }
  };
  return sk;
}

/* Geometry of a list of pieces { geo, matrix (in the space of its bone), bone }: shared position /
   normal / uv attributes (+ color if requested), indices kept (GPU vertex cache), bone per vertex. */
function rigGeometry(items, withColor) {
  let nv = 0, ni = 0;
  for (const it of items) { nv += it.geo.attributes.position.count; ni += it.geo.index ? it.geo.index.count : it.geo.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = withColor ? new Float32Array(nv * 3) : null;
  const skI = new Uint16Array(nv * 4), skW = new Float32Array(nv * 4), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const nm = new THREE.Matrix3(), v = new V3();
  let vo = 0, io = 0;
  for (const it of items) {
    const g = it.geo, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, C = g.attributes.color, n = P.count;
    nm.getNormalMatrix(it.matrix);
    for (let k = 0; k < n; k++) {
      v.fromBufferAttribute(P, k).applyMatrix4(it.matrix); v.toArray(pos, (vo + k) * 3);
      if (N) { v.fromBufferAttribute(N, k).applyMatrix3(nm).normalize(); v.toArray(nor, (vo + k) * 3); }
      if (it.uvMap) it.uvMap(U ? U.getX(k) : 0, U ? U.getY(k) : 0, uv, (vo + k) * 2);
      else if (U) { uv[(vo + k) * 2] = U.getX(k); uv[(vo + k) * 2 + 1] = U.getY(k); }
      if (col) { const c = it.color; if (c) { col[(vo + k) * 3] = c.r; col[(vo + k) * 3 + 1] = c.g; col[(vo + k) * 3 + 2] = c.b; } else if (C) { col[(vo + k) * 3] = C.getX(k); col[(vo + k) * 3 + 1] = C.getY(k); col[(vo + k) * 3 + 2] = C.getZ(k); } else col.fill(1, (vo + k) * 3, (vo + k) * 3 + 3); }
      skI[(vo + k) * 4] = it.bone; skW[(vo + k) * 4] = 1;
    }
    if (g.index) { const I = g.index.array; for (let k = 0; k < I.length; k++) idx[io + k] = I[k] + vo; io += I.length; }
    else { for (let k = 0; k < n; k++) idx[io + k] = vo + k; io += n; }
    vo += n;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(skI, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(skW, 4));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return geo;
}

/* Rigid mesh bound to a skeleton. "attached" mode with identity inverses: a vertex expressed in
   its bone's space ends up at boneWorld × vertex, wherever the mesh itself is stored. */
function rigMesh(geo, mat, skel) {
  const m = new THREE.SkinnedMesh(geo, mat);
  m.bind(skel, _RIG_ID); m.customDepthMaterial = SKIN_DEPTH_MAT;
  return m;
}

/* Weapon in hand: fixed pieces merged by material; magazine, bolt, slide and pump remain
   animated bones, the sight reticle (m.keep) remains a separate piece. */
function vmGunModel(key) {
  const m = buildGunModel(key);
  bakeRig(m.group, { keep: m.keep });
  return m;
}

/* Material of a mesh bound to a skeleton: a copy of the pieces' material. The program of a bone-animated mesh is not that of a plain
   mesh; shared between the merged fixed pieces (rigMesh) and the moving pieces left separate (magazine, bolt), a weapon-in-hand
   material switched program twice per frame, and three.js recomputed its key each time (stutters.js, October 2026). The copy
   keeps the material's patch (onBeforeCompile) and its uniforms (shared userData); one per material, kept for the session. */
const SKIN_TWINS = new Map();
function skinTwin(m) {
  let c = SKIN_TWINS.get(m); if (c) return c;
  c = m.clone(); c.onBeforeCompile = m.onBeforeCompile; c.userData = m.userData; c.customProgramCacheKey = m.customProgramCacheKey;
  SKIN_TWINS.set(m, c); return c;
}
/* Merges the fixed pieces of the root hierarchy. A piece is an ordinary, visible leaf Mesh with a
   single material, neither referenced in opts.keep nor marked userData.dyn (piece animated or modified individually:
   it stays as is). With no moving subgroup, the result is an ordinary merged mesh. */
function bakeRig(root, opts = {}) {
  const keep = new Set((opts.keep || []).filter(Boolean));
  root.updateMatrixWorld(true);
  const bones = [], boneOf = new Map(), byMat = new Map(), taken = [];
  const visit = (n) => {
    for (const c of n.children) {
      if (keep.has(c)) continue;
      const leaf = c.isMesh && !c.isSkinnedMesh && !c.isInstancedMesh && c.children.length === 0 && c.visible && !c.userData.dyn && !Array.isArray(c.material) && c.geometry.attributes.normal; // face groups (boxes, cylinders) only matter with several materials
      if (leaf) {
        if (!boneOf.has(n)) { boneOf.set(n, bones.length); bones.push(n); }
        const list = byMat.get(c.material) || []; if (!list.length) byMat.set(c.material, list);
        c.updateMatrix();
        list.push({ geo: c.geometry, matrix: c.matrix.clone(), bone: boneOf.get(n), cast: c.castShadow, recv: c.receiveShadow, order: c.renderOrder });
        taken.push(c);
      } else visit(c);
    }
  };
  visit(root);
  if (!taken.length) return [];
  for (const c of taken) c.parent.remove(c);
  const rigid = bones.length === 1 && bones[0] === root; // everything is fixed: ordinary mesh, no skeleton
  const skel = rigid ? null : rigidSkeleton(bones, root);
  const out = [];
  for (const [mat, list] of byMat) {
    const geo = rigGeometry(list, !!mat.vertexColors);
    let m;
    if (rigid) { geo.deleteAttribute('skinIndex'); geo.deleteAttribute('skinWeight'); m = new THREE.Mesh(geo, mat); }
    else { m = rigMesh(geo, skinTwin(mat), skel); m.frustumCulled = opts.cull === true; }
    m.castShadow = list.some((it) => it.cast); m.receiveShadow = list.some((it) => it.recv); m.renderOrder = list[0].order;
    if (!rigid && opts.cull !== true) geo.boundingSphere = new THREE.Sphere(new V3(), 1e4);
    root.add(m); out.push(m);
  }
  return out;
}

/* ==========================================================================
   SMOOTH MESHES: continuous surfaces deformed by several bones
   Body, arms and hands are no longer assemblies of rigid pieces but continuous surfaces (lofted
   sections, parametric surfaces), built in a rest pose. Each vertex follows up to four bones,
   with weights that blend at the joints (linear skinning). Bones remain ordinary groups,
   animated as before; their inverted rest matrix brings each vertex back into its bone's space.
   ========================================================================== */
class SkinBuilder {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.si = []; this.sw = []; this.idx = []; this.v0 = 0; this.i0 = 0; }
  get count() { return this.p.length / 3; }
  /* w: bone index, or list [[bone, weight], ...] (the four strongest, normalized); col: THREE.Color (1 by default) */
  vert(x, y, z, u, v, col, w) {
    this.p.push(x, y, z); this.n.push(0, 0, 0); this.uv.push(u, v);
    if (col) this.c.push(col.r, col.g, col.b); else this.c.push(1, 1, 1);
    if (typeof w === 'number') { this.si.push(w, 0, 0, 0); this.sw.push(1, 0, 0, 0); return this.count - 1; }
    const l = w.length > 4 ? w.slice().sort((a, b) => b[1] - a[1]).slice(0, 4) : w;
    let s = 0; for (const e of l) s += e[1];
    for (let k = 0; k < 4; k++) { const e = l[k]; this.si.push(e ? e[0] : 0); this.sw.push(e && s > 0 ? e[1] / s : k === 0 ? 1 : 0); }
    return this.count - 1;
  }
  tri(a, b, c) { this.idx.push(a, b, c); }
  /* one piece: its normals are smoothed among its own faces only, seams included (coincident vertices) */
  begin() { this.v0 = this.count; this.i0 = this.idx.length; }
  end(weld = true) {
    const P = this.p, N = this.n, I = this.idx, v0 = this.v0;
    for (let t = this.i0; t < I.length; t += 3) {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const k of [a, b, c]) { N[k] += nx; N[k + 1] += ny; N[k + 2] += nz; }
    }
    if (weld) {
      const map = new Map();
      for (let i = v0; i < this.count; i++) {
        const key = `${Math.round(P[i * 3] * 2e4)},${Math.round(P[i * 3 + 1] * 2e4)},${Math.round(P[i * 3 + 2] * 2e4)}`;
        const l = map.get(key); if (l) l.push(i); else map.set(key, [i]);
      }
      for (const l of map.values()) {
        if (l.length < 2) continue;
        let x = 0, y = 0, z = 0; for (const i of l) { x += N[i * 3]; y += N[i * 3 + 1]; z += N[i * 3 + 2]; }
        for (const i of l) { N[i * 3] = x; N[i * 3 + 1] = y; N[i * 3 + 2] = z; }
      }
    }
    for (let i = v0; i < this.count; i++) {
      const x = N[i * 3], y = N[i * 3 + 1], z = N[i * 3 + 2], l = hyp3(x, y, z) || 1;
      N[i * 3] = x / l; N[i * 3 + 1] = y / l; N[i * 3 + 2] = z / l;
    }
  }
  /* adds a three.js geometry (normals kept) transformed by m; fixed weight and color, or functions of the position */
  geo(g, m, w, col, uv) {
    this.begin();
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, v0 = this.count, nm = new THREE.Matrix3().getNormalMatrix(m), t = new V3();
    for (let k = 0; k < P.count; k++) {
      t.fromBufferAttribute(P, k).applyMatrix4(m);
      const uu = uv ? uv(U ? U.getX(k) : 0, U ? U.getY(k) : 0) : null;
      this.vert(t.x, t.y, t.z, uu ? uu[0] : 0, uu ? uu[1] : 0, typeof col === 'function' ? col(t) : col, typeof w === 'function' ? w(t) : w);
      if (N) { t.fromBufferAttribute(N, k).applyMatrix3(nm).normalize(); const o = (v0 + k) * 3; this.n[o] = t.x; this.n[o + 1] = t.y; this.n[o + 2] = t.z; }
    }
    if (g.index) for (let k = 0; k < g.index.count; k++) this.idx.push(g.index.getX(k) + v0);
    else for (let k = 0; k < P.count; k++) this.idx.push(v0 + k);
    if (!N) this.end(false);
  }
  build() {
    const g = new THREE.BufferGeometry(), n = this.count;
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(new (n > 65535 ? THREE.Uint32BufferAttribute : THREE.Uint16BufferAttribute)(this.idx, 1));
    return g;
  }
}
/* Parametric surface on a grid: f(u, v, out) fills out = { x, y, z, w, col, U, V } for u and v from 0 to 1.
   wrapU: the grid wraps around (seam coincident). The front face is chosen so the normal points away from the center
   of the piece (o.out = true or false to force it). */
const _sf = { x: 0, y: 0, z: 0, w: 0, col: null, U: 0, V: 0 };
function skinSurf(B, nu, nv, f, o = {}) {
  B.begin();
  const v0 = B.count;
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    _sf.col = null; _sf.U = i / nu; _sf.V = j / nv;
    f(i / nu, j / nv, _sf);
    B.vert(_sf.x, _sf.y, _sf.z, _sf.U, _sf.V, _sf.col, _sf.w);
  }
  const at = (i, j) => v0 + j * (nu + 1) + i, P = B.p;
  let flip = o.out === false;
  if (o.out === undefined) {
    // face orientation: the normal must point away from the center of the piece
    let cx = 0, cy = 0, cz = 0; const n = (nu + 1) * (nv + 1);
    for (let k = v0; k < v0 + n; k++) { cx += P[k * 3]; cy += P[k * 3 + 1]; cz += P[k * 3 + 2]; }
    cx /= n; cy /= n; cz /= n; let s = 0;
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = at(i, j) * 3, b = at(i + 1, j) * 3, c = at(i, j + 1) * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      s += (uy * vz - uz * vy) * (P[a] - cx) + (uz * vx - ux * vz) * (P[a + 1] - cy) + (ux * vy - uy * vx) * (P[a + 2] - cz);
    }
    flip = s < 0;
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
    if (flip) { B.tri(a, c, b); B.tri(b, c, d); } else { B.tri(a, b, c); B.tri(b, d, c); }
  }
  B.end(o.weld !== false);
  return v0;
}
/* Tube lofted along sections { c: center, X, Y: profile axes, r: radius or [x+, x-, y+, y-], n: superellipse
   exponent (2 = ellipse, higher = squarer), w: weights (array or function (p, a)), col, v: texture abscissa }.
   o.wp(p, a, s): weights by position (replaces those of the sections);
   o.bump(a, k): radius added (m) at angle a on section k; o.cap0 / o.cap1: length of a rounded end;
   o.uv(u, v): texture coordinates; o.col(a, k, p): per-vertex color; o.a0: seam angle. */
const _lp = new V3(), _la = new V3(), _lq = new V3();
function skinLoft(B, S, seg, o = {}) {
  const rings = S.slice();
  // rounded ends: extra sections that close up as a quarter ellipse
  const capRings = (end, len) => {
    const s = end ? S[S.length - 1] : S[0], p = end ? S[S.length - 2] : S[1];
    const ax = _la.subVectors(s.c, p.c).normalize().clone(), out = [];
    for (let i = 1; i <= 4; i++) {
      const t = (i / 4) * Math.PI / 2, k = i === 4 ? 0.001 : Math.cos(t);
      const r = Array.isArray(s.r) ? s.r.map((x) => x * k) : s.r * k;
      out.push(Object.assign({}, s, { c: s.c.clone().addScaledVector(ax, Math.sin(t) * len), r, v: (s.v || 0) + (end ? 1 : -1) * Math.sin(t) * len, cap: true }));
    }
    return end ? out : out.reverse();
  };
  const R = (o.cap0 ? capRings(false, o.cap0) : []).concat(rings, o.cap1 ? capRings(true, o.cap1) : []);
  const a0 = o.a0 || 0, nk = R.length;
  _la.subVectors(S[S.length - 1].c, S[0].c);
  const flip = _lq.crossVectors(S[0].X, S[0].Y).dot(_la) < 0;
  return skinSurf(B, seg, nk - 1, (u, v, out) => {
    const k = Math.round(v * (nk - 1)), s = R[k], a = a0 + u * TAU, cs = Math.cos(a), sn = Math.sin(a), e = 2 / (s.n || 2);
    const r = s.r, xp = Array.isArray(r) ? r[0] : r, xn = Array.isArray(r) ? r[1] : r, yp = Array.isArray(r) ? r[2] : r, yn = Array.isArray(r) ? r[3] : r;
    let px = Math.sign(cs) * Math.pow(Math.abs(cs), e) * (cs >= 0 ? xp : xn), py = Math.sign(sn) * Math.pow(Math.abs(sn), e) * (sn >= 0 ? yp : yn);
    const b = o.bump && !s.cap ? o.bump(a, k - (o.cap0 ? 4 : 0), s) : 0;
    if (b) { const l = hyp(px, py) || 1; px += px / l * b; py += py / l * b; }
    _lp.copy(s.c).addScaledVector(s.X, px).addScaledVector(s.Y, py);
    out.x = _lp.x; out.y = _lp.y; out.z = _lp.z;
    out.w = o.wp ? o.wp(_lp, a, s) : typeof s.w === 'function' ? s.w(_lp, a) : s.w;
    out.col = o.col ? o.col(a, k, _lp, s) : s.col || null;
    const uv = o.uv ? o.uv(u, s.v || 0, s, px, py) : null; out.U = uv ? uv[0] : u; out.V = uv ? uv[1] : s.v || 0;
  }, { out: !flip, weld: true });
}
/* Smooth mesh: vertices expressed in rest space, rest[i] = rest matrix of bone i in that same space */
function skinnedMesh(geo, mat, bones, rest) {
  const sk = new THREE.Skeleton(bones, rest.map((m) => m.clone().invert()));
  const m = new THREE.SkinnedMesh(geo, mat);
  m.bind(sk, _RIG_ID); m.customDepthMaterial = SKIN_DEPTH_MAT;
  return m;
}
/* Matrix of a bone relative to the model root (current pose) */
function restMatrix(bone, root) {
  const m = new THREE.Matrix4(); let o = bone;
  while (o && o !== root) { o.updateMatrix(); m.premultiply(o.matrix); o = o.parent; }
  return m;
}
/* Ambient occlusion baked into vertex colors: each sphere { x, y, z, r } darkens the surfaces facing
   it (form factor of a sphere), which carves out the creases between pieces (under the vest, the pockets, the helmet). */
function skinBakeAO(B, spheres, k = 1, from = 0, to = B.count) {
  const P = B.p, N = B.n, C = B.c;
  for (let i = from; i < to; i++) {
    const px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2], nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2];
    let occ = 0;
    for (const s of spheres) {
      const dx = s.x - px, dy = s.y - py, dz = s.z - pz, d2 = dx * dx + dy * dy + dz * dz, r2 = s.r * s.r;
      if (d2 < r2 * 1.03) continue;
      const d = Math.sqrt(d2), c = (dx * nx + dy * ny + dz * nz) / d;
      if (c > 0) occ += c * r2 / d2;
    }
    const f = 1 - k * Math.min(1, occ) * 0.85;
    C[i * 3] *= f; C[i * 3 + 1] *= f; C[i * 3 + 2] *= f;
  }
}
/* Weights of a bone chain along an abscissa s (straight limb at rest): around each joint j (s, h, a, m, b),
   bone a gives way to bone b over ±h, the helper bone m (oriented halfway) taking up to half the weight. */
function chainW(s, J, first) {
  for (const j of J) {
    if (s <= j.s - j.h) return [[j.a, 1]];
    if (s < j.s + j.h) {
      const t = (s - (j.s - j.h)) / (2 * j.h), wa = (1 - t) * (1 - t), wb = t * t, wm = 2 * t * (1 - t);
      return j.m === undefined || j.m === null ? [[j.a, wa + wm * 0.5], [j.b, wb + wm * 0.5]] : [[j.a, wa], [j.m, wm], [j.b, wb]];
    }
  }
  return [[J.length ? J[J.length - 1].b : first, 1]];
}
/* Sweep along a rest bone chain: chain = [{ M: rest matrix (root space), L: length }], the limb axis
   being ax and the profile lying on axes px, py (local frame of the bones). At joints, the center line follows
   a fillet (Bézier curve of half-length H[k]) and the profile rotates gradually: the rest geometry of a bent
   finger does not pinch. S: sections { d: abscissa from the origin of the first bone, r, n, col }; o.w(d): weights. */
function skinSweep(B, chain, H, ax, px, py, S, seg, o = {}) {
  const F = chain.map((c) => { const q = new THREE.Quaternion(), p = new V3(), s = new V3(); c.M.decompose(p, q, s); return { q, p, a: ax.clone().applyQuaternion(q) }; });
  const sj = []; let acc = 0; for (const c of chain) { acc += c.L; sj.push(acc); }
  const q = new THREE.Quaternion(), secs = [];
  for (const s of S) {
    const d = s.d; let k = 0;
    while (k < chain.length - 1 && d > sj[k] + H[k]) k++;
    const c = new V3();
    if (k < chain.length - 1 && d >= sj[k] - H[k]) {
      const h = H[k], t = (d - (sj[k] - h)) / (2 * h), J = F[k + 1].p;
      const p0 = J.clone().addScaledVector(F[k].a, -h), p2 = J.clone().addScaledVector(F[k + 1].a, h);
      c.copy(p0).multiplyScalar((1 - t) * (1 - t)).addScaledVector(J, 2 * t * (1 - t)).addScaledVector(p2, t * t);
      q.slerpQuaternions(F[k].q, F[k + 1].q, t);
    } else { c.copy(F[k].p).addScaledVector(F[k].a, d - (k ? sj[k - 1] : 0)); q.copy(F[k].q); }
    secs.push(Object.assign({}, s, { c, X: px.clone().applyQuaternion(q), Y: py.clone().applyQuaternion(q), w: o.w ? o.w(d) : s.w, v: d }));
  }
  return skinLoft(B, secs, seg, o);
}
