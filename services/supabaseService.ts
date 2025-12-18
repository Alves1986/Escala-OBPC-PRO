
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
    PushSubscriptionRecord, User, MemberMap, 
    AppNotification, TeamMemberProfile, AvailabilityMap, SwapRequest, 
    ScheduleMap, RepertoireItem, Announcement, GlobalConflictMap, 
    GlobalConflict, DEFAULT_ROLES, AttendanceMap, AuditLogEntry, MinistrySettings,
    RankingEntry, AvailabilityNotesMap, CustomEvent, RankingHistoryItem
} from '../types';

// ============================================================================
// CONFIGURATION & ENVIRONMENT
// ============================================================================

// Globals injected by Vite via define
declare const __SUPABASE_URL__: string;
declare const __SUPABASE_KEY__: string;

// 1. Try Injected Globals (Build-time env vars)
let injectedUrl = '';
let injectedKey = '';
try {
    // @ts-ignore
    if (typeof __SUPABASE_URL__ !== 'undefined') injectedUrl = __SUPABASE_URL__;
    // @ts-ignore
    if (typeof __SUPABASE_KEY__ !== 'undefined') injectedKey = __SUPABASE_KEY__;
} catch(e) {}

// 2. Try import.meta.env (Vite Standard)
let metaUrl = '';
let metaKey = '';
try {
  // @ts-ignore
  const meta = import.meta;
  if (meta && meta.env) {
    metaUrl = meta.env.VITE_SUPABASE_URL;
    metaKey = meta.env.VITE_SUPABASE_KEY;
  }
} catch (e) {}

export const SUPABASE_URL = injectedUrl || metaUrl || "";
export const SUPABASE_KEY = injectedKey || metaKey || "";

// Debug Log
if ((!SUPABASE_URL || !SUPABASE_KEY) && typeof window !== 'undefined' && window.location.pathname !== '/setup') {
  console.warn("⚠️ Sistema aguardando credenciais. Verifique o arquivo .env na raiz.");
}

let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

export const getSupabase = () => supabase;

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
        await supabase.from('profiles').insert({
            id: data.user.id, email, name, ministry_id: mainMinistry, allowed_ministries: ministries, whatsapp: phone, functions: functions || []
        });
        await sendNotificationSQL(mainMinistry, { title: "Novo Membro", message: `${name} acabou de se cadastrar na equipe!`, type: 'success', actionLink: 'members' });
    }
    return { success: true, message: "Cadastro realizado!" };
};

export const logout = async () => { if (supabase) await supabase.auth.signOut(); window.location.reload(); };
export const sendPasswordResetEmail = async (email: string) => { if (!supabase) return { success: false }; const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' }); return { success: !error, message: error ? error.message : "Email enviado!" }; };

export const fetchMinistryMembers = async (ministryId: string): Promise<{ memberMap: MemberMap, publicList: TeamMemberProfile[] }> => {
    if (!supabase) return { memberMap: {}, publicList: [] };
    const { data } = await supabase.from('profiles').select('*');
    const filteredData = (data || []).filter((p: any) => { const allowed = safeParseArray(p.allowed_ministries); return allowed.includes(ministryId) || p.ministry_id === ministryId; });
    const publicList: TeamMemberProfile[] = filteredData.map((p: any) => ({
        id: p.id, name: p.name, email: p.email, whatsapp: p.whatsapp, avatar_url: p.avatar_url, roles: safeParseArray(p.functions), birthDate: p.birth_date, isAdmin: p.is_admin
    }));
    const memberMap: MemberMap = {};
    publicList.forEach(m => { if (m.roles) { m.roles.forEach(r => { if (!memberMap[r]) memberMap[r] = []; memberMap[r].push(m.name); }); } });
    return { memberMap, publicList };
};

export const joinMinistry = async (ministryId: string, roles: string[]) => {
    if (!supabase) return { success: false, message: "Erro" };
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false };
    const { data: profile } = await supabase.from('profiles').select('allowed_ministries, functions').eq('id', user.id).single();
    const currentAllowed = safeParseArray(profile?.allowed_ministries);
    const currentFunctions = safeParseArray(profile?.functions);
    const newAllowed = [...new Set([...currentAllowed, ministryId])];
    const newFunctions = [...new Set([...currentFunctions, ...roles])];
    const { error } = await supabase.from('profiles').update({ allowed_ministries: newAllowed, functions: newFunctions, ministry_id: ministryId }).eq('id', user.id);
    return { success: !error, message: error ? error.message : "Entrou no ministério!" };
};

export const updateProfileMinistry = async (userId: string, ministryId: string) => { if (!supabase) return; await supabase.from('profiles').update({ ministry_id: ministryId }).eq('id', userId); };
export const updateUserProfile = async (name: string, whatsapp: string, avatar: string | undefined, functions: string[] | undefined, birthDate: string | undefined, currentMinistryId?: string) => { if (!supabase) return { success: false, message: "Offline" }; const { data: { user } } = await supabase.auth.getUser(); if (!user) return { success: false }; const updates: any = { name, whatsapp }; if (birthDate) updates.birth_date = birthDate; else updates.birth_date = null; if (avatar) updates.avatar_url = avatar; if (functions) updates.functions = functions; const { error } = await supabase.from('profiles').update(updates).eq('id', user.id); return { success: !error, message: error ? error.message : "Perfil atualizado!" }; };
export const updateMemberData = async (memberId: string, data: { name?: string, roles?: string[], whatsapp?: string }) => { if (!supabase) return { success: false, message: "Offline" }; const updates: any = {}; if (data.name) updates.name = data.name; if (data.roles) updates.functions = data.roles; if (data.whatsapp) updates.whatsapp = data.whatsapp; const { error } = await supabase.from('profiles').update(updates).eq('id', memberId); return { success: !error, message: error ? error.message : "Membro atualizado com sucesso!" }; };
export const toggleAdminSQL = async (email: string, status: boolean, ministryId: string) => { if (!supabase) return; await supabase.functions.invoke('push-notification', { body: { action: 'toggle_admin', targetEmail: email, status, ministryId } }); };
export const deleteMember = async (ministryId: string, memberId: string, name: string) => { if (!supabase) return { success: false }; const { error } = await supabase.functions.invoke('push-notification', { body: { action: 'delete_member', memberId, ministryId } }); return { success: !error, message: error ? "Erro" : "Removido" }; };
export const fetchMinistrySettings = async (ministryId: string): Promise<MinistrySettings> => { if (!supabase) return { displayName: '', roles: [] }; const { data } = await supabase.from('ministry_settings').select('*').eq('ministry_id', ministryId).single(); if (!data) return { displayName: '', roles: [] }; return { displayName: data.display_name, roles: safeParseArray(data.roles), availabilityStart: data.availability_start, availabilityEnd: data.availability_end, spotifyClientId: data.spotify_client_id, spotifyClientSecret: data.spotify_client_secret }; };
export const saveMinistrySettings = async (ministryId: string, displayName?: string, roles?: string[], availabilityStart?: string, availabilityEnd?: string, spotifyClientId?: string, spotifyClientSecret?: string) => { if (!supabase) return; const updates: any = {}; if (displayName !== undefined) updates.display_name = displayName; if (roles !== undefined) updates.roles = roles; if (availabilityStart !== undefined) updates.availability_start = availabilityStart; if (availabilityEnd !== undefined) updates.availability_end = availabilityEnd; if (spotifyClientId !== undefined) updates.spotify_client_id = spotifyClientId; if (spotifyClientSecret !== undefined) updates.spotify_client_secret = spotifyClientSecret; await supabase.from('ministry_settings').upsert({ ministry_id: ministryId, ...updates }); };
export const fetchMinistrySchedule = async (ministryId: string, month: string) => { if (!supabase) return { events: [], schedule: {}, attendance: {} }; const startDate = `${month}-01`; const [y, m] = month.split('-').map(Number); const nextMonth = new Date(y, m, 1).toISOString().slice(0, 7); const { data: eventsData } = await supabase.from('events').select('*').eq('ministry_id', ministryId).gte('date_time', startDate).lt('date_time', `${nextMonth}-01`).order('date_time'); const events = (eventsData || []).map((e: any) => ({ id: e.id, iso: e.date_time.slice(0, 16), title: e.title, date: e.date_time.slice(0, 10), time: e.date_time.slice(11, 16), dateDisplay: e.date_time.slice(0, 10).split('-').reverse().slice(0, 2).join('/') })); const eventIds = events.map(e => e.id); const schedule: ScheduleMap = {}; const attendance: AttendanceMap = {}; if (eventIds.length > 0) { const { data: assigns } = await supabase.from('schedule_assignments').select('event_id, role, member_id, confirmed, profiles(name)').in('event_id', eventIds); (assigns || []).forEach((a: any) => { const evt = events.find(e => e.id === a.event_id); if (evt && a.profiles) { const key = `${evt.iso}_${a.role}`; schedule[key] = a.profiles.name; if (a.confirmed) attendance[key] = true; } }); } return { events, schedule, attendance }; };
export const createMinistryEvent = async (ministryId: string, event: { title: string, date: string, time: string }) => { if (!supabase) return; await supabase.from('events').insert({ ministry_id: ministryId, title: event.title, date_time: `${event.date}T${event.time}:00` }); await logAction(ministryId, 'Criou Evento', `Evento: ${event.title} em ${event.date}`); };
export const updateMinistryEvent = async (ministryId: string, oldIso: string, newTitle: string, newIso: string, applyToAll: boolean) => { if (!supabase) return; const { data: event } = await supabase.from('events').select('id').eq('ministry_id', ministryId).eq('date_time', oldIso + ':00').single(); if (event) { await supabase.from('events').update({ title: newTitle, date_time: newIso + ':00' }).eq('id', event.id); await logAction(ministryId, 'Editou Evento', `De ${oldIso} para ${newIso} - ${newTitle}`); } };
export const deleteMinistryEvent = async (ministryId: string, iso: string) => { if (!supabase) return; const date_time = iso.length === 16 ? iso + ':00' : iso; await supabase.from('events').delete().eq('ministry_id', ministryId).eq('date_time', date_time); await logAction(ministryId, 'Excluiu Evento', `Data: ${iso}`); };

// --- AUDIT LOG ---
const logAction = async (ministryId: string, action: string, details: string) => {
    if (!supabase) return;
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const author = user?.user_metadata?.full_name || user?.email || 'Sistema';
        
        await supabase.from('audit_logs').insert({
            ministry_id: ministryId,
            action,
            details,
            author_name: author,
            created_at: new Date().toISOString()
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
        author: l.author_name
    }));
};

export const saveScheduleAssignment = async (ministryId: string, key: string, memberName: string) => {
    if (!supabase) return true;
    try {
        const [iso, ...roleParts] = key.split('_');
        const role = roleParts.join('_');
        const date_time = iso + ':00';
        
        const { data: event } = await supabase.from('events').select('id, title').eq('ministry_id', ministryId).eq('date_time', date_time).single();
        if (!event) return false;

        let memberId = null;
        if (memberName) {
            const { data: member } = await supabase.from('profiles').select('id').eq('name', memberName).single();
            if (member) memberId = member.id;
        }

        if (!memberId) {
            await supabase.from('schedule_assignments').delete().eq('event_id', event.id).eq('role', role);
            await logAction(ministryId, 'Removeu Escala', `${role} removido de ${event.title} (${iso})`);
        } else {
            await supabase.from('schedule_assignments').upsert({ event_id: event.id, role, member_id: memberId, confirmed: false }, { onConflict: 'event_id,role' });
            await logAction(ministryId, 'Alterou Escala', `${memberName} escalado como ${role} em ${event.title} (${iso})`);
        }
        return true;
    } catch (e) {
        console.error("Save schedule error:", e);
        return false;
    }
};

export const saveScheduleBulk = async (ministryId: string, schedule: ScheduleMap, overwrite: boolean) => { if (!supabase) return; for (const [key, memberName] of Object.entries(schedule)) { if (memberName) await saveScheduleAssignment(ministryId, key, memberName); } };
export const toggleAssignmentConfirmation = async (ministryId: string, key: string) => { if (!supabase) return false; try { const [iso, ...roleParts] = key.split('_'); const role = roleParts.join('_'); const date_time = iso + ':00'; const { data: event } = await supabase.from('events').select('id, title').eq('ministry_id', ministryId).eq('date_time', date_time).single(); if (!event) return false; const { data: assign } = await supabase.from('schedule_assignments').select('confirmed, member_id').eq('event_id', event.id).eq('role', role).single(); if (assign) { await supabase.from('schedule_assignments').update({ confirmed: !assign.confirmed }).eq('event_id', event.id).eq('role', role); await logAction(ministryId, 'Status Presença', `Status alterado para ${!assign.confirmed} (${role})`); return true; } } catch(e) { console.error(e); } return false; };
export const clearScheduleForMonth = async (ministryId: string, month: string) => { if (!supabase) return; const startDate = `${month}-01T00:00:00`; const [y, m] = month.split('-').map(Number); const nextMonth = new Date(y, m, 1).toISOString(); const { data: events } = await supabase.from('events').select('id').eq('ministry_id', ministryId).gte('date_time', startDate).lt('date_time', nextMonth); const eventIds = events?.map((e: any) => e.id) || []; if (eventIds.length > 0) { await supabase.from('schedule_assignments').delete().in('event_id', eventIds); await logAction(ministryId, 'Limpeza Mensal', `Escala limpa para ${month}`); } };
export const resetToDefaultEvents = async (ministryId: string, month: string) => { if (!supabase) return; const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-'); const [y, m] = month.split('-').map(Number); const startDate = `${month}-01T00:00:00`; const nextMonth = new Date(y, m, 1).toISOString(); try { await clearScheduleForMonth(cleanMid, month); const { error: deleteError } = await supabase.from('events').delete().eq('ministry_id', cleanMid).gte('date_time', startDate).lt('date_time', nextMonth); if (deleteError) throw deleteError; const daysInMonth = new Date(y, m, 0).getDate(); const eventsToInsert = []; for (let d = 1; d <= daysInMonth; d++) { const date = new Date(y, m - 1, d, 12, 0, 0); const dayOfWeek = date.getDay(); const dateStr = `${month}-${String(d).padStart(2, '0')}`; if (dayOfWeek === 0) { eventsToInsert.push({ ministry_id: cleanMid, title: "Culto da Família", date_time: `${dateStr}T18:00:00` }); } else if (dayOfWeek === 3) { eventsToInsert.push({ ministry_id: cleanMid, title: "Culto de Doutrina", date_time: `${dateStr}T19:30:00` }); } } if (eventsToInsert.length > 0) { await supabase.from('events').insert(eventsToInsert); } await logAction(ministryId, 'Reset Eventos', `Eventos padrão restaurados para ${month}`); } catch (error) { console.error("Erro ao restaurar eventos:", error); } };

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
    const { data: avails } = await supabase.from('availability').select('*').in('member_id', memberIds); 
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

export const saveMemberAvailability = async (memberName: string, dates: string[], notes: Record<string, string>, targetMonth: string) => {
    if (!supabase) return { error: { message: "Sem conexão com banco de dados." } };
    try {
        const { data: profile, error: profileError } = await supabase.from('profiles').select('id').eq('name', memberName).single();
        if (profileError || !profile) throw new Error(`Membro "${memberName}" não encontrado. Contate o admin.`);
        const memberId = profile.id;
        const monthDates = dates.filter(d => d.startsWith(targetMonth));
        const monthNotes: Record<string, string> = {};
        Object.entries(notes).forEach(([key, val]) => { if (key.startsWith(targetMonth) && val && val.trim() !== "") monthNotes[key] = val; });
        const { error: upsertError } = await supabase.from('availability').upsert({ member_id: memberId, month: targetMonth, dates: monthDates, notes: monthNotes }, { onConflict: 'member_id, month' });
        if (upsertError) {
            if (upsertError.message?.includes('invalid input syntax for type date') || upsertError.message?.includes('type date')) {
                 throw new Error("⚠️ Erro de Banco de Dados: A coluna 'dates' não está configurada como Array. Por favor, execute o 'Script de Correção' no Supabase (SQL Editor).");
            }
            throw upsertError;
        }
        return { success: true };
    } catch (err: any) {
        console.error("CRITICAL SAVE ERROR:", err);
        return { error: { message: err.message || "Falha desconhecida ao salvar." } };
    }
};

export const fetchNotificationsSQL = async (ministryIds: string[], userId: string): Promise<AppNotification[]> => { if (!supabase) return []; const { data: notifs } = await supabase.from('notifications').select('*').in('ministry_id', ministryIds).order('created_at', { ascending: false }).limit(20); const { data: reads } = await supabase.from('notification_reads').select('notification_id').eq('user_id', userId); const readSet = new Set(reads?.map((r: any) => r.notification_id)); return (notifs || []).map((n: any) => ({ id: n.id, ministryId: n.ministry_id, title: n.title, message: n.message, type: n.type, actionLink: n.action_link, timestamp: n.created_at, read: readSet.has(n.id) })); };
export const sendNotificationSQL = async (ministryId: string, notification: { title: string, message: string, type?: string, actionLink?: string }) => { if (!supabase) return; const { data, error } = await supabase.from('notifications').insert({ ministry_id: ministryId, title: notification.title, message: notification.message, type: notification.type || 'info', action_link: notification.actionLink }).select(); await supabase.functions.invoke('push-notification', { body: { ministryId, title: notification.title, message: notification.message, type: notification.type, actionLink: notification.actionLink } }); return !error; };
export const markNotificationsReadSQL = async (ids: string[], userId: string) => { if (!supabase) return; const inserts = ids.map(id => ({ notification_id: id, user_id: userId })); await supabase.from('notification_reads').insert(inserts); };
export const clearAllNotificationsSQL = async (ministryId: string) => { if (!supabase) return; await supabase.from('notifications').delete().eq('ministry_id', ministryId); };
export const fetchAnnouncementsSQL = async (ministryId: string): Promise<Announcement[]> => { if (!supabase) return []; const today = new Date().toISOString(); const { data } = await supabase.from('announcements').select('*, announcement_interactions(user_id, interaction_type, profiles(name))').eq('ministry_id', ministryId).gte('expiration_date', today).order('created_at', { ascending: false }); return (data || []).map((a: any) => { const interactions = a.announcement_interactions || []; const readBy = interactions.filter((i: any) => i.interaction_type === 'read').map((i: any) => ({ userId: i.user_id, name: i.profiles?.name, timestamp: '' })); const likedBy = interactions.filter((i: any) => i.interaction_type === 'like').map((i: any) => ({ userId: i.user_id, name: i.profiles?.name, timestamp: '' })); return { id: a.id, title: a.title, message: a.message, type: a.type, timestamp: a.created_at, expirationDate: a.expiration_date, author: a.author_name, readBy, likedBy }; }); };
export const createAnnouncementSQL = async (ministryId: string, ann: { title: string, message: string, type: string, expirationDate: string }, authorName: string) => { if (!supabase) return; await supabase.from('announcements').insert({ ministry_id: ministryId, title: ann.title, message: ann.message, type: ann.type, expiration_date: ann.expirationDate, author_name: authorName }); };
export const interactAnnouncementSQL = async (announcementId: string, userId: string, userName: string, type: 'read' | 'like') => { if (!supabase) return; if (type === 'read') { await supabase.from('announcement_interactions').insert({ announcement_id: announcementId, user_id: userId, interaction_type: 'read' }).select(); } else { const { data } = await supabase.from('announcement_interactions').select('id').eq('announcement_id', announcementId).eq('user_id', userId).eq('interaction_type', 'like'); if (data && data.length > 0) { await supabase.from('announcement_interactions').delete().eq('id', data[0].id); } else { await supabase.from('announcement_interactions').insert({ announcement_id: announcementId, user_id: userId, interaction_type: 'like' }); } } };
export const fetchSwapRequests = async (ministryId: string): Promise<SwapRequest[]> => { if (!supabase) return []; const { data } = await supabase.from('swap_requests').select('*').eq('ministry_id', ministryId).order('created_at', { ascending: false }); return (data || []).map((r: any) => ({ id: r.id, ministryId: r.ministry_id, requesterName: r.requester_name, requesterId: r.requester_id, role: r.role, eventIso: r.event_iso, eventTitle: r.event_title, status: r.status, createdAt: r.created_at, takenByName: r.taken_by_name })); };

export const createSwapRequestSQL = async (ministryId: string, request: SwapRequest) => { 
    if (!supabase) return true; 
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
        if (result.success) {
            await sendNotificationSQL(ministryId, { 
                title: "✅ Troca Realizada", 
                message: `${takerName} assumiu a escala. O pedido foi finalizado com sucesso.`, 
                type: 'success',
                actionLink: 'calendar'
            });
            await logAction(ministryId, 'Troca Escala', `${takerName} assumiu vaga de troca (Pedido ${reqId})`);
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
        key: r.key // New field
    })); 
};

export const addToRepertoire = async (ministryId: string, item: { title: string, link: string, date: string, addedBy: string, content?: string, key?: string }) => { 
    if (!supabase) return true; 
    const { error } = await supabase.from('repertoire').insert({ 
        ministry_id: ministryId, 
        title: item.title, 
        link: item.link, 
        event_date: item.date, 
        added_by: item.addedBy,
        content: item.content, // New field
        key: item.key // New field
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

export const saveSubscriptionSQL = async (ministryId: string, subscription: PushSubscription) => { if (!supabase) return; const { data: { user } } = await supabase.auth.getUser(); if (!user) return; const p256dh = subscription.getKey('p256dh') ? btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh')!) as any)) : ''; const auth = subscription.getKey('auth') ? btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth')!) as any)) : ''; await supabase.from('push_subscriptions').upsert({ user_id: user.id, endpoint: subscription.endpoint, p256dh, auth }, { onConflict: 'endpoint' }); };
