# Contributing to War Bash

Issues and pull requests are welcome.

- Build with `python3 build.py` and run the test gate (`npm test`, see the README) before opening a pull request.
- The game code and its comments are in French, inherited from the upstream project. Keep new comments in the language of the
  file you are editing. Player-facing text goes through `_t()` with an English entry in `i18n/` (the build checks it).
- Never commit keys or secrets. The Multiplayer Agent key goes in `mp.config.local.js`, which is gitignored. The hooks in
  `tools/hooks/` (install with `sh tools/hooks/install.sh`) refuse a commit or a push that contains a secret key.
- Do not add files with unclear licenses. Third-party sounds and textures must be CC0 or credited in `assets/sfx/credits.json`
  and `NOTICE.md`.
