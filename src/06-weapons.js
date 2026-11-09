/* ==========================================================================
   WEAPONS: materials, weapons seen from the outside, and first person view
   ========================================================================== */
/* The weapons (WEAPONS), their feel (FEEL) and the classes (CLASSES) are in 06i-weapons.js */

/* ---------- Weapon materials ---------- */
/* Weapon surfaces, built at startup (common base, independent of the maps): wear (gunSurfTexture), procedural gravel relief and
   canvas. The maps' material library reuses these two surfaces (buildTextures) without freeing them. */
const GUN_GRAIN = (window.BASE_ASSETS || {}).grain || ''; // base (build.py): assets/firearm/surface.webp
const GUNTEX = { rough: null, surf: {} };
function buildGunTextures() {
  const small = RQ.q.lean ? 0.5 : 1;
  for (const k of ['gravel', 'canvas']) GUNTEX.surf[k] = texLabSurface(k, TEXLAB[k], small);
  GUNTEX.rough = gunSurfTexture();
}
/* Weapon wear (assets/firearm/surface.webp, CC0 textures from ambientCG and Poly Haven prepared by tools/build_weapons.py): a
   grayscale image with four cells (lossy WebP would mix up data stored in the channels of a color image), put back here
   into the channels of a tileable 512 px texture, 11 cm of weapon: red, haze and fingerprints; green, fine scratches; blue,
   mottling of a polymer; alpha, wood grain (along the width of the texture). Data texture (no canvas: a canvas
   premultiplies alpha). Neutral (nothing) until the image is decoded, or without the base bundle. */
function gunSurfTexture() {
  const N = 512, d = new Uint8Array(N * N * 4);
  for (let i = 0; i < d.length; i += 4) { d[i] = 128; d[i + 2] = 128; d[i + 3] = 128; }
  const t = new THREE.DataTexture(d, N, N);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  if (!GUN_GRAIN) return t;
  const im = new Image(); im.src = GUN_GRAIN;
  im.decode().then(() => {
    const s = document.createElement('canvas'); s.width = s.height = N;
    const sg = s.getContext('2d', { willReadFrequently: true }); sg.imageSmoothingQuality = 'high';
    // a cell of the image (x, y, width, height), enlarged or repeated n times in each direction over the whole texture
    const cell = (x, y, w, h, n) => { for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) sg.drawImage(im, x, y, w, h, i * N / n, j * N / n, N / n, N / n); return sg.getImageData(0, 0, N, N).data; };
    const G = cell(0, 0, 512, 512, 1), R = cell(512, 0, 256, 256, 1), B = cell(512, 256, 256, 256, 2), A = cell(768, 0, 256, 512, 1);
    for (let i = 0; i < d.length; i += 4) { d[i] = R[i]; d[i + 1] = G[i]; d[i + 2] = B[i]; d[i + 3] = A[i]; }
    t.needsUpdate = true;
  }).catch(() => {});
  return t;
}
/* Weapon material (owner feedback, October 2026: the grain of the weapon in hand looked like sandpaper). The old grain, a gravel relief
   and a plaster roughness applied by each part's texture coordinates, changed scale from one part to another.
   The surface is now read triplanar in the weapon's frame, at real scale (vertex position multiplied by the mesh
   scale: the weapon in hand, brought by bakeRig into the weapon's frame, like the separate parts of the display cases), without relief: a
   haze and fingerprints that vary the roughness, a fine mottling, scratches, and worn edges. An edge is detected by
   the on-screen curvature (variation of the normal relative to that of the position, in 1/m: strong on the parts' roundings); it
   and the scratches show the underside of the finish (uGunBare: color and roughness, uGunBareM: metal): the bare aluminum of an anodized casing,
   a polymer lightened by rubbing, the dark metal under a camouflage. uGunW: share of edges, scratches, haze and
   mottling; uGunWood: wood grain (stocks, handguards), oriented along the barrel on the sides as on the top. A single
   program for all the weapon's materials (same patch, values specific to each material). */
const GUN_SURF_U = { uGunSurf: { value: null }, uGunK: { value: 1 / 0.11 }, uGunE: { value: new THREE.Vector2(160, 480) } };
const GUN_WEAR = {
  // [edges, scratches, haze, mottling], color of the underside (null: the material's tint lightened by k), roughness and metal of the underside
  metal: { w: [0.5, 0.35, 0.22, 0.15], bare: [0.3, 0.31, 0.33], r: 0.3, m: 1 }, // anodized aluminum: the edge shows bare aluminum
  steel: { w: [0.4, 0.3, 0.22, 0.12], bare: [0.26, 0.27, 0.29], r: 0.34, m: 1 }, // phosphated or blued steel
  smooth: { w: [0.18, 0.06, 0.12, 0.05], bare: null, k: 1.5, r: -0.08, m: 1 }, // smooth steel, brass, blade: barely marked
  poly: { w: [0.35, 0.12, 0.18, 0.3], bare: null, k: 1.7, r: -0.15, m: 0 }, // polymer: the rubbed edge lightens and polishes
  paint: { w: [0.3, 0.1, 0.18, 0.3], bare: null, k: 1.35, r: -0.12, m: 0 }, // tinted trims (olive, sand)
  wood: { w: [0.25, 0, 0.18, 0.2], bare: null, k: 1.5, r: -0.18, m: 0 }, // varnished wood: edges patinated by hands
  camo: { w: [0.6, 0.3, 0.15, 0.15], bare: [0.08, 0.085, 0.09], r: 0.4, m: 0.6 }, // camouflage paint: dark underside
};
/* Applies to material m the wear of the kind family (GUN_WEAR): uniforms specific to the material, common patch */
function gunWear(m, kind) {
  const W = GUN_WEAR[kind], c = W.bare ? new THREE.Color(...W.bare) : m.color.clone().multiplyScalar(W.k);
  m.userData.gunU = { uGunW: { value: new THREE.Vector4(...W.w) }, uGunBare: { value: new THREE.Vector4(c.r, c.g, c.b, W.bare ? W.r : clamp(m.roughness + W.r, 0.1, 1)) }, uGunBareM: { value: W.bare ? W.m : m.metalness }, uGunWood: { value: kind === 'wood' ? 1 : 0 } };
  if (!m.onBeforeCompile.gunSurf) m.onBeforeCompile = gunSurfCompile;
  return m;
}
function gunSurfCompile(shader) { envCubeHook(shader); gunSurfPatch(shader, this.userData.gunU); }
gunSurfCompile.gunSurf = true;
function gunSurfPatch(shader, U) {
  GUN_SURF_U.uGunSurf.value = GUNTEX.rough || (GUNTEX.rough = gunSurfTexture());
  Object.assign(shader.uniforms, GUN_SURF_U, U);
  shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGunP; varying vec3 vGunN;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vGunP = position * vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz)); vGunN = normal;');
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
uniform sampler2D uGunSurf; uniform float uGunK; uniform vec2 uGunE; uniform vec4 uGunW; uniform vec4 uGunBare; uniform float uGunBareM; uniform float uGunWood;
varying vec3 vGunP; varying vec3 vGunN;`).replace('#include <roughnessmap_fragment>', `float roughnessFactor = roughness, gunWear = 0.0;
{
  vec3 gw = pow(abs(normalize(vGunN)), vec3(4.0)); gw /= gw.x + gw.y + gw.z;
  vec3 gp = vGunP * uGunK;
  vec4 gs = texture2D(uGunSurf, gp.zy) * gw.x + texture2D(uGunSurf, gp.zx) * gw.y + texture2D(uGunSurf, gp.xy) * gw.z; // texture width along the barrel
  diffuseColor.rgb *= mix(1.0, 0.55 + gs.a * 0.9, uGunWood); // wood grain: dark and light veins
  float gc = length(fwidth(normalize(vNormal))) / max(length(fwidth(vViewPosition)), 1e-6); // on-screen curvature, in 1/m
  float ge = smoothstep(uGunE.x, uGunE.y, gc) * clamp(0.35 + (gs.b - 0.5) * 1.6 + (gs.r - 0.5) * 0.8, 0.0, 1.0) * uGunW.x; // edge, worn in places
  float gr = smoothstep(0.4, 0.85, gs.g) * uGunW.y; // scratch: mostly in the reflection, barely in the color
  gunWear = max(ge, gr * 0.5);
  roughnessFactor = roughnessFactor * (1.0 + (gs.b - 0.5) * uGunW.w) + (gs.r - 0.5) * uGunW.z + (0.5 - gs.a) * 0.18 * uGunWood; // wood pores: more matte
  roughnessFactor = clamp(mix(roughnessFactor, uGunBare.a, max(ge, gr)), 0.06, 1.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, uGunBare.rgb, max(ge, gr * 0.25));
}`).replace('#include <metalnessmap_fragment>', 'float metalnessFactor = mix(metalness, uGunBareM, gunWear);');
}
let GM = null;
function gunMaterials() {
  if (GM) return GM;
  const S = GUNTEX.surf, T = S.canvas ? { canvas: S.canvas } : null;
  const mk = (color, r, m, o = {}, kind) => { const t = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: r, metalness: m, envMapIntensity: 1.0 }, o)); return kind ? gunWear(t, kind) : t; };
  GM = {
    metal: mk(0x34373b, 0.38, 0.78, {}, 'metal'),
    dark: mk(0x202124, 0.5, 0.55, {}, 'steel'),
    poly: mk(0x27282a, 0.6, 0.06, {}, 'poly'),
    olive: mk(0x4d5236, 0.7, 0.05, {}, 'paint'),
    tan: mk(0x9a8664, 0.7, 0.05, {}, 'paint'),
    wood: mk(0x3a2a20, 0.58, 0.02, {}, 'wood'),
    woodR: mk(0x3a1c17, 0.46, 0.02, {}, 'wood'), // varnished red wood of the AK-47
    woodB: mk(0x393223, 0.56, 0.02, {}, 'wood'), // varnished blond wood of the Dragunov
    fde: mk(0x4d4a3a, 0.68, 0.05, {}, 'paint'),
    taupe: mk(0x2e3138, 0.66, 0.05, {}, 'poly'), // gray-brown polymer of the L96A1
    gray: mk(0x343c48, 0.55, 0.35, {}, 'steel'), // gray phosphated sheet metal of the Barrett M82
    blued: mk(0x2c2f34, 0.36, 0.7, {}, 'smooth'), // smooth blued steel of the M9 (seen up close when aiming: barely marked)
    polyM: mk(0x19191b, 0.62, 0.05, {}, 'poly'), // matte black polymer of the pistol frames
    drab: mk(0x2e3426, 0.7, 0.05, {}, 'paint'),
    brass: mk(0xb58f3e, 0.3, 1.0, {}, 'smooth'),
    steel: mk(0xaab0b6, 0.3, 0.86, {}, 'smooth'), // brushed stainless steel (Desert Eagle); the camouflage covers it
    grip: mk(0x131313, 0.8, 0.02, {}, 'poly'), // rubber of a grip; the camouflage leaves it black
    sight: mk(0x1c1e21, 0.55, 0.4), // ring and front sight of the sighting devices: dark, matte, no wear (simplest program); the camouflage leaves them black
    glove: mk(0x2e2a25, 0.8, 0.05),
    sleeve: new THREE.MeshStandardMaterial({ color: 0xb3a07a, roughness: 0.95, map: T ? T.canvas.map : null, normalMap: T ? T.canvas.normal : null }),
    skin: mk(0xc49a78, 0.6, 0.0),
    lens: new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.35, envMapIntensity: 1.5 }),
    lensR: new THREE.MeshStandardMaterial({ color: 0xc4521e, roughness: 0.06, metalness: 0.85, transparent: true, opacity: 0.55, envMapIntensity: 1.6 }), // orange coating of a red dot's lens, seen from the front only
    glass: mk(0x3a5878, 0.04, 1.0, { envMapIntensity: 2.2 }), // scope lens, opaque: coated glass that reflects the scenery
    glint: new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(1.2, 1.15, 1.3), transparent: true, opacity: 0.4, depthWrite: false }), // reflection painted on a lens
    dot: new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(2.6, 0.12, 0.08) }),
    ink: new THREE.MeshBasicMaterial({ color: 0x050505 }), // black engraved lines of a reticle (ACOG)
    // ACOG eyepiece: mask that writes only depth (you see the world through it), added cyan tint, darkened edge
    ocMask: new THREE.MeshBasicMaterial({ colorWrite: false }),
    ocTint: new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(0.05, 0.11, 0.12), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    ocShade: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.055, depthWrite: false }), // twelve stacked rings: from 0 to 50% toward the edge
    blade: mk(0x9da2a6, 0.25, 1.0, {}, 'smooth'),
    knifeSteel: mk(0xd2d7da, 0.22, 0.6, { envMapIntensity: 1.3 }),
    tube: mk(0x18191a, 0.55, 0.6, { side: THREE.DoubleSide }, 'steel'),
    dotW: new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(2.2, 2.2, 1.8) }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.92 }),
  };
  return GM;
}
const RING_REAR = new THREE.TorusGeometry(0.0092, 0.0024, 8, 24); // lanyard ring of the pistols
const G_BOX = new THREE.BoxGeometry(1, 1, 1), G_CYL = new THREE.CylinderGeometry(1, 1, 1, 14), G_CYL_O = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true);
function part(parent, geo, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); parent.add(m); return m;
}
const bx = (p, mat, x, y, z, w, h, d, rx, ry, rz) => part(p, G_BOX, mat, x, y, z, w, h, d, rx, ry, rz);
/* cylinder oriented along Z (along the barrel) */
const cz = (p, mat, x, y, z, r, len, geo = G_CYL) => part(p, geo, mat, x, y, z, r, len, r, Math.PI / 2, 0, 0);

/* Weapons seen from the outside (held by soldiers, lying on the ground): the geometry is built only once per
   mounted weapon (key of the model, the attachments and the camouflage) and shared by all identical weapons (no more rebuilding at each weapon change or at
   each dropped weapon). Tints (olive trim, wood, sand, dark metal and polymer) or camouflage: two to four draw calls per
   weapon, and two levels of detail chosen with the soldier's (setSoldierLod) or the distance (weapons on the ground):
   - "hi": all the parts of the first-person model, with their indices (the GPU reuses the vertices);
   - "lo": without the small parts (rail teeth, screws, pins: invisible beyond a few meters), with
     simplified cylinders, spheres and roundings. It is used from afar and always casts the shadow. */
const WORLD_GUN_GEO = {};
const _lowGeo = new WeakMap();
/* Lightened version of a part's geometry (same footprint) */
function lowPolyGeometry(g) {
  if (_lowGeo.has(g)) return _lowGeo.get(g);
  const P = g.parameters || {}; let r = g;
  if (g.userData.box) r = new THREE.BoxGeometry(...g.userData.box); // rounded box (rgeo): simple box
  else if (g.userData.low) r = profLow(g); // extruded profile (06jb-shapes.js): without softened edges
  else if (g.userData.sec) r = secLow(g); // section along the barrel (06jb-shapes.js): likewise
  else if (g.userData.ring) r = ringGeo(...g.userData.ring); // z-axis ring (06jb-shapes.js): 12 segments, no rounding
  else if (g.type === 'CylinderGeometry' && P.radialSegments > 8) r = new THREE.CylinderGeometry(P.radiusTop, P.radiusBottom, P.height, 8, 1, P.openEnded, P.thetaStart, P.thetaLength);
  else if (g.type === 'SphereGeometry' && P.widthSegments > 8) r = new THREE.SphereGeometry(P.radius, 8, 6, P.phiStart, P.phiLength, P.thetaStart, P.thetaLength);
  else if (g.type === 'TorusGeometry' && P.tubularSegments > 10) r = new THREE.TorusGeometry(P.radius, P.tube, 4, 10, P.arc);
  else if (g.type === 'CapsuleGeometry' && P.radialSegments > 6) r = new THREE.CapsuleGeometry(P.radius, P.length, 2, 6);
  _lowGeo.set(g, r); return r;
}
/* Merges parts { geo, m } into an indexed geometry (positions and normals in the weapon's frame) */
function mergeGunParts(parts) {
  if (!parts.length) return null;
  let nv = 0, ni = 0;
  for (const p of parts) { nv += p.geo.attributes.position.count; ni += p.geo.index ? p.geo.index.count : p.geo.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const v = new V3(), nm = new THREE.Matrix3();
  let vo = 0, io = 0;
  for (const p of parts) {
    const P = p.geo.attributes.position, N = p.geo.attributes.normal, n = P.count;
    nm.getNormalMatrix(p.m);
    for (let k = 0; k < n; k++) {
      v.fromBufferAttribute(P, k).applyMatrix4(p.m); v.toArray(pos, (vo + k) * 3);
      v.fromBufferAttribute(N, k).applyMatrix3(nm).normalize(); v.toArray(nor, (vo + k) * 3);
    }
    if (p.geo.index) { const I = p.geo.index.array; for (let k = 0; k < I.length; k++) idx[io + k] = I[k] + vo; io += I.length; }
    else { for (let k = 0; k < n; k++) idx[io + k] = vo + k; io += n; }
    vo += n;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return geo;
}
/* A part is "small" if two of its dimensions are millimetric and the third short (rail tooth, screw) */
function gunPartSmall(o) {
  const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
  const sz = g.boundingBox.getSize(_v1), sc = _v2.setFromMatrixScale(o.matrixWorld);
  const d = [sz.x * sc.x, sz.y * sc.y, sz.z * sc.z].sort((a, b) => a - b);
  return d[1] < 0.0085 && d[2] < 0.035;
}
function worldGunGeometry(key) {
  if (WORLD_GUN_GEO[key]) return WORLD_GUN_GEO[key];
  const info = buildGunModel(key);
  info.group.updateMatrixWorld(true);
  const L = { hi: {}, lo: {} };
  for (const lv of ['hi', 'lo']) for (const k of WORLD_GUN_KEYS) L[lv][k] = [];
  const visit = (o) => {
    if (!o.visible) return; // hidden part of the model (internal magazine of the shotgun)
    if (o.isMesh && !o.material.transparent && !o.material.isMeshBasicMaterial && o.geometry.attributes.normal) {
      /* camouflage: a separate material; otherwise warm tint (olive, sand; colors in linear space): light
         trim; gray metal and polymer: dark */
      const c = o.material.color, k = o.material.userData.camo ? 'camo' : o.material === GM.wood ? 'wood' : o.material === GM.woodR ? 'woodR' : o.material === GM.woodB ? 'woodB' : o.material === GM.taupe ? 'taupe' : o.material === GM.gray ? 'gray' : o.material === GM.tan || o.material === GM.fde ? 'tan' : o.material === GM.drab ? 'light' : o.material === GM.steel ? 'steel' : c.r - c.b > 0.025 ? 'light' : 'dark';
      L.hi[k].push({ geo: o.geometry, m: o.matrixWorld });
      if (!gunPartSmall(o)) L.lo[k].push({ geo: lowPolyGeometry(o.geometry), m: o.matrixWorld });
    }
    for (const c of o.children) visit(c);
  };
  visit(info.group);
  const G = { muzzle: info.muzzle.position.clone(), kind: info.kind, grips: gunGrips(info), hi: {}, lo: {} };
  for (const lv of ['hi', 'lo']) for (const k of WORLD_GUN_KEYS) G[lv][k] = mergeGunParts(L[lv][k]);
  return (WORLD_GUN_GEO[key] = G);
}
/* Weapon ready to place in the scene: one mesh per material and per level of detail, whose layers are set by setGunLod */
function buildWorldGun(key) {
  const G = worldGunGeometry(key), out = new THREE.Group(), camo = gunSpec(key).camo;
  for (const lv of ['hi', 'lo']) for (const k of WORLD_GUN_KEYS) {
    if (!G[lv][k]) continue;
    const mesh = new THREE.Mesh(G[lv][k], k === 'camo' ? camoWorldMaterial(camo) : WORLD_GUN_MATS[k]);
    mesh.castShadow = lv === 'lo'; mesh.userData.noPrepass = true; mesh.userData.gunLod = lv;
    out.add(mesh);
  }
  setGunLod(out, false);
  return { group: out, muzzle: G.muzzle.clone(), kind: G.kind };
}
/* Level of detail of a weapon: the lightened model always casts the shadow; when the detailed one is displayed, the lightened one
   is only used for that (shadow-only layer). shadowOnly: weapon on the player's body, which is never displayed. */
function setGunLod(group, hi, shadowOnly) {
  for (const m of group.children) {
    if (!m.userData.gunLod) continue;
    if (m.userData.gunLod === 'hi') { m.visible = hi && !shadowOnly; m.layers.mask = MASK_SCREEN; }
    else m.layers.mask = hi || shadowOnly ? MASK_SHADOW : MASK_SCREEN;
  }
}
const WORLD_GUN_MATS = {
  dark: new THREE.MeshStandardMaterial({ color: 0x1f2022, roughness: 0.5, metalness: 0.6 }), light: new THREE.MeshStandardMaterial({ color: 0x4d5236, roughness: 0.7 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.58 }), woodR: new THREE.MeshStandardMaterial({ color: 0x3a1c17, roughness: 0.46 }),
  woodB: new THREE.MeshStandardMaterial({ color: 0x393223, roughness: 0.56 }), taupe: new THREE.MeshStandardMaterial({ color: 0x2e3138, roughness: 0.66 }),
  gray: new THREE.MeshStandardMaterial({ color: 0x343c48, roughness: 0.55, metalness: 0.35 }),
  tan: new THREE.MeshStandardMaterial({ color: 0x4d4a3a, roughness: 0.68 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x9ea4aa, roughness: 0.35, metalness: 0.75 }),
};
const WORLD_GUN_KEYS = ['light', 'dark', 'wood', 'woodR', 'woodB', 'taupe', 'gray', 'tan', 'steel', 'camo']; // one material of the outside weapon per tint family (camo: paint)

/* ---------- First-person view ---------- */
/* Field of view of the weapon view, from the hip (base) to aiming (44°). Magnifying optics (ACOG: info.vmFov) narrow the weapon view
   until their eyepiece fills the screen; the magnification then follows the tangent of the half field, smooth during the aim-down-sights */
function vmFovAt(base, ads) {
  const f = VM.cur && VM.cur.vmFov;
  if (!f) return lerp(base, 44, ads);
  return Math.atan(lerp(Math.tan(base * Math.PI / 360), Math.tan(f * Math.PI / 360), ads)) * 360 / Math.PI;
}
const VM = {
  root: new THREE.Group(), holder: new THREE.Group(), models: {}, cur: null, curDef: null,
  arms: null, flash: null, shells: [], shellIdx: 0,
  ads: 0, sprint: 0, bobT: 0, bobAmt: 0, swayX: 0, swayY: 0, swayTX: 0, swayTY: 0,
  rec: { z: 0, vz: 0, rx: 0, vrx: 0, ry: 0, vry: 0, rz: 0, vrz: 0, y: 0, vy: 0 },
  fovHip: 58, lastGo: [0, 0, 0, 0, 0, 0], popO: [0, 0, 0, 0, 0, 0], popV: [0, 0, 0, 0, 0, 0], gV: [0, 0, 0, 0, 0, 0], camK: [0, 0, 0, 0], viewKickO: [0, 0, 0, 0, 0, 0], viewKickV: [0, 0, 0, 0, 0, 0], lastAct: '', actK: 1, actFade: false, sprV: 0, sprK: 0, tilt: 0, push: 0, wall: 0, trig: 0, trigT: 0, land: 0, vland: 0, lower: 0, lowerTarget: 0, lowV: 0, lowerUp: true, lowArr: true, lhOk: false, sling: 0, action: null, actionT: 0, actionDur: 1, actionData: null,
  flashT: 0, flashT0: 0.05, flashM: null, crouch: 0, knifeRig: null, nadeRig: null, sunVis: 1, breath: 0, jump: 0, bobO: new THREE.Vector3(), bobR: new THREE.Vector3(),
};
/* Weapon position at the hip, per model: x, y, z offset then pitch, yaw (the barrel converges toward the center of
   the screen, which shows the weapon's left side and the right hand on the grip) and roll.
   Owner feedback, "the weapon is a bit high on the screen": all lowered by 1.2 cm (1 cm for the pistol). Sniper
   rifles, longer, are held 2 cm closer: the support hand, far forward, kept the arm almost straight. */
const VM_HIP = {
  rifle: [0.13, -0.15, -0.28, 0.07, 0.12, -0.04], smg: [0.13, -0.14, -0.28, 0.06, 0.12, -0.04], sniper: [0.14, -0.16, -0.26, 0.015, 0.08, -0.02],
  shotgun: [0.13, -0.144, -0.27, 0.02, 0.09, -0.03], pistol: [0.1, -0.088, -0.38, 0.03, 0.06, -0.02],
};
/* Position (farther and higher) that the weapon takes back during a reload or an inspection: the choreographies in
   06d-reload.js are tuned for it, and a weapon brought closer to the hip would fill the screen as it tilts. It returns to the
   hip during the last VM_FAR_OUT seconds of the action that ends the sequence (VM_FAR_END), with the resetting */
const VM_HIP_ACT = {
  rifle: [0.12, -0.117, -0.36, 0.07, 0.12, -0.04], smg: [0.12, -0.112, -0.35, 0.06, 0.12, -0.04], sniper: [0.13, -0.124, -0.32, 0.015, 0.08, -0.02],
  shotgun: [0.12, -0.12, -0.33, 0.02, 0.09, -0.03],
};
const VM_FAR_ACTIONS = new Set(['reload', 'inspect', 'shellStart', 'shell', 'shellEnd']), VM_FAR_END = new Set(['reload', 'inspect', 'shellEnd']), VM_FAR_OUT = 0.5, _hipK = [0, 0, 0, 0, 0, 0];
/* Sprint pose (x, y, z offset then pitch, yaw, roll) */
const VM_SPRINT = [0.01, -0.04, -0.04, -0.5, 0.65, 0.7];
/* pistol sprint: no fixed pose, the arm gives it (pistolRunPose, in 06c-models.js) */
const VM_SPRINT_NONE = [0, 0, 0, 0, 0, 0];
/* Path of the weapon when it's slung on the back (0 = in hand, 1 = on the back, out of view):
   [progress, x, y, z] for the position and [progress, pitch, yaw, roll] for the rotation */
const VM_SLING = {
  pos: [[0, 0, 0, 0], [0.3, 0.04, 0.03, 0.0], [0.65, 0.17, 0.14, 0.1], [1, 0.33, 0.27, 0.32]],
  rot: [[0, 0, 0, 0], [0.3, 0.22, -0.18, 0.4], [0.65, 0.75, -0.55, 0.85], [1, 1.3, -0.95, 1.15]],
};
function spring(o, key, vkey, k, c, dt) { o[vkey] += (-k * o[key] - c * o[vkey]) * dt; o[key] += o[vkey] * dt; }


function initViewmodel() {
  const M = gunMaterials();
  vmScene.add(VM.root); VM.root.add(VM.holder);
  VM.arms = { R: makeArm(M, null, -1), L: makeArm(M, null, 1) };
  VM.arms.R.hand.userData.trigSrc = () => VM.trig; // the right hand's index finger follows the trigger
  // watch on the left wrist
  VM.watch = buildWatch(M); VM.holder.add(VM.watch); VM.arms.L.watch = VM.watch; // hidden with the left arm
  // muzzle flash: a rosette facing the shooter and two crossed tongues of flame along the barrel, each drawn from a sheet of
  // four variants at each shot (flashTex, 01-core.js); additive, no depth write, a single texture unit
  const fmF = new THREE.MeshBasicMaterial({ map: FXT.flashF, color: new THREE.Color().setRGB(2.3, 2.05, 1.7), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const fmS = fmF.clone(); fmS.map = FXT.flashS;
  FXT.flashF.repeat.set(0.5, 0.5); FXT.flashS.repeat.set(0.5, 0.5);
  VM.flash = new THREE.Group(); VM.flashM = [fmF, fmS];
  VM.flash.add(new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), fmF));
  // side-view sheet: the muzzle at 3.5 cm from its edge (the margin of the core), the flame forward (-z)
  const gs = new THREE.PlaneGeometry(0.17, 0.5).translate(0, 0.215, 0).rotateX(-Math.PI / 2);
  for (let i = 0; i < 2; i++) { const f = new THREE.Mesh(gs, fmS); f.rotation.z = (i * Math.PI) / 2; VM.flash.add(f); }
  VM.flash.visible = false;
  // casings
  const sg = new THREE.CylinderGeometry(0.0045, 0.0045, 0.024, 8);
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Mesh(sg, M.brass); s.visible = false; vmScene.add(s);
    VM.shells.push({ mesh: s, v: new V3(), w: new V3(), t: 0 });
  }
  // knife: full right arm, gloved hand gripping a combat dagger (see updateRigs)
  VM.knifeRig = new THREE.Group(); VM.knifeRig.visible = false; VM.root.add(VM.knifeRig);
  VM.knifeArm = makeArm(M, VM.knifeRig, -1);
  VM.knife = buildKnifeModel(M); VM.knifeRig.add(VM.knife);
  // grenade
  VM.nadeRig = new THREE.Group(); VM.nadeRig.visible = false; VM.root.add(VM.nadeRig);
  const nArm = new THREE.Mesh(G_CYL, M.sleeve); nArm.scale.set(0.045, 0.45, 0.045); nArm.position.set(0.04, -0.08, 0.22); nArm.rotation.x = Math.PI / 2 - 0.3; VM.nadeRig.add(nArm);
  bx(VM.nadeRig, M.glove, 0, 0, 0, 0.075, 0.085, 0.1);
  part(VM.nadeRig, new THREE.SphereGeometry(1, 14, 10), GM.olive, 0, 0.05, -0.04, 0.038, 0.045, 0.038);
  bx(VM.nadeRig, M.metal, 0.02, 0.09, -0.04, 0.01, 0.03, 0.015);
}

function vmEquip(def) {
  gunSoundPrepare(def.sound);
  if (!VM.models[def.key]) VM.models[def.key] = vmGunModel(def.key);
  if (VM.cur) { vmResetHandling(VM.cur); VM.holder.remove(VM.cur.group); }
  VM.cur = VM.models[def.key]; VM.curDef = def;
  VM.holder.add(VM.cur.group);
  VM.cur.muzzle.add(VM.flash);
  VM.cur.mag.position.copy(VM.cur.magHome); VM.cur.mag.visible = !VM.cur.tubeFed; vmResetHandling(VM.cur);
}

function vmKick(def, ads) {
  const r = def.recoil, a = (ads ? 0.55 : 1) * RECOIL.vis; // (RECOIL.vis: the shot is more visible, 07ca-recoil.js)
  const F = def.feel || FEEL.m4;
  VM.rec.vz += r.kick * 22 * a * F.kick; VM.rec.vrx += r.rot * 18 * a * F.rot; VM.rec.vry += (Math.random() - 0.5) * r.rot * 10 * a; VM.rec.vrz += (Math.random() - 0.5) * r.rot * 14 * (1 + F.roll);
  VM.rec.vy += r.kick * 4 * F.kick;
  // attack: the first movement is immediate (the weapon starts on the shot's frame instead of picking up speed)
  VM.rec.z += r.kick * 0.35 * a * F.kick; VM.rec.rx += r.rot * 0.25 * a * F.rot;
  VM.flashT = VM.flashT0 = def.silent ? 0 : def.pellets || def.bolt ? 0.065 : 0.05; VM.trigT = 0.085;
  VM.flash.rotation.z = Math.random() * TAU; const s = rand(0.85, 1.15) * F.flash; VM.flash.scale.set(s, s, s * rand(0.85, 1.25));
  // shot variants: a random rosette, a flame with sideways jets if a muzzle brake or a compensator sends the gases to the sides
  const jet = !!def.att && (def.att.includes('brake') || def.att.includes('comp'));
  FXT.flashF.offset.set(randi(0, 1) * 0.5, randi(0, 1) * 0.5); FXT.flashS.offset.set(jet ? 0.5 : 0, randi(0, 1) * 0.5);
  if (VM.cur && VM.cur.slide) VM.slideK = 1;
  vmFlash.intensity = def.silent ? 0.8 : 4.5 * Math.max(1, F.flash);
}
function vmShell(def) {
  const s = VM.shells[VM.shellIdx]; VM.shellIdx = (VM.shellIdx + 1) % VM.shells.length;
  VM.cur.eject.getWorldPosition(s.mesh.position);
  s.v.set(rand(1.4, 2.2), rand(1.0, 1.8), rand(0.2, 0.6)); s.w.set(rand(-20, 20), rand(-20, 20), rand(-20, 20)); s.t = 0.7; s.mesh.visible = true;
  if (def.shell === 'shotgun') s.mesh.scale.set(2.2, 2.4, 2.2); else if (def.shell === 'sniper') s.mesh.scale.set(1.3, 2.2, 1.3); else if (def.shell === 'pistol50') s.mesh.scale.set(1.4, 1.5, 1.4); else s.mesh.scale.set(1, 1, 1);
  s.mesh.material = def.shell === 'shotgun' ? SHELL_RED : GM.brass;
}
const SHELL_RED = new THREE.MeshStandardMaterial({ color: 0x9c2a1c, roughness: 0.5 });
/* Grenade spoon that pops off when the fuse starts: same pool as the casings */
function vmSpoon() {
  const N = NADE_RIG; if (!N.nade) return;
  const sp = N.nade.userData.spoon; if (!sp || !sp.visible) return;
  const s = VM.shells[VM.shellIdx]; VM.shellIdx = (VM.shellIdx + 1) % VM.shells.length;
  sp.getWorldPosition(s.mesh.position); sp.getWorldQuaternion(s.mesh.quaternion); sp.visible = false;
  // it flies off to the right and rear: a brief metallic fragment, not an object crossing the screen
  s.v.set(rand(1.8, 2.6), rand(1.2, 1.8), rand(1.0, 1.5)); s.w.set(rand(-40, 40), rand(-15, 15), rand(-40, 40)); s.t = 0.3; s.mesh.visible = true;
  s.mesh.scale.set(1.3, 2.3, 0.45); s.mesh.material = GM.blade;
}
function vmStartAction(name, dur, data) { VM.action = name; VM.actionT = 0; VM.actionDur = dur; VM.actionData = data || {}; VM.actK = 1; VM.actFade = false; VM.lastAct = ''; }

/* Lowered weapon (VM.lower, 0 in hand, 1 out of view): stowed with a sharp snap (starts at full speed, VM.lowerRate), brought out on a lightly damped
   spring (angular frequency 1.5 times VM.raiseRate) that launches it, makes it overshoot its place a little, barrel raised, then settles it: it snaps
   into position as in recent Call of Duty games. The view accompanies both gestures (events lowered and sortie of VM_ANIM). Step of
   1/120 s at most, like the other springs of the first person view. */
function vmLowerStep(dt, def) {
  const C = vmaCfg(def).reloadAnim, E = C.ev;
  if (VM.lowerTarget >= 0.5) {
    if (VM.lowerUp && VM.lower < 0.5 && E.lowered) vmCamKick(E.lowered.cam, E.lowered.fov, C.cam);
    VM.lowerUp = false; VM.lowV = 0;
    VM.lower = damp(VM.lower, VM.lowerTarget, (VM.lowerRate || 16) * 1.6, dt); // (1.3 before 5.1)
    return;
  }
  VM.lowerUp = true;
  if (VM.lower > 0.3) VM.lowArr = false; // the weapon starts again from out of view (weapon change, spawn, grenade thrown)
  // (5.1: angular frequency 1.75 and damping 0.48 instead of 1.5 and 0.6: the weapon arrives faster and overshoots its place more)
  const w = 1.75 * (VM.raiseRate || 16), k = w * w, c = 2 * 0.48 * w, n = Math.max(1, Math.ceil(dt * 120)), h = dt / n;
  for (let i = 0; i < n; i++) { VM.lowV += (-k * (VM.lower - VM.lowerTarget) - c * VM.lowV) * h; VM.lower += VM.lowV * h; }
  if (Math.abs(VM.lower) < 2e-4 && Math.abs(VM.lowV) < 2e-3) { VM.lower = 0; VM.lowV = 0; }
  // the weapon arrives in place: the view marks the stop
  if (!VM.lowArr && VM.lower < 0.15) { VM.lowArr = true; if (E.unholster) { vmCamKick(E.unholster.cam, E.unholster.fov, C.cam); vmViewKick(E.unholster.vm, C); } }
  if (VM.raiseRate && VM.lower < 0.02) VM.raiseRate = 0; // slow weapon draw finished (class change in a pause)
}

const env = (t, a, b, c, d) => (t < a || t > d ? 0 : t < b ? smoothstep(a, b, t) : t < c ? 1 : 1 - smoothstep(c, d, t));

/* First person view update. S: player state useful to the animation */
function updateViewmodel(dt, S) {
  if (!VM.cur) return;
  VM.handDt = dt;
  const def = VM.curDef, m = VM.cur;
  VM.ads = damp(VM.ads, S.ads ? 1 : 0, 1 / Math.max(0.05, def.adsTime) * 2.2, dt);
  // aiming settles: a small jolt of the weapon and the view when it arrives at the shoulder (once per aim-down-sights)
  if (S.ads && !VM.adsSnap && VM.ads > 0.82) { VM.adsSnap = true; const C = vmaCfg(def).reloadAnim; if (C.ev.aimIn && !def.scope) { vmViewKick(C.ev.aimIn.vm, C); vmCamKick(C.ev.aimIn.cam, C.ev.aimIn.fov, C.cam); } } // (not under a scope: the whole image would move)
  else if (!S.ads && VM.ads < 0.3) VM.adsSnap = false;
  // sprint: lightly damped spring, the weapon tilts all at once with an overshoot on entering as on leaving
  VM.sprV += ((S.sprint ? 1 : 0) - VM.sprint) * 270 * dt - VM.sprV * 18 * dt; VM.sprint = clamp(VM.sprint + VM.sprV * dt, -0.08, 1.08); // (210 and 17 before 5.1)
  // tilt when strafing, push when moving forward, weapon raised in the air, weapon folded back against a nearby wall
  VM.tilt = damp(VM.tilt, clamp((S.lat || 0) / 5, -1.2, 1.2), 7, dt);
  VM.push = damp(VM.push, clamp((S.fwd || 0) / 6, -1, 1), 5, dt);
  VM.jump = damp(VM.jump, S.grounded === false ? 1 : 0, S.grounded === false ? 7 : 12, dt);
  VM.wall = damp(VM.wall, S.wall || 0, (S.wall || 0) > VM.wall ? 12 : 7, dt);
  // trigger finger: pressed while firing a burst, or for a brief instant at each shot
  VM.trigT = Math.max(0, VM.trigT - dt);
  VM.trig = damp(VM.trig, (S.fire && def.auto && !S.empty) || VM.trigT > 0 ? 1 : 0, 30, dt);
  VM.crouch = damp(VM.crouch, S.crouch ? 1 : 0, 8, dt);
  const spd = S.speed;
  VM.bobAmt = damp(VM.bobAmt, S.grounded ? clamp(spd / 5, 0, 1.6) : 0, 8, dt);
  VM.bobT += dt * Math.PI * spd / (S.sprint ? 2.7 : 2.1); // half a cycle per step, like the camera
  VM.swayTX = clamp(VM.swayTX, -0.12, 0.12); VM.swayTY = clamp(VM.swayTY, -0.12, 0.12);
  VM.swayX = damp(VM.swayX, VM.swayTX, 10, dt); VM.swayY = damp(VM.swayY, VM.swayTY, 10, dt);
  VM.swayTX = damp(VM.swayTX, 0, 6, dt); VM.swayTY = damp(VM.swayTY, 0, 6, dt);
  const R = VM.rec;
  const SP = (def.feel || FEEL.m4).spring, sk = SP[0] / 240, sc = SP[1] / 19;
  spring(R, 'z', 'vz', 260 * sk, 20 * sc, dt); spring(R, 'rx', 'vrx', 220 * sk, 17 * sc, dt); spring(R, 'ry', 'vry', 200 * sk, 16 * sc, dt); spring(R, 'rz', 'vrz', 180 * sk, 14 * sc, dt); spring(R, 'y', 'vy', 200 * sk, 18 * sc, dt);
  VM.slideK = Math.max(0, (VM.slideK || 0) - dt * 22);
  if (m.slide) m.slide.position.z = Math.max(VM.slideK, (VM.slideHold || (S.empty && m.kind === 'pistol')) ? 1 : 0) * (m.slideTravel || 0.034);
  VM.vland += (-120 * VM.land - 12 * VM.vland) * dt; VM.land += VM.vland * dt;
  vmLowerStep(dt, def);
  VM.breath += dt;

  const a = smoothstep(0, 1, VM.ads), sp = VM.sprint * (1 - a);
  const bobS = VM.bobAmt * (1 - a * 0.85);
  // jump and landing while aiming: the sight stays in front of the eye (owner feedback: "the weapon moves badly when you keep the zoom and jump");
  // only 15% of the rise in the air, 10% of the tilt and 30% of the landing spring remain
  const airK = 1 - a * 0.85, landK = 1 - a * 0.7;
  // hip position: the pistol is held higher and closer so that the hand gripping it is visible; long
  // weapons are close to the body, elbows bent, and move away for the duration of a reload. The return to the hip happens during the
  // resetting that ends the choreography (or while an interrupted inspection fades out), and not once everything is finished:
  // owner feedback, "the end finishes with the arms more extended, then suddenly it snaps back to the normal position"
  const far = VM.action && VM_FAR_ACTIONS.has(VM.action);
  VM.farK = damp(VM.farK || 0, far ? 1 : 0, 7, dt);
  let fOut = 1;
  if (far && VM_FAR_END.has(VM.action)) {
    const w = Math.min(VM_FAR_OUT, VM.actionDur);
    fOut = 1 - smoothstep(VM.actionDur - w, VM.actionDur, VM.actionT);
    if (VM.action === 'inspect') fOut = Math.min(fOut, VM.actK);
  }
  const h0 = VM_HIP[m.kind] || VM_HIP.rifle, h1 = VM_HIP_ACT[m.kind] || h0, fk = smoothstep(0, 1, VM.farK) * fOut, hip = _hipK;
  for (let i = 0; i < 6; i++) hip[i] = lerp(h0[i], h1[i], fk);
  const px = lerp(hip[0], 0, a), py = lerp(hip[1], -m.sightY, a), pz = lerp(hip[2], -m.adsZ, a);
  // "smile" sway: the weapon slides from side to side and drops in the middle, without bounce
  // abrupt at the extremes (cos 2θ instead of |sin θ|)
  const bx = Math.cos(VM.bobT), by = (Math.cos(2 * VM.bobT) - 1) * 0.5;
  let x = px + bx * 0.012 * bobS + VM.swayX * 0.08 * (1 - a * 0.8);
  let y = py + by * 0.013 * bobS - VM.land * landK + Math.sin(VM.breath * 1.6) * 0.0018 * (1 - a) + VM.jump * 0.02 * airK;
  let z = pz + R.z;
  let rx = R.rx + VM.swayY * 0.9 * (1 - a * 0.8) + Math.sin(VM.bobT * 2) * 0.01 * bobS + hip[3] * (1 - a);
  let ry = R.ry + VM.swayX * 1.2 * (1 - a * 0.8) + Math.cos(VM.bobT) * 0.012 * bobS + hip[4] * (1 - a);
  let rz = R.rz + Math.cos(VM.bobT) * 0.02 * bobS + VM.swayX * 0.6 + hip[5] * (1 - a);
  // common walking sway, reused by the grenade arms and the hand-held devices
  VM.bobO.set(bx * 0.012 * bobS + VM.swayX * 0.06, by * 0.013 * bobS - VM.land + Math.sin(VM.breath * 1.6) * 0.0018, 0);
  VM.bobR.set(VM.swayY * 0.35 + Math.sin(VM.bobT * 2) * 0.008 * bobS, VM.swayX * 0.5 + Math.cos(VM.bobT) * 0.01 * bobS, Math.cos(VM.bobT) * 0.015 * bobS + VM.swayX * 0.3);
  // sprint: weapon tilted down and to the side, pumping to the rhythm of the strides (roll around the
  // barrel and slight back-and-forth) rather than bouncing
  // running and reloading (or inspecting) at once: the sprint pose fades out in favor of the choreography, which keeps the strides and
  // stays slightly lower; added together, the sprint tilt and the reload tilt laid the weapon across the middle
  // of the screen, in front of the sight (owner feedback)
  const spA = sp * (1 - fk); VM.sprK = spA;
  const SPR = m.kind === 'pistol' ? VM_SPRINT_NONE : VM_SPRINT;
  x += SPR[0] * spA; y += SPR[1] * spA; z += SPR[2] * spA;
  rx += SPR[3] * spA; ry += SPR[4] * spA; rz += SPR[5] * spA;
  if (m.kind !== 'pistol') { y -= 0.025 * sp * fk; rx -= 0.08 * sp * fk; }
  if (sp > 0.01) {
    const s1 = Math.sin(VM.bobT), s2 = Math.sin(2 * VM.bobT), k = lerp(spA, sp * 0.5, fk) * Math.min(1, VM.bobAmt);
    x += bx * 0.012 * k; y += by * 0.012 * k; z += s2 * 0.01 * k; rz += s1 * 0.1 * k; rx += s2 * 0.04 * k; ry += bx * 0.05 * k;
  }
  y -= VM.crouch * 0.01 * (1 - a);
  // going to the shoulder: the weapon follows an arc (it rolls a little and rises from below) instead of a straight line
  const arc = Math.sin(clamp(VM.ads, 0, 1) * Math.PI) * (1 - sp);
  rz += arc * 0.06 * (S.ads ? 1 : -0.6); y -= arc * 0.007; x += arc * 0.006;
  // strafing: the weapon tilts toward the side we're going and lags a bit; the weapon recoils when we accelerate
  rz -= VM.tilt * 0.055 * (1 - a * 0.75); x -= VM.tilt * 0.007 * (1 - a * 0.6); ry += VM.tilt * 0.015 * (1 - a);
  z += VM.push * 0.012 * (1 - a * 0.7); rx -= VM.push * 0.012 * (1 - a);
  // in the air: the weapon rises and tilts, then the landing squashes it (spring of VM.land)
  y += VM.jump * 0.012 * airK; rx += VM.jump * 0.05 * (1 - a * 0.9);
  // against a wall: the weapon pulls back and straightens up, barrel pointing up
  const wk = VM.wall * (1 - a) * (1 - sp);
  z += wk * 0.1; y -= wk * 0.025; rx += wk * 0.55; ry += wk * 0.22; rz -= wk * 0.12;
  // slide: the weapon tilts outward and drops, with a slight tremor from the speed
  const sl = (S.slide || 0) * (1 - a);
  if (sl > 0.01) { x += 0.03 * sl; y -= 0.025 * sl; z += 0.02 * sl; rx += 0.12 * sl; ry -= 0.1 * sl; rz += (0.32 + Math.sin(VM.breath * 40) * 0.01) * sl; }
  // lowering (weapon change)
  // the weapon dips while turning outward (and comes back up the same way) rather than dropping straight down
  y -= VM.lower * 0.28; rx -= VM.lower * 0.9; rz += VM.lower * 0.32; x += VM.lower * 0.05; ry -= VM.lower * 0.18;
  // weapon slung on the back for a streak: it rises, tilts and passes over the right shoulder
  if (VM.sling > 0.001) {
    const o = keySpline(VM_SLING.pos, VM.sling), r = keySpline(VM_SLING.rot, VM.sling);
    x += o.x; y += o.y; z += o.z; rx += r.x; ry += r.y; rz += r.z;
  }

  // action animations
  let gripL = m.gripL.clone(), gripR = m.gripR.clone();
  m.mag.position.copy(m.magHome); m.mag.rotation.set(0, 0, 0); if (!m.tubeFed) m.mag.visible = true;
  if (m.bolt) { m.bolt.position.set(0.02, 0.045, 0.07); m.bolt.rotation.set(0, 0, 0); }
  if (m.pump) m.pump.position.z = 0;
  VM.rlT = null; VM.rlD = null; VM.slideHold = false;
  // chaining and cancelling: when one choreography replaces another (or is interrupted), the gap between the old pose
  // and the new one becomes the offset of a damped spring (VM_ANIM.cancelAnim) launched with a share of the weapon's velocity:
  // it keeps some of its momentum, then reaches its new pose, with no jump from one frame to the next
  const cur = VM.action ? VM.action + ':' + VM.actionDur : '', G0 = VM.lastGo;
  let gNow = null;
  if (VM.action) {
    VM.actionT += dt; const t = clamp(VM.actionT / VM.actionDur, 0, 1), D = VM.actionData;
    const go = vmChoreo(VM.action, t, D, def, m); // full choreography (06d-reload.js), otherwise the old poses below
    if (go) {
      // inspection interrupted: the pose fades out smoothly, then the action stops
      const k = VM.action === 'inspect' ? (VM.actK = damp(VM.actK, VM.actFade ? 0 : 1, 16, dt)) : 1;
      if (VM.action === 'inspect' && VM.actFade && VM.actK < 0.02) VM.actionT = VM.actionDur;
      gNow = go.map((v) => v * k);
      x += gNow[0]; y += gNow[1]; z += gNow[2]; rx += gNow[3]; ry += gNow[4]; rz += gNow[5];
    }
    else if (VM.action === 'reload') {
      const e = env(t, 0, 0.14, 0.82, 1);
      rz += 0.34 * e; rx += 0.14 * e; ry += -0.08 * e; y -= 0.02 * e; x -= 0.025 * e;
      if (def.fam === 'pistol') { rz -= 0.2 * e; rx += 0.1 * e; }
      if (t > 0.16 && t < 0.34) { const k = smoothstep(0.16, 0.34, t); m.mag.position.y -= k * 0.3; m.mag.position.z += k * 0.05; m.mag.rotation.x = k * 0.4; }
      if (t >= 0.34 && t < 0.4) m.mag.visible = false;
      if (t >= 0.4 && t < 0.6) { const k = 1 - smoothstep(0.4, 0.58, t); m.mag.position.y -= k * 0.28; m.mag.position.z += k * 0.04; m.mag.rotation.x = k * 0.3; }
      const hk = env(t, 0.12, 0.2, 0.62, 0.74);
      gripL.lerp(_v4.copy(m.mag.position).add(new V3(-0.01, -0.09, 0)), hk);
      if (t > 0.34 && t < 0.4) gripL.y -= 0.25;
      if (D.empty) { const ck = env(t, 0.74, 0.8, 0.84, 0.9); rz += 0.15 * ck; gripL.lerp(new V3(0.02, 0.06, 0.1), ck * 0.9); if (m.bolt) m.bolt.position.z += ck * 0.08; }
      if (!D.sm && t > 0.2) { sfxMech('magout'); D.sm = 1; }
      if (!D.si && t > 0.57) { sfxMech('magin'); D.si = 1; R.vy -= 0.4; R.vrx += 0.6; }
      if (D.empty && !D.sc && t > 0.8) { sfxMech('charge'); D.sc = 1; R.vz += 0.4; }
    } else if (VM.action === 'shellStart' || VM.action === 'shellEnd') {
      const e = VM.action === 'shellStart' ? smoothstep(0, 1, t) : 1 - smoothstep(0, 1, t);
      rz += 0.35 * e; rx += 0.2 * e; y -= 0.02 * e; x -= 0.015 * e;
      gripL.lerp(new V3(0, -0.07, 0.0), e * 0.6);
    } else if (VM.action === 'shell') {
      rz += 0.35; rx += 0.2; y -= 0.02; x -= 0.015;
      const k = Math.sin(t * Math.PI);
      gripL.lerp(new V3(0, -0.09 + k * 0.05, 0.0 - k * 0.02), 1);
      m.mag.visible = t < 0.55; m.mag.position.set(0, -0.08 + k * 0.05, 0.0 - k * 0.02);
      if (!D.s && t > 0.5) { sfxMech('shell'); D.s = 1; R.vrx += 0.3; }
    } else if (VM.action === 'bolt') {
      const e = env(t, 0, 0.15, 0.8, 1);
      rz -= 0.18 * e; ry += 0.05 * e; rx += 0.05 * e;
      const k = env(t, 0.15, 0.35, 0.5, 0.7);
      if (m.bolt) { m.bolt.rotation.z = env(t, 0.12, 0.22, 0.65, 0.75) * 1.0; m.bolt.position.z += k * 0.1; }
      gripR.lerp(new V3(0.07, 0.03, 0.07 + k * 0.1), e);
      if (!D.s && t > 0.15) { sfxMech('bolt'); D.s = 1; }
      if (!D.e && t > 0.4) { vmShell(def); D.e = 1; }
    } else if (VM.action === 'pump') {
      // pump: the forend slides back with the left hand, ejects the spent shell, then returns
      const k = env(t, 0.08, 0.3, 0.46, 0.76); gripL.z += k * 0.075; if (m.pump) m.pump.position.z = k * 0.075;
      if (!D.s && t > 0.3) { sfxMech('pump'); vmShell(def); D.s = 1; R.vz += 0.4; R.vrx += 0.3; }
    } else if (VM.action === 'draw') {
      // handled by lower
    }
    if (VM.actionT >= VM.actionDur) { if (VM_FAR_END.has(VM.action)) VM.farK = 0; VM.action = null; } // already back at the hip
  }
  const AN = vmaCfg(def).cancelAnim, PO = VM.popO, PV = VM.popV, GV = VM.gV, changed = cur !== VM.lastAct;
  if (changed) { for (let i = 0; i < 6; i++) { PO[i] += G0[i] - (gNow ? gNow[i] : 0); PV[i] += GV[i] * AN.inertia; } VM.lastAct = cur; }
  for (let i = 0; i < 6; i++) { const g = gNow ? gNow[i] : 0; GV[i] = changed || dt <= 0 ? 0 : clamp((g - G0[i]) / dt, -12, 12); G0[i] = g; }
  vmaSpring(PO, PV, AN.springParams, dt);
  x += PO[0]; y += PO[1]; z += PO[2]; rx += PO[3]; ry += PO[4]; rz += PO[5];
  // handling shocks (magazine slapped in, bolt flying forward: vmViewKick, 06cy-springs.js), layered over the choreography
  const CO = VM.viewKickO;
  vmaSpring(CO, VM.viewKickV, vmaCfg(def).reloadAnim.springParams, dt);
  x += CO[0]; y += CO[1]; z += CO[2]; rx += CO[3]; ry += CO[4]; rz += CO[5];

  // optic that narrows the weapon view when aiming (ACOG, info.vmFov): its motions (recoil, sway) are reduced accordingly, so they
  // keep on screen the same amplitude they have with other sights; the eyepiece only shows the world when aiming (mask, 06p)
  if (m.vmFov) {
    const kz = lerp(1, Math.tan(m.vmFov * Math.PI / 360) / Math.tan(22 * Math.PI / 180), a);
    x = px + (x - px) * kz; y = py + (y - py) * kz; z = pz + (z - pz) * kz; rx *= kz; ry *= kz; rz *= kz;
    if (m.ocular) m.ocular.visible = VM.ads > 0.2;
  }
  VM.holder.position.set(x, y, z);
  VM.holder.rotation.set(rx, ry, rz);
  // pistol while sprinting: the weapon follows the pumping arm (held one-handed, right wrist)
  if (m.kind === 'pistol' && sp > 0.001) pistolRunPose(m, smoothstep(0, 1, sp) * (VM.action ? 0 : 1));
  // arms: shoulders fixed to the body, hands resting on the weapon
  placeHands(m, gripR, gripL);
  placeWatch(VM.watch, VM.arms.L);
  const hideArms = !!def.scope && a > 0.92;
  VM.holder.visible = !hideArms && VM.lower < 0.97 && VM.sling < 0.9;
  // both hands let go of the weapon as soon as it heads for the shoulder: it slides away on its own on its sling, which leaves room for the camera
  setArmVisible(VM.arms.L, VM.sling < 0.4); setArmVisible(VM.arms.R, VM.sling < 0.5);

  // flash
  VM.flashT -= dt; VM.flash.visible = VM.flashT > 0 && !hideArms;
  if (VM.flash.visible) {
    // the muzzle flash star tightens and fades out, the flame lengthens as it dies (three frames at 60 per second)
    const k = smoothstep(0, 0.55, VM.flashT / VM.flashT0), c = VM.flash.children;
    VM.flashM[0].opacity = VM.flashM[1].opacity = k;
    c[0].scale.setScalar(0.75 + 0.25 * k); c[1].scale.z = c[2].scale.z = 1.3 - 0.3 * k;
  }
  vmFlash.intensity = Math.max(0, vmFlash.intensity - dt * 90);
  vmUpdateDrops(dt);
  // casings
  for (const s of VM.shells) {
    if (s.t <= 0) continue; s.t -= dt;
    s.v.y -= 9.8 * dt; s.mesh.position.addScaledVector(s.v, dt);
    s.mesh.rotation.x += s.w.x * dt; s.mesh.rotation.y += s.w.y * dt; s.mesh.rotation.z += s.w.z * dt;
    if (s.t <= 0) s.mesh.visible = false;
  }
  // first-person scene sun aligned with the camera and dimmed in shade
  _q1.copy(camera.quaternion).invert();
  vmSun.position.copy(SUN_DIR).applyQuaternion(_q1).multiplyScalar(5);
  vmSun.intensity = lerp(0.25, 2.3, VM.sunVis);
  // sky visible at hand height (baked lighting): the weapon darkens indoors
  const L = lightAt(camera.position.x, camera.position.y - 0.25, camera.position.z);
  VM.sky = damp(VM.sky === undefined ? L[0] : VM.sky, L[0], 3, dt);
  const skc = skyCurve(VM.sky); WMU.uSkyC.value.z = skc; // sky seen from the camera: haze of covered places (WM_AO)
  vmHemi.intensity = lerp(0.55, 0.75, VM.sunVis) * lerp(0.42 * WMU.uSkyC.value.y, 1, skc);
  // under a scenery lamp, the weapon picks up its light (lamp layers of the baked lighting)
  vmLamp.color.lerp(lampAt(camera.position.x, camera.position.y - 0.25, camera.position.z, _vmLampC), 1 - Math.exp(-3 * dt));
}
const _vmLampC = new THREE.Color();

