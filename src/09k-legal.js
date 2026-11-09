/* ==========================================================================
   LEGAL TEXTS: privacy policy, terms of use, legal notices
   "Privacy and terms" screen, opened from the main menu, the Profile and the sign-up checkbox.
   TO BE COMPLETED BY THE PUBLISHER before going live: LEGAL.name, LEGAL.address, LEGAL.email, LEGAL.host, in legal.local.json at the
   root (not versioned, see legal.example.json): build.py takes the values from it and flags the brackets that remain. A value is a
   text, or {"fr": ..., "en": ...} when it changes with the language; an empty address is not displayed. These texts describe what the code does (no account, progression on the device, online lobbies through the game
   server, src/09d-netrelay.js): reread them if either changes.
   This is not legal advice: have a lawyer review the text if the game becomes a real service.
   ========================================================================== */
const LEGAL = {
  version: '2026-11-08',
  name: '[Publisher\u0027s name or company name]',
  address: '[Publisher\u0027s postal address]',
  email: '[Contact email address]',
  host: '[Host of the game and game server: name and address]',
  tab: 'privacy',
};
function legalGo(tab) { LEGAL.tab = tab; uiGo('legal'); }
function legalRender() {
  const body = $('lgBody'); if (!body) return;
  seg($('lgTabs'), [['privacy', _t('Privacy')], ['terms', _t('Terms of use')], ['notice', _t('Legal notice')]], () => LEGAL.tab, (v) => { LEGAL.tab = v; legalRender(); sfxUi('click'); });
  $('lgSub').textContent = _t('Version of {0}', newsDate(LEGAL.version));
  const v = (x) => esc(x);
  const L = { name: v(LEGAL.name), address: v(LEGAL.address), email: v(LEGAL.email), host: v(LEGAL.host) };
  const who = L.address ? L.name + ', ' + L.address : L.name;
  body.scrollTop = 0; $('scr-legal').scrollTop = 0; // it's the screen that scrolls: each tab (and each opening) starts with the text at the top
  if (LEGAL.tab === 'terms') {
    body.innerHTML = `<h4>${_t('1. Purpose')}</h4><p>${_t('War Bash is a free shooter played in the browser, solo against bots or online. These terms govern its use.')}</p>
<h4>${_t('2. Conduct')}</h4><p>${_t('Forbidden: cheating (modifying the game, faking results, exploiting a flaw), picking an insulting, hateful or misleading nickname, and harassing other players, including in lobby chat. Rude or hateful words are refused in nicknames and hidden in chat. In a lobby, anyone can mute a player and the host can kick them.')}</p>
<h4>${_t('3. Progress')}</h4><p>${_t('Levels, experience and unlocks are kept on your device and have no monetary value. Clearing your browser data clears them.')}</p>
<h4>${_t('4. Availability and liability')}</h4><p>${_t('The game is provided "as is", free of charge, with no guarantee of continuous availability. It may be interrupted, changed or shut down. To the extent permitted by law, the publisher is not liable for indirect damage arising from the use of the game.')}</p>
<h4>${_t('5. Licenses')}</h4><p>${_t('The game\u0027s code is published under the MIT license. It derives from Riposte: Frontline, by BenDBS. Textures and lighting are under the CC0 license, sounds under the licenses given in the project credits.')}</p>
<h4>${_t('6. Contact')}</h4><p>${_t('Contact: {0}', L.email)}</p>`;
    return;
  }
  if (LEGAL.tab === 'notice') {
    body.innerHTML = `<h4>${_t('Publisher')}</h4><p>${L.name}<br>${L.address ? L.address + '<br>' : ''}${_t('Contact: {0}', L.email)}</p>
<h4>${_t('Hosting')}</h4><p>${L.host}</p>`;
    return;
  }
  body.innerHTML = `<h4>${_t('1. Who is responsible for your data?')}</h4><p>${_t('{0}. Contact for any question or request: {1}.', who, L.email)}</p>
<h4>${_t('2. What data, and why?')}</h4>
<ul>
<li><b>${_t('On your device')}</b> ${_t(': your settings, your nickname and your progress (level, experience, weapons, classes, outfits) stay in your browser\u0027s storage. They are not sent anywhere.')}</li>
<li><b>${_t('Multiplayer')}</b> ${_t(': when you play online, your nickname, your level, your game actions and your chat messages go through our game server, which passes them to the other players in the lobby. Players never connect to each other directly:')} <b>${_t('your IP address is not visible to other players')}</b>${_t(', only to the server. It keeps neither your messages nor your match once the lobby is closed.')} <i>${_t('Basis: performance of the service you request (art. 6.1.b GDPR).')}</i></li>
<li><b>${_t('Audience measurement and errors')}</b> ${_t(': when you play online, the game server counts sessions anonymously (a random identifier kept on your device, the page address, the language and the time zone) and receives the game\u0027s technical errors, to follow attendance and fix problems. No name, no email address.')} <i>${_t('Basis: legitimate interest (art. 6.1.f).')}</i></li>
</ul>
<h4>${_t('3. What we do not do')}</h4><p>${_t('No account, no email, no advertising, no selling or sharing of data, no profiling.')}</p>
<h4>${_t('4. Who receives your data?')}</h4><p>${_t('Only the host of the game and of the game server, to provide the service (see Legal notice). To work, the page also loads its fonts from Google Fonts, which therefore receives your IP address like any website.')}</p>
<h4>${_t('5. Cookies and storage')}</h4><p>${_t('No cookies. The browser keeps your settings and your progress on your device: you can clear them at any time from your browser settings.')}</p>
<h4>${_t('6. Your rights')}</h4><p>${_t('For any request for access, correction or deletion, write to {0}. If you believe your rights are not respected, you can contact your country\u0027s data protection authority.', L.email)}</p>
<h4>${_t('7. Changes')}</h4><p>${_t('The date at the top of this page shows the version in force.')}</p>`;
}
