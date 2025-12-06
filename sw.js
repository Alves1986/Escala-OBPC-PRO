
const CACHE_NAME = 'escala-midia-pwa-v4';

// Lista de arquivos vitais para o funcionamento offline
// Inclui as bibliotecas do CDN definidas no importmap do index.html
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/app-icon.png',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  // Dependências críticas do CDN
  'https://aistudiocdn.com/lucide-react@^0.555.0',
  'https://aistudiocdn.com/react-dom@^19.2.0/',
  'https://aistudiocdn.com/recharts@^3.5.1',
  'https://aistudiocdn.com/react@^19.2.0/',
  'https://aistudiocdn.com/react@^19.2.0',
  'https://aistudiocdn.com/@google/genai@^1.30.0',
  'https://aistudiocdn.com/@supabase/supabase-js@^2.86.0',
  'https://aistudiocdn.com/jspdf@^3.0.4',
  'https://aistudiocdn.com/jspdf-autotable@^5.0.2'
];

// Instalação: Cacheia arquivos estáticos
self.addEventListener('install', event => {
  self.skipWaiting(); // Força o SW a ativar imediatamente
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
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

  // Estratégia: Stale-While-Revalidate para scripts e estilos
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

  // Estratégia: Network First para navegação (garante dados frescos)
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