'use strict';
/* ==========================================================================
   WAR BASH - core: utilities, procedural textures, rendering
   ========================================================================== */
THREE.ColorManagement.legacyMode = false;

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
/* Length of a two- or three-component vector. Math.hypot allocates on every call and costs five times more (measured in Chrome:
   357 calls in the game, a good share on every frame, one cause of the small garbage collections at 280 frames per second) */
function hyp(x, y) { return Math.sqrt(x * x + y * y); }
function hyp3(x, y, z) { return Math.sqrt(x * x + y * y + z * z); }
/* Values coming from the network (another player, maybe with a modified client): a key is only accepted if it really is an entry of
   the table (not "constructor" or "__proto__", inherited by every object), a number only if it is finite ("1e999" gives Infinity) */
const hasKey = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
const numOr = (v, d = 0) => { v = +v; return Number.isFinite(v) ? v : d; };
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const V3 = THREE.Vector3;
const _v1 = new V3(), _v2 = new V3(), _v3 = new V3(), _v4 = new V3();
const _q1 = new THREE.Quaternion(), _m1 = new THREE.Matrix4();
const UP = new V3(0, 1, 0);
const sl = (c) => Math.pow(c, 2.2); // sRGB to linear

/* ---------- Persistent settings ---------- */
/* Steam Deck launched from Game mode: the launcher the installer adds to Steam opens the game with ?deck=1 (dist/deck/installer.sh, README
   "Steam Deck", 09ra-deck.js). A gamepad console: no touch controls, no install window, no phone settings. */
const DECK = /[?&]deck=1(&|$)/.test(location.search);
/* Browser of a Steam Deck in Desktop mode (Linux, 1280 x 800 screen, Steam Deck OLED included): the menu card offers the install
   into Steam (09ra-deck.js), and the phone install window is not shown. ?installer=deck makes it appear elsewhere (tests). */
function deckLooksLike() {
  if (DECK) return false;
  if (/[?&]installer=deck(&|$)/.test(location.search)) return true;
  const ua = navigator.userAgent, w = Math.round(screen.width * (devicePixelRatio || 1)), h = Math.round(screen.height * (devicePixelRatio || 1));
  return /Linux x86_64/.test(ua) && !/Android/.test(ua) && ((w === 1280 && h === 800) || (w === 800 && h === 1280));
}
/* Touch screen as primary pointer (phone, tablet): touch controls (09q-touch.js) and a lightened starting graphics profile */
const COARSE = !DECK && typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && (navigator.maxTouchPoints || 0) > 0;
const VIEW = { w: innerWidth, h: innerHeight, set: false }; // size of the 3D view (viewSync)
const Settings = { binds: {}, touch: 'auto', tcRun: 'stick', tcStick: 'float', tcLay: null, aimAssist: 'normal', tpMode: 'auto', tpSeen: false, tpHint: false, tpAuto: true, tpDblAds: true, adsToggle: false, tcAuto: true, tcDblAds: true, tcQuick: true, tcVib: true, tcAlpha: '1', tcV: 0, gfxSafe: false, gfxSafeAuto: '', padSeen: false, padSens: 1.0, padAdsMul: 0.65, adsMul: 1.0, padDead: 0.1, padCurve: 'reactive', padAccel: 'normal', padRun: 'click', padLay: 'default', padVib: true, sens: 1.0, fov: 62, quality: 'auto', dynres: true, eco: null, fpsMax: '0', perf: false, ao: false, rays: true, grass: true, difficulty: 2, loadout: 0, mode: 'tdm', limit: 75, limitFfa: 20, limitDom: 150, minutes: 10, map: 'chergui', volume: 0.8, music: 0.5, voice: true, nadeArc: true, invertY: false, fsGame: false, allyMarks: true, hudScale: '1', skin: 'assault', sv: 8 };
try {
  const s = JSON.parse(localStorage.getItem('dc_settings') || 'null');
  // settings from before version 2: "High" quality was the default there, we switch to automatic
  if (s) { if (!s.sv) { s.quality = 'auto'; s.sv = 2; } if (s.sv < 3) { s.fsGame = false; s.sv = 3; } Object.assign(Settings, s); }
  // 3.0.1: auto-fire on touch by default, reset once and for all; the "Strong" aim assist (too favorable) no longer exists
  if (s && s.sv < 4) Settings.tcAuto = true;
  // 3.0.3: aim with a double tap (no Aim button) by default, reset once and for all
  if (s && s.sv < 5) { Settings.tcDblAds = true; Settings.sv = 5; }
  // snappier gamepad: 10% dead zone (15% before) for those who hadn't touched the setting
  if (s && s.sv < 6) { if (Settings.padDead === 0.15) Settings.padDead = 0.1; Settings.sv = 6; }
  if (s && s.sv < 7) { Settings.difficulty = 2; Settings.sv = 7; } // bots play at maximum level by default: reset once, including for those who had kept the old setting
  // streaks of choice (three per class): the keys and touch buttons of the UAV, the strike and the helicopter become those of slots 1 to 3
  if (s && s.sv < 8) {
    const ren = { uav: 'ks1', air: 'ks2', heli: 'ks3' };
    for (const o of [Settings.binds, Settings.tcLay]) if (o && typeof o === 'object') for (const k in ren) if (k in o) { o[ren[k]] = o[k]; delete o[k]; }
    Settings.sv = 8;
  }
  if (Settings.aimAssist !== 'off') Settings.aimAssist = 'normal';
} catch (e) { /* storage unavailable */ }
/* Power saving (CAP, further down): never chosen, it starts enabled on touch (phone, tablet) and the game asks once whether to keep it
   (ecoAsk, 09zl-economy.js); elsewhere, disabled without asking */
if (Settings.eco !== true && Settings.eco !== false) { Settings.eco = COARSE; Settings.ecoAsk = COARSE; }
/* Under power saving, the game sets the image (Options, Video: the rows are greyed out and show these values). Automatic
   quality: it starts from the device profile (phone: Low, integrated chip: Medium, dedicated card: High) and dynamic resolution
   adapts it, never rising above the profile; no ambient occlusion or sun rays (two full-screen passes); the relief
   grass stays, lightened by the profile. Minimal when chosen stays Minimal (lighter than everything else). The player's choices are kept
   and come back when they disable it. gfxSet: the value in force for an image setting, to be read instead of Settings. */
const ECO_GFX = { quality: 'auto', ao: false, rays: false, grass: true, dynres: true };
function gfxSet(k) {
  if (!Settings.eco || !(k in ECO_GFX)) return Settings[k];
  return k === 'quality' && Settings.quality === 'ultra' ? 'ultra' : ECO_GFX[k];
}
if (!(Settings.tpSens > 0)) Settings.tpSens = Settings.sens; // touchpad sensitivity (09qe-touchpad.js): that of the mouse at the start, independent afterwards
function saveSettings() { try { localStorage.setItem('dc_settings', JSON.stringify(Settings)); } catch (e) { /* ignored */ } }
/* Economy graphics mode (Options, Video; enabled by itself after a WebGL context loss, see 01a-gpu.js): lightened Low profile (512 shadows, no muzzle
   flash lights, smaller rendering), reduced textures, no depth pre-pass. Read once at load: changing it restarts the game. */
/* Identifier of the current build (cod-build tag, written by build.py) */
const BUILD = (document.querySelector('meta[name="cod-build"]') || {}).content || '';
/* An economy mode armed by itself (context loss, button on the failure screen) was armed by an older build: we retry once with the normal profile, the
   cause may have been fixed since; if it fails again, the context loss rearms it for this build. Chosen by the player in the Options (gfxSafeAuto
   "manual"), it stays. */
if (Settings.gfxSafe && Settings.gfxSafeAuto !== 'manual' && Settings.gfxSafeAuto !== BUILD) { Settings.gfxSafe = false; Settings.gfxSafeAuto = ''; saveSettings(); }
const GFX_SAFE = !!Settings.gfxSafe;

/* ---------- Tileable noise ---------- */
function makeNoise(seed) {
  const r = mulberry32(seed), S = 256, vals = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) vals[i] = r();
  function n(x, y, px, py) {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const x0 = ((xi % px) + px) % px, y0 = ((yi % py) + py) % py, x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
    const a = vals[y0 * S + x0], b = vals[y0 * S + x1], c = vals[y1 * S + x0], d = vals[y1 * S + x1];
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  n.fbm = function (u, v, bx, by, oct) {
    let s = 0, a = 0.5, t = 0, fx = bx, fy = by;
    for (let o = 0; o < oct; o++) { s += a * n(u * fx, v * fy, fx, fy); t += a; a *= 0.5; fx *= 2; fy *= 2; }
    return s / t;
  };
  n.hash = (ix, iy) => vals[((iy & 255) * S + (ix & 255))];
  return n;
}

/* Drawn textures (decals, particles, foliage) */
function canvasTex(size, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(c); if (srgb) t.encoding = THREE.sRGBEncoding; return t;
}
/* Muzzle flash: a heat field (0 to 1 and more) computed cell by cell, passed through a color ramp (dark red, orange,
   yellow, white) on a black background. The texture is additive: black adds nothing, there is no transparency to handle. Fixed draw
   (seed): the same shapes at every launch. */
function flashTex(cell, n, kind) {
  let sd = 9157; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const S = cell * n;
  return canvasTex(S, (g) => {
    const im = g.createImageData(S, S), D = im.data;
    for (let c = 0; c < n * n; c++) {
      const ox = (c % n) * cell, oy = Math.floor(c / n) * cell, h = kind(c, rnd);
      for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
        const v = h(((x + 0.5) / cell) * 2 - 1, ((y + 0.5) / cell) * 2 - 1), i = ((oy + y) * S + ox + x) * 4;
        D[i] = 255 * clamp(v * 2, 0, 1); D[i + 1] = 255 * clamp(v * 1.75 - 0.08, 0, 1); D[i + 2] = 255 * clamp(v * 1.5 - 0.6, 0, 1); D[i + 3] = 255;
      }
    }
    g.putImageData(im, 0, 0);
  }, false);
}
/* star burst: white core, three to six tapered petals of uneven lengths, shorter sparks between them, streaks */
function flashFront(c, rnd) {
  const np = [4, 5, 6, 3][c % 4], a0 = rnd() * TAU, P = [];
  for (let k = 0; k < np; k++) P.push({ a: a0 + ((k + (rnd() - 0.5) * 0.4) * TAU) / np, l: 0.7 + rnd() * 0.28, w: 0.22 + rnd() * 0.12, k: 1 });
  for (let k = 0; k < np * 2; k++) P.push({ a: rnd() * TAU, l: 0.3 + rnd() * 0.35, w: 0.07 + rnd() * 0.06, k: 0.6 });
  const f1 = 13 + Math.floor(rnd() * 8), f2 = 29 + Math.floor(rnd() * 10), ph = rnd() * TAU;
  return (x, y) => {
    const r = hyp(x, y), a = Math.atan2(y, x);
    let h = 1.3 * Math.exp(-(r * r) / 0.008) + 0.35 * Math.exp(-(r * r) / 0.05);
    for (const p of P) {
      const u = r / p.l; if (u >= 1) continue;
      let d = Math.abs(a - p.a) % TAU; if (d > Math.PI) d = TAU - d;
      const w = p.w * (1 - 0.75 * u);
      h += p.k * Math.exp(-(d * d) / (w * w)) * (1 - u);
    }
    h *= 0.78 + 0.12 * Math.sin(a * f1 + ph) + 0.1 * Math.sin(a * f2 + r * 7);
    return h * smoothstep(1, 0.8, r);
  };
}
/* side-view flame tongue: the muzzle near the bottom (t = 0, a little margin below for the core), a spindle that opens fast
   then tapers off while undulating, bulges (shock diamonds) and threads; every other variant has two jets across near
   the muzzle, like a muzzle brake */
function flashSide(c, rnd) {
  const L = [0.95, 0.7, 0.62, 0.9][c % 4], W = 0.18 + rnd() * 0.12, ph = rnd() * TAU, jet = c % 2 === 1, bz = 0.06 + rnd() * 0.05, dk = 20 + rnd() * 8;
  return (x, y) => {
    const t = ((1 - y) / 2) * 1.08 - 0.08, cx = 0.07 * Math.sin(t * 8 + ph) * Math.max(t, 0);
    let h = 0;
    if (t > 0 && t < L) {
      const w = W * Math.pow(Math.sin(Math.PI * Math.pow(t / L, 0.5)), 1.1) + 0.02, dx = (x - cx) / w;
      h = Math.exp(-dx * dx * 1.7) * Math.pow(1 - t / L, 0.75) * (1.05 + 0.22 * Math.max(0, Math.cos(t * dk + ph))) * (0.86 + 0.14 * Math.sin(x * 34 + t * 11 + ph));
    }
    if (jet) { const ax = Math.abs(x), d = (t - bz - ax * 0.35) / 0.045; h += 0.75 * Math.exp(-d * d) * Math.pow(Math.max(0, 1 - ax / 0.85), 1.4); }
    h += 1.1 * Math.exp(-(x * x) / 0.012 - (t * t) / 0.003);
    return h * smoothstep(1, 0.88, Math.abs(x)) * smoothstep(1, 0.95, t) * smoothstep(-0.08, -0.03, t);
  };
}
function buildFxTextures() {
  const T = {};
  T.hole = canvasTex(64, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(10,8,6,1)'); r.addColorStop(0.18, 'rgba(18,15,12,1)'); r.addColorStop(0.3, 'rgba(40,35,30,0.85)');
    r.addColorStop(0.55, 'rgba(60,55,48,0.35)'); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(20,18,15,0.5)'; g.lineWidth = 1;
    for (let i = 0; i < 7; i++) { const a = Math.random() * TAU; g.beginPath(); g.moveTo(s / 2, s / 2); g.lineTo(s / 2 + Math.cos(a) * s * 0.4, s / 2 + Math.sin(a) * s * 0.4); g.stroke(); }
  });
  T.glow = canvasTex(64, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.6)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, s, s);
  }, false);
  T.star = canvasTex(128, (g, s) => {
    g.translate(s / 2, s / 2);
    const r = g.createRadialGradient(0, 0, 0, 0, 0, s / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.2, 'rgba(255,230,180,0.9)'); r.addColorStop(1, 'rgba(255,160,60,0)');
    g.fillStyle = r;
    for (let i = 0; i < 6; i++) {
      g.rotate(TAU / 6 + (Math.random() - 0.5) * 0.3);
      const l = s * (0.3 + Math.random() * 0.2);
      g.beginPath(); g.moveTo(0, -s * 0.06); g.lineTo(l, 0); g.lineTo(0, s * 0.06); g.closePath(); g.fill();
    }
    g.beginPath(); g.arc(0, 0, s * 0.16, 0, TAU); g.fill();
  }, false);
  // muzzle flash: front-view rosette (flashF), side-view flame tongue (flashS), four variants per sheet (2 x 2);
  // flashP: a star burst alone for shots seen from afar (particles)
  T.flashF = flashTex(128, 2, flashFront); T.flashS = flashTex(128, 2, flashSide); T.flashP = flashTex(128, 1, flashFront);
  T.smoke = canvasTex(128, (g, s) => {
    for (let i = 0; i < 26; i++) {
      const x = s / 2 + (Math.random() - 0.5) * s * 0.45, y = s / 2 + (Math.random() - 0.5) * s * 0.45, rr = s * (0.12 + Math.random() * 0.2);
      const r = g.createRadialGradient(x, y, 0, x, y, rr);
      r.addColorStop(0, 'rgba(255,255,255,0.22)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, s, s);
    }
  }, false);
  T.blood = canvasTex(64, (g, s) => {
    g.fillStyle = 'rgba(110,8,6,0.9)';
    for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(s / 2 + (Math.random() - 0.5) * s * 0.6, s / 2 + (Math.random() - 0.5) * s * 0.6, Math.random() * s * 0.14 + 2, 0, TAU); g.fill(); }
  });
  T.scorch = canvasTex(128, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(8,6,5,0.95)'); r.addColorStop(0.5, 'rgba(15,12,10,0.6)'); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, s, s);
  });
  T.frond = canvasTex(256, (g, s) => {
    g.clearRect(0, 0, s, s); g.strokeStyle = '#5b6b2c'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(s / 2, s); g.lineTo(s / 2, 0); g.stroke();
    for (let i = 0; i < 26; i++) {
      const y = s - (i / 26) * s, len = s * 0.46 * Math.sin((i / 26) * Math.PI * 0.9 + 0.2);
      const c = 60 + Math.random() * 40;
      g.strokeStyle = `rgb(${c},${c + 45},${30})`; g.lineWidth = 4;
      g.beginPath(); g.moveTo(s / 2, y); g.quadraticCurveTo(s / 2 - len * 0.6, y - 10, s / 2 - len, y - 26); g.stroke();
      g.beginPath(); g.moveTo(s / 2, y); g.quadraticCurveTo(s / 2 + len * 0.6, y - 10, s / 2 + len, y - 26); g.stroke();
    }
  });
  return T;
}

/* ---------- Renderer, scenes, cameras ---------- */
const canvas = document.getElementById('game');
/* ?desync=1: "desynchronized" WebGL context (Chrome, Windows): the image is presented without going back through the page compositor, one queue stage fewer between
   the mouse and the screen. Experimental (tearing possible depending on the driver), never enabled by itself; three.js r147 doesn't pass this attribute, so we create the context. */
const DESYNC = /[?&]desync=1\b/.test(location.search);
const renderer = new THREE.WebGLRenderer(Object.assign({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false }, DESYNC ? (() => {
  try { const c = canvas.getContext('webgl2', { alpha: false, antialias: false, stencil: false, powerPreference: 'high-performance', desynchronized: true }); return c ? { context: c } : {}; } catch (e) { return {}; }
})() : {}));
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputEncoding = THREE.LinearEncoding;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.autoClear = false;
renderer.info.autoReset = false; // counters reset once per frame (frame), all passes included
/* Real-time computed shadows (cascade shadow maps): disabled on PowerVR (Imagination) GPUs. The driver of a Pixel 10 (PowerVR D-Series DXT-48-1536,
   Chrome 153 and 154, ANGLE on GLES) loses the WebGL context around the 8th frame as soon as draws read a shadow map: other three.js projects isolated it
   on the same GPU (README, "Mobile version"), and our reports showed it (healthy load, loss at the 7th or 12th frame of the aerial view, where more than
   200 draws per frame read the cascades). Only removing the read from the shader at compile time holds: shadowMap disabled (no more USE_SHADOWMAP), the sun
   stays (only once, see the CSM part further down) and the scenery and soldiers receive the sun shadow computed at load (baked volume, 02e-light.js).
   Also disabled in Samsung Internet: on a Galaxy S25 (Adreno 830, Samsung Internet 30), the scenery and soldiers, which read the cascades,
   weren't displayed (sky, weapon and interface only), while the same phone displays everything in Chrome. Also after a context loss while the
   game was drawing on a phone (learned for 30 days, dc_gpu_noshadow, 01a-gpu.js), or with ?shadows=0 in the address; ?shadows=1 forces them. */
const GPU_NAME = (() => { try { const gl = renderer.getContext(), x = gl.getExtension('WEBGL_debug_renderer_info'); return String((x && gl.getParameter(x.UNMASKED_RENDERER_WEBGL)) || ''); } catch (e) { return ''; } })();
/* Software rendering (no usable graphics card: driver missing or refused by the browser) and chips too weak for the Low profile: Intel from the
   2010 to 2012 years (GMA, HD Graphics 2000 to 4000, unnumbered HD Graphics of Atoms, 400 to 505 of Celerons and Pentium N), Adreno 300 and 400, Mali-T and
   Mali-400, PowerVR SGX. Automatic mode starts from the Minimal profile there. */
const GPU_SOFT = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(GPU_NAME);
const GPU_WEAK = /\bGMA\b|Mobile Intel|Sandybridge|Ivybridge|Ironlake|Bay ?Trail|Intel(?:\(R\))? HD Graphics(?: (?:2000|2500|3000|4000|400|405|500|505|Family)\b| (?!\d)|,|\)|$)|Adreno \(TM\) [34]\d\d|Mali-T\d|Mali-4\d\d|PowerVR SGX/i.test(GPU_NAME);
/* Minimal profile in force at launch (chosen, or automatic mode on a GPU_WEAK chip or in software rendering): what can only be changed by
   recompiling all the shaders is decided here, once (computed shadows off, no pre-pass, no turf, fabrics simulated as on phone).
   The rest of the profile (QUALITY.ultra) applies live; choosing or leaving Minimal in the Options offers to restart the game (qualityBootCheck). */
function ultraAtBoot(q) { return q === 'ultra' || (q === 'auto' && (GPU_SOFT || GPU_WEAK)); }
const ULTRA = ultraAtBoot(gfxSet('quality'));
const SHADOWS = (() => {
  const q = /[?&]shadows=([01])\b/.exec(location.search);
  if (q) return { on: q[1] === '1', why: '?shadows=' + q[1] };
  if (ULTRA) return { on: false, why: 'minimum quality' };
  if (/PowerVR|Imagination/i.test(GPU_NAME)) return { on: false, why: 'PowerVR' };
  if (/SamsungBrowser/i.test(navigator.userAgent)) return { on: false, why: 'Samsung Internet' };
  try { const v = JSON.parse(localStorage.getItem('dc_gpu_noshadow') || 'null'); if (v && Date.now() - v.t < 30 * 864e5) return { on: false, why: 'learned after a context loss' }; } catch (e) { /* storage unavailable */ }
  return { on: true, why: '' };
})();
const NO_SHADOWS = !SHADOWS.on;
renderer.shadowMap.enabled = !NO_SHADOWS;

/* ---------- Quality profiles ----------
   Everything that makes the rendering cost vary is set here, one line per profile:
   pr       maximum pixel density of the 3D rendering (capped by the screen);
   scaleMin floor of dynamic resolution, as a fraction of pr;
   msaa     antialiasing samples; shadow: size of the cascade shadow maps;
   bloom, rays: light halo and sun rays; lights: muzzle flashes that light the scenery;
   lodPx    on-screen height (pixels) beyond which a soldier switches to the detailed model;
   detail   distance (m) beyond which the fine details of the scenery (grates, cables, placed objects) are hidden;
   scatter  distance (m) beyond which the ground scatter (pebbles, bricks, debris) is hidden;
   pom      parallax relief: search step along the ray (0 = off), start and end of the fade-out (m),
            strength of the relief self-shadow from the sun;
   grass    grass blades of the lawns (02nb-lawn.js): share of blades drawn, range (m), end of the detailed template (m);
   lean     lightened profile (Low, Minimal): reduced textures, no parallax relief or glitter, a single shadow cascade with the small objects. */
const QUALITY = {
  high: { label: _t('High'), pr: 1.5, scaleMin: 0.6, msaa: 4, shadow: 2048, bloom: true, rays: true, lights: 4, lodPx: 110, detail: 90, scatter: 44, pom: [12, 10, 16, 1], grass: [1, 40, 14] },
  medium: { label: _t('Medium'), pr: 1.0, scaleMin: 0.6, msaa: 4, shadow: 1536, bloom: true, rays: true, lights: 4, lodPx: 140, detail: 70, scatter: 38, pom: [8, 6, 10, 0.85], grass: [0.8, 34, 11] },
  // tier reserved for automatic mode: on integrated chips, 2x antialiasing costs noticeably less
  // bandwidth than 4x and leaves a higher resolution, before having to drop to Low
  medium2: { label: _t('Medium (light)'), pr: 1.0, scaleMin: 0.65, msaa: 2, shadow: 1536, bloom: true, rays: true, lights: 3, lodPx: 150, detail: 60, scatter: 32, pom: [0, 0, 1, 0], grass: [0.65, 28, 9] },
  low: { label: _t('Low'), pr: GFX_SAFE ? 0.6 : 0.75, scaleMin: 0.55, msaa: 0, shadow: GFX_SAFE ? 512 : 1024, bloom: false, rays: false, lights: COARSE || GFX_SAFE ? 0 : 2, lodPx: 180, detail: 40, scatter: 24, pom: [0, 0, 1, 0], grass: [0.5, 22, 7], lean: true },
  // for machines too weak for Low (Intel HD 3000, old phones): on top of Low, no muzzle flash lights or turf, fine details and
  // ground scatter closer, detailed soldier model from closer up, lower resolution floor; launched like this, without computed shadows
  // (the sun keeps its shadow, baked into the lighting), without pre-pass, textures at a third (ULTRA)
  ultra: { label: _t('Minimum'), pr: GFX_SAFE ? 0.6 : 0.75, scaleMin: 0.5, msaa: 0, shadow: 512, bloom: false, rays: false, lights: 0, lodPx: 260, detail: 24, scatter: 14, pom: [0, 0, 1, 0], grass: null, lean: true },
};
/* Automatic mode scale, from prettiest to lightest: [profile, smallest and largest resolution factor].
   We give up what shows least first (4x then 2x antialiasing); resolution only drops afterwards, in
   steps of 5% or more (see dynDown) within the profile range, and the Low profile (without antialiasing or halo) only comes
   last. At the end of the range, we move to the neighboring profile (going down, it starts at the top of its range; going
   up, at the bottom). Automatic mode starts from the graphics card profile, at resolution 1 (more if the measured GPU time
   allows, up to the screen density), and never goes back above it. A fixed profile only varies
   its resolution (1 to scaleMin). Changing resolution recreates nothing (RS); changing profile recreates the targets. */
const AUTO_LADDER = [['high', 0.8, 1], ['medium', 1, 1], ['medium2', 0.7, 1], ['low', 0.7, 1], ['ultra', 0.5, 0.7]];
/* Starting profile in automatic mode: dedicated graphics card → High, integrated chip (Intel Iris/UHD,
   integrated Radeon, Apple M) → Medium, phone → Low, software rendering and too-weak chip (GPU_WEAK) → Minimal.
   Dynamic resolution does the rest. */
const GPU = (() => {
  const gl = renderer.getContext(); let name = '';
  try { const ext = gl.getExtension('WEBGL_debug_renderer_info'); name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || ''); } catch (e) { /* unknown */ }
  const discrete = /NVIDIA|GeForce|Quadro|RTX|GTX|Radeon RX|Radeon Pro|Radeon\(TM\) RX|FirePro|Arc\(TM\) A\d|Arc A\d/i.test(name);
  const apple = /Apple/i.test(name); // Apple M chips: strong enough for Medium; the other integrated chips (Radeon 680M, Iris Xe) couldn't hold it and dropped down mid-match
  return { name, tier: ULTRA ? 'ultra' : COARSE ? 'low' : discrete ? 'high' : apple ? 'medium' : 'medium2' }; // phone: we start from the lightest, dynamic resolution goes back up if the chip keeps up
})();
/* Current state: chosen profile, dynamic resolution factor. In automatic mode: rung of AUTO_LADDER (rung)
   and starting rung (rungMin), where resolution goes from the profile range up to the screen density (see stepQuality). */
const RQ = { tier: 'high', q: QUALITY.high, scale: 1, rung: -1, rungMin: 0 };
/* Automatic mode memory, per graphics card: the profile where it settled last time. The next match starts there (its programs
   are compiled at load), instead of dropping down mid-match; it can still climb back up to the card's starting profile. */
const AUTO_MEM = 'wb_auto_rung';
function autoRungMem() { try { const m = JSON.parse(localStorage.getItem(AUTO_MEM) || 'null'); return m && m.gpu === GPU.name && m.rung >= 0 && m.rung < AUTO_LADDER.length ? m.rung | 0 : -1; } catch (e) { return -1; } }
function autoRungSave() { try { localStorage.setItem(AUTO_MEM, JSON.stringify({ gpu: GPU.name, rung: RQ.rung })); } catch (e) { /* storage unavailable */ } }
function resolveQuality() {
  if (QUALITY[gfxSet('quality')] || GFX_SAFE) {
    RQ.tier = GFX_SAFE ? (ULTRA ? 'ultra' : 'low') : gfxSet('quality'); RQ.q = QUALITY[RQ.tier]; RQ.scale = clamp(RQ.scale, RQ.q.scaleMin, 1);
    return RQ.q;
  }
  if (RQ.rung < 0) { RQ.rungMin = Math.max(0, AUTO_LADDER.findIndex((r) => r[0] === GPU.tier)); RQ.rung = Math.max(RQ.rungMin, autoRungMem()); RQ.scale = RQ.rung === RQ.rungMin ? 1 : AUTO_LADDER[RQ.rung][2]; }
  const [t, lo, hi] = AUTO_LADDER[RQ.rung];
  RQ.tier = t; RQ.q = QUALITY[t];
  RQ.scale = clamp(RQ.scale, lo, RQ.rung === RQ.rungMin && !Settings.eco ? Math.max(1, maxBoost()) : hi); // power saving: never beyond the profile
  return RQ.q;
}
/* New quality setting: automatic mode restarts from its starting rung */
function qualityReset() { RQ.rung = -1; RQ.scale = 1; applyQuality(); }
resolveQuality();
/* No depth pre-pass on phone or in economy mode: tile-based mobile chips already discard hidden surfaces (the pre-pass
   gains nothing there) and its assumption, that the same surface computed by two programs gives the same depth, doesn't always hold there (black worlds) */
const NO_PREPASS = COARSE || GFX_SAFE || ULTRA;

/* three.js resolves the multisampled target (color + depth copy) after each render that targets it:
   pre-pass, world then weapon would cause three. One is enough, after the weapon, and depth is
   never read back: the intermediate copies are skipped and only color is copied. */
const RENDER = { skipResolve: false, clip: false };
/* Layer of opaque objects that write depth in the pre-pass (see DepthPrepass, markPrepass) */
const LAYER_PREPASS = 2;
/* Layer of small scenery objects: seen by the camera and the two near shadow cascades, not by the
   far cascade (beyond about forty meters, their shadow is imperceptible). */
const LAYER_NEAR = 1;
/* Layer of meshes that only cast a shadow (lightened model of a soldier shown in detail, the player's
   body): the camera only sees it during the shadow map computation, so they cost nothing on screen.
   MASK_SCREEN: displayed mesh (main pass and pre-pass); MASK_SHADOW: shadow only. */
const LAYER_SHADOW = 3;
const MASK_SCREEN = 1 | (1 << LAYER_PREPASS), MASK_SHADOW = 1 << LAYER_SHADOW;
{
  const gl = renderer.getContext(), blit = gl.blitFramebuffer.bind(gl);
  gl.blitFramebuffer = function (x0, y0, x1, y1, dx0, dy0, dx1, dy1, mask, filter) {
    if (RENDER.skipResolve) return;
    // rendering into a sub-rectangle (RS, during composer.render): only the drawn part is copied
    if (RENDER.clip && x1 === RS.cw && y1 === RS.ch) { x1 = dx1 = RS.w; y1 = dy1 = RS.h; }
    const m = mask & gl.COLOR_BUFFER_BIT; if (m) blit(x0, y0, x1, y1, dx0, dy0, dx1, dy1, m, filter);
  };
}

const scene = new THREE.Scene();
scene.matrixAutoUpdate = false; // the root never moves: otherwise recomputing it every frame forces the recomputation of all objects, including the hundreds of fixed objects of the map
const camera = new THREE.PerspectiveCamera(Settings.fov, innerWidth / innerHeight, 0.15, 260);
camera.rotation.order = 'YXZ'; camera.layers.enable(LAYER_NEAR);
const vmScene = new THREE.Scene();
vmScene.matrixAutoUpdate = false;
const vmCamera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.01, 10);

/* Ambience of a map (applied by applyAtmosphere, 02z-load.js): sun, sky, fog, ambient light,
   environment, grading. Sky colors in linear values (above 1: bright), light tints in
   hexadecimal sRGB. Default values: those of Chergui (late-afternoon sun, low in the west-southwest).
   sky.cloud: cloud coverage thresholds and opacity; bounce: sun bounced by the ground (baked lighting);
   dust, motes: dust deposited on the scenery, suspended particles; impact: dust from ground impacts;
   snow: snow on the scenery (null: none); coat: deposit of the same shape without the snow effects (ash); snowfall: density of the
   flakes; wind: pitch (Hz) and strength of the wind;
   bloom: light halo (a snowy map wants it more discreet: snow in the sun quickly exceeds the threshold).
   grade: grading of the final pass (GRADE_DEF for what a map doesn't specify): lo, hi, tints of shadows and highlights;
   exp, exposure; sat, saturation; con, contrast; vig, vignette; lift, lifted blacks; gain, common exposure factor.
   fogSun, fogH: atmosphere (see FOG_U); winLit: share of windows whose room has its lamp on (room glass, 02c-materials.js).
   hdri: lighting HDRI (null: environment derived from the map's sky, required at night or dusk, a daytime HDRI lights too much);
   lit: street lighting on (lampposts, lanterns, sconces: litOn, 02f-props.js); lamps: strength of baked lamps (1 by default). */
const ATMO_DEFAULT = {
  sun: [-0.62, 0.34, 0.5], sunColor: 0xffcf9a, sunI: 2.9, vmSun: 0xffcf9a,
  fog: [0.62, 0.47, 0.36], fogD: 0.0058,
  hemi: [0xc6d6f0, 0x7a5c40, 0.62], vmHemi: [0xc6d6f0, 0x6a5038],
  sky: {
    zen: [0.10, 0.20, 0.42], mid: [0.42, 0.44, 0.52], hor: [1.05, 0.60, 0.34], gnd: [0.30, 0.22, 0.16],
    glow: [1.0, 0.5, 0.22], halo: [1.0, 0.78, 0.5], disk: [28, 19, 11], cloudLo: [0.55, 0.42, 0.42], cloudHi: [1.25, 0.82, 0.55], cloud: [0.52, 0.86, 0.7],
    // distant ridges painted in the sky: height (in sine of elevation), relief, haze; snow and rock colors
    ridge: [0, 0, 0], ridgeSnow: [1, 1, 1], ridgeRock: [0.5, 0.5, 0.5],
    // erupting crater (its cone is map relief): azimuth of the crater seen from the camera, its apparent radius (radians), sine of
    // the elevation of its lip (recomputed every frame by the map); eruption column: sine of the elevation of its top, drift,
    // opacity, crater glow; lava fountain and bombs (strengths), lightning in the column (intensity and seed)
    volc: [0, 0, 0, 0], plume: [0, 0, 0, 0], erupt: [0, 0, 0, 0],
    // sea of clouds below the horizon (floating islands): camera height above it (m), camera position (x, z: parallax;
    // recomputed every frame by the map), coverage (0: off)
    sea: [0, 0, 0, 0],
  },
  envGround: 0x5a4636, hdri: 'sunset',
  bounce: [1.45, 1.12, 0.8], dust: [0.8, 0.68, 0.54], motes: [1.3, 1.05, 0.78],
  grade: { lo: [0.9, 1.0, 1.08], hi: [1.07, 1.0, 0.88], exp: 1.0 }, rays: [1.0, 0.72, 0.45],
  fogSun: 0.45, fogH: [26, 0], // glow of the sun in the haze; fog lightened with altitude: characteristic height (m), reference altitude
  winLit: 0.1, // share of windows whose room has its lamp on (room glass, 02c-materials.js)
  // contrast between inside and outside: slope of the visible sky curve (1: no effect; above, covered places darken and
  // open streets keep their light), share of the aoFloor floor kept in shelter, share of bounced sun kept in shelter (skyCurve, 02c-materials.js)
  interior: [2.6, 0.35, 0.45],
  impact: [0.5, 0.4, 0.28], snow: null, coat: null, snowfall: 0, wind: [380, 0.05],
  bloom: [0.42, 0.55, 0.82], aoFloor: 0.3, // light halo (strength, radius, threshold); floor of indirect light in shadow
  raysThr: 1.9, // luminance beyond which a pixel feeds the sun rays (above sunlit snow in winter)
  satExp: 0.95, // exposure of the satellite view (tactical map, thumbnails): lower on snow, otherwise everything is white
  raysCap: 1e4, // maximum contribution of a sample: capped, so the sun disc (tiny, very bright) no longer makes the rays sizzle
};
/* Default grading (rendering workstream, October 2026: more restrained, like an AAA game): after ACES, saturation is no longer
   pushed by 10% nor contrast by 7% (sand and plaster turned orange-yellow), and the vignette no longer darkens the corners
   by 42% but by 17%. Tried and dropped: AgX tone mapping, softer on highlights, but which turned the sand of
   Sirocco salmon. */
/* Lifted blacks and exposure (owner's feedback, ambience workstream, October 2026: the contrasts are liked, but some corners
   were too dark to see well): lift raises pure black (6%: 15 out of 255) almost without touching the midtones; gain multiplies
   the exposure of all maps. */
const GRADE_DEF = { sat: 1.03, con: 1.05, vig: 0.35, lift: 0.06, gain: 1.06 };
const SUN_DIR = new V3(...ATMO_DEFAULT.sun).normalize();
const FOG_COLOR = new THREE.Color().setRGB(...ATMO_DEFAULT.fog);
scene.fog = new THREE.FogExp2(FOG_COLOR, ATMO_DEFAULT.fogD);
/* Atmosphere (owner's feedback, October 2026: take a step toward an AAA game look). three.js fog is a single
   color and depends only on depth. Two additions, common to all materials (fog_* shader chunks replaced at startup):
   - lighter fog with altitude (fogH: characteristic height, in m, and reference altitude; 0: uniform): the density
     decreases exponentially above the reference, stays that of the base below (the underside of the islands, the sea below), and
     the exact average is taken along the line of sight (the camera and the point seen), so there is no seam and the street
     stays hazy seen from the roof while the top of the facades stands out against the sky;
   - glow of the sun in the haze (fogSun: strength): toward the sun, the fog takes its color, like a haze lit from
     behind (two lobes: a wide one, a tight one).
   The values are common to all programs: each material receives the same arrays (FOG_U), which three.js copies by reference
   into the uniforms of each material (a typed array is not cloned); applyAtmosphere (02z-load.js) fills them. A material that doesn't
   have them (ShaderMaterial without the UniformsLib fog uniforms) reads them as zero: the fog as before. Lit materials
   already have the camera view position (vViewPosition); the others (sprites, particles, grass) receive one more varying. */
const FOG_U = { fogSun: { value: new Float32Array(4) }, fogSunCol: { value: new Float32Array(3) }, fogHeight: { value: new Float32Array(2) } };
(() => {
  Object.assign(THREE.UniformsLib.fog, FOG_U);
  for (const k in THREE.ShaderLib) if (THREE.ShaderLib[k].uniforms && THREE.ShaderLib[k].uniforms.fogColor) Object.assign(THREE.ShaderLib[k].uniforms, FOG_U);
  const lit = '!defined( STANDARD ) && !defined( LAMBERT ) && !defined( PHONG ) && !defined( TOON ) && !defined( MATCAP )';
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = `#ifdef USE_FOG
varying float vFogDepth;
#if ${lit}
varying vec3 vFogV;
#endif
#endif`;
  C.fog_vertex = `#ifdef USE_FOG
vFogDepth = - mvPosition.z;
#if ${lit}
vFogV = mvPosition.xyz;
#endif
#endif`;
  C.fog_pars_fragment = `#ifdef USE_FOG
uniform vec3 fogColor; varying float vFogDepth;
#ifdef FOG_EXP2
uniform float fogDensity;
#else
uniform float fogNear; uniform float fogFar;
#endif
#if ${lit}
varying vec3 vFogV;
#define FOG_V vFogV
#else
#define FOG_V ( - vViewPosition )
#endif
uniform vec4 fogSun; uniform vec3 fogSunCol; uniform vec2 fogHeight;
#ifndef FOG_K
#define FOG_K 1.0
#endif
// antiderivative of the density relative to altitude h (above the reference): exp( - h / H ) above, 1 below
float fogPrim( float h ) { return min( h, 0.0 ) - fogHeight.x * exp( - max( h, 0.0 ) / fogHeight.x ); }
// fog share for a base optical thickness dd (density x depth, like FogExp2), lightened with altitude along the line of sight
float fogPath( float dd ) {
  float k = dd * dd;
  if ( fogHeight.x > 0.0 ) {
    float hc = cameraPosition.y - fogHeight.y, dh = ( FOG_V * mat3( viewMatrix ) ).y;
    k *= abs( dh ) > 0.5 ? clamp( ( fogPrim( hc + dh ) - fogPrim( hc ) ) / dh, 0.0, 1.0 ) : exp( - max( hc + dh * 0.5, 0.0 ) / fogHeight.x );
  }
  return 1.0 - exp( - k );
}
// fog color: its tint, plus the glow of the sun toward it
vec3 fogTint( vec3 c ) {
  if ( fogSun.w <= 0.0 ) return c;
  float s = max( dot( normalize( FOG_V * mat3( viewMatrix ) ), fogSun.xyz ), 0.0 );
  return c + fogSunCol * ( pow( s, 5.0 ) * 0.65 + pow( s, 36.0 ) * 0.35 ) * fogSun.w;
}
#endif`;
  C.fog_fragment = `#ifdef USE_FOG
#ifdef FOG_EXP2
float fogFactor = fogPath( fogDensity * vFogDepth );
#else
float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
#endif
gl_FragColor.rgb = mix( gl_FragColor.rgb, fogTint( fogColor ) * FOG_K, fogFactor );
#endif`;
})();

const _skyU = (k) => ({ value: ATMO_DEFAULT.sky[k].length === 4 ? new THREE.Vector4(...ATMO_DEFAULT.sky[k]) : new V3(...ATMO_DEFAULT.sky[k]) });
const SkyShader = {
  uniforms: {
    sunDir: { value: SUN_DIR }, uTime: { value: 0 }, uZen: _skyU('zen'), uMid: _skyU('mid'), uHor: _skyU('hor'), uGnd: _skyU('gnd'),
    uGlow: _skyU('glow'), uHalo: _skyU('halo'), uDisk: _skyU('disk'), uCloudLo: _skyU('cloudLo'), uCloudHi: _skyU('cloudHi'), uCloud: _skyU('cloud'),
    uRidge: _skyU('ridge'), uRidgeSnow: _skyU('ridgeSnow'), uRidgeRock: _skyU('ridgeRock'),
    uVolc: _skyU('volc'), uPlume: _skyU('plume'), uErupt: _skyU('erupt'), uSea: _skyU('sea'),
    // photographed sky (SKY_PHOTO, skyPhoto of a map definition): top half of a panorama; x: rotation (fraction of a turn), y: gain
    tSky: { value: null }, uSkyP: { value: new THREE.Vector4(0, 1, 0, 0) },
  },
  vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
  fragmentShader: `
    varying vec3 vDir; uniform vec3 sunDir, uZen, uMid, uHor, uGnd, uGlow, uHalo, uDisk, uCloudLo, uCloudHi, uCloud, uRidge, uRidgeSnow, uRidgeRock;
    uniform vec4 uVolc, uPlume, uErupt, uSea, uSkyP; uniform float uTime;
#ifdef SKY_PHOTO
    uniform sampler2D tSky;
#endif
    float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
      return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
    float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<5;i++){ s+=a*vn(p); p*=2.03; a*=0.5; } return s; }
    float fbm3(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<3;i++){ s+=a*vn(p); p*=2.03; a*=0.5; } return s; }
    // one ridge layer (k: 0 the farthest, higher and more veiled; 1 the nearest); snowy peaks lit on the sun side
    vec3 ridgeLayer(vec3 col, float fk, vec2 ap, float h){
      float amp = uRidge.y * (1.25 - fk * 0.4);
      float r1 = fbm(ap * (1.6 + fk) + vec2(7.3 + fk * 3.1, 2.1)), r2 = fbm(ap * (5.5 + fk * 2.0) + vec2(1.7, fk * 5.3));
      float top = uRidge.x * (1.15 - fk * 0.45) + (r1 * 0.75 + r2 * r2 * 0.45 - 0.35) * amp;
      if (h < top) {
        float depth = clamp((top - h) / (amp * 0.9 + 1e-3), 0.0, 1.0), lit = 0.6 + 0.4 * dot(normalize(vec2(ap.x, ap.y)), normalize(sunDir.xz));
        float snowLine = smoothstep(0.55, 0.25, depth + (fbm(ap * 30.0 + vec2(h * 60.0)) - 0.5) * 0.35);
        vec3 mc = mix(uRidgeRock, uRidgeSnow * lit, snowLine) * (0.9 + 0.2 * fbm(ap * 60.0 + vec2(h * 120.0)));
        mc = mix(mc, uHor, uRidge.z * (1.0 - fk * 0.55) * (1.0 - depth * 0.6));
        col = mix(col, mc, smoothstep(0.0, 0.003, top - h));
      }
      return col;
    }
#ifdef SKY_VOLC
    // eruption column above the crater: it rises, widens, its edges billow, then spreads into an umbrella toward the zenith; wisps
    // lighter on their bumps, reddened at the base by the fountain; lightning illuminates it from time to time
    vec3 plume(vec3 col, vec3 d, float h){
      vec2 v0 = vec2(cos(uVolc.x), sin(uVolc.x)), dh = normalize(d.xz);
      float da = atan(v0.x * dh.y - v0.y * dh.x, dot(v0, dh)), U = uVolc.y, Hc = uVolc.z, yh = (h - Hc) / max(uPlume.x - Hc, 0.05);
      if (yh < -0.04 || yh > 1.0) return col;
      float cosEl = sqrt(max(1.0 - h * h, 0.03)); // cos of the elevation: near the zenith, an azimuth difference is worth less angle
      float ax = min(uPlume.y * pow(max(yh, 0.0), 2.4), 1.2), w = U * (1.4 + 5.0 * yh) * (1.0 + 2.2 * smoothstep(0.55, 0.95, yh)) / cosEl, u = (da - ax) / w;
      if (abs(u) > 2.2) return col;
      float n1 = fbm(vec2(u * 1.3 + 5.0, yh * 5.0 - uTime * 0.05)), n2 = fbm3(vec2(u * 3.0 - 3.0, yh * 11.0 - uTime * 0.09));
      float edge = abs(u) + (n1 - 0.5) * 0.9 + (n2 - 0.5) * 0.35;
      float dens = (1.0 - smoothstep(0.55, 1.05, edge)) * smoothstep(-0.04, 0.02, yh) * (1.0 - smoothstep(0.82, 1.0, yh));
      vec3 lat = vec3(-v0.y, 0.0, v0.x);
      float sh = 0.55 + 0.7 * n2 + 0.25 * clamp(u * dot(lat, sunDir), -1.0, 1.0);
      vec3 pc = mix(vec3(0.04, 0.032, 0.03), vec3(0.17, 0.13, 0.11), smoothstep(0.1, 0.8, yh)) * sh;
      pc += vec3(1.0, 0.3, 0.06) * uPlume.w * exp(-max(yh, 0.0) * 9.0) * (0.25 + 0.6 * (1.0 - n2));
      if (uErupt.z > 0.01) {
        float ly = 0.12 + fract(uErupt.w * 7.31) * 0.45, lx = (fract(uErupt.w * 3.17) - 0.5) * 0.9;
        float bx = lx + 0.4 * (vn(vec2(yh * 30.0, uErupt.w * 13.0)) - 0.5) + 0.14 * (vn(vec2(yh * 95.0, uErupt.w * 29.0)) - 0.5);
        float inY = smoothstep(ly - 0.14, ly - 0.11, yh) * (1.0 - smoothstep(ly + 0.11, ly + 0.14, yh)), bolt = exp(-pow((u - bx) * 22.0, 2.0)) * inY;
        pc += vec3(0.8, 0.74, 1.0) * uErupt.z * (exp(-pow((u - lx) * 1.1, 2.0) - pow((yh - ly) * 7.0, 2.0)) * 1.2 + bolt * 7.0);
        dens = max(dens, bolt * uErupt.z);
      }
      return mix(col, pc, clamp(dens * uPlume.z, 0.0, 0.97));
    }
    // lava fountain flickering above the crater lip, incandescent bombs in ballistic flight; units: the apparent radius of the
    // crater (what the lip hides is hidden by the relief, drawn in front of the sky)
    vec3 fountain(vec3 col, vec3 d, float h){
      vec2 v0 = vec2(cos(uVolc.x), sin(uVolc.x)), dh = normalize(d.xz);
      float da = atan(v0.x * dh.y - v0.y * dh.x, dot(v0, dh)), U = uVolc.y, cosEl = sqrt(max(1.0 - h * h, 0.03)), x = da * cosEl / U, y = (h - uVolc.z) / (U * cosEl);
      if (abs(x) > 6.0 || y < -1.5 || y > 9.0) return col;
      float fl = vn(vec2(uTime * 5.0, 1.7)), hj = 1.8 + 1.4 * fl, wj = 0.22 + max(y + 0.6, 0.0) * 0.16;
      float jet = exp(-pow(x / wj, 2.0)) * smoothstep(-1.2, -0.6, y) * (1.0 - smoothstep(hj * 0.5, hj, y)) * (0.65 + 0.35 * vn(vec2(x * 9.0, y * 4.0 - uTime * 9.0)));
      vec3 e = vec3(2.8, 1.05, 0.25) * jet * uErupt.x;
      for (int i = 0; i < 14; i++) {
        float fi = float(i), ph = fract(uTime * (0.22 + 0.06 * fract(fi * 0.37)) + fi * 0.618);
        float bx = (fract(fi * 0.73) - 0.5) * 7.0 * ph, by = -0.4 + (6.0 + 3.5 * fract(fi * 0.41)) * ph - 8.0 * ph * ph;
        vec2 q = vec2(x - bx, y - by) * U;
        e += vec3(2.4, 0.75, 0.12) * uErupt.y * exp(-dot(q, q) / 0.0000065) * (1.0 - ph * 0.6);
      }
      return col + e;
    }
#endif
#ifdef SKY_SEA
    // sea of clouds seen from above: a plane uSea.x m below the camera (uSea.yz: its position, for parallax), cumulus bumps
    // lit on the sun side and shaded on the other, gaps onto the blue of the depths (gnd), a haze that rises toward the horizon
    vec3 sea(vec3 d, float h){
      float t = uSea.x / max(-h, 0.004);
      vec2 p = (uSea.yz + d.xz * t) * 0.0065 + vec2(uTime * 0.0011, uTime * 0.0005);
      float n = fbm(p), n2 = fbm3(p * 3.3 + vec2(4.2, 1.7));
      float dens = smoothstep(uSea.w - 0.2, uSea.w + 0.12, n * 0.78 + n2 * 0.32);
      float sl = fbm(p + normalize(sunDir.xz) * 0.035) - n;
      float lit = clamp(0.66 + sl * 10.0 + (n2 - 0.5) * 0.5 + (dens - 0.5) * 0.3, 0.2, 1.3);
      vec3 sc = mix(uGnd, mix(uCloudLo, uCloudHi, lit), dens);
      float far = 1.0 - exp(-t * 0.0019);
      return mix(sc, mix(uHor, uMid, 0.15), clamp(far * 0.9 + smoothstep(-0.06, 0.0, h) * 0.7, 0.0, 1.0));
    }
#endif
    void main(){
      vec3 d = normalize(vDir); float h = d.y;
      vec3 zen = uZen, mid = uMid, hor = uHor, gnd = uGnd;
      vec3 col = mix(hor, mid, smoothstep(0.0, 0.18, h));
      col = mix(col, zen, smoothstep(0.12, 0.75, h));
#ifdef SKY_SEA
      if (h < 0.0) col = mix(col, sea(d, h), smoothstep(0.0, -0.015, h));
#else
      col = mix(col, gnd, smoothstep(0.0, -0.12, h));
#endif
      float sd = max(dot(d, sunDir), 0.0);
      col += uGlow*pow(sd,6.0)*0.55 + uHalo*pow(sd,48.0)*1.1;
      col += uDisk*smoothstep(0.99935,0.99965,sd);
#ifdef SKY_PHOTO
      // photographed sky above the horizon (read in sRGB, converted to linear), blended into the horizon haze (and the sea of clouds) below 2°
      if (h > -0.01) {
        vec2 st = vec2(fract(atan(d.z, d.x) * 0.15915494 + 0.5 + uSkyP.x), asin(clamp(h, 0.0, 1.0)) * 0.63661977);
        vec3 ph = pow(texture2D(tSky, st).rgb, vec3(2.2)) * uSkyP.y;
        col = mix(col, ph, smoothstep(-0.005, 0.035, h) * (1.0 - uSkyP.z)); // uSkyP.z: the photo fades out in front of the computed sky (Sirocco storm)
      }
#else
      vec2 uv = d.xz/(max(h,0.02)+0.18);
      float c = fbm(uv*0.9 + vec2(uTime*0.004, uTime*0.002));
      c = smoothstep(uCloud.x, uCloud.y, c) * smoothstep(0.0, 0.2, h);
      vec3 cc = mix(uCloudLo, uCloudHi, pow(sd,3.0)*0.8 + 0.25);
      col = mix(col, cc, c*uCloud.z);
#endif
      // distant ridges (two mountain layers) and, between the two, the volcano and its plume
      vec2 ap = normalize(d.xz + vec2(1e-5, 0.0));
      if (uRidge.x > 0.0) col = ridgeLayer(col, 0.0, ap, h);
#ifdef SKY_VOLC
      if (h > -0.01) { col = plume(col, d, h); if (uErupt.x > 0.0) col = fountain(col, d, h); }
#endif
      if (uRidge.x > 0.0) col = ridgeLayer(col, 1.0, ap, h);
      gl_FragColor = vec4(col, 1.0);
    }`,
};
const skyMat = new THREE.ShaderMaterial({ uniforms: SkyShader.uniforms, vertexShader: SkyShader.vertexShader, fragmentShader: SkyShader.fragmentShader, side: THREE.BackSide, depthWrite: false, fog: false });
const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), skyMat);
sky.frustumCulled = false; sky.renderOrder = -1;
scene.add(sky);

const hemi = new THREE.HemisphereLight(0xc6d6f0, 0x7a5c40, 0.62);
scene.add(hemi);
/* ---------- GPU-filtered shadows ----------
   three.js r147 stores the shadow map depth in a color texture (RGBA) and filters it by hand:
   17 reads and as many decodes per cascade, and two cascades in the blend zones, so up to 34 reads
   per pixel, followed by a full sun lighting computation per cascade. Here:
   - each map gets a real depth texture, read by a comparison sampler (sampler2DShadow):
     one read already compares and interpolates 2 x 2 texels. A 5 x 5 texel tent filter (Castaño) for the near
     cascade (9 reads) and 3 x 3 for the far ones (4 reads) gives a continuous penumbra, without the steps of the
     17 point samples;
   - the three cascades are one and the same sun: its lighting is computed once, multiplied by the shadow of the
     cascade or cascades that cover the pixel (same blend weights as CSMShader);
   - the maps now receive depth only: no color written (see the wrapper of shadowMap.render).
   Without WebGL 2 (no sampler2DShadow), the original three.js code is kept as is. */
const CSM_HW = { on: renderer.capabilities.isWebGL2, uniform: { value: [] }, gl: [] };
if (CSM_HW.on) {
  const C = THREE.CSMShader, lfb = C.lights_fragment_begin;
  const a = lfb.indexOf('#if ( NUM_DIR_LIGHTS > 0) && defined( RE_Direct ) && defined( USE_CSM ) && defined( CSM_CASCADES )');
  const b = lfb.indexOf('#if ( NUM_DIR_LIGHTS > NUM_DIR_LIGHT_SHADOWS)', a);
  if (a < 0 || b < 0) CSM_HW.on = false; // three.js different from the expected one: we touch nothing
  else C.lights_fragment_begin = lfb.slice(0, a) + `#if ( NUM_DIR_LIGHTS > 0) && defined( RE_Direct ) && defined( USE_CSM ) && defined( CSM_CASCADES )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	directionalLight = directionalLights[ 0 ];
	getDirectionalLightInfo( directionalLight, geometry, directLight );
	if ( receiveShadow ) {
		float linearDepth = ( vViewPosition.z ) / ( shadowFar - cameraNear );
		float csmS = 0.0, csmR, csmV, cascadeCenter, closestEdge, margin, csmx, csmy;
		vec2 cascade;
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			cascade = CSM_cascades[ i ];
			cascadeCenter = ( cascade.x + cascade.y ) / 2.0;
			closestEdge = linearDepth < cascadeCenter ? cascade.x : cascade.y;
			#ifdef CSM_FADE
			margin = max( 0.25 * pow( closestEdge, 2.0 ), 1e-6 );
			#else
			margin = 1e-6;
			#endif
			csmx = cascade.x - margin / 2.0;
			csmy = cascade.y + margin / 2.0;
			if ( linearDepth >= csmx && ( linearDepth < csmy || UNROLLED_LOOP_INDEX == CSM_CASCADES - 1 ) ) {
				csmR = clamp( min( linearDepth - csmx, csmy - linearDepth ) / margin, 0.0, 1.0 );
				#ifdef CSM_HW
				#if UNROLLED_LOOP_INDEX == 0
				csmV = csmShadow5( uCsmShadowMap[ i ], directionalLightShadows[ i ].shadowMapSize, directionalLightShadows[ i ].shadowBias, vDirectionalShadowCoord[ i ] );
				#else
				csmV = csmShadow3( uCsmShadowMap[ i ], directionalLightShadows[ i ].shadowMapSize, directionalLightShadows[ i ].shadowBias, vDirectionalShadowCoord[ i ] );
				#endif
				#else
				csmV = getShadow( directionalShadowMap[ i ], directionalLightShadows[ i ].shadowMapSize, directionalLightShadows[ i ].shadowBias, directionalLightShadows[ i ].shadowRadius, vDirectionalShadowCoord[ i ] );
				#endif
				csmS += UNROLLED_LOOP_INDEX == CSM_CASCADES - 1 && linearDepth > cascadeCenter ? mix( 1.0, csmV, csmR ) : csmR * csmV;
			}
		}
		#pragma unroll_loop_end
		directLight.color *= csmS;
	}
	RE_Direct( directLight, geometry, material, reflectedLight );
	#else
	// without a shadow map (NO_SHADOWS): the sun only once (the three cascades are one and the same sun), with no shadow computed here; the scenery receives the baked shadow
	directionalLight = directionalLights[ 0 ];
	getDirectionalLightInfo( directionalLight, geometry, directLight );
	RE_Direct( directLight, geometry, material, reflectedLight );
	#endif

	` + lfb.slice(b);
  THREE.ShaderChunk.shadowmap_pars_fragment += `
#if defined( USE_SHADOWMAP ) && defined( CSM_HW ) && NUM_DIR_LIGHT_SHADOWS > 0
	precision highp sampler2DShadow;
	uniform sampler2DShadow uCsmShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
	// shadow coordinates brought into the map; outside the map (edges, beyond the far plane): no shadow
	bool csmCoord( inout vec4 c, float bias ) {
		c.xyz /= c.w; c.z += bias;
		return c.x >= 0.0 && c.x <= 1.0 && c.y >= 0.0 && c.y <= 1.0 && c.z <= 1.0;
	}
	float csmTap( sampler2DShadow m, vec2 base, float u, float v, vec2 inv, float z ) { return texture( m, vec3( base + vec2( u, v ) * inv, z ) ); }
	// 5 x 5 texel tent filter in 9 compared and interpolated reads (Castaño, "optimized PCF")
	float csmShadow5( sampler2DShadow m, vec2 size, float bias, vec4 c ) {
		if ( ! csmCoord( c, bias ) ) return 1.0;
		vec2 inv = 1.0 / size, uv = c.xy * size, b = floor( uv + 0.5 ), st = uv + 0.5 - b;
		b = ( b - 0.5 ) * inv;
		vec3 uw = vec3( 4.0 - 3.0 * st.x, 7.0, 1.0 + 3.0 * st.x ), vw = vec3( 4.0 - 3.0 * st.y, 7.0, 1.0 + 3.0 * st.y );
		vec3 u = vec3( ( 3.0 - 2.0 * st.x ) / uw.x - 2.0, ( 3.0 + st.x ) / uw.y, st.x / uw.z + 2.0 );
		vec3 v = vec3( ( 3.0 - 2.0 * st.y ) / vw.x - 2.0, ( 3.0 + st.y ) / vw.y, st.y / vw.z + 2.0 );
		float s = uw.x * vw.x * csmTap( m, b, u.x, v.x, inv, c.z ) + uw.y * vw.x * csmTap( m, b, u.y, v.x, inv, c.z ) + uw.z * vw.x * csmTap( m, b, u.z, v.x, inv, c.z );
		s += uw.x * vw.y * csmTap( m, b, u.x, v.y, inv, c.z ) + uw.y * vw.y * csmTap( m, b, u.y, v.y, inv, c.z ) + uw.z * vw.y * csmTap( m, b, u.z, v.y, inv, c.z );
		s += uw.x * vw.z * csmTap( m, b, u.x, v.z, inv, c.z ) + uw.y * vw.z * csmTap( m, b, u.y, v.z, inv, c.z ) + uw.z * vw.z * csmTap( m, b, u.z, v.z, inv, c.z );
		return s / 144.0;
	}
	// 3 x 3 texel tent filter in 4 reads
	float csmShadow3( sampler2DShadow m, vec2 size, float bias, vec4 c ) {
		if ( ! csmCoord( c, bias ) ) return 1.0;
		vec2 inv = 1.0 / size, uv = c.xy * size, b = floor( uv + 0.5 ), st = uv + 0.5 - b;
		b = ( b - 0.5 ) * inv;
		vec2 uw = vec2( 3.0 - 2.0 * st.x, 1.0 + 2.0 * st.x ), vw = vec2( 3.0 - 2.0 * st.y, 1.0 + 2.0 * st.y );
		vec2 u = vec2( ( 2.0 - st.x ) / uw.x - 1.0, st.x / uw.y + 1.0 ), v = vec2( ( 2.0 - st.y ) / vw.x - 1.0, st.y / vw.y + 1.0 );
		float s = uw.x * vw.x * csmTap( m, b, u.x, v.x, inv, c.z ) + uw.y * vw.x * csmTap( m, b, u.y, v.x, inv, c.z );
		s += uw.x * vw.y * csmTap( m, b, u.x, v.y, inv, c.z ) + uw.y * vw.y * csmTap( m, b, u.y, v.y, inv, c.z );
		return s / 16.0;
	}
#endif
`;
}
/* Cascade shadow maps: render target with a depth texture (24 bits, linear filtering, comparison
   mode). Color is never written: a single 8-bit channel is enough for the target. Recreated when their
   size changes (applyQuality releases them). */
function csmDepthMaps() {
  const gl = renderer.getContext(), st = renderer.state;
  csm.lights.forEach((l, i) => {
    const sh = l.shadow; let rt = sh.map;
    if (!rt || !rt.depthTexture || rt.width !== sh.mapSize.x || rt.height !== sh.mapSize.y) {
      if (rt) rt.dispose();
      const dt = new THREE.DepthTexture(sh.mapSize.x, sh.mapSize.y, THREE.UnsignedIntType);
      dt.minFilter = dt.magFilter = THREE.LinearFilter;
      rt = sh.map = new THREE.WebGLRenderTarget(sh.mapSize.x, sh.mapSize.y, { format: THREE.RedFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthTexture: dt });
      rt.texture.name = l.name + '.shadowMap';
      sh.camera.updateProjectionMatrix(); sh.needsUpdate = true;
      // allocated right away, depth 1 (no shadow) until it is computed
      const prev = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
      renderer.setRenderTarget(rt); st.buffers.depth.setMask(true); renderer.clear(false, true, false); renderer.setRenderTarget(prev, face, mip);
      CSM_HW.uniform.value[i] = dt;
    }
    const t = renderer.properties.get(rt.depthTexture).__webglTexture;
    if (t && CSM_HW.gl[i] !== t) {
      CSM_HW.gl[i] = t;
      st.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    }
  });
}
/* Wrapper of the shadow map computation (called at the start of each renderer.render): depth maps ready
   before any draw that reads them; color locked (not written) during the computation; shadow-only layer visible
   to the camera for the duration of the computation (LAYER_SHADOW). */
{
  const sm = renderer.shadowMap, render = sm.render, cb = renderer.state.buffers.color;
  sm.render = function (lights, sc, cam) {
    if (CSM_HW.on && csm && sm.enabled) csmDepthMaps(); // without shadows (NO_SHADOWS): no map allocated
    const lock = CSM_HW.on && sm.enabled && (sm.autoUpdate || sm.needsUpdate) && lights.length > 0 && lights.every((l) => l.shadow.map && l.shadow.map.depthTexture);
    const had = cam.layers.isEnabled(LAYER_SHADOW);
    if (lock) { cb.setMask(false); cb.setLocked(true); }
    cam.layers.enable(LAYER_SHADOW);
    try { render.call(this, lights, sc, cam); } finally {
      if (!had) cam.layers.disable(LAYER_SHADOW);
      if (lock) { cb.setLocked(false); cb.setMask(true); }
    }
  };
}
/* Cascaded shadows (three.js CSM): three shadow maps centered on the camera,
   snapped to the texel grid so they don't shimmer when moving. */
let csm = null;
function shadowMapSize() { return RQ.q.shadow; }
function setupShadows() {
  const A = CURMAP.def ? CURMAP.def.atmo : ATMO_DEFAULT;
  csm = new THREE.CSM({
    camera, parent: scene, cascades: 3, maxFar: 120, mode: 'practical', shadowMapSize: shadowMapSize(),
    lightDirection: SUN_DIR.clone().negate(), lightIntensity: A.sunI, lightNear: 1, lightFar: 500, lightMargin: 140, shadowBias: -0.0001,
  });
  csm.fade = true;
  // each cascade decides by itself whether its map is recomputed (see updateShadows)
  for (const l of csm.lights) { l.color.setHex(A.sunColor); l.shadow.autoUpdate = false; l.shadow.needsUpdate = true; l.layers.enable(LAYER_PREPASS); }
  SHADOW_FAR.light = csm.lights[csm.lights.length - 1];
  const seen = new Set();
  scene.traverse((o) => {
    if (!o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m.isMeshStandardMaterial && !seen.has(m)) { seen.add(m); csmSetup(m); }
  });
  csm.updateFrustums();
  tuneShadowLights();
}
function csmMaterial(m) { if (csm && m.isMeshStandardMaterial) csmSetup(m); return m; }
/* CSM replaces onBeforeCompile: we chain the scenery material's patch (userData.patch) after its own, then
   the ambient cube lighting (envCubeHook) and the GPU-filtered shadow depth maps. The program cache
   key stays specific to the original chain (with or without the scenery patch): without it, all these
   materials would have the same function and different materials could share a program. */
function csmSetup(m) {
  if (m.userData.csmOn) return; // already done (a shared material created before the shadows, taken up afterwards: soldierMatsCsm)
  m.userData.csmOn = true;
  csm.setupMaterial(m);
  if (CSM_HW.on) m.defines.CSM_HW = '';
  const h = m.onBeforeCompile, p = m.userData.patch;
  const base = p ? (s, r) => { h(s, r); p(s, r); } : h;
  const key = base.toString() + (ENVC.on ? '|cube' : '') + (CSM_HW.on ? '|hw' : '');
  m.customProgramCacheKey = () => key;
  m.onBeforeCompile = function (shader, r) { base(shader, r); envCubeHook(shader); if (CSM_HW.on) shader.uniforms.uCsmShadowMap = CSM_HW.uniform; };
}
/* Biases adapted to the real texel size of each cascade */
function tuneShadowLights() {
  if (!csm) return;
  csm.lights.forEach((l, i) => {
    const cam = l.shadow.camera, texel = (cam.right - cam.left) / csm.shadowMapSize;
    l.shadow.normalBias = texel * 1.6;
    l.shadow.bias = -0.00006 * (i + 1);
    l.shadow.radius = i === 0 ? 2.2 : i === 1 ? 1.6 : 1.0;
  });
}
/* The near cascade is recomputed every frame. The two far ones (beyond about fifteen meters)
   alternate, every other frame each: their map keeps the matrix it was rendered with, so the shadow
   stays exact and only lags by a frame in the distance. If the camera has turned or moved noticeably since,
   the cascade is recomputed anyway so that no edge of the field is left without shadow. */
const SHADOW_STAGGER = { frame: 0, q: [], p: [], maxTurn: Math.cos(0.026 / 2), maxMove: 0.3 };
function updateShadows() {
  if (!csm) return;
  camera.updateMatrixWorld(); csm.update();
  const S = SHADOW_STAGGER; S.frame++;
  csm.lights.forEach((l, i) => {
    if (!S.q[i]) { S.q[i] = new THREE.Quaternion(); S.p[i] = new V3(); S.p[i].set(1e9, 0, 0); }
    const moved = Math.abs(S.q[i].dot(camera.quaternion)) < S.maxTurn || S.p[i].distanceToSquared(camera.position) > S.maxMove * S.maxMove;
    // the near cascade every k frames, the others alternating every 2k (k = HF.k: 1 under 175 frames per second, as before)
    const k = HF.k, due = (i === 0 ? S.frame % k === 0 : (S.frame + i * k) % (2 * k) === 0) || moved;
    if (due) { l.shadow.needsUpdate = true; S.q[i].copy(camera.quaternion); S.p[i].copy(camera.position); }
  });
}
/* Reserved point lights (fixed number, no shader recompilation) */
/* Muzzle and explosion flashes. A point light costs a full per-pixel lighting computation even
   when off: so they are only declared to the shader during a flash (only two shader variants,
   0 or "lights" lights, compiled at load). The number of lights depends on the quality profile. */
const flashLights = [];
for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffb060, 0, 10, 2); l.visible = false; scene.add(l); flashLights.push({ light: l, t: 0, dur: 0.05, peak: 0 }); }
function flashLight(pos, intensity, dist, dur, color) {
  const n = RQ.q.lights; let best = flashLights[0];
  for (let i = 0; i < n; i++) if (flashLights[i].t <= 0) { best = flashLights[i]; break; }
  best.light.position.copy(pos); best.light.distance = dist; best.light.color.setHex(color || 0xffb060);
  best.peak = intensity; best.dur = dur; best.t = dur; best.light.intensity = intensity;
}
/* Flash lights stay in the scene (at zero intensity) 2 s after the last flash: the number of lights declared to the shaders no longer
   changes with every bullet. A flash lasts a few hundredths of a second, the interval between two rifle bullets a tenth: the lights
   appeared and disappeared with every shot, and each time three.js re-evaluated all the visible lit materials (getParameters,
   getProgramCacheKey: two spikes per shot, right when aiming, October 2026). The program with flashes is compiled at load. */
const FLASH_HOLD = { t: 0 };
function updateFlashLights(dt) {
  let any = false;
  for (const f of flashLights) { if (f.t > 0) { f.t -= dt; f.light.intensity = Math.max(0, f.t / f.dur) * f.peak; if (f.t > 0) any = true; } else f.light.intensity = 0; }
  FLASH_HOLD.t = any ? 2 : Math.max(0, FLASH_HOLD.t - dt);
  const on = FLASH_HOLD.t > 0, n = RQ.q.lights;
  for (let i = 0; i < flashLights.length; i++) { const v = on && i < n; if (flashLights[i].light.visible !== v) flashLights[i].light.visible = v; }
}
function setFlashLightsVisible(v) { const n = RQ.q.lights; for (let i = 0; i < flashLights.length; i++) flashLights[i].light.visible = v && i < n; }

/* Weapon lighting in first person (separate scene) */
const vmHemi = new THREE.HemisphereLight(0xc6d6f0, 0x6a5038, 0.7);
const vmSun = new THREE.DirectionalLight(0xffcf9a, 2.2);
const vmFlash = new THREE.PointLight(0xffa850, 0, 3, 2);
vmFlash.position.set(0.1, 0, -0.9);
const vmLamp = new THREE.AmbientLight(0x000000, 1); // light of the scenery lamps at hand height (lampAt, 02e-light.js)
vmScene.add(vmHemi, vmSun, vmFlash, vmLamp);

/* ---------- Post-processing ---------- */
/* Rendering into a sub-rectangle: the composer targets are allocated at the profile density (times cap, more than 1 only when the resolution
   goes above the profile) and dynamic resolution only changes the drawn part, at the bottom left (viewport and scissor of the targets, rsView).
   Changing scale no longer recreates anything. The passes that re-read the image go through rsUv: screen coordinates (0 to 1) brought into this
   sub-rectangle, clamped to the center of its last pixel (beyond, the leftovers of a larger image). u: world image; ry: rays
   (half resolution). w, h: rendered size; cw, ch: allocated size. */
const RS = { cap: 1, w: 1, h: 1, cw: 1, ch: 1, u: { value: new THREE.Vector4(1, 1, 1, 1) }, ry: { value: new THREE.Vector4(1, 1, 1, 1) } };
const RS_GLSL = 'vec2 rsUv(vec2 u, vec4 r){ return min(max(u, 0.0) * r.xy, r.zw); }\n';
const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uDamage: { value: 0 }, uHurt: { value: 0 }, uDesat: { value: 0 },
    uFlash: { value: 0 }, uExposure: { value: 1.0 }, uAberr: { value: 0.0 }, uRes: { value: new THREE.Vector2(1, 1) }, uScope: { value: 0 },
    uSun: { value: new THREE.Vector2(0.5, 0.5) }, uSunOn: { value: 0 }, uRays: { value: 1 },
    tBloom: { value: null }, uBloom: { value: 1 }, tRays: { value: null }, uSharp: { value: 0 }, uTexel: { value: new THREE.Vector2(1, 1) },
    uGradeLo: { value: new V3(...ATMO_DEFAULT.grade.lo) }, uGradeHi: { value: new V3(...ATMO_DEFAULT.grade.hi) }, uRayTint: { value: new V3(...ATMO_DEFAULT.rays) },
    uSat: { value: 1.1 }, uCon: { value: 1.07 }, uVig: { value: 0.85 }, uLift: { value: 0 },
    uRS: RS.u, uRY: RS.ry,
  },
  /* sun visibility (lens flares): the same for the whole screen, read once per vertex of the full-screen
     triangle rather than at every pixel (10 fewer texture reads per pixel when the sun is on screen) */
  vertexShader: `
    uniform sampler2D tDiffuse, tBloom; uniform float uBloom, uSunOn, uRays; uniform vec2 uSun; uniform vec4 uRS;
    varying vec2 vUv; varying float vSunVis;
    ${RS_GLSL}
    void main(){
      vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);
      float sv = 0.0;
      if (uSunOn * uRays > 0.001) {
        for (int k = 0; k < 5; k++) { vec2 o = clamp(uSun + vec2(float(k - 2) * 0.004, float(k % 2) * 0.004 - 0.002), 0.0, 1.0); sv += dot(texture2D(tDiffuse, rsUv(o, uRS)).rgb + texture2D(tBloom, o).rgb * uBloom, vec3(0.33)); }
        sv = smoothstep(4.0, 18.0, sv / 5.0) * uSunOn;
      }
      vSunVis = sv;
    }`,
  fragmentShader: `
    uniform sampler2D tDiffuse, tBloom, tRays; uniform float uTime,uDamage,uHurt,uDesat,uFlash,uExposure,uAberr,uScope,uSunOn,uRays,uBloom,uSharp; uniform vec2 uRes, uSun, uTexel;
    uniform vec3 uGradeLo, uGradeHi, uRayTint; uniform float uSat, uCon, uVig, uLift; uniform vec4 uRS, uRY;
    varying vec2 vUv; varying float vSunVis;
    ${RS_GLSL}
    float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    float vno(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x), mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x), f.y); }
    vec3 aces(vec3 x){ const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }
    vec3 src(vec2 uv){ return texture2D(tDiffuse, rsUv(uv, uRS)).rgb; }
  #if __VERSION__ >= 300
    // EASU upscaling from FSR 1 (AMD FidelityFX, MIT license), after FsrEasuF: 12 source pixels around the point, edge direction and strength
    // derived from their luminance, then an approximated Lanczos kernel, stretched along the edge and shorter across it, clamped by the
    // 4 nearest pixels (no halo). Edges stay sharp without staircase steps; no sharpening afterwards (RCAS), which
    // creates some. Exact pixel reads (texelFetch), clamped to the rendered sub-rectangle. The image is still in linear light (before ACES):
    // the luminance that guides the analysis is compressed (l / (1 + l)) so that a very bright sky doesn't mask dark edges.
    vec3 ez(ivec2 p){ return texelFetch(tDiffuse, clamp(p, ivec2(0), ivec2(1.0 / uTexel + 0.5) - 1), 0).rgb; }
    float el(vec3 c){ float l = c.b * 0.5 + c.r * 0.5 + c.g; return l / (1.0 + 0.5 * l); }
    void eset(inout vec2 dir, inout float len, float w, float lA, float lB, float lC, float lD, float lE){
      float dc = lD - lC, cb = lC - lB, lx = max(abs(dc), abs(cb)), dx = lD - lB;
      lx = clamp(abs(dx) / max(lx, 1e-5), 0.0, 1.0); dir.x += dx * w; len += lx * lx * w;
      float ec = lE - lC, ca = lC - lA, ly = max(abs(ec), abs(ca)), dy = lE - lA;
      ly = clamp(abs(dy) / max(ly, 1e-5), 0.0, 1.0); dir.y += dy * w; len += ly * ly * w;
    }
    void etap(inout vec3 aC, inout float aW, vec2 off, vec2 dir, vec2 len2, float lob, float clp, vec3 c){
      vec2 v = vec2(off.x * dir.x + off.y * dir.y, off.y * dir.x - off.x * dir.y) * len2;
      float d2 = min(dot(v, v), clp);
      float wB = 0.4 * d2 - 1.0, wA = lob * d2 - 1.0;
      wB *= wB; wA *= wA; wB = 1.5625 * wB - 0.5625;
      float w = wB * wA; aC += c * w; aW += w;
    }
    vec3 upscale(vec2 uv){
      vec2 pp = uv / uTexel - 0.5, fp = floor(pp); pp -= fp; ivec2 ip = ivec2(fp);
      //    b c
      //  e f g h      f is the source pixel at the bottom left of the point (pp from 0 to 1 between f, g, j, k)
      //  i j k l
      //    n o
      vec3 bC = ez(ip + ivec2(0, -1)), cC = ez(ip + ivec2(1, -1)), eC = ez(ip + ivec2(-1, 0)), fC = ez(ip), gC = ez(ip + ivec2(1, 0)), hC = ez(ip + ivec2(2, 0));
      vec3 iC = ez(ip + ivec2(-1, 1)), jC = ez(ip + ivec2(0, 1)), kC = ez(ip + ivec2(1, 1)), lC = ez(ip + ivec2(2, 1)), nC = ez(ip + ivec2(0, 2)), oC = ez(ip + ivec2(1, 2));
      float bL = el(bC), cL = el(cC), eL = el(eC), fL = el(fC), gL = el(gC), hL = el(hC), iL = el(iC), jL = el(jC), kL = el(kC), lL = el(lC), nL = el(nC), oL = el(oC);
      vec2 dir = vec2(0.0); float len = 0.0;
      eset(dir, len, (1.0 - pp.x) * (1.0 - pp.y), bL, eL, fL, gL, jL);
      eset(dir, len, pp.x * (1.0 - pp.y), cL, fL, gL, hL, kL);
      eset(dir, len, (1.0 - pp.x) * pp.y, fL, iL, jL, kL, nL);
      eset(dir, len, pp.x * pp.y, gL, jL, kL, lL, oL);
      float dr = dot(dir, dir); bool zro = dr < 1.0 / 32768.0;
      dir = zro ? vec2(1.0, 0.0) : dir * inversesqrt(dr);
      len *= 0.5; len *= len;
      float st = 1.0 / max(abs(dir.x), abs(dir.y));
      vec2 len2 = vec2(1.0 + (st - 1.0) * len, 1.0 - 0.5 * len);
      float lob = 0.5 + (0.25 - 0.04 - 0.5) * len, clp = 1.0 / lob;
      vec3 aC = vec3(0.0); float aW = 0.0;
      etap(aC, aW, vec2(0.0, -1.0) - pp, dir, len2, lob, clp, bC); etap(aC, aW, vec2(1.0, -1.0) - pp, dir, len2, lob, clp, cC);
      etap(aC, aW, vec2(-1.0, 1.0) - pp, dir, len2, lob, clp, iC); etap(aC, aW, vec2(0.0, 1.0) - pp, dir, len2, lob, clp, jC);
      etap(aC, aW, vec2(0.0, 0.0) - pp, dir, len2, lob, clp, fC); etap(aC, aW, vec2(-1.0, 0.0) - pp, dir, len2, lob, clp, eC);
      etap(aC, aW, vec2(1.0, 1.0) - pp, dir, len2, lob, clp, kC); etap(aC, aW, vec2(2.0, 1.0) - pp, dir, len2, lob, clp, lC);
      etap(aC, aW, vec2(2.0, 0.0) - pp, dir, len2, lob, clp, hC); etap(aC, aW, vec2(1.0, 0.0) - pp, dir, len2, lob, clp, gC);
      etap(aC, aW, vec2(1.0, 2.0) - pp, dir, len2, lob, clp, oC); etap(aC, aW, vec2(0.0, 2.0) - pp, dir, len2, lob, clp, nC);
      return clamp(aC / aW, min(min(fC, gC), min(jC, kC)), max(max(fC, gC), max(jC, kC)));
    }
  #else
    // without WebGL 2 (no exact pixel reads): bicubic upscaling (Keys kernel, parameter a = -uSharp: -0.5 for
    // Catmull-Rom, more negative = sharper) in 5 filtered reads, clamped by those reads
    vec3 upscale(vec2 uv){
      vec2 sp = uv / uTexel, t1 = floor(sp - 0.5) + 0.5, f = sp - t1, g = 1.0 - f;
      float k = -uSharp;
      vec2 w0 = k * f * g * g, w3 = k * f * f * g;
      vec2 w1 = ((k + 2.0) * f - (k + 3.0)) * f * f + 1.0, w2 = ((k + 2.0) * g - (k + 3.0)) * g * g + 1.0;
      vec2 w12 = w1 + w2, t12 = (t1 + w2 / w12) * uTexel, t0 = (t1 - 1.0) * uTexel, t3 = (t1 + 2.0) * uTexel;
      vec3 a = src(vec2(t12.x, t0.y)), b = src(vec2(t0.x, t12.y)), c = src(t12);
      vec3 d = src(vec2(t3.x, t12.y)), e = src(vec2(t12.x, t3.y));
      float wa = w12.x * w0.y, wb = w0.x * w12.y, wc = w12.x * w12.y, wd = w3.x * w12.y, we = w12.x * w3.y;
      vec3 r = (a * wa + b * wb + c * wc + d * wd + e * we) / (wa + wb + wc + wd + we);
      return clamp(r, min(min(a, b), min(min(c, d), e)), max(max(a, b), max(max(c, d), e)));
    }
  #endif
    void main(){
      vec2 uv = vUv; vec2 cd = uv-0.5; float r2 = dot(cd,cd);
      float ab = uAberr*r2*0.006;
      vec3 col;
      if (uSharp > 0.0) {
        // 3D rendering smaller than the screen (profile, dynamic resolution): upscaled here rather than by the browser
        col = upscale(uv);
        if (ab > 0.0) { col.r = src(uv - cd*ab).r; col.b = src(uv + cd*ab).b; }
      } else {
        col.r = src(uv - cd*ab).r;
        col.g = src(uv).g;
        col.b = src(uv + cd*ab).b;
      }
      // light halo (bloom): added here rather than in the multisampled image, same chromatic offset
      col += vec3(texture2D(tBloom, uv - cd*ab).r, texture2D(tBloom, uv).g, texture2D(tBloom, uv + cd*ab).b) * uBloom;
      // crepuscular rays: computed at half resolution by RaysPass
      if (uSunOn * uRays > 0.001) {
        col += texture2D(tRays, rsUv(uv, uRY)).rgb * uSunOn * uRays;
        // lens flares along the sun-center axis, only if the sun is visible (vSunVis: see the vertex shader)
        float sv = vSunVis;
        vec2 ax = vec2(0.5) - uSun; vec2 asp = vec2(uRes.x / uRes.y, 1.0);
        float gh = 0.0;
        gh += smoothstep(0.06, 0.0, length((uv - (uSun + ax * 0.7)) * asp)) * 0.35;
        gh += smoothstep(0.035, 0.0, length((uv - (uSun + ax * 1.25)) * asp)) * 0.5;
        gh += smoothstep(0.12, 0.09, length((uv - (uSun + ax * 1.6)) * asp)) * smoothstep(0.06, 0.1, length((uv - (uSun + ax * 1.6)) * asp)) * 0.25;
        gh += smoothstep(0.02, 0.0, length((uv - (uSun + ax * 0.45)) * asp)) * 0.4;
        col += gh * sv * uRayTint * 0.6;
        float halo = smoothstep(0.35, 0.0, length((uv - uSun) * asp));
        col += halo * halo * sv * uRayTint * vec3(1.0, 0.85, 0.67) * 0.1;
      }
      col *= uExposure;
      col = aces(col*0.92);
      float l = dot(col, vec3(0.2126,0.7152,0.0722));
      col = mix(col, col*uGradeLo, (1.0-l)*0.4);
      col = mix(col, col*uGradeHi, l*0.35);
      col = mix(vec3(l), col, uSat - uDesat);
      col = max(col, vec3(0.0)); // pushed saturation can make a channel negative: pow(negative) = NaN = black pixel
      col = pow(col, vec3(1.0/2.2));
      col = clamp((col-0.5)*uCon+0.5, 0.0, 1.0);
      // lifted blacks (grade.lift): pure black rises by uLift, the effect fades quickly toward the midtones (an eighth at mid grey);
      // the image is a little duller but a soldier in shadow stays readable
      vec3 dk = 1.0 - col; col += uLift * dk * dk * dk;
      col *= 1.0 - r2*uVig;
      float e = smoothstep(0.18, 0.62, sqrt(r2)*1.35);
      // progressive blood and darkening according to missing health
      vec2 q = (uv-0.5)*vec2(uRes.x/uRes.y, 1.0);
      float ed = length(q)*1.35;
      float nb = vno(uv*vec2(7.0,5.0))*0.6 + vno(uv*vec2(19.0,13.0))*0.4;
      float thr = mix(1.5, 0.22, uHurt);
      float blood = smoothstep(thr, thr + 0.3, ed + (nb-0.5)*0.5) * smoothstep(0.02, 0.15, uHurt);
      float pulse = 1.0 + 0.1*sin(uTime*7.0)*uHurt*uHurt;
      col = mix(col, col*vec3(0.6,0.07,0.05) + vec3(0.11,0.0,0.0), clamp(blood*pulse, 0.0, 0.93));
      col *= 1.0 - uHurt*0.32*smoothstep(0.05, 1.0, ed);
      col = mix(col, vec3(dot(col, vec3(0.3,0.59,0.11))), uHurt*0.4);
      col = mix(col, vec3(0.5,0.02,0.02), clamp(uDamage*e*1.2, 0.0, 0.6));
      col += vec3(uFlash);
      float g = fract(sin(dot(uv*uRes + uTime*61.7, vec2(12.9898,78.233)))*43758.5453);
      col += (g-0.5)*0.012;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

/* Crepuscular rays: radial blur of very bright areas (sun, sky, halo) toward the sun,
   at half resolution (the result is very soft, a quarter of the pixels is enough). */
const RaysShader = {
  uniforms: { tDiffuse: { value: null }, tBloom: { value: null }, uBloom: { value: 1 }, uSun: { value: new THREE.Vector2(0.5, 0.5) }, uRes: { value: new THREE.Vector2(1, 1) }, uTint: { value: new V3(...ATMO_DEFAULT.rays) }, uThr: { value: ATMO_DEFAULT.raysThr }, uCap: { value: ATMO_DEFAULT.raysCap }, uRS: RS.u },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse, tBloom; uniform float uBloom, uThr, uCap; uniform vec2 uSun, uRes; uniform vec3 uTint; uniform vec4 uRS; varying vec2 vUv;
    ${RS_GLSL}
    void main(){
      vec2 uv = vUv, dlt = (uSun - uv) / 32.0, p = uv; float dec = 1.0; vec3 acc = vec3(0.0);
      p += dlt * fract(sin(dot(uv * uRes, vec2(12.9898, 78.233))) * 43758.5453);
      for (int i = 0; i < 32; i++) {
        p += dlt; vec2 c = clamp(p, 0.001, 0.999);
        vec3 sm = texture2D(tDiffuse, rsUv(c, uRS)).rgb + texture2D(tBloom, c).rgb * uBloom;
        acc += clamp(dot(sm, vec3(0.3, 0.59, 0.11)) - uThr, 0.0, uCap) * dec; dec *= 0.955;
      }
      gl_FragColor = vec4(acc * uTint * 0.018, 1.0);
    }`,
};
class RaysPass extends THREE.Pass {
  constructor() {
    super(); this.needsSwap = false;
    this.rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    this.mat = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.clone(RaysShader.uniforms), vertexShader: RaysShader.vertexShader, fragmentShader: RaysShader.fragmentShader, depthTest: false, depthWrite: false });
    this.mat.uniforms.uRS = RS.u; // shared (cloning made a copy of it)
    this.quad = new THREE.FullScreenQuad(this.mat);
  }
  setSize(w, h) { const rw = Math.max(1, Math.round(w / 2)), rh = Math.max(1, Math.round(h / 2)); this.rt.setSize(rw, rh); this.mat.uniforms.uRes.value.set(rw, rh); }
  render(renderer, writeBuffer, readBuffer) {
    const U = FinalShader.uniforms, u = this.mat.uniforms;
    if (U.uSunOn.value * U.uRays.value <= 0.001) return; // sun out of view: nothing to compute
    u.tDiffuse.value = readBuffer.texture; u.tBloom.value = U.tBloom.value; u.uBloom.value = U.uBloom.value; u.uSun.value.copy(U.uSun.value);
    renderer.setRenderTarget(this.rt); this.quad.render(renderer);
  }
}
/* Depth pre-pass: the map is merged by material, drawn in an order unrelated to
   distance, and each pixel used to be shaded 6 to 13 times on average with the full shader (PBR, three shadow
   cascades, flashes). We first write only the depth of opaque objects (empty shader); the main pass
   then shades only the visible surface. polygonOffset pushes this depth back very slightly
   so that the same surface, recomputed by another program, always passes the test. Shadows are
   not rendered here: they are during the main pass, with all the layers. */
class DepthPrepass extends THREE.Pass {
  constructor(sc, cam) {
    super(); this.scene = sc; this.camera = cam; this.needsSwap = false;
    // without fog: the color isn't written, and altitude fog (fog_fragment, above) cost a quarter of the pass for nothing
    this.mat = new THREE.MeshBasicMaterial({ colorWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  }
  render(renderer, writeBuffer, readBuffer) {
    const cam = this.camera, mask = cam.layers.mask, sm = renderer.shadowMap.enabled;
    renderer.setRenderTarget(readBuffer); renderer.clear(true, true, false);
    cam.layers.set(LAYER_PREPASS); this.scene.overrideMaterial = this.mat; renderer.shadowMap.enabled = false; RENDER.skipResolve = true;
    try { renderer.render(this.scene, cam); } finally { RENDER.skipResolve = false; renderer.shadowMap.enabled = sm; this.scene.overrideMaterial = null; cam.layers.mask = mask; }
  }
}
/* Scene pass whose multisampled resolve can be deferred (see RENDER.skipResolve) */
class ScenePass extends THREE.RenderPass {
  render(renderer, writeBuffer, readBuffer, dt, mask) {
    RENDER.skipResolve = !!this.deferResolve;
    try { super.render(renderer, writeBuffer, readBuffer, dt, mask); } finally { RENDER.skipResolve = false; }
  }
}
/* Objects allowed in the pre-pass: ordinary opaque meshes, with no transparency or alpha cutout, that
   write their depth normally. Any unmarked object is simply shaded without a pre-pass: forgetting costs
   a bit of computation but never distorts the image. Lights are added to the layer so that the
   pre-pass sees the same lighting as the main pass (otherwise three.js would re-evaluate all programs). */
function prepassEligible(o) {
  if (!o.isMesh || o.userData.noPrepass) return false;
  const m = o.material;
  if (!m || Array.isArray(m) || !(m.isMeshStandardMaterial || m.isMeshBasicMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial)) return false;
  return !m.transparent && !m.alphaTest && m.depthWrite && m.depthTest && m.colorWrite && m.depthFunc === THREE.LessEqualDepth && !m.wireframe && m.side !== THREE.BackSide && !m.alphaMap && !m.displacementMap;
}
function markPrepass(root) {
  root.traverse((o) => {
    if (o.isLight) o.layers.enable(LAYER_PREPASS);
    else if (o.userData.noPrepass || o.layers.isEnabled(LAYER_SHADOW)) return; // levels of detail handled separately, shadow only
    else if (prepassEligible(o)) o.layers.enable(LAYER_PREPASS);
    else o.layers.disable(LAYER_PREPASS);
  });
}

/* Cutout normal materials: same texture and same scale as the scenery material, pixels under the threshold discarded */
const SSAO_CUT = new Map();
function ssaoCutMat(m) {
  let n = SSAO_CUT.get(m); if (n) return n;
  n = new THREE.MeshNormalMaterial({ side: m.side }); n.map = m.map; // the presence of a texture makes the coordinates (vUv) get generated
  n.onBeforeCompile = (sh) => {
    sh.uniforms.uCutMap = { value: m.map }; sh.uniforms.uCutSc = m.userData.wmU ? m.userData.wmU.uWMs : { value: 1 }; sh.uniforms.uCut = { value: m.alphaTest };
    sh.vertexShader = sh.vertexShader.replace('void main() {', 'uniform float uCutSc;\nvoid main() {').replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_UV\nvUv *= uCutSc;\n#endif');
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform sampler2D uCutMap; uniform float uCut;\nvoid main() {\n#ifdef USE_UV\nif ( texture2D( uCutMap, vUv ).a < uCut ) discard;\n#endif');
  };
  n.customProgramCacheKey = () => 'ssaocut';
  SSAO_CUT.set(m, n); return n;
}
/* Second half of the normals pass: only the cutout objects, with their normal material, in the same target */
function ssaoCutPass(pass, renderer, target, cuts) {
  const scene = pass.scene, vis = [], mats = [];
  scene.traverse((o) => { if (o.isMesh || o.isPoints || o.isLine || o.isSprite) { vis.push([o, o.visible]); o.visible = false; } });
  for (const o of cuts) { mats.push([o, o.material]); o.material = ssaoCutMat(o.material); o.visible = true; }
  const ac = renderer.autoClear;
  renderer.setRenderTarget(target); renderer.autoClear = false;
  renderer.render(scene, pass.camera);
  renderer.autoClear = ac; renderer.setRenderTarget(pass.beautyRenderTarget);
  for (const [o, m] of mats) o.material = m;
  for (const [o, v] of vis) o.visible = v;
}
let composer, prePass, worldPass, vmPass, bloomPass, raysPass, finalPass, msaaTarget, ssaoPass = null;
/* Pixel density: the canvas always follows the screen (up to 2); the 3D rendering follows the screen within the limit of the
   profile (pr), multiplied by dynamic resolution (in a sub-rectangle of the targets, see RS). The last pass upscales
   the 3D image to the canvas size (EASU): on a laptop set to 125 or 150%, it does the upscaling, no longer the browser. */
function canvasPixelRatio() { return Math.min(window.devicePixelRatio || 1, 2); }
function basePixelRatio() { return Math.min(canvasPixelRatio(), RQ.q.pr); }
function renderPixelRatio() { return basePixelRatio() * (gfxSet('dynres') === false ? 1 : RQ.scale); }
/* Extra resolution possible at the top of the automatic scale: up to the screen density */
function maxBoost() { return canvasPixelRatio() / basePixelRatio(); }
function setupComposer() {
  resolveQuality();
  renderer.setPixelRatio(canvasPixelRatio());
  viewSync();
  renderer.setSize(VIEW.w, VIEW.h, false);
  rsSize();
  msaaTarget = new THREE.WebGLRenderTarget(RS.cw, RS.ch, { type: THREE.HalfFloatType, samples: RQ.q.msaa });
  composer = new THREE.EffectComposer(renderer, msaaTarget); // density 1: the sizes given to the composer are in pixels (RS)
  // the second target is only used with ambient occlusion: no antialiasing otherwise (see applyQuality)
  composer.renderTarget2.samples = 0;
  { const cr = composer.render.bind(composer); composer.render = (dt) => { RENDER.clip = true; try { cr(dt); } finally { RENDER.clip = false; } }; }
  prePass = new DepthPrepass(scene, camera);
  worldPass = new ScenePass(scene, camera); worldPass.clear = NO_PREPASS; worldPass.deferResolve = true; // the pre-pass clears the image; without it, the world pass does
  prePass.enabled = !NO_PREPASS;
  composer.addPass(prePass); composer.addPass(worldPass);
  if (THREE.SSAOPass) {
    // occlusion slightly strengthened: contacts between walls, floor and objects read better
    // (attenuated with distance, and on surfaces seen at a slant where sampling is least reliable: truck interiors, grazing walls)
    THREE.SSAOShader.fragmentShader = THREE.SSAOShader.fragmentShader.replace('vec3( 1.0 - occlusion )',
      'vec3( clamp( 1.0 - pow( occlusion, 0.8 ) * 1.2 * ( 1.0 - smoothstep( 25.0, 60.0, - viewZ ) ) * mix( 0.45, 1.0, smoothstep( 0.1, 0.5, abs( viewNormal.z ) ) ), 0.0, 1.0 ) )');
    ssaoPass = new THREE.SSAOPass(scene, camera, RS.cw, RS.ch);
    ssaoPass.beautyRenderTarget.dispose();
    ssaoPass.beautyRenderTarget = new THREE.WebGLRenderTarget(RS.cw, RS.ch, { type: THREE.HalfFloatType, samples: 4 });
    // reads brought into the rendered sub-rectangle (RS): depth and normals, blur, final copy
    rsTex(ssaoPass.ssaoMaterial, ['tDepth', 'tNormal']); rsTex(ssaoPass.blurMaterial, ['tDiffuse']); rsTex(ssaoPass.copyMaterial, ['tDiffuse']);
    ssaoPass.kernelRadius = 0.6; ssaoPass.minDistance = 0.00015; ssaoPass.maxDistance = 0.004;
    // instanced objects (chairs, crates, pots...) stay in the depth pass: otherwise occlusion computes them as
    // if they didn't exist and the scenery behind shows through them
    const ov = ssaoPass.overrideVisibility.bind(ssaoPass);
    // Cutout objects (foliage, fences, nets) leave the common pass: the replacement material ignores their
    // texture and would make solid plates of them (halos around fronds, darkened wall behind). They are redrawn afterwards, with a
    // normal material that discards transparent pixels (ssaoCutPass).
    const cuts = [];
    ssaoPass.overrideVisibility = function () {
      ov(); cuts.length = 0;
      scene.traverse((o) => {
        if (o.userData.noAO || (o.material && o.material.transparent && !o.material.alphaTest)) o.visible = false;
        else if (o.isMesh && o.visible && o.material && !Array.isArray(o.material) && o.material.alphaTest && o.material.map) { cuts.push(o); o.visible = false; }
      });
    };
    const ro = ssaoPass.renderOverride.bind(ssaoPass);
    ssaoPass.renderOverride = function (renderer, mat, target, cc, ca) {
      ro(renderer, mat, target, cc, ca);
      if (mat === this.normalMaterial && cuts.length) ssaoCutPass(this, renderer, target, cuts);
    };
    composer.addPass(ssaoPass);
  }
  vmPass = new THREE.RenderPass(vmScene, vmCamera); vmPass.clear = false; vmPass.clearDepth = true;
  const B = (CURMAP.def ? CURMAP.def.atmo : ATMO_DEFAULT).bloom;
  bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(VIEW.w, VIEW.h), B[0], B[1], B[2]);
  // the halo is added by the final pass: we skip its additive copy into the multisampled image
  { const q = bloomPass.fsQuad, r = q.render.bind(q); q.render = (rd) => { if (q.material !== bloomPass.materialCopy) r(rd); }; }
  rsTex(bloomPass.materialHighPassFilter, ['tDiffuse']); // the halo reads the rendered sub-rectangle and extends to the whole screen
  raysPass = new RaysPass();
  finalPass = new THREE.ShaderPass(FinalShader);
  FinalShader.uniforms = finalPass.uniforms; // ShaderPass clones the uniforms: we point to our own
  finalPass.uniforms.uRS = RS.u; finalPass.uniforms.uRY = RS.ry; // shared
  FinalShader.uniforms.tBloom.value = bloomPass.renderTargetsHorizontal[0].texture;
  FinalShader.uniforms.tRays.value = raysPass.rt.texture;
  composer.addPass(vmPass); composer.addPass(bloomPass); composer.addPass(raysPass); composer.addPass(finalPass);
  applyQuality();
}
function applyQuality() {
  const q = resolveQuality();
  if (csm && csm.shadowMapSize !== shadowMapSize()) {
    csm.shadowMapSize = shadowMapSize();
    for (const l of csm.lights) { l.shadow.mapSize.set(csm.shadowMapSize, csm.shadowMapSize); if (l.shadow.map) { l.shadow.map.dispose(); l.shadow.map = null; } l.shadow.needsUpdate = true; }
    csm.updateFrustums(); tuneShadowLights();
  }
  bloomPass.enabled = q.bloom; FinalShader.uniforms.uBloom.value = q.bloom ? 1 : 0;
  WMU.uPom.value.fromArray(q.pom);
  const ao = !!gfxSet('ao') && q.msaa > 0;
  if (ssaoPass) { ssaoPass.enabled = ao; worldPass.enabled = !ao; prePass.enabled = !ao && !NO_PREPASS; }
  FinalShader.uniforms.uRays.value = q.rays && gfxSet('rays') !== false ? 1 : 0;
  const rt1 = composer.renderTarget1, rt2 = composer.renderTarget2, s2 = ao ? q.msaa : 0;
  if (rt1.samples !== q.msaa) { rt1.samples = q.msaa; rt1.dispose(); }
  if (rt2.samples !== s2) { rt2.samples = s2; rt2.dispose(); }
  setFlashLightsVisible(false);
  applyResolution();
}
/* Changes only the composer targets (the canvas keeps its size: no page flicker) */
function applyResolution() {
  renderer.setPixelRatio(canvasPixelRatio());
  onResize();
}
/* New dynamic resolution scale, same profile: only the drawn part changes (rsView), nothing is recreated; beyond the allocated
   size (resolution above the profile), the targets grow by a quarter */
function applyScale() {
  if ((gfxSet('dynres') === false ? 1 : RQ.scale) > RS.cap + 1e-6) onResize(); else { rsView(); if (typeof onResizeFx === 'function') onResizeFx(); } // particle size (pointScale)
}
/* Allocated size of the targets (see RS): the profile density, or by quarters above it when the resolution climbs past it */
function rsSize() {
  RS.cap = Math.max(1, Math.ceil((gfxSet('dynres') === false ? 1 : RQ.scale) * 4 - 1e-6) / 4);
  const pr = basePixelRatio() * RS.cap;
  RS.cw = Math.max(1, Math.round(VIEW.w * pr)); RS.ch = Math.max(1, Math.round(VIEW.h * pr));
}
/* Drawn part of the targets (viewport and scissor) and the uniforms that depend on it */
function rsView() {
  const pr = renderPixelRatio(), cw = RS.cw, ch = RS.ch;
  const w = Math.min(cw, Math.max(1, Math.round(VIEW.w * pr))), h = Math.min(ch, Math.max(1, Math.round(VIEW.h * pr)));
  RS.w = w; RS.h = h;
  const tg = [composer.renderTarget1, composer.renderTarget2];
  if (ssaoPass) tg.push(ssaoPass.beautyRenderTarget, ssaoPass.normalRenderTarget, ssaoPass.ssaoRenderTarget, ssaoPass.blurRenderTarget);
  for (const t of tg) { t.viewport.set(0, 0, w, h); t.scissor.set(0, 0, w, h); t.scissorTest = w < cw || h < ch; }
  RS.u.value.set(w / cw, h / ch, (w - 0.5) / cw, (h - 0.5) / ch);
  const r = raysPass.rt, W = r.width, H = r.height, rw = Math.min(W, Math.max(1, Math.round(w / 2))), rh = Math.min(H, Math.max(1, Math.round(h / 2)));
  r.viewport.set(0, 0, rw, rh); r.scissor.set(0, 0, rw, rh); r.scissorTest = rw < W || rh < H;
  RS.ry.value.set(rw / W, rh / H, (rw - 0.5) / W, (rh - 0.5) / H);
  raysPass.mat.uniforms.uRes.value.set(rw, rh);
  if (ssaoPass) { ssaoPass.ssaoMaterial.uniforms.resolution.value.set(w, h); ssaoPass.blurMaterial.uniforms.resolution.value.set(w, h); }
  // 3D rendering smaller than the canvas: upscaling (EASU; bicubic without WebGL 2, sharper the larger the gap); 0: direct read
  const U = FinalShader.uniforms, ratio = (VIEW.h * canvasPixelRatio()) / h;
  U.uTexel.value.set(1 / w, 1 / h);
  U.uSharp.value = ratio > 1.001 ? 0.5 + clamp((ratio - 1) * 0.6, 0, 0.35) : 0;
}
/* Reads of an image pass (named samplers) brought into the rendered sub-rectangle: texture2D(t, uv) becomes texture2D(t, rsUv(uv, uRS)) */
function rsTex(mat, names) {
  let fs = mat.fragmentShader, out = '', i = 0;
  const re = new RegExp(`texture2D\\(\\s*(${names.join('|')})\\s*,`, 'g');
  for (let m; (m = re.exec(fs));) {
    let j = re.lastIndex, d = 1;
    for (; j < fs.length && d; j++) d += fs[j] === '(' ? 1 : fs[j] === ')' ? -1 : 0;
    out += fs.slice(i, re.lastIndex) + ' rsUv(' + fs.slice(re.lastIndex, j - 1) + ', uRS))'; i = re.lastIndex = j;
  }
  mat.fragmentShader = 'uniform vec4 uRS;\n' + RS_GLSL + out + fs.slice(i);
  mat.uniforms.uRS = RS.u; mat.needsUpdate = true;
}
/* Size of the 3D view. On iPhone (iOS 26 in particular), the reported height is sometimes shorter than the screen: when launching an installed app
   (home indicator) or under Safari's floating controls, which doesn't draw a fixed element all the way to the bottom. A canvas with
   "inset: 0" left a black band at the bottom, until the next recomputation. We take the greatest known height (window, visible viewport,
   document and, in an installed app, the screen itself), imposed on the canvas, the HUD and the menu background (--app-h); the projections (HUD,
   markers, levels of detail) all refer to it (VIEW). Rechecked when the view changes and in the seconds after launch. */
function viewMeasure() {
  const vv = window.visualViewport, de = document.documentElement;
  let h = Math.max(innerHeight, de.clientHeight || 0, vv ? Math.round(vv.height) : 0);
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios && screen.width && screen.height && matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches) {
    const sh = innerWidth > innerHeight ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height);
    if (sh > h && sh - h < 90) h = sh; // gap from a status bar or the home indicator, not a keyboard or a shared screen
  }
  return [innerWidth, h];
}
function viewSync() {
  const [w, h] = viewMeasure();
  if (VIEW.set && w === VIEW.w && h === VIEW.h) return false;
  VIEW.w = w; VIEW.h = h; VIEW.set = true;
  document.documentElement.style.setProperty('--app-h', h + 'px');
  return true;
}
function viewCheck() { if (viewSync()) onResize(); }
function onResize() {
  viewSync();
  const w = VIEW.w, h = VIEW.h;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  vmCamera.aspect = w / h; vmCamera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  FinalShader.uniforms.uRes.value.set(w, h);
  if (composer) { rsSize(); composer.setSize(RS.cw, RS.ch); rsView(); }
  if (typeof onResizeFx === 'function') onResizeFx();
  if (csm) { csm.updateFrustums(); tuneShadowLights(); }
}
/* ---------- Dynamic resolution ----------
   When frames arrive late because the graphics card is saturated, we lower the resolution (by 5 to 20%, dynDown; at the end of the
   profile range, next rung of AUTO_LADDER in automatic mode); we raise it by 5% after a few seconds of margin. Changing
   resolution recreates no target (rendering into a sub-rectangle, RS): no jolt, hence the small steps. Each failed climb
   lengthens the wait before the next (no oscillation), and a profile change (antialiasing, shadows, which
   recreates the render targets) requires confirmation: two slow windows in a row to go down, twice as much
   margin to go up. If the processor alone is at fault, lowering quality would be useless: we touch
   nothing. GPU time is measured directly when the browser allows it (EXT_disjoint_timer_query_webgl2): only
   then can the resolution rise above the profile (high-density screens), proven margin. */
/* High cadence: from 175 frames per second (240 Hz screens and up), bots (intelligence and animation) and shadow cascades no
   longer need to follow every frame. HF.k is 1 (nothing changes), 2 (240 Hz: bots and near shadows at 120 Hz) or 3 (360 Hz). The player, the
   camera, rendering and weapons stay at every frame. Thresholds with hysteresis: we go up at 175 and 340, down at 150 and 290. The cost of
   a frame at 280 frames per second is measured in tenths of a millisecond: a 3.6 ms frame budget leaves none for a garbage collection or
   a compute spike, and a missed screen refresh is then visible. */
const HF = { k: 1 };
function hfUpdate(fps) { HF.k = fps > (HF.k >= 3 ? 290 : 340) ? 3 : fps > (HF.k >= 2 ? 150 : 175) ? 2 : 1; }
/* ring: the last 256 intervals between two frames (excluding loading and hidden tab); the median frames per second hides isolated slow
   frames, which the player feels as jolts: worst and low1 (the slowest 1%) show them (dynStat) */
const DYN = { win: [], cpu: 0, gpu: 0, good: 0, need: 4, lastUp: -1e9, slow: 0, lagN: 0, stat: { fps: 0, ms: 0, worst: 0, worstC: 0, low1: 0 }, ring: new Float32Array(256), ringC: new Float32Array(256), tmp: new Float32Array(256), ri: 0 };
function dynStat() {
  const r = DYN.ring, t = DYN.tmp, n = Math.min(DYN.ri, 256); if (n < 30) return DYN.stat;
  let w = 0; for (let i = 0; i < n; i++) { t[i] = r[i]; if (r[i] > r[w]) w = i; }
  DYN.stat.worstC = DYN.ringC[w]; // compute time of that frame: much smaller than its interval, the delay is outside our code (browser, GPU, synchronization)
  const v = t.subarray(0, n).sort(); DYN.stat.worst = v[n - 1]; DYN.stat.low1 = v[Math.min(n - 1, Math.floor(n * 0.99))];
  return DYN.stat;
}
const GPUT = (() => {
  // not on phone: the first continuous render of a Pixel (aerial view, the only difference from the loading warm-up frame, which passed) lost the WebGL context
  // 0.7 s after its start; the timing queries, the only exotic graphics path of the frame loop, are ruled out (CPU time is enough for dynamic resolution)
  const gl = renderer.getContext(), ext = COARSE ? null : gl.getExtension('EXT_disjoint_timer_query_webgl2');
  if (!ext) return null;
  const T = { gl, ext, pending: [], active: null, ms: 0 };
  T.begin = () => { if (T.active || T.pending.length > 3) return; T.active = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, T.active); };
  T.end = () => { if (!T.active) return; gl.endQuery(ext.TIME_ELAPSED_EXT); T.pending.push(T.active); T.active = null; };
  T.poll = () => {
    while (T.pending.length && gl.getQueryParameter(T.pending[0], gl.QUERY_RESULT_AVAILABLE)) {
      const q = T.pending.shift(), ok = !gl.getParameter(ext.GPU_DISJOINT_EXT);
      if (ok) { const v = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; T.ms = T.ms ? T.ms * 0.85 + v * 0.15 : v; }
      gl.deleteQuery(q);
    }
    return T.ms;
  };
  return T;
})();
const FRAME_BUDGET = 1000 / 60;
/* ---------- Frame rate limit ----------
   Without a limit, a phone with a 120 Hz screen draws 120 frames per second and heats up (owner feedback, Pixel). Power saving (Settings.eco,
   on by default on touch): 30 frames per second; otherwise, the cap chosen in Options, Video (Settings.fpsMax, '0': no limit, 'half': half the screen refresh rate, see VSYNC). Image
   quality does not change, only the extra frames are skipped, menus included. A frame is drawn only if one period has elapsed since the
   previous one (to within 1 ms, frame timestamps follow the screen refresh): at 30 on a 60 Hz screen, every other frame, at 60 on
   120 Hz too. The period advances in a fixed step (no cadence drift), and restarts from the current frame after a pause or a big delay.
   Dynamic resolution then measures its frames against the period (frameBudget): otherwise 33 ms per frame would be mistaken for a GPU that is too slow. */
const CAP = { t: 0 };
function capMs() {
  if (!Settings.eco && Settings.fpsMax === 'half') return VSYNC.ms ? 2 * VSYNC.ms : 0;
  const f = Settings.eco ? 30 : +Settings.fpsMax || 0; return f > 0 ? 1000 / f : 0;
}
/* "Half the screen" (Settings.fpsMax 'half'): one frame every two refreshes, whatever the screen refresh rate (140 on a 280 Hz
   screen, 72 on 144 Hz). Owner's performance report (RTX 3070, 280 Hz screen, Port-Maël): frames land on multiples of the
   screen period, 3.6 ms (a quarter of the frames), 7.1 ms (six in ten), 10.7 ms; alternating between 280 and 140 frames per second gives an
   irregular cadence, at half it is even. The screen period is tracked on frame callbacks, drawn or not (vsyncTrack, at the start of frame):
   the shortest interval of each series of 60, smoothed; adopted immediately if it differs by more than a fifth (window moved to another screen). */
const VSYNC = { ms: 0, last: 0, min: Infinity, n: 0 };
function vsyncTrack(now) {
  const d = now - VSYNC.last; VSYNC.last = now;
  if (d <= 1 || d > 50) return;
  if (!VSYNC.ms) VSYNC.ms = d;
  if (d < VSYNC.min) VSYNC.min = d;
  if (++VSYNC.n < 60) return;
  const m = VSYNC.min; VSYNC.min = Infinity; VSYNC.n = 0;
  VSYNC.ms = Math.abs(m - VSYNC.ms) > VSYNC.ms * 0.2 ? m : VSYNC.ms + (m - VSYNC.ms) * 0.25;
}
function capWait(now) { const ms = capMs(), d = now - CAP.t; return ms > 0 && d >= 0 && d < ms - 1; }
function capTake(now) { const ms = capMs(), d = now - CAP.t; CAP.t = ms > 0 && d >= 0 && d < ms * 2 ? CAP.t + ms : now; }
function frameBudget() { return Math.max(FRAME_BUDGET, capMs()); }
/* ---------- Short frame queue ----------
   When the graphics card is the bottleneck, the processor gets ahead and the driver stacks up 2 to 3 already prepared frames: the mouse, read at the start of the frame,
   only shows up on screen after the whole queue (80 to 120 ms of lag on an integrated chip, while the display reports 60 frames per second). As long as the
   measured GPU time is close to the budget (LAG.on, decided by updateDynRes), a fence (fenceSync) follows each frame and the queue is bounded to one frame
   in flight on the GPU: if the second-to-last frame is not finished, the frame is skipped (lagSkip, before any mouse read) instead of being added to the
   queue. The previous frame, however, can still be drawn while the processor prepares the next one: the previous frame's fence (version 2.32.1
   and earlier) serialized processor and GPU, and as soon as their two times added up exceeded 16.7 ms, every other frame was skipped (exactly 30 frames per second
   on an integrated Intel chip, whatever the resolution). No effect when the GPU has headroom: the fence is always passed.
   Except when the driver signals its fences late (Radeon RX 580 on Windows, rendering through Direct3D 11: 20 frames per second, GPU busy at
   45%): the frame was then skipped two times out of three even though the GPU had finished. If the skipped frames drop the frame rate far below what
   the measured GPU time would allow, the short queue is turned off for the session (LAG.ban, updateDynRes).
   A skipped frame is visible (the same image stays on screen twice): owner feedback, October 2026, on an ultrabook with an entry-level
   eGPU, "60 frames per second displayed, but it stutters with the mouse in hand". An eGPU's fences arrive late (the
   cable), and until then the short queue was only turned off beyond 10 skipped frames out of 30 with a collapsed frame rate: a few
   skipped frames per second slipped under the median. Smoothness comes before this latency gain: more than 2 skipped frames out of 30, two readings
   in a row, and the short queue is turned off for the session (dynamic resolution, for its part, keeps lightening the GPU if it is the bottleneck). */
const LAG = { on: false, q: [], skips: 0, n: 0, ban: false, bad: 0 };
function lagDrop() {
  const gl = renderer.getContext();
  for (const f of LAG.q) { try { gl.deleteSync(f); } catch (e) { /* ignored */ } }
  LAG.q.length = 0;
}
function lagSkip() {
  if (LAG.q.length < 2) return false;
  const gl = renderer.getContext(); let r = 0;
  try { r = gl.clientWaitSync(LAG.q[0], 0, 0); } catch (e) { lagDrop(); return false; }
  if (r !== gl.TIMEOUT_EXPIRED) { LAG.skips = 0; return false; }
  if (++LAG.skips > 6) { lagDrop(); LAG.skips = 0; return false; } // frozen or very slow GPU: don't deprive the game of frames
  LAG.n++; return true;
}
function lagMark() {
  if (!LAG.on) { if (LAG.q.length) lagDrop(); return; }
  const gl = renderer.getContext();
  try { LAG.q.push(gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)); gl.flush(); } catch (e) { lagDrop(); LAG.on = false; return; }
  while (LAG.q.length > 2) { try { gl.deleteSync(LAG.q.shift()); } catch (e) { /* ignored */ } }
}
/* One quality step: dir = -1 lighter, +1 nicer, step: resolution delta (5% when going up). Returns false if nothing
   changes, 'wait' if the profile change is waiting for confirmation. */
function stepQuality(dir, step = 0.05) {
  if (QUALITY[gfxSet('quality')]) {
    const sc = clamp(Math.round((RQ.scale + dir * step) * 100) / 100, RQ.q.scaleMin, 1);
    if (sc === RQ.scale) return false;
    RQ.scale = sc; applyScale(); return true;
  }
  if (GFX_SAFE) return false; // economy mode, imposed profile
  // above 1 (starting profile only), a margin proven by the measured GPU time is required
  const [, lo, hi] = AUTO_LADDER[RQ.rung], room = DYN.gpu > 0 && DYN.gpu < FRAME_BUDGET * 0.5;
  const top = RQ.rung === RQ.rungMin ? (room && !Settings.eco ? Math.max(1, maxBoost()) : 1) : hi;
  const sc = Math.round((dir > 0 ? Math.min(RQ.scale + step, top) : Math.max(RQ.scale - step, lo)) * 100) / 100;
  if (dir > 0 ? sc > RQ.scale : sc < RQ.scale) { RQ.scale = sc; applyScale(); return true; }
  const r = RQ.rung - dir;
  if (r < RQ.rungMin || r >= AUTO_LADDER.length || (dir > 0 && RQ.scale < hi)) return false;
  if (dir < 0 ? DYN.slow < 2 : DYN.good < DYN.need * 2) return 'wait';
  RQ.rung = r; RQ.scale = AUTO_LADDER[r][dir < 0 ? 2 : 1]; resolveQuality(); applyQuality(); autoRungSave();
  return true;
}
/* Step down: proportional to the measured GPU time when it exceeds the budget (cost follows the number of pixels, the square of the scale;
   target: 75% of the budget), from 5 to 20%; without a measurement, 10% for very late frames, 5% otherwise */
function dynDown(med) {
  const b = frameBudget();
  if (DYN.gpu > b * 0.85) return clamp(RQ.scale * (1 - Math.sqrt((b * 0.75) / DYN.gpu)), 0.05, 0.2);
  return med > b * 1.4 ? 0.1 : 0.05;
}
function updateDynRes(now, intervalMs, cpuMs) {
  if (GPUT) DYN.gpu = GPUT.poll();
  if (now - GPUF.t0 < 5000) { DYN.win.length = 0; return; } // first seconds of continuous rendering (gpuFrame, 01a-gpu.js): late compilations, GPU warm-up; no recreation of render targets
  if (intervalMs > 250 || document.hidden) { DYN.win.length = 0; return; } // background tab, loading
  DYN.cpu = DYN.cpu ? DYN.cpu * 0.9 + cpuMs * 0.1 : cpuMs;
  DYN.ringC[DYN.ri & 255] = cpuMs; DYN.ring[DYN.ri++ & 255] = intervalMs; DYN.win.push(intervalMs); if (DYN.win.length < 30) return;
  const w = DYN.win.sort((a, b) => a - b), med = w[15], p90 = w[27]; DYN.win.length = 0;
  DYN.stat.fps = 1000 / med; DYN.stat.ms = med; hfUpdate(DYN.stat.fps);
  if (gfxSet('dynres') === false || MATCH.state === 'loading') { if (gfxSet('dynres') === false && LAG.on) { LAG.on = false; lagDrop(); } return; } // dynamic resolution off: short queue off too
  const budget = frameBudget(); // the frame rate limit period, if it is longer
  // a GPU at 95% of the budget holds 60 frames per second but fills the frame queue (mouse latency) and drops at the slightest spike: above 85%
  // (only if the screen is not much faster than 60 Hz), resolution is lowered; it only goes back up below 60% (hysteresis, see roomy)
  const gpuHot = DYN.gpu > budget * 0.85 && med > budget * 0.9;
  const slow = med > budget * 1.12 || p90 > budget * 1.6 || gpuHot;
  // the GPU is the bottleneck only if its measured time explains most of the interval between two frames: at 20 frames per second with 14 ms of GPU,
  // lowering quality would change nothing
  const gpuBound = DYN.gpu ? DYN.gpu > budget * 0.8 && DYN.gpu > med * 0.55 : DYN.cpu < med * 0.7;
  // fences signaled late: the short queue skips more than one frame in four and the frame rate falls far below what the GPU would hold
  const skipped = LAG.n - DYN.lagN; DYN.lagN = LAG.n;
  LAG.bad = LAG.on && skipped > 2 ? LAG.bad + 1 : 0;
  if (LAG.on && ((skipped > 10 && med > budget * 1.4 && DYN.gpu < med * 0.6) || LAG.bad >= 2)) { LAG.ban = true; LAG.on = false; lagDrop(); gpuLog(`short frame queue off: ${LAG.bad >= 2 ? 'frames skipped again and again' : 'late fences'} (${skipped} skipped, ${med.toFixed(0)} ms per frame, GPU ${DYN.gpu.toFixed(1)} ms)`); }
  // short queue: requires the measured GPU time (hysteresis 80% / 65%), not on phones (tiled rendering, nothing to gain)
  LAG.on = !COARSE && !LAG.ban && !!DYN.gpu && MATCH.state === 'playing' && DYN.gpu > budget * (LAG.on ? 0.65 : 0.8);
  // only upgrade if frames arrive on time: the measured GPU time counts neither the page compositing by the browser, nor what
  // an integrated graphics chip that shares its power with the processor costs the processor (a desktop PC at 40 frames per second, GPU measured
  // at 7 ms, raised its resolution up to 1.5 times and never lowered it again); with late frames, the resolution above the profile goes back down
  // first, whatever the measured GPU time
  const onTime = med <= budget * 1.04 && p90 < budget * 1.25;
  const roomy = onTime && (!DYN.gpu || DYN.gpu < budget * 0.6);
  if (slow && (gpuBound || RQ.scale > 1)) {
    DYN.good = 0; DYN.slow++;
    if (now - DYN.lastUp < 3000) DYN.need = Math.min(DYN.need * 2, 96); // the previous step up was one too many
    if (stepQuality(-1, dynDown(med)) === true) DYN.slow = 0;
  } else if (roomy) {
    DYN.slow = 0;
    if (++DYN.good >= DYN.need) { const r = stepQuality(1); if (r !== 'wait') DYN.good = 0; if (r === true) DYN.lastUp = now; }
  } else { DYN.slow = 0; DYN.good = Math.max(0, DYN.good - 1); }
}
addEventListener('resize', onResize);
if (window.visualViewport) visualViewport.addEventListener('resize', viewCheck);
addEventListener('orientationchange', () => { for (const ms of [120, 500, 1200]) setTimeout(viewCheck, ms); });
addEventListener('pageshow', () => { for (const ms of [0, 400]) setTimeout(viewCheck, ms); });
for (const ms of [300, 1000, 2500, 5000]) setTimeout(viewCheck, ms); // the right height sometimes only arrives after launch

/* Environment (reflections, ambient light of materials): the map's procedural sky, replaced by its HDRI as soon
   as it is loaded. HDRIs already converted stay in cache (returning to a map already played). */
let envMap = null;
const ENV_CACHE = new Map();
function setEnvMap(t) {
  if (envMap && envMap !== t && ![...ENV_CACHE.values()].includes(envMap)) envMap.dispose();
  envMap = t; scene.environment = t; vmScene.environment = t;
  buildEnvCubes(t);
}
function buildEnvironment() {
  const A = CURMAP.def ? CURMAP.def.atmo : ATMO_DEFAULT;
  const pm = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const s2 = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
    uniforms: SkyShader.uniforms, vertexShader: SkyShader.vertexShader.replace('p.xyww', 'p'), fragmentShader: SkyShader.fragmentShader, side: THREE.BackSide, defines: { ...skyMat.defines },
  }));
  envScene.add(s2);
  const g = new THREE.Mesh(new THREE.CircleGeometry(49, 24), new THREE.MeshBasicMaterial({ color: A.envGround }));
  g.rotation.x = -Math.PI / 2; g.position.y = -2; envScene.add(g);
  setEnvMap(pm.fromScene(envScene, 0.03).texture);
  pm.dispose();
  for (const m of [s2, g]) { m.geometry.dispose(); m.material.dispose(); }
}

/* ---------- Ambient lighting in cube maps ----------
   three.js stores the filtered ambient lighting (PMREM) in a 2D atlas: each read looks up the cube face, its
   coordinates and its place in the atlas (heavily branching code), twice to interpolate between two blur levels, and
   a third time for the diffuse light. Measured: over a third of the main pass. At load time, we therefore copy
   each PMREM level, read by its own function (bilinearCubeUV, hence exactly the same blur), into two real
   mipmapped cube maps: "glossy" (sharp levels, 256 to 16 pixels) and "matte" (blurry levels, oversampled).
   The shader then does only one hardware trilinear read per term, and interpolation between two neighboring levels
   is the PMREM's (linear in level). Without WebGL 2, three.js's code is kept. */
const ENVC = { on: renderer.capabilities.isWebGL2, gloss: { value: null }, rough: { value: null }, rtG: null, rtR: null };
if (ENVC.on) {
  const src = THREE.ShaderChunk.envmap_physical_pars_fragment;
  if (src.indexOf('vec3 getIBLIrradiance') < 0 || src.indexOf('vec3 getIBLRadiance') < 0) ENVC.on = false; // unexpected three.js
  else THREE.ShaderChunk.envmap_physical_pars_fragment = `#if defined( USE_ENVMAP ) && defined( ENV_CUBES ) && defined( ENVMAP_TYPE_CUBE_UV )
	#ifdef WM_NOGLOSS
	uniform highp samplerCube uEnvRough;
	#else
	uniform highp samplerCube uEnvGloss, uEnvRough;
	#endif
	// PMREM blur level for this roughness (roughnessToMip), read from the cube map that holds it; WM_NOGLOSS: without the glossy cube map (one texture unit
	// less, for phone floors), the sharp levels are replaced by the sharpest of the matte levels
	vec3 envCubeSample( vec3 dir, float roughness ) {
		float m = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		#ifdef WM_NOGLOSS
		if ( m >= 3.0 ) return textureLod( uEnvRough, dir, 0.0 ).rgb;
		#else
		if ( m >= 4.0 ) return textureLod( uEnvGloss, dir, CUBEUV_MAX_MIP - m ).rgb;
		if ( m >= 3.0 ) return mix( textureLod( uEnvRough, dir, 0.0 ).rgb, textureLod( uEnvGloss, dir, CUBEUV_MAX_MIP - 4.0 ).rgb, m - 3.0 );
		#endif
		return textureLod( uEnvRough, dir, 3.0 - m ).rgb;
	}
	vec3 getIBLIrradiance( const in vec3 normal ) {
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		return PI * textureLod( uEnvRough, worldNormal, 5.0 ).rgb * envMapIntensity;
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		vec3 reflectVec = reflect( - viewDir, normal );
		reflectVec = normalize( mix( reflectVec, normal, roughness * roughness ) );
		reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
		return envCubeSample( reflectVec, roughness ) * envMapIntensity;
	}
#else
` + src + `
#endif
`;
}
/* Hooks the cube lighting onto a standard material (called by onBeforeCompile) */
function envCubeHook(shader) {
  if (!ENVC.on || shader.envCube) return;
  shader.envCube = true;
  shader.uniforms.uEnvGloss = ENVC.gloss; shader.uniforms.uEnvRough = ENVC.rough;
  shader.fragmentShader = '#define ENV_CUBES\n' + shader.fragmentShader;
}
// all standard materials, in the scene as well as the first-person view; cascaded shadow materials go through csmMaterial
THREE.MeshStandardMaterial.prototype.onBeforeCompile = function (shader) { envCubeHook(shader); };
/* Copy of PMREM pm into the two cube maps (at load, and when HDRI lighting replaces procedural lighting) */
function buildEnvCubes(pm) {
  if (!ENVC.on || !pm || !pm.image || !pm.image.height) return;
  const H = pm.image.height, maxMip = Math.round(Math.log2(H) - 2), gs = 2 ** maxMip;
  const mk = (size) => new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  if (!ENVC.rtG || ENVC.rtG.width !== gs) { if (ENVC.rtG) ENVC.rtG.dispose(); ENVC.rtG = mk(gs); }
  if (!ENVC.rtR) ENVC.rtR = mk(256);
  const mat = new THREE.ShaderMaterial({
    defines: { ENVMAP_TYPE_CUBE_UV: '', CUBEUV_MAX_MIP: maxMip + '.0', CUBEUV_TEXEL_WIDTH: 1 / (3 * Math.max(2 ** maxMip, 7 * 16)), CUBEUV_TEXEL_HEIGHT: 1 / H },
    uniforms: { envMap: { value: pm }, uFace: { value: 0 }, uMip: { value: 0 }, uSize: { value: 1 } },
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
    // texel direction following the GL cube map convention (face, coordinates s and t)
    fragmentShader: `uniform highp sampler2D envMap; uniform float uFace, uMip, uSize;
      #include <cube_uv_reflection_fragment>
      void main() {
        vec2 st = gl_FragCoord.xy / uSize * 2.0 - 1.0; vec3 d;
        if (uFace < 0.5) d = vec3(1.0, -st.y, -st.x); else if (uFace < 1.5) d = vec3(-1.0, -st.y, st.x);
        else if (uFace < 2.5) d = vec3(st.x, 1.0, st.y); else if (uFace < 3.5) d = vec3(st.x, -1.0, -st.y);
        else if (uFace < 4.5) d = vec3(st.x, -st.y, 1.0); else d = vec3(-st.x, -st.y, -1.0);
        gl_FragColor = vec4(bilinearCubeUV(envMap, normalize(d), uMip), 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const quad = new THREE.FullScreenQuad(mat), prev = renderer.getRenderTarget(), U = mat.uniforms;
  // level 0 first (generated mipmaps allocate all levels), then each level copied from the PMREM
  const fill = (rt, levels, mipOf) => {
    rt.texture.generateMipmaps = true;
    for (let L = 0; L < levels; L++) {
      if (L === 1) rt.texture.generateMipmaps = false;
      const sz = Math.max(1, rt.width >> L); rt.viewport.set(0, 0, sz, sz);
      U.uMip.value = mipOf(L); U.uSize.value = sz;
      for (let f = 0; f < 6; f++) { U.uFace.value = f; renderer.setRenderTarget(rt, f, L); quad.render(renderer); }
    }
    rt.viewport.set(0, 0, rt.width, rt.width);
  };
  fill(ENVC.rtG, maxMip - 3, (L) => maxMip - L); // PMREM levels maxMip (sharp) to 4
  fill(ENVC.rtR, 6, (L) => 3 - L); // PMREM levels 3 to -2 (roughness 1)
  renderer.setRenderTarget(prev);
  // no quad.dispose(): it would free the fullscreen geometry shared by all passes (see buildSatelliteMap)
  mat.dispose();
  ENVC.gloss.value = ENVC.rtG.texture; ENVC.rough.value = ENVC.rtR.texture;
}

/* ---------- CC0 resources ---------- */
/* Photo textures (Poly Haven, ambientCG): one file per surface next to the page (dist/tex/, see build.py), loaded by
   a script tag (works with file:// too) at launch of the first map that uses it; the file calls
   texPack(key, data). Missing key or unreachable file: the nearest procedural surface replaces it. */
const TEX_PACKS = /*__TEX_PACKS__*/ {};
const TEXP = new Map(); // key -> function that receives the data
function texPack(key, d) { const f = TEXP.get(key); if (f) f(d); }
function fetchTexPack(key) {
  if (!TEX_PACKS[key]) return Promise.resolve(null);
  return new Promise((res) => {
    const s = document.createElement('script');
    const done = (d) => { if (!TEXP.has(key)) return; TEXP.delete(key); clearTimeout(timer); s.remove(); res(d); };
    const timer = setTimeout(() => done(null), 30000);
    TEXP.set(key, done);
    s.onerror = () => done(null);
    s.src = TEX_PACKS[key]; document.head.appendChild(s);
  });
}
/* Loads and decodes the requested surfaces into T; onOne() after each one (progress) */
function loadAssetTextures(T, keys, onOne) {
  const L = new THREE.TextureLoader();
  const one = (url, srgb) => new Promise((res, rej) => L.load(url, (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.encoding = THREE.sRGBEncoding; res(t); }, undefined, rej));
  return Promise.all(keys.map((k) => fetchTexPack(k)
    .then((d) => d && Promise.all([one(d.map, true), one(d.normal, false), one(d.rough, false)]))
    .then((r) => { if (r) T[k] = { map: r[0], normal: r[1], rough: r[2], asset: true }; })
    .catch(() => null)
    .then(() => { if (onOne) onOne(k); })));
}
/* Ambient lighting: HDRIs from Poly Haven ("sunset" for Chergui, "sky" for Saint-Givre), CC0, taken from @pmndrs/assets and served
   by the site (tools/vendor.py): texPack package hdri_<name>, the base64 string of the EXR file. */
/* Downloads per HDRI (name -> { ready, t0 }): the one for the last chosen map starts at startup, the
   others at their map's load, which waits for them at most 6 s after they start (otherwise procedural lighting) */
const HDRI = { jobs: new Map() };
const HDRI_BUSY = ['playing', 'killcam', 'finish'];
function hdriFetch(name) {
  let j = HDRI.jobs.get(name);
  if (!j) { j = { t0: performance.now(), ready: null }; HDRI.jobs.set(name, j); j.ready = loadHDRIEnvironment(name); }
  return j;
}
async function loadHDRIEnvironment(name) {
  const wanted = () => CURMAP.def && CURMAP.def.atmo.hdri === name; // the map may have changed in the meantime
  if (ENV_CACHE.has(name)) { if (wanted()) setEnvMap(ENV_CACHE.get(name)); return true; }
  if (!THREE.EXRLoader || GPUX.lean.hdri) return false; // GPUX.lean.hdri: learned adaptation (01a-gpu.js), the procedural sky is enough
  try {
    const b64 = await fetchTexPack('hdri_' + name);
    if (!b64) return false;
    const bin = atob(b64), buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    const loader = new THREE.EXRLoader(); loader.setDataType(THREE.HalfFloatType);
    const d = loader.parse(buf.buffer);
    // arrived mid-match: the conversion (renders on the GPU) and the lighting change (possible recompilations) wait for a pause or the end of the match
    while (HDRI_BUSY.includes(MATCH.state)) await new Promise((r) => setTimeout(r, 1000));
    if (ENV_CACHE.has(name)) { if (wanted()) setEnvMap(ENV_CACHE.get(name)); return true; }
    const tex = new THREE.DataTexture(d.data, d.width, d.height, d.format, d.type);
    tex.encoding = THREE.LinearEncoding; tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.flipY = false;
    tex.mapping = THREE.EquirectangularReflectionMapping; tex.needsUpdate = true;
    const pm = new THREE.PMREMGenerator(renderer);
    const env = pm.fromEquirectangular(tex).texture;
    pm.dispose(); tex.dispose();
    ENV_CACHE.set(name, env);
    if (wanted()) setEnvMap(env);
    return true;
  } catch (e) { console.warn('HDRI unavailable, procedural lighting kept', e); return false; }
}

/* Cascades rendered one by one: three.js tests objects' layers against those of the main camera; for the
   far cascade, LAYER_NEAR is temporarily removed from the camera (small objects cast nothing there). */
const SHADOW_FAR = { light: null, lights: [] };
{
  const sm = renderer.shadowMap, render = sm.render.bind(sm);
  sm.render = function (lights, sc, cam) {
    // cascades without small objects: the far one; at Low and Minimal quality, all but the nearest
    const far = csm ? (RQ.q.lean ? csm.lights.slice(1) : [SHADOW_FAR.light]) : [];
    const farL = lights.filter((l) => far.includes(l));
    if (!farL.length || farL.length === lights.length) { render(lights, sc, cam); return; }
    const mask = cam.layers.mask, need = sm.needsUpdate;
    try {
      render(lights.filter((l) => !far.includes(l)), sc, cam);
      sm.needsUpdate = need; cam.layers.disable(LAYER_NEAR);
      render(farL, sc, cam);
    } finally { cam.layers.mask = mask; }
  };
}
/* Shadows recomputed only once per frame (SSAO renders the scene several times) */
renderer.shadowMap.autoUpdate = false;
const _sunP = new V3();
function updatePostFx() {
  renderer.shadowMap.needsUpdate = true;
  if (ssaoPass && ssaoPass.enabled) {
    const u = ssaoPass.ssaoMaterial.uniforms;
    u.cameraProjectionMatrix.value.copy(camera.projectionMatrix); u.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
    u.cameraNear.value = camera.near; u.cameraFar.value = camera.far;
    ssaoPass.depthRenderMaterial && (ssaoPass.depthRenderMaterial.uniforms.cameraNear.value = camera.near);
    ssaoPass.blurMaterial.uniforms.resolution && ssaoPass.blurMaterial.uniforms.resolution.value.set(RS.w, RS.h); // rendered part (RS)
  }
  // sun position on screen for the rays and lens reflections
  camera.updateMatrixWorld();
  _sunP.copy(camera.position).addScaledVector(SUN_DIR, 400).project(camera);
  const f = camera.getWorldDirection(_v1).dot(SUN_DIR);
  const U = FinalShader.uniforms, sx = _sunP.x * 0.5 + 0.5, sy = _sunP.y * 0.5 + 0.5;
  U.uSun.value.set(sx, sy);
  const off = Math.max(0, Math.max(Math.abs(sx - 0.5), Math.abs(sy - 0.5)) - 0.5);
  U.uSunOn.value = f > 0 ? smoothstep(0.0, 0.25, f) * (1 - smoothstep(0.0, 0.35, off)) : 0;
}
