/* Contact sheet of the killstreaks, on a real map: terminal of the drone and the helicopter, tablet of the airstrike
   (first-person view, frozen at instants of the gesture, in seconds since the call), strike map with its red zone, then
   the support helicopter seen from outside.
   node series.js [folder] [--modes uav,air,heli,map,helicopter] [--times 0.3,0.45,...] [--phone 1] [--trial setting.js]
   --phone 1: phone in landscape (915 x 412, touch controls) ; --trial: script run in the page before the shots (try a
   setting without rebuilding). QUALITY_LEVEL=high, MAP=saintgivre. Assemble with montage. */
const fs = require('fs'), path = require('path');
const { openGame } = require('./common');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const out = args[0] && !args[0].startsWith('--') ? args[0] : path.join(__dirname, 'shots');
const modes = opt('modes', 'uav,air,heli,map,helicopter').split(','), trial = opt('trial', ''), phone = opt('phone', '0') === '1';
const TIMES = { uav: [0.3, 0.42, 0.56, 0.7, 0.82], air: [0.35, 0.45, 1.0, 1.4], heli: [0.56] };
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { browser, page, logs } = await openGame(Object.assign(phone ? { mobile: true, w: 915, h: 412 } : { w: 960, h: 540 }, { settings: { quality: process.env.QUALITY_LEVEL || 'medium', difficulty: 1, map: process.env.MAP || 'chergui' }, noHdri: true }));
  await page.evaluate(() => {
    LOCK.fallback = true; startMatch({}); MATCH.state = 'capture';
    for (const e of entities) if (!e.isPlayer) { e.model.root.visible = false; e.alive = false; }
    window.__hide = (h) => document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.visibility = h ? 'hidden' : ''; });
    window.__view = () => { VM.root.visible = true; camera.position.set(0, 1.6, 20); camera.lookAt(0, 1.5, 0); camera.fov = Settings.fov; camera.updateProjectionMatrix(); vmCamera.fov = 54; vmCamera.updateProjectionMatrix(); };
    const S = { ads: false, sprint: false, speed: 0, grounded: true, crouch: false, empty: false, lat: 0, fwd: 0, fire: false, wall: 0, slide: 0 };
    /* a game frame (events, first-person view, streaks, devices), without player or bots */
    window.__step = (T) => {
      for (let t = 0; t < T - 1e-6; t += 1 / 60) {
        MATCH.time += 1 / 60;
        for (let i = MATCH.events.length - 1; i >= 0; i--) if (MATCH.events[i].t <= MATCH.time) { const ev = MATCH.events[i]; MATCH.events.splice(i, 1); ev.fn(); }
        updateViewmodel(1 / 60, S); updateKillstreak(1 / 60); updateAircraft(1 / 60); updateFx(1 / 60);
        if (KS.mode === 'air' && KS.stage === 'select' && KS.t > 0.75 && !window.__keepMap) ksConfirm();
      }
    };
    /* replays the call of a streak up to instant T, as in a match: weapon stowed, device out (arms restarted from zero) */
    window.__ks = (mode, T) => {
      for (const a of [KS.phone.arm, KS.rig.armR, KS.rig.armL]) { a._init = false; a._qs = null; }
      ksAbort(); clearAircraft(); MATCH.events.length = 0; VM.sling = 0; PL.ent.alive = true; MATCH.uav[0] = MATCH.uav[1] = 0;
      __view(); ksStart(mode); if (mode === 'air') { KS.map.x = 0; KS.map.z = 0; KS.map.yaw = 0; }
      __step(T); VM.holder.visible = VM.sling < 0.9;
    };
  });
  if (trial) await page.addScriptTag({ content: fs.readFileSync(trial, 'utf8') });
  // CSS animations run to their end (map opening): under software rendering, they do not always advance before the capture
  const shot = (f) => page.screenshot({ path: path.join(out, f), timeout: 240000, animations: 'disabled' });
  for (const m of modes.filter((m) => TIMES[m])) for (const T of (opt('times', '') ? opt('times').split(',').map(Number) : TIMES[m])) {
    await page.evaluate(([m, T]) => { __hide(true); __ks(m, T); if (KS.map.open) ksCloseMap(); }, [m, T]);
    await page.waitForTimeout(400);
    await shot(`${m}-${String(T).replace('.', '_')}.png`);
  }
  // strike map: the red zone, then the bombs falling in the disc, seen from above
  if (modes.includes('map')) {
    await page.evaluate(() => { __hide(false); window.__keepMap = true; __ks('air', 0.7); KS.map.x = 4; KS.map.z = -6; PL.ent.pos.set(0, 0, 0); drawTacMap(); });
    await page.waitForTimeout(900);
    await shot('strike-map.png');
    await page.evaluate(() => { __hide(true); ksConfirm(); window.__keepMap = false; __step(2.55); VM.root.visible = false; camera.position.set(4, 48, 12); camera.lookAt(4, 0, -6); camera.fov = 50; camera.updateProjectionMatrix(); });
    await page.waitForTimeout(300);
    await shot('strike-map-bombs.png');
  }
  // helicopter seen from outside: front three-quarter, side, from above, from behind and below
  if (modes.includes('helicopter')) {
    for (const [naming, cam] of [['face', [10, 3, -10]], ['sideView', [16, 0.5, 0.8]], ['top', [7, 10, 7]], ['below', [-9, -3, 12]]]) {
      await page.evaluate((cam) => {
        __hide(true); ksAbort(); VM.root.visible = false;
        if (!window.__hm) window.__hm = makeHeliMesh();
        const m = window.__hm; m.position.set(0, 30, 0); m.rotation.set(0.05, 0, 0, 'YXZ'); m.userData.rotor.rotation.y = 0.5;
        camera.position.set(cam[0], 30 + cam[1], cam[2]); camera.lookAt(0, 30.3, 0.8); camera.fov = 40; camera.updateProjectionMatrix();
      }, cam);
      await page.waitForTimeout(400);
      await shot(`helicopter-${naming}.png`);
    }
  }
  if (logs.length) console.log(logs.filter((l) => !l.includes('HDRI') && !l.includes('ERR_FILE_NOT_FOUND')).slice(0, 10).join('\n'));
  await browser.close();
})();
