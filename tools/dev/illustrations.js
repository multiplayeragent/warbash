/* Map illustrations for the menus (map selection, loading screen): a view of the scenery of each playable map,
   rendered by the game itself at High quality, saved in assets/maps/<id>.webp. build.py publishes it next
   to the page (dist/maps/), visible before any map loading.
   Rule: the scenery alone, no soldier or interface. The framing is that of the map definition (MAP_DEFS.<id>.art:
   cam, look, fov). Rerun after a visible change to a map.

   Installation (once):  cd tools/dev && npm install
   Usage (from the root):  python3 build.py && node tools/dev/illustrations.js [id ...] && python3 build.py
   Without an id: all playable maps. Chromium: Playwright's, or the CHROME environment variable.
   Rendered at 2560 x 1440 then downscaled to 1920 x 1080 (smoothed edges), with a light color grade and a soft vignette. */
const path = require('path'), fs = require('fs');
const DEV = __dirname, ROOT = path.join(DEV, '..', '..');
const W = 2560, H = 1440, OW = 1920, OH = 1080;
let chromium;
try { ({ chromium } = require('playwright-core')); } catch (e) { console.error('playwright-core not found: cd tools/dev && npm install'); process.exit(1); }

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const pg = await b.newPage({ bypassCSP: true, viewport: { width: W, height: H } });
    await pg.addInitScript("try{localStorage.setItem('dc_settings', JSON.stringify({quality:'high', sv:2, dynres:false, ao:true}));localStorage.setItem('cod_seen_version','99')}catch(e){}");
    pg.on('pageerror', (e) => console.error(String(e)));
    await pg.route('**/*', async (r) => {
      const u = r.request().url();
      if (u.includes('three@0.147.0/')) return r.fulfill({ path: path.join(DEV, 'node_modules/three', u.split('three@0.147.0/')[1]), contentType: 'application/javascript' });
      if (u.includes('@pmndrs/assets@1.7.0/')) return r.fulfill({ path: path.join(DEV, 'node_modules/@pmndrs/assets', u.split('@pmndrs/assets@1.7.0/')[1]), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } });
      if (u.includes('peerjs')) return r.fulfill({ body: 'window.Peer=function(){};', contentType: 'application/javascript' });
      if (u.startsWith('file:')) return r.continue();
      return r.abort();
    });
    await pg.goto('file://' + path.join(ROOT, 'dist', 'index.html'));
    await pg.waitForFunction("typeof MATCH!=='undefined' && MATCH.state==='menu'", null, { timeout: 600000, polling: 500 });
    const ids = process.argv.slice(2).length ? process.argv.slice(2) : await pg.evaluate(() => MAPS.filter((m) => m.ok).map((m) => m.id));
    fs.mkdirSync(path.join(ROOT, 'assets', 'maps'), { recursive: true });
    for (const id of ids) {
      process.stdout.write(`${id}… `);
      // map loaded, interface hidden, no soldier, render loop in capture mode
      const n0 = await pg.evaluate(async (id) => {
        await mapEnsure(id);
        const a = MAP_DEFS[id].art; if (!a) throw new Error('no framing (MAP_DEFS.' + id + '.art)');
        document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; });
        for (const e of entities) if (e.model) e.model.root.visible = false;
        VM.root.visible = false; MATCH.state = 'capture';
        camera.position.set(...a.cam); camera.lookAt(...a.look); camera.fov = a.fov || 60; camera.updateProjectionMatrix();
        for (const l of csm.lights) l.shadow.needsUpdate = true;
        return frameN;
      }, id);
      // a few full frames (shadow cascades recomputed, effects settled)
      await pg.waitForFunction((n0) => frameN >= n0 + 4, n0, { timeout: 900000, polling: 1000 });
      const png = await pg.screenshot({ timeout: 900000 });
      const url = await pg.evaluate(async ({ src, OW, OH }) => {
        const img = new Image(); img.src = src; await img.decode();
        const c = document.createElement('canvas'); c.width = OW; c.height = OH;
        const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
        g.filter = 'contrast(1.06) saturate(1.1)'; g.drawImage(img, 0, 0, OW, OH); g.filter = 'none';
        const v = g.createRadialGradient(OW / 2, OH * 0.48, OH * 0.35, OW / 2, OH * 0.48, OW * 0.62);
        v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.38)');
        g.fillStyle = v; g.fillRect(0, 0, OW, OH);
        return c.toDataURL('image/webp', 0.82);
      }, { src: 'data:image/png;base64,' + png.toString('base64'), OW, OH });
      const out = path.join(ROOT, 'assets', 'maps', id + '.webp');
      fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
      console.log(`${path.relative(ROOT, out)} (${Math.round(fs.statSync(out).size / 1024)} KB)`);
    }
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
