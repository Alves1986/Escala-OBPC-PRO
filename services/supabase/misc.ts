import { getSupabase, serviceOrgId } from './client';
import { TeamMemberProfile } from '../../types';

export const fetchSwapRequests = async (ministryId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return [];
    const { data } = await sb.from('swap_requests')
        .select('*')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .eq('status', 'pending');
    return data || [];
};

export const createSwapRequestSQL = async (ministryId: string, orgId: string, request: any) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('swap_requests').insert({
        organization_id: orgId,
        ministry_id: ministryId,
        requester_id: request.requesterId,
        requester_name: request.requesterName,
        role: request.role,
        event_datetime: request.eventIso,
        event_title: request.eventTitle,
        status: 'pending'
    });
};

export const performSwapSQL = async (ministryId: string, orgId: string, reqId: string, takenByName: string, takenById: string) => {
    const sb = getSupabase();
    if (!sb) return;
    
    const { data: req } = await sb.from('swap_requests').select('*').eq('id', reqId).eq('organization_id', orgId).single();
    if (!req) return;
    
    const datePart = req.event_datetime.split('T')[0];
    
    const { data: assignment } = await sb.from('schedule_assignments')
        .select('id, event_rule_id')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .eq('event_date', datePart)
        .eq('role', req.role)
        .eq('member_id', req.requester_id)
        .single();
        
    if (assignment) {
        await sb.from('schedule_assignments').update({
            member_id: takenById,
            confirmed: false
        }).eq('id', assignment.id);
        
        await sb.from('swap_requests').update({
            status: 'completed',
            taken_by_id: takenById
        }).eq('id', reqId).eq('organization_id', orgId);
    }
};

export const cancelSwapRequestSQL = async (reqId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('swap_requests').update({ status: 'cancelled' }).eq('id', reqId).eq('organization_id', orgId);
};

export const updateMemberData = async (memberId: string, orgId: string, data: any) => {
    const sb = getSupabase();
    if (!sb) return;
    
    const profileUpdates: any = {};
    if (data.name) profileUpdates.name = data.name;
    if (data.whatsapp) profileUpdates.whatsapp = data.whatsapp;
    
    if (Object.keys(profileUpdates).length > 0) {
        await sb.from('profiles').update(profileUpdates).eq('id', memberId).eq('organization_id', orgId);
    }
    
    if (data.roles && data.ministryId) {
        await sb.from('organization_memberships')
            .update({ functions: data.roles })
            .eq('profile_id', memberId)
            .eq('ministry_id', data.ministryId)
            .eq('organization_id', orgId);
    }
};

export const deleteMember = async (ministryId: string, orgId: string, memberId: string, memberName: string) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('organization_memberships')
        .delete()
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .eq('profile_id', memberId);
};

export const toggleAdminSQL = async (email: string, isAdmin: boolean, ministryId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return;

    const { data: profile } = await sb
        .from('profiles')
        .select('id')
        .eq('email', email)
        .eq('organization_id', orgId)
        .maybeSingle();

    if (!profile?.id) return;

    await sb.from('organization_memberships')
        .update({ role: isAdmin ? 'admin' : 'member' })
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .eq('profile_id', profile.id);

    await sb.from('profiles').update({ is_admin: isAdmin }).eq('id', profile.id).eq('organization_id', orgId);
};

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

export const fetchUserFunctions = async (userId: string, ministryId: string, orgId?: string): Promise<string[]> => {
  const sb = getSupabase();
  if (!sb || !orgId) return [];

  const { data } = await sb
    .from('organization_memberships')
    .select('functions')
    .eq('profile_id', userId)
    .eq('ministry_id', ministryId)
    .eq('organization_id', orgId)
    .maybeSingle();

  return (data && Array.isArray(data.functions)) ? data.functions : [];
};

export const filterRolesBySettings = async (roles: string[], ministryId: string, orgId: string): Promise<string[]> => {
    const sb = getSupabase();
    if (!sb) return roles;

    if (!roles || roles.length === 0) return [];

    const { data: settings } = await sb.from('ministry_settings')
        .select('roles')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId)
        .maybeSingle();

    const dbRoles = settings?.roles;

    if (!dbRoles || !Array.isArray(dbRoles) || dbRoles.length === 0) {
        return roles;
    }

    return roles.filter(r => dbRoles.includes(r));
};

export const fetchMinistryMembers = async (ministryId: string, orgId?: string) => {
  const sb = getSupabase();
  if (!sb || !orgId) return { memberMap: {}, publicList: [] };

  const { data: memberships, error } = await sb
    .from('organization_memberships')
    .select(`profile_id, functions, role, profiles (id, name, email, avatar_url, whatsapp, birth_date, is_admin)`)
    .eq('ministry_id', ministryId)
    .eq('organization_id', orgId);

  if (error) throw error;

  const memberMap: Record<string, string[]> = {};
  const publicList: TeamMemberProfile[] = [];

  memberships?.forEach((m: any) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    if (!p) return;

    const rawFunctions = Array.isArray(m.functions) ? m.functions : [];
    
    publicList.push({
      id: p.id,
      name: p.name,
      email: p.email,
      avatar_url: p.avatar_url,
      whatsapp: p.whatsapp,
      birthDate: p.birth_date,
      isAdmin: m.role === 'admin',
      roles: rawFunctions, 
      organizationId: orgId
    });

    rawFunctions.forEach((fn: string) => {
      if (!memberMap[fn]) memberMap[fn] = [];
      memberMap[fn].push(p.name);
    });
  });

  return { memberMap, publicList };
};

export const updateProfileMinistry = async (userId: string, ministryId: string) => {
    const sb = getSupabase();
    if (!sb || !serviceOrgId) return;
    await sb.from('profiles').update({ ministry_id: ministryId })
        .eq('id', userId)
        .eq('organization_id', serviceOrgId);
};
