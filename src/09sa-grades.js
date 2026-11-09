/* ==========================================================================
   RANKS: badges and titles of the player's levels
   Eleven ranks, one per band of ten levels (the last at level 100), each with its badge: a sheet of eleven cells
   (assets/ranks.webp, tools/art/process.py; address set by build.py in place of the marker). They serve the level-up
   (09s-rankup.js: "Promotion" when changing rank) and the main menu chip (rankChip), which replaces the account's:
   War Bash has no accounts (09j-account.js, ACCT_SERVER), progression lives on the device.
   ========================================================================== */
const RANK_ART = /*__RANK_ART__*/ '';
const RANKS = [_t('Recruit'), _t('Soldier'), _t('Corporal'), _t('Sergeant'), _t('Staff Sergeant'), _t('Lieutenant'), _t('Captain'), _t('Major'), _t('Colonel'), _t('General'), _t('Legend')];
/* Rank of a level: 0 (levels 1 to 9) ... 9 (90 to 99), 10 (100) */
function rankIndex(level) { return Math.max(0, Math.min(RANKS.length - 1, Math.floor((level | 0) / 10))); }
function rankName(level) { return RANKS[rankIndex(level)]; }
/* Sets a level's badge as an element's background (cell of the sheet) */
function rankPaint(el, level) {
  if (!el) return;
  const i = rankIndex(level);
  el.style.backgroundImage = RANK_ART ? `url("${RANK_ART}")` : 'none';
  el.style.backgroundSize = `${RANKS.length * 100}% 100%`;
  el.style.backgroundPosition = `${(i / (RANKS.length - 1)) * 100}% 0`;
}
if (RANK_ART) { const im = new Image(); im.src = RANK_ART; } // the sheet is ready by the time the first level-up arrives

/* Main menu chip, top right: the badge, nickname, level and rank, and the experience bar toward the next level */
function rankChip() {
  const chip = $('acctChip'); if (!chip) return;
  const lv = playerLevel(), xp = ARS.px || 0, a = pxpForLevel(lv), b = lv < 100 ? pxpForLevel(lv + 1) : a, k = b > a ? clamp((xp - a) / (b - a), 0, 1) : 1;
  chip.classList.remove('out'); chip.classList.add('rank'); chip.dataset.go = 'classes'; // (no profile without an account: the classes, which the level unlocks)
  const av = $('acctAv');
  if (!av.querySelector('.rk-ins')) av.innerHTML = '<span class="rk-ins" aria-hidden="true"></span>';
  rankPaint(av.querySelector('.rk-ins'), lv);
  let nick = ''; try { nick = netClean(localStorage.getItem('cod_nick') || '').replace(/^Soldat$/, ''); } catch (e) { /* storage unavailable */ }
  $('acctName').textContent = nick || _t('Soldier');
  $('acctSub').textContent = _t('Level {0} · {1}', lv, rankName(lv));
  let bar = chip.querySelector('.rk-xp');
  if (!bar) { bar = document.createElement('i'); bar.className = 'rk-xp'; bar.innerHTML = '<i></i>'; chip.querySelector('.acct-tx').appendChild(bar); }
  bar.firstChild.style.transform = `scaleX(${k.toFixed(3)})`;
  chip.title = lv < 100 ? _t('{0} of {1} XP to level {2}', Math.floor(xp - a), b - a, lv + 1) : _t('Max level');
  chip.setAttribute('aria-label', _t('Level {0} · {1}', lv, rankName(lv)));
}
