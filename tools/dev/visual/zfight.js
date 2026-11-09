/* Z-fighting of a map's scenery: node zfight.js [--json]   (MAP=notos; PAGE=other built version; TOP=40 lines at most)
   Records, before they are sent to the GPU (finalizeWorld wrapped), the triangles of the merged scenery (DECOR) that overlap in the same plane and
   face the same way: two coincident surfaces that the graphics card arbitrates at random, frame after frame, hence the flicker.
   - common plane: normals within 1.5° of each other, within 3 mm of each other over the whole common part (and not only at
     the origin: two nearly parallel planes cross there and diverge further away); a double-sided face (DoubleSide material) also counts
     turned the other way;
   - overlap: area of the intersection of the two triangles, projected on the plane, of at least 20 cm²;
   - excluded: materials that are offset on purpose (polygonOffset: decals, signs), foliage, grass and net cards
     (cut out, they cross without being seen), triangles under 4 cm².
   - seen: a spot counts if it can be seen while playing, from the eyes (1.6 m) of a point of the main navigation network within 40 m, from the side
     the face looks toward, with no collision box between the two (rayWorld); otherwise it is "hidden" (underside of a floor laid on the ground,
     facade turned toward the outside of the map, face caught inside a wall).
   Output: the most affected spots (2 m cells), with the materials involved, the height, the orientation of the plane, the overlapped area
   and the number of points from which it is seen (SEEN=1: only those that are seen; DETAIL=1: extent of the faces involved, per material, to
   find the object); error code if a visible overlap of
   more than 0.1 m² remains between two different materials. */
const { openGame } = require('./common');
const json = process.argv.includes('--json');
(async () => {
  const map = process.env.MAP || 'chergui', TOP = +(process.env.TOP || 40);
  const { browser, page } = await openGame({ w: 480, h: 270, page: process.env.PAGE, noMap: true, noHdri: true, settings: { quality: 'low', difficulty: 1, map } });
  const R = await page.evaluate(async (map) => {
    const bufs = [];
    const outro = finalizeWorld;
    // finalizeWorld is called by the map construction: the buffers are recorded just before
    window.finalizeWorld = function () { for (const b of WORLD.bufs.values()) if (b.g.ni) bufs.push({ mat: b.mat, cls: b.cls, ck: b.ck, P: b.g.P.slice(0, b.g.nv * 3), I: b.g.I.slice(0, b.g.ni) }); return outro.apply(this, arguments); };
    Settings.map = map; await mapEnsure(map); LOCK.fallback = true; startMatch({}); // the navigation network: from where things are seen
    const SKIP = /decal|sign|fol|leaf|conifer|grass|net|herb|ivy|vine|reed|flora|cyfol|cut|glassLit|bulb|lamp/i;
    // two passes (millions of triangles): plane keys first (normal within 0.05, distance to 1 cm), then keep only the
    // triangles whose plane is shared by two different buffers (materials or sections)
    const keyOf = (nx, ny, nz, d) => (((Math.round(nx * 20) + 21) * 43 + Math.round(ny * 20) + 21) * 43 + Math.round(nz * 20) + 21) * 1e7 + Math.round(d * 100) + 5e6;
    const tri = (b, t, out) => {
      const P = b.P, I = b.I, a = I[t] * 3, c = I[t + 1] * 3, d = I[t + 2] * 3;
      const ux = P[c] - P[a], uy = P[c + 1] - P[a + 1], uz = P[c + 2] - P[a + 2], vx = P[d] - P[a], vy = P[d + 1] - P[a + 1], vz = P[d + 2] - P[a + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz);
      if (l < 0.0008) return false; // area < 4 cm²
      out.nx = nx / l; out.ny = ny / l; out.nz = nz / l; out.d = out.nx * P[a] + out.ny * P[a + 1] + out.nz * P[a + 2]; out.a = a; out.c = c; out.e = d;
      return true;
    };
    const use = bufs.map((b) => { const m = MAT[b.mat]; return !!m && !SKIP.test(b.mat) && !m.polygonOffset && !(m.defines && 'WM_CUT' in m.defines); });
    const owner = new Map(), multi = new Set(), tmp = {}; let total = 0;
    for (let bi = 0; bi < bufs.length; bi++) {
      const b = bufs[bi]; total += b.I.length / 3; if (!use[bi]) continue;
      for (let t = 0; t < b.I.length; t += 3) {
        if (!tri(b, t, tmp)) continue;
        for (const k of [keyOf(tmp.nx, tmp.ny, tmp.nz, tmp.d), keyOf(-tmp.nx, -tmp.ny, -tmp.nz, -tmp.d)]) { const o = owner.get(k); if (o === undefined) owner.set(k, bi); else if (o !== bi) multi.add(k); }
      }
    }
    const G = new Map(); let kept = 0;
    for (let bi = 0; bi < bufs.length; bi++) {
      if (!use[bi]) continue; const b = bufs[bi], dbl = MAT[b.mat].side === THREE.DoubleSide;
      for (let t = 0; t < b.I.length; t += 3) {
        if (!tri(b, t, tmp)) continue;
        const k = keyOf(tmp.nx, tmp.ny, tmp.nz, tmp.d), kr = keyOf(-tmp.nx, -tmp.ny, -tmp.nz, -tmp.d);
        if (!multi.has(k) && !(dbl && multi.has(kr))) continue;
        const P = b.P, p = [P[tmp.a], P[tmp.a + 1], P[tmp.a + 2], P[tmp.c], P[tmp.c + 1], P[tmp.c + 2], P[tmp.e], P[tmp.e + 1], P[tmp.e + 2]];
        const o = { bi, dbl, nx: tmp.nx, ny: tmp.ny, nz: tmp.nz, d: tmp.d, p }; kept++;
        for (const kk of dbl ? [k, kr] : [k]) { let g = G.get(kk); if (!g) G.set(kk, g = []); g.push(o); }
      }
    }
    // area of the intersection of two triangles projected on the plane (axes: the two largest of the normal)
    const proj = (t, ax) => [[t.p[ax[0]], t.p[ax[1]]], [t.p[3 + ax[0]], t.p[3 + ax[1]]], [t.p[6 + ax[0]], t.p[6 + ax[1]]]];
    const area = (Q) => { let s = 0; for (let i = 0; i < Q.length; i++) { const a = Q[i], b = Q[(i + 1) % Q.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
    const clip = (S, C) => { // Sutherland-Hodgman: S clipped by the convex C (counterclockwise)
      let out = S;
      for (let i = 0; i < C.length && out.length; i++) {
        const A = C[i], B = C[(i + 1) % C.length], inp = out; out = [];
        const side = (p) => (B[0] - A[0]) * (p[1] - A[1]) - (B[1] - A[1]) * (p[0] - A[0]);
        for (let j = 0; j < inp.length; j++) {
          const P = inp[j], Q = inp[(j + 1) % inp.length], sp = side(P), sq = side(Q);
          if (sp >= 0) out.push(P);
          if ((sp >= 0) !== (sq >= 0)) { const k = sp / (sp - sq); out.push([P[0] + (Q[0] - P[0]) * k, P[1] + (Q[1] - P[1]) * k]); }
        }
      }
      return out;
    };
    const hits = new Map(); let pairs = 0;
    for (const g of G.values()) {
      if (g.length < 2 || g.length > 4000) continue;
      for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
        const A = g[i], B = g[j]; if (A.bi === B.bi) continue;
        const dot = A.nx * B.nx + A.ny * B.ny + A.nz * B.nz;
        if (dot < 0.99966 && !((A.dbl || B.dbl) && dot < -0.99966)) continue;
        if (Math.abs(A.d - Math.sign(dot) * B.d) > 0.003) continue;
        const an = [Math.abs(A.nx), Math.abs(A.ny), Math.abs(A.nz)], drop = an.indexOf(Math.max(...an)), ax = [0, 1, 2].filter((k) => k !== drop);
        let a = proj(A, ax), b = proj(B, ax); if (area(a) < 0) a = a.reverse(); if (area(b) < 0) b = b.reverse();
        // bounding boxes first
        const bx = (Q, k) => [Math.min(Q[0][k], Q[1][k], Q[2][k]), Math.max(Q[0][k], Q[1][k], Q[2][k])];
        const a0 = bx(a, 0), b0 = bx(b, 0), a1 = bx(a, 1), b1 = bx(b, 1);
        if (a0[1] <= b0[0] || b0[1] <= a0[0] || a1[1] <= b1[0] || b1[1] <= a1[0]) continue;
        const poly = clip(a, b), ar = Math.abs(area(poly));
        if (ar < 0.002) continue;
        // two nearly parallel planes (under 1.5°) can have the same distance from the origin and diverge by several centimeters where
        // they overlap (a half-open shutter in front of a wall, far from the origin): the gap is measured at the vertices of the common part
        const nB = [B.nx, B.ny, B.nz].map((v) => v * Math.sign(dot)), dB = B.d * Math.sign(dot), nA0 = [A.nx, A.ny, A.nz];
        const off = (q, n, d) => (d - n[ax[0]] * q[0] - n[ax[1]] * q[1]) / n[drop];
        if (poly.some((q) => Math.abs(off(q, nA0, A.d) - off(q, nB, dB)) * Math.abs(nA0[drop]) > 0.003)) continue;
        pairs++;
        // center of the common part (not of the large triangle): brought from the projection plane back to the plane of the two faces
        const c3 = [0, 0, 0], nA = [A.nx, A.ny, A.nz];
        for (const q of poly) { c3[ax[0]] += q[0] / poly.length; c3[ax[1]] += q[1] / poly.length; }
        c3[drop] = (A.d - nA[ax[0]] * c3[ax[0]] - nA[ax[1]] * c3[ax[1]]) / nA[drop];
        const [cx, cy, cz] = c3;
        const ma = bufs[A.bi].mat, mb = bufs[B.bi].mat, mats = [ma, mb].sort().join(' + ');
        // a spot: a 2 m cell, two materials, one orientation (visibility is judged from the side of this face)
        const k = `${Math.floor(cx / 2)},${Math.floor(cz / 2)},${mats},${Math.round(A.nx * 10)},${Math.round(A.ny * 10)},${Math.round(A.nz * 10)}`;
        let h = hits.get(k); if (!h) hits.set(k, h = { x: 0, y: 0, z: 0, n: 0, area: 0, mats, same: ma === mb, dA: A.dbl, dB: B.dbl, sd: Math.sign(dot), nrm: [+A.nx.toFixed(2), +A.ny.toFixed(2), +A.nz.toFixed(2)], pts: [] });
        h.x += cx * ar; h.y += cy * ar; h.z += cz * ar; h.n += ar; h.area += ar;
        h.pts.push([ar, cx, cy, cz]); if (h.pts.length > 8) { h.pts.sort((a, b) => b[0] - a[0]); h.pts.length = 6; }
        // extent of the faces involved, per material (DETAIL=1): enough to find the object that places them
        const grow = (bb, T) => { for (let q = 0; q < 9; q++) { const k3 = q % 3; bb[k3 * 2] = Math.min(bb[k3 * 2], T.p[q]); bb[k3 * 2 + 1] = Math.max(bb[k3 * 2 + 1], T.p[q]); } };
        if (!h.bb) h.bb = {}; for (const [T, m] of [[A, ma], [B, mb]]) { const key = m + (m === ma && m === mb && T === B ? "'" : ''); if (!h.bb[key]) h.bb[key] = [1e9, -1e9, 1e9, -1e9, 1e9, -1e9]; grow(h.bb[key], T); }
      }
    }
    // seen while playing: from the eyes of a navigation network point (one in three, within 40 m), from the face's side, with no box between the two
    const N = NAV.count, seen = (h) => {
      const nx = h.nrm[0], ny = h.nrm[1], nz = h.nrm[2]; let v = 0;
      for (const [, px, py, pz] of h.pts.sort((a, b) => b[0] - a[0]).slice(0, 4)) {
        for (let i = 0; i < N && v < 5; i += 3) {
          if (NAV.comp[i] !== NAV.mainComp) continue; // a roof with no access, a closed nook: nobody stands there
          const ex = NAV.nx[i], ey = NAV.ny[i] + 1.6, ez = NAV.nz[i], dx = ex - px, dy = ey - py, dz = ez - pz, d = Math.hypot(dx, dy, dz);
          if (d > 40 || d < 0.3) continue;
          // both faces must be drawn on that side (a single-sided face turned the other way is culled)
          const f = (dx * nx + dy * ny + dz * nz) / d; if (Math.abs(f) < 0.05 || (f < 0 && !h.dA) || (f * h.sd < 0 && !h.dB)) continue;
          // aim at 5 cm in front of the face, on the eye's side: a face caught between two volumes (two adjoining buildings) stays hidden
          const k = Math.sign(f) * 0.05, qx = px + nx * k - ex, qy = py + ny * k - ey, qz = pz + nz * k - ez, dq = Math.hypot(qx, qy, qz);
          const r = rayWorld(ex, ey, ez, qx / dq, qy / dq, qz / dq, dq);
          if (!r || r.t > dq - 0.02) v++;
        }
        if (v >= 5) break;
      }
      return v;
    };
    const list = [...hits.values()].sort((a, b) => b.area - a.area).map((h, i) => ({ x: +(h.x / h.n).toFixed(1), y: +(h.y / h.n).toFixed(2), z: +(h.z / h.n).toFixed(1), area: +h.area.toFixed(3), mats: h.mats, same: h.same, nrm: h.nrm, bb: h.bb, seenBy: h.area > 0.02 || i < 300 ? seen(h) : -1 }));
    return { map, total, kept, pairs, list, bad: list.filter((h) => !h.same && h.area > 0.1 && h.seenBy > 0).length };
  }, map);
  if (json) console.log(JSON.stringify(R));
  else {
    console.log(`${R.map}: ${R.total} triangles, ${R.kept} examined, ${R.pairs} overlapping pairs, ${R.list.length} spots`);
    const L = process.env.SEEN ? R.list.filter((h) => h.seenBy > 0) : R.list;
    console.log(`${R.list.filter((h) => h.seenBy > 0).length} are seen while playing, ${R.bad} of more than 0.1 m² between two materials`);
    for (const h of L.slice(0, TOP)) {
      console.log(`${h.area.toFixed(3).padStart(7)} m²  (${h.x}, ${h.y}, ${h.z})  normal ${h.nrm.join(',')}  ${h.mats}${h.same ? '  (same material)' : ''}  ${h.seenBy > 0 ? 'seen' + (h.seenBy >= 5 ? '' : ' from ' + h.seenBy + ' point' + (h.seenBy > 1 ? 's' : '')) : h.seenBy < 0 ? '' : 'hidden'}`);
      if (process.env.DETAIL && h.bb) for (const [m, b] of Object.entries(h.bb)) console.log(`           ${m}: x ${b[0].toFixed(2)} to ${b[1].toFixed(2)}, y ${b[2].toFixed(2)} to ${b[3].toFixed(2)}, z ${b[4].toFixed(2)} to ${b[5].toFixed(2)}`);
    }
  }
  await browser.close();
  process.exit(R.bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
