import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
    SUPABASE_URL, SUPABASE_KEY, PushSubscriptionRecord, User, MemberMap, 
    AppNotification, TeamMemberProfile, AvailabilityMap, SwapRequest, 
    ScheduleMap, RepertoireItem, Announcement, GlobalConflictMap, 
    GlobalConflict, DEFAULT_ROLES 
} from '../types';

let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

export const getStorageKey = (ministryId: string, suffix: string) => `${ministryId}_${suffix}`;

export const getSupabase = () => supabase;

// --- LEGACY KEY-VALUE HELPERS ---
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

// ============================================================================
// MAINTENANCE TOOLS (SIMPLIFIED / NO UI)
// ============================================================================
// As funções de migração e deduplicação foram removidas da UI, 
// mas mantidas no service caso precisem ser chamadas via console/script.

export const removeDuplicateProfiles = async (): Promise<{ success: boolean; message: string }> => {
    if (!supabase) return { success: false, message: "Erro de conexão." };
    try {
        const { data: profiles, error } = await supabase.from('profiles').select('*');
        if (error) throw error;
        if (!profiles || profiles.length === 0) return { success: false, message: "Nenhum perfil encontrado." };

        const emailMap = new Map<string, any[]>();
        profiles.forEach(p => {
            if (p.email) {
                const normalized = p.email.trim().toLowerCase();
                if (!emailMap.has(normalized)) emailMap.set(normalized, []);
                emailMap.get(normalized)?.push(p);
            }
        });

        let mergedCount = 0;
        for (const [email, duplicates] of emailMap.entries()) {
            if (duplicates.length > 1) {
                const sorted = duplicates.sort((a, b) => {
                    if (a.avatar_url && !b.avatar_url) return -1;
                    if (!a.avatar_url && b.avatar_url) return 1;
                    return 0;
                });
                const master = sorted[0];
                const slaves = sorted.slice(1);

                for (const slave of slaves) {
                    await supabase.from('availability').update({ member_id: master.id }).eq('member_id', slave.id);
                    await supabase.from('schedule_assignments').update({ member_id: master.id }).eq('member_id', slave.id);
                    await supabase.from('profiles').delete().eq('id', slave.id);
                    mergedCount++;
                }
            }
        }
        return { success: true, message: `Mesclados ${mergedCount} perfis duplicados.` };
    } catch (e: any) {
        return { success: false, message: "Erro: " + e.message };
    }
};

// ============================================================================
// RELATIONAL DATABASE ADAPTERS
// ============================================================================

export const fetchMinistryMembers = async (ministryId: string): Promise<{ memberMap: MemberMap, publicList: TeamMemberProfile[] }> => {
    if (!supabase || !ministryId) return { memberMap: {}, publicList: [] };
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const validRoles = await loadData<string[]>(cleanMid, 'functions_config', DEFAULT_ROLES[cleanMid] || []);
        const { data: ministryProfiles, error } = await supabase
            .from('profiles')
            .select('*')
            .or(`ministry_id.eq.${cleanMid},allowed_ministries.cs.{${cleanMid}}`);

        if (error) throw error;

        const publicList: TeamMemberProfile[] = (ministryProfiles || []).map((p: any) => ({
            id: p.id,
            name: p.name || 'Membro sem nome',
            email: p.email || undefined,
            whatsapp: p.whatsapp,
            avatar_url: p.avatar_url,
            birthDate: p.birth_date,
            roles: p.functions || [],
            createdAt: new Date().toISOString()
        })).sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));

        const memberMap: MemberMap = {};
        ministryProfiles?.forEach((p: any) => {
            const funcs = p.functions || [];
            const name = p.name || 'Membro sem nome';
            funcs.forEach((role: string) => {
                if (validRoles.includes(role)) { 
                    if (!memberMap[role]) memberMap[role] = [];
                    if (!memberMap[role].includes(name)) {
                        memberMap[role].push(name);
                    }
                }
            });
        });

        return { memberMap, publicList };
    } catch (e) {
        console.error("Erro ao buscar membros:", e);
        return { memberMap: {}, publicList: [] };
    }
};

export const fetchMinistrySchedule = async (ministryId: string, monthIso: string): Promise<{ schedule: ScheduleMap, events: any[] }> => {
    if (!supabase || !ministryId) return { schedule: {}, events: [] };
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const startOfMonth = `${monthIso}-01T00:00:00`;
        const [y, m] = monthIso.split('-').map(Number);
        const nextMonth = new Date(y, m, 1).toISOString().split('T')[0];

        const { data: events, error: eventError } = await supabase
            .from('events')
            .select('id, title, date_time')
            .eq('ministry_id', cleanMid)
            .gte('date_time', startOfMonth)
            .lt('date_time', `${nextMonth}T00:00:00`);

        if (eventError) throw eventError;
        if (!events || events.length === 0) return { schedule: {}, events: [] };

        const eventIds = events.map(e => e.id);
        const { data: assignments, error: assignError } = await supabase
            .from('schedule_assignments')
            .select(`event_id, role, member_id, profiles ( name )`)
            .in('event_id', eventIds);

        if (assignError) throw assignError;

        const schedule: ScheduleMap = {};
        assignments?.forEach((assign: any) => {
            const event = events.find(e => e.id === assign.event_id);
            if (event && assign.profiles) {
                const isoKey = event.date_time.slice(0, 16);
                const scheduleKey = `${isoKey}_${assign.role}`;
                schedule[scheduleKey] = assign.profiles.name;
            }
        });

        const uiEvents = events.map(e => ({
            id: e.id,
            title: e.title,
            date: e.date_time.split('T')[0],
            time: e.date_time.split('T')[1].slice(0, 5)
        }));

        return { schedule, events: uiEvents };
    } catch (e) {
        console.error("Erro ao buscar escala:", e);
        return { schedule: {}, events: [] };
    }
};

export const updateMinistryEvent = async (ministryId: string, oldIso: string, newTitle: string, newIso: string): Promise<boolean> => {
    if (!supabase || !ministryId) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const formatTimestamp = (iso: string) => `${iso}:00`; 

    try {
        const { data: existingEvent } = await supabase
            .from('events')
            .select('id')
            .eq('ministry_id', cleanMid)
            .eq('date_time', formatTimestamp(oldIso))
            .single();

        if (existingEvent) {
            const { error } = await supabase
                .from('events')
                .update({ title: newTitle, date_time: formatTimestamp(newIso) })
                .eq('id', existingEvent.id);
            return !error;
        } else {
            const { error } = await supabase
                .from('events')
                .insert({ ministry_id: cleanMid, title: newTitle, date_time: formatTimestamp(newIso) });
            return !error;
        }
    } catch (e) {
        return false;
    }
};

export const saveScheduleAssignment = async (ministryId: string, key: string, memberName: string): Promise<boolean> => {
    if (!supabase || !ministryId) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const lastUnderscore = key.lastIndexOf('_');
        const isoDate = key.substring(0, lastUnderscore);
        const role = key.substring(lastUnderscore + 1);
        const dateTime = `${isoDate}:00`;

        let eventId = null;
        const { data: eventData } = await supabase
            .from('events')
            .select('id')
            .eq('ministry_id', cleanMid)
            .eq('date_time', dateTime)
            .single();

        if (eventData) {
            eventId = eventData.id;
        } else {
            // Create Event (Heuristic)
            const dateObj = new Date(isoDate);
            const dayOfWeek = dateObj.getDay();
            let title = "Evento Extra";
            if (dayOfWeek === 3) title = "Culto (Quarta)";
            else if (dayOfWeek === 0) title = dateObj.getHours() < 13 ? "Culto (Domingo - Manhã)" : "Culto (Domingo - Noite)";

            const { data: newEvent, error: createError } = await supabase
                .from('events')
                .insert({ ministry_id: cleanMid, title: title, date_time: dateTime })
                .select()
                .single();
            
            if (createError) throw createError;
            eventId = newEvent.id;
        }

        if (!memberName) {
            await supabase.from('schedule_assignments').delete().eq('event_id', eventId).eq('role', role);
            return true;
        }

        const { data: memberData } = await supabase.from('profiles').select('id').ilike('name', memberName).limit(1).single();
        if (!memberData) return false; 

        await supabase.from('schedule_assignments').delete().eq('event_id', eventId).eq('role', role);
        const { error: insertError } = await supabase.from('schedule_assignments').insert({
            event_id: eventId,
            role: role,
            member_id: memberData.id
        });

        return !insertError;
    } catch (e) {
        return false;
    }
};

export const saveScheduleBulk = async (ministryId: string, schedule: ScheduleMap): Promise<boolean> => {
    if (!supabase || !ministryId) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    if (Object.keys(schedule).length === 0) return true;

    try {
        const { data: allMembers } = await supabase
            .from('profiles')
            .select('id, name')
            .or(`ministry_id.eq.${cleanMid},allowed_ministries.cs.{${cleanMid}}`);
            
        const memberMap = new Map<string, string>();
        allMembers?.forEach(m => { if (m.name) memberMap.set(m.name.toLowerCase().trim(), m.id); });

        const neededTimestamps = new Set<string>();
        Object.keys(schedule).forEach(key => {
            const lastUnderscore = key.lastIndexOf('_');
            const isoDate = key.substring(0, lastUnderscore);
            neededTimestamps.add(`${isoDate}:00`);
        });

        const { data: existingEvents } = await supabase
            .from('events')
            .select('id, date_time')
            .eq('ministry_id', cleanMid)
            .in('date_time', Array.from(neededTimestamps));

        const eventIdMap = new Map<string, string>();
        existingEvents?.forEach(e => eventIdMap.set(e.date_time, e.id));

        const eventsToCreate = [];
        for (const ts of neededTimestamps) {
            if (!eventIdMap.has(ts)) {
                eventsToCreate.push({
                    ministry_id: cleanMid,
                    title: "Evento Automático",
                    date_time: ts
                });
            }
        }

        if (eventsToCreate.length > 0) {
            const { data: newEvents } = await supabase.from('events').insert(eventsToCreate).select('id, date_time');
            newEvents?.forEach(e => eventIdMap.set(e.date_time, e.id));
        }

        const assignmentsToUpsert = [];
        for (const [key, memberName] of Object.entries(schedule)) {
            if (!memberName) continue;
            const lastUnderscore = key.lastIndexOf('_');
            const isoDate = key.substring(0, lastUnderscore);
            const role = key.substring(lastUnderscore + 1);
            const ts = `${isoDate}:00`;
            
            const eventId = eventIdMap.get(ts);
            const memberId = memberMap.get(memberName.toLowerCase().trim());
            
            if (eventId && memberId) {
                assignmentsToUpsert.push({ event_id: eventId, role: role, member_id: memberId });
            }
        }

        if (assignmentsToUpsert.length > 0) {
            const { error: upsertError } = await supabase
                .from('schedule_assignments')
                .upsert(assignmentsToUpsert, { onConflict: 'event_id,role' }); 
            
            if (upsertError) {
                for (const item of assignmentsToUpsert) {
                     await supabase.from('schedule_assignments').delete().match({ event_id: item.event_id, role: item.role });
                }
                await supabase.from('schedule_assignments').insert(assignmentsToUpsert);
            }
        }
        return true;
    } catch (e) {
        return false;
    }
}

export const fetchMinistryAvailability = async (ministryId: string): Promise<AvailabilityMap> => {
    if (!supabase || !ministryId) return {};
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const { data: availData } = await supabase
            .from('availability')
            .select(`date, status, member_id, profiles!inner ( id, name, ministry_id, allowed_ministries )`);

        const relevantData = availData?.filter((row: any) => {
            const p = row.profiles;
            return p.ministry_id === cleanMid || (p.allowed_ministries && p.allowed_ministries.includes(cleanMid));
        });

        const availability: AvailabilityMap = {};
        relevantData?.forEach((row: any) => {
            const name = row.profiles.name || 'Membro sem nome';
            if (!availability[name]) availability[name] = [];
            
            let dateStr = row.date;
            if (row.status === 'M') dateStr += '_M';
            else if (row.status === 'N') dateStr += '_N';
            availability[name].push(dateStr);
        });
        return availability;
    } catch (e) {
        return {};
    }
};

export const saveMemberAvailability = async (userId: string, memberName: string, dates: string[]) => {
    if (!supabase) return false;
    try {
        const { data: member } = await supabase.from('profiles').select('id').ilike('name', memberName).single();
        if (!member) return false;

        const rows = dates.map(d => {
            let date = d;
            let status = 'BOTH';
            if (d.endsWith('_M')) { date = d.replace('_M', ''); status = 'M'; }
            else if (d.endsWith('_N')) { date = d.replace('_N', ''); status = 'N'; }
            return { member_id: member.id, date, status };
        });

        await supabase.from('availability').delete().eq('member_id', member.id);
        if (rows.length > 0) await supabase.from('availability').insert(rows);
        return true;
    } catch (e) {
        return false;
    }
};

export const fetchGlobalSchedules = async (currentMonth: string, currentMinistryId: string): Promise<GlobalConflictMap> => {
    if (!supabase) return {};
    const start = `${currentMonth}-01T00:00:00`;
    const [y, m] = currentMonth.split('-').map(Number);
    const nextMonth = new Date(y, m, 1).toISOString().split('T')[0] + 'T00:00:00';

    try {
        const { data } = await supabase
            .from('schedule_assignments')
            .select(`role, events!inner ( date_time, ministry_id ), profiles!inner ( name )`)
            .gte('events.date_time', start)
            .lt('events.date_time', nextMonth)
            .neq('events.ministry_id', currentMinistryId);

        const conflicts: GlobalConflictMap = {};
        data?.forEach((row: any) => {
            const name = row.profiles.name;
            if (!name) return;
            const normalized = name.trim().toLowerCase();
            if (!conflicts[normalized]) conflicts[normalized] = [];
            conflicts[normalized].push({
                ministryId: row.events.ministry_id,
                eventIso: row.events.date_time.slice(0, 16),
                role: row.role
            });
        });
        return conflicts;
    } catch (e) {
        return {};
    }
};

// ============================================================================
// SHARED UTILITIES
// ============================================================================

export const logout = async () => {
    if (supabase) await supabase.auth.signOut();
};

export const loginWithEmail = async (email: string, pass: string) => {
    if (!supabase) return { success: false, message: "Erro conexão" };
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    return { success: !error, message: error?.message || "" };
};

export const loginWithGoogle = async () => {
    if (!supabase) return { success: false, message: "Erro conexão" };
    
    // --- CORREÇÃO DE URL ERRADA / REDIRECT LOOP ---
    // Define a URL Oficial. Se você estiver testando localmente, usa localhost.
    // Qualquer outra URL estranha que o navegador tenha inventado é ignorada.
    const siteUrl = "https://escalaobpcpro.vercel.app";
    const redirectUrl = window.location.hostname === 'localhost' ? 'http://localhost:5173' : siteUrl;

    console.log("Iniciando login Google com redirect para:", redirectUrl);

    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: redirectUrl,
            // Força o login a sempre perguntar a conta se houver bug de sessão presa
            queryParams: { prompt: 'select_account' } 
        }
    });
    return { success: !error, message: error?.message || "" };
};

export const syncMemberProfile = async (ministryId: string, user: User) => {
    if (!supabase || !user.id) return;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const { data: existing } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        const allowed = user.allowedMinistries || [cleanMid];
        if (!allowed.includes(cleanMid)) allowed.push(cleanMid);
        
        let newAllowed = [...allowed];
        let newFunctions = user.functions || [];

        if (existing) {
            newAllowed = [...new Set([...(existing.allowed_ministries || []), ...allowed])];
            newFunctions = [...new Set([...(existing.functions || []), ...newFunctions])];
            
            await supabase.from('profiles').update({
                allowed_ministries: newAllowed,
                functions: newFunctions,
                avatar_url: user.avatar_url || existing.avatar_url,
                whatsapp: existing.whatsapp || user.whatsapp,
                birth_date: existing.birth_date || user.birthDate
            }).eq('id', user.id);
        } else {
            await supabase.from('profiles').insert({
                id: user.id,
                name: user.name || 'Novo Usuário',
                email: user.email,
                ministry_id: cleanMid,
                allowed_ministries: newAllowed,
                functions: newFunctions,
                role: 'member',
                avatar_url: user.avatar_url,
                whatsapp: user.whatsapp
            });
        }
    } catch (e) {
        console.error("Sync profile error:", e);
    }
};

export const registerWithEmail = async (email: string, pass: string, name: string, ministries: string[], whatsapp?: string, roles?: string[]) => {
    if (!supabase) return { success: false, message: "Erro conexão" };
    
    const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
            data: {
                name,
                ministryId: ministries[0] || 'midia',
                allowedMinistries: ministries,
                whatsapp,
                functions: roles
            }
        }
    });

    if (error) return { success: false, message: error.message };

    if (data.user) {
        await syncMemberProfile(ministries[0] || 'midia', {
            id: data.user.id,
            email,
            name,
            role: 'member',
            ministryId: ministries[0],
            allowedMinistries: ministries,
            whatsapp,
            functions: roles
        });
    }
    return { success: true, message: "Conta criada com sucesso!" };
};

export const sendPasswordResetEmail = async (email: string) => {
    if (!supabase) return { success: false, message: "Erro conexão" };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '?reset=true',
    });
    return { success: !error, message: error ? error.message : "Link enviado." };
};

export const updateUserProfile = async (name: string, whatsapp: string, avatar_url?: string, functions?: string[], birthDate?: string, ministryId?: string) => {
    if (!supabase) return { success: false, message: "Erro conexão" };
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Usuário não logado" };

    try {
        const updates: any = { name, whatsapp, avatar_url, functions, birth_date: birthDate };
        await supabase.auth.updateUser({ data: updates });
        const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
        if (error) throw error;
        return { success: true, message: "Perfil atualizado!" };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

export const joinMinistry = async (newMinistryId: string, roles: string[]): Promise<{ success: boolean; message: string }> => {
    if (!supabase) return { success: false, message: "Erro de conexão." };
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Usuário não logado." };

    try {
        const cleanMid = newMinistryId.trim().toLowerCase().replace(/\s+/g, '-');
        const { data: profile } = await supabase.from('profiles').select('allowed_ministries, functions').eq('id', user.id).single();
        if (!profile) return { success: false, message: "Perfil não encontrado." };

        const currentAllowed = profile.allowed_ministries || [];
        if (currentAllowed.includes(cleanMid)) return { success: false, message: "Você já faz parte deste ministério." };

        const newAllowed = [...currentAllowed, cleanMid];
        const newFunctions = [...new Set([...(profile.functions || []), ...roles])];

        await supabase.from('profiles').update({ allowed_ministries: newAllowed, functions: newFunctions }).eq('id', user.id);
        await supabase.auth.updateUser({ data: { allowedMinistries: newAllowed, functions: newFunctions } });

        return { success: true, message: "Bem-vindo ao novo ministério!" };
    } catch (e) {
        return { success: false, message: "Erro ao entrar no ministério." };
    }
};

export const deleteMember = async (ministryId: string, memberId: string, memberName: string) => {
    if (!supabase) return;
    try {
        await supabase.from('availability').delete().eq('member_id', memberId);
        await supabase.from('schedule_assignments').delete().eq('member_id', memberId);
        await supabase.from('profiles').delete().eq('id', memberId);
    } catch (e) {
        console.error("Erro ao deletar membro:", e);
    }
};

export const toggleAdmin = async (ministryId: string, email: string) => {
    if (!supabase || !ministryId) return;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const admins = await loadData<string[]>(cleanMid, 'admins_list', []);
    let newAdmins = admins.includes(email) ? admins.filter(e => e !== email) : [...admins, email];
    await saveData(cleanMid, 'admins_list', newAdmins);
};

export const saveSubscription = async (ministryId: string, sub: PushSubscription) => {
    if (!supabase || !ministryId) return;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const currentSubs = await loadData<PushSubscriptionRecord[]>(cleanMid, 'push_subscriptions_v1', []);
    const subJSON = sub.toJSON();
    const newRecord: PushSubscriptionRecord = {
        endpoint: sub.endpoint,
        keys: { p256dh: subJSON.keys?.p256dh || '', auth: subJSON.keys?.auth || '' },
        device_id: getDeviceId(),
        last_updated: new Date().toISOString()
    };
    const filtered = currentSubs.filter(s => s.device_id !== newRecord.device_id);
    filtered.push(newRecord);
    await saveData(cleanMid, 'push_subscriptions_v1', filtered);
};

const getDeviceId = () => {
    let id = localStorage.getItem('device_id');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('device_id', id); }
    return id;
};

export const sendNotification = async (ministryId: string, payload: { title: string; message: string; type?: string; actionLink?: string }) => {
    if (!supabase) return;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const currentNotifs = await loadData<AppNotification[]>(cleanMid, 'notifications_v1', []);
    const newNotif: AppNotification = {
        id: Date.now().toString(),
        type: (payload.type as any) || 'info',
        title: payload.title,
        message: payload.message,
        timestamp: new Date().toISOString(),
        read: false,
        actionLink: payload.actionLink
    };
    await saveData(cleanMid, 'notifications_v1', [newNotif, ...currentNotifs].slice(0, 50));
    try {
        await supabase.functions.invoke('push-notification', {
            body: { ministryId: cleanMid, title: payload.title, message: payload.message, type: payload.type, actionLink: payload.actionLink }
        });
    } catch (e) { console.error("Erro push:", e); }
};

export const markNotificationsRead = async (ministryId: string, ids: string[]) => {
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const notifs = await loadData<AppNotification[]>(cleanMid, 'notifications_v1', []);
    const updated = notifs.map(n => ids.includes(n.id) ? { ...n, read: true } : n);
    await saveData(cleanMid, 'notifications_v1', updated);
    return updated;
};

export const clearAllNotifications = async (ministryId: string) => {
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    await saveData(cleanMid, 'notifications_v1', []);
};

export const createSwapRequest = async (ministryId: string, request: SwapRequest) => {
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const requests = await loadData<SwapRequest[]>(cleanMid, 'swap_requests_v1', []);
    requests.unshift(request);
    return await saveData(cleanMid, 'swap_requests_v1', requests);
};

export const performSwap = async (ministryId: string, requestId: string, takerName: string, takerId: string) => {
    if (!supabase) return { success: false, message: "Erro conexão" };
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    
    const requests = await loadData<SwapRequest[]>(cleanMid, 'swap_requests_v1', []);
    const reqIndex = requests.findIndex(r => r.id === requestId);
    if (reqIndex === -1) return { success: false, message: "Não encontrado" };
    
    const req = requests[reqIndex];
    req.status = 'completed';
    req.takenByName = takerName;
    requests[reqIndex] = req;
    await saveData(cleanMid, 'swap_requests_v1', requests);

    const dateTime = `${req.eventIso}:00`;
    const { data: event } = await supabase.from('events').select('id').eq('ministry_id', cleanMid).eq('date_time', dateTime).single();
    if (!event) return { success: false, message: "Evento não encontrado" };

    await supabase.from('schedule_assignments').delete().eq('event_id', event.id).eq('role', req.role);
    await supabase.from('schedule_assignments').insert({ event_id: event.id, role: req.role, member_id: takerId });

    await sendNotification(ministryId, { type: 'success', title: 'Troca Realizada', message: `${takerName} assumiu a escala de ${req.requesterName}.` });
    return { success: true, message: "Troca realizada!" };
};

export const createAnnouncement = async (ministryId: string, data: Omit<Announcement, 'id' | 'timestamp' | 'readBy' | 'likedBy' | 'author'>, authorName: string) => {
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const announcements = await loadData<Announcement[]>(cleanMid, 'announcements_v1', []);
    const newAnn: Announcement = { id: Date.now().toString(), timestamp: new Date().toISOString(), readBy: [], likedBy: [], author: authorName, ...data };
    announcements.unshift(newAnn);
    return await saveData(cleanMid, 'announcements_v1', announcements);
};

export const markAnnouncementRead = async (ministryId: string, id: string, user: User) => {
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const list = await loadData<Announcement[]>(cleanMid, 'announcements_v1', []);
    const updated = list.map(a => {
        if (a.id === id && !a.readBy.some(r => r.userId === user.id)) {
            return { ...a, readBy: [...a.readBy, { userId: user.id || 'anon', name: user.name, timestamp: new Date().toISOString() }] };
        }
        return a;
    });
    await saveData(cleanMid, 'announcements_v1', updated);
    return updated;
};

export const toggleAnnouncementLike = async (ministryId: string, id: string, user: User) => {
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const list = await loadData<Announcement[]>(cleanMid, 'announcements_v1', []);
    const updated = list.map(a => {
        if (a.id === id) {
            const hasLiked = a.likedBy?.some(l => l.userId === user.id);
            let newLikes = a.likedBy || [];
            if (hasLiked) newLikes = newLikes.filter(l => l.userId !== user.id);
            else newLikes = [...newLikes, { userId: user.id || 'anon', name: user.name, timestamp: new Date().toISOString() }];
            return { ...a, likedBy: newLikes };
        }
        return a;
    });
    await saveData(cleanMid, 'announcements_v1', updated);
    return updated;
};
