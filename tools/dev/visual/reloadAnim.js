/* Smoothness of first-person reloads: node reloadAnim.js [--weaponry m4,usp,l96,m1014] [--testCases norm,empty] [--images folder] [--json file]
   (PAGE=other built version: before/after comparison)
   Plays each reload as in a match (vmStartAction, weapon duration), at 120 frames per second, and records frame by frame the
   position and orientation of the weapon, both hands, the elbows and the held magazine (camera space). A jerk is:
   - a jump: more than 3.5 cm in one frame (1/120 s, 4.2 m/s), or a rotation of more than 10° (1200°/s), faster than a quick gesture
     (hands, weapon, magazine; a swinging elbow can go faster than the hand);
   - a break: the speed changes by more than 0.9 m/s (or 70°/s) from one frame to the next, which no real gesture does;
   - a hard stop: a hand moving at more than 0.6 m/s that comes to rest in fewer than 3 frames.
   Output: one line per weapon and per case (peak speed of each part, number of jerks), then the detail of the jerks (instant,
   part, magnitude); with --images, 16 evenly spaced frames per weapon and per case (folder/<weapon>-<case>/00.png to 15.png).
   Tube-loaded shotguns: start, two shells, end. Also checks that the keys of each choreography follow
   each other in time order. Error code if a jump or an out-of-order key remains.
   Handling shocks (magazine slapped in, bolt released: VM_ANIM, 06cy-springs.js) throw the weapon at once: the breaks
   they cause at those instants are intended; only the jumps remain defects. */
const fs = require('fs'), path = require('path');
const { openGame } = require('./common');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const ids = opt('weaponry', 'm4,mp5,usp,deagle,l96,svd,m1014,rem870').split(','), cases = opt('testCases', 'norm,empty').split(','), imgDir = opt('images', ''), jsonOut = opt('json', '');
const FPS = 120;
(async () => {
  if (imgDir) fs.mkdirSync(imgDir, { recursive: true });
  const { browser, page, logs } = await openGame({ w: 640, h: 360, page: process.env.PAGE, settings: { quality: imgDir ? 'medium' : 'low', dynres: false }, noMap: true, noHdri: true });
  await page.evaluate(() => {
    MATCH.state = 'capture';
    document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; });
    for (const e of entities) if (e.model) e.model.root.visible = false;
    VM.root.visible = true; VM.knifeRig.visible = false; VM.nadeRig.visible = false;
    if (typeof sky !== 'undefined') sky.visible = false;
    scene.background = new THREE.Color(0x8a939c);
    const S = { ads: false, sprint: false, speed: 0, grounded: true, crouch: false, empty: false, lat: 0, fwd: 0, fire: false, wall: 0, slide: 0 };
    const wp = (o, v) => o.getWorldPosition(v), wq = (o, q) => o.getWorldQuaternion(q);
    window.__rl = {
      // weapon ready, idle pose set; program: list of [action, duration, data]
      setup(id, empty) {
        const def = weaponDef(id, [], null);
        vmEquip(def); VM.holder.visible = true; VM.lower = 0; VM.lowerTarget = 0; VM.action = null; VM.farK = 0;
        camera.position.set(0, 1.6, 0); camera.rotation.set(0, 0, 0); camera.fov = Settings.fov; camera.updateProjectionMatrix();
        vmCamera.position.set(0, 0, 0); vmCamera.rotation.set(0, 0, 0);
        S.empty = false; VM.breath = 0; VM.bobT = 0; VM.bobAmt = 0;
        for (let i = 0; i < 90; i++) updateViewmodel(1 / 60, S);
        VM.breath = 0;
        const prog = def.tube ? [['shellStart', 0.32, { empty }], ['shell', 0.46, { empty }], ['shell', 0.46, { empty }], ['shellEnd', 0.3, { empty }]]
          : [['reload', empty ? def.reloadEmpty : def.reload, { empty }]];
        if (!def.tube && empty) S.empty = def.fam === 'pistol';
        return prog;
      },
      start(a) { vmStartAction(a[0], a[1], Object.assign({}, a[2])); },
      // one frame: update, then record (positions in the viewmodel camera space)
      step(dt) {
        VM.breath = 0; // breathing is not a jerk
        updateViewmodel(dt, S); VM.root.updateMatrixWorld(true);
        const m = VM.cur, out = {}, v = new V3(), q = new THREE.Quaternion();
        const put = (k, o) => { wp(o, v); wq(o, q); out[k] = [v.x, v.y, v.z, q.x, q.y, q.z, q.w]; };
        put('firearm', VM.holder); put('leftHand', VM.arms.L.hand); put('rightHand', VM.arms.R.hand);
        for (const [k, arm] of [['elbowL', VM.arms.L], ['elbowR', VM.arms.R]]) if (arm.elbowAt) { v.copy(arm.elbowAt).applyMatrix4(VM.holder.matrixWorld); out[k] = [v.x, v.y, v.z, 0, 0, 0, 1]; }
        const held = m.spare && m.spare.visible ? m.spare : m.mag.visible && m.mag.parent ? m.mag : null;
        if (held) put('magazine', held);
        out.act = VM.action || '';
        return out;
      },
    };
  });
  // keys of each choreography in time order (an older key after a newer one makes the interpolation jump)
  const order = await page.evaluate(() => {
    const bad = [], seen = new Set();
    const walk = (T, name) => {
      if (!T || typeof T !== 'object' || seen.has(T)) return; seen.add(T);
      for (const k of ['gun', 'lh', 'rh', 'bolt']) if (Array.isArray(T[k])) for (let i = 1; i < T[k].length; i++) if (T[k][i][0] <= T[k][i - 1][0]) bad.push(`${name}.${k}: ${T[k][i - 1][0]} then ${T[k][i][0]}`);
      for (const [n, v] of Object.entries(T)) if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, name + '.' + n);
    };
    walk(RELOAD, 'RELOAD'); walk({ INSPECT_LONG, INSPECT_PISTOL }, 'inspection');
    return bad;
  });
  if (order.length) console.log('KEYS OUT OF ORDER:\n  ' + order.join('\n  '));
  const report = [];
  for (const id of ids) for (const testCases of cases) {
    const prog = await page.evaluate(([id, e]) => __rl.setup(id, e), [id, testCases === 'empty']);
    const frames = [];
    for (const a of prog) {
      await page.evaluate((a) => __rl.start(a), a);
      const n = Math.round(a[1] * FPS);
      const chunk = await page.evaluate(([n, dt]) => { const r = []; for (let i = 0; i < n; i++) r.push(__rl.step(dt)); return r; }, [n, 1 / FPS]);
      frames.push(...chunk);
    }
    frames.push(...await page.evaluate(([n, dt]) => { const r = []; for (let i = 0; i < n; i++) r.push(__rl.step(dt)); return r; }, [Math.round(0.35 * FPS), 1 / FPS]));
    // analyse
    const parts = ['firearm', 'leftHand', 'rightHand', 'elbowL', 'elbowR', 'magazine'], ev = [], peak = {};
    const ang = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a[3] * b[3] + a[4] * b[4] + a[5] * b[5] + a[6] * b[6])));
    for (const p of parts) {
      let vPrev = null, wPrev = null; peak[p] = 0;
      for (let i = 1; i < frames.length; i++) {
        const A = frames[i - 1][p], B = frames[i][p];
        if (!A || !B) { vPrev = wPrev = null; continue; }
        const d = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]), w = ang(A, B), t = +(i / FPS).toFixed(3);
        const vel = [(B[0] - A[0]) * FPS, (B[1] - A[1]) * FPS, (B[2] - A[2]) * FPS], sp = d * FPS;
        peak[p] = Math.max(peak[p], sp);
        // a magazine that changes hands (taken in hand, dropped) is not tracked from one frame to the next
        if (p === 'magazine' && d > 0.08) { vPrev = wPrev = null; continue; }
        if (d > 0.035 && p !== 'elbowL' && p !== 'elbowR') ev.push({ t, p, k: 'jumping', v: +(d * 100).toFixed(1) + ' cm' });
        else if (p !== 'elbowL' && p !== 'elbowR' && p !== 'magazine' && w > 0.175) ev.push({ t, p, k: 'jumping', v: +(w * 57.3).toFixed(0) + '°' });
        if (vPrev) {
          const dv = Math.hypot(vel[0] - vPrev[0], vel[1] - vPrev[1], vel[2] - vPrev[2]);
          if (dv > 0.9) ev.push({ t, p, k: 'kink', v: +dv.toFixed(2) + ' m/s' });
          if (p !== 'elbowL' && p !== 'elbowR' && p !== 'magazine' && wPrev !== null && Math.abs(w - wPrev) * FPS > 1.22) ev.push({ t, p, k: 'kink', v: +((Math.abs(w - wPrev) * FPS) * 57.3).toFixed(0) + '°/s' });
        }
        if ((p === 'leftHand' || p === 'rightHand') && vPrev && Math.hypot(...vPrev) > 0.6) {
          const C = frames[i + 2] && frames[i + 2][p];
          if (C && Math.hypot(C[0] - B[0], C[1] - B[1], C[2] - B[2]) * FPS / 2 < 0.05) ev.push({ t, p, k: 'hard stop', v: +Math.hypot(...vPrev).toFixed(2) + ' m/s' });
        }
        vPrev = vel; wPrev = w;
      }
    }
    // neighboring jerks grouped: one per part and per 30 ms slice
    const merged = []; for (const e of ev.sort((a, b) => a.t - b.t)) { const l = merged.find((x) => x.p === e.p && x.k === e.k && e.t - x.t1 < 0.03); if (l) { l.t1 = e.t; l.n++; } else merged.push(Object.assign({ t1: e.t, n: 1 }, e)); }
    report.push({ id, testCases, dur: +(frames.length / FPS).toFixed(2), peak: Object.fromEntries(Object.entries(peak).map(([k, v]) => [k, +v.toFixed(2)])), shotEvents: merged });
    if (imgDir) {
      // sheet: 16 evenly spaced instants, replayed from the start
      const N = 16, tot = frames.length, dir = path.join(imgDir, `${id}-${testCases}`);
      fs.mkdirSync(dir, { recursive: true });
      const prog2 = await page.evaluate(([id, e]) => __rl.setup(id, e), [id, testCases === 'empty']);
      let f = 0, next = 0, k = 0;
      for (const a of prog2) {
        await page.evaluate((a) => __rl.start(a), a);
        const n = Math.round(a[1] * FPS);
        for (let i = 0; i < n; i++, f++) {
          await page.evaluate((dt) => __rl.step(dt), 1 / FPS);
          if (f >= next && k < N) { await page.waitForTimeout(60); await page.screenshot({ path: path.join(dir, String(k).padStart(2, '0') + '.png') }); k++; next = Math.round((k * tot) / N); }
        }
      }
    }
  }
  for (const r of report) {
    console.log(`${r.id} ${r.testCases} (${r.dur} s): peaks ${Object.entries(r.peak).map(([k, v]) => k + ' ' + v).join(', ')} m/s; ${r.shotEvents.length} jerk(s)`);
    for (const c of r.shotEvents) console.log(`   ${c.t.toFixed(3)}${c.n > 1 ? '-' + c.t1.toFixed(3) : ''} s  ${c.p}  ${c.k}  ${c.v}`);
  }
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(report, null, 1));
  const bad = logs.filter((l) => !l.includes('HDRI'));
  if (bad.length) console.log(bad.slice(0, 10).join('\n'));
  await browser.close();
  process.exit(order.length || report.some((r) => r.shotEvents.some((c) => c.k === 'jumping')) ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
