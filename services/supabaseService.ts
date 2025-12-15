
import { createClient } from '@supabase/supabase-js';
import { 
    SUPABASE_URL, SUPABASE_KEY, 
    AvailabilityMap, AvailabilityNotesMap, 
    MinistrySettings, User, TeamMemberProfile, 
    Announcement, AppNotification, RepertoireItem, SwapRequest,
    GlobalConflictMap, MemberMap, ScheduleMap, AttendanceMap,
    DEFAULT_ROLES
} from '../types';

export const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

export const getSupabase = () => supabase;

// --- AUTH ---
export const loginWithEmail = async (email: string, password: string) => {
    if (!supabase) return { success: false, message: "Erro de conexão" };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, message: error.message };
    return { success: true, user: data.user };
};

export const loginWithGoogle = async () => {
    if (!supabase) return { success: false, message: "Erro de conexão" };
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) return { success: false, message: error.message };
    return { success: true, data };
};

export const registerWithEmail = async (email: string, password: string, name: string, ministries: string[], whatsapp?: string, roles?: string[]) => {
    if (!supabase) return { success: false, message: "Erro de conexão" };
    const { data, error } = await supabase.auth.signUp({
        email, password,
        options: {
            data: { full_name: name, name: name }
        }
    });
    if (error) return { success: false, message: error.message };
    if (data.user) {
        await supabase.from('profiles').upsert({
            id: data.user.id,
            email,
            name,
            ministry_id: ministries[0],
            allowed_ministries: ministries,
            whatsapp,
            functions: roles
        });
    }
    return { success: true, message: "Conta criada! Verifique seu e-mail." };
};

export const sendPasswordResetEmail = async (email: string) => {
    if (!supabase) return { success: false, message: "Erro de conexão" };
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) return { success: false, message: error.message };
    return { success: true, message: "Email de recuperação enviado." };
};

// --- SETTINGS ---
export const fetchMinistrySettings = async (ministryId: string): Promise<MinistrySettings> => {
    if (!supabase) return { displayName: '', roles: [] };
    const cleanId = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const { data } = await supabase.from('ministry_settings').select('*').eq('ministry_id', cleanId).single();
    if (data) {
        return {
            displayName: data.display_name,
            roles: data.roles || DEFAULT_ROLES[cleanId] || [],
            availabilityStart: data.availability_start,
            availabilityEnd: data.availability_end
        };
    }
    return { displayName: '', roles: DEFAULT_ROLES[cleanId] || [] };
};

export const saveMinistrySettings = async (ministryId: string, displayName?: string, roles?: string[], start?: string, end?: string) => {
    if (!supabase) return;
    const cleanId = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const updates: any = { ministry_id: cleanId };
    if (displayName) updates.display_name = displayName;
    if (roles) updates.roles = roles;
    if (start !== undefined) updates.availability_start = start;
    if (end !== undefined) updates.availability_end = end;

    await supabase.from('ministry_settings').upsert(updates, { onConflict: 'ministry_id' });
};

// --- SCHEDULE & EVENTS ---
export const fetchMinistrySchedule = async (ministryId: string, month: string) => {
    if (!supabase) return { events: [], schedule: {}, attendance: {} };
    const cleanId = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    
    // Fetch Events
    const { data: eventsData } = await supabase.from('events')
        .select('*')
        .eq('ministry_id', cleanId)
        .ilike('date', `${month}%`);
    
    const events = (eventsData || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        date: e.date,
        time: e.time,
        iso: `${e.date}T${e.time}`,
        dateDisplay: e.date.split('-').reverse().slice(0, 2).join('/')
    }));

    // Fetch Assignments (Schedule)
    const { data: assignments } = await supabase.from('schedule_assignments')
        .select('*')
        .eq('ministry_id', cleanId)
        .in('event_id', events.map(e => e.id));

    const schedule: ScheduleMap = {};
    const attendance: AttendanceMap = {};

    assignments?.forEach((a: any) => {
        const event = events.find(e => e.id === a.event_id);
        if (event) {
            const key = `${event.iso}_${a.role}`;
            schedule[key] = a.member_name;
            if (a.confirmed) attendance[key] = true;
        }
    });

    return { events, schedule, attendance };
};

export const createMinistryEvent = async (ministryId: string, event: { title: string, date: string, time: string }) => {
    if (!supabase) return;
    const cleanId = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    await supabase.from('events').insert({
        ministry_id: cleanId,
        title: event.title,
        date: event.date,
        time: event.time
    });
};

export const deleteMinistryEvent = async (ministryId: string, isoOrId: string) => {
    if (!supabase) return;
    const isIso = isoOrId.includes('T');
    let query = supabase.from('events').delete().eq('ministry_id', ministryId);
    
    if (isIso) {
        const [date, time] = isoOrId.split('T');
        query = query.eq('date', date).eq('time', time);
    } else {
        query = query.eq('id', isoOrId);
    }
    await query;
};

// --- MEMBERS ---
export const fetchMinistryMembers = async (ministryId: string) => {
    if (!supabase) return { memberMap: {}, publicList: [] };
    const cleanId = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    
    const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .or(`ministry_id.eq.${cleanId},allowed_ministries.cs.{${cleanId}}`);

    const memberMap: MemberMap = {};
    const publicList: TeamMemberProfile[] = [];

    profiles?.forEach((p: any) => {
        publicList.push({
            id: p.id,
            name: p.name,
            email: p.email,
            whatsapp: p.whatsapp,
            avatar_url: p.avatar_url,
            birthDate: p.birth_date,
            roles: p.functions,
            isAdmin: p.is_admin
        });

        p.functions?.forEach((role: string) => {
            if (!memberMap[role]) memberMap[role] = [];
            memberMap[role].push(p.name);
        });
    });

    return { memberMap, publicList };
};

export const deleteMember = async (ministryId: string, memberId: string, name: string) => {
    if (!supabase) return { success: false };
    // Usually handled via Edge Function for safety, but here is a direct implementation attempt or placeholder
    const { error } = await supabase.functions.invoke('push-notification', {
        body: { action: 'delete_member', ministryId, memberId, name }
    });
    if (error) return { success: false, message: error.message };
    return { success: true };
};

export const toggleAdminSQL = async (email: string, status: boolean, ministryId: string) => {
    if (!supabase) return;
    await supabase.from('profiles').update({ is_admin: status }).eq('email', email);
};

export const updateUserProfile = async (name: string, whatsapp: string, avatar_url?: string, functions?: string[], birthDate?: string, ministryId?: string) => {
    if (!supabase) return { success: false, message: "Erro conexão" };
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Usuário não logado" };

    const updates: any = { 
        name, 
        whatsapp, 
        functions, 
        birth_date: birthDate,
        updated_at: new Date()
    };
    if (avatar_url) updates.avatar_url = avatar_url;

    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (error) return { success: false, message: error.message };
    return { success: true, message: "Perfil atualizado!" };
};

// --- AVAILABILITY ---
export const fetchMinistryAvailability = async (ministryId: string): Promise<{ availability: AvailabilityMap, notes: AvailabilityNotesMap }> => {
    if (!supabase) return { availability: {}, notes: {} };
    
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
            .or(`ministry_id.eq.${cleanMid},ministry_id.is.null`)
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

            if (metadata.type === 'BLOCK_MONTH') {
                const [y, m] = dbDate.split('-');
                if (!availability[name]) availability[name] = [];
                availability[name].push(`${y}-${m}_BLK`);
            } else if (metadata.type !== 'GENERAL') {
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
    ministryId: string, 
    userId: string, 
    memberName: string, 
    dates: string[], 
    targetMonth: string, 
    notes?: Record<string, string>
) => {
    if (!supabase) return { success: false, message: "Erro de conexão" };
    
    if (!targetMonth || targetMonth.length !== 7) return { success: false, message: "Mês inválido" };
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const [y, m] = targetMonth.split('-').map(Number);
        const startDate = `${targetMonth}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        const endDate = `${targetMonth}-${String(lastDay).padStart(2, '0')}`;

        const { error: deleteError } = await supabase.from('availability')
            .delete()
            .eq('member_id', userId)
            .gte('date', startDate)
            .lte('date', endDate)
            .or(`ministry_id.eq.${cleanMid},ministry_id.is.null`);
        
        if (deleteError) throw deleteError;

        const rowsToInsert: any[] = [];
        const isBlocked = dates.some(d => d.includes('_BLK'));

        if (isBlocked) {
            rowsToInsert.push({
                ministry_id: cleanMid,
                member_id: userId,
                date: startDate,
                note: JSON.stringify({ type: 'BLOCK_MONTH' }),
                status: 'unavailable'
            });
        } else {
            const availableDates = dates.filter(d => d.startsWith(targetMonth));
            
            for (const uiDate of availableDates) {
                const [datePart, suffix] = uiDate.split('_'); 
                let metadata: any = {};
                if (suffix === 'M') metadata.period = 'M';
                if (suffix === 'N') metadata.period = 'N';
                
                rowsToInsert.push({
                    ministry_id: cleanMid,
                    member_id: userId,
                    date: datePart, 
                    note: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
                    status: 'available' 
                });
            }
        }

        const generalNoteKey = `${targetMonth}-00`;
        if (notes && notes[generalNoteKey]) {
            const generalText = notes[generalNoteKey];
            const firstOfMonth = `${targetMonth}-01`;
            if (!isBlocked) {
                rowsToInsert.push({
                    ministry_id: cleanMid,
                    member_id: userId,
                    date: firstOfMonth,
                    note: JSON.stringify({ type: 'GENERAL', text: generalText, period: 'ALL' }),
                    status: 'available'
                });
            }
        }

        if (rowsToInsert.length > 0) {
            const { error: insertError } = await supabase.from('availability').insert(rowsToInsert);
            if (insertError) throw insertError;
        }

        return { success: true };

    } catch (e: any) {
        console.error("Erro saving availability:", e);
        return { success: false, message: e.message || "Erro ao salvar" };
    }
};

// --- NOTIFICATIONS ---
export const fetchNotificationsSQL = async (ministryIds: string[], userId: string) => {
    if (!supabase) return [];
    // Assuming simple table structure or logic
    const { data } = await supabase.from('notifications')
        .select('*')
        .or(`ministry_id.in.(${ministryIds.join(',')}),target_user_id.eq.${userId}`)
        .order('created_at', { ascending: false });
    return (data || []).map((n: any) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        timestamp: n.created_at,
        read: n.read_users?.includes(userId),
        ministryId: n.ministry_id,
        actionLink: n.action_link
    }));
};

export const markNotificationsReadSQL = async (ids: string[], userId: string) => {
    if (!supabase) return;
    // This is complex in SQL, usually stored as array of read_users.
    // Simplifying: call RPC or just update if structure permits.
    // Assuming 'notifications' has 'read_users' array column
    for (const id of ids) {
        const { data } = await supabase.from('notifications').select('read_users').eq('id', id).single();
        const readers = data?.read_users || [];
        if (!readers.includes(userId)) {
            await supabase.from('notifications').update({ read_users: [...readers, userId] }).eq('id', id);
        }
    }
};

export const clearAllNotificationsSQL = async (ministryId: string) => {
    if (!supabase) return;
    await supabase.from('notifications').delete().eq('ministry_id', ministryId);
};

export const sendNotificationSQL = async (ministryId: string, notification: Partial<AppNotification>) => {
    if (!supabase) return;
    await supabase.from('notifications').insert({
        ministry_id: ministryId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        action_link: notification.actionLink,
        read_users: []
    });
    // Trigger push notification via Edge Function if needed
    await supabase.functions.invoke('push-notification', {
        body: { ministryId, ...notification }
    });
};

// --- ANNOUNCEMENTS ---
export const fetchAnnouncementsSQL = async (ministryId: string) => {
    if (!supabase) return [];
    const { data } = await supabase.from('announcements')
        .select('*')
        .eq('ministry_id', ministryId)
        .order('created_at', { ascending: false });
    
    return (data || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        message: a.message,
        type: a.type,
        timestamp: a.created_at,
        author: a.author,
        readBy: a.read_by || [],
        likedBy: a.liked_by || [],
        expirationDate: a.expiration_date
    }));
};

export const createAnnouncementSQL = async (ministryId: string, announcement: Partial<Announcement>, authorName: string) => {
    if (!supabase) return;
    await supabase.from('announcements').insert({
        ministry_id: ministryId,
        title: announcement.title,
        message: announcement.message,
        type: announcement.type,
        expiration_date: announcement.expirationDate,
        author: authorName
    });
};

export const interactAnnouncementSQL = async (id: string, userId: string, userName: string, action: 'read' | 'like') => {
    if (!supabase) return;
    const { data } = await supabase.from('announcements').select('read_by, liked_by').eq('id', id).single();
    if (!data) return;

    if (action === 'read') {
        const reads = data.read_by || [];
        if (!reads.some((r: any) => r.userId === userId)) {
            await supabase.from('announcements').update({ 
                read_by: [...reads, { userId, name: userName, timestamp: new Date().toISOString() }] 
            }).eq('id', id);
        }
    } else if (action === 'like') {
        const likes = data.liked_by || [];
        if (likes.some((l: any) => l.userId === userId)) {
            // Unlike
            await supabase.from('announcements').update({ 
                liked_by: likes.filter((l: any) => l.userId !== userId) 
            }).eq('id', id);
        } else {
            // Like
            await supabase.from('announcements').update({ 
                liked_by: [...likes, { userId, name: userName, timestamp: new Date().toISOString() }] 
            }).eq('id', id);
        }
    }
};

// --- SWAP REQUESTS ---
export const fetchSwapRequests = async (ministryId: string) => {
    if (!supabase) return [];
    const { data } = await supabase.from('swap_requests')
        .select('*')
        .eq('ministry_id', ministryId)
        .order('created_at', { ascending: false });
    
    return (data || []).map((s: any) => ({
        id: s.id,
        ministryId: s.ministry_id,
        requesterName: s.requester_name,
        requesterId: s.requester_id,
        role: s.role,
        eventIso: s.event_iso,
        eventTitle: s.event_title,
        status: s.status,
        createdAt: s.created_at,
        takenByName: s.taken_by_name
    }));
};

export const createSwapRequestSQL = async (ministryId: string, request: SwapRequest) => {
    if (!supabase) return false;
    const { error } = await supabase.from('swap_requests').insert({
        ministry_id: ministryId,
        requester_name: request.requesterName,
        requester_id: request.requesterId,
        role: request.role,
        event_iso: request.eventIso,
        event_title: request.eventTitle,
        status: 'pending'
    });
    return !error;
};

export const performSwapSQL = async (ministryId: string, reqId: string, takerName: string, takerId: string) => {
    if (!supabase) return { success: false, message: "Erro conexão" };
    // Transactional logic is complex here, simplifying
    const { data: req } = await supabase.from('swap_requests').select('*').eq('id', reqId).single();
    if (!req || req.status !== 'pending') return { success: false, message: "Solicitação inválida." };

    // Update Request
    await supabase.from('swap_requests').update({ 
        status: 'completed', 
        taken_by_name: takerName,
        taken_by_id: takerId
    }).eq('id', reqId);

    // Update Schedule
    // Find event id from iso? Or assume iso is unique enough for query
    // We need to find the assignment.
    // Simplification: query assignments by date/time (iso) and role and requester
    const [date, time] = req.event_iso.split('T');
    const { data: event } = await supabase.from('events').select('id').eq('ministry_id', ministryId).eq('date', date).eq('time', time).single();
    
    if (event) {
        await supabase.from('schedule_assignments')
            .update({ member_name: takerName, member_id: takerId, confirmed: false })
            .eq('event_id', event.id)
            .eq('role', req.role);
    }

    return { success: true, message: "Troca realizada!" };
};

// --- REPERTOIRE ---
export const fetchRepertoire = async (ministryId: string) => {
    if (!supabase) return [];
    const { data } = await supabase.from('repertoire')
        .select('*')
        .eq('ministry_id', ministryId)
        .order('date', { ascending: false });
    
    return (data || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        link: r.link,
        date: r.date,
        addedBy: r.added_by,
        createdAt: r.created_at
    }));
};

export const addToRepertoire = async (ministryId: string, item: Partial<RepertoireItem>) => {
    if (!supabase) return false;
    const { error } = await supabase.from('repertoire').insert({
        ministry_id: ministryId,
        title: item.title,
        link: item.link,
        date: item.date,
        added_by: item.addedBy
    });
    return !error;
};

export const deleteFromRepertoire = async (id: string) => {
    if (!supabase) return;
    await supabase.from('repertoire').delete().eq('id', id);
};

// --- GLOBAL ---
export const fetchGlobalSchedules = async (month: string, currentMinistryId: string): Promise<GlobalConflictMap> => {
    if (!supabase) return {};
    // Fetch all assignments for this month excluding current ministry
    // This requires a view or complex query. Simplified:
    // Fetch assignments where ministry_id != currentMinistryId and date like month
    // Need to join with events to filter by date
    // Placeholder implementation
    return {};
};

export const fetchRankingData = async (ministryId: string) => {
    if (!supabase) return [];
    // Assuming a view or calculation function in DB
    const { data } = await supabase.rpc('get_ranking', { ministry_id_param: ministryId });
    // Or mock/simple fetch
    return data || [];
};
