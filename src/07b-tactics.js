/* ==========================================================================
   TACTICAL AI
   Precomputed cover points (low to shoot crouched over the top,
   high to hide and step out sideways), decisions based on the situation
   (health, ammo, fire pressure, force balance, weapon, temperament)
   and execution: sprint, aimed walk, strafing, crouch, popping out.
   ========================================================================== */
const COVERS = [], COVER_GRID = new Map(), CG = 4;
function buildCovers() {
  COVERS.length = 0; COVER_GRID.clear();
  const zMax = CURMAP.def.coverZ;
  for (let id = 0; id < NAV.count; id++) {
    if (NAV.comp[id] !== NAV.mainComp) continue;
    const x = NAV.nx[id], y = NAV.ny[id], z = NAV.nz[id];
    if (((Math.floor(x) + Math.floor(z)) & 1) !== 0) continue;
    if (Math.abs(z) > zMax) continue;
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const px = x + nx * 0.8, pz = z + nz * 0.8;
      let top = -1;
      for (const c of queryBoxes(px - 0.05, pz - 0.05, px + 0.05, pz + 0.05)) {
        if (c.ray || c.inv || px < c.x0 || px > c.x1 || pz < c.z0 || pz > c.z1 || c.y0 > y + 0.5) continue;
        top = Math.max(top, c.y1);
      }
      const h = top - y;
      if (h < 0.85) continue;
      const cv = { x, y, z, nx, nz, low: h < 1.45, owner: null, badT: -99 };
      COVERS.push(cv);
      const k = Math.floor(x / CG) * 1000 + Math.floor(z / CG);
      let a = COVER_GRID.get(k); if (!a) COVER_GRID.set(k, a = []); a.push(cv);
      break;
    }
  }
}
function coverNear(x, z, r, out) {
  out.length = 0;
  for (let gx = Math.floor((x - r) / CG); gx <= Math.floor((x + r) / CG); gx++)
    for (let gz = Math.floor((z - r) / CG); gz <= Math.floor((z + r) / CG); gz++) { const a = COVER_GRID.get(gx * 1000 + gz); if (a) for (const c of a) out.push(c); }
  return out;
}
const _cand = [], _ce = new V3(), _cp = new V3();
/* Cover protected from the threat (the line of fire to the crouched torso is blocked) */
function findCover(b, threatEye, maxD = 15) {
  const list = coverNear(b.pos.x, b.pos.z, maxD, []);
  _cand.length = 0;
  for (const c of list) {
    if (c.owner && c.owner !== b && c.owner.alive) continue;
    if (MATCH.time - c.badT < 30 || Math.abs(c.y - b.pos.y) > 1.3) continue; // badT: a cover the network doesn't connect to the bot, set aside for a while
    const d = hyp(c.x - b.pos.x, c.z - b.pos.z); if (d > maxD) continue;
    const tx = threatEye.x - c.x, tz = threatEye.z - c.z, td = hyp(tx, tz);
    if (td < 6) continue;
    const facing = (c.nx * tx + c.nz * tz) / td; if (facing < 0.4) continue;
    // an ally already within 2.5 m: move aside
    let crowd = 0; for (const o of entities) if (o !== b && o.alive && allied(o, b) && hyp(o.pos.x - c.x, o.pos.z - c.z) < 2.5) crowd++;
    const pref = b.weapon.ai.sniper ? (td < 25 ? 8 : 0) : b.weapon.ai.shotgun ? (td > 16 ? 6 : 0) : (td > 45 ? 4 : 0);
    const score = d * 0.9 - facing * 4 + (c.low ? -1 : 1) + crowd * 6 + pref + Math.random() * 2;
    _cand.push([score, c]);
  }
  _cand.sort((p, q) => p[0] - q[0]);
  for (let i = 0; i < Math.min(7, _cand.length); i++) {
    const c = _cand[i][1];
    if (lineClear(threatEye, _cp.set(c.x, c.y + 0.75, c.z))) continue;
    if (c.low && lineClear(threatEye, _cp.set(c.x, c.y + 1.2, c.z)) === false && Math.random() < 0.5) continue; // prefers a cover from which one can shoot
    return c;
  }
  return null;
}
function releaseCover(b) { if (b.cover) { if (b.cover.owner === b) b.cover.owner = null; b.leftCoverT = MATCH.time; } b.cover = null; }
/* False if no path leads to the cover: it is then set aside for a while and the bot picks something else */
function setCover(b, c) {
  releaseCover(b);
  b.coverGoal = new V3(c.x, c.y, c.z); setPath(b, b.coverGoal);
  if (!b.path) { c.badT = MATCH.time; return false; }
  c.owner = b; b.cover = c; b.tactic = 'cover'; b.inCoverT = 0; b.atCover = false; b.peeking = false; b.peekT = rand(0.4, 1); b.peekSide = Math.random() < 0.5 ? -1 : 1;
  return true;
}
/* Flanking point: on the target's flank, 7-13 m away, from where one sees the place it hid. Flanking is for taking it
   from the side: a point with no view of it, up to 16 m, took the bot away from the fight and the player saw it leave. */
const _fk = new V3(), _fp = new V3();
function flankPoint(b, target) {
  const base = Math.atan2(b.pos.z - target.z, b.pos.x - target.x); _fk.set(target.x, target.y + 1.1, target.z);
  for (let k = 0; k < 10; k++) {
    const a = base + (Math.random() < 0.5 ? 1 : -1) * rand(1.1, 1.9), r = rand(7, 13);
    const x = clamp(target.x + Math.cos(a) * r, MAP.x0 + 2, MAP.x1 - 2), z = clamp(target.z + Math.sin(a) * r, MAP.z0 + 2, MAP.z1 - 2);
    const id = navNode(x, target.y, z);
    if (id < 0 || NAV.comp[id] !== NAV.mainComp || hyp(NAV.nx[id] - x, NAV.nz[id] - z) > 2.5) continue;
    if (!lineClear(_fp.set(NAV.nx[id], NAV.ny[id] + 1.5, NAV.nz[id]), _fk)) continue;
    return new V3(NAV.nx[id], NAV.ny[id], NAV.nz[id]);
  }
  return null;
}
/* Pursuit: an opponent it just saw, close or at mid-distance (45 m), in this life, and lost sight of for less than
   D.chase seconds. Not in domination (the points wait, decideTactic limits the hunt there), not for the sniper (it holds its post). */
function botChasing(b, now, D) {
  const E = b.chaseE;
  return !!E && MATCH.mode !== 'dom' && !b.weapon.ai.sniper && E.alive && !E.off && (E.spawnAt || 0) <= b.contactT && b.contactD < 45 && now - b.contactT < D.chase;
}
/* Search: arrived where it lost its opponent without seeing them again, the bot doesn't leave right away (the hidden player two steps behind a
   crate saw the bots turn around). It sweeps the surroundings with its gaze (b.sweepT), preferably toward where the opponent was running, then goes
   to check nearby hiding spots, places its position can't see, and sweeps again from there; three at most, and the pursuit (D.chase)
   stops it earlier. */
const _se = new V3(), _sp = new V3();
function botSearchPt(b) {
  const L = b.searchC, eye = entEye(b, _se), vx = b.lostVX, vz = b.lostVZ, vl = hyp(vx, vz);
  const cx0 = Math.floor(L.x - NAV.x0), cz0 = Math.floor(L.z - NAV.z0);
  let best = -1, bs = -1e9;
  for (let dz = -8; dz <= 8; dz += 2) for (let dx = -8; dx <= 8; dx += 2) { // every other node in each direction: 2 m between two tries
    const cx = cx0 + dx, cz = cz0 + dz; if (cx < 0 || cz < 0 || cx >= NAV.W || cz >= NAV.H) continue;
    const cell = NAV.cells[cz * NAV.W + cx];
    for (let i = 0; i < cell.length; i++) {
      const id = cell[i]; if (NAV.comp[id] !== NAV.mainComp || Math.abs(NAV.ny[id] - L.y) > 1.6) continue;
      const x = NAV.nx[id], z = NAV.nz[id], ex = x - L.x, ez = z - L.z, d = Math.sqrt(ex * ex + ez * ez);
      if (d < 2.5 || d > 9 || hyp(x - b.pos.x, z - b.pos.z) < 2.5) continue;
      let done = false; for (const p of b.searchPts) if (hyp(p.x - x, p.z - z) < 3) { done = true; break; }
      if (done) continue;
      let sc = -d * 0.35 + Math.random() * 1.5 + (vl > 1 ? 2.5 * (ex * vx + ez * vz) / (d * vl) : 0); // toward where it was running
      if (sc + 5 <= bs) continue;                                                         // even hidden, it wouldn't get past in front
      if (!lineClear(eye, _sp.set(x, NAV.ny[id] + 1.2, z))) sc += 5;                      // a hiding spot: from here, it can't be seen
      if (sc > bs) { bs = sc; best = id; }
    }
  }
  return best < 0 ? null : new V3(NAV.nx[best], NAV.ny[best], NAV.nz[best]);
}
function botSearchStart(b) {
  b.tactic = 'search'; b.stealth = undefined; b.searchN = 0; b.searchC = b.lastKnown.clone(); b.searchPts = [b.searchC.clone()];
  botSearchNext(b, true);
}
/* Next hiding spot (except the last time), then gaze sweep from here: toward where the opponent was running the first time, otherwise straight ahead */
function botSearchNext(b, first) {
  let p = null;
  for (let k = 0; k < 2 && !p && b.searchN < 3; k++) { p = botSearchPt(b); if (p) { b.searchPts.push(p.clone()); setPath(b, p); if (!b.path) p = null; } }
  b.searchP = p;
  const vl = hyp(b.lostVX, b.lostVZ);
  b.sweepYaw = first && vl > 1 ? Math.atan2(-b.lostVX, -b.lostVZ) : b.lookYaw;
  b.sweepDur = b.sweepT = first ? rand(1.6, 2.2) : rand(1.0, 1.4); b.sweepA = (first ? 1.7 : 1.2) * (Math.random() < 0.5 ? -1 : 1);
}
function initTactics(b) {
  if (!b.pers) b.pers = botPers();
  b.aggr = clamp(b.weapon.ai.aggr + rand(-0.15, 0.15), 0.05, 0.95);
  const mates = entities.filter((o) => !o.isPlayer && o.team === b.team);
  b.lane = Math.random() < 0.35 ? pick(LANE_ROLES) : LANE_ROLES[Math.max(0, mates.indexOf(b)) % LANE_ROLES.length]; b.holdT = 0; // the usual route for its rank, or, one life in three, another
  b.revenge = b.grudge && MATCH.mode !== 'dom' && MATCH.time - b.grudge.t < 90 && Math.random() < 0.4 * (0.5 + b.aggr) ? b.grudge : null; b.grudge = null; // sometimes go back to where it was killed
  b.tactic = 'roam'; b.decideT = 0; b.suppr = 0; b.fear = 0; b.lastHitT = -9; b.cover = null; b.inCoverT = 0; b.move = 'strafe'; b.moveT = 0; b.sprinting = false;
  b.chaseE = null; b.contactT = -99; b.lostWeak = false; b.searchP = null; b.sweepT = 0; b.startleT = 0; b.startleAt = -99;
}

function decideTactic(b, now) {
  if (mechaBotDecide(b, now)) return; // an enemy mecha very close: take cover at a good distance, then shoot it (08f-mecha.js)
  const T = b.target, vis = b.visible && T && T.alive, def = b.weapon, D = botDiff(), dom = MATCH.mode === 'dom';
  // an engaged opponent who takes cover is pursued (botChasing: D.chase, 8 to 18 s), a mere lead (noise, impact) for less
  // time; in domination, no long hunting: the points wait
  let hunting = botChasing(b, now, D) || now - b.lastSeenT < (dom ? 3 : D.mem + 3);
  if (dom && !vis && b.sq) { // a lead far from the point it holds or is taking isn't worth leaving it
    const p = DOM.pts[b.sq.p];
    if (p && hyp(b.lastKnown.x - p.x, b.lastKnown.z - p.z) > 16 && hyp(b.pos.x - p.x, b.pos.z - p.z) > 12) hunting = false;
  }
  if (!vis && !hunting) { if (b.tactic !== 'roam') { releaseCover(b); b.tactic = 'roam'; b.goal = null; b.atCover = false; } return; }
  // a player holding a position (sniper on the balcony, lookout) doesn't leave it for a mere noise
  const holding = b.holdT > 0 || (b.goal && b.goal.hold && b.goal.distanceTo(b.pos) < 5);
  if (!vis && holding && b.tactic === 'roam' && now - b.lastHitT > 2 && (def.ai.sniper || Math.random() < 0.6)) return;
  const tp = vis ? T.pos : b.lastKnown, dist = hyp(tp.x - b.pos.x, tp.z - b.pos.z), ideal = def.ai.ideal;
  const hpLow = b.health < 40, needReload = !!b.arms.reload || armsW(b).mag <= Math.ceil(def.mag * 0.25);
  const targetWeak = vis && (T.isPlayer ? (!!PL.reload || T.health < 50) : (!!(T.arms && T.arms.reload) || T.health < 50));
  let allies = 0, foes = 0;
  for (const o of entities) { if (!o.alive || o === b) continue; const d = hyp(o.pos.x - b.pos.x, o.pos.z - b.pos.z); if (d < 22) { if (allied(o, b)) allies++; else foes++; } }
  const eye = vis ? entEye(T, _ce) : _ce.set(b.lastKnown.x, b.lastKnown.y + 1.6, b.lastKnown.z);
  // already in cover: stay as long as it's useful and safe
  if (b.tactic === 'cover' && b.cover) {
    const inPlace = hyp(b.cover.x - b.pos.x, b.cover.z - b.pos.z) < 1.2;
    const compromised = inPlace && vis && lineClear(eye, _cp.set(b.cover.x, b.cover.y + 0.75, b.cover.z));
    const stay = (hpLow || needReload) ? 99 : lerp(3.5, 1.6, b.aggr) + (def.ai.sniper ? 5 : 0);
    if (!compromised && (b.health < 80 && (hpLow || needReload) || b.suppr > 1.2 || b.inCoverT < stay) && !targetWeak) return;
    if (compromised && (hpLow || needReload)) { const c = findCover(b, eye); if (c && setCover(b, c)) return; }
  }
  const justLeft = now - (b.leftCoverT || -99) < 5;
  // taking cover is a choice, not a reflex: not under mere fire, but wounded, out of ammo, overwhelmed or truly
  // frightened (accumulating impacts), and then toward a nearby cover, without running across the map
  let wantCover = hpLow || needReload || (b.fear > 1.0 && Math.random() < 0.5 * (1 - b.aggr * 0.6)) || (b.suppr > 1.1 && Math.random() < 0.35 * (1 - b.aggr)) || (vis && foes > allies + 2 && Math.random() < 0.6);
  const coverR = hpLow || needReload ? 15 : 8;
  if (!wantCover && vis && dist > 16 && !justLeft) wantCover = Math.random() < 0.18 * (1 - b.aggr);
  if (def.ai.sniper && vis && !justLeft) wantCover = wantCover || Math.random() < 0.45;
  let wantPush = !wantCover && (targetWeak || (def.ai.rush && dist > ideal + 4) || Math.random() < b.aggr * 0.35);
  if (vis) {
    if (wantCover) { const c = findCover(b, eye, coverR); if (c && setCover(b, c)) return; }
    releaseCover(b); b.atCover = false;
    b.tactic = wantPush ? 'push' : 'fight';
    if (wantPush) { setPath(b, T.pos); b.rush = Math.random() < (def.ai.rush ? 0.55 : 0.25) * (0.4 + b.pers.slide); }
    return;
  }
  if ((hpLow || needReload) && b.tactic !== 'cover') { const c = findCover(b, eye); if (c && setCover(b, c)) return; }
  if (b.tactic === 'cover' && (hpLow || needReload)) return;
  // it is already searching the surroundings (botSearchStart): it continues, unless a fresh clue (noise, impact) moved the lead
  if (b.tactic === 'search' && b.searchC && b.searchC.distanceTo(b.lastKnown) < 3) return;
  // target entrenched out of sight: flank, assault or cautious hunt
  releaseCover(b);
  const flankers = entities.filter((o) => o.alive && allied(o, b) && o.tactic === 'flank').length;
  if (b.tactic !== 'flank' && !def.ai.sniper && now - b.lastSeenT > 1.2 && flankers < 2 && Math.random() < 0.3 + b.aggr * 0.35) {
    const f = flankPoint(b, b.lastKnown);
    if (f) { b.tactic = 'flank'; b.flankPt = f; setPath(b, f); return; }
  }
  if (b.tactic === 'flank' && b.flankPt && b.flankPt.distanceTo(b.pos) > 2) return;
  b.tactic = Math.random() < b.aggr + (b.lostWeak ? 0.35 : 0) ? 'push' : 'hunt'; // left wounded or while reloading: press it
  setPath(b, b.lastKnown);
}

function updateBot(b, dt, now) {
  if (b.isRemote) return; // driven by the network (see netUpdate)
  if (b.off) return;      // out of play (deathmatch with 8 players)
  if (MATCH.online && !b.netBot) { b.alive = false; b.model.root.visible = false; return; } // online, only the host's bots play
  if (!b.alive) {
    releaseCover(b);
    animSoldier(b, dt);
    if (MATCH.state === 'playing') { b.respawnT -= dt; if (b.respawnT <= 0) { spawnEntity(b); initTactics(b); } }
    return;
  }
  if (b.aggr === undefined) initTactics(b);
  if (playHold()) { // start countdown, host migration (09y-countdown.js): in place, weapon lowered, nothing is decided
    const I = b.input; I.mx = 0; I.mz = 0; I.sprint = false; I.jump = false; I.fire = false; I.firePressed = false; I.ads = false;
    ctlMove(b, dt); animSoldier(b, dt); return;
  }
  const D = botDiff(), def = b.weapon;
  b.senseT -= dt; if (b.senseT <= 0) { b.senseT = rand(0.12, 0.22); botSense(b, now); }
  if (now - b.lastHitT > 5 && b.health < 100) b.health = Math.min(100, b.health + 30 * dt);
  b.suppr = Math.max(0, b.suppr - dt * 0.45); b.fear = Math.max(0, b.fear - dt * 0.3);
  if (MATCH.mode === 'dom') squadMaybe(b.team, now);
  if (b.sq && b.sqSeen !== b.sq.rev) { b.sqSeen = b.sq.rev; if (b.tactic === 'roam') { b.goal = null; b.path = null; b.holdT = 0; } } // the team plan changed: set off again
  b.lookYaw = b.yaw; b.dmgMul = D.dmg;
  b.decideT -= dt;
  if (b.decideT <= 0 || b.forceDecide) { b.forceDecide = false; b.decideT = rand(0.6, 1.2); decideTactic(b, now); }

  const T = b.target, vis = !!(b.visible && T && T.alive);
  b.nadeCd -= dt;
  if (b.nadeOn && b.nades > 0 && b.nadeCd <= 0 && b.throwT <= 0 && b.onGround && b.nadeType === 'smoke') {
    // smoke: wounded under fire from an opponent in view, a cloud between them, then a shelter (decideTactic)
    const d = vis ? T.pos.distanceTo(b.pos) : 0;
    if (vis && b.health < 55 && d > 8 && d < 40) {
      const pt = b.pos.clone().lerp(T.pos, Math.min(6, d * 0.4) / d);
      if (botNadeClear(b, pt)) { botThrowNade(b, pt); b.nadeCd = rand(14, 24); b.forceDecide = true; }
    }
  } else if (b.nadeOn && b.nades > 0 && b.nadeCd <= 0 && b.throwT <= 0 && b.onGround) { // nadeOn: it plans to throw one this life (drawn at respawn)
    // a grenade (frag or flash) to flush out an opponent who just took cover, or who holds a position in range
    if (b.wasVis && !vis && T && T.alive && now - b.lastSeenT < 0.8) {
      const nd = b.pos.distanceTo(b.lastKnown);
      if (nd > 8 && nd < 24 && Math.random() < 0.6 && botNadeClear(b, b.lastKnown)) { botThrowNade(b, b.lastKnown); b.nadeCd = rand(12, 24); }
    } else if (vis && b.tactic === 'fight' && b.standT > 3.5 && T.pos.distanceTo(b.pos) > 10 && T.pos.distanceTo(b.pos) < 24 && botNadeClear(b, T.pos)) { botThrowNade(b, T.pos); b.nadeCd = rand(12, 24); b.standT = 0; }
  }
  b.standT = vis && b.tactic === 'fight' && hyp(T.vel.x, T.vel.z) < 1.2 ? b.standT + dt : 0;
  b.wasVis = vis;
  let wishX = 0, wishZ = 0, speed = 0, faceYaw = b.lookYaw, facePitch = 0, canShoot = vis, sprint = false;
  let dist = 99, denied = false;
  if (vis) {
    // "human" aim: the crosshair catches up with the target with a lag (a running target is harder to follow), drifts around
    // it then tightens with exposure time; an impact or passing fire disturbs it. Bullets go exactly where
    // the bot is looking: a missed bullet is missed because its aim is off. If too many opponents are already aiming at the player,
    // this one shoots wide (suppressive fire) instead of adding bullets to the pile.
    denied = !botToken(b, T, now, D.tokens);
    const eye = entEye(b, _v1), spot = b.aimHead && !denied ? entHead(T, _v2) : entChest(T, _v2);
    if (b.aimT !== T) { // first look: the crosshair starts from where the bot was looking
      b.aimT = T; const cp = Math.cos(b.pitch), L = eye.distanceTo(spot);
      b.aimP.set(eye.x - Math.sin(b.lookYaw) * cp * L, eye.y + Math.sin(b.pitch) * L, eye.z - Math.cos(b.lookYaw) * cp * L);
    }
    b.aimP.lerp(spot, 1 - Math.exp(-dt / D.lag));
    const aim = _v2.copy(b.aimP);
    dist = eye.distanceTo(aim);
    const moving = hyp(b.vel.x, b.vel.z) > 1 ? 1.4 : 1, tMov = hyp(T.vel.x, T.vel.z) > 3 ? 1.3 : 1;
    const hit = now - b.lastHitT, flin = hit < 0.5 ? 1 + 1.6 * D.flinch * (1 - hit / 0.5) : 1;
    const errA = D.err * (0.35 + 0.65 * Math.exp(-b.seenT / D.settle)) * moving * tMov * (def.ai.sniper ? 0.8 : 1) * (T.isPlayer && T.crouch ? 1.1 : 1)
      * flin * (1 + 0.7 * Math.min(1.5, b.suppr)) * (denied ? 3.5 : 1) * (b.onGround ? 1 : 1.35);
    const tt = now * 1.1 + b.id * 7.3;
    const ox = (Math.sin(tt * 1.3) + Math.sin(tt * 2.9 + 1) * 0.5) * 0.66, oy = (Math.sin(tt * 1.7 + 2) + Math.sin(tt * 3.3) * 0.4) * 0.5;
    const hd = hyp(aim.x - eye.x, aim.z - eye.z) || 1, rx = (aim.z - eye.z) / hd, rz = -(aim.x - eye.x) / hd, m = errA * dist;
    aim.x += rx * ox * m; aim.z += rz * ox * m; aim.y += oy * m;
    const dx = aim.x - eye.x, dy = aim.y - eye.y, dz = aim.z - eye.z;
    faceYaw = Math.atan2(-dx, -dz); facePitch = Math.atan2(dy, hyp(dx, dz)); b.seenT += dt;
  }
  const lookAtKnown = () => { const dx = b.lastKnown.x - b.pos.x, dz = b.lastKnown.z - b.pos.z; if (hyp(dx, dz) > 1) faceYaw = Math.atan2(-dx, -dz); };
  const follow = (target, repath) => {
    b.repathT -= dt;
    if (!b.path || b.repathT <= 0 || (target && b.goal && b.goal.distanceTo(target) > 3)) { if (target) setPath(b, target); }
    const pd = pathDir(b); if (pd) { wishX = pd[0]; wishZ = pd[1]; }
    return pd;
  };
  // grenade: flee
  let flee = null;
  for (const n of NADES) if (n.p.distanceTo(b.pos) < 6.5 && n.fuse < 2.6 && !allied(n.owner, b)) { flee = n.p; break; }
  if (flee) {
    b.fleeT -= dt; if (b.fleeT <= 0) { b.fleeT = 0.35; botFlee(b, flee); } // the flight direction is chosen by the room available, not in a straight line
    wishX = b.fleeX; wishZ = b.fleeZ; speed = 5.8; sprint = true; b.wantCrouch = false; canShoot = false;
    faceYaw = Math.atan2(-wishX, -wishZ);
  } else switch (b.tactic) {
    case 'cover': {
      const C = b.cover; if (!C) { b.tactic = 'fight'; break; }
      const dd = hyp(C.x - b.pos.x, C.z - b.pos.z);
      if (dd > 0.8 && !b.atCover) {
        const pd = follow(b.coverGoal); if (!pd) { wishX = (C.x - b.pos.x) / dd; wishZ = (C.z - b.pos.z) / dd; }
        sprint = dd > 3.5; speed = sprint ? 5.8 : 3.2; b.wantCrouch = dd < 2.2 && C.low;
        if (b.wantCrouch) speed = 2.2;
        canShoot = vis && !sprint;
        if (sprint) faceYaw = Math.atan2(-wishX, -wishZ); else if (!vis) lookAtKnown();
      } else {
        b.atCover = dd < 1.6; b.inCoverT += dt;
        const hide = !!b.arms.reload || b.health < 45 || b.suppr > 0.75;
        b.peekT -= dt;
        if (b.peekT <= 0) { b.peeking = !b.peeking && !hide; b.peekT = b.peeking ? rand(1.1, 2.6) : rand(0.6, 1.5); if (b.peeking) b.peekSide = Math.random() < 0.5 ? -1 : 1; }
        if (hide) b.peeking = false;
        if (C.low) {
          b.wantCrouch = !b.peeking; canShoot = vis && b.peeking;
          if (dd > 0.35) { wishX = (C.x - b.pos.x) / dd; wishZ = (C.z - b.pos.z) / dd; speed = 1.6; }
        } else {
          // solid wall: step out sideways to shoot, then fall back
          const px = C.x - C.nz * b.peekSide * (b.peeking ? 1.15 : 0), pz = C.z + C.nx * b.peekSide * (b.peeking ? 1.15 : 0);
          const ex = px - b.pos.x, ez = pz - b.pos.z, ed = hyp(ex, ez);
          if (ed > 0.2) { wishX = ex / ed; wishZ = ez / ed; speed = 2.6; }
          b.wantCrouch = b.peeking && def.ai.sniper; canShoot = vis && b.peeking;
        }
        if (!vis) lookAtKnown();
        if (b.inCoverT > 12) b.forceDecide = true;
      }
      break;
    }
    case 'mecha': { // enemy mecha (mechaBotDecide): run to the chosen spot; firing spot: stand, shoot it; shelter: hide there and step out to shoot (mechaBotsShoot); grenade
      const M = b.mk, P = b.mkPt, C = b.mkC; if (!M || M.state === 'dead' || !P) { b.tactic = 'roam'; b.goal = null; b.path = null; break; }
      const mx = M.pos.x - b.pos.x, mz = M.pos.z - b.pos.z, md = hyp(mx, mz), dd = hyp(P.x - b.pos.x, P.z - b.pos.z);
      const toM = Math.atan2(-mx, -mz), pitchM = Math.atan2(M.ry + 1.8 - (b.pos.y + 1.5), md);
      if (dd > 0.8 && !b.atCover) {
        const pd = follow(P); if (!pd) { wishX = (P.x - b.pos.x) / dd; wishZ = (P.z - b.pos.z) / dd; }
        sprint = dd > 2.5; speed = sprint ? 5.9 : 3.2; b.wantCrouch = false; canShoot = vis && !sprint;
        faceYaw = sprint ? Math.atan2(-wishX, -wishZ) : vis ? faceYaw : toM; if (!vis && !sprint) facePitch = pitchM;
      } else if (b.mkFire) { // firing spot: standing facing it, an occasional sidestep so as not to stand rooted (the shooting: mechaBotsShoot)
        b.atCover = true; b.peeking = true; b.wantCrouch = false;
        b.peekT -= dt; if (b.peekT <= 0) { b.peekT = rand(0.7, 1.6); b.peekSide = Math.random() < 0.5 ? -1 : Math.random() < 0.5 ? 0 : 1; }
        const sx = -mz / (md || 1) * b.peekSide, sz = mx / (md || 1) * b.peekSide; // sideways relative to the mecha
        if (dd < 1.4) { wishX = sx; wishZ = sz; speed = 2.2; } else { wishX = (P.x - b.pos.x) / dd; wishZ = (P.z - b.pos.z) / dd; speed = 2.4; }
        canShoot = vis; if (!vis) { faceYaw = toM; facePitch = pitchM; }
      } else {
        b.atCover = dd < 1.6;
        b.peekT -= dt;
        if (b.peekT <= 0) { b.peeking = !b.peeking && !b.arms.reload; b.peekT = b.peeking ? rand(2, 3.5) : rand(0.6, 1.3); b.peekSide = Math.random() < 0.5 ? -1 : 1; } // (longer outside than in shelter: it tries to destroy it; 1.2 to 2.4 s outside, 0.8 to 1.8 inside at first)
        if (C && !C.low) { // solid wall: a sidestep to shoot, then back behind
          const px = C.x - C.nz * b.peekSide * (b.peeking ? 1.15 : 0), pz = C.z + C.nx * b.peekSide * (b.peeking ? 1.15 : 0), ex = px - b.pos.x, ez = pz - b.pos.z, ed = hyp(ex, ez);
          if (ed > 0.2) { wishX = ex / ed; wishZ = ez / ed; speed = 2.6; }
          b.wantCrouch = false;
        } else { b.wantCrouch = !b.peeking; if (dd > 0.35) { wishX = (P.x - b.pos.x) / dd; wishZ = (P.z - b.pos.z) / dd; speed = 1.6; } } // low wall, or in the open: crouched, standing to shoot
        canShoot = vis && b.peeking; if (!vis) { faceYaw = toM; facePitch = pitchM; }
      }
      // the grenade, what heats it up the most: within throwing range, clear trajectory, on the way or out of shelter
      if (b.nadeType === 'smoke' && b.nades > 0 && b.nadeCd <= 0 && b.throwT <= 0 && b.onGround && md < 30 && Math.random() < 1.5 * dt) { const pt = b.pos.clone().lerp(M.pos, 5 / Math.max(5, md)); if (botNadeClear(b, pt)) { botThrowNade(b, pt); b.nadeCd = rand(14, 22); } } // a cloud between the mecha and it
      else if (b.nadeType !== 'flash' && (b.peeking || !b.atCover) && b.nades > 0 && b.nadeCd <= 0 && b.throwT <= 0 && b.onGround && md > 9 && md < MECHA_BOT.nade && Math.random() < 2 * dt && botNadeClear(b, M.pos)) { botThrowNade(b, M.pos); b.nadeCd = rand(8, 14); } // (the flash does nothing to the mecha)
      break;
    }
    case 'push': {
      const tgt = vis ? T.pos : b.lastKnown, ideal = def.ai.ideal;
      const d = hyp(tgt.x - b.pos.x, tgt.z - b.pos.z);
      b.wantCrouch = false;
      if (d > (vis ? ideal : 3)) {
        follow(tgt);
        sprint = (!vis && d > 6) || (vis && b.rush && d > 6); speed = sprint ? 5.9 : 3.5; canShoot = vis;  // b.rush: it charges the opponent it sees, like a player who wants contact
        if (!vis && !sprint) lookAtKnown();
        if (sprint) faceYaw = Math.atan2(-wishX, -wishZ);
        if (vis && !sprint) { const rx = Math.cos(faceYaw), rz = -Math.sin(faceYaw); b.strafeDir = b.strafeDir || 1; wishX += rx * b.strafeDir * 0.5; wishZ += rz * b.strafeDir * 0.5; b.strafeT -= dt; if (b.strafeT <= 0) { b.strafeT = rand(0.4, 0.9); b.strafeDir = botSide(b, faceYaw, -b.strafeDir) || -b.strafeDir; } }
      } else if (vis) { b.tactic = 'fight'; b.rush = false; }
      else { b.tactic = 'hunt'; b.rush = false; }
      break;
    }
    case 'flank': {
      const f = b.flankPt; if (!f) { b.tactic = 'hunt'; break; }
      const pd = follow(f);
      sprint = !vis; speed = vis ? 3.2 : 5.7; b.wantCrouch = false; canShoot = vis;
      if (sprint && pd) faceYaw = Math.atan2(-pd[0], -pd[1]);
      if (f.distanceTo(b.pos) < 1.8 || (!pd && b.path)) { b.tactic = 'hunt'; setPath(b, b.lastKnown); }
      if (vis) b.forceDecide = true;
      break;
    }
    case 'fight': {
      const ideal = def.ai.ideal;
      b.moveT -= dt;
      if (b.moveT <= 0) {
        const close = dist < 12, r = Math.random();
        const sd = botSide(b, faceYaw, Math.random() < 0.5 ? -1 : 1), both = sd !== 0 && botRoom(b, Math.cos(faceYaw) * -sd, -Math.sin(faceYaw) * -sd, 1.3) >= 1.2; // room on one side, on both for the back-and-forth
        if (def.ai.sniper || (dist > 24 && r < 0.4)) { b.move = 'crouch'; b.moveT = rand(1.0, 2.2); }
        else if (r < 0.22 || !sd) { b.move = 'stop'; b.moveT = rand(0.35, 0.8); }
        else if (close && r < 0.62 && both) { b.move = 'jiggle'; b.moveT = rand(0.8, 1.6); b.jigT = 0; }
        else { b.move = 'strafe'; b.moveT = rand(0.45, 1.3); b.strafeDir = sd; }
        // no dodge-jump: a player almost never jumps to avoid bullets (until 4.15, a strafe step became one or two
        // jumps, and bots jumped for no reason)
        b.fwdOk = botRoom(b, -Math.sin(faceYaw), -Math.cos(faceYaw), 1.4) >= 1.2; b.backOk = botRoom(b, Math.sin(faceYaw), Math.cos(faceYaw), 1.4) >= 1.2;
      }
      const rx = Math.cos(faceYaw), rz = -Math.sin(faceYaw), fx = -Math.sin(faceYaw), fz = -Math.cos(faceYaw);
      b.wantCrouch = b.move === 'crouch';
      if (b.move === 'strafe') { wishX = rx * b.strafeDir; wishZ = rz * b.strafeDir; speed = def.ai.rush ? 3.4 : 2.7; }
      else if (b.move === 'jiggle') { b.jigT -= dt; if (b.jigT <= 0) { b.jigT = rand(0.2, 0.5); b.jigS = -b.jigS; } wishX = rx * b.jigS; wishZ = rz * b.jigS; speed = 3.2; }
      if (dist > ideal + 8) { if (b.fwdOk) { wishX += fx * 0.7; wishZ += fz * 0.7; speed = Math.max(speed, 2.8); b.wantCrouch = false; } else if (vis) { b.tactic = 'push'; setPath(b, T.pos); break; } } // the target is in view but not in a straight line: reach it through the network
      else if (dist < ideal * 0.45 && !def.ai.shotgun && b.backOk) { wishX -= fx * 0.6; wishZ -= fz * 0.6; speed = Math.max(speed, 2.6); b.wantCrouch = false; }
      if (!vis) { b.tactic = 'hunt'; }
      break;
    }
    case 'hunt': {
      b.wantCrouch = false;
      const d = b.lastKnown.distanceTo(b.pos);
      const pd = follow(b.lastKnown);
      speed = d < 7 ? 2.4 : 3.3;
      if (b.stealth === undefined) b.stealth = Math.random() < 0.3;
      if (b.stealth && d < 10) { b.wantCrouch = true; speed = 1.8; }
      lookAtKnown(); canShoot = vis;
      if (b.nadeOn && b.nadeType !== 'smoke' && b.nades > 0 && b.nadeCd <= 0 && d > 9 && d < 26 && Math.random() < 0.8 * dt && botNadeClear(b, b.lastKnown)) { botThrowNade(b, b.lastKnown); b.nadeCd = rand(10, 22); }
      if (!pd || d < 2) { // arrived without seeing them again: it searches the surroundings for as long as the pursuit lasts, otherwise it resumes its route
        if (botChasing(b, now, D)) botSearchStart(b); else { b.tactic = 'roam'; b.stealth = undefined; b.lastSeenT = -99; }
      }
      if (vis) b.forceDecide = true;
      break;
    }
    case 'search': {
      b.wantCrouch = false; canShoot = vis;
      if (vis) { b.forceDecide = true; break; }
      if (b.sweepT > 0) { // it sweeps its gaze, in place, weapon shouldered
        b.sweepT -= dt;
        faceYaw = b.sweepYaw + Math.sin((1 - b.sweepT / b.sweepDur) * TAU) * b.sweepA;
      } else if (b.searchP) { // toward the hiding spot, looking ahead (the head leads toward after the turn)
        const pd = follow(b.searchP); speed = 3.0;
        if (pd) faceYaw = Math.atan2(-pd[0], -pd[1]);
        if (!pd || b.searchP.distanceTo(b.pos) < 1.2) { b.searchN++; botSearchNext(b, false); }
      } else { b.tactic = 'roam'; b.goal = null; b.path = null; b.chaseE = null; b.lastSeenT = -99; } // found nothing: it resumes its route
      break;
    }
    default: { // free movement between key positions, sprinting, and holding strong positions
      b.wantCrouch = false;
      if (b.holdT > 0) {
        // holds the position: looks toward the opposing half, sometimes crouches, stays still
        b.holdT -= dt; speed = 0; canShoot = vis;
        const L = b.holdLookP, tz = b.team === 0 ? -40 : 40, dx = (L ? L.x : b.holdLookX ?? b.pos.x) - b.pos.x, dz = (L ? L.z : tz) - b.pos.z;
        faceYaw = Math.atan2(-dx, -dz) + Math.sin(now * 0.4 + b.id) * 0.35;
        b.wantCrouch = b.holdCrouch; b.holdAds = true;
        if (vis) { b.forceDecide = true; b.holdT = 0; }
        break;
      }
      if (!b.goal || !b.path || b.pathI >= b.path.length) {
        if (b.goal && b.goal.hold && b.goal.distanceTo(b.pos) < 2) { b.holdT = b.goal.holdFor || rand(5, 12); b.holdCrouch = Math.random() < 0.5 && b.goal.y < gy0(b.goal.x, b.goal.z) + 1; b.holdLookX = b.pos.x + rand(-6, 6); b.holdLookP = b.goal.look || null; b.goal = null; break; }
        setPath(b, pickGoal(b, now));
      }
      const pd = pathDir(b);
      if (pd) {
        wishX = pd[0]; wishZ = pd[1]; faceYaw = Math.atan2(-pd[0], -pd[1]);
        const nx = b.path[b.pathI + 1]; // the head leads toward after the turn before the body
        if (nx) { const p = b.path[b.pathI], dp = hyp(p.x - b.pos.x, p.z - b.pos.z); if (dp < 3.5) { const ex = nx.x - p.x, ez = nx.z - p.z, el = hyp(ex, ez) || 1, k = (1 - dp / 3.5) * 0.5; faceYaw = Math.atan2(-(wishX * (1 - k) + ex / el * k), -(wishZ * (1 - k) + ez / el * k)); } }
      } else b.goal = null;
      b.paceT -= dt;
      if (b.paceT <= 0) { b.paceT = rand(3, 8); const r = Math.random(), hot = now - b.lastSeenT < 12 || b.fear > 0.3 || now < b.warnT; b.pace = r < 0.45 + 0.35 * (1 - b.pers.scan) && !hot ? 2 : r < 0.88 ? 1 : 0; } // sprint, run with weapon raised, cautious walk
      sprint = b.pace === 2; speed = b.pace === 2 ? 5.4 : b.pace === 1 ? 3.9 : 2.6;
      if (!sprint) { // it looks around, an occasional glance to the side
        b.glanceT -= dt;
        if (b.glanceT <= 0) { if (b.glanceA !== 0) { b.glanceA = 0; b.glanceT = rand(1.2, 3.5); } else { b.glanceA = (Math.random() < 0.5 ? -1 : 1) * rand(0.5, 1.3); b.glanceT = rand(0.4, 1.0); } }
        faceYaw += b.glanceA * b.pers.scan;
      }
      if (now < b.lookAtT) { faceYaw = Math.atan2(-(b.lookAtX - b.pos.x), -(b.lookAtZ - b.pos.z)); sprint = false; speed = 2.2; } // a noise, an impact: slow down and turn toward it
      if (armsW(b).mag < def.mag * 0.5 && !b.arms.reload) b.input.reload = true;
      if (vis) b.forceDecide = true;
    }
  }
  // blinded by a flash (flashBang, b.blindT): it no longer shoots, staggers and crouches, weapon raised at random
  if (now < (b.blindT || 0)) {
    canShoot = false; b.wantCrouch = Math.random() < 0.02 ? !b.wantCrouch : b.wantCrouch;
    if ((b.blindW = (b.blindW || 0) - dt) <= 0) { b.blindW = rand(0.4, 0.9); const a = rand(0, TAU); b.blindX = Math.cos(a); b.blindZ = Math.sin(a); }
    wishX = b.blindX || 0; wishZ = b.blindZ || 0; speed = 1.4; sprint = false; faceYaw = b.lookYaw + Math.sin(now * 2.3 + b.id) * 0.6;
  }
  // stuck (botUnstick): back to a free node, back up, or sidestep, overriding the current intent
  if (b.recT > 0) { b.recT -= dt; const ex = b.recX - b.pos.x, ez = b.recZ - b.pos.z, ed = Math.sqrt(ex * ex + ez * ez); if (ed < 0.3) b.recT = 0; else { wishX = ex / ed; wishZ = ez / ed; speed = Math.max(speed, 3.2); } }
  else if (b.backT > 0) { b.backT -= dt; const hl = Math.sqrt(wishX * wishX + wishZ * wishZ); if (hl > 0.01) { wishX = -wishX / hl; wishZ = -wishZ / hl; } speed = Math.max(speed, 2.6); }
  else if (b.sideT > 0) { b.sideT -= dt; const hl = Math.sqrt(wishX * wishX + wishZ * wishZ); if (hl > 0.01) { const hx = wishX / hl, hz = wishZ / hl; wishX = -hz * b.sideDir + hx * 0.3; wishZ = hx * b.sideDir + hz * 0.3; } speed = Math.max(speed, 3); }
  if (b.wantCrouch && speed > 2.2) speed = 2.2;
  // network jump link: low wall to clear (jump), ledge to drop from (slow down so as not to fly off)
  if (b.path && b.pathI < b.path.length) {
    const lp = b.path[b.pathI];
    if (lp.jump && b.jumpT <= 0 && b.pathI > 0 && b.tactic !== 'fight' && botLeapNow(b, b.path[b.pathI - 1], lp)) b.jumpT = 0.12; // in combat, the previous path remains but is no longer followed
    else if (lp.drop && lp.y < b.pos.y - 0.9) { sprint = false; speed = Math.min(speed, 3.2); }
  }
  // slide: to enter cover, to engage an opponent, to flee a grenade, and rarely for fun (botTrySlide: spot, delay)
  if (sprint && b.slideT <= 0) {
    let pS = 0;
    if (flee) pS = 1.2;
    else if (b.tactic === 'cover' && b.cover && !b.atCover) { const cd = hyp(b.cover.x - b.pos.x, b.cover.z - b.pos.z); if (cd > 4.5 && cd < 10) pS = 2.2; }
    else if (vis && (b.tactic === 'push' || b.tactic === 'flank') && dist > 5 && dist < 16) pS = 1.8;
    else if (b.tactic === 'roam') pS = 0.05;
    if (pS > 0 && Math.random() < pS * botFlair(b, 'slide') * dt && botTrySlide(b, now)) sfxSlide(b.pos);
  }
  if (b.slideT > 0) sprint = false; // during the slide, no run and no shouldering forbidden: it can aim and shoot
  // trigger: the bot "presses" like a player (held bursts, single shots), the controller does the rest
  const I = b.input, A = b.arms;
  I.fire = false; I.jump = false;
  if (A.shots !== (b.lastShots || 0)) { b.burstLeft = (b.burstLeft || 0) - (A.shots - (b.lastShots || 0)); b.lastShots = A.shots; if (def.auto && b.burstLeft <= 0) b.pauseT = rand(0.18, 0.5) + dist * 0.004; }
  b.pauseT = (b.pauseT || 0) - dt; b.tapCd = (b.tapCd || 0) - dt;
  I.ads = (vis && !sprint && canShoot && (!def.ai.shotgun || dist > 7)) || (b.holdT > 0 && !def.ai.shotgun);
  if ((b.tactic === 'hunt' && b.lastKnown.distanceTo(b.pos) < 15) || b.tactic === 'search') I.ads = !sprint;
  if (canShoot && vis && !sprint) {
    const aimErr = hyp(angDiff(b.lookYaw, faceYaw), facePitch - b.pitch);
    if (b.reactT > 0) b.reactT -= dt;
    else if (!A.reload && now - b.lastHitT > 0.15 && aimErr < (def.pellets ? 0.07 : 0.035)) {
      if (def.auto) { if ((b.burstLeft || 0) <= 0 && b.pauseT <= 0) b.burstLeft = randi(3, dist > 30 ? 5 : 9); if (b.burstLeft > 0) I.fire = true; }
      else if (b.tapCd <= 0 && A.fireCd <= 0 && A.boltT <= 0) { I.firePressed = true; b.tapCd = def.bolt ? rand(0.25, 0.6) : rand(0.16, 0.38); }
    }
  } else if (!vis && !A.reload && armsW(b).mag < def.mag * 0.6 && (b.tactic === 'cover' || b.tactic === 'hunt' || b.tactic === 'search')) I.reload = true;
  if (armsW(b).mag <= 0 && !A.reload) b.forceDecide = true;
  // startled by a bullet from a shooter it doesn't see (botHurt): the head doesn't turn right away
  if (now < b.startleT && !vis) faceYaw = b.lookYaw;
  // gaze rotation like a mouse: acceleration, braking, slight overshoot, bounded speed. A big head movement (turning
  // back toward an impact, a noise, an opponent glimpsed to the side) goes at a player's speed (D.spin, a bit more toward an
  // opponent in view) and builds momentum; fine tracking of a target doesn't change. Until 4.15, a bot hit in the back would make a
  // U-turn in 0.3 s, right at the impact (up to 14 rad/s at Veteran level).
  const kk = D.turn * D.turn * 3.2 * (b.sprinting ? 1.3 : 1), cd = 2 * Math.sqrt(kk) * 0.85, yv = b.yawV || 0, vmax = Math.min(D.turn * 2, D.spin * (vis ? 1.3 : 1));
  let ya = angDiff(b.lookYaw, faceYaw) * kk - yv * cd;
  if (ya * yv >= 0) ya = clamp(ya, -D.spin * 6, D.spin * 6); // momentum builds up gradually, braking stays free
  b.yawV = clamp(yv + ya * dt, -vmax, vmax);
  b.lookYaw += b.yawV * dt;
  b.pitchV = (b.pitchV || 0) + ((facePitch - b.pitch) * kk - (b.pitchV || 0) * cd) * dt;
  b.pitch = clamp(b.pitch + b.pitchV * dt, -1.2, 1.2); b.yaw = b.lookYaw;
  // separation
  for (const o of entities) {
    if (o === b || !o.alive) continue;
    const dx = b.pos.x - o.pos.x, dz = b.pos.z - o.pos.z, d2 = dx * dx + dz * dz;
    if (d2 < 0.7 && d2 > 1e-6 && Math.abs(b.pos.y - o.pos.y) < 1) { const d = Math.sqrt(d2); wishX += (dx / d) * 0.8; wishZ += (dz / d) * 0.8; if (speed < 1) speed = 1.5; }
  }
  const wl = hyp(wishX, wishZ); if (wl > 1) { wishX /= wl; wishZ /= wl; }
  // desired direction (world) converted to movement keys (gaze frame), like a player
  const fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw), rx = Math.cos(b.yaw), rz = -Math.sin(b.yaw);
  let lx = wishX * rx + wishZ * rz, lz = wishX * fx + wishZ * fz;
  if (b.jumpT > 0) { b.jumpT -= dt; if (b.onGround && !b.crouch) { I.jump = true; b.wantCrouch = false; } }
  I.sprint = sprint; I.crouch = !!b.wantCrouch;
  const NERVE = 1.05; // soldiers' pace (1.1 before 3.6.0: slowed with the player; 0.96 until 4.18, too sluggish to the eye)
  const base = MOVE_SPEED * def.move * (sprint ? SPRINT_MUL : (I.ads ? (def.scope ? 0.4 : 0.58) : 1)) * (b.wantCrouch ? 0.6 : 1);
  const amt = speed > 0 ? clamp(speed * NERVE / base, 0, 1) : 0, ll = hyp(lx, lz);
  if (ll > 1e-3) { lx = (lx / ll) * amt * Math.min(1, ll); lz = (lz / ll) * amt * Math.min(1, ll); } else { lx = 0; lz = 0; }
  I.mx = lx; I.mz = lz;
  const px0 = b.pos.x, pz0 = b.pos.z;
  const mv = ctlMove(b, dt);
  botBump(b, dt, px0, pz0, now);
  if (mv.landed && b.pos.distanceTo(camera.position) < 25) sfxStep(b.pos, 0.42, surfaceAt(b.pos));
  if (b.slideT > 0 && b.pos.distanceTo(camera.position) < 40) slideDust(b, dt);
  if (voidCheck(b) || ringCheck(b, dt)) return; // fell into the void (safety net: ctlMove's guard prevents it), or outside the round zone (safety net: no node outside)
  // step refused at the edge of the void (ctlMove): the strafe step restarts from the other side and the path is recomputed
  if (b.edgeT === MATCH.time) { b.strafeDir = -(b.strafeDir || 1); b.moveT = Math.min(b.moveT || 0, 0.2); b.repathT = 0; }
  ctlWeapon(b, dt, now);
  b.stuckT += dt;
  if (b.stuckT > 1.2) {
    if (wl > 0.3 && speed > 2 && b.pos.distanceTo(b.lastPos) < 0.6) { b.path = null; b.goal = null; b.repathT = 0; b.strafeDir = -(b.strafeDir || 1); if (b.tactic === 'cover' || b.tactic === 'mecha') b.forceDecide = true; }
    b.lastPos.copy(b.pos); b.stuckT = 0;
  }
  const v = hyp(b.vel.x, b.vel.z);
  b.stepAcc += v * dt; if (b.stepAcc > (b.sprinting ? 2.8 : 2.2)) { b.stepAcc = 0; const sf = surfaceAt(b.pos); sfxStep(b.pos, b.crouch ? 0.12 : b.sprinting ? 0.34 : 0.26, sf); if (sf === 'water') stepSplashFx(b.pos, v, b.vel); }
  animSoldier(b, dt);
}

/* Fire pressure: bullets passing near a bot */
function suppressAlongRay(shooter, origin, dir, endT, hitEnt) {
  for (const e of entities) {
    if (e.isPlayer || !e.alive || allied(e, shooter) || e === hitEnt) continue;
    const c = entChest(e, _cp);
    const t = clamp((c.x - origin.x) * dir.x + (c.y - origin.y) * dir.y + (c.z - origin.z) * dir.z, 0, endT);
    const px = origin.x + dir.x * t - c.x, py = origin.y + dir.y * t - c.y, pz = origin.z + dir.z * t - c.z;
    if (px * px + py * py + pz * pz < 2.2) {
      e.suppr = Math.min(1.5, (e.suppr || 0) + 0.12);
      if (!e.visible && !allied(e, shooter) && MATCH.time - e.lastSeenT > 1) { // a passing bullet gives a direction, not an address
        e.lastKnown.copy(botGuess(e.pos, shooter.pos, 4, 0.16)); e.lastSeenT = MATCH.time - 1.5; botLookAt(e, e.lastKnown, MATCH.time, 1.2);
        e.aw.set(shooter, Math.max(e.aw.get(shooter) || 0, 0.35)); e.decideT = Math.min(e.decideT, rand(0.3, 0.6));
      }
    }
  }
}

/* Attack tokens: at most D.tokens opponents aim at the player at the same time; the others shoot wide (suppressive fire).
   A token is kept as long as the bot keeps the player in view (renewed every frame, lost 0.9 s after). */
function botToken(b, T, now, limit) {
  if (!T.isPlayer) return true;
  const A = T.atk || (T.atk = new Map());
  let n = 0;
  for (const [o, t] of A) { if (now - t > 0.9 || !o.alive) A.delete(o); else if (o !== b) n++; }
  if (A.has(b) || n < limit) { A.set(b, now); return true; }
  return false;
}
