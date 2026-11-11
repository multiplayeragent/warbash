"""Builds assets/sfx/: the game sounds, royalty-free recordings (mostly CC0, a few CC BY) prepared
and re-encoded as short MP3s, one folder per pack (assets/sfx/<pack>/<id>.mp3, plus meta.json), and the credits list
(assets/sfx/credits.json). build.py turns each pack into a file next to the page (dist/sfx/<pack>.<hash>.js),
which the game loads at sound startup (shared packs) or at map launch (map ambience).

Steps (from the root):
  python3 tools/build_sfx.py --fetch      downloads the missing sources into assets_src/sfx/src (mostly GitHub)
  python3 tools/build_sfx.py --build      makes the masters (assets_src/sfx/masters, 48 kHz WAV) family by family
  python3 tools/build_sfx.py              encodes the masters to MP3 in assets/sfx and writes the credits
Options: --family weaponry,impacts (limits --fetch and --build to these families), --pack ui (limits the encoding; the credits
          of the other packs stay those of assets/sfx/credits.json).
  python3 tools/build_sfx.py --voice      radio voices only (pack voice_en): generates the missing or
                                          changed lines (Chatterbox, see tools/sfx/series.py), processes them, encodes them and updates
                                          their credits in assets/sfx/credits.json; the other sounds do not change.
The families are the modules tools/sfx/<family>.py (SOURCES, FILES, build()); master conventions: tools/sfx/common.py.

meta.json gives the pack's MP3 sample rate (rate) and, for each sound (s), its length in samples at 48 kHz (n) and the index of its peak (pk): the game uses them
to find the exact start of the sound after decoding (the MP3 decoder of some browsers leaves the encoder delay
at the head) and to loop to the sample."""
import argparse, importlib, json, pathlib, subprocess, sys
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools' / 'sfx'))
import common  # noqa: E402

FAMILIES = ['weaponry', 'handling', 'impacts', 'series', 'ambiences', 'interface', 'mecha']
OUT = ROOT / 'assets' / 'sfx'

# Encoding per pack: (MP3 sample rate, LAME VBR quality: 0 best, 9 lightest). The masters stay at 48 kHz;
# the game decodes at the sample rate of its audio context.
ENC = {
    'weaponry': (48000, 3), 'impacts': (48000, 5), 'foley': (48000, 5), 'ui': (48000, 5), 'series': (44100, 5), 'mecha': (44100, 5),
    'voice_en': (24000, 6),
}
ENC_AMB = (32000, 6)  # map ambience packs (amb_<map>)


def enc_of(pack):
    return ENC.get(pack, ENC_AMB if pack.startswith('amb_') else (48000, 5))


def encode(src, dst, rate, q):
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(src), '-map_metadata', '-1', '-ar', str(rate),
                    '-c:a', 'libmp3lame', '-q:a', str(q), '-write_xing', '1', str(dst)], check=True)


def meta_of(path):
    x = common.load(path, mono=True)
    head = np.abs(x[:min(len(x), 2 * common.SR)])
    return [int(len(x)), int(np.argmax(head)) if len(head) else 0]


def encode_pack(pack, keep_it=False):
    """Encodes a pack's masters to MP3 (assets/sfx/<pack>/, meta.json); returns (number of sounds, bytes). keep_it: the sounds
    already shipped whose master is missing stay as they are (MP3 and meta.json), instead of being deleted"""
    rate, q = enc_of(pack); meta = {}; size = 0
    d = OUT / pack; d.mkdir(parents=True, exist_ok=True)
    wavs = sorted((common.MASTERS / pack).glob('*.wav'))
    keep = {w.stem for w in wavs}
    old_meta = json.loads((d / 'meta.json').read_text(encoding='utf-8'))['s'] if keep_it and (d / 'meta.json').exists() else {}
    for old in d.glob('*.mp3'):
        if old.stem in keep: continue
        if old.stem in old_meta: meta[old.stem] = old_meta[old.stem]; size += old.stat().st_size
        else: old.unlink()
    for w in wavs:
        mp3 = d / (w.stem + '.mp3')
        encode(w, mp3, rate, q); meta[w.stem] = meta_of(w); size += mp3.stat().st_size
    meta = dict(sorted(meta.items()))
    (d / 'meta.json').write_text(json.dumps({'rate': rate, 's': meta}, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'{pack:12s} {len(meta):4d} sounds {size // 1024:6d} KB  ({rate} Hz, V{q})')
    return len(wavs), size


def voices_only():
    """--voice: the voice pack, and its credits replaced in credits.json (the rest of the file kept as is)"""
    series = importlib.import_module('series')
    series.ENTRIES.clear(); series.voices()
    for pack in ('voice_en',): encode_pack(pack, series.NEW_SOUNDS)
    f = OUT / 'credits.json'
    cur = json.loads(f.read_text(encoding='utf-8'))
    at = next((i for i, e in enumerate(cur['soundList']) if e['pack'].startswith('voice_')), len(cur['soundList']))  # in place of the old ones
    remaining = [e for e in cur['soundList'] if not e['pack'].startswith('voice_')]
    new_ones = {(e['pack'], e['id']) for e in series.ENTRIES}
    kept_ones = [e for e in cur['soundList'] if series.NEW_SOUNDS and e['pack'].startswith('voice_') and (e['pack'], e['id']) not in new_ones]  # NEW_VOICES
    soundList = remaining[:at] + kept_ones + list(series.ENTRIES) + remaining[at:]
    used = {e['source'] for e in soundList}
    sources = {k: v for k, v in cur['sources'].items() if k in used}
    for k in {e['source'] for e in series.ENTRIES} | (used - set(sources)):   # those of the voices always re-read from SOURCES
        if k not in series.SOURCES: raise SystemExit('credits: source not described in SOURCES: ' + k)
        sources[k] = series.SOURCES[k]
    f.write_text(json.dumps({'sources': dict(sorted(sources.items())), 'soundList': soundList}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print('credits:', len(soundList), 'sounds,', len(sources), 'sources')


def pack_credits(packs):
    """--pack: only the credits of the re-encoded packs are replaced in credits.json; those of the other packs, their sources
    included, are kept as is (their masters may be missing on this machine). The sources that only the re-encoded packs use are
    re-read from SOURCES; a source they share with another pack keeps its current entry."""
    f = OUT / 'credits.json'
    cur = json.loads(f.read_text(encoding='utf-8')) if f.exists() else {'sources': {}, 'soundList': []}
    brand_new, described = [], {}
    for fam in FAMILIES:
        p = common.MASTERS / f'credits-{fam}.json'
        if p.exists(): brand_new += [e for e in json.loads(p.read_text(encoding='utf-8')) if e['pack'] in packs]
        if (ROOT / 'tools' / 'sfx' / f'{fam}.py').exists(): described.update(getattr(importlib.import_module(fam), 'SOURCES', {}))
    soundList = [e for e in cur['soundList'] if e['pack'] not in packs] + brand_new
    others = {e['source'] for e in soundList if e['pack'] not in packs}
    before = {e['source'] for e in cur['soundList'] if e['pack'] in packs}
    mine = {e['source'] for e in brand_new}
    sources = {k: v for k, v in cur['sources'].items() if k not in before - others}
    missing = [k for k in sorted(mine) if k not in described and not (k in others and k in sources)]
    if missing: raise SystemExit('credits: sources not described in SOURCES: ' + ', '.join(missing))
    for k in sorted(mine):
        if not (k in others and k in sources): sources[k] = described[k]
    f.write_text(json.dumps({'sources': sources, 'soundList': soundList}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print('credits:', len(soundList), 'sounds,', len(sources), 'sources (packs replaced: ' + ', '.join(sorted(packs)) + ')')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--fetch', action='store_true'); ap.add_argument('--build', action='store_true'); ap.add_argument('--voice', action='store_true')
    ap.add_argument('--family', default=''); ap.add_argument('--pack', default='')
    a = ap.parse_args()
    if a.voice: voices_only(); return
    fams = [f for f in (a.family.split(',') if a.family else FAMILIES) if f]
    mods = {f: importlib.import_module(f) for f in fams if (ROOT / 'tools' / 'sfx' / f'{f}.py').exists()}
    if a.fetch:
        for f, m in mods.items():
            print('download:', f); common.fetch_all(getattr(m, 'FILES', {}))
        return
    if a.build:
        for f, m in mods.items():
            print('masters:', f); m.build()
        return
    # encoding the masters
    packs = sorted(p.name for p in common.MASTERS.iterdir() if p.is_dir()) if common.MASTERS.exists() else []
    if a.pack: packs = [p for p in packs if p in a.pack.split(',')]
    total = 0
    for pack in packs:
        total += encode_pack(pack)[1]
    print('total', total // 1024, 'KB')
    if a.pack: pack_credits(set(packs)); return
    # credits: credits-<family>.json files written by build() + SOURCES of each family
    entries, sources = [], {}
    for f in FAMILIES:
        p = common.MASTERS / f'credits-{f}.json'
        if p.exists(): entries += json.loads(p.read_text(encoding='utf-8'))
        m = mods.get(f) or (importlib.import_module(f) if (ROOT / 'tools' / 'sfx' / f'{f}.py').exists() else None)
        if m: sources.update(getattr(m, 'SOURCES', {}))
    used = sorted({e['source'] for e in entries})
    missing = [s for s in used if s not in sources]
    if missing: raise SystemExit('credits: sources not described in SOURCES: ' + ', '.join(missing))
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'credits.json').write_text(json.dumps({'sources': {k: sources[k] for k in used}, 'soundList': entries}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print('credits:', len(entries), 'sounds,', len(used), 'sources')
    for k in used:
        lic = sources[k].get('licence', '')
        if 'CC0' not in lic and 'public domain' not in lic.lower(): print('  attribution required:', k, '|', lic, '|', sources[k].get('creator', ''))


if __name__ == '__main__':
    main()
