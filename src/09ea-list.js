/* ==========================================================================
   LAUNCH MENUS (Solo, Multiplayer): in the style of the old Call of Duty games
   On the left, the menu: a few rows (Map, Match settings, Edit class...), the map preview below, the main
   action at the bottom. On the right, the stage: what there is to see at this level (the teams, the lobby's players, the public matches).
   A submenu opens in a panel that slides in to the right of the menu, over the stage; the menu stays visible, darkened, its open row
   marked. Up and down go through the rows; left and right adjust a value, otherwise move from one column to the other (at the
   left edge of a submenu, they close it); A or Enter opens or confirms; B or Escape closes the submenu, then leaves the screen.
   A page is a function (params) => page:
     level 0 (the menu): { title, sub, rows, stage(), preview }; stage() renders the stage, { head, note (an element), cols: [{ head, cls, rows }],
       foot (HTML or element) } or an element; preview is the HTML of the inset under the menu (the map and the match settings);
     submenu (the panel): { head, rows, grid }; grid: the rows are thumbnails in a grid (the maps).
   A row:
     { k: 'seg', key, label, items: [[value, label]], get(), set(v), full, wide }   choice: ◂ value ▸, or all choices visible (full)
     { k: 'check', key, label, get(), set(bool) }                                  Off / On
     { k: 'range', key, label, min, max, step, fmt(v), get(), set(v) }             slider
     { k: 'link', key, label, value, page, params | open() }                       opens a submenu (or another screen)
     { k: 'pick', key, label, value, art, on, pick() }                             a choice in a list (a public match...)
     { k: 'card', key, label, tag, art, badge, lock, on, pick() }                  illustrated thumbnail (a map)
     { k: 'player', key, label, lv, tags, me, bot, page, params }                  a player (without page: a simple line)
     { k: 'btn', key, label, run(), danger, primary }                              action (primary: yellow button, the page's action)
     { k: 'text', key, label, input, bare }                                        input field (the existing element is reused; bare: without label)
     { k: 'sep', label } { k: 'note', text } { k: 'info', label, value } { k: 'node', node }   title, remark, value, free content
   Common: disabled, hidden, sub (second line under the label). An adjustable row carries _adj(d) (left, right): the navigation of
   09qc-gamepad.js (padNav) uses it, the keyboard too; A and Enter make a click.
   ========================================================================== */
const LM = { all: [], scr: {} }; // scr: each screen's list (uiBack closes its submenu first)
const LM_ITEM = '.lrow, .lcard'; // what takes focus in a list
const lmWantFocus = () => !(TOUCH.on && !PAD.drive); // on touch, nothing is highlighted on arrival
/* root: the screen; o = { pages, home, col (the menu), stage (the stage), panel (the submenu), preview (the inset under the menu), preview2 (the same,
   at the top of the stage: on phone), title and sub (the screen's title and subtitle), screen (name of the screen), bin (where to put the elements the
   rows reuse, data-keep) } */
function lmMount(root, o) {
  const L = { root, col: o.col, stage: o.stage || null, panel: o.panel || null, prev: o.preview || null, prev2: o.preview2 || null, pages: o.pages, home: o.home, bin: o.bin || null,
    h2: o.title || null, sub: o.sub || null, stack: [], def: null, def0: null, dirty: false, closeT: 0, pbody: null, phead: null };
  L.col.dataset.lm = LM_ITEM; L.col.setAttribute('role', 'group');
  if (L.panel) {
    L.panel.innerHTML = '<div class="lp-head"><h3 class="lbl"></h3></div><div class="lp-body"></div>';
    L.phead = L.panel.querySelector('.lp-head h3'); L.pbody = L.panel.querySelector('.lp-body'); L.pbody.dataset.lm = LM_ITEM;
  }
  // submenu open: a click outside it (darkened menu, background, inset, footer, Back) closes it, and nothing else (before any other listener)
  root.addEventListener('click', (e) => { if (L.stack.length > 1 && L.panel && !L.panel.contains(e.target)) { e.preventDefault(); e.stopPropagation(); lmClose(L); sfxUi('back'); } }, true);
  root.addEventListener('click', (e) => lmClick(L, e));
  root.addEventListener('keydown', (e) => {
    const it = e.target.closest && e.target.closest(LM_ITEM);
    if (it && e.target === it && lmOwns(L, it) && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); it.click(); }
  });
  // a single highlight: the mouse sets focus on the hovered row (not during gamepad or keyboard navigation, where hover is turned off)
  root.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse' || document.body.classList.contains('padnav') || document.body.classList.contains('kbnav')) return;
    const it = e.target.closest && e.target.closest(LM_ITEM), a = document.activeElement;
    if (!it || it === a || it.tabIndex < 0 || !lmOwns(L, it) || (a && a.tagName === 'INPUT' && a.type !== 'range' && a.type !== 'checkbox')) return;
    it.focus({ preventScroll: true });
  });
  root.addEventListener('focusout', () => { if (L.dirty) setTimeout(() => { const a = document.activeElement; if (L.dirty && !(a && lmOwns(L, a) && a.tagName === 'INPUT')) lmRender(L); }, 0); }); // a display deferred during typing
  root.addEventListener('focusin', (e) => { // the row we're on, per level: found again on return from a submenu or another screen
    const it = e.target.closest && e.target.closest(LM_ITEM); if (!it || !lmOwns(L, it)) return;
    const box = lmBox(L, it), top = L.stack[L.stack.length - 1];
    if (top && (box === 'panel') === (L.stack.length > 1)) { top.key = it.dataset.key; top.box = box; }
  });
  if (o.screen) LM.scr[o.screen] = L;
  LM.all.push(L);
  return L;
}
const lmOwns = (L, el) => !!el && (L.col.contains(el) || (!!L.stage && L.stage.contains(el)) || (!!L.pbody && L.pbody.contains(el)));
const lmBox = (L, el) => (L.pbody && L.pbody.contains(el) ? 'panel' : L.stage && L.stage.contains(el) ? 'stage' : 'col');
const lmItems = (box) => (box ? [...box.querySelectorAll(LM_ITEM)].filter((e) => e.tabIndex >= 0) : []);
const lmItemByKey = (box, key) => (box ? [...box.querySelectorAll(LM_ITEM)].find((e) => e.dataset.key === String(key)) : null);
const lmDepth = (L) => L.stack.length - 1;
/* Opens the screen at the menu (home page, or page id) */
function lmReset(L, id = L.home, params) {
  L.stack = [{ id, params, key: null, box: 'col' }];
  lmRender(L, { focus: true, anim: false });
}
/* Opens a submenu over the displayed level */
function lmPush(L, id, params) {
  L.stack.push({ id, params, key: null, box: 'panel' });
  lmRender(L, { focus: true, scroll0: true });
}
/* Opens a submenu in place of the one that's open (shortcut: the chat) */
function lmOpen(L, id, params) { L.stack.length = Math.min(L.stack.length, 1); lmPush(L, id, params); }
/* Goes up one level; false at the menu (it's then up to the screen to go back) */
function lmPop(L) {
  if (L.stack.length < 2) return false;
  L.stack.pop(); lmRender(L, { focus: true, restore: true });
  return true;
}
/* Closes all submenus */
function lmClose(L) {
  if (L.stack.length < 2) return false;
  L.stack.length = 1; lmRender(L, { focus: true, restore: true });
  return true;
}
/* Rebuilds the screen: the menu and the stage (level 0), the submenu if open; values re-read, the highlighted row
   found again by its key. o = { focus (give focus), restore (to the level's remembered row), scroll0 (submenu at top), anim } */
function lmRender(L, o = {}) {
  const f0 = L.stack[0]; if (!f0) return;
  const a = document.activeElement, had = !!(a && a !== document.body && lmOwns(L, a));
  if (had && a.tagName === 'INPUT' && a.type !== 'range' && !o.focus) { L.dirty = true; return; } // no rebuild during typing (the field would lose focus)
  L.dirty = false;
  const open = L.stack.length > 1, top = L.stack[L.stack.length - 1], ai = had ? a.closest(LM_ITEM) : null, was = ai ? { box: lmBox(L, ai), key: ai.dataset.key } : null;
  if (L.bin) for (const n of L.root.querySelectorAll('[data-keep], input.li')) if (lmOwns(L, n)) L.bin.appendChild(n); // elements reused by a row go back to shelter before the rebuild
  const dt = open ? L.pages[top.id](top.params) || { rows: [] } : null, d0 = L.pages[f0.id](f0.params); if (!d0) return; // the submenu first (an open chat resets the unread messages the menu displays)
  L.def0 = d0;
  lmFill(L, L.col, d0.rows, open);
  if (open) { const op = lmItemByKey(L.col, f0.key); if (op && op._r && op._r.page === L.stack[1].id) op.classList.add('cur'); } // the menu row whose submenu is open (none when it comes from elsewhere: Back in a lobby, T for the chat)
  if (L.stage) lmStage(L, d0.stage ? d0.stage() : null, open);
  const ph = d0.preview || ''; // the map inset: under the menu, and on phone at the top of the stage (the menu lacks height there)
  for (const e of [L.prev, L.prev2]) if (e) { if (ph !== e._html) { e._html = ph; e.innerHTML = ph; } e.hidden = !ph; }
  if (open) lmPanel(L, dt, o); else lmPanelHide(L, o);
  L.def = dt || d0;
  L.root.classList.toggle('lm-open', open);
  for (const x of L.root.querySelectorAll('[data-lm-extra]')) x.tabIndex = open ? -1 : 0; // the footer (launch, leave) waits for the submenu to close
  if (L.h2) L.h2.textContent = d0.title || '';
  if (L.sub) L.sub.textContent = d0.sub || '';
  if (!(had || o.focus) || !lmWantFocus()) return;
  const pool = open ? lmItems(L.pbody) : lmItems(L.col).concat(lmItems(L.stage));
  let t = null;
  if (was) t = pool.find((e) => e.dataset.key === was.key && lmBox(L, e) === was.box);
  if (!t && o.restore) { const f = open ? top : f0; t = pool.find((e) => e.dataset.key === f.key && lmBox(L, e) === (f.box || (open ? 'panel' : 'col'))); }
  if (!t && open) t = pool.find((e) => e.matches('.on, [aria-checked="true"]')) || pool[0];
  if (!t) t = lmItems(L.col).find((e) => e.classList.contains('on')) || lmItems(L.col)[0];
  if (t) { t.focus({ preventScroll: true }); lmScrollTo(t); }
}
function lmFill(L, box, rows, dim) {
  const st = box.scrollTop, nodes = [];
  for (const r of rows || []) {
    if (!r || r.hidden) continue;
    const n = lmRowEl(L, r); if (!n) continue;
    if (dim && n.tabIndex >= 0) n.tabIndex = -1; // darkened menu: only the submenu can be navigated (a click closes it)
    nodes.push(n);
  }
  box.replaceChildren(...nodes); box.scrollTop = st;
}
/* The stage: a title, columns of rows (the teams), a footer line; or an element supplied as is */
function lmStage(L, s, dim) {
  const S = L.stage, keep = [...S.querySelectorAll('.lb-list')].map((e) => e.scrollTop);
  if (!s) { S.replaceChildren(); return; }
  if (s.nodeType) { if (S.firstChild !== s || S.childNodes.length > 1) S.replaceChildren(s); return; }
  const out = [];
  if (s.head) { const h = document.createElement('div'); h.className = 'lb-head'; h.innerHTML = s.head; out.push(h); }
  if (s.note) out.push(s.note); // a reused element (the lobby state)
  const wrap = document.createElement('div'); wrap.className = 'lb-cols' + (s.cls ? ' ' + s.cls : '');
  (s.cols || []).forEach((c, i) => {
    const box = document.createElement('div'); box.className = 'lb-col' + (c.cls ? ' ' + c.cls : '');
    if (c.head) { const h = document.createElement('h3'); h.className = 'lb-h'; h.innerHTML = c.head; box.appendChild(h); }
    const list = document.createElement('div'); list.className = 'lb-list'; list.dataset.lm = LM_ITEM;
    lmFill(L, list, c.rows, dim); box.appendChild(list); wrap.appendChild(box);
  });
  out.push(wrap);
  if (s.foot) { const f = document.createElement(s.foot.nodeType ? 'div' : 'p'); f.className = 'lb-foot'; if (s.foot.nodeType) f.appendChild(s.foot); else f.innerHTML = s.foot; out.push(f); }
  S.replaceChildren(...out);
  const lists = S.querySelectorAll('.lb-list'); lists.forEach((e, i) => { e.scrollTop = keep[i] || 0; });
}
/* The submenu: slides in from the menu when it opens (and on each new page), slides out when withdrawn */
function lmPanel(L, d, o) {
  const P = L.panel, B = L.pbody;
  L.phead.textContent = d.head || d.title || '';
  B.className = 'lp-body' + (d.grid ? ' maps' : '') + (d.cls ? ' ' + d.cls : '');
  if (d.grid) B.dataset.lmGrid = ''; else delete B.dataset.lmGrid;
  lmFill(L, B, d.rows, false);
  if (o.scroll0) B.scrollTop = 0;
  const fresh = P.hidden || P.classList.contains('out');
  clearTimeout(L.closeT); P.hidden = false; P.classList.remove('out');
  if ((fresh || o.scroll0) && o.anim !== false) { P.classList.remove('in'); void P.offsetWidth; P.classList.add('in'); }
}
function lmPanelHide(L, o) {
  const P = L.panel; if (!P || P.hidden) return;
  clearTimeout(L.closeT); P.classList.remove('in');
  for (const e of lmItems(L.pbody)) e.tabIndex = -1; // while it withdraws, nothing gets focus in it anymore
  if (o.anim === false) { P.hidden = true; P.classList.remove('out'); return; }
  P.classList.add('out'); L.closeT = setTimeout(() => { P.hidden = true; P.classList.remove('out'); }, 170);
}
/* Scrolls the row's frame just enough to show it (without touching the screen) */
function lmScrollTo(el) {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if (oy !== 'auto' && oy !== 'scroll') continue;
    const r = el.getBoundingClientRect(), c = p.getBoundingClientRect();
    if (r.top < c.top + 4) p.scrollTop -= c.top + 8 - r.top; else if (r.bottom > c.bottom - 4) p.scrollTop += r.bottom - c.bottom + 8;
    return;
  }
}
/* Refreshes the values without touching focus (a setting changes elsewhere) */
function lmRefresh(L) { if (L.stack.length) lmRender(L); }

function lmRowEl(L, r) {
  if (r.k === 'sep') { const h = document.createElement('h4'); h.className = 'lsep'; h.textContent = r.label || ''; return h; }
  if (r.k === 'note') { const p = document.createElement('p'); p.className = 'lnote' + (r.cls ? ' ' + r.cls : ''); if (r.html) p.innerHTML = r.text; else p.textContent = r.text; return p; }
  if (r.k === 'info') {
    const p = document.createElement('div'); p.className = 'linfo';
    p.append(Object.assign(document.createElement('span'), { textContent: r.label }), Object.assign(document.createElement('b'), { textContent: r.value }));
    return p;
  }
  if (r.k === 'node') return r.node;
  if (r.k === 'check') { const g = r.get, s = r.set; r = Object.assign({}, r, { k: 'seg', items: [[0, _t('Off')], [1, _t('On')]], get: () => (g() ? 1 : 0), set: (v) => s(!!+v) }); }
  if (r.k === 'card') return lmCard(L, r);
  const el = document.createElement('div'), inert = r.k === 'player' && !r.page;
  el.className = 'lrow k-' + r.k + (r.full ? ' k-full' : '') + (r.wide ? ' wide' : '') + (r.danger ? ' danger' : '') + (r.primary ? ' primary' : '') + (r.bare ? ' bare' : '') + (r.on ? ' on' : '') + (r.me ? ' me' : '') + (r.bot ? ' bot' : '') + (r.art !== undefined ? ' k-art' : '');
  el.dataset.key = r.key == null ? '' : String(r.key); el._r = r;
  if (!inert) el.setAttribute('role', 'button');
  if (r.disabled || inert) { el.tabIndex = -1; if (r.disabled) el.setAttribute('aria-disabled', 'true'); } else el.tabIndex = 0;
  el._adj = (d) => lmStep(L, el, d, false);
  if (r.k === 'player') { // a player: level (or "Bot"), name, tags (you, host, map ready...)
    const lv = document.createElement('b'); lv.className = 'plv'; lv.textContent = r.bot ? _t('Bot') : r.lv ? String(r.lv) : '';
    const n = document.createElement('span'); n.className = 'll'; n.textContent = r.label;
    const tg = document.createElement('div'); tg.className = 'lv';
    for (const t of r.tags || []) tg.appendChild(Object.assign(document.createElement('i'), { className: 'ptag', textContent: t }));
    el.append(lv, n, tg);
    return el;
  }
  if (r.art !== undefined) { // map thumbnail (public match)
    const im = document.createElement(r.art ? 'img' : 'span'); im.className = 'lart' + (r.art ? '' : ' none'); if (r.art) { im.alt = ''; im.decoding = 'async'; im.src = r.art; }
    el.appendChild(im);
  }
  const lab = document.createElement('span'); lab.className = 'll'; lab.textContent = r.label;
  if (r.sub) { const s = document.createElement('small'); s.className = 'ls'; s.textContent = r.sub; lab.appendChild(s); }
  if (!r.bare) el.appendChild(lab); // bare: the field alone, across the full width (its label goes into aria-label)
  const v = document.createElement('div'); v.className = 'lv'; el.appendChild(v);
  const arrow = (d) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'la'; b.dataset.d = String(d); b.tabIndex = -1; b.setAttribute('aria-hidden', 'true'); return b; };
  if (r.k === 'seg' && r.full) { // all choices visible (match settings): a click chooses, left and right move to the neighbor
    const box = document.createElement('div'), cur = String(r.get()); box.className = 'seg'; box.setAttribute('role', 'radiogroup'); box.setAttribute('aria-label', r.label);
    for (const [x, t] of r.items) {
      const b = document.createElement('button'); b.type = 'button'; b.tabIndex = -1; b.textContent = t; b.dataset.v = String(x); b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(String(x) === cur)); if (r.disabled) b.disabled = true; box.appendChild(b);
    }
    v.appendChild(box);
  } else if (r.k === 'seg') {
    const i = Math.max(0, r.items.findIndex(([x]) => String(x) === String(r.get())));
    const l = arrow(-1), n = arrow(1), t = document.createElement('span'); t.className = 'lt'; t.textContent = r.items[i] ? r.items[i][1] : '';
    l.classList.toggle('off', i <= 0); n.classList.toggle('off', i >= r.items.length - 1);
    v.append(l, t, n); el.setAttribute('aria-label', r.label + ' : ' + t.textContent);
  } else if (r.k === 'range') {
    const inp = document.createElement('input'); inp.type = 'range'; inp.min = r.min; inp.max = r.max; inp.step = r.step; inp.tabIndex = -1; inp.setAttribute('aria-label', r.label);
    const out = document.createElement('output'), fill = () => inp.style.setProperty('--p', ((parseFloat(inp.value) - r.min) / (r.max - r.min)) * 100 + '%');
    inp.value = r.get(); out.textContent = r.fmt(r.get()); fill();
    inp.addEventListener('input', () => { const x = parseFloat(inp.value); r.set(x); out.textContent = r.fmt(x); fill(); sfxUi('tick'); });
    el._rg = { inp, out, fill }; v.append(inp, out);
  } else if (r.k === 'link') {
    const t = document.createElement('span'); t.className = 'lt'; t.textContent = r.value == null ? '' : r.value; v.append(t, Object.assign(arrow(1), { className: 'la go' }));
  } else if (r.k === 'pick') {
    v.append(Object.assign(document.createElement('span'), { className: 'lt', textContent: r.value || '' })); if (r.on) { const d = document.createElement('i'); d.className = 'dot'; v.appendChild(d); }
  } else if (r.k === 'text') {
    r.input.classList.add('li'); if (r.bare) r.input.setAttribute('aria-label', r.label); v.appendChild(r.input);
  }
  return el;
}
/* Illustrated thumbnail (a map): the image, the name, the caption; a tag (selected, soon) */
function lmCard(L, r) {
  const b = document.createElement('div');
  b.className = 'lcard mapcard' + (r.on ? ' on' : '') + (r.lock ? ' lock' : '');
  b.dataset.key = String(r.key); b._r = r; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(!!r.on));
  if (r.disabled) { b.tabIndex = -1; b.setAttribute('aria-disabled', 'true'); } else b.tabIndex = 0;
  const c = document.createElement(r.art ? 'img' : 'span'); c.className = 'mapart' + (r.art ? '' : ' none'); if (r.art) { c.alt = ''; c.decoding = 'async'; c.src = r.art; }
  const t = document.createElement('span'); t.className = 'mt'; t.textContent = r.label;
  const g = document.createElement('span'); g.className = 'mg'; g.textContent = r.tag || '';
  const tx = document.createElement('span'); tx.className = 'mtx'; tx.append(t, g);
  b.append(c, tx);
  if (r.badge) b.appendChild(Object.assign(document.createElement('i'), { className: 'mb', textContent: r.badge }));
  b._adj = () => false;
  return b;
}
/* A click (mouse, touch, A, Enter) on a row */
function lmClick(L, e) {
  const it = e.target.closest && e.target.closest(LM_ITEM); if (!it || !lmOwns(L, it)) return;
  if (it.getAttribute('aria-disabled') === 'true') return;
  const r = it._r; if (!r) return;
  if (r.k === 'seg') { const sb = e.target.closest('.seg button'), ar = e.target.closest('.la[data-d]'); if (sb && it.contains(sb)) lmSet(L, it, sb.dataset.v); else lmStep(L, it, ar ? +ar.dataset.d : 1, true); return; }
  if (r.k === 'text') { if (e.target !== r.input) r.input.focus(); return; }
  if (r.k === 'range') return;
  lmAct(L, it);
}
/* Adjusts a row's value by one step (d = ±1): true if the row takes the direction (even at the end of its range) */
function lmStep(L, row, d, wrap) {
  const r = row._r; if (!r || row.getAttribute('aria-disabled') === 'true') return false;
  if (r.k === 'seg') {
    const n = r.items.length, i = Math.max(0, r.items.findIndex(([x]) => String(x) === String(r.get())));
    let j = i + d; if (wrap) j = (j + n) % n; else j = clamp(j, 0, n - 1);
    if (j !== i) { sfxUi('tab'); r.set(r.items[j][0]); lmRender(L); }
    return true;
  }
  if (r.k === 'range') {
    const g = row._rg, p = Math.max(0, (String(r.step).split('.')[1] || '').length), mult = lmStep.fast ? 4 : 1;
    const v = clamp(parseFloat((parseFloat(g.inp.value) + d * r.step * mult).toFixed(p)), r.min, r.max);
    if (v !== parseFloat(g.inp.value)) { g.inp.value = String(v); g.inp.dispatchEvent(new Event('input', { bubbles: true })); }
    return true;
  }
  return false;
}
lmStep.fast = false;
/* Chooses a value of a segmented choice (click on one of the choices) */
function lmSet(L, row, v) {
  const r = row._r, it = r.items.find(([x]) => String(x) === String(v));
  if (!it || String(r.get()) === String(v)) return;
  sfxUi('tab'); r.set(it[0]); lmRender(L);
}
/* A, Enter or a click: opens the submenu, chooses, launches */
function lmAct(L, el) {
  const r = el._r; if (!r) return;
  if ((r.k === 'link' || r.k === 'player') && r.page) { const f = L.stack[L.stack.length - 1]; f.key = el.dataset.key; f.box = lmBox(L, el); lmPush(L, r.page, r.params); }
  else if (r.k === 'link') { if (r.open) r.open(); }
  else if (r.k === 'pick' || r.k === 'card') { if (r.pick) r.pick(); }
  else if (r.k === 'btn') { if (r.run) r.run(); }
}
