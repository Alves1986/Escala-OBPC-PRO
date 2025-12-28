
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
    MinistryDef, 
    MinistrySettings, 
    Organization, 
    CustomEvent, 
    RepertoireItem,
    SwapRequest,
    AppNotification,
    Announcement,
    AuditLogEntry,
    RankingEntry
} from '../types';

// --- SAFELY ACCESS ENVIRONMENT VARIABLES ---
const getEnv = (key: string) => {
    try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env) {
            // @ts-ignore
            return import.meta.env[key] || '';
        }
    } catch (e) {
        // ignore
    }
    try {
        // Fallback for process.env (Node/other environments)
        if (typeof process !== 'undefined' && process.env) {
            return process.env[key] || '';
        }
    } catch (e) {
        // ignore
    }
    return '';
};

export const SUPABASE_URL = getEnv('VITE_SUPABASE_URL');
export const SUPABASE_KEY = getEnv('VITE_SUPABASE_KEY');
export const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000000';

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

// --- UTILS ---
const safeParseArray = (value: any): string[] => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }
    return [];
};

// --- AUTH ---
export const loginWithEmail = async (email: string, pass: string) => {
    if (!supabase) return { success: false, message: "Supabase não configurado" };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) return { success: false, message: error.message };
    return { success: true, message: "Login realizado!" };
};

export const loginWithGoogle = async () => {
    if (!supabase) return { success: false, message: "Supabase não configurado" };
    const { data, error } = await supabase.auth.signInWithOAuth({ 
        provider: 'google', 
        options: { redirectTo: window.location.origin } 
    });
    if (error) return { success: false, message: error.message };
    return { success: true, message: "Redirecionando..." };
};

export const registerWithEmail = async (
    email: string, 
    pass: string, 
    name: string, 
    ministries: string[], 
    phone?: string, 
    functions?: string[],
    targetOrgId?: string
) => {
    if (!supabase) return { success: false, message: "Supabase Off" };
    
    const { data, error } = await supabase.auth.signUp({ 
        email, password: pass, options: { data: { name, full_name: name } }
    });

    if (error) return { success: false, message: error.message };

    if (data.user) {
        const mainMinistry = ministries[0] || 'midia';
        const organizationId = targetOrgId || DEFAULT_ORG_ID;
        
        await supabase.from('profiles').insert({
            id: data.user.id, 
            email, 
            name, 
            ministry_id: mainMinistry, 
            allowed_ministries: ministries, 
            organization_id: organizationId, 
            whatsapp: phone, 
            functions: functions || []
        });
        
        // Simulating memberships creation if schema supports it
        // await supabase.from('organization_memberships').insert(...)

        await sendNotificationSQL(mainMinistry, { 
            title: "Novo Membro", 
            message: `${name} acabou de se cadastrar na equipe!`, 
            type: 'success', 
            actionLink: 'members',
            organizationId: organizationId
        });
    }
    return { success: true, message: "Cadastro realizado!" };
};

export const logout = async () => { if (supabase) await supabase.auth.signOut(); window.location.reload(); };

export const sendPasswordResetEmail = async (email: string) => {
    if (!supabase) return { success: false, message: "Supabase não configurado" };
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' });
    if (error) return { success: false, message: error.message };
    return { success: true, message: "Email de recuperação enviado!" };
};

// --- ORGANIZATION / MINISTRY ---

export const getOrganizationPublicData = async (orgId: string) => {
    if (!supabase) return null;
    const { data, error } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', orgId)
        .single();
    
    if (error || !data) return null;
    return data;
};

export const fetchOrganizationMinistries = async (organizationId: string): Promise<MinistryDef[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('organization_ministries')
        .select('*')
        .eq('organization_id', organizationId);

    if (error || !data) return [];
    return data.map((m: any) => ({
        id: m.code, // Legacy mapping: code is used as ID in frontend often
        code: m.code,
        label: m.label,
        enabledTabs: safeParseArray(m.enabled_tabs),
        organizationId: m.organization_id
    }));
};

export const fetchUserAllowedMinistries = async (userId: string, orgId: string): Promise<string[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('profiles').select('allowed_ministries').eq('id', userId).single();
    return safeParseArray(data?.allowed_ministries);
};

export const fetchMinistrySettings = async (ministryId: string): Promise<MinistrySettings | null> => {
    if (!supabase) return null;
    const { data } = await supabase.from('ministry_settings').select('*').eq('ministry_id', ministryId).single();
    if (!data) return null;
    return {
        displayName: data.display_name,
        roles: safeParseArray(data.roles),
        availabilityStart: data.availability_start,
        availabilityEnd: data.availability_end
    };
};

export const saveMinistrySettings = async (ministryId: string, displayName?: string, roles?: string[], availabilityStart?: string, availabilityEnd?: string) => {
    if (!supabase) return;
    const updates: any = {};
    if (displayName !== undefined) updates.display_name = displayName;
    if (roles !== undefined) updates.roles = roles;
    if (availabilityStart !== undefined) updates.availability_start = availabilityStart;
    if (availabilityEnd !== undefined) updates.availability_end = availabilityEnd;
    
    await supabase.from('ministry_settings').update(updates).eq('ministry_id', ministryId);
};

// --- SCHEDULE & EVENTS ---

export const fetchMinistrySchedule = async (ministryId: string, month: string) => {
    if (!supabase) return { events: [], schedule: {}, attendance: {} };
    
    // Events
    const { data: eventsData } = await supabase.from('events').select('*').eq('ministry_id', ministryId).like('date_time', `${month}%`);
    const events = (eventsData || []).map((e: any) => ({
        id: e.id,
        iso: e.date_time,
        title: e.title,
        dateDisplay: new Date(e.date_time).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'}),
        time: e.date_time.split('T')[1].substring(0,5),
        date: e.date_time.split('T')[0]
    }));

    // Schedule Assignments
    const { data: assignments } = await supabase.from('schedule_assignments').select('*').eq('ministry_id', ministryId).like('event_date_time', `${month}%`);
    const schedule: any = {};
    const attendance: any = {};
    
    assignments?.forEach((a: any) => {
        const key = `${a.event_date_time}_${a.role}`;
        schedule[key] = a.member_name;
        if (a.confirmed) attendance[key] = true;
    });

    return { events, schedule, attendance };
};

export const createMinistryEvent = async (ministryId: string, event: Partial<CustomEvent>) => {
    if (!supabase) return;
    const iso = event.iso || `${event.date}T${event.time}`;
    await supabase.from('events').insert({
        ministry_id: ministryId,
        date_time: iso,
        title: event.title
    });
};

export const deleteMinistryEvent = async (ministryId: string, iso: string) => {
    if (!supabase) return;
    // Delete assignments first (cascade usually handles this but good to be safe)
    await supabase.from('schedule_assignments').delete().eq('ministry_id', ministryId).eq('event_date_time', iso);
    await supabase.from('events').delete().eq('ministry_id', ministryId).eq('date_time', iso);
};

export const updateMinistryEvent = async (ministryId: string, oldIso: string, newTitle: string, newIso: string, applyToAll: boolean) => {
    if (!supabase) return;
    // Simple update for single event
    await supabase.from('events')
        .update({ title: newTitle, date_time: newIso })
        .eq('ministry_id', ministryId)
        .eq('date_time', oldIso);
};

export const saveScheduleAssignment = async (ministryId: string, key: string, memberName: string) => {
    if (!supabase) return;
    const [iso, role] = key.split(/_(.+)/);
    
    if (!memberName) {
        await supabase.from('schedule_assignments').delete()
            .eq('ministry_id', ministryId)
            .eq('event_date_time', iso)
            .eq('role', role);
        return;
    }

    const { data: member } = await supabase.from('profiles').select('id').eq('name', memberName).single();
    
    await supabase.from('schedule_assignments').upsert({
        ministry_id: ministryId,
        event_date_time: iso,
        role: role,
        member_name: memberName,
        member_id: member?.id,
        confirmed: false
    }, { onConflict: 'ministry_id, event_date_time, role' });
};

export const toggleAssignmentConfirmation = async (ministryId: string, key: string) => {
    if (!supabase) return;
    const [iso, role] = key.split(/_(.+)/);
    
    const { data } = await supabase.from('schedule_assignments')
        .select('confirmed')
        .eq('ministry_id', ministryId)
        .eq('event_date_time', iso)
        .eq('role', role)
        .single();
        
    if (data) {
        await supabase.from('schedule_assignments')
            .update({ confirmed: !data.confirmed })
            .eq('ministry_id', ministryId)
            .eq('event_date_time', iso)
            .eq('role', role);
    }
};

export const clearScheduleForMonth = async (ministryId: string, month: string) => {
    if (!supabase) return;
    await supabase.from('schedule_assignments').delete()
        .eq('ministry_id', ministryId)
        .like('event_date_time', `${month}%`);
};

export const resetToDefaultEvents = async (ministryId: string, month: string) => {
    if (!supabase) return;
    // This would typically involve an RPC or logic to recreate events based on templates
    console.log("Reset events not fully implemented in frontend-only mock");
};

// --- MEMBERS & AVAILABILITY ---

export const fetchMinistryMembers = async (ministryId: string) => {
    if (!supabase) return { memberMap: {}, publicList: [] };
    
    const { data: profiles } = await supabase.from('profiles')
        .select('*')
        .contains('allowed_ministries', [ministryId]);
        
    const publicList = (profiles || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        avatar_url: p.avatar_url,
        roles: safeParseArray(p.functions),
        isAdmin: p.is_admin,
        email: p.email,
        whatsapp: p.whatsapp,
        birthDate: p.birth_date
    }));

    const memberMap: any = {};
    publicList.forEach((p: any) => {
        p.roles?.forEach((r: string) => {
            if (!memberMap[r]) memberMap[r] = [];
            memberMap[r].push(p.name);
        });
    });

    return { memberMap, publicList };
};

export const fetchMinistryAvailability = async (ministryId: string) => {
    if (!supabase) return { availability: {}, notes: {} };
    
    const { data } = await supabase.from('availability')
        .select('*')
        .eq('ministry_id', ministryId);
        
    const availability: any = {};
    const notes: any = {};
    
    data?.forEach((d: any) => {
        availability[d.member_name] = safeParseArray(d.dates);
        if (d.notes) {
            Object.entries(d.notes).forEach(([k, v]) => {
                notes[`${d.member_name}_${k}`] = v;
            });
        }
    });

    return { availability, notes };
};

export const saveMemberAvailability = async (ministryId: string, member: string, dates: string[], notes: any, month: string) => {
    if (!supabase) return;
    
    // Fetch existing notes to merge
    const { data: existing } = await supabase.from('availability')
        .select('notes')
        .eq('ministry_id', ministryId)
        .eq('member_name', member)
        .single();
        
    const mergedNotes = { ...(existing?.notes || {}), ...notes };

    await supabase.from('availability').upsert({
        ministry_id: ministryId,
        member_name: member,
        dates: dates, // Assuming the backend handles storing array (JSONB)
        notes: mergedNotes
    }, { onConflict: 'ministry_id, member_name' });
};

export const updateUserProfile = async (name: string, whatsapp: string, avatar: string | undefined, functions: string[] | undefined, birthDate: string | undefined, ministryId?: string) => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const updates: any = { name, whatsapp, functions };
    if (avatar) updates.avatar_url = avatar;
    if (birthDate) updates.birth_date = birthDate;

    await supabase.from('profiles').update(updates).eq('id', user.id);
};

export const toggleAdminSQL = async (email: string, status: boolean, ministryId: string) => {
    if (!supabase) return;
    await supabase.from('profiles').update({ is_admin: status }).eq('email', email);
};

export const deleteMember = async (ministryId: string, memberId: string, memberName: string) => {
    // Requires RPC or manual updates to allowed_ministries array
    console.log("Delete member logic needs implementation specific to schema");
};

export const joinMinistry = async (ministryId: string, roles: string[]) => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from('profiles').select('allowed_ministries, functions').eq('id', user.id).single();
    const currentMinistries = safeParseArray(profile?.allowed_ministries);
    const currentFunctions = safeParseArray(profile?.functions);

    if (!currentMinistries.includes(ministryId)) {
        await supabase.from('profiles').update({
            allowed_ministries: [...currentMinistries, ministryId],
            functions: [...new Set([...currentFunctions, ...roles])]
        }).eq('id', user.id);
    }
};

export const updateProfileMinistry = async (userId: string, ministryId: string) => {
    if (!supabase) return;
    await supabase.from('profiles').update({ ministry_id: ministryId }).eq('id', userId);
};

// --- NOTIFICATIONS & ANNOUNCEMENTS ---

export const fetchNotificationsSQL = async (ministries: string[], userId: string) => {
    if (!supabase) return [];
    // Assuming simple fetch for user-specific notifications
    const { data } = await supabase.from('notifications')
        .select('*')
        .in('ministry_id', ministries)
        .order('timestamp', { ascending: false })
        .limit(50);
        
    // Need to handle "read" status which might be a separate table or array
    return (data || []).map((n: any) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        timestamp: n.created_at,
        read: false, // Default unread for simplicity in this mock
        actionLink: n.action_link,
        ministryId: n.ministry_id
    }));
};

export const sendNotificationSQL = async (ministryId: string, notification: Partial<AppNotification> & { organizationId?: string }) => {
    if (!supabase) return;
    await supabase.from('notifications').insert({
        ministry_id: ministryId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        action_link: notification.actionLink,
        organization_id: notification.organizationId
    });
};

export const markNotificationsReadSQL = async (ids: string[], userId: string) => {
    // Logic to mark read
};

export const clearAllNotificationsSQL = async (ministryId: string) => {
    if (!supabase) return;
    await supabase.from('notifications').delete().eq('ministry_id', ministryId);
};

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
        readBy: safeParseArray(a.read_by),
        likedBy: safeParseArray(a.liked_by)
    }));
};

export const createAnnouncementSQL = async (ministryId: string, announcement: Partial<Announcement>, authorName?: string) => {
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
    // Logic involves fetching current array and appending user if not present
    // Simplified:
    const rpcName = action === 'read' ? 'mark_announcement_read' : 'toggle_announcement_like';
    await supabase.rpc(rpcName, { p_announcement_id: id, p_user_id: userId, p_user_name: userName });
};

// --- SWAPS & REPERTOIRE ---

export const fetchSwapRequests = async (ministryId: string) => {
    if (!supabase) return [];
    const { data } = await supabase.from('swap_requests').select('*').eq('ministry_id', ministryId);
    return (data || []).map((s: any) => ({
        id: s.id,
        ministryId: s.ministry_id,
        requesterName: s.requester_name,
        role: s.role,
        eventIso: s.event_iso,
        eventTitle: s.event_title,
        status: s.status,
        createdAt: s.created_at,
        takenByName: s.taken_by_name
    }));
};

export const createSwapRequestSQL = async (ministryId: string, request: Partial<SwapRequest>) => {
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

export const performSwapSQL = async (ministryId: string, requestId: string, userName: string, userId: string) => {
    if (!supabase) return;
    // This typically requires a transaction or RPC to update assignment AND request
    await supabase.rpc('perform_swap', { 
        p_ministry_id: ministryId, 
        p_request_id: requestId, 
        p_user_name: userName, 
        p_user_id: userId 
    });
};

export const cancelSwapRequestSQL = async (requestId: string) => {
    if (!supabase) return;
    await supabase.from('swap_requests').delete().eq('id', requestId);
};

export const fetchRepertoire = async (ministryId: string) => {
    if (!supabase) return [];
    const { data } = await supabase.from('repertoire').select('*').eq('ministry_id', ministryId);
    return (data || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        link: r.link,
        date: r.date_for,
        addedBy: r.added_by,
        content: r.content,
        key: r.musical_key
    }));
};

export const addToRepertoire = async (ministryId: string, item: any) => {
    if (!supabase) return false;
    const { error } = await supabase.from('repertoire').insert({
        ministry_id: ministryId,
        title: item.title,
        link: item.link,
        date_for: item.date,
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
    if (updates.content) dbUpdates.content = updates.content;
    if (updates.key) dbUpdates.musical_key = updates.key;
    await supabase.from('repertoire').update(dbUpdates).eq('id', id);
};

// --- MISC ---

export const fetchGlobalSchedules = async (month: string, currentMinistryId: string) => {
    // For conflict detection
    if (!supabase) return {};
    const { data } = await supabase.from('schedule_assignments')
        .select('*')
        .neq('ministry_id', currentMinistryId)
        .like('event_date_time', `${month}%`);
    
    const conflicts: any = {};
    data?.forEach((a: any) => {
        const normName = a.member_name.trim().toLowerCase();
        if (!conflicts[normName]) conflicts[normName] = [];
        conflicts[normName].push({
            ministryId: a.ministry_id,
            eventIso: a.event_date_time,
            role: a.role
        });
    });
    return conflicts;
};

export const fetchAuditLogs = async (ministryId: string) => {
    if (!supabase) return [];
    const { data } = await supabase.from('audit_logs')
        .select('*')
        .eq('ministry_id', ministryId)
        .order('created_at', { ascending: false })
        .limit(50);
        
    return (data || []).map((l: any) => ({
        id: l.id,
        date: l.created_at,
        action: l.action,
        details: l.details,
        author: l.author
    }));
};

export const fetchRankingData = async (ministryId: string) => {
    // Mock or RPC
    if (!supabase) return [];
    // Assuming backend calculates or returns raw stats
    return [];
};

// --- SUPER ADMIN ---

export const fetchOrganizationsWithStats = async () => {
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
    if (!supabase) return { success: false, message: "No DB" };
    if (id) {
        const { error } = await supabase.from('organizations').update({ name, slug }).eq('id', id);
        return error ? { success: false, message: error.message } : { success: true, message: "Atualizado" };
    } else {
        const { error } = await supabase.from('organizations').insert({ name, slug });
        return error ? { success: false, message: error.message } : { success: true, message: "Criado" };
    }
};

export const toggleOrganizationStatus = async (id: string, active: boolean) => {
    if (!supabase) return false;
    const { error } = await supabase.from('organizations').update({ active }).eq('id', id);
    return !error;
};

export const saveOrganizationMinistry = async (orgId: string, code: string, label: string) => {
    if (!supabase) return { success: false, message: "No DB" };
    // Usually via organization_ministries table
    const { error } = await supabase.from('organization_ministries').upsert({
        organization_id: orgId,
        code: code,
        label: label
    });
    return error ? { success: false, message: error.message } : { success: true, message: "Salvo" };
};

export const deleteOrganizationMinistry = async (orgId: string, code: string) => {
    if (!supabase) return { success: false, message: "No DB" };
    const { error } = await supabase.from('organization_ministries')
        .delete()
        .eq('organization_id', orgId)
        .eq('code', code);
    return error ? { success: false, message: error.message } : { success: true, message: "Removido" };
};
