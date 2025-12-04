
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY, PushSubscriptionRecord, User, MemberMap, DEFAULT_ROLES, AppNotification, TeamMemberProfile } from '../types';

let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

export const getStorageKey = (ministryId: string, suffix: string) => `${ministryId}_${suffix}`;

export const getSupabase = () => supabase;

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

// --- Member Directory Sync ---

export const syncMemberProfile = async (ministryId: string, user: User) => {
    console.log("Sincronizando perfil na lista pública:", user.name);
    try {
        const list = await loadData<TeamMemberProfile[]>(ministryId, 'public_members_list', []);
        
        // Find by email (preferred) or name (fallback) - Case insensitive for email
        const index = list.findIndex(m => 
            (m.email && user.email && m.email.toLowerCase() === user.email.toLowerCase()) || 
            m.name === user.name
        );
        
        const newProfile: TeamMemberProfile = {
            id: user.id || Date.now().toString(),
            name: user.name,
            email: user.email,
            whatsapp: user.whatsapp,
            avatar_url: user.avatar_url,
            roles: user.functions || [],
            createdAt: new Date().toISOString()
        };

        let newList;
        if (index >= 0) {
            newList = [...list];
            const existing = newList[index];
            
            // Lógica inteligente de merge:
            // 1. Atualiza dados de contato (Nome, Whats, Foto) com o que vem do login atual
            // 2. PRESERVA as funções (roles) que já estão na lista, a menos que o login traga novas
            // 3. Preserva a data de criação original
            
            newList[index] = { 
                ...existing, 
                id: user.id || existing.id || Date.now().toString(), // Fixed TS Error
                name: user.name, // Nome sempre atualizado pelo perfil
                email: user.email || existing.email,
                whatsapp: user.whatsapp || existing.whatsapp,
                avatar_url: user.avatar_url || existing.avatar_url,
                // Se o usuário logado não tiver roles definidas no metadata (comum), mantém as da lista
                roles: (user.functions && user.functions.length > 0) ? user.functions : (existing.roles || []),
                createdAt: existing.createdAt || newProfile.createdAt
            }; 
        } else {
            // Novo membro na lista
            newList = [...list, newProfile];
        }
        
        // Ordena alfabeticamente para manter a organização
        newList.sort((a, b) => a.name.localeCompare(b.name));
        
        const saved = await saveData(ministryId, 'public_members_list', newList);
        if (saved) console.log("Perfil sincronizado com sucesso.");
        return newList;
    } catch (e) {
        console.error("Erro ao sincronizar perfil do membro", e);
        return [];
    }
};

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

            // Força a sincronização ao logar para garantir que o membro apareça na lista
            if (metadata.ministryId) {
                // Não aguardamos o sync para não travar o login visualmente, mas disparamos
                syncMemberProfile(metadata.ministryId, userProfile);
            }

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
                    functions: selectedRoles || [],
                    role: 'member'
                }
            }
        });

        if (error) return { success: false, message: error.message };

        // CRUCIAL: Sincroniza imediatamente o novo usuário com a lista pública
        if (data.user) {
            const userProfile: User = {
                id: data.user.id,
                email: email,
                name: name,
                role: 'member',
                ministryId: cleanMid,
                whatsapp: whatsapp,
                functions: selectedRoles || []
            };
            await syncMemberProfile(cleanMid, userProfile);

            // ENVIA NOTIFICAÇÃO PARA O PAINEL
            await sendNotification(cleanMid, {
                type: 'info',
                title: 'Novo Membro Cadastrado',
                message: `${name} acabou de se cadastrar na equipe.`
            });
        }

        return { success: true, message: "Cadastro realizado com sucesso!" };
    } catch (e) {
        console.error(e);
        return { success: false, message: "Erro interno." };
    }
};

export const logout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
};

export const updateUserProfile = async (name: string, whatsapp: string, avatar_url?: string): Promise<{ success: boolean; message: string }> => {
    if (!supabase) return { success: false, message: "Erro de conexão" };

    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) return { success: false, message: "Usuário não autenticado." };

        const updates = {
            data: {
                name,
                whatsapp,
                avatar_url
            }
        };

        const { error: updateError } = await supabase.auth.updateUser(updates);

        if (updateError) {
            return { success: false, message: "Erro ao atualizar perfil." };
        }
        
        // Sync with public directory if needed
        const ministryId = user.user_metadata.ministryId;
        if (ministryId) {
             const userProfile: User = {
                id: user.id,
                email: user.email,
                name: name,
                role: user.user_metadata.role || 'member',
                ministryId: ministryId,
                whatsapp: whatsapp,
                avatar_url: avatar_url,
                functions: user.user_metadata.functions || []
            };
            await syncMemberProfile(ministryId, userProfile);
        }

        return { success: true, message: "Perfil atualizado com sucesso!" };
    } catch (e) {
        console.error(e);
        return { success: false, message: "Erro interno." };
    }
};

export const saveSubscription = async (ministryId: string, subscription: PushSubscription): Promise<boolean> => {
    if (!supabase || !ministryId) return false;
    
    try {
        const key = getStorageKey(ministryId, 'push_subscriptions_v1');
        const { data } = await supabase.from('app_storage').select('value').eq('key', key).single();
        
        let subs: PushSubscriptionRecord[] = data?.value || [];
        
        // Remove duplicate if exists (by endpoint)
        subs = subs.filter((s: PushSubscriptionRecord) => s.endpoint !== subscription.endpoint);
        
        const subJson = subscription.toJSON();
        
        // Add new
        const record: PushSubscriptionRecord = {
            endpoint: subscription.endpoint,
            keys: {
                p256dh: subJson.keys?.p256dh || '',
                auth: subJson.keys?.auth || ''
            },
            device_id: 'browser_' + Date.now(), // Simple ID
            last_updated: new Date().toISOString()
        };
        
        subs.push(record);
        
        const { error } = await supabase.from('app_storage').upsert({ key, value: subs }, { onConflict: 'key' });
        return !error;
    } catch (e) {
        console.error("Erro ao salvar inscrição push", e);
        return false;
    }
};

export const sendNotification = async (ministryId: string, notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    if (!supabase || !ministryId) return;

    try {
        const key = getStorageKey(ministryId, 'notifications_v1');
        const { data } = await supabase.from('app_storage').select('value').eq('key', key).single();
        
        let notifs: AppNotification[] = data?.value || [];
        
        const newNotif: AppNotification = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            read: false,
            ...notification
        };
        
        // Keep last 50
        notifs = [newNotif, ...notifs].slice(0, 50);
        
        await supabase.from('app_storage').upsert({ key, value: notifs }, { onConflict: 'key' });
    } catch (e) {
        console.error("Erro ao enviar notificação", e);
    }
};

export const markNotificationsRead = async (ministryId: string, notificationIds: string[]) => {
    if (!supabase || !ministryId) return [];

    try {
        const key = getStorageKey(ministryId, 'notifications_v1');
        const { data } = await supabase.from('app_storage').select('value').eq('key', key).single();
        
        let notifs: AppNotification[] = data?.value || [];
        
        let updated = false;
        notifs = notifs.map(n => {
            if (notificationIds.includes(n.id) && !n.read) {
                updated = true;
                return { ...n, read: true };
            }
            return n;
        });
        
        if (updated) {
            await supabase.from('app_storage').upsert({ key, value: notifs }, { onConflict: 'key' });
        }
        
        return notifs;
    } catch (e) {
        console.error("Erro ao marcar lidas", e);
        return [];
    }
};

export const clearAllNotifications = async (ministryId: string): Promise<AppNotification[]> => {
    if (!supabase || !ministryId) return [];

    try {
        const key = getStorageKey(ministryId, 'notifications_v1');
        // Substitui a lista inteira por um array vazio
        const { error } = await supabase.from('app_storage').upsert({ key, value: [] }, { onConflict: 'key' });
        
        if (error) {
            console.error("Erro Supabase ao limpar:", error);
            return [];
        }

        return [];
    } catch (e) {
        console.error("Erro ao limpar notificações", e);
        return [];
    }
};
