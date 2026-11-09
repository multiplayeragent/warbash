/* ==========================================================================
   ANNOUNCEMENT LANE AND IN-MATCH LEVEL-UP
   The lane (HUD placement contract, --lane-top on #hud) is at top center, below the score: it carries the player's level-up (#rankUp,
   Call of Duty's "Rank Up", with its fanfare, 05b-rankup-sound.js) and the unlocks (#arsUp: weapon leveling up, attachment, challenge, outfit;
   arsShow, 09n-armory.js). One announcement at a time, in a single queue: a level-up goes ahead of the unlocks (the one that was
   displayed then resumes from the start); nothing starts during a killcam, the pause or the end announcement, and what was displayed when
   they arrive comes back afterwards (laneSuspend, lanePump): no announcement is lost.
   The level-up: a compact banner (yellow rules opening from the center), the hexagonal badge where the level rolls from the old to the
   new, "Level up" as the overline and the unlock as the subtitle, a soft glow and a few sparks. No flash or rays: the center,
   where you aim, stays clear. Everything is animated by CSS (transforms and opacity), with no hold on keys (pointer-events: none); with reduced
   motion, fades only. Several levels at once follow one another.
   ========================================================================== */
const RU = { q: [], on: false, t: 0, el: null, cur: null, t0: 0 };
const RU_MS = 4600, RU_SPARKS = 12;
const LANE = { t: 0 }; // waiting for the lane (killcam, pause, end announcement)

function rankUpBuild() {
  const el = $('rankUp'); if (!el || el.dataset.built) return el;
  el.dataset.built = '1';
  el.innerHTML = `<div class="ru-plate"><i class="ru-sheen"></i></div><i class="ru-edge t"></i><i class="ru-edge b"></i>
    <div class="ru-core"><div class="ru-badge"><i class="ru-rays"></i><i class="ru-glow"></i><i class="ru-ring"></i><i class="ru-ins"></i><div class="ru-sparks">${'<i></i>'.repeat(RU_SPARKS)}</div></div>
      <div class="ru-txt"><small class="ru-kick"></small><div class="ru-title"><span class="ru-lv"></span><span class="ru-roll"><b class="ru-old"></b><b class="ru-new"></b></span></div><span class="ru-rank"></span><span class="ru-sub"></span></div></div>`;
  return el;
}
/* The lane waits: start countdown, killcam (death replay, online as in solo), pause, end announcement or results */
function laneHeld() { return playHold() || KC.active || MATCH.state === 'killcam' || MATCH.state === 'paused' || MATCH.state === 'finish' || MATCH.state === 'ended'; }
/* Next announcement: the level-up first, then the unlocks; the held lane retries a bit later */
function lanePump() {
  clearTimeout(LANE.t);
  if (RU.on || ARSQ.on || (!RU.q.length && !ARSQ.list.length)) return;
  if (laneHeld()) { LANE.t = setTimeout(lanePump, 400); return; }
  if (RU.q.length) rankUpNext(); else arsShowNext();
}
/* Killcam, pause, end announcement: the displayed announcement is interrupted and will resume from the start (a well-advanced level-up is considered seen) */
function laneSuspend() {
  if (ARSQ.on) arsShowStop(true);
  if (RU.on && RU.cur) {
    const seen = performance.now() - RU.t0 > RU_MS * 0.55;
    if (!seen) RU.q.unshift(RU.cur);
    rankUpStop();
  }
}
/* Announces the level reached: slot = index of the custom class slot it unlocks (-1: none) */
function rankUpShow(level, slot) {
  RU.q.push([level, slot]); if (RU.q.length > 3) RU.q.shift(); // several levels at once: the last three
  if (ARSQ.on) arsShowStop(true); // a displayed unlock gives way (it will resume afterwards)
  if (!RU.on) lanePump();
}
function rankUpNext() {
  const el = rankUpBuild(), it = RU.q.shift();
  if (!el || !it) { RU.on = false; RU.cur = null; if (el) el.classList.remove('show'); lanePump(); return; }
  RU.on = true; RU.cur = it; RU.t0 = performance.now();
  const [level, slot] = it;
  const promo = rankIndex(level) !== rankIndex(level - 1); // new rank: "Promotion", and its badge
  el.classList.toggle('promo', promo);
  el.querySelector('.ru-kick').textContent = promo ? _t('Promoted') : _t('Level up');
  el.querySelector('.ru-lv').textContent = _t('Level');
  rankPaint(el.querySelector('.ru-ins'), level);
  el.querySelector('.ru-rank').textContent = rankName(level);
  el.querySelector('.ru-old').textContent = Math.max(1, level - 1); el.querySelector('.ru-new').textContent = level;
  el.querySelector('.ru-sub').textContent = slot >= 0 ? _t('Custom class slot {0} unlocked', slot + 1) : _t('Your player level goes up');
  el.querySelectorAll('.ru-sparks i').forEach((s, i, all) => { // sparks: a few, fanned out around the badge, range and duration varying
    const a = (i / all.length) * Math.PI * 2 + Math.random() * 0.4, d = 7 + Math.random() * 6;
    s.style.setProperty('--dx', (Math.cos(a) * d * 1.3).toFixed(1)); s.style.setProperty('--dy', (Math.sin(a) * d).toFixed(1)); s.style.setProperty('--w', (0.8 + Math.random() * 0.5).toFixed(2) + 's');
  });
  el.setAttribute('aria-hidden', 'false'); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  rankUpSound();
  clearTimeout(RU.t); RU.t = setTimeout(() => { el.classList.remove('show'); el.setAttribute('aria-hidden', 'true'); RU.cur = null; RU.t = setTimeout(() => { RU.on = false; lanePump(); }, 250); }, RU_MS);
}
/* Interrupts the displayed level-up (without touching the queue) */
function rankUpStop() {
  RU.on = false; RU.cur = null; clearTimeout(RU.t);
  const el = $('rankUp'); if (el) { el.classList.remove('show'); el.setAttribute('aria-hidden', 'true'); }
}
/* End or abandonment of the match: no more pending announcement */
function rankUpClear() { RU.q.length = 0; rankUpStop(); clearTimeout(LANE.t); }
