/* ==========================================================================
   ARSENAL: per-weapon progression, unlocks, preset and custom classes
   Each weapon earns XP on each kill (100, plus 50 for a headshot) and levels up (1 to WLEVEL_MAX). A weapon's level
   unlocks, in order: its attachments (ATT[id].lvl), its camouflages (CAMOS[id].lvl, by level tiers
   only), and other weapons (unlock field of weapons: { from: weapon to level up, level }).
   Starting weapons (without unlock) are available right away.
   Four preset classes (CLASSES, 06i-weapons.js) cannot be modified; up to five custom classes (name, primary weapon
   and pistol, attachments, camouflages) are created in slots that the player's level unlocks
   (CUSTOM_UNLOCK). The player's level is that of the account, or that of matches played without an account.
   The state is kept in the browser (localStorage, key ARS_KEY): per-weapon progression (XP, kills, headshots),
   custom classes and XP of matches without an account. When logged in, the player also gets a copy on their
   account (arsSync, arsenal route): it follows them from one device to another and survives a cleared storage.
   ========================================================================== */
/* Maximum level of a weapon: 30, that of the Holo camouflage, the last unlock (50 from 4.1.0 to 4.4.0, when the Holo required it; 20 before,
   WLEVEL_V3: that of version 3 and earlier saves). XP earned beyond it is still recorded, it no longer counts */
const ARS_KEY = 'cod_arsenal', WLEVEL_MAX = 30, WLEVEL_V3 = 20, ARS_XP = { kill: 100, head: 50 };
const ARS = { wxp: {}, k: {}, h: {}, px: 0, t0: 0, gain: null, sess: {}, saveT: 0, pushT: 0, synced: '', syncT: 0, ver: 4, cfg: {}, lt: 0, lvSeen: 1, lvT: 0, ch: {}, chMaps: [], chSess: {} };
/* cfg: last configuration (attachments and camouflage) of each weapon in the workshop; it comes back by itself when the weapon is chosen again;
   lt: time of the last edit of the custom classes or of cfg (arsLoadoutEdit), which decides between two devices (arsApply);
   ch, chMaps: progress on challenges (06s-challenges.js); chSess: what they earned during the match */

/* Cumulative XP to reach level l with a weapon: pistols, used less, level up faster. A level requires about three times
   more kills than before 2.20 (WXP_OLD, the curve from before, is used to convert saves so that nobody loses a level).
   Beyond level flat, the curve continues at a constant step: each level costs the passage from flat - 1 to flat (5,900 XP, 40 to 60
   kills), so that levels 21 to 30 advance at a regular pace (level 30: 126,000 XP, 840 to 1,260 kills,
   about twice level 20; extending the curve, 138,000 XP and up to 80 kills for a single one of the last levels) */
const WXP = { k: 450, p: 1.7, flat: 20 }, WXP_OLD = { k: 120, p: 1.6 };
const wxpCurve = (c, id, l) => {
  const pw = (n) => (n <= 1 ? 0 : c.k * Math.pow(n - 1, c.p)), f = c.flat && l > c.flat ? l - c.flat : 0;
  return Math.round((pw(l - f) + f * (f ? pw(c.flat) - pw(c.flat - 1) : 0)) * (WEAPONS[id].cat === 'pistol' ? 0.6 : 1));
};
function wxpForLevel(id, l) { return wxpCurve(WXP, id, l); }
function wLevelInfo(id) {
  const xp = Math.max(0, Math.floor(ARS.wxp[id] || 0));
  let l = 1; while (l < WLEVEL_MAX && xp >= wxpForLevel(id, l + 1)) l++;
  const a = wxpForLevel(id, l), b = l >= WLEVEL_MAX ? a : wxpForLevel(id, l + 1);
  return { level: l, xp, into: xp - a, need: b - a, next: b };
}
/* XP of a save from before the new curve: same level, same progress within the level (the maximum level was then 20) */
function wxpMigrate(id, xp) {
  let l = 1; while (l < WLEVEL_V3 && xp >= wxpCurve(WXP_OLD, id, l + 1)) l++;
  const a = wxpCurve(WXP_OLD, id, l), b = l >= WLEVEL_V3 ? a : wxpCurve(WXP_OLD, id, l + 1), f = b > a ? (xp - a) / (b - a) : 0;
  return Math.round(wxpForLevel(id, l) + f * ((l >= WLEVEL_V3 ? 0 : wxpForLevel(id, l + 1) - wxpForLevel(id, l))));
}
const wLevel = (id) => wLevelInfo(id).level;

/* ---------- Unlocks ---------- */
/* Preview (dev branch: localhost:8080 and its branch addresses): a few camouflages offered so they can be seen without
   earning them, at the owner's request (the Holo on the UMP-45, which otherwise requires level 30), with their weapon. Read from the page
   address: the published version is not affected, even once dev is merged into main */
const PREVIEW_HOST = /^warbash-dev.|-git-dev-/.test(location.hostname), PREVIEW_CAMOS = { ump45: ['holo'] };
/* Reason why a weapon is locked ('' if available; on the preview, a weapon that has an offered camouflage there is available) */
function weaponLock(id) {
  const u = WEAPONS[id].unlock; if (!u || (PREVIEW_HOST && PREVIEW_CAMOS[id])) return '';
  const lv = wLevel(u.from);
  return lv >= u.level ? '' : `${_t('Level up the {0} to level {1} (now level {2})', WEAPONS[u.from].name, u.level, lv)}`;
}
function attLock(wid, aid) { const L = ATT[aid].lvl, lv = wLevel(wid); return lv >= L ? '' : `${_t('Weapon level {0} (now level {1})', L, lv)}`; }
function camoLock(wid, cid) {
  if (PREVIEW_HOST && (PREVIEW_CAMOS[wid] || []).includes(cid)) return '';
  const L = CAMOS[cid].lvl, lv = wLevel(wid);
  return lv >= L ? '' : `${_t('weapon level {0} (now level {1})', L, lv)}`;
}
/* Everything weapon wid has unlocked, to detect what a level gain or a feat brings that is new */
function arsUnlocked(wid) {
  const out = new Set(), base = WEAPONS[wid];
  for (const a in ATT) if (attFits(base, a) && !attLock(wid, a)) out.add('att:' + a);
  for (const c in CAMOS) if (!camoLock(wid, c)) out.add('camo:' + c);
  for (const w in WEAPONS) if (WEAPONS[w].unlock && WEAPONS[w].unlock.from === wid && !weaponLock(w)) out.add('wpn:' + w);
  return out;
}
function arsUnlockName(k) {
  const [t, id] = k.split(':');
  return t === 'att' ? ATT[id].name : t === 'camo' ? _t('Camo {0}', CAMOS[id].name) : WEAPONS[id].name;
}

/* Next unlock of weapon wid: { level, name } or null (everything is unlocked) */
function arsNextUnlock(wid) {
  const lv = wLevel(wid), base = WEAPONS[wid]; let best = null;
  const note = (level, name) => { if (level > lv && (!best || level < best.level)) best = { level, name }; };
  for (const a in ATT) if (attFits(base, a)) note(ATT[a].lvl, ATT[a].name);
  for (const c in CAMOS) note(CAMOS[c].lvl, _t('Camo {0}', CAMOS[c].name));
  for (const w in WEAPONS) if (WEAPONS[w].unlock && WEAPONS[w].unlock.from === wid) note(WEAPONS[w].unlock.level, WEAPONS[w].name);
  return best;
}
/* Weapon (identifier) that bears this name in the kill announcements: '' for the knife, the grenade, the helicopter... */
const WEAPON_ID_BY_NAME = {}; for (const id in WEAPONS) WEAPON_ID_BY_NAME[WEAPONS[id].name] = id;

/* ---------- Gains ---------- */
/* A kill with weapon wid: returns { weapon, level, up, gained, items } (up: levels gained, items: unlocks) */
function arsKill(wid, head) {
  const base = WEAPONS[wid]; if (!base) return null;
  const before = arsUnlocked(wid), l0 = wLevel(wid), gain = ARS_XP.kill + (head ? ARS_XP.head : 0);
  ARS.wxp[wid] = (ARS.wxp[wid] || 0) + gain; ARS.k[wid] = (ARS.k[wid] || 0) + 1; if (head) ARS.h[wid] = (ARS.h[wid] || 0) + 1;
  const S = ARS.sess[wid] || (ARS.sess[wid] = { xp: 0, k: 0, h: 0, l0 }); S.xp += gain; S.k++; if (head) S.h++;
  const l1 = wLevel(wid), items = [...arsUnlocked(wid)].filter((k) => !before.has(k));
  arsSaveSoon();
  return { weapon: wid, level: l1, up: l1 - l0, gained: gain, items };
}
/* The gains of a match: reset when it opens, picked up by the end screen */
function arsSessionReset() { ARS.sess = {}; ARS.chSess = {}; challengesReset(); ARS.t0 = MATCH.time; ARS.gain = null; ARS.lvSeen = playerLevel(); ARS.lvT = 0; }
function arsSessionHtml() {
  const rows = Object.keys(ARS.sess).filter((id) => ARS.sess[id].xp > 0).sort((a, b) => ARS.sess[b].xp - ARS.sess[a].xp).map((id) => {
    const S = ARS.sess[id], L = wLevelInfo(id), up = L.level - S.l0;
    return `<div class="ars-row"><b>${WEAPONS[id].name}</b><span>${_t('+{0} XP · {1} kills', S.xp, S.k)}</span><i>${_t('level {0}{1}', L.level, up > 0 ? ` <em>+${up}</em>` : '')}</i></div>`;
  });
  return rows.join('');
}

/* ---------- Player level ---------- */
/* Cumulative XP to reach a level: the same curve as the accounts server (api/_lib/progress.js) */
const pxpForLevel = (l) => (l <= 1 ? 0 : Math.round(250 * Math.pow(l - 1, 1.6)));
function levelOfXp(xp) { let l = 1; while (l < 100 && xp >= pxpForLevel(l + 1)) l++; return l; }
/* Level used for unlocks: that of the account, or that of matches played without an account, whichever is greater (an
   unlock is not lost by changing situation) */
function playerLevel() {
  const acct = typeof ACCT !== 'undefined' && ACCT.user && ACCT.level ? ACCT.level.level : 1;
  return Math.max(acct, levelOfXp(ARS.px));
}
/* XP of a match played without an account, with the server's rules (api/_lib/progress.js, matchXp); called at the end of the match */
function arsLocalXp(result) {
  ARS.gain = null;
  const me = PL.ent, dur = Math.max(0, Math.floor(MATCH.time - ARS.t0));
  if (dur < 30 || (typeof ACCT !== 'undefined' && ACCT.user)) return;
  const k = me.kills, h = Math.min(PL.hsKills || 0, k), l0 = playerLevel();
  let xp = k * 50 + h * 15 + me.assists * 20 + Math.floor(dur / 60) * 20 + 100 + (result === 'win' ? 150 : result === 'draw' ? 50 : 0);
  if (!MATCH.online) xp *= 0.5;
  xp = Math.min(2500, Math.round(xp)); ARS.px += xp; arsSaveSoon();
  const l1 = playerLevel();
  ARS.gain = { xp, level: l1, up: l1 - l0, slots: CUSTOM_UNLOCK.filter((v) => v > l0 && v <= l1).length };
}

/* XP of the current match so far, per the server's rules without the end-of-match bonus (the finished match gives at least as much):
   a level announced during a match will therefore be earned at the end */
function arsLiveXp() {
  const me = PL.ent, dur = Math.floor(MATCH.time - ARS.t0); if (dur < 30) return 0;
  const k = me.kills, h = Math.min(PL.hsKills || 0, k);
  let xp = k * 50 + h * 15 + me.assists * 20 + Math.floor(dur / 60) * 20; if (!MATCH.online) xp *= 0.5;
  return Math.min(2500, Math.round(xp));
}
/* Player level taking the current match into account */
function playerLevelLive() {
  const live = arsLiveXp(), acct = typeof ACCT !== 'undefined' && ACCT.user && ACCT.level ? ACCT.level.xp : -1;
  return Math.max(playerLevel(), levelOfXp((acct >= 0 ? acct : ARS.px) + live));
}
/* Once per second in a match: announces each player level reached (09n-armory.js, arsNotifyLevel) */
function arsLevelTick(dt) {
  if ((ARS.lvT -= dt) > 0) return;
  ARS.lvT = 1;
  const L = playerLevelLive();
  while (ARS.lvSeen < L) { ARS.lvSeen++; arsNotifyLevel(ARS.lvSeen); }
}

/* ---------- Classes ---------- */
const PRESETS = CLASSES.length, CUSTOM_MAX = 5, CUSTOM_UNLOCK = [3, 6, 10, 15, 20], CUSTOM_NAME_MAX = 16;
for (const c of CLASSES) { c.pa = []; c.sa = []; c.pc = null; c.sc = null; c.def = { primary: c.primary, secondary: c.secondary }; c.preset = true; c.ks = KS_DEFAULT.slice(); }
/* The custom class slots follow the preset classes (indices PRESETS to PRESETS + CUSTOM_MAX - 1) */
for (let n = 0; n < CUSTOM_MAX; n++) {
  CLASSES.push({ name: _t('Class {0}', n + 1), desc: _t('A class of your own making, with weapons, attachments and camos.'), primary: 'm4', secondary: 'm9', nades: NADE_COUNT, nade: 'frag',
    pa: [], sa: [], pc: null, sc: null, ks: KS_DEFAULT.slice(), def: { primary: 'm4', secondary: 'm9' }, custom: true, slot: n, made: false });
}
const customUnlocked = (n) => playerLevel() >= CUSTOM_UNLOCK[n];
/* A class can be chosen if it is a preset, or a custom one, created and unlocked */
const classAvail = (i) => { const c = CLASSES[i]; return !!c && (!c.custom || (c.made && customUnlocked(c.slot))); };
const classIds = () => CLASSES.map((c, i) => i).filter(classAvail);
/* The chosen class still exists (deleted, or slot lost): otherwise the first one */
function classFix() { if (!classAvail(Settings.loadout)) { Settings.loadout = 0; if (typeof saveSettings === 'function') saveSettings(); } }
/* Primary and secondary weapon of a class, with attachments and camouflage */
function classWeapons(i) {
  const c = CLASSES[i];
  return [weaponDef(c.primary, c.pa, c.pc), weaponDef(c.secondary, c.sa, c.sc)];
}
/* The three killstreaks of a class, sorted by threshold (a class being edited may have only two: completed) */
function classKs(i) { const c = CLASSES[i]; return ksFill(c ? c.ks : null); }
/* Chooses or removes a killstreak in a custom class; returns '' or the reason for refusal. A killstreak at the threshold of another already chosen takes its place */
function classToggleKs(i, id) {
  if (!classEditable(i)) return _t('This class cannot be edited.');
  const c = CLASSES[i], K = KSDEF[id]; if (!K) return '';
  if (c.ks.includes(id)) { c.ks = c.ks.filter((x) => x !== id); arsLoadoutEdit(); return ''; }
  const same = c.ks.find((x) => KSDEF[x].n === K.n);
  if (!same && c.ks.length >= KS_SLOTS) return _t('Three killstreaks at most. Remove one before picking another.');
  c.ks = ksSort(c.ks.filter((x) => x !== same).concat(id)); arsLoadoutEdit(); return '';
}
/* Builds in advance the models of a mounted weapon (first-person and outside view): the menu, not the match, pays the cost */
function gunPrebuild(def) { if (!VM.models[def.key]) VM.models[def.key] = vmGunModel(def.key); worldGunGeometry(def.key); }
function arsenalPrebuild() { for (const i of classIds()) for (const d of classWeapons(i)) gunPrebuild(d); }
/* Releases the models built for attachment trials in the Armory: keeps those of the classes, of bare weapons
   (bots, ground weapons) and everything a soldier, a ground weapon or the killcam still carries */
function gunTrim() {
  const keep = new Set(Object.keys(WEAPONS));
  for (const i of classIds()) for (const d of classWeapons(i)) keep.add(d.key);
  if (VM.curDef) keep.add(VM.curDef.key);
  for (const e of entities) { if (e.weapon) keep.add(e.weapon.key); if (e.model && e.model.gunKey) keep.add(e.model.gunKey); if (e.model && e.model.guns) for (const k in e.model.guns) keep.add(k); }
  if (KC.body && KC.body.gunKey) keep.add(KC.body.gunKey);
  for (const k in DROP.models) keep.add(k);
  const free = (grp) => grp.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
  for (const k of Object.keys(VM.models)) if (!keep.has(k)) { free(VM.models[k].group); delete VM.models[k]; }
  for (const k of Object.keys(WORLD_GUN_GEO)) if (!keep.has(k)) { const G = WORLD_GUN_GEO[k]; for (const lv of ['hi', 'lo']) for (const m in G[lv]) if (G[lv][m]) G[lv][m].dispose(); delete WORLD_GUN_GEO[k]; delete GRIP_SHAPES[k]; }
}
/* Puts a configuration back in order: existing, unlocked weapon (otherwise the original one), unlocked attachments that fit the weapon
   (at most attMax, one per slot), unlocked camouflage */
function classClean(c, wkey, akey, ckey, want, defId) {
  let id = WEAPONS[want] && !weaponLock(want) && (wkey === 'primary' ? WEAPONS[want].cat !== 'pistol' : WEAPONS[want].cat === 'pistol') ? want : defId;
  const base = WEAPONS[id];
  c[wkey] = id;
  c[akey] = attNormalize(base, (c[akey] || []).filter((a) => ATT[a] && !attLock(id, a)));
  c[ckey] = c[ckey] && CAMOS[c[ckey]] && !camoLock(id, c[ckey]) ? c[ckey] : null;
}
function classCleanAll(c) {
  classClean(c, 'primary', 'pa', 'pc', c.primary, c.def.primary);
  classClean(c, 'secondary', 'sa', 'sc', c.secondary, c.def.secondary);
  c.ks = ksFill(c.ks);
  if (!NADE_TYPES[c.nade]) c.nade = 'frag';
}
/* Grenade type of a custom class (a single one, NADE_COUNT per life) */
function classSetNade(i, id) {
  if (!classEditable(i) || !NADE_TYPES[id] || CLASSES[i].nade === id) return;
  CLASSES[i].nade = id; arsLoadoutEdit();
}
/* A created custom class can be modified; presets and empty slots never */
const classEditable = (i) => { const c = CLASSES[i]; return !!c && c.custom && c.made; };
/* Creates the class of slot n (default name, starting weapons); returns its index, or -1 if the slot is locked or taken */
function classCreate(n) {
  const c = CLASSES[PRESETS + n]; if (!c || c.made || !customUnlocked(n)) return -1;
  const mp = arsRecall(c.def.primary), ms = arsRecall(c.def.secondary);
  Object.assign(c, { made: true, name: _t('Class {0}', n + 1), primary: c.def.primary, secondary: c.def.secondary, pa: mp.a, sa: ms.a, pc: mp.c, sc: ms.c, ks: KS_DEFAULT.slice(), nade: 'frag' });
  arsLoadoutEdit(); return PRESETS + n;
}
function classRename(i, name) {
  if (!classEditable(i)) return;
  const c = CLASSES[i], t = String(name == null ? '' : name).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, CUSTOM_NAME_MAX);
  c.name = t || _t('Class {0}', c.slot + 1); arsLoadoutEdit();
}
function classDelete(i) {
  if (!classEditable(i)) return;
  const c = CLASSES[i]; c.made = false; c.name = _t('Class {0}', c.slot + 1); c.primary = c.def.primary; c.secondary = c.def.secondary; c.pa = []; c.sa = []; c.pc = c.sc = null; c.ks = KS_DEFAULT.slice(); c.nade = 'frag';
  classFix(); arsLoadoutEdit();
}
/* Remembers the configuration of a weapon, and returns it put back in order (attachments and camouflage still valid) */
const arsRemember = (id, att, camo) => { if (WEAPONS[id]) ARS.cfg[id] = { a: att.slice(), c: camo || null }; };
function arsRecall(id) {
  const m = ARS.cfg[id], base = WEAPONS[id]; if (!m) return { a: [], c: null };
  return { a: attNormalize(base, (m.a || []).filter((x) => ATT[x] && attFits(base, x) && !attLock(id, x))), c: m.c && CAMOS[m.c] && !camoLock(id, m.c) ? m.c : null };
}
function classSetWeapon(i, which, id) {
  if (!classEditable(i)) return false;
  const c = CLASSES[i], k = which === 's';
  if (!WEAPONS[id] || weaponLock(id)) return false;
  if (k ? WEAPONS[id].cat !== 'pistol' : WEAPONS[id].cat === 'pistol') return false;
  if (c[k ? 'secondary' : 'primary'] === id) return true;
  // the weapon left keeps its attachments and camouflage for next time, the new one takes up its own
  arsRemember(c[k ? 'secondary' : 'primary'], c[k ? 'sa' : 'pa'], c[k ? 'sc' : 'pc']);
  const m = arsRecall(id); c[k ? 'secondary' : 'primary'] = id; c[k ? 'sa' : 'pa'] = m.a; c[k ? 'sc' : 'pc'] = m.c;
  arsLoadoutEdit(); return true;
}
/* Places or removes an attachment; returns '' or the reason for refusal */
function classToggleAtt(i, which, aid) {
  if (!classEditable(i)) return _t('This class cannot be edited.');
  const c = CLASSES[i], k = which === 's', id = c[k ? 'secondary' : 'primary'], base = WEAPONS[id], key = k ? 'sa' : 'pa';
  if (c[key].includes(aid)) { c[key] = c[key].filter((x) => x !== aid); arsRemember(id, c[key], c[k ? 'sc' : 'pc']); arsLoadoutEdit(); return ''; }
  if (!attFits(base, aid)) return _t('This attachment does not fit this weapon.');
  const lock = attLock(id, aid); if (lock) return `${_t('Attachment locked: {0}.', lock)}`;
  // one more attachment at the same attachment point replaces the old one; otherwise the limit applies
  const same = c[key].find((x) => attGroup(x) === attGroup(aid));
  const next = c[key].filter((x) => x !== same);
  if (next.length >= attMax(base)) return `${_t('A weapon carries at most {0} attachments. Remove one.', attMax(base))}`;
  c[key] = attNormalize(base, next.concat(aid)); arsRemember(id, c[key], c[k ? 'sc' : 'pc']); arsLoadoutEdit(); return '';
}
function classSetCamo(i, which, cid) {
  if (!classEditable(i)) return false;
  const c = CLASSES[i], k = which === 's', id = c[k ? 'secondary' : 'primary'];
  if (cid && (!CAMOS[cid] || camoLock(id, cid))) return false;
  c[k ? 'sc' : 'pc'] = cid || null; arsRemember(id, c[k ? 'sa' : 'pa'], c[k ? 'sc' : 'pc']); arsLoadoutEdit(); return true;
}
/* Removes the attachments and camouflage of the chosen weapon */
function classClearWeapon(i, which) {
  if (!classEditable(i)) return;
  const c = CLASSES[i], k = which === 's'; c[k ? 'sa' : 'pa'] = []; c[k ? 'sc' : 'pc'] = null; arsRemember(c[k ? 'secondary' : 'primary'], [], null); arsLoadoutEdit();
}

/* ---------- Storage ---------- */
function arsSaveSoon() { if (ARS.saveT) return; ARS.saveT = setTimeout(arsSave, 700); }
/* A custom class or a weapon's configuration has just changed: noted, it will take precedence over that of the other devices */
function arsLoadoutEdit() { ARS.lt = Math.max(Date.now(), ARS.lt + 1); arsSaveSoon(); }
/* Recordable snapshot: local storage and account copy (api/_lib/handlers.js, arsenal) */
function arsSnapshot() {
  const custom = CLASSES.slice(PRESETS).map((c) => (c.made ? { n: c.name, p: c.primary, pa: c.pa, pc: c.pc, s: c.secondary, sa: c.sa, sc: c.sc, k: c.ks, g: c.nade } : null));
  return { v: ARS.ver, wxp: ARS.wxp, k: ARS.k, h: ARS.h, px: Math.floor(ARS.px), cfg: ARS.cfg, lt: ARS.lt, custom, ch: ARS.ch, cm: ARS.chMaps };
}
function arsSave() {
  ARS.saveT = 0;
  try { localStorage.setItem(ARS_KEY, JSON.stringify(arsSnapshot())); } catch (e) { /* storage unavailable: progression stays valid for the session */ }
  arsPushSoon();
}
/* Copy on the account: weapon progression follows the player from one device to another. Saves are batched
   (a single request every 5 s at most); without an account, nothing is sent. */
function arsPushSoon() {
  if (!ACCT.user || ARS.pushT) return;
  ARS.pushT = setTimeout(() => { ARS.pushT = 0; if (ACCT.user) acctApi('arsenal', { data: arsSnapshot() }); }, 5000);
}
/* On login: merges the account's copy and the device's (the highest level of each weapon wins; for custom classes
   and weapon configuration, the most recently edited copy, see arsApply), then sends the result back to the account. */
async function arsSync() {
  if (!ACCT.user) return;
  const r = await acctApi('arsenal', {});
  if (!r.ok || !r.data) return;
  if (r.data.data) { arsApply(r.data.data, true); for (const c of CLASSES) classCleanAll(c); classFix(); }
  ARS.syncT = Date.now();
  arsSave(); // saves the merge on the device and sends it back to the account
  PICKERS.forEach(renderPicker); if (UI.screen === 'classes') classesHeader(); // screens already drawn show the merged progression
}
/* A phone app stays open for days without reloading: the account's copy was only read when the page loaded, so progression earned elsewhere
   never arrived. On return to the foreground (outside a match, at most once a minute) it is read again and merged; when going to the background, whatever is waiting
   to be sent goes out immediately (keepalive: the request survives the page), otherwise the 5 s delay left the progression on the device. */
function arsFlush() {
  if (!ACCT.user || location.protocol === 'file:' || !(ARS.saveT || ARS.pushT)) return;
  if (ARS.saveT) { clearTimeout(ARS.saveT); ARS.saveT = 0; try { localStorage.setItem(ARS_KEY, JSON.stringify(arsSnapshot())); } catch (e) { /* ignored */ } }
  clearTimeout(ARS.pushT); ARS.pushT = 0;
  try { fetch('/api/arsenal', { method: 'POST', credentials: 'same-origin', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: arsSnapshot() }) }).catch(() => {}); } catch (e) { /* ignored */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) arsFlush();
  else if (ACCT.user && MATCH.state === 'menu' && Date.now() - ARS.syncT > 60000) { ARS.syncT = Date.now(); arsSync(); }
});
addEventListener('pagehide', arsFlush);
function arsApply(s, merge) {
  if (!s || !(s.v >= 1 && s.v <= 4)) return;
  const num = (o) => { const r = {}; if (o && typeof o === 'object') for (const k in o) if (WEAPONS[k] && Number.isFinite(+o[k]) && +o[k] > 0) r[k] = Math.min(1e7, Math.floor(+o[k])); return r; };
  const join = (a, b) => { const r = { ...a }; for (const k in b) r[k] = Math.max(r[k] || 0, b[k]); return r; };
  let wxp = num(s.wxp);
  if (s.v < 3) { for (const id in wxp) wxp[id] = wxpMigrate(id, wxp[id]); arsSaveSoon(); } // longer curve: levels already reached are kept
  // maximum level raised from 20 to 50 (version 4): XP earned beyond level 20 counted for nothing, it does not make you jump up at once;
  // everyone restarts from the beginning of level 20. Any earlier copy (device, account) is brought back this way on read: the merge keeps the highest
  // of each weapon, an old copy would otherwise give back the removed XP
  if (s.v < 4) { for (const id in wxp) wxp[id] = Math.min(wxp[id], wxpForLevel(id, WLEVEL_V3)); arsSaveSoon(); }
  const px = Number.isFinite(+s.px) && +s.px > 0 ? Math.min(1e8, Math.floor(+s.px)) : 0;
  // challenges (06s-challenges.js; their list does not exist yet at load time: any well-formed counter is kept) and maps where a match was finished
  const ch = {}; if (s.ch && typeof s.ch === 'object') for (const k in s.ch) if (/^[a-zA-Z]{2,16}$/.test(k) && Number.isFinite(+s.ch[k]) && +s.ch[k] > 0) ch[k] = Math.min(1e6, Math.floor(+s.ch[k]));
  const cm = Array.isArray(s.cm) ? s.cm.map(String).filter((m, i, a) => MAPS.some((x) => x.id === m) && a.indexOf(m) === i) : [];
  if (merge) { ARS.wxp = join(ARS.wxp, wxp); ARS.k = join(ARS.k, num(s.k)); ARS.h = join(ARS.h, num(s.h)); ARS.px = Math.max(ARS.px, px); ARS.ch = join(ARS.ch, ch); for (const m of cm) if (!ARS.chMaps.includes(m)) ARS.chMaps.push(m); }
  else { ARS.wxp = wxp; ARS.k = num(s.k); ARS.h = num(s.h); ARS.px = px; ARS.ch = ch; ARS.chMaps = cm; }
  /* Custom classes and weapon configuration: the most recently edited copy (lt) wins, whole, deleted classes included.
     Before, the device's own copy always kept its classes: edited on the computer, they never changed on the phone, and a
     deleted class came back from the other device. With no date on either side (older copies), only empty slots are filled */
  const lt = Number.isFinite(+s.lt) && +s.lt > 0 ? Math.floor(+s.lt) : 0, take = !merge || lt > ARS.lt, fill = merge && !lt && !ARS.lt;
  if (take) ARS.lt = lt;
  if (s.cfg && typeof s.cfg === 'object') for (const k in s.cfg) { const m = s.cfg[k]; if (WEAPONS[k] && m && typeof m === 'object' && (take || (fill && !ARS.cfg[k]))) ARS.cfg[k] = { a: Array.isArray(m.a) ? m.a.map(String).slice(0, 8) : [], c: m.c ? String(m.c) : null }; }
  if (s.v >= 2 && Array.isArray(s.custom) && (take || fill)) for (let n = 0; n < CUSTOM_MAX; n++) {
    const c = CLASSES[PRESETS + n], x = s.custom[n];
    if (!x || typeof x !== 'object') { if (merge && take && c.made) Object.assign(c, { made: false, name: _t('Class {0}', n + 1), primary: c.def.primary, secondary: c.def.secondary, pa: [], sa: [], pc: null, sc: null, ks: KS_DEFAULT.slice() }); continue; }
    if (!take && c.made) continue;
    c.made = true; c.name = String(x.n == null ? '' : x.n).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, CUSTOM_NAME_MAX).replace(/^(?:Classe|Class) (\d)$/, (m, d) => _t('Class {0}', d)) || _t('Class {0}', n + 1);
    c.primary = String(x.p); c.secondary = String(x.s); c.pa = Array.isArray(x.pa) ? x.pa.map(String) : []; c.sa = Array.isArray(x.sa) ? x.sa.map(String) : [];
    c.pc = x.pc ? String(x.pc) : null; c.sc = x.sc ? String(x.sc) : null;
    c.ks = ksFill(Array.isArray(x.k) ? x.k.map(String) : null); // killstreaks (absent from older copies: the original ones)
    c.nade = NADE_TYPES[x.g] ? x.g : 'frag'; // grenade type (absent from older copies: the frag)
  }
}
function arsLoad() {
  let s = null; try { s = JSON.parse(localStorage.getItem(ARS_KEY) || 'null'); } catch (e) { /* ignored */ }
  arsApply(s, false);
  for (const c of CLASSES) classCleanAll(c);
}
arsLoad();
