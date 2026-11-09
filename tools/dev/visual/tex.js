/* Exports procedural surfaces generated at load time (color and normals) as images, to tune them by eye.
   node tex.js [folder] name1,name2,... (TEXLAB names: boards, bark, snow...) */
const fs = require('fs'), path = require('path');
const { openGame, HERE } = require('./common');
const out = process.argv[2] || path.join(HERE, 'tex'), names = (process.argv[3] || 'boards').split(',');
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { browser, page, logs } = await openGame({ w: 480, h: 270, settings: { quality: 'high' }, noHdri: true });
  for (const n of names) {
    const r = await page.evaluate((n) => {
      const T = TEX[n]; if (!T || !T.rt) return null;
      const res = {};
      for (const [k, rt] of [['map', T.rt[0]], ['normal', T.rt[1]]]) {
        const w = rt.width, h = rt.height, px = new Uint8Array(w * h * 4); renderer.readRenderTargetPixels(rt, 0, 0, w, h, px);
        const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), img = g.createImageData(w, h);
        // color: alpha (relief or mask) is ignored for the preview
        for (let i = 0; i < w * h; i++) { img.data[i * 4] = px[i * 4]; img.data[i * 4 + 1] = px[i * 4 + 1]; img.data[i * 4 + 2] = px[i * 4 + 2]; img.data[i * 4 + 3] = 255; }
        g.putImageData(img, 0, 0); res[k] = c.toDataURL('image/png');
      }
      return res;
    }, n);
    if (!r) { console.log(n, ': unknown surface'); continue; }
    for (const [k, url] of Object.entries(r)) fs.writeFileSync(path.join(out, `${n}-${k}.png`), Buffer.from(url.split(',')[1], 'base64'));
    console.log(n, 'exported');
  }
  if (logs.length) console.log(logs.slice(0, 20).join('\n'));
  await browser.close();
})();
