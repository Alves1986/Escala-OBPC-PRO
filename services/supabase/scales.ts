import { getSupabase } from './client';

export const fetchScheduleAssignments = async (ministryId: string, month: string, orgId?: string) => {
    const sb = getSupabase();
    if (!sb || !orgId) throw new Error("Missing dependencies");

    const { data: assignments, error } = await sb.from('schedule_assignments')
        .select('*, profiles(name)')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId)
        .like('event_date', `${month}%`);

    if (error) throw error;

    const schedule: any = {};
    const attendance: any = {};

    assignments?.forEach((a: any) => {
        const ruleId = a.event_rule_id;
        const dateStr = a.event_date?.split('T')[0] || a.event_date;
        
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
    if (!sb) return;
    await sb.from('event_rules').update({ active: false }).eq('id', ruleId).eq('organization_id', orgId);
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

    if (!dateStr) {
        throw new Error('[BLOCK_SAVE] event_rule_id ou event_key ausente');
    }

    const cleanDate = dateStr.split('T')[0];
    const savePayload = {
        organization_id: orgId,
        ministry_id: ministryId,
        event_rule_id: ruleId,
        event_key: ruleId,
        event_date: cleanDate,
        role: role,
        member_id: memberId,
        confirmed: false
    };

    console.log('[GLOBAL_SAVE_ASSIGNMENT]', savePayload);

    if (!savePayload.event_rule_id || !savePayload.event_key) {
        console.error('[BLOCKED_SAVE_NO_EVENT_KEY]', savePayload);
        throw new Error('[BLOCK_SAVE] event_rule_id ou event_key ausente');
    }

    const { error } = await sb.from('schedule_assignments').upsert(savePayload, { onConflict: 'organization_id,ministry_id,event_rule_id,event_date,role' });
    
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

// --- AVAILABILITY V2 (NEW MEMBER_AVAILABILITY TABLE) ---

export const fetchMemberAvailabilityV2 = async (ministryId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) throw new Error("Supabase client not initialized");

    const { data, error } = await sb
        .from('member_availability')
        .select('user_id, available_date, note')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId);

    if (error) throw error;

    const map: Record<string, string[]> = {};
    const notes: Record<string, string> = {};

    data?.forEach((row: any) => {
        const partialNote = row.note === '_M' || row.note === '_N' ? row.note : null;
        const finalDate = partialNote ? `${row.available_date}${partialNote}` : row.available_date;

        console.log("[AV_FETCH_FINAL]", {
            date: row.available_date,
            note: row.note,
            final: finalDate
        });

        if (!map[row.user_id]) map[row.user_id] = [];
        map[row.user_id].push(finalDate);
        
        if (row.note && !partialNote) {
            const monthKey = row.available_date.substring(0, 7) + '-00';
            notes[`${row.user_id}_${monthKey}`] = row.note;
        }
    });

    return { availability: map, notes };
};

export const saveMemberAvailabilityV2 = async (orgId: string, ministryId: string, userId: string, dates: string[], notes: any, targetMonth: string) => {
    const sb = getSupabase();
    if (!sb) throw new Error("Supabase client not initialized");

    const { error: delError } = await sb
        .from('member_availability')
        .delete()
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .eq('user_id', userId)
        .ilike('available_date', `${targetMonth}%`);

    if (delError) throw delError;

    const uniqueDates = [...new Set(dates.filter(d => d.startsWith(targetMonth)))];

    if (uniqueDates.length > 0) {
        const rows = uniqueDates.map(originalDate => {
            const savedDate = originalDate.split("_")[0];
            const note = originalDate.endsWith('_M') ? '_M' : originalDate.endsWith('_N') ? '_N' : null;

            console.log("[AV_SAVE_FINAL]", {
                original: originalDate,
                date: savedDate,
                note
            });

            return {
                organization_id: orgId,
                ministry_id: ministryId,
                user_id: userId,
                available_date: savedDate,
                note
            };
        });

        const { error: insError } = await sb
            .from('member_availability')
            .insert(rows);

        if (insError) throw insError;
    }
};

export const fetchMinistryAvailability = async (ministryId: string, orgId: string) => {
    return fetchMemberAvailabilityV2(ministryId, orgId);
};

export const saveMemberAvailability = async (ministryId: string, orgId: string, userId: string, dates: string[], notes: any, monthTarget?: string) => {
    return saveMemberAvailabilityV2(orgId, ministryId, userId, dates, notes, monthTarget || "");
};

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
        // CORREÇÃO: Extração direta do nome sem assumir array
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
