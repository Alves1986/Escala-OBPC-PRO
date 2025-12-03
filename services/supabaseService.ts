
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY, PushSubscriptionRecord, User, MemberMap, DEFAULT_ROLES } from '../types';

let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

export const getStorageKey = (ministryId: string, suffix: string) => `${ministryId}_${suffix}`;

export const getSupabase = () => supabase;

// --- Native Authentication Logic ---

export const loginWithEmail = async (email: string, password: string): Promise<{ success: boolean; message: string; user?: User, ministryId?: string }> => {
    if (!supabase) return { success: false, message: "Erro de conexão" };

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            return { success: false, message: "Email ou senha incorretos." };
        }

        if (data.user) {
            const metadata = data.user.user_metadata;
            const userProfile: User = {
                id: data.user.id,
                email: data.user.email,
                name: metadata.name || 'Usuário',
                role: metadata.role || 'member',
                ministryId: metadata.ministryId, 
                whatsapp: metadata.whatsapp,
                avatar_url: metadata.avatar_url,
                functions: metadata.functions || []
            };
            return { success: true, message: "Login realizado.", user: userProfile, ministryId: metadata.ministryId };
        }
        
        return { success: false, message: "Erro desconhecido." };
    } catch (e) {
        console.error(e);
        return { success: false, message: "Erro interno." };
    }
};

export const registerWithEmail = async (
    email: string,
    password: string,
    name: string,
    ministryId: string,
    whatsapp?: string,
    selectedRoles?: string[]
): Promise<{ success: boolean; message: string }> => {
    if (!supabase) return { success: false, message: "Erro de conexão" };

    try {
        const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name,
                    ministryId: cleanMid, // Salva o ID do ministério nos metadados
                    whatsapp,
                    role: 'admin', // Quem cria a conta define o ID, assumimos Admin/Líder
                    functions: selectedRoles || []
                }
            }
        });

        if (error) {
            return { success: false, message: error.message };
        }

        return { success: true, message: "Conta criada! Verifique seu email se necessário ou faça login." };
    } catch (e) {
        console.error(e);
        return { success: false, message: "Erro ao registrar." };
    }
};

export const updateUserProfile = async (name: string, whatsapp: string, avatar_url?: string): Promise<{ success: boolean, message: string }> => {
    if (!supabase) return { success: false, message: "Erro de conexão" };
    
    try {
        const updates: any = { name, whatsapp };
        if (avatar_url !== undefined) {
            updates.avatar_url = avatar_url;
        }

        const { error } = await supabase.auth.updateUser({
            data: updates
        });

        if (error) throw error;
        return { success: true, message: "Perfil atualizado com sucesso!" };
    } catch (e: any) {
        console.error(e);
        return { success: false, message: e.message || "Erro ao atualizar perfil." };
    }
};

export const logout = async () => {
    if (supabase) await supabase.auth.signOut();
};

export const getCurrentUser = async (): Promise<{ user: User | null, ministryId: string | null }> => {
    if (!supabase) return { user: null, ministryId: null };
    
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
        const meta = session.user.user_metadata;
        return {
            user: {
                id: session.user.id,
                email: session.user.email,
                name: meta.name,
                role: meta.role || 'member',
                ministryId: meta.ministryId,
                whatsapp: meta.whatsapp,
                avatar_url: meta.avatar_url
            },
            ministryId: meta.ministryId
        };
    }
    return { user: null, ministryId: null };
}

// --- Data Loading/Saving (Mantido igual para compatibilidade com dados antigos) ---

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

// --- Push Notification ---

export const saveSubscription = async (ministryId: string, subscription: PushSubscription) => {
  if (!supabase || !ministryId) return false;

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
