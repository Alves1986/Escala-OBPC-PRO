
const CACHE_NAME = 'escala-midia-cache-v37-avatar';

// Assets estáticos fundamentais (Libraries pesadas ficam aqui para Cache-First)
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './app-icon.png',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  // Bibliotecas do importmap (Devem bater exatamente com o index.html)
  'https://aistudiocdn.com/lucide-react@^0.555.0',
  'https://aistudiocdn.com/react-dom@^19.2.0/',
  'https://aistudiocdn.com/recharts@^3.5.1',
  'https://aistudiocdn.com/react@^19.2.0/',
  'https://aistudiocdn.com/react@^19.2.0',
  'https://aistudiocdn.com/@google/genai@^1.30.0',
  'https://aistudiocdn.com/vite@^7.2.6',
  'https://aistudiocdn.com/@vitejs/plugin-react@^5.1.1',
  'https://aistudiocdn.com/jspdf@^3.0.4',
  'https://aistudiocdn.com/@supabase/supabase-js@^2.86.0',
  'https://aistudiocdn.com/jspdf-autotable@^5.0.2'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Força o novo SW a assumir imediatamente
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('SW: Pre-caching static assets');
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('SW: Cleaning old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Lógica 1: Bibliotecas Externas (CDNs) -> Cache First, Network Fallback
  // Isso garante performance máxima para bibliotecas que mudam pouco
  if (url.hostname.includes('cdn') || url.hostname.includes('googleapis') || url.hostname.includes('gstatic')) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        return cachedResponse || fetch(event.request).then(response => {
           // Opcional: Cachear dinamicamente novas libs se necessário
           return response;
        });
      })
    );
    return;
  }

  // Lógica 2: Arquivos da Aplicação (HTML, JS, TSX locais) -> Network First, Cache Fallback
  // Isso garante que atualizações no código do app sejam vistas imediatamente pelo usuário
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Se a resposta for válida, clonamos e atualizamos o cache (Cache Dinâmico)
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return response;
      })
      .catch(() => {
        // Se estiver offline ou falhar, tenta pegar do cache
        return caches.match(event.request).then(cachedResponse => {
           if (cachedResponse) {
             return cachedResponse;
           }
           // Fallback final para index.html se for uma navegação (SPA support)
           if (event.request.mode === 'navigate') {
             return caches.match('./index.html');
           }
           return null;
        });
      })
  );
});

// --- PUSH NOTIFICATION HANDLING ---

self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const title = data.title || 'Escala Mídia Pro';
      const options = {
        body: data.body || 'Nova atualização na escala.',
        icon: '/app-icon.png',
        badge: '/app-icon.png',
        vibrate: [100, 50, 100],
        tag: 'escala-notification',
        renotify: true,
        data: {
          url: data.url || '/'
        }
      };

      event.waitUntil(self.registration.showNotification(title, options));
    } catch (e) {
      console.error('Error parsing push data', e);
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      // Tenta focar numa janela já aberta
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === event.notification.data.url && 'focus' in client) {
          return client.focus();
        }
      }
      // Se não, abre uma nova
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});
