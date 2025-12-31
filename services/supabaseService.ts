import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
    User, MemberMap, 
    AppNotification, TeamMemberProfile, AvailabilityMap, SwapRequest, 
    ScheduleMap, RepertoireItem, Announcement, GlobalConflictMap, 
    AttendanceMap, AuditLogEntry, MinistrySettings, MinistryDef, Organization,
    RankingEntry, AvailabilityNotesMap, RankingHistoryItem, DEFAULT_TABS
} from '../types';

// ============================================================================
// CONFIGURATION & ENVIRONMENT
// ============================================================================

export let SUPABASE_URL = "";
export let SUPABASE_KEY = "";

try {
  // Vite padrão
  // @ts-ignore
  SUPABASE_URL = import.meta?.env?.VITE_SUPABASE_URL || "";
  // @ts-ignore
  SUPABASE_KEY = import.meta?.env?.VITE_SUPABASE_KEY || "";
} catch {}

try {
  // Fallback global (injeção via define)
  // @ts-ignore
  SUPABASE_URL = SUPABASE_URL || __SUPABASE_URL__ || "";
  // @ts-ignore
  SUPABASE_KEY = SUPABASE_KEY || __SUPABASE_KEY__ || "";
} catch {}

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn("Supabase env não encontrado. Verificar .env ou define");
}

let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

export const getSupabase = () => supabase;

// DEFAULT ORGANIZATION ID (Fallback for legacy data)
const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000000';

// Helper to get current user's organization ID quickly
const getCurrentOrgId = async (): Promise<string> => {
    if (!supabase) return DEFAULT_ORG_ID;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return DEFAULT_ORG_ID;
    
    // Check cached profile in Zustand store if possible, or fetch
    // For safety in service layer, we fetch or assume default if simple
    const { data } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
    return data?.organization_id || DEFAULT_ORG_ID;
};

// ... (Rest of imports and setup same as original)

// --- MEMBERSHIP & ACCESS CONTROL ---
export const fetchUserAllowedMinistries = async (userId: string, orgId: string): Promise<string[]> => {
    if (!supabase) return ['midia'];

    try {
        const { data: memberships, error } = await supabase
            .from('organization_memberships')
            .select('ministry_id')
            .eq('profile_id', userId)
            .eq('organization_id', orgId);

        if (!error && memberships && memberships.length > 0) {
            return memberships.map((m: any) => m.ministry_id);
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('allowed_ministries')
            .eq('id', userId)
            .single();

        return safeParseArray(profile?.allowed_ministries);

    } catch (e) {
        console.error("Erro ao buscar permissões de ministério:", e);
        return ['midia']; 
    }
};

// --- SUPER ADMIN: Organization Management ---
export const fetchOrganizationsWithStats = async (): Promise<Organization[]> => {
    if (!supabase) return [];
    
    const { data, error } = await supabase.rpc('get_orgs_with_details');
    
    if (error) {
        console.error("Error fetching orgs with stats:", error);
        return fetchAllOrganizations(); 
    }
    
    return (data || []).map((o: any) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        active: o.active,
        createdAt: o.created_at,
        userCount: o.user_count,
        ministries: (o.ministries || []).map((m: any) => ({
            id: m.id,
            code: m.code,
            label: m.label,
            organizationId: o.id
        })),
        ministryCount: (o.ministries || []).length
    }));
};

export const fetchAllOrganizations = async (): Promise<Organization[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error("Error fetching organizations:", error);
        return [];
    }
    
    return (data || []).map((o: any) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        active: o.active,
        createdAt: o.created_at
    }));
};

export const saveOrganization = async (id: string | null, name: string, slug?: string): Promise<{ success: boolean, message: string }> => {
    if (!supabase) return { success: false, message: "Offline" };
    
    const payload: any = { name };
    if (slug) payload.slug = slug;

    let error;
    if (id) {
        const { error: updateError } = await supabase.from('organizations').update(payload).eq('id', id);
        error = updateError;
    } else {
        const { error: insertError } = await supabase.from('organizations').insert(payload);
        error = insertError;
    }

    if (error) return { success: false, message: error.message };
    return { success: true, message: "Organização salva com sucesso!" };
};

export const toggleOrganizationStatus = async (id: string, currentStatus: boolean): Promise<boolean> => {
    if (!supabase) return false;
    const { error } = await supabase
        .from('organizations')
        .update({ active: !currentStatus })
        .eq('id', id);
    return !error;
};

// --- SUPER ADMIN: Ministry Management (Relational) ---
export const saveOrganizationMinistry = async (orgId: string, code: string, label: string): Promise<{ success: boolean, message: string }> => {
    if (!supabase) return { success: false, message: "Offline" };

    const cleanCode = code.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const { data: ministry, error } = await supabase
            .from('organization_ministries')
            .upsert({ 
                organization_id: orgId, 
                code: cleanCode, 
                label: label.trim() 
            }, { onConflict: 'organization_id, code' })
            .select()
            .single();

        if (error) throw error;

        if (ministry) {
            await supabase.from('ministry_settings').upsert({
                organization_id: orgId,
                ministry_id: cleanCode, 
                organization_ministry_id: ministry.id, 
                display_name: label.trim(),
                roles: [] 
            }, { onConflict: 'organization_id, ministry_id' });
        }

        return { success: true, message: "Ministério salvo com sucesso!" };
    } catch(err: any) {
        return { success: false, message: err.message };
    }
};

export const deleteOrganizationMinistry = async (orgId: string, code: string): Promise<{ success: boolean, message: string }> => {
    if (!supabase) return { success: false, message: "Offline" };

    const { error } = await supabase
        .from('organization_ministries')
        .delete()
        .eq('organization_id', orgId)
        .eq('code', code);

    if (error) return { success: false, message: error.message };
    return { success: true, message: "Ministério removido." };
};

// --- UTILS ---
const safeParseArray = (value: any): string[] => {
    if (!value) return [];
    if (Array.isArray(value)) {
        return value.map(v => String(v).replace(/^"+|"+$/g, '').trim()).filter(v => v);
    }
    if (typeof value === 'string') {
        const cleaned = value.trim();
        if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
            try { 
                const parsed = JSON.parse(cleaned);
                if (Array.isArray(parsed)) {
                    return parsed.map(v => String(v).replace(/^"+|"+$/g, '').trim()).filter(v => v);
                }
            } catch(e) {}
        }
        return [cleaned];
    }
    return [];
};

// --- NEW FUNCTION: Fetch Ministries by Organization ---
export const fetchOrganizationMinistries = async (organizationId: string): Promise<MinistryDef[]> => {
    if (!supabase) return [];
    
    const orgId = organizationId || DEFAULT_ORG_ID;

    const { data, error } = await supabase
        .from('organization_ministries')
        .select('id, code, label')
        .eq('organization_id', orgId)
        .order('label');

    if (error) {
        console.error("Error fetching ministries:", error);
        return [];
    }

    if (!data || data.length === 0) {
        if (orgId === DEFAULT_ORG_ID) {
            return [
                { id: 'uuid-1', code: 'midia', label: 'Comunicação / Mídia', enabledTabs: DEFAULT_TABS, organizationId: orgId },
                { id: 'uuid-2', code: 'louvor', label: 'Louvor / Adoração', enabledTabs: DEFAULT_TABS, organizationId: orgId },
                { id: 'uuid-3', code: 'infantil', label: 'Ministério Infantil', enabledTabs: DEFAULT_TABS, organizationId: orgId }
            ];
        }
        return [];
    }

    return data.map((m: any) => ({
        id: m.id,
        code: m.code,
        label: m.label,
        enabledTabs: DEFAULT_TABS, 
        organizationId: orgId
    }));
};

export const loginWithEmail = async (email: string, pass: string) => {
    if (!supabase) return { success: true, message: "Demo Login" };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) return { success: false, message: error.message };
    return { success: true, message: "Login realizado!" };
};

export const loginWithGoogle = async () => {
    if (!supabase) return { success: false, message: "Supabase não configurado" };
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) return { success: false, message: error.message };
    return { success: true, message: "Redirecionando..." };
};

export const registerWithEmail = async (email: string, pass: string, name: string, ministries: string[], phone?: string, functions?: string[]) => {
    if (!supabase) return { success: false, message: "Supabase Off" };
    const { data, error } = await supabase.auth.signUp({ 
        email, password: pass, options: { data: { name, full_name: name } }
    });
    if (error) return { success: false, message: error.message };
    if (data.user) {
        const mainMinistry = ministries[0] || 'midia';
        const defaultOrgId = DEFAULT_ORG_ID;
        
        await supabase.from('profiles').insert({
            id: data.user.id, 
            email, 
            name, 
            ministry_id: mainMinistry, 
            allowed_ministries: ministries, 
            organization_id: defaultOrgId, 
            whatsapp: phone, 
            functions: functions || []
        });
        
        for (const mid of ministries) {
            await supabase.from('organization_memberships').insert({
                organization_id: defaultOrgId,
                profile_id: data.user.id,
                ministry_id: mid,
                role: 'member'
            });
        }

        await sendNotificationSQL(mainMinistry, { title: "Novo Membro", message: `${name} acabou de se cadastrar na equipe!`, type: 'success', actionLink: 'members' });
    }
    return { success: true, message: "Cadastro realizado!" };
};

export const logout = async () => { if (supabase) await supabase.auth.signOut(); window.location.reload(); };
export const sendPasswordResetEmail = async (email: string) => { if (!supabase) return { success: false }; const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' }); return { success: !error, message: error ? error.message : "Email enviado!" }; };

export const fetchMinistryMembers = async (ministryId: string): Promise<{ memberMap: MemberMap, publicList: TeamMemberProfile[] }> => {
    if (!supabase) return { memberMap: {}, publicList: [] };
    
    const orgId = await getCurrentOrgId();

    // UPDATE: Filter by Org ID first to allow duplicates across orgs (SaaS fix)
    let query = supabase.from('profiles').select('*');
    if (orgId && orgId !== DEFAULT_ORG_ID) {
        query = query.eq('organization_id', orgId);
    }
    
    const { data } = await query;
    
    const filteredData = (data || []).filter((p: any) => { 
        const allowed = safeParseArray(p.allowed_ministries); 
        return allowed.includes(ministryId) || p.ministry_id === ministryId; 
    });
    
    const publicList: TeamMemberProfile[] = filteredData.map((p: any) => ({
        id: p.id, 
        name: p.name, 
        email: p.email, 
        whatsapp: p.whatsapp, 
        avatar_url: p.avatar_url, 
        roles: safeParseArray(p.functions), 
        birthDate: p.birth_date, 
        isAdmin: p.is_admin,
        organizationId: p.organization_id
    }));
    
    const memberMap: MemberMap = {};
    publicList.forEach(m => { if (m.roles) { m.roles.forEach(r => { if (!memberMap[r]) memberMap[r] = []; memberMap[r].push(m.name); }); } });
    return { memberMap, publicList };
};

export const joinMinistry = async (ministryId: string, roles: string[]) => {
    if (!supabase) return { success: false, message: "Erro" };
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false };
    
    const { data: profile } = await supabase.from('profiles').select('allowed_ministries, functions, organization_id').eq('id', user.id).single();
    
    const currentAllowed = safeParseArray(profile?.allowed_ministries);
    const currentFunctions = safeParseArray(profile?.functions);
    const newAllowed = [...new Set([...currentAllowed, ministryId])];
    const newFunctions = [...new Set([...currentFunctions, ...roles])];
    
    const { error } = await supabase.from('profiles').update({ allowed_ministries: newAllowed, functions: newFunctions, ministry_id: ministryId }).eq('id', user.id);
    
    const orgId = profile?.organization_id || DEFAULT_ORG_ID;
    await supabase.from('organization_memberships').upsert({
        organization_id: orgId,
        profile_id: user.id,
        ministry_id: ministryId,
        role: 'member'
    }, { onConflict: 'organization_id, profile_id, ministry_id' });

    return { success: !error, message: error ? error.message : "Entrou no ministério!" };
};

export const updateProfileMinistry = async (userId: string, ministryId: string) => { if (!supabase) return; await supabase.from('profiles').update({ ministry_id: ministryId }).eq('id', userId); };
export const updateUserProfile = async (name: string, whatsapp: string, avatar: string | undefined, functions: string[] | undefined, birthDate: string | undefined, currentMinistryId?: string) => { if (!supabase) return { success: false, message: "Offline" }; const { data: { user } } = await supabase.auth.getUser(); if (!user) return { success: false }; const updates: any = { name, whatsapp }; if (birthDate) updates.birth_date = birthDate; else updates.birth_date = null; if (avatar) updates.avatar_url = avatar; if (functions) updates.functions = functions; const { error } = await supabase.from('profiles').update(updates).eq('id', user.id); return { success: !error, message: error ? error.message : "Perfil atualizado!" }; };
export const updateMemberData = async (memberId: string, data: { name?: string, roles?: string[], whatsapp?: string }) => { if (!supabase) return { success: false, message: "Offline" }; const updates: any = { }; if (data.name) updates.name = data.name; if (data.roles) updates.functions = data.roles; if (data.whatsapp) updates.whatsapp = data.whatsapp; const { error } = await supabase.from('profiles').update(updates).eq('id', memberId); return { success: !error, message: error ? error.message : "Membro atualizado com sucesso!" }; };
export const toggleAdminSQL = async (email: string, status: boolean, ministryId: string) => { if (!supabase) return; await supabase.functions.invoke('push-notification', { body: { action: 'toggle_admin', targetEmail: email, status, ministryId } }); };
export const deleteMember = async (ministryId: string, memberId: string, name: string) => { if (!supabase) return { success: false }; const { error } = await supabase.functions.invoke('push-notification', { body: { action: 'delete_member', memberId, ministryId } }); return { success: !error, message: error ? "Erro" : "Removido" }; };

// --- SETTINGS WITH STRICT TENANT SCOPING ---
export const fetchMinistrySettings = async (ministryCode: string): Promise<MinistrySettings> => { 
    if (!supabase) return { displayName: '', roles: [] }; 
    const orgId = await getCurrentOrgId(); 

    const { data } = await supabase
        .from('ministry_settings')
        .select('*')
        .eq('ministry_id', ministryCode) 
        .eq('organization_id', orgId)
        .single();
    
    if (!data) return { displayName: '', roles: [] }; 
    
    return { 
        id: data.id,
        organizationMinistryId: data.organization_ministry_id,
        displayName: data.display_name, 
        roles: safeParseArray(data.roles), 
        availabilityStart: data.availability_start, 
        availabilityEnd: data.availability_end, 
        spotifyClientId: data.spotify_client_id, 
        spotifyClientSecret: data.spotify_client_secret,
        organizationId: data.organization_id
    }; 
};

export const saveMinistrySettings = async (ministryId: string, displayName?: string, roles?: string[], availabilityStart?: string, availabilityEnd?: string, spotifyClientId?: string, spotifyClientSecret?: string) => { 
    if (!supabase) return; 
    const orgId = await getCurrentOrgId();

    const updates: any = {}; 
    if (displayName !== undefined) updates.display_name = displayName; 
    if (roles !== undefined) updates.roles = roles; 
    if (availabilityStart !== undefined) updates.availability_start = availabilityStart; 
    if (availabilityEnd !== undefined) updates.availability_end = availabilityEnd; 
    if (spotifyClientId !== undefined) updates.spotify_client_id = spotifyClientId; 
    if (spotifyClientSecret !== undefined) updates.spotify_client_secret = spotifyClientSecret; 
    
    await supabase.from('ministry_settings').upsert({ 
        ministry_id: ministryId, 
        organization_id: orgId,
        ...updates 
    }, { onConflict: 'organization_id, ministry_id' }); 
};

export const fetchMinistrySchedule = async (ministryId: string, month: string) => { if (!supabase) return { events: [], schedule: {}, attendance: {} }; const startDate = `${month}-01`; const [y, m] = month.split('-').map(Number); const nextMonth = new Date(y, m, 1).toISOString().slice(0, 7); const { data: eventsData } = await supabase.from('events').select('*').eq('ministry_id', ministryId).gte('date_time', startDate).lt('date_time', `${nextMonth}-01`).order('date_time'); const events = (eventsData || []).map((e: any) => ({ id: e.id, iso: e.date_time.slice(0, 16), title: e.title, date: e.date_time.slice(0, 10), time: e.date_time.slice(11, 16), dateDisplay: e.date_time.slice(0, 10).split('-').reverse().slice(0, 2).join('/'), organizationId: e.organization_id })); const eventIds = events.map(e => e.id); const schedule: ScheduleMap = {}; const attendance: AttendanceMap = {}; if (eventIds.length > 0) { const { data: assigns } = await supabase.from('schedule_assignments').select('event_id, role, member_id, confirmed, profiles(name)').in('event_id', eventIds); (assigns || []).forEach((a: any) => { const evt = events.find(e => e.id === a.event_id); if (evt && a.profiles) { const key = `${evt.iso}_${a.role}`; schedule[key] = a.profiles.name; if (a.confirmed) attendance[key] = true; } }); } return { events, schedule, attendance }; };

// --- WRITE OPS UPDATED FOR ORG ID ---
export const createMinistryEvent = async (ministryId: string, event: { title: string, date: string, time: string, organizationId?: string }) => { 
    if (!supabase) return; 
    const orgId = event.organizationId || await getCurrentOrgId();
    await supabase.from('events').insert({ 
        ministry_id: ministryId, 
        title: event.title, 
        date_time: `${event.date}T${event.time}:00`,
        organization_id: orgId
    }); 
    await logAction(ministryId, 'Criou Evento', `Evento: ${event.title} em ${event.date}`, orgId); 
};

export const updateMinistryEvent = async (ministryId: string, oldIso: string, newTitle: string, newIso: string, applyToAll: boolean) => { if (!supabase) return; const { data: event } = await supabase.from('events').select('id, organization_id').eq('ministry_id', ministryId).eq('date_time', oldIso + ':00').single(); if (event) { await supabase.from('events').update({ title: newTitle, date_time: newIso + ':00' }).eq('id', event.id); await logAction(ministryId, 'Editou Evento', `De ${oldIso} para ${newIso} - ${newTitle}`, event.organization_id); } };
export const deleteMinistryEvent = async (ministryId: string, iso: string) => { if (!supabase) return; const date_time = iso.length === 16 ? iso + ':00' : iso; await supabase.from('events').delete().eq('ministry_id', ministryId).eq('date_time', date_time); await logAction(ministryId, 'Excluiu Evento', `Data: ${iso}`); };

// --- AUDIT LOG ---
const logAction = async (ministryId: string, action: string, details: string, organizationId?: string) => {
    if (!supabase) return;
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const author = user?.user_metadata?.full_name || user?.email || 'Sistema';
        const orgId = organizationId || await getCurrentOrgId();
        
        await supabase.from('audit_logs').insert({
            ministry_id: ministryId,
            action,
            details,
            author_name: author,
            created_at: new Date().toISOString(),
            organization_id: orgId
        });
    } catch (e) { console.error("Audit fail", e); }
};

export const fetchAuditLogs = async (ministryId: string): Promise<AuditLogEntry[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('audit_logs')
        .select('*')
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

// FIX: Robust assignment saving that handles duplicate names and organization scoping
export const saveScheduleAssignment = async (ministryId: string, key: string, memberId: string | null) => {
    if (!supabase) return true;
    try {
        const [iso, ...roleParts] = key.split('_');
        const role = roleParts.join('_');
        const date_time = iso + ':00';
        
        // 1. Get Event to find Organization ID
        const { data: event, error: eventError } = await supabase.from('events').select('id, title, organization_id').eq('ministry_id', ministryId).eq('date_time', date_time).single();
        
        if (eventError || !event) {
            console.error("Evento não encontrado:", date_time, ministryId);
            return false;
        }

        // 2. Handle Removal
        if (!memberId) {
            await supabase.from('schedule_assignments').delete().eq('event_id', event.id).eq('role', role);
            await logAction(ministryId, 'Removeu Escala', `${role} removido de ${event.title} (${iso})`, event.organization_id);
            return true;
        }

        // 3. Find Member by UUID
        const { data: profile } = await supabase
            .from('profiles')
            .select('id, name, organization_id')
            .eq('id', memberId)
            .single();
        
        if (!profile) {
            console.error(`Membro com ID '${memberId}' não encontrado no banco.`);
            return false;
        }
        
        // 4. Save Assignment
        const { error: saveError } = await supabase.from('schedule_assignments').upsert({ 
            event_id: event.id, 
            role, 
            member_id: profile.id, 
            confirmed: false,
            ministry_id: ministryId, 
            organization_id: profile.organization_id 
        }, { onConflict: 'event_id,role' });

        if (saveError) {
            console.error("Erro ao salvar:", saveError);
            return false;
        }

        await logAction(ministryId, 'Alterou Escala', `${profile.name} escalado como ${role} em ${event.title} (${iso})`, profile.organization_id);
        return true;
    } catch (e) {
        console.error("Save schedule error:", e);
        return false;
    }
};

export const toggleAssignmentConfirmation = async (ministryId: string, key: string) => { if (!supabase) return false; try { const [iso, ...roleParts] = key.split('_'); const role = roleParts.join('_'); const date_time = iso + ':00'; const { data: event } = await supabase.from('events').select('id, title, organization_id').eq('ministry_id', ministryId).eq('date_time', date_time).single(); if (!event) return false; const { data: assign } = await supabase.from('schedule_assignments').select('confirmed, member_id').eq('event_id', event.id).eq('role', role).single(); if (assign) { await supabase.from('schedule_assignments').update({ confirmed: !assign.confirmed }).eq('event_id', event.id).eq('role', role); await logAction(ministryId, 'Status Presença', `Status alterado para ${!assign.confirmed} (${role})`, event.organization_id); return true; } } catch(e) { console.error(e); } return false; };
export const clearScheduleForMonth = async (ministryId: string, month: string) => { if (!supabase) return; const startDate = `${month}-01T00:00:00`; const [y, m] = month.split('-').map(Number); const nextMonth = new Date(y, m, 1).toISOString(); const { data: events } = await supabase.from('events').select('id, organization_id').eq('ministry_id', ministryId).gte('date_time', startDate).lt('date_time', nextMonth); const eventIds = events?.map((e: any) => e.id) || []; if (eventIds.length > 0) { await supabase.from('schedule_assignments').delete().in('event_id', eventIds); await logAction(ministryId, 'Limpeza Mensal', `Escala limpa para ${month}`, events![0]?.organization_id); } };
export const resetToDefaultEvents = async (ministryId: string, month: string) => { if (!supabase) return; const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-'); const orgId = await getCurrentOrgId(); const [y, m] = month.split('-').map(Number); const startDate = `${month}-01T00:00:00`; const nextMonth = new Date(y, m, 1).toISOString(); try { await clearScheduleForMonth(cleanMid, month); const { error: deleteError } = await supabase.from('events').delete().eq('ministry_id', cleanMid).gte('date_time', startDate).lt('date_time', nextMonth); if (deleteError) throw deleteError; const daysInMonth = new Date(y, m, 0).getDate(); const eventsToInsert = []; for (let d = 1; d <= daysInMonth; d++) { const date = new Date(y, m - 1, d, 12, 0, 0); const dayOfWeek = date.getDay(); const dateStr = `${month}-${String(d).padStart(2, '0')}`; if (dayOfWeek === 0) { eventsToInsert.push({ ministry_id: cleanMid, title: "Culto da Família", date_time: `${dateStr}T18:00:00`, organization_id: orgId }); } else if (dayOfWeek === 3) { eventsToInsert.push({ ministry_id: cleanMid, title: "Culto de Doutrina", date_time: `${dateStr}T19:30:00`, organization_id: orgId }); } } if (eventsToInsert.length > 0) { await supabase.from('events').insert(eventsToInsert); } await logAction(ministryId, 'Reset Eventos', `Eventos padrão restaurados para ${month}`, orgId); } catch (error) { console.error("Erro ao restaurar eventos:", error); } };

export const fetchMinistryAvailability = async (ministryId: string) => {
    if (!supabase) return { availability: {}, notes: {} };
    const { data: profiles } = await supabase.from('profiles').select('id, name, allowed_ministries, ministry_id');
    if (!profiles) return { availability: {}, notes: {} };
    const filteredProfiles = profiles.filter((p: any) => {
        const allowed = safeParseArray(p.allowed_ministries);
        return allowed.includes(ministryId) || p.ministry_id === ministryId;
    });
    const memberIds = filteredProfiles.map((p: any) => p.id);
    if (memberIds.length === 0) return { availability: {}, notes: {} };
    
    const { data: avails } = await supabase.from('availability')
        .select('*')
        .eq('ministry_id', ministryId) 
        .in('member_id', memberIds); 
        
    const availability: AvailabilityMap = {};
    const notes: AvailabilityNotesMap = {};
    (avails || []).forEach((a: any) => {
        const profile = filteredProfiles.find((p: any) => p.id === a.member_id);
        if (profile) {
            if (!availability[profile.name]) availability[profile.name] = [];
            const dates = safeParseArray(a.dates);
            availability[profile.name] = [...(availability[profile.name] || []), ...dates];
            if (a.notes) { Object.entries(a.notes).forEach(([dayKey, note]) => { notes[`${profile.name}_${dayKey}`] = note as string; }); }
        }
    });
    Object.keys(availability).forEach(key => { availability[key] = [...new Set(availability[key])]; });
    return { availability, notes };
};

export const saveMemberAvailability = async (
  ministryId: string,
  memberId: string,
  dates: string[],
  notes: Record<string, string>,
  targetMonth: string
) => {
  if (!supabase) return { error: { message: "Sem conexão" } };

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", memberId)
      .single();

    if (!profile) throw new Error("Perfil não encontrado");

    const monthDates = dates.filter(d => d.startsWith(targetMonth));

    const filteredNotes: Record<string, string> = {};
    Object.entries(notes).forEach(([k, v]) => {
      if (k.startsWith(targetMonth) && v?.trim()) filteredNotes[k] = v;
    });

    const { error } = await supabase
      .from("availability")
      .upsert(
        {
          member_id: memberId,
          ministry_id: ministryId,
          month: targetMonth,
          dates: monthDates,
          notes: filteredNotes,
          organization_id: profile.organization_id
        },
        { onConflict: "member_id, ministry_id, month" }
      );

    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    console.error(err);
    return { error: { message: err.message } };
  }
};

export const fetchNotificationsSQL = async (ministryIds: string[], userId: string): Promise<AppNotification[]> => { if (!supabase) return []; const { data: notifs } = await supabase.from('notifications').select('*').in('ministry_id', ministryIds).order('created_at', { ascending: false }).limit(20); const { data: reads } = await supabase.from('notification_reads').select('notification_id').eq('user_id', userId); const readSet = new Set(reads?.map((r: any) => r.notification_id)); return (notifs || []).map((n: any) => ({ id: n.id, ministryId: n.ministry_id, title: n.title, message: n.message, type: n.type, actionLink: n.action_link, timestamp: n.created_at, read: readSet.has(n.id), organizationId: n.organization_id })); };
export const sendNotificationSQL = async (ministryId: string, notification: { title: string, message: string, type?: string, actionLink?: string, organizationId?: string }) => { if (!supabase) return; const orgId = notification.organizationId || await getCurrentOrgId(); const { data, error } = await supabase.from('notifications').insert({ ministry_id: ministryId, title: notification.title, message: notification.message, type: notification.type || 'info', action_link: notification.actionLink, organization_id: orgId }).select(); await supabase.functions.invoke('push-notification', { body: { ministryId, title: notification.title, message: notification.message, type: notification.type, actionLink: notification.actionLink } }); return !error; };
export const markNotificationsReadSQL = async (ids: string[], userId: string) => { if (!supabase) return; const inserts = ids.map(id => ({ notification_id: id, user_id: userId })); await supabase.from('notification_reads').insert(inserts); };
export const clearAllNotificationsSQL = async (ministryId: string) => { if (!supabase) return; await supabase.from('notifications').delete().eq('ministry_id', ministryId); };
export const fetchAnnouncementsSQL = async (ministryId: string): Promise<Announcement[]> => { if (!supabase) return []; const today = new Date().toISOString(); const { data } = await supabase.from('announcements').select('*, announcement_interactions(user_id, interaction_type, profiles(name))').eq('ministry_id', ministryId).gte('expiration_date', today).order('created_at', { ascending: false }); return (data || []).map((a: any) => { const interactions = a.announcement_interactions || []; const readBy = interactions.filter((i: any) => i.interaction_type === 'read').map((i: any) => ({ userId: i.user_id, name: i.profiles?.name, timestamp: '' })); const likedBy = interactions.filter((i: any) => i.interaction_type === 'like').map((i: any) => ({ userId: i.user_id, name: i.profiles?.name, timestamp: '' })); return { id: a.id, title: a.title, message: a.message, type: a.type, timestamp: a.created_at, expirationDate: a.expiration_date, author: a.author_name, readBy, likedBy, organizationId: a.organization_id }; }); };
export const createAnnouncementSQL = async (ministryId: string, ann: { title: string, message: string, type: string, expirationDate: string }, authorName: string) => { if (!supabase) return; const orgId = await getCurrentOrgId(); await supabase.from('announcements').insert({ ministry_id: ministryId, title: ann.title, message: ann.message, type: ann.type, expiration_date: ann.expirationDate, author_name: authorName, organization_id: orgId }); };
export const interactAnnouncementSQL = async (announcementId: string, userId: string, userName: string, type: 'read' | 'like') => { if (!supabase) return; if (type === 'read') { await supabase.from('announcement_interactions').insert({ announcement_id: announcementId, user_id: userId, interaction_type: 'read' }).select(); } else { const { data } = await supabase.from('announcement_interactions').select('id').eq('announcement_id', announcementId).eq('user_id', userId).eq('interaction_type', 'like'); if (data && data.length > 0) { await supabase.from('announcement_interactions').delete().eq('id', data[0].id); } else { await supabase.from('announcement_interactions').insert({ announcement_id: announcementId, user_id: userId, interaction_type: 'like' }); } } };
export const fetchSwapRequests = async (ministryId: string): Promise<SwapRequest[]> => { if (!supabase) return []; const { data } = await supabase.from('swap_requests').select('*').eq('ministry_id', ministryId).order('created_at', { ascending: false }); return (data || []).map((r: any) => ({ id: r.id, ministryId: r.ministry_id, requesterName: r.requester_name, requesterId: r.requester_id, role: r.role, eventIso: r.event_iso, eventTitle: r.event_title, status: r.status, createdAt: r.created_at, takenByName: r.taken_by_name, organizationId: r.organization_id })); };

export const createSwapRequestSQL = async (ministryId: string, request: SwapRequest) => { 
    if (!supabase) return true; 
    const orgId = request.organizationId || await getCurrentOrgId();
    const { error } = await supabase.from('swap_requests').insert({ 
        ministry_id: ministryId, 
        requester_id: request.requesterId, 
        requester_name: request.requesterName, 
        role: request.role, 
        event_iso: request.eventIso, 
        event_title: request.eventTitle, 
        status: 'pending',
        organization_id: orgId
    }); 
    
    if (!error) {
        await sendNotificationSQL(ministryId, {
            title: "🔄 Pedido de Troca",
            message: `${request.requesterName} solicitou troca para ${request.role}.`,
            type: 'warning',
            actionLink: 'swaps',
            organizationId: orgId
        });
    }

    return !error; 
};

export const cancelSwapRequestSQL = async (requestId: string) => {
    if (!supabase) return false;
    const { error } = await supabase.from('swap_requests').delete().eq('id', requestId);
    return !error;
};

export const performSwapSQL = async (ministryId: string, reqId: string, takerName: string, takerId: string) => {
    if (!supabase) return { success: false, message: "Offline" };
    try {
        const { data, error } = await supabase.rpc('perform_swap', {
            p_swap_id: reqId,
            p_taker_id: takerId,
            p_taker_name: takerName
        });
        if (error) throw error;
        const result = data as { success: boolean, message: string };
        const orgId = await getCurrentOrgId(); // Assumes current user takes it
        if (result.success) {
            await sendNotificationSQL(ministryId, { 
                title: "✅ Troca Realizada", 
                message: `${takerName} assumiu a escala. O pedido foi finalizado com sucesso.`, 
                type: 'success',
                actionLink: 'calendar',
                organizationId: orgId
            });
            await logAction(ministryId, 'Troca Escala', `${takerName} assumiu vaga de troca (Pedido ${reqId})`, orgId);
        }
        return result;
    } catch (err: any) {
        console.error("Erro na troca (RPC):", err);
        return { success: false, message: "Erro ao processar troca. Tente novamente." };
    }
};

export const fetchRepertoire = async (ministryId: string): Promise<RepertoireItem[]> => { 
    if (!supabase) return []; 
    const { data } = await supabase.from('repertoire').select('*').eq('ministry_id', ministryId).order('event_date', { ascending: false }); 
    return (data || []).map((r: any) => ({ 
        id: r.id, 
        title: r.title, 
        link: r.link, 
        date: r.event_date, 
        addedBy: r.added_by, 
        createdAt: r.created_at,
        content: r.content, // New field
        key: r.key, // New field
        organizationId: r.organization_id
    })); 
};

export const addToRepertoire = async (ministryId: string, item: { title: string, link: string, date: string, addedBy: string, content?: string, key?: string }) => { 
    if (!supabase) return true; 
    const orgId = await getCurrentOrgId();
    const { error } = await supabase.from('repertoire').insert({ 
        ministry_id: ministryId, 
        title: item.title, 
        link: item.link, 
        event_date: item.date, 
        added_by: item.addedBy,
        content: item.content, // New field
        key: item.key, // New field
        organization_id: orgId
    }); 
    return !error; 
};

export const updateRepertoireItem = async (itemId: string, updates: { content?: string, key?: string }) => {
    if (!supabase) return;
    await supabase.from('repertoire').update(updates).eq('id', itemId);
};

export const deleteFromRepertoire = async (itemId: string) => { if (!supabase) return; await supabase.from('repertoire').delete().eq('id', itemId); };

export const fetchGlobalSchedules = async (month: string, currentMinistryId: string): Promise<GlobalConflictMap> => {
    if (!supabase) return {};
    const startDate = `${month}-01T00:00:00`;
    const [y, m] = month.split('-').map(Number);
    const nextMonth = new Date(y, m, 1).toISOString();

    try {
        const { data: events } = await supabase.from('events')
            .select('id, date_time, ministry_id')
            .gte('date_time', startDate)
            .lt('date_time', nextMonth)
            .neq('ministry_id', currentMinistryId);

        if (!events || events.length === 0) return {};

        const eventIds = events.map((e: any) => e.id);
        const eventMap: Record<string, any> = {};
        events.forEach((e: any) => eventMap[e.id] = e);

        const { data: assignments } = await supabase.from('schedule_assignments')
            .select('event_id, role, profiles(name)')
            .in('event_id', eventIds);

        const conflictMap: GlobalConflictMap = {};

        (assignments || []).forEach((a: any) => {
            const memberName = a.profiles?.name;
            if (!memberName) return;
            const normalizedName = memberName.toLowerCase().trim();
            const evt = eventMap[a.event_id];

            if (!conflictMap[normalizedName]) conflictMap[normalizedName] = [];
            
            conflictMap[normalizedName].push({
                ministryId: evt.ministry_id,
                eventIso: evt.date_time.slice(0, 16),
                role: a.role
            });
        });

        return conflictMap;
    } catch (e) {
        console.error("Conflict fetch error", e);
        return {};
    }
};

export const fetchRankingData = async (ministryId: string): Promise<RankingEntry[]> => {
    if (!supabase) return [];
    
    const { data: profiles } = await supabase.from('profiles').select('id, name, avatar_url, allowed_ministries, ministry_id');
    const members = (profiles || []).filter((p: any) => { 
        const allowed = safeParseArray(p.allowed_ministries); 
        return allowed.includes(ministryId) || p.ministry_id === ministryId; 
    });
    const memberIds = members.map((m: any) => m.id);
    
    if (memberIds.length === 0) return [];

    const currentYear = new Date().getFullYear();
    const startOfYear = `${currentYear}-01-01T00:00:00`;

    const { data: events } = await supabase.from('events').select('id, date_time, title').eq('ministry_id', ministryId).gte('date_time', startOfYear);
    const eventIds = events?.map((e: any) => e.id) || [];
    const eventMap = events?.reduce((acc: any, evt: any) => { acc[evt.id] = evt; return acc; }, {}) || {};

    let assignments: any[] = [];
    if (eventIds.length > 0) {
        const { data } = await supabase.from('schedule_assignments')
            .select('member_id, confirmed, event_id')
            .in('event_id', eventIds)
            .in('member_id', memberIds)
            .eq('confirmed', true);
        assignments = data || [];
    }

    const { data: swaps } = await supabase.from('swap_requests')
        .select('requester_id, created_at, event_title')
        .eq('ministry_id', ministryId)
        .gte('created_at', startOfYear)
        .in('requester_id', memberIds);

    const { data: announcements } = await supabase.from('announcements')
        .select('id, title')
        .eq('ministry_id', ministryId)
        .gte('created_at', startOfYear);
    
    const annMap = announcements?.reduce((acc: any, a: any) => { acc[a.id] = a.title; return acc; }, {}) || {};
    const annIds = announcements?.map((a: any) => a.id) || [];

    let interactions: any[] = [];
    if (annIds.length > 0) {
        const { data } = await supabase.from('announcement_interactions')
            .select('user_id, interaction_type, announcement_id, created_at')
            .in('announcement_id', annIds)
            .in('user_id', memberIds);
        interactions = data || [];
    }

    const rankingMap: Record<string, RankingEntry> = {};
    
    members.forEach((m: any) => {
        rankingMap[m.id] = {
            memberId: m.id,
            name: m.name,
            avatar_url: m.avatar_url,
            points: 0,
            stats: { confirmedEvents: 0, missedEvents: 0, swapsRequested: 0, announcementsRead: 0, announcementsLiked: 0 },
            history: [] 
        };
    });

    assignments.forEach((a: any) => {
        if (rankingMap[a.member_id]) {
            rankingMap[a.member_id].points += 100;
            rankingMap[a.member_id].stats.confirmedEvents++;
            
            const evt = eventMap[a.event_id];
            rankingMap[a.member_id].history.push({
                id: `assign_${a.event_id}`,
                date: evt ? evt.date_time : new Date().toISOString(),
                description: evt ? `Escala: ${evt.title}` : 'Escala Cumprida',
                points: 100,
                type: 'assignment'
            });
        }
    });

    swaps?.forEach((s: any) => {
        if (rankingMap[s.requester_id]) {
            rankingMap[s.requester_id].points -= 50;
            rankingMap[s.requester_id].stats.swapsRequested++;
            rankingMap[s.requester_id].history.push({
                id: `swap_${s.created_at}`,
                date: s.created_at,
                description: `Troca solicitada: ${s.event_title}`,
                points: -50,
                type: 'swap_penalty'
            });
        }
    });

    interactions.forEach((i: any) => {
        if (rankingMap[i.user_id]) {
            const annTitle = annMap[i.announcement_id] || 'Aviso';
            
            if (i.interaction_type === 'read') {
                rankingMap[i.user_id].points += 5;
                rankingMap[i.user_id].stats.announcementsRead++;
                rankingMap[i.user_id].history.push({
                    id: `read_${i.announcement_id}`,
                    date: i.created_at || new Date().toISOString(),
                    description: `Leu aviso: "${annTitle}"`,
                    points: 5,
                    type: 'announcement_read'
                });
            } else if (i.interaction_type === 'like') {
                rankingMap[i.user_id].points += 10;
                rankingMap[i.user_id].stats.announcementsLiked++;
                rankingMap[i.user_id].history.push({
                    id: `like_${i.announcement_id}`,
                    date: i.created_at || new Date().toISOString(),
                    description: `Curtiu aviso: "${annTitle}"`,
                    points: 10,
                    type: 'announcement_like'
                });
            }
        }
    });

    Object.values(rankingMap).forEach(entry => {
        entry.history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });

    return Object.values(rankingMap).sort((a, b) => b.points - a.points);
};