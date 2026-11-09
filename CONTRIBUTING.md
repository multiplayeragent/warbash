# Contributing to War Bash

Issues and pull requests are welcome.

- Build with `python3 build.py` and run the test gate (`npm test`, see the README) before opening a pull request.
- Code, comments and tools are in English (the build fails on French outside in-world signs and place names).
  Player-facing text goes through `_t()` for its {0} placeholders.
- Never commit keys or secrets. The Multiplayer Agent key goes in `mp.config.local.js`, which is gitignored. The hooks in
  `tools/hooks/` (install with `sh tools/hooks/install.sh`) refuse a commit or a push that contains a secret key.
- Do not add files with unclear licenses. Third-party sounds and textures must be CC0 or credited in `assets/sfx/credits.json`
  and `NOTICE.md`.
