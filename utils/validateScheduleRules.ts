interface AssignmentLike {
  member_id: string;
  event_date: string;
  role: string;
}

interface ScheduleRuleLike {
  role_a: string;
  role_b: string;
  allow: boolean;
}

export function validateScheduleRules({
  memberId,
  role,
  eventDate,
  assignments,
  rules
}: {
  memberId: string;
  role: string;
  eventDate: string;
  assignments: AssignmentLike[];
  rules: ScheduleRuleLike[];
}) {
  const sameDayRoles = assignments
    .filter(a =>
      a.member_id === memberId &&
      a.event_date === eventDate
    )
    .map(a => a.role);

  for (const rule of rules) {
    if (rule.role_a === role && sameDayRoles.includes(rule.role_b)) {
      if (rule.allow === false) {
        return false;
      }
    }

    if (rule.role_b === role && sameDayRoles.includes(rule.role_a)) {
      if (rule.allow === false) {
        return false;
      }
    }
  }

  return true;
}
