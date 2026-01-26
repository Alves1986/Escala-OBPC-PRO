import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const rootElement = document.getElementById('root');

if (rootElement && !rootElement.hasAttribute('data-bootstrapped')) {
  rootElement.setAttribute('data-bootstrapped', 'true');
  const root = createRoot(rootElement);
  root.render(<App />);
}