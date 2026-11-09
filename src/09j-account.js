/* ==========================================================================
   ACCOUNTS AND PROGRESSION
   The server (api/, Vercel functions + Postgres database) holds the accounts: unique username (the public, fixed identifier),
   editable display name, password and recovery code (hashed), level and statistics. No e-mail address or other data
   that identifies the person: the recovery code, shown only once, is the only way to recover a forgotten password.
   This file is the game's side of it:
   - login (username), account creation (open immediately), forgotten password (name, recovery code, new password);
   - recovery code screen (acctShowCode): at sign-up, at the first login of an account that had none, after a
     recovery and when the player asks for a new one; it takes precedence over everything else until the player says they noted it;
   - Profile screen: level, statistics, latest matches, display name, password, recovery code, data export (GDPR),
     account deletion; legal texts in 09k-legal.js;
   - account required for multiplayer (Solo stays open to everyone); without an accounts server (page opened from a
     file, server unreachable), nothing is required;
   - match tracking: a token at opening (match-start), a summary at the end (match-end); the server caps this summary by the
     real duration and computes XP alone, the game never announces points.
   ========================================================================== */
/* War Bash has no accounts server (outside the project's scope): accounts stay "unavailable" (state off), with no request */
const ACCT_SERVER = false;
const ACCT = {
  state: 'init', // init, ready (server reachable) or off (accounts unavailable: nothing is required)
  user: null, level: null, stats: null, recent: [],
  view: 'login', err: '', note: '', busy: false, match: null, lobby: '', ready: null, draft: {},
  code: '', codeNote: '', codeThen: null, // recovery code to show (see acctShowCode), announcement above it, continuation once noted
};

/* Device memory: the last logged-in account (name, display name, level, photo). It makes the player recognized right away, before the server's
   response or if it is struggling, and leaves their name at login; on = false after a deliberate logout or an expired session. The session itself
   is a server cookie, extended on every visit (api/_lib/handlers.js, renewSession). */
const ACCT_KEY = 'dc_acct';
function acctHint() { try { const h = JSON.parse(localStorage.getItem(ACCT_KEY) || 'null'); return h && typeof h.u === 'string' && typeof h.n === 'string' ? h : null; } catch (e) { return null; } }
function acctHintSet(h) { try { if (h) localStorage.setItem(ACCT_KEY, JSON.stringify(h)); else localStorage.removeItem(ACCT_KEY); } catch (e) { /* ignored */ } }

/* API call: { ok, status, data }; never an exception (network down: status 0) */
async function acctApi(name, body, ms = 12000) {
  if (location.protocol === 'file:' || !ACCT_SERVER) return { ok: false, status: 0, data: null };
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch('/api/' + name, {
      method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', signal: ctl.signal,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data = null; try { data = await r.json(); } catch (e) { /* response without a body */ }
    return { ok: r.ok, status: r.status, data };
  } catch (e) { return { ok: false, status: 0, data: null }; } finally { clearTimeout(to); }
}
function acctApply(d) {
  ACCT.user = d.user || null; ACCT.level = d.level || null; ACCT.stats = d.stats || null; ACCT.recent = d.recent || [];
  if (ACCT.user) acctHintSet({ u: ACCT.user.username, n: ACCT.user.displayName, l: ACCT.level ? ACCT.level.level : 1, a: ACCT.user.avatar || 0, on: true });
  if (ACCT.user && ARS.synced !== ACCT.user.username) { ARS.synced = ACCT.user.username; arsSync(); } // the account's weapon progression, once per login
}
function acctForget() { ACCT.user = null; ACCT.level = null; ACCT.stats = null; ACCT.recent = []; ACCT.view = 'login'; }
async function acctLoad() {
  let r = await acctApi('me');
  // server waking up, network hiccup: retry before declaring accounts unavailable
  for (const wait of [1200, 3500]) { if (r.ok || (r.status > 0 && r.status < 500) || location.protocol === 'file:' || !ACCT_SERVER) break; await new Promise((x) => setTimeout(x, wait)); r = await acctApi('me'); }
  const h = acctHint();
  if (r.ok && r.data) {
    ACCT.state = 'ready'; acctApply(r.data);
    if (!ACCT.user && h) { // no more session: keep their name at hand, and tell them why
      if (h.on) { acctHintSet({ ...h, on: false }); if (!ACCT.note) ACCT.note = _t('Your session has expired. Please log in again.'); }
      if (!ACCT.draft.u) ACCT.draft = { ...ACCT.draft, u: h.u };
    }
  } else if (ACCT.state !== 'ready') { ACCT.state = 'off'; ACCT.user = null; } // (already logged in and server unreachable for a moment: keep what we know)
  acctChanged();
  return r.ok;
}
/* The display name serves as the online nickname; the main menu and the open screen follow */
function acctChanged() {
  acctChip(); socChanged();
  classFix(); if (UI.screen === 'classes') classesHeader(); PICKERS.forEach(renderPicker); // the account's level unlocks custom classes
  acctSyncMulti(); netLevelSync(); if (UI.screen === 'multi') netRender(); // (the level, raised after a match, is announced in the lobby)
  if (UI.screen === 'profile') acctRender();
  skinAcct(); // a unique outfit is only worn with its account (09u-outfits.js)
}

/* Main menu chip, top right: "Log in" without an account, otherwise the avatar, display name and level (click: Profile) */
const AC_SILHOUETTE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12.2a4.6 4.6 0 1 0 0-9.2 4.6 4.6 0 0 0 0 9.2Zm0 2.3c-4.2 0-8 2.2-8 5.4 0 .6.4 1.1 1 1.1h14c.6 0 1-.5 1-1.1 0-3.2-3.8-5.4-8-5.4Z"/></svg>';
/* Avatar: the player's profile photo (see 09p-avatar.js), otherwise a tint drawn from their username and their initial */
function acctAvatar(user, level) {
  if (!user) return `<span>${AC_SILHOUETTE}</span>`;
  if (user.avatar) return `<img src="/api/avatar?${user.other ? `u=${encodeURIComponent(user.username)}&` : ''}v=${user.avatar}" alt="" draggable="false" loading="lazy">${level ? `<i>${level}</i>` : ''}`;
  let h = 0; for (const c of String(user.username)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  return `<span style="background:linear-gradient(145deg,hsl(${hue} 52% 62%),hsl(${(hue + 40) % 360} 46% 40%))">${esc(String(user.displayName || '').trim().charAt(0).toUpperCase() || '?')}</span>${level ? `<i>${level}</i>` : ''}`;
}
/* Unreadable photo (network down, session expired): fall back to the initial */
function acctAvatarFallback(box, u, level) {
  const im = box.querySelector('img');
  if (im) im.addEventListener('error', () => { box.innerHTML = acctAvatar({ ...u, avatar: null }, level); }, { once: true });
}
function acctChip() {
  if (!ACCT_SERVER) { rankChip(); return; } // without accounts: the chip shows the player's rank (09sa-grades.js)
  const chip = $('acctChip'); if (!chip) return;
  // no server response yet (or server unreachable): the player already logged in on this device is recognized from the device memory
  const h = !ACCT.user && ACCT.state !== 'ready' ? acctHint() : null, known = h && h.on ? { username: h.u, displayName: h.n, avatar: h.a } : null;
  const u = ACCT.user || known, lv = ACCT.user ? (ACCT.level ? ACCT.level.level : 1) : known ? h.l : 0;
  chip.classList.toggle('out', !u);
  $('acctAv').innerHTML = acctAvatar(u, lv);
  acctAvatarFallback($('acctAv'), u, lv);
  $('acctName').textContent = u ? u.displayName : ACCT.state === 'off' ? _t('Profile') : _t('Sign in');
  $('acctSub').textContent = ACCT.user ? (ACCT.user.hasRecovery === false ? _t('Level {0} · create your recovery code', lv) : _t('Level {0} · view my profile', lv)) : known ? (ACCT.state === 'off' ? _t('Account unreachable for now') : _t('Signing in...')) : ACCT.state === 'off' ? _t('Accounts unavailable here') : _t('Level, stats and multiplayer');
  chip.setAttribute('aria-label', u ? `${_t('{0}\u0027s profile, level {1}', u.displayName, lv)}` : _t('Sign in'));
}

/* ---------- Multiplayer: account required ---------- */
function acctOnlineOk() { return ACCT.state === 'off' || !!ACCT.user; }
/* Blocks the lobby for anyone not logged in; the online nickname is the account's */
function acctSyncMulti() {
  const nm = $('netName');
  if (nm) { nm.readOnly = !!ACCT.user; nm.title = ACCT.user ? _t('Your display name (change it in Profile)') : ''; if (ACCT.user) nm.value = ACCT.user.displayName; }
}
/* Called before creating or joining a lobby: returns false (and opens the Profile) if the login is missing */
function acctGate(code) {
  if (acctOnlineOk()) return true;
  if (code) ACCT.lobby = code;
  ACCT.note = code ? `${_t('Sign in to join lobby {0}.', code)}` : _t('Sign in to play online.');
  ACCT.view = 'login';
  if (MATCH.state === 'menu') uiGo('profile');
  return false;
}
/* Invite link: wait to know whether the player is logged in */
function acctWhenReady(fn) { (ACCT.ready || Promise.resolve()).then(fn); }

/* ---------- Profile screen ---------- */
const AC_ERR = { 0: _t('Server unreachable: try again in a moment.') };
function acctRefreshScreen() {
  if (ACCT.noteSeen) { ACCT.note = ''; ACCT.noteSeen = false; } // a profile announcement stays displayed for one visit only
  if (ACCT.state === 'ready' && !ACCT.busy) acctLoad();
  acctRender();
}
function acctRender() {
  const body = $('acBody'); if (!body) return;
  const sub = $('acSub');
  $('scr-profile').classList.toggle('ac-coding', !!ACCT.code); // code screen: no Back button (see uiBack)
  if (ACCT.state === 'init') { sub.textContent = _t('Account and progression'); body.innerHTML = _t('<p class="hint">Loading the profile...</p>'); return; }
  if (ACCT.state === 'off') {
    sub.textContent = _t('Accounts unavailable'); body.innerHTML = _t('<div class="card"><p class="hint">Accounts cannot be reached from this page (page opened from a file, or server unreachable). You can play without an account. Progression is not saved.</p><button class="btn" id="acRetry" type="button">Retry</button></div>');
    $('acRetry').addEventListener('click', async () => { await acctLoad(); acctRender(); });
    return;
  }
  if (ACCT.code) return acctRenderCode(body, sub);
  if (!ACCT.user) return acctRenderAuth(body, sub);
  acctRenderProfile(body, sub);
}
/* Form: submit without reload, button locked during the call */
function acctForm(form, onSubmit) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); if (ACCT.busy) return;
    ACCT.busy = true; ACCT.err = ''; const btn = form.querySelector('[type=submit]'); btn.disabled = true;
    try { await onSubmit(new FormData(form)); } finally { ACCT.busy = false; if (btn.isConnected) btn.disabled = false; }
  });
}
function acctFail(r, id = 'acErr') {
  ACCT.err = (r.data && r.data.error) || AC_ERR[r.status] || _t('An error occurred.');
  const el = $(id); if (el) el.textContent = ACCT.err;
  sfxUi('error');
}
function acctGo(view, extra = {}) { ACCT.view = view; ACCT.err = ''; Object.assign(ACCT, extra); acctRender(); sfxUi('click'); }
/* Terms checkbox: the links open the texts without losing the input */
function acctAcceptHtml(checked) {
  return `<label class="ac-check"><input type="checkbox" name="accept"${checked ? ' checked' : ''} required><span>${_t('I am at least 15 years old and I accept the')} <button class="link" type="button" data-legal="terms">${_t('terms of use')}</button> ${_t('and the')} <button class="link" type="button" data-legal="privacy">${_t('privacy policy')}</button>.</span></label>`;
}
function acctLegalLinks(body, form) {
  for (const b of body.querySelectorAll('[data-legal]')) b.addEventListener('click', () => {
    if (form) { const fd = new FormData(form); ACCT.draft = { u: fd.get('u') || '', a: !!fd.get('accept') }; }
    legalGo(b.dataset.legal);
  });
}
/* After login or sign-up: the lobby that was waiting for it (invite link, Multiplayer menu) */
function acctLobbyGo() { if (ACCT.lobby) { const c = ACCT.lobby; ACCT.lobby = ''; uiGo('multi', false); netJoinCode(c); } }
function acctRenderAuth(body, sub) {
  const v = ACCT.view, d = ACCT.draft || {};
  const note = ACCT.note ? `<p class="ac-note" role="status">${esc(ACCT.note)}</p>` : '';
  const side = `<div class="card"><h3 class="lbl">${_t('Why an account?')}</h3>
      <p class="hint">${_t('Your level, experience and stats follow you from one device to another. Multiplayer requires an account. Solo can be played without one, but nothing is saved.')}</p>
      <p class="hint">${_t('No email address. A username and a password are all you need. Other signed-in players see your username, display name, level, statistics and picture. Avoid putting your real name there.')} <button class="link" type="button" data-legal="privacy">${_t('Privacy policy')}</button></p></div>`;
  const tabs = _t('<div class="seg" id="acTabs" role="radiogroup" aria-label="Sign in or create an account"></div>');
  if (v === 'recover') {
    sub.textContent = _t('Forgot password');
    body.innerHTML = `<div class="ac-grid"><div class="card ac-form"><h3 class="lbl">${_t('Forgot password')}</h3>${note}
      <form><label class="ac-in"><span>${_t('Username')}</span><input name="u" maxlength="16" autocomplete="username" autocapitalize="off" spellcheck="false" value="${esc(d.u || '')}" required></label>
        <label class="ac-in"><span>${_t('Recovery code')}</span><input class="ac-codein" name="c" maxlength="40" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXX-XXXXX-XXXXX-XXXXX" required></label>
        <label class="ac-in"><span>${_t('New password')}</span><input name="p" type="password" maxlength="128" autocomplete="new-password" required></label>
        <p class="hint">${_t('The recovery code is shown when the account is created. Without it, a forgotten password cannot be recovered. The game keeps no email address. Your other devices will be signed out.')}</p>
        <p class="ac-err" id="acErr" role="alert">${esc(ACCT.err)}</p><button class="btn primary" type="submit">${_t('Change the password')}</button></form>
      <div class="btns"><button class="btn" id="acBack" type="button">${_t('Back')}</button></div></div>${side}</div>`;
    $('acBack').addEventListener('click', () => acctGo('login'));
    acctForm(body.querySelector('form'), async (fd) => {
      const r = await acctApi('password-recover', { username: String(fd.get('u')).trim(), code: String(fd.get('c')), password: String(fd.get('p')) });
      if (!r.ok) return acctFail(r);
      ACCT.draft = {}; ACCT.view = 'login'; acctApply(r.data); sfxUi('confirm');
      acctShowCode(r.data.recoveryCode, _t('Password changed. Your old recovery code no longer works. Here is the new one.'), acctLobbyGo);
    });
    acctLegalLinks(body, null); return;
  }
  const reg = v === 'register';
  sub.textContent = reg ? _t('Create an account') : _t('Sign in');
  body.innerHTML = `<div class="ac-grid">
    <div class="card ac-form">${tabs}${note}
      <form>
        <label class="ac-in"><span>${_t('Username')}</span><input name="u" maxlength="${reg ? 16 : 64}" autocomplete="username" autocapitalize="off" spellcheck="false" value="${esc(d.u || '')}" required></label>
        <label class="ac-in"><span>${_t('Password')}</span><input name="p" type="password" maxlength="128" autocomplete="${reg ? 'new-password' : 'current-password'}" required></label>
        ${reg ? acctAcceptHtml(d.a) : ''}
        <p class="hint">${reg ? _t('The username is your public identifier: 3 to 16 characters (letters without accents, digits, underscore), permanent. Your display name will be the same, and you can change it. Password: at least 8 characters. No email address is required: a recovery code will be shown, to write down so you can recover the account if you forget the password.') : _t('<button class="link" type="button" id="acForgot">Forgot your password?</button>')}</p>
        <p class="ac-err" id="acErr" role="alert">${esc(ACCT.err)}</p>
        <button class="btn primary" type="submit">${reg ? _t('Create the account') : _t('Sign in')}</button>
      </form>
    </div>${side}</div>`;
  seg($('acTabs'), [['login', _t('Sign in')], ['register', _t('Create an account')]], () => ACCT.view, (x) => { ACCT.draft = {}; acctGo(x); });
  const form = body.querySelector('form'), fg = $('acForgot');
  if (fg) fg.addEventListener('click', () => { ACCT.draft = { u: String(new FormData(form).get('u') || '').trim() }; acctGo('recover'); });
  acctLegalLinks(body, form);
  acctForm(form, async (fd) => {
    const u = String(fd.get('u')).trim();
    if (reg) {
      const r = await acctApi('register', { username: u, password: String(fd.get('p')), accept: !!fd.get('accept') });
      if (!r.ok) return acctFail(r);
      ACCT.draft = {}; acctApply(r.data); sfxUi('confirm');
      acctShowCode(r.data.recoveryCode, _t('Account created: welcome!'), acctLobbyGo);
      return;
    }
    const r = await acctApi('login', { login: u, password: String(fd.get('p')) });
    if (!r.ok) return acctFail(r);
    ACCT.note = ''; ACCT.draft = {}; acctApply(r.data); sfxUi('confirm');
    // account created before recovery codes: the server has just given it one
    if (r.data.recoveryCode) return acctShowCode(r.data.recoveryCode, _t('Your account did not have a recovery code yet. Here it is. It replaces the email address, which the game no longer keeps.'), acctLobbyGo);
    acctChanged(); acctLobbyGo();
  });
}
/* ---------- Recovery code ----------
   Received from the server only once (sign-up, first login of an old account, recovery, new code): the Profile screen shows it
   before everything else, with a way to copy or save it, until the player ticks "I have noted my code"; the game then tells the
   server (recovery-ok), which only considers the account provided with a code (hasRecovery) at that moment. It lives only in memory: a page
   reloaded before, a lost response or an old game leave the Profile banner, which has a new one created. then: the continuation. */
function acctShowCode(code, note, then) {
  if (!code) { ACCT.note = note || ''; acctChanged(); if (then) then(); return; }
  ACCT.code = code; ACCT.codeNote = note || ''; ACCT.codeThen = then || null; ACCT.note = '';
  if (UI.screen !== 'profile' && MATCH.state === 'menu') uiGo('profile');
  acctChanged();
}
function acctRenderCode(body, sub) {
  sub.textContent = _t('Recovery code');
  body.innerHTML = `<div class="card ac-form ac-codebox">${ACCT.codeNote ? `<p class="ac-note">${esc(ACCT.codeNote)}</p>` : ''}
      <h3 class="lbl">${_t('Your recovery code')}</h3>
      <p class="hint">${_t('Write it down and keep it somewhere safe. It is the only way to recover your account if you forget your password. It will not be shown again.')}</p>
      <p class="ac-code" id="acCode">${esc(ACCT.code)}</p>
      <div class="row"><button class="btn" id="acCodeCopy" type="button">${_t('Copy')}</button><button class="btn" id="acCodeSave" type="button">${_t('Save to a file')}</button></div>
      <p class="ac-err ok" id="acCodeMsg" role="status"></p>
      <form><label class="ac-check"><input type="checkbox" name="k" required><span>${_t('I have written down my recovery code')}</span></label>
        <button class="btn primary" type="submit">${_t('Continue')}</button></form></div>`;
  const msg = (t) => { const m = $('acCodeMsg'); if (m) m.textContent = t; };
  $('acCodeCopy').addEventListener('click', async () => {
    sfxUi('click');
    try { await navigator.clipboard.writeText(ACCT.code); msg(_t('Code copied.')); return; } catch (e) { /* clipboard denied: select by hand */ }
    const r = document.createRange(); r.selectNodeContents($('acCode')); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    let done = false; try { done = document.execCommand('copy'); } catch (e) { /* ignored */ }
    msg(done ? _t('Code copied.') : _t('Copying is not possible here. The code is selected, write it down by hand.'));
  });
  $('acCodeSave').addEventListener('click', () => {
    sfxUi('click');
    const u = ACCT.user ? ACCT.user.username : '';
    const txt = ['War Bash', _t('Username: {0}', u), _t('Recovery code: {0}', ACCT.code), _t('Issued on {0}', fmtDate(new Date(), { day: 'numeric', month: 'long', year: 'numeric' })), '',
      _t('It lets you choose a new password if you forget yours (Sign in, "Forgot your password?"). It works only once. You are then given a new code.')].join('\n');
    const url = URL.createObjectURL(new Blob([txt + '\n'], { type: 'text/plain;charset=utf-8' })), a = document.createElement('a');
    a.href = url; a.download = _t('war-bash-recovery-code.txt'); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
    msg(_t('Download requested: check that the file was actually saved, otherwise copy the code or write it down by hand.'));
  });
  body.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const then = ACCT.codeThen, shown = ACCT.code; ACCT.code = ''; ACCT.codeNote = ''; ACCT.codeThen = null;
    sfxUi('confirm'); acctChanged(); if (then) then();
    // code noted: the server keeps it (otherwise the Profile banner will ask again); replaced elsewhere in the meantime: say so
    acctApi('recovery-ok', { code: shown }).then((r) => {
      if (r.ok && r.data && r.data.user) { acctApply(r.data); acctChanged(); }
      else if (r.status === 422) { ACCT.note = (r.data && r.data.error) || ''; acctLoad(); }
    });
  });
}
const AC_HM = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h} h ${String(m).padStart(2, '0')}` : _t('{0} min', m); };
const AC_PCT = (a, b) => (b ? Math.round((a / b) * 100) + PCT : '0' + PCT);
/* A player's statistics (their Profile, another player's profile): four key figures large (ratio, win rate, eliminations, matches), the rest in a
   compact list; time: play time (their own only, the server doesn't give it for another player) */
function acctStatsHtml(S, time) {
  const key = [[fmtNum(S.deaths ? S.kills / S.deaths : S.kills, 2), _t('K/D ratio')], [AC_PCT(S.wins, S.matches), _t('Win rate')], [fmtNum(S.kills), _t('Kills')], [fmtNum(S.matches), _t('Matches')]];
  const more = [[fmtNum(S.wins), _t('Wins')], [fmtNum(S.deaths), _t('Deaths')], [fmtNum(S.assists), _t('Assists')], [AC_PCT(S.hits, S.shots), _t('Accuracy')], [AC_PCT(S.headshots, S.kills), _t('Headshots')], [fmtNum(S.bestStreak), _t('Best streak')], ...(time ? [[AC_HM(S.seconds), _t('Time played')]] : [])];
  return `<div class="ac-stats">${acctKpis(key)}<dl class="ac-more">${more.map(([v, l]) => `<div><dt>${l}</dt><dd>${esc(String(v))}</dd></div>`).join('')}</dl></div>`;
}
const acctKpis = (list) => `<div class="ac-kpis">${list.map(([v, l]) => `<div class="ac-stat"><b>${esc(String(v))}</b><span>${l}</span></div>`).join('')}</div>`;
/* Latest matches: map, mode, result (the word, in color), eliminations and deaths, XP (their own), date */
function acctGamesHtml(list, xp) {
  const RES = { win: [_t('Victory'), 'w'], loss: [_t('Defeat'), 'l'], draw: [_t('Draw'), ''], quit: [_t('Forfeit'), ''] };
  const rows = list.map((m) => {
    const info = hasKey(MAP_DEFS, m.map) ? mapById(m.map).name : m.map, md = hasKey(MODES, m.mode) ? MODES[m.mode].btn : m.mode, [rl, rc] = hasKey(RES, m.result) ? RES[m.result] : [m.result, ''];
    const d = new Date(m.played_at), ds = isNaN(d) ? '' : fmtDate(d, { day: 'numeric', month: 'short' });
    return `<tr><td>${esc(info)}</td><td>${esc(md)} <small>${m.online ? _t('online') : _t('solo')}</small></td><td class="${rc}">${esc(rl)}</td><td>${m.kills} / ${m.deaths}</td>${xp ? `<td>+${m.xp} XP</td>` : ''}<td>${esc(ds)}</td></tr>`;
  }).join('');
  return rows ? `<table class="ac-recent"><thead><tr><th>${_t('Map')}</th><th>${_t('Mode')}</th><th>${_t('Result')}</th><th>${_t('K / D')}</th>${xp ? '<th>XP</th>' : ''}<th>${_t('Date')}</th></tr></thead><tbody>${rows}</tbody></table>` : '';
}
/* Profile form field: the label above the field (no more hints only in the "placeholder") */
const acctIn = (label, attrs) => `<label class="ac-in"><span>${label}</span><input ${attrs}></label>`;
function acctRenderProfile(body, sub) {
  const u = ACCT.user, L = ACCT.level, S = ACCT.stats;
  sub.textContent = _t('Account and progression');
  ACCT.noteSeen = !!ACCT.note;
  const games = acctGamesHtml(ACCT.recent, true);
  const pwIn = u.hasPassword ? acctIn(_t('Password'), 'name="p" type="password" maxlength="128" autocomplete="current-password" required') : '';
  const warn = u.hasRecovery ? '' : `<div class="card ac-warn"><p>${_t('Create your recovery code. Without it, a forgotten password cannot be recovered (the game keeps no email address).')}</p>
    <form id="acRec0" class="row">${pwIn}<button class="btn primary" type="submit">${_t('Create my recovery code')}</button></form><p class="ac-err" id="acRec0Err" role="alert"></p></div>`; // password asked again (see recoveryNew): a session left open is not enough
  // moderation (accounts in the server's MODERATION variable): access to the reports screen (09v-moderation.js)
  const mod = u.moderator ? `<div class="card ac-mod${u.modOpen ? ' on' : ''}"><p>${u.modOpen ? _tn(u.modOpen, 'Moderation: {0} reported account awaits your decision.', 'Moderation: {0} reported accounts await your decision.') : _t('Moderation: no pending reports.')}</p>
    <button class="btn${u.modOpen ? ' primary' : ''}" id="acMod" type="button">${_t('Open moderation')}</button></div>` : '';
  // two columns on a wide screen: progression (identity, figures, latest matches) on the left, account management on the right
  body.innerHTML = `
    ${ACCT.note ? `<p class="ac-note" role="status">${esc(ACCT.note)}</p>` : ''}
    ${warn}${mod}
    <div class="ac-cols">
      <div class="ac-main">
        <div class="card ac-top">
          <button class="ac-avbtn" id="acAvBtn" type="button" title="${esc(_t('Change the profile picture'))}" aria-label="${esc(_t('Change the profile picture'))}"><span class="acct-av" id="acAvBig">${acctAvatar(u, L.level)}</span><em>${_t('Edit')}</em></button>
          <div class="ac-id"><h3>${esc(u.displayName)}</h3><p>@${esc(u.username)} · ${_t('Level {0}', L.level)}</p>
            <div class="ac-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${L.need}" aria-valuenow="${L.into}"><i style="transform:scaleX(${L.need ? L.into / L.need : 1})"></i></div>
            <div class="ac-xp">${_t('{0} · {1} XP in total', L.need ? `${_t('{0} / {1} XP to level {2}', L.into, L.need, L.level + 1)}` : _t('Max level'), L.xp)}</div></div>
        </div>
        ${acctStatsHtml(S, true)}
        <div class="card ac-games"><h3 class="lbl">${_t('Recent matches')}</h3>${games || _t('<p class="hint">No matches recorded. Play a match to earn XP.</p>')}</div>
      </div>
      <div class="card ac-side"><h3 class="lbl">${_t('Account')}</h3>
        <div class="ac-field"><span>${_t('Profile picture')}</span>
          <div class="row"><button class="btn" id="acAvEdit" type="button">${_t('Change the picture')}</button>${u.avatar ? `<button class="btn" id="acAvDel" type="button">${_t('Remove')}</button>` : ''}</div>
          ${u.avatar && u.avatarHidden ? `<p class="hint ac-hid">${_t('Your picture was reported by several players. It is hidden from others until the moderators review it.')}</p>` : ''}</div>
        <form id="acName" class="ac-field"><label for="acNameIn">${_t('Display name (16 characters at most)')}</label>
          <div class="row"><input id="acNameIn" name="n" maxlength="16" value="${esc(u.displayName)}" autocomplete="off" spellcheck="false" required><button class="btn" type="submit">${_t('Save')}</button></div>
          <p class="ac-err" id="acErr" role="alert">${esc(ACCT.err)}</p></form>
        <p class="hint">${_t('Username:')} <b>${esc(u.username)}</b> ${_t('(permanent, visible in the leaderboard). Other players also see your display name.')}</p>
        <div class="btns"><button class="btn" id="acOut" type="button">${_t('Sign out')}</button></div>
        <details class="ac-fold"><summary>${_t('Password and recovery code')}</summary>
          <form id="acPass"><span class="hint">${u.hasPassword ? _t('Change the password (you will be given a new recovery code)') : _t('Add a password')}</span>
            ${u.hasPassword ? acctIn(_t('Current password'), 'name="c" type="password" maxlength="128" autocomplete="current-password" required') : ''}
            ${acctIn(_t('New password (at least 8 characters)'), 'name="n" type="password" maxlength="128" autocomplete="new-password" required')}
            <p class="ac-err" id="acPassErr" role="alert"></p><button class="btn" type="submit">${_t('Save')}</button></form>
          ${u.hasRecovery ? `<form id="acRec"><span class="hint">${_t('New recovery code (lost code). The old one will stop working.')}</span>${pwIn}
            <p class="ac-err" id="acRecErr" role="alert"></p><button class="btn" type="submit">${_t('Create a new code')}</button></form>` : ''}
        </details>
        <details class="ac-fold ac-danger"><summary>${_t('My data and account deletion')}</summary>
          <p class="hint">${_t('You can download all your data in a file, or delete the account.')} <button class="link" type="button" data-legal="privacy">${_t('Privacy policy')}</button></p>
          <div class="btns"><button class="btn" id="acExport" type="button">${_t('Download my data')}</button></div>
          <form id="acDel"><p class="hint">${_t('Delete erases the account, the progression and the history, permanently. Type your username{0} to confirm.', u.hasPassword ? ' ' + _t('and your password') : '')}</p>
            ${acctIn(_t('Username'), `name="c" placeholder="${esc(u.username)}" autocomplete="off" autocapitalize="off" spellcheck="false" required`)}${u.hasPassword ? acctIn(_t('Password'), 'name="p" type="password" autocomplete="current-password" required') : ''}
            <p class="ac-err" id="acDelErr" role="alert"></p><button class="btn danger" type="submit">${_t('Delete permanently')}</button></form></details>
      </div>
    </div>`;
  acctLegalLinks(body, null);
  acctAvatarFallback($('acAvBig'), u, L.level);
  for (const id of ['acAvBtn', 'acAvEdit']) $(id).addEventListener('click', () => { sfxUi('click'); avOpen(); });
  if ($('acAvDel')) $('acAvDel').addEventListener('click', () => { avRemove(); });
  if ($('acMod')) $('acMod').addEventListener('click', () => { sfxUi('click'); uiGo('moderation'); });
  acctForm($('acName'), async (fd) => {
    const r = await acctApi('profile', { displayName: String(fd.get('n')) });
    if (!r.ok) return acctFail(r);
    acctApply(r.data); acctChanged(); sfxUi('click');
  });
  // secondary profile forms: same mechanism, the error shows below the form
  const wire = (id, errId, call, done) => $(id).addEventListener('submit', async (e) => {
    e.preventDefault(); if (ACCT.busy) return;
    const f = $(id), btn = f.querySelector('[type=submit]'); ACCT.busy = true; btn.disabled = true; $(errId).textContent = '';
    try { const r = await call(new FormData(f)); if (!r.ok) $(errId).textContent = (r.data && r.data.error) || AC_ERR[r.status] || _t('Error.'); else done(r); }
    finally { ACCT.busy = false; btn.disabled = false; }
  });
  wire('acPass', 'acPassErr', (fd) => acctApi('password-change', { current: String(fd.get('c') || ''), next: String(fd.get('n')) }), (r) => { acctApply(r.data); sfxUi('confirm'); acctShowCode(r.data.recoveryCode, _t('Password changed. Your old recovery code no longer works. Here is the new one.')); });
  // recovery code: the first (banner) or a new one in place of a lost code; the server asks for the password again
  const recNew = (fd) => acctApi('recovery-new', { password: String(fd.get('p') || '') });
  if ($('acRec0')) wire('acRec0', 'acRec0Err', recNew, (r) => { acctApply(r.data); sfxUi('confirm'); acctShowCode(r.data.recoveryCode, _t('Your recovery code is ready.')); });
  if ($('acRec')) wire('acRec', 'acRecErr', recNew, (r) => { acctApply(r.data); sfxUi('confirm'); acctShowCode(r.data.recoveryCode, _t('New recovery code. The old one no longer works.')); });
  $('acOut').addEventListener('click', async () => { await acctApi('logout', {}); const h = acctHint(); if (h) acctHintSet({ ...h, on: false }); acctForget(); acctChanged(); sfxUi('back'); });
  $('acExport').addEventListener('click', async () => {
    try {
      const r = await fetch('/api/account-export', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!r.ok) throw new Error();
      const url = URL.createObjectURL(await r.blob()), a = document.createElement('a'); a.href = url; a.download = 'war-bash-mes-donnees.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) { ACCT.err = _t('Export failed: try again.'); $('acErr').textContent = ACCT.err; }
  });
  $('acDel').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData($('acDel')), r = await acctApi('account-delete', { confirm: String(fd.get('c')), password: String(fd.get('p') || '') });
    if (!r.ok) { $('acDelErr').textContent = (r.data && r.data.error) || AC_ERR[r.status] || _t('Error.'); return; }
    acctHintSet(null); acctForget(); ACCT.note = _t('Account deleted.'); acctChanged();
  });
}

/* ---------- Match tracking ---------- */
/* Opening: the server hands out a timestamped token (it sets the maximum duration the summary can announce) */
function acctMatchStart() {
  ACCT.match = null;
  if (!ACCT.user) return;
  const m = { t0: MATCH.time, token: null, online: !!MATCH.online, map: CURMAP.id, mode: MATCH.mode };
  ACCT.match = m;
  acctApi('match-start', {}).then((r) => { if (r.ok && r.data && ACCT.match === m) m.token = r.data.token; });
}
/* End (result: win, loss, draw or quit): sends the summary; the end screen shows the XP earned */
async function acctMatchEnd(result, show) {
  const m = ACCT.match; ACCT.match = null;
  const box = $('endXp');
  if (box) box.classList.add('hidden');
  if (!m) { // without an account: the match's XP kept on this device (arsLocalXp), and the invitation to log in
    if (show && box && !ACCT.user) {
      const g = ARS.gain, a = g ? pxpForLevel(g.level) : 0, b = g && g.level < 100 ? pxpForLevel(g.level + 1) : 0;
      const slots = g && g.slots ? `<b>${_tn(g.slots, '{0} custom class unlocked', '{0} custom classes unlocked')}</b>` : '';
      box.innerHTML = (g ? endXpHtml({ xp: g.xp, level: g.level, into: ARS.px - a, need: b ? b - a : 0, up: g.up, notes: [_t('Progress kept on this device'), slots] }) : '')
        + (ACCT.state === 'ready' ? `<p class="ex-note">${_t('Match not saved. <b>Sign in</b> (Profile) to earn account XP.')}</p>` : '');
      box.classList.toggle('hidden', !box.innerHTML);
    }
    return;
  }
  for (let i = 0; i < 20 && !m.token && ACCT.state === 'ready'; i++) await new Promise((r) => setTimeout(r, 250)); // token still on its way
  if (!m.token) return;
  const me = PL.ent, dur = Math.max(0, Math.floor(MATCH.time - m.t0));
  const r = await acctApi('match-end', { token: m.token, summary: {
    map: m.map, mode: m.mode || 'tdm', result, online: m.online, duration: dur, kills: me.kills, deaths: me.deaths, assists: me.assists,
    headshots: Math.min(PL.hsKills || 0, me.kills), shots: PL.shots, hits: Math.min(PL.hits, PL.shots), score: Math.max(0, me.score | 0), streak: Math.min(PL.bestStreak || 0, me.kills),
  } });
  if (!r.ok || !r.data) return;
  ACCT.level = r.data.level; ACCT.stats = r.data.stats; ACCT.recent = r.data.recent; acctChanged();
  if (show && box && MATCH.state === 'ended') {
    const L = r.data.level;
    box.innerHTML = endXpHtml({ xp: r.data.gained, level: L.level, into: L.into, need: L.need, up: r.data.levelUp, notes: [m.online ? '' : _t('Solo match: XP halved')] });
    box.classList.remove('hidden');
  }
}
/* Back to the menus mid-match: abandon (counted if it lasted at least 30 s) */
function acctMatchAbandon() { if (ACCT.match) acctMatchEnd('quit', false); }

/* ---------- Startup ---------- */
/* Called by menuInit: the account state loads while the game finishes starting; the resulting navigation waits for
   the end of startup (acctArrive, called after boot opens the main menu, 09-game.js) */
function acctInit() {
  // links received by e-mail before version 3.5 (address confirmation ?verif, forgotten password ?mdp): they no longer work, the Profile says so
  const qs = new URLSearchParams(location.search);
  ACCT.oldLink = qs.has('verif') || qs.has('mdp');
  if (ACCT.oldLink) { qs.delete('verif'); qs.delete('mdp'); history.replaceState(null, '', location.pathname + (qs.toString() ? '?' + qs : '')); }
  ACCT.ready = acctLoad();
}
function acctArrive() {
  const old = ACCT.oldLink; ACCT.oldLink = false;
  ACCT.ready.then(() => {
    if (ACCT.state !== 'ready') return;
    if (old) {
      ACCT.note = _t('This link received by email no longer works. The game no longer keeps email addresses. Sign in with your username. If you forgot your password, use your recovery code.');
      acctChanged(); uiOpen('profile', ['main']); return;
    }
    // account left logged in without a noted recovery code (created before codes, or code never confirmed): the Profile, and its banner which has one
    // created, opens at launch as long as there is none (except an invite link, which leads to the lobby)
    if (ACCT.user && !ACCT.user.hasRecovery && !ACCT.code && UI.screen === 'main' && MATCH.state === 'menu' && !new URLSearchParams(location.search).has('lobby')) uiOpen('profile', ['main']);
  });
}
