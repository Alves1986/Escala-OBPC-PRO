import { RankingEntry, RankingHistoryItem } from '../../types';
import { getSupabase } from './client';

export const fetchRankingData = async (ministryId: string, orgId?: string): Promise<RankingEntry[]> => {
    const sb = getSupabase();
    if (!sb || !orgId) throw new Error("Missing dependencies");
    
    const { data: memberships } = await sb.from('organization_memberships')
        .select('profile_id')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId);

    if (!memberships || memberships.length === 0) return [];
    const userIds = memberships.map((m: any) => m.profile_id);

    const { data: members } = await sb.from('profiles')
        .select('id, name, avatar_url')
        .in('id', userIds)
        .eq('organization_id', orgId);
        
    const today = new Date().toISOString().slice(0, 10);

    const [assignmentsRes, swapsRes, interactionsRes] = await Promise.all([
        sb.from('schedule_assignments').select('member_id, event_date, role').eq('organization_id', orgId).eq('ministry_id', ministryId).eq('confirmed', true).lte('event_date', today),
        sb.from('swap_requests').select('requester_id, created_at').eq('organization_id', orgId).eq('ministry_id', ministryId),
        sb.from('announcement_interactions').select('user_id, interaction_type, created_at').eq('organization_id', orgId).in('user_id', userIds)
    ]) as any;

    const assignments = assignmentsRes.data || [];
    const swaps = swapsRes.data || [];
    const interactions = interactionsRes.data || [];

    return (members || []).map((m: any) => {
        let points = 0;
        const history: RankingHistoryItem[] = [];

        const memberAssignments = assignments.filter((a: any) => a.member_id === m.id);
        points += memberAssignments.length * 100;
        memberAssignments.forEach((a: any) => history.push({ id: `assign-${a.member_id}-${a.event_date}`, date: a.event_date, description: `Escala Confirmada: ${a.role}`, points: 100, type: 'assignment' }));

        const memberSwaps = swaps.filter((s: any) => s.requester_id === m.id);
        points -= memberSwaps.length * 50;
        memberSwaps.forEach((s: any) => history.push({ id: `swap-${s.requester_id}-${s.created_at}`, date: s.created_at, description: `Solicitou Troca`, points: -50, type: 'swap_penalty' }));

        const memberReads = interactions.filter((i: any) => i.user_id === m.id && i.interaction_type === 'read');
        points += memberReads.length * 5;

        const memberLikes = interactions.filter((i: any) => i.user_id === m.id && i.interaction_type === 'like');
        points += memberLikes.length * 10;

        if (points < 0) points = 0;
        history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return {
            memberId: m.id,
            name: m.name,
            avatar_url: m.avatar_url,
            points, 
            stats: { 
                confirmedEvents: memberAssignments.length, 
                missedEvents: 0, 
                swapsRequested: memberSwaps.length, 
                announcementsRead: memberReads.length, 
                announcementsLiked: memberLikes.length 
            },
            history
        };
    });
};

export const createInviteToken = async (ministryId: string, orgId: string, label?: string) => {
    const sb = getSupabase();
    if (!sb) return { success: false };

    const { data: { user } } = await sb.auth.getUser();

    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const payload = { 
        token, 
        organization_id: orgId, 
        ministry_id: ministryId, 
        created_by: user?.id,
        expires_at: expiresAt.toISOString(), 
        used: false
    };

    const { data, error } = await sb.from('invite_tokens').insert(payload).select();
    
    if (error) return { success: false, message: error.message };
    const url = `${window.location.origin}?invite=${token}`;
    return { success: true, url };
};

export const validateInviteToken = async (token: string) => {
    const sb = getSupabase();
    if (!sb) return { valid: false };

    const now = new Date().toISOString();

    const { data, error } = await sb
        .from('invite_tokens')
        .select('*')
        .eq('token', token)
        .eq('used', false)
        .gt('expires_at', now)
        .maybeSingle();

    if (error || !data) {
        return { valid: false, message: "Convite inválido, expirado ou já utilizado." };
    }

    return { 
        valid: true, 
        data: { 
            ministryId: data.ministry_id, 
            orgId: data.organization_id, 
            token: data.token
        } 
    };
};

export const registerWithInvite = async (token: string, userData: any) => {
    const sb = getSupabase();
    if (!sb) return { success: false };
    
    const { data: invite } = await sb.from('invite_tokens')
        .select('*')
        .eq('token', token)
        .eq('used', false)
        .single();

    if (!invite) return { success: false, message: "Convite inválido ou já usado" };
    
    const { data: authData, error: authError } = await (sb.auth as any).signUp({
        email: userData.email, password: userData.password,
        options: { data: { full_name: userData.name, ministry_id: invite.ministry_id, organization_id: invite.organization_id } }
    });

    if (authError) return { success: false, message: authError.message };
    const userId = authData.user?.id;
    if (!userId) return { success: false, message: "Erro ao criar usuário" };

    // FORCE MEMBER & NO ADMIN
    await sb.from('profiles').update({ 
        name: userData.name, 
        whatsapp: userData.whatsapp, 
        birth_date: userData.birthDate,
        organization_id: invite.organization_id, 
        ministry_id: invite.ministry_id, 
        allowed_ministries: [invite.ministry_id],
        is_admin: false, 
        is_super_admin: false
    }).eq('id', userId);

    await sb.from('organization_memberships').insert({
        organization_id: invite.organization_id, 
        profile_id: userId, 
        ministry_id: invite.ministry_id, 
        role: 'member', 
        functions: userData.roles || []
    });

    await sb.from('invite_tokens').update({ used: true }).eq('token', token);

    return { success: true };
};

// --- EVENT RULES ---

export const fetchAuditLogs = async (ministryId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return [];
    const { data } = await sb.from('audit_logs')
        .select('*')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .order('created_at', { ascending: false })
        .limit(50);
        
    return (data || []).map((l: any) => ({
        id: l.id,
        date: l.created_at,
        action: l.action,
        details: l.details,
        author: l.author_name,
        organizationId: l.organization_id
    }));
};

