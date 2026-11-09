"""List of the game's assets (docs/assets.md), produced from the code: scenery prefabs, physics props, photo and
procedural surfaces, atlases drawn at load, skies, HDRIs, weapons, attachments. The whole game is built by code (README,
"Art direction: everything in code"); only the photo textures, skies and HDRIs come from files (CC0).
build.py regenerates it on every build: it follows the code without anyone thinking about it. An asset's description is the comment
written just above its definition (its first sentence); the section headers "/* ---------- Title ---------- */"
group the prefabs of a file.
python3 tools/dev/assets.py: writes docs/assets.md; --check: error code if the file is not up to date."""
import glob, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'docs', 'assets.md')


def read_in(f):
    return open(os.path.join(ROOT, f), encoding='utf-8').read().split('\n')


def table_cell(s):
    return s.replace('|', '\\|').replace('\n', ' ').strip()


def phrase(txt, n=200):
    """First sentence of a comment, shortened at a word boundary"""
    t = re.sub(r'\s+', ' ', txt).strip()
    m = re.search(r'(?<=[a-zé\)\]0-9])\. ', t)
    if m and m.start() < n: t = t[:m.start() + 1]
    if len(t) > n: t = t[:n].rsplit(' ', 1)[0] + '...'
    return t


def comment_of(L, i):
    """Comment just above line i (/* */ block or // lines), without the section headers"""
    j = i - 1
    if j < 0: return ''
    if L[j].strip().startswith('//'):
        out = []
        while j >= 0 and L[j].strip().startswith('//'): out.insert(0, L[j].strip()[2:].strip()); j -= 1
        return ' '.join(out)
    if L[j].rstrip().endswith('*/'):
        out = []
        while j >= 0:
            out.insert(0, L[j]);
            if '/*' in L[j]: break
            j -= 1
        txt = ' '.join(re.sub(r'^\s*(/\*+|\*)?', '', l).replace('*/', '').strip() for l in out)
        if re.match(r'^-{3,}.*-{3,}$', txt.strip()) or txt.strip().startswith('='): return ''
        return txt.strip()
    return ''


def section(line_no):
    m = re.match(r'^/\* -{3,} (.+?) -{3,} \*/', line_no.strip())
    return m.group(1) if m else None


SRC = sorted(glob.glob(os.path.join(ROOT, 'src', '*.js')))
TXT = {os.path.basename(f): read_in(os.path.relpath(f, ROOT)) for f in SRC}

# maps: definition file, name, photo surfaces, sky
NAMES = dict(re.findall(r"\{ id: '([a-z]+)', name: '([^']+)'", '\n'.join(TXT['02-map.js'])))
MAP_LIST = {}
for f, L in TXT.items():
    for i, l in enumerate(L):
        m = re.match(r'^MAP_DEFS\.([a-z]+) = ', l)
        if not m: continue
        cid = m.group(1); bloc = '\n'.join(L[i:i + 120])
        tex = re.search(r"^\s+textures: \[([^\]]*)\]", bloc, re.M)
        sky = re.search(r"skyPhoto: \{ key: '([^']+)'", bloc)
        MAP_LIST[cid] = {'naming': NAMES.get(cid, cid), 'filepath': f, 'tex': re.findall(r"'([^']+)'", tex.group(1)) if tex else [], 'sky': sky.group(1) if sky else ''}
FILE_TO_MAP = {c['filepath']: c['naming'] for c in MAP_LIST.values()}

# prefabs
PREFABS = []
for f, L in TXT.items():
    sec = None
    for i, l in enumerate(L):
        s = section(l)
        if s: sec = s
        m = re.match(r'^PF\.(\w+)\s*=\s*(?:\(((?:[^()]|\([^()]*\))*)\)|(\w+))\s*=>', l)  # one level of parentheses in the parameters: (lit = litOn())
        if m: PREFABS.append({'naming': m.group(1), 'args': (m.group(2) if m.group(2) is not None else m.group(3) or '').strip(), 'filepath': f, 'section': sec, 'desc': phrase(comment_of(L, i)), 'line_no': i + 1})
invocations = {}
for f, L in TXT.items():
    for i, l in enumerate(L):
        for n in re.findall(r'\bPF\.(\w+)\(', l):
            if re.match(r'^PF\.' + n + r'\s*=', l): continue
            invocations.setdefault(n, set()).add(f)


def poses(n):
    fs = sorted(invocations.get(n, ()))
    lab = [f"{f[:-3]} ({FILE_TO_MAP[f]})" if f in FILE_TO_MAP else f[:-3] for f in fs]
    return ', '.join(lab[:6]) + (f', and {len(lab) - 6} others' if len(lab) > 6 else '')


# the same name defined twice: the files are concatenated, the last definition replaces the other everywhere
DUPLICATES = {}
for p in PREFABS: DUPLICATES.setdefault(p['naming'], []).append(f"src/{p['filepath']}:{p['line_no']}")
DUPLICATES = {k: v for k, v in DUPLICATES.items() if len(v) > 1}

# physics props
PROPS = []
for f, L in TXT.items():
    for i, l in enumerate(L):
        m = re.match(r"^propType\('(\w+)', \{(.*)", l)
        if not m: continue
        pf = re.search(r'pf: \(\) => PF\.(\w+)\(', l); heft = re.search(r'mass: ([\d.]+)', l); mat = re.search(r"snd: '(\w+)'", l)
        PROPS.append({'type': m.group(1), 'pf': pf.group(1) if pf else '', 'heft': heft.group(1) if heft else '', 'sound': mat.group(1) if mat else '', 'desc': phrase(comment_of(L, i), 140), 'filepath': f})

# procedural surfaces (generated on the GPU at load) and drawn atlases
PROC = []
for f, L in TXT.items():
    for i, l in enumerate(L):
        m = re.match(r'^  (\w+): \[(\d+), (\d+), ([\d.]+), `', l)
        if m: PROC.append({'key': m.group(1), 'size': m.group(2), 'desc': phrase(comment_of(L, i), 160), 'filepath': f})
ATLAS = []
for f, L in TXT.items():
    for i, l in enumerate(L):
        m = re.match(r'^function (\w+Atlas)\(', l)
        if m: ATLAS.append({'naming': m.group(1), 'desc': phrase(comment_of(L, i), 160), 'filepath': f})

# photo surfaces, skies, HDRI
cred = {c['key']: c for c in json.load(open(os.path.join(ROOT, 'assets', 'tex', 'credits.json'), encoding='utf-8'))}
PHOTO = []
for d in sorted(glob.glob(os.path.join(ROOT, 'assets', 'tex', '*', ''))):
    k = os.path.basename(os.path.normpath(d)); c = cred.get(k, {})
    PHOTO.append({'key': k, 'photo': c.get('asset', ''), 'source': c.get('source', ''), 'licence': c.get('licence', ''), 'mapList': ', '.join(v['naming'] for v in MAP_LIST.values() if k in v['tex'])})
SKIES = sorted({os.path.splitext(os.path.basename(f))[0] for f in glob.glob(os.path.join(ROOT, 'assets', 'sky', '*.webp')) if not f.endswith('_lo.webp')})
HDRI = sorted(os.path.splitext(os.path.basename(f))[0] for f in glob.glob(os.path.join(ROOT, 'assets', 'vendor', 'hdri', '*.exr')))

# weapons and accessories
unescape = lambda s: s.replace('\\u0027', "'").replace("\\'", "'")
WEAPON_LIST = [{'id': m[0], 'naming': m[1], 'type': unescape(m[2])} for m in re.findall(r"^  \w+: \{ id: '(\w+)', name: '([^']+)', type: _t\('((?:[^'\\]|\\.)*)'\)", '\n'.join(TXT['06i-weapons.js']), re.M)]
ACC = [{'id': m[0], 'slot': m[1], 'naming': unescape(m[2])} for m in re.findall(r"^  (\w+): \{ slot: '(\w+)', name: _t\('((?:[^'\\]|\\.)*)'\)", '\n'.join(TXT['06p-attachments.js']), re.M)]

# document
o = ['# Asset list', '',
     'Produced from the code by `python3 tools/dev/assets.py`, which `build.py` runs on every build: do not edit it by hand. '
     'The whole game is built by code (README, "Art direction: everything in code"); only the photo textures, the skies and the HDRIs '
     'come from files, all CC0. An asset\'s description is the comment written above its definition: to change it, '
     'change the comment.', '',
     f'{len(PREFABS)} prefabs, {len(PROPS)} physics props, {len(PHOTO)} photo surfaces, {len(PROC)} procedural surfaces, {len(ATLAS)} atlases drawn '
     f'at load, {len(SKIES)} photographed skies, {len(HDRI)} HDRI, {len(WEAPON_LIST)} weapons, {len(ACC)} attachments.', '']
if DUPLICATES:
    o += ['## To fix', '', 'Prefabs defined twice: the last definition (file order) replaces the other everywhere.', '']
    o += [f"- `PF.{k}`: " + ', '.join(f'`{x}`' for x in v) for k, v in DUPLICATES.items()] + ['']
o += ['## Maps', '', '| Map | Definition | Photo surfaces | Sky |', '| --- | --- | --- | --- |']
for c in MAP_LIST.values(): o.append(f"| {c['naming']} | `src/{c['filepath']}` | {', '.join(c['tex'])} | {c['sky']} |")
o += ['', '## Scenery prefabs', '', 'Built once in local coordinates (placed on y = 0, main face toward +z), stamped by `DECOR.place` '
      '(`src/02a-kit.js`). "Placed in": the files that call it directly.']
for f in TXT:
    ps = [p for p in PREFABS if p['filepath'] == f]
    if not ps: continue
    o += ['', f'### `src/{f}`' + (f' ({FILE_TO_MAP[f]})' if f in FILE_TO_MAP else ''), '']
    sec = object()
    for p in ps:
        if p['section'] != sec:
            sec = p['section']
            if sec: o += [f'**{sec}**', '']
            o += ['| Prefab | Parameters | Description | Placed in |', '| --- | --- | --- | --- |']
        o.append(f"| `{p['naming']}` | {table_cell(p['args'])} | {table_cell(p['desc'])} | {table_cell(poses(p['naming']))} |")
        nxt = ps[ps.index(p) + 1] if ps.index(p) + 1 < len(ps) else None
        if nxt and nxt['section'] != sec: o.append('')
o += ['', '## Physics props', '', 'Objects that fall, roll and shatter (`propType`, README "Physics props").', '',
      '| Type | Prefab | Mass (kg) | Sound | File |', '| --- | --- | --- | --- | --- |']
for p in PROPS: o.append(f"| `{p['type']}` | `{p['pf']}` | {p['heft']} | {p['sound']} | `src/{p['filepath']}` |")
o += ['', '## Photo surfaces', '', 'CC0 photos brought to a common range (`tools/build_assets.py`), one file per surface next to the page, '
      'loaded at the launch of the map that asks for it.', '', '| Surface | Photo | Source | License | Maps |', '| --- | --- | --- | --- | --- |']
for p in PHOTO: o.append(f"| `{p['key']}` | {p['photo']} | {p['source']} | {p['licence']} | {p['mapList']} |")
o += ['', '## Procedural surfaces', '', 'Generated on the GPU at map load (`TEXLAB`); a photo surface of the same name replaces them.', '',
      '| Surface | Size (px) | Description | File |', '| --- | --- | --- | --- |']
for p in PROC: o.append(f"| `{p['key']}` | {p['size']} | {table_cell(p['desc'])} | `src/{p['filepath']}` |")
o += ['', '## Atlases drawn at load', '', '| Atlas | Description | File |', '| --- | --- | --- |']
for p in ATLAS: o.append(f"| `{p['naming']}` | {table_cell(p['desc'])} | `src/{p['filepath']}` |")
o += ['', '## Skies and lighting', '', 'Photographed skies (`assets/sky/`, top half of a Poly Haven panorama, CC0): ' + ', '.join(f'`{c}`' for c in SKIES) + '.', '',
      'Lighting HDRIs (`assets/vendor/hdri/`, Poly Haven, CC0): ' + ', '.join(f'`{h}`' for h in HDRI) + '.']
o += ['', '## Weapons', '', 'Models built by code (`src/06c-models.js`), stats in `src/06i-weapons.js`.', '', '| Weapon | Name | Category |', '| --- | --- | --- |']
for a in WEAPON_LIST: o.append(f"| `{a['id']}` | {a['naming']} | {a['type']} |")
o += ['', '## Attachments', '', '`ATT` catalog (`src/06p-attachments.js`), models built by code.', '', '| Attachment | Name | Slot |', '| --- | --- | --- |']
for a in ACC: o.append(f"| `{a['id']}` | {a['naming']} | {a['slot']} |")
doc = '\n'.join(o) + '\n'

def write_out():
    """Writes docs/assets.md if it changed; returns the summary and the duplicates (build.py displays them)"""
    old = open(OUT, encoding='utf-8').read() if os.path.exists(OUT) else ''
    if old != doc: open(OUT, 'w', encoding='utf-8').write(doc)
    return f'{len(PREFABS)} prefabs, {len(PROPS)} props, {len(PHOTO)} photo surfaces, {len(PROC)} procedural, {len(WEAPON_LIST)} weapons, {len(ACC)} attachments', DUPLICATES


if __name__ == '__main__':
    if '--check' in sys.argv:
        old = open(OUT, encoding='utf-8').read() if os.path.exists(OUT) else ''
        if old != doc: print('docs/assets.md is not up to date: python3 tools/dev/assets.py'); sys.exit(1)
        print('docs/assets.md up to date'); sys.exit(0)
    res, dbl = write_out()
    print('docs/assets.md:', res)
    for k, v in dbl.items(): print(f'prefab defined twice: PF.{k} ({", ".join(v)})')
