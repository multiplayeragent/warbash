/* Online hits at the shooter and at the victim (src/09c-net.js): node tools/dev/visual/prediction.js; PAGE=other.html.
   Simulated online match in a single page (guest role, nothing is sent). Predicted death (netPredHealth, netPredictKill, acknowledgment ak):
   - four 26-damage bullets in a burst (104, above the margin of 2), with no victim state between them: the fourth brings the target down right away (before: the published
     health stayed at 100, nothing was predicted and the elimination waited for the round trip);
   - a victim state that acknowledges the first two bullets (health 50): two bullets remain in flight (52), the predicted health is -2;
   - a victim from a version without acknowledgment: published health alone, the fourth bullet predicts nothing (old behavior);
   - a hit never acknowledged is forgotten after 2 s;
   - hits received from a player and from a host bot: my published state carries their numbers (ak).
   Crossed deaths (netTradeHold, netHeldCheck):
   - I fired first, his lethal bullet leaves after mine which he had not received: it waits, my acknowledgment does not count it; he announces
     his death through my hit: his bullet does not count, I am alive;
   - he fired first: his bullet applies right away, I die;
   - he had already applied my hit (non-lethal) and is still alive: his bullet applies right away;
   - no news from him within 0.8 s: his bullet applies;
   - a bullet with no timestamp (previous version): applied right away, as before.
   Exits with an error code on the first failure. */
const { openGame } = require('./common');
const fails = [];
const ok = (c, msg, extra) => { console.log((c ? 'ok    ' : 'FAIL  ') + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails.push(msg); };
(async () => {
  const { browser, page, logs } = await openGame({ page: process.env.PAGE, w: 640, h: 360, noHdri: true, settings: { quality: 'low', map: 'chergui' } });
  try {
    const r = await page.evaluate(() => {
      LOCK.fallback = true; startMatch({}); NET.on = true; NET.role = 'client'; NET.me = 'myId'; NET.joined = true; NET.t0 = performance.now();
      NET.hostConn = { open: true, send() {} }; MATCH.online = true; MATCH.state = 'playing'; PL.ent.protT = 1e9;
      const live = () => { NET.hostSeen = performance.now(); };
      const P = (team, health, ak, alive = 1) => ({ n: 'Target', t: team, w: 'm4', g: 'm4', s: [3, 0.2, 3, 0, 0, 0, 0, 0, 0, alive, 0, health], f: 0, k: 0, d: 0, a: 0, sc: 0, sk: 'assault', ev: [], ...(ak !== undefined ? { ak: { myId: ak } } : {}) });
      const foe = 1 - PL.ent.team, out = {};
      const shoot = (e, n, d = 26) => { const r = []; for (let i = 0; i < n; i++) { live(); applyDamage(e, d, PL.ent, curW().def.name, false, new V3(0, 0, -1)); r.push(!!e.pred); } return r; };
      const mine = (e) => NET.sent.filter((m) => m.f === PL.ent && m.v === e);
      // victim running an up-to-date version (ack 0 at start)
      live(); netApply('gA', P(foe, 100, 0)); const a = NET.remotes.get('gA');
      out.burstFire = shoot(a, 4);
      out.pendingA = mine(a).map((x) => x.i);
      // state that acks the first two bullets: health 50, two bullets in flight
      a.pred = false; a.alive = true;
      live(); netApply('gA', P(foe, 50, out.pendingA[1])); out.predAfter = netPredHealth(a);
      // victim running a version without ack
      live(); netApply('gB', P(foe, 100)); const b = NET.remotes.get('gB');
      out.previous = shoot(b, 4); out.oldPred = netPredHealth(b);
      // forgotten after 2 s
      live(); netApply('gC', P(foe, 100, 0)); const c = NET.remotes.get('gC');
      shoot(c, 1); MATCH.time += 2.5; out.forgot = netPredHealth(c);
      // ack published: one hit received from gD (player) and one from a host bot
      live(); netApply('gD', { ...P(foe, 100), ev: [{ k: 'hit', i: 7, to: 'myId', d: 1, h: 0, w: 'm4', x: 0, z: 0 }] });
      live(); netApply('host~b3', { ...P(foe, 100), b: 1, ev: [{ k: 'hit', i: 4, to: 'myId', d: 1, h: 0, w: 'm4', x: 0, z: 0 }] });
      out.ak = netPresence(PL.ent, performance.now()).ak;

      // crossed deaths: I am vulnerable, each case restarts alive at 100
      const reset = () => { PL.ent.protT = 0; PL.ent.alive = true; PL.ent.health = 100; NET.held.length = 0; };
      const hit = (i, s, d = 150) => ({ k: 'hit', i, to: 'myId', d, h: 0, w: 'm4', x: 0, z: 0, s });
      // 1. I shot first
      reset(); live(); netApply('gT', P(foe, 100, 0)); const t = NET.remotes.get('gT');
      MATCH.timeLeft = 300; shoot(t, 1, 150); const sA = mine(t)[0];
      MATCH.timeLeft = 299.95; // his bullet leaves 50 ms after mine, before he has received it (ack 0)
      live(); netApply('gT', { ...P(foe, 100, 0), ev: [hit(1, netStamp())] });
      out.t1Hold = { isAlive: PL.ent.alive, waiting: NET.held.length, ak: netPresence(PL.ent, performance.now()).ak.gT };
      live(); netApply('gT', { ...P(foe, 0, sA.i, 0), ev: [hit(1, netStamp()), { k: 'kill', i: 2, by: 'myId', h: 0, w: 'm4', x: 0, z: 1, q: sA.i }] });
      netHeldCheck(); out.t1 = { isAlive: PL.ent.alive, vie: PL.ent.health, waiting: NET.held.length };
      // 2. he shot first
      reset(); live(); netApply('gU', P(foe, 100, 0)); const u = NET.remotes.get('gU');
      MATCH.timeLeft = 290; const sU = netStamp(); MATCH.timeLeft = 289.95; shoot(u, 1, 150);
      live(); netApply('gU', { ...P(foe, 100, 0), ev: [hit(1, sU)] });
      out.t2 = { isAlive: PL.ent.alive, waiting: NET.held.length };
      // 3. he had already applied my hit (non-lethal) and is still alive
      reset(); live(); netApply('gV', P(foe, 100, 0)); const v = NET.remotes.get('gV');
      MATCH.timeLeft = 280; shoot(v, 1, 20); const sV = mine(v)[0]; MATCH.timeLeft = 279.95;
      live(); netApply('gV', { ...P(foe, 80, sV.i), ev: [hit(1, netStamp())] });
      out.t3 = { isAlive: PL.ent.alive, waiting: NET.held.length };
      // 4. no news within 0.8 s
      reset(); live(); netApply('gW', P(foe, 100, 0)); const w = NET.remotes.get('gW');
      MATCH.timeLeft = 270; shoot(w, 1, 150); MATCH.timeLeft = 269.95;
      live(); netApply('gW', { ...P(foe, 100, 0), ev: [hit(1, netStamp())] });
      const held4 = NET.held.length; MATCH.time += 0.9; netHeldCheck();
      out.t4 = { waiting: held4, isAlive: PL.ent.alive, afterwards: NET.held.length };
      // 5. bullet without timestamp (previous version)
      reset(); live(); netApply('gX', P(foe, 100, 0)); const x = NET.remotes.get('gX');
      MATCH.timeLeft = 260; shoot(x, 1, 150);
      live(); netApply('gX', { ...P(foe, 100, 0), ev: [{ ...hit(1), s: undefined }] });
      out.t5 = { isAlive: PL.ent.alive, waiting: NET.held.length };
      return out;
    });
    ok(r.burstFire.join() === 'false,false,false,true', 'burst of four bullets: the fourth drops the target right away', r.burstFire);
    ok(r.pendingA.length === 4, 'four in-flight hits kept', r.pendingA);
    ok(r.predAfter === -2, 'state acking two bullets (health 50): predicted health -2', r.predAfter);
    ok(r.previous.every((x) => !x) && r.oldPred === 100, 'victim without ack: nothing predicted, published health alone (as before)', [r.previous, r.oldPred]);
    ok(r.forgot === 100, 'hit never acked forgotten after 2 s', r.forgot);
    ok(r.ak && r.ak.gD === 7 && r.ak['host~b3'] === 4, 'ack published for the player and for the bot', r.ak);
    ok(r.t1Hold.isAlive && r.t1Hold.waiting === 1 && r.t1Hold.ak === 0, 'crossed deaths, I shot first: his bullet waits, my ack does not count it', r.t1Hold);
    ok(r.t1.isAlive && r.t1.vie === 100 && r.t1.waiting === 0, 'he announces his death through my hit: his bullet does not count, I live', r.t1);
    ok(!r.t2.isAlive && r.t2.waiting === 0, 'he shot first: I die right away', r.t2);
    ok(!r.t3.isAlive && r.t3.waiting === 0, 'my hit already applied and he lives: his bullet applies right away', r.t3);
    ok(r.t4.waiting === 1 && !r.t4.isAlive && r.t4.afterwards === 0, 'no news within 0.8 s: his bullet applies', r.t4);
    ok(!r.t5.isAlive && r.t5.waiting === 0, 'bullet without timestamp (previous version): applied right away', r.t5);
    const pe = logs.filter((l) => l.startsWith('[pageerror]'));
    ok(!pe.length, 'no page errors', pe.slice(0, 3));
  } finally { await browser.close(); }
  if (fails.length) { console.log(`${fails.length} failure(s)`); process.exit(1); }
  console.log('all good');
})();
