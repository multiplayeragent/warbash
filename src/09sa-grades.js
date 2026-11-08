/* ==========================================================================
   GRADES : insignes et titres des niveaux du joueur
   Onze grades, un par tranche de dix niveaux (le dernier au niveau 100), chacun avec son insigne : une planche de onze cases
   (assets/ranks.webp, tools/art/process.py ; adresse posée par build.py à la place du marqueur). Ils servent à la montée de niveau
   (09s-rankup.js : « Promotion » quand on change de grade) et à la puce du menu principal (rankChip), qui remplace celle du compte :
   War Bash n'a pas de comptes (09j-compte.js, ACCT_SERVER), la progression vit sur l'appareil.
   ========================================================================== */
const RANK_ART = /*__RANK_ART__*/ '';
const RANKS = [_t('Recrue'), _t('Soldat'), _t('Caporal'), _t('Sergent'), _t('Sergent-chef'), _t('Lieutenant'), _t('Capitaine'), _t('Commandant'), _t('Colonel'), _t('Général'), _t('Légende')];
/* Grade d'un niveau : 0 (niveaux 1 à 9) ... 9 (90 à 99), 10 (100) */
function rankIndex(level) { return Math.max(0, Math.min(RANKS.length - 1, Math.floor((level | 0) / 10))); }
function rankName(level) { return RANKS[rankIndex(level)]; }
/* Pose l'insigne d'un niveau en fond d'un élément (case de la planche) */
function rankPaint(el, level) {
  if (!el) return;
  const i = rankIndex(level);
  el.style.backgroundImage = RANK_ART ? `url("${RANK_ART}")` : 'none';
  el.style.backgroundSize = `${RANKS.length * 100}% 100%`;
  el.style.backgroundPosition = `${(i / (RANKS.length - 1)) * 100}% 0`;
}
if (RANK_ART) { const im = new Image(); im.src = RANK_ART; } // la planche est prête quand la première montée de niveau arrive

/* Puce du menu principal, en haut à droite : l'insigne, le pseudo, le niveau et le grade, et la barre d'expérience vers le niveau suivant */
function rankChip() {
  const chip = $('acctChip'); if (!chip) return;
  const lv = playerLevel(), xp = ARS.px || 0, a = pxpForLevel(lv), b = lv < 100 ? pxpForLevel(lv + 1) : a, k = b > a ? clamp((xp - a) / (b - a), 0, 1) : 1;
  chip.classList.remove('out'); chip.classList.add('rank'); chip.dataset.go = 'classes'; // (pas de profil sans compte : les classes, que le niveau débloque)
  const av = $('acctAv');
  if (!av.querySelector('.rk-ins')) av.innerHTML = '<span class="rk-ins" aria-hidden="true"></span>';
  rankPaint(av.querySelector('.rk-ins'), lv);
  let nick = ''; try { nick = netClean(localStorage.getItem('cod_nick') || '').replace(/^Soldat$/, ''); } catch (e) { /* stockage indisponible */ }
  $('acctName').textContent = nick || _t('Soldat');
  $('acctSub').textContent = _t('Niveau {0} · {1}', lv, rankName(lv));
  let bar = chip.querySelector('.rk-xp');
  if (!bar) { bar = document.createElement('i'); bar.className = 'rk-xp'; bar.innerHTML = '<i></i>'; chip.querySelector('.acct-tx').appendChild(bar); }
  bar.firstChild.style.transform = `scaleX(${k.toFixed(3)})`;
  chip.title = lv < 100 ? _t('{0} XP sur {1} pour le niveau {2}', Math.floor(xp - a), b - a, lv + 1) : _t('Niveau maximal');
  chip.setAttribute('aria-label', _t('Niveau {0} · {1}', lv, rankName(lv)));
}
