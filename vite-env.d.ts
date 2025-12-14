/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_KEY: string;
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_VAPID_PUBLIC_KEY: string;
  readonly VITE_SPOTIFY_CLIENT_ID?: string;
  readonly VITE_SPOTIFY_CLIENT_SECRET?: string;
  readonly VITE_YOUTUBE_API_KEY?: string;
  readonly NEXT_PUBLIC_SUPABASE_URL?: string;
  readonly NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Global defines
declare const __SUPABASE_URL__: string;
declare const __SUPABASE_KEY__: string;
declare const process: {
  env: {
    API_KEY?: string;
    [key: string]: any;
  }
};