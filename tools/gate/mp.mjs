// Online play with real game clients: one host and N guests (default 2) in a private room, then quick play.
//   node tools/gate/mp.mjs [guests=2]        needs the built dist/ with a real key (mp.config.local.js) and network access
// Checks: room created, guests join and appear in the lobby, match launched and loaded by everyone, each client sees the others,
// a guest's movement reaches the host and the other guest, a guest's hit kills the host and the kill is counted on both sides,
// a guest leaves and the host sees it, quick play puts two players in the same public room.
import { chromium } from 'playwright-core';
import { CHROME, serve } from './lib.mjs';

const GUESTS = Math.max(1, Math.min(3, +(process.argv[2] || 2)));
const results = [];
const ok = (cond, what, info = '') => { results.push({ ok: !!cond, what, info }); console.log(`${cond ? 'PASS' : 'FAIL'} ${what}${info ? ' (' + info + ')' : ''}`); return !!cond; };
const until = (page, fn, arg, ms = 30000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 200 }).then(() => true, () => false);

const s = await serve();
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'];
const browsers = [];
// one browser process per player, like separate machines (one shared GPU process slowed the late joiner's map build to a crawl)
async function client(name) {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ARGS }); browsers.push(browser);
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const page = await ctx.newPage();
  await page.addInitScript(`try{localStorage.setItem('dc_settings', JSON.stringify({sv:8,lang:'en',quality:'low',dynres:false}));localStorage.setItem('cod_seen_version','99');localStorage.setItem('cod_nick', ${JSON.stringify(name)})}catch(e){};window.MATCH_COUNTDOWN=0;`);
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.route('**/*', (r) => (/fonts\.g/.test(r.request().url()) ? r.abort() : r.continue()));
  await page.goto(s.url, { timeout: 120000 }); // a fourth software-rendered client on a busy machine can take more than 30 s
  await page.waitForFunction(() => typeof MATCH !== 'undefined' && MATCH.state === 'menu', null, { timeout: 120000, polling: 250 });
  return { name, page, ctx, errs };
}
const t0 = Date.now(), secs = () => ((Date.now() - t0) / 1000).toFixed(0) + 's';
let failed = false;
try {
  const host = await client('Host');
  const guests = []; for (let i = 0; i < GUESTS; i++) guests.push(await client('Guest' + (i + 1)));
  const all = [host, ...guests];
  ok(await host.page.evaluate(() => netCan()), 'online mode available (key and game server module loaded)');

  // private room
  await host.page.evaluate(() => { Settings.map = 'chergui'; Settings.mode = 'tdm'; netHost({}); });
  ok(await until(host.page, () => NET.joined && NET.role === 'host'), 'host opens a private room', secs());
  const code = await host.page.evaluate(() => NET.code);
  for (const g of guests) await g.page.evaluate((c) => netJoinLobby(c), code);
  for (const g of guests) ok(await until(g.page, () => NET.joined && NET.role === 'client' && NET.players.size >= 2), `${g.name} joins room ${code}`, secs());
  ok(await until(host.page, (n) => NET.players.size === n, all.length), `host lobby shows ${all.length} players`);
  const wrong = await client('Intruder');
  await wrong.page.evaluate((c) => netJoinLobby(c.slice(0, 1) + 'ZZZZ'), code);
  ok(await until(wrong.page, () => NET.role === 'off' && /not found/i.test(NET.status), null, 20000), 'a wrong code in the same room slot is refused', await wrong.page.evaluate(() => NET.status));
  await wrong.ctx.close();

  // match
  await host.page.evaluate(() => netLaunch());
  for (const c of all) ok(await until(c.page, () => NET.on && MATCH.state === 'playing', null, 240000), `${c.name} loads the map and plays`, secs());
  for (const c of all) await c.page.evaluate(() => { LOCK.fallback = true; PL.ent.protT = 1e9; });
  ok(await until(host.page, (n) => [...NET.remotes.values()].filter((e) => !e.remoteBot).length === n, GUESTS, 20000), 'host sees every guest');
  for (const g of guests) ok(await until(g.page, (n) => [...NET.remotes.values()].filter((e) => !e.remoteBot).length === n, GUESTS, 20000), `${g.name} sees the host and the other guests`, String(await g.page.evaluate(() => NET.remotes.size)) + ' remotes incl. bots');

  // movement: guest 1 walks to a spot; host and guest 2 see it there
  const g1 = guests[0], g1id = await g1.page.evaluate(() => NET.me);
  const at = await g1.page.evaluate(() => { const p = PL.ent.pos; p.x += 3; p.z += 2; return { x: p.x, z: p.z }; });
  const near = (id, a) => { const e = NET.remotes.get(id); return !!e && Math.hypot(e.pos.x - a.x, e.pos.z - a.z) < 1.5; };
  ok(await until(host.page, ([id, a]) => { const e = NET.remotes.get(id); return !!e && Math.hypot(e.pos.x - a.x, e.pos.z - a.z) < 1.5; }, [g1id, at], 20000), 'guest movement reaches the host');
  if (guests[1]) ok(await until(guests[1].page, ([id, a]) => { const e = NET.remotes.get(id); return !!e && Math.hypot(e.pos.x - a.x, e.pos.z - a.z) < 1.5; }, [g1id, at], 20000), 'guest movement reaches the other guest (fan-out by the server)');

  // a hit from guest 1 kills the host
  await host.page.evaluate(() => { PL.ent.protT = 0; });
  const hostId = await host.page.evaluate(() => NET.me);
  const k0 = await g1.page.evaluate(() => PL.ent.kills);
  await g1.page.evaluate((id) => { const v = NET.remotes.get(id); for (let i = 0; i < 4; i++) netSendHit(v, 60, PL.ent.weapon ? PL.ent.weapon.name : 'ar', true, new THREE.Vector3(0, 0, 1), PL.ent); }, hostId);
  ok(await until(host.page, () => !PL.ent.alive || PL.ent.deaths > 0, null, 20000), 'guest hit kills the host');
  ok(await until(g1.page, (k) => PL.ent.kills > k, k0, 20000), 'the kill is counted for the guest');

  // a guest leaves
  const last = guests[guests.length - 1];
  await last.page.evaluate(() => netQuit());
  ok(await until(host.page, (n) => NET.players.size === n, all.length - 1, 15000), 'host sees a guest leave');
  for (const c of all) ok(!c.errs.length, `${c.name}: no page errors`, c.errs.slice(0, 2).join(' | '));
  for (const c of all) await c.ctx.close();

  // quick play: the first player opens a public room, the second joins it
  const q1 = await client('Quick1'), q2 = await client('Quick2');
  await q1.page.evaluate(() => netQuick());
  ok(await until(q1.page, () => NET.joined && NET.on, null, 240000), 'quick play: first player gets into a public match', await q1.page.evaluate(() => NET.role + ' ' + NET.code));
  const qcode = await q1.page.evaluate(() => NET.code);
  await q2.page.evaluate(() => netQuick());
  ok(await until(q2.page, (c) => NET.joined && NET.code === c, qcode, 60000), 'quick play: second player joins the same public room', await q2.page.evaluate(() => NET.role + ' ' + NET.code));
  ok(await until(q2.page, () => NET.on, null, 240000), 'quick play: second player is in the match');
  for (const c of [q1, q2]) await c.page.evaluate(() => netQuit());
  for (const c of [q1, q2]) await c.ctx.close();
} catch (e) { failed = true; console.log('ERROR', e.message); }
for (const b of browsers) await b.close().catch(() => {});
await s.close();
const bad = results.filter((r) => !r.ok).length;
console.log(`mp: ${results.length - bad}/${results.length} passed${failed ? ', aborted' : ''}`);
process.exit(bad || failed ? 1 : 0);
