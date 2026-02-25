import { getSupabase } from './client';

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
