/* ==========================================================================
   ANIMATED MENU BACKGROUND: the 21:9 illustration (assets/menu-bg.webp, CSS variable --key-art of #menuBg set by the page shell) and its
   depth map (assets/menu-depth.webp, window.BASE_ASSETS.depth: see build.py), drawn by a single fullscreen triangle in the game canvas, during the frame loop
   (frame, 09-game.js), as long as a menu screen is displayed.
   - Parallax: the camera makes a 24 s loop on a Lissajous curve (and follows the mouse a little) around the soldier, who stays the fixed
     plane: only the sky (by 0.6% of the width at most) and the foreground rocks a little shift, according to their depth (four reads
     of the depth map, dilated by 24 px then blurred during preparation: the transition falls in the clouds, around the silhouette,
     and the soldier doesn't tear), with a 40 s dolly in and out (3.5 to 4.7% magnification) that always keeps a margin
     under the shifts.
   - Smoke: two layers of tileable noise (128 px texture computed at startup), scrolling in opposite directions, denser at the bottom;
     it takes the color of the image's halo (96 px wide copy, blurred): yellow in front of the light, gray elsewhere.
   - Embers: three layers of randomly drawn cells that rise while drifting, twinkle and are born mostly near the light.
   Cost: 8 texture reads and a bit of math per pixel, no render target, no shadow map, 4 texture units; 30 frames per
   second on touch and on sub-screens (the movement is slow), nothing while a map loads (MAPL.state) or in the aerial view.
   Fallback: the still image of #menuBg (CSS, cover) as long as the background hasn't been drawn, if the WebGL context is lost, in economy
   graphics mode. Reduced motion (prefers-reduced-motion): still image drawn once, with no moving smoke or embers.
   The soldier is at about 72% of the image width: on a screen narrower than the image (3:2), the framing places him at 70% of the screen width
   (MBG_FOCUS), the buttons keep the dark sky on the left; on a wider screen, the image is cropped at top and bottom.
   ========================================================================== */
const MENU_DEPTH = (window.BASE_ASSETS || {}).depth || ''; // base (build.py)
const MBG = { scene: null, cam: null, mat: null, ready: false, failed: false, t: 0, acc: 0, live: false, px: 0, py: 0, mx: 0, my: 0, drawn: '' };
const MBG_IMG_A = 1536 / 1024; // aspect ratio of the illustration (3:2, assets/menu-bg.webp)
const MBG_FOCUS = { x: 0.72, at: 0.7 }; // soldier: 72% of the image width, placed at 70% of the screen width
const MBG_VS = `varying vec2 vS;
void main() { vS = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const MBG_FS = `uniform sampler2D tCol, tDep, tGlow, tNoise;
uniform vec4 uMap; // framing: scale and offset from the screen (0..1) to the image
uniform vec2 uPar, uRes; uniform float uZoom, uT, uFx, uMove, uShade;
varying vec2 vS;
float h12(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
// one layer of embers: cells of size 1/k (screen height), one in eight lit, rising at speed v while drifting
vec3 ember(vec2 q, float k, float v, float s) {
  vec2 p = q * k; p.y -= uT * v; p.x -= uT * v * 0.35 + sin(p.y * 0.7 + s) * 0.3;
  vec2 c = floor(p), f = fract(p); float h = h12(c + s);
  if (h < 0.875) return vec3(0.0);
  vec2 o = vec2(h12(c + s + 7.13), h12(c + s + 3.71)) * 0.6 + 0.2;
  float r = (0.05 + 0.06 * h12(c + 1.7)) * (8.0 / k), fl = 0.55 + 0.45 * sin(uT * (2.0 + h * 9.0) + h * 61.0);
  float life = smoothstep(0.0, 0.25, fract(h * 13.7 + uT * 0.05)) * smoothstep(1.0, 0.7, fract(h * 13.7 + uT * 0.05));
  return mix(vec3(1.0, 0.55, 0.12), vec3(1.0, 0.88, 0.45), h12(c + 9.1)) * smoothstep(r, r * 0.2, length(f - o)) * fl * life;
}
void main() {
  vec2 uv = uMap.xy * vS + uMap.zw;
  uv = (uv - vec2(0.72, 0.45)) / uZoom + vec2(0.72, 0.45);
  // parallax: offset proportional to the depth difference from the focal plane (0.65: the soldier, who doesn't move), found by
  // successive approximations (four reads: the depth taken where the pixel really comes from, with no tearing at the soldier's edge)
  vec2 u = uv;
  for (int i = 0; i < 4; i++) u = clamp(uv + uPar * (texture2D(tDep, u).r - 0.65), 0.002, 0.998);
  vec3 col = texture2D(tCol, u).rgb;
  vec3 glow = texture2D(tGlow, u).rgb;
  // smoke: two noise layers, denser at ground level, tinted by the image's halo
  float A = uRes.x / uRes.y; vec2 q = vS * vec2(A, 1.0);
  float n1 = texture2D(tNoise, q * 0.42 + vec2(uT * 0.016, -uT * 0.005)).r;
  float n2 = texture2D(tNoise, q * 1.05 + vec2(-uT * 0.024, uT * 0.008) + n1 * 0.35).g;
  float sm = smoothstep(0.38, 0.95, n1 * 0.62 + n2 * 0.5);
  float dens = sm * (0.22 + 0.78 * (1.0 - smoothstep(0.0, 0.6, vS.y))) * uFx;
  vec3 smoke = vec3(0.055, 0.05, 0.04) + glow * 1.35;
  col = mix(col, smoke, dens * 0.42) + glow * dens * 0.16;
  // embers: mostly near the light
  float lum = dot(glow, vec3(0.3, 0.55, 0.15));
  vec3 e = ember(q, 7.0, 0.11, 1.0) + ember(q, 11.0, 0.075, 4.0) * 0.8 + ember(q, 17.0, 0.05, 9.0) * 0.55;
  col += e * uFx * uMove * (0.25 + 1.6 * lum);
  // light vignette and grain against banding in dark gradients
  vec2 v = (vS - 0.5) * vec2(1.0, 1.2);
  col *= 1.0 - 0.28 * smoothstep(0.35, 0.95, length(v));
  col += (texture2D(tNoise, gl_FragCoord.xy / 128.0).b - 0.5) / 160.0;
  // sub-screen veil (that of .ui-shade, shell.html), applied here when the Outfits screen preview is drawn over the background
  float sa = vS.x < 0.5 ? mix(0.9, 0.76, vS.x * 2.0) : mix(0.76, 0.6, vS.x * 2.0 - 1.0);
  col = mix(col, vec3(0.0157, 0.0196, 0.0157), sa * uShade);
  gl_FragColor = vec4(col, 1.0);
}`;
/* Tileable 128 x 128 noise: R and G two value-noise fbm (periods 4 to 32 cells), B white noise (grain) */
function mbgNoise() {
  const N = 128, d = new Uint8Array(N * N * 4);
  const fbm = (seed) => {
    const out = new Float32Array(N * N);
    let amp = 0.5, tot = 0;
    for (const g of [4, 8, 16, 32]) {
      const lat = new Float32Array(g * g); for (let i = 0; i < lat.length; i++) lat[i] = mbgHash(i * 7.31 + seed * 131.7 + g * 17.9);
      const s = N / g;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const fx = x / s, fy = y / s, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), x1 = (x0 + 1) % g, y1 = (y0 + 1) % g;
        const a = lat[y0 * g + x0], b = lat[y0 * g + x1], c = lat[y1 * g + x0], e = lat[y1 * g + x1];
        out[y * N + x] += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + e) * sx * sy);
      }
      tot += amp; amp *= 0.5;
    }
    for (let i = 0; i < out.length; i++) out[i] /= tot;
    return out;
  };
  const r = fbm(1), g = fbm(2);
  for (let i = 0; i < N * N; i++) { d[i * 4] = r[i] * 255; d[i * 4 + 1] = g[i] * 255; d[i * 4 + 2] = mbgHash(i * 3.17 + 0.5) * 255; d[i * 4 + 3] = 255; }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}
function mbgHash(x) { const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); }
function mbgTex(src) { const t = new THREE.Texture(src); t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true; return t; }
function mbgLoad(url) { return new Promise((ok, ko) => { const im = new Image(); im.onload = () => ok(im); im.onerror = ko; im.src = url; }); }
/* Motion: not in economy mode, nor when the system asks for fewer animations */
function mbgMotion() { return !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches); }
async function mbgInit() {
  if (MBG.scene || MBG.failed) return;
  if (Settings.gfxSafe || !MENU_DEPTH) { MBG.failed = true; return; }
  const m = /url\(["']?(.*?)["']?\)/.exec(getComputedStyle($('menuBg')).backgroundImage || '');
  if (!m) { MBG.failed = true; return; }
  MBG.scene = new THREE.Scene(); // reserved right away: a single call
  try {
    const [ci, di] = await Promise.all([mbgLoad(m[1]), mbgLoad(MENU_DEPTH)]);
    // halo: the image reduced to 96 px wide (two successive reductions, which blur it), read with linear filtering
    const c1 = document.createElement('canvas'); c1.width = 240; c1.height = Math.round(240 / MBG_IMG_A);
    c1.getContext('2d').drawImage(ci, 0, 0, c1.width, c1.height);
    const c2 = document.createElement('canvas'); c2.width = 48; c2.height = Math.round(48 / MBG_IMG_A);
    c2.getContext('2d').drawImage(c1, 0, 0, c2.width, c2.height);
    MBG.mat = new THREE.ShaderMaterial({
      uniforms: { tCol: { value: mbgTex(ci) }, tDep: { value: mbgTex(di) }, tGlow: { value: mbgTex(c2) }, tNoise: { value: mbgNoise() },
        uMap: { value: new THREE.Vector4(1, 1, 0, 0) }, uPar: { value: new THREE.Vector2() }, uRes: { value: new THREE.Vector2(1, 1) },
        uZoom: { value: 1.02 }, uT: { value: 0 }, uFx: { value: 1 }, uMove: { value: 1 }, uShade: { value: 0 } },
      vertexShader: MBG_VS, fragmentShader: MBG_FS, depthTest: false, depthWrite: false,
    });
    // a triangle that covers the screen (less work at the edges than two triangles)
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const mesh = new THREE.Mesh(g, MBG.mat); mesh.frustumCulled = false;
    MBG.scene.add(mesh); MBG.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    canvas.addEventListener('webglcontextlost', () => mbgFail(), false);
    if (!COARSE) addEventListener('pointermove', (e) => { MBG.mx = e.clientX / Math.max(1, innerWidth) - 0.5; MBG.my = e.clientY / Math.max(1, innerHeight) - 0.5; }, { passive: true });
    MBG.ready = true;
  } catch (e) { MBG.failed = true; }
}
function mbgFail() { MBG.failed = true; MBG.live = false; const el = $('menuBg'); if (el) el.classList.remove('gl'); }
/* Draws the background (called by frame as long as a menu is displayed); hands back control doing nothing if the background isn't ready or has no reason to be */
const _mbgV = new THREE.Vector4(), _mbgS = new THREE.Vector2();
/* Draws the background (true if it was drawn this frame: the Outfits screen preview is then drawn over it, 09u-outfits.js) */
function mbgDraw(dt) {
  if (!MBG.ready || MBG.failed) return;
  if (MAPL.state === 'loading' || UI.busy || gpuLostNow()) return; // map loading: the GPU belongs to it (barriers, compilation)
  const main = UI.screen === 'main', U = MBG.mat.uniforms, move = mbgMotion();
  // rate: the screen's in the main menu on desktop, 30 frames per second on touch and on sub-screens; the Outfits screen,
  // whose animated soldier is drawn with the background (09u-outfits.js), the screen's on desktop and 60 at most on touch (at 30, its walk
  // looked jerky; 1/72: one frame at each refresh at 60 Hz despite the irregular timestamps, one in two at 120 Hz)
  MBG.acc += dt;
  const sk = UI.screen === 'skins' && SKV.live, step = (main || sk) && !TOUCH.on ? 0 : sk ? 1 / 72 : 1 / 31;
  renderer.getDrawingBufferSize(_mbgS);
  const key = _mbgS.x + 'x' + _mbgS.y;
  if (!move) { if (MBG.drawn === key) return; } // reduced motion: a still image, redrawn if the size changes
  else if (MBG.acc < step && MBG.drawn === key) return;
  const d = Math.min(MBG.acc, 0.1); MBG.acc = 0;
  if (move) MBG.t += d;
  // "cover" framing that keeps the soldier at MBG_FOCUS.at of the screen width
  const A = _mbgS.x / Math.max(1, _mbgS.y);
  if (A < MBG_IMG_A) { const w = A / MBG_IMG_A, x0 = clamp(MBG_FOCUS.x - w * MBG_FOCUS.at, 0, 1 - w); U.uMap.value.set(w, 1, x0, 0); }
  else { const h = MBG_IMG_A / A; U.uMap.value.set(1, h, 0, (1 - h) * 0.6); } // wider screen: mostly crops the bottom, v = 0 at the bottom of the image (the helmet stays)
  // camera drift (slow Lissajous) and a bit of mouse, damped; half as much on sub-screens
  // 24 s camera loop (Lissajous: lateral back-and-forth, slower rise and fall); the sky (depth 0) shifts by
  // 0.009 x 0.65 = 0.6% of the image width at most, the soldier not at all; half as much on sub-screens
  const t = MBG.t, k = main ? 1 : 0.45, a = 0.009 * k, w = (Math.PI * 2) / 24;
  MBG.px = damp(MBG.px, MBG.mx, 1.5, d); MBG.py = damp(MBG.py, MBG.my, 1.5, d);
  U.uPar.value.set(a * (0.8 * Math.sin(t * w) + 0.2 * Math.sin(t * w * 2.5 + 1.1)) - MBG.px * 0.004 * k, a * 0.45 * Math.sin(t * w * 0.75 + 2.3) + MBG.py * 0.003 * k);
  // slight dolly in and out (40 s), which also keeps a margin under the shifts (at most (0.009 + 0.004) x 0.65 = 0.0085)
  U.uZoom.value = 1.035 + 0.012 * (0.5 + 0.5 * Math.sin(t * (Math.PI * 2) / 40 - 1.2)); // (3.5% at least: margin of 0.28 x 0.034 = 0.0095 at the right edge, the zoom is centered on the soldier)
  U.uT.value = t; U.uRes.value.copy(_mbgS);
  U.uFx.value = main ? 1 : 0.7; U.uMove.value = move ? 1 : 0;
  U.uShade.value = UI.screen === 'skins' && SKV.live ? 1 : 0; // (the CSS veil is then removed: it would darken the preview)
  renderer.getViewport(_mbgV);
  renderer.setRenderTarget(null); renderer.setViewport(0, 0, VIEW.w, VIEW.h);
  renderer.render(MBG.scene, MBG.cam);
  renderer.setViewport(_mbgV);
  MBG.drawn = key;
  if (!MBG.live) { MBG.live = true; $('menuBg').classList.add('gl'); }
  return true;
}
/* Back to the menus (menuBgShow): the canvas still shows the game's last image, the background must be redrawn right away */
function mbgShown() { MBG.drawn = ''; MBG.acc = 1; }
