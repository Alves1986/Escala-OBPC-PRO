import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
    SUPABASE_URL, SUPABASE_KEY, PushSubscriptionRecord, User, MemberMap, 
    AppNotification, TeamMemberProfile, AvailabilityMap, SwapRequest, 
    ScheduleMap, RepertoireItem, Announcement, GlobalConflictMap, 
    GlobalConflict, DEFAULT_ROLES, AttendanceMap, AuditLogEntry 
} from '../types';

let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

export const getSupabase = () => supabase;

// ============================================================================
// SQL DATABASE ADAPTERS (NEW SYSTEM)
// ============================================================================

// --- AUDIT LOGS ---
export const fetchAuditLogs = async (ministryId: string): Promise<AuditLogEntry[]> => {
    if (!supabase || !ministryId) return [];
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    try {
        const { data } = await supabase
            .from('audit_logs')
            .select('*')
            .eq('ministry_id', cleanMid)
            .order('created_at', { ascending: false })
            .limit(100);
            
        return (data || []).map((row: any) => ({
            id: row.id,
            date: new Date(row.created_at).toLocaleString('pt-BR'),
            action: row.action,
            details: row.details
        }));
    } catch (e) {
        return [];
    }
};

export const logActionSQL = async (ministryId: string, action: string, details: string) => {
    if (!supabase || !ministryId) return;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    await supabase.from('audit_logs').insert({
        ministry_id: cleanMid,
        action,
        details
    });
};

// --- SETTINGS (Roles & Title) ---
export const fetchMinistrySettings = async (ministryId: string): Promise<{ displayName: string, roles: string[] }> => {
    if (!supabase || !ministryId) return { displayName: '', roles: [] };
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const { data } = await supabase
            .from('ministry_settings')
            .select('*')
            .eq('ministry_id', cleanMid)
            .single();

        return { 
            displayName: data?.display_name || '', 
            roles: (data?.roles && data.roles.length > 0) ? data.roles : (DEFAULT_ROLES[cleanMid] || DEFAULT_ROLES['default'])
        };
    } catch (e) {
        return { displayName: '', roles: DEFAULT_ROLES[cleanMid] || [] };
    }
};

export const saveMinistrySettings = async (ministryId: string, displayName?: string, roles?: string[]) => {
    if (!supabase || !ministryId) return;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    const updates: any = { ministry_id: cleanMid };
    if (displayName !== undefined) updates.display_name = displayName;
    if (roles !== undefined) updates.roles = roles;

    const { error } = await supabase.from('ministry_settings').upsert(updates, { onConflict: 'ministry_id' });
    if (error) console.error("Error saving settings:", error);
};

// --- REPERTOIRE ---
export const fetchRepertoire = async (ministryId: string): Promise<RepertoireItem[]> => {
    if (!supabase) return [];
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    
    try {
        const { data } = await supabase
            .from('repertoire')
            .select('*')
            .or(`ministry_id.eq.${cleanMid},ministry_id.eq.shared`)
            .order('event_date', { ascending: false });

        return (data || []).map((row: any) => ({
            id: row.id,
            title: row.title,
            link: row.link || '',
            date: row.event_date,
            addedBy: row.added_by,
            createdAt: row.created_at
        }));
    } catch (e) {
        return [];
    }
};

export const addToRepertoire = async (ministryId: string, item: Omit<RepertoireItem, 'id' | 'createdAt'>) => {
    if (!supabase) return;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    await supabase.from('repertoire').insert({
        ministry_id: cleanMid,
        title: item.title,
        link: item.link,
        event_date: item.date,
        added_by: item.addedBy
    });
};

export const deleteFromRepertoire = async (id: string) => {
    if (!supabase) return;
    await supabase.from('repertoire').delete().eq('id', id);
};

// --- SWAP REQUESTS ---
export const fetchSwapRequests = async (ministryId: string): Promise<SwapRequest[]> => {
    if (!supabase || !ministryId) return [];
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    try {
        const { data } = await supabase
            .from('swap_requests')
            .select('*')
            .eq('ministry_id', cleanMid)
            .order('created_at', { ascending: false });

        return (data || []).map((row: any) => ({
            id: row.id,
            ministryId: row.ministry_id,
            requesterName: row.requester_name,
            requesterId: row.requester_id,
            role: row.role,
            eventIso: row.event_iso ? new Date(row.event_iso).toISOString().slice(0,16) : '',
            eventTitle: row.event_title,
            status: row.status,
            createdAt: row.created_at,
            takenByName: row.taken_by_name
        }));
    } catch (e) {
        return [];
    }
};

export const createSwapRequestSQL = async (ministryId: string, req: SwapRequest) => {
    if (!supabase) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const { error } = await supabase.from('swap_requests').insert({
        ministry_id: cleanMid,
        requester_id: req.requesterId,
        requester_name: req.requesterName,
        role: req.role,
        event_iso: req.eventIso + ":00", 
        event_title: req.eventTitle,
        status: 'pending'
    });
    return !error;
};

export const performSwapSQL = async (ministryId: string, requestId: string, takerName: string, takerId: string) => {
    if (!supabase) return { success: false, message: "Erro conexão" };
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    
    // 1. Get Request
    const { data: req } = await supabase.from('swap_requests').select('*').eq('id', requestId).single();
    if (!req || req.status !== 'pending') return { success: false, message: "Solicitação inválida ou já aceita." };

    // 2. Update Request Status
    await supabase.from('swap_requests').update({
        status: 'completed',
        taken_by_id: takerId,
        taken_by_name: takerName
    }).eq('id', requestId);

    // 3. Update Schedule
    const isoString = new Date(req.event_iso).toISOString().slice(0, 16) + ":00";

    const { data: event } = await supabase
        .from('events')
        .select('id')
        .eq('ministry_id', cleanMid)
        .eq('date_time', isoString)
        .limit(1)
        .single();

    if (event) {
        // Remove old assignment
        await supabase.from('schedule_assignments').delete().match({ event_id: event.id, role: req.role });
        // Add new assignment
        await supabase.from('schedule_assignments').insert({
            event_id: event.id,
            role: req.role,
            member_id: takerId
        });
    }

    await sendNotificationSQL(cleanMid, {
        type: 'success',
        title: 'Troca Realizada',
        message: `${takerName} assumiu a escala de ${req.requester_name} em ${req.event_title}.`
    });

    return { success: true, message: "Troca realizada!" };
};

// --- NOTIFICATIONS ---
export const fetchNotificationsSQL = async (ministryId: string, userId: string): Promise<AppNotification[]> => {
    if (!supabase) return [];
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    try {
        const { data } = await supabase
            .from('notifications')
            .select('*')
            .eq('ministry_id', cleanMid)
            .order('created_at', { ascending: false })
            .limit(50);

        return (data || []).map((row: any) => ({
            id: row.id,
            type: row.type as any,
            title: row.title,
            message: row.message,
            timestamp: row.created_at,
            read: (row.read_by || []).includes(userId),
            actionLink: row.action_link
        }));
    } catch (e) {
        return [];
    }
};

export const sendNotificationSQL = async (ministryId: string, payload: { title: string; message: string; type?: string; actionLink?: string }) => {
    if (!supabase) return;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    
    // 1. Insert into SQL
    await supabase.from('notifications').insert({
        ministry_id: cleanMid,
        title: payload.title,
        message: payload.message,
        type: payload.type || 'info',
        action_link: payload.actionLink
    });

    // 2. Call Edge Function for Push
    try {
        await supabase.functions.invoke('push-notification', {
            body: { ministryId: cleanMid, ...payload }
        });
    } catch (e) { /* ignore */ }
};

export const markNotificationsReadSQL = async (ids: string[], userId: string) => {
    if (!supabase) return;
    
    for (const id of ids) {
        const { data } = await supabase.from('notifications').select('read_by').eq('id', id).single();
        const currentRead = data?.read_by || [];
        if (!currentRead.includes(userId)) {
            await supabase.from('notifications').update({
                read_by: [...currentRead, userId]
            }).eq('id', id);
        }
    }
};

export const clearAllNotificationsSQL = async (ministryId: string) => {
    if (!supabase || !ministryId) return;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    await supabase.from('notifications').delete().eq('ministry_id', cleanMid);
};

// --- ANNOUNCEMENTS ---
export const fetchAnnouncementsSQL = async (ministryId: string): Promise<Announcement[]> => {
    if (!supabase) return [];
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    try {
        const { data } = await supabase
            .from('announcements')
            .select(`
                *,
                announcement_interactions (
                    user_id, user_name, interaction_type, created_at
                )
            `)
            .eq('ministry_id', cleanMid)
            .order('created_at', { ascending: false });

        return (data || []).map((row: any) => {
            const interactions = row.announcement_interactions || [];
            return {
                id: row.id,
                title: row.title,
                message: row.message,
                type: row.type as any,
                timestamp: row.created_at,
                expirationDate: row.expiration_date,
                author: row.author_name || 'Admin',
                readBy: interactions.filter((i: any) => i.interaction_type === 'read').map((i: any) => ({ userId: i.user_id, name: i.user_name, timestamp: i.created_at })),
                likedBy: interactions.filter((i: any) => i.interaction_type === 'like').map((i: any) => ({ userId: i.user_id, name: i.user_name, timestamp: i.created_at })),
            };
        });
    } catch (e) {
        return [];
    }
};

export const createAnnouncementSQL = async (ministryId: string, data: any, authorName: string) => {
    if (!supabase) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const { error } = await supabase.from('announcements').insert({
        ministry_id: cleanMid,
        title: data.title,
        message: data.message,
        type: data.type,
        expiration_date: data.expirationDate,
        author_name: authorName
    });
    return !error;
};

export const interactAnnouncementSQL = async (announcementId: string, userId: string, userName: string, type: 'read' | 'like') => {
    if (!supabase) return;
    
    if (type === 'read') {
        await supabase.from('announcement_interactions').upsert({
            announcement_id: announcementId,
            user_id: userId,
            user_name: userName,
            interaction_type: 'read'
        }, { onConflict: 'announcement_id,user_id,interaction_type' });
    } else {
        const { data } = await supabase.from('announcement_interactions')
            .select('id')
            .eq('announcement_id', announcementId)
            .eq('user_id', userId)
            .eq('interaction_type', 'like')
            .single();
            
        if (data) {
            await supabase.from('announcement_interactions').delete().eq('id', data.id);
        } else {
            await supabase.from('announcement_interactions').insert({
                announcement_id: announcementId,
                user_id: userId,
                user_name: userName,
                interaction_type: 'like'
            });
        }
    }
};

// --- ADMIN MANAGEMENT (SQL) ---
export const toggleAdminSQL = async (email: string, setAdmin: boolean) => {
    if (!supabase) return;
    await supabase.from('profiles').update({ is_admin: setAdmin }).eq('email', email);
};

export const fetchAdminsSQL = async (ministryId: string): Promise<string[]> => {
    if (!supabase) return [];
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const { data } = await supabase
        .from('profiles')
        .select('email')
        .eq('is_admin', true)
        .or(`ministry_id.eq.${cleanMid},allowed_ministries.cs.{${cleanMid}}`);
    
    return (data || []).map((p: any) => p.email).filter((e: any) => !!e);
};

// --- PUSH SUBSCRIPTIONS SQL ---
export const saveSubscriptionSQL = async (ministryId: string, sub: PushSubscription) => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if(!user) return;

    const subJSON = sub.toJSON();
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    
    await supabase.from('push_subscriptions').upsert({
        endpoint: sub.endpoint,
        user_id: user.id,
        ministry_id: cleanMid,
        p256dh: subJSON.keys?.p256dh || '',
        auth: subJSON.keys?.auth || '',
        device_id: localStorage.getItem('device_id') || 'unknown',
        updated_at: new Date().toISOString()
    }, { onConflict: 'endpoint' });
};

// ============================================================================
// EXISTING CORE FUNCTIONS (Schedule, Members, Auth)
// ============================================================================

export const createMinistryEvent = async (ministryId: string, event: { title: string, date: string, time: string }): Promise<boolean> => {
    if (!supabase || !ministryId) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const dateTime = `${event.date}T${event.time}:00`;

    try {
        const { error } = await supabase.from('events').insert({
            ministry_id: cleanMid,
            title: event.title,
            date_time: dateTime
        });
        return !error;
    } catch (e) {
        return false;
    }
};

export const fetchMinistryMembers = async (ministryId: string): Promise<{
    memberMap: MemberMap,
    publicList: TeamMemberProfile[]
}> => {
    if (!supabase || !ministryId) return { memberMap: {}, publicList: [] };
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const settings = await fetchMinistrySettings(cleanMid);
        const validRoles = settings.roles || [];

        const { data: ministryProfiles, error } = await supabase
            .from('profiles')
            .select('*')
            .or(`ministry_id.eq.${cleanMid},allowed_ministries.cs.{${cleanMid}}`);

        if (error) throw error;

        const publicList: TeamMemberProfile[] = (ministryProfiles || []).map((p: any) => {
            // Filter roles to only show those belonging to the current ministry settings
            const userRoles = (p.functions || []).filter((r: string) => validRoles.includes(r));
            
            return {
                id: p.id,
                name: p.name || 'Membro sem nome', 
                email: p.email || undefined,
                whatsapp: p.whatsapp,
                avatar_url: p.avatar_url,
                birthDate: p.birth_date, // Mapeia corretamente a data de nascimento
                roles: userRoles,
                createdAt: p.created_at, // FIX: Removido fallback para Date.now() para evitar que todos pareçam novos
                isAdmin: p.is_admin
            };
        }).sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));

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
        return { memberMap: {}, publicList: [] };
    }
};

export const fetchMinistrySchedule = async (ministryId: string, monthIso: string): Promise<{ schedule: ScheduleMap, events: any[], attendance: AttendanceMap }> => {
    if (!supabase || !ministryId) return { schedule: {}, events: [], attendance: {} };
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const startOfMonth = `${monthIso}-01T00:00:00`;
        const [y, m] = monthIso.split('-').map(Number);
        const nextMonthDate = new Date(y, m, 1);
        const nextMonth = nextMonthDate.toISOString().split('T')[0];

        // 1. Tenta buscar eventos existentes
        let { data: events, error: eventError } = await supabase
            .from('events')
            .select('id, title, date_time')
            .eq('ministry_id', cleanMid)
            .gte('date_time', startOfMonth)
            .lt('date_time', `${nextMonth}T00:00:00`)
            .order('date_time', { ascending: true });

        if (eventError) throw eventError;

        // 2. AUTO-GERAÇÃO (INFINITE SCROLL): Se não houver eventos, cria os padrões
        if (!events || events.length === 0) {
            const daysInMonth = new Date(y, m, 0).getDate();
            const eventsToCreate = [];

            for (let d = 1; d <= daysInMonth; d++) {
                const date = new Date(y, m - 1, d);
                const dayOfWeek = date.getDay(); // 0 = Sun, 3 = Wed
                const dateStr = date.toISOString().split('T')[0];

                if (dayOfWeek === 3) {
                    eventsToCreate.push({
                        ministry_id: cleanMid,
                        title: "Culto (Quarta)",
                        date_time: `${dateStr}T19:30:00`
                    });
                } else if (dayOfWeek === 0) {
                    eventsToCreate.push({
                        ministry_id: cleanMid,
                        title: "Culto (Domingo - Manhã)",
                        date_time: `${dateStr}T09:00:00`
                    });
                    eventsToCreate.push({
                        ministry_id: cleanMid,
                        title: "Culto (Domingo - Noite)",
                        date_time: `${dateStr}T18:00:00`
                    });
                }
            }

            if (eventsToCreate.length > 0) {
                const { data: newEvents, error: createError } = await supabase
                    .from('events')
                    .insert(eventsToCreate)
                    .select('id, title, date_time')
                    .order('date_time', { ascending: true });
                
                if (!createError && newEvents) {
                    events = newEvents;
                }
            }
        }

        if (!events || events.length === 0) return { schedule: {}, events: [], attendance: {} };

        const eventIds = events.map(e => e.id);

        const { data: assignments, error: assignError } = await supabase
            .from('schedule_assignments')
            .select(`
                event_id,
                role,
                confirmed,
                profiles ( name )
            `)
            .in('event_id', eventIds);

        if (assignError) throw assignError;

        const schedule: ScheduleMap = {};
        const attendance: AttendanceMap = {};
        
        assignments?.forEach((assign: any) => {
            const event = events.find(e => e.id === assign.event_id);
            if (event && assign.profiles) {
                const isoKey = event.date_time.slice(0, 16); 
                const scheduleKey = `${isoKey}_${assign.role}`;
                schedule[scheduleKey] = assign.profiles.name;
                if (assign.confirmed) {
                    attendance[scheduleKey] = true;
                }
            }
        });

        const uiEvents = events.map(e => ({
            id: e.id,
            title: e.title,
            date: e.date_time.split('T')[0],
            time: e.date_time.split('T')[1].slice(0, 5),
            iso: e.date_time.slice(0, 16)
        }));

        return { schedule, events: uiEvents, attendance };

    } catch (e) {
        return { schedule: {}, events: [], attendance: {} };
    }
};

export const clearScheduleForMonth = async (ministryId: string, monthIso: string): Promise<boolean> => {
    if (!supabase || !ministryId) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    
    try {
        const start = `${monthIso}-01T00:00:00`;
        const [y, m] = monthIso.split('-').map(Number);
        const nextMonth = new Date(y, m, 1).toISOString().split('T')[0] + 'T00:00:00';

        const { data: events } = await supabase
            .from('events')
            .select('id')
            .eq('ministry_id', cleanMid)
            .gte('date_time', start)
            .lt('date_time', nextMonth);

        if (!events || events.length === 0) return true;

        const ids = events.map(e => e.id);

        const { error } = await supabase
            .from('schedule_assignments')
            .delete()
            .in('event_id', ids);

        return !error;
    } catch (e) {
        return false;
    }
};

export const resetToDefaultEvents = async (ministryId: string, monthIso: string): Promise<boolean> => {
    if (!supabase || !ministryId) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    
    try {
        const [y, m] = monthIso.split('-').map(Number);
        const startDate = `${monthIso}-01T00:00:00`;
        const nextMonthDate = new Date(y, m, 1);
        const nextMonth = nextMonthDate.toISOString().split('T')[0] + 'T00:00:00';

        const { data: eventsToDelete } = await supabase
            .from('events')
            .select('id')
            .eq('ministry_id', cleanMid)
            .gte('date_time', startDate)
            .lt('date_time', nextMonth);
            
        if (eventsToDelete && eventsToDelete.length > 0) {
            const ids = eventsToDelete.map(e => e.id);
            await supabase.from('schedule_assignments').delete().in('event_id', ids);
            await supabase.from('events').delete().in('id', ids);
        }

        const daysInMonth = new Date(y, m, 0).getDate();
        const eventsToCreate = [];

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(y, m - 1, d);
            const dayOfWeek = date.getDay(); // 0 = Sun, 3 = Wed
            const dateStr = date.toISOString().split('T')[0];

            if (dayOfWeek === 3) {
                eventsToCreate.push({
                    ministry_id: cleanMid,
                    title: "Culto (Quarta)",
                    date_time: `${dateStr}T19:30:00`
                });
            } else if (dayOfWeek === 0) {
                eventsToCreate.push({
                    ministry_id: cleanMid,
                    title: "Culto (Domingo - Manhã)",
                    date_time: `${dateStr}T09:00:00`
                });
                eventsToCreate.push({
                    ministry_id: cleanMid,
                    title: "Culto (Domingo - Noite)",
                    date_time: `${dateStr}T18:00:00`
                });
            }
        }

        if (eventsToCreate.length > 0) {
            await supabase.from('events').insert(eventsToCreate);
        }

        return true;
    } catch (e) {
        return false;
    }
};

export const updateMinistryEvent = async (ministryId: string, oldIso: string, newTitle: string, newIso: string): Promise<boolean> => {
    if (!supabase || !ministryId) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const formatTimestamp = (iso: string) => `${iso}:00`; 

    try {
        const { data: existingEvents } = await supabase
            .from('events')
            .select('id')
            .eq('ministry_id', cleanMid)
            .eq('date_time', formatTimestamp(oldIso))
            .limit(1); 

        if (existingEvents && existingEvents.length > 0) {
            const { error } = await supabase
                .from('events')
                .update({ 
                    title: newTitle,
                    date_time: formatTimestamp(newIso)
                })
                .eq('id', existingEvents[0].id);
            return !error;
        } else {
            const { error } = await supabase
                .from('events')
                .insert({
                    ministry_id: cleanMid,
                    title: newTitle,
                    date_time: formatTimestamp(newIso)
                });
            return !error;
        }
    } catch (e) {
        return false;
    }
};

export const deleteMinistryEvent = async (ministryId: string, iso: string): Promise<boolean> => {
    if (!supabase || !ministryId) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const dateTime = `${iso}:00`; 

    try {
        const { data: events } = await supabase
            .from('events')
            .select('id')
            .eq('ministry_id', cleanMid)
            .eq('date_time', dateTime);

        if (!events || events.length === 0) return true; 

        const ids = events.map(e => e.id);

        await supabase.from('schedule_assignments').delete().in('event_id', ids);
        const { error } = await supabase.from('events').delete().in('id', ids);

        return !error;
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
            .limit(1); 

        if (eventData && eventData.length > 0) {
            eventId = eventData[0].id;
        } else {
            if (!memberName) return true;

            const dateObj = new Date(isoDate);
            const dayOfWeek = dateObj.getDay(); 
            const hour = dateObj.getHours();
            
            let title = "Evento Extra";
            if (dayOfWeek === 3) title = "Culto (Quarta)";
            else if (dayOfWeek === 0) {
                if (hour < 13) title = "Culto (Domingo - Manhã)";
                else title = "Culto (Domingo - Noite)";
            }

            const { data: newEvent, error: createError } = await supabase
                .from('events')
                .insert({
                    ministry_id: cleanMid,
                    title: title,
                    date_time: dateTime
                })
                .select()
                .single();
            
            if (createError) throw createError;
            eventId = newEvent.id;
        }

        if (!memberName) {
            if (eventId) {
                await supabase
                    .from('schedule_assignments')
                    .delete()
                    .eq('event_id', eventId)
                    .eq('role', role);
            }
            return true;
        }

        const { data: memberData } = await supabase
            .from('profiles')
            .select('id')
            .ilike('name', memberName)
            .limit(1)
            .single();

        if (!memberData) return false; 

        await supabase
            .from('schedule_assignments')
            .delete()
            .eq('event_id', eventId)
            .eq('role', role);

        const { error: insertError } = await supabase
            .from('schedule_assignments')
            .insert({
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
        if (allMembers) {
            allMembers.forEach(m => {
                if (m.name) memberMap.set(m.name.toLowerCase().trim(), m.id);
            });
        }

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
        if (existingEvents) {
            existingEvents.forEach(e => eventIdMap.set(e.date_time, e.id));
        }

        const eventsToCreate = [];
        for (const ts of neededTimestamps) {
            if (!eventIdMap.has(ts)) {
                const dateObj = new Date(ts);
                const dayOfWeek = dateObj.getDay();
                const hour = dateObj.getHours();
                
                let title = "Evento Extra";
                if (dayOfWeek === 3) title = "Culto (Quarta)";
                else if (dayOfWeek === 0) {
                    if (hour < 13) title = "Culto (Domingo - Manhã)";
                    else title = "Culto (Domingo - Noite)";
                }

                eventsToCreate.push({
                    ministry_id: cleanMid,
                    title: title,
                    date_time: ts
                });
            }
        }

        if (eventsToCreate.length > 0) {
            const { data: newEvents, error: createError } = await supabase
                .from('events')
                .insert(eventsToCreate)
                .select('id, date_time');
            
            if (createError) throw createError;
            
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
                assignmentsToUpsert.push({
                    event_id: eventId,
                    role: role,
                    member_id: memberId
                });
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

export const toggleAssignmentConfirmation = async (ministryId: string, key: string): Promise<boolean> => {
    if (!supabase || !ministryId) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const lastUnderscore = key.lastIndexOf('_');
        const isoDate = key.substring(0, lastUnderscore); 
        const role = key.substring(lastUnderscore + 1);
        const dateTime = `${isoDate}:00`;

        const { data: eventData } = await supabase
            .from('events')
            .select('id')
            .eq('ministry_id', cleanMid)
            .eq('date_time', dateTime)
            .limit(1);

        if (!eventData || eventData.length === 0) return false;
        const eventId = eventData[0].id;

        const { data: assignment } = await supabase
            .from('schedule_assignments')
            .select('id, confirmed')
            .eq('event_id', eventId)
            .eq('role', role)
            .single();

        if (!assignment) return false;

        const { error } = await supabase
            .from('schedule_assignments')
            .update({ confirmed: !assignment.confirmed })
            .eq('id', assignment.id);

        return !error;

    } catch (e) {
        return false;
    }
};

export const fetchMinistryAvailability = async (ministryId: string): Promise<AvailabilityMap> => {
    if (!supabase || !ministryId) return {};
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const { data: availData, error } = await supabase
            .from('availability')
            .select(`
                date,
                status,
                member_id,
                profiles!inner ( id, name, ministry_id, allowed_ministries )
            `);

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
        const { data: member } = await supabase
            .from('profiles')
            .select('id')
            .ilike('name', memberName)
            .single();

        if (!member) return false;

        const rows = dates.map(d => {
            let date = d;
            let status = 'BOTH';
            if (d.endsWith('_M')) { date = d.replace('_M', ''); status = 'M'; }
            else if (d.endsWith('_N')) { date = d.replace('_N', ''); status = 'N'; }
            
            return { member_id: member.id, date, status };
        });

        await supabase.from('availability').delete().eq('member_id', member.id);
        
        if (rows.length > 0) {
            await supabase.from('availability').insert(rows);
        }

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
        const { data, error } = await supabase
            .from('schedule_assignments')
            .select(`
                role,
                events!inner (
                    date_time,
                    ministry_id
                ),
                profiles!inner (
                    name
                )
            `)
            .gte('events.date_time', start)
            .lt('events.date_time', nextMonth)
            .neq('events.ministry_id', currentMinistryId); 

        if (error) throw error;

        const conflicts: GlobalConflictMap = {};

        data?.forEach((row: any) => {
            const name = row.profiles.name;
            if (!name) return;
            
            const normalized = name.trim().toLowerCase();
            if (!conflicts[normalized]) conflicts[normalized] = [];
            
            const conflict: GlobalConflict = {
                ministryId: row.events.ministry_id,
                eventIso: row.events.date_time.slice(0, 16),
                role: row.role
            };
            
            conflicts[normalized].push(conflict);
        });

        return conflicts;

    } catch (e) {
        return {};
    }
};

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
    
    // Fix: Force redirect to canonical production URL to avoid Vercel preview URLs
    let redirectUrl = window.location.origin;
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        redirectUrl = "https://escalaobpcpro.vercel.app";
    }
    
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: redirectUrl
        }
    });
    return { success: !error, message: error?.message || "" };
};

export const syncMemberProfile = async (ministryId: string, user: User) => {
    if (!supabase || !user.id) return;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const { data: existing, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        const allowed = user.allowedMinistries || [cleanMid];
        if (!allowed.includes(cleanMid)) allowed.push(cleanMid);
        
        let newAllowed = [...allowed];
        let newFunctions = user.functions || [];

        if (existing) {
            const existingAllowed = existing.allowed_ministries || [];
            const existingFunctions = existing.functions || [];
            
            newAllowed = [...new Set([...existingAllowed, ...allowed])];
            newFunctions = [...new Set([...existingFunctions, ...newFunctions])];
            
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
    
    let redirectUrl = window.location.origin;
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        redirectUrl = "https://escalaobpcpro.vercel.app";
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl + '?reset=true',
    });
    if (error) return { success: false, message: error.message };
    return { success: true, message: "Link de recuperação enviado para o e-mail." };
};

export const updateUserProfile = async (name: string, whatsapp: string, avatar_url?: string, functions?: string[], birthDate?: string, ministryId?: string) => {
    if (!supabase) return { success: false, message: "Erro conexão" };
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Usuário não logado" };

    try {
        // Auth Metadata (CamelCase for App Consistency)
        const authUpdates = {
            name,
            whatsapp,
            avatar_url,
            functions,
            birthDate,
            ministryId // Ensure this is kept
        };
        
        // Database Profile (SnakeCase for SQL)
        const dbUpdates = {
            name,
            whatsapp,
            avatar_url,
            functions,
            birth_date: birthDate
        };
        
        await supabase.auth.updateUser({
            data: authUpdates
        });

        const { error } = await supabase
            .from('profiles')
            .update(dbUpdates)
            .eq('id', user.id);

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
        
        const { data: profile } = await supabase
            .from('profiles')
            .select('allowed_ministries, functions')
            .eq('id', user.id)
            .single();
            
        if (!profile) return { success: false, message: "Perfil não encontrado." };

        const currentAllowed = profile.allowed_ministries || [];
        const currentFunctions = profile.functions || [];

        if (currentAllowed.includes(cleanMid)) {
             return { success: false, message: "Você já faz parte deste ministério." };
        }

        const newAllowed = [...currentAllowed, cleanMid];
        const newFunctions = [...new Set([...currentFunctions, ...roles])];

        await supabase
            .from('profiles')
            .update({ 
                allowed_ministries: newAllowed,
                functions: newFunctions
            })
            .eq('id', user.id);
            
        await supabase.auth.updateUser({
            data: { allowedMinistries: newAllowed, functions: newFunctions }
        });

        return { success: true, message: "Bem-vindo ao novo ministério!" };

    } catch (e: any) {
        console.error(e);
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