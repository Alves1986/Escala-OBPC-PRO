import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
    MinistrySettings, MinistryDef, AppNotification, Announcement, 
    SwapRequest, RepertoireItem, TeamMemberProfile, 
    AuditLogEntry, Organization, RankingEntry 
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
  if (meta && meta.env) {
    supabaseUrl = supabaseUrl || meta.env.VITE_SUPABASE_URL || '';
    supabaseKey = supabaseKey || meta.env.VITE_SUPABASE_KEY || '';
  }
} catch (e) {}

// Export constants
export const SUPABASE_URL = supabaseUrl;

// Export client getter
let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = () => {
    if (!supabaseInstance && supabaseUrl && supabaseKey) {
        supabaseInstance = createClient(supabaseUrl, supabaseKey);
    }
    return supabaseInstance;
};

// Internal helper
const logAction = async (ministryId: string, action: string, details: string, organizationId?: string) => {
    const sb = getSupabase();
    if (!sb) return;
    try {
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return;
        
        await sb.from('audit_logs').insert({
            ministry_id: ministryId,
            organization_id: organizationId,
            action,
            details,
            author_id: user.id,
            date: new Date().toISOString()
        });
    } catch (e) { console.error("Log error", e); }
};

export const saveScheduleAssignment = async (ministryId: string, key: string, memberId: string | null) => {
    const sb = getSupabase();
    if (!sb) return true;
    try {
        const [iso, ...roleParts] = key.split('_');
        const role = roleParts.join('_');
        const date_time = iso + ':00';
        
        const { data: event, error: eventError } = await sb
            .from('events')
            .select('id, title, organization_id')
            .eq('ministry_id', ministryId)
            .eq('date_time', date_time)
            .single();
        
        if (eventError || !event) {
            console.error("Evento não encontrado:", date_time, ministryId);
            return false;
        }

        if (!memberId) {
            await sb.from('schedule_assignments')
                .delete()
                .eq('event_id', event.id)
                .eq('role', role);
                
            await logAction(ministryId, 'Removeu Escala', `${role} removido de ${event.title} (${iso})`, event.organization_id);
            return true;
        }

        const { data: profile } = await sb
            .from('profiles')
            .select('id, name, organization_id')
            .eq('id', memberId)
            .single();

        if (!profile) {
            console.error("Erro Crítico: ID de membro inválido ou não encontrado.");
            return false;
        }

        const { error: saveError } = await sb.from('schedule_assignments').upsert({ 
            event_id: event.id, 
            role: role, 
            member_id: profile.id, 
            confirmed: false,
            ministry_id: ministryId, 
            organization_id: profile.organization_id 
        }, { onConflict: 'event_id,role' });

        if (saveError) {
            console.error("Erro ao salvar escala (DB):", saveError.message);
            return false;
        }

        await logAction(ministryId, 'Alterou Escala', `${profile.name} escalado como ${role} em ${event.title} (${iso})`, profile.organization_id);
        return true;

    } catch (e) {
        console.error("Exceção ao salvar escala:", e);
        return false;
    }
};

// --- Auth Functions ---
export const loginWithEmail = async (email: string, password: string) => {
    const sb = getSupabase();
    if (!sb) return { success: false, message: 'Supabase not initialized' };
    const { error } = await sb.auth.signInWithPassword({ email, password });
    return { success: !error, message: error?.message || 'Login success' };
};

export const loginWithGoogle = async () => {
    const sb = getSupabase();
    if (!sb) return { success: false, message: 'Supabase not initialized' };
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google' });
    return { success: !error, message: error?.message || 'Redirecting...' };
};

export const registerWithEmail = async (email: string, password: string, name: string, ministries: string[], orgId?: string, roles?: string[]) => {
    const sb = getSupabase();
    if (!sb) return { success: false, message: 'Supabase not initialized' };
    const { data, error } = await sb.auth.signUp({ 
        email, password, 
        options: { data: { full_name: name, ministries, roles } } 
    });
    return { success: !error, message: error?.message || 'Registration success' };
};

export const sendPasswordResetEmail = async (email: string) => {
    const sb = getSupabase();
    if (!sb) return { success: false, message: 'Supabase not initialized' };
    const { error } = await sb.auth.resetPasswordForEmail(email);
    return { success: !error, message: error?.message || 'Reset email sent' };
};

// --- Data Fetching ---
export const fetchMinistrySettings = async (ministryId: string) => {
    const sb = getSupabase();
    if (!sb) return {};
    const { data } = await sb.from('ministry_settings').select('*').eq('id', ministryId).single();
    return data || {};
};

export const fetchOrganizationMinistries = async (orgId: string) => {
    const sb = getSupabase();
    if (!sb) return [];
    const { data } = await sb.from('organization_ministries').select('*').eq('organization_id', orgId);
    return data || [];
};

export const fetchUserAllowedMinistries = async (userId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return ['midia'];
    const { data } = await sb.from('profiles').select('allowed_ministries').eq('id', userId).single();
    return data?.allowed_ministries || ['midia'];
};

export const updateUserProfile = async (name: string, whatsapp: string, avatar_url?: string, functions?: string[], birthDate?: string, ministryId?: string) => {
    const sb = getSupabase();
    if (!sb) return;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    const updates: any = { 
        name, 
        whatsapp, 
        functions, 
        birth_date: birthDate,
        updated_at: new Date().toISOString()
    };
    if (avatar_url) updates.avatar_url = avatar_url;

    await sb.from('profiles').update(updates).eq('id', user.id);
};

// --- Notifications ---
export const markNotificationsReadSQL = async (ids: string[], userId: string) => {
    const sb = getSupabase();
    if (sb) await sb.rpc('mark_notifications_read', { notification_ids: ids, user_id: userId });
};

export const clearAllNotificationsSQL = async (ministryId: string) => {
    const sb = getSupabase();
    if (sb) await sb.from('notifications').delete().eq('ministry_id', ministryId);
};

export const fetchNotificationsSQL = async (ministries: string[], userId: string) => {
    const sb = getSupabase();
    if (!sb) return [];
    const { data } = await sb.from('notifications').select('*').in('ministry_id', ministries).order('created_at', { ascending: false });
    return data || [];
};

export const fetchAnnouncementsSQL = async (ministryId: string) => {
    const sb = getSupabase();
    if (!sb) return [];
    const { data } = await sb.from('announcements').select('*').eq('ministry_id', ministryId);
    return data || [];
};

// --- Repertoire ---
export const addToRepertoire = async (ministryId: string, item: any) => {
    const sb = getSupabase();
    if (!sb) return false;
    const { error } = await sb.from('repertoire').insert({ ...item, ministry_id: ministryId });
    return !error;
};

export const deleteFromRepertoire = async (id: string) => {
    const sb = getSupabase();
    if (sb) await sb.from('repertoire').delete().eq('id', id);
};

export const updateRepertoireItem = async (id: string, updates: any) => {
    const sb = getSupabase();
    if (sb) await sb.from('repertoire').update(updates).eq('id', id);
};

export const fetchRepertoire = async (ministryId: string) => {
    const sb = getSupabase();
    if (!sb) return [];
    const { data } = await sb.from('repertoire').select('*').eq('ministry_id', ministryId);
    return data || [];
};

export const sendNotificationSQL = async (ministryId: string, payload: any) => {
    const sb = getSupabase();
    if (sb) await sb.from('notifications').insert({ ...payload, ministry_id: ministryId });
};

// --- Schedule & Events ---
export const fetchMinistrySchedule = async (ministryId: string, month: string) => {
    // Placeholder - would need actual implementation
    return { events: [], schedule: {}, attendance: {} };
};

export const fetchMinistryMembers = async (ministryId: string) => {
    return { memberMap: {}, publicList: [] };
};

export const fetchMinistryAvailability = async (ministryId: string) => {
    return { availability: {}, notes: {} };
};

export const saveMemberAvailability = async (ministryId: string, memberName: string, dates: string[], notes: Record<string, string>, targetMonth?: string) => {
    const sb = getSupabase();
    if (!sb) return;
    
    // This is a simplified version; real implementation needs profile lookup by name if not passed by ID
    const { data: profile } = await sb.from('profiles').select('id').eq('name', memberName).single();
    if (!profile) return;

    await sb.from('availability').upsert({
        ministry_id: ministryId,
        member_id: profile.id,
        dates: dates,
        notes: notes
    }, { onConflict: 'ministry_id,member_id' });
};

export const fetchSwapRequests = async (ministryId: string) => {
    const sb = getSupabase();
    if (!sb) return [];
    const { data } = await sb.from('swap_requests').select('*').eq('ministry_id', ministryId);
    return data || [];
};

export const fetchGlobalSchedules = async (month: string, currentMinistryId: string) => {
    return {};
};

export const fetchAuditLogs = async (ministryId: string) => {
    const sb = getSupabase();
    if (!sb) return [];
    const { data } = await sb.from('audit_logs').select('*').eq('ministry_id', ministryId).order('date', { ascending: false }).limit(50);
    return data || [];
};

export const fetchRankingData = async (ministryId: string) => {
    // Placeholder
    return [];
};

export const toggleAssignmentConfirmation = async (ministryId: string, key: string) => {
    const sb = getSupabase();
    if (!sb) return;
    // Logic to toggle confirmation
    return true;
};

export const deleteMinistryEvent = async (ministryId: string, iso: string) => {
    const sb = getSupabase();
    if (!sb) return;
    // Logic to delete event
    return true;
};

export const createMinistryEvent = async (ministryId: string, evt: any) => {
    const sb = getSupabase();
    if (!sb) return;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { data: profile } = await sb.from('profiles').select('organization_id').eq('id', user.id).single();
    
    await sb.from('events').insert({
        ministry_id: ministryId,
        organization_id: profile?.organization_id,
        title: evt.title,
        date_time: `${evt.date}T${evt.time}:00`
    });
};

export const updateMinistryEvent = async (ministryId: string, oldIso: string, newTitle: string, newIso: string, applyToAll: boolean) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('events').update({
        title: newTitle,
        date_time: newIso + ':00'
    })
    .eq('ministry_id', ministryId)
    .like('date_time', `${oldIso}%`);
};

export const saveMinistrySettings = async (ministryId: string, displayName?: string, roles?: string[], start?: string, end?: string) => {
    const sb = getSupabase();
    if (!sb) return;
    const updates: any = {};
    if (displayName !== undefined) updates.display_name = displayName;
    if (roles !== undefined) updates.roles = roles;
    if (start !== undefined) updates.availability_start = start;
    if (end !== undefined) updates.availability_end = end;

    await sb.from('ministry_settings').upsert({
        organization_ministry_id: ministryId, // Assuming ID mapping
        ...updates
    });
};

// --- Admin ---
export const fetchOrganizationsWithStats = async () => { return []; };
export const saveOrganization = async (id: string | null, name: string, slug: string) => { return { success: true, message: '' }; };
export const toggleOrganizationStatus = async (id: string, active: boolean) => { return true; };
export const saveOrganizationMinistry = async (orgId: string, code: string, label: string) => { return { success: true, message: '' }; };
export const deleteOrganizationMinistry = async (orgId: string, code: string) => { return { success: true, message: '' }; };
export const toggleAdminSQL = async (email: string, status: boolean, name: string) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('profiles').update({ is_admin: status }).eq('email', email);
};
export const deleteMember = async (ministryId: string, id: string, name: string) => {
    const sb = getSupabase();
    if (!sb) return;
    // Implementation
};
export const joinMinistry = async (ministryId: string, roles: string[]) => {
    const sb = getSupabase();
    if (!sb) return;
    // Implementation
};
export const createSwapRequestSQL = async (ministryId: string, request: Partial<SwapRequest>) => {};
export const performSwapSQL = async (ministryId: string, reqId: string, takenByName: string, takenById: string) => {};
export const cancelSwapRequestSQL = async (reqId: string) => {};
export const interactAnnouncementSQL = async (id: string, userId: string, userName: string, action: 'read' | 'like') => {};
export const resetToDefaultEvents = async (ministryId: string, month: string) => {};
export const clearScheduleForMonth = async (ministryId: string, month: string) => {};
export const createAnnouncementSQL = async (ministryId: string, announcement: any, authorName: string) => {};
