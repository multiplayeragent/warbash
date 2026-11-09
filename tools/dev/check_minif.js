/* Check of the code minification (tools/minif.py, called by build.py): the game script, assembled as build.py does
   (the word filter then src/*.js), must give the same syntax tree before and after minification. Only the positions
   change. Rerun after any change to tools/minif.py, or if a build behaves differently from before.
   node check_minif.js (in tools/dev, after npm install). Output: "identical" or the first difference (code 1). */
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const acorn = require('acorn');
const REPO = path.resolve(__dirname, '../..');

const textFilter = fs.readFileSync(path.join(REPO, 'api/_lib/textFilter.js'), 'utf8').replace(/^export /gm, '');
const files = fs.readdirSync(path.join(REPO, 'src')).filter((f) => f.endsWith('.js')).sort();
const src = textFilter + '\n' + files.map((f) => fs.readFileSync(path.join(REPO, 'src', f), 'utf8')).join('\n');
const min = execFileSync('python3', ['-c', 'import sys;sys.path.insert(0,"tools");import minif;sys.stdout.write(minif.js(sys.stdin.read()))'],
  { cwd: REPO, input: src, encoding: 'utf8', maxBuffer: 1 << 28 });

const parse = (code) => acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true });
const a = parse(src), b = parse(min);
const SKIP = new Set(['start', 'end', 'loc', 'range']);
const where = (n, code) => (n && typeof n.start === 'number' ? JSON.stringify(code.slice(n.start, n.start + 80)) : '');
function same(x, y, trail) {
  if (x === y) return true;
  if (typeof x !== typeof y || x === null || y === null || typeof x !== 'object') {
    console.log('difference at', trail, ':', JSON.stringify(x), 'becomes', JSON.stringify(y)); return false;
  }
  if (Array.isArray(x)) {
    if (!Array.isArray(y) || x.length !== y.length) { console.log('difference at', trail, ': lengths', x.length, y && y.length); return false; }
    for (let i = 0; i < x.length; i++) if (!same(x[i], y[i], trail + '[' + i + ']')) return false;
    return true;
  }
  for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
    if (SKIP.has(k)) continue;
    if (!same(x[k], y[k], trail + '.' + k)) { console.log('  before:', where(x, src), '\n  after: ', where(y, min)); return false; }
  }
  return true;
}
const ok = same(a, b, 'Program');
console.log(ok ? 'identical' : 'DIFFERENT', '(' + src.length + ' characters, ' + min.length + ' once minified)');
process.exit(ok ? 0 : 1);
