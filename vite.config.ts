
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
      },
    },
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    define: {
      '__SUPABASE_URL__': JSON.stringify(env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || ''),
      '__SUPABASE_KEY__': JSON.stringify(env.VITE_SUPABASE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''),
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.API_KEY || ''),
      'process.env': {},
    },
    build: {
      outDir: 'dist',
    },
    publicDir: 'public',
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './tests/setup.ts',
    }
  };
});
