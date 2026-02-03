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

export const fetchAssignmentsV2 = async (
  ministryId: string,
  orgId: string,
  monthStr: string
): Promise<AssignmentV2[]> => {
  const sb = getSupabase();
  if (!sb) throw new Error("NO_SUPABASE");

  const { data, error } = await sb
    .from("schedule_assignments")
    .select("id,event_key,event_date,role,member_id,confirmed,profiles(name)")
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

export const saveAssignmentV2 = async (
  ministryId: string,
  orgId: string,
  payload: {
    event_key: string;
    event_date: string;
    role: string;
    member_id: string;
  }
) => {
  const sb = getSupabase();
  if (!sb) throw new Error("NO_SUPABASE");

  console.log("UPSERT ASSIGNMENT", payload);

  const { error } = await sb
    .from("schedule_assignments")
    .upsert(
      {
        organization_id: orgId,
        ministry_id: ministryId,
        event_key: payload.event_key,
        event_date: payload.event_date,
        role: payload.role,
        member_id: payload.member_id,
        confirmed: false
      },
      {
        onConflict: "event_key,event_date,role"
      }
    );

  if (error) {
    console.error("UPSERT ERROR", error);
    throw error;
  }

  console.log("UPSERT OK");
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
  const sb = getSupabase();
  if (!sb) throw new Error("NO_SUPABASE");

  console.log("DELETE ASSIGNMENT", key);

  const { error } = await sb
    .from("schedule_assignments")
    .delete()
    .eq("organization_id", orgId)
    .eq("ministry_id", ministryId)
    .eq("event_key", key.event_key)
    .eq("event_date", key.event_date)
    .eq("role", key.role);

  if (error) {
    console.error("DELETE ERROR", error);
    throw error;
  }

  console.log("DELETE OK");
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
