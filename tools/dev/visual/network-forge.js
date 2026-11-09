/* Forged remote player states (modified client): the game receives them without freezing. A whole lobby hung on a single message: a weapon
   "constructor" (key inherited from every object), an infinite position ("1e999" in JSON) or hundreds of grenades in a single state
   made the host throw an error every frame (netUpdate, before rendering). For each case: the state applied (netApply), then
   120 game steps; no error and no scene growth.
   node tools/dev/visual/network-forge.js ; PAGE=other/version.html */
const { openGame } = require('./common');
const P0 = { n: 'Forge', t: 1, w: 'm4', g: 'm4', s: [3, 0.2, 3, 0, 0, 0, 0, 0, 0, 1, 0, 100], f: 0, k: 0, d: 0, a: 0, sc: 0, sk: 'assault', ev: [] };
const CASES = [
  ['outfit "constructor" at creation', (P) => netApply('gA', { ...P, sk: 'constructor' })],
  ['valid outfit then "__proto__"', (P) => { netApply('gB', P); netApply('gB', { ...P, sk: '__proto__' }); }],
  ['weapon w "constructor" without key, at creation', (P) => netApply('gC', { ...P, w: 'constructor', g: '' })],
  ['valid weapon then w "toString"', (P) => { netApply('gD', P); netApply('gD', { ...P, w: 'toString', g: '' }); }],
  ['weapon key "__proto__" and camo "constructor"', (P) => { netApply('gE', { ...P, g: '__proto__' }); netApply('gE', { ...P, g: 'm4~~constructor' }); }],
  ['infinite position and speed (1e999)', (P) => netApply('gF', JSON.parse(JSON.stringify(P).replace('"s":[3,0.2,3,0,0,0,0', '"s":[1e999,-1e999,1e999,1e999,0,1e999,-1e999')))],
  ['800 grenades in a single state', (P) => { const p = PL.ent.pos, ev = []; for (let i = 1; i <= 800; i++) ev.push({ k: 'nade', i, px: p.x, py: p.y + 0.3, pz: p.z, vx: 0, vy: 0, vz: 0, fu: 0.1 }); netApply('gG', { ...P, ev }); }],
  ['malformed events (null, numbers, text)', (P) => netApply('gH', { ...P, ev: [null, 3, 'x', { k: 'hit', i: 1, to: 'nobody', d: 'abc' }, { k: 'air', i: 2, x: 1e999, z: 'z', y: {} }] })],
];
(async () => {
  const { browser, page, logs } = await openGame({ page: process.env.PAGE, w: 640, h: 360, noHdri: true, settings: { quality: 'low', map: 'chergui' } });
  await page.evaluate(() => { LOCK.fallback = true; startMatch({}); NET.on = true; NET.role = 'client'; NET.me = 'myId'; NET.joined = true; NET.t0 = performance.now(); NET.hostConn = { open: true, send() {} }; PL.ent.protT = 1e9; });
  let bad = 0;
  for (const [name, fn] of CASES) {
    const r = await page.evaluate(([src, P]) => {
      const before = scene.children.length, errs = new Map();
      const step = (n, f) => { try { f(); } catch (e) { const k = n + ': ' + String(e.message).slice(0, 80); errs.set(k, (errs.get(k) || 0) + 1); } };
      step('netApply', () => (0, eval)('(' + src + ')')(P)); // (evaluation: the tool lifts the page CSP, see common.js)
      const t0 = performance.now();
      for (let i = 0; i < 120; i++) {
        MATCH.time += 1 / 60; NET.hostSeen = performance.now() + 1e9; PL.ent.protT = 1e9; PL.ent.health = 100;
        step('updateNades', () => updateNades(1 / 60)); step('netUpdate', () => netUpdate(1 / 60));
      }
      step('render', () => renderer.render(scene, camera));
      return { errs: [...errs.entries()], grew: scene.children.length - before, nades: NADES.length, ms: Math.round(performance.now() - t0) };
    }, [fn.toString(), P0]);
    const ok = !r.errs.length && r.grew < 40 && r.nades <= 8;
    if (!ok) bad++;
    console.log((ok ? 'ok     : ' : 'FAIL   : ') + name + (ok ? '' : ' ' + JSON.stringify(r)));
    await page.evaluate(() => { for (const n of [...NADES]) n.fuse = 0; for (let i = 0; i < 10; i++) updateNades(1 / 30); }); // the case's grenades burst before the next one
  }
  const pe = logs.filter((l) => l.startsWith('[pageerror]'));
  if (pe.length) { bad++; console.log('FAIL   : page errors: ' + pe.slice(0, 3).join(' | ')); }
  console.log(bad ? `\n${bad} failure(s)` : '\nall good');
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
