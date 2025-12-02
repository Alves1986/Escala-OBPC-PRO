import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  publicDir: 'public', // Assets estáticos como sw.js e manifest devem ficar aqui ou na raiz dependendo da config
});