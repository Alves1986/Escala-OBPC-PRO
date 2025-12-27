
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
    User, MinistrySettings, MinistryDef, Organization, 
    AppNotification, Announcement, SwapRequest, RepertoireItem, 
    TeamMemberProfile, AvailabilityMap, ScheduleMap, 
    AuditLogEntry, GlobalConflictMap, RankingEntry, AvailabilityNotesMap
} from '../types';

// Globals injected by Vite via define (Configured in vite.config.ts)
declare const __SUPABASE_URL__: string;
declare const __SUPABASE_KEY__: string;

let injectedUrl = '';
let injectedKey = '';

// 1. Try Injected Globals (Build-time env vars)
try {
    // @ts-ignore
    if (typeof __SUPABASE_URL__ !== 'undefined') injectedUrl = __SUPABASE_URL__;
    // @ts-ignore
    if (typeof __SUPABASE_KEY__ !== 'undefined') injectedKey = __SUPABASE_KEY__;
} catch(e) {}

let metaUrl = '';
let metaKey = '';

// 2. Try import.meta.env (Vite Standard)
try {
    // @ts-ignore
    if (import.meta && import.meta.env) {
        // @ts-ignore
        metaUrl = import.meta.env.VITE_SUPABASE_URL;
        // @ts-ignore
        metaKey = import.meta.env.VITE_SUPABASE_KEY;
    }
} catch (e) {}

export const SUPABASE_URL = injectedUrl || metaUrl || "";
export const SUPABASE_KEY = injectedKey || metaKey || "";

let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_KEY) {
    try {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    } catch (e) {
        console.error("Failed to initialize Supabase client:", e);
    }
}

export const getSupabase = () => supabase;

// --- AUTH ---
export const loginWithEmail = async (email: string, password: string) => {
    if (!supabase) return { success: false, message: "Supabase não configurado" };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { success: !error, message: error?.message, user: data.user };
};

export const loginWithGoogle = async () => {
    if (!supabase) return { success: false, message: "Supabase não configurado" };
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    return { success: !error, message: error?.message, data };
};

export const registerWithEmail = async (email: string, password: string, name: string, ministries: string[], orgId?: string, roles?: string[]) => {
    if (!supabase) return { success: false, message: "Supabase não configurado" };
    const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
            data: { full_name: name, ministries, roles }
        }
    });
    return { success: !error, message: error?.message };
};

export const sendPasswordResetEmail = async (email: string) => {
    if (!supabase) return { success: false, message: "Supabase não configurado" };
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { success: !error, message: error ? error.message : "Email enviado." };
};

export const updateLastMinistry = async (userId: string, ministryId: string) => {
    if (!supabase) return;
    try {
        await supabase.from('profiles').update({ last_ministry_id: ministryId }).eq('id', userId);
    } catch (e) {
        console.error("Erro ao salvar último ministério:", e);
    }
};

export const fetchUserAllowedMinistries = async (userId: string, orgId: string): Promise<string[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('profiles').select('allowed_ministries').eq('id', userId).single();
    return data?.allowed_ministries || [];
};

export const updateUserProfile = async (name: string, whatsapp: string, avatar_url?: string, functions?: string[], birthDate?: string, ministryId?: string) => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const updates: any = { name, whatsapp, functions, birth_date: birthDate };
    if (avatar_url) updates.avatar_url = avatar_url;
    await supabase.from('profiles').update(updates).eq('id', user.id);
};

// --- ORGANIZATION & MINISTRIES ---
export const fetchOrganizationMinistries = async (orgId: string): Promise<MinistryDef[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('organization_ministries').select('*').eq('organization_id', orgId);
    return data || [];
};

export const fetchMinistrySettings = async (ministryId: string): Promise<MinistrySettings> => {
    if (!supabase) return { displayName: ministryId, roles: [] };
    const { data } = await supabase.from('ministry_settings').select('*').eq('ministry_id', ministryId).single();
    return data || { displayName: ministryId, roles: [] };
};

export const joinMinistry = async (ministryId: string, roles: string[]) => {
    // Implementation would call a Supabase RPC or function
};

// --- SCHEDULE & EVENTS ---
export const fetchMinistrySchedule = async (ministryId: string, month: string) => {
    // Mock implementation or real query
    return { events: [], schedule: {}, attendance: {} };
};

export const saveScheduleAssignment = async (ministryId: string, key: string, value: string) => {
    // Save to DB
};

export const toggleAssignmentConfirmation = async (ministryId: string, key: string) => {
    // Toggle
};

export const clearScheduleForMonth = async (ministryId: string, month: string) => {
    // Clear
};

export const resetToDefaultEvents = async (ministryId: string, month: string) => {
    // Reset
};

export const createMinistryEvent = async (ministryId: string, evt: any) => {
    // Create
};

export const updateMinistryEvent = async (ministryId: string, oldIso: string, title: string, newIso: string, apply: boolean) => {
    // Update
};

export const deleteMinistryEvent = async (ministryId: string, iso: string) => {
    // Delete
};

// --- MEMBERS ---
export const fetchMinistryMembers = async (ministryId: string) => {
    return { memberMap: {}, publicList: [] };
};

export const toggleAdminSQL = async (email: string, status: boolean, ministryId: string) => {
    // Toggle admin
};

export const deleteMember = async (ministryId: string, id: string, name: string) => {
    // Delete member
};

// --- AVAILABILITY ---
export const fetchMinistryAvailability = async (ministryId: string) => {
    return { availability: {}, notes: {} };
};

export const saveMemberAvailability = async (ministryId: string, member: string, dates: string[], notes: any, month: string) => {
    // Save
};

// --- NOTIFICATIONS & ANNOUNCEMENTS ---
export const fetchNotificationsSQL = async (ministries: string[], userId: string): Promise<AppNotification[]> => {
    return [];
};

export const markNotificationsReadSQL = async (ids: string[], userId: string) => {
    // Mark read
};

export const clearAllNotificationsSQL = async (ministryId: string) => {
    // Clear
};

export const sendNotificationSQL = async (ministryId: string, notification: Partial<AppNotification>) => {
    // Send
};

export const fetchAnnouncementsSQL = async (ministryId: string): Promise<Announcement[]> => {
    return [];
};

export const createAnnouncementSQL = async (ministryId: string, announcement: any, author: string) => {
    // Create
};

export const interactAnnouncementSQL = async (id: string, userId: string, userName: string, action: 'read' | 'like') => {
    // Interact
};

// --- SWAP REQUESTS ---
export const fetchSwapRequests = async (ministryId: string): Promise<SwapRequest[]> => {
    return [];
};

export const createSwapRequestSQL = async (ministryId: string, request: any) => {
    // Create
};

export const performSwapSQL = async (ministryId: string, reqId: string, userName: string, userId: string) => {
    // Swap
};

export const cancelSwapRequestSQL = async (reqId: string) => {
    // Cancel
};

// --- REPERTOIRE ---
export const fetchRepertoire = async (ministryId: string): Promise<RepertoireItem[]> => {
    return [];
};

export const addToRepertoire = async (ministryId: string, item: any) => {
    return true;
};

export const deleteFromRepertoire = async (id: string) => {
    // Delete
};

export const updateRepertoireItem = async (id: string, data: any) => {
    // Update
};

// --- CONFLICTS / AUDIT / RANKING ---
export const fetchGlobalSchedules = async (month: string, ministryId: string): Promise<GlobalConflictMap> => {
    return {};
};

export const fetchRankingData = async (ministryId: string): Promise<RankingEntry[]> => {
    return [];
};

export const fetchAuditLogs = async (ministryId: string): Promise<AuditLogEntry[]> => {
    return [];
};

// --- SETTINGS ---
export const saveMinistrySettings = async (ministryId: string, title?: string, roles?: string[], start?: string, end?: string) => {
    // Save
};

// --- SUPER ADMIN ---
export const fetchOrganizationsWithStats = async (): Promise<Organization[]> => {
    return [];
};

export const saveOrganization = async (id: string | null, name: string, slug: string) => {
    return { success: true, message: "Saved" };
};

export const toggleOrganizationStatus = async (id: string, current: boolean) => {
    return true;
};

export const saveOrganizationMinistry = async (orgId: string, code: string, label: string) => {
    return { success: true, message: "Saved" };
};

export const deleteOrganizationMinistry = async (orgId: string, code: string) => {
    return { success: true, message: "Deleted" };
};
