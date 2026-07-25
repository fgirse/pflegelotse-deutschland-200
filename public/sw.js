// Service Worker der mobilen Erfassung (§5.3 PWA/Offline). App-Shell + statische
// Assets werden gecacht, damit die App ohne Netz startet; die Tagesdaten selbst
// liegen in IndexedDB (nicht hier). Kein Precache der Auth-Seite (würde ohne
// Cookies auf Login umgeleitet) — Navigationen werden zur Laufzeit gecacht.
const CACHE = 'pl-erfassung-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Statische Assets: cache-first (mit Nachladen in den Cache).
  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icons')) {
    e.respondWith(
      caches.match(req).then(
        (treffer) =>
          treffer ||
          fetch(req).then((res) => {
            const kopie = res.clone()
            caches.open(CACHE).then((c) => c.put(req, kopie))
            return res
          }),
      ),
    )
    return
  }

  // Seiten-Navigation: network-first, bei Offline aus dem Cache.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const kopie = res.clone()
          caches.open(CACHE).then((c) => c.put(req, kopie))
          return res
        })
        .catch(() => caches.match(req).then((t) => t || caches.match('/de/erfassung'))),
    )
    return
  }
  // Übrige GETs (API): direkt aus dem Netz; Offline-Daten kommen aus IndexedDB.
})
