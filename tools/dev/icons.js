/* "Maskable" icons and iPhone icon: node tools/dev/icons.js [previews folder]
   Android crops the maskable icon according to the phone model (circle, rounded square, teardrop...) and only guarantees the central disc
   (80% of the width, radius 40%): the image must therefore fill the WHOLE square, with no margin. The old version shrank the illustration onto
   a plain black background, hence the black fringe in the circle of a Pixel. Here: the full-page illustration, shifted down so that the helmet and
   face fit in the safe disc, its top edge extended by a blurred fade, a background made of the same very blurred image and the sharp image
   on top, its edge faded into a disc (the yellow corner brackets, which the cropping would cut, are gone). Same composition
   for the iPhone icon (iOS rounds the corners itself and refuses transparency).
   Source: assets/icon/icon-512.png (the "any" icon, square, full page). Writes assets/icon/maskable-512.png, maskable-192.png and
   apple-touch-icon.png; build.py fingerprints and copies them into dist/icons/. A preview with several crops (circle, rounded square,
   teardrop, Android's reduced circle) is written to the given folder. Chromium: Playwright's, or the CHROME variable. */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright-core');
const ROOT = path.join(__dirname, '..', '..'), ICON = path.join(ROOT, 'assets', 'icon');
const CHROME = process.env.CHROME || process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const out = process.argv[2];

/* Run in the page: composes the icon at 512 px, then scales it down to the requested sizes */
function compose({ src, sizes, preview }) {
  const load = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  return load(src).then((img) => {
    const N = 512, c = mk(N, N), g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    // 1. full-page illustration, shifted down by DY so that the helmet and face fit in the safe disc (radius 40%); the strip left at
    //    the top extends the illustration's top edge (blurred, faded into it)
    const DY = 50, comp = mk(N, N), cg = comp.getContext('2d');
    cg.imageSmoothingQuality = 'high';
    const band = mk(N, DY + 40), bg = band.getContext('2d');
    bg.filter = 'blur(16px)'; bg.drawImage(img, 0, 0, N, 3, -40, -40, N + 80, DY + 80); // top edge stretched upward, overflowing so as not to leave a transparent blurred edge
    cg.drawImage(band, 0, 0);
    const top = mk(N, N), tg = top.getContext('2d'); tg.drawImage(img, 0, DY, N, N);
    tg.globalCompositeOperation = 'destination-in';
    const fade = tg.createLinearGradient(0, DY, 0, DY + 36); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
    tg.fillStyle = fade; tg.fillRect(0, 0, N, N); // fade over the first 36 px of the illustration
    cg.drawImage(top, 0, 0);
    // 2. background: the same composition, very blurred (no plain black, colors identical to those of the sharp image); on top, the sharp image whose
    //    edge is faded into a disc: the yellow corner brackets (which a crop would cut) are gone, only a blurred glow remains
    g.fillStyle = '#15130b'; g.fillRect(0, 0, N, N); // opaque base: no transparent pixel, even at the edge
    g.save(); g.filter = 'blur(28px)'; g.drawImage(comp, -N * 0.08, -N * 0.08, N * 1.16, N * 1.16); g.restore();
    const fg = mk(N, N), fx = fg.getContext('2d'); fx.drawImage(comp, 0, 0);
    fx.globalCompositeOperation = 'destination-in';
    const gr = fx.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N * 0.5);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.74, 'rgba(0,0,0,1)'); gr.addColorStop(0.97, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    fx.fillStyle = gr; fx.fillRect(0, 0, N, N);
    g.drawImage(fg, 0, 0);
    // 3. soft vignette: the light stays in the center, the edges darken a little without turning black
    const v = g.createRadialGradient(N / 2, N / 2, N * 0.34, N / 2, N / 2, N * 0.78);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.25)');
    g.fillStyle = v; g.fillRect(0, 0, N, N);
    // downscale by halves (sharpness) then final adjustment
    const shrink = (t) => { let cur = c; while (cur.width / 2 >= t) { const n = mk(cur.width / 2, cur.width / 2), q = n.getContext('2d'); q.imageSmoothingQuality = 'high'; q.drawImage(cur, 0, 0, n.width, n.height); cur = n; } if (cur.width !== t) { const n = mk(t, t), q = n.getContext('2d'); q.imageSmoothingQuality = 'high'; q.drawImage(cur, 0, 0, t, t); cur = n; } return cur; };
    const res = {}; for (const t of sizes) res[t] = shrink(t).toDataURL('image/png');
    if (!preview) return { res };
    // preview: several crops on a neutral background, the safe zone (80%) dotted
    const P = 300, pv = mk(P * 4 + 50, P + 20), p = pv.getContext('2d'); p.fillStyle = '#6b7280'; p.fillRect(0, 0, pv.width, pv.height);
    const shapes = [
      (q, x, y, d) => { q.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2); },                                         // circle
      (q, x, y, d) => { const r = d * 0.3; q.roundRect(x, y, d, d, r); },                                               // rounded square
      (q, x, y, d) => { const r = d * 0.5; q.roundRect(x, y, d, d, [r, r, r, d * 0.12]); },                             // drop
      (q, x, y, d) => { const k = d * 0.833; q.arc(x + d / 2, y + d / 2, k / 2, 0, Math.PI * 2); },                     // reduced circle (Android's 72/108 window)
    ];
    shapes.forEach((sh, i) => {
      const x = 10 + i * (P + 10), y = 10; p.save(); p.beginPath(); sh(p, x, y, P); p.clip(); p.drawImage(c, x, y, P, P); p.restore();
      p.save(); p.setLineDash([5, 5]); p.strokeStyle = 'rgba(255,255,255,.55)'; p.beginPath(); p.arc(x + P / 2, y + P / 2, P * 0.4, 0, Math.PI * 2); p.stroke(); p.restore();
    });
    // share of plain black pixels (sum of channels under 15) on the outer ring of the circle: the old icon had 100%, a plain black background; here the black is that of the illustration's smoke
    const d = g.getImageData(0, 0, N, N).data; let dark = 0, n = 0, minA = 255; for (let i = 3; i < d.length; i += 4) if (d[i] < minA) minA = d[i];
    for (let a = 0; a < 360; a += 3) for (let r = 0.9; r <= 0.985; r += 0.01) {
      const x = Math.round(N / 2 + Math.cos(a * Math.PI / 180) * r * N / 2), y = Math.round(N / 2 + Math.sin(a * Math.PI / 180) * r * N / 2), i = (y * N + x) * 4;
      if (d[i] + d[i + 1] + d[i + 2] < 15) dark++; n++;
    }
    return { res, view: pv.toDataURL('image/png'), darkRing: dark / n, minA };
  });
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const pg = await b.newPage();
  await pg.setContent('<!doctype html><html><body></body></html>');
  const src = 'data:image/png;base64,' + fs.readFileSync(path.join(ICON, 'icon-512.png')).toString('base64');
  const r = await pg.evaluate(compose, { src, sizes: [512, 192, 180], preview: true });
  const put = (name, url) => fs.writeFileSync(path.join(ICON, name), Buffer.from(url.split(',')[1], 'base64'));
  put('maskable-512.png', r.res[512]); put('maskable-192.png', r.res[192]); put('apple-touch-icon.png', r.res[180]);
  console.log('icons written: maskable-512, maskable-192, apple-touch-icon');
  console.log(`share of plain black pixels on the outer ring of the circle: ${(r.darkRing * 100).toFixed(1)} %`);
  console.log(`minimum opacity of the icon: ${r.minA} out of 255 (255: no transparent pixel)`);
  if (out) { fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'icons-preview.png'), Buffer.from(r.view.split(',')[1], 'base64')); }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
