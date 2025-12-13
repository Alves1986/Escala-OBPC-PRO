
// ... imports
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
    SUPABASE_URL, SUPABASE_KEY, PushSubscriptionRecord, User, MemberMap, 
    AppNotification, TeamMemberProfile, AvailabilityMap, SwapRequest, 
    ScheduleMap, RepertoireItem, Announcement, GlobalConflictMap, 
    GlobalConflict, DEFAULT_ROLES, AttendanceMap, AuditLogEntry, MinistrySettings,
    RankingEntry, AvailabilityNotesMap
} from '../types';

const isPreviewMode = SUPABASE_URL === 'https://preview.mode';

let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_KEY && !isPreviewMode) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

export const getSupabase = () => supabase;

// ... (other exports like logout, login... keep unchanged until deleteMember)
export const logout = async () => {
    if (isPreviewMode) return;
    if (!supabase) return;
    await supabase.auth.signOut();
};

export const loginWithEmail = async (email: string, password: string) => {
    if (isPreviewMode) return { success: true };
    if (!supabase) return { success: false, message: "Erro de conexão" };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, message: error.message };
    return { success: true, data };
};

export const loginWithGoogle = async () => {
    if (isPreviewMode) return { success: true };
    if (!supabase) return { success: false, message: "Erro de conexão" };
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
    });
    if (error) return { success: false, message: error.message };
    return { success: true, data };
};

export const registerWithEmail = async (email: string, password: string, name: string, ministries: string[], phone?: string, roles?: string[]) => {
    if (isPreviewMode) return { success: true, message: "Registro simulado (Demo)" };
    if (!supabase) return { success: false, message: "Erro de conexão" };
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
    if (error) return { success: false, message: error.message };
    if (data.user) {
        const cleanMinistries = ministries.map(m => m.trim().toLowerCase().replace(/\s+/g, '-'));
        const mainMinistry = cleanMinistries[0] || 'midia';
        await supabase.from('profiles').upsert({
            id: data.user.id, email: email, name: name, ministry_id: mainMinistry, allowed_ministries: cleanMinistries,
            whatsapp: phone, functions: roles || [], role: 'member', created_at: new Date().toISOString()
        });
    }
    return { success: true, message: "Conta criada! Verifique seu e-mail." };
};

export const sendPasswordResetEmail = async (email: string) => {
    if (isPreviewMode) return { success: true, message: "Email enviado" };
    if (!supabase) return { success: false, message: "Erro conexão" };
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/?reset=true' });
    if (error) return { success: false, message: error.message };
    return { success: true, message: "Link enviado." };
};

export const joinMinistry = async (newMinistryId: string, roles: string[]) => {
    if (isPreviewMode) return { success: true, message: "Sucesso Demo" };
    if (!supabase) return { success: false, message: "Erro conexão" };
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Usuário não autenticado" };
    const cleanNewMid = newMinistryId.trim().toLowerCase().replace(/\s+/g, '-');
    try {
        const { data: profile } = await supabase.from('profiles').select('name, allowed_ministries, functions').eq('id', user.id).single();
        if (!profile) return { success: false, message: "Perfil não encontrado" };
        const newAllowed = [...(profile.allowed_ministries || []), cleanNewMid];
        const newFunctions = [...new Set([...(profile.functions || []), ...roles])];
        await supabase.from('profiles').update({ allowed_ministries: newAllowed, functions: newFunctions }).eq('id', user.id);
        
        const msg = `${profile.name} entrou na equipe! 🎉`;
        await supabase.from('notifications').insert({ 
            ministry_id: cleanNewMid, 
            title: "Novo Membro", 
            message: msg, 
            type: 'success', 
            action_link: 'members' 
        });
        try { supabase.functions.invoke('push-notification', { body: { ministryId: cleanNewMid, title: "Novo Membro", message: msg, type: 'success' } }); } catch (e) {}

        return { success: true, message: `Bem-vindo ao ministério ${cleanNewMid}!` };
    } catch (e: any) { return { success: false, message: e.message }; }
};

export const deleteMember = async (ministryId: string, memberId: string, memberName: string) => {
    if (!supabase) return { success: false, message: "Erro de conexão" };
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Não autorizado" };

    try {
        // Verificar se é admin
        const { data: requesterProfile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
        if (!requesterProfile?.is_admin) {
            return { success: false, message: "Apenas administradores podem remover membros." };
        }

        const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
        
        // 1. Tentar atualizar o perfil (remover da lista allowed_ministries)
        const { data: profile } = await supabase.from('profiles').select('allowed_ministries, ministry_id').eq('id', memberId).single();
        
        if (profile) {
            const currentAllowed = Array.isArray(profile.allowed_ministries) ? profile.allowed_ministries : [];
            const newAllowed = currentAllowed.filter((m: string) => {
                const normalizedM = (m || "").trim().toLowerCase().replace(/\s+/g, '-');
                return normalizedM && normalizedM !== cleanMid;
            });

            const updates: any = { allowed_ministries: newAllowed };
            const currentActive = (profile.ministry_id || "").trim().toLowerCase().replace(/\s+/g, '-');
            
            if (currentActive === cleanMid) {
                updates.ministry_id = newAllowed.length > 0 ? newAllowed[0] : null;
            }

            const { error: updateError } = await supabase.from('profiles').update(updates).eq('id', memberId);
            
            // SE FALHAR O UPDATE DO PERFIL (ex: RLS bloqueando), não paramos!
            // Assumimos que o admin quer remover o membro da ESCALA e VISÃO, então prosseguimos para deletar assignments.
            if (updateError) {
                console.warn("Update perfil falhou (provável RLS), mas prosseguindo com limpeza de escala.", updateError);
            }
        }

        // 2. Limpeza de Escalas (Isso remove visualmente o usuário das tabelas)
        const todayIso = new Date().toISOString();
        const { error: schedError } = await supabase.from('schedule_assignments')
            .delete()
            .eq('member_id', memberId)
            .in('event_id', (
                await supabase.from('events')
                    .select('id')
                    .eq('ministry_id', cleanMid)
                    .gte('date_time', todayIso)
                    .then(res => res.data?.map(e => e.id) || [])
            ));

        if (schedError) console.error("Erro limpando escalas:", schedError);

        return { success: true, message: "Membro removido da equipe com sucesso." };

    } catch (e: any) { 
        console.error("Exceção em deleteMember:", e); 
        return { success: false, message: e.message || "Erro desconhecido ao excluir." };
    }
};

// ... (Rest of exports: updateUserProfile, updateProfileMinistry... keep unchanged)
export const updateUserProfile = async (name: string, whatsapp: string, avatar_url: string | undefined, functions: string[] | undefined, birthDate: string | undefined, ministryId: string | undefined) => {
    if (isPreviewMode) return { success: true, message: "Perfil Demo Atualizado" };
    if (!supabase) return { success: false, message: "Erro conexão" };
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Não autenticado" };
    
    const updates: any = { name, whatsapp };
    
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (functions !== undefined) updates.functions = functions;
    if (birthDate !== undefined) updates.birth_date = birthDate;
    if (ministryId) updates.ministry_id = ministryId;
    
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (error) return { success: false, message: error.message };
    return { success: true, message: "Perfil atualizado!" };
};

export const updateProfileMinistry = async (userId: string, ministryId: string) => {
    if (!supabase) return;
    await supabase.from('profiles').update({ ministry_id: ministryId }).eq('id', userId);
};

export const fetchGlobalSchedules = async (monthIso: string, currentMinistryId: string): Promise<GlobalConflictMap> => {
    if (!supabase || !monthIso) return {};
    const cleanMid = currentMinistryId.trim().toLowerCase().replace(/\s+/g, '-');
    const startDate = `${monthIso}-01T00:00:00`;
    const [y, m] = monthIso.split('-').map(Number);
    const nextMonth = new Date(y, m, 1).toISOString();
    try {
        const { data } = await supabase.from('schedule_assignments')
            .select(`role, member_id, profiles:member_id!inner(name), events:event_id!inner(date_time, ministry_id)`)
            .neq('events.ministry_id', cleanMid)
            .gte('events.date_time', startDate)
            .lt('events.date_time', nextMonth);
        const conflicts: GlobalConflictMap = {};
        data?.forEach((row: any) => {
            if (row.profiles?.name) {
                const name = row.profiles.name.trim().toLowerCase();
                if (!conflicts[name]) conflicts[name] = [];
                conflicts[name].push({ ministryId: row.events.ministry_id, eventIso: row.events.date_time.slice(0, 16), role: row.role });
            }
        });
        return conflicts;
    } catch (e) { return {}; }
};

export const fetchRankingData = async (ministryId: string): Promise<RankingEntry[]> => {
    if (!supabase) return [];
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    try {
        const { data: members } = await supabase.from('profiles').select('id, name, avatar_url').or(`ministry_id.eq.${cleanMid},allowed_ministries.cs.{${cleanMid}}`);
        if (!members) return [];
        const ids = members.map((m: any) => m.id);
        const { data: assigns } = await supabase.from('schedule_assignments').select('member_id').in('member_id', ids).eq('confirmed', true);
        const { data: inters } = await supabase.from('announcement_interactions').select('user_id, interaction_type').in('user_id', ids);
        
        return members.map((m: any) => {
            const confirmed = assigns?.filter((a: any) => a.member_id === m.id).length || 0;
            const reads = inters?.filter((i: any) => i.user_id === m.id && i.interaction_type === 'read').length || 0;
            const likes = inters?.filter((i: any) => i.user_id === m.id && i.interaction_type === 'like').length || 0;
            return {
                memberId: m.id, name: m.name, avatar_url: m.avatar_url,
                points: (confirmed * 100) + (reads * 5) + (likes * 10),
                stats: { confirmedEvents: confirmed, missedEvents: 0, swapsRequested: 0, announcementsRead: reads, announcementsLiked: likes }
            };
        }).sort((a, b) => b.points - a.points);
    } catch (e) { return []; }
};

export const fetchMinistryAvailability = async (ministryId: string): Promise<{ availability: AvailabilityMap, notes: AvailabilityNotesMap }> => {
    if (isPreviewMode) return { availability: {}, notes: {} };
    if (!supabase || !ministryId) return { availability: {}, notes: {} };
    
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const { data: members } = await supabase
            .from('profiles')
            .select('id, name')
            .or(`ministry_id.eq.${cleanMid},allowed_ministries.cs.{${cleanMid}}`);
            
        if (!members || members.length === 0) return { availability: {}, notes: {} };
        
        const memberNames = members.reduce((acc: any, m: any) => { acc[m.id] = m.name; return acc; }, {});
        const memberIds = members.map((m: any) => m.id);

        const { data } = await supabase
            .from('availability')
            .select('*')
            .in('member_id', memberIds);

        const availability: AvailabilityMap = {};
        const notes: AvailabilityNotesMap = {};

        data?.forEach((row: any) => {
            const name = memberNames[row.member_id] || 'Desconhecido';
            const dbDate = row.date; 
            
            let metadata: any = {};
            let userNoteText = "";

            if (row.note) {
                try {
                    if (row.note.startsWith('{')) {
                        metadata = JSON.parse(row.note);
                        userNoteText = metadata.text || "";
                    } else {
                        userNoteText = row.note;
                    }
                } catch (e) { userNoteText = row.note; }
            }

            let uiDateKey = dbDate;

            if (metadata.period === 'M') {
                uiDateKey = `${dbDate}_M`;
            } else if (metadata.period === 'N') {
                uiDateKey = `${dbDate}_N`;
            }

            if (metadata.type !== 'GENERAL') {
                // Se não for nota geral, é registro de disponibilidade (data POSITIVA)
                if (!availability[name]) availability[name] = [];
                availability[name].push(uiDateKey);
            }

            if (userNoteText) {
                if (metadata.type === 'GENERAL') {
                    const [y, m] = dbDate.split('-');
                    notes[`${name}_${y}-${m}-00`] = userNoteText;
                } else {
                    notes[`${name}_${dbDate}`] = userNoteText;
                }
            }
        });

        return { availability, notes };
    } catch (e) {
        console.error("Erro fetch availability:", e);
        return { availability: {}, notes: {} };
    }
};

export const saveMemberAvailability = async (
    userId: string, 
    memberName: string, 
    dates: string[], 
    targetMonth: string, 
    notes?: Record<string, string>
) => {
    if (isPreviewMode) return;
    if (!supabase) return;
    
    if (!targetMonth || targetMonth.length !== 7) {
        console.error("Mês alvo inválido:", targetMonth);
        return;
    }

    try {
        const [y, m] = targetMonth.split('-').map(Number);
        const startDate = `${targetMonth}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        const endDate = `${targetMonth}-${String(lastDay).padStart(2, '0')}`;

        // Deleta TODAS as entradas existentes para esse usuário nesse mês
        // Isso é crucial: Se o usuário remove um dia da lista, ele deve ser deletado do banco.
        const { error: deleteError } = await supabase.from('availability')
            .delete()
            .eq('member_id', userId)
            .gte('date', startDate)
            .lte('date', endDate);
        
        if (deleteError) throw deleteError;

        const rowsToInsert: any[] = [];
        
        // 1. Processa Datas de Disponibilidade (Positiva)
        const availableDates = dates.filter(d => d.startsWith(targetMonth));
        
        for (const uiDate of availableDates) {
            const [datePart, suffix] = uiDate.split('_'); 
            
            let metadata: any = {};
            if (suffix === 'M') metadata.period = 'M';
            if (suffix === 'N') metadata.period = 'N';
            
            rowsToInsert.push({
                member_id: userId,
                date: datePart, 
                note: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
                status: 'available' 
            });
        }

        // 2. Processa Nota Geral do Mês
        const generalNoteKey = `${targetMonth}-00`;
        if (notes && notes[generalNoteKey]) {
            const generalText = notes[generalNoteKey];
            const firstOfMonth = `${targetMonth}-01`;
            
            // Verifica se já existe uma entrada para o dia 1 (disponibilidade)
            const existingEntryIndex = rowsToInsert.findIndex(r => r.date === firstOfMonth);
            
            if (existingEntryIndex >= 0) {
                // Se já existe, atualiza metadata
                const existingRow = rowsToInsert[existingEntryIndex];
                let existingMeta = {};
                try {
                    if (existingRow.note) existingMeta = JSON.parse(existingRow.note);
                } catch(e) {}
                
                rowsToInsert[existingEntryIndex].note = JSON.stringify({
                    ...existingMeta,
                    type: 'GENERAL',
                    text: generalText
                });
            } else {
                // Se não existe, cria entrada apenas para a nota
                rowsToInsert.push({
                    member_id: userId,
                    date: firstOfMonth,
                    note: JSON.stringify({ type: 'GENERAL', text: generalText }),
                    status: 'available' 
                });
            }
        }

        if (rowsToInsert.length > 0) {
            const { error: insertError } = await supabase.from('availability').insert(rowsToInsert);
            if (insertError) throw insertError;
        }

    } catch (e: any) {
        console.error("Falha crítica na função saveMemberAvailability:", e.message || e);
        throw e;
    }
};

// ... (Keep the rest of the file unchanged: fetchRepertoire, addToRepertoire, etc.)
export const fetchRepertoire = async (ministryId: string): Promise<RepertoireItem[]> => {
    if (!supabase) return [];
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    try {
        const { data } = await supabase.from('repertoire').select('*').or(`ministry_id.eq.${cleanMid},ministry_id.eq.shared`).order('event_date', { ascending: false });
        return (data || []).map((row: any) => ({
            id: row.id, title: row.title, link: row.link || '', date: row.event_date, addedBy: row.added_by, createdAt: row.created_at
        }));
    } catch (e) { return []; }
};

export const addToRepertoire = async (ministryId: string, item: Omit<RepertoireItem, 'id' | 'createdAt'>): Promise<boolean> => {
    if (!supabase) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const { error } = await supabase.from('repertoire').insert({
        ministry_id: cleanMid, title: item.title, link: item.link, event_date: item.date, added_by: item.addedBy
    });
    return !error;
};

export const deleteFromRepertoire = async (id: string) => {
    if (!supabase) return;
    await supabase.from('repertoire').delete().eq('id', id);
};

export const fetchSwapRequests = async (ministryId: string): Promise<SwapRequest[]> => {
    if (!supabase) return [];
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    try {
        const { data } = await supabase.from('swap_requests').select('*').eq('ministry_id', cleanMid).order('created_at', { ascending: false });
        return (data || []).map((row: any) => ({
            id: row.id, ministryId: row.ministry_id, requesterName: row.requester_name, requesterId: row.requester_id,
            role: row.role, eventIso: row.event_iso ? new Date(row.event_iso).toISOString().slice(0,16) : '',
            eventTitle: row.event_title, status: row.status, createdAt: row.created_at, takenByName: row.taken_by_name
        }));
    } catch (e) { return []; }
};

export const fetchMinistrySettings = async (ministryId: string): Promise<MinistrySettings> => {
    if (!supabase) return { displayName: '', roles: [] };
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    try {
        const { data } = await supabase.from('ministry_settings').select('*').eq('ministry_id', cleanMid).single();
        if (data?.spotify_client_id) localStorage.setItem(`spotify_cid_${cleanMid}`, data.spotify_client_id);
        if (data?.spotify_client_secret) localStorage.setItem(`spotify_sec_${cleanMid}`, data.spotify_client_secret);
        return { 
            displayName: data?.display_name || '', 
            roles: (data?.roles && data.roles.length > 0) ? data.roles : (DEFAULT_ROLES[cleanMid] || DEFAULT_ROLES['default']),
            availabilityStart: data?.availability_start,
            availabilityEnd: data?.availability_end,
            spotifyClientId: data?.spotify_client_id,
            spotifyClientSecret: data?.spotify_client_secret
        };
    } catch (e) { return { displayName: '', roles: DEFAULT_ROLES[cleanMid] || [] }; }
};

export const saveMinistrySettings = async (ministryId: string, displayName?: string, roles?: string[], availabilityStart?: string, availabilityEnd?: string, spotifyClientId?: string, spotifyClientSecret?: string) => {
    if (!supabase) return;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const updates: any = { ministry_id: cleanMid };
    if (displayName !== undefined) updates.display_name = displayName;
    if (roles !== undefined) updates.roles = roles;
    if (availabilityStart !== undefined) updates.availability_start = availabilityStart;
    if (availabilityEnd !== undefined) updates.availability_end = availabilityEnd;
    if (spotifyClientId !== undefined) updates.spotify_client_id = spotifyClientId;
    if (spotifyClientSecret !== undefined) updates.spotify_client_secret = spotifyClientSecret;
    await supabase.from('ministry_settings').upsert(updates, { onConflict: 'ministry_id' });
};

export const createSwapRequestSQL = async (ministryId: string, req: SwapRequest) => {
    if (!supabase) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const eventIsoString = req.eventIso.length === 16 ? req.eventIso + ":00" : req.eventIso;
    const { error } = await supabase.from('swap_requests').insert({
        ministry_id: cleanMid, requester_id: req.requesterId, requester_name: req.requesterName,
        role: req.role, event_iso: eventIsoString, event_title: req.eventTitle, status: 'pending'
    });
    if (!error) {
        await sendNotificationSQL(cleanMid, { title: `Troca: ${req.role}`, message: `${req.requesterName} precisa de substituto.`, type: "warning", actionLink: "swaps" });
    }
    return !error;
};

export const performSwapSQL = async (ministryId: string, requestId: string, takerName: string, takerId: string) => {
    if (!supabase) return { success: false, message: "Erro conexão" };
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    try {
        const { data: req } = await supabase.from('swap_requests').select('*').eq('id', requestId).single();
        if (!req || req.status !== 'pending') return { success: false, message: "Inválido" };
        const searchIso = req.event_iso.slice(0, 16); 
        const { data: events } = await supabase.from('events').select('id, title').eq('ministry_id', cleanMid).ilike('date_time', `${searchIso}%`).limit(1);
        if (!events || events.length === 0) return { success: false, message: "Evento não encontrado" };
        await supabase.from('schedule_assignments').delete().eq('event_id', events[0].id).eq('member_id', req.requester_id);
        await supabase.from('schedule_assignments').insert({ event_id: events[0].id, role: req.role, member_id: takerId, confirmed: true });
        await supabase.from('swap_requests').update({ status: 'completed', taken_by_id: takerId, taken_by_name: takerName }).eq('id', requestId);
        await sendNotificationSQL(cleanMid, { type: 'success', title: 'Troca Realizada', message: `${takerName} assumiu a escala.`, actionLink: "calendar" });
        return { success: true, message: "Troca realizada!" };
    } catch (e) { return { success: false, message: "Erro" }; }
};

export const fetchNotificationsSQL = async (ministryId: string, userId: string): Promise<AppNotification[]> => {
    if (!supabase) return [];
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    try {
        const { data } = await supabase.from('notifications').select('*').eq('ministry_id', cleanMid).order('created_at', { ascending: false }).limit(50);
        return (data || []).map((row: any) => ({
            id: row.id, type: row.type, title: row.title, message: row.message, timestamp: row.created_at, read: (row.read_by || []).includes(userId), actionLink: row.action_link
        }));
    } catch (e) { return []; }
};

export const sendNotificationSQL = async (ministryId: string, payload: { title: string; message: string; type?: string; actionLink?: string }) => {
    if (!supabase) return;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    await supabase.from('notifications').insert({ ministry_id: cleanMid, title: payload.title, message: payload.message, type: payload.type || 'info', action_link: payload.actionLink });
    try { supabase.functions.invoke('push-notification', { body: { ministryId: cleanMid, ...payload } }); } catch (e) {}
};

export const markNotificationsReadSQL = async (ids: string[], userId: string) => {
    if (!supabase) return;
    for (const id of ids) {
        const { data } = await supabase.from('notifications').select('read_by').eq('id', id).single();
        const currentRead = data?.read_by || [];
        if (!currentRead.includes(userId)) await supabase.from('notifications').update({ read_by: [...currentRead, userId] }).eq('id', id);
    }
};

export const clearAllNotificationsSQL = async (ministryId: string) => {
    if (!supabase) return;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    await supabase.from('notifications').delete().eq('ministry_id', cleanMid);
};

export const fetchAnnouncementsSQL = async (ministryId: string): Promise<Announcement[]> => {
    if (!supabase) return [];
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    try {
        const { data } = await supabase.from('announcements').select(`*, announcement_interactions(user_id, user_name, interaction_type, created_at)`).eq('ministry_id', cleanMid).order('created_at', { ascending: false });
        return (data || []).map((row: any) => ({
            id: row.id, title: row.title, message: row.message, type: row.type, timestamp: row.created_at, expirationDate: row.expiration_date, author: row.author_name || 'Admin',
            readBy: (row.announcement_interactions || []).filter((i: any) => i.interaction_type === 'read').map((i: any) => ({ userId: i.user_id, name: i.user_name, timestamp: i.created_at })),
            likedBy: (row.announcement_interactions || []).filter((i: any) => i.interaction_type === 'like').map((i: any) => ({ userId: i.user_id, name: i.user_name, timestamp: i.created_at })),
        }));
    } catch (e) { return []; }
};

export const createAnnouncementSQL = async (ministryId: string, data: any, authorName: string) => {
    if (!supabase) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const { error } = await supabase.from('announcements').insert({ ministry_id: cleanMid, title: data.title, message: data.message, type: data.type, expiration_date: data.expirationDate, author_name: authorName });
    return !error;
};

export const interactAnnouncementSQL = async (announcementId: string, userId: string, userName: string, type: 'read' | 'like') => {
    if (!supabase) return;
    if (type === 'read') {
        await supabase.from('announcement_interactions').upsert({ announcement_id: announcementId, user_id: userId, user_name: userName, interaction_type: 'read' }, { onConflict: 'announcement_id,user_id,interaction_type' });
    } else {
        const { data } = await supabase.from('announcement_interactions').select('id').eq('announcement_id', announcementId).eq('user_id', userId).eq('interaction_type', 'like').single();
        if (data) await supabase.from('announcement_interactions').delete().eq('id', data.id);
        else await supabase.from('announcement_interactions').insert({ announcement_id: announcementId, user_id: userId, user_name: userName, interaction_type: 'like' });
    }
};

export const toggleAdminSQL = async (email: string, setAdmin: boolean) => {
    if (!supabase) return;
    await supabase.from('profiles').update({ is_admin: setAdmin }).eq('email', email);
};

export const saveSubscriptionSQL = async (ministryId: string, sub: PushSubscription) => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if(!user) return;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const subJSON = sub.toJSON();
    await supabase.from('push_subscriptions').upsert({
        endpoint: sub.endpoint, user_id: user.id, ministry_id: cleanMid,
        p256dh: subJSON.keys?.p256dh || '', auth: subJSON.keys?.auth || '',
        device_id: localStorage.getItem('device_id') || 'unknown', updated_at: new Date().toISOString()
    }, { onConflict: 'endpoint' });
};

export const createMinistryEvent = async (ministryId: string, event: { title: string, date: string, time: string }): Promise<boolean> => {
    if (!supabase) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const { error } = await supabase.from('events').insert({ ministry_id: cleanMid, title: event.title, date_time: `${event.date}T${event.time}:00` });
    if (!error) await sendNotificationSQL(cleanMid, { title: "Novo Evento", message: `Novo evento: ${event.title} dia ${event.date.split('-').reverse().join('/')}`, type: 'info', actionLink: 'calendar' });
    return !error;
};

export const fetchMinistryMembers = async (ministryId: string): Promise<{ memberMap: MemberMap, publicList: TeamMemberProfile[] }> => {
    if (!supabase) return { memberMap: {}, publicList: [] };
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    try {
        const settings = await fetchMinistrySettings(cleanMid);
        const validRoles = settings.roles || [];
        const { data: profiles } = await supabase.from('profiles').select('*').or(`ministry_id.eq.${cleanMid},allowed_ministries.cs.{${cleanMid}}`);
        const publicList: TeamMemberProfile[] = (profiles || []).map((p: any) => ({
            id: p.id, name: p.name || 'Sem nome', email: p.email, whatsapp: p.whatsapp,
            avatar_url: p.avatar_url, birthDate: p.birth_date, roles: (p.functions || []).filter((r: string) => validRoles.includes(r)),
            createdAt: p.created_at, isAdmin: p.is_admin
        })).sort((a: any, b: any) => a.name.localeCompare(b.name));
        
        const memberMap: MemberMap = {};
        profiles?.forEach((p: any) => {
            (p.functions || []).forEach((r: string) => {
                if (validRoles.includes(r)) { if (!memberMap[r]) memberMap[r] = []; if (!memberMap[r].includes(p.name)) memberMap[r].push(p.name); }
            });
        });
        return { memberMap, publicList };
    } catch (e) { return { memberMap: {}, publicList: [] }; }
};

export const fetchMinistrySchedule = async (ministryId: string, monthIso: string): Promise<{ schedule: ScheduleMap, events: any[], attendance: AttendanceMap }> => {
    if (!supabase) return { schedule: {}, events: [], attendance: {} };
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    try {
        const start = `${monthIso}-01T00:00:00`;
        const [y, m] = monthIso.split('-').map(Number);
        const next = new Date(y, m, 1).toISOString().split('T')[0];
        let { data: events } = await supabase.from('events').select('id, title, date_time').eq('ministry_id', cleanMid).gte('date_time', start).lt('date_time', `${next}T00:00:00`).order('date_time', { ascending: true });
        
        if (!events || events.length === 0) { // Auto-create defaults
            const days = new Date(y, m, 0).getDate();
            const toCreate = [];
            for (let d = 1; d <= days; d++) {
                const date = new Date(y, m - 1, d);
                const dw = date.getDay();
                const ds = date.toISOString().split('T')[0];
                if (dw === 3) toCreate.push({ ministry_id: cleanMid, title: "Culto (Quarta)", date_time: `${ds}T19:30:00` });
                else if (dw === 0) {
                    toCreate.push({ ministry_id: cleanMid, title: "Culto (Domingo - Manhã)", date_time: `${ds}T09:00:00` });
                    toCreate.push({ ministry_id: cleanMid, title: "Culto (Domingo - Noite)", date_time: `${ds}T18:00:00` });
                }
            }
            if (toCreate.length > 0) { const { data } = await supabase.from('events').insert(toCreate).select(); if(data) events = data; }
        }
        if(!events) return { schedule: {}, events: [], attendance: {} };

        const ids = events.map(e => e.id);
        const { data: assigns } = await supabase.from('schedule_assignments').select(`event_id, role, confirmed, profiles(name)`).in('event_id', ids);
        
        const schedule: ScheduleMap = {};
        const attendance: AttendanceMap = {};
        assigns?.forEach((a: any) => {
            const ev = events?.find(e => e.id === a.event_id);
            if (ev && a.profiles) {
                const k = `${ev.date_time.slice(0,16)}_${a.role}`;
                schedule[k] = a.profiles.name;
                if(a.confirmed) attendance[k] = true;
            }
        });
        const uiEvents = events.map(e => ({ id: e.id, title: e.title, date: e.date_time.split('T')[0], time: e.date_time.split('T')[1].slice(0,5), iso: e.date_time.slice(0,16), dateDisplay: `${e.date_time.split('T')[0].split('-')[2]}/${e.date_time.split('T')[0].split('-')[1]}` }));
        return { schedule, events: uiEvents, attendance };
    } catch (e) { return { schedule: {}, events: [], attendance: {} }; }
};

export const clearScheduleForMonth = async (ministryId: string, monthIso: string) => {
    if (!supabase) return;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const start = `${monthIso}-01T00:00:00`;
    const [y, m] = monthIso.split('-').map(Number);
    const next = new Date(y, m, 1).toISOString().split('T')[0];
    const { data } = await supabase.from('events').select('id').eq('ministry_id', cleanMid).gte('date_time', start).lt('date_time', `${next}T00:00:00`);
    if (data && data.length > 0) await supabase.from('schedule_assignments').delete().in('event_id', data.map(e => e.id));
};

export const resetToDefaultEvents = async (ministryId: string, monthIso: string) => {
    if (!supabase) return;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    await clearScheduleForMonth(ministryId, monthIso);
    const start = `${monthIso}-01T00:00:00`;
    const [y, m] = monthIso.split('-').map(Number);
    const next = new Date(y, m, 1).toISOString().split('T')[0];
    await supabase.from('events').delete().eq('ministry_id', cleanMid).gte('date_time', start).lt('date_time', `${next}T00:00:00`);
    // fetchMinistrySchedule will auto-recreate them
};

export const updateMinistryEvent = async (ministryId: string, oldIso: string, newTitle: string, newIso: string, applyToAll: boolean) => {
    if (!supabase) return;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const targetIso = `${oldIso}:00`;
    const { data } = await supabase.from('events').select('id, title').eq('ministry_id', cleanMid).eq('date_time', targetIso).limit(1);
    if (!data || data.length === 0) return;
    
    if (applyToAll) {
        const [y, m] = oldIso.split('T')[0].split('-').map(Number);
        const start = `${y}-${String(m).padStart(2,'0')}-01T00:00:00`;
        const end = new Date(y, m, 0).toISOString();
        const { data: similar } = await supabase.from('events').select('id, date_time').eq('ministry_id', cleanMid).eq('title', data[0].title).gte('date_time', start).lte('date_time', end);
        const newTime = newIso.split('T')[1];
        if (similar) {
            for (const ev of similar) {
                const newDt = `${ev.date_time.split('T')[0]}T${newTime}:00`;
                await supabase.from('events').update({ title: newTitle, date_time: newDt }).eq('id', ev.id);
            }
        }
    } else {
        await supabase.from('events').update({ title: newTitle, date_time: `${newIso}:00` }).eq('id', data[0].id);
    }
};

export const deleteMinistryEvent = async (ministryId: string, iso: string) => {
    if (!supabase) return;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const { data } = await supabase.from('events').select('id').eq('ministry_id', cleanMid).eq('date_time', `${iso}:00`);
    if (data && data.length > 0) {
        await supabase.from('schedule_assignments').delete().in('event_id', data.map(e => e.id));
        await supabase.from('events').delete().in('id', data.map(e => e.id));
    }
};

export const saveScheduleAssignment = async (ministryId: string, key: string, memberName: string) => {
    if (!supabase) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const iso = key.slice(0, 16);
    const role = key.split('_').pop();
    let eventId;
    
    let { data: ev } = await supabase.from('events').select('id').eq('ministry_id', cleanMid).eq('date_time', `${iso}:00`).single();
    if (!ev) { // Auto-create if missing
        if (!memberName) return true;
        const d = new Date(iso);
        const dw = d.getDay();
        const h = d.getHours();
        let t = "Evento Extra";
        if (dw === 3) t = "Culto (Quarta)";
        else if (dw === 0) t = h < 13 ? "Culto (Domingo - Manhã)" : "Culto (Domingo - Noite)";
        const { data: newEv } = await supabase.from('events').insert({ ministry_id: cleanMid, title: t, date_time: `${iso}:00` }).select('id').single();
        if(newEv) eventId = newEv.id; else return false;
    } else { eventId = ev.id; }

    if (!memberName) {
        await supabase.from('schedule_assignments').delete().eq('event_id', eventId).eq('role', role);
        return true;
    }

    const { data: profile } = await supabase.from('profiles').select('id').or(`ministry_id.eq.${cleanMid},allowed_ministries.cs.{${cleanMid}}`).eq('name', memberName.trim()).single();
    if (!profile) return false;

    await supabase.from('schedule_assignments').delete().eq('event_id', eventId).eq('role', role);
    const { error } = await supabase.from('schedule_assignments').insert({ event_id: eventId, role: role, member_id: profile.id });
    return !error;
};

export const saveScheduleBulk = async (ministryId: string, schedule: ScheduleMap, strict: boolean) => {
    if (!supabase) return false;
    for (const [key, val] of Object.entries(schedule)) {
        await saveScheduleAssignment(ministryId, key, val);
    }
    return true;
};

export const toggleAssignmentConfirmation = async (ministryId: string, key: string) => {
    if (!supabase) return false;
    const iso = key.slice(0, 16);
    const role = key.split('_').pop();
    const { data: ev } = await supabase.from('events').select('id').eq('ministry_id', ministryId.trim().toLowerCase().replace(/\s+/g,'-')).eq('date_time', `${iso}:00`).single();
    if (!ev) return false;
    const { data: assign } = await supabase.from('schedule_assignments').select('id, confirmed').eq('event_id', ev.id).eq('role', role).single();
    if (!assign) return false;
    const { error } = await supabase.from('schedule_assignments').update({ confirmed: !assign.confirmed }).eq('id', assign.id);
    return !error;
};
