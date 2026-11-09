/* Top-down plan of a map: level design is thought out on a plan before generating any asset, and then we check that the
   built map follows this plan.
   - Sketch (before building): node plan.js sketches/<name>.js [x0 x1 z0 z1]
     The file describes the planned map (format detailed at the top of sketches/example-sirocco-north.js): objects (existing prefab, whose
     footprint and collisions are read from the model, or rectangle, circle, polygon described by hand, with their height), overhanging roofs and
     guy lines, tarps on poles, ramps, clotheslines, water and relief in broad strokes, spawns, domination points,
     routes, zones. Checks: two objects that overlap; an object inside the guy lines, under the tarp or under another's overhang (unless
     it is marked underCover); a passage of less than 0.85 m (nobody gets through: butt the two objects together or space them apart) or of less than
     1.2 m (bots do not always get through); a spawn within 0.6 m of an obstacle; a domination point whose 5.5 m disc is less than 70%
     walkable, and its cover at 9 m; an object outside the zone circle. The map is not built: the
     game is only loaded to read the prefabs.
   - Survey (built map): MAP=sirocco node plan.js [x0 x1 z0 z1]
     Collision boxes colored by height, footprint and name of the placed objects, bot network (elevated nodes in blue, outside the main
     network in red), relief as contour lines, water, ramps, spawns, domination and interest points, minimap zones,
     zone circle. It is compared to the sketch; decor.js, navigation.js and leveldesign.js measure the rest.
   The four optional bounds add an enlargement of this window. Output: plans/<name>.png (and <name>-zoom.png) next to this
   file, ignored by git; the defects in the console, with their number on the plan; error code if there is an overlap, an object
   in another's guy lines, a crowded spawn or a point that is too crowded.
   North (+z) at the top, x to the right, one grid cell is 1 m (heavier line every 5 m, label every 10 m). */
const fs = require('fs'), path = require('path');
const { openGame, HERE } = require('./common');

const args = process.argv.slice(2), file = args.find((a) => /\.js$/.test(a)), win = args.filter((a) => /^-?\d+(\.\d+)?$/.test(a)).map(Number);
const OUT = path.join(HERE, 'plans');

/* ---------- Geometry: convex polygons of the plan, vertices [x, z] ---------- */
/* Rectangle w x d centered at (x, z), rotated by rot like DECOR.place (rotY): local x -> (cos, -sin), local z -> (sin, cos) */
function rectAt(x, z, rot, x0, x1, z0, z1) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([lx, lz]) => [x + lx * c + lz * s, z - lx * s + lz * c]);
}
const ring = (cx, cz, rx, rz, n = 16) => Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * 2 * Math.PI) * rx, cz + Math.sin((i / n) * 2 * Math.PI) * rz]);
function axesOf(P) { const A = []; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; A.push([-(b[1] - a[1]) / l, (b[0] - a[0]) / l]); } return A; }
function proj(P, ax) { let lo = 1e9, hi = -1e9; for (const p of P) { const v = p[0] * ax[0] + p[1] * ax[1]; lo = Math.min(lo, v); hi = Math.max(hi, v); } return [lo, hi]; }
function segDist(p, a, b) { const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L)); return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t); }
/* Distance between two convex polygons: positive if they are separate (exact), negative if they overlap (minimal penetration) */
function polyGap(A, B) {
  let pen = 1e9;
  for (const ax of axesOf(A).concat(axesOf(B))) {
    const [a0, a1] = proj(A, ax), [b0, b1] = proj(B, ax), o = Math.min(a1, b1) - Math.max(a0, b0);
    if (o <= 0) { pen = null; break; }
    pen = Math.min(pen, o);
  }
  if (pen !== null) return -pen;
  let d = 1e9;
  for (const [P, Q] of [[A, B], [B, A]]) for (const p of P) for (let i = 0; i < Q.length; i++) d = Math.min(d, segDist(p, Q[i], Q[(i + 1) % Q.length]));
  return d;
}
const inPoly = (P, x, z) => { for (const ax of axesOf(P)) { const [lo, hi] = proj(P, ax), v = x * ax[0] + z * ax[1]; if (v < lo || v > hi) return false; } return true; };
const centerOf = (P) => [P.reduce((s, p) => s + p[0], 0) / P.length, P.reduce((s, p) => s + p[1], 0) / P.length];

/* ---------- Drawing (in the page: separate 2D canvas, never the game's WebGL canvas) ---------- */
function drawPlan(S) {
  const [X0, X1, Z0, Z1] = S.bounds, k = S.ppm, pad = 34, W = Math.round((X1 - X0) * k) + pad * 2, H = Math.round((Z1 - Z0) * k) + pad * 2 + 70;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const px = (x) => pad + (x - X0) * k, pz = (z) => pad + 70 + (Z1 - z) * k;
  const poly = (P, fill, stroke, lw = 1, dash = null) => { g.beginPath(); P.forEach(([x, z], i) => (i ? g.lineTo(px(x), pz(z)) : g.moveTo(px(x), pz(z)))); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.setLineDash(dash || []); g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); g.setLineDash([]); } };
  const text = (s, x, z, col = '#222', size = 11, bold = false, align = 'center') => { g.font = `${bold ? 'bold ' : ''}${size}px sans-serif`; g.textAlign = align; g.textBaseline = 'middle'; g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.85)'; g.strokeText(s, px(x), pz(z)); g.fillStyle = col; g.fillText(s, px(x), pz(z)); };
  // height above the ground: step, low cover (we shoot over it), high cover, above head height; upper floor (raised floor)
  const hcol = (h, b) => (b > 2 ? 'rgba(70,120,210,0.28)' : h <= 0.35 ? 'rgba(200,190,170,0.55)' : h <= 1.3 ? '#e2b54a' : h <= 2.4 ? '#cf7432' : '#6e3d2c');
  g.fillStyle = '#f3ead8'; g.fillRect(0, 0, W, H);
  // relief: tint by height, contour lines every meter (heavier every 5 m)
  if (S.relief) {
    const R = S.relief, at = (i, j) => R.h[j * R.n + i];
    let lo = 1e9, hi = -1e9; for (const v of R.h) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    for (let j = 0; j < R.m; j++) for (let i = 0; i < R.n; i++) { const t = (at(i, j) - lo) / Math.max(1, hi - lo), l = Math.round(238 - t * 70); g.fillStyle = `rgb(${l + 6},${l - 8},${l - 34})`; g.fillRect(px(R.x0 + i - 0.5), pz(R.z0 + j + 0.5), k + 1, k + 1); }
    g.lineWidth = 1;
    for (let j = 0; j < R.m; j++) for (let i = 0; i < R.n; i++) {
      const a = Math.floor(at(i, j));
      for (const [di, dj] of [[1, 0], [0, 1]]) {
        if (i + di >= R.n || j + dj >= R.m) continue; const b = Math.floor(at(i + di, j + dj)); if (a === b) continue;
        const lv = Math.max(a, b); g.strokeStyle = lv % 5 === 0 ? 'rgba(120,70,30,0.7)' : 'rgba(140,90,40,0.35)';
        const x = R.x0 + i + di * 0.5, z = R.z0 + j + dj * 0.5; g.beginPath();
        if (di) { g.moveTo(px(x), pz(z - 0.5)); g.lineTo(px(x), pz(z + 0.5)); } else { g.moveTo(px(x - 0.5), pz(z)); g.lineTo(px(x + 0.5), pz(z)); }
        g.stroke();
      }
    }
  }
  // grid: 1 m, 5 m, label every 10 m
  for (let x = Math.ceil(X0); x <= X1; x++) { g.strokeStyle = x % 10 === 0 ? 'rgba(90,70,50,0.45)' : x % 5 === 0 ? 'rgba(90,70,50,0.25)' : 'rgba(90,70,50,0.08)'; g.lineWidth = 1; g.beginPath(); g.moveTo(px(x), pz(Z0)); g.lineTo(px(x), pz(Z1)); g.stroke(); if (x % 10 === 0) text(String(x), x, Z1 + 12 / k, '#7a6a55', 10); }
  for (let z = Math.ceil(Z0); z <= Z1; z++) { g.strokeStyle = z % 10 === 0 ? 'rgba(90,70,50,0.45)' : z % 5 === 0 ? 'rgba(90,70,50,0.25)' : 'rgba(90,70,50,0.08)'; g.lineWidth = 1; g.beginPath(); g.moveTo(px(X0), pz(z)); g.lineTo(px(X1), pz(z)); g.stroke(); if (z % 10 === 0) text(String(z), X0 - 14 / k, z, '#7a6a55', 10); }
  for (const P of S.water || []) poly(P, 'rgba(70,140,190,0.45)', 'rgba(40,100,150,0.8)', 1);
  for (const T of S.terrain || []) { poly(T.poly, 'rgba(190,140,80,0.18)', 'rgba(150,100,50,0.6)', 1, [6, 4]); if (T.n) text(T.n, T.c[0], T.c[1], '#7a4a20', 11, false); }
  if (S.ring) { for (const [r, c, d] of [[S.ring.r, '#b03020', null], [S.ring.hard, '#b03020', [8, 6]]]) { if (!r || r > 1e5) continue; g.beginPath(); g.arc(px(S.ring.x), pz(S.ring.z), r * k, 0, 2 * Math.PI); g.setLineDash(d || []); g.lineWidth = 2; g.strokeStyle = c; g.stroke(); g.setLineDash([]); } }
  for (const [n, x0, x1, z0, z1] of S.zones || []) { poly([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], null, 'rgba(60,60,140,0.5)', 1, [3, 5]); text(n, x0 + 0.4, z1 - 0.8, 'rgba(50,50,130,0.9)', 11, true, 'left'); }
  if (S.nav) for (const [x, z, c] of S.nav) { if (c === 0) { g.fillStyle = 'rgba(60,140,60,0.45)'; g.fillRect(px(x) - 1, pz(z) - 1, 2, 2); } else if (c === 1) { g.fillStyle = 'rgba(40,90,220,0.9)'; g.fillRect(px(x) + 1, pz(z) - 4, 3, 3); } else { g.strokeStyle = 'rgba(220,30,30,0.9)'; g.lineWidth = 1; g.beginPath(); g.moveTo(px(x) - 2, pz(z) - 2); g.lineTo(px(x) + 2, pz(z) + 2); g.moveTo(px(x) + 2, pz(z) - 2); g.lineTo(px(x) - 2, pz(z) + 2); g.stroke(); } }
  // collision boxes (survey), the tallest on top
  for (const [x0, x1, z0, z1, h, b, kd] of (S.boxes || []).slice().sort((p, q) => p[4] - q[4])) {
    const P = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    if (kd === 'ray') poly(P, null, 'rgba(140,60,170,0.8)', 1, [2, 2]); else if (kd === 'prop') poly(P, 'rgba(120,120,120,0.75)', 'rgba(60,60,60,0.8)', 0.5); else poly(P, hcol(h, b), b > 2 ? 'rgba(40,80,170,0.5)' : null, 0.5);
  }
  for (const R of S.ramps || []) { poly([[R[0], R[2]], [R[1], R[2]], [R[1], R[3]], [R[0], R[3]]], 'rgba(150,110,60,0.35)', '#7a5a30', 1); const up = R[4]; const cx = (R[0] + R[1]) / 2, cz = (R[2] + R[3]) / 2, L = (up === 'x' ? R[1] - R[0] : R[3] - R[2]) * 0.35 * R[5]; g.strokeStyle = '#5a3a10'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(px(cx - (up === 'x' ? L : 0)), pz(cz - (up === 'z' ? L : 0))); g.lineTo(px(cx + (up === 'x' ? L : 0)), pz(cz + (up === 'z' ? L : 0))); g.stroke(); text('rises', cx + (up === 'x' ? L : 0), cz + (up === 'z' ? L : 0), '#5a3a10', 9); }
  // objects (sketch: solid fills colored by height, overhangs dashed; survey: footprint in thin dashes)
  // rework: what is removed from the survey (hatched in red, crossed out)
  for (const R of S.removed || []) { const P = [[R[0], R[2]], [R[1], R[2]], [R[1], R[3]], [R[0], R[3]]]; poly(P, 'rgba(220,30,30,0.16)', '#d02020', 2, [6, 4]); g.strokeStyle = '#d02020'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(px(R[0]), pz(R[2])); g.lineTo(px(R[1]), pz(R[3])); g.moveTo(px(R[1]), pz(R[2])); g.lineTo(px(R[0]), pz(R[3])); g.stroke(); }
  for (const o of S.shapes || []) {
    if (o.zone) poly(o.zone, o.isEmpty ? 'rgba(60,150,70,0.12)' : null, o.isEmpty ? 'rgba(40,120,50,0.9)' : 'rgba(40,120,50,0.7)', 1, [5, 3]);
    for (const P of o.solids || []) poly(P, o.outline ? null : hcol(o.h, 0), o.prop ? '#d0108a' : o.outline ? 'rgba(70,50,40,0.6)' : 'rgba(40,30,20,0.85)', o.prop ? 3 : 1, o.outline ? [3, 3] : null);
  }
  for (const o of S.shapes || []) if (o.label) text(o.label, o.lx, o.lz, o.prop ? '#a0006a' : '#2a1a10', o.small ? 9 : 11, !!o.prop);
  for (const L of S.lanes || []) { g.strokeStyle = L.c; g.lineWidth = 3; g.setLineDash([10, 6]); g.beginPath(); L.pts.forEach(([x, z], i) => (i ? g.lineTo(px(x), pz(z)) : g.moveTo(px(x), pz(z)))); g.stroke(); g.setLineDash([]); const m = L.pts[Math.floor(L.pts.length / 2)]; text(L.n, m[0], m[1], L.c, 13, true); }
  for (const [x, z, t] of S.spawns || []) { g.fillStyle = t ? '#c0392b' : '#2f6fd0'; g.fillRect(px(x) - 4, pz(z) - 4, 8, 8); g.strokeStyle = '#fff'; g.lineWidth = 1; g.strokeRect(px(x) - 4, pz(z) - 4, 8, 8); }
  for (const [x, z, n] of S.domOld || []) { g.beginPath(); g.arc(px(x), pz(z), 5.5 * k, 0, 2 * Math.PI); g.setLineDash([4, 4]); g.lineWidth = 1.5; g.strokeStyle = 'rgba(90,90,90,0.8)'; g.stroke(); g.setLineDash([]); text(n + ' before', x, z, '#777', 13, true); }
  for (const [x, z, n] of S.dom || []) { g.beginPath(); g.arc(px(x), pz(z), 5.5 * k, 0, 2 * Math.PI); g.fillStyle = 'rgba(240,200,40,0.12)'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#c99a00'; g.stroke(); g.beginPath(); g.arc(px(x), pz(z), 9 * k, 0, 2 * Math.PI); g.setLineDash([2, 4]); g.lineWidth = 1; g.stroke(); g.setLineDash([]); text(n, x, z, '#8a6a00', 16, true); }
  const LC = { L: '#2a8a4a', M: '#c26a00', E: '#7a3ab0' };
  for (const [x, z, lane, hold, high] of S.poi || []) { g.save(); g.translate(px(x), pz(z)); g.rotate(Math.PI / 4); g.fillStyle = hold ? LC[lane] || '#444' : '#fff'; g.strokeStyle = LC[lane] || '#444'; g.lineWidth = 1.5; g.fillRect(-3.5, -3.5, 7, 7); g.strokeRect(-3.5, -3.5, 7, 7); g.restore(); if (high) text('h', x + 6 / k, z + 6 / k, LC[lane] || '#444', 9, true); }
  for (const [x, z, i] of S.issues || []) { g.beginPath(); g.arc(px(x), pz(z), 9, 0, 2 * Math.PI); g.lineWidth = 2.5; g.strokeStyle = '#e01010'; g.stroke(); text(String(i), x + 11 / k, z + 11 / k, '#e01010', 12, true); }
  // title and legend
  g.fillStyle = 'rgba(255,255,255,0.92)'; g.fillRect(0, 0, W, 64);
  g.font = 'bold 15px sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#222'; g.fillText(S.title, 10, 14);
  const items = [['rgba(200,190,170,0.9)', 'walking'], ['#e2b54a', 'low cover (1.3 m)'], ['#cf7432', 'high cover (2.4 m)'], ['#6e3d2c', 'higher'], ['rgba(70,120,210,0.5)', 'upper floor'], ['rgba(120,120,120,0.9)', 'prop'], ['rgba(70,140,190,0.6)', 'water']];
  let lx = 10; g.font = '11px sans-serif';
  for (const [c, n] of items) { g.fillStyle = c; g.fillRect(lx, 30, 12, 12); g.fillStyle = '#333'; g.fillText(n, lx + 16, 36); lx += 22 + g.measureText(n).width; }
  g.fillStyle = '#333'; g.fillText("green dashes: guy lines, roof, tarp; squares: spawns (blue Alpha, red Bravo); yellow circle: domination point (5.5 m, 9 m); diamonds: points of interest; " + (S.nav ? 'dots: bot network (blue when elevated, red cross outside the network); ' : '') + '1 square = 1 m, north at the top', 10, 54);
  return cv.toDataURL('image/png');
}

/* ---------- Sketch: objects from the file to polygons ---------- */
function sketch(E, PF) {
  const items = [], mir = E.mirrorAxis === 'z';
  const objs = (E.things || []).flatMap((o) => (mir && !o.onAxis ? [o, mirror(o)] : [o]));
  for (const o of objs) items.push(...toItems(o, PF));
  const spawns = [...(E.spawnPoints?.alpha || []).map(([x, z]) => [x, z, 0]), ...(E.spawnPoints?.bravo || (mir ? (E.spawnPoints?.alpha || []).map(([x, z]) => [x, -z]) : [])).map(([x, z]) => [x, z, 1])];
  const lanes = (E.routes || []).flatMap((L) => (mir && !L.onAxis ? [L, { ...L, n: L.n, pts: L.pts.map(([x, z]) => [x, -z]) }] : [L])).map((L) => ({ n: L.n, pts: L.pts, c: L.c || { L: '#2a8a4a', M: '#c26a00', E: '#7a3ab0' }[L.n] || '#444' }));
  const dom = (E.domination || []).map(([x, z, n], i) => [x, z, n || 'ABC'[i]]);
  return { items, spawns, lanes, dom };
}
function mirror(o) {
  const m = { ...o };
  if (o.z !== undefined) m.z = -o.z;
  if (o.rot !== undefined) m.rot = Math.PI - o.rot;
  if (o.poly) m.poly = o.poly.map(([x, z]) => [x, -z]);
  if (o.ellipse) m.ellipse = [o.ellipse[0], -o.ellipse[1], o.ellipse[2], o.ellipse[3]];
  if (o.rampSlope) m.rampSlope = [o.rampSlope[0], o.rampSlope[1], -o.rampSlope[3], -o.rampSlope[2]];
  if (o.lineRope) m.lineRope = o.lineRope.map(([x, z]) => [x, -z]);
  return m;
}
/* An object of the file: solids (filled polygons, what blocks), zone (overhang: guy lines, roof, tarp, laundry), height, flags */
function toItems(o, PF) {
  const rot = o.rot || 0, base = { n: o.n || (o.pf ? o.pf[0] : 'object'), underCover: !!o.underCover, against: !!o.against, h: o.h };
  if (o.pf) {
    const F = PF[JSON.stringify(o.pf)];
    if (!F) throw new Error('unknown prefab: ' + JSON.stringify(o.pf));
    const solids = F.cols.map((b) => rectAt(o.x, o.z, rot, b[0], b[1], b[2], b[3]));
    const z = F.zone, small = (z[1] - z[0]) * (z[3] - z[2]) < 1.2 && F.h < 1.3;
    return [{ ...base, h: o.h || F.h, solids, zone: rectAt(o.x, o.z, rot, z[0], z[1], z[2], z[3]), small, approx: F.approx }];
  }
  if (o.rampSlope) { const [x0, x1, z0, z1] = o.rampSlope; return [{ ...base, n: o.n || 'rampSlope', h: 0.4, against: o.against !== false, solids: [[[x0, z0], [x1, z0], [x1, z1], [x0, z1]]], rampSlope: true }]; }
  if (o.lineRope) {
    const [[xa, za], [xb, zb]] = o.lineRope, L = Math.hypot(xb - xa, zb - za), a = -Math.atan2(zb - za, xb - xa);
    return [{ ...base, n: o.n || 'clothesline', h: 2, solids: [ring(xa, za, 0.06, 0.06, 6), ring(xb, zb, 0.06, 0.06, 6)], zone: rectAt((xa + xb) / 2, (za + zb) / 2, a, -L / 2 + 0.25, L / 2 - 0.25, -0.25, 0.25), small: true }];
  }
  if (o.poly || o.ellipse) {
    const P = o.poly || ring(o.ellipse[0], o.ellipse[1], o.ellipse[2], o.ellipse[3], 32), t = o.type || 'solid';
    if (t === 'water' || t === 'terrain') return [{ ...base, type: t, poly: P }];
    return [{ ...base, h: o.h || 2, solids: t === 'solid' ? [P] : [], zone: t === 'zone' ? P : null }];
  }
  if (o.r !== undefined) { const r = o.r; return [{ ...base, h: o.h || 1, solids: [ring(o.x, o.z, r, r, 8)], small: r <= 0.5 }]; }
  const w = o.w, d = o.d, db = o.overhang === undefined ? 0 : o.overhang, [mx, mz] = Array.isArray(db) ? db : [db, db];
  const solids = o.isEmpty ? [] : [rectAt(o.x, o.z, rot, -w / 2, w / 2, -d / 2, d / 2)];
  if (o.cornerPoles) for (const sx of [-1, 1]) for (const sz of [-1, 1]) solids.push(rectAt(o.x, o.z, rot, sx * w / 2 - 0.06, sx * w / 2 + 0.06, sz * d / 2 - 0.06, sz * d / 2 + 0.06));
  const zone = o.isEmpty || mx || mz ? rectAt(o.x, o.z, rot, -w / 2 - mx, w / 2 + mx, -d / 2 - mz, d / 2 + mz) : null;
  return [{ ...base, h: o.h || 1.5, solids, zone, isEmpty: !!o.isEmpty, small: !o.isEmpty && w * d <= 1.2 && (o.h || 1.5) <= 1.3 }];
}
/* Sketch checks; returns the list of defects [severity, text, x, z] */
function verify(E, S) {
  const out = [], solidItems = S.items.filter((it) => it.solids && it.solids.length), name = (it) => `${it.n} (${centerOf(it.isEmpty ? it.zone : it.solids[0] || it.zone).map((v) => v.toFixed(1)).join(', ')})`;
  for (let i = 0; i < solidItems.length; i++) for (let j = i + 1; j < solidItems.length; j++) {
    const a = solidItems[i], b = solidItems[j];
    if (a.preexisting && b.preexisting) continue; // rework: the built scenery is not checked against itself
    if ((a.preexisting && b.onScenery) || (b.preexisting && a.onScenery)) continue; // placed on purpose on or against the scenery (onScenery: true)
    let d = 1e9; for (const p of a.solids) for (const q of b.solids) d = Math.min(d, polyGap(p, q));
    const at = centerOf([...a.solids[0], ...b.solids[0]]);
    if (d < (a.against || b.against ? -0.15 : -0.02)) { out.push(['ERROR', `${name(a)} and ${name(b)} overlap by ${(-d).toFixed(2)} m`, ...at]); a.over = (a.over || new Set()).add(b); b.over = (b.over || new Set()).add(a); }
    else if (a.against || b.against || a.small || b.small) continue; // a small object (drum, crate: a prop that can be pushed) can be walked around
    else if (d < 0.85) out.push(['passage', `${name(a)} and ${name(b)}: ${Math.max(0, d).toFixed(2)} m, nobody gets through (butt together or space out to 1.2 m)`, ...at]);
    else if (d < 1.2) out.push(['bots', `${name(a)} and ${name(b)}: ${d.toFixed(2)} m, the player gets through, the bots not always`, ...at]);
  }
  // an object inside the guy lines, under the tarp or under another's overhang; two overhangs that cross
  for (const a of S.items) if (a.zone && !a.preexisting) for (const b of S.items) {
    if (a === b || b.type || (a.over && a.over.has(b))) continue; // two objects that overlap: a single defect
    for (const q of b.solids || []) if (polyGap(a.zone, q) < -0.02 && !b.underCover && !(b.rampSlope && a.against)) { out.push(['ERROR', `${name(b)} inside the guy lines, under the tarp or the overhang of ${name(a)} (underCover: true if it is there on purpose)`, ...centerOf(q)]); break; }
    if (b.zone && S.items.indexOf(b) > S.items.indexOf(a) && polyGap(a.zone, b.zone) < -0.02 && !a.underCover && !b.underCover) out.push(['overhangs', `the overhangs of ${name(a)} and ${name(b)} cross`, ...centerOf(b.zone)]);
  }
  for (const it of S.items) if (it.approx && !it.preexisting) out.push(['note', `${name(it)}: prefab without collision, footprint approximated by its vertices under 2 m`, ...centerOf(it.solids[0])]);
  // spawns
  for (const [x, z, t] of S.spawns) {
    let d = 1e9; for (const it of solidItems) for (const q of it.solids) d = Math.min(d, inPoly(q, x, z) ? -1 : Math.min(...q.map((p, i) => segDist([x, z], p, q[(i + 1) % q.length]))));
    if (d < 0.6) out.push(['ERROR', `spawn ${t ? 'Bravo' : 'Alpha'} (${x}, ${z}) at ${Math.max(0, d).toFixed(2)} m from an obstacle (0.6 m minimum)`, x, z]);
  }
  for (let i = 0; i < S.spawns.length; i++) for (let j = i + 1; j < S.spawns.length; j++) { const a = S.spawns[i], b = S.spawns[j]; if (a[2] === b[2] && Math.hypot(a[0] - b[0], a[1] - b[1]) < 2.2) out.push(['ERROR', `spawns (${a[0]}, ${a[1]}) and (${b[0]}, ${b[1]}) within 2.2 m`, a[0], a[1]]); }
  // domination: walkable share of the 5.5 m disc (at least 70%), cover of 0.8 to 2.2 m within 9 m (README, "Design rules")
  S.domInfo = [];
  for (const [x, z, n] of S.dom) {
    let tot = 0, free = 0;
    for (let u = -5.5; u <= 5.5; u += 0.25) for (let v = -5.5; v <= 5.5; v += 0.25) { if (u * u + v * v > 30.25) continue; tot++; if (!solidItems.some((it) => it.solids.some((q) => inPoly(q, x + u, z + v)))) free++; }
    const part = Math.round((free / tot) * 100), near = (it) => it.solids.some((q) => inPoly(q, x, z) || Math.min(...q.map((p, i) => segDist([x, z], p, q[(i + 1) % q.length]))) < 9);
    const cov = solidItems.filter((it) => !it.small && !it.isEmpty && !it.rampSlope && it.h >= 0.8 && near(it)), high = cov.filter((it) => it.h > 2.2).length;
    S.domInfo.push(`point ${n} (${x}, ${z}): ${part} % walkable, ${cov.length} covers within 9 m including ${high} high (at least 5, 6 on a large map, including high ones)`);
    if (part < 70) out.push(['ERROR', `point ${n}: ${part} % walkable (at least 70 %)`, x, z]);
  }
  if (E.circle) for (const it of solidItems) { const [x, z] = centerOf(it.solids[0]), r = Math.hypot(x - (E.circle.x || 0), z - (E.circle.z || 0)); if (r > E.circle.r) out.push(['note', `${name(it)} outside the zone circle (${r.toFixed(1)} m from the center)`, x, z]); }
  return out;
}

/* ---------- Survey of a built map (in the page) ---------- */
async function survey(page, map) {
  return page.evaluate(async (map) => {
    const PUTS = [], WAT = [], P = Maker.prototype, oput = P.put, opond = pondAdd, foot = new Map();
    const skip = /^(gravel|stone|chunk|pebbles|litter|weed|brick|shard|pile|grass|rubble|scrap|paper|leaf|moss|dirt|crack|puddle|debris|splat|cyGrass|smReeds|smPalmFar)/i;
    P.put = function (pf, o) {
      if (this === DECOR && !skip.test(pf.name)) { this._n(); PUTS.push({ pf, e: this.m.elements.slice() }); }
      return oput.apply(this, arguments);
    };
    pondAdd = function (o) { WAT.push(JSON.parse(JSON.stringify({ shape: o.shape, poly: o.poly, x: o.x, z: o.z, w: o.w, d: o.d, r: o.r, rot: o.rot }))); return opond.apply(this, arguments); };
    Settings.map = map; await mapEnsure(map); LOCK.fallback = true; startMatch({});
    P.put = oput; pondAdd = opond;
    const B = [MAP.x0, MAP.x1, MAP.z0, MAP.z1], g0 = (x, z) => (typeof gy0 === 'function' ? gy0(x, z) : 0), r2 = (v) => Math.round(v * 100) / 100;
    const boxes = COL.filter((c) => !c.inv && c.x1 > B[0] - 2 && c.x0 < B[1] + 2 && c.z1 > B[2] - 2 && c.z0 < B[3] + 2).map((c) => { const g = g0((c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2); return [r2(c.x0), r2(c.x1), r2(c.z0), r2(c.z1), r2(c.y1 - g), r2(c.y0 - g), c.prop ? 'prop' : c.ray ? 'ray' : 'col']; });
    const shapes = [];
    for (const { pf, e } of PUTS) {
      let F = foot.get(pf);
      if (!F) { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, h = 0; for (const part of pf.parts.values()) { const Q = part.g.P; for (let i = 0; i < part.g.nv; i++) { x0 = Math.min(x0, Q[i * 3]); x1 = Math.max(x1, Q[i * 3]); z0 = Math.min(z0, Q[i * 3 + 2]); z1 = Math.max(z1, Q[i * 3 + 2]); h = Math.max(h, Q[i * 3 + 1]); } } F = { x0, x1, z0, z1, h }; foot.set(pf, F); }
      if (!(F.x1 > F.x0) || (F.x1 - F.x0) * (F.z1 - F.z0) < 0.5 || F.h < 0.4 || /palm|acacia|tree|pine|olive|cypress|bush|fol|reed|tamar/i.test(pf.name)) continue; // a tree: its trunk (collision) is enough
      const T = (x, z) => [r2(e[0] * x + e[8] * z + e[12]), r2(e[2] * x + e[10] * z + e[14])], poly = [T(F.x0, F.z0), T(F.x1, F.z0), T(F.x1, F.z1), T(F.x0, F.z1)];
      const area = Math.abs((F.x1 - F.x0) * (F.z1 - F.z0) * Math.hypot(e[0], e[2]) * Math.hypot(e[8], e[10])), cx = (poly[0][0] + poly[2][0]) / 2, cz = (poly[0][1] + poly[2][1]) / 2;
      if (cx < B[0] || cx > B[1] || cz < B[2] || cz > B[3]) continue;
      shapes.push({ solids: [poly], outline: true, label: area >= 3 ? pf.name.replace(/(\d|_).*$/, '') : '', lx: cx, lz: cz });
    }
    const water = WAT.map((o) => {
      if (o.shape === 'poly') return o.poly;
      if (o.shape === 'rect') { const c = Math.cos(o.rot || 0), s = Math.sin(o.rot || 0); return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [o.x + (a * o.w / 2) * c - (b * o.d / 2) * s, o.z + (a * o.w / 2) * s + (b * o.d / 2) * c]); }
      const rx = o.r || (o.w || 1) / 2, rz = o.r || (o.d || 1) / 2; return Array.from({ length: 20 }, (_, i) => [o.x + Math.cos((i / 20) * 2 * Math.PI) * rx, o.z + Math.sin((i / 20) * 2 * Math.PI) * rz]);
    });
    // a cell: its walkable ground (green dot), its walkable upper floor (blue square), otherwise its nodes outside the main network (red cross: on top
    // of a vehicle, roof without access, closed nook)
    const cell = new Map(); for (let i = 0; i < NAV.count; i++) { const k = NAV.nx[i] + ',' + NAV.nz[i], lift = NAV.ny[i] - g0(NAV.nx[i], NAV.nz[i]), main = NAV.comp[i] === NAV.mainComp, c = cell.get(k) || { x: NAV.nx[i], z: NAV.nz[i], g: false, h: false, off: false }; if (!main) c.off = true; else if (lift > 2.4) c.h = true; else c.g = true; cell.set(k, c); }
    const nav = []; for (const c of cell.values()) { if (c.g) nav.push([c.x, c.z, 0]); if (c.h) nav.push([c.x, c.z, 1]); if (!c.g && !c.h) nav.push([c.x, c.z, 2]); }
    let relief = null;
    if (typeof RELIEF !== 'undefined' && RELIEF.on) { const x0 = Math.floor(B[0]), z0 = Math.floor(B[2]), n = Math.ceil(B[1]) - x0 + 1, m = Math.ceil(B[3]) - z0 + 1, h = []; for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) h.push(r2(g0(x0 + i, z0 + j))); relief = { x0, z0, n, m, h }; }
    const D = CURMAP.def;
    return {
      bounds: B, boxes, shapes, water, nav, relief,
      ramps: RAMPS.map((r) => [r.x0, r.x1, r.z0, r.z1, r.axis, r.h1 >= r.h0 ? 1 : -1]),
      spawns: [...SPAWNS[0].map(([x, z]) => [x, z, 0]), ...SPAWNS[1].map(([x, z]) => [x, z, 1])],
      dom: (D.dom || []).map(([x, z], i) => [x, z, 'ABC'[i]]),
      poi: POI.map((p) => [p[0], p[2], p[3], p[4] ? 1 : 0, p[1] - g0(p[0], p[2]) > 1.5 ? 1 : 0]),
      zones: (D.zones || []).map((zz) => zz.slice(0, 5)),
      ring: RING.on ? { x: RING.x, z: RING.z, r: RING.r, hard: RING.hard } : null,
      title: `Survey of ${MAPS.find((m) => m.id === map)?.name || map}: ${COL.length} collision boxes, ${NAV.count} nodes (${Array.from({ length: NAV.count }, (_, i) => NAV.comp[i] !== NAV.mainComp).filter(Boolean).length} outside the main network), ${PUTS.length} placed objects`,
    };
  }, map);
}

/* ---------- Programme ---------- */
const fit = (b) => Math.max(6, Math.min(40, Math.floor(2200 / Math.max(b[1] - b[0], b[3] - b[2]))));
async function render(page, S, name) {
  fs.mkdirSync(OUT, { recursive: true });
  const shots = [[S.bounds, name]];
  if (win.length === 4) shots.push([win, name + '-zoom']);
  for (const [b, n] of shots) {
    const url = await page.evaluate(drawPlan, { ...S, bounds: b, ppm: fit(b), title: S.title + (n.endsWith('-zoom') ? ` (x ${b[0]} to ${b[1]}, z ${b[2]} to ${b[3]})` : '') });
    const out = path.join(OUT, n + '.png'); fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); console.log('plan:', out);
  }
}
(async () => {
  if (file) {
    const fp = fs.existsSync(path.resolve(file)) ? path.resolve(file) : path.join(HERE, file), E = require(fp), name = E.naming || path.basename(fp, '.js');
    const mapKey = E.mapKey || process.env.MAP;
    const { browser, page } = await openGame({ w: 480, h: 270, noMap: true, noHdri: true, page: process.env.PAGE, settings: mapKey ? { quality: 'low', difficulty: 1, map: mapKey, mode: 'dom' } : { quality: 'low' } });
    const R = mapKey ? await survey(page, mapKey) : null; // rework: the built map serves as background and obstacles
    // footprints of the cited prefabs: prefab collisions (or those the map adds to it, SM_COLS), overhang = all its vertices
    const keys = [...new Set((E.things || []).filter((o) => o.pf).map((o) => JSON.stringify(o.pf)))];
    const PFD = await page.evaluate((keys) => {
      const out = {};
      for (const k of keys) {
        const [n, ...a] = JSON.parse(k); if (typeof PF[n] !== 'function') continue;
        const pf = PF[n](...a); let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, h = 0, f = [1e9, -1e9, 1e9, -1e9];
        for (const part of pf.parts.values()) { const Q = part.g.P; for (let i = 0; i < part.g.nv; i++) { const x = Q[i * 3], y = Q[i * 3 + 1], z = Q[i * 3 + 2]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); h = Math.max(h, y); if (y <= 2) { f[0] = Math.min(f[0], x); f[1] = Math.max(f[1], x); f[2] = Math.min(f[2], z); f[3] = Math.max(f[3], z); } } }
        const extra = typeof SM_COLS !== 'undefined' && SM_COLS[pf.name] ? SM_COLS[pf.name].slice(1).map((b) => [b[0], b[1], b[4], b[5]]) : [];
        const cols = pf.cols.filter((c) => !c.ray).map((c) => [c.x0, c.x1, c.z0, c.z1]).concat(extra);
        out[k] = { zone: [x0, x1, z0, z1], h: Math.round(h * 100) / 100, cols: cols.length ? cols : [f], approx: !cols.length };
      }
      return out;
    }, keys);
    const S = sketch(E, PFD);
    let removed = [], domOld = null;
    if (R) {
      // rework: boxes of the built scenery on the ground (excluding props, invisible volumes, upper floors and roofs) as obstacles, except those that are removed
      removed = (E.removals || []).map((r) => [Math.min(r[0], r[1]), Math.max(r[0], r[1]), Math.min(r[2], r[3]), Math.max(r[2], r[3])]);
      const gone = (b) => removed.some((r) => (b[0] + b[1]) / 2 > r[0] && (b[0] + b[1]) / 2 < r[1] && (b[2] + b[3]) / 2 > r[2] && (b[2] + b[3]) / 2 < r[3]);
      if (E.mirrorAxis === 'z') removed = removed.concat(removed.map((r) => [r[0], r[1], -r[3], -r[2]]));
      const exist = R.boxes.filter((b) => b[6] === 'col' && b[5] < 1.0 && b[4] > 0.35 && !gone(b)).map((b) => ({ n: 'preexisting', preexisting: true, against: true, h: b[4], solids: [[[b[0], b[2]], [b[1], b[2]], [b[1], b[3]], [b[0], b[3]]]] }));
      S.items.forEach((it) => { it.isNew = true; });
      S.items.push(...exist);
      if (!E.spawnPoints) S.spawns = [];
      if (!S.dom.length) S.dom = R.dom; else domOld = R.dom.filter((o) => !S.dom.some((n) => n[2] === o[2] && Math.hypot(n[0] - o[0], n[1] - o[1]) < 0.1)); // only the points that move
    }
    const D = verify(E, S);
    if (R) { S.items = S.items.filter((it) => !it.preexisting); if (!E.spawnPoints) S.spawns = R.spawns; }
    const shapes = S.items.filter((it) => !it.type).map((it) => { const c = centerOf((it.solids[0] || it.zone)); return { solids: it.solids, zone: it.zone, isEmpty: it.isEmpty, h: it.h, label: it.small ? '' : it.n, small: it.small, lx: c[0], lz: c[1], prop: !!R }; });
    const issues = D.filter((d) => d[0] !== 'note').map((d, i) => [d[2], d[3], i + 1]);
    const tally = `${D.filter((d) => d[0] === 'ERROR').length} error(s), ${D.filter((d) => d[0] === 'passage' || d[0] === 'overhangs').length} closed passage(s) or overhang(s) to review, ${D.filter((d) => d[0] === 'bots').length} tight passage(s) for the bots`;
    await render(page, {
      ...(R ? { ...R, shapes: R.shapes.concat(shapes), removed, domOld, title: `Rework ${E.heading || name} (in magenta, on the survey; in red, what is removed): ${tally}` } : { title: `Sketch ${E.heading || name}: ${tally}`, zones: E.zones || [], shapes }),
      bounds: E.extent, spawns: S.spawns, dom: S.dom, lanes: S.lanes,
      water: S.items.filter((it) => it.type === 'water').map((it) => it.poly), terrain: S.items.filter((it) => it.type === 'terrain').map((it) => ({ n: it.n, poly: it.poly, c: centerOf(it.poly) })),
      ring: E.circle ? { x: E.circle.x || 0, z: E.circle.z || 0, r: E.circle.r, hard: E.circle.hard } : null, issues,
    }, name);
    let k = 0;
    for (const d of D) console.log(`${d[0] === 'note' ? '   ' : String(++k).padStart(3)} ${d[0].padEnd(8)} ${d[1]}`);
    for (const s of S.domInfo) console.log('    ' + s);
    console.log(`${S.items.length} objects, ${S.spawns.length} spawns, ${S.dom.length} domination points`);
    await browser.close();
    if (D.some((d) => d[0] === 'ERROR')) process.exit(1);
    return;
  }
  const map = process.env.MAP || 'chergui';
  const { browser, page } = await openGame({ w: 480, h: 270, noMap: true, noHdri: true, page: process.env.PAGE, settings: { quality: 'low', difficulty: 1, map, mode: 'dom' } });
  const S = await survey(page, map);
  await render(page, S, 'survey-' + map);
  console.log(S.title);
  await browser.close();
})();
