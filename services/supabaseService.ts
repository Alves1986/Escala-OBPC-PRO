import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
    SUPABASE_URL, SUPABASE_KEY, PushSubscriptionRecord, User, MemberMap, 
    AppNotification, TeamMemberProfile, AvailabilityMap, SwapRequest, 
    ScheduleMap, RepertoireItem, Announcement, GlobalConflictMap, 
    MinistrySettings, RankingEntry, AvailabilityNotesMap, CustomEvent,
    AttendanceMap
} from '../types';

let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

export const getSupabase = () => supabase;

// --- AUTH ---

export const loginWithEmail = async (email: string, password: string) => {
    if (!supabase) return { success: false, message: "Supabase não configurado." };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, message: error.message };
    return { success: true, user: data.user };
};

export const loginWithGoogle = async () => {
    if (!supabase) return { success: false, message: "Supabase não configurado." };
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) return { success: false, message: error.message };
    return { success: true, data };
};

export const registerWithEmail = async (email: string, password: string, name: string, ministries: string[], phone?: string, functions?: string[]) => {
    if (!supabase) return { success: false, message: "Supabase não configurado." };
    const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
            data: {
                full_name: name,
                ministries: ministries
            }
        }
    });
    
    if (error) return { success: false, message: error.message };
    if (!data.user) return { success: false, message: "Erro ao criar usuário." };

    const updates = {
        id: data.user.id,
        email: email,
        name: name,
        ministry_id: ministries[0],
        allowed_ministries: ministries,
        whatsapp: phone,
        functions: functions || [],
        role: 'member'
    };

    const { error: profileError } = await supabase.from('profiles').upsert(updates);
    if (profileError) console.error("Erro ao criar perfil:", profileError);

    return { success: true, message: "Conta criada! Verifique seu e-mail." };
};

export const logout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
};

export const sendPasswordResetEmail = async (email: string) => {
    if (!supabase) return { success: false, message: "Erro." };
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' });
    if (error) return { success: false, message: error.message };
    return { success: true, message: "E-mail de recuperação enviado." };
};

// --- PROFILES & MEMBERS ---

export const fetchMinistryMembers = async (ministryId: string): Promise<{ memberMap: MemberMap, publicList: TeamMemberProfile[] }> => {
    if (!supabase) return { memberMap: {}, publicList: [] };
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    
    const { data } = await supabase
        .from('profiles')
        .select('*')
        .or(`ministry_id.eq.${cleanMid},allowed_ministries.cs.{${cleanMid}}`);

    const memberMap: MemberMap = {};
    const publicList: TeamMemberProfile[] = [];

    data?.forEach((p: any) => {
        const profile: TeamMemberProfile = {
            id: p.id,
            name: p.name,
            email: p.email,
            whatsapp: p.whatsapp,
            birthDate: p.birth_date,
            avatar_url: p.avatar_url,
            roles: p.functions || [],
            createdAt: p.created_at,
            isAdmin: p.is_admin
        };
        publicList.push(profile);

        if (p.functions && Array.isArray(p.functions)) {
            p.functions.forEach((role: string) => {
                if (!memberMap[role]) memberMap[role] = [];
                memberMap[role].push(p.name);
            });
        }
    });

    return { memberMap, publicList };
};

export const updateUserProfile = async (name: string, whatsapp: string, avatar_url?: string, functions?: string[], birthDate?: string, ministryId?: string) => {
    if (!supabase) return { success: false };
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false };

    const updates: any = {
        name,
        whatsapp,
        updated_at: new Date().toISOString(),
        functions,
        birth_date: birthDate
    };
    if (avatar_url) updates.avatar_url = avatar_url;

    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (error) return { success: false, message: error.message };
    return { success: true, message: "Perfil atualizado!" };
};

export const updateProfileMinistry = async (userId: string, ministryId: string) => {
    if (!supabase) return;
    await supabase.from('profiles').update({ ministry_id: ministryId }).eq('id', userId);
};

export const toggleAdminSQL = async (email: string, status: boolean, ministryId: string) => {
    if (!supabase) return;
    await supabase.from('profiles').update({ is_admin: status }).eq('email', email);
};

export const deleteMember = async (ministryId: string, memberId: string, memberName: string) => {
    if (!supabase) return { success: false, message: "Erro." };
    const { data: profile } = await supabase.from('profiles').select('allowed_ministries').eq('id', memberId).single();
    if (profile) {
        const newAllowed = (profile.allowed_ministries || []).filter((m: string) => m !== ministryId);
        const { error } = await supabase.from('profiles').update({ allowed_ministries: newAllowed }).eq('id', memberId);
        if (error) return { success: false, message: error.message };
        return { success: true };
    }
    return { success: false, message: "Membro não encontrado." };
};

export const joinMinistry = async (ministryId: string, roles: string[]) => {
    if (!supabase) return { success: false, message: "Erro." };
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Faça login." };

    const { data: profile } = await supabase.from('profiles').select('allowed_ministries, functions').eq('id', user.id).single();
    if (profile) {
        const allowed = new Set(profile.allowed_ministries || []);
        allowed.add(ministryId);
        
        const currentFunctions = new Set(profile.functions || []);
        roles.forEach(r => currentFunctions.add(r));

        const { error } = await supabase.from('profiles').update({ 
            allowed_ministries: Array.from(allowed),
            functions: Array.from(currentFunctions),
            ministry_id: ministryId 
        }).eq('id', user.id);

        if (error) return { success: false, message: error.message };
        return { success: true, message: "Entrou no ministério com sucesso!" };
    }
    return { success: false, message: "Perfil não encontrado." };
};

// --- SCHEDULE ---

export const fetchMinistrySchedule = async (ministryId: string, monthIso: string): Promise<{ events: CustomEvent[], schedule: ScheduleMap, attendance: AttendanceMap }> => {
    if (!supabase) return { events: [], schedule: {}, attendance: {} };
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    
    // Calculate start and end dates for the month to safely filter timestamps
    // ISO format: YYYY-MM
    const [year, month] = monthIso.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    
    const startFilter = `${monthIso}-01T00:00:00`;
    const endFilter = `${monthIso}-${String(lastDay).padStart(2, '0')}T23:59:59`;

    const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .eq('ministry_id', cleanMid)
        .gte('date_time', startFilter)
        .lte('date_time', endFilter)
        .order('date_time', { ascending: true });

    const events: CustomEvent[] = (eventsData || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        date: e.date_time.split('T')[0],
        time: e.date_time.split('T')[1].slice(0, 5),
        iso: e.date_time
    }));

    const eventIds = events.map(e => e.id);
    let assignData: any[] = [];

    if (eventIds.length > 0) {
        const { data } = await supabase
            .from('schedule_assignments')
            .select('*, events!inner(*)')
            .in('event_id', eventIds);
        assignData = data || [];
    }

    const schedule: ScheduleMap = {};
    const attendance: AttendanceMap = {};

    assignData.forEach((a: any) => {
        const evtIso = a.events.date_time.slice(0, 16); 
        const key = `${evtIso}_${a.role}`;
        schedule[key] = a.member_name;
        if (a.confirmed) attendance[key] = true;
    });

    return { events, schedule, attendance };
};

export const saveScheduleAssignment = async (ministryId: string, key: string, memberName: string) => {
    if (!supabase) return false;
    const [iso, role] = key.split('_'); 
    
    // Attempt to find event by exact match or start of ISO string (handling different timezone formats)
    let { data: event } = await supabase.from('events').select('id').eq('ministry_id', ministryId).eq('date_time', iso).maybeSingle();
    
    // Fallback: try finding by prefix if exact match fails (e.g. seconds difference)
    if (!event) {
        const { data: fallbackEvent } = await supabase.from('events').select('id').eq('ministry_id', ministryId).like('date_time', `${iso}%`).maybeSingle();
        event = fallbackEvent;
    }

    if (!event) return false;

    if (!memberName) {
        await supabase.from('schedule_assignments').delete().eq('event_id', event.id).eq('role', role);
    } else {
        const { data: member } = await supabase.from('profiles').select('id').eq('name', memberName).single();
        if (!member) return false; 

        await supabase.from('schedule_assignments').upsert({
            event_id: event.id,
            role: role,
            member_id: member.id,
            member_name: memberName,
            confirmed: false
        }, { onConflict: 'event_id, role' });
    }
    return true;
};

export const saveScheduleBulk = async (ministryId: string, schedule: ScheduleMap, clearFirst: boolean = false) => {
    if (!supabase) return;
    for (const [key, member] of Object.entries(schedule)) {
        await saveScheduleAssignment(ministryId, key, member);
    }
};

export const toggleAssignmentConfirmation = async (ministryId: string, key: string) => {
    if (!supabase) return false;
    const [iso, role] = key.split('_');
    
    let { data: event } = await supabase.from('events').select('id').eq('ministry_id', ministryId).eq('date_time', iso).maybeSingle();
    if (!event) {
        const { data: fallbackEvent } = await supabase.from('events').select('id').eq('ministry_id', ministryId).like('date_time', `${iso}%`).maybeSingle();
        event = fallbackEvent;
    }
    if (!event) return false;

    const { data: assign } = await supabase.from('schedule_assignments').select('confirmed').eq('event_id', event.id).eq('role', role).single();
    if (!assign) return false;

    await supabase.from('schedule_assignments').update({ confirmed: !assign.confirmed }).eq('event_id', event.id).eq('role', role);
    return true;
};

export const clearScheduleForMonth = async (ministryId: string, monthIso: string) => {
    if (!supabase) return;
    const [year, month] = monthIso.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const startFilter = `${monthIso}-01T00:00:00`;
    const endFilter = `${monthIso}-${String(lastDay).padStart(2, '0')}T23:59:59`;

    const { data: events } = await supabase.from('events').select('id').eq('ministry_id', ministryId).gte('date_time', startFilter).lte('date_time', endFilter);
    const ids = events?.map((e: any) => e.id) || [];
    if (ids.length > 0) {
        await supabase.from('schedule_assignments').delete().in('event_id', ids);
    }
};

export const resetToDefaultEvents = async (ministryId: string, monthIso: string) => {
    if (!supabase) return;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    
    const [year, month] = monthIso.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    
    const startFilter = `${monthIso}-01T00:00:00`;
    const endFilter = `${monthIso}-${String(lastDay).padStart(2, '0')}T23:59:59`;

    // 1. Delete existing events for this month to avoid duplicates
    await supabase.from('events')
        .delete()
        .eq('ministry_id', cleanMid)
        .gte('date_time', startFilter)
        .lte('date_time', endFilter);

    // 2. Generate recurring events
    const eventsToInsert = [];
    for (let d = 1; d <= lastDay; d++) {
        const date = new Date(year, month - 1, d);
        const dayOfWeek = date.getDay(); // 0 = Sunday, 3 = Wednesday
        const dayStr = String(d).padStart(2, '0');
        const dateStr = `${monthIso}-${dayStr}`;

        if (dayOfWeek === 0) { // Domingo
            // Manhã
            eventsToInsert.push({
                ministry_id: cleanMid,
                title: 'Culto da Manhã',
                date_time: `${dateStr}T09:30:00`,
                type: 'default'
            });
            // Noite
            eventsToInsert.push({
                ministry_id: cleanMid,
                title: 'Culto da Família',
                date_time: `${dateStr}T19:00:00`,
                type: 'default'
            });
        } else if (dayOfWeek === 3) { // Quarta
            eventsToInsert.push({
                ministry_id: cleanMid,
                title: 'Culto de Ensino',
                date_time: `${dateStr}T20:00:00`,
                type: 'default'
            });
        }
    }

    if (eventsToInsert.length > 0) {
        await supabase.from('events').insert(eventsToInsert);
    }
};

export const createMinistryEvent = async (ministryId: string, event: Partial<CustomEvent>) => {
    if (!supabase || !event.date || !event.time) return;
    const iso = `${event.date}T${event.time}`;
    await supabase.from('events').insert({
        ministry_id: ministryId,
        title: event.title,
        date_time: iso,
        type: 'custom'
    });
};

export const updateMinistryEvent = async (ministryId: string, oldIso: string, newTitle: string, newIso: string, applyToAll: boolean) => {
    if (!supabase) return;
    // Handle potentially missing ID by finding event first
    const { data: event } = await supabase.from('events').select('id').eq('ministry_id', ministryId).like('date_time', `${oldIso}%`).maybeSingle();
    
    if (event) {
        await supabase.from('events').update({ title: newTitle, date_time: newIso }).eq('id', event.id);
    }
};

export const deleteMinistryEvent = async (ministryId: string, iso: string) => {
    if (!supabase) return;
    await supabase.from('events').delete().eq('ministry_id', ministryId).like('date_time', `${iso}%`);
};

export const fetchGlobalSchedules = async (monthIso: string, excludeMinistryId: string): Promise<GlobalConflictMap> => {
    if (!supabase) return {};
    
    const [year, month] = monthIso.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const startFilter = `${monthIso}-01T00:00:00`;
    const endFilter = `${monthIso}-${String(lastDay).padStart(2, '0')}T23:59:59`;

    const { data } = await supabase
        .from('schedule_assignments')
        .select('*, events!inner(ministry_id, date_time)')
        .neq('events.ministry_id', excludeMinistryId)
        .gte('events.date_time', startFilter)
        .lte('events.date_time', endFilter);

    const conflicts: GlobalConflictMap = {};
    data?.forEach((a: any) => {
        const name = a.member_name.toLowerCase().trim();
        if (!conflicts[name]) conflicts[name] = [];
        conflicts[name].push({
            ministryId: a.events.ministry_id,
            eventIso: a.events.date_time.slice(0, 16),
            role: a.role
        });
    });
    return conflicts;
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
            .in('member_id', memberIds)
            .eq('ministry_id', cleanMid);

        const availability: AvailabilityMap = {};
        const notes: AvailabilityNotesMap = {};

        data?.forEach((row: any) => {
            const name = memberNames[row.member_id];
            if (!name) return;

            if (!availability[name]) availability[name] = [];
            
            let dbDate = row.date;
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
            if (metadata.period === 'M') uiDateKey = `${dbDate}_M`;
            else if (metadata.period === 'N') uiDateKey = `${dbDate}_N`;

            if (metadata.type === 'BLOCK_MONTH') {
                const [y, m] = dbDate.split('-');
                if (!availability[name].includes(`${y}-${m}_BLK`)) {
                    availability[name].push(`${y}-${m}_BLK`);
                }
            } else if (metadata.type !== 'GENERAL') {
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

        await supabase.from('availability')
            .delete()
            .eq('member_id', userId)
            .eq('ministry_id', cleanMid)
            .gte('date', startDate)
            .lte('date', endDate);
        
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
        const noteText = notes ? (notes[generalNoteKey] || Object.values(notes).find(v => v && v.length > 0)) : null;

        if (noteText && typeof noteText === 'string') {
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
            await supabase.from('availability').insert(rowsToInsert);
        }

    } catch (e: any) {
        console.error("Erro saving availability (Service):", e.message || e);
        throw e;
    }
};

// --- NOTIFICATIONS & ANNOUNCEMENTS ---

export const fetchNotificationsSQL = async (allowedMinistries: string[], userId: string): Promise<AppNotification[]> => {
    if (!supabase) return [];
    
    const { data: personal } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    const { data: broadcast } = await supabase.from('notifications').select('*').is('user_id', null).in('ministry_id', allowedMinistries).order('created_at', { ascending: false });

    const all = [...(personal || []), ...(broadcast || [])];
    return all.map((n: any) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        timestamp: n.created_at,
        read: n.read || false,
        actionLink: n.action_link,
        ministryId: n.ministry_id
    }));
};

export const markNotificationsReadSQL = async (ids: string[], userId: string) => {
    if (!supabase) return;
    await supabase.from('notifications').update({ read: true }).in('id', ids).eq('user_id', userId);
};

export const clearAllNotificationsSQL = async (ministryId: string) => {
    if (!supabase) return;
    await supabase.from('notifications').delete().eq('ministry_id', ministryId);
};

export const sendNotificationSQL = async (ministryId: string, notif: Partial<AppNotification>) => {
    if (!supabase) return;
    await supabase.from('notifications').insert({
        ministry_id: ministryId,
        title: notif.title,
        message: notif.message,
        type: notif.type,
        action_link: notif.actionLink,
        read: false
    });
};

export const fetchAnnouncementsSQL = async (ministryId: string): Promise<Announcement[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('announcements').select('*, announcement_interactions(*)').eq('ministry_id', ministryId).order('created_at', { ascending: false });
    
    return (data || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        message: a.message,
        type: a.type,
        timestamp: a.created_at,
        expirationDate: a.expiration_date,
        author: a.author,
        readBy: a.announcement_interactions.filter((i: any) => i.type === 'read').map((i: any) => ({ userId: i.user_id, name: i.user_name, timestamp: i.created_at })),
        likedBy: a.announcement_interactions.filter((i: any) => i.type === 'like').map((i: any) => ({ userId: i.user_id, name: i.user_name, timestamp: i.created_at }))
    }));
};

export const createAnnouncementSQL = async (ministryId: string, ann: Partial<Announcement>, authorName: string) => {
    if (!supabase) return;
    await supabase.from('announcements').insert({
        ministry_id: ministryId,
        title: ann.title,
        message: ann.message,
        type: ann.type,
        expiration_date: ann.expirationDate,
        author: authorName
    });
};

export const interactAnnouncementSQL = async (id: string, userId: string, userName: string, type: 'read' | 'like') => {
    if (!supabase) return;
    if (type === 'like') {
        const { data } = await supabase.from('announcement_interactions').select('id').eq('announcement_id', id).eq('user_id', userId).eq('type', 'like').single();
        if (data) {
            await supabase.from('announcement_interactions').delete().eq('id', data.id);
        } else {
            await supabase.from('announcement_interactions').insert({ announcement_id: id, user_id: userId, user_name: userName, type: 'like' });
        }
    } else {
        await supabase.from('announcement_interactions').upsert({ announcement_id: id, user_id: userId, user_name: userName, type: 'read' }, { onConflict: 'announcement_id, user_id, type' });
    }
};

// --- SWAPS ---

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

export const createSwapRequestSQL = async (ministryId: string, req: Partial<SwapRequest>) => {
    if (!supabase) return false;
    const { error } = await supabase.from('swap_requests').insert({
        ministry_id: ministryId,
        requester_id: req.requesterId,
        requester_name: req.requesterName,
        role: req.role,
        event_iso: req.eventIso,
        event_title: req.eventTitle,
        status: 'pending'
    });
    return !error;
};

export const performSwapSQL = async (ministryId: string, reqId: string, takerName: string, takerId: string) => {
    if (!supabase) return { success: false, message: "Erro." };
    
    const { data: req } = await supabase.from('swap_requests').select('*').eq('id', reqId).single();
    if (!req || req.status !== 'pending') return { success: false, message: "Solicitação inválida." };

    const { data: event } = await supabase.from('events').select('id').eq('ministry_id', ministryId).like('date_time', `${req.event_iso}%`).single();
    if (event) {
        await supabase.from('schedule_assignments').update({ 
            member_name: takerName, 
            member_id: takerId,
            confirmed: false 
        }).eq('event_id', event.id).eq('role', req.role);
    }

    await supabase.from('swap_requests').update({ status: 'completed', taken_by_name: takerName }).eq('id', reqId);
    return { success: true, message: "Troca realizada!" };
};

// --- REPERTOIRE ---

export const fetchRepertoire = async (ministryId: string): Promise<RepertoireItem[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('repertoire').select('*').eq('ministry_id', ministryId).order('created_at', { ascending: false });
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

// --- SETTINGS ---

export const fetchMinistrySettings = async (ministryId: string): Promise<MinistrySettings> => {
    if (!supabase) return { displayName: '', roles: [] };
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const { data } = await supabase.from('ministry_settings').select('*').eq('ministry_id', cleanMid).single();
    if (data) {
        if(data.spotify_client_id) localStorage.setItem(`spotify_cid_${cleanMid}`, data.spotify_client_id);
        if(data.spotify_client_secret) localStorage.setItem(`spotify_sec_${cleanMid}`, data.spotify_client_secret);

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
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const updates: any = { ministry_id: cleanMid };
    if (displayName !== undefined) updates.display_name = displayName;
    if (roles !== undefined) updates.roles = roles;
    if (start !== undefined) updates.availability_start = start;
    if (end !== undefined) updates.availability_end = end;

    await supabase.from('ministry_settings').upsert(updates, { onConflict: 'ministry_id' });
};

export const saveSubscriptionSQL = async (ministryId: string, sub: PushSubscription) => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const subJSON = sub.toJSON();
    await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        ministry_id: ministryId,
        endpoint: sub.endpoint,
        p256dh: subJSON.keys?.p256dh,
        auth: subJSON.keys?.auth
    }, { onConflict: 'endpoint' });
};

export const fetchRankingData = async (ministryId: string): Promise<RankingEntry[]> => {
    if (!supabase) return [];
    const { publicList } = await fetchMinistryMembers(ministryId);
    
    return publicList.map(p => ({
        memberId: p.id,
        name: p.name,
        avatar_url: p.avatar_url,
        points: 0, 
        stats: { confirmedEvents: 0, missedEvents: 0, swapsRequested: 0, announcementsRead: 0, announcementsLiked: 0 }
    }));
};