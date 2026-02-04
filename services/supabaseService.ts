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
  RankingHistoryItem
} from '../types';

// --- INITIALIZATION ---

let serviceOrgId: string | null = null;

// Acesso seguro às variáveis de ambiente para evitar crash (Tela Preta)
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

// Fallback para process.env (compatibilidade com alguns ambientes de teste/build)
if (!envUrl && typeof process !== 'undefined' && process.env) {
    envUrl = process.env.VITE_SUPABASE_URL || "";
    envKey = process.env.VITE_SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
}

// Inicializa o cliente APENAS se as chaves existirem
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

// --- DUMMY CONFIG EXPORTS (Para manter compatibilidade com UI existente) ---

export const configureSupabaseManual = (url: string, key: string) => {
    console.warn("Configuração manual desativada. Use variáveis de ambiente.");
};

export const validateConnection = async (url: string, key: string) => {
    return false;
};

export const setServiceOrgContext = (id: string) => {
    serviceOrgId = id;
};

export const clearServiceOrgContext = () => {
    serviceOrgId = null;
};

// --- HELPERS ---

const requireOrgId = (orgId: string | null | undefined): string => {
    const effectiveId = orgId || serviceOrgId;
    if (!effectiveId) {
        console.error("[SupabaseService] Critical: ORG_ID_REQUIRED was not provided.");
        return ""; 
    }
    return effectiveId;
};

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

const slugify = (text: string) => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
};

const generatePublicCode = () => {
  // Gera código de 8 caracteres maiúsculos alfanuméricos
  return Math.random().toString(36).substring(2, 10).toUpperCase();
};

const isUUID = (str: string) => {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return regex.test(str);
};

// --- INVITE SYSTEM (LINK-BASED) ---

export const createInviteToken = async (ministryId: string, orgId: string, ministryName?: string) => {
    const sb = getSupabase();
    if (!sb) return { success: false, message: "Sem conexão" };

    try {
        const publicCode = generatePublicCode(); // Código curto público
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 dias

        // Insere com public_code. Deixa o DB gerar o ID.
        const { error } = await sb.from('invite_tokens').insert({
            public_code: publicCode,
            organization_id: orgId,
            ministry_id: ministryId,
            used: false,
            expires_at: expiresAt
        });

        if (error) throw error;

        // Gerar slug para a URL (apenas visual)
        let slug = "";
        if (ministryName) {
            slug = slugify(ministryName);
        } else {
            const { data } = await sb.from('organization_ministries').select('label').eq('id', ministryId).single();
            if (data?.label) slug = slugify(data.label);
        }

        // Gera link enriquecido usando o Código Curto
        let url = `${window.location.origin}/?invite=${publicCode}`;
        if (slug) {
            url += `&ministry=${slug}`;
        }

        return { success: true, url };
    } catch (e: any) {
        return { success: false, message: e.message || "Erro ao gerar convite" };
    }
};

export const validateInviteToken = async (inviteCode: string) => {
    const sb = getSupabase();
    if (!sb) return { valid: false, message: "Erro de conexão" };

    console.log("🔍 [DEBUG] Validando convite (Service):", inviteCode);

    let query = sb.from('invite_tokens').select('*, organization_ministries(label)');

    // Lógica Híbrida: UUID = Legacy/ID, Curto = public_code
    if (isUUID(inviteCode)) {
        console.log("🔍 [DEBUG] Formato UUID detectado. Buscando por ID...");
        query = query.eq('id', inviteCode);
    } else {
        console.log("🔍 [DEBUG] Formato Curto detectado. Buscando por public_code...");
        query = query.eq('public_code', inviteCode);
    }

    // PASSO 6: Alteração para .limit(1) e remoção de filtros extras na query
    const { data: resultData, error } = await query.limit(1);

    console.log("🔍 [DEBUG] Retorno do Banco:", { data: resultData, error });

    if (error) {
        console.error("❌ [DEBUG] Erro SQL:", error.message);
        return { valid: false, message: "Erro interno ao validar convite." };
    }

    if (!resultData || resultData.length === 0) {
        console.warn("⚠️ [DEBUG] Nenhum convite encontrado para:", inviteCode);
        return { valid: false, message: "Convite inválido ou não encontrado." };
    }

    const data = resultData[0];

    // Validações pós-query (Passo 5)
    if (data.used === true) { 
        console.warn("⚠️ [DEBUG] Convite já utilizado.");
        return { valid: false, message: "Este convite já foi utilizado." };
    }
    
    const now = new Date();
    const expires = new Date(data.expires_at);
    if (expires < now) {
        console.warn("⚠️ [DEBUG] Convite expirado.");
        return { valid: false, message: "Este convite expirou." };
    }

    return { 
        valid: true, 
        data: {
            id: data.id, // Retorna ID interno para update
            ministryId: data.ministry_id,
            orgId: data.organization_id,
            ministryLabel: data.organization_ministries?.label || data.ministry_id
        } 
    };
};

export const registerWithInvite = async (
    inviteCodeFromUrl: string, 
    formData: {
        name: string,
        email: string,
        password: string,
        whatsapp: string,
        birthDate: string,
        roles: string[] 
    }
) => {
    const sb = getSupabase();
    if (!sb) return { success: false, message: "Sem conexão" };

    try {
        // 1. Revalidar e pegar ID interno
        const { valid, data: invite } = await validateInviteToken(inviteCodeFromUrl);
        if (!valid || !invite) throw new Error("Convite inválido ou expirado.");

        // 2. Criar Auth User
        const { data: authData, error: authError } = await sb.auth.signUp({
            email: formData.email,
            password: formData.password,
            options: {
                data: {
                    full_name: formData.name,
                    organization_id: invite.orgId
                }
            }
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error("Erro ao criar usuário.");

        const userId = authData.user.id;

        // 3. Atualizar/Criar Profile
        const { error: profileError } = await sb.from('profiles').upsert({
            id: userId,
            name: formData.name,
            email: formData.email,
            whatsapp: formData.whatsapp,
            birth_date: formData.birthDate,
            organization_id: invite.orgId,
            allowed_ministries: [invite.ministryId], 
            ministry_id: invite.ministryId 
        });

        if (profileError) throw new Error("Erro ao criar perfil: " + profileError.message);

        // 4. Criar Membership
        await sb.from('organization_memberships').insert({
            profile_id: userId,
            organization_id: invite.orgId,
            ministry_id: invite.ministryId,
            role: 'member',
            functions: formData.roles || [] 
        });

        // 5. Marcar convite como usado (usando ID interno)
        const usedUpdate: any = { used: true };
        
        // Tentativa segura de update
        await sb.from('invite_tokens').update(usedUpdate).eq('id', invite.id);

        return { success: true };

    } catch (e: any) {
        console.error(e);
        return { success: false, message: e.message || "Erro desconhecido ao registrar." };
    }
};

// --- CORE SAAS FUNCTIONS ---

export const fetchOrganizationMinistries = async (orgId?: string): Promise<MinistryDef[]> => {
    const sb = getSupabase();
    if (!sb || !orgId) return [];

    const { data, error } = await sb
        .from('organization_ministries')
        .select('id, code, label') 
        .eq('organization_id', orgId);

    if (error) {
        console.warn(error.message);
        return [];
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
        
    if (error) return [];
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

    const { data: ministryDef, error: defError } = await sb.from('organization_ministries')
        .select('label')
        .eq('id', ministryId)
        .eq('organization_id', orgId)
        .maybeSingle();

    if (defError) return null;

    const { data: settings } = await sb.from('ministry_settings')
        .select('*')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId)
        .maybeSingle();
    
    return {
        id: settings?.id,
        organizationMinistryId: ministryId, 
        displayName: ministryDef?.label || settings?.display_name || 'Ministério',
        roles: settings?.roles || [],
        availabilityStart: settings?.availability_start,
        availabilityEnd: settings?.availability_end,
        organizationId: orgId,
        spotifyClientId: settings?.spotify_client_id,
        spotifyClientSecret: settings?.spotify_client_secret
    };
};

export const fetchScheduleAssignments = async (ministryId: string, month: string, orgId?: string) => {
    const sb = getSupabase();
    if (!sb || !orgId) return { schedule: {}, attendance: {} };

    const { data: assignments, error } = await sb.from('schedule_assignments')
        .select('*, profiles(name)')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId);

    if (error) return { schedule: {}, attendance: {} };

    const schedule: any = {};
    const attendance: any = {};

    assignments?.forEach((a: any) => {
        const ruleId = a.event_key;
        const dateStr = a.event_date;
        
        if (ruleId && dateStr) {
            const key = `${ruleId}_${dateStr}_${a.role}`;
            const profile = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
            const name = profile?.name || a.member_name;

            if (name) schedule[key] = name;
            if (a.confirmed) attendance[key] = true;
        }
    });

    return { schedule, attendance };
};

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
    const sb = getSupabase();
    if (!sb) throw new Error("Sem conexão com o banco de dados");

    const validOrgId = requireOrgId(orgId);
    const time = ruleData.time.length === 5 ? `${ruleData.time}` : ruleData.time;

    const { data, error } = await sb.from('event_rules')
        .insert([{
            organization_id: validOrgId,
            ministry_id: ruleData.ministryId, 
            title: ruleData.title,
            weekday: ruleData.weekday,
            date: ruleData.date,
            time: time,
            type: ruleData.type,
            active: true
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const deleteEventRule = async (orgId: string, id: string) => {
    const sb = getSupabase();
    if (!sb) return;
    const validOrgId = requireOrgId(orgId);
    await sb.from('event_rules').delete().eq('id', id).eq('organization_id', validOrgId);
};

export const createMinistryEvent = async (ministryId: string, orgId: string, event: any) => {
    const sb = getSupabase();
    if (!sb) return;
    const validOrgId = requireOrgId(orgId);
    await sb.from('event_rules').insert({
        organization_id: validOrgId,
        ministry_id: ministryId,
        title: event.title,
        type: 'single',
        date: event.date,
        time: event.time,
        active: true
    });
};

export const deleteMinistryEvent = async (ministryId: string, orgId: string, identifier: string) => {
    const sb = getSupabase();
    if (!sb) return;
    const validOrgId = requireOrgId(orgId);

    let ruleId = identifier;
    if (identifier.length > 36 && identifier[36] === '_') {
        ruleId = identifier.substring(0, 36);
    } else if (identifier.includes('T')) {
        const [date, timePart] = identifier.split('T');
        const time = timePart.substring(0, 5);
        await sb.from('event_rules').delete()
            .eq('organization_id', validOrgId)
            .eq('ministry_id', ministryId)
            .eq('type', 'single')
            .eq('date', date)
            .eq('time', time);
        return;
    }
    await sb.from('event_rules').delete().eq('id', ruleId).eq('organization_id', validOrgId);
};

export const updateMinistryEvent = async (ministryId: string, orgId: string, oldIso: string, newTitle: string, newIso: string, applyToAll: boolean) => {
    const sb = getSupabase();
    if (!sb) return;
    const validOrgId = requireOrgId(orgId);
    
    const [oldDate, oldTimePart] = oldIso.split('T');
    const oldTime = oldTimePart.substring(0, 5);
    const [newDate, newTimePart] = newIso.split('T');
    const newTime = newTimePart.substring(0, 5);

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

export const fetchMinistryMembers = async (ministryId: string, orgId?: string) => {
  const sb = getSupabase();
  if (!sb || !orgId) return { memberMap: {}, publicList: [] };

  const { data: memberships } = await sb
    .from('organization_memberships')
    .select(`profile_id, functions, role, profiles (id, name, email, avatar_url, whatsapp, birth_date, is_admin)`)
    .eq('ministry_id', ministryId)
    .eq('organization_id', orgId);

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

export const fetchRankingData = async (ministryId: string, orgId?: string): Promise<RankingEntry[]> => {
    const sb = getSupabase();
    if (!sb || !orgId) return [];
    
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

    const [assignmentsRes, swapsRes, readsRes, likesRes] = await Promise.all([
        sb.from('schedule_assignments').select('member_id, event_date, role').eq('organization_id', orgId).eq('ministry_id', ministryId).eq('confirmed', true).lte('event_date', today),
        sb.from('swap_requests').select('requester_id, created_at').eq('organization_id', orgId).eq('ministry_id', ministryId),
        sb.from('announcement_reads').select('user_id, created_at, announcements!inner(ministry_id)').eq('organization_id', orgId).eq('announcements.ministry_id', ministryId),
        sb.from('announcement_likes').select('user_id, created_at, announcements!inner(ministry_id)').eq('organization_id', orgId).eq('announcements.ministry_id', ministryId)
    ]) as any;

    const assignments = assignmentsRes.data || [];
    const swaps = swapsRes.data || [];
    const reads = readsRes.data || [];
    const likes = likesRes.data || [];

    return (members || []).map((m: any) => {
        let points = 0;
        const history: RankingHistoryItem[] = [];

        const memberAssignments = assignments.filter((a: any) => a.member_id === m.id);
        points += memberAssignments.length * 100;
        memberAssignments.forEach((a: any) => history.push({ id: `assign-${a.member_id}-${a.event_date}`, date: a.event_date, description: `Escala Confirmada: ${a.role}`, points: 100, type: 'assignment' }));

        const memberSwaps = swaps.filter((s: any) => s.requester_id === m.id);
        points -= memberSwaps.length * 50;
        memberSwaps.forEach((s: any) => history.push({ id: `swap-${s.requester_id}-${s.created_at}`, date: s.created_at, description: `Solicitou Troca`, points: -50, type: 'swap_penalty' }));

        const memberReads = reads.filter((r: any) => r.user_id === m.id);
        points += memberReads.length * 5;

        const memberLikes = likes.filter((l: any) => l.user_id === m.id);
        points += memberLikes.length * 10;

        if (points < 0) points = 0;
        history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return {
            memberId: m.id,
            name: m.name,
            avatar_url: m.avatar_url,
            points, 
            stats: { confirmedEvents: memberAssignments.length, missedEvents: 0, swapsRequested: memberSwaps.length, announcementsRead: memberReads.length, announcementsLiked: memberLikes.length },
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
    const { data } = await sb.from('organizations').select(`*, organization_ministries (id, code, label), profiles (count)`);
    return (data || []).map((o: any) => ({
        id: o.id, name: o.name, slug: o.slug, active: o.active, createdAt: o.created_at,
        userCount: o.profiles?.[0]?.count || 0,
        ministryCount: o.organization_ministries?.length || 0,
        ministries: o.organization_ministries?.map((m:any) => ({ id: m.id, code: m.code, label: m.label })) || []
    }));
};

// --- ACTIONS ---

export const saveOrganizationMinistry = async (orgId: string, code: string, label: string) => {
    const sb = getSupabase();
    if (!sb) return { success: false, message: "Sem conexão" };
    const { error } = await sb.from('organization_ministries').upsert({ organization_id: orgId, code, label }, { onConflict: 'organization_id, code' });
    return error ? { success: false, message: error.message } : { success: true, message: "Salvo" };
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

export const registerWithEmail = async (email: string, pass: string, name: string, ministries: string[], orgId: string, roles: string[]) => {
    const sb = getSupabase();
    if (!sb) return { success: false, message: "Sem conexão" };
    const { data, error } = await (sb.auth as any).signUp({ email, password: pass, options: { data: { full_name: name, ministry_id: ministries[0], organization_id: orgId } } });
    if (error) return { success: false, message: error.message };
    return { success: true, message: "Verifique seu e-mail." };
};

export const fetchMinistryAvailability = async (ministryId: string, orgId?: string) => {
    const sb = getSupabase();
    if (!sb || !orgId) return { availability: {}, notes: {} };
    const { data } = await sb.from('availability').select('*, profiles(name)').eq('ministry_id', ministryId).eq('organization_id', orgId);
    const availability: any = {};
    const notes: any = {};
    data?.forEach((row: any) => {
        const name = Array.isArray(row.profiles) ? row.profiles[0]?.name : row.profiles?.name;
        if (name) {
            availability[name] = Array.isArray(row.dates) ? row.dates : [];
            if (row.notes) Object.entries(row.notes).forEach(([k, v]) => { notes[`${name}_${k}`] = v; });
        }
    });
    return { availability, notes };
};

export const fetchNotificationsSQL = async (ministryIds: string[], userId: string, orgId?: string) => {
    const sb = getSupabase();
    if (!sb || !orgId) return [];
    const { data } = await sb.from('notifications').select('*').in('ministry_id', ministryIds).eq('organization_id', orgId).order('created_at', { ascending: false }).limit(50);
    const { data: reads } = await sb.from('notification_reads').select('notification_id').eq('user_id', userId).eq('organization_id', orgId);
    const readIds = new Set(reads?.map((r: any) => r.notification_id));
    return (data || []).map((n: any) => ({
        id: n.id, type: n.type, title: n.title, message: n.message, timestamp: n.created_at, read: readIds.has(n.id), actionLink: n.action_link, ministryId: n.ministry_id
    }));
};

export const fetchAnnouncementsSQL = async (ministryId: string, orgId?: string) => {
    const sb = getSupabase();
    if (!sb || !orgId) return [];
    const { data } = await sb.from('announcements').select(`*, announcement_reads (user_id, profiles(name), created_at), announcement_likes (user_id, profiles(name), created_at)`).eq('ministry_id', ministryId).eq('organization_id', orgId).gte('expiration_date', new Date().toISOString()).order('created_at', { ascending: false });
    return (data || []).map((a: any) => ({
        id: a.id, title: a.title, message: a.message, type: a.type, timestamp: a.created_at, expirationDate: a.expiration_date, author: a.author_name || 'Admin',
        readBy: a.announcement_reads.map((r: any) => ({ userId: r.user_id, name: r.profiles?.name, timestamp: r.created_at })),
        likedBy: a.announcement_likes.map((l: any) => ({ userId: l.user_id, name: l.profiles?.name, timestamp: l.created_at }))
    }));
};

export const fetchSwapRequests = async (ministryId: string, orgId?: string) => {
    const sb = getSupabase();
    if (!sb || !orgId) return [];
    const { data } = await sb.from('swap_requests').select('*').eq('ministry_id', ministryId).eq('organization_id', orgId).order('created_at', { ascending: false });
    return (data || []).map((s: any) => ({
        id: s.id, ministryId: s.ministry_id, requesterName: s.requester_name, requesterId: s.requester_id, role: s.role, eventIso: s.event_iso, eventTitle: s.event_title, status: s.status, createdAt: s.created_at, takenByName: s.taken_by_name
    }));
};

export const fetchRepertoire = async (ministryId: string, orgId?: string) => {
    const sb = getSupabase();
    if (!sb || !orgId) return [];
    const { data } = await sb.from('repertoire').select('*').eq('ministry_id', ministryId).eq('organization_id', orgId).order('created_at', { ascending: false });
    return (data || []).map((r: any) => ({
        id: r.id, title: r.title, link: r.link, date: r.date_used, observation: r.observation, addedBy: r.added_by, createdAt: r.created_at, content: r.content, key: r.music_key
    }));
};

export const fetchGlobalSchedules = async (month: string, currentMinistryId: string, orgId?: string) => {
    const sb = getSupabase();
    if (!sb || !orgId) return {};
    const { data } = await sb.from('schedule_assignments').select('event_key, event_date, role, ministry_id, profiles(name)').eq('organization_id', orgId).neq('ministry_id', currentMinistryId);
    const map: any = {};
    data?.forEach((row: any) => {
        const name = Array.isArray(row.profiles) ? row.profiles[0]?.name : row.profiles?.name;
        if (name) {
            const n = name.toLowerCase().trim();
            if (!map[n]) map[n] = [];
            map[n].push({ ministryId: row.ministry_id, eventIso: row.event_date ? `${row.event_date}T00:00` : row.event_key, role: row.role });
        }
    });
    return map;
};

export const fetchAuditLogs = async (ministryId: string, orgId?: string) => {
    const sb = getSupabase();
    if (!sb || !orgId) return [];
    const { data } = await sb.from('audit_logs').select('*').eq('ministry_id', ministryId).eq('organization_id', orgId).order('created_at', { ascending: false }).limit(100);
    return (data || []).map((l: any) => ({ id: l.id, date: l.created_at, action: l.action, details: l.details, author: l.author_name }));
};

export const saveOrganization = async (id: string | null, name: string, slug: string) => {
    const sb = getSupabase();
    if (!sb) return { success: false, message: "Sem conexão" };
    if (id) {
        const { error } = await sb.from('organizations').update({ name, slug }).eq('id', id);
        return error ? { success: false, message: error.message } : { success: true, message: "Atualizado" };
    } else {
        const { error } = await sb.from('organizations').insert({ name, slug });
        return error ? { success: false, message: error.message } : { success: true, message: "Criado" };
    }
};

export const toggleOrganizationStatus = async (id: string, active: boolean) => {
    const sb = getSupabase();
    if (!sb) return false;
    const { error } = await sb.from('organizations').update({ active }).eq('id', id);
    return !error;
};

export const deleteOrganizationMinistry = async (orgId: string, code: string) => {
    const sb = getSupabase();
    if (!sb) return { success: false, message: "Sem conexão" };
    const { error } = await sb.from('organization_ministries').delete().eq('organization_id', orgId).eq('code', code);
    return error ? { success: false, message: error.message } : { success: true, message: "Removido" };
};

export const removeScheduleAssignment = async (ministryId: string, orgId: string, key: string) => {
    const sb = getSupabase();
    if (!sb) return false;
    const parts = key.split('_');
    const uuid = parts[0];
    let date = parts[1];
    let role = parts.slice(2).join('_');
    const { error } = await sb.from('schedule_assignments').delete().eq('event_key', uuid).eq('event_date', date).eq('role', role).eq('ministry_id', ministryId).eq('organization_id', orgId);
    if (error) throw error;
    return true;
};

export const saveScheduleAssignment = async (ministryId: string, orgId: string, eventKey: string, role: string, memberId: string | null, memberName?: string) => {
    const sb = getSupabase();
    if (!sb) return false;
    const parts = eventKey.split('_');
    const uuid = parts[0];
    const date = parts[1];
    if (!uuid || !date) return false;
    const { error } = await sb.from('schedule_assignments').upsert({ event_key: uuid, event_date: date, role, member_id: memberId, ministry_id: ministryId, organization_id: orgId, confirmed: false }, { onConflict: 'event_key, event_date, role' });
    if (error) return false;
    return true;
};

export const toggleAssignmentConfirmation = async (ministryId: string, orgId: string, key: string) => {
    const sb = getSupabase();
    if (!sb) return;
    const parts = key.split('_');
    const uuid = parts[0];
    const date = parts[1];
    const role = parts.slice(2).join('_');
    const { data: assignment } = await sb.from('schedule_assignments').select('confirmed').eq('organization_id', orgId).eq('ministry_id', ministryId).eq('event_key', uuid).eq('event_date', date).eq('role', role).single();
    if (assignment) { 
        await sb.from('schedule_assignments').update({ confirmed: !assignment.confirmed }).eq('organization_id', orgId).eq('ministry_id', ministryId).eq('event_key', uuid).eq('event_date', date).eq('role', role); 
    }
};

export const saveMemberAvailability = async (ministryId: string, orgId: string, member: string, dates: string[], notes?: any, targetMonth?: string) => {
    const sb = getSupabase();
    if (!sb) return;
    const { data: profile } = await sb.from('profiles').select('id').eq('name', member).eq('organization_id', orgId).maybeSingle();
    if (!profile?.id) throw new Error("Membro não encontrado");
    await sb.from('availability').upsert({ ministry_id: ministryId, organization_id: orgId, member_id: profile.id, dates, notes }, { onConflict: 'organization_id,ministry_id,member_id', ignoreDuplicates: false });
};

export const createSwapRequestSQL = async (ministryId: string, orgId: string, request: any) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('swap_requests').insert({ ministry_id: ministryId, organization_id: orgId, requester_name: request.requesterName, requester_id: request.requesterId, role: request.role, event_iso: request.eventIso, event_title: request.eventTitle, status: 'pending' });
};

export const performSwapSQL = async (ministryId: string, orgId: string, requestId: string, takenByName: string, takenById: string) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('swap_requests').update({ status: 'completed', taken_by_name: takenByName, taken_by_id: takenById }).eq('id', requestId).eq('organization_id', orgId);
};

export const cancelSwapRequestSQL = async (requestId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('swap_requests').delete().eq('id', requestId).eq('organization_id', orgId);
};

export const interactAnnouncementSQL = async (id: string, userId: string, userName: string, action: 'read'|'like', orgId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    const table = action === 'read' ? 'announcement_reads' : 'announcement_likes';
    if (action === 'like') {
        const { data } = await sb.from(table).select('id').eq('announcement_id', id).eq('user_id', userId).eq('organization_id', orgId).maybeSingle();
        if (data) { await sb.from(table).delete().eq('id', data.id).eq('organization_id', orgId); } 
        else { await sb.from(table).insert({ announcement_id: id, user_id: userId, organization_id: orgId }); }
    } else {
        await sb.from(table).upsert({ announcement_id: id, user_id: userId, organization_id: orgId }, { onConflict: 'announcement_id, user_id' });
    }
};

export const updateUserProfile = async (name: string, whatsapp: string, avatar: string | undefined, functions: string[] | undefined, birthDate: string | undefined, ministryId?: string, orgId?: string) => {
    const sb = getSupabase();
    if (!sb) return;
    const { data: { user } } = await (sb.auth as any).getUser();
    if (!user) return;
    const updates: any = { name, whatsapp, birth_date: birthDate };
    if (avatar) updates.avatar_url = avatar;
    await sb.from('profiles').update(updates).eq('id', user.id).eq('organization_id', orgId);
    if (ministryId && functions && orgId) {
        const sanitizedRoles = await filterRolesBySettings(functions, ministryId, orgId);
        await sb.from('organization_memberships').update({ functions: sanitizedRoles }).eq('profile_id', user.id).eq('ministry_id', ministryId).eq('organization_id', orgId);
    }
};

export const saveMinistrySettings = async (ministryId: string, orgId: string, displayName?: string, roles?: string[], start?: string, end?: string) => {
    const sb = getSupabase();
    if (!sb) return;
    const updates: any = {};
    if (displayName) updates.display_name = displayName;
    if (roles) updates.roles = roles;
    if (start) updates.availability_start = start;
    if (end) updates.availability_end = end;
    await sb.from('ministry_settings').update(updates).eq('ministry_id', ministryId).eq('organization_id', orgId);
};

export const toggleAdminSQL = async (email: string, status: boolean, ministryId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('profiles').update({ is_admin: status }).eq('email', email).eq('organization_id', orgId);
};

export const deleteMember = async (ministryId: string, orgId: string, memberId: string, name: string) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('organization_memberships').delete().eq('profile_id', memberId).eq('ministry_id', ministryId).eq('organization_id', orgId);
};

export const updateMemberData = async (id: string, orgId: string, data: any) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('profiles').update({ name: data.name, whatsapp: data.whatsapp }).eq('id', id).eq('organization_id', orgId);
    if (data.ministryId) {
        const sanitizedRoles = await filterRolesBySettings(data.roles, data.ministryId, orgId);
        await sb.from('organization_memberships').update({ functions: sanitizedRoles }).eq('profile_id', id).eq('ministry_id', data.ministryId).eq('organization_id', orgId);
    }
};

export const sendNotificationSQL = async (ministryId: string, orgId: string, notification: any) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('notifications').insert({ ministry_id: ministryId, organization_id: orgId, title: notification.title, message: notification.message, type: notification.type, action_link: notification.actionLink });
};

export const createAnnouncementSQL = async (ministryId: string, orgId: string, announcement: any, authorName: string) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('announcements').insert({ ministry_id: ministryId, organization_id: orgId, title: announcement.title, message: announcement.message, type: announcement.type, expiration_date: announcement.expirationDate, author_name: authorName });
};

export const joinMinistry = async (ministryId: string, orgId: string, roles: string[]) => {
    const sb = getSupabase();
    if (!sb) return;
    const { data: { user } } = await (sb.auth as any).getUser();
    if (!user) return;
    const sanitizedRoles = await filterRolesBySettings(roles, ministryId, orgId);
    await sb.from('organization_memberships').insert({ profile_id: user.id, organization_id: orgId, ministry_id: ministryId, role: 'member', functions: sanitizedRoles });
    const { data: profile } = await sb.from('profiles').select('allowed_ministries').eq('id', user.id).eq('organization_id', orgId).single();
    const current = profile?.allowed_ministries || [];
    if (!current.includes(ministryId)) {
        await sb.from('profiles').update({ allowed_ministries: [...current, ministryId] }).eq('id', user.id).eq('organization_id', orgId);
    }
};

export const markNotificationsReadSQL = async (ids: string[], userId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    const inserts = ids.map(id => ({ notification_id: id, user_id: userId, organization_id: orgId }));
    await sb.from('notification_reads').upsert(inserts, { onConflict: 'notification_id, user_id' });
};

export const clearAllNotificationsSQL = async (ministryId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('notifications').delete().eq('ministry_id', ministryId).eq('organization_id', orgId);
};

export const addToRepertoire = async (ministryId: string, orgId: string, item: any) => {
    const sb = getSupabase();
    if (!sb) return false;
    const { error } = await sb.from('repertoire').insert({ ministry_id: ministryId, organization_id: orgId, title: item.title, link: item.link, date_used: item.date, added_by: item.addedBy, content: item.content });
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
    await sb.from('repertoire').update({ content: updates.content, music_key: updates.key }).eq('id', id).eq('organization_id', orgId);
};

export const updateProfileMinistry = async (userId: string, ministryId: string) => {
    const sb = getSupabase();
    if (sb) await sb.from('profiles').update({ ministry_id: ministryId }).eq('id', userId);
};

export const clearScheduleForMonth = async (ministryId: string, orgId: string, month: string) => {
    const sb = getSupabase();
    if (!sb) return;
    const startDate = `${month}-01`;
    const [y, m] = month.split('-');
    const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
    const endDate = `${month}-${lastDay}`;
    await sb.from('schedule_assignments').delete().eq('ministry_id', ministryId).eq('organization_id', orgId).gte('event_date', startDate).lte('event_date', endDate);
};