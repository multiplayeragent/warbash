/* War Bash room relay: Multiplayer Agent authoritative logic for every game room (room names "wb-<CODE>").
   Deployed with deploy_room_logic (see mp/README.md). The game itself stays host-centric, as in the upstream project: one
   player hosts the room (lobby, bots, match clock) and the others are guests. This logic only routes frames between them, the
   way a relay server would, and enforces the room rules no client can be trusted with: one host at a time, 8 players at
   most, kicked players stay out, a reconnecting player gets back the same identity only with the same key.

   Client -> server events
     hello { r: 'host' | 'guest', id, k, v, c } introduce this connection (role, game id, page key, protocol version, room code:
                                                the host sets it, a guest must give the same one, so the code doubles as a password)
     m     { to?: [ids], d? | c?, p? }          a game message (d) or one chunk of a long one (c: { k, i, n, s });
                                                from a guest: to the host, or to everyone when p (state, fanned out here);
                                                from the host: to the listed guests, or to every guest when `to` is absent
     bye   {}                                   leaving on purpose (the others learn it at once)
     kick  { id }  ban { id }                   host only
   Server -> client events
     sync { ids }        (host) the guests present, sent when the host (re)joins
     join { id }  leave { id }                  (host) a guest arrived or left
     host { up }         (guest) the host is present (1) or gone (0)
     refuse { code }     4002 full, 4003 kicked, 4004 no such room, 4005 version, 4010 identity taken, 4011 host taken
     m { f, d | c, x? }  a game message from f; x: a guest's state fanned out to the room */
var MAX_PLAYERS = 8;
var PROTOS = { 10: 1, 11: 1 }; // protocol versions served (NET_PROTO in src/09c-net.js); the host also turns away a guest on another version
var S = { host: '', hostKey: '', hostGoneAt: -1e9, code: '', sess: {}, ids: {}, keys: {}, banned: {} };
var GRACE = 45; // seconds a departed host keeps the room (its guests wait for it)
var clock = 0;

function guests() { var out = []; for (var sid in S.sess) if (S.sess[sid].r === 'guest') out.push(S.sess[sid]); return out; }
function sidOf(id) { return S.ids[id] || ''; }
function str(x, n) { return typeof x === 'string' ? x.slice(0, n) : ''; }

function onJoin(sid) { /* nothing until the client says hello */ }

function onLeave(sid) {
  var s = S.sess[sid]; if (!s) return;
  delete S.sess[sid];
  if (S.ids[s.id] !== sid) return; // this identity already moved to a newer connection
  delete S.ids[s.id];
  if (s.r === 'host') {
    S.host = ''; S.hostGoneAt = clock;
    var g = guests(); for (var i = 0; i < g.length; i++) emitTo(g[i].sid, 'host', { up: 0 });
  } else if (S.host) emitTo(S.host, 'leave', { id: s.id });
  state.shared.n = Object.keys(S.sess).length;
}

function hello(sid, d) {
  var r = d.r === 'host' ? 'host' : 'guest', id = str(d.id, 40), k = str(d.k, 48), c = str(d.c, 8);
  if (!id || !k) return emitTo(sid, 'refuse', { code: 4001 });
  if (!PROTOS[d.v]) return emitTo(sid, 'refuse', { code: 4005 });
  var old = S.sess[sid]; if (old) return; // one hello per connection
  if (r === 'host') {
    var same = S.hostKey === k;
    if (!same && (S.host || clock - S.hostGoneAt < GRACE)) return emitTo(sid, 'refuse', { code: 4011 }); // taken, or kept for its host
    if (S.host && S.host !== sid) { var prev = S.sess[S.host]; if (prev) delete S.sess[S.host]; } // the same host on a new connection
    if (!same) { // a new room in this slot: whoever still waits here belonged to the previous one
      var old = guests(); for (var o = 0; o < old.length; o++) { emitTo(old[o].sid, 'refuse', { code: 4004 }); delete S.sess[old[o].sid]; delete S.ids[old[o].id]; }
      S.banned = {}; S.keys = {};
    }
    S.host = sid; S.hostKey = k; S.code = c; S.ids[id] = sid;
    S.sess[sid] = { sid: sid, r: 'host', id: id, k: k };
    var g = guests(), ids = [];
    for (var i = 0; i < g.length; i++) { ids.push(g[i].id); emitTo(g[i].sid, 'host', { up: 1 }); }
    emitTo(sid, 'sync', { ids: ids });
  } else {
    if (!S.code || c !== S.code) return emitTo(sid, 'refuse', { code: 4004 });
    if (S.banned[k]) return emitTo(sid, 'refuse', { code: 4003 });
    var cur = sidOf(id);
    if (cur && S.keys[id] !== k) return emitTo(sid, 'refuse', { code: 4010 });
    if (!cur && guests().length >= MAX_PLAYERS - 1) return emitTo(sid, 'refuse', { code: 4002 });
    if (!S.host && clock - S.hostGoneAt >= GRACE) return emitTo(sid, 'refuse', { code: 4004 });
    if (cur) { delete S.sess[cur]; if (S.host) emitTo(S.host, 'leave', { id: id }); } // reconnecting: the old connection is retired
    S.sess[sid] = { sid: sid, r: 'guest', id: id, k: k };
    S.ids[id] = sid; S.keys[id] = k;
    if (S.host) { emitTo(S.host, 'join', { id: id }); emitTo(sid, 'host', { up: 1 }); }
    else emitTo(sid, 'host', { up: 0 });
  }
  state.shared.n = Object.keys(S.sess).length;
}

function onEvent(sid, type, d) {
  if (!d || typeof d !== 'object') d = {};
  if (type === 'hello') return hello(sid, d);
  var s = S.sess[sid]; if (!s) return;
  if (type === 'm') {
    var out = { f: s.id };
    if (d.c && typeof d.c === 'object') out.c = d.c; else out.d = d.d;
    if (s.r === 'guest') {
      if (d.p) { out.x = 1; emit('m', out); return; } // a guest's state: to everyone (the host applies it, the guests show it)
      if (S.host) emitTo(S.host, 'm', out);
      return;
    }
    if (Array.isArray(d.to)) { for (var i = 0; i < d.to.length && i < 16; i++) { var t = sidOf(d.to[i]); if (t && t !== sid) emitTo(t, 'm', out); } }
    else { var g = guests(); for (var j = 0; j < g.length; j++) emitTo(g[j].sid, 'm', out); }
    return;
  }
  if (type === 'bye') { // leaving on purpose: tell the others now instead of after the reconnection hold
    delete S.sess[sid];
    if (S.ids[s.id] === sid) delete S.ids[s.id];
    if (s.r === 'host') { S.host = ''; S.hostKey = ''; S.hostGoneAt = -1e9; var gg = guests(); for (var b = 0; b < gg.length; b++) emitTo(gg[b].sid, 'refuse', { code: 4004 }); }
    else if (S.host) emitTo(S.host, 'leave', { id: s.id, bye: 1 });
    state.shared.n = Object.keys(S.sess).length;
    return;
  }
  if (s.r !== 'host') return;
  if (type === 'kick' || type === 'ban') {
    var who = sidOf(str(d.id, 40)), gs = S.sess[who];
    if (!gs || gs.r !== 'guest') return;
    if (type === 'ban') S.banned[gs.k] = 1;
    emitTo(who, 'refuse', { code: 4003 });
  }
}

function onTick(dt) { clock += dt; }
