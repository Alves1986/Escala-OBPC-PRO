import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { SessionProvider } from './context/SessionContext';
import { ToastProvider } from './components/Toast';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';

const rootElement = document.getElementById('root');

if (rootElement && !rootElement.hasAttribute('data-bootstrapped')) {
  rootElement.setAttribute('data-bootstrapped', 'true');
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
            <SessionProvider>
                <App />
            </SessionProvider>
        </ToastProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
}