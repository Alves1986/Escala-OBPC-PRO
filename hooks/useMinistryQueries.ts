
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Supabase from '../services/supabaseService';
import { ScheduleMap, TeamMemberProfile, MemberMap, MinistrySettings } from '../types';
import { useAppStore } from '../store/appStore';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Keys for caching
export const keys = {
  settings: (mid: string) => ['settings', mid],
  schedule: (mid: string, month: string) => ['schedule', mid, month],
  members: (mid: string) => ['members', mid],
  availability: (mid: string) => ['availability', mid],
  notifications: (mids: string[], uid: string) => ['notifications', { mids, uid }],
  announcements: (mid: string) => ['announcements', mid],
  swapRequests: (mid: string) => ['swaps', mid],
  repertoire: (mid: string) => ['repertoire', mid],
  globalConflicts: (mid: string, month: string) => ['conflicts', mid, month],
  ranking: (mid: string) => ['ranking', mid],
  auditLogs: (mid: string) => ['audit', mid] // New Key
};

export function useMinistryQueries(ministryId: string, currentMonth: string, user: any) {
  const queryClient = useQueryClient();
  const { isAppReady } = useAppStore();
  
  // STRICT: Only enable queries if ministryId is a valid UUID AND organizationId is present AND app is ready
  const isUUID = UUID_REGEX.test(ministryId || '');
  const orgId = user?.organizationId;
  
  // FIX: ERRO 1 - Só habilita queries se orgId existir e for válido e AppReady for true
  const enabled = !!ministryId && isUUID && !!user && !!orgId && isAppReady;

  // 1. Settings & Roles
  const settingsQuery = useQuery({
    queryKey: keys.settings(ministryId),
    queryFn: () => {
        if (!orgId) throw new Error("OrgId missing in queryFn");
        return Supabase.fetchMinistrySettings(ministryId, orgId);
    },
    enabled
  });

  // 2. Schedule (Events & Assignments)
  const scheduleQuery = useQuery({
    queryKey: keys.schedule(ministryId, currentMonth),
    queryFn: () => {
        if (!orgId) throw new Error("OrgId missing in queryFn");
        return Supabase.fetchMinistrySchedule(ministryId, currentMonth, orgId);
    },
    enabled
  });

  // 3. Members
  const membersQuery = useQuery({
    queryKey: keys.members(ministryId),
    queryFn: () => {
        if (!orgId) throw new Error("OrgId missing in queryFn");
        return Supabase.fetchMinistryMembers(ministryId, orgId);
    },
    enabled
  });

  // 4. Availability
  const availabilityQuery = useQuery({
    queryKey: keys.availability(ministryId),
    queryFn: () => {
        if (!orgId) throw new Error("OrgId missing in queryFn");
        return Supabase.fetchMinistryAvailability(ministryId, orgId);
    },
    enabled
  });

  // 5. Notifications
  const notificationsQuery = useQuery({
    queryKey: keys.notifications(user?.allowedMinistries || (enabled ? [ministryId] : []), user?.id || ''),
    queryFn: () => {
        if (!orgId) throw new Error("OrgId missing in queryFn");
        return Supabase.fetchNotificationsSQL(user?.allowedMinistries || [ministryId], user?.id || '', orgId);
    },
    enabled: !!user?.id && (user?.allowedMinistries?.length > 0 || enabled) && !!orgId && isAppReady
  });

  // 6. Announcements
  const announcementsQuery = useQuery({
    queryKey: keys.announcements(ministryId),
    queryFn: () => {
        if (!orgId) throw new Error("OrgId missing in queryFn");
        return Supabase.fetchAnnouncementsSQL(ministryId, orgId);
    },
    enabled
  });

  // 7. Swap Requests
  const swapsQuery = useQuery({
    queryKey: keys.swapRequests(ministryId),
    queryFn: () => {
        if (!orgId) throw new Error("OrgId missing in queryFn");
        return Supabase.fetchSwapRequests(ministryId, orgId);
    },
    enabled
  });

  // 8. Repertoire
  const repertoireQuery = useQuery({
    queryKey: keys.repertoire(ministryId),
    queryFn: () => {
        if (!orgId) throw new Error("OrgId missing in queryFn");
        return Supabase.fetchRepertoire(ministryId, orgId);
    },
    enabled
  });

  // 9. Global Conflicts
  const conflictsQuery = useQuery({
    queryKey: keys.globalConflicts(ministryId, currentMonth),
    queryFn: () => {
        if (!orgId) throw new Error("OrgId missing in queryFn");
        return Supabase.fetchGlobalSchedules(currentMonth, ministryId, orgId);
    },
    enabled
  });

  // 10. Audit Logs
  const auditLogsQuery = useQuery({
    queryKey: keys.auditLogs(ministryId),
    queryFn: () => {
        if (!orgId) throw new Error("OrgId missing in queryFn");
        return Supabase.fetchAuditLogs(ministryId, orgId);
    },
    enabled: enabled && user?.role === 'admin'
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
    isLoading: settingsQuery.isLoading || scheduleQuery.isLoading || membersQuery.isLoading
  };
}

export function useScheduleMutations(ministryId: string, currentMonth: string, orgId: string) {
  const queryClient = useQueryClient();

  const updateAssignment = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      if (!orgId) throw new Error("OrgId missing in mutation");
      return Supabase.saveScheduleAssignment(ministryId, orgId, key, value);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.schedule(ministryId, currentMonth) });
      queryClient.invalidateQueries({ queryKey: keys.auditLogs(ministryId) }); 
    }
  });

  const toggleAttendance = useMutation({
    mutationFn: (key: string) => {
        if (!orgId) throw new Error("OrgId missing in mutation");
        return Supabase.toggleAssignmentConfirmation(ministryId, orgId, key);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.schedule(ministryId, currentMonth) });
      queryClient.invalidateQueries({ queryKey: keys.auditLogs(ministryId) }); 
    }
  });

  return { updateAssignment, toggleAttendance };
}
