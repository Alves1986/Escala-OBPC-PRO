import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
    MinistrySettings, CustomEvent, Announcement, AppNotification, 
    SwapRequest, RepertoireItem, RankingEntry, Organization, MinistryDef,
    TeamMemberProfile, AuditLogEntry, User, MemberMap, GlobalConflictMap
} from '../types';

// Environment variables handling with extreme safety
let supabaseUrl = '';
let supabaseKey = '';

try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        // @ts-ignore
        supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
        // @ts-ignore
        supabaseKey = import.meta.env.VITE_SUPABASE_KEY || '';
    }
} catch (e) {
    console.warn('Error accessing environment variables:', e);
}

// Fallback to process.env if available (for some non-Vite setups)
if (!supabaseUrl && typeof process !== 'undefined' && process.env) {
    supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    supabaseKey = process.env.VITE_SUPABASE_KEY || '';
}

export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_KEY = supabaseKey;

let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_KEY) {
    try {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
            }
        });
    } catch (e) {
        console.error("Failed to initialize Supabase client:", e);
    }
}

export const getSupabase = () => supabase;

// --- AUTH ---

export const loginWithEmail = async (email: string, password: string) => {
    if (!supabase) return { success: false, message: "Serviço indisponível" };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, message: error.message };
    return { success: true };
};

export const loginWithGoogle = async () => {
    if (!supabase) return { success: false, message: "Serviço indisponível" };
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin
        }
    });
    if (error) return { success: false, message: error.message };
    return { success: true };
};

export const logout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    localStorage.clear();
};

export const registerWithEmail = async (email: string, password: string, name: string, ministries: string[], orgId?: string, roles?: string[]) => {
    if (!supabase) return { success: false, message: "Serviço indisponível" };
    
    // 1. Sign Up
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { full_name: name }
        }
    });

    if (authError) return { success: false, message: authError.message };
    if (!authData.user) return { success: false, message: "Erro ao criar usuário" };

    // 2. Update Profile
    const updates: any = {
        name: name,
        ministry_id: ministries[0], // Default active ministry
        allowed_ministries: ministries,
        organization_id: orgId || '00000000-0000-0000-0000-000000000000',
        roles: roles || []
    };

    const { error: profileError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', authData.user.id);

    if (profileError) {
        console.error("Erro ao atualizar perfil pós-registro", profileError);
    }

    return { success: true, message: "Cadastro realizado com sucesso!" };
};

export const sendPasswordResetEmail = async (email: string) => {
    if (!supabase) return { success: false, message: "Offline" };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password',
    });
    if (error) return { success: false, message: error.message };
    return { success: true, message: "Email de recuperação enviado." };
};

// --- USER & PROFILE ---

export const fetchUserAllowedMinistries = async (userId: string, orgId: string): Promise<string[]> => {
    if (!supabase) return [];
    
    const { data, error } = await supabase
        .from('organization_memberships')
        .select('ministry_id')
        .eq('profile_id', userId)
        .eq('organization_id', orgId);

    if (error || !data) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('allowed_ministries')
            .eq('id', userId)
            .single();
        return profile?.allowed_ministries || [];
    }

    return data.map((row: any) => row.ministry_id);
};

export const updateProfileMinistry = async (userId: string, ministryId: string) => {
    if (!supabase) return;
    await supabase.from('profiles').update({ ministry_id: ministryId }).eq('id', userId);
};

export const updateUserProfile = async (name: string, whatsapp: string, avatar_url?: string, functions?: string[], birthDate?: string, ministryId?: string) => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const updates: any = {
        name,
        whatsapp,
        updated_at: new Date(),
        functions,
        birth_date: birthDate
    };
    if (avatar_url) updates.avatar_url = avatar_url;

    await supabase.from('profiles').update(updates).eq('id', user.id);
};

export const joinMinistry = async (ministryId: string, roles: string[]) => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from('profiles').select('allowed_ministries, organization_id').eq('id', user.id).single();
    if (profile) {
        const current = profile.allowed_ministries || [];
        if (!current.includes(ministryId)) {
            await supabase.from('profiles').update({ 
                allowed_ministries: [...current, ministryId] 
            }).eq('id', user.id);
        }
        
        if (profile.organization_id) {
             await supabase.from('organization_memberships').insert({
                 organization_id: profile.organization_id,
                 ministry_id: ministryId,
                 profile_id: user.id,
                 role: roles.join(',') 
             });
        }
    }
};

// --- ORGANIZATION & MINISTRIES ---

export const fetchOrganizationMinistries = async (orgId: string): Promise<MinistryDef[]> => {
    if (!supabase) return [];
    
    const { data, error } = await supabase
        .from('organization_ministries')
        .select('*')
        .eq('organization_id', orgId);

    if (error) {
        console.error("Error fetching ministries:", error);
        return [];
    }

    return data.map((m: any) => ({
        id: m.id,
        code: m.code,
        label: m.label || m.name,
        enabledTabs: m.enabled_tabs || [],
        organizationId: m.organization_id
    }));
};

export const fetchMinistrySettings = async (ministryId: string): Promise<MinistrySettings | null> => {
    if (!supabase) return null;
    
    const { data, error } = await supabase
        .from('ministry_settings')
        .select('*')
        .eq('ministry_id', ministryId)
        .maybeSingle();

    if (error) console.error("Error fetching settings:", error);
    
    if (!data) {
        return {
            displayName: ministryId.charAt(0).toUpperCase() + ministryId.slice(1),
            roles: [],
            availabilityStart: undefined,
            availabilityEnd: undefined
        };
    }

    return {
        displayName: data.display_name,
        roles: data.roles || [],
        availabilityStart: data.availability_start,
        availabilityEnd: data.availability_end,
        spotifyClientId: data.spotify_client_id,
        spotifyClientSecret: data.spotify_client_secret
    };
};

export const saveMinistrySettings = async (ministryId: string, displayName?: string, roles?: string[], availabilityStart?: string, availabilityEnd?: string) => {
    if (!supabase) return;
    
    const updates: any = {};
    if (displayName !== undefined) updates.display_name = displayName;
    if (roles !== undefined) updates.roles = roles;
    if (availabilityStart !== undefined) updates.availability_start = availabilityStart;
    if (availabilityEnd !== undefined) updates.availability_end = availabilityEnd;

    const { error } = await supabase
        .from('ministry_settings')
        .upsert({ ministry_id: ministryId, ...updates }, { onConflict: 'ministry_id' });
        
    if (error) console.error("Error saving settings:", error);
};

// --- SCHEDULE & EVENTS ---

export const fetchMinistrySchedule = async (ministryId: string, month: string) => {
    if (!supabase) return { events: [], schedule: {}, attendance: {} };

    const startOfMonth = `${month}-01`;
    const endOfMonth = `${month}-31`; 

    const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .eq('ministry_id', ministryId)
        .gte('date_time', startOfMonth)
        .lte('date_time', endOfMonth + 'T23:59:59');

    const events = (eventsData || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        iso: e.date_time, 
        dateDisplay: new Date(e.date_time).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})
    }));

    const eventIds = events.map(e => e.id);
    let schedule: any = {};
    let attendance: any = {};

    if (eventIds.length > 0) {
        const { data: assignments } = await supabase
            .from('schedule_assignments')
            .select('event_id, role_key, member_name, is_confirmed, events!inner(date_time)')
            .in('event_id', eventIds);

        (assignments || []).forEach((a: any) => {
            const iso = a.events.date_time.slice(0, 16); 
            const key = `${iso}_${a.role_key}`;
            schedule[key] = a.member_name;
            attendance[key] = a.is_confirmed;
        });
    }

    return { events, schedule, attendance };
};

export const createMinistryEvent = async (ministryId: string, event: { title: string, date: string, time: string }) => {
    if (!supabase) return;
    const iso = `${event.date}T${event.time}:00`;
    await supabase.from('events').insert({
        ministry_id: ministryId,
        title: event.title,
        date_time: iso
    });
};

export const updateMinistryEvent = async (ministryId: string, oldIso: string, newTitle: string, newIso: string, applyToAll: boolean) => {
    if (!supabase) return;
    const { data: events } = await supabase.from('events').select('id').eq('ministry_id', ministryId).eq('date_time', oldIso).limit(1);
    const eventId = events?.[0]?.id;

    if (eventId) {
        await supabase.from('events').update({ title: newTitle, date_time: newIso }).eq('id', eventId);
    }
};

export const deleteMinistryEvent = async (ministryId: string, iso: string) => {
    if (!supabase) return;
    const { data: events } = await supabase.from('events').select('id').eq('ministry_id', ministryId).eq('date_time', iso);
    if (events && events.length > 0) {
        await supabase.from('events').delete().eq('id', events[0].id);
    }
};

export const resetToDefaultEvents = async (ministryId: string, month: string) => {
    await clearScheduleForMonth(ministryId, month);
};

export const clearScheduleForMonth = async (ministryId: string, month: string) => {
    if (!supabase) return;
    const { data: events } = await supabase
        .from('events')
        .select('id')
        .eq('ministry_id', ministryId)
        .gte('date_time', `${month}-01`)
        .lte('date_time', `${month}-31T23:59:59`);
    
    const eventIds = events?.map(e => e.id) || [];
    if (eventIds.length > 0) {
        await supabase.from('schedule_assignments').delete().in('event_id', eventIds);
    }
};

export const saveScheduleAssignment = async (ministryId: string, key: string, value: string) => {
    if (!supabase) return;
    const [iso] = key.split('_');
    const roleKey = key.substring(iso.length + 1);
    
    let { data: events } = await supabase.from('events').select('id').eq('ministry_id', ministryId).eq('date_time', iso).limit(1);
    
    if (!events || events.length === 0) {
        const { data: newEvent } = await supabase.from('events').insert({
            ministry_id: ministryId,
            title: 'Culto', 
            date_time: iso
        }).select().single();
        if (newEvent) events = [newEvent];
    }

    if (events && events[0]) {
        const eventId = events[0].id;
        
        if (!value) {
            await supabase.from('schedule_assignments').delete().eq('event_id', eventId).eq('role_key', roleKey);
        } else {
            const { data: profile } = await supabase.from('profiles').select('id').eq('name', value).maybeSingle();
            
            await supabase.from('schedule_assignments').upsert({
                event_id: eventId,
                role_key: roleKey,
                member_name: value,
                member_id: profile?.id,
                ministry_id: ministryId
            }, { onConflict: 'event_id,role_key' });
            
            await supabase.from('audit_logs').insert({
                ministry_id: ministryId,
                action: 'Escala Editada',
                details: `Alterou ${roleKey} para ${value} no dia ${new Date(iso).toLocaleDateString()}`,
                author: (await supabase.auth.getUser()).data.user?.email || 'Sistema',
                date: new Date().toISOString()
            });
        }
    }
};

export const toggleAssignmentConfirmation = async (ministryId: string, key: string) => {
    if (!supabase) return;
    const [iso] = key.split('_');
    const roleKey = key.substring(iso.length + 1);

    const { data: events } = await supabase.from('events').select('id').eq('ministry_id', ministryId).eq('date_time', iso).limit(1);
    if (events && events[0]) {
        const eventId = events[0].id;
        const { data: assignment } = await supabase
            .from('schedule_assignments')
            .select('is_confirmed')
            .eq('event_id', eventId)
            .eq('role_key', roleKey)
            .single();
            
        if (assignment) {
            await supabase
                .from('schedule_assignments')
                .update({ is_confirmed: !assignment.is_confirmed })
                .eq('event_id', eventId)
                .eq('role_key', roleKey);
        }
    }
};

// --- MEMBERS ---

export const fetchMinistryMembers = async (ministryId: string) => {
    if (!supabase) return { memberMap: {}, publicList: [] };

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
        roles: p.functions || [],
        isAdmin: p.is_admin,
        birthDate: p.birth_date
    }));

    const memberMap: MemberMap = {};
    const settings = await fetchMinistrySettings(ministryId);
    (settings?.roles || []).forEach(r => memberMap[r] = []);

    publicList.forEach(m => {
        (m.roles || []).forEach(r => {
            if (!memberMap[r]) memberMap[r] = [];
            memberMap[r].push(m.name);
        });
    });

    return { memberMap, publicList };
};

export const deleteMember = async (ministryId: string, memberId: string, memberName: string) => {
    if (!supabase) return;
    const { data: profile } = await supabase.from('profiles').select('allowed_ministries').eq('id', memberId).single();
    if (profile) {
        const newAllowed = (profile.allowed_ministries || []).filter((m: string) => m !== ministryId);
        await supabase.from('profiles').update({ allowed_ministries: newAllowed }).eq('id', memberId);
    }
};

export const toggleAdminSQL = async (email: string, status: boolean, ministryId: string) => {
    if (!supabase) return;
    await supabase.from('profiles').update({ is_admin: status }).eq('email', email);
};

// --- AVAILABILITY ---

export const fetchMinistryAvailability = async (ministryId: string) => {
    if (!supabase) return { availability: {}, notes: {} };
    
    const { data } = await supabase
        .from('availability')
        .select('*')
        .eq('ministry_id', ministryId);

    const availability: any = {};
    const notes: any = {};

    (data || []).forEach((row: any) => {
        if (!availability[row.member_name]) availability[row.member_name] = [];
        availability[row.member_name].push(...(row.dates || []));
        
        if (row.notes) {
            Object.entries(row.notes).forEach(([k, v]) => {
                notes[`${row.member_name}_${k}`] = v;
            });
        }
    });

    return { availability, notes };
};

export const saveMemberAvailability = async (ministryId: string, memberName: string, dates: string[], notes: Record<string, string>, targetMonth: string) => {
    if (!supabase) return;
    
    const { data: profile } = await supabase.from('profiles').select('id').eq('name', memberName).maybeSingle();
    
    const { data: existing } = await supabase.from('availability').select('*').eq('ministry_id', ministryId).eq('member_name', memberName).maybeSingle();
    
    let allDates = existing?.dates || [];
    let allNotes = existing?.notes || {};
    
    allDates = allDates.filter((d: string) => !d.startsWith(targetMonth));
    allDates = [...allDates, ...dates];
    
    allNotes = { ...allNotes, ...notes };

    await supabase.from('availability').upsert({
        ministry_id: ministryId,
        member_name: memberName,
        member_id: profile?.id,
        dates: allDates,
        notes: allNotes,
        updated_at: new Date().toISOString()
    }, { onConflict: 'ministry_id,member_name' });
};

// --- NOTIFICATIONS & ANNOUNCEMENTS ---

export const fetchNotificationsSQL = async (ministries: string[], userId: string) => {
    if (!supabase) return [];
    
    const { data } = await supabase
        .from('notifications')
        .select('*')
        .or(`user_id.eq.${userId},user_id.is.null`)
        .in('ministry_id', ministries)
        .order('created_at', { ascending: false })
        .limit(50);

    return (data || []).map((n: any) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        timestamp: n.created_at,
        read: n.read_by?.includes(userId) || false, 
        ministryId: n.ministry_id,
        actionLink: n.action_link
    }));
};

export const markNotificationsReadSQL = async (notificationIds: string[], userId: string) => {
    if (!supabase) return;
    
    for (const nid of notificationIds) {
        const { data } = await supabase.from('notifications').select('read_by').eq('id', nid).single();
        const current = data?.read_by || [];
        if (!current.includes(userId)) {
            await supabase.from('notifications').update({ read_by: [...current, userId] }).eq('id', nid);
        }
    }
};

export const clearAllNotificationsSQL = async (ministryId: string) => {
    if (!supabase) return;
    await supabase.from('notifications').delete().eq('ministry_id', ministryId);
};

export const fetchAnnouncementsSQL = async (ministryId: string) => {
    if (!supabase) return [];
    const { data } = await supabase
        .from('announcements')
        .select('*')
        .eq('ministry_id', ministryId)
        .gte('expiration_date', new Date().toISOString())
        .order('created_at', { ascending: false });

    return (data || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        message: a.message,
        type: a.type,
        timestamp: a.created_at,
        author: a.author,
        readBy: a.read_by_data || [], 
        likedBy: a.liked_by_data || [] 
    }));
};

export const createAnnouncementSQL = async (ministryId: string, data: any, authorName: string) => {
    if (!supabase) return;
    await supabase.from('announcements').insert({
        ministry_id: ministryId,
        title: data.title,
        message: data.message,
        type: data.type,
        expiration_date: data.expirationDate,
        author: authorName,
        read_by_data: [],
        liked_by_data: []
    });
};

export const interactAnnouncementSQL = async (id: string, userId: string, userName: string, action: 'read' | 'like') => {
    if (!supabase) return;
    const { data } = await supabase.from('announcements').select('read_by_data, liked_by_data').eq('id', id).single();
    if (!data) return;

    if (action === 'read') {
        const current = data.read_by_data || [];
        if (!current.some((r: any) => r.userId === userId)) {
            const updated = [...current, { userId, name: userName, timestamp: new Date().toISOString() }];
            await supabase.from('announcements').update({ read_by_data: updated }).eq('id', id);
        }
    } else if (action === 'like') {
        const current = data.liked_by_data || [];
        const exists = current.some((l: any) => l.userId === userId);
        let updated;
        if (exists) {
            updated = current.filter((l: any) => l.userId !== userId);
        } else {
            updated = [...current, { userId, name: userName, timestamp: new Date().toISOString() }];
        }
        await supabase.from('announcements').update({ liked_by_data: updated }).eq('id', id);
    }
};

export const sendNotificationSQL = async (ministryId: string, payload: any) => {
    if (!supabase) return;
    await supabase.from('notifications').insert({
        ministry_id: ministryId,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        action_link: payload.actionLink,
        read_by: [] 
    });
    
    try {
        await supabase.functions.invoke('push-notification', {
            body: { ministryId, ...payload }
        });
    } catch(e) { console.warn("Push failed", e); }
};

// --- SWAPS ---

export const fetchSwapRequests = async (ministryId: string) => {
    if (!supabase) return [];
    const { data } = await supabase
        .from('swap_requests')
        .select('*')
        .eq('ministry_id', ministryId)
        .eq('status', 'pending');

    return (data || []).map((r: any) => ({
        id: r.id,
        ministryId: r.ministry_id,
        requesterName: r.requester_name,
        requesterId: r.requester_id,
        role: r.role,
        eventIso: r.event_iso,
        eventTitle: r.event_title,
        status: r.status,
        createdAt: r.created_at
    }));
};

export const createSwapRequestSQL = async (ministryId: string, request: SwapRequest) => {
    if (!supabase) return;
    await supabase.from('swap_requests').insert({
        ministry_id: ministryId,
        requester_name: request.requesterName,
        requester_id: request.requesterId,
        role: request.role,
        event_iso: request.eventIso,
        event_title: request.eventTitle,
        status: 'pending'
    });
};

export const performSwapSQL = async (ministryId: string, reqId: string, takerName: string, takerId: string) => {
    if (!supabase) return;
    
    const { data: req } = await supabase.from('swap_requests').select('*').eq('id', reqId).single();
    if (!req) return;

    await supabase.from('swap_requests').update({ 
        status: 'completed', 
        taken_by_name: takerName, 
        taken_by_id: takerId 
    }).eq('id', reqId);

    const roleKey = req.role; 
    const key = `${req.event_iso}_${roleKey}`;
    
    await saveScheduleAssignment(ministryId, key, takerName);
};

export const cancelSwapRequestSQL = async (reqId: string) => {
    if (!supabase) return;
    await supabase.from('swap_requests').delete().eq('id', reqId);
};

// --- REPERTOIRE ---

export const fetchRepertoire = async (ministryId: string) => {
    if (!supabase) return [];
    const { data } = await supabase
        .from('repertoire')
        .select('*')
        .eq('ministry_id', ministryId)
        .order('date_used', { ascending: false });

    return (data || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        link: r.link,
        date: r.date_used,
        observation: r.observation,
        addedBy: r.added_by,
        createdAt: r.created_at,
        content: r.content,
        key: r.music_key
    }));
};

export const addToRepertoire = async (ministryId: string, item: any) => {
    if (!supabase) return false;
    const { error } = await supabase.from('repertoire').insert({
        ministry_id: ministryId,
        title: item.title,
        link: item.link,
        date_used: item.date,
        added_by: item.addedBy,
        content: item.content
    });
    return !error;
};

export const deleteFromRepertoire = async (id: string) => {
    if (!supabase) return;
    await supabase.from('repertoire').delete().eq('id', id);
};

export const updateRepertoireItem = async (id: string, updates: any) => {
    if (!supabase) return;
    const dbUpdates: any = {};
    if (updates.content !== undefined) dbUpdates.content = updates.content;
    if (updates.key !== undefined) dbUpdates.music_key = updates.key;
    
    await supabase.from('repertoire').update(dbUpdates).eq('id', id);
};

// --- GLOBAL CONFLICTS & AUDIT ---

export const fetchGlobalSchedules = async (month: string, currentMinistryId: string) => {
    if (!supabase) return {};
    
    const start = `${month}-01`;
    const end = `${month}-31T23:59:59`;
    
    const { data } = await supabase
        .from('schedule_assignments')
        .select('member_name, events!inner(date_time, ministry_id), role_key')
        .neq('ministry_id', currentMinistryId)
        .gte('events.date_time', start)
        .lte('events.date_time', end);

    const conflicts: GlobalConflictMap = {};
    
    (data || []).forEach((row: any) => {
        const name = row.member_name.toLowerCase().trim();
        if (!conflicts[name]) conflicts[name] = [];
        
        conflicts[name].push({
            ministryId: row.events.ministry_id,
            eventIso: row.events.date_time.slice(0, 16),
            role: row.role_key
        });
    });

    return conflicts;
};

export const fetchAuditLogs = async (ministryId: string) => {
    if (!supabase) return [];
    const { data } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('ministry_id', ministryId)
        .order('date', { ascending: false })
        .limit(50);
        
    return data || [];
};

export const fetchRankingData = async (ministryId: string): Promise<RankingEntry[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.rpc('get_ministry_ranking', { mid: ministryId });
    if (error) {
        console.warn("Ranking RPC missing, fallback logic needed or ignore.");
        return [];
    }
    return data || [];
};

// --- SUPER ADMIN ---

export const fetchOrganizationsWithStats = async (): Promise<Organization[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('organizations').select('*, organization_ministries(*)');
    if (error) return [];
    
    return data.map((o: any) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        active: o.active,
        createdAt: o.created_at,
        ministryCount: o.organization_ministries?.length || 0,
        ministries: (o.organization_ministries || []).map((m: any) => ({
            id: m.id,
            code: m.code,
            label: m.label || m.name
        }))
    }));
};

export const saveOrganization = async (id: string | null, name: string, slug: string) => {
    if (!supabase) return { success: false, message: "Offline" };
    if (id) {
        const { error } = await supabase.from('organizations').update({ name, slug }).eq('id', id);
        return { success: !error, message: error ? error.message : "Atualizado" };
    } else {
        const { error } = await supabase.from('organizations').insert({ name, slug });
        return { success: !error, message: error ? error.message : "Criado" };
    }
};

export const toggleOrganizationStatus = async (id: string, active: boolean) => {
    if (!supabase) return false;
    const { error } = await supabase.from('organizations').update({ active }).eq('id', id);
    return !error;
};

export const saveOrganizationMinistry = async (orgId: string, code: string, label: string) => {
    if (!supabase) return { success: false, message: "Offline" };
    const { error } = await supabase.from('organization_ministries').insert({
        organization_id: orgId,
        code,
        label
    });
    return { success: !error, message: error ? error.message : "Ministério adicionado" };
};

export const deleteOrganizationMinistry = async (orgId: string, code: string) => {
    if (!supabase) return { success: false, message: "Offline" };
    const { error } = await supabase.from('organization_ministries').delete().match({ organization_id: orgId, code });
    return { success: !error, message: error ? error.message : "Removido" };
};

export const fetchMinistryMemberships = async (orgId: string, ministryCode: string) => {
    if (!supabase) return [];
    
    const { data: ministry } = await supabase.from('organization_ministries').select('id').eq('organization_id', orgId).eq('code', ministryCode).single();
    if (!ministry) return [];

    const { data, error } = await supabase
        .from('organization_memberships')
        .select(`
            profile_id,
            role,
            profiles (id, name, email, avatar_url)
        `)
        .eq('organization_id', orgId)
        .eq('ministry_id', ministry.id); 

    if (error) {
        console.error("Erro ao buscar membros:", error);
        return [];
    }

    return (data || []).map((row: any) => ({
        profileId: row.profile_id,
        role: row.role,
        name: row.profiles?.name || 'Desconhecido',
        email: row.profiles?.email || '',
        avatar: row.profiles?.avatar_url
    }));
};

export const removeUserFromMinistry = async (orgId: string, profileId: string, ministryCode: string) => {
    if (!supabase) return { success: false, message: "Offline" };
    
    const { data: ministry } = await supabase.from('organization_ministries').select('id').eq('organization_id', orgId).eq('code', ministryCode).single();
    if (!ministry) return { success: false, message: "Ministério não encontrado" };

    const { error } = await supabase
        .from('organization_memberships')
        .delete()
        .match({ 
            organization_id: orgId, 
            ministry_id: ministry.id, 
            profile_id: profileId 
        });

    if (error) return { success: false, message: error.message };
    
    const { data: profile } = await supabase.from('profiles').select('allowed_ministries').eq('id', profileId).single();
    if (profile && profile.allowed_ministries) {
        const newAllowed = profile.allowed_ministries.filter((m: string) => m !== ministryCode && m !== ministry.id);
        await supabase.from('profiles').update({ allowed_ministries: newAllowed }).eq('id', profileId);
    }

    return { success: true, message: "Desvinculado com sucesso" };
};
