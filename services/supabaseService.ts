import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { MinistrySettings, RepertoireItem, User, MinistryDef, Organization } from '../types';

let supabase: SupabaseClient | null = null;
let serviceOrgId: string | null = null;

// --- INITIALIZATION & HELPERS ---

export const getSupabase = () => supabase;

export const setServiceOrgContext = (orgId: string) => {
    serviceOrgId = orgId;
};

export const clearServiceOrgContext = () => {
    serviceOrgId = null;
};

export const configureSupabaseManual = (url: string, key: string) => {
    try {
        supabase = createClient(url, key);
        localStorage.setItem('sb_url', url);
        localStorage.setItem('sb_key', key);
    } catch (e) {
        console.error("Failed to configure Supabase:", e);
    }
};

export const validateConnection = async (url: string, key: string): Promise<boolean> => {
    try {
        const client = createClient(url, key);
        const { error } = await client.from('profiles').select('count', { count: 'exact', head: true });
        return !error || error.code === 'PGRST116'; // Even if empty, connection worked
    } catch (e) {
        return false;
    }
};

// Auto-init from env or local storage
if (typeof __SUPABASE_URL__ !== 'undefined' && __SUPABASE_URL__ && __SUPABASE_KEY__) {
    supabase = createClient(__SUPABASE_URL__, __SUPABASE_KEY__);
} else {
    const cachedUrl = typeof window !== 'undefined' ? localStorage.getItem('sb_url') : null;
    const cachedKey = typeof window !== 'undefined' ? localStorage.getItem('sb_key') : null;
    if (cachedUrl && cachedKey) {
        supabase = createClient(cachedUrl, cachedKey);
    }
}

const requireSupabase = () => {
    if (!supabase) throw new Error("SUPABASE_NOT_INITIALIZED");
    return supabase;
};

const requireOrgId = (orgId?: string | null) => {
    if (!orgId) throw new Error("ORGANIZATION_ID_MISSING");
    return orgId;
};

const parseCompositeKey = (key: string) => {
    // Format: ruleId_YYYY-MM-DD_Role
    // Find date pattern
    const dateMatch = key.match(/(\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) throw new Error("Invalid Key Format");
    
    const date = dateMatch[0];
    const dateIndex = key.indexOf(date);
    
    const eventKey = key.substring(0, dateIndex - 1);
    const role = key.substring(dateIndex + date.length + 1);
    
    return { eventKey, eventDate: date, role };
};

// --- AUTHENTICATION ---

export const loginWithEmail = async (email: string, password?: string) => {
    const sb = requireSupabase();
    // Simple mock for logic if no password (magic link) vs password
    if (password) {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        return { success: !error, message: error?.message, user: data.user };
    } else {
        const { error } = await sb.auth.signInWithOtp({ email });
        return { success: !error, message: error?.message };
    }
};

export const registerWithEmail = async (email: string, password: string, name: string, ministries: string[], orgId: string, roles: string[]) => {
    const sb = requireSupabase();
    // 1. SignUp
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) return { success: false, message: error.message };
    if (!data.user) return { success: false, message: "User creation failed" };

    // 2. Profile Creation
    const { error: profileError } = await sb.from('profiles').insert({
        id: data.user.id,
        email,
        name,
        organization_id: orgId,
        ministry_id: ministries[0], // Main ministry
        allowed_ministries: ministries
    });

    if (profileError) return { success: false, message: "Profile creation failed: " + profileError.message };

    // 3. Roles/Functions
    // Assuming organization_memberships or similar logic for roles
    // Keeping it simple as per request scope
    
    return { success: true };
};

// --- SETTINGS & METADATA ---

export const fetchMinistrySettings = async (ministryId: string, orgId: string): Promise<MinistrySettings | null> => {
    const sb = requireSupabase();
    const { data } = await sb.from('ministry_settings')
        .select('*')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId) // Changed from organizationMinistryId check to direct ministry_id if that's how schema works, or mapping. Assuming direct check for now.
        .maybeSingle();
    
    if (data) {
        return {
            ...data,
            displayName: data.display_name || data.ministry_id,
            roles: data.roles || [],
            availabilityStart: data.availability_start,
            availabilityEnd: data.availability_end
        };
    }
    return null;
};

export const fetchOrganizationMinistries = async (orgId: string): Promise<MinistryDef[]> => {
    const sb = requireSupabase();
    const { data } = await sb.from('organization_ministries')
        .select('*')
        .eq('organization_id', orgId);
    
    return (data || []).map((m: any) => ({
        id: m.code, // Assuming code is used as ID in this app context based on types
        code: m.code,
        label: m.label,
        organizationId: m.organization_id
    }));
};

export const fetchUserAllowedMinistries = async (userId: string, orgId: string): Promise<string[]> => {
    const sb = requireSupabase();
    const { data } = await sb.from('profiles').select('allowed_ministries').eq('id', userId).single();
    return data?.allowed_ministries || [];
};

export const fetchUserFunctions = async (userId: string, ministryId: string, orgId: string): Promise<string[]> => {
    // If using organization_memberships table
    const sb = requireSupabase();
    const { data } = await sb.from('organization_memberships')
        .select('functions')
        .eq('user_id', userId)
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .maybeSingle();
    return data?.functions || [];
};

// --- SCHEDULE & ASSIGNMENTS ---

export const fetchScheduleAssignments = async (ministryId: string, month: string, orgId: string) => {
    const sb = requireSupabase();
    const validOrg = requireOrgId(orgId);
    
    const { data } = await sb.from('schedule_assignments')
        .select(`
            event_key,
            event_date,
            role,
            confirmed,
            member_id,
            profiles ( name )
        `)
        .eq('ministry_id', ministryId)
        .eq('organization_id', validOrg)
        .like('event_date', `${month}%`);
        
    const schedule: any = {};
    const attendance: any = {};
    
    (data || []).forEach((row: any) => {
        const key = `${row.event_key}_${row.event_date}_${row.role}`;
        const memberName = Array.isArray(row.profiles) ? row.profiles[0]?.name : row.profiles?.name;
        if (memberName) schedule[key] = memberName;
        if (row.confirmed) attendance[key] = true;
    });
    
    return { schedule, attendance };
};

export const saveScheduleAssignment = async (ministryId: string, orgId: string, key: string, memberId: string | null) => {
    const sb = requireSupabase();
    const validOrg = requireOrgId(orgId);
    const { eventKey, eventDate, role } = parseCompositeKey(key);

    if (!memberId) throw new Error("MEMBER_ID_REQUIRED");
    
    const { error } = await sb.from('schedule_assignments').upsert({ 
        ministry_id: ministryId, 
        organization_id: validOrg,
        event_key: eventKey,
        event_date: eventDate,
        role: role, 
        member_id: memberId,
        confirmed: false 
    }, { 
        onConflict: 'event_key, event_date, role'
    }); 
    
    if (error) throw error;
    return true;
};

export const removeScheduleAssignment = async (ministryId: string, orgId: string, key: string) => {
    const sb = requireSupabase();
    const validOrg = requireOrgId(orgId);
    const { eventKey, eventDate, role } = parseCompositeKey(key);

    const { error } = await sb.from('schedule_assignments').delete()
        .eq('event_key', eventKey) 
        .eq('event_date', eventDate)
        .eq('role', role)
        .eq('ministry_id', ministryId)
        .eq('organization_id', validOrg);

    if (error) throw error;
    return true;
};

export const toggleAssignmentConfirmation = async (ministryId: string, orgId: string, key: string) => {
    const sb = requireSupabase();
    const validOrg = requireOrgId(orgId);
    const { eventKey, eventDate, role } = parseCompositeKey(key);

    // First get current status
    const { data } = await sb.from('schedule_assignments')
        .select('confirmed')
        .eq('event_key', eventKey)
        .eq('event_date', eventDate)
        .eq('role', role)
        .single();
    
    if (data) {
        await sb.from('schedule_assignments')
            .update({ confirmed: !data.confirmed })
            .eq('event_key', eventKey)
            .eq('event_date', eventDate)
            .eq('role', role);
    }
};

// --- MEMBERS & AVAILABILITY ---

export const fetchMinistryMembers = async (ministryId: string, orgId: string) => {
    const sb = requireSupabase();
    const { data } = await sb.from('profiles')
        .select('*')
        .eq('organization_id', orgId)
        .contains('allowed_ministries', [ministryId]);
        
    const memberMap: any = {};
    const publicList: any[] = [];

    (data || []).forEach((p: any) => {
        // Mocking role distribution or using stored functions if available
        // For now putting everyone in 'default' if no specific logic
        if (!memberMap['Membro']) memberMap['Membro'] = [];
        memberMap['Membro'].push(p.name);
        
        publicList.push({
            id: p.id,
            name: p.name,
            avatar_url: p.avatar_url,
            whatsapp: p.whatsapp,
            email: p.email,
            roles: [], // Should fetch from membership
            isAdmin: p.is_admin
        });
    });

    return { memberMap, publicList };
};

export const fetchMinistryAvailability = async (ministryId: string, orgId: string) => {
    const sb = requireSupabase();
    // Simplified fetch, assuming a table 'availability' exists
    const { data } = await sb.from('availability').select('*').eq('ministry_id', ministryId).eq('organization_id', orgId);
    
    const availability: any = {};
    const notes: any = {};
    
    (data || []).forEach((row: any) => {
        // logic to map DB rows to AvailabilityMap
        // assuming row has member_name, date_iso
        if (!availability[row.member_name]) availability[row.member_name] = [];
        availability[row.member_name].push(row.date_iso);
        if (row.note) notes[`${row.member_name}_${row.date_iso}`] = row.note;
    });
    
    return { availability, notes };
};

// --- NOTIFICATIONS & ANNOUNCEMENTS ---

export const fetchNotificationsSQL = async (ministryIds: string[], userId: string, orgId: string, isAdmin: boolean) => {
    const sb = requireSupabase();
    // Complex query mock
    return [];
};

export const markNotificationsReadSQL = async (ids: string[], userId: string, orgId: string) => {
    // Implementation
};

export const clearAllNotificationsSQL = async (ministryId: string, orgId: string) => {
    const sb = requireSupabase();
    await sb.from('notifications').delete().eq('ministry_id', ministryId).eq('organization_id', orgId);
};

export const sendNotificationSQL = async (ministryId: string, orgId: string, payload: any) => {
    const sb = requireSupabase();
    await sb.from('notifications').insert({
        ministry_id: ministryId,
        organization_id: orgId,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        action_link: payload.actionLink,
        timestamp: new Date().toISOString()
    });
};

export const fetchAnnouncementsSQL = async (ministryId: string, orgId: string) => {
    const sb = requireSupabase();
    const { data } = await sb.from('announcements')
        .select('*')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId);
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

// --- OTHER FEATURES ---

export const fetchSwapRequests = async (ministryId: string, orgId: string) => {
    const sb = requireSupabase();
    const { data } = await sb.from('swap_requests').select('*').eq('ministry_id', ministryId).eq('organization_id', orgId);
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

export const fetchRepertoire = async (ministryId: string, orgId: string) => {
    const sb = requireSupabase();
    const { data } = await sb.from('repertoire').select('*').eq('ministry_id', ministryId).eq('organization_id', orgId);
    return (data || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        link: r.link,
        date: r.event_date,
        addedBy: r.added_by,
        content: r.content,
        key: r.key_note,
        createdAt: r.created_at
    }));
};

export const addToRepertoire = async (ministryId: string, orgId: string, item: any) => {
    const sb = requireSupabase();
    const { error } = await sb.from('repertoire').insert({
        ministry_id: ministryId,
        organization_id: orgId,
        title: item.title,
        link: item.link,
        event_date: item.date,
        added_by: item.addedBy,
        content: item.content
    });
    return !error;
};

export const deleteFromRepertoire = async (id: string, orgId: string) => {
    const sb = requireSupabase();
    await sb.from('repertoire').delete().eq('id', id).eq('organization_id', orgId);
};

export const updateRepertoireItem = async (id: string, orgId: string, updates: any) => {
    const sb = requireSupabase();
    await sb.from('repertoire').update({ 
        content: updates.content,
        key_note: updates.key 
    }).eq('id', id).eq('organization_id', orgId);
};

export const fetchGlobalSchedules = async (month: string, ministryId: string, orgId: string) => {
    // Mock or implement cross-ministry check
    return {};
};

export const fetchAuditLogs = async (ministryId: string, orgId: string) => {
    const sb = requireSupabase();
    const { data } = await sb.from('audit_logs').select('*').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(50);
    return (data || []).map((l: any) => ({
        id: l.id,
        date: l.created_at,
        action: l.action,
        details: l.details,
        author: l.author_name
    }));
};

export const fetchRankingData = async (ministryId: string, orgId: string) => {
    // Mock or implement point system
    return [];
};

// --- EVENT RULES ---

export const createEventRule = async (orgId: string, rule: any) => {
    const sb = requireSupabase();
    const { error } = await sb.from('event_rules').insert({
        organization_id: orgId,
        ministry_id: rule.ministryId,
        title: rule.title,
        type: rule.type,
        weekday: rule.weekday,
        date: rule.date,
        time: rule.time,
        active: true
    });
    if (error) throw error;
};

export const deleteEventRule = async (orgId: string, id: string) => {
    const sb = requireSupabase();
    await sb.from('event_rules').delete().eq('id', id).eq('organization_id', orgId);
};

// --- ADMIN / ORGANIZATION ---

export const fetchOrganizationsWithStats = async () => {
    const sb = requireSupabase();
    // Requires admin privilege
    const { data } = await sb.from('organizations').select('*');
    return (data || []).map((o: any) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        active: o.active,
        createdAt: o.created_at
    }));
};

export const saveOrganization = async (id: string | null, name: string, slug: string) => {
    const sb = requireSupabase();
    if (id) {
        const { error } = await sb.from('organizations').update({ name, slug }).eq('id', id);
        return { success: !error, message: error?.message || 'Salvo' };
    } else {
        const { error } = await sb.from('organizations').insert({ name, slug });
        return { success: !error, message: error?.message || 'Criado' };
    }
};

export const toggleOrganizationStatus = async (id: string, status: boolean) => {
    const sb = requireSupabase();
    const { error } = await sb.from('organizations').update({ active: status }).eq('id', id);
    return !error;
};

export const saveOrganizationMinistry = async (orgId: string, code: string, label: string) => {
    const sb = requireSupabase();
    const { error } = await sb.from('organization_ministries').insert({ organization_id: orgId, code, label });
    return { success: !error, message: error?.message || 'Salvo' };
};

export const deleteOrganizationMinistry = async (orgId: string, code: string) => {
    const sb = requireSupabase();
    const { error } = await sb.from('organization_ministries').delete().eq('organization_id', orgId).eq('code', code);
    return { success: !error, message: error?.message || 'Removido' };
};
