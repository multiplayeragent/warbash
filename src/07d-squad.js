/* ==========================================================================
   TEAM PLAN IN DOMINATION
   Bots no longer pick a point at random: every 1.5 s (and as soon as a point changes hands), each team redoes its
   plan. Each point has a need (how many soldiers, and the urgency):
     - enemy-held: 3 soldiers (attack); neutral: 2 (attack);
     - ours and contested: 2 (defense); ours and quiet: 1 sentinel; an opponent spotted near one of our points (a teammate's radio
       call, SQ.intel) adds one;
     - behind on score, attack is weighted; ahead, defense; the player, on a point, counts as a soldier of the team.
   Assignment is greedy on the best soldier/point pair (urgency minus distance), with inertia: a bot that already holds
   its point, or is capturing it or fighting there, doesn't leave it for a marginal gain. Once a point is taken, its
   attackers don't linger: the need drops to a sentinel and the others are reassigned (rotation) to the next point.
   Surplus soldiers reinforce the most urgent point. A bot with a plan is not remote-controlled: it fights normally as soon as it
   sees an opponent, and returns to its point afterward (decideTactic limits the hunt far from it).
   ========================================================================== */
const SQ = { at: [-99, -99], intel: [null, null], rev: 0 };
function squadDirty() { SQ.at[0] = SQ.at[1] = -99; }
/* Match start: the last sighting from the previous match no longer counts (its time, MATCH.time, would pass for recent: the clock restarts from zero) */
function squadReset() { SQ.intel[0] = SQ.intel[1] = null; squadDirty(); }
/* A bot that spots an opponent reports it to its team: position and moment (no tracking: the plan uses it to reinforce) */
function squadIntel(b, foe, now) { SQ.intel[b.team] = { x: foe.pos.x, z: foe.pos.z, t: now }; }
function squadMaybe(t, now) { if (now < SQ.at[t] - 0.01 || now - SQ.at[t] >= 1.5) squadPlan(t, now); }

function squadPlan(t, now) {
  SQ.at[t] = now;
  const pts = DOM.pts; if (!pts.length) return;
  const bots = entities.filter((e) => e.alive && !e.off && !e.isPlayer && !e.isRemote && e.team === t);
  if (!bots.length) return;
  const foe = 1 - t, lead = MATCH.score[t] - MATCH.score[foe], I = SQ.intel[t] && now - SQ.intel[t].t < 8 ? SQ.intel[t] : null;
  const me = PL.ent.team === t && PL.ent.alive ? PL.ent : null;
  const need = pts.map((p, i) => {
    const hot = p.contest || p.n[foe] > 0;
    let n, pr, role = 'attack';
    if (p.owner === t) { role = 'defend'; n = hot ? 2 : 1; pr = hot ? 3 : 0.8 + (lead > 0 ? 0.3 : 0); if (I && hyp(I.x - p.x, I.z - p.z) < 20) { n++; pr += 1; } }
    else { n = p.owner === -1 ? 2 : 3; pr = (p.owner === -1 ? 2.2 : 2.5) + (lead < 0 ? 0.4 : 0); }
    if (me && hyp(me.pos.x - p.x, me.pos.z - p.z) < DOM.rad + 8 && Math.abs(me.pos.y - p.y) < DOM.dy + 2) n = Math.max(0, n - 1);
    return { i, n, pr, role, got: 0 };
  });
  const score = (b, nd) => {
    const p = pts[nd.i], d = hyp(p.x - b.pos.x, p.z - b.pos.z);
    let sc = nd.pr - d / 30;
    if (b.sq && b.sq.p === nd.i) sc += 0.8;                                        // inertia
    if (b.sq && b.sq.p === nd.i && d < DOM.rad && p.owner !== t) sc += 1.5;         // mid-capture: it finishes
    if (b.sq && b.sq.p === nd.i && b.visible) sc += 2;                               // in the middle of a fight in front of the point
    return sc;
  };
  const free = bots.slice(), pick = new Map();
  while (free.length) {
    let bb = null, bn = null, bs = -1e9;
    for (const b of free) for (const nd of need) if (nd.n > 0) { const sc = score(b, nd); if (sc > bs) { bs = sc; bb = b; bn = nd; } }
    if (!bb) { // all needs are covered: the others reinforce the most urgent point, without crowding it
      for (const b of free) {
        let best = null, bw = -1e9;
        for (const nd of need) { const sc = score(b, nd) - nd.got * 0.7; if (sc > bw) { bw = sc; best = nd; } }
        pick.set(b, best); best.got++;
      }
      break;
    }
    pick.set(bb, bn); bn.n--; bn.got++; free.splice(free.indexOf(bb), 1);
  }
  for (const [b, nd] of pick) if (!b.sq || b.sq.p !== nd.i || b.sq.role !== nd.role) b.sq = { p: nd.i, role: nd.role, rev: ++SQ.rev };
}

/* Where to go: the attacker enters the zone and stays a few seconds (it changes spot each time, to cover the angles);
   the defender takes a cover that holds the zone, facing the enemy's arrival, and stays longer */
function squadGoal(b, now) {
  if (!b.sq) squadPlan(b.team, now);
  const a = b.sq; if (!a) return null;
  const p = DOM.pts[a.p]; if (!p) return null;
  if (a.role === 'attack') { const g = domSpot(p, 0.5, 3.2); g.holdFor = rand(3, 6); return g; }
  const own = b.team === 0 ? 1 : -1, I = SQ.intel[b.team] && now - SQ.intel[b.team].t < 8 ? SQ.intel[b.team] : null;
  const list = coverNear(p.x, p.z, DOM.rad + 5, []).filter((c) => (!c.owner || !c.owner.alive || c.owner === b) && Math.abs(c.y - p.y) < 1.5
    && hyp(c.x - p.x, c.z - p.z) < DOM.rad + 4 && !entities.some((o) => o !== b && o.alive && allied(o, b) && hyp(o.pos.x - c.x, o.pos.z - c.z) < 2.5));
  const g = list.length && Math.random() < 0.75 ? (() => { const c = pick(list); const v = new V3(c.x, c.y, c.z); v.hold = true; v.dom = p.i; return v; })() : domSpot(p, 0.5, DOM.rad - 1.5);
  g.holdFor = rand(6, 10);
  g.look = I ? { x: I.x, z: I.z } : { x: p.x + rand(-8, 8), z: p.z - own * 20 };
  return g;
}
