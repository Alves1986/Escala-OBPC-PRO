import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App';
import { ToastProvider } from './components/Toast';

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <ToastProvider>
      <App />
    </ToastProvider>
  );
}