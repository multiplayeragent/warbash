/* ==========================================================================
   ONLINE CHAT
   A message typed with the T key, in the lobby as in a match. The host receives the guests' messages, cleans them
   (length, control characters, rate, banned words masked by api/_lib/textFilter.js) and rebroadcasts them to everyone with
   the author's identifier, nickname and team; everyone cleans them again on arrival. A player muted in the lobby's Players
   tab (NET.muted) no longer appears in the chat of whoever muted them.
   In a match, the latest messages show for a few seconds at the bottom left; in the lobby, the whole history can be read.
   ========================================================================== */
const CHAT = { log: [], open: false, keep: 60, show: 8, len: 120, gap: 400, unread: 0 };
/* Message received or sent: control characters removed, length capped, banned words masked (api/_lib/textFilter.js), on the host as on everyone else */
function chatClean(x) { return filterText(String(x == null ? '' : x).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, CHAT.len)); }
function chatMyTeam() { const me = NET.players.get(NET.me); return NET.on ? PL.ent.team : me ? me.t : 0; }
function chatLine(m, mine) {
  const el = document.createElement('div'); el.className = 'cm';
  const n = document.createElement('b'); n.className = m.t === mine ? 'ally' : 'enemy'; n.textContent = m.n;
  el.append(n, ' ' + m.x);
  return el;
}
/* Redraws both lists (lobby and match); match lines fade with age, except while typing */
function chatRender() {
  const mine = chatMyTeam(), lobby = $('netChatLog'), game = $('chatLog'), log = CHAT.log.filter((m) => !(m.id && NET.muted.has(m.id))); // muted after the fact: their messages go too
  if (lobby) {
    const end = lobby.scrollTop + lobby.clientHeight >= lobby.scrollHeight - 30;
    lobby.textContent = '';
    for (const m of log) lobby.appendChild(chatLine(m, mine));
    if (!log.length) { const e = document.createElement('div'); e.className = 'cm empty'; e.textContent = TOUCH.on || PAD.drive ? _t('No messages yet.') : _t('No messages. Press T to write.'); lobby.appendChild(e); }
    if (end) lobby.scrollTop = lobby.scrollHeight;
  }
  if (game) { game.textContent = ''; for (const m of log.slice(-6)) { const el = chatLine(m, mine); el.dataset.at = m.at; game.appendChild(el); } chatFade(); }
}
function chatFade() {
  const game = $('chatLog'); if (!game) return;
  const now = performance.now();
  for (const el of game.children) el.classList.toggle('old', !CHAT.open && now - +el.dataset.at > CHAT.show * 1000);
}
function chatPush(m) {
  if (m.id && NET.muted.has(m.id)) return; // muted player (lobby, Players tab)
  CHAT.log.push({ id: m.id || '', n: m.n, t: m.t === 1 ? 1 : 0, x: m.x, at: performance.now() });
  if (CHAT.log.length > CHAT.keep) CHAT.log.splice(0, CHAT.log.length - CHAT.keep);
  if (netInLobby() && !netChatOpen()) { CHAT.unread = (CHAT.unread || 0) + 1; chatUnread(); } // lobby: chat is a submenu of the lobby
  chatRender();
}
/* Unread lobby messages, on the Chat row */
function chatUnread() { const L = LM.scr.multi; if (L && netInLobby() && UI.screen === 'multi') lmRender(L); }
function chatClear() { CHAT.log.length = 0; CHAT.unread = 0; chatUnread(); chatRender(); }

/* Sending: the host broadcasts itself, the guest goes through the host (sees their message when the host sends it back); in the public lobby, outside
   a match, the message goes through the game server (src/09cb-servers.js), which sends it back to all */
function chatSend(text) {
  const x = chatClean(text); if (!x) return;
  if (SRV.on && !NET.on) { srvSend({ t: 'chat', x }); return; }
  if (NET.role === 'off' || !NET.joined) return;
  if (NET.role === 'host') chatHostRelay(NET.me, x); else netSend({ t: 'chat', x });
}
function chatHostRelay(id, text) {
  const pl = NET.players.get(id), x = chatClean(text), now = performance.now();
  if (!pl || !x || now - (pl.chatT || 0) < CHAT.gap) return;
  pl.chatT = now;
  const m = { t: 'chat', id, n: pl.n, tm: pl.t, x };
  netBroadcast(m);
  if (NET.muted.has(id)) return;
  chatPush({ id, n: m.n, t: m.tm, x });
  if (id !== NET.me) sfxUi('notify'); // message from another player: small signal
}
function chatIn(m) {
  const x = chatClean(m.x), id = typeof m.id === 'string' ? m.id : '';
  if (!x || (id && NET.muted.has(id))) return;
  chatPush({ id, n: netClean(m.n), t: m.tm === 1 ? 1 : 0, x });
  if (id ? id !== NET.me : netClean(m.n) !== netClean(NET.nick)) sfxUi('notify');
}

/* In-match typing: T opens, Enter sends, Esc cancels. Game keys are suspended while typing. */
function chatOpen() {
  if (CHAT.open || !NET.on || KS.map.open) return;
  CHAT.open = true; $('chatBox').classList.add('open');
  for (const k in KEYS) KEYS[k] = false; PL.held = false; PL.adsWant = false;
  const el = $('chatIn'); el.value = ''; el.focus({ preventScroll: true }); chatFade();
}
function chatClose() {
  if (!CHAT.open) return;
  CHAT.open = false; $('chatBox').classList.remove('open'); $('chatIn').blur(); chatFade();
}
function chatInit() {
  const bind = (el, onEnter) => el.addEventListener('keydown', (e) => {
    e.stopPropagation(); // neither game keys nor menu shortcuts must see the keystrokes
    if (e.key === 'Enter') { e.preventDefault(); onEnter(el.value); el.value = ''; }
    else if (e.key === 'Escape') { el.blur(); chatClose(); }
  });
  bind($('chatIn'), (v) => { chatSend(v); chatClose(); });
  bind($('netChatIn'), (v) => chatSend(v));
  $('chatIn').addEventListener('keyup', (e) => e.stopPropagation());
  $('chatIn').addEventListener('blur', () => chatClose());
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyT' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const a = document.activeElement; if (a && (a.tagName === 'INPUT' || a.tagName === 'SELECT' || a.tagName === 'TEXTAREA')) return;
    if (MATCH.state === 'menu') {
      if (UI.screen === 'multi' && netInLobby() && !UI.busy) { e.preventDefault(); const L = LM.scr.multi; if (!netChatOpen()) lmOpen(L, 'chat'); CHAT.unread = 0; $('netChatIn').focus({ preventScroll: true }); }
    } else if (NET.on && (MATCH.state === 'playing' || MATCH.state === 'killcam')) { e.preventDefault(); chatOpen(); }
  });
  setInterval(chatFade, 500);
  chatRender();
}
