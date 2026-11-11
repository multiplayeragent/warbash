/* Contact sheets of the outfits for review (lead and judge): for each outfit, in the studio of the Outfits screen (09u-outfits.js) on a neutral
   gray background, soldier standing, weapon lowered, cloth settled in the studio breeze: front, three-quarter (from his right) and back as allies
   see it, and the front as enemies see it (dark hue, red bands); same camera, same scale for every outfit. One sheet per outfit (<id>.png), plus
   all-front.png (the challenge outfits side by side, front view) and tris.json (triangles per outfit: detailed model, its simulated cloth,
   lightweight model).
   node tools/dev/visual/outfits-sheet.js [folder] ; OUTFITS=nomad,dune (default: the challenge outfits) ; GPU=hw recommended */
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const { openGame, HERE } = require('./common');
const out = process.argv[2] || path.join(HERE, 'shots', 'outfits-sheet');
const VIEWS = [['front', 0, 0], ['three-quarter', 0.75, 0], ['back', 3.14, 0], ['enemy front', 0, 1]];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { browser, page, logs } = await openGame({ w: 1100, h: 1000, settings: { quality: 'high', map: 'chergui' }, noMap: true, noHdri: true, page: process.env.PAGE });
  await page.evaluate(() => uiOpen('skins', ['main']));
  await page.waitForFunction(() => MBG.live && SKV.live, null, { timeout: 120000, polling: 500 });
  const skins = process.env.OUTFITS ? process.env.OUTFITS.split(',') : await page.evaluate(() => SKIN_CHALLENGE.slice());
  const box = await page.evaluate(() => {
    GPUX.halt = true; // game loop suspended: each frame is rendered here
    const f = skinLivePose;
    skinLivePose = (M, key, d) => { const e = skinLiveEnt(M, key); e.arms.adsW = 0; f(M, key, d, false); }; // standing, weapon lowered
    // neutral studio: flat gray gradient, gray floor ring and rim light
    const S = skinStudio(), bg = S.bg.children[0].material;
    bg.fragmentShader = 'uniform vec2 uRes; uniform vec3 uTint; varying vec2 vS; void main() { float d = length(vS - vec2(0.5, 0.6)); gl_FragColor = vec4(vec3(0.36, 0.365, 0.37) - 0.08 * d, 1.0); }';
    bg.needsUpdate = true; SK_TINT.setRGB(0.75, 0.75, 0.75);
    window.__rel = 0;
    // enemy view: the soldier's meshes take their own material (dark hue, red bands), the preview's own is left as is
    window.__enemy = (on) => {
      const M = skinLiveModel(SKV.view), m0 = skinPvMat(SKV.view);
      if (on && !window.__m2) { const m2 = window.__m2 = gearMaterial(SKV.view, 'pv'); skinTone(SKV.view, 1, m2.color); skinRelColor(1, m2.userData.skU.tag.value); }
      M.root.traverse((o) => { if (o.isMesh) o.material = on ? window.__m2 : m0; });
      if (!on && window.__m2) { window.__m2.dispose(); window.__m2 = null; }
    };
    vwCamPlace = (cam) => {
      const M = skinLiveModel(SKV.view), B = M.bones, t = new THREE.Vector3(B[SB.PEL].position.x, 0.93, B[SB.PEL].position.z), az = window.__az, dist = 3.1;
      cam.position.set(t.x + Math.sin(az) * dist, t.y + 0.2, t.z - Math.cos(az) * dist); cam.up.set(0, 1, 0); cam.lookAt(t); cam.fov = 38; cam.updateProjectionMatrix();
    };
    const r = $('skView').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height };
  });
  const tris = {};
  for (const sk of skins) {
    const T = await page.evaluate((sk) => {
      window.__az = 0; window.__rel = 0; skinView(sk); SKV.a = 0;
      for (let i = 0; i < 90; i++) { SKV.acc = 1 / 30; skinLiveDraw(); }
      const n = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3, C = clothTpl(sk);
      return { hi: n(soldierGeometry(sk, 'hi')), cloth: C ? (C.rtri.length / 3) * 2 + (C.sat ? C.sat.tri.length / 3 : 0) : 0, lo: n(soldierGeometry(sk, 'lo')) };
    }, sk);
    tris[sk] = T;
    const files = [];
    for (const [nm, az, rel] of VIEWS) {
      await page.evaluate(([az, rel]) => { window.__az = az; window.__enemy(!!rel); for (let i = 0; i < 3; i++) { SKV.acc = 1 / 30; skinLiveDraw(); } }, [az, rel]);
      const f = path.join(out, `_${sk}-${nm.replace(' ', '-')}.png`); await page.screenshot({ path: f, clip: box, timeout: 240000 }); files.push([f, nm]);
    }
    const name = await page.evaluate((sk) => { window.__enemy(false); return SKINS[sk].name; }, sk);
    execFileSync('python', ['-c', `
import sys, json
from PIL import Image, ImageDraw, ImageFont
a = json.loads(sys.argv[2]); ims = []
try: font = ImageFont.truetype('arial.ttf', 22); big = ImageFont.truetype('arialbd.ttf', 30)
except Exception: font = big = None
for f, nm in a['files']:
    im = Image.open(f).convert('RGB'); s = 760 / im.size[1]; im = im.resize((int(im.size[0] * s), 760)); ImageDraw.Draw(im).text((10, 8), nm, fill=(255, 255, 255), font=font); ims.append(im)
W = ims[0].size[0]; o = Image.new('RGB', (W * len(ims), 820), (40, 40, 42)); d = ImageDraw.Draw(o)
d.text((12, 12), a['title'], fill=(255, 255, 255), font=big)
for i, im in enumerate(ims): o.paste(im, (i * W, 60))
o.save(sys.argv[1])`, path.join(out, `${sk}.png`), JSON.stringify({ files, title: `${name}  (${sk})   triangles: ${T.hi} + cloth ${T.cloth} near, ${T.lo} far` })]);
    console.log('sheet', sk, JSON.stringify(T));
  }
  fs.writeFileSync(path.join(out, 'tris.json'), JSON.stringify(tris, null, 1));
  // all side by side, front view (ally), in the order of the Outfits screen
  if (!process.env.OUTFITS) execFileSync('python', ['-c', `
import sys, json
from PIL import Image, ImageDraw, ImageFont
a = json.loads(sys.argv[2]); n = len(a); cols = 13 if n > 13 else n; rows = (n + cols - 1) // cols
try: font = ImageFont.truetype('arialbd.ttf', 18)
except Exception: font = None
ims = []
for f, nm in a:
    im = Image.open(f).convert('RGB'); w, h = im.size; im = im.crop((int(w * 0.18), 0, int(w * 0.82), h)); s = 520 / im.size[1]; im = im.resize((int(im.size[0] * s), 520)); ImageDraw.Draw(im).text((6, 6), nm, fill=(255, 255, 255), font=font); ims.append(im)
W = ims[0].size[0]; o = Image.new('RGB', (W * cols, 520 * rows), (40, 40, 42))
for i, im in enumerate(ims): o.paste(im, ((i % cols) * W, (i // cols) * 520))
o.save(sys.argv[1])`, path.join(out, 'all-front.png'), JSON.stringify(await page.evaluate((L) => L.map((s) => [s, SKINS[s].name]), skins).then((L) => L.map(([s, nm]) => [path.join(out, `_${s}-front.png`), nm])))]);
  for (const f of fs.readdirSync(out)) if (f.startsWith('_')) fs.unlinkSync(path.join(out, f));
  const errs = logs.filter((l) => !l.includes('HDRI') && !l.includes('FILE_NOT_FOUND')); if (errs.length) console.log(errs.slice(0, 5).join('\n'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(2); });
