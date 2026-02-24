import { MinistrySettings, MinistryDef, TeamMemberProfile, Organization } from '../../types';
import { getSupabase } from './client';

const filterRolesBySettings = async (roles: string[], ministryId: string, orgId: string): Promise<string[]> => {
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

export const fetchOrganizationDetails = async (orgId: string): Promise<Organization | null> => {
    const sb = getSupabase();
    if (!sb || !orgId) return null;

    const { data, error } = await sb
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single();

    if (error) {
        console.error("Error fetching organization details:", error);
        return null;
    }
    return data;
};

export const fetchOrganizationMinistries = async (orgId?: string): Promise<MinistryDef[]> => {
    const sb = getSupabase();
    if (!sb || !orgId) return [];

    const { data, error } = await sb
        .from('organization_ministries')
        .select('id, code, label') 
        .eq('organization_id', orgId);

    if (error) {
        throw error;
    }

    return (data || []).map((m: any) => ({
        id: m.id,
        code: m.code || m.id,
        label: m.label || 'Sem nome', 
        organizationId: orgId
    }));
};

export const fetchUserAllowedMinistries = async (userId: string, orgId?: string): Promise<string[]> => {
    const sb = getSupabase();
    if (!sb || !orgId) return [];
    
    const { data: members, error } = await sb.from('organization_memberships')
        .select('ministry_id')
        .eq('profile_id', userId)
        .eq('organization_id', orgId);
        
    if (error) throw error;
    if (!members || members.length === 0) return [];

    const ministryIds = members.map((m: any) => m.ministry_id);

    const { data: validMinistries } = await sb.from('organization_ministries')
        .select('id')
        .eq('organization_id', orgId)
        .in('id', ministryIds);

    return validMinistries?.map((m: any) => m.id) || [];
};

export const fetchMinistrySettings = async (ministryId: string, orgId?: string): Promise<MinistrySettings | null> => {
    const sb = getSupabase();
    if (!sb || !ministryId || !orgId) return null;

    const { data: ministryDef } = await sb.from('organization_ministries')
        .select('label, availability_start, availability_end') 
        .eq('id', ministryId)
        .eq('organization_id', orgId)
        .maybeSingle();

    const { data: settings } = await sb.from('ministry_settings')
        .select('*')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId)
        .maybeSingle();
    
    const result = {
        id: settings?.id,
        organizationMinistryId: ministryId, 
        displayName: ministryDef?.label || settings?.display_name || 'Ministério',
        roles: settings?.roles || [],
        availabilityStart: ministryDef?.availability_start,
        availabilityEnd: ministryDef?.availability_end,
        organizationId: orgId,
        spotifyClientId: settings?.spotify_client_id,
        spotifyClientSecret: settings?.spotify_client_secret
    };

    return result;
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
      isAdmin: p.is_admin || m.role === 'admin',
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

// --- ANNOUNCEMENTS LOGIC (HARDENED) ---

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

export const fetchOrganizationsWithStats = async () => {
    const sb = getSupabase();
    if (!sb) return [];
    const { data, error } = await sb.from('organizations').select(`*, organization_ministries (id, code, label), profiles (count)`);
    if (error) throw error;
    return (data || []).map((o: any) => ({
        id: o.id, name: o.name, slug: o.slug, active: o.active, createdAt: o.created_at,
        userCount: o.profiles?.[0]?.count || 0,
        ministryCount: o.organization_ministries?.length || 0,
        ministries: o.organization_ministries?.map((m:any) => ({ id: m.id, code: m.code, label: m.label })) || [],
        // Billing
        plan_type: o.plan_type,
        billing_status: o.billing_status,
        trial_ends_at: o.trial_ends_at,
        access_locked: o.access_locked,
        checkout_url: o.checkout_url
    }));
};

export const saveOrganization = async (id: string | null, name: string, slug: string, billing?: any) => {
    const sb = getSupabase();
    if (!sb) return { success: false, message: "Sem conexão" };
    
    const payload: any = { name, slug };
    if (billing) {
        if(billing.plan_type) payload.plan_type = billing.plan_type;
        if(billing.billing_status) payload.billing_status = billing.billing_status;
        if(billing.trial_ends_at) payload.trial_ends_at = billing.trial_ends_at;
        if(billing.checkout_url) payload.checkout_url = billing.checkout_url;
        if(billing.access_locked !== undefined) payload.access_locked = billing.access_locked;
    }

    if (id) {
        const { error } = await sb.from('organizations').update(payload).eq('id', id);
        return error ? { success: false, message: error.message } : { success: true, message: "Atualizado" };
    } else {
        const { error } = await sb.from('organizations').insert(payload);
        return error ? { success: false, message: error.message } : { success: true, message: "Criado" };
    }
};

export const toggleOrganizationStatus = async (id: string, active: boolean) => {
    const sb = getSupabase();
    if (!sb) return false;
    // FIX: Send new status
    const { error } = await sb.from('organizations').update({ active }).eq('id', id);
    return !error;
};

export const saveOrganizationMinistry = async (orgId: string, code: string, label: string) => {
    const sb = getSupabase();
    if (!sb) return { success: false, message: "Sem conexão" };
    const { error } = await sb.from('organization_ministries').upsert({ organization_id: orgId, code, label }, { onConflict: 'organization_id, code' });
    return error ? { success: false, message: error.message } : { success: true, message: "Salvo" };
};

export const deleteOrganizationMinistry = async (orgId: string, code: string) => {
    const sb = getSupabase();
    if (!sb) return { success: false, message: "Sem conexão" };
    const { error = null } = await sb.from('organization_ministries').delete().eq('organization_id', orgId).eq('code', code);
    return error ? { success: false, message: error.message } : { success: true, message: "Removido" };
};

export const updateMemberData = async (memberId: string, orgId: string, data: any) => {
    const sb = getSupabase();
    if (!sb) return;
    
    const profileUpdates: any = {};
    if (data.name) profileUpdates.name = data.name;
    if (data.whatsapp) profileUpdates.whatsapp = data.whatsapp;
    
    if (Object.keys(profileUpdates).length > 0) {
        await sb.from('profiles').update(profileUpdates).eq('id', memberId).eq('organization_id', orgId); // CORREÇÃO: Isolamento multi-tenant
    }
    
    if (data.roles && data.ministryId) {
        await sb.from('organization_memberships')
            .update({ functions: data.roles })
            .eq('profile_id', memberId)
            .eq('ministry_id', data.ministryId)
            .eq('organization_id', orgId);
    }
};

export const toggleAdminSQL = async (email: string, isAdmin: boolean, ministryId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('profiles').update({ is_admin: isAdmin }).eq('email', email).eq('organization_id', orgId);
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

export const updateProfileMinistry = async (userId: string, ministryId: string) => {
    const sb = getSupabase();
    if (!sb || !serviceOrgId) return;
    await sb.from('profiles').update({ ministry_id: ministryId })
        .eq('id', userId)
        .eq('organization_id', serviceOrgId);
};

export const joinMinistry = async (ministryId: string, orgId: string, roles: string[]) => {
    const sb = getSupabase();
    if (!sb) return;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    
    await sb.from('organization_memberships').insert({
        organization_id: orgId,
        ministry_id: ministryId,
        profile_id: user.id,
        role: 'member',
        functions: roles
    });
    
    const { data: profile } = await sb.from('profiles').select('allowed_ministries')
        .eq('id', user.id)
        .eq('organization_id', orgId)
        .single();
    if (profile) {
        const allowed = new Set(profile.allowed_ministries || []);
        allowed.add(ministryId);
        await sb.from('profiles').update({ allowed_ministries: Array.from(allowed) })
            .eq('id', user.id)
            .eq('organization_id', orgId);
    }
};

export const saveMinistrySettings = async (ministryId: string, orgId: string, displayName?: string, roles?: string[], start?: string, end?: string) => {
    const sb = getSupabase();
    if (!sb) return;
    
    const updates: any = {};
    if (displayName) updates.display_name = displayName;
    if (roles) updates.roles = roles;
    
    if (Object.keys(updates).length > 0) {
        await sb.from('ministry_settings').upsert({
            organization_id: orgId,
            ministry_id: ministryId,
            ...updates
        }, { onConflict: 'organization_id, ministry_id' });
    }
    
    if (start !== undefined || end !== undefined) {
        const minUpdates: any = {};
        if (start !== undefined) minUpdates.availability_start = start;
        if (end !== undefined) minUpdates.availability_end = end;
        
        await sb.from('organization_ministries')
            .update(minUpdates)
            .eq('id', ministryId)
            .eq('organization_id', orgId);
    }
};

