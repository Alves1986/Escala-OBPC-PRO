
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
    SUPABASE_URL, SUPABASE_KEY, PushSubscriptionRecord, User, MemberMap, 
    AppNotification, TeamMemberProfile, AvailabilityMap, SwapRequest, 
    ScheduleMap, RepertoireItem, Announcement, GlobalConflictMap, 
    GlobalConflict, DEFAULT_ROLES, AttendanceMap, AuditLogEntry, MinistrySettings,
    RankingEntry, AvailabilityNotesMap, CustomEvent
} from '../types';

const isPreviewMode = SUPABASE_URL === 'https://preview.mode';

let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_KEY && !isPreviewMode) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

export const getSupabase = () => supabase;

export const logout = async () => {
    if (isPreviewMode) return;
    if (!supabase) return;
    await supabase.auth.signOut();
};

export const loginWithEmail = async (email: string, password: string) => {
    if (isPreviewMode) return { success: true };
    if (!supabase) return { success: false, message: "Erro de conexão" };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, message: error.message };
    return { success: true, data };
};

export const loginWithGoogle = async () => {
    if (isPreviewMode) return { success: true };
    if (!supabase) return { success: false, message: "Erro de conexão" };
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
    });
    if (error) return { success: false, message: error.message };
    return { success: true, data };
};

export const registerWithEmail = async (email: string, password: string, name: string, ministries: string[], phone?: string, roles?: string[]) => {
    if (isPreviewMode) return { success: true, message: "Registro simulado (Demo)" };
    if (!supabase) return { success: false, message: "Erro de conexão" };
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
    if (error) return { success: false, message: error.message };
    if (data.user) {
        const cleanMinistries = ministries.map(m => m.trim().toLowerCase().replace(/\s+/g, '-'));
        const mainMinistry = cleanMinistries[0] || 'midia';
        await supabase.from('profiles').upsert({
            id: data.user.id, email: email, name: name, ministry_id: mainMinistry, allowed_ministries: cleanMinistries,
            whatsapp: phone, functions: roles || [], role: 'member', created_at: new Date().toISOString()
        });
    }
    return { success: true, message: "Conta criada! Verifique seu e-mail." };
};

export const sendPasswordResetEmail = async (email: string) => {
    if (isPreviewMode) return { success: true, message: "Email enviado" };
    if (!supabase) return { success: false, message: "Erro conexão" };
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/?reset=true' });
    if (error) return { success: false, message: error.message };
    return { success: true, message: "Link enviado." };
};

export const joinMinistry = async (newMinistryId: string, roles: string[]) => {
    if (isPreviewMode) return { success: true, message: "Sucesso Demo" };
    if (!supabase) return { success: false, message: "Erro conexão" };
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Usuário não autenticado" };
    const cleanNewMid = newMinistryId.trim().toLowerCase().replace(/\s+/g, '-');
    try {
        const { data: profile } = await supabase.from('profiles').select('name, allowed_ministries, functions').eq('id', user.id).single();
        if (!profile) return { success: false, message: "Perfil não encontrado" };
        const newAllowed = [...(profile.allowed_ministries || []), cleanNewMid];
        const newFunctions = [...new Set([...(profile.functions || []), ...roles])];
        await supabase.from('profiles').update({ allowed_ministries: newAllowed, functions: newFunctions }).eq('id', user.id);
        
        const msg = `${profile.name} entrou na equipe! 🎉`;
        await supabase.from('notifications').insert({ 
            ministry_id: cleanNewMid, 
            title: "Novo Membro", 
            message: msg, 
            type: 'success', 
            action_link: 'members' 
        });
        try { supabase.functions.invoke('push-notification', { body: { ministryId: cleanNewMid, title: "Novo Membro", message: msg, type: 'success' } }); } catch (e) {}

        return { success: true, message: `Bem-vindo ao ministério ${cleanNewMid}!` };
    } catch (e: any) { return { success: false, message: e.message }; }
};

export const deleteMember = async (ministryId: string, memberId: string, memberName: string) => {
    if (!supabase) return { success: false, message: "Erro de conexão" };
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Não autorizado" };

    // Tenta via Edge Function (Bypass RLS)
    const { data, error } = await supabase.functions.invoke('push-notification', {
        body: {
            action: 'delete_member',
            ministryId,
            memberId
        }
    });

    if (error) {
        console.error("Edge Function Error:", error);
        return { success: false, message: "Falha ao conectar com servidor." };
    }

    if (!data || !data.success) {
        const msg = data?.message || "";
        // Detecta se a mensagem de erro é do sistema antigo de push
        if (msg.includes("inscrito") || msg.includes("dispositivo") || msg.includes("Ministry ID missing")) {
             return { success: false, message: "ALERTA: O código da Edge Function no Supabase está desatualizado. Copie o novo código de 'supabase/functions/push-notification/index.ts' e faça o Deploy." };
        }
        return { success: false, message: msg || "Erro ao remover membro." };
    }

    return { success: true, message: "Membro removido da equipe com sucesso." };
};

export const toggleAdminSQL = async (email: string, isAdmin: boolean, ministryId: string = 'midia') => {
    if (!supabase) return;
    
    await supabase.functions.invoke('push-notification', {
        body: {
            action: 'toggle_admin',
            targetEmail: email,
            status: isAdmin,
            ministryId
        }
    });
};

export const updateUserProfile = async (name: string, whatsapp: string, avatar_url: string | undefined, functions: string[] | undefined, birthDate: string | undefined, ministryId: string | undefined) => {
    if (isPreviewMode) return { success: true, message: "Perfil Demo Atualizado" };
    if (!supabase) return { success: false, message: "Erro conexão" };
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Não autenticado" };
    
    const updates: any = { name, whatsapp };
    
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (functions !== undefined) updates.functions = functions;
    if (birthDate !== undefined) updates.birth_date = birthDate;
    if (ministryId) updates.ministry_id = ministryId;
    
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (error) return { success: false, message: error.message };
    return { success: true, message: "Perfil atualizado!" };
};

export const updateProfileMinistry = async (userId: string, ministryId: string) => {
    if (!supabase) return;
    await supabase.from('profiles').update({ ministry_id: ministryId }).eq('id', userId);
};

export const fetchGlobalSchedules = async (monthIso: string, currentMinistryId: string): Promise<GlobalConflictMap> => {
    if (!supabase || !monthIso) return {};
    const cleanMid = currentMinistryId.trim().toLowerCase().replace(/\s+/g, '-');
    const startDate = `${monthIso}-01T00:00:00`;
    const [y, m] = monthIso.split('-').map(Number);
    const nextMonth = new Date(y, m, 1).toISOString();
    try {
        const { data } = await supabase.from('schedule_assignments')
            .select(`role, member_id, profiles:member_id!inner(name), events:event_id!inner(date_time, ministry_id)`)
            .neq('events.ministry_id', cleanMid)
            .gte('events.date_time', startDate)
            .lt('events.date_time', nextMonth);
        const conflicts: GlobalConflictMap = {};
        data?.forEach((row: any) => {
            if (row.profiles?.name) {
                const name = row.profiles.name.trim().toLowerCase();
                if (!conflicts[name]) conflicts[name] = [];
                conflicts[name].push({ ministryId: row.events.ministry_id, eventIso: row.events.date_time.slice(0, 16), role: row.role });
            }
        });
        return conflicts;
    } catch (e) { return {}; }
};

export const fetchRankingData = async (ministryId: string): Promise<RankingEntry[]> => {
    if (!supabase) return [];
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    try {
        const { data: members } = await supabase.from('profiles').select('id, name, avatar_url').or(`ministry_id.eq.${cleanMid},allowed_ministries.cs.{${cleanMid}}`);
        if (!members) return [];
        const ids = members.map((m: any) => m.id);
        const { data: assigns } = await supabase.from('schedule_assignments').select('member_id').in('member_id', ids).eq('confirmed', true);
        const { data: inters } = await supabase.from('announcement_interactions').select('user_id, interaction_type').in('user_id', ids);
        
        return members.map((m: any) => {
            const confirmed = assigns?.filter((a: any) => a.member_id === m.id).length || 0;
            const reads = inters?.filter((i: any) => i.user_id === m.id && i.interaction_type === 'read').length || 0;
            const likes = inters?.filter((i: any) => i.user_id === m.id && i.interaction_type === 'like').length || 0;
            return {
                memberId: m.id, name: m.name, avatar_url: m.avatar_url,
                points: (confirmed * 100) + (reads * 5) + (likes * 10),
                stats: { confirmedEvents: confirmed, missedEvents: 0, swapsRequested: 0, announcementsRead: reads, announcementsLiked: likes }
            };
        }).sort((a, b) => b.points - a.points);
    } catch (e) { return []; }
};

export const fetchMinistryAvailability = async (ministryId: string): Promise<{ availability: AvailabilityMap, notes: AvailabilityNotesMap }> => {
    if (isPreviewMode) return { availability: {}, notes: {} };
    if (!supabase || !ministryId) return { availability: {}, notes: {} };
    
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const { data: members } = await supabase
            .from('profiles')
            .select('id, name')
            .or(`ministry_id.eq.${cleanMid},allowed_ministries.cs.{${cleanMid}}`);
            
        if (!members || members.length === 0) return { availability: {}, notes: {} };
        
        const memberNames = members.reduce((acc: any, m: any) => { acc[m.id] = m.name; return acc; }, {});
        const memberIds = members.map((m: any) => m.id);

        const { data } = await supabase
            .from('availability')
            .select('*')
            .in('member_id', memberIds);

        const availability: AvailabilityMap = {};
        const notes: AvailabilityNotesMap = {};

        data?.forEach((row: any) => {
            const name = memberNames[row.member_id] || 'Desconhecido';
            const dbDate = row.date; 
            
            let metadata: any = {};
            let userNoteText = "";

            if (row.note) {
                try {
                    if (row.note.startsWith('{')) {
                        metadata = JSON.parse(row.note);
                        userNoteText = metadata.text || "";
                    } else {
                        userNoteText = row.note;
                    }
                } catch (e) { userNoteText = row.note; }
            }

            let uiDateKey = dbDate;

            if (metadata.period === 'M') {
                uiDateKey = `${dbDate}_M`;
            } else if (metadata.period === 'N') {
                uiDateKey = `${dbDate}_N`;
            }

            if (metadata.type !== 'GENERAL') {
                if (!availability[name]) availability[name] = [];
                availability[name].push(uiDateKey);
            }

            if (userNoteText) {
                if (metadata.type === 'GENERAL') {
                    const [y, m] = dbDate.split('-');
                    notes[`${name}_${y}-${m}-00`] = userNoteText;
                } else {
                    notes[`${name}_${dbDate}`] = userNoteText;
                }
            }
        });

        return { availability, notes };
    } catch (e) {
        console.error("Erro fetch availability:", e);
        return { availability: {}, notes: {} };
    }
};

export const saveMemberAvailability = async (
    userId: string, 
    memberName: string, 
    dates: string[], 
    targetMonth: string, 
    notes?: Record<string, string>
) => {
    if (isPreviewMode) return;
    if (!supabase) return;
    
    if (!targetMonth || targetMonth.length !== 7) {
        console.error("Mês alvo inválido:", targetMonth);
        return;
    }

    try {
        const [y, m] = targetMonth.split('-').map(Number);
        const startDate = `${targetMonth}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        const endDate = `${targetMonth}-${String(lastDay).padStart(2, '0')}`;

        const { error: deleteError } = await supabase.from('availability')
            .delete()
            .eq('member_id', userId)
            .gte('date', startDate)
            .lte('date', endDate);
        
        if (deleteError) throw deleteError;

        const rowsToInsert: any[] = [];
        
        const availableDates = dates.filter(d => d.startsWith(targetMonth));
        
        for (const uiDate of availableDates) {
            const [datePart, suffix] = uiDate.split('_'); 
            
            let metadata: any = {};
            if (suffix === 'M') metadata.period = 'M';
            if (suffix === 'N') metadata.period = 'N';
            
            rowsToInsert.push({
                member_id: userId,
                date: datePart, 
                note: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
                status: 'available' 
            });
        }

        const generalNoteKey = `${targetMonth}-00`;
        if (notes && notes[generalNoteKey]) {
            const generalText = notes[generalNoteKey];
            const firstOfMonth = `${targetMonth}-01`;
            
            rowsToInsert.push({
                member_id: userId,
                date: firstOfMonth,
                note: JSON.stringify({ type: 'GENERAL', text: generalText, period: 'ALL' }),
                status: 'available'
            });
        }

        if (rowsToInsert.length > 0) {
            const { error: insertError } = await supabase.from('availability').insert(rowsToInsert);
            if (insertError) throw insertError;
        }

    } catch (e: any) {
        console.error("Erro saving availability:", e);
    }
};

export const fetchMinistrySettings = async (ministryId: string): Promise<MinistrySettings> => {
    if (!supabase) return { displayName: '', roles: [] };
    const { data } = await supabase.from('ministry_settings').select('*').eq('ministry_id', ministryId).single();
    if (data?.spotify_client_id) localStorage.setItem(`spotify_cid_${ministryId}`, data.spotify_client_id);
    if (data?.spotify_client_secret) localStorage.setItem(`spotify_sec_${ministryId}`, data.spotify_client_secret);
    return {
        displayName: data?.display_name || '',
        roles: data?.roles || [],
        availabilityStart: data?.availability_start,
        availabilityEnd: data?.availability_end,
        spotifyClientId: data?.spotify_client_id,
        spotifyClientSecret: data?.spotify_client_secret
    };
};

export const fetchMinistrySchedule = async (ministryId: string, month: string): Promise<{ events: any[], schedule: ScheduleMap, attendance: AttendanceMap }> => {
    if (!supabase) return { events: [], schedule: {}, attendance: {} };
    
    const startDate = `${month}-01T00:00:00`;
    const [y, m] = month.split('-').map(Number);
    const nextMonth = new Date(y, m, 1).toISOString();

    const { data: eventsData } = await supabase.from('events')
        .select('*')
        .eq('ministry_id', ministryId)
        .gte('date_time', startDate)
        .lt('date_time', nextMonth)
        .order('date_time');

    const eventIds = eventsData?.map((e: any) => e.id) || [];
    
    const { data: assignmentsData } = await supabase.from('schedule_assignments')
        .select('*, profiles:member_id(name)')
        .in('event_id', eventIds);

    const schedule: ScheduleMap = {};
    const attendance: AttendanceMap = {};

    assignmentsData?.forEach((assign: any) => {
        const event = eventsData?.find((e: any) => e.id === assign.event_id);
        if (event && assign.profiles?.name) {
            const key = `${event.date_time.slice(0, 16)}_${assign.role}`;
            schedule[key] = assign.profiles.name;
            if (assign.confirmed) attendance[key] = true;
        }
    });

    const events = eventsData?.map((e: any) => ({
        id: e.id,
        title: e.title,
        date: e.date_time.slice(0, 10),
        time: e.date_time.slice(11, 16),
        iso: e.date_time.slice(0, 16),
        dateDisplay: e.date_time.slice(0, 10).split('-').reverse().join('/')
    })) || [];

    return { events, schedule, attendance };
};

export const fetchMinistryMembers = async (ministryId: string): Promise<{ memberMap: MemberMap, publicList: TeamMemberProfile[] }> => {
    if (!supabase) return { memberMap: {}, publicList: [] };
    
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const { data: members } = await supabase.from('profiles')
        .select('*')
        .or(`ministry_id.eq.${cleanMid},allowed_ministries.cs.{${cleanMid}}`)
        .order('name');

    const memberMap: MemberMap = {};
    const publicList: TeamMemberProfile[] = [];

    members?.forEach((m: any) => {
        const profile: TeamMemberProfile = {
            id: m.id,
            name: m.name,
            avatar_url: m.avatar_url,
            roles: m.functions,
            email: m.email,
            whatsapp: m.whatsapp,
            birthDate: m.birth_date,
            isAdmin: m.is_admin
        };
        publicList.push(profile);

        m.functions?.forEach((role: string) => {
            if (!memberMap[role]) memberMap[role] = [];
            memberMap[role].push(m.name);
        });
        
        // Also add to a 'default' or ALL list if needed
        if (!memberMap['Membro']) memberMap['Membro'] = [];
        memberMap['Membro'].push(m.name);
    });

    return { memberMap, publicList };
};

export const fetchNotificationsSQL = async (ministryId: string, userId: string): Promise<AppNotification[]> => {
    if (!supabase) return [];
    
    const { data } = await supabase.from('notifications')
        .select('*')
        .eq('ministry_id', ministryId)
        .order('created_at', { ascending: false })
        .limit(20);

    const { data: readData } = await supabase.from('notification_reads')
        .select('notification_id')
        .eq('user_id', userId);
        
    const readIds = new Set(readData?.map((r: any) => r.notification_id));

    return (data || []).map((n: any) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        timestamp: n.created_at,
        actionLink: n.action_link,
        read: readIds.has(n.id)
    }));
};

export const fetchAnnouncementsSQL = async (ministryId: string): Promise<Announcement[]> => {
    if (!supabase) return [];
    const today = new Date().toISOString();
    
    const { data } = await supabase.from('announcements')
        .select(`*, announcement_interactions(user_id, interaction_type, profiles(name))`)
        .eq('ministry_id', ministryId)
        .gte('expiration_date', today)
        .order('created_at', { ascending: false });

    return (data || []).map((a: any) => {
        const reads: any[] = [];
        const likes: any[] = [];
        a.announcement_interactions?.forEach((i: any) => {
            if (i.interaction_type === 'read') reads.push({ userId: i.user_id, name: i.profiles?.name, timestamp: '' });
            if (i.interaction_type === 'like') likes.push({ userId: i.user_id, name: i.profiles?.name, timestamp: '' });
        });
        return {
            id: a.id,
            title: a.title,
            message: a.message,
            type: a.type,
            timestamp: a.created_at,
            author: a.author_name || 'Liderança',
            expirationDate: a.expiration_date,
            readBy: reads,
            likedBy: likes
        };
    });
};

export const fetchSwapRequests = async (ministryId: string): Promise<SwapRequest[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('swap_requests')
        .select('*')
        .eq('ministry_id', ministryId)
        .order('created_at', { ascending: false });
    
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

export const fetchRepertoire = async (ministryId: string): Promise<RepertoireItem[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('repertoire')
        .select('*')
        .eq('ministry_id', ministryId)
        .order('event_date', { ascending: true });
        
    return (data || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        link: r.link,
        date: r.event_date,
        addedBy: r.added_by,
        createdAt: r.created_at
    }));
};

export const saveScheduleAssignment = async (ministryId: string, key: string, memberName: string) => {
    if (!supabase) return false;
    const [eventIso, role] = key.split(/_(.+)/); 
    if (!eventIso || !role) return false;

    // Find event ID first
    const { data: event } = await supabase.from('events').select('id').eq('ministry_id', ministryId).eq('date_time', eventIso).single();
    if (!event) return false;

    if (!memberName) {
        // Delete assignment
        await supabase.from('schedule_assignments').delete().eq('event_id', event.id).eq('role', role);
        return true;
    }

    // Find member ID
    const { data: member } = await supabase.from('profiles').select('id').eq('name', memberName).single();
    if (!member) return false;

    const { error } = await supabase.from('schedule_assignments').upsert({
        event_id: event.id,
        member_id: member.id,
        role: role,
        confirmed: false
    }, { onConflict: 'event_id,role' });

    return !error;
};

export const toggleAssignmentConfirmation = async (ministryId: string, key: string) => {
    if (!supabase) return false;
    const [eventIso, role] = key.split(/_(.+)/);
    const { data: event } = await supabase.from('events').select('id').eq('ministry_id', ministryId).eq('date_time', eventIso).single();
    if (!event) return false;

    const { data: current } = await supabase.from('schedule_assignments').select('confirmed').eq('event_id', event.id).eq('role', role).single();
    if (!current) return false;

    const { error } = await supabase.from('schedule_assignments').update({ confirmed: !current.confirmed }).eq('event_id', event.id).eq('role', role);
    return !error;
};

export const saveScheduleBulk = async (ministryId: string, schedule: ScheduleMap, overwrite: boolean) => {
    if (!supabase) return;
    
    // This is complex because we need event IDs and member IDs.
    // For simplicity, we iterate (not efficient but safe)
    for (const [key, memberName] of Object.entries(schedule)) {
        if (memberName) {
            await saveScheduleAssignment(ministryId, key, memberName);
        }
    }
};

export const sendNotificationSQL = async (ministryId: string, notification: Partial<AppNotification>) => {
    if (!supabase) return;
    const { error } = await supabase.from('notifications').insert({
        ministry_id: ministryId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        action_link: notification.actionLink
    });
    
    // Trigger Edge Function for Push
    if (!error) {
        supabase.functions.invoke('push-notification', { 
            body: { 
                ministryId, 
                title: notification.title, 
                message: notification.message,
                type: notification.type,
                actionLink: notification.actionLink
            } 
        });
    }
};

export const createMinistryEvent = async (ministryId: string, event: Partial<CustomEvent>) => {
    if (!supabase || !event.date || !event.time) return;
    const dateTime = `${event.date}T${event.time}`;
    await supabase.from('events').insert({
        ministry_id: ministryId,
        title: event.title,
        date_time: dateTime
    });
};

export const deleteMinistryEvent = async (ministryId: string, isoDate: string) => {
    if (!supabase) return;
    // We assume ISO string matches exactly for simplicity or we delete by ID if we had it
    await supabase.from('events').delete().eq('ministry_id', ministryId).eq('date_time', isoDate);
};

export const updateMinistryEvent = async (ministryId: string, oldIso: string, newTitle: string, newIso: string, applyToAll: boolean) => {
    if (!supabase) return;
    
    if (applyToAll) {
        // Update title for similar events in same month?
        // This logic depends on specific requirements. Implementing simple single update for now.
        const { error } = await supabase.from('events')
            .update({ title: newTitle, date_time: newIso })
            .eq('ministry_id', ministryId)
            .eq('date_time', oldIso);
    } else {
        await supabase.from('events')
            .update({ title: newTitle, date_time: newIso })
            .eq('ministry_id', ministryId)
            .eq('date_time', oldIso);
    }
};

export const clearScheduleForMonth = async (ministryId: string, month: string) => {
    if (!supabase) return;
    const startDate = `${month}-01T00:00:00`;
    const [y, m] = month.split('-').map(Number);
    const nextMonth = new Date(y, m, 1).toISOString();

    const { data: events } = await supabase.from('events').select('id').eq('ministry_id', ministryId).gte('date_time', startDate).lt('date_time', nextMonth);
    const eventIds = events?.map((e: any) => e.id) || [];
    
    if (eventIds.length > 0) {
        await supabase.from('schedule_assignments').delete().in('event_id', eventIds);
    }
};

export const resetToDefaultEvents = async (ministryId: string, month: string) => {
    // This would require a "default events" configuration per ministry
    // For now, we can just clear manually created events that don't match a pattern?
    // Or maybe just clear assignments.
    // Implementing as clear schedule for now as logic is custom.
    await clearScheduleForMonth(ministryId, month);
};

export const createSwapRequestSQL = async (ministryId: string, request: SwapRequest) => {
    if (!supabase) return false;
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
    if (!supabase) return { success: false, message: "Erro conexão" };
    
    // Transaction-like logic needed
    // 1. Get request
    const { data: req } = await supabase.from('swap_requests').select('*').eq('id', reqId).single();
    if (!req || req.status !== 'pending') return { success: false, message: "Solicitação inválida" };

    // 2. Update assignment
    const { data: event } = await supabase.from('events').select('id').eq('ministry_id', ministryId).eq('date_time', req.event_iso).single();
    if (!event) return { success: false, message: "Evento não encontrado" };

    const { error: assignError } = await supabase.from('schedule_assignments')
        .update({ member_id: takerId, confirmed: false })
        .eq('event_id', event.id)
        .eq('role', req.role)
        .eq('member_id', req.requester_id); // Ensure we are swapping the right person

    if (assignError) return { success: false, message: "Erro ao atualizar escala" };

    // 3. Update request status
    await supabase.from('swap_requests').update({ status: 'completed', taken_by_name: takerName }).eq('id', reqId);

    // 4. Notify requester
    await sendNotificationSQL(ministryId, {
        title: "Troca Aceita",
        message: `${takerName} assumiu sua escala de ${req.event_title}.`,
        type: 'success'
    });

    return { success: true, message: "Troca realizada com sucesso!" };
};

export const interactAnnouncementSQL = async (announcementId: string, userId: string, userName: string, type: 'read' | 'like') => {
    if (!supabase) return;
    
    if (type === 'read') {
        // Insert only if not exists
        await supabase.from('announcement_interactions').insert({ announcement_id: announcementId, user_id: userId, interaction_type: 'read' }).select();
    } else {
        // Toggle like
        const { data } = await supabase.from('announcement_interactions').select('id').eq('announcement_id', announcementId).eq('user_id', userId).eq('interaction_type', 'like');
        if (data && data.length > 0) {
            await supabase.from('announcement_interactions').delete().eq('id', data[0].id);
        } else {
            await supabase.from('announcement_interactions').insert({ announcement_id: announcementId, user_id: userId, interaction_type: 'like' });
        }
    }
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

export const saveMinistrySettings = async (ministryId: string, displayName?: string, roles?: string[], availabilityStart?: string, availabilityEnd?: string, spotifyClientId?: string, spotifyClientSecret?: string) => {
    if (!supabase) return;
    const updates: any = {};
    if (displayName) updates.display_name = displayName;
    if (roles) updates.roles = roles;
    if (availabilityStart) updates.availability_start = availabilityStart;
    if (availabilityEnd) updates.availability_end = availabilityEnd;
    if (spotifyClientId) updates.spotify_client_id = spotifyClientId;
    if (spotifyClientSecret) updates.spotify_client_secret = spotifyClientSecret;

    await supabase.from('ministry_settings').upsert({ ministry_id: ministryId, ...updates });
};

export const markNotificationsReadSQL = async (notificationIds: string[], userId: string) => {
    if (!supabase) return;
    const inserts = notificationIds.map(id => ({ notification_id: id, user_id: userId }));
    await supabase.from('notification_reads').insert(inserts);
};

export const clearAllNotificationsSQL = async (ministryId: string) => {
    if (!supabase) return;
    await supabase.from('notifications').delete().eq('ministry_id', ministryId);
};

export const addToRepertoire = async (ministryId: string, item: { title: string, link: string, date: string, addedBy: string }) => {
    if (!supabase) return false;
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
