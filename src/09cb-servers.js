/* ==========================================================================
   PERMANENT PUBLIC LOBBIES (game server, serveur/relais.js, "Permanent lobbies" in serveur/README.md)
   The game server keeps several lobbies open per mode, without a host: nobody sets up the match. Players enter from the
   Multiplayer screen's list, or via "Join a match", which asks for the mode then places the player in the lobby of that mode with the
   most players. The server keeps the player list (not the bots), the vote and the countdown: below the threshold (half
   the spots), we wait; at the threshold, countdown, and two maps up for vote, at bottom left; shortly before the end, the map with the most
   votes is chosen. At the end of the countdown, the server picks one of the players to host the match (a computer preferably):
   their game opens an ordinary lobby with the code the server gives them (netHost, src/09c-net.js), the server announces this code to the
   others, who join it (netJoinLobby); the match runs as in a lobby among friends. After the match, everyone returns to the
   public lobby, where the countdown to the next one has begun, with two new maps up for vote.
   The match's lobby (NET.role 'host' or 'client', NET.srv) lives alongside the connection to the public lobby (SRV.ws); it is closed again,
   without touching the public lobby's chat, when the match is over and the player has returned to the menus (srvSync).
   Lobbies created by players (st.ps): also kept by the server, public or private, all in the list (a private one without its code:
   you can only enter it by typing it). Their leader (the creator, then the oldest if they leave) sets up the match (map, mode, bots, limit,
   duration, public or private), moves or kicks a player and launches the match; everyone chooses their team. No threshold or vote. The
   match is hosted as in a permanent lobby by the player the server picks, with the lobby's settings.
   If a match's host leaves, the server entrusts it to another player in it (SRV.inGame, sent to the server), whose game takes it over
   without stopping it (netTakeOver, src/09c-net.js).
   Since 5.2.2 (owner feedback), the list only shows public lobbies launched by players, and only if they have
   people in them: permanent lobbies remain kept by the server, but the game no longer offers them (neither in the list, nor via "Join a
   match", removed).
   A game server that doesn't know permanent lobbies yet (GET /salons without "serverList"): SRV.list stays null and
   the Multiplayer screen keeps the earlier home (Play now, lobbies opened by a host).
   ========================================================================== */
const SRV = {
  list: null, created: [], // permanent lobbies from the last list (null: the server has none), lobbies created by players
  make: null, byCode: false, kickAsk: '', // settings of a lobby to create; entry by a code (fallback: a host's lobby); kick to confirm
  on: false, id: '', ws: null, st: null, at: 0, // in a public lobby: its identifier, the connection, its last state (received at at)
  me: '', key: '', fails: 0, timer: 0, up: false, // my identifier and my key in this lobby (kept from one reconnection to the next)
  hostCode: '', wait: null, opened: false, // match I'm hosting: its code, who to wait for before launching it ({ n, t }), announced to the server
  tried: '', triedT: 0, tries: 0, // last match lobby tried (no new attempt at the same one before 5 s) and number of attempts at this lobby
  inGame: -1, // last "in a match or not" announced to the server (only a player in a match can take it over if its host leaves)
  voteKey: '', // displayed content of the vote block (rebuilt only when it changes)
};
const SRV_TRIES = 3; // attempts to enter the lobby of the same match before giving up (host gone or mute: without this, the game retried endlessly)
const SRV_WAIT = 6000; // the host waits at most 6 s for the public lobby's players to enter the match lobby before launching it
const SRV_PHASES = ['waiting', 'countingDown', 'starting', 'inProgress'];
/* In a lobby, public or among friends (the Multiplayer screen then shows the lobby, Back asks to leave it) */
function netInLobby() { return NET.role !== 'off' || SRV.on; }
/* Hosting value sent to the server: a computer in the foreground first, then a phone, never a hidden tab */
function srvHostScore() { return document.hidden ? 0 : TOUCH.on ? 1 : 2; }
/* Lobbies from the received list (GET /salons, netPubFetch): bounded, those of another game version discarded (unless empty) */
function srvRead(d) {
  SRV.list = srvParse(d);
  SRV.created = !SRV.list || !Array.isArray(d.created) ? [] : d.created.filter((s) => s && (s.i === '' || /^[A-Z0-9]{5}$/.test(s.i)) && MODES[s.o] && MAPS.some((m) => m.id === s.m && m.ok) && SRV_PHASES.includes(s.p) && s.v === NET_PROTO)
    .map((s) => ({ i: s.i, o: s.o, m: s.m, j: clamp(s.j | 0, 0, 99), x: clamp(s.x | 0, 1, 99), p: s.p, n: netClean(s.n), pv: !!s.pv }));
}
function srvParse(d) {
  if (!d || !Array.isArray(d.serverList)) return null;
  return d.serverList.filter((s) => s && /^[a-z]{3}[0-9]{1,2}$/.test(s.i) && MODES[s.o] && MAPS.some((m) => m.id === s.m && m.ok) && SRV_PHASES.includes(s.p) && (s.v === NET_PROTO || !(s.j > 0)))
    .map((s) => ({ i: s.i, o: s.o, k: clamp(s.k | 0, 1, 99), m: s.m, j: clamp(s.j | 0, 0, 99), x: clamp(s.x | 0, 1, 99), p: s.p }));
}
function srvSend(m) { const ws = SRV.ws; if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(m)); } catch (e) { /* connection closing */ } } }

/* ---------- Enter, stay, leave ---------- */
/* Enters a server lobby: a permanent lobby (id 'tdm1'), a created lobby (its code), or a lobby to create ('newLobby', o.make: its
   settings); o.code: code typed by the player (if it isn't on the server, it may be a host's lobby, joined afterward) */
function srvJoin(id, o = {}) {
  if (netInLobby() || !netViaServer() || !acctGate(o.code ? id : undefined)) return;
  netNick();
  Object.assign(SRV, { on: true, inGame: -1, id, st: null, at: 0, me: 's' + netrRandom(10), key: netrRandom(24), fails: 0, up: false, hostCode: '', wait: null, tried: '', tries: 0, voteKey: '', make: o.make || null, byCode: !!o.code, kickAsk: '' });
  chatClear(); NET.muted.clear();
  netdReset('srv', id); netdLog('public lobby ' + id + ': connecting');
  netStatus(_t('Connecting to the lobby...'));
  srvConnect();
  netRender({ fresh: true });
}
function srvConnect() {
  if (!SRV.on) return;
  SRV.lv = playerLevel(); // level announced on entry; its changes follow (srvLevel)
  const q = new URLSearchParams({ id: SRV.me, key: SRV.key, v: String(NET_PROTO), n: NET.nick, lv: String(SRV.lv), h: String(srvHostScore()), ...(SRV.id === 'newLobby' ? SRV.make : {}) });
  let ws;
  try { ws = new WebSocket(netrUrl() + '/server/' + SRV.id + '?' + q); } catch (e) { srvLost(0); return; }
  SRV.ws = ws;
  ws.onopen = () => { if (SRV.ws === ws) { SRV.up = true; SRV.fails = 0; SRV.inGame = -1; NETD.rel = 'ok'; } }; // ("in a match" announced again after a reconnection)
  ws.onmessage = (e) => {
    if (SRV.ws !== ws || typeof e.data !== 'string') return;
    if (e.data.charCodeAt(0) === 2) { const [cmd, a] = e.data.slice(1).split(NETR_SEP); if (cmd === 'refuse') ws.refused = Number(a) || 4001; return; }
    let m; try { m = JSON.parse(e.data); } catch (err) { return; }
    if (m && typeof m === 'object') srvMsg(m);
  };
  ws.onclose = (e) => { if (SRV.ws === ws) srvLost(ws.refused || e.code); };
  ws.onerror = () => { /* onclose always follows */ };
}
/* Public lobby connection lost: a refusal makes us leave the lobby, as do three failures before having entered it; a cut makes us retry
   endlessly (the server keeps the spot for a few seconds, and a match in progress doesn't depend on it) */
function srvLost(code) {
  SRV.ws = null; NETD.relCode = code; netdLog('public lobby: closed (code ' + code + ')');
  if (!SRV.on) return;
  if (SRV.byCode && !SRV.st && (code === 4004 || !SRV.up)) { const c = SRV.id; srvLeave(''); netJoinLobby(c); return; } // not on the server: a host's lobby?
  const why = { 4004: _t('This public lobby no longer exists. Pick another one.'), 4003: _t('The lobby leader removed you.'), 4002: _t('This public lobby is full.'), 4005: _t('This public lobby is running another version of the game. Pick another one.'),
    4011: _t('You are already in this lobby in another tab.'), 4029: _t('The game server is busy. Try again in a moment.'), 4013: _t('The game server is busy. Try again in a moment.') }[code];
  if (SRV.up) { SRV.up = false; SRV.fails = 0; } // cut after a successful connection: attempts restart from zero
  SRV.fails++;
  if (why || (!SRV.st && SRV.fails >= 3)) { srvLeave(why || _t('The game server cannot be reached.')); if (!why) { NETD.rel = 'fail'; netdShow(true); } return; }
  const wait = NETR.retry[Math.min(SRV.fails - 1, NETR.retry.length - 1)];
  clearTimeout(SRV.timer); SRV.timer = setTimeout(srvConnect, wait);
  netRender();
}
/* Leaves the public lobby, and the match's lobby if there is one; msg: status text of the home */
function srvLeave(msg) {
  const ws = SRV.ws;
  clearTimeout(SRV.timer);
  Object.assign(SRV, { on: false, ws: null, st: null, hostCode: '', wait: null, voteKey: '' });
  if (ws) { try { ws.close(1000); } catch (e) { /* already closed */ } } // 1000: intentional departure, the spot is freed right away
  netReset(msg); // match lobby, chat, screen state
}

/* ---------- Server messages ---------- */
function srvMsg(m) {
  if (m.t === 'lobbyState') {
    if (!SRV_PHASES.includes(m.ph) || !Array.isArray(m.j)) return;
    const first = !SRV.st;
    if (SRV.id === 'newLobby' && /^[A-Z0-9]{5}$/.test(m.i)) SRV.id = m.i; // created lobby: its code, to return after a cut
    const c = m.cfg && typeof m.cfg === 'object' ? m.cfg : {};
    SRV.st = { o: MODES[m.o] ? m.o : 'tdm', k: clamp(m.k | 0, 0, 99), ph: m.ph, i: SRV.id, ps: !!m.ps, own: String(m.own || ''),
      cfg: { bots: c.b ? 1 : 0, diff: clamp(c.df | 0, 0, 2), limit: clamp(c.lim | 0, 1, 999), time: clamp(c.min | 0, 1, 99), pub: c.pub ? 1 : 0 }, m: mapById(m.m).id, c: Array.isArray(m.c) ? m.c.slice(0, 2).map((c) => mapById(c).id) : [], vt: Array.isArray(m.vt) ? [m.vt[0] | 0, m.vt[1] | 0] : [0, 0],
      mv: m.mv === 0 || m.mv === 1 ? m.mv : -1, vo: !!m.vo, r: clamp(+m.r || 0, 0, 600000), s: clamp(m.s | 0, 1, 99), x: clamp(m.x | 0, 1, 99), me: String(m.me || ''),
      code: /^[A-Z0-9]{5}$/.test(m.code) ? m.code : '', hosting: String(m.hosting || ''),
      j: m.j.filter((p) => Array.isArray(p) && typeof p[0] === 'string').slice(0, 99).map((p) => ({ id: p[0], n: netClean(p[1]), lv: clamp(p[2] | 0, 0, 999), t: p[3] === 1 ? 1 : 0 })) };
    SRV.at = performance.now();
    if (first) netStatus('');
    srvSync(); netRender();
  } else if (m.t === 'hosting') srvHostMatch(m);
  else if (m.t === 'chat' && typeof m.id === 'string') {
    const x = chatClean(m.x); if (!x || NET.muted.has(m.id)) return;
    chatPush({ id: m.id, n: netClean(m.n), t: chatMyTeam(), x });
    if (m.id !== SRV.me) sfxUi('notify');
  }
}
/* The match's lobby follows the public lobby's state: joined when a match is open, closed again when it no longer is and
   the player has returned to the menus (results seen), left right away if it was abandoned (host gone) */
function srvSync() {
  const st = SRV.st; if (!SRV.on || !st) return;
  const code = st.ph === 'inProgress' ? st.code : '', mine = NET.role === 'host' && NET.code === SRV.hostCode && (st.ph === 'starting' || st.ph === 'inProgress');
  if (NET.role !== 'off' && NET.code !== code && !mine) {
    const live = NET.on && !MATCH.outro && (MATCH.state === 'playing' || MATCH.state === 'paused' || MATCH.state === 'killcam'); // (MATCH.outro: the match ends, announcement, final killcam and results run to completion)
    if (live) { netReset(_t('The match was interrupted, its host left.')); toMenu(); return; }
    if (MATCH.state === 'menu' && !UI.flow) netReset('');
  }
  if (code && NET.role === 'off' && !UI.flow && (SRV.tried !== code || performance.now() - SRV.triedT > 5000)) srvJoinRoom(code);
}
/* Enters the match's lobby: we play as soon as it loads or is being played (NET.quickJoin, see netClientMsg) */
function srvJoinRoom(code) {
  SRV.tries = SRV.tried === code ? SRV.tries + 1 : 1;
  if (SRV.tries > SRV_TRIES) { srvLeave(_t('Could not join this game, its host is not responding. Pick another lobby or try again in a moment.')); netdShow(true); return; } // the report shows the last attempt
  SRV.tried = code; SRV.triedT = performance.now();
  netJoinLobby(code);
  if (NET.role === 'client') { NET.srv = true; NET.quickJoin = true; }
}
/* The server entrusts me with the match: I open its lobby (the server picks another player if I can't) */
function srvHostMatch(m) {
  const code = /^[A-Z0-9]{5}$/.test(m.code) ? m.code : '';
  if (!code || !SRV.on) return;
  if (m.migr) { // the host of the match I'm in has left: I take it over, in the same lobby, with the key the server gives
    if (NET.role === 'client' && NET.srv && NET.code === code && NET.on && /^[A-Za-z0-9_-]{16,64}$/.test(m.key)) { Object.assign(SRV, { hostCode: code, opened: true, wait: null }); netTakeOver(code, m.key); }
    else srvSend({ t: 'failure', code });
    return;
  }
  if (NET.role !== 'off' && !NET.on && MATCH.state === 'menu' && !UI.flow) netReset(''); // lobby of the previous match, still open
  if (NET.role !== 'off' || UI.busy || UI.flow || MATCH.state !== 'menu') { srvSend({ t: 'failure', code }); return; }
  Object.assign(SRV, { hostCode: code, wait: { n: clamp(m.n | 0, 0, 16), t: 0 }, opened: false });
  netHost({ srv: true, code, cfg: { map: m.m, mode: m.o, bots: m.b, diff: m.df, limit: m.lim, time: m.min } }); // lobby settings (standard for a permanent lobby)
  if (NET.role !== 'host') { SRV.hostCode = ''; srvSend({ t: 'failure', code }); }
}
/* My match lobby is open on the server: the public lobby announces it to the others */
function srvRoomUp() { if (SRV.wait) SRV.wait.t = performance.now(); SRV.opened = true; srvSend({ t: 'opened', code: NET.code }); }
/* The lobby of the match I'm hosting closes before the end: not yet announced, the server picks someone else; announced, the match stops */
function srvRoomFailed() { const code = SRV.hostCode; SRV.hostCode = ''; SRV.wait = null; if (code) srvSend({ t: SRV.opened ? 'outro' : 'failure', code }); }
/* The match I'm hosting is over (or cancelled): the public lobby restarts for a countdown */
function srvRoomEnded() { const code = SRV.hostCode; SRV.hostCode = ''; SRV.wait = null; if (code) srvSend({ t: 'outro', code }); }
/* My team in a created lobby (-1 elsewhere: the match host balances the teams); I request it when entering the match */
function srvTeam() { const st = SRV.st, p = st && st.ps && st.j.find((x) => x.id === st.me); return p ? p.t : -1; }
const srvChief = () => !!SRV.st && SRV.st.ps && SRV.st.own === SRV.st.me;
/* Host: launch when the public lobby's players have entered, or after SRV_WAIT */
function srvHostTick() {
  const w = SRV.wait;
  if (!w || !w.t || NET.role !== 'host' || !NET.srv || !NET.joined || NET.phase !== 'lobby') return;
  if (NET.players.size - 1 >= w.n || performance.now() - w.t > SRV_WAIT) { SRV.wait = null; netLaunch(); }
}
/* Level gained since entering the lobby (end of match, account XP): announced to the server, which updates the list. Before, the lobby kept
   the level from arrival as long as the connection lasted, from one match to the next: a new account stayed at level 1 for everyone. */
function srvLevel() {
  if (!SRV.on || !SRV.ws || SRV.ws.readyState !== 1) return;
  const lv = playerLevel(); if (lv !== SRV.lv) { SRV.lv = lv; srvSend({ t: 'lv', lv }); }
}
function srvTick() {
  if (!SRV.on) return;
  const inGame = NET.on && NET.srv ? 1 : 0;
  if (inGame !== SRV.inGame && SRV.ws && SRV.ws.readyState === 1) { SRV.inGame = inGame; srvSend({ t: 'h', h: srvHostScore(), inGame }); }
  srvLevel();
  srvSync(); srvHostTick(); srvClock();
}
/* My vote (0 or 1): displayed right away, counted by the server */
function srvVote(c) {
  const st = SRV.st; if (!st || !st.vo || st.mv === c) return;
  st.vt[c]++; if (st.mv >= 0) st.vt[st.mv]--; st.mv = c;
  srvSend({ t: 'vote', c }); sfxUi('click'); srvVoteRender();
}
/* The footer button: join the match in progress (after leaving it, or without having entered) */
function srvStartClick() {
  const st = SRV.st; if (st && st.ps && st.ph === 'waiting' && srvChief()) { sfxUi('click'); srvSend({ t: 'launchMatch' }); return; } // the leader launches the match
  if (!st || st.ph !== 'inProgress' || !st.code) return;
  if (NET.role === 'client' && NET.code === st.code) { NET.quickJoin = false; netJoinRunning(); }
  else if (NET.role === 'off') { SRV.tried = ''; srvJoinRoom(st.code); }
}
/* Creates a lobby on the server, public or private, with its Solo settings (shared memory) */
function srvCreate(pub) {
  const MD = MODES[Settings.mode] || MODES.tdm;
  NETP.vis = pub ? 1 : 0; try { localStorage.setItem('cod_salon_pub', String(NETP.vis)); } catch (e) { /* storage unavailable */ }
  lmClose(LM.scr.multi);
  srvJoin('newLobby', { make: { m: Settings.map, o: Settings.mode, b: '1', df: String(Settings.difficulty), lim: String(Settings[MD.key]), min: String(Settings.minutes), pub: String(NETP.vis) } });
}
/* Setting changed by a created lobby's leader (like netSetupSet): sent to the server, displayed right away, found again in Solo */
function srvSetupSet(k, v) {
  const st = SRV.st; if (!srvChief() || st.ph !== 'waiting') return;
  const c = { map: st.m, mode: st.o, ...st.cfg };
  if (k === 'bots') { c.bots = v === 'off' ? 0 : 1; if (v !== 'off') c.diff = v; }
  else if (k === 'mode') { c.mode = v; c.limit = Settings[MODES[v].key]; }
  else c[k] = v;
  const n = netCfg(c); // (mode and limit validated as in a lobby)
  Object.assign(st, { m: n.map, o: n.mode }); Object.assign(st.cfg, { bots: n.bots, diff: n.diff, limit: n.limit, time: n.time, pub: c.pub ? 1 : 0 });
  Settings.map = n.map; Settings.mode = n.mode; Settings.minutes = n.time; Settings[MODES[n.mode].key] = n.limit; if (n.bots) Settings.difficulty = n.diff;
  if (k === 'pub') { NETP.vis = v ? 1 : 0; try { localStorage.setItem('cod_salon_pub', String(NETP.vis)); } catch (e) { /* storage unavailable */ } }
  saveSettings(); sfxUi('click');
  srvSend({ t: 'cfg', m: n.map, o: n.mode, b: n.bots, df: n.diff, lim: n.limit, min: n.time, pub: st.cfg.pub });
  netRender();
}
/* A created lobby's settings, for the match settings rows (matchRows) and the map inset */
function srvMatchCfg() { const st = SRV.st; return { map: st.m, mode: st.o, ...st.cfg, pubOk: true, online: true, edit: srvChief() && st.ph === 'waiting', set: srvSetupSet, note: _t('Set by the lobby leader') }; }
/* ---------- Display ---------- */
/* Seconds remaining in the countdown, from the received state */
function srvLeft() { const st = SRV.st; return st && st.ph === 'countingDown' ? Math.max(0, Math.ceil((st.r - (performance.now() - SRV.at)) / 1000)) : 0; }
/* A lobby's phase, in plain language (list and lobby screen) */
function srvPhase(p, perso) { return { waiting: perso ? _t('In the lobby') : _t('Waiting for players'), countingDown: _t('Starting soon'), starting: _t('Launching'), inProgress: _t('In match') }[p] || ''; }
/* What's happening in the lobby, above the players */
function srvNoteText() {
  const st = SRV.st;
  if (st && !SRV.up) return _t('Connection lost. Retrying...');
  if (!st) return _t('Connecting to the lobby...');
  if (st.ps && st.ph === 'waiting') return srvChief() ? _t('Set up the match, then start it whenever you want.') : _t('Waiting for the lobby leader to start the match.');
  if (st.ph === 'waiting') { const n = Math.max(1, st.s - st.j.length); return _tn(n, 'The match starts with {1} players. {0} more player needed.', 'The match starts with {1} players. {0} more players needed.', st.s); }
  if (st.ph === 'countingDown') return st.vo ? _t('The match starts in {0} s. Vote for the map.', srvLeft()) : _t('The match starts in {0} s on {1}.', srvLeft(), mapById(st.m).name);
  if (st.ph === 'starting') return _t('Opening the match on {0}...', mapById(st.m).name);
  return _t('Match in progress on {0}.', mapById(st.m).name);
}
function srvTitle() { return !SRV.st ? _t('Public lobby') : SRV.st.ps ? _t('Lobby {0}', SRV.st.i) : MODES[SRV.st.o].name; }
/* Public lobby stage: the players (without bots or teams: those are made on entering the match) */
function srvStage() {
  const st = SRV.st, note = $('srvNote');
  note.textContent = srvNoteText();
  const head = `<b>${esc(_t('Players'))}</b><span>${st ? st.j.length + '/' + st.x : ''}</span>`;
  if (st && st.ps && st.o !== 'ffa') { const mine = Math.max(0, srvTeam()); return { head, note, cols: [mine, 1 - mine].map((t) => ({ cls: t === mine ? 'ally' : 'enemy', head: esc(TEAM_NAMES[t]), rows: srvPlayerRows(t) })) }; }
  return { head, note, cols: [{ rows: srvPlayerRows(-1) }] };
}
/* A team's players (t = -1: all); in a created lobby, the spots the bots will take; you act on a player from their actions */
function srvPlayerRows(t) {
  const st = SRV.st, rows = [];
  for (const p of st ? st.j : []) {
    if (t >= 0 && p.t !== t) continue;
    const me = p.id === st.me, tags = [];
    if (st.ps && p.id === st.own) tags.push(_t('leader')); if (p.id === st.hosting) tags.push(_t('host')); if (NET.muted.has(p.id)) tags.push(_t('muted'));
    const acts = !me || (st.ps && st.o !== 'ffa' && st.ph === 'waiting'); // yourself: switch team
    rows.push({ k: 'player', key: p.id, label: p.n, lv: p.lv, tags, me, page: acts ? 'srvp' : null, params: p.id });
  }
  const free = st && st.ps && st.cfg.bots ? (t < 0 ? NET_MAX : NET_TEAM) - rows.length : 0, diff = (DIFF[st ? st.cfg.diff : 1] || DIFF[1]).name;
  for (let i = 0; i < free; i++) rows.push({ k: 'player', key: 'bot' + t + '-' + i, label: diff, bot: true });
  if (!rows.length) rows.push({ k: 'note', text: _t('Nobody') });
  return rows;
}
/* The vote block, at bottom left: two maps up for vote (mine marked, each one's votes), then the chosen or current map */
function srvVoteRender() {
  const box = $('srvVote'), st = SRV.st, show = SRV.on && !!st && !st.ps && UI.screen === 'multi'; // (no vote in a created lobby)
  box.hidden = !show; if (!show) { SRV.voteKey = ''; return; }
  const one = st.ph === 'starting' || st.ph === 'inProgress' || !st.vo;
  const cards = one ? [st.m] : st.c, head = st.ph === 'inProgress' || st.ph === 'starting' ? _t('Match in progress') : st.vo ? _t('Vote for the next map') : _t('Next map');
  const key = [head, cards.join(), st.vt.join(), st.mv, st.vo].join('|');
  if (key === SRV.voteKey) return;
  const had = box.contains(document.activeElement) ? document.activeElement.dataset.c : null;
  SRV.voteKey = key;
  const h = document.createElement('p'); h.className = 'sv-h'; h.textContent = head;
  const row = document.createElement('div'); row.className = 'sv-cards' + (one ? ' one' : '');
  cards.forEach((id, i) => {
    const m = mapById(id), b = document.createElement(one ? 'div' : 'button');
    b.className = 'sv-card mapcard' + (!one && st.mv === i ? ' on' : '');
    if (!one) { // like the footer, out of reach during a submenu
      b.type = 'button'; b.dataset.c = String(i); b.dataset.lmExtra = ''; b.tabIndex = LM.scr.multi.stack.length > 1 ? -1 : 0;
      b.setAttribute('aria-pressed', String(st.mv === i)); b.addEventListener('click', () => srvVote(i));
    }
    const art = document.createElement(MAP_ART[m.id] ? 'img' : 'span'); art.className = 'mapart' + (MAP_ART[m.id] ? '' : ' none'); if (MAP_ART[m.id]) { art.alt = ''; art.decoding = 'async'; art.src = MAP_ART[m.id]; }
    const t = document.createElement('span'); t.className = 'mtx';
    t.appendChild(Object.assign(document.createElement('span'), { className: 'mt', textContent: m.name }));
    if (one) t.appendChild(Object.assign(document.createElement('span'), { className: 'mg', textContent: MODES[st.o].btn }));
    b.append(art, t);
    if (!one) { // the map's votes, large; my vote: the frame and the number in yellow
      b.appendChild(Object.assign(document.createElement('b'), { className: 'sv-n', textContent: String(st.vt[i]) }));
      b.setAttribute('aria-label', m.name + ', ' + _tn(st.vt[i], '{0} vote', '{0} votes') + (st.mv === i ? ', ' + _t('my vote') : ''));
    }
    row.appendChild(b);
  });
  box.replaceChildren(h, row);
  if (had != null && lmWantFocus()) { const f = row.querySelector(`[data-c="${had}"]`); if (f) f.focus({ preventScroll: true }); }
}
/* What changes every second without rebuilding everything: the note's and the footer button's countdown */
function srvClock() {
  if (!SRV.on || UI.screen !== 'multi') return;
  const n = $('srvNote'); if (n) n.textContent = srvNoteText();
  srvFoot();
}
function srvFoot() {
  const st = SRV.st, b = $('netStart'), joined = NET.role === 'client' && st && NET.code === st.code;
  let t = _t('Connecting to the lobby...'), on = false;
  if (st && st.ps && st.ph === 'waiting') { t = srvChief() ? _t('Start the match') : _t('Waiting for the leader'); on = srvChief(); }
  else if (st && st.ph === 'waiting') t = _t('Waiting for players');
  else if (st && st.ph === 'countingDown') t = _t('Starting in {0} s', srvLeft());
  else if (st && st.ph === 'starting') t = _t('Launching the match...');
  else if (st && st.ph === 'inProgress') {
    if (NET.on || UI.flow || NET.role === 'host') t = _t('Loading the match...');
    else if (joined && !NET.joined) t = _t('Joining the match...');
    else { t = _t('Join the match'); on = NET.role === 'off' || (joined && NET.phase !== 'lobby'); }
  }
  if (b.textContent !== t) b.textContent = t;
  b.disabled = !on;
}
/* Home of the Multiplayer screen: the public lobbies launched by players (owner feedback: neither the server's permanent lobbies,
   nor private lobbies, nor empty lobbies), with their map, mode, phase, leader and players */
function srvListStage() {
  const rows = [], pub = SRV.created.filter((s) => !s.pv && s.i && s.j > 0);
  for (const s of pub) {
    const m = mapById(s.m);
    rows.push({ k: 'pick', key: s.i, label: m.name, sub: [MODES[s.o].btn, srvPhase(s.p, true), _t('Leader: {0}', s.n)].join(' · '), value: s.j + '/' + s.x, art: MAP_ART[m.id] || '',
      disabled: s.j >= s.x || netInLobby(), pick: () => { sfxUi('click'); srvJoin(s.i, { code: true }); } });
  }
  if (!rows.length) rows.push({ k: 'note', text: NETP.err ? _t('Public lobby list unavailable right now.') : SRV.list ? _t('No public lobby right now. Create yours and it will show up here.') : _t('Loading...') });
  const online = NETP.playerCount < 0 ? '' : `<span>${esc(_tn(NETP.playerCount, '{0} player online right now', '{0} players online right now'))}</span>`;
  return { head: `<b>${esc(_t('Public lobbies'))}</b>${online}`, cols: [{ rows }] };
}
/* Multiplayer menu pages specific to public lobbies (with NET_PAGES, src/09c-net.js) */
const SRV_PAGES = {
  // create a lobby: public (in the list, open to all) or private (in the list, you can only enter with its code)
  create: () => ({
    head: _t('Create a lobby'),
    rows: [
      { k: 'note', text: _t('You set up the match and start it whenever you want. The lobby stays open as long as someone is in it.') },
      { k: 'btn', key: 'pub', label: _t('Public lobby'), sub: _t('In the lobby list, open to everyone'), run: () => srvCreate(1), disabled: !netCan() },
      { k: 'btn', key: 'priv', label: _t('Private lobby'), sub: _t('In the lobby list, players need its code to join'), run: () => srvCreate(0), disabled: !netCan() },
    ],
  }),
  // the lobby: the class, the chat; permanent lobby, the vote at bottom left (srvVote); created lobby, the map, the settings, the invitation and the map inset
  srv: () => {
    const st = SRV.st, rows = [];
    if (st && st.ps) {
      const edit = srvChief() && st.ph === 'waiting';
      rows.push({ k: 'link', key: 'map', label: _t('Map'), page: 'srvmap', disabled: !edit }, { k: 'link', key: 'setup', label: _t('Match settings'), page: 'srvsetup' });
    }
    rows.push({ k: 'link', key: 'class', label: _t('Edit class'), open: () => uiGo('classes') });
    if (st && st.ps) rows.push({ k: 'link', key: 'invite', label: _t('Invite friends'), page: 'invite' });
    rows.push({ k: 'link', key: 'chat', label: _t('Chat'), value: CHAT.unread ? String(CHAT.unread) : '', page: 'chat' });
    const MD = MODES[st ? st.o : 'tdm'], rules = st ? st.cfg.limit + ' ' + MD.unit + ' · ' + st.cfg.time + ' min' : '';
    const sub = !st ? '' : st.ps ? [MD.name, st.cfg.pub ? _t('Public') : _t('Private')].join(' · ') : [_t('Public lobby {0}', st.k), rules].join(' · ');
    return { title: srvTitle(), sub, rows, stage: srvStage, preview: st && st.ps ? mapPreview(mapById(st.m), srvMatchCfg()) : '' };
  },
  srvmap: () => ({ head: _t('Map'), grid: true, rows: mapCards(SRV.st ? SRV.st.m : '', srvChief() && SRV.st.ph === 'waiting' ? (id) => { lmPop(LM.scr.multi); srvSetupSet('map', id); } : null) }),
  srvsetup: () => ({ head: _t('Match settings'), rows: SRV.st ? matchRows(srvMatchCfg()) : [] }),
  // a player: switch team (yourself, or the leader for another), mute their messages (on your side), kick them (the leader, in two steps)
  srvp: (id) => {
    const st = SRV.st, p = st && st.j.find((x) => x.id === id), rows = []; if (!p) return { head: '', rows };
    const other = id !== st.me, chief = srvChief(), lobby = st.ph === 'waiting';
    if (st.ps && st.o !== 'ffa' && lobby && (!other || chief)) rows.push({ k: 'btn', key: 'swap', label: _t('Switch team'), sub: _t('Move this player to the other team'), run: () => { srvSend(other ? { t: 'teamSwitch', id } : { t: 'teamSwitch' }); sfxUi('click'); lmPop(LM.scr.multi); } });
    if (other) {
      const muted = NET.muted.has(id);
      rows.push({ k: 'btn', key: 'mute', label: muted ? _t('Unmute') : _t('Mute'), sub: muted ? _t('Show this player\u0027s messages again') : _t('Stop seeing this player\u0027s messages'), run: () => { if (muted) NET.muted.delete(id); else NET.muted.add(id); sfxUi('click'); chatRender(); netRender(); } });
      if (st.ps && chief && lobby) {
        const ask = SRV.kickAsk === id;
        rows.push({ k: 'btn', key: 'kick', danger: true, label: ask ? _t('Confirm removal') : _t('Remove'), sub: _t('Remove this player from the room (they cannot come back)'), run: () => {
          if (SRV.kickAsk === id) { SRV.kickAsk = ''; srvSend({ t: 'kickPlayer', id }); lmPop(LM.scr.multi); } else { SRV.kickAsk = id; setTimeout(() => { if (SRV.kickAsk === id) { SRV.kickAsk = ''; netRender(); } }, 4000); }
          sfxUi('click'); netRender();
        } });
      }
    }
    return { head: p.n, rows };
  },
};
function srvInit() {
  Object.assign(NET_PAGES, SRV_PAGES);
  setInterval(srvTick, 1000);
  document.addEventListener('visibilitychange', () => { if (SRV.on) srvSend({ t: 'h', h: srvHostScore(), inGame: NET.on && NET.srv ? 1 : 0 }); });
  addEventListener('pagehide', () => { if (SRV.ws) { try { SRV.ws.close(1000); } catch (e) { /* already closed */ } } });
}
