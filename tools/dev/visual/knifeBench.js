/* Contact sheet of the first-person knife strike: the motion is frozen at fixed instants (0 = wound up, 1 = return)
   and photographed, then assembled with ImageMagick (montage). node knifeBench.js [folder] [instants=0,0.15,...] ; QUALITY_LEVEL=high ; HELD=1: the knife held in hand
   (draw, rest, run in eight instants of a stride, then the same strike made from that pose) ; SHOT_SIZE=740x360 for a phone screen. */
const fs = require('fs'), path = require('path');
const { openGame } = require('./common');
const out = process.argv[2] || path.join(__dirname, 'shots');
const times = (process.argv[3] || '0,0.12,0.24,0.36,0.46,0.58,0.75,1').split(',').map(Number);
const HELD = !!process.env.HELD, [SW, SH] = (process.env.SHOT_SIZE || '960x540').split('x').map(Number);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { browser, page, logs } = await openGame({ w: SW, h: SH, settings: { quality: process.env.QUALITY_LEVEL || 'medium', difficulty: 1, map: process.env.MAP || 'chergui' }, noHdri: true });
  await page.evaluate(() => {
    LOCK.fallback = true; startMatch({}); MATCH.state = 'capture';
    document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; });
    for (const e of entities) if (!e.isPlayer) e.model.root.visible = false;
    VM.holder.visible = false; VM.root.visible = true;
    camera.position.set(0, 1.6, 20); camera.lookAt(0, 1.5, 0); camera.fov = Settings.fov; camera.updateProjectionMatrix();
  });
  // each frame: the state passed to updateRigs (S), the stride phase (bob: without a phase, the hand does not swing); the game's own sway (updateViewmodel) is not played
  const snap = async (name, S, bob) => {
    await page.evaluate(([S, bob]) => {
      VM.holder.visible = false; VM.root.visible = true; VM.knifeRig.visible = true;
      VM.handDt = 1; // the fingers reach their pose right away (updateViewmodel, which advances their time, is not played)
      VM.bobAmt = bob ? 1.2 : 0; VM.bobT = bob || 0; VM.bobO.set(0, 0, 0); VM.bobR.set(0, 0, 0);
      for (let i = 0; i < 3; i++) updateRigs(1 / 60, Object.assign({ knifeT: 0, nadeState: null, nadeT: 0, cookT: 0 }, S));
    }, [S, bob]);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(out, name + '.png'), timeout: 240000 });
  };
  const dur = await page.evaluate(() => KNIFE_DUR), tag = (T) => String(T).replace('.', '_');
  if (HELD) {
    for (const h of [0.6, 0.8, 1]) await snap(`hand-out-${tag(h)}`, { knifeHold: h });
    for (let i = 0; i < 8; i++) await snap(`main-course-${i}`, { knifeHold: 1, sprint: 1 }, (i * Math.PI) / 4 + 0.001);
    for (const T of times) await snap(`main-coup-${tag(T)}`, { knifeHold: 1, knifeNew: true, knifeT: Math.max(0.0001, dur * (1 - T)) });
  } else for (const T of times) await snap(`knife-${tag(T)}`, { knifeT: Math.max(0.0001, dur * (1 - T)) });
  if (logs.length) console.log(logs.filter((l) => !l.includes('HDRI')).slice(0, 10).join('\n'));
  await browser.close();
})();
