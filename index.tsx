import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css'; // Assuming styles are here or similar

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}
