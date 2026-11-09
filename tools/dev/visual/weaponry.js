/* First-person weapon sheet: each weapon is equipped as in a match (hands, hip, aiming, reload) and
   photographed by the game's real rendering (post-processing included), without a map. Views "left", "right" and "top":
   the weapon alone (no hands) seen from the side, to judge the model.
   node weaponry.js [--folder d] [--weaponry m4,ak47|everything] [--viewList hip,ads,left,right,top,reload,inspect]
                 [--acc red,sil] [--camo desert] [--w 960] [--h 540] [--qualityOpt medium] [--trial filepath.js] [--mapKey chergui --pos x,y,z,heading]
   --trial: script run in the page before the views (try a setting without rebuilding the game); PAGE=other/version.html to
   compare with another version. --mapKey: on a real map (sky, scenery reflections, light halo) rather than on a gray background,
   the eye at --pos (meters, heading in degrees; 0, 1.6, 0 by default): to judge a shiny material (Holo camouflage).
   Output: <folder>/<weapon>-<view>.png; assemble with montage (ImageMagick) if needed. */
const fs = require('fs'), path = require('path');
const { openGame } = require('./common');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const out = opt('folder', path.join(__dirname, 'shots-weapons'));
const wanted = opt('weaponry', 'everything');
const views = opt('viewList', 'hip,ads,left,right,top').split(',');
const acc = opt('acc', ''), camo = opt('camo', '');
const W = +opt('w', 960), H = +opt('h', 540), mapKey = opt('mapKey', ''), pos = opt('pos', '0,1.6,0,0').split(',').map(Number);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { browser, page, logs } = await openGame({ w: W, h: H, settings: Object.assign({ quality: opt('qualityOpt', 'medium'), dynres: false }, mapKey ? { map: mapKey } : {}), noMap: !mapKey, noHdri: !mapKey, page: process.env.PAGE });
  if (opt('trial', '')) await page.addScriptTag({ content: fs.readFileSync(opt('trial', ''), 'utf8') });
  const ids = await page.evaluate((wanted) => (wanted === 'everything' ? Object.keys(WEAPONS) : wanted.split(',')), wanted);
  await page.evaluate(([mapKey, pos]) => {
    MATCH.state = 'capture';
    document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; });
    for (const e of entities) if (e.model) e.model.root.visible = false;
    VM.root.visible = true; VM.knifeRig.visible = false; VM.nadeRig.visible = false;
    if (!mapKey) { if (typeof sky !== 'undefined') sky.visible = false; scene.background = new THREE.Color(0x8a939c); }
    if (typeof skyMat !== 'undefined') skyMat.uniforms.uTime.value = 0;
    window.__weaponSetup = (id, spec, view) => {
      const def = typeof weaponDef === 'function' ? weaponDef(id, spec.acc, spec.camo) : WEAPONS[id];
      vmEquip(def); VM.holder.visible = true; VM.lower = 0; VM.lowerTarget = 0; VM.action = null;
      const S = { ads: view === 'ads', sprint: false, speed: 0, grounded: true, crouch: false, empty: false, lat: 0, fwd: 0, fire: false, wall: 0, slide: 0 };
      const free = view === 'left' || view === 'right' || view === 'top';
      camera.position.set(pos[0], pos[1], pos[2]); camera.rotation.set(0, (pos[3] || 0) * Math.PI / 180, 0, 'YXZ'); camera.fov = Settings.fov; camera.updateProjectionMatrix();
      vmCamera.position.set(0, 0, 0); vmCamera.rotation.set(0, 0, 0); vmCamera.up.set(0, 1, 0);
      for (let i = 0; i < 70; i++) updateViewmodel(1 / 30, S);
      VM.__S = S;
      if (free) {
        // weapon alone, side view: the hands are hidden, the camera turns around the mount
        setArmVisible(VM.arms.R, false); setArmVisible(VM.arms.L, false);
        VM.holder.position.set(0, 0, 0); VM.holder.rotation.set(0, 0, 0); VM.holder.updateMatrixWorld(true);
        const m = VM.cur, box = new THREE.Box3().setFromObject(m.group), c = box.getCenter(new V3()), sz = box.getSize(new V3());
        vmCamera.fov = 28; vmCamera.updateProjectionMatrix();
        const asp = vmCamera.aspect, t = Math.tan(THREE.MathUtils.degToRad(14));
        const d = Math.max(view === 'top' ? sz.z : sz.z, (view === 'top' ? sz.x : sz.y) * asp) / 0.82 / (2 * t * asp) * 1.0;
        if (view === 'right') vmCamera.position.set(c.x + d, c.y, c.z); else if (view === 'left') vmCamera.position.set(c.x - d, c.y, c.z); else { vmCamera.position.set(c.x, c.y + d, c.z + 0.001); }
        vmCamera.lookAt(c);
        VM.__free = true;
      } else {
        // first-person field of view as in a match (08-player.js): 44° when aiming, less for a magnifying optic (vmFovAt); without
        // which the reticle looks smaller than in game
        vmCamera.fov = typeof vmFovAt === 'function' ? vmFovAt(VM.fovHip, VM.ads) : VM.fovHip + (44 - VM.fovHip) * VM.ads; vmCamera.updateProjectionMatrix();
        VM.__free = false;
      }
    };
    window.__weaponStep = (view) => {
      if (VM.__free) return;
      const S = VM.__S; if (!S) return;
      updateViewmodel(1 / 60, S);
    };
  }, [mapKey, pos]);
  for (const id of ids) {
    for (const view of views) {
      await page.evaluate(([id, spec, view]) => window.__weaponSetup(id, spec, view), [id, { acc: acc ? acc.split(',') : [], camo: camo || null }, view]);
      if (view === 'reload' || view === 'inspect') {
        // frozen at 4 instants of the action: restart it, set its clock, a single update applies the pose
        for (const f of [0.2, 0.4, 0.6, 0.8]) {
          await page.evaluate(([view, f]) => {
            const T = view === 'reload' ? VM.curDef.reload : 3.3;
            vmStartAction(view === 'reload' ? 'reload' : 'inspect', T, { empty: false });
            VM.actionT = T * f - 0.0006; VM.actionDur = T;
            updateViewmodel(0.0005, VM.__S); VM.popO.fill(0); VM.popV.fill(0); VM.viewKickO.fill(0); VM.viewKickV.fill(0); updateViewmodel(0.0005, VM.__S); // without chaining spring or shock (pose of the instant alone)
          }, [view, f]);
          await page.waitForTimeout(200);
          await page.screenshot({ path: path.join(out, `${id}-${view}-${String(f).replace('.', '_')}.png`), timeout: 240000 });
        }
        continue;
      }
      await page.waitForTimeout(250);
      await page.evaluate((view) => window.__weaponStep(view), view);
      await page.screenshot({ path: path.join(out, `${id}-${view}.png`), timeout: 240000 });
    }
  }
  const bad = logs.filter((l) => !l.includes('HDRI'));
  if (bad.length) console.log(bad.slice(0, 15).join('\n'));
  await browser.close();
})();
