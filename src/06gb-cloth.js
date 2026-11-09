/* ==========================================================================
   SIMULATED CLOTH: CPU cloth engine, and the outfits that use it (Breacher poncho, capes, panels and
   strips of the challenge outfits: 06gc-outfits-challenge.js)
   (owner feedback: "real physics on the fabric, the cape reacting to the world and to movement, to the wind")

   The engine (ClothSim) is generic: grids of particles (the panels) integrated with Verlet, held by distance
   constraints (structure, shear, bend) solved several times per step (position-based dynamics). Each particle has a
   target: its rest place on the body, deformed by the skeleton like the rest of the outfit (skinning computed here, on the
   CPU).
   - pinned (weight 1): the particle is its target (the attachment at the collar, shoulders, belt);
   - max distance: a free particle never strays from its target by more than maxD (small near the attachment, large
     at the bottom of the panel): the cloth can neither run away nor stay snagged elsewhere, and does not pass through the body on impact;
   - forces: gravity, map wind (with gusts and eddies, cut under a roof based on the baked lighting), air drag
     on the fabric according to its normal: when running, the panel lifts up behind;
   - collisions: body capsules (torso, head, shoulders, arms, forearms, thighs, legs) derived from the bones, and the ground; arms
     have an outer side (the cloth rests on top, it is never crossed), also applied to the targets. A fitted garment (T.slim,
     the vest of the Yellow Vest) has a thin torso in two capsules, thinner hips, no shoulders or arms, and never goes below the tangent
     plane of its target by more than T.noIn (it does not sink into the body).
   The character's inertia comes by itself: the attachments follow the body, the rest trails. In ragdoll, the attachments follow the
   falling body and the cloth spreads out.

   A cloth model (clothBuild) assembles panels: around the body between two rings (clothRing: cape, poncho, jacket panels,
   leaf cape) or as a strip (clothStrip: ribbons). Each column of a panel can be shorter than its neighbor (ragged or
   pointed hem: the grid stays regular, only its rest positions change). Satellite vertices
   (clothSatBuild) follow a particle in its frame (tangent, normal): leaves of a foliage cape, sewn-on emblem.

   Rendering: one more skinned mesh, bound to the soldier's skeleton with a single bone (the pelvis) and the same material as the outfit: the
   same program as the body (no shader, no extra texture unit). The positions computed in world space are brought
   back into the pelvis rest frame (inverse of its bone matrix) before being sent. Two sheets (top and bottom, the latter
   darker) so the back face is never seen through transparency.

   Cost and levels of detail: only nearby soldiers with the detailed model are simulated, at most CLOTH_MAX at a time (3 on
   phone), nearest first; a detailed soldier over budget wears its cloth in the rest pose (skinning only, no
   simulation). The lightweight model (at distance, and the cast shadow) wears the cloth frozen in its rest pose (clothStaticInto; the
   Breacher poncho, its earlier rigid version). Fixed step of 1/60 s, at most two per frame. The outfit preview (09u-outfits.js) lets
   the cloth settle to rest before each render.
   ========================================================================== */
const CLOTH_H = 1 / 60;
const CLOTH_MAX = COARSE || ULTRA ? 3 : 8;
/* Per-map breeze for the cloths: direction (x, z) and mean speed (m/s); otherwise CLOTH_BREEZE_DEF */
const CLOTH_BREEZE = { chergui: [0.8, 0.5, 2.6], saintgivre: [-0.6, 0.8, 3.0], portmael: [1, 0.2, 3.4], floralia: [0.6, 0.6, 1.4], notos: [0.3, -1, 3.8], scoria: [0.55, -0.85, 3.0], cirrus: [1, 0.35, 4.6], sirocco: [0.9, 0.3, 3.4], belhorizon: [0.7, 0.7, 2.2] };
const CLOTH_BREEZE_DEF = [0.8, 0.4, 2.2];
const CLOTH = { t: 0, wind: new V3(), gust: 1, damp: 0.978 }; // damp: velocity kept at each step (0.992 before: the capes, finally visible in the outfit preview, were still flapping a second after a U-turn)

/* ---------- Engine ---------- */
class ClothSim {
  /* T: shared model (rest positions, bone weights, constraints, pins, max distances, panels) */
  constructor(T) {
    const n = T.n;
    this.T = T; this.n = n;
    this.p = new Float32Array(n * 3); this.q = new Float32Array(n * 3); this.tgt = new Float32Array(n * 3); this.nor = new Float32Array(n * 3); this.tan = new Float32Array(n * 3);
    this.acc = 0; this.live = false; this.fresh = true; this.limp = false;
    this.cap = []; for (let i = 0; i < 16; i++) this.cap.push({ a: new V3(), b: new V3(), r: 0, o: null, ov: new V3() });
    this.nc = 0; this.ground = -1e9;
  }
  /* Targets: rest positions deformed by the skeleton (mats: bone matrices, current bone x inverse of rest) */
  skin(mats) {
    const T = this.T, R = T.rest, W = T.w, I = T.wi, o = this.tgt;
    for (let i = 0; i < this.n; i++) {
      const x = R[i * 3], y = R[i * 3 + 1], z = R[i * 3 + 2];
      let ox = 0, oy = 0, oz = 0;
      for (let k = 0; k < 4; k++) {
        const w = W[i * 4 + k]; if (w <= 0) continue;
        const e = mats[I[i * 4 + k]].elements;
        ox += w * (e[0] * x + e[4] * y + e[8] * z + e[12]); oy += w * (e[1] * x + e[5] * y + e[9] * z + e[13]); oz += w * (e[2] * x + e[6] * y + e[10] * z + e[14]);
      }
      o[i * 3] = ox; o[i * 3 + 1] = oy; o[i * 3 + 2] = oz;
    }
  }
  /* Restart from the rest pose (spawn, teleport, simulation resume) */
  reset() { this.p.set(this.tgt); this.q.set(this.tgt); this.fresh = false; }
  /* One step of h seconds; wind: wind (m/s, world); it: number of passes over the constraints */
  step(h, wind, it) {
    const T = this.T, n = this.n, p = this.p, q = this.q, t = this.tgt, pin = T.pin, N = this.nor, h2 = h * h, kd = T.drag;
    // teleport (respawn, ragdoll starting far away): restart from the rest pose
    const d0 = (p[0] - t[0]) ** 2 + (p[1] - t[1]) ** 2 + (p[2] - t[2]) ** 2;
    if (!(d0 <= 0.36)) { this.reset(); return; } // (also an invalid value: restart cleanly)
    const tt = CLOTH.t, kv = CLOTH.damp, gy = T.g !== undefined ? T.g : 9.8, home = (T.home || 0) * (this.limp ? 0.1 : 1); // T.g, T.home: stretched cloths of the scenery (02me-canvases.js), tail of a one-piece outfit (released on a ragdolling body: limp)
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      if (pin[i] >= 1) { q[j] = p[j]; q[j + 1] = p[j + 1]; q[j + 2] = p[j + 2]; p[j] = t[j]; p[j + 1] = t[j + 1]; p[j + 2] = t[j + 2]; continue; }
      const vx = (p[j] - q[j]) * kv, vy = (p[j + 1] - q[j + 1]) * kv, vz = (p[j + 2] - q[j + 2]) * kv;
      // air: relative wind (eddies specific to each particle) pushing the cloth along its normal, plus a slight drag
      const tb = Math.sin(tt * 3.1 + p[j] * 2.3 + p[j + 2] * 1.7) * 0.35 + Math.sin(tt * 5.3 + p[j + 1] * 3.1) * 0.2;
      const rx = wind.x * (1 + tb) - vx / h, ry = wind.y - vy / h, rz = wind.z * (1 + tb) - vz / h;
      const nx = N[j], ny = N[j + 1], nz = N[j + 2];
      let d = (rx * nx + ry * ny + rz * nz) * kd;
      // flag (T.flap): a fabric lying in the wind's bed takes almost nothing along its normal; the vortex shed from the flagpole makes it
      // snap, a wave running in the wind direction
      if (T.flap) { const wl = Math.sqrt(wind.x * wind.x + wind.z * wind.z) || 1e-6; d += T.flap * wl * Math.sin(tt * 9 - (p[j] * wind.x + p[j + 2] * wind.z) / wl * 3.2); }
      const ax = d * nx + rx * 0.04, ay = d * ny + ry * 0.04 - gy, az = d * nz + rz * 0.04;
      q[j] = p[j]; q[j + 1] = p[j + 1]; q[j + 2] = p[j + 2];
      p[j] += vx + ax * h2; p[j + 1] += vy + ay * h2; p[j + 2] += vz + az * h2;
      // pull toward the target: a stretched cloth returns to its shape, its tension carries part of its weight
      if (home) { p[j] += (t[j] - p[j]) * home; p[j + 1] += (t[j + 1] - p[j + 1]) * home; p[j + 2] += (t[j + 2] - p[j + 2]) * home; }
    }
    const C = T.con, L = T.len, S = T.stf, m = C.length >> 1;
    for (let k = 0; k < it; k++) {
      for (let c = 0; c < m; c++) {
        const a = C[c * 2], b = C[c * 2 + 1], wa = 1 - pin[a], wb = 1 - pin[b], ws = wa + wb; if (ws <= 0) continue;
        const ja = a * 3, jb = b * 3, dx = p[jb] - p[ja], dy = p[jb + 1] - p[ja + 1], dz = p[jb + 2] - p[ja + 2], l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        // the cloth resists stretching, much less compression: it crumples into folds instead of keeping its shape
        const f = (l - L[c]) / l * S[c] * (l < L[c] ? (S[c] >= 1 ? 0.5 : 0.2) : 1) / ws;
        p[ja] += dx * f * wa; p[ja + 1] += dy * f * wa; p[ja + 2] += dz * f * wa;
        p[jb] -= dx * f * wb; p[jb + 1] -= dy * f * wb; p[jb + 2] -= dz * f * wb;
      }
      this.collide();
    }
    // max distance to the target (the cloth stays on the body no matter what)
    const M = T.maxD;
    for (let i = 0; i < n; i++) {
      if (pin[i] >= 1) continue;
      const j = i * 3, dx = p[j] - t[j], dy = p[j + 1] - t[j + 1], dz = p[j + 2] - t[j + 2], l2 = dx * dx + dy * dy + dz * dz;
      if (l2 > M[i] * M[i]) { const k = M[i] / Math.sqrt(l2); p[j] = t[j] + dx * k; p[j + 1] = t[j + 1] + dy * k; p[j + 2] = t[j + 2] + dz * k; }
    }
    this.collide(); // last: the body wins over the max distance (nothing sticks out through the cloth)
    // fitted garment (T.noIn, the vest of the Yellow Vest): never more than noIn below the tangent plane of its target, which follows the body away from the
    // garment (target 14 mm off the jacket): the cloth does not sink into the torso, whatever the pose; at the very end
    if (T.noIn !== undefined) {
      const TN = this.tn || (this.tn = new Float32Array(n * 3)), lim = -T.noIn; clothNormals(T, t, TN);
      for (let i = 0; i < n; i++) {
        if (pin[i] >= 1) continue;
        const j = i * 3, d = (p[j] - t[j]) * TN[j] + (p[j + 1] - t[j + 1]) * TN[j + 1] + (p[j + 2] - t[j + 2]) * TN[j + 2];
        if (d < lim) { const k = lim - d; p[j] += TN[j] * k; p[j + 1] += TN[j + 1] * k; p[j + 2] += TN[j + 2] * k; }
      }
    }
  }
  /* Body capsules and ground: the particle is pushed back to the surface (margin: the thickness of the cloth). A capsule with an outer
     side (C.o, the arms) only lets the cloth stay on that side: a particle that entered on the torso side comes out over the arm,
     so the poncho rests on the arms instead of being crossed. P: positions (by default those of the simulation); arms: arms only
     (the targets). With arms, the pinned targets also come out of the arms (T.pinOut), flush with the sleeve: the top of a cape resting on
     the shoulder lifts with the raised arm instead of being crossed by the deltoid (except the Breacher poncho, sewn to its rigid collar) */
  collide(P, arms) {
    const p = P || this.p, pin = this.T.pin, n = this.n, cap = this.cap, nc = this.nc, g = this.ground, po = !!(arms && this.T.pinOut), pad = this.T.pad || 0; // T.pad: radius of a dressed tube (the tail of a one-piece outfit, 06gd-outfit-unique.js)
    for (let i = 0; i < n; i++) {
      const pd = pin[i] >= 1; if (pd && !po) continue;
      const j = i * 3;
      for (let c = 0; c < nc; c++) {
        const C = cap[c], O = C.o; if (arms && !O) continue;
        const ax = C.a.x, ay = C.a.y, az = C.a.z, bx = C.b.x - ax, by = C.b.y - ay, bz = C.b.z - az;
        const px = p[j] - ax, py = p[j + 1] - ay, pz = p[j + 2] - az, bb = bx * bx + by * by + bz * bz;
        const s = bb > 0 ? Math.min(1, Math.max(0, (px * bx + py * by + pz * bz) / bb)) : 0;
        let dx = px - bx * s, dy = py - by * s, dz = pz - bz * s; const d2 = dx * dx + dy * dy + dz * dz, r = C.r + (pd ? -0.011 : 0.012 + pad);
        if (d2 >= r * r) continue;
        if (O) {
          const e = dx * O.x + dy * O.y + dz * O.z;
          if (e < 0) { dx -= 2 * e * O.x; dy -= 2 * e * O.y; dz -= 2 * e * O.z; } // torso side: sent back to the other side of the arm
          if (dx * dx + dy * dy + dz * dz < 1e-8) { dx = O.x; dy = O.y; dz = O.z; }
        } else if (d2 <= 1e-10) continue;
        const k = r / Math.sqrt(dx * dx + dy * dy + dz * dz);
        p[j] = ax + bx * s + dx * k; p[j + 1] = ay + by * s + dy * k; p[j + 2] = az + bz * s + dz * k;
      }
      if (!arms && p[j + 1] < g) p[j + 1] = g;
    }
  }
  /* Normals and tangents of the panels (src positions, otherwise those of the simulation) */
  normals(src) { clothNormals(this.T, src || this.p, this.nor, this.tan); }
}
/* Normals (outward from each panel: sgn) and tangents along the rows (TG, optional) of the positions P. Called at every step of
   every simulated cloth: no Math.hypot and no iterator (they allocated 50 KB per frame on Chergui, stutters.js) */
function clothNormals(T, P, N, TG) {
  const SH = T.sheets;
  for (let q = 0; q < SH.length; q++) {
    const S = SH[q], o = S.o, cu = S.cu, rv = S.rv, s = S.sgn;
    for (let j = 0; j < rv; j++) {
      const row = o + j * cu, dn = o + (j > 0 ? j - 1 : 0) * cu, up = o + (j < rv - 1 ? j + 1 : j) * cu;
      for (let i = 0; i < cu; i++) {
        const k = row + i, l = (row + (i > 0 ? i - 1 : 0)) * 3, r = (row + (i < cu - 1 ? i + 1 : i)) * 3, d = (dn + i) * 3, u = (up + i) * 3;
        const ux = P[r] - P[l], uy = P[r + 1] - P[l + 1], uz = P[r + 2] - P[l + 2];
        const vx = P[u] - P[d], vy = P[u + 1] - P[d + 1], vz = P[u + 2] - P[d + 2];
        const nx = (uy * vz - uz * vy) * s, ny = (uz * vx - ux * vz) * s, nz = (ux * vy - uy * vx) * s, ln = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        N[k * 3] = nx / ln; N[k * 3 + 1] = ny / ln; N[k * 3 + 2] = nz / ln;
        if (TG) { const lu = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1; TG[k * 3] = ux / lu; TG[k * 3 + 1] = uy / lu; TG[k * 3 + 2] = uz / lu; }
      }
    }
  }
}
/* Constraints of a cu x rv grid (index o + i + j * cu): structure (stiff), shear, bend (soft); rest lengths */
function clothGridCons(rest, cu, rv, o = 0) {
  const C = [], S = [], add = (a, b, k) => { C.push(a, b); S.push(k); };
  for (let j = 0; j < rv; j++) for (let i = 0; i < cu; i++) {
    const k = o + j * cu + i;
    if (i + 1 < cu) add(k, k + 1, 1);
    if (j + 1 < rv) add(k, k + cu, 1);
    if (i + 1 < cu && j + 1 < rv) { add(k, k + cu + 1, 0.7); add(k + 1, k + cu, 0.7); }
    if (i + 2 < cu) add(k, k + 2, 0.25);
    if (j + 2 < rv) add(k, k + 2 * cu, 0.25);
  }
  const L = new Float32Array(S.length);
  for (let c = 0; c < S.length; c++) { const a = C[c * 2] * 3, b = C[c * 2 + 1] * 3; L[c] = hyp3(rest[b] - rest[a], rest[b + 1] - rest[a + 1], rest[b + 2] - rest[a + 2]); }
  return { con: new Uint16Array(C), len: L, stf: new Float32Array(S) };
}

/* ---------- Cloth models ----------
   A model (shared by all soldiers wearing an outfit): particles (n, rest, wi, w, pin, maxD), constraints (con, len, stf),
   panels (sheets: { o, cu, rv, sgn }, for the normals), render grid (rn vertices: particle rmap, coordinates ruv,
   color rcol, back-face tint rsh; top triangles rtri) and satellite vertices (sat). */
const CLOTH_TPL = {};
/* Cloth model of an outfit (SKINS.<id>.cloth), built once; null if the outfit has no cloth */
function clothTpl(skin) {
  const f = SKINS[skin] && SKINS[skin].cloth; if (!f) return null;
  return CLOTH_TPL[skin] || (CLOTH_TPL[skin] = f(skin));
}
/* Bone weights (list [[bone, weight]] or index) of a particle: the four strongest, normalized */
function clothSetW(wi, w, id, wl) {
  if (typeof wl === 'number') { wi[id * 4] = wl; w[id * 4] = 1; return; }
  const ws = wl.slice().sort((x, y) => y[1] - x[1]).slice(0, 4); let s = 0; for (const e of ws) s += e[1];
  for (let q = 0; q < 4; q++) { const e = ws[q]; wi[id * 4 + q] = e ? e[0] : 0; w[id * 4 + q] = e && s > 0 ? e[1] / s : 0; }
}
/* Direction of a panel's normals: outward (away from the body axis, or per out(p) which gives the outside direction) */
function clothSign(rest, o, cu, rv, out) {
  let sg = 0; const v = new V3();
  for (let j = 0; j + 1 < rv; j++) for (let i = 0; i + 1 < cu; i++) {
    const A = (o + j * cu + i) * 3, B = A + 3, Cc = A + cu * 3;
    const ux = rest[B] - rest[A], uy = rest[B + 1] - rest[A + 1], uz = rest[B + 2] - rest[A + 2], vx = rest[Cc] - rest[A], vy = rest[Cc + 1] - rest[A + 1], vz = rest[Cc + 2] - rest[A + 2];
    if (out) out(v.set(rest[A], rest[A + 1], rest[A + 2])); else v.set(rest[A], 0, rest[A + 2]);
    sg += (uy * vz - uz * vy) * v.x + (uz * vx - ux * vz) * v.y + (ux * vy - uy * vx) * v.z;
  }
  return sg >= 0 ? 1 : -1;
}
/* Assembles panels { cu, rv, node(i, j, nd), shade, out, hide } into a model (hide: panel simulated but not drawn, dressed by satellite
   vertices: the tail of a one-piece outfit). node fills nd: p (rest position, V3), w (bone
   weights), pin (1: pinned; by default the first row), maxD (slack around the target), uv ([u, v] in the atlas), col (color,
   white otherwise), shade (back-face tint). o.drag: wind grip (0.9 by default). */
function clothBuild(sheets, o = {}) {
  let n = 0; for (const S of sheets) n += S.cu * S.rv;
  const rest = new Float32Array(n * 3), wi = new Uint8Array(n * 4), w = new Float32Array(n * 4), pin = new Float32Array(n), maxD = new Float32Array(n);
  const ruv = new Float32Array(n * 2), rcol = new Float32Array(n * 3), rsh = new Float32Array(n), rmap = new Uint16Array(n), tri = [], C = [], L = [], K = [], out = [];
  const nd = { p: new V3(), w: null, pin: 0, maxD: 0, uv: [0, 0], col: null, shade: 0.55 };
  let o0 = 0;
  for (const S of sheets) {
    const cu = S.cu, rv = S.rv;
    for (let j = 0; j < rv; j++) for (let i = 0; i < cu; i++) {
      const id = o0 + j * cu + i;
      nd.pin = j === 0 ? 1 : 0; nd.maxD = 0.1; nd.col = null; nd.shade = S.shade !== undefined ? S.shade : 0.55; nd.w = SB.PEL;
      S.node(i, j, nd);
      rest[id * 3] = nd.p.x; rest[id * 3 + 1] = nd.p.y; rest[id * 3 + 2] = nd.p.z;
      clothSetW(wi, w, id, nd.w);
      pin[id] = nd.pin; maxD[id] = nd.pin >= 1 ? 0 : nd.maxD;
      rmap[id] = id; ruv[id * 2] = nd.uv[0]; ruv[id * 2 + 1] = nd.uv[1];
      rcol[id * 3] = nd.col ? nd.col.r : 1; rcol[id * 3 + 1] = nd.col ? nd.col.g : 1; rcol[id * 3 + 2] = nd.col ? nd.col.b : 1; rsh[id] = nd.shade;
    }
    const G = clothGridCons(rest, cu, rv, o0);
    for (let c = 0; c < G.stf.length; c++) { C.push(G.con[c * 2], G.con[c * 2 + 1]); L.push(G.len[c]); K.push(G.stf[c]); }
    const sgn = clothSign(rest, o0, cu, rv, S.out);
    if (!S.hide) for (let j = 0; j + 1 < rv; j++) for (let i = 0; i + 1 < cu; i++) {
      const A = o0 + j * cu + i, B2 = A + 1, Cc = A + cu, D = Cc + 1;
      if (sgn > 0) tri.push(A, B2, Cc, B2, D, Cc); else tri.push(A, Cc, B2, B2, Cc, D);
    }
    out.push({ o: o0, cu, rv, sgn });
    o0 += cu * rv;
  }
  return { n, rest, wi, w, pin, maxD, con: new Uint16Array(C), len: new Float32Array(L), stf: new Float32Array(K), drag: o.drag || 0.9, sheets: out,
    rn: n, rmap, ruv, rcol, rsh, rtri: new Uint16Array(tri), sat: null, pinOut: true };
}
/* Satellite vertices: each quad { k: particle, P: four corners (V3, rest), uv: four [u, v], col, colB (underside) } is
   expressed in the rest frame of its particle (tangent, normal) and follows it; two faces per quad, the top on the side
   of the cloth normal */
function clothSatBuild(T, quads) {
  const N = new Float32Array(T.n * 3), TG = new Float32Array(T.n * 3); clothNormals(T, T.rest, N, TG);
  const m = quads.length * 8, k = new Uint16Array(m), off = new Float32Array(m * 3), nrm = new Float32Array(m * 3), uv = new Float32Array(m * 2), col = new Float32Array(m * 3), tri = [];
  const U = new V3(), Nv = new V3(), V = new V3(), d = new V3(), e1 = new V3(), e2 = new V3(), nq = new V3(), cb = new THREE.Color();
  quads.forEach((Q, q) => {
    const j = Q.k * 3; U.fromArray(TG, j); Nv.fromArray(N, j); V.crossVectors(Nv, U);
    e1.subVectors(Q.P[1], Q.P[0]); e2.subVectors(Q.P[3], Q.P[0]); nq.crossVectors(e1, e2).normalize();
    if (nq.dot(Nv) < 0) nq.negate();
    for (let f = 0; f < 2; f++) {
      const v0 = q * 8 + f * 4, sg = f ? -1 : 1, C = f ? (Q.colB || cb.copy(Q.col || cb.setRGB(1, 1, 1)).multiplyScalar(0.7)) : Q.col;
      for (let c = 0; c < 4; c++) {
        const v = v0 + c; k[v] = Q.k;
        d.set(Q.P[c].x - T.rest[j], Q.P[c].y - T.rest[j + 1], Q.P[c].z - T.rest[j + 2]).addScaledVector(nq, f ? -0.0008 : 0);
        off[v * 3] = d.dot(U); off[v * 3 + 1] = d.dot(V); off[v * 3 + 2] = d.dot(Nv);
        nrm[v * 3] = nq.dot(U) * sg; nrm[v * 3 + 1] = nq.dot(V) * sg; nrm[v * 3 + 2] = nq.dot(Nv) * sg;
        uv[v * 2] = Q.uv[c][0]; uv[v * 2 + 1] = Q.uv[c][1];
        col[v * 3] = C ? C.r : 1; col[v * 3 + 1] = C ? C.g : 1; col[v * 3 + 2] = C ? C.b : 1;
      }
      // direction: the face must look toward its normal side
      const same = e1.clone().cross(e2).dot(nq) * sg > 0;
      if (same) tri.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3); else tri.push(v0, v0 + 2, v0 + 1, v0, v0 + 3, v0 + 2);
    }
  });
  T.sat = { n: m, k, off, nrm, uv, col, tri: new Uint16Array(tri) };
  return T;
}
/* Panel around the body: rings { y, half-width, front, back } (rest, top to bottom, like PONCHO), swept from angle
   a0 to a1 (0 in front, π/2 on the soldier's right, π behind; numbers or functions of the relative height f from 0 to 1). The column s
   (0 to 1) only descends to the fraction hem(s) of the height (ragged or pointed hem); o.w(p, a): bone weights;
   o.maxD(p, t); o.uv(s, t, p, a); o.col(s, t); o.pin(i, j); o.e: exponent of the rings (the angles get rounded) */
function clothRing(o) {
  const R = o.rings, nk = R.length, e = o.e || 2 / 2.2, a = new V3(), b = new V3();
  const ring = (k, ang, out) => { const r = R[k], c = Math.cos(ang), s = Math.sin(ang); return out.set(Math.sign(s) * Math.pow(Math.abs(s), e) * r[1], r[0], -Math.sign(c) * Math.pow(Math.abs(c), e) * (c >= 0 ? r[2] : r[3])); };
  const ang = (x, f) => (typeof x === 'function' ? x(f) : x);
  return { cu: o.cu, rv: o.rv, shade: o.shade, out: o.out, node: (i, j, nd) => {
    const s = i / (o.cu - 1), h = o.hem ? o.hem(s, i) : 1, t = j / (o.rv - 1) * h, f = t * (nk - 1), k = Math.min(nk - 2, Math.floor(f)), u = f - k;
    const A = lerp(ang(o.a0, t), ang(o.a1, t), s);
    ring(k, A, a).lerp(ring(k + 1, A, b), u);
    nd.p.copy(a); nd.w = o.w(a, A); nd.maxD = o.maxD ? o.maxD(a, t) : 0.03 + t * 0.4;
    if (o.pin) nd.pin = o.pin(i, j);
    const q = o.uv(s, t, a, A); nd.uv[0] = q[0]; nd.uv[1] = q[1];
    if (o.col) nd.col = o.col(s, t);
  } };
}
/* Strip (ribbon): from point p0 toward dir (unit) over len, width w0 then w1 along side (unit); cu columns, rv rows;
   the first row pinned. o.w(p, t): weights; o.uv(s, t); o.col; o.bend(t): offset along out (rest curvature) */
function clothStrip(o) {
  const p = new V3();
  return { cu: o.cu || 2, rv: o.rv, shade: o.shade === undefined ? 0.8 : o.shade, out: o.out, node: (i, j, nd) => {
    const s = i / ((o.cu || 2) - 1), t = j / (o.rv - 1), wd = lerp(o.w0, o.w1, Math.pow(t, o.taper || 1));
    p.copy(o.p0).addScaledVector(o.dir, o.len * t).addScaledVector(o.side, (s - 0.5) * wd);
    if (o.bend && o.nrm) p.addScaledVector(o.nrm, o.bend(t));
    nd.p.copy(p); nd.w = o.w(p, t); nd.maxD = o.maxD ? o.maxD(t) : 0.02 + t * o.len * 0.6;
    const q = o.uv(s, t); nd.uv[0] = q[0]; nd.uv[1] = q[1];
    if (o.col) nd.col = typeof o.col === 'function' ? o.col(s, t) : o.col;
  } };
}
/* Weights of a panel hanging from the belt: the pelvis at the top, then the thigh on its side (both in the middle) going down */
function clothHipW(p) {
  const t = smoothstep(1.02, 0.62, p.y) * 0.75, sx = clamp(p.x / 0.11, -1, 1), l = (1 - sx) / 2, r = (1 + sx) / 2;
  return [[SB.PEL, 1 - t], [SB.THL, t * l], [SB.THR, t * r]];
}
/* Cloth frozen in its rest pose, added to an outfit geometry (lightweight model, cast shadow): the two sheets and, one in
   every satStep, the satellite vertices */
function clothStaticInto(B, T, satStep = 2) {
  const N = new Float32Array(T.n * 3), TG = new Float32Array(T.n * 3), R = T.rest, col = new THREE.Color(); clothNormals(T, R, N, TG);
  const wOf = (k) => { const l = []; for (let q = 0; q < 4; q++) if (T.w[k * 4 + q] > 0) l.push([T.wi[k * 4 + q], T.w[k * 4 + q]]); return l; };
  B.begin(); const v0 = B.count;
  for (let l = 0; l < 2; l++) for (let v = 0; v < T.rn; v++) {
    const k = T.rmap[v], sh = l ? T.rsh[v] : 1, d = l ? 0.007 : 0;
    col.setRGB(T.rcol[v * 3] * sh, T.rcol[v * 3 + 1] * sh, T.rcol[v * 3 + 2] * sh);
    B.vert(R[k * 3] - N[k * 3] * d, R[k * 3 + 1] - N[k * 3 + 1] * d, R[k * 3 + 2] - N[k * 3 + 2] * d, T.ruv[v * 2], T.ruv[v * 2 + 1], col, wOf(k));
  }
  const tr = T.rtri;
  for (let t = 0; t < tr.length; t += 3) { B.tri(v0 + tr[t], v0 + tr[t + 1], v0 + tr[t + 2]); B.tri(v0 + T.rn + tr[t], v0 + T.rn + tr[t + 2], v0 + T.rn + tr[t + 1]); }
  B.end(false);
  const S = T.sat; if (!S) return;
  B.begin(); const s0 = B.count, U = new V3(), Nv = new V3(), V = new V3(), map = new Int32Array(S.n).fill(-1);
  for (let v = 0; v < S.n; v++) {
    if (!S.keep && (v >> 3) % satStep) continue; // (S.keep: a tube, not quads, which is kept whole)
    const j = S.k[v] * 3; U.fromArray(TG, j); Nv.fromArray(N, j); V.crossVectors(Nv, U);
    const ox = S.off[v * 3], oy = S.off[v * 3 + 1], oz = S.off[v * 3 + 2];
    col.setRGB(S.col[v * 3], S.col[v * 3 + 1], S.col[v * 3 + 2]);
    map[v] = B.vert(R[j] + U.x * ox + V.x * oy + Nv.x * oz, R[j + 1] + U.y * ox + V.y * oy + Nv.y * oz, R[j + 2] + U.z * ox + V.z * oy + Nv.z * oz, S.uv[v * 2], S.uv[v * 2 + 1], col, wOf(S.k[v]));
  }
  for (let t = 0; t < S.tri.length; t += 3) { const a = map[S.tri[t]], b = map[S.tri[t + 1]], c = map[S.tri[t + 2]]; if (a >= 0 && b >= 0 && c >= 0) B.tri(a, b, c); }
  B.end(false);
  void s0;
}

/* ---------- Breacher outfit poncho ----------
   The turtleneck and the top of the shoulders (PONCHO rings 0 to CLOTH_PONCHO_K0) stay in the skinned outfit (skinPoncho, detailed
   model); the rest (shoulders, front panels, sides resting on the arms, back panel down to the knees) is this cloth, whose
   first row, pinned, coincides with the last ring of the collar (same positions, same bone weights: no visible seam).
   (The collar stops above the deltoid: rigid, ring 3 was crossed by the arm raised when aiming, by up to 4.6 cm.) */
const CLOTH_PONCHO_K0 = 2;
function ponchoClothTemplate() {
  const K0 = CLOTH_PONCHO_K0, nk = PONCHO.length, sub = 2, cu = 19, rv = (nk - 1 - K0) * sub + 1, n = cu * rv;
  const rest = new Float32Array(n * 3), wi = new Uint8Array(n * 4), w = new Float32Array(n * 4), pin = new Float32Array(n), maxD = new Float32Array(n);
  const st = new Float32Array(n * 2), a = new V3(), b = new V3();
  for (let j = 0; j < rv; j++) {
    const f = K0 + j / sub, k = Math.min(nk - 2, Math.floor(f)), t = f - k, gap = lerp(PONCHO[k][4], PONCHO[k + 1][4], t);
    for (let i = 0; i < cu; i++) {
      const ang = gap + (i / (cu - 1)) * (TAU - 2 * gap), id = j * cu + i;
      ponchoRing(k, ang, a).lerp(ponchoRing(k + 1, ang, b), t);
      rest[id * 3] = a.x; rest[id * 3 + 1] = a.y; rest[id * 3 + 2] = a.z;
      clothSetW(wi, w, id, ponchoWeights(a, ang));
      pin[id] = j === 0 ? 1 : 0;
      // slack around the rest pose: small on the shoulders, large at the bottom of the panels
      maxD[id] = j === 0 ? 0 : 0.03 + Math.max(0, PONCHO[K0][0] - a.y) * 0.75;
      const c = ponchoST(ang, a.y); st[id * 2] = c[0]; st[id * 2 + 1] = c[1]; // like the collar (06ga-outfits.js), not folded
    }
  }
  const G = clothGridCons(rest, cu, rv), sgn = clothSign(rest, 0, cu, rv);
  // render grid: the middle column of the back (s = 1) and the row of ring 7 (t = 1) are doubled, each copy with the
  // coordinates of its camouflage zone: no triangle straddles two zones (the pattern would be squashed into a band there)
  const mid = (cu - 1) >> 1, jw = (7 - K0) * sub, RC = [], RR = [];
  for (let i = 0; i < cu; i++) { if (i <= mid) RC.push([i, 0]); if (i >= mid) RC.push([i, -1]); }
  for (let j = 0; j < rv; j++) { if (j <= jw) RR.push([j, 0]); if (j >= jw) RR.push([j, -1]); }
  const rcu = RC.length, rrv = RR.length, rn = rcu * rrv, rmap = new Uint16Array(rn), ruv = new Float32Array(rn * 2), tri = [];
  for (let r = 0; r < rrv; r++) for (let c = 0; c < rcu; c++) {
    const v = r * rcu + c, id = RR[r][0] * cu + RC[c][0], q = atlasUV('camo', st[id * 2] + RC[c][1], st[id * 2 + 1] + RR[r][1]);
    rmap[v] = id; ruv[v * 2] = q[0]; ruv[v * 2 + 1] = q[1];
  }
  for (let j = 0; j + 1 < rrv; j++) for (let i = 0; i + 1 < rcu; i++) {
    const A = j * rcu + i, B2 = A + 1, Cc = A + rcu, D = Cc + 1;
    if (rmap[A] === rmap[B2] || rmap[A] === rmap[Cc]) continue; // between the two copies of a doubled column or row
    if (sgn > 0) tri.push(A, B2, Cc, B2, D, Cc); else tri.push(A, Cc, B2, B2, Cc, D);
  }
  return { n, rest, wi, w, pin, maxD, con: G.con, len: G.len, stf: G.stf, drag: 0.9, sheets: [{ o: 0, cu, rv, sgn }],
    rn, rmap, ruv, rcol: new Float32Array(rn * 3).fill(1), rsh: new Float32Array(rn).fill(0.55), rtri: new Uint16Array(tri), sat: null };
}
/* Cloth mesh: two sheets of the render grid (top outward, bottom darker) then the satellites; a
   single bone (the pelvis) */
function clothGeometry(T) {
  const n = T.rn, ns = T.sat ? T.sat.n : 0, nv = n * 2 + ns, g = new THREE.BufferGeometry();
  const pos = new THREE.BufferAttribute(new Float32Array(nv * 3), 3), nor = new THREE.BufferAttribute(new Float32Array(nv * 3), 3);
  pos.setUsage(THREE.DynamicDrawUsage); nor.setUsage(THREE.DynamicDrawUsage);
  const uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3), si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4);
  for (let i = 0; i < n; i++) for (let l = 0; l < 2; l++) {
    const v = i + l * n, c = l ? T.rsh[i] : 1; uv[v * 2] = T.ruv[i * 2]; uv[v * 2 + 1] = T.ruv[i * 2 + 1];
    col[v * 3] = T.rcol[i * 3] * c; col[v * 3 + 1] = T.rcol[i * 3 + 1] * c; col[v * 3 + 2] = T.rcol[i * 3 + 2] * c;
  }
  if (ns) { uv.set(T.sat.uv, n * 4); col.set(T.sat.col, n * 6); }
  for (let v = 0; v < nv; v++) sw[v * 4] = 1;
  const idx = [], tr = T.rtri;
  for (let t = 0; t < tr.length; t += 3) idx.push(tr[t], tr[t + 1], tr[t + 2]);
  for (let t = 0; t < tr.length; t += 3) idx.push(n + tr[t], n + tr[t + 2], n + tr[t + 1]);
  if (ns) for (let t = 0; t < T.sat.tri.length; t++) idx.push(2 * n + T.sat.tri[t]);
  g.setAttribute('position', pos); g.setAttribute('normal', nor);
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  g.setAttribute('aoc', new THREE.BufferAttribute(new Float32Array(nv), 1)); // baked body occlusion (06g-body.js): none on floating cloth
  g.setIndex(idx);
  g.boundingSphere = new THREE.Sphere(new V3(0, 0.1, 0), 1.35); // like the body: around the pelvis
  return g;
}
/* Adds the outfit's cloth to a soldier (S.bones) with material mat, bound to skeleton skel of its body; returns the cloth description */
function clothAttach(S, skin, mat, skel) {
  const T = clothTpl(skin), sim = new ClothSim(T), geo = clothGeometry(T);
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.bind(skel, _RIG_ID);
  mesh.frustumCulled = true; mesh.castShadow = false; mesh.receiveShadow = true; mesh.userData.noPrepass = true; mesh.customDepthMaterial = SKIN_DEPTH_MAT;
  S.bones[SB.PEL].add(mesh);
  return { sim, mesh, skin, mats: S.bones.map(() => new THREE.Matrix4()), inv: new THREE.Matrix4(), on: true };
}
function clothDetach(S) {
  const C = S && S.cloth; if (!C) return;
  C.mesh.removeFromParent(); C.mesh.geometry.dispose(); S.cloth = null;
}
/* Should soldier S wear the cloth (outfit with cloth, detailed model on screen) */
function clothSync(S, skin, mat) {
  const want = !!(SKINS[skin] && SKINS[skin].cloth) && !S.shadowOnly;
  if (S.cloth && (!want || S.cloth.skin !== skin)) clothDetach(S);
  if (want && !S.cloth) S.cloth = clothAttach(S, skin, mat, S.lod.hi.skeleton);
  if (S.cloth) S.cloth.mesh.material = mat;
}

/* ---------- Update ---------- */
const _cm = { m: new THREE.Matrix4(), s: new V3(1, 1, 1), v: new V3(), n: new V3() };
/* Current bone matrices (bone x inverse of rest): the soldier's frame is the world's (S.root is never moved) */
function clothBones(S, C) {
  const R = soldierRest();
  for (let i = 0; i < SOLDIER_NB; i++) { const b = S.bones[i]; C.mats[i].compose(b.position, b.quaternion, _cm.s).multiply(_cm.m.copy(R.mats[i]).invert()); }
}
/* Body capsules (world) and ground, from the bones. The arms (sleeve and armband, plus the gap between two cloth particles)
   have an outer side: toward the outside of the torso and upward, the one where the poncho rests */
const _cc = { a: new V3(), b: new V3(), m: new V3() };
const _cs = { a: new V3(), b: new V3(), d: new V3() }; // (thin-torso capsules: no allocation each frame)
function clothColliders(S, C) {
  const B = S.bones, cap = C.sim.cap; let k = 0;
  const up = _cm.v.set(0, 1, 0).applyQuaternion(B[SB.PEL].quaternion), T0 = _cc.a.copy(B[SB.PEL].position).addScaledVector(up, 0.06), T1 = _cc.b.copy(B[SB.NEC].position);
  const seg = (a, b, r, arm) => {
    const c = cap[k++]; c.a.copy(a); c.b.copy(b); c.r = r; c.o = null;
    if (!arm) return;
    // outer side: from the torso toward the middle of the segment, horizontal, raised, then perpendicular to the segment
    const m = _cc.m.addVectors(a, b).multiplyScalar(0.5), o = c.ov, ax = _cm.n.subVectors(T1, T0), t = clamp(o.subVectors(m, T0).dot(ax) / Math.max(1e-6, ax.lengthSq()), 0, 1);
    o.subVectors(m, T0).addScaledVector(ax, -t); o.y = 0;
    if (o.lengthSq() < 1e-8) o.set(1, 0, 0);
    o.normalize(); o.y += 0.8;
    const sg = _cm.n.subVectors(b, a), l2 = sg.lengthSq(); if (l2 > 1e-8) o.addScaledVector(sg, -o.dot(sg) / l2);
    if (o.lengthSq() > 1e-8) { o.normalize(); c.o = o; }
  };
  // T.slim (a fitted garment, the vest of the Yellow Vest): the torso as two thin capsules side by side (the single capsule, made for the
  // capes worn out beyond the vest, pushed it back into a ruff), thinner hips, no shoulders or arms (their outer side would throw
  // its flanks over the arms)
  const slim = !!C.sim.T.slim;
  if (slim) {
    const sd = _cs.d.set(0.07, 0, 0).applyQuaternion(B[SB.CHE].quaternion);
    seg(_cs.a.copy(T0).add(sd), _cs.b.copy(T1).add(sd), 0.09); seg(_cs.a.copy(T0).sub(sd), _cs.b.copy(T1).sub(sd), 0.09);
  } else seg(T0, T1, 0.175); // torso and vest
  seg(B[SB.NEC].position, _cc.m.set(0, 0.07, 0).applyQuaternion(B[SB.HEA].quaternion).add(B[SB.HEA].position), 0.105); // neck and head (hood, helmet)
  seg(B[SB.HPL].position, B[SB.HPR].position, slim ? 0.11 : 0.15); // hips, belt and its pockets
  if (!slim) seg(B[SB.UAL].position, B[SB.UAR].position, 0.075); // shoulders
  for (const sx of [-1, 1]) {
    const b = SIDE_B(sx);
    if (!slim) { seg(B[b.ua].position, B[b.fa].position, 0.085, true); seg(B[b.fa].position, B[b.ha].position, 0.065, true); }
    seg(B[b.th].position, B[b.sh].position, 0.088); seg(B[b.sh].position, B[b.ft].position, 0.062);
  }
  C.sim.nc = k;
  const fy = Math.min(B[SB.FTL].position.y, B[SB.FTR].position.y);
  C.sim.ground = S.rag ? Math.min(fy, B[SB.PEL].position.y) - 0.08 : fy - 0.06;
}
/* Writes the positions and normals (world) into the mesh, brought back to the pelvis rest frame; the satellites follow the frame
   (tangent, normal) of their particle */
function clothWrite(S, C, src) {
  const sim = C.sim, T = sim.T, n = T.rn, M = T.rmap, P = src || sim.p, N = sim.nor, g = C.mesh.geometry, pa = g.attributes.position.array, na = g.attributes.normal.array;
  C.inv.copy(C.mats[SB.PEL]).invert(); const e = C.inv.elements;
  for (let v = 0; v < n; v++) {
    const j = M[v] * 3, x = P[j], y = P[j + 1], z = P[j + 2], nx = N[j], ny = N[j + 1], nz = N[j + 2], k = v * 3;
    const X = e[0] * x + e[4] * y + e[8] * z + e[12], Y = e[1] * x + e[5] * y + e[9] * z + e[13], Z = e[2] * x + e[6] * y + e[10] * z + e[14];
    const NX = e[0] * nx + e[4] * ny + e[8] * nz, NY = e[1] * nx + e[5] * ny + e[9] * nz, NZ = e[2] * nx + e[6] * ny + e[10] * nz;
    pa[k] = X; pa[k + 1] = Y; pa[k + 2] = Z; na[k] = NX; na[k + 1] = NY; na[k + 2] = NZ;
    const o = (v + n) * 3; pa[o] = X - NX * 0.007; pa[o + 1] = Y - NY * 0.007; pa[o + 2] = Z - NZ * 0.007; na[o] = -NX; na[o + 1] = -NY; na[o + 2] = -NZ;
  }
  const St = T.sat;
  if (St) {
    const TG = sim.tan, K = St.k, O = St.off, R = St.nrm;
    for (let v = 0; v < St.n; v++) {
      const j = K[v] * 3, ux = TG[j], uy = TG[j + 1], uz = TG[j + 2], nx = N[j], ny = N[j + 1], nz = N[j + 2];
      const vx = ny * uz - nz * uy, vy = nz * ux - nx * uz, vz = nx * uy - ny * ux, a = O[v * 3], b = O[v * 3 + 1], c = O[v * 3 + 2], r0 = R[v * 3], r1 = R[v * 3 + 1], r2 = R[v * 3 + 2];
      const x = P[j] + ux * a + vx * b + nx * c, y = P[j + 1] + uy * a + vy * b + ny * c, z = P[j + 2] + uz * a + vz * b + nz * c;
      const qx = ux * r0 + vx * r1 + nx * r2, qy = uy * r0 + vy * r1 + ny * r2, qz = uz * r0 + vz * r1 + nz * r2, k = (2 * n + v) * 3;
      pa[k] = e[0] * x + e[4] * y + e[8] * z + e[12]; pa[k + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; pa[k + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      na[k] = e[0] * qx + e[4] * qy + e[8] * qz; na[k + 1] = e[1] * qx + e[5] * qy + e[9] * qz; na[k + 2] = e[2] * qx + e[6] * qy + e[10] * qz;
    }
  }
  g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
}
/* Current wind (world, m/s): map breeze, slow gusts; sheltered under a roof, almost nothing */
function clothWind(S, out) {
  const id = CURMAP.def && CURMAP.id, b = CLOTH_BREEZE[id] || CLOTH_BREEZE_DEF, t = CLOTH.t, l = hyp(b[0], b[1]) || 1;
  const gust = 0.6 + 0.3 * Math.sin(t * 0.45) + 0.25 * Math.sin(t * 1.3 + 1.7) + 0.15 * Math.sin(t * 2.9 + 0.4);
  const p = S.bones[SB.PEL].position, sky = typeof lightAt === 'function' ? lightAt(p.x, p.y + 0.5, p.z)[0] : 1;
  const k = b[2] * gust * smoothstep(0.25, 0.7, sky);
  return out.set(b[0] / l * k, 0, b[1] / l * k);
}
/* Cloth targets: rest pose deformed by the skeleton, then pushed out of the arms by their outer side (the raised arm lifts
   the panel instead of crossing it, even without simulation); false if the skeleton is invalid */
function clothTargets(S, C) {
  const sim = C.sim; sim.skin(C.mats);
  if (!Number.isFinite(sim.tgt[0] + sim.tgt[sim.n * 3 - 1])) return false;
  clothColliders(S, C); sim.collide(sim.tgt, true);
  return true;
}
/* Rest pose only (over budget, or detailed model without simulation) */
function clothKinematic(S, C) {
  clothBones(S, C); clothTargets(S, C); C.sim.normals(C.sim.tgt); clothWrite(S, C, C.sim.tgt); C.sim.live = false;
}
/* Simulates the cloth of S for dt */
function clothSimulate(S, C, dt) {
  const sim = C.sim;
  clothBones(S, C);
  if (!clothTargets(S, C)) return; // invalid skeleton: keep the previous frame
  if (!sim.live || sim.fresh) { sim.reset(); sim.normals(); sim.live = true; sim.acc = 0; }
  clothWind(S, CLOTH.wind); sim.limp = !!S.rag;
  sim.acc = Math.min(sim.acc + dt, CLOTH_H * 2);
  const it = RQ.q.lean ? 3 : 4;
  while (sim.acc >= CLOTH_H) { sim.step(CLOTH_H, CLOTH.wind, it); sim.normals(); sim.acc -= CLOTH_H; }
  clothWrite(S, C);
}
/* Every frame: the cloths of soldiers with the detailed model, simulated within the budget (nearest first) */
const _cl = [];
function clothUpdate(dt) {
  CLOTH.t += dt; _cl.length = 0;
  const add = (S) => {
    const C = S && S.cloth; if (!C) return;
    const on = S.root.visible && !!(S.lod && S.lod.hiOn); C.mesh.visible = on;
    if (on) _cl.push(S); else C.sim.live = false;
  };
  for (const e of entities) add(e.model);
  if (typeof KC !== 'undefined' && KC.body) add(KC.body);
  for (const S of _cl) S._cd = camera.position.distanceToSquared(S.bones[SB.PEL].position);
  _cl.sort((a, b) => a._cd - b._cd);
  for (let i = 0; i < _cl.length; i++) {
    const S = _cl[i], C = S.cloth;
    if (i < CLOTH_MAX && S._cd < 40 * 40) clothSimulate(S, C, dt); else clothKinematic(S, C);
  }
}
/* Outfit preview: the cloth settles to rest (no wind), then it is frozen into the mesh */
function clothSettle(S, C) {
  const sim = C.sim; clothBones(S, C); clothTargets(S, C); sim.reset(); sim.normals();
  const calm = new V3();
  for (let k = 0; k < 150; k++) { sim.step(CLOTH_H, calm, 4); if (k % 10 === 0) sim.normals(); }
  sim.normals(); clothWrite(S, C);
}
