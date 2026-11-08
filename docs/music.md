# Music: the four tracks and how to replace them

War Bash plays four music files. Each one can be replaced by any MP3 that keeps its name, its role and roughly its loudness.

| File | Plays | Length | Loudness |
|---|---|---|---|
| `assets/music/menu-theme.mp3` | In the main menus, looping; it fades out when a match loads | any (now 1 min 55 s) | -13.8 LUFS |
| `assets/rankup.mp3` | On a level up, under the banner | about 4 to 5 s | -15.9 LUFS |
| `assets/sfx/fin/m_victory.mp3` | On "Victory" at the end of a match | about 4 to 6 s | -13.8 LUFS |
| `assets/sfx/fin/m_defeat.mp3` | On "Defeat" at the end of a match | about 7 to 9 s | -18.4 LUFS |

The game sets its own volumes on top (the Music slider and the master volume), so a track much louder or quieter than the
table will stand out. Measure with `ffmpeg -i track.mp3 -af ebur128 -f null -` (the `I:` line), and adjust with
`ffmpeg -i in.mp3 -af loudnorm=I=-13.8:TP=-1.5 -ar 48000 -c:a libmp3lame -q:a 4 out.mp3`.

## Replacing a track

1. Convert it to MP3, 48 kHz, stereo, with no cover art or tags:
   `ffmpeg -i in.wav -map_metadata -1 -ar 48000 -ac 2 -c:a libmp3lame -q:a 4 out.mp3`.
2. Bring it to the loudness in the table (see above) and put it in place of the file.
3. The menu theme loops: the end should run straight into the start (a browser leaves a very short gap at the seam).
4. The end-of-match tracks also have an entry in `assets/sfx/fin/meta.json` (length, loudest point). Rewrite both with
   `python3 tools/music/score.py --meta` (needs numpy, scipy and ffmpeg, not FluidSynth).
5. `python3 build.py`. The level-up fanfare is embedded in the page; the others are files next to it.

Licenses: put only music you have the right to distribute, and credit it in `NOTICE.md`.

## The current tracks

They are written note by note in `tools/music/score.py` (themes, harmony and orchestration) and played by FluidSynth with the
MuseScore General SoundFont, with synthesized war drums and impacts from `tools/music/compose.py` underneath:

```bash
python3 tools/music/score.py --fetch    # once: FluidSynth (Windows build) and the SoundFont, into tools/music/.cache/
python3 tools/music/score.py            # all four; or one of: rankup, victory, defeat, menu
```

The menu theme is rendered as three identical passes and the middle one is kept, so the reverb at its start is the tail of
its own end and the loop has no seam.
