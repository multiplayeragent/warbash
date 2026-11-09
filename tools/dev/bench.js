/* Render measurement bench (optional), to check that a change does not cost more than before.

   Loads one or more built versions of the game in headless Chromium, with the SwiftShader software
   renderer, starts a match, freezes it, places the soldiers in front of the camera and times each render pass
   (GPU synchronization after each pass) from four fixed viewpoints. SwiftShader computes on the CPU
   what a graphics card would do: the milliseconds have nothing to do with those of a real GPU, but the
   proportions (number of pixels × shader cost, vertices) follow those of an integrated chip. So two
   versions are compared with each other, under the same conditions, never isolated figures.

   Installation (once):  cd tools/dev && npm install
   Usage (from the root):  node tools/dev/bench.js [version.html ...] [--quality medium] [--size 1280x720]
                               [--images 4] [--views street,square,sun,roof] [--map chergui] [--grass 0]   (souk view: under the awnings of the Chergui souk)
   --grass 0: "Relief grass" setting turned off (cost of the grass blades: same version measured with and without).
   Without a file: dist/index.html. With two files, the second column gives the difference in %. To compare
   with the published version: git show HEAD:dist/index.html > /tmp/before.html, then
   node tools/dev/bench.js /tmp/before.html dist/index.html.
   Chromium: Playwright's, or the path given by the CHROME environment variable. */
const path = require('path'), fs = require('fs');
const DEV = __dirname, ROOT = path.join(DEV, '..', '..');
let chromium;
try { ({ chromium } = require('playwright-core')); } catch (e) { console.error('playwright-core not found: cd tools/dev && npm install'); process.exit(1); }

const opt = { quality: 'medium', size: '1280x720', images: '4', views: 'street,square,sun,roof', map: 'chergui', grass: '1' }, files = [];
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) opt[a.slice(2)] = process.argv[++i]; else files.push(path.resolve(a));
}
if (!files.length) files.push(path.join(ROOT, 'dist', 'index.html'));
const [W, H] = opt.size.split('x').map(Number), N = Math.max(1, +opt.images);
const LABELS = { DepthPrepass: 'prepass', ScenePass: 'scene', RenderPass: 'weapon', SSAOPass: 'occlusion', UnrealBloomPass: 'halo', RaysPass: 'rays', ShaderPass: 'final' };

async function measure(file) {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const pg = await b.newPage({ bypassCSP: true, viewport: { width: W, height: H } });
    await pg.addInitScript(`try{localStorage.setItem('dc_settings', JSON.stringify({quality:${JSON.stringify(opt.quality)}, sv:2, dynres:false, grass:${opt.grass !== '0'}}));localStorage.setItem('cod_seen_version','99')}catch(e){}window.MATCH_COUNTDOWN=0`); // (without the start countdown: the match is frozen right away)
    const errors = [];
    pg.on('pageerror', (e) => errors.push(String(e)));
    pg.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|ERR_FILE_NOT_FOUND/.test(m.text())) errors.push(m.text()); });
    // libraries served from tools/dev/node_modules (same versions as jsDelivr), nothing else goes out
    await pg.route('**/*', async (r) => {
      const u = r.request().url();
      if (u.includes('three@0.147.0/')) return r.fulfill({ path: path.join(DEV, 'node_modules/three', u.split('three@0.147.0/')[1]), contentType: 'application/javascript' });
      if (u.includes('@pmndrs/assets@1.7.0/')) return r.fulfill({ path: path.join(DEV, 'node_modules/@pmndrs/assets', u.split('@pmndrs/assets@1.7.0/')[1]), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } });
      if (u.includes('peerjs')) return r.fulfill({ body: 'window.Peer=function(){};', contentType: 'application/javascript' });
      if (u.startsWith('file:')) return r.continue();
      return r.abort();
    });
    const t0 = Date.now();
    await pg.goto('file://' + file);
    await pg.waitForFunction("typeof MATCH!=='undefined' && MATCH.state==='menu'", null, { timeout: 600000, polling: 500 });
    const load = (Date.now() - t0) / 1000;
    // the map is only built when a match starts (older versions built it at startup)
    const tMap = Date.now();
    await pg.evaluate((id) => (typeof mapEnsure === 'function' ? mapEnsure(id) : null), opt.map);
    const mapLoad = (Date.now() - tMap) / 1000;
    const res = await pg.evaluate(({ N, views }) => {
      const gl = renderer.getContext();
      // real synchronization with the GPU: barrier, then reading one pixel of a small separate target
      const fb = gl.createFramebuffer(), tex = gl.createTexture(), px = new Uint8Array(4);
      gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); renderer.state.reset();
      const sync = () => { const prev = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fb); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, prev); };
      startMatch();
      // bots' weapons (and so outfits) fixed: the botArmForMap draw is random, and from one version to another the camera would see other models
      const ARMS = ['m4', 'ak47', 'mp5', 'scarh', 'l96', 'ump45', 'famas', 'rem870', 'mp7', 'm4', 'svd'];
      entities.filter((e) => !e.isPlayer).forEach((b, i) => {
        const def = WEAPONS[ARMS[i % ARMS.length]]; if (!def) return;
        if (b.weapon !== def) { b.weapon = def; setSoldierGun(b.model, def.key); }
        if (typeof skinOfWeapon === 'function') { b.skin = skinOfWeapon(def); soldierLook(b.model, b.skin, skinRel(b)); }
      });
      // match frozen: the animation loop no longer renders anything ("menu" state), the rendering is driven here
      for (const e of entities) if (!e.isPlayer) e.respawnT = 1e9;
      MATCH.state = 'menu'; UI.screen = 'main';
      // "sun" viewpoint: first clear spot (fixed draw) from which the sun is visible
      // map with relief (dunes, versions that have them): the heights of the viewpoints and soldiers are counted above the sand
      const g0 = (x, z) => (typeof gy0 === 'function' ? gy0(x, z) : 0), up = (p) => [p[0], p[1] + g0(p[0], p[2]), p[2]];
      const r = mulberry32(3); let sun = null;
      for (let i = 0; i < 4000 && !sun; i++) {
        const x = lerp(MAP.x0 + 3, MAP.x1 - 3, r()), z = lerp(MAP.z0 + 3, MAP.z1 - 3, r()), g = g0(x, z);
        if (Math.abs(groundHeight(x, z, g + 3, 0.2) - g) < 0.05 && !rayWorld(x, g + 1.7, z, SUN_DIR.x, SUN_DIR.y, SUN_DIR.z, 200)) sun = [x, z];
      }
      const ALL = {
        street: [[0, 1.7, 20], [0, 1.6, -10]],
        square: [[-12, 1.7, 0], [15, 2, 5]],
        sun: sun ? [[sun[0], 1.7, sun[1]], [sun[0] + SUN_DIR.x * 10 + 3, 1.7 + SUN_DIR.y * 10 - 0.6, sun[1] + SUN_DIR.z * 10]] : [[0, 1.7, 20], [0, 1.6, -10]],
        roof: [[5, 9, 12], [-10, 2, -10]],
        souk: [[7, 1.7, 3.6], [15, 2.6, -2.5]], // (Chergui) under the stretched awnings of the souk: --views souk
      };
      const T = {};
      const wrap = (obj, key, label) => { const f = obj[key].bind(obj); obj[key] = function (...a) { sync(); const t = performance.now(); const out = f(...a); sync(); T[label] = (T[label] || 0) + performance.now() - t; return out; }; };
      composer.passes.forEach((p) => wrap(p, 'render', p.constructor.name));
      wrap(renderer.shadowMap, 'render', 'shadows');
      const bots = entities.filter((e) => !e.isPlayer), out = [];
      for (const name of views) {
        const v0 = ALL[name]; if (!v0) continue;
        const v = v0.map(up);
        camera.position.set(...v[0]); camera.lookAt(...v[1]);
        const f = camera.getWorldDirection(new THREE.Vector3()); f.y = 0; f.normalize();
        // soldiers spread out in front of the camera, from 6 to 41 m
        bots.forEach((e, i) => {
          const d = 6 + i * 3.5, s = (i % 2 ? 1 : -1) * (1 + i * 0.4);
          e.alive = true; e.model.root.visible = true; e.yaw = Math.atan2(f.x, f.z);
          const ex = v[0][0] + f.x * d - f.z * s, ez = v[0][2] + f.z * d + f.x * s;
          e.pos.set(ex, g0(ex, ez), ez);
          for (let k = 0; k < 10; k++) animSoldier(e, 0.03);
        });
        const times = []; let calls = 0, tris = 0;
        for (let i = 0; i < N + 2; i++) {
          if (i === 2) for (const k in T) delete T[k]; // two warm-up frames (compilations, shadow maps)
          renderer.info.reset(); updatePostFx(); sky.position.copy(camera.position); updateSoldierLods(); updateShadows();
          if (typeof grassUpdate === 'function') grassUpdate(i * 0.016); // grass blades of the lawns (versions that have them)
          sync(); const t = performance.now(); composer.render(0.016); sync();
          if (i >= 2) times.push(performance.now() - t);
          calls = renderer.info.render.calls; tris = renderer.info.render.triangles;
        }
        times.sort((a, b) => a - b);
        const per = {}; for (const k in T) per[k] = T[k] / N;
        out.push({ name, ms: times[times.length >> 1], calls, ktris: Math.round(tris / 1000), per });
      }
      return { out, tier: RQ.tier, rpr: renderPixelRatio(), programs: renderer.info.programs.length, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries, build: (document.querySelector('meta[name="cod-build"]') || {}).content };
    }, { N, views: opt.views.split(',') });
    return Object.assign(res, { load, mapLoad, errors, file });
  } finally { await b.close(); }
}

const pct = (a, b) => (a > 0 ? `${b >= a ? '+' : ''}${Math.round((b / a - 1) * 100)} %` : '');
(async () => {
  const R = [];
  for (const f of files) {
    if (!fs.existsSync(f)) { console.error('not found: ' + f); process.exit(1); }
    process.stdout.write(`measuring ${path.relative(process.cwd(), f)}… `);
    const r = await measure(f); R.push(r);
    console.log(`startup ${r.load.toFixed(1)} s${r.mapLoad > 0.5 ? `, map ${r.mapLoad.toFixed(1)} s` : ''}, profile ${r.tier}, render x${r.rpr}, ${r.programs} programs, ${r.textures} textures, ${r.geometries} geometries`);
    if (r.errors.length) console.log('  errors:\n  ' + r.errors.slice(0, 5).join('\n  '));
  }
  console.log(`\nSwiftShader ${W}x${H}, quality ${opt.quality}, median of ${N} frames (ms: proportions, not real fps)`);
  const A = R[0], B = R[1];
  for (let i = 0; i < A.out.length; i++) {
    const a = A.out[i], b = B && B.out[i];
    const line = (o) => { const p = o.per, scene = (p.ScenePass || 0) - (p.shadows || 0); return [['image', o.ms], ['shadows', p.shadows], ['scene', scene], ...Object.keys(LABELS).filter((k) => k !== 'ScenePass' && p[k] !== undefined).map((k) => [LABELS[k], p[k]])]; };
    const la = line(a), lb = b ? line(b) : null;
    console.log(`\n${a.name.padEnd(8)} ${a.calls} calls, ${a.ktris} k triangles` + (b ? `  →  ${b.calls} calls, ${b.ktris} k triangles (${pct(a.ktris, b.ktris)})` : ''));
    la.forEach(([k, v], j) => console.log(`  ${k.padEnd(10)} ${v.toFixed(1).padStart(8)} ms` + (lb ? `  →  ${lb[j][1].toFixed(1).padStart(8)} ms  ${pct(v, lb[j][1]).padStart(6)}` : '')));
  }
})().catch((e) => { console.error(e); process.exit(1); });
