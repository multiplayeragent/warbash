/* ==========================================================================
   ONLINE MULTIPLAYER
   Lobbies on the game server (transport: src/09d-netrelay.js). The host creates a lobby
   identified by a short code and shares the link; the others connect to it.
   The host is the center of the lobby: it keeps the list of players and their
   teams, launches the match, relays each one's state to all the others and
   simulates the bots that fill out the teams.
   Launch: everyone loads the map (loading screen; the lobby loads nothing) and
   reports their progress to the host; the match only starts, for everyone at the same time, when everyone has
   finished, or after NET_LOAD_WAIT seconds (a straggler then joins the match as soon as they finish).
   Each participant (player or bot) publishes about 15 times per second a
   state: position, gaze, weapon, stance, health, counters, and their numbered recent
   events (hits addressed to someone, kills, grenades,
   streaks). "The shooter decides" model: the one who fires computes their hits
   and addresses them to the victim, who applies the damage and announces their death.
   ========================================================================== */
const NET_PROTO = 11, NET_PUB_NEXT = 20, NET_SILENT_SRV = 150000, NET_LOAD_WAIT = 45, NET_MAX = 8, NET_TEAM = 6, NET_PREFIX = 'wbh-', NET_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const NET_WSPECIAL = { nade: _t('Grenade'), tknife: _t('Throwing knife'), air: _t('Airstrike'), knife: _t('Knife'), heli: _t('Helicopter'), drone: _t('Kamikaze drone'), mecha: _t('Mecha'), fall: _t('Fall'), zone: _t('Desert') }; // fall: fall into the void (voidDeath); zone: stayed outside the round zone (zoneDeath, 02-relief.js)
const NET = {
  role: 'off', peer: null, hostConn: null, me: '', code: '', joined: false, t0: 0, hostSeen: 0, hbT: 0, lastSend: 0,
  relay: null, relayConn: null, relayTimer: 0, tx: { p2p: 'off', relay: 'off' }, // connection paths: peer-to-peer and relay (wait, idle, ok, fail, off)
  players: new Map(), phase: 'lobby', cfg: { bots: 1, diff: 2, limit: 30, time: 10, map: 'chergui', mode: 'tdm' },
  on: false, team: 0, remotes: new Map(), seen: new Map(), seenT: new Map(), ak: new Map(), sent: [], held: [], hitQ: 0, rid: 0, lastPub: 0, shots: 0, nick: '', status: '',
  startT: 0, ldKey: '', ldT: 0, lobbyTimer: 0, // launch: start of the wait (host), last progress sent
  key: '', // this page's key, sent with the introduction (see netKey)
  muted: new Set(), // players muted by this player (their messages no longer show on their side), for the lobby's duration
  goneK: [0, 0], hostId: '', // kills by those who left the match, per team; lobby host player (another one: the match was taken over)
  banned: new Set(), kickAsk: '', // host: keys of kicked players (refused if they come back), kick awaiting confirmation
};

/* ---------- Connection diagnostics ----------
   Each step (matchmaking server, network path search, connection) is logged with its
   time. When a connection fails, the game shows the probable cause and a report to copy (without IP address). */
const NETD = { log: [], cand: {}, err: '', sig: '', t0: 0, role: '', code: '', rel: '', relCode: 0 };
function netdReset(role, code) { Object.assign(NETD, { log: [], cand: {}, err: '', sig: '', t0: performance.now(), role, code, rel: netrUrl() ? 'idle' : 'off', relCode: 0 }); netdShow(false); }
function netdLog(s) {
  NETD.log.push(((performance.now() - NETD.t0) / 1000).toFixed(1).padStart(5) + ' s  ' + s);
  if (NETD.log.length > 80) NETD.log.shift();
  console.info('[net] ' + s);
}
/* Tracks a PeerJS connection's path search: types of paths found (direct, via STUN, via relay) */
function netdWatch(c, who) {
  const pc = c && c.peerConnection;
  if (!pc || pc.netdSeen) return;
  pc.netdSeen = true;
  pc.addEventListener('icecandidate', (e) => {
    const cd = e.candidate; if (!cd || !cd.candidate) return;
    const m = / typ (\w+)/.exec(cd.candidate);
    const k = (cd.type || (m && m[1]) || '?') + (/\.local /.test(cd.candidate) ? ' mDNS' : '') + '/' + String(cd.protocol || (/ (udp|tcp) /i.exec(cd.candidate) || [])[1] || '?').toLowerCase();
    NETD.cand[k] = (NETD.cand[k] || 0) + 1;
  });
  pc.addEventListener('icecandidateerror', (e) => netdLog(who + ': server ' + (e.url || '?') + ' unreachable (code ' + e.errorCode + ')'));
  pc.addEventListener('icegatheringstatechange', () => netdLog(who + ': searching for paths ' + pc.iceGatheringState));
  pc.addEventListener('iceconnectionstatechange', () => netdLog(who + ': path ' + pc.iceConnectionState));
}
/* Path finally chosen by an established connection */
async function netdPath(c, who) {
  const pc = c && c.peerConnection;
  if (!pc || !pc.getStats) return;
  try {
    const st = await pc.getStats(); let pair = null;
    st.forEach((x) => { if (x.type === 'transport' && x.selectedCandidatePairId) pair = st.get(x.selectedCandidatePairId) || pair; });
    const a = pair && st.get(pair.localCandidateId), b = pair && st.get(pair.remoteCandidateId);
    netdLog(who + ': selected path ' + (a ? a.candidateType + '/' + a.protocol : '?') + ' to ' + (b ? b.candidateType : '?'));
  } catch (e) { /* stats unavailable */ }
}
function netdCount(re) { let n = 0; for (const k in NETD.cand) if (re.test(k)) n += NETD.cand[k]; return n; }
/* Probable cause of the failure, in plain language */
function netdVerdict() {
  if (NET.joined && NET.role === 'client') return _t('Connected to the lobby. No connection problem.');
  if (netViaServer()) { // everything goes through the game server: neither peer-to-peer nor matchmaking server
    if (NET.role === 'host' && NET.joined) return _tn(NET.players.size, 'Lobby open on the game server: {0} player.', 'Lobby open on the game server: {0} players.');
    if (NETD.relCode === 4004) return _t('Lobby not found. Check the code, or the host closed the lobby.');
    if (NETD.relCode === 4002) return _t('This lobby is full.');
    if (NETD.relCode === 4029 || NETD.relCode === 4013) return _t('The game server is busy. Try again in a moment.');
    if (NETD.rel === 'fail') return _t('The game server cannot be reached from this device. Connection lost, very restrictive network, or server under maintenance. Try again in a moment.');
    return _t('Connecting to the game server.');
  }
  return _t('Online play is not available on this page.');
}
function netdReport() {
  return ['Connection report, War Bash (protocol ' + NET_PROTO + ')', 'Role: ' + (NETD.role || '-') + ', lobby ' + (NETD.code || '-') + ', page ' + location.host, 'Browser: ' + navigator.userAgent,
    'Game server: ' + (NETD.rel === 'off' ? 'not configured' : NETD.rel), 'Diagnostic: ' + netdVerdict(), '', ...NETD.log].join('\n');
}
function netdShow(on) {
  const box = $('netDiag'); if (!box) return;
  box.classList.toggle('hidden', !on);
  if (on) { $('netDiagWhy').textContent = netdVerdict(); $('netDiagCopy').textContent = _t('Copy the connection report'); }
}
function netdCopy() {
  const txt = netdReport(), btn = $('netDiagCopy');
  const fallback = () => {
    const ta = document.createElement('textarea'); ta.value = txt; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) { /* copy refused */ }
    ta.remove(); btn.textContent = ok ? _t('Report copied') : _t('Copy failed');
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => { btn.textContent = _t('Report copied'); }, fallback); else fallback();
}
/* Connection failure: back to the menu with the explanation and the report */
function netFail(msg) { netdLog('failure: ' + msg); netReset(msg); netdShow(true); }

function netLib() { return false; } // no more direct connection between players: everything goes through the game server
function netCan() { return netLib() || !!netrUrl(); } // at least one connection path: peer-to-peer (PeerJS) or relay
function netPeerOpts() { return Object.assign({ debug: 0 }, window.NET_PEER_OPTS || {}); }
/* Nickname received or displayed: control characters and angle brackets removed, 16 characters; a name refused by the filter (api/_lib/textFilter.js) becomes "Soldier" */
function netClean(n) { const s = String(n == null ? '' : n).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 16); return s && !filterName(s) ? s : _t('Soldier'); }
function netNewCode() { const a = new Uint32Array(5); crypto.getRandomValues(a); let s = ''; for (const v of a) s += NET_ABC[v % NET_ABC.length]; return NET_ABC[a[0] % 24] + s.slice(1); } // private lobby: a letter first (its room, netrRoom)
function netLink() { return location.origin + location.pathname + '?lobby=' + netCodeNow(); }
/* Code of the lobby we're in: that of a lobby created on the server (src/09cb-servers.js), otherwise the host's lobby */
function netCodeNow() { return SRV.on && SRV.st && SRV.st.ps ? SRV.st.i : NET.code; }
/* Code typed or received (invitation): first a game server lobby; if it isn't there, a host's lobby (srvLost) */
function netJoinCode(raw) {
  const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  netJoinLobby(raw); // (the original server's permanent lobbies no longer exist)
}
/* This page's key, attached to the introduction ("hi"): the host recognizes the same player arriving by a second path
   (relay after a direct connection dropped before its reply, new attempt after a cut) and replaces their
   old connection instead of showing them twice. It lives as long as the page. */
function netKey() { if (!NET.key) NET.key = netNewCode() + netNewCode(); return NET.key; }
function netStatus(t) { NET.status = t; const el = $('netStatus'); if (el) el.textContent = t; }
/* Introduction to the host ("hi"); mig: again, to the host taking over the match in progress (we're already in it, with our team); tm: the team
   (chosen in a created lobby, or that of the match in progress) */
function netHi(mig) {
  const live = mig && NET.on, tm = live ? PL.ent.team : NET.srv && srvTeam() >= 0 ? srvTeam() : undefined;
  NET.lvSent = playerLevel();
  return { t: 'hi', n: NET.nick, lv: NET.lvSent, v: NET_PROTO, k: netKey(), tm, mig: live ? 1 : undefined };
}
/* My level changed (end of match, account): the guest announces it to the host, the host updates their own row; without this, the lobby kept the
   level from arrival from one match to the next. Game server lobbies follow via srvLevel. */
function netLevelSync() {
  const lv = playerLevel();
  if (NET.role === 'client' && NET.hostConn && NET.hostConn.open && NET.lvSent !== lv) { NET.lvSent = lv; netSend({ t: 'lv', lv }); }
  else if (NET.role === 'host') { const me = NET.players.get(NET.me); if (me && me.lv !== lv) { me.lv = lv; netLobbyChanged(); } }
  srvLevel();
}
function netNick() {
  const el = $('netName');
  let n = ACCT.user ? ACCT.user.displayName : ((el && el.value) || '').trim(); // logged in: the account's display name
  n = n ? netClean(n) : _t('Soldier') + '-' + (100 + Math.floor(Math.random() * 900));
  NET.nick = n; if (el) el.value = n;
  try { localStorage.setItem('cod_nick', n); } catch (e) { /* storage unavailable */ }
  return n;
}
function netTeamCounts() { const c = [0, 0]; for (const p of NET.players.values()) c[p.t]++; return c; }

/* ---------- Sending ---------- */
function netSend(m) { const c = NET.hostConn; if (c && c.open) { try { c.send(m); NET.lastSend = performance.now(); } catch (e) { /* channel closing */ } } }
function netSendTo(pl, m) { if (pl.conn && pl.conn.open) { try { pl.conn.send(m); } catch (e) { /* channel closing */ } } }
function netBroadcast(m, onlyInGame, except) {
  let viaRelay = null;
  for (const pl of NET.players.values()) {
    if (pl.id === except || (onlyInGame && !pl.ig)) continue;
    if (pl.conn && pl.conn.relay && NET.relay) (viaRelay || (viaRelay = [])).push(pl.id); // a single send for all the relay's guests
    else netSendTo(pl, m);
  }
  if (viaRelay) NET.relay.sendMany(viaRelay, m);
  NET.lastSend = performance.now();
}

/* ---------- Creation, connection, closing ---------- */
/* Lobby creation. o.pub: public lobby (listed by the game server); o.quick: "Play now" (public, with
   bots, launched as soon as it's open: other players join it mid-match); o.srv: the match of a permanent public
   lobby (src/09cb-servers.js), with the code and settings (o.cfg) given by the server */
function netHost(o) {
  if (NET.role !== 'off' || !netCan() || !acctGate()) return;
  o = o || {}; NET.hostOpts = o; NET.quick = !!o.quick;
  netNick();
  const code = o.code || netNewCode(), direct = netLib() && !netRelayOnly();
  Object.assign(NET, { role: 'host', peer: null, relay: null, relayConn: null, code, me: '', phase: 'lobby', joined: false, t0: performance.now(), tx: { p2p: direct ? 'wait' : 'off', relay: netrUrl() ? 'wait' : 'off' } });
  NET.players.clear();
  NET.cfg = netCfg(o.cfg || { bots: o.quick ? 1 : NET.cfg.bots, diff: Settings.difficulty, map: Settings.map, mode: Settings.mode, limit: Settings[(MODES[Settings.mode] || MODES.tdm).key], time: Settings.minutes, pub: o.pub && netViaServer() ? 1 : 0 });
  NET.pane = 'setup'; NET.srv = !!o.srv;
  netdReset('host', code); netdLog('lobby ' + code + ': opening');
  netStatus(_t('Creating the lobby...'));
  if (direct) netHostP2p(code);
  if (netrUrl()) netHostRelay(code);
  netRender();
}
/* The lobby exists as soon as a path opens: PeerJS matchmaking server, or fallback relay */
function netHostUp(id) {
  if (NET.joined) return;
  NET.me = id; NET.joined = true;
  NET.players.set(id, { id, n: NET.nick, lv: playerLevel(), t: NET.srv ? Math.max(0, srvTeam()) : 0, conn: null, ig: false, seen: performance.now(), ld: 0 });
  if (NET.srv) srvRoomUp(); // a public lobby's match: the server announces it to the others, it launches when they're there (srvHostTick)
  else netStatus(_t('Lobby open: send the link to your friends, then start the match.'));
  netLobbyChanged();
  const lobby = $('netLobby'); if (lobby) lobby.scrollIntoView({ block: 'nearest' });
  if (NET.quick) { NET.quick = false; setTimeout(() => netLaunch(), 300); } // "Play now": we play right away, with bots
}
/* Path 1, peer-to-peer: guests connect directly to the host's browser */
function netHostP2p(code) {
  const peer = new Peer(NET_PREFIX + code, netPeerOpts());
  NET.peer = peer;
  peer.on('open', (id) => {
    if (NET.peer !== peer) return;
    NET.tx.p2p = 'ok'; NETD.sig = 'ok'; netdLog('matchmaking server: connected');
    if (NET.joined) { netStatus(_t('Lobby open: send the link to your friends, then start the match.')); return; } // (re)connection to the server: the lobby is intact
    netHostUp(id);
  });
  peer.on('connection', (c) => netHostAccept(c));
  peer.on('disconnected', () => { if (NET.peer === peer && !peer.destroyed) netdLog('matchmaking server: connection lost, retrying'); if (NET.peer === peer && !peer.destroyed) setTimeout(() => { if (NET.peer === peer && !peer.destroyed && peer.disconnected) { try { peer.reconnect(); } catch (e) { /* new attempt on the next failure */ } } }, 2000); });
  peer.on('error', (err) => netPeerError(peer, err));
}
/* Path 2, relay: the lobby is also opened with the relay, for guests that peer-to-peer can't reach */
function netHostRelay(code, key) {
  NETD.rel = 'try'; netdLog('game server: opening lobby');
  const rh = new RelayHost(code, (c) => netHostAccept(c), (st, why) => {
    if (NET.relay !== rh) return;
    netdLog('game server: ' + st + (why ? ' (' + why + ')' : ''));
    NET.relayDown = st === 'down'; // (host's link to the server cut: netLinkBad)
    if (st === 'up') { NET.tx.relay = 'ok'; NETD.rel = 'ok'; netOldConnClose(); netMigDone(); if (NET.joined) netLobbyChanged(); else netHostUp(NET_PREFIX + code); } // (already in the lobby: match taken over, or return after a cut)
    else if (st === 'taken') { // code already taken: we draw another (a game server lobby's comes from the server); mid-match, another player took it over
      const o = NET.hostOpts, live = NET.on && !!o.srv;
      netReset(live ? _t('Connection lost. The match goes on with another player hosting.') : undefined);
      if (live) toMenu();
      else if (o.code && netrIsPub(o.code)) { netJoinLobby(o.code); NET.quickJoin = NET.role === 'client'; } // public match opened by someone else at the same moment: we join it
      else if (!o.srv) netHost(Object.assign({}, o, { code: undefined }));
    } else if (st === 'fail') netTxFail('relay', _t('The game server cannot be reached.'));
  }, key);
  NET.relay = rh; rh.start();
}
/* A connection path failed: we only give up when none is left */
function netTxFail(kind, msg) {
  if (NET.role === 'off' || NET.joined) return;
  NET.tx[kind] = 'fail';
  if (kind === 'relay') NETD.rel = 'fail';
  if (NET.role === 'host') { if (NET.tx.p2p !== 'wait' && NET.tx.relay !== 'wait') netFail(msg); return; }
  if (kind === 'p2p' && NET.tx.relay === 'idle') { netJoinRelay(NET.code); return; } // peer-to-peer failed: relay right away
  if (NET.tx[kind === 'p2p' ? 'relay' : 'p2p'] === 'wait') return;
  netFail(msg);
}
function netJoinLobby(raw) {
  const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  if (code.length !== 5) { netStatus(_t('A lobby code is 5 characters long.')); return; }
  if (NET.role !== 'off' || !netCan() || !acctGate(code)) return;
  netNick();
  const direct = netLib() && !netRelayOnly();
  Object.assign(NET, { role: 'client', peer: null, hostConn: null, relay: null, relayConn: null, code, me: '', phase: 'lobby', joined: false, t0: performance.now(), tx: { p2p: direct ? 'wait' : 'off', relay: netrUrl() ? 'idle' : 'off' } });
  NET.players.clear();
  netdReset('client', code); netdLog('looking for lobby ' + code);
  netStatus(_t('Connecting to lobby {0}...', code));
  if (direct) netJoinP2p(code);
  if (netrUrl()) NET.relayTimer = setTimeout(() => netJoinRelay(code), direct ? NETR.after : 0); // the relay is only used after a short delay: peer-to-peer remains the preferred path
  netRender();
}
/* Path 1, peer-to-peer */
function netJoinP2p(code) {
  const peer = new Peer(netPeerOpts());
  NET.peer = peer;
  peer.on('open', (id) => {
    if (NET.peer !== peer) return;
    NET.me = id; NETD.sig = 'ok'; netdLog('matchmaking server: connected');
    const c = peer.connect(NET_PREFIX + code, { reliable: true, serialization: 'json' });
    NET.hostConn = c; netdWatch(c, 'to the host'); netdLog('direct connection to the host in progress');
    c.on('open', () => { if (NET.hostConn === c) { NET.hostSeen = performance.now(); netdLog('channel opened with the host'); netdPath(c, 'to the host'); netSend(netHi(false)); } });
    c.on('data', (m) => { if (NET.hostConn === c) netClientMsg(m); });
    c.on('close', () => netHostLink(c, _t('The host closed the lobby or the connection was lost.')));
    c.on('error', () => netHostLink(c, _t('The connection to the host failed.')));
  });
  peer.on('error', (err) => netPeerError(peer, err));
}
/* Path 2, relay: the connection goes through the relay if peer-to-peer didn't succeed */
function netJoinRelay(code) {
  clearTimeout(NET.relayTimer);
  if (NET.role !== 'client' || NET.code !== code || NET.joined || NET.relayConn || (NET.hostConn && NET.hostConn.open)) return;
  NET.tx.relay = 'wait'; NETD.rel = 'try';
  netdLog('game server: connecting to lobby');
  netStatus(_t('Connecting to lobby {0}...', code));
  const id = 'g' + netrRandom(9), c = netrJoin(code, id);
  NET.relayConn = c;
  if (NET.srv) c.grace = NETR.srvGrace; // match of a server lobby: once the host is gone, another player takes it over (netTakeOver)
  c.on('hostdown', () => { if (NET.hostConn === c) netMigSoon(); }); // the host is gone: "Host migration" screen if they don't come back quickly
  c.on('rehost', () => { if (NET.hostConn === c && NET.role === 'client') { netMigDone(); netSend(netHi(true)); } }); // a host comes back (the same one, or another)
  c.on('open', () => {
    if (NET.relayConn !== c || NET.role !== 'client') return;
    if (NET.hostConn && NET.hostConn.open) { c.close(); return; } // the direct connection finally succeeded: we keep it
    netdLog('game server: lobby found'); NETQ.on = false;
    NET.tx.relay = 'ok'; NETD.rel = 'ok'; NET.tx.p2p = 'fail'; // the direct path is abandoned: if the relay drops before entering the lobby, we fail right away
    const peer = NET.peer;
    NET.peer = null; NET.hostConn = c; NET.me = id; NET.hostSeen = performance.now();
    if (peer) { try { peer.destroy(); } catch (e) { /* already destroyed */ } }
    netSend(netHi(false));
  });
  c.on('data', (m) => { if (NET.hostConn === c) netClientMsg(m); });
  c.on('close', () => {
    if (NET.relayConn !== c) return;
    NET.relayConn = null; NETD.relCode = c.code;
    netdLog('game server: connection closed (code ' + c.code + ')');
    if (NET.hostConn !== c && !NET.joined && netQuickRefused(c.code)) return; // "Play now": room free or full
    const msg = c.code === 4004 ? _t('Lobby not found. Check the code, or the host closed the lobby.') : c.code === 4002 ? _t('This lobby is full.') : c.code === 4003 ? _t('The host removed you from the room.')
      : c.code === 4029 || c.code === 4013 ? _t('The game server is busy. Try again in a moment.') : _t('The game server cannot be reached.');
    if (NET.hostConn === c) { if (!netResumeStart(c)) netHostLink(c, _t('The host closed the lobby or the connection was lost.')); }
    else netTxFail('relay', msg);
  });
}
/* ---------- Resuming after a cut, mid-match ----------
   A guest cut off from the game server during a match (stalled network, phone in power saving, connection closed by the server)
   used to leave the match: back to the menu, then re-entry under a different identifier, kills, deaths and score reset to zero. They now
   reconnect to the same lobby with the same identifier and the same key (the server only returns it to that key), under the
   "Reconnecting" screen that freezes their match (playHold: no firing or hit that wouldn't count); the host keeps their soldier and counters during
   this time (netHostAway), their event numbers continue (the others' NET.seen stays correct). After NET_RESUME, they leave as before. */
const NET_RESUME = 20000, NET_RESUME_WAIT = [300, 1000, 2000, 3000];
function netResumeStart(c) {
  const refusal = [4001, 4002, 4003, 4004, 4005, 4010, 4011]; // lobby refused, full, kicked, not found (host gone for good), version, connection replaced
  if (NET.leaving || NET.role !== 'client' || !NET.joined || !NET.on || !c.relay || MATCH.outro || refusal.includes(c.code) || !['playing', 'paused', 'killcam'].includes(MATCH.state)) return false;
  NET.hostConn = null;
  if (!NET.resume) { NET.resume = { t0: performance.now(), n: 0, timer: 0 }; netdLog('connection lost during match (code ' + c.code + '): reconnecting'); }
  netMigShow(_t('Connection lost. Getting you back into the match...'), _t('Reconnecting'));
  netResumeNext();
  return true;
}
function netResumeNext() {
  const R = NET.resume; if (!R) return;
  clearTimeout(R.timer);
  if (performance.now() - R.t0 > NET_RESUME) { netResumeEnd(); netLost(_t('The connection to the game server was lost.')); return; }
  R.timer = setTimeout(netResumeTry, NET_RESUME_WAIT[Math.min(R.n++, NET_RESUME_WAIT.length - 1)]);
}
function netResumeEnd(soft) { const R = NET.resume; if (R) clearTimeout(R.timer); NET.resume = null; netMigDone(!soft); } // soft: the screen withdraws gently (successful return)
/* Shaky link: guest without news from the host for 1.2 s (the host publishes 15 times per second) or resuming, host cut off from the server.
   A hit is sent anyway (it may arrive late), but without cross or predicted death on the shooter's side: they announced a
   kill that never came (many hits without a kill on a phone in power saving, owner feedback). */
function netLinkBad() {
  if (!MATCH.online) return false;
  if (NET.role === 'client') return !!NET.resume || !NET.hostConn || performance.now() - NET.hostSeen > 1200;
  return NET.role === 'host' && !!NET.relayDown;
}
function netResumeTry() {
  const R = NET.resume; if (!R || NET.role !== 'client' || NET.relayConn) return;
  const c = netrJoin(NET.code, NET.me); NET.relayConn = c;
  if (NET.srv) c.grace = NETR.srvGrace;
  c.on('hostdown', () => { if (NET.hostConn === c) netMigSoon(); });
  c.on('rehost', () => { if (NET.hostConn === c && NET.role === 'client') { netMigDone(); netSend(netHi(true)); } });
  c.on('open', () => {
    if (NET.relayConn !== c || NET.resume !== R || NET.role !== 'client') return;
    netResumeEnd(true);
    NET.hostConn = c; NET.hostSeen = performance.now();
    netSend(netHi(true)); // (mig: already in the match, with their team; the host attaches this connection in our place)
    netdLog('reconnected to the match after ' + Math.round((performance.now() - R.t0) / 100) / 10 + ' s');
  });
  c.on('data', (m) => { if (NET.hostConn === c) netClientMsg(m); });
  c.on('close', () => {
    if (NET.relayConn !== c) return;
    NET.relayConn = null;
    if (NET.hostConn === c) { if (!netResumeStart(c)) netHostLink(c, _t('The host closed the lobby or the connection was lost.')); return; }
    if (NET.resume !== R) return;
    if ([4002, 4003, 4004, 4005].includes(c.code)) { netResumeEnd(); netLost(c.code === 4003 ? _t('The host removed you from the room.') : _t('The connection to the game server was lost.')); return; }
    netResumeNext();
  });
}
/* End of a connection to the host: loss mid-lobby, or failure of this path before entering it */
function netHostLink(c, msg) {
  if (NET.hostConn !== c) return;
  if (NET.joined) { netLost(msg); return; }
  NET.hostConn = null;
  netTxFail(c.relay ? 'relay' : 'p2p', c.relay && c.code === 4004 ? _t('Lobby not found. Check the code, or the host closed the lobby.') : msg);
}
function netPeerError(peer, err) {
  if (NET.peer !== peer) return;
  const t = err && err.type;
  NETD.err = t || ''; netdLog('matchmaking server error: ' + (t || 'unknown') + (err && err.message ? ' (' + String(err.message).slice(0, 80) + ')' : ''));
  if (t === 'unavailable-id' && NET.role === 'host' && !NET.joined) { const o = NET.hostOpts; netReset(); netHost(o); return; } // code already taken: we draw another
  if (t === 'peer-unavailable') { netTxFail('p2p', _t('Lobby not found. Check the code, or the host closed the lobby.')); return; }
  if (t === 'browser-incompatible') { netTxFail('p2p', _t('This browser does not support online play.')); return; }
  if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed' || t === 'disconnected') {
    // once the lobby is established, direct connections survive the loss of the matchmaking server
    if (!NET.joined) { if (NETD.sig !== 'ok') NETD.sig = 'fail'; netTxFail('p2p', _t('Signaling server unreachable. Try again in a moment.')); }
    return;
  }
  if (!NET.joined) netTxFail('p2p', _t('Connection failed ({0}).', t || _t('unknown error')));
}
/* Closes everything related to the lobby; msg: status text to display afterward. In a public lobby (SRV.on), only the match's
   lobby closes: the chat and the public lobby's muted players remain */
function netReset(msg) {
  if (NET.on) netLeaveMatch(true);
  if (NET.srv && NET.role === 'host' && SRV.hostCode && SRV.hostCode === NET.code) srvRoomFailed(); // the match I'm hosting closes before its end
  const peer = NET.peer, relay = NET.relay, rc = NET.relayConn;
  clearTimeout(NET.relayTimer); clearTimeout(NET.lobbyTimer); clearTimeout(NET.autoT); netOldConnClose(); netResumeEnd(); netMigDone(true);
  Object.assign(NET, { role: 'off', peer: null, hostConn: null, relay: null, relayConn: null, relayTimer: 0, tx: { p2p: 'off', relay: 'off' }, me: '', code: '', joined: false, phase: 'lobby', ldKey: '', lobbyTimer: 0, quick: false, quickJoin: false, kickAsk: '', srv: false, hostId: '' });
  NET.players.clear(); NET.banned.clear();
  if (!SRV.on) { NET.muted.clear(); chatClear(); $('netLeave').classList.add('hidden'); } // (lobby closed by the host during the question)
  if (peer) { try { peer.destroy(); } catch (e) { /* already destroyed */ } }
  if (relay) relay.close();
  if (rc) rc.close();
  netRender();
  netStatus(msg || netHello());
}
function netQuit() { if (SRV.on) srvLeave(_t('You left the lobby.')); else netReset(_t('You left the lobby.')); }
/* Back, in a lobby (uiBack): "Leave the lobby?" in the middle of the screen (#netLeave); stay (in yellow, where focus lands: a
   reflex press doesn't make you leave) or leave; Escape, B or a click on the background make you stay. A host who leaves closes the lobby for everyone. */
function netLeaveAsk() {
  $('nlMsg').textContent = srvChief() ? _t('You are the lobby leader. Another player will take your place.') : SRV.on && SRV.st && SRV.st.ps ? _t('You can come back with the code {0}.', SRV.st.i) : SRV.on ? _t('You can come back to this lobby from the public lobby list.') : NET.role === 'host' ? _t('You are the host. The lobby will close for every player.') : _t('You can come back with the code {0}.', NET.code);
  const el = $('netLeave'); el._from = document.activeElement; el.classList.remove('hidden'); sfxUi('click');
  if (lmWantFocus()) $('nlStay').focus({ preventScroll: true });
}
function netLeaveClose(quit) {
  const el = $('netLeave'); if (el.classList.contains('hidden')) return;
  el.classList.add('hidden');
  if (quit) { netQuit(); if (UI.lobbyBack && UI.screen === 'multi') { UI.lobbyBack = false; const prev = UI.stack.pop(); if (prev) uiGo(prev, false); } return; } // lobby opened from Play or the menu: we go back to it
  sfxUi('back'); const f = el._from; el._from = null; if (f && f.isConnected && f.focus && lmWantFocus()) f.focus({ preventScroll: true });
}
/* Loss of the host on the client side: back to the menu if a match was in progress */
function netLost(msg) {
  if (NET.role !== 'client') return;
  const wasPlaying = NET.on, launching = !!(UI.flow && UI.flow.online);
  netReset(msg);
  if (wasPlaying && MATCH.state !== 'menu' && !(SRV.on && MATCH.outro)) toMenu(); // public lobby: a match that ends runs to completion (announcement, final killcam, results)
  else if (launching) uiOpen('multi', ['main']); // loading or class selection in progress
  netStatus(msg);
}

/* ---------- Public lobbies and "Play now" (game server) ----------
   A public lobby's host announces it to the server (RelayHost.pub): their display name, the map, the mode, the number of
   players and the phase. The list comes from GET /salons, re-read every 5 s while the Multiplayer screen is open; it
   also gives the number of players connected to the server. A private lobby never appears there. */
const NETP = { list: [], playerCount: -1, at: 0, busy: false, err: false };
/* Welcome text of the Multiplayer screen, outside a lobby */
function netHello() { return SRV.list ? _t('Join a public match, or create a private lobby for your friends.') : netViaServer() ? _t('Play right away, join a public match, or create a lobby for your friends.') : _t('Create a lobby and send the link to your friends, or enter a lobby code.'); }
function netPubUrl() { return ''; } // no list of public matches: "Play now" tries them one by one (netQuick)
function netPubSync() {
  if (NET.role !== 'host' || !NET.relay) return;
  NET.relay.pub(NET.cfg.pub ? { n: NET.nick, m: NET.cfg.map, o: NET.cfg.mode, j: NET.players.size, x: NET_MAX, p: NET.phase, v: NET_PROTO } : null);
}
async function netPubFetch() {
  const u = netPubUrl(); if (!u) return [];
  try {
    const r = await fetch(u, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    NETP.list = (Array.isArray(d.salons) ? d.salons : []).filter((s) => s && s.v === NET_PROTO && /^[A-Z0-9]{5}$/.test(s.c) && MAPS.some((m) => m.id === s.m && m.ok) && MODES[s.o]);
    const hello = netHello(); srvRead(d); // permanent public lobbies and created lobbies (SRV.list null: older game server, without them)
    if (NET.status === hello) netStatus(netHello()); // the welcome prompt follows (it doesn't show up as a message)
    NETP.playerCount = Math.max(0, d.playerCount | 0); NETP.err = false;
  } catch (e) { NETP.err = true; }
  NETP.at = Date.now(); netPubRender();
  return NETP.list;
}
function netPubRender() { const L = LM.scr.multi; if (L && !netInLobby() && UI.screen === 'multi') lmRender(L); } // the list is the stage of the Multiplayer menu's home (NET_PAGES)
/* List re-read every 5 s, only with the Multiplayer screen open, outside a lobby and with the page visible */
function netPubTick() {
  if (NETP.busy || !netPubUrl() || UI.screen !== 'multi' || netInLobby() || document.hidden || Date.now() - NETP.at < 5000) return;
  NETP.busy = true; netPubFetch().finally(() => { NETP.busy = false; });
}
/* "Play now": the public matches (2BASH to 9BASH, src/09d-netrelay.js) one by one. We enter the first that has a host and
   room; a free room, we open the public match there ourselves (with bots, launched immediately, the next ones join it); a full one,
   we move on to the next. The server answers with a refusal (free room: 4004, full: 4002), handled by netQuickRefused. */
const NETQ = { list: [], i: 0, on: false };
function netQuick() {
  if (NET.role !== 'off' || !netCan() || !acctGate()) return;
  NETQ.list = netrPubCodes(); NETQ.i = 0; NETQ.on = true;
  netStatus(_t('Looking for a public match...'));
  netQuickTry();
}
function netQuickTry() {
  if (!NETQ.on) return;
  const code = NETQ.list[NETQ.i];
  if (!code) { NETQ.on = false; netStatus(_t('Every public match is full. Try again in a moment.')); return; }
  netJoinLobby(code); NET.quickJoin = NET.role === 'client';
}
function netQuickRefused(code) {
  if (!NETQ.on) return false;
  const pub = NETQ.list[NETQ.i];
  if (code === 4004) { NETQ.on = false; netReset(); netHost({ pub: 1, quick: 1, code: pub }); return true; }
  if (code === 4002 || code === 4003 || code === 4010) { netReset(); NETQ.i++; netQuickTry(); return true; }
  NETQ.on = false; return false;
}

/* ---------- Host side ---------- */
function netHostAccept(c) {
  const who = 'connection from ' + String(c.peer).slice(-4);
  netdLog(who + ': arrived' + (c.relay ? ' via the relay' : '')); netdWatch(c, who);
  c.on('open', () => { netdLog(who + ': channel open'); netdPath(c, who); });
  c.on('data', (m) => netHostMsg(c, m));
  c.on('close', () => netHostDrop(c.peer, c, !!c.bye)); // bye: left on their own, without waiting for their return
  c.on('error', () => netHostDrop(c.peer, c));
}
function netHostMsg(c, m) {
  if (NET.role !== 'host' || !m || typeof m !== 'object') return;
  const id = c.peer, now = performance.now();
  let pl = NET.players.get(id);
  // guest cut off mid-match who comes back (same identifier, which the server only returns to their key): their place, their soldier and their counters
  if (pl && pl.away && pl.conn !== c && m.t === 'hi') {
    Object.assign(pl, { conn: c, away: 0, seen: now, r: !!c.relay });
    netStatus(`${_t('{0} is back.', pl.n)}`); netLobbyChanged();
    return;
  }
  if (pl && pl.conn !== c) return;
  if (pl) pl.seen = now;
  if (m.t === 'hi') {
    if (pl) return;
    if (m.v !== NET_PROTO) { try { c.send({ t: 'deny', why: 'version' }); } catch (e) { /* ignored */ } setTimeout(() => c.close(), 800); return; }
    // same player already there via another connection (direct path dropped without the host seeing it, then relay): the
    // new one replaces the old one, which would otherwise stay displayed twice until it expires (30 s without news)
    const k = typeof m.k === 'string' ? m.k.slice(0, 32) : '';
    const prev = k ? [...NET.players.values()].find((p) => p.k === k && p.conn && p.conn !== c) : null;
    if (prev) netHostForget(prev);
    if (k && NET.banned.has(k)) { try { c.send({ t: 'deny', why: 'kick' }); } catch (e) { /* ignored */ } setTimeout(() => c.close(), 800); return; } // kicked by the host
    if (NET.players.size >= NET_MAX) { try { c.send({ t: 'deny', why: 'full' }); } catch (e) { /* ignored */ } setTimeout(() => c.close(), 800); return; }
    const cnt = netTeamCounts(), want = NET.srv && (m.tm === 0 || m.tm === 1) && (m.mig || (SRV.st && SRV.st.ps)) ? m.tm : -1; // the team chosen in a created lobby, or that of the resumed match
    pl = { id, k, n: netClean(m.n), lv: clamp(m.lv | 0, 0, 100), t: prev ? prev.t : want >= 0 ? want : cnt[1] < cnt[0] ? 1 : 0, conn: c, ig: !!m.mig && NET.on, seen: now, r: !!c.relay, ld: m.mig ? 100 : 0 }; // mig: already in the match I just took over
    NET.players.set(id, pl);
    netStatus(prev ? `${_t('{0} changed connection{1}.', pl.n, '')}` : `${_t('{0} joined the lobby.', pl.n)}`);
    netLobbyChanged();
    return;
  }
  if (!pl) return;
  // per-player rate: a modified client doesn't make the whole lobby rebroadcast hundreds of messages per second (the host
  // would exceed the relay's limit and be cut off); a published state goes out about 15 times per second, more on each hit
  const r = pl.rate || (pl.rate = { t: now, p: 0, o: 0 });
  if (now - r.t >= 1000) { r.t = now; r.p = 0; r.o = 0; }
  // (180 states: a guest catching up on a few seconds of stalled network at once doesn't lose its last states, those of recent hits)
  if (m.t === 'p' ? ++r.p > 180 : (m.t === 'nick' || m.t === 'team' || m.t === 'lv') && ++r.o > 3) return;
  switch (m.t) {
    case 'nick': pl.n = netClean(m.n); netLobbyChanged(); break;
    case 'lv': pl.lv = clamp(m.lv | 0, 0, 100); netLobbyChanged(); break; // level gained since arrival (netLevelSync)
    case 'chat': chatHostRelay(id, m.x); break;
    case 'team': if (!pl.ig) { pl.t = 1 - pl.t; netLobbyChanged(); } break;
    case 'join': // arrival mid-match (or during loading: we don't wait for them)
      if (NET.phase !== 'lobby' && !pl.ig) {
        pl.ig = true; pl.late = NET.phase === 'loading'; netLobbyChanged();
        netSendTo(pl, { t: 'start', cfg: NET.cfg, team: pl.t, tl: NET.phase === 'playing' ? MATCH.timeLeft : NET.cfg.time * 60 }); netRebalanceBots();
      }
      break;
    case 'leave':
      if (pl.ig) { pl.ig = false; netRemoveById(id); netBroadcast({ t: 'gone', id }, true, id); netLobbyChanged(); netRebalanceBots(); netCheckGo(); }
      break;
    case 'ld': // map loading progress (0 to 100)
      pl.ld = m.m === NET.cfg.map ? clamp(m.p | 0, 0, 100) : 0;
      netLobbySoon(); netCheckGo();
      break;
    case 'p':
      if (!pl.ig || !NET.on || !m.p || typeof m.p !== 'object') break;
      netApply(id, m.p);
      if (!(NET.relay && NET.relay.fanout)) netBroadcast({ t: 'ps', l: [[id, m.p]] }, true, id); // (the game server broadcasts it to the others itself)
      break;
  }
}
/* Player replaced by a new connection from the same player (see netKey): removed without a departure announcement; the
   closing of their old connection then finds no one to remove */
function netHostForget(pl) {
  NET.players.delete(pl.id);
  if (pl.ig) { netRemoveById(pl.id); netBroadcast({ t: 'gone', id: pl.id }); }
  try { pl.conn.close(); } catch (e) { /* already closed */ }
}
/* The host kicks a player from the lobby: warned, disconnected, and refused if they come back with the same page (their key, see netKey) */
function netKick(id) {
  const pl = NET.players.get(id); NET.kickAsk = '';
  if (NET.role !== 'host' || !pl || id === NET.me) return;
  if (pl.k) NET.banned.add(pl.k);
  const c = pl.conn; // (absent, cut off mid-match: no connection)
  netSendTo(pl, { t: 'deny', why: 'kick' });
  if ((!c || c.relay) && NET.relay) setTimeout(() => NET.relay && NET.relay.ban(id), 300); // the game server then refuses their address in this lobby
  if (c) setTimeout(() => { try { c.close(); } catch (e) { /* already closed */ } }, 400);
  netHostDrop(id, c, true);
  netStatus(_t('{0} was removed from the room.', pl.n));
}
/* Guest gone. hard: for good (kicked, silent for 30 s, absent for NET_AWAY); otherwise, a connection through the game server closed
   mid-match leaves them absent for NET_AWAY (netResume): their place, soldier and counters remain, the others hide them in the meantime */
const NET_AWAY = 25000;
function netHostDrop(id, c, hard) {
  const pl = NET.players.get(id);
  if (NET.role !== 'host' || !pl || (c && pl.conn !== c)) return;
  if (!hard && c && c.relay && pl.ig && NET.on && !MATCH.outro) {
    pl.conn = null; pl.away = performance.now();
    netRemoteAway(id); netBroadcast({ t: 'away', id });
    netStatus(`${_t('{0} lost connection.', pl.n)}`); netLobbyChanged();
    return;
  }
  NET.players.delete(id);
  netRemoveById(id);
  netBroadcast({ t: 'gone', id });
  netStatus(`${_t('{0} left the lobby.', pl.n)}`);
  netLobbyChanged();
  netRebalanceBots();
  netCheckGo();
}
function netLobbyMsg() {
  const players = [...NET.players.values()].map((p) => ({ id: p.id, n: p.n, lv: p.lv | 0, t: p.t, h: p.id === NET.me ? 1 : 0, ig: p.ig ? 1 : 0, r: p.r ? 1 : 0, ld: p.ld | 0, la: p.late ? 1 : 0 }));
  return { t: 'lobby', code: NET.code, phase: NET.phase, cfg: NET.cfg, players };
}
function netLobbyChanged() {
  clearTimeout(NET.lobbyTimer); NET.lobbyTimer = 0;
  if (NET.role === 'host') { netBroadcast(netLobbyMsg()); netPubSync(); if (NET.srv) srvHostTick(); }
  netRender();
}
/* Loading progress updates arrive often: a single send of the lobby state every 0.4 s at most */
function netLobbySoon() { if (!NET.lobbyTimer) NET.lobbyTimer = setTimeout(netLobbyChanged, 400); }
/* Launch: everyone loads the map, the match starts when everyone has finished (netCheckGo) */
function netLaunch() {
  if (NET.role !== 'host' || !NET.joined || NET.phase !== 'lobby') return;
  NET.phase = 'loading'; NET.startT = performance.now();
  for (const pl of NET.players.values()) { pl.ig = true; pl.late = false; }
  netLobbyChanged();
  const tl = NET.cfg.time * 60;
  for (const pl of NET.players.values()) netSendTo(pl, { t: 'start', cfg: NET.cfg, team: pl.t, tl });
  netStartOnline({ cfg: NET.cfg, team: NET.players.get(NET.me).t, tl });
  netCheckGo();
}
/* Host: start when all launched players have loaded the map, or after NET_LOAD_WAIT seconds. The switch to
   the "playing" phase is the start signal (lobby state, and every heartbeat for those who might have missed it). */
function netCheckGo() {
  if (NET.role !== 'host' || NET.phase !== 'loading') return;
  if (performance.now() - NET.startT < NET_LOAD_WAIT * 1000) for (const pl of NET.players.values()) if (pl.ig && !pl.late && (pl.ld | 0) < 100) return;
  NET.phase = 'playing';
  netLobbyChanged();
}
function netGo() { return NET.role !== 'off' && NET.phase === 'playing'; }
/* Progress of my lobby map loading: sent to the host (every 0.6 s at most, except the end) */
function netLoadReport(force) {
  if (NET.role === 'off' || !NET.joined) return;
  const map = NET.cfg.map, p = MAPL.id !== map ? 0 : MAPL.state === 'ready' ? 100 : Math.min(99, Math.round(MAPL.p * 100));
  const key = map + ':' + p, now = performance.now();
  if (!force && (key === NET.ldKey || (p < 100 && now - NET.ldT < 600))) return;
  NET.ldKey = key; NET.ldT = now;
  if (NET.role === 'client') { netSend({ t: 'ld', m: map, p }); return; }
  const me = NET.players.get(NET.me);
  if (me && me.ld !== p) { me.ld = p; netLobbySoon(); }
  netCheckGo();
}
/* Loading screen: who is still loading */
function netWaitHtml() {
  const out = [];
  for (const p of NET.players.values()) if (p.ig && !p.late && (p.ld | 0) < 100) out.push(`<b>${esc(p.n)}</b> ${p.ld | 0}${PCT}`);
  if (!out.length) return '';
  const left = NET.role === 'host' ? Math.ceil(NET_LOAD_WAIT - (performance.now() - NET.startT) / 1000) : 0;
  return _t('Loading: {0}', out.join(', ')) + (left > 0 ? ` ${_t('(starting without them in {0} s)', left)}` : '');
}
/* My loading failed: I leave the match (the host, for their part, cancels it for everyone) */
function netLoadFailed() {
  if (NET.role === 'client') netSend({ t: 'leave' });
  else if (NET.role === 'host') { netMatchEnded(); netStatus(_t('Match canceled: the map could not be loaded.')); }
}
/* End of match decided by the host (limit reached, time elapsed, or the host leaves) */
function netMatchEnded() {
  if (NET.role !== 'host' || NET.phase === 'lobby') return;
  if (NET.srv) srvRoomEnded(); // public lobby: countdown to the next match
  NET.phase = 'lobby';
  netBroadcast({ t: 'end' });
  for (const pl of NET.players.values()) { pl.ig = false; pl.late = false; }
  netLobbyChanged();
  // public match: the next one starts by itself (otherwise the whole lobby would wait for the host, a random player)
  if (NET.cfg.pub) { clearTimeout(NET.autoT); NET.autoT = setTimeout(() => { if (NET.role === 'host' && NET.phase === 'lobby' && NET.cfg.pub) netLaunch(); }, NET_PUB_NEXT * 1000); }
}

/* ---------- Bots simulated by the host ---------- */
function netRebalanceBots() {
  if (NET.role !== 'host' || !NET.on) return;
  const hum = [0, 0];
  for (const pl of NET.players.values()) if (pl.ig) hum[pl.t]++;
  const ffa = NET.cfg.mode === 'ffa'; // free-for-all: a single group, filled up to NET_MAX players
  for (const t of ffa ? [-1] : [0, 1]) {
    const want = !NET.cfg.bots ? 0 : ffa ? Math.max(0, NET_MAX - hum[0] - hum[1]) : Math.max(0, NET_TEAM - hum[t]);
    const pool = entities.filter((e) => !e.isPlayer && !e.isRemote && (ffa || e.team === t));
    let active = pool.filter((b) => b.netBot);
    while (active.length > want) { const b = active.find((x) => !x.alive) || active[active.length - 1]; netBotOff(b); active = active.filter((x) => x !== b); }
    for (const b of pool) { if (active.length >= want) break; if (!b.netBot) { netBotOn(b); active.push(b); } }
  }
}
function netBotOn(b) {
  b.netBot = true; b.netId = NET.me + '~b' + b.id; b.netQ = { seq: 0, list: [] };
  b.kills = b.deaths = b.score = b.assists = b.streak = 0;
  spawnEntity(b);
}
function netBotOff(b) {
  NET.goneK[b.team] += b.kills | 0; // their kills stay in their team's score
  b.netBot = false; b.alive = false; b.respawnT = Infinity; b.target = null; b.model.rag = null; b.model.root.visible = false;
  netBroadcast({ t: 'gone', id: b.netId }, true);
}
/* ---------- Taking over a match whose host left (game server lobby, src/09cb-servers.js) ----------
   The server picks a player in the match (a computer preferably) and gives them a new host key for the same lobby. Their game
   goes from guest to host without leaving the match: it takes over the old host's bots (same identifiers, names, kills, deaths and
   score, in place if they're alive), removes the old host's soldier (their kills stay in their team's score, NET.goneK),
   opens the lobby as host; the guests, who were waiting (NETR.srvGrace), introduce themselves again with their team ("hi", mig) and the
   match continues: the time, the score, and in domination the points, which everyone used to receive from the old host. */
function netTakeOver(code, key) {
  const c = NET.relayConn || NET.hostConn, old = [...NET.players.values()].find((p) => p.h), oldId = (old && old.id) || NET.hostId;
  // my guest connection stays open until the lobby is mine (otherwise, as the only guest, it would empty out); its listeners no longer recognize it
  NET.relayConn = null; NET.hostConn = null; NET.oldConn = c; clearTimeout(NET.relayTimer);
  Object.assign(NET, { role: 'host', hostOpts: { srv: true, code }, tx: { p2p: 'off', relay: 'wait' }, phase: 'playing', hostId: NET.me });
  NET.players.clear();
  NET.players.set(NET.me, { id: NET.me, n: NET.nick, lv: playerLevel(), t: PL.ent.team, conn: null, ig: true, seen: performance.now(), ld: 100 });
  netAdoptBots();
  const oe = NET.remotes.get(oldId); if (oe) { netHeliDrop(oe); netRemoveById(oldId); }
  netdLog('match ' + code + ' : taken over as host');
  netMigShow(_t('You are becoming the match host.'));
  netHostRelay(code, key);
  hudMsg(_t('The host left. You are now hosting the match.'), 'xp', 3);
  // the guests introduce themselves again in the following seconds; those who don't come back are gone, and the bots fill in
  setTimeout(() => {
    if (NET.role !== 'host' || !NET.on) return;
    for (const [id, e] of [...NET.remotes]) if (!e.remoteBot && !NET.players.has(id)) { netRemoveById(id); netBroadcast({ t: 'gone', id }); }
    netRebalanceBots();
  }, 8000);
}
/* "Host migration" screen, like the old Call of Duty games (#hostMig in shell.html): the host of a server lobby's match has
   left, another player takes it over. Shown one second after the host is lost (a shorter cut goes unnoticed); the match is
   frozen while it's up (playHold: nobody moves or fires, the timer stops); the bar advances toward its end without reaching it,
   then fills when the host is in place (the same one back, or the new one) and the screen fades. */
const MIG = { on: false, t0: 0, timer: 0, tick: 0 };
function netMigSoon() {
  if (MIG.on || MIG.timer || !NET.on || !NET.srv || MATCH.outro) return;
  MIG.timer = setTimeout(() => {
    MIG.timer = 0;
    if (NET.on && NET.srv && !MATCH.outro && ['playing', 'paused', 'killcam'].includes(MATCH.state)) netMigShow(_t('Another player is taking over the match.'));
  }, 1000);
}
function netMigShow(sub, title) {
  $('hmSub').textContent = sub; $('hmTitle').textContent = title || _t('Host migration');
  if (MIG.on) return;
  MIG.on = true; MIG.t0 = performance.now();
  for (const k in KEYS) KEYS[k] = false; PL.held = false; PL.adsWant = false; // (a held key doesn't resume by itself)
  const el = $('hostMig'); el.classList.remove('hidden', 'out');
  clearInterval(MIG.tick); MIG.tick = setInterval(netMigBar, 100); netMigBar();
}
function netMigBar() { const t = (performance.now() - MIG.t0) / 1000; $('hmBar').style.transform = `scaleX(${(0.95 * (1 - Math.exp(-t / 3))).toFixed(3)})`; }
/* Host in place: the bar fills, the screen fades; now: right away (match left or finished) */
function netMigDone(now) {
  clearTimeout(MIG.timer); MIG.timer = 0;
  if (!MIG.on) return;
  MIG.on = false; clearInterval(MIG.tick);
  const el = $('hostMig');
  if (now) { el.classList.add('hidden'); return; }
  $('hmBar').style.transform = 'scaleX(1)';
  setTimeout(() => { if (!MIG.on) el.classList.add('out'); }, 350);
  setTimeout(() => { if (!MIG.on) { el.classList.add('hidden'); el.classList.remove('out'); } }, 650);
}
/* Guest connection of a match I took over: closed once the lobby is mine (or when leaving it) */
function netOldConnClose() { const c = NET.oldConn; NET.oldConn = null; if (c) { try { c.close(); } catch (e) { /* already closed */ } } }
/* The old host's bots (remote on my side) become mine: a bot from my reserve on the same team takes their identifier, name,
   counters and place; their event numbering continues (the others ignore an already seen number) */
function netAdoptBots() {
  const pool = entities.filter((e) => !e.isPlayer && !e.isRemote && !e.netBot), ffa = MATCH.mode === 'ffa';
  for (const r of [...NET.remotes.values()].filter((e) => e.remoteBot)) {
    const b = pool.find((x) => ffa || x.team === r.team), id = r.peer, seq = NET.seen.get(id) || 0, was = { alive: r.alive, pos: r.pos.clone(), yaw: r.yaw };
    netHeliDrop(r); netRemoveById(id, true);
    if (!b) continue; // no free bot left on this team: it leaves the match
    pool.splice(pool.indexOf(b), 1);
    netBotOn(b);
    Object.assign(b, { netId: id, name: r.name, kills: r.kills, deaths: r.deaths, score: r.score, assists: r.assists, netQ: { seq: seq + 50, list: [] } });
    if (was.alive) { b.pos.copy(was.pos); b.yaw = b.lookYaw = was.yaw; }
  }
}
/* Helicopter of a soldier leaving my match (the old host, or one of their taken-over bots): it crashes */
function netHeliDrop(e) { for (const h of KS.helis) if (h.owner === e && h.state !== 'crash') { h.state = 'crash'; h.burst = null; h.vy = 0; h.spin = 0; } }
function netDisableBots() { for (const e of entities) if (e.netBot) { e.netBot = false; e.alive = false; e.respawnT = Infinity; e.model.rag = null; e.model.root.visible = false; } }

/* ---------- Client side ---------- */
function netClientMsg(m) {
  if (NET.role !== 'client' || !m || typeof m !== 'object') return;
  NET.hostSeen = performance.now();
  switch (m.t) {
    case 'lobby': {
      if (!Array.isArray(m.players)) return;
      if (!NET.joined) { NET.joined = true; if (!NET.srv) netStatus(_t('You are in the lobby. Waiting for the host to start.')); }
      NET.phase = netPhase(m.phase);
      NET.cfg = netCfg(m.cfg);
      const hp = m.players.find((p) => p && p.h), hid = hp && typeof hp.id === 'string' ? hp.id : '';
      if (hid && NET.hostId && hid !== NET.hostId && NET.on) { netRemoveById(NET.hostId); hudMsg(_t('The match goes on with a new host.'), 'neutral', 2.5); } // match taken over by another player
      if (hid) NET.hostId = hid;
      NET.players.clear();
      for (const p of m.players) if (p && typeof p.id === 'string') NET.players.set(p.id, { id: p.id, n: netClean(p.n), lv: clamp(p.lv | 0, 0, 100), t: p.t === 1 ? 1 : 0, h: !!p.h, ig: !!p.ig, r: !!p.r, ld: clamp(p.ld | 0, 0, 100), late: !!p.la });
      netRender(); netLoadReport();
      if (NET.quickJoin && (NET.phase === 'playing' || (NET.srv && NET.phase === 'loading'))) { NET.quickJoin = false; netJoinRunning(); } // "Play now", public lobby: we enter the match in progress
      else if (NET.quickJoin && NET.phase === 'lobby' && !NET.srv) NET.quickJoin = false; // waiting lobby: the host launches when they want (a public lobby's, as soon as everyone is there)
      break;
    }
    case 'ping': if (m.ph) NET.phase = netPhase(m.ph); break;
    case 'chat': chatIn(m); break;
    case 'start': netStartOnline(m); break;
    case 'ps':
      if (!NET.on || !Array.isArray(m.l)) return;
      for (const it of m.l) if (Array.isArray(it) && typeof it[0] === 'string') netApply(it[0], it[1]);
      if (typeof m.tl === 'number' && isFinite(m.tl)) { MATCH.timeLeft = m.tl; cdNetIn(m.cd); } // (tl: the host's own send, not a relayed state)
      if (m.dm && MATCH.mode === 'dom') domNetApply(m.dm);
      break;
    case 'gone': if (typeof m.id === 'string') netRemoveById(m.id); break;
    case 'away': if (typeof m.id === 'string') netRemoteAway(m.id); break;
    case 'end':
      if (NET.on && (MATCH.state === 'playing' || MATCH.state === 'paused')) matchFinish();
      else if (UI.flow && UI.flow.online && !NET.on) { NET.phase = 'lobby'; uiOpen('multi', ['main']); netStatus(_t('The host canceled the match.')); }
      break;
    case 'deny': netReset(m.why === 'full' ? _t('This lobby is full (8 players).') : m.why === 'kick' ? _t('The host removed you from the room.') : _t('Your game version differs from the host\u0027s. Reload the page.')); break;
  }
}
function netPhase(ph) { return ph === 'playing' || ph === 'loading' ? ph : 'lobby'; }
function netCfg(c) {
  c = c || {};
  const map = mapById(c.map).id, mode = MODE_IDS.includes(c.mode) && (c.mode !== 'dom' || MAP_DEFS[map].dom) ? c.mode : 'tdm'; // domination requires a map with points
  const L = MODES[mode].limits, limit = L.includes(+c.limit) ? +c.limit : L[1];
  const time = [5, 10, 15].includes(+c.time) ? +c.time : 10;
  const diff = [0, 1, 2].includes(+c.diff) ? +c.diff : 2;
  return { bots: +c.bots ? 1 : 0, diff, limit, time, map, mode, pub: +c.pub ? 1 : 0 };
}

/* ---------- Entering and leaving a match ---------- */
/* Start order (host or guest): map loading, class selection, then netStartOnlineNow (see 09e-menus.js) */
function netStartOnline(m) {
  NET.cfg = netCfg(m.cfg); NET.team = m.team === 1 ? 1 : 0; NET.quickJoin = false;
  menuLaunch({ online: true, map: NET.cfg.map, deploy: () => netStartOnlineNow(m) });
}
function netStartOnlineNow(m) {
  NET.cfg = netCfg(m.cfg); NET.team = m.team === 1 ? 1 : 0;
  for (const e of NET.remotes.values()) netRemoveRemote(e);
  NET.remotes.clear(); NET.seen.clear(); NET.seenT.clear(); NET.ak.clear(); NET.sent.length = 0; NET.held.length = 0;
  NET.on = true; NET.shots = 0; NET.lastPub = 0; PL.ent.netQ = { seq: 0, list: [] }; NET.goneK = [0, 0];
  if (MATCH.state === 'paused') $('pause').classList.remove('show');
  startMatch({ online: true });
  if (typeof m.tl === 'number' && isFinite(m.tl)) MATCH.timeLeft = m.tl;
  if (NET.role === 'host') netRebalanceBots();
  netRender();
}
function netJoinRunning() { if (NET.role === 'client' && NET.phase !== 'lobby' && !NET.on && !UI.flow) netSend({ t: 'join' }); }
/* Leave the match in progress without leaving the lobby; silent: no message to the host */
function netLeaveMatch(silent) {
  if (!NET.on) return;
  NET.on = false; netMigDone(true);
  for (const e of NET.remotes.values()) netRemoveRemote(e);
  NET.remotes.clear(); NET.seen.clear(); NET.seenT.clear(); NET.ak.clear(); NET.sent.length = 0; NET.held.length = 0;
  netDisableBots();
  if (!silent) { if (NET.role === 'client') netSend({ t: 'leave' }); else if (NET.role === 'host') netMatchEnded(); }
  netRender();
}
function netOnline() { return NET.on; }

/* ---------- Identities ---------- */
function netIsLocal(e) { return e === PL.ent || !!e.netBot; }
function netIdOf(e) { if (!e) return ''; if (e === PL.ent) return NET.me; if (e.isRemote) return e.peer; if (e.netBot) return e.netId; return ''; }
function netLocal(id) {
  if (id === NET.me) return PL.ent;
  if (NET.role === 'host' && typeof id === 'string' && id.includes('~b')) for (const e of entities) if (e.netBot && e.netId === id) return e; // (a bot taken over from another host keeps its identifier)
  return null;
}
function netEntity(id) { return netLocal(id) || NET.remotes.get(id) || null; }
function netWeaponKey(name) {
  for (const k in NET_WSPECIAL) if (NET_WSPECIAL[k] === name) return k;
  return Object.keys(WEAPONS).find((k) => WEAPONS[k].name === name) || '';
}
function netWeaponName(key, ent) { return hasKey(NET_WSPECIAL, key) ? NET_WSPECIAL[key] : hasKey(WEAPONS, key) ? WEAPONS[key].name : ent && ent.weapon ? ent.weapon.name : ''; }

/* ---------- Remote players and bots ---------- */
/* Position published by a participant (s[0..2]), clamped around the map: an absurd or infinite value breaks neither rendering nor physics */
function netPos(s, v) {
  const B = 300;
  return v.set(clamp(numOr(s[0]), MAP.x0 - B, MAP.x1 + B), clamp(numOr(s[1]), -B, 2 * B), clamp(numOr(s[2]), MAP.z0 - B, MAP.z1 + B));
}
function netMakeRemote(id, P) {
  const team = P.t === 1 ? 1 : 0, def = netWeaponDef(P), s = P.s;
  const e = {
    id: 1000 + (NET.rid++ % 1000), name: netClean(P.n), team, isPlayer: false, isRemote: true, remoteBot: !!P.b, bot: false, peer: id,
    pos: netPos(s, new V3()), vel: new V3(), yaw: 0, pitch: 0, lookYaw: 0, crouch: false, crouchAmt: 0,
    health: 100, alive: !!s[9], kills: 0, deaths: 0, assists: 0, score: 0, streak: 0, weapon: def, dmgBy: new Map(), lastForce: null,
    target: null, visible: false, lastSeenT: -99, lastShotT: -99, respawnT: 0, recoil: 0, net: { tgt: new V3(), tv: new V3(), at: 0, shots: P.f | 0, yaw: 0, pitch: 0, airT: -99 },
  };
  initCtl(e, [def], 1);
  e.skin = netSkin(P);
  e.model = makeSoldier(e.skin, skinRel(e), def.key);
  entities.push(e); NET.remotes.set(id, e); kcAssign(e);
  if (!e.remoteBot) { hudMsg(`${_t('{0} joined the match', e.name)}`, team === PL.ent.team ? 'ally' : 'enemy', 2.5); sfxUi('notify'); }
  return e;
}
/* Outfit announced by a participant (the one they chose, or that of a host bot's weapon); unknown: Assault.
   Seen as light or dark depending on the relation to this machine's player (skinRel): in deathmatch, everyone as enemies. */
function netSkin(P) { return skinId(typeof P.sk === 'string' ? P.sk : ''); }
function netRemoveRemote(e) {
  kcRelease(e);
  netDisposeModel(e.model); const i = entities.indexOf(e); if (i >= 0) entities.splice(i, 1);
  for (const o of entities) { if (o.target === e) o.target = null; if (o.dmgBy) o.dmgBy.delete(e); }
}
/* A soldier's geometries (body and weapons merged) are its own: we free them from the GPU */
function netDisposeModel(M) {
  scene.remove(M.root);
  const free = (g) => g.traverse((o) => { if (o.isMesh && o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); }); // body geometry: shared by the team
  free(M.root);
  if (M.guns) for (const k in M.guns) if (M.guns[k].group !== M.gun) free(M.guns[k].group);
}
/* Weapon change of a remote: each weapon model is only built once per soldier */
function netSetGun(e, key) {
  const M = e.model; M.guns = M.guns || {};
  if (M.gun) { M.guns[M.gunKey] = { group: M.gun, muzzle: M.muzzleLocal, kind: M.kind }; M.root.remove(M.gun); M.gun = null; }
  const c = M.guns[key];
  if (c) { M.root.add(c.group); M.gun = c.group; M.muzzleLocal = c.muzzle; M.gunKey = key; M.kind = c.kind; M.grips = gripsFor(key); }
  else setSoldierGun(M, key);
}
/* Weapon announced by a participant: its key (model, attachments, camo), failing that its identifier; an unknown or malformed value gives the M4A1 */
function netWeaponDef(P) {
  const k = typeof P.g === 'string' && /^[a-z0-9_]{2,16}(~[a-z.]{0,80}){0,2}$/.test(P.g) ? P.g : '';
  return (k && weaponDefByKey(k)) || (hasKey(WEAPONS, P.w) && weaponDef(P.w)) || WEAPONS.m4;
}
/* A remote player or bot leaves the match; their kills stay in their team's score (NET.goneK), except keep (a bot I'm taking over) */
function netRemoveById(id, keep) {
  const e = NET.remotes.get(id); if (!e) return;
  if (!keep && NET.on) NET.goneK[e.team] += e.kills | 0;
  if (!e.remoteBot && !keep && MATCH.state !== 'menu') { hudMsg(`${_t('{0} left the match', e.name)}`, 'neutral', 2); sfxUi('notify'); }
  netRemoveRemote(e); NET.remotes.delete(id); NET.seen.delete(id); NET.seenT.delete(id); NET.ak.delete(id); netSentDrop(e); NET.held = NET.held.filter((h) => h.x !== e);
}
/* Applies the state published by a remote participant and handles their new events */
/* Cut-off player (netHostDrop): their soldier disappears without a death or kill, their counters remain; their first state on return makes them
   respawn (alive, in their place). No frozen target on which we'd land hits that wouldn't count. */
function netRemoteAway(id) {
  const e = NET.remotes.get(id); if (!e) return;
  e.alive = false; e.pred = false; e.model.rag = null; e.model.root.visible = false; e.health = 100;
}
function netApply(id, P) {
  if (!NET.on || id === NET.me || !P || typeof P !== 'object' || netLocal(id)) return;
  const s = P.s;
  if (!Array.isArray(s) || s.length < 12) { netRemoveById(id); return; }
  let e = NET.remotes.get(id); if (!e) e = netMakeRemote(id, P);
  const team = P.t === 1 ? 1 : 0;
  const sk = netSkin(P);
  if (team !== e.team || sk !== e.skin) { e.team = team; e.skin = sk; soldierLook(e.model, sk, skinRel(e)); } // team or outfit change: nothing is rebuilt
  { const nd = netWeaponDef(P); if (nd.key !== e.weapon.key) { e.weapon = nd; e.arms = makeArms([nd], 1); netSetGun(e, nd.key); } }
  e.name = netClean(P.n);
  netPos(s, e.net.tgt); e.net.tv.set(clamp(numOr(s[5]), -60, 60), 0, clamp(numOr(s[6]), -60, 60)); e.net.at = MATCH.time;
  e.net.yaw = clamp(numOr(s[3]), -1e4, 1e4); e.net.pitch = clamp(numOr(s[4]), -1.5, 1.5);
  netTrack(e, P.ts, !!s[9]);
  e.crouch = !!s[7]; e.slide = s[7] === 2; e.sprinting = !!s[8]; e.arms.adsW = s[10] ? 1 : 0; // 2: crouched and sliding
  const alive = !!s[9];
  e.health = clamp(numOr(s[11]), 0, 100);
  if (P.ak && typeof P.ak === 'object') NET.ak.set(id, P.ak); // events applied by this sender, per sender (netAckOf): read before its events, which follow it in the same state
  e.kills = P.k | 0; e.deaths = P.d | 0; e.assists = P.a | 0; e.score = P.sc | 0;
  if (P.dr) fpvNet(e, P.dr);
  if (P.mk) mechaNet(e, P.mk);
  if (alive && !e.alive) {
    if (e.pred && MATCH.time - e.predT < NET_PRED_HOLD) { /* predicted death not yet confirmed: this state left before the hit */ }
    else if (e.pred) { e.pred = false; e.alive = true; e.model.rag = null; e.lastForce = null; e.model.root.visible = true; netSentDrop(e); } // the victim survived: they get back up
    else { e.alive = true; e.health = 100; e.model.rag = null; e.lastForce = null; e.pos.copy(e.net.tgt); e.model.root.visible = true; netSentDrop(e); e.killBy = null; spawnNote(e); } // (their spawn: the spot is avoided here too)
  }
  else if (!alive && e.alive) { e.alive = false; }
  // shots: visual and sound effects only (hits arrive as events)
  const f = P.f | 0;
  if (f > e.net.shots && e.alive) {
    e.net.shots = f; e.lastShotT = MATCH.time;
    const muzzle = e.model.gun.localToWorld(e.model.muzzleLocal.clone());
    const cp = Math.cos(e.net.pitch), dir = new V3(-Math.sin(e.net.yaw) * cp, Math.sin(e.net.pitch), -Math.cos(e.net.yaw) * cp);
    muzzleWorldFx(muzzle, dir, e.weapon.silent, e.weapon.feel ? e.weapon.feel.flash : 1); if (!e.weapon.silent) flashLight(muzzle, 2.5, 7, 0.05); sfxGun(e.weapon.sound, muzzle, e);
    kcEvent('shot', { m: muzzle.clone(), d: dir.clone(), kind: e.weapon.sound, sid: e.kcI }); // for killcam replay
    if (!e.weapon.silent) {
      const hit = rayWorld(muzzle.x, muzzle.y, muzzle.z, dir.x, dir.y, dir.z, 120), end = muzzle.clone().addScaledVector(dir, hit ? hit.t : 80);
      FX.tracers.add(muzzle, end); kcEvent('ray', { a: muzzle.clone(), b: end.clone(), tr: true, flesh: false, head: false, dir: dir.clone() });
    }
    e.recoil = 0.05;
    soundEvents.push({ pos: e.pos.clone(), team: e.team, t: MATCH.time, loud: !!e.weapon.loud, quiet: !!e.weapon.silent }); if (soundEvents.length > 60) soundEvents.shift();
  } else e.net.shots = f; // counter reset to zero on a bot's respawn
  // numbered events (NET_EV_MAX at most per state: a state bloated with hundreds of grenades doesn't freeze the match)
  const last = NET.seen.get(id) || 0; let mx = last;
  if (Array.isArray(P.ev)) for (const ev of P.ev.slice(-NET_EV_MAX)) {
    if (!ev || typeof ev.i !== 'number' || ev.i <= last) continue;
    mx = Math.max(mx, ev.i);
    netEventIn(e, ev);
  }
  if (mx > last) NET.seenT.set(id, performance.now());
  NET.seen.set(id, mx);
}
function netEventIn(e, ev) {
  if (!ev || typeof ev !== 'object') return;
  const dir = new V3(clamp(numOr(ev.x), -1e3, 1e3), 0, clamp(numOr(ev.z), -1e3, 1e3));
  if (ev.k === 'hit') {
    const tgt = netLocal(ev.to);
    if (!tgt || !tgt.alive) return;
    if (!tgt.isPlayer) tgt.lastForce = { dir: dir.lengthSq() > 1e-4 ? dir.clone().normalize() : new V3(0, 0, -1), mag: 5, lift: 2.2, part: ev.h ? 'head' : 'body' };
    const d = clamp(+ev.d || 0, 0, 250);
    if (d >= tgt.health && netTradeHold(tgt, e, ev, d, dir)) return; // lethal hit fired after mine, which it hadn't received yet: pending
    NET.hitQ = ev.i; try { applyDamage(tgt, d, e, netWeaponName(ev.w, e), !!ev.h, dir); } finally { NET.hitQ = 0; }
  } else if (ev.k === 'kill') {
    const killer = netEntity(ev.by) || e, pred = e.pred, rag = e.model.rag, fall = ev.w === 'fall'; e.pred = false;
    { const h = typeof ev.q === 'number' ? NET.sent.find((m) => m.f === killer && m.v === e && m.i === ev.q) : null; e.killBy = killer; e.killS = h ? h.s : undefined; } // the hit that killed them, and the time of its shot (netHeldCheck)
    // fall into the void (voidDeath on the victim's side): no body, nor cross on the credited opponent's side (they didn't fire)
    if (fall) e.voidDead = true;
    // death already predicted on my side (netPredictKill): the fall continues, the cross and sound have already played
    else if (!pred) e.lastForce = { dir: dir.lengthSq() > 1e-4 ? dir.clone().normalize() : new V3(0, 0, 1), mag: 6, lift: 2, part: ev.h ? 'head' : 'body' };
    if (killer === PL.ent && !pred && !fall && ev.w !== 'zone') hitFeedback(!!ev.h, true);
    killEnt(e, killer, netWeaponName(ev.w, killer), !!ev.h, dir);
    if (pred && rag) e.model.rag = rag;
  } else if (ev.k === 'nade') {
    if (!e.isPlayer) e.throwT = 0.7; // throw gesture visible on the remote soldier
    const w = e.net.nadeW || (e.net.nadeW = { t: -9, n: 0 }); // 4 grenades per second at most (a state can carry several after a slowdown)
    if (MATCH.time - w.t >= 1) { w.t = MATCH.time; w.n = 0; }
    if (++w.n > 4) return;
    const p = new V3(clamp(numOr(ev.px), MAP.x0 - 50, MAP.x1 + 50), clamp(numOr(ev.py), -50, 300), clamp(numOr(ev.pz), MAP.z0 - 50, MAP.z1 + 50)), v = new V3(clamp(numOr(ev.vx), -40, 40), clamp(numOr(ev.vy), -40, 40), clamp(numOr(ev.vz), -40, 40));
    if (ev.ty === 'knife') spawnThrowKnife(e, p, v); // throwing knife: its flight only, the thrower counts the hit
    else spawnNade(e, p, v, clamp(numOr(ev.fu, 2), 0.1, 4), NADE_TYPES[ev.ty] ? ev.ty : 'frag');
  } else if (ev.k === 'air') {
    if (MATCH.time - e.net.airT < 15) return;
    e.net.airT = MATCH.time;
    airstrike(new V3(clamp(numOr(ev.x), MAP.x0, MAP.x1), 0, clamp(numOr(ev.z), MAP.z0, MAP.z1)), clamp(numOr(ev.y), -1e4, 1e4), e);
    const ally = e.team === PL.ent.team;
    hudMsg(ally ? `${_t('Allied airstrike ({0})', e.name)}` : _t('Enemy airstrike!'), ally ? 'ally' : 'enemy', 2.5);
  } else if (ev.k === 'heli') {
    // a remote player's helicopter: we only show its flight and bursts, its damage is computed on their side
    const h = spawnHeli(e); if (h) heliMsg(h, 'spawn');
  } else if (ev.k === 'hf') {
    const h = KS.helis.find((x) => x.owner === e && x.state !== 'crash');
    if (h) {
      heliStartBurst(h, new V3(clamp(numOr(ev.x), MAP.x0 - 50, MAP.x1 + 50), clamp(numOr(ev.y), -50, 300), clamp(numOr(ev.z), MAP.z0 - 50, MAP.z1 + 50)), false);
      if (ev.to === NET.me && PL.ent.alive) { hudMsg(_t('Helicopter: you are being targeted!'), 'enemy', 1.2); sfxKs('lock'); }
    }
  } else if (ev.k === 'hh') {
    const own = netLocal(ev.to); if (own) heliHitFrom(own, ev.d, e);
  } else if (ev.k === 'hx') {
    const h = KS.helis.find((x) => x.owner === e && x.state !== 'crash');
    if (h) { h.state = 'crash'; h.burst = null; h.vy = 0; h.spin = 0; heliMsg(h, 'down'); }
  } else if (ev.k === 'prop') {
    propNetHit(ev);
  } else if (ev.k === 'hang') {
    hangNetHit(ev);
  } else if (ev.k === 'uav') {
    uavStart(e.team); spawnDrone(e.team);
    const ally = e.team === PL.ent.team; sfxAnnounce(ksFriendly(e) ? 'uav_on' : 'uav_enemy');
    hudMsg(ally ? `${_t('Allied UAV ({0})', e.name)}` : _t('Enemy UAV online'), ally ? 'ally' : 'enemy', 2.5);
  } else if (ev.k === 'sat') {
    satFire(e);
  } else if (ev.k === 'emp') {
    empFire(e);
  } else if (ev.k === 'mk') {
    if (!MECHAS.some((x) => x.owner === e)) mechaCall(e, new V3(numOr(ev.x), numOr(ev.y), numOr(ev.z)), numOr(ev.r));
  } else if (ev.k === 'dx') {
    fpvNetEnd(e, ev);
  } else if (ev.k === 'dh') {
    const own = netLocal(ev.to); if (own) fpvNetHit(own, ev.d);
  } else if (ev.k === 'mh') {
    const own = netLocal(ev.to); if (own) mechaNetHit(own, ev.d); // hit on a local participant's mecha (08f-mecha.js)
  } else if (ev.k === 'mx') {
    mechaNetDead(e); // mecha destroyed on its owner's side
  }
}
/* Trace of a remote participant for the killcam (kcNetView, 09b-killcam.js): each received state, timestamped by its author's clock (P.ts, in ms; a
   relay or an irregular connection delivers two at once then none) mapped onto ours. The offset between the two clocks is the smallest gap
   seen (the shortest trip); it rises slowly, which follows a drifting clock, and restarts from zero after a one-second jump (slowed
   tab). A version without P.ts: the arrival time. Fourteen seconds kept: the replay reads five, while online the match continues. */
function netTrack(e, ts, alive) {
  const N = e.net, H = N.hist || (N.hist = []), now = MATCH.time;
  let t = now;
  if (Number.isFinite(ts)) {
    const d = now - ts / 1000;
    N.off = N.off === undefined || d < N.off || d - N.off > 1 ? d : N.off + (d - N.off) * 0.005;
    t = ts / 1000 + N.off;
  }
  if (H.length && t <= H[H.length - 1].t + 1e-3) return; // the same state relayed twice, or arrived after a more recent one
  H.push({ t, x: N.tgt.x, y: N.tgt.y, z: N.tgt.z, vx: N.tv.x, vz: N.tv.z, yaw: N.yaw, pitch: N.pitch, alive });
  while (H.length > 2 && (H[0].t < now - 14 || H.length > 400)) H.shift();
}
/* A remote participant moves between two updates: smoothing and short extrapolation */
function updateRemote(e, dt) {
  const N = e.net, age = clamp(MATCH.time - N.at, 0, 0.25);
  if (e.alive) {
    const tx = N.tgt.x + N.tv.x * age, tz = N.tgt.z + N.tv.z * age;
    const k = 1 - Math.exp(-14 * dt);
    const ox = e.pos.x, oz = e.pos.z;
    e.pos.x += (tx - e.pos.x) * k; e.pos.z += (tz - e.pos.z) * k; e.pos.y += (N.tgt.y - e.pos.y) * k;
    if (e.pos.distanceTo(N.tgt) > 6) e.pos.copy(N.tgt);
    e.vel.set((e.pos.x - ox) / Math.max(dt, 1e-3), 0, (e.pos.z - oz) / Math.max(dt, 1e-3));
    e.yaw += angDiff(e.yaw, N.yaw) * k; e.lookYaw = e.yaw; e.pitch += (N.pitch - e.pitch) * k;
    e.crouchAmt = damp(e.crouchAmt, e.crouch ? 1 : 0, 10, dt);
    e.slideAmt = damp(e.slideAmt || 0, e.slide ? 1 : 0, e.slide ? 12 : 7, dt); // like ctlMove
    e.visible = true; e.target = null;
    // a remote player's steps, like the bots' (07b-tactics.js)
    const v = hyp(e.vel.x, e.vel.z), run = v > 6;
    e.stepAcc = (e.stepAcc || 0) + v * dt;
    if (v > 0.8 && e.stepAcc > (run ? 2.8 : 2.2)) { e.stepAcc = 0; sfxStep(e.pos, e.crouch ? 0.12 : run ? 0.34 : 0.26, surfaceAt(e.pos)); }
  }
  animSoldier(e, dt);
  if (!e.alive) e.model.root.visible = !e.voidDead && !!e.model.rag; // fell into the void, or already dead on our arrival (animSoldier): no body
}

/* ---------- What I publish ---------- */
/* Online hit latency (owner feedback: "in multi, a guest sees the enemy die a fraction of a second after their hit"):
   - a hit or a death goes out on the next frame (NET.flush), without waiting for the next publication (66 ms); with
     the host's immediate relay, a hit's trip from guest to guest loses up to two publication waits;
   - on the shooter's side, a lethal hit based on the last health published by the victim makes them fall right away (netPredictKill: kill cross and
     sound, fall); the announcement of their death arrives a round trip later and replays nothing; without it within NET_PRED_HOLD s, the victim gets back up. */
const NET_PRED_HOLD = 1.0;
/* Health of a remote victim as seen by the shooter: the last health they published, minus my hits they hadn't received yet.
   Without this, the bullet that kills went out while the shooter still believed their target at full health (their published health comes back a round trip
   after each hit): death was only predicted on the first hit, never on the third or fourth of a burst, and the player saw
   the cross right away then the kill a round trip later (two passes through the host between two guests). Each player publishes
   with their state the number of the last event received from each recent sender (ak, netPresence); the health published in the same state accounts
   for all those events. For a bot, the host publishes (identifier before ~b). Sender of a version without acknowledgment: published
   health alone, as before. A hit never acknowledged is forgotten after 2 s. */
function netPredHealth(e) {
  const ak = netAckOf(e, NET.me);
  if (ak === undefined) return e.health;
  let h = e.health;
  for (const m of NET.sent) if (m.f === PL.ent && m.v === e && m.i > ak && MATCH.time - m.t <= 2) h -= m.d;
  return h;
}
/* Number of the last event from sender sid applied by whoever publishes e's state (themselves, or the host for a bot: identifier
   before ~b); undefined: nothing applied recently, or version without acknowledgment */
function netAckOf(e, sid) {
  const a = NET.ak.get(String(netIdOf(e)).split('~b')[0]), v = a && a[sid];
  return typeof v === 'number' ? v : undefined;
}
/* Hits sent by a local participant (me, or a host bot): { f: shooter, v: victim, i: number, d: damage, s: shot time
   (netStamp), t: MATCH.time }, kept 3 s. Used for the predicted health and for arbitrating crossed deaths. */
function netSentDrop(v) { NET.sent = NET.sent.filter((m) => m.v !== v); }
/* Time of a shot on the match clock, the same for everyone (remaining time, re-synced by the host at each send), in increasing ms */
function netStamp() { return Math.round(-MATCH.timeLeft * 1000); }
/* Crossed deaths (owner feedback: "you can kill each other at the same time in multi"): A and B each fire a lethal bullet before having
   received the other's; each shooter deciding their hits, both died. Now, the victim of a lethal hit from X (tgt)
   checks whether they had themselves hit X before that shot (shot time, netStamp) without X having applied it yet (X's acknowledgment, read in
   the very state that carries the hit). If so, the hit waits (NET.held) for X's next state: X announces their death through a hit from tgt fired
   before theirs, and theirs doesn't count (they were already dead); X applied those hits and is still alive, and theirs applies;
   0.8 s without an answer, it applies. A waiting hit isn't acknowledged (ak capped, netPresence): X still sees it as in flight.
   Both sides apply the same rule at the same times: only one of the two dies, the one who fired second. A wait only depends
   on strictly older shots: no endless cross-waiting. Shot from a version without a time: applied, as before. */
const NET_HOLD = 0.8;
function netTradeHold(tgt, x, ev, d, dir) {
  const s = ev.s;
  if (typeof s !== 'number' || !Number.isFinite(s)) return false;
  if (!netTradeOpen(tgt, x, s)) return false;
  NET.held.push({ tgt, x, ev, d, dir: dir.clone(), s, until: MATCH.time + NET_HOLD });
  return true;
}
/* did tgt hit x before time s without x having applied it yet? */
function netTradeOpen(tgt, x, s) {
  const ak = netAckOf(x, netIdOf(tgt));
  return NET.sent.some((m) => m.f === tgt && m.v === x && m.s < s && !(ak >= m.i));
}
function netHeldCheck() {
  if (!NET.held.length) return;
  NET.held = NET.held.filter((h) => {
    if (!h.tgt.alive || !(MATCH.state === 'playing' || MATCH.state === 'paused')) return false; // died in the meantime, or match over
    if (h.x.killBy === h.tgt && typeof h.x.killS === 'number' && h.x.killS < h.s) return false; // X killed first by my hit: their shot doesn't count
    if (MATCH.time < h.until && netTradeOpen(h.tgt, h.x, h.s)) return true;
    NET.hitQ = h.ev.i; try { applyDamage(h.tgt, h.d, h.x, netWeaponName(h.ev.w, h.x), !!h.ev.h, h.dir); } finally { NET.hitQ = 0; }
    return false;
  });
}
function netPredictKill(e, head, dir) {
  e.pred = true; e.predT = MATCH.time; e.alive = false;
  const d = dir && dir.lengthSq() > 1e-4 ? new V3(dir.x, 0, dir.z) : new V3(0, 0, 1);
  e.lastForce = { dir: d.lengthSq() > 1e-6 ? d.normalize() : new V3(0, 0, 1), mag: 6, lift: 2, part: head ? 'head' : 'body' };
}
const NET_EV_MAX = 24; // events kept and resent per published state (netEvent), and read at most once in a received state (netApply)
function netEvent(ev, ent) {
  ent = ent || PL.ent;
  const Q = ent.netQ || (ent.netQ = { seq: 0, list: [] });
  ev.i = ++Q.seq; Q.list.push({ ev, at: performance.now(), sent: 0 }); if (Q.list.length > NET_EV_MAX) Q.list.shift();
  if (ev.k === 'hit' || ev.k === 'kill') NET.flush = true;
}
/* Each event goes out in several successive sends (at least 3, and for 0.7 s), even at a low frame rate */
function netEvList(ent, now) {
  const Q = ent.netQ; if (!Q) return [];
  while (Q.list.length && Q.list[0].sent >= 3 && now - Q.list[0].at > 700) Q.list.shift();
  for (const x of Q.list) x.sent++;
  return Q.list.map((x) => x.ev);
}
function netSendHit(victim, dmg, weapon, head, dir, attacker) {
  const ev = { k: 'hit', to: victim.peer, d: Math.round(dmg * 10) / 10, h: head ? 1 : 0, w: netWeaponKey(weapon), x: +(dir ? dir.x : 0).toFixed(2), z: +(dir ? dir.z : 0).toFixed(2), s: netStamp() };
  netEvent(ev, attacker);
  while (NET.sent.length && (MATCH.time - NET.sent[0].t > 3 || NET.sent.length > 200)) NET.sent.shift();
  NET.sent.push({ f: attacker, v: victim, i: ev.i, d: ev.d, s: ev.s, t: MATCH.time }); // hit in flight (netPredHealth, netTradeOpen)
}
function netAirstrike(target, yaw, owner) {
  if (owner === PL.ent) PL.actT = MATCH.time;
  // message rounding: the bomb pattern (airPattern) is the same on the owner's side and the other players'
  target = new V3(Math.round(target.x * 10) / 10, target.y, Math.round(target.z * 10) / 10); yaw = Math.round(yaw * 1000) / 1000;
  airstrike(target, yaw, owner);
  if (MATCH.online && netIsLocal(owner)) netEvent({ k: 'air', x: +target.x.toFixed(1), z: +target.z.toFixed(1), y: +yaw.toFixed(3) }, owner);
}
function netHeliCall(owner) { if (owner === PL.ent) PL.actT = MATCH.time; if (MATCH.online && netIsLocal(owner)) netEvent({ k: 'heli' }, owner); }
function netHeliFire(h, aim, target) { if (MATCH.online && netIsLocal(h.owner)) netEvent({ k: 'hf', x: +aim.x.toFixed(1), y: +aim.y.toFixed(1), z: +aim.z.toFixed(1), to: netIdOf(target) }, h.owner); }
function netHeliHit(h, dmg, shooter) { if (MATCH.online && netIsLocal(shooter)) netEvent({ k: 'hh', to: netIdOf(h.owner), d: Math.round(dmg) }, shooter); }
function netHeliDown(h) { if (MATCH.online && netIsLocal(h.owner)) netEvent({ k: 'hx' }, h.owner); }
function netUav(owner) { if (MATCH.online && netIsLocal(owner)) netEvent({ k: 'uav' }, owner); }
function netSat(owner) { if (MATCH.online && netIsLocal(owner)) netEvent({ k: 'sat' }, owner); }
function netEmp(owner) { if (MATCH.online && netIsLocal(owner)) netEvent({ k: 'emp' }, owner); }
function netPresence(e, now) {
  const r = (v, n = 2) => Math.round(v * 10 ** n) / 10 ** n, me = e === PL.ent;
  const s = [r(e.pos.x), r(e.pos.y), r(e.pos.z), r(me ? (PILOT.d ? PILOT.yaw : PL.yaw) : e.yaw, 3), r(me ? (PILOT.d ? PILOT.pitch : PL.pitch) : e.pitch, 3), r(e.vel.x, 1), r(e.vel.z, 1),
    e.crouch ? ((e.slideT || 0) > 0 ? 2 : 1) : 0, e.sprinting ? 1 : 0, e.alive ? 1 : 0, (me ? VM.ads : e.arms.adsW) > 0.5 ? 1 : 0, Math.max(0, Math.round(e.health))];
  const p = { ts: Math.round(now), n: me ? NET.nick : e.name, t: e.team, w: me ? curW().def.id : armsW(e).def.id, g: me ? curW().def.key : armsW(e).def.key, s, f: me ? NET.shots : e.arms.shots, k: e.kills, d: e.deaths, a: e.assists, sc: e.score, sk: skinOf(e), ev: netEvList(e, now) };
  const dr = fpvPub(e); if (dr) p.dr = dr; // kamikaze drone in flight (08e-fpv.js)
  const mk = mechaPub(e); if (mk) p.mk = mk; // mecha landed (08f-mecha.js)
  if (!me) p.b = 1;
  else { // acknowledgment (netPredHealth, netTradeOpen): last applied event from each sender in the last 3 seconds, before a pending hit
    let ak = null;
    for (const [id, t] of NET.seenT) { if (now - t > 3000) { NET.seenT.delete(id); continue; } (ak || (ak = {}))[id] = NET.seen.get(id) || 0; }
    for (const h of NET.held) { const id = netIdOf(h.x); if (ak && id in ak) ak[id] = Math.min(ak[id], h.ev.i - 1); }
    if (ak) p.ak = ak;
  }
  return p;
}
function netUpdate(dt) {
  if (!NET.on) return;
  for (const e of NET.remotes.values()) updateRemote(e, dt);
  netHeldCheck(); // pending crossed deaths
  const now = performance.now();
  if (NET.flush || now - NET.lastPub > 66) {
    NET.lastPub = now; NET.flush = false;
    if (NET.role === 'host') {
      const l = [[NET.me, netPresence(PL.ent, now)]];
      for (const b of entities) if (b.netBot) l.push([b.netId, netPresence(b, now)]);
      netBroadcast({ t: 'ps', l, tl: Math.round(MATCH.timeLeft * 100) / 100, cd: cdNetOut(), dm: MATCH.mode === 'dom' ? domNetState() : undefined }, true); // cd: start countdown (09y-countdown.js)
    } else netSend({ t: 'p', p: netPresence(PL.ent, now) });
  }
  const live = MATCH.state === 'playing' || MATCH.state === 'paused';
  if (MATCH.mode === 'ffa') { // free-for-all: the score is modeUpdate's (me and the best opponent), the first to the limit wins
    if (NET.role === 'host' && live && ffaList().some((e) => e.kills >= MATCH.limit)) matchFinishSoon();
    return;
  }
  if (MATCH.mode === 'dom') return; // domination: points held by the host (domUpdate, domNetApply), who announces the end
  // team score: sum of the kills declared by each
  const sc = [0, 0];
  for (const e of entities) if (e === PL.ent || e.isRemote || e.netBot) sc[e.team] += e.kills;
  sc[0] += NET.goneK[0]; sc[1] += NET.goneK[1]; // those who left
  if (!MATCH.outro) MATCH.score = sc; // the announced score no longer moves during the result announcement
  if (NET.role === 'host' && live && (sc[0] >= MATCH.limit || sc[1] >= MATCH.limit)) matchFinishSoon();
}
/* Heartbeat: keeps channels open and detects vanished participants */
function netHeartbeat() {
  if (NET.role === 'off') { NET.hbT = 0; return; }
  const now = performance.now();
  /* A tab that is blocked (the map is building) or slowed by the browser (background) skips several heartbeats: messages received
     in the meantime wait behind the timer and the other side would seem mute for tens of seconds. After a gap of more than
     4 s, no one is judged mute: the delays restart from now (a host really gone will stay so 30 s longer, no more). */
  if (NET.hbT && now - NET.hbT > 4000) { NET.hostSeen = now; for (const pl of NET.players.values()) pl.seen = now; }
  NET.hbT = now;
  if (!NET.joined && now - NET.t0 > 25000) {
    if (netViaServer()) netFail(NET.me ? _t('The host is not responding. Try again, or ask them to create a new lobby.') : _t('The game server cannot be reached.'));
    else if (!NET.me) { NETD.sig = 'fail'; netFail(_t('Signaling server unreachable. Try again in a moment.')); }
    else netFail(_t('Cannot reach the host. The direct connection seems blocked by the network.'));
    return;
  }
  if (NET.role === 'client') {
    if (!NET.joined) return;
    if (NET.resume) return; // reconnection in progress (netResume): it has its own delay
    if (now - NET.hostSeen > (NET.hostConn && NET.hostConn.relay ? NET_SILENT_SRV : 30000)) { netLost(_t('The host is no longer responding.')); return; } // (through the server: it signals a departed host itself)
    if (now - NET.lastSend > 2000) netSend({ t: 'ping' });
    netLoadReport();
  } else if (NET.joined) {
    for (const pl of [...NET.players.values()]) {
      if (pl.conn && now - pl.seen > (pl.conn.relay ? NET_SILENT_SRV : 30000)) { const c = pl.conn; try { c.close(); } catch (e) { /* already closed */ } netHostDrop(pl.id, c, true); }
      else if (pl.away && (now - pl.away > NET_AWAY || !NET.on)) netHostDrop(pl.id, null, true); // didn't come back in time, or match over
    }
    // everyone, including those who stayed in the menu during a match; the phase catches up a lost lobby state
    if (now - (NET.lastPing || 0) > 2000) { NET.lastPing = now; netBroadcast({ t: 'ping', ph: NET.phase }); }
    netLoadReport(); netCheckGo();
  }
}

/* ---------- Lobby interface: the Multiplayer menu (09ea-list.js), in the style of the old Call of Duty games ----------
   Home: on the left Play now, Create a lobby, Join a lobby; on the right the public matches. Lobby: on the left Map, Match
   settings, Edit class, Invite friends, Chat, the map preview below; on the right the lobby's players by team, with
   the spots the bots will take; a player opens their actions (switch team, mute, kick). */
/* Setting changed by the host in the lobby: it applies to the whole lobby, and the host finds it again in Solo (shared memory) */
function netSetupSet(k, v) {
  if (NET.role !== 'host' || NET.phase !== 'lobby') return;
  const c = Object.assign({}, NET.cfg);
  if (k === 'bots') { c.bots = v === 'off' ? 0 : 1; if (v !== 'off') c.diff = v; }
  else if (k === 'mode') { c.mode = v; c.limit = Settings[MODES[v].key]; }
  else c[k] = v;
  if (k === 'pub') { NETP.vis = v ? 1 : 0; try { localStorage.setItem('cod_salon_pub', String(NETP.vis)); } catch (e) { /* storage unavailable */ } } // the next lobby created will be the same
  NET.cfg = netCfg(c);
  Settings.mode = NET.cfg.mode; Settings.minutes = NET.cfg.time; Settings[MODES[NET.cfg.mode].key] = NET.cfg.limit; if (NET.cfg.bots) Settings.difficulty = NET.cfg.diff;
  saveSettings(); sfxUi('click'); netLobbyChanged();
}
/* Is the lobby chat open? (messages then arrive as read) */
function netChatOpen() { const L = LM.scr.multi, f = L && L.stack[L.stack.length - 1]; return !!f && f.id === 'chat' && UI.screen === 'multi'; }
/* The lobby's settings, for the match settings rows (matchRows) */
function netMatchCfg() { return { map: NET.cfg.map, mode: NET.cfg.mode, diff: NET.cfg.diff, bots: NET.cfg.bots, limit: NET.cfg.limit, time: NET.cfg.time, pub: NET.cfg.pub, pubOk: false, online: true, edit: NET.role === 'host' && NET.phase === 'lobby', set: netSetupSet }; }
/* A team's players (or all, free-for-all): level, name, tags; a player you can act on opens their actions.
   Then the free spots that bots will take (6 per team, 8 in total free-for-all). */
function netPlayerRows(t, ffa) {
  const host = NET.role === 'host', lobby = NET.phase === 'lobby', rows = [];
  for (const p of NET.players.values()) {
    if (!ffa && p.t !== t) continue;
    const other = p.id !== NET.me, tags = []; // the player themselves: their level in yellow and the yellow bar are enough
    if (p.h || (host && !other)) tags.push(_t('host')); if (NET.muted.has(p.id)) tags.push(_t('muted'));
    if (NET.phase === 'playing' && p.ig) tags.push(_t('in match'));
    else if (p.ig) tags.push((p.ld | 0) >= 100 ? _t('map ready') : (p.ld | 0) > 0 ? (p.ld | 0) + PCT : _t('loading'));
    const acts = other || (!ffa && lobby); // mute, kick; yourself: switch team
    rows.push({ k: 'player', key: p.id, label: p.n, lv: p.lv | 0, tags, me: !other, page: acts ? 'player' : null, params: p.id });
  }
  const free = (ffa ? NET_MAX : NET_TEAM) - rows.length, diff = (DIFF[NET.cfg.diff] || DIFF[1]).name;
  if (NET.cfg.bots) for (let i = 0; i < free; i++) rows.push({ k: 'player', key: 'bot' + t + '-' + i, label: diff, bot: true });
  if (!rows.length) rows.push({ k: 'note', text: _t('Nobody') });
  return rows;
}
/* Lobby stage: players by team, your own first */
function netStage() {
  const ffa = NET.cfg.mode === 'ffa', me = NET.players.get(NET.me), mine = me ? me.t : 0;
  const head = `<b>${esc(_t('Players'))}</b><span>${NET.players.size}/${NET_MAX}</span>`;
  const foot = $('netDiagBtn'), note = NET.status && NET.status !== netHello() ? $('netStatus') : null; // the lobby state (link copied, connection...) above the players; the connection report below
  if (ffa) return { head, note, foot, cols: [{ head: esc(_t('Free for all')), rows: netPlayerRows(0, true) }] };
  return { head, note, foot, cols: [mine, 1 - mine].map((t) => ({ cls: t === mine ? 'ally' : 'enemy', head: esc(TEAM_NAMES[t]), rows: netPlayerRows(t, false) })) };
}
/* Home stage: the public matches (game server), one row per match; without a game server, how to play with friends */
function netPubStage() {
  if (!netViaServer()) return { head: `<b>${esc(_t('With friends'))}</b>`, cols: [{ rows: [{ k: 'note', text: _t('Create a lobby and send the link to your friends, or enter a lobby code.') }] }] };
  if (!NETP.list.length) return { head: `<b>${esc(_t('Online'))}</b>`, cols: [{ rows: [
    { k: 'note', text: _t('Play now puts you in a public match, with bots filling the teams. Nobody playing yet? You open it, and the next players join you.') },
    { k: 'note', text: _t('Create a lobby opens a private match. Share its code or link, and start when your friends are in.') }] }] };
  const rows = [];
  if (!NETP.list.length) rows.push({ k: 'note', text: NETP.err ? _t('The public match list is unavailable right now.') : NETP.at ? _t('No public match right now. Start one with "Play now".') : _t('Loading...') });
  for (const s of NETP.list) {
    const m = mapById(s.m), sub = [MODES[s.o] ? MODES[s.o].btn : '', s.p === 'lobby' ? _t('Lobby') : _t('In match'), _t('Host: {0}', netClean(s.n))].filter(Boolean).join(' · ');
    rows.push({ k: 'pick', key: s.c, label: m.name, sub, value: s.j + '/' + s.x, art: (m.ok && MAP_ART[m.id]) || '', disabled: s.j >= s.x || NET.role !== 'off', pick: () => { sfxUi('click'); netJoinLobby(s.c); } });
  }
  const online = NETP.playerCount < 0 ? '' : `<span>${esc(_tn(NETP.playerCount, '{0} player online right now', '{0} players online right now'))}</span>`;
  return { head: `<b>${esc(_t('Public matches'))}</b>${online}`, cols: [{ rows }] };
}
function netTeamSwap(id) {
  if (id === NET.me) {
    if (NET.role === 'client') netSend({ t: 'team' });
    else if (NET.role === 'host') { const me = NET.players.get(NET.me); if (me && !me.ig) { me.t = 1 - me.t; netLobbyChanged(); } }
  } else { const q = NET.players.get(id); if (q && !q.ig && NET.role === 'host') { q.t = 1 - q.t; netLobbyChanged(); } }
}
const NET_PAGES = {
  home: () => {
    const rows = [], via = netViaServer(), can = netCan(), title = _t('Multiplayer'), sub = _t('Online matches, public or with friends, up to 8 players');
    if (NET.status && NET.status !== netHello()) rows.push({ k: 'node', node: $('netStatus') }); // a message (connection, lobby not found...), not the welcome prompt
    if (!acctOnlineOk()) { // multiplayer requires an account
      rows.push({ k: 'note', text: _t('Multiplayer requires an account. Your name and your progression follow you from one match to the next. Solo mode stays open to everyone.') });
      rows.push({ k: 'btn', key: 'login', label: _t('Sign in or create an account'), run: () => { ACCT.note = _t('Sign in to play online.'); uiGo('profile'); } });
      return { title, sub, rows };
    }
    if (SRV.list) { // server lobbies: the players', in the list; a created lobby is public or private (permanent lobbies are no longer offered)
      rows.push({ k: 'link', key: 'create', label: _t('Create a lobby'), sub: _t('Public or private, you set up the match'), page: 'create', disabled: !can });
    } else {
      if (via) rows.push({ k: 'btn', key: 'quick', label: _t('Play now'), sub: _t('Join or start a public match'), run: () => netQuick(), disabled: !can });
      rows.push({ k: 'btn', key: 'create', label: _t('Create a lobby'), sub: _t('You set up the match and invite your friends'), run: () => netHost({ pub: NETP.vis }), disabled: !can });
    }
    rows.push({ k: 'link', key: 'join', label: _t('Join a lobby'), sub: SRV.list ? _t('With its code or invitation link') : _t('With the host\u0027s code or link'), page: 'join' });
    if (!ACCT.user) rows.push({ k: 'text', key: 'name', label: _t('Your nickname'), input: $('netName') }); // logged in: the account's display name serves as nickname
    rows.push({ k: 'node', node: $('netDiag') });
    return { title, sub, rows, stage: SRV.list ? srvListStage : netPubStage };
  },
  join: (o) => {
    const rows = [
      { k: 'note', text: o && o.privateLobby ? _t('This lobby is private. Enter the code its leader gave you.') : _t('Enter the 5-character code given by the host, or open their invitation link.') },
      { k: 'text', key: 'code', label: _t('Lobby code'), input: $('netCodeIn'), bare: true }, // the field alone: its placeholder text already says "Code"
      { k: 'btn', key: 'go', label: _t('Join'), primary: true, run: () => netJoinCode($('netCodeIn').value), disabled: !netCan() },
    ];
    return { head: _t('Join a lobby'), rows };
  },
  lobby: () => {
    const setup = NET.role === 'host' && NET.phase === 'lobby', m = mapById(NET.cfg.map), MD = MODES[NET.cfg.mode] || MODES.tdm, rows = [];
    rows.push( // the map and settings are in the inset, under the menu; the lobby state, above the players
      { k: 'link', key: 'map', label: _t('Map'), page: 'map', disabled: !setup },
      { k: 'link', key: 'setup', label: _t('Match settings'), page: 'setup' }, // the guest sees the rules there, without changing them
      { k: 'link', key: 'class', label: _t('Edit class'), open: () => uiGo('classes') },
      { k: 'link', key: 'invite', label: _t('Invite friends'), page: 'invite' }, // the code large, to copy or share
      { k: 'link', key: 'chat', label: _t('Chat'), value: CHAT.unread ? String(CHAT.unread) : '', page: 'chat' }); // (no row to leave the lobby: that's Back, netLeaveAsk)
    return { title: _t('Lobby {0}', NET.code), sub: MD.name, rows, stage: netStage, preview: mapPreview(m, netMatchCfg()) };
  },
  map: () => ({
    head: _t('Map'), grid: true,
    rows: mapCards(NET.cfg.map, NET.role === 'host' && NET.phase === 'lobby' ? (id) => {
      NET.cfg = netCfg(Object.assign({}, NET.cfg, { map: id })); Settings.map = NET.cfg.map; saveSettings();
      for (const q of NET.players.values()) q.ld = 0; // everyone announces again where they stand for this map
      sfxUi('click'); lmPop(LM.scr.multi); netLobbyChanged();
    } : null),
  }),
  setup: () => ({ head: _t('Match settings'), rows: matchRows(netMatchCfg()) }),
  player: (id) => {
    const p = NET.players.get(id), host = NET.role === 'host', ffa = NET.cfg.mode === 'ffa', rows = [];
    if (!p) return { head: '', rows };
    const other = id !== NET.me, lobbyOk = NET.phase === 'lobby';
    if (!ffa && lobbyOk && (!other || host)) rows.push({ k: 'btn', key: 'swap', label: _t('Switch team'), sub: _t('Move this player to the other team'), run: () => { netTeamSwap(id); lmPop(LM.scr.multi); }, disabled: !NET.joined || !!p.ig || NET.on });
    if (other) { // mute their messages (on your side only); the host can kick them, in two steps
      const muted = NET.muted.has(id);
      rows.push({ k: 'btn', key: 'mute', label: muted ? _t('Unmute') : _t('Mute'), sub: muted ? _t('Show this player\u0027s messages again') : _t('Stop seeing this player\u0027s messages'), run: () => { if (muted) NET.muted.delete(id); else NET.muted.add(id); sfxUi('click'); chatRender(); netRender(); } });
      if (host) {
        const ask = NET.kickAsk === id;
        rows.push({ k: 'btn', key: 'kick', danger: true, label: ask ? _t('Confirm removal') : _t('Remove'), sub: _t('Remove this player from the room (they cannot come back)'), run: () => { if (NET.kickAsk === id) { netKick(id); lmPop(LM.scr.multi); } else { NET.kickAsk = id; setTimeout(() => { if (NET.kickAsk === id) { NET.kickAsk = ''; netRender(); } }, 4000); } sfxUi('click'); netRender(); } });
      }
    }
    return { head: p.n, rows };
  },
  diag: () => { netdShow(true); return { head: _t('Connection report'), rows: [{ k: 'node', node: $('netDiag') }] }; },
  // invite: the code large (to dictate or copy), the link; copy them, or share them (phone); the pressed button says it's done
  invite: () => {
    const done = (w, t) => (NET.copied === w ? t : null), code = Object.assign(document.createElement('p'), { className: 'lcode', textContent: netCodeNow() });
    const rows = [
      { k: 'note', text: _t('Your friends type this code in Join a lobby, or open the link.') },
      { k: 'node', node: code }, { k: 'node', node: $('netLink') },
      { k: 'btn', key: 'code', primary: true, label: done('code', _t('Code copied')) || done('code!', _t('Copy failed')) || _t('Copy the code'), run: () => netCopy('code') },
      { k: 'btn', key: 'link', label: done('link', _t('Link copied')) || done('link!', _t('Copy it by hand')) || _t('Copy the link'), run: () => netCopy('link') },
    ];
    if (navigator.share) rows.push({ k: 'btn', key: 'share', label: _t('Share'), run: () => navigator.share({ title: 'War Bash', text: _t('Join my lobby {0}', netCodeNow()), url: netLink() }).catch(() => {}) });
    return { head: _t('Invite friends'), rows };
  },
  chat: () => { CHAT.unread = 0; return { head: _t('Chat'), cls: 'chat', rows: [{ k: 'node', node: $('netChatLog') }, { k: 'text', key: 'msg', label: _t('Message'), input: $('netChatIn') }] }; }, // open: everything is read
};
/* Copies the lobby's code or link (w: 'code' or 'link'); NET.copied makes the button say it's done (or impossible: the link is then
   selected for a manual copy), for 2.5 s */
function netCopy(w) {
  const txt = w === 'code' ? netCodeNow() : netLink(), say = (k) => { NET.copied = k; clearTimeout(NET.copiedT); NET.copiedT = setTimeout(() => { NET.copied = ''; netRender(); }, 2500); netRender(); };
  const fail = () => { say(w + '!'); if (w === 'link') { const i = $('netLink'); if (i.isConnected) { i.focus(); i.select(); } } };
  $('netLink').value = netLink();
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => say(w), fail); else fail();
}
function netRender(o = {}) {
  const L = LM.scr.multi; if (!L) return;
  const inLobby = netInLobby(), want = SRV.on ? 'srv' : inLobby ? 'lobby' : 'home', host = NET.role === 'host';
  $('scr-multi').classList.toggle('lobby', inLobby); // lobby: the footer (launch the match) is displayed
  $('scr-multi').classList.toggle('srv', SRV.on); // public lobby: the vote above the footer
  menuNetChanged(); acctSyncMulti();
  if (inLobby) $('netLink').value = netLink();
  const top = L.stack[L.stack.length - 1];
  if (!top || L.stack[0].id !== want || o.fresh) lmReset(L, want);
  else {
    if ((top.id === 'player' && !NET.players.has(top.params)) || (top.id === 'srvp' && !(SRV.st && SRV.st.j.some((p) => p.id === top.params))) || (top.id === 'map' && !(host && NET.phase === 'lobby'))) lmPop(L); // the player left; the match is launched
    if (UI.screen === 'multi' || !L.def) lmRender(L, o);
  }
  srvVoteRender();
  if (!inLobby) return;
  if (SRV.on) { srvFoot(); return; }
  const start = $('netStart');
  if (host) { start.textContent = NET.phase === 'loading' ? _t('Loading the match...') : _t('Start the match'); start.disabled = !NET.joined || NET.phase !== 'lobby'; }
  else { start.textContent = NET.phase !== 'lobby' ? _t('Join the match') : _t('Waiting for the host'); start.disabled = NET.phase === 'lobby' || NET.on || !NET.joined || !!UI.flow; }
}
function netInit() {
  try { NET.nick = netClean(localStorage.getItem('cod_nick') || '').replace(/^Soldat$/, ''); } catch (e) { NET.nick = ''; }
  $('netName').value = NET.nick;
  try { NETP.vis = localStorage.getItem('cod_salon_pub') === '1' ? 1 : 0; } catch (e) { NETP.vis = 0; }
  lmMount($('scr-multi'), { pages: NET_PAGES, home: 'home', col: $('netList'), stage: $('netStage'), panel: $('netPanel'), preview: $('netPrev'), preview2: $('netPrev2'), title: $('scr-multi').querySelector('h2'), sub: $('scr-multi').querySelector('.shead p'), screen: 'multi', bin: $('netBin') });
  setInterval(netPubTick, 1000); srvInit();
  $('nlStay').addEventListener('click', () => netLeaveClose(false)); $('nlQuit').addEventListener('click', () => netLeaveClose(true));
  $('netLeave').addEventListener('click', (e) => { if (e.target === e.currentTarget) netLeaveClose(false); }); // a click on the background: we stay
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && !$('netLeave').classList.contains('hidden')) { e.preventDefault(); e.stopImmediatePropagation(); netLeaveClose(false); } }, true);
  $('netCodeIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') netJoinCode($('netCodeIn').value); });
  $('netName').addEventListener('change', () => {
    netNick();
    if (NET.role === 'client') netSend({ t: 'nick', n: NET.nick });
    else if (NET.role === 'host') { const me = NET.players.get(NET.me); if (me) { me.n = NET.nick; netLobbyChanged(); } }
  });
  $('netStart').addEventListener('click', () => { if (SRV.on) srvStartClick(); else if (NET.role === 'host') netLaunch(); else netJoinRunning(); });
  MAPL.subs.add(() => netLoadReport()); // lobby map loading progress
  chatInit();
  $('netDiagCopy').addEventListener('click', () => netdCopy());
  $('netDiagBtn').addEventListener('click', () => lmPush(LM.scr.multi, 'diag'));
  setInterval(netHeartbeat, 1000);
  addEventListener('pageshow', () => { NET.leaving = false; });
  addEventListener('pagehide', () => { NET.leaving = true; if (NET.peer) { try { NET.peer.destroy(); } catch (e) { /* already destroyed */ } } if (NET.relay) NET.relay.close(); if (NET.relayConn) NET.relayConn.close(); });
  netRender();
  if (!netCan()) {
    netStatus(_t('Online mode unavailable. The network library could not be loaded. Reload the page.'));
    return;
  }
  const code = new URLSearchParams(location.search).get('lobby');
  if (code) { $('netCodeIn').value = code.toUpperCase().slice(0, 5); netStatus(_t('Invitation to lobby {0}. Connecting as soon as loading finishes.', $('netCodeIn').value)); }
  else netStatus(netHello());
}
/* Invitation link: we join the lobby once the game is loaded (loading blocks the page at times) */
function netAutoJoin() {
  const code = new URLSearchParams(location.search).get('lobby') || pwaLobby(); // or the invitation received in the browser, opened here in the app (09r-pwa.js)
  if (code && netCan() && NET.role === 'off') acctWhenReady(() => { if (NET.role === 'off') { netJoinCode(code); if (acctOnlineOk()) uiGo('multi'); } });
}
