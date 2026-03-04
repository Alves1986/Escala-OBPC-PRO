import { getSupabase } from './client';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

export const updateUserProfile = async (
    name: string,
    whatsapp: string,
    avatar_url: string | undefined,
    functions: string[] | undefined,
    birthDate: string | undefined,
    ministryId: string,
    orgId: string
) => {
    const sb = getSupabase();
    if (!sb) return { success: false, message: 'Supabase não inicializado.' };

    const { data: authUserData, error: authUserError } = await sb.auth.getUser();
    if (authUserError) return { success: false, message: authUserError.message };

    const user = authUserData.user;
    if (!user) return { success: false, message: 'Usuário não autenticado.' };

    const updates: any = {
        name,
        whatsapp,
        birth_date: birthDate || null
    };

    if (avatar_url !== undefined) updates.avatar_url = avatar_url;

    const { error: profileError } = await sb
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .eq('organization_id', orgId);

    if (profileError) return { success: false, message: profileError.message };

    if (functions) {
        const membershipFilter = sb
            .from('organization_memberships')
            .update({ functions })
            .eq('profile_id', user.id)
            .eq('organization_id', orgId);

        const { error: membershipError } = ministryId
            ? await membershipFilter.eq('ministry_id', ministryId)
            : await membershipFilter;

        if (membershipError) return { success: false, message: membershipError.message };
    }

    return { success: true };
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

    if (!invite) return { success: false, message: 'Convite inválido ou já usado' };

    const { data: authData, error: authError } = await (sb.auth as any).signUp({
        email: userData.email,
        password: userData.password,
        options: {
            data: {
                full_name: userData.name,
                organization_id: invite.organization_id,
                ministry_id: invite.ministry_id
            }
        }
    });

    if (authError) return { success: false, message: authError.message };

    const userId = authData.user?.id;
    if (!userId) return { success: false, message: 'Erro ao criar usuário' };

    let profileUpdated = false;
    for (let attempt = 0; attempt < 8; attempt++) {
        const { data: updatedProfile, error: profileUpdateError } = await sb
            .from('profiles')
            .update({
                name: userData.name,
                whatsapp: userData.whatsapp,
                birth_date: userData.birthDate || null
            })
            .eq('id', userId)
            .eq('organization_id', invite.organization_id)
            .select('id')
            .maybeSingle();

        if (profileUpdateError) return { success: false, message: profileUpdateError.message };
        if (updatedProfile?.id) {
            profileUpdated = true;
            break;
        }

        await sleep(350);
    }

    if (!profileUpdated) {
        return { success: false, message: 'Perfil não disponível para atualização após cadastro.' };
    }

    const selectedRoles = Array.isArray(userData.roles) ? userData.roles : [];
    let membershipUpdated = false;

    for (let attempt = 0; attempt < 8; attempt++) {
        const { data: updatedMembership, error: membershipError } = await sb
            .from('organization_memberships')
            .update({ functions: selectedRoles })
            .eq('profile_id', userId)
            .eq('organization_id', invite.organization_id)
            .select('profile_id')
            .maybeSingle();

        if (membershipError) return { success: false, message: membershipError.message };
        if (updatedMembership?.profile_id) {
            membershipUpdated = true;
            break;
        }

        await sleep(350);
    }

    if (!membershipUpdated) {
        return { success: false, message: 'Membro não disponível para atualização de funções após cadastro.' };
    }

    const { error: inviteTokenError } = await sb.from('invite_tokens').update({ used: true }).eq('token', token);
    if (inviteTokenError) {
        return { success: false, message: inviteTokenError.message };
    }

    return { success: true };
};
