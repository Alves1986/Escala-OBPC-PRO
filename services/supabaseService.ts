import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
    AvailabilityMap, AvailabilityNotesMap, MemberMap, ScheduleMap, AttendanceMap, 
    AppNotification, Announcement, SwapRequest, RepertoireItem, TeamMemberProfile,
    MinistrySettings, GlobalConflictMap, CustomEvent, Role, User
} from '../types';
import { SUPABASE_URL, SUPABASE_KEY } from '../types';

let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
        }
    });
}

export const getSupabase = () => supabase;

// --- AUTH ---
export const loginWithEmail = async (email: string, pass: string) => {
    if (!supabase) return { success: false, message: "Erro de configuração." };
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    return { success: !error, message: error ? error.message : "Sucesso" };
};

export const loginWithGoogle = async () => {
    if (!supabase) return { success: false, message: "Erro de configuração." };
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    return { success: !error, message: error ? error.message : "Redirecionando..." };
};

export const registerWithEmail = async (email: string, pass: string, name: string, ministries: string[], phone?: string, functions?: string[]) => {
    if (!supabase) return { success: false, message: "Erro." };
    const { data, error } = await supabase.auth.signUp({ 
        email, password: pass, 
        options: { data: { name, full_name: name } } 
    });
    
    if (error) return { success: false, message: error.message };
    if (data.user) {
        const { error: profileError } = await supabase.from('profiles').upsert({
            id: data.user.id,
            email,
            name,
            ministry_id: ministries[0],
            allowed_ministries: ministries,
            whatsapp: phone,
            functions: functions
        });
        if (profileError) return { success: false, message: "Conta criada, mas erro no perfil." };
        return { success: true, message: "Conta criada! Verifique seu e-mail." };
    }
    return { success: false, message: "Erro desconhecido." };
};

export const logout = async () => {
    if (supabase) await supabase.auth.signOut();
};

export const sendPasswordResetEmail = async (email: string) => {
    if (!supabase) return { success: false, message: "Erro." };
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    return { success: !error, message: error ? error.message : "Email de recuperação enviado." };
};

// --- SETTINGS & PROFILE ---
export const fetchMinistrySettings = async (ministryId: string): Promise<MinistrySettings> => {
    if (!supabase) return { displayName: '', roles: [] };
    const { data } = await supabase.from('ministry_settings').select('*').eq('id', ministryId).single();
    if (!data) return { displayName: '', roles: [] };
    return {
        displayName: data.display_name,
        roles: data.roles || [],
        availabilityStart: data.availability_start,
        availabilityEnd: data.availability_end,
        spotifyClientId: data.spotify_client_id,
        spotifyClientSecret: data.spotify_client_secret
    };
};

export const saveMinistrySettings = async (ministryId: string, title?: string, roles?: string[], start?: string, end?: string) => {
    if (!supabase) return;
    const updates: any = {};
    if (title !== undefined) updates.display_name = title;
    if (roles !== undefined) updates.roles = roles;
    if (start !== undefined) updates.availability_start = start;
    if (end !== undefined) updates.availability_end = end;
    
    await supabase.from('ministry_settings').upsert({ id: ministryId, ...updates });
};

export const updateUserProfile = async (name: string, whatsapp: string, avatar: string | undefined, funcs: string[] | undefined, bdate: string | undefined, ministryId: string | undefined) => {
    if (!supabase) return { success: false, message: "Erro" };
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Usuário não logado" };

    const updates: any = { name, whatsapp, functions: funcs, birth_date: bdate, updated_at: new Date() };
    if (avatar) updates.avatar_url = avatar;

    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    return { success: !error, message: error ? error.message : "Perfil atualizado!" };
};

export const updateProfileMinistry = async (userId: string, ministryId: string) => {
    if (!supabase) return;
    await supabase.from('profiles').update({ ministry_id: ministryId }).eq('id', userId);
};

export const joinMinistry = async (ministryId: string, roles: string[]) => {
    if (!supabase) return { success: false, message: "Erro" };
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Usuário não logado" };

    const { data: profile } = await supabase.from('profiles').select('allowed_ministries, functions').eq('id', user.id).single();
    const currentMinistries = profile?.allowed_ministries || [];
    const currentRoles = profile?.functions || [];

    const newMinistries = [...new Set([...currentMinistries, ministryId])];
    const newRoles = [...new Set([...currentRoles, ...roles])];

    const { error } = await supabase.from('profiles').update({ 
        allowed_ministries: newMinistries,
        functions: newRoles,
        ministry_id: ministryId 
    }).eq('id', user.id);

    return { success: !error, message: error ? error.message : "Bem-vindo ao novo ministério!" };
};

// --- DATA FETCHING ---
export const fetchMinistrySchedule = async (ministryId: string, month: string) => {
    if (!supabase) return { events: [], schedule: {}, attendance: {} };
    
    // Get Events
    const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .eq('ministry_id', ministryId)
        .like('date_time', `${month}%`);

    // Get Assignments
    const { data: assignments } = await supabase
        .from('schedule_assignments')
        .select('*')
        .eq('ministry_id', ministryId)
        .like('event_date', `${month}%`);

    const events = (eventsData || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        date: e.date_time.split('T')[0],
        time: e.date_time.split('T')[1].slice(0, 5),
        iso: e.date_time.slice(0, 16),
        dateDisplay: new Date(e.date_time).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    }));

    const schedule: ScheduleMap = {};
    const attendance: AttendanceMap = {};
    (assignments || []).forEach((a: any) => {
        const key = `${a.event_date}T${a.event_time}_${a.role}`;
        schedule[key] = a.member_name;
        if (a.confirmed) attendance[key] = true;
    });

    return { events, schedule, attendance };
};

export const fetchMinistryMembers = async (ministryId: string) => {
    if (!supabase) return { memberMap: {}, publicList: [] };
    
    const { data } = await supabase
        .from('profiles')
        .select('*')
        .or(`ministry_id.eq.${ministryId},allowed_ministries.cs.{${ministryId}}`);

    const members = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        whatsapp: p.whatsapp,
        avatar_url: p.avatar_url,
        roles: p.functions || [],
        isAdmin: p.is_admin,
        birthDate: p.birth_date,
        ministryId: p.ministry_id
    }));

    const memberMap: MemberMap = {};
    members.forEach((m: any) => {
        m.roles.forEach((r: string) => {
            if (!memberMap[r]) memberMap[r] = [];
            memberMap[r].push(m.name);
        });
    });

    return { memberMap, publicList: members };
};

// --- AVAILABILITY ---
export const fetchMinistryAvailability = async (ministryId: string): Promise<{ availability: AvailabilityMap, notes: AvailabilityNotesMap }> => {
    if (!supabase) return { availability: {}, notes: {} };
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    try {
        const { data: members } = await supabase.from('profiles').select('id, name')
            .or(`ministry_id.eq.${cleanMid},allowed_ministries.cs.{${cleanMid}}`);
        if (!members || members.length === 0) return { availability: {}, notes: {} };
        const memberNames = members.reduce((acc: any, m: any) => { acc[m.id] = m.name; return acc; }, {});
        const memberIds = members.map((m: any) => m.id);
        const { data } = await supabase.from('availability').select('*').eq('ministry_id', cleanMid).in('member_id', memberIds);
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
                    } else { userNoteText = row.note; }
                } catch (e) { userNoteText = row.note; }
            }
            let uiDateKey = dbDate;
            if (metadata.period === 'M') uiDateKey = `${dbDate}_M`;
            else if (metadata.period === 'N') uiDateKey = `${dbDate}_N`;
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
                } else { notes[`${name}_${dbDate}`] = userNoteText; }
            }
        });
        return { availability, notes };
    } catch (e) { return { availability: {}, notes: {} }; }
};

export const saveMemberAvailability = async (ministryId: string, userId: string, memberName: string, dates: string[], targetMonth: string, notes?: Record<string, string>) => {
    if (!supabase) return;
    if (!targetMonth || targetMonth.length !== 7) return;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    try {
        const [y, m] = targetMonth.split('-').map(Number);
        const startDate = `${targetMonth}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        const endDate = `${targetMonth}-${String(lastDay).padStart(2, '0')}`;
        await supabase.from('availability').delete().eq('ministry_id', cleanMid).eq('member_id', userId).gte('date', startDate).lte('date', endDate);
        const rowsToInsert: any[] = [];
        const isBlocked = dates.some(d => d.includes('_BLK'));
        if (isBlocked) {
            rowsToInsert.push({ ministry_id: cleanMid, member_id: userId, date: startDate, note: JSON.stringify({ type: 'BLOCK_MONTH' }), status: 'unavailable' });
        } else {
            const availableDates = dates.filter(d => d.startsWith(targetMonth));
            for (const uiDate of availableDates) {
                const [datePart, suffix] = uiDate.split('_'); 
                let metadata: any = {};
                if (suffix === 'M') metadata.period = 'M';
                if (suffix === 'N') metadata.period = 'N';
                rowsToInsert.push({ ministry_id: cleanMid, member_id: userId, date: datePart, note: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null, status: 'available' });
            }
        }
        const generalNoteKey = `${targetMonth}-00`;
        if (notes && notes[generalNoteKey] && !isBlocked) {
            rowsToInsert.push({ ministry_id: cleanMid, member_id: userId, date: `${targetMonth}-01`, note: JSON.stringify({ type: 'GENERAL', text: notes[generalNoteKey], period: 'ALL' }), status: 'available' });
        }
        if (rowsToInsert.length > 0) await supabase.from('availability').insert(rowsToInsert);
    } catch (e) { console.error("Error saving availability", e); }
};

// --- SCHEDULE & EVENTS ---
export const saveScheduleAssignment = async (ministryId: string, key: string, memberName: string) => {
    if (!supabase) return false;
    const [iso, role] = key.split('_');
    const [date, time] = iso.split('T');
    
    if (!memberName) {
        await supabase.from('schedule_assignments').delete()
            .eq('ministry_id', ministryId).eq('event_date', date).eq('event_time', time).eq('role', role);
    } else {
        // Fetch member ID if possible, but store name for now
        const { data: member } = await supabase.from('profiles').select('id').eq('name', memberName).single();
        await supabase.from('schedule_assignments').upsert({
            ministry_id: ministryId,
            event_date: date,
            event_time: time,
            role,
            member_name: memberName,
            member_id: member?.id
        }, { onConflict: 'ministry_id,event_date,event_time,role' });
    }
    return true;
};

export const saveScheduleBulk = async (ministryId: string, schedule: ScheduleMap, force: boolean = false) => {
    if (!supabase) return;
    const promises = Object.entries(schedule).map(([key, name]) => saveScheduleAssignment(ministryId, key, name));
    await Promise.all(promises);
};

export const toggleAssignmentConfirmation = async (ministryId: string, key: string) => {
    if (!supabase) return false;
    const [iso, role] = key.split('_');
    const [date, time] = iso.split('T');
    
    const { data } = await supabase.from('schedule_assignments')
        .select('confirmed')
        .eq('ministry_id', ministryId).eq('event_date', date).eq('event_time', time).eq('role', role)
        .single();
        
    if (data) {
        await supabase.from('schedule_assignments')
            .update({ confirmed: !data.confirmed })
            .eq('ministry_id', ministryId).eq('event_date', date).eq('event_time', time).eq('role', role);
        return true;
    }
    return false;
};

export const createMinistryEvent = async (ministryId: string, event: { title: string, date: string, time: string }) => {
    if (!supabase) return;
    await supabase.from('events').insert({
        ministry_id: ministryId,
        title: event.title,
        date_time: `${event.date}T${event.time}`
    });
};

export const deleteMinistryEvent = async (ministryId: string, iso: string) => {
    if (!supabase) return;
    await supabase.from('events').delete().eq('ministry_id', ministryId).eq('date_time', iso);
    // Cascade delete assignments
    const [date, time] = iso.split('T');
    await supabase.from('schedule_assignments').delete().eq('ministry_id', ministryId).eq('event_date', date).eq('event_time', time);
};

export const updateMinistryEvent = async (ministryId: string, oldIso: string, newTitle: string, newIso: string, applyToAll: boolean) => {
    if (!supabase) return;
    if (applyToAll) {
        // Logic to update recurrent events is complex, simplified here
        await supabase.from('events').update({ title: newTitle }).eq('ministry_id', ministryId).eq('date_time', oldIso);
    } else {
        await supabase.from('events').update({ title: newTitle, date_time: newIso }).eq('ministry_id', ministryId).eq('date_time', oldIso);
    }
};

export const clearScheduleForMonth = async (ministryId: string, month: string) => {
    if (!supabase) return;
    await supabase.from('schedule_assignments').delete().eq('ministry_id', ministryId).like('event_date', `${month}%`);
};

export const resetToDefaultEvents = async (ministryId: string, month: string) => {
    // Placeholder logic
    await clearScheduleForMonth(ministryId, month);
};

// --- COMMUNICATION ---
export const fetchNotificationsSQL = async (ministries: string[], userId: string) => {
    if (!supabase) return [];
    // Assuming a notification system in DB
    return []; // Placeholder
};

export const fetchAnnouncementsSQL = async (ministryId: string) => {
    if (!supabase) return [];
    const { data } = await supabase.from('announcements')
        .select('*')
        .eq('ministry_id', ministryId)
        .gt('expiration_date', new Date().toISOString())
        .order('created_at', { ascending: false });
        
    return (data || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        message: a.message,
        type: a.type,
        timestamp: a.created_at,
        expirationDate: a.expiration_date,
        author: a.author_name,
        readBy: a.read_by || [],
        likedBy: a.liked_by || []
    }));
};

export const createAnnouncementSQL = async (ministryId: string, announcement: any, authorName: string) => {
    if (!supabase) return;
    await supabase.from('announcements').insert({
        ministry_id: ministryId,
        title: announcement.title,
        message: announcement.message,
        type: announcement.type,
        expiration_date: announcement.expirationDate,
        author_name: authorName,
        read_by: [],
        liked_by: []
    });
};

export const interactAnnouncementSQL = async (id: string, userId: string, userName: string, action: 'read' | 'like') => {
    if (!supabase) return;
    const { data: ann } = await supabase.from('announcements').select('read_by, liked_by').eq('id', id).single();
    if (!ann) return;

    if (action === 'read') {
        const readBy = ann.read_by || [];
        if (!readBy.some((r: any) => r.userId === userId)) {
            readBy.push({ userId, name: userName, timestamp: new Date().toISOString() });
            await supabase.from('announcements').update({ read_by: readBy }).eq('id', id);
        }
    } else if (action === 'like') {
        let likedBy = ann.liked_by || [];
        if (likedBy.some((l: any) => l.userId === userId)) {
            likedBy = likedBy.filter((l: any) => l.userId !== userId);
        } else {
            likedBy.push({ userId, name: userName, timestamp: new Date().toISOString() });
        }
        await supabase.from('announcements').update({ liked_by: likedBy }).eq('id', id);
    }
};

export const sendNotificationSQL = async (ministryId: string, notification: any) => {
    if (!supabase) return;
    // Call Edge Function for Push
    await supabase.functions.invoke('push-notification', {
        body: { ministryId, ...notification }
    });
};

export const markNotificationsReadSQL = async (ids: string[], userId: string) => {
    // Placeholder
};

export const clearAllNotificationsSQL = async (ministryId: string) => {
    // Placeholder
};

export const saveSubscriptionSQL = async (ministryId: string, sub: any) => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        ministry_id: ministryId
    }, { onConflict: 'endpoint' });
};

// --- MISC ---
export const fetchSwapRequests = async (ministryId: string) => {
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

export const createSwapRequestSQL = async (ministryId: string, req: any) => {
    if (!supabase) return false;
    const { error } = await supabase.from('swap_requests').insert({
        ministry_id: ministryId,
        requester_name: req.requesterName,
        requester_id: req.requesterId,
        role: req.role,
        event_iso: req.eventIso,
        event_title: req.eventTitle,
        status: 'pending'
    });
    return !error;
};

export const performSwapSQL = async (ministryId: string, reqId: string, userName: string, userId: string) => {
    if (!supabase) return { success: false, message: "Erro" };
    
    const { data: req } = await supabase.from('swap_requests').select('*').eq('id', reqId).single();
    if (!req) return { success: false, message: "Solicitação não encontrada" };

    // Update Schedule
    const [date, time] = req.event_iso.split('T');
    await supabase.from('schedule_assignments').update({ member_name: userName, member_id: userId, confirmed: true })
        .eq('ministry_id', ministryId).eq('event_date', date).eq('event_time', time).eq('role', req.role);

    // Update Request
    await supabase.from('swap_requests').update({ status: 'completed', taken_by_name: userName }).eq('id', reqId);
    
    return { success: true, message: "Troca realizada com sucesso!" };
};

export const fetchRepertoire = async (ministryId: string) => {
    if (!supabase) return [];
    const { data } = await supabase.from('repertoire').select('*').eq('ministry_id', ministryId).order('date', { ascending: false });
    return (data || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        link: r.link,
        date: r.date,
        addedBy: r.added_by,
        createdAt: r.created_at
    }));
};

export const addToRepertoire = async (ministryId: string, item: any) => {
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

export const fetchGlobalSchedules = async (month: string, currentMinistryId: string) => {
    if (!supabase) return {};
    // Fetch conflicts (schedules in other ministries)
    // Simplified: Return empty for now as it requires complex joins or multiple queries
    return {};
};

export const fetchRankingData = async (ministryId: string) => {
    if (!supabase) return [];
    // Mocking ranking calculation logic for now as it requires aggregation
    return [];
};

export const toggleAdminSQL = async (email: string, status: boolean, ministryId: string) => {
    if (!supabase) return;
    await supabase.functions.invoke('push-notification', {
        body: { action: 'toggle_admin', targetEmail: email, status, ministryId }
    });
};

export const deleteMember = async (ministryId: string, id: string, name: string) => {
    if (!supabase) return { success: false, message: "Erro" };
    const { error } = await supabase.functions.invoke('push-notification', {
        body: { action: 'delete_member', memberId: id, ministryId }
    });
    return { success: !error, message: error ? "Erro ao remover" : "Membro removido" };
};
