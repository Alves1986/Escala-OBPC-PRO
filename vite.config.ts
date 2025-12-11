
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega variáveis de ambiente baseadas no modo (development/production)
  // O terceiro argumento '' carrega todas as variáveis, não apenas as que começam com VITE_
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    // Importante: Permite que o Vite leia variáveis de ambiente iniciadas com NEXT_PUBLIC_
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    define: {
      // Defines globais para injetar valores de ambiente de forma segura
      '__SUPABASE_URL__': JSON.stringify(env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || ''),
      '__SUPABASE_KEY__': JSON.stringify(env.VITE_SUPABASE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''),
      
      // Define process.env.API_KEY para o SDK do Google GenAI
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.API_KEY || ''),
      
      // Polyfill básico para 'process' para evitar erros de bibliotecas que acessam process.env
      'process.env': {},
    },
    build: {
      outDir: 'dist',
    },
    publicDir: 'public',
  };
});
