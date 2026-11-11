/* Check of the challenges that unlock the challenge outfits (src/06s-challenges.js), without playing a whole match: each challenge counts what it should
   count and nothing else (weapon family, knife and grenade, distance, crouch, slide and jump, double kill, suppressed, UAV drone,
   captured point, deathmatch rank, finished maps, French maps), a challenge stops at its goal, an outfit unlocks and is announced when its three
   challenges are done, the chosen but locked outfit goes back to Assault, progress is saved and merged (the highest counter
   wins, the maps are united), the end screen summarizes it.
   The 60 challenges of the twenty later outfits (map and play-style outfits): each counts when its action happens (and not in the
   nearby cases that must not count), each outfit unlocks and is announced when its three challenges reach their goal, progress
   survives a save and a reload, an old save (before these outfits) loads unchanged, an unknown outfit id falls back to Assault.
   node tools/dev/visual/challenges.js ; exits with an error code at the first failure. */
const { openGame } = require('./common');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL  :', m); } else console.log('ok    :', m); };
(async () => {
  const { browser, page, logs } = await openGame({ settings: { quality: 'low', skin: 'raptor' } });
  await page.evaluate(() => { Settings.mode = 'tdm'; startMatch({}); });
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const out = {}, me = PL.ent, foe = entities.find((e) => !e.isPlayer && !e.off && !allied(me, e)), N = (id) => WEAPONS[id].name;
    const reset = () => { ARS.ch = {}; ARS.chMaps = []; ARS.chSess = {}; };
    const OLD = CHALLENGES.slice(0, 18).map((d) => d.id); // (the first six outfits; the later ones are checked below)
    const snap = () => Object.fromEntries(OLD.map((id) => [id, challengeCount(id)]).filter(([, n]) => n));
    const kill = (weapon, o = {}) => {
      Object.assign(me, { crouch: false, slideT: 0, onGround: true, comboN: 1 }, o.me || {});
      foe.pos.copy(me.pos).add(new V3(0, 0, -(o.d || 10)));
      challengesKill(me, foe, weapon, !!o.head);
    };
    out.locked = { set: Settings.skin, mine: skinMine() };
    reset();
    for (const id of ['m1014', 'l96', 'mp5', 'm4', 'm9']) kill(N(id));
    out.cats = snap(); reset();
    kill(NET_WSPECIAL.knife); kill(NET_WSPECIAL.nade); kill(NET_WSPECIAL.air); kill(NET_WSPECIAL.heli); kill(NET_WSPECIAL.fall);
    out.special = snap(); reset();
    kill(N('l96'), { d: 55 }); kill(N('l96'), { d: 30 });
    out.far = snap(); reset();
    kill(N('m4'), { me: { crouch: true } }); kill(N('m4'), { me: { crouch: true, slideT: 0.3 } }); kill(N('m4'), { me: { onGround: false } });
    out.pose = snap(); reset();
    kill(N('m4'), { me: { comboN: 2 } }); kill(N('m4'), { me: { comboN: 3 } });
    out.combo = snap(); reset();
    const w = curW(), def0 = w.def; w.def = weaponDef(def0.id, ['sil'], null); kill(def0.name); w.def = def0; kill(def0.name);
    out.sil = snap(); reset();
    PL.ks.uav = true; useUAV(); if (typeof ksAbort === 'function') ksAbort();
    out.uav = snap(); reset();
    me.alive = true; domChanged({ owner: me.team, n: [1, 1], x: me.pos.x, y: me.pos.y, z: me.pos.z, name: 'A' }, -1);
    out.cap = snap(); reset();
    MATCH.mode = 'ffa'; challengesMatchEnd('win', 2); challengesMatchEnd('loss', 4); MATCH.mode = 'tdm'; challengesMatchEnd('win', 1);
    out.end = snap(); out.maps = ARS.chMaps.slice(); reset();
    // French maps (Yellow Vest): matches finished, wins and kills on Saint-Givre, Port-Maël or Bel-Horizon only
    const map0 = CURMAP.id;
    CURMAP.id = 'portmael'; kill(N('m4')); kill(NET_WSPECIAL.knife); challengesMatchEnd('win', 1); challengesMatchEnd('loss', 5);
    CURMAP.id = 'chergui'; kill(N('m4')); challengesMatchEnd('win', 1);
    CURMAP.id = map0;
    out.fr = snap(); reset();
    // cap at the goal, unlock and announcements
    ARSQ.list.length = 0;
    challengeAdd('rPm', 500); challengeAdd('rMouv', 25);
    out.before = { un: skinUnlocked('raptor'), mine: skinMine() };
    challengeAdd('rDouble', 15);
    out.after = { un: skinUnlocked('raptor'), mine: skinMine(), rPm: ARS.ch.rPm, ann: ARSQ.list.concat(ARSQ.on ? [document.getElementById('arsUp').innerHTML] : []).join(' | ') };
    out.endHtml = challengesEndHtml().length;
    // save and merge: the highest counter wins, the maps are united, a malformed key is discarded
    const s0 = JSON.parse(JSON.stringify(arsSnapshot()));
    ARS.ch = { rPm: 10, vFa: 7 }; ARS.chMaps = ['saintgivre'];
    arsApply(Object.assign({}, s0, { ch: Object.assign({}, s0.ch, { vFa: 3, 'bad key!': 9 }), cm: ['chergui', 'chergui', 'bogus'] }), true);
    out.merge = { ch: ARS.ch, maps: ARS.chMaps.slice().sort() };
    return out;
  });
  ok(r.locked.set === 'raptor' && r.locked.mine === 'assault', `chosen but locked outfit: Assault worn (${JSON.stringify(r.locked)})`);
  ok(JSON.stringify(r.cats) === JSON.stringify({ nShotgun: 1, tPrec: 1, rPm: 1, vFa: 1, vPist: 1 }), `each weapon family counts for its challenge (${JSON.stringify(r.cats)})`);
  ok(JSON.stringify(r.special) === JSON.stringify({ nMelee: 2 }), `knife and grenade count, airstrike, helicopter and fall do not (${JSON.stringify(r.special)})`);
  ok(r.far.tFar === 1 && r.far.tPrec === 2, `only at 50 m or more (${JSON.stringify(r.far)})`);
  ok(r.pose.fAcc === 1 && r.pose.rMouv === 2, `crouch (not while sliding), slide and jump (${JSON.stringify(r.pose)})`);
  ok(r.combo.rDouble === 1, `double kill: once per chain (${JSON.stringify(r.combo)})`);
  ok(r.sil.fSil === 1, `suppressor: only the weapon that carries one (${JSON.stringify(r.sil)})`);
  ok(r.uav.tUav === 1, `UAV drone called (${JSON.stringify(r.uav)})`);
  ok(r.cap.vDom === 1, `point captured in Domination (${JSON.stringify(r.cap)})`);
  ok(r.end.nFfa === 1 && r.end.fMaps === 1 && r.maps.length === 1, `end of match: deathmatch rank, map finished only once (${JSON.stringify(r.end)} ${r.maps})`);
  ok(r.fr.gElim === 2 && r.fr.gMatches === 2 && r.fr.gVict === 1, `French maps: kills, matches and wins, nowhere else (${JSON.stringify(r.fr)})`);
  ok(!r.before.un && r.before.mine === 'assault' && r.after.un && r.after.mine === 'raptor' && r.after.rPm === 150, `three challenges completed: Raptor unlocked and worn, counter capped (${JSON.stringify(r.before)} ${JSON.stringify(r.after).slice(0, 160)})`);
  ok(/Challenge complete/.test(r.after.ann) && /Outfit unlocked: Raptor/.test(r.after.ann), `announcements: challenge completed, outfit unlocked`);
  ok(r.endHtml > 100, `end screen: match challenges (${r.endHtml} characters)`);
  ok(r.merge.ch.rPm === 150 && r.merge.ch.vFa === 7 && !('bad key!' in r.merge.ch) && JSON.stringify(r.merge.maps) === JSON.stringify(['chergui', 'saintgivre']), `save merge (${JSON.stringify(r.merge)})`);
  // ---------- the twenty later outfits ----------
  const N2 = await page.evaluate(() => {
    const me = PL.ent, foe = entities.find((e) => !e.isPlayer && !e.off && !allied(me, e)), W = NET_WSPECIAL, N = (id) => WEAPONS[id].name, map0 = CURMAP.id, mode0 = MATCH.mode, pts0 = DOM.pts;
    const LATER = CHALLENGES.slice(18), reset = () => { ARS.ch = {}; ARS.chMaps = []; ARS.chSess = {}; challengesReset(); };
    const kill = (weapon, o = {}) => {
      CURMAP.id = o.map || 'chergui';
      Object.assign(me, { crouch: false, slideT: 0, onGround: true, comboN: 1, streak: 1, health: 100, alive: true, adsActive: true, spawnAt: 1 }, o.me || {});
      foe.pos.copy(me.pos).add(new V3(0, 0, -(o.d || 10))); foe.yaw = o.away ? 0 : Math.PI; // (the foe stands at -z: yaw 0 faces -z, away from the player)
      challengesKill(me, foe, weapon, !!o.head); CURMAP.id = map0;
    };
    const end = (result, rank, o = {}) => {
      CURMAP.id = o.map || 'chergui'; MATCH.mode = o.mode || 'tdm'; const k0 = me.kills, d0 = me.deaths, df = Settings.difficulty;
      me.kills = o.kills === undefined ? 5 : o.kills; me.deaths = o.deaths === undefined ? 6 : o.deaths; Settings.difficulty = o.diff === undefined ? 1 : o.diff;
      challengesMatchEnd(result, rank); CURMAP.id = map0; MATCH.mode = mode0; me.kills = k0; me.deaths = d0; Settings.difficulty = df;
    };
    const onPoint = (f) => { MATCH.mode = 'dom'; DOM.pts = [{ x: me.pos.x, y: me.pos.y, z: me.pos.z, owner: me.team, n: [1, 1], name: 'A' }]; try { f(); } finally { MATCH.mode = mode0; DOM.pts = pts0; } };
    const allHeld = (all) => { const p = (o) => ({ x: 0, y: -500, z: 0, owner: o, n: [1, 1], name: 'A' }); DOM.pts = [p(me.team), p(me.team), p(all ? me.team : 1 - me.team)]; try { domChanged(DOM.pts[0], -1); } finally { DOM.pts = pts0; } };
    const capture = (map) => { CURMAP.id = map; try { domChanged({ owner: me.team, n: [1, 1], x: me.pos.x, y: me.pos.y, z: me.pos.z, name: 'A' }, -1); } finally { CURMAP.id = map0; } };
    const ks = () => { // a satellite called through the terminal: the call counts when its button is pressed (updateKillstreak)
      PL.ks.sat = true; if (!ksStart('sat')) return 'no start';
      for (let i = 0; i < 80 && KS.pressT < 0; i++) updateKillstreak(0.05);
      ksAbort(); return '';
    };
    const sil = (map) => { const w = curW(), def0 = w.def; w.def = weaponDef(def0.id, ['sil'], null); try { kill(def0.name, { map }); } finally { w.def = def0; } };
    const S = {
      drKill: () => kill(N('m4'), { map: 'chergui' }), drWin: () => end('win', 3, { map: 'chergui' }), drFar: () => kill(N('l96'), { map: 'chergui', d: 35 }),
      woKill: () => kill(W.knife, { map: 'saintgivre' }), woWin: () => end('win', 4, { map: 'saintgivre', mode: 'dom' }), woCrouch: () => kill(N('m4'), { map: 'saintgivre', me: { crouch: true } }),
      coKill: () => kill(W.air, { map: 'portmael' }), coWin: () => end('win', 1, { map: 'portmael', mode: 'ffa' }), coKnife: () => kill(W.tknife, { map: 'portmael' }),
      brKill: () => kill(N('mp5'), { map: 'floralia' }), brWin: () => end('win', 2, { map: 'floralia' }), brSil: () => sil('floralia'),
      arKill: () => kill(N('m4'), { map: 'notos' }), arWin: () => end('win', 2, { map: 'notos' }), arHead: () => kill(N('m4'), { map: 'notos', head: true }),
      ciKill: () => kill(N('m4'), { map: 'scoria' }), ciWin: () => end('win', 2, { map: 'scoria' }), ciBoom: () => kill(W.nade, { map: 'scoria' }),
      stKill: () => kill(N('m4'), { map: 'cirrus' }), stWin: () => end('win', 2, { map: 'cirrus' }), stAir: () => kill(N('m4'), { map: 'cirrus', me: { onGround: false } }),
      svKill: () => kill(N('m4'), { map: 'sirocco' }), svWin: () => end('win', 2, { map: 'sirocco' }), svDouble: () => kill(N('m4'), { map: 'sirocco', me: { comboN: 2 } }),
      dpKill: () => kill(N('m4'), { map: 'belhorizon' }), dpWin: () => end('win', 2, { map: 'belhorizon' }), dpCap: () => capture('belhorizon'),
      jaKill: () => kill(N('m4'), { map: 'outpost' }), jaWin: () => end('win', 2, { map: 'outpost' }), jaClose: () => kill(N('m1014'), { map: 'outpost', d: 3 }),
      bwStreak: () => kill(N('m4'), { me: { streak: 5 } }), bwSolid: () => end('loss', 5, { kills: 9, deaths: 3 }), bwLow: () => kill(N('m4'), { me: { health: 25 } }),
      sbWin: () => end('win', 4, { mode: 'dom' }), sbOn: () => onPoint(() => kill(N('m4'))), sbAll: () => allHeld(true),
      spNade: () => kill(W.nade), spAir: () => kill(W.air), spMulti: () => { kill(W.nade); kill(W.nade); },
      skCall: ks, skKill: () => kill(W.heli), skRadar: () => { MATCH.uav[me.team] = 10; MATCH.emp[me.team] = 0; kill(N('m4')); MATCH.uav[me.team] = 0; },
      maHead: () => kill(N('m9'), { head: true }), maHeavy: () => kill(N('deagle')), maFar: () => kill(N('usp'), { d: 30 }),
      shKnife: () => kill(W.knife), shThrow: () => kill(W.tknife), shBack: () => kill(N('m4'), { away: true }),
      auXp: () => kill(N('m4'), { head: true }), auMvp: () => end('loss', 1), auHead: () => kill(W.knife, { head: true }),
      trClose: () => kill(N('mp5'), { d: 4 }), trHip: () => kill(N('mp5'), { me: { adsActive: false } }), trShot: () => kill(N('m1014'), { head: true }),
      cuTriple: () => kill(N('m4'), { me: { comboN: 3 } }), cuLand: () => { CHX.landT = MATCH.time - 1; kill(N('m4')); }, cuSlide: () => { CHX.slideT = MATCH.time - 2; kill(N('m4')); },
      ogModes: () => end('win', 3, { mode: 'ffa' }), ogMaps: () => end('win', 3, { map: 'scoria' }), ogVet: () => end('win', 3, { diff: DIFF.length - 1 }),
    };
    // nearby cases that must not count
    const NOT = {
      drKill: () => kill(N('m4'), { map: 'sirocco' }), drFar: () => kill(N('l96'), { map: 'chergui', d: 25 }), drWin: () => end('loss', 2, { map: 'chergui' }),
      woCrouch: () => kill(N('m4'), { map: 'saintgivre', me: { crouch: true, slideT: 0.3 } }), coKnife: () => kill(W.knife, { map: 'notos' }), brSil: () => kill(N('m4'), { map: 'floralia' }),
      arHead: () => kill(N('m4'), { map: 'notos' }), ciBoom: () => kill(W.heli, { map: 'scoria' }), stAir: () => kill(N('m4'), { map: 'cirrus' }), svDouble: () => kill(N('m4'), { map: 'sirocco', me: { comboN: 3 } }),
      dpCap: () => capture('notos'), jaClose: () => kill(N('m4'), { map: 'outpost', d: 6 }),
      bwStreak: () => { kill(N('m4'), { me: { streak: 4 } }); kill(N('m4'), { me: { streak: 5, spawnAt: 7 } }); kill(W.heli, { me: { streak: 5, spawnAt: 7 } }); }, // (one only)
      bwSolid: () => end('win', 1, { kills: 9, deaths: 4 }), bwLow: () => kill(N('m4'), { me: { health: 40 } }),
      sbOn: () => kill(N('m4')), sbAll: () => allHeld(false), sbWin: () => end('win', 1, { mode: 'tdm' }),
      spNade: () => kill(W.knife), spAir: () => kill(W.heli), spMulti: () => { kill(W.nade); CHX.boomT = MATCH.time - 1.5; kill(W.nade); },
      skKill: () => kill(N('m4')), skRadar: () => { MATCH.uav[me.team] = 0; MATCH.sat[me.team] = 0; kill(N('m4')); },
      maHead: () => kill(N('m4'), { head: true }), maHeavy: () => kill(N('m9')), maFar: () => kill(N('usp'), { d: 20 }),
      shKnife: () => kill(W.tknife), shThrow: () => kill(W.knife), shBack: () => kill(N('m4')),
      auMvp: () => end('win', 2), auHead: () => kill(N('m4')),
      trClose: () => kill(N('mp5'), { d: 6 }), trHip: () => kill(N('mp5')), trShot: () => kill(N('m4'), { head: true }),
      cuTriple: () => kill(N('m4'), { me: { comboN: 2 } }), cuLand: () => { CHX.landT = MATCH.time - 4; kill(N('m4')); }, cuSlide: () => { CHX.slideT = MATCH.time - 2; kill(N('m4'), { me: { slideT: 0.3 } }); },
      ogModes: () => end('loss', 1, { mode: 'ffa' }), ogVet: () => end('win', 1, { diff: 1 }),
    };
    const res = { counts: {}, wrong: [], extra: [], missing: LATER.map((d) => d.id).filter((id) => !S[id]), unlock: {} };
    for (const d of LATER) {
      if (!S[d.id]) continue;
      reset(); const e = S[d.id](); res.counts[d.id] = challengeCount(d.id);
      if (e) res.wrong.push(d.id + ': ' + e);
      if (res.counts[d.id] < 1) res.wrong.push(d.id + ' did not count');
      if (NOT[d.id]) { reset(); NOT[d.id](); const n = challengeCount(d.id); if (n > (d.id === 'bwStreak' ? 1 : 0)) res.extra.push(d.id + '=' + n); }
      if (!/^[a-zA-Z]{2,16}$/.test(d.id)) res.wrong.push(d.id + ': id rejected by arsApply');
    }
    // each later outfit: its three challenges one action from their goal; the actions complete them, unlock it and announce it
    for (const sk of SKIN_MAP_OUT.concat(SKIN_PLAY_OUT)) {
      reset(); ARSQ.list.length = 0;
      const D = challengesOf(sk), r = { n: D.length };
      for (const d of D) {
        const sub = CHALLENGE_SUB[d.id];
        if (!sub) { ARS.ch[d.id] = Math.max(0, d.goal - res.counts[d.id]); continue; }
        let left = d.goal - 1;
        for (const k of sub.keys()) { if (k === 'ogWffa' || k === 'ogMscoria') continue; const v = Math.min(sub.cap, left); if (v > 0) ARS.ch[k] = v; left -= v; }
        if (d.id === 'ogModes') ARS.ch.ogWffa = 1;
      }
      r.before = skinUnlocked(sk) || D.some((d) => challengeDone(d.id));
      for (const d of D) S[d.id]();
      r.after = skinUnlocked(sk); r.done = D.map((d) => challengeDone(d.id)); r.ann = ARSQ.list.concat(ARSQ.on && ARSQ.cur ? [ARSQ.cur] : []).join(' | ');
      res.unlock[sk] = r;
    }
    // save and reload: the counters come back as they were; an old save (before these outfits) loads unchanged
    reset(); for (const d of LATER) if (!CHALLENGE_SUB[d.id]) ARS.ch[d.id] = 1; ARS.ch.ogWtdm = 2; ARS.ch.ogMnotos = 1;
    const saved = JSON.stringify(arsSnapshot()); ARS.ch = {}; arsApply(JSON.parse(saved), false);
    res.reload = LATER.every((d) => challengeCount(d.id) >= 1) && challengeCount('ogModes') === 2;
    const old = { v: 4, wxp: { m4: 1000 }, k: { m4: 10 }, h: {}, px: 500, cfg: {}, lt: 0, custom: [], ch: { rPm: 150, rMouv: 25, rDouble: 15, vFa: 40, gElim: 12 }, cm: ['chergui', 'notos'] };
    reset(); arsApply(JSON.parse(JSON.stringify(old)), false);
    res.old = { ch: JSON.stringify(ARS.ch) === JSON.stringify(old.ch), maps: JSON.stringify(ARS.chMaps) === JSON.stringify(old.cm), raptor: skinUnlocked('raptor'), later: SKIN_MAP_OUT.concat(SKIN_PLAY_OUT).filter(skinUnlocked) };
    res.ids = { unknown: skinId('notAnOutfit'), later: SKIN_MAP_OUT.concat(SKIN_PLAY_OUT).every((s) => skinId(s) === s), total: SKIN_CHALLENGE.length, n: LATER.length, preview: SKIN_PREVIEW };
    // end screen with many challenges moved at once: at most CHALLENGE_END_MAX rows and a summary line
    reset(); for (const d of LATER.slice(0, 14)) { ARS.chSess[d.id] = 1; ARS.ch[d.id] = 1; }
    const h = challengesEndHtml(); res.endRows = (h.match(/class="ars-row/g) || []).length; res.endMore = /more challenges progressed/.test(h);
    reset();
    return res;
  });
  ok(N2.ids.n === 60 && N2.ids.total === 26 && N2.missing.length === 0, `60 later challenges, 26 challenge outfits, a scenario for each (${N2.ids.n}, ${N2.ids.total}, missing: ${N2.missing})`);
  ok(N2.wrong.length === 0, `each later challenge counts when its action happens (${N2.wrong.join('; ') || Object.keys(N2.counts).length + ' checked'})`);
  ok(N2.extra.length === 0, `nearby cases do not count (${N2.extra.join('; ') || 'none counted'})`);
  const bad = Object.entries(N2.unlock).filter(([, r]) => r.n !== 3 || r.before || !r.after || r.done.some((x) => !x) || !/Outfit unlocked/.test(r.ann));
  ok(bad.length === 0, `each later outfit: locked one action from its goals, unlocked and announced by those actions (${bad.map(([k, r]) => k + ' ' + JSON.stringify(r).slice(0, 200)).join('; ') || Object.keys(N2.unlock).length + ' outfits'})`);
  ok(N2.reload, 'later counters survive a save and a reload');
  ok(N2.old.ch && N2.old.maps && N2.old.raptor && N2.old.later.length === 0, `old save loads unchanged (${JSON.stringify(N2.old)})`);
  ok(N2.ids.unknown === 'assault' && N2.ids.later && !N2.ids.preview, `outfit ids: unknown falls back to Assault, the later ones are known, review unlock off (${JSON.stringify(N2.ids)})`);
  ok(N2.endRows <= 8 && N2.endMore, `end screen with 14 challenges moved: ${N2.endRows} rows, the rest summed up`);
  const errs = logs.filter((l) => !/ERR_FILE_NOT_FOUND|favicon|X4000/.test(l)); // (X4000: a shader compiler warning of the graphics card, GPU=hw)
  ok(errs.length === 0, `no page error${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
  await browser.close();
  console.log(fails ? `${fails} failure(s)` : 'all good');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
