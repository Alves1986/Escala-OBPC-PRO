
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Supabase from '../services/supabaseService';
import { useAppStore } from '../store/appStore';

// Keys for caching
export const keys = {
  settings: (mid: string, oid: string) => ['settings', mid, oid],
  schedule: (mid: string, month: string, oid: string) => ['schedule', mid, month, oid],
  members: (mid: string, oid: string) => ['members', mid, oid],
  availability: (mid: string, oid: string) => ['availability', mid, oid],
  notifications: (mids: string[], uid: string, oid: string) => ['notifications', { mids, uid, oid }],
  announcements: (mid: string, oid: string) => ['announcements', mid, oid],
  swapRequests: (mid: string, oid: string) => ['swaps', mid, oid],
  repertoire: (mid: string, oid: string) => ['repertoire', mid, oid],
  globalConflicts: (mid: string, month: string, oid: string) => ['conflicts', mid, month, oid],
  ranking: (mid: string, oid: string) => ['ranking', mid, oid],
  auditLogs: (mid: string, oid: string) => ['audit', mid, oid]
};

export function useMinistryQueries(ministryId: string, currentMonth: string, user: any) {
  const queryClient = useQueryClient();
  const orgId = user?.organizationId || '';
  
  // FIX CRÍTICO: Queries só rodam se houver IDs válidos.
  // Isso impede que o React Query cacheie arrays vazios ([]) prematuramente.
  const isQueryEnabled = Boolean(ministryId && orgId);
  const isScheduleEnabled = Boolean(ministryId && orgId && currentMonth);

  // 1. Settings & Roles
  const settingsQuery = useQuery({
    queryKey: keys.settings(ministryId, orgId),
    queryFn: () => Supabase.fetchMinistrySettings(ministryId, orgId),
    enabled: isQueryEnabled
  });

  // 2. Schedule (Events & Assignments)
  const scheduleQuery = useQuery({
    queryKey: keys.schedule(ministryId, currentMonth, orgId),
    queryFn: () => Supabase.fetchMinistrySchedule(ministryId, currentMonth, orgId),
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
    enabled: Boolean(user?.id && orgId) // Notifications depend on User ID + Org
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

  return {
    settingsQuery,
    scheduleQuery,
    membersQuery,
    availabilityQuery,
    notificationsQuery,
    announcementsQuery,
    swapsQuery,
    repertoireQuery,
    conflictsQuery,
    auditLogsQuery,
    isLoading: isQueryEnabled && (settingsQuery.isLoading || scheduleQuery.isLoading || membersQuery.isLoading)
  };
}

export function useScheduleMutations(ministryId: string, currentMonth: string, orgId: string) {
  const queryClient = useQueryClient();

  const updateAssignment = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      if (!orgId || !ministryId) throw new Error("Missing IDs");
      return Supabase.saveScheduleAssignment(ministryId, orgId, key, value);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.schedule(ministryId, currentMonth, orgId) });
      queryClient.invalidateQueries({ queryKey: keys.auditLogs(ministryId, orgId) }); 
    }
  });

  const toggleAttendance = useMutation({
    mutationFn: (key: string) => {
        if (!orgId || !ministryId) throw new Error("Missing IDs");
        return Supabase.toggleAssignmentConfirmation(ministryId, orgId, key);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.schedule(ministryId, currentMonth, orgId) });
      queryClient.invalidateQueries({ queryKey: keys.auditLogs(ministryId, orgId) }); 
    }
  });

  return { updateAssignment, toggleAttendance };
}
