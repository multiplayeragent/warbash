"""Reports duplicate top-level declarations (const, let, class, function) in src/: all the
modules are concatenated into a single script, a second declaration would break loading or replace another one.
api/_lib/textFilter.js is joined too (build.py puts it in the game, without its "export")."""
import re, glob, collections, sys
names = collections.defaultdict(list)
for f in sorted(glob.glob('src/*.js')) + ['api/_lib/textFilter.js']:
    for i, l in enumerate(open(f, encoding='utf-8')):
        l = re.sub(r'^export ', '', l)
        m = re.match(r'^(?:const|let|var)\s+(.*)', l)
        if m:
            depth, cur, parts = 0, '', []
            for ch in m.group(1):
                if ch in '([{': depth += 1
                elif ch in ')]}': depth -= 1
                if ch == ',' and depth == 0: parts.append(cur); cur = ''
                else: cur += ch
            parts.append(cur)
            for p in parts:
                mm = re.match(r'\s*([A-Za-z_$][\w$]*)\s*(=|$|;)', p)
                if mm: names[mm.group(1)].append(f'{f}:{i + 1}')
        m = re.match(r'^(?:async\s+)?(?:function|class)\s+([\w$]+)', l)
        if m: names[m.group(1)].append(f'{f}:{i + 1}')
dup = {k: v for k, v in names.items() if len(v) > 1}
for k, v in dup.items(): print('duplicate:', k, v)
sys.exit(1 if dup else 0)
