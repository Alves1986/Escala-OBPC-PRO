import { getSupabase } from './supabase/client';

export interface ScheduleRoleRule {
  organization_id: string;
  role_a: string;
  role_b: string;
  allow: boolean;
}

interface AssignmentLike {
  member_id?: string | null;
  event_date?: string | null;
  role?: string | null;
}

interface ValidateScheduleConflictParams {
  memberId: string;
  role: string;
  date: string;
  assignments: AssignmentLike[];
  rules: ScheduleRoleRule[];
}

export async function loadScheduleRules(organizationId: string): Promise<ScheduleRoleRule[]> {
  const sb = getSupabase();
  if (!sb || !organizationId) return [];

  const { data, error } = await sb
    .from('schedule_role_rules')
    .select('*')
    .eq('organization_id', organizationId);

  if (error) {
    console.error('Erro ao carregar regras', error);
    return [];
  }

  return (data || []) as ScheduleRoleRule[];
}

export function validateScheduleConflict({
  memberId,
  role,
  date,
  assignments,
  rules
}: ValidateScheduleConflictParams) {
  if (!rules || rules.length === 0) {
    return { valid: true };
  }

  const rolesSameDay = assignments
    .filter(a => a.member_id === memberId && (a.event_date || '').slice(0, 10) === date)
    .map(a => a.role)
    .filter((r): r is string => !!r);

  for (const rule of rules) {
    if (rule.role_a === role && rolesSameDay.includes(rule.role_b)) {
      if (rule.allow === false) {
        return {
          valid: false,
          message: `Conflito: ${rule.role_a} não pode ser escalado com ${rule.role_b}`
        };
      }
    }

    if (rule.role_b === role && rolesSameDay.includes(rule.role_a)) {
      if (rule.allow === false) {
        return {
          valid: false,
          message: `Conflito: ${rule.role_b} não pode ser escalado com ${rule.role_a}`
        };
      }
    }
  }

  return { valid: true };
}
