/* Holes in walls and collisions bigger than the object: node slits.js [--json]   (MAP=notos; PAGE=other built version; TOP=40)
   What the player sees and what they touch must coincide. The render is read before being sent to the GPU (finalizeWorld wrapped, like
   zfight.js: the merged scenery) with the placed objects apart (MAPL.root, instances included), then checked against the collision boxes
   (COL) with rays:
   - SLIT (gap): two walls (boxes at least 2 m tall and 0.8 m long, excluding props, glass and invisible volumes) 1 to 30 cm apart,
     facing each other across a wall's thickness or at a corner, with no other box that stops bullets in the gap; if rays cross the gap
     without hitting the render, you see daylight through it without being able to pass;
   - BULLET-PASS: the same gap, but the render plugs it: the wall looks solid while bullets and the bots' view (rayWorld, on the
     boxes) go through;
   - HOLE: on a wall (at least 2 m tall and 1.5 m long, placed on the ground or on a floor), a face otherwise covered by the render
     (85 % at least), where rays fired from 25 cm in front of it (then from 1 m and 1.8 m: a bulging wall can stick out by more than 25 cm) go through the whole wall without hitting anything (more than 10 cm from the ends of the face, 25 at an inside corner
     and not only on the top row), surrounded by wall (above, or on both sides for a hole of 60 cm at most: a gable, a roof
     slope, a rounded edge are not holes): you see through a wall you cannot cross;
   - MARGIN: a box whose drawn object is set back by more than 15 cm (face covered at less than 85 %, median depth of the first
     triangle at body height, from 0.6 to 1.8 m), within 1.5 m of the bots' network: you bump into nothing and bullets stop in mid-air (tilted trunk, bulging hull,
     round post in a square box). A face stuck to another volume does not count.
   Horizontal rays, every 30 cm from 32 cm above the ground up to 2.4 m (offset from the mesh seams), every 5 cm along
   a face. Seen while playing: from the eyes (1.6 m) of a node of the main network within 25 m, in front of the face or along the axis of the
   gap, with no box between the two (rayWorld).
   Output: the gaps, bullet-passes, holes and margins, from most visible to least visible; error code if a gap, a
   bullet-pass or a visible hole remains. */
const { openGame } = require('./common');
const json = process.argv.includes('--json');
(async () => {
  const map = process.env.MAP || 'chergui', TOP = +(process.env.TOP || 40);
  const { browser, page } = await openGame({ w: 480, h: 270, page: process.env.PAGE, noMap: true, noHdri: true, settings: { quality: 'low', difficulty: 1, map } });
  const R = await page.evaluate(async (map) => {
    const bufs = [], outro = finalizeWorld;
    window.finalizeWorld = function () { for (const b of WORLD.bufs.values()) if (b.g.ni) bufs.push({ P: b.g.P.slice(0, b.g.nv * 3), I: b.g.I.slice(0, b.g.ni) }); return outro.apply(this, arguments); };
    Settings.map = map; await mapEnsure(map); LOCK.fallback = true; startMatch({}); // the navigation network: where you see from
    // objects placed outside the merged scenery (they keep their geometry), one copy per instance
    const merged = new Set(WORLD.meshes), v = new THREE.Vector3(); let things = 0;
    MAPL.root.updateMatrixWorld(true);
    MAPL.root.traverse((o) => {
      if (!o.isMesh || merged.has(o) || o.isSkinnedMesh || !o.visible) return;
      const g = o.geometry, pa = g && g.attributes && g.attributes.position; if (!pa || !pa.array) return;
      const mats = []; if (o.isInstancedMesh) for (let k = 0; k < o.count; k++) { const m = new THREE.Matrix4(); o.getMatrixAt(k, m); mats.push(m.premultiply(o.matrixWorld)); } else mats.push(o.matrixWorld);
      const n = pa.count, I = g.index && g.index.array ? Uint32Array.from(g.index.array) : Uint32Array.from({ length: n }, (_, i) => i);
      for (const M of mats) { const P = new Float32Array(n * 3); for (let i = 0; i < n; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(M); P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z; } bufs.push({ P, I }); things++; }
    });
    const inMap = (c) => c.x1 > MAP.x0 - 1 && c.x0 < MAP.x1 + 1 && c.z1 > MAP.z0 - 1 && c.z0 < MAP.z1 + 1;
    const solids = COL.filter((c) => !c.prop && !c.ray && !c.inv && c.m !== 'glass' && c.y1 - c.y0 >= 1.2 && inMap(c)); // a pane of glass can be seen through
    const key = (i, j) => (i + 5000) * 100003 + j + 5000;
    // Möller-Trumbore, two faces: distance along the ray, or -1
    const hit = (o, d, L, P, I, t) => {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2], e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
      const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x, det = e1x * px + e1y * py + e1z * pz;
      if (Math.abs(det) < 1e-9) return -1;
      const inv = 1 / det, tx = o[0] - P[a], ty = o[1] - P[a + 1], tz = o[2] - P[a + 2], u = (tx * px + ty * py + tz * pz) * inv; if (u < -1e-6 || u > 1 + 1e-6) return -1;
      const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, w = (d[0] * qx + d[1] * qy + d[2] * qz) * inv; if (w < -1e-6 || u + w > 1 + 1e-6) return -1;
      const s = (e2x * qx + e2y * qy + e2z * qz) * inv; return s >= 0 && s <= L ? s : -1;
    };
    // triangles per 1 m cell, only around the boxes examined (the sky, the sea and the very large triangles are never a wall)
    const near = new Set(); for (const c of solids) for (let i = Math.floor(c.x0 - 0.6); i <= Math.floor(c.x1 + 0.6); i++) for (let j = Math.floor(c.z0 - 0.6); j <= Math.floor(c.z1 + 0.6); j++) near.add(key(i, j));
    const TB = new Map(); let triangles = 0;
    for (let bi = 0; bi < bufs.length; bi++) {
      const { P, I } = bufs[bi];
      for (let t = 0; t < I.length; t += 3) {
        triangles++;
        const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
        const x0 = Math.floor(Math.min(P[a], P[b], P[c])), x1 = Math.floor(Math.max(P[a], P[b], P[c])), z0 = Math.floor(Math.min(P[a + 2], P[b + 2], P[c + 2])), z1 = Math.floor(Math.max(P[a + 2], P[b + 2], P[c + 2]));
        if ((x1 - x0 + 1) * (z1 - z0 + 1) > 4000) continue;
        for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const k = key(i, j); if (!near.has(k)) continue; let l = TB.get(k); if (!l) TB.set(k, l = []); l.push(bi, t); }
      }
    }
    // first triangle hit by a horizontal segment (cells crossed, on either side of the limits)
    const cast = (o, d, L) => {
      const ks = new Set();
      for (let s = -0.05; s <= L + 0.05; s += 0.5) for (const e of [-0.02, 0.02]) { const x = o[0] + d[0] * Math.min(s, L) + (d[2] ? e : 0), z = o[2] + d[2] * Math.min(s, L) + (d[0] ? e : 0); ks.add(key(Math.floor(x), Math.floor(z))); }
      for (const e of [-0.02, 0.02]) ks.add(key(Math.floor(o[0] + d[0] * L + (d[2] ? e : 0)), Math.floor(o[2] + d[2] * L + (d[0] ? e : 0))));
      let best = -1;
      for (const k of ks) { const l = TB.get(k); if (!l) continue; for (let n = 0; n < l.length; n += 2) { const b = bufs[l[n]], s = hit(o, d, L, b.P, b.I, l[n + 1]); if (s >= 0 && (best < 0 || s < best)) best = s; } }
      return best;
    };
    const main = (id) => NAV.comp[id] === NAV.mainComp;
    // seen while playing: eyes of a node of the main network within 25 m, in a cone around the given axis, with no box between the two
    const seen = (x, y, z, ax, az, cosMin, both) => {
      let n = 0, best = null;
      for (let i = 0; i < NAV.count && n < 8; i++) {
        if (!main(i)) continue;
        const ex = NAV.nx[i], ey = NAV.ny[i] + 1.6, ez = NAV.nz[i], dx = x - ex, dy = y - ey, dz = z - ez, d = Math.hypot(dx, dy, dz);
        if (d > 25 || d < 0.3) continue;
        const f = -(dx * ax + dz * az) / Math.hypot(dx, dz); if ((both ? Math.abs(f) : f) < cosMin) continue;
        const r = rayWorld(ex, ey, ez, dx / d, dy / d, dz / d, d);
        if (!r || r.t > d - 0.3) { n++; if (!best || d < best[3]) best = [+ex.toFixed(1), +NAV.ny[i].toFixed(1), +ez.toFixed(1), +d.toFixed(1)]; }
      }
      return { seenBy: n, fromPos: best };
    };
    const inBox = (x, y, z, self) => COL.some((c) => c !== self && !c.ray && x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1 && y > c.y0 && y < c.y1);
    const box = (c) => [c.x0, c.x1, c.y0, c.y1, c.z0, c.z1].map((t) => +t.toFixed(2));

    /* ---- Gaps between two walls ---- */
    const G = new Map();
    solids.forEach((c, id) => { for (let i = Math.floor((c.x0 - 0.3) / 2); i <= Math.floor((c.x1 + 0.3) / 2); i++) for (let j = Math.floor((c.z0 - 0.3) / 2); j <= Math.floor((c.z1 + 0.3) / 2); j++) { const k = key(i, j); let l = G.get(k); if (!l) G.set(k, l = []); l.push(id); } });
    const pairs = new Set(), slits = [], passThrough = [];
    const isWall = (c) => c.y1 - c.y0 >= 2 && Math.max(c.x1 - c.x0, c.z1 - c.z0) >= 0.8;
    const stopsBullets = (x, y, z, A, B) => COL.some((c) => c !== A && c !== B && !c.noRay && x >= c.x0 - 0.005 && x <= c.x1 + 0.005 && z >= c.z0 - 0.005 && z <= c.z1 + 0.005 && y >= c.y0 && y <= c.y1);
    for (const l of G.values()) for (let a = 0; a < l.length; a++) for (let b = a + 1; b < l.length; b++) {
      const ia = Math.min(l[a], l[b]), ib = Math.max(l[a], l[b]), pk = ia * 1e6 + ib; if (pairs.has(pk)) continue; pairs.add(pk);
      const A = solids[ia], B = solids[ib], y0 = Math.max(A.y0, B.y0), y1 = Math.min(A.y1, B.y1); if (y1 - y0 < 0.8) continue;
      if (!isWall(A) || !isWall(B)) continue; // a post, a street lamp near a wall: not a gap
      const gx = Math.max(A.x0, B.x0) - Math.min(A.x1, B.x1), gz = Math.max(A.z0, B.z0) - Math.min(A.z1, B.z1);
      let f = null; // gap (x0..x1, z0..z1) and direction of the view through it
      if (gx >= 0.01 && gx <= 0.3 && gz < -0.05 && -gz <= 1.2) f = { g: gx, x0: Math.min(A.x1, B.x1), x1: Math.max(A.x0, B.x0), z0: Math.max(A.z0, B.z0), z1: Math.min(A.z1, B.z1), d: [0, 0, 1] };
      else if (gz >= 0.01 && gz <= 0.3 && gx < -0.05 && -gx <= 1.2) f = { g: gz, x0: Math.max(A.x0, B.x0), x1: Math.min(A.x1, B.x1), z0: Math.min(A.z1, B.z1), z1: Math.max(A.z0, B.z0), d: [1, 0, 0] };
      else if (gx >= 0.01 && gz >= 0.01 && Math.hypot(gx, gz) <= 0.3) { const x0 = Math.min(A.x1, B.x1), x1 = Math.max(A.x0, B.x0), z0 = Math.min(A.z1, B.z1), z1 = Math.max(A.z0, B.z0), l2 = Math.hypot(x1 - x0, z1 - z0); f = { g: l2, x0, x1, z0, z1, d: [-(z1 - z0) / l2, 0, (x1 - x0) / l2], corner: true }; }
      if (!f) continue;
      const cx = (f.x0 + f.x1) / 2, cz = (f.z0 + f.z1) / 2;
      if (stopsBullets(cx, Math.min(y1 - 0.2, y0 + 1.4), cz, A, B)) continue; // another box plugs the gap
      let pass = 0, tot = 0; const hs = [];
      for (let y = y0 + 0.217; y <= Math.min(y1 - 0.1, y0 + 3); y += 0.3) for (const k of f.corner ? [0.5] : [0.25, 0.5, 0.75]) {
        const px = f.d[0] ? cx : f.x0 + (f.x1 - f.x0) * k, pz = f.d[0] ? f.z0 + (f.z1 - f.z0) * k : cz, L = f.corner ? 1.6 : (f.d[0] ? f.x1 - f.x0 : f.z1 - f.z0) + 0.8;
        const o = f.corner ? [px - f.d[0] * 0.8, y, pz - f.d[2] * 0.8] : [px - f.d[0] * (cx - f.x0 + 0.4), y, pz - f.d[2] * (cz - f.z0 + 0.4)];
        tot++; if (cast(o, f.d, L) < 0) { pass++; hs.push(+y.toFixed(2)); }
      }
      if (!pass) { passThrough.push({ x: +cx.toFixed(2), z: +cz.toFixed(2), deviation: Math.round(f.g * 100), h: [+y0.toFixed(2), +y1.toFixed(2)], mats: A.m + '+' + B.m, ...seen(cx, Math.min(y1 - 0.2, y0 + 1.4), cz, f.d[0], f.d[2], 0.5, true) }); continue; }
      const s = seen(cx, hs[Math.floor(hs.length / 2)], cz, f.d[0], f.d[2], 0.5, true);
      slits.push({ x: +cx.toFixed(2), z: +cz.toFixed(2), deviation: Math.round(f.g * 100), h: [+y0.toFixed(2), +y1.toFixed(2)], rayCount: pass + '/' + tot, mats: A.m + '+' + B.m, ...s });
    }

    /* ---- Faces: holes and margins ---- */
    const wallHoles = [], margins = [];
    for (const c of solids) {
      const wallSeg = c.y1 - c.y0 >= 2;
      for (const [ax, sg] of [['x', -1], ['x', 1], ['z', -1], ['z', 1]]) {
        const f = ax === 'x' ? (sg < 0 ? c.x0 : c.x1) : (sg < 0 ? c.z0 : c.z1), u0 = ax === 'x' ? c.z0 : c.x0, u1 = ax === 'x' ? c.z1 : c.x1, th = ax === 'x' ? c.x1 - c.x0 : c.z1 - c.z0, len = u1 - u0;
        if (len < 0.15) continue;
        const d = ax === 'x' ? [-sg, 0, 0] : [0, 0, -sg], step = Math.max(0.05, len / 300);
        let tot = 0, cov = 0, top = -1e9, ui = -1; const through = [], depth = [], grid = new Map(); // grid: cell (index along the face, row) -> 1 covered, 2 crossed
        { const [gx, gz] = ax === 'x' ? [f + sg * 0.3, (u0 + u1) / 2] : [(u0 + u1) / 2, f + sg * 0.3]; if (c.y0 > groundHeight(gx, gz, c.y0 + 0.3, 0.05) + 1) continue; } // box in the air seen from this side (floor, roof): out of reach
        for (let u = u0 + 0.043; u <= u1 - 0.04; u += step) {
          ui++; let yi = -1;
          const at = (n) => (ax === 'x' ? [f + sg * n, u] : [u, f + sg * n]);
          const [gx, gz] = at(0.1), g = Math.max(c.y0, groundHeight(gx, gz, Math.min(c.y1, c.y0 + 2.5), 0.05));
          for (let y = g + 0.317; y <= Math.min(c.y1 - 0.05, g + 2.4); y += 0.3) {
            top = Math.max(top, y - g); yi++;
            const [px, pz] = at(0.08); if (inBox(px, y, pz, c)) continue; // face stuck to another volume: hidden
            const [ox, oz] = at(0.25); tot++;
            const s = cast([ox, y, oz], d, 0.25 + th + 0.25);
            if (s >= 0 && s <= 0.6) { cov++; grid.set(ui * 64 + yi, 1); continue; }
            // bulging wall of more than 25 cm (rock, hull): the ray started from inside; it is cast again from 1 m then 1.8 m in front of the face
            if (s < 0 && [1.0, 1.8].some((n) => { const [qx, qz] = at(n), s2 = cast([qx, y, qz], d, n + th + 0.25); return s2 >= 0 && s2 <= n - 0.25; })) { cov++; grid.set(ui * 64 + yi, 1); continue; }
            const bodypart = y - g > 0.55 && y - g < 1.9; // the margin only counts at body height (under a hull on blocks, you do not bump)
            if (s < 0) { through.push([u, y, bodypart, y - g, ui, yi]); grid.set(ui * 64 + yi, 2); } else if (bodypart) depth.push(s - 0.25);
          }
        }
        if (!tot || cov === tot) continue;
        const rate = cov / tot, mid = (u0 + u1) / 2, ctr = ax === 'x' ? [f + sg * 0.05, mid] : [mid, f + sg * 0.05];
        if (rate >= 0.85) {
          if (!wallSeg || len < 1.5) continue;
          // at an inside corner (another volume extends the face), a rock's wall folds back there: 25 cm of margin instead of 10
          const fitsIn = (u) => inBox(...(ax === 'x' ? [f + sg * 0.3, c.y0 + 1.5, u] : [u, c.y0 + 1.5, f + sg * 0.3]), c);
          const m0 = fitsIn(u0 - 0.05) ? 0.25 : 0.1, m1 = fitsIn(u1 + 0.05) ? 0.25 : 0.1;
          const pts = through.filter(([u, , , h]) => u > u0 + m0 && u < u1 - m1 && h < top - 0.01); if (!pts.length) continue;
          pts.sort((a, b) => a[0] - b[0]);
          const runs = []; let r = null;
          for (const [u, y, , , i, j] of pts) { if (r && u - r.u1 <= step * 2.1) { r.u1 = u; r.y0 = Math.min(r.y0, y); r.y1 = Math.max(r.y1, y); r.n++; r.pts.push([i, j]); } else runs.push(r = { u0: u, u1: u, y0: y, y1: y, n: 1, pts: [[i, j]] }); }
          // a hole is surrounded by wall: wall above it, or, if it is narrow (60 cm at most), wall on both sides; otherwise it is the
          // top of the box that sticks out of the object (gable, roof slope, parapet lower than its box)
          const covered = (i, j) => grid.get(i * 64 + j) === 1;
          const enclosed = (q) => {
            const cols = new Map(); for (const [i, j] of q.pts) cols.set(i, Math.max(cols.has(i) ? cols.get(i) : -1, j));
            let above = 0; for (const [i, jm] of cols) { for (let j = jm + 1; j < 64; j++) { const v = grid.get(i * 64 + j); if (v === undefined) break; if (v === 1) { above++; break; } } }
            if (above >= cols.size * 0.6) return true;
            if (q.u1 - q.u0 > 0.6) return false;
            const i0 = Math.min(...cols.keys()), i1 = Math.max(...cols.keys()), rows = [...new Set(q.pts.map((t) => t[1]))];
            const side = (i) => rows.filter((j) => covered(i, j)).length >= rows.length * 0.6;
            return (side(i0 - 1) || side(i0 - 2)) && (side(i1 + 1) || side(i1 + 2));
          };
          for (const q of runs) {
            if (!enclosed(q) || q.pts.every(([, j]) => j === 0)) continue; // bottom row only: an object on blocks, you can see underneath
            const um = (q.u0 + q.u1) / 2, [x, z] = ax === 'x' ? [f + sg * 0.05, um] : [um, f + sg * 0.05];
            wallHoles.push({ x: +x.toFixed(2), z: +z.toFixed(2), face: (sg > 0 ? '+' : '-') + ax, wide: +(q.u1 - q.u0 + step).toFixed(2), h: [+q.y0.toFixed(2), +q.y1.toFixed(2)], rayCount: q.n, coverage: Math.round(rate * 100), mat: c.m, boxDesc: box(c), ...seen(x, (q.y0 + q.y1) / 2, z, ax === 'x' ? sg : 0, ax === 'z' ? sg : 0, 0.2) });
          }
        } else {
          // the drawn object is set back: median margin (with nothing behind, the full thickness)
          const all = depth.concat(through.filter((t) => t[2]).map(() => th)).sort((a, b) => a - b), med = all[Math.floor(all.length / 2)];
          if (!all.length || med <= 0.15) continue;
          // can the player bump into it: a node of the main network in front of the face, within 1.5 m, at the level of the box's foot
          let nearShare = false;
          for (let i = 0; i < NAV.count && !nearShare; i++) {
            if (!main(i) || Math.abs(NAV.ny[i] - c.y0) > 1) continue;
            const n = ((ax === 'x' ? NAV.nx[i] : NAV.nz[i]) - f) * sg, w = ax === 'x' ? NAV.nz[i] : NAV.nx[i];
            if (n >= 0 && Math.hypot(n, Math.max(0, u0 - w, w - u1)) <= 1.5) nearShare = true;
          }
          if (!nearShare) continue;
          margins.push({ x: +ctr[0].toFixed(2), z: +ctr[1].toFixed(2), face: (sg > 0 ? '+' : '-') + ax, leeway: +Math.min(med, th).toFixed(2), isEmpty: med >= th, coverage: Math.round(rate * 100), mat: c.m, boxDesc: box(c) });
        }
      }
    }
    // one margin per box (its worst face)
    const mb = new Map(); for (const m of margins) { const k = m.boxDesc.join(','); const o = mb.get(k); if (!o || m.leeway > o.leeway) mb.set(k, m); }
    slits.sort((a, b) => b.seenBy - a.seenBy || parseInt(b.rayCount) - parseInt(a.rayCount));
    // a hole goes through the wall: seen from its two faces, it only counts once
    const tk = new Map(); for (const t of wallHoles) { const k = t.boxDesc.join(',') + '|' + t.face[1] + '|' + (t.face[1] === 'x' ? t.z : t.x).toFixed(1); const o = tk.get(k); if (!o || t.seenBy > o.seenBy) tk.set(k, t); }
    wallHoles.length = 0; wallHoles.push(...tk.values());
    wallHoles.sort((a, b) => b.seenBy - a.seenBy || b.rayCount - a.rayCount);
    passThrough.sort((a, b) => b.seenBy - a.seenBy);
    return { map, wallSegs: solids.length, triangles, things, slits, passThrough, wallHoles, margins: [...mb.values()].sort((a, b) => b.leeway - a.leeway) };
  }, map);
  const vf = R.slits.filter((f) => f.seenBy), vp = R.passThrough.filter((f) => f.seenBy), vt = R.wallHoles.filter((t) => t.seenBy);
  if (json) console.log(JSON.stringify(R));
  else {
    console.log(`${R.map}: ${R.wallSegs} boxes examined, ${R.triangles} triangles (${R.things} placed objects)`);
    console.log(`gaps between two walls you can see through: ${R.slits.length} (${vf.length} visible while playing)`);
    const at = (o) => (o.seenBy ? `seen from ${o.seenBy}${o.seenBy >= 8 ? '+' : ''} point${o.seenBy > 1 ? 's' : ''}, e.g. ${JSON.stringify(o.fromPos)}` : 'hidden');
    for (const f of R.slits.slice(0, TOP)) console.log(`  SLIT (${f.x}, ${f.z}) ${f.deviation} cm, h ${f.h[0]} to ${f.h[1]}, rays passing through ${f.rayCount}, ${f.mats}  ${at(f)}`);
    console.log(`bullet-passes (the wall looks solid, bullets and the bots' view go through): ${R.passThrough.length} (${vp.length} in a player's view)`);
    for (const f of R.passThrough.slice(0, TOP)) console.log(`  BULLET-PASS (${f.x}, ${f.z}) ${f.deviation} cm, h ${f.h[0]} to ${f.h[1]}, ${f.mats}  ${at(f)}`);
    console.log(`holes in a wall (you see through a wall you cannot cross): ${R.wallHoles.length} (${vt.length} visible while playing)`);
    for (const t of R.wallHoles.slice(0, TOP)) console.log(`  HOLE (${t.x}, ${t.z}) face ${t.face}, ${t.wide} m wide, h ${t.h[0]} to ${t.h[1]} (${t.rayCount} rays, face covered at ${t.coverage} %) ${t.mat} box ${JSON.stringify(t.boxDesc)}  ${at(t)}`);
    console.log(`boxes bigger than the object, at the edge of the network (margin over 15 cm): ${R.margins.length}`);
    for (const m of R.margins.slice(0, TOP)) console.log(`  MARGIN ${m.leeway} m${m.isEmpty ? " (the object fills less than half of its box)" : ''} (${m.x}, ${m.z}) face ${m.face}, covered at ${m.coverage} %, ${m.mat} box ${JSON.stringify(m.boxDesc)}`);
  }
  await browser.close();
  process.exit(vf.length || vp.length || vt.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
