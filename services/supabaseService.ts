import { createClient } from '@supabase/supabase-js';
import { 
    MinistryDef, User, Announcement, AppNotification, 
    MinistrySettings, CustomEvent, RepertoireItem, 
    SwapRequest, Organization, AuditLogEntry, 
    TeamMemberProfile, AvailabilityMap, ScheduleMap, AttendanceMap, MemberMap,
    AvailabilityNotesMap,
    GlobalConflictMap
} from '../types';

// Globals injected by Vite via define
declare const __SUPABASE_URL__: string;
declare const __SUPABASE_KEY__: string;

let supabaseUrl = '';
let supabaseKey = '';

// 1. Try Injected Globals (Build-time env vars from vite.config.ts)
try {
    // @ts-ignore
    if (typeof __SUPABASE_URL__ !== 'undefined') supabaseUrl = __SUPABASE_URL__;
    // @ts-ignore
    if (typeof __SUPABASE_KEY__ !== 'undefined') supabaseKey = __SUPABASE_KEY__;
} catch(e) {}

// 2. Try import.meta.env (Vite Standard) safely
try {
  // @ts-ignore
  const meta = import.meta;
  if (!supabaseUrl && meta && meta.env) {
    supabaseUrl = meta.env.VITE_SUPABASE_URL || '';
    supabaseKey = meta.env.VITE_SUPABASE_KEY || '';
  }
} catch (e) {}

export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_KEY = supabaseKey;

// Supabase Client
export const supabase = (SUPABASE_URL && SUPABASE_KEY) 
    ? createClient(SUPABASE_URL, SUPABASE_KEY) 
    : null;

export const getSupabase = () => supabase;

// --- Helper Functions ---

export const getCurrentOrgId = async (): Promise<string | null> => {
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
    return data?.organization_id || null;
};

export const logAction = async (ministryId: string, action: string, details: string, orgId?: string) => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('name').eq('id', user?.id).single();
    const author = profile?.name || user?.email || 'Sistema';
    
    await supabase.from('audit_logs').insert({
        ministry_id: ministryId,
        action,
        details,
        author,
        organization_id: orgId || await getCurrentOrgId(),
        date: new Date().toISOString()
    });
};

// --- Auth Functions ---

export const loginWithEmail = async (email: string, password: string) => {
    if (!supabase) return { success: false, message: "Erro de configuração do Supabase." };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, message: error.message };
    return { success: true };
};

export const loginWithGoogle = async () => {
    if (!supabase) return { success: false, message: "Erro de configuração." };
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) return { success: false, message: error.message };
    return { success: true };
};

export const logout = async () => {
    if (supabase) await supabase.auth.signOut();
};

export const registerWithEmail = async (email: string, password: string, name: string, ministries: string[], orgId?: string, roles?: string[]) => {
    if (!supabase) return { success: false, message: "Erro de configuração." };
    
    const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
            data: {
                full_name: name,
            }
        }
    });

    if (error) return { success: false, message: error.message };
    
    if (data.user) {
        const { error: profileError } = await supabase.from('profiles').upsert({
            id: data.user.id,
            email,
            name,
            allowed_ministries: ministries,
            ministry_id: ministries[0],
            organization_id: orgId || '00000000-0000-0000-0000-000000000000', 
            roles: roles
        });
        if (profileError) console.error("Error creating profile:", profileError);
    }

    return { success: true, message: "Cadastro realizado! Verifique seu e-mail." };
};

export const sendPasswordResetEmail = async (email: string) => {
    if (!supabase) return { success: false, message: "Erro de configuração." };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password',
    });
    if (error) return { success: false, message: error.message };
    return { success: true, message: "Email de recuperação enviado!" };
};

// --- Organization & Profile Functions ---

export const fetchOrganizationMinistries = async (orgId: string): Promise<MinistryDef[]> => {
    if (!supabase) return [];
    const { data } = await supabase
        .from('organization_ministries')
        .select('*')
        .eq('organization_id', orgId);
    return (data || []).map((m: any) => ({
        id: m.code,
        code: m.code,
        label: m.label,
        organizationId: m.organization_id
    }));
};

export const fetchUserAllowedMinistries = async (userId: string, orgId: string): Promise<string[]> => {
    if (!supabase) return [];
    const { data } = await supabase
        .from('profiles')
        .select('allowed_ministries')
        .eq('id', userId)
        .single();
    return data?.allowed_ministries || [];
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
        functions, 
        birth_date: birthDate,
        updated_at: new Date().toISOString()
    };
    if (avatar_url) updates.avatar_url = avatar_url;

    await supabase.from('profiles').update(updates).eq('id', user.id);
};

export const fetchOrganizationsWithStats = async (): Promise<Organization[]> => {
    if (!supabase) return [];
    const { data: orgs } = await supabase.from('organizations').select('*');
    if (!orgs) return [];

    return orgs.map((o: any) => ({
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
    if (!supabase) return { success: false, message: "Erro DB" };
    const payload = { name, slug };
    let error;
    if (id) {
        ({ error } = await supabase.from('organizations').update(payload).eq('id', id));
    } else {
        ({ error } = await supabase.from('organizations').insert(payload));
    }
    if (error) return { success: false, message: error.message };
    return { success: true, message: "Organização salva!" };
};

export const toggleOrganizationStatus = async (id: string, active: boolean) => {
    if (!supabase) return false;
    const { error } = await supabase.from('organizations').update({ active }).eq('id', id);
    return !error;
};

export const saveOrganizationMinistry = async (orgId: string, code: string, label: string) => {
    if (!supabase) return { success: false, message: "Erro DB" };
    const { error } = await supabase.from('organization_ministries').upsert({
        organization_id: orgId,
        code,
        label
    }, { onConflict: 'organization_id,code' });
    if (error) return { success: false, message: error.message };
    return { success: true, message: "Ministério salvo!" };
};

export const deleteOrganizationMinistry = async (orgId: string, code: string) => {
    if (!supabase) return { success: false, message: "Erro DB" };
    const { error } = await supabase.from('organization_ministries').delete().eq('organization_id', orgId).eq('code', code);
    if (error) return { success: false, message: error.message };
    return { success: true, message: "Ministério removido!" };
};

// --- Ministry Data Functions ---

export const fetchMinistrySettings = async (ministryId: string): Promise<MinistrySettings> => {
    if (!supabase) return { displayName: '', roles: [] };
    const { data } = await supabase
        .from('ministry_settings')
        .select('*')
        .eq('organization_ministry_id', ministryId)
        .maybeSingle();
    
    if (!data) return { displayName: '', roles: [] };
    return {
        displayName: data.display_name,
        roles: data.roles || [],
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

    await supabase.from('ministry_settings').upsert({
        organization_ministry_id: ministryId,
        ...updates
    }, { onConflict: 'organization_ministry_id' });
};

export const fetchMinistrySchedule = async (ministryId: string, month: string) => {
    if (!supabase) return { events: [], schedule: {}, attendance: {} };
    
    const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .eq('ministry_id', ministryId)
        .like('date_time', `${month}%`)
        .order('date_time');

    const events = (eventsData || []).map((e: any) => ({
        iso: e.date_time.slice(0, 16),
        dateDisplay: new Date(e.date_time).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'}),
        title: e.title,
        id: e.id
    }));

    const eventIds = events.map((e: any) => e.id);
    const schedule: ScheduleMap = {};
    const attendance: AttendanceMap = {};

    if (eventIds.length > 0) {
        const { data: assignments } = await supabase
            .from('schedule_assignments')
            .select('event_id, role, member_id, confirmed, profiles(name)')
            .in('event_id', eventIds);

        assignments?.forEach((a: any) => {
            const evt = events.find((e: any) => e.id === a.event_id);
            if (evt) {
                const key = `${evt.iso}_${a.role}`;
                schedule[key] = a.profiles?.name || '';
                if (a.confirmed) attendance[key] = true;
            }
        });
    }

    return { events, schedule, attendance };
};

export const fetchMinistryMembers = async (ministryId: string) => {
    if (!supabase) return { memberMap: {}, publicList: [] };
    
    const orgId = await getCurrentOrgId();
    if (!orgId) return { memberMap: {}, publicList: [] };

    const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', orgId);

    const filtered = (profiles || []).filter((p: any) => 
        (p.allowed_ministries && p.allowed_ministries.includes(ministryId)) || 
        p.ministry_id === ministryId
    );

    const publicList: TeamMemberProfile[] = filtered.map((p: any) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        whatsapp: p.whatsapp,
        avatar_url: p.avatar_url,
        roles: p.roles || [],
        isAdmin: p.is_admin,
        birthDate: p.birth_date,
        organizationId: p.organization_id
    }));

    const memberMap: MemberMap = {};
    const settings = await fetchMinistrySettings(ministryId);
    settings.roles.forEach(r => memberMap[r] = []);

    publicList.forEach(p => {
        p.roles?.forEach(r => {
            if (!memberMap[r]) memberMap[r] = [];
            memberMap[r].push(p.name);
        });
    });

    return { memberMap, publicList };
};

export const fetchMinistryAvailability = async (ministryId: string) => {
    if (!supabase) return { availability: {}, notes: {} };
    
    const { data: availData } = await supabase
        .from('availability')
        .select('dates, notes, profiles(name)')
        .eq('ministry_id', ministryId);

    const availability: AvailabilityMap = {};
    const notes: AvailabilityNotesMap = {};

    availData?.forEach((row: any) => {
        const name = row.profiles?.name;
        if (name) {
            availability[name] = row.dates || [];
            if (row.notes) {
                Object.entries(row.notes).forEach(([k, v]) => {
                    notes[`${name}_${k}`] = v as string;
                });
            }
        }
    });

    return { availability, notes };
};

export const saveMemberAvailability = async (ministryId: string, memberName: string, dates: string[], notes: Record<string, string>, targetMonth?: string) => {
    if (!supabase) return;
    
    const { data: profile } = await supabase.from('profiles').select('id').eq('name', memberName).single();
    if (!profile) return;

    const { data: existing } = await supabase
        .from('availability')
        .select('*')
        .eq('ministry_id', ministryId)
        .eq('member_id', profile.id)
        .single();

    let finalDates = dates;
    let finalNotes = notes;

    if (existing) {
        if (targetMonth) {
            const otherMonthDates = (existing.dates || []).filter((d: string) => !d.startsWith(targetMonth));
            finalDates = [...otherMonthDates, ...dates];
        }
        finalNotes = { ...existing.notes, ...notes };
    }

    await supabase.from('availability').upsert({
        ministry_id: ministryId,
        member_id: profile.id,
        dates: finalDates,
        notes: finalNotes
    }, { onConflict: 'ministry_id,member_id' });
};

// --- Notifications & Announcements ---

export const fetchNotificationsSQL = async (ministryIds: string[], userId: string): Promise<AppNotification[]> => {
    if (!supabase) return [];
    
    const { data } = await supabase
        .from('notifications')
        .select('*')
        .or(`ministry_id.in.(${ministryIds.join(',')}),user_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(50);

    const { data: reads } = await supabase.from('notification_reads').select('notification_id').eq('user_id', userId);
    const readIds = new Set(reads?.map((r: any) => r.notification_id));

    return (data || []).map((n: any) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        timestamp: n.created_at,
        read: readIds.has(n.id),
        actionLink: n.action_link,
        ministryId: n.ministry_id,
        organizationId: n.organization_id
    }));
};

export const markNotificationsReadSQL = async (notificationIds: string[], userId: string) => {
    if (!supabase) return;
    const inserts = notificationIds.map(id => ({ user_id: userId, notification_id: id }));
    await supabase.from('notification_reads').upsert(inserts, { onConflict: 'user_id,notification_id' });
};

export const clearAllNotificationsSQL = async (ministryId: string) => {
    if (!supabase) return;
    await supabase.from('notifications').delete().eq('ministry_id', ministryId);
};

export const sendNotificationSQL = async (ministryId: string, notification: Partial<AppNotification>) => {
    if (!supabase) return;
    const orgId = await getCurrentOrgId();
    await supabase.from('notifications').insert({
        ministry_id: ministryId,
        organization_id: orgId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        action_link: notification.actionLink
    });
};

export const fetchAnnouncementsSQL = async (ministryId: string): Promise<Announcement[]> => {
    if (!supabase) return [];
    const { data } = await supabase
        .from('announcements')
        .select('*, announcement_reads(user_id, profiles(name)), announcement_likes(user_id, profiles(name))')
        .eq('ministry_id', ministryId)
        .order('created_at', { ascending: false });

    return (data || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        message: a.message,
        type: a.type,
        timestamp: a.created_at,
        expirationDate: a.expiration_date,
        author: a.author_name || 'Admin',
        readBy: a.announcement_reads?.map((r: any) => ({ userId: r.user_id, name: r.profiles?.name, timestamp: '' })) || [],
        likedBy: a.announcement_likes?.map((l: any) => ({ userId: l.user_id, name: l.profiles?.name, timestamp: '' })) || [],
        organizationId: a.organization_id
    }));
};

export const createAnnouncementSQL = async (ministryId: string, announcement: any, authorName: string) => {
    if (!supabase) return;
    const orgId = await getCurrentOrgId();
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

export const interactAnnouncementSQL = async (id: string, userId: string, userName: string, action: 'read' | 'like') => {
    if (!supabase) return;
    if (action === 'read') {
        await supabase.from('announcement_reads').upsert({ announcement_id: id, user_id: userId }, { onConflict: 'announcement_id,user_id' });
    } else {
        const { data } = await supabase.from('announcement_likes').select('*').eq('announcement_id', id).eq('user_id', userId).single();
        if (data) {
            await supabase.from('announcement_likes').delete().eq('announcement_id', id).eq('user_id', userId);
        } else {
            await supabase.from('announcement_likes').insert({ announcement_id: id, user_id: userId });
        }
    }
};

// --- Swap Requests ---

export const fetchSwapRequests = async (ministryId: string): Promise<SwapRequest[]> => {
    if (!supabase) return [];
    const { data } = await supabase
        .from('swap_requests')
        .select('*')
        .eq('ministry_id', ministryId)
        .order('created_at', { ascending: false });

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
        takenByName: r.taken_by_name,
        organizationId: r.organization_id
    }));
};

export const createSwapRequestSQL = async (ministryId: string, request: Partial<SwapRequest>) => {
    if (!supabase) return;
    const orgId = await getCurrentOrgId();
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

export const performSwapSQL = async (ministryId: string, reqId: string, takenByName: string, takenById: string) => {
    if (!supabase) return;
    
    const { data: req } = await supabase.from('swap_requests').update({
        status: 'completed',
        taken_by_name: takenByName,
        taken_by_id: takenById
    }).eq('id', reqId).select().single();

    if (req) {
        const { data: event } = await supabase.from('events')
            .select('id')
            .eq('ministry_id', ministryId)
            .like('date_time', `${req.event_iso}%`)
            .single();
        
        if (event) {
            await supabase.from('schedule_assignments').update({
                member_id: takenById,
                confirmed: false 
            }).eq('event_id', event.id).eq('role', req.role);
        }
    }
};

export const cancelSwapRequestSQL = async (reqId: string) => {
    if (!supabase) return;
    await supabase.from('swap_requests').update({ status: 'cancelled' }).eq('id', reqId);
};

// --- Repertoire ---

export const fetchRepertoire = async (ministryId: string): Promise<RepertoireItem[]> => {
    if (!supabase) return [];
    const { data } = await supabase
        .from('repertoire')
        .select('*')
        .eq('ministry_id', ministryId)
        .order('date', { ascending: false });

    return (data || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        link: r.link,
        date: r.date,
        observation: r.observation,
        addedBy: r.added_by,
        createdAt: r.created_at,
        content: r.content,
        key: r.key,
        organizationId: r.organization_id
    }));
};

export const addToRepertoire = async (ministryId: string, item: Partial<RepertoireItem>) => {
    if (!supabase) return false;
    const orgId = await getCurrentOrgId();
    const { error } = await supabase.from('repertoire').insert({
        ministry_id: ministryId,
        organization_id: orgId,
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

// --- Other Functions ---

export const fetchGlobalSchedules = async (month: string, currentMinistryId: string): Promise<GlobalConflictMap> => {
    return {};
};

export const fetchAuditLogs = async (ministryId: string): Promise<AuditLogEntry[]> => {
    if (!supabase) return [];
    const { data } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('ministry_id', ministryId)
        .order('date', { ascending: false })
        .limit(100);
    return data || [];
};

export const fetchRankingData = async (ministryId: string) => {
    if (!supabase) return [];
    return [];
};

// --- Admin Actions ---

export const createMinistryEvent = async (ministryId: string, evt: any) => {
    if (!supabase) return;
    const orgId = await getCurrentOrgId();
    await supabase.from('events').insert({
        ministry_id: ministryId,
        organization_id: orgId,
        title: evt.title,
        date_time: `${evt.date}T${evt.time}:00`
    });
};

export const deleteMinistryEvent = async (ministryId: string, iso: string) => {
    if (!supabase) return;
    await supabase.from('events').delete()
        .eq('ministry_id', ministryId)
        .like('date_time', `${iso}%`);
};

export const updateMinistryEvent = async (ministryId: string, oldIso: string, newTitle: string, newIso: string, applyToAll: boolean) => {
    if (!supabase) return;
    
    if (applyToAll) {
        // Logic for applying to all is skipped for brevity
    } else {
        await supabase.from('events').update({
            title: newTitle,
            date_time: newIso + ':00'
        })
        .eq('ministry_id', ministryId)
        .like('date_time', `${oldIso}%`);
    }
};

export const resetToDefaultEvents = async (ministryId: string, month: string) => {
    if (!supabase) return;
    await supabase.from('events').delete()
        .eq('ministry_id', ministryId)
        .like('date_time', `${month}%`);
};

export const clearScheduleForMonth = async (ministryId: string, month: string) => {
    if (!supabase) return;
    const { data: events } = await supabase.from('events').select('id').eq('ministry_id', ministryId).like('date_time', `${month}%`);
    const eventIds = events?.map((e: any) => e.id) || [];
    if (eventIds.length > 0) {
        await supabase.from('schedule_assignments').delete().in('event_id', eventIds);
    }
};

export const toggleAssignmentConfirmation = async (ministryId: string, key: string) => {
    if (!supabase) return;
    const [iso, ...roleParts] = key.split('_');
    const role = roleParts.join('_');
    
    const { data: event } = await supabase.from('events').select('id').eq('ministry_id', ministryId).like('date_time', `${iso}%`).single();
    if (!event) return;

    const { data: assignment } = await supabase.from('schedule_assignments').select('confirmed').eq('event_id', event.id).eq('role', role).single();
    if (assignment) {
        await supabase.from('schedule_assignments').update({ confirmed: !assignment.confirmed }).eq('event_id', event.id).eq('role', role);
    }
};

export const saveScheduleAssignment = async (ministryId: string, key: string, memberName: string) => {
    if (!supabase) return true;
    try {
        const currentOrgId = await getCurrentOrgId();
        const [iso, ...roleParts] = key.split('_');
        const role = roleParts.join('_');
        
        const { data: event } = await supabase
            .from('events')
            .select('id, title, organization_id')
            .eq('ministry_id', ministryId)
            .like('date_time', `${iso}%`) 
            .single();
        
        if (!event) {
            console.error("Evento não encontrado:", iso, ministryId);
            return false;
        }

        if (memberName === "") {
            await supabase.from('schedule_assignments').delete().eq('event_id', event.id).eq('role', role);
            await logAction(ministryId, 'Removeu Escala', `${role} removido de ${event.title} (${iso})`, currentOrgId || undefined);
            return true;
        }

        if (memberName && memberName.trim() !== "") {
            const cleanName = memberName.trim();
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, organization_id')
                .eq('name', cleanName);
            
            if (!profiles || profiles.length === 0) return false;

            let targetMember = profiles.find((p: any) => p.organization_id === currentOrgId);
            if (!targetMember) targetMember = profiles[0];
            
            const safeOrgId = targetMember.organization_id || currentOrgId;

            const { error: saveError } = await supabase.from('schedule_assignments').upsert({ 
                event_id: event.id, 
                role, 
                member_id: targetMember.id, 
                confirmed: false,
                ministry_id: ministryId, 
                organization_id: safeOrgId 
            }, { onConflict: 'event_id,role' });

            if (saveError) {
                console.error("Erro RLS ao salvar:", saveError);
                return false;
            }

            await logAction(ministryId, 'Alterou Escala', `${memberName} escalado como ${role} em ${event.title} (${iso})`, safeOrgId);
            return true;
        }
        return false;
    } catch (e) {
        console.error("Erro crítico ao salvar escala:", e);
        return false;
    }
};

export const toggleAdminSQL = async (email: string, status: boolean, name: string) => {
    if (!supabase) return;
    await supabase.from('profiles').update({ is_admin: status }).eq('email', email);
};

export const deleteMember = async (ministryId: string, id: string, name: string) => {
    if (!supabase) return;
    const { data: profile } = await supabase.from('profiles').select('allowed_ministries').eq('id', id).single();
    if (profile) {
        const newAllowed = (profile.allowed_ministries || []).filter((m: string) => m !== ministryId);
        await supabase.from('profiles').update({ allowed_ministries: newAllowed }).eq('id', id);
    }
};

export const joinMinistry = async (ministryId: string, roles: string[]) => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from('profiles').select('allowed_ministries, roles').eq('id', user.id).single();
    if (profile) {
        const newAllowed = [...new Set([...(profile.allowed_ministries || []), ministryId])];
        const newRoles = [...new Set([...(profile.roles || []), ...roles])];
        
        await supabase.from('profiles').update({ 
            allowed_ministries: newAllowed,
            roles: newRoles
        }).eq('id', user.id);
    }
};
