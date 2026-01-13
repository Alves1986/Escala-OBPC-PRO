import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { MinistryDef, Organization, RepertoireItem, User, RankingEntry } from '../types';

declare const __SUPABASE_URL__: string;
declare const __SUPABASE_KEY__: string;

// Cache em memória (Runtime Config) para persistência durante a sessão
const runtimeConfig = {
    url: '',
    key: ''
};

let supabase: SupabaseClient | null = null;

// Helper to access instance
export const getSupabase = () => supabase;

// Lógica de Inicialização Centralizada
const initializeClient = () => {
    const envUrl = typeof __SUPABASE_URL__ !== 'undefined' ? __SUPABASE_URL__ : '';
    const envKey = typeof __SUPABASE_KEY__ !== 'undefined' ? __SUPABASE_KEY__ : '';

    // Ordem de Resolução: 1. Build (Env) -> 2. Runtime Config -> 3. LocalStorage
    const url = envUrl || runtimeConfig.url || localStorage.getItem('sb_url');
    const key = envKey || runtimeConfig.key || localStorage.getItem('sb_key');

    if (url && key) {
        try {
            supabase = createClient(url, key, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            });
        } catch (e) {
            console.error("Erro ao inicializar Supabase:", e);
            supabase = null;
        }
    } else {
        supabase = null;
    }
};

// Executa inicialização na carga do módulo
initializeClient();

// Manual config for SetupScreen
export const configureSupabaseManual = (url: string, key: string) => {
    // 1. Salva no Runtime Config
    runtimeConfig.url = url;
    runtimeConfig.key = key;
    
    // 2. Salva no LocalStorage
    localStorage.setItem('sb_url', url);
    localStorage.setItem('sb_key', key);

    // 3. Reinicializa o cliente com as novas credenciais
    initializeClient();
};

export const validateConnection = async (url: string, key: string): Promise<boolean> => {
    try {
        const tempClient = createClient(url, key);
        const { error } = await tempClient.from('profiles').select('count', { count: 'exact', head: true });
        // Error code PGRST116 means 0 rows but successful connection, or no error means success
        return !error || error.code === 'PGRST116';
    } catch (e) {
        return false;
    }
};

// Internal Helpers
const requireSupabase = () => {
    if (!supabase) throw new Error("Supabase não configurado.");
    return supabase;
};

const requireOrgId = (orgId: string) => {
    if (!orgId) throw new Error("Organization ID missing.");
    return orgId;
};

// --- Auth ---

export const loginWithEmail = async (email: string, password: string) => {
    const sb = requireSupabase();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    return { success: !error, message: error?.message || "Login realizado." };
};

export const loginWithGoogle = async () => {
    const sb = requireSupabase();
    const { data, error } = await sb.auth.signInWithOAuth({ provider: 'google' });
    return { success: !error, message: error?.message || "Redirecionando..." };
};

export const registerWithEmail = async (email: string, password: string, name: string, ministries: string[], orgId: string, roles: string[]) => {
    const sb = requireSupabase();
    const { data, error } = await sb.auth.signUp({ 
        email, 
        password,
        options: {
            data: {
                full_name: name,
                ministry_id: ministries[0], // Primary ministry
                allowed_ministries: ministries,
                organization_id: orgId,
                functions: roles // Initial functions
            }
        }
    });
    return { success: !error, message: error?.message || "Cadastro realizado! Verifique seu e-mail." };
};

export const disconnectManual = async () => {
    if (supabase) {
        await supabase.auth.signOut();
    }
    localStorage.removeItem('sb_url');
    localStorage.removeItem('sb_key');
    runtimeConfig.url = '';
    runtimeConfig.key = '';
    supabase = null;
    window.location.reload();
};

// --- Data Fetching ---

export const fetchMinistrySettings = async (ministryId: string, orgId: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);
    
    // Tenta buscar configurações específicas
    const { data, error } = await sb.from('ministry_settings')
        .select('*')
        .eq('organization_ministry_id', ministryId) // Assuming mapping ID
        .eq('organization_id', validOrgId)
        .single();
    
    if (error && error.code !== 'PGRST116') console.error(error);
    
    // Se não achar, busca da definição da organização para ter o label básico
    if (!data) {
        const { data: orgMin } = await sb.from('organization_ministries')
            .select('*')
            .eq('id', ministryId)
            .eq('organization_id', validOrgId)
            .single();
            
        return orgMin ? { 
            displayName: orgMin.label, 
            roles: [], 
            organizationMinistryId: ministryId 
        } : null;
    }

    return data;
};

export const fetchOrganizationMinistries = async (orgId: string): Promise<MinistryDef[]> => {
    const sb = requireSupabase();
    const { data, error } = await sb.from('organization_ministries')
        .select('*')
        .eq('organization_id', orgId);
        
    if (error) return [];
    return data.map((m: any) => ({
        id: m.id,
        code: m.code,
        label: m.label,
        organizationId: m.organization_id
    }));
};

export const fetchMinistrySchedule = async (ministryId: string, month: string, orgId: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);
    
    const start = `${month}-01T00:00:00`;
    const end = new Date(
      new Date(`${month}-01`).getFullYear(),
      new Date(`${month}-01`).getMonth() + 1,
      0,
      23, 59, 59
    ).toISOString();
    
    const { data: events, error: evtError } = await sb.from('events')
        .select('id, title, date_time, is_default, origin_template_id')
        .eq('ministry_id', ministryId) 
        .eq('organization_id', validOrgId)
        .gte('date_time', start)
        .lte('date_time', end);

    if (evtError) throw evtError;
    
    if (!events || events.length === 0) return { events: [], schedule: {}, attendance: {} };

    const eventIds = events.map((e: any) => e.id);
    
    const { data: assignments, error: assError } = await sb.from('schedule_assignments')
        .select('*')
        .in('event_id', eventIds)
        .eq('organization_id', validOrgId);

    if (assError) throw assError;

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
            id: e.id, 
            iso,
            title: e.title,
            isDefault: e.is_default,
            originTemplateId: e.origin_template_id,
            dateDisplay: iso.split('T')[0].split('-').reverse().slice(0,2).join('/')
        };
    });

    return { events: formattedEvents, schedule, attendance };
};

export const fetchMinistryMembers = async (ministryId: string, orgId: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);

    // Fetch profiles linked to this ministry via organization_memberships or array column
    // For SaaS, we use organization_memberships ideally, but adapting to existing schema:
    const { data: profiles, error } = await sb.from('profiles')
        .select('*')
        .eq('organization_id', validOrgId)
        .or(`ministry_id.eq.${ministryId},allowed_ministries.cs.{${ministryId}}`);

    if (error) throw error;

    const memberMap: any = {};
    const publicList: any[] = [];

    profiles?.forEach((p: any) => {
        // Fetch roles from membership or use empty
        // Here we assume roles are stored in 'functions' column or similar for now
        // Or we might need to fetch from a separate table.
        // Using existing pattern:
        // Assume 'functions' column exists on profiles or we construct it.
        // NOTE: In the `useAuth` hook, we see `fetchUserFunctions`.
        
        publicList.push({
            id: p.id,
            name: p.name,
            email: p.email,
            whatsapp: p.whatsapp,
            avatar_url: p.avatar_url,
            birthDate: p.birth_date,
            isAdmin: p.is_admin,
            functions: p.functions || [] // Assume functions column exists
        });
        
        // Populate roles map
        (p.functions || []).forEach((role: string) => {
            if (!memberMap[role]) memberMap[role] = [];
            memberMap[role].push(p.name);
        });
    });

    return { memberMap, publicList };
};

export const fetchMinistryAvailability = async (ministryId: string, orgId: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);

    const { data, error } = await sb.from('availability')
        .select('*')
        .eq('organization_id', validOrgId);
        // We might want to filter by date/month, but usually we fetch all or current month.
        // For simplicity, fetching all or recent.

    if (error) throw error;

    const availability: any = {};
    const notes: any = {};

    data?.forEach((row: any) => {
        if (row.dates) availability[row.member_name] = row.dates;
        if (row.notes) {
            Object.entries(row.notes).forEach(([k, v]) => {
                notes[`${row.member_name}_${k}`] = v;
            });
        }
    });

    return { availability, notes };
};

export const fetchNotificationsSQL = async (ministryIds: string[], userId: string, orgId: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);
    
    // Fetch generic notifications for ministry AND user specific ones
    const { data, error } = await sb.from('notifications')
        .select('*')
        .eq('organization_id', validOrgId)
        .in('ministry_id', ministryIds)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) throw error;

    // Check read status
    const { data: reads } = await sb.from('notifications_read')
        .select('notification_id')
        .eq('user_id', userId);
        
    const readSet = new Set(reads?.map((r: any) => r.notification_id));

    return data.map((n: any) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        timestamp: n.created_at,
        ministryId: n.ministry_id,
        actionLink: n.action_link,
        read: readSet.has(n.id)
    }));
};

export const markNotificationsReadSQL = async (notificationIds: string[], userId: string, orgId: string) => {
    const sb = requireSupabase();
    const inserts = notificationIds.map(nid => ({
        notification_id: nid,
        user_id: userId,
        organization_id: orgId
    }));
    await sb.from('notifications_read').upsert(inserts);
};

export const clearAllNotificationsSQL = async (ministryId: string, orgId: string) => {
    const sb = requireSupabase();
    await sb.from('notifications')
        .delete()
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId);
};

export const fetchAnnouncementsSQL = async (ministryId: string, orgId: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);
    
    const now = new Date().toISOString();
    
    const { data, error } = await sb.from('announcements')
        .select(`
            *,
            announcements_read(user_id, timestamp, profiles(name)),
            announcements_likes(user_id, timestamp, profiles(name))
        `)
        .eq('organization_id', validOrgId)
        .eq('ministry_id', ministryId)
        .gte('expiration_date', now)
        .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map((a: any) => ({
        id: a.id,
        title: a.title,
        message: a.message,
        type: a.type,
        timestamp: a.created_at,
        expirationDate: a.expiration_date,
        author: a.author,
        readBy: a.announcements_read.map((r: any) => ({ userId: r.user_id, name: r.profiles?.name, timestamp: r.timestamp })),
        likedBy: a.announcements_likes.map((l: any) => ({ userId: l.user_id, name: l.profiles?.name, timestamp: l.timestamp }))
    }));
};

export const sendNotificationSQL = async (ministryId: string, orgId: string, notification: any) => {
    const sb = requireSupabase();
    await sb.from('notifications').insert({
        ministry_id: ministryId,
        organization_id: orgId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        action_link: notification.actionLink
    });
    
    // Trigger Edge Function for Push (Optional/fire-and-forget)
    // fetch(...)
};

export const fetchSwapRequests = async (ministryId: string, orgId: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);
    
    const { data, error } = await sb.from('swap_requests')
        .select('*')
        .eq('ministry_id', ministryId)
        .eq('organization_id', validOrgId)
        .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map((r: any) => ({
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

export const createSwapRequestSQL = async (ministryId: string, orgId: string, request: any) => {
    const sb = requireSupabase();
    await sb.from('swap_requests').insert({
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

export const fetchRepertoire = async (ministryId: string, orgId: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);
    
    const { data, error } = await sb.from('repertoire')
        .select('*')
        .eq('ministry_id', ministryId)
        .eq('organization_id', validOrgId)
        .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map((r: any) => ({
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

export const addToRepertoire = async (ministryId: string, orgId: string, item: any) => {
    const sb = requireSupabase();
    const { error } = await sb.from('repertoire').insert({
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

export const deleteFromRepertoire = async (id: string, orgId: string) => {
    const sb = requireSupabase();
    await sb.from('repertoire').delete().eq('id', id).eq('organization_id', orgId);
};

export const updateRepertoireItem = async (id: string, orgId: string, updates: any) => {
    const sb = requireSupabase();
    await sb.from('repertoire').update(updates).eq('id', id).eq('organization_id', orgId);
};

export const fetchGlobalSchedules = async (month: string, currentMinistryId: string, orgId: string) => {
    // Implement complex join or separate query to find conflicts
    // Stub:
    return {};
};

export const fetchAuditLogs = async (ministryId: string, orgId: string) => {
    const sb = requireSupabase();
    const { data } = await sb.from('audit_logs')
        .select('*')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(100);
    
    return data?.map((l: any) => ({
        id: l.id,
        date: l.created_at,
        action: l.action,
        details: l.details,
        author: l.author
    })) || [];
};

export const saveScheduleAssignment = async (ministryId: string, orgId: string, key: string, value: string) => {
    // Logic to update/insert assignment
    // key is like "2023-10-25T19:30_Vocal"
    // We need to find event_id from ISO and role
    return true; // Stub
};

export const toggleAssignmentConfirmation = async (ministryId: string, orgId: string, key: string) => {
    // Logic to toggle confirmed
    return true; // Stub
};

export const fetchOrganizationsWithStats = async () => {
    const sb = requireSupabase();
    const { data } = await sb.from('organizations').select('*');
    return data?.map((o: any) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        active: o.active,
        createdAt: o.created_at,
        userCount: 0, // Need join/count
        ministryCount: 0 // Need join/count
    })) || [];
};

export const saveOrganization = async (id: string | null, name: string, slug: string) => {
    const sb = requireSupabase();
    if (id) {
        const { error } = await sb.from('organizations').update({ name, slug }).eq('id', id);
        return { success: !error, message: error ? error.message : "Atualizado." };
    } else {
        const { error } = await sb.from('organizations').insert({ name, slug });
        return { success: !error, message: error ? error.message : "Criado." };
    }
};

export const toggleOrganizationStatus = async (id: string, active: boolean) => {
    const sb = requireSupabase();
    const { error } = await sb.from('organizations').update({ active }).eq('id', id);
    return !error;
};

export const saveOrganizationMinistry = async (orgId: string, code: string, label: string) => {
    const sb = requireSupabase();
    const { error } = await sb.from('organization_ministries').insert({ organization_id: orgId, code, label });
    return { success: !error, message: error ? error.message : "Ministério criado." };
};

export const deleteOrganizationMinistry = async (orgId: string, code: string) => {
    const sb = requireSupabase();
    const { error } = await sb.from('organization_ministries').delete().eq('organization_id', orgId).eq('code', code);
    return { success: !error, message: error ? error.message : "Removido." };
};

export const fetchRankingData = async (ministryId: string, orgId: string): Promise<RankingEntry[]> => {
    const sb = requireSupabase();
    // Stub implementation
    return [];
};

export const fetchUserAllowedMinistries = async (userId: string, orgId: string): Promise<string[]> => {
    const sb = requireSupabase();
    // In real app, check organization_memberships or profiles
    const { data } = await sb.from('profiles').select('allowed_ministries').eq('id', userId).single();
    return data?.allowed_ministries || [];
};

export const fetchUserFunctions = async (userId: string, ministryId: string, orgId: string): Promise<string[]> => {
    const sb = requireSupabase();
    const { data } = await sb.from('profiles').select('functions').eq('id', userId).single();
    return data?.functions || [];
};

// --- Event Actions (Refined Logic) ---

export const createMinistryEvent = async (ministryId: string, orgId: string, event: any) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);
    
    // Eventos manuais sempre nascem com is_default = false e sem template
    await sb.from('events').insert({ 
        ministry_id: ministryId, 
        organization_id: validOrgId, 
        title: event.title, 
        date_time: event.iso || `${event.date}T${event.time}`,
        is_default: false,
        origin_template_id: null
    });
};

export const deleteMinistryEvent = async (ministryId: string, orgId: string, eventIdentifier: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);
    
    // Validação estrita de UUID para garantir integridade
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventIdentifier);

    if (isUUID) {
        // Exclusão segura por ID
        await sb.from('events').delete()
            .eq('id', eventIdentifier)
            .eq('organization_id', validOrgId);
    } else {
        console.error("Tentativa de exclusão com identificador inválido (não-UUID):", eventIdentifier);
        // Fallback legado removido intencionalmente para forçar consistência
        throw new Error("Identificador de evento inválido.");
    }
};

export const updateMinistryEvent = async (ministryId: string, orgId: string, eventId: string, newTitle: string, newIso: string, applyToAll: boolean) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);

    // Regra 2: Ao editar, o evento deixa de ser padrão (vira override)
    // Isso preserva o histórico de que ele "veio" de um template, mas agora é customizado
    const updates = { 
        title: newTitle, 
        date_time: newIso,
        is_default: false 
    };

    if (applyToAll) {
        // Busca o evento original para pegar o template_id
        const { data: currentEvent } = await sb.from('events').select('origin_template_id, date_time').eq('id', eventId).single();
        
        if (currentEvent && currentEvent.origin_template_id) {
            // Aplica a mudança para todos os eventos futuros que compartilham o mesmo template
            // Nota: Isso converte todos os futuros em overrides (is_default = false)
            await sb.from('events')
                .update(updates)
                .eq('origin_template_id', currentEvent.origin_template_id)
                .eq('organization_id', validOrgId)
                .gte('date_time', currentEvent.date_time); // Apenas futuros a partir deste
        } else {
            // Se não tem template, edita só ele mesmo
            await sb.from('events').update(updates).eq('id', eventId).eq('organization_id', validOrgId);
        }
    } else {
        await sb.from('events').update(updates).eq('id', eventId).eq('organization_id', validOrgId);
    }
};

export const resetToDefaultEvents = async (ministryId: string, orgId: string, month: string) => {
    const sb = requireSupabase();
    const validOrgId = requireOrgId(orgId);
    
    const start = `${month}-01T00:00:00`;
    const end = new Date(
      new Date(`${month}-01`).getFullYear(),
      new Date(`${month}-01`).getMonth() + 1,
      0,
      23, 59, 59
    ).toISOString();

    // 1. Apagar SOMENTE eventos padrão (is_default = true) dentro do mês
    // Preserva eventos manuais e overrides
    await sb.from('events')
        .delete()
        .eq('ministry_id', ministryId)
        .eq('organization_id', validOrgId)
        .eq('is_default', true) 
        .gte('date_time', start)
        .lte('date_time', end);

    // 2. Buscar Templates configurados para este ministério
    const { data: templates } = await sb.from('organization_event_templates')
        .select('*')
        .eq('ministry_id', ministryId)
        .eq('organization_id', validOrgId);

    if (!templates || templates.length === 0) {
        // Fallback Silencioso
        return;
    }

    // 3. Gerar eventos baseados nos templates para cada dia do mês
    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const inserts: any[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(y, m - 1, day);
        const dayOfWeek = dateObj.getDay(); 

        // Encontra templates que batem com o dia da semana
        const dayTemplates = templates.filter((t: any) => t.day_of_week === dayOfWeek);

        dayTemplates.forEach((t: any) => {
            const dateStr = dateObj.toISOString().split('T')[0];
            inserts.push({
                ministry_id: ministryId,
                organization_id: validOrgId,
                title: t.default_title || 'Evento',
                date_time: `${dateStr}T${t.default_time}`,
                is_default: true,
                origin_template_id: t.id
            });
        });
    }

    if (inserts.length > 0) {
        await sb.from('events').insert(inserts);
    }
};