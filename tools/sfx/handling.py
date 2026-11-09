""""Handling" family: weapon handling, footstep, body and player sound effects (foley pack).

Sources (see SOURCES): raw tracks of The Free Firearm Sound Library for weapon handling, NOX SOUND
"Footsteps Essentials" for footsteps, jumps, landings and rubbing, Hypersomnia for shell casings, magazines and
weapon draws, Kenney and artisticdude for cloth, straps, whooshes and rubbing, a few CC0 Freesound takes
(body, flesh, heart, tinnitus) and the pin by CGEffex (CC BY 4.0, the only real take found).
The missing sounds (grenade spoon, slide, equipment rattle, hits taken) are composed of real
layers: no sound is synthesized. The only "fabricated" touch-up: a harmonics layer (soft saturation of a low
copy) under the heart and the hits taken, so that they stay audible on a phone speaker, which
renders nothing below 150 Hz.

Common processing: mono 48 kHz, high-pass (handling noise, wind), low-pass 16 kHz (see master_take()), cut at
the attack (2 ms kept at most; on the decisive gesture when rubbing precedes it, see net()), fade-out and
fade on any layer cut abruptly, peak at -1 dBFS (variants that are too loud get lowered: align_variants()). The FFSL tracks contain several takes separated by silences: the cut times
below come from their analysis (envelope and spectrogram). Magazine inserted: the decisive clack falls
within the first 50 ms (the game triggers the sound at the moment the magazine engages)."""
import urllib.parse
import numpy as np
import common as C
from common import SR

PACK = 'foley'

SOURCES = {
    'ffsl': {
        'naming': 'The Free Firearm Sound Library ("Master Tracks" handling tracks)',
        'creator': 'Ben Jaszczak et al. (Still North Media)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/buddingmonkey/FreeFirearmsSFXLibrary',
        'proof': "repo LICENSE: full text \"CC0 1.0 Universal\"; OpenGameArt page: \"The team holds CC0 "
                  "NO RIGHTS RESERVED for this library. It may be used without royalty or credit\"",
    },
    'nox': {
        'naming': 'NOX SOUND "Footsteps - Essentials"',
        'creator': 'Nox_Sound',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/helzpont/home4/tree/main/assets/audio/Footsteps_Essentials_NOX_SOUND',
        'proof': "Essentials_Series_README.pdf shipped with the pack: \"All these sounds are under CC0 license.\"",
    },
    'hypersomnia': {
        'naming': 'Hypersomnia (content/sfx folder)',
        'creator': 'TeamHypersomnia',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/TeamHypersomnia/Hypersomnia/tree/master/hypersomnia/content/sfx',
        'proof': "hypersomnia/content/README.md: \"All Hypersomnia game assets (i.e. *everything* under content/) are "
                  "CC0 (Public Domain)\"",
    },
    'kenney': {
        'naming': 'Kenney "RPG Audio", "Foley Sounds", "Impact Sounds"',
        'creator': 'Kenney (www.kenney.nl)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/series-ai/jam-ready-assets',
        'proof': "License.txt of each pack: \"License: (Creative Commons Zero, CC0) http://creativecommons.org/"
                  "publicdomain/zero/1.0/\"",
    },
    'artisticdude': {
        'naming': 'RPG Sound Pack',
        'creator': 'artisticdude (opengameart.org)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/tynatsuhara/swamp.camp/tree/master/static/audio/rpg',
        'proof': "OpenGameArt page https://opengameart.org/content/rpg-sound-pack: \"RPG Sound Pack\" by artisticdude, "
                  "licence CC0",
    },
    'cgeffex': {
        'naming': '"Grenade pin pull" (freesound 93837)',
        'creator': 'CGEffex',
        'licence': 'CC BY 4.0',
        'url': 'https://freesound.org/people/CGEffex/sounds/93837/',
        'proof': "sounds/CREDITS.md of ryno4ever16/cp2020-augmented: \"License: CC BY 4.0\", credit required \"\"Grenade "
                  "pin pull\" by CGEffex, licensed CC BY 4.0\"; earlier listing (Sound/Weapon/License.txt of "
                  "SpeedyVelcro/advanced-invasion): \"CC BY 3.0\"; same attribution obligation in both cases",
        'attribution': '"Grenade pin pull" by CGEffex (freesound.org/s/93837), licensed CC BY 4.0 (cut, filtered)',
    },
    'danjocross': {
        'naming': '"Clean fast Swoosh" (freesound 507466)',
        'creator': 'Danjocross',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/Danjocross/sounds/507466/',
        'proof': "sounds/CREDITS.md of ryno4ever16/cp2020-augmented: \"melee-whoosh-2.ogg\" = \"Clean fast "
                  "Swoosh.aiff\" by Danjocross, CC0 1.0 Universal",
    },
    'magnuswaker': {
        'naming': '"Flesh & Blood": pound of flesh (freesound 522091, 530117)',
        'creator': 'magnuswaker',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/magnuswaker/packs/29802/',
        'proof': "_readme_and_license.txt of the pack (mirror Weesoid/All-That-Jazz-Project): \"Creative Commons 0\" for "
                  "522091 and 530117",
    },
    'filmmakersmanual': {
        'naming': '"Bullet - Hit Body" 2, 3 and 6 (freesound 522316, 522315, 522501, "Valhalla" pack)',
        'creator': 'FilmmakersManual',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/FilmmakersManual/',
        'proof': "license list of the Feel/NiceVibrations package (HapticPackCClicense.txt): about forty sounds "
                  "FilmmakersManual, all \"License: Creative Commons 0\", including \"Bullet - Hit Body (1), (7), (8), (9)\" from "
                  "the same series as takes 2, 3 and 6 (no mention specific to these found); ArmorAlley README: "
                  "\"Bullet - Concrete Hit (2-4) by FilmmakersManual (CC0)\"; Aurora.3 sound/attributions.txt: \"licensed "
                  "under CC0 1.0 Universal ... freesound.org/people/FilmmakersManual\" (copy: Mooses2k/SecretHistories)",
    },
    'mlsulli': {
        'naming': '"Body Hits_Concrete" (freesound 234853)',
        'creator': 'mlsulli',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/mlsulli/sounds/234853/',
        'proof': "ArmorAlley README (scottschiller), Sounds section: \"Body Hits_Concrete.wav by mlsulli (CC0)\"",
    },
    'michorvath': {
        'naming': '"Heart Beating" (freesound 273150)',
        'creator': 'michorvath',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/michorvath/sounds/273150/',
        'proof': "briossant/shadowsOpt docs/CREDITS-sources.md: \"heartbeat.ogg | freesound 273150 (\"Heart Beating\") "
                  "| michorvath | CC0 1.0\"",
    },
    'tnturner': {
        'naming': '"tinnitus" (freesound 377205)',
        'creator': 'tnturner',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/tnturner/sounds/377205/',
        'proof': "SpeedyVelcro/advanced-invasion Sound/Ambient/License.txt: \"./RingingEars.wav \"tinnitus.wav\" By "
                  "tnturner ... CC0 1.0\"",
    },
}

# ---------------------------------------------------------------------------------------------------------------------
# Source files: local path under assets_src/sfx/src -> direct download URL.
FILES = {}


def _url(depot, branch_snd, pathway, lfs=False):
    base = 'https://media.githubusercontent.com/media' if lfs else 'https://raw.githubusercontent.com'
    return f'{base}/{depot}/{branch_snd}/' + urllib.parse.quote(pathway)


def _f(rel, url):
    FILES[rel] = url
    return rel


def _ffsl(code):            # 'AR-15/D_5'
    return _f(f'ffsl/{code}.wav', _url('buddingmonkey/FreeFirearmsSFXLibrary', 'main', f'Master Tracks/{code}.wav'))


def _nox(folder, naming):     # ('Rock_Run', 'Rock_Run_02')
    pathway = f'Footsteps_{folder.split("_")[0]}/Footsteps_{folder}/Footsteps_{naming}.wav'
    return _f('nox/' + pathway, _url('helzpont/home4', 'main', 'assets/audio/Footsteps_Essentials_NOX_SOUND/' + pathway))


def _hyp(naming):
    return _f(f'hypersomnia/{naming}.ogg', _url('TeamHypersomnia/Hypersomnia', 'master', f'hypersomnia/content/sfx/{naming}.ogg'))


def _ken(pathway):           # 'kenney-rpg-audio/audio/Audio/cloth1.ogg'
    return _f('kenney/' + pathway, _url('series-ai/jam-ready-assets', 'main', pathway, lfs=True))


def _rpg(pathway):           # 'inventory/cloth.wav'
    return _f('artisticdude/' + pathway, _url('tynatsuhara/swamp.camp', 'master', 'static/audio/rpg/' + pathway, lfs=True))


def _cp(naming):
    return _f(f'cp2020/{naming}', _url('ryno4ever16/cp2020-augmented', 'main', f'sounds/{naming}'))


KR = 'kenney-rpg-audio/audio/Audio/'
KF = 'kenney-foley-sounds/audio/Audio/'
KI = 'kenney-impact-sounds/audio/Audio/'

# Free Firearm Sound Library
AR_MAGOUT, AR_MAGIN, AR_CHARGE, AR_DRY = _ffsl('AR-15/D_5'), _ffsl('AR-15/D_4'), _ffsl('AR-15/D_14'), _ffsl('AR-15/D_16')
AR_SAFE = _ffsl('AR-15/D_20')
AK_MAGOUT, AK_MAGIN, AK_CHARGE, AK_DRY = _ffsl('AK-47/C_11'), _ffsl('AK-47/C_10'), _ffsl('AK-47/C_14'), _ffsl('AK-47/C_7')
AK_SELECT = _ffsl('AK-47/C_4')
PPQ_MAGOUT, PPQ_MAGIN = _ffsl('Walther PPQ/X_5'), _ffsl('Walther PPQ/X_4')
PPQ_SLIDE, PPQ_DROP = _ffsl('Walther PPQ/X_10'), _ffsl('Walther PPQ/X_17')
M45_MAGOUT, M45_MAGIN = _ffsl('Carl Gustav M45_Swedish K/G_9'), _ffsl('Carl Gustav M45_Swedish K/G_8')
TIKKA_CYCLE, MOSIN_CYCLE = _ffsl('Tikka/W_16'), _ffsl('Mosin Nagant/M_14')
NOVA_PUMP, DALY_PUMP, NOVA_LOAD = _ffsl('Nova/O_6'), _ffsl('Charles Daly/H_6'), _ffsl('Nova/O_3')
M12_LOAD = _ffsl('Model 12/K_3')

# NOX: footsteps, jumps, landings
CONCRETE = [_nox('Tile_Run', 'Tile_Run_01'), _nox('Tile_Run', 'Tile_Run_02'), _nox('Tile_Run', 'Tile_Run_05'),
            _nox('Tile_Run', 'Tile_Run_06'), _nox('Rock_Walk', 'Rock_Walk_07'), _nox('Rock_Walk', 'Rock_Walk_09')]
GRAVEL = [_nox('Gravel_Run', f'Gravel_Run_{n}') for n in ('02', '03', '06', '09', '10')]
GRASS = [_nox('Grass_Run', f'Grass_Run_{n}') for n in ('09', '12', '13', '14', '15')]
DIRT = [_nox('DirtyGround_Run', f'DirtyGround_Run_{n}') for n in ('01', '02', '04', '06', '08')]
SNOW = [_nox('Snow_Run', f'Snow_Hard_Run_{n}') for n in ('02', '03', '07', '09', '10')]
METAL = [_nox('Metal_Run', 'MetalV1_Run_03'), _nox('Metal_Run', 'MetalV1_Run_08'), _nox('Metal_Run', 'MetalV1_Run_13'),
         _nox('Metal_Run', 'MetalV2_Run_09'), _nox('Metal_Run', 'MetalV1_Run_15')]
WOOD = [_nox('Wood_Run', f'Wood_Run_{n}') for n in ('01', '03', '04', '06', '07')]
WATER = [_nox('Water_Walk', f'WaterV1_Walk_{n}') for n in ('03', '05', '07', '08')]
JUMP = [_nox('Tile_Jump', 'Tile_Jump_Start_03'), _nox('Rock_Jump', 'Rock_Jump_Start_04')]
LAND = [_nox('Tile_Jump', 'Tile_Jump_Land_01'), _nox('Rock_Jump', 'Rock_Jump_Land_03')]
LAND_SOFT = _nox('DirtyGround_Land', 'DirtyGround_Jump_Land_01')
SLIDE_LAND_SOFT = _nox('DirtyGround_Land', 'DirtyGround_Jump_Land_02')
SAND = [_nox('Sand_Run', f'Sand_Run_{n:02d}') for n in (3, 7, 11, 15, 18)]
GRASS_TALL = _f('nox/Footsteps_Grass/Foley_Grass/Footsteps_Grass_Tall_Movement_03.wav',
                _url('helzpont/home4', 'main', 'assets/audio/Footsteps_Essentials_NOX_SOUND/Footsteps_Grass/Foley_Grass/'
                     'Footsteps_Grass_Tall_Movement_03.wav'))
DIRT_GRAIN = [DIRT[2], _nox('DirtyGround_Run', 'DirtyGround_Run_07')]

# Hypersomnia
SHELL_1 = [_hyp(f'shell_floor_hit_first_{n}') for n in range(1, 6)]
SHELL_2 = [_hyp(f'shell_floor_hit_second_{n}') for n in range(1, 6)]
SHOTSHELL_1 = [_hyp('shotgun_shell_floor_hit_first_1'), _hyp('shotgun_shell_floor_hit_first_2')]
SHOTSHELL_2 = _hyp('shotgun_shell_floor_hit_second')
MAG_FLOOR = [_hyp('magazine_floor_hit_first'), _hyp('magazine_floor_hit_second'), _hyp('magazine_floor_hit_third')]
MAG_DRAW = _hyp('magazine_draw')
GUN_DRAW, SMG_DRAW, HOLSTER = _hyp('standard_gun_draw'), _hyp('standard_smg_draw'), _hyp('standard_holster')
BACKPACK = _hyp('backpack_wear')
FENCE = [_hyp(f'footstep_fence_{n}') for n in (1, 2, 3)]

# Kenney
CLOTH = [_ken(KR + f'cloth{n}.ogg') for n in range(1, 5)]
CLOTH_BELT = [_ken(KR + 'clothBelt.ogg'), _ken(KR + 'clothBelt2.ogg')]
BELT_HANDLE = [_ken(KR + 'beltHandle1.ogg'), _ken(KR + 'beltHandle2.ogg')]
KNIFE_SLICE = _ken(KR + 'knifeSlice.ogg')
SWORD = [_ken(KF + f'Swords/sword{n}.ogg') for n in (1, 3, 4, 7, 9)]
WOOSH = [_ken(KF + f'Woosh/woosh{n}.ogg') for n in (1, 4, 5, 6)]
DROP_LEATHER = _ken(KR + 'dropLeather.ogg')
PUNCH = [_ken(KI + f'impactPunch_medium_00{n}.ogg') for n in range(3)]
PUNCH_HEAVY = [_ken(KI + f'impactPunch_heavy_00{n}.ogg') for n in range(3)]
SOFT_HEAVY = _ken(KI + 'impactSoft_heavy_000.ogg')

# artisticdude
ARMOR = _rpg('inventory/armor-light.wav')
RPG_CLOTH = [_rpg('inventory/cloth.wav'), _rpg('inventory/cloth-heavy.wav')]
METAL_SMALL = [_rpg('inventory/metal-small1.wav'), _rpg('inventory/metal-small2.wav'), _rpg('inventory/metal-small3.wav')]

# Freesound takes (GitHub mirrors)
PIN = _cp('grenade-pin.ogg')
WHOOSH_DJC = _cp('melee-whoosh-2.ogg')
FLESH = [_f('magnuswaker/522091__magnuswaker__pound-of-flesh-1.ogg', _url('Weesoid/All-That-Jazz-Project', 'master',
         'audio/sounds/522091__magnuswaker__pound-of-flesh-1.ogg')),
         _f('magnuswaker/530117__magnuswaker__pound-of-flesh-3.ogg', _url('Weesoid/All-That-Jazz-Project', 'master',
         'audio/sounds/530117__magnuswaker__pound-of-flesh-3.ogg'))]
BODY = [_f(f'mlsulli/234853__mlsulli__body-hits-concrete_{n}.wav', _url('scottschiller/ArmorAlley', 'master',
        f'assets/audio/wav/234853__mlsulli__body-hits-concrete_{n}.wav')) for n in range(1, 6)]
HIT_BODY = [_f(f'filmmakersmanual/{nm}', _url('Mooses2k/SecretHistories', 'main', f'resources/sounds/impacts/bullets_to_flesh/{nm}',
            lfs=True)) for nm in ('522316__filmmakersmanual__bullet-hit-body-2.wav', '522315__filmmakersmanual__bullet-hit-body-3.wav',
                                  '522501__filmmakersmanual__bullet-hit-body-6.wav')]
HEART = _f('michorvath/heartbeat.ogg', _url('briossant/shadowsOpt', 'master', 'public/audio/sfx/heartbeat.ogg'))
TINNITUS = _f('tnturner/RingingEars.wav', _url('SpeedyVelcro/advanced-invasion', 'main', 'Sound/Ambient/RingingEars.wav'))


# ---------------------------------------------------------------------------------------------------------------------
# Processing tools

def src(rel, startpoint=None, duration_s=None):
    """Source decoded to mono 48 kHz (excerpt startpoint..startpoint+duration_s s)."""
    return C.load(C.SRC / rel, start=startpoint, dur=duration_s)


def af(x, *filters):
    """ffmpeg filter chain (empty elements are ignored)."""
    ch = ','.join(f for f in filters if f)
    return C.ff(x, ch) if ch else x


def hp(f):
    """High-pass 24 dB/octave."""
    return f'highpass=f={f}:poles=2,highpass=f={f}:poles=2'


def lp(f):
    """Low-pass 24 dB/octave."""
    return f'lowpass=f={f}:poles=2,lowpass=f={f}:poles=2'


def eq(f, g, q=1.0):
    return f'equalizer=f={f}:t=q:w={q}:g={g}'


def dbg(d):
    return 10 ** (d / 20)


def transpose(x, semitones):
    """Transposition by speed change (duration changes with pitch)."""
    if not semitones: return x
    r = 2 ** (semitones / 12)
    return C.ff(x, f'asetrate={int(round(SR * r))},aresample={SR}')


def attack_time(x, cutpoint=-36.0, pre=0.002):
    """Cuts the head: starts pre seconds before the first sample at cutpoint dB under the peak."""
    return C.trim(x, cutpoint, pre)


def net(x, cutpoint=-12.0, pre=0.002):
    """Cuts the head up to the decisive gesture: starts pre seconds before the envelope (RMS over 2 ms) reaches cutpoint
    dB under its maximum. Unlike attack_time(), a small isolated noise (rubbing, pre-contact) is not enough to
    trigger: the sound starts on the clack, the impact or the press."""
    w = int(0.002 * SR)
    e = np.sqrt(np.convolve(x ** 2, np.ones(w) / w, mode='same'))
    k = np.nonzero(e > e.max() * dbg(cutpoint))[0]
    i = max(0, (int(k[0]) - w // 2 if len(k) else 0) - int(pre * SR))
    return x[i:]


def queue(x, duration_s=0.03):
    """Fade-out of an abruptly cut layer (fixed-duration excerpt): otherwise the cut is audible in the mix."""
    return C.fade(x, 0, min(duration_s, len(x) / SR * 0.5))


def chains(parts, xf=0.004):
    """Concatenates pieces with a short crossfade (equal gain)."""
    out = parts[0]
    n0 = int(xf * SR)
    for p in parts[1:]:
        n = min(n0, len(out), len(p))
        if n <= 1:
            out = np.concatenate([out, p]); continue
        t = np.linspace(0, 1, n)
        out = np.concatenate([out[:-n], out[-n:] * (1 - t) + p[:n] * t, p[n:]])
    return out


def tightens(x, cutpoint=-34.0, retain=0.05, xf=0.004):
    """Shortens quiet passages between two events: each passage below cutpoint (dB under the peak, 5 ms envelope)
    longer than retain is brought down to retain (its start and its end are kept)."""
    w = int(0.005 * SR)
    e = np.sqrt(np.convolve(x ** 2, np.ones(w) / w, mode='same'))
    calm_bed = e < C.peak(e) * dbg(cutpoint)
    g = int(retain * SR)
    parts, i, n = [], 0, len(x)
    k = 0
    while k < n:
        if calm_bed[k]:
            j = k
            while j < n and calm_bed[j]: j += 1
            if j < n and k > 0 and j - k > g:       # internal passage (not the end) too long
                a, b = k + g // 2, j - g // 2
                parts.append(x[i:a]); i = b
            k = j
        else:
            k += 1
    parts.append(x[i:])
    return chains(parts, xf)


def envelope(x, att=0.015, tau=0.3):
    """Applies an envelope: linear rise over att seconds then exponential decay (constant tau)."""
    t = np.arange(len(x)) / SR
    return x * (np.minimum(1, t / att) if att > 0 else 1) * np.exp(-t / tau)


def rises(x, duration_s, curve_of=1.5):
    """Fade-in of duration_s seconds (rise of a whoosh that is picked up mid-way)."""
    y = x.copy(); n = min(len(y), int(duration_s * SR))
    y[:n] *= np.linspace(0, 1, n) ** curve_of
    return y


def band_cut(*freqs, q=12):
    """Narrow notch filters (lines of a take: whistle of the room or of the recorder)."""
    return ','.join(f'bandreject=f={f}:width_type=q:w={q}' for f in freqs)


def harmonics(x, fc=160, drive=5.0, band_hz=(130, 650)):
    """Harmonics layer of a low sound: a low-passed copy is saturated (tanh) and only the band above the fundamental
    is kept. A phone speaker renders nothing below 150 Hz: the ear reconstructs the
    fundamental from these harmonics."""
    b = af(x, lp(fc))
    b = b / max(C.peak(b), 1e-12)
    s = np.tanh(drive * b) / np.tanh(drive)
    return af(s, hp(band_hz[0]), lp(band_hz[1]))


ENTRIES = []
SIGNALS = {}   # masters written during this build (id -> signal), for aligning the variants


def master_take(sid, x, dmax, source, filepath, detail, fout=0.04, crest_of=-1.0, end_threshold=-62.0):
    """Finishes a master: low-pass 16 kHz, head below -50 dB brought down to 2 ms, end cut below end_threshold, limit to dmax
    seconds, fades, peak, writing, credit.
    The low-pass comes before normalization: the game's MP3 (LAME V5) keeps nothing above 17 kHz, nor does a
    phone speaker; some takes (shell casings, pin) put more than half of their
    energy there, and the peak as well as the variant alignment must be based on what will be heard."""
    x = af(np.asarray(x, dtype=np.float64), lp(16000))
    x = C.trim(x, -50, 0.002)
    x = x[:C.tail_end(x, end_threshold)]
    if len(x) > int(dmax * SR):
        x = x[:int(dmax * SR)]
        fout = max(fout, min(0.12, dmax * 0.3))
    x = C.fade(x, 0.0015, min(fout, len(x) / SR * 0.5))
    x = C.norm(x, crest_of)
    C.save_master(PACK, sid, x)
    SIGNALS[sid] = x
    ENTRIES.append(C.credit(sid, PACK, source, filepath, detail))
    return x


def loudness(x):
    """Approximate perceived level of a sound effect: maximum RMS over a sliding 100 ms after a weighting close to the
    K curve (BS.1770: high-pass, +4 dB shelf above 2 kHz), limited to 120 Hz-15 kHz (dBFS). The upper bound
    rules out the ultrasound of some takes (shell casings), which neither the MP3 nor the ear keeps."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    hp2 = f ** 4 / (f ** 4 + 120.0 ** 4)                      # 2nd-order high-pass at 120 Hz (in power)
    shelf = 1 + (dbg(4) - 1) * f ** 2 / (f ** 2 + 1700.0 ** 2)
    X = X * np.sqrt(hp2) * shelf * (f <= 15000)
    y = np.fft.irfft(X, len(x))
    w = min(len(y), int(0.1 * SR))
    return C.db(np.sqrt(np.max(np.convolve(y ** 2, np.ones(w) / w, mode='valid'))))


def align_variants(deviation=3.0):
    """The game picks a variant at random: none should sound clearly louder than the others. In each group
    <id>-1, <id>-2..., a variant that exceeds the quietest by more than deviation dB is lowered by that much (its peak then falls
    under -1 dBFS; the quietest keeps its own at -1 dBFS)."""
    groups_of = {}
    for sid in SIGNALS:
        base, _, n = sid.rpartition('-')
        if base and n.isdigit(): groups_of.setdefault(base, []).append(sid)
    for base, ids in groups_of.items():
        lvl = {sid: loudness(SIGNALS[sid]) for sid in ids}
        objective = min(lvl.values()) + deviation
        for sid in ids:
            if lvl[sid] <= objective: continue
            g = objective - lvl[sid]
            SIGNALS[sid] = SIGNALS[sid] * dbg(g)
            C.save_master(PACK, sid, SIGNALS[sid])
            e = next(e for e in ENTRIES if e['id'] == sid)
            e['detail'] += f'; level aligned with the other variants ({g:.1f} dB)'


def naming(rel):
    return rel.split('/', 1)[1]


# ---------------------------------------------------------------------------------------------------------------------
# Weapon handling (FFSL)

def recording(rel, startpoint, duration_s, hpf=80, filters='', cutpoint=-36.0, decisive=None):
    """Excerpt of an FFSL track: high-pass, start at the attack (or, with decisive, on the decisive gesture: see net()),
    fade on the cut at the end of the excerpt."""
    x = queue(af(src(rel, startpoint, duration_s), hp(hpf), filters), 0.02)
    return net(x, decisive) if decisive is not None else attack_time(x, cutpoint)


def weaponry():
    # (id, file, start, excerpt duration, max duration, filters, detail); the starts fall in a gap just
    # before the first useful gesture (button, magazine entry) so that the decisive clack arrives early
    t = [
        ('f_magout_rifle-1', AR_MAGOUT, 1.226, 0.65, 0.6, '', 'AR-15: button then full magazine removed (D_5, 1.226-1.83 s)'),
        ('f_magout_rifle-2', AK_MAGOUT, 0.29, 0.62, 0.6, '', 'AK-47: lever then magazine removed (C_11, 0.29-0.91 s)'),
        ('f_magin_rifle-1', AR_MAGIN, 1.24, 0.55, 0.6, '', 'AR-15: full magazine engaged (D_4, excerpt 1.24-1.79 s, start on the first clack, second clack 22 ms later)'),
        ('f_magin_rifle-2', AK_MAGIN, 0.27, 0.55, 0.6, '', 'AK-47: magazine engaged (C_10, excerpt 0.27-0.82 s cut at the attack: the clack opens the sound)'),
        ('f_charge_rifle-1', AR_CHARGE, 0.36, 0.7, 0.6, '', 'AR-15: lever pulled then released (D_14, 0.36-0.96 s)'),
        ('f_charge_rifle-2', AK_CHARGE, 1.10, 0.7, 0.6, '', 'AK-47: bolt pulled then released (C_14, take 2, 1.10-1.70 s)'),
        ('f_magout_pistol', PPQ_MAGOUT, 1.33, 0.55, 0.5, '', 'Walther PPQ: full magazine removed (X_5, 1.33-1.83 s)'),
        ('f_magin_pistol', PPQ_MAGIN, 3.01, 0.5, 0.5, '', 'Walther PPQ: full magazine inserted (X_4, take 2, 3.01-3.51 s)'),
        ('f_slide_pistol-1', PPQ_SLIDE, 0.77, 0.5, 0.5, '', 'Walther PPQ: slide released (X_10, excerpt 0.77-1.27 s, start on the slap)'),
        ('f_slide_pistol-2', PPQ_DROP, 1.13, 0.5, 0.5, '', 'Walther PPQ: slide released, full magazine (X_17, excerpt 1.13-1.63 s, start on the slap)'),
        ('f_magout_smg', M45_MAGOUT, 0.455, 0.5, 0.5, '', 'Carl Gustav M45: magazine removed (G_9, 0.455-0.955 s)'),
        ('f_magin_smg', M45_MAGIN, 1.85, 0.5, 0.5, '', 'Carl Gustav M45: magazine engaged (G_8, take 2, excerpt 1.85-2.35 s cut at the attack: the clack opens the sound)'),
        ('f_pump-1', NOVA_PUMP, 1.01, 0.7, 0.6, '', 'Benelli Nova: pump back and forth (O_6, 1.01-1.61 s)'),
        ('f_pump-2', DALY_PUMP, 1.21, 0.7, 0.6, band_cut(9690, q=15), 'Charles Daly 12 gauge: pump back and forth (H_6, '
         '1.21-1.81 s), notch at 9.69 kHz (the tube rings between the two beats)'),
        ('f_dry-1', AR_DRY, 0.35, 0.25, 0.2, '', 'AR-15: dry click (D_16, 0.35-0.55 s)'),
        ('f_dry-2', AK_DRY, 0.31, 0.25, 0.2, '', 'AK-47: dry click (C_7, 0.31-0.51 s)'),
    ]
    # sounds whose decisive gesture (clack, slap) must open the sound: the small rubbing that precedes it is cut
    decisive = {'f_magin_rifle-1': -12, 'f_slide_pistol-1': -12, 'f_slide_pistol-2': -12}
    for sid, rel, d, dur, dmax, filters, detail in t:
        x = recording(rel, d, dur, filters=filters, decisive=decisive.get(sid))
        master_take(sid, x, dmax, 'ffsl', naming(rel), detail + '; high-pass 80 Hz, mono, start at the attack, fade')

    # bolt: full cycle (lift, pull, push, lower), quiet passages shortened to fit in 0.9 s
    for sid, rel, d, dur, detail in [
        ('f_bolt-1', TIKKA_CYCLE, 0.27, 1.4, 'Tikka T3: full bolt cycle (W_16, 0.27-1.67 s)'),
        ('f_bolt-2', MOSIN_CYCLE, 0.53, 1.35, 'Mosin-Nagant: full bolt cycle (M_14, 0.53-1.88 s)'),
    ]:
        x = recording(rel, d, dur)
        x = tightens(x, -30, 0.05)
        master_take(sid, x, 0.9, 'ffsl', naming(rel), detail + '; silences between the 4 beats shortened to 50 ms, high-pass 80 Hz')

    # shell pushed into the tube: impact of the base then slide and tube latch
    for sid, rel, d, dur, detail in [
        ('f_shell-1', NOVA_LOAD, 1.53, 0.42, 'Benelli Nova: shell pushed into the tube (O_3, take 1, 1.53-1.95 s)'),
        ('f_shell-2', NOVA_LOAD, 11.76, 0.5, 'Benelli Nova: shell pushed into the tube (O_3, take 3, 11.76-12.26 s)'),
        ('f_shell-3', M12_LOAD, 1.58, 0.42, 'Winchester Model 12: shell pushed into the tube (K_3, 1.58-2.00 s)'),
    ]:
        x = recording(rel, d, dur)
        x = tightens(x, -30, 0.04)
        master_take(sid, x, 0.35, 'ffsl', naming(rel), detail + '; shortened silences, high-pass 80 Hz')

    # palm slapping the magazine: AR-15 engaging clack + dull hit of the hand
    # (both layers are aligned on their impact: the punch take rubs 30 ms before striking)
    clac = recording(AR_MAGIN, 1.20, 0.25, decisive=-12)
    main = envelope(af(net(src(PUNCH[1]), -12), hp(150), lp(2500)), 0.0005, 0.03)
    x = C.mix((C.norm(clac), 0.0, 1.0), (C.norm(main), 0.0, dbg(-7)))
    master_take('f_slap', x, 0.2, 'ffsl', naming(AR_MAGIN), 'AR-15: clack from D_4 (excerpt 1.20-1.45 s, start on the clack) + Kenney '
           'impactPunch_medium_001 punch aligned on its impact, filtered (150 Hz-2.5 kHz, resonance cut at 30 ms, -7 dB)')
    ENTRIES.append(C.credit('f_slap', PACK, 'kenney', naming(PUNCH[1]), '"hand" layer of the magazine clack'))


# ---------------------------------------------------------------------------------------------------------------------
# Draw, stow, shouldering, knife, grenade, pickup

def textile(rel, startpoint=0.0, duration_s=None, hpf=150, lpf=None, cutpoint=-40):
    """Layer of cloth, strap or equipment: high-pass, start at the attack; a fixed-duration excerpt ends with a fade."""
    x = src(rel, startpoint, duration_s)
    if duration_s is not None: x = queue(x)
    return attack_time(af(x, hp(hpf), lp(lpf) if lpf else ''), cutpoint)


def gestures():
    # weapon draw: Hypersomnia remixes (cloth + strap + clicks) with a Kenney strap
    for sid, rel, belt, detail in [
        ('f_draw-1', GUN_DRAW, CLOTH_BELT[1], 'Hypersomnia standard_gun_draw + Kenney clothBelt2 strap (-10 dB)'),
        ('f_draw-2', SMG_DRAW, CLOTH_BELT[0], 'Hypersomnia standard_smg_draw + Kenney clothBelt strap (-10 dB)'),
    ]:
        x = textile(rel, hpf=90)
        b = textile(belt, 0.0, 0.4, hpf=300)
        x = C.mix((C.norm(x), 0, 1.0), (C.norm(b), 0.0, dbg(-10)))
        master_take(sid, x, 0.5, 'hypersomnia', naming(rel), detail + '; high-pass, 0.5 s')
        ENTRIES.append(C.credit(sid, PACK, 'kenney', naming(belt), 'belt layer'))

    # stow: Hypersomnia holstering, and cloth + strap + stock click
    x = textile(HOLSTER, hpf=90)
    master_take('f_stow-1', x, 0.5, 'hypersomnia', naming(HOLSTER), 'standard_holster, high-pass 90 Hz, 0.5 s')
    a = textile(RPG_CLOTH[1], hpf=150)
    b = recording(AR_SAFE, 0.29, 0.25, hpf=200)
    x = C.mix((C.norm(a), 0, dbg(-3)), (C.norm(b), 0.16, dbg(-6)))
    master_take('f_stow-2', x, 0.5, 'artisticdude', naming(RPG_CLOTH[1]), 'cloth-heavy cloth + AR-15 safety click FFSL D_20 '
           '(-6 dB, at 160 ms)')
    ENTRIES.append(C.credit('f_stow-2', PACK, 'ffsl', naming(AR_SAFE), 'click layer'))

    # shouldering: brief rustle + small click
    for sid, c, clicked, dc, detail in [
        ('f_ads-1', CLOTH[1], AR_SAFE, 0.29, 'Kenney cloth2 cloth + AR-15 safety click (D_20)'),
        ('f_ads-2', CLOTH[3], AK_SELECT, 2.715, 'Kenney cloth4 cloth + AK-47 selector click (C_4)'),
    ]:
        a = textile(c, 0.0, 0.3, hpf=250)
        b = recording(clicked, dc, 0.2, hpf=300)
        x = C.mix((C.norm(a), 0, dbg(-4)), (C.norm(b), 0.06, dbg(-9)))
        master_take(sid, x, 0.3, 'kenney', naming(c), detail + ' (-9 dB, at 60 ms), high-pass 250 Hz')
        ENTRIES.append(C.credit(sid, PACK, 'ffsl', naming(clicked), 'click layer'))

    # knife: fast whoosh (staff whoosh transposed up, taken 35-40 ms before its peak) + blade edge;
    # the Danjocross whoosh holds a 750 Hz whistle for 250 ms: here it is faded out in 0.1 s after its peak
    for k, (w, st, blade_snd, d0, tau) in enumerate([(WOOSH[0], 6, SWORD[0], 0.035, None), (WHOOSH_DJC, 3, SWORD[1], 0.04, 0.1),
                                                 (WOOSH[2], 7, SWORD[2], 0.035, None)]):
        x = transpose(af(src(w), hp(200)), st)
        i = int(np.argmax(np.abs(x)))
        x = rises(x[max(0, i - int(d0 * SR)):], d0)
        if tau:
            t = np.arange(len(x)) / SR - d0
            x = x * np.where(t > 0, np.exp(-np.maximum(t, 0) / tau), 1.0)
        b = envelope(attack_time(af(src(blade_snd), hp(1500)), -40), 0.004, 0.06)
        y = af(C.mix((C.norm(x), 0, 1.0), (C.norm(b), d0 - 0.01, dbg(-13))), hp(300), eq(4000, 2, 1.0))
        sid = f'f_knife-{k + 1}'
        src_w = 'danjocross' if w == WHOOSH_DJC else 'kenney'
        master_take(sid, y, 0.35, src_w, naming(w), f'whoosh {naming(w)} transposed +{st} semitones, taken {d0 * 1000:.0f} ms before its '
               f'peak' + (f', faded out in {tau:.1f} s after' if tau else '') + f' + Kenney blade edge '
               f'{naming(blade_snd)} (high-pass 1.5 kHz, -13 dB), high-pass 300 Hz', fout=0.1)
        if src_w != 'kenney': ENTRIES.append(C.credit(sid, PACK, 'kenney', naming(blade_snd), 'blade layer'))

    # knife hit: flesh (magnuswaker, without its take rumble) + dull hit + cut + cloth
    for k, fl in enumerate(FLESH):
        flesh = envelope(attack_time(af(src(fl), hp(160), lp(7000), eq(350, 3, 1.0)), -30), 0.0005, 0.09)
        blow = envelope(attack_time(af(src(PUNCH[2 - k]), hp(120), lp(2000)), -30), 0.0005, 0.05)
        blade_snd = envelope(af(attack_time(src(KNIFE_SLICE, 0.18 + 0.02 * k, 0.3), -36), hp(900)), 0.002, 0.07)
        bedsheet = envelope(attack_time(af(src(RPG_CLOTH[1]), hp(300)), -36), 0.005, 0.12)
        x = C.mix((C.norm(flesh), 0, 1.0), (C.norm(blow), 0, dbg(-6)), (C.norm(blade_snd), 0.0, dbg(-9)), (C.norm(bedsheet), 0.005, dbg(-12)))
        sid = f'f_knife_hit-{k + 1}'
        master_take(sid, x, 0.35, 'magnuswaker', naming(fl), 'hit in the flesh (band-pass 160 Hz-7 kHz, +3 dB at 350 Hz, decay '
               '90 ms) + Kenney punch (-6 dB) + Kenney knifeSlice cut (-9 dB) + artisticdude cloth-heavy cloth '
               '(-12 dB)', fout=0.12)
        ENTRIES.append(C.credit(sid, PACK, 'kenney', naming(KNIFE_SLICE), 'hit and blade layers'))
        ENTRIES.append(C.credit(sid, PACK, 'artisticdude', naming(RPG_CLOTH[1]), 'cloth layer'))

    # pin: the only real take found (CGEffex, CC BY 4.0); we take the end of the pin's slide
    x = rises(af(src(PIN, 1.545, 0.45), hp(400)), 0.008)
    master_take('f_pin', x, 0.4, 'cgeffex', naming(PIN), 'take 2 (1.545-1.995 s: end of the slide then ring released at 65 ms), '
           'high-pass 400 Hz (handling noise)')

    # spoon: dry lever clack (AK-47 selector) + small ringing metal object
    clicked = recording(AK_SELECT, 3.745, 0.25, hpf=300, decisive=-12)
    ting = transpose(af(attack_time(src(METAL_SMALL[1])), hp(1500)), 5)
    x = C.mix((C.norm(clicked), 0, dbg(-2)), (C.norm(ting), 0.008, dbg(-5)))
    master_take('f_spoon', x, 0.4, 'ffsl', naming(AK_SELECT), 'AK-47 selector clack (C_4, excerpt at 3.745 s, start on the clack) '
           '+ artisticdude metal-small2 ring transposed +5 semitones (-5 dB, at 8 ms)')
    ENTRIES.append(C.credit('f_spoon', PACK, 'artisticdude', naming(METAL_SMALL[1]), 'jingle layer'))

    # throw: arm whoosh + rustle
    for k, (w, c) in enumerate([(WOOSH[0], CLOTH[0]), (WOOSH[2], CLOTH[2])]):
        a = af(attack_time(src(w), -40), hp(200))
        b = textile(c, 0.0, 0.35, hpf=200)
        x = C.mix((C.norm(a), 0.03, 1.0), (C.norm(b), 0, dbg(-6)))
        sid = f'f_throw-{k + 1}'
        master_take(sid, x, 0.4, 'kenney', naming(w), f'whoosh {naming(w)} + rustle {naming(c)} (-6 dB)')

    x = textile(RPG_CLOTH[0], hpf=200)
    master_take('f_windup', x, 0.3, 'artisticdude', naming(RPG_CLOTH[0]), 'cloth rustle, high-pass 200 Hz')

    # pickup: rustle + magazines knocking together
    for k, (c, m) in enumerate([(CLOTH[0], MAG_DRAW), (CLOTH[1], METAL_SMALL[2])]):
        a = textile(c, 0.0, 0.5, hpf=200)
        b = af(attack_time(src(m)), hp(250))
        x = C.mix((C.norm(a), 0, dbg(-5)), (C.norm(b), 0.05, dbg(-2)))
        sid = f'f_pickup-{k + 1}'
        src_b = 'hypersomnia' if m == MAG_DRAW else 'artisticdude'
        master_take(sid, x, 0.5, 'kenney', naming(c), f'rustle {naming(c)} (-5 dB) + {naming(m)} (at 50 ms)')
        ENTRIES.append(C.credit(sid, PACK, src_b, naming(m), 'metallic layer'))


# ---------------------------------------------------------------------------------------------------------------------
# Drops: magazines, shell casings, hulls

CASING_LINES = (443, 466)   # line that persists between the bounces of the Hypersomnia shotgun hulls (it slides from 439 to 469 Hz)


def fallCount():
    # magazine on the floor: first impact (the first, very sharp, receives the body of the third) + bounce. Each take rubs
    # or barely touches 10 to 60 ms before its main impact: the layers are aligned on their impact (net)
    viewKick = [net(src(r), -12) for r in MAG_FLOOR]
    x = C.mix((C.norm(viewKick[0]), 0, 1.0), (C.norm(viewKick[2]), 0.003, dbg(-4)), (C.norm(viewKick[1]), 0.14, dbg(-8)))
    master_take('f_magdrop-1', af(x, hp(80)), 0.5, 'hypersomnia', naming(MAG_FLOOR[0]), 'magazine on the floor: magazine_floor_hit_first '
           '+ body of magazine_floor_hit_third (-4 dB, at 3 ms) + bounce magazine_floor_hit_second at 0.14 s (-8 dB), '
           'each take aligned on its main impact')
    x = C.mix((C.norm(viewKick[2]), 0, 1.0), (C.norm(transpose(viewKick[0], 2)), 0.11, dbg(-7)))
    master_take('f_magdrop-2', af(x, hp(80)), 0.5, 'hypersomnia', naming(MAG_FLOOR[2]), 'magazine on the floor: magazine_floor_hit_third '
           '+ bounce magazine_floor_hit_first transposed +2 semitones at 0.11 s (-7 dB), each take aligned on its impact')

    # shell casings: 96 kHz takes whose bulk of energy is above 17 kHz (inaudible, lost in the MP3);
    # low-pass before aligning each take on its impact
    for k in range(4):
        a = net(af(src(SHELL_1[k]), lp(16000)), -20)
        b = net(af(src(SHELL_2[(k + 2) % 5]), lp(16000)), -20)
        off = (0.09, 0.13, 0.11, 0.15)[k]
        x = af(C.mix((C.norm(a), 0, 1.0), (C.norm(b), off, dbg(-6))), hp(300))
        master_take(f'f_brass-{k + 1}', x, 0.6, 'hypersomnia', naming(SHELL_1[k]),
               f'brass casing: first impact + {naming(SHELL_2[(k + 2) % 5])} at ' + f'{off:.2f}' + ' s (-6 dB), '
               'band-pass 300 Hz-16 kHz, impacts aligned')

    # soft ground: a grain of earth transposed an octave (small object sticking in) + the brass tick, without its
    # resonance (high-pass 2.5 kHz, casing lines cut, damped in 6 ms)
    for k, (sh, dg) in enumerate([(2, 0), (3, 1)]):
        tic = envelope(attack_time(af(src(SHELL_1[sh]), hp(2500), band_cut(7260, 9420, q=6)), -30), 0.0003, 0.006)
        earth = envelope(af(transpose(attack_time(af(src(DIRT_GRAIN[dg]), hp(80)), -30), 12), hp(250)), 0.0005, 0.03)
        x = C.mix((C.norm(earth), 0, 1.0), (C.norm(tic), 0.0, dbg(-7)))
        sid = f'f_brass_soft-{k + 1}'
        master_take(sid, x, 0.4, 'nox', naming(DIRT_GRAIN[dg]), f'casing on earth: NOX footstep on earth transposed +12 semitones, damped in '
               f'30 ms + tick of {naming(SHELL_1[sh])} (high-pass 2.5 kHz, resonances cut, -7 dB)', fout=0.06)
        ENTRIES.append(C.credit(sid, PACK, 'hypersomnia', naming(SHELL_1[sh]), 'brass layer'))

    # shotgun hulls: the take rings with a line around 450 Hz that lasts between the bounces (floor resonance): cut
    for k in range(2):
        a = attack_time(src(SHOTSHELL_1[k]))
        b = attack_time(src(SHOTSHELL_2))
        x = af(C.mix((C.norm(a), 0, 1.0), (C.norm(b), 0.12 + 0.04 * k, dbg(-5))), hp(120), band_cut(*CASING_LINES, q=10), band_cut(12750, 16210, q=15))
        master_take(f'f_shells-{k + 1}', x, 0.6, 'hypersomnia', naming(SHOTSHELL_1[k]),
               f'plastic shell hull: first impact + bounce shotgun_shell_floor_hit_second (-5 dB), lines at 440-470 Hz, 12.75 and 16.2 kHz cut')


# ---------------------------------------------------------------------------------------------------------------------
# Footsteps (NOX)

def one_step(rel, hpf=80, filters='', duration_s=0.3, cutpoint=-30, decisive=None):
    x = src(rel)
    x = C.norm(x, -1)
    x = af(x, hp(hpf), filters)
    x = net(x, decisive) if decisive is not None else attack_time(x, cutpoint)
    x = x[:int(duration_s * SR)]
    return C.fade(x, 0.0015, duration_s * 0.45, 2.0)


def footsteps():
    surfaces = [
        ('s_concrete', CONCRETE, 90, eq(3500, 5, 1.2) + ',' + eq(250, -2, 1.0), 0.30, 'concrete/tile, raised treble (+5 dB at 3.5 kHz)'),
        ('s_gravel', GRAVEL, 80, '', 0.33, 'grit'),
        ('s_grass', GRASS, 80, '', 0.30, 'grass'),
        ('s_dirt', DIRT, 70, '', 0.30, 'packed earth'),
        ('s_snow', SNOW, 70, '', 0.30, 'crunching packed snow'),
        ('s_wood', WOOD, 70, eq(2000, 2, 1.0), 0.30, 'hollow floorboards'),
        ('s_water', WATER, 80, '', 0.35, 'wading in a puddle'),
    ]
    for base, files, hpf, filters, duration_s, detail in surfaces:
        for k, rel in enumerate(files):
            x = one_step(rel, hpf, filters, duration_s)
            master_take(f'{base}-{k + 1}', x, 0.35, 'nox', naming(rel), f'a footstep, {detail}; high-pass {hpf} Hz, {duration_s:.2f} s')

    # sheet metal and catwalk: the NOX footsteps on metal are dull (thick plate); the plate rumble is removed from them and
    # we add the brief rattle of a wire fence (Hypersomnia footstep_fence, highs only, damped over 50 ms)
    for k, rel in enumerate(METAL):
        p = one_step(rel, 110, eq(2500, 5, 1.0) + ',' + eq(180, -3, 1.0), 0.33)
        g = envelope(attack_time(af(src(FENCE[k % 3]), hp(1800)), -30), 0.001, 0.05)
        x = C.mix((C.norm(p), 0, 1.0), (C.norm(g), 0.004, dbg(-12)))
        sid = f's_metal-{k + 1}'
        master_take(sid, x, 0.35, 'nox', naming(rel), 'a footstep on sheet metal: high-pass 110 Hz, +5 dB at 2.5 kHz, -3 dB at 180 Hz + rattle of '
               f'fence {naming(FENCE[k % 3])} (high-pass 1.8 kHz, -12 dB)', fout=0.1)
        ENTRIES.append(C.credit(sid, PACK, 'hypersomnia', naming(FENCE[k % 3]), 'fence layer'))


# ---------------------------------------------------------------------------------------------------------------------
# Player body: equipment, jump, landing, slide

def equipment(k):
    """Equipment rattle layer (straps, buckles, magazines); its sources are in EQUIPMENT[k]."""
    if k == 0:
        a = textile(ARMOR, 0.0, 0.3, hpf=300)
        b = textile(CLOTH[1], 0.0, 0.25, hpf=250)
        return C.mix((C.norm(a), 0, dbg(-3)), (C.norm(b), 0, dbg(-6)))
    if k == 1:
        a = textile(CLOTH_BELT[1], 0.0, 0.3, hpf=300)
        return C.norm(a)
    if k == 2:
        a = textile(BACKPACK, 0.0, 0.3, hpf=200)
        return C.norm(a)
    a = textile(BELT_HANDLE[1], 0.05, 0.3, hpf=400)
    b = textile(CLOTH[3], 0.0, 0.25, hpf=250)
    return C.mix((C.norm(a), 0.0, dbg(-4)), (C.norm(b), 0, dbg(-5)))


EQUIPMENT = [[('artisticdude', ARMOR), ('kenney', CLOTH[1])], [('kenney', CLOTH_BELT[1])], [('hypersomnia', BACKPACK)],
              [('kenney', BELT_HANDLE[1]), ('kenney', CLOTH[3])]]


def credit_equipment(sid, k, already=()):
    """Credits for the equipment layers k of a master (except the file already credited as the main source)."""
    for source, rel in EQUIPMENT[k]:
        if rel not in already: ENTRIES.append(C.credit(sid, PACK, source, naming(rel), 'equipment layer'))


def bodypart():
    det = ['artisticdude armor-light brigandine + Kenney cloth2 cloth', 'Kenney clothBelt2 strap and buckle',
           'Hypersomnia backpack_wear bag', 'Kenney beltHandle2 belt handle + cloth4 cloth']
    for k in range(4):
        x = equipment(k)
        source, rel = EQUIPMENT[k][0]
        master_take(f's_gear-{k + 1}', x, 0.3, source, naming(rel), det[k] + ', high-pass, 0.3 s')
        credit_equipment(f's_gear-{k + 1}', k, (rel,))

    # takeoff: the NOX Jump_Start takes rub before the press; the sound starts at the first firm press
    for k, rel in enumerate(JUMP):
        p = one_step(rel, 80, '', 0.35, decisive=-12)
        g = equipment(k + 1)
        x = C.mix((C.norm(p), 0, 1.0), (C.norm(g), 0.02, dbg(-8)))
        master_take(f's_jump-{k + 1}', x, 0.35, 'nox', naming(rel), 'NOX Jump_Start takeoff (start at the first firm press) + '
               'equipment rattle (-8 dB)')
        credit_equipment(f's_jump-{k + 1}', k + 1)

    for k, rel in enumerate(LAND):
        p = one_step(rel, 70, eq(3000, 3, 1.0), 0.45, -30)
        g = equipment((k + 2) % 4)
        x = C.mix((C.norm(p), 0, 1.0), (C.norm(g), 0.015, dbg(-9)))
        master_take(f's_land-{k + 1}', x, 0.45, 'nox', naming(rel), 'NOX Jump_Land landing + equipment rattle (-9 dB)')
        credit_equipment(f's_land-{k + 1}', (k + 2) % 4)
    # on dirt, the grab touches twice with the toe (21 and 56 ms) before the landing (88 ms): start on the latter
    p = one_step(LAND_SOFT, 60, '', 0.45, decisive=-4)
    g = equipment(0)
    x = C.mix((C.norm(p), 0, 1.0), (C.norm(g), 0.015, dbg(-11)))
    master_take('s_land_soft', x, 0.45, 'nox', naming(LAND_SOFT), 'landing on dirt NOX (start on the main footfall) + '
           'gear rattle (-11 dB)')
    credit_equipment('s_land_soft', 0)

    # slide: only one, the dirt one, for all surfaces (the hard-ground slide, dragged Kenney stone, was
    # removed in 2.32.2 at the owner's request)
    # footfall on dirt + sand footstep grains layered into a fading drag
    # + tall grass brushed through (NOX Foley_Grass)
    entry = attack_time(af(src(SLIDE_LAND_SOFT), hp(70)), -30)
    grains = [(C.norm(attack_time(af(src(rel), hp(300)), -30)), 0.03 + i * 0.085 + (0.0, 0.012, 0.004, 0.017, 0.008)[i], dbg(-3 - 2.2 * i))
              for i, rel in enumerate(SAND)]
    fr = C.mix(*grains)
    herbage = attack_time(af(src(GRASS_TALL), hp(250)), -30)[:int(0.8 * SR)]
    herbage = envelope(herbage, 0.02, 0.35)
    x = C.mix((C.norm(entry), 0, 0.8), (C.norm(fr), 0.0, dbg(-2)), (C.norm(herbage), 0.01, dbg(-5)))
    master_take('s_slide_soft', x, 0.8, 'nox', naming(SLIDE_LAND_SOFT), 'NOX footfall on dirt + 5 NOX footsteps in sand layered every '
           '85 ms while fading out (friction) + NOX Foley_Grass tall grass (20 ms rise, 0.35 s decay)', fout=0.3)


# ---------------------------------------------------------------------------------------------------------------------
# Player: bullet hit, heart, death, tinnitus

def player():
    # bullet hit: muffled, shortened flesh (FilmmakersManual) + Kenney punch + vest (Kenney dropped leather),
    # then a layer of harmonics for small speakers
    for k, (fm, pu) in enumerate(zip(HIT_BODY, PUNCH_HEAVY)):
        b = envelope(attack_time(af(src(fm), hp(90), lp(2200)), -30), 0.0005, 0.07)
        p = envelope(attack_time(af(src(pu), hp(60), lp(1500)), -30), 0.0005, 0.06)
        v = envelope(attack_time(af(src(DROP_LEATHER), hp(150), lp(3500)), -30), 0.001, 0.05)
        x = C.mix((C.norm(b), 0, 1.0), (C.norm(p), 0, dbg(-3)), (C.norm(v), 0.002, dbg(-9)))
        x = C.mix((x, 0, 1.0), (C.norm(harmonics(x, 200, 4.0, (180, 900))) * C.peak(x), 0, dbg(-10)))
        sid = f'p_hurt-{k + 1}'
        master_take(sid, x, 0.3, 'filmmakersmanual', naming(fm), 'bullet into flesh (band-pass 90 Hz-2.2 kHz, 70 ms decay) + '
               f'Kenney punch {naming(pu)} (low-pass 1.5 kHz, -3 dB) + Kenney dropLeather dropped leather (vest, -9 dB) + '
               'harmonics 180-900 Hz (-10 dB)', fout=0.12)
        ENTRIES.append(C.credit(sid, PACK, 'kenney', naming(pu), 'hit and vest layers (dropLeather)'))

    hb = attack_time(af(src(HEART), hp(25), lp(2000)), -40)
    x = C.mix((C.norm(hb), 0, 1.0), (C.norm(harmonics(hb, 150, 5.0, (120, 600))), 0, dbg(-8)))
    master_take('p_heart', x, 0.7, 'michorvath', naming(HEART), 'a "lub-dub" heartbeat, low-pass 2 kHz + 120-600 Hz harmonics '
           '(-8 dB) for phone speakers', fout=0.1)

    b = transpose(af(attack_time(src(BODY[3])), hp(40)), -3)
    p = transpose(af(attack_time(src(PUNCH_HEAVY[0])), hp(35)), -4)
    s = af(attack_time(src(SOFT_HEAVY)), hp(30))
    x = af(C.mix((C.norm(b), 0, 1.0), (C.norm(p), 0, dbg(-3)), (C.norm(s), 0, dbg(-6))), lp(2500))
    x = C.mix((x, 0, 1.0), (C.norm(harmonics(x, 150, 4.0, (110, 500))) * C.peak(x), 0, dbg(-9)))
    master_take('p_down', x, 1.0, 'mlsulli', naming(BODY[3]), 'killing blow: body on concrete -3 semitones + Kenney punch -4 '
           'semitones + Kenney soft thud, low-pass 2.5 kHz + harmonics 110-500 Hz (-9 dB)', fout=0.3)
    ENTRIES.append(C.credit('p_down', PACK, 'kenney', naming(PUNCH_HEAVY[0]), 'bass layers'))

    x = af(src(TINNITUS, 1.0, 2.6), hp(1500), lp(6000))
    x = envelope(x, 0.06, 0.75)
    master_take('p_ring', x, 2.5, 'tnturner', naming(TINNITUS), 'isolated 3.1 kHz pure tone (band-pass 1.5-6 kHz: '
           '15.6 and 21.8 kHz components removed), envelope: 60 ms rise, exponential fade-out', fout=0.4)


def build(exclusively=None):
    """Builds the family's masters (only: list of groups for tests)."""
    ENTRIES.clear(); SIGNALS.clear()
    for g in (weaponry, gestures, fallCount, footsteps, bodypart, player):
        if exclusively is None or g.__name__ in exclusively:
            g()
    align_variants()
    if exclusively is None:
        C.write_credits('handling', ENTRIES)
