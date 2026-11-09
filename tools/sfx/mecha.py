"""Mecha family: the mecha of the 11-kill streak (mecha pack, loaded with the match sounds).

Sounds: heavy steps (m_step), joint actuators and motors (m_servo), compressed-air releases (m_hiss), mechanical
clanks (m_clank), structure creaks (m_creak), engine unit hum (m_hum, loop), meteor-like fall
(m_fall: rumble of torn air and fire swelling until impact), ground impact (m_land) and getting back up
(m_rise). Everything comes from real CC0 recordings (see SOURCES), assembled in layers: nothing is synthesized from scratch.

Common processing: mono 48 kHz, start at the attack, fade-out; transients peaking at -1 dBFS (mixing is done
in the game, 05-audio.js); the engine loop is closed by a crossfade (common.loopify)."""
import urllib.parse
import numpy as np
import common as C
from common import SR

PACK = 'mecha'
FALL_PEAK = 2.8  # m_fall: moment when the rumble reaches its loudest (the game aligns it with the impact, MECHA_SND.peak)

SOURCES = {
    'philraco': {
        'naming': '"Hard Stomp Sound" (freesound 512483), largethud.ogg from Space Station 14',
        'creator': 'philRacoIndie (edit by brainfood1183)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/space-wizards/space-station-14/tree/master/Resources/Audio/Effects/Footsteps',
        'proof': "folder's attributions.yml: \"license: \"CC0-1.0\" copyright: \"Made by philRacoIndie freesound.org, modified by brainfood1183\" \"",
    },
    'kenney_impact': {
        'naming': 'Kenney "Impact Sounds" (impactMetal_heavy, impactPlate_heavy), copy from jam-ready-assets',
        'creator': 'Kenney (www.kenney.nl)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/series-ai/jam-ready-assets/tree/main/kenney-impact-sounds',
        'proof': "kenney-impact-sounds/audio/License.txt: \"License: (Creative Commons Zero, CC0)\"",
    },
    'usc_gates': {
        'naming': 'USC sound libraries (Sunset Editorial, Red Library): struck metal barrel, sliding metal door, furnace flame, via Gates',
        'creator': 'University of Southern California (tapes released into the public domain), collected by AnthonE (Gates)',
        'licence': 'CC0 1.0 / public domain',
        'url': 'https://github.com/AnthonE/Gates/tree/main/assets/sound/pd',
        'proof': "assets/sound/MANIFEST.md: \"Every file here is CC0 ... or public domain\"; \"USC Sunset Editorial, Metal barrel being hit with wooden hammer (SSE_Library_METAL, CC0)\", "
                  "\"USC Red Library, R18-37 Sliding Metal Door Closes (Red_Library_Doors, CC0)\", \"USC Red Library, R09-60 Furnace Flame (Red_Library_Fire, CC0)\"",
    },
    'nuckan': {
        'naming': '"hydraulics.wav" (freesound 212941), machine1.ogg and machine2.ogg from digtron',
        'creator': 'nuckan',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/minetest-mods/digtron/tree/master/sounds',
        'proof': "sounds/license.txt: \"machine1.ogg and machine2.ogg - .../nuckan/sounds/212941/ public domain via CC 1.0 by nuckan\"",
    },
    'ivolipa': {
        'naming': '"Compressor_Motor.WAV" (freesound 337447), sounds_compressor_motor_01.ogg from mod-sounds',
        'creator': 'ivolipa',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/AntumMT/mod-sounds/tree/master/sounds',
        'proof': "sources.md: \"| [compressor_motor_01][] | ivolipa | CC0 | loopable | \"",
    },
    'chainsaw_dinner_party': {
        'naming': '"Homemade hydraulic hoist.aif" (freesound 403075), hydraulic_press.ogg from Space Station 14',
        'creator': 'chainsaw_dinner_party',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/space-wizards/space-station-14/tree/master/Resources/Audio/Effects',
        'proof': "folder's attributions.yml: \"Created by chainsaw_dinner_party on Freesound.org. Extended...\" license: \"CC0-1.0\"",
    },
    'brunoboselli': {
        'naming': '"Air (or steam) pressure release" (freesound 457294), pressure_release.ogg from Imp Station 14',
        'creator': 'brunoboselli',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/impstation/imp-station-14/tree/master/Resources/Audio/_Impstation/Anomalocarids',
        'proof': "folder's attributions.yml: \"license: \"CC0-1.0\" copyright: \"Air (or steam) pressure release by brunoboselli\" \"",
    },
    'kieran_keegan': {
        'naming': '"Tank Reload" (freesound 418882), setup.mp3 from Unciv',
        'creator': 'KieranKeegan',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/yairm210/Unciv/tree/master/android/assets/sounds',
        'proof': "docs/Credits.md: \"Tank reload (freesound 418882) By KieranKeegan as 'setup' ... (CC0)\"",
    },
    'mwsfx': {
        'naming': '"Chain Link Fence - Impacts.wav" (freesound 575388), fence_rattle1 to 3 from Space Station 14',
        'creator': 'MWsfx',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/space-wizards/space-station-14/tree/master/Resources/Audio/Effects',
        'proof': "folder's attributions.yml: fence_rattle1-3.ogg, \"Chain Link Fence - Impacts.wav by MWsfx\", license: \"CC0-1.0\"",
    },
    'zerono1': {
        'naming': '"Airplane fly by .wav" (freesound 568128), sounds_jet_flyby.ogg from mod-sounds',
        'creator': 'Zerono1',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/AntumMT/mod-sounds/tree/master/sounds',
        'proof': "sources.md: \"| [jet_flyby][] | Zerono1 | CC0 | \"",
    },
    'klangfabrik': {
        'naming': '"roaring wind.aiff" (freesound 117773), clip 5-117773-A-16 from ESC-50',
        'creator': 'klangfabrik',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/karolpiczak/ESC-50',
        'proof': "ESC-50 LICENSE: \"[5-117773-A.ogg]: clip derived from roaring wind.aiff ... by klangfabrik [CC0]\" (only clips marked CC0 are used)",
    },
    'felix_blume': {
        'naming': '"On a train in Argentina, between two wagons. Metal pieces are squeaking" (freesound 165845), clips 4-165845-A-45 and -B-45 from ESC-50',
        'creator': 'felix.blume',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/karolpiczak/ESC-50',
        'proof': "ESC-50 LICENSE: \"[4-165845-A.ogg]: clip derived from ... Metal pieces are squeaking ... by felix.blume [CC0]\"",
    },
    'carroll27': {
        'naming': '"Mechanical drone.aif" (freesound 151917), thruster-droning.ogg from Frontier Station 14',
        'creator': 'carroll27',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/new-frontiers-14/frontier-station-14/tree/master/Resources/Audio/_NF/Effects/Scrapbots',
        'proof': "folder's attributions.yml: \"license: \"CC0-1.0\" copyright: \"Edited from carroll27's 'Mechanical drone.aif'\" \"",
    },
}

FILES = {}


def _url(depot, branch_snd, pathway, lfs=False):
    base = 'https://media.githubusercontent.com/media' if lfs else 'https://raw.githubusercontent.com'
    return f'{base}/{depot}/{branch_snd}/' + urllib.parse.quote(pathway)


def _f(rel, url):
    FILES[rel] = url
    return rel


SS14 = lambda pathway: _url('space-wizards/space-station-14', 'master', 'Resources/Audio/' + pathway)
STOMP = _f('ss14/largethud.ogg', SS14('Effects/Footsteps/largethud.ogg'))
KENNEY = [_f(f'kenney/impactMetal_heavy_00{i}.ogg', _url('series-ai/jam-ready-assets', 'main', f'kenney-impact-sounds/audio/Audio/impactMetal_heavy_00{i}.ogg', lfs=True)) for i in range(5)]
PLATE = [_f(f'kenney/impactPlate_heavy_00{i}.ogg', _url('series-ai/jam-ready-assets', 'main', f'kenney-impact-sounds/audio/Audio/impactPlate_heavy_00{i}.ogg', lfs=True)) for i in range(5)]
BARREL = [_f(f'gates/impact_metal_{i}.ogg', _url('AnthonE/Gates', 'main', f'assets/sound/pd/impact_metal_{i}.ogg')) for i in range(5)]
DOOR = [_f(f'gates/garage_{k}_0.ogg', _url('AnthonE/Gates', 'main', f'assets/sound/pd/garage_{k}_0.ogg')) for k in ('open', 'close')]
FURNACE = _f('gates/bed_furnace_0.ogg', _url('AnthonE/Gates', 'main', 'assets/sound/pd/bed_furnace_0.ogg'))
FLAME = _f('gates/furnace_light_0.ogg', _url('AnthonE/Gates', 'main', 'assets/sound/pd/furnace_light_0.ogg'))
ACTUATOR = [_f(f'digtron/machine{i}.ogg', _url('minetest-mods/digtron', 'master', f'sounds/machine{i}.ogg')) for i in (1, 2)]
MOTOR = _f('modsounds/sounds_compressor_motor_01.ogg', _url('AntumMT/mod-sounds', 'master', 'sounds/sounds_compressor_motor_01.ogg'))
PLANE = _f('modsounds/sounds_jet_flyby.ogg', _url('AntumMT/mod-sounds', 'master', 'sounds/sounds_jet_flyby.ogg'))
HYDRAULIC = _f('ss14/hydraulic_press.ogg', SS14('Effects/hydraulic_press.ogg'))
TRIGGER = _f('imp/pressure_release.ogg', _url('impstation/imp-station-14', 'master', 'Resources/Audio/_Impstation/Anomalocarids/pressure_release.ogg'))
CLACK = _f('unciv/setup.mp3', _url('yairm210/Unciv', 'master', 'android/assets/sounds/setup.mp3'))
WIRE_MESH = [_f(f'ss14/fence_rattle{i}.ogg', SS14(f'Effects/fence_rattle{i}.ogg')) for i in (1, 2, 3)]
WIND = _f('esc50/5-117773-A-16.wav', _url('karolpiczak/ESC-50', 'master', 'audio/5-117773-A-16.wav'))
SQUEAK = [_f(f'esc50/4-165845-{k}-45.wav', _url('karolpiczak/ESC-50', 'master', f'audio/4-165845-{k}-45.wav')) for k in ('A', 'B')]
RUMBLE = _f('frontier/thruster-droning.ogg', _url('new-frontiers-14/frontier-station-14', 'master', 'Resources/Audio/_NF/Effects/Scrapbots/thruster-droning.ogg'))

ENTRIES = []


def L(rel, start=None, dur=None):
    return C.load(C.SRC / rel, start=start, dur=dur)


def slowed(x, k):
    """Slows down and lowers pitch by a factor k (k < 1: heavier, like a slowed tape)."""
    return C.ff(x, f'asetrate={int(SR * k)},aresample={SR}')


def env(x, pts):
    """Envelope by points (time in s, linear gain), interpolated."""
    t = np.arange(len(x)) / SR; T, G = zip(*pts)
    return x * np.interp(t, T, G)


def master(sid, x, sources, detail='', dbfs=-1.0, fout=0.06):
    x = C.fade(C.trim(x, -60), 0.002, fout)
    C.save_master(PACK, sid, C.norm(x, dbfs))
    for src, f in sources: ENTRIES.append(C.credit(sid, PACK, src, f, detail))


def build():
    ENTRIES.clear()
    stomp, trigger_snd = L(STOMP), C.ff(L(TRIGGER), 'highpass=f=1500')
    # step: very deep hit of the slowed stomp and its sub sound (filtered below 220 Hz), heavy metal plate, barrel resonating lower, rubble
    # rattling, brief blow of air from an actuator; a short echo (the mass ringing in the street), then the tail fades out (owner's feedback:
    # "too dry, it lacks big steps")
    for i in range(4):
        x = C.mix((C.ff(slowed(stomp, 0.74), 'lowpass=f=2800'), 0, 1.0), (C.ff(slowed(stomp, 0.5), 'lowpass=f=200'), 0, 0.85),
                  (slowed(L(KENNEY[i]), 0.6), 0.008, 0.25), (slowed(L(BARREL[i]), 0.5), 0.012, 0.32),
                  (C.ff(L(WIRE_MESH[i % 3]), 'highpass=f=900'), 0.04, 0.12), (C.fade(trigger_snd[int(0.05 * SR):int(0.45 * SR)], 0.03, 0.2), 0.15, 0.1))
        x = env(C.ff(x, 'aecho=0.8:0.6:40|90:0.25|0.12'), [(0, 1), (0.12, 1), (0.5, 0.4), (1.0, 0.12), (1.4, 0.03)]) # (strike, body, then the tail fades out)
        master(f'm_step-{i + 1}', x[:int(1.4 * SR)], [('philraco', STOMP), ('kenney_impact', KENNEY[i]), ('usc_gates', BARREL[i]), ('mwsfx', WIRE_MESH[i % 3]), ('brunoboselli', TRIGGER)], 'slowed, layered, short echo', fout=0.3)
    # joint actuators: the hydraulic pump and the compressor motor, in short rise-and-fall swells
    pump, motor = [L(v) for v in ACTUATOR], L(MOTOR)
    for i, (src, a, k) in enumerate([(0, 0.0, 1.15), (1, 0.75, 1.0), (1, 1.9, 1.3)]):
        p = slowed(pump[src][int(a * SR):int((a + 0.5) * SR)], k); m = slowed(motor[int(i * SR):int((i + 0.7) * SR)], 1.5)
        n = min(len(p), len(m)); x = env(p[:n], [(0, 0), (0.05, 1), (0.3, 0.8), (0.42, 0)]) + env(m[:n], [(0, 0), (0.1, 0.5), (0.3, 0.3), (0.42, 0)])
        master(f'm_servo-{i + 1}', x, [('nuckan', ACTUATOR[src]), ('ivolipa', MOTOR)], 'clips, enveloped', fout=0.08)
    # compressed-air releases
    d = L(TRIGGER)
    master('m_hiss-1', C.ff(d[:int(1.3 * SR)], 'highpass=f=300'), [('brunoboselli', TRIGGER)], 'excerpt', fout=0.4)
    master('m_hiss-2', slowed(C.ff(d[int(0.1 * SR):int(0.8 * SR)], 'highpass=f=300'), 0.85), [('brunoboselli', TRIGGER)], 'slowed excerpt', fout=0.25)
    # mechanical clanks: tank breech, stop of a metal door, barrel and plate struck together
    doorway = L(DOOR[1])
    master('m_clank-1', slowed(L(CLACK), 0.8), [('kieran_keegan', CLACK)], 'slowmo')
    master('m_clank-2', slowed(doorway[int(1.75 * SR):], 0.85), [('usc_gates', DOOR[1])], 'final stop, slowed', fout=0.15)
    master('m_clank-3', C.mix((slowed(L(BARREL[2]), 0.7), 0, 1.0), (slowed(L(PLATE[1]), 0.7), 0.0, 0.5)), [('usc_gates', BARREL[2]), ('kenney_impact', PLATE[1])], 'slowed, layered')
    # structure creaks: the wagons rubbing, slowed and muffled
    for i, (k, a) in enumerate([(0, 0.25), (1, 1.1)]):
        g = slowed(C.ff(L(SQUEAK[k], start=a, dur=1.3), 'lowpass=f=5000'), 0.75)
        master(f'm_creak-{i + 1}', env(g, [(0, 0), (0.08, 1), (1.2, 0.7), (1.7, 0)]), [('felix_blume', SQUEAK[k])], 'slowed excerpt', fout=0.25)
    # engine unit: looping mechanical rumble
    h = C.loopify(C.ff(L(RUMBLE), 'lowpass=f=1800'), 0.6)
    C.save_master(PACK, 'm_hum', C.norm(h, -3)); ENTRIES.append(C.credit('m_hum', PACK, 'carroll27', RUMBLE, 'looping'))
    # meteor-like fall: roaring wind, airplane pass and furnace flame, in a crescendo up to the peak (FALL_PEAK s), then the rumble is
    # held at its loudest up to 4 s: the game cuts it at the real impact (a fall shown late on a slow phone stays covered)
    D = 4.0; P = FALL_PEAK
    pts = [(0, 0.03), (P * 0.5, 0.25), (P * 0.86, 0.85), (P, 1), (D, 1)]
    wind = env(L(WIND, dur=D), pts)
    plane = env(L(PLANE, start=9.0, dur=D), [(0, 0.05), (P * 0.7, 0.4), (P, 1), (D, 1)])
    fire_snd = env(L(FURNACE, start=2.0, dur=D), [(0, 0.0), (P * 0.36, 0.15), (P * 0.86, 0.6), (P, 1), (D, 1)])
    x = C.mix((wind, 0, 0.9), (slowed(plane, 0.85)[:int(D * SR)], 0, 0.8), (fire_snd, 0, 0.7))
    x = C.fade(x[:int(D * SR)], 0.3, 0.05)
    C.save_master(PACK, 'm_fall', C.norm(x, -1))
    for s_, f in [('klangfabrik', WIND), ('zerono1', PLANE), ('usc_gates', FURNACE)]: ENTRIES.append(C.credit('m_fall', PACK, s_, f, 'built-up crescendo, sustained rumble'))
    # impact: the very slowed stomp, the door and the plate, the air expelled from the actuators and the rattling fence (debris)
    x = C.mix((slowed(stomp, 0.55), 0, 1.0), (slowed(doorway[int(1.75 * SR):], 0.6), 0.0, 0.5), (slowed(L(KENNEY[1]), 0.55), 0.0, 0.45),
              (C.ff(d, 'highpass=f=400')[:int(2.0 * SR)], 0.3, 0.35), (L(WIRE_MESH[1]), 0.08, 0.6), (L(WIRE_MESH[2]), 0.2, 0.5))
    master('m_land', x, [('philraco', STOMP), ('usc_gates', DOOR[1]), ('kenney_impact', KENNEY[1]), ('brunoboselli', TRIGGER), ('mwsfx', WIRE_MESH[1]), ('mwsfx', WIRE_MESH[2])], 'layered', fout=0.4)
    # getting back up: the actuator pushing, the pump whistling, a latch clack and the released air
    hy = env(slowed(L(HYDRAULIC, start=1.0, dur=1.6), 0.9), [(0, 0), (0.15, 1), (1.3, 0.9), (1.75, 0)])
    sv = env(L(ACTUATOR[1], start=0.8, dur=1.2), [(0, 0), (0.1, 0.7), (1.0, 0.5), (1.2, 0)])
    x = C.mix((hy, 0, 1.0), (sv, 0.2, 0.6), (slowed(L(CLACK), 0.75), 1.55, 0.8), (C.ff(d, 'highpass=f=400')[:int(0.7 * SR)], 1.7, 0.4))
    master('m_rise', x, [('chainsaw_dinner_party', HYDRAULIC), ('nuckan', ACTUATOR[1]), ('kieran_keegan', CLACK), ('brunoboselli', TRIGGER)], 'layered', fout=0.3)
    C.write_credits('mecha', ENTRIES)
