
const CACHE_NAME = 'gestao-escala-pwa-v25'; // Versão incrementada para forçar atualização

// Arquivos estáticos fundamentais
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
  self.skipWaiting(); // Força a ativação imediata do novo SW
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Tenta fazer o cache, mas não falha a instalação se um recurso externo falhar
      return cache.addAll(PRECACHE_URLS).catch(err => {
        console.warn('Falha no precache de alguns arquivos (continuando):', err);
      });
    })
  );
});

// Ativação e Limpeza de Caches Antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
        return self.clients.claim(); // Assume o controle das páginas imediatamente
    })
  );
});

// Interceptação de Rede
self.addEventListener('fetch', event => {
  // Ignora requisições não-HTTP
  if (!event.request.url.startsWith('http')) return;

  // 1. ESTRATÉGIA NETWORK-FIRST PARA NAVEGAÇÃO (HTML)
  // Isso previne o "travamento" ao garantir que o index.html (que aponta para os JS novos)
  // seja baixado da rede primeiro. Se estiver offline, usa o cache.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
            // Se sucesso, atualiza o cache e retorna
            return caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, networkResponse.clone());
                return networkResponse;
            });
        })
        .catch(() => {
            // Se offline ou falha na rede, retorna o index.html do cache
            return caches.match('/')
                .then(response => response || caches.match('/index.html'));
        })
    );
    return;
  }

  // 2. Assets Estáticos (JS, CSS, Imagens, Fontes): Stale-While-Revalidate
  // Performance rápida servindo do cache, mas atualizando em segundo plano
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
            // Falha silenciosa se offline (o cachedResponse será usado)
        });
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 3. Outras requisições (API, etc): Network First com Fallback para Cache (se houver)
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// Evento de Clique na Notificação
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if ((client.url === urlToOpen || client.url.endsWith(urlToOpen)) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen).catch(err => console.warn('Falha ao abrir janela', err));
      }
    })
  );
});

// Evento de Recebimento de Push
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
      badge: '/icon.png',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      tag: 'escala-app',
      data: data.data || { url: '/' },
      actions: [{ action: 'open', title: 'Ver Detalhes' }]
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
  }
});
