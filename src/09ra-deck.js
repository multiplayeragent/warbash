/* ==========================================================================
   STEAM DECK (README "Steam Deck")
   - In Desktop mode, in the Steam Deck's browser (deckLooksLike, 01-core.js): a main menu card offers to install the
     game in Steam. It downloads "Installer War Bash.desktop", a shortcut that runs dist/deck/installer.sh from the page's
     address (the preview installs the preview): double-clicking it installs everything and returns to Game mode.
   - Launched from Steam (?deck=1, DECK): no Fullscreen button (the launcher already is); as long as no controller has responded, the
     card says which layout to choose in Steam (Chrome doesn't see the controller under a keyboard and mouse layout); a text
     field brings up Steam's on-screen keyboard (Steam button and X).
   ========================================================================== */
const DECK_UI = { t0: performance.now(), asked: false, force: '' }; // force: 'install' or 'pad', the card displayed no matter what (tools/dev/visual/menus.js)
const DECK_SITE = '__SITE__'; // address installed when the page isn't served over http(s) (local file)

/* The downloaded shortcut: a .desktop file that KDE runs on double click (like the Decky Loader installer); Terminal: you
   see the installation progress. Exec with no quote, dollar or backslash in the argument (.desktop file specification). */
function deckInstallFile() {
  const site = /^https?:$/.test(location.protocol) ? location.origin : DECK_SITE;
  return '[Desktop Entry]\nType=Application\nName=' + _t('Install War Bash') + '\nIcon=system-software-install\nTerminal=true\n'
    + `Exec=bash -c "curl -fsSL --create-dirs ${site}/deck/installer.sh -o ~/.cache/warbash-installer.sh && bash ~/.cache/warbash-installer.sh ${site}"\n`; // in the player's folder, not in /tmp (name known in advance, shared)
}
function deckDownload() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([deckInstallFile()], { type: 'application/x-desktop' }));
  a.download = _t('Install War Bash') + '.desktop';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  DECK_UI.asked = true; deckCard();
}

/* Main menu card: installation (Deck browser), or controls layout (Deck in Game mode, no controller seen yet) */
function deckCard() {
  const card = $('deckCard'); if (!card) return;
  let txt = '', btn = '';
  const mode = DECK_UI.force || (deckLooksLike() ? 'install' : DECK && !PAD.id && performance.now() - DECK_UI.t0 > 5000 ? 'pad' : '');
  if (mode === 'install') {
    txt = DECK_UI.asked ? _t('Open the downloaded file in the Downloads folder and confirm. The installation finishes on its own and returns to Gaming Mode.')
      : _t('Install the game in Steam to play it from Gaming Mode.');
    btn = DECK_UI.asked ? _t('Download again') : _t('Install on Steam Deck');
  } else if (mode === 'pad') {
    txt = _t('If the controller does not respond, choose the Gamepad with Mouse Trackpad layout in Steam.');
  }
  card.classList.toggle('hidden', !txt);
  if (!txt) return;
  $('pwaCard').classList.add('hidden'); // never both cards together (on the Deck, the phones' one doesn't show: 09r-pwa.js)
  $('deckTxt').textContent = txt;
  $('deckGo').textContent = btn; $('deckGo').classList.toggle('hidden', !btn);
}

function deckInit() {
  $('deckGo').addEventListener('click', deckDownload);
  if (!DECK) { deckCard(); return; }
  $('fsBtn').classList.add('hidden');
  setTimeout(deckCard, 5200); // the controller card, if nothing has responded in the meantime
  addEventListener('gamepadconnected', () => deckCard());
  // Steam's on-screen keyboard: Chrome doesn't open it on its own in a text field
  const kb = document.createElement('div'); kb.id = 'deckKb'; kb.className = 'hidden'; kb.setAttribute('aria-hidden', 'true');
  kb.textContent = _t('Steam button and X for the on-screen keyboard'); document.body.appendChild(kb);
  const isText = (el) => !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|search|email|password|url|tel|)$/.test(el.type || '')));
  addEventListener('focusin', (e) => kb.classList.toggle('hidden', !isText(e.target)));
  addEventListener('focusout', () => kb.classList.add('hidden'));
}
deckInit();
