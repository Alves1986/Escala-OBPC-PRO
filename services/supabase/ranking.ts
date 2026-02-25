import { getSupabase } from './client';
import { RankingEntry, RankingHistoryItem } from '../../types';

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
