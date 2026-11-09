/* ==========================================================================
   SOLDIERS AND AI
   ========================================================================== */
/* Settings per difficulty: react = delay between "spotted" and first shot; err = aim drift; settle = time for it to
   tighten; head = chance of aiming at the head; turn = look speed; dmg = damage dealt to the player; nade = grenades;
   see = spotting speed; lag = pursuit lag on a moving target; flinch = aim disturbance under impacts;
   tokens = opponents that can aim at the player at once (the others shoot wide: suppressive fire); mem = memory (s);
   flair = taste for sliding (07e-human.js); chase = pursuit duration (s) of an engaged opponent who went
   out of sight (botChasing, botSearchStart); spin = rotation speed (rad/s) of a big head movement, toward what it does not see
   (an impact, a noise, its path), a bit more toward an opponent in view; startle = surprise (s) of a bot hit by a shooter it does not
   see, before it turns around (botHurt) */
/* Bot difficulty for the match: online, the one the host chose in the lobby (NET.cfg.diff), otherwise the Solo one */
function botDiff() { return DIFF[MATCH.online ? NET.cfg.diff : Settings.difficulty] || DIFF[1]; }
const DIFF = [
  { name: _t('Recruit'), react: [0.45, 0.8], err: 0.11, settle: 1.7, head: 0.03, turn: 3.2, dmg: 0.7, nade: 0.3, see: 0.6, lag: 0.34, flinch: 1.3, tokens: 1, mem: 2.5, flair: 0.3, chase: 8, spin: 3.4, startle: [0.45, 0.7] },
  { name: _t('Regular'), react: [0.28, 0.5], err: 0.08, settle: 1.1, head: 0.07, turn: 4.8, dmg: 0.88, nade: 0.6, see: 0.85, lag: 0.2, flinch: 1.0, tokens: 2, mem: 4, flair: 0.7, chase: 13, spin: 4.6, startle: [0.32, 0.5] },
  { name: _t('Veteran'), react: [0.16, 0.3], err: 0.055, settle: 0.7, head: 0.14, turn: 7, dmg: 1.0, nade: 1.0, see: 1.1, lag: 0.11, flinch: 0.7, tokens: 3, mem: 6, flair: 1.0, chase: 18, spin: 5.8, startle: [0.22, 0.36] },
];
const BOT_NAMES = [
  ['Dubois', 'Keller', 'Marchetti', 'Okafor', 'Novak'],
  ['Volkov', 'Rahim', 'Karimov', 'Drago', 'Sokol', 'Petrenko'],
];
const TEAM_NAMES = ['Alpha', 'Bravo'];
const entities = [];
const soundEvents = [];
const NADES = [];

/* ---------- Bots ---------- */
const BOT_WEAPONS = ['m4', 'ak47', 'm4', 'scarh', 'famas', 'mp5', 'mp7', 'ump45', 'vector', 'm1014', 'rem870', 'l96', 'svd', 'm4', 'ak47'];
/* Bot weapons by map type (MAP_DEFS.<id>.type): all families remain possible everywhere, the map type favors
   some (owner feedback: "keep it varied, but favoring certain weapons"): submachine guns and shotguns in
   close combat, assault and sniper rifles on a big open map, the original mix on a medium map. A family is drawn
   by these shares, then a weapon of the family at random; one sniper per team, two on an open map (beyond that, another
   family is drawn). Drawn each match: bots used to be armed once and for all at game start. Online, the host arms its bots and the
   guests receive it with their state. */
const BOT_WEAPON_MIX = {
  close: { smg: 0.35, ar: 0.3, shotgun: 0.25, sniper: 0.1 },
  mid: { ar: 0.45, smg: 0.27, shotgun: 0.14, sniper: 0.14 },
  open: { ar: 0.4, sniper: 0.25, smg: 0.2, shotgun: 0.15 },
};
function botPickCat(mix, noSniper) {
  let tot = 0; for (const c in mix) if (!(noSniper && c === 'sniper')) tot += mix[c];
  let r = Math.random() * tot;
  for (const c in mix) { if (noSniper && c === 'sniper') continue; r -= mix[c]; if (r <= 0) return c; }
  return 'ar';
}
/* Draw made at map load (mapCompile): the first match keeps it, its weapons were built and compiled with the map
   (drawn at launch, they were built mid-match, on their first appearance); later matches redo a draw */
const BOT_ARM = { map: null };
/* Bot weapons (botArmForMap draw) built in advance: world model and first-person model (the killer's killcam); once
   built, they stay for the session (gunTrim keeps the bare weapons) */
function botArmPrebuild() { for (const b of entities) if (!b.isPlayer && !b.isRemote) gunPrebuild(b.weapon); }
function botArmForMap() {
  const type = CURMAP.def && BOT_WEAPON_MIX[CURMAP.def.type] ? CURMAP.def.type : 'mid', mix = BOT_WEAPON_MIX[type], maxSn = type === 'open' ? 2 : 1, sn = [0, 0];
  const byCat = {}; for (const id in WEAPONS) { const c = WEAPONS[id].cat; if (mix[c] !== undefined) (byCat[c] || (byCat[c] = [])).push(id); }
  for (const b of entities) {
    if (b.isPlayer || b.isRemote) continue;
    const cat = botPickCat(mix, sn[b.team] >= maxSn), list = byCat[cat] || byCat.ar, wid = list[Math.floor(Math.random() * list.length)];
    if (WEAPONS[wid].ai.sniper) sn[b.team]++;
    const def = WEAPONS[wid];
    if (b.weapon !== def) { b.weapon = def; b.mag = def.mag; setSoldierGun(b.model, def.key); }
    b.skin = skinOfWeapon(def); soldierLook(b.model, b.skin, skinRel(b)); // the outfit follows the weapon family (06ga-outfits.js)
  }
}
/* Fields a bot receives during the match (tactic, sweep, zone), declared up front in the makeBot literal:
   a field added later, in an order that changes from bot to bot, creates different shapes and makes
   updateBot and poseSoldier go through polymorphic accesses (and deoptimizations). The values are those that
   behave like the field's absence in existing tests; markT and stealth stay undefined because they are
   tested with === undefined (09m-markers.js, 07b-tactics.js). */
const BOT_STATE = {
  senseAt: 0, dmgMul: 1, forceDecide: false, wantCrouch: false, tapCd: 0, yawV: 0, pitchV: 0, outT: 0, markT: undefined, markVis: false,
  stealth: undefined, peeking: false, peekT: 0, peekSide: 0, leftCoverT: 0, flankPt: null, throwT: 0,
  bump: 0, bumpT: 0, unstickN: 0, unstickAt: -99, sideT: 0, sideDir: 0, backT: 0, recT: 0, recX: 0, recZ: 0, jumpT: 0, coverGoal: null, fwdOk: true, backOk: true,
  pers: null, slideAt: -99, jigT: 0, jigS: 1, rush: false, pace: 2, paceT: 0, glanceT: 0, glanceA: 0, dustT: 0,
  warnT: 0, stepHeardT: -99, grudge: null, revenge: null, wasVis: false, standT: 0, fleeT: 0, fleeX: 0, fleeZ: 0, nadeOn: true,
  chaseE: null, contactT: -99, contactD: 0, lostVX: 0, lostVZ: 0, lostWeak: false, searchN: 0, searchP: null, searchC: null, searchPts: null,
  sweepT: 0, sweepDur: 0, sweepYaw: 0, sweepA: 0, startleT: 0, startleAt: -99, blindT: 0, blindW: 0, blindX: 0, blindZ: 0, mkNadeT: -99,
};
function makeBot(team, idx) {
  let wid = BOT_WEAPONS[(idx * 3 + team * 2) % BOT_WEAPONS.length];
  if (WEAPONS[wid].ai.sniper && entities.some((e) => !e.isPlayer && e.team === team && e.weapon.ai.sniper)) wid = 'm4'; // only one sniper per team
  const def = WEAPONS[wid];
  const b = {
    ...BOT_STATE, id: entities.length, hfDt: 0, name: BOT_NAMES[team][idx], team, isPlayer: false, pos: new V3(), vel: new V3(), vy: 0, yaw: 0, pitch: 0,
    alive: false, health: 100, crouch: false, crouchAmt: 0, kills: 0, deaths: 0, score: 0, assists: 0, streak: 0, lastShotT: -9,
    weapon: def, mag: def.mag, reloadT: 0, fireCd: 0, burst: 0, pauseT: 0,
    target: null, visible: false, lastKnown: new V3(), lastSeenT: -99, reactT: 0, seenT: 0, aimHead: false,
    path: null, pathI: 0, goal: null, repathT: 0, stuckT: 0, lastPos: new V3(), strafeDir: 0, strafeT: 0, senseT: Math.random() * 0.2,
    nadeCd: rand(8, 20), nades: 1, respawnT: 0, deathT: 0, deathDir: new V3(), deathSide: 1, deathTwist: 0, deathY0: 0.95, stepAcc: 0, lookYaw: 0, flee: null,
    dmgBy: new Map(), lastForce: null, aw: new Map(), lookAtT: 0, lookAtX: 0, lookAtZ: 0, heardT: -99, fear: 0, aimT: null, aimP: new V3(),
  };
  initCtl(b, [wid], 60);
  b.pers = botPers(); // its temperament, the same for the whole match
  b.skin = skinOfWeapon(def);
  b.model = makeSoldier(b.skin, team === 0 ? 0 : 1, def.key); // at start, the player is Alpha
  b.model.root.visible = false;
  entities.push(b);
  return b;
}

/* Spawns per team [[x, z], ...] and points of interest [x, y, z, route, hold] of the loaded map
   (copied from its definition at load, see mapSetup; the "hold" points are positions a player holds for
   a few seconds: balcony, walkway...) */
const SPAWNS = [[], []];
/* Spawn point choice: see chooseSpawn (src/09i-modes.js), which depends on the game mode */
function spawnEntity(e) {
  e.spawnAt = MATCH.time;
  e.pos.copy(chooseSpawn(e)); e.vel.set(0, 0, 0); e.vy = 0; spawnNote(e);
  e.yaw = spawnYaw(e, e.pos); e.pitch = 0; e.protT = modeDef().prot;
  e.alive = true; e.health = 100; e.streak = 0; e.comboN = 0; e.crouch = false; e.crouchAmt = 0; e.slideT = 0; e.slideCd = 0; e.slideBuf = 0; e.slideAmt = 0; e.dmgBy.clear(); e.voidDead = false;
  if (!e.isPlayer) {
    e.arms = makeArms([e.weapon.id], 60); e.input = makeInput(); e.onGround = true; e.vy = 0; e.eyeH = 1.62; e.sprinting = false; e.lastShots = 0; e.burstLeft = 0;
    e.target = null; e.visible = false; e.lastSeenT = -99; e.path = null; e.goal = null; e.nades = NADE_COUNT; e.nadeType = botNadeType(); e.nadeCd = rand(8, 28); e.nadeOn = Math.random() < 0.8 * botDiff().nade; e.aw.clear(); e.aimT = null; e.lookAtT = 0; e.fear = 0; e.sq = null; e.lastHitT = -9;
    e.lookYaw = e.yaw; e.lastForce = null; releaseCover(e); initTactics(e); e.atCover = false;
    // match times (MATCH.time) that restart from zero at the next one: a bot blinded at 400 s stayed blind for 400 s of the match
    // like before (it staggered in place without shooting, especially online where the host chains matches), deaf to noises, quick to back off
    e.blindT = 0; e.heardT = -99; e.stepHeardT = -99; e.warnT = 0; e.senseAt = 0; e.slideAt = -99; e.unstickN = 0; e.unstickAt = -99; e.recT = 0; e.backT = 0; e.sideT = 0; e.jumpT = 0; e.mkNadeT = -99;
    e.model.rag = null; e.model.sink = 0; e.model.root.visible = true; e.vel.set(0, 0, 0);
    poseSoldier(e, 0); poseSoldier(e, 0); layoutSoldier(e.model, true);
  }
}

const POI = []; // see SPAWNS
const LANE_ROLES = ['L', 'M', 'E', 'M', 'L', 'E'];
/* Estimated position of a noise, impact or near-miss shot: never exact, the error grows with distance */
function botGuess(from, pos, base, perM) {
  const err = base + from.distanceTo(pos) * perM, a = Math.random() * TAU, r = err * Math.sqrt(Math.random());
  return new V3(pos.x + Math.cos(a) * r, pos.y, pos.z + Math.sin(a) * r);
}
/* The bot turns its head toward a point for a moment (noise, impact, glimpsed opponent) and slows down to orient itself */
function botLookAt(b, p, now, dur) { b.lookAtX = p.x; b.lookAtZ = p.z; b.lookAtT = now + dur; }
const _gpick = new V3();
function pickGoal(b, now) {
  const ffa = MATCH.mode === 'ffa', dom = MATCH.mode === 'dom', uav = !ffa && MATCH.uav[b.team] > 0; // free-for-all: the UAV is only for the player
  // domination: the team plan (07d-squad.js) gives each its point, to take or to defend
  if (dom) { const g = squadGoal(b, now); if (g) return g; }
  else {
    // return to where it got killed (initTactics), or where a teammate just reported an opponent: it goes to look, with cautious steps
    if (b.revenge) { const r = b.revenge; b.revenge = null; b.warnT = now + 15; return botGuess(b.pos, _gpick.set(r.x, b.pos.y, r.z), 3, 0.05); }
    const I = SQ.intel[b.team];
    if (!ffa && I && now - I.t < 8 && hyp(I.x - b.pos.x, I.z - b.pos.z) < 55 && Math.random() < 0.3) { b.warnT = now + 10; return botGuess(b.pos, _gpick.set(I.x, b.pos.y, I.z), 4, 0.1); }
  }
  // the team's satellite shows them live (within a few meters, like the UAV)
  if (!ffa && satOn(b.team) && Math.random() < 0.5) {
    const foes = entities.filter((e) => e.alive && !e.off && !e.inMecha && !allied(e, b));
    if (foes.length) return botGuess(b.pos, pick(foes).pos, 5, 0.04);
  }
  // the team's UAV gives the opponents' position at its last sweep (uavPulse), within a few meters: it goes to look, it doesn't find them to the centimeter
  if (uav && Math.random() < 0.5) {
    const p = MATCH.uavPing[b.team], foes = p ? p.pts.filter((q) => q.o.alive && !allied(q.o, b)) : [];
    if (foes.length) { const q = pick(foes); return botGuess(b.pos, _gpick.set(q.x, b.pos.y, q.z), 3, 0.03); }
  }
  const D = CURMAP.def, laneOf = D.lane;
  const recent = soundEvents.filter((s) => now - s.t < 6 && !s.quiet && soundFoe(s, b) && (laneOf(s.pos.x) === b.lane || s.pos.distanceTo(b.pos) < 22));
  if (recent.length && Math.random() < (ffa ? 0.4 : 0.3)) { const s = pick(recent); return botGuess(b.pos, s.pos, 3, 0.12); }
  // like a player, each bot has its favorite route and climbs toward the positions to hold
  const own = b.team === 0 ? 1 : -1, side = ffa ? 0 : -own; // free-for-all: no half of the map to favor
  if (b.weapon.ai.sniper && Math.random() < (dom ? 0.3 : 0.7)) { const g = new V3(D.sniper[0], D.sniper[1], D.sniper[2] * own); g.hold = true; return g; }  // the sniper holds its post
  const lane = b.weapon.ai.sniper ? 'L' : b.lane, stickLane = Math.random() < 0.88, rush = now - (MATCH.startAt || 0) < 25 || now - (b.spawnAt || -99) < 6;
  let best = null, bw = -1;
  for (const p of POI) {
    const d = hyp(p[0] - b.pos.x, p[2] - b.pos.z); if (d < 8) continue;
    if (stickLane && p[3] !== lane) continue;
    const zs = Math.sign(p[2]);
    let w = Math.random() * (1 + (zs === side ? 1.1 : 0.6) + (Math.abs(p[2]) < 10 ? (rush ? 2.5 : 0.8) : 0) + (p[4] ? 0.9 : 0));
    const up = p[1] - gy0(p[0], p[2]);                                                // height above ground (terrain of a dune map)
    if (b.weapon.ai.sniper && up > 3 && zs === own) w += 2.5;                         // the sniper heads to its balcony
    if (b.weapon.ai.rush && p[4] && up > 1) w *= 0.4;
    let taken = false; for (const o of entities) if (o !== b && allied(o, b) && o.goal && hyp(o.goal.x - p[0], o.goal.z - p[2]) < 4) taken = true;
    if (taken) w *= 0.25;
    if (w > bw) { bw = w; best = p; }
  }
  if (!best) best = pick(POI);
  const g = new V3(best[0], best[1], best[2]); g.hold = !!best[4]; return g;
}
function setPath(b, target) {
  b.path = findPath(b.pos, target, botNearNode(b)); b.pathI = 1; b.goal = target.clone(); b.goal.hold = !!target.hold; b.goal.dom = target.dom; b.repathT = 1.5;
  if (!b.path) { b.goal = null; return; }
  if (b.path.length > 1 && !navWalkable(b.pos, b.path[1])) b.pathI = 0; // no shortcut through a partition at the start: the closest node first
}

/* ---------- Perception ----------
   An opponent is not spotted all at once: each bot keeps an attention gauge per opponent (b.aw, from 0 to 1) that rises
   when it is in its field of view and line of sight, the faster the closer it is, the nearer the center of the gaze, the more it runs
   or has just fired, and that falls when it hides or crouches. Past 1 it is spotted (b.visible); halfway the bot
   turns its head toward it ("there's something"). No information comes from anywhere but the eyes and ears:
   a noise, an impact or a passing bullet give an approximate direction (botGuess), never the exact position. */
const SEE = { rate: 2.6, decay: 0.4, near: 3 };
function botSense(b, now) {
  const D = botDiff();
  const sdt = clamp(now - (b.senseAt || now - 0.15), 0.05, 0.4); b.senseAt = now;
  const blind = now < (b.blindT || 0); // blinded by a flash: it sees nothing (it still hears)
  const eye = entEye(b, new V3());
  const fx = -Math.sin(b.lookYaw), fz = -Math.cos(b.lookYaw);
  let best = null, bd = 1e9, glance = null, gw = 0;
  for (const e of entities) {
    if (!e.alive || e.off || e.inMecha || allied(e, b)) continue; // (a pilot on board can't be seen: the mecha is shot at, mechaBotsShoot)
    const dx = e.pos.x - b.pos.x, dz = e.pos.z - b.pos.z, d = hyp(dx, dz);
    let aw = b.aw.get(e) || 0;
    if (d > 100) { if (aw > 0) b.aw.set(e, Math.max(0, aw - D.see * sdt)); continue; }
    const facing = (dx * fx + dz * fz) / (d || 1), tracking = b.target === e && now - b.lastSeenT < 1.5;
    // field of view: sharp at the center, blurry at the sides, none behind (except in contact)
    const ang = Math.acos(clamp(facing, -1, 1));
    let f = ang < 0.35 ? 1 : ang < 1.0 ? lerp(1, 0.35, (ang - 0.35) / 0.65) : ang < 1.6 ? lerp(0.35, 0.06, (ang - 1.0) / 0.6) : 0;
    if (d < SEE.near) f = Math.max(f, 0.6);
    if (tracking) f = Math.max(f, 0.7);
    let seen = 0;
    if (f > 0 && !blind) { // head and torso: two lines of sight; a half-hidden opponent is spotted more slowly; not through a smoke grenade
      if (lineClear(eye, entHead(e, _v2)) && !smokeBlocks(eye, _v2)) seen += 0.55;
      if (lineClear(eye, entChest(e, _v3)) && !smokeBlocks(eye, _v3)) seen += 0.55;
    }
    if (seen > 0) {
      const sp = hyp(e.vel.x, e.vel.z), A = e.arms ? armsW(e).def : null;
      let sig = (e.crouch ? 0.65 : 1) * (sp > 4.5 ? 1.3 : sp < 0.4 ? 0.8 : 1);
      if (now - e.lastShotT < 1.2) sig *= A && A.silent ? 1.2 : 2;   // the gunshot and its flash give away
      // fog also hides from bots (Port-Maël mist, Sirocco storm): no effect as long as it lets 80% of the view through
      const fv = Math.exp(-Math.pow(scene.fog.density * d, 2));
      const g = clamp(1.35 - d / 55, 0.25, 1.35) * clamp(0.2 + fv, 0.2, 1);
      aw = Math.min(1, aw + SEE.rate * f * g * sig * Math.min(1, seen) * D.see * sdt);
    } else {
      aw = Math.max(0, aw - SEE.decay * sdt);
      if (!b.visible && now - b.lastSeenT > 1.5) aw = botEars(b, e, d, aw, sdt, now, D);
    }
    b.aw.set(e, aw);
    if (aw >= 1 && seen > 0) {
      let s = d * (tracking ? 0.6 : 1) * (e.isPlayer ? 0.95 : 1);
      if (e.crouch && d > 30) s *= 1.3;
      if (s < bd) { bd = s; best = e; }
    } else if (seen > 0 && aw > 0.4 && aw > gw) { gw = aw; glance = e; }
  }
  if (best) {
    if (b.target !== best || now - b.lastSeenT > 1.2) {
      b.reactT = rand(D.react[0], D.react[1]) * (b.target === best ? 0.5 : 1);
      b.seenT = 0; b.aimHead = Math.random() < D.head && b.pos.distanceTo(best.pos) < 45;
      if (b.target !== best) squadIntel(b, best, now); // it shouts it to the team
    }
    b.target = best; b.visible = true; b.lastKnown.copy(best.pos); b.lastSeenT = now;
    b.chaseE = best; b.contactT = now; b.contactD = hyp(best.pos.x - b.pos.x, best.pos.z - b.pos.z); // the contact it will pursue if it hides (decideTactic)
  } else {
    if (b.visible) {
      b.aimT = null;
      const T = b.target;
      if (T) { // it runs: the bot aims a bit ahead, remembers where it was running (where to look for it) and whether it was badly hurt (press it)
        b.lastKnown.x += T.vel.x * 0.6; b.lastKnown.z += T.vel.z * 0.6; b.lostVX = T.vel.x; b.lostVZ = T.vel.z;
        b.lostWeak = T.health < 60 || (T.isPlayer ? !!PL.reload : !!(T.arms && T.arms.reload));
      }
    }
    b.visible = false;
    if (glance) botLookAt(b, glance.pos, now, 0.5);
    // ears: a shot, an explosion give a direction, not a position
    if (now - b.lastSeenT > D.mem * 0.7) {
      for (let i = soundEvents.length - 1; i >= 0; i--) {
        const s = soundEvents[i]; if (now - s.t > 0.6 || s.t <= b.heardT) break;
        const ds = s.pos.distanceTo(b.pos);
        if (soundFoe(s, b) && ds < (s.quiet ? 9 : s.loud ? 60 : 34)) {
          b.heardT = s.t; b.lastKnown.copy(botGuess(b.pos, s.pos, 2.5, 0.14)); b.lastSeenT = now - 2.5; b.target = null; botLookAt(b, b.lastKnown, now, 1.1); break;
        }
      }
    }
  }
}

/* An impact: the bot knows where it comes from (the direction of the shot), not how far or behind which exact corner. It turns,
   is disturbed for a moment, and the tactical decision comes with a reaction delay. Hit by a shooter it does not see, it is first
   startled: it only turns around after D.startle (b.startleT, once per surprise, the following bullets don't freeze it any
   longer), then at the speed of a big head movement (D.spin, updateBot). */
function botHurt(b, attacker, dmg, dir, now) {
  const D = botDiff();
  b.lastHitT = now; b.fear = Math.min(2, b.fear + dmg / 70);
  let late = 0;
  if (!b.visible && attacker && !allied(attacker, b)) {
    if (now - b.startleAt > 2) { b.startleAt = now; b.startleT = now + rand(D.startle[0], D.startle[1]); }
    late = Math.max(0, b.startleT - now); b.holdT = 0; // it was holding a position: a bullet in the back is not just a noise
  }
  b.decideT = Math.min(b.decideT, Math.max(late, rand(0.3, 0.55)));
  if (!attacker || allied(attacker, b)) return;
  b.aw.set(attacker, Math.max(b.aw.get(attacker) || 0, 0.6));
  if (!b.visible) {
    let ax = dir ? -dir.x : attacker.pos.x - b.pos.x, az = dir ? -dir.z : attacker.pos.z - b.pos.z; const al = hyp(ax, az) || 1;
    const along = { x: ax / al, z: az / al }, d = b.pos.distanceTo(attacker.pos) * rand(0.6, 1.4);
    const g = new V3(b.pos.x + along.x * d + rand(-2, 2), b.pos.y, b.pos.z + along.z * d + rand(-2, 2));
    b.lastKnown.copy(g); b.lastSeenT = now - 1; botLookAt(b, g, now, 1.3 + late);
    if (b.tactic === 'search') b.tactic = 'hunt'; // it was looking elsewhere: the bullet tells it where to go
  }
}

function coneDir(dir, angle) {
  if (angle <= 0) return dir.clone();
  const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * angle;
  const t1 = Math.abs(dir.y) < 0.95 ? new V3(0, 1, 0).cross(dir).normalize() : new V3(1, 0, 0).cross(dir).normalize();
  const t2 = new V3().crossVectors(dir, t1);
  return dir.clone().addScaledVector(t1, Math.cos(a) * r).addScaledVector(t2, Math.sin(a) * r).normalize();
}
/* Shared ray fire (player and bots) */
/* Body knockback by weapon (m/s): max power at close range, min at long range */
const RAGF = {
  pistol: { mag: 4.0, min: 3.0, lift: 2.0, near: 3, far: 15 },
  smg: { mag: 4.8, min: 3.5, lift: 2.4, near: 4, far: 20 },
  rifle: { mag: 5.4, min: 4.0, lift: 3.0, near: 6, far: 35 },
  sniper: { mag: 7.4, min: 6.5, lift: 4.2, near: 10, far: 90 },
  shotgun: { mag: 8.2, min: 3.6, lift: 4.4, near: 2, far: 12 },
};
/* Damage of a bullet from weapon def at distance d (props take hits like a soldier hit in the body) */
function propDamage(def, d) { return lerp(def.dmg[0], def.dmg[1], clamp((d - def.range[0]) / (def.range[1] - def.range[0]), 0, 1)); }
function fireRay(shooter, origin, dir, def, muzzle, tracer, dmgMul = 1) {
  const maxD = 300;
  if (shooter.isPlayer) PL.actT = MATCH.time;
  let w = rayWorld(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, maxD, 1), off = 0;
  // small props (fruit, shards) take the bullet without stopping it: they get pushed, then the shot continues
  while (w && w.prop && w.prop.d.through && off < maxD - 1) {
    const hit = _v3.set(origin.x + dir.x * (off + w.t), origin.y + dir.y * (off + w.t), origin.z + dir.z * (off + w.t)).clone();
    propShotLocal(w.prop, hit, dir, propDamage(def, off + w.t) * dmgMul, shooter);
    off += w.t + 0.04;
    w = rayWorld(origin.x + dir.x * off, origin.y + dir.y * off, origin.z + dir.z * off, dir.x, dir.y, dir.z, maxD - off, 1);
  }
  const wt = w ? off + w.t : maxD, wm = w ? w.m : null, wn = w ? new V3(w.nx, w.ny, w.nz) : null, wp = w ? w.prop : null;
  const eh0 = rayEntities(origin, dir, wt, shooter);
  // the enemy helicopter takes the bullets that hit it before anything else
  const hz = shooter.isRemote ? null : rayHelis(shooter, origin, dir, eh0 ? eh0.t : wt), eh = hz ? null : eh0;
  // an enemy drone too (08e-fpv.js)
  const dz = shooter.isRemote || !DRONES.length ? null : rayDrones(shooter, origin, dir, hz ? hz.t : eh ? eh.t : wt);
  // and an enemy mecha (08f-mecha.js): its armor stops the bullet
  const mz = dz || shooter.isRemote || !MECHAS.length ? null : rayMechas(shooter, origin, dir, hz ? hz.t : eh ? eh.t : wt);
  const endT = mz ? mz.t : dz ? dz.t : hz ? hz.t : eh ? eh.t : wt;
  if (HANGS.length) hangShot(origin, dir, endT, def.dmg[0] * dmgMul, shooter); // well bucket: pushed in passing, the bullet continues
  if (CANVASES.length) canvasesShot(origin, dir, endT); // laundry, flags: pushed in passing (02me-canvases.js)
  const end = origin.clone().addScaledVector(dir, endT);
  if (tracer && muzzle) FX.tracers.add(muzzle, end);
  kcEvent('ray', { a: (muzzle || origin).clone(), b: end.clone(), tr: !!muzzle && Math.random() < 0.7, flesh: !!eh, head: !!eh && eh.part === 'head', dir: dir.clone() });
  if (mz) {
    mechaDamage(mz.me, lerp(def.dmg[0], def.dmg[1], clamp((endT - def.range[0]) / (def.range[1] - def.range[0]), 0, 1)) * dmgMul * MECHA_HEAT.bullet, shooter);
    impactFx(end, dir.clone().negate(), 'metal', false, true);
  } else if (dz) {
    fpvDamage(dz.d, lerp(def.dmg[0], def.dmg[1], clamp((endT - def.range[0]) / (def.range[1] - def.range[0]), 0, 1)), shooter);
    impactFx(end, dir.clone().negate(), 'metal', false, true);
  } else if (hz) {
    heliDamage(hz.heli, lerp(def.dmg[0], def.dmg[1], clamp((endT - def.range[0]) / (def.range[1] - def.range[0]), 0, 1)), shooter);
    impactFx(end, dir.clone().negate(), 'metal', false);
  } else if (eh) {
    const d = endT;
    const f = clamp((d - def.range[0]) / (def.range[1] - def.range[0]), 0, 1);
    let dmg = lerp(def.dmg[0], def.dmg[1], f);
    if (eh.part === 'head') dmg *= def.head; else if (eh.part === 'legs') dmg *= def.legs;
    dmg *= dmgMul;
    bloodFx(end, dir, eh.part === 'head');
    if (shooter.isPlayer) sfxFlesh(end, eh.part === 'head', true); else if (!eh.ent.isPlayer && Math.random() < 0.6) sfxFlesh(end, eh.part === 'head', false);
    const rf = RAGF[def.fam], near = 1 - clamp((endT - rf.near) / rf.far, 0, 1);
    eh.ent.lastForce = { dir: dir.clone(), mag: lerp(rf.min, rf.mag, near) * (eh.part === 'head' ? 1.15 : 1), lift: lerp(rf.lift * 0.4, rf.lift, near), part: eh.part };
    applyDamage(eh.ent, dmg, shooter, def.name, eh.part === 'head', dir);
  } else if (wp) {
    propShotLocal(wp, end, dir, propDamage(def, endT) * dmgMul, shooter);
  } else if (w) {
    impactFx(end, wn, wm, def.fam === 'sniper');
    if (Math.random() < 0.3 || shooter.isPlayer) sfxImpact(end, wm);
  }
  suppressAlongRay(shooter, origin, dir, endT, eh ? eh.ent : null);
  // bullets that graze the player
  if (!shooter.isPlayer && PL.ent.alive && !allied(shooter, PL.ent) && (!eh || eh.ent !== PL.ent)) {
    const ph = entHead(PL.ent, _v3);
    const t = clamp((ph.x - origin.x) * dir.x + (ph.y - origin.y) * dir.y + (ph.z - origin.z) * dir.z, 0, endT);
    const cp = origin.clone().addScaledVector(dir, t);
    const dd = cp.distanceTo(ph);
    if (dd < 1.4 && t > 3) { if (Math.random() < 0.6) sfxWhiz(cp); PL.suppress = Math.min(1, PL.suppress + 0.25); }
  }
  return eh;
}

const _pd = [0, 0];
/* Direction (shared, valid until the next call) toward the next waypoint. A point is only reached at the right height:
   under a balcony or next to a staircase, 0.9 m in plan doesn't mean we're there; and the turn is only cut (0.9 m) if the next point
   is reachable in a straight line from here, otherwise we must arrive within 0.35 m (top of a ramp, foot of a low wall to climb over) */
function pathDir(b) {
  if (!b.path) return null;
  while (b.pathI < b.path.length) {
    const p = b.path[b.pathI], dx = p.x - b.pos.x, dz = p.z - b.pos.z, d = Math.sqrt(dx * dx + dz * dz);
    const last = b.pathI === b.path.length - 1;
    if (d < (last ? 0.8 : 0.9) && Math.abs(p.y - b.pos.y) < 1.0 && (last || d < 0.35 || navWalkable(b.pos, b.path[b.pathI + 1]))) { b.pathI++; continue; } // a turn, a ramp top or a low wall foot are taken from closer
    const k = 1 / Math.max(d, 0.05); _pd[0] = dx * k; _pd[1] = dz * k; return _pd;
  }
  return null;
}
function moveBody(e, vx, vz, dt) {
  e.vel.x = damp(e.vel.x, vx, 9, dt); e.vel.z = damp(e.vel.z, vz, 9, dt);
  e.pos.x += e.vel.x * dt; e.pos.z += e.vel.z * dt;
  collideCircle(e.pos, 0.34, e.crouch ? 1.2 : 1.75);
  const g = groundHeight(e.pos.x, e.pos.z, e.pos.y, 0.3);
  e.vy -= 19 * dt; e.pos.y += e.vy * dt;
  if (e.pos.y <= g) { e.pos.y = g; e.vy = 0; }
}

/* ---------- Grenades ----------
   Base: public values from the CoD4 frag_grenade_mp weapon file (official mod tools), 3.5 s fuse.
   An M67 weighs 400 g: thrown, it rises and falls in an arc (21 m/s, 3.4 m/s upward, gravity 22 m/s²,
   about twenty meters in an arc); on the ground, it is a cast-iron ovoid that barely bounces. Each impact
   (nadeHit) returns a fraction of the normal speed (0.30 on hard ground, 0.12 on earth, grass and snow) and
   Coulomb friction eats the tangential speed: it bites the ground near its first impact, rolls
   a few meters at most (constant deceleration, 8 m/s² on hard ground, 14 on soft) then stops. */
/* Grenade (owner feedback: too light when thrown, no weight, bounces too soft, deflected by the sidestep). Throw a bit less sharp,
   less brutal gravity (22 m/s² at first, a pebble that flies then falls): a curve you can follow with your eyes, like in Counter-Strike or
   Apex; carry: share of the thrower's forward momentum it keeps (sidestep and backpedal no longer deflect it); livelier bounces
   (nadeHit); predicted trajectory while holding it (nadeArcUpdate, Settings.nadeArc option) */
const NADE = { fuse: 3.5, speed: 19, up: 3.2, g: 15, r: 0.045, carry: 0.35 };
const NADE_GEO = new THREE.SphereGeometry(1, 12, 9), NADE_TOP = new THREE.CylinderGeometry(0.011, 0.013, 0.022, 10), NADE_CYL = new THREE.CylinderGeometry(1, 1, 1, 12);
const nadeFuse = (type) => (NADE_TYPES[type] || NADE_TYPES.frag).fuse;
let NADE_MAT = null, NADE_METAL = null;
/* Grenade materials and a grenade hidden in the scene, set up at startup (after the cascaded shadows): the shader compilation at
   map load sees it; created at the first throw, they made two programs compile mid-match */
function nadeWarm() {
  if (NADE_MAT) return;
  NADE_MAT = csmMaterial(new THREE.MeshStandardMaterial({ color: 0x4d5236, roughness: 0.6 })); NADE_METAL = csmMaterial(new THREE.MeshStandardMaterial({ color: 0x55585a, roughness: 0.4, metalness: 0.8 }));
  const g = new THREE.Group(); g.name = 'grenade (compile)'; g.visible = false;
  for (const [geo, m] of [[NADE_GEO, NADE_MAT], [NADE_TOP, NADE_METAL]]) { const o = new THREE.Mesh(geo, m); o.castShadow = true; g.add(o); }
  scene.add(g); g.add(tknifeTemplate().clone()); // (the throwing knife, compiled with it)
  // player's predicted trajectory (nadeArcUpdate, 08-player.js): round dots of fixed screen size, landing circle; hidden
  const dot = canvasTex(32, (c, s) => { const r = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.55, 'rgba(255,255,255,0.9)'); r.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = r; c.fillRect(0, 0, s, s); });
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NADE_ARC.n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  NADE_ARC.pts = new THREE.Points(pg, new THREE.PointsMaterial({ map: dot, size: 5, sizeAttenuation: false, color: 0xfff2c8, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
  NADE_ARC.ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.68, 40), new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, toneMapped: false }));
  for (const o of [NADE_ARC.pts, NADE_ARC.ring]) { o.frustumCulled = false; o.visible = false; o.renderOrder = 5; scene.add(o); }
}
/* fuse: remaining fuse (s); type: NADE_TYPES (frag by default, grenades received from an older version) */
function spawnNade(owner, p, v, fuse, type = 'frag') {
  if (!NADE_MAT) nadeWarm();
  // M67: ovoid body and fuze plug (the spoon left at the throw); M84: metal cylinder; M18: khaki box, taller
  const mesh = new THREE.Group();
  const body = new THREE.Mesh(type === 'frag' ? NADE_GEO : NADE_CYL, type === 'flash' ? NADE_METAL : NADE_MAT); body.castShadow = true; mesh.add(body);
  if (type === 'frag') body.scale.set(0.032, 0.037, 0.032); else if (type === 'flash') body.scale.set(0.021, 0.085, 0.021); else body.scale.set(0.029, 0.1, 0.029);
  const top = new THREE.Mesh(NADE_TOP, NADE_METAL); top.position.y = type === 'frag' ? 0.043 : type === 'flash' ? 0.05 : 0.058; top.castShadow = true; mesh.add(top);
  mesh.position.copy(p); mesh.rotation.set(rand(0, TAU), rand(0, TAU), 0); mesh.scale.setScalar(1.25); scene.add(mesh); // slightly enlarged to stay readable in flight
  // throw rotation: the grenade tumbles forward around the axis perpendicular to its path
  const ax = new V3(v.z, 0, -v.x); if (ax.lengthSq() < 1e-4) ax.set(1, 0, 0);
  NADES.push({ owner, type, life: owner.spawnAt, p: p.clone(), v: v.clone(), fuse, mesh, axis: ax.normalize(), spinW: -rand(14, 20), age: 0, still: 0, asleep: false }); // life: the thrower's life (streakKill)
}
/* ---------- Throwing knife (NADE_TYPES.knife) ----------
   It flies at THROW_KNIFE.speed m/s under low gravity (g) while spinning. The first soldier hit dies (dmg), scenery stops it
   and it sticks in for life s, a mecha's armor sends it back. Once stuck, its thrower picks it up by walking over it (within pick m) if they are
   missing one. Like a grenade, each device replays those it sees thrown; only the thrower counts hits (the others only see the flight).
   Bots don't carry any. */
const THROW_KNIFE = { speed: 32, g: 2.5, spin: 22, dmg: 200, life: 25, pick: 1.4 };
const TKNIVES = [];
let TKNIFE_TPL = null;
// the knife in flight: the same model as in hand (throwKnifeBuild, 06c-models.js), slightly enlarged to stay readable; built once, copied at each throw
function tknifeTemplate() {
  if (TKNIFE_TPL) return TKNIFE_TPL;
  if (!NADE_MAT) nadeWarm();
  const g = throwKnifeBuild(new THREE.Group(), csmMaterial(new THREE.MeshStandardMaterial({ color: 0xa3a7ab, roughness: 0.32, metalness: 0.9 })), csmMaterial(new THREE.MeshStandardMaterial({ color: 0x1c1d1f, roughness: 0.85 })));
  g.scale.setScalar(1.3);
  return (TKNIFE_TPL = g);
}
function spawnThrowKnife(owner, p, v) {
  const mesh = tknifeTemplate().clone(); mesh.position.copy(p); scene.add(mesh);
  const ax = new V3(v.z, 0, -v.x); if (ax.lengthSq() < 1e-4) ax.set(1, 0, 0);
  TKNIVES.push({ owner, life: owner.spawnAt, p: p.clone(), v: v.clone(), mesh, axis: ax.normalize(), ang: 0, stuck: false, t: 0 });
}
function tknifeDrop(i) { scene.remove(TKNIVES[i].mesh); TKNIVES.splice(i, 1); }
function clearThrowKnives() { for (const k of TKNIVES) scene.remove(k.mesh); TKNIVES.length = 0; }
const _tkD = new V3(), _tkY = new V3(0, 1, 0), _tkN = new V3();
function updateThrowKnives(dt) {
  const K = THROW_KNIFE;
  for (let i = TKNIVES.length - 1; i >= 0; i--) {
    const k = TKNIVES[i]; k.t += dt;
    if (k.stuck) {
      const e = PL.ent; // stuck: its thrower picks it up by walking over it, if they are missing one
      if (k.owner === e && e.alive && PL.nadeType === 'knife' && PL.nades < NADE_COUNT && hyp(e.pos.x - k.p.x, e.pos.z - k.p.z) < K.pick && Math.abs(e.pos.y + 0.8 - k.p.y) < 1.8) {
        PL.nades++; sfxMech('pickup'); hudMsg(_t('Throwing knife picked up'), 'ally', 1); tknifeDrop(i); continue;
      }
      if (k.t > K.life) tknifeDrop(i);
      continue;
    }
    k.v.y -= K.g * dt;
    const len = k.v.length() * dt; _tkD.copy(k.v).normalize();
    const w = rayWorld(k.p.x, k.p.y, k.p.z, _tkD.x, _tkD.y, _tkD.z, len, 1), wt = w ? w.t : len;
    const eh = rayEntities(k.p, _tkD, wt, k.owner);
    if (eh) { // a soldier: it dies (only the thrower counts the hit), the knife drops with them
      const end = k.p.clone().addScaledVector(_tkD, eh.t), head = eh.part === 'head';
      bloodFx(end, _tkD.clone(), head); sfxMelee();
      if (!k.owner.isRemote) {
        eh.ent.lastForce = { dir: _tkD.clone(), mag: 5, lift: 1.5, part: eh.part };
        applyDamage(eh.ent, K.dmg, k.owner, NET_WSPECIAL.tknife, head, _tkD.clone(), undefined, k.life); // (the thrower's hit marker: applyDamage; it used to come twice, and a kill counted double in the chain)
      }
      tknifeDrop(i); continue;
    }
    if (MECHAS.length && rayMechas(k.owner, k.p, _tkD, wt)) { impactFx(k.p.clone().addScaledVector(_tkD, wt * 0.5), _tkN.copy(_tkD).negate(), 'metal', false, true); sfxBounce(k.p, 0.8, false); tknifeDrop(i); continue; } // the armor sends it back
    if (w) { // scenery: it sticks in, point first (an object that can be bumped receives it and lets it drop)
      const end = k.p.clone().addScaledVector(_tkD, Math.max(0, w.t - 0.02));
      if (w.prop) { propShot(w.prop, end, _tkD.clone(), 20); sfxBounce(end, 0.7, false); tknifeDrop(i); continue; }
      impactFx(end, _tkN.set(w.nx, w.ny, w.nz), w.m, false, true); sfxBounce(end, 0.7, nadeSoftAt(end));
      k.p.copy(end).addScaledVector(_tkD, 0.04); k.stuck = true; k.t = 0;
      k.mesh.position.copy(k.p); k.mesh.quaternion.setFromUnitVectors(_tkY, _tkD);
      continue;
    }
    k.p.addScaledVector(_tkD, len);
    const ws = waterSurfaceAt(k.p.x, k.p.z);
    if ((ws !== null && k.p.y < ws) || (VOID.on && k.p.y < VOID.kill) || k.t > 6) { if (ws !== null && k.p.y < ws) waterBlastFx(k.p, 0.15); tknifeDrop(i); continue; }
    k.ang += K.spin * dt; // in flight: it spins point over handle
    k.mesh.position.copy(k.p); k.mesh.quaternion.setFromUnitVectors(_tkY, _tkD); k.mesh.rotateOnWorldAxis(k.axis, -k.ang);
  }
}
/* A bot's grenade type, drawn each life: frag one time in two, flash and smoke one time in four */
function botNadeType() { const r = Math.random(); return r < 0.5 ? 'frag' : r < 0.75 ? 'flash' : 'smoke'; }
/* A bot throws its grenade toward target (the fuse starts at the throw); a flash opens the assault: it rushes in behind it */
function botThrowNade(b, target) {
  const eye = entEye(b, new V3());
  const dx = target.x - eye.x, dz = target.z - eye.z, d = hyp(dx, dz);
  const vt = clamp(d * 0.9, 8, 19), tt = d / vt;
  const vy = ((target.y - eye.y) + 0.5 * NADE.g * tt * tt) / tt;
  const v = new V3((dx / d) * vt, clamp(vy, 2, 13), (dz / d) * vt);
  const type = NADE_TYPES[b.nadeType] ? b.nadeType : 'frag', fu = Math.max(0.6, nadeFuse(type) - 0.3);
  spawnNade(b, eye, v, fu, type);
  if (MATCH.online && b.netBot) netEvent({ k: 'nade', px: +eye.x.toFixed(2), py: +eye.y.toFixed(2), pz: +eye.z.toFixed(2), vx: +v.x.toFixed(2), vy: +v.y.toFixed(2), vz: +v.z.toFixed(2), fu, ty: type }, b);
  if (type === 'flash' && b.target && b.target.alive) { b.tactic = 'push'; setPath(b, target); b.rush = true; b.decideT = 2.4; } // it enters right after
  b.nades--; b.throwT = 0.7; sfxMech('throw', 0, eye); // spatialized throw, in the bot's place
  if (!allied(b, PL.ent) && eye.distanceTo(camera.position) < 30) hudMsg(_t('Grenade!'), 'enemy', 1.2);
}
/* Grenade impact on a surface with normal (nx, ny, nz): damped bounce, Coulomb friction on the tangential
   component. Returns the normal speed on arrival (0 if it was already moving away). */
function nadeHit(n, nx, ny, nz, soft, wall) {
  const v = n.v, vn = -(v.x * nx + v.y * ny + v.z * nz);
  if (vn <= 0) return 0;
  // restitution and friction (0.28 on a wall, 0.3 on hard ground, 0.12 on soft ground at first: it stuck in); the ovoid bites a little at each impact
  const e = wall ? 0.42 : soft ? 0.2 : 0.38, mu = soft ? 0.6 : 0.35;
  const tx = v.x + vn * nx, ty = v.y + vn * ny, tz = v.z + vn * nz, tl = hyp3(tx, ty, tz);
  const k = tl > 1e-6 ? Math.max(0, tl - mu * (1 + e) * vn) / tl * (wall ? 0.85 : soft ? 0.65 : 0.8) : 0;
  v.set(tx * k + nx * vn * e, ty * k + ny * vn * e, tz * k + nz * vn * e);
  n.spinW = n.spinW * 0.55 + rand(-3, 3);
  if (vn > 2.2) sfxBounce(n.p, clamp(vn / 12, 0.3, 1.2), soft);
  return vn;
}
function updateNades(dt) {
  for (let i = NADES.length - 1; i >= 0; i--) {
    const n = NADES[i];
    n.age += dt; n.fuse -= dt;
    let rolling = n.asleep;
    if (!n.asleep) {
      const sp = n.v.length(), steps = clamp(Math.ceil(sp * dt / 0.07), 1, 10), h = dt / steps, R = NADE.r;
      for (let s = 0; s < steps; s++) {
        const px = n.p.x, py = n.p.y, pz = n.p.z;
        n.v.y -= NADE.g * h; n.p.addScaledVector(n.v, h);
        // sol
        const g = groundHeight(n.p.x, n.p.z, py, 0.05, true);
        if (n.p.y < g + R) {
          n.p.y = g + R;
          const soft = nadeSoftAt(n.p);
          nadeHit(n, 0, 1, 0, soft, false);
          if (n.v.y < 0.9) {
            // on the ground: constant deceleration, then stop (it doesn't roll forever)
            n.v.y = 0; rolling = true;
            const hs = hyp(n.v.x, n.v.z), nh = Math.max(0, hs - (soft ? 10 : 6) * h); // (14 and 8 at first: it stopped dead)
            if (hs > 1e-4) { n.v.x *= nh / hs; n.v.z *= nh / hs; }
            if (nh < 0.12) { n.v.x = n.v.z = 0; n.still += h; } else n.still = 0;
          }
        }
        // in water: splash on entry, then it sinks slowly, barely drifting
        const ws = waterSurfaceAt(n.p.x, n.p.z);
        if (ws !== null && n.p.y < ws) {
          if (!n.wet) { n.wet = true; waterBlastFx(n.p, 0.35); sfxPlunge(n.p, 0.4); n.v.multiplyScalar(0.3); }
          const k = Math.exp(-4 * h); n.v.x *= k; n.v.z *= k; n.v.y = Math.max(n.v.y * k, -1.4); n.spinW *= k;
        }
        // scenery: sphere against boxes (invisible walls, shots-only boxes and glass railings let it through)
        for (const c of queryBoxes(n.p.x - 0.3, n.p.z - 0.3, n.p.x + 0.3, n.p.z + 0.3)) {
          if (c.inv || c.ray || (c.noRay && c.m === 'glass')) continue;
          if (n.p.x < c.x0 - R || n.p.x > c.x1 + R || n.p.z < c.z0 - R || n.p.z > c.z1 + R || n.p.y < c.y0 - R || n.p.y > c.y1 + R) continue;
          const soft = false;
          if (py >= c.y1 + R - 0.02) { n.p.y = c.y1 + R; nadeHit(n, 0, 1, 0, soft, false); if (n.v.y < 0.9) { n.v.y = 0; rolling = true; const hs = hyp(n.v.x, n.v.z), nh = Math.max(0, hs - 6 * h); if (hs > 1e-4) { n.v.x *= nh / hs; n.v.z *= nh / hs; } if (nh < 0.12) { n.v.x = n.v.z = 0; n.still += h; } else n.still = 0; } }
          else if (py <= c.y0 - R + 0.02) { n.p.y = c.y0 - R; nadeHit(n, 0, -1, 0, soft, true); }
          else if (px < c.x0 - R || px > c.x1 + R) { const sx = px < c.x0 ? -1 : 1; n.p.x = px; nadeHit(n, sx, 0, 0, soft, true); }
          else if (pz < c.z0 - R || pz > c.z1 + R) { const sz = pz < c.z0 ? -1 : 1; n.p.z = pz; nadeHit(n, 0, 0, sz, soft, true); }
          else { // born inside the box: exit through the nearest face
            const dl = n.p.x - c.x0, dr = c.x1 - n.p.x, dn = n.p.z - c.z0, df = c.z1 - n.p.z, m = Math.min(dl, dr, dn, df);
            if (m === dl) n.p.x = c.x0 - R; else if (m === dr) n.p.x = c.x1 + R; else if (m === dn) n.p.z = c.z0 - R; else n.p.z = c.z1 + R;
            n.v.x *= -0.3; n.v.z *= -0.3;
          }
        }
        // soldiers: it bounces off a body (not off its thrower as it leaves the hand)
        for (const e of entities) {
          if (!e.alive || e.off || (e === n.owner && n.age < 0.35)) continue;
          const dx = n.p.x - e.pos.x, dz = n.p.z - e.pos.z, d2 = dx * dx + dz * dz;
          if (d2 > 0.16 || n.p.y < e.pos.y || n.p.y > e.pos.y + (e.crouch ? 1.15 : 1.75)) continue;
          const d = Math.sqrt(d2) || 0.01, nx = dx / d, nz = dz / d;
          n.p.x = e.pos.x + nx * 0.4; n.p.z = e.pos.z + nz * 0.4;
          n.v.x += (e.vel ? e.vel.x : 0) * 0.3; n.v.z += (e.vel ? e.vel.z : 0) * 0.3;
          nadeHit(n, nx, 0, nz, true, true);
        }
      }
      // motionless for over half a second: it sleeps until the fuse
      if (n.still > 0.5 && !n.wet) { n.asleep = true; n.v.set(0, 0, 0); n.spinW = 0; }
    }
    // fell into the void (floating islands): removed without exploding below
    if (VOID.on && n.p.y < VOID.kill) { scene.remove(n.mesh); NADES.splice(i, 1); continue; }
    n.mesh.position.copy(n.p);
    // rotation: tumbles in flight, rolls without slipping on the ground
    const hv = hyp(n.v.x, n.v.z);
    if (rolling && !n.asleep) { if (hv > 0.05) { n.axis.set(n.v.z, 0, -n.v.x).normalize(); n.spinW = -hv / 0.034; } else n.spinW = 0; }
    if (!n.asleep) n.mesh.rotateOnWorldAxis(n.axis, -n.spinW * dt);
    if (n.fuse <= 0) { nadeBurst(n.type, n.p, n.owner, n.life); scene.remove(n.mesh); NADES.splice(i, 1); }
  }
}
/* ---------- Grenade effect, by type ----------
   frag: the explosion; flash: blinds and deafens (flashBang); smoke: a cloud (smokeStart). Each device detonates the grenades
   it sees (its own, those received online): each suffers the flash for its player, the host for its bots. */
function nadeBurst(type, p, owner, life) {
  if (type === 'flash') flashBang(p, owner);
  else if (type === 'smoke') smokeStart(p, owner);
  else explode(p, owner, _t('Grenade'), 7.5, 150, life);
}
/* Stun grenade: flash, detonation; blinds (white screen, PL.flashT) and deafens the player, its bots too (b.blindT). Not all or nothing
   (owner feedback): strength depends on distance (full within FLASH.near m, zero at FLASH.r m) and, for sight, on gaze (facing away, FLASH.back
   of the effect); close and facing it, white screen and FLASH.max s; farther, a lighter and shorter veil. Hearing depends only on distance
   (FLASH.ear m, half as much behind a wall). No damage, no blinding behind a wall or inside a smoke cloud */
const FLASH = { r: 18, near: 3.5, max: 3, back: 0.2, ear: 13, min: 0.05, peak: 0.92, deaf: 2.4 }; // (owner feedback, too strong and too long: r 20, near 4, max 4.2 s, full white, ear 16, deafened 3.6 s at first)
function flashSeen(p, eye, fx, fy, fz) {
  const dx = p.x - eye.x, dy = p.y - eye.y, dz = p.z - eye.z, d = hyp3(dx, dy, dz);
  if (d > FLASH.r || !lineClear(eye, p) || smokeBlocks(eye, p)) return 0;
  const face = (dx * fx + dy * fy + dz * fz) / (d || 1), look = lerp(FLASH.back, 1, smoothstep(-0.2, 0.75, face));
  return (1 - smoothstep(FLASH.near, FLASH.r, d)) * look;
}
function flashBang(p, owner) {
  pfrEvent(1);
  const q = p.clone(); q.y += 0.15;
  FX.flash.spawn(q.x, q.y, q.z, 0, 0, 0, 0.12, 2.2, 3.2, 3, 3, 3, 1, 0); flashLight(q, 60, 26, 0.25, 0xffffff);
  for (let i = 0; i < 6; i++) FX.smoke.spawn(q.x, q.y, q.z, rand(-1, 1), rand(0.3, 1), rand(-1, 1), rand(1.2, 2), 0.4, 1.4, 0.8, 0.8, 0.8, 0.35, 0, 0, 1.5);
  // the player (alive, on foot: the mecha cockpit protects them)
  const e = PL.ent, safe = !e.alive || e.inMecha || PILOT.d; let k = 0, ear = 0;
  if (!safe) {
    const f = camFwd(_flF), c = camera.position; k = flashSeen(q, c, f.x, f.y, f.z);
    ear = (1 - smoothstep(2, FLASH.ear, q.distanceTo(c))) * (lineClear(c, q) ? 1 : 0.5);
  }
  if (k > FLASH.min) {
    const dur = FLASH.max * k, I = clamp(0.15 + 0.85 * k, 0, FLASH.peak); // a veil all the whiter and longer the closer and more facing one is
    if (I * dur > (PL.flashI || 0) * (PL.flashT || 0)) { PL.flashT = dur; PL.flashD = dur; PL.flashI = I; }
  }
  sfxFlashBang(q, ear > FLASH.min ? ear * 0.85 : 0, 0.5 + FLASH.deaf * ear);
  if (owner) { soundEvents.push({ pos: q.clone(), team: owner.team, who: owner, t: MATCH.time, loud: true }); while (soundEvents.length > 60) soundEvents.shift(); }
  // this match's bots (online: on the host); a light blinding doesn't stop them. The player's flash that blinds an opponent
  // gives them the hit marker, like a bullet (owner feedback: equipment must produce hitmarkers); a distant
  // opponent is blinded on their own side, their share is estimated here from their published position and gaze
  let hit = 0;
  for (const b of entities) {
    if (b.isPlayer || !b.alive || b.off) continue;
    const kb = flashSeen(q, entEye(b, _flE), -Math.sin(b.lookYaw) * Math.cos(b.pitch || 0), Math.sin(b.pitch || 0), -Math.cos(b.lookYaw) * Math.cos(b.pitch || 0));
    if (kb <= 0.12) continue;
    if (owner === PL.ent && !allied(b, owner)) hit++;
    if (!b.isRemote) { b.blindT = Math.max(b.blindT || 0, MATCH.time + FLASH.max * kb); b.visible = false; b.forceDecide = true; }
  }
  if (hit && MATCH.state === 'playing') hitFeedback(false, false);
}
const _flF = new V3(), _flE = new V3();
/* Blinded player's white screen (game loop): at its strength (PL.flashI) for the first half, then it fades */
function flashTick(dt) {
  if (!(PL.flashT > 0)) return;
  PL.flashT -= dt; const fade = clamp(PL.flashD * 0.5, 0.4, 1.2), w = clamp(PL.flashT / fade, 0, 1);
  FinalShader.uniforms.uFlash.value = Math.max(FinalShader.uniforms.uFlash.value, PL.flashI * Math.pow(w, 0.7) * 1.08);
  if (!PL.ent.alive) PL.flashT = 0;
}
/* Smoke grenade: a cloud of SMOKE.r m radius that opens in SMOKE.grow s and lasts SMOKE.life s (for the last SMOKE.fade, it thins out). Made of
   puffs from the smoke pool (FX.smoke), relaunched continuously; it blocks sight (smokeBlocks: bots, aim assist, mecha,
   helicopter) */
const SMOKE = { r: 3.6, grow: 1.8, life: 15, fade: 3, every: 0.11 };
const SMOKES = [], _smA = new V3(), _smB = new V3();
function smokeStart(p, owner) {
  const g = groundHeight(p.x, p.z, p.y + 0.3), c = new V3(p.x, Math.max(g, p.y - 0.3), p.z);
  SMOKES.push({ p: c, t: 0, emitT: 0 }); sfxSmokePop(c);
  for (let i = 0; i < 14; i++) { const a = rand(0, TAU), s = rand(2, 4); FX.smoke.spawn(c.x, c.y + 0.4, c.z, Math.cos(a) * s, rand(0.4, 1.4), Math.sin(a) * s, rand(3, 4), 1.2, 3.2, 0.82, 0.82, 0.8, 0.9, 0, 0, 1.4, rand(-0.4, 0.4)); }
}
/* Cloud radius at the moment (0 before it opens, decreasing at the end) */
function smokeR(s) { return SMOKE.r * smoothstep(0, SMOKE.grow, s.t) * (1 - smoothstep(SMOKE.life - SMOKE.fade, SMOKE.life, s.t) * 0.6); }
function updateSmokes(dt) {
  for (let i = SMOKES.length - 1; i >= 0; i--) {
    const s = SMOKES[i]; s.t += dt;
    if (s.t > SMOKE.life) { SMOKES.splice(i, 1); continue; }
    if ((s.emitT -= dt) > 0 || s.t > SMOKE.life - 2) continue;
    s.emitT = SMOKE.every; const R = Math.max(1, smokeR(s)), a = rand(0, TAU), r = Math.sqrt(Math.random()) * R * 0.85;
    const x = s.p.x + Math.cos(a) * r, z = s.p.z + Math.sin(a) * r, y = s.p.y + rand(0.3, R * 0.85), c = rand(0.74, 0.86);
    if (!lineClear(_smA.set(s.p.x, s.p.y + 0.6, s.p.z), _smB.set(x + Math.cos(a) * 1.3, y, z + Math.sin(a) * 1.3))) continue; // no puff against a wall or behind it (it would be cut off sharply)
    FX.smoke.spawn(x, y, z, rand(-0.25, 0.25), rand(0.05, 0.25), rand(-0.25, 0.25), rand(3.5, 5), rand(2.4, 3.2), rand(3.2, 4.2), c, c, c * 0.98, 0.85, 0, 0, 0.6, rand(-0.2, 0.2));
  }
}
/* Player's view inside a cloud: gray veil (#smokeFx) all the thicker the closer to the core (very close puffs leave the field of view) */
function smokeView() {
  let k = 0; const c = camera.position;
  for (const s of SMOKES) { const R = smokeR(s); if (R < 0.5) continue; const d = hyp3(c.x - s.p.x, (c.y - s.p.y - 1.4) * 0.8, c.z - s.p.z); k = Math.max(k, 1 - smoothstep(R * 0.45, R * 1.05, d)); }
  if (k !== (SMOKES.vk || 0)) { SMOKES.vk = k; $('smokeFx').style.opacity = k.toFixed(2); }
}
/* True if a cloud cuts segment a-b (the cloud's ball, centered 1.4 m above ground) */
function smokeBlocks(a, b) {
  for (const s of SMOKES) {
    const R = smokeR(s) * 0.9; if (R < 0.8) continue;
    const cx = s.p.x, cy = s.p.y + 1.4, cz = s.p.z, dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L2 = dx * dx + dy * dy + dz * dz;
    const u = L2 > 1e-6 ? clamp(((cx - a.x) * dx + (cy - a.y) * dy + (cz - a.z) * dz) / L2, 0, 1) : 0;
    const ex = a.x + dx * u - cx, ey = a.y + dy * u - cy, ez = a.z + dz * u - cz;
    if (ex * ex + ey * ey * 0.6 + ez * ez < R * R) return true;
  }
  return false;
}
/* Soft ground (earth, grass, gravel, snow, sand): the grenade sticks in instead of bouncing */
function nadeSoftAt(p) { const m = surfaceAt(p); return m === 'dirt' || m === 'snow' || m === 'grass' || m === 'gravel' || m === 'sand' || m === 'ground'; }
/* roofK (airstrike): share of the damage of an open-air explosion received under a roof (AIR, 08b-killstreaks.js) */
function explode(p, owner, weaponName, radius, maxDmg, life, roofK) {
  pfrEvent(0); // performance recorder (09zo-perfs.js)
  const ws = waterSurfaceAt(p.x, p.z), wet = ws !== null && p.y < ws + 0.3; // underwater: splash and dull thud (explosionFx)
  explosionFx(p); if (wet) sfxPlunge(p, 1); else sfxExplosion(p); kcEvent('boom', { p: p.clone() });
  propBlast(p, radius, maxDmg); // each peer replays the explosion: the blast on props is computed on all of them
  hangBlast(p, radius);
  canvasesBlast(p, radius); // stretched canvases billow (02me-canvases.js); each peer replays the blast, as with props
  const dc = p.distanceTo(camera.position);
  PL.shake = Math.max(PL.shake, clamp(1 - dc / 34, 0, 1) * 1.5); // the shake decreases with distance
  if (dc < 14) FinalShader.uniforms.uFlash.value = Math.max(FinalShader.uniforms.uFlash.value, (1 - dc / 14) * 0.45);
  if (owner && owner.isRemote) return; // remote player's grenade: its thrower computes the damage
  if (MECHAS.length && owner) mechaBlast(p, owner, radius, maxDmg); // an enemy mecha's armor (08f-mecha.js)
  const c = new V3(p.x, p.y + 0.35, p.z), open = roofK !== undefined && !roofAbove(p.x, p.y + 0.5, p.z, 30);
  for (const e of entities) {
    if (!e.alive) continue;
    if (allied(e, owner) && e !== owner) continue;
    const ch = entChest(e, new V3()), d = ch.distanceTo(c);
    if (d > radius) continue;
    const hd = entHead(e, new V3());
    if (!lineClear(c, ch) && !lineClear(c, hd)) continue;
    let dmg = maxDmg * Math.pow(1 - d / radius, 1.1) + 12;
    if (open && roofAbove(hd.x, hd.y + 0.1, hd.z, 30)) dmg *= roofK; // sheltered by a roof, from a bomb that fell outside
    const rd = ch.clone().sub(c); rd.y = Math.max(rd.y, 0) + 0.8; rd.normalize();
    e.lastForce = { dir: rd, mag: 7 + 10 * (1 - d / radius), lift: 7 + 9 * (1 - d / radius), part: 'body', radial: true };
    applyDamage(e, dmg, owner, weaponName, false, ch.clone().sub(c).normalize(), undefined, life);
  }
  soundEvents.push({ pos: p.clone(), team: owner.team, who: owner, t: MATCH.time, loud: true }); while (soundEvents.length > 60) soundEvents.shift();
}
