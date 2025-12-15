
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
    SUPABASE_URL, SUPABASE_KEY, User, MemberMap, 
    AppNotification, TeamMemberProfile, AvailabilityMap, SwapRequest, 
    ScheduleMap, RepertoireItem, Announcement, GlobalConflictMap, 
    GlobalConflict, MinistrySettings, RankingEntry, AvailabilityNotesMap, CustomEvent
} from '../types';

let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

export const getSupabase = () => supabase;

// --- AUTHENTICATION ---

export const loginWithEmail = async (email: string, password: string) => {
    if (!supabase) return { success: false, message: "Supabase não configurado." };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, message: error.message };
    return { success: true, user: data.user };
};

export const loginWithGoogle = async () => {
    if (!supabase) return { success: false, message: "Supabase não configurado." };
    const { data, error } = await supabase.auth.signInWithOAuth({ 
        provider: 'google',
        options: { redirectTo: window.location.origin }
    });
    if (error) return { success: false, message: error.message };
    return { success: true, data };
};

export const registerWithEmail = async (email: string, password: string, name: string, ministries: string[], whatsapp?: string, roles?: string[]) => {
    if (!supabase) return { success: false, message: "Supabase não configurado." };
    
    const { data, error } = await supabase.auth.signUp({
        email, password,
        options: {
            data: { name, full_name: name } // Store name in metadata initially
        }
    });

    if (error) return { success: false, message: error.message };
    if (data.user) {
        // Create profile immediately
        const { error: profileError } = await supabase.from('profiles').insert({
            id: data.user.id,
            name,
            email,
            ministry_id: ministries[0],
            allowed_ministries: ministries,
            roles: roles || [],
            whatsapp
        });
        if (profileError) console.error("Erro ao criar perfil:", profileError);
    }

    return { success: true, message: "Cadastro realizado! Verifique seu e-mail." };
};

export const sendPasswordResetEmail = async (email: string) => {
    if (!supabase) return { success: false, message: "Supabase não configurado." };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return { success: false, message: error.message };
    return { success: true, message: "Link de redefinição enviado para o e-mail." };
};

// --- DATA FETCHING ---

export const fetchMinistrySettings = async (ministryId: string): Promise<MinistrySettings> => {
    if (!supabase || !ministryId) return { displayName: '', roles: [] };
    const { data } = await supabase.from('ministry_settings').select('*').eq('ministry_id', ministryId).single();
    if (data) {
        return {
            displayName: data.display_name,
            roles: data.roles || [],
            availabilityStart: data.availability_start,
            availabilityEnd: data.availability_end,
            spotifyClientId: data.spotify_client_id,
            spotifyClientSecret: data.spotify_client_secret
        };
    }
    return { displayName: '', roles: [] };
};

export const fetchMinistrySchedule = async (ministryId: string, month: string) => {
    if (!supabase || !ministryId) return { events: [], schedule: {}, attendance: {} };
    
    // Fetch events
    const startDate = `${month}-01`;
    const endDate = `${month}-31`; // Loose end date
    
    const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .eq('ministry_id', ministryId)
        .gte('date_time', startDate)
        .lte('date_time', endDate + 'T23:59:59');

    const events = (eventsData || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        date: e.date_time.split('T')[0],
        time: e.date_time.split('T')[1].slice(0, 5),
        iso: e.date_time.slice(0, 16)
    }));

    // Fetch assignments
    const { data: assignments } = await supabase
        .from('schedule_assignments')
        .select('event_id, role_name, member_name, is_confirmed')
        .in('event_id', events.map(e => e.id));

    const schedule: ScheduleMap = {};
    const attendance: Record<string, boolean> = {};

    assignments?.forEach((a: any) => {
        const event = events.find(e => e.id === a.event_id);
        if (event) {
            const key = `${event.iso}_${a.role_name}`;
            schedule[key] = a.member_name;
            if (a.is_confirmed) attendance[key] = true;
        }
    });

    return { events, schedule, attendance };
};

export const fetchMinistryMembers = async (ministryId: string) => {
    if (!supabase || !ministryId) return { memberMap: {}, publicList: [] };
    
    const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .or(`ministry_id.eq.${ministryId},allowed_ministries.cs.{${ministryId}}`);

    const publicList: TeamMemberProfile[] = (profiles || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        whatsapp: p.whatsapp,
        avatar_url: p.avatar_url,
        roles: p.functions || [], // Mapping functions to roles in profile
        isAdmin: p.is_admin,
        birthDate: p.birth_date
    }));

    const memberMap: MemberMap = {};
    // Populate map based on roles/functions if needed, or just list everyone
    // Ideally we group by their roles
    publicList.forEach(m => {
        m.roles?.forEach(r => {
            if (!memberMap[r]) memberMap[r] = [];
            if (!memberMap[r].includes(m.name)) memberMap[r].push(m.name);
        });
    });

    return { memberMap, publicList };
};

export const fetchMinistryAvailability = async (ministryId: string) => {
    if (!supabase || !ministryId) return { availability: {}, notes: {} };
    
    const { data } = await supabase
        .from('availability')
        .select('member_id, date, status, note, profiles(name)')
        .eq('ministry_id', ministryId);

    const availability: AvailabilityMap = {};
    const notes: AvailabilityNotesMap = {};

    data?.forEach((row: any) => {
        const name = row.profiles?.name;
        if (!name) return;

        if (!availability[name]) availability[name] = [];
        
        let dateStr = row.date;
        if (row.note) {
            try {
                const noteObj = JSON.parse(row.note);
                if (noteObj.type === 'BLOCK_MONTH') {
                    dateStr += '_BLK';
                } else if (noteObj.period === 'M') {
                    dateStr += '_M';
                } else if (noteObj.period === 'N') {
                    dateStr += '_N';
                }
                
                if (noteObj.text) {
                    notes[`${name}_${row.date.slice(0,7)}-00`] = noteObj.text;
                }
            } catch (e) {}
        }
        
        availability[name].push(dateStr);
    });

    return { availability, notes };
};

export const fetchNotificationsSQL = async (ministryIds: string[], userId: string) => {
    if (!supabase) return [];
    
    const { data } = await supabase
        .from('notifications')
        .select('*')
        .in('ministry_id', ministryIds)
        .order('created_at', { ascending: false })
        .limit(50);

    // Filter read status locally or via join if we had a user_notifications table
    // For simplicity assuming notification is global or we fetch read status separately
    // Here we will implement a simple check if the user has "read" it via a separate table `notifications_read`
    
    const { data: readData } = await supabase
        .from('notifications_read')
        .select('notification_id')
        .eq('user_id', userId);
        
    const readIds = new Set(readData?.map((r: any) => r.notification_id) || []);

    return (data || []).map((n: any) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        timestamp: n.created_at,
        read: readIds.has(n.id),
        ministryId: n.ministry_id,
        actionLink: n.action_link
    }));
};

export const fetchAnnouncementsSQL = async (ministryId: string) => {
    if (!supabase || !ministryId) return [];
    
    const today = new Date().toISOString();
    const { data } = await supabase
        .from('announcements')
        .select('*, profiles(name), announcement_reads(user_id, created_at, profiles(name)), announcement_likes(user_id, created_at, profiles(name))')
        .eq('ministry_id', ministryId)
        .gte('expiration_date', today)
        .order('created_at', { ascending: false });

    return (data || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        message: a.message,
        type: a.type,
        timestamp: a.created_at,
        expirationDate: a.expiration_date,
        author: a.profiles?.name || 'Admin',
        readBy: a.announcement_reads?.map((r: any) => ({ userId: r.user_id, name: r.profiles?.name, timestamp: r.created_at })) || [],
        likedBy: a.announcement_likes?.map((l: any) => ({ userId: l.user_id, name: l.profiles?.name, timestamp: l.created_at })) || []
    }));
};

export const fetchSwapRequests = async (ministryId: string) => {
    if (!supabase || !ministryId) return [];
    const { data } = await supabase.from('swap_requests').select('*').eq('ministry_id', ministryId).order('created_at', { ascending: false });
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

export const fetchRepertoire = async (ministryId: string) => {
    if (!supabase || !ministryId) return [];
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

export const fetchGlobalSchedules = async (month: string, currentMinistryId: string) => {
    if (!supabase) return {};
    // This requires a complex join or multiple queries. Simplified approach:
    // Fetch all assignments for the month where ministry_id != current
    // We assume 'events' table has ministry_id
    
    const startDate = `${month}-01`;
    const endDate = `${month}-31`;

    const { data: assignments } = await supabase
        .from('schedule_assignments')
        .select('role_name, member_name, events!inner(date_time, ministry_id)')
        .neq('events.ministry_id', currentMinistryId)
        .gte('events.date_time', startDate)
        .lte('events.date_time', endDate + 'T23:59:59');

    const conflicts: GlobalConflictMap = {};
    
    assignments?.forEach((a: any) => {
        const name = a.member_name.trim().toLowerCase();
        if (!conflicts[name]) conflicts[name] = [];
        conflicts[name].push({
            ministryId: a.events.ministry_id,
            eventIso: a.events.date_time.slice(0, 16),
            role: a.role_name
        });
    });

    return conflicts;
};

export const fetchRankingData = async (ministryId: string): Promise<RankingEntry[]> => {
    // This typically requires calculation. We'll try to fetch from a view or calculate from assignments/logs
    // Mock implementation for now assuming a 'ranking_stats' view exists
    if (!supabase || !ministryId) return [];
    
    try {
        const { data } = await supabase
            .from('ranking_stats') // Assume this view exists
            .select('*')
            .eq('ministry_id', ministryId)
            .order('points', { ascending: false });
            
        if (data) return data.map((r: any) => ({
            memberId: r.member_id,
            name: r.name,
            avatar_url: r.avatar_url,
            points: r.points,
            stats: r.stats || { confirmedEvents: 0, missedEvents: 0, swapsRequested: 0, announcementsRead: 0, announcementsLiked: 0 }
        }));
    } catch(e) {}
    
    return []; // Return empty if view doesn't exist yet
};

// --- MUTATIONS ---

export const saveMemberAvailability = async (
    userId: string, memberName: string, dates: string[], targetMonth: string, ministryId: string, notes?: Record<string, string>
) => {
    if (!supabase) return;
    if (!targetMonth || targetMonth.length !== 7) return;
    const cleanMid = (ministryId || 'midia').trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const [y, m] = targetMonth.split('-').map(Number);
        const startDate = `${targetMonth}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        const endDate = `${targetMonth}-${String(lastDay).padStart(2, '0')}`;

        const { error: deleteError } = await supabase.from('availability')
            .delete()
            .eq('member_id', userId)
            .eq('ministry_id', cleanMid)
            .gte('date', startDate)
            .lte('date', endDate);
        
        if (deleteError) throw deleteError;

        const rowsToInsert: any[] = [];
        const isBlocked = dates.some(d => d.includes('_BLK'));

        if (isBlocked) {
            rowsToInsert.push({
                member_id: userId,
                ministry_id: cleanMid,
                date: startDate,
                note: JSON.stringify({ type: 'BLOCK_MONTH' }),
                status: 'unavailable'
            });
        } else {
            const availableDates = dates.filter(d => d.startsWith(targetMonth) && !d.includes('_BLK'));
            for (const uiDate of availableDates) {
                const [datePart, suffix] = uiDate.split('_'); 
                let metadata: any = {};
                if (suffix === 'M') metadata.period = 'M';
                if (suffix === 'N') metadata.period = 'N';
                
                rowsToInsert.push({
                    member_id: userId,
                    ministry_id: cleanMid,
                    date: datePart, 
                    note: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
                    status: 'available' 
                });
            }
        }

        const generalNoteKey = `${targetMonth}-00`;
        // Find notes for this month
        // Notes keys are usually "MemberName_YYYY-MM-DD" or just "YYYY-MM-DD" if passed in `notes` object correctly
        // The calling component passes `notes` which seems to be keyed by `YYYY-MM-DD`
        
        const noteText = notes ? (notes[`${targetMonth}-00`] || notes[generalNoteKey]) : null;

        if (noteText) {
            const firstOfMonth = `${targetMonth}-01`;
            if (!isBlocked) {
                const existingIndex = rowsToInsert.findIndex(r => r.date === firstOfMonth);
                if (existingIndex >= 0) {
                    const existingNote = rowsToInsert[existingIndex].note ? JSON.parse(rowsToInsert[existingIndex].note) : {};
                    existingNote.text = noteText;
                    rowsToInsert[existingIndex].note = JSON.stringify(existingNote);
                } else {
                    rowsToInsert.push({
                        member_id: userId,
                        ministry_id: cleanMid,
                        date: firstOfMonth,
                        note: JSON.stringify({ type: 'GENERAL', text: noteText, period: 'ALL' }),
                        status: 'available'
                    });
                }
            } else {
                const existingIndex = rowsToInsert.findIndex(r => r.date === startDate); 
                if (existingIndex >= 0) {
                    const meta = JSON.parse(rowsToInsert[existingIndex].note || '{}');
                    meta.text = noteText;
                    rowsToInsert[existingIndex].note = JSON.stringify(meta);
                }
            }
        }

        if (rowsToInsert.length > 0) {
            const { error: insertError } = await supabase.from('availability').insert(rowsToInsert);
            if (insertError) throw insertError;
        }

    } catch (e: any) {
        console.error("Erro saving availability:", e.message || e);
        throw e;
    }
};

export const createMinistryEvent = async (ministryId: string, event: CustomEvent) => {
    if (!supabase) return;
    const dateTime = `${event.date}T${event.time}:00`;
    await supabase.from('events').insert({
        ministry_id: ministryId,
        title: event.title,
        date_time: dateTime
    });
};

export const deleteMinistryEvent = async (ministryId: string, eventIso: string) => {
    if (!supabase) return;
    // We need to find the event ID first or delete by date/ministry
    // ISO string might need conversion to match DB format perfectly
    const dateTimePrefix = eventIso.slice(0, 16); 
    // Delete event (assignments cascade if configured, otherwise might error, but standard supabase setup has cascade)
    // We'll search by timestamp-ish match
    const { data } = await supabase.from('events').select('id').eq('ministry_id', ministryId).like('date_time', `${dateTimePrefix}%`).single();
    if (data) {
        await supabase.from('events').delete().eq('id', data.id);
    }
};

export const createSwapRequestSQL = async (ministryId: string, request: Partial<SwapRequest>) => {
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

export const performSwapSQL = async (ministryId: string, requestId: string, takerName: string, takerId: string) => {
    if (!supabase) return { success: false, message: "Erro DB" };
    
    // 1. Get request
    const { data: req } = await supabase.from('swap_requests').select('*').eq('id', requestId).single();
    if (!req) return { success: false, message: "Solicitação não encontrada" };

    // 2. Find event
    const dateTimePrefix = req.event_iso.slice(0, 16);
    const { data: event } = await supabase.from('events').select('id').eq('ministry_id', ministryId).like('date_time', `${dateTimePrefix}%`).single();
    if (!event) return { success: false, message: "Evento não encontrado" };

    // 3. Update assignment
    // Find assignment for requester and role
    const { error: updateError } = await supabase.from('schedule_assignments')
        .update({ member_name: takerName, member_id: takerId, is_confirmed: false })
        .eq('event_id', event.id)
        .eq('role_name', req.role)
        .eq('member_id', req.requester_id);

    if (updateError) return { success: false, message: "Erro ao atualizar escala" };

    // 4. Close request
    await supabase.from('swap_requests').update({ status: 'completed', taken_by_name: takerName, taken_by_id: takerId }).eq('id', requestId);

    return { success: true, message: "Troca realizada com sucesso!" };
};

export const saveMinistrySettings = async (ministryId: string, displayName?: string, roles?: string[]) => {
    if (!supabase) return;
    const updates: any = {};
    if (displayName) updates.display_name = displayName;
    if (roles) updates.roles = roles;
    
    await supabase.from('ministry_settings').upsert({
        ministry_id: ministryId,
        ...updates
    });
};

export const sendNotificationSQL = async (ministryId: string, notification: Partial<AppNotification>) => {
    if (!supabase) return;
    await supabase.from('notifications').insert({
        ministry_id: ministryId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        action_link: notification.actionLink
    });
    // Trigger push via Edge Function is usually handled by DB triggers or explicit call.
    // For now assuming just DB insert.
};

export const markNotificationsReadSQL = async (notificationIds: string[], userId: string) => {
    if (!supabase) return;
    const inserts = notificationIds.map(id => ({ user_id: userId, notification_id: id }));
    await supabase.from('notifications_read').insert(inserts);
};

export const clearAllNotificationsSQL = async (ministryId: string) => {
    if (!supabase) return;
    await supabase.from('notifications').delete().eq('ministry_id', ministryId);
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
