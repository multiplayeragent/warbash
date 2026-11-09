/* ==========================================================================
   3D WEAPON SHOWCASE: previews (thumbnails) and the class workshop view
   The weapon is rendered by the game engine (same materials, same ambient lighting as the match) in a corner of the main
   canvas, which the menus don't draw; the result is immediately copied into a 2D canvas of the interface. No
   second WebGL context: nothing more to compile, and the rendering of materials (camos included) is that of the match.
   - Thumbnails: one image per weapon (side view), built in the background after startup, one weapon at a time.
   - Thumbnails and starting view: the weapon is centered from what is seen of it (vwScreenBox, vwFrame), not from its box, which perspective
     and attachments shift.
   - View: the workshop's weapon, from the side and still, which can be rotated (drag), brought closer (wheel) or reset (double click); "+"
     dots placed on the model open the attachment list for each slot (see 09n-armory.js).
   ========================================================================== */
const VW_BG = 0x181b14, VW_FOV = 24;
const VWS = { scene: null, cam: null };
const _vwV2 = new THREE.Vector2(), _vwCol = new THREE.Color();

/* Lighting scene shared by the thumbnails and the view: the map's ambience, a front light, a back light */
function vwScene() {
  if (VWS.scene) return VWS;
  const sc = new THREE.Scene();
  const key = new THREE.DirectionalLight(0xfff0dc, 2.4); key.position.set(-1.2, 2, 1.4); sc.add(key);
  const fill = new THREE.DirectionalLight(0x9db4d8, 0.9); fill.position.set(1.5, 0.6, -1); sc.add(fill);
  sc.add(new THREE.HemisphereLight(0xdfe8ff, 0x2a2418, 0.55));
  VWS.scene = sc; VWS.cam = new THREE.PerspectiveCamera(VW_FOV, 2, 0.02, 12);
  return VWS;
}
/* Distance of a VW_FOV-field camera so that a weapon of size sz fits in the frame (side view) */
function vwFit(sz, aspect, margin) {
  const vf = THREE.MathUtils.degToRad(VW_FOV), hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
  return Math.max(sz.z / 2 / Math.tan(hf / 2), sz.y / 2 / Math.tan(vf / 2)) * margin + sz.x / 2;
}
/* Rectangle (image coordinates from -1 to 1) covered, as seen by the camera, by the model's visible vertices: perspective and attachments
   (suppressor, grip, optic) shift the weapon's center from the center of its box, this calculation is exact */
function vwScreenBox(group, cam) {
  group.updateMatrixWorld(true); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const v = _vwFV;
  group.traverseVisible((o) => {
    const p = o.isMesh && o.geometry && o.geometry.attributes.position; if (!p) return;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).project(cam);
      if (v.x < x0) x0 = v.x; if (v.x > x1) x1 = v.x; if (v.y < y0) y0 = v.y; if (v.y > y1) y1 = v.y;
    }
  });
  return x1 > x0 && y1 > y0 ? { x0, x1, y0, y1 } : null;
}
/* Shifts the projection so the rectangle is at the center of the image and, if fill > 0, enlarges it so that it takes up the fraction fill (without changing the perspective) */
function vwFrame(cam, box, fill) {
  if (!box) return;
  const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2, s = fill > 0 ? Math.min(2 * fill / (box.x1 - box.x0), 2 * fill / (box.y1 - box.y0)) : 1, e = cam.projectionMatrix.elements;
  e[0] *= s; e[5] *= s; e[8] = s * (e[8] + cx); e[9] = s * (e[9] + cy);
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
}
const _vwFV = new V3();
/* Places the camera: azimuth a (0: view from the left of the weapon, muzzle at the left of the image), height p, distance d */
function vwCamPlace(cam, a, p, d, aim) {
  cam.position.set(aim.x - Math.cos(a) * Math.cos(p) * d, aim.y + Math.sin(p) * d, aim.z - Math.sin(a) * Math.cos(p) * d);
  cam.lookAt(aim);
}
/* Renders the scene into an offscreen render target (W x H pixels), reads it back (readRenderTargetPixels) and puts it in ctx (dw x dh); all engine state changed for
   the occasion is restored. Never in the main canvas: rendering into the canvas buffer then copying it (drawImage of a WebGL canvas) while the aerial view
   was displayed made a Pixel (PowerVR) lose its WebGL context, 0.6 s after the class choice opened, when the thumbnails resumed. The target has the
   sRGB encoding (hardware conversion on write): same image as before, when three.js converted to the canvas. */
const VWT = { rt: null, px: null, img: null, tmp: null };
function vwDraw(ctx, dw, dh, W, H) {
  const r = renderer, w = Math.max(2, Math.min(2048, Math.floor(W))), h = Math.max(2, Math.min(2048, Math.floor(H)));
  if (!VWT.rt) { VWT.rt = new THREE.WebGLRenderTarget(w, h); VWT.rt.texture.encoding = THREE.sRGBEncoding; }
  else if (VWT.rt.width !== w || VWT.rt.height !== h) VWT.rt.setSize(w, h);
  if (!VWT.px || VWT.px.length !== w * h * 4) { VWT.px = new Uint8Array(w * h * 4); VWT.img = new ImageData(w, h); }
  const keep = { rt: r.getRenderTarget(), tm: r.toneMapping, ex: r.toneMappingExposure, ac: r.autoClear, cc: r.getClearColor(_vwCol).clone(), ca: r.getClearAlpha() };
  const S = vwScene(); S.scene.environment = envMap;
  r.setRenderTarget(VWT.rt); r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1; r.autoClear = true; r.setClearColor(VW_BG, 1);
  r.render(S.scene, S.cam);
  r.readRenderTargetPixels(VWT.rt, 0, 0, w, h, VWT.px);
  r.setRenderTarget(keep.rt); r.toneMapping = keep.tm; r.toneMappingExposure = keep.ex; r.autoClear = keep.ac; r.setClearColor(keep.cc, keep.ca);
  // rows from bottom to top (WebGL) to the 2D canvas (top to bottom)
  const d = VWT.img.data, row = w * 4;
  for (let y = 0; y < h; y++) d.set(VWT.px.subarray((h - 1 - y) * row, (h - y) * row), y * row);
  if (dw === w && dh === h) ctx.putImageData(VWT.img, 0, 0);
  else {
    if (!VWT.tmp) VWT.tmp = document.createElement('canvas');
    if (VWT.tmp.width !== w || VWT.tmp.height !== h) { VWT.tmp.width = w; VWT.tmp.height = h; }
    VWT.tmp.getContext('2d').putImageData(VWT.img, 0, 0); ctx.drawImage(VWT.tmp, 0, 0, dw, dh);
  }
}
/* Weapon built for the showcase, centered on the origin; returns { info, size } */
function vwModel(key) {
  const info = buildGunModel(key), g = info.group;
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new V3()), size = box.getSize(new V3());
  const anchors = vwAnchors(info); // in the weapon's frame, before centering it
  g.position.sub(c); g.updateMatrixWorld(true);
  return { info, size, center: c, anchors };
}

/* ---------- Thumbnails ---------- */
const VTHUMB = { w: 440, h: 176, img: {}, queue: [], busy: false, ctx: null, ready: false, fails: {} };
const VBLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // transparent pixel while waiting for the thumbnail
const weaponThumb = (id) => VTHUMB.img[id] || VBLANK;
/* Draws the thumbnail of the mounted weapon key (side view) and keeps it; returns its address ('' on failure: the attempt is noted, three at most,
   and reported in the graphics report, instead of permanently replacing the thumbnail with the bare weapon's) */
function thumbRender(key) {
  try {
    if (!VTHUMB.ctx) { const cv = document.createElement('canvas'); cv.width = VTHUMB.w; cv.height = VTHUMB.h; VTHUMB.ctx = cv.getContext('2d'); }
    const { info, size } = vwModel(key), S = vwScene(), live = VW.model && VW.model.visible ? VW.model : null; // the view's weapon, if open, must not appear on the thumbnail
    if (live) live.visible = false;
    S.scene.add(info.group);
    S.cam.aspect = VTHUMB.w / VTHUMB.h; S.cam.updateProjectionMatrix();
    vwCamPlace(S.cam, 0.3, 0.1, vwFit(size, VTHUMB.w / VTHUMB.h, 1.1), new V3());
    vwFrame(S.cam, vwScreenBox(info.group, S.cam), 0.92); // weapon centered and framed from what is seen, not from its box
    vwDraw(VTHUMB.ctx, VTHUMB.w, VTHUMB.h, VTHUMB.w, VTHUMB.h);
    S.scene.remove(info.group);
    if (live) live.visible = true;
    VTHUMB.img[key] = VTHUMB.ctx.canvas.toDataURL('image/webp', 0.9);
  } catch (e) { VTHUMB.fails[key] = (VTHUMB.fails[key] || 0) + 1; delete VTHUMB.img[key]; gpuLog('weapon thumbnail failed: ' + key + ' (' + VTHUMB.fails[key] + ') ' + (e && e.message)); return ''; }
  return VTHUMB.img[key];
}
/* Thumbnail of a weapon with its attachments and camo. Never drawn on demand: a class ends up in the drawing queue
   (thumbsWant), which works in the menus and in pause, one thumbnail per task (a burst of renders makes some
   phones lose the context). Meanwhile, the bare weapon: the image is dimmed (data-pend) so it isn't mistaken for the class. */
function weaponThumbKey(key, id) {
  if (key === id || !VTHUMB.ready) return weaponThumb(id);
  if (!VTHUMB.img[key]) { thumbsWant(key); return weaponThumb(id); }
  return VTHUMB.img[key];
}
/* To draw as soon as allowed, before the bare weapons (an equipped class shows right away) */
function thumbsWant(key) {
  if (VTHUMB.img[key] || (VTHUMB.fails[key] || 0) >= 3 || VTHUMB.queue.includes(key)) return;
  VTHUMB.queue.unshift(key);
  if (!VTHUMB.busy) { VTHUMB.busy = true; setTimeout(thumbsStep, 60); }
}
/* Thumbnails are only rendered in the menus and in a match's pause (the match waits there): not while playing or loading. At the class
   choice before deployment (aerial view: the GPU draws constantly there), on desktop only, and only the weapons, one per
   third of a second: with the page reloaded after a long idle period (tab freed by the browser), a match started right away did not
   have its thumbnails yet and the class cards stayed empty until back at the menu. On phones, nothing in the aerial view (see the context
   loss on a Pixel in the README): the classes' weapons go to the head of the queue (thumbsStart), ready before a match is launched */
// (UI.screen stays "deploy" throughout the match: only the match state says whether we are at the class choice before deployment)
const thumbsDeploy = () => MATCH.state === 'menu' && UI.screen === 'deploy';
const thumbsAllowed = () => !UI.busy && MAPL.state !== 'loading' && (MATCH.state === 'paused' || (MATCH.state === 'menu' && (!thumbsDeploy() || !COARSE)));
/* Starts (or resumes) building the missing thumbnails, one per task, as long as no match is being prepared: the classes' weapons
   first (mounted, then bare: what the class choice shows), the other weapons, then the outfits (the longest to draw;
   the Outfits screen moves ahead the ones it shows) */
function thumbsStart() {
  VTHUMB.ready = true;
  const mine = [], bare = []; for (const i of classIds()) for (const d of classWeapons(i)) {
    if (d.key !== d.id && !VTHUMB.img[d.key] && (VTHUMB.fails[d.key] || 0) < 3 && !mine.includes(d.key)) mine.push(d.key);
    if (!VTHUMB.img[d.id] && !bare.includes(d.id)) bare.push(d.id);
  }
  const sk = (l) => l.map((s) => 'skin:' + s).filter((k) => !VTHUMB.img[k]);
  VTHUMB.queue = [...mine, ...bare, ...Object.keys(WEAPONS).filter((id) => !VTHUMB.img[id] && !bare.includes(id)), ...sk(SKIN_IDS), ...sk(SKIN_CHALLENGE), ...sk(skinOwned())];
  if (!VTHUMB.busy && VTHUMB.queue.length) { VTHUMB.busy = true; setTimeout(thumbsStep, 60); }
}
function thumbsStep() {
  if (!thumbsAllowed()) { setTimeout(thumbsStep, 600); return; } // not during a match or a load
  if (!VTHUMB.queue.length) { VTHUMB.busy = false; gpuLog('weapon thumbnails done'); return; }
  const dep = thumbsDeploy(), at = dep ? VTHUMB.queue.findIndex((k) => !k.startsWith('skin:')) : 0;
  if (at < 0) { setTimeout(thumbsStep, 600); return; } // aerial view: outfits wait for the return to the menus
  const id = VTHUMB.queue.splice(at, 1)[0];
  const skin = id.startsWith('skin:');
  if (!WEAPONS[id] && !skin) { // mounted weapon: workshop trials that are no longer a class are freed (memory stays bounded)
    const keep = new Set(); for (const i of classIds()) for (const d of classWeapons(i)) keep.add(d.key);
    const old = Object.keys(VTHUMB.img).filter((k) => !WEAPONS[k] && !keep.has(k) && !k.startsWith('skin:'));
    if (old.length > 30) for (const k of old.slice(0, 15)) delete VTHUMB.img[k];
  }
  const src = VTHUMB.img[id] || (skin ? skinThumbRender(id.slice(5)) : thumbRender(id));
  if (src) for (const el of document.querySelectorAll(`img[data-thumb="${id}"]`)) { el.src = src; el.removeAttribute('data-pend'); }
  setTimeout(thumbsStep, dep ? 330 : MATCH.state === 'paused' ? 260 : 40); // pause in a match, class choice: one thumbnail per quarter or third of a second
}

/* ---------- Workshop visual ---------- */
const VW = {
  host: null, cv: null, ctx: null, hotEl: null, info: null, size: new V3(1, 1, 1), model: null, key: '',
  a: 0.3, p: 0.1, d: 1, fit: 1, shift: null, needShift: true, drag: null, W: 0, H: 0, hot: {}, anchors: {}, labelOf: null, onHot: null, hotOff: null, still: false,
};
/* Anchor points of the attachment slots, in the weapon's frame (z toward the stock): placed on the left flank, where
   the attachment mounts, from the model's mount points (info.mount) */
function vwAnchors(info) {
  const m = info.mount, A = {}, X = -0.034;
  if (m.optic) A.optic = [0, m.optic.y + (info.kind === 'pistol' ? 0.024 : 0.04), m.optic.z];
  if (m.muzzle) {
    A.muzzle = [X * 0.4, m.muzzle.y + 0.01, m.muzzle.z - 0.02];
    if (info.kind !== 'pistol') A.barrel = [X * 0.4, m.muzzle.y + 0.012, m.muzzle.z * (info.kind === 'sniper' ? 0.62 : 0.8)];
  }
  if (m.under) A.under = [0, m.under.y - 0.04, m.under.z];
  if (m.side) A.side = [m.side.x - 0.012, m.side.y, m.side.z];
  const mag = new THREE.Box3().setFromObject(info.mag);
  if (!info.tubeFed && mag.max.y > mag.min.y) { const c = mag.getCenter(new V3()); A.mag = [X, c.y, c.z]; }
  else if (info.tubeFed && m.side) A.mag = [X * 0.5, 0.008 - 0.03, m.side.z - 0.03];
  if (info.butt) A.stock = [X, info.butt[1] + 0.012, info.butt[2] - 0.08];
  A.ammo = info.kind === 'pistol' ? [X * 0.5, info.eject.position.y - 0.012, info.eject.position.z - 0.06] : [info.eject.position.x + 0.012, info.eject.position.y, info.eject.position.z + 0.1];
  // one dot per slot group (ATT_GROUPS): the group's first slot that has a position
  const G = {};
  for (const g of ATT_GROUPS) { const s = ATT_GROUP_SLOTS[g].find((x) => A[x]); if (s) G[g] = A[s]; }
  return G;
}
/* Mounts the showcase in host (created once by the workshop): 2D canvas, dot layer, mouse and touch inputs */
function vwMount(host, hooks) {
  VW.host = host; VW.labelOf = hooks.labelOf; VW.onHot = hooks.onHot; VW.hotOff = hooks.hotOff || null;
  host.innerHTML = _t('<canvas class="vw-cv" aria-hidden="true"></canvas><div class="vw-hot"></div><div class="vw-count"></div><div class="vw-corner"></div><div class="vw-help">Drag to rotate · scroll to zoom</div>');
  VW.cv = host.firstChild; VW.ctx = VW.cv.getContext('2d'); VW.hotEl = host.querySelector('.vw-hot');
  VW.hotEl.addEventListener('click', (e) => { const b = e.target.closest('.hot'); if (b) { VW.onHot(b.dataset.slot, b); sfxUi('click'); } });
  VW.cv.addEventListener('pointerdown', (e) => { VW.drag = { x: e.clientX, y: e.clientY, a: VW.a, p: VW.p }; VW.cv.setPointerCapture(e.pointerId); host.classList.add('drag'); });
  VW.cv.addEventListener('pointermove', (e) => {
    if (!VW.drag) return;
    VW.a = VW.drag.a - (e.clientX - VW.drag.x) * 0.009; VW.p = clamp(VW.drag.p + (e.clientY - VW.drag.y) * 0.006, -0.35, 1.05); VW.still = false;
  });
  const up = () => { VW.drag = null; host.classList.remove('drag'); };
  VW.cv.addEventListener('pointerup', up); VW.cv.addEventListener('pointercancel', up);
  VW.cv.addEventListener('wheel', (e) => { e.preventDefault(); VW.d = clamp(VW.d * Math.exp(e.deltaY * 0.0012), VW.fit * 0.45, VW.fit * 1.5); }, { passive: false });
  VW.cv.addEventListener('dblclick', () => vwReset());
  // keyboard: arrows to rotate when the canvas has focus
  VW.cv.tabIndex = 0; VW.cv.setAttribute('aria-label', _t('3D weapon, arrow keys to rotate it'));
  VW.cv.addEventListener('keydown', (e) => {
    const k = e.key; if (k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'ArrowUp' && k !== 'ArrowDown') return;
    e.preventDefault();
    if (k === 'ArrowLeft') VW.a += 0.12; else if (k === 'ArrowRight') VW.a -= 0.12; else VW.p = clamp(VW.p + (k === 'ArrowDown' ? 0.08 : -0.08), -0.35, 1.05);
  });
}
/* Starting view: the weapon from the side, still (rotate by dragging) and centered in the frame */
function vwReset() { VW.a = 0.3; VW.p = 0.1; VW.d = VW.fit; VW.shift = null; VW.needShift = true; }
/* The displayed weapon becomes the given key; the "+" dots follow the weapon's anchor points (groups: ATT_GROUPS); reset: back to the starting view */
function vwSet(key, groups, reset) {
  const S = vwScene();
  if (VW.model) S.scene.remove(VW.model);
  const m = vwModel(key); VW.info = m.info; VW.model = m.info.group; VW.size = m.size; VW.key = key; S.scene.add(VW.model);
  VW.anchors = m.anchors;
  // the dots: one button per slot the weapon has
  VW.hotEl.innerHTML = '';
  VW.hot = {};
  for (const slot of ATT_GROUPS) {
    if (!groups.includes(slot) || !VW.anchors[slot]) continue;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'hot'; b.dataset.slot = slot;
    VW.hotEl.appendChild(b); VW.hot[slot] = { el: b, p: new V3(...VW.anchors[slot]) };
  }
  vwLabels(); vwSize(true);
  if (reset) vwReset(); else { VW.d = clamp(VW.d, VW.fit * 0.45, VW.fit * 1.5); }
}
/* Dot labels ("+" or the name of the attached accessory), requested again from the workshop; all hidden when the workshop asks (hotOff:
   the camo list, opened on top, partly covered them) */
function vwLabels() {
  if (VW.hotEl) VW.hotEl.hidden = !!(VW.hotOff && VW.hotOff());
  for (const slot in VW.hot) {
    const L = VW.labelOf(slot), h = VW.hot[slot];
    h.el.className = 'hot' + (L.on ? ' on' : '') + (L.open ? ' open' : '') + (L.full && !L.on ? ' full' : '');
    h.el.innerHTML = `<i>${L.on ? '' : '+'}</i><span>${esc(L.text)}</span>`;
    h.el.setAttribute('aria-label', `${L.slotName} : ${L.on ? L.text : _t('add an attachment')}`);
  }
}
/* Canvas dimensions from its frame (once the frame is visible); refit: the starting distance follows the weapon and the frame */
function vwSize(refit) {
  const r = VW.host.getBoundingClientRect(), W = Math.round(r.width), H = Math.round(r.height);
  if (W < 20 || H < 20) return false;
  if (W !== VW.W || H !== VW.H || refit) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), bs = renderer.getDrawingBufferSize(_vwV2), k = Math.min(dpr, bs.x / W, bs.y / H);
    VW.W = W; VW.H = H; VW.cv.width = Math.max(2, Math.floor(W * k)); VW.cv.height = Math.max(2, Math.floor(H * k));
    const wasFit = VW.d === VW.fit; VW.fit = vwFit(VW.size, W / H, 1.22); if (wasFit || refit) VW.d = VW.fit;
  }
  return true;
}
/* One frame of the view: called by the main loop as long as the workshop screen is displayed */
function vwTick(dt) {
  if (!VW.host || !VW.model || !vwSize(false)) return;
  const S = vwScene(); S.cam.aspect = VW.W / VW.H; S.cam.updateProjectionMatrix();
  vwCamPlace(S.cam, VW.a, VW.p, VW.d, _vwAim);
  // starting view: offset that centers the weapon in the frame, kept afterward while orbiting
  if (VW.needShift) { VW.needShift = false; const b = vwScreenBox(VW.model, S.cam); VW.shift = b ? [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2] : null; }
  if (VW.shift) { const e = S.cam.projectionMatrix.elements; e[8] += VW.shift[0]; e[9] += VW.shift[1]; S.cam.projectionMatrixInverse.copy(S.cam.projectionMatrix).invert(); }
  vwDraw(VW.ctx, VW.cv.width, VW.cv.height, VW.cv.width, VW.cv.height);
  // dots: projected onto the image; the left-flank one fades when the weapon is seen from the right
  const camSide = Math.cos(VW.a); // > 0: camera on the left side of the weapon
  for (const slot in VW.hot) {
    const h = VW.hot[slot]; _vwP.copy(h.p).applyMatrix4(VW.model.matrixWorld).project(S.cam);
    const x = (_vwP.x * 0.5 + 0.5) * VW.W, y = (-_vwP.y * 0.5 + 0.5) * VW.H, vis = _vwP.z < 1 && x > -20 && x < VW.W + 20 && y > -20 && y < VW.H + 20;
    h.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    const fade = slot === 'side' ? clamp(camSide * 3 + 0.4, 0, 1) : 1;
    h.el.style.opacity = vis ? fade.toFixed(2) : '0'; h.el.style.pointerEvents = vis && fade > 0.3 ? 'auto' : 'none';
  }
}
const _vwAim = new V3(), _vwP = new V3();
/* Closes the showcase: the weapon leaves the scene (the lighting scene stays) */
function vwClose() { if (VW.model && VWS.scene) VWS.scene.remove(VW.model); VW.model = null; VW.info = null; VW.hot = {}; if (VW.hotEl) VW.hotEl.innerHTML = ''; VW.drag = null; }
/* Position of a dot on screen (px in the frame), to place the attachment list next to it */
function vwHotPos(slot) { const h = VW.hot[slot]; if (!h) return null; const r = h.el.getBoundingClientRect(), b = VW.host.getBoundingClientRect(); return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2, W: b.width, H: b.height }; }
