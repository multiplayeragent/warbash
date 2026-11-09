/* Menus on a phone screen: node tools/dev/visual/menus.js [captures folder]
   For several phone and tablet sizes (iPad, 4:3) in landscape (elongated screens of recent Pixels, older 16:9, browser window with its address
   bar), opens each menu screen and reports:
   - horizontal overflows;
   - for screens with an action panel (Solo, lobby, deployment): the screen does not scroll (only the choice area scrolls), the right
     panel shows all its content and the "Start the match" / "Deploy" button is entirely on screen;
   - overlaps: texts and buttons that overlap (except what is clipped by a scrolling area);
   - the "What's new" window of a major version: opened with its changes, title and buttons entirely on screen (the list scrolls);
   - the results of a match: the title, the timer and the footer buttons entirely on screen (the body scrolls).
   SCREEN_SIZES=1024x768,915x412 and SCREEN_LIST=outfits,pause-class limit the check to these sizes and these screens; KEEP_ALL=1 keeps a capture of every screen (otherwise, only of failures). Exits with an error code on the first failure. */
const { openGame } = require('./common');
const path = require('path');
const out = process.argv[2];
if (out) require('fs').mkdirSync(out, { recursive: true });
const SIZES = [[997, 448], [997, 392], [952, 427], [952, 372], [915, 412], [844, 390], [800, 340], [740, 360], [667, 375], [1024, 768], [1133, 744], [1180, 820], [1366, 1024], [1280, 800]]; // iPad in landscape (1024x768 to 1366x1024), then the Steam Deck (1280x800)
const DECK_ONLY = new Set(['main-steam-deck', 'main-deck-gamepad']); // cards that exist only on Steam Deck (src/09ra-deck.js): checked at its size only (4:3, mini, Air)
/* Community space (src/09z-community.js): simulated messages, seen by a team account (team tools, Reported tab); to call after socMock() */
const COMM_MOCK = `function commMock() {
  const at = (h) => new Date(Date.now() - h * 3600e3).toISOString(), user = (u, n) => ({ username: u, displayName: n, avatar: null });
  const P = (o) => Object.assign({ edited: false, mine: false, votes: 0, voted: false, flagged: false, status: null, reply: null, hidden: false, reports: 0, rating: null }, o);
  const reviews = [
    P({ id: 1, kind: 'review', rating: 5, body: "Great game, the maps are gorgeous and it runs well on my phone.", at: at(2), author: user('Corbeau_7', 'Corbeau 7'), reply: { text: 'Thanks a lot!', at: at(1) } }),
    P({ id: 2, kind: 'review', rating: 4, body: "Very good. Just missing a capture the flag mode.", at: at(30), edited: true, author: user('Tester_1', 'Tester'), mine: true }),
    P({ id: 3, kind: 'review', rating: 3, body: '', at: at(80), author: user('Lynx_Du_Nord', 'Lynx Du Nord'), flagged: true }),
  ];
  const ideas = [
    P({ id: 11, kind: 'idea', body: "A capture the flag mode on the big maps.\\nWith vehicles it would be even better.", at: at(50), author: user('Lynx_Du_Nord', 'Lynx Du Nord'), votes: 42, voted: true, status: 'planned', reply: { text: "It's planned for a future version.", at: at(4) } }),
    P({ id: 12, kind: 'idea', body: "Being able to choose the crosshair color in the options.", at: at(9), author: user('Tester_1', 'Tester'), mine: true, votes: 17 }),
    P({ id: 13, kind: 'idea', body: "Outfits to buy with real money", at: at(3), author: user('Gros_Mot_9', 'Borderline nickname'), votes: 1, hidden: true, reports: 3 }),
  ];
  const bugs = [
    P({ id: 21, kind: 'bug', body: "On Notos, I get stuck against the well when I run toward the mill. Pixel 7, Chrome.", at: at(6), author: user('Soldat_Fantome', 'Soldat Fantome'), votes: 8, status: 'shipped', reply: { text: 'Fixed in version 3.6.0, thanks!', at: at(1) } }),
  ];
  const prev = window.acctApi;
  window.acctApi = async (name, body) => {
    if (name.startsWith('community?')) {
      const q = new URLSearchParams(name.split('?')[1]), k = q.get('view') === 'reported' ? 'reported' : q.get('kind') || 'review';
      const posts = k === 'review' ? reviews : k === 'idea' ? ideas : k === 'bug' ? bugs : ideas.filter((x) => x.hidden);
      return { ok: true, status: 200, data: { kind: k, sort: k === 'review' ? 'new' : q.get('sort') || 'top', posts, more: false, summary: { count: 128, avg: 4.3 }, myReview: { id: 2, rating: 4, body: reviews[1].body }, canReview: true, mod: true, reported: 1 } };
    }
    if (name.startsWith('community')) return { ok: true, status: 200, data: { ok: true } };
    return prev(name, body);
  };
}`;
/* Friends (src/09ta-friends.js): friend list with their presence, received invitation, simulated without the API; to call after socMock(). o.inv: an
   invitation received into a friend's lobby */
const FRIENDS_MOCK = `function friendsMock(o) {
  const f = (u, n, lv, on, st) => ({ username: u, displayName: n, avatar: null, level: lv, online: on, state: on ? st : null });
  const list = [f('Corbeau_7', 'Corbeau 7', 60, true, 'menu'), f('Soldat_Fantome', 'Soldat Fantome', 46, true, 'inProgress'), f('Tigre', 'Tigre', 39, true, 'lobby'), f('Renard_Roux', 'Renard Roux Long', 32, false), f('Hibou', 'Hibou', 5, false), f('Marmotte_Des_Cimes', 'Marmotte Des Cimes', 18, false)];
  const received = [f('Lynx_Du_Nord', 'Lynx Du Nord', 53, false)], sent = [f('Gros_Mot_9', 'Borderline nickname', 12, false)];
  const prev = window.acctApi;
  window.acctApi = async (name, body) => name === 'friends' ? { ok: true, status: 200, data: { friends: list, received, sent } } : name === 'presence' || name === 'invite-answer' || name === 'lobby-invite' ? { ok: true, status: 200, data: { unread: 2, invites: FRIENDS.inv } } : prev(name, body);
  Object.assign(FRIENDS, { list, received, out: sent, loading: false, err: '', note: '', at: Date.now(), last: Date.now(), sent: { corbeau_7: netCodeNow() }, gone: new Set(),
    inv: o.inv ? [{ id: 9, code: 'K7QX2', at: new Date().toISOString(), from: { username: 'Tigre', displayName: 'Tigre' } }] : [] });
  friendsInviteCard();
}`;
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL  :', m); } else console.log('ok    :', m); };

const SOC_MOCK = "/* Signed-in account and simulated server responses for the social screens (leaderboard, a player's profile, notifications) */\nfunction socMock() {\n  const names = ['Corbeau_7', 'Lynx_Du_Nord', 'Soldat_Fantome', 'Tigre', 'Renard_Roux', 'Hibou'];\n  const rel = ['friend', 'received', 'none', 'sent', 'none', 'none'];\n  const players = names.map((n, i) => ({ rank: i + 1, username: n, displayName: n.replace(/_/g, ' ').slice(0, 16), level: 60 - i * 7, xp: 90000 - i * 9000, wins: 120 - i * 15, matches: 200, kd: 2.4 - i * 0.3, points: 90000 - i * 9000, relation: rel[i] }));\n  players.splice(3, 0, { rank: 4, username: 'Tester_1', displayName: 'Tester', level: 22, xp: 20000, wins: 30, matches: 80, kd: 1.12, points: 20000, relation: 'me' });\n  const stats = { matches: 200, wins: 120, losses: 70, kills: 2400, deaths: 1000, assists: 300, headshots: 500, shots: 20000, hits: 8000, seconds: 90000, bestStreak: 17 };\n  const recent = [{ played_at: new Date().toISOString(), map: 'chergui', mode: 'tdm', online: true, result: 'win', kills: 18, deaths: 6 }, { played_at: new Date().toISOString(), map: 'chergui', mode: 'ffa', online: false, result: 'loss', kills: 9, deaths: 12 }];\n  const modAccounts = [\n    { username: 'Gros_Mot_9', displayName: 'Borderline nickname', createdAt: '2026-10-01T10:00:00Z', blockedAt: null, avatar: null, avatarHidden: true, level: 12, stats: { xp: 52000, matches: 40, kills: 900, deaths: 60 }, removed: false, reasons: { photo: 3, naming: 2, cheating: 4 }, notes: [{ reason: 'cheating', note: 'He kills everyone through the walls since the start of the match.', at: new Date().toISOString(), by: 'Corbeau_7' }, { reason: 'naming', note: 'Insulting nickname', at: new Date().toISOString(), by: 'Lynx_Du_Nord' }], last: new Date().toISOString() },\n    { username: 'Renard_Roux', displayName: 'Renard Roux', createdAt: '2026-09-12T10:00:00Z', blockedAt: null, avatar: null, avatarHidden: false, level: 32, stats: { xp: 41000, matches: 200, kills: 2400, deaths: 2000 }, removed: false, reasons: { behavior: 1 }, notes: [], last: new Date().toISOString() },\n  ];\n  const items = [\n    { id: 4, kind: 'friend_request', data: null, at: new Date().toISOString(), read: false, from: { username: 'Lynx_Du_Nord', displayName: 'Lynx Du Nord' }, pending: true },\n    { id: 3, kind: 'levelup', data: { level: 22 }, at: new Date(Date.now() - 3600e3).toISOString(), read: false, from: null, pending: false },\n    { id: 2, kind: 'friend_accepted', data: null, at: new Date(Date.now() - 86400e3).toISOString(), read: true, from: { username: 'Corbeau_7', displayName: 'Corbeau 7' }, pending: false },\n    { id: 1, kind: 'welcome', data: null, at: new Date(Date.now() - 5 * 86400e3).toISOString(), read: true, from: null, pending: false },\n  ];\n  ACCT.state = 'ready'; ACCT.user = { username: 'Tester_1', displayName: 'Tester', avatar: null, hasPassword: true, hasRecovery: true, moderator: true, modOpen: 2 }; ACCT.code = ''; ACCT.level = { level: 22, xp: 20000, into: 100, need: 1000, next: 21000 }; ACCT.stats = stats; ACCT.recent = [];\n  window.acctApi = async (name) => {\n    if (name.startsWith('leaderboard')) return { ok: true, status: 200, data: { players, more: true, me: { rank: 4, total: 1280 } } };\n    if (name.startsWith('player')) return { ok: true, status: 200, data: { user: { username: 'Corbeau_7', displayName: 'Corbeau 7', createdAt: '2026-08-01T10:00:00Z' }, level: { level: 60, xp: 90000, into: 400, need: 1000, next: 91000 }, rank: 1, stats, recent, relation: 'received' } };\n    if (name.startsWith('notifications')) return { ok: true, status: 200, data: { unread: 2, items } };\n    if (name === 'me') return { ok: true, status: 200, data: { user: ACCT.user, level: ACCT.level, stats, recent: [] } };\n    if (name.startsWith('mod-list')) return { ok: true, status: 200, data: { open: 2, accounts: name.includes('blocked') ? [] : modAccounts } };\n    if (name === 'report') return { ok: true, status: 200, data: { ok: true } };\n    return { ok: true, status: 200, data: {} };\n  };\n  SOC.notifs = { items: [], unread: 2, loaded: false, busy: false, fresh: new Set() }; socChanged(); socBadge();\n}\n";

/* Run in the page: simulated lobby (role, open submenu: '', 'setup', 'map', 'chat', 'player', 'leave') */
function netMock(role, pane) {
  uiOpen('multi', ['main']);
  Object.assign(NET, { role, joined: true, code: 'AB12C', me: 'me', phase: 'lobby', pane, t0: performance.now(), hostSeen: performance.now() + 1e6 }); // the network heartbeat must not declare the host lost during the capture
  NET.players.clear();
  for (const [id, n, t, h, lv] of [['me', 'Soldier', 0, 1, 12], ['f', 'Fantôme', 0, 0, 34], ['c', 'Corbeau', 0, 0, 7], ['t', 'Tiger', 1, 0, 55], ['r', 'Renard', 1, 0, 100], ['l', 'Lynx', 1, 0, 3]]) NET.players.set(id, { id, n, t, h: !!h, lv, ig: id === 'c', ld: id === 'c' ? 40 : 0, r: id === 'r' });
  CHAT.log.length = 0; for (const x of ['Hi', 'Do we start when everyone is here?', 'Yes, one moment']) CHAT.log.push({ n: 'Fantôme', t: 0, x, at: performance.now() });
  CHAT.unread = 2; netRender(); chatRender(); chatUnread();
  if (pane === 'player') lmPush(LM.scr.multi, 'player', 'f'); else if (pane === 'leave') netLeaveAsk(); else if (pane) lmPush(LM.scr.multi, pane); // a lobby submenu, opened to the right of the menu
  document.getElementById('netLink').value = 'https://example.com/?lobby=AB12C';
}

/* Run in the page: simulated server lobbies (src/09cb-servers.js); ph: lobby phase ('': the home with their list), pane:
   open submenu ('create', 'chat', 'srvp', 'srvsetup', 'srvmap', 'invite'); perso: lobby created ('leader': seen by its leader, 'member': by another
   player); the server connection and entering the match are cut */
function srvMock(ph, pane, perso) {
  NET.role = 'off'; NETP.err = false; NETP.playerCount = 23; NETP.at = Date.now() + 1e9;
  SRV.list = [['tdm1', 'tdm', 1, 'notos', 6, 'inProgress'], ['tdm2', 'tdm', 2, 'chergui', 3, 'countingDown'], ['tdm3', 'tdm', 3, 'saintgivre', 0, 'waiting'], ['ffa1', 'ffa', 1, 'cirrus', 2, 'waiting'],
    ['ffa2', 'ffa', 2, 'scoria', 8, 'inProgress'], ['dom1', 'dom', 1, 'portmael', 4, 'countingDown'], ['dom2', 'dom', 2, 'floralia', 0, 'waiting']].map(([i, o, k, m, j, p]) => ({ i, o, k, m, j, x: 8, p }));
  SRV.created = [['K7QX2', 'saintgivre', 'tdm', 5, 'inProgress', 'Lynx Du Nord', false], ['', 'floralia', 'dom', 3, 'waiting', 'Corbeau 7', true], ['P4RTY', 'chergui', 'ffa', 1, 'waiting', 'Renard_Roux_Long', false]].map(([i, m, o, j, p, n, pv]) => ({ i, m, o, j, x: 8, p, n, pv }));
  const id = perso ? 'AB12C' : 'tdm2';
  Object.assign(SRV, { on: !!ph, id, ws: null, up: true, at: performance.now(), tried: 'XY34Z', triedT: performance.now() + 1e9, voteKey: '', kickAsk: '' });
  SRV.st = ph ? { o: 'tdm', k: perso ? 0 : 2, i: id, ps: !!perso, own: perso === 'leader' ? 'me' : 'f', cfg: perso ? { bots: 1, diff: 1, limit: 50, time: 10, pub: 0 } : { bots: 1, diff: 1, limit: 75, time: 10, pub: 1 },
    ph, m: ph === 'inProgress' || perso ? 'chergui' : 'notos', c: perso ? null : ['notos', 'cirrus'], vt: [2, 1], mv: 0, vo: !perso && (ph === 'waiting' || ph === 'countingDown'), r: 25000, s: 4, x: 8, me: 'me', code: ph === 'inProgress' ? 'XY34Z' : '', hosting: ph === 'inProgress' ? 'f' : '',
    j: [['me', 'Soldier', 12, 0], ['f', 'Fantôme', 34, 0], ['c', 'Corbeau', 7, 1], ['t', 'Tigre_Du_Bengale', 55, 1], ['r', 'Renard', 100, 0]].slice(0, ph === 'waiting' && !perso ? 2 : 5).map(([pid, n, lv, t]) => ({ id: pid, n, lv, t })) } : null;
  CHAT.log.length = 0; if (ph) for (const x of ['Hi', 'Vote Notos!']) CHAT.log.push({ n: 'Fantôme', t: 0, x, at: performance.now() });
  uiOpen('multi', ['main']); netRender({ fresh: true }); chatRender();
  if (pane === 'srvp') lmPush(LM.scr.multi, 'srvp', 'f'); else if (pane) lmPush(LM.scr.multi, pane);
  document.getElementById('netLink').value = 'https://example.com/?lobby=AB12C';
}

/* Run in the page: reading of the visible screen */
function probe(args) {
  const [fit, rootSel, panelSel] = args;
  const scr = rootSel ? document.querySelector(rootSel) : [...document.querySelectorAll('.scr')].find((e) => getComputedStyle(e).display !== 'none');
  const W = innerWidth, H = innerHeight, res = { id: scr ? scr.id : '?', bad: [] };
  if (!scr) return res;
  const vis = (e) => { for (let n = e; n && n !== document.body; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false; } return true; };
  /* opaque sticky bars of a scrolling area (button footer, header): the content passes beneath, hidden and not covered */
  const stickies = new Map();
  const stickyOf = (n) => {
    if (!stickies.has(n)) {
      const q = n.getBoundingClientRect(), list = [];
      for (const s of n.querySelectorAll('*')) {
        const ss = getComputedStyle(s); if (ss.position !== 'sticky' || /rgba\(0, 0, 0, 0\)|transparent/.test(ss.backgroundColor)) continue;
        const sr = s.getBoundingClientRect();
        if (sr.bottom >= q.bottom - 1) list.push({ s, bot: true, y: sr.top }); else if (sr.top <= q.top + 1) list.push({ s, bot: false, y: sr.bottom });
      }
      stickies.set(n, list);
    }
    return stickies.get(n);
  };
  /* visible rectangle: clipped by the ancestors that clip or scroll, and by their sticky bars */
  const clip = (r, e) => {
    let b = { l: r.left, t: r.top, r: r.right, b: r.bottom };
    for (let n = e.parentElement; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const q = n.getBoundingClientRect(); b = { l: Math.max(b.l, q.left), t: Math.max(b.t, q.top), r: Math.min(b.r, q.right), b: Math.min(b.b, q.bottom) };
        for (const k of stickyOf(n)) if (!k.s.contains(e)) { if (k.bot) b.b = Math.min(b.b, k.y); else b.t = Math.max(b.t, k.y); }
      }
    }
    return b.r - b.l > 0.5 && b.b - b.t > 0.5 ? b : null;
  };
  const atoms = [];
  const isAtom = (e) => e.matches('button, input, select, textarea, a[href]');
  for (const e of scr.querySelectorAll('*')) {
    if (!vis(e)) continue;
    if (isAtom(e) && e.type !== 'hidden' && e.type !== 'checkbox' && e.type !== 'radio') { const b = clip(e.getBoundingClientRect(), e); if (b) atoms.push({ el: e, b, kind: 'ctl', name: (e.id || e.className || e.tagName) + ':' + (e.textContent || e.value || '').trim().slice(0, 18) }); }
    if (e.closest('select, textarea, input')) continue; // a button's text counts: two texts of the same card must not overlap
    for (const n of e.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const r of rg.getClientRects()) { if (r.width < 2 || r.height < 2) continue; const b = clip(r, e); if (b) atoms.push({ el: e, b, kind: 'txt', name: (e.id || e.className || e.tagName) + ':' + n.textContent.trim().slice(0, 18) }); }
    }
  }
  const hit = (a, b) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > 1.5 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 1.5;
  for (let i = 0; i < atoms.length; i++) for (let j = i + 1; j < atoms.length; j++) {
    const a = atoms[i], b = atoms[j];
    if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const av = a.el.closest('.acct-av'); if (av && av === b.el.closest('.acct-av')) continue; // level badge placed on the avatar: intended overlap
    if (a.el.closest('.vw-hot') && b.el.closest('.vw-hot')) continue; // workshop "+" dots, projected onto the 3D weapon: two neighboring slots have touch areas (44 px) that touch each other
    // opaque floating list of the workshop (.hotpop: attachments, camos): it unrolls over the visual and what follows it; what
    // it hides does not count (the overlap point is indeed its own), what stays visible above it counts
    const pa = a.el.closest('.hotpop'), pb = b.el.closest('.hotpop');
    if (!pa !== !pb) {
      const x = (Math.max(a.b.l, b.b.l) + Math.min(a.b.r, b.b.r)) / 2, y = (Math.max(a.b.t, b.b.t) + Math.min(a.b.b, b.b.b)) / 2, top = document.elementFromPoint(x, y);
      if (top && top.closest('.hotpop') === (pa || pb)) continue;
    }
    if (hit(a.b, b.b)) res.bad.push(`${a.name} / ${b.name}`);
  }
  res.hscroll = scr.scrollWidth - scr.clientWidth;
  res.vscroll = scr.scrollHeight - scr.clientHeight;
  for (const a of atoms) if (a.b.r > W + 1 || a.b.b > H + 1 || a.b.l < -1 || a.b.t < -1) res.bad.push(`${a.name} off screen`);
  if (fit) {
    const go = scr.querySelector('.sfoot .deploy:not(.hidden), .lm-foot .deploy:not(.hidden)'), r = go && go.getBoundingClientRect();
    res.go = r ? { l: r.left, r: r.right, t: r.top, b: r.bottom } : null;
    const rp = scr.querySelector(panelSel || '.split-r:not(.hidden)'); res.panel = rp ? { sh: rp.scrollHeight, ch: rp.clientHeight, t: rp.getBoundingClientRect().top } : null;
  }
  // one line per label (phone): a row label, a choice or a map name cut by an ellipsis can no longer be read;
  // a second line (summary, explanation) may be
  res.cut = [...scr.querySelectorAll('.lrow .ll, .lrow .lt, .mapcard .mt, .orow > span:first-child')].filter((e) => vis(e) && e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 1 && !e.closest('.k-player')).map((e) => e.textContent.trim().slice(0, 24));
  // ... nor wrap (the label's own text, without its second line)
  for (const e of scr.querySelectorAll('.lrow .ll, .orow > span:first-child')) {
    const t = e.firstChild; if (!t || t.nodeType !== 3 || !vis(e)) continue;
    const rg = document.createRange(); rg.selectNodeContents(t); const tops = new Set([...rg.getClientRects()].filter((q) => q.width > 1).map((q) => Math.round(q.top)));
    if (tops.size > 1) res.cut.push(t.textContent.trim().slice(0, 24) + ' (two lines)');
  }
  res.W = W; res.H = H;
  return res;
}

(async () => {
  const g = await openGame({ mobile: true, w: 997, h: 392, dpr: 1, settings: { quality: 'low', map: 'chergui', touch: 'on' }, noMap: true, noHdri: true });
  const { page } = g;
  await page.evaluate(() => { const b = document.getElementById('wnOk'); if (b) b.click(); });
  await page.addScriptTag({ content: SOC_MOCK });
  await page.addScriptTag({ content: COMM_MOCK });
  await page.addScriptTag({ content: FRIENDS_MOCK });
  await page.evaluate(() => {
    // pause: simulated match state; loading: sample texts (the longest: a map description and a failure message)
    window.pause = (v) => { document.getElementById('matchload').classList.add('hidden'); MATCH.state = 'paused'; MATCH.online = false; MATCH.timeLeft = 400; PL.classIdx = 0; document.getElementById('ui').classList.add('hidden'); document.getElementById('pause').classList.add('show'); pmOpen(); pmView(v); };
    // simulated signed-in account for the Profile screens (rec: has a recovery code; null: signed out); "me" returns this account
    window.acctMockUser = (rec) => {
      const user = rec === null ? null : { username: 'Tester_1', displayName: 'Tester', avatar: null, hasPassword: true, hasRecovery: !!rec };
      const level = { level: 22, xp: 20000, into: 100, need: 1000, next: 21000 }, stats = { matches: 200, wins: 120, losses: 70, kills: 2400, deaths: 1000, assists: 300, headshots: 500, shots: 20000, hits: 8000, seconds: 90000, bestStreak: 17 };
      Object.assign(ACCT, { state: 'ready', user, level, stats, recent: [], code: '', codeNote: '', codeThen: null, err: '', note: '', view: 'login', draft: {} });
      window.acctApi0 = window.acctApi0 || window.acctApi;
      window.acctApi = async (name, body) => (name === 'me' ? { ok: true, status: 200, data: { user, level, stats, recent: [] } } : window.acctApi0(name, body));
    };
    window.loading = (fail) => {
      const $ = (i) => document.getElementById(i), m = mapById('sirocco');
      document.getElementById('pause').classList.remove('show'); MATCH.state = 'menu'; $('ui').classList.add('hidden');
      $('mlName').textContent = m.name; $('mlDesc').textContent = m.desc; $('mlMode').textContent = 'Team Deathmatch · solo';
      $('mlMsg').textContent = fail ? "3D display was interrupted by the device during loading (3D display interrupted by the device). Restart the game: low-power graphics mode is enabled." : 'Shader compilation: 42%';
      for (const i of ['mlBack', 'mlRep', 'mlSafe']) $(i).classList.toggle('hidden', !fail);
      $('matchload').classList.remove('hidden');
    };
  });
  const SCREENS = [
    ['main', true, () => uiOpen('main')],
    // Steam Deck (src/09ra-deck.js): the install card (Deck browser in Desktop mode) and the controls layout card (Deck mode)
    ['main-steam-deck', true, () => { DECK_UI.force = 'install'; uiOpen('main'); }],
    ['main-deck-gamepad', true, () => { DECK_UI.force = 'pad'; uiOpen('main'); }],
    // friends (09ta-friends.js): a received invitation (inset on the right, at the main menu and on another screen), the Play screen, the Friends screen (outside
    // a lobby, then inside a lobby: invite a connected friend), the friends invitation from a created lobby
    ['main-invitation', true, () => { socMock(); friendsMock({ inv: true }); uiOpen('main'); friendsInviteCard(); }],
    ['play', true, () => { socMock(); friendsMock({}); uiOpen('play', ['main']); }],
    ['play-invitation', true, () => { socMock(); friendsMock({ inv: true }); uiOpen('play', ['main']); friendsInviteCard(); }],
    ['friends', false, () => { socMock(); friendsMock({ inv: true }); uiOpen('friends', ['main']); }],
    ['friends-lobby', false, `socMock(); friendsMock({}); (${srvMock})('waiting', '', 'leader'); uiOpen('friends', ['main', 'multi'])`],
    ['lobby-created-invite-friends', true, `socMock(); friendsMock({}); (${srvMock})('waiting', 'invite', 'leader')`],
    ['solo', true, () => uiOpen('solo', ['main'])],
    // Solo submenus (they slide in to the right of the menu, over the teams)
    ['solo-map', true, () => { uiOpen('solo', ['main']); lmPush(LM.scr.solo, 'map'); }],
    ['solo-settings', true, () => { uiOpen('solo', ['main']); lmPush(LM.scr.solo, 'setup'); }],
    ['solo-ffa', true, () => { Settings.mode = 'ffa'; uiOpen('solo', ['main']); Settings.mode = 'tdm'; }],
    ['multi', false, () => { NET.role = 'off'; uiOpen('multi', ['main']); netRender(); }],
    // permanent public lobbies (src/09cb-servers.js): the home and their list by mode, "Join a match" (the mode), then a public lobby
    // waiting, in countdown (the vote at bottom left), in match (the current map), its chat and a player
    ['multi-servers', false, `(${srvMock})('', '')`],
    ['multi-create', false, `(${srvMock})('', 'create')`],
    // lobby created by a player (held by the server): seen by its leader (settings, map, player to kick, invitation), then by another player
    ...[['lobby-created', ''], ['lobby-created-settings', 'srvsetup'], ['lobby-created-map', 'srvmap'], ['lobby-created-player', 'srvp'], ['lobby-created-invite', 'invite']].map(([n, pane]) => [n, true, `(${srvMock})('waiting', '${pane}', 'chef')`]),
    ['lobby-created-member', true, `(${srvMock})('waiting', '', 'member')`],
    // host migration mid-match (src/09c-net.js): veil, title, sentence and bar, entirely on screen
    ['host-migration', false, () => { MATCH.state = 'menu'; document.getElementById('ui').classList.add('hidden'); netMigShow(_t('Another player is taking over the match.')); MIG.t0 = performance.now() - 3000; netMigBar(); }, '#hostMig'],
    // guest disconnection mid-match (netResumeStart): the same screen, title "Reconnecting"
    ['reconnecting', false, () => { MATCH.state = 'menu'; document.getElementById('ui').classList.add('hidden'); netMigShow(_t('Connection lost. Getting you back into the match...'), _t('Reconnecting')); MIG.t0 = performance.now() - 3000; netMigBar(); }, '#hostMig'],
    ['lobby-created-member-settings', true, `(${srvMock})('waiting', 'srvsetup', 'member')`],
    ...[['lobby-public-waiting', 'waiting', ''], ['lobby-public', 'countingDown', ''], ['lobby-public-match', 'inProgress', ''], ['lobby-public-chat', 'countingDown', 'chat'], ['lobby-public-player', 'countingDown', 'srvp']]
      .map(([n, ph, pane]) => [n, true, `(${srvMock})('${ph}', '${pane}')`]),
    ['multi-join', false, () => { NET.role = 'off'; ACCT.state = 'ready'; ACCT.user = ACCT.user || { username: 'Tester_1', displayName: 'Tester' }; uiOpen('multi', ['main']); netRender(); lmPush(LM.scr.multi, 'join'); }], // the code field alone, Join in yellow
    // public matches (game server): simulated list, replay cut
    ['multi-public', false, () => {
      NET.role = 'off'; NETP.err = false; NETP.playerCount = 23; NETP.at = Date.now() + 1e9;
      NETP.list = [['KX7PQ', 'Corbeau 7', 'chergui', 'tdm', 7, 'playing'], ['M4RTE', 'Lynx Du Nord', 'notos', 'dom', 5, 'lobby'], ['ZZ8AB', 'Soldat Fantome', 'cirrus', 'ffa', 4, 'playing'], ['QW3RT', 'Tiger', 'saintgivre', 'tdm', 8, 'playing'], ['HJ5KL', 'Renard_Roux_Long', 'scoria', 'tdm', 2, 'lobby'], ['PL9MN', 'Hibou', 'portmael', 'ffa', 1, 'loading']]
        .map(([c, n, m, o, j, p]) => ({ c, n, m, o, j, x: 8, p, v: NET_PROTO }));
      uiOpen('multi', ['main']); netRender(); netPubRender();
    }],
    // lobby: simulated state (host or guest, players, chat), rendered by the real netRender; the players on the right, then each submenu
    ...[['lobby', ''], ['lobby-settings', 'setup'], ['lobby-map', 'map'], ['lobby-chat', 'chat'], ['lobby-player', 'player'], ['lobby-invite', 'invite']].map(([n, pane]) => [n, true, `(${netMock})('host', '${pane}')`]),
    ['lobby-guest', true, `(${netMock})('client', '')`],
    ['lobby-guest-settings', true, `(${netMock})('client', 'setup')`],
    // Back in a lobby: "Leave the lobby?" in the middle of the screen (host, guest)
    ['lobby-leave', false, `(${netMock})('host', 'leave')`, '#netLeave'],
    ['lobby-guest-leave', false, `(${netMock})('client', 'leave')`, '#netLeave'],
    ['classes', true, () => uiOpen('classes', ['main'])],
    ['outfits', true, () => uiOpen('skins', ['main'])],
    // class workshop (src/09n-armory.js): the first custom slot, created just long enough to open the screen (nothing else changes); the screen does not scroll
    ['workshop', true, () => { const c = CLASSES[PRESETS], made = c.made; c.made = true; uiOpen('classes', ['main']); arsOpen(PRESETS); c.made = made; }, null, '.ars-top'],
    // its camo window (ten, including Holo): all on screen or in its scrolling area
    ['workshop-camos', true, () => { const c = CLASSES[PRESETS], made = c.made; c.made = true; uiOpen('classes', ['main']); arsOpen(PRESETS); arsCamoOpen(); c.made = made; }, null, '.ars-top'],
    // its Streaks tab: the streaks by kill count on the left, the class slots and the detail on the right
    ['workshop-streaks', true, () => { const c = CLASSES[PRESETS], made = c.made; c.made = true; uiOpen('classes', ['main']); arsOpen(PRESETS); ARSUI.tab = 'k'; renderArsenal(); c.made = made; }, null, '.ars-top'],
    // its Grenade tab: the three types on the left, the detail of the chosen type on the right
    ['workshop-grenade', true, () => { const c = CLASSES[PRESETS], made = c.made; c.made = true; uiOpen('classes', ['main']); arsOpen(PRESETS); ARSUI.tab = 'g'; renderArsenal(); c.made = made; }, null, '.ars-top'],
    ['options', true, () => uiOpen('options', ['main'])],
    // Video tab: "Show performance", "Performance report", "Graphics report" (the list scrolls, the tab stays on screen)
    ['options-video', true, () => { uiOpen('options', ['main']); const t = [...document.querySelectorAll('#optMenu [role=tab]')].find((b) => /Vid/.test(b.textContent)); if (t) t.click(); }],
    ['profile', false, () => uiOpen('profile', ['main'])],
    // account (src/09j-account.js): recovery code shown once, forgotten password, profile of an account that has no code yet
    ['profile-code', false, () => { acctMockUser(true); ACCT.code = 'K7QX2-MP9WD-ABCDE-FGHJK'; ACCT.codeNote = 'Account created: welcome!'; uiOpen('profile', ['main']); acctRender(); }],
    ['profile-forgot', false, () => { acctMockUser(null); ACCT.view = 'recover'; uiOpen('profile', ['main']); acctRender(); }],
    ['profile-signup', false, () => { acctMockUser(null); ACCT.view = 'register'; uiOpen('profile', ['main']); acctRender(); }],
    ['profile-no-code', false, () => { acctMockUser(false); uiOpen('profile', ['main']); acctRender(); }],
    // social life (src/09t-social.js): simulated account and server responses
    ['leaderboard', false, () => { socMock(); uiOpen('ranking', ['main']); }],
    ['player', false, () => { socMock(); SOC.player = { u: 'Corbeau_7', data: null, err: '', busy: false }; uiOpen('player', ['main']); }],
    ['player-report', false, () => { socMock(); SOC.player = { u: 'Corbeau_7', data: null, err: '', busy: false, rep: { why: 'cheating', note: '', err: '', busy: false, sent: false } }; uiOpen('player', ['main']); }],
    ['moderation', false, () => { socMock(); MOD.view = 'open'; uiOpen('moderation', ['main']); }],
    ['profile-moderator', false, () => { socMock(); uiOpen('profile', ['main']); acctRender(); }],
    ['notifications', false, () => { socMock(); uiOpen('notifs', ['main']); }],
    // Community (src/09z-community.js): reviews, ideas seen by the team (reply in progress), review editor open; signed-in main menu (three buttons at the top)
    ['community', false, () => { socMock(); commMock(); COMM.kind = 'review'; uiOpen('community', ['main']); }],
    ['community-ideas', false, () => { socMock(); commMock(); COMM.kind = 'idea'; COMM.sort = 'top'; uiOpen('community', ['main']); COMM.ans = { id: 12, kind: 'idea', status: 'planned', reply: "Good idea, we are keeping it for the next update.", err: '', busy: false }; }],
    ['community-review-write', false, () => { socMock(); commMock(); COMM.kind = 'review'; uiOpen('community', ['main']); COMM.myReview = { id: 2, rating: 4, body: "Very good. It just lacks a capture the flag mode." }; commWrite(null); }],
    ['community-bug-write', false, () => { socMock(); commMock(); COMM.kind = 'bug'; uiOpen('community', ['main']); commWrite(null); }],
    ['main-signed-in', true, () => { socMock(); uiOpen('main'); }],
    ['news', false, () => uiOpen('news', ['main'])],
    ['legal', false, () => uiOpen('legal', ['main'])],
    ['pause', true, () => pause('home'), '#pause', '.pm-panel'],
    ['pause-class', true, () => pause('class'), '#pause', '.pm-panel'],
    ['pause-options', true, () => pause('options'), '#pause', '.pm-panel'],
    // match results (fillEnd, acctMatchEnd, arsEndFill): tables, statistics, XP and unlocks simulated; the body scrolls, the footer (timer, buttons) stays on screen
    ['results', false, () => {
      document.getElementById('pause').classList.remove('show'); MATCH.state = 'playing'; MATCH.online = false; MATCH.mode = 'tdm'; MATCH.limit = 75; MATCH.score = [75, 63]; MATCH.outro = null; MATCH.time = 0;
      entities.forEach((x, i) => { x.kills = 9 - (i % 9); x.deaths = i % 4; x.score = x.kills * 100 + i * 15; x.assists = i % 3; });
      endMatch(); END.t = 60; arsShowClear();
      ARS.gain = { xp: 640, level: 13, up: 1, slots: 1 }; ARS.px = pxpForLevel(13) + 420; ACCT.state = 'ready'; acctMatchEnd('win', true);
      ARS.sess = { m4: { xp: 820, k: 9, l0: 3 }, ak47: { xp: 160, k: 2, l0: 5 } }; arsEndFill();
    }, '#end'],
    ['loading', true, () => loading(false), '#matchload', '.ml-inner'],
    ['loading-failed', true, () => loading(true), '#matchload', '.ml-inner'],
    ['controls-edit', false, () => { document.getElementById('pause').classList.remove('show'); MATCH.state = 'menu'; touchEditOpen(); touchEditSelect('fire'); }, '#touch', '#tcEd'],
    ['share-edit', false, () => { document.getElementById('pause').classList.remove('show'); MATCH.state = 'menu'; touchEditOpen(); touchEditSelect('knife'); TC.el.ed.querySelector('[data-ed=share]').click(); }, '#touch', '#tcEd'],
    ['level-up', false, () => { document.getElementById('pause').classList.remove('show'); MATCH.state = 'menu'; document.getElementById('ui').classList.remove('hidden'); rankUpShow(10, 2); clearTimeout(RU.t); for (const a of document.getAnimations()) if (a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#rankUp')) { a.pause(); a.currentTime = 2300; } }, '#rankUp'],
    // outside a map's round zone (src/02-relief.js, ringHud): the screen darkens, the message and the countdown
    ['out-of-zone', false, () => { document.getElementById('pause').classList.remove('show'); MATCH.state = 'menu'; document.getElementById('hud').classList.remove('hidden'); window.__hudOn = true; const el = document.getElementById('ringOut'); el.style.setProperty('--k', '0.8'); document.getElementById('ringN').textContent = '7'; el.classList.add('show'); }, '#ringOut'],
    ['deploy', true, () => { UI.flow = { online: false, map: 'chergui', deploy() {} }; UI.busy = false; uiOpen('deploy', ['main']); document.getElementById('depSub').textContent = 'Chergui · Solo'; }],
    // "What's new" window of a major version (src/09f-news.js), for a player who knew an older version: the list scrolls, its buttons stay on screen
    ['whats-new', false, () => { uiOpen('main'); localStorage.setItem('cod_seen_version', '2.29.0'); newsPopup(); }, '#whatsnew'],
    // power saving, the first-launch question on touch (src/09zl-economy.js): its two buttons on screen
    // performance report of a match (src/09zo-perfs.js): a long simulated report, its text scrolls, its buttons stay on screen
    ['performance-report', false, () => { uiOpen('main'); PFR.last = Array.from({ length: 220 }, (_, i) => i + ' 280 3.57 4.1 3.40 9.2 2.10 | 0.30 0.41 0.05 0.16 0.11 0.01 2.66 | 290 1650 0 270 high 1.00 2 0 | 0 0 0 0(0)').join('\n'); pfrShow(); }, '#gpuRep'],
    ['economy', false, () => { document.getElementById('pause').classList.remove('show'); MATCH.state = 'menu'; uiOpen('main'); Settings.ecoAsk = true; ecoAsk(); }, '#ecoAsk'], // (the question waits for the menu: the pause of a previous screen is closed)
  ];
  const only = (env, k) => !process.env[env] || process.env[env].split(',').includes(k);
  for (const [w, h] of SIZES.filter(([w, h]) => only('SCREEN_SIZES', w + 'x' + h))) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(300);
    for (const [name, fit, open, rootSel, panelSel] of SCREENS.filter((x) => only('SCREEN_LIST', x[0]) && (!DECK_ONLY.has(x[0]) || (w === 1280 && h === 800)))) {
      await page.evaluate(() => { if (TC.edit) touchEditClose(); rankUpClear(); if (typeof SRV !== 'undefined') { SRV.on = false; SRV.st = null; SRV.list = null; } if (typeof netMigDone === 'function') netMigDone(true); /* public lobby, migration simulated per screen: not in the next one */ if (typeof DECK_UI !== 'undefined' && DECK_UI.force) { DECK_UI.force = ''; deckCard(); } if (!window.__acct0) window.__acct0 = Object.assign({}, ACCT); else Object.assign(ACCT, window.__acct0); /* each screen starts from the startup account: an account simulated by one screen (multi-join) no longer leaks into the next (profile) */ document.getElementById('ui').classList.add('hidden'); document.getElementById('whatsnew').classList.add('hidden'); document.getElementById('netLeave').classList.add('hidden'); document.getElementById('ecoAsk').classList.add('hidden'); Settings.ecoAsk = false; document.getElementById('gpuRep').classList.add('hidden'); document.getElementById('end').classList.remove('show'); if (window.__hudOn) { document.getElementById('hud').classList.add('hidden'); document.getElementById('ringOut').classList.remove('show'); window.__hudOn = false; } /* the HUD shown by out-of-zone */ });
      await page.evaluate(open);
      await page.waitForTimeout(450);
      const r = await page.evaluate(probe, [fit, rootSel || null, panelSel || null]);
      const why = [];
      const clipped = name.startsWith('loading') || name.startsWith('pause'); // animated background that silently overflows (overflow hidden); the pause is a layer, not a scrolling screen
      if (!clipped && r.hscroll > 1) why.push(`horizontal scroll of ${r.hscroll}px`);
      if (fit && !clipped && r.vscroll > 1) why.push(`the screen scrolls (${r.vscroll}px)`);
      if (fit && r.panel && r.panel.sh > r.panel.ch + 1) why.push(`right panel clipped (${r.panel.sh} > ${r.panel.ch})`);
      if (fit && r.panel && r.panel.t < -0.5) why.push(`content cut off at the top (${Math.round(r.panel.t)}px)`);
      if (fit && r.go && (r.go.b > r.H + 0.5 || r.go.r > r.W + 0.5 || r.go.t < 0)) why.push("action button off screen");
      // the settings list must never have zero height (it did in the pause, on phone)
      if (name === 'options' || name === 'pause-options') { const hh = await page.evaluate((id) => document.querySelector(id + ' .orows').getBoundingClientRect().height, name === 'options' ? '#optMenu' : '#optPause'); if (hh < 80) why.push(`settings list squashed (${Math.round(hh)} px)`); }
      if (name.endsWith('-edit')) { const pb = await page.evaluate(() => { const r = document.getElementById('tcEd').getBoundingClientRect(); return { b: r.bottom, l: r.left, r: r.right, H: innerHeight, W: innerWidth }; }); if (pb.b > pb.H + 0.5 || pb.l < 0 || pb.r > pb.W + 0.5) why.push(`edit panel off screen (bottom ${Math.round(pb.b)} of ${pb.H})`); }
      if (name === 'whats-new') {
        const q = await page.evaluate(() => ({ open: !document.getElementById('whatsnew').classList.contains('hidden'), n: document.querySelectorAll('#wnList li').length, out: ['wnTitle', 'wnOk', 'wnMore'].filter((i) => { const r = document.getElementById(i).getBoundingClientRect(); return r.height < 1 || r.top < 0 || r.bottom > innerHeight + 0.5 || r.left < 0 || r.right > innerWidth + 0.5; }) }));
        if (!q.open || !q.n) why.push(`window not open or empty (${q.n} changes)`);
        if (q.out.length) why.push(`off screen: ${q.out.join(', ')}`);
      }
      if (name === 'economy') {
        const q = await page.evaluate(() => ({ open: !document.getElementById('ecoAsk').classList.contains('hidden'), out: ['ecTitle', 'ecoOn', 'ecoOff'].filter((i) => { const r = document.getElementById(i).getBoundingClientRect(); return r.height < 1 || r.top < 0 || r.bottom > innerHeight + 0.5 || r.left < 0 || r.right > innerWidth + 0.5; }) }));
        if (!q.open) why.push('window not open');
        if (q.out.length) why.push(`off screen: ${q.out.join(', ')}`);
      }
      if (name === 'performance-report') {
        const q = await page.evaluate(() => ({ open: !document.getElementById('gpuRep').classList.contains('hidden'), n: document.getElementById('grTxt').textContent.split('\n').length, out: ['grTitle', 'grCopy', 'grClose'].filter((i) => { const r = document.getElementById(i).getBoundingClientRect(); return r.height < 1 || r.top < 0 || r.bottom > innerHeight + 0.5 || r.left < 0 || r.right > innerWidth + 0.5; }) }));
        if (!q.open || q.n < 200) why.push(`window not open or report missing (${q.n} lines)`);
        if (q.out.length) why.push(`off screen: ${q.out.join(', ')}`);
      }
      if (name === 'results') {
        const q = await page.evaluate(() => ['againBtn', 'menuBtn', 'endTimer', 'endTitle'].filter((i) => { const r = document.getElementById(i).getBoundingClientRect(); return r.height < 1 || r.top < 0 || r.bottom > innerHeight + 0.5 || r.left < 0 || r.right > innerWidth + 0.5; }));
        if (q.length) why.push(`off screen: ${q.join(', ')}`);
      }
      if (r.cut && r.cut.length) why.push('text cut off: ' + r.cut.slice(0, 4).join(' ; '));
      if (r.bad.length) why.push('overlaps: ' + [...new Set(r.bad)].slice(0, 4).join(' ; '));
      ok(why.length === 0, `${w}x${h} ${name}${why.length ? ': ' + why.join(' | ') : ''}`);
      if (out && (why.length || process.env.KEEP_ALL)) await page.screenshot({ path: path.join(out, `menu-${w}x${h}-${name}.png`) });
    }
  }
  await g.browser.close();
  console.log(fails ? `${fails} failure(s)` : 'all good');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
