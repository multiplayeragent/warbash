<h1 align="center"><img src="assets/logo.webp" alt="War Bash" width="640"></h1>

**War Bash** is a free first-person shooter that runs in the browser, on desktop and on phones: solo against bots, or online
with friends. It is a fork of [Riposte: Frontline](https://github.com/BenDBSS/Riposte-Frontline-Source) by BenDBSS (MIT), with
a new identity, new artwork and music, and online play on [Multiplayer Agent](https://multiplayeragent.com).

## Build and play

Needs Python 3 and Node.js 18 or later.

```bash
python3 build.py          # writes dist/index.html, plus dist/tex, dist/sfx, dist/maps next to it
npx serve dist            # or any static server; then open the address it prints
```

The page also opens straight from the file (`dist/index.html`) for solo play.

### Soldier animations

The soldier animations are not in this repository: Mixamo's terms do not allow redistributing them. Bake them once from your
own free Mixamo account by following `docs/animations.md`. Without them the soldiers still play, in their fallback poses.

### Online play

Online rooms run on Multiplayer Agent. The committed `mp.config.js` holds a placeholder key, so a fresh clone runs offline
(solo and bots). To play online, create a game on Multiplayer Agent and put its publishable key in `mp.config.local.js`
(gitignored):

```js
window.MP_CONFIG.key = 'pk_live_...';
```

Then deploy the room logic once (`node mp/deploy.mjs`). How rooms, quick play and the server limits work: `mp/README.md`.

### Before you put it online

The privacy, terms and legal notice screens name the publisher. Copy `legal.example.json` to `legal.local.json` (gitignored)
and fill in your name, address, contact email and host; the build prints a warning while they are missing.

## Tests

```bash
npm install               # once: the test gate's browser driver
npm test                  # build, boot, menus, a bot match, online with 3 clients, frame pacing
```

`npm test -- --gpu=dgpu` picks the GPU on a laptop with two; `--no-mp` and `--no-perf` skip steps. The bot match and the
pacing check open a browser window: leave it in front, a covered window is throttled by the browser.

## Tools

- `tools/art/`: the artwork (logo, icons, key art, rank insignia), generated with an image model (`gen.mjs`) and processed
  into `assets/` (`process.py`).
- `tools/music/score.py`: the music, written note by note and played by an orchestra SoundFont; `compose.py`: the hit sound and
  the synthesized drums. Swapping in other tracks: `docs/music.md`.
- `tools/check_secrets.mjs` and `tools/hooks/`: refuse any commit, push or build that contains a secret key.
- `tools/dev/`: the upstream development tools (visual checks, benches, asset builders).

The code and its comments are in French, as in the upstream project. Comments that point to a README section ("voir README
« ... »") refer to the upstream project's development notes.

## License

Code under the MIT License (`LICENSE`). Credits and third-party licenses (sounds, textures) in `NOTICE.md`.
