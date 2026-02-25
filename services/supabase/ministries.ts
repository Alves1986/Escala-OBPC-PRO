import { getSupabase } from './client';
import { Organization, MinistryDef, MinistrySettings } from '../../types';

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
