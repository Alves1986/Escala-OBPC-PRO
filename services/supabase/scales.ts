import { getSupabase } from './client';

export const fetchScheduleAssignments = async (ministryId: string, month: string, orgId?: string) => {
    const sb = getSupabase();
    if (!sb || !orgId) throw new Error("Missing dependencies");

    const { data: assignments, error } = await sb.from('schedule_assignments')
        .select('*, profiles(name)')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId);

    if (error) throw error;

    const schedule: any = {};
    const attendance: any = {};

    assignments?.forEach((a: any) => {
        const ruleId = a.event_rule_id;
        const dateStr = a.event_date;
        
        if (ruleId && dateStr) {
            const key = `${ruleId}_${dateStr}_${a.role}`;
            const profile = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
            const name = profile?.name;

            if (name) schedule[key] = name;
            if (a.confirmed) attendance[key] = true;
        }
    });

    return { schedule, attendance };
};

export const saveScheduleAssignment = async (ministryId: string, orgId: string, eventKey: string, role: string, memberId: string, memberName: string) => {
    const sb = getSupabase();
    if (!sb) return;
    
    let ruleId = eventKey;
    let dateStr = "";
    
    if (eventKey.includes('_20')) {
        const parts = eventKey.split('_');
        ruleId = parts[0];
        dateStr = parts[1];
    }

    if (!dateStr) return;

    const { error } = await sb.from('schedule_assignments').upsert({
        organization_id: orgId,
        ministry_id: ministryId,
        event_rule_id: ruleId,
        event_date: dateStr,
        role: role,
        member_id: memberId,
        confirmed: false
    }, { onConflict: 'organization_id,ministry_id,event_rule_id,event_date,role' });
    
    if (error) throw error;
};

export const removeScheduleAssignment = async (ministryId: string, orgId: string, logicalKey: string) => {
    const sb = getSupabase();
    if (!sb) return;
    
    const parts = logicalKey.split('_');
    if (parts.length < 3) return;
    
    const ruleId = parts[0];
    const dateStr = parts[1];
    const role = parts.slice(2).join('_');
    
    await sb.from('schedule_assignments').delete()
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .eq('event_rule_id', ruleId)
        .eq('event_date', dateStr)
        .eq('role', role);
};

export const toggleAssignmentConfirmation = async (ministryId: string, orgId: string, key: string) => {
    const sb = getSupabase();
    if (!sb) return;
    
    const parts = key.split('_');
    const ruleId = parts[0];
    const dateStr = parts[1];
    const role = parts.slice(2).join('_');

    const { data } = await sb.from('schedule_assignments')
        .select('confirmed')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .eq('event_rule_id', ruleId)
        .eq('event_date', dateStr)
        .eq('role', role)
        .single();
        
    if (data) {
        await sb.from('schedule_assignments')
            .update({ confirmed: !data.confirmed })
            .eq('organization_id', orgId)
            .eq('ministry_id', ministryId)
            .eq('event_rule_id', ruleId)
            .eq('event_date', dateStr)
            .eq('role', role);
    }
};

export const clearScheduleForMonth = async (ministryId: string, orgId: string, month: string) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('schedule_assignments')
        .delete()
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .ilike('event_date', `${month}%`);
};

export const fetchGlobalSchedules = async (month: string, ministryId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return {};
    
    const { data } = await sb.from('schedule_assignments')
        .select('ministry_id, event_date, role, profiles(name)')
        .eq('organization_id', orgId)
        .neq('ministry_id', ministryId)
        .ilike('event_date', `${month}%`);
        
    const conflicts: any = {};
    data?.forEach((row: any) => {
        const name = row.profiles?.name?.trim().toLowerCase();
        if (name) {
            if (!conflicts[name]) conflicts[name] = [];
            conflicts[name].push({
                ministryId: row.ministry_id,
                eventIso: row.event_date,
                role: row.role
            });
        }
    });
    return conflicts;
};
