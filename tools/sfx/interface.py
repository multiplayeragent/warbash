""""Interface" family: menu and equipment sounds (ui pack).

Understated, military, mechanical: real switches (Kenney UI Audio), real weapon parts (handling tracks of
The Free Firearm Sound Library: stock, selector, bolt), foley by Jan Schupke and OwlishMedia
(handcuff ratchet, velcro, sprayer, cloth), air whooshes from BigSoundBank, a real radio squelch
(JovianSounds) and orchestral percussion from VSCO 2 CE (bass drum, brake drum) for "deploy".
No sound is synthesized: the sounds without a dedicated take (tab, locked, unlock, camouflage, deploy) are
composed of real layers. No app beeps, no arpeggios, no 8-bit sounds.

Common processing: mono 48 kHz, high-pass adapted to each sound, start at the attack (1 ms kept at most),
fade-out, peak at -1 dBFS (mixing is done in the game). The cut times come from the analysis of the
sources (envelope and spectrogram)."""
import urllib.parse
import numpy as np
import common as C
from common import SR

PACK = 'ui'

SOURCES = {
    'kenney_ui_audio': {
        'naming': 'Kenney "UI Audio" (Godot mirror by Calinou)',
        'creator': 'Kenney (www.kenney.nl)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/Calinou/kenney-ui-audio',
        'proof': "addons/kenney_ui_audio/LICENSE.txt: \"UI SFX Set by Kenney Vleugels (Kenney.nl) ... License (Creative "
                  "Commons Zero, CC0) http://creativecommons.org/publicdomain/zero/1.0/\"",
    },
    'kenney': {
        'naming': 'Kenney "RPG Audio", "Foley Sounds", "Impact Sounds"',
        'creator': 'Kenney (www.kenney.nl)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/series-ai/jam-ready-assets',
        'proof': "License.txt of each pack: \"License: (Creative Commons Zero, CC0) http://creativecommons.org/"
                  "publicdomain/zero/1.0/\"",
    },
    'ffsl': {
        'naming': 'The Free Firearm Sound Library ("Master Tracks" handling tracks)',
        'creator': 'Ben Jaszczak et al. (Still North Media)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/buddingmonkey/FreeFirearmsSFXLibrary',
        'proof': "repo LICENSE: full text \"CC0 1.0 Universal\"; OpenGameArt page: \"The team holds CC0 "
                  "NO RIGHTS RESERVED for this library. It may be used without royalty or credit\"",
    },
    'schupke': {
        'naming': '"Fantasy Accessory / Weapons and Apparel SFX Library" (FLAC)',
        'creator': 'Jan Schupke "Vehicle" (vehiclemusic.eu)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/JanTheLynx/free-game-sfx/tree/master/sound/Jan_Schupke-public_domain_sfx',
        'proof': "readme.txt in the folder: \"Author: Jan Schupke 'Vehicle' ... License: Public Domain "
                  "(https://creativecommons.org/publicdomain/zero/1.0/); Origin: opengameart.org/content/fantasy-"
                  "accessory-sfx-library\"",
    },
    'owlishmedia': {
        'naming': '"202 More Sound Effects" (velcro, cloth, sprayer, lock)',
        'creator': 'OwlishMedia (opengameart.org)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/1993velezpadilla-source/config-old-3/tree/main/assets/audio/cc0_horror_library/'
               'household_foley_owlishmedia',
        'proof': "SOURCE.txt in the folder: \"Title: 202 More Sound Effects ; Creator: OwlishMedia ; License: CC0 / Public "
                  "Domain dedication ; Source: https://opengameart.org/content/202-more-sound-effects\"; same pack "
                  "declared CC0-1.0 by novincode/atomcut-library",
    },
    'bigsoundbank': {
        'naming': 'BigSoundBank "Whoosh #4, #5, #9" (s1796, s1797, s1802)',
        'creator': 'Joseph Sardin (bigsoundbank.com)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/hugohe3/ppt-master/tree/main/skills/ppt-master/templates/sounds/bigsoundbank',
        'proof': "templates/sounds/THIRD_PARTY_NOTICES.md: \"BigSoundBank identifies the selected files as \"CC0 (public "
                  "domain): Free and royalty-free\" ... The individual source pages identify Joseph Sardin as the author\"; "
                  "templates/sounds/sounds_index.json: https://bigsoundbank.com/whoosh-4-s1796.html, license CC0-1.0 "
                  "(same SHA-256 hash as the downloaded files)",
    },
    'jovian': {
        'naming': '"Radio Sign Off / Squelch" (freesound 524205)',
        'creator': 'JovianSounds',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/JovianSounds/sounds/524205/',
        'proof': "CREDITS.md of papegaaij/conceptgame: \"assets/sfx/ui-radio-close-r08-a.ogg | Radio Sign Off / Squelch "
                  "| JovianSounds | freesound 524205 | CC0 1.0\"",
    },
    'vsco2': {
        'naming': 'VS Chamber Orchestra: Community Edition (percussions)',
        'creator': 'Versilian Studios (Sam Gossner, Simon Dalzell)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/sgossner/VSCO-2-CE',
        'proof': "repo LICENSE: full text \"CC0 1.0 Universal\"; Readme.txt: \"You are permitted to use these "
                  "samples for ANY purpose\" (credit requested by Versilian Studios)",
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


def _kui(naming):              # 'switch10'
    return _f(f'kenney-ui-audio/{naming}.wav', _url('Calinou/kenney-ui-audio', 'master', f'addons/kenney_ui_audio/{naming}.wav'))


def _ken(pathway):           # 'kenney-rpg-audio/audio/Audio/metalLatch.ogg'
    return _f('kenney/' + pathway, _url('series-ai/jam-ready-assets', 'main', pathway, lfs=True))


def _ffsl(code):            # 'AR-15/D_17'
    return _f(f'ffsl/{code}.wav', _url('buddingmonkey/FreeFirearmsSFXLibrary', 'main', f'Master Tracks/{code}.wav'))


def _jan(naming):
    return _f(f'schupke/{naming}', _url('JanTheLynx/free-game-sfx', 'master', f'sound/Jan_Schupke-public_domain_sfx/assets/{naming}'))


def _owl(folder, naming):
    return _f(f'owlishmedia/{naming}', _url('1993velezpadilla-source/config-old-3', 'main',
                                         f'assets/audio/cc0_horror_library/household_foley_owlishmedia/{folder}/{naming}'))


def _bsb(n):
    return _f(f'bigsoundbank/{n}.wav', _url('hugohe3/ppt-master', 'main', f'skills/ppt-master/templates/sounds/bigsoundbank/{n}.wav'))


def _vsco(pathway):
    return _f(f'vsco/{pathway}', _url('sgossner/VSCO-2-CE', 'master', pathway))    # same local folder as series.py


KR = 'kenney-rpg-audio/audio/Audio/'
KF = 'kenney-foley-sounds/audio/Audio/'
KI = 'kenney-impact-sounds/audio/Audio/'

SWITCH = {n: _kui(f'switch{n}') for n in (1, 2, 3, 4, 5, 6, 7, 8, 10, 11)}
LATCH = _ken(KR + 'metalLatch.ogg')
BOOK_PLACE = _ken(KR + 'bookPlace2.ogg')
BOOK_CLOSE = _ken(KR + 'bookClose.ogg')
PUNCH_HEAVY = _ken(KI + 'impactPunch_heavy_000.ogg')
HELMET = _ken(KF + 'Swords/hitHelmet2.ogg')

STOCK_OUT, STOCK_IN = _ffsl('AR-15/D_17'), _ffsl('AR-15/D_18')     # stock deployed / folded
AK_SELECT = _ffsl('AK-47/C_4')                                       # fire selector
BOLT_DROP = _ffsl('AR-15/D_13')                                      # bolt released, full magazine
AR_DRY = _ffsl('AR-15/D_16')                                         # dry click

CUFFS = _jan('handcuffs-metal-lock-01.flac')

VELCRO = _owl('Velcro', 'Velcro_02.wav')
CLOTH = _owl('Cloth', 'Cloth_04.wav')
SPRAY = _owl('Misc', 'Nasal_Spray.wav')
LOCK_RATTLE = _owl('Keys, Locks, Door', 'Key_Lock_Door_33.wav')

WHOOSH_GO, WHOOSH_CLOSE, WHOOSH_OPEN = _bsb('1796'), _bsb('1797'), _bsb('1802')

SQUELCH = _f('conceptgame/ui-radio-close-r08-a.ogg',
             _url('papegaaij/conceptgame', 'main', 'assets/sfx/ui-radio-close-r08-a.ogg', lfs=True))

BDRUM = _vsco('Percussion/BDrumNewhit_v7_rr1_Sum.wav')
BRAKE = _vsco('Percussion/BrakeDrum1_Hammer_v3_Sum.wav')


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


def attack_time(x, cutpoint=-30.0, pre=0.001):
    """Cuts the head: starts pre seconds before the first sample at cutpoint dB under the peak."""
    return C.trim(x, cutpoint, pre)


def cut_at(x, duration_s, fout):
    """Keeps duration_s seconds, fade-out of fout seconds (soft curve)."""
    return C.fade(x[:int(duration_s * SR)], 0, min(fout, len(x[:int(duration_s * SR)]) / SR), 2.0)


def piece(x, outro=0.001):
    """Layer ready to stack: normalized, with a short fade-in (no click when it starts late)."""
    return C.fade(C.norm(x), outro, 0.0)


def envelope(x, rises=0.0, tau=None):
    """Linear rise (s) then exponential decay with constant tau (s)."""
    t = np.arange(len(x)) / SR
    e = np.minimum(1, t / rises) if rises > 0 else np.ones(len(x))
    if tau: e = e * np.exp(-t / tau)
    return x * e


def t_crest(x):
    """Time of the peak (s)."""
    return int(np.argmax(np.abs(x))) / SR


ENTRIES = []


def master_take(sid, x, dmax, source, filepath, detail, fout=0.03, end_threshold=-64.0):
    """Finishes a master: cuts the end below end_threshold, limits to dmax seconds, fades, peak -1 dBFS, writing, credit."""
    x = np.asarray(x, dtype=np.float64)
    x = x[:C.tail_end(x, end_threshold)]
    if len(x) > int(dmax * SR):
        x = x[:int(dmax * SR)]
        fout = max(fout, min(0.12, dmax * 0.35))
    x = C.fade(x, 0.001, min(fout, len(x) / SR * 0.5))
    x = C.norm(x, -1.0)
    C.save_master(PACK, sid, x)
    ENTRIES.append(C.credit(sid, PACK, source, filepath, detail))
    return x


def layer_of(sid, source, filepath, detail):
    """Credit for an additional layer of a master."""
    ENTRIES.append(C.credit(sid, PACK, source, filepath, detail))


def naming(rel):
    return rel.split('/', 1)[1]


def num(v, n=2):
    """Decimal number written for the credits."""
    return f'{v:.{n}f}'


def ffsl(rel, startpoint, duration_s, hpf=120, cutpoint=-30.0):
    """Excerpt of an FFSL track (192 kHz, several takes): high-pass, start at the attack."""
    return attack_time(af(src(rel, startpoint, duration_s), hp(hpf)), cutpoint)


# ---------------------------------------------------------------------------------------------------------------------
# Hover, click, back, tab, notch

def button_list():
    # hover: start of a real switch (at its main attack), muffled and limited to 40 ms. The three takes have
    # the same perceived level within 0.4 dB (switch2, more sustained, would be 2.6 dB louder here: it is used for the click)
    for k, n in enumerate((3, 5, 8)):
        x = attack_time(af(src(SWITCH[n]), hp(250), lp(4500)), -16)
        x = cut_at(x, 0.04, 0.028)
        master_take(f'ui_hover-{k + 1}', x, 0.04, 'kenney_ui_audio', naming(SWITCH[n]),
               f'switch{n}: 40 ms from the attack, band-pass 250 Hz-4.5 kHz (muffled tick), fade 28 ms')

    # click: crisp mechanical switch, a bit of body under 250 Hz; three takes of the same timbre, with body between
    # 0.5 and 2 kHz (switch3, almost without body and centered around 6 kHz, would sound like another button: it is used for hover)
    for k, n in enumerate((10, 11, 2)):
        x = attack_time(af(src(SWITCH[n]), hp(110), eq(220, 3, 1.0)), -16)
        x = cut_at(x, 0.15, 0.09)
        master_take(f'ui_click-{k + 1}', x, 0.15, 'kenney_ui_audio', naming(SWITCH[n]),
               f'switch{n}: start at the attack, 0.15 s, high-pass 110 Hz, +3 dB at 220 Hz')

    # back: softer switch, transposed down and muffled
    for k, (n, tr) in enumerate(((4, -4), (6, -3))):
        x = attack_time(af(src(SWITCH[n]), hp(100), lp(5000)), -16)
        x = transpose(x, tr)
        x = cut_at(x, 0.2, 0.11)
        master_take(f'ui_back-{k + 1}', x, 0.2, 'kenney_ui_audio', naming(SWITCH[n]),
               f'switch{n} transposed {tr} semitones, low-pass 5 kHz, 0.2 s')

    # tab: switch tick + short slide of an AR-15 stock on its tube (FFSL D_17, before the clack)
    for k, (n, start_s) in enumerate(((1, 11.605), (7, 9.705))):
        tic = attack_time(af(src(SWITCH[n]), hp(200)), -16)
        tic = cut_at(tic, 0.12, 0.08)
        gl = af(src(STOCK_OUT, start_s, 0.14), hp(700), lp(9000))
        gl = C.fade(envelope(gl, 0.015), 0, 0.07, 2.0)
        x = C.mix((piece(tic), 0, 1.0), (piece(gl), 0.01, dbg(-10)))
        sid = f'ui_tab-{k + 1}'
        master_take(sid, x, 0.2, 'kenney_ui_audio', naming(SWITCH[n]),
               f'switch{n} (tick) + AR-15 FFSL D_17 stock slide ({num(start_s, 3)}-{num(start_s + 0.14, 3)} s, band-pass '
               '700 Hz-9 kHz, -10 dB, at 10 ms)')
        layer_of(sid, 'ffsl', naming(STOCK_OUT), 'slide layer')

    # slider notch: one tooth of the handcuff ratchet (Jan Schupke), 40 ms
    x = attack_time(af(src(CUFFS, 0.358, 0.08), hp(600)), -12)
    x = cut_at(x, 0.04, 0.026)
    master_take('ui_tick', x, 0.04, 'schupke', naming(CUFFS), 'one ratchet tooth (0.363 s), high-pass 600 Hz, 40 ms')


# ---------------------------------------------------------------------------------------------------------------------
# Panels: open, close, confirm, error, notification

def panel_list():
    # open: short velcro rip (tactical vest) + puff of air opening
    v = af(src(VELCRO, 0.15, 0.2), hp(300), lp(9000))
    v = C.fade(attack_time(v, -20)[:int(0.12 * SR)], 0.001, 0.05, 2.0)
    w = attack_time(af(src(WHOOSH_OPEN), hp(150)), -26)
    x = C.mix((piece(v), 0, 1.0), (piece(w), 0.0, dbg(-2)))
    master_take('ui_open', x, 0.5, 'owlishmedia', naming(VELCRO), 'velcro Velcro_02 (0.15-0.27 s, band-pass 300 Hz-9 kHz) + '
           'BigSoundBank s1802 whoosh (start at -26 dB under its peak, -2 dB)', fout=0.12)
    layer_of('ui_open', 'bigsoundbank', naming(WHOOSH_OPEN), 'whoosh layer')

    # close: lower whoosh + muffled cloth flap
    w = attack_time(af(src(WHOOSH_CLOSE), hp(120)), -22)
    pk = int(np.argmax(np.abs(w))) / SR
    r = attack_time(af(src(BOOK_CLOSE), hp(80), lp(1800)), -30)
    x = C.mix((piece(w), 0, 1.0), (piece(r), max(0.0, pk - 0.02), dbg(-5)))
    master_take('ui_close', x, 0.4, 'bigsoundbank', naming(WHOOSH_CLOSE), f'whoosh s1797 (start at -22 dB under its peak) + flap: '
           f'Kenney bookClose low-pass 1.8 kHz (-5 dB, at {num(max(0.0, pk - 0.02))} s)', fout=0.12)
    layer_of('ui_close', 'kenney', naming(BOOK_CLOSE), 'flap layer')

    # confirm: metal latch (Kenney RPG metalLatch)
    x = attack_time(af(src(LATCH), hp(90)), -30)
    master_take('ui_confirm', x, 0.4, 'kenney', naming(LATCH), 'metal latch metalLatch, high-pass 90 Hz')

    # soft error: double dull thud (book set down flat: the second hit, taken a tone lower)
    k = attack_time(af(src(BOOK_PLACE, 0.075, 0.28), hp(70), lp(1600)), -12)
    k = transpose(k, -3)
    k2 = transpose(k, -2)
    x = C.mix((piece(k), 0, 1.0), (piece(k2), 0.09, dbg(-2)))
    master_take('ui_error', x, 0.35, 'kenney', naming(BOOK_PLACE), 'bookPlace2 dull thud (second impact, 0.08 s), low-pass '
           '1.6 kHz, transposed -3 semitones, doubled 90 ms later a tone lower (-2 dB)', fout=0.1)

    # notification: real end-of-transmission radio squelch
    x = attack_time(af(src(SQUELCH), hp(200)), -30)
    master_take('ui_notify', x, 0.5, 'jovian', naming(SQUELCH), 'radio squelch, high-pass 200 Hz', fout=0.08)


# ---------------------------------------------------------------------------------------------------------------------
# Equipment: attachment fitted / removed, camouflage, locked, unlocked

def slip_snd(start_s=11.605, duration_s=0.14):
    """Slide of the AR-15 stock on its tube, before the clack (FFSL D_17)."""
    return af(src(STOCK_OUT, start_s, duration_s), hp(500), lp(8000))


def equipment():
    # attachment fitted: brief slide on the rail (raised by 12 dB) then locking clack (AR-15 stock)
    x = af(src(STOCK_OUT, 11.715, 0.45), hp(150))
    i = int((11.757 - 11.715) * SR)
    g = np.ones(len(x)); g[:i] = dbg(12)
    r = int(0.004 * SR); g[i - r:i] = np.linspace(dbg(12), 1, r)
    x = x * g
    master_take('ui_equip', x, 0.4, 'ffsl', naming(STOCK_OUT), 'AR-15: stock deployed (D_17, take 4, 11.715-12.115 s): end of the '
           'slide raised by 12 dB then locking clack at 42 ms, high-pass 150 Hz', fout=0.12)

    # attachment removed: unlocking clack (folded stock D_18) then receding slide
    clac = ffsl(STOCK_IN, 3.48, 0.35, 150, -30)
    gl = C.fade(envelope(slip_snd(), 0.01, 0.09), 0, 0.05, 2.0)
    x = C.mix((piece(clac), 0, 1.0), (piece(gl), 0.04, dbg(-11)))
    master_take('ui_unequip', x, 0.4, 'ffsl', naming(STOCK_IN), 'AR-15: folded stock clack (D_18, 3.48 s) + slide of the '
           'stock (D_17, 11.605-11.745 s, band-pass 500 Hz-8 kHz, -11 dB, at 40 ms)', fout=0.12)
    layer_of('ui_unequip', 'ffsl', naming(STOCK_OUT), 'slide layer')

    # camouflage: short spray (pump sprayer) + cloth rustle
    p = attack_time(af(src(SPRAY), hp(400)), -30)
    t = attack_time(af(src(CLOTH), hp(150)), -30)
    x = af(C.mix((piece(p), 0, 1.0), (piece(t), 0.0, dbg(-9))), lp(13000))
    master_take('ui_camo', x, 0.6, 'owlishmedia', naming(SPRAY), 'Nasal_Spray sprayer (press and release), high-pass '
           '400 Hz + Cloth_04 rustle (high-pass 150 Hz, -9 dB), low-pass 13 kHz on the whole', fout=0.12)
    layer_of('ui_camo', 'owlishmedia', naming(CLOTH), 'rustle layer')

    # locked: handle hitting its stop (dull lock rattle) + AR-15 dry click
    r = attack_time(af(src(LOCK_RATTLE), hp(90), lp(2500)), -24)
    d = ffsl(AR_DRY, 0.30, 0.2, 200, -30)
    x = C.mix((piece(r), 0, 1.0), (piece(d), 0.0, dbg(-8)))
    master_take('ui_locked', x, 0.35, 'owlishmedia', naming(LOCK_RATTLE), 'locked handle Key_Lock_Door_33 (band-pass '
           '90 Hz-2.5 kHz) + AR-15 dry click FFSL D_16 (-8 dB)', fout=0.1)
    layer_of('ui_locked', 'ffsl', naming(AR_DRY), 'dry click layer')

    # unlocked: AK-47 selector clack + ring (helmet) + metallic resonance (brake drum, pitched up)
    clac = ffsl(AK_SELECT, 3.70, 0.4, 150, -30)
    ting = transpose(attack_time(af(src(HELMET), hp(1200)), -30), 2)
    fm = transpose(attack_time(af(src(BRAKE), hp(800), lp(9000)), -30), 5)
    fm = envelope(fm, 0, 0.45)
    x = C.mix((piece(clac), 0, 1.0), (piece(ting), 0.06, dbg(-8)), (piece(fm), 0.06, dbg(-12)))
    master_take('ui_unlock', x, 1.2, 'ffsl', naming(AK_SELECT), 'AK-47: selector clack (C_4, 3.70 s) + Kenney ring '
           'hitHelmet2 transposed +2 semitones, high-pass 1.2 kHz (-8 dB, at 60 ms) + VSCO brake drum transposed '
           '+5 semitones, band-pass 0.8-9 kHz, decay 0.45 s (-12 dB, at 60 ms)', fout=0.3)
    layer_of('ui_unlock', 'kenney', naming(HELMET), 'jingle layer')
    layer_of('ui_unlock', 'vsco2', naming(BRAKE), 'resonance layer')


# ---------------------------------------------------------------------------------------------------------------------
# Deploy: rising whoosh, low impact, metallic tail

def deploy_snd():
    # rising whoosh: rise of whoosh s1796, transposed by -4 semitones and slowed (broader), up to its peak
    w = af(transpose(af(src(WHOOSH_GO), hp(100)), -4), 'atempo=0.8')
    i = int(np.argmax(np.abs(w)))
    w = attack_time(w[:i + int(0.01 * SR)], -38, 0.0)
    w = C.fade(w, 0.002, 0.012, 1.0)
    t_imp = len(w) / SR - 0.01
    gc = attack_time(af(src(BDRUM), hp(30)), -30)[:int(1.6 * SR)]
    gc = envelope(gc, 0, 0.6)
    po = attack_time(af(src(PUNCH_HEAVY), hp(40), lp(3000)), -30)
    me = ffsl(BOLT_DROP, 0.33, 0.6, 150, -30)
    fm = attack_time(af(src(BRAKE), hp(300), lp(7000)), -30)
    fm = transpose(fm, -5)
    fm = envelope(fm, 0, 0.5)
    # the layers' peaks land together on that of the bass drum: the bolt (slide then clack 48 ms
    # later) therefore starts before the impact, during the end of the whoosh, instead of clacking late (double hit)
    t_pk = t_imp + t_crest(gc)
    x = C.mix((piece(w, 0.002), 0, dbg(-5)), (piece(gc), t_imp, 1.0), (piece(po), max(0.0, t_pk - t_crest(po)), dbg(-5)),
              (piece(me), max(0.0, t_pk - t_crest(me)), dbg(-4)), (piece(fm), t_imp + 0.01, dbg(-8)))
    x = af(x, 'acompressor=threshold=0.25:ratio=3:attack=5:release=120:makeup=1')
    master_take('ui_go', x, 1.8, 'vsco2', naming(BDRUM), 'rise of BigSoundBank whoosh s1796 transposed -4 semitones and slowed '
           f'at 80% ({num(t_imp)} s, -5 dB), then impact (peaks aligned at {num(t_pk, 3)} s): VSCO bass drum '
           'BDrumNewhit_v7 + Kenney impactPunch_heavy_000 hit (low-pass 3 kHz, -5 dB) + released AR-15 bolt FFSL D_13 '
           '(-4 dB); tail: VSCO brake drum transposed -5 semitones (-8 dB); soft compression', fout=0.5)
    layer_of('ui_go', 'bigsoundbank', naming(WHOOSH_GO), 'whoosh layer')
    layer_of('ui_go', 'kenney', naming(PUNCH_HEAVY), 'hit layer')
    layer_of('ui_go', 'ffsl', naming(BOLT_DROP), 'metallic layer')
    layer_of('ui_go', 'vsco2', naming(BRAKE), 'metallic tail')


def build(exclusively=None):
    """Builds the family's masters (only: list of groups for tests)."""
    ENTRIES.clear()
    for g in (button_list, panel_list, equipment, deploy_snd):
        if exclusively is None or g.__name__ in exclusively:
            g()
    if exclusively is None:
        C.write_credits('interface', ENTRIES)
