import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  MinistrySettings, 
  RepertoireItem, 
  SwapRequest, 
  AppNotification, 
  Announcement, 
  MinistryDef,
  TeamMemberProfile
} from '../types';

// --- INITIALIZATION ---

let envUrl = "";
let envKey = "";

try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        envUrl = import.meta.env.VITE_SUPABASE_URL || "";
        envKey = import.meta.env.VITE_SUPABASE_KEY || "";
    }
} catch (e) {
    console.warn("Vite environment variables not accessible.");
}

const manualUrl = typeof window !== 'undefined' ? localStorage.getItem('sb_manual_url') : null;
const manualKey = typeof window !== 'undefined' ? localStorage.getItem('sb_manual_key') : null;

export const SUPABASE_URL = manualUrl || envUrl || "";
export const SUPABASE_KEY = manualKey || envKey || "";

let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_KEY) {
    try {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
    } catch(e) {
        console.error("Supabase Client Init Error", e);
    }
}

export const getSupabase = () => supabase;

// --- CONTEXT MANAGEMENT (SINGLETON) ---

let _globalOrgId: string | null = null;

export const setServiceOrgContext = (orgId: string) => {
    _globalOrgId = orgId;
};

export const getServiceOrgContext = (): string => {
    if (!_globalOrgId) {
        throw new Error("SUPABASE_SERVICE_CONTEXT_MISSING: Organization ID not set in global context.");
    }
    return _globalOrgId;
};

export const clearServiceOrgContext = () => {
    _globalOrgId = null;
};

// --- HELPERS (STRICT GUARDS) ---

const requireSupabase = (): SupabaseClient => {
    if (!supabase) {
        throw new Error('SUPABASE_NOT_INITIALIZED');
    }
    return supabase;
};

const requireOrgId = (orgId: string | null | undefined): string => {
    if (!orgId) {
        console.error("[SupabaseService] Critical: ORG_ID_REQUIRED was not provided.");
        throw new Error('ORG_ID_REQUIRED');
    }
    return orgId;
};

const filterRolesBySettings = async (roles: string[], ministryId: string, orgId: string): Promise<string[]> => {
    const sb = requireSupabase();
    if (!roles || roles.length === 0) return [];

    const { data: settings } = await sb.from('ministry_settings')
        .select('roles')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId)
        .maybeSingle();

    const allowedRoles = (settings?.roles || []) as string[];
    return roles.filter(r => allowedRoles.includes(r));
};

// --- CORE SAAS FUNCTIONS ---

export const fetchOrganizationMinistries = async (orgId?: string): Promise<MinistryDef[]> => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId || getServiceOrgContext());

    const { data, error } = await sb
        .from('organization_ministries')
        .select('id, code, label') 
        .eq('organization_id', validOrgId);

    if (error) throw error;

    return (data || []).map((m: any) => ({
        id: m.id,
        code: m.code || m.id,
        label: m.label || 'Sem nome', 
        organizationId: validOrgId
    }));
};

export const fetchUserAllowedMinistries = async (userId: string, orgId?: string): Promise<string[]> => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId || getServiceOrgContext());
    
    const { data: members, error } = await sb.from('organization_memberships')
        .select('ministry_id')
        .eq('profile_id', userId)
        .eq('organization_id', validOrgId);
        
    if (error) throw error;
    if (!members || members.length === 0) return [];

    const ministryIds = members.map((m: any) => m.ministry_id);

    const { data: validMinistries, error: verifyError } = await sb.from('organization_ministries')
        .select('id')
        .eq('organization_id', validOrgId)
        .in('id', ministryIds);

    if (verifyError) throw verifyError;

    return validMinistries?.map((m: any) => m.id) || [];
};

export const fetchMinistrySettings = async (ministryId: string, orgId?: string): Promise<MinistrySettings | null> => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId || getServiceOrgContext());
    if (!ministryId) return null;

    const { data: ministryDef, error: defError } = await sb.from('organization_ministries')
        .select('label')
        .eq('id', ministryId)
        .eq('organization_id', validOrgId)
        .maybeSingle();

    if (defError) throw defError;

    const { data: settings, error: setError } = await sb.from('ministry_settings')
        .select('*')
        .eq('ministry_id', ministryId)
        .eq('organization_id', validOrgId)
        .maybeSingle();
    
    if (setError && setError.code !== 'PGRST116') throw setError; 

    return {
        id: settings?.id,
        organizationMinistryId: ministryId, 
        displayName: ministryDef?.label || settings?.display_name || 'Ministério',
        roles: settings?.roles || [],
        availabilityStart: settings?.availability_start,
        availabilityEnd: settings?.availability_end,
        organizationId: validOrgId,
        spotifyClientId: settings?.spotify_client_id,
        spotifyClientSecret: settings?.spotify_client_secret
    };
};

// --- DATA FETCHING (Scoped by Org) ---

export const fetchMinistrySchedule = async (ministryId: string, month: string, orgId?: string) => {
    // Retorna vazio pois events não existe mais. 
    // O useMinistryData agora usa useEvents (Memory Projection).
    return { events: [], schedule: {}, attendance: {} };
};

export const fetchScheduleAssignments = async (ministryId: string, month: string, orgId?: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId || getServiceOrgContext());

    const { data: assignments, error } = await sb.from('schedule_assignments')
        .select('*, profiles(name)')
        .eq('ministry_id', ministryId)
        .eq('organization_id', validOrgId);

    if (error) throw error;

    const schedule: any = {};
    const attendance: any = {};

    assignments?.forEach((a: any) => {
        // Key format: RuleUUID_Role
        const key = `${a.event_id}_${a.role}`;
        
        // FIX: Handle both array and object responses for joined profile
        const profile = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
        const name = profile?.name;

        if (name) {
            schedule[key] = name;
        }
        
        if (a.confirmed) attendance[key] = true;
    });

    return { schedule, attendance };
};

// --- EVENT RULES (CRUD) ---

export const createEventRule = async (
    orgId: string, 
    ruleData: { 
        title: string;
        time: string;
        ministryId: string;
        type: 'weekly' | 'single';
        weekday?: number;
        date?: string;
    }
) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);
    
    const time = ruleData.time.length === 5 ? `${ruleData.time}` : ruleData.time;

    const payload = {
        organization_id: validOrgId,
        ministry_id: ruleData.ministryId, // CAMPO RESTAURADO PARA RLS
        title: ruleData.title,
        weekday: ruleData.weekday,
        date: ruleData.date,
        time: time,
        type: ruleData.type,
        active: true
    };

    console.log("Creating Event Rule Payload:", payload);

    const { data, error } = await sb.from('event_rules')
        .insert([payload])
        .select()
        .single();

    if (error) {
        console.error("Error creating event rule:", error);
        throw error;
    }

    return data;
};

export const deleteEventRule = async (orgId: string, id: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);
    await sb.from('event_rules').delete().eq('id', id).eq('organization_id', validOrgId);
};

export const createMinistryEvent = async (ministryId: string, orgId: string, event: any) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);
    
    // Legacy support wrapper
    await sb.from('event_rules').insert({
        organization_id: validOrgId,
        ministry_id: ministryId, // CAMPO RESTAURADO PARA RLS
        title: event.title,
        type: 'single',
        date: event.date,
        time: event.time,
        active: true
    });
};

export const deleteMinistryEvent = async (ministryId: string, orgId: string, identifier: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);

    // Identifier can be:
    // 1. UUID (Rule ID)
    // 2. RuleID_Date (Generated Event ID)
    // 3. Date ISO (Old fallback)

    let ruleId = identifier;

    // Check for RuleID_Date pattern (UUID_YYYY-MM-DD)
    if (identifier.length > 36 && identifier[36] === '_') {
        ruleId = identifier.substring(0, 36);
    }

    if (identifier.includes('T') && identifier.length < 36) {
        const [date, timePart] = identifier.split('T');
        const time = timePart.substring(0, 5);
        
        await sb.from('event_rules').delete()
            .eq('organization_id', validOrgId)
            .eq('ministry_id', ministryId)
            .eq('type', 'single')
            .eq('date', date)
            .eq('time', time);
    } else {
        await sb.from('event_rules').delete()
            .eq('id', ruleId)
            .eq('organization_id', validOrgId);
    }
};

export const updateMinistryEvent = async (ministryId: string, orgId: string, oldIso: string, newTitle: string, newIso: string, applyToAll: boolean) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);
    
    const [oldDate, oldTimePart] = oldIso.split('T');
    const oldTime = oldTimePart.substring(0, 5);
    
    const [newDate, newTimePart] = newIso.split('T');
    const newTime = newTimePart.substring(0, 5);

    // Try to update a single rule first
    await sb.from('event_rules').update({
        title: newTitle,
        date: newDate,
        time: newTime
    })
    .eq('organization_id', validOrgId)
    .eq('ministry_id', ministryId)
    .eq('type', 'single')
    .eq('date', oldDate)
    .eq('time', oldTime);
};

export const fetchMinistryMembers = async (
  ministryId: string,
  orgId?: string
): Promise<{
  memberMap: Record<string, string[]>;
  publicList: TeamMemberProfile[];
}> => {
  const sb = requireSupabase();
  const validOrgId = requireOrgId(orgId || getServiceOrgContext());

  const { data: memberships, error } = await sb
    .from('organization_memberships')
    .select(`
      profile_id,
      functions,
      role,
      profiles (
        id,
        name,
        email,
        avatar_url,
        whatsapp,
        birth_date,
        is_admin
      )
    `)
    .eq('ministry_id', ministryId)
    .eq('organization_id', validOrgId);

  if (error) throw error;
  if (!memberships) return { memberMap: {}, publicList: [] };

  const memberMap: Record<string, string[]> = {};
  const publicList: TeamMemberProfile[] = [];

  memberships.forEach((m: any) => {
    // FIX: Handle potential array return from join (though unlikely here, consistency matters)
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    if (!p) return;

    const rawFunctions = Array.isArray(m.functions) ? m.functions : [];
    
    publicList.push({
      id: p.id,
      name: p.name,
      email: p.email,
      avatar_url: p.avatar_url,
      whatsapp: p.whatsapp,
      birthDate: p.birth_date,
      isAdmin: p.is_admin || m.role === 'admin',
      roles: rawFunctions, 
      organizationId: validOrgId
    });

    rawFunctions.forEach((fn: string) => {
      if (!memberMap[fn]) memberMap[fn] = [];
      memberMap[fn].push(p.name);
    });
  });

  return { memberMap, publicList };
};

export const fetchRankingData = async (ministryId: string, orgId?: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId || getServiceOrgContext());
    
    const { data: memberships, error: memError } = await sb.from('organization_memberships')
        .select('profile_id')
        .eq('ministry_id', ministryId)
        .eq('organization_id', validOrgId);

    if (memError) throw memError;
    if (!memberships || memberships.length === 0) return [];
    
    const userIds = memberships.map((m: any) => m.profile_id);

    const { data: members, error: profError } = await sb.from('profiles')
        .select('id, name, avatar_url')
        .in('id', userIds)
        .eq('organization_id', validOrgId);
        
    if (profError) throw profError;

    return (members || []).map((m: any) => ({
        memberId: m.id,
        name: m.name,
        avatar_url: m.avatar_url,
        points: 0, 
        stats: { confirmedEvents: 0, missedEvents: 0, swapsRequested: 0, announcementsRead: 0, announcementsLiked: 0 },
        history: []
    }));
};

export const fetchUserFunctions = async (
  userId: string,
  ministryId: string,
  orgId?: string
): Promise<string[]> => {
  const sb = requireSupabase();
  const validOrgId = requireOrgId(orgId || getServiceOrgContext());

  const { data, error } = await sb
    .from('organization_memberships')
    .select('functions')
    .eq('profile_id', userId)
    .eq('ministry_id', ministryId)
    .eq('organization_id', validOrgId)
    .maybeSingle();

  if (error) {
      console.error("[fetchUserFunctions] Error:", error);
      return [];
  }

  return (data && Array.isArray(data.functions)) ? data.functions : [];
};

export const fetchOrganizationsWithStats = async () => {
    const sb = requireSupabase();
    const { data, error } = await sb.from('organizations')
        .select(`*, organization_ministries (id, code, label), profiles (count)`);

    if (error) throw error;

    return (data || []).map((o: any) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        active: o.active,
        createdAt: o.created_at,
        userCount: o.profiles?.[0]?.count || 0,
        ministryCount: o.organization_ministries?.length || 0,
        ministries: o.organization_ministries?.map((m:any) => ({ 
            id: m.id, code: m.code, label: m.label 
        })) || []
    }));
};

// --- ACTIONS (Writes & Updates) ---

export const saveOrganizationMinistry = async (orgId: string, code: string, label: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);

    const { error } = await sb.from('organization_ministries').upsert({
        organization_id: validOrgId,
        code: code,
        label: label 
    }, { onConflict: 'organization_id, code' });
    
    return error ? { success: false, message: error.message } : { success: true, message: "Salvo" };
};

export const configureSupabaseManual = (url: string, key: string) => {
    try {
        supabase = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
        localStorage.setItem('sb_manual_url', url);
        localStorage.setItem('sb_manual_key', key);
        window.location.reload();
    } catch (e) { console.error(e); }
};

export const validateConnection = async (url: string, key: string) => {
    try {
        const client = createClient(url, key);
        const { error } = await client.from('profiles').select('count', { count: 'exact', head: true });
        return !error || error.code === 'PGRST116'; 
    } catch { return false; }
};

export const disconnectManual = () => {
    localStorage.removeItem('sb_manual_url');
    localStorage.removeItem('sb_manual_key');
    supabase = null;
    window.location.reload();
};

export const loginWithEmail = async (email: string, pass: string) => {
    const sb = requireSupabase();
    const { data, error } = await (sb.auth as any).signInWithPassword({ email, password: pass });
    if (error) return { success: false, message: error.message };
    return { success: true, data };
};

export const loginWithGoogle = async () => {
    const sb = requireSupabase();
    const { data, error } = await (sb.auth as any).signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) return { success: false, message: error.message };
    return { success: true, data };
};

export const logout = async () => {
    if (!supabase) return;
    await (supabase.auth as any).signOut();
};

export const registerWithEmail = async (email: string, pass: string, name: string, ministries: string[], orgId: string, roles: string[]) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);

    const { data, error } = await (sb.auth as any).signUp({ 
        email, 
        password: pass,
        options: { data: { full_name: name, ministry_id: ministries[0], organization_id: validOrgId } }
    });
    if (error) return { success: false, message: error.message };
    
    if (data.user) {
        let sanitizedRoles = roles;
        if (ministries[0]) {
            sanitizedRoles = await filterRolesBySettings(roles, ministries[0], validOrgId);
        }

        await sb.from('profiles').update({
            name: name,
            ministry_id: ministries[0],
            allowed_ministries: ministries,
            organization_id: validOrgId,
            roles: sanitizedRoles 
        }).eq('id', data.user.id).eq('organization_id', validOrgId);
        
        if (ministries[0]) {
            await sb.from('organization_memberships').insert({
                profile_id: data.user.id,
                organization_id: validOrgId,
                ministry_id: ministries[0],
                role: 'member',
                functions: sanitizedRoles 
            });
        }
    }
    return { success: true, message: "Verifique seu e-mail para confirmar o cadastro." };
};

export const fetchMinistryAvailability = async (ministryId: string, orgId?: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId || getServiceOrgContext());

    const { data, error } = await sb.from('availability')
        .select('*, profiles(name)')
        .eq('ministry_id', ministryId)
        .eq('organization_id', validOrgId);
        
    if (error) throw error;

    const availability: any = {};
    const notes: any = {};
    
    data?.forEach((row: any) => {
        // FIX: Robust profile name extraction
        const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        const name = p?.name;
        
        if (name) {
            if (!availability[name]) availability[name] = [];
            if (Array.isArray(row.dates)) availability[name] = row.dates;
            if (row.notes) {
                Object.entries(row.notes).forEach(([k, v]) => { 
                    notes[`${name}_${k}`] = v; 
                });
            }
        }
    });
    return { availability, notes };
};

export const fetchNotificationsSQL = async (ministryIds: string[], userId: string, orgId?: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId || getServiceOrgContext());

    const { data, error } = await sb.from('notifications')
        .select('*')
        .in('ministry_id', ministryIds)
        .eq('organization_id', validOrgId)
        .order('created_at', { ascending: false })
        .limit(50);
        
    if (error) throw error;

    const { data: reads } = await sb.from('notification_reads')
        .select('notification_id')
        .eq('user_id', userId)
        .eq('organization_id', validOrgId);
        
    const readIds = new Set(reads?.map((r: any) => r.notification_id));
    return (data || []).map((n: any) => ({
        id: n.id, type: n.type, title: n.title, message: n.message, timestamp: n.created_at, read: readIds.has(n.id), actionLink: n.action_link, ministryId: n.ministry_id
    }));
};

export const fetchAnnouncementsSQL = async (ministryId: string, orgId?: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId || getServiceOrgContext());

    const { data, error } = await sb.from('announcements')
        .select(`*, announcement_reads (user_id, profiles(name), created_at), announcement_likes (user_id, profiles(name), created_at)`)
        .eq('ministry_id', ministryId)
        .eq('organization_id', validOrgId)
        .gte('expiration_date', new Date().toISOString())
        .order('created_at', { ascending: false });
        
    if (error) throw error;

    return (data || []).map((a: any) => ({
        id: a.id, title: a.title, message: a.message, type: a.type, timestamp: a.created_at, expirationDate: a.expiration_date, author: a.author_name || 'Admin',
        readBy: a.announcement_reads.map((r: any) => ({ userId: r.user_id, name: r.profiles?.name, timestamp: r.created_at })),
        likedBy: a.announcement_likes.map((l: any) => ({ userId: l.user_id, name: l.profiles?.name, timestamp: l.created_at }))
    }));
};

export const fetchSwapRequests = async (ministryId: string, orgId?: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId || getServiceOrgContext());

    const { data, error } = await sb.from('swap_requests')
        .select('*')
        .eq('ministry_id', ministryId)
        .eq('organization_id', validOrgId)
        .order('created_at', { ascending: false });
        
    if (error) throw error;

    return (data || []).map((s: any) => ({
        id: s.id, ministryId: s.ministry_id, requesterName: s.requester_name, requesterId: s.requester_id, role: s.role, eventIso: s.event_iso, eventTitle: s.event_title, status: s.status, createdAt: s.created_at, takenByName: s.taken_by_name
    }));
};

export const fetchRepertoire = async (ministryId: string, orgId?: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId || getServiceOrgContext());

    const { data, error } = await sb.from('repertoire')
        .select('*')
        .eq('ministry_id', ministryId)
        .eq('organization_id', validOrgId)
        .order('created_at', { ascending: false });
        
    if (error) throw error;

    return (data || []).map((r: any) => ({
        id: r.id, title: r.title, link: r.link, date: r.date_used, observation: r.observation, addedBy: r.added_by, createdAt: r.created_at, content: r.content, key: r.music_key
    }));
};

export const fetchGlobalSchedules = async (month: string, currentMinistryId: string, orgId?: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId || getServiceOrgContext());

    const { data, error } = await sb.from('schedule_assignments')
        .select('event_id, role, ministry_id, profiles(name)')
        .eq('organization_id', validOrgId)
        .neq('ministry_id', currentMinistryId);
        
    if (error) throw error;

    const map: any = {};
    data?.forEach((row: any) => {
        // FIX: Robust profile name extraction
        const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        const memberName = p?.name;
        if (!memberName) return;

        const name = memberName.toLowerCase().trim();
        if (!map[name]) map[name] = [];
        
        let eventIso = row.event_id; 
        
        map[name].push({ 
            ministryId: row.ministry_id, 
            eventIso: eventIso, // Using UUID as ISO key placeholder 
            role: row.role 
        });
    });
    return map;
};

export const fetchAuditLogs = async (ministryId: string, orgId?: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId || getServiceOrgContext());

    const { data, error } = await sb.from('audit_logs')
        .select('*')
        .eq('ministry_id', ministryId)
        .eq('organization_id', validOrgId)
        .order('created_at', { ascending: false })
        .limit(100);
        
    if (error) throw error;

    return (data || []).map((l: any) => ({ id: l.id, date: l.created_at, action: l.action, details: l.details, author: l.author_name }));
};

export const saveOrganization = async (id: string | null, name: string, slug: string) => {
    const sb = requireSupabase();
    if (id) {
        const { error } = await sb.from('organizations').update({ name, slug }).eq('id', id);
        return error ? { success: false, message: error.message } : { success: true, message: "Atualizado" };
    } else {
        const { error } = await sb.from('organizations').insert({ name, slug });
        return error ? { success: false, message: error.message } : { success: true, message: "Criado" };
    }
};

export const toggleOrganizationStatus = async (id: string, active: boolean) => {
    const sb = requireSupabase();
    const { error } = await sb.from('organizations').update({ active }).eq('id', id);
    return !error;
};

export const deleteOrganizationMinistry = async (orgId: string, code: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);
    const { error } = await sb.from('organization_ministries').delete().eq('organization_id', validOrgId).eq('code', code);
    return error ? { success: false, message: error.message } : { success: true, message: "Removido" };
};

export const removeScheduleAssignment = async (ministryId: string, orgId: string, key: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);

    const lastUnderscore = key.lastIndexOf('_');
    const eventIdReal = key.substring(0, lastUnderscore); 
    const roleReal = key.substring(lastUnderscore + 1);

    const { error } = await sb.from('schedule_assignments').delete()
        .eq('event_id', eventIdReal) 
        .eq('role', roleReal)
        .eq('ministry_id', ministryId)
        .eq('organization_id', validOrgId);

    if (error) throw error;
    return true;
};

export const saveScheduleAssignment = async (ministryId: string, orgId: string, eventKey: string, role: string, memberId: string | null, memberName?: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);

    let resolvedMemberId = memberId;
    if (!resolvedMemberId && memberName) {
        const { data: profile } = await sb.from('profiles')
            .select('id')
            .eq('name', memberName)
            .eq('organization_id', validOrgId)
            .maybeSingle();
        resolvedMemberId = profile?.id;
    }
    
    // DEBUG CRÍTICO: Se o eventKey não tiver data (for apenas UUID), isso alertará no console
    if (eventKey.length === 36 && !eventKey.includes('_')) {
        console.warn("[CRITICAL] Salvando escala sem componente de data na chave!", eventKey);
    }

    const { error } = await sb.from('schedule_assignments').upsert({ 
        event_key: eventKey, 
        role: role, 
        member_name: memberName, 
        member_id: resolvedMemberId, 
        ministry_id: ministryId, 
        organization_id: validOrgId, 
        confirmed: false 
    }, { 
        onConflict: 'event_key, role' 
    }); 
    
    if (error) {
        console.error("Erro ao salvar escala:", error);
        return false;
    }
    
    return true;
};

export const toggleAssignmentConfirmation = async (ministryId: string, orgId: string, key: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);

    const lastUnderscore = key.lastIndexOf('_');
    const eventIdReal = key.substring(0, lastUnderscore);
    const roleReal = key.substring(lastUnderscore + 1);

    const { data: assignment } = await sb.from('schedule_assignments')
        .select('confirmed')
        .eq('event_id', eventIdReal) 
        .eq('role', roleReal)
        .eq('organization_id', validOrgId)
        .single();
        
    if (assignment) { 
        await sb.from('schedule_assignments')
            .update({ confirmed: !assignment.confirmed })
            .eq('event_id', eventIdReal)
            .eq('role', roleReal)
            .eq('organization_id', validOrgId); 
    }
};

export const saveMemberAvailability = async (ministryId: string, orgId: string, member: string, dates: string[], notes?: any, targetMonth?: string) => {
    const sb = requireSupabase();
    
    // Strict Validation
    if (!ministryId) throw new Error("Ministry ID is required for availability.");
    if (!orgId) throw new Error("Organization ID is required for availability.");

    // 1. Resolve ID strictly
    const { data: profile } = await sb.from('profiles')
        .select('id')
        .eq('name', member)
        .eq('organization_id', orgId)
        .maybeSingle();

    if (!profile?.id) {
        throw new Error(`MEMBER_ID_NOT_FOUND: Não foi possível identificar o membro "${member}".`);
    }

    // 2. Upsert
    const { error } = await sb.from('availability').upsert({ 
        ministry_id: ministryId, 
        organization_id: orgId, 
        member_id: profile.id, 
        dates: dates, 
        notes: notes 
    }, { 
        onConflict: 'organization_id,ministry_id,member_id',
        ignoreDuplicates: false
    });

    if (error) {
        console.error('[saveMemberAvailability] Upsert failed:', error);
        throw error; // Explicit throw
    }
};

export const createSwapRequestSQL = async (ministryId: string, orgId: string, request: any) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);
    await sb.from('swap_requests').insert({ ministry_id: ministryId, organization_id: validOrgId, requester_name: request.requesterName, requester_id: request.requesterId, role: request.role, event_iso: request.eventIso, event_title: request.eventTitle, status: 'pending' });
};

export const performSwapSQL = async (ministryId: string, orgId: string, requestId: string, takenByName: string, takenById: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);

    const { data: req } = await sb.from('swap_requests').select('*').eq('id', requestId).eq('organization_id', validOrgId).single();
    if (!req) return;
    
    await sb.from('swap_requests').update({ status: 'completed', taken_by_name: takenByName, taken_by_id: takenById }).eq('id', requestId).eq('organization_id', validOrgId);
};

export const cancelSwapRequestSQL = async (requestId: string, orgId: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);
    await sb.from('swap_requests').delete().eq('id', requestId).eq('organization_id', validOrgId);
};

export const interactAnnouncementSQL = async (id: string, userId: string, userName: string, action: 'read'|'like', orgId: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);

    const table = action === 'read' ? 'announcement_reads' : 'announcement_likes';
    if (action === 'like') {
        const { data } = await sb.from(table).select('id').eq('announcement_id', id).eq('user_id', userId).eq('organization_id', validOrgId).maybeSingle();
        if (data) { await sb.from(table).delete().eq('id', data.id).eq('organization_id', validOrgId); } 
        else { await sb.from(table).insert({ announcement_id: id, user_id: userId, organization_id: validOrgId }); }
    } else {
        await sb.from(table).upsert({ announcement_id: id, user_id: userId, organization_id: validOrgId }, { onConflict: 'announcement_id, user_id' });
    }
};

export const updateUserProfile = async (name: string, whatsapp: string, avatar: string | undefined, functions: string[] | undefined, birthDate: string | undefined, ministryId?: string, orgId?: string) => {
    const sb = requireSupabase();
    const { data: { user } } = await (sb.auth as any).getUser();
    if (!user) return;
    const updates: any = { name, whatsapp, birth_date: birthDate };
    if (avatar) updates.avatar_url = avatar;
    
    let query = sb.from('profiles').update(updates).eq('id', user.id);
    if (orgId) query = query.eq('organization_id', orgId);
    await query;
    
    if (ministryId && functions && orgId) {
        const sanitizedRoles = await filterRolesBySettings(functions, ministryId, orgId);
        await sb.from('organization_memberships')
            .update({ functions: sanitizedRoles })
            .eq('profile_id', user.id)
            .eq('ministry_id', ministryId)
            .eq('organization_id', orgId);
    }
};

export const saveMinistrySettings = async (ministryId: string, orgId: string, displayName?: string, roles?: string[], start?: string, end?: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);

    const updates: any = {};
    if (displayName) updates.display_name = displayName;
    if (roles) updates.roles = roles;
    if (start) updates.availability_start = start;
    if (end) updates.availability_end = end;
    await sb.from('ministry_settings').update(updates).eq('ministry_id', ministryId).eq('organization_id', validOrgId);
};

export const toggleAdminSQL = async (email: string, status: boolean, ministryId: string, orgId: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);
    await sb.from('profiles').update({ is_admin: status }).eq('email', email).eq('organization_id', validOrgId);
};

export const deleteMember = async (ministryId: string, orgId: string, memberId: string, name: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);
    await sb.from('organization_memberships').delete().eq('profile_id', memberId).eq('ministry_id', ministryId).eq('organization_id', validOrgId);
};

export const updateMemberData = async (id: string, orgId: string, data: any) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);
    await sb.from('profiles').update({ name: data.name, whatsapp: data.whatsapp }).eq('id', id).eq('organization_id', validOrgId);
    if (data.ministryId) {
        const sanitizedRoles = await filterRolesBySettings(data.roles, data.ministryId, validOrgId);
        await sb.from('organization_memberships').update({ functions: sanitizedRoles }).eq('profile_id', id).eq('ministry_id', data.ministryId).eq('organization_id', validOrgId);
    }
};

export const sendNotificationSQL = async (ministryId: string, orgId: string, notification: any) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);
    await sb.from('notifications').insert({ ministry_id: ministryId, organization_id: validOrgId, title: notification.title, message: notification.message, type: notification.type, action_link: notification.actionLink });
};

export const createAnnouncementSQL = async (ministryId: string, orgId: string, announcement: any, authorName: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);
    await sb.from('announcements').insert({ ministry_id: ministryId, organization_id: validOrgId, title: announcement.title, message: announcement.message, type: announcement.type, expiration_date: announcement.expirationDate, author_name: authorName });
};

export const joinMinistry = async (ministryId: string, orgId: string, roles: string[]) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);
    const { data: { user } } = await (sb.auth as any).getUser();
    if (!user) return;
    
    const sanitizedRoles = await filterRolesBySettings(roles, ministryId, validOrgId);

    await sb.from('organization_memberships').insert({ 
        profile_id: user.id, 
        organization_id: validOrgId, 
        ministry_id: ministryId, 
        role: 'member', 
        functions: sanitizedRoles 
    });
    
    const { data: profile } = await sb.from('profiles').select('allowed_ministries').eq('id', user.id).eq('organization_id', validOrgId).single();
    const current = profile?.allowed_ministries || [];
    if (!current.includes(ministryId)) {
        await sb.from('profiles').update({ allowed_ministries: [...current, ministryId] }).eq('id', user.id).eq('organization_id', validOrgId);
    }
};

export const markNotificationsReadSQL = async (ids: string[], userId: string, orgId: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);
    const inserts = ids.map(id => ({ notification_id: id, user_id: userId, organization_id: validOrgId }));
    await sb.from('notification_reads').upsert(inserts, { onConflict: 'notification_id, user_id' });
};

export const clearAllNotificationsSQL = async (ministryId: string, orgId: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);
    await sb.from('notifications').delete().eq('ministry_id', ministryId).eq('organization_id', validOrgId);
};

export const addToRepertoire = async (ministryId: string, orgId: string, item: any) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);
    const { error } = await sb.from('repertoire').insert({ ministry_id: ministryId, organization_id: validOrgId, title: item.title, link: item.link, date_used: item.date, added_by: item.addedBy, content: item.content });
    return !error;
};

export const deleteFromRepertoire = async (id: string, orgId: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);
    await sb.from('repertoire').delete().eq('id', id).eq('organization_id', validOrgId);
};

export const updateRepertoireItem = async (id: string, orgId: string, updates: any) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);
    await sb.from('repertoire').update({ content: updates.content, music_key: updates.key }).eq('id', id).eq('organization_id', validOrgId);
};

export const updateProfileMinistry = async (userId: string, ministryId: string) => {
    const sb = requireSupabase();
    await sb.from('profiles').update({ ministry_id: ministryId }).eq('id', userId);
};

export const clearScheduleForMonth = async (ministryId: string, orgId: string, month: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);
    
    // Pattern matches ISO-like dates (YYYY-MM) in event_key
    const pattern = `%${month}%`;

    await sb.from('schedule_assignments')
        .delete()
        .eq('ministry_id', ministryId)
        .eq('organization_id', validOrgId)
        .like('event_id', pattern); 
};