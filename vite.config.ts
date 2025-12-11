
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
      // Define explicitamente as variáveis críticas para garantir que existam no runtime
      // mesmo se o import.meta.env falhar devido a polyfills
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.API_KEY || ''),
      'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || ''),
      'process.env.VITE_SUPABASE_KEY': JSON.stringify(env.VITE_SUPABASE_KEY || ''),
      
      // Polyfill básico para 'process' para evitar erros de bibliotecas
      'process.env': {},
    },
    build: {
      outDir: 'dist',
    },
    publicDir: 'public',
  };
});
