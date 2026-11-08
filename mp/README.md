# Online play on Multiplayer Agent

War Bash keeps the upstream game's netcode (`src/09c-net.js`): one player hosts a room (lobby, bots, match clock) and the
others are guests. Multiplayer Agent carries the traffic:

- `src/09d-netrelay.js` is the client transport. It joins a Multiplayer Agent room and exposes the same connection interface
  the netcode always used (`send`, `close`, `on('open' | 'data' | 'close' | 'hostdown' | 'rehost')`).
- `mp/room-relay.js` is the authoritative room logic. It routes messages between the host and its guests, fans each guest's
  state out to the room (so the host stays under the 60 messages per second cap), and enforces the room rules: one host,
  8 players, the room code as a password, kicks, a reconnecting player getting back the same identity.

## Rooms

Room logic binds to exact room names, so the game uses a fixed pool of 32 rooms, `wb-A` ... `wb-Z` (no `I`, `O`) and
`wb-2` ... `wb-9`. The first character of a room code names its room:

- letters: private rooms, with a random 5-character code (the other 4 characters are checked by the server);
- digits: the public quick-play rooms, with the fixed codes `2BASH` ... `9BASH`. "Play now" tries them in order: it joins
  the first one that has a host and room, and opens the first free one (with bots, started at once).

## Setup for your own copy

1. Create a game on Multiplayer Agent and put its publishable key in `mp.config.local.js` (gitignored):
   `window.MP_CONFIG.key = 'pk_live_...';`
2. Deploy the room logic to the 32 rooms: `node mp/deploy.mjs`. It needs the studio's secret key in `MPA_SECRET_KEY` (or a
   local `.mcp.json`, gitignored). `node mp/deploy.mjs --logs wb-A` prints a room's runtime errors.
3. `node mp/probe.mjs` checks the relay protocol without the game; `node tools/gate/mp.mjs` plays real game clients.

## Limits to design around

Messages over 2048 characters are split into chunks by the transport and rebuilt on arrival; each client sends at most 60
messages a second (the transport keeps a token budget and skips a state update rather than queueing it). A dropped
connection resumes by itself for about 30 seconds; after that the guest re-links with the same identity and the host gives
it back its place.

## Hosting on a share link

Multiplayer Agent can host the built game, with a limit of 100 files and 50 MB per game. The default build writes one file
per texture pack (about 120 files); `WARBASH_BUNDLE=3` groups them three by three (about 80 files, 41 MB):

```bash
WARBASH_BUNDLE=3 WARBASH_SITE=https://<slug>.play.multiplayeragent.com python3 build.py
node mp/publish.mjs      # uploads dist/ and makes it the hosted game; prints the share link
```

`WARBASH_SITE` is the address the share previews and canonical links point to. The slug comes from the game's name at its
first publish and never changes.
