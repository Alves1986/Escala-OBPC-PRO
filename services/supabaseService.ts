
import { createClient } from '@supabase/supabase-js';
import { 
    User, MemberMap, 
    AppNotification, TeamMemberProfile, AvailabilityMap, SwapRequest, 
    ScheduleMap, RepertoireItem, Announcement, GlobalConflictMap, 
    AttendanceMap, AuditLogEntry, MinistrySettings, MinistryDef, Organization,
    RankingEntry, AvailabilityNotesMap, RankingHistoryItem, DEFAULT_TABS,
    CustomEvent
} from '../types';

// Globals injected by Vite via define (Configured in vite.config.ts)
declare const __SUPABASE_URL__: string;
declare const __SUPABASE_KEY__: string;

let injectedUrl = '';
let injectedKey = '';

// 1. Try Injected Globals (Build-time env vars)
try {
    // @ts-ignore
    if (typeof __SUPABASE_URL__ !== 'undefined') injectedUrl = __SUPABASE_URL__;
    // @ts-ignore
    if (typeof __SUPABASE_KEY__ !== 'undefined') injectedKey = __SUPABASE_KEY__;
} catch(e) {}

let metaUrl = '';
let metaKey = '';

// 2. Try import.meta.env (Vite Standard)
try {
    // @ts-ignore
    if (import.meta && import.meta.env) {
        // @ts-ignore
        metaUrl = import.meta.env.VITE_SUPABASE_URL;
        // @ts-ignore
        metaKey = import.meta.env.VITE_SUPABASE_KEY;
    }
} catch (e) {}

export const SUPABASE_URL = injectedUrl || metaUrl || "";
export const SUPABASE_KEY = injectedKey || metaKey || "";

let supabase: any = null;

if (SUPABASE_URL && SUPABASE_KEY) {
    try {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    } catch (e) {
        console.error("Failed to initialize Supabase client:", e);
    }
}

export const getSupabase = () => supabase;

// Helper
const safeParseArray = (arr: any) => Array.isArray(arr) ? arr : [];

// --- AUTH & USER ---

export const loginWithEmail = async (email: string, password: string) => {
    if (!supabase) return { success: false, message: "Erro de configuração." };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, message: error.message };
    return { success: true, data };
};

export const loginWithGoogle = async () => {
    if (!supabase) return { success: false, message: "Erro de configuração." };
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) return { success: false, message: error.message };
    return { success: true, data };
};

export const registerWithEmail = async (email: string, password: string, name: string, ministries: string[], orgId?: string, roles?: string[]) => {
    if (!supabase) return { success: false, message: "Erro de configuração." };
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: name,
                ministries, // Legacy support
                roles
            }
        }
    });
    if (error) return { success: false, message: error.message };
    
    // Create profile manually if needed, though triggers usually handle this
    return { success: true, message: "Verifique seu e-mail para confirmar o cadastro." };
};

export const sendPasswordResetEmail = async (email: string) => {
    if (!supabase) return { success: false, message: "Erro de configuração." };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/?view=reset',
    });
    if (error) return { success: false, message: error.message };
    return { success: true, message: "Link de redefinição enviado." };
};

export const updateLastMinistry = async (userId: string, ministryId: string) => {
    if (!supabase) return;
    try {
        await supabase.from('profiles').update({ last_ministry_id: ministryId }).eq('id', userId);
    } catch (e) {
        console.error("Erro ao salvar último ministério:", e);
    }
};

export const fetchUserAllowedMinistries = async (userId: string, orgId: string): Promise<string[]> => {
    if (!supabase) return ['midia'];

    try {
        const { data: memberships, error } = await supabase
            .from('organization_memberships')
            .select('ministry_id')
            .eq('profile_id', userId)
            .eq('organization_id', orgId);

        if (!error && memberships && memberships.length > 0) {
            return memberships.map((m: any) => m.ministry_id);
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('allowed_ministries')
            .eq('id', userId)
            .single();

        return safeParseArray(profile?.allowed_ministries);

    } catch (e) {
        console.error("Erro ao buscar permissões de ministério:", e);
        return ['midia'];
    }
};

export const updateUserProfile = async (name: string, whatsapp: string, avatar_url?: string, functions?: string[], birthDate?: string, ministryId?: string) => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const updates: any = {
        name,
        whatsapp,
        functions,
        birth_date: birthDate,
        updated_at: new Date().toISOString(),
    };
    if (avatar_url) updates.avatar_url = avatar_url;

    await supabase.from('profiles').update(updates).eq('id', user.id);
};

// --- SETTINGS & MINISTRY ---

export const fetchMinistrySettings = async (ministryId: string): Promise<MinistrySettings> => {
    if (!supabase) return { displayName: ministryId, roles: [] };
    const { data, error } = await supabase
        .from('ministry_settings')
        .select('*')
        .eq('ministry_id', ministryId)
        .single();
    
    if (error || !data) return { displayName: ministryId, roles: [] };
    
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

export const saveMinistrySettings = async (ministryId: string, displayName?: string, roles?: string[], start?: string, end?: string) => {
    if (!supabase) return;
    const updates: any = {};
    if (displayName !== undefined) updates.display_name = displayName;
    if (roles !== undefined) updates.roles = roles;
    if (start !== undefined) updates.availability_start = start;
    if (end !== undefined) updates.availability_end = end;

    const { error } = await supabase
        .from('ministry_settings')
        .update(updates)
        .eq('ministry_id', ministryId);
    
    if (error) {
        // Try insert if update fails (or use upsert)
        await supabase.from('ministry_settings').upsert({ 
            ministry_id: ministryId,
            ...updates
        });
    }
};

export const fetchOrganizationMinistries = async (orgId: string): Promise<MinistryDef[]> => {
    if (!supabase) return [];
    const { data } = await supabase
        .from('organization_ministries')
        .select('*')
        .eq('organization_id', orgId);
    
    return (data || []).map((m: any) => ({
        id: m.code, // Legacy compatibility: use code as ID
        code: m.code,
        label: m.label,
        enabledTabs: safeParseArray(m.enabled_tabs),
        organizationId: m.organization_id
    }));
};

// --- SCHEDULE & EVENTS ---

export const fetchMinistrySchedule = async (ministryId: string, month: string) => {
    if (!supabase) return { events: [], schedule: {}, attendance: {} };
    
    // Fetch Events
    const { data: events } = await supabase
        .from('events')
        .select('*')
        .eq('ministry_id', ministryId)
        .ilike('date_time', `${month}%`);

    const formattedEvents = (events || []).map((e: any) => ({
        iso: e.date_time,
        title: e.title,
        dateDisplay: new Date(e.date_time).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})
    }));

    // Fetch Assignments
    const { data: assignments } = await supabase
        .from('schedule_assignments')
        .select('*')
        .eq('ministry_id', ministryId)
        .ilike('event_iso', `${month}%`);

    const schedule: ScheduleMap = {};
    const attendance: AttendanceMap = {};

    (assignments || []).forEach((a: any) => {
        schedule[a.key_name] = a.member_name; // key_name format: YYYY-MM-DDTHH:mm_Role
        if (a.confirmed) attendance[a.key_name] = true;
    });

    return { events: formattedEvents, schedule, attendance };
};

export const saveScheduleAssignment = async (ministryId: string, key: string, memberName: string) => {
    if (!supabase) return;
    
    if (!memberName) {
        await supabase.from('schedule_assignments').delete().eq('ministry_id', ministryId).eq('key_name', key);
    } else {
        const iso = key.split('_')[0]; // Extract ISO from key
        const role = key.split('_').slice(1).join('_'); // Extract role
        
        // Find Event ID if needed (skipping for simple KV store approach)
        await supabase.from('schedule_assignments').upsert({
            ministry_id: ministryId,
            key_name: key,
            member_name: memberName,
            event_iso: iso,
            role_name: role,
            confirmed: false
        }, { onConflict: 'ministry_id, key_name' });
    }
};

export const toggleAssignmentConfirmation = async (ministryId: string, key: string) => {
    if (!supabase) return;
    
    const { data } = await supabase.from('schedule_assignments').select('confirmed').eq('ministry_id', ministryId).eq('key_name', key).single();
    if (data) {
        await supabase.from('schedule_assignments').update({ confirmed: !data.confirmed }).eq('ministry_id', ministryId).eq('key_name', key);
    }
};

export const createMinistryEvent = async (ministryId: string, event: Partial<CustomEvent>) => {
    if (!supabase) return;
    const iso = event.iso || `${event.date}T${event.time}`;
    await supabase.from('events').insert({
        ministry_id: ministryId,
        title: event.title,
        date_time: iso
    });
};

export const deleteMinistryEvent = async (ministryId: string, eventIso: string) => {
    if (!supabase) return;
    await supabase.from('events').delete().eq('ministry_id', ministryId).eq('date_time', eventIso);
};

export const updateMinistryEvent = async (ministryId: string, oldIso: string, title: string, newIso: string, applyToFuture: boolean) => {
    if (!supabase) return;
    
    // Update current event
    await supabase.from('events').update({ title, date_time: newIso }).eq('ministry_id', ministryId).eq('date_time', oldIso);
    
    // If we changed time, we need to migrate assignments
    if (oldIso !== newIso) {
        const { data: assignments } = await supabase.from('schedule_assignments').select('*').eq('ministry_id', ministryId).eq('event_iso', oldIso);
        if (assignments) {
            for (const assign of assignments) {
                const newKey = assign.key_name.replace(oldIso, newIso);
                await supabase.from('schedule_assignments').update({ key_name: newKey, event_iso: newIso }).eq('id', assign.id);
            }
        }
    }
};

export const clearScheduleForMonth = async (ministryId: string, month: string) => {
    if (!supabase) return;
    await supabase.from('schedule_assignments').delete().eq('ministry_id', ministryId).ilike('event_iso', `${month}%`);
};

export const resetToDefaultEvents = async (ministryId: string, month: string) => {
    // Logic to reset would depend on "default events" definition.
    // For now, let's assume it clears custom events and re-creates defaults if defined.
    // Placeholder implementation
};

// --- MEMBERS & AVAILABILITY ---

export const fetchMinistryMembers = async (ministryId: string) => {
    if (!supabase) return { memberMap: {}, publicList: [] };
    
    // Fetch profiles that have this ministry in allowed_ministries
    const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .contains('allowed_ministries', [ministryId]);

    const publicList: TeamMemberProfile[] = (profiles || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        whatsapp: p.whatsapp,
        avatar_url: p.avatar_url,
        roles: safeParseArray(p.functions),
        birthDate: p.birth_date,
        isAdmin: p.is_admin
    }));

    const memberMap: MemberMap = {};
    // Populate member map by role (legacy support)
    // ... logic to group by roles ...

    return { memberMap, publicList };
};

export const deleteMember = async (ministryId: string, memberId: string, memberName: string) => {
    if (!supabase) return;
    // Call Edge Function or perform direct DB update to remove from array
    const { data } = await supabase.functions.invoke('push-notification', {
        body: { action: 'delete_member', memberId, ministryId }
    });
};

export const toggleAdminSQL = async (email: string, status: boolean, ministryId: string) => {
    if (!supabase) return;
    await supabase.from('profiles').update({ is_admin: status }).eq('email', email);
};

export const fetchMinistryAvailability = async (ministryId: string) => {
    if (!supabase) return { availability: {}, notes: {} };
    
    const { data } = await supabase
        .from('availability')
        .select('*')
        .eq('ministry_id', ministryId);

    const availability: AvailabilityMap = {};
    const notes: AvailabilityNotesMap = {};

    (data || []).forEach((item: any) => {
        if (!availability[item.member_name]) availability[item.member_name] = [];
        availability[item.member_name].push(item.date_iso);
        
        if (item.note) {
            // Note key: Name_YYYY-MM-00 (usually monthly note)
            // Need to figure out how note was stored. Assuming stored per entry or separate table
        }
    });
    
    // Fetch notes separately if needed or from same table
    const { data: noteData } = await supabase.from('availability_notes').select('*').eq('ministry_id', ministryId);
    (noteData || []).forEach((n: any) => {
        notes[`${n.member_name}_${n.month_key}`] = n.note;
    });

    return { availability, notes };
};

export const saveMemberAvailability = async (ministryId: string, memberName: string, dates: string[], notes: Record<string, string>, targetMonth?: string) => {
    if (!supabase) return;
    
    // 1. Delete existing for this month/member
    if (targetMonth) {
        await supabase.from('availability').delete()
            .eq('ministry_id', ministryId)
            .eq('member_name', memberName)
            .ilike('date_iso', `${targetMonth}%`);
    }

    // 2. Insert new dates
    if (dates.length > 0) {
        const rows = dates.map(d => ({
            ministry_id: ministryId,
            member_name: memberName,
            date_iso: d
        }));
        await supabase.from('availability').insert(rows);
    }

    // 3. Save Notes
    for (const [key, note] of Object.entries(notes)) {
        await supabase.from('availability_notes').upsert({
            ministry_id: ministryId,
            member_name: memberName,
            month_key: key,
            note: note
        }, { onConflict: 'ministry_id, member_name, month_key' });
    }
};

// --- NOTIFICATIONS & ANNOUNCEMENTS ---

export const fetchNotificationsSQL = async (ministryIds: string[], userId: string) => {
    if (!supabase) return [];
    
    // Fetch global notifications for these ministries OR user specific
    const { data } = await supabase
        .from('notifications')
        .select('*')
        .in('ministry_id', ministryIds)
        .order('timestamp', { ascending: false })
        .limit(50);

    // Filter read status (stored in separate table or array)
    const { data: readData } = await supabase.from('notifications_read').select('notification_id').eq('user_id', userId);
    const readIds = new Set((readData || []).map((r: any) => r.notification_id));

    return (data || []).map((n: any) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        timestamp: n.timestamp,
        read: readIds.has(n.id),
        actionLink: n.action_link,
        ministryId: n.ministry_id
    }));
};

export const markNotificationsReadSQL = async (ids: string[], userId: string) => {
    if (!supabase) return;
    const rows = ids.map(id => ({ user_id: userId, notification_id: id }));
    await supabase.from('notifications_read').upsert(rows, { onConflict: 'user_id, notification_id' });
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
        action_link: notification.actionLink
    });
    // Trigger push notification via Edge Function if needed
};

export const fetchAnnouncementsSQL = async (ministryId: string) => {
    if (!supabase) return [];
    const { data } = await supabase
        .from('announcements')
        .select('*')
        .eq('ministry_id', ministryId)
        .order('created_at', { ascending: false });

    return (data || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        message: a.message,
        type: a.type,
        timestamp: a.created_at,
        author: a.author_name,
        readBy: safeParseArray(a.read_by),
        likedBy: safeParseArray(a.liked_by),
        organizationId: a.organization_id
    }));
};

export const createAnnouncementSQL = async (ministryId: string, ann: any, authorName: string) => {
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

export const interactAnnouncementSQL = async (id: string, userId: string, userName: string, action: 'read' | 'like') => {
    // Complex update involving jsonb array append, simplified here
    if (!supabase) return;
    // Call RPC or fetch-update-save
    const { data } = await supabase.from('announcements').select('*').eq('id', id).single();
    if (!data) return;

    let targetArray = action === 'read' ? data.read_by || [] : data.liked_by || [];
    // Check if already exists
    if (targetArray.some((x: any) => x.userId === userId)) {
        if (action === 'like') {
            // Unlike
            targetArray = targetArray.filter((x: any) => x.userId !== userId);
        } else {
            return; // Already read
        }
    } else {
        targetArray.push({ userId, name: userName, timestamp: new Date().toISOString() });
    }

    const update = action === 'read' ? { read_by: targetArray } : { liked_by: targetArray };
    await supabase.from('announcements').update(update).eq('id', id);
};

// --- REPERTOIRE & SWAPS ---

export const fetchRepertoire = async (ministryId: string) => {
    if (!supabase) return [];
    const { data } = await supabase.from('repertoire').select('*').eq('ministry_id', ministryId);
    return (data || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        link: r.link,
        date: r.date,
        addedBy: r.added_by,
        content: r.content,
        key: r.key
    }));
};

export const addToRepertoire = async (ministryId: string, item: any) => {
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

export const updateRepertoireItem = async (id: string, updates: any) => {
    if (!supabase) return;
    await supabase.from('repertoire').update(updates).eq('id', id);
};

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

export const createSwapRequestSQL = async (ministryId: string, req: SwapRequest) => {
    if (!supabase) return;
    await supabase.from('swap_requests').insert({
        ministry_id: ministryId,
        requester_name: req.requesterName,
        requester_id: req.requesterId,
        role: req.role,
        event_iso: req.eventIso,
        event_title: req.eventTitle,
        status: 'pending'
    });
};

export const performSwapSQL = async (ministryId: string, reqId: string, takenByName: string, takenById: string) => {
    if (!supabase) return;
    // 1. Update Request
    const { data: req } = await supabase.from('swap_requests').update({
        status: 'completed',
        taken_by_name: takenByName,
        taken_by_id: takenById
    }).eq('id', reqId).select('*').single();

    if (req) {
        // 2. Update Schedule
        // Find assignment key based on iso and role... might need better key logic or search
        const { data: assignments } = await supabase.from('schedule_assignments')
            .select('*')
            .eq('ministry_id', ministryId)
            .eq('event_iso', req.event_iso)
            .eq('member_name', req.requester_name); // Assuming role matches, or filter by role_name too

        const targetAssignment = assignments?.find((a: any) => a.role_name === req.role || a.key_name.includes(req.role));
        
        if (targetAssignment) {
            await supabase.from('schedule_assignments').update({
                member_name: takenByName,
                confirmed: false
            }).eq('id', targetAssignment.id);
        }
    }
};

export const cancelSwapRequestSQL = async (reqId: string) => {
    if (!supabase) return;
    await supabase.from('swap_requests').delete().eq('id', reqId);
};

// --- STATS & AUDIT ---

export const fetchRankingData = async (ministryId: string): Promise<RankingEntry[]> => {
    if (!supabase) return [];
    // This typically requires complex aggregation or an RPC call.
    // Mocking return for now or simple fetch from a view
    return []; 
};

export const fetchAuditLogs = async (ministryId: string): Promise<AuditLogEntry[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('audit_logs').select('*').eq('ministry_id', ministryId).order('created_at', { ascending: false }).limit(50);
    return (data || []).map((l: any) => ({
        id: l.id,
        date: l.created_at,
        action: l.action,
        details: l.details,
        author: l.author_name
    }));
};

export const fetchGlobalSchedules = async (month: string, currentMinistryId: string): Promise<GlobalConflictMap> => {
    if (!supabase) return {};
    // Fetch assignments from OTHER ministries for the same month
    const { data } = await supabase.from('schedule_assignments')
        .select('*')
        .neq('ministry_id', currentMinistryId)
        .ilike('event_iso', `${month}%`);
    
    const conflicts: GlobalConflictMap = {};
    (data || []).forEach((a: any) => {
        const name = a.member_name.toLowerCase().trim();
        if (!conflicts[name]) conflicts[name] = [];
        conflicts[name].push({
            ministryId: a.ministry_id,
            eventIso: a.event_iso,
            role: a.role_name
        });
    });
    return conflicts;
};

export const fetchOrganizationsWithStats = async (): Promise<Organization[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('organizations').select('*');
    return (data || []).map((o: any) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        active: o.active,
        createdAt: o.created_at,
        userCount: 0, // Need separate count query
        ministryCount: 0
    }));
};

export const saveOrganization = async (id: string | null, name: string, slug: string) => {
    if (!supabase) return { success: false, message: "Erro" };
    const payload = { name, slug };
    if (id) {
        await supabase.from('organizations').update(payload).eq('id', id);
    } else {
        await supabase.from('organizations').insert(payload);
    }
    return { success: true, message: "Salvo com sucesso." };
};

export const toggleOrganizationStatus = async (id: string, status: boolean) => {
    if (!supabase) return false;
    await supabase.from('organizations').update({ active: status }).eq('id', id);
    return true;
};

export const saveOrganizationMinistry = async (orgId: string, code: string, label: string) => {
    if (!supabase) return { success: false, message: "Erro" };
    await supabase.from('organization_ministries').insert({
        organization_id: orgId,
        code,
        label
    });
    return { success: true, message: "Ministério adicionado." };
};

export const deleteOrganizationMinistry = async (orgId: string, code: string) => {
    if (!supabase) return { success: false, message: "Erro" };
    await supabase.from('organization_ministries').delete().eq('organization_id', orgId).eq('code', code);
    return { success: true, message: "Ministério removido." };
};

export const joinMinistry = async (ministryId: string, roles: string[]) => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Update profiles allowed_ministries array
    const { data: profile } = await supabase.from('profiles').select('allowed_ministries').eq('id', user.id).single();
    const current = safeParseArray(profile?.allowed_ministries);
    if (!current.includes(ministryId)) {
        await supabase.from('profiles').update({ allowed_ministries: [...current, ministryId] }).eq('id', user.id);
    }
    // Also insert into organization_memberships if using that table
};
