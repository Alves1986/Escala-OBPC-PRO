import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  MinistrySettings, 
  RepertoireItem, 
  SwapRequest, 
  AppNotification, 
  Announcement, 
  MinistryDef,
  TeamMemberProfile,
  RankingEntry,
  RankingHistoryItem,
  CustomEvent,
  Organization
} from '../types';

// --- INITIALIZATION ---

let serviceOrgId: string | null = null;

let envUrl = "";
let envKey = "";

try {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    envUrl = import.meta.env.VITE_SUPABASE_URL || "";
    envKey = import.meta.env.VITE_SUPABASE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "";
  }
} catch (e) {
  console.warn("[SupabaseService] Falha ao ler import.meta.env. Usando fallback se disponível.");
}

if (!envUrl && typeof process !== 'undefined' && process.env) {
    envUrl = process.env.VITE_SUPABASE_URL || "";
    envKey = process.env.VITE_SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
}

const supabase = (envUrl && envKey) 
  ? createClient(envUrl, envKey, {
      auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
      }
  }) 
  : null;

if (!supabase) {
    console.error("[SupabaseService] CRITICAL: Client não inicializado. Verifique VITE_SUPABASE_URL e VITE_SUPABASE_KEY.");
}

export const getSupabase = () => supabase;

// --- HELPERS ---

const filterRolesBySettings = async (roles: string[], ministryId: string, orgId: string): Promise<string[]> => {
    const sb = getSupabase();
    if (!sb) return roles;

    if (!roles || roles.length === 0) return [];

    const { data: settings } = await sb.from('ministry_settings')
        .select('roles')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId)
        .maybeSingle();

    const dbRoles = settings?.roles;

    if (!dbRoles || !Array.isArray(dbRoles) || dbRoles.length === 0) {
        return roles;
    }

    return roles.filter(r => dbRoles.includes(r));
};

export const setServiceOrgContext = (id: string) => { serviceOrgId = id; };
export const clearServiceOrgContext = () => { serviceOrgId = null; };
export const configureSupabaseManual = (url: string, key: string) => { console.warn("Manual config disabled."); };
export const validateConnection = async (url: string, key: string) => { return false; };

// --- CORE FUNCTIONS ---

export const fetchOrganizationDetails = async (orgId: string): Promise<Organization | null> => {
    const sb = getSupabase();
    if (!sb || !orgId) return null;

    const { data, error } = await sb
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single();

    if (error) {
        console.error("Error fetching organization details:", error);
        return null;
    }
    return data;
};

export const fetchOrganizationMinistries = async (orgId?: string): Promise<MinistryDef[]> => {
    const sb = getSupabase();
    if (!sb || !orgId) return [];

    const { data, error } = await sb
        .from('organization_ministries')
        .select('id, code, label') 
        .eq('organization_id', orgId);

    if (error) {
        throw error;
    }

    return (data || []).map((m: any) => ({
        id: m.id,
        code: m.code || m.id,
        label: m.label || 'Sem nome', 
        organizationId: orgId
    }));
};

export const fetchUserAllowedMinistries = async (userId: string, orgId?: string): Promise<string[]> => {
    const sb = getSupabase();
    if (!sb || !orgId) return [];
    
    const { data: members, error } = await sb.from('organization_memberships')
        .select('ministry_id')
        .eq('profile_id', userId)
        .eq('organization_id', orgId);
        
    if (error) throw error;
    if (!members || members.length === 0) return [];

    const ministryIds = members.map((m: any) => m.ministry_id);

    const { data: validMinistries } = await sb.from('organization_ministries')
        .select('id')
        .eq('organization_id', orgId)
        .in('id', ministryIds);

    return validMinistries?.map((m: any) => m.id) || [];
};

export const fetchMinistrySettings = async (ministryId: string, orgId?: string): Promise<MinistrySettings | null> => {
    const sb = getSupabase();
    if (!sb || !ministryId || !orgId) return null;

    const { data: ministryDef } = await sb.from('organization_ministries')
        .select('label, availability_start, availability_end') 
        .eq('id', ministryId)
        .eq('organization_id', orgId)
        .maybeSingle();

    const { data: settings } = await sb.from('ministry_settings')
        .select('*')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId)
        .maybeSingle();
    
    const result = {
        id: settings?.id,
        organizationMinistryId: ministryId, 
        displayName: ministryDef?.label || settings?.display_name || 'Ministério',
        roles: settings?.roles || [],
        availabilityStart: ministryDef?.availability_start,
        availabilityEnd: ministryDef?.availability_end,
        organizationId: orgId,
        spotifyClientId: settings?.spotify_client_id,
        spotifyClientSecret: settings?.spotify_client_secret
    };

    return result;
};

export const fetchScheduleAssignments = async (ministryId: string, month: string, orgId?: string) => {
    const sb = getSupabase();
    if (!sb || !orgId) throw new Error("Missing dependencies");

    const { data: assignments, error } = await sb.from('schedule_assignments')
        .select('*, profiles(name)')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId);

    if (error) throw error;

    const schedule: any = {};
    const attendance: any = {};

    assignments?.forEach((a: any) => {
        const ruleId = a.event_key;
        const dateStr = a.event_date;
        
        if (ruleId && dateStr) {
            const key = `${ruleId}_${dateStr}_${a.role}`;
            const profile = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
            const name = profile?.name;

            if (name) schedule[key] = name;
            if (a.confirmed) attendance[key] = true;
        }
    });

    return { schedule, attendance };
};

export const fetchMinistryMembers = async (ministryId: string, orgId?: string) => {
  const sb = getSupabase();
  if (!sb || !orgId) return { memberMap: {}, publicList: [] };

  const { data: memberships, error } = await sb
    .from('organization_memberships')
    .select(`profile_id, functions, role, profiles (id, name, email, avatar_url, whatsapp, birth_date, is_admin)`)
    .eq('ministry_id', ministryId)
    .eq('organization_id', orgId);

  if (error) throw error;

  const memberMap: Record<string, string[]> = {};
  const publicList: TeamMemberProfile[] = [];

  memberships?.forEach((m: any) => {
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
      organizationId: orgId
    });

    rawFunctions.forEach((fn: string) => {
      if (!memberMap[fn]) memberMap[fn] = [];
      memberMap[fn].push(p.name);
    });
  });

  return { memberMap, publicList };
};

// --- ANNOUNCEMENTS LOGIC (HARDENED) ---

export const fetchAnnouncementsSQL = async (ministryId: string, orgId?: string) => {
    const sb = getSupabase();
    if (!sb || !orgId) throw new Error("Missing dependencies");

    const now = new Date().toISOString();

    const { data: announcements, error } = await sb.from('announcements')
        .select('*')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId)
        .or(`expiration_date.is.null,expiration_date.gte.${now}`)
        .order('created_at', { ascending: false });

    if (error) throw error;

    if (!announcements || announcements.length === 0) return [];

    const announcementIds = announcements.map((a: any) => a.id);
    
    // HARDENING: Tenant isolation for interactions
    const { data: interactions, error: intError } = await sb.from('announcement_interactions')
        .select('announcement_id, user_id, interaction_type, created_at, profiles(name)')
        .in('announcement_id', announcementIds)
        .eq('organization_id', orgId);

    if (intError) {
        console.log('ANN FETCH INTERACTIONS', 0);
        throw intError;
    }

    console.log('ANN FETCH INTERACTIONS', interactions?.length ?? 0);

    return announcements.map((a: any) => {
        const myInteractions = interactions ? interactions.filter((i: any) => i.announcement_id === a.id) : [];
        
        return {
            id: a.id,
            title: a.title,
            message: a.message,
            type: a.type,
            timestamp: a.created_at,
            expirationDate: a.expiration_date,
            author: a.author_name || 'Admin',
            readBy: myInteractions
                .filter((i: any) => i.interaction_type === 'read')
                .map((i: any) => ({
                    userId: i.user_id,
                    name: i.profiles?.name || 'Usuário',
                    timestamp: i.created_at
                })),
            likedBy: myInteractions
                .filter((i: any) => i.interaction_type === 'like')
                .map((i: any) => ({
                    userId: i.user_id,
                    name: i.profiles?.name || 'Usuário',
                    timestamp: i.created_at
                }))
        };
    });
};

export const interactAnnouncementSQL = async (id: string, userId: string, userName: string, action: 'read'|'like', orgId: string) => {
    const sb = getSupabase();
    if (!sb) throw new Error("No Supabase client");

    // Fetch context to get ministry_id
    const { data: announcement, error: annError } = await sb.from('announcements')
        .select('ministry_id')
        .eq('id', id)
        .eq('organization_id', orgId)
        .single();

    if (annError || !announcement) throw new Error("Announcement not found");
    const ministryId = announcement.ministry_id;

    // Validate Profile
    const { data: profile } = await sb.from('profiles').select('id').eq('id', userId).maybeSingle();
    if (!profile) {
        await sb.from('profiles').upsert({ 
            id: userId, 
            name: userName, 
            organization_id: orgId 
        }, { onConflict: 'id', ignoreDuplicates: true });
    }

    if (action === 'like') {
        const { data: existing, error: checkError } = await sb.from('announcement_interactions')
            .select('id')
            .eq('announcement_id', id)
            .eq('user_id', userId)
            .eq('organization_id', orgId)
            .eq('interaction_type', 'like')
            .maybeSingle();

        if (checkError) throw checkError;

        if (existing) {
            console.log('ANN LIKE WRITE', {
                announcement_id: id,
                user_id: userId,
                organization_id: orgId,
                interaction_type: 'like',
                action: 'delete'
            });
            const { error: delError } = await sb.from('announcement_interactions')
                .delete()
                .eq('announcement_id', id)
                .eq('user_id', userId)
                .eq('organization_id', orgId)
                .eq('interaction_type', 'like');
            if (delError) throw delError;
        } else {
            console.log('ANN LIKE WRITE', {
                announcement_id: id,
                user_id: userId,
                organization_id: orgId,
                ministry_id: ministryId,
                interaction_type: 'like',
                action: 'insert'
            });
            const { error: insertError } = await sb.from('announcement_interactions').insert({
                announcement_id: id,
                user_id: userId,
                organization_id: orgId,
                ministry_id: ministryId,
                interaction_type: 'like'
            });
            if (insertError) throw insertError;
        }
    } else {
        console.log('ANN READ WRITE', {
            announcement_id: id,
            user_id: userId,
            organization_id: orgId,
            ministry_id: ministryId,
            interaction_type: 'read'
        });
        const { error: upsertError } = await sb.from('announcement_interactions').upsert({
            announcement_id: id,
            user_id: userId,
            organization_id: orgId,
            ministry_id: ministryId,
            interaction_type: 'read'
        }, {
            onConflict: 'announcement_id,user_id,organization_id,interaction_type'
        });
        if (upsertError) throw upsertError;
    }
};

// --- RANKING LOGIC (HARDENED) ---

export const fetchRankingData = async (ministryId: string, orgId?: string): Promise<RankingEntry[]> => {
    const sb = getSupabase();
    if (!sb || !orgId) throw new Error("Missing dependencies");
    
    const { data: memberships } = await sb.from('organization_memberships')
        .select('profile_id')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId);

    if (!memberships || memberships.length === 0) return [];
    const userIds = memberships.map((m: any) => m.profile_id);

    const { data: members } = await sb.from('profiles')
        .select('id, name, avatar_url')
        .in('id', userIds)
        .eq('organization_id', orgId);
        
    const today = new Date().toISOString().slice(0, 10);

    const [assignmentsRes, swapsRes, interactionsRes] = await Promise.all([
        sb.from('schedule_assignments').select('member_id, event_date, role').eq('organization_id', orgId).eq('ministry_id', ministryId).eq('confirmed', true).lte('event_date', today),
        sb.from('swap_requests').select('requester_id, created_at').eq('organization_id', orgId).eq('ministry_id', ministryId),
        sb.from('announcement_interactions').select('user_id, interaction_type, created_at').eq('organization_id', orgId).in('user_id', userIds)
    ]) as any;

    const assignments = assignmentsRes.data || [];
    const swaps = swapsRes.data || [];
    const interactions = interactionsRes.data || [];

    return (members || []).map((m: any) => {
        let points = 0;
        const history: RankingHistoryItem[] = [];

        const memberAssignments = assignments.filter((a: any) => a.member_id === m.id);
        points += memberAssignments.length * 100;
        memberAssignments.forEach((a: any) => history.push({ id: `assign-${a.member_id}-${a.event_date}`, date: a.event_date, description: `Escala Confirmada: ${a.role}`, points: 100, type: 'assignment' }));

        const memberSwaps = swaps.filter((s: any) => s.requester_id === m.id);
        points -= memberSwaps.length * 50;
        memberSwaps.forEach((s: any) => history.push({ id: `swap-${s.requester_id}-${s.created_at}`, date: s.created_at, description: `Solicitou Troca`, points: -50, type: 'swap_penalty' }));

        const memberReads = interactions.filter((i: any) => i.user_id === m.id && i.interaction_type === 'read');
        points += memberReads.length * 5;

        const memberLikes = interactions.filter((i: any) => i.user_id === m.id && i.interaction_type === 'like');
        points += memberLikes.length * 10;

        if (points < 0) points = 0;
        history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return {
            memberId: m.id,
            name: m.name,
            avatar_url: m.avatar_url,
            points, 
            stats: { 
                confirmedEvents: memberAssignments.length, 
                missedEvents: 0, 
                swapsRequested: memberSwaps.length, 
                announcementsRead: memberReads.length, 
                announcementsLiked: memberLikes.length 
            },
            history
        };
    });
};

export const fetchUserFunctions = async (userId: string, ministryId: string, orgId?: string): Promise<string[]> => {
  const sb = getSupabase();
  if (!sb || !orgId) return [];

  const { data } = await sb
    .from('organization_memberships')
    .select('functions')
    .eq('profile_id', userId)
    .eq('ministry_id', ministryId)
    .eq('organization_id', orgId)
    .maybeSingle();

  return (data && Array.isArray(data.functions)) ? data.functions : [];
};

export const fetchOrganizationsWithStats = async () => {
    const sb = getSupabase();
    if (!sb) return [];
    const { data, error } = await sb.from('organizations').select(`*, organization_ministries (id, code, label), profiles (count)`);
    if (error) throw error;
    return (data || []).map((o: any) => ({
        id: o.id, name: o.name, slug: o.slug, active: o.active, createdAt: o.created_at,
        userCount: o.profiles?.[0]?.count || 0,
        ministryCount: o.organization_ministries?.length || 0,
        ministries: o.organization_ministries?.map((m:any) => ({ id: m.id, code: m.code, label: m.label })) || [],
        // Billing
        plan_type: o.plan_type,
        billing_status: o.billing_status,
        trial_ends_at: o.trial_ends_at,
        access_locked: o.access_locked,
        checkout_url: o.checkout_url
    }));
};

export const saveOrganization = async (id: string | null, name: string, slug: string, billing?: any) => {
    const sb = getSupabase();
    if (!sb) return { success: false, message: "Sem conexão" };
    
    const payload: any = { name, slug };
    if (billing) {
        if(billing.plan_type) payload.plan_type = billing.plan_type;
        if(billing.billing_status) payload.billing_status = billing.billing_status;
        if(billing.trial_ends_at) payload.trial_ends_at = billing.trial_ends_at;
        if(billing.checkout_url) payload.checkout_url = billing.checkout_url;
        if(billing.access_locked !== undefined) payload.access_locked = billing.access_locked;
    }

    if (id) {
        const { error } = await sb.from('organizations').update(payload).eq('id', id);
        return error ? { success: false, message: error.message } : { success: true, message: "Atualizado" };
    } else {
        const { error } = await sb.from('organizations').insert(payload);
        return error ? { success: false, message: error.message } : { success: true, message: "Criado" };
    }
};

export const toggleOrganizationStatus = async (id: string, active: boolean) => {
    const sb = getSupabase();
    if (!sb) return false;
    // FIX: Send new status
    const { error } = await sb.from('organizations').update({ active }).eq('id', id);
    return !error;
};

export const saveOrganizationMinistry = async (orgId: string, code: string, label: string) => {
    const sb = getSupabase();
    if (!sb) return { success: false, message: "Sem conexão" };
    const { error } = await sb.from('organization_ministries').upsert({ organization_id: orgId, code, label }, { onConflict: 'organization_id, code' });
    return error ? { success: false, message: error.message } : { success: true, message: "Salvo" };
};

export const deleteOrganizationMinistry = async (orgId: string, code: string) => {
    const sb = getSupabase();
    if (!sb) return { success: false, message: "Sem conexão" };
    const { error } = await sb.from('organization_ministries').delete().eq('organization_id', orgId).eq('code', code);
    return error ? { success: false, message: error.message } : { success: true, message: "Removido" };
};

export const loginWithEmail = async (email: string, pass: string) => {
    const sb = getSupabase();
    if (!sb) return { success: false, message: "Erro: Supabase não inicializado." };
    const { data, error } = await (sb.auth as any).signInWithPassword({ email, password: pass });
    if (error) return { success: false, message: error.message };
    return { success: true, data };
};

export const logout = async () => {
    const sb = getSupabase();
    if (sb) await (sb.auth as any).signOut();
};

export const createInviteToken = async (ministryId: string, orgId: string, label?: string) => {
    const sb = getSupabase();
    if (!sb) return { success: false };

    const { data: { user } } = await sb.auth.getUser();

    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const payload = { 
        token, 
        organization_id: orgId, 
        ministry_id: ministryId, 
        created_by: user?.id,
        expires_at: expiresAt.toISOString(), 
        used: false
    };

    const { data, error } = await sb.from('invite_tokens').insert(payload).select();
    
    if (error) return { success: false, message: error.message };
    const url = `${window.location.origin}?invite=${token}`;
    return { success: true, url };
};

export const validateInviteToken = async (token: string) => {
    const sb = getSupabase();
    if (!sb) return { valid: false };

    const now = new Date().toISOString();

    const { data, error } = await sb
        .from('invite_tokens')
        .select('*')
        .eq('token', token)
        .eq('used', false)
        .gt('expires_at', now)
        .maybeSingle();

    if (error || !data) {
        return { valid: false, message: "Convite inválido, expirado ou já utilizado." };
    }

    return { 
        valid: true, 
        data: { 
            ministryId: data.ministry_id, 
            orgId: data.organization_id, 
            token: data.token
        } 
    };
};

export const registerWithInvite = async (token: string, userData: any) => {
    const sb = getSupabase();
    if (!sb) return { success: false };
    
    const { data: invite } = await sb.from('invite_tokens')
        .select('*')
        .eq('token', token)
        .eq('used', false)
        .single();

    if (!invite) return { success: false, message: "Convite inválido ou já usado" };
    
    const { data: authData, error: authError } = await (sb.auth as any).signUp({
        email: userData.email, password: userData.password,
        options: { data: { full_name: userData.name, ministry_id: invite.ministry_id, organization_id: invite.organization_id } }
    });

    if (authError) return { success: false, message: authError.message };
    const userId = authData.user?.id;
    if (!userId) return { success: false, message: "Erro ao criar usuário" };

    // FORCE MEMBER & NO ADMIN
    await sb.from('profiles').update({ 
        name: userData.name, 
        whatsapp: userData.whatsapp, 
        birth_date: userData.birthDate,
        organization_id: invite.organization_id, 
        ministry_id: invite.ministry_id, 
        allowed_ministries: [invite.ministry_id],
        is_admin: false, 
        is_super_admin: false
    }).eq('id', userId);

    await sb.from('organization_memberships').insert({
        organization_id: invite.organization_id, 
        profile_id: userId, 
        ministry_id: invite.ministry_id, 
        role: 'member', 
        functions: userData.roles || []
    });

    await sb.from('invite_tokens').update({ used: true }).eq('token', token);

    return { success: true };
};

// --- EVENT RULES ---

export const createEventRule = async (orgId: string, ruleData: any) => {
    const sb = getSupabase();
    if (!sb) throw new Error("No client");
    const { data, error } = await sb.from('event_rules').insert({
        organization_id: orgId,
        ministry_id: ruleData.ministryId,
        title: ruleData.title,
        type: ruleData.type,
        weekday: ruleData.weekday,
        date: ruleData.date,
        time: ruleData.time,
        active: true
    }).select();
    if (error) throw error;
    return data;
};

export const deleteEventRule = async (orgId: string, ruleId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('event_rules').update({ active: false }).eq('id', ruleId).eq('organization_id', orgId);
};

export const createMinistryEvent = async (ministryId: string, orgId: string, event: any) => {
    return createEventRule(orgId, {
        ministryId,
        title: event.title,
        type: 'single',
        date: event.date,
        time: event.time
    });
};

export const deleteMinistryEvent = async (ministryId: string, orgId: string, eventIso: string) => {
    const sb = getSupabase();
    if (!sb) return;
    const date = eventIso.split('T')[0];
    const time = eventIso.split('T')[1];
    
    const { data: rules } = await sb.from('event_rules')
        .select('id')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .eq('date', date)
        .eq('time', time)
        .eq('type', 'single');
        
    if (rules && rules.length > 0) {
        await deleteEventRule(orgId, rules[0].id);
    }
};

export const updateMinistryEvent = async (ministryId: string, orgId: string, oldIso: string, newTitle: string, newIso: string, applyToAll: boolean) => {
    const sb = getSupabase();
    if (!sb) return;
    
    // Simplification for now, as real implementation needs ruleId passed from UI
};

export const saveScheduleAssignment = async (ministryId: string, orgId: string, eventKey: string, role: string, memberId: string, memberName: string) => {
    const sb = getSupabase();
    if (!sb) return;
    
    let ruleId = eventKey;
    let dateStr = "";
    
    if (eventKey.includes('_20')) {
        const parts = eventKey.split('_');
        ruleId = parts[0];
        dateStr = parts[1];
    }

    if (!dateStr) return;

    const { error } = await sb.from('schedule_assignments').upsert({
        organization_id: orgId,
        ministry_id: ministryId,
        event_key: ruleId,
        event_date: dateStr,
        role: role,
        member_id: memberId,
        confirmed: false
    }, { onConflict: 'organization_id,ministry_id,event_key,event_date,role' });
    
    if (error) throw error;
};

export const removeScheduleAssignment = async (ministryId: string, orgId: string, logicalKey: string) => {
    const sb = getSupabase();
    if (!sb) return;
    
    const parts = logicalKey.split('_');
    if (parts.length < 3) return;
    
    const ruleId = parts[0];
    const dateStr = parts[1];
    const role = parts.slice(2).join('_');
    
    await sb.from('schedule_assignments').delete()
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .eq('event_key', ruleId)
        .eq('event_date', dateStr)
        .eq('role', role);
};

export const toggleAssignmentConfirmation = async (ministryId: string, orgId: string, key: string) => {
    const sb = getSupabase();
    if (!sb) return;
    
    const parts = key.split('_');
    const ruleId = parts[0];
    const dateStr = parts[1];
    const role = parts.slice(2).join('_');

    const { data } = await sb.from('schedule_assignments')
        .select('confirmed')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .eq('event_key', ruleId)
        .eq('event_date', dateStr)
        .eq('role', role)
        .single();
        
    if (data) {
        await sb.from('schedule_assignments')
            .update({ confirmed: !data.confirmed })
            .eq('organization_id', orgId)
            .eq('ministry_id', ministryId)
            .eq('event_key', ruleId)
            .eq('event_date', dateStr)
            .eq('role', role);
    }
};

export const clearScheduleForMonth = async (ministryId: string, orgId: string, month: string) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('schedule_assignments')
        .delete()
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .ilike('event_date', `${month}%`);
};

export const fetchMinistryAvailability = async (ministryId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return { availability: {}, notes: {} };
    
    const { data, error } = await sb.from('availability')
        .select('*')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId);

    console.log('AVAIL FETCH org/min rows', orgId, ministryId, data?.length);
        
    if (error) {
        return { availability: {}, notes: {} };
    }

    const profileIds = (data || [])
        .map((row: any) => row.profile_id ?? row.user_id)
        .filter(Boolean);

    const { data: profiles } = profileIds.length > 0
        ? await sb.from('profiles')
            .select('id, name')
            .eq('organization_id', orgId)
            .in('id', profileIds)
        : { data: [] as any[] };

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.name]));
    
    const availability: any = {};
    const notes: any = {};
    
    data.forEach((row: any) => {
        console.log("AVAIL ROW RAW", row.profile_id, row.dates, typeof row.dates);
        const profileId = row.profile_id ?? row.user_id;
        const name = row.profile_name || profileMap.get(profileId);
        if (name) {
            let rowDates: any[] = [];
            if (Array.isArray(row.dates)) {
                rowDates = row.dates;
            } else if (typeof row.dates === 'string') {
                try {
                    const parsed = JSON.parse(row.dates);
                    rowDates = Array.isArray(parsed) ? parsed : [];
                } catch (parseError) {
                    console.error("AVAIL DATES PARSE ERROR", parseError);
                    rowDates = [];
                }
            }
            if (rowDates.length === 0 && row.date) {
                const period = row.period ? String(row.period) : '';
                rowDates.push(period && period !== 'FULL' ? `${row.date}_${period}` : row.date);
            }

            availability[name] = availability[name]
                ? Array.from(new Set([...availability[name], ...rowDates]))
                : rowDates;
            if (row.notes) {
                Object.entries(row.notes).forEach(([k, v]) => {
                    notes[`${name}_${k}`] = v;
                });
            }
        } else {
            console.warn("AVAIL NAME MISSING FOR PROFILE", profileId);
        }
    });
    
    return { availability, notes };
};

export const saveMemberAvailability = async (ministryId: string, orgId: string, memberName: string, dates: string[], notes: any, monthTarget?: string) => {
    const sb = getSupabase();
    if (!sb) return;
    
    const { data: profile } = await sb.from('profiles').select('id').eq('organization_id', orgId).eq('name', memberName).single();
    if (!profile) return;
    
    const payload = {
        organization_id: orgId,
        ministry_id: ministryId,
        profile_id: profile.id,
        dates: dates,
        notes: notes
    };

    console.log('AVAIL WRITE payload', payload);

    await sb.from('availability').upsert(payload, { onConflict: 'organization_id, ministry_id, profile_id' });
};

export const fetchSwapRequests = async (ministryId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return [];
    const { data } = await sb.from('swap_requests')
        .select('*')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .eq('status', 'pending');
    return data || [];
};

export const createSwapRequestSQL = async (ministryId: string, orgId: string, request: any) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('swap_requests').insert({
        organization_id: orgId,
        ministry_id: ministryId,
        requester_id: request.requesterId,
        requester_name: request.requesterName,
        role: request.role,
        event_iso: request.eventIso,
        event_title: request.eventTitle,
        status: 'pending'
    });
};

export const performSwapSQL = async (ministryId: string, orgId: string, reqId: string, takenByName: string, takenById: string) => {
    const sb = getSupabase();
    if (!sb) return;
    
    const { data: req } = await sb.from('swap_requests').select('*').eq('id', reqId).single();
    if (!req) return;
    
    const datePart = req.event_iso.split('T')[0];
    
    const { data: assignment } = await sb.from('schedule_assignments')
        .select('id, event_key')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .eq('event_date', datePart)
        .eq('role', req.role)
        .eq('member_id', req.requester_id)
        .single();
        
    if (assignment) {
        await sb.from('schedule_assignments').update({
            member_id: takenById,
            confirmed: false
        }).eq('id', assignment.id);
        
        await sb.from('swap_requests').update({
            status: 'completed',
            taken_by_name: takenByName
        }).eq('id', reqId);
    }
};

export const cancelSwapRequestSQL = async (reqId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('swap_requests').update({ status: 'cancelled' }).eq('id', reqId).eq('organization_id', orgId);
};

export const updateUserProfile = async (name: string, whatsapp: string, avatar_url: string | undefined, functions: string[] | undefined, birthDate: string | undefined, ministryId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    
    const updates: any = { name, whatsapp, birth_date: birthDate };
    if (avatar_url) updates.avatar_url = avatar_url;
    
    await sb.from('profiles').update(updates).eq('id', user.id);
    
    if (functions && ministryId) {
        await sb.from('organization_memberships')
            .update({ functions })
            .eq('profile_id', user.id)
            .eq('ministry_id', ministryId)
            .eq('organization_id', orgId);
    }
};

export const updateMemberData = async (memberId: string, orgId: string, data: any) => {
    const sb = getSupabase();
    if (!sb) return;
    
    const profileUpdates: any = {};
    if (data.name) profileUpdates.name = data.name;
    if (data.whatsapp) profileUpdates.whatsapp = data.whatsapp;
    
    if (Object.keys(profileUpdates).length > 0) {
        await sb.from('profiles').update(profileUpdates).eq('id', memberId);
    }
    
    if (data.roles && data.ministryId) {
        await sb.from('organization_memberships')
            .update({ functions: data.roles })
            .eq('profile_id', memberId)
            .eq('ministry_id', data.ministryId)
            .eq('organization_id', orgId);
    }
};

export const toggleAdminSQL = async (email: string, isAdmin: boolean, ministryId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('profiles').update({ is_admin: isAdmin }).eq('email', email).eq('organization_id', orgId);
};

export const deleteMember = async (ministryId: string, orgId: string, memberId: string, memberName: string) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('organization_memberships')
        .delete()
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .eq('profile_id', memberId);
};

export const updateProfileMinistry = async (userId: string, ministryId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('profiles').update({ ministry_id: ministryId }).eq('id', userId);
};

export const joinMinistry = async (ministryId: string, orgId: string, roles: string[]) => {
    const sb = getSupabase();
    if (!sb) return;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    
    await sb.from('organization_memberships').insert({
        organization_id: orgId,
        ministry_id: ministryId,
        profile_id: user.id,
        role: 'member',
        functions: roles
    });
    
    const { data: profile } = await sb.from('profiles').select('allowed_ministries').eq('id', user.id).single();
    if (profile) {
        const allowed = new Set(profile.allowed_ministries || []);
        allowed.add(ministryId);
        await sb.from('profiles').update({ allowed_ministries: Array.from(allowed) }).eq('id', user.id);
    }
};

export const saveMinistrySettings = async (ministryId: string, orgId: string, displayName?: string, roles?: string[], start?: string, end?: string) => {
    const sb = getSupabase();
    if (!sb) return;
    
    const updates: any = {};
    if (displayName) updates.display_name = displayName;
    if (roles) updates.roles = roles;
    
    if (Object.keys(updates).length > 0) {
        await sb.from('ministry_settings').upsert({
            organization_id: orgId,
            ministry_id: ministryId,
            ...updates
        }, { onConflict: 'organization_id, ministry_id' });
    }
    
    if (start !== undefined || end !== undefined) {
        const minUpdates: any = {};
        if (start !== undefined) minUpdates.availability_start = start;
        if (end !== undefined) minUpdates.availability_end = end;
        
        await sb.from('organization_ministries')
            .update(minUpdates)
            .eq('id', ministryId)
            .eq('organization_id', orgId);
    }
};

export const fetchNotificationsSQL = async (ministryIds: string[], userId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return [];
    
    const { data: globalNotifs } = await sb.from('notifications')
        .select('*')
        .eq('organization_id', orgId)
        .in('ministry_id', ministryIds)
        .order('created_at', { ascending: false })
        .limit(20);
        
    const { data: reads } = await sb.from('notification_reads')
        .select('notification_id')
        .eq('user_id', userId);
        
    const readSet = new Set(reads?.map((r: any) => r.notification_id));
    
    return (globalNotifs || []).map((n: any) => ({
        id: n.id,
        ministryId: n.ministry_id,
        organizationId: n.organization_id,
        title: n.title,
        message: n.message,
        type: n.type,
        timestamp: n.created_at,
        read: readSet.has(n.id),
        actionLink: n.action_link
    }));
};

export const sendNotificationSQL = async (ministryId: string, orgId: string, notification: any) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('notifications').insert({
        organization_id: orgId,
        ministry_id: ministryId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        action_link: notification.actionLink
    });
};

export const markNotificationsReadSQL = async (ids: string[], userId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    
    const inserts = ids.map(id => ({
        user_id: userId,
        notification_id: id,
        organization_id: orgId
    }));
    
    await sb.from('notification_reads').upsert(inserts, { onConflict: 'user_id, notification_id' });
};

export const clearAllNotificationsSQL = async (ministryId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('notifications').delete().eq('organization_id', orgId).eq('ministry_id', ministryId);
};

export const createAnnouncementSQL = async (ministryId: string, orgId: string, announcement: any, authorName: string) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('announcements').insert({
        organization_id: orgId,
        ministry_id: ministryId,
        title: announcement.title,
        message: announcement.message,
        type: announcement.type,
        expiration_date: announcement.expirationDate,
        author_name: authorName
    });
};

export const fetchRepertoire = async (ministryId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return [];
    const { data } = await sb.from('repertoire')
        .select('*')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .order('event_date', { ascending: false });
        
    return (data || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        link: r.link,
        date: r.event_date,
        observation: r.observation,
        addedBy: r.added_by,
        createdAt: r.created_at,
        content: r.content,
        key: r.key,
        organizationId: r.organization_id
    }));
};

export const addToRepertoire = async (ministryId: string, orgId: string, item: any) => {
    const sb = getSupabase();
    if (!sb) return false;
    const { error } = await sb.from('repertoire').insert({
        organization_id: orgId,
        ministry_id: ministryId,
        title: item.title,
        link: item.link,
        event_date: item.date,
        added_by: item.addedBy,
        content: item.content
    });
    return !error;
};

export const deleteFromRepertoire = async (id: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('repertoire').delete().eq('id', id).eq('organization_id', orgId);
};

export const updateRepertoireItem = async (id: string, orgId: string, updates: any) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('repertoire').update(updates).eq('id', id).eq('organization_id', orgId);
};

export const fetchGlobalSchedules = async (month: string, ministryId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return {};
    
    const { data } = await sb.from('schedule_assignments')
        .select('ministry_id, event_date, role, member_id, profiles(name)')
        .eq('organization_id', orgId)
        .neq('ministry_id', ministryId)
        .ilike('event_date', `${month}%`);
        
    const conflicts: any = {};
    data?.forEach((row: any) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        const name = profile?.name?.trim().toLowerCase();
        if (name) {
            if (!conflicts[name]) conflicts[name] = [];
            conflicts[name].push({
                ministryId: row.ministry_id,
                eventIso: row.event_date,
                role: row.role
            });
        }
    });
    return conflicts;
};

export const fetchAuditLogs = async (ministryId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return [];
    const { data } = await sb.from('audit_logs')
        .select('*')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .order('created_at', { ascending: false })
        .limit(50);
        
    return (data || []).map((l: any) => ({
        id: l.id,
        date: l.created_at,
        action: l.action,
        details: l.details,
        author: l.author_name,
        organizationId: l.organization_id
    }));
};
