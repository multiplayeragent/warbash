#!/usr/bin/env node
// Generates the War Bash artwork with the Codex CLI image tool (the ChatGPT image model).
//   node tools/art/gen.mjs [id ...]        only the listed images (default: every image not generated yet)
//   FORCE=1 node tools/art/gen.mjs logo    regenerate even if _art/raw/logo.png exists
// Prompts live in tools/art/prompts.json. Raw images land in _art/raw/<id>.png (gitignored); tools/art/process.py
// turns them into the files the game ships (assets/...). Needs Codex installed and signed in: CODEX_BIN, or `codex` on PATH.
// JOBS sets how many images are generated at once (default 3).
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CODEX = process.env.CODEX_BIN || 'codex';
const { style, items } = JSON.parse(readFileSync(join(ROOT, 'tools', 'art', 'prompts.json'), 'utf8'));
const RAW = join(ROOT, '_art', 'raw'), RUNS = join(ROOT, '_art', 'runs');
mkdirSync(RAW, { recursive: true });
const want = process.argv.slice(2);
const todo = items.filter((a) => (want.length ? want.includes(a.id) : true) && (process.env.FORCE || !existsSync(join(RAW, a.id + '.png'))));

function promptFor(a) {
  const ground = a.opaque ? 'Fill the whole canvas edge to edge.' : 'The PNG must have a fully transparent background with real alpha: nothing drawn outside the subject.';
  const text = a.text ? `The only text in the image is exactly: ${a.text}. Spell it exactly like that.` : 'No text, letters or numbers anywhere.';
  return 'Generate ONE actual PNG with the built-in image_gen tool. No other agents, no code, no file edits, exactly one image. '
    + `${a.prompt} Style: ${a.style || style}. ${ground} Canvas ${a.size}. ${text} Original artwork only: no real logos, no trademarks, `
    + 'no existing game characters or insignia from existing games. Return the real generated file path. '
    + 'If image generation is unavailable return an empty path and explain.';
}

const result = (work) => { try { const r = JSON.parse(readFileSync(join(work, 'result.json'), 'utf8')); return r.path && existsSync(r.path) ? r : null; } catch { return null; } };
function run(a) {
  return new Promise((done) => {
    const work = join(RUNS, a.id);
    const prev = !process.env.FORCE && result(work); // an earlier run that wrote its result but never exited: keep its image
    if (prev) { copyFileSync(prev.path, join(RAW, a.id + '.png')); console.log(`ok   ${a.id} (earlier run)`); done(); return; }
    rmSync(work, { recursive: true, force: true }); mkdirSync(work, { recursive: true });
    writeFileSync(join(work, 'schema.json'), JSON.stringify({ type: 'object', additionalProperties: false,
      properties: { path: { type: 'string' }, note: { type: 'string' } }, required: ['path', 'note'] }));
    const prompt = promptFor(a); writeFileSync(join(work, 'prompt.txt'), prompt);
    const args = ['exec', '--skip-git-repo-check', '--ephemeral', '--sandbox', 'workspace-write', '--json',
      '--output-schema', join(work, 'schema.json'), '-o', join(work, 'result.json'), '-c', 'model_reasoning_effort="low"', '--disable', 'multi_agent'];
    for (const img of a.images || []) args.push('--image', resolve(ROOT, img));
    args.push('-');
    const t0 = Date.now(), p = spawn(CODEX, args, { cwd: work, windowsHide: true });
    let log = ''; p.stdout.on('data', (d) => (log += d)); p.stderr.on('data', (d) => (log += d));
    p.stdin.end(prompt);
    // Codex sometimes writes its result and then never exits: the result file is the signal, the process is stopped once it is there
    let ended = false;
    const finish = (code) => {
      if (ended) return; ended = true; clearTimeout(kill); clearInterval(watch); writeFileSync(join(work, 'codex.log'), log);
      const r = result(work), s = ((Date.now() - t0) / 1000) | 0;
      if (r) { copyFileSync(r.path, join(RAW, a.id + '.png')); console.log(`ok   ${a.id} (${s}s)`); }
      else { let note = 'no result'; try { note = JSON.parse(readFileSync(join(work, 'result.json'), 'utf8')).note; } catch {} console.log(`FAIL ${a.id} (${s}s, exit ${code}): ${note}`); }
      try { p.kill(); } catch {}
      done();
    };
    const kill = setTimeout(() => finish('timeout'), 15 * 60 * 1000);
    const watch = setInterval(() => { if (result(work)) setTimeout(() => finish('result'), 1500); }, 2000);
    p.on('close', (code) => finish(code));
  });
}

const jobs = Math.max(1, +process.env.JOBS || 3);
console.log(`generating ${todo.length} image(s), ${jobs} at a time`);
const queue = todo.slice();
await Promise.all(Array.from({ length: jobs }, async () => { while (queue.length) await run(queue.shift()); }));
console.log('ALLDONE');
