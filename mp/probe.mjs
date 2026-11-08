// Protocol check for the room relay (mp/room-relay.js), without the game: a host and two guests in one room.
//   node mp/probe.mjs            (needs network; reads the key from mp.config.local.js)
// Loads the browser SDK into Node (global WebSocket, Node 22+).
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const CDN = 'https://cdn.multiplayeragent.com/sdk/mp.global.js';
const key = (readFileSync(new URL('../mp.config.local.js', import.meta.url), 'utf8').match(/'(pk_[A-Za-z0-9_]+)'/) || [])[1];
if (!key) { console.error('no key in mp.config.local.js'); process.exit(1); }
const mem = {};
globalThis.window = globalThis;
globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
vm.runInThisContext(await (await fetch(CDN)).text());
const opts = { key, endpoint: 'wss://live.multiplayeragent.com', apiUrl: 'https://api.multiplayeragent.com', analytics: false };
const room = process.env.ROOM || 'wb-A', code = room.slice(3) + 'TST9';
const log = [], wait = (ms) => new Promise((r) => setTimeout(r, ms));
const T0 = Date.now(), say = (who, ...a) => log.push(`${String(Date.now() - T0).padStart(5)} ${who}: ${a.map((x) => JSON.stringify(x)).join(' ')}`);

async function client(name, hello) {
  const mp = await MP.join({ ...opts, room });
  for (const ev of ['sync', 'join', 'leave', 'host', 'refuse', 'm']) mp.on(ev, (d, from) => { if (!(d && d.d && d.d.t === 'ping')) say(name, ev, d, from); });
  mp.send('hello', hello);
  return mp;
}
const host = await client('host', { r: 'host', id: 'hTEST', k: 'hostkey', v: 10, c: code });
await wait(800);
const g1 = await client('g1', { r: 'guest', id: 'g1', k: 'k1', v: 10, c: code });
await wait(800);
g1.send('m', { d: { t: 'hi', n: 'one' } });
host.send('m', { d: { t: 'lobby', players: 2 } });
await wait(800);
const g2 = await client('g2', { r: 'guest', id: 'g2', k: 'k2', v: 10, c: code });
await wait(800);
g2.send('m', { p: 1, d: { t: 'p', p: { x: 1 } } });
host.send('m', { to: ['g1'], d: { t: 'start' } });
const big = 'x'.repeat(1900);
host.send('m', { d: { t: 'big', s: big } });
await wait(800);
const wrong = await client('wrong', { r: 'guest', id: 'g3', k: 'k3', v: 10, c: 'XXXXX' });
await wait(500);
const bad = await client('bad', { r: 'host', id: 'hX', k: 'other', v: 10, c: code });
await wait(800);
host.send('kick', { id: 'g2' });
await wait(800);
let lat=[]; g1.on('m',(d)=>{ if(d&&d.d&&d.d.t==='ping') lat.push(Date.now()-d.d.at); });
for(let i=0;i<20;i++){ host.send('m',{to:['g1'],d:{t:'ping',at:Date.now()}}); await wait(70); }
await wait(500); lat.sort((a,b)=>a-b); console.log('host->server->g1 latency ms p50/p90/max', lat[10], lat[18], lat[lat.length-1], 'n', lat.length);
await g1.leave();
await wait(1500);
for (const c of [host, g2, bad, wrong]) await c.leave().catch(() => {});
console.log(log.map((l) => l.replace(big, '<1900 x>')).join('\n'));
process.exit(0);
