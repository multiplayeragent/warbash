#!/usr/bin/env python3
"""English check: python3 tools/dev/check_english.py
The code, its comments, the tools and the docs are in English. This flags French left in comments, string literals and
Markdown/HTML text. Exempt: in-world text of the maps (string literals of the map files src/02*.js: signs, posters, place
names, drawn in the language of the country the map is set in) and the place names listed in tools/dev/english_allow.txt.
Exit 0 if clean, 1 otherwise. build.py calls it too."""
import io, os, re, subprocess, sys, tokenize
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import i18n_keys as K

# words that only French uses (lowercase, whole words); two of them in one text, or one in a text of four words or fewer, flag it
FR_WORDS = set('''de du des le les une et est sont pour avec dans sur pas qui que sans mais ou où ne se ses leur leurs aux au ce cette ces
il elle ils elles nous vous être fait faire tout tous toute toutes comme très moins chaque entre chez sous après avant déjà encore aussi
donc puis ici voir selon dont lorsque parce quand alors sinon cela ceci celui celle ceux même peut doit sera était avoir sont fois'''.split())
# accented words that English uses too
EN_ACCENTED = {'café', 'cafés', 'façade', 'façades', 'naïve', 'résumé', 'cliché', 'protégé', 'fiancé', 'entrée', 'rosé', 'crème', 'déjà', 'vu',
               'piñata', 'jalapeño', 'über', 'señor', 'touché', 'décor', 'éclair', 'pâté', 'soirée', 'blasé', 'naïveté'}
ACCENT = re.compile(r"[éèêàùçôîûœëïâ]")
ALLOW_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'english_allow.txt')
ALLOW = sorted({l.strip() for l in open(ALLOW_FILE, encoding='utf-8') if l.strip() and not l.startswith('#')}, key=len, reverse=True) if os.path.exists(ALLOW_FILE) else []
SKIP_FILES = re.compile(r'^(assets/vendor/|package-lock\.json$|tools/dev/english_allow\.txt$|tools/dev/check_english\.py$)')
MAP_FILE = re.compile(r'^src/02[a-z]*-')

def french(text):
    for a in ALLOW:
        if a in text: text = text.replace(a, ' ')
    text = re.sub(r'https?://\S+', ' ', text)
    # whole words only, not glued to digits, underscores or hyphens (f32le, sans-serif, au-ic and #cfd6de are not French)
    words = re.findall(r"(?<![\w-])[A-Za-zÀ-ÿœŒ]+(?:'[A-Za-zÀ-ÿ]+)?(?![\w-])", text)
    hits = [w for w in words if w in FR_WORDS or (ACCENT.search(w) and w == w.lower() and w not in EN_ACCENTED)]
    hits += [w for w in re.findall(r"(?<![\w-])(?:[ldjnsc]|qu)'[a-zà-ÿ]{2,}", text)]
    return hits if len(hits) >= 2 or (hits and len(words) <= 4) else []

def js_comments(src):
    """(position, text) of each comment, outside strings, templates and regular expressions"""
    out = []; i = 0; n = len(src)
    while i < n:
        c = src[i]
        if c == '/' and src[i + 1:i + 2] == '/': j = src.find('\n', i); j = n if j < 0 else j; out.append((i, src[i:j])); i = j; continue
        if c == '/' and src[i + 1:i + 2] == '*': j = src.find('*/', i + 2); j = n if j < 0 else j + 2; out.append((i, src[i:j])); i = j; continue
        if c in '\'"': i = K.skip_string(src, i); continue
        if c == '`': i = K.skip_template(src, i); continue
        if c == '/' and K.regex_start(src, i):
            k = i + 1; cls = False
            while k < n and src[k] != '\n':
                if src[k] == '\\': k += 2; continue
                if src[k] == '[': cls = True
                elif src[k] == ']': cls = False
                elif src[k] == '/' and not cls: break
                k += 1
            i = k + 1; continue
        i += 1
    return out

def units(f, src):
    """(line, text) to check in a file"""
    line = lambda p: src.count('\n', 0, p) + 1
    if f.endswith(('.js', '.mjs')):
        for p, t in js_comments(src): yield line(p), t
        if not MAP_FILE.match(f):
            for a, b, v, g in K.literals(src): yield line(a), v
            for p, st, pre in K.templates(src): yield line(p), st
    elif f.endswith('.py'):
        for t in tokenize.generate_tokens(io.StringIO(src).readline):
            if t.type in (tokenize.COMMENT, tokenize.STRING) or t.type == getattr(tokenize, 'FSTRING_MIDDLE', -1): yield t.start[0], t.string
    elif f.endswith('.html'):
        for m in re.finditer(r'<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)</script>', src):
            for ln, t in units('x.js', m.group(1)): yield line(m.start(1)) + ln - 1, t
        rest = re.sub(r'<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?</script>', lambda m: '\n' * m.group(0).count('\n'), src)
        for k, l in enumerate(rest.split('\n'), 1): yield k, re.sub(r'<[^>]*>', ' ', l)
    else:
        for k, l in enumerate(src.split('\n'), 1): yield k, l

def check(root=ROOT):
    os.chdir(root)
    files = subprocess.run(['git', 'ls-files'], capture_output=True, text=True).stdout.split('\n')
    errs = []
    for f in files:
        if not f or SKIP_FILES.match(f) or not re.search(r'\.(js|mjs|py|html|md|json|sh|txt)$|^tools/hooks/', f): continue
        if not os.path.exists(f): continue
        try: src = open(f, encoding='utf-8').read()
        except UnicodeDecodeError: continue
        for ln, t in units(f, src):
            h = french(t)
            if h: errs.append(f'{f}:{ln}: {", ".join(sorted(set(h))[:6])}  ({t.strip()[:80]!r})')
    return errs

if __name__ == '__main__':
    errs = check()
    for e in errs: print(e)
    print(f'{len(errs)} French text(s) found' if errs else 'english: nothing to report')
    sys.exit(1 if errs else 0)
