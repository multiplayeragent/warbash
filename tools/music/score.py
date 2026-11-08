"""War Bash music, written here note by note: an orchestra (strings, brass, choir, timpani) played by FluidSynth with the
MuseScore General SoundFont (MIT, see NOTICE.md), with the synthesized war drums and impacts of compose.py layered on top.
The scores below are original work under the project's MIT License.

    python3 tools/music/score.py --fetch     # once: FluidSynth (Windows build) and the SoundFont into tools/music/.cache/
    python3 tools/music/score.py             # every piece
    python3 tools/music/score.py menu        # one: rankup, victory, defeat, menu
    python3 tools/music/score.py --meta      # after swapping in other end-of-match tracks: their meta.json entries

Writes:
  assets/rankup.mp3                 level-up fanfare (about 4 s), embedded in the page (build.py, socle)
  assets/sfx/fin/m_victory.mp3      end of match, win (about 5 s), plus its entry in assets/sfx/fin/meta.json
  assets/sfx/fin/m_defeat.mp3       end of match, loss (about 8 s), same
  assets/music/menu-theme.mp3       menu theme, a seamless loop (about 1 min 55 s)
FLUIDSYNTH and SOUNDFONT override the paths of the tools; elsewhere than Windows, install fluidsynth from the package
manager. Also needs numpy, scipy and ffmpeg. docs/music.md says how to put other tracks in their place."""
import os, re, shutil, struct, subprocess, sys, tempfile, urllib.request, zipfile
import numpy as np
from scipy.io import wavfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import compose as C  # noqa: E402  (drums, impacts, reverb, loudness, mp3 and meta.json writers)
from compose import SR, ROOT  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '.cache')
FS_URL = 'https://github.com/FluidSynth/fluidsynth/releases/download/v2.6.2/fluidsynth-v2.6.2-win10-x64-cpp11.zip'
SF_URL = 'https://ftp.osuosl.org/pub/musescore/soundfont/MuseScore_General/MuseScore_General.sf3'
rng = np.random.default_rng(11)


# ---------- tools ----------
def fetch():
    os.makedirs(CACHE, exist_ok=True)
    sf = os.path.join(CACHE, 'MuseScore_General.sf3')
    if not os.path.exists(sf):
        print('downloading', SF_URL); urllib.request.urlretrieve(SF_URL, sf)
    if sys.platform == 'win32' and not find_fluidsynth():
        z = os.path.join(CACHE, 'fluidsynth.zip')
        print('downloading', FS_URL); urllib.request.urlretrieve(FS_URL, z)
        zipfile.ZipFile(z).extractall(os.path.join(CACHE, 'fluidsynth')); os.unlink(z)
    print('fluidsynth:', find_fluidsynth() or 'missing (install it from your package manager)'); print('soundfont:', sf)


def find_fluidsynth():
    if os.environ.get('FLUIDSYNTH'): return os.environ['FLUIDSYNTH']
    for d, _, files in os.walk(os.path.join(CACHE, 'fluidsynth')):
        if 'fluidsynth.exe' in files: return os.path.join(d, 'fluidsynth.exe')
    return shutil.which('fluidsynth')


def soundfont():
    return os.environ.get('SOUNDFONT') or os.path.join(CACHE, 'MuseScore_General.sf3')


# ---------- score ----------
PC = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8,
      'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
CHORDS = {'Dm': ('D', 'F', 'A'), 'Bb': ('Bb', 'D', 'F'), 'F': ('F', 'A', 'C'), 'C': ('C', 'E', 'G'), 'Gm': ('G', 'Bb', 'D'),
          'A': ('A', 'C#', 'E'), 'Eb': ('Eb', 'G', 'Bb'), 'D': ('D', 'F#', 'A')}


def midi(n):
    """'D4', 'F#3', 'Bb2' or a MIDI number -> MIDI number (C4 = 60)"""
    if isinstance(n, (int, np.integer)): return int(n)
    m = re.fullmatch(r'([A-G][#b]?)(-?\d)', n)
    return 12 * (int(m.group(2)) + 1) + PC[m.group(1)]


def up(pc, lo):
    """lowest note of pitch class `pc` at or above `lo`"""
    lo = midi(lo); return lo + (PC[pc] - lo) % 12


class Song:
    """One MIDI file (format 0) built in beats; parts are named channels with a General MIDI program"""
    TPB = 480

    def __init__(self, bpm):
        self.bpm, self.beat, self.ch, self.ev, self.end = bpm, 60 / bpm, {}, [], 0.0

    def part(self, name, ch, prog, vol=100, pan=64, rev=50):
        self.ch[name] = ch
        if ch != 9: self._e(0, 0, bytes([0xC0 | ch, prog]))
        for cc, v in ((7, vol), (10, pan), (91, rev), (93, 0), (11, 127)): self._e(0, 0, bytes([0xB0 | ch, cc, v]))

    def _e(self, beat, order, data):
        self.ev.append((int(round(max(0.0, beat) * self.TPB)), order, data))

    def note(self, part, n, beat, dur, vel=90, jit=0.012):
        ch, p = self.ch[part], midi(n)
        b = max(0.0, beat + (rng.normal(0, jit) if jit else 0.0))
        v = int(np.clip(round(vel * rng.uniform(0.94, 1.04)), 1, 127))
        self._e(b, 2, bytes([0x90 | ch, p, v])); self._e(b + dur, 1, bytes([0x80 | ch, p, 0]))
        self.end = max(self.end, b + dur)

    def notes(self, part, ns, beat, dur, vel=90, **kw):
        for n in ns: self.note(part, n, beat, dur, vel, **kw)

    def cc(self, part, beat, cc, v):
        self._e(beat, 0, bytes([0xB0 | self.ch[part], cc, int(np.clip(v, 0, 127))]))

    def ramp(self, part, b0, b1, v0, v1, cc=11, steps=24):
        for i in range(steps + 1): self.cc(part, b0 + (b1 - b0) * i / steps, cc, v0 + (v1 - v0) * i / steps)

    def program(self, part, beat, prog):
        self._e(beat, 0, bytes([0xC0 | self.ch[part], prog]))

    def write(self, path, tail_beats):
        def vlq(n):
            out = [n & 0x7F]; n >>= 7
            while n: out.append(0x80 | (n & 0x7F)); n >>= 7
            return bytes(reversed(out))
        us = int(round(60e6 / self.bpm))
        trk = bytearray(b'\x00\xff\x51\x03' + us.to_bytes(3, 'big'))
        last = 0
        for tick, _, data in sorted(self.ev, key=lambda e: (e[0], e[1])):
            trk += vlq(tick - last) + data; last = tick
        end = int((self.end + tail_beats) * self.TPB)
        trk += vlq(max(0, end - last)) + b'\xb0\x7b\x00' + b'\x00\xff\x2f\x00'  # all notes off, then end of track
        with open(path, 'wb') as f:
            f.write(b'MThd' + struct.pack('>IHHH', 6, 0, 1, self.TPB) + b'MTrk' + struct.pack('>I', len(trk)) + trk)


def render(song, tail=4.0):
    """The song played by FluidSynth: float stereo array at SR"""
    fs, sf = find_fluidsynth(), soundfont()
    if not fs or not os.path.exists(sf): raise SystemExit('FluidSynth or the SoundFont is missing: python3 tools/music/score.py --fetch')
    d = tempfile.mkdtemp(); mid, wav = os.path.join(d, 's.mid'), os.path.join(d, 's.wav')
    song.write(mid, tail / song.beat)
    subprocess.run([fs, '-ni', '-q', '-g', '0.5', '-r', str(SR), '-O', 'float', '-T', 'wav', '-F', wav,
                    '-o', 'synth.polyphony=1024', '-o', 'synth.reverb.active=1', '-o', 'synth.reverb.room-size=0.75',
                    '-o', 'synth.reverb.damp=0.35', '-o', 'synth.reverb.width=1.0', '-o', 'synth.reverb.level=0.75',
                    '-o', 'synth.chorus.active=0', sf, mid], check=True, stdout=subprocess.DEVNULL)
    r, x = wavfile.read(wav); shutil.rmtree(d, ignore_errors=True)
    assert r == SR, r
    return x.T.astype(np.float64)


def bus(orch, perc, perc_gain=1.0, rev=(2.2, 0.24), low_cut=0.4):
    """orchestra + drums (the drums get their own room), then the tone: less sub (taiko, impacts, tuba and basses pile
    up under 90 Hz), more presence (the SoundFont's brass and strings are dark next to a modern mix)"""
    n = max(orch.shape[1], perc.shape[1])
    out = np.zeros((2, n)); out[:, :orch.shape[1]] += orch
    p = C.reverb(perc, *rev); out[:, :p.shape[1]] += p * perc_gain
    out = C.hp(out, 28) - low_cut * C.lp(out, 90)
    return out + 0.8 * C.hp(out, 2400)


def kit_roll(s, b0, b1, v0, v1, note=38, rate=8):
    """snare (or tom) roll on the kit, `rate` strokes per beat, crescendo v0 -> v1"""
    k = max(1, int((b1 - b0) * rate))
    for i in range(k): s.note('dr', note, b0 + i / rate, 0.1, v0 + (v1 - v0) * i / max(1, k - 1), jit=0.004)


def tim_roll(s, n, b0, b1, v0, v1, rate=8):
    k = max(1, int((b1 - b0) * rate))
    for i in range(k): s.note('tim', n, b0 + i / rate, 0.2, v0 + (v1 - v0) * i / max(1, k - 1), jit=0.004)


ORCH = [  # name, channel, General MIDI program, volume, pan, reverb send
    ('str', 0, 48, 104, 64, 45), ('pad', 1, 49, 92, 64, 70), ('cb', 2, 43, 108, 56, 45), ('hn', 3, 60, 112, 50, 70),
    ('tp', 4, 56, 98, 78, 60), ('brs', 5, 61, 100, 64, 55), ('tb', 6, 57, 98, 42, 50), ('tu', 7, 58, 96, 60, 40),
    ('tim', 8, 47, 116, 64, 45), ('dr', 9, 0, 108, 64, 40), ('ch', 10, 52, 92, 64, 85), ('fl', 11, 73, 96, 82, 70),
    ('ob', 12, 68, 90, 46, 70), ('trm', 13, 44, 84, 86, 65), ('gl', 14, 9, 84, 92, 70), ('sb', 15, 39, 50, 64, 8)]


def orchestra(bpm, swap=None):
    s = Song(bpm)
    for name, ch, prog, vol, pan, rev in ORCH:
        s.part(name, ch, (swap or {}).get(name, prog), vol, pan, rev)
    return s


# ---------- pieces ----------
def rankup():
    """Level up, D major, 120 bpm: a snare pickup, a stab with timpani and crash, a trumpet triplet climb, a held chord
    of the whole orchestra with a glockenspiel sparkle"""
    s = orchestra(120, {'pad': 48}); bt = s.beat; m = C.Mix(6)
    kit_roll(s, 0.0, 0.75, 45, 112, rate=12)
    m.add(C.crash(0.55, 0.4, swell=0.36), 0.0)
    t0 = 0.75
    s.notes('brs', ['D3', 'A3', 'D4', 'F#4', 'A4'], t0, 0.45, 122); s.notes('tb', ['D3', 'A3'], t0, 0.45, 118)
    s.note('tu', 'D2', t0, 0.45, 118); s.notes('str', ['D3', 'A3', 'D4', 'F#4', 'A4'], t0, 0.3, 120)
    s.note('tim', 'D2', t0, 0.5, 124); s.note('dr', 49, t0, 1, 118); s.note('dr', 57, t0, 1, 100)
    m.add(C.boom(0.7, 2.0), t0 * bt); m.add(C.taiko(1.0), t0 * bt)
    for i, n in enumerate(['A4', 'D5', 'F#5']):
        s.note('tp', n, 1.5 + i / 3, 0.3, 112 + 4 * i, jit=0.004); s.note('hn', midi(n) - 12, 1.5 + i / 3, 0.3, 100, jit=0.004)
    s.note('tim', 'A2', 1.5, 0.3, 96); s.note('tim', 'A2', 1.83, 0.3, 104); s.note('tim', 'A2', 2.17, 0.3, 112)
    t1, hold = 2.5, 2.5
    s.notes('brs', ['D3', 'A3', 'D4', 'F#4', 'A4', 'D5'], t1, hold, 118); s.notes('tp', ['D5', 'A5'], t1, hold, 112)
    s.notes('hn', ['A3', 'D4', 'F#4'], t1, hold, 110); s.notes('tb', ['D3', 'A3'], t1, hold, 112); s.note('tu', 'D2', t1, hold, 112)
    s.notes('pad', ['D3', 'A3', 'D4', 'F#4', 'A4', 'D5'], t1, hold, 110); s.notes('trm', ['F#5', 'A5'], t1, hold, 96)
    s.notes('ch', ['D4', 'F#4', 'A4', 'D5'], t1, hold, 104); s.note('cb', 'D2', t1, hold, 116)
    s.note('tim', 'D2', t1, 0.4, 124); tim_roll(s, 'D2', t1 + 0.5, t1 + 2.0, 90, 50); s.note('tim', 'D2', t1 + 2.25, 0.5, 80)
    s.note('dr', 49, t1, 2, 124); s.note('dr', 57, t1, 2, 110)
    for i, n in enumerate(['D6', 'F#6', 'A6', 'D7', 'A6', 'D7']):
        s.note('gl', n, t1 + i * 0.25, 1.2, 96 - 6 * i, jit=0.003)
    for p in ('brs', 'tp', 'hn', 'tb', 'tu', 'pad', 'trm', 'ch'): s.ramp(p, t1 + 1.2, t1 + hold, 127, 50)
    m.add(C.boom(0.6, 2.4), t1 * bt); m.add(C.taiko(0.9), t1 * bt)
    return C.trim(C.master(bus(render(s, 3.0), m.b, 0.8), peak=0.89, drive=0.9), tail_db=-40)


def victory():
    """Win, Bb major, 116 bpm: a trumpet fanfare over I - IV - V - I, a snare roll into a full held tonic with choir"""
    s = orchestra(116, {'pad': 48}); bt = s.beat; m = C.Mix(8)
    chords = [(0.0, 2.0, 'Bb'), (2.0, 1.0, 'Eb'), (3.0, 1.0, 'F'), (4.0, 3.2, 'Bb')]
    mel = [('F4', 0, 0.45), ('Bb4', 0.5, 0.45), ('D5', 1, 0.9), ('Eb5', 2, 0.45), ('G5', 2.5, 0.45), ('F5', 3, 0.45),
           ('A5', 3.5, 0.45), ('Bb5', 4, 3.2)]
    for n, b, d in mel: s.note('tp', n, b, d, 116, jit=0.005)
    for b0, d, c in chords:
        r, t, f = CHORDS[c]; last = b0 >= 4
        s.notes('brs', [up(r, 'A2'), up(f, 'D3'), up(r, 'A3'), up(t, 'C4')], b0, d * 0.95, 112 if not last else 120)
        s.notes('hn', [up(t, 'D4'), up(f, 'F4')], b0, d * 0.95, 108); s.notes('tb', [up(r, 'A2'), up(f, 'C3')], b0, d * 0.95, 110)
        s.note('tu', up(r, 'A1'), b0, d * 0.95, 112); s.note('cb', up(r, 'A1'), b0, d * 0.95, 110)
        s.notes('pad', [up(r, 'D3'), up(t, 'D4'), up(f, 'D4')], b0, d * 0.95, 96 if not last else 112)
        s.note('tim', up(r, 'F2'), b0, 0.4, 118)
        m.add(C.taiko(0.8 if not last else 1.0), b0 * bt)
        for k in (0.5, 1.5):
            if not last and k < d: s.note('tim', up(r, 'F2'), b0 + k, 0.3, 90)
    kit_roll(s, 3.0, 4.0, 40, 110, rate=8); m.add(C.crash(0.6, 0.3, swell=bt), 3 * bt)
    s.notes('ch', ['Bb3', 'D4', 'F4', 'Bb4'], 4, 3.2, 108); s.notes('trm', ['D5', 'F5'], 4, 3.2, 96)
    s.note('dr', 49, 4, 2, 124); s.note('dr', 57, 4, 2, 110); tim_roll(s, 'Bb2', 4.5, 6.0, 96, 50); s.note('tim', 'Bb2', 6.25, 0.5, 84)
    for i, n in enumerate(['Bb5', 'D6', 'F6', 'Bb6', 'F6', 'Bb6']): s.note('gl', n, 4 + i * 0.25, 1.2, 96 - 6 * i, jit=0.003)
    for p in ('brs', 'tp', 'hn', 'tb', 'tu', 'pad', 'trm', 'ch', 'cb'): s.ramp(p, 5.6, 7.2, 127, 55)
    m.add(C.boom(0.75, 2.6), 4 * bt)
    return C.trim(C.master(bus(render(s, 3.0), m.b, 0.75), peak=0.89, drive=0.9), tail_db=-42)


def defeat():
    """Loss, D minor, 60 bpm: one deep impact, then low strings and horns falling over i - VI - iv - V, unresolved"""
    s = orchestra(60, {'ch': 53}); bt = s.beat; m = C.Mix(11)
    m.add(C.boom(1.0, 3.2), 0.0); s.note('tim', 'D2', 0, 1.0, 120); s.note('dr', 49, 0, 2, 70)
    prog = [(0.15, 1.65, ['D2', 'A2'], ['D3', 'F3', 'A3']), (1.8, 1.6, ['Bb1', 'F2'], ['D3', 'F3', 'Bb3']),
            (3.4, 1.6, ['G1', 'D2'], ['D3', 'G3', 'Bb3']), (5.0, 2.6, ['A1', 'E2'], ['C#3', 'E3', 'A3'])]
    for b, d, low, high in prog:
        s.notes('cb', low, b, d * 0.97, 104); s.notes('pad', high, b, d * 0.97, 92); s.note('tb', midi(low[0]) + 12, b, d * 0.97, 72)
        s.notes('ch', high[1:], b, d * 0.97, 70)
    for n, b, d in [('A3', 0.25, 1.45), ('F3', 1.85, 1.45), ('D3', 3.45, 1.45), ('C#3', 5.05, 2.4)]:
        s.note('hn', n, b, d, 98)
    for n, b, d in [('A4', 0.3, 1.0), ('G4', 1.3, 0.5), ('F4', 1.85, 1.0), ('E4', 2.85, 0.5), ('D4', 3.45, 1.4), ('E4', 5.05, 2.4)]:
        s.note('ob', n, b, d, 74)
    tim_roll(s, 'A2', 4.4, 5.0, 30, 90, rate=10); s.note('tim', 'A2', 5.0, 0.6, 100)
    for p in ('cb', 'pad', 'tb', 'ch', 'hn', 'ob'): s.ramp(p, 5.6, 7.6, 127, 40)
    m.add(C.boom(0.55, 2.6), 5.0 * bt)
    return C.trim(C.master(bus(render(s, 4.0), m.b, 0.7, rev=(3.0, 0.3)), peak=0.82, drive=0.8), tail_db=-44)


# Menu theme: D minor, 100 bpm, 48 bars. Themes in beats from the start of their 8 bars.
THEME_A = [('A3', 0, 1), ('D4', 1, 1.5), ('E4', 2.5, 0.5), ('F4', 3, 1), ('G4', 4, 1.5), ('F4', 5.5, 0.5), ('D4', 6, 2),
           ('C4', 8, 1), ('F4', 9, 1.5), ('G4', 10.5, 0.5), ('A4', 11, 1), ('G4', 12, 3), ('E4', 15, 1),
           ('A3', 16, 1), ('D4', 17, 1.5), ('E4', 18.5, 0.5), ('F4', 19, 1), ('Bb4', 20, 1.5), ('A4', 21.5, 0.5), ('F4', 22, 2),
           ('A4', 24, 1), ('C5', 25, 1.5), ('Bb4', 26.5, 0.5), ('A4', 27, 1), ('G4', 28, 2), ('A4', 30, 1), ('E4', 31, 1)]
THEME_B = [('D5', 0, 2), ('F5', 2, 1), ('E5', 3, 1), ('D5', 4, 1.5), ('Bb4', 5.5, 0.5), ('G4', 6, 2),
           ('F5', 8, 1.5), ('E5', 9.5, 0.5), ('D5', 10, 1), ('F5', 11, 1), ('E5', 12, 3), ('C#5', 15, 1),
           ('D5', 16, 2), ('F5', 18, 1), ('A5', 19, 1), ('G5', 20, 1.5), ('F5', 21.5, 0.5), ('D5', 22, 2),
           ('F5', 24, 1), ('D5', 25, 1), ('Bb4', 26, 1), ('D5', 27, 1), ('C#5', 28, 2), ('E5', 30, 1), ('A4', 31, 1)]
THEME_BRK = [('D5', 0, 1), ('F5', 1, 1), ('Bb5', 2, 2), ('G5', 4, 1), ('E5', 5, 1), ('C5', 6, 2), ('F5', 8, 1.5), ('E5', 9.5, 0.5),
             ('D5', 10, 2), ('C#5', 12, 2), ('E5', 14, 2)]
COUNTER = ['F5', 'D5', 'C5', 'E5', 'F5', 'F5', 'A5', 'G5']
CALL_IN = [('C4', 8, 1), ('F4', 9, 1), ('A4', 10, 2), ('G4', 12, 3), ('E4', 15, 1)]
CALL_OUT = [('G3', 0, 1), ('D4', 1, 1), ('Bb3', 2, 2), ('F4', 4, 1.5), ('D4', 5.5, 0.5), ('Bb3', 6, 2), ('C4', 8, 1), ('E4', 9, 1),
            ('G4', 10, 2), ('E4', 12, 2), ('C#4', 14, 2), ('A3', 16, 1), ('D4', 17, 1.5), ('E4', 18.5, 0.5), ('F4', 19, 1), ('D4', 20, 4)]
P1, P2 = ['Dm', 'Bb', 'F', 'C'], ['Dm', 'Gm', 'Bb', 'A']
MENU_FORM = [  # name, chords (one per bar), layers, dynamics at the first and last bar
    ('intro', P1, {'pad', 'ost', 'call_in', 'timroll'}, 0.5, 0.8),
    ('a1', P1 * 2, {'pad', 'ost', 'pulse', 'low', 'taiko', 'tim', 'cym', 'boom', 'fill'}, 0.82, 0.86),
    ('a2', P1 * 2, {'pad', 'ost', 'pulse', 'low', 'taiko', 'tim', 'cym', 'boom', 'themeA', 'choir', 'fill', 'roll'}, 0.86, 0.92),
    ('b', P2 * 2, {'pad', 'ost', 'pulse', 'low', 'taiko', 'tim', 'cym', 'boom', 'snare', 'themeB', 'trem', 'swell'}, 0.94, 1.0),
    ('brk', ['Bb', 'C', 'Dm', 'A'], {'pad', 'pizz', 'themeBrk', 'gl', 'boom', 'timroll', 'roll', 'swell_end'}, 0.62, 0.7),
    ('a3', P1 * 2, {'pad', 'ost', 'pulse', 'low', 'taiko', 'tim', 'cym', 'boom', 'snare', 'themeA', 'themeAhi', 'choir', 'counter', 'glacc'}, 1.0, 1.0),
    ('out', ['Gm', 'Bb', 'C', 'A', 'Dm', 'Bb', 'Gm', 'A'], {'pad', 'ost', 'pulse', 'low', 'taiko', 'tim', 'call_out'}, 0.9, 0.5),
]
MENU_BARS = sum(len(f[1]) for f in MENU_FORM)


def menu_once(s, m, b0):
    """One pass of the theme from beat b0: MIDI events into s, synthesized drums into m"""
    bt = s.beat; at = b0
    for name, prog, L, d0, d1 in MENU_FORM:
        nb = len(prog); sec = at
        for i, c in enumerate(prog):
            r, t, f = CHORDS[c]; b = sec + 4 * i
            dyn = d0 + (d1 - d0) * i / max(1, nb - 1)
            last = i == nb - 1
            fade = name == 'out' and i >= 6  # the last two bars of the outro hand back to the intro: no drums, no low brass
            V = lambda v: v * dyn  # noqa: E731
            if 'pad' in L:
                s.notes('pad', [up(r, 'A2'), up(f, up(r, 'A2')), up(t, up(r, 'A2') + 12)], b, 3.9, V(84))
                s.note('cb', up(r, 'C2'), b, 3.9, V(96))
            if 'ost' in L:
                R = up(r, 'A2'); pat = [R, R, up(f, R), R, R + 12, R, up(f, R), up(t, R)]
                for k in range(16):
                    acc = k % 4 == 0
                    s.note('str', pat[k % 8], b + k / 4, 0.2, V(108 if acc else 80), jit=0.006)
                    m.add(C.stacc(C.hz('A4') * 2 ** ((pat[k % 8] - 69) / 12), 0.55 * dyn * (1.0 if acc else 0.65)), (b + k / 4) * bt, -0.35 + 0.7 * (k % 2))
            if 'pizz' in L:
                R = up(r, 'A2'); pat = [R, up(f, R), R + 12, up(t, R + 12), R + 12, up(f, R)]
                for k in range(8): s.note('str', pat[k % 6], b + k / 2, 0.4, V(100), jit=0.006)
            if 'pulse' in L and not fade:
                for k in range(8): s.note('sb', up(r, 'C2'), b + k / 2, 0.42, V(100 if k % 2 == 0 else 70), jit=0.003)
            if 'low' in L and not fade:
                s.notes('tb', [up(r, 'A2'), up(f, up(r, 'A2'))], b, 3.8, V(78)); s.note('tu', up(r, 'A1'), b, 3.8, V(84))
            if 'taiko' in L and not fade:
                hits = [(0, 1.0), (1.5, 0.7), (2, 0.9), (3, 0.6), (3.5, 0.75)] + ([(2.75, 0.5), (3.75, 0.6)] if name in ('b', 'a3') else [])
                for h, v in hits: m.add(C.taiko(v * 0.6 * dyn), (b + h) * bt + rng.normal(0, 0.003))
            if 'tim' in L and not fade:
                s.note('tim', up(r, 'D2'), b, 0.6, V(112)); s.note('tim', up(r, 'D2'), b + 2.5, 0.4, V(80)); s.note('tim', up(f, 'D2'), b + 3, 0.6, V(92))
            if 'cym' in L and i % 4 == 0:
                s.note('dr', 49 if i % 8 == 0 else 57, b, 2, V(112))
            if 'boom' in L and i == 0: m.add(C.boom(0.5 * dyn, 2.4), b * bt)
            if 'snare' in L:
                if i % 4 == 3: kit_roll(s, b + 3, b + 4, 50, 110, rate=8)
                for h, v in ((1, 104), (1.75, 46), (2.5, 52), (3, 104), (3.25, 46), (3.5, 56)) if i % 4 != 3 else ((1, 104), (1.75, 46), (2.5, 52)):
                    s.note('dr', 38, b + h, 0.1, V(v), jit=0.004)
            if 'choir' in L:
                s.notes('ch', [up(r, 'D3'), up(t, 'F3'), up(f, 'A3')], b, 3.9, V(78 if name == 'a2' else 96))
            if 'trem' in L: s.notes('trm', [up(t, 'D5'), up(f, 'D5')], b, 3.9, V(70))
            if 'counter' in L: s.note('trm', COUNTER[i], b, 3.9, V(92))
            if 'gl' in L:
                R = up(r, 'D5'); arp = [R, up(f, R), up(t, R + 12), R + 12, up(f, R + 12), up(t, R + 12), R + 12, up(f, R)]
                for k, n in enumerate(arp): s.note('gl', n, b + k / 2, 0.8, V(72 if k % 2 == 0 else 58), jit=0.004)
            if 'glacc' in L and i % 2 == 0: s.notes('gl', [up(r, 'D6'), up(f, 'D6')], b, 1.5, V(80))
            if 'timroll' in L and last: tim_roll(s, up(r, 'D2'), b, b + 4, 30, 112, rate=8)
            if 'roll' in L and last: kit_roll(s, b + 2, b + 4, 30, 116, rate=8)
            if 'fill' in L and last and name != 'a2':
                for k, n in enumerate([50, 48, 47, 45, 43, 41, 43, 41]): s.note('dr', n, b + 2 + k / 4, 0.2, V(96 + 3 * k), jit=0.004)
        for key, tune, part, shift, vel in (('themeA', THEME_A, 'hn', 0, 104), ('themeAhi', THEME_A, 'tp', 12, 104),
                                            ('themeB', THEME_B, 'tp', 0, 108), ('themeBrk', THEME_BRK, 'fl', 0, 92),
                                            ('call_in', CALL_IN, 'hn', 0, 84), ('call_out', CALL_OUT, 'hn', 0, 92)):
            if key not in L: continue
            for n, b, d in tune:
                s.note(part, midi(n) + shift, sec + b, d * 0.96, vel * (d0 + (d1 - d0) * b / (4 * nb)))
                if key == 'themeB': s.note('hn', midi(n) - 12, sec + b, d * 0.96, 88)
                if key == 'themeBrk': s.note('ob', midi(n) - 12, sec + b, d * 0.96, 66)
                if key == 'themeAhi': s.note('brs', midi(n), sec + b, d * 0.96, 92)
        if 'pizz' in L: s.program('str', sec - 0.01, 45); s.program('str', sec + 4 * nb - 0.02, 48)
        if 'swell' in L: m.add(C.crash(0.5, 0.3, swell=4 * bt), (sec + 4 * nb - 4) * bt)
        if 'swell_end' in L: m.add(C.crash(0.6, 0.3, swell=2 * bt), (sec + 4 * nb - 2) * bt)
        if name == 'b':  # out of the chorus: one hit on the first beat of the break, then quiet
            s.note('dr', 49, sec + 4 * nb, 2, 110); s.note('tim', 'D2', sec + 4 * nb, 0.6, 116)
        at += 4 * nb
    return at


def menu():
    """Three identical passes rendered back to back (same random draws), the middle one kept: it starts with the reverb
    tail of the pass before and ends where the same music starts again, so the file loops without a seam"""
    global rng
    s = orchestra(100); bt = s.beat
    loop = 4 * MENU_BARS; m = C.Mix(3 * loop * bt + 6)
    for k in range(3):
        rng, C.rng = np.random.default_rng(11), np.random.default_rng(7)
        menu_once(s, m, k * loop)
    x = bus(render(s, 5.0), m.b, 0.6, low_cut=0.55)
    L = int(round(loop * bt * SR))
    return C.master(x[:, L:2 * L], peak=0.86, drive=0.85)


def loud(x, target, ceil):
    """compose.loud with a lower ceiling: MP3 decoding overshoots dense mixes by 1 dB or more"""
    for _ in range(4):
        x = x * 10 ** ((target - C.lufs(x)) / 20)
        if np.abs(x).max() > ceil: x = np.tanh(x / ceil) * ceil
    return x


PIECES = {
    'rankup': lambda: C.write_mp3(rankup(), os.path.join(ROOT, 'assets', 'rankup.mp3'), target=-15.9),
    'victory': lambda: _fin('m_victory', victory(), -13.8),
    'defeat': lambda: _fin('m_defeat', defeat(), -18.4),
    'menu': lambda: C.write_mp3(loud(menu(), C.MENU_LUFS, 0.75), os.path.join(ROOT, 'assets', 'music', 'menu-theme.mp3'), q=5),
}


def meta():
    """assets/sfx/fin/meta.json entries of the end-of-match tracks, measured on the MP3 files in place (after a swap)"""
    for sid in ('m_victory', 'm_defeat'):
        p = os.path.join(ROOT, 'assets', 'sfx', 'fin', sid + '.mp3')
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
        x = np.frombuffer(raw, np.float32).reshape(-1, 2).T.astype(np.float64)
        C.sfx_meta('fin', sid, x); print(f'{sid}: {x.shape[1] / SR:.2f} s')


def _fin(sid, x, target):
    x = loud(x, target, 0.8); C.write_mp3(x, os.path.join(ROOT, 'assets', 'sfx', 'fin', sid + '.mp3'), q=4); C.sfx_meta('fin', sid, x)


if __name__ == '__main__':
    if '--fetch' in sys.argv: fetch(); sys.exit()
    if '--meta' in sys.argv: meta(); sys.exit()
    for k in sys.argv[1:] or list(PIECES): PIECES[k]()
