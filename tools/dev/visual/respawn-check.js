/* Check of respawn after dying at the controls of a streak: the player dies piloting the kamikaze drone (08e-fpv.js), or in
   their mecha that explodes (08g-mecha-pilote.js), without killcam (killed by a drone, an explosion); on respawn, they have their weapon in hand (first-person view
   visible, weapon equipped, ready to fire). Before the fix, they restarted empty-handed until the next drone.
   node tools/dev/visual/respawn-check.js ; error code at the first failure. */
const { openGame } = require('./common');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL  :', m); } else console.log('ok    :', m); };
(async () => {
  const { browser, page, logs } = await openGame({ settings: { quality: 'low' }, page: process.env.PAGE }); // PAGE=otherGrip/version.html
  await page.evaluate(() => { Settings.mode = 'tdm'; startMatch({}); });
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    let t = performance.now();
    const run = (n) => { for (let k = 0; k < n; k++) { t += 1000 / 60; frame(t); } };
    const until = (f, n) => { for (let k = 0; k < n && !f(); k++) run(1); return f(); };
    const state = () => ({ alive: PL.ent.alive, vm: VM.root.visible, holder: VM.holder.visible, firearm: !!curW(), readied: !busy(), drone: !!PILOT.d, mecha: !!MECHA_P.me });
    const out = {};
    run(30);
    // drone: launched, piloted, then the player is killed
    fpvLaunch(PL.ent); run(40);
    out.vol = state();
    const foe = entities.find((e) => !e.isPlayer && !e.off && !allied(PL.ent, e));
    killEnt(PL.ent, foe, NET_WSPECIAL.drone, false, new V3(0, 0, 1)); run(5); // (killed by an enemy drone: no killcam)
    out.deadAtDrone = state();
    out.reapDrone = until(() => PL.ent.alive, 60 * 20) && (run(30), state());
    // mecha: on board, it overheats and explodes with its pilot
    const me = mechaSpawn(PL.ent, PL.ent.pos.clone().add(new V3(0, 0, 2)), PL.ent.yaw); mechaBoard(me); run(30);
    out.atEdge = state();
    mechaOverheat(me); run(5);
    out.deadInMecha = state();
    out.reapMecha = until(() => PL.ent.alive, 60 * 20) && (run(30), state());
    return out;
  });
  ok(r.vol.drone && !r.vol.vm, `drone in flight: the view is in the drone, the weapon hidden (${JSON.stringify(r.vol)})`);
  ok(!r.deadAtDrone.alive && !r.deadAtDrone.drone, `death at the drone controls: the view returns to the body (${JSON.stringify(r.deadAtDrone)})`);
  ok(r.reapDrone && r.reapDrone.alive && r.reapDrone.vm && r.reapDrone.holder && r.reapDrone.firearm && r.reapDrone.readied, `respawn after the drone: weapon in hand, ready to fire (${JSON.stringify(r.reapDrone)})`);
  ok(r.atEdge.mecha && !r.atEdge.vm, `aboard the mecha: the weapon hidden (${JSON.stringify(r.atEdge)})`);
  ok(!r.deadInMecha.alive, `mecha exploding with its pilot (${JSON.stringify(r.deadInMecha)})`);
  ok(r.reapMecha && r.reapMecha.alive && r.reapMecha.vm && r.reapMecha.holder && r.reapMecha.firearm && r.reapMecha.readied, `respawn after the mecha: weapon in hand, ready to fire (${JSON.stringify(r.reapMecha)})`);
  const errs = logs.filter((l) => !/ERR_FILE_NOT_FOUND|favicon/.test(l));
  ok(errs.length === 0, `no page error${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
  await browser.close();
  console.log(fails ? `${fails} failure(s)` : 'all good');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
