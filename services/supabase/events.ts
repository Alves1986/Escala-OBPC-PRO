import { getSupabase } from './client';

export const createEventRule = async (orgId: string, ruleData: any) => {
    const sb = getSupabase();
    if (!sb) throw new Error("No client");
    const formattedTime = ruleData.time.length > 5 ? ruleData.time.substring(0, 5) : ruleData.time;
    const { data, error } = await sb.from('event_rules').insert({
        organization_id: orgId,
        ministry_id: ruleData.ministryId,
        title: ruleData.title,
        type: ruleData.type,
        weekday: ruleData.weekday,
        date: ruleData.date,
        time: formattedTime,
        active: true
    }).select();
    if (error) throw error;
    return data;
};

export const deleteEventRule = async (orgId: string, ruleId: string) => {
    const sb = getSupabase();
    if (!sb) throw new Error("No client");

    const { data: updatedRules, error: updateError } = await sb
        .from('event_rules')
        .update({ active: false })
        .eq('id', ruleId)
        .eq('organization_id', orgId)
        .select('id')
        .limit(1);

    if (!updateError && (updatedRules?.length || 0) > 0) return;

    const { error: deleteError } = await sb
        .from('event_rules')
        .delete()
        .eq('id', ruleId)
        .eq('organization_id', orgId);

    if (deleteError) {
        throw deleteError;
    }
};

export const createMinistryEvent = async (ministryId: string, orgId: string, event: any) => {
    const formattedTime = event.time.length > 5 ? event.time.substring(0, 5) : event.time;
    return createEventRule(orgId, {
        ministryId,
        title: event.title,
        type: 'single',
        date: event.date,
        time: formattedTime
    });
};

export const deleteMinistryEvent = async (ministryId: string, orgId: string, eventIso: string) => {
    const sb = getSupabase();
    if (!sb) return;
    const date = eventIso.split('T')[0];
    const time = eventIso.split('T')[1];
    
    const { data: rules } = await sb.from('event_rules')
        .select('id')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .eq('date', date)
        .eq('time', time)
        .eq('type', 'single');
        
    if (rules && rules.length > 0) {
        await deleteEventRule(orgId, rules[0].id);
    }
};

export const updateMinistryEvent = async (ministryId: string, orgId: string, oldIso: string, newTitle: string, newIso: string, applyToAll: boolean) => {
    const sb = getSupabase();
    if (!sb) return;
};
