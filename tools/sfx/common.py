"""Common sound preparation tools (see tools/build_sfx.py).

Each family (tools/sfx/<family>.py) describes its sources (SOURCES: license, author, address), the files it
uses (FILES: local path under assets_src/sfx/src → download address) and a build() function that makes
the "masters": one 48 kHz WAV per sound, under assets_src/sfx/masters/<pack>/<id>.wav (assets_src/ is not versioned).
build_sfx.py then encodes the masters to MP3 in assets/sfx/<pack>/ (versioned) and gathers the credits.

Master conventions:
- 48 kHz, mono unless stated (ambience beds and impulse responses in stereo);
- one sound per file, numbered variants: <id>-1.wav, <id>-2.wav... (the game picks a variant at random);
- clean start (no leading silence, 2 ms fade-in at most for a transient), fade-out, no click;
- transients (shots, impacts, handling, interface, footsteps) peak-normalized to -1 dBFS: mixing is done in the game;
- loops (beds, rotor, engines, water): loopable to the sample (the end chains onto the start, crossfade done here);
- ambience beds: RMS level around -20 dBFS, peak under -3 dBFS.
Downloaded files are never executed: they are only decoded (ffmpeg)."""
import json, os, pathlib, subprocess, urllib.request
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
SRC = ROOT / 'assets_src' / 'sfx' / 'src'          # downloaded sources
MASTERS = ROOT / 'assets_src' / 'sfx' / 'masters'  # masters made by the families
SR = 48000


def fetch(rel, url):
    """Downloads url into assets_src/sfx/src/rel if it is missing; returns the local path."""
    p = SRC / rel
    if not p.exists():
        p.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(url, headers={'User-Agent': 'war-bash-sfx'})
        with urllib.request.urlopen(req, timeout=120) as r, open(p, 'wb') as f:
            f.write(r.read())
    return p


def fetch_all(files):
    """files: {relative path: address}"""
    for rel, url in files.items():
        fetch(rel, url)


def load(path, sr=SR, mono=True, start=None, dur=None):
    """Decodes any audio file (ffmpeg) to float64: array (n,) for mono, (n, 2) for stereo."""
    cmd = ['ffmpeg', '-v', 'error']
    if start is not None: cmd += ['-ss', str(start)]
    if dur is not None: cmd += ['-t', str(dur)]
    cmd += ['-i', str(path), '-ac', '1' if mono else '2', '-ar', str(sr), '-f', 'f32le', '-']
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    return x if mono else x.reshape(-1, 2)


def ff(x, af, sr=SR):
    """Runs a signal through an ffmpeg filter chain (-af), same rate and same channels on output."""
    ch = 1 if x.ndim == 1 else x.shape[1]
    cmd = ['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(sr), '-ac', str(ch), '-i', '-', '-af', af, '-ar', str(sr), '-ac', str(ch), '-f', 'f32le', '-']
    raw = subprocess.run(cmd, check=True, input=x.astype(np.float32).tobytes(), capture_output=True).stdout
    y = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    return y if ch == 1 else y.reshape(-1, ch)


def db(v):
    return 20 * np.log10(max(float(v), 1e-12))


def peak(x):
    return float(np.max(np.abs(x))) if len(x) else 0.0


def norm(x, dbfs=-1.0):
    """Peak-normalizes to dbfs."""
    p = peak(x)
    return x * (10 ** (dbfs / 20) / p) if p > 0 else x


def norm_rms(x, dbfs=-20.0, ceil=-3.0):
    """Target RMS level, peak capped."""
    r = float(np.sqrt(np.mean(x ** 2))) if len(x) else 0
    if r <= 0: return x
    y = x * (10 ** (dbfs / 20) / r)
    p = peak(y)
    return y * (10 ** (ceil / 20) / p) if p > 10 ** (ceil / 20) else y


def onset(x, thr_db=-50.0):
    """Index of the first sample above thr_db under the peak."""
    m = np.abs(x if x.ndim == 1 else x.max(axis=1))
    k = np.nonzero(m > peak(m) * 10 ** (thr_db / 20))[0]
    return int(k[0]) if len(k) else 0


def trim(x, thr_db=-50.0, pre=0.0):
    """Cuts the leading silence (pre: seconds kept before the attack)."""
    i = max(0, onset(x, thr_db) - int(pre * SR))
    return x[i:]


def tail_end(x, thr_db=-60.0):
    """End index: last sample above thr_db under the peak."""
    m = np.abs(x if x.ndim == 1 else x.max(axis=1))
    k = np.nonzero(m > peak(m) * 10 ** (thr_db / 20))[0]
    return int(k[-1]) + 1 if len(k) else len(x)


def fade(x, outro=0.002, fout=0.05, curve=2.0):
    """Fade-in and fade-out (seconds); the output follows a curve (1 - u)^curve."""
    y = x.copy(); n = len(y)
    a = min(n, int(outro * SR)); b = min(n, int(fout * SR))
    if a > 0:
        r = np.linspace(0, 1, a, endpoint=False)
        y[:a] = (y[:a].T * r).T
    if b > 0:
        r = (1 - np.linspace(0, 1, b)) ** curve
        y[n - b:] = (y[n - b:].T * r).T
    return y


def cut(x, dur, fout=0.08):
    """Keeps dur seconds with a fade-out."""
    return fade(x[:int(dur * SR)], 0, fout)


def loopify(x, xf=0.5):
    """Makes a signal loopable: the last xf seconds are crossfaded (constant power) over the start.
    The result lasts len(x) - xf; its end chains seamlessly onto its first sample."""
    n = int(xf * SR)
    if n <= 0 or n * 2 >= len(x): return x
    body = x[:len(x) - n].copy()
    t = np.linspace(0, 1, n, endpoint=False)
    a, b = np.cos(t * np.pi / 2), np.sin(t * np.pi / 2)
    head = x[:n]; tail = x[len(x) - n:]
    body[:n] = (tail.T * a).T + (head.T * b).T
    return body


def mix(*layers):
    """Sum of layers (signal, offset in s, gain) of different lengths."""
    n = max(int(off * SR) + len(s) for s, off, g in layers)
    shape = (n,) if layers[0][0].ndim == 1 else (n, layers[0][0].shape[1])
    out = np.zeros(shape)
    for s, off, g in layers:
        i = int(off * SR); out[i:i + len(s)] += s * g
    return out


def stereo(x):
    return x if x.ndim == 2 else np.stack([x, x], axis=1)


def save_master(pack, sid, x, sr=SR):
    """Writes assets_src/sfx/masters/<pack>/<sid>.wav (24-bit PCM). Refuses an empty or clipped signal."""
    if not len(x): raise ValueError(f'{pack}/{sid}: empty signal')
    if peak(x) > 1.0001: raise ValueError(f'{pack}/{sid}: peak {db(peak(x)):.2f} dBFS above 0')
    d = MASTERS / pack; d.mkdir(parents=True, exist_ok=True)
    ch = 1 if x.ndim == 1 else x.shape[1]
    p = d / f'{sid}.wav'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(sr), '-ac', str(ch), '-i', '-', '-c:a', 'pcm_s24le', str(p)],
                   check=True, input=np.clip(x, -1, 1).astype(np.float32).tobytes())
    return p


def credit(sid, pack, source, filepath, detail=''):
    """Credit entry of a master: source = SOURCES key of the family."""
    return {'id': sid, 'pack': pack, 'source': source, 'filepath': filepath, 'detail': detail}


def write_credits(family, entries):
    """assets_src/sfx/masters/credits-<family>.json (gathered by build_sfx.py)"""
    MASTERS.mkdir(parents=True, exist_ok=True)
    (MASTERS / f'credits-{family}.json').write_text(json.dumps(entries, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
