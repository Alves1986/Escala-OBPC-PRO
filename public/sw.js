
const CACHE_NAME = "escala-pro-v2";

// Assets estáticos fundamentais para o app parecer nativo e profissional offline.
// Inclui CDNs de estilo e fontes para garantir que o visual não quebre sem internet.
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon.png",
  "https://cdn.tailwindcss.com", 
  "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
];

// --- INSTALAÇÃO ---
self.addEventListener("install", (event) => {
  self.skipWaiting(); // Força o SW a assumir imediatamente
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Usa catch para garantir que a instalação não falhe se um CDN externo estiver instável
      return cache.addAll(STATIC_ASSETS).catch(err => {
          console.warn("Aviso: Alguns assets opcionais não foram cacheados no install.", err);
      });
    })
  );
});

// --- ATIVAÇÃO & LIMPEZA ---
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          // Remove caches antigos automaticamente para manter o app leve
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim(); // Controla as páginas abertas imediatamente
});

// --- INTERCEPTAÇÃO DE REDE (ESTRATÉGIA HÍBRIDA) ---
self.addEventListener("fetch", (event) => {
  // Ignora requisições que não sejam GET ou esquemas exóticos
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) return;

  const url = new URL(event.request.url);

  // 1. Navegação (HTML): Network First -> Fallback Cache
  // Garante que o usuário sempre veja a versão mais nova se tiver internet.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
            // Atualiza o cache com a nova versão
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            return response;
        })
        .catch(() => {
            // Se offline, retorna a página salva
            return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // 2. Assets Estáticos (JS, CSS, Imagens, Fonts): Stale-While-Revalidate
  // Performance máxima: entrega o cache imediatamente e atualiza em background.
  if (
      STATIC_ASSETS.includes(event.request.url) || 
      url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|json|woff2)$/) ||
      url.hostname.includes('cdn.tailwindcss.com') ||
      url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')
  ) {
      event.respondWith(
        caches.match(event.request).then((cached) => {
          const networkFetch = fetch(event.request).then((response) => {
            if(response.ok) {
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
            }
            return response;
          }).catch(() => {}); // Falha silenciosa no background se offline

          return cached || networkFetch;
        })
      );
      return;
  }

  // 3. Padrão: Network First com Fallback
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// --- NOTIFICAÇÕES PUSH (Essencial para App Profissional) ---
self.addEventListener('push', function(event) {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'Escala PRO', body: event.data.text() };
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon.png',
    badge: '/icon.png',
    vibrate: [100, 50, 100],
    data: { url: data.data?.url || '/' },
    actions: [{ action: 'open', title: 'Ver Detalhes' }],
    tag: 'escala-pro-notification' // Agrupa notificações para não poluir a barra
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Tenta focar em uma aba já aberta para uma experiência fluida
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus().then(c => c.navigate ? c.navigate(urlToOpen) : null);
        }
      }
      // Se não, abre uma nova
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});
