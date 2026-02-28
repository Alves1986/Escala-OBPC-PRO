import { getSupabase } from './client';

export const fetchMemberAvailabilityV2 = async (ministryId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) throw new Error("Supabase client not initialized");

    const { data, error } = await sb
        .from('member_availability')
        .select('user_id, available_date, period, note')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId);

    if (error) throw error;

    const map: Record<string, string[]> = {};
    const notes: Record<string, string> = {};

    data?.forEach((row: any) => {
        if (!map[row.user_id]) map[row.user_id] = [];

        if (!row.available_date && row.note === 'BLOCKED_MONTH' && row.period) {
            const monthBlockKey = `${row.period}-BLK`;
            map[row.user_id].push(monthBlockKey);
            notes[`${row.user_id}_${row.period}-00`] = row.note;
            return;
        }

        if (!row.available_date) return;

        const baseDate = row.available_date;
        const key = row.note && ['M', 'N', 'T'].includes(row.note)
            ? `${baseDate}_${row.note}`
            : baseDate;
        map[row.user_id].push(key);

        if (row.note && !['M', 'N', 'T', 'BLOCKED_MONTH'].includes(row.note)) {
            const monthKey = baseDate.substring(0, 7) + '-00';
            notes[`${row.user_id}_${monthKey}`] = row.note;
        }
    });

    console.log("[FETCH_MONTH_BLOCK]", data);

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

    const { error: delErrorByDate } = await sb
        .from('member_availability')
        .delete()
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .eq('user_id', userId)
        .gte('available_date', `${targetMonth}-01`)
        .lt('available_date', `${nextMonth}-01`);

    if (delErrorByDate) throw delErrorByDate;

    const { error: delErrorByPeriod } = await sb
        .from('member_availability')
        .delete()
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .eq('user_id', userId)
        .eq('period', targetMonth);

    if (delErrorByPeriod) throw delErrorByPeriod;

    const uniqueDates = [...new Set(dates.filter(d => d.startsWith(targetMonth)))];

    if (uniqueDates.length > 0) {
        const rows = uniqueDates.map(dateString => {
            if (dateString === `${targetMonth}-BLK`) {
                const payload = {
                    organization_id: orgId,
                    ministry_id: ministryId,
                    user_id: userId,
                    available_date: null,
                    period: targetMonth,
                    note: 'BLOCKED_MONTH'
                };

                console.log("[SAVE_MONTH_BLOCK]", payload);
                return payload;
            }

            const [dateOnly, periodTag] = dateString.split('_');
            console.log("[AV_SAVE_PERIOD]", dateString, dateOnly, periodTag);

            return {
                organization_id: orgId,
                ministry_id: ministryId,
                user_id: userId,
                available_date: dateOnly,
                period: dateOnly.substring(0, 7),
                note: periodTag ?? null
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
