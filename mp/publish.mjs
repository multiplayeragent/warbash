// Publishes the built game (dist/) to its share link on Multiplayer Agent, https://<slug>.play.multiplayeragent.com/
//   WARBASH_BUNDLE=3 python3 build.py && node mp/publish.mjs
// WARBASH_BUNDLE=3 keeps the build under the 100 files a hosted game may have; WARBASH_SITE (build.py) is the address the
// share previews point to. Same keys as deploy.mjs: the studio's secret key (MPA_SECRET_KEY or .mcp.json) and the game's
// publishable key (mp.config.local.js), which must be the one in dist/. Every file goes straight from disk: create_upload,
// one PUT per file, then publish_game, which makes these files the whole hosted game.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';
import { Mcp, secretKey, gameKey } from './deploy.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'), DIST = join(ROOT, 'dist');
const MAX_FILES = 100, MAX_MB = 50;
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });

const sk = secretKey(), pk = gameKey();
if (!sk || !pk) { console.error('missing secret key (MPA_SECRET_KEY or .mcp.json) or game key (mp.config.local.js)'); process.exit(1); }
const SKIP = /\.sh$/; // the host refuses shell scripts: the Steam Deck installer (deck/installer.sh) stays off the share link
const all = walk(DIST).map((p) => ({ abs: p, path: relative(DIST, p).split(sep).join('/'), size: statSync(p).size }));
const files = all.filter((f) => !SKIP.test(f.path));
for (const f of all) if (SKIP.test(f.path)) console.log('skipped (not hostable):', f.path);
const mb = files.reduce((a, f) => a + f.size, 0) / 1048576;
console.log(`dist/: ${files.length} files, ${mb.toFixed(1)} MB`);
if (!files.some((f) => f.path === 'index.html')) { console.error('no dist/index.html: build first'); process.exit(1); }
if (files.length > MAX_FILES || mb > MAX_MB) { console.error(`over the hosting limits (${MAX_FILES} files, ${MAX_MB} MB): build with WARBASH_BUNDLE=3`); process.exit(1); }
if (!readFileSync(join(DIST, 'mp.config.local.js'), 'utf8').includes(pk)) { console.error('dist/mp.config.local.js does not hold this game\'s key: build again'); process.exit(1); }
if (spawnSync(process.execPath, [join(ROOT, 'tools', 'check_secrets.mjs'), 'dist'], { cwd: ROOT, stdio: 'inherit' }).status !== 0) process.exit(1);

const mcp = new Mcp(sk); await mcp.init();
const up = await mcp.call('create_upload', { game: pk, files: files.map(({ path, size }) => ({ path, size })) });
const list = (Array.isArray(up) ? up : Object.values(up || {}).find(Array.isArray)) || [];
const byPath = new Map(list.map((u) => [u.path, u]));
let done = 0;
const put = async (f) => {
  const u = byPath.get(f.path); if (!u || !u.url) throw new Error('no upload address for ' + f.path);
  const r = await fetch(u.url, { method: 'PUT', body: readFileSync(f.abs) });
  if (!r.ok) throw new Error(`PUT ${f.path}: HTTP ${r.status}`);
  if (++done % 20 === 0 || done === files.length) console.log(`  uploaded ${done}/${files.length}`);
};
const queue = [...files];
await Promise.all(Array.from({ length: 6 }, async () => { while (queue.length) await put(queue.shift()); }));
const res = await mcp.call('publish_game', { game: pk, mode: 'replace', files: files.map((f) => ({ path: f.path, uploadId: byPath.get(f.path).uploadId })) });
console.log(typeof res === 'string' ? res : JSON.stringify(res, null, 1));
