
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { MinistryDef, Organization, MinistrySettings, User } from '../types';

let supabase: SupabaseClient | null = null;
let serviceOrgId: string | null = null;

// --- Config & Init ---

export const configureSupabaseManual = (url: string, key: string) => {
    try {
        supabase = createClient(url, key, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
        // Try to recover org context from storage
        const storedOrg = localStorage.getItem('service_org_context');
        if (storedOrg) serviceOrgId = storedOrg;
    } catch (e) {
        console.error("Failed to init Supabase:", e);
    }
};

export const getSupabase = () => {
    // Auto-init from env vars if available and not yet initialized
    if (!supabase && typeof __SUPABASE_URL__ !== 'undefined' && typeof __SUPABASE_KEY__ !== 'undefined' && __SUPABASE_URL__ && __SUPABASE_KEY__) {
        configureSupabaseManual(__SUPABASE_URL__, __SUPABASE_KEY__);
    }
    return supabase;
};

export const requireSupabase = () => {
    const sb = getSupabase();
    if (!sb) throw new Error("SUPABASE_NOT_INITIALIZED");
    return sb;
};

export const requireOrgId = (orgId?: string | null) => {
    const oid = orgId || serviceOrgId;
    if (!oid) throw new Error("ORGANIZATION_ID_MISSING");
    return oid;
};

export const setServiceOrgContext = (orgId: string) => {
    serviceOrgId = orgId;
    localStorage.setItem('service_org_context', orgId);
};

export const clearServiceOrgContext = () => {
    serviceOrgId = null;
    localStorage.removeItem('service_org_context');
};

export const validateConnection = async (url: string, key: string) => {
    try {
        const tempSb = createClient(url, key);
        const { error } = await tempSb.from('profiles').select('count', { count: 'exact', head: true });
        return !error || error.code === 'PGRST116'; // Allow success or empty result
    } catch (e) {
        return false;
    }
};

// --- Helpers ---

export const parseCompositeKey = (key: string) => {
    // Expected: eventId_YYYY-MM-DD_Role
    // OR: RuleID_YYYY-MM-DD_Role
    // Split by last underscore for Role, then date
    
    // Simple heuristic: key is like "ID_Date_Role"
    // But Role can contain underscores? Hopefully not often.
    // Date is YYYY-MM-DD (10 chars).
    
    const parts = key.split('_');
    const role = parts.pop() || "";
    // Rejoin the rest
    const remainder = parts.join('_');
    // Extract date from end of remainder
    const eventDate = remainder.slice(-10); // YYYY-MM-DD
    const eventKey = remainder.slice(0, -11); // ID
    
    return { eventKey, eventDate, role };
};

// --- Auth ---

export const loginWithEmail = async (email: string, password: string) => {
    const sb = requireSupabase();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return { success: false, message: error.message };
    return { success: true, user: data.user };
};

export const registerWithEmail = async (email: string, password: string, name: string, ministries: string[], orgId: string, roles: string[] = []) => {
    const sb = requireSupabase();
    
    // 1. Sign Up
    const { data: authData, error: authError } = await sb.auth.signUp({ 
        email, 
        password,
        options: {
            data: { display_name: name, organization_id: orgId }
        }
    });

    if (authError) return { success: false, message: authError.message };
    if (!authData.user) return { success: false, message: "No user returned" };

    // 2. Create Profile (Trigger usually handles this, but we update it)
    const { error: profileError } = await sb.from('profiles').upsert({
        id: authData.user.id,
        email,
        name,
        organization_id: orgId,
        allowed_ministries: ministries,
        ministry_id: ministries[0] || null
    });

    if (profileError) {
        // If profile creation fails, we might want to cleanup user, but for now just report
        console.error("Profile update failed", profileError);
    }

    // 3. Add to Memberships/Roles for the main ministry
    if (ministries.length > 0 && roles.length > 0) {
        await sb.from('organization_memberships').insert({
            organization_id: orgId,
            user_id: authData.user.id,
            ministry_id: ministries[0],
            functions: roles
        });
    }

    return { success: true };
};

// --- Ministries & Orgs ---

export const fetchMinistrySettings = async (ministryId: string, orgId: string): Promise<MinistrySettings | null> => {
    const sb = requireSupabase();
    const validOrg = requireOrgId(orgId);
    
    const { data, error } = await sb.from('ministry_settings')
        .select('*')
        .eq('organization_id', validOrg)
        .eq('ministry_id', ministryId) // Changed column name based on common patterns, assuming 'ministry_id' matches schema
        .maybeSingle();
        
    if (error) {
        // Try fallback to code if ministry_id is not UUID
        // But for now assume standard
        console.warn("Fetch Settings Error:", error);
    }
    
    return data ? {
        id: data.id,
        displayName: data.display_name,
        roles: data.roles || [],
        availabilityStart: data.availability_start,
        availabilityEnd: data.availability_end,
        spotifyClientId: data.spotify_client_id,
        spotifyClientSecret: data.spotify_client_secret
    } : null;
};

export const fetchOrganizationMinistries = async (orgId: string): Promise<MinistryDef[]> => {
    const sb = requireSupabase();
    const { data } = await sb.from('organization_ministries').select('*').eq('organization_id', orgId);
    return (data || []).map((m: any) => ({
        id: m.id,
        code: m.code,
        label: m.label,
        organizationId: m.organization_id
    }));
};

export const fetchUserAllowedMinistries = async (userId: string, orgId: string): Promise<string[]> => {
    const sb = requireSupabase();
    const { data } = await sb.from('profiles').select('allowed_ministries').eq('id', userId).eq('organization_id', orgId).single();
    return data?.allowed_ministries || [];
};

export const fetchUserFunctions = async (userId: string, ministryId: string, orgId: string): Promise<string[]> => {
    const sb = requireSupabase();
    const { data } = await sb.from('organization_memberships')
        .select('functions')
        .eq('user_id', userId)
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId)
        .maybeSingle();
    return data?.functions || [];
};

// --- Schedule & Events ---

export const fetchScheduleAssignments = async (ministryId: string, month: string, orgId: string) => {
    const sb = requireSupabase();
    const validOrg = requireOrgId(orgId);
    
    const { data } = await sb.from('schedule_assignments')
        .select('*')
        .eq('ministry_id', ministryId)
        .eq('organization_id', validOrg)
        .like('event_date', `${month}%`);
        
    const schedule: any = {};
    const attendance: any = {};
    
    (data || []).forEach((row: any) => {
        // Reconstruct key: eventId_YYYY-MM-DD_Role
        // row.event_key is likely the Rule ID or Event ID
        const key = `${row.event_key}_${row.event_date}_${row.role}`;
        schedule[key] = row.member_name; // Fallback name
        if (row.confirmed) attendance[key] = true;
    });
    
    return { schedule, attendance };
};

export const saveScheduleAssignment = async (ministryId: string, orgId: string, key: string, value: string, explicitMemberId?: string | null) => {
    const sb = requireSupabase();
    const validOrg = requireOrgId(orgId);

    const { eventKey, eventDate, role } = parseCompositeKey(key);

    let resolvedMemberId = explicitMemberId;

    if (!resolvedMemberId && value) {
        const { data: profile } = await sb.from('profiles')
            .select('id')
            .eq('name', value)
            .eq('organization_id', validOrg)
            .maybeSingle();
        resolvedMemberId = profile?.id;
    }
    
    const { error } = await sb.from('schedule_assignments').upsert({ 
        ministry_id: ministryId, 
        organization_id: validOrg,
        event_key: eventKey,
        event_date: eventDate,
        role: role, 
        member_name: value,
        member_id: resolvedMemberId, 
        confirmed: false 
    }, { 
        onConflict: 'event_key, event_date, role'
    }); 
    
    if (error) {
        console.error("Erro ao salvar escala:", error);
        throw error;
    }
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
    const { eventKey, eventDate, role } = parseCompositeKey(key);
    
    // First get current status
    const { data } = await sb.from('schedule_assignments')
        .select('confirmed')
        .eq('event_key', eventKey)
        .eq('event_date', eventDate)
        .eq('role', role)
        .eq('ministry_id', ministryId)
        .single();
        
    if (data) {
        await sb.from('schedule_assignments')
            .update({ confirmed: !data.confirmed })
            .eq('event_key', eventKey)
            .eq('event_date', eventDate)
            .eq('role', role)
            .eq('ministry_id', ministryId);
    }
};

// --- Members & Availability ---

export const fetchMinistryMembers = async (ministryId: string, orgId: string) => {
    const sb = requireSupabase();
    // Fetch users who have this ministry in allowed_ministries OR membership
    const { data } = await sb.from('profiles')
        .select('*')
        .eq('organization_id', orgId)
        .contains('allowed_ministries', [ministryId]);
        
    const memberMap: any = {};
    const publicList: any[] = [];
    
    // Fetch roles for these users
    // Need to do this efficienty, maybe just map from profile for now if functions stored there
    // But usually functions are in organization_memberships
    const { data: memberships } = await sb.from('organization_memberships')
        .select('user_id, functions')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId);
        
    const rolesMap = new Map();
    memberships?.forEach((m: any) => rolesMap.set(m.user_id, m.functions));

    (data || []).forEach((p: any) => {
        const roles = rolesMap.get(p.id) || [];
        publicList.push({
            id: p.id,
            name: p.name,
            avatar_url: p.avatar_url,
            roles: roles,
            isAdmin: p.is_admin,
            email: p.email,
            whatsapp: p.whatsapp,
            birthDate: p.birth_date
        });
        
        roles.forEach((r: string) => {
            if (!memberMap[r]) memberMap[r] = [];
            memberMap[r].push(p.name);
        });
    });
    
    return { memberMap, publicList };
};

export const fetchMinistryAvailability = async (ministryId: string, orgId: string) => {
    const sb = requireSupabase();
    const { data } = await sb.from('availability')
        .select('*')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId);
        
    const availability: any = {};
    const notes: any = {};
    
    (data || []).forEach((row: any) => {
        availability[row.member_name] = row.dates || [];
        if (row.notes) {
            // Notes usually stored as JSON or simple text per month?
            // Assuming notes field is a JSON object { "YYYY-MM": "note" }
            // Or flat structure. For now adapting to App needs:
            Object.entries(row.notes).forEach(([k, v]) => {
                notes[`${row.member_name}_${k}`] = v;
            });
        }
    });
    
    return { availability, notes };
};

// --- Notifications ---

export const fetchNotificationsSQL = async (ministries: string[], userId: string, orgId: string, isAdmin: boolean) => {
    const sb = requireSupabase();
    // Logic: Public notifications for ministry OR Targeted notifications for user
    let query = sb.from('notifications').select('*').eq('organization_id', orgId);
    
    if (ministries.length > 0) {
        query = query.in('ministry_id', ministries);
    }
    
    // Filter read status if needed, but usually we fetch all recent and filter in UI or join with read_receipts
    // Simple implementation: fetch last 50
    const { data } = await query.order('created_at', { ascending: false }).limit(50);
    
    // Check read status
    const { data: reads } = await sb.from('notification_reads')
        .select('notification_id')
        .eq('user_id', userId);
        
    const readIds = new Set(reads?.map((r: any) => r.notification_id));
    
    return (data || []).map((n: any) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        timestamp: n.created_at,
        read: readIds.has(n.id),
        actionLink: n.action_link,
        ministryId: n.ministry_id,
        organizationId: n.organization_id
    }));
};

export const markNotificationsReadSQL = async (ids: string[], userId: string, orgId: string) => {
    const sb = requireSupabase();
    const inserts = ids.map(id => ({ notification_id: id, user_id: userId, organization_id: orgId }));
    await sb.from('notification_reads').upsert(inserts, { onConflict: 'notification_id, user_id' });
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
        type: payload.type || 'info',
        action_link: payload.actionLink
    });
};

// --- Announcements ---

export const fetchAnnouncementsSQL = async (ministryId: string, orgId: string) => {
    const sb = requireSupabase();
    const today = new Date().toISOString();
    
    const { data } = await sb.from('announcements')
        .select('*')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .gte('expiration_date', today);
        
    // Need to fetch reads and likes
    // Simplifying for now: assuming fields exist or separate tables
    // If separate tables:
    const ids = data?.map((a:any) => a.id) || [];
    
    const { data: reads } = await sb.from('announcement_reads').select('*').in('announcement_id', ids);
    const { data: likes } = await sb.from('announcement_likes').select('*').in('announcement_id', ids);
    
    return (data || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        message: a.message,
        type: a.type,
        timestamp: a.created_at,
        author: a.author_name || 'Liderança',
        readBy: reads?.filter((r:any) => r.announcement_id === a.id).map((r:any) => ({ userId: r.user_id, name: r.user_name, timestamp: r.read_at })) || [],
        likedBy: likes?.filter((l:any) => l.announcement_id === a.id).map((l:any) => ({ userId: l.user_id, name: l.user_name, timestamp: l.liked_at })) || []
    }));
};

// --- Swap Requests ---

export const fetchSwapRequests = async (ministryId: string, orgId: string) => {
    const sb = requireSupabase();
    const { data } = await sb.from('swap_requests')
        .select('*')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .eq('status', 'pending');
        
    return (data || []).map((r: any) => ({
        id: r.id,
        ministryId: r.ministry_id,
        requesterName: r.requester_name,
        role: r.role,
        eventIso: r.event_iso,
        eventTitle: r.event_title,
        status: r.status,
        createdAt: r.created_at
    }));
};

// --- Repertoire ---

export const fetchRepertoire = async (ministryId: string, orgId: string) => {
    const sb = requireSupabase();
    const { data } = await sb.from('repertoire')
        .select('*')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId);
        
    return (data || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        link: r.link,
        date: r.date_scheduled,
        addedBy: r.added_by,
        content: r.content,
        key: r.music_key
    }));
};

export const addToRepertoire = async (ministryId: string, orgId: string, item: any) => {
    const sb = requireSupabase();
    const { error } = await sb.from('repertoire').insert({
        ministry_id: ministryId,
        organization_id: orgId,
        title: item.title,
        link: item.link,
        date_scheduled: item.date,
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
        music_key: updates.key
    }).eq('id', id).eq('organization_id', orgId);
};

// --- Global Conflicts ---

export const fetchGlobalSchedules = async (month: string, currentMinistryId: string, orgId: string) => {
    const sb = requireSupabase();
    const { data } = await sb.from('schedule_assignments')
        .select('ministry_id, event_date, member_name, event_key, role')
        .eq('organization_id', orgId)
        .neq('ministry_id', currentMinistryId)
        .like('event_date', `${month}%`);
        
    // Transform to Conflict Map
    const map: any = {};
    (data || []).forEach((row: any) => {
        const name = row.member_name.toLowerCase().trim();
        if (!map[name]) map[name] = [];
        
        // Try to construct proper ISO time if event_key allows or event_date is full ISO
        // Assuming event_date in DB might be just YYYY-MM-DD or full ISO
        // If just date, we might not know time collision.
        // For now, map simple date conflicts.
        // If event_key has time (e.g. ID_YYYY-MM-DDTHH:mm), try to extract
        let iso = row.event_date;
        if (row.event_key && row.event_key.includes('T')) {
             const parts = row.event_key.split('_');
             if (parts.length > 1) iso = parts[1]; // Heuristic
        }
        
        map[name].push({
            ministryId: row.ministry_id,
            eventIso: iso,
            role: row.role
        });
    });
    return map;
};

// --- Audit & Ranking ---

export const fetchAuditLogs = async (ministryId: string, orgId: string) => {
    const sb = requireSupabase();
    const { data } = await sb.from('audit_logs')
        .select('*')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .order('created_at', { ascending: false })
        .limit(100);
        
    return (data || []).map((l: any) => ({
        id: l.id,
        date: l.created_at,
        action: l.action,
        details: l.details,
        author: l.author_name
    }));
};

export const fetchRankingData = async (ministryId: string, orgId: string) => {
    const sb = requireSupabase();
    const { data } = await sb.from('gamification_ranking')
        .select('*')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId);
        
    // Need profiles to get names/avatars
    const userIds = data?.map((d: any) => d.user_id) || [];
    if (userIds.length === 0) return [];
    
    const { data: profiles } = await sb.from('profiles').select('id, name, avatar_url').in('id', userIds);
    const profileMap = new Map(profiles?.map((p:any) => [p.id, p]));
    
    return (data || []).map((row: any) => {
        const p = profileMap.get(row.user_id);
        return {
            memberId: row.user_id,
            name: p?.name || 'Unknown',
            avatar_url: p?.avatar_url,
            points: row.points,
            stats: row.stats || { confirmedEvents: 0, missedEvents: 0, swapsRequested: 0, announcementsRead: 0, announcementsLiked: 0 },
            history: row.history || []
        };
    });
};

// --- Event Rules ---

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

// --- Organization Management ---

export const fetchOrganizationsWithStats = async () => {
    const sb = requireSupabase();
    const { data } = await sb.from('organizations').select('*');
    
    // For stats, we would ideally use a view or RPC
    // Mocking stats for now based on simple query
    return (data || []).map((o: any) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        active: o.active,
        createdAt: o.created_at,
        userCount: 0, // Requires join/count
        ministryCount: 0 // Requires join/count
    }));
};

export const saveOrganization = async (id: string | null, name: string, slug: string) => {
    const sb = requireSupabase();
    if (id) {
        const { error } = await sb.from('organizations').update({ name, slug }).eq('id', id);
        return { success: !error, message: error ? error.message : "Atualizado com sucesso" };
    } else {
        const { error } = await sb.from('organizations').insert({ name, slug });
        return { success: !error, message: error ? error.message : "Criado com sucesso" };
    }
};

export const toggleOrganizationStatus = async (id: string, active: boolean) => {
    const sb = requireSupabase();
    const { error } = await sb.from('organizations').update({ active }).eq('id', id);
    return !error;
};

export const saveOrganizationMinistry = async (orgId: string, code: string, label: string) => {
    const sb = requireSupabase();
    const { error } = await sb.from('organization_ministries').insert({
        organization_id: orgId,
        code,
        label
    });
    return { success: !error, message: error ? error.message : "Ministério adicionado" };
};

export const deleteOrganizationMinistry = async (orgId: string, code: string) => {
    const sb = requireSupabase();
    const { error } = await sb.from('organization_ministries').delete().eq('organization_id', orgId).eq('code', code);
    return { success: !error, message: error ? error.message : "Ministério removido" };
};
