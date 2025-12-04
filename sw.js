
const CACHE_NAME = 'escala-midia-v1-redo';

// Lista de arquivos vitais para o funcionamento offline
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/app-icon.png',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  // Importante: Assegurar que as bibliotecas principais estejam cacheadas
  'https://aistudiocdn.com/lucide-react@^0.555.0',
  'https://aistudiocdn.com/react-dom@^19.2.0/',
  'https://aistudiocdn.com/recharts@^3.5.1',
  'https://aistudiocdn.com/react@^19.2.0/',
  'https://aistudiocdn.com/react@^19.2.0',
  'https://aistudiocdn.com/@google/genai@^1.30.0',
  'https://aistudiocdn.com/@supabase/supabase-js@^2.86.0'
];

// Instalação: Cacheia arquivos estáticos
self.addEventListener('install', event => {
  self.skipWaiting(); // Força o SW a ativar imediatamente
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching app shell');
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

// Ativação: Limpa caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Clearing old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Interceptação de Requisições
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Estratégia: Stale-While-Revalidate para arquivos estáticos
  // Tenta servir do cache, mas atualiza em background
  if (event.request.destination === 'script' || event.request.destination === 'style' || event.request.destination === 'image') {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
             const responseClone = networkResponse.clone();
             caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          }
          return networkResponse;
        }).catch(() => {/* offline sem cache, fazer nada */});
        
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Estratégia: Network First para navegação e dados (garante frescor)
  // Se falhar (offline), tenta o cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cacheia navegação bem sucedida para permitir reload offline
        if (event.request.mode === 'navigate') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then(response => {
           if (response) return response;
           // Fallback para index.html se for navegação
           if (event.request.mode === 'navigate') {
               return caches.match('/index.html');
           }
           return null;
        });
      })
  );
});

// Push Notifications
self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const title = data.title || 'Escala Mídia Pro';
      const options = {
        body: data.body || 'Nova atualização.',
        icon: '/app-icon.png',
        badge: '/app-icon.png',
        vibrate: [100, 50, 100],
        data: { url: data.url || '/' }
      };
      event.waitUntil(self.registration.showNotification(title, options));
    } catch (e) {
      console.error('[SW] Push Error', e);
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === event.notification.data.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(event.notification.data.url);
    })
  );
});
