import { getSupabase } from './supabase/client';
import { loadScheduleRules, validateScheduleConflict, ScheduleRoleRule } from './scheduleRules';
import { fetchMemberAvailabilityV2 } from './supabase/availability';
import { fetchMembersV2, AssignmentV2 } from './scheduleServiceV2';

export interface AutoSchedulerEvent {
  date: string;
  ruleId: string;
  roles: string[];
}

export interface AutoSchedulerMember {
  id: string;
  functions: string[];
}

export interface AvailabilityItem {
  member_id: string;
  date: string;
  available: boolean;
}

interface GenerateScheduleParams {
  organizationId: string;
  ministryId: string;
  events: AutoSchedulerEvent[];
  members: AutoSchedulerMember[];
  assignments: AssignmentV2[];
  rules: ScheduleRoleRule[];
  availability: AvailabilityItem[];
}

const monthFromDate = (date: string) => date.slice(0, 7);

export function isAvailable(memberId: string, date: string, availability: AvailabilityItem[]) {
  const day = availability.find(a => a.member_id === memberId && a.date === date);
  if (!day) return true;
  return day.available !== false;
}

export function alreadyAssignedSameDay(memberId: string, date: string, assignments: Array<{ member_id: string; event_date: string }>) {
  return assignments.some(a => a.member_id === memberId && a.event_date === date);
}

export function sortByWorkload(members: AutoSchedulerMember[], assignments: Array<{ member_id: string }>) {
  return [...members].sort((a, b) => {
    const countA = assignments.filter(x => x.member_id === a.id).length;
    const countB = assignments.filter(x => x.member_id === b.id).length;
    return countA - countB;
  });
}

export function validateRules(
  memberId: string,
  role: string,
  date: string,
  assignments: Array<{ member_id: string; event_date: string; role: string }>,
  rules: ScheduleRoleRule[]
) {
  const result = validateScheduleConflict({
    memberId,
    role,
    date,
    assignments,
    rules
  });

  return result.valid;
}

export async function generateSchedule({
  organizationId,
  ministryId,
  events,
  members,
  assignments,
  rules,
  availability
}: GenerateScheduleParams) {
  const _ctx = { organizationId, ministryId };
  if (!_ctx.organizationId || !_ctx.ministryId) return [];

  const newAssignments: Array<{ member_id: string; role: string; event_date: string; event_rule_id: string }> = [];

  for (const event of events) {
    const roles = event.roles;

    for (const role of roles) {
      const candidates = members
        .filter(m => m.functions.includes(role))
        .filter(m => isAvailable(m.id, event.date, availability))
        .filter(m => !alreadyAssignedSameDay(m.id, event.date, newAssignments));

      const sorted = sortByWorkload(candidates, [...assignments, ...newAssignments]);

      const chosen = sorted.find(member =>
        validateRules(member.id, role, event.date, newAssignments, rules)
      );

      if (chosen) {
        newAssignments.push({
          member_id: chosen.id,
          role,
          event_date: event.date,
          event_rule_id: event.ruleId
        });
      }
    }
  }

  return newAssignments;
}

export async function checkExistingSchedule(organizationId: string, ministryId: string, month: string) {
  const sb = getSupabase();
  if (!sb) throw new Error('NO_SUPABASE');

  const { count, error } = await sb
    .from('schedule_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('ministry_id', ministryId)
    .like('event_date', `${month}%`);

  if (error) throw error;
  return (count || 0) > 0;
}

export async function isScheduleLocked(organizationId: string, ministryId: string, month: string) {
  const sb = getSupabase();
  if (!sb) throw new Error('NO_SUPABASE');

  const { data, error } = await sb
    .from('schedule_backups')
    .select('locked')
    .eq('organization_id', organizationId)
    .eq('ministry_id', ministryId)
    .eq('month_ref', month)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return false;
  return !!data?.locked;
}

export async function createScheduleBackup(organizationId: string, ministryId: string, month: string) {
  const sb = getSupabase();
  if (!sb) throw new Error('NO_SUPABASE');

  const { data: existing, error: existingError } = await sb
    .from('schedule_assignments')
    .select('event_rule_id,event_date,role,member_id,confirmed')
    .eq('organization_id', organizationId)
    .eq('ministry_id', ministryId)
    .like('event_date', `${month}%`);

  if (existingError) throw existingError;

  const payload = {
    organization_id: organizationId,
    ministry_id: ministryId,
    month_ref: month,
    assignments: existing || []
  };

  const { error } = await sb.from('schedule_backups').insert(payload);
  if (error) throw error;
}

export async function saveGeneratedSchedule(
  organizationId: string,
  ministryId: string,
  month: string,
  generated: Array<{ member_id: string; role: string; event_date: string; event_rule_id: string }>
) {
  const sb = getSupabase();
  if (!sb) throw new Error('NO_SUPABASE');

  const { error: deleteError } = await sb
    .from('schedule_assignments')
    .delete()
    .eq('organization_id', organizationId)
    .eq('ministry_id', ministryId)
    .like('event_date', `${month}%`);

  if (deleteError) throw deleteError;

  if (generated.length === 0) return;

  const rows = generated.map(item => ({
    organization_id: organizationId,
    ministry_id: ministryId,
    event_rule_id: item.event_rule_id,
    event_date: item.event_date,
    role: item.role,
    member_id: item.member_id,
    confirmed: false
  }));

  const { error: upsertError } = await sb
    .from('schedule_assignments')
    .upsert(rows, { onConflict: 'organization_id,ministry_id,event_rule_id,event_date,role' });

  if (upsertError) throw upsertError;
}

export async function buildAutoSchedulerInput(
  organizationId: string,
  ministryId: string,
  month: string,
  events: Array<{ id: string; iso: string }>,
  roles: string[]
) {
  const sb = getSupabase();
  if (!sb) throw new Error('NO_SUPABASE');

  const [membersRaw, rules, availabilityMap, existingAssignments] = await Promise.all([
    fetchMembersV2(ministryId, organizationId),
    loadScheduleRules(organizationId),
    fetchMemberAvailabilityV2(ministryId, organizationId),
    sb
      .from('schedule_assignments')
      .select('event_rule_id,event_date,role,member_id,confirmed')
      .eq('organization_id', organizationId)
      .eq('ministry_id', ministryId)
      .like('event_date', `${month}%`)
      .then(r => {
        if (r.error) throw r.error;
        return (r.data || []) as AssignmentV2[];
      })
  ]);

  const members: AutoSchedulerMember[] = membersRaw.map(m => ({
    id: m.id,
    functions: m.roles || []
  }));

  const availability: AvailabilityItem[] = [];
  Object.entries(availabilityMap.availability || {}).forEach(([memberId, dates]) => {
    dates
      .filter(d => /^\d{4}-\d{2}-\d{2}/.test(d))
      .forEach(rawDate => {
        availability.push({
          member_id: memberId,
          date: rawDate.slice(0, 10),
          available: true
        });
      });
  });

  const normalizedEvents: AutoSchedulerEvent[] = events
    .filter(e => monthFromDate(e.iso) === month)
    .map(e => {
      const date = e.iso.slice(0, 10);
      const [ruleId] = e.id.split('_');
      return {
        date,
        ruleId: ruleId || e.id,
        roles
      };
    });

  return {
    members,
    rules,
    availability,
    existingAssignments,
    normalizedEvents
  };
}
