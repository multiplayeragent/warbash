""""Weapons" family: shots by the player and other shooters, distant shots, silenced shots and impulse responses
of the game's general reverb (weapons pack).

Sources: raw "Master Tracks" tracks of The Free Firearm Sound Library (CC0, 192 kHz/24-bit stereo, outdoor shooting
range), one track per microphone position:
- "behind shooter" (coincident pair behind the shooter): player shots (pov), sum of the two channels;
- "near distance, front of shooter" (spaced pair, in front of the shooter): shots of a nearby enemy (near), a single channel
  to avoid comb filtering from the sum;
- "far distance, front of shooter": distant shots (far), a single channel (bullet crack then detonation).
The near "Prepared SFX" of the same repo are these same takes boosted by 20 dB and clipped on the detonation (clipping
plateaus, raised floor): we start from the raw tracks and do the equivalent here, with a limiter.
Impulse responses: Conner's Impulse Response Library (MIT license, notice to keep: see SOURCES).

Game weapons without a real recording (FAMAS, MP7, UMP-45, Vector, Barrett, AA-12, Glock, Desert Eagle): takes close to
the FFSL, transposed (resampling from the 192 kHz track), tail shortened, stronger low layer for the
big calibers; the silenced carbine shot gets the bolt of an AR-15: no sound is synthesized.

Chain of a player shot: high-pass 45 Hz, low shelf, low layer taken from the same shot (transposed one octave
lower, low-passed, kept 50 to 140 ms: the "punch"), look-ahead limiter that shaves the tip of the attack by
6 dB, parallel compression limited to the first 150 ms (the body of the shot, which the game makes audible in bursts),
oversampled soft saturation, outdoor tail kept (high-pass 80 Hz against wind noise, dry range echoes
softened), end cut below -75 dB or faded, peak at -1 dBFS. Shot times come from the analysis of the
tracks (per-channel envelope and spectrogram)."""
import urllib.parse
import numpy as np
import common as C
from common import SR

PACK = 'weaponry'

SOURCES = {
    'ffsl_shots': {
        'naming': 'The Free Firearm Sound Library ("Master Tracks" shooting tracks)',
        'creator': 'Ben Jaszczak et al. (Still North Media)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/buddingmonkey/FreeFirearmsSFXLibrary',
        'proof': "repo LICENSE: full text \"CC0 1.0 Universal\"; OpenGameArt page: \"The team holds CC0 "
                  "NO RIGHTS RESERVED for this library, and it may be used without royalty or credit for any "
                  "application, personal or professional\"",
    },
    'conner_ir': {
        'naming': "Conner's Impulse Response Library (impulse responses)",
        'creator': 'Conner (itsmusician)',
        'licence': 'MIT',
        'url': 'https://github.com/itsmusician/IR-Library',
        'proof': "README: \"A public library of impulse responses for anyone to use freely under the MIT License\"; "
                  "License.md: \"Copyright (c) 2022 Conner\", full MIT text",
        'attribution': "Impulse responses: Conner's Impulse Response Library "
                       "(https://github.com/itsmusician/IR-Library), Copyright (c) 2022 Conner, licence MIT",
        'notice': (
            "Copyright (c) 2022 Conner\n\nPermission is hereby granted, free of charge, to any person obtaining a "
            "copy of this software and associated documentation files (the \"Software\"), to deal in the Software "
            "without restriction, including without limitation the rights to use, copy, modify, merge, publish, "
            "distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the "
            "Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice "
            "and this permission notice shall be included in all copies or substantial portions of the "
            "Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, "
            "INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE "
            "AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, "
            "DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT "
            "OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE."
        ),
    },
}

# ---------------------------------------------------------------------------------------------------------------------
# Source files: local path under assets_src/sfx/src -> direct download URL.
FILES = {}
FFSL = 'buddingmonkey/FreeFirearmsSFXLibrary'


def _url(depot, branch_snd, pathway):
    return f'https://raw.githubusercontent.com/{depot}/{branch_snd}/' + urllib.parse.quote(pathway)


def _ffsl(code):            # 'AR-15/D_27' -> ffsl/AR-15/D_27.wav (same folder as the handling family)
    rel = f'ffsl/{code}.wav'
    FILES[rel] = _url(FFSL, 'main', f'Master Tracks/{code}.wav')
    return rel


def _ir(pathway):            # path in the IR-Library repo
    rel = f'conner-ir/{pathway}'
    FILES[rel] = _url('itsmusician/IR-Library', 'main', pathway)
    return rel


# FFSL folders
AR, AK, M17, M45, PPSH = 'AR-15', 'AK-47', '1917', 'Carl Gustav M45_Swedish K', 'PPSh'
MOS, TIK, NOVA, DALY, M12 = 'Mosin Nagant', 'Tikka', 'Nova', 'Charles Daly', 'Model 12'
MOSS, PPQ, BERSA, COLT, SW = 'Mossberg', 'Walther PPQ', 'Bersa', '1911', 'Smith & Wesson 642'
SAV = 'Savage 10 .300 Blackout'

# ---------------------------------------------------------------------------------------------------------------------
# Takes: (FFSL track, attack time in s, channel). Channel None: L+R sum (coincident pair "behind
# shooter"); 0 (left) or 1 (right): a single channel, the one with the lowest floor.
# Banks: settings for the player shot (pov) and the nearby enemy (near); st: transposition in semitones, one value
# per variant; duration_s: maximum duration (s); queue: (start, time constant) of an exponential shortening
# of the tail (absent: natural tail); lows: (frequency, gain dB) of the low shelf; trebles: same for the top;
# hp: high-pass (Hz); low: level (dB) of the low layer (low_f: its cutoff in Hz and its window in s);
# lim: dB shaved off the tip; bodypart: level (dB) of the parallel compression.
BANKS = {
    # M4A1: AR-15 5.56
    'rifle': dict(
        pov=[(AR + '/D_29', 0.633, None), (AR + '/D_27', 0.503, None), (AR + '/D_27', 10.163, None)],
        near=[(AR + '/D_32', 0.704, 1), (AR + '/D_31', 7.173, 1)],
        st=[0, 0.2, -0.2], lows=(115, 3), low=-22, lim=6, bodypart=-16, duration_s=1.6),
    # FAMAS: the other AR-15 takes, drier and brighter
    'famas': dict(
        pov=[(AR + '/D_29', 5.577, None), (AR + '/D_27', 4.787, None), (AR + '/D_27', 0.503, None)],
        near=[(AR + '/D_32', 5.647, 1), (AR + '/D_31', 12.548, 0)],
        st=[1.2, 1.6, 2.0], lows=(130, 2), trebles=(4500, 2), low=-25, lim=6, bodypart=-16, duration_s=1.2,
        queue=(0.16, 0.30)),
    # AK-47: AK-47 7.62x39
    'ak': dict(
        pov=[(AK + '/C_42', 0.727, None), (AK + '/C_39', 0.538, None), (AK + '/C_42', 6.787, None)],
        near=[(AK + '/C_28', 1.090, 0), (AK + '/C_28', 7.149, 1)],
        st=[0, -0.2, 0.2], lows=(110, 3), low=-21, lim=6, bodypart=-16, duration_s=1.6),
    # SCAR-H 7.62x51: Springfield 1917 .30-06, heavier
    'battle': dict(
        pov=[(M17 + '/B_18', 2.421, None), (M17 + '/B_17', 1.492, None), (M17 + '/B_18', 8.919, None)],
        near=[(M17 + '/B_24', 1.308, 1), (M17 + '/B_24', 6.731, 0)],
        st=[-0.3, -0.5, -0.1], lows=(100, 4), low=-28, lim=6, bodypart=-16, duration_s=1.6),
    # MP5: Carl Gustav M45 9 mm
    'smg': dict(
        pov=[(M45 + '/G_26', 0.280, None), (M45 + '/G_26', 3.069, None), (M45 + '/G_26', 6.921, None)],
        near=[(M45 + '/G_31', 0.310, 0), (M45 + '/G_31', 3.501, 1)],
        st=[0, 0.2, -0.2], lows=(120, 3), low=-18, lim=6, bodypart=-16, duration_s=1.3, queue=(0.22, 0.5)),
    # MP7: M45 transposed up, very dry
    'mp7': dict(
        pov=[(M45 + '/G_32', 0.306, None), (M45 + '/G_32', 3.497, None), (M45 + '/G_32', 6.724, None)],
        near=[(M45 + '/G_25', 0.190, 1), (M45 + '/G_25', 2.980, 0)],
        st=[2.0, 2.3, 1.7], hp=70, lows=(140, 1), trebles=(5000, 2), low=-20, lim=6, bodypart=-16, duration_s=0.9,
        queue=(0.12, 0.20)),
    # UMP-45: PPSh, a bit lower and heavier
    'smg45': dict(
        pov=[(PPSH + '/P_31', 0.692, None), (PPSH + '/P_31', 4.110, None), (PPSH + '/P_25', 1.600, None)],
        near=[(PPSH + '/P_30', 0.969, 0), (PPSH + '/P_30', 4.387, 1)],
        st=[-1.0, -1.2, -0.8], hp=60, lows=(105, 3), low=-17, lim=6, bodypart=-16, duration_s=1.3, queue=(0.22, 0.5)),
    # Vector .45: tighter variant of smg45
    'vector': dict(
        pov=[(PPSH + '/P_25', 5.190, None), (PPSH + '/P_31', 7.965, None), (PPSH + '/P_25', 12.274, None)],
        near=[(PPSH + '/P_30', 8.243, 0), (PPSH + '/P_30', 11.421, 1)],
        st=[-0.6, -0.4, -0.8], hp=60, lows=(110, 3), low=-24, lim=6, bodypart=-16, duration_s=1.0, queue=(0.12, 0.25)),
    # Dragunov SVD 7.62x54R: Mosin-Nagant
    'dmr': dict(
        pov=[(MOS + '/M_22', 1.181, None), (MOS + '/M_20', 1.838, None), (MOS + '/M_22', 16.175, None)],
        near=[(MOS + '/M_21', 1.034, 0), (MOS + '/M_21', 16.028, 1)],
        st=[0, -0.2, 0.2], lows=(105, 3), low=-20, lim=6, bodypart=-16, duration_s=1.6),
    # L96A1: Tikka T3 .30-06
    'sniper': dict(
        pov=[(TIK + '/W_28', 0.727, None), (TIK + '/W_28', 11.683, None), (TIK + '/W_26', 0.855, None)],
        near=[(TIK + '/W_29', 0.577, 1), (TIK + '/W_29', 11.533, 0)],
        st=[0, -0.2, 0.1], lows=(100, 3), low=-28, lim=6, bodypart=-17, duration_s=1.6),
    # Barrett M82 .50: Mosin-Nagant transposed down, low layer, long tail
    'sniper50': dict(
        pov=[(MOS + '/M_22', 8.256, None), (MOS + '/M_20', 10.609, None), (MOS + '/M_22', 31.658, None)],
        near=[(MOS + '/M_21', 8.108, 0), (MOS + '/M_21', 31.510, 1)],
        st=[-3.5, -3.2, -3.8], hp=35, lows=(80, 3), low=-14, low_f=(140, 0.12, 0.35), lim=7, bodypart=-15,
        duration_s=2.4),
    # M1014 / 870: Benelli Nova and Charles Daly 12 gauge
    'shotgun': dict(
        pov=[(NOVA + '/O_18', 1.481, None), (NOVA + '/O_18', 21.605, None), (DALY + '/H_18', 5.904, None)],
        near=[(NOVA + '/O_21', 17.542, 0), (DALY + '/H_21', 0.464, 1)],
        st=[0, -0.2, 0], lows=(95, 4), low=-19, lim=6, bodypart=-16, duration_s=1.6),
    # AA-12: Winchester Model 12 and Mossberg 190, shorter tail
    'aa12': dict(
        pov=[(M12 + '/K_19', 0.564, None), (M12 + '/K_19', 7.920, None), (MOSS + '/N_27', 1.392, None)],
        near=[(M12 + '/K_22', 0.842, 0), (M12 + '/K_22', 7.445, 1)],
        st=[0.3, 0.5, 0.2], lows=(100, 3), low=-21, lim=6, bodypart=-16, duration_s=1.0, queue=(0.16, 0.30)),
    # M9: Walther PPQ 9 mm
    'pistol': dict(
        pov=[(PPQ + '/X_40', 1.756, None), (PPQ + '/X_38', 0.914, None), (PPQ + '/X_40', 5.656, None)],
        near=[(PPQ + '/X_39', 1.407, 1), (PPQ + '/X_39', 10.660, 0)],
        st=[0, 0.2, -0.2], lows=(130, 3), low=-20, lim=6, bodypart=-16, duration_s=1.4),
    # Glock 18: Bersa .380, drier, shorter tail
    'glock': dict(
        pov=[(BERSA + '/F_45', 0.480, None), (BERSA + '/F_44', 5.971, None), (BERSA + '/F_45', 4.555, None)],
        near=[(BERSA + '/F_47', 0.334, 1), (BERSA + '/F_47', 4.410, 0)],
        st=[0, 0.2, -0.2], lows=(140, 2), low=-24, lim=6, bodypart=-16, duration_s=0.9, queue=(0.12, 0.25)),
    # USP .45: 1911 .45 ACP
    'pistol45': dict(
        pov=[(COLT + '/A_36', 1.237, None), (COLT + '/A_35', 1.545, None), (COLT + '/A_35', 5.456, None)],
        near=[(COLT + '/A_42', 0.941, 1), (COLT + '/A_41', 5.056, 1)],
        st=[0, -0.2, 0.2], lows=(115, 3), low=-25, lim=6, bodypart=-16, duration_s=1.4),
    # Desert Eagle .50 AE: S&W 642 .38 revolver transposed down, low layer
    'pistol50': dict(
        pov=[(SW + '/V_26', 0.743, None), (SW + '/V_24', 0.818, None), (SW + '/V_26', 6.157, None)],
        near=[(SW + '/V_27', 0.805, 0), (SW + '/V_27', 6.219, 0)],
        st=[-2.5, -2.8, -2.2], hp=40, lows=(90, 3), low=-16, low_f=(150, 0.08, 0.25), lim=7, bodypart=-15,
        duration_s=1.6),
}

# Distant shots per class: (track, time, channel), 2 variants, 2.4 s at most
DISTANT = {
    'rifle': [(AR + '/D_25', 0.745, 0), (AR + '/D_26', 0.417, 1)],
    'smg': [(M45 + '/G_13', 11.940, 0), (PPSH + '/P_12', 1.273, 0)],
    'sniper': [(TIK + '/W_25', 0.710, 0), (MOS + '/M_23', 0.976, 0)],
    'shotgun': [(NOVA + '/O_15', 1.092, 1), (NOVA + '/O_15', 7.417, 0)],
    'pistol': [(COLT + '/A_40', 0.985, 1), (PPQ + '/X_33', 0.932, 0)],
}

# Silenced shots: (track, instant, channel)
SIL = {
    'g_sup_pistol_pov': [(PPQ + '/X_42', 4.958, None), (PPQ + '/X_42', 9.528, None), (PPQ + '/X_46', 0.981, None)],
    'g_sup_rifle_pov': [(SAV + '/T_28', 0.685, 1), (SAV + '/T_28', 3.507, 1), (SAV + '/T_30', 0.754, 1)],
    'g_sup_near': [(SAV + '/T_29', 0.628, 1), (PPQ + '/X_43', 10.369, 1)],
    'g_sup_far': [(SAV + '/T_21', 1.243, 0), (PPQ + '/X_35', 6.976, 0)],
}

BOLT_BACK = _ffsl(AR + '/D_13')  # AR-15 bolt released (mechanics of the silenced shot)
IR_OUT = _ir('Outdoors/Commercial/Loading Docks/Flat Loading Dock.wav')
IR_IN = _ir('Rooms/Commercial/Parking Garages/Firenze Parking Garage.wav')

for _b in BANKS.values():
    for _p in _b['pov'] + _b['near']: _ffsl(_p[0])
for _l in list(DISTANT.values()) + list(SIL.values()):
    for _p in _l: _ffsl(_p[0])


# ---------------------------------------------------------------------------------------------------------------------
# Processing tools

def dbg(d):
    return 10 ** (d / 20)


def af(x, *filters):
    """ffmpeg filter chain (empty elements are ignored)."""
    ch = ','.join(f for f in filters if f)
    return C.ff(x, ch) if ch else x


def hp(f):
    return f'highpass=f={f}:poles=2,highpass=f={f}:poles=2'


def lp(f):
    return f'lowpass=f={f}:poles=2,lowpass=f={f}:poles=2'


def recording(code, t, channel, duration_s, st=0.0, before=0.03):
    """Excerpt of an FFSL track starting before seconds before the attack t, transposed by st semitones.
    The transposition is done at decoding: the 192 kHz track is resampled to SR / r then played at SR."""
    r = 2 ** (st / 12)
    sr = int(round(SR / r))
    x = C.load(C.SRC / f'ffsl/{code}.wav', sr=sr, mono=False, start=max(0.0, t - before), dur=(duration_s + before) * r + 0.05)
    return x.mean(axis=1) if channel is None else x[:, channel]


def limiter(x, reduction, attack_time=0.0006, release_t=0.015):
    """Look-ahead limiter: the peak is lowered by reduction dB, smoothed gain (attack attack_time s, release release_t s)."""
    a = np.abs(x)
    cutpoint = a.max() * dbg(-reduction)
    g = np.minimum(1.0, cutpoint / np.maximum(a, 1e-12))
    L = max(1, int(attack_time * SR))
    gh = np.lib.stride_tricks.sliding_window_view(np.concatenate([g, np.ones(L)]), L + 1).min(axis=1)[:len(x)]
    k = 1 - np.exp(-1 / (release_t * SR))
    out = np.empty_like(gh)
    prev = 1.0
    for i, v in enumerate(gh.tolist()):
        prev = v if v < prev else prev + (1 - prev) * k
        out[i] = prev
    c = np.cumsum(np.concatenate([np.ones(L), out]))
    smoothed = (c[L:] - c[:-L]) / L
    return x * np.minimum(smoothed, out)


def envelope(x, attack_time=0.0005, release_t=0.002):
    """RMS envelope (quadratic detector with exponential attack and release)."""
    a2 = x * x
    ka, kr = np.exp(-1 / (attack_time * SR)), np.exp(-1 / (release_t * SR))
    env = np.empty_like(a2)
    prev = 0.0
    for i, v in enumerate(a2.tolist()):
        prev = v + (prev - v) * (ka if v > prev else kr)
        env[i] = prev
    return np.sqrt(env)


def compressed(x, cutpoint, ratio=4.0, release_t=0.002):
    """Fast compressor: cutpoint in dB under the envelope peak."""
    env = envelope(x, 0.0005, release_t)
    s = C.peak(env) * dbg(cutpoint)
    return x * np.where(env > s, (np.maximum(env, 1e-12) / s) ** (1 / ratio - 1), 1.0)


def _over(x, f=4):
    n = len(x); m = n + 4096
    X = np.fft.rfft(np.concatenate([x, np.zeros(m - n)]))
    Y = np.zeros(m * f // 2 + 1, dtype=complex); Y[:len(X)] = X
    return np.fft.irfft(Y, m * f)[:n * f] * f


def _under(y, f=4):
    n = len(y) // f; m = n + 4096
    Y = np.fft.rfft(np.concatenate([y, np.zeros(m * f - len(y))]))
    X = Y[:m // 2 + 1].copy(); X[-1] = 0
    return np.fft.irfft(X, m)[:n] / f


def saturates(x, drive=1.4):
    """Soft saturation (hyperbolic tangent) oversampled 4 times, peak gain preserved."""
    if drive <= 0: return x
    p = C.peak(x)
    return _under(np.tanh(_over(x / p) * drive) / np.tanh(drive)) * p


def window_fn(n, t1, t2):
    """1 up to t1 s, cosine fall down to t2 s, 0 after that."""
    w = np.zeros(n)
    a, b = min(n, int(t1 * SR)), min(n, int(t2 * SR))
    w[:a] = 1
    if b > a: w[a:b] = 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, b - a))
    return w


def bodypart(x, levelling, t1=0.07, t2=0.16):
    """Parallel compression limited to the start of the shot: a heavily compressed copy (release 2 ms), at level levelling
    dB under the peak, is added during the first t1 seconds then fades out until t2: the body of the shot thickens,
    the tail stays natural."""
    c = compressed(x, -45, 4.0, 0.002)
    c = c / C.peak(c) * C.peak(x) * dbg(levelling)
    return x + c * window_fn(len(x), t1, t2)


def softens(x, afterwards=0.2, leeway=6.0):
    """Softens isolated transients in the tail (bullet impact on a target, dry echo off a range wall):
    after afterwards s, the envelope (1 ms windows) is brought down to leeway dB above its 60 ms median."""
    w = 48
    k = len(x) // w
    if k < 80: return x
    e = np.sqrt((x[:k * w].reshape(k, w) ** 2).mean(axis=1)) + 1e-12
    h = 30
    med = np.median(np.lib.stride_tricks.sliding_window_view(np.pad(e, h, mode='edge'), 2 * h + 1), axis=1)
    g = np.minimum(1.0, med * dbg(leeway) / e)
    g[:int(afterwards * SR / w)] = 1.0
    g = np.lib.stride_tricks.sliding_window_view(np.pad(g, 3, mode='edge'), 7).min(axis=1)
    g = np.convolve(np.pad(g, 3, mode='edge'), np.ones(7) / 7, mode='valid')
    gs = np.interp(np.arange(len(x)), np.arange(k) * w + w / 2, g)
    return x * gs


def shortens(x, t0, tau):
    """Shortens the tail: exponential decay (constant tau s) added after t0 s."""
    t = np.arange(len(x)) / SR
    return x * np.where(t < t0, 1.0, np.exp(-(t - t0) / tau))


def low_layer(code, t, channel, duration_s, st, cutoff=170, t1=0.05, t2=0.14):
    """Low layer taken from the same shot: transposed one octave lower than st (twice as slow: the low blast
    of the detonation lasts twice as long), low-passed, kept for t1 s then faded out until t2 s."""
    x = recording(code, t, channel, duration_s, st - 12)
    x = af(x, hp(45), lp(cutoff))
    x = C.trim(x, -40, 0.0015)
    return x / C.peak(x) * window_fn(len(x), t1, t2)


def adds(x, y, g):
    """x + y * g (in dB), y truncated or padded to the length of x."""
    z = np.zeros(len(x))
    m = min(len(x), len(y))
    z[:m] = y[:m]
    return x + z * dbg(g)


def startpoint(x, cutpoint=-40.0):
    """Cuts the head: starts 1.5 ms before the first sample at cutpoint dB under the peak."""
    return C.trim(x, cutpoint, 0.0015)


ENTRIES = []


def master_take(sid, x, dmax, fout, filepath, detail, source='ffsl_shots', crest_of=-1.0):
    """Finishes a master: cuts the end once it falls below -75 dB (otherwise at dmax seconds, with a fade-out of fout s),
    1 ms fade-in, peak, writing, credit."""
    x = np.asarray(x, dtype=np.float64)
    end = C.tail_end(x, -75.0)
    if end < int(dmax * SR):
        x, fout = x[:end], min(fout, 0.12)
    else:
        x = x[:int(dmax * SR)]
    x = C.fade(x, 0.001, min(fout, len(x) / SR * 0.6), 2.0)
    x = C.norm(x, crest_of)
    C.save_master(PACK, sid, x)
    ENTRIES.append(C.credit(sid, PACK, source, filepath, detail))
    return x


def queue_hp(x, f=80, t1=0.12, t2=0.2):
    """High-pass f Hz on the tail only (crossfade from t1 to t2 s): the low rumble of wind and range
    under the tail disappears, the low end of the detonation stays."""
    h = af(x, hp(f))
    w = window_fn(len(x), t1, t2)
    return x * w + h * (1 - w)


def s(v, n=3):
    """Number written for the credits."""
    return f'{v:.{n}f}'.rstrip('0').rstrip('.') if isinstance(v, float) else str(v)


def take_name(p):
    code, t, channel = p
    channel_name = 'L+R sum' if channel is None else ('left channel' if channel == 0 else 'right channel')
    return f'Master Tracks/{code}.wav', f'shot at {s(t)} s ({channel_name})'


# ---------------------------------------------------------------------------------------------------------------------
# Shots by the player and nearby enemies

NEAR_LIM = 15  # dB shaved off the tip of a shot seen from the front
NEAR_QUEUE = 6  # dB added to its tail (after 0.16 s)


def shot_pov(b, p, st):
    """Player shot: low reinforcement, low layer, shaved tip, thickened body, soft saturation, tail kept."""
    code, t, channel = p
    x = recording(code, t, channel, b['duration_s'] + 0.1, st)
    f, g = b['lows']
    filters = [hp(b.get('hp', 45)), f'lowshelf=f={f}:g={g}:t=q:w=0.7']
    if 'trebles' in b:
        filters.append(f'highshelf=f={b["trebles"][0]}:g={b["trebles"][1]}:t=q:w=0.7')
    x = startpoint(af(x, *filters))
    x = adds(x / C.peak(x), low_layer(code, t, channel, 0.6, st, *b.get('low_f', (170, 0.05, 0.14))), b['low'])
    x = limiter(x / C.peak(x), b['lim'])
    x = bodypart(x, b['bodypart'])
    x = saturates(x / C.peak(x), 1.3)
    x = softens(queue_hp(x))
    if b.get('queue'):
        x = shortens(x, *b['queue'])
    return x


def shot_near(b, p, st):
    """Shot of a nearby enemy, seen from the front: single-channel "near" take. Seen from the front, the detonation is a very
    brief crack (the body and the tail are 20 to 40 dB lower): the tip is shaved harder than for the pov (this is
    also what the FFSL "Prepared SFX" do, by clipping), then the tail is raised by a few dB.
    Less low end than the pov, no saturation."""
    code, t, channel = p
    x = recording(code, t, channel, b['duration_s'] + 0.1, st)
    f, g = b['lows']
    x = startpoint(af(x, hp(max(45, b.get('hp', 45))), f'lowshelf=f={f}:g={g / 2:.1f}:t=q:w=0.7'))
    x = adds(x / C.peak(x), low_layer(code, t, channel, 0.6, st, *b.get('low_f', (170, 0.05, 0.14))),
               b['low'] - 4)
    x = limiter(x / C.peak(x), NEAR_LIM)
    x = bodypart(x, -14)
    x = x * (1 + (dbg(NEAR_QUEUE) - 1) * (1 - window_fn(len(x), 0.08, 0.16)))
    x = softens(queue_hp(x))
    if b.get('queue'):
        x = shortens(x, *b['queue'])
    return x


def shot_list(exclusively=None):
    for bank_name, b in BANKS.items():
        if exclusively and bank_name not in exclusively: continue
        presets = f"high-pass {b.get('hp', 45)} Hz, low shelf {b['lows'][0]} Hz {b['lows'][1]:+d} dB"
        if 'trebles' in b: presets += f", high shelf {b['trebles'][0]} Hz {b['trebles'][1]:+d} dB"
        for i, p in enumerate(b['pov']):
            st = b['st'][i]
            x = shot_pov(b, p, st)
            filepath, what_for = take_name(p)
            det = f"{what_for}, {s(b['duration_s'], 2)} s; "
            if st: det += f"transposed by {s(float(st), 1)} semitone(s); "
            det += (presets + f", low layer of the same shot one octave lower ({b['low']} dB), tip shaved by "
                    f"{b['lim']} dB, parallel compression of the first 150 ms ({b['bodypart']} dB), soft saturation, "
                    f"tail high-passed at 80 Hz (low wind rumble), dry tail echoes softened")
            if b.get('queue'): det += f", tail shortened after {s(b['queue'][0], 2)} s"
            master_take(f'g_{bank_name}_pov-{i + 1}', x, b['duration_s'], 0.5 if b['duration_s'] > 1.1 else 0.3, filepath,
                   det + ', end cut below -75 dB, fade')
        for i, p in enumerate(b['near']):
            st = b['st'][i]
            x = shot_near(b, p, st)
            filepath, what_for = take_name(p)
            det = f"take 'near distance, front of shooter', {what_for}; "
            if st: det += f"transposed by {s(float(st), 1)} semitone(s); "
            det += (f"high-pass, low shelf, low layer of the same shot ({b['low'] - 4} dB), tip shaved by "
                    f"{NEAR_LIM} dB, parallel compression of the first 150 ms, tail raised by {NEAR_QUEUE} dB "
                    f"and high-passed at 80 Hz, dry tail echoes softened")
            if b.get('queue'): det += ', shortened tail'
            master_take(f'g_{bank_name}_near-{i + 1}', x, min(1.6, b['duration_s'] + 0.2), 0.5, filepath,
                   det + ', end cut below -75 dB, fade')


# ---------------------------------------------------------------------------------------------------------------------
# Distant shots

def distant():
    for weapon_class, takes in DISTANT.items():
        for i, p in enumerate(takes):
            code, t, channel = p
            x = recording(code, t, channel, 2.5)
            x = startpoint(af(x, hp(45)))
            x = limiter(x / C.peak(x), 3, release_t=0.03)
            filepath, what_for = take_name(p)
            master_take(f'g_far_{weapon_class}-{i + 1}', x, 2.4, 0.8, filepath,
                   f"take 'far distance, front of shooter', {what_for}, 2.4 s at most; high-pass 45 Hz, tip "
                   f"shaved by 3 dB, end cut below -75 dB, fade")


# ---------------------------------------------------------------------------------------------------------------------
# Silenced shots: blast and mechanics, without the second transient (bullet impact on the target around 0.26 s)

def suppressed():
    for sid, takes in SIL.items():
        afar = sid.endswith('far')
        for i, p in enumerate(takes):
            code, t, channel = p
            x = recording(code, t, channel, 1.0)
            x = startpoint(af(x, hp(110), 'afftdn=nr=10:nf=-60:tn=1'))
            filepath, what_for = take_name(p)
            det = f"{what_for}; high-pass 110 Hz (wind), light noise reduction"
            if sid == 'g_sup_rifle_pov':
                # bolt-action carbine: no bolt noise; we lay in that of an AR-15 (bolt returning forward)
                m = af(C.load(C.SRC / BOLT_BACK, start=0.352, dur=0.1), hp(250))
                m = C.fade(m, 0.002, 0.03)
                x = adds(x / C.peak(x), np.concatenate([np.zeros(int(0.012 * SR)), m / C.peak(m)]), -9)
                det += ("; mechanics: AR-15 bolt returning forward (Master Tracks/AR-15/D_13.wav, "
                        "0.352-0.452 s, high-pass 250 Hz, -9 dB, 12 ms after the shot)")
            if afar:
                x = softens(x, 0.12)
                det += ", dry echoes and bullet impact softened, fade"
                master_take(f'{sid}-{i + 1}', x, 1.0, 0.4, filepath, det)
            else:
                x = shortens(x, 0.16, 0.03)
                det += ", cut before the bullet impact on the target (0.26 s), fade"
                master_take(f'{sid}-{i + 1}', x, 0.24, 0.06, filepath, det)


# ---------------------------------------------------------------------------------------------------------------------
# Impulse responses (stereo)

RESPONSES = [  # (id, file, place, high-pass in Hz, target reverb time in s or None)
    ('ir_out', IR_OUT, 'loading dock between two buildings (Flat Loading Dock)', 80, None),
    ('ir_in', IR_IN, 'underground concrete parking garage (Firenze Parking Garage)', 60, 1.4),
]


def responses():
    for sid, rel, what_for, cutoff, rt in RESPONSES:
        x = C.load(C.SRC / rel, mono=False)
        m = np.abs(x).max(axis=1)
        i0 = max(0, int(np.argmax(m > m.max() * dbg(-20))) - 12)
        x = af(x[i0:i0 + int(2.0 * SR)], hp(cutoff))
        det = f"{what_for}: start at the direct sound, high-pass {cutoff} Hz (rumble)"
        if rt:
            # reverb time brought down from about 2.2 s to rt s: exponential decay added
            t = np.arange(len(x)) / SR
            x = x * (10 ** (-(60 / rt - 60 / 2.2) * t / 20))[:, None]
            det += f", reverb shortened (about 2.2 s brought down to {s(rt, 1)} s)"
        x = C.fade(x[:int(1.8 * SR)], 0.0, 0.5, 2.0)
        x = C.norm(x, -1.0)
        C.save_master(PACK, sid, x)
        ENTRIES.append(C.credit(sid, PACK, 'conner_ir', rel.split('/', 1)[1],
                                det + ", 1.8 s, fade-out 0.5 s, stereo, peak -1 dBFS"))


def build(exclusively=None):
    """Builds the family's masters (only: list of groups or banks for tests)."""
    ENTRIES.clear()
    shot_list(exclusively)
    if exclusively is None or 'distant' in exclusively: distant()
    if exclusively is None or 'suppressed' in exclusively: suppressed()
    if exclusively is None or 'responses' in exclusively: responses()
    if exclusively is None:
        C.write_credits('weaponry', ENTRIES)
