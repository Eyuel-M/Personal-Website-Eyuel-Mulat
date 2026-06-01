const CACHE = 'em-shell-v1'
const SHELL = [
  '/',
  '/about.html',
  '/work.html',
  '/insights.html',
  '/contact.html',
  '/terms.html',
  '/src/css/main.css',
]

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(SHELL).catch(function () {})
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE }).map(function (k) { return caches.delete(k) })
      )
    })
  )
  self.clients.claim()
})

self.addEventListener('fetch', function (e) {
  // Only handle GET requests for same-origin navigation and assets
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)
  // Skip API routes — always go to network
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) return

  e.respondWith(
    caches.match(e.request).then(function (cached) {
      // Network-first for HTML, cache-first for assets
      const isHTML = e.request.headers.get('accept') && e.request.headers.get('accept').includes('text/html')
      if (isHTML) {
        return fetch(e.request).then(function (resp) {
          if (resp && resp.ok) {
            const clone = resp.clone()
            caches.open(CACHE).then(function (cache) { cache.put(e.request, clone) })
          }
          return resp
        }).catch(function () { return cached })
      }
      return cached || fetch(e.request).then(function (resp) {
        if (resp && resp.ok) {
          const clone = resp.clone()
          caches.open(CACHE).then(function (cache) { cache.put(e.request, clone) })
        }
        return resp
      })
    })
  )
})
