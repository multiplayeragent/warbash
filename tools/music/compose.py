"""War Bash sound kit, synthesized from scratch (no samples, no third-party recordings): the hit-marker sound, and the
drums, impacts, reverb and loudness tools that tools/music/score.py layers under its orchestra. Every sample is computed
here, so what it writes is original work under the project's MIT License.

    python3 tools/music/compose.py            # the hit sound: src/05-audio.js HIT_SAMPLE (47 ms, 8-bit mono, base64), rewritten in place

The music (level-up fanfare, end of match, menu theme) is written by tools/music/score.py.
Needs numpy, scipy and ffmpeg (libmp3lame) on PATH."""
import base64, json, os, re, subprocess, sys, tempfile
import numpy as np
from scipy.signal import butter, sosfilt, oaconvolve

SR = 48000
MENU_LUFS = -13.8  # loudness of the menu theme it replaces (ffmpeg ebur128)
ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
rng = np.random.default_rng(7)


def hz(note):
    """'D4', 'F#3', 'Bb2' -> frequency"""
    m = re.fullmatch(r'([A-G])([#b]?)(-?\d)', note)
    n = 'C D EF G A B'.index(m.group(1)) + {'#': 1, 'b': -1, '': 0}[m.group(2)]
    return 440.0 * 2 ** ((n - 9) / 12 + int(m.group(3)) - 4)


def lp(x, fc, order=2):
    return sosfilt(butter(order, min(fc, SR * 0.45), 'low', fs=SR, output='sos'), x)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, 'high', fs=SR, output='sos'), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)


class Mix:
    """Stereo buffer; add(x, at, pan) mixes a mono or stereo signal at time `at` (s)"""
    def __init__(self, secs):
        self.b = np.zeros((2, int(secs * SR) + SR * 4))

    def add(self, x, at, pan=0.0, gain=1.0):
        i = int(at * SR)
        if x.ndim == 1:
            l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
            x = np.vstack([x * l * 1.41, x * r * 1.41])
        if i < 0: x, i = x[:, -i:], 0
        n = min(x.shape[1], self.b.shape[1] - i)
        if n > 0: self.b[:, i:i + n] += x[:, :n] * gain


# ---------- instruments ----------
def stacc(f, vel=0.8, dur=0.14):
    """Short spiccato string note for ostinatos"""
    n = int((dur + 0.25) * SR); t = np.arange(n) / SR
    a = np.minimum(1, t / 0.006) * np.exp(-t / (dur * 0.55))
    ph = 2 * np.pi * f * t + rng.uniform(0, 6.28)
    out = sum(np.sin(k * ph) / k * np.exp(-(k - 1) / 5.0) for k in range(1, 14) if f * k < 8000)
    return lp(out, 2600) * a * 0.3 * vel


def taiko(vel=1.0):
    n = int(1.2 * SR); t = np.arange(n) / SR
    ph = 2 * np.pi * np.cumsum(55 + 90 * np.exp(-t / 0.035)) / SR
    tone = np.sin(ph) * np.exp(-t / 0.32)
    skin = lp(rng.standard_normal(n), 1400) * np.exp(-t / 0.025) * 0.7
    return np.tanh((tone + skin) * 1.6) * 0.55 * vel


def crash(vel=1.0, dur=3.0, swell=0.0):
    n = int((dur + swell) * SR); t = np.arange(n) / SR
    x = hp(rng.standard_normal((2, n)), 3200)
    x = x + 0.3 * bp(rng.standard_normal((2, n)), 5000, 12000)
    e = np.where(t < swell, (t / max(swell, 1e-4)) ** 2.5, np.exp(-(t - swell) / (dur * 0.2)))
    return np.vstack([lp(x[0], 11000), lp(x[1], 11000)]) * e * 0.055 * vel


def boom(vel=1.0, dur=2.5):
    """Low cinematic impact"""
    n = int(dur * SR); t = np.arange(n) / SR
    ph = 2 * np.pi * np.cumsum(38 + 40 * np.exp(-t / 0.08)) / SR
    sub = np.sin(ph) * np.exp(-t / 0.9)
    rum = lp(rng.standard_normal(n), 220) * np.exp(-t / 0.5) * 1.5
    return np.tanh((sub + rum) * 1.4) * 0.6 * vel


# ---------- master ----------
def reverb(x, secs=2.2, wet=0.28, lp_hz=6000):
    n = int(secs * SR); t = np.arange(n) / SR
    ir = rng.standard_normal((2, n)) * np.exp(-t / (secs / 6.9))
    ir = np.vstack([lp(ir[0], lp_hz), lp(ir[1], lp_hz)])
    ir[:, :int(0.012 * SR)] = 0
    ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
    w = np.vstack([oaconvolve(x[0], ir[0])[:x.shape[1]], oaconvolve(x[1], ir[1])[:x.shape[1]]])
    return x * (1 - wet) + w * wet * 1.6


def master(x, peak=0.89, drive=0.7):
    x = np.tanh(x * drive) / np.tanh(drive)
    x = x / max(1e-9, np.abs(x).max()) * peak
    return x


def trim(x, tail_db=-48):
    """Cut trailing silence"""
    lim = 10 ** (tail_db / 20) * np.abs(x).max()
    idx = np.nonzero(np.abs(x).max(axis=0) > lim)[0]
    end = idx[-1] + int(0.05 * SR) if len(idx) else x.shape[1]
    y = x[:, :end].copy()
    f = int(0.04 * SR); y[:, -f:] *= np.linspace(1, 0, f)
    return y


def _wav(x):
    import wave
    pcm = (np.clip(x.T, -1, 1) * 32767).astype('<i2')
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f: wav = f.name
    with wave.open(wav, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    return wav


def lufs(x):
    """Integrated loudness (EBU R128) measured by ffmpeg"""
    wav = _wav(x)
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', wav, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True)
    os.unlink(wav)
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', r.stderr)[-1])


def loud(x, target):
    """Bring a piece to `target` LUFS (the loudness of the track it replaces, so the game's gains stay right), peaks kept under -1 dBFS"""
    for _ in range(3):
        x = x * 10 ** ((target - lufs(x)) / 20)
        pk = np.abs(x).max()
        if pk > 0.89: x = np.tanh(x / 0.89) * 0.89
    return x


def write_mp3(x, path, q=2, target=None):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if target is not None: x = loud(x, target)
    wav = _wav(x)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-map_metadata', '-1', '-ar', str(SR), '-c:a', 'libmp3lame',
                    '-q:a', str(q), '-write_xing', '1', path], check=True)
    os.unlink(wav)
    print(f'{os.path.relpath(path, ROOT)}: {x.shape[1] / SR:.2f} s, {os.path.getsize(path) // 1024} KB, {lufs(x) if target is None else target} LUFS')


def sfx_meta(pack, sid, x):
    """assets/sfx/<pack>/meta.json entry: [samples at 48 kHz, index of the peak in the first 2 s] (tools/build_sfx.py, meta_of)"""
    p = os.path.join(ROOT, 'assets', 'sfx', pack, 'meta.json')
    meta = json.load(open(p, encoding='utf-8'))
    mono = np.abs(x.mean(axis=0))
    meta['s'][sid] = [int(x.shape[1]), int(np.argmax(mono[:2 * SR]))]
    meta['s'] = dict(sorted(meta['s'].items()))
    open(p, 'w', encoding='utf-8').write(json.dumps(meta, separators=(',', ':')) + '\n')


# ---------- hit sound ----------
def hit():
    """Hit marker: a 47 ms low, saturated 'bwop', 8-bit signed mono at 48 kHz, base64 (src/05-audio.js, hitSampleBuild)"""
    n = int(0.047 * SR); t = np.arange(n) / SR
    f = 105 + 260 * np.exp(-t / 0.009)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) + 0.35 * np.sin(2 * ph)
    click = bp(rng.standard_normal(n), 2500, 9000) * np.exp(-t / 0.0015) * 0.6
    x = np.tanh((body * np.exp(-t / 0.02) + click) * 3.0)
    x *= np.minimum(1, t / 0.0006) * np.minimum(1, (n - np.arange(n)) / (0.004 * SR))
    x = x / np.abs(x).max() * 0.98
    q = np.round(x * 127).astype(np.int8)
    return base64.b64encode(q.tobytes()).decode('ascii')


def main(which):
    if 'hit' in which:
        p = os.path.join(ROOT, 'src', '05-audio.js'); s = open(p, encoding='utf-8').read()
        b64 = hit()
        s2, k = re.subn(r"const HIT_SAMPLE = '[A-Za-z0-9+/=]*';", "const HIT_SAMPLE = '" + b64 + "';", s)
        if k != 1: raise SystemExit('HIT_SAMPLE not found in src/05-audio.js')
        open(p, 'w', encoding='utf-8', newline='').write(s2)
        print(f'src/05-audio.js HIT_SAMPLE: {len(b64)} chars')


if __name__ == '__main__':
    main(sys.argv[1:] or ['hit'])
