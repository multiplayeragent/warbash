# War Bash: credits and what is not under the MIT License

## Code

War Bash is a fork of **Riposte: Frontline** by BenDBSS
(https://github.com/BenDBSS/Riposte-Frontline-Source, snapshot 5.6.0, commit `31ca050`). The original code and this fork are
released under the MIT License (`LICENSE`), which keeps the original author's copyright notice. War Bash is not the official
Riposte: Frontline game and is not endorsed by its author.

The upstream project listed some files that were not under its MIT License. None of them are in this repository:

| Upstream item | In War Bash |
|---|---|
| Name and logo of Riposte: Frontline | Replaced: new name, logo, icons, key art and store images (see "Artwork" below) |
| Music made with Suno (rank up, victory, defeat, menu theme) | Replaced: original music written for War Bash (`tools/music/score.py`) |
| Hit sound sample (`HIT_SAMPLE` in `src/05-audio.js`) | Replaced: synthesized by `tools/music/compose.py` |
| Soldier animations baked from Mixamo | Not included. Bake them from your own Mixamo account: `docs/animations.md` |

## Artwork

The logo, icons, menu key art, store images and rank insignia in `assets/` were generated for War Bash with an image model
(prompts in `tools/art/prompts.json`, processing in `tools/art/process.py`) and are distributed with the project under the same
terms as the code.

## Music and hit sound

`assets/rankup.mp3`, `assets/sfx/fin/m_victory.mp3`, `assets/sfx/fin/m_defeat.mp3` and `assets/music/menu-theme.mp3` are
original pieces written note by note in `tools/music/score.py` and are under the MIT License. They are played by FluidSynth
(a tool, not distributed here) with the MuseScore General SoundFont, which is under the MIT License; its notice reads:

> FluidR3 (original version) by Frank Wen Copyright (c) 2000-02. Mono conversion (FluidR3Mono) by Michael Cowgill Copyright
> (c) 2014-17. Adaptation for MuseScore_General.sf2 by S. Christian Collins Copyright (c) 2018-19. Temple Blocks instrument
> provided by Ethan Winer Copyright (c) 2002. Drumline Cymbals provided by Michael Schorsch Copyright (c) 2016.

The war drums, impacts and ostinato layer under the orchestra, and `HIT_SAMPLE`, are synthesized by `tools/music/compose.py`
(no samples, no recordings). To use other tracks, see `docs/music.md`.

## Sounds and voices

`assets/sfx/` keeps the sounds of the upstream project. Each source keeps its own license, listed in `assets/sfx/credits.json`.
Most are CC0. The ones below require credit:

- Woodpecker by Benboncan (freesound.org/s/66955), CC BY 3.0
- Waterfall by Samuel Strägefors (straget) (freesound.org/s/489073), CC BY
- "Grenade pin pull" by CGEffex (freesound.org/s/93837), CC BY 4.0
- Voice references: LibriTTS-R (Koizumi et al., Google) and Multilingual LibriSpeech (Pratap et al., Facebook AI), CC BY 4.0
- Impulse responses: Conner's Impulse Response Library (itsmusician), MIT
- Voices generated with Chatterbox by Resemble AI (MIT model) for Riposte: Frontline

## Textures, skies and lighting

`assets/tex/`, `assets/sky/` and `assets/vendor/hdri/`: Poly Haven and ambientCG, CC0.

## Libraries

three.js r147 (MIT License, notice at the top of `assets/vendor/three-r147.js`). The npm packages used by the tools keep their
own licenses.
