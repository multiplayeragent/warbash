/* Baking of the animation clips (Mixamo pack in /anim-source/, outside the repo) into compact data for the game.
   node tools/dev/anim/bake.mjs  ->  assets/anim/clips.bin (Int16) and assets/anim/clips.json (index), embedded in the page by build.py
   (src/06ab-anim.js reads them). Replayable at will, and to redo if the soldier's SD measurements change (the scale depends on them, lib.mjs).
   Motion removed, loops seamed, phases aligned: lib.mjs, bakeClip. One frame: 31 Int16 values (order and scales: LAYOUT). */
import fs from 'node:fs';
import path from 'node:path';
import { THREE, REPO, FPS, bakeClip, manifest } from './lib.mjs';

const STRIDE = 31, QP = 1e4, QQ = 32767;
const LAYOUT = 'pelvis xyz (/1e4 m), pelvis qxyzw (/32767), torso qxyzw, head qxyzw, left ankle xyz (/1e4), right ankle xyz, tilt l r (/1e4 rad), yaw l r (/1e4 rad), left knee xyz (/1e4, pelvis frame), right knee xyz';
const out = [], index = [];
let total = 0;
for (const c of manifest().clips) {
  const b = await bakeClip(c), { N, Q } = b;
  const a = new Int16Array(N * STRIDE), r = (x, s) => Math.max(-32767, Math.min(32767, Math.round(x * s)));
  Q.forEach((q, i) => a.set([q.pel.x, q.pel.y, q.pel.z].map((x) => r(x, QP))
    .concat([q.qP, q.qT, q.qH].flatMap((z) => [z.x, z.y, z.z, z.w].map((x) => r(x, QQ))))
    .concat([...q.feet[0].toArray(), ...q.feet[1].toArray()].map((x) => r(x, QP)))
    .concat([q.pitch[0], q.pitch[1], q.yaw[0], q.yaw[1]].map((x) => r(x, QP)))
    .concat([...q.knee[0].toArray(), ...q.knee[1].toArray()].map((x) => r(x, QP))), i * STRIDE));
  const hy = Q.map((q) => q.head.y);
  // mean torso yaw (rad, positive to the left): the game replaces the one the clip holds with its own (aiming profile)
  const tf = Q.reduce((s, q) => s.add(new THREE.Vector3(0, 0, -1).applyQuaternion(q.qT)), new THREE.Vector3()), ty = Math.atan2(-tf.x, -tf.z);
  index.push({ id: b.id, n: N, o: total, loop: b.loop, dur: +b.dur.toFixed(4), v: +b.spd.toFixed(3), dir: b.dir, cyc: +(b.spd * b.dur).toFixed(3), k: +b.k.toFixed(4),
    ph: b.ph, ty: +ty.toFixed(4), head: [+Math.min(...hy).toFixed(3), +Math.max(...hy).toFixed(3)] });
  out.push(a); total += N;
  const md = c.direction_deg, bad = md !== null && md !== undefined && b.dir !== null && Math.abs(((b.dir - md + 540) % 360) - 180) > 5;
  console.log(b.id.padEnd(36), String(N).padStart(4), 'frames', b.loop ? 'loop    ' : 'once    ', 'v', b.spd.toFixed(2), 'dir', String(b.dir).padStart(4), bad ? `(manifest ${md}!)` : '',
    'phase', String(b.ph).padStart(2), 'seamAngle', b.seam.toFixed(1) + '°', 'head', Math.min(...hy).toFixed(2) + '-' + Math.max(...hy).toFixed(2));
}
const bin = new Int16Array(total * STRIDE); let o = 0; for (const a of out) { bin.set(a, o); o += a.length; }
const dir = path.join(REPO, 'assets/anim'); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'clips.bin'), Buffer.from(bin.buffer));
fs.writeFileSync(path.join(dir, 'clips.json'), JSON.stringify({ fps: FPS, stride: STRIDE, layout: LAYOUT, clips: index }, null, 1) + '\n');
console.log(`${index.length} clips, ${total} frames, ${(bin.byteLength / 1024).toFixed(1)} KB`);
