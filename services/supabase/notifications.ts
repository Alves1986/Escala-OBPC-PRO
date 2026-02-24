import { Announcement } from '../../types';
import { getSupabase } from './client';

export const fetchNotificationsSQL = async (ministryIds: string[], userId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return [];
    
    const { data: globalNotifs } = await sb.from('notifications')
        .select('*')
        .eq('organization_id', orgId)
        .in('ministry_id', ministryIds)
        .order('created_at', { ascending: false })
        .limit(20);
        
    const { data: reads } = await sb.from('notification_reads')
        .select('notification_id')
        .eq('user_id', userId);
        
    const readSet = new Set(reads?.map((r: any) => r.notification_id));
    
    return (globalNotifs || []).map((n: any) => ({
        id: n.id,
        ministryId: n.ministry_id,
        organizationId: n.organization_id,
        title: n.title,
        message: n.message,
        type: n.type,
        timestamp: n.created_at,
        read: readSet.has(n.id),
        actionLink: n.action_link
    }));
};

export const sendNotificationSQL = async (ministryId: string, orgId: string, notification: any) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('notifications').insert({
        organization_id: orgId,
        ministry_id: ministryId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        action_link: notification.actionLink
    });
};

export const markNotificationsReadSQL = async (ids: string[], userId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    
    const inserts = ids.map(id => ({
        user_id: userId,
        notification_id: id,
        organization_id: orgId
    }));
    
    await sb.from('notification_reads').upsert(inserts, { onConflict: 'user_id, notification_id' });
};

export const clearAllNotificationsSQL = async (ministryId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('notifications').delete().eq('organization_id', orgId).eq('ministry_id', ministryId);
};

export const createAnnouncementSQL = async (ministryId: string, orgId: string, announcement: any, authorName: string) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('announcements').insert({
        organization_id: orgId,
        ministry_id: ministryId,
        title: announcement.title,
        message: announcement.message,
        type: announcement.type,
        expiration_date: announcement.expirationDate,
        author_name: authorName
    });
};

export const fetchAnnouncementsSQL = async (ministryId: string, orgId?: string) => {
    const sb = getSupabase();
    if (!sb || !orgId) throw new Error("Missing dependencies");

    const now = new Date().toISOString();

    const { data: announcements, error } = await sb.from('announcements')
        .select('*')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId)
        .or(`expiration_date.is.null,expiration_date.gte.${now}`)
        .order('created_at', { ascending: false });

    if (error) throw error;

    if (!announcements || announcements.length === 0) return [];

    const announcementIds = announcements.map((a: any) => a.id);
    
    // HARDENING: Tenant isolation for interactions
    const { data: interactions, error: intError } = await sb.from('announcement_interactions')
        .select('announcement_id, user_id, interaction_type, created_at, profiles(name)')
        .in('announcement_id', announcementIds)
        .eq('organization_id', orgId);

    if (intError) console.error("ANN INTERACTIONS FETCH ERROR", intError);

    return announcements.map((a: any) => {
        const myInteractions = interactions ? interactions.filter((i: any) => i.announcement_id === a.id) : [];
        
        return {
            id: a.id,
            title: a.title,
            message: a.message,
            type: a.type,
            timestamp: a.created_at,
            expirationDate: a.expiration_date,
            author: a.author_name || 'Admin',
            readBy: myInteractions
                .filter((i: any) => i.interaction_type === 'read')
                .map((i: any) => ({
                    userId: i.user_id,
                    name: i.profiles?.name || 'Usuário',
                    timestamp: i.created_at
                })),
            likedBy: myInteractions
                .filter((i: any) => i.interaction_type === 'like')
                .map((i: any) => ({
                    userId: i.user_id,
                    name: i.profiles?.name || 'Usuário',
                    timestamp: i.created_at
                }))
        };
    });
};

export const interactAnnouncementSQL = async (id: string, userId: string, userName: string, action: 'read'|'like', orgId: string) => {
    const sb = getSupabase();
    if (!sb) throw new Error("No Supabase client");

    // Validate Profile
    const { data: profile } = await sb.from('profiles').select('id').eq('id', userId).maybeSingle();
    if (!profile) {
        await sb.from('profiles').upsert({ 
            id: userId, 
            name: userName, 
            organization_id: orgId 
        }, { onConflict: 'id', ignoreDuplicates: true });
    }

    if (action === 'like') {
        const { data: existing, error: checkError } = await sb.from('announcement_interactions')
            .select('id')
            .eq('announcement_id', id)
            .eq('user_id', userId)
            .eq('organization_id', orgId)
            .eq('interaction_type', 'like')
            .maybeSingle();

        if (checkError) throw checkError;

        if (existing) {
            const { error: delError } = await sb.from('announcement_interactions')
                .delete()
                .eq('id', existing.id)
                .eq('organization_id', orgId); // Hardened multi-tenant isolation
            if (delError) throw delError;
        } else {
            const { error: insertError } = await sb.from('announcement_interactions').insert({
                announcement_id: id,
                user_id: userId,
                organization_id: orgId,
                interaction_type: 'like'
            });
            if (insertError) throw insertError;
        }
    } else {
        const { error: upsertError } = await sb.from('announcement_interactions').upsert({
            announcement_id: id,
            user_id: userId,
            organization_id: orgId,
            interaction_type: 'read'
        }, {
            onConflict: 'announcement_id,user_id,interaction_type'
        });
        if (upsertError) throw upsertError;
    }
};

// --- RANKING LOGIC (HARDENED) ---

