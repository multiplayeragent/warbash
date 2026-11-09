/* War Bash service worker (copied as is to dist/sw.js by build.py).
   It makes the game installable on the home screen (Android, Chrome) and caches the files whose address changes with their
   content (textures, sounds, artwork, icons: safe for a year), which speeds up later visits on a mobile network. The game page,
   the API and version.json are NEVER served from the cache: the game updates itself (src/09h-update.js) and must not stay on an
   old version. Offline, the page has no network to load three.js, so we don't pretend to offer an offline game. */
const CACHE = 'cod-files-v1';
const IMMUTABLE = /^\/(tex|sfx|maps|icons)\//;
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || !IMMUTABLE.test(u.pathname)) return; // everything else: the network, as without a service worker
  e.respondWith((async () => {
    const c = await caches.open(CACHE), hit = await c.match(r);
    if (hit) return hit;
    const res = await fetch(r);
    if (res.ok) c.put(r, res.clone()).catch(() => {});
    return res;
  })());
});
