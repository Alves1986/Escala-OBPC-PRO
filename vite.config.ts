
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Importante: Permite que o Vite leia variáveis de ambiente iniciadas com NEXT_PUBLIC_
  // Isso resolve a compatibilidade com configurações copiadas do Supabase/Vercel
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  build: {
    outDir: 'dist',
  },
  publicDir: 'public',
  define: {
    'process.env': {} // Polyfill process.env to avoid ReferenceError in browser
  }
});
