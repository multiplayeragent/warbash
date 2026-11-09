/* ==========================================================================
   FRIENDS: Friends screen, presence, lobby invitations, Play screen
   The Friends screen (friends): add a friend by name, requests received and sent, online friends with what they are doing (in the menu,
   in a lobby, in a match) and offline ones. Everything goes through the API (Vercel): the list (/api/friends), presence (the game signals itself
   through /api/presence every 20 s in the menus, every minute in a match) and lobby invitations (/api/lobby-invite): from
   your lobby (Invite friends, or the Friends screen), you invite an online friend, who receives the invitation at their next signal, in a panel at
   the top of the menus, and enters the lobby with a tap, without typing the code. A group held by the game server (/genset channel, 5.2.2) was
   tried then removed (owner's feedback).
   ========================================================================== */
const FRIENDS = {
  list: null, received: [], out: [], loading: false, err: '', note: '', at: 0, // API list, with friends' presence (re-read at most every 20 s)
  inv: [], gone: new Set(), // received invitations still valid (presence); those answered or dismissed (ids)
  sent: {}, // sent invitations: username (lowercase) -> lobby code
  tick: 0, last: 0, busy: false, // presence signal (last send)
};

/* ---------- Presence and received invitations ---------- */
/* Account logged in or out (socChanged): presence signal, friends list; or everything clears */
function friendsChanged() {
  if (!ACCT.user) { Object.assign(FRIENDS, { list: null, received: [], out: [], err: '', note: '', inv: [], sent: {} }); friendsInviteCard(); return; }
  if (!FRIENDS.tick) {
    FRIENDS.tick = setInterval(friendsTick, 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && ACCT.user) friendsPing(); });
  }
  friendsPing(); if (!FRIENDS.list) friendsLoad();
}
function friendsState() { return MATCH.state !== 'menu' ? 'inProgress' : netInLobby() ? 'lobby' : 'menu'; }
function friendsInvitePageOpen() { const L = LM.scr.multi; return UI.screen === 'multi' && !!L && L.stack.length > 0 && L.stack[L.stack.length - 1].id === 'invite'; }
function friendsTick() {
  if (!ACCT.user || document.hidden) return;
  friendsInviteCard(); // (a match over, a lobby left: the panel comes back)
  if (Date.now() - FRIENDS.last >= (MATCH.state === 'menu' ? 20000 : 60000)) friendsPing();
  // open lists (Friends screen, invitation from the lobby): friends' presence re-read every 20 s
  if ((UI.screen === 'friends' || friendsInvitePageOpen()) && Date.now() - FRIENDS.at > 20000) friendsLoad();
}
async function friendsPing() {
  if (!ACCT.user || FRIENDS.busy) return;
  FRIENDS.busy = true; FRIENDS.last = Date.now();
  try {
    const r = await acctApi('presence', { s: friendsState() });
    if (!r.ok || !r.data) return;
    if (Array.isArray(r.data.invites)) FRIENDS.inv = r.data.invites.filter((i) => !FRIENDS.gone.has(i.id) && i.from && /^[A-Z0-9]{5}$/.test(i.code));
    if (typeof r.data.unread === 'number' && r.data.unread !== SOC.notifs.unread) { SOC.notifs.unread = r.data.unread; socBadge(); }
    friendsInviteCard();
  } finally { FRIENDS.busy = false; }
}
/* Received invitation: a panel to the right of the menus (the most recent), except in the lobby it leads to */
function friendsInviteCard() {
  const el = $('friendInvite'); if (!el) return;
  const i = FRIENDS.inv.find((x) => !FRIENDS.gone.has(x.id) && x.code !== netCodeNow());
  const show = !!i && !!ACCT.user && MATCH.state === 'menu' && UI.screen !== 'friends'; // (the Friends screen shows it in its list)
  el.classList.toggle('hidden', !show);
  if (!show || el.dataset.id === String(i.id)) return;
  el.dataset.id = String(i.id);
  el.innerHTML = `<p>${_t('{0} invites you to their lobby.', `<b>${esc(i.from.displayName)}</b>`)}</p><div class="btns"><button class="btn primary" type="button" data-a="ok">${_t('Join')}</button><button class="btn" type="button" data-a="no">${_t('Decline')}</button></div>`;
  el.querySelector('[data-a="ok"]').addEventListener('click', () => friendsJoin(i));
  el.querySelector('[data-a="no"]').addEventListener('click', () => friendsDecline(i));
}
function friendsDone(i) { FRIENDS.gone.add(i.id); FRIENDS.inv = FRIENDS.inv.filter((x) => x.id !== i.id); $('friendInvite').dataset.id = ''; friendsInviteCard(); acctApi('invite-answer', { id: i.id }); }
function friendsDecline(i) { sfxUi('back'); friendsDone(i); }
/* Join: the previous lobby is left; on leaving this one, we return to the screen we were on (UI.lobbyBack) */
function friendsJoin(i) {
  sfxUi('click'); friendsDone(i);
  if (!acctGate(i.code)) return;
  const go = () => { const was = UI.screen; uiGo('multi'); netJoinCode(i.code); if (was !== 'multi') UI.lobbyBack = true; };
  if (netInLobby()) { netQuit(); setTimeout(go, 300); } else go();
}

/* ---------- Friends list ---------- */
function friendsLoad() {
  if (!ACCT.user || FRIENDS.loading) return;
  FRIENDS.loading = true; FRIENDS.at = Date.now();
  acctApi('friends').then((r) => {
    FRIENDS.loading = false;
    if (!r.ok || !r.data) { FRIENDS.err = socErr(r); friendsRender(); return; }
    FRIENDS.err = ''; FRIENDS.list = r.data.friends || []; FRIENDS.received = r.data.received || []; FRIENDS.out = r.data.sent || [];
    friendsRender();
  });
}
function friendsRender() { if (UI.screen === 'friends') friendsListRender(); if (friendsInvitePageOpen()) netRender(); }
/* Action on a friend (add, accept, decline, remove): the same path as the other screens, then the list re-read */
async function friendsListDo(act, u) {
  if (SOC.busy) return; SOC.busy = true;
  try {
    const r = await SOC_CALL[act](u);
    if (!r.ok) { FRIENDS.note = socErr(r); friendsRender(); return; }
    sfxUi(act === 'decline' || act === 'remove' ? 'back' : 'click');
    FRIENDS.note = act === 'add' ? (r.data.relation === 'friend' ? _t('You are now friends.') : _t('Friend request sent.')) : '';
    friendsLoad(); socNotifLoad();
  } finally { SOC.busy = false; }
}
/* What a friend is doing (online, from their last signal) */
function friendsStatus(f) { return !f.online ? _t('Offline') : { lobby: _t('In a lobby'), inProgress: _t('In match') }[f.state] || _t('In the menus'); }
/* Invite a friend to your lobby (the current lobby's code) */
async function friendsSend(u) {
  const code = netCodeNow(); if (!code || !netInLobby()) return;
  sfxUi('click');
  const r = await acctApi('lobby-invite', { username: u, code });
  if (!r.ok) { friendsToast(socErr(r)); return; }
  FRIENDS.sent[u.toLowerCase()] = code;
  const f = (FRIENDS.list || []).find((x) => x.username === u);
  friendsToast(_t('Invitation sent to {0}.', f ? f.displayName : u)); friendsRender();
}
const friendsSentHere = (u) => FRIENDS.sent[u.toLowerCase()] === netCodeNow();
/* Brief message at the bottom of the menus (invitation sent, declined...) */
function friendsToast(text) {
  const el = $('friendNote'); if (!el) return;
  el.textContent = text; el.classList.remove('hidden');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.add('hidden'), 3500);
}
/* The lobby (Multiplayer menu, Invite friends): your friends, online first, to invite with a tap; then the code and the link */
function friendsInviteRows() {
  if (!ACCT.user) return [];
  if (Date.now() - FRIENDS.at > 20000) friendsLoad();
  const rows = [{ k: 'sep', label: _t('Your friends') }], list = (FRIENDS.list || []).slice().sort((a, b) => b.online - a.online);
  if (!FRIENDS.list) rows.push({ k: 'note', text: FRIENDS.err || _t('Loading...') });
  else if (!list.length) rows.push({ k: 'note', text: _t('Add friends in the Friends menu to invite them here.') });
  for (const f of list) {
    const sent = friendsSentHere(f.username);
    rows.push({ k: 'pick', key: 'ami:' + f.username, label: f.displayName, sub: sent ? _t('Invite sent') : friendsStatus(f), value: f.online ? (sent ? _t('Send again') : _t('Invite')) : '', disabled: !f.online, pick: () => friendsSend(f.username) });
  }
  rows.push({ k: 'sep', label: _t('Code and link') });
  return rows;
}

/* ---------- Friends screen ---------- */
function friendsListScreen() {
  const body = $('frBody'); if (!body) return;
  if (!body._friends) {
    body._friends = true;
    body.addEventListener('click', (e) => {
      const a = e.target.closest('[data-fa]'); if (!a || !body.contains(a)) { const o = e.target.closest('[data-open]'); if (o && body.contains(o)) socOpenPlayer(o.dataset.open); return; }
      e.stopPropagation();
      const k = a.dataset.fa, v = a.dataset.v;
      if (k === 'invite') friendsSend(v); else if (k === 'join' || k === 'nojoin') { const i = FRIENDS.inv.find((x) => String(x.id) === v); if (i) (k === 'join' ? friendsJoin : friendsDecline)(i); }
      else friendsListDo(k, v);
    });
    body.addEventListener('submit', (e) => {
      if (e.target.id !== 'frAdd') return;
      e.preventDefault();
      const u = String(new FormData(e.target).get('u') || '').trim().replace(/^@/, '');
      if (u) friendsListDo('add', u);
    });
  }
  FRIENDS.note = ''; friendsLoad(); friendsListRender();
}
function friendsListRender() {
  const body = $('frBody'); if (!body) return;
  if (!ACCT.user) { body.innerHTML = `<p class="hint">${_t('Sign in to see your friends.')}</p>`; return; }
  const on = FRIENDS.list ? FRIENDS.list.filter((f) => f.online) : [], off = FRIENDS.list ? FRIENDS.list.filter((f) => !f.online) : [], lobby = netInLobby();
  $('frSub').textContent = FRIENDS.list ? _tn(on.length, '{0} friend online', '{0} friends online') : '';
  const btn = (fa, v, label, cls = '') => `<button class="btn ${cls}" type="button" data-fa="${fa}" data-v="${esc(v)}">${label}</button>`;
  const row = (f, status, acts, cls = '') => `<div class="rk-row fr-row ${cls}" data-open="${esc(f.username)}" role="button" tabindex="0" aria-label="${esc(_t('{0}\u0027s profile, level {1}', f.displayName, f.level))}">
      <span class="acct-av" data-u="${esc(f.username)}" data-n="${esc(f.displayName)}">${socAv(f.username, f.displayName, f.avatar)}</span>
      <span class="rk-id"><b>${esc(f.displayName)}</b><small>@${esc(f.username)} · ${_t('Level {0}', f.level)}</small></span>
      <span class="fr-st">${status}</span><span class="rk-act">${acts}</span></div>`;
  // in a lobby: invite an online friend; otherwise nothing more to do than open their profile
  const onRows = on.map((f) => row(f, `<i class="fr-dot" aria-hidden="true"></i>${esc(friendsStatus(f))}`, lobby ? btn('invite', f.username, friendsSentHere(f.username) ? _t('Send the invite again') : _t('Invite to my lobby'), friendsSentHere(f.username) ? '' : 'primary') : '', 'on')).join('');
  const offRows = off.map((f) => row(f, esc(_t('Offline')), '', 'off')).join('');
  const recRows = FRIENDS.received.map((f) => row(f, esc(_t('Request received')), btn('accept', f.username, _t('Accept'), 'primary') + btn('decline', f.username, _t('Decline')))).join('');
  const outRows = FRIENDS.out.map((f) => row(f, esc(_t('Request sent')), btn('remove', f.username, _t('Cancel')))).join('');
  const invRows = FRIENDS.inv.filter((i) => !FRIENDS.gone.has(i.id)).map((i) => `<div class="card fr-inv"><p>${_t('{0} invites you to their lobby.', `<b>${esc(i.from.displayName)}</b>`)}</p><div class="btns">${btn('join', String(i.id), _t('Join'), 'primary')}${btn('nojoin', String(i.id), _t('Decline'))}</div></div>`).join('');
  const sec = (title, html) => (html ? `<h3 class="lbl">${title}</h3><div class="rk-list">${html}</div>` : '');
  body.innerHTML = `<div class="rk-bar"><form class="rk-find" id="frAdd"><input name="u" maxlength="32" placeholder="${esc(_t('Username'))}" aria-label="${esc(_t('Username of the friend to add'))}" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="btn primary" type="submit">${_t('Add')}</button></form></div>
    <p class="ac-err" role="alert">${esc(FRIENDS.err || '')}</p>${FRIENDS.note ? `<p class="ac-note">${esc(FRIENDS.note)}</p>` : ''}
    ${invRows}
    ${sec(_t('Requests received'), recRows)}
    ${sec(_t('Online ({0})', on.length), onRows)}
    ${sec(_t('Offline ({0})', off.length), offRows)}
    ${sec(_t('Requests sent'), outRows)}
    ${FRIENDS.list && !FRIENDS.list.length && !FRIENDS.received.length ? `<div class="card"><p class="hint">${_t('You have no friends yet. Add a player by their username, or from the leaderboard (Players).')}</p></div>` : ''}
    ${!FRIENDS.list && FRIENDS.loading ? `<p class="hint">${_t('Loading...')}</p>` : ''}`;
  socAvFallback(body);
  for (const r of body.querySelectorAll('.rk-row')) r.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === r) { e.preventDefault(); socOpenPlayer(r.dataset.open); } });
}

/* ---------- Play screen ----------
   Three ways to play, as icon cards (owner's feedback: no map illustration): Solo (against bots, offline), With friends
   (a private game-server lobby, against bots: you invite your online friends to it) and Public matches (the browser of the
   public lobbies that players have started, and lobby creation). */
const PLAY_ICON = {
  solo: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5Z',
  privateLobby: 'M9 11.5a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Zm7.5 0a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5ZM1.5 20c0-3.6 3.4-6.5 7.5-6.5s7.5 2.9 7.5 6.5v.5h-15V20Zm16.4.5c.07-.33.1-.66.1-1 0-2.2-1-4.2-2.6-5.5.5-.1 1-.2 1.6-.2 3.3 0 6 2.4 6 5.5v1.2h-5.1Z',
  public: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 6h-3a15.6 15.6 0 0 0-1.4-3.6A8 8 0 0 1 18.9 8ZM12 4c.8 1.1 1.5 2.5 1.9 4h-3.8c.4-1.5 1.1-2.9 1.9-4ZM4.3 14a8 8 0 0 1 0-4h3.4a16.5 16.5 0 0 0 0 4H4.3Zm.8 2h3a15.6 15.6 0 0 0 1.4 3.6A8 8 0 0 1 5.1 16Zm3-8h-3a8 8 0 0 1 4.4-3.6A15.6 15.6 0 0 0 8.1 8ZM12 20c-.8-1.1-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.9-1.9 4Zm2.3-6H9.7a14.7 14.7 0 0 1 0-4h4.6a14.7 14.7 0 0 1 0 4Zm.2 5.6c.6-1.1 1.1-2.3 1.4-3.6h3a8 8 0 0 1-4.4 3.6Zm1.8-5.6a16.5 16.5 0 0 0 0-4h3.4a8 8 0 0 1 0 4h-3.4Z',
};
function playRender() {
  const el = $('playGrid'); if (!el) return;
  const cards = [
    ['solo', _t('Solo'), _t('You against bots, offline. For practice.')],
    ['privateLobby', _t('With friends'), _t('A private lobby against bots. Invite your online friends from the lobby.')],
    ['public', _t('Public matches'), _t('Public lobbies started by players. You can also create your own lobby there.')],
  ];
  el.innerHTML = cards.map(([k, b, s]) => `<button class="play-card" type="button" data-play="${k}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${PLAY_ICON[k]}"/></svg><b>${b}</b><span>${s}</span></button>`).join('');
}
/* With friends: the private lobby is created and opened (Invite friends is within reach there, without opening on its own, owner's feedback); on
   leaving it, we come back here (UI.lobbyBack, netLeaveClose) */
function playPick(k) {
  sfxUi('click');
  if (k === 'solo') { uiGo('solo'); return; }
  if (!acctGate()) return;
  if (netInLobby()) { uiGo('multi'); UI.lobbyBack = true; return; }
  if (k === 'privateLobby') { srvCreate(false); uiGo('multi'); UI.lobbyBack = true; return; }
  uiGo('multi');
}
function playInit() {
  const el = $('playGrid'); if (!el || el._play) return;
  el._play = true;
  el.addEventListener('click', (e) => { const b = e.target.closest('[data-play]'); if (b && !b.disabled) playPick(b.dataset.play); });
  // the lobby: its friends to invite before the code and the link (NET_PAGES.invite, 09c-net.js)
  const base = NET_PAGES.invite;
  NET_PAGES.invite = () => { const p = base(); p.rows = friendsInviteRows().concat(p.rows); return p; };
}
