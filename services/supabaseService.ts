
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY, PushSubscriptionRecord, User, MemberMap, DEFAULT_ROLES, AppNotification, TeamMemberProfile, AvailabilityMap } from '../types';

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
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const { data, error } = await supabase
      .from('app_storage')
      .select('value')
      .eq('key', getStorageKey(cleanMid, keySuffix))
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
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const { error } = await supabase
      .from('app_storage')
      .upsert(
        { key: getStorageKey(cleanMid, keySuffix), value },
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
    if (!supabase || !ministryId) return [];
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    console.log(`[Sync] Sincronizando perfil [${user.name}] em [${cleanMid}]`);

    try {
        const storageKey = getStorageKey(cleanMid, 'public_members_list');
        
        // 1. Busca Explícita com tratamento de erro robusto
        // NÃO podemos assumir que falha = lista vazia, pois isso apaga os outros membros
        const { data, error } = await supabase
            .from('app_storage')
            .select('value')
            .eq('key', storageKey)
            .single();

        let list: TeamMemberProfile[] = [];

        if (data) {
            list = data.value || [];
        } else if (error) {
            if (error.code === 'PGRST116') {
                // PGRST116: Nenhum registro encontrado. Isso é normal na primeira vez.
                // Podemos criar uma lista nova com segurança.
                console.log("[Sync] Lista de membros não existe. Criando nova.");
                list = [];
            } else {
                // Outro erro (Ex: Timeout, Falha de Rede). 
                // PERIGO: Se continuarmos, vamos salvar uma lista vazia e apagar todo mundo.
                console.error("[Sync] Erro CRÍTICO ao buscar lista. Abortando para proteger dados.", error);
                return []; 
            }
        }
        
        // 2. Prepara o objeto do perfil atualizado
        const newProfile: TeamMemberProfile = {
            id: user.id || Date.now().toString(),
            name: user.name,
            email: user.email,
            whatsapp: user.whatsapp,
            avatar_url: user.avatar_url,
            roles: user.functions || [],
            createdAt: new Date().toISOString()
        };

        // 3. Verifica se o membro já existe na lista (Merge)
        const index = list.findIndex(m => 
            (m.id && user.id && m.id === user.id) || // Match por ID
            (m.email && user.email && m.email.toLowerCase() === user.email.toLowerCase()) || // Match por Email
            m.name === user.name // Match por Nome (Fallback)
        );
        
        // Trabalhamos em uma cópia da lista
        let newList = [...list];

        if (index >= 0) {
            // ATUALIZAÇÃO: Mescla dados existentes com os novos do login
            const existing = newList[index];
            newList[index] = { 
                ...existing, 
                // Prioriza os dados do login atual, mantendo o que não mudou
                id: user.id || existing.id, 
                name: user.name, 
                email: user.email || existing.email,
                whatsapp: user.whatsapp || existing.whatsapp,
                avatar_url: user.avatar_url || existing.avatar_url,
                // Se o login atual trouxe funções, usa elas. Senão, mantém as do banco.
                roles: (user.functions && user.functions.length > 0) ? user.functions : (existing.roles || []),
                createdAt: existing.createdAt || newProfile.createdAt
            }; 
            console.log(`[Sync] Membro atualizado: ${user.name}`);
        } else {
            // INSERÇÃO: Adiciona novo membro à lista
            newList.push(newProfile);
            console.log(`[Sync] Novo membro adicionado: ${user.name}`);
        }
        
        // 4. Ordenação Alfabética
        newList.sort((a, b) => a.name.localeCompare(b.name));
        
        // 5. Salvamento Seguro
        const { error: saveError } = await supabase
            .from('app_storage')
            .upsert({ key: storageKey, value: newList }, { onConflict: 'key' });

        if (saveError) {
            console.error("[Sync] Erro ao salvar lista atualizada:", saveError);
            return [];
        }

        console.log("[Sync] Lista de membros sincronizada com sucesso.");
        return newList;

    } catch (e) {
        console.error("[Sync] Exceção não tratada:", e);
        return [];
    }
};

export const deleteMember = async (ministryId: string, memberId: string, memberName: string): Promise<boolean> => {
    if (!supabase || !ministryId) return false;

    try {
        // 1. Remove da Lista Pública de Membros (Visual)
        const list = await loadData<TeamMemberProfile[]>(ministryId, 'public_members_list', []);
        const newList = list.filter(m => m.id !== memberId && m.name !== memberName);
        await saveData(ministryId, 'public_members_list', newList);

        // 2. Remove das Atribuições de Cargos (Members Map)
        const memberMap = await loadData<MemberMap>(ministryId, 'members_v7', {});
        const newMemberMap: MemberMap = {};
        
        Object.keys(memberMap).forEach(role => {
            newMemberMap[role] = memberMap[role].filter(name => name !== memberName);
        });
        await saveData(ministryId, 'members_v7', newMemberMap);

        // 3. Limpa Disponibilidade Salva
        const availability = await loadData<AvailabilityMap>(ministryId, 'availability_v1', {});
        if (availability[memberName]) {
            delete availability[memberName];
            await saveData(ministryId, 'availability_v1', availability);
        }

        return true;
    } catch (e) {
        console.error("Erro ao excluir membro", e);
        return false;
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
            const cleanMid = metadata.ministryId?.trim().toLowerCase().replace(/\s+/g, '-');
            
            const userProfile: User = {
                id: data.user.id,
                email: data.user.email,
                name: metadata.name || 'Usuário',
                role: metadata.role || 'member',
                ministryId: cleanMid, 
                whatsapp: metadata.whatsapp,
                avatar_url: metadata.avatar_url,
                functions: metadata.functions || []
            };

            if (cleanMid) {
                // Tenta sincronizar no login para garantir presença na lista
                syncMemberProfile(cleanMid, userProfile);
            }

            return { success: true, message: "Login realizado.", user: userProfile, ministryId: cleanMid };
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
                    ministryId: cleanMid, 
                    whatsapp,
                    functions: selectedRoles || [],
                    role: 'member'
                }
            }
        });

        if (error) return { success: false, message: error.message };

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
            
            // Força sincronização imediata
            await syncMemberProfile(cleanMid, userProfile);

            // Se o usuário selecionou funções, já insere ele nos grupos correspondentes
            if (selectedRoles && selectedRoles.length > 0) {
                const currentRoles = await loadData<MemberMap>(cleanMid, 'members_v7', {});
                let rolesChanged = false;
                
                selectedRoles.forEach(role => {
                    if (!currentRoles[role]) currentRoles[role] = [];
                    if (!currentRoles[role].includes(name)) {
                        currentRoles[role].push(name);
                        rolesChanged = true;
                    }
                });
                
                if (rolesChanged) {
                    await saveData(cleanMid, 'members_v7', currentRoles);
                }
            }

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

export const updateUserProfile = async (name: string, whatsapp: string, avatar_url?: string, functions?: string[]): Promise<{ success: boolean; message: string }> => {
    if (!supabase) return { success: false, message: "Erro de conexão" };

    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) return { success: false, message: "Usuário não autenticado." };

        const updates: any = {
            data: {
                name,
                whatsapp,
                avatar_url
            }
        };

        // Adiciona funções se fornecido
        if (functions) {
            updates.data.functions = functions;
        }

        const { error: updateError } = await supabase.auth.updateUser(updates);

        if (updateError) {
            return { success: false, message: "Erro ao atualizar perfil." };
        }
        
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
                functions: functions || user.user_metadata.functions || []
            };
            await syncMemberProfile(ministryId, userProfile);

            // Sincroniza também o mapa de cargos (members_v7) para o gerenciamento rápido
            if (functions) {
                const currentMap = await loadData<MemberMap>(ministryId, 'members_v7', {});
                let mapChanged = false;

                // 1. Remove usuário de todas as listas primeiro (para evitar duplicatas ou funções antigas)
                Object.keys(currentMap).forEach(role => {
                    if (currentMap[role].includes(name)) {
                        currentMap[role] = currentMap[role].filter(n => n !== name);
                        mapChanged = true;
                    }
                });

                // 2. Adiciona às listas selecionadas
                functions.forEach(role => {
                    if (!currentMap[role]) currentMap[role] = [];
                    if (!currentMap[role].includes(name)) {
                        currentMap[role].push(name);
                        mapChanged = true;
                    }
                });

                if (mapChanged) {
                    await saveData(ministryId, 'members_v7', currentMap);
                }
            }
        }

        return { success: true, message: "Perfil atualizado com sucesso!" };
    } catch (e) {
        console.error(e);
        return { success: false, message: "Erro interno." };
    }
};

export const saveSubscription = async (ministryId: string, subscription: PushSubscription): Promise<boolean> => {
    if (!supabase || !ministryId) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    
    try {
        const key = getStorageKey(cleanMid, 'push_subscriptions_v1');
        const { data } = await supabase.from('app_storage').select('value').eq('key', key).single();
        
        let subs: PushSubscriptionRecord[] = data?.value || [];
        subs = subs.filter((s: PushSubscriptionRecord) => s.endpoint !== subscription.endpoint);
        
        const subJson = subscription.toJSON();
        const record: PushSubscriptionRecord = {
            endpoint: subscription.endpoint,
            keys: {
                p256dh: subJson.keys?.p256dh || '',
                auth: subJson.keys?.auth || ''
            },
            device_id: 'browser_' + Date.now(),
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
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const key = getStorageKey(cleanMid, 'notifications_v1');
        const { data } = await supabase.from('app_storage').select('value').eq('key', key).single();
        
        let notifs: AppNotification[] = data?.value || [];
        const newNotif: AppNotification = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            read: false,
            ...notification
        };
        notifs = [newNotif, ...notifs].slice(0, 50);
        await supabase.from('app_storage').upsert({ key, value: notifs }, { onConflict: 'key' });
    } catch (e) {
        console.error("Erro ao enviar notificação", e);
    }
};

export const markNotificationsRead = async (ministryId: string, notificationIds: string[]) => {
    if (!supabase || !ministryId) return [];
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const key = getStorageKey(cleanMid, 'notifications_v1');
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
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const key = getStorageKey(cleanMid, 'notifications_v1');
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
