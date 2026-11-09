/* ==========================================================================
   MODELING WORKSHOP: tools common to all maps.
   - GeoBuf: indexed geometry in growing typed arrays (position, normal, uv, tint, occlusion).
   - Maker: stack of transformations and primitives (beveled box, cylinder, lathe, profile extrusion,
     sweep along a path, pierced wall, quad, three.js geometry). Each primitive writes into the
     Maker's target: the scenery (WORLD, merged by material and cut into segments for culling) or a prefab.
   - Prefab: accessory built once in local coordinates, then stamped as many times as wanted
     (M.put), with its collisions and occlusion volumes. It is the reusable building block from one map to another.
   Detail classes (cls): 0 = main (casts a shadow), 1 = fine (no shadow), 2 = minor detail (no
   shadow, hidden beyond a distance that depends on the quality profile, see updateMapDetail), 3 = ground scatter
   (pebbles, debris: one mesh per segment, hidden even earlier; shadow in the near cascades).
   Units are meters; "local" texture coordinates too (divided by uvS).
   ========================================================================== */
const _mk = new THREE.Matrix4(), _kv = new V3();
function _growF(a, n) { const b = new Float32Array(n); if (a) b.set(a); return b; }

/* Living materials (foliage that moves in the wind and when soldiers pass, see 02n-flora.js): their vertices also carry
   a flexibility weight (0: fixed, 1: free), read by the shader in the aSw attribute. Other materials do not have this channel. */
const LIVING = new Set();
class GeoBuf {
  constructor(v = 256, i = 512, sw = false) { this.nv = 0; this.ni = 0; this.vc = 0; this.ic = 0; this.sw = sw; this.S = null; this.reserve(v, i); }
  reserve(v, i) {
    if (this.nv + v > this.vc) {
      const c = Math.max(this.vc * 2, this.nv + v, 64);
      this.P = _growF(this.P, c * 3); this.N = _growF(this.N, c * 3); this.U = _growF(this.U, c * 2); this.C = _growF(this.C, c * 3); this.A = _growF(this.A, c);
      if (this.sw) this.S = _growF(this.S, c);
      this.vc = c;
    }
    if (this.ni + i > this.ic) {
      const c = Math.max(this.ic * 2, this.ni + i, 128), b = new Uint32Array(c);
      if (this.I) b.set(this.I); this.I = b; this.ic = c;
    }
  }
  vert(x, y, z, nx, ny, nz, u, v, r, g, b, a, s) {
    if (this.nv >= this.vc) this.reserve(1, 0);
    const i = this.nv, i3 = i * 3, i2 = i * 2;
    this.P[i3] = x; this.P[i3 + 1] = y; this.P[i3 + 2] = z;
    this.N[i3] = nx; this.N[i3 + 1] = ny; this.N[i3 + 2] = nz;
    this.U[i2] = u; this.U[i2 + 1] = v;
    this.C[i3] = r; this.C[i3 + 1] = g; this.C[i3 + 2] = b; this.A[i] = a;
    if (this.S) this.S[i] = s || 0;
    return this.nv++;
  }
  tri(a, b, c) {
    if (this.ni + 3 > this.ic) this.reserve(0, 3);
    this.I[this.ni++] = a; this.I[this.ni++] = b; this.I[this.ni++] = c;
  }
  /* Adds another GeoBuf as is (merging segments) */
  append(g) {
    this.reserve(g.nv, g.ni); const o = this.nv;
    this.P.set(g.P.subarray(0, g.nv * 3), o * 3); this.N.set(g.N.subarray(0, g.nv * 3), o * 3); this.U.set(g.U.subarray(0, g.nv * 2), o * 2);
    this.C.set(g.C.subarray(0, g.nv * 3), o * 3); this.A.set(g.A.subarray(0, g.nv), o);
    if (this.S && g.S) this.S.set(g.S.subarray(0, g.nv), o);
    for (let i = 0; i < g.ni; i++) this.I[this.ni + i] = g.I[i] + o;
    this.nv += g.nv; this.ni += g.ni;
  }
  geometry() {
    const g = new THREE.BufferGeometry(), n = this.nv;
    g.setAttribute('position', new THREE.BufferAttribute(this.P.slice(0, n * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.N.slice(0, n * 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(this.U.slice(0, n * 2), 2));
    g.setAttribute('color', new THREE.BufferAttribute(this.C.slice(0, n * 3), 3));
    g.setAttribute('aoc', new THREE.BufferAttribute(this.A.slice(0, n), 1));
    if (this.S) g.setAttribute('aSw', new THREE.BufferAttribute(this.S.slice(0, n), 1));
    g.setIndex(new THREE.BufferAttribute(n > 65535 ? this.I.slice(0, this.ni) : Uint16Array.from(this.I.subarray(0, this.ni)), 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

/* ---------- Maker: transformations and primitives ---------- */
class Maker {
  constructor(target) {
    this.T = target; this.m = new THREE.Matrix4(); this.n3 = new THREE.Matrix3(); this.stack = [];
    this.tint = [1, 1, 1]; this.uvMode = 0; this.uvS = 1; this.uvO = [0, 0]; this.cls = 0; this.ao = 1; this.aoFn = null; this.swFn = null;
    this.nd = true; this.flip = false;
  }
  save() { this.stack.push([this.m.clone(), this.tint, this.uvMode, this.uvS, this.cls, this.ao, this.aoFn, this.uvO, this.swFn]); return this; }
  restore() {
    const s = this.stack.pop(); this.m.copy(s[0]);
    [, this.tint, this.uvMode, this.uvS, this.cls, this.ao, this.aoFn, this.uvO, this.swFn] = s; this.nd = true; return this;
  }
  move(x, y, z) { this.m.multiply(_mk.makeTranslation(x, y, z)); this.nd = true; return this; }
  rotY(a) { if (a) { this.m.multiply(_mk.makeRotationY(a)); this.nd = true; } return this; }
  rotX(a) { if (a) { this.m.multiply(_mk.makeRotationX(a)); this.nd = true; } return this; }
  rotZ(a) { if (a) { this.m.multiply(_mk.makeRotationZ(a)); this.nd = true; } return this; }
  scl(x, y = x, z = x) { this.m.multiply(_mk.makeScale(x, y, z)); this.nd = true; return this; }
  mul(m) { this.m.multiply(m); this.nd = true; return this; }
  /* tint in sRGB (0 to 1), converted to linear */
  color(c) { this.tint = c ? [sl(c[0]), sl(c[1]), sl(c[2])] : [1, 1, 1]; return this; }
  world(s) { this.uvMode = 1; if (s) this.uvS = s; return this; } // texture coordinates taken in the world (seam between pieces)
  local(s) { this.uvMode = 0; if (s) this.uvS = s; return this; }
  _n() { if (this.nd) { this.n3.getNormalMatrix(this.m); this.flip = this.m.determinant() < 0; this.nd = false; } }
  /* Buffer of material mat for a piece whose local center is (x, y, z) */
  buf(mat, x = 0, y = 0, z = 0) {
    const e = this.m.elements;
    return this.T.buf(mat, this.cls, e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
  }
  /* Vertex in local coordinates */
  v(B, x, y, z, nx, ny, nz, u, v, ao = 1, sw = 0) {
    this._n();
    const e = this.m.elements, n = this.n3.elements;
    const wx = e[0] * x + e[4] * y + e[8] * z + e[12], wy = e[1] * x + e[5] * y + e[9] * z + e[13], wz = e[2] * x + e[6] * y + e[10] * z + e[14];
    let mx = n[0] * nx + n[3] * ny + n[6] * nz, my = n[1] * nx + n[4] * ny + n[7] * nz, mz = n[2] * nx + n[5] * ny + n[8] * nz;
    const l = hyp3(mx, my, mz) || 1; mx /= l; my /= l; mz /= l;
    if (this.uvMode === 1) {
      const ax = Math.abs(mx), ay = Math.abs(my), az = Math.abs(mz);
      if (ay >= ax && ay >= az) { u = wx; v = my > 0 ? -wz : wz; }
      else if (ax >= az) { u = mx > 0 ? -wz : wz; v = wy; }
      else { u = mz > 0 ? wx : -wx; v = wy; }
    }
    ao *= this.ao; if (this.aoFn) ao *= this.aoFn(wx, wy, wz, mx, my, mz);
    if (this.swFn && !sw) sw = this.swFn(wx, wy, wz);
    const t = this.tint;
    return B.vert(wx, wy, wz, mx, my, mz, u / this.uvS + this.uvO[0], v / this.uvS + this.uvO[1], t[0], t[1], t[2], ao, sw);
  }
  tri(B, a, b, c) { if (this.flip) B.tri(a, c, b); else B.tri(a, b, c); }
  quadI(B, a, b, c, d) { this.tri(B, a, b, c); this.tri(B, a, c, d); }
  /* Planar quad (local points [x,y,z]) oriented along n; texture coordinates projected onto the plane */
  quad(mat, p0, p1, p2, p3, n, o = {}) {
    const B = this.buf(mat, (p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2, (p0[2] + p2[2]) / 2);
    let P = [p0, p1, p2, p3], W = o.sw || null; // o.sw: flexibility weight (wind) from p0 to p3
    const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2], bx = p2[0] - p0[0], by = p2[1] - p0[1], bz = p2[2] - p0[2];
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    if (cx * n[0] + cy * n[1] + cz * n[2] < 0) { P = [p0, p3, p2, p1]; if (W) W = [W[0], W[3], W[2], W[1]]; }
    const uvs = o.uv || projUV(P, n);
    const ao = o.ao || [1, 1, 1, 1];
    const i = P.map((p, k) => this.v(B, p[0], p[1], p[2], n[0], n[1], n[2], uvs[k][0], uvs[k][1], ao[k], W ? W[k] : 0));
    this.quadI(B, i[0], i[1], i[2], i[3]);
  }
  tri3(mat, p0, p1, p2, n) {
    const B = this.buf(mat, p0[0], p0[1], p0[2]);
    let P = [p0, p1, p2];
    const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2], bx = p2[0] - p0[0], by = p2[1] - p0[1], bz = p2[2] - p0[2];
    if ((ay * bz - az * by) * n[0] + (az * bx - ax * bz) * n[1] + (ax * by - ay * bx) * n[2] < 0) P = [p0, p2, p1];
    const uvs = projUV(P, n), i = P.map((p, k) => this.v(B, p[0], p[1], p[2], n[0], n[1], n[2], uvs[k][0], uvs[k][1]));
    this.tri(B, i[0], i[1], i[2]);
  }
  /* Box: centered in x and z, from y = 0 to h. o.skip: faces omitted among 'XxYyZz' (X: +x, x: -x...);
     o.bevel: edge chamfer (m), which catches the light like a real object */
  /* Thin wood (post, beam, rail, single plank, round wood): solid wood without plank joints (MAT.timber); large faces
     (cladding, floor, tabletop) keep the planks */
  _timber(mat, thin) { return mat === 'wood' && thin ? 'timber' : mat; }
  box(mat, w, h, d, o = {}) {
    { const q = [Math.abs(w), Math.abs(h), Math.abs(d)].sort((a, b) => a - b); mat = this._timber(mat, q[1] < 0.3); }
    const hx = w / 2, hy = h / 2, hz = d / 2, b = Math.min(o.bevel || 0, hx * 0.49, hy * 0.49, hz * 0.49), skip = o.skip || '';
    const B = this.buf(mat, 0, hy, 0);
    const corner = (sx, sy, sz, ax) => [
      ax === 0 ? sx * hx : sx * (hx - b), (ax === 1 ? sy * hy : sy * (hy - b)) + hy, ax === 2 ? sz * hz : sz * (hz - b)];
    const face = (p, n, ao) => {
      let P = p;
      const ax = p[1][0] - p[0][0], ay = p[1][1] - p[0][1], az = p[1][2] - p[0][2], bx = p[2][0] - p[0][0], by = p[2][1] - p[0][1], bz = p[2][2] - p[0][2];
      if ((ay * bz - az * by) * n[0] + (az * bx - ax * bz) * n[1] + (ax * by - ay * bx) * n[2] < 0) P = p.slice().reverse();
      const uv = projUV(P, n), ids = P.map((q, k) => this.v(B, q[0], q[1], q[2], n[0], n[1], n[2], uv[k][0], uv[k][1], ao ? ao(q) : 1));
      for (let k = 1; k < ids.length - 1; k++) this.tri(B, ids[0], ids[k], ids[k + 1]);
    };
    const aoY = o.aoBottom ? (q) => lerp(o.aoBottom, 1, smoothstep(0, Math.min(0.5, h), q[1])) : null;
    const F = 'XxYyZz';
    for (let a = 0; a < 3; a++) for (const s of [1, -1]) {
      if (skip.indexOf(F[a * 2 + (s > 0 ? 0 : 1)]) >= 0) continue;
      const n = [0, 0, 0]; n[a] = s;
      const pts = [];
      for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const sg = [0, 0, 0]; sg[a] = s; sg[(a + 1) % 3] = u; sg[(a + 2) % 3] = v;
        pts.push(corner(sg[0], sg[1], sg[2], a));
      }
      face(pts, n, a === 1 ? null : aoY);
    }
    if (b <= 0) return;
    // chamfered edges
    for (let a = 0; a < 3; a++) {
      const a1 = (a + 1) % 3, a2 = (a + 2) % 3; // edge parallel to axis a2, between faces a and a1
      for (const sa of [1, -1]) for (const sb of [1, -1]) {
        if (!o.bevelAll && skip && (skip.indexOf(F[a * 2 + (sa > 0 ? 0 : 1)]) >= 0 || skip.indexOf(F[a1 * 2 + (sb > 0 ? 0 : 1)]) >= 0)) continue;
        const n = [0, 0, 0]; n[a] = sa * Math.SQRT1_2; n[a1] = sb * Math.SQRT1_2;
        const pts = [];
        for (const [sc, ax] of [[-1, a], [1, a], [1, a1], [-1, a1]]) { const sg = [0, 0, 0]; sg[a] = sa; sg[a1] = sb; sg[a2] = sc; pts.push(corner(sg[0], sg[1], sg[2], ax)); }
        face(pts, n, aoY);
      }
    }
    for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) {
      const k = 1 / Math.sqrt(3);
      face([corner(sx, sy, sz, 0), corner(sx, sy, sz, 1), corner(sx, sy, sz, 2)], [sx * k, sy * k, sz * k], aoY);
    }
  }
  /* Box by bounds (in the current frame) */
  boxB(mat, x0, x1, y0, y1, z0, z1, o) {
    this.save().move((x0 + x1) / 2, y0, (z0 + z1) / 2); this.box(mat, Math.abs(x1 - x0), y1 - y0, Math.abs(z1 - z0), o); return this.restore();
  }
  /* Vertical cylinder (or truncated cone) from y = 0 to h. o.r1: top radius; o.caps: 'bt'; o.a0, o.a1: sector */
  cyl(mat, r0, h, seg, o = {}) {
    mat = this._timber(mat, Math.max(r0, o.r1 !== undefined ? o.r1 : r0) < 0.4);
    const r1 = o.r1 !== undefined ? o.r1 : r0, a0 = o.a0 || 0, a1 = o.a1 !== undefined ? o.a1 : TAU, caps = o.caps !== undefined ? o.caps : 'bt';
    const B = this.buf(mat, 0, h / 2, 0), sl0 = (r0 - r1) / h, nl = hyp(1, sl0), rm = (r0 + r1) / 2;
    // side: false: discs only (log end stuck onto another shape)
    if (o.side !== false) {
      const ring = [];
      for (let i = 0; i <= seg; i++) {
        const a = lerp(a0, a1, i / seg), c = Math.cos(a), s = Math.sin(a), u = a * rm;
        ring.push([this.v(B, c * r0, 0, s * r0, c / nl, sl0 / nl, s / nl, u, 0, o.aoB || 1), this.v(B, c * r1, h, s * r1, c / nl, sl0 / nl, s / nl, u, h)]);
      }
      for (let i = 0; i < seg; i++) this.quadI(B, ring[i][0], ring[i][1], ring[i + 1][1], ring[i + 1][0]);
    }
    for (const [y, r, ny] of [[0, r0, -1], [h, r1, 1]]) {
      if (caps.indexOf(ny < 0 ? 'b' : 't') < 0 || r <= 0) continue;
      const c0 = this.v(B, 0, y, 0, 0, ny, 0, 0, 0), ids = [];
      for (let i = 0; i <= seg; i++) { const a = lerp(a0, a1, i / seg); ids.push(this.v(B, Math.cos(a) * r, y, Math.sin(a) * r, 0, ny, 0, Math.cos(a) * r, Math.sin(a) * r)); }
      for (let i = 0; i < seg; i++) { if (ny > 0) this.tri(B, c0, ids[i + 1], ids[i]); else this.tri(B, c0, ids[i], ids[i + 1]); }
    }
  }
  /* Surface of revolution around Y. prof: [[r, y], ...] from bottom to top; sharp edges beyond 35 degrees */
  lathe(mat, prof, seg, o = {}) {
    mat = this._timber(mat, true);
    const B = this.buf(mat, 0, (prof[0][1] + prof[prof.length - 1][1]) / 2, 0), a0 = o.a0 || 0, a1 = o.a1 !== undefined ? o.a1 : TAU;
    const rows = profileRows(prof, o.sharp !== undefined ? o.sharp : 0.6);
    const R = [];
    for (let i = 0; i <= seg; i++) {
      const a = lerp(a0, a1, i / seg), c = Math.cos(a), s = Math.sin(a);
      R.push(rows.map((p) => this.v(B, c * p.x, p.y, s * p.x, c * p.nx, p.ny, s * p.nx, a * (o.uR || 0.5), p.d, p.ao)));
    }
    for (let i = 0; i < seg; i++) for (let j = 0; j < rows.length - 1; j++) {
      if (rows[j].brk) continue;
      this.quadI(B, R[i][j], R[i][j + 1], R[i + 1][j + 1], R[i + 1][j]);
    }
  }
  /* 2D profile (x, y) extruded along z (from 0 to len). o.closed; o.caps; o.sharp: sharp-edge threshold (rad) */
  extrude(mat, shape, len, o = {}) {
    const closed = o.closed !== false, B = this.buf(mat, 0, 0, len / 2);
    let S = shape;
    if (closed && signedArea(S) < 0) S = S.slice().reverse(); // counterclockwise: normals pointing outward
    const rows = profileRows(closed ? [...S, S[0]] : S, o.sharp !== undefined ? o.sharp : 0.5, true);
    const i0 = [], i1 = [];
    for (const p of rows) {
      i0.push(this.v(B, p.x, p.y, 0, p.nx, p.ny, 0, p.d, 0, p.ao));
      i1.push(this.v(B, p.x, p.y, len, p.nx, p.ny, 0, p.d, len, p.ao));
    }
    for (let j = 0; j < rows.length - 1; j++) { if (rows[j].brk) continue; this.quadI(B, i0[j], i0[j + 1], i1[j + 1], i1[j]); }
    if (closed && o.caps !== false) {
      const tris = THREE.ShapeUtils.triangulateShape(S.map((p) => new THREE.Vector2(p[0], p[1])), []);
      for (const [z, nz] of [[0, -1], [len, 1]]) {
        const ids = S.map((p) => this.v(B, p[0], p[1], z, 0, 0, nz, p[0], p[1]));
        for (const t of tris) { if (nz > 0) this.tri(B, ids[t[0]], ids[t[1]], ids[t[2]]); else this.tri(B, ids[t[0]], ids[t[2]], ids[t[1]]); }
      }
    }
  }
  /* Sweep of a closed, smooth profile (circle...) along a path of local points [x,y,z] */
  sweep(mat, shape, path, o = {}) {
    mat = this._timber(mat, true);
    const n = path.length, P = path.map((p) => new V3(p[0], p[1], p[2])), mid = P[n >> 1];
    const B = this.buf(mat, mid.x, mid.y, mid.z);
    const T = P.map((p, i) => new V3().subVectors(P[Math.min(n - 1, i + 1)], P[Math.max(0, i - 1)]).normalize());
    const up = Math.abs(T[0].y) < 0.9 ? new V3(0, 1, 0) : new V3(1, 0, 0);
    const Nn = up.clone().addScaledVector(T[0], -up.dot(T[0])).normalize();
    const ns = shape.map((p, k) => { // profile normals (average of the two neighboring edges)
      const a = shape[(k + shape.length - 1) % shape.length], b = shape[(k + 1) % shape.length];
      const tx = b[0] - a[0], ty = b[1] - a[1], l = hyp(tx, ty) || 1; return [ty / l, -tx / l];
    });
    const flipS = signedArea(shape) < 0 ? -1 : 1;
    let dist = 0; const rings = [];
    for (let i = 0; i < n; i++) {
      if (i > 0) { // parallel transport of the frame
        const ax = new V3().crossVectors(T[i - 1], T[i]), s = ax.length();
        if (s > 1e-6) Nn.applyAxisAngle(ax.normalize(), Math.atan2(s, T[i - 1].dot(T[i])));
        dist += P[i].distanceTo(P[i - 1]);
      }
      const Bn = new V3().crossVectors(T[i], Nn).normalize(), sc = o.scale ? o.scale(i / (n - 1)) : 1;
      const ids = [];
      for (let k = 0; k <= shape.length; k++) {
        const kk = k % shape.length, sp = shape[kk], nn = ns[kk];
        const px = P[i].x + (Nn.x * sp[0] + Bn.x * sp[1]) * sc, py = P[i].y + (Nn.y * sp[0] + Bn.y * sp[1]) * sc, pz = P[i].z + (Nn.z * sp[0] + Bn.z * sp[1]) * sc;
        const nx = (Nn.x * nn[0] + Bn.x * nn[1]) * flipS, ny = (Nn.y * nn[0] + Bn.y * nn[1]) * flipS, nz = (Nn.z * nn[0] + Bn.z * nn[1]) * flipS;
        ids.push(this.v(B, px, py, pz, nx, ny, nz, k / shape.length * (o.uAround || 1), dist));
      }
      rings.push(ids);
    }
    for (let i = 0; i < n - 1; i++) for (let k = 0; k < shape.length; k++) {
      if (flipS > 0) this.quadI(B, rings[i][k], rings[i][k + 1], rings[i + 1][k + 1], rings[i + 1][k]);
      else this.quadI(B, rings[i][k], rings[i + 1][k], rings[i + 1][k + 1], rings[i][k + 1]);
    }
  }
  tube(mat, r, path, seg = 6, o) { this.sweep(mat, circleShape(r, seg), path, o); }
  /* Pierced flat wall: x from 0 to w, y from 0 to h, at z = 0, face toward +z; holes: [{ x0, x1, y0, y1 }] */
  wall(mat, w, h, holes, o = {}) {
    const B = this.buf(mat, w / 2, h / 2, 0), tr = o.trim || 0; // o.trim: wall shortened by that much at each end (rounded corner, wallRound)
    const xs = [tr, w - tr], ys = [0, h];
    for (const q of holes) { xs.push(clamp(q.x0, tr, w - tr), clamp(q.x1, tr, w - tr)); ys.push(clamp(q.y0, 0, h), clamp(q.y1, 0, h)); }
    const ux = [...new Set(xs.map((v) => Math.round(v * 1e4) / 1e4))].sort((a, b) => a - b), uy = [...new Set(ys.map((v) => Math.round(v * 1e4) / 1e4))].sort((a, b) => a - b);
    const inHole = (x, y) => holes.some((q) => x > q.x0 && x < q.x1 && y > q.y0 && y < q.y1);
    const ao = o.aoBottom ? (y) => lerp(o.aoBottom, 1, smoothstep(0, 0.8, y)) : () => 1;
    for (let j = 0; j < uy.length - 1; j++) {
      const y0 = uy[j], y1 = uy[j + 1]; if (y1 - y0 < 1e-4) continue;
      let i = 0;
      while (i < ux.length - 1) {
        if (inHole((ux[i] + ux[i + 1]) / 2, (y0 + y1) / 2) || ux[i + 1] - ux[i] < 1e-4) { i++; continue; }
        let k = i + 1;
        while (k < ux.length - 1 && !inHole((ux[k] + ux[k + 1]) / 2, (y0 + y1) / 2)) k++;
        const x0 = ux[i], x1 = ux[k];
        const a = this.v(B, x0, y0, 0, 0, 0, 1, x0, y0, ao(y0)), b = this.v(B, x1, y0, 0, 0, 0, 1, x1, y0, ao(y0));
        const c = this.v(B, x1, y1, 0, 0, 0, 1, x1, y1, ao(y1)), d = this.v(B, x0, y1, 0, 0, 0, 1, x0, y1, ao(y1));
        this.quadI(B, a, b, c, d); i = k;
      }
    }
  }
  /* Parametric surface: f(u, v) returns [x, y, z] for u, v from 0 to 1 (u wraps around if o.closeU).
     Normals by finite differences; at degenerate poles, o.pole(v) provides the normal. uv: o.uL, o.vL meters */
  surf(mat, nu, nv, f, o = {}) {
    const c = f(0.5, 0.5), B = this.buf(mat, c[0], c[1], c[2]), ids = [], e = 1e-3, nf = o.flipN ? -1 : 1;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const u = i / nu, v = j / nv, p = f(u, v);
      const ua = o.closeU ? u - e : Math.max(0, u - e), ub = o.closeU ? u + e : Math.min(1, u + e), va = Math.max(0, v - e), vb = Math.min(1, v + e);
      const pu0 = f(ua, v), pu1 = f(ub, v), pv0 = f(u, va), pv1 = f(u, vb);
      const ax = pu1[0] - pu0[0], ay = pu1[1] - pu0[1], az = pu1[2] - pu0[2], bx = pv1[0] - pv0[0], by = pv1[1] - pv0[1], bz = pv1[2] - pv0[2];
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const l = hyp3(nx, ny, nz);
      // degenerate pole: normal provided as is (not flipped by flipN)
      if (l < 1e-9) { const q = o.pole ? o.pole(v) : [0, v < 0.5 ? -1 : 1, 0]; nx = q[0] * nf; ny = q[1] * nf; nz = q[2] * nf; } else { nx /= l; ny /= l; nz /= l; }
      ids.push(this.v(B, p[0], p[1], p[2], nx * nf, ny * nf, nz * nf, u * (o.uL || 1), v * (o.vL || 1), o.ao ? o.ao(u, v, p) : 1));
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = ids[j * (nu + 1) + i], b = ids[j * (nu + 1) + i + 1], cc = ids[(j + 1) * (nu + 1) + i + 1], d = ids[(j + 1) * (nu + 1) + i];
      if (o.flipN) this.quadI(B, a, d, cc, b); else this.quadI(B, a, b, cc, d);
    }
  }
  /* Smoothing by sections along z: each section { z, w (half-width), yb (bottom), yt (top), ym (middle,
     optional), n (superellipse exponent, 2 = ellipse, large = square), x (offset) }. o.caps: close the ends */
  loft(mat, S, k = 16, o = {}) {
    const ring = (s, a) => {
      const c = Math.cos(a), sn = Math.sin(a), ex = 2 / (s.n || 4), ym = s.ym !== undefined ? s.ym : (s.yb + s.yt) / 2;
      const px = Math.sign(c) * Math.pow(Math.abs(c), ex) * s.w + (s.x || 0), py = sn >= 0 ? ym + Math.pow(sn, ex) * (s.yt - ym) : ym - Math.pow(-sn, ex) * (ym - s.yb);
      return [px, py, s.z];
    };
    const lerpS = (t) => {
      const f = t * (S.length - 1), i = Math.min(S.length - 2, Math.floor(f)), r = f - i, a = S[i], b = S[i + 1], m = o.smooth ? r * r * (3 - 2 * r) : r;
      const out = {}; for (const key of ['z', 'w', 'yb', 'yt', 'n', 'x']) out[key] = lerp(a[key] || 0, b[key] || 0, key === 'z' ? r : m);
      if (a.ym !== undefined && b.ym !== undefined) out.ym = lerp(a.ym, b.ym, m);
      return out;
    };
    const nv = (S.length - 1) * (o.sub || 1);
    // u starts at the bottom (a = -pi/2): the seam is under the object
    this.surf(mat, k, nv, (u, v) => ring(lerpS(v), -Math.PI / 2 - u * TAU), { closeU: true, uL: o.uL || 2, vL: o.vL || (S[S.length - 1].z - S[0].z), flipN: !o.flip });
    if (o.caps !== false) for (const [s, dir] of [[S[0], -1], [S[S.length - 1], 1]]) {
      const B = this.buf(mat, s.x || 0, (s.yb + s.yt) / 2, s.z), ym = s.ym !== undefined ? s.ym : (s.yb + s.yt) / 2;
      const c0 = this.v(B, s.x || 0, ym, s.z, 0, 0, dir, 0, 0), ids = [];
      for (let i = 0; i <= k; i++) { const p = ring(s, -Math.PI / 2 - (i / k) * TAU); ids.push(this.v(B, p[0], p[1], p[2], 0, 0, dir, p[0], p[1])); }
      for (let i = 0; i < k; i++) { if (dir > 0) this.tri(B, c0, ids[i + 1], ids[i]); else this.tri(B, c0, ids[i], ids[i + 1]); }
    }
  }
  /* Horizontal plane (+y face) centered, subdivided into nx x nz */
  plane(mat, w, d, nx = 1, nz = 1, fy) {
    const B = this.buf(mat, 0, 0, 0), ids = [], e = 0.05;
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const x = -w / 2 + (w * i) / nx, z = -d / 2 + (d * j) / nz, y = fy ? fy(x, z) : 0;
      let gx = 0, gz = 0; if (fy) { gx = (fy(x + e, z) - fy(x - e, z)) / (2 * e); gz = (fy(x, z + e) - fy(x, z - e)) / (2 * e); }
      const l = hyp3(gx, 1, gz);
      ids.push(this.v(B, x, y, z, -gx / l, 1 / l, -gz / l, x, -z));
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = ids[j * (nx + 1) + i], b = ids[j * (nx + 1) + i + 1], c = ids[(j + 1) * (nx + 1) + i + 1], d = ids[(j + 1) * (nx + 1) + i];
      this.quadI(B, a, d, c, b);
    }
  }
  /* Any three.js geometry (normals and uv carried over; uvs: uv scale) */
  geo(mat, g, o = {}) {
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, us = o.uvs || 1;
    const bs = g.boundingSphere || (g.computeBoundingSphere(), g.boundingSphere);
    const B = this.buf(mat, bs.center.x, bs.center.y, bs.center.z), ids = new Array(P.count);
    for (let i = 0; i < P.count; i++) ids[i] = this.v(B, P.getX(i), P.getY(i), P.getZ(i), N.getX(i), N.getY(i), N.getZ(i), U ? U.getX(i) * us : 0, U ? U.getY(i) * us : 0, o.ao ? o.ao(P.getX(i), P.getY(i), P.getZ(i)) : 1);
    if (g.index) for (let i = 0; i < g.index.count; i += 3) this.tri(B, ids[g.index.getX(i)], ids[g.index.getX(i + 1)], ids[g.index.getX(i + 2)]);
    else for (let i = 0; i < P.count; i += 3) this.tri(B, ids[i], ids[i + 1], ids[i + 2]);
  }
  /* Collision (local box, converted to a world axis-aligned box): m = impact material; ray: blocks shots only */
  /* Collision of a local box. Rotated off right angles, it is cut into cells (0.5 m at most along its long side, 24 at most;
     1 to 4 strips on the short one), each in its exact bounding box: they overflow the object by 25 cm at most. Up to 2.32, a single
     bounding box tightened by 12%: a meter of emptiness at the corners of a car parked at an angle, and visible edges that shots passed through
     in the middle of faces (owner feedback: "adjust the assets' hitboxes") */
  col(x0, x1, y0, y1, z0, z1, m = 'concrete', ray = false, occ = true) {
    const e = this.m.elements;
    if (Math.min(Math.abs(e[0]), Math.abs(e[8])) <= 0.02) { this.T.col(this._aabb(x0, x1, y0, y1, z0, z1, true), m, ray, occ); return this; }
    const lx = Math.abs(x1 - x0), lz = Math.abs(z1 - z0), alongX = lx >= lz, L = alongX ? lx : lz, S = alongX ? lz : lx;
    const n = Math.min(24, Math.max(1, Math.ceil(L / 0.5))), k = Math.min(4, Math.max(1, Math.ceil(S / 0.75)));
    for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) {
      const a0 = i / n, a1 = (i + 1) / n, b0 = j / k, b1 = (j + 1) / k;
      const b = alongX ? this._aabb(lerp(x0, x1, a0), lerp(x0, x1, a1), y0, y1, lerp(z0, z1, b0), lerp(z0, z1, b1), true)
        : this._aabb(lerp(x0, x1, b0), lerp(x0, x1, b1), y0, y1, lerp(z0, z1, a0), lerp(z0, z1, a1), true);
      this.T.col(b, m, ray, occ);
    }
    return this;
  }
  /* Collision reserved for physics props (crate walls that hold the fruit in; tag 'crate': it disappears with the crate): neither soldiers nor shots see it */
  pcol(x0, x1, y0, y1, z0, z1, tag) { this.T.pcol(this._aabb(x0, x1, y0, y1, z0, z1, true), tag); return this; }
  /* Physics prop (see 02k-dynprops.js) placed at local point (x, y, z), rotated by ry: in the scenery it is created right away,
     in a prefab it is remembered and created at each stamp. o: tint, s (scale), a (arguments of the type's factory), rx and rz
     (initial tilt), nocol (without the prefab's collision) */
  dyn(type, x, y, z, ry = 0, o = {}) {
    // massive obstacle (def.fixed, 02k-dynprops.js): placed like ordinary scenery, full collision, no physics; when preparing a prefab (this.T.dyn), it is noted and sliced at stamping
    const F = !this.T.dyn && PROPT[type], def = F && (typeof F === 'function' ? F(o.a || []) : F);
    if (def && def.fixed) { this.place(def.pf(), x, y, z, ry, { tint: o.tint, s: o.s }); this.lastDyn = null; return this; }
    this._n();
    const e = this.m.elements;
    this.lastDyn = this.T.dynAdd({ t: type, x: e[0] * x + e[4] * y + e[8] * z + e[12], y: e[1] * x + e[5] * y + e[9] * z + e[13], z: e[2] * x + e[6] * y + e[10] * z + e[14],
      ry: ry + Math.atan2(e[8], e[0]), o: { ...o, s: (o.s || 1) * hyp(e[0], e[8]) } });
    return this;
  }
  /* Volume that stops nothing but darkens the baked lighting (roofs, awnings, dense foliage) */
  occ(x0, x1, y0, y1, z0, z1, k = 1) { this.T.occ(this._aabb(x0, x1, y0, y1, z0, z1, true), k); return this; }
  /* Lamp at local point (x, y, z): its light is baked into the lighting volume (02e-light.js), stopped by walls.
     c: color [r, g, b] (linear), p: illuminance at 1 m (1 is roughly the sky in shade), r: range (m), down: share of the light
     folded downward by a lampshade (0: lantern that lights all around, 1: nothing above the bulb) */
  lamp(x, y, z, c, p = 1, r = 6, down = 0) {
    if (!this.T.lamp) return this;
    const e = this.m.elements;
    this.T.lamp({ x: e[0] * x + e[4] * y + e[8] * z + e[12], y: e[1] * x + e[5] * y + e[9] * z + e[13], z: e[2] * x + e[6] * y + e[10] * z + e[14], c, p, r, down });
    return this;
  }
  /* Simulated cloth (02me-canvases.js): a sheet of f.cu x f.rv particles, row by row, in local coordinates (f.P: [x, y, z] per
     particle; f.side: direction of the top side); brought into the world here, with the current tint, then joined with neighboring sheets of the same
     group (f.grp) at the end of construction (clothsBuild). Without a target to take it: nothing is placed. */
  fabric(f) {
    if (!this.T.fabric) return this;
    this._n();
    const e = this.m.elements, n = this.n3.elements, s = f.side || [0, 1, 0];
    const P = f.P.map(([x, y, z]) => [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]);
    const side = [n[0] * s[0] + n[3] * s[1] + n[6] * s[2], n[1] * s[0] + n[4] * s[1] + n[7] * s[2], n[2] * s[0] + n[5] * s[1] + n[8] * s[2]];
    this.T.fabric({ ...f, P, side, lin: f.lin || this.tint });
    return this;
  }
  /* Simulated stretched canvas (02me-canvases.js) in place of a surface f(u, v) -> [x, y, z] (same convention as surf: normal from the cross product of the
     derivatives in u and v, flipped by o.flipN): one particle about every 35 cm (50 on phones), pinned according to o.pin(u, v)
     (by default the whole edge: the canvas is laced to its frame), a slack that grows with the distance to the nearest pin up to o.play
     (8 cm by default). o.uL, o.vL: texture coordinates (m); o.glow: light that passes through; o.clothKind, o.grp, o.mat ('canvas'). Without a
     target that takes fabrics: the rigid surface from before. */
  canvasCloth(nu, nv, f, o = {}) {
    if (!this.T.fabric) return this.surf(o.mat || 'canvas', nu, nv, f, o);
    const sp = (COARSE ? 0.5 : 0.35) * (o.coarse || 1), len = (a) => { let l = 0, q = a(0); for (let k = 1; k <= 8; k++) { const r = a(k / 8); l += hyp3(r[0] - q[0], r[1] - q[1], r[2] - q[2]); q = r; } return l; };
    const Lu = Math.max(len((t) => f(t, 0)), len((t) => f(t, 0.5)), len((t) => f(t, 1))), Lv = Math.max(len((t) => f(0, t)), len((t) => f(0.5, t)), len((t) => f(1, t)));
    const cu = clamp(Math.round(Lu / sp) + 1, 3, 40), rv = clamp(Math.round(Lv / sp) + 1, 3, 40), n = cu * rv;
    const P = [], pin = [], uv = [], pf = o.pin || ((u, v) => u <= 0 || u >= 1 || v <= 0 || v >= 1);
    for (let j = 0; j < rv; j++) for (let i = 0; i < cu; i++) { const u = i / (cu - 1), v = j / (rv - 1); P.push(f(u, v)); pin.push(pf(u, v) ? 1 : 0); uv.push([u * (o.uL || 1), v * (o.vL || 1)]); }
    // slack: distance (along the grid) to the nearest pin, propagated in passes
    const dist = new Float32Array(n).fill(1e9), play = o.play !== undefined ? o.play : 0.08;
    for (let k = 0; k < n; k++) if (pin[k]) dist[k] = 0;
    for (let pass = 0; pass < cu + rv; pass++) {
      let ch = false;
      for (let k = 0; k < n; k++) {
        const i = k % cu, j = (k / cu) | 0;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= cu || b >= rv) continue;
          const q = b * cu + a, d = dist[q] + hyp3(P[k][0] - P[q][0], P[k][1] - P[q][1], P[k][2] - P[q][2]);
          if (d < dist[k] - 1e-6) { dist[k] = d; ch = true; }
        }
      }
      if (!ch) break;
    }
    const maxD = []; for (let k = 0; k < n; k++) maxD.push(Math.min(play, 0.012 + dist[k] * 0.09));
    // top: on the side of the surface normal (at the center)
    const e = 1e-3, a0 = f(0.5 - e, 0.5), a1 = f(0.5 + e, 0.5), b0 = f(0.5, 0.5 - e), b1 = f(0.5, 0.5 + e), nf = o.flipN ? -1 : 1;
    const ax = a1[0] - a0[0], ay = a1[1] - a0[1], az = a1[2] - a0[2], bx = b1[0] - b0[0], by = b1[1] - b0[1], bz = b1[2] - b0[2];
    const side = o.side || [(ay * bz - az * by) * nf, (az * bx - ax * bz) * nf, (ax * by - ay * bx) * nf];
    return this.fabric({ cu, rv, P, pin, maxD, uv, glow: o.glow !== undefined ? o.glow : 0.2, side, clothKind: o.clothKind || 'taut', grp: o.grp, mat: o.mat || 'canvas' });
  }
  _aabb(x0, x1, y0, y1, z0, z1, exact) {
    const e = this.m.elements, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2, hx = Math.abs(x1 - x0) / 2, hy = (y1 - y0) / 2, hz = Math.abs(z1 - z0) / 2;
    const wx = e[0] * cx + e[4] * cy + e[8] * cz + e[12], wy = e[1] * cx + e[5] * cy + e[9] * cz + e[13], wz = e[2] * cx + e[6] * cy + e[10] * cz + e[14];
    const ex = Math.abs(e[0]) * hx + Math.abs(e[4]) * hy + Math.abs(e[8]) * hz, ey = Math.abs(e[1]) * hx + Math.abs(e[5]) * hy + Math.abs(e[9]) * hz, ez = Math.abs(e[2]) * hx + Math.abs(e[6]) * hy + Math.abs(e[10]) * hz;
    // box rotated off right angles, outside collisions (exact false: a prefab's ground shadow patch, for example): tightened bounding box
    const skew = Math.min(Math.abs(e[0]), Math.abs(e[8])) > 0.02 ? 0.88 : 1, k = exact ? 1 : skew;
    return { x0: wx - ex * k, x1: wx + ex * k, y0: wy - ey, y1: wy + ey, z0: wz - ez * k, z1: wz + ez * k };
  }
  /* Stamps a prefab at the current transformation. o.tint: [r,g,b] sRGB for the whole prefab, or
     { material: [r,g,b] }; o.cls: forces the detail class; o.nocol: without collisions */
  put(pf, o = {}) {
    this._n();
    const e = this.m.elements, n = this.n3.elements, flip = this.flip;
    for (const part of pf.parts.values()) {
      const g = part.g; if (!g.nv) continue;
      let tn = null;
      if (o.tint) { const t = Array.isArray(o.tint) ? (pf.tintable ? (pf.tintable.includes(part.mat) ? o.tint : null) : o.tint) : o.tint[part.mat]; if (t) tn = [sl(t[0]), sl(t[1]), sl(t[2])]; }
      const B = this.T.buf(part.mat, o.cls !== undefined ? Math.max(o.cls, part.cls) : part.cls, e[12], e[13], e[14]);
      B.reserve(g.nv, g.ni); const base = B.nv, gP = g.P, gN = g.N, gU = g.U, gC = g.C, gA = g.A, gS = g.S;
      for (let i = 0; i < g.nv; i++) {
        const i3 = i * 3, x = gP[i3], y = gP[i3 + 1], z = gP[i3 + 2], nx = gN[i3], ny = gN[i3 + 1], nz = gN[i3 + 2];
        const wx = e[0] * x + e[4] * y + e[8] * z + e[12], wy = e[1] * x + e[5] * y + e[9] * z + e[13], wz = e[2] * x + e[6] * y + e[10] * z + e[14];
        let mx = n[0] * nx + n[3] * ny + n[6] * nz, my = n[1] * nx + n[4] * ny + n[7] * nz, mz = n[2] * nx + n[5] * ny + n[8] * nz;
        const l = hyp3(mx, my, mz) || 1;
        let a = gA[i]; if (this.aoFn) a *= this.aoFn(wx, wy, wz, mx / l, my / l, mz / l);
        B.vert(wx, wy, wz, mx / l, my / l, mz / l, gU[i * 2], gU[i * 2 + 1],
          tn ? gC[i3] * tn[0] : gC[i3], tn ? gC[i3 + 1] * tn[1] : gC[i3 + 1], tn ? gC[i3 + 2] * tn[2] : gC[i3 + 2], a, gS ? gS[i] : 0);
      }
      for (let i = 0; i < g.ni; i += 3) { if (flip) B.tri(base + g.I[i], base + g.I[i + 2], base + g.I[i + 1]); else B.tri(base + g.I[i], base + g.I[i + 1], base + g.I[i + 2]); }
    }
    if (!o.nocol) for (const c of pf.cols) this.col(c.x0, c.x1, c.y0, c.y1, c.z0, c.z1, c.m, c.ray, c.occ);
    for (const c of pf.occs) this.T.occ(this._aabb(c.x0, c.x1, c.y0, c.y1, c.z0, c.z1, true), c.k);
    for (const c of pf.pcols) this.pcol(c.x0, c.x1, c.y0, c.y1, c.z0, c.z1, c.tag);
    for (const l of pf.lamps) this.lamp(l.x, l.y, l.z, l.c, l.p, l.r, l.down);
    for (const f of pf.fabrics) { // the stamp's tint applies to cloths as well as to their sheet's material (tinted truck tarp)
      const k = f.mat || 'canvas', t = o.tint ? (Array.isArray(o.tint) ? (pf.tintable ? (pf.tintable.includes(k) ? o.tint : null) : o.tint) : o.tint[k]) : null;
      this.fabric(t ? { ...f, lin: f.lin.map((c, i) => c * sl(t[i])) } : f);
    }
    for (const d of pf.dyn) {
      // a prefab's props take the stamp's tint when they have none of their own (fruit in a crate)
      const oo = { ...d.o }; if (d.tintFrom && !oo.tint && Array.isArray(o.tint)) oo.tint = o.tint;
      this.dyn(d.t, d.x, d.y, d.z, d.ry, oo);
    }
    return this;
  }
  /* Shortcut: prefab placed at (x, y, z), rotated by ry around the vertical */
  place(pf, x, y, z, ry = 0, o) { this.save().move(x, y, z).rotY(ry); if (o && o.s) this.scl(o.s); this.put(pf, o); return this.restore(); }
}

/* Texture coordinates of a planar polygon, projected onto its two axes (meters) */
function projUV(P, n) {
  const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
  if (ay >= ax && ay >= az) return P.map((p) => [p[0], n[1] > 0 ? -p[2] : p[2]]);
  if (ax >= az) return P.map((p) => [n[0] > 0 ? -p[2] : p[2], p[1]]);
  return P.map((p) => [n[2] > 0 ? p[0] : -p[0], p[1]]);
}
function signedArea(S) { let a = 0; for (let i = 0; i < S.length; i++) { const p = S[i], q = S[(i + 1) % S.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
/* Rows of a profile: smoothed normals, except at sharp angles where the point is duplicated.
   ext: extrusion profile (normal (dy, -dx)); otherwise lathe profile (r, y), normal (dy, -dr) pointing outward */
function profileRows(prof, sharp, ext) {
  const segN = [];
  for (let i = 0; i < prof.length - 1; i++) {
    const dx = prof[i + 1][0] - prof[i][0], dy = prof[i + 1][1] - prof[i][1], l = hyp(dx, dy) || 1;
    segN.push(ext ? [dy / l, -dx / l] : [dy / l, -dx / l]);
  }
  const rows = []; let d = 0;
  for (let i = 0; i < prof.length; i++) {
    if (i > 0) d += hyp(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]);
    const a = segN[i - 1], b = segN[i], ao = prof[i][2] !== undefined ? prof[i][2] : 1;
    if (a && b && a[0] * b[0] + a[1] * b[1] < Math.cos(sharp)) {
      rows.push({ x: prof[i][0], y: prof[i][1], nx: a[0], ny: a[1], d, ao, brk: true });
      rows.push({ x: prof[i][0], y: prof[i][1], nx: b[0], ny: b[1], d, ao });
    } else {
      let nx = (a ? a[0] : 0) + (b ? b[0] : 0), ny = (a ? a[1] : 0) + (b ? b[1] : 0); const l = hyp(nx, ny) || 1;
      rows.push({ x: prof[i][0], y: prof[i][1], nx: nx / l, ny: ny / l, d, ao });
    }
  }
  return rows;
}
function circleShape(r, n) { const s = []; for (let i = 0; i < n; i++) { const a = (i / n) * TAU; s.push([Math.cos(a) * r, Math.sin(a) * r]); } return s; }
function rectShape(w, h, cx = 0, cy = 0) { return [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]]; }
/* Rounded-corner rectangle */
function roundRectShape(w, h, r, n = 3, cx = 0, cy = 0) {
  const s = [], hw = w / 2, hh = h / 2; r = Math.min(r, hw, hh);
  for (const [qx, qy, a0] of [[1, -1, -Math.PI / 2], [1, 1, 0], [-1, 1, Math.PI / 2], [-1, -1, Math.PI]]) {
    for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * (Math.PI / 2); s.push([cx + qx * (hw - r) + Math.cos(a) * r, cy + qy * (hh - r) + Math.sin(a) * r]); }
  }
  return s;
}
/* Arc of points [x, y, z] (catenary curve for cables) */
function sagPath(a, b, sag, n = 12) {
  const p = [];
  for (let i = 0; i <= n; i++) { const t = i / n; p.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t) - Math.sin(t * Math.PI) * sag, lerp(a[2], b[2], t)]); }
  return p;
}

/* ---------- Prefabs ---------- */
class Prefab {
  constructor(name) { this.name = name; this.parts = new Map(); this.cols = []; this.occs = []; this.pcols = []; this.dyn = []; this.lamps = []; this.fabrics = []; this.tintable = null; }
  buf(mat, cls) { const k = mat + '|' + cls; let p = this.parts.get(k); if (!p) this.parts.set(k, p = { mat, cls, g: new GeoBuf(256, 512, LIVING.has(mat)) }); return p.g; }
  col(b, m, ray, occ) { this.cols.push({ ...b, m, ray, occ }); }
  occ(b, k) { this.occs.push({ ...b, k }); }
  pcol(b, tag) { this.pcols.push({ ...b, tag }); }
  dynAdd(d) { this.dyn.push({ t: d.t, x: d.x, y: d.y, z: d.z, ry: d.ry, o: d.o, tintFrom: !!d.o.tintFrom }); return null; }
  lamp(l) { this.lamps.push(l); }
  fabric(f) { this.fabrics.push(f); } // cloth in prefab coordinates: picked up again at each stamp (Maker.put)
  tris() { let t = 0; for (const p of this.parts.values()) t += p.g.ni / 3; return t; }
}
const PREFABS = new Map();
/* Prefab cached by name: build(M) builds it only once in local coordinates */
function prefab(name, build) {
  let p = PREFABS.get(name); if (p) return p;
  p = new Prefab(name); const M = new Maker(p); build(M, p); PREFABS.set(name, p); return p;
}

/* ---------- Scenery: buffers merged by material, detail class and segment ---------- */
/* 32 m segments in the play area; everything far away (background) shares a single segment */
const CHUNK = 32, CHUNK_NEAR = { x: 50, z: 66 };
/* Materials of small objects: their shadow is computed only in the near cascades (see LAYER_NEAR) */
const NEAR_SHADOW = new Set(['crate', 'plastic', 'steel', 'rubber', 'burlap', 'paintwood', 'rollshutter', 'cardboard', 'charred', 'shutter', 'dark']);
/* Ground scatter materials that cast a shadow (grasses cast none) */
const SCATTER_SHADOW = new Set(['rubble']);
const WORLD = {
  bufs: new Map(), force: null, meshes: [], fine: [], scatter: [],
  buf(mat, cls, x, y, z) {
    void y;
    const cs = cls === 3 ? CHUNK / 2 : CHUNK; // scatter: smaller segments, hidden more finely
    const ck = this.force || (Math.abs(x) > CHUNK_NEAR.x || Math.abs(z) > CHUNK_NEAR.z ? 'far' : Math.floor(x / cs) + ',' + Math.floor(z / cs));
    const k = mat + '|' + cls + '|' + ck;
    let b = this.bufs.get(k); if (!b) this.bufs.set(k, b = { mat, cls, ck, g: new GeoBuf(1024, 2048, LIVING.has(mat)) });
    return b.g;
  },
  col(b, m, ray, occ) { COL.push({ x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1, z0: b.z0, z1: b.z1, m, ray: !!ray }); if (occ !== false && !ray) OCC.push({ ...b, k: 1 }); },
  occ(b, k) { OCC.push({ ...b, k }); },
  pcol(b, tag) { propBlock(b, tag); },
  dynAdd(d) { return propSpawn(d.t, d.x, d.y, d.z, d.ry, d.o); },
  lamp(l) { LAMPS.push(l); },
  fabric(f) { FABRICS.push(f); },
};
/* Occlusion volumes for baked lighting (see 02e-light.js) */
const OCC = [];
/* Scenery lamps (Maker.lamp): their light is baked into the lighting volume */
const LAMPS = [];
const DECOR = new Maker(WORLD);

/* Creates the scenery meshes, by material and detail class. A lightly loaded material becomes a single mesh;
   otherwise each segment heavy enough keeps its mesh (culled out of view by the camera and shadows) and the small
   segments are merged. Goal: few draw calls without giving up culling. */
function finalizeWorld() {
  const groups = new Map();
  for (const b of WORLD.bufs.values()) {
    if (!b.g.ni) continue;
    const k = b.mat + '|' + b.cls; let g = groups.get(k); if (!g) groups.set(k, g = []); g.push(b);
  }
  let tris = 0;
  const merge = (list, ck) => { const g = new GeoBuf(1, 1, LIVING.has(list[0].mat)); for (const b of list) g.append(b.g); return { mat: list[0].mat, cls: list[0].cls, ck, g }; };
  for (const list of groups.values()) {
    const total = list.reduce((s, b) => s + b.g.ni / 3, 0); tris += total;
    let out;
    if (list[0].cls === 3) out = list; // scatter: each segment keeps its mesh, hidden at a distance
    else if (total < 16000 || list.length === 1) out = [merge(list, '*')];
    else {
      const big = list.filter((b) => b.g.ni / 3 >= 4000 && b.ck !== 'far'), small = list.filter((b) => !big.includes(b));
      out = big.concat(small.length ? [merge(small, '+')] : []);
    }
    for (const b of out) {
      const mat = MAT[b.mat]; if (!mat) { console.warn('unknown material', b.mat); continue; }
      const mesh = new THREE.Mesh(b.g.geometry(), mat);
      mesh.name = 'map:' + b.mat + ':' + b.cls + ':' + b.ck;
      mesh.castShadow = (b.cls === 0 && !mat.userData.noShadow) || (b.cls === 3 && SCATTER_SHADOW.has(b.mat)); mesh.receiveShadow = !mat.userData.noReceive;
      mesh.matrixAutoUpdate = false;
      if (mat.userData.noAO) mesh.userData.noAO = true;
      if ((b.cls === 0 && NEAR_SHADOW.has(b.mat)) || b.cls === 3) mesh.layers.set(LAYER_NEAR);
      // depth pre-pass reserved for large surfaces: small objects cost more there than they save
      // a living material moves in its shader: its depth written by the pre-pass, without the movement, would leave ghosts
      if (b.cls > 0 || NEAR_SHADOW.has(b.mat) || LIVING.has(b.mat)) mesh.userData.noPrepass = true;
      if (b.cls === 2) WORLD.fine.push(mesh);
      if (b.cls === 3) WORLD.scatter.push(mesh);
      // once the geometry is sent to the GPU, its copy in RAM is no longer needed (collisions and culling have their own)
      for (const a of [...Object.values(mesh.geometry.attributes), mesh.geometry.index]) a.onUpload(freeArray);
      mapAdd(mesh); WORLD.meshes.push(mesh);
    }
  }
  WORLD.bufs.clear();
  WORLD.tris = tris;
  return tris;
}
function freeArray() { this.array = null; }
/* Fine details hidden at a distance (distance depends on the quality profile) */
function updateMapDetail() {
  const p = camera.position;
  for (const [list, d] of [[WORLD.fine, RQ.q.detail || 60], [WORLD.scatter, RQ.q.scatter || 30]]) {
    for (const m of list) { const s = m.geometry.boundingSphere; m.visible = p.distanceTo(s.center) - s.radius < d; }
  }
}

/* ---------- Reproducible randomness (all peers of a lobby build the same map) ---------- */
function rngOf(seed) {
  const r = mulberry32(seed);
  r.pick = (a) => a[Math.floor(r() * a.length)];
  r.range = (a, b) => a + r() * (b - a);
  r.jit = (v, k) => v + (r() - 0.5) * 2 * k;
  r.chance = (p) => r() < p;
  return r;
}
/* Contact occlusion near a ground at y0: dark at the foot, neutral above h */
function aoGround(y0 = 0, k = 0.55, h = 0.6) { return (x, y) => lerp(k, 1, smoothstep(y0, y0 + h, y)); }
