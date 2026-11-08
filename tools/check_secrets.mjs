#!/usr/bin/env node
// Secret-key guard. Fails (exit 1) if a live or test secret key appears in the files given,
// or in every tracked file when run with no arguments. Used by the pre-commit and pre-push
// hooks (tools/hooks/) and safe to run by hand: node tools/check_secrets.mjs [paths...]
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// built from parts so this file never matches itself
const KEY = new RegExp('(?<![A-Za-z0-9])sk' + '_(?:live|test)_[A-Za-z0-9]{8,}');
const walk = (p) => (statSync(p).isDirectory() ? readdirSync(p).flatMap((f) => walk(join(p, f))) : [p]);
const args = process.argv.slice(2);
const files = args.length ? args.flatMap(walk) : execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const hits = [];
for (const f of files) {
  let s; try { s = readFileSync(f, 'latin1'); } catch { continue; }
  const m = KEY.exec(s);
  if (m) hits.push(`${f}: ${m[0].split('_').slice(0, 2).join('_')}_… (offset ${m.index})`);
}
if (hits.length) {
  console.error('SECRET KEY FOUND, aborting:\n  ' + hits.join('\n  '));
  process.exit(1);
}
console.log(`check_secrets: ${files.length} files clean`);
