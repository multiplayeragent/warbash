/* ==========================================================================
   SERVEUR DE JEU (transport des salons en ligne)
   Tout passe par le serveur de jeu : le navigateur de chaque joueur ouvre une seule connexion (WebSocket, HTTPS) vers la salle du
   serveur qui porte son salon, et la logique de cette salle (mp/room-relay.js) fait suivre les messages entre l'hôte et ses invités,
   comme le faisait le relais du projet d'origine. La logique du jeu ne change pas : les connexions imitent l'interface d'une
   connexion de données (send, close, on('open' | 'data' | 'close' | 'hostdown' | 'rehost'), open, peer, code).
   - Salles : une réserve fixe (la logique d'une salle se déploie sous son nom exact) ; le premier caractère du code d'un salon nomme
     sa salle (netrRoom), le reste sert de mot de passe, vérifié par le serveur. Lettres : salons privés ; chiffres : les parties
     publiques de « Jouer maintenant », aux codes fixes 2BASH à 9BASH (NETR_PUB).
   - Limites du serveur : 2048 caractères par message (un message plus long part en morceaux, recollés à l'arrivée) et 60 messages
     par seconde et par joueur (budget à jetons : un état publié, renvoyé sans cesse, saute son tour plutôt que d'attendre ; les
     autres messages attendent leur tour, dans l'ordre).
   - L'état publié par un invité (« p ») est diffusé à toute la salle par le serveur lui-même (et non plus relayé par l'hôte) :
     l'hôte n'envoie pas un message par invité et par état, il resterait sous la limite des 60 messages par seconde.
   - Reconnexion : le serveur garde la place d'un joueur coupé une trentaine de secondes et la connexion reprend d'elle-même ; au-delà,
     elle se ferme (code 1006) et le jeu suit son chemin habituel (reprise de la partie, ou départ).
   Configuration : window.MP_CONFIG (mp.config.js, et la vraie clé dans mp.config.local.js, hors dépôt) et le module du serveur
   (window.MP), chargés par la page avant le jeu. Sans eux (page ouverte depuis un fichier, clé absente) : pas de mode en ligne.
   ========================================================================== */
const NETR = { openTimeout: 10000, hostGrace: 15000, srvGrace: 45000, dead: 35000, relink: 90000, retry: [300, 1000, 2000, 4000, 8000], gkey: '', rate: 50, burst: 90, part: 1500, room: 'wb-' };
const NETR_PUB = '23456789', NETR_PUB_TAIL = 'BASH'; // parties publiques : 2BASH ... 9BASH

function netrCfg() {
  const c = window.MP_CONFIG;
  return c && typeof c.key === 'string' && /^pk_(live|test)_[A-Za-z0-9]{16,}$/.test(c.key) && typeof c.endpoint === 'string' ? c : null;
}
/* Le mode en ligne est-il disponible ? (module du serveur chargé, clé configurée) ; 'mpa' : valeur non vide, comme l'ancienne adresse du relais */
function netrUrl() { return window.MP && typeof window.MP.join === 'function' && netrCfg() ? 'mpa' : ''; }
function netViaServer() { return !!netrUrl(); }
function netRelayOnly() { return !!netrUrl(); }
function netrRandom(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); let s = ''; for (const v of a) s += NET_ABC[v % NET_ABC.length].toLowerCase(); return s; }
function netrRoom(code) { return NETR.room + String(code).charAt(0); }
function netrPubCodes() { return [...NETR_PUB].map((d) => d + NETR_PUB_TAIL); }
function netrIsPub(code) { return NETR_PUB.includes(String(code).charAt(0)); }
/* Messages qu'on peut laisser tomber quand le budget est épuisé : ils sont renvoyés au prochain tour (état publié, battement) */
function netrSoft(m) { return !!m && (m.t === 'p' || m.t === 'ps' || m.t === 'ping'); }

/* Une connexion à une salle du serveur : présentation, envoi à budget et en morceaux, réception recollée.
   onEv(type, data) reçoit les messages du serveur (sync, join, leave, host, refuse, m) ; onLink('drop' | 'back' | 'dead') suit la liaison. */
class NetrLink {
  constructor(code, hello, onEv, onLink) {
    this.code = code; this.hello = hello; this.onEv = onEv; this.onLink = onLink;
    this.mp = null; this.closed = false; this.tok = NETR.burst; this.tT = performance.now(); this.q = []; this.qT = 0; this.k = 0; this.parts = new Map(); this.deadT = 0;
  }
  async open() {
    const c = netrCfg();
    let mp;
    try { mp = await window.MP.join({ key: c.key, room: netrRoom(this.code), endpoint: c.endpoint, apiUrl: c.apiUrl }); } catch (e) { if (!this.closed) this.onLink('dead', 1006); return; }
    if (this.closed) { try { mp.leave(); } catch (e) { /* déjà partie */ } return; }
    this.mp = mp;
    for (const ev of ['sync', 'join', 'leave', 'host', 'refuse']) mp.on(ev, (d, from) => { if (from === 'server' && !this.closed) this.onEv(ev, d || {}); });
    mp.on('m', (d, from) => { if (from === 'server' && !this.closed && d && typeof d.f === 'string') this.recv(d); });
    mp.onDisconnect(() => { if (this.closed) return; this.onLink('drop'); clearTimeout(this.deadT); this.deadT = setTimeout(() => { if (!this.closed) { this.close(); this.onLink('dead', 1006); } }, NETR.dead); });
    mp.onReconnect(() => { clearTimeout(this.deadT); if (!this.closed) this.onLink('back'); });
    try { mp.send('hello', this.hello); } catch (e) { /* la liaison retombe d'elle-même */ }
  }
  /* Un message reçu, entier ou en morceaux (c : { k, i, n, s }) ; renvoie l'objet complet à onEv('m', { f, d, x }) */
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
  /* Budget : jetons rendus à NETR.rate par seconde, jusqu'à NETR.burst */
  refill() { const now = performance.now(); this.tok = Math.min(NETR.burst, this.tok + (now - this.tT) * NETR.rate / 1000); this.tT = now; }
  /* Envoi d'un message du jeu (m) ; extra : { to: [ids] } (hôte) ou { p: 1 } (état d'un invité, diffusé par le serveur) */
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
    if (netrSoft(m)) return; // état renvoyé au prochain tour : inutile d'attendre
    this.q.push(...frames.map((f) => ['m', f])); this.pump();
  }
  /* Messages de commande (kick, ban), qui passent par le même budget */
  event(type, data) { if (this.closed || !this.mp) return; this.q.push([type, data]); this.pump(); }
  pump() {
    this.refill();
    while (this.q.length && this.tok >= 1) { const [t, f] = this.q.shift(); this.tok -= 1; this.raw(t, f); }
    if (this.q.length > 600) this.q.splice(0, this.q.length - 600); // liaison saturée : on ne garde que le plus récent
    if (this.q.length && !this.qT) this.qT = setTimeout(() => { this.qT = 0; this.pump(); }, 40);
  }
  raw(type, data) { try { this.mp.send(type, data); } catch (e) { /* liaison en cours de reprise */ } }
  /* Départ voulu : le serveur le dit tout de suite aux autres (sans « bye », un départ ressemble à une coupure, gardée 25 s) */
  bye() { if (!this.closed && this.mp) this.raw('bye', {}); this.close(); }
  close() {
    if (this.closed) return;
    this.closed = true; clearTimeout(this.deadT); clearTimeout(this.qT); this.q.length = 0;
    const mp = this.mp; this.mp = null;
    if (mp) { try { mp.leave(); } catch (e) { /* déjà partie */ } }
  }
}

/* Connexion vue du jeu : même interface que la connexion de données d'origine. send prend l'objet du message (tx l'emballe). */
class RelayConn {
  constructor(peer, tx, end) { this.peer = peer; this.open = false; this.relay = true; this.done = false; this.code = 0; this.ls = {}; this.tx = tx; this.end = end; }
  on(e, f) { (this.ls[e] || (this.ls[e] = [])).push(f); return this; }
  emit(e, a) { for (const f of this.ls[e] || []) { try { f(a); } catch (err) { console.error(err); } } }
  send(m) { if (this.open && !this.done) this.tx(m); }
  close() { if (!this.done && this.end) this.end(); this.finish(); }
  finish() { this.open = false; if (this.done) return; this.done = true; this.emit('close'); }
}

/* Invité : se connecte au salon. La connexion est « ouverte » quand le serveur annonce l'hôte présent. */
function netrJoin(code, id) {
  let grace = 0, guard = 0, link = null;
  const c = new RelayConn(NET_PREFIX + code, (m) => link && link.send(m, m.t === 'p' ? { p: 1 } : undefined), () => link && link.bye());
  const gk = NETR.gkey || (NETR.gkey = netrRandom(24)); // clé d'invité, la même pour toute la page : le serveur ne rend l'identifiant qu'à elle
  const stop = () => { clearTimeout(grace); clearTimeout(guard); };
  const end = (code2) => { stop(); if (!c.code) c.code = code2 || 1006; if (link) link.close(); c.finish(); };
  guard = setTimeout(() => { if (!c.open) end(1006); }, NETR.openTimeout);
  /* Liaison perdue après l'entrée dans le salon (page longtemps bloquée par la construction de la carte, réseau qui cale au-delà de la
     reprise du serveur) : une nouvelle liaison, même identifiant et même clé (le serveur la rend), puis « rehost » : le jeu se présente de
     nouveau à l'hôte, qui lui rend sa place (netHostMsg, joueur absent qui revient). Abandon au bout de NETR.relink ms. */
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
      else if (c.open) { c.down = true; c.emit('hostdown'); grace = setTimeout(() => end(4004), c.grace || NETR.hostGrace); } // l'hôte a peut-être seulement changé de connexion
      else { clearTimeout(guard); guard = setTimeout(() => { if (!c.open) end(4004); }, c.grace || NETR.hostGrace); } // salon dont l'hôte revient peut-être
    } else if (ev === 'refuse') end(Number(d.code) || 4001);
    else if (ev === 'm') {
      if (d.f === id || !c.open) return;
      if (d.x) { if (d.d && d.d.t === 'p') c.emit('data', { t: 'ps', l: [[d.f, d.d.p]] }); return; } // état d'un autre invité, diffusé par le serveur
      c.emit('data', d.d);
    }
  }, (st, code2) => { if (st === 'dead') { if (c.open) relink(); else end(code2); } });
  link = mk(); link.open();
  return c;
}

/* Hôte : tient le salon ouvert et présente chaque invité comme une connexion. onConn(conn) pour chaque nouvel invité ;
   onState('up' | 'down' | 'fail' | 'taken', détail) suit la liaison. fanout : le serveur diffuse lui-même l'état des invités. */
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
      else if (ev === 'leave') { const c = this.conns.get(d.id); if (c && d.bye) c.bye = true; this.leave(d.id); } // bye : parti de lui-même (pas une coupure)
      else if (ev === 'refuse') {
        this.closed = true; link.close();
        if (Number(d.code) === 4011) this.onState('taken'); else this.onState('fail', _t('salon refusé'));
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
  /* Liaison perdue : nouvel essai avec délai croissant, sans limite (le salon peut revenir tant que l'onglet vit) */
  lost() {
    if (this.closed) return;
    clearTimeout(this.guard);
    this.fails++;
    if (this.everUp) this.onState('down'); else if (this.fails === 3) this.onState('fail', _t('serveur injoignable'));
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
  pub() { /* plus de liste des parties publiques : « Jouer maintenant » essaie les salles publiques une à une */ }
  kick(id) { this.conns.delete(id); if (this.link) this.link.event('kick', { id }); }
  ban(id) { if (this.link) this.link.event('ban', { id }); }
  sendTo(id, m) { if (this.link) this.link.send(m, { to: [id] }); }
  /* Un seul envoi pour plusieurs invités : le serveur fait la distribution */
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
