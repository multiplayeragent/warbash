/* ==========================================================================
   NEWS: update log.
   The data comes from changelog.json (validated and embedded by build.py, most recent to oldest).
   - News menu: history of the last NEWS_MAX updates (version number and list of changes, no title), "New"
     badge as long as the latest hasn't been seen;
   - fullscreen "What's new" window: only for a major version (X.0.0, the only one that carries a title), once
     at the launch following its release (remembered in the browser). Other updates are not announced on arrival.
   A new release = a new entry at the top of changelog.json (see README).
   ========================================================================== */
const CHANGELOG = JSON.parse($('changelogData').textContent);
const GAME_VERSION = CHANGELOG[0].version;
const NEWS_MAX = 10;
const NEWS_TAG = { new: _t('New'), improved: _t('Improved'), fixed: _t('Fixed') };
const newsDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number), s = fmtDate(new Date(Date.UTC(y, m - 1, d)), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return s;
};
/* Texts of a log entry: changelog.json carries French (title, x) and English (title_en, x_en) */
const newsTitle = (r) => r.title || '';
const vkey = (v) => v.split('.').map(Number);
const vNewer = (a, b) => { const x = vkey(a), y = vkey(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
/* The major version (X.0.0) released since the last version seen: the one announced fullscreen (none for a new player) */
const newsMajor = () => { const seen = newsSeenGet(); return seen ? CHANGELOG.find((r) => /^\d+\.0\.0$/.test(r.version) && vNewer(r.version, seen)) || null : null; };
const newsText = (c) => c.x;
const newsSeenGet = () => { try { return localStorage.getItem('cod_seen_version'); } catch (e) { return null; } };
function newsMarkSeen() { try { localStorage.setItem('cod_seen_version', GAME_VERSION); } catch (e) { /* storage unavailable */ } newsBadge(); }
const newsUnseen = () => newsSeenGet() !== GAME_VERSION;
const newsChanges = (list) => list.map((c) => `<li><span class="tg ${c.t}">${NEWS_TAG[c.t]}</span><span>${esc(newsText(c))}</span></li>`).join('');

function renderNews() {
  const list = CHANGELOG.slice(0, NEWS_MAX);
  $('newsSub').textContent = list.length > 1 ? _t('Current version: {0}. The last {1} updates.', GAME_VERSION, list.length) : _t('Current version: {0}. Latest news.', GAME_VERSION);
  $('newsList').innerHTML = list.map((r, i) => `<article class="rel${i === 0 ? ' latest' : ''}">
    <div class="rel-head"><b>${esc(r.version)}</b>${newsTitle(r) ? `<em>${esc(newsTitle(r))}</em>` : ''}${i === 0 ? `<i>${_t('Latest')}</i>` : ''}<span>${newsDate(r.date)}</span></div>
    <ul class="chg">${newsChanges(r.changes)}</ul></article>`).join('');
  newsMarkSeen();
}
/* "New" badge of the main menu and version number */
function newsBadge() {
  $('mmNewsBadge').classList.toggle('hidden', !newsUnseen());
  $('mmNews').textContent = _t('Version {0}', GAME_VERSION);
  $('verTag').textContent = _t('Version {0}', GAME_VERSION);
}
function newsClose() { $('whatsnew').classList.add('hidden'); newsMarkSeen(); }
/* "What's new" window: once per major version, never on a lobby invitation link */
function newsPopup() {
  const r = newsMajor();
  if (!r || new URLSearchParams(location.search).get('lobby')) return;
  $('wnKicker').textContent = _t('Update {0} · {1}', r.version, newsDate(r.date));
  $('wnTitle').textContent = newsTitle(r);
  $('wnList').innerHTML = newsChanges(r.changes);
  $('whatsnew').classList.remove('hidden'); requestAnimationFrame(() => $('wnOk').focus({ preventScroll: true }));
}
function newsInit() {
  // a new player's first launch: nothing to announce, the current version is simply remembered
  let existing = false; try { existing = localStorage.getItem('dc_settings') !== null; } catch (e) { /* ignored */ }
  if (newsSeenGet() === null && !existing) newsMarkSeen();
  $('wnOk').addEventListener('click', () => { newsClose(); sfxUi('click'); });
  $('wnMore').addEventListener('click', () => { newsClose(); uiGo('news'); });
  // the window keeps the keyboard: Escape closes it, arrows don't move the menu underneath
  addEventListener('keydown', (e) => {
    if ($('whatsnew').classList.contains('hidden')) return;
    if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); newsClose(); }
    else if (e.code.startsWith('Arrow')) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  newsBadge();
}
