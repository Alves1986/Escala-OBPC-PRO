
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega variáveis de ambiente baseadas no modo (development/production)
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    // Importante: Permite que o Vite leia variáveis de ambiente iniciadas com NEXT_PUBLIC_
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    define: {
      // Define process.env.API_KEY para o SDK do Google GenAI
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.API_KEY || ''),
      // Polyfill básico para 'process' para evitar "ReferenceError: process is not defined"
      'process.env': {},
    },
    build: {
      outDir: 'dist',
    },
    publicDir: 'public',
  };
});
