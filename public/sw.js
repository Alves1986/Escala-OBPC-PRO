
const CACHE_NAME = 'escala-midia-pwa-v9';

// Arquivos estáticos fundamentais
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './app-icon.png',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// Instalação
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

// Ativação e Limpeza
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Interceptação de Rede
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. Navegação (HTML): Network First, Fallback to Cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => {
          return caches.match('./index.html')
            .then(response => response || caches.match('/index.html'));
        })
    );
    return;
  }

  // 2. Assets Estáticos (JS, CSS, Imagens): Stale-While-Revalidate
  if (event.request.destination === 'script' || 
      event.request.destination === 'style' || 
      event.request.destination === 'image' ||
      event.request.destination === 'font') {
    
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          }
          return networkResponse;
        }).catch(() => {
            // Falha silenciosa se offline e sem cache
        });
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 3. Outras requisições: Network First
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
