import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY, PushSubscriptionRecord, User, MemberMap, DEFAULT_ROLES, AppNotification, TeamMemberProfile, AvailabilityMap, SwapRequest, ScheduleMap, RepertoireItem, Announcement, GlobalConflictMap, KNOWN_MINISTRIES, GlobalConflict } from '../types';

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

// --- Global Conflict Detection ---

export const fetchGlobalSchedules = async (currentMonth: string, currentMinistryId: string): Promise<GlobalConflictMap> => {
    if (!supabase || !currentMinistryId) return {};
    
    const cleanCurrentMid = currentMinistryId.trim().toLowerCase().replace(/\s+/g, '-');
    const conflictMap: GlobalConflictMap = {};

    // Filtra ministérios para não buscar o atual
    const targetMinistries = KNOWN_MINISTRIES.filter(m => m !== cleanCurrentMid);

    // Busca escalas em paralelo
    const promises = targetMinistries.map(async (mid) => {
        const schedule = await loadData<ScheduleMap>(mid, `schedule_${currentMonth}`, {});
        return { mid, schedule };
    });

    const results = await Promise.all(promises);

    // Processa os resultados
    results.forEach(({ mid, schedule }) => {
        Object.entries(schedule).forEach(([key, memberName]) => {
            if (!memberName) return;

            // Key format: YYYY-MM-DDTHH:mm_Role
            const [isoDate, role] = key.split('_');
            const normalizedName = memberName.trim().toLowerCase();

            if (!conflictMap[normalizedName]) {
                conflictMap[normalizedName] = [];
            }

            conflictMap[normalizedName].push({
                ministryId: mid,
                eventIso: isoDate,
                role: role
            });
        });
    });

    return conflictMap;
};

// --- Admin Management ---

export const toggleAdmin = async (ministryId: string, email: string): Promise<{ success: boolean; isAdmin: boolean }> => {
    if (!supabase || !ministryId) return { success: false, isAdmin: false };
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const admins = await loadData<string[]>(cleanMid, 'admins_list', []);
        let newAdmins = [...admins];
        let isAdmin = false;

        if (newAdmins.includes(email)) {
            newAdmins = newAdmins.filter(e => e !== email);
            isAdmin = false;
        } else {
            newAdmins.push(email);
            isAdmin = true;
        }

        await saveData(cleanMid, 'admins_list', newAdmins);
        return { success: true, isAdmin };
    } catch (e) {
        console.error("Erro ao alterar admin", e);
        return { success: false, isAdmin: false };
    }
};

// --- Member Directory Sync ---

export const syncMemberProfile = async (ministryId: string, user: User) => {
    if (!supabase || !ministryId) return [];
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    
    try {
        const storageKey = getStorageKey(cleanMid, 'public_members_list');
        const { data } = await supabase.from('app_storage').select('value').eq('key', storageKey).single();
        let list: TeamMemberProfile[] = data?.value || [];

        const newProfile: TeamMemberProfile = {
            id: user.id || Date.now().toString(),
            name: user.name,
            email: user.email,
            whatsapp: user.whatsapp,
            birthDate: user.birthDate,
            avatar_url: user.avatar_url,
            roles: user.functions || [], // Note: functions here might be ministry-specific in advanced scenarios, but for now it syncs all
            createdAt: new Date().toISOString()
        };

        // Procura por ID ou Email para atualizar
        const index = list.findIndex(m => 
            (m.id && user.id && m.id === user.id) || 
            (m.email && user.email && m.email === user.email)
        );
        
        let newList = [...list];

        if (index >= 0) {
            // Merge cuidadoso para não perder dados
            newList[index] = { 
                ...newList[index], 
                ...newProfile,
                id: user.id || newList[index].id // Garante que o ID do Auth sobrescreva IDs manuais antigos
            }; 
        } else {
            newList.push(newProfile);
        }
        
        newList.sort((a, b) => a.name.localeCompare(b.name));
        
        await supabase.from('app_storage').upsert({ key: storageKey, value: newList }, { onConflict: 'key' });
        return newList;

    } catch (e) {
        console.error("Error syncing profile", e);
        return [];
    }
};

export const deleteMember = async (ministryId: string, memberId: string, memberName: string): Promise<boolean> => {
    if (!supabase || !ministryId) return false;

    try {
        // 1. Remove da Lista Pública de Membros (Visual)
        const list = await loadData<TeamMemberProfile[]>(ministryId, 'public_members_list', []);
        const newList = list.filter(m => {
            if (memberId && memberId !== 'manual') return m.id !== memberId;
            return m.name !== memberName;
        });
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

// --- Swap Logic ---

export const createSwapRequest = async (ministryId: string, request: SwapRequest): Promise<boolean> => {
    if (!supabase || !ministryId) return false;
    try {
        const requests = await loadData<SwapRequest[]>(ministryId, 'swap_requests_v1', []);
        const newRequests = [request, ...requests];
        return await saveData(ministryId, 'swap_requests_v1', newRequests);
    } catch (e) {
        console.error("Error creating swap request", e);
        return false;
    }
};

export const performSwap = async (
    ministryId: string, 
    requestId: string, 
    acceptingMemberName: string,
    acceptingMemberId?: string
): Promise<{ success: boolean; message: string }> => {
    if (!supabase || !ministryId) return { success: false, message: "Erro de conexão" };
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        // 1. Carrega os Pedidos
        const requests = await loadData<SwapRequest[]>(cleanMid, 'swap_requests_v1', []);
        const requestIndex = requests.findIndex(r => r.id === requestId);
        
        if (requestIndex < 0) return { success: false, message: "Solicitação não encontrada." };
        
        const request = requests[requestIndex];
        if (request.status !== 'pending') return { success: false, message: "Esta solicitação já foi processada." };

        // 2. Carrega a Escala do Mês do Evento
        const eventMonth = request.eventIso.slice(0, 7); // YYYY-MM
        const scheduleKey = `schedule_${eventMonth}`;
        const schedule = await loadData<ScheduleMap>(cleanMid, scheduleKey, {});
        
        const slotKey = `${request.eventIso}_${request.role}`;
        const currentAssigned = schedule[slotKey];

        // 3. Valida se o membro original ainda está na escala
        if (currentAssigned !== request.requesterName) {
            return { 
                success: false, 
                message: "A escala mudou e o membro original não está mais nela. Troca cancelada." 
            };
        }

        // 4. Realiza a Troca
        schedule[slotKey] = acceptingMemberName;
        
        // 5. Atualiza o Pedido
        requests[requestIndex] = {
            ...request,
            status: 'completed',
            takenByName: acceptingMemberName
        };

        // 6. Salva Tudo
        const saveSchedule = await saveData(cleanMid, scheduleKey, schedule);
        const saveRequests = await saveData(cleanMid, 'swap_requests_v1', requests);

        if (saveSchedule && saveRequests) {
            // Notifica
            await sendNotification(cleanMid, {
                type: 'success',
                title: 'Troca de Escala Realizada',
                message: `${acceptingMemberName} assumiu a escala de ${request.requesterName} para ${request.eventTitle}.`
            });
            return { success: true, message: "Troca realizada com sucesso!" };
        } else {
            return { success: false, message: "Erro ao salvar dados." };
        }

    } catch (e) {
        console.error("Error performing swap", e);
        return { success: false, message: "Erro interno no servidor." };
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
            // Se tiver múltiplos ministérios, pega o primeiro, senão usa o padrão legado
            const allowedMinistries = metadata.allowedMinistries || (metadata.ministryId ? [metadata.ministryId] : []);
            const cleanMid = allowedMinistries.length > 0 
                ? allowedMinistries[0].trim().toLowerCase().replace(/\s+/g, '-') 
                : 'midia';
            
            const userProfile: User = {
                id: data.user.id,
                email: data.user.email,
                name: metadata.name || 'Usuário',
                role: metadata.role || 'member',
                ministryId: cleanMid, 
                allowedMinistries: allowedMinistries,
                whatsapp: metadata.whatsapp,
                birthDate: metadata.birthDate,
                avatar_url: metadata.avatar_url,
                functions: metadata.functions || []
            };

            // Sincroniza em todos os ministérios permitidos
            if (allowedMinistries.length > 0) {
                for (const mid of allowedMinistries) {
                    await syncMemberProfile(mid, userProfile);
                }
            }

            return { success: true, message: "Login realizado.", user: userProfile, ministryId: cleanMid };
        }
        
        return { success: false, message: "Erro desconhecido." };
    } catch (e) {
        console.error(e);
        return { success: false, message: "Erro interno." };
    }
};

export const loginWithGoogle = async (): Promise<{ success: boolean; message: string }> => {
    if (!supabase) return { success: false, message: "Erro de conexão" };
    try {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
                queryParams: {
                    prompt: 'select_account', // Força o Google a perguntar qual conta usar (evita loop na conta errada)
                    access_type: 'offline'
                }
            },
        });

        if (error) return { success: false, message: error.message };
        return { success: true, message: "Redirecionando..." };
    } catch (e) {
        console.error(e);
        return { success: false, message: "Erro interno." };
    }
};

export const registerWithEmail = async (
    email: string,
    password: string,
    name: string,
    ministries: string[], // Alterado para array
    whatsapp?: string,
    selectedRoles?: string[]
): Promise<{ success: boolean; message: string }> => {
    if (!supabase) return { success: false, message: "Erro de conexão" };

    try {
        const cleanMinistries = ministries.map(m => m.trim().toLowerCase().replace(/\s+/g, '-'));
        const mainMinistry = cleanMinistries[0];

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name,
                    ministryId: mainMinistry, // Legado (para compatibilidade)
                    allowedMinistries: cleanMinistries, // Novo: Array de acesso
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
                ministryId: mainMinistry,
                allowedMinistries: cleanMinistries,
                whatsapp: whatsapp,
                functions: selectedRoles || []
            };
            
            // Sincroniza o membro em TODOS os ministérios selecionados
            for (const mid of cleanMinistries) {
                await syncMemberProfile(mid, userProfile);
                
                // Notifica em cada um
                await sendNotification(mid, {
                    type: 'info',
                    title: 'Novo Membro Cadastrado',
                    message: `${name} acabou de se cadastrar na equipe.`,
                    actionLink: 'team' 
                });
            }

            // (Opcional) Adiciona roles apenas no ministério principal ou tenta distribuir?
            // Por simplicidade, vamos adicionar as funções no primeiro ministério selecionado
            if (selectedRoles && selectedRoles.length > 0 && mainMinistry) {
                const currentRoles = await loadData<MemberMap>(mainMinistry, 'members_v7', {});
                let rolesChanged = false;
                
                selectedRoles.forEach(role => {
                    if (!currentRoles[role]) currentRoles[role] = [];
                    if (!currentRoles[role].includes(name)) {
                        currentRoles[role].push(name);
                        rolesChanged = true;
                    }
                });
                
                if (rolesChanged) {
                    await saveData(mainMinistry, 'members_v7', currentRoles);
                }
            }
        }

        return { success: true, message: "Cadastro realizado com sucesso!" };
    } catch (e) {
        console.error(e);
        return { success: false, message: "Erro interno." };
    }
};

// --- JOIN NEW MINISTRY (Multi-Tenancy Addition) ---
export const joinMinistry = async (newMinistryId: string, roles: string[]): Promise<{ success: boolean; message: string }> => {
    if (!supabase) return { success: false, message: "Erro de conexão" };

    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) return { success: false, message: "Usuário não autenticado." };

        const cleanMid = newMinistryId.trim().toLowerCase().replace(/\s+/g, '-');
        const currentAllowed = user.user_metadata.allowedMinistries || [user.user_metadata.ministryId];
        
        if (currentAllowed.includes(cleanMid)) {
            return { success: false, message: "Você já faz parte deste ministério." };
        }

        const newAllowed = [...currentAllowed, cleanMid];

        // 1. Atualizar Metadados do Usuário (Auth)
        const { error: updateError } = await supabase.auth.updateUser({
            data: {
                allowedMinistries: newAllowed
            }
        });

        if (updateError) return { success: false, message: updateError.message };

        // 2. Sincronizar Perfil no Novo Ministério
        const userProfile: User = {
            id: user.id,
            email: user.email,
            name: user.user_metadata.name,
            role: user.user_metadata.role || 'member',
            ministryId: cleanMid, // Contexto atual da operação
            allowedMinistries: newAllowed,
            whatsapp: user.user_metadata.whatsapp,
            birthDate: user.user_metadata.birthDate,
            avatar_url: user.user_metadata.avatar_url,
            functions: roles // Funções específicas para este novo ministério
        };

        await syncMemberProfile(cleanMid, userProfile);

        // 3. Adicionar Funções Específicas no Novo Ministério
        if (roles && roles.length > 0) {
            const currentRoles = await loadData<MemberMap>(cleanMid, 'members_v7', {});
            let rolesChanged = false;
            
            roles.forEach(role => {
                if (!currentRoles[role]) currentRoles[role] = [];
                if (!currentRoles[role].includes(userProfile.name)) {
                    currentRoles[role].push(userProfile.name);
                    rolesChanged = true;
                }
            });
            
            if (rolesChanged) {
                await saveData(cleanMid, 'members_v7', currentRoles);
            }
        }

        // 4. Notificar
        await sendNotification(cleanMid, {
            type: 'info',
            title: 'Novo Membro',
            message: `${userProfile.name} entrou na equipe.`,
            actionLink: 'team'
        });

        return { success: true, message: "Você entrou no novo ministério com sucesso!" };

    } catch (e) {
        console.error("Erro ao entrar em ministério", e);
        return { success: false, message: "Erro interno." };
    }
};

export const sendPasswordResetEmail = async (email: string): Promise<{ success: boolean; message: string }> => {
    if (!supabase) return { success: false, message: "Erro de conexão" };
    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin
        });
        if (error) return { success: false, message: error.message };
        return { success: true, message: "Email de recuperação enviado! Verifique sua caixa de entrada." };
    } catch (e) {
        console.error(e);
        return { success: false, message: "Erro ao enviar email." };
    }
}

export const logout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
};

export const updateUserProfile = async (
    name: string, 
    whatsapp: string, 
    avatar_url?: string, 
    functions?: string[],
    birthDate?: string,
    currentMinistryId?: string // Parametro opcional para garantir sync no contexto atual
): Promise<{ success: boolean; message: string }> => {
    if (!supabase) return { success: false, message: "Erro de conexão" };

    try {
        // 1. Get current user state (includes metadata BEFORE update)
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) return { success: false, message: "Usuário não autenticado." };

        // Save old name for cleanup later
        const oldName = user.user_metadata.name;

        // 2. Prepare Updates
        const updates: any = {
            data: {
                name,
                whatsapp,
                avatar_url,
                birthDate,
                functions
            }
        };

        const cleanCurrentMid = currentMinistryId ? currentMinistryId.trim().toLowerCase().replace(/\s+/g, '-') : null;
        let finalAllowedMinistries = user.user_metadata.allowedMinistries || [];

        // Fix for manual users or missing ministry association
        // We force currentMinistryId into allowedMinistries if it's missing, to ensure sync works.
        if (cleanCurrentMid) {
            if (!finalAllowedMinistries.includes(cleanCurrentMid)) {
                finalAllowedMinistries = [...finalAllowedMinistries, cleanCurrentMid];
                updates.data.allowedMinistries = finalAllowedMinistries;
            }
            // If main ministry ID is missing, set it to current
            if (!user.user_metadata.ministryId) {
                updates.data.ministryId = cleanCurrentMid;
            }
        }

        // 3. Apply Updates to Auth
        const { error: updateError } = await supabase.auth.updateUser(updates);
        if (updateError) return { success: false, message: "Erro ao atualizar perfil." };

        // 4. Construct the full user profile object for syncing
        const updatedProfile: User = {
            id: user.id,
            email: user.email,
            name: name,
            role: user.user_metadata.role || 'member',
            ministryId: cleanCurrentMid || user.user_metadata.ministryId || finalAllowedMinistries[0],
            allowedMinistries: finalAllowedMinistries,
            whatsapp: whatsapp,
            birthDate: birthDate,
            avatar_url: avatar_url,
            functions: functions || []
        };

        // 5. Sync with Public Member Lists (Visual Directory)
        // Ensure we sync to the current ministry even if metadata was lagging/empty
        const ministriesToSync = new Set([...finalAllowedMinistries]);
        if (cleanCurrentMid) ministriesToSync.add(cleanCurrentMid);

        for (const mid of ministriesToSync) {
            if (mid) await syncMemberProfile(mid, updatedProfile);
        }

        // 6. Sync Roles Map (members_v7) - Crucial for Schedule Dropdowns
        // Only for current ministry context
        if (cleanCurrentMid && functions) {
             const memberMap = await loadData<MemberMap>(cleanCurrentMid, 'members_v7', {});
             let mapChanged = false;

             // Logic to ensure user is in the lists for their selected functions
             Object.keys(memberMap).forEach(role => {
                 const members = memberMap[role];
                 
                 // 6a. CLEANUP OLD NAME if name changed
                 if (oldName && oldName !== name && members.includes(oldName)) {
                     memberMap[role] = members.filter(m => m !== oldName);
                     mapChanged = true;
                 }
                 
                 // 6b. Update lists based on selected functions
                 if (functions.includes(role)) {
                     // Should be in list
                     if (!memberMap[role].includes(name)) {
                         memberMap[role].push(name);
                         mapChanged = true;
                     }
                 } else {
                     // Should NOT be in list (if they were previously added under current name)
                     if (memberMap[role].includes(name)) {
                         memberMap[role] = memberMap[role].filter(m => m !== name);
                         mapChanged = true;
                     }
                 }
             });

             // Ensure all selected functions exist as keys (create new roles if needed)
             functions.forEach(role => {
                 if (!memberMap[role]) {
                     memberMap[role] = [name];
                     mapChanged = true;
                 } else if (!memberMap[role].includes(name)) {
                     memberMap[role].push(name);
                     mapChanged = true;
                 }
             });

             if (mapChanged) {
                 await saveData(cleanCurrentMid, 'members_v7', memberMap);
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
        // 1. Salva notificação no banco para aparecer no "sininho"
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

        // 2. Dispara a Edge Function para enviar PUSH real (celular fechado)
        // Isso só funciona se você tiver feito o deploy da função no Supabase
        const { error } = await supabase.functions.invoke('push-notification', {
            body: {
                ministryId: cleanMid,
                title: notification.title,
                message: notification.message,
                type: notification.type
            }
        });

        if (error) {
            console.warn("Backend de Push não configurado ou erro:", error.message);
        } else {
            console.log("Push disparado com sucesso!");
        }

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

// --- ANNOUNCEMENTS (CARDS) LOGIC ---

export const createAnnouncement = async (ministryId: string, announcement: Omit<Announcement, 'id' | 'timestamp' | 'readBy' | 'author' | 'likedBy'>, authorName: string): Promise<boolean> => {
    if (!supabase || !ministryId) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const key = getStorageKey(cleanMid, 'announcements_v1');

    try {
        const { data } = await supabase.from('app_storage').select('value').eq('key', key).single();
        let list: Announcement[] = data?.value || [];

        const newAnnouncement: Announcement = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            readBy: [],
            likedBy: [], // Inicializa lista de curtidas
            author: authorName,
            ...announcement
        } as Announcement;

        // Mantém apenas os últimos 20 comunicados para não pesar
        list = [newAnnouncement, ...list].slice(0, 20);

        const { error } = await supabase.from('app_storage').upsert({ key, value: list }, { onConflict: 'key' });
        return !error;
    } catch (e) {
        console.error("Erro ao criar comunicado", e);
        return false;
    }
};

export const markAnnouncementRead = async (ministryId: string, announcementId: string, user: User): Promise<Announcement[]> => {
    if (!supabase || !ministryId || !user.id) return [];
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const key = getStorageKey(cleanMid, 'announcements_v1');

    try {
        const { data } = await supabase.from('app_storage').select('value').eq('key', key).single();
        let list: Announcement[] = data?.value || [];

        let updated = false;
        list = list.map(a => {
            if (a.id === announcementId) {
                // Verifica se já leu
                const alreadyRead = a.readBy.some(reader => reader.userId === user.id);
                if (!alreadyRead) {
                    updated = true;
                    return {
                        ...a,
                        readBy: [...a.readBy, { userId: user.id!, name: user.name, timestamp: new Date().toISOString() }]
                    };
                }
            }
            return a;
        });

        if (updated) {
            await supabase.from('app_storage').upsert({ key, value: list }, { onConflict: 'key' });
        }
        return list;

    } catch (e) {
        console.error("Erro ao marcar comunicado como lido", e);
        return [];
    }
};

export const toggleAnnouncementLike = async (ministryId: string, announcementId: string, user: User): Promise<Announcement[]> => {
    if (!supabase || !ministryId || !user.id) return [];
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const key = getStorageKey(cleanMid, 'announcements_v1');

    try {
        const { data } = await supabase.from('app_storage').select('value').eq('key', key).single();
        let list: Announcement[] = data?.value || [];

        let updated = false;
        list = list.map(a => {
            if (a.id === announcementId) {
                updated = true;
                const likedList = a.likedBy || [];
                const alreadyLiked = likedList.some(liker => liker.userId === user.id);
                
                if (alreadyLiked) {
                    // Remover curtida
                    return {
                        ...a,
                        likedBy: likedList.filter(liker => liker.userId !== user.id)
                    };
                } else {
                    // Adicionar curtida
                    return {
                        ...a,
                        likedBy: [...likedList, { userId: user.id!, name: user.name, timestamp: new Date().toISOString() }]
                    };
                }
            }
            return a;
        });

        if (updated) {
            await supabase.from('app_storage').upsert({ key, value: list }, { onConflict: 'key' });
        }
        return list;

    } catch (e) {
        console.error("Erro ao curtir comunicado", e);
        return [];
    }
};