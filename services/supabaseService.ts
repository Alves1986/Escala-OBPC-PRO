
// ... (imports)
// Mantenha os imports iguais
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
    SUPABASE_URL, SUPABASE_KEY, PushSubscriptionRecord, User, MemberMap, 
    AppNotification, TeamMemberProfile, AvailabilityMap, SwapRequest, 
    ScheduleMap, RepertoireItem, Announcement, GlobalConflictMap, 
    GlobalConflict, DEFAULT_ROLES, AttendanceMap, AuditLogEntry, MinistrySettings,
    RankingEntry, AvailabilityNotesMap
} from '../types';

// ... (rest of configuration code remains the same)
const isPreviewMode = SUPABASE_URL === 'https://preview.mode';

let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_KEY && !isPreviewMode) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

export const getSupabase = () => supabase;

const safeDb = () => {
    if (!supabase) throw new Error("Conexão com banco de dados não estabelecida.");
    return supabase;
};

// ... (Authentication functions remain the same)
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

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } }
    });

    if (error) return { success: false, message: error.message };
    if (data.user) {
        const cleanMinistries = ministries.map(m => m.trim().toLowerCase().replace(/\s+/g, '-'));
        const mainMinistry = cleanMinistries[0] || 'midia';

        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: data.user.id,
                email: email,
                name: name,
                ministry_id: mainMinistry,
                allowed_ministries: cleanMinistries,
                whatsapp: phone,
                functions: roles || [],
                role: 'member',
                created_at: new Date().toISOString()
            });
            
        if (profileError) console.error("Erro criando perfil:", profileError);
    }

    return { success: true, message: "Conta criada! Verifique seu e-mail." };
};

export const sendPasswordResetEmail = async (email: string) => {
    if (isPreviewMode) return { success: true, message: "Email enviado (Demo)" };
    if (!supabase) return { success: false, message: "Erro de conexão" };

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/?reset=true',
    });

    if (error) return { success: false, message: error.message };
    return { success: true, message: "Link de recuperação enviado." };
};

export const joinMinistry = async (newMinistryId: string, roles: string[]): Promise<{ success: boolean; message: string }> => {
    if (isPreviewMode) return { success: true, message: "Entrou no ministério (Demo)" };
    if (!supabase) return { success: false, message: "Erro de conexão" };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Usuário não autenticado" };

    const cleanNewMid = newMinistryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const { data: profile } = await supabase.from('profiles').select('allowed_ministries, functions').eq('id', user.id).single();
        if (!profile) return { success: false, message: "Perfil não encontrado" };

        const currentAllowed = profile.allowed_ministries || [];
        if (currentAllowed.includes(cleanNewMid)) {
            return { success: false, message: "Você já participa deste ministério." };
        }

        const newAllowed = [...currentAllowed, cleanNewMid];
        const currentFunctions = profile.functions || [];
        const newFunctions = [...new Set([...currentFunctions, ...roles])];

        const { error } = await supabase
            .from('profiles')
            .update({ allowed_ministries: newAllowed, functions: newFunctions })
            .eq('id', user.id);

        if (error) throw error;
        return { success: true, message: `Bem-vindo ao ministério ${cleanNewMid}!` };
    } catch (e: any) {
        return { success: false, message: e.message || "Erro ao entrar no ministério." };
    }
};

export const deleteMember = async (ministryId: string, memberId: string, memberName: string) => {
    if (isPreviewMode) return;
    if (!supabase) return;
    
    try {
        const { data: profile } = await supabase.from('profiles').select('allowed_ministries').eq('id', memberId).single();
        if (profile) {
            const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
            const newAllowed = (profile.allowed_ministries || []).filter((m: string) => m !== cleanMid);
            
            await supabase.from('profiles').update({ allowed_ministries: newAllowed }).eq('id', memberId);
        }
    } catch (e) {
        console.error("Error removing member:", e);
    }
};

export const updateUserProfile = async (name: string, whatsapp: string, avatar_url: string | undefined, functions: string[] | undefined, birthDate: string | undefined, ministryId: string | undefined): Promise<{ success: boolean; message: string }> => {
    if (isPreviewMode) return { success: true, message: "Perfil atualizado (Demo)" };
    if (!supabase) return { success: false, message: "Erro de conexão" };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Não autenticado" };

    const updates: any = { name, whatsapp, updated_at: new Date().toISOString() };
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (functions !== undefined) updates.functions = functions;
    if (birthDate !== undefined) updates.birth_date = birthDate;
    if (ministryId) updates.ministry_id = ministryId;

    try {
        const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
        if (error) throw error;
        return { success: true, message: "Perfil atualizado!" };
    } catch (e: any) {
        return { success: false, message: e.message || "Erro ao atualizar perfil." };
    }
};

export const updateProfileMinistry = async (userId: string, ministryId: string) => {
    if (isPreviewMode) return;
    if (!supabase) return;
    await supabase.from('profiles').update({ ministry_id: ministryId }).eq('id', userId);
};

// ... (Data fetching conflicts)
export const fetchGlobalSchedules = async (monthIso: string, currentMinistryId: string): Promise<GlobalConflictMap> => {
    if (isPreviewMode) return {};
    if (!supabase) return {};
    if (!monthIso || !currentMinistryId) return {}; 
    
    const cleanMid = currentMinistryId.trim().toLowerCase().replace(/\s+/g, '-');
    
    // Ensure monthIso is valid YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(monthIso)) {
        return {};
    }

    const [y, m] = monthIso.split('-').map(Number);
    const startDate = `${monthIso}-01T00:00:00`;
    // Handle month roll-over correctly
    const nextMonthDate = new Date(y, m, 1); 
    const nextMonth = nextMonthDate.toISOString();

    try {
        // Explicit FK syntax: table:fk_column!inner(...) to avoid ambiguity
        const { data, error } = await supabase
            .from('schedule_assignments')
            .select(`
                role, 
                member_id, 
                profiles:member_id!inner(name), 
                events:event_id!inner(date_time, ministry_id)
            `)
            .neq('events.ministry_id', cleanMid)
            .gte('events.date_time', startDate)
            .lt('events.date_time', nextMonth);

        if (error) throw error;

        const conflicts: GlobalConflictMap = {};
        data?.forEach((row: any) => {
            // Note: profiles is now available under 'profiles' key because of aliasing or direct mapping
            if (row.profiles && row.profiles.name) {
                const name = row.profiles.name.trim().toLowerCase();
                if (!conflicts[name]) conflicts[name] = [];
                conflicts[name].push({
                    ministryId: row.events.ministry_id,
                    eventIso: row.events.date_time.slice(0, 16),
                    role: row.role
                });
            }
        });
        return conflicts;
    } catch (e) {
        // Suppress errors for conflicts to avoid interrupting main flow
        console.error("fetchGlobalSchedules error:", JSON.stringify(e));
        return {};
    }
};

export const fetchRankingData = async (ministryId: string): Promise<RankingEntry[]> => {
    if (isPreviewMode) return [];
    if (!supabase) return [];
    
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    
    try {
        const { data: members } = await supabase.from('profiles').select('id, name, avatar_url').or(`ministry_id.eq.${cleanMid},allowed_ministries.cs.{${cleanMid}}`);
        if (!members) return [];
        
        const memberIds = members.map((m: any) => m.id);
        const { data: assignments } = await supabase.from('schedule_assignments').select('member_id, confirmed').in('member_id', memberIds).eq('confirmed', true);
        const { data: interactions } = await supabase.from('announcement_interactions').select('user_id, interaction_type').in('user_id', memberIds);
            
        const ranking: RankingEntry[] = members.map((m: any) => {
            const confirmedCount = assignments?.filter((a: any) => a.member_id === m.id).length || 0;
            const reads = interactions?.filter((i: any) => i.user_id === m.id && i.interaction_type === 'read').length || 0;
            const likes = interactions?.filter((i: any) => i.user_id === m.id && i.interaction_type === 'like').length || 0;
            const points = (confirmedCount * 100) + (reads * 5) + (likes * 10);
            
            return {
                memberId: m.id,
                name: m.name,
                avatar_url: m.avatar_url,
                points,
                stats: { confirmedEvents: confirmedCount, missedEvents: 0, swapsRequested: 0, announcementsRead: reads, announcementsLiked: likes }
            };
        });
        return ranking.sort((a, b) => b.points - a.points);
    } catch (e) {
        return [];
    }
};

// ... (rest of the file remains unchanged)
// --- AVAILABILITY ---
export const fetchMinistryAvailability = async (ministryId: string): Promise<{ availability: AvailabilityMap, notes: AvailabilityNotesMap }> => {
    if (isPreviewMode) return { availability: {}, notes: {} };
    if (!supabase || !ministryId) return { availability: {}, notes: {} };
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        // 1. Busca os membros deste ministério primeiro (incluindo nomes para mapeamento)
        const { data: members } = await supabase
            .from('profiles')
            .select('id, name')
            .or(`ministry_id.eq.${cleanMid},allowed_ministries.cs.{${cleanMid}}`);
            
        if (!members || members.length === 0) return { availability: {}, notes: {} };
        
        const memberIds = members.map((m: any) => m.id);
        const memberNames = members.reduce((acc: any, m: any) => {
            acc[m.id] = m.name;
            return acc;
        }, {});

        // 2. Busca disponibilidade APENAS desses membros
        const { data } = await supabase
            .from('availability')
            .select('*')
            .in('member_id', memberIds);

        const availability: AvailabilityMap = {};
        const notes: AvailabilityNotesMap = {};

        data?.forEach((row: any) => {
            const name = memberNames[row.member_id] || row.member_name || 'Desconhecido';
            
            // Lógica de recuperação robusta: Tenta 'date_iso' primeiro (string), depois 'date' (pode ser date obj).
            // Se 'note' contiver JSON com a chave original, usa ela.
            let dateValue = row.date_iso || row.date;
            let noteValue = row.note;

            // Check if note contains metadata (Legacy/Strict Date fix)
            if (typeof noteValue === 'string' && noteValue.startsWith('{')) {
                try {
                    const parsed = JSON.parse(noteValue);
                    if (parsed.key) {
                        dateValue = parsed.key;
                        noteValue = parsed.note || "";
                    }
                } catch (e) { /* ignore */ }
            }

            if (dateValue) {
                if (!availability[name]) {
                    availability[name] = [];
                }
                availability[name].push(dateValue);
                
                if (noteValue) {
                    const dateKey = dateValue.split('_')[0];
                    const noteKey = `${name}_${dateKey}`; 
                    notes[noteKey] = noteValue;
                }
            }
        });

        return { availability, notes };
    } catch (e) {
        console.error("Erro fetch availability:", e);
        return { availability: {}, notes: {} };
    }
};

export const saveMemberAvailability = async (userId: string, memberName: string, dates: string[], notes?: Record<string, string>) => {
    if (isPreviewMode) return;
    if (!supabase) return;
    
    try {
        // 1. Limpa disponibilidade anterior para este usuário (Clean Slate)
        const { error: deleteError } = await supabase
            .from('availability')
            .delete()
            .eq('member_id', userId);

        if (deleteError) {
            console.error("Erro ao limpar disponibilidade antiga:", deleteError);
            throw new Error(`Erro ao limpar dados anteriores: ${deleteError.message}`);
        }

        // 2. Insere as novas datas
        if (dates.length > 0) {
            const rows = dates.map(d => {
                const datePart = d.split('_')[0]; // "YYYY-MM-DD"
                const userNote = notes ? notes[datePart] : null;

                // Sanitização para coluna DATE estrita
                // Se a data for inválida (ex: dia 99 ou 00), normalizamos para dia 01
                // e salvamos a chave original no campo NOTE como JSON.
                let dbDate = datePart;
                let dbNote = userNote;
                
                // Validação de Data Estrita (PostgreSQL DATE type)
                // Se a string contiver sufixos (_M, _N, _BLK) ou dias inválidos (00, 99),
                // usamos o dia 01 como placeholder e salvamos o metadado no campo note.
                const [y, m, day] = datePart.split('-');
                const isSpecial = d.includes('_') || day === '99' || day === '00';

                if (isSpecial) {
                    // Placeholder válido para a coluna DATE
                    dbDate = `${y}-${m}-01`;
                    
                    // Encapsula o valor original e a nota em um JSON
                    dbNote = JSON.stringify({
                        key: d,        // O valor real que o frontend espera (ex: 2025-12-99_BLK)
                        note: userNote // A nota do usuário (se houver)
                    });
                }

                return {
                    member_id: userId,
                    date: dbDate, // Sempre uma data válida YYYY-MM-DD
                    note: dbNote
                };
            });
            
            const { error: insertError } = await supabase.from('availability').insert(rows);
            
            if (insertError) {
                console.error("Erro fatal ao inserir disponibilidade:", insertError);
                throw new Error(`Erro ao salvar novos dados: ${insertError.message}`);
            }
        }
    } catch (e: any) {
        console.error("Exceção em saveMemberAvailability:", e.message || e);
        throw e;
    }
};

// ... (rest of the file)
export const fetchRepertoire = async (ministryId: string): Promise<RepertoireItem[]> => {
    // ... (keep existing implementation)
    if (isPreviewMode) return [
        { id: '1', title: 'Música Exemplo 1', link: 'https://youtube.com', date: new Date().toISOString().split('T')[0], addedBy: 'Demo', createdAt: '' }
    ];
    if (!supabase) return [];
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    
    try {
        const { data } = await supabase
            .from('repertoire')
            .select('*')
            .or(`ministry_id.eq.${cleanMid},ministry_id.eq.shared`)
            .order('event_date', { ascending: false });

        return (data || []).map((row: any) => ({
            id: row.id,
            title: row.title,
            link: row.link || '',
            date: row.event_date,
            addedBy: row.added_by,
            createdAt: row.created_at
        }));
    } catch (e) {
        return [];
    }
};

export const addToRepertoire = async (ministryId: string, item: Omit<RepertoireItem, 'id' | 'createdAt'>): Promise<boolean> => {
    if (isPreviewMode) return true;
    try {
        const sb = safeDb();
        const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
        const { error } = await sb.from('repertoire').insert({
            ministry_id: cleanMid,
            title: item.title,
            link: item.link,
            event_date: item.date,
            added_by: item.addedBy
        });
        
        if (error) {
            console.error("Erro Supabase:", error);
            return false;
        }
        return true;
    } catch(e) { 
        console.error("Erro ao adicionar repertório:", e); 
        return false;
    }
};

export const deleteFromRepertoire = async (id: string) => {
    if (isPreviewMode) return;
    if (!supabase) return;
    await supabase.from('repertoire').delete().eq('id', id);
};

export const fetchSwapRequests = async (ministryId: string): Promise<SwapRequest[]> => {
    if (isPreviewMode) return [];
    if (!supabase || !ministryId) return [];
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    try {
        const { data } = await supabase
            .from('swap_requests')
            .select('*')
            .eq('ministry_id', cleanMid)
            .order('created_at', { ascending: false });

        return (data || []).map((row: any) => ({
            id: row.id,
            ministryId: row.ministry_id,
            requesterName: row.requester_name,
            requesterId: row.requester_id,
            role: row.role,
            eventIso: row.event_iso ? new Date(row.event_iso).toISOString().slice(0,16) : '',
            eventTitle: row.event_title,
            status: row.status,
            createdAt: row.created_at,
            takenByName: row.taken_by_name
        }));
    } catch (e) {
        return [];
    }
};

export const fetchMinistrySettings = async (ministryId: string): Promise<MinistrySettings> => {
    if (isPreviewMode) return { displayName: 'Ministério Demo', roles: DEFAULT_ROLES['midia'] || [] };
    if (!supabase || !ministryId) return { displayName: '', roles: [] };
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const { data } = await supabase
            .from('ministry_settings')
            .select('*')
            .eq('ministry_id', cleanMid)
            .single();

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
    } catch (e) {
        return { displayName: '', roles: DEFAULT_ROLES[cleanMid] || [] };
    }
};

export const saveMinistrySettings = async (
    ministryId: string, 
    displayName?: string, 
    roles?: string[], 
    availabilityStart?: string, 
    availabilityEnd?: string,
    spotifyClientId?: string,
    spotifyClientSecret?: string
) => {
    if (isPreviewMode) return;
    if (!supabase || !ministryId) return;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    const updates: any = { ministry_id: cleanMid };
    if (displayName !== undefined) updates.display_name = displayName;
    if (roles !== undefined) updates.roles = roles;
    if (availabilityStart !== undefined) updates.availability_start = availabilityStart;
    if (availabilityEnd !== undefined) updates.availability_end = availabilityEnd;
    
    if (spotifyClientId !== undefined) {
        updates.spotify_client_id = spotifyClientId;
        localStorage.setItem(`spotify_cid_${cleanMid}`, spotifyClientId);
    }
    if (spotifyClientSecret !== undefined) {
        updates.spotify_client_secret = spotifyClientSecret;
        localStorage.setItem(`spotify_sec_${cleanMid}`, spotifyClientSecret);
    }

    const { error } = await supabase.from('ministry_settings').upsert(updates, { onConflict: 'ministry_id' });
    if (error) {
        if (error.code === 'PGRST204' || error.message.includes('column')) {
             delete updates.spotify_client_id;
             delete updates.spotify_client_secret;
             await supabase.from('ministry_settings').upsert(updates, { onConflict: 'ministry_id' });
        }
    }
};

export const createSwapRequestSQL = async (ministryId: string, req: SwapRequest) => {
    if (isPreviewMode) return true;
    if (!supabase) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    
    const eventIsoString = req.eventIso.length === 16 ? req.eventIso + ":00" : req.eventIso;

    const { error } = await supabase.from('swap_requests').insert({
        ministry_id: cleanMid,
        requester_id: req.requesterId,
        requester_name: req.requesterName,
        role: req.role,
        event_iso: eventIsoString, 
        event_title: req.eventTitle,
        status: 'pending'
    });

    if (!error) {
        await sendNotificationSQL(cleanMid, {
            title: `Troca: ${req.role}`,
            message: `${req.requesterName} precisa de substituto para ${req.role} dia ${new Date(eventIsoString).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})}.`,
            type: "warning",
            actionLink: "swaps"
        });
    }

    return !error;
};

export const performSwapSQL = async (ministryId: string, requestId: string, takerName: string, takerId: string) => {
    if (isPreviewMode) return { success: true, message: "Troca simulada (Demo)" };
    if (!supabase) return { success: false, message: "Erro de conexão" };
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    
    try {
        const { data: req, error: reqError } = await supabase
            .from('swap_requests')
            .select('*')
            .eq('id', requestId)
            .single();

        if (reqError || !req) return { success: false, message: "Solicitação não encontrada." };
        if (req.status !== 'pending') return { success: false, message: "Esta troca já foi realizada ou cancelada." };

        const searchIso = req.event_iso.slice(0, 16); 

        const { data: events } = await supabase
            .from('events')
            .select('id, title')
            .eq('ministry_id', cleanMid)
            .ilike('date_time', `${searchIso}%`)
            .limit(1);

        const event = events && events.length > 0 ? events[0] : null;

        if (!event) {
            return { success: false, message: "Erro: Evento não encontrado no calendário." };
        }

        const { error: deleteError } = await supabase
            .from('schedule_assignments')
            .delete()
            .eq('event_id', event.id)
            .eq('member_id', req.requester_id);

        const { error: insertError } = await supabase
            .from('schedule_assignments')
            .insert({
                event_id: event.id,
                role: req.role,
                member_id: takerId,
                confirmed: true
            });

        if (insertError) return { success: false, message: "Erro ao atualizar a escala." };

        await supabase.from('swap_requests').update({
            status: 'completed',
            taken_by_id: takerId,
            taken_by_name: takerName
        }).eq('id', requestId);

        await sendNotificationSQL(cleanMid, {
            type: 'success',
            title: 'Troca Realizada',
            message: `${takerName} assumiu a escala de ${req.requester_name} em ${event.title}.`,
            actionLink: "calendar"
        });

        return { success: true, message: "Troca realizada com sucesso!" };

    } catch (e: any) {
        return { success: false, message: "Erro interno ao processar troca." };
    }
};

export const fetchNotificationsSQL = async (ministryId: string, userId: string): Promise<AppNotification[]> => {
    if (isPreviewMode) return [{ id: '1', type: 'info', title: 'Bem-vindo', message: 'Modo demonstração.', timestamp: new Date().toISOString(), read: false }];
    if (!supabase) return [];
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    try {
        const { data } = await supabase
            .from('notifications')
            .select('*')
            .eq('ministry_id', cleanMid)
            .order('created_at', { ascending: false })
            .limit(50);

        return (data || []).map((row: any) => ({
            id: row.id,
            type: row.type as any,
            title: row.title,
            message: row.message,
            timestamp: row.created_at,
            read: (row.read_by || []).includes(userId),
            actionLink: row.action_link
        }));
    } catch (e) {
        return [];
    }
};

export const sendNotificationSQL = async (ministryId: string, payload: { title: string; message: string; type?: string; actionLink?: string }) => {
    if (isPreviewMode) return;
    if (!supabase) return;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    
    // Insere no banco
    await supabase.from('notifications').insert({
        ministry_id: cleanMid,
        title: payload.title,
        message: payload.message,
        type: payload.type || 'info',
        action_link: payload.actionLink
    });

    // Dispara Edge Function para Push (fire and forget)
    try {
        supabase.functions.invoke('push-notification', {
            body: { ministryId: cleanMid, ...payload }
        }).then(() => {}); // No await needed
    } catch (e) { /* ignore */ }
};

export const markNotificationsReadSQL = async (ids: string[], userId: string) => {
    if (isPreviewMode) return;
    if (!supabase) return;
    
    for (const id of ids) {
        const { data } = await supabase.from('notifications').select('read_by').eq('id', id).single();
        const currentRead = data?.read_by || [];
        if (!currentRead.includes(userId)) {
            await supabase.from('notifications').update({
                read_by: [...currentRead, userId]
            }).eq('id', id);
        }
    }
};

export const clearAllNotificationsSQL = async (ministryId: string) => {
    if (isPreviewMode) return;
    if (!supabase || !ministryId) return;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    await supabase.from('notifications').delete().eq('ministry_id', cleanMid);
};

export const fetchAnnouncementsSQL = async (ministryId: string): Promise<Announcement[]> => {
    if (isPreviewMode) return [];
    if (!supabase) return [];
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    try {
        const { data } = await supabase
            .from('announcements')
            .select(`
                *,
                announcement_interactions (
                    user_id, user_name, interaction_type, created_at
                )
            `)
            .eq('ministry_id', cleanMid)
            .order('created_at', { ascending: false });

        return (data || []).map((row: any) => {
            const interactions = row.announcement_interactions || [];
            return {
                id: row.id,
                title: row.title,
                message: row.message,
                type: row.type as any,
                timestamp: row.created_at,
                expirationDate: row.expiration_date,
                author: row.author_name || 'Admin',
                readBy: interactions.filter((i: any) => i.interaction_type === 'read').map((i: any) => ({ userId: i.user_id, name: i.user_name, timestamp: i.created_at })),
                likedBy: interactions.filter((i: any) => i.interaction_type === 'like').map((i: any) => ({ userId: i.user_id, name: i.user_name, timestamp: i.created_at })),
            };
        });
    } catch (e) {
        return [];
    }
};

export const createAnnouncementSQL = async (ministryId: string, data: any, authorName: string) => {
    if (isPreviewMode) return true;
    if (!supabase) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const { error } = await supabase.from('announcements').insert({
        ministry_id: cleanMid,
        title: data.title,
        message: data.message,
        type: data.type,
        expiration_date: data.expirationDate,
        author_name: authorName
    });
    return !error;
};

export const interactAnnouncementSQL = async (announcementId: string, userId: string, userName: string, type: 'read' | 'like') => {
    if (isPreviewMode) return;
    if (!supabase) return;
    
    if (type === 'read') {
        await supabase.from('announcement_interactions').upsert({
            announcement_id: announcementId,
            user_id: userId,
            user_name: userName,
            interaction_type: 'read'
        }, { onConflict: 'announcement_id,user_id,interaction_type' });
    } else {
        const { data } = await supabase.from('announcement_interactions')
            .select('id')
            .eq('announcement_id', announcementId)
            .eq('user_id', userId)
            .eq('interaction_type', 'like')
            .single();
            
        if (data) {
            await supabase.from('announcement_interactions').delete().eq('id', data.id);
        } else {
            await supabase.from('announcement_interactions').insert({
                announcement_id: announcementId,
                user_id: userId,
                user_name: userName,
                interaction_type: 'like'
            });
        }
    }
};

export const toggleAdminSQL = async (email: string, setAdmin: boolean) => {
    if (isPreviewMode) return;
    if (!supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: requesterProfile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

    if (!requesterProfile?.is_admin) return;

    await supabase.from('profiles').update({ is_admin: setAdmin }).eq('email', email);
};

export const fetchAdminsSQL = async (ministryId: string): Promise<string[]> => {
    if (isPreviewMode) return [];
    if (!supabase) return [];
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const { data } = await supabase
        .from('profiles')
        .select('email')
        .eq('is_admin', true)
        .or(`ministry_id.eq.${cleanMid},allowed_ministries.cs.{${cleanMid}}`);
    
    return (data || []).map((p: any) => p.email).filter((e: any) => !!e);
};

export const saveSubscriptionSQL = async (ministryId: string, sub: PushSubscription) => {
    if (isPreviewMode) return;
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if(!user) return;

    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
        try {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                deviceId = crypto.randomUUID();
            } else {
                throw new Error("crypto.randomUUID not available");
            }
        } catch (e) {
            deviceId = 'dev-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
        }
        localStorage.setItem('device_id', deviceId);
    }

    const subJSON = sub.toJSON();
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    
    const { error } = await supabase.from('push_subscriptions').upsert({
        endpoint: sub.endpoint,
        user_id: user.id,
        ministry_id: cleanMid,
        p256dh: subJSON.keys?.p256dh || '',
        auth: subJSON.keys?.auth || '',
        device_id: deviceId,
        updated_at: new Date().toISOString()
    }, { onConflict: 'endpoint' });

    if (error) console.error("Erro ao salvar push:", error);
};

export const createMinistryEvent = async (ministryId: string, event: { title: string, date: string, time: string }): Promise<boolean> => {
    if (isPreviewMode) return true;
    if (!supabase || !ministryId) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const dateTime = `${event.date}T${event.time}:00`;

    try {
        const { error } = await supabase.from('events').insert({
            ministry_id: cleanMid,
            title: event.title,
            date_time: dateTime
        });

        if (!error) {
            const formatedDate = event.date.split('-').reverse().join('/');
            await sendNotificationSQL(cleanMid, {
                title: "Novo Evento",
                message: `Novo evento adicionado: ${event.title} dia ${formatedDate} às ${event.time}`,
                type: 'info',
                actionLink: 'calendar'
            });
        }

        return !error;
    } catch (e) {
        return false;
    }
};

export const fetchMinistryMembers = async (ministryId: string): Promise<{
    memberMap: MemberMap,
    publicList: TeamMemberProfile[]
}> => {
    if (isPreviewMode) {
        const demoMembers = [
            { id: '1', name: 'Usuário Demo', roles: ['Projeção', 'Membro'], avatar_url: '', isAdmin: true },
            { id: '2', name: 'Membro Teste', roles: ['Vocal', 'Membro'], avatar_url: '', isAdmin: false },
        ];
        const mmap: MemberMap = { 'Projeção': ['Usuário Demo'], 'Vocal': ['Membro Teste'], 'Membro': ['Usuário Demo', 'Membro Teste'] };
        return { memberMap: mmap, publicList: demoMembers };
    }

    if (!supabase || !ministryId) return { memberMap: {}, publicList: [] };
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const settings = await fetchMinistrySettings(cleanMid);
        const validRoles = settings.roles || [];

        const { data: ministryProfiles, error } = await supabase
            .from('profiles')
            .select('*')
            .or(`ministry_id.eq.${cleanMid},allowed_ministries.cs.{${cleanMid}}`);

        if (error) throw error;

        const publicList: TeamMemberProfile[] = (ministryProfiles || []).map((p: any) => {
            const userRoles = (p.functions || []).filter((r: string) => validRoles.includes(r));
            return {
                id: p.id,
                name: p.name || 'Membro sem nome', 
                email: p.email || undefined,
                whatsapp: p.whatsapp,
                avatar_url: p.avatar_url,
                birthDate: p.birth_date,
                roles: userRoles,
                createdAt: p.created_at,
                isAdmin: p.is_admin
            };
        }).sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));

        const memberMap: MemberMap = {};
        ministryProfiles?.forEach((p: any) => {
            const funcs = p.functions || [];
            const name = p.name || 'Membro sem nome';
            funcs.forEach((role: string) => {
                if (validRoles.includes(role)) { 
                    if (!memberMap[role]) memberMap[role] = [];
                    if (!memberMap[role].includes(name)) {
                        memberMap[role].push(name);
                    }
                }
            });
        });

        return { memberMap, publicList };

    } catch (e) {
        return { memberMap: {}, publicList: [] };
    }
};

export const fetchMinistrySchedule = async (ministryId: string, monthIso: string): Promise<{ schedule: ScheduleMap, events: any[], attendance: AttendanceMap }> => {
    if (isPreviewMode) {
        const [y, m] = monthIso.split('-').map(Number);
        const demoEvents = [
            { id: '1', title: 'Culto Demo 1', date_time: `${monthIso}-05T19:30:00` },
            { id: '2', title: 'Culto Demo 2', date_time: `${monthIso}-12T09:00:00` },
        ];
        const uiEvents = demoEvents.map(e => {
            const [date, timeFull] = e.date_time.split('T');
            const [yyyy, mm, dd] = date.split('-');
            return { id: e.id, title: e.title, date: date, time: timeFull.slice(0, 5), iso: e.date_time.slice(0, 16), dateDisplay: `${dd}/${mm}` };
        });
        return { schedule: { [`${monthIso}-05T19:30_Projeção`]: 'Usuário Demo' }, events: uiEvents, attendance: {} };
    }

    if (!supabase || !ministryId) return { schedule: {}, events: [], attendance: {} };
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const startOfMonth = `${monthIso}-01T00:00:00`;
        const [y, m] = monthIso.split('-').map(Number);
        const nextMonthDate = new Date(y, m, 1);
        const nextMonth = nextMonthDate.toISOString().split('T')[0];

        let { data: events, error: eventError } = await supabase
            .from('events')
            .select('id, title, date_time')
            .eq('ministry_id', cleanMid)
            .gte('date_time', startOfMonth)
            .lt('date_time', `${nextMonth}T00:00:00`)
            .order('date_time', { ascending: true });

        if (eventError) throw eventError;

        if (!events || events.length === 0) {
            const daysInMonth = new Date(y, m, 0).getDate();
            const eventsToCreate = [];

            for (let d = 1; d <= daysInMonth; d++) {
                const date = new Date(y, m - 1, d);
                const dayOfWeek = date.getDay(); // 0 = Sun, 3 = Wed
                const dateStr = date.toISOString().split('T')[0];

                if (dayOfWeek === 3) {
                    eventsToCreate.push({ ministry_id: cleanMid, title: "Culto (Quarta)", date_time: `${dateStr}T19:30:00` });
                } else if (dayOfWeek === 0) {
                    eventsToCreate.push({ ministry_id: cleanMid, title: "Culto (Domingo - Manhã)", date_time: `${dateStr}T09:00:00` });
                    eventsToCreate.push({ ministry_id: cleanMid, title: "Culto (Domingo - Noite)", date_time: `${dateStr}T18:00:00` });
                }
            }

            if (eventsToCreate.length > 0) {
                const { data: newEvents, error: createError } = await supabase
                    .from('events')
                    .insert(eventsToCreate)
                    .select('id, title, date_time')
                    .order('date_time', { ascending: true });
                if (!createError && newEvents) {
                    events = newEvents;
                }
            }
        }

        if (!events || events.length === 0) return { schedule: {}, events: [], attendance: {} };

        const eventIds = events.map(e => e.id);

        const { data: assignments, error: assignError } = await supabase
            .from('schedule_assignments')
            .select(`event_id, role, confirmed, profiles ( name )`)
            .in('event_id', eventIds);

        if (assignError) throw assignError;

        const schedule: ScheduleMap = {};
        const attendance: AttendanceMap = {};
        
        assignments?.forEach((assign: any) => {
            const event = events.find(e => e.id === assign.event_id);
            if (event && assign.profiles) {
                const isoKey = event.date_time.slice(0, 16); 
                const scheduleKey = `${isoKey}_${assign.role}`;
                schedule[scheduleKey] = assign.profiles.name;
                if (assign.confirmed) {
                    attendance[scheduleKey] = true;
                }
            }
        });

        const uiEvents = events.map(e => {
            const [date, timeFull] = e.date_time.split('T');
            const [yyyy, mm, dd] = date.split('-');
            return {
                id: e.id, title: e.title, date: date, time: timeFull.slice(0, 5), iso: e.date_time.slice(0, 16), dateDisplay: `${dd}/${mm}`
            };
        });

        return { schedule, events: uiEvents, attendance };

    } catch (e) {
        return { schedule: {}, events: [], attendance: {} };
    }
};

export const clearScheduleForMonth = async (ministryId: string, monthIso: string): Promise<boolean> => {
    if (isPreviewMode) return true;
    if (!supabase || !ministryId) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    try {
        const start = `${monthIso}-01T00:00:00`;
        const [y, m] = monthIso.split('-').map(Number);
        const nextMonth = new Date(y, m, 1).toISOString().split('T')[0] + 'T00:00:00';

        const { data: events } = await supabase.from('events').select('id').eq('ministry_id', cleanMid).gte('date_time', start).lt('date_time', nextMonth);
        if (!events || events.length === 0) return true;
        const ids = events.map(e => e.id);
        const { error } = await supabase.from('schedule_assignments').delete().in('event_id', ids);
        return !error;
    } catch (e) { return false; }
};

export const resetToDefaultEvents = async (ministryId: string, monthIso: string): Promise<boolean> => {
    if (isPreviewMode) return true;
    if (!supabase || !ministryId) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    try {
        const [y, m] = monthIso.split('-').map(Number);
        const startDate = `${monthIso}-01T00:00:00`;
        const nextMonthDate = new Date(y, m, 1);
        const nextMonth = nextMonthDate.toISOString().split('T')[0] + 'T00:00:00';

        const { data: eventsToDelete } = await supabase.from('events').select('id').eq('ministry_id', cleanMid).gte('date_time', startDate).lt('date_time', nextMonth);
        if (eventsToDelete && eventsToDelete.length > 0) {
            const ids = eventsToDelete.map(e => e.id);
            await supabase.from('schedule_assignments').delete().in('event_id', ids);
            await supabase.from('events').delete().in('id', ids);
        }
        
        const daysInMonth = new Date(y, m, 0).getDate();
        const eventsToCreate = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(y, m - 1, d);
            const dayOfWeek = date.getDay(); 
            const dateStr = date.toISOString().split('T')[0];
            if (dayOfWeek === 3) eventsToCreate.push({ ministry_id: cleanMid, title: "Culto (Quarta)", date_time: `${dateStr}T19:30:00` });
            else if (dayOfWeek === 0) {
                eventsToCreate.push({ ministry_id: cleanMid, title: "Culto (Domingo - Manhã)", date_time: `${dateStr}T09:00:00` });
                eventsToCreate.push({ ministry_id: cleanMid, title: "Culto (Domingo - Noite)", date_time: `${dateStr}T18:00:00` });
            }
        }
        if (eventsToCreate.length > 0) await supabase.from('events').insert(eventsToCreate);
        return true;
    } catch (e) { return false; }
};

export const updateMinistryEvent = async (ministryId: string, oldIso: string, newTitle: string, newIso: string, applyToAll: boolean = false): Promise<boolean> => {
    if (isPreviewMode) return true;
    if (!supabase || !ministryId) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const formatTimestamp = (iso: string) => `${iso}:00`; 

    try {
        const targetIso = formatTimestamp(oldIso);
        const { data: originalEvents } = await supabase.from('events').select('id, title, date_time').eq('ministry_id', cleanMid).eq('date_time', targetIso).limit(1);

        if (!originalEvents || originalEvents.length === 0) {
            if (!applyToAll) {
                const { error } = await supabase.from('events').insert({ ministry_id: cleanMid, title: newTitle, date_time: formatTimestamp(newIso) });
                return !error;
            }
            return false;
        }

        const originalEvent = originalEvents[0];

        if (applyToAll) {
            const dateObj = new Date(originalEvent.date_time);
            const year = dateObj.getFullYear();
            const month = dateObj.getMonth();
            const startOfMonth = new Date(year, month, 1).toISOString();
            const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

            const { data: similarEvents } = await supabase.from('events').select('id, date_time').eq('ministry_id', cleanMid).eq('title', originalEvent.title).gte('date_time', startOfMonth).lte('date_time', endOfMonth);
            if (!similarEvents || similarEvents.length === 0) return true;

            const newTimePart = newIso.split('T')[1];
            const updatePromises = similarEvents.map(evt => {
                const originalDatePart = evt.date_time.split('T')[0];
                const newDateTime = `${originalDatePart}T${newTimePart}:00`;
                return supabase.from('events').update({ title: newTitle, date_time: newDateTime }).eq('id', evt.id);
            });
            await Promise.all(updatePromises);
            
            // NOTIFY: Bulk Update
            await sendNotificationSQL(cleanMid, {
                title: "Alteração de Horários",
                message: `Os horários dos eventos "${originalEvent.title}" foram atualizados.`,
                type: 'warning',
                actionLink: 'calendar'
            });

            return true;
        } else {
            const { error } = await supabase.from('events').update({ title: newTitle, date_time: formatTimestamp(newIso) }).eq('id', originalEvent.id);
            
            if (!error) {
                // NOTIFY: Single Update
                const dateDisplay = newIso.split('T')[0].split('-').reverse().join('/');
                await sendNotificationSQL(cleanMid, {
                    title: "Evento Atualizado",
                    message: `O evento do dia ${dateDisplay} foi alterado para ${newTitle} às ${newIso.split('T')[1]}.`,
                    type: 'info',
                    actionLink: 'calendar'
                });
            }

            return !error;
        }
    } catch (e) { return false; }
};

export const deleteMinistryEvent = async (ministryId: string, iso: string): Promise<boolean> => {
    if (isPreviewMode) return true;
    if (!supabase || !ministryId) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const dateTime = `${iso}:00`; 
    try {
        const { data: events } = await supabase.from('events').select('id, title').eq('ministry_id', cleanMid).eq('date_time', dateTime);
        if (!events || events.length === 0) return true; 
        const ids = events.map(e => e.id);
        const title = events[0].title;

        await supabase.from('schedule_assignments').delete().in('event_id', ids);
        const { error } = await supabase.from('events').delete().in('id', ids);

        if (!error) {
            // NOTIFY: Delete
            const dateDisplay = iso.split('T')[0].split('-').reverse().join('/');
            await sendNotificationSQL(cleanMid, {
                title: "Evento Cancelado",
                message: `O evento ${title} do dia ${dateDisplay} foi removido da agenda.`,
                type: 'alert',
                actionLink: 'calendar'
            });
        }

        return !error;
    } catch (e) { return false; }
};

export const saveScheduleAssignment = async (ministryId: string, key: string, memberName: string): Promise<boolean> => {
    if (isPreviewMode) return true;
    if (!supabase || !ministryId) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const lastUnderscore = key.lastIndexOf('_');
        const isoDate = key.substring(0, lastUnderscore); 
        const role = key.substring(lastUnderscore + 1);
        const dateTime = `${isoDate}:00`; 

        let eventId = null;
        // First try finding the event
        const { data: eventData } = await supabase.from('events').select('id').eq('ministry_id', cleanMid).eq('date_time', dateTime).limit(1); 

        if (eventData && eventData.length > 0) {
            eventId = eventData[0].id;
        } else {
            // Auto-create event if it doesn't exist (Professional UX: don't fail silently)
            if (!memberName) return true;
            const dateObj = new Date(isoDate);
            const dayOfWeek = dateObj.getDay(); 
            const hour = dateObj.getHours();
            let title = "Evento Extra";
            if (dayOfWeek === 3) title = "Culto (Quarta)";
            else if (dayOfWeek === 0) {
                if (hour < 13) title = "Culto (Domingo - Manhã)";
                else title = "Culto (Domingo - Noite)";
            }
            const { data: newEvent, error: createError } = await supabase.from('events').insert({ ministry_id: cleanMid, title: title, date_time: dateTime }).select().single();
            if (createError) throw createError;
            eventId = newEvent.id;
        }

        // If clearing
        if (!memberName) {
            if (eventId) await supabase.from('schedule_assignments').delete().eq('event_id', eventId).eq('role', role);
            return true;
        }

        // Find member by Exact Name first, fallback to ILIKE if needed but exact is safer
        // Professional Update: Try to find by Exact Name to avoid "Ana" matching "Ana Clara"
        const { data: memberData } = await supabase.from('profiles').select('id')
            .or(`ministry_id.eq.${cleanMid},allowed_ministries.cs.{${cleanMid}}`)
            .eq('name', memberName.trim()) // Exact match preferred
            .limit(1)
            .single();
        
        let targetMemberId = memberData?.id;

        if (!targetMemberId) {
             // Fallback for older data or fuzzy matches (Riskier but keeps compatibility)
             const { data: fuzzyMember } = await supabase.from('profiles').select('id')
                .or(`ministry_id.eq.${cleanMid},allowed_ministries.cs.{${cleanMid}}`)
                .ilike('name', memberName.trim())
                .limit(1)
                .single();
             targetMemberId = fuzzyMember?.id;
        }

        if (!targetMemberId) return false; 

        await supabase.from('schedule_assignments').delete().eq('event_id', eventId).eq('role', role);
        const { error: insertError } = await supabase.from('schedule_assignments').insert({ event_id: eventId, role: role, member_id: targetMemberId });
        return !insertError;
    } catch (e) { return false; }
};

export const saveScheduleBulk = async (ministryId: string, schedule: ScheduleMap, strictMode: boolean = false): Promise<boolean> => {
    if (isPreviewMode) return true;
    if (!supabase || !ministryId) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    if (Object.keys(schedule).length === 0) return true;

    try {
        const { data: allMembers } = await supabase.from('profiles').select('id, name').or(`ministry_id.eq.${cleanMid},allowed_ministries.cs.{${cleanMid}}`);
        const memberMap = new Map<string, string>(); 
        if (allMembers) allMembers.forEach(m => { if (m.name) memberMap.set(m.name.toLowerCase().trim(), m.id); });

        const neededTimestamps = new Set<string>();
        Object.keys(schedule).forEach(key => {
            const lastUnderscore = key.lastIndexOf('_');
            const isoDate = key.substring(0, lastUnderscore); 
            neededTimestamps.add(`${isoDate}:00`); 
        });

        const { data: existingEvents } = await supabase.from('events').select('id, date_time').eq('ministry_id', cleanMid).in('date_time', Array.from(neededTimestamps));
        const eventIdMap = new Map<string, string>();
        if (existingEvents) existingEvents.forEach(e => eventIdMap.set(e.date_time, e.id));

        const eventsToCreate = [];
        
        // Even in strict mode (AI generation), if the AI suggests a valid date that isn't in DB yet, create it.
        // NOTE: Strict mode usually meant "don't create duplicates", but we check eventIdMap.
        for (const ts of neededTimestamps) {
            if (!eventIdMap.has(ts)) {
                const dateObj = new Date(ts);
                const dayOfWeek = dateObj.getDay();
                const hour = dateObj.getHours();
                let title = "Evento Extra";
                if (dayOfWeek === 3) title = "Culto (Quarta)";
                else if (dayOfWeek === 0) {
                    if (hour < 13) title = "Culto (Domingo - Manhã)";
                    else title = "Culto (Domingo - Noite)";
                }
                eventsToCreate.push({ ministry_id: cleanMid, title: title, date_time: ts });
            }
        }

        if (eventsToCreate.length > 0) {
            const { data: newEvents, error: createError } = await supabase.from('events').insert(eventsToCreate).select('id, date_time');
            if (createError) throw createError;
            newEvents?.forEach(e => eventIdMap.set(e.date_time, e.id));
        }

        const assignmentsToUpsert = [];
        for (const [key, memberName] of Object.entries(schedule)) {
            if (!memberName) continue;
            const lastUnderscore = key.lastIndexOf('_');
            const isoDate = key.substring(0, lastUnderscore);
            const role = key.substring(lastUnderscore + 1);
            const ts = `${isoDate}:00`;
            const eventId = eventIdMap.get(ts);
            
            if (!eventId) continue;

            const memberId = memberMap.get(memberName.toLowerCase().trim());
            if (eventId && memberId) assignmentsToUpsert.push({ event_id: eventId, role: role, member_id: memberId });
        }

        if (assignmentsToUpsert.length > 0) {
            const { error: upsertError } = await supabase.from('schedule_assignments').upsert(assignmentsToUpsert, { onConflict: 'event_id,role' }); 
            if (upsertError) {
                // Fallback for older Postgrest versions
                for (const item of assignmentsToUpsert) { await supabase.from('schedule_assignments').delete().match({ event_id: item.event_id, role: item.role }); }
                await supabase.from('schedule_assignments').insert(assignmentsToUpsert);
            }
        }
        return true;
    } catch (e) { return false; }
}

export const toggleAssignmentConfirmation = async (ministryId: string, key: string): Promise<boolean> => {
    if (isPreviewMode) return true;
    if (!supabase || !ministryId) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    try {
        const lastUnderscore = key.lastIndexOf('_');
        const isoDate = key.substring(0, lastUnderscore); 
        const role = key.substring(lastUnderscore + 1);
        const dateTime = `${isoDate}:00`;
        const { data: eventData } = await supabase.from('events').select('id').eq('ministry_id', cleanMid).eq('date_time', dateTime).limit(1);
        if (!eventData || eventData.length === 0) return false;
        const eventId = eventData[0].id;
        const { data: assignment } = await supabase.from('schedule_assignments').select('id, confirmed').eq('event_id', eventId).eq('role', role).single();
        if (!assignment) return false;
        const { error } = await supabase.from('schedule_assignments').update({ confirmed: !assignment.confirmed }).eq('id', assignment.id);
        return !error;
    } catch (e) { return false; }
};

// ... (rest of the file)
