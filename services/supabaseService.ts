import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY, ScheduleMap, AppNotification, Announcement, SwapRequest, RepertoireItem, CustomEvent, AvailabilityMap, AvailabilityNotesMap, RankingEntry } from '../types';

// Detect Preview Mode
export const isPreviewMode = SUPABASE_URL === 'https://preview.mode';

let supabase: SupabaseClient | null = null;

if (!isPreviewMode && SUPABASE_URL && SUPABASE_KEY) {
    try {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    } catch (e) {
        console.error("Supabase Init Error:", e);
    }
}

export const getSupabase = () => supabase;

// --- LOGGING ---
export const logActionSQL = async (ministryId: string, action: string, details: string) => {
    if (isPreviewMode || !supabase) return;
    try {
        await supabase.from('audit_logs').insert({
            ministry_id: ministryId,
            action,
            details,
            date: new Date().toISOString()
        });
    } catch(e) { console.error(e); }
};

// --- AUTH ---
export const loginWithEmail = async (email: string, password: string) => {
    if (isPreviewMode) return { success: true };
    if (!supabase) return { success: false, message: "Erro de configuração." };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, message: error.message };
    return { success: true };
};

export const loginWithGoogle = async () => {
    if (isPreviewMode) return { success: true };
    if (!supabase) return { success: false, message: "Erro de configuração." };
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
    });
    if (error) return { success: false, message: error.message };
    return { success: true };
};

export const logout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
};

export const registerWithEmail = async (email: string, password: string, name: string, allowedMinistries: string[], phone?: string, roles?: string[]) => {
    if (isPreviewMode) return { success: true, message: "Registrado (Demo)" };
    if (!supabase) return { success: false, message: "Erro de configuração." };

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: name,
                name: name,
            }
        }
    });

    if (error) return { success: false, message: error.message };
    if (data.user) {
        const ministryId = allowedMinistries[0] || 'midia';
        await supabase.from('profiles').insert({
            id: data.user.id,
            email,
            name,
            ministry_id: ministryId,
            allowed_ministries: allowedMinistries,
            whatsapp: phone,
            role: 'member',
            functions: roles || [],
            created_at: new Date().toISOString()
        });
    }
    return { success: true, message: "Cadastro realizado!" };
};

export const sendPasswordResetEmail = async (email: string) => {
    if (isPreviewMode) return { success: true, message: "Email enviado (Demo)" };
    if (!supabase) return { success: false, message: "Erro de configuração." };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password',
    });
    if (error) return { success: false, message: error.message };
    return { success: true, message: "Link enviado para o e-mail." };
};

export const updateUserProfile = async (name: string, whatsapp: string, avatar_url?: string, functions?: string[], birthDate?: string, ministryId?: string) => {
    if (isPreviewMode) return { success: true, message: "Perfil atualizado (Demo)" };
    if (!supabase) return { success: false, message: "Erro de conexão" };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Usuário não logado" };

    try {
        const updates: any = {
            name,
            whatsapp,
        };
        if (avatar_url !== undefined) updates.avatar_url = avatar_url;
        if (functions !== undefined) updates.functions = functions;
        if (birthDate !== undefined) updates.birth_date = birthDate;

        const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);

        if (error) throw error;
        
        if (ministryId) {
             logActionSQL(ministryId, "Atualização de Perfil", `${name} atualizou seus dados.`);
        }

        return { success: true, message: "Perfil atualizado com sucesso!" };
    } catch (e: any) {
        return { success: false, message: e.message || "Erro ao atualizar perfil." };
    }
};

export const updateProfileMinistry = async (userId: string, ministryId: string) => {
    if (isPreviewMode) return;
    if (!supabase) return;
    await supabase.from('profiles').update({ ministry_id: ministryId }).eq('id', userId);
};

export const joinMinistry = async (ministryId: string, roles: string[]) => {
    if (isPreviewMode) return { success: true, message: "Entrou (Demo)" };
    if (!supabase) return { success: false, message: "Erro de conexão" };
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Usuário não logado" };

    try {
        const { data: profile } = await supabase.from('profiles').select('allowed_ministries, functions').eq('id', user.id).single();
        if (!profile) throw new Error("Perfil não encontrado");

        const currentAllowed = profile.allowed_ministries || [];
        const currentFunctions = profile.functions || [];

        if (!currentAllowed.includes(ministryId)) {
            const newAllowed = [...currentAllowed, ministryId];
            const newFunctions = Array.from(new Set([...currentFunctions, ...roles]));

            const { error } = await supabase.from('profiles').update({
                allowed_ministries: newAllowed,
                functions: newFunctions,
                ministry_id: ministryId
            }).eq('id', user.id);

            if (error) throw error;
            return { success: true, message: `Você entrou em ${ministryId}!` };
        }
        return { success: false, message: "Você já participa deste ministério." };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

// --- MINISTRY SETTINGS ---
export const fetchMinistrySettings = async (ministryId: string) => {
    if (isPreviewMode || !supabase) return { displayName: '', roles: [] };
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

export const saveMinistrySettings = async (ministryId: string, displayName?: string, roles?: string[], availabilityStart?: string, availabilityEnd?: string) => {
    if (isPreviewMode || !supabase) return;
    
    const updates: any = {};
    if (displayName !== undefined) updates.display_name = displayName;
    if (roles !== undefined) updates.roles = roles;
    if (availabilityStart !== undefined) updates.availability_start = availabilityStart;
    if (availabilityEnd !== undefined) updates.availability_end = availabilityEnd;

    const { data } = await supabase.from('ministry_settings').select('id').eq('ministry_id', ministryId).single();
    
    if (data) {
        await supabase.from('ministry_settings').update(updates).eq('ministry_id', ministryId);
    } else {
        await supabase.from('ministry_settings').insert({ ministry_id: ministryId, ...updates });
    }
};

// --- SCHEDULE ---
export const fetchMinistrySchedule = async (ministryId: string, month: string) => {
    if (isPreviewMode || !supabase) return { events: [], schedule: {}, attendance: {} };
    
    const { data: eventsData } = await supabase.from('events')
        .select('*')
        .eq('ministry_id', ministryId)
        .ilike('iso', `${month}%`);
        
    const events = (eventsData || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        date: e.date,
        time: e.time,
        iso: e.iso,
        dateDisplay: e.date.split('-').reverse().slice(0, 2).join('/')
    }));

    const { data: schedData } = await supabase.from('schedules')
        .select('schedule_data')
        .eq('ministry_id', ministryId)
        .eq('month_key', month)
        .single();
    
    const schedule = schedData?.schedule_data || {};

    const { data: attData } = await supabase.from('schedules')
        .select('attendance_data')
        .eq('ministry_id', ministryId)
        .eq('month_key', month)
        .single();

    const attendance = attData?.attendance_data || {};

    return { events, schedule, attendance };
};

export const saveScheduleAssignment = async (ministryId: string, key: string, memberName: string) => {
    if (isPreviewMode || !supabase) return true;
    const month = key.substring(0, 7);
    
    const { data } = await supabase.from('schedules').select('schedule_data').eq('ministry_id', ministryId).eq('month_key', month).single();
    const currentSchedule = data?.schedule_data || {};
    
    if (memberName) {
        currentSchedule[key] = memberName;
    } else {
        delete currentSchedule[key];
    }

    const { error } = await supabase.from('schedules').upsert({
        ministry_id: ministryId,
        month_key: month,
        schedule_data: currentSchedule
    }, { onConflict: 'ministry_id,month_key' });

    return !error;
};

export const saveScheduleBulk = async (ministryId: string, schedule: ScheduleMap, strict: boolean) => {
    if (isPreviewMode || !supabase) return;
    const month = Object.keys(schedule)[0]?.substring(0, 7);
    if (!month) return;

    await supabase.from('schedules').upsert({
        ministry_id: ministryId,
        month_key: month,
        schedule_data: schedule
    }, { onConflict: 'ministry_id,month_key' });
};

export const clearScheduleForMonth = async (ministryId: string, month: string) => {
    if (isPreviewMode || !supabase) return;
    await supabase.from('schedules').delete().eq('ministry_id', ministryId).eq('month_key', month);
};

export const toggleAssignmentConfirmation = async (ministryId: string, key: string) => {
    if (isPreviewMode || !supabase) return true;
    const month = key.substring(0, 7);

    const { data } = await supabase.from('schedules').select('attendance_data').eq('ministry_id', ministryId).eq('month_key', month).single();
    const currentAttendance = data?.attendance_data || {};
    
    if (currentAttendance[key]) {
        delete currentAttendance[key];
    } else {
        currentAttendance[key] = true;
    }

    const { error } = await supabase.from('schedules').upsert({
        ministry_id: ministryId,
        month_key: month,
        attendance_data: currentAttendance
    }, { onConflict: 'ministry_id,month_key' });

    return !error;
};

// --- EVENTS ---
export const createMinistryEvent = async (ministryId: string, event: Partial<CustomEvent>) => {
    if (isPreviewMode || !supabase) return;
    await supabase.from('events').insert({
        ministry_id: ministryId,
        title: event.title,
        date: event.date,
        time: event.time,
        iso: event.iso
    });
};

export const deleteMinistryEvent = async (ministryId: string, iso: string) => {
    if (isPreviewMode || !supabase) return;
    await supabase.from('events').delete().eq('ministry_id', ministryId).eq('iso', iso);
};

export const updateMinistryEvent = async (ministryId: string, oldIso: string, newTitle: string, newIso: string, applyToAll: boolean) => {
    if (isPreviewMode || !supabase) return;
    await supabase.from('events').update({ title: newTitle, iso: newIso, time: newIso.split('T')[1] })
        .eq('ministry_id', ministryId).eq('iso', oldIso);
};

export const resetToDefaultEvents = async (ministryId: string, month: string) => {
    if (isPreviewMode || !supabase) return;
    console.log("Reset events not fully implemented.");
};

// --- MEMBERS ---
export const fetchMinistryMembers = async (ministryId: string) => {
    if (isPreviewMode || !supabase) return { memberMap: {}, publicList: [] };
    
    const { data } = await supabase.from('profiles')
        .select('*')
        .contains('allowed_ministries', [ministryId]);
        
    const publicList = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        whatsapp: p.whatsapp,
        avatar_url: p.avatar_url,
        roles: p.functions,
        birthDate: p.birth_date,
        isAdmin: p.is_admin
    }));

    const memberMap: any = {};
    publicList.forEach((m: any) => {
        m.roles?.forEach((r: string) => {
            if (!memberMap[r]) memberMap[r] = [];
            memberMap[r].push(m.name);
        });
    });

    return { memberMap, publicList };
};

export const deleteMember = async (ministryId: string, userId: string, name: string) => {
    if (isPreviewMode || !supabase) return;
    const { data: profile } = await supabase.from('profiles').select('allowed_ministries').eq('id', userId).single();
    if (profile) {
        const newAllowed = (profile.allowed_ministries || []).filter((m: string) => m !== ministryId);
        await supabase.from('profiles').update({ allowed_ministries: newAllowed }).eq('id', userId);
    }
};

export const toggleAdminSQL = async (email: string, status: boolean) => {
    if (isPreviewMode || !supabase) return;
    await supabase.from('profiles').update({ is_admin: status }).eq('email', email);
};

// --- AVAILABILITY ---
export const fetchMinistryAvailability = async (ministryId: string) => {
    if (isPreviewMode || !supabase) return { availability: {}, notes: {} };
    const { data } = await supabase.from('member_availability').select('*');
    
    const availability: AvailabilityMap = {};
    const notes: AvailabilityNotesMap = {};

    data?.forEach((row: any) => {
        availability[row.member_name] = row.dates || [];
        if (row.notes) {
            Object.entries(row.notes).forEach(([date, note]) => {
                notes[`${row.member_name}_${date}`] = note as string;
            });
        }
    });

    return { availability, notes };
};

export const saveMemberAvailability = async (userId: string, memberName: string, dates: string[], notes: Record<string, string>) => {
    if (isPreviewMode || !supabase) return;
    await supabase.from('member_availability').upsert({
        user_id: userId,
        member_name: memberName,
        dates: dates,
        notes: notes
    }, { onConflict: 'user_id' });
};

// --- NOTIFICATIONS ---
export const fetchNotificationsSQL = async (ministryId: string, userId: string) => {
    if (isPreviewMode || !supabase) return [];
    const { data } = await supabase.from('notifications')
        .select('*')
        .eq('ministry_id', ministryId)
        .order('timestamp', { ascending: false })
        .limit(20);
        
    return (data || []).map((n: any) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        timestamp: n.timestamp,
        read: (n.read_by || []).includes(userId),
        actionLink: n.action_link
    }));
};

export const markNotificationsReadSQL = async (ids: string[], userId: string) => {
    if (isPreviewMode || !supabase) return;
    for (const id of ids) {
        const { data } = await supabase.from('notifications').select('read_by').eq('id', id).single();
        const currentRead = data?.read_by || [];
        if (!currentRead.includes(userId)) {
            await supabase.from('notifications').update({ read_by: [...currentRead, userId] }).eq('id', id);
        }
    }
};

export const clearAllNotificationsSQL = async (ministryId: string) => {
    if (isPreviewMode || !supabase) return;
    await supabase.from('notifications').delete().eq('ministry_id', ministryId);
};

export const sendNotificationSQL = async (ministryId: string, notification: Partial<AppNotification>) => {
    if (isPreviewMode || !supabase) return;
    await supabase.from('notifications').insert({
        ministry_id: ministryId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        timestamp: new Date().toISOString(),
        action_link: notification.actionLink
    });
};

export const saveSubscriptionSQL = async (ministryId: string, subscription: PushSubscription) => {
    if (isPreviewMode || !supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        ministry_id: ministryId,
        endpoint: subscription.endpoint,
        p256dh: subscription.toJSON().keys?.p256dh,
        auth: subscription.toJSON().keys?.auth,
        last_updated: new Date().toISOString()
    }, { onConflict: 'endpoint' });
};

// --- ANNOUNCEMENTS ---
export const fetchAnnouncementsSQL = async (ministryId: string) => {
    if (isPreviewMode || !supabase) return [];
    const { data } = await supabase.from('announcements')
        .select('*')
        .eq('ministry_id', ministryId)
        .order('timestamp', { ascending: false });
        
    return (data || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        message: a.message,
        type: a.type,
        timestamp: a.timestamp,
        author: a.author,
        readBy: a.read_by || [],
        likedBy: a.liked_by || []
    }));
};

export const createAnnouncementSQL = async (ministryId: string, announcement: Partial<Announcement>, author: string) => {
    if (isPreviewMode || !supabase) return;
    await supabase.from('announcements').insert({
        ministry_id: ministryId,
        title: announcement.title,
        message: announcement.message,
        type: announcement.type,
        expiration_date: announcement.expirationDate,
        author: author,
        timestamp: new Date().toISOString()
    });
};

export const interactAnnouncementSQL = async (id: string, userId: string, userName: string, action: 'read' | 'like') => {
    if (isPreviewMode || !supabase) return;
    const field = action === 'read' ? 'read_by' : 'liked_by';
    
    const { data } = await supabase.from('announcements').select(field).eq('id', id).single();
    const list = data?.[field] || [];
    
    const exists = list.some((i: any) => i.userId === userId);
    
    let newList;
    if (exists && action === 'like') {
        newList = list.filter((i: any) => i.userId !== userId);
    } else if (!exists) {
        newList = [...list, { userId, name: userName, timestamp: new Date().toISOString() }];
    } else {
        return;
    }

    await supabase.from('announcements').update({ [field]: newList }).eq('id', id);
};

// --- SWAPS ---
export const fetchSwapRequests = async (ministryId: string) => {
    if (isPreviewMode || !supabase) return [];
    const { data } = await supabase.from('swap_requests').select('*').eq('ministry_id', ministryId);
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
    if (isPreviewMode || !supabase) return false;
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

export const performSwapSQL = async (ministryId: string, requestId: string, userName: string, userId: string) => {
    if (isPreviewMode || !supabase) return { success: true, message: "Troca realizada" };
    
    const { data: req } = await supabase.from('swap_requests').select('*').eq('id', requestId).single();
    if (!req || req.status !== 'pending') return { success: false, message: "Solicitação inválida." };

    const key = `${req.event_iso}_${req.role}`;
    const month = req.event_iso.substring(0, 7);
    
    const { data: schedData } = await supabase.from('schedules').select('schedule_data').eq('ministry_id', ministryId).eq('month_key', month).single();
    const currentSchedule = schedData?.schedule_data || {};
    
    currentSchedule[key] = userName;
    
    await supabase.from('schedules').update({ schedule_data: currentSchedule }).eq('ministry_id', ministryId).eq('month_key', month);
    await supabase.from('swap_requests').update({ status: 'completed', taken_by_name: userName }).eq('id', requestId);
    
    return { success: true, message: "Troca realizada com sucesso!" };
};

// --- REPERTOIRE ---
export const fetchRepertoire = async (ministryId: string) => {
    if (isPreviewMode || !supabase) return [];
    const { data } = await supabase.from('repertoire').select('*').eq('ministry_id', ministryId);
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
    if (isPreviewMode || !supabase) return true;
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
    if (isPreviewMode || !supabase) return;
    await supabase.from('repertoire').delete().eq('id', id);
};

// --- RANKING ---
export const fetchRankingData = async (ministryId: string) => {
    if (isPreviewMode || !supabase) return [];
    return [];
};

export const fetchGlobalSchedules = async (month: string, currentMinistryId: string) => {
    return {};
};
