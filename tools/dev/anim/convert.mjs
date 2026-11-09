#!/usr/bin/env node
// Mixamo FBX downloads -> the GLB pack and manifest the bake reads (anim-source/, gitignored: Mixamo files are never committed).
//   npm --prefix tools/dev/anim install      once (FBX2glTF converter and three.js 0.147)
//   node tools/dev/anim/convert.mjs           anim-source/fbx/<file>.fbx -> anim-source/<id>.glb + anim-source/manifest.json
//   node tools/dev/anim/bake.mjs             bake -> assets/anim/clips.bin and clips.json (gitignored), then python3 build.py
// The file names to use are in tools/dev/anim/clips.mjs and docs/animations.md. Missing files are listed; the bake needs all 50.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync, rmSync, renameSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLIPS } from './clips.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)), REPO = resolve(HERE, '../../..'), SRC = join(REPO, 'anim-source'), FBX = join(SRC, 'fbx');
const BIN = join(HERE, 'node_modules', 'fbx2gltf', 'bin', process.platform === 'win32' ? 'Windows_NT' : process.platform === 'darwin' ? 'Darwin' : 'Linux', process.platform === 'win32' ? 'FBX2glTF.exe' : 'FBX2glTF');
if (!existsSync(BIN)) { console.error('FBX2glTF missing: run  npm --prefix tools/dev/anim install'); process.exit(1); }
if (!existsSync(FBX)) { mkdirSync(FBX, { recursive: true }); console.error(`Put the Mixamo FBX files in ${FBX} (names: docs/animations.md), then run this again.`); process.exit(1); }
// a file is recognised by its name in docs/animations.md or by the Mixamo animation's own name, in any case, spacing or
// punctuation, with anything in brackets ignored ("Rifle Walk Left (1).fbx" = "rifle-walk-left.fbx")
const norm = (s) => s.toLowerCase().replace(/\.fbx$/, '').replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]/g, '');
const have = new Map(readdirSync(FBX).filter((f) => /\.fbx$/i.test(f)).map((f) => [norm(f), f]));
const missing = [], used = new Set();
for (const c of CLIPS) {
  const key = [norm(c.file), norm(c.mixamo)].find((k) => have.has(k) && !used.has(k));
  if (!key) { missing.push(c); continue; }
  const f = have.get(key); used.add(key);
  const out = join(SRC, c.id + '.glb'), tmp = join(SRC, '.tmp-' + c.file);
  mkdirSync(dirname(out), { recursive: true });
  execFileSync(BIN, ['--binary', '--input', join(FBX, f), '--output', tmp], { stdio: 'pipe' });
  if (existsSync(out)) rmSync(out);
  renameSync(tmp + '.glb', out);
  console.log('ok  ', c.file.padEnd(34), '->', c.id + '.glb');
}
for (const [k, f] of have) if (!used.has(k)) console.log('??  ', f, ': not one of the expected names (docs/animations.md)');
writeFileSync(join(SRC, 'manifest.json'), JSON.stringify({ clips: CLIPS.map((c) => ({ filepath: c.id + '.glb', looping: c.loop, direction_deg: c.dir })) }, null, 1) + '\n');
if (missing.length) {
  console.log(`\n${missing.length} clip(s) still missing:`);
  for (const c of missing) console.log(`  ${c.file}.fbx  <- Mixamo: ${c.mixamo}`);
  process.exit(2);
}
console.log(`\nall ${CLIPS.length} clips converted. Next: node tools/dev/anim/bake.mjs, then python3 build.py`);
