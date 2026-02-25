import { getSupabase } from './client';

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
        if (!map[row.user_id]) map[row.user_id] = [];
        
        const baseDate = row.available_date;
        const key = row.note ? `${baseDate}_${row.note}` : baseDate;
        map[row.user_id].push(key);
        console.log("[AV_FETCH_PERIOD]", row.available_date, row.note, key);
        
        if (row.note && !['M', 'N', 'T'].includes(row.note)) {
            const monthKey = row.available_date.substring(0, 7) + '-00';
            notes[`${row.user_id}_${monthKey}`] = row.note;
        }
    });

    return { availability: map, notes };
};

export const saveMemberAvailabilityV2 = async (orgId: string, ministryId: string, userId: string, dates: string[], notes: any, targetMonth: string) => {
    const sb = getSupabase();
    if (!sb) throw new Error("Supabase client not initialized");

    const [year, month] = targetMonth.split('-').map(Number);
    const next = new Date(year, month, 1);
    const nextMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;

    console.log("[AV_MONTH_DELETE]", {
        target: targetMonth,
        start: `${targetMonth}-01`,
        end: `${nextMonth}-01`
    });

    const { error: delError } = await sb
        .from('member_availability')
        .delete()
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .eq('user_id', userId)
        .gte('available_date', `${targetMonth}-01`)
        .lt('available_date', `${nextMonth}-01`);

    if (delError) throw delError;

    const uniqueDates = [...new Set(dates.filter(d => d.startsWith(targetMonth)))];

    if (uniqueDates.length > 0) {
        const rows = uniqueDates.map(dateString => {
            const [dateOnly, period] = dateString.split('_');
            console.log("[AV_SAVE_PERIOD]", dateString, dateOnly, period);
            
            return {
                organization_id: orgId,
                ministry_id: ministryId,
                user_id: userId,
                available_date: dateOnly,
                note: period ?? null
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
