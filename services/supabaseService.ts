import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
    SUPABASE_URL, SUPABASE_KEY, PushSubscriptionRecord, User, MemberMap, 
    AppNotification, TeamMemberProfile, AvailabilityMap, SwapRequest, 
    ScheduleMap, RepertoireItem, Announcement, GlobalConflictMap, 
    GlobalConflict, DEFAULT_ROLES, AttendanceMap, AuditLogEntry, MinistrySettings,
    RankingEntry, AvailabilityNotesMap, CustomEvent
} from '../types';

let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

export const getSupabase = () => supabase;

// --- AUTHENTICATION ---

export const loginWithEmail = async (email: string, pass: string) => {
    if (!supabase) return { success: true, message: "Modo Demo: Login simulado." };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) return { success: false, message: error.message };
    return { success: true, user: data.user };
};

export const loginWithGoogle = async () => {
    if (!supabase) return { success: false, message: "Configuração Supabase ausente." };
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin
        }
    });
    if (error) return { success: false, message: error.message };
    return { success: true, data };
};

export const registerWithEmail = async (email: string, pass: string, name: string, ministries: string[], whatsapp?: string, functions?: string[]) => {
    if (!supabase) return { success: false, message: "Supabase não configurado." };
    
    // 1. Sign Up
    const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
            data: { full_name: name, name: name }
        }
    });

    if (error) return { success: false, message: error.message };
    if (!data.user) return { success: false, message: "Erro ao criar usuário." };

    // 2. Create Profile
    const ministryId = ministries[0] || 'midia';
    const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        email,
        name,
        ministry_id: ministryId,
        allowed_ministries: ministries,
        role: 'member',
        whatsapp,
        functions
    });

    if (profileError) console.error("Erro ao criar perfil:", profileError);

    return { success: true, message: "Cadastro realizado com sucesso!" };
};

export const sendPasswordResetEmail = async (email: string) => {
    if (!supabase) return { success: false, message: "Supabase não configurado." };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '?reset=true',
    });
    if (error) return { success: false, message: error.message };
    return { success: true, message: "Link de redefinição enviado para o e-mail." };
};

export const logout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    localStorage.clear();
};

// --- USER PROFILE ---

export const updateUserProfile = async (name: string, whatsapp: string, avatar_url: string | undefined, functions: string[] | undefined, birthDate: string | undefined, ministryId: string | null) => {
    if (!supabase) return { success: false, message: "Sem conexão." };
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Usuário não logado." };

    const updates: any = { name, whatsapp, updated_at: new Date() };
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (functions !== undefined) updates.functions = functions;
    if (birthDate !== undefined) updates.birth_date = birthDate;

    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (error) return { success: false, message: error.message };
    return { success: true, message: "Perfil atualizado!" };
};

export const updateProfileMinistry = async (userId: string, ministryId: string) => {
    if (!supabase) return;
    await supabase.from('profiles').update({ ministry_id: ministryId }).eq('id', userId);
};

export const joinMinistry = async (ministryId: string, roles: string[]) => {
    if (!supabase) return { success: false, message: "Erro de conexão." };
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Não autorizado." };

    const { data: profile } = await supabase.from('profiles').select('allowed_ministries, functions').eq('id', user.id).single();
    if (!profile) return { success: false, message: "Perfil não encontrado." };

    const currentAllowed = profile.allowed_ministries || [];
    if (!currentAllowed.includes(ministryId)) {
        const newAllowed = [...currentAllowed, ministryId];
        // Merge functions without duplicates
        const currentFunctions = profile.functions || [];
        const newFunctions = Array.from(new Set([...currentFunctions, ...roles]));

        const { error } = await supabase.from('profiles').update({ 
            allowed_ministries: newAllowed,
            functions: newFunctions,
            ministry_id: ministryId // Switch to new ministry immediately
        }).eq('id', user.id);

        if (error) return { success: false, message: error.message };
        return { success: true, message: `Bem-vindo ao ministério de ${ministryId}!` };
    }
    return { success: true, message: "Você já participa deste ministério." };
};

export const deleteMember = async (ministryId: string, memberId: string, name: string) => {
    if (!supabase) return { success: false, message: "Sem conexão." };
    
    // Using Edge Function for safe deletion/update
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return { success: false, message: "Não autenticado." };

        await fetch(`${SUPABASE_URL}/functions/v1/push-notification`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'delete_member',
                ministryId,
                memberId
            })
        });
        return { success: true, message: "Membro removido." };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

export const toggleAdminSQL = async (email: string, status: boolean, ministryId: string | null) => {
    if (!supabase) return;
    // Edge function to handle admin toggle safely
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await fetch(`${SUPABASE_URL}/functions/v1/push-notification`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'toggle_admin',
            targetEmail: email,
            status: status,
            ministryId: ministryId
        })
    });
};

// --- DATA FETCHING ---

export const fetchMinistrySettings = async (ministryId: string): Promise<MinistrySettings> => {
    if (!supabase) return { displayName: '', roles: [] };
    const { data } = await supabase.from('ministry_settings').select('*').eq('ministry_id', ministryId).single();
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
    return { displayName: '', roles: [] };
};

export const saveMinistrySettings = async (ministryId: string, displayName?: string, roles?: string[], start?: string, end?: string) => {
    if (!supabase) return;
    const updates: any = { ministry_id: ministryId, updated_at: new Date() };
    if (displayName !== undefined) updates.display_name = displayName;
    if (roles !== undefined) updates.roles = roles;
    if (start !== undefined) updates.availability_start = start;
    if (end !== undefined) updates.availability_end = end;

    const { error } = await supabase.from('ministry_settings').upsert(updates, { onConflict: 'ministry_id' });
    if (error) console.error("Error saving settings:", error);
};

export const fetchMinistrySchedule = async (ministryId: string, monthIso: string): Promise<{events: any[], schedule: ScheduleMap, attendance: AttendanceMap}> => {
    if (!supabase) return { events: [], schedule: {}, attendance: {} };
    
    // Fetch Events
    const start = `${monthIso}-01`;
    const end = `${monthIso}-31`; // Loose end date
    
    const { data: eventsData } = await supabase.from('events')
        .select('*')
        .eq('ministry_id', ministryId)
        .gte('date_time', start)
        .lte('date_time', end + 'T23:59:59');

    const events = (eventsData || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        date: e.date_time.split('T')[0],
        time: e.date_time.split('T')[1].slice(0, 5),
        iso: e.date_time.slice(0, 16),
        dateDisplay: e.date_time.split('T')[0].split('-').reverse().join('/')
    }));

    // Fetch Schedule
    const eventIds = events.map(e => e.id);
    const schedule: ScheduleMap = {};
    const attendance: AttendanceMap = {};

    if (eventIds.length > 0) {
        const { data: assignments } = await supabase.from('schedule_assignments')
            .select(`
                event_id, role, confirmed,
                profiles:member_id (name)
            `)
            .in('event_id', eventIds);

        assignments?.forEach((a: any) => {
            const event = events.find(e => e.id === a.event_id);
            if (event && a.profiles) {
                const key = `${event.iso}_${a.role}`;
                schedule[key] = a.profiles.name;
                if (a.confirmed) attendance[key] = true;
            }
        });
    }

    return { events, schedule, attendance };
};

export const fetchMinistryMembers = async (ministryId: string): Promise<{memberMap: MemberMap, publicList: TeamMemberProfile[]}> => {
    if (!supabase) return { memberMap: {}, publicList: [] };
    
    // Fetch Profiles associated with ministry
    // We use a complex filter because allowed_ministries is an array
    // Since supabase js filter with arrays can be tricky, we fetch broadly then filter if needed or use .or()
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .or(`ministry_id.eq.${cleanMid},allowed_ministries.cs.{${cleanMid}}`);

    const memberMap: MemberMap = {};
    const publicList: TeamMemberProfile[] = [];

    profiles?.forEach((p: any) => {
        const memberName = p.name || 'Sem Nome';
        const roles = p.functions || [];
        
        publicList.push({
            id: p.id,
            name: memberName,
            email: p.email,
            avatar_url: p.avatar_url,
            roles: roles,
            whatsapp: p.whatsapp,
            birthDate: p.birth_date,
            isAdmin: p.is_admin
        });

        roles.forEach((r: string) => {
            if (!memberMap[r]) memberMap[r] = [];
            memberMap[r].push(memberName);
        });
    });

    return { memberMap, publicList };
};

export const fetchMinistryAvailability = async (ministryId: string): Promise<{ availability: AvailabilityMap, notes: AvailabilityNotesMap }> => {
    if (!supabase) return { availability: {}, notes: {} };
    
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
            .eq('ministry_id', cleanMid)
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

            if (metadata.type === 'BLOCK_MONTH') {
                const [y, m] = dbDate.split('-');
                if (!availability[name]) availability[name] = [];
                availability[name].push(`${y}-${m}_BLK`);
            } else if (metadata.type !== 'GENERAL') {
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
    userId: string, memberName: string, dates: string[], targetMonth: string, ministryId: string, notes?: Record<string, string>
) => {
    if (!supabase) return;
    
    if (!targetMonth || targetMonth.length !== 7) return;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const [y, m] = targetMonth.split('-').map(Number);
        const startDate = `${targetMonth}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        const endDate = `${targetMonth}-${String(lastDay).padStart(2, '0')}`;

        const { error: deleteError } = await supabase.from('availability')
            .delete()
            .eq('member_id', userId)
            .eq('ministry_id', cleanMid)
            .gte('date', startDate)
            .lte('date', endDate);
        
        if (deleteError) throw deleteError;

        const rowsToInsert: any[] = [];
        const isBlocked = dates.some(d => d.includes('_BLK'));

        if (isBlocked) {
            rowsToInsert.push({
                member_id: userId,
                ministry_id: cleanMid,
                date: startDate,
                note: JSON.stringify({ type: 'BLOCK_MONTH' }),
                status: 'unavailable'
            });
        } else {
            const availableDates = dates.filter(d => d.startsWith(targetMonth));
            
            for (const uiDate of availableDates) {
                const [datePart, suffix] = uiDate.split('_'); 
                let metadata: any = {};
                if (suffix === 'M') metadata.period = 'M';
                if (suffix === 'N') metadata.period = 'N';
                
                rowsToInsert.push({
                    member_id: userId,
                    ministry_id: cleanMid,
                    date: datePart, 
                    note: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
                    status: 'available' 
                });
            }
        }

        const generalNoteKey = `${targetMonth}-00`;
        if (notes && notes[generalNoteKey]) {
            const generalText = notes[generalNoteKey];
            const firstOfMonth = `${targetMonth}-01`;
            if (!isBlocked) {
                rowsToInsert.push({
                    member_id: userId,
                    ministry_id: cleanMid,
                    date: firstOfMonth,
                    note: JSON.stringify({ type: 'GENERAL', text: generalText, period: 'ALL' }),
                    status: 'available'
                });
            }
        }

        if (rowsToInsert.length > 0) {
            const { error: insertError } = await supabase.from('availability').insert(rowsToInsert);
            if (insertError) throw insertError;
        }

    } catch (e: any) {
        console.error("Erro saving availability:", e);
    }
};

// --- EVENTS MANAGEMENT ---

export const createMinistryEvent = async (ministryId: string, event: Partial<CustomEvent>) => {
    if (!supabase || !event.date || !event.time || !event.title) return;
    
    // Ensure date_time is correct
    const isoString = event.iso || `${event.date}T${event.time}:00`;
    
    const { error } = await supabase.from('events').insert({
        ministry_id: ministryId,
        title: event.title,
        date_time: isoString
    });
    
    if (error) console.error("Error creating event:", error);
};

export const deleteMinistryEvent = async (ministryId: string, iso: string) => {
    if (!supabase) return;
    // We assume iso is unique enough or we should look up ID.
    // Ideally we pass ID, but here we might pass ISO.
    // If ID is available in UI, use it. If only ISO:
    const { error } = await supabase.from('events').delete().eq('ministry_id', ministryId).eq('date_time', iso);
    if (error) console.error("Error deleting event:", error);
};

export const updateMinistryEvent = async (ministryId: string, oldIso: string, newTitle: string, newIso: string, applyToAll: boolean) => {
    if (!supabase) return;
    
    if (applyToAll) {
        // Update all future events with same title
        // NOTE: This logic is complex in SQL without proper grouping ID.
        // We will just update this single event for now to be safe, or future ones on same day time?
        // Let's stick to single update unless we have recurrent_id
        console.warn("Bulk update not fully implemented without recurrence ID.");
    }

    const { error } = await supabase.from('events')
        .update({ title: newTitle, date_time: newIso })
        .eq('ministry_id', ministryId)
        .eq('date_time', oldIso); // Targeting by old ISO might be brittle if duplicates exists

    if (error) console.error("Error updating event:", error);
};

export const clearScheduleForMonth = async (ministryId: string, monthIso: string) => {
    if (!supabase) return;
    const start = `${monthIso}-01`;
    const end = `${monthIso}-31T23:59:59`;
    
    // Find events
    const { data: events } = await supabase.from('events').select('id').eq('ministry_id', ministryId).gte('date_time', start).lte('date_time', end);
    const ids = events?.map((e: any) => e.id) || [];
    
    if (ids.length > 0) {
        await supabase.from('schedule_assignments').delete().in('event_id', ids);
    }
};

export const resetToDefaultEvents = async (ministryId: string, monthIso: string) => {
    // 1. Clear existing
    await clearScheduleForMonth(ministryId, monthIso);
    if (!supabase) return;

    // 2. Generate new events based on logic (Sundays, etc)
    // For now, we'll just delete assignments, maybe creating default events logic needs to be here?
    // Assuming UI handles creation or this clears custom events too?
    // Implementation: Delete all events in month, then re-create Sundays.
    const start = `${monthIso}-01`;
    const end = `${monthIso}-31T23:59:59`;
    await supabase.from('events').delete().eq('ministry_id', ministryId).gte('date_time', start).lte('date_time', end);

    const [year, month] = monthIso.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    const eventsToInsert = [];

    while (date.getMonth() === month - 1) {
        if (date.getDay() === 0) { // Sunday
            // Manhã
            eventsToInsert.push({
                ministry_id: ministryId,
                title: 'Culto da Família',
                date_time: `${date.toISOString().split('T')[0]}T09:00:00`
            });
            // Noite
            eventsToInsert.push({
                ministry_id: ministryId,
                title: 'Culto de Celebração',
                date_time: `${date.toISOString().split('T')[0]}T18:00:00`
            });
        }
        date.setDate(date.getDate() + 1);
    }

    if (eventsToInsert.length > 0) {
        await supabase.from('events').insert(eventsToInsert);
    }
};

export const saveScheduleAssignment = async (ministryId: string, key: string, memberName: string) => {
    if (!supabase) return false;
    // key format: "YYYY-MM-DDTHH:mm_Role"
    const [iso, role] = key.split('_');
    
    // 1. Find Event ID
    const { data: event } = await supabase.from('events').select('id').eq('ministry_id', ministryId).eq('date_time', iso).single();
    if (!event) return false; // Event must exist

    // 2. Find Member ID (if name provided)
    let memberId = null;
    if (memberName) {
        const { data: profile } = await supabase.from('profiles').select('id').ilike('name', memberName).limit(1).single();
        if (profile) memberId = profile.id;
        else return false; // Member must exist
    }

    // 3. Upsert or Delete
    if (memberId) {
        const { error } = await supabase.from('schedule_assignments').upsert({
            event_id: event.id,
            member_id: memberId,
            role: role,
            confirmed: false
        }, { onConflict: 'event_id,role' });
        return !error;
    } else {
        // Remove assignment
        const { error } = await supabase.from('schedule_assignments').delete().eq('event_id', event.id).eq('role', role);
        return !error;
    }
};

export const saveScheduleBulk = async (ministryId: string, schedule: ScheduleMap, overwrite = true) => {
    if (!supabase) return;
    
    for (const [key, memberName] of Object.entries(schedule)) {
        await saveScheduleAssignment(ministryId, key, memberName);
    }
};

export const toggleAssignmentConfirmation = async (ministryId: string, key: string) => {
    if (!supabase) return false;
    const [iso, role] = key.split('_');
    
    const { data: event } = await supabase.from('events').select('id').eq('ministry_id', ministryId).eq('date_time', iso).single();
    if (!event) return false;

    // Get current status
    const { data: assign } = await supabase.from('schedule_assignments').select('confirmed').eq('event_id', event.id).eq('role', role).single();
    
    if (assign) {
        const { error } = await supabase.from('schedule_assignments').update({ confirmed: !assign.confirmed }).eq('event_id', event.id).eq('role', role);
        return !error;
    }
    return false;
};

// --- NOTIFICATIONS & ANNOUNCEMENTS ---

export const fetchNotificationsSQL = async (ministries: string[], userId: string): Promise<AppNotification[]> => {
    if (!supabase) return [];
    
    const { data } = await supabase.from('notifications')
        .select('*')
        .in('ministry_id', ministries)
        .order('created_at', { ascending: false })
        .limit(20);

    if (!data) return [];

    // Check read status
    const notifIds = data.map((n: any) => n.id);
    const { data: reads } = await supabase.from('notification_reads').select('notification_id').eq('user_id', userId).in('notification_id', notifIds);
    const readSet = new Set(reads?.map((r: any) => r.notification_id));

    return data.map((n: any) => ({
        id: n.id,
        ministryId: n.ministry_id,
        title: n.title,
        message: n.message,
        type: n.type,
        timestamp: n.created_at,
        actionLink: n.action_link,
        read: readSet.has(n.id)
    }));
};

export const markNotificationsReadSQL = async (ids: string[], userId: string) => {
    if (!supabase || ids.length === 0) return;
    const records = ids.map(id => ({ notification_id: id, user_id: userId }));
    await supabase.from('notification_reads').upsert(records, { onConflict: 'notification_id,user_id' });
};

export const clearAllNotificationsSQL = async (ministryId: string) => {
    if (!supabase) return;
    await supabase.from('notifications').delete().eq('ministry_id', ministryId);
};

export const sendNotificationSQL = async (ministryId: string, notif: Partial<AppNotification>) => {
    if (!supabase) return;
    
    // 1. Insert into DB
    await supabase.from('notifications').insert({
        ministry_id: ministryId,
        title: notif.title,
        message: notif.message,
        type: notif.type || 'info',
        action_link: notif.actionLink
    });

    // 2. Trigger Push via Edge Function
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        fetch(`${SUPABASE_URL}/functions/v1/push-notification`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ministryId,
                title: notif.title,
                message: notif.message,
                type: notif.type,
                actionLink: notif.actionLink
            })
        }).catch(err => console.error("Push Error:", err));
    }
};

export const saveSubscriptionSQL = async (ministryId: string, sub: PushSubscription) => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const subJson = sub.toJSON();
    await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint: sub.endpoint,
        p256dh: subJson.keys?.p256dh,
        auth: subJson.keys?.auth,
        ministry_id: ministryId
    }, { onConflict: 'endpoint' });
};

export const fetchAnnouncementsSQL = async (ministryId: string): Promise<Announcement[]> => {
    if (!supabase) return [];
    
    const now = new Date().toISOString();
    const { data } = await supabase.from('announcements')
        .select(`
            *,
            announcement_interactions(user_id, interaction_type, profiles(name))
        `)
        .eq('ministry_id', ministryId)
        .gte('expiration_date', now)
        .order('created_at', { ascending: false });

    return (data || []).map((a: any) => {
        const reads = a.announcement_interactions.filter((i: any) => i.interaction_type === 'read').map((i: any) => ({ userId: i.user_id, name: i.profiles?.name, timestamp: '' }));
        const likes = a.announcement_interactions.filter((i: any) => i.interaction_type === 'like').map((i: any) => ({ userId: i.user_id, name: i.profiles?.name, timestamp: '' }));
        return {
            id: a.id,
            title: a.title,
            message: a.message,
            type: a.type,
            timestamp: a.created_at,
            expirationDate: a.expiration_date,
            author: a.author_name || 'Liderança',
            readBy: reads,
            likedBy: likes
        };
    });
};

export const createAnnouncementSQL = async (ministryId: string, ann: Partial<Announcement>, authorName: string) => {
    if (!supabase) return;
    await supabase.from('announcements').insert({
        ministry_id: ministryId,
        title: ann.title,
        message: ann.message,
        type: ann.type,
        expiration_date: ann.expirationDate,
        author_name: authorName
    });
};

export const interactAnnouncementSQL = async (announcementId: string, userId: string, userName: string, type: 'read' | 'like') => {
    if (!supabase) return;
    
    if (type === 'read') {
        await supabase.from('announcement_interactions').upsert({
            announcement_id: announcementId,
            user_id: userId,
            interaction_type: 'read'
        }, { onConflict: 'announcement_id,user_id,interaction_type' });
    } else {
        // Toggle like
        const { data } = await supabase.from('announcement_interactions').select('*').eq('announcement_id', announcementId).eq('user_id', userId).eq('interaction_type', 'like').single();
        if (data) {
            await supabase.from('announcement_interactions').delete().eq('id', data.id);
        } else {
            await supabase.from('announcement_interactions').insert({
                announcement_id: announcementId,
                user_id: userId,
                interaction_type: 'like'
            });
        }
    }
};

// --- SWAPS & REPERTOIRE ---

export const fetchSwapRequests = async (ministryId: string): Promise<SwapRequest[]> => {
    if (!supabase) return [];
    
    const { data } = await supabase.from('swap_requests')
        .select('*')
        .eq('ministry_id', ministryId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

    return (data || []).map((r: any) => ({
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

export const createSwapRequestSQL = async (ministryId: string, req: SwapRequest) => {
    if (!supabase) return false;
    const { error } = await supabase.from('swap_requests').insert({
        ministry_id: ministryId,
        requester_id: req.requesterId,
        requester_name: req.requesterName,
        role: req.role,
        event_iso: req.eventIso,
        event_title: req.eventTitle,
        status: 'pending'
    });
    return !error;
};

export const performSwapSQL = async (ministryId: string, reqId: string, takerName: string, takerId: string) => {
    if (!supabase) return { success: false, message: "Erro conexão." };
    
    // 1. Get Request Info
    const { data: req } = await supabase.from('swap_requests').select('*').eq('id', reqId).single();
    if (!req || req.status !== 'pending') return { success: false, message: "Solicitação inválida." };

    // 2. Update Schedule
    // Find event
    const { data: event } = await supabase.from('events').select('id').eq('ministry_id', ministryId).eq('date_time', req.event_iso).single();
    if (!event) return { success: false, message: "Evento não encontrado." };

    // Delete old assignment
    await supabase.from('schedule_assignments').delete().eq('event_id', event.id).eq('role', req.role).eq('member_id', req.requester_id);
    
    // Insert new assignment
    await supabase.from('schedule_assignments').insert({
        event_id: event.id,
        role: req.role,
        member_id: takerId,
        confirmed: true // Auto confirm if swapped
    });

    // 3. Update Request Status
    await supabase.from('swap_requests').update({
        status: 'completed',
        taken_by_name: takerName
    }).eq('id', reqId);

    return { success: true, message: "Troca realizada com sucesso!" };
};

export const fetchRepertoire = async (ministryId: string): Promise<RepertoireItem[]> => {
    if (!supabase) return [];
    
    const { data } = await supabase.from('repertoire')
        .select('*')
        .eq('ministry_id', ministryId)
        .order('event_date', { ascending: false });

    return (data || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        link: r.link,
        date: r.event_date,
        addedBy: r.added_by,
        createdAt: r.created_at
    }));
};

export const addToRepertoire = async (ministryId: string, item: Partial<RepertoireItem>) => {
    if (!supabase) return false;
    const { error } = await supabase.from('repertoire').insert({
        ministry_id: ministryId,
        title: item.title,
        link: item.link,
        event_date: item.date,
        added_by: item.addedBy
    });
    return !error;
};

export const deleteFromRepertoire = async (id: string) => {
    if (!supabase) return;
    await supabase.from('repertoire').delete().eq('id', id);
};

// --- MISC ---

export const fetchGlobalSchedules = async (monthIso: string, excludeMinistryId: string): Promise<GlobalConflictMap> => {
    if (!supabase) return {};
    
    const start = `${monthIso}-01`;
    const end = `${monthIso}-31T23:59:59`;

    // Fetch assignments from OTHER ministries in same month
    const { data: events } = await supabase.from('events').select('id, date_time, ministry_id').neq('ministry_id', excludeMinistryId).gte('date_time', start).lte('date_time', end);
    
    if (!events || events.length === 0) return {};
    
    const eventIds = events.map((e: any) => e.id);
    const { data: assigns } = await supabase.from('schedule_assignments')
        .select(`event_id, role, profiles(name)`)
        .in('event_id', eventIds);

    const map: GlobalConflictMap = {};
    
    assigns?.forEach((a: any) => {
        const evt = events.find((e: any) => e.id === a.event_id);
        if (evt && a.profiles?.name) {
            const normalizedName = a.profiles.name.trim().toLowerCase();
            if (!map[normalizedName]) map[normalizedName] = [];
            map[normalizedName].push({
                ministryId: evt.ministry_id,
                eventIso: evt.date_time.slice(0, 16),
                role: a.role
            });
        }
    });

    return map;
};

export const fetchRankingData = async (ministryId: string): Promise<RankingEntry[]> => {
    if (!supabase) {
        // Mock data logic removed for brevity, assuming Supabase connection
        return [];
    }
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