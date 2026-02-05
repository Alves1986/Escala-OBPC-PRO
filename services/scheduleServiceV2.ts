import { getSupabase } from "./supabaseService";

export interface EventRuleV2 {
  id: string;
  title: string;
  type: "weekly" | "single";
  weekday?: number;
  date?: string;
  time: string;
}

export interface AssignmentV2 {
  id?: string;
  event_key: string;
  event_date: string;
  role: string;
  member_id: string;
  member_name?: string;
  confirmed: boolean;
}

export interface OccurrenceV2 {
  ruleId: string;
  date: string;
  time: string;
  title: string;
  iso: string;
}

export interface MemberV2 {
  id: string;
  name: string;
  avatar_url?: string;
  roles?: string[];
}

export const fetchRulesV2 = async (
  ministryId: string,
  orgId: string
): Promise<EventRuleV2[]> => {
  const sb = getSupabase();
  if (!sb) throw new Error("NO_SUPABASE");

  const { data, error } = await sb
    .from("event_rules")
    .select("*")
    .eq("organization_id", orgId)
    .eq("ministry_id", ministryId)
    .eq("active", true);

  if (error) throw error;

  return (data || []).map((r: any) => ({
    id: r.id,
    title: r.title,
    type: r.type,
    weekday: r.weekday,
    date: r.date,
    time: r.time
  }));
};

export const fetchAssignmentsV2 = async (
  ministryId: string,
  orgId: string,
  monthStr: string
): Promise<AssignmentV2[]> => {
  const sb = getSupabase();
  if (!sb) throw new Error("NO_SUPABASE");

  const { data, error } = await sb
    .from("schedule_assignments")
    .select('id,event_key,event_date,role,member_id,confirmed')
    .eq("ministry_id", ministryId)
    .eq("organization_id", orgId)
    .like("event_date", `${monthStr}%`);

  if (error) throw error;

  return (data || []).map((a: any) => ({
    id: a.id,
    event_key: a.event_key,
    event_date: a.event_date,
    role: a.role,
    member_id: a.member_id,
    member_name: a.profiles?.name,
    confirmed: a.confirmed
  }));
};

export const fetchMembersV2 = async (
  ministryId: string,
  orgId: string
): Promise<MemberV2[]> => {
  const sb = getSupabase();
  if (!sb) throw new Error("NO_SUPABASE");

  const { data, error } = await sb
    .from("organization_memberships")
    .select("profile_id, functions, profiles(id, name, avatar_url)")
    .eq("ministry_id", ministryId)
    .eq("organization_id", orgId);

  if (error) throw error;

  return (data || []).map((m: any) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return {
      id: p?.id || m.profile_id,
      name: p?.name || "Desconhecido",
      avatar_url: p?.avatar_url,
      roles: m.functions || []
    };
  }).filter((m: any) => m.id);
};

export const fetchMinistryRoles = async (
  ministryId: string,
  orgId: string
): Promise<string[]> => {
  const sb = getSupabase();
  if (!sb) throw new Error("NO_SUPABASE");

  const { data, error } = await sb
    .from("organization_ministries")
    .select("roles")
    .eq("id", ministryId)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (error) throw error;

  return data?.roles || [];
};

export const saveAssignmentV2 = async (
  ministryId: string,
  orgId: string,
  payload: {
    event_key: string;
    event_date: string;
    role: string;
    member_id: string;
    time?: string;
  }
) => {
  console.log("[saveAssignmentV2] START", { ministryId, orgId, payload });

  const sb = getSupabase();
  if (!sb) throw new Error("NO_SUPABASE");

  let ruleQuery = sb
    .from('event_rules')
    .select('id')
    .eq('organization_id', orgId)
    .eq('ministry_id', ministryId);

  const payloadTime = (payload as any).time;
  if (payloadTime) {
    ruleQuery = ruleQuery.eq('time', payloadTime);
  } else {
    ruleQuery = ruleQuery.eq('id', payload.event_key);
  }

  const { data: rule } = await ruleQuery.maybeSingle();

  const { data, error } = await sb
    .from("schedule_assignments")
    .upsert(
      {
        organization_id: orgId,
        ministry_id: ministryId,
        event_id: rule?.id ?? null,
        event_key: payload.event_key,
        event_date: payload.event_date,
        role: payload.role,
        member_id: payload.member_id,
        confirmed: false
      },
      {
        onConflict: "event_key,event_date,role"
      }
    )
    .select();

  console.log("[saveAssignmentV2] DB RESPONSE", { data, error });

  if (error) {
    console.error("[saveAssignmentV2] ERROR", error);
    throw error;
  }

  console.log("[saveAssignmentV2] SUCCESS");
};

export const removeAssignmentV2 = async (
  ministryId: string,
  orgId: string,
  key: {
    event_key: string;
    event_date: string;
    role: string;
  }
) => {
  console.log("[removeAssignmentV2] START", { ministryId, orgId, key });

  const sb = getSupabase();
  if (!sb) throw new Error("NO_SUPABASE");

  const { data, error } = await sb
    .from("schedule_assignments")
    .delete()
    .eq("organization_id", orgId)
    .eq("ministry_id", ministryId)
    .eq("event_key", key.event_key)
    .eq("event_date", key.event_date)
    .eq("role", key.role)
    .select();

  console.log("[removeAssignmentV2] DB RESPONSE", { data, error });

  if (error) {
    console.error("[removeAssignmentV2] ERROR", error);
    throw error;
  }

  console.log("[removeAssignmentV2] SUCCESS");
};

export const generateOccurrencesV2 = (
  rules: EventRuleV2[],
  year: number,
  month: number
): OccurrenceV2[] => {
  const occurrences: OccurrenceV2[] = [];
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);

  for (const rule of rules) {
    if (rule.type === "single" && rule.date) {
      const d = new Date(rule.date + "T12:00:00");
      if (d.getFullYear() === year && d.getMonth() + 1 === month) {
        occurrences.push({
          ruleId: rule.id,
          date: rule.date,
          time: rule.time,
          title: rule.title,
          iso: `${rule.date}T${rule.time}`
        });
      }
    }

    if (rule.type === "weekly") {
      const cur = new Date(start);
      while (cur <= end) {
        if (cur.getDay() === rule.weekday) {
          const dateStr = cur.toISOString().split("T")[0];
          occurrences.push({
            ruleId: rule.id,
            date: dateStr,
            time: rule.time,
            title: rule.title,
            iso: `${dateStr}T${rule.time}`
          });
        }
        cur.setDate(cur.getDate() + 1);
      }
    }
  }

  return occurrences.sort((a, b) => a.iso.localeCompare(b.iso));
};

export const fetchNextEventTeam = async (ministryId: string, orgId: string) => {
  const sb = getSupabase();
  if (!sb) return { date: null, team: [] };

  const today = new Date().toISOString().split('T')[0];

  // 1. Buscar o próximo evento
  const { data: nextEvents } = await sb
      .from('schedule_assignments')
      .select('event_date')
      .eq('organization_id', orgId)
      .eq('ministry_id', ministryId)
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .limit(1);

  if (!nextEvents || nextEvents.length === 0) return { date: null, team: [] };

  const nextDate = nextEvents[0].event_date;

  // 2. Buscar TODOS assignments desse dia
  const { data: assignments } = await sb
      .from('schedule_assignments')
      .select(`
          role,
          member_id,
          profiles(name)
      `)
      .eq('organization_id', orgId)
      .eq('ministry_id', ministryId)
      .eq('event_date', nextDate);

  // 3. Mapear para estrutura
  const team = (assignments || []).map((a: any) => ({
      role: a.role,
      memberId: a.member_id,
      memberName: a.profiles?.name || 'Membro'
  }));

  return { date: nextDate, team };
};

export interface NextEventCardData {
  event: {
    id: string;
    title: string;
    iso: string;
    dateDisplay: string;
    time: string;
    type?: 'weekly' | 'single';
  };
  members: {
    role: string;
    memberId: string;
    memberName: string;
    assignmentKey: string;
    confirmed: boolean;
  }[];
}

export const fetchNextEventCardData = async (
  ministryId: string,
  orgId: string
): Promise<NextEventCardData | null> => {
  const sb = getSupabase();
  if (!sb) return null;

  const today = new Date().toISOString().split('T')[0];

  const { data: nextAssignment, error: nextAssignmentError } = await sb
    .from('schedule_assignments')
    .select('event_id, event_key, event_date')
    .eq('organization_id', orgId)
    .eq('ministry_id', ministryId)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .order('event_key', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextAssignmentError) throw nextAssignmentError;
  console.log('NEXT EVENT ASSIGNMENT', nextAssignment);
  if (!nextAssignment?.event_key || !nextAssignment?.event_date) return null;
  console.log('NEXT EVENT EVENT_ID USED', nextAssignment.event_id);

  const eventRule = nextAssignment.event_id
    ? (await sb
        .from('event_rules')
        .select('title, time, type')
        .eq('id', nextAssignment.event_id)
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .maybeSingle()).data
    : null;

  const time = eventRule?.time || '00:00';
  const iso = `${nextAssignment.event_date}T${time}`;
  const eventDate = new Date(iso);
  const dateDisplay = eventDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit'
  });

  const assignments = nextAssignment.event_id
    ? (await sb
        .from('schedule_assignments')
        .select('event_id, event_key, event_date, role, member_id, confirmed, profiles(name)')
        .eq('event_id', nextAssignment.event_id)
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)).data
    : [];

  console.log('NEXT EVENT MEMBERS RAW', assignments?.length ?? 0);
  console.log('NEXT EVENT MEMBERS COUNT', assignments?.length ?? 0);

  const eventId = nextAssignment.event_id || `${nextAssignment.event_key}_${nextAssignment.event_date}`;

  const dedupedMembersMap = new Map<string, any>();

  (assignments || []).forEach((a: any) => {
    const profile = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
    const assignmentKey = `${a.event_key}_${a.event_date}_${a.role}`;
    const dedupeKey = `${a.event_id || nextAssignment.event_id || 'unknown'}_${a.role || 'unknown'}_${a.member_id || 'unknown'}`;

    if (!dedupedMembersMap.has(dedupeKey)) {
      dedupedMembersMap.set(dedupeKey, {
        role: a.role,
        memberId: a.member_id,
        memberName: profile?.name || 'Membro',
        assignmentKey,
        confirmed: !!a.confirmed
      });
    }
  });

  const members = Array.from(dedupedMembersMap.values());
  console.log('NEXT EVENT MEMBERS DEDUPED', members.length);

  const payload = {
    event: {
      id: eventId,
      title: eventRule?.title || 'Evento',
      iso,
      dateDisplay,
      time,
      type: eventRule?.type
    },
    members
  };

  console.log('NEXT EVENT FINAL PAYLOAD', payload);
  return payload;
};
