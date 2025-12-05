import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY, PushSubscriptionRecord, User, MemberMap, DEFAULT_ROLES, AppNotification, TeamMemberProfile, AvailabilityMap, SwapRequest, ScheduleMap, RepertoireItem, Announcement } from '../types';

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
            avatar_url: user.avatar_url,
            roles: user.functions || [],
            createdAt: new Date().toISOString()
        };

        const index = list.findIndex(m => 
            (m.id && user.id && m.id === user.id) || 
            (m.email && user.email && m.email === user.email)
        );
        
        let newList = [...list];

        if (index >= 0) {
            newList[index] = { ...newList[index], ...newProfile }; 
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
            
            await syncMemberProfile(cleanMid, userProfile);

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

            if (functions) {
                const currentMap = await loadData<MemberMap>(ministryId, 'members_v7', {});
                let mapChanged = false;

                Object.keys(currentMap).forEach(role => {
                    if (currentMap[role].includes(name)) {
                        currentMap[role] = currentMap[role].filter(n => n !== name);
                        mapChanged = true;
                    }
                });

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

export const createAnnouncement = async (ministryId: string, announcement: Omit<Announcement, 'id' | 'timestamp' | 'readBy' | 'author'>, authorName: string): Promise<boolean> => {
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
