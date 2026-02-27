import { getSupabase } from "./supabase/client";

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
  event_rule_id: string;
  event_date: string;
  role: string;
  member_id: string;
  confirmed: boolean;
  event_key: string; // Legacy compatibility
}

export interface OccurrenceV2 {
  ruleId: string;
  date: string;
  time: string;
  title: string;
  iso: string;
  event_key: string;
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
    .select('id,event_rule_id,event_date,role,member_id,confirmed,event_key,profiles(name)') // CORREÇÃO: Select atualizado
    .eq("ministry_id", ministryId)
    .eq("organization_id", orgId)
    .like("event_date", `${monthStr}%`);

  if (error) throw error;

  return (data || []).map((a: any) => ({
    id: a.id,
    event_rule_id: a.event_rule_id,
    event_date: a.event_date,
    role: a.role,
    member_id: a.member_id,
    confirmed: a.confirmed,
    event_key: a.event_key || `${a.event_date}_${a.event_rule_id}` // Compatibilidade
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
    .from("ministry_settings")
    .select("roles")
    .eq("ministry_id", ministryId)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (error) throw error;

  return data?.roles || [];
};

export const saveAssignmentV2 = async (
  ministryId: string,
  orgId: string,
  payload: {
    event_rule_id: string;
    event_date: string;
    role: string;
    member_id: string;
    event_key: string;
  }
) => {
  const sb = getSupabase();
  if (!sb) throw new Error("NO_SUPABASE");

  const eventKey =
    `${payload.event_rule_id}_${payload.event_date}_${payload.role}`;

  const { data, error } = await sb
    .from("schedule_assignments")
    .upsert(
      {
        organization_id: orgId,
        ministry_id: ministryId,
        event_key: eventKey,
        event_rule_id: payload.event_rule_id,
        event_date: payload.event_date,
        role: payload.role,
        member_id: payload.member_id,
        confirmed: false
      },
      {
        onConflict: "organization_id,ministry_id,event_rule_id,event_date,role"
      }
    )
    .select();

  if (error) throw error;
};

export const removeAssignmentV2 = async (
  ministryId: string,
  orgId: string,
  key: {
    event_rule_id: string;
    event_date: string;
    role: string;
  }
) => {
  const sb = getSupabase();
  if (!sb) throw new Error("NO_SUPABASE");

  const { error } = await sb
    .from("schedule_assignments")
    .delete()
    .eq("organization_id", orgId)
    .eq("ministry_id", ministryId)
    .eq("event_rule_id", key.event_rule_id)
    .eq("event_date", key.event_date)
    .eq("role", key.role);

  if (error) throw error;
};

// Helper Local Date (YYYY-MM-DD) sem UTC shift
const localDateString = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const generateOccurrencesV2 = (
  rules: EventRuleV2[],
  year: number,
  month: number
): OccurrenceV2[] => {
  const occurrences: OccurrenceV2[] = [];
  
  // Noon strategy to avoid DST issues
  const start = new Date(year, month - 1, 1, 12, 0, 0);
  const end = new Date(year, month, 0, 12, 0, 0);

  for (const rule of rules) {
    if (rule.type === "single" && rule.date) {
      const d = new Date(rule.date + "T12:00:00");
      if (d.getFullYear() === year && d.getMonth() + 1 === month) {
        occurrences.push({
          ruleId: rule.id,
          date: rule.date,
          time: rule.time,
          title: rule.title,
          iso: `${rule.date}T${rule.time}`,
          event_key: `${rule.date}_${rule.time}_${rule.id}`
        });
      }
    }

    if (rule.type === "weekly") {
      const cur = new Date(start);
      // Loop
      while (cur <= end) {
        // getDay() is local
        if (cur.getDay() === rule.weekday) {
          const dateStr = localDateString(cur);
          
          occurrences.push({
            ruleId: rule.id,
            date: dateStr,
            time: rule.time,
            title: rule.title,
            iso: `${dateStr}T${rule.time}`,
            event_key: `${dateStr}_${rule.time}_${rule.id}`
          });
        }
        cur.setDate(cur.getDate() + 1);
      }
    }
  }

  return occurrences.sort((a, b) => a.iso.localeCompare(b.iso));
};

export const fetchNextEventCardData = async (ministryId: string, orgId: string) => {
  const sb = getSupabase();
  if (!sb) return null;

  const today = new Date();
  const todayStr = localDateString(today); 

  const { data: assignments, error: assignError } = await sb
      .from('schedule_assignments')
      .select('event_rule_id, event_date')
      .eq('organization_id', orgId)
      .eq('ministry_id', ministryId)
      .gte('event_date', todayStr)
      .order('event_date', { ascending: true });

  if (assignError || !assignments || assignments.length === 0) {
      return null;
  }

  const ruleIds = [...new Set(assignments.map((a: any) => a.event_rule_id))];

  const { data: rules } = await sb
      .from('event_rules')
      .select('id, title, time, type')
      .in('id', ruleIds);

  const rulesMap = new Map(rules?.map((r: any) => [r.id, r]));

  const candidates = assignments.map((a: any) => {
      const rule = rulesMap.get(a.event_rule_id) as any;
      if (!rule) return null; 

      const dateTimeStr = `${a.event_date}T${rule.time}`;
      const eventDateObj = new Date(dateTimeStr);

      return {
          assignment: a,
          rule: rule,
          dateObj: eventDateObj,
          iso: dateTimeStr
      };
  })
  .filter((c: any) => c !== null)
  .filter((c: any) => c.dateObj >= new Date(Date.now() - 2 * 60 * 60 * 1000))
  .sort((a: any, b: any) => a.dateObj.getTime() - b.dateObj.getTime());

  if (candidates.length === 0) return null;

  const nextEvent = candidates[0];
  if (!nextEvent) return null;

  const { data: membersData } = await sb
      .from('schedule_assignments')
      .select(`
          role,
          member_id,
          confirmed,
          profiles ( id, name, avatar_url )
      `)
      .eq('organization_id', orgId)
      .eq('ministry_id', ministryId)
      .eq('event_rule_id', nextEvent.assignment.event_rule_id)
      .eq('event_date', nextEvent.assignment.event_date);

  const members = (membersData || []).map((m: any) => ({
      role: m.role,
      memberId: m.member_id,
      name: m.profiles?.name || 'Membro',
      avatarUrl: m.profiles?.avatar_url,
      confirmed: m.confirmed,
      key: `${nextEvent.iso}_${m.role}`
  }));

  return {
      event: {
          id: nextEvent.rule.id,
          date: nextEvent.assignment.event_date,
          time: nextEvent.rule.time,
          title: nextEvent.rule.title,
          iso: nextEvent.iso,
          type: nextEvent.rule.type
      },
      members: members
  };
};

export const fetchNextEventTeam = async (ministryId: string, orgId: string) => {
    const data = await fetchNextEventCardData(ministryId, orgId);
    if (!data) return { date: null, team: [] };
    
    return {
        date: data.event.date,
        team: data.members.map(m => ({
            role: m.role,
            memberId: m.memberId,
            memberName: m.name
        }))
    };
};