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
    
    await sb.from('profiles').update(updates).eq('id', user.id).eq('organization_id', orgId); // CORREÇÃO: Isolamento multi-tenant
    
    if (functions && ministryId) {
        await sb.from('organization_memberships')
            .update({ functions })
            .eq('profile_id', user.id)
            .eq('ministry_id', ministryId)
            .eq('organization_id', orgId);
    }
};

