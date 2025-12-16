
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Supabase from '../services/supabaseService';
import { ScheduleMap, TeamMemberProfile, MemberMap, MinistrySettings } from '../types';

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
  ranking: (mid: string) => ['ranking', mid]
};

export function useMinistryQueries(ministryId: string, currentMonth: string, user: any) {
  const queryClient = useQueryClient();
  const enabled = !!ministryId && !!user;

  // 1. Settings & Roles
  const settingsQuery = useQuery({
    queryKey: keys.settings(ministryId),
    queryFn: () => Supabase.fetchMinistrySettings(ministryId),
    enabled
  });

  // 2. Schedule (Events & Assignments)
  const scheduleQuery = useQuery({
    queryKey: keys.schedule(ministryId, currentMonth),
    queryFn: () => Supabase.fetchMinistrySchedule(ministryId, currentMonth),
    enabled
  });

  // 3. Members
  const membersQuery = useQuery({
    queryKey: keys.members(ministryId),
    queryFn: () => Supabase.fetchMinistryMembers(ministryId),
    enabled
  });

  // 4. Availability
  const availabilityQuery = useQuery({
    queryKey: keys.availability(ministryId),
    queryFn: () => Supabase.fetchMinistryAvailability(ministryId),
    enabled
  });

  // 5. Notifications
  const notificationsQuery = useQuery({
    queryKey: keys.notifications(user?.allowedMinistries || [ministryId], user?.id || ''),
    queryFn: () => Supabase.fetchNotificationsSQL(user?.allowedMinistries || [ministryId], user?.id || ''),
    enabled: !!user?.id
  });

  // 6. Announcements
  const announcementsQuery = useQuery({
    queryKey: keys.announcements(ministryId),
    queryFn: () => Supabase.fetchAnnouncementsSQL(ministryId),
    enabled
  });

  // 7. Swap Requests
  const swapsQuery = useQuery({
    queryKey: keys.swapRequests(ministryId),
    queryFn: () => Supabase.fetchSwapRequests(ministryId),
    enabled
  });

  // 8. Repertoire
  const repertoireQuery = useQuery({
    queryKey: keys.repertoire(ministryId),
    queryFn: () => Supabase.fetchRepertoire(ministryId),
    enabled
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
    isLoading: settingsQuery.isLoading || scheduleQuery.isLoading || membersQuery.isLoading
  };
}

export function useScheduleMutations(ministryId: string, currentMonth: string) {
  const queryClient = useQueryClient();

  const updateAssignment = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      // Optimistic update logic is complex here due to bulk checks, keeping it simple:
      return Supabase.saveScheduleAssignment(ministryId, key, value);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.schedule(ministryId, currentMonth) });
    }
  });

  const toggleAttendance = useMutation({
    mutationFn: (key: string) => Supabase.toggleAssignmentConfirmation(ministryId, key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.schedule(ministryId, currentMonth) });
    }
  });

  return { updateAssignment, toggleAttendance };
}
