import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Supabase from '../services/supabaseService';
import { fetchEventRules } from '../infra/supabase/fetchEventRules'; // Importação da Camada Infra
import { fetchNextEventCardData } from '../services/scheduleServiceV2'; // New Service
import { useAppStore } from '../store/appStore';

// Keys for caching
export const keys = {
  settings: (mid: string, oid: string) => ['settings', mid, oid],
  assignments: (mid: string, month: string, oid: string) => ['assignments', mid, month, oid],
  rules: (mid: string, oid: string) => ['rules', mid, oid],
  members: (mid: string, oid: string) => ['members', mid, oid],
  availability: (mid: string, oid: string) => ['availability', mid, oid],
  notifications: (mids: string[], uid: string, oid: string) => ['notifications', { mids, uid, oid }],
  announcements: (mid: string, oid: string) => ['announcements', mid, oid],
  swapRequests: (mid: string, oid: string) => ['swaps', mid, oid],
  repertoire: (mid: string, oid: string) => ['repertoire', mid, oid],
  globalConflicts: (mid: string, month: string, oid: string) => ['conflicts', mid, month, oid],
  ranking: (mid: string, oid: string) => ['ranking', mid, oid],
  auditLogs: (mid: string, oid: string) => ['audit', mid, oid],
  nextEvent: (mid: string, oid: string) => ['nextEvent', mid, oid] // NEW Key
};

export function useMinistryQueries(ministryId: string, currentMonth: string, user: any) {
  const queryClient = useQueryClient();
  const orgId = user?.organizationId || '';
  
  const isQueryEnabled = Boolean(ministryId && orgId);
  const isScheduleEnabled = Boolean(ministryId && orgId && currentMonth);

  // 1. Settings & Roles
  const settingsQuery = useQuery({
    queryKey: keys.settings(ministryId, orgId),
    queryFn: () => Supabase.fetchMinistrySettings(ministryId, orgId),
    enabled: isQueryEnabled
  });

  // 2. Assignments (Schedule Map)
  const assignmentsQuery = useQuery({
    queryKey: keys.assignments(ministryId, currentMonth, orgId),
    queryFn: async () => {
      const { schedule, attendance } = await Supabase.fetchScheduleAssignments(ministryId, currentMonth, orgId);

      console.log("[ROOT_SERVICE_KEYS]", {
        month: currentMonth,
        keys: Object.keys(schedule),
        count: Object.keys(schedule).length
      });

      return {
        month: currentMonth,
        schedule,
        attendance
      };
    },
    enabled: isScheduleEnabled
  });

  // 3. Members
  const membersQuery = useQuery({
    queryKey: keys.members(ministryId, orgId),
    queryFn: () => Supabase.fetchMinistryMembers(ministryId, orgId),
    enabled: isQueryEnabled
  });

  // 4. Availability
  const availabilityQuery = useQuery({
    queryKey: keys.availability(ministryId, orgId),
    queryFn: () => Supabase.fetchMinistryAvailability(ministryId, orgId),
    enabled: isQueryEnabled
  });

  // 5. Notifications
  const notificationsQuery = useQuery({
    queryKey: keys.notifications(user?.allowedMinistries || (ministryId ? [ministryId] : []), user?.id || '', orgId),
    queryFn: () => Supabase.fetchNotificationsSQL(user?.allowedMinistries || [ministryId], user?.id || '', orgId),
    enabled: Boolean(user?.id && orgId)
  });

  // 6. Announcements
  const announcementsQuery = useQuery({
    queryKey: keys.announcements(ministryId, orgId),
    queryFn: () => Supabase.fetchAnnouncementsSQL(ministryId, orgId),
    enabled: isQueryEnabled
  });

  // 7. Swap Requests
  const swapsQuery = useQuery({
    queryKey: keys.swapRequests(ministryId, orgId),
    queryFn: () => Supabase.fetchSwapRequests(ministryId, orgId),
    enabled: isQueryEnabled
  });

  // 8. Repertoire
  const repertoireQuery = useQuery({
    queryKey: keys.repertoire(ministryId, orgId),
    queryFn: () => Supabase.fetchRepertoire(ministryId, orgId),
    enabled: isQueryEnabled
  });

  // 9. Global Conflicts
  const conflictsQuery = useQuery({
    queryKey: keys.globalConflicts(ministryId, currentMonth, orgId),
    queryFn: () => Supabase.fetchGlobalSchedules(currentMonth, ministryId, orgId),
    enabled: isScheduleEnabled
  });

  // 10. Audit Logs
  const auditLogsQuery = useQuery({
    queryKey: keys.auditLogs(ministryId, orgId),
    queryFn: () => Supabase.fetchAuditLogs(ministryId, orgId),
    enabled: isQueryEnabled && user?.role === 'admin'
  });

  // 11. Rules (New) - Agora usa a camada de infra correta
  const rulesQuery = useQuery({
    queryKey: keys.rules(ministryId, orgId),
    queryFn: () => fetchEventRules(ministryId, orgId),
    enabled: isQueryEnabled
  });

  // 12. Next Event (NEW)
  const nextEventQuery = useQuery({
    queryKey: keys.nextEvent(ministryId, orgId),
    queryFn: () => fetchNextEventCardData(ministryId, orgId),
    enabled: isQueryEnabled,
    retry: false,
    refetchOnWindowFocus: false
  });

  return {
    settingsQuery,
    assignmentsQuery,
    membersQuery,
    availabilityQuery,
    notificationsQuery,
    announcementsQuery,
    swapsQuery,
    repertoireQuery,
    conflictsQuery,
    auditLogsQuery,
    rulesQuery,
    nextEventQuery,
    isLoading: isQueryEnabled && (settingsQuery.isLoading || assignmentsQuery.isLoading || membersQuery.isLoading)
  };
}

export function useScheduleMutations(ministryId: string, currentMonth: string, orgId: string) {
  const queryClient = useQueryClient();

  const updateAssignment = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      // Disabled for now
      return false; 
    },
    onSuccess: () => {
      // No-op
    }
  });

  const toggleAttendance = useMutation({
    mutationFn: (key: string) => {
        // Disabled for now
        return Promise.resolve();
    },
    onSuccess: () => {
      // No-op
    }
  });

  return { updateAssignment, toggleAttendance };
}