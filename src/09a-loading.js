/* ==========================================================================
   MAP LOADING
   Startup only prepares the base common to all maps (rendering, effects, soldiers, weapons, first-person view,
   menus): we reach the menu quickly, whatever the number of maps. A map is only built when a match
   is launched (solo or online, never in a lobby), with real progress: photo textures (files next to
   the page), materials, scenery and collisions, baked lighting (Web Workers), bot routes, satellite
   survey, shader compilation. Only one map is in memory at a time. It stays there as long as it can be replayed
   (match, Solo screen, online lobby: an already loaded map stays there, but the lobby loads none), then it is fully freed after MAPL_KEEP seconds elsewhere in
   the menus: geometries, textures, materials and their shader programs, collisions, navigation, lighting.
   ========================================================================== */
const MAPL = { id: null, state: 'none', root: null, job: null, jobId: null, p: 0, msg: '', subs: new Set(), idle: 0, fail: null, T: [], ms: 0 };
const MAPL_KEEP = 60;

/* Progress (0 to 1): each subscriber receives (p, message, map id) */
function mapProg(msg, p) {
  MAPL.msg = msg; MAPL.p = p;
  for (const f of MAPL.subs) { try { f(p, msg, MAPL.id); } catch (e) { console.error(e); } }
}
function mapReady(id) { return MAPL.state === 'ready' && MAPL.id === mapById(id).id; }

/* Map ready to play: builds it if needed (after freeing the other). Requests are chained, one
   build at a time; a request for the map already ready or in progress returns the same promise. */
function mapEnsure(id) {
  id = mapById(id).id;
  MAPL.idle = 0;
  if (MAPL.job && MAPL.jobId === id) return MAPL.job;
  const prev = MAPL.job;
  const job = (async () => {
    if (prev) { try { await prev; } catch (e) { /* failure of the previous one: no effect on this one */ } }
    if (mapReady(id)) return;
    if (MAPL.id) mapUnload();
    await mapBuild(id);
  })();
  MAPL.job = job; MAPL.jobId = id;
  job.catch((e) => {
    console.error('map loading', id, e);
    if (e && e.gpuLost && gpuAutoRetry(UI.flow && !UI.flow.online ? id : null)) return; // the page relaunches, the solo match resumes afterward (gpuResume)
    MAPL.fail = { id, t: performance.now(), err: e };
    if (MAPL.job === job) { MAPL.job = null; MAPL.jobId = null; }
  });
  return job;
}

async function mapBuild(id) {
  const def = MAP_DEFS[id], info = mapById(id), t0 = performance.now();
  if (!def) throw new Error('unknown map: ' + id);
  MAPL.id = id; MAPL.state = 'loading'; MAPL.T = [];
  // each step yields to the browser (progress bar, network); durations in MAPL.T (console)
  let tStep = t0, last = '';
  const step = (msg, p) => {
    const t = performance.now(); if (last) MAPL.T.push([last, Math.round(t - tStep)]); tStep = t; last = msg; gpuLog('map ' + id + ': ' + msg);
    mapProg(msg, p); return new Promise((r) => setTimeout(r, 16));
  };
  try {
    mapSetup(id); // current map, bounds, spawns, zones, ambience (02z-load.js)
    ambLoad(def); // recorded ambient sounds of the map: loaded during construction, freed with it (05c-ambiance.js)
    sfxBootGame(); // match sounds (weapons, footsteps, impacts, streaks, voices): at first launch, then kept (05a-sfx.js)
    await step(_t('Loading textures'), 0.02);
    const T = {}, keys = def.textures || []; let n = 0;
    await loadAssetTextures(T, keys, () => { n++; mapProg(_t('Loading textures'), 0.02 + (0.16 * n) / keys.length); });
    T.wearMap = await wearLoad(); // scanned wear layer of the scenery (02b-texlab.js)
    await mechaTexLoad(); // mecha photo surfaces, once and for all, before shader compilation (08f-mecha.js)
    await skyPhotoLoad(def.skyPhoto); // photographed sky of the map, if it has one (02z-load.js)
    await step(_t('Generating materials'), 0.18);
    buildTextures(T); makeMaterials();
    await gpuBarrier('textures'); // on phone: the GPU finishes the generated textures before the next step (01a-gpu.js)
    await step(_t('Building {0}', info.name), 0.3);
    MAPL.root = new THREE.Group(); MAPL.root.name = 'map ' + id; MAPL.root.matrixAutoUpdate = false; scene.add(MAPL.root);
    def.build(); clothsBuild(); MAPL.rails = railingsSeal(); finalizeWorld(); propsFinalize(); buildHash(); reliefGroundTex(); // sand heights for the shaders (02-relief.js)
    if (def.after) def.after();
    grassBuild(def.grass); // grass blades of the lawns (02nb-lawn.js)
    mapDressing(); // snowfall
    shadeMaterials();
    PREFABS.clear(); WORLD.dressing = null; // only used for construction
    await step(_t('Baking the map lighting'), 0.48);
    bakeLightStart();
    await step(_t('Computing bot routes'), 0.52);
    buildNav(); buildCovers(); mnavBuild(); // (the mecha's network, 08f-mecha.js, is drawn from the bots')
    await step(_t('Baking the map lighting'), 0.62);
    await LIGHT.ready;
    // HDRI lighting of the map (otherwise its procedural sky), see mapEnvironment
    await step(_t('HDRI lighting'), 0.7);
    await mapEnvironment();
    if (def.ready) def.ready(); // whatever needs the map's lighting (water reflections)
    await gpuBarrier('environment');
    // shader compilation THEN satellite survey: the survey is the first full render of the scene, it must not also compile all its programs at once
    // (on a Pixel, the driver took the context back at that moment, see 01a-gpu.js)
    await step(_t('Compiling shaders'), 0.74);
    const passes = RQ.q.lights > 0 ? 2 : 1;
    await mapCompile((pass, d, n) => mapProg(_t('Compiling shaders: {0}%', Math.round(100 * (pass + (n ? d / n : 1)) / passes)), 0.74 + 0.2 * ((pass + (n ? d / n : 1)) / passes)));
    await step(_t('Ready'), 1);
    MAPL.state = 'ready'; MAPL.ms = performance.now() - t0;
    mapProg(_t('Ready'), 1);
  } catch (e) {
    mapUnload();
    throw e;
  }
}
/* Compiles all the scene's programs (two variants: with and without muzzle flashes, see updateFlashLights) in small groups, yielding
   to the browser between each (gpuCompileScene, 01a-gpu.js: progress, live page, driver not saturated), then surveys the satellite map
   (in tiles, buildSatelliteMap) and renders a full frame for what compilation doesn't see. Already compiled: the base's, from one map to the next. prog(pass, done, total) reports progress. */
async function mapCompile(prog) {
  // first match's bot weapons drawn now (map type known): built and compiled along with it
  botArmForMap(); botArmPrebuild(); BOT_ARM.map = MAPL.id;
  const vis = entities.map((e) => e.model.root.visible), dw = domWarm(); // dw: dummy domination point (09i-modes.js), compiled then hidden
  for (const e of entities) if (!e.isPlayer) e.model.root.visible = true;
  try {
    markPrepass(scene); propsWarm(true);
    GPUX.preOk = false; await gpuBarrier('before compile'); GPUX.preOk = true; // healthy context so far: a program that makes it lost is indeed the culprit
    GPUX.culprits = []; gpuApplyFallbacks(scene); gpuApplyFallbacks(vmScene); // renders refused during a previous load: simple versions
    let pass = 0;
    if (RQ.q.lights > 0) { setFlashLightsVisible(true); await gpuCompileScene(scene, camera, (d, n) => prog(0, d, n)); pass = 1; }
    setFlashLightsVisible(false); await gpuCompileScene(scene, camera, (d, n) => prog(pass, d, n));
    await gpuCompileScene(vmScene, vmCamera);
    // scenery material program refused by the driver: the world would be black or missing, better to say so (graphics report)
    const bad = gpuCheckPrograms().filter((b) => b.name === 'MeshStandardMaterial');
    if (bad.length) throw new Error(_t('the graphics driver rejected {0} render programs', bad.length));
    // satellite survey (first full render, in tiles): without the soldiers or the objects woken up for compilation
    propsWarm(false); if (dw) dw.visible = false; entities.forEach((e, i) => { e.model.root.visible = vis[i]; });
    gpuLog('map ' + MAPL.id + ': ' + _t('Capturing the map\u0027s satellite view')); mapProg(_t('Capturing the map\u0027s satellite view'), 0.95);
    await buildSatelliteMap(); buildMinimapStatic();
    await waterProbes(); // scenery reflections in small waters (02m-water.js), one GPU barrier per probe
    propsWarm(true); if (dw) dw.visible = true; for (const e of entities) if (!e.isPlayer) e.model.root.visible = true;
    ripplePrime(); gpuRefPrep(); // wave field, reference of the graphics report: programs and targets ready before the match
    if (!GPUX.lean.warm) { warmupRender(); await gpuBarrier('warmup'); } // skipped if a context loss has been attributed to it (01a-gpu.js)
    shadowWarm(); await gpuBarrier('shadows'); // shadow programs of all materials, with and without muzzle flashes (09-game.js)
    await lighterWarm(prog);
  } finally {
    propsWarm(false); if (dw) dw.visible = false;
    entities.forEach((e, i) => { e.model.root.visible = vis[i]; });
  }
}

/* Automatic mode: the lighter profiles it can drop to mid-match (AUTO_LADDER, down to Low) have other program
   variants (number of muzzle flashes, depth pre-pass without antialiasing...): compiled mid-match, they froze the frame
   for several seconds on an integrated chip (7 s measured on a Radeon 680M). One warm-up frame per profile, now, at load time:
   three.js keeps each variant with its material, so switching profile mid-match has nothing left to compile. */
async function lighterWarm(prog) {
  if (QUALITY[gfxSet('quality')] || GFX_SAFE || RQ.rung < 0 || GPUX.lean.warm) return;
  const keep = { rung: RQ.rung, scale: RQ.scale }, low = AUTO_LADDER.findIndex((r) => r[0] === 'low');
  try {
    for (let r = keep.rung + 1; r <= low; r++) {
      if (prog) mapProg(_t('Preparing graphics settings'), 0.97);
      RQ.rung = r; RQ.scale = AUTO_LADDER[r][2]; resolveQuality(); applyQuality();
      warmupRender(); shadowWarm(); await gpuBarrier('warm ' + AUTO_LADDER[r][0]);
    }
  } finally { RQ.rung = keep.rung; RQ.scale = keep.scale; resolveQuality(); applyQuality(); }
}

/* Frees everything that belongs to the map (back to the base's memory) */
function mapUnload() {
  for (const n of NADES) scene.remove(n.mesh);
  NADES.length = 0; SMOKES.length = 0; clearThrowKnives(); clearAircraft(); clearDrops(); ambUnload();
  for (const d of DEPTH_OWN.values()) d.dispose(); DEPTH_OWN.clear(); // depth materials specific to each material (shadowWarm, 09-game.js)
  if (FX) { FX.holes.clear(); FX.splats.clear(); FX.scorch.clear(); }
  if (MAPL.root) {
    scene.remove(MAPL.root);
    const lib = new Set(Object.values(MAT));
    MAPL.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && !lib.has(o.material)) o.material.dispose(); if (o.isInstancedMesh) o.dispose(); });
    MAPL.root = null;
  }
  grassClear(); skyPhotoFree();
  mapTeardown(); freeMaterials(); lightUnload(); navUnload(); mnavUnload();
  COL.length = 0; RAILS.length = 0; RAMPS.length = 0; LINES.length = 0; BRIDGES.length = 0; PONDS.length = 0; OCC.length = 0; LAMPS.length = 0; HASH.clear(); BEAMS.length = 0; PREFABS.clear(); propsClear();
  WORLD.bufs.clear(); WORLD.meshes.length = 0; WORLD.fine.length = 0; WORLD.scatter.length = 0; WORLD.dressing = null; WORLD.force = null;
  COVERS.length = 0; COVER_GRID.clear();
  for (const e of entities) { e.cover = null; e.path = null; e.goal = null; }
  KS.sat = null; KS.plan = null; HUD.mmStatic = null;
  MAPL.id = null; MAPL.state = 'none';
  mapProg('', 0);
}
/* Unloading outside a build (map no longer requested) */
function mapRelease() {
  if (MAPL.state !== 'ready') return;
  mapUnload(); MAPL.job = null; MAPL.jobId = null;
}

/* Map needed in the current state of the menus: the match's, the launch in progress's, the online lobby's,
   or the one chosen on the Solo screen or in the lobby (kept if already loaded, never preloaded) */
function mapWanted() {
  if (MATCH.state !== 'menu' && MATCH.state !== 'loading') return MAPL.id;
  if (TOOL && OZ.id) return OZ.id; // zones tool (09zn-tool-zones.js): the map being edited there
  if (UI.flow) return mapById(UI.flow.map).id;
  if (NET.role !== 'off' && NET.joined) return NET.cfg.map;
  if (UI.screen === 'solo') return mapById(Settings.map).id;
  return null;
}
/* Once a second: frees the map that hasn't been requested for MAPL_KEEP seconds. Nothing is preloaded: a lobby
   doesn't load the map chosen by the host, everyone loads it when the match launches (loading screen). */
function mapTick() {
  const want = mapWanted();
  if (MAPL.state === 'ready' && MAPL.id !== want && MAPL.jobId === MAPL.id) { if (++MAPL.idle >= MAPL_KEEP) mapRelease(); }
  else MAPL.idle = 0;
}
setInterval(mapTick, 1000);
