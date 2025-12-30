import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
    User, MemberMap, 
    AppNotification, TeamMemberProfile, AvailabilityMap, SwapRequest, 
    ScheduleMap, RepertoireItem, Announcement, GlobalConflictMap, 
    AttendanceMap, AuditLogEntry, MinistrySettings, MinistryDef, Organization,
    RankingEntry, AvailabilityNotesMap, RankingHistoryItem, DEFAULT_TABS, ScheduleAnalysis, CustomEvent
} from '../types';

// Declare globals defined in vite.config.ts
declare const __SUPABASE_URL__: string;
declare const __SUPABASE_KEY__: string;

// Safe Access: Priority to Vite env, fallback to injected global constants
const getEnv = (key: string, globalVal?: string) => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  if (globalVal) return globalVal;
  return "";
};

export const SUPABASE_URL = getEnv('VITE_SUPABASE_URL', typeof __SUPABASE_URL__ !== 'undefined' ? __SUPABASE_URL__ : "").trim();
export const SUPABASE_KEY = getEnv('VITE_SUPABASE_KEY', typeof __SUPABASE_KEY__ !== 'undefined' ? __SUPABASE_KEY__ : "").trim();

let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_KEY) {
    try {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
            }
        });
    } catch(e) {
        console.error("Failed to initialize Supabase client:", e);
    }
}

export const getSupabase = () => supabase;

// --- HELPERS ---

const safeParseArray = (arr: any): string[] => {
    if (Array.isArray(arr)) return arr;
    if (typeof arr === 'string') {
        try {
            const parsed = JSON.parse(arr);
            return Array.isArray(parsed) ? parsed : [];
        } catch { return []; }
    }
    return [];
};

export const getCurrentOrgId = async () => {
    if (!supabase) return '00000000-0000-0000-0000-000000000000';
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return '00000000-0000-0000-0000-000000000000';
    
    const { data } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
    return data?.organization_id || '00000000-0000-0000-0000-000000000000';
};

const logAction = async (ministryId: string, action: string, details: string, organizationId?: string) => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single();
    
    await supabase.from('audit_logs').insert({
        ministry_id: ministryId,
        date: new Date().toISOString(),
        action,
        details,
        author: profile?.name || 'Sistema',
        organization_id: organizationId
    });
};

// --- AUTH & USER ---

export const loginWithEmail = async (email: string, pass: string) => {
    if (!supabase) return { success: false, message: "Sistema offline" };
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    return { success: !error, message: error ? error.message : "Login realizado!" };
};

export const loginWithGoogle = async () => {
    if (!supabase) return { success: false, message: "Sistema offline" };
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    return { success: !error, message: error ? error.message : "Redirecionando..." };
};

export const registerWithEmail = async (email: string, pass: string, name: string, ministries: string[], orgId?: string, roles: string[] = []) => {
    if (!supabase) return { success: false, message: "Sistema offline" };
    const { data, error } = await supabase.auth.signUp({ 
        email, 
        password: pass,
        options: {
            data: {
                full_name: name,
                ministries: ministries,
                roles: roles
            }
        }
    });
    return { success: !error, message: error ? error.message : "Conta criada! Verifique seu e-mail." };
};

export const sendPasswordResetEmail = async (email: string) => {
    if (!supabase) return { success: false, message: "Sistema offline" };
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    return { success: !error, message: error ? error.message : "E-mail de recuperação enviado!" };
};

export const fetchUserAllowedMinistries = async (userId: string, orgId: string) => {
    if (!supabase) return [];
    const { data } = await supabase.from('profiles').select('allowed_ministries').eq('id', userId).single();
    return safeParseArray(data?.allowed_ministries);
};

export const updateUserProfile = async (name: string, whatsapp: string, avatar_url?: string, functions?: string[], birthDate?: string, ministryId?: string) => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const updates: any = { 
        name, 
        whatsapp,
        birth_date: birthDate,
        functions
    };
    if (avatar_url) updates.avatar_url = avatar_url;

    await supabase.from('profiles').update(updates).eq('id', user.id);
    
    if (ministryId) await logAction(ministryId, 'Perfil Atualizado', `Usuário ${name} atualizou o próprio perfil.`);
};

// --- SETTINGS & MINISTRY ---

export const fetchMinistrySettings = async (ministryId: string): Promise<MinistrySettings> => {
    if (!supabase) return { displayName: ministryId, roles: [] };
    const { data } = await supabase.from('ministry_settings').select('*').eq('ministry_id', ministryId).single();
    if (!data) return { displayName: ministryId, roles: [] };
    
    return {
        id: data.id,
        displayName: data.display_name,
        roles: safeParseArray(data.roles),
        availabilityStart: data.availability_start,
        availabilityEnd: data.availability_end,
        spotifyClientId: data.spotify_client_id,
        spotifyClientSecret: data.spotify_client_secret
    };
};

export const saveMinistrySettings = async (ministryId: string, displayName?: string, roles?: string[], availStart?: string, availEnd?: string) => {
    if (!supabase) return;
    const updates: any = {};
    if (displayName) updates.display_name = displayName;
    if (roles) updates.roles = roles;
    if (availStart !== undefined) updates.availability_start = availStart;
    if (availEnd !== undefined) updates.availability_end = availEnd;

    // Upsert
    const { data: existing } = await supabase.from('ministry_settings').select('id').eq('ministry_id', ministryId).single();
    if (existing) {
        await supabase.from('ministry_settings').update(updates).eq('ministry_id', ministryId);
    } else {
        await supabase.from('ministry_settings').insert({ ministry_id: ministryId, ...updates });
    }
};

export const fetchOrganizationMinistries = async (orgId: string): Promise<MinistryDef[]> => {
    if (!supabase) return [];
    try {
        const { data } = await supabase.from('organization_ministries').select('*').eq('organization_id', orgId);
        return data?.map((m: any) => ({
            id: m.code, 
            code: m.code,
            label: m.label,
            enabledTabs: safeParseArray(m.enabled_tabs),
            organizationId: m.organization_id
        })) || [];
    } catch {
        return [];
    }
};

// --- SCHEDULE & EVENTS ---

export const fetchMinistrySchedule = async (ministryId: string, monthIso: string) => {
    if (!supabase) return { events: [], schedule: {}, attendance: {} };
    
    // Fetch events
    const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .eq('ministry_id', ministryId)
        .ilike('date', `${monthIso}%`);
        
    const events = (eventsData || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        date: e.date,
        time: e.time,
        iso: `${e.date}T${e.time}`,
        dateDisplay: e.date.split('-').reverse().slice(0, 2).join('/')
    }));

    // Fetch assignments
    const eventIds = events.map((e: any) => e.id);
    const schedule: ScheduleMap = {};
    const attendance: AttendanceMap = {};

    if (eventIds.length > 0) {
        const { data: assignments } = await supabase
            .from('schedule_assignments')
            .select('event_id, role, member_name, confirmed')
            .in('event_id', eventIds);
            
        assignments?.forEach((a: any) => {
            const evt = events.find((e: any) => e.id === a.event_id);
            if (evt) {
                const key = `${evt.iso}_${a.role}`;
                schedule[key] = a.member_name;
                if (a.confirmed) attendance[key] = true;
            }
        });
    }

    return { events, schedule, attendance };
};

export const createMinistryEvent = async (ministryId: string, event: { title: string, date: string, time: string }) => {
    if (!supabase) return;
    await supabase.from('events').insert({
        ministry_id: ministryId,
        title: event.title,
        date: event.date,
        time: event.time,
        date_time: `${event.date}T${event.time}:00`
    });
};

export const deleteMinistryEvent = async (ministryId: string, identifier: string) => {
    if (!supabase) return;
    // identifier could be ID or ISO. Try to delete by ID first if UUID, else find by date/time
    if (identifier.length > 20 && !identifier.includes('T')) {
        await supabase.from('events').delete().eq('id', identifier);
    } else {
        // Fallback for ISO string
        const [date, time] = identifier.split('T');
        await supabase.from('events').delete().match({ ministry_id: ministryId, date, time });
    }
};

export const saveScheduleAssignment = async (ministryId: string, key: string, memberName: string) => {
    if (!supabase) return;
    const [iso, role] = key.split('_');
    const [date, time] = iso.split('T');
    
    // Find event
    const { data: evt } = await supabase.from('events').select('id').match({ ministry_id: ministryId, date, time }).single();
    if (!evt) return;

    if (!memberName) {
        await supabase.from('schedule_assignments').delete().match({ event_id: evt.id, role });
    } else {
        // Upsert
        const { data: existing } = await supabase.from('schedule_assignments').select('id').match({ event_id: evt.id, role }).single();
        if (existing) {
            await supabase.from('schedule_assignments').update({ member_name: memberName, confirmed: false }).eq('id', existing.id);
        } else {
            await supabase.from('schedule_assignments').insert({ event_id: evt.id, role, member_name: memberName, ministry_id: ministryId });
        }
    }
};

export const toggleAssignmentConfirmation = async (ministryId: string, key: string) => {
    if (!supabase) return;
    const [iso, role] = key.split('_');
    const [date, time] = iso.split('T');
    
    const { data: evt } = await supabase.from('events').select('id').match({ ministry_id: ministryId, date, time }).single();
    if (!evt) return;

    const { data: assign } = await supabase.from('schedule_assignments').select('id, confirmed').match({ event_id: evt.id, role }).single();
    if (assign) {
        await supabase.from('schedule_assignments').update({ confirmed: !assign.confirmed }).eq('id', assign.id);
    }
};

// --- MEMBERS ---

export const fetchMinistryMembers = async (ministryId: string) => {
    if (!supabase) return { memberMap: {}, publicList: [] };
    
    const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .or(`ministry_id.eq.${ministryId},allowed_ministries.cs.{${ministryId}}`);
        
    const memberMap: MemberMap = {}; 
    const publicList: TeamMemberProfile[] = (profiles || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        whatsapp: p.whatsapp,
        avatar_url: p.avatar_url,
        roles: safeParseArray(p.roles),
        isAdmin: p.is_admin,
        birthDate: p.birth_date,
        organizationId: p.organization_id
    }));

    publicList.forEach(m => {
        m.roles?.forEach(r => {
            if (!memberMap[r]) memberMap[r] = [];
            memberMap[r].push(m.name);
        });
    });

    return { memberMap, publicList };
};

export const toggleAdminSQL = async (email: string, status: boolean, name: string) => {
    if (!supabase) return;
    await supabase.from('profiles').update({ is_admin: status }).eq('email', email);
};

export const removeMemberFromMinistry = async (memberId: string, ministryId: string): Promise<{ success: boolean, message: string }> => {
    if (!supabase) return { success: false, message: "Sistema offline" };

    try {
        const orgId = await getCurrentOrgId();

        const { data: profile, error: profileFetchError } = await supabase
            .from('profiles')
            .select('id, name, organization_id, allowed_ministries, ministry_id')
            .eq('id', memberId)
            .single();

        if (profileFetchError || !profile) {
            return { success: false, message: "Membro não encontrado." };
        }

        try {
            await supabase
                .from('organization_memberships')
                .delete()
                .match({ 
                    organization_id: orgId, 
                    profile_id: memberId, 
                    ministry_id: ministryId 
                });
        } catch(e) {}

        const currentAllowed = safeParseArray(profile.allowed_ministries);
        const newAllowed = currentAllowed.filter((m: string) => m !== ministryId);
        
        const updates: any = { allowed_ministries: newAllowed };

        if (profile.ministry_id === ministryId) {
            updates.ministry_id = newAllowed.length > 0 ? newAllowed[0] : null;
        }

        const { error: updateError } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', memberId);

        if (updateError) throw new Error("Erro ao atualizar perfil: " + updateError.message);

        await supabase
            .from('schedule_assignments')
            .delete()
            .match({ 
                member_name: profile.name, 
                ministry_id: ministryId 
            });

        await logAction(ministryId, 'Membro Removido', `Membro ${profile.name} removido do ministério.`, orgId);

        return { success: true, message: "Membro removido do ministério com sucesso." };

    } catch (e: any) {
        console.error("Erro removeMemberFromMinistry:", e);
        return { success: false, message: e.message || "Erro interno ao remover membro." };
    }
};

// --- AVAILABILITY ---

export const fetchMinistryAvailability = async (ministryId: string) => {
    if (!supabase) return { availability: {}, notes: {} };
    
    const { data } = await supabase.from('availability').select('*').eq('ministry_id', ministryId);
    
    const availability: AvailabilityMap = {};
    const notes: AvailabilityNotesMap = {};

    data?.forEach((row: any) => {
        if (!availability[row.member_name]) availability[row.member_name] = [];
        availability[row.member_name].push(row.date_key);
        
        if (row.note) {
            const month = row.date_key.substring(0, 7);
            notes[`${row.member_name}_${month}-00`] = row.note;
        }
    });

    return { availability, notes };
};

// --- NOTIFICATIONS & ANNOUNCEMENTS ---

export const fetchNotificationsSQL = async (ministries: string[], userId: string): Promise<AppNotification[]> => {
    if (!supabase) return [];
    
    const { data: userNotifs } = await supabase
        .from('notifications')
        .select('*')
        .in('ministry_id', ministries)
        .order('created_at', { ascending: false })
        .limit(20);

    return (userNotifs || []).map((n: any) => {
        const readBy = safeParseArray(n.read_by);
        return {
            id: n.id,
            title: n.title,
            message: n.message,
            type: n.type,
            timestamp: n.created_at,
            read: readBy.includes(userId),
            ministryId: n.ministry_id,
            actionLink: n.action_link
        };
    });
};

export const markNotificationsReadSQL = async (ids: string[], userId: string) => {
    if (!supabase) return;
    
    for (const id of ids) {
        const { data } = await supabase.from('notifications').select('read_by').eq('id', id).single();
        if (data) {
            const readBy = safeParseArray(data.read_by);
            if (!readBy.includes(userId)) {
                await supabase.from('notifications').update({ read_by: [...readBy, userId] }).eq('id', id);
            }
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
        type: notification.type || 'info',
        action_link: notification.actionLink,
        created_at: new Date().toISOString(),
        read_by: []
    });
};

export const fetchAnnouncementsSQL = async (ministryId: string): Promise<Announcement[]> => {
    if (!supabase) return [];
    
    const { data } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

    return (data || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        message: a.message,
        type: a.type,
        timestamp: a.created_at,
        expirationDate: a.expiration_date,
        author: a.author,
        readBy: a.read_by || [], 
        likedBy: a.liked_by || [], 
        organizationId: a.organization_id
    }));
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
        let likes = data.liked_by || [];
        if (likes.some((l: any) => l.userId === userId)) {
            likes = likes.filter((l: any) => l.userId !== userId);
        } else {
            likes.push({ userId, name: userName, timestamp: new Date().toISOString() });
        }
        await supabase.from('announcements').update({ liked_by: likes }).eq('id', id);
    }
};

// --- OTHERS ---

export const fetchSwapRequests = async (ministryId: string): Promise<SwapRequest[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('swap_requests').select('*').eq('ministry_id', ministryId);
    return (data || []).map((r: any) => ({
        id: r.id,
        ministryId: r.ministry_id,
        requesterName: r.requester_name,
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
    const { data } = await supabase.from('repertoire').select('*').eq('ministry_id', ministryId);
    return (data || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        link: r.link,
        date: r.date,
        observation: r.observation,
        addedBy: r.added_by,
        createdAt: r.created_at,
        content: r.content,
        key: r.key
    }));
};

export const addToRepertoire = async (ministryId: string, item: Partial<RepertoireItem>) => {
    if (!supabase) return false;
    const { error } = await supabase.from('repertoire').insert({
        ministry_id: ministryId,
        title: item.title,
        link: item.link,
        date: item.date,
        added_by: item.addedBy,
        content: item.content
    });
    return !error;
};

export const deleteFromRepertoire = async (id: string) => {
    if (!supabase) return;
    await supabase.from('repertoire').delete().eq('id', id);
};

export const updateRepertoireItem = async (id: string, updates: Partial<RepertoireItem>) => {
    if (!supabase) return;
    await supabase.from('repertoire').update(updates).eq('id', id);
};

export const fetchGlobalSchedules = async (monthIso: string, excludeMinistryId: string): Promise<GlobalConflictMap> => {
    if (!supabase) return {};
    
    const { data } = await supabase
        .from('schedule_assignments')
        .select('*')
        .neq('ministry_id', excludeMinistryId);

    const conflicts: GlobalConflictMap = {};
    return conflicts; 
};

export const fetchAuditLogs = async (ministryId: string): Promise<AuditLogEntry[]> => {
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
    return [];
};

// --- ORG MANAGEMENT ---

export const fetchOrganizationsWithStats = async (): Promise<Organization[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('organizations').select('*');
    return (data || []).map((o: any) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        active: o.active,
        createdAt: o.created_at
    }));
};

export const saveOrganization = async (id: string | null, name: string, slug: string) => {
    if (!supabase) return { success: false, message: "Offline" };
    if (id) {
        const { error } = await supabase.from('organizations').update({ name, slug }).eq('id', id);
        return { success: !error, message: error ? error.message : "Salvo!" };
    } else {
        const { error } = await supabase.from('organizations').insert({ name, slug });
        return { success: !error, message: error ? error.message : "Criado!" };
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
    return { success: !error, message: error ? error.message : "Ministério adicionado!" };
};

export const deleteOrganizationMinistry = async (orgId: string, code: string) => {
    if (!supabase) return { success: false, message: "Offline" };
    const { error } = await supabase.from('organization_ministries').delete().match({ organization_id: orgId, code });
    return { success: !error, message: error ? error.message : "Removido!" };
};
