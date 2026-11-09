/* ==========================================================================
   COMMUNITY: reviews of the game, ideas and problems (server: api/_lib/communaute.js; README "Community")
   Screen opened by the Community button at the top of the main menu (logged-in players). Three tabs:
   - Reviews: the average rating, then the reviews (stars and a few words). "Give my review" after a match played, one per player;
     giving it again edits it.
   - Ideas and Problems: the most upvoted first (or the most recent). "Me too" upvotes a message, a second tap removes it.
   Each message can be reported; its author edits or deletes it. No discussion between players: under a message, only the team
   (the moderation accounts) replies. They also give a status to an idea or a problem (planned, done), hide, restore or delete
   a message, and see reported messages separately (Reported tab). The author is notified of a reply (comm_reply notification).
   ========================================================================== */
const COMM = { kind: 'review', sort: 'top', posts: [], more: false, busy: false, seq: 0, loaded: false, err: '', summary: null, myReview: null, canReview: false, mod: false, reported: 0, edit: null, ans: null, ask: '' };
const COMM_MAX = 500;
const COMM_STAR = '<path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/>';
// status given by the team: an idea is planned then added, a problem acknowledged then fixed
const commState = (kind, s) => (s === 'planned' ? (kind === 'bug' ? _t('Acknowledged') : _t('Planned')) : s === 'shipped' ? (kind === 'bug' ? _t('Fixed') : _t('Added to the game')) : '');
function commStars(n, cls) {
  let h = ''; for (let i = 1; i <= 5; i++) h += `<svg viewBox="0 0 24 24" class="${i <= n ? 'on' : ''}" aria-hidden="true">${COMM_STAR}</svg>`;
  return `<span class="cm-stars${cls ? ' ' + cls : ''}" role="img" aria-label="${esc(_tn(n, '{0} star out of 5', '{0} stars out of 5'))}">${h}</span>`;
}

function commLoad(reset) {
  const seq = ++COMM.seq; // a tab change during a load: only the last response counts
  if (reset) { COMM.posts = []; COMM.more = false; COMM.ask = ''; COMM.ans = null; }
  COMM.busy = true; COMM.err = ''; commRender();
  const qs = new URLSearchParams(COMM.kind === 'reported' ? { view: 'reported' } : { kind: COMM.kind, sort: COMM.sort });
  qs.set('offset', String(reset ? 0 : COMM.posts.length));
  acctApi('community?' + qs).then((r) => {
    if (seq !== COMM.seq) return;
    COMM.busy = false;
    if (!r.ok || !r.data) COMM.err = socErr(r);
    else {
      const d = r.data;
      COMM.posts = reset ? d.posts : COMM.posts.concat(d.posts); COMM.more = d.more; COMM.summary = d.summary; COMM.myReview = d.myReview;
      COMM.canReview = d.canReview; COMM.mod = d.mod; COMM.reported = d.reported || 0; COMM.loaded = true;
      if (COMM.kind === 'reported' && !d.mod) COMM.kind = 'review';
    }
    if (UI.screen === 'community') commRender();
  });
}

/* Opens the editor: their review (prefilled), a new idea or a new problem, or the edit of one of them (id) */
function commWrite(p) {
  const k = p ? p.kind : COMM.kind, my = k === 'review' ? COMM.myReview : null;
  COMM.edit = { id: p && k !== 'review' ? p.id : null, kind: k, rating: my ? my.rating : 0, body: p ? p.body : my ? my.body : '', err: '', busy: false };
  COMM.ans = null; COMM.ask = ''; sfxUi('click'); commRender();
  // on touch, no automatic focus: the on-screen keyboard would cover everything (as on arriving at a screen, uiGo)
  requestAnimationFrame(() => { const t = $('cmText'); if (!t) return; t.closest('.card').scrollIntoView({ block: 'nearest' }); if (!TOUCH.on || PAD.drive) t.focus({ preventScroll: true }); });
}
async function commSend() {
  const E = COMM.edit; if (!E || E.busy) return;
  if (E.kind === 'review' && !E.rating) { E.err = _t('Choose a rating from 1 to 5 stars.'); commRender(); return; }
  E.busy = true; E.err = ''; commRender();
  const r = await acctApi('community-post', { kind: E.kind, body: E.body, rating: E.rating || undefined, id: E.id || undefined });
  E.busy = false;
  if (!r.ok) { E.err = socErr(r); commRender(); return; }
  sfxUi('click'); COMM.edit = null;
  if (E.kind !== 'review' && !E.id) COMM.sort = 'new'; // a new message ends up at the top
  commLoad(true);
}
async function commAct(act, id) {
  const p = COMM.posts.find((x) => String(x.id) === String(id));
  if (act === 'write') { commWrite(null); return; }
  if (act === 'more') { commLoad(false); return; }
  if (act === 'cancel') { COMM.edit = null; sfxUi('back'); commRender(); return; }
  if (act === 'send') { commSend(); return; }
  if (!p) return;
  if (act === 'edit') { commWrite(p); return; }
  if (act === 'del' && COMM.ask !== 'del' + p.id) { COMM.ask = 'del' + p.id; sfxUi('click'); commRender(); return; } // delete: confirmed by a second tap
  if (act === 'answer') { COMM.ans = { id: p.id, kind: p.kind, status: p.status || '', reply: p.reply ? p.reply.text : '', err: '', busy: false }; COMM.edit = null; sfxUi('click'); commRender(); return; }
  if (act === 'ans-no') { COMM.ans = null; sfxUi('back'); commRender(); return; }
  COMM.ask = '';
  let r;
  if (act === 'vote') {
    r = await acctApi('community-vote', { id: p.id });
    if (r.ok) { p.voted = r.data.voted; p.votes = r.data.votes; sfxUi('click'); commRender(); return; }
  } else if (act === 'report') {
    r = await acctApi('community-report', { id: p.id });
    if (r.ok) { p.flagged = true; sfxUi('click'); commRender(); return; }
  } else if (act === 'del') {
    r = await acctApi('community-delete', { id: p.id });
    if (r.ok) { sfxUi('back'); if (p.kind === 'review' && p.mine) COMM.myReview = null; commLoad(true); return; }
  } else if (act === 'ans-go') {
    const A = COMM.ans; if (!A || A.busy) return;
    A.busy = true; commRender();
    r = await acctApi('community-mod', { id: p.id, action: 'answer', status: A.status || null, reply: A.reply });
    A.busy = false;
    if (r.ok) { COMM.ans = null; sfxUi('click'); commLoad(true); return; }
    A.err = socErr(r); commRender(); return;
  } else if (act === 'hide' || act === 'show') {
    r = await acctApi('community-mod', { id: p.id, action: act });
    if (r.ok) { sfxUi('click'); commLoad(true); return; }
  } else return;
  COMM.err = socErr(r); commRender();
}

function commPostHtml(p) {
  const A = COMM.ans && String(COMM.ans.id) === String(p.id) ? COMM.ans : null, state = commState(p.kind, p.status), mod = COMM.mod;
  const b = (act, label, cls = '', dis = false) => `<button class="btn${cls ? ' ' + cls : ''}" type="button" data-cm="${act}" data-id="${p.id}"${dis ? ' disabled' : ''}>${label}</button>`;
  let acts = '';
  if (p.kind !== 'review') acts += p.mine ? `<span class="soc-tag">${esc(_tn(p.votes, '{0} upvote', '{0} upvotes'))}</span>`
    : `<button class="btn cm-vote${p.voted ? ' on' : ''}" type="button" data-cm="vote" data-id="${p.id}" aria-pressed="${p.voted}"${p.hidden && !mod ? ' disabled' : ''}>${_t('Me too')}<b>${p.votes}</b></button>`;
  if (p.mine) acts += b('edit', _t('Edit'));
  else acts += p.flagged ? `<span class="soc-tag">${_t('Reported')}</span>` : b('report', _t('Report'));
  if (mod) acts += b('answer', p.reply || p.status ? _t('Edit reply') : _t('Reply')) + (p.hidden ? b('show', _t('Restore')) : b('hide', _t('Mute')));
  if (p.mine || mod) acts += COMM.ask === 'del' + p.id ? b('del', _t('Confirm'), 'warn') : b('del', _t('Delete'));
  const tags = (state ? `<span class="soc-tag ok">${esc(state)}</span>` : '') + (p.hidden ? `<span class="soc-tag">${_t('Hidden')}</span>` : '')
    + (mod && p.reports ? `<span class="soc-tag">${esc(_tn(p.reports, '{0} report', '{0} reports'))}</span>` : '') + (COMM.kind === 'reported' ? `<span class="soc-tag">${esc({ review: _t('Reviews'), idea: _t('Idea'), bug: _t('Issue') }[p.kind] || '')}</span>` : '');
  const ans = A ? `<div class="cm-ans">${p.kind !== 'review' ? '<div class="seg" id="cmAnsState" role="radiogroup"></div>' : ''}
      <textarea id="cmAnsText" maxlength="${COMM_MAX}" rows="3" placeholder="${esc(_t('Reply from the team (optional)'))}" aria-label="${esc(_t('Reply from the team'))}">${esc(A.reply)}</textarea>
      <p class="ac-err" role="alert">${esc(A.err)}</p>
      <div class="btns"><button class="btn primary" type="button" data-cm="ans-go" data-id="${p.id}"${A.busy ? ' disabled' : ''}>${_t('Save')}</button><button class="btn" type="button" data-cm="ans-no" data-id="${p.id}">${_t('Cancel')}</button></div></div>` : '';
  return `<article class="card cm-post${p.hidden ? ' hid' : ''}${p.mine ? ' me' : ''}">
    <div class="cm-head"><button class="cm-who" type="button" data-open="${esc(p.author.username)}" aria-label="${esc(_t('{0}\u0027s profile', p.author.displayName))}"><span class="acct-av" data-u="${esc(p.author.username)}" data-n="${esc(p.author.displayName)}">${socAv(p.author.username, p.author.displayName, p.author.avatar)}</span>
      <span class="cm-id"><b>${esc(p.author.displayName)}</b><small>${esc(socAgo(p.at))}${p.edited ? ' · ' + _t('edited') : ''}</small></span></button>
      ${p.kind === 'review' && p.rating ? commStars(p.rating) : ''}${tags ? `<span class="cm-tags">${tags}</span>` : ''}</div>
    ${p.body ? `<p class="cm-body">${esc(p.body)}</p>` : ''}
    ${p.reply ? `<div class="cm-reply"><b>${_t('Reply from the team')}</b><p>${esc(p.reply.text)}</p></div>` : ''}
    <div class="cm-acts">${acts}</div>${ans}</article>`;
}
function commEditHtml() {
  const E = COMM.edit, k = E.kind;
  const title = k === 'review' ? (COMM.myReview ? _t('Edit my review') : _t('Write a review')) : E.id ? _t('Edit message') : k === 'idea' ? _t('Suggest an idea') : _t('Report an issue');
  const hint = k === 'review' ? _t('Your rating and a few words about the game. Signed-in players will see them with your name.')
    : k === 'idea' ? _t('One idea per message. Other players can upvote it.') : _t('Say what happens, on which map and on which device.');
  const ph = k === 'review' ? _t('What you think of it (optional)') : k === 'idea' ? _t('Your idea') : _t('The issue you ran into');
  let stars = '';
  if (k === 'review') for (let n = 1; n <= 5; n++) stars += `<button class="cm-star${n <= E.rating ? ' on' : ''}" type="button" data-star="${n}" role="radio" aria-checked="${n === E.rating}" aria-label="${esc(_tn(n, '{0} star', '{0} stars'))}"><svg viewBox="0 0 24 24" aria-hidden="true">${COMM_STAR}</svg></button>`;
  return `<div class="card cm-edit"><h3 class="lbl">${title}</h3>${stars ? `<div class="cm-pick" role="radiogroup" aria-label="${esc(_t('Rating'))}">${stars}</div>` : ''}
    <p class="hint">${hint}</p>
    <textarea id="cmText" maxlength="${COMM_MAX}" rows="4" placeholder="${esc(ph)}" aria-label="${esc(title)}">${esc(E.body)}</textarea>
    <p class="cm-count" id="cmCount">${E.body.length} / ${COMM_MAX}</p>
    <p class="ac-err" role="alert">${esc(E.err)}</p>
    <div class="btns"><button class="btn primary" type="button" data-cm="send"${E.busy ? ' disabled' : ''}>${_t('Post')}</button><button class="btn" type="button" data-cm="cancel">${_t('Cancel')}</button></div></div>`;
}
function commRender() {
  const body = $('cmBody'); if (!body) return;
  if (!ACCT.user) { body.innerHTML = `<div class="card"><p class="hint">${_t('Sign in to read player reviews and write your own.')}</p></div>`; return; }
  const k = COMM.kind, S = COMM.summary;
  let write = '';
  if (k === 'review') write = COMM.canReview ? `<button class="btn primary" type="button" data-cm="write">${COMM.myReview ? _t('Edit my review') : _t('Write a review')}</button>` : COMM.loaded ? `<p class="hint">${_t('Play a match to write a review.')}</p>` : '';
  else if (k !== 'reported') write = `<button class="btn primary" type="button" data-cm="write">${k === 'idea' ? _t('Suggest an idea') : _t('Report an issue')}</button>`;
  if (COMM.edit) write = '';
  const sum = k === 'review' && S && S.count ? `<div class="card cm-sum"><b class="cm-avg">${fmtNum(S.avg, 1)}</b><div>${commStars(Math.round(S.avg), 'big')}<small>${esc(_tn(S.count, 'One review', '{0} reviews'))}</small></div></div>` : '';
  const empty = { review: _t('No reviews yet.'), idea: _t('No ideas yet.'), bug: _t('No issues reported yet.'), reported: _t('No reported messages.') }[k];
  const list = COMM.posts.map(commPostHtml).join('');
  body.innerHTML = `<div class="rk-bar"><div class="seg" id="cmTabs" role="radiogroup" aria-label="${esc(_t('Messages to show'))}"></div>${k === 'idea' || k === 'bug' ? `<div class="seg" id="cmSort" role="radiogroup" aria-label="${esc(_t('Order'))}"></div>` : ''}${write}</div>
    ${COMM.edit ? commEditHtml() : ''}<p class="ac-err" role="alert">${esc(COMM.err)}</p>${sum}
    ${list ? `<div class="cm-list">${list}</div>` : COMM.loaded && !COMM.busy ? `<div class="card"><p class="hint">${empty}</p></div>` : ''}
    ${COMM.busy ? `<p class="hint">${_t('Loading...')}</p>` : ''}${COMM.more && !COMM.busy ? `<div class="btns"><button class="btn" type="button" data-cm="more">${_t('Show more')}</button></div>` : ''}
    ${COMM.loaded && !COMM.more ? `<p class="hint cm-rules">${_t('Stay polite. Links and advertising are not allowed. A message reported by several players is hidden until the team looks at it.')}</p>` : ''}`;
  const tabs = [['review', _t('Reviews')], ['idea', _t('Ideas')], ['bug', _t('Issues')]];
  if (COMM.mod) tabs.push(['reported', COMM.reported ? _t('Reported ({0})', COMM.reported) : _t('Reported')]);
  seg($('cmTabs'), tabs, () => COMM.kind, (v) => { COMM.kind = v; COMM.edit = null; commLoad(true); });
  if ($('cmSort')) seg($('cmSort'), [['top', _t('Popular')], ['new', _t('Recent')]], () => COMM.sort, (v) => { COMM.sort = v; commLoad(true); });
  if ($('cmAnsState') && COMM.ans) { const A = COMM.ans; seg($('cmAnsState'), [['', _t('No status')], ['planned', commState(A.kind, 'planned')], ['shipped', commState(A.kind, 'shipped')]], () => A.status, (v) => { A.status = v; }); }
  socAvFallback(body);
}
function commBind() {
  const body = $('cmBody'); if (body._cm) return; body._cm = true;
  body.addEventListener('click', (e) => {
    const a = e.target.closest('[data-cm]'); if (a && !a.disabled) { commAct(a.dataset.cm, a.dataset.id); return; }
    const s = e.target.closest('[data-star]'); if (s && COMM.edit) { COMM.edit.rating = +s.dataset.star; COMM.edit.err = ''; sfxUi('click'); commRender(); requestAnimationFrame(() => { const b = body.querySelector(`[data-star="${COMM.edit && COMM.edit.rating}"]`); if (b) b.focus({ preventScroll: true }); }); return; }
    const o = e.target.closest('[data-open]'); if (o) socOpenPlayer(o.dataset.open);
  });
  body.addEventListener('input', (e) => {
    if (e.target.id === 'cmText' && COMM.edit) { COMM.edit.body = e.target.value; $('cmCount').textContent = `${e.target.value.length} / ${COMM_MAX}`; }
    else if (e.target.id === 'cmAnsText' && COMM.ans) COMM.ans.reply = e.target.value;
  });
}
/* Opens the screen on a tab (the notification of a team reply opens the message's tab) */
function commOpen(kind) { if (kind) COMM.kind = kind; sfxUi('click'); uiGo('community'); }
function commScreen() { commBind(); COMM.edit = null; COMM.ans = null; COMM.ask = ''; commLoad(true); }
