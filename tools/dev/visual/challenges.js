/* Check of the challenges that unlock the challenge outfits (src/06s-challenges.js), without playing a whole match: each challenge counts what it should
   count and nothing else (weapon family, knife and grenade, distance, crouch, slide and jump, double kill, suppressed, UAV drone,
   captured point, deathmatch rank, finished maps, French maps), a challenge stops at its goal, an outfit unlocks and is announced when its three
   challenges are done, the chosen but locked outfit goes back to Assault, progress is saved and merged (the highest counter
   wins, the maps are united), the end screen summarizes it.
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
    const snap = () => Object.fromEntries(CHALLENGES.map((d) => [d.id, challengeCount(d.id)]).filter(([, n]) => n));
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
  ok(r.merge.ch.rPm === 150 && r.merge.ch.vFa === 7 && !('bad key!' in r.merge.ch) && JSON.stringify(r.merge.maps) === JSON.stringify(['saintgivre', 'chergui']), `save merge (${JSON.stringify(r.merge)})`);
  const errs = logs.filter((l) => !/ERR_FILE_NOT_FOUND|favicon/.test(l));
  ok(errs.length === 0, `no page error${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
  await browser.close();
  console.log(fails ? `${fails} failure(s)` : 'all good');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
