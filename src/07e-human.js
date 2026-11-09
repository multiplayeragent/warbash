/* ==========================================================================
   HUMAN-LIKE BOT MOVEMENT
   What separates a soldier that "follows a path" from a player: it sees its walls (strafe steps and backsteps don't throw themselves into them), it feels when the
   scenery stops it (botBump: share of the intended movement that collisions take back) and gets out in a few tenths of a second in stages
   (botUnstick: sidestep, jump over a low wall, return to a free node of the network, new goal) instead of standing nose against a partition.
   ========================================================================== */
/* Free room for a bot's body at (x, z), feet at height y: no box stops it (same rules as collideCircle) */
function botSpotFree(x, z, y, crouch) {
  const r = 0.3, h = crouch ? 1.2 : 1.75, arr = queryBoxes(x - r, z - r, x + r, z + r); // a bit less than the body radius (0.34): a bot pressed against a wall isn't "stuck" for that
  for (let k = 0; k < arr.length; k++) {
    const c = arr[k];
    if (c.ray || c.y1 <= y + STEP || c.y0 >= y + h) continue;
    const dx = x - clamp(x, c.x0, c.x1), dz = z - clamp(z, c.z0, c.z1);
    if (dx * dx + dz * dz < r * r) return false;
  }
  return true;
}
/* Free length (m, at most len) ahead of the bot in unit direction (dx, dz): stops at the first obstacle, a step too high and
   a void or a drop of more than 0.7 m (no strafing at the edge of a roof, island or pool) */
function botRoom(b, dx, dz, len) {
  let y = b.pos.y;
  for (let s = 0.4; s <= len + 0.01; s += 0.4) {
    const x = b.pos.x + dx * s, z = b.pos.z + dz * s;
    if (!botSpotFree(x, z, y, b.crouch)) return s - 0.4;
    const g = groundHeight(x, z, y + 0.05, 0.3);
    if (g < y - 0.7 || (VOID.on && g <= VOID.floor + 1)) return s - 0.4;
    y = Math.max(g, y - 0.2);
  }
  return len;
}
/* Strafe side: prefer (-1 or 1) if the bot has at least 1.3 m of room there, otherwise the other side, otherwise 0 (stay in place). The right-hand side of the
   look (yaw) is (cos, -sin), as in updateBot. */
function botSide(b, yaw, prefer) {
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  if (botRoom(b, rx * prefer, rz * prefer, 1.3) >= 1.2) return prefer;
  if (botRoom(b, -rx * prefer, -rz * prefer, 1.3) >= 1.2) return -prefer;
  return 0;
}
/* Nearest free network node reachable in a straight line (returns its index, -1 if none) */
function botNearNode(b) {
  const cx0 = Math.floor(b.pos.x - NAV.x0), cz0 = Math.floor(b.pos.z - NAV.z0);
  let best = -1, bd = 1e9;
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
    const cx = cx0 + dx, cz = cz0 + dz; if (cx < 0 || cz < 0 || cx >= NAV.W || cz >= NAV.H) continue;
    const cell = NAV.cells[cz * NAV.W + cx];
    for (let i = 0; i < cell.length; i++) {
      const id = cell[i], dy = NAV.ny[id] - b.pos.y; if (dy > 0.6 || dy < -0.8 || NAV.comp[id] !== NAV.mainComp) continue;
      const ex = NAV.nx[id] - b.pos.x, ez = NAV.nz[id] - b.pos.z, d = Math.sqrt(ex * ex + ez * ez); if (d >= bd) continue;
      if (d > 0.3 && botRoom(b, ex / d, ez / d, d) < d - 0.05) continue;
      bd = d; best = id;
    }
  }
  return best;
}

/* ---------- The scenery stops the bot ---------- */
const BUMP = { tc: 0.18, lost: 0.5, minV: 1.2, hold: 0.28 };
/* Called after ctlMove: b.bump tracks (smoothed) the share of the intended step (b.vel, before collision) that the scenery took back, 0 free to 1 against a wall
   head-on; beyond half for BUMP.hold seconds while walking, the bot looks for a way out */
function botBump(b, dt, x0, z0, now) {
  const cx = b.vel.x * dt, cz = b.vel.z * dt, c2 = cx * cx + cz * cz;
  let lost = 0;
  if (c2 > 1e-6 && b.edgeT !== MATCH.time && now - b.spawnAt > 0.6) lost = clamp(1 - ((b.pos.x - x0) * cx + (b.pos.z - z0) * cz) / c2, 0, 1);
  b.bump += (lost - b.bump) * (1 - Math.exp(-dt / BUMP.tc));
  if (b.bump > BUMP.lost && c2 > BUMP.minV * BUMP.minV * dt * dt) b.bumpT += dt; else b.bumpT = Math.max(0, b.bumpT - dt * 2);
  if (b.bumpT > BUMP.hold) { b.bumpT = 0; botUnstick(b, now); }
}
/* Unstick exit, in stages (b.unstickN rises as long as a new block comes less than 3 s after the previous one):
   0 new path and sidestep to the clear side; 1 jump if a low wall is ahead (not in combat), otherwise return to a free node; 2 return to a free node,
   new goal, leave cover; 3 and above back up then new goal; 6: placed on the nearest free node (last resort, never seen in
   practice: stage 3 suffices) */
function botUnstick(b, now) {
  const n = now - b.unstickAt < 3 ? b.unstickN + 1 : 0;
  b.unstickN = n; b.unstickAt = now; b.bump = 0;
  b.path = null; b.repathT = 0;
  const hl = hyp(b.vel.x, b.vel.z) || 1, hx = b.vel.x / hl, hz = b.vel.z / hl;
  if (b.tactic === 'fight') { b.strafeDir = -(b.strafeDir || 1); b.moveT = Math.min(b.moveT || 0, 0.15); }
  if (n === 0) {
    const s = botSide(b, Math.atan2(-hx, -hz), Math.random() < 0.5 ? 1 : -1); // to the right or left of the heading, on the side where there is room
    b.sideDir = s; b.sideT = s ? 0.45 : 0;
    if (!s) b.backT = 0.5;
    return;
  }
  if (n === 1 && b.tactic !== 'fight' && botLedge(b, hx, hz) > 0) { b.jumpT = 0.3; return; } // in combat, a low wall bumped into while strafing isn't worth a jump
  if (n <= 2 || n === 5) {
    const id = botNearNode(b);
    if (id >= 0) { b.recX = NAV.nx[id]; b.recZ = NAV.nz[id]; b.recT = 1.0; }
    if (n === 2) { b.goal = null; if (b.tactic === 'cover') { releaseCover(b); b.tactic = 'fight'; } b.forceDecide = true; }
    return;
  }
  b.backT = 0.7; b.goal = null; if (b.cover) releaseCover(b); b.forceDecide = true;
  if (n >= 6) { const id = botNearNode(b); if (id >= 0) { b.pos.x = NAV.nx[id]; b.pos.z = NAV.nz[id]; b.pos.y = NAV.ny[id]; b.vel.set(0, 0, 0); b.vy = 0; b.unstickN = 0; } }
}
/* Height of the low wall that can be cleared by jumping right ahead (unit direction (hx, hz)), -1 if there is none: a box between the auto
   step and 1.05 m (the jump rises 1.04 m), wide enough to land on, with no low ceiling above */
function botLedge(b, hx, hz) {
  const x = b.pos.x + hx * 0.75, z = b.pos.z + hz * 0.75, y = b.pos.y;
  let top = -1;
  const arr = queryBoxes(x - 0.2, z - 0.2, x + 0.2, z + 0.2);
  for (let k = 0; k < arr.length; k++) {
    const c = arr[k];
    if (c.ray || c.inv || x < c.x0 || x > c.x1 || z < c.z0 || z > c.z1) continue;
    if (c.y1 > y + STEP + 0.03 && c.y1 <= y + 1.05 && c.y0 < y + STEP) top = Math.max(top, c.y1);
  }
  if (top < 0) return -1;
  const x2 = b.pos.x + hx * 1.5, z2 = b.pos.z + hz * 1.5;                       // room to land, and the head clears
  if (Math.abs(groundHeight(x2, z2, top + 0.05, 0.2) - top) > 0.05 || ceilingAbove(x2, z2, top + 0.3, 0.3) < top + 1.8 || ceilingAbove(b.pos.x, b.pos.z, y + 0.3, 0.3) < y + 2.9) return -1;
  return top - y;
}

/* ---------- Temperament ----------
   Each bot has its own for the whole match, as a player has habits: the charger slides, the methodical one looks around
   and advances steadily, the cautious one forces nothing. slide: taste for sliding; scan: glances around while walking and cautious pace.
   Values vary a bit from bot to bot, and the weapon matters: a sniper doesn't fidget, a shotgun or submachine gun
   charges. Difficulty level also matters (DIFF.flair): a Rookie rarely slides. */
const BOT_STYLES = [
  { w: 1.0, slide: 0.85, scan: 0.3 },  // rusher
  { w: 1.2, slide: 0.4, scan: 0.9 },   // methodical
  { w: 1.6, slide: 0.6, scan: 0.55 },  // all-rounder
  { w: 0.9, slide: 0.2, scan: 0.75 },  // prudent
];
function botPers() {
  let r = Math.random() * BOT_STYLES.reduce((a, s) => a + s.w, 0), st = BOT_STYLES[0];
  for (const s of BOT_STYLES) { st = s; r -= s.w; if (r <= 0) break; }
  return { slide: clamp(st.slide + rand(-0.15, 0.15), 0, 1), scan: clamp(st.scan + rand(-0.15, 0.15), 0.1, 1) };
}
/* Taste for a movement ('slide') given the weapon held */
function botFlair(b, k) {
  const ai = b.weapon.ai, m = ai.sniper ? 0.25 : ai.shotgun ? 1.25 : ai.rush ? 1.15 : 1;
  return b.pers[k] * m * botDiff().flair;
}
/* Slide in the running direction, if there is room (4.6 m free, no wall, no void, no drop) and if the bot runs fast enough;
   a bot doesn't slide more than once every 5 s. Returns true if the request is made (the controller takes it while sprinting). */
function botTrySlide(b, now) {
  const v = Math.sqrt(b.vel.x * b.vel.x + b.vel.z * b.vel.z);
  if (v < 4.2 || !b.onGround || b.crouch || b.slideT > 0 || b.slideCd > 0 || now - b.slideAt < 5) return false;
  if (botRoom(b, b.vel.x / v, b.vel.z / v, 5) < 4.6) return false;
  b.input.slide = true; b.slideAt = now; return true;
}

/* Should it jump now to clear the path's jump link (a, p) (03-nav.js, navLeaps)? p.lead is the distance, from a, where the body touches
   the obstacle; the bot jumps a little before, the earlier the faster it runs: it must have left the ground when it reaches the foot of the low wall.
   Only if it is heading toward the obstacle and hasn't passed it: a bot passing by, backing up or doing something else doesn't jump for nothing */
function botLeapNow(b, a, p) {
  if (!p.jump || !b.onGround || b.crouch) return false;
  const ux = p.x - a.x, uz = p.z - a.z, L = Math.sqrt(ux * ux + uz * uz) || 1, rx = b.pos.x - a.x, rz = b.pos.z - a.z;
  const s = (rx * ux + rz * uz) / L, side = Math.abs(rx * uz - rz * ux) / L, v = Math.sqrt(b.vel.x * b.vel.x + b.vel.z * b.vel.z);
  return side < 0.7 && p.lead - s < 0.25 + 0.1 * v && s < p.lead + 0.8 && (b.vel.x * ux + b.vel.z * uz) / L > 0.8;
}

/* ---------- Ears ----------
   Running footsteps, a slide, someone walking very close: a player hears them without seeing. The attention gauge rises (never
   up to spotting: you must see to shoot), the bot turns its head toward the noise and, one time in two if it was wandering, goes to look. Walking
   crouched or slowly isn't heard. Returns the gauge. */
function botEars(b, e, d, aw, dt, now, D) {
  const sp = Math.sqrt(e.vel.x * e.vel.x + e.vel.z * e.vel.z), R = e.slideT > 0 ? 12 : sp > 4.6 ? 11 : sp > 2.4 && !e.crouch ? 5 : 0;
  if (R === 0 || d > R || Math.abs(e.pos.y - b.pos.y) > 3.5) return aw;
  aw = Math.min(0.9, aw + 1.1 * (1 - d / R) * D.see * dt);
  if (aw > 0.45 && now - b.stepHeardT > 2) {
    b.stepHeardT = now; botLookAt(b, e.pos, now, 0.9); b.warnT = now + 8;
    if (b.tactic === 'roam' && Math.random() < 0.45) { b.lastKnown.copy(botGuess(b.pos, e.pos, 2, 0.2)); b.lastSeenT = now - 2.2; b.target = null; b.decideT = Math.min(b.decideT, 0.3); }
    else if ((b.tactic === 'hunt' || b.tactic === 'search') && e === b.chaseE) { b.lastKnown.copy(botGuess(b.pos, e.pos, 2, 0.15)); if (b.tactic === 'search') b.tactic = 'hunt'; } // the one it is looking for gave itself away: it follows the noise
  }
  return aw;
}
/* A soldier's death: the killed bot remembers where the shot came from (it may go back there, see initTactics), its nearby teammates turn
   toward the attacker and stay wary for a while */
function botDeathNote(v, a) {
  const now = MATCH.time;
  if (!v.isPlayer && !v.isRemote && a && a !== v) v.grudge = { x: a.pos.x, z: a.pos.z, t: now };
  if (!a || a === v || allied(a, v)) return;
  for (const o of entities) {
    if (o === v || o.isPlayer || o.isRemote || !o.alive || o.off || o.visible || !allied(o, v) || o.pos.distanceTo(v.pos) > 25) continue;
    botLookAt(o, botGuess(o.pos, a.pos, 4, 0.12), now, 1.2); o.warnT = now + 10; o.fear = Math.min(2, o.fear + 0.25); o.decideT = Math.min(o.decideT, rand(0.3, 0.7));
  }
}
/* Grenade: does the (arced) trajectory have room to pass? The middle of the path, two meters higher, is in view of the thrower and the target */
const _ne = new V3(), _na = new V3(), _nt = new V3();
function botNadeClear(b, t) {
  entEye(b, _ne); _na.set((_ne.x + t.x) / 2, Math.max(_ne.y, t.y) + 2.2, (_ne.z + t.z) / 2); _nt.set(t.x, t.y + 0.6, t.z);
  return lineClear(_ne, _na) && lineClear(_na, _nt);
}
/* Fleeing a grenade: of eight directions, the one that moves away from the danger (never toward it) and has room (up to 5 m), rather than the
   exact right side that throws a bot against the wall opposite. The result is in b.fleeX, b.fleeZ (unit vector). */
function botFlee(b, from) {
  const ax = b.pos.x - from.x, az = b.pos.z - from.z, al = Math.sqrt(ax * ax + az * az) || 1;
  let best = -1e9, bx = ax / al, bz = az / al;
  for (let k = 0; k < 8; k++) {
    const a = k * 0.7854, dx = Math.cos(a), dz = Math.sin(a), away = (dx * ax + dz * az) / al;
    if (away < -0.2) continue;
    const room = botRoom(b, dx, dz, 5), sc = room * 0.7 + away * 3 + (room > 3.5 ? 1 : 0);
    if (sc > best) { best = sc; bx = dx; bz = dz; }
  }
  b.fleeX = bx; b.fleeZ = bz;
}
