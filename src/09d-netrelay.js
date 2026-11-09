/* ==========================================================================
   GAME SERVER (online lobby transport)
   Everything goes through the game server: each player's browser opens a single connection (WebSocket, HTTPS) to the server room
   that carries their lobby, and that room's logic (mp/room-relay.js) forwards messages between the host and its guests,
   as the original project's relay did. The game logic doesn't change: connections imitate the interface of a
   data connection (send, close, on('open' | 'data' | 'close' | 'hostdown' | 'rehost'), open, peer, code).
   - Rooms: a fixed pool (a room's logic is deployed under its exact name); the first character of a lobby's code names
     its room (netrRoom), the rest serves as a password, checked by the server. Letters: private lobbies; digits: the public
     matches of "Play now", with fixed codes 2BASH to 9BASH (NETR_PUB).
   - Server limits: 2048 characters per message (a longer message is split into pieces, glued back together on arrival) and 60 messages
     per second per player (token budget: a published state, constantly resent, skips its turn rather than waiting; other
     messages wait their turn, in order).
   - A guest's published state ("p") is broadcast to the whole room by the server itself (and no longer relayed by the host):
     the host doesn't send one message per guest per state, it would stay under the limit of 60 messages per second.
   - Reconnection: the server keeps a cut-off player's spot for about thirty seconds and the connection resumes by itself; beyond that,
     it closes (code 1006) and the game takes its usual course (match takeover, or departure).
   Configuration: window.MP_CONFIG (mp.config.js, and the real key in mp.config.local.js, outside the repo) and the server module
   (window.MP), loaded by the page before the game. Without them (page opened from a file, key missing): no online mode.
   ========================================================================== */
const NETR = { openTimeout: 10000, hostGrace: 15000, srvGrace: 45000, dead: 35000, relink: 90000, retry: [300, 1000, 2000, 4000, 8000], gkey: '', rate: 50, burst: 90, part: 1500, room: 'wb-' };
const NETR_PUB = '23456789', NETR_PUB_TAIL = 'BASH'; // public matches: 2BASH ... 9BASH

function netrCfg() {
  const c = window.MP_CONFIG;
  return c && typeof c.key === 'string' && /^pk_(live|test)_[A-Za-z0-9]{16,}$/.test(c.key) && typeof c.endpoint === 'string' ? c : null;
}
/* Is online mode available? (server module loaded, key configured); 'mpa': non-empty value, like the old relay address */
function netrUrl() { return window.MP && typeof window.MP.join === 'function' && netrCfg() ? 'mpa' : ''; }
function netViaServer() { return !!netrUrl(); }
function netRelayOnly() { return !!netrUrl(); }
function netrRandom(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); let s = ''; for (const v of a) s += NET_ABC[v % NET_ABC.length].toLowerCase(); return s; }
function netrRoom(code) { return NETR.room + String(code).charAt(0); }
function netrPubCodes() { return [...NETR_PUB].map((d) => d + NETR_PUB_TAIL); }
function netrIsPub(code) { return NETR_PUB.includes(String(code).charAt(0)); }
/* Messages that can be dropped when the budget is exhausted: they are resent on the next turn (published state, heartbeat) */
function netrSoft(m) { return !!m && (m.t === 'p' || m.t === 'ps' || m.t === 'ping'); }

/* A connection to a server room: introduction, budgeted and chunked sending, reassembled reception.
   onEv(type, data) receives the server's messages (sync, join, leave, host, refuse, m); onLink('drop' | 'back' | 'dead') tracks the link. */
class NetrLink {
  constructor(code, hello, onEv, onLink) {
    this.code = code; this.hello = hello; this.onEv = onEv; this.onLink = onLink;
    this.mp = null; this.closed = false; this.tok = NETR.burst; this.tT = performance.now(); this.q = []; this.qT = 0; this.k = 0; this.parts = new Map(); this.deadT = 0;
  }
  async open() {
    const c = netrCfg();
    let mp;
    try { mp = await window.MP.join({ key: c.key, room: netrRoom(this.code), endpoint: c.endpoint, apiUrl: c.apiUrl }); } catch (e) { if (!this.closed) this.onLink('dead', 1006); return; }
    if (this.closed) { try { mp.leave(); } catch (e) { /* already gone */ } return; }
    this.mp = mp;
    for (const ev of ['sync', 'join', 'leave', 'host', 'refuse']) mp.on(ev, (d, from) => { if (from === 'server' && !this.closed) this.onEv(ev, d || {}); });
    mp.on('m', (d, from) => { if (from === 'server' && !this.closed && d && typeof d.f === 'string') this.recv(d); });
    mp.onDisconnect(() => { if (this.closed) return; this.onLink('drop'); clearTimeout(this.deadT); this.deadT = setTimeout(() => { if (!this.closed) { this.close(); this.onLink('dead', 1006); } }, NETR.dead); });
    mp.onReconnect(() => { clearTimeout(this.deadT); if (!this.closed) this.onLink('back'); });
    try { mp.send('hello', this.hello); } catch (e) { /* the link recovers by itself */ }
  }
  /* A message received, whole or in pieces (c: { k, i, n, s }); returns the complete object to onEv('m', { f, d, x }) */
  recv(d) {
    if (!d.c) { this.onEv('m', d); return; }
    const c = d.c, key = d.f + '/' + c.k;
    if (!(c.n > 1 && c.n <= 64 && c.i >= 0 && c.i < c.n && typeof c.s === 'string')) return;
    let p = this.parts.get(key);
    if (!p) { p = { n: c.n, got: 0, s: [], t: performance.now() }; this.parts.set(key, p); }
    if (p.s[c.i] === undefined) { p.s[c.i] = c.s; p.got++; }
    if (p.got < p.n) { if (this.parts.size > 32) { const old = performance.now() - 5000; for (const [k2, v] of this.parts) if (v.t < old) this.parts.delete(k2); } return; }
    this.parts.delete(key);
    let m; try { m = JSON.parse(p.s.join('')); } catch (e) { return; }
    this.onEv('m', { f: d.f, d: m, x: d.x });
  }
  /* Budget: tokens restored at NETR.rate per second, up to NETR.burst */
  refill() { const now = performance.now(); this.tok = Math.min(NETR.burst, this.tok + (now - this.tT) * NETR.rate / 1000); this.tT = now; }
  /* Sending a game message (m); extra: { to: [ids] } (host) or { p: 1 } (a guest's state, broadcast by the server) */
  send(m, extra) {
    if (this.closed || !this.mp) return;
    const s = JSON.stringify(m), frames = [];
    if (s.length <= 1800) frames.push(Object.assign({}, extra, { d: m }));
    else {
      const k = ++this.k, parts = [];
      for (let i = 0; i < s.length;) { let n = NETR.part; while (n > 200 && JSON.stringify(s.slice(i, i + n)).length > 1800) n = Math.floor(n * 0.8); parts.push(s.slice(i, i + n)); i += n; }
      parts.forEach((part, i) => frames.push(Object.assign({}, extra, { c: { k, i, n: parts.length, s: part } })));
    }
    this.refill();
    if (!this.q.length && this.tok >= frames.length) { this.tok -= frames.length; for (const f of frames) this.raw('m', f); return; }
    if (netrSoft(m)) return; // state resent on the next turn: no point waiting
    this.q.push(...frames.map((f) => ['m', f])); this.pump();
  }
  /* Command messages (kick, ban), which go through the same budget */
  event(type, data) { if (this.closed || !this.mp) return; this.q.push([type, data]); this.pump(); }
  pump() {
    this.refill();
    while (this.q.length && this.tok >= 1) { const [t, f] = this.q.shift(); this.tok -= 1; this.raw(t, f); }
    if (this.q.length > 600) this.q.splice(0, this.q.length - 600); // saturated link: we only keep the most recent
    if (this.q.length && !this.qT) this.qT = setTimeout(() => { this.qT = 0; this.pump(); }, 40);
  }
  raw(type, data) { try { this.mp.send(type, data); } catch (e) { /* link being resumed */ } }
  /* Intentional departure: the server tells the others right away (without "bye", a departure looks like a cut, kept for 25 s) */
  bye() { if (!this.closed && this.mp) this.raw('bye', {}); this.close(); }
  close() {
    if (this.closed) return;
    this.closed = true; clearTimeout(this.deadT); clearTimeout(this.qT); this.q.length = 0;
    const mp = this.mp; this.mp = null;
    if (mp) { try { mp.leave(); } catch (e) { /* already gone */ } }
  }
}

/* Connection as seen by the game: same interface as the original data connection. send takes the message object (tx wraps it). */
class RelayConn {
  constructor(peer, tx, end) { this.peer = peer; this.open = false; this.relay = true; this.done = false; this.code = 0; this.ls = {}; this.tx = tx; this.end = end; }
  on(e, f) { (this.ls[e] || (this.ls[e] = [])).push(f); return this; }
  emit(e, a) { for (const f of this.ls[e] || []) { try { f(a); } catch (err) { console.error(err); } } }
  send(m) { if (this.open && !this.done) this.tx(m); }
  close() { if (!this.done && this.end) this.end(); this.finish(); }
  finish() { this.open = false; if (this.done) return; this.done = true; this.emit('close'); }
}

/* Guest: connects to the lobby. The connection is "open" when the server announces the host present. */
function netrJoin(code, id) {
  let grace = 0, guard = 0, link = null;
  const c = new RelayConn(NET_PREFIX + code, (m) => link && link.send(m, m.t === 'p' ? { p: 1 } : undefined), () => link && link.bye());
  const gk = NETR.gkey || (NETR.gkey = netrRandom(24)); // guest key, the same for the whole page: the server only returns the identifier to it
  const stop = () => { clearTimeout(grace); clearTimeout(guard); };
  const end = (code2) => { stop(); if (!c.code) c.code = code2 || 1006; if (link) link.close(); c.finish(); };
  guard = setTimeout(() => { if (!c.open) end(1006); }, NETR.openTimeout);
  /* Link lost after entering the lobby (page blocked for a long time by map construction, network stalling beyond the server's
     resume window): a new link, same identifier and same key (the server returns it), then "rehost": the game introduces itself
     again to the host, who gives it its place back (netHostMsg, absent player returning). Give up after NETR.relink ms. */
  let relinkT0 = 0, relinkN = 0;
  const relink = () => {
    if (c.done) return;
    if (!relinkT0) relinkT0 = performance.now();
    if (performance.now() - relinkT0 > NETR.relink) { end(1006); return; }
    if (link) link.close();
    c.down = true; c.relinked = true;
    setTimeout(() => { if (!c.done) { link = mk(); link.open(); } }, NETR.retry[Math.min(relinkN++, NETR.retry.length - 1)]);
  };
  const mk = () => new NetrLink(code, { r: 'guest', id, k: gk, v: NET_PROTO, c: code }, (ev, d) => {
    if (ev === 'host') {
      clearTimeout(grace);
      if (d.up) { relinkT0 = 0; relinkN = 0; if (!c.open && !c.done) { clearTimeout(guard); c.open = true; c.emit('open'); } else if (c.down) c.emit('rehost'); c.down = false; }
      else if (c.open) { c.down = true; c.emit('hostdown'); grace = setTimeout(() => end(4004), c.grace || NETR.hostGrace); } // the host may have only changed connection
      else { clearTimeout(guard); guard = setTimeout(() => { if (!c.open) end(4004); }, c.grace || NETR.hostGrace); } // lobby whose host may be returning
    } else if (ev === 'refuse') end(Number(d.code) || 4001);
    else if (ev === 'm') {
      if (d.f === id || !c.open) return;
      if (d.x) { if (d.d && d.d.t === 'p') c.emit('data', { t: 'ps', l: [[d.f, d.d.p]] }); return; } // another guest's state, broadcast by the server
      c.emit('data', d.d);
    }
  }, (st, code2) => { if (st === 'dead') { if (c.open) relink(); else end(code2); } });
  link = mk(); link.open();
  return c;
}

/* Host: keeps the lobby open and presents each guest as a connection. onConn(conn) for each new guest;
   onState('up' | 'down' | 'fail' | 'taken', detail) tracks the link. fanout: the server itself broadcasts the guests' state. */
class RelayHost {
  constructor(code, onConn, onState, key) {
    this.code = code; this.id = NET_PREFIX + code; this.key = key || netrRandom(24); this.onConn = onConn; this.onState = onState;
    this.conns = new Map(); this.link = null; this.everUp = false; this.closed = false; this.fails = 0; this.timer = 0; this.guard = 0; this.fanout = true;
  }
  start() { this.connect(); }
  connect() {
    if (this.closed) return;
    let up = false;
    const link = new NetrLink(this.code, { r: 'host', id: this.id, k: this.key, v: NET_PROTO, c: this.code }, (ev, d) => {
      if (this.link !== link) return;
      if (ev === 'sync') {
        if (!up) { up = true; this.everUp = true; this.fails = 0; clearTimeout(this.guard); this.onState('up'); }
        const ids = new Set(Array.isArray(d.ids) ? d.ids.filter((x) => typeof x === 'string') : []);
        for (const id of ids) this.join(id);
        for (const id of [...this.conns.keys()]) if (!ids.has(id)) this.leave(id);
      } else if (ev === 'join') this.join(d.id);
      else if (ev === 'leave') { const c = this.conns.get(d.id); if (c && d.bye) c.bye = true; this.leave(d.id); } // bye: left on their own (not a cut)
      else if (ev === 'refuse') {
        this.closed = true; link.close();
        if (Number(d.code) === 4011) this.onState('taken'); else this.onState('fail', _t('lobby refused'));
      } else if (ev === 'm') { const c = this.conns.get(d.f); if (c && d.d && typeof d.d === 'object') c.emit('data', d.d); }
    }, (st) => {
      if (this.link !== link || this.closed) return;
      if (st === 'drop') this.onState('down');
      else if (st === 'back') this.onState('up');
      else if (st === 'dead') this.lost();
    });
    this.link = link;
    this.guard = setTimeout(() => { if (!up && this.link === link) { link.close(); this.lost(); } }, NETR.openTimeout);
    link.open();
  }
  /* Link lost: new attempt with increasing delay, no limit (the lobby may come back as long as the tab lives) */
  lost() {
    if (this.closed) return;
    clearTimeout(this.guard);
    this.fails++;
    if (this.everUp) this.onState('down'); else if (this.fails === 3) this.onState('fail', _t('server unreachable'));
    const wait = NETR.retry[Math.min(this.fails - 1, NETR.retry.length - 1)];
    this.timer = setTimeout(() => this.connect(), wait);
  }
  join(id) {
    if (typeof id !== 'string' || !id || this.conns.has(id)) return;
    const c = new RelayConn(id, (m) => this.sendTo(id, m), () => this.kick(id));
    c.open = true; this.conns.set(id, c);
    this.onConn(c);
    c.emit('open');
  }
  leave(id) { const c = this.conns.get(id); if (c) { this.conns.delete(id); c.finish(); } }
  pub() { /* no more list of public matches: "Play now" tries the public rooms one by one */ }
  kick(id) { this.conns.delete(id); if (this.link) this.link.event('kick', { id }); }
  ban(id) { if (this.link) this.link.event('ban', { id }); }
  sendTo(id, m) { if (this.link) this.link.send(m, { to: [id] }); }
  /* A single send for several guests: the server does the distribution */
  sendMany(ids, m) {
    const ok = ids.filter((id) => { const c = this.conns.get(id); return c && c.open; });
    for (let i = 0; i < ok.length; i += 16) if (this.link) this.link.send(m, { to: ok.slice(i, i + 16) });
  }
  close() {
    this.closed = true; clearTimeout(this.timer); clearTimeout(this.guard);
    if (this.link) this.link.bye();
    for (const c of [...this.conns.values()]) c.finish();
    this.conns.clear();
  }
}
