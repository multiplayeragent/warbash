""""Ambiences" family: ambience beds and one-shots of the maps (packs amb_chergui, amb_saintgivre, amb_portmael, amb_floralia, amb_notos,
amb_scoria, amb_cirrus).

Each pack has a loopable stereo bed (a_bed, 27 s, RMS -20 dBFS) and mono one-shots (peak -3 dBFS,
6 s at most) that the game scatters in space; a few one-shots are mono loops (fountain, surf, waterfall).
Everything comes from real recordings under CC0, public domain or CC BY, found as copies on GitHub (Freesound,
BigSoundBank, Wikimedia Commons): see SOURCES. Sounds with no exact recording (halyards against a mast, buoy bell,
snow sliding off a roof) are composed from real layers; nothing is synthesized.

Beds: long layers chosen with no prominent event (no voice, nearby engine or recognizable bird),
filtered (high-pass against wind rumble on the mic, low-pass for distance), mixed then looped
by a long constant-power crossfade (3 s). A mono source becomes stereo by taking two different
passages for left and right. The cut points come from the analysis of the sources (envelope and
spectrogram)."""
import urllib.parse
import numpy as np
import common as C
from common import SR

SOURCES = {
    'amb-blume-grass': {
        'naming': '"Dry grass rustling in the wind, in the desert of Chile" (freesound 146436)',
        'creator': 'Félix Blume',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/felix.blume/sounds/146436/',
        'proof': "doc/sources/audio-weather.txt from the arianne/stendhal repo: 'wind.* Félix Blume; CC0; "
                  "https://freesound.org/people/felix.blume/sounds/146436/' (lossless FLAC copy from the Stendhal project)",
    },
    'amb-blume-anatolia': {
        'naming': '"Strong wind blowing in the plain in Anatolia (Turkey)" (freesound 167684)',
        'creator': 'Félix Blume',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/felix.blume/sounds/167684/',
        'proof': "public/assets/ASSET_LICENSES.md from the Aarymanv/hillbomb-sf repo: 'audio/amb/amb_wind_high.mp3: Strong wind "
                  "blowing in the plain in Anatolia (Turkey) by felix.blume (freesound, CC0 1.0)'",
    },
    'amb-blume-flag': {
        'naming': '"A flag flapping in the wind, at the small village of Assem Souk, in the High Atlas (Morocco)" (freesound 154794)',
        'creator': 'Félix Blume',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/felix.blume/sounds/154794/',
        'proof': "assets/sounds/LICENSES.md from the thegriglat/deltaplan repo: 'sail_luff_loop.ogg | felix.blume | A flag flapping "
                  "in the wind, at the small village of Assem Souk… (freesound.org/s/154794) | CC0 | 5–27 с, ФВЧ 80 Гц, луп'",
    },
    'amb-blume-donkey': {
        'naming': '"A donkey is braying in his enclosure in south of France" (freesound 157763)',
        'creator': 'Félix Blume',
        'licence': 'CC0 1.0',
        'url': 'https://commons.wikimedia.org/wiki/File:157763_felix-blume_a-donkey-is-braying-in-his-enclosure-in-south-of-france.wav',
        'proof': "assets-src/SOUND-CREDITS.md from the shiv19/animal-sounds repo: 'donkey: \"157763 felix-blume a-donkey-is-braying-"
                  "in-his-enclosure-in-south-of-france.wav\" by felix-blume — CC0'",
    },
    'amb-janbezouska': {
        'naming': '"Downtown LA, Little Tokyo, late night semi distant traffic" (freesound 330427)',
        'creator': 'janbezouska',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/s/330427/',
        'proof': "public/assets/ASSET_LICENSES.md from the Aarymanv/hillbomb-sf repo: 'amb_city_night.mp3: Downtown LA, Little Tokyo, "
                  "late night semi distant traffic.wav by janbezouska (freesound, CC0 1.0)'",
    },
    'amb-poorenglishjuggler': {
        'naming': 'Rooster crowing (freesound 269496)',
        'creator': 'poorenglishjuggler',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/s/269496/',
        'proof': "sources.md from the AntumMT/mod-sounds repo: '[rooster][] | poorenglishjuggler | CC0', [rooster]: "
                  "https://freesound.org/s/269496/",
    },
    'amb-v23': {
        'naming': '"Angry big dog barking - Far" (freesound 440865)',
        'creator': 'v23',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/s/440865/',
        'proof': "assets/ATTRIBUTION.md from the Steve-Sitax/Moodygame repo: 'Dog far off: \"Angry big dog barking - Far [d15]\", "
                  "dog-far-440865.ogg | Freesound, https://freesound.org/people/v23/sounds/440865/ (by v23) | CC0 1.0 (the sound "
                  "page names \"Creative Commons 0\")'",
    },
    'amb-nathankwright': {
        'naming': '"mourning_dove _2017-06-06" (freesound 456930)',
        'creator': 'nathankwright',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/nathankwright/sounds/456930/',
        'proof': "public/audio/CREDITS.md from the dgreenheck/tidewater repo: 'bird_dove.ogg | 5 dove coo phrases | mourning_dove "
                  "_2017-06-06.wav | nathankwright | CC0 1.0'",
    },
    'amb-bsb': {
        'naming': 'BigSoundBank: Deauville harbor (s1444), whistling masts (s2443), sea at Dellec (s2565), stream (s3137), '
               'five o\'clock bell (s3445), blackbird (s3476), blackcap (s3466)',
        'creator': 'Joseph Sardin (BigSoundBank); blackbird and blackcap: "Le tiroir du fond"',
        'licence': 'CC0 1.0',
        'url': 'https://bigsoundbank.com',
        'proof': "Moodygame assets/ATTRIBUTION.md ('BigSoundBank … CC0 1.0. Page reads \"CC0 (public domain): Free and royalty-"
                  "free\"'), the-quiet-page licenses/audio/AMBIENT-AUDIO-NOTICES.md ('Sea of the beach of Dellec 2 … License: CC0 "
                  "/ public domain'), detour game/assets/CREDITS.md ('Birdsong: real recordings, CC0 … BigSoundBank')",
    },
    'amb-kyles': {
        'naming': '"mountain wind heavy strong gusts Swiss Alps" (freesound 454092)',
        'creator': 'kyles',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/s/454092/',
        'proof': "assets/sounds/LICENSES.md from the thegriglat/deltaplan repo: 'wind_launch_gusts_loop.ogg | kyles | mountain wind "
                  "heavy strong gusts Swiss Alps (freesound.org/s/454092) | CC0'",
    },
    'amb-stewdio2003': {
        'naming': 'Howling wind (freesound 238374)',
        'creator': 'stewdio2003',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/stewdio2003/sounds/238374/',
        'proof': "doc/sources/audio-weather.txt from the arianne/stendhal repo: 'wind_heavy.* stewdio2003; CC0'",
    },
    'amb-straget-crow': {
        'naming': 'Crow (freesound 404687)',
        'creator': 'Samuel Strågefors (straget)',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/straget/sounds/404687/',
        'proof': "doc/sources/audio-sfx.txt from the arianne/stendhal repo: 'bird-crow-02.* Samuel Strågefors (straget); CC0; "
                  "https://freesound.org/people/straget/sounds/404687/'",
    },
    'amb-department64': {
        'naming': 'Creaking tree (freesound 95262)',
        'creator': 'Department64',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/s/95262/',
        'proof': "sources.md from the AntumMT/mod-sounds repo: '[tree_creak][] | Department64 | CC0'",
    },
    'amb-laft2k': {
        'naming': '"Wood Creaking" (freesound 397620)',
        'creator': 'laft2k',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/laft2k/sounds/397620/',
        'proof': "asset-credits/audio.md from the 4ismael1/LUN-game repo: 'loop_creaking_wood.mp3 | Wood Creaking.wav | laft2k | "
                  "Freesound | https://freesound.org/people/laft2k/sounds/397620/ | CC0 1.0'",
    },
    'amb-nox': {
        'naming': 'NOX SOUND "Footsteps - Essentials" (footsteps in snow)',
        'creator': 'Nox_Sound',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/helzpont/home4/tree/main/assets/audio/Footsteps_Essentials_NOX_SOUND',
        'proof': "Essentials_Series_README.pdf shipped with the pack: 'All these sounds are under CC0 license.'",
    },
    'amb-biofonik': {
        'naming': '"RiverWavesWall" (freesound 851906)',
        'creator': 'Biofonik',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/s/851906/',
        'proof': "assets/ATTRIBUTION.md from the Steve-Sitax/Moodygame repo: 'Water against the quay wall: \"BFNK_ISQ_RiverWavesWall_"
                  "H1n_20260426\", water-wall-851906-loop.ogg | Freesound, https://freesound.org/people/Biofonik/sounds/851906/ | "
                  "CC0 1.0'",
    },
    'amb-richardemoore': {
        'naming': '"WavesOnTheShore" (freesound 260263)',
        'creator': 'richardemoore',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/richardemoore/sounds/260263/',
        'proof': "public/audio/CREDITS.md from the dgreenheck/tidewater repo: 'pier_lap.ogg | water lapping a dock — loop | "
                  "WavesOnTheShore.wav | richardemoore | CC0 1.0'",
    },
    'amb-soojay': {
        'naming': '"Seagulls / gaviotas clean wildtrack" (freesound 462462)',
        'creator': 'Soojay',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/s/462462/',
        'proof': "sources.md from the AntumMT/mod-sounds repo: '[seagulls][] | Soojay | CC0'",
    },
    'amb-squashy555': {
        'naming': '"Seagull on beach" (freesound 353416)',
        'creator': 'squashy555',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/s/353416/',
        'proof': "sources.md from the AntumMT/mod-sounds repo: '[seagull*][seagull] | squashy555 | CC0'",
    },
    'amb-genghisattenborough': {
        'naming': '"Herring Gull passing over roof" (freesound 744592)',
        'creator': 'genghisattenborough',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/s/744592/',
        'proof': "samples_mp3/gull/CREDITS.txt from the Warycarpert12/abyssonata repo: '744592.ogg | Herring Gull passing over roof | "
                  "genghisattenborough | CC0'",
    },
    'amb-kyles-gulls': {
        'naming': '"seagulls 2 good sounds close nearby or distant" (freesound 637813)',
        'creator': 'kyles',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/s/637813/',
        'proof': "samples_mp3/gull/CREDITS.txt from the Warycarpert12/abyssonata repo: '637813.ogg | seagulls 2 good sounds close "
                  "nearby or distant.flac | kyles | CC0'",
    },
    'amb-kenney': {
        'naming': 'Kenney "Impact Sounds" (light metal impacts)',
        'creator': 'Kenney (www.kenney.nl)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/series-ai/jam-ready-assets',
        'proof': "License.txt of the pack: 'License: (Creative Commons Zero, CC0) http://creativecommons.org/publicdomain/zero/1.0/'",
    },
    'amb-craigsmith': {
        'naming': '"R28-03 Large Wood Ship Creaking" (freesound 483355) and "G27-04 Wood Pulley Creak" (freesound 438350)',
        'creator': 'craigsmith',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/craigsmith/sounds/483355/',
        'proof': "assets/ATTRIBUTION.md from repo Steve-Sitax/Moodygame: \"Moored ships: \"R28-03 Large Wood Ship Creaking\" … "
                  "freesound.org/people/craigsmith/sounds/483355 … CC0 1.0\"; \"Rope and block creak: \"G27-04 Wood Pulley Creak\", "
                  "pulley-creak-438350.ogg | Freesound, https://freesound.org/people/craigsmith/sounds/438350/ | CC0 1.0\"",
    },
    'amb-dowd': {
        'naming': '"Original foghorn at East Brother Island Lighthouse" (Wikimedia Commons)',
        'creator': 'Elwood P. Dowd',
        'licence': 'CC0 1.0',
        'url': 'https://commons.wikimedia.org/',
        'proof': "Assets/_Project/Audio/LICENSES.md from repo apholmes7-bot/hiddenharbours: \"SFX/foghorn.wav | Original foghorn "
                  "at East Brother Island Lighthouse (commons.wikimedia.org) | Elwood P. Dowd | CC0 1.0\"",
    },
    'amb-sojan': {
        'naming': '"Ship Bell Single Ring" (freesound 353233)',
        'creator': 'Sojan',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/s/353233/',
        'proof': "assets/ATTRIBUTION.md from repo Steve-Sitax/Moodygame: \"Ship's watch bell: \"Ship Bell Single Ring\", "
                  "ship-bell-353233.ogg | Freesound, https://freesound.org/people/Sojan/sounds/353233/ (by Sojan) | CC0 1.0\"",
    },
    'amb-icmusic': {
        'naming': '"Birdsong and wind through trees in Stockwood Park" (freesound 268934)',
        'creator': 'icmusic',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/s/268934/',
        'proof': "public/assets/ASSET_LICENSES.md from repo Aarymanv/hillbomb-sf: \"audio/amb/amb_park_day.mp3: Birdsong and wind "
                  "through trees in Stockwood Park by icmusic (freesound, CC0 1.0)\"",
    },
    'amb-blume-savanna': {
        'naming': 'Wind in dry grass and a tree (freesound 666177)',
        'creator': 'Félix Blume',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/felix.blume/sounds/666177/',
        'proof': "resources/sounds/SOURCES.json from repo Barbarisch/phyxel: \"ambience/savanna_bed.wav: source_url https://"
                  "freesound.org/people/felix.blume/sounds/666177/, license CC0-1.0, author felix.blume\"",
    },
    'amb-hdfreema': {
        'naming': '"Night Crickets Back Porch" (freesound 333221)',
        'creator': 'hdfreema',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/s/333221/',
        'proof': "public/audio/CREDITS.md from repo dgreenheck/tidewater: \"crickets.ogg | night crickets — loop | Night Crickets "
                  "Back Porch.aiff (freesound 333221) | hdfreema | CC0 1.0\"",
    },
    'amb-tom-woysky': {
        'naming': 'Bees (freesound 243011)',
        'creator': 'tom_woysky',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/s/243011/',
        'proof': "sources.md from repo AntumMT/mod-sounds: \"[bees][] | tom_woysky | CC0 | loopable\"",
    },
    'amb-mysid': {
        'naming': 'Chaffinch, wood pigeon and great tit (Wikimedia Commons: Fringilla_coelebs_short.ogg, '
               'Columba_palumbus_birdsong.ogg, Parus_major.ogg)',
        'creator': 'Oona Räisänen (Mysid)',
        'licence': 'Public domain',
        'url': 'https://commons.wikimedia.org/wiki/File:Columba_palumbus_birdsong.ogg',
        'proof': "blechdom/morphazoid assets/bioacoustics/SOURCES.md (\"Songbirds — public-domain dedications … Oona Räisänen … "
                  "chaffinch.ogg\"); flowwweb/sailingsimulator THIRD_PARTY_NOTICES.md (\"wood-pigeon.ogg … Oona Räisänen (Mysid) … "
                  "License: Public domain, released by the copyright holder\"); SiddDevZ/hanakawa-game public/assets/audio/tit/"
                  "provenance.json (\"Parus_major.ogg … Public domain (PD-self) … Oona Räisänen (Mysid)\")",
    },
    'amb-benboncan': {
        'naming': 'Drumming woodpecker (freesound 66955)',
        'creator': 'Benboncan',
        'licence': 'CC BY 3.0',
        'url': 'https://freesound.org/people/Benboncan/sounds/66955/',
        'proof': "doc/sources/audio-sfx.txt from repo arianne/stendhal: \"bird-woodpecker-01.* Benboncan; CC BY 3.0; "
                  "https://freesound.org/people/Benboncan/sounds/66955/\"",
        'attribution': 'Woodpecker by Benboncan (freesound.org/s/66955), licensed CC BY 3.0 (cut, filtered)',
    },
    'amb-straget-cascade': {
        'naming': 'Cascade (freesound 489073)',
        'creator': 'Samuel Strågefors (straget)',
        'licence': 'CC BY (3.0 or 4.0: the copy does not specify the version)',
        'url': 'https://freesound.org/people/straget/sounds/489073/',
        'proof': "README.md from repo mateusfg7/Noisekun, Sounds section: \"[Waterfall](freesound straget/489073) | Straget | "
                  "CC BY\"",
        'attribution': 'Waterfall by Samuel Strågefors (straget, freesound.org/s/489073), licensed CC BY (looped excerpt)',
    },
    'amb-gluckose': {
        'naming': 'Mountain stream (freesound 333987)',
        'creator': 'gluckose',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/gluckose/sounds/333987/',
        'proof': "SOUNDS_LICENSING.md from repo rafaelmardojai/blanket: \"[Stream](https://freesound.org/people/gluckose/sounds/"
                  "333987/) | gluckose | - | CC0\"",
    },
}

# Sources taken directly from Freesound (license read from its API: Creative Commons 0): Notos, Scoria, Cirrus
SOURCES.update({
    'fs-185225': {'naming': '"Gentle sea wash" (freesound 185225)', 'creator': 'deleted_user_3277771', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/deleted_user_3277771/sounds/185225/',
               'proof': 'license given by the Freesound API (apiv2/sounds/185225): creativecommons.org/publicdomain/zero/1.0'},
    'fs-690510': {'naming': '"Cicada chorus in Paros" (freesound 690510)', 'creator': 'CalebLopez', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/CalebLopez/sounds/690510/',
               'proof': 'license given by the Freesound API (apiv2/sounds/690510): creativecommons.org/publicdomain/zero/1.0'},
    'fs-690512': {'naming': '"Winds howl across a sun shade" (freesound 690512)', 'creator': 'CalebLopez', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/CalebLopez/sounds/690512/',
               'proof': 'license given by the Freesound API (apiv2/sounds/690512): creativecommons.org/publicdomain/zero/1.0'},
    'fs-457956': {'naming': '"Waves lapping on rocks" (freesound 457956)', 'creator': 'dan.pugsley', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/dan.pugsley/sounds/457956/',
               'proof': 'license given by the Freesound API (apiv2/sounds/457956): creativecommons.org/publicdomain/zero/1.0'},
    'fs-462462': {'naming': '"Seagulls / gaviotas clean wildtrack.WAV" (freesound 462462)', 'creator': 'Soojay', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/Soojay/sounds/462462/',
               'proof': 'license given by the Freesound API (apiv2/sounds/462462): creativecommons.org/publicdomain/zero/1.0'},
    'fs-153580': {'naming': '"Church Bell sound.wav" (freesound 153580)', 'creator': 'Thejack288', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/Thejack288/sounds/153580/',
               'proof': 'license given by the Freesound API (apiv2/sounds/153580): creativecommons.org/publicdomain/zero/1.0'},
    'fs-131925': {'naming': '"Italia, Napoli - A herd of goat is eating; the small bell are tickling" (freesound 131925)', 'creator': 'felix.blume', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/felix.blume/sounds/131925/',
               'proof': 'license given by the Freesound API (apiv2/sounds/131925): creativecommons.org/publicdomain/zero/1.0'},
    'fs-131924': {'naming': '"A windmill is squeaking alone in the desert (USA, Arizona)" (freesound 131924)', 'creator': 'felix.blume', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/felix.blume/sounds/131924/',
               'proof': 'license given by the Freesound API (apiv2/sounds/131924): creativecommons.org/publicdomain/zero/1.0'},
    'fs-176589': {'naming': '"YasurVolcanoe-Vanuatu-TannaIsland-SmallEruption.wav" (freesound 176589)', 'creator': 'Hendrik', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/Hendrik/sounds/176589/',
               'proof': 'license given by the Freesound API (apiv2/sounds/176589): creativecommons.org/publicdomain/zero/1.0'},
    'fs-415608': {'naming': '"Mud Volcano Field - Salton Sea" (freesound 415608)', 'creator': 'RTB45', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/RTB45/sounds/415608/',
               'proof': 'license given by the Freesound API (apiv2/sounds/415608): creativecommons.org/publicdomain/zero/1.0'},
    'fs-829623': {'naming': '"Ambiance_Hot_Spring_Furnas_Caldeiras_Loop_Stereo_04" (freesound 829623)', 'creator': 'Nox_Sound', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/Nox_Sound/sounds/829623/',
               'proof': 'license given by the Freesound API (apiv2/sounds/829623): creativecommons.org/publicdomain/zero/1.0'},
    'fs-144559': {'naming': '"Power Transformer Waterloo Station London-2.aiff" (freesound 144559)', 'creator': 'kiefspoon', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/kiefspoon/sounds/144559/',
               'proof': 'license given by the Freesound API (apiv2/sounds/144559): creativecommons.org/publicdomain/zero/1.0'},
    'fs-127140': {'naming': '"thunder001.aiff" (freesound 127140)', 'creator': 'klangfabrik', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/klangfabrik/sounds/127140/',
               'proof': 'license given by the Freesound API (apiv2/sounds/127140): creativecommons.org/publicdomain/zero/1.0'},
    'fs-112296': {'naming': '"desertwind1FINAL.wav" (freesound 112296)', 'creator': 'slugzilla', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/slugzilla/sounds/112296/',
               'proof': 'license given by the Freesound API (apiv2/sounds/112296): creativecommons.org/publicdomain/zero/1.0'},
    'fs-165526': {'naming': '"Wind singing in the mountain, some night cricket in background" (freesound 165526)', 'creator': 'felix.blume', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/felix.blume/sounds/165526/',
               'proof': 'license given by the Freesound API (apiv2/sounds/165526): creativecommons.org/publicdomain/zero/1.0'},
    'fs-135193': {'naming': '"Wind blowing in the bush on the top of Kitt Peak mountain. (USA, Arizona)" (freesound 135193)', 'creator': 'felix.blume', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/felix.blume/sounds/135193/',
               'proof': 'license given by the Freesound API (apiv2/sounds/135193): creativecommons.org/publicdomain/zero/1.0'},
    'fs-156414': {'naming': '"Wind blowing into some cactus spine, on the top of the mountain, in the desert of Atacama" (freesound 156414)', 'creator': 'felix.blume', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/felix.blume/sounds/156414/',
               'proof': 'license given by the Freesound API (apiv2/sounds/156414): creativecommons.org/publicdomain/zero/1.0'},
    'fs-817188': {'naming': '"Gusty Wind on Ridge" (freesound 817188)', 'creator': 'craigsmith', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/craigsmith/sounds/817188/',
               'proof': 'license given by the Freesound API (apiv2/sounds/817188): creativecommons.org/publicdomain/zero/1.0'},
    'fs-231438': {'naming': '"hamp rope creaks" (freesound 231438)', 'creator': '6polnic', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/6polnic/sounds/231438/',
               'proof': 'license given by the Freesound API (apiv2/sounds/231438): creativecommons.org/publicdomain/zero/1.0'},
    'fs-648430': {'naming': '"Two buzzards in a windy forest.wav" (freesound 648430)', 'creator': 'bruno.auzet', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/bruno.auzet/sounds/648430/',
               'proof': 'license given by the Freesound API (apiv2/sounds/648430): creativecommons.org/publicdomain/zero/1.0'},
    'fs-194678': {'naming': '"a buzzard call" (freesound 194678)', 'creator': 'Jaturo', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/Jaturo/sounds/194678/',
               'proof': 'license given by the Freesound API (apiv2/sounds/194678): creativecommons.org/publicdomain/zero/1.0'},
    'fs-187364': {'naming': '"A flag flapping in the wind in the Mojave Desert (California)" (freesound 187364)', 'creator': 'felix.blume', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/felix.blume/sounds/187364/',
               'proof': 'license given by the Freesound API (apiv2/sounds/187364): creativecommons.org/publicdomain/zero/1.0'},
})


# ---------------------------------------------------------------------------------------------------------------------
# Source files: local path under assets_src/sfx/src -> direct download URL.
FILES = {}


def _url(depot, branch_snd, pathway, lfs=False):
    base = 'https://media.githubusercontent.com/media' if lfs else 'https://raw.githubusercontent.com'
    return f'{base}/{depot}/{branch_snd}/' + urllib.parse.quote(pathway)


def _f(rel, depot, branch_snd, pathway, lfs=False):
    FILES[rel] = _url(depot, branch_snd, pathway, lfs)
    return rel


def _st(naming):           # Stendhal: lossless sources
    return _f('stendhal/' + naming, 'arianne/stendhal', 'master', 'data/sounds/lossless_sources/' + naming)


def _moody(folder, naming):
    return _f('moodygame/' + naming, 'Steve-Sitax/Moodygame', 'main', f'client/public/audio/{folder}/{naming}')


def _antum(naming):
    return _f('antum/' + naming, 'AntumMT/mod-sounds', 'master', 'sounds_src/' + naming)


def _nox(pathway):
    return _f('nox/' + pathway, 'helzpont/home4', 'main', 'assets/audio/Footsteps_Essentials_NOX_SOUND/' + pathway)


def _fs(ident, pathway):  # Freesound: high-quality preview (MP3) served by cdn.freesound.org, no key
    return _f_direct(f'freesound/{ident}.mp3', 'https://cdn.freesound.org/previews/' + pathway)


def _f_direct(rel, url):
    FILES[rel] = url
    return rel


# Chergui
WIND_GRASS = _st('weather/wind.flac')
WIND_ANATOLIA = _f('hillbomb/amb_wind_high.mp3', 'Aarymanv/hillbomb-sf', 'main', 'public/assets/audio/amb/amb_wind_high.mp3')
CITY = _f('hillbomb/amb_city_night.mp3', 'Aarymanv/hillbomb-sf', 'main', 'public/assets/audio/amb/amb_city_night.mp3')
DONKEY = _f('animal-sounds/donkey.wav', 'shiv19/animal-sounds', 'main', 'assets-src/sounds/donkey.wav')
ROOSTER = _antum('sounds_rooster.flac')
DOG_FAR = _moody('freesound', 'dog-far-440865.ogg')
DOVE = _f('tidewater/bird_dove.ogg', 'dgreenheck/tidewater', 'main', 'public/audio/bird_dove.ogg')
FLAG = _f('deltaplan/sail_luff_loop.ogg', 'thegriglat/deltaplan', 'main', 'assets/sounds/sail/sail_luff_loop.ogg')
TRICKLE = _f('quiet-page/river.ogg', 'YARObHATEM/the-quiet-page', 'main', 'src/renderer/audio/ambient/river.ogg')

# Saint-Givre
WIND_ALPS = _f('deltaplan/wind_launch_gusts_loop.ogg', 'thegriglat/deltaplan', 'main',
               'assets/sounds/ambient/wind_launch_gusts_loop.ogg')
WIND_HOWL = _st('weather/wind_heavy.flac')
BELL_CHURCH = _moody('bigsoundbank', 'bell-5-oclock-3445.ogg')
CROW = _st('bird-crow-02.flac')
TREE_CREAK = _antum('sounds_tree_creak.flac')
WOOD_CREAK = _f('lun/loop_creaking_wood.mp3', '4ismael1/LUN-game', 'main', 'public/assets/audio/loop_creaking_wood.mp3')
SNOW_LAND = [_nox('Footsteps_Snow/Footsteps_Snow_Jump/Footsteps_Snow_Jump_Land_01.wav'),
             _nox('Footsteps_Snow/Footsteps_Snow_Jump/Footsteps_Snow_Jump_Land_03.wav')]
SNOW_GRAIN = [_nox('Footsteps_Snow/Footsteps_Snow_Walk/Footsteps_Snow_Walk_03.wav'),
              _nox('Footsteps_Snow/Footsteps_Snow_Walk/Footsteps_Snow_Walk_07.wav'),
              _nox('Footsteps_Snow/Footsteps_Snow_Run/Footsteps_Snow_Run_04.wav'),
              _nox('Footsteps_Snow/Footsteps_Snow_Run/Footsteps_Snow_Run_08.wav')]

# Port-Maël
PONTOON = _moody('bigsoundbank', 'water-pontoon-1444-loop.ogg')
MASTS = _moody('bigsoundbank', 'wind-masts-2443-loop.ogg')
SEA = _f('quiet-page/ocean.ogg', 'YARObHATEM/the-quiet-page', 'main', 'src/renderer/audio/ambient/ocean.ogg')
QUAY = _moody('freesound', 'water-wall-851906-loop.ogg')
PIER = _f('tidewater/pier_lap.ogg', 'dgreenheck/tidewater', 'main', 'public/audio/pier_lap.ogg')
GULLS = _antum('sounds_seagulls.flac')
GULL_LONG = _antum('sounds_seagull_01.flac')
GULL_ROOF = _f('abyssonata/gull/744592.mp3', 'Warycarpert12/abyssonata', 'main', 'samples_mp3/gull/744592.mp3')
GULL_CLOSE = _f('abyssonata/gull/637813.mp3', 'Warycarpert12/abyssonata', 'main', 'samples_mp3/gull/637813.mp3')
METAL = [_f(f'kenney/kenney-impact-sounds/audio/Audio/impactMetal_light_00{n}.ogg', 'series-ai/jam-ready-assets', 'main',
            f'kenney-impact-sounds/audio/Audio/impactMetal_light_00{n}.ogg', lfs=True) for n in range(5)]
HULL = _moody('freesound', 'ship-creak-483355-loop.ogg')
PULLEY = _moody('freesound', 'pulley-creak-438350.ogg')
FOGHORN = _f('hiddenharbours/foghorn.wav', 'apholmes7-bot/hiddenharbours', 'main', 'Assets/_Project/Audio/SFX/foghorn.wav', lfs=True)
SHIP_BELL = _moody('freesound', 'ship-bell-353233.ogg')

# Floralia
PARK = _f('hillbomb/amb_park_day.mp3', 'Aarymanv/hillbomb-sf', 'main', 'public/assets/audio/amb/amb_park_day.mp3')
SAVANNA = _f('phyxel/savanna_bed.wav', 'Barbarisch/phyxel', 'main', 'resources/sounds/ambience/savanna_bed.wav')
BEES = _antum('sounds_bees.flac')
CRICKETS = _f('tidewater/crickets.ogg', 'dgreenheck/tidewater', 'main', 'public/audio/crickets.ogg')
BLACKBIRD = _f('detour/blackbird_1.ogg', 'j4ckxyz/detour', 'main', 'game/assets/audio/birds/blackbird_1.ogg')
BLACKCAP = _f('detour/blackcap_1.ogg', 'j4ckxyz/detour', 'main', 'game/assets/audio/birds/blackcap_1.ogg')
TIT = _f('hanakawa/tit-a.mp3', 'SiddDevZ/hanakawa-game', 'main', 'public/assets/audio/tit/tit-a.mp3')
CHAFFINCH = _f('morphazoid/chaffinch.ogg', 'blechdom/morphazoid', 'main', 'assets/bioacoustics/chaffinch.ogg')
WOODPIGEON = _f('sailingsimulator/wood-pigeon.ogg', 'flowwweb/sailingsimulator', 'main', 'public/audio/wood-pigeon.ogg')
WOODPECKER = _st('bird-woodpecker-01.flac')
WATERFALL = _f('noisekun/waterfall.ogg', 'mateusfg7/Noisekun', 'main', '.github/assets/sounds/waterfall.ogg')
STREAM = _f('blanket/stream.ogg', 'rafaelmardojai/blanket', 'master', 'data/resources/sounds/stream.ogg')


# Notos, Scoria, Cirrus (Freesound)
SEA_WASH = _fs(185225, '185/185225_3277771-hq.mp3')
CICADAS_PAROS = _fs(690510, '690/690510_3609677-hq.mp3')
WIND_SHADE = _fs(690512, '690/690512_3609677-hq.mp3')
LAP_ROCKS = _fs(457956, '457/457956_9574372-hq.mp3')
GULLS_CLEAN = _fs(462462, '462/462462_2752236-hq.mp3')
BELL_SMALL = _fs(153580, '153/153580_2583807-hq.mp3')
GOATS = _fs(131925, '131/131925_1661766-hq.mp3')
WINDMILL = _fs(131924, '131/131924_1661766-hq.mp3')
YASUR = _fs(176589, '176/176589_173983-hq.mp3')
MUD_POTS = _fs(415608, '415/415608_2409224-hq.mp3')
FURNAS = _fs(829623, '829/829623_9250976-hq.mp3')
TRANSFORMER = _fs(144559, '144/144559_1154439-hq.mp3')
THUNDER = _fs(127140, '127/127140_181941-hq.mp3')
DESERT_WIND = _fs(112296, '112/112296_1330135-hq.mp3')
WIND_SINGING = _fs(165526, '165/165526_1661766-hq.mp3')
WIND_KITT = _fs(135193, '135/135193_1661766-hq.mp3')
WIND_ATACAMA = _fs(156414, '156/156414_1661766-hq.mp3')
GUSTS_RIDGE = _fs(817188, '817/817188_2524442-hq.mp3')
ROPE_CREAK = _fs(231438, '231/231438_2016452-hq.mp3')
BUZZARDS = _fs(648430, '648/648430_11519060-hq.mp3')
BUZZARD = _fs(194678, '194/194678_2824510-hq.mp3')
FLAG_MOJAVE = _fs(187364, '187/187364_1661766-hq.mp3')


# ---------------------------------------------------------------------------------------------------------------------
# Processing tools

def src(rel, startpoint=None, duration_s=None, stereo=False):
    """Source decoded at 48 kHz (mono, or stereo (n, 2)), excerpt startpoint..startpoint+duration_s s."""
    return C.load(C.SRC / rel, mono=not stereo, start=startpoint, dur=duration_s)


def circ(x, startpoint, duration_s):
    """Circular excerpt of an already-looped source: it may run past the end and wrap back to the start."""
    i = int(startpoint * SR) + np.arange(int(duration_s * SR))
    return np.take(x, i, axis=0, mode='wrap')


def af(x, *filters):
    """ffmpeg filter chain (empty elements are ignored)."""
    ch = ','.join(f for f in filters if f)
    return C.ff(x, ch) if ch else x


def hp(f, n=2):
    """High-pass 12 dB/octave per stage (n stages)."""
    return ','.join([f'highpass=f={f}:poles=2'] * n)


def lp(f, n=2):
    """Low-pass 12 dB/octave per stage (n stages)."""
    return ','.join([f'lowpass=f={f}:poles=2'] * n)


def eq(f, g, q=1.0):
    return f'equalizer=f={f}:t=q:w={q}:g={g}'


def trebles(f, g):
    return f'highshelf=f={f}:g={g}'


def lows(f, g):
    return f'lowshelf=f={f}:g={g}'


def num(v):
    """Number written for the credits."""
    return f'{v:g}'


def dbg(d):
    return 10 ** (d / 20)


def rms(x):
    return float(np.sqrt(np.mean(x ** 2))) if len(x) else 0.0


def to_level(x, ref, gap_db):
    """Sets x to gap_db (dB) from the RMS level of ref."""
    r = rms(x)
    return x * (rms(ref) * dbg(gap_db) / r) if r > 0 else x


def transpose(x, semitones):
    """Transposition by speed change (duration changes with pitch)."""
    if not semitones: return x
    r = 2 ** (semitones / 12)
    return C.ff(x, f'asetrate={int(round(SR * r))},aresample={SR}')


def mono(x):
    return x if x.ndim == 1 else x.mean(axis=1)


def convolved(x, ir):
    n = len(x) + len(ir) - 1
    m = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[:n]


def queue(x, rt=1.5, mix=0.2, dusky=3500, seed_val=1):
    """Small open-air reverb: diffuse response (noise with exponential decay, 60 dB in rt seconds,
    darkened above dusky Hz) mixed with the direct sound. Gives distance and place to a close-miked sound."""
    x = C.fade(x, 0, 0.03)         # the direct sound ends without a step (the tail continues behind it)
    n = int(rt * SR)
    rng = np.random.default_rng(seed_val)
    ir = rng.standard_normal(n) * np.exp(-6.9 * np.arange(n) / n)
    ir = af(ir, lp(dusky, 1))
    ir[:int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
    ir /= np.sqrt(np.sum(ir ** 2))
    out = np.zeros(len(x) + n - 1)
    out[:len(x)] += x
    out += mix * convolved(x, ir)
    return out


def burst_envelope(x, rises=1.0, descend=1.5, curve_of=1.6):
    """A gust taken from a continuous wind: slow rise and fall so that it is born and dies on its own."""
    y = x.copy(); n = len(y)
    a, b = int(rises * SR), int(descend * SR)
    y[:a] *= np.linspace(0, 1, a) ** curve_of
    y[n - b:] *= np.linspace(1, 0, b) ** curve_of
    return y


def stereo(g, d):
    n = min(len(g), len(d))
    return np.stack([g[:n], d[:n]], axis=1)


def average(v, w):
    """Centered moving average over w samples (cumulative sums: fast even for long windows)."""
    w = max(1, int(w))
    c = np.concatenate([[0.0], np.cumsum(np.pad(v, (w // 2, w - 1 - w // 2), mode='edge'))])
    return (c[w:] - c[:-w]) / w


def repairs(x, *zones):
    """Erases short glitches (mic click, bump): each zone (center instant, width in s) is replaced by the
    passage immediately preceding it, laid in with a 5 ms crossfade at each end (the background continues without a gap)."""
    y = x.copy(); f = int(0.005 * SR)
    for t, w in zones:
        a = int((t - w / 2) * SR); n = int(w * SR) + 2 * f
        piece = x[a - n - f:a - f].copy()
        r = np.linspace(0, 1, f)
        rr = r if x.ndim == 1 else r[:, None]
        seg = y[a - f:a - f + n].copy()
        seg[:f] = seg[:f] * (1 - rr) + piece[:f] * rr
        seg[f:n - f] = piece[f:n - f]
        seg[n - f:] = piece[n - f:] * (1 - rr) + seg[n - f:] * rr
        y[a - f:a - f + n] = seg
    return y


def large(x, k=1.5):
    """Widens a stereo image that is too centered (the S side = (L - R) / 2 multiplied by k)."""
    m = (x[:, 0] + x[:, 1]) / 2; c = (x[:, 0] - x[:, 1]) / 2 * k
    return np.stack([m + c, m - c], axis=1)


def levels_out(x, window_fn=1.0, force=0.5):
    """Smooths slow level swells (a gust in a bed that would return on every loop turn): gain
    (mean / local RMS)^force, RMS measured over window_fn seconds and smoothed."""
    m = x if x.ndim == 1 else x.mean(axis=1)
    w = int(window_fn * SR)
    e = np.sqrt(average(m ** 2, w)) + 1e-9
    g = average((np.sqrt(np.mean(m ** 2)) / e) ** force, w)
    return x * (g if x.ndim == 1 else g[:, None])


def ceiling(x, reduction=6.0):
    """Look-ahead limiter: the sharpest peaks (drops, water slaps) are lowered by up to reduction dB,
    the rest passes as is; brings the RMS level closer to the peak for a water loop."""
    y = C.norm(x, 0.0)
    return af(y, f'alimiter=limit={dbg(-reduction):.4f}:attack=1:release=40:level=0:latency=1')


def doorway(x, cutpoint=-30.0, floorboards=-14.0, smoothed=0.03):
    """Soft gate: below cutpoint (dB under the envelope peak), the gain drops down to floorboards dB; removes the background
    between the notes of a song recorded in a noisy place."""
    w = int(smoothed * SR)
    e = np.sqrt(average(x ** 2, w))
    e = e / (np.max(e) or 1)
    g = np.clip((20 * np.log10(np.maximum(e, 1e-9)) - cutpoint) / 10 + 1, 0, 1)   # 10 dB of slope below the threshold
    g = average(dbg(floorboards) + (1 - dbg(floorboards)) * g, w)
    return x * g


def place(n, *layer_list):
    """Sum of layers (signal, instant in s, gain) into a buffer of n samples (mono or stereo)."""
    out = np.zeros((n,) + layer_list[0][0].shape[1:])
    for s, t, g in layer_list:
        i = int(t * SR)
        if i >= n: continue
        k = min(len(s), n - i)
        out[i:i + k] += s[:k] * g
    return out


# ---------------------------------------------------------------------------------------------------------------------
# Finishing and credits

CREDITS = []


def _credit(pack, sid, sources, detail):
    """sources: list of (SOURCES key, file)."""
    for key, filepath in sources:
        CREDITS.append(C.credit(sid, pack, key, filepath, detail))


def one_shot(pack, sid, x, dmax, sources, detail, cutpoint=-40.0, end_threshold=-55.0, fout=0.3, end_s=0.004):
    """Mono one-shot: head cut at the attack (cutpoint dB under the peak), tail cut below end_threshold, dmax s at most,
    fades, peak -3 dBFS."""
    x = mono(x)
    x = x - np.mean(x)
    x = C.trim(x, cutpoint, 0.004)
    x = x[:C.tail_end(x, end_threshold)]
    if len(x) > dmax * SR: x = x[:int(dmax * SR)]
    x = C.fade(x, end_s, min(fout, len(x) / SR / 3))
    C.save_master(pack, sid, C.norm(x, -3.0))
    _credit(pack, sid, sources, detail)


def mono_loop(pack, sid, x, xf, sources, detail):
    """Mono loop: x lasts (wanted duration + xf); the end is crossfaded over the start; peak -3 dBFS."""
    x = mono(x)
    y = C.loopify(x - np.mean(x), xf)
    C.save_master(pack, sid, C.norm(y, -3.0))
    _credit(pack, sid, sources, detail)


def bed(pack, x, xf, sources, detail):
    """Stereo bed: x lasts (wanted duration + xf); crossfade of xf s from the end over the start; RMS -20 dBFS."""
    y = C.loopify(x - np.mean(x, axis=0), xf)
    C.save_master(pack, 'a_bed', C.norm_rms(y, -20.0, -3.0))
    _credit(pack, 'a_bed', sources, detail)


# ---------------------------------------------------------------------------------------------------------------------
# Chergui: desert village in late afternoon

def chergui():
    P = 'amb_chergui'
    # Bed: warm wind in dry grass (Félix Blume); a little air above 5 kHz for the running sand;
    # very distant city rumble (night traffic, low-pass at 450 Hz, 17 dB under the wind).
    wind = af(src(WIND_GRASS, 8.0, 30.0, stereo=True), hp(45), trebles(5000, 2.5))
    town = af(src(CITY, 0.0, 30.0, stereo=True), hp(40), lp(450))
    town = to_level(town, wind, -17)
    bed(P, large(wind + town, 1.6), 3.0, [('amb-blume-grass', WIND_GRASS), ('amb-janbezouska', CITY)],
        'wind 8-38 s (high-pass 45 Hz, treble +2.5 dB); city 0-30 s (low-pass 450 Hz, -17 dB); widened image (side x1.6); '
        'loop with 3 s fade')

    # Dry gusts (Félix Blume, Anatolian plain): the gust and the wind around it, slow rise and fall.
    for sid, t in (('a_gust-1', 6.2), ('a_gust-2', 14.2)):
        x = af(mono(src(WIND_ANATOLIA, t, 4.0, stereo=True)), hp(110), lp(9000, 1))
        one_shot(P, sid, burst_envelope(x, 0.9, 1.4), 4.0, [('amb-blume-anatolia', WIND_ANATOLIA)],
                 f'{num(t)}-{num(t + 4)} s, high-pass 110 Hz, rise 0.9 s, fall 1.4 s', cutpoint=-60)

    # Donkey (Félix Blume): complete bray, a bit distant.
    x = af(mono(src(DONKEY, 3.4, 6.2, stereo=True)), hp(90), lp(6500, 1))
    one_shot(P, 'a_donkey', queue(x, 1.2, 0.18), 6.0, [('amb-blume-donkey', DONKEY)],
             '3.4-9.4 s, high-pass 90 Hz, low-pass 6.5 kHz, small open-air reverb', fout=0.6)

    # Coq
    x = af(src(ROOSTER), hp(120))
    one_shot(P, 'a_rooster', queue(x, 1.0, 0.15, seed_val=2), 3.0, [('amb-poorenglishjuggler', ROOSTER)],
             'full song, high-pass 120 Hz, small open-air reverb', fout=0.4)

    # Dogs in the distance (already distant when recorded)
    for sid, t, d in (('a_dog-1', 8.55, 1.9), ('a_dog-2', 11.35, 2.2)):
        x = af(src(DOG_FAR, t, d), hp(110))
        one_shot(P, sid, x, 3.0, [('amb-v23', DOG_FAR)], f'{num(t)}-{num(t + d)} s (one volley), high-pass 110 Hz', fout=0.25)

    # Turtle doves: two cooing phrases (the file contains five, spliced together)
    for sid, t in (('a_dove-1', 3.22), ('a_dove-2', 9.78)):
        x = af(src(DOVE, t, 3.15), hp(160), lp(5000, 1))
        one_shot(P, sid, x, 3.2, [('amb-nathankwright', DOVE)], f'{num(t)}-{num(t + 3.15)} s, high-pass 160 Hz', fout=0.25)

    # Tarp / cloth flapping: High Atlas flag (Félix Blume)
    for sid, t, d in (('a_cloth-1', 6.4, 3.6), ('a_cloth-2', 13.4, 4.0)):
        x = af(mono(src(FLAG, t, d, stereo=True)), hp(90))
        one_shot(P, sid, burst_envelope(x, 0.35, 0.9), d, [('amb-blume-flag', FLAG)],
                 f'{num(t)}-{num(t + d)} s, high-pass 90 Hz, rise 0.35 s, fall 0.9 s', cutpoint=-60)

    # Courtyard fountain (4 s loop): thin trickle of shallow water (BigSoundBank) over the tighter water of a stream
    # (gluckose, 5 dB lower): the jet falling back into the basin; soft compression of the sharpest drops.
    netting = af(src(TRICKLE, 31.0, 5.5), hp(150), eq(3500, -2, 0.8))
    pad_layer = to_level(af(src(STREAM, 61.0, 5.5), hp(200), lp(9000, 1)), netting, -5)
    x = ceiling(af(netting + pad_layer, 'acompressor=threshold=0.08:ratio=3:attack=1:release=60:knee=4'), 9)
    mono_loop(P, 'a_fountain', x, 1.5, [('amb-bsb', TRICKLE), ('amb-gluckose', STREAM)],
                'stream s3137 31-36.5 s + mountain stream 61-66.5 s (-5 dB), high-pass 150 Hz, soft compression, '
                'sharpest drops limited (9 dB), loop with 1.5 s fade')


# ---------------------------------------------------------------------------------------------------------------------
# Saint-Givre: mountain station under the snow

def saintgivre():
    P = 'amb_saintgivre'
    # Bed: mountain wind from the Swiss Alps (kyles), muffled as if by snow.
    alps = repairs(src(WIND_ALPS, stereo=True), (14.33, 0.03), (14.575, 0.03), (27.04, 0.36))
    wind = af(circ(alps, 1.0, 30.0), hp(40), lp(5200, 1), trebles(2500, -3))
    bed(P, wind, 3.0, [('amb-kyles', WIND_ALPS)], '1-31 s (three mic clicks erased), high-pass 40 Hz, low-pass 5.2 kHz, '
        'treble -3 dB; loop with 3 s fade')

    # Whistling gusts: howling wind (stewdio2003); the third, an Alpine gust with a bit of whistling.
    for sid, t in (('a_gust-1', 13.2), ('a_gust-2', 7.6)):
        x = af(mono(src(WIND_HOWL, t, 5.0, stereo=True)), hp(80))
        one_shot(P, sid, burst_envelope(x, 1.2, 1.8), 5.0, [('amb-stewdio2003', WIND_HOWL)],
                 f'{num(t)}-{num(t + 5)} s, high-pass 80 Hz, rise 1.2 s, fall 1.8 s', cutpoint=-60)
    alps = af(mono(circ(alps, 49.5, 5.0)), hp(60))
    whistle = to_level(af(mono(src(WIND_HOWL, 16.1, 5.0, stereo=True)), hp(300), lp(2500)), alps, -9)
    n = min(len(alps), len(whistle)); alps, whistle = alps[:n], whistle[:n]
    one_shot(P, 'a_gust-3', burst_envelope(alps + whistle, 1.2, 1.8), 5.0,
             [('amb-kyles', WIND_ALPS), ('amb-stewdio2003', WIND_HOWL)],
             'Alpine gust 49.5-54.5 s + whistling 16.1-21.1 s (-9 dB); rise 1.2 s, fall 1.8 s', cutpoint=-60)

    # Distant church bell: two strikes and the resonance of the last (BigSoundBank, "Bell 5 O'clock")
    x = af(src(BELL_CHURCH, 6.42, 6.3), hp(120), lp(3200, 1), trebles(1500, -4))
    one_shot(P, 'a_bell', queue(x, 2.2, 0.25, 2500, 3), 6.0, [('amb-bsb', BELL_CHURCH)],
             's3445, strikes 4 and 5 (6.42-12.7 s), low-pass 3.2 kHz, valley reverb', fout=1.2)

    # Crows: two caws each
    for sid, t, d in (('a_crow-1', 0.0, 1.35), ('a_crow-2', 1.42, 1.76)):
        x = af(src(CROW, t, d), hp(250))
        one_shot(P, sid, queue(x, 0.9, 0.12, seed_val=4), 2.5, [('amb-straget-crow', CROW)],
                 f'{num(t)}-{num(t + d)} s, high-pass 250 Hz, small reverb', fout=0.3)

    # Wood and timberwork creaking in the cold
    x = af(src(TREE_CREAK, 0.0, 3.45), hp(90))
    one_shot(P, 'a_creak-1', x, 3.5, [('amb-department64', TREE_CREAK)], '0-3.45 s (creak and two cracks), high-pass 90 Hz')
    x = transpose(af(src(WOOD_CREAK, 26.2, 2.5), hp(70), lp(7000, 1)), -2)
    one_shot(P, 'a_creak-2', queue(x, 0.7, 0.12, seed_val=5), 3.5, [('amb-laft2k', WOOD_CREAK)],
             '26.2-28.7 s (two creaks), transposed -2 semitones (bigger beam), low-pass 7 kHz', fout=0.3)

    # Clump of snow sliding off a roof: slide made of snow grains (slowed, tightened footsteps in snow),
    # dull fall (jump landings in snow, transposed down), a few clods after.
    rng = np.random.default_rng(7)
    grains = [af(src(g), hp(120), 'rubberband=tempo=0.55') for g in SNOW_GRAIN]
    n = int(2.2 * SR)
    layer_list = []
    for k in range(18):
        t = 0.055 * k + rng.uniform(0, 0.025)
        g = transpose(grains[k % 4], rng.uniform(-2.0, 1.0))
        layer_list.append((g, t, 0.35 + 0.65 * (k / 17) ** 1.2))
    land = [transpose(af(src(f), hp(50)), -4) for f in SNOW_LAND]
    layer_list += [(land[0], 0.98, 1.5), (land[1], 1.02, 1.1)]
    for t, gain in ((1.38, 0.35), (1.62, 0.2)):
        layer_list.append((transpose(grains[int(t * 10) % 4], -3), t, gain))
    x = af(place(n, *layer_list), lp(7500, 1), eq(180, 3, 0.8))
    one_shot(P, 'a_snowfall', x, 2.0, [('amb-nox', SNOW_GRAIN[0]), ('amb-nox', SNOW_LAND[0])],
             'composite: 18 snow grains (NOX footsteps slowed to 0.55, transposed) in crescendo over 0.95 s, fall (landings '
             'NOX transposed by -4 semitones), two clods; low-pass 7.5 kHz', fout=0.35)


# ---------------------------------------------------------------------------------------------------------------------
# Port-Maël: Breton fishing port at sunset

def portmael():
    P = 'amb_portmael'
    # Bed: lapping against the pontoons (BigSoundBank, Deauville) on the left, water licking a quay (richardemoore) on the right,
    # softened slaps; open sea (Dellec beach, Brittany, low-pass 900 Hz) and sea wind (Félix Blume,
    # low-pass 1.4 kHz).
    calm_bed = 'acompressor=threshold=0.04:ratio=4:attack=0.5:release=80:knee=6'
    footbridge = af(circ(src(PONTOON), 2.0, 30.0), hp(60), lp(7500, 1), calm_bed)
    quay = to_level(af(circ(src(PIER), 6.0, 30.0), hp(60), lp(7500, 1), calm_bed), footbridge, 0)
    lapping = stereo(footbridge, quay)
    seaside = af(src(SEA, 61.0, 30.0, stereo=True), hp(40), lp(900))
    seaside = to_level(seaside, lapping, -5)
    wind = af(src(WIND_GRASS, 2.0, 30.0, stereo=True), hp(60), lp(1400))
    wind = to_level(wind, lapping, -11)
    bed(P, ceiling(lapping + seaside + wind, 3), 3.0,
        [('amb-bsb', PONTOON), ('amb-richardemoore', PIER), ('amb-bsb', SEA), ('amb-blume-grass', WIND_GRASS)],
        'pontoons s1444 2-32 s (left) and quay 6-36 s (right), low-pass 7.5 kHz, slaps compressed; sea s2565 '
        '61-91 s, low-pass 900 Hz, -5 dB; wind 2-32 s, low-pass 1.4 kHz, -11 dB; peaks limited (3 dB); loop with 3 s fade')

    # Surf against a quay (6 s loop)
    x = ceiling(af(circ(src(QUAY), 0.8, 8.0), hp(70)), 6)
    mono_loop(P, 'a_waves', x, 2.0, [('amb-biofonik', QUAY)], '0.8-8.8 s, high-pass 70 Hz, slaps limited (6 dB), '
                'loop with 2 s fade')

    # Gulls
    gull = [
        ('a_gull-1', af(mono(src(GULLS, 2.1, 4.85, stereo=True)), hp(300)), 'amb-soojay', GULLS, 'colony, 2.1-6.95 s'),
        ('a_gull-2', C.fade(af(src(GULL_LONG, 0.0, 4.9), hp(300)), 0, 0.35), 'amb-squashy555', GULL_LONG,
         'long call (the "laugh"), 0-4.9 s, 0.35 s fade'),
        ('a_gull-3', af(src(GULL_ROOF, 2.3, 6.0), hp(300)), 'amb-genghisattenborough', GULL_ROOF, 'herring gull passing by, 2.3-8.3 s'),
        ('a_gull-4', af(src(GULL_CLOSE, 6.25, 5.4), hp(300)), 'amb-kyles-gulls', GULL_CLOSE, 'close calls, 6.25-11.65 s'),
    ]
    for sid, x, key, f, d in gull:
        one_shot(P, sid, queue(x, 0.8, 0.1, seed_val=11), 6.0, [(key, f)], d + ', high-pass 300 Hz, small reverb', fout=0.4)

    # Halyards clinking against a mast: light metal impacts (Kenney) transposed, laid at irregular intervals, over the
    # whistling of the wind in the rigging (BigSoundBank s2443, 12 dB lower).
    tinks = [af(src(m), hp(400)) for m in METAL]
    whistle = af(src(MASTS), hp(500), lp(4000))
    for sid, motif, t0, seed_val in (
            ('a_rigging-1', ((0.00, 0, 0.0, 1.0), (0.55, 2, -1.0, 0.55), (0.72, 1, 0.5, 0.8), (1.90, 3, -0.5, 0.9), (2.65, 0, 1.0, 0.45)), 4.0, 21),
            ('a_rigging-2', ((0.00, 4, -2.0, 0.9), (0.95, 2, -1.5, 0.7), (1.30, 4, -2.5, 0.5), (1.42, 1, -1.0, 0.75), (2.80, 3, -2.0, 0.6)), 21.0, 22)):
        n = int(3.6 * SR)
        layer_list = [(transpose(tinks[i], dt), t, g) for t, i, dt, g in motif]
        x = place(n, *layer_list)
        bg = C.fade(circ(whistle, t0, 3.6), 0.4, 0.8)
        x = queue(x, 0.6, 0.15, 6000, seed_val)[:n] + to_level(bg, x, -12)
        one_shot(P, sid, x, 3.6, [('amb-kenney', METAL[0]), ('amb-bsb', MASTS)],
                 'composite: 5 Kenney light metal impacts (impactMetal_light, transposed from -2.5 to +1 semitone) at '
                 f'irregular, over the whistling masts s2443 ({num(t0)} s, -12 dB)', cutpoint=-50, end_s=0.002)

    # Hulls and mooring lines creaking
    x = af(src(HULL, 20.2, 3.4), hp(70))
    one_shot(P, 'a_creak-1', C.fade(x, 0.3, 0.6), 3.4, [('amb-craigsmith', HULL)],
             'wooden hull groaning, 20.2-23.6 s, high-pass 70 Hz, fades of 0.3 and 0.6 s', cutpoint=-60)
    x = af(src(PULLEY, 9.3, 4.0), hp(150))
    one_shot(P, 'a_creak-2', x, 4.0, [('amb-craigsmith', PULLEY)], 'pulley and rigging, 9.3-13.3 s, high-pass 150 Hz')

    # Distant foghorn: East Brother Island lighthouse diaphone, low-pass and bay echo
    x = af(src(FOGHORN), hp(60), lp(2200, 1), trebles(1200, -4))
    x = C.fade(x, 0.03, 0.15)
    one_shot(P, 'a_foghorn', queue(x, 3.2, 0.45, 1800, 31), 6.0, [('amb-dowd', FOGHORN)],
             'whole file, low-pass 2.2 kHz, bay reverb (3.2 s)', fout=1.2)

    # Buoy bell: ship bell strike (Sojan), transposed down, struck at irregular intervals
    # as if by the swell, with small differences in pitch and force.
    blow = af(src(SHIP_BELL), hp(150))
    for sid, base, motif, seed_val in (
            ('a_buoybell-1', -5, ((0.0, 0.0, 1.0), (1.75, 0.15, 0.55), (2.35, -0.1, 0.85), (4.2, 0.05, 0.5)), 41),
            ('a_buoybell-2', -3, ((0.0, 0.1, 0.9), (0.42, -0.05, 0.45), (2.6, 0.0, 1.0), (3.95, 0.12, 0.6)), 42)):
        n = int(6.5 * SR)
        x = place(n, *[(transpose(blow, base + dt), t, g) for t, dt, g in motif])
        x = queue(af(x, lp(6000, 1)), 1.6, 0.2, 3000, seed_val)
        one_shot(P, sid, x, 6.0, [('amb-sojan', SHIP_BELL)],
                 f'composite: 4 strikes of a ship bell transposed by {base} semitones (±0.15), marine reverb',
                 fout=1.0)


# ---------------------------------------------------------------------------------------------------------------------
# Floralia: botanical garden in bloom, large greenhouse, Paris around

def floralia():
    P = 'amb_floralia'
    # Bed: wind in the trees of a park (icmusic; low-pass 2.2 kHz which also removes its distant birds), grasses
    # and tree in the breeze (Félix Blume; two passes for left and right), very faint bee buzzing and crickets,
    # very distant city rumble.
    tree_list = levels_out(af(src(PARK, 0.0, 30.0, stereo=True), hp(70), lp(2200)), 1.0, 0.6)
    h = af(src(SAVANNA), hp(90), trebles(2500, 3))
    grasses = to_level(stereo(h[int(12 * SR):int(42 * SR)], h[int(15 * SR):int(45 * SR)]), tree_list, 0)
    b = af(src(BEES), hp(120), lp(2500))

    def swarm(seed_val):
        # 1.6 s chunks taken at random, transposed by ±1 semitone, spliced back with crossfades: no audible period
        rng = np.random.default_rng(seed_val)
        out = np.zeros(int(31 * SR)); t = -0.5
        while t < 30.5:
            d = rng.uniform(0.0, len(b) / SR - 1.7)
            m = C.fade(transpose(b[int(d * SR):int((d + 1.6) * SR)], rng.uniform(-1, 1)), 0.4, 0.4, 1.0)
            i = int(max(t, 0) * SR); m = m[int(max(-t, 0) * SR):]
            k = min(len(m), len(out) - i)
            out[i:i + k] += m[:k]
            t += 1.1
        return out[int(0.5 * SR):int(30.5 * SR)]
    bees = to_level(stereo(swarm(51), swarm(52)), tree_list, -14)
    g = af(src(CRICKETS), hp(3000, 3), lp(9000, 1))
    cricket_chirps = to_level(stereo(circ(g, 0.0, 30.0), circ(g, 11.0, 30.0)), tree_list, -24)
    town = af(src(CITY, 0.0, 30.0, stereo=True), hp(40), lp(380))
    town = to_level(town, tree_list, -15)
    bed(P, tree_list + grasses + bees + cricket_chirps + town, 3.0,
        [('amb-icmusic', PARK), ('amb-blume-savanna', SAVANNA), ('amb-tom-woysky', BEES), ('amb-hdfreema', CRICKETS),
         ('amb-janbezouska', CITY)],
        'park trees 0-30 s, low-pass 2.2 kHz, level swell smoothed; grasses and tree 12-42 s (left) and 15-45 s '
        '(right), treble +3 dB, same level; bees spliced from 1.6 s chunks (-14 dB); crickets above 3 kHz '
        '(-24 dB); city 0-30 s, low-pass 380 Hz (-15 dB); loop with 3 s fade')

    # Birds: blackbird, great tit, woodpecker (the robin is missing under a free license), chaffinch, wood pigeon, blackcap
    birds = [
        ('a_bird-1', af(src(BLACKBIRD), hp(1000)), 'amb-bsb', BLACKBIRD, 'blackbird s3476, full phrase, high-pass 1 kHz'),
        ('a_bird-2', af(src(TIT), hp(1500)), 'amb-mysid', TIT, 'great tit (Parus_major.ogg, 1.9 s excerpt), high-pass 1.5 kHz'),
        ('a_bird-3', af(src(WOODPECKER), hp(300)), 'amb-benboncan', WOODPECKER, 'woodpecker drumming, whole file, high-pass 300 Hz'),
        ('a_bird-4', af(src(CHAFFINCH, 1.05, 3.4), hp(1500)), 'amb-mysid', CHAFFINCH, 'chaffinch, 1.05-4.45 s, high-pass 1.5 kHz'),
        ('a_bird-5', doorway(af(src(WOODPIGEON, 0.8, 4.0), hp(200), lp(800), 'afftdn=nr=15:nf=-38')[int(0.5 * SR):int(3.25 * SR)],
                           -26, -16), 'amb-mysid',
         WOODPIGEON, 'wood pigeon, one phrase 1.3-4.05 s, band-pass 200-800 Hz (magpie and background hiss removed), denoising, '
         'soft gate between the notes'),
        ('a_bird-6', af(src(BLACKCAP), hp(1200)), 'amb-bsb', BLACKCAP, 'blackcap s3466, full song, high-pass 1.2 kHz'),
    ]
    for sid, x, key, f, d in birds:
        one_shot(P, sid, queue(x, 0.7, 0.08, 6000, 61), 6.0, [(key, f)], d + ', small reverb', fout=0.3)

    # Waterfall (5 s loop) and fountain / stream (4 s loop)
    x = af(src(WATERFALL, 12.0, 7.0), hp(60))
    mono_loop(P, 'a_waterfall', x, 2.0, [('amb-straget-cascade', WATERFALL)], '12-19 s, high-pass 60 Hz, loop with 2 s fade')
    x = ceiling(af(src(STREAM, 20.0, 5.5), hp(120)), 6)
    mono_loop(P, 'a_fountain', x, 1.5, [('amb-gluckose', STREAM)], '20-25.5 s, high-pass 120 Hz, sharpest drops '
                'limited (6 dB), loop with 1.5 s fade')


# ---------------------------------------------------------------------------------------------------------------------
# Notos: Cyclades port in midsummer

def notos():
    P = 'amb_notos'
    # Bed: calm sea washing a shore (distant: low-pass 4 kHz), cicada chorus recorded in Paros (distant, 15 dB under the sea) and
    # sea wind singing in an awning (two passes for left and right, whistling softened, 9 dB under the sea)
    seaside = ceiling(af(src(SEA_WASH, 100.0, 30.0, stereo=True), hp(60), lp(4000)), 14)  # pebbles rolled by a wave around 117.5 s: peaks flattened
    cicadas = to_level(af(src(CICADAS_PAROS, 60.0, 30.0, stereo=True), hp(2500), lp(9000, 1)), seaside, -15)
    wind = stereo(af(src(WIND_SHADE, 30.0, 30.0), hp(120), eq(1800, -6, 1.5)), af(src(WIND_SHADE, 80.0, 30.0), hp(120), eq(1800, -6, 1.5)))
    wind = to_level(wind, seaside, -9)
    bed(P, large(seaside + cicadas + wind, 1.4), 3.0, [('fs-185225', SEA_WASH), ('fs-690510', CICADAS_PAROS), ('fs-690512', WIND_SHADE)],
        'sea 100-130 s (high-pass 60 Hz, low-pass 4 kHz, peaks limited by 14 dB at most); cicadas 60-90 s (2.5-9 kHz, -15 dB); wind in an awning 30-60 s and 80-110 s '
        '(left, right; -6 dB at 1.8 kHz, -9 dB); widened image (side x1.4); loop with 3 s fade')

    # Lapping against the quay: waves licking rocks (12 s loop)
    x = af(mono(src(LAP_ROCKS, 26.0, 14.0, stereo=True)), hp(80), lp(7000, 1))
    mono_loop(P, 'a_waves', x, 2.0, [('fs-457956', LAP_ROCKS)], '26-40 s, high-pass 80 Hz, loop with 2 s fade')

    # Hill cicadas (10 s loop, laid over four trees)
    x = af(mono(src(CICADAS_PAROS, 70.0, 12.0, stereo=True)), hp(1800))
    mono_loop(P, 'a_cicadas', x, 2.0, [('fs-690510', CICADAS_PAROS)], '70-82 s, high-pass 1.8 kHz, loop with 2 s fade')

    # Mill: one full creaking cycle (Félix Blume, lone windmill in the desert)
    x = af(mono(src(WINDMILL, 62.0, 17.5, stereo=True)), hp(250))
    mono_loop(P, 'a_mill', x, 1.5, [('fs-131924', WINDMILL)], '62-79.5 s, high-pass 250 Hz, loop with 1.5 s fade')

    # Seagulls: four calls, taken from a clean recording (no background)
    for k, t in enumerate((27.8, 40.85, 45.5, 51.55)):
        x = af(mono(src(GULLS_CLEAN, t, 2.6, stereo=True)), hp(400))
        one_shot(P, f'a_gull-{k + 1}', queue(x, 1.2, 0.15, seed_val=10 + k), 3.0, [('fs-462462', GULLS_CLEAN)],
                 f'{num(t)}-{num(t + 2.6)} s, high-pass 400 Hz, small open-air reverb', fout=0.3)

    # Chapel bell: two strokes
    x = af(mono(src(BELL_SMALL, 5.7, 6.0, stereo=True)), hp(200))
    one_shot(P, 'a_bell', x, 6.0, [('fs-153580', BELL_SMALL)], '5.7-11.7 s, high-pass 200 Hz', fout=1.2)

    # Bells of a goat herd (Félix Blume, Naples)
    for k, t in enumerate((56.4, 66.8)):
        x = af(mono(src(GOATS, t, 5.0, stereo=True)), hp(600))
        one_shot(P, f'a_goats-{k + 1}', burst_envelope(x, 0.6, 1.4), 5.0, [('fs-131925', GOATS)],
                 f'{num(t)}-{num(t + 5)} s, high-pass 600 Hz, rise 0.6 s, fall 1.4 s', cutpoint=-60)

    # Notos gusts: the wind rising in the awning
    for k, t in enumerate((87.4, 111.4)):
        x = af(src(WIND_SHADE, t, 4.0), hp(120), eq(1800, -4, 1.5))
        one_shot(P, f'a_gust-{k + 1}', burst_envelope(x, 0.9, 1.4), 4.0, [('fs-690512', WIND_SHADE)],
                 f'{num(t)}-{num(t + 4)} s, high-pass 120 Hz, -4 dB at 1.8 kHz, rise 0.9 s, fall 1.4 s', cutpoint=-60)


# ---------------------------------------------------------------------------------------------------------------------
# Scoria: research station at the foot of an erupting volcano

def scoria():
    P = 'amb_scoria'
    # Bed: rumble of Yasur (Vanuatu) between two eruptions, very low (low-pass 500 Hz), under a heavy summit wind (Kitt Peak, 6 dB
    # under the rumble)
    rumble = af(src(YASUR, 0.0, 30.0, stereo=True), hp(25), lp(500))
    wind = to_level(af(src(WIND_KITT, 20.0, 30.0, stereo=True), hp(120), lp(5000, 1)), rumble, -6)
    bed(P, levels_out(rumble, 2.0, 0.5) + wind, 3.0, [('fs-176589', YASUR), ('fs-135193', WIND_KITT)],
        'volcano 0-30 s (25-500 Hz, swells smoothed); wind 20-50 s (high-pass 120 Hz, -6 dB); loop with 3 s fade')

    # Crater explosions: the Yasur eruption, from afar (low-pass, long open-air reverb)
    for k, (t, d) in enumerate(((30.6, 10.0), (48.0, 8.0))):
        x = af(mono(src(YASUR, t, d, stereo=True)), hp(25), lp(1200))
        one_shot(P, f'a_boom-{k + 1}', queue(x, 3.0, 0.3, 900, seed_val=20 + k), 12.0, [('fs-176589', YASUR)],
                 f'{num(t)}-{num(t + d)} s, 25-1200 Hz, 3 s reverb', cutpoint=-50, end_threshold=-60, fout=2.0)

    # Thunder from the lightning of the eruption column (distant)
    for k, t in enumerate((8.3, 74.1)):
        x = af(mono(src(THUNDER, t, 6.0, stereo=True)), hp(30), lp(2500))
        one_shot(P, f'a_thunder-{k + 1}', x, 6.0, [('fs-127140', THUNDER)], f'{num(t)}-{num(t + 6)} s, 30-2500 Hz', cutpoint=-50, fout=1.5)

    # Steam silencer: the breath of a fumarole (Furnas, Azores), 12 s loop
    x = af(mono(src(FURNAS, 6.0, 14.0, stereo=True)), hp(120))
    mono_loop(P, 'a_steam', x, 2.0, [('fs-829623', FURNAS)], '6-20 s, high-pass 120 Hz, loop with 2 s fade')

    # Low fumaroles: bubbling mud (Salton Sea), 8 s loop
    x = af(mono(src(MUD_POTS, 52.5, 10.0, stereo=True)), hp(100))
    mono_loop(P, 'a_bubble', x, 2.0, [('fs-415608', MUD_POTS)], '52.5-62.5 s, high-pass 100 Hz, loop with 2 s fade')

    # Turbine hall: hum of a transformer (Waterloo, London), 10 s loop
    x = af(mono(src(TRANSFORMER, 60.0, 12.0, stereo=True)), hp(40), lp(2500))
    mono_loop(P, 'a_hum', x, 2.0, [('fs-144559', TRANSFORMER)], '60-72 s, 40-2500 Hz, loop with 2 s fade')

    # Ash-laden gusts (desert wind)
    for k, t in enumerate((6.8, 15.6)):
        x = af(src(DESERT_WIND, t, 4.0), hp(110), lp(8000, 1))
        one_shot(P, f'a_gust-{k + 1}', burst_envelope(x, 0.9, 1.4), 4.0, [('fs-112296', DESERT_WIND)],
                 f'{num(t)}-{num(t + 4)} s, high-pass 110 Hz, rise 0.9 s, fall 1.4 s', cutpoint=-60)


# ---------------------------------------------------------------------------------------------------------------------
# Cirrus: floating islands above a sea of clouds

def cirrus():
    P = 'amb_cirrus'
    # Bed: the wind singing on a mountain (Félix Blume; background crickets removed by the low-pass) and the one whistling in the spines
    # of a cactus on top of a mount in the Atacama (Félix Blume, 6 dB below)
    wind = af(src(WIND_SINGING, 100.0, 30.0, stereo=True), hp(70), lp(3800))
    whistling = to_level(af(src(WIND_ATACAMA, 30.0, 30.0, stereo=True), hp(150), lp(6000, 1)), wind, -6)
    bed(P, large(levels_out(wind + whistling, 2.0, 0.4), 1.3), 3.0, [('fs-165526', WIND_SINGING), ('fs-156414', WIND_ATACAMA)],
        'wind 100-130 s (70-3800 Hz); wind in the spines 30-60 s (150-6000 Hz, -6 dB); swells smoothed; widened image (side x1.3); '
        'loop with 3 s fade')

    # Gusts on a ridge
    for k, t in enumerate((8.8, 44.1)):
        x = af(mono(src(GUSTS_RIDGE, t, 4.0, stereo=True)), hp(110), lp(8000, 1))
        one_shot(P, f'a_gust-{k + 1}', burst_envelope(x, 0.9, 1.4), 4.0, [('fs-817188', GUSTS_RIDGE)],
                 f'{num(t)}-{num(t + 4)} s, high-pass 110 Hz, rise 0.9 s, fall 1.4 s', cutpoint=-60)

    # Hemp ropes creaking under load: the suspension bridges
    for k, t in enumerate((112.1, 117.3, 127.8)):
        x = af(mono(src(ROPE_CREAK, t, 3.0, stereo=True)), hp(150))
        one_shot(P, f'a_creak-{k + 1}', x, 3.0, [('fs-231438', ROPE_CREAK)], f'{num(t)}-{num(t + 3)} s, high-pass 150 Hz', fout=0.4)

    # Buzzards crying in the distance, in the void
    for k, (key, f, t) in enumerate((('fs-648430', BUZZARDS, 102.3), ('fs-648430', BUZZARDS, 2.3), ('fs-194678', BUZZARD, 1.2))):
        x = af(mono(src(f, t, 3.0, stereo=True)), hp(700), lp(6000, 1))
        one_shot(P, f'a_bird-{k + 1}', queue(x, 2.0, 0.25, seed_val=30 + k), 4.0, [(key, f)],
                 f'{num(t)}-{num(t + 3)} s, 700-6000 Hz, 2 s open-air reverb', fout=0.5)

    # Canvas flapping in the wind (Félix Blume, Mojave desert flag)
    for k, t in enumerate((6.0, 69.1)):
        x = af(mono(src(FLAG_MOJAVE, t, 3.5, stereo=True)), hp(100))
        one_shot(P, f'a_flap-{k + 1}', burst_envelope(x, 0.35, 0.9), 3.5, [('fs-187364', FLAG_MOJAVE)],
                 f'{num(t)}-{num(t + 3.5)} s, high-pass 100 Hz, rise 0.35 s, fall 0.9 s', cutpoint=-60)


SOUND_PACKS = {'chergui': chergui, 'saintgivre': saintgivre, 'portmael': portmael, 'floralia': floralia, 'notos': notos, 'scoria': scoria, 'cirrus': cirrus}


def build(exclusively=None):
    """Builds the ambience packs (only: list of maps, for example AMB=notos,scoria; the credits of the other packs are
    kept as is in credits-ambiences.json)."""
    import json, os
    exclusively = exclusively or [c for c in os.environ.get('AMB', '').split(',') if c]
    CREDITS.clear()
    if exclusively:
        f = C.MASTERS / 'credits-ambiences.json'
        kept_credits = [e for e in json.loads(f.read_text(encoding='utf-8')) if e['pack'] not in {'amb_' + c for c in exclusively}] if f.exists() else []
        CREDITS.extend(kept_credits)
    for c, fn in SOUND_PACKS.items():
        if not exclusively or c in exclusively: fn()
    C.write_credits('ambiences', CREDITS)
