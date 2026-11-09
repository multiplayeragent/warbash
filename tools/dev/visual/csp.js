/* Content security policy (CSP, set by build.py in the page): the game opened with it (the other tools lift it), menus,
   map loading and a few seconds of match, then the list of what it blocked (securitypolicyviolation event): nothing
   should be blocked. Also checks that it bites: an onerror attribute slipped into the page does not run.
   node tools/dev/visual/csp.js ; MAPS=chergui,portmael,saintgivre (default) ; PAGE=other/version.html */
const { openGame } = require('./common');
const MAPS = (process.env.MAPS || 'chergui,portmael,saintgivre').split(',');
(async () => {
  const init = `window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.effectiveDirective + ' ' + (e.blockedURI || '(inline)') + ' ' + (e.sourceFile || '').split('/').pop() + ':' + e.lineNumber));`;
  const { browser, page, logs } = await openGame({ page: process.env.PAGE, w: 640, h: 360, csp: true, init, noMap: true, settings: { quality: 'medium', map: MAPS[0] } });
  let bad = 0;
  const report = async (what) => {
    const v = await page.evaluate(() => window.__csp.splice(0));
    const real = v.filter((x) => !/_vercel\/insights/.test(x)); // outside Vercel, the Analytics script does not exist (file://)
    console.log((real.length ? 'BLOCKED ' : 'ok     ') + ': ' + what + (real.length ? ': ' + real.slice(0, 6).join(' | ') : ''));
    bad += real.length;
  };
  await report('startup and menus');
  // the CSP bites: a script slipped into the page through a hole does not run
  const xss = await page.evaluate(async () => { document.body.insertAdjacentHTML('beforeend', '<img id="cspX" src="data:," onerror="window.__xss=1">'); await new Promise((r) => setTimeout(r, 300)); document.getElementById('cspX').remove(); const v = window.__csp.splice(0); return { ran: !!window.__xss, blocked: v.length }; });
  console.log((xss.ran || !xss.blocked ? 'FAIL   ' : 'ok     ') + ': injected onerror attribute ' + (xss.ran ? 'ran' : 'blocked'));
  if (xss.ran || !xss.blocked) bad++;
  for (const m of MAPS) {
    await page.evaluate(async (m) => { Settings.map = m; await mapEnsure(m); if (CURMAP.def.atmo.hdri) await hdriFetch(CURMAP.def.atmo.hdri).ready; }, m);
    await page.evaluate(() => { LOCK.fallback = true; startMatch({}); PL.ent.protT = 1e9; });
    await page.waitForTimeout(3000);
    await page.evaluate(() => { if (typeof endMatch === 'function' && MATCH.state === 'playing') endMatch(); });
    await report('map ' + m + ' (loading, HDRI, a few seconds of match)');
  }
  const errs = logs.filter((l) => /Content Security Policy|Refused to/i.test(l) && !/_vercel/.test(l));
  if (errs.length) { console.log('log:', errs.slice(0, 5)); bad += errs.length; }
  console.log(bad ? `\n${bad} block(s): the build.py CSP gets in the game's way` : '\nthe CSP blocks nothing from the game');
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
