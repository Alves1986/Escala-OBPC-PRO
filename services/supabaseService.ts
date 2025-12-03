
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY, PushSubscriptionRecord } from '../types';

let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

export const getStorageKey = (ministryId: string, suffix: string) => `${ministryId}_${suffix}`;

// --- Authentication Logic ---

export const authenticateUser = async (ministryId: string, passwordInput: string): Promise<{ success: boolean; message: string }> => {
  if (!supabase || !ministryId) return { success: false, message: "Erro de conexão" };

  const authKey = getStorageKey(ministryId, 'auth_config_v1');

  try {
    // 1. Tenta buscar a configuração de senha existente
    const { data, error } = await supabase
      .from('app_storage')
      .select('value')
      .eq('key', authKey)
      .single();

    if (error || !data) {
      // CENÁRIO 1: Sem senha cadastrada (Primeiro acesso ou migração da versão antiga)
      // A senha digitada agora será a senha definitiva.
      if (passwordInput.length < 4) {
        return { success: false, message: "A senha deve ter no mínimo 4 caracteres." };
      }

      const { error: saveError } = await supabase
        .from('app_storage')
        .upsert(
          { key: authKey, value: { password: passwordInput, createdAt: new Date().toISOString() } },
          { onConflict: 'key' }
        );

      if (saveError) return { success: false, message: "Erro ao criar senha." };
      
      return { success: true, message: "Senha definida com sucesso!" };
    }

    // CENÁRIO 2: Já existe senha cadastrada
    const storedAuth = data.value as { password: string };
    
    if (storedAuth.password === passwordInput) {
      return { success: true, message: "Login realizado." };
    } else {
      return { success: false, message: "Senha incorreta." };
    }

  } catch (e) {
    console.error("Auth error", e);
    return { success: false, message: "Erro interno de autenticação." };
  }
};

// --- Data Loading/Saving ---

export const loadData = async <T>(ministryId: string, keySuffix: string, fallback: T): Promise<T> => {
  if (!supabase || !ministryId) return fallback;
  
  try {
    const { data, error } = await supabase
      .from('app_storage')
      .select('value')
      .eq('key', getStorageKey(ministryId, keySuffix))
      .single();

    if (error || !data) return fallback;
    return data.value as T;
  } catch (e) {
    console.error(`Error loading ${keySuffix}`, e);
    return fallback;
  }
};

export const saveData = async <T>(ministryId: string, keySuffix: string, value: T): Promise<boolean> => {
  if (!supabase || !ministryId) return false;

  try {
    const { error } = await supabase
      .from('app_storage')
      .upsert(
        { key: getStorageKey(ministryId, keySuffix), value },
        { onConflict: 'key' }
      );
    return !error;
  } catch (e) {
    console.error(`Error saving ${keySuffix}`, e);
    return false;
  }
};

// --- Push Notification Specific ---

export const saveSubscription = async (ministryId: string, subscription: PushSubscription) => {
  if (!supabase || !ministryId) return false;

  // Generate or retrieve a persistent Device ID for this browser
  let deviceId = localStorage.getItem('escala_device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('escala_device_id', deviceId);
  }

  const subRecord: PushSubscriptionRecord = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.toJSON().keys?.p256dh || '',
      auth: subscription.toJSON().keys?.auth || ''
    },
    device_id: deviceId,
    last_updated: new Date().toISOString()
  };

  // We store subscriptions as individual keys to avoid massive JSON arrays and race conditions
  // Key format: ministryId_sub_DEVICEID
  const storageKey = getStorageKey(ministryId, `sub_${deviceId}`);
  
  try {
    const { error } = await supabase
      .from('app_storage')
      .upsert(
        { key: storageKey, value: subRecord },
        { onConflict: 'key' }
      );
      
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("Error saving subscription:", e);
    return false;
  }
};
