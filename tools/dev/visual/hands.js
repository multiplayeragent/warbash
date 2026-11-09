/* Support hand (left hand) placed on the weapon: measures, for each weapon and each support grip that fits it, whether the hand goes through
   the weapon, whether the palm touches it and whether it stays away from the magazine, in first person (hip, aiming) and for a soldier seen from
   outside (outfit showcase pose, aim 0.5, and shouldered weapon, aim 1). With --acc 1, also with each under-barrel accessory
   that fits it (vertical grip, angled grip, bipod).
   - First person: vertices of the left hand deformed by its bones (SkinnedMesh.boneTransform), brought back into the weapon's frame.
   - Soldier: vertices of the left hand baked into the body (hand bone only), placed by layoutSoldier.
   A vertex is inside the weapon if it is inside one of its closed pieces (parity of three rays, two-out-of-three vote); its
   depth is the distance to the nearest surface (samples every 1.5 mm), likewise for the distance to the magazine (6 cm at
   most). Palm contact is the signed distance of the nearest underside-of-the-palm vertex (palm bone, palm side)
   to the weapon: negative, the palm sinks in; large, it floats (center: median of the middle of the palm, hollow, which does not touch a round
   handguard).
   node hands.js [--weaponry m4,ak47|everything] [--acc 1|0] [--viewList fp,tp] [--images folder] [--json file] [--trial file.js]
   --trial: script run in the page before the measurements (try a setting without rebuilding the game).
   Output: one line per weapon and per view; exit code 1 if a threshold (THRESHOLDS) is exceeded. No map or rendering (except --images). */
const fs = require('fs'), path = require('path');
const { openGame } = require('./common');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const wanted = opt('weaponry', 'everything'), withAcc = opt('acc', '1') !== '0', modes = opt('viewList', 'fp,tp').split(','), imgDir = opt('images', ''), jsonOut = opt('json', ''), trial = opt('trial', '');
/* thresholds (mm): maximum depth per part of the hand, contact of the palm center [min, max], distance to the magazine;
   the soldier's hand is baked in a single pose (its fingers do not close on the weapon): a bit more tolerance */
const THRESHOLDS = {
  fp: { handPalm: 3, handFingers: 4, thumb: 4, contact: [-3, 4], magazine: 5 },
  tp: { handPalm: 5, handFingers: 7, thumb: 7, contact: [-5, 6], magazine: 15 },
};

(async () => {
  if (imgDir) fs.mkdirSync(imgDir, { recursive: true });
  const { browser, page, logs } = await openGame({ w: 960, h: 540, settings: { quality: imgDir ? 'medium' : 'low', dynres: false }, noMap: true, noHdri: true });
  await page.evaluate(() => {
    MATCH.state = 'capture';
    document.querySelectorAll('body > *:not(canvas)').forEach((e) => { e.style.display = 'none'; });
    for (const e of entities) if (e.model) e.model.root.visible = false;
    VM.root.visible = true; VM.knifeRig.visible = false; VM.nadeRig.visible = false;
    if (typeof sky !== 'undefined') sky.visible = false;
    scene.background = new THREE.Color(0x8a939c);
    const CELL = 0.005, STEP = 0.0015, k3 = (x, y, z) => `${x},${y},${z}`;
    /* closed pieces of the weapon (weapon frame), surface samples, magazine box */
    window.__gun = (key) => {
      const info = buildGunModel(key); info.group.updateMatrixWorld(true);
      const meshes = [];
      info.group.traverse((o) => { if (o.isMesh && o.visible && !o.material.transparent && !(o.geometry.parameters && o.geometry.parameters.openEnded)) meshes.push(o); });
      const H = new Map(), HM = new Map(), a = new V3(), b = new V3(), c = new V3(), p = new V3(), inMag = (o) => { for (; o; o = o.parent) if (o === info.mag) return true; return false; };
      const boxes = meshes.map((m) => new THREE.Box3().setFromObject(m)), inv = meshes.map((m) => new THREE.Matrix4().copy(m.matrixWorld).invert());
      for (const m of meshes) {
        const pos = m.geometry.attributes.position, idx = m.geometry.index, tri = idx ? idx.count / 3 : pos.count / 3, mag = inMag(m);
        for (let t = 0; t < tri; t++) {
          a.fromBufferAttribute(pos, idx ? idx.getX(t * 3) : t * 3).applyMatrix4(m.matrixWorld);
          b.fromBufferAttribute(pos, idx ? idx.getX(t * 3 + 1) : t * 3 + 1).applyMatrix4(m.matrixWorld);
          c.fromBufferAttribute(pos, idx ? idx.getX(t * 3 + 2) : t * 3 + 2).applyMatrix4(m.matrixWorld);
          const n = Math.max(1, Math.ceil(Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) / STEP));
          for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
            p.copy(a).multiplyScalar(1 - (i + j) / n).addScaledVector(b, i / n).addScaledVector(c, j / n);
            const k = k3(Math.floor(p.x / CELL), Math.floor(p.y / CELL), Math.floor(p.z / CELL));
            for (const T of mag ? [H, HM] : [H]) { let l = T.get(k); if (!l) T.set(k, l = []); l.push(p.x, p.y, p.z); }
          }
        }
      }
      const q = new V3(), A = new V3(), B = new V3(), C = new V3(), e1 = new V3(), e2 = new V3(), h = new V3(), s = new V3(), qv = new V3();
      const DIRS = [[1, 0, 0], [0.0123, 1, 0.0071], [0.0089, 0.0131, 1]].map((d) => new V3(...d).normalize());
      const parity = (mi, P, d) => { // ray P + t d (piece's local frame), number of faces crossed
        const geo = meshes[mi].geometry, pos = geo.attributes.position, idx = geo.index, tri = idx ? idx.count / 3 : pos.count / 3; let n = 0;
        for (let t = 0; t < tri; t++) {
          A.fromBufferAttribute(pos, idx ? idx.getX(t * 3) : t * 3); B.fromBufferAttribute(pos, idx ? idx.getX(t * 3 + 1) : t * 3 + 1); C.fromBufferAttribute(pos, idx ? idx.getX(t * 3 + 2) : t * 3 + 2);
          e1.subVectors(B, A); e2.subVectors(C, A); h.crossVectors(d, e2);
          const det = e1.dot(h); if (Math.abs(det) < 1e-14) continue;
          const f = 1 / det; s.subVectors(P, A); const u = f * s.dot(h); if (u < 0 || u > 1) continue;
          qv.crossVectors(s, e1); const v = f * d.dot(qv); if (v < 0 || u + v > 1) continue;
          if (f * e2.dot(qv) > 1e-9) n++;
        }
        return n & 1;
      };
      const ld = new V3();
      const insideOne = (mi, P) => {
        q.copy(P).applyMatrix4(inv[mi]); let votes = 0;
        for (const d of DIRS) { ld.copy(d).transformDirection(inv[mi]); votes += parity(mi, q, ld); if (votes >= 2) return true; }
        return false;
      };
      const inside = (P) => { for (let i = 0; i < meshes.length; i++) if (boxes[i].containsPoint(P) && insideOne(i, P)) return true; return false; };
      const near = (P, R = 0.04, H0 = H) => { // distance to the nearest surface (R at most)
        let best = R * R; const r = Math.ceil(R / CELL), cx = Math.floor(P.x / CELL), cy = Math.floor(P.y / CELL), cz = Math.floor(P.z / CELL);
        for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
          const l = H0.get(k3(cx + dx, cy + dy, cz + dz)); if (!l) continue;
          for (let i = 0; i < l.length; i += 3) { const ex = l[i] - P.x, ey = l[i + 1] - P.y, ez = l[i + 2] - P.z, d = ex * ex + ey * ey + ez * ez; if (d < best) best = d; }
        }
        return Math.sqrt(best);
      };
      return { info, inside, near, mag: HM.size > 0, magNear: (P) => near(P, 0.06, HM) };
    };
    /* vertices { p (weapon frame), part, f (finger 0 to 4 or -1), tip, palmar, center }: statistics */
    window.__stats = (G, verts) => {
      const out = { handPalm: { n: 0, in: 0, max: 0 }, handFingers: { n: 0, in: 0, max: 0 }, thumb: { n: 0, in: 0, max: 0 } }, palm = [], cen = [], tips = [1e9, 1e9, 1e9, 1e9, 1e9];
      let magD = 1e9;
      for (const v of verts) {
        const o = out[v.part]; o.n++;
        const d = G.near(v.p), isIn = d < 0.035 && G.inside(v.p), sd = isIn ? -d : d;
        if (isIn) { o.in++; o.max = Math.max(o.max, d); }
        if (v.palmar) { palm.push(sd); if (v.center) cen.push(sd); }
        if (v.tip) tips[v.f] = Math.min(tips[v.f], sd);
        if (G.mag && magD > 0) magD = Math.min(magD, G.magNear(v.p));
      }
      const med = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
      const mm = (x) => (x == null || x >= 1e8 ? null : +(x * 1000).toFixed(1));
      for (const k in out) { out[k].pct = out[k].n ? Math.round(100 * out[k].in / out[k].n) : 0; out[k].max = mm(out[k].max); }
      // contact: the underside-of-the-palm vertex nearest to the weapon (on a round handguard, the palm only touches along a line)
      Object.assign(out, { contact: mm(palm.length ? Math.min(...palm) : null), centre: mm(med(cen)), tips: tips.map(mm), magazine: mm(G.mag ? magD : null) });
      return out;
    };
    const PALM_COL = (col, i) => Math.abs(col.getX(i) - 0.58) < 0.03 && Math.abs(col.getZ(i) - 0.55) < 0.03; // tint of the glove palm
    const centerOf = (lh) => Math.abs(lh.x) < 0.02 && lh.z > -0.03 && lh.z < 0.02;
    /* first person: weapon equipped as in a match, left hand deformed */
    window.__fp = (id, att, ads) => {
      const def = weaponDef(id, att, null); vmEquip(def); VM.holder.visible = true; VM.lower = 0; VM.lowerTarget = 0; VM.action = null;
      const S = { ads, sprint: false, speed: 0, grounded: true, crouch: false, empty: false, lat: 0, fwd: 0, fire: false, wall: 0, slide: 0 };
      camera.position.set(0, 1.6, 0); camera.rotation.set(0, 0, 0); vmCamera.position.set(0, 0, 0); vmCamera.rotation.set(0, 0, 0); vmCamera.up.set(0, 1, 0);
      for (let i = 0; i < 90; i++) updateViewmodel(1 / 30, S);
      VM.root.updateMatrixWorld(true);
      const hand = VM.arms.L.hand, mesh = hand.userData.mesh, gi = new THREE.Matrix4().copy(VM.cur.group.matrixWorld).invert(), hi = new THREE.Matrix4().copy(hand.matrixWorld).invert();
      const geo = mesh.geometry, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, col = geo.attributes.color, n = geo.attributes.position.count, verts = [], v = new V3();
      for (let i = 0; i < n; i++) {
        let bi = 0, bw = -1; for (let j = 0; j < 4; j++) if (sw.array[i * 4 + j] > bw) { bw = sw.array[i * 4 + j]; bi = si.array[i * 4 + j]; }
        v.fromBufferAttribute(geo.attributes.position, i); mesh.boneTransform(i, v); mesh.localToWorld(v);
        const lh = v.clone().applyMatrix4(hi), palmar = PALM_COL(col, i), f = bi === 0 ? -1 : bi >= 13 ? 4 : Math.floor((bi - 1) / 3);
        const under = f < 0 && lh.y < -0.004; // underside of the palm (the one palmLift places)
        verts.push({ p: v.clone().applyMatrix4(gi), part: f < 0 ? 'handPalm' : f === 4 ? 'thumb' : 'handFingers', f, tip: bi === 15 || (bi > 0 && bi < 13 && bi % 3 === 0), palmar: under, center: palmar && f < 0 && centerOf(lh) });
      }
      const r = __stats(__gun(def.key), verts);
      r.handY = +(-lHandFrame(VM.cur).off.y).toFixed(4); r.lFrame = VM.cur.lFrame || 'L'; r.turn = +(VM.arms.L.jt.turn || 0).toFixed(2); r.r = +(VM.arms.L.jt.r || 0).toFixed(2);
      return r;
    };
    /* soldier: showcase pose (poseSoldier frozen) at aim, bones placed by layoutSoldier, left hand baked */
    const TPH = {};
    // vertices of the left hand of the detailed model (hand frame) and parts from the baked hand; grip: the shape that holds a
    // support grip (bone SB.HLG) or the one that holds a handguard (SB.HLS); older versions only have SB.HAL
    const tpBone = (grip) => (SB.HLS === undefined ? SB.HAL : grip ? SB.HLG : SB.HLS);
    const tpHand = (grip) => {
      if (TPH[grip]) return TPH[grip];
      const bone = tpBone(grip), geo = soldierGeometry(SKIN_IDS[0], 'hi'), R = soldierRest(), ri = new THREE.Matrix4().copy(R.mats[SB.HAL]).invert();
      const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, pos = geo.attributes.position;
      const Hb = handBones(1), hg = handGeometry(1, Hb.u, Hb.h, 'lo'), hsi = hg.attributes.skinIndex, hsw = hg.attributes.skinWeight;
      const pose = typeof SOLDIER_LPOSE === 'undefined' ? 'cclamp' : grip ? SOLDIER_LGRIP : SOLDIER_LPOSE;
      const hb = handBaked(1, pose, 'lo'), nb = hb.p.length / 3, bp = new V3();
      const out = [], v = new V3();
      for (let i = 0; i < pos.count; i++) {
        if (si.array[i * 4] !== bone || sw.array[i * 4] < 0.999) continue;
        v.fromBufferAttribute(pos, i).applyMatrix4(ri);
        if (v.z > 0.075) continue; // cuff
        let best = 1e9, bk = 0; for (let k = 0; k < nb; k++) { const d = bp.fromArray(hb.p, k * 3).distanceToSquared(v); if (d < best) { best = d; bk = k; } }
        let bi = 0, bw = -1; for (let j = 0; j < 4; j++) if (hsw.array[bk * 4 + j] > bw) { bw = hsw.array[bk * 4 + j]; bi = hsi.array[bk * 4 + j]; }
        const f = best > 1e-8 ? -2 : bi === 0 ? -1 : bi >= 13 ? 4 : Math.floor((bi - 1) / 3);
        if (f === -2) continue; // not a hand vertex
        const palmar = f < 0 && Math.abs(hb.c[bk * 3] - 0.58) < 0.03 && Math.abs(hb.c[bk * 3 + 2] - 0.55) < 0.03; // tint of the baked hand's palm
        out.push({ f, part: f < 0 ? 'handPalm' : f === 4 ? 'thumb' : 'handFingers', tip: bi === 15 || (bi > 0 && bi < 13 && bi % 3 === 0), palmar: f < 0 && v.y < -0.004, center: palmar && centerOf(v), bind: v.clone() });
      }
      return (TPH[grip] = out);
    };
    window.__tp = (key, aim) => {
      SK_POSE.aim = aim; SKV.pose = null; const P = skinPvPose(key);
      const R = soldierRest(), bones = []; for (let i = 0; i < SOLDIER_NB; i++) { const b = new THREE.Object3D(); b.position.setFromMatrixPosition(R.mats[i]); b.quaternion.copy(R.q[i]); bones.push(b); }
      const S = { bones, J: P.J.map((x) => x.clone()), lastN: R.lastN.map((x) => x.clone()), fp: P.fp.slice(), fy: P.fy.slice(), sink: 0, gun: P.gun, grips: P.grips, kind: P.kind, headQ: P.headQ };
      layoutSoldier(S, true);
      const held = !!_lo.hq[0], grip = !!(P.grips.LF && P.grips.LF.pose === 'fgrip');
      const hb = bones[tpBone(grip)], gi = new THREE.Matrix4().compose(P.gun.position, P.gun.quaternion, new V3(1, 1, 1)).invert();
      const hm = new THREE.Matrix4().compose(hb.position, hb.quaternion, new V3(1, 1, 1));
      const verts = tpHand(grip).map((x) => ({ ...x, p: x.bind.clone().applyMatrix4(hm).applyMatrix4(gi) }));
      const r = __stats(__gun(key), verts);
      const sh = P.J[J_SHL], el = P.J[J_ELL], w = P.J[J_HAL];
      // hand pivot on its grip (armToGrip): difference between the hand's orientation and that of the grip frame
      const qf = P.gun.quaternion.clone().multiply(P.grips.LF.q);
      r.pivot = Math.round(2 * Math.acos(Math.min(1, Math.abs(qf.dot(bones[SB.HAL].quaternion)))) * 180 / Math.PI);
      r.held = held; r.elbowJoint = Math.round(180 - new V3().subVectors(sh, el).angleTo(new V3().subVectors(w, el)) * 180 / Math.PI);
      r.reachCm = +(sh.distanceTo(w) * 100).toFixed(1);
      return r;
    };
    /* images: first-person view of the support hand from below and from the left (arms visible) */
    window.__fpView = (dir) => {
      const hp = new V3().setFromMatrixPosition(VM.arms.L.hand.matrixWorld), gq = VM.cur.group.getWorldQuaternion(new THREE.Quaternion());
      const o = { below: [-0.06, -0.3, 0.06], left: [-0.32, -0.03, 0.04] }[dir];
      vmCamera.position.copy(hp).add(new V3(...o).applyQuaternion(gq)); vmCamera.up.set(0, 1, 0).applyQuaternion(gq); vmCamera.lookAt(hp);
      vmCamera.fov = 40; vmCamera.updateProjectionMatrix();
    };
    window.__fpViewEnd = () => { vmCamera.position.set(0, 0, 0); vmCamera.rotation.set(0, 0, 0); vmCamera.up.set(0, 1, 0); vmCamera.fov = 50; vmCamera.updateProjectionMatrix(); };
    /* images: showcase soldier, close-ups of the left hand (showcase rendering, vwDraw) */
    window.__tpImages = (key) => {
      const skin = SKIN_IDS[0], M = skinPvModel(skin), m = skinPvMat(skin);
      SK_POSE.aim = 0.5; SKV.pose = null; M.key = '';
      skinPvPlace(M, key);
      skinTone(skin, 0, m.color); skinRelColor(0, m.userData.skU.tag.value);
      const S = vwScene(); S.scene.add(M.root); M.root.updateMatrixWorld(true);
      const h = new V3().setFromMatrixPosition(M.bones[SB.HAL].matrixWorld), gq = M.gun.quaternion, ax = (x, y, z) => new V3(x, y, z).applyQuaternion(gq);
      const cv = document.createElement('canvas'); cv.width = 640; cv.height = 480; const ctx = cv.getContext('2d'), res = {};
      S.cam.fov = 40; S.cam.aspect = 640 / 480; S.cam.updateProjectionMatrix();
      for (const [n, o] of Object.entries({ left: [-0.5, 0.02, 0.02], below: [-0.03, -0.5, 0.03], forward: [-0.3, -0.25, -0.3] })) {
        S.cam.position.copy(h).add(ax(...o)); S.cam.up.copy(ax(0, 1, 0)); S.cam.lookAt(h);
        vwDraw(ctx, 640, 480, 640, 480); res[n] = cv.toDataURL('image/png');
      }
      S.cam.up.set(0, 1, 0); S.cam.fov = VW_FOV; S.cam.updateProjectionMatrix();
      vwCamPlace(S.cam, SK_POSE.a + Math.PI / 2, 0.06, 1.08 / Math.tan(THREE.MathUtils.degToRad(VW_FOV) / 2), SK_AIM);
      vwDraw(ctx, 640, 480, 640, 480); res.showcase = cv.toDataURL('image/png');
      S.scene.remove(M.root);
      return res;
    };
  });
  if (trial) await page.addScriptTag({ content: fs.readFileSync(trial, 'utf8') });
  const ids = await page.evaluate((w) => (w === 'everything' ? Object.keys(WEAPONS) : w.split(',')), wanted);
  const fails = [], all = [];
  const check = (mode, tag, r) => {
    const T = THRESHOLDS[mode], bad = [];
    for (const k of ['handPalm', 'handFingers', 'thumb']) if (r[k].max > T[k]) bad.push(`${k} ${r[k].max} mm`);
    if (r.contact != null && (r.contact < T.contact[0] || r.contact > T.contact[1])) bad.push(`contact ${r.contact} mm`);
    if (r.magazine != null && r.magazine < T.magazine) bad.push(`magazine ${r.magazine} mm`);
    if (mode === 'tp' && !r.held) bad.push('hand released');
    if (bad.length) fails.push(`${tag}: ${bad.join(', ')}`);
    return bad.length ? '  <-- ' + bad.join(', ') : '';
  };
  const fmt = (r) => `palm ${r.handPalm.pct}% ${r.handPalm.max} | fingers ${r.handFingers.pct}% ${r.handFingers.max} | thumb ${r.thumb.pct}% ${r.thumb.max} | contact ${r.contact} centre ${r.centre} | tips ${r.tips.join(' ')} | magazine ${r.magazine}`;
  for (const id of ids) {
    const pistol = await page.evaluate((id) => WEAPONS[id].type === 'pistol' || gunFam(weaponDef(id, [], null).key) === 'pistol', id);
    const atts = await page.evaluate(([id, acc]) => [[], ...(acc ? ['vgrip', 'agrip', 'bipod'].filter((a) => attFits(WEAPONS[id], a)).map((a) => [a]) : [])], [id, withAcc]);
    for (const att of atts) {
      const tag = id + (att.length ? '+' + att[0] : ''), key = await page.evaluate(([id, att]) => weaponDef(id, att, null).key, [id, att]);
      if (modes.includes('fp')) for (const ads of [false, true]) {
        const r = await page.evaluate(([id, att, ads]) => __fp(id, att, ads), [id, att, ads]);
        const t = `FP ${ads ? 'aim ' : 'hip'} ${tag}`;
        console.log(`${t.padEnd(26)} ${r.lFrame.padEnd(3)} handY ${r.handY} | ${fmt(r)} | wrist ${r.r}${pistol ? '' : check('fp', t, r)}`);
        all.push({ sightline: 'fp', ads, tag, ...r });
        if (imgDir && !ads) for (const v of ['below', 'left']) {
          await page.evaluate((v) => __fpView(v), v); await page.waitForTimeout(200);
          await page.screenshot({ path: path.join(imgDir, `fp-${tag}-${v}.png`) });
          await page.evaluate(() => __fpViewEnd());
        }
      }
      if (modes.includes('tp')) {
        for (const aim of [0.5, 1]) {
          const r = await page.evaluate(([key, aim]) => __tp(key, aim), [key, aim]);
          const t = `TP aim ${aim} ${tag}`;
          console.log(`${t.padEnd(26)} ${r.held ? 'placed ' : 'RELEASED'} pivot ${r.pivot}° elbow ${r.elbowJoint}° reach ${r.reachCm} cm | ${fmt(r)}${pistol ? '' : check('tp', t, r)}`);
          all.push({ sightline: 'tp', aim, tag, ...r });
        }
        if (imgDir) {
          const imgs = await page.evaluate((key) => __tpImages(key), key);
          for (const [n, u] of Object.entries(imgs)) fs.writeFileSync(path.join(imgDir, `tp-${tag}-${n}.png`), Buffer.from(u.split(',')[1], 'base64'));
        }
      }
    }
  }
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(all, null, 1));
  const bad = logs.filter((l) => !l.includes('HDRI'));
  if (bad.length) console.log(bad.slice(0, 10).join('\n'));
  console.log(fails.length ? `\n${fails.length} overrun(s):\n` + fails.join('\n') : '\nok: no threshold exceeded');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
