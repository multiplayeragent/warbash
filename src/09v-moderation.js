/* ==========================================================================
   MODERATION: screen reserved for the accounts in the server's MODERATION variable (api/_lib/moderation.js), opened from their Profile.
   Two lists: reported accounts (reasons counted, players' words, statistics to judge cheating) and blocked accounts.
   A reported photo stays blurred until touched. Actions: ignore (and restore a hidden photo), remove the photo,
   reset the display name to the username, remove from the ranking, block the account (in two steps), unblock.
   ========================================================================== */
const MOD = { view: 'open', items: [], open: 0, busy: false, loaded: false, err: '', ask: '', seen: new Set() };
const MOD_WHY = () => ({ naming: _t('Name'), photo: _t('Picture'), cheating: _t('Cheating'), behavior: _t('Behavior') });

function modLoad() {
  if (MOD.busy) return;
  MOD.busy = true; MOD.err = ''; modRender();
  acctApi('mod-list' + (MOD.view === 'blocked' ? '?view=blocked' : '')).then((r) => {
    MOD.busy = false;
    if (r.ok && r.data) { MOD.items = r.data.accounts; MOD.open = r.data.open; MOD.loaded = true; if (ACCT.user) ACCT.user.modOpen = r.data.open; }
    else MOD.err = socErr(r);
    if (UI.screen === 'moderation') modRender();
  });
}
async function modDo(username, action) {
  if (MOD.busy) return;
  if (action === 'block' && MOD.ask !== username) { MOD.ask = username; sfxUi('click'); modRender(); return; } // block: confirmed by a second tap
  MOD.ask = ''; MOD.busy = true; modRender();
  const r = await acctApi('mod-action', { username, action });
  MOD.busy = false;
  if (!r.ok) { MOD.err = socErr(r); modRender(); return; }
  sfxUi(action === 'ignore' || action === 'unblock' ? 'click' : 'back');
  modLoad();
}
function modRender() {
  const body = $('mdBody'); if (!body) return;
  if (!ACCT.user || !ACCT.user.moderator) { body.innerHTML = `<p class="hint">${_t('Moderators only.')}</p>`; return; }
  $('mdSub').textContent = MOD.view === 'blocked' ? _t('Blocked accounts') : MOD.open ? _tn(MOD.open, '{0} reported account', '{0} reported accounts') : _t('No pending reports');
  const W = MOD_WHY(), when = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : fmtDate(d, { day: 'numeric', month: 'short' }); };
  const cards = MOD.items.map((a) => {
    const blurred = (a.avatarHidden || a.reasons.photo) && !MOD.seen.has(a.username), S = a.stats;
    const kd = (k, d) => (d ? k / d : k).toFixed(2);
    const why = Object.entries(a.reasons).map(([k, n]) => `<span class="md-why">${esc(W[k] || k)} × ${n}</span>`).join('');
    const notes = a.notes.map((x) => `<li><b>${esc(x.by || '?')}</b> <small>${esc(W[x.reason] || x.reason)} · ${esc(when(x.at))}</small><br>"${esc(x.note)}"</li>`).join('');
    const b = (act, label, cls = '') => `<button class="btn ${cls}" type="button" data-md="${act}" data-u="${esc(a.username)}"${MOD.busy ? ' disabled' : ''}>${label}</button>`;
    const acts = a.blockedAt ? b('unblock', _t('Unblock'))
      : b('ignore', a.avatarHidden ? _t('Dismiss and restore the picture') : _t('Dismiss')) + (a.avatar ? b('photo', _t('Remove the picture')) : '')
        + (a.displayName !== a.username ? b('name', _t('Reset the name')) : '') + (S.xp && !a.removed ? b('board', _t('Remove from the leaderboard')) : '')
        + b('block', MOD.ask === a.username ? _t('Confirm the block') : _t('Block the account'), MOD.ask === a.username ? 'warn' : '');
    return `<div class="card md-acc">
      <div class="md-top"><button class="md-av${blurred ? 'blurred' : ''}" type="button" data-see="${esc(a.username)}" aria-label="${esc(blurred ? _t('Show the picture') : _t('Profile picture'))}"><span class="acct-av" data-u="${esc(a.username)}" data-n="${esc(a.displayName)}">${socAv(a.username, a.displayName, a.avatar)}</span>${blurred ? `<em>${_t('Show')}</em>` : ''}</button>
        <div class="md-id"><b>${esc(a.displayName)}</b><small>@${esc(a.username)} · ${_t('Level {0}', a.level)} · ${_t('Joined {0}', esc(when(a.createdAt)))}${a.blockedAt ? ' · ' + _t('blocked on {0}', esc(when(a.blockedAt))) : ''}</small>
          <small>${_t('{0} XP, {1} matches, ratio {2}', fmtNum(S.xp), S.matches, kd(S.kills, S.deaths))}${a.removed ? ' · ' + _t('removed from the leaderboard') : ''}</small></div></div>
      ${why ? `<p class="md-whys">${why}${a.avatarHidden ? `<span class="md-why hid">${_t('picture hidden')}</span>` : ''}</p>` : ''}
      ${notes ? `<ul class="md-notes">${notes}</ul>` : ''}
      <div class="btns md-acts">${acts}</div></div>`;
  }).join('');
  const empty = MOD.loaded && !MOD.items.length && !MOD.busy ? `<div class="card"><p class="hint">${MOD.view === 'blocked' ? _t('No blocked account.') : _t('No pending reports.')}</p></div>` : '';
  body.innerHTML = `<div class="rk-bar"><div class="seg" id="mdView" role="radiogroup" aria-label="${esc(_t('List to show'))}"></div><button class="btn" type="button" id="mdReload">${_t('Refresh')}</button></div>
    ${MOD.err ? `<p class="ac-err" role="alert">${esc(MOD.err)}</p>` : ''}${cards ? `<div class="md-list">${cards}</div>` : ''}${empty}${MOD.busy && !MOD.items.length ? `<p class="hint">${_t('Loading...')}</p>` : ''}`;
  seg($('mdView'), [['open', _t('Reported')], ['blocked', _t('Blocked')]], () => MOD.view, (v) => { MOD.view = v; MOD.items = []; MOD.loaded = false; MOD.ask = ''; modLoad(); });
  $('mdReload').addEventListener('click', () => { sfxUi('click'); modLoad(); });
  socAvFallback(body);
}
function modBind() {
  const body = $('mdBody'); if (body._md) return; body._md = true;
  body.addEventListener('click', (e) => {
    const a = e.target.closest('[data-md]'); if (a && !a.disabled) { modDo(a.dataset.u, a.dataset.md); return; }
    const s = e.target.closest('[data-see]'); if (s) { const u = s.dataset.see; if (MOD.seen.has(u)) MOD.seen.delete(u); else MOD.seen.add(u); sfxUi('click'); modRender(); }
  });
}
function modScreen() { modBind(); MOD.ask = ''; MOD.err = ''; modLoad(); }
