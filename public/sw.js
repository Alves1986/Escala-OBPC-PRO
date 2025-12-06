
const CACHE_NAME = 'escala-midia-pwa-v13';

// Arquivos estáticos fundamentais
// Usando caminhos absolutos para garantir a integridade do cache
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/app-icon.svg',
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
  // 1. Navegação (HTML): Force a raiz / ou index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // Se estiver offline, retorna a raiz cacheada
          return caches.match('/')
            .then(response => response || caches.match('/index.html'));
        })
    );
    return;
  }

  // 2. Assets Estáticos (JS, CSS, Imagens): Stale-While-Revalidate
  if (event.request.destination === 'script' || 
      event.request.destination === 'style' || 
      event.request.destination === 'image' ||
      event.request.destination === 'font' ||
      event.request.destination === 'manifest') {
    
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          }
          return networkResponse;
        }).catch(() => {
            // Falha silenciosa se offline
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