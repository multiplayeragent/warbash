// Deploys the room relay (mp/room-relay.js) to every room of the pool, through the Multiplayer Agent MCP endpoint.
//   node mp/deploy.mjs                 all rooms
//   node mp/deploy.mjs --only wb-A     one room
//   node mp/deploy.mjs --logs wb-A     recent runtime errors of one room
// Needs the studio's secret key: MPA_SECRET_KEY in the environment, or the Authorization header of a local .mcp.json
// (gitignored). The game's publishable key comes from mp.config.local.js (or MPA_GAME_KEY).
// Room logic binds to exact room names (no wildcards), so the game uses a fixed pool: the first character of a room code
// names its room (src/09d-netrelay.js, netrRoom). Letters are private rooms, digits the public quick-play rooms.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SLOTS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // = NET_ABC in src/09c-net.js
const API = process.env.MPA_API_URL || 'https://api.multiplayeragent.com';

export function secretKey() {
  if (process.env.MPA_SECRET_KEY) return process.env.MPA_SECRET_KEY;
  const f = join(ROOT, '.mcp.json');
  if (!existsSync(f)) return '';
  const servers = JSON.parse(readFileSync(f, 'utf8')).mcpServers || {};
  for (const s of Object.values(servers)) { const a = s.headers && s.headers.Authorization; if (a && /^Bearer /.test(a)) return a.slice(7); }
  return '';
}
export function gameKey() {
  if (process.env.MPA_GAME_KEY) return process.env.MPA_GAME_KEY;
  const f = join(ROOT, 'mp.config.local.js');
  return existsSync(f) ? (readFileSync(f, 'utf8').match(/'(pk_[A-Za-z0-9_]+)'/) || [])[1] || '' : '';
}

export class Mcp {
  constructor(sk) { this.url = API.replace(/\/+$/, '') + '/mcp'; this.h = { authorization: 'Bearer ' + sk, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }; this.id = 0; this.sid = ''; }
  async rpc(method, params) {
    const r = await fetch(this.url, { method: 'POST', headers: this.sid ? { ...this.h, 'mcp-session-id': this.sid } : this.h, body: JSON.stringify({ jsonrpc: '2.0', id: ++this.id, method, params }) });
    const sid = r.headers.get('mcp-session-id'); if (sid) this.sid = sid;
    const text = await r.text();
    let j = null; try { j = JSON.parse(text); } catch { const d = text.split('\n').filter((l) => l.startsWith('data:')); try { j = JSON.parse(d[d.length - 1].slice(5)); } catch { /* not JSON */ } }
    if (!r.ok) throw new Error(`${method}: HTTP ${r.status}`);
    if (j && j.error) throw new Error(`${method}: ${j.error.message}`);
    return j && j.result;
  }
  async init() { await this.rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'war-bash-deploy', version: '1' } }); }
  async call(name, args) {
    const res = await this.rpc('tools/call', { name, arguments: args });
    const text = (res && res.content || []).map((c) => c.text || '').join('\n');
    if (res && res.isError) throw new Error(`${name}: ${text.slice(0, 300)}`);
    try { return JSON.parse(text); } catch { return text; }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const sk = secretKey(), pk = gameKey();
  if (!sk || !pk) { console.error('missing secret key (MPA_SECRET_KEY or .mcp.json) or game key (mp.config.local.js)'); process.exit(1); }
  const args = process.argv.slice(2), val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const mcp = new Mcp(sk); await mcp.init();
  if (val('--logs')) { console.log(JSON.stringify(await mcp.call('get_room_logs', { game: pk, roomName: val('--logs'), limit: 40 }), null, 1)); process.exit(0); }
  const code = readFileSync(join(ROOT, 'mp', 'room-relay.js'), 'utf8');
  const rooms = val('--only') ? [val('--only')] : [...SLOTS].map((c) => 'wb-' + c);
  const tick = +(val('--tick') || 30);
  console.log(`deploying room relay (${code.length} bytes, ${tick} Hz) to ${rooms.length} room(s) of game ${pk.slice(0, 14)}...`);
  for (const room of rooms) {
    await mcp.call('define_room_type', { game: pk, roomName: room, spec: { name: room, maxClients: 12 } });
    const r = await mcp.call('deploy_room_logic', { game: pk, roomName: room, code, tickRate: tick });
    console.log(`  ${room}: v${r.version}`);
  }
}
