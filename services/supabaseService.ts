import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
    SUPABASE_URL, SUPABASE_KEY, PushSubscriptionRecord, User, MemberMap, 
    AppNotification, TeamMemberProfile, AvailabilityMap, SwapRequest, 
    ScheduleMap, RepertoireItem, Announcement, GlobalConflictMap, 
    GlobalConflict, DEFAULT_ROLES, AttendanceMap, AuditLogEntry, MinistrySettings,
    RankingEntry, AvailabilityNotesMap, CustomEvent, RankingHistoryItem
} from '../types';

let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

export const getSupabase = () => supabase;

// --- Helper Functions ---

// Fix for missing sendNotificationSQL
export const sendNotificationSQL = async (ministryId: string, notification: Partial<AppNotification>) => {
    if (!supabase) return;
    await supabase.from('notifications').insert({
        ministry_id: ministryId,
        title: notification.title,
        message: notification.message,
        type: notification.type || 'info',
        action_link: notification.actionLink
    });
};

export const loginWithEmail = async (email: string, pass: string) => {
    if (!supabase) return { success: false, message: "Offline" };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    return { success: !error, message: error?.message || "Sucesso" };
};

export const loginWithGoogle = async () => {
    if (!supabase) return { success: false, message: "Offline" };
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    return { success: !error, message: error?.message || "Redirecionando..." };
};

export const registerWithEmail = async (email: string, pass: string, name: string, ministries: string[], phone?: string, roles?: string[]) => {
    if (!supabase) return { success: false, message: "Offline" };
    const { data, error } = await supabase.auth.signUp({ 
        email, 
        password: pass,
        options: {
            data: { full_name: name, ministries, roles }
        }
    });
    return { success: !error, message: error?.message || "Verifique seu e-mail para confirmar a conta." };
};

export const sendPasswordResetEmail = async (email: string) => {
    if (!supabase) return { success: false, message: "Offline" };
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { success: !error, message: error?.message || "E-mail enviado!" };
};

export const fetchMinistrySettings = async (ministryId: string): Promise<MinistrySettings> => {
    if (!supabase) return { displayName: ministryId, roles: [] };
    const { data } = await supabase.from('ministry_settings').select('*').eq('id', ministryId).maybeSingle();
    return data || { displayName: ministryId, roles: [] };
};

export const markNotificationsReadSQL = async (ids: string[], userId: string) => {
    if (!supabase) return;
    await supabase.from('notification_reads').upsert(ids.map(id => ({ notification_id: id, user_id: userId })));
};

export const clearAllNotificationsSQL = async (ministryId: string) => {
    if (!supabase) return;
    await supabase.from('notifications').delete().eq('ministry_id', ministryId);
};

export const fetchSwapRequests = async (ministryId: string): Promise<SwapRequest[]> => { 
    if (!supabase) return []; 
    const { data } = await supabase.from('swap_requests').select('*').eq('ministry_id', ministryId).order('created_at', { ascending: false }); 
    return (data || []).map((r: any) => ({ id: r.id, ministryId: r.ministry_id, requesterName: r.requester_name, requesterId: r.requester_id, role: r.role, eventIso: r.event_iso, eventTitle: r.event_title, status: r.status, createdAt: r.created_at, takenByName: r.taken_by_name })); 
};

export const createSwapRequestSQL = async (ministryId: string, request: SwapRequest) => { 
    if (!supabase) return { success: true }; 

    const { data: existing } = await supabase
        .from('swap_requests')
        .select('id')
        .eq('ministry_id', ministryId)
        .eq('event_iso', request.eventIso)
        .eq('role', request.role)
        .eq('status', 'pending')
        .maybeSingle();

    if (existing) return { success: false, message: "Já existe um pedido pendente para esta escala." };

    const { error } = await supabase.from('swap_requests').insert({ 
        ministry_id: ministryId, 
        requester_id: request.requesterId, 
        requester_name: request.requesterName, 
        role: request.role, 
        event_iso: request.eventIso, 
        event_title: request.eventTitle, 
        status: 'pending' 
    }); 
    
    if (!error) {
        await sendNotificationSQL(ministryId, {
            title: "🔄 Pedido de Troca",
            message: `${request.requesterName} solicitou troca para ${request.role}.`,
            type: 'warning',
            actionLink: 'swaps'
        });
    }

    return { success: !error }; 
};

export const cancelSwapRequestSQL = async (reqId: string) => {
    if (!supabase) return false;
    const { error } = await supabase.from('swap_requests').delete().eq('id', reqId).eq('status', 'pending');
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
        if (result.success) {
            await sendNotificationSQL(ministryId, { 
                title: "✅ Troca Realizada", 
                message: `${takerName} assumiu a escala. O pedido foi finalizado com sucesso.`, 
                type: 'success',
                actionLink: 'calendar'
            });
            const { data: { user } } = await supabase.auth.getUser();
            const author = user?.user_metadata?.full_name || 'Sistema';
            await supabase.from('audit_logs').insert({
                ministry_id: ministryId,
                action: 'Troca Escala',
                details: `${takerName} assumiu vaga de troca (Pedido ${reqId})`,
                author_name: author
            });
        }
        return result;
    } catch (err: any) {
        console.error("Erro na troca (RPC):", err);
        return { success: false, message: "Erro ao processar troca. Tente novamente." };
    }
};

export const fetchRankingData = async (ministryId: string): Promise<RankingEntry[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('ranking_view').select('*').eq('ministry_id', ministryId);
    return data || [];
};

export const fetchMinistrySchedule = async (ministryId: string, month: string) => {
    if (!supabase) return { events: [], schedule: {}, attendance: {} };
    const { data: events } = await supabase.from('events').select('*').eq('ministry_id', ministryId).like('date_time', `${month}%`);
    const { data: assignments } = await supabase.from('schedule_assignments').select('*').in('event_id', events?.map(e => e.id) || []);
    
    const schedule: ScheduleMap = {};
    const attendance: AttendanceMap = {};
    assignments?.forEach(a => {
        const evt = events?.find(e => e.id === a.event_id);
        if (evt) {
            const key = `${evt.date_time}_${a.role}`;
            schedule[key] = a.member_name;
            attendance[key] = a.confirmed;
        }
    });
    return { events: events || [], schedule, attendance };
};

export const fetchMinistryMembers = async (ministryId: string) => {
    if (!supabase) return { memberMap: {}, publicList: [] };
    const { data: profiles } = await supabase.from('profiles').select('*').contains('allowed_ministries', [ministryId]);
    const memberMap: MemberMap = {};
    profiles?.forEach(p => {
        p.roles?.forEach((r: string) => {
            if (!memberMap[r]) memberMap[r] = [];
            memberMap[r].push(p.name);
        });
    });
    return { memberMap, publicList: profiles || [] };
};

export const fetchMinistryAvailability = async (ministryId: string) => {
    if (!supabase) return { availability: {}, notes: {} };
    const { data } = await supabase.from('availability').select('*').eq('ministry_id', ministryId);
    const availability: AvailabilityMap = {};
    const notes: AvailabilityNotesMap = {};
    data?.forEach(a => {
        if (!availability[a.member_name]) availability[a.member_name] = [];
        availability[a.member_name].push(a.date);
        if (a.note) notes[`${a.member_name}_${a.date}`] = a.note;
    });
    return { availability, notes };
};

export const fetchNotificationsSQL = async (ministryIds: string[], userId: string): Promise<AppNotification[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('notifications').select('*').in('ministry_id', ministryIds);
    return (data || []).map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        timestamp: n.created_at,
        read: false, // simplified
        ministryId: n.ministry_id
    }));
};

export const fetchAnnouncementsSQL = async (ministryId: string): Promise<Announcement[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('announcements').select('*').eq('ministry_id', ministryId);
    return (data || []).map(a => ({
        id: a.id,
        title: a.title,
        message: a.message,
        type: a.type,
        timestamp: a.created_at,
        author: a.author_name,
        readBy: [],
        likedBy: []
    }));
};

export const fetchRepertoire = async (ministryId: string): Promise<RepertoireItem[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('repertoire').select('*').eq('ministry_id', ministryId);
    return (data || []).map(r => ({
        id: r.id,
        title: r.title,
        link: r.link,
        date: r.date,
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
        content: item.content,
        key: item.key
    });
    return !error;
};

export const deleteFromRepertoire = async (id: string) => {
    if (!supabase) return false;
    const { error } = await supabase.from('repertoire').delete().eq('id', id);
    return !error;
};

export const updateRepertoireItem = async (id: string, updates: Partial<RepertoireItem>) => {
    if (!supabase) return false;
    const { error } = await supabase.from('repertoire').update(updates).eq('id', id);
    return !error;
};

export const fetchGlobalSchedules = async (month: string, ministryId: string): Promise<GlobalConflictMap> => {
    if (!supabase) return {};
    const { data } = await supabase.from('schedule_assignments_global_view').select('*').like('date_time', `${month}%`).neq('ministry_id', ministryId);
    const conflicts: GlobalConflictMap = {};
    data?.forEach(a => {
        const norm = a.member_name.trim().toLowerCase();
        if (!conflicts[norm]) conflicts[norm] = [];
        conflicts[norm].push({ ministryId: a.ministry_id, eventIso: a.date_time, role: a.role });
    });
    return conflicts;
};

export const fetchAuditLogs = async (ministryId: string): Promise<AuditLogEntry[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('audit_logs').select('*').eq('ministry_id', ministryId).order('created_at', { ascending: false }).limit(50);
    return (data || []).map(l => ({
        id: l.id,
        date: l.created_at,
        action: l.action,
        details: l.details,
        author: l.author_name
    }));
};

export const saveScheduleAssignment = async (ministryId: string, key: string, value: string) => {
    if (!supabase) return;
    const [iso, role] = key.split('_');
    const { data: event } = await supabase.from('events').select('id').eq('ministry_id', ministryId).eq('date_time', iso).single();
    if (!event) return;
    if (!value) {
        await supabase.from('schedule_assignments').delete().eq('event_id', event.id).eq('role', role);
    } else {
        await supabase.from('schedule_assignments').upsert({
            event_id: event.id,
            role,
            member_name: value
        }, { onConflict: 'event_id,role' });
    }
};

export const toggleAssignmentConfirmation = async (ministryId: string, key: string) => {
    if (!supabase) return;
    const [iso, role] = key.split('_');
    const { data: event } = await supabase.from('events').select('id').eq('ministry_id', ministryId).eq('date_time', iso).single();
    if (!event) return;
    const { data: existing } = await supabase.from('schedule_assignments').select('confirmed').eq('event_id', event.id).eq('role', role).single();
    if (existing) {
        await supabase.from('schedule_assignments').update({ confirmed: !existing.confirmed }).eq('event_id', event.id).eq('role', role);
    }
};
