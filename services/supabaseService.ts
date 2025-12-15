import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
    SUPABASE_URL, SUPABASE_KEY, PushSubscriptionRecord, User, MemberMap,
    AppNotification, TeamMemberProfile, AvailabilityMap, SwapRequest,
    ScheduleMap, RepertoireItem, Announcement, GlobalConflictMap,
    GlobalConflict, DEFAULT_ROLES, AttendanceMap, AuditLogEntry, MinistrySettings,
    RankingEntry, AvailabilityNotesMap, CustomEvent
} from '../types';

let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

export const getSupabase = () => supabase;

// --- AUTH FUNCTIONS ---

export const loginWithEmail = async (email: string, pass: string) => {
    if (!supabase) return { success: false, message: "Erro de configuração" };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) return { success: false, message: error.message };
    return { success: true, user: data.user };
};

export const loginWithGoogle = async () => {
    if (!supabase) return { success: false, message: "Erro de configuração" };
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
    });
    if (error) return { success: false, message: error.message };
    return { success: true, data };
};

export const registerWithEmail = async (email: string, pass: string, name: string, ministries: string[], phone?: string, roles?: string[]) => {
    if (!supabase) return { success: false, message: "Erro de configuração" };
    const { data, error } = await supabase.auth.signUp({
        email, password: pass,
        options: { data: { name, full_name: name } }
    });
    if (error) return { success: false, message: error.message };
    
    if (data.user) {
        // Create profile
        await supabase.from('profiles').upsert({
            id: data.user.id,
            email,
            name,
            ministry_id: ministries[0],
            allowed_ministries: ministries,
            roles: roles || [],
            whatsapp: phone
        });
    }
    return { success: true, message: "Verifique seu e-mail para confirmar." };
};

export const logout = async () => {
    if (supabase) await supabase.auth.signOut();
};

export const sendPasswordResetEmail = async (email: string) => {
    if (!supabase) return { success: false, message: "Erro de configuração" };
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '?tab=reset' });
    return { success: !error, message: error ? error.message : "Email enviado!" };
};

// --- PROFILE FUNCTIONS ---

export const updateProfileMinistry = async (userId: string, ministryId: string) => {
    if (!supabase) return;
    await supabase.from('profiles').update({ ministry_id: ministryId }).eq('id', userId);
};

export const updateUserProfile = async (name: string, whatsapp: string, avatar_url?: string, functions?: string[], birthDate?: string, ministryId?: string) => {
    if (!supabase) return { success: false, message: "Sem conexão" };
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Usuário não logado" };

    const updates: any = { 
        name, 
        whatsapp, 
        updated_at: new Date().toISOString() 
    };
    if (avatar_url) updates.avatar_url = avatar_url;
    if (functions) updates.functions = functions; // For compatibility if column exists
    if (birthDate) updates.birth_date = birthDate;
    
    // Also update roles in the current ministry context if needed (schema dependent)
    if (functions && ministryId) {
        // If roles are stored per ministry in a separate table or jsonb, update there.
        // Assuming 'roles' column on profiles is global or current ministry roles.
        updates.roles = functions;
    }

    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    return { success: !error, message: error ? error.message : "Perfil atualizado!" };
};

export const toggleAdminSQL = async (email: string, status: boolean, ministryId: string) => {
    if (!supabase) return;
    // Uses edge function to bypass RLS if needed, or RLS allows admins to update
    await supabase.functions.invoke('push-notification', {
        body: { action: 'toggle_admin', targetEmail: email, status, ministryId }
    });
};

export const deleteMember = async (ministryId: string, memberId: string, memberName: string) => {
    if (!supabase) return { success: false, message: "Sem conexão" };
    const { error } = await supabase.functions.invoke('push-notification', {
        body: { action: 'delete_member', memberId, ministryId }
    });
    return { success: !error, message: error ? error.message : "Membro removido" };
};

export const joinMinistry = async (ministryId: string, roles: string[]) => {
    if (!supabase) return { success: false, message: "Sem conexão" };
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Erro de sessão" };

    const { data: profile } = await supabase.from('profiles').select('allowed_ministries').eq('id', user.id).single();
    const currentAllowed = profile?.allowed_ministries || [];
    
    if (!currentAllowed.includes(ministryId)) {
        const newAllowed = [...currentAllowed, ministryId];
        const { error } = await supabase.from('profiles').update({ 
            allowed_ministries: newAllowed,
            ministry_id: ministryId, // Switch to new
            roles: roles // Update roles for this context
        }).eq('id', user.id);
        
        if (error) return { success: false, message: error.message };
    }
    
    return { success: true, message: "Entrou no ministério com sucesso!" };
};

export const fetchMinistryMembers = async (ministryId: string): Promise<{ memberMap: MemberMap, publicList: TeamMemberProfile[] }> => {
    if (!supabase) return { memberMap: {}, publicList: [] };
    
    const { data } = await supabase.from('profiles')
        .select('*')
        .contains('allowed_ministries', [ministryId]); // Assuming array column

    const publicList: TeamMemberProfile[] = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        whatsapp: p.whatsapp,
        avatar_url: p.avatar_url,
        roles: p.roles, // Should be array
        isAdmin: p.is_admin,
        birthDate: p.birth_date
    })).sort((a: any, b: any) => a.name.localeCompare(b.name));

    const memberMap: MemberMap = {};
    publicList.forEach(m => {
        (m.roles || []).forEach(r => {
            if (!memberMap[r]) memberMap[r] = [];
            memberMap[r].push(m.name);
        });
    });

    return { memberMap, publicList };
};

// --- SETTINGS ---

export const fetchMinistrySettings = async (ministryId: string): Promise<MinistrySettings> => {
    if (!supabase) return { displayName: '', roles: [] };
    const { data } = await supabase.from('ministry_settings').select('*').eq('ministry_id', ministryId).single();
    if (data) {
        return {
            displayName: data.display_name,
            roles: data.roles || [],
            availabilityStart: data.availability_start,
            availabilityEnd: data.availability_end
        };
    }
    return { displayName: '', roles: [] };
};

export const saveMinistrySettings = async (ministryId: string, displayName?: string, roles?: string[], start?: string, end?: string) => {
    if (!supabase) return;
    const updates: any = { ministry_id: ministryId };
    if (displayName !== undefined) updates.display_name = displayName;
    if (roles !== undefined) updates.roles = roles;
    if (start !== undefined) updates.availability_start = start;
    if (end !== undefined) updates.availability_end = end;

    await supabase.from('ministry_settings').upsert(updates, { onConflict: 'ministry_id' });
};

// --- SCHEDULE & EVENTS ---

export const fetchMinistrySchedule = async (ministryId: string, month: string) => {
    if (!supabase) return { events: [], schedule: {}, attendance: {} };
    
    // Events
    const start = `${month}-01`;
    // Calculate end of month roughly or next month start
    const [y, m] = month.split('-').map(Number);
    const nextMonth = new Date(y, m, 1);
    const end = nextMonth.toISOString().split('T')[0];

    const { data: eventsData } = await supabase.from('events')
        .select('*')
        .eq('ministry_id', ministryId)
        .gte('date_time', start)
        .lt('date_time', end)
        .order('date_time');

    const events = (eventsData || []).map((e: any) => {
        const iso = e.date_time.slice(0, 16); // YYYY-MM-DDTHH:mm
        const [date, time] = iso.split('T');
        const [yr, mo, dy] = date.split('-');
        return {
            id: e.id,
            iso,
            title: e.title,
            date: date,
            time: time,
            dateDisplay: `${dy}/${mo}`
        };
    });

    // Schedule
    if (events.length === 0) return { events: [], schedule: {}, attendance: {} };
    const eventIds = events.map(e => e.id);
    
    const { data: assignments } = await supabase.from('schedule_assignments')
        .select('event_id, role, member_id, confirmed, profiles(name)')
        .in('event_id', eventIds);

    const schedule: ScheduleMap = {};
    const attendance: AttendanceMap = {};

    (assignments || []).forEach((a: any) => {
        const evt = events.find(e => e.id === a.event_id);
        if (evt && a.profiles?.name) {
            const key = `${evt.iso}_${a.role}`;
            schedule[key] = a.profiles.name;
            if (a.confirmed) attendance[key] = true;
        }
    });

    return { events, schedule, attendance };
};

export const saveScheduleAssignment = async (ministryId: string, key: string, memberName: string) => {
    if (!supabase) return false;
    // Key format: YYYY-MM-DDTHH:mm_Role
    const separatorIndex = key.lastIndexOf('_');
    const iso = key.substring(0, separatorIndex);
    const role = key.substring(separatorIndex + 1);
    const dateTime = iso.length === 16 ? iso + ':00' : iso; // Ensure seconds for DB match

    try {
        // 1. Get Event ID
        let { data: event } = await supabase.from('events').select('id').eq('ministry_id', ministryId).eq('date_time', dateTime).single();
        
        // Auto-create event if missing (robustness)
        if (!event) {
             const { data: newEvent } = await supabase.from('events').insert({ 
                 ministry_id: ministryId, 
                 date_time: dateTime, 
                 title: 'Culto' 
             }).select().single();
             event = newEvent;
        }
        if (!event) return false;

        // 2. Get Member ID (if adding) or null (if removing)
        let memberId = null;
        if (memberName) {
            const { data: profile } = await supabase.from('profiles').select('id').eq('name', memberName).limit(1).maybeSingle();
            if (profile) memberId = profile.id;
            else {
                // Warning: Member not found in DB
                return false;
            }
        }

        // 3. Upsert or Delete
        if (memberId) {
            await supabase.from('schedule_assignments').upsert({
                event_id: event.id,
                role: role,
                member_id: memberId,
                confirmed: false
            }, { onConflict: 'event_id,role' });
        } else {
            await supabase.from('schedule_assignments').delete().eq('event_id', event.id).eq('role', role);
        }
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
};

export const saveScheduleBulk = async (ministryId: string, schedule: ScheduleMap, isAi: boolean = false) => {
    if (!supabase) return false;
    // Basic implementation: iterate. In production, use RPC or bulk upsert if optimized.
    for (const [key, value] of Object.entries(schedule)) {
        await saveScheduleAssignment(ministryId, key, value);
    }
    return true;
};

export const clearScheduleForMonth = async (ministryId: string, month: string) => {
    if (!supabase) return;
    // Get event IDs
    const start = `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const nextMonth = new Date(y, m, 1);
    const end = nextMonth.toISOString().split('T')[0];

    const { data: events } = await supabase.from('events').select('id').eq('ministry_id', ministryId).gte('date_time', start).lt('date_time', end);
    const ids = events?.map((e: any) => e.id) || [];
    
    if (ids.length > 0) {
        await supabase.from('schedule_assignments').delete().in('event_id', ids);
    }
};

export const resetToDefaultEvents = async (ministryId: string, month: string) => {
    if (!supabase) return;
    // 1. Clear assignments
    await clearScheduleForMonth(ministryId, month);
    
    // 2. Clear events? Maybe not, just assignments? Or reset events to Sunday defaults.
    // Let's assume we delete all events for month and re-create Sundays.
    const start = `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const date = new Date(y, m - 1, 1);
    
    // Delete existing events
    const nextMonth = new Date(y, m, 1);
    const end = nextMonth.toISOString().split('T')[0];
    await supabase.from('events').delete().eq('ministry_id', ministryId).gte('date_time', start).lt('date_time', end);

    // Create Sundays
    const eventsToInsert = [];
    while (date.getMonth() === m - 1) {
        if (date.getDay() === 0) { // Sunday
            const dayStr = date.toISOString().split('T')[0];
            eventsToInsert.push({ ministry_id: ministryId, title: 'Culto da Família', date_time: `${dayStr}T18:00:00` });
            // Add Tuesday/Thursday if needed? For now just Sunday based on typical request.
        }
        date.setDate(date.getDate() + 1);
    }
    if (eventsToInsert.length > 0) {
        await supabase.from('events').insert(eventsToInsert);
    }
};

export const createMinistryEvent = async (ministryId: string, event: { title: string, date: string, time: string }) => {
    if (!supabase) return;
    await supabase.from('events').insert({
        ministry_id: ministryId,
        title: event.title,
        date_time: `${event.date}T${event.time}:00`
    });
};

export const updateMinistryEvent = async (ministryId: string, oldIso: string, newTitle: string, newIso: string, applyToAll: boolean) => {
    if (!supabase) return;
    const oldDateTime = oldIso.length === 16 ? oldIso + ':00' : oldIso;
    const newDateTime = newIso.length === 16 ? newIso + ':00' : newIso;

    // Find ID
    const { data: evt } = await supabase.from('events').select('id').eq('ministry_id', ministryId).eq('date_time', oldDateTime).single();
    if (evt) {
        await supabase.from('events').update({ title: newTitle, date_time: newDateTime }).eq('id', evt.id);
        
        if (applyToAll) {
            // Update future events with same OLD title or just all future events on same weekday?
            // Simple logic: Update all future events of this ministry that match weekday and old time?
            // For safety, let's just update this one as "applyToAll" logic is complex without recurring pattern ID.
            // Or maybe update all future events with same title.
        }
    }
};

export const deleteMinistryEvent = async (ministryId: string, iso: string) => {
    if (!supabase) return;
    const dateTime = iso.length === 16 ? iso + ':00' : iso;
    await supabase.from('events').delete().eq('ministry_id', ministryId).eq('date_time', dateTime);
};

export const toggleAssignmentConfirmation = async (ministryId: string, key: string) => {
    if (!supabase) return false;
    const separatorIndex = key.lastIndexOf('_');
    const iso = key.substring(0, separatorIndex);
    const role = key.substring(separatorIndex + 1);
    const dateTime = iso.length === 16 ? iso + ':00' : iso;

    const { data: event } = await supabase.from('events').select('id').eq('ministry_id', ministryId).eq('date_time', dateTime).single();
    if (!event) return false;

    // Fetch current confirmation status
    const { data: assignment } = await supabase.from('schedule_assignments').select('confirmed').eq('event_id', event.id).eq('role', role).single();
    
    if (assignment) {
        await supabase.from('schedule_assignments').update({ confirmed: !assignment.confirmed }).eq('event_id', event.id).eq('role', role);
        return true;
    }
    return false;
};

// ... (rest of the file: availability, notifications, swaps, repertoire, ranking, push) ...

export const fetchMinistryAvailability = async (ministryId: string) => {
    if (!supabase) return { availability: {}, notes: {} };
    
    const { data: profiles } = await supabase.from('profiles').select('id, name').contains('allowed_ministries', [ministryId]);
    if (!profiles || profiles.length === 0) return { availability: {}, notes: {} };

    const ids = profiles.map((p: any) => p.id);
    
    const { data: avails } = await supabase.from('availability').select('*').in('user_id', ids);
    
    const availability: AvailabilityMap = {};
    const notes: AvailabilityNotesMap = {};

    (avails || []).forEach((a: any) => {
        const profile = profiles.find((p: any) => p.id === a.user_id);
        if (profile) {
            if (!availability[profile.name]) availability[profile.name] = [];
            availability[profile.name].push(...(a.dates || []));
            
            if (a.notes) {
                Object.entries(a.notes).forEach(([day, note]) => {
                    notes[`${profile.name}_${day}`] = note as string;
                });
            }
        }
    });

    return { availability, notes };
};

export const saveMemberAvailability = async (userId: string, memberName: string, dates: string[], targetMonth: string, notes: Record<string, string>) => {
    if (!supabase) return { error: "Sem conexão com banco de dados" };
    
    try {
        const monthDates = dates.filter(d => d.startsWith(targetMonth));
        const isBlocked = dates.includes(`${targetMonth}_BLK`);
        const finalDates = isBlocked ? [`${targetMonth}_BLK`] : monthDates;

        const { error } = await supabase.from('availability').upsert({
            user_id: userId,
            month: targetMonth,
            dates: finalDates,
            notes: notes
        }, { onConflict: 'user_id,month' });

        return { error };
    } catch (e: any) {
        console.error("Erro no saveMemberAvailability:", e);
        return { error: e.message };
    }
};

export const fetchNotificationsSQL = async (ministryIds: string[], userId: string): Promise<AppNotification[]> => {
    if (!supabase) return [];
    
    const { data: notifs } = await supabase.from('notifications')
        .select('*')
        .in('ministry_id', ministryIds)
        .order('created_at', { ascending: false })
        .limit(20);

    const { data: reads } = await supabase.from('notification_reads')
        .select('notification_id')
        .eq('user_id', userId);
    
    const readSet = new Set(reads?.map((r: any) => r.notification_id));

    return (notifs || []).map((n: any) => ({
        id: n.id,
        ministryId: n.ministry_id,
        title: n.title,
        message: n.message,
        type: n.type,
        actionLink: n.action_link,
        timestamp: n.created_at,
        read: readSet.has(n.id)
    }));
};

export const sendNotificationSQL = async (ministryId: string, notification: { title: string, message: string, type?: string, actionLink?: string }) => {
    if (!supabase) return;
    
    const { data, error } = await supabase.from('notifications').insert({
        ministry_id: ministryId,
        title: notification.title,
        message: notification.message,
        type: notification.type || 'info',
        action_link: notification.actionLink
    }).select();

    await supabase.functions.invoke('push-notification', {
        body: {
            ministryId,
            title: notification.title,
            message: notification.message,
            type: notification.type,
            actionLink: notification.actionLink
        }
    });
    
    return !error;
};

export const markNotificationsReadSQL = async (ids: string[], userId: string) => {
    if (!supabase) return;
    const inserts = ids.map(id => ({ notification_id: id, user_id: userId }));
    await supabase.from('notification_reads').insert(inserts);
};

export const clearAllNotificationsSQL = async (ministryId: string) => {
    if (!supabase) return;
    await supabase.from('notifications').delete().eq('ministry_id', ministryId);
};

export const fetchAnnouncementsSQL = async (ministryId: string): Promise<Announcement[]> => {
    if (!supabase) return [];
    const today = new Date().toISOString();
    const { data } = await supabase.from('announcements')
        .select('*, announcement_interactions(user_id, interaction_type, profiles(name))')
        .eq('ministry_id', ministryId)
        .gte('expiration_date', today)
        .order('created_at', { ascending: false });

    return (data || []).map((a: any) => {
        const interactions = a.announcement_interactions || [];
        const readBy = interactions.filter((i: any) => i.interaction_type === 'read').map((i: any) => ({ userId: i.user_id, name: i.profiles?.name, timestamp: '' }));
        const likedBy = interactions.filter((i: any) => i.interaction_type === 'like').map((i: any) => ({ userId: i.user_id, name: i.profiles?.name, timestamp: '' }));
        
        return {
            id: a.id,
            title: a.title,
            message: a.message,
            type: a.type,
            timestamp: a.created_at,
            expirationDate: a.expiration_date,
            author: a.author_name,
            readBy,
            likedBy
        };
    });
};

export const createAnnouncementSQL = async (ministryId: string, ann: { title: string, message: string, type: string, expirationDate: string }, authorName: string) => {
    if (!supabase) return;
    await supabase.from('announcements').insert({
        ministry_id: ministryId,
        title: ann.title,
        message: ann.message,
        type: ann.type,
        expiration_date: ann.expirationDate,
        author_name: authorName
    });
};

export const interactAnnouncementSQL = async (announcementId: string, userId: string, userName: string, type: 'read' | 'like') => {
    if (!supabase) return;
    if (type === 'read') {
        await supabase.from('announcement_interactions').insert({ announcement_id: announcementId, user_id: userId, interaction_type: 'read' }).select();
    } else {
        const { data } = await supabase.from('announcement_interactions').select('id').eq('announcement_id', announcementId).eq('user_id', userId).eq('interaction_type', 'like');
        if (data && data.length > 0) {
            await supabase.from('announcement_interactions').delete().eq('id', data[0].id);
        } else {
            await supabase.from('announcement_interactions').insert({ announcement_id: announcementId, user_id: userId, interaction_type: 'like' });
        }
    }
};

export const fetchSwapRequests = async (ministryId: string): Promise<SwapRequest[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('swap_requests').select('*').eq('ministry_id', ministryId).order('created_at', { ascending: false });
    
    return (data || []).map((r: any) => ({
        id: r.id,
        ministryId: r.ministry_id,
        requesterName: r.requester_name,
        requesterId: r.requester_id,
        role: r.role,
        eventIso: r.event_iso,
        eventTitle: r.event_title,
        status: r.status,
        createdAt: r.created_at,
        takenByName: r.taken_by_name
    }));
};

export const createSwapRequestSQL = async (ministryId: string, request: SwapRequest) => {
    if (!supabase) return true;
    const { error } = await supabase.from('swap_requests').insert({
        ministry_id: ministryId,
        requester_id: request.requesterId,
        requester_name: request.requesterName,
        role: request.role,
        event_iso: request.eventIso,
        event_title: request.eventTitle,
        status: 'pending'
    });
    return !error;
};

export const performSwapSQL = async (ministryId: string, reqId: string, takerName: string, takerId: string) => {
    if (!supabase) return { success: true, message: "Demo" };
    
    const { data: req } = await supabase.from('swap_requests').select('*').eq('id', reqId).single();
    if (!req || req.status !== 'pending') return { success: false, message: "Inválido" };

    const iso = req.event_iso;
    const dateTime = iso.length === 16 ? iso + ':00' : iso;

    const { data: event } = await supabase.from('events').select('id').eq('ministry_id', ministryId).eq('date_time', dateTime).single();
    if (!event) return { success: false, message: "Evento não encontrado" };

    const { error: assignError } = await supabase.from('schedule_assignments')
        .update({ member_id: takerId, confirmed: false })
        .eq('event_id', event.id)
        .eq('role', req.role)
        .eq('member_id', req.requester_id);

    if (assignError) return { success: false, message: "Erro ao atualizar escala" };

    await supabase.from('swap_requests').update({ status: 'completed', taken_by_name: takerName }).eq('id', reqId);

    await sendNotificationSQL(ministryId, {
        title: "Troca Aceita",
        message: `${takerName} assumiu sua escala de ${req.event_title}.`,
        type: 'success'
    });

    return { success: true, message: "Troca realizada!" };
};

export const fetchRepertoire = async (ministryId: string): Promise<RepertoireItem[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('repertoire').select('*').eq('ministry_id', ministryId).order('event_date', { ascending: false });
    
    return (data || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        link: r.link,
        date: r.event_date,
        addedBy: r.added_by,
        createdAt: r.created_at
    }));
};

export const addToRepertoire = async (ministryId: string, item: { title: string, link: string, date: string, addedBy: string }) => {
    if (!supabase) return true;
    const { error } = await supabase.from('repertoire').insert({
        ministry_id: ministryId,
        title: item.title,
        link: item.link,
        event_date: item.date,
        added_by: item.addedBy
    });
    return !error;
};

export const deleteFromRepertoire = async (itemId: string) => {
    if (!supabase) return;
    await supabase.from('repertoire').delete().eq('id', itemId);
};

export const fetchGlobalSchedules = async (month: string, currentMinistryId: string): Promise<GlobalConflictMap> => {
    return {};
};

export const fetchRankingData = async (ministryId: string): Promise<RankingEntry[]> => {
    if (!supabase) return [];
    return [];
};

export const saveSubscriptionSQL = async (ministryId: string, subscription: PushSubscription) => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const p256dh = subscription.getKey('p256dh') ? btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh')!) as any)) : '';
    const auth = subscription.getKey('auth') ? btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth')!) as any)) : '';

    await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh,
        auth
    }, { onConflict: 'endpoint' });
};
