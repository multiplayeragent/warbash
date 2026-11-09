/* ==========================================================================
   MINIMAP: THE PLAN
   The minimap background (HUD.mmStatic, drawn once at map load, see drawMinimap in 09-game.js for what moves on top) is a
   gray plan, not the satellite survey: you read at a glance where you can pass (dark ground) and what blocks (light objects), without texture or shadow.
   Player feedback: "the minimap in black and white, simplified, readable at a glance". The same plan, at larger scale, is the background of the
   airstrike map and of the tablet screen (KS.plan, 08b-killstreaks.js); the satellite survey (buildSatelliteMap) is no longer displayed,
   but its render remains at load: it also does the program sweep on phone (see "Mobile version").
   The minimap is zoomed (MM_ZOOM): you see what's close (about thirty meters around the player), not the whole map.
   - The play zone's ground is a dark gray, the outside almost black. Floating islands: only the islands have ground, light edging, the void stays black,
     the bridges are drawn. Relief (Sirocco dunes): tint by height, shading from the top left, contour lines every 2 m. Water (sea,
     pools): night blue with wave strokes. Very discreet 10 m grid (not on the void).
   - Objects come from the collision boxes (COL), without those that only stop shots (ray) or the invisible walls at the water's edge (inv) or
     objects under 0.5 m2 (crates, posts: noise). What stops a soldier (underside less than 1.7 m above the ground) has four tiers depending on the
     height of its top: flush (step, plinth: not drawn), low cover (under 1 m), cover (under 2.2 m), wall (under 4.5 m), building. From lowest to
     highest, a dark outline then the tier's tint: a tall object stands out from its surroundings. What is above head height (roof, awning,
     walkway, upper floor) stops no one: a medium gray flat fill laid under the obstacles, so you can see both that you pass beneath it (a
     covered street, a hall) and where its walls are. Ramps are a gradient from the tint of their start to that of their end.
   - Nothing costly: a few hundred rectangles in a 2D canvas (mmDensity px per meter for the minimap, TAC_S for the strike), once per
     map; the relief is computed at 2 px per meter (4 for the strike).
   ========================================================================== */
const MMPAL = {
  bg: '#08090a', ground: '#2c3136', rim: 'rgba(190,198,204,0.55)', edge: 'rgba(5,6,7,0.92)', grid: 'rgba(255,255,255,0.045)',
  water: '#0d1a25', wave: '#1d3446', ring: 'rgba(239,85,67,0.8)', roof: '#464d53',
  tiers: ['#4a5157', '#6f777d', '#a3aaae', '#d6dadb'],
};
/* Minimap zoom: canvas units (240) per meter. 3.6: 67 m wide, the player slightly below center to see further ahead */
const MM_ZOOM = 3.6;
/* Background pixels per meter: enough to stay sharp on the densest screen (6 px per meter at 2x), fewer on phone (no pointless resampling) */
function mmDensity() { return COARSE ? 3.5 : 5; }
/* Tier of an object by the height of its top above the ground: -1 (flush, nothing) to 3 (building) */
function mmTier(t) { return t < 0.3 ? -1 : t < 1 ? 0 : t < 2.2 ? 1 : t < 4.5 ? 2 : 3; }
function mmHeightColor(h) { return h < 0.3 ? MMPAL.ground : MMPAL.tiers[Math.min(2, mmTier(h))]; }

/* The play zone's plan at S pixels per meter, with a margin of padX m on the sides and padZ m at the ends; grid: 10 m grid. Returns { c, X0, Z0 } (canvas and
   top-left corner in meters) */
function mapPlanPaint(S, padX, padZ, grid) {
  const X0 = MAP.x0 - padX, Z0 = MAP.z0 - padZ, W = Math.ceil((MAP.x1 + padX - X0) * S), H = Math.ceil((MAP.z1 + padZ - Z0) * S), RIM = 0.4 * S, EDGE = 0.33 * S;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const tx = (x) => (x - X0) * S, tz = (z) => (z - Z0) * S;
  const rect = (x0, x1, z0, z1, e = 0) => g.fillRect(tx(x0) - e, tz(z0) - e, (x1 - x0) * S + 2 * e, (z1 - z0) * S + 2 * e);
  g.fillStyle = MMPAL.bg; g.fillRect(0, 0, W, H);
  g.save(); g.beginPath(); g.rect(tx(MAP.x0), tz(MAP.z0), (MAP.x1 - MAP.x0) * S, (MAP.z1 - MAP.z0) * S); g.clip(); // everything stays inside the play zone
  // boxes that stop a soldier, with the height of their top and underside above the ground (dune relief counts)
  const boxes = [];
  for (const b of COL) {
    if (b.ray || b.inv) continue;
    const gy = gy0((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
    boxes.push({ b, t: b.y1 - gy, e: b.y0 - gy, a: (b.x1 - b.x0) * (b.z1 - b.z0) });
  }
  // sol
  if (VOID.on) {
    const isl = boxes.filter((o) => o.t > -1 && o.t < 1.9 && o.e < 0.5);
    g.fillStyle = MMPAL.rim; for (const o of isl) rect(o.b.x0, o.b.x1, o.b.z0, o.b.z1, RIM);
    g.fillStyle = MMPAL.ground; for (const o of isl) rect(o.b.x0, o.b.x1, o.b.z0, o.b.z1);
  } else {
    if (RELIEF.on) mmRelief(g, S, X0, Z0); else { g.fillStyle = MMPAL.ground; rect(MAP.x0, MAP.x1, MAP.z0, MAP.z1); }
    if (grid) {
      g.strokeStyle = MMPAL.grid; g.lineWidth = 1; g.beginPath();
      for (let x = Math.ceil(MAP.x0 / 10) * 10; x < MAP.x1; x += 10) { g.moveTo(Math.round(tx(x)) + 0.5, tz(MAP.z0)); g.lineTo(Math.round(tx(x)) + 0.5, tz(MAP.z1)); }
      for (let z = Math.ceil(MAP.z0 / 10) * 10; z < MAP.z1; z += 10) { g.moveTo(tx(MAP.x0), Math.round(tz(z)) + 0.5); g.lineTo(tx(MAP.x1), Math.round(tz(z)) + 0.5); }
      g.stroke();
    }
  }
  // water: the sea (outside the land rectangles) and the pools
  if (WATER.on) {
    const wb = WATER.box;
    g.fillStyle = MMPAL.water; rect(Math.max(wb[0], X0), Math.min(wb[1], MAP.x1 + padX), Math.max(wb[2], Z0), Math.min(wb[3], MAP.z1 + padZ));
    g.fillStyle = MMPAL.ground; for (const r of WATER.land) rect(r[0], r[1], r[2], r[3]);
    g.fillStyle = MMPAL.wave; // wave strokes, every other row offset
    for (let z = Math.ceil(MAP.z0 / 2.6) * 2.6, k = 0; z < MAP.z1; z += 2.6, k++) {
      for (let x = Math.ceil(Math.max(wb[0], MAP.x0) / 5) * 5 + (k % 2) * 2.5; x < Math.min(wb[1], MAP.x1); x += 5) if (waterAt(x, z) && waterAt(x + 1.6, z)) rect(x, x + 1.6, z, z + 0.3);
    }
  }
  for (const p of POOLS) {
    g.beginPath(); p.poly.forEach(([x, z], i) => (i ? g.lineTo(tx(x), tz(z)) : g.moveTo(tx(x), tz(z)))); g.closePath();
    g.fillStyle = MMPAL.water; g.fill(); g.strokeStyle = MMPAL.wave; g.lineWidth = 0.45 * S; g.stroke();
  }
  // bridges (floating islands): the deck, with the islands' edging
  for (const b of BRIDGES) {
    const [x0, x1, z0, z1] = b.axis === 'z' ? [b.c - b.w / 2, b.c + b.w / 2, b.a0, b.a1] : [b.a0, b.a1, b.c - b.w / 2, b.c + b.w / 2];
    g.fillStyle = MMPAL.rim; rect(x0, x1, z0, z1, RIM); g.fillStyle = MMPAL.tiers[0]; rect(x0, x1, z0, z1);
  }
  // ramps: gradient from the tint of their start to that of their end
  for (const r of RAMPS) {
    const gr = r.axis === 'x' ? g.createLinearGradient(tx(r.x0), 0, tx(r.x1), 0) : g.createLinearGradient(0, tz(r.z0), 0, tz(r.z1));
    gr.addColorStop(0, mmHeightColor(r.h0)); gr.addColorStop(1, mmHeightColor(r.h1));
    g.fillStyle = gr; rect(r.x0, r.x1, r.z0, r.z1);
  }
  // overhangs (underside above head height): a flat fill under the obstacles, whether you pass beneath or climb onto them
  g.fillStyle = MMPAL.roof; for (const o of boxes) if (o.e >= 1.7 && o.a >= 1.5) rect(o.b.x0, o.b.x1, o.b.z0, o.b.z1);
  // obstacles, from lowest to highest: a dark outline, then the tier's tint
  const objs = boxes.filter((o) => o.e < 1.7 && o.a >= 0.5 && mmTier(o.t) >= 0);
  for (let tier = 0; tier < 4; tier++) {
    const L = objs.filter((o) => mmTier(o.t) === tier); if (!L.length) continue;
    g.fillStyle = MMPAL.edge; for (const o of L) rect(o.b.x0, o.b.x1, o.b.z0, o.b.z1, EDGE);
    g.fillStyle = MMPAL.tiers[tier]; for (const o of L) rect(o.b.x0, o.b.x1, o.b.z0, o.b.z1);
  }
  g.restore();
  if (RING.on) { // round zone: the outside darkened, the circle drawn
    g.save(); g.beginPath(); g.rect(0, 0, W, H); g.arc(tx(RING.x), tz(RING.z), RING.r * S, 0, TAU, true); g.fillStyle = 'rgba(0,0,0,0.55)'; g.fill('evenodd');
    g.beginPath(); g.arc(tx(RING.x), tz(RING.z), RING.r * S, 0, TAU); g.strokeStyle = MMPAL.ring; g.lineWidth = 0.5 * S; g.stroke(); g.restore();
  }
  return { c, X0, Z0 };
}
/* Minimap background (14 m margin on the sides, 18 m at the ends: the player at the map's edge sees the black outside) and background of the airstrike map
   and the tablet (KS.plan: the play zone alone, at TAC_S pixels per meter, the size of the old survey) */
function buildMinimapStatic() {
  const S = mmDensity(), p = mapPlanPaint(S, 14, 18, true);
  HUD.mmStatic = p.c; HUD.mmS = S; HUD.mmX0 = p.X0; HUD.mmZ0 = p.Z0; HUD.mmFit = true; HUD.mmBg = MMPAL.bg;
  // marker tints: the interface tokens (shell.html, :root), read once
  const cs = getComputedStyle(document.documentElement), tok = (n, d) => cs.getPropertyValue(n).trim() || d;
  HUD.mmCol = { ally: tok('--ally', '#8FD16A'), enemy: tok('--enemy', '#EF5543'), acc: tok('--acc', '#F6C445') };
  HUD.mm = $('minimap').getContext('2d');
  KS.plan = mapPlanPaint(TAC_S, 0, 0, false).c;
  const tc = $('tacCanvas'); tc.width = KS.plan.width; tc.height = KS.plan.height; tc.style.aspectRatio = `${KS.plan.width} / ${KS.plan.height}`;
}
/* Dune relief: tint by height, shading from the top left, contour line every 2 m; computed at 2 px per meter then enlarged */
function mmRelief(g, S, X0, Z0) {
  const R = S > 4 ? 4 : 2, w = Math.ceil((MAP.x1 - MAP.x0) * R), h = Math.ceil((MAP.z1 - MAP.z0) * R);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const q = cv.getContext('2d'), im = q.createImageData(w, h), d = im.data, H = new Float32Array(w * h);
  let lo = 1e9, hi = -1e9; for (const v of RELIEF.h) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) H[j * w + i] = reliefAt(MAP.x0 + (i + 0.5) / R, MAP.z0 + (j + 0.5) / R);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i, hx = (H[j * w + Math.min(w - 1, i + 1)] - H[j * w + Math.max(0, i - 1)]) * R / 2, hz = (H[Math.min(h - 1, j + 1) * w + i] - H[Math.max(0, j - 1) * w + i]) * R / 2;
      let L = 0.17 + (H[k] - lo) / Math.max(1, hi - lo) * 0.12 + ((hx * 0.55 + hz * 0.55 + 0.65) / hyp3(hx, 1, hz) - 0.65) * 0.16;
      const lv = Math.floor(H[k] / 2);
      if ((i + 1 < w && Math.floor(H[k + 1] / 2) !== lv) || (j + 1 < h && Math.floor(H[k + w] / 2) !== lv)) L -= 0.045;
      const v = Math.round(clamp(L, 0, 1) * 255); d[k * 4] = v - 1; d[k * 4 + 1] = v + 2; d[k * 4 + 2] = v + 6; d[k * 4 + 3] = 255;
    }
  }
  q.putImageData(im, 0, 0); g.imageSmoothingEnabled = true;
  g.drawImage(cv, (MAP.x0 - X0) * S, (MAP.z0 - Z0) * S, (MAP.x1 - MAP.x0) * S, (MAP.z1 - MAP.z0) * S);
}
