/* Endurance: a match played by the bots (the player, protected, stays at their spawn point), each frame going through the real
   frame() loop; every 20 s of play, a timed render of three fixed views (synchronized with the GPU, median of four) and
   a reading of what grows: GPU resources (textures, geometries, programs), scene meshes, weapons on the ground, moving
   props, simulated fields, JavaScript heap. A match that does not degrade keeps fixed views at the same cost from one reading to the next;
   then a second match on the same map, to compare its start with that of the first. Between two readings, the game logic runs without rendering
   ("frame": average CPU time of a frame, rendering off). Each view is also rendered without the soldiers ("Decor"): what rises there accumulates
   in the scenery (marks, weapons on the ground, debris), whereas the full view also depends on where the soldiers are at that moment.
   node tools/dev/visual/endurance.js [minutes=3] ; MAP=floralia (Floralia, default) ; PAGE=other/version.html ; Q=medium. */
const { openGame } = require('./common');
const MIN = +(process.argv[2] || 3);
(async () => {
  const { browser, page, logs } = await openGame({ page: process.env.PAGE, w: 640, h: 360, settings: { quality: process.env.Q || 'low', dynres: false, difficulty: 1, map: process.env.MAP || 'floralia' }, noHdri: true });
  await page.evaluate(() => {
    const gl = renderer.getContext(), fb = gl.createFramebuffer(), tex = gl.createTexture(), px = new Uint8Array(4);
    gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); renderer.state.reset();
    window.__sync = () => { const prev = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fb); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, prev); };
    window.__T = performance.now();
    // fixed views: flyover of the center, ground at the center, ground from the Alpha base toward the center
    const cx = (MAP.x0 + MAP.x1) / 2, cz = (MAP.z0 + MAP.z1) / 2, s = SPAWNS[0][0] || [cx, MAP.z1 - 4];
    window.__V = [
      ['flyover', [cx + 20, 26, cz + 30], [cx, 0, cz]],
      ['centre', [cx, 1.7, cz], [cx + 20, 1.5, cz + 5]],
      ['base', [s[0], 1.7, s[1]], [cx, 1.5, cz]],
    ];
    window.__match = () => { LOCK.fallback = true; startMatch({}); PL.ent.protT = 1e9; };
    // a slice of play: n frames of 1/30 s through the real loop (the player stays protected)
    // logic only (rendering off, measured separately by __probe): software rendering of one frame takes nearly a second
    window.__play = (n) => {
      // frame() re-registers itself on each call (requestAnimationFrame): without this cut, the 600 calls would all run, with rendering, on the next frame
      let ms = 0; const cr = composer.render, raf = window.requestAnimationFrame; composer.render = () => {}; window.requestAnimationFrame = () => 0;
      for (let i = 0; i < n; i++) {
        PL.ent.protT = 1e9; PL.ent.health = 100;
        if (MATCH.state !== 'playing' && MATCH.state !== 'finish') break;
        __T += 1000 / 30; const t = performance.now(); frame(__T); ms += performance.now() - t;
      }
      composer.render = cr; window.requestAnimationFrame = raf;
      return +(ms / n).toFixed(2);
    };
    // reading: each view rendered four times (median), plus the counters
    window.__probe = () => {
      const cam = { p: camera.position.clone(), q: camera.quaternion.clone() }, out = {};
      for (const [name, p, t] of __V) {
        camera.position.set(...p); camera.lookAt(...t); camera.updateMatrixWorld();
        const ts = [];
        for (let i = 0; i < 6; i++) {
          renderer.info.reset(); updatePostFx(); sky.position.copy(camera.position); updateSoldierLods(); updateShadows();
          __sync(); const t0 = performance.now(); composer.render(0.016); __sync(); if (i >= 2) ts.push(performance.now() - t0);
        }
        ts.sort((a, b) => a - b); out[name] = Math.round((ts[1] + ts[2]) / 2);
        out[name + 'Calls'] = renderer.info.render.calls; out[name + 'Ktri'] = Math.round(renderer.info.render.triangles / 1000);
        // the same view without the soldiers (alive or down): what remains is the scenery and what accumulates in it (marks, weapons on the ground, debris)
        const vis = entities.map((e) => e.model.root.visible); for (const e of entities) e.model.root.visible = false;
        const ts2 = [];
        for (let i = 0; i < 6; i++) {
          renderer.info.reset(); updatePostFx(); updateShadows();
          __sync(); const t0 = performance.now(); composer.render(0.016); __sync(); if (i >= 2) ts2.push(performance.now() - t0);
        }
        entities.forEach((e, i) => { e.model.root.visible = vis[i]; });
        ts2.sort((a, b) => a - b); out[name + 'Decor'] = Math.round((ts2[1] + ts2[2]) / 2); out[name + 'DecorCalls'] = renderer.info.render.calls;
      }
      camera.position.copy(cam.p); camera.quaternion.copy(cam.q);
      let meshes = 0, vis = 0; scene.traverse((o) => { if (o.isMesh || o.isPoints || o.isLine) { meshes++; if (o.visible) vis++; } });
      const m = renderer.info.memory;
      return Object.assign(out, {
        t: Math.round(MATCH.time), tex: m.textures, geo: m.geometries, prog: renderer.info.programs.length, meshes, vis, children: scene.children.length,
        drops: DROP.list.length, physAwake: PHYS.awake ? PHYS.awake.length : -1, bend: BEND.act ? BEND.act.length : -1, rip: RIP.awake ? 1 : 0, ripIdle: Math.round(RIP.idle),
        kc: KC.count, events: MATCH.events.length, sounds: soundEvents.length, ent: entities.length, kills: MATCH.score.join('-'),
        heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 0,
      });
    };
  });
  const rows = [];
  for (const m of [1, 2]) {
    await page.evaluate(() => __match());
    const n = m === 1 ? Math.round(MIN * 3) : 3; // second match: its first minute
    rows.push(Object.assign({ m, frame: 0 }, await page.evaluate(() => __probe())));
    console.log(JSON.stringify(rows[rows.length - 1]));
    for (let k = 0; k < n; k++) {
      const frameMs = await page.evaluate(() => __play(600));
      rows.push(Object.assign({ m, frame: frameMs }, await page.evaluate(() => __probe())));
      console.log(JSON.stringify(rows[rows.length - 1]));
    }
    await page.evaluate(() => { if (MATCH.state === 'playing') { MATCH.state = 'ended'; } toMenu(); });
  }
  if (logs.length) console.log(logs.slice(0, 20).join('\n'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(2); });
