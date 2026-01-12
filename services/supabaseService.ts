
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { MinistrySettings, RepertoireItem, SwapRequest, AppNotification, Announcement, CustomEvent, User } from '../types';

// Tenta pegar do .env (Vite) - Safe Access
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

// Tenta pegar do localStorage (Setup Manual)
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

// FIX: Helper para resolver ID estritamente com validação de organização
const resolveMinistryIdStrict = async (input: string, orgId: string): Promise<string | null> => {
    if (!supabase) return null;
    if (!orgId) throw new Error('ORG_ID_REQUIRED for resolveMinistryIdStrict');

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (UUID_REGEX.test(input)) {
        const { data } = await supabase
            .from('organization_ministries')
            .select('id')
            .eq('id', input)
            .eq('organization_id', orgId)
            .single();

        return data?.id || null;
    }
    return null;
};

export const configureSupabaseManual = (url: string, key: string) => {
    try {
        supabase = createClient(url, key, {
            auth: { persistSession: true, autoRefreshToken: true }
        });
        localStorage.setItem('sb_manual_url', url);
        localStorage.setItem('sb_manual_key', key);
        window.location.reload();
    } catch (e) {
        console.error(e);
    }
};

export const validateConnection = async (url: string, key: string) => {
    try {
        const client = createClient(url, key);
        const { error } = await client.from('profiles').select('count', { count: 'exact', head: true });
        return !error || error.code === 'PGRST116'; 
    } catch {
        return false;
    }
};

export const disconnectManual = () => {
    localStorage.removeItem('sb_manual_url');
    localStorage.removeItem('sb_manual_key');
    supabase = null;
    window.location.reload();
};

export const loginWithEmail = async (email: string, pass: string) => {
    if (!supabase) return { success: false, message: "Banco de dados não conectado." };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) return { success: false, message: error.message };
    return { success: true, data };
};

export const loginWithGoogle = async () => {
    if (!supabase) return { success: false, message: "Banco de dados não conectado." };
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) return { success: false, message: error.message };
    return { success: true, data };
};

export const registerWithEmail = async (email: string, pass: string, name: string, ministries: string[], orgId: string, roles: string[]) => {
    if (!supabase) return { success: false, message: "Banco de dados não conectado." };
    // FIX: Validar orgId no registro
    if (!orgId) throw new Error('ORG_ID_REQUIRED for registration');

    const { data, error } = await supabase.auth.signUp({ 
        email, 
        password: pass,
        options: {
            data: { full_name: name, ministry_id: ministries[0], organization_id: orgId } // Metadados iniciais
        }
    });
    if (error) return { success: false, message: error.message };
    
    // Se o usuário foi criado, atualizar profile
    if (data.user) {
        // FIX: Garantir organization_id ao atualizar perfil
        await supabase.from('profiles').update({
            name: name,
            ministry_id: ministries[0],
            allowed_ministries: ministries,
            organization_id: orgId,
            roles: roles 
        }).eq('id', data.user.id).eq('organization_id', orgId);
        
        // Add to membership
        if (ministries[0]) {
            await supabase.from('organization_memberships').insert({
                user_id: data.user.id,
                organization_id: orgId,
                ministry_id: ministries[0],
                roles: roles
            });
        }
    }

    return { success: true, message: "Verifique seu e-mail para confirmar o cadastro." };
};

export const logout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
};

export const fetchOrganizationMinistries = async (orgId: string) => {
    if (!supabase) return [];
    // FIX: ERRO 1 - organization_id OBRIGATÓRIO
    if (!orgId) {
        console.error('[QUERY] fetchOrganizationMinistries: orgId MISSING');
        throw new Error('ORG_ID_REQUIRED');
    }
    // FIX: LOG OBRIGATÓRIO
    console.log('[QUERY] fetchOrganizationMinistries orgId:', orgId);

    // FIX: ERRO 4 - Fonte EXCLUSIVA organization_ministries
    const { data } = await supabase.from('organization_ministries')
        .select('id, code, name')
        .eq('organization_id', orgId);

    return (data || []).map((m: any) => ({
        id: m.id,
        code: m.code || m.id,
        label: m.name || 'Sem nome', 
        organizationId: orgId
    }));
};

export const fetchUserAllowedMinistries = async (userId: string, orgId: string) => {
    if (!supabase) return [];
    // FIX: ERRO 3 - Validar orgId
    if (!orgId) throw new Error('ORG_ID_REQUIRED');
    
    // FIX: Buscar memberships filtrando por organization_id
    const { data: members } = await supabase.from('organization_memberships')
        .select('ministry_id')
        .eq('user_id', userId)
        .eq('organization_id', orgId);
        
    if (!members || members.length === 0) return [];

    const ministryIds = members.map((m: any) => m.ministry_id);

    // FIX: Validar existência em organization_ministries (Join Lógico obrigatório)
    const { data: validMinistries } = await supabase.from('organization_ministries')
        .select('id')
        .eq('organization_id', orgId)
        .in('id', ministryIds);

    return validMinistries?.map((m: any) => m.id) || [];
};

export const fetchUserFunctions = async (userId: string, ministryId: string, orgId: string) => {
    if (!supabase) return [];
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    const { data } = await supabase.from('organization_memberships')
        .select('roles')
        .eq('user_id', userId)
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId)
        .maybeSingle();
    return data?.roles || [];
};

export const fetchMinistrySettings = async (ministryId: string, orgId: string) => {
    if (!supabase || !ministryId) return null;
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    // FIX: Buscar nome oficial em organization_ministries
    const { data: ministryDef } = await supabase.from('organization_ministries')
        .select('name')
        .eq('id', ministryId)
        .eq('organization_id', orgId)
        .maybeSingle();

    // Tenta buscar configurações adicionais
    const { data: settings } = await supabase.from('ministry_settings')
        .select('*')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId)
        .maybeSingle();
    
    return {
        id: settings?.id,
        displayName: ministryDef?.name || settings?.display_name || 'Ministério',
        roles: settings?.roles || [],
        availabilityStart: settings?.availability_start,
        availabilityEnd: settings?.availability_end,
        organizationId: orgId,
        spotifyClientId: settings?.spotify_client_id,
        spotifyClientSecret: settings?.spotify_client_secret
    };
};

export const fetchMinistrySchedule = async (ministryId: string, month: string, orgId: string) => {
    if (!supabase) return { events: [], schedule: {}, attendance: {} };
    if (!orgId) throw new Error('ORG_ID_REQUIRED');
    
    const start = `${month}-01`;
    const end = `${month}-31`;
    const { data: events } = await supabase.from('events')
        .select('*')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId)
        .gte('date_time', start)
        .lte('date_time', end + 'T23:59:59');

    if (!events) return { events: [], schedule: {}, attendance: {} };

    const eventIds = events.map((e: any) => e.id);
    
    const { data: assignments } = await supabase.from('schedule_assignments')
        .select('*')
        .in('event_id', eventIds)
        .eq('organization_id', orgId);

    const schedule: any = {};
    const attendance: any = {};

    assignments?.forEach((a: any) => {
        const evt = events.find((e: any) => e.id === a.event_id);
        if (evt) {
            const iso = evt.date_time.slice(0, 16);
            const key = `${iso}_${a.role}`;
            schedule[key] = a.member_name;
            if (a.confirmed) attendance[key] = true;
        }
    });

    const formattedEvents = events.map((e: any) => {
        const iso = e.date_time.slice(0, 16);
        return {
            iso,
            title: e.title,
            dateDisplay: iso.split('T')[0].split('-').reverse().slice(0,2).join('/')
        };
    });

    return { events: formattedEvents, schedule, attendance };
};

export const fetchMinistryMembers = async (ministryId: string, orgId: string) => {
    if (!supabase) return { memberMap: {}, publicList: [] };
    if (!orgId) throw new Error('ORG_ID_REQUIRED');
    
    const { data: memberships } = await supabase.from('organization_memberships')
        .select('user_id, roles')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId);
        
    if (!memberships || memberships.length === 0) return { memberMap: {}, publicList: [] };
    
    const userIds = memberships.map((m: any) => m.user_id);
    
    const { data: profiles } = await supabase.from('profiles')
        .select('*')
        .in('id', userIds)
        .eq('organization_id', orgId);

    const memberMap: any = {};
    const publicList: any[] = [];

    profiles?.forEach((p: any) => {
        const mem = memberships.find((m: any) => m.user_id === p.id);
        const roles = mem?.roles || [];
        
        publicList.push({
            id: p.id,
            name: p.name,
            email: p.email,
            avatar_url: p.avatar_url,
            whatsapp: p.whatsapp,
            roles: roles,
            isAdmin: p.is_admin,
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
    if (!supabase) return { availability: {}, notes: {} };
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    const { data } = await supabase.from('availability')
        .select('*')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId);
    
    const availability: any = {};
    const notes: any = {};

    data?.forEach((row: any) => {
        if (!availability[row.member_name]) availability[row.member_name] = [];
        if (Array.isArray(row.dates)) {
            availability[row.member_name] = row.dates;
        }
        if (row.notes) {
            Object.entries(row.notes).forEach(([k, v]) => {
                notes[`${row.member_name}_${k}`] = v;
            });
        }
    });

    return { availability, notes };
};

export const fetchNotificationsSQL = async (ministryIds: string[], userId: string, orgId: string) => {
    if (!supabase) return [];
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    const { data } = await supabase.from('notifications')
        .select('*')
        .in('ministry_id', ministryIds)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(50);
        
    const { data: reads } = await supabase.from('notification_reads')
        .select('notification_id')
        .eq('user_id', userId)
        .eq('organization_id', orgId);
        
    const readIds = new Set(reads?.map((r: any) => r.notification_id));

    return (data || []).map((n: any) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        timestamp: n.created_at,
        read: readIds.has(n.id),
        actionLink: n.action_link,
        ministryId: n.ministry_id
    }));
};

export const fetchAnnouncementsSQL = async (ministryId: string, orgId: string) => {
    if (!supabase) return [];
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    const { data } = await supabase.from('announcements')
        .select(`
            *,
            announcement_reads (user_id, profiles(name), created_at),
            announcement_likes (user_id, profiles(name), created_at)
        `)
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId)
        .gte('expiration_date', new Date().toISOString())
        .order('created_at', { ascending: false });

    return (data || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        message: a.message,
        type: a.type,
        timestamp: a.created_at,
        expirationDate: a.expiration_date,
        author: a.author_name || 'Admin',
        readBy: a.announcement_reads.map((r: any) => ({ userId: r.user_id, name: r.profiles?.name, timestamp: r.created_at })),
        likedBy: a.announcement_likes.map((l: any) => ({ userId: l.user_id, name: l.profiles?.name, timestamp: l.created_at }))
    }));
};

export const fetchSwapRequests = async (ministryId: string, orgId: string) => {
    if (!supabase) return [];
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    const { data } = await supabase.from('swap_requests')
        .select('*')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
        
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

export const fetchRepertoire = async (ministryId: string, orgId: string) => {
    if (!supabase) return [];
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    const { data } = await supabase.from('repertoire')
        .select('*')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
        
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

export const fetchGlobalSchedules = async (month: string, currentMinistryId: string, orgId: string) => {
    if (!supabase) return {};
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    const start = `${month}-01T00:00:00`;
    const end = `${month}-31T23:59:59`;
    
    const { data } = await supabase.from('schedule_assignments')
        .select('event_id, role, member_name, events!inner(date_time, ministry_id)')
        .eq('organization_id', orgId)
        .neq('ministry_id', currentMinistryId)
        .gte('events.date_time', start)
        .lte('events.date_time', end);
        
    const map: any = {};
    data?.forEach((row: any) => {
        const name = row.member_name.toLowerCase().trim();
        if (!map[name]) map[name] = [];
        map[name].push({
            ministryId: row.events.ministry_id,
            eventIso: row.events.date_time.slice(0, 16),
            role: row.role
        });
    });
    return map;
};

export const fetchAuditLogs = async (ministryId: string, orgId: string) => {
    if (!supabase) return [];
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    const { data } = await supabase.from('audit_logs')
        .select('*')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId)
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
    if (!supabase) return [];
    // FIX: ERRO 4 - Fonte EXCLUSIVA organization_memberships e filtering por orgId
    if (!orgId || !ministryId) throw new Error('ORG_ID_AND_MINISTRY_ID_REQUIRED');
    
    // 1. Get Memberships for this specific ministry and organization
    const { data: memberships } = await supabase
        .from('organization_memberships')
        .select('user_id')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId);

    if (!memberships || memberships.length === 0) return [];

    const userIds = memberships.map((m: any) => m.user_id);

    // 2. Get Profiles matching these userIds AND organizationId
    const { data: members } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', userIds)
        .eq('organization_id', orgId);
        
    return (members || []).map((m: any) => ({
        memberId: m.id,
        name: m.name,
        avatar_url: m.avatar_url,
        points: 0, // Points would be calculated via a separate query or aggregation
        stats: { confirmedEvents: 0, missedEvents: 0, swapsRequested: 0, announcementsRead: 0, announcementsLiked: 0 },
        history: []
    }));
};

export const fetchOrganizationsWithStats = async () => {
    if (!supabase) return [];
    const { data } = await supabase.from('organizations').select('*');
    return (data || []).map((o: any) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        active: o.active,
        createdAt: o.created_at,
        userCount: 0,
        ministryCount: 0
    }));
};

export const saveOrganization = async (id: string | null, name: string, slug: string) => {
    if (!supabase) return { success: false, message: "No db" };
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
    if (!supabase) return { success: false, message: "No db" };
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    const { error } = await supabase.from('organization_ministries').upsert({
        organization_id: orgId,
        code: code,
        name: label 
    }, { onConflict: 'organization_id, code' });
    
    return error ? { success: false, message: error.message } : { success: true, message: "Salvo" };
};

export const deleteOrganizationMinistry = async (orgId: string, code: string) => {
    if (!supabase) return { success: false, message: "No db" };
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    const { error } = await supabase.from('organization_ministries').delete().eq('organization_id', orgId).eq('code', code);
    return error ? { success: false, message: error.message } : { success: true, message: "Removido" };
};

export const saveScheduleAssignment = async (ministryId: string, orgId: string, key: string, value: string) => {
    if (!supabase) return false;
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    const iso = key.split('_')[0];
    const role = key.split('_').slice(1).join('_');
    
    const { data: event } = await supabase.from('events')
        .select('id')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId)
        .eq('date_time', iso)
        .single();
        
    if (!event) return false;

    let memberId = null;
    if (value) {
        const { data: profile } = await supabase.from('profiles').select('id').eq('name', value).eq('organization_id', orgId).maybeSingle();
        memberId = profile?.id;
    }

    const { error } = await supabase.from('schedule_assignments').upsert({
        event_id: event.id,
        role: role,
        member_name: value,
        member_id: memberId,
        ministry_id: ministryId,
        organization_id: orgId,
        confirmed: false
    }, { onConflict: 'event_id, role' });

    return !error;
};

export const toggleAssignmentConfirmation = async (ministryId: string, orgId: string, key: string) => {
    if (!supabase) return;
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    const iso = key.split('_')[0];
    const role = key.split('_').slice(1).join('_');

    const { data: event } = await supabase.from('events')
        .select('id')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId)
        .eq('date_time', iso)
        .single();
        
    if (!event) return;

    const { data: assignment } = await supabase.from('schedule_assignments')
        .select('confirmed')
        .eq('event_id', event.id)
        .eq('role', role)
        .eq('organization_id', orgId)
        .single();
        
    if (assignment) {
        await supabase.from('schedule_assignments')
            .update({ confirmed: !assignment.confirmed })
            .eq('event_id', event.id)
            .eq('role', role)
            .eq('organization_id', orgId);
    }
};

export const saveMemberAvailability = async (ministryId: string, orgId: string, member: string, dates: string[], notes?: any, targetMonth?: string) => {
    if (!supabase) return;
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    const { data: profile } = await supabase.from('profiles').select('id').eq('name', member).eq('organization_id', orgId).maybeSingle();
    
    await supabase.from('availability').upsert({
        ministry_id: ministryId,
        organization_id: orgId,
        member_name: member,
        member_id: profile?.id,
        dates: dates,
        notes: notes
    }, { onConflict: 'ministry_id, member_name' });
};

export const createSwapRequestSQL = async (ministryId: string, orgId: string, request: any) => {
    if (!supabase) return;
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    await supabase.from('swap_requests').insert({
        ministry_id: ministryId,
        organization_id: orgId,
        requester_name: request.requesterName,
        requester_id: request.requesterId,
        role: request.role,
        event_iso: request.eventIso,
        event_title: request.eventTitle,
        status: 'pending'
    });
};

export const performSwapSQL = async (ministryId: string, orgId: string, requestId: string, takenByName: string, takenById: string) => {
    if (!supabase) return;
    if (!orgId) throw new Error('ORG_ID_REQUIRED');
    
    const { data: req } = await supabase.from('swap_requests').select('*').eq('id', requestId).eq('organization_id', orgId).single();
    if (!req) return;

    const { data: event } = await supabase.from('events')
        .select('id')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId)
        .eq('date_time', req.event_iso)
        .single();
        
    if (event) {
        await supabase.from('schedule_assignments')
            .update({ member_name: takenByName, member_id: takenById, confirmed: false })
            .eq('event_id', event.id)
            .eq('role', req.role)
            .eq('organization_id', orgId);
            
        await supabase.from('swap_requests')
            .update({ status: 'completed', taken_by_name: takenByName, taken_by_id: takenById })
            .eq('id', requestId)
            .eq('organization_id', orgId);
    }
};

export const cancelSwapRequestSQL = async (requestId: string, orgId: string) => {
    if (!supabase) return;
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    await supabase.from('swap_requests').delete().eq('id', requestId).eq('organization_id', orgId);
};

export const interactAnnouncementSQL = async (id: string, userId: string, userName: string, action: 'read'|'like', orgId: string) => {
    if (!supabase) return;
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    const table = action === 'read' ? 'announcement_reads' : 'announcement_likes';
    
    if (action === 'like') {
        const { data } = await supabase.from(table).select('id').eq('announcement_id', id).eq('user_id', userId).eq('organization_id', orgId).maybeSingle();
        if (data) {
            await supabase.from(table).delete().eq('id', data.id).eq('organization_id', orgId);
        } else {
            await supabase.from(table).insert({ announcement_id: id, user_id: userId, organization_id: orgId });
        }
    } else {
        await supabase.from(table).upsert(
            { announcement_id: id, user_id: userId, organization_id: orgId }, 
            { onConflict: 'announcement_id, user_id' }
        );
    }
};

export const updateUserProfile = async (name: string, whatsapp: string, avatar: string | undefined, functions: string[] | undefined, birthDate: string | undefined, ministryId?: string, orgId?: string) => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const updates: any = {
        name,
        whatsapp,
        birth_date: birthDate
    };
    if (avatar) updates.avatar_url = avatar;

    let query = supabase.from('profiles').update(updates).eq('id', user.id);
    if (orgId) query = query.eq('organization_id', orgId);
    await query;
    
    if (ministryId && functions && orgId) {
        await supabase.from('organization_memberships')
            .update({ roles: functions })
            .eq('user_id', user.id)
            .eq('ministry_id', ministryId)
            .eq('organization_id', orgId);
    }
};

export const saveMinistrySettings = async (ministryId: string, orgId: string, displayName?: string, roles?: string[], start?: string, end?: string) => {
    if (!supabase) return;
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    const updates: any = {};
    if (displayName) updates.display_name = displayName;
    if (roles) updates.roles = roles;
    if (start) updates.availability_start = start;
    if (end) updates.availability_end = end;

    await supabase.from('ministry_settings')
        .update(updates)
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId);
};

export const toggleAdminSQL = async (email: string, status: boolean, ministryId: string, orgId: string) => {
    if (!supabase) return;
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    await supabase.from('profiles').update({ is_admin: status }).eq('email', email).eq('organization_id', orgId);
};

export const deleteMember = async (ministryId: string, orgId: string, memberId: string, name: string) => {
    if (!supabase) return;
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    await supabase.from('organization_memberships')
        .delete()
        .eq('user_id', memberId)
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId);
};

export const updateMemberData = async (id: string, orgId: string, data: any) => {
    if (!supabase) return;
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    await supabase.from('profiles').update({ name: data.name, whatsapp: data.whatsapp }).eq('id', id).eq('organization_id', orgId);
    
    if (data.ministryId) {
        await supabase.from('organization_memberships')
            .update({ roles: data.roles })
            .eq('user_id', id)
            .eq('ministry_id', data.ministryId)
            .eq('organization_id', orgId);
    }
};

export const createMinistryEvent = async (ministryId: string, orgId: string, event: any) => {
    if (!supabase) return;
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    await supabase.from('events').insert({
        ministry_id: ministryId,
        organization_id: orgId,
        title: event.title,
        date_time: event.iso || `${event.date}T${event.time}`
    });
};

export const deleteMinistryEvent = async (ministryId: string, orgId: string, eventIso: string) => {
    if (!supabase) return;
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    await supabase.from('events')
        .delete()
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId)
        .eq('date_time', eventIso);
};

export const updateMinistryEvent = async (ministryId: string, orgId: string, oldIso: string, newTitle: string, newIso: string, applyToAll: boolean) => {
    if (!supabase) return;
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    await supabase.from('events')
        .update({ title: newTitle, date_time: newIso })
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId)
        .eq('date_time', oldIso);
};

export const sendNotificationSQL = async (ministryId: string, orgId: string, notification: any) => {
    if (!supabase) return;
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    await supabase.from('notifications').insert({
        ministry_id: ministryId,
        organization_id: orgId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        action_link: notification.actionLink
    });
};

export const createAnnouncementSQL = async (ministryId: string, orgId: string, announcement: any, authorName: string) => {
    if (!supabase) return;
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    await supabase.from('announcements').insert({
        ministry_id: ministryId,
        organization_id: orgId,
        title: announcement.title,
        message: announcement.message,
        type: announcement.type,
        expiration_date: announcement.expirationDate,
        author_name: authorName
    });
};

export const joinMinistry = async (ministryId: string, orgId: string, roles: string[]) => {
    if (!supabase) return;
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('organization_memberships').insert({
        user_id: user.id,
        organization_id: orgId,
        ministry_id: ministryId,
        roles: roles
    });
    
    const { data: profile } = await supabase.from('profiles').select('allowed_ministries').eq('id', user.id).eq('organization_id', orgId).single();
    const current = profile?.allowed_ministries || [];
    if (!current.includes(ministryId)) {
        await supabase.from('profiles').update({ allowed_ministries: [...current, ministryId] }).eq('id', user.id).eq('organization_id', orgId);
    }
};

export const markNotificationsReadSQL = async (ids: string[], userId: string, orgId: string) => {
    if (!supabase) return;
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    const inserts = ids.map(id => ({ notification_id: id, user_id: userId, organization_id: orgId }));
    await supabase.from('notification_reads').upsert(inserts, { onConflict: 'notification_id, user_id' });
};

export const clearAllNotificationsSQL = async (ministryId: string, orgId: string) => {
    if (!supabase) return;
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    await supabase.from('notifications').delete().eq('ministry_id', ministryId).eq('organization_id', orgId);
};

export const addToRepertoire = async (ministryId: string, orgId: string, item: any) => {
    if (!supabase) return false;
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    const { error } = await supabase.from('repertoire').insert({
        ministry_id: ministryId,
        organization_id: orgId,
        title: item.title,
        link: item.link,
        date_used: item.date,
        added_by: item.addedBy,
        content: item.content
    });
    return !error;
};

export const deleteFromRepertoire = async (id: string, orgId: string) => {
    if (!supabase) return;
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    await supabase.from('repertoire').delete().eq('id', id).eq('organization_id', orgId);
};

export const updateRepertoireItem = async (id: string, orgId: string, updates: any) => {
    if (!supabase) return;
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    await supabase.from('repertoire').update({
        content: updates.content,
        music_key: updates.key
    }).eq('id', id).eq('organization_id', orgId);
};

export const clearScheduleForMonth = async (ministryId: string, orgId: string, month: string) => {
    if (!supabase) return;
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    const start = `${month}-01`;
    const end = `${month}-31`;
    
    const { data: events } = await supabase.from('events')
        .select('id')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId)
        .gte('date_time', start)
        .lte('date_time', end + 'T23:59:59');
        
    const ids = events?.map((e: any) => e.id) || [];
    if (ids.length > 0) {
        await supabase.from('schedule_assignments').delete().in('event_id', ids).eq('organization_id', orgId);
    }
};

export const resetToDefaultEvents = async (ministryId: string, orgId: string, month: string) => {
    if (!supabase) return;
    if (!orgId) throw new Error('ORG_ID_REQUIRED');

    const start = `${month}-01`;
    const end = `${month}-31`;
    
    await supabase.from('events').delete().eq('ministry_id', ministryId).eq('organization_id', orgId).gte('date_time', start).lte('date_time', end + 'T23:59:59');
    
    const [y, m] = month.split('-').map(Number);
    const date = new Date(y, m - 1, 1);
    const inserts = [];
    
    while (date.getMonth() === m - 1) {
        if (date.getDay() === 0) { 
            const dayStr = date.toISOString().split('T')[0];
            inserts.push({ ministry_id: ministryId, organization_id: orgId, title: 'Culto da Família', date_time: `${dayStr}T18:00:00` });
            inserts.push({ ministry_id: ministryId, organization_id: orgId, title: 'Escola Bíblica', date_time: `${dayStr}T09:00:00` });
        }
        date.setDate(date.getDate() + 1);
    }
    
    if (inserts.length > 0) {
        await supabase.from('events').insert(inserts);
    }
};

export const updateProfileMinistry = async (userId: string, ministryId: string) => {
    if (!supabase) return;
    await supabase.from('profiles').update({ ministry_id: ministryId }).eq('id', userId);
};
