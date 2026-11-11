/* ==========================================================================
   CLASS WORKSHOP: building a custom class (name, primary weapon and pistol, attachments, camos),
   in-match progression announcements
   The screen (section #scr-arsenal) opens from the detail of a custom class (Classes menu, class choice at
   deployment). On the left, weapons by category as preview cards (thumbnails from 09o-showcase.js), with their level
   or what locks them; on the right, the 3D view of the chosen weapon, which can be rotated, and where "+" dots placed on the
   model open the attachment list for the slot (optic, muzzle, barrel, underbarrel, rail, magazine, stock,
   ammo), then the weapon's level, its stats adjusted by the attachments, the attached accessories and the
   camos. Every choice is saved immediately (06r-arsenal.js); on leaving the screen, the class models are
   built in advance and the trial ones freed.
   ========================================================================== */
const ARSUI = { cls: -1, tab: 'p', pop: '', msg: '', weapon: '', ksSee: '', nadeSee: '' }; // ksSee, nadeSee: streak, grenade whose tab shows the detail
const STAT_NAMES = [['dmg', _t('Damage')], ['acc', _t('Accuracy')], ['rng', _t('Range')], ['rof', _t('Fire rate')], ['mob', _t('Mobility')]];

function arsOpen(i) {
  if (!classEditable(i)) return;
  ARSUI.cls = i; ARSUI.tab = 'p'; ARSUI.pop = ''; ARSUI.msg = ''; ARSUI.weapon = ''; ARSUI.ksSee = ''; ARSUI.nadeSee = ''; uiGo('arsenal');
}
/* Called on leaving the screen: the view closes, the class models are ready before the match, the trial ones are freed */
function arsLeave() { arsKsFill(); arsPopClose(); vwClose(); arsenalPrebuild(); gunTrim(); PICKERS.forEach(renderPicker); menuMainRefresh(); thumbsStart(); }
/* Esc: first closes the open attachment list */
function arsEscape() { if (ARSUI.pop) { arsPopClose(); return true; } return false; }

/* A statistic: label, bar (gained part in green, lost in red) and value out of 100, preceded by the signed difference (color is never alone) */
const statBar = (label, a, b) => {
  const lo = Math.min(a, b), hi = Math.max(a, b), d = Math.round(b * 100) - Math.round(a * 100);
  return `<div class="stat"><span>${label}</span><div class="track"><i style="width:${(lo * 100).toFixed(1)}%"></i>${hi > lo + 0.004 ? `<i class="${b > a ? 'up' : 'dn'}" style="left:${(lo * 100).toFixed(1)}%;width:${((hi - lo) * 100).toFixed(1)}%"></i>` : ''}</div><b>${d ? `<em class="${d > 0 ? 'up' : 'dn'}">${d > 0 ? '+' : '−'}${Math.abs(d)}</em>` : ''}${Math.round(b * 100)}</b></div>`;
};
/* The class, slot and weapon being edited */
function arsCur() {
  const i = ARSUI.cls, c = CLASSES[i], sec = ARSUI.tab === 's', def = classWeapons(i)[sec ? 1 : 0];
  return { i, c, sec, which: sec ? 's' : 'p', def, base: WEAPONS[sec ? c.secondary : c.primary], eq: c[sec ? 'sa' : 'pa'], camo: c[sec ? 'sc' : 'pc'] };
}
/* Weapon name and level, XP bar, next unlock */
function arsLevelHtml(base) {
  const wid = base.id, L = wLevelInfo(wid), nx = arsNextUnlock(wid), k = ARS.k[wid] || 0, h = ARS.h[wid] || 0;
  return `<div class="ars-lv"><p class="wt">${base.type}</p><p class="wn">${base.name}<small>${_t('Level {0}', L.level)}</small></p>
    <div class="ac-bar"><i style="transform:scaleX(${L.need ? (L.into / L.need).toFixed(3) : 1})"></i></div>
    <span>${_tn(k, '{1} · {0} kill, {2} headshots', '{1} · {0} kills, {2} headshots', L.need ? `${_t('{0} / {1} XP to level {2}', L.into, L.need, L.level + 1)}` : _t('Max level'), h)}</span>
    <span>${nx ? `${_t('Next unlock at level {0}:', nx.level)} <em>${esc(nx.name)}</em>` : _t('Everything is unlocked for this weapon')}</span></div>`;
}

function renderArsenal(reset = true) {
  if (!classEditable(ARSUI.cls)) { uiGo('classes', false); return; }
  const { c } = arsCur(), ks = ARSUI.tab === 'k', gr = ARSUI.tab === 'g';
  $('arsSub').textContent = ks ? _t('Custom class {0} of {1}. Pick three killstreaks, each unlocked at a different number of kills', c.slot + 1, CUSTOM_MAX)
    : gr ? _t('Custom class {0} of {1}. Pick a grenade or the throwing knife, you get two every life', c.slot + 1, CUSTOM_MAX)
    : _t('Custom class {0} of {1}. Choose your weapons. The + markers on the weapon open its attachments', c.slot + 1, CUSTOM_MAX);
  const inp = $('arsName'); if (document.activeElement !== inp) inp.value = c.name;
  renderArsSlots();
  $('arsStage').classList.toggle('series', ks || gr); // streaks, grenade: no 3D view (09-game.js no longer draws it), the detail takes its place
  if (ks) { renderArsKsList(); renderArsKsPanel(); return; }
  if (gr) { renderArsNadeList(); renderArsNadePanel(); return; }
  renderArsList(); arsStageSet(reset); renderArsPanel();
  const help = VW.host && VW.host.querySelector('.vw-help'); if (help) help.textContent = TOUCH.on ? _t('Drag to rotate the weapon') : _t('Drag to rotate the weapon, scroll to zoom in'); // (no wheel on touch)
}
/* The class's four slots, as cards showing what was put in them (owner's feedback: make the workshop more expressive, like
   Call of Duty's class creation screen); a card opens its slot */
function renderArsSlots() {
  const c = CLASSES[ARSUI.cls], [p, s] = classWeapons(ARSUI.cls), root = $('arsTabs'), N = NADE_TYPES[c.nade] || NADE_TYPES.frag;
  const acc = (d) => (d.att.length ? _tn(d.att.length, '{0} attachment', '{0} attachments') : _t('Stock'));
  const items = [
    ['p', _t('Primary'), esc(p.name), acc(p)],
    ['s', _t('Pistol'), esc(s.name), acc(s)],
    ['g', _t('Equipment'), nadeSvg(c.nade) + esc(N.name), _t('{0} per life', NADE_COUNT)],
    ['k', _t('Killstreaks'), `<span class="ics">${c.ks.map(ksSvg).join('')}</span>`, c.ks.map((id) => KSDEF[id].n).join(' · ')],
  ];
  root.innerHTML = items.map(([v, l, val, sub]) => `<button type="button" class="ars-slot" role="radio" data-v="${v}" aria-checked="${v === ARSUI.tab}"><span class="sl">${l}</span><span class="sv">${val}</span><span class="ss">${sub}</span></button>`).join('');
}
/* ---------- Grenade tab ---------- */
function renderArsNadeList() {
  const c = CLASSES[ARSUI.cls];
  $('arsList').innerHTML = `<h4>${_t('One per class')}</h4><div class="ars-grid">${NADE_IDS.map((id) => {
    const on = c.nade === id, N = NADE_TYPES[id];
    return `<button type="button" class="ars-card ars-ksc" data-nade="${id}" aria-selected="${on}"><span class="ic">${nadeSvg(id)}</span>${on ? `<span class="ars-on">${_t('Equipped')}</span>` : ''}<span class="n">${esc(N.name)}</span><span class="m">${esc(N.long)}</span></button>`;
  }).join('')}</div>`;
}
/* Detail of the equipped grenade (or the last one touched): its effect and its numbers */
function renderArsNadePanel() {
  const c = CLASSES[ARSUI.cls], id = NADE_TYPES[ARSUI.nadeSee] ? ARSUI.nadeSee : c.nade, N = NADE_TYPES[id];
  const num = (v) => v.toLocaleString(LOCALE);
  const facts = id === 'knife' ? [[_t('Per life'), String(NADE_COUNT)], [_t('Effect'), _t('One-hit kill')], [_t('Speed'), _t('{0} m/s', THROW_KNIFE.speed)], [_t('On the ground'), _t('Pick it back up')]]
    : [[_t('Fuse'), _t('{0} s', num(N.fuse))], [_t('Per life'), String(NADE_COUNT)]].concat(
    id === 'flash' ? [[_t('Effect'), _t('Blinds for up to {0} s', num(FLASH.max))], [_t('Range'), _t('{0} m', FLASH.r)]]
    : id === 'smoke' ? [[_t('Effect'), _t('{0} s cloud', SMOKE.life)], [_t('Width'), _t('{0} m', num(Math.round(SMOKE.r * 2)))]]
    : [[_t('Effect'), _t('Up to {0} damage', 150)], [_t('Radius'), _t('{0} m', num(7.5))]]);
  $('arsPanel').innerHTML = `<div class="ars-cols"><div>
    <div class="ars-lv"><p class="wt">${esc(N.long)}</p><p class="wn">${esc(N.name)}${id === c.nade ? `<small>${_t('Equipped')}</small>` : ''}</p><span>${esc(N.desc)}</span></div>
    </div><div><dl class="ars-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></div></div>`;
}
function arsNadePick(id) {
  const c = CLASSES[ARSUI.cls]; ARSUI.nadeSee = id;
  if (c.nade !== id) { classSetNade(ARSUI.cls, id); sfxUi('equip'); } else sfxUi('click');
  renderArsSlots(); renderArsNadeList(); renderArsNadePanel();
}
/* Weapon cards by category */
function renderArsList() {
  const { sec, base } = arsCur();
  $('arsList').innerHTML = WEAPON_CATS.filter((k) => (sec ? k.id === 'pistol' : k.id !== 'pistol')).map((cat) => {
    const ids = Object.keys(WEAPONS).filter((id) => WEAPONS[id].cat === cat.id);
    return `<h4>${cat.name}</h4><div class="ars-grid">${ids.map((id) => {
      const w = WEAPONS[id], lock = weaponLock(id), u = w.unlock;
      const meta = lock ? _t('{0} level {1}', WEAPONS[u.from].name, u.level) : _t('Level {0}', wLevel(id));
      return `<button type="button" class="ars-card${lock ? ' lock' : ''}" data-w="${id}" aria-selected="${id === base.id}" ${lock ? `title="${esc(lock)}"` : ''}><img data-thumb="${id}" alt="" decoding="async" src="${weaponThumb(id)}">${id === base.id ? `<span class="ars-on">${_t('Equipped')}</span>` : ''}<span class="n">${w.name}</span><span class="m">${esc(meta)}</span></button>`;
    }).join('')}</div>`;
  }).join('');
}
/* ---------- Streaks tab ---------- */
/* A class left with fewer than three streaks (one removed, none chosen in its place) is filled in */
function arsKsFill() { const c = CLASSES[ARSUI.cls]; if (classEditable(ARSUI.cls) && c.ks.length < KS_SLOTS) { c.ks = ksFill(c.ks); arsLoadoutEdit(); } }
const ksSvg = (id) => `<svg viewBox="0 0 24 24" aria-hidden="true">${KSDEF[id].icon}</svg>`;
/* Streaks by number of eliminations: at most one per row is taken (choosing the other in the row replaces it) */
function renderArsKsList() {
  const c = CLASSES[ARSUI.cls], ns = [...new Set(KS_IDS.map((id) => KSDEF[id].n))].sort((a, b) => a - b);
  $('arsList').innerHTML = ns.map((n) => `<h4>${_tn(n, '{0} kill in a row', '{0} kills in a row')}</h4><div class="ars-grid">${KS_IDS.filter((id) => KSDEF[id].n === n).map((id) => {
    const on = c.ks.includes(id);
    return `<button type="button" class="ars-card ars-ksc" data-ks="${id}" aria-selected="${on}"><span class="ic">${ksSvg(id)}</span>${on ? `<span class="ars-on">${_t('Selected')}</span>` : ''}<span class="n">${esc(KSDEF[id].name)}</span><span class="m">${on ? esc(_t('Slot {0}', c.ks.indexOf(id) + 1)) : ''}</span></button>`;
  }).join('')}</div>`).join('');
}
/* The class's streaks in their slots, then the detail of the last one touched */
function renderArsKsPanel() {
  const c = CLASSES[ARSUI.cls], see = KSDEF[ARSUI.ksSee] ? ARSUI.ksSee : c.ks[0] || KS_DEFAULT[0], K = KSDEF[see], left = KS_SLOTS - c.ks.length;
  const rows = [0, 1, 2].map((i) => {
    const id = c.ks[i];
    return id ? `<li>${ksSvg(id)}<b>${esc(KSDEF[id].name)}</b><em>${_tn(KSDEF[id].n, '{0} kill', '{0} kills')}</em></li>` : `<li class="empty"><b>${_t('Free slot')}</b></li>`;
  }).join('');
  $('arsPanel').innerHTML = `<div class="ars-cols"><div>
    <h4 class="ars-h">${_t('Class killstreaks')} <small>${c.ks.length} / ${KS_SLOTS}</small></h4>
    <ol class="ars-kss">${rows}</ol>
    <p class="ars-msg" id="arsMsg" aria-live="polite">${esc(ARSUI.msg || (left ? _tn(left, 'Pick {0} more killstreak.', 'Pick {0} more killstreaks.') : ''))}</p>
    </div><div>
    <div class="ars-lv"><p class="wt">${_tn(K.n, '{0} kill in a row', '{0} kills in a row')}</p><p class="wn">${esc(K.name)}</p><span>${esc(K.desc)}</span></div>
    </div></div>`;
}
function arsKsPick(id) {
  const r = classToggleKs(ARSUI.cls, id); ARSUI.ksSee = id;
  if (r) { ARSUI.msg = r; sfxUi('locked'); } else { ARSUI.msg = ''; sfxUi(CLASSES[ARSUI.cls].ks.includes(id) ? 'equip' : 'unequip'); }
  renderArsSlots(); renderArsKsList(); renderArsKsPanel();
}

/* The 3D view shows the class's mounted weapon; reset: back to the starting view (new weapon) */
function arsStageSet(reset) {
  const { def, base } = arsCur();
  if (!VW.host) vwMount($('arsView'), { labelOf: arsHotLabel, onHot: arsHotClick, hotOff: () => ARSUI.pop === 'camo' });
  const fresh = reset && ARSUI.weapon !== base.id;
  ARSUI.weapon = base.id;
  vwSet(def.key, attGroupsOf(base), fresh);
}
/* Level, stats, attached accessories, camos */
function renderArsPanel() {
  renderArsSlots(); // (the slot's number of attachments)
  const { c, sec, def, base, eq, camo } = arsCur(), max = attMax(base);
  const chips = eq.map((a) => `<span class="ars-chip"><em>${ATT_SLOT_NAMES[ATT[a].slot]}</em>${esc(attName(a, def))}<button type="button" data-rm="${a}" aria-label="${esc(_t('Remove: {0}', attName(a, def)))}">×</button></span>`).join('');
  $('arsPanel').innerHTML = `<div class="ars-cols"><div>
    ${arsLevelHtml(base)}
    <h4 class="ars-h">${_t('Attachments')} <small>${eq.length} / ${max}</small>${eq.length ? `<button type="button" class="btn" data-clear="1">${_t('Remove all')}</button>` : ''}</h4>
    <div class="ars-eq">${chips || _t('<span class="hint">No attachments: the + markers on the weapon add them.</span>')}</div>
    <p class="ars-msg" id="arsMsg" aria-live="polite">${esc(ARSUI.msg)}</p>
    </div><div>
    <div class="ars-stats">${STAT_NAMES.map(([k, n]) => statBar(n, base.stats[k], def.stats[k])).join('')}<p class="hint">${_t('Magazine:')} <b>${def.mag}</b> ${_t('rounds{0} · {1} rounds per minute', def.tube ? ' (tube magazine)' : '', Math.round(def.rpm))}</p></div>
    </div></div>`;
  renderArsCorner();
}
/* In the view's frame: attachment counter (top left) and rectangle of the applied camo (bottom right), which opens the camo list */
function renderArsCorner() {
  if (!VW.host) return;
  const { base, eq, camo } = arsCur(), max = attMax(base), cn = VW.host.querySelector('.vw-count'), cc = VW.host.querySelector('.vw-corner');
  cn.innerHTML = `${_t('Attachments')} <b>${eq.length} / ${max}</b>`; cn.classList.toggle('full', eq.length >= max);
  const name = camo ? CAMOS[camo].name : _t('Standard');
  cc.innerHTML = `<button type="button" class="vw-camo${camo ? '' : ' none'}${ARSUI.pop === 'camo' ? ' open' : ''}" data-camo-open="1" aria-label="${esc(_t('Camo: {0}, change', name))}" style="${camo ? `background-image:url(${camoSwatch(camo)})` : ''}"><span><small>${_t('Camo')}</small>${esc(name)}</span></button>`;
}
function arsMsg(t) { ARSUI.msg = t; const el = $('arsMsg'); if (el) el.textContent = t; }

/* ---------- "+" dots and attachment list ---------- */
function arsHotLabel(slot) {
  const { eq, def, base } = arsCur(), a = eq.find((x) => attGroup(x) === slot);
  return { on: !!a, open: ARSUI.pop === slot, full: eq.length >= attMax(base), text: a ? attName(a, def) : ATT_GROUP_NAMES[slot], slotName: ATT_GROUP_NAMES[slot] };
}
function arsHotClick(slot) { if (ARSUI.pop === slot) arsPopClose(); else arsPopOpen(slot); }
function arsPopOpen(slot) {
  const { eq, def, base } = arsCur(), pop = $('arsPop');
  const ids = Object.keys(ATT).filter((a) => attGroup(a) === slot && attFits(base, a)).sort((x, y) => ATT_SLOTS.indexOf(ATT[x].slot) - ATT_SLOTS.indexOf(ATT[y].slot) || ATT[x].lvl - ATT[y].lvl), cur = eq.find((a) => attGroup(a) === slot);
  const multi = new Set(ids.map((a) => ATT[a].slot)).size > 1; // a dot covering two slots (muzzle and barrel, magazine and ammo): say which one
  const full = !cur && eq.length >= attMax(base);
  pop.innerHTML = `<h5><span>${ATT_GROUP_NAMES[slot]}</span><button type="button" data-close="1" aria-label="${_t('Close')}">×</button></h5>`
    + (full ? `<p class="hp-full">${_t('Limit reached: {0} attachments at most. Remove one to fit this one.', attMax(base))}</p>` : '')
    + (cur ? `<button type="button" class="hp-opt none" data-rm="${cur}"><span class="t">${_t('Remove: {0}', esc(attName(cur, def)))}</span></button>` : '')
    + (ids.length ? ids.map((a) => {
      const lock = attLock(base.id, a), on = a === cur, fx = attEffects(a, def).slice(0, 4);
      return `<button type="button" class="hp-opt${on ? ' on' : ''}${lock ? ' lock' : ''}" data-att="${a}" title="${esc(ATT[a].desc)}"><span class="t">${esc(attName(a, def))}<i>${multi ? ATT_SLOT_NAMES[ATT[a].slot] + (lock ? ' · ' + _t('level {0}', ATT[a].lvl) : on ? ' · ' + _t('fitted') : '') : lock ? _t('Level {0}', ATT[a].lvl) : on ? _t('Fitted') : ''}</i></span><span class="f">${fx.map((f) => `<span class="${f.good ? 'g' : 'b'}">${esc(f.t)}</span>`).join('')}</span></button>`;
    }).join('') : _t('<p class="hint">No attachments for this slot.</p>'));
  ARSUI.pop = slot; pop.classList.remove('camo'); pop.hidden = false;
  const P = vwHotPos(slot), room = arsPopRoom(pop);
  if (P) { pop.style.left = clamp(P.x + 26, 8, Math.max(8, P.W - pop.offsetWidth - 8)).toFixed(0) + 'px'; pop.style.top = clamp(P.y - 22, 8, Math.max(8, Math.min(P.H - 90, room - pop.offsetHeight))).toFixed(0) + 'px'; }
  vwLabels();
  const first = pop.querySelector('.hp-opt'); if (first) first.focus({ preventScroll: true });
}
/* The weapon's camo list (unrolled from the view's rectangle): applied, available or locked with what unlocks it */
function arsCamoOpen() {
  const { base, camo } = arsCur(), pop = $('arsPop');
  const items = `<button type="button" class="ars-camo none${camo ? '' : ' on'}" data-camo="" aria-pressed="${!camo}"><span>${_t('Standard')}</span></button>` + Object.keys(CAMOS).map((id) => {
    const lock = camoLock(base.id, id), on = camo === id;
    return `<button type="button" class="ars-camo${on ? ' on' : ''}${lock ? ' lock' : ''}" data-camo="${id}" aria-pressed="${on}" title="${lock ? esc(_t('To unlock it: {0}', lock)) : ''}" style="background-image:url(${camoSwatch(id)})"><span>${CAMOS[id].name}</span>${lock ? _t('<i>Locked</i>') : ''}</button>`;
  }).join('');
  pop.innerHTML = `<h5><span>${_t('Camo')}</span><button type="button" data-close="1" aria-label="${_t('Close')}">×</button></h5><div class="ars-camos">${items}</div><p class="hint" id="arsPopMsg">${_t('Camos unlock with the weapon\u0027s level.')}</p>`;
  ARSUI.pop = 'camo'; pop.classList.add('camo'); pop.hidden = false; vwLabels(); renderArsCorner();
  const room = arsPopRoom(pop);
  pop.style.left = clamp(VW.W - pop.offsetWidth - 10, 8, VW.W).toFixed(0) + 'px'; pop.style.top = Math.max(8, Math.min(VW.H - pop.offsetHeight - 66, room - pop.offsetHeight)).toFixed(0) + 'px';
  const first = pop.querySelector('.ars-camo.on') || pop.querySelector('.ars-camo'); if (first) first.focus({ preventScroll: true });
}
/* Space available for the floating list, from the top of the view to the bottom of the screen (px); its maximum height follows from it */
function arsPopRoom(pop) {
  const r = VW.host.getBoundingClientRect(), room = Math.max(140, (VIEW.h || innerHeight) - r.top - 12);
  pop.style.maxHeight = Math.min(420, room - 8) + 'px';
  return room;
}
function arsPopClose() { ARSUI.pop = ''; const pop = $('arsPop'); if (pop) pop.hidden = true; if (VW.model) { vwLabels(); renderArsCorner(); } }
/* Attaches, replaces or removes an attachment (refusal: message under the camos) */
function arsApplyAtt(aid) {
  const { i, which } = arsCur(), r = classToggleAtt(i, which, aid);
  if (r) { arsMsg(r); sfxUi('locked'); return; }
  sfxUi(arsCur().eq.includes(aid) ? 'equip' : 'unequip'); // mounted on the weapon or removed
  ARSUI.msg = ''; arsPopClose(); arsStageSet(false); renderArsPanel();
}

function arsInit() {
  // class slots (renderArsSlots): switching from one to the other
  $('arsTabs').addEventListener('click', (e) => {
    const b = e.target.closest('.ars-slot'); if (!b || b.dataset.v === ARSUI.tab) return;
    sfxUi('tab'); if (ARSUI.tab === 'k') arsKsFill();
    ARSUI.tab = b.dataset.v; ARSUI.msg = ''; arsPopClose(); renderArsenal(true);
  });
  $('arsList').addEventListener('click', (e) => {
    const b = e.target.closest('.ars-card'); if (!b) return;
    if (b.dataset.ks) { arsKsPick(b.dataset.ks); return; }
    if (b.dataset.nade) { arsNadePick(b.dataset.nade); return; }
    const { i, which } = arsCur(), lock = weaponLock(b.dataset.w);
    if (lock) { arsMsg(`${_t('{0} locked: {1}.', WEAPONS[b.dataset.w].name, lock)}`); sfxUi('locked'); return; }
    classSetWeapon(i, which, b.dataset.w); ARSUI.msg = ''; arsPopClose(); renderArsenal(true); sfxUi('click');
  });
  $('arsView').addEventListener('click', (e) => { if (e.target.closest('[data-camo-open]')) { if (ARSUI.pop === 'camo') arsPopClose(); else arsCamoOpen(); sfxUi('click'); } });
  $('arsPanel').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const { i, which, base } = arsCur();
    if (b.dataset.rm) arsApplyAtt(b.dataset.rm);
    else if (b.dataset.clear) { classClearWeapon(i, which); ARSUI.msg = ''; arsStageSet(false); renderArsPanel(); }
  });
  $('arsPop').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.close) { arsPopClose(); sfxUi('close'); return; }
    if (b.dataset.camo !== undefined && b.classList.contains('ars-camo')) {
      const { i, which, base } = arsCur();
      if (!classSetCamo(i, which, b.dataset.camo)) { const m = $('arsPopMsg'); if (m) m.textContent = `${_t('Locked: {0}.', camoLock(base.id, b.dataset.camo))}`; sfxUi('locked'); return; }
      ARSUI.msg = ''; arsPopClose(); arsStageSet(false); renderArsPanel(); sfxUi('camo');
    } else if (b.dataset.rm) arsApplyAtt(b.dataset.rm); else if (b.dataset.att) arsApplyAtt(b.dataset.att);
  });
  // the list closes on a click elsewhere
  document.addEventListener('pointerdown', (e) => { if (ARSUI.pop && !e.target.closest('#arsPop') && !e.target.closest('.hot') && !e.target.closest('.vw-camo')) arsPopClose(); });
  // class name: saved on validation (Enter or leaving the field)
  const name = $('arsName');
  const commit = () => { if (!classEditable(ARSUI.cls)) return; classRename(ARSUI.cls, name.value); name.value = CLASSES[ARSUI.cls].name; PICKERS.forEach(renderPicker); };
  name.addEventListener('change', commit);
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); name.blur(); } });
}

/* ---------- In-match announcements ---------- */
let arsUpT = 0;
const ARSQ = { list: [], on: false, cur: null };
/* Unlocks (weapon leveling up, attachment, challenge, outfit): in the announcement corridor, the same queue as the level-up (09s-rankup.js);
   html: a <b> title and a <span> line */
function arsShow(html) {
  if (ARSQ.list.length < 4) ARSQ.list.push(html);
  lanePump();
}
function arsShowNext() {
  const el = $('arsUp'), h = ARSQ.list.shift();
  if (!el || h === undefined) { ARSQ.on = false; return; }
  ARSQ.on = true; ARSQ.cur = h; el.innerHTML = `<i class="au-ic" aria-hidden="true"></i><div class="au-tx">${h}</div>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(arsUpT); arsUpT = setTimeout(() => { el.classList.remove('show'); ARSQ.cur = null; arsUpT = setTimeout(() => { ARSQ.on = false; lanePump(); }, 350); }, 4200);
  sfxUi('unlock');
}
/* Interrupts the displayed unlock; again: it will resume at the head of the queue */
function arsShowStop(again) {
  if (again && ARSQ.cur) ARSQ.list.unshift(ARSQ.cur);
  ARSQ.on = false; ARSQ.cur = null; clearTimeout(arsUpT);
  const el = $('arsUp'); if (el) el.classList.remove('show');
}
/* End or abandonment of the match: no more pending announcement */
function arsShowClear() { rankUpClear(); ARSQ.list.length = 0; arsShowStop(false); }
/* res: result of arsKill; an announcement when the weapon levels up or unlocks something */
function arsNotify(res) {
  if (!res || (!res.up && !res.items.length)) return;
  arsShow(`<b>${WEAPONS[res.weapon].name}${res.up ? ` : ${_t('level {0}', res.level)}` : ''}</b>${res.items.length ? `<span>${_t('Unlocked: {0}', res.items.map((k) => esc(arsUnlockName(k))).join(' · '))}</span>` : ''}`);
}
/* The player passes a level (arsLevelTick): a new custom class slot is announced along the way */
function arsNotifyLevel(level) { rankUpShow(level, CUSTOM_UNLOCK.indexOf(level)); } // the level-up ritual, with its fanfare (09s-rankup.js)
/* End screen: the weapons that gained XP during the match */
function arsEndFill() {
  const el = $('endArs'); if (!el) return;
  const h = arsSessionHtml(), d = challengesEndHtml(); // and the outfit challenges (06s-challenges.js)
  // (the challenges in two columns when the panel is wide: a match can move a dozen)
  el.innerHTML = (h ? `<h4>${_t('Weapon progression')}</h4>${h}` : '') + (d ? `<h4>${_t('Challenges')}</h4><div class="end-ch">${d}</div>` : ''); el.classList.toggle('hidden', !h && !d);
}
