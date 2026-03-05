import { getSupabase, serviceOrgId } from './client';
import { TeamMemberProfile } from '../../types';
import { useAppStore } from '../../store/appStore';

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

    const { data: ministryMember } = await sb
        .from('ministry_members')
        .select('id, profile_id')
        .eq('id', memberId)
        .maybeSingle();

    const profileId = ministryMember?.profile_id || memberId;

    const profileUpdates: any = {};
    if (data.name) profileUpdates.name = data.name;
    if (data.whatsapp) profileUpdates.whatsapp = data.whatsapp;
    
    if (Object.keys(profileUpdates).length > 0) {
        await sb.from('profiles').update(profileUpdates).eq('id', profileId).eq('organization_id', orgId);
    }
    
    if (data.roles && data.ministryId) {
        await sb.from('ministry_members')
            .update({ functions: data.roles })
            .eq('id', memberId)
            .eq('ministry_id', data.ministryId);
    }
};

export const deleteMember = async (ministryId: string, orgId: string, memberId: string, memberName: string) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('ministry_members')
        .delete()
        .eq('ministry_id', ministryId)
        .eq('id', memberId);
};

export const toggleAdminSQL = async (email: string, isAdmin: boolean, ministryId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('profiles').update({ is_admin: isAdmin }).eq('email', email).eq('organization_id', orgId);
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

export const fetchUserFunctions = async (userId: string, ministryId: string, _orgId?: string): Promise<string[]> => {
  const sb = getSupabase();
  if (!sb || !ministryId) return [];

  const { data } = await sb
    .from('ministry_members')
    .select('functions')
    .eq('profile_id', userId)
    .eq('ministry_id', ministryId)
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

  const appState = useAppStore.getState();
  const fallbackMinistry = appState.currentUser?.allowedMinistries?.[0] || appState.availableMinistries?.[0]?.id || '';
  const activeMinistry = ministryId || fallbackMinistry;

  console.log('[fetchMinistryMembers] activeMinistry:', activeMinistry);

  if (!activeMinistry) return { memberMap: {}, publicList: [] };

  const { data: memberships, error } = await sb
    .from("ministry_member_profiles")
    .select("*")
    .eq("ministry_id", activeMinistry)
    .order("name");

  if (error) throw error;

  const normalized = (memberships || []).map((m: any) => ({
    id: m.member_id ?? m.id ?? m.profile_id,
    profile_id: m.profile_id ?? m.id,
    name: m.name ?? (Array.isArray(m.profiles) ? m.profiles[0]?.name : m.profiles?.name) ?? "",
    email: m.email ?? (Array.isArray(m.profiles) ? m.profiles[0]?.email : m.profiles?.email),
    avatar_url: m.avatar_url ?? (Array.isArray(m.profiles) ? m.profiles[0]?.avatar_url : m.profiles?.avatar_url),
    whatsapp: m.whatsapp ?? (Array.isArray(m.profiles) ? m.profiles[0]?.whatsapp : m.profiles?.whatsapp),
    functions: Array.isArray(m.functions)
      ? m.functions
      : Array.isArray(m.roles)
        ? m.roles
        : [],
    role: m.role ?? "member",
    ministry_id: m.ministry_id
  }));

  console.log("members normalized", normalized);

  const memberMap: Record<string, string[]> = {};
  const publicList: TeamMemberProfile[] = [];

  normalized.forEach((m: any) => {
    const profileName = m.name || 'Membro';
    const rawFunctions = Array.isArray(m.functions) ? m.functions : [];

    publicList.push({
      member_id: m.id,
      profile_id: m.profile_id,
      id: m.profile_id,
      name: profileName,
      email: m.email,
      avatar_url: m.avatar_url,
      whatsapp: m.whatsapp,
      role: m.role,
      functions: rawFunctions,
      isAdmin: m.role === 'admin',
      roles: rawFunctions,
      organizationId: orgId
    });

    rawFunctions.forEach((fn: string) => {
      if (!memberMap[fn]) memberMap[fn] = [];
      memberMap[fn].push(profileName);
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
