import { getSupabase } from './client';

export const loginWithEmail = async (email: string, pass: string) => {
    const sb = getSupabase();
    if (!sb) return { success: false, message: "Erro: Supabase não inicializado." };
    const { data, error } = await (sb.auth as any).signInWithPassword({ email, password: pass });
    if (error) return { success: false, message: error.message };
    return { success: true, data };
};

export const logout = async () => {
    const sb = getSupabase();
    if (sb) await (sb.auth as any).signOut();
};

export const updateUserProfile = async (name: string, whatsapp: string, avatar_url: string | undefined, functions: string[] | undefined, birthDate: string | undefined, ministryId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    
    const updates: any = { name, whatsapp, birth_date: birthDate };
    if (avatar_url) updates.avatar_url = avatar_url;
    
    await sb.from('profiles').update(updates).eq('id', user.id).eq('organization_id', orgId);
    
    if (functions && ministryId) {
        await sb.from('organization_memberships')
            .update({ functions })
            .eq('profile_id', user.id)
            .eq('ministry_id', ministryId)
            .eq('organization_id', orgId);
    }
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

    const decodedData = data;
    console.log("TOKEN DATA", decodedData);

    const normalizedData = {
        ...decodedData,
        ministryId:
            decodedData.ministryId ??
            decodedData.ministry_id ??
            decodedData.ministry ??
            null,
        orgId:
            decodedData.orgId ??
            decodedData.organization_id ??
            decodedData.org_id ??
            decodedData.organization ??
            null
    };

    console.log("INVITE DATA FINAL", normalizedData);

    return {
        valid: true,
        data: normalizedData
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
