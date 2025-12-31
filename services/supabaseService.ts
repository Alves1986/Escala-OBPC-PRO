
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  MinistryDef, 
  MinistrySettings, 
  CustomEvent, 
  SwapRequest, 
  RepertoireItem, 
  Organization, 
  Announcement, 
  AppNotification, 
  AuditLogEntry, 
  RankingEntry,
  TeamMemberProfile,
  MemberMap
} from '../types';

// Environment Variables
let supabaseUrl = "";
let supabaseKey = "";

try {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
    // @ts-ignore
    supabaseKey = import.meta.env.VITE_SUPABASE_KEY || "";
  }
} catch (e) {}

// Fallback to process.env or global defines
if (!supabaseUrl && typeof process !== 'undefined' && process.env) {
    supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    supabaseKey = process.env.VITE_SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
}

// Fallback to defines from vite.config
// @ts-ignore
if (!supabaseUrl && typeof __SUPABASE_URL__ !== 'undefined') {
    // @ts-ignore
    supabaseUrl = __SUPABASE_URL__;
}
// @ts-ignore
if (!supabaseKey && typeof __SUPABASE_KEY__ !== 'undefined') {
    // @ts-ignore
    supabaseKey = __SUPABASE_KEY__;
}

export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_KEY = supabaseKey;

// Initialize Client
let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
  });
}

export const getSupabase = () => supabase;

// --- AUTHENTICATION ---

export const loginWithEmail = async (email: string, password: string) => {
  if (!supabase) return { success: false, message: "Banco de dados não conectado." };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { success: false, message: error.message };
  return { success: true, user: data.user };
};

export const loginWithGoogle = async () => {
  if (!supabase) return { success: false, message: "Banco de dados não conectado." };
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });
  if (error) return { success: false, message: error.message };
  return { success: true, data };
};

export const registerWithEmail = async (email: string, password: string, name: string, ministries: string[], organizationId?: string, roles?: string[]) => {
  if (!supabase) return { success: false, message: "Banco de dados não conectado." };
  
  // 1. Sign Up
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name }
    }
  });

  if (error) return { success: false, message: error.message };
  if (!data.user) return { success: false, message: "Erro ao criar usuário." };

  // 2. Create Profile
  const mainMinistry = ministries.length > 0 ? ministries[0] : null;
  const orgId = organizationId || '00000000-0000-0000-0000-000000000000'; // Default Org

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: data.user.id,
      email,
      name,
      ministry_id: mainMinistry,
      allowed_ministries: ministries,
      organization_id: orgId,
      role: 'member',
      functions: roles || []
    });

  if (profileError) console.error("Error creating profile:", profileError);

  return { success: true, message: "Cadastro realizado! Verifique seu e-mail." };
};

export const logout = async () => {
  if (!supabase) return;
  await supabase.auth.signOut();
};

export const sendPasswordResetEmail = async (email: string) => {
  if (!supabase) return { success: false, message: "Sem conexão." };
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/reset-password',
  });
  if (error) return { success: false, message: error.message };
  return { success: true, message: "Link de recuperação enviado!" };
};

// --- USER & PROFILE ---

export const fetchUserAllowedMinistries = async (userId: string, orgId: string): Promise<string[]> => {
    if (!supabase) return [];
    
    // 1. Check user profile for overrides
    const { data: profile } = await supabase
        .from('profiles')
        .select('allowed_ministries')
        .eq('id', userId)
        .single();
    
    if (profile && profile.allowed_ministries && profile.allowed_ministries.length > 0) {
        return profile.allowed_ministries;
    }

    // 2. Fallback: Fetch all ministries from organization
    const { data: ministries } = await supabase
        .from('organization_ministries')
        .select('code')
        .eq('organization_id', orgId);
        
    return ministries ? ministries.map((m: any) => m.code) : [];
};

export const updateUserProfile = async (name: string, whatsapp: string, avatar_url?: string, functions?: string[], birthDate?: string, ministryId?: string) => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const updates: any = {
        name,
        whatsapp,
        updated_at: new Date().toISOString(),
    };

    if (avatar_url) updates.avatar_url = avatar_url;
    if (functions) updates.functions = functions;
    if (birthDate) updates.birth_date = birthDate;
    if (ministryId) updates.ministry_id = ministryId;

    await supabase.from('profiles').update(updates).eq('id', user.id);
};

export const updateProfileMinistry = async (userId: string, ministryId: string) => {
    if (!supabase) return;
    await supabase.from('profiles').update({ ministry_id: ministryId }).eq('id', userId);
};

export const toggleAdminSQL = async (email: string, status: boolean, ministryId: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('profiles').update({ is_admin: status }).eq('email', email);
    if (error) {
        await supabase.functions.invoke('push-notification', {
            body: { action: 'toggle_admin', targetEmail: email, status, ministryId }
        });
    }
};

export const deleteMember = async (ministryId: string, memberId: string, name: string) => {
    if (!supabase) return;
    await supabase.functions.invoke('push-notification', {
        body: { action: 'delete_member', memberId, ministryId, name }
    });
};

export const joinMinistry = async (ministryId: string, roles: string[]) => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from('profiles').select('allowed_ministries, functions').eq('id', user.id).single();
    if (!profile) return;

    const currentMinistries = profile.allowed_ministries || [];
    if (!currentMinistries.includes(ministryId)) {
        const newMinistries = [...currentMinistries, ministryId];
        const currentFunctions = profile.functions || [];
        const newFunctions = Array.from(new Set([...currentFunctions, ...roles]));
        
        await supabase.from('profiles').update({
            allowed_ministries: newMinistries,
            functions: newFunctions,
            ministry_id: ministryId
        }).eq('id', user.id);
    }
};

// --- MINISTRIES & SETTINGS ---

export const fetchOrganizationMinistries = async (organizationId: string): Promise<MinistryDef[]> => {
    if (!supabase) return [];
    
    const { data, error } = await supabase
        .from('organization_ministries')
        .select('*')
        .eq('organization_id', organizationId);

    if (error) return [];

    return data.map((m: any) => ({
        id: m.code,
        code: m.code,
        label: m.label,
        enabledTabs: m.enabled_tabs || [],
        organizationId: m.organization_id
    }));
};

export const fetchMinistrySettings = async (ministryId: string): Promise<MinistrySettings | null> => {
    if (!supabase) return null;
    const { data } = await supabase
        .from('ministry_settings')
        .select('*')
        .eq('ministry_id', ministryId)
        .single();
        
    if (data) {
        return {
            displayName: data.display_name,
            roles: data.roles,
            availabilityStart: data.availability_start,
            availabilityEnd: data.availability_end,
            spotifyClientId: data.spotify_client_id,
            spotifyClientSecret: data.spotify_client_secret
        };
    }
    return null;
};

export const saveMinistrySettings = async (ministryId: string, displayName?: string, roles?: string[], start?: string, end?: string) => {
    if (!supabase) return;
    
    const updates: any = {};
    if (displayName !== undefined) updates.display_name = displayName;
    if (roles !== undefined) updates.roles = roles;
    if (start !== undefined) updates.availability_start = start;
    if (end !== undefined) updates.availability_end = end;

    const { data } = await supabase.from('ministry_settings').select('id').eq('ministry_id', ministryId).single();
    
    if (data) {
        await supabase.from('ministry_settings').update(updates).eq('ministry_id', ministryId);
    } else {
        await supabase.from('ministry_settings').insert({ ministry_id: ministryId, ...updates });
    }
};

// --- SCHEDULE & EVENTS ---

export const fetchMinistrySchedule = async (ministryId: string, month: string) => {
    if (!supabase) return { events: [], schedule: {}, attendance: {} };

    const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .eq('ministry_id', ministryId)
        .like('date_time', `${month}%`)
        .order('date_time');

    const events = (eventsData || []).map((e: any) => ({
        id: e.id,
        iso: e.date_time,
        title: e.title,
        dateDisplay: new Date(e.date_time).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    }));

    const { data: assignments } = await supabase
        .from('schedule_assignments')
        .select(`event_id, role, confirmed, member:profiles ( name )`)
        .eq('ministry_id', ministryId)
        .in('event_id', events.map(e => e.id));

    const schedule: Record<string, string> = {};
    const attendance: Record<string, boolean> = {};

    assignments?.forEach((a: any) => {
        const evt = events.find(e => e.id === a.event_id);
        if (evt && a.member?.name) {
            const key = `${evt.iso}_${a.role}`;
            schedule[key] = a.member.name;
            if (a.confirmed) attendance[key] = true;
        }
    });

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
    await supabase.from('events').update({ title: newTitle, date_time: newIso })
        .eq('ministry_id', ministryId)
        .eq('date_time', oldIso);
};

export const deleteMinistryEvent = async (ministryId: string, iso: string) => {
    if (!supabase) return;
    await supabase.from('events').delete()
        .eq('ministry_id', ministryId)
        .eq('date_time', iso);
};

export const saveScheduleAssignment = async (ministryId: string, key: string, memberName: string) => {
    if (!supabase) return false;
    
    const [iso, ...roleParts] = key.split('_');
    const role = roleParts.join('_');

    const { data: event } = await supabase
        .from('events')
        .select('id')
        .eq('ministry_id', ministryId)
        .eq('date_time', iso)
        .single();

    if (!event) return false;

    let memberId = null;
    if (memberName) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('name', memberName)
            .single();
        if (!profile) return false;
        memberId = profile.id;
    }

    if (memberId) {
        await supabase.from('schedule_assignments').delete().eq('event_id', event.id).eq('role', role);
        await supabase.from('schedule_assignments').insert({
            ministry_id: ministryId,
            event_id: event.id,
            member_id: memberId,
            role: role,
            confirmed: false
        });
        const { data: { user } } = await supabase.auth.getUser();
        await logAction(ministryId, "Edited Schedule", `Assigned ${memberName} to ${role} on ${new Date(iso).toLocaleDateString()}`, user?.email || "System");
    } else {
        await supabase.from('schedule_assignments').delete().eq('event_id', event.id).eq('role', role);
    }
    return true;
};

export const toggleAssignmentConfirmation = async (ministryId: string, key: string) => {
    if (!supabase) return;
    
    const [iso, ...roleParts] = key.split('_');
    const role = roleParts.join('_');

    const { data: event } = await supabase.from('events').select('id').eq('ministry_id', ministryId).eq('date_time', iso).single();
    if (!event) return;

    const { data: assignment } = await supabase
        .from('schedule_assignments')
        .select('id, confirmed')
        .eq('event_id', event.id)
        .eq('role', role)
        .single();

    if (assignment) {
        await supabase.from('schedule_assignments')
            .update({ confirmed: !assignment.confirmed })
            .eq('id', assignment.id);
    }
};

export const clearScheduleForMonth = async (ministryId: string, month: string) => {
    if (!supabase) return;
    const { data: events } = await supabase.from('events').select('id').eq('ministry_id', ministryId).like('date_time', `${month}%`);
    if (events && events.length > 0) {
        const ids = events.map((e: any) => e.id);
        await supabase.from('schedule_assignments').delete().in('event_id', ids);
    }
};

export const resetToDefaultEvents = async (ministryId: string, month: string) => {
    if (!supabase) return;
    // Placeholder
};

// --- MEMBERS & AVAILABILITY ---

export const fetchMinistryMembers = async (ministryId: string) => {
    if (!supabase) return { memberMap: {}, publicList: [] };

    const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .or(`ministry_id.eq.${ministryId},allowed_ministries.cs.{${ministryId}}`);

    const memberMap: MemberMap = {};
    const publicList: TeamMemberProfile[] = [];

    profiles?.forEach((p: any) => {
        publicList.push({
            id: p.id,
            name: p.name,
            email: p.email,
            avatar_url: p.avatar_url,
            whatsapp: p.whatsapp,
            birthDate: p.birth_date,
            roles: p.functions || [],
            isAdmin: p.is_admin,
            createdAt: p.created_at,
            organizationId: p.organization_id
        });

        (p.functions || []).forEach((role: string) => {
            if (!memberMap[role]) memberMap[role] = [];
            memberMap[role].push(p.name);
        });
        if (!memberMap['Membro']) memberMap['Membro'] = [];
        memberMap['Membro'].push(p.name);
    });

    return { memberMap, publicList };
};

export const fetchMinistryAvailability = async (ministryId: string) => {
    if (!supabase) return { availability: {}, notes: {} };

    const { data } = await supabase
        .from('availability')
        .select('member:profiles(name), dates, notes, month')
        .eq('ministry_id', ministryId);

    const availability: Record<string, string[]> = {};
    const notes: Record<string, string> = {};

    data?.forEach((row: any) => {
        const name = row.member?.name;
        if (name) {
            availability[name] = [...(availability[name] || []), ...(row.dates || [])];
            if (row.notes) Object.assign(notes, row.notes);
        }
    });

    return { availability, notes };
};

export const saveMemberAvailability = async (
  ministryId: string,
  memberId: string,
  dates: string[],
  notes: Record<string, string>,
  targetMonth: string
) => {
  if (!supabase) return { error: { message: "Sem conexão com banco de dados." } };

  try {
    // 1. Busca organization_id do perfil e valida ID
    let targetId = memberId;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);
    
    if (!isUUID) {
       const { data: p } = await supabase.from('profiles').select('id').eq('name', memberId).maybeSingle();
       if (p) targetId = p.id;
       else return { error: { message: "Membro não encontrado." } };
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', targetId)
      .single();

    if (profileError || !profile) throw new Error(`Membro ID "${memberId}" não encontrado.`);

    // 2. Prepara os dados limpos
    const monthDates = dates.filter(d => d.startsWith(targetMonth));
    const monthNotes: Record<string, string> = {};
    Object.entries(notes).forEach(([key, val]) => {
      if (key.startsWith(targetMonth) && val && val.trim() !== "") {
        monthNotes[key] = val;
      }
    });

    const orgId = profile.organization_id || '00000000-0000-0000-0000-000000000000';

    // 3. Verifica se JÁ EXISTE um registro para este membro neste mês/ministério
    const { data: existingRecord, error: fetchError } = await supabase
      .from('availability')
      .select('id')
      .eq('member_id', targetId)
      .eq('ministry_id', ministryId)
      .eq('month', targetMonth)
      .maybeSingle();

    if (fetchError) throw fetchError;

    let error;

    if (existingRecord) {
      // ATUALIZA (UPDATE) se já existe
      const { error: updateError } = await supabase
        .from('availability')
        .update({
          dates: monthDates,
          notes: monthNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingRecord.id);
      error = updateError;
    } else {
      // INSERE (INSERT) se não existe
      const { error: insertError } = await supabase
        .from('availability')
        .insert({
          member_id: targetId,
          ministry_id: ministryId,
          month: targetMonth,
          dates: monthDates,
          notes: monthNotes,
          organization_id: orgId
        });
      error = insertError;
    }

    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    console.error("CRITICAL SAVE ERROR:", err);
    return { error: { message: err.message || "Falha ao salvar disponibilidade." } };
  }
};

// --- NOTIFICATIONS & ANNOUNCEMENTS ---

export const fetchNotificationsSQL = async (ministryIds: string[], userId: string) => {
    if (!supabase) return [];
    const { data } = await supabase
        .from('notifications')
        .select('*')
        .in('ministry_id', ministryIds)
        .order('created_at', { ascending: false })
        .limit(20);

    return (data || []).map((n: any) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        timestamp: n.created_at,
        read: false, 
        actionLink: n.action_link,
        ministryId: n.ministry_id
    }));
};

export const sendNotificationSQL = async (ministryId: string, notification: { title: string, message: string, type: string, actionLink?: string }) => {
    if (!supabase) return;
    await supabase.from('notifications').insert({
        ministry_id: ministryId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        action_link: notification.actionLink
    });
    await supabase.functions.invoke('push-notification', {
        body: { ministryId, title: notification.title, message: notification.message, type: notification.type, actionLink: notification.actionLink }
    });
};

export const markNotificationsReadSQL = async (notificationIds: string[], userId: string) => {
    // Placeholder
};

export const clearAllNotificationsSQL = async (ministryId: string) => {
    if (!supabase) return;
    await supabase.from('notifications').delete().eq('ministry_id', ministryId);
};

export const fetchAnnouncementsSQL = async (ministryId: string) => {
    if (!supabase) return [];
    const { data } = await supabase
        .from('announcements')
        .select(`*, read_by:announcement_reads(user_id, timestamp, profile:profiles(name)), liked_by:announcement_likes(user_id, timestamp, profile:profiles(name))`)
        .eq('ministry_id', ministryId)
        .gte('expiration_date', new Date().toISOString())
        .order('created_at', { ascending: false });

    return (data || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        message: a.message,
        type: a.type,
        timestamp: a.created_at,
        author: a.author_name || 'Admin',
        readBy: a.read_by.map((r: any) => ({ userId: r.user_id, name: r.profile?.name, timestamp: r.timestamp })),
        likedBy: a.liked_by.map((l: any) => ({ userId: l.user_id, name: l.profile?.name, timestamp: l.timestamp })),
        ministryId: a.ministry_id
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
        author_name: authorName
    });
};

export const interactAnnouncementSQL = async (id: string, userId: string, userName: string, action: 'read' | 'like') => {
    if (!supabase) return;
    const table = action === 'read' ? 'announcement_reads' : 'announcement_likes';
    const { data } = await supabase.from(table).select('id').eq('announcement_id', id).eq('user_id', userId).single();
    if (!data) {
        await supabase.from(table).insert({ announcement_id: id, user_id: userId });
        if (action === 'like') await addPoints(userId, 10, 'announcement_like', 'midia');
        if (action === 'read') await addPoints(userId, 5, 'announcement_read', 'midia');
    } else if (action === 'like') {
        await supabase.from(table).delete().eq('id', data.id);
    }
};

// --- SWAPS & REPERTOIRE ---

export const fetchSwapRequests = async (ministryId: string): Promise<SwapRequest[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('swap_requests').select('*').eq('ministry_id', ministryId).neq('status', 'cancelled');
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
    if (request.requesterId) await addPoints(request.requesterId, -50, 'swap_penalty', ministryId);
};

export const cancelSwapRequestSQL = async (id: string) => {
    if (!supabase) return;
    await supabase.from('swap_requests').update({ status: 'cancelled' }).eq('id', id);
};

export const performSwapSQL = async (ministryId: string, reqId: string, takerName: string, takerId: string) => {
    if (!supabase) return;
    const { data: req } = await supabase.from('swap_requests').select('*').eq('id', reqId).single();
    if (!req) return;
    const { data: event } = await supabase.from('events').select('id').eq('ministry_id', ministryId).eq('date_time', req.event_iso).single();
    if (event) {
        await supabase.from('schedule_assignments').update({ member_id: takerId }).eq('event_id', event.id).eq('member_id', req.requester_id);
        await supabase.from('swap_requests').update({ status: 'completed', taken_by_name: takerName }).eq('id', reqId);
    }
};

export const fetchRepertoire = async (ministryId: string): Promise<RepertoireItem[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('repertoire').select('*').eq('ministry_id', ministryId).order('date', { ascending: false });
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

// --- MISC ---

export const fetchGlobalSchedules = async (month: string, currentMinistryId: string) => {
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

const logAction = async (ministryId: string, action: string, details: string, author: string) => {
    if (!supabase) return;
    await supabase.from('audit_logs').insert({ ministry_id: ministryId, action, details, author });
};

export const fetchRankingData = async (ministryId: string): Promise<RankingEntry[]> => {
    if (!supabase) return [];
    const { memberMap, publicList } = await fetchMinistryMembers(ministryId);
    return publicList.map(p => ({
        memberId: p.id,
        name: p.name,
        avatar_url: p.avatar_url,
        points: 0,
        stats: { confirmedEvents: 0, missedEvents: 0, swapsRequested: 0, announcementsRead: 0, announcementsLiked: 0 },
        history: []
    }));
};

const addPoints = async (userId: string, points: number, type: string, ministryId: string) => {
    // Points implementation
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
        createdAt: o.created_at,
        userCount: 0,
        ministryCount: 0
    }));
};

export const saveOrganization = async (id: string | null, name: string, slug: string) => {
    if (!supabase) return { success: false, message: "No db" };
    if (id) await supabase.from('organizations').update({ name, slug }).eq('id', id);
    else await supabase.from('organizations').insert({ name, slug });
    return { success: true, message: "Salvo" };
};

export const toggleOrganizationStatus = async (id: string, active: boolean) => {
    if (!supabase) return false;
    await supabase.from('organizations').update({ active }).eq('id', id);
    return true;
};

export const saveOrganizationMinistry = async (orgId: string, code: string, label: string) => {
    if (!supabase) return { success: false, message: "No db" };
    await supabase.from('organization_ministries').upsert({ organization_id: orgId, code, label });
    return { success: true, message: "Ministério salvo" };
};

export const deleteOrganizationMinistry = async (orgId: string, code: string) => {
    if (!supabase) return { success: false, message: "No db" };
    await supabase.from('organization_ministries').delete().eq('organization_id', orgId).eq('code', code);
    return { success: true, message: "Ministério removido" };
};
