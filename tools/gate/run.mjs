// The War Bash test gate: npm test  (or node tools/gate/run.mjs [--gpu=dgpu|igpu|any] [--no-mp] [--no-perf])
//   1 build      python3 build.py, including its own checks (syntax, i18n, text style, secret guard on dist/)
//   2 secrets    no secret key in any tracked file nor in dist/
//   3 menus      boot to the main menu, every main screen, identity and no networking tech names (software rendering)
//   4 match      a bot match on the GPU: clock, bots, player, end of match
//   5 mp         a host and two guests in a private room, then quick play (needs network and a key in mp.config.local.js)
//   6 perf       30 s frame pacing on the GPU: at most 2 frame gaps of 50 ms or more and 2 long animation frames
// Exit code 0 only if every step that ran passed. Steps 4 and 6 open a browser window: leave it in front.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib.mjs';

const arg = (k) => process.argv.find((a) => a.startsWith('--' + k));
const GPU = (arg('gpu') || '').split('=')[1] || process.env.GPU || 'any';
const PY = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const run = (cmd, args, env = {}) => new Promise((ok) => {
  const p = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; p.stdout.on('data', (d) => { out += d; process.stdout.write(d); }); p.stderr.on('data', (d) => { out += d; process.stdout.write(d); });
  p.on('close', (code) => ok({ code, out }));
});
const steps = [];
const step = async (name, fn) => {
  console.log(`\n=== ${name} ===`); const t0 = Date.now();
  let r; try { r = await fn(); } catch (e) { r = { ok: false, note: e.message }; }
  steps.push({ name, ...r, s: ((Date.now() - t0) / 1000).toFixed(0) });
};

await step('build', async () => { const r = await run(PY, ['build.py']); return { ok: r.code === 0 && /secrets guard: dist\/ clean/.test(r.out) }; });
await step('secrets', async () => {
  const a = await run('node', ['tools/check_secrets.mjs']), b = await run('node', ['tools/check_secrets.mjs', 'dist']);
  return { ok: a.code === 0 && b.code === 0 };
});
await step('menus', async () => ({ ok: (await run('node', ['tools/gate/menus.mjs'], { GPU: 'soft' })).code === 0 }));
await step('match', async () => ({ ok: (await run('node', ['tools/gate/match.mjs', '25'], { GPU })).code === 0 }));
const key = existsSync(join(ROOT, 'mp.config.local.js')) && /pk_(live|test)_[A-Za-z0-9]{16,}/.test(readFileSync(join(ROOT, 'mp.config.local.js'), 'utf8'));
if (arg('no-mp')) steps.push({ name: 'mp', skip: 'skipped (--no-mp)' });
else if (!key) steps.push({ name: 'mp', skip: 'skipped (no key in mp.config.local.js)' });
else await step('mp', async () => ({ ok: (await run('node', ['tools/gate/mp.mjs', '2'])).code === 0 }));
if (arg('no-perf')) steps.push({ name: 'perf', skip: 'skipped (--no-perf)' });
else await step('perf', async () => {
  const r = await run('node', ['tools/gate/pacing.mjs', GPU, '30', 'gate']);
  const line = r.out.trim().split(/\r?\n/).reverse().find((l) => l.startsWith('{'));
  if (!line) return { ok: false, note: 'no pacing result' };
  const p = JSON.parse(line);
  const note = `${p.target} ${p.adapter || ''}: ${p.fps} fps, held 1/2/3+ ${p.held['1']}/${p.held['2']}/${p.held['3+']} %, main p50/p99 ${p.mainMs.p50}/${p.mainMs.p99} ms, gaps>=50ms ${p.gaps50}, LoAF ${p.loaf50}${p.throttled ? ', THROTTLED (window covered?)' : ''}`;
  return { ok: !p.throttled && p.gaps50 <= 2 && p.loaf50 <= 2, note };
});

console.log('\n=== summary ===');
for (const s of steps) console.log(`${s.skip ? 'SKIP' : s.ok ? 'PASS' : 'FAIL'} ${s.name.padEnd(8)} ${s.skip || ''}${s.s ? s.s + ' s' : ''}${s.note ? '  ' + s.note : ''}`);
process.exit(steps.some((s) => !s.skip && !s.ok) ? 1 : 0);
