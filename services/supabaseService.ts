import { createClient } from '@supabase/supabase-js';
import { 
    SUPABASE_URL, SUPABASE_KEY, PushSubscriptionRecord, User, MemberMap, 
    AppNotification, TeamMemberProfile, AvailabilityMap, SwapRequest, 
    ScheduleMap, RepertoireItem, Announcement, GlobalConflictMap, 
    GlobalConflict, DEFAULT_ROLES, AttendanceMap, AuditLogEntry, MinistrySettings,
    RankingEntry, AvailabilityNotesMap, CustomEvent, MemberMonthlyStat
} from '../types';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const getSupabase = () => supabase;

// Auth
export const loginWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { success: !error, message: error?.message || "Login success", user: data.user };
};

export const loginWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    return { success: !error, message: error?.message || "Redirecting..." };
};

export const logout = async () => {
    await supabase.auth.signOut();
};

export const registerWithEmail = async (email: string, password: string, name: string, ministries: string[], phone?: string, roles?: string[]) => {
    const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
            data: {
                full_name: name,
                name: name,
                ministry_id: ministries[0], // Default to first
                allowed_ministries: ministries,
                roles: roles
            }
        }
    });
    // Also create profile if needed (usually handled by trigger, but we can try)
    if (data.user) {
        await supabase.from('profiles').upsert({
            id: data.user.id,
            email,
            name,
            ministry_id: ministries[0],
            allowed_ministries: ministries,
            roles: roles
        });
    }
    return { success: !error, message: error?.message || "Registration success" };
};

export const sendPasswordResetEmail = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { success: !error, message: error?.message || "Password reset email sent" };
};

// Profile & Ministry
export const fetchMinistrySettings = async (ministryId: string): Promise<MinistrySettings> => {
    const { data } = await supabase.from('ministry_settings').select('*').eq('ministry_id', ministryId).single();
    if (!data) return { displayName: '', roles: [] };
    return { 
        displayName: data.display_name, 
        roles: data.roles || [], 
        availabilityStart: data.availability_start, 
        availabilityEnd: data.availability_end 
    };
};

export const saveMinistrySettings = async (ministryId: string, displayName?: string, roles?: string[], start?: string, end?: string) => {
    const updates: any = {};
    if (displayName !== undefined) updates.display_name = displayName;
    if (roles !== undefined) updates.roles = roles;
    if (start !== undefined) updates.availability_start = start;
    if (end !== undefined) updates.availability_end = end;
    
    await supabase.from('ministry_settings').upsert({ ministry_id: ministryId, ...updates });
};

export const joinMinistry = async (ministryId: string, roles: string[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "No user" };
    
    const { data: profile } = await supabase.from('profiles').select('allowed_ministries, roles').eq('id', user.id).single();
    let currentAllowed = profile?.allowed_ministries || [];
    if (!currentAllowed.includes(ministryId)) currentAllowed.push(ministryId);
    
    // Merge roles? or replace for this ministry context? Assuming simple merge for now
    // In a real app roles might be per ministry
    
    const { error } = await supabase.from('profiles').update({ allowed_ministries: currentAllowed }).eq('id', user.id);
    return { success: !error, message: error?.message || "Joined ministry" };
};

export const updateUserProfile = async (name: string, whatsapp: string, avatar_url?: string, functions?: string[], birthDate?: string, ministryId?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "No user" };
    
    const updates: any = { name, whatsapp, functions, birth_date: birthDate };
    if (avatar_url) updates.avatar_url = avatar_url;
    
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    return { success: !error, message: error?.message || "Profile updated" };
};

export const updateProfileMinistry = async (userId: string, ministryId: string) => {
    await supabase.from('profiles').update({ ministry_id: ministryId }).eq('id', userId);
};

export const toggleAdminSQL = async (email: string, status: boolean, ministryId: string) => {
    // This should ideally call an edge function or use RLS
    await supabase.functions.invoke('push-notification', {
        body: { action: 'toggle_admin', targetEmail: email, status, ministryId }
    });
};

export const deleteMember = async (ministryId: string, memberId: string, name: string) => {
    // Call edge function to safely remove
    const { data, error } = await supabase.functions.invoke('push-notification', {
        body: { action: 'delete_member', memberId, ministryId, name }
    });
    return { success: !error, message: error?.message || "Member removed" };
};

export const fetchMinistryMembers = async (ministryId: string): Promise<{memberMap: MemberMap, publicList: TeamMemberProfile[]}> => {
    // Logic to fetch members based on ministry_id or allowed_ministries
    const { data } = await supabase.from('profiles').select('*').or(`ministry_id.eq.${ministryId},allowed_ministries.cs.{${ministryId}}`);
    
    const publicList: TeamMemberProfile[] = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        whatsapp: p.whatsapp,
        avatar_url: p.avatar_url,
        roles: p.roles || [], // roles from profile might need mapping to ministry roles
        isAdmin: p.is_admin,
        birthDate: p.birth_date,
        functions: p.functions || []
    }));

    const memberMap: MemberMap = {};
    // Populate memberMap based on functions/roles
    publicList.forEach(m => {
        const roles = m.functions && m.functions.length > 0 ? m.functions : (m.roles || []);
        roles.forEach(r => {
            if (!memberMap[r]) memberMap[r] = [];
            memberMap[r].push(m.name);
        });
    });

    return { memberMap, publicList };
};

// Events & Schedule
export const fetchMinistrySchedule = async (ministryId: string, monthIso: string) => {
    const startDate = `${monthIso}-01`;
    const [y, m] = monthIso.split('-').map(Number);
    const nextMonth = new Date(y, m, 1).toISOString().split('T')[0];

    // Events
    const { data: eventsData } = await supabase.from('events')
        .select('*')
        .eq('ministry_id', ministryId)
        .gte('date_time', startDate)
        .lt('date_time', nextMonth);
    
    const events = (eventsData || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        iso: e.date_time, // assuming date_time is ISO string
        dateDisplay: new Date(e.date_time).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'}),
        time: e.date_time.split('T')[1]?.slice(0,5) || ''
    }));

    // Assignments
    const eventIds = events.map(e => e.id);
    let schedule: ScheduleMap = {};
    let attendance: AttendanceMap = {};
    
    if (eventIds.length > 0) {
        const { data: assignments } = await supabase.from('schedule_assignments')
            .select('*')
            .in('event_id', eventIds);
        
        (assignments || []).forEach((a: any) => {
            // Key format usually: EventISO_Role
            // We need to match event_id to ISO
            const evt = events.find(e => e.id === a.event_id);
            if (evt) {
                const key = `${evt.iso}_${a.role}`;
                if (a.member_name) schedule[key] = a.member_name;
                if (a.confirmed) attendance[key] = true;
            }
        });
    }

    return { events, schedule, attendance };
};

export const createMinistryEvent = async (ministryId: string, evt: any) => {
    const iso = evt.iso || `${evt.date}T${evt.time}:00`;
    await supabase.from('events').insert({
        ministry_id: ministryId,
        title: evt.title,
        date_time: iso
    });
};

export const updateMinistryEvent = async (ministryId: string, oldIso: string, newTitle: string, newIso: string, applyToAll: boolean) => {
    // Logic to find event by oldIso and update
    // For simplicity, just update based on match
    const { data } = await supabase.from('events').select('id').eq('ministry_id', ministryId).eq('date_time', oldIso).single();
    if (data) {
        await supabase.from('events').update({ title: newTitle, date_time: newIso }).eq('id', data.id);
    }
};

export const deleteMinistryEvent = async (ministryId: string, iso: string) => {
    await supabase.from('events').delete().eq('ministry_id', ministryId).eq('date_time', iso);
};

export const saveScheduleAssignment = async (ministryId: string, key: string, value: string) => {
    // Key: ISO_Role. Need to split
    const lastUnderscore = key.lastIndexOf('_');
    const iso = key.substring(0, lastUnderscore);
    const role = key.substring(lastUnderscore + 1);
    
    const { data: evt } = await supabase.from('events').select('id').eq('ministry_id', ministryId).eq('date_time', iso).single();
    if (!evt) return false;

    // Find member ID if possible, else just save name
    let memberId = null;
    if (value) {
        const { data: m } = await supabase.from('profiles').select('id').eq('name', value).single();
        memberId = m?.id;
    }

    // Upsert assignment
    // We need unique constraint on (event_id, role)
    const { error } = await supabase.from('schedule_assignments').upsert({
        event_id: evt.id,
        role: role,
        member_name: value,
        member_id: memberId,
        confirmed: false // Reset confirmation on change
    }, { onConflict: 'event_id,role' });

    return !error;
};

export const saveScheduleBulk = async (ministryId: string, schedule: ScheduleMap, overwrite: boolean) => {
    // Loop through schedule keys and save
    for (const [key, value] of Object.entries(schedule)) {
        await saveScheduleAssignment(ministryId, key, value);
    }
};

export const toggleAssignmentConfirmation = async (ministryId: string, key: string) => {
    const lastUnderscore = key.lastIndexOf('_');
    const iso = key.substring(0, lastUnderscore);
    const role = key.substring(lastUnderscore + 1);
    
    const { data: evt } = await supabase.from('events').select('id').eq('ministry_id', ministryId).eq('date_time', iso).single();
    if (!evt) return false;

    const { data: assign } = await supabase.from('schedule_assignments').select('confirmed').eq('event_id', evt.id).eq('role', role).single();
    if (assign) {
        await supabase.from('schedule_assignments').update({ confirmed: !assign.confirmed }).eq('event_id', evt.id).eq('role', role);
    }
    return true;
};

export const clearScheduleForMonth = async (ministryId: string, monthIso: string) => {
    const { events } = await fetchMinistrySchedule(ministryId, monthIso);
    const eventIds = events.map(e => e.id);
    if (eventIds.length > 0) {
        await supabase.from('schedule_assignments').delete().in('event_id', eventIds);
    }
};

export const resetToDefaultEvents = async (ministryId: string, monthIso: string) => {
    // Clear events? Or just re-add defaults?
    // This requires logic about what are default events.
    // For now, let's just say we cleared schedule.
    await clearScheduleForMonth(ministryId, monthIso);
};

// Availability
export const fetchMinistryAvailability = async (ministryId: string) => {
    const { data } = await supabase.from('availability').select('*').eq('ministry_id', ministryId);
    
    const availability: AvailabilityMap = {};
    const notes: AvailabilityNotesMap = {};

    (data || []).forEach((row: any) => {
        if (!availability[row.member_name]) availability[row.member_name] = [];
        if (row.dates) availability[row.member_name] = row.dates;
        if (row.notes) {
            Object.assign(notes, row.notes);
        }
    });

    return { availability, notes };
};

export const saveMemberAvailability = async (userId: string, memberName: string, dates: string[], monthIso: string, notes: any) => {
    // Assuming 'availability' table has member_name (or user_id) and dates array
    // We might need to merge or replace for the month
    // Simplified: update row for user
    const { data: current } = await supabase.from('availability').select('dates').eq('user_id', userId).single();
    // Logic to merge dates would be complex here without more info on DB structure.
    // Assuming we replace dates for the user or append.
    // Let's assume the passed 'dates' are ALL dates for the user (or we handle merge in UI)
    
    // If dates param contains ALL dates, we just save.
    await supabase.from('availability').upsert({
        user_id: userId,
        member_name: memberName,
        dates: dates,
        notes: notes, // simplistic
        ministry_id: 'global' // or specific
    });
};

// Notifications & Announcements
export const fetchNotificationsSQL = async (ministryIds: string[], userId: string) => {
    const { data } = await supabase.from('notifications')
        .select('*')
        .or(`target_user_id.eq.${userId},ministry_id.in.(${ministryIds.join(',')})`)
        .order('timestamp', { ascending: false });
        
    return (data || []).map((n: any) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        timestamp: n.timestamp,
        read: n.read_by?.includes(userId) || false,
        ministryId: n.ministry_id,
        actionLink: n.action_link
    }));
};

export const sendNotificationSQL = async (ministryId: string, notif: any) => {
    await supabase.from('notifications').insert({
        ministry_id: ministryId,
        title: notif.title,
        message: notif.message,
        type: notif.type,
        action_link: notif.actionLink,
        timestamp: new Date().toISOString()
    });
    // Trigger push via Edge Function
    await supabase.functions.invoke('push-notification', {
        body: { ministryId, ...notif }
    });
};

export const markNotificationsReadSQL = async (ids: string[], userId: string) => {
    // This requires appending userId to read_by array column
    // Supabase doesn't support array_append via simple update easily without calling a function or fetching first
    // We'll invoke an RPC if it exists, or fetch-update
    for (const id of ids) {
        const { data } = await supabase.from('notifications').select('read_by').eq('id', id).single();
        const currentReadBy = data?.read_by || [];
        if (!currentReadBy.includes(userId)) {
            await supabase.from('notifications').update({ read_by: [...currentReadBy, userId] }).eq('id', id);
        }
    }
};

export const clearAllNotificationsSQL = async (ministryId: string) => {
    await supabase.from('notifications').delete().eq('ministry_id', ministryId);
};

export const fetchAnnouncementsSQL = async (ministryId: string) => {
    const { data } = await supabase.from('announcements').select('*').eq('ministry_id', ministryId).order('timestamp', { ascending: false });
    return (data || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        message: a.message,
        type: a.type,
        timestamp: a.timestamp,
        expirationDate: a.expiration_date,
        author: a.author,
        readBy: a.read_by || [],
        likedBy: a.liked_by || [],
        ministryId: a.ministry_id
    }));
};

export const createAnnouncementSQL = async (ministryId: string, ann: any, author: string) => {
    await supabase.from('announcements').insert({
        ministry_id: ministryId,
        title: ann.title,
        message: ann.message,
        type: ann.type,
        expiration_date: ann.expirationDate,
        author: author,
        timestamp: new Date().toISOString()
    });
};

export const interactAnnouncementSQL = async (id: string, userId: string, userName: string, action: 'read' | 'like') => {
    const { data } = await supabase.from('announcements').select('read_by, liked_by').eq('id', id).single();
    if (!data) return;

    if (action === 'read') {
        const current = data.read_by || [];
        if (!current.some((r: any) => r.userId === userId)) {
            await supabase.from('announcements').update({ 
                read_by: [...current, { userId, name: userName, timestamp: new Date().toISOString() }] 
            }).eq('id', id);
        }
    } else if (action === 'like') {
        let current = data.liked_by || [];
        if (current.some((l: any) => l.userId === userId)) {
            current = current.filter((l: any) => l.userId !== userId);
        } else {
            current.push({ userId, name: userName });
        }
        await supabase.from('announcements').update({ liked_by: current }).eq('id', id);
    }
};

// Swaps
export const fetchSwapRequests = async (ministryId: string) => {
    const { data } = await supabase.from('swap_requests').select('*').eq('ministry_id', ministryId);
    return (data || []).map((s: any) => ({
        id: s.id,
        ministryId: s.ministry_id,
        requesterName: s.requester_name,
        requesterId: s.requester_id,
        role: s.role,
        eventIso: s.event_iso,
        eventTitle: s.event_title,
        status: s.status,
        createdAt: s.created_at
    }));
};

export const createSwapRequestSQL = async (ministryId: string, req: any) => {
    const { error } = await supabase.from('swap_requests').insert({
        ministry_id: ministryId,
        requester_name: req.requesterName,
        requester_id: req.requesterId,
        role: req.role,
        event_iso: req.eventIso,
        event_title: req.eventTitle,
        status: 'pending'
    });
    return !error;
};

export const performSwapSQL = async (ministryId: string, reqId: string, acceptorName: string, acceptorId: string) => {
    // 1. Get request
    const { data: req } = await supabase.from('swap_requests').select('*').eq('id', reqId).single();
    if (!req) return { success: false, message: "Request not found" };

    // 2. Update schedule
    // Find event id
    const { data: evt } = await supabase.from('events').select('id').eq('ministry_id', ministryId).eq('date_time', req.event_iso).single();
    if (evt) {
        await supabase.from('schedule_assignments').update({ member_name: acceptorName, member_id: acceptorId, confirmed: false })
            .eq('event_id', evt.id).eq('role', req.role);
    }

    // 3. Close request
    await supabase.from('swap_requests').update({ status: 'approved' }).eq('id', reqId);
    
    return { success: true, message: "Swap successful" };
};

// Repertoire
export const fetchRepertoire = async (ministryId: string) => {
    const { data } = await supabase.from('repertoire').select('*').eq('ministry_id', ministryId);
    return (data || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        link: r.link,
        date: r.date, // format YYYY-MM-DD
        addedBy: r.added_by
    }));
};

export const addToRepertoire = async (ministryId: string, item: any) => {
    const { error } = await supabase.from('repertoire').insert({
        ministry_id: ministryId,
        title: item.title,
        link: item.link,
        date: item.date,
        added_by: item.addedBy
    });
    return !error;
};

export const deleteFromRepertoire = async (id: string) => {
    await supabase.from('repertoire').delete().eq('id', id);
};

// Push Subs
export const saveSubscriptionSQL = async (ministryId: string, sub: PushSubscription) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // Normalize keys
    const p256dh = sub.toJSON().keys?.p256dh;
    const auth = sub.toJSON().keys?.auth;

    await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint: sub.endpoint,
        p256dh,
        auth,
        ministry_id: ministryId
    }, { onConflict: 'endpoint' });
};

export const fetchGlobalSchedules = async (monthIso: string, currentMinistryId: string): Promise<GlobalConflictMap> => {
    // This requires querying across ministries.
    // If RLS allows, we can query assignments for other ministries.
    return {};
};

export const fetchRankingData = async (ministryId: string): Promise<RankingEntry[]> => {
    // Mock implementation or real logic
    // Usually requires aggregation.
    return [];
};

// --- Re-export monthly stats report from provided snippet ---
export const fetchMonthlyStatsReport = async (ministryId: string, monthIso: string): Promise<MemberMonthlyStat[]> => {
    // 1. Setup Mock Data if needed
    if (!supabase) {
        // ... (mock data removed for brevity in recreation, but logic should be here if offline)
        return [];
    }

    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const startDate = `${monthIso}-01T00:00:00`;
    const [y, m] = monthIso.split('-').map(Number);
    const nextMonth = new Date(y, m, 1).toISOString();

    try {
        // 2. Fetch Members
        const { data: members } = await supabase.from('profiles')
            .select('id, name, avatar_url, functions')
            .or(`ministry_id.eq.${cleanMid},allowed_ministries.cs.{${cleanMid}}`);

        if (!members) return [];

        // 3. Fetch Events in Month
        const { data: events } = await supabase.from('events')
            .select('id')
            .eq('ministry_id', cleanMid)
            .gte('date_time', startDate)
            .lt('date_time', nextMonth);
        
        const eventIds = events?.map((e: any) => e.id) || [];

        // 4. Fetch Assignments (Schedule & Attendance)
        let assignments: any[] = [];
        if (eventIds.length > 0) {
            const { data } = await supabase.from('schedule_assignments')
                .select('member_id, confirmed')
                .in('event_id', eventIds);
            assignments = data || [];
        }

        // 5. Fetch Swap Requests in Month (using event date reference)
        let swaps: any[] = [];
        const { data: swapsData } = await supabase.from('swap_requests')
            .select('requester_id')
            .eq('ministry_id', cleanMid)
            .gte('event_iso', startDate)
            .lt('event_iso', nextMonth);
        swaps = swapsData || [];

        // 6. Aggregate Data
        const stats: MemberMonthlyStat[] = members.map((member: any) => {
            const myAssignments = assignments.filter((a: any) => a.member_id === member.id);
            const mySwaps = swaps.filter((s: any) => s.requester_id === member.id);

            const totalScheduled = myAssignments.length;
            const totalConfirmed = myAssignments.filter((a: any) => a.confirmed).length;
            const swapsRequested = mySwaps.length;

            const attendanceRate = totalScheduled > 0 
                ? Math.round((totalConfirmed / totalScheduled) * 100) 
                : 0;

            // Simple Engagement Algorithm
            let engagementScore: 'High' | 'Medium' | 'Low' = 'High';
            if (totalScheduled > 0) {
                if (attendanceRate < 70 || swapsRequested > 1) engagementScore = 'Low';
                else if (attendanceRate < 90 || swapsRequested > 0) engagementScore = 'Medium';
            } else {
                engagementScore = 'Medium'; // Neutral if not scheduled
            }

            // Determine main role (first one for display)
            const mainRole = member.functions && member.functions.length > 0 ? member.functions[0] : 'Membro';

            return {
                memberId: member.id,
                name: member.name,
                avatar_url: member.avatar_url,
                totalScheduled,
                totalConfirmed,
                swapsRequested,
                attendanceRate,
                engagementScore,
                mainRole
            };
        });

        // Sort by Scheduled Count (Desc) then Name
        return stats.sort((a, b) => b.totalScheduled - a.totalScheduled || a.name.localeCompare(b.name));

    } catch (e) {
        console.error("Error fetching admin stats:", e);
        return [];
    }
};