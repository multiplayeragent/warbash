/* ==========================================================================
   SOCIAL LIFE: PLAYER RANKING, PROFILES, FRIENDS AND NOTIFICATIONS
   The server (api/_lib/social.js) ranks players by all-time XP (the ranking is permanent and shared by everyone). Three screens,
   opened from the buttons at the top of the main menu:
   - "Players" (ranking): the ranking, with search by name and "My friends" filter, 25 players at a time;
   - a player's public profile (player): level, rank and XP, statistics, latest matches, and the friend button that fits the relationship's state;
   - notifications (notifs): friend requests (to accept or decline on the spot), replies, levels gained, welcome.
   A player's profile photo, if they have one, shows in the ranking and on their profile
   (/api/avatar?u=, reserved for logged-in players), otherwise an initial and a tint.
   The server only keeps the notification's kind: the text is built here, in the player's language. The number of unread
   notifications shows on the bell, fetched at login, every minute in the main menu, and on every return to the page.
   ========================================================================== */
const SOC = {
  rank: { scope: 'all', q: '', players: [], more: false, me: null, busy: false, err: '' },
  player: { u: '', data: null, err: '', busy: false, rep: null }, // rep: report being written (reason, word, sent)
  notifs: { items: [], unread: 0, loaded: false, busy: false, fresh: new Set() },
  timer: 0, busy: false,
};

/* Who can see these screens: a logged-in account; main menu buttons and bell */
function socChanged() {
  const on = !!ACCT.user;
  for (const id of ['friendsBtn', 'rankBtn', 'commBtn', 'notifBtn']) { const b = $(id); if (b) b.classList.toggle('hidden', !on); }
  friendsChanged(); // presence, invitations to a lobby (09ta-friends.js)
  if (!on) { SOC.notifs = { items: [], unread: 0, loaded: false, busy: false, fresh: new Set() }; SOC.rank.players = []; SOC.rank.me = null; socBadge(); clearInterval(SOC.timer); SOC.timer = 0; return; }
  if (!SOC.timer) {
    SOC.timer = setInterval(() => { if (!document.hidden && MATCH.state === 'menu' && UI.screen !== 'notifs') socNotifLoad(); }, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && ACCT.user && MATCH.state === 'menu') socNotifLoad(); });
  }
  if (!SOC.notifs.loaded && !SOC.notifs.busy) socNotifLoad();
}
function socBadge() {
  const n = SOC.notifs.unread, b = $('notifBadge'); if (!b) return;
  b.textContent = n > 9 ? '9+' : String(n); b.classList.toggle('hidden', n < 1);
  const btn = $('notifBtn'); if (btn) btn.setAttribute('aria-label', n ? _tn(n, 'Notifications: {0} unread', 'Notifications: {0} unread') : _t('Notifications'));
}

/* Another player's avatar: their photo, otherwise a tint drawn from their name and their initial (unreadable photo: fall back to the initial) */
const socAv = (username, name, avatar) => acctAvatar({ username, displayName: name || username, avatar, other: true }, 0);
function socAvFallback(root) {
  for (const im of root.querySelectorAll('.acct-av img')) im.addEventListener('error', () => { const box = im.parentElement, u = box.dataset.u; box.innerHTML = acctAvatar({ username: u, displayName: box.dataset.n, avatar: null }, 0); }, { once: true });
}
const socErr = (r) => (r.data && r.data.error) || AC_ERR[r.status] || _t('An error occurred.');
/* Age of a notification */
function socAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (!(s < 1e10)) return '';
  if (s < 90) return _t('just now');
  if (s < 5400) return _t('{0} min ago', Math.round(s / 60));
  if (s < 129600) return _t('{0} h ago', Math.round(s / 3600));
  return _t('{0} d ago', Math.round(s / 86400));
}

/* ---------- Friends: a single path for all screens ---------- */
const SOC_CALL = {
  add: (u) => acctApi('friend-request', { username: u }),
  accept: (u) => acctApi('friend-respond', { username: u, accept: true }),
  decline: (u) => acctApi('friend-respond', { username: u, accept: false }),
  remove: (u) => acctApi('friend-remove', { username: u }),
};
/* A player's friend buttons depending on the relationship (none, sent, received, friend) */
function socFriendBtns(u, rel, big) {
  const b = (act, label, cls = '') => `<button class="btn ${cls}" type="button" data-act="${act}" data-u="${esc(u)}">${label}</button>`;
  if (rel === 'none') return b('add', _t('Add friend'), big ? 'primary' : '');
  if (rel === 'sent') return `<span class="soc-tag">${_t('Request sent')}</span>${big ? b('remove', _t('Cancel request')) : ''}`;
  if (rel === 'received') return b('accept', _t('Accept'), 'primary') + b('decline', _t('Decline'));
  if (rel === 'friend') return `<span class="soc-tag ok">${_t('Friend')}</span>${big ? b('remove', _t('Remove friend')) : ''}`;
  return '';
}
async function socDo(act, u, errBox) {
  if (SOC.busy) return; SOC.busy = true;
  try {
    const r = await SOC_CALL[act](u);
    if (!r.ok) { if (errBox) errBox.textContent = socErr(r); if (r.status === 422) socReload(); return; }
    sfxUi(act === 'decline' || act === 'remove' ? 'back' : 'click');
    const rel = r.data.relation;
    for (const p of SOC.rank.players) if (p.username === u) p.relation = rel;
    if (SOC.player.data && SOC.player.u.toLowerCase() === u.toLowerCase()) SOC.player.data.relation = rel;
    SOC.notifs.items = SOC.notifs.items.filter((n) => !(n.kind === 'friend_request' && n.from && n.from.username === u));
    if (UI.screen === 'ranking') { if (SOC.rank.scope === 'friends' && (act === 'remove')) socRankLoad(true); else socRankRender(); }
    else if (UI.screen === 'player') socPlayerRender();
    else if (UI.screen === 'notifs') socNotifRender();
    socNotifLoad(); friendsLoad();
  } finally { SOC.busy = false; }
}
function socReload() { if (UI.screen === 'ranking') socRankLoad(true); else if (UI.screen === 'player') socPlayerLoad(SOC.player.u); else if (UI.screen === 'notifs') socNotifLoad(); }
/* A click on a [data-act] button or a [data-open] row of the root */
function socBind(root, errId) {
  if (root._soc) return; root._soc = true;
  root.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]');
    if (a && root.contains(a)) { e.stopPropagation(); if (a.dataset.act === 'more') { socRankLoad(false); return; } socDo(a.dataset.act, a.dataset.u, $(errId)); return; }
    const o = e.target.closest('[data-open]');
    if (o && root.contains(o)) socOpenPlayer(o.dataset.open);
    const c = e.target.closest('[data-comm]'); // notification of a team reply: the message's tab
    if (c && root.contains(c)) commOpen(['review', 'idea', 'bug'].includes(c.dataset.comm) ? c.dataset.comm : '');
  });
}
function socOpenPlayer(u) {
  if (ACCT.user && u.toLowerCase() === ACCT.user.username.toLowerCase()) { sfxUi('click'); uiGo('profile'); return; }
  SOC.player = { u, data: null, err: '', busy: false, rep: null };
  sfxUi('click'); uiGo('player');
}

/* ---------- Leaderboard ---------- */
function socRankLoad(reset) {
  const R = SOC.rank; if (R.busy) return;
  if (reset) { R.players = []; R.more = false; }
  R.busy = true; R.err = ''; socRankRender();
  const qs = new URLSearchParams({ scope: R.scope, offset: String(reset ? 0 : R.players.length) }); if (R.q) qs.set('q', R.q);
  acctApi('leaderboard?' + qs).then((r) => {
    R.busy = false;
    if (!r.ok) R.err = socErr(r); else { R.players = reset ? r.data.players : R.players.concat(r.data.players); R.more = r.data.more; R.me = r.data.me; R.loaded = true; }
    if (UI.screen === 'ranking') socRankRender();
  });
}
function socRankRender() {
  const body = $('rkBody'); if (!body) return;
  const R = SOC.rank;
  if (!ACCT.user) { body.innerHTML = `<p class="hint">${_t('Sign in to see the leaderboard.')}</p>`; return; }
  $('rkSub').textContent = !R.loaded ? '' : (R.me && R.me.rank ? _t('You are {0} out of {1} players', ordinal(R.me.rank), fmtNum(R.me.total)) : _t('You are not ranked yet'));
  const rows = R.players.map((p) => `<div class="rk-row${p.relation === 'me' ? ' me' : ''}" data-open="${esc(p.username)}" role="button" tabindex="0" aria-label="${esc(_t('{0}\u0027s profile, level {1}', p.displayName, p.level))}">
      <b class="rk-n">${p.rank || '-'}</b><span class="acct-av" data-u="${esc(p.username)}" data-n="${esc(p.displayName)}">${socAv(p.username, p.displayName, p.avatar)}</span>
      <span class="rk-id"><b>${esc(p.displayName)}</b><small>@${esc(p.username)} · ${_t('Level {0}', p.level)}</small></span>
      <span class="rk-st"><b>${fmtNum(p.xp)}</b><small>XP</small></span><span class="rk-st"><b>${fmtNum(p.kd, 2)}</b><small>${_t('K/D ratio')}</small></span>
      <span class="rk-act">${p.relation === 'me' ? `<span class="soc-tag">${_t('You')}</span>` : socFriendBtns(p.username, p.relation, false)}</span></div>`).join('');
  const empty = !R.players.length && !R.busy ? `<p class="hint">${R.scope === 'friends' && !R.q ? _t('You have no friends yet. Find players in the overall leaderboard and add them.') : R.q ? _t('No player found.') : _t('Nobody is ranked yet.')}</p>` : '';
  const how = R.loaded && !R.err ? `<p class="hint rk-how">${_t('Players are ranked by all the XP they have earned since signing up. The leaderboard never starts over.')}</p>` : '';
  body.innerHTML = `<div class="rk-bar"><div class="seg" id="rkScope" role="radiogroup" aria-label="${esc(_t('Players to show'))}"></div>
      <form class="rk-find" id="rkFind"><input name="q" maxlength="32" value="${esc(R.q)}" placeholder="${esc(_t('Search for a player'))}" aria-label="${esc(_t('Search for a player'))}" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="btn" type="submit">${_t('Search')}</button></form></div>
    <p class="ac-err" id="rkErr" role="alert">${esc(R.err)}</p>
    <div class="rk-list">${rows}</div>${empty}${R.busy ? `<p class="hint">${_t('Loading...')}</p>` : ''}${R.more || R.busy ? '' : how}
    ${R.more && !R.busy ? `<div class="btns"><button class="btn" type="button" data-act="more">${_t('Show more')}</button></div>` : ''}`;
  seg($('rkScope'), [['all', _t('All players')], ['friends', _t('My friends')]], () => R.scope, (v) => { R.scope = v; socRankLoad(true); });
  $('rkFind').addEventListener('submit', (e) => { e.preventDefault(); R.q = String(new FormData(e.target).get('q')).trim(); socRankLoad(true); });
  socAvFallback(body);
  for (const r of body.querySelectorAll('.rk-row')) r.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === r) { e.preventDefault(); socOpenPlayer(r.dataset.open); } });
}

/* ---------- A player's profile ---------- */
function socPlayerLoad(u) {
  const P = SOC.player; P.busy = true; P.err = ''; socPlayerRender();
  acctApi('player?u=' + encodeURIComponent(u)).then((r) => {
    if (SOC.player !== P) return;
    P.busy = false; if (r.ok) P.data = r.data; else P.err = socErr(r);
    if (UI.screen === 'player') socPlayerRender();
  });
}
function socPlayerRender() {
  const body = $('plBody'); if (!body) return;
  const P = SOC.player, d = P.data;
  $('plSub').textContent = d ? `@${d.user.username}` : P.u ? `@${P.u}` : '';
  if (!d) { body.innerHTML = P.err ? `<div class="card"><p class="ac-err" role="alert">${esc(P.err)}</p><div class="btns"><button class="btn" type="button" id="plRetry">${_t('Try again')}</button></div></div>` : `<p class="hint">${_t('Loading...')}</p>`; if ($('plRetry')) $('plRetry').addEventListener('click', () => socPlayerLoad(P.u)); return; }
  const L = d.level;
  const rows = acctGamesHtml(d.recent, false); // no XP or play time: the server doesn't give them for another player
  const since = new Date(d.user.createdAt), sinceTxt = isNaN(since) ? '' : ` · ${_t('Joined {0}', fmtDate(since, { day: 'numeric', month: 'long', year: 'numeric' }))}`;
  // report (name, photo, cheating, behavior): a form under the profile header, sent to moderation (api/_lib/moderation.js)
  const rep = P.rep, mine = d.relation === 'me';
  const repBtn = mine ? '' : rep && rep.sent ? `<span class="soc-tag">${_t('Reported')}</span>` : `<button class="btn" type="button" id="plRep" aria-expanded="${rep ? 'true' : 'false'}">${_t('Report')}</button>`;
  const repCard = rep && !rep.sent ? `<div class="card pl-rep"><h3 class="lbl">${_t('Report {0}', esc(d.user.displayName))}</h3>
      <p class="hint">${_t('The moderators look at every report. What is the reason?')}</p>
      <div class="seg" id="plRepWhy" role="radiogroup" aria-label="${esc(_t('Reason for the report'))}"></div>
      <input id="plRepNote" maxlength="200" value="${esc(rep.note)}" placeholder="${esc(_t('Add details if needed (optional)'))}" aria-label="${esc(_t('Add details if needed (optional)'))}" autocomplete="off">
      <p class="ac-err" id="plRepErr" role="alert">${esc(rep.err)}</p>
      <div class="btns"><button class="btn primary" type="button" id="plRepGo"${rep.why && !rep.busy ? '' : ' disabled'}>${_t('Send the report')}</button><button class="btn" type="button" id="plRepNo">${_t('Cancel')}</button></div></div>` : '';
  body.innerHTML = `${rep && rep.sent ? `<p class="ac-note">${_t('Thank you: the moderators will look at this report.')}</p>` : ''}<div class="card ac-top"><span class="acct-av pl-av" data-u="${esc(d.user.username)}" data-n="${esc(d.user.displayName)}">${socAv(d.user.username, d.user.displayName, d.user.avatar)}</span>
      <div class="ac-id"><h3>${esc(d.user.displayName)}</h3><p>@${esc(d.user.username)} · ${_t('Level {0}', L.level)}${d.rank ? ' · ' + _t('Ranked {0}', ordinal(d.rank)) : ''}${esc(sinceTxt)}</p>
        <div class="ac-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${L.need}" aria-valuenow="${L.into}"><i style="transform:scaleX(${L.need ? L.into / L.need : 1})"></i></div>
        <div class="soc-acts">${mine ? `<button class="btn" type="button" id="plMine">${_t('My profile')}</button>` : socFriendBtns(d.user.username, d.relation, true)}${repBtn}</div>
        <p class="ac-err" id="plErr" role="alert"></p></div></div>${repCard}
    <div class="ac-cols pl-cols">
      <div class="card pl-rank"><h3 class="lbl">${_t('Ranking')}</h3>${d.rank ? acctKpis([[ordinal(d.rank), _t('Rank')], [fmtNum(L.xp), 'XP']]) : `<p class="hint">${_t('Not ranked yet.')}</p>`}</div>
      <div class="card ac-games"><h3 class="lbl">${_t('Recent matches')}</h3>${rows || `<p class="hint">${_t('No match recorded.')}</p>`}</div></div>
    ${acctStatsHtml(d.stats, false)}`;
  socAvFallback(body);
  if ($('plMine')) $('plMine').addEventListener('click', () => { sfxUi('click'); uiGo('profile'); });
  if ($('plRep')) $('plRep').addEventListener('click', () => { sfxUi('click'); P.rep = P.rep ? null : { why: '', note: '', err: '', busy: false, sent: false }; socPlayerRender(); });
  if (rep && !rep.sent) {
    const why = [['naming', _t('Name')], ...(d.user.avatar ? [['photo', _t('Picture')]] : []), ['cheating', _t('Cheating')], ['behavior', _t('Behavior')]];
    seg($('plRepWhy'), why, () => rep.why, (v) => { rep.why = v; $('plRepGo').disabled = false; });
    $('plRepNote').addEventListener('input', (e) => { rep.note = e.target.value; });
    $('plRepNo').addEventListener('click', () => { sfxUi('back'); P.rep = null; socPlayerRender(); });
    $('plRepGo').addEventListener('click', async () => {
      if (!rep.why || rep.busy) return;
      rep.busy = true; rep.err = ''; $('plRepGo').disabled = true;
      const r = await acctApi('report', { username: d.user.username, reason: rep.why, note: rep.note });
      rep.busy = false;
      if (SOC.player !== P || P.rep !== rep) return;
      if (r.ok) { rep.sent = true; sfxUi('click'); } else rep.err = socErr(r);
      if (UI.screen === 'player') socPlayerRender();
    });
  }
}

/* ---------- Notifications ---------- */
function socNotifLoad() {
  const N = SOC.notifs; if (N.busy || !ACCT.user) return;
  N.busy = true;
  acctApi('notifications').then((r) => {
    N.busy = false; if (!r.ok || !r.data) return;
    if (N.loaded && r.data.unread > N.unread) sfxUi('notify'); // new notification since the last fetch
    N.loaded = true; N.unread = r.data.unread; N.items = r.data.items; socBadge();
    if (UI.screen === 'notifs') socNotifRender();
  });
}
/* A notification's text (the server only sends the kind) */
function socNotifText(n) {
  const who = n.from ? `<b>${esc(n.from.displayName)}</b>` : '';
  if (n.kind === 'friend_request') return _t('{0} sent you a friend request.', who);
  if (n.kind === 'friend_accepted') return _t('{0} accepted your friend request.', who);
  if (n.kind === 'salon_invite') return _t('{0} invited you to their lobby {1}.', who, esc(String(n.data && n.data.code || '')));
  if (n.kind === 'levelup') return _t('You reached level {0}!', esc(String(n.data && n.data.level || '')));
  if (n.kind === 'welcome') return _t('Welcome to War Bash! Find the other players in the leaderboard and add them as friends.');
  if (n.kind === 'mod_photo') return _t('The moderators removed your profile picture. It did not follow the game rules.');
  if (n.kind === 'mod_name') return _t('The moderators reset your display name to your username. The old one did not follow the game rules.');
  if (n.kind === 'mod_board') return _t('The moderators removed you from the leaderboard (cheating or abuse).');
  if (n.kind === 'comm_reply') return _t('The team replied to your message in Community.');
  if (n.kind === 'recovery') return _t('A new recovery code was created for your account. If it was not you, change your password in Profile. That also replaces the code.');
  return '';
}
/* A notification's pictogram by kind: the shape says it (add, accept, level, welcome, recovery code, moderation), the color backs it up */
const NF_IC = {
  friend_request: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M19 8v6M16 11h6"/>',
  friend_accepted: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M15.5 11l2.2 2.2 4-4.4"/>',
  salon_invite: '<path d="M3.5 6.5h17v11h-17z"/><path d="M3.5 7l8.5 6.5L20.5 7"/>',
  levelup: '<path d="M6 12.5l6-6 6 6M6 18.5l6-6 6 6"/>',
  welcome: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z"/>',
  recovery: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M15.5 7.5l3 3M13.5 9.5l2 2"/>',
  mod: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M12 8v5M12 16.5v.2"/>',
  comm_reply: '<path d="M4 4.5h16v11H9.5L5 19.5v-4H4z"/><path d="M8 9h8M8 12h5"/>',
};
function socNotifRender() {
  const body = $('nfBody'); if (!body) return;
  const N = SOC.notifs;
  if (!ACCT.user) { body.innerHTML = `<p class="hint">${_t('Sign in to see your notifications.')}</p>`; return; }
  const items = N.items.filter((n) => socNotifText(n));
  for (const n of N.items) if (!n.read) N.fresh.add(n.id); // what is new stays highlighted for the duration of the visit
  const li = items.map((n) => `<li class="nf${N.fresh.has(n.id) ? ' new' : ''}"><span class="nf-ic nf-${esc(n.kind)}" aria-hidden="true"><svg viewBox="0 0 24 24">${NF_IC[n.kind] || NF_IC[n.kind.startsWith('mod_') ? 'mod' : 'welcome']}</svg></span>
      <div class="nf-tx"><p>${socNotifText(n)}</p><small>${N.fresh.has(n.id) ? `<span class="nf-tag">${_t('New')}</span>` : ''}${esc(socAgo(n.at))}</small>
        ${n.from && n.kind !== 'levelup' ? `<div class="nf-acts">${n.pending ? socFriendBtns(n.from.username, 'received', false) : ''}<button class="btn" type="button" data-open="${esc(n.from.username)}">${_t('View profile')}</button></div>` : ''}${n.kind === 'comm_reply' ? `<div class="nf-acts"><button class="btn" type="button" data-comm="${esc(n.data && n.data.k || '')}">${_t('See the reply')}</button></div>` : ''}</div></li>`).join('');
  body.innerHTML = `<p class="ac-err" id="nfErr" role="alert"></p>
    ${li ? `<ul class="nf-list">${li}</ul><div class="btns"><button class="btn" type="button" id="nfClear">${_t('Clear read notifications')}</button></div>` : `<div class="card"><p class="hint">${N.loaded ? _t('No notifications yet.') : _t('Loading...')}</p></div>`}`;
  const c = $('nfClear'); if (c) c.addEventListener('click', async () => { const r = await acctApi('notifications-read', { clear: true }); if (r.ok) { sfxUi('back'); N.fresh.clear(); socNotifLoad(); } });
  // screen opened: everything is read on the server side
  if (N.unread) { N.unread = 0; for (const n of N.items) n.read = true; socBadge(); acctApi('notifications-read', {}); }
}

/* ---------- Screens ---------- */
function socScreen(name) {
  if (name === 'ranking') { socBind($('rkBody'), 'rkErr'); SOC.rank.me = null; socRankLoad(true); }
  else if (name === 'player') { socBind($('plBody'), 'plErr'); socPlayerLoad(SOC.player.u); }
  else if (name === 'notifs') { socBind($('nfBody'), 'nfErr'); SOC.notifs.fresh.clear(); socNotifRender(); socNotifLoad(); }
}
function socInit() { socChanged(); }
