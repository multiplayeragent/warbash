/* ==========================================================================
   PER-MAP SETTINGS: atmosphere, spawns, bot points of interest, named zones, snowfall,
   HDRI lighting. Called by the map loading (mapBuild and mapUnload, 09a-loading.js). In addition to what
   02-map.js describes, a definition (MAP_DEFS.id) carries:
     splat, far             ground distribution map, view distance;
     near                   { x, z }: beyond it, the scenery is in the far chunk (CHUNK_NEAR, 02a-kit.js; 50 and 66 m by default);
     winter                 surfaces, atlas and materials of the winter kit (02i-winter.js), otherwise neither generated nor loaded;
     update(t, dt), unload()   per-frame animation, map-specific cleanup (optional);
     ready()                what needs the map's lighting in place (water reflections), just before the
                            shader compilation (optional);
     surfaces, kit(), materials(M)   optional procedural surfaces to generate (harbor kit, water), atlases specific to
                            the map (after the surfaces), materials specific to the map (after the library);
     dom                    [x, z] of the three domination points, A (Alpha side), B (center), C (Bravo side), symmetric in z;
     void                   { kill }: floating islands, no ground outside the collision boxes; under kill, you die (VOID, 02-map.js);
     spawns, poi, zones     Alpha team spawns (Bravo: mirror in z), bot points of interest, named zones;
     lane(x), sniper, coverZ, heli, cam, surface(p)   route of a point, sniper's post, limit of the covers,
                            helicopter ellipse, radius of the aerial view, footstep material on the ground;
     atmo                   atmosphere (see ATMO_DEFAULT in 01-core.js).
   ========================================================================== */
/* Photographed sky of a map (skyPhoto of its definition: { key, rot, gain }): upper half of a panorama (assets/sky/, packed
   into dist/tex/ by build.py, _lo version at Low quality), loaded with the map's textures and read by the sky shader (SKY_PHOTO);
   absent or unreachable: the procedural sky stays. Freed with the map. drift: the clouds drift, the sky oscillating by ± drift degrees
   around its orientation over period seconds (skyPhotoUpdate: the photo's sun stays near the map's). No mipmaps (the sky is magnified on screen, and the seam
   around the circumference makes no line) and no repeat in height. */
const SKYP = { tex: null, P: null };
async function skyPhotoLoad(P) {
  skyPhotoFree();
  if (!P) return;
  const lo = 'sky_' + P.key + '_lo', key = RQ.q.lean && TEX_PACKS[lo] ? lo : 'sky_' + P.key;
  const d = await fetchTexPack(key);
  const t = d && (await new Promise((res) => new THREE.TextureLoader().load(d.map, res, undefined, () => res(null))));
  if (!t) return;
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.generateMipmaps = false; t.minFilter = t.magFilter = THREE.LinearFilter;
  SKYP.tex = t; SKYP.P = P; SkyShader.uniforms.tSky.value = t; SkyShader.uniforms.uSkyP.value.set(P.rot || 0, P.gain || 1, 0, 0);
  skyMat.defines.SKY_PHOTO = ''; skyMat.needsUpdate = true;
}
function skyPhotoUpdate(t) {
  const P = SKYP.P; if (!SKYP.tex || !P.drift) return;
  SkyShader.uniforms.uSkyP.value.x = (P.rot || 0) + (P.drift / 360) * Math.sin((t * Math.PI * 2) / (P.period || 1500));
}
function skyPhotoFree() {
  if (SKYP.tex) { SKYP.tex.dispose(); SKYP.tex = null; SKYP.P = null; SkyShader.uniforms.tSky.value = null; }
  if ('SKY_PHOTO' in skyMat.defines) { delete skyMat.defines.SKY_PHOTO; skyMat.needsUpdate = true; }
}
/* Atmosphere: sun, sky, fog, lights, color grading, snow. Objects created later (shadows, composer,
   effects) also read the loaded map's atmosphere at their creation. */
const _atmoC = new THREE.Color();
function applyAtmosphere(A) {
  SUN_DIR.set(...A.sun).normalize();
  // thinned with altitude (fogH), the fog loses density above the ground: 30% more at its base keeps the depth of the streets
  scene.fog.color.setRGB(...A.fog); scene.fog.density = A.fogD * (A.fogH && A.fogH[0] > 0 ? 1.3 : 1);
  hemi.color.setHex(A.hemi[0]); hemi.groundColor.setHex(A.hemi[1]); hemi.intensity = A.hemi[2];
  vmHemi.color.setHex(A.vmHemi[0]); vmHemi.groundColor.setHex(A.vmHemi[1]); vmSun.color.setHex(A.vmSun);
  const U = SkyShader.uniforms;
  for (const [k, u] of [['zen', 'uZen'], ['mid', 'uMid'], ['hor', 'uHor'], ['gnd', 'uGnd'], ['glow', 'uGlow'], ['halo', 'uHalo'], ['disk', 'uDisk'], ['cloudLo', 'uCloudLo'], ['cloudHi', 'uCloudHi'], ['cloud', 'uCloud'], ['ridge', 'uRidge'], ['ridgeSnow', 'uRidgeSnow'], ['ridgeRock', 'uRidgeRock'], ['volc', 'uVolc'], ['plume', 'uPlume'], ['erupt', 'uErupt'], ['sea', 'uSea']]) U[u].value.set(...(A.sky[k] || ATMO_DEFAULT.sky[k])); // (a missing key: the default one, off)
  // the volcano code is compiled into the sky shader only for a map that has one (otherwise it would cost every map)
  const volc = !!(A.sky.volc && A.sky.volc[1] > 0);
  if (volc !== ('SKY_VOLC' in skyMat.defines)) { if (volc) skyMat.defines.SKY_VOLC = ''; else delete skyMat.defines.SKY_VOLC; skyMat.needsUpdate = true; }
  const sea = !!(A.sky.sea && A.sky.sea[3] > 0); // sea of clouds (floating islands): same rule
  if (sea !== ('SKY_SEA' in skyMat.defines)) { if (sea) skyMat.defines.SKY_SEA = ''; else delete skyMat.defines.SKY_SEA; skyMat.needsUpdate = true; }
  const F = FinalShader.uniforms;
  F.uGradeLo.value.set(...A.grade.lo); F.uGradeHi.value.set(...A.grade.hi); F.uRayTint.value.set(...A.rays);
  const G = Object.assign({}, GRADE_DEF, A.grade); // grading: what the map doesn't specify comes from GRADE_DEF (01-core.js)
  F.uExposure.value = G.exp * G.gain; F.uSat.value = G.sat; F.uCon.value = G.con; F.uVig.value = G.vig; F.uLift.value = G.lift;
  // atmosphere: glow of the sun in the haze, fog thinned with altitude (FOG_U, 01-core.js)
  const sc = _atmoC.setHex(A.sunColor);
  FOG_U.fogSun.value.set([SUN_DIR.x, SUN_DIR.y, SUN_DIR.z, A.fogSun || 0]); FOG_U.fogSunCol.value.set([sc.r, sc.g, sc.b]); FOG_U.fogHeight.value.set(A.fogH || [0, 0]);
  for (const u of raysPass ? [RaysShader.uniforms, raysPass.mat.uniforms] : [RaysShader.uniforms]) { u.uTint.value.set(...A.rays); u.uThr.value = A.raysThr; u.uCap.value = A.raysCap; }
  if (bloomPass) { bloomPass.strength = A.bloom[0]; bloomPass.radius = A.bloom[1]; bloomPass.threshold = A.bloom[2]; }
  WMU.uAOFloor.value = A.aoFloor; WMU.uVolOpen.value = A.volOpen ? 1 : 0;
  const IN = A.interior || [1, 1, 1]; WMU.uSkyC.value.set(IN[0], IN[1], 1, IN[2]); // indoor/outdoor contrast (skyCurve, 02c-materials.js)
  WMU.uDustCol.value.setRGB(sl(A.dust[0]), sl(A.dust[1]), sl(A.dust[2]));
  const S = A.snow || A.coat; // deposit on top of the scenery: snow (with its effects: white impacts, sliding objects) or ash (coat: rendering only)
  WMU.uSnow.value.set(S ? S.top : 0, S ? S.foot : 0, 0.3, 0.55);
  if (S) WMU.uSnowCol.value.setRGB(sl(S.color[0]), sl(S.color[1]), sl(S.color[2]));
  if (csm) {
    csm.lightDirection.copy(SUN_DIR).negate();
    for (const l of csm.lights) { l.color.setHex(A.sunColor); l.intensity = A.sunI; l.shadow.needsUpdate = true; }
  }
  applyAtmoFx();
}

/* Before the build: current map, bounds, spawns, points of interest, zones, atmosphere (the sun orients
   the baked lighting, the snow and the material generation depend on them) */
function mapSetup(id) {
  const info = mapById(id), D = MAP_DEFS[info.id];
  CURMAP.id = info.id; CURMAP.info = info; CURMAP.def = D;
  Object.assign(MAP, D.bounds); Object.assign(SPLAT, D.splat); Object.assign(CHUNK_NEAR, D.near || { x: 50, z: 66 }); // scenery chunks (02a-kit.js): the play area of a big map
  VOID.on = !!D.void; VOID.kill = D.void ? D.void.kill : -1e9; // floating islands: no ground outside the islands (02-map.js)
  reliefBuild(D); // terrain relief and round zone (02-relief.js), before the scenery that sits on it
  SPAWNS[0] = D.spawns.map(([x, z]) => [x, z]); SPAWNS[1] = D.spawns.map(([x, z]) => [x, -z]);
  POI.length = 0; POI.push(...D.poi);
  ZONES.length = 0; ZONES.push(...D.zones);
  applyAtmosphere(D.atmo);
  camera.far = D.far || 260; camera.updateProjectionMatrix();
}
/* After the scenery (map root ready): snowfall */
function mapDressing() {
  const S = CURMAP.def.atmo.snowfall;
  if (S) makeSnowfall(S);
}
/* Ambient lighting of the map: its HDRI if already converted; otherwise its procedural sky, while waiting for
   the HDRI at most 6 s after its download starts (if it arrives later, it replaces the sky at the first pause or at the end of the match) */
async function mapEnvironment() {
  const name = CURMAP.def.atmo.hdri;
  if (ENV_CACHE.has(name)) { setEnvMap(ENV_CACHE.get(name)); return; }
  buildEnvironment();
  if (!name || GPUX.lean.hdri) return; // map without HDRI, or adaptation learned on this device: procedural sky, the HDRI is not converted (01a-gpu.js)
  const j = hdriFetch(name);
  await Promise.race([j.ready, new Promise((r) => setTimeout(r, Math.max(0, 6000 - (performance.now() - j.t0))))]);
}
/* Unloading: map-specific cleanup (its 3D objects go with its root, MAPL.root) */
function mapTeardown() {
  const D = CURMAP.def; if (!D) return;
  if (D.unload) D.unload();
  hangsClear(); canvasesClear(); HOLES.length = 0;
  SNOWFALL.obj = SNOWFALL.mat = null;
  waterUnload();
  VOID.on = false; VOID.kill = -1e9; reliefFree();
  CURMAP.id = null; CURMAP.info = null; CURMAP.def = null;
}
/* Map-specific animation, every frame */
function mapUpdate(t, dt) {
  const D = CURMAP.def; if (!D) return;
  if (D.update) D.update(t, dt);
  updateHangs(dt, t); canvasesUpdate(dt);
  updateSnowfall(dt, t); waterUpdate(t); pondUpdate(t); rippleUpdate(dt);
}
