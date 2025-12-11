
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import App from './App';

// 1. Configuração do Cliente React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false, // Evita refetch agressivo em mobile
      staleTime: 1000 * 60 * 5, // 5 minutos: Dados são considerados "frescos"
      gcTime: 1000 * 60 * 60 * 24, // 24 horas: Tempo que o cache inativo permanece na memória/storage
    },
  },
});

// 2. Configuração do Persister (Salva o cache no localStorage automaticamente)
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'ESCALA_QUERY_CACHE', // Chave única para não conflitar com outros apps
  throttleTime: 1000, // Limita a frequência de escritas no storage
});

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <PersistQueryClientProvider 
      client={queryClient} 
      persistOptions={{ persister }}
      onSuccess={() => console.log('Cache restaurado com sucesso!')}
    >
      <App />
    </PersistQueryClientProvider>
  );
}
