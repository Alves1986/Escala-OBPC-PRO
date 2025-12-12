import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
    SUPABASE_URL, SUPABASE_KEY, PushSubscriptionRecord, User, MemberMap, 
    AppNotification, TeamMemberProfile, AvailabilityMap, SwapRequest, 
    ScheduleMap, RepertoireItem, Announcement, GlobalConflictMap, 
    GlobalConflict, DEFAULT_ROLES, AttendanceMap, AuditLogEntry, MinistrySettings,
    RankingEntry, AvailabilityNotesMap, CustomEvent
} from '../types';

// Detecta modo de preview
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

// --- AUTH ---

export const loginWithEmail = async (email: string, password: string) => {
    if (isPreviewMode) return { success: true };
    try {
        const { error } = await safeDb().auth.signInWithPassword({ email, password });
        if (error) return { success: false, message: error.message };
        return { success: true };
    } catch (e: any) { return { success: false, message: e.message }; }
};

export const loginWithGoogle = async () => {
    if (isPreviewMode) return { success: true };
    try {
        const { error } = await safeDb().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
        if (error) return { success: false, message: error.message };
        return { success: true };
    } catch (e: any) { return { success: false, message: e.message }; }
};

export const logout = async () => {
    if (isPreviewMode) return;
    await safeDb().auth.signOut();
};

export const registerWithEmail = async (email: string, password: string, name: string, ministryIds: string[], whatsApp?: string, roles?: string[]) => {
    if (isPreviewMode) return { success: true, message: "Registrado (Demo)" };
    try {
        const { data, error } = await safeDb().auth.signUp({ 
            email, 
            password,
            options: {
                data: {
                    full_name: name,
                    ministry_id: ministryIds[0] || 'midia',
                    allowed_ministries: ministryIds,
                    roles: roles || []
                }
            }
        });
        if (error) return { success: false, message: error.message };
        
        // Ensure profile is created if trigger fails (redundancy)
        if (data.user) {
             const { error: profileError } = await safeDb().from('profiles').insert({
                 id: data.user.id,
                 email: email,
                 name: name,
                 ministry_id: ministryIds[0],
                 allowed_ministries: ministryIds,
                 roles: roles || [],
                 whatsapp: whatsApp
             });
             if (profileError && !profileError.message.includes('duplicate')) console.error(profileError);
        }

        return { success: true, message: "Conta criada! Verifique seu e-mail." };
    } catch (e: any) { return { success: false, message: e.message }; }
};

export const sendPasswordResetEmail = async (email: string) => {
    if (isPreviewMode) return { success: true, message: "Email enviado (Demo)" };
    try {
        const { error } = await safeDb().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/update-password` });
        if (error) return { success: false, message: error.message };
        return { success: true, message: "Link de redefinição enviado para o e-mail." };
    } catch (e: any) { return { success: false, message: e.message }; }
};

export const updateUserProfile = async (name: string, whatsapp: string, avatar_url?: string, functions?: string[], birthDate?: string, ministryId?: string) => {
    if (isPreviewMode) return { success: true, message: "Perfil atualizado (Demo)" };
    try {
        const { data: { user } } = await safeDb().auth.getUser();
        if (!user) throw new Error("Usuário não logado");

        const updates: any = { name, whatsapp, functions, birth_date: birthDate, updated_at: new Date().toISOString() };
        if (avatar_url) updates.avatar_url = avatar_url;
        if (ministryId) updates.ministry_id = ministryId;

        const { error } = await safeDb().from('profiles').update(updates).eq('id', user.id);
        if (error) throw error;
        return { success: true, message: "Perfil atualizado!" };
    } catch (e: any) { return { success: false, message: e.message }; }
};

export const updateProfileMinistry = async (userId: string, ministryId: string) => {
    if (isPreviewMode) return true;
    try {
        const { error } = await safeDb().from('profiles').update({ ministry_id: ministryId }).eq('id', userId);
        return !error;
    } catch (e) { return false; }
};

export const joinMinistry = async (ministryId: string, roles: string[]) => {
    if (isPreviewMode) return { success: true, message: "Entrou no ministério (Demo)" };
    try {
        const { data: { user } } = await safeDb().auth.getUser();
        if (!user) throw new Error("Usuário não logado");

        const { data: profile } = await safeDb().from('profiles').select('allowed_ministries, roles').eq('id', user.id).single();
        if (!profile) throw new Error("Perfil não encontrado");

        const currentMinistries = profile.allowed_ministries || [];
        const currentRoles = profile.roles || [];

        if (!currentMinistries.includes(ministryId)) {
            const newMinistries = [...currentMinistries, ministryId];
            const newRoles = [...new Set([...currentRoles, ...roles])]; // Merge roles uniquely

            const { error } = await safeDb().from('profiles').update({
                allowed_ministries: newMinistries,
                roles: newRoles,
                ministry_id: ministryId // Switch to new ministry immediately
            }).eq('id', user.id);

            if (error) throw error;
            return { success: true, message: `Bem-vindo ao ministério ${ministryId}!` };
        }
        return { success: false, message: "Você já participa deste ministério." };
    } catch (e: any) { return { success: false, message: e.message }; }
};

export const toggleAdminSQL = async (email: string, isAdmin: boolean) => {
    if (isPreviewMode) return true;
    try {
        const { error } = await safeDb().from('profiles').update({ is_admin: isAdmin }).eq('email', email);
        return !error;
    } catch(e) { return false; }
};

export const deleteMember = async (ministryId: string, memberId: string, memberName: string) => {
    // In Supabase we probably just remove access or delete profile depending on logic.
    // For now let's assume removing from 'profiles' or just allowed_ministries if complex.
    // Simple implementation: Delete profile (Auth user remains but profile gone)
    if (isPreviewMode) return true;
    try {
        const { error } = await safeDb().from('profiles').delete().eq('id', memberId);
        return !error;
    } catch(e) { return false; }
};

// --- DATA FETCHING ---

export const fetchMinistrySettings = async (ministryId: string): Promise<MinistrySettings> => {
    if (isPreviewMode) return { displayName: 'Ministério Demo', roles: [] };
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    try {
        const { data } = await safeDb().from('ministry_settings').select('*').eq('ministry_id', cleanMid).single();
        if (data) {
            return {
                displayName: data.display_name,
                roles: data.roles || [],
                availabilityStart: data.availability_start,
                availabilityEnd: data.availability_end,
                spotifyClientId: data.spotify_client_id,
                spotifyClientSecret: data.spotify_client_secret
            };
        }
        // Return defaults if not found
        return { displayName: ministryId, roles: DEFAULT_ROLES[cleanMid] || DEFAULT_ROLES['default'] };
    } catch (e) {
        return { displayName: ministryId, roles: [] };
    }
};

export const saveMinistrySettings = async (ministryId: string, displayName?: string, roles?: string[], start?: string, end?: string) => {
    if (isPreviewMode) return true;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const updates: any = { ministry_id: cleanMid, updated_at: new Date().toISOString() };
    if (displayName) updates.display_name = displayName;
    if (roles) updates.roles = roles;
    if (start !== undefined) updates.availability_start = start;
    if (end !== undefined) updates.availability_end = end;

    try {
        const { error } = await safeDb().from('ministry_settings').upsert(updates, { onConflict: 'ministry_id' });
        return !error;
    } catch(e) { return false; }
};

export const fetchMinistrySchedule = async (ministryId: string, monthIso: string) => {
    if (isPreviewMode) return { events: [], schedule: {}, attendance: {} };
    const cleanMid = ministryId;
    try {
        // Fetch events for the month
        const { data: eventsData } = await safeDb().from('events').select('*')
            .eq('ministry_id', cleanMid)
            .ilike('date', `${monthIso}%`);
        
        const events = eventsData?.map((e: any) => ({
            id: e.id,
            title: e.title,
            date: e.date,
            time: e.time,
            iso: `${e.date}T${e.time}`,
            dateDisplay: e.date.split('-').reverse().join('/')
        })) || [];

        // Fetch assignments
        const { data: assignmentsData } = await safeDb().from('schedule_assignments').select('*')
            .eq('ministry_id', cleanMid)
            .ilike('event_iso', `${monthIso}%`);

        const schedule: ScheduleMap = {};
        const attendance: AttendanceMap = {};

        assignmentsData?.forEach((a: any) => {
            const key = `${a.event_iso}_${a.role}`;
            schedule[key] = a.member_name;
            if (a.confirmed) attendance[key] = true;
        });

        return { events, schedule, attendance };
    } catch(e) { return { events: [], schedule: {}, attendance: {} }; }
};

export const fetchMinistryMembers = async (ministryId: string) => {
    if (isPreviewMode) return { memberMap: {}, publicList: [] };
    const cleanMid = ministryId;
    try {
        // Profiles where ministry_id is current or allowed_ministries contains current
        const { data } = await safeDb().from('profiles').select('*')
            .or(`ministry_id.eq.${cleanMid},allowed_ministries.cs.{${cleanMid}}`);
        
        const publicList: TeamMemberProfile[] = data?.map((p: any) => ({
            id: p.id,
            name: p.name,
            avatar_url: p.avatar_url,
            roles: p.roles,
            isAdmin: p.is_admin,
            email: p.email,
            whatsapp: p.whatsapp,
            birthDate: p.birth_date
        })) || [];

        const memberMap: MemberMap = {};
        // Populate member map by roles
        publicList.forEach(m => {
            m.roles?.forEach(r => {
                if (!memberMap[r]) memberMap[r] = [];
                memberMap[r].push(m.name);
            });
        });

        return { memberMap, publicList };
    } catch(e) { return { memberMap: {}, publicList: [] }; }
};

export const fetchMinistryAvailability = async (ministryId: string): Promise<{ availability: AvailabilityMap, notes: AvailabilityNotesMap }> => {
    if (isPreviewMode) return { availability: {}, notes: {} };
    if (!supabase || !ministryId) return { availability: {}, notes: {} };
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const { data } = await supabase
            .from('availability')
            .select('*')
            .eq('ministry_id', cleanMid);

        const availability: AvailabilityMap = {};
        const notes: AvailabilityNotesMap = {};

        data?.forEach((row: any) => {
            if (!availability[row.member_name]) {
                availability[row.member_name] = [];
            }
            availability[row.member_name].push(row.date_iso);
            
            if (row.note) {
                const noteKey = `${row.member_name}_${row.date_iso.split('_')[0]}`; 
                notes[noteKey] = row.note;
            }
        });

        return { availability, notes };
    } catch (e) {
        return { availability: {}, notes: {} };
    }
};

export const saveMemberAvailability = async (userId: string, memberName: string, dates: string[], notes?: Record<string, string>): Promise<boolean> => {
    if (isPreviewMode) return true;
    if (!supabase) return false;
    
    try {
        const { data: profile } = await supabase.from('profiles').select('ministry_id').eq('id', userId).single();
        if (!profile) return false;
        const cleanMid = profile.ministry_id;

        // 1. Delete existing entries for this member/ministry
        const { error: deleteError } = await supabase.from('availability').delete().eq('ministry_id', cleanMid).eq('member_id', userId);
        if (deleteError) {
            console.error("Error clearing availability:", deleteError);
            return false;
        }

        // 2. Insert new entries
        if (dates.length > 0) {
            const rows = dates.map(d => {
                const datePart = d.split('_')[0];
                // Try exact match first, then date match
                const note = (notes && (notes[d] || notes[datePart])) ? (notes[d] || notes[datePart]) : null;

                return {
                    ministry_id: cleanMid,
                    member_id: userId,
                    member_name: memberName,
                    date_iso: d,
                    note: note
                };
            });
            
            const { error: insertError } = await supabase.from('availability').insert(rows);
            if (insertError) {
                console.error("Error inserting availability:", insertError);
                return false;
            }
        }
        return true;
    } catch (e) {
        console.error("Exception saving availability:", e);
        return false;
    }
};

// --- SCHEDULE MANAGEMENT ---

export const saveScheduleAssignment = async (ministryId: string, key: string, memberName: string) => {
    if (isPreviewMode) return true;
    // key format is ISO_Role (e.g. 2023-10-15T19:30_Guitarra)
    const iso = key.substring(0, 16);
    const r = key.substring(17);

    try {
        if (!memberName) {
            await safeDb().from('schedule_assignments').delete().eq('ministry_id', ministryId).eq('event_iso', iso).eq('role', r);
        } else {
            await safeDb().from('schedule_assignments').upsert({
                ministry_id: ministryId,
                event_iso: iso,
                role: r,
                member_name: memberName,
                updated_at: new Date().toISOString()
            }, { onConflict: 'ministry_id,event_iso,role' });
        }
        return true;
    } catch(e) { return false; }
};

export const saveScheduleBulk = async (ministryId: string, schedule: ScheduleMap, strictMode: boolean) => {
    if (isPreviewMode) return true;
    const rows = Object.entries(schedule).map(([key, memberName]) => {
        const iso = key.substring(0, 16);
        const role = key.substring(17);
        return {
            ministry_id: ministryId,
            event_iso: iso,
            role: role,
            member_name: memberName,
            updated_at: new Date().toISOString()
        };
    });

    try {
        if (strictMode) {
            // Logic for strict mode if needed, e.g. delete prior assignments
        }
        const { error } = await safeDb().from('schedule_assignments').upsert(rows, { onConflict: 'ministry_id,event_iso,role' });
        return !error;
    } catch(e) { return false; }
};

export const toggleAssignmentConfirmation = async (ministryId: string, key: string) => {
    if (isPreviewMode) return true;
    const iso = key.substring(0, 16);
    const role = key.substring(17);
    try {
        const { data } = await safeDb().from('schedule_assignments').select('confirmed').eq('ministry_id', ministryId).eq('event_iso', iso).eq('role', role).single();
        if (data) {
            await safeDb().from('schedule_assignments').update({ confirmed: !data.confirmed }).eq('ministry_id', ministryId).eq('event_iso', iso).eq('role', role);
            return true;
        }
        return false;
    } catch(e) { return false; }
};

export const clearScheduleForMonth = async (ministryId: string, monthIso: string) => {
    if (isPreviewMode) return true;
    try {
        await safeDb().from('schedule_assignments').delete().eq('ministry_id', ministryId).ilike('event_iso', `${monthIso}%`);
        return true;
    } catch(e) { return false; }
};

// --- EVENTS ---

export const createMinistryEvent = async (ministryId: string, event: any) => {
    if (isPreviewMode) return true;
    try {
        const { error } = await safeDb().from('events').insert({
            ministry_id: ministryId,
            title: event.title,
            date: event.date,
            time: event.time,
            created_at: new Date().toISOString()
        });
        return !error;
    } catch(e) { return false; }
};

export const deleteMinistryEvent = async (ministryId: string, iso: string) => {
    if (isPreviewMode) return true;
    const date = iso.split('T')[0];
    const time = iso.split('T')[1];
    try {
        await safeDb().from('events').delete().eq('ministry_id', ministryId).eq('date', date).eq('time', time);
        return true;
    } catch(e) { return false; }
};

export const updateMinistryEvent = async (ministryId: string, oldIso: string, newTitle: string, newIso: string, applyToAll: boolean) => {
    if (isPreviewMode) return true;
    const oldDate = oldIso.split('T')[0];
    const oldTime = oldIso.split('T')[1];
    const newDate = newIso.split('T')[0];
    const newTime = newIso.split('T')[1];

    try {
        if (applyToAll) {
             await safeDb().from('events').update({ title: newTitle, date: newDate, time: newTime })
                .eq('ministry_id', ministryId).eq('date', oldDate).eq('time', oldTime);
        } else {
            await safeDb().from('events').update({ title: newTitle, date: newDate, time: newTime })
                .eq('ministry_id', ministryId).eq('date', oldDate).eq('time', oldTime);
        }
        return true;
    } catch(e) { return false; }
};

export const resetToDefaultEvents = async (ministryId: string, monthIso: string) => {
    return clearScheduleForMonth(ministryId, monthIso);
};

// --- SWAPS ---

export const fetchSwapRequests = async (ministryId: string) => {
    if (isPreviewMode) return [];
    try {
        const { data } = await safeDb().from('swap_requests').select('*').eq('ministry_id', ministryId).order('created_at', { ascending: false });
        return data?.map((r: any) => ({
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
        })) || [];
    } catch(e) { return []; }
};

export const createSwapRequestSQL = async (ministryId: string, req: SwapRequest) => {
    if (isPreviewMode) return true;
    try {
        const { error } = await safeDb().from('swap_requests').insert({
            ministry_id: ministryId,
            requester_name: req.requesterName,
            requester_id: req.requesterId,
            role: req.role,
            event_iso: req.eventIso,
            event_title: req.eventTitle,
            status: 'pending'
        });
        return !error;
    } catch(e) { return false; }
};

export const performSwapSQL = async (ministryId: string, reqId: string, takerName: string, takerId: string) => {
    if (isPreviewMode) return { success: true, message: "Troca realizada" };
    try {
        const { data: req } = await safeDb().from('swap_requests').select('*').eq('id', reqId).single();
        if (!req) throw new Error("Solicitação não encontrada");

        await saveScheduleAssignment(ministryId, `${req.event_iso}_${req.role}`, takerName);

        await safeDb().from('swap_requests').update({ 
            status: 'completed', 
            taken_by_name: takerName,
            taken_by_id: takerId
        }).eq('id', reqId);

        return { success: true, message: "Troca realizada com sucesso!" };
    } catch(e: any) { return { success: false, message: e.message }; }
};

// --- REPERTOIRE ---

export const fetchRepertoire = async (ministryId: string) => {
    if (isPreviewMode) return [];
    try {
        const { data } = await safeDb().from('repertoire').select('*').eq('ministry_id', ministryId).order('date', { ascending: false });
        return data?.map((r: any) => ({
            id: r.id,
            title: r.title,
            link: r.link,
            date: r.date,
            addedBy: r.added_by,
            createdAt: r.created_at
        })) || [];
    } catch(e) { return []; }
};

export const addToRepertoire = async (ministryId: string, item: any) => {
    if (isPreviewMode) return true;
    try {
        const { error } = await safeDb().from('repertoire').insert({
            ministry_id: ministryId,
            title: item.title,
            link: item.link,
            date: item.date,
            added_by: item.addedBy
        });
        return !error;
    } catch(e) { return false; }
};

export const deleteFromRepertoire = async (id: string) => {
    if (isPreviewMode) return true;
    try {
        await safeDb().from('repertoire').delete().eq('id', id);
        return true;
    } catch(e) { return false; }
};

// --- NOTIFICATIONS & ANNOUNCEMENTS ---

export const fetchNotificationsSQL = async (ministryId: string, userId: string) => {
    if (isPreviewMode) return [];
    try {
        const { data } = await safeDb().from('notifications').select('*')
            .eq('ministry_id', ministryId)
            .or(`user_id.eq.${userId},user_id.is.null`)
            .order('timestamp', { ascending: false });
        
        return data?.map((n: any) => ({
            id: n.id,
            type: n.type,
            title: n.title,
            message: n.message,
            timestamp: n.timestamp,
            read: n.read_by?.includes(userId) || false,
            actionLink: n.action_link
        })) || [];
    } catch(e) { return []; }
};

export const markNotificationsReadSQL = async (ids: string[], userId: string) => {
    if (isPreviewMode) return;
    try {
        // Simplification for updating read status
    } catch(e) {}
};

export const clearAllNotificationsSQL = async (ministryId: string) => {
    // Delete logic
};

export const fetchAnnouncementsSQL = async (ministryId: string) => {
    if (isPreviewMode) return [];
    try {
        const { data } = await safeDb().from('announcements').select('*')
            .eq('ministry_id', ministryId)
            .gt('expiration_date', new Date().toISOString())
            .order('timestamp', { ascending: false });
        
        return data?.map((a: any) => ({
            id: a.id,
            title: a.title,
            message: a.message,
            type: a.type,
            timestamp: a.timestamp,
            expirationDate: a.expiration_date,
            author: a.author,
            readBy: a.read_by || [],
            likedBy: a.liked_by || []
        })) || [];
    } catch(e) { return []; }
};

export const createAnnouncementSQL = async (ministryId: string, ann: any, author: string) => {
    if (isPreviewMode) return true;
    try {
        await safeDb().from('announcements').insert({
            ministry_id: ministryId,
            title: ann.title,
            message: ann.message,
            type: ann.type,
            expiration_date: ann.expirationDate,
            author: author,
            timestamp: new Date().toISOString()
        });
        return true;
    } catch(e) { return false; }
};

export const interactAnnouncementSQL = async (id: string, userId: string, userName: string, action: 'read' | 'like') => {
    if (isPreviewMode) return;
    try {
        await safeDb().rpc('interact_announcement', { 
            ann_id: id, 
            u_id: userId, 
            u_name: userName, 
            action_type: action 
        });
    } catch(e) { console.error(e); }
};

// --- PUSH SUBSCRIPTIONS ---

export const saveSubscriptionSQL = async (ministryId: string, sub: PushSubscription) => {
    if (isPreviewMode) return;
    try {
        const { data: { user } } = await safeDb().auth.getUser();
        if (!user) return;

        const subJson = sub.toJSON();
        await safeDb().from('push_subscriptions').upsert({
            user_id: user.id,
            endpoint: sub.endpoint,
            p256dh: subJson.keys?.p256dh,
            auth: subJson.keys?.auth,
            ministry_id: ministryId,
            updated_at: new Date().toISOString()
        }, { onConflict: 'endpoint' });
    } catch(e) { console.error(e); }
};

export const sendNotificationSQL = async (ministryId: string, payload: { title: string, message: string, type?: string, actionLink?: string }) => {
    if (isPreviewMode) return;
    try {
        await safeDb().functions.invoke('push-notification', {
            body: { ministryId, ...payload }
        });
    } catch(e) { console.error(e); }
};

// --- GLOBAL CONFLICTS & RANKING ---

export const fetchGlobalSchedules = async (monthIso: string, currentMinistryId: string): Promise<GlobalConflictMap> => {
    if (isPreviewMode) return {};
    return {};
};

export const fetchRankingData = async (ministryId: string): Promise<RankingEntry[]> => {
    if (isPreviewMode) return [];
    try {
        const { data } = await safeDb().from('ranking_view').select('*').eq('ministry_id', ministryId);
        return data?.map((r: any) => ({
            memberId: r.member_id,
            name: r.name,
            avatar_url: r.avatar_url,
            points: r.points,
            stats: r.stats
        })) || [];
    } catch(e) { return []; }
};
