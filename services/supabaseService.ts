import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  MinistrySettings, 
  MinistryDef, 
  Organization, 
  User, 
  CustomEvent, 
  SwapRequest, 
  Announcement, 
  AppNotification, 
  RepertoireItem, 
  AuditLogEntry, 
  RankingEntry,
  TeamMemberProfile,
  MemberMap,
  ScheduleMap,
  AttendanceMap,
  AvailabilityMap,
  AvailabilityNotesMap,
  GlobalConflictMap
} from '../types';

// Environment variables handling
const getEnv = (key: string) => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] as string;
  }
  return '';
};

export const SUPABASE_URL = getEnv('VITE_SUPABASE_URL');
export const SUPABASE_KEY = getEnv('VITE_SUPABASE_KEY');

let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

export const getSupabase = () => supabase;

// --- AUTH ---

export const loginWithEmail = async (email: string, password: string) => {
  if (!supabase) return { success: false, message: "Serviço indisponível" };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { success: false, message: error.message };
  return { success: true, user: data.user };
};

export const loginWithGoogle = async () => {
  if (!supabase) return { success: false, message: "Serviço indisponível" };
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
  if (error) return { success: false, message: error.message };
  return { success: true, data };
};

export const registerWithEmail = async (email: string, password: string, name: string, ministries: string[], orgId?: string, roles?: string[]) => {
  if (!supabase) return { success: false, message: "Serviço indisponível" };
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
        ministries: ministries,
        roles: roles
      }
    }
  });
  if (error) return { success: false, message: error.message };
  return { success: true, message: "Verifique seu email para confirmar o cadastro." };
};

export const logout = async () => {
  if (!supabase) return;
  await supabase.auth.signOut();
  localStorage.clear();
};

export const sendPasswordResetEmail = async (email: string) => {
  if (!supabase) return { success: false, message: "Serviço indisponível" };
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) return { success: false, message: error.message };
  return { success: true, message: "Email de recuperação enviado." };
};

// --- USER & PROFILE ---

export const fetchUserAllowedMinistries = async (userId: string, orgId: string): Promise<string[]> => {
  if (!supabase) return ['midia'];
  const { data } = await supabase.from('profiles').select('allowed_ministries').eq('id', userId).single();
  return data?.allowed_ministries || ['midia'];
};

export const updateProfileMinistry = async (userId: string, ministryId: string) => {
  if (!supabase) return;
  await supabase.from('profiles').update({ ministry_id: ministryId }).eq('id', userId);
};

export const updateUserProfile = async (name: string, whatsapp: string, avatar_url: string | undefined, functions: string[] | undefined, birthDate: string | undefined, ministryId?: string) => {
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

export const joinMinistry = async (ministryId: string, roles: string[]) => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if(!user) return;

    const { data } = await supabase.from('profiles').select('allowed_ministries, functions').eq('id', user.id).single();
    const currentMinistries = data?.allowed_ministries || [];
    const currentFunctions = data?.functions || [];
    
    if(!currentMinistries.includes(ministryId)) {
        await supabase.from('profiles').update({
            allowed_ministries: [...currentMinistries, ministryId],
            functions: [...new Set([...currentFunctions, ...roles])]
        }).eq('id', user.id);
    }
};

// --- ORGANIZATION & MINISTRIES ---

export const fetchOrganizationMinistries = async (orgId: string): Promise<MinistryDef[]> => {
  if (!supabase) return [];
  const { data } = await supabase.from('organization_ministries').select('*').eq('organization_id', orgId);
  return data?.map((m: any) => ({
      id: m.id,
      code: m.code || m.id,
      label: m.label || m.name || m.code,
      enabledTabs: m.enabled_tabs || [],
      organizationId: m.organization_id
  })) || [];
};

export const fetchMinistrySettings = async (ministryId: string): Promise<MinistrySettings> => {
  if (!supabase) return { displayName: 'Ministério', roles: [] };
  const { data } = await supabase.from('ministry_settings').select('*').eq('ministry_id', ministryId).single();
  return {
      displayName: data?.display_name || ministryId,
      roles: data?.roles || [],
      availabilityStart: data?.availability_start,
      availabilityEnd: data?.availability_end,
      spotifyClientId: data?.spotify_client_id,
      spotifyClientSecret: data?.spotify_client_secret
  };
};

export const saveMinistrySettings = async (ministryId: string, displayName?: string, roles?: string[], start?: string, end?: string) => {
    if (!supabase) return;
    const updates: any = {};
    if (displayName !== undefined) updates.display_name = displayName;
    if (roles !== undefined) updates.roles = roles;
    if (start !== undefined) updates.availability_start = start;
    if (end !== undefined) updates.availability_end = end;

    await supabase.from('ministry_settings').upsert({ ministry_id: ministryId, ...updates });
};

// --- SCHEDULE & EVENTS ---

export const fetchMinistrySchedule = async (ministryId: string, month: string) => {
    if (!supabase) return { events: [], schedule: {}, attendance: {} };
    
    const start = `${month}-01`;
    const end = `${month}-31`;
    const { data: eventsData } = await supabase.from('events')
        .select('*')
        .eq('ministry_id', ministryId)
        .gte('date_time', start)
        .lte('date_time', end + 'T23:59:59');

    const events = (eventsData || []).map((e: any) => ({
        id: e.id,
        iso: e.date_time,
        title: e.title,
        date: e.date_time.split('T')[0],
        time: e.date_time.split('T')[1],
        dateDisplay: new Date(e.date_time).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})
    }));

    const eventIds = events.map((e: any) => e.id);
    let schedule: ScheduleMap = {};
    let attendance: AttendanceMap = {};

    if (eventIds.length > 0) {
        const { data: assignments } = await supabase.from('schedule_assignments')
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

export const fetchMinistryMembers = async (ministryId: string) => {
    if (!supabase) return { memberMap: {}, publicList: [] };
    
    const { data: profiles } = await supabase.from('profiles')
        .select('*')
        .contains('allowed_ministries', [ministryId]);

    const publicList: TeamMemberProfile[] = (profiles || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        avatar_url: p.avatar_url,
        whatsapp: p.whatsapp,
        birthDate: p.birth_date,
        roles: p.functions || [],
        isAdmin: p.is_admin
    }));

    const memberMap: MemberMap = {};
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
    const { data } = await supabase.from('availability').select('*').eq('ministry_id', ministryId);
    
    const availability: AvailabilityMap = {};
    const notes: AvailabilityNotesMap = {};

    data?.forEach((row: any) => {
        if (!availability[row.member_name]) availability[row.member_name] = [];
        availability[row.member_name] = row.dates || [];
        
        if (row.notes) {
            Object.entries(row.notes).forEach(([k, v]) => {
                notes[`${row.member_name}_${k}`] = v as string;
            });
        }
    });

    return { availability, notes };
};

export const createMinistryEvent = async (ministryId: string, event: { title: string, date: string, time: string }) => {
    if (!supabase) return;
    const iso = `${event.date}T${event.time}`;
    await supabase.from('events').insert({
        ministry_id: ministryId,
        title: event.title,
        date_time: iso
    });
};

export const deleteMinistryEvent = async (ministryId: string, iso: string) => {
    if (!supabase) return;
    await supabase.from('events').delete().match({ ministry_id: ministryId, date_time: iso });
};

export const updateMinistryEvent = async (ministryId: string, oldIso: string, title: string, newIso: string, applyToAll: boolean) => {
    if (!supabase) return;
    await supabase.from('events').update({ title, date_time: newIso })
        .match({ ministry_id: ministryId, date_time: oldIso });
};

export const saveScheduleAssignment = async (ministryId: string, key: string, memberName: string) => {
    if (!supabase) return;
    const [iso, ...roleParts] = key.split('_');
    const role = roleParts.join('_');
    
    const { data: events } = await supabase.from('events').select('id').eq('ministry_id', ministryId).eq('date_time', iso).single();
    if (!events) return;

    if (!memberName) {
        await supabase.from('schedule_assignments').delete().match({ event_id: events.id, role });
    } else {
        await supabase.from('schedule_assignments').upsert({
            event_id: events.id,
            role,
            member_name: memberName,
            ministry_id: ministryId
        }, { onConflict: 'event_id,role' });
    }
};

export const toggleAssignmentConfirmation = async (ministryId: string, key: string) => {
    if (!supabase) return;
    const [iso, ...roleParts] = key.split('_');
    const role = roleParts.join('_');
    
    const { data: events } = await supabase.from('events').select('id').eq('ministry_id', ministryId).eq('date_time', iso).single();
    if (!events) return;

    const { data: assignment } = await supabase.from('schedule_assignments')
        .select('confirmed')
        .match({ event_id: events.id, role })
        .single();
    
    if (assignment) {
        await supabase.from('schedule_assignments').update({ confirmed: !assignment.confirmed }).match({ event_id: events.id, role });
    }
};

export const clearScheduleForMonth = async (ministryId: string, month: string) => {
    if (!supabase) return;
    const start = `${month}-01T00:00:00`;
    const end = `${month}-31T23:59:59`;
    
    const { data: events } = await supabase.from('events').select('id').eq('ministry_id', ministryId).gte('date_time', start).lte('date_time', end);
    const ids = events?.map((e: any) => e.id) || [];
    
    if (ids.length > 0) {
        await supabase.from('schedule_assignments').delete().in('event_id', ids);
    }
};

export const resetToDefaultEvents = async (ministryId: string, month: string) => {
    await clearScheduleForMonth(ministryId, month);
};

export const saveMemberAvailability = async (ministryId: string, memberName: string, dates: string[], notes: Record<string, string>, targetMonth: string) => {
    if (!supabase) return;
    const { data: current } = await supabase.from('availability').select('*').match({ ministry_id: ministryId, member_name: memberName }).single();
    
    let newDates = dates;
    let newNotes = notes;

    if (current) {
        const otherDates = (current.dates as string[]).filter(d => !d.startsWith(targetMonth));
        newDates = [...otherDates, ...dates];
        newNotes = { ...current.notes, ...notes };
    }

    await supabase.from('availability').upsert({
        ministry_id: ministryId,
        member_name: memberName,
        dates: newDates,
        notes: newNotes
    }, { onConflict: 'ministry_id,member_name' });
};

// --- SWAPS ---

export const fetchSwapRequests = async (ministryId: string): Promise<SwapRequest[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('swap_requests').select('*').eq('ministry_id', ministryId);
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
        takenByName: r.taken_by_name
    }));
};

export const createSwapRequestSQL = async (ministryId: string, request: any) => {
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

export const performSwapSQL = async (ministryId: string, requestId: string, takenByName: string, takenById: string) => {
    if (!supabase) return;
    
    const { data: req } = await supabase.from('swap_requests').update({
        status: 'completed',
        taken_by_name: takenByName,
        taken_by_id: takenById
    }).eq('id', requestId).select().single();

    if (req) {
        const { data: event } = await supabase.from('events').select('id').eq('ministry_id', ministryId).eq('date_time', req.event_iso).single();
        if (event) {
            await supabase.from('schedule_assignments').update({
                member_name: takenByName,
                confirmed: true
            }).match({ event_id: event.id, role: req.role });
        }
    }
};

export const cancelSwapRequestSQL = async (requestId: string) => {
    if (!supabase) return;
    await supabase.from('swap_requests').delete().eq('id', requestId);
};

// --- NOTIFICATIONS ---

export const fetchNotificationsSQL = async (ministryIds: string[], userId: string): Promise<AppNotification[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('notifications')
        .select('*')
        .in('ministry_id', ministryIds)
        .order('created_at', { ascending: false })
        .limit(20);
        
    return (data || []).map((n: any) => ({
        id: n.id,
        ministryId: n.ministry_id,
        title: n.title,
        message: n.message,
        type: n.type,
        timestamp: n.created_at,
        read: false,
        actionLink: n.action_link
    }));
};

export const markNotificationsReadSQL = async (ids: string[], userId: string) => {
    // Stub
};

export const clearAllNotificationsSQL = async (ministryId: string) => {
    if (!supabase) return;
    await supabase.from('notifications').delete().eq('ministry_id', ministryId);
};

export const sendNotificationSQL = async (ministryId: string, notification: any) => {
    if (!supabase) return;
    await supabase.from('notifications').insert({
        ministry_id: ministryId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        action_link: notification.actionLink
    });
};

// --- ANNOUNCEMENTS ---

export const fetchAnnouncementsSQL = async (ministryId: string): Promise<Announcement[]> => {
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
        expirationDate: a.expiration_date,
        readBy: a.read_by || [],
        likedBy: a.liked_by || [],
        organizationId: a.organization_id
    }));
};

export const createAnnouncementSQL = async (ministryId: string, announcement: any, authorName: string) => {
    if (!supabase) return;
    await supabase.from('announcements').insert({
        ministry_id: ministryId,
        title: announcement.title,
        message: announcement.message,
        type: announcement.type,
        expiration_date: announcement.expirationDate,
        author: authorName,
        read_by: [],
        liked_by: []
    });
};

export const interactAnnouncementSQL = async (id: string, userId: string, userName: string, action: 'read' | 'like') => {
    if (!supabase) return;
    const { data } = await supabase.from('announcements').select('read_by, liked_by').eq('id', id).single();
    if (!data) return;

    const updates: any = {};
    if (action === 'read') {
        const reads = data.read_by || [];
        if (!reads.some((r: any) => r.userId === userId)) {
            updates.read_by = [...reads, { userId, name: userName, timestamp: new Date().toISOString() }];
        }
    } else if (action === 'like') {
        const likes = data.liked_by || [];
        if (likes.some((l: any) => l.userId === userId)) {
            updates.liked_by = likes.filter((l: any) => l.userId !== userId);
        } else {
            updates.liked_by = [...likes, { userId, name: userName, timestamp: new Date().toISOString() }];
        }
    }

    if (Object.keys(updates).length > 0) {
        await supabase.from('announcements').update(updates).eq('id', id);
    }
};

// --- REPERTOIRE ---

export const fetchRepertoire = async (ministryId: string): Promise<RepertoireItem[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('repertoire').select('*').eq('ministry_id', ministryId);
    return (data || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        link: r.link,
        date: r.date_used,
        addedBy: r.added_by,
        createdAt: r.created_at,
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
    await supabase.from('repertoire').update(updates).eq('id', id);
};

// --- OTHERS ---

export const fetchGlobalSchedules = async (month: string, currentMinistryId: string): Promise<GlobalConflictMap> => {
    return {};
};

export const fetchAuditLogs = async (ministryId: string): Promise<AuditLogEntry[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('audit_logs').select('*').eq('ministry_id', ministryId).order('created_at', { ascending: false }).limit(50);
    return (data || []).map((l: any) => ({
        id: l.id,
        date: l.created_at,
        action: l.action,
        details: l.details,
        author: l.author
    }));
};

export const fetchRankingData = async (ministryId: string): Promise<RankingEntry[]> => {
    return [];
};

// --- SUPER ADMIN ---

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
    if (!supabase) return { success: false, message: 'Offline' };
    const payload = { name, slug };
    let error;
    if (id) {
        ({ error } = await supabase.from('organizations').update(payload).eq('id', id));
    } else {
        ({ error } = await supabase.from('organizations').insert(payload));
    }
    return { success: !error, message: error ? error.message : 'Salvo' };
};

export const toggleOrganizationStatus = async (id: string, active: boolean) => {
    if (!supabase) return false;
    const { error } = await supabase.from('organizations').update({ active }).eq('id', id);
    return !error;
};

export const saveOrganizationMinistry = async (orgId: string, code: string, label: string) => {
    if (!supabase) return { success: false, message: 'Offline' };
    const { error } = await supabase.from('organization_ministries').insert({
        organization_id: orgId,
        code,
        label
    });
    return { success: !error, message: error ? error.message : 'Ministério criado' };
};

export const deleteOrganizationMinistry = async (orgId: string, code: string) => {
    if (!supabase) return { success: false, message: 'Offline' };
    const { error } = await supabase.from('organization_ministries').delete().match({ organization_id: orgId, code });
    return { success: !error, message: error ? error.message : 'Removido' };
};

export const fetchMinistryMemberships = async (orgId: string, ministryId: string) => {
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('organization_memberships')
        .select(`
            profile_id,
            role,
            profiles (id, name, email, avatar_url)
        `)
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId);

    if (error) return [];

    return (data || []).map((row: any) => ({
        profileId: row.profile_id,
        role: row.role,
        name: row.profiles?.name || 'Usuário Desconhecido',
        email: row.profiles?.email || '',
        avatar: row.profiles?.avatar_url
    }));
};

export const removeUserFromMinistry = async (orgId: string, profileId: string, ministryId: string): Promise<{ success: boolean, message: string }> => {
    if (!supabase) return { success: false, message: "Offline" };

    try {
        const { error } = await supabase
            .from('organization_memberships')
            .delete()
            .match({ 
                organization_id: orgId, 
                ministry_id: ministryId, 
                profile_id: profileId 
            });

        if (error) throw error;

        return { success: true, message: "Usuário desvinculado com sucesso." };
    } catch (err: any) {
        console.error("Erro ao remover vínculo:", err);
        return { success: false, message: err.message };
    }
};

export const toggleAdminSQL = async (email: string, status: boolean, ministryId: string) => {
    if (!supabase) return;
    await supabase.from('profiles').update({ is_admin: status }).eq('email', email);
};

export const deleteMember = async (ministryId: string, id: string, name: string) => {
    if (!supabase) return;
    // Stub implementation
};
