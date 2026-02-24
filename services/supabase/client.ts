import { createClient, SupabaseClient } from '@supabase/supabase-js';

let serviceOrgId: string | null = null;

let envUrl = "";
let envKey = "";

try {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    envUrl = import.meta.env.VITE_SUPABASE_URL || "";
    envKey = import.meta.env.VITE_SUPABASE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "";
  }
} catch (e) {
  console.warn("[SupabaseService] Falha ao ler import.meta.env. Usando fallback se disponível.");
}

if (!envUrl && typeof process !== 'undefined' && process.env) {
    envUrl = process.env.VITE_SUPABASE_URL || "";
    envKey = process.env.VITE_SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
}

const supabase = (envUrl && envKey) 
  ? createClient(envUrl, envKey, {
      auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
      }
  }) 
  : null;

if (!supabase) {
    console.error("[SupabaseService] CRITICAL: Client não inicializado. Verifique VITE_SUPABASE_URL e VITE_SUPABASE_KEY.");
}

export const getSupabase = () => supabase;

export const setServiceOrgContext = (id: string) => { serviceOrgId = id; };

export const clearServiceOrgContext = () => { serviceOrgId = null; };

export const configureSupabaseManual = (url: string, key: string) => { console.warn("Manual config disabled."); };

export const validateConnection = async (url: string, key: string) => { return false; };
