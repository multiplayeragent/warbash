/* Check of the start countdown (src/09y-countdown.js): node countingDown.js [page=dist/index.html]
   Real solo match (the game's frame loop, 3D rendering off to go fast). The game's countdown lasts 5 s: a first run checks it
   end to end (the number alone, one sound per second from 5 to 1, no voice, "Move out!"), then a countdown stretched to 12 s (MATCH_COUNTDOWN) leaves
   time to measure the rest:
   - on deploy: countdown shown (number, kicker), crosshair hidden, timer stopped;
   - during the countdown: no steps, no sprint, no shooting, no knife, no grenade (keys held), motionless bots that do not shoot, timer frozen,
     number following the time, class-change window open;
   - pause stops the countdown in solo;
   - at the start: "Move out!", start punctuation without voice, sounds for each second, the timer runs, the player
     moves and shoots with the keys they were holding;
   - respawn after a death: no countdown; "Replay": a new countdown; MATCH_COUNTDOWN = 0: immediate start;
   - online guest (host messages simulated, no network): waiting for the host, remaining time received, start when the host stops sending it,
     arrival in a match started without a countdown. */
const { openGame } = require('./common');
const fails = [];
const ok = (c, msg, extra) => { console.log((c ? 'ok    ' : 'FAIL ') + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails.push(msg); };
(async () => {
  const { browser, page, logs } = await openGame({ page: process.argv[2], w: 640, h: 360, countdown: true, settings: { quality: 'low', map: 'chergui', mode: 'tdm' }, noHdri: true, noMap: true });
  const ev = (f, a) => page.evaluate(f, a);
  const wait = (ms) => page.waitForTimeout(ms);
  // 3D rendering off (logic only: the frame loop runs fast with software rendering); spies on the countdown sounds and announcements
  await ev(() => {
    window.__cd = { snd: [], ann: [] };
    const s = cdSound; cdSound = (n, f) => { __cd.snd.push(n); return s(n, f); };
    const a = sfxAnnounce; sfxAnnounce = (l, st) => { __cd.ann.push(l); return a(l, st); };
    LOCK.fallback = true;
  });
  const launch = async () => {
    await ev(() => { toMenu('solo'); menuLaunch({ online: false, map: Settings.map, deploy: () => startMatch() }); });
    await page.waitForFunction("UI.screen==='deploy' && !UI.busy", null, { timeout: 600000 });
    await ev(() => { composer.render = () => {}; __cd.snd.length = 0; __cd.ann.length = 0; document.getElementById('depGo').click(); });
    await page.waitForFunction("MATCH.state==='playing'", null, { timeout: 60000 });
  };
  const state = () => ev(() => {
    const cd = $('cd'), ring = !!document.getElementById('cdRing');
    return { cd: MATCH.cd, on: cdOn(), wait: CD.wait, tl: MATCH.timeLeft, cls: cd.className, num: $('cdNum').textContent, echo: $('cdNum').dataset.n, ring, kick: $('cdKick').textContent, goal: !!document.querySelector('#cd .cd-goal'),
      xh: $('xhair').style.opacity, hud: $('hud').classList.contains('counting'), go: $('cdGo').classList.contains('show'), goTxt: $('cdGo').textContent, msg: $('msg').className.includes('show') ? $('msg').textContent : '' };
  });
  const T = { kick: 'Match begins in', go: 'Move out!', wait: 'Waiting for the host' };

  console.log('Solo, team deathmatch, game countdown (5 s)');
  await ev(() => { Settings.limit = 75; saveSettings(); });
  await launch();
  await page.waitForFunction('CD.shown > 0', null, { timeout: 120000 }).catch(() => {}); // (the first frames are slow with software rendering: we wait for the first number)
  let s = await state();
  ok(await ev(() => cdLen() === 5), 'five seconds');
  ok(s.on && s.cd > 3.5 && s.cd <= 5, 'countdown started on deploy', +s.cd.toFixed(2));
  ok(s.cls.includes('show') && s.hud, 'countdown shown, HUD in countdown mode', s.cls);
  ok(s.kick === T.kick && !s.goal, "kicker alone, no objective reminder (it is in the score)", [s.kick, s.goal]);
  ok(+s.num === Math.ceil(s.cd) && s.echo === s.num && !s.ring, 'number and its echo, no bar', [s.num, s.echo, s.ring]);
  ok(s.xh === '0', 'crosshair hidden');
  ok(s.tl === 600, 'timer stopped at the start', s.tl);
  ok(await ev(() => typeof cdNetOut() === 'number' && classGraceLeft() > CLASS_GRACE), 'remaining time ready for guests, immediate class change open');
  await page.waitForFunction('!cdOn()', null, { timeout: 120000 }).catch(() => {});
  s = await state();
  const def = await ev(() => ({ snd: __cd.snd.slice(), ann: __cd.ann.slice() }));
  ok(!s.on && s.go && s.goTxt === T.go, 'start: "' + T.go + '"', [s.on, s.go, s.goTxt]);
  ok(def.snd.join() === '5,4,3,2,1', 'one sound per second, from 5 to 1', def.snd);
  ok(def.ann.every((l) => l === null) && def.ann.length === 1, 'start: punctuation only, no voice announcement (no radio phrase, no numbers, no "Move out")', def.ann);

  console.log('Countdown stretched to 12 s (time to measure)');
  await ev(() => { window.MATCH_COUNTDOWN = 12; });
  await launch();
  s = await state();
  ok(s.on && s.cd > 10.5 && s.cd <= 12, 'stretched countdown started on deploy', +s.cd.toFixed(2));
  // the player holds forward, sprint, fire and aim, and tries knife and grenade
  const p0 = await ev(() => {
    KEYS.KeyW = true; KEYS.ShiftLeft = true; PL.held = true; PL.queued = true; PL.adsWant = true; knife(); cookNade();
    const bots = entities.filter((e) => !e.isPlayer && e.alive);
    window.__p0 = { me: PL.ent.pos.clone(), bots: bots.map((e) => [e, e.pos.clone()]), shots: bots.reduce((a, e) => a + e.arms.shots, 0) };
    return { knife: PL.knifeT, nade: PL.nadeState, bots: bots.length };
  });
  ok(p0.knife === 0 && !p0.nade, 'no knife or grenade during the countdown');
  // (the first frames after deploy are slow with software rendering: we wait for the countdown to have advanced by 2 s)
  await page.waitForFunction('MATCH.cd < 10', null, { timeout: 120000 }).catch(() => {});
  const mv = await ev(() => {
    const d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
    return { me: d(PL.ent.pos, __p0.me), bots: Math.max(...__p0.bots.map(([e, p]) => d(e.pos, p))), botShots: entities.filter((e) => !e.isPlayer).reduce((a, e) => a + e.arms.shots, 0) - __p0.shots, shots: PL.shots, ads: VM.ads };
  });
  s = await state();
  ok(mv.me < 0.01, 'the player does not move (forward and sprint held)', +mv.me.toFixed(3));
  ok(mv.shots === 0 && mv.ads < 0.05, 'the player neither shoots nor aims', [mv.shots, +mv.ads.toFixed(2)]);
  ok(mv.bots < 0.05 && mv.botShots === 0, 'the bots stay in place and do not shoot', [+mv.bots.toFixed(3), mv.botShots]);
  ok(s.tl === 600, 'timer frozen during the countdown', s.tl);
  ok(s.on && s.cd < 10 && s.cd > 3, 'the countdown advances (real time)', +s.cd.toFixed(2));
  ok(+s.num === Math.ceil(s.cd) && s.echo === s.num, 'number and echo follow the time', [s.num, s.echo, +s.cd.toFixed(2)]);
  // pause: the countdown stops in solo
  const pz = await ev(() => { pauseGame(); window.__f0 = frameN; return MATCH.cd; });
  await page.waitForFunction('frameN > __f0 + 12', null, { timeout: 120000 }).catch(() => {});
  // resume: the pause released the keys (pauseGame), the player holds them again
  const pz2 = await ev(() => { const c = MATCH.cd; resumeGame(); KEYS.KeyW = true; PL.held = true; return [c, frameN - __f0]; });
  ok(Math.abs(pz2[0] - pz) < 0.02 && pz2[1] > 12, 'the pause stops the countdown (solo)', [+pz.toFixed(2), +pz2[0].toFixed(2), pz2[1] + ' images']);
  await page.waitForFunction('!cdOn()', null, { timeout: 120000 }).catch(() => {});
  s = await state();
  const after = await ev(() => ({ snd: __cd.snd.slice(), ann: __cd.ann.slice(), start: MATCH.startAt, time: MATCH.time }));
  ok(!s.on && s.go && s.goTxt === T.go, 'start: "' + T.go + '"', [s.on, s.go, s.goTxt]);
  ok(!s.hud && !s.cls.includes('show'), 'countdown cleared');
  ok(after.ann.every((l) => l === null), 'no voice announcement', after.ann);
  ok([3, 2, 1].every((n) => after.snd.includes(n)) && after.snd.join() === after.snd.slice().sort((a, b) => b - a).join(), "one sound per second, in order", after.snd);
  ok(Math.abs(after.start - after.time) < 0.5, 'match start counted from the start (MATCH.startAt)');
  await page.waitForFunction('MATCH.time - MATCH.startAt > 1.2', null, { timeout: 120000 }).catch(() => {});
  const run = await ev(() => { const d = Math.hypot(PL.ent.pos.x - __p0.me.x, PL.ent.pos.z - __p0.me.z); const r = { tl: MATCH.timeLeft, me: d, shots: PL.shots, xh: $('xhair').style.opacity }; for (const k in KEYS) KEYS[k] = false; PL.held = false; PL.adsWant = false; return r; });
  ok(run.tl < 600, 'the timer runs after the start', +run.tl.toFixed(1));
  ok(run.me > 0.5 && run.shots > 0, 'the player moves and shoots with the held keys', [+run.me.toFixed(2), run.shots]);

  console.log('Respawn after a death: no countdown');
  await ev(() => { const b = entities.find((x) => !x.isPlayer && x.alive && !allied(x, PL.ent)); killEnt(PL.ent, b, 'AK-47', false, new V3(0, 0, 1)); });
  await page.waitForFunction("(MATCH.state==='killcam' && kcSkip(), MATCH.state==='playing' && PL.ent.alive)", null, { timeout: 60000, polling: 300 }).catch(() => {});
  s = await state();
  ok(await ev(() => PL.ent.alive) && !s.on && !s.cls.includes('show'), 'respawned without a countdown', [s.on, s.cls]);

  console.log('"Replay": a new countdown');
  await ev(() => endMatch());
  await ev(() => { composer.render = () => {}; $('againBtn').click(); });
  await page.waitForFunction("UI.screen==='deploy' && !UI.busy", null, { timeout: 600000 });
  await ev(() => { __cd.snd.length = 0; __cd.ann.length = 0; $('depGo').click(); });
  await page.waitForFunction("MATCH.state==='playing'", null, { timeout: 60000 });
  s = await state();
  ok(s.on && s.cd > 8.5 && s.tl === 600, 'new countdown after "Replay"', +s.cd.toFixed(2));

  console.log('Test tools: MATCH_COUNTDOWN = 0');
  await ev(() => { window.MATCH_COUNTDOWN = 0; });
  await launch();
  s = await state();
  ok(!s.on && !s.go && s.msg.length > 0, 'immediate start, objective as a message like before', s.msg);
  await ev(() => { delete window.MATCH_COUNTDOWN; });

  console.log("Online guest (host messages simulated)");
  // (lobby joined and host just seen: the network heartbeat, netHeartbeat, does not close it)
  await ev(() => { const now = performance.now(); Object.assign(NET, { role: 'client', on: true, joined: true, t0: now, hostSeen: now, lastSend: now }); MATCH.online = true; __cd.ann.length = 0; cdStart(); });
  await wait(1200);
  s = await state();
  ok(s.on && s.wait && s.cls.includes('wait') && s.kick === T.wait, "deployed before the host: waiting", [s.cls, s.kick]);
  const tlw = await ev(() => MATCH.timeLeft);
  await ev((tl) => netClientMsg({ t: 'ps', l: [], tl, cd: 3.4 }), tlw);
  await page.waitForFunction('CD.shown > 0', null, { timeout: 60000 }).catch(() => {});
  s = await state();
  ok(s.on && !s.wait && s.cd > 2.5 && s.cd <= 3.4 && +s.num === Math.ceil(s.cd), "remaining time received from the host", +s.cd.toFixed(2));
  const c1 = await ev(() => { const c = MATCH.cd; netClientMsg({ t: 'ps', l: [{}], tl: MATCH.timeLeft, cd: +(c + 0.05).toFixed(2) }); netClientMsg({ t: 'ps', l: [], cd: 1 }); return [c, MATCH.cd]; });
  ok(Math.abs(c1[1] - c1[0]) < 0.06, 'small gap and relayed state (no tl): no jump', c1.map((x) => +x.toFixed(2)));
  await ev(() => netClientMsg({ t: 'ps', l: [], tl: MATCH.timeLeft }));
  s = await state();
  ok(!s.on && s.go, "start when the host no longer sends a countdown");
  await ev(() => { cdStart(); netClientMsg({ t: 'ps', l: [], tl: 512 }); });
  s = await state();
  ok(!s.on && !s.go && s.msg.length > 0 && s.tl === 512, 'joining a match already started: no countdown', [s.on, s.go, s.tl, s.msg]);
  await ev(() => { NET.role = 'off'; NET.on = false; MATCH.online = false; toMenu(); });

  const errs = logs.filter((l) => /pageerror/.test(l) || (/^\[error\]/.test(l) && !/ERR_/.test(l)));
  ok(!errs.length, 'no error in the page', errs.slice(0, 3));
  console.log(fails.length ? `${fails.length} failure(s)` : 'all good');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
