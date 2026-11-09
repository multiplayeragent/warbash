/* ==========================================================================
   NAVIGATION: 1 m multi-level grid generated from the collisions
   ========================================================================== */
const NAV = { x0: MAP.x0, z0: MAP.z0, W: MAP.x1 - MAP.x0, H: MAP.z1 - MAP.z0, cells: null, nx: null, ny: null, nz: null, adjStart: null, adj: null, adjCost: null, count: 0 };
const NAV_DH = 0.62, NAV_R = 0.42;

function navClear(x, z, h) {
  for (const c of queryBoxes(x - NAV_R, z - NAV_R, x + NAV_R, z + NAV_R)) {
    if (c.ray) continue;
    if (c.y1 <= h + 0.3 || c.y0 >= h + 1.7) continue;
    const cx = clamp(x, c.x0, c.x1), cz = clamp(z, c.z0, c.z1);
    if ((x - cx) ** 2 + (z - cz) ** 2 < NAV_R * NAV_R) return false;
  }
  for (const rp of RAMPS) {
    const cx = clamp(x, rp.x0, rp.x1), cz = clamp(z, rp.z0, rp.z1);
    if ((x - cx) ** 2 + (z - cz) ** 2 >= NAV_R * NAV_R) continue;
    if (rampHeight(rp, cx, cz) > h + 0.35) return false;
  }
  return true;
}

/* Link between two neighboring nodes: the segment joining them crosses no wall at body height. Each node has its clearance (navClear),
   but a partition under 16 cm thick placed between two cell centers (1 m apart, 0.42 m of clearance on each side) slipped between them:
   the network connected both sides and the bots bumped into the wall. The step up of a higher node (up to NAV_DH) doesn't count. */
function navLinkClear(x0, z0, h0, x1, z1, h1) {
  const top = Math.max(h0, h1), low = Math.min(h0, h1), dx = x1 - x0, dz = z1 - z0;
  for (const c of queryBoxes(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1))) {
    if (c.ray || c.y1 <= top + 0.3 || c.y0 >= low + 1.7) continue;
    let t0 = 0, t1 = 1;
    for (const [o, d, lo, hi] of [[x0, dx, c.x0 + 0.005, c.x1 - 0.005], [z0, dz, c.z0 + 0.005, c.z1 - 0.005]]) {
      if (Math.abs(d) < 1e-9) { if (o <= lo || o >= hi) { t0 = 2; break; } continue; }
      const u = (lo - o) / d, v = (hi - o) / d; t0 = Math.max(t0, Math.min(u, v)); t1 = Math.min(t1, Math.max(u, v));
    }
    if (t0 < t1) return false;
  }
  return true;
}

/* Climb from one node to the next: beyond the automatic step (STEP, ctlMove), it must be done in small steps (staircase, ramp).
   A single-piece ledge higher than STEP (bench, low wall, bollard of 0.5 to 0.62 m) is jumped: bots don't jump and stayed
   stuck there. The ground is sampled every 12.5 cm along the link. */
function navStepOk(x0, z0, h0, x1, z1, h1) {
  if (Math.abs(h1 - h0) <= STEP) return true;
  const top = Math.max(h0, h1) - STEP + 0.05; let prev = h0; // groundHeight takes supports up to y + STEP: here up to the higher of the two nodes
  for (let k = 1; k <= 8; k++) {
    const t = k / 8, y = k === 8 ? h1 : groundHeight(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, top, 0.05);
    if (Math.abs(y - prev) > STEP + 0.02) return false;
    prev = y;
  }
  return true;
}

/* Floating islands (VOID): a node within NAV_EDGE of the void is not kept, unless a wall (bridge railing) separates it from it. The network
   thus pulls back one cell along the edge, and a bot that follows its path, cuts a corner or overshoots on its momentum stays on the island (the
   ctlMove guard does the rest). Only the void counts: the edge of a terrace above the island keeps its nodes. */
const NAV_EDGE = 0.6;
function navEdgeOk(x, z, h) {
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, px = x + Math.cos(a) * NAV_EDGE, pz = z + Math.sin(a) * NAV_EDGE;
    if (groundHeight(px, pz, h + 0.05, 0.1) > VOID.floor + 1) continue; // from the support on that side
    // a wall between the node and the void (segment against box, flat, at body height): the side is safe
    const walls = queryBoxes(Math.min(x, px), Math.min(z, pz), Math.max(x, px), Math.max(z, pz)).filter((c) => !c.ray && c.y1 > h + 0.3 && c.y0 < h + 1.7);
    let walled = false;
    for (const c of walls) {
      let t0 = 0, t1 = 1; const dx = px - x, dz = pz - z;
      for (const [o, d, lo, hi] of [[x, dx, c.x0, c.x1], [z, dz, c.z0, c.z1]]) {
        if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { t0 = 2; break; } continue; }
        const u = (lo - o) / d, v = (hi - o) / d; t0 = Math.max(t0, Math.min(u, v)); t1 = Math.min(t1, Math.max(u, v));
      }
      if (t0 <= t1) { walled = true; break; }
    }
    if (!walled) return false;
  }
  return true;
}

function buildNav() {
  Object.assign(NAV, { x0: MAP.x0, z0: MAP.z0, W: MAP.x1 - MAP.x0, H: MAP.z1 - MAP.z0 });
  const W = NAV.W, H = NAV.H;
  const xs = [], ys = [], zs = [], cellList = new Array(W * H);
  for (let cz = 0; cz < H; cz++) {
    for (let cx = 0; cx < W; cx++) {
      const x = NAV.x0 + cx + 0.5, z = NAV.z0 + cz + 0.5;
      if (RING.on && (x - RING.x) ** 2 + (z - RING.z) ** 2 > (RING.r - 0.5) ** 2) { cellList[cz * W + cx] = []; continue; } // round zone: no node outside, bots stay inside
      const cand = [gy0(x, z)], pool = POOLS.length ? poolAt(x, z) : null; if (pool) cand.push(pool.bed); // in a basin, the bottom is a walkable surface
      for (const c of queryBoxes(x, z, x, z)) {
        if (c.ray || c.inv || (c.prop && c.prop.d.noNav)) continue; // invisible walls at the water's edge, sandbags (noNav): no surface above
        if (x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1 && c.y1 < 12) cand.push(c.y1);
      }
      for (const rp of RAMPS) if (x >= rp.x0 && x <= rp.x1 && z >= rp.z0 && z <= rp.z1) cand.push(rampHeight(rp, x, z));
      cand.sort((a, b) => a - b);
      const list = [];
      let prev = -9;
      for (const h of cand) {
        if (h - prev < 0.1) continue;
        // the surface must be the highest under this point at this height
        if (Math.abs(groundHeight(x, z, h + 0.05, 0.1) - h) > 0.08) continue;
        if (!navClear(x, z, h)) continue;
        if (VOID.on && !navEdgeOk(x, z, h)) continue;
        prev = h;
        list.push(xs.length); xs.push(x); ys.push(h); zs.push(z);
      }
      cellList[cz * W + cx] = list;
    }
  }
  const N = xs.length;
  NAV.count = N; NAV.cells = cellList;
  NAV.nx = new Float32Array(xs); NAV.ny = new Float32Array(ys); NAV.nz = new Float32Array(zs);
  const adjStart = new Int32Array(N + 1), adj = [], cost = [];
  const nodeAt = (cx, cz, h) => {
    if (cx < 0 || cz < 0 || cx >= W || cz >= H) return -1;
    let best = -1, bd = NAV_DH;
    for (const id of cellList[cz * W + cx]) { const d = Math.abs(ys[id] - h); if (d <= bd) { bd = d; best = id; } }
    return best;
  };
  for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
    for (const id of cellList[cz * W + cx]) {
      adjStart[id] = adj.length;
      const h = ys[id];
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const n = nodeAt(cx + dx, cz + dz, h); if (n < 0) continue;
        if (dx && dz) { if (nodeAt(cx + dx, cz, h) < 0 || nodeAt(cx, cz + dz, h) < 0) continue; }
        if (!navLinkClear(xs[id], zs[id], h, xs[n], zs[n], ys[n])) continue; // a thin partition between the two
        if (!navStepOk(xs[id], zs[id], h, xs[n], zs[n], ys[n])) continue; // a ledge to jump
        adj.push(n); cost.push(hyp3(dx, dz, (ys[n] - h) * 1.5));
      }
    }
  }
  // fix: adjStart must follow the order of the identifiers
  const order = new Int32Array(N); let k = 0;
  for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) for (const id of cellList[cz * W + cx]) order[k++] = id;
  const adj2 = new Int32Array(adj.length), cost2 = new Float32Array(adj.length), start2 = new Int32Array(N + 1);
  const ends = new Int32Array(N);
  for (let i = 0; i < N; i++) { const id = order[i]; ends[id] = i + 1 < N ? adjStart[order[i + 1]] : adj.length; }
  let p = 0;
  for (let id = 0; id < N; id++) {
    start2[id] = p;
    for (let j = adjStart[id]; j < ends[id]; j++) { adj2[p] = adj[j]; cost2[p] = cost[j]; p++; }
  }
  start2[N] = p;
  NAV.adjStart = start2; NAV.adj = adj2; NAV.adjCost = cost2;
  NAV.g = new Float32Array(N); NAV.f = new Float32Array(N); NAV.from = new Int32Array(N); NAV.stamp = new Int32Array(N); NAV.closed = new Int32Array(N); NAV.gen = 1;
  NAV.kind = new Uint8Array(N); NAV.lead = new Float32Array(N); NAV.adjKind = new Uint8Array(adj2.length); NAV.adjLead = new Float32Array(adj2.length);
  computeComponents();
  navLeaps();
}

/* Network jumps. Beyond the walk links, a link joins two nodes that the automatic step can't connect:
   climb (type 1) onto a ledge of 0.47 to 1 m from a neighboring node, drop (type 2) from a ledge of 0.47 to 3 m that you let yourself fall from (there is no
   fall damage; the landing must be in the open), hop-over (type 3) of a low obstacle (low wall, bench, crate, sandbags: at most 1 m high
   and 1.5 m wide, nothing above) between two nodes of the same level 1 to 3 cells apart. A bot takes them as a player would take a
   shortcut: the link's cost is the distance plus a penalty. They open no area: only nodes already connected to each other by walking
   are linked, so no spawn or point of interest changes component. Props (movable) aren't hopped over, nor is anything placed on the edge of a ledge (railing). Each link keeps its
   run-up distance (lead: from A to the point where the body touches the obstacle), which the bot reads to jump in time (botLeapNow, 07e-human.js).
   The check (tools/dev/visual/jumpLinks.js) runs each link through the game's controller. */
const NAV_LEAP = { up: 1.0, down: 3.0, hop: 1.0, depth: 1.5 };
const _nobs = { lead: 0, top: 0, any: false, closed: false };
/* What the body meets on the flat segment A-B, feet at height base: _nobs.any if a low obstacle can be hopped over (lead: distance from A
   where the body touches it, top: its height), _nobs.closed if something blocks the way (obstacle too tall or too wide, prop, invisible wall,
   low ceiling) */
function navObstacle(ax, az, base, bx, bz) {
  const dx = bx - ax, dz = bz - az, L = hyp(dx, dz), R = 0.3;
  let s0 = 1e9, s1 = -1e9, top = base;
  _nobs.any = _nobs.closed = false;
  const arr = queryBoxes(Math.min(ax, bx) - R, Math.min(az, bz) - R, Math.max(ax, bx) + R, Math.max(az, bz) + R);
  for (let k = 0; k < arr.length; k++) {
    const c = arr[k];
    if (c.ray || c.y1 <= base + STEP + 0.02 || c.y0 >= base + 2.9) continue;
    let t0 = 0, t1 = 1;
    for (let a = 0; a < 2; a++) {
      const o = a ? az : ax, d = a ? dz : dx, lo = (a ? c.z0 : c.x0) - R, hi = (a ? c.z1 : c.x1) + R;
      if (Math.abs(d) < 1e-9) { if (o <= lo || o >= hi) { t0 = 2; break; } continue; }
      const u = (lo - o) / d, v = (hi - o) / d; t0 = Math.max(t0, Math.min(u, v)); t1 = Math.min(t1, Math.max(u, v));
    }
    if (t0 >= t1) continue;
    if (c.prop || c.inv || c.y0 > base + STEP || c.y1 > base + NAV_LEAP.hop + 0.02) { _nobs.closed = true; return _nobs; }
    s0 = Math.min(s0, t0 * L); s1 = Math.max(s1, t1 * L); top = Math.max(top, c.y1);
  }
  if (s0 > 1e8) return _nobs;
  if (s1 - s0 - 2 * R > NAV_LEAP.depth) { _nobs.closed = true; return _nobs; }
  _nobs.any = true; _nobs.lead = Math.max(0, s0); _nobs.top = top; return _nobs;
}
function navLeaps() {
  const N = NAV.count, W = NAV.W, H = NAV.H, nx = NAV.nx, ny = NAV.ny, nz = NAV.nz, comp = NAV.comp, main = NAV.mainComp, st = NAV.adjStart, adj = NAV.adj;
  const from = [], to = [], cost = [], kind = [], lead = [];
  const linked = (a, m) => { for (let j = st[a]; j < st[a + 1]; j++) if (adj[j] === m) return true; return false; };
  const DX = [1, -1, 0, 0], DZ = [0, 0, 1, -1];
  for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
    for (const id of NAV.cells[cz * W + cx]) {
      if (comp[id] !== main) continue;
      const h = ny[id], head = ceilingAbove(nx[id], nz[id], h + 0.3, 0.3) >= h + 2.9; // room to jump without hitting your head
      for (let d = 0; d < 4; d++) {
        // is the neighboring cell already open to walking? If not (partition, low wall) a hop-over can land there
        let open = false;
        for (let j = st[id]; j < st[id + 1] && !open; j++) { const m = adj[j]; if (Math.abs(ny[m] - h) <= 0.62 && Math.floor(nx[m] - NAV.x0) === cx + DX[d] && Math.floor(nz[m] - NAV.z0) === cz + DZ[d]) open = true; }
        for (let k = 1; k <= 3; k++) {
          const ncx = cx + DX[d] * k, ncz = cz + DZ[d] * k;
          if (ncx < 0 || ncz < 0 || ncx >= W || ncz >= H) break;
          for (const m of NAV.cells[ncz * W + ncx]) {
            if (comp[m] !== main) continue;
            const dh = ny[m] - h;
            let t = 0;
            if (k === 1 && dh > STEP + 0.02 && dh <= NAV_LEAP.up) t = 1;
            else if (k === 1 && dh < -(STEP + 0.02) && dh >= -NAV_LEAP.down) t = 2;
            else if (Math.abs(dh) <= 0.62 && !open) t = 3;
            if (!t || !head && t !== 2 || linked(id, m)) continue;
            if (t === 2) { // you fall: open sky above the landing, nothing on the way
              if (ceilingAbove(nx[m], nz[m], ny[m] + 0.3, 0.35) < h + 1.8 || !navLinkClear(nx[id], nz[id], h, nx[m], nz[m], ny[m])) continue;
              const o = navObstacle(nx[id], nz[id], h, nx[m], nz[m]); if (o.any || o.closed) continue; // a railing at the edge, a low wall: you don't fall that way
              from.push(id); to.push(m); kind.push(2); lead.push(0); cost.push(hyp(1, dh * 0.5) + 1.2 - dh * 0.4);
            } else {
              const o = navObstacle(nx[id], nz[id], Math.min(h, ny[m]), nx[m], nz[m]);
              if (!o.any || o.closed || (t === 1 && o.top > ny[m] + 0.05)) continue;
              from.push(id); to.push(m); kind.push(t); lead.push(o.lead); cost.push(hyp(k, Math.abs(dh) * 1.5) + 2 + (o.top - Math.min(h, ny[m])) * 1.5);
            }
          }
        }
      }
    }
  }
  const M = from.length; if (!M) return;
  const extra = new Int32Array(N); for (let i = 0; i < M; i++) extra[from[i]]++;
  const st2 = new Int32Array(N + 1); for (let i = 0; i < N; i++) st2[i + 1] = st2[i] + (st[i + 1] - st[i]) + extra[i];
  const adj2 = new Int32Array(st2[N]), cost2 = new Float32Array(st2[N]), kind2 = new Uint8Array(st2[N]), lead2 = new Float32Array(st2[N]), fill = new Int32Array(N);
  for (let i = 0; i < N; i++) { let p = st2[i]; for (let j = st[i]; j < st[i + 1]; j++, p++) { adj2[p] = adj[j]; cost2[p] = NAV.adjCost[j]; } fill[i] = p; }
  for (let i = 0; i < M; i++) { const p = fill[from[i]]++; adj2[p] = to[i]; cost2[p] = cost[i]; kind2[p] = kind[i]; lead2[p] = lead[i]; }
  NAV.adjStart = st2; NAV.adj = adj2; NAV.adjCost = cost2; NAV.adjKind = kind2; NAV.adjLead = lead2;
}

/* Map unloading */
function navUnload() {
  for (const k of ['cells', 'nx', 'ny', 'nz', 'adjStart', 'adj', 'adjCost', 'adjKind', 'adjLead', 'kind', 'lead', 'g', 'f', 'from', 'stamp', 'closed', 'comp']) NAV[k] = null;
  NAV.count = 0;
}
/* Connected components: used to avoid isolated nodes (tops of crates) */
function computeComponents() {
  const N = NAV.count, comp = new Int32Array(N).fill(-1); let c = 0, big = 0, bigSize = 0;
  const stack = [];
  for (let i = 0; i < N; i++) {
    if (comp[i] >= 0) continue;
    let size = 0; stack.push(i); comp[i] = c;
    while (stack.length) {
      const n = stack.pop(); size++;
      for (let j = NAV.adjStart[n]; j < NAV.adjStart[n + 1]; j++) { const m = NAV.adj[j]; if (comp[m] < 0) { comp[m] = c; stack.push(m); } }
    }
    if (size > bigSize) { bigSize = size; big = c; }
    c++;
  }
  NAV.comp = comp; NAV.mainComp = big;
}

function navNode(x, y, z) {
  const cx0 = Math.floor(x - NAV.x0), cz0 = Math.floor(z - NAV.z0);
  let best = -1, bd = 1e9;
  for (let r = 0; r <= 4 && best < 0; r++) {
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const cx = cx0 + dx, cz = cz0 + dz;
      if (cx < 0 || cz < 0 || cx >= NAV.W || cz >= NAV.H) continue;
      for (const id of NAV.cells[cz * NAV.W + cx]) {
        if (NAV.comp[id] !== NAV.mainComp) continue;
        const dy = NAV.ny[id] - y;
        if (dy > 0.9) continue;
        const d = Math.abs(dy) * 3 + hyp(NAV.nx[id] - x, NAV.nz[id] - z);
        if (d < bd) { bd = d; best = id; }
      }
    }
  }
  return best;
}

/* Minimal binary heap for A* */
const HEAP = { a: new Int32Array(40000), n: 0 };
function heapPush(id) {
  const a = HEAP.a, f = NAV.f; let i = HEAP.n++; a[i] = id;
  while (i > 0) { const p = (i - 1) >> 1; if (f[a[p]] <= f[a[i]]) break; const t = a[p]; a[p] = a[i]; a[i] = t; i = p; }
}
function heapPop() {
  const a = HEAP.a, f = NAV.f, top = a[0]; a[0] = a[--HEAP.n]; let i = 0;
  for (;;) {
    const l = i * 2 + 1, r = l + 1; let m = i;
    if (l < HEAP.n && f[a[l]] < f[a[m]]) m = l; if (r < HEAP.n && f[a[r]] < f[a[m]]) m = r;
    if (m === i) break; const t = a[m]; a[m] = a[i]; a[i] = t; i = m;
  }
  return top;
}
/* sid: imposed start node (the nearest one reachable in a straight line), otherwise simply the nearest */
function findPath(from, to, sid = -1) {
  const s = sid >= 0 ? sid : navNode(from.x, from.y, from.z), e = navNode(to.x, to.y, to.z);
  if (s < 0 || e < 0) return null;
  const gen = ++NAV.gen, g = NAV.g, f = NAV.f, fr = NAV.from, st = NAV.stamp, cl = NAV.closed, kd = NAV.kind;
  const ex = NAV.nx[e], ey = NAV.ny[e], ez = NAV.nz[e];
  HEAP.n = 0; st[s] = gen; g[s] = 0; f[s] = hyp(NAV.nx[s] - ex, NAV.nz[s] - ez); fr[s] = -1; heapPush(s);
  let iter = 0, found = false;
  while (HEAP.n > 0 && iter++ < 30000) {
    const n = heapPop();
    if (cl[n] === gen) continue; cl[n] = gen;
    if (n === e) { found = true; break; }
    for (let j = NAV.adjStart[n]; j < NAV.adjStart[n + 1]; j++) {
      const m = NAV.adj[j]; if (cl[m] === gen) continue;
      const ng = g[n] + NAV.adjCost[j];
      if (st[m] !== gen || ng < g[m]) {
        st[m] = gen; g[m] = ng; fr[m] = n; kd[m] = NAV.adjKind[j]; NAV.lead[m] = NAV.adjLead[j];
        f[m] = ng + hyp3(NAV.nx[m] - ex, NAV.nz[m] - ez, (NAV.ny[m] - ey)) * 1.05;
        if (HEAP.n < HEAP.a.length) heapPush(m);
      }
    }
  }
  if (!found) return null;
  const ids = []; for (let n = e; n >= 0; n = fr[n]) ids.push(n);
  ids.reverse();
  const pts = ids.map((id) => { const v = new V3(NAV.nx[id], NAV.ny[id], NAV.nz[id]); v.pin = v.jump = v.drop = false; v.lead = 0; return v; });
  for (let i = 1; i < ids.length; i++) { const k = kd[ids[i]]; if (k) { pts[i].pin = pts[i - 1].pin = true; if (k === 2) pts[i].drop = true; else { pts[i].jump = true; pts[i].lead = NAV.lead[ids[i]]; } } } // pin: a jump or drop point is not cut
  return smoothPath(pts);
}
function navWalkable(a, b) {
  const d = hyp(b.x - a.x, b.z - a.z), steps = Math.ceil(d / 0.45);
  let h = a.y;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, x = lerp(a.x, b.x, t), z = lerp(a.z, b.z, t);
    const cx = Math.floor(x - NAV.x0), cz = Math.floor(z - NAV.z0);
    if (cx < 0 || cz < 0 || cx >= NAV.W || cz >= NAV.H) return false;
    let ok = false;
    for (const id of NAV.cells[cz * NAV.W + cx]) { if (Math.abs(NAV.ny[id] - h) <= 0.5) { h = NAV.ny[id]; ok = true; break; } }
    if (!ok) return false;
    if (VOID.on && groundHeight(x, z, h + 0.05, 0.3) <= VOID.floor + 1) return false; // a shortcut doesn't pass over the void (corner of an edge cell)
  }
  return Math.abs(h - b.y) < 0.5;
}
function smoothPath(pts) {
  if (pts.length <= 2) return pts;
  const out = [pts[0]]; let i = 0;
  while (i < pts.length - 1) {
    let j = Math.min(pts.length - 1, i + 14);
    for (let k = i + 1; k < j; k++) if (pts[k].pin) { j = k; break; }
    while (j > i + 1 && !navWalkable(pts[i], pts[j])) j--;
    out.push(pts[j]); i = j;
  }
  return out;
}
function randomNavPoint(x0, x1, z0, z1) {
  for (let k = 0; k < 40; k++) {
    const x = rand(x0, x1), z = rand(z0, z1);
    const id = navNode(x, gy0(x, z), z);
    if (id >= 0 && Math.abs(NAV.nx[id] - x) < 2 && Math.abs(NAV.nz[id] - z) < 2) return new V3(NAV.nx[id], NAV.ny[id], NAV.nz[id]);
  }
  return null;
}
