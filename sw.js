
const CACHE_NAME = 'escala-midia-pwa-v21';

// Arquivos estáticos fundamentais
// Usando caminhos absolutos para garantir a integridade do cache
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.png',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// Instalação
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // IMPORTANTE: Adicionado .catch() para que falhas no download de assets (ex: cdn fora do ar)
      // NÃO impeçam a instalação do Service Worker. Prioridade é a funcionalidade de Push.
      return cache.addAll(PRECACHE_URLS).catch(err => {
        console.warn('Falha no precache de alguns arquivos, mas continuando instalação do SW:', err);
      });
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

// Evento de Clique na Notificação
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  // URL para abrir (pode vir no data da notificação ou usar a raiz)
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Tenta focar em uma janela já aberta
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if ((client.url === urlToOpen || client.url.endsWith(urlToOpen)) && 'focus' in client) {
          return client.focus();
        }
      }
      // Se não tiver janela aberta, abre uma nova
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Evento de Recebimento de Push (Mobile/Background)
self.addEventListener('push', function(event) {
  if (event.data) {
    let data;
    try {
        data = event.data.json();
    } catch (e) {
        data = { title: 'Nova Notificação', body: event.data.text() };
    }

    const options = {
      body: data.body,
      icon: data.icon || '/icon.png',
      badge: '/icon.png', // Ícone pequeno na barra de status (Android)
      vibrate: [200, 100, 200], // Vibração para chamar atenção
      requireInteraction: true, // Mantém a notificação até o usuário interagir (Desktop/Alguns Androids)
      tag: 'escala-app', // Substitui notificações antigas para não empilhar muitas
      data: data.data || { url: '/' },
      actions: [
        { action: 'open', title: 'Ver Detalhes' }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});
