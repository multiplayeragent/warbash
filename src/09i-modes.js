/* ==========================================================================
   GAME MODES
   Three modes, solo as well as online (the lobby host picks the mode; online, the host decides when the match ends and
   keeps the domination points, guests receive their state, see domNetApply):
     tdm  team deathmatch: 6 vs 6, first side to N eliminations;
     ffa  deathmatch: every man for himself, the 12 soldiers fight each other, first to N eliminations;
     dom  domination: three points to hold (A next to Alpha, B in the center, C next to Bravo), each held point earns
          one score point every DOM.tick seconds, first side to N points.
   MATCH.mode is 'tdm' as long as no mode is chosen. Alliance rules go through
   allied(a, b): in deathmatch, nobody is anybody's ally, whatever the soldier's original team (which
   is now only used for the outfit and the starting base).
   This file also holds the spawn system (spawnOpening at the start, chooseSpawn afterwards), which depends on the mode: see below.
   ========================================================================== */
const MODES = {
  tdm: { name: _t('Team deathmatch'), btn: _t('Team'), sub: _t('Team deathmatch'), teams: _t('6 vs 6 (you and 5 allies)'), lim: _t('Kill limit'), unit: _t('kills'),
    limits: [20, 30, 50, 75], key: 'limit', respawn: 4, botRespawn: 5.5, prot: 2,
    hint: _t('Two teams of six. The first side to reach the kill limit wins.') },
  ffa: { name: _t('Deathmatch'), btn: _t('Free for all'), sub: _t('Deathmatch, free for all'), teams: _t('Free for all, you and 7 bots (8 players)'), lim: _t('Kill limit'), unit: _t('kills'),
    limits: [10, 20, 30, 50], key: 'limitFfa', respawn: 3, botRespawn: 3.5, prot: 2,
    hint: _t('Nobody is your ally. The first to reach the kill limit wins.') },
  dom: { name: _t('Domination'), btn: _t('Domination'), sub: _t('Domination, hold three points'), teams: _t('6 vs 6, hold three points'), lim: _t('Score to reach'), unit: 'points',
    limits: [100, 150, 200, 250], key: 'limitDom', respawn: 4, botRespawn: 4.5, prot: 2,
    hint: _t('Stay inside a point\u0027s zone to capture it. Each point held scores one point every 4 seconds.') },
};
const MODE_IDS = ['tdm', 'ffa', 'dom'];
function modeDef() { return MODES[MATCH.mode] || MODES.tdm; }
/* Allies: same team, except in deathmatch where everyone plays for themselves */
function allied(a, b) { return a === b || (MATCH.mode !== 'ffa' && a.team === b.team); }
/* Is a noise (shot, explosion) one made by an opponent of b? */
function soundFoe(s, b) { return MATCH.mode === 'ffa' ? s.who !== b : s.team !== b.team; }
/* Deathmatch ranking: eliminations, then fewer deaths, then score */
const ffaCmp = (a, b) => b.kills - a.kills || a.deaths - b.deaths || b.score - a.score;

/* ---------- Match start and end ---------- */
function modeStart(mode) {
  MATCH.mode = MODES[mode] ? mode : 'tdm';
  SPAWN_LOG.length = 0; DEATH_LOG.length = 0; SPAWN_TRAP.length = 0; OPEN.on = true; // start: everyone gets their own spot (spawnOpening), until "Go!"
  for (const e of entities) { e.protT = 0; e.lastDeath = null; e.caps = 0; }
  squadReset();
  modeRoster();
  domClear();
  if (MATCH.mode === 'dom') domInit();
  MATCH.over = false;
  const D = modeDef();
  document.querySelectorAll('.score .row span').forEach((s, i) => { s.textContent = MATCH.mode === 'ffa' ? [_t('You'), _t('Rival')][i] : TEAM_NAMES[i]; });
  $('domRow').classList.toggle('hidden', MATCH.mode !== 'dom');
  document.querySelector('.score').classList.toggle('dom', MATCH.mode === 'dom'); // on touch, the pads take the place of the limit (shell.html)
  $('domCap').className = '';
  return D;
}
/* Soldiers in play and each one's outfit. Deathmatch: only 7 bots, all seen as enemies (dark outfit, red stripes: skinRel),
   so that none looks like an ally. Other modes: all in play, allies in light colors, enemies in dark (06ga-outfits.js). */
function modeRoster() {
  const ffa = MATCH.mode === 'ffa', bots = entities.filter((e) => !e.isPlayer), cut = MATCH.online ? 0 : bots.length - FFA_BOTS; // online, the host enables the bots (netRebalanceBots)
  // remove bots spread across both original sides (one in three, then the last ones)
  const off = new Set(ffa && cut > 0 ? bots.filter((e, i) => i % 3 === 1).concat(bots.slice().reverse()).filter((e, i, a) => a.indexOf(e) === i).slice(0, cut) : []);
  for (const e of bots) {
    e.off = off.has(e);
    if (e.off) { e.alive = false; e.respawnT = Infinity; e.target = null; e.model.rag = null; e.model.root.visible = false; }
    soldierLook(e.model, skinOf(e), skinRel(e));
  }
}
function modeEnd() { domClear(); }

/* Per-frame updates: spawn protection, deathmatch score, domination points */
function modeUpdate(dt) {
  for (const e of entities) {
    if (e.protT > 0) { e.protT -= dt; if (e.lastShotT > e.spawnAt) e.protT = 0; } // shooting loses the protection
  }
  hudStyle($('prot'), 'opacity', PL.ent.alive && PL.ent.protT > 0 ? '1' : '0');
  if (MATCH.mode === 'ffa') ffaScore();
  else if (MATCH.mode === 'dom') domUpdate(dt);
}
/* Deathmatch: MATCH.score[0] = my eliminations, MATCH.score[1] = the best opponent's */
function ffaScore() {
  let best = 0; for (const e of ffaList()) if (e !== PL.ent && e.kills > best) best = e.kills;
  MATCH.score[0] = PL.ent.kills; MATCH.score[1] = best;
}
/* Deathmatch participants: the player and 7 bots (the other soldiers stay out of play) */
const FFA_BOTS = 7;
function ffaList() { return entities.filter((e) => !e.off && (!MATCH.online || e.isPlayer || e.isRemote || e.netBot)); } // online: those who take part
function ffaRank() { return ffaList().sort(ffaCmp).indexOf(PL.ent) + 1; }
/* Limit reached by a killer (eliminations): the match ends on a final killcam */
function killLimitReached() {
  if (MATCH.mode === 'ffa') { ffaScore(); return ffaList().some((e) => e.kills >= MATCH.limit); }
  if (MATCH.mode === 'dom') return false;
  return MATCH.score[0] >= MATCH.limit || MATCH.score[1] >= MATCH.limit;
}

/* ==========================================================================
   SPAWNS
   Three stages, modeled on the big shooters (Call of Duty, Halo):
   1. Start (spawnOpening): each soldier has their own spot, one per soldier, taken as is. In teams, the spots of their base, from the
      closest to the base center to the farthest; free-for-all, spots drawn across the map, each as far as possible
      from the previous ones and out of their sight (ffaSlots). Each soldier's rank (openRank) is the same on every player of a lobby without exchanging
      anything: the side's players sorted by identifier, then the host's bots. The start lasts until "Go!" (cdGo).
   2. Respawn (chooseSpawn): the mode's candidates (spawnPool) are scored (spawnRate), then discarded if dangerous: an
      opponent within SPAWN.near m or who sees the spot within SPAWN.sight m (spawnSeen), a grenade, a fight going on there
      (a death less than SPAWN.fightT s ago), in domination a point contested or held by the opponent. One is drawn at random among the
      best safe spots (SPAWN.keep, within SPAWN.spread points of the best). If none is safe (the opponent camps the base), the whole
      map opens up, enemy base included: this is the spawn flip. Danger everywhere: the least bad spot.
   3. Protection: 2 s of invulnerability, lost on the first shot (MODES.prot).
   The score: far from opponents, on the right side of the front (spawnFront: from the middle of the living opponents toward that of the allies), near
   teammates, out of an opponent's gaze even without line of sight (they would turn the corner and see the other spawn), far from a recent
   spawn (their own or another lobby player's, spawnNote), from a recent death, from their own death, and from places
   where their side was just killed on spawn (SPAWN_TRAP: avoided for SPAWN.trapMem s).
   Candidates: tdm the base and the ground waypoints of their half of the map; ffa both bases and all ground waypoints; dom the base (the other side's if the fronts have crossed, domSide) and, as soon as the side holds a point, the waypoints.
   ========================================================================== */
const SPAWN = { near: 12, sight: 70, nade: 8, fightR: 10, fightT: 4, look: 40, trapT: 5, trapR: 14, trapMem: 20, keep: 3, spread: 8 };
const SPAWN_LOG = [], DEATH_LOG = [], SPAWN_TRAP = [];
const OPEN = { on: false, key: '', ffa: [] }; // on: start of the current match; free-for-all spots of the map key
function noteDeath(e) {
  e.lastDeath = { x: e.pos.x, z: e.pos.z, t: MATCH.time };
  DEATH_LOG.push(e.lastDeath); if (DEATH_LOG.length > 16) DEATH_LOG.shift();
  if (e.spawnPos && MATCH.time - (e.spawnAt || 0) < SPAWN.trapT) { // killed right after spawning: the spot is trapped for their side
    SPAWN_TRAP.push({ x: e.spawnPos.x, z: e.spawnPos.z, t: MATCH.time, team: e.team }); if (SPAWN_TRAP.length > 12) SPAWN_TRAP.shift();
  }
}
/* A spawn happened, here (spawnEntity) or on another lobby player (netApply): the spot is avoided for a few seconds */
function spawnNote(e) {
  e.spawnPos = { x: e.pos.x, z: e.pos.z };
  SPAWN_LOG.push({ x: e.pos.x, z: e.pos.z, t: MATCH.time }); if (SPAWN_LOG.length > 24) SPAWN_LOG.shift();
}
/* Ground waypoints (level, on the terrain of a dune map), without the manned posts */
function spawnField() { return POI.filter((p) => p[1] < gy0(p[0], p[2]) + 1 && !p[4]).map((p) => [p[0], p[2]]); }
const spawnMid = (L) => [L.reduce((a, p) => a + p[0], 0) / L.length, L.reduce((a, p) => a + p[1], 0) / L.length];
/* A side's base: their own, except in domination when the fronts have crossed */
function spawnBase(team) { return MATCH.mode === 'dom' ? domSide(team) : team; }
/* A side's starting base in domination: their own, except when the fronts have crossed (the opponent holds the point of
   their base and they hold the opponent's): their spawns then switch to the other side, as in Call of Duty */
function domSide(team) {
  const n = DOM.pts.length; if (!n) return team;
  const home = DOM.pts[team === 0 ? 0 : n - 1], away = DOM.pts[team === 0 ? n - 1 : 0];
  return home.owner === 1 - team && away.owner === team ? 1 - team : team;
}

/* ---------- Start ---------- */
/* A soldier's starting rank in their group (their side, or everyone for free-for-all). Solo: the player, then the bots in order. Online:
   the group's players sorted by identifier (each computes the same order locally, from the lobby state), then the host's bots. */
function openRank(e) {
  const mine = (o) => MATCH.mode === 'ffa' || o.team === e.team;
  if (!MATCH.online) return entities.filter((o) => !o.off && !o.isRemote && mine(o)).sort((a, b) => b.isPlayer - a.isPlayer).indexOf(e);
  const hum = [...NET.players.values()].filter((p) => p.ig && (MATCH.mode === 'ffa' || p.t === e.team)).map((p) => p.id).sort();
  if (e.isPlayer) { const i = hum.indexOf(NET.me); return i < 0 ? hum.length : i; }
  return hum.length + entities.filter((o) => o.netBot && mine(o)).indexOf(e);
}
/* Starting spots for a soldier's group. In teams: those of their base, from the base center toward its edges (the two bases being
   mirrored, both sides have the same formation) */
function openSlots(e) {
  if (MATCH.mode === 'ffa') { if (OPEN.key !== CURMAP.id) { OPEN.key = CURMAP.id; OPEN.ffa = ffaSlots(); } return OPEN.ffa; }
  const S = SPAWNS[spawnBase(e.team)], [cx, cz] = spawnMid(S);
  return S.map((s, i) => [s, i, hyp(s[0] - cx, s[1] - cz)]).sort((a, b) => a[2] - b[2] || a[1] - b[1]).map((a) => a[0]);
}
/* Free-for-all starting spots: the first at the center of Alpha's base, each following one as far as possible from the spots already
   taken and out of their sight. Computed without randomness: the same spots on every player of a lobby. */
function ffaSlots() {
  const head = (p, v) => v.set(p[0], gy0(p[0], p[1]) + 1.6, p[1]);
  const left = SPAWNS[0].concat(SPAWNS[1], spawnField()), [cx, cz] = spawnMid(SPAWNS[0]), out = [];
  let i0 = 0; SPAWNS[0].forEach((s, i) => { if (hyp(s[0] - cx, s[1] - cz) < hyp(SPAWNS[0][i0][0] - cx, SPAWNS[0][i0][1] - cz)) i0 = i; });
  out.push(left.splice(i0, 1)[0]);
  while (out.length < 12 && left.length) {
    const R = left.map((c, i) => [i, Math.min(60, ...out.map((o) => hyp(o[0] - c[0], o[1] - c[1])))]).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    let bi = R[0][0], bs = -1e9;
    for (const [i, md] of R) {
      if (md <= bs) break; // farther, none will do better
      const c = left[i], seen = out.some((o) => hyp(o[0] - c[0], o[1] - c[1]) < SPAWN.sight && lineClear(head(c, _v1), head(o, _v2)));
      const s = md - (seen ? 40 : 0); if (s > bs) { bs = s; bi = i; }
    }
    out.push(left.splice(bi, 1)[0]);
  }
  return out;
}
/* A soldier's starting spot, on the navigation node of their spot; null if their rank exceeds the spots or the spot is taken
   (a player joining a match in progress): they then respawn as after a death */
function spawnOpening(e) {
  const S = openSlots(e), k = openRank(e);
  if (k < 0 || k >= S.length) return null;
  const [x, z] = S[k], id = navNode(x, gy0(x, z), z), p = id >= 0 ? new V3(NAV.nx[id], NAV.ny[id], NAV.nz[id]) : new V3(x, gy0(x, z), z);
  for (const o of entities) if (o !== e && o.alive && Math.abs(o.pos.y - p.y) < 1.2 && hyp(o.pos.x - p.x, o.pos.z - p.z) < 1.2) return null;
  return p;
}

/* ---------- Respawn ---------- */
/* The mode's candidates, [x, z]; wide: nothing safe among the usual candidates, the whole map opens up (flip) */
function spawnPool(e, wide) {
  if (MATCH.mode === 'ffa') return SPAWNS[0].concat(SPAWNS[1], spawnField());
  const t = spawnBase(e.team), home = SPAWNS[t];
  if (wide) return home.concat(spawnField(), SPAWNS[1 - t]);
  if (MATCH.mode === 'tdm') { const side = Math.sign(spawnMid(home)[1]); return home.concat(spawnField().filter((p) => p[1] * side > 6)); } // their half of the map
  return DOM.pts.some((p) => p.owner === e.team) ? home.concat(spawnField()) : home;
}
/* Living opponents and allies, and the front */
function spawnCtx(e) {
  const foes = [], pals = [];
  for (const o of entities) if (o !== e && o.alive && !o.off) (allied(o, e) ? pals : foes).push(o);
  return { foes, pals, front: MATCH.mode === 'ffa' ? null : spawnFront(e, foes, pals) };
}
/* The front: the line halfway between the middle of the living opponents and that of the allies (failing that, their base), normal (dx, dz)
   turned toward their side. (x - F.x) * F.dx + (z - F.z) * F.dz > 0: on their side. An opponent advancing into the base moves
   the front behind it: spawns flip on their own toward the rest of the map. */
function spawnFront(e, foes, pals) {
  const t = spawnBase(e.team), at = (L) => L.map((o) => [o.pos.x, o.pos.z]);
  const A = spawnMid(pals.length ? at(pals) : SPAWNS[t]), E = spawnMid(foes.length ? at(foes) : SPAWNS[1 - t]);
  let dx = A[0] - E[0], dz = A[1] - E[1], d = hyp(dx, dz);
  if (d < 1) { dx = 0; dz = Math.sign(spawnMid(SPAWNS[t])[1]) || 1; d = 1; }
  return { x: (A[0] + E[0]) / 2, z: (A[1] + E[1]) / 2, dx: dx / d, dz: dz / d };
}
/* A candidate's score, and whether it is safe (out of line of sight, view handled separately: spawnSeen, costlier, is only computed for the best scored) */
function spawnRate(e, C, x, z) {
  const now = MATCH.time, ffa = MATCH.mode === 'ffa';
  let md = 999, near = 0, look = 0, crowd = 0, pal = 0, safe = true;
  for (const o of C.foes) {
    const dx = x - o.pos.x, dz = z - o.pos.z, d = hyp(dx, dz);
    md = Math.min(md, d);
    if (d < 2.5) near += d < 1.2 ? 3 : 1;
    if (d < SPAWN.look && d > 0.1 && (-Math.sin(o.yaw) * dx - Math.cos(o.yaw) * dz) / d > 0.7) look++; // the spot is in their gaze
    if (ffa && d < 20) crowd++;
  }
  for (const o of C.pals) {
    const d = hyp(x - o.pos.x, z - o.pos.z);
    if (d < 2.5) near += d < 1.2 ? 3 : 1; // an already occupied spot is only picked as a last resort
    else if (d < 20) pal = 1;
  }
  if (md < SPAWN.near) safe = false;
  for (const n of NADES) if (hyp(n.p.x - x, n.p.z - z) < SPAWN.nade) safe = false;
  let s = Math.min(md, ffa ? 60 : 40) - look * 10 - near * 20 - crowd * 4 + rand(0, 6);
  if (!ffa) {
    const F = C.front, depth = (x - F.x) * F.dx + (z - F.z) * F.dz;
    s += (depth < 0 ? depth * 1.5 : Math.min(depth, 25) * 0.4) + pal * 8; // on their side of the front, near teammates
  }
  for (const l of SPAWN_LOG) { const age = now - l.t, d = hyp(l.x - x, l.z - z); if (age < 8 && d < 10) s -= (1 - d / 10) * 30 * (1 - age / 8); }
  for (const l of DEATH_LOG) {
    const age = now - l.t, d = hyp(l.x - x, l.z - z);
    if (age < SPAWN.fightT && d < SPAWN.fightR) safe = false; // a fight is still going on there
    if (age < 6 && d < 14) s -= (1 - d / 14) * 22 * (1 - age / 6);
  }
  for (const l of SPAWN_TRAP) {
    const age = now - l.t, d = hyp(l.x - x, l.z - z);
    if (age < SPAWN.trapMem && d < SPAWN.trapR && (ffa || l.team === e.team)) s -= (1 - d / SPAWN.trapR) * 30 * (1 - age / SPAWN.trapMem);
  }
  if (e.lastDeath && now - e.lastDeath.t < 15 && hyp(e.lastDeath.x - x, e.lastDeath.z - z) < 12) s -= 14;
  if (MATCH.mode === 'dom') {
    let dOwn = 1e9, dFront = 1e9;
    for (const p of DOM.pts) {
      const d = hyp(p.x - x, p.z - z);
      if (p.owner === e.team) dOwn = Math.min(dOwn, d); else dFront = Math.min(dFront, d);
      if ((p.contest || p.owner === 1 - e.team) && d < DOM.rad + 4) safe = false; // neither in a contested point, nor in the opponent's
    }
    if (dOwn < 1e9) s += Math.max(0, 24 - dOwn) * 0.7;           // near a held point
    if (dOwn < 1e9 && md > 16) s += Math.max(0, 60 - dFront) * 0.12; // and the front, when the spot is safe
  }
  return { x, z, s, safe };
}
/* Does an opponent see the spot (head or torso of a soldier who would spawn there, within SPAWN.sight m)? */
function spawnSeen(C, x, z, y = gy0(x, z)) {
  for (const o of C.foes) {
    if (hyp(o.pos.x - x, o.pos.z - z) > SPAWN.sight) continue;
    entEye(o, _v2);
    if (lineClear(_v1.set(x, y + 1.6, z), _v2) || lineClear(_v1.set(x, y + 1.0, z), _v2)) return true;
  }
  return false;
}
/* Best scored first; the first SPAWN.keep safe and out-of-sight ones, drawn among those within SPAWN.spread points of the best */
function spawnPick(e, C, pool) {
  const R = pool.map(([x, z]) => spawnRate(e, C, x, z)).sort((a, b) => b.s - a.s), ok = [];
  for (const c of R) {
    if (!c.safe || spawnSeen(C, c.x, c.z)) continue;
    ok.push(c); if (ok.length >= SPAWN.keep) break;
  }
  const top = ok.filter((c) => c.s >= ok[0].s - SPAWN.spread);
  return { pick: top.length ? top[Math.floor(Math.random() * top.length)] : null, best: R[0] };
}
function chooseSpawn(e) {
  if (OPEN.on) { const p = spawnOpening(e); if (p) return p; }
  const C = spawnCtx(e), r = spawnPick(e, C, spawnPool(e, false));
  const c = r.pick || (MATCH.mode !== 'ffa' && spawnPick(e, C, spawnPool(e, true)).pick) || r.best;
  return spawnSpot(e, c.x, c.z, C);
}
/* From the chosen point to the spawn spot: a navigation node drawn at random within SPAWN_JIT m of the point, on the same floor, in view
   of the point, with no living soldier within 0.9 m and, on respawn (C), out of the opponents' sight (on an open map, a step to the
   side was enough to step out into the open); otherwise the point's node. Two soldiers who draw the same point at the same time (online,
   each chooses locally) do not land on each other; what remains of an overlap resolves itself by walking (spawnPush, 07c-controller.js). */
const SPAWN_JIT = 1.7;
function spawnSpot(e, x, z, C) {
  const id0 = navNode(x, gy0(x, z), z);
  if (id0 < 0) return new V3(x, gy0(x, z), z);
  const y0 = NAV.ny[id0], free = (id) => {
    for (const o of entities) if (o !== e && o.alive && Math.abs(o.pos.y - NAV.ny[id]) < 1.2 && hyp(o.pos.x - NAV.nx[id], o.pos.z - NAV.nz[id]) < 0.9) return false;
    return true;
  };
  for (let k = 0; k < 12; k++) {
    const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * SPAWN_JIT, id = navNode(NAV.nx[id0] + Math.cos(a) * r, y0, NAV.nz[id0] + Math.sin(a) * r);
    if (id < 0 || Math.abs(NAV.ny[id] - y0) > 0.4 || !free(id)) continue;
    if (id !== id0 && !lineClear(_v1.set(NAV.nx[id0], y0 + 1, NAV.nz[id0]), _v2.set(NAV.nx[id], NAV.ny[id] + 1, NAV.nz[id]))) continue;
    if (id !== id0 && C && spawnSeen(C, NAV.nx[id], NAV.nz[id], NAV.ny[id])) continue;
    return new V3(NAV.nx[id], NAV.ny[id], NAV.nz[id]);
  }
  return new V3(NAV.nx[id0], y0, NAV.nz[id0]);
}
/* Heading on spawn: toward the opponent in teams (at the start, straight to the enemy base, the whole formation facing the same way; afterwards
   toward the middle of the living opponents), toward the map center in free-for-all, toward the nearest point to capture in
   domination; turned if needed so as not to face a wall (spawnFace) */
function spawnYaw(e, p) {
  let tx = 0, tz = 0;
  if (MATCH.mode === 'tdm') {
    if (OPEN.on) return e.team === 0 ? 0 : Math.PI;
    const foes = entities.filter((o) => o.alive && !o.off && !allied(o, e)).map((o) => [o.pos.x, o.pos.z]);
    [tx, tz] = spawnMid(foes.length ? foes : SPAWNS[1 - e.team]);
  } else if (MATCH.mode === 'dom') {
    let bd = 1e9;
    for (const q of DOM.pts) { const d = hyp(q.x - p.x, q.z - p.z) + (q.owner === e.team ? 40 : 0); if (d < bd) { bd = d; tx = q.x; tz = q.z; } }
  }
  return spawnFace(p, Math.atan2(-(tx - p.x), -(tz - p.z)));
}
/* A heading that does not face a wall point-blank: the closest to the wanted heading that leaves 4 m of clear view */
function spawnFace(p, yaw) {
  _v1.set(p.x, p.y + 1.5, p.z);
  for (const o of [0, 0.5, -0.5, 1, -1, 1.5, -1.5]) {
    const a = yaw + o;
    if (lineClear(_v1, _v2.set(p.x - Math.sin(a) * 4, p.y + 1.5, p.z - Math.cos(a) * 4))) return a;
  }
  return yaw;
}

/* ==========================================================================
   DOMINATION
   Three points (MAP_DEFS.<id>.dom: [x, z] of A, B, C, symmetric in z like the bases): A near Alpha's base, C near
   Bravo's, B in the center. v goes from -1 (Bravo) to +1 (Alpha): a side alone in the zone advances it (faster with
   several players), both sides present block it. The point changes hands by passing through neutral: it must first be
   neutralized. With nobody on it, a held point firms up and a half-captured point falls back to neutral.
   ========================================================================== */
const DOM = { pts: [], rad: 5.5, dy: 2.8, tick: 4, rate: 1 / 6, acc: [0, 0], side: [0, 1], names: ['A', 'B', 'C'], mk: [], tex: null };
const DOM_COL = { ally: [0.56, 0.82, 0.42], enemy: [0.89, 0.28, 0.23], none: [0.82, 0.82, 0.76], hot: [0.96, 0.75, 0.23] };
const _dv = new V3();
function domInit() {
  const defs = CURMAP.def && CURMAP.def.dom;
  if (!defs) return;
  DOM.acc[0] = DOM.acc[1] = 0; DOM.side = [0, 1];
  DOM.pts = defs.map(([x, z], i) => {
    const id = navNode(x, gy0(x, z), z), y = id >= 0 ? NAV.ny[id] : gy0(x, z);
    const p = { i, name: DOM.names[i], x, z, y, owner: -1, v: 0, n: [0, 0], contest: false, mmCol: null, mmFill: '', mmLine: '', mmCv: null }; // mm : mini-carte (domMinimap)
    domBuild(p);
    return p;
  });
  // on-screen markers: direct children of #hud, placed in front of the scope (#scope): they are world objects, under everything else in the HUD
  // (messages, XP gains) and under the scope mask
  const hud = $('hud'), at = $('scope');
  for (const p of DOM.pts) {
    const el = document.createElement('div'); el.className = 'dpm'; el.innerHTML = `<b>${p.name}</b><i></i>`;
    hud.insertBefore(el, at); DOM.mk.push(el); p.el = el;
  }
  $('domRow').innerHTML = DOM.pts.map((p) => `<span id="domB${p.i}">${p.name}</span>`).join('');
}
function domClear() {
  for (const p of DOM.pts) {
    if (!p.obj) continue;
    if (p.obj.parent) p.obj.parent.remove(p.obj);
    p.obj.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  }
  if (DOM.tex) { DOM.tex.ring.dispose(); DOM.tex.veil.dispose(); DOM.tex = null; }
  for (const el of DOM.mk) el.remove();
  DOM.pts = []; DOM.mk = [];
}
/* A point's beacon, discreet and blended into the scenery: a ground disc with a soft edge and its fringe (the capture zone), a low
   veil fading with height (the zone's limit, seen from afar as from up close), a pole and a flag rising as the
   capture progresses. No beam: from afar, the on-screen marker (letter and distance) is enough. Textures shared by the three points. */
function domTextures() {
  if (DOM.tex) return DOM.tex;
  // ground: barely tinted disc, soft-edged fringe near the edge (the radial gradient replaces any hard line)
  const ring = canvasTex(256, (g, S) => {
    const r = S / 2, gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.04)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.12)'); gr.addColorStop(0.9, 'rgba(255,255,255,0.3)');
    gr.addColorStop(0.945, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.985, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  }, false);
  // veil: opaque at the foot, transparent at the top
  const veil = canvasTex(64, (g, S) => {
    const gr = g.createLinearGradient(0, 0, 0, S);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0.7)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  }, false);
  return (DOM.tex = { ring, veil });
}
/* Dummy domination point, compiled with the map (mapCompile) then hidden: the real points are created at the start of a domination
   match, after compilation, and their programs (ring and veil, pole, flag) used to compile on the first frame then in the
   first seconds of the match (26 ms hitch recorded by stutters.js in domination on Port-Maël, more under Direct3D); same
   materials, same programs, which three.js keeps as long as this point exists. Freed with the map (mapAdd). */
function domWarm() {
  if (!CURMAP.def || !CURMAP.def.dom) return null;
  const p = { i: 0, name: 'A', x: 0, z: 0, y: -60, owner: -1, v: 0, n: [0, 0], contest: false };
  domBuild(p); p.obj.name = 'domination (compilation)';
  return p.obj;
}
function domBuild(p) {
  const T = domTextures(), g = new THREE.Group(); g.position.set(p.x, p.y, p.z);
  const add = (geo, mat, y, order) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.userData.noAO = true; m.renderOrder = order; m.frustumCulled = false; g.add(m); return m; };
  const soft = (map, order) => { const m = new THREE.MeshBasicMaterial({ map, color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true }); m.polygonOffset = true; m.polygonOffsetFactor = -order; return m; };
  p.ringMat = soft(T.ring, 2); p.ringMat.opacity = 0.9;
  const disc = add(new THREE.CircleGeometry(DOM.rad, 64), p.ringMat, 0.05, 4); disc.rotation.x = -Math.PI / 2;
  p.veilMat = soft(T.veil, 0); p.veilMat.opacity = 0.5;
  add(new THREE.CylinderGeometry(DOM.rad, DOM.rad, 1.5, 64, 1, true), p.veilMat, 0.75, 5);
  add(new THREE.CylinderGeometry(0.04, 0.05, 2.8, 8), new THREE.MeshBasicMaterial({ color: 0x2a2a26 }), 1.4, 1);
  p.flagMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const fg = new THREE.PlaneGeometry(1.0, 0.62); fg.translate(0.5, 0, 0);
  p.flag = add(fg, p.flagMat, 0.5, 2);
  p.obj = g; mapAdd(g);
}
function domColor(p) {
  const me = PL.ent.team;
  if (p.contest) return DOM_COL.hot;
  if (p.owner === -1) return DOM_COL.none;
  return p.owner === me ? DOM_COL.ally : DOM_COL.enemy;
}
function domUpdate(dt) {
  if (!DOM.pts.length) return;
  for (const p of DOM.pts) {
    const n = [0, 0];
    for (const e of entities) {
      if (!e.alive || Math.abs(e.pos.y - p.y) > DOM.dy || hyp(e.pos.x - p.x, e.pos.z - p.z) > DOM.rad) continue;
      n[e.team]++;
    }
    p.n = n; p.contest = n[0] > 0 && n[1] > 0;
    if (domGuest()) continue; // online, the host holds the points: the guest receives their state (domNetApply)
    const was = p.owner;
    if (!p.contest && (n[0] || n[1])) {
      const t = n[0] ? 0 : 1, k = Math.min(n[t], 3);
      p.v = clamp(p.v + (t === 0 ? 1 : -1) * dt * DOM.rate * (1 + 0.5 * (k - 1)), -1, 1);
    } else if (!p.contest) {
      const to = p.owner === -1 ? 0 : p.owner === 0 ? 1 : -1;
      p.v += clamp(to - p.v, -dt * 0.1, dt * 0.1);
    }
    if (p.v >= 1) p.owner = 0; else if (p.v <= -1) p.owner = 1;
    else if ((p.owner === 0 && p.v <= 0) || (p.owner === 1 && p.v >= 0)) p.owner = -1;
    if (p.owner !== was) domChanged(p, was);
  }
  for (const t of [0, 1]) {
    const s = domSide(t);
    if (s !== DOM.side[t]) {
      DOM.side[t] = s;
      if (t === PL.ent.team) hudMsg(s === t ? _t('Your spawns return to your base') : _t('Crossed fronts: your spawns switch to the opposing side'), s === t ? 'ally' : 'xp', 3);
    }
  }
  if (MATCH.over || domGuest()) return;
  for (const t of [0, 1]) {
    DOM.acc[t] += DOM.pts.filter((p) => p.owner === t).length * dt / DOM.tick;
    while (DOM.acc[t] >= 1) { DOM.acc[t] -= 1; MATCH.score[t]++; }
  }
  if (MATCH.score[0] >= MATCH.limit || MATCH.score[1] >= MATCH.limit) {
    matchFinish(); // result announcement (09l-end.js), then scoreboard: domination has no killcam
  }
}
/* Lobby guest: they compute neither point capture nor score */
function domGuest() { return MATCH.online && NET.role !== 'host'; }
/* Point state held by the host, attached to its sends: [[v, owner]...] and both sides' score */
function domNetState() { return { p: DOM.pts.map((p) => [Math.round(p.v * 1000) / 1000, p.owner]), s: MATCH.score.slice() }; }
function domNetApply(m) {
  if (!domGuest() || !m || !Array.isArray(m.p) || m.p.length !== DOM.pts.length) return;
  m.p.forEach((q, i) => {
    const p = DOM.pts[i], was = p.owner;
    p.v = clamp(+q[0] || 0, -1, 1); p.owner = q[1] === 0 || q[1] === 1 ? q[1] : -1;
    if (p.owner !== was) domChanged(p, was);
  });
  if (Array.isArray(m.s) && !MATCH.outro) MATCH.score = [m.s[0] | 0, m.s[1] | 0];
}
/* A point changes hands: announcement, and score points to those who took it */
function domChanged(p, was) {
  squadDirty(); // a point changes hands: the team plan is redone right away (07d-squad.js)
  const me = PL.ent.team, o = p.owner;
  if (o !== -1) {
    for (const e of entities) {
      if (!e.alive || e.team !== o || !p.n[o] || Math.abs(e.pos.y - p.y) > DOM.dy || hyp(e.pos.x - p.x, e.pos.z - p.z) > DOM.rad) continue;
      e.score += 100; e.caps++;
      if (e.isPlayer) { xpPopup('+100', `${_t('Point {0} captured', p.name)}`); challengeAdd('vDom'); }
    }
    hudMsg(o === me ? `${_t('Point {0} captured', p.name)}` : _t('Point {0} lost', p.name), o === me ? 'ally' : 'enemy', 2.2);
    sfxAnnounce(o === me ? 'cap' : was === me ? 'lost' : 'ecap', o === me ? 'st_capture' : 'st_lost'); // ecap: taken by the enemy on a neutral point (voiceless signal)
  } else if (was === me) { hudMsg(`${_t('Point {0} neutralized by the enemy', p.name)}`, 'enemy', 2); sfxAnnounce('neutral', 'st_lost'); }
  else if (was !== -1) { hudMsg(`${_t('Point {0} neutralized', p.name)}`, 'ally', 1.8); sfxUi('confirm'); }
}
/* Bonus for an elimination near a point: defending your own or attacking the other side's */
function domKillBonus(a, v) {
  if (MATCH.mode !== 'dom' || !a.isPlayer) return;
  for (const p of DOM.pts) {
    if (hyp(v.pos.x - p.x, v.pos.z - p.z) > DOM.rad + 4 || hyp(a.pos.x - p.x, a.pos.z - p.z) > DOM.rad + 8) continue;
    a.score += 50; xpPopup('+50', p.owner === a.team ? `${_t('Defending point {0}', p.name)}` : `${_t('Attacking point {0}', p.name)}`, 'small');
    return;
  }
}

/* Frame by frame: beacon colors and flag, on-screen markers, capture bar, score pips */
function domHud(dt) {
  if (!DOM.pts.length) return;
  const me = PL.ent, now = MATCH.time, pulse = 0.65 + 0.35 * Math.sin(now * 6);
  let inside = null;
  for (const p of DOM.pts) {
    const c = domColor(p), k = p.contest ? pulse : 1, m = p.v > 0 ? DOM_COL[me.team === 0 ? 'ally' : 'enemy'] : p.v < 0 ? DOM_COL[me.team === 1 ? 'ally' : 'enemy'] : DOM_COL.none;
    const here = me.alive && p.n[me.team] > 0 && Math.abs(me.pos.y - p.y) <= DOM.dy && hyp(me.pos.x - p.x, me.pos.z - p.z) <= DOM.rad;
    const dim = p.contest ? 1 : p.owner === -1 ? 0.55 : 0.8; // slightly dark tints: they read on snow (a neutral point is gray, not white)
    p.ringMat.color.setRGB(c[0] * dim * k, c[1] * dim * k, c[2] * dim * k); p.veilMat.color.setRGB(c[0] * dim, c[1] * dim, c[2] * dim);
    p.veilMat.opacity = damp(p.veilMat.opacity, here ? 0.14 : 0.5, 4, dt); // inside the zone, the veil fades so it doesn't obstruct the view
    p.flagMat.color.setRGB(m[0], m[1], m[2]);
    p.flag.position.y = 0.4 + 2.0 * Math.abs(p.v);
    p.flag.rotation.y = Math.sin(now * 2.2 + p.i) * 0.25;
    // on-screen marker
    _dv.set(p.x, p.y + 3.4, p.z).project(camera);
    const el = p.el, show = _dv.z < 1 && Math.abs(_dv.x) < 1.1 && Math.abs(_dv.y) < 1.1;
    hudStyle(el, 'opacity', show ? '1' : '0');
    if (show) {
      hudStyle(el, 'transform', `translate(${Math.round((_dv.x * 0.5 + 0.5) * VIEW.w)}px, ${Math.round((-_dv.y * 0.5 + 0.5) * VIEW.h)}px) translate(-50%, -50%)`);
      hudText(el.lastChild, `${Math.round(hyp(p.x - camera.position.x, p.z - camera.position.z))} m`);
      const cls = 'dpm ' + (p.contest ? 'hot' : p.owner === -1 ? 'none' : p.owner === me.team ? 'ally' : 'enemy');
      if (el.className !== cls) el.className = cls;
    }
    const b = $('domB' + p.i), bc = p.contest ? 'hot' : p.owner === -1 ? '' : p.owner === me.team ? 'ally' : 'enemy';
    if (b && b.className !== bc) b.className = bc;
    if (here) inside = p;
  }
  // capture bar (below the crosshair prompts): tint by class (shell.html, tokens), written only when it changes
  const bar = $('domCap');
  let cls = '';
  if (inside) {
    const p = inside, mv = Math.abs(p.v), mine = (p.v > 0) === (me.team === 0);
    hudText($('domCapT'), p.contest ? `${_t('Point {0} contested', p.name)}` : p.owner === me.team && mv >= 1 ? _t('Point {0} held', p.name) : p.owner === -1 || !mine ? `${_t('Capturing point {0}', p.name)}` : _t('Point {0}: taking it back', p.name));
    hudStyle($('domCapF'), 'transform', `scaleX(${mv.toFixed(3)})`);
    cls = p.contest ? 'show hot' : mine || p.v === 0 ? 'show' : 'show enemy';
  }
  if (bar.className !== cls) bar.className = cls;
}

/* Bots: a walkable spot in point p's zone, between r0 and r1 meters from its center, that the bot can hold (the team plan
   that picks the point and the role is in src/07d-squad.js) */
function domSpot(p, r0, r1) {
  for (let k = 0; k < 6; k++) {
    const a = rand(0, TAU), r = rand(r0, r1), x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r, id = navNode(x, p.y, z);
    if (id < 0 || hyp(NAV.nx[id] - p.x, NAV.nz[id] - p.z) > DOM.rad - 1 || Math.abs(NAV.ny[id] - p.y) > 1.5) continue;
    const g = new V3(NAV.nx[id], NAV.ny[id], NAV.nz[id]); g.hold = true; g.dom = p.i; return g;
  }
  const g = new V3(p.x, p.y, p.z); g.hold = true; g.dom = p.i; return g;
}

/* Minimap: zone and letter of each point, in the color of its state (the context is already rotated to the player's heading). The letter is
   drawn once per color in a small canvas (domLetter): written every frame (font re-read, outline and fill), it
   took up to 2 ms per frame (owner's performance report, domination on Port-Maël, 280 frames per second) */
const DOM_MM = { box: 24, k: 3 }; // letter canvas: side in minimap units, pixels per unit
function domMinimap(g, scale, yaw) {
  for (const p of DOM.pts) {
    const col = domColor(p);
    if (p.mmCol !== col) { p.mmCol = col; const c = col.map((x) => Math.round(x * 255)).join(','); p.mmFill = `rgba(${c},0.22)`; p.mmLine = `rgba(${c},0.9)`; domLetter(p, c); if (document.fonts && document.fonts.status === 'loading') p.mmCol = null; } // (font not loaded yet: the letter will be redone)
    g.fillStyle = p.mmFill; g.strokeStyle = p.mmLine; g.lineWidth = 2;
    g.beginPath(); g.arc(p.x * scale, p.z * scale, DOM.rad * scale, 0, TAU); g.fill(); g.stroke();
    g.save(); g.translate(p.x * scale, p.z * scale); g.rotate(-yaw);
    const B = DOM_MM.box; g.drawImage(p.mmCv, -B / 2, -B / 2, B, B); g.restore();
  }
}
/* A point's letter (color c: "r,g,b"), at the center of its canvas, with its dark outline */
function domLetter(p, c) {
  const B = DOM_MM.box, K = DOM_MM.k, cv = p.mmCv || (p.mmCv = document.createElement('canvas'));
  cv.width = cv.height = B * K;
  const x = cv.getContext('2d'); x.setTransform(K, 0, 0, K, 0, 0);
  x.font = '700 15px "Barlow Condensed", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.strokeStyle = 'rgba(0,0,0,0.7)'; x.lineWidth = 3; x.strokeText(p.name, B / 2, B / 2 + 1);
  x.fillStyle = `rgb(${c})`; x.fillText(p.name, B / 2, B / 2 + 1);
}
