
import { useState, useEffect, useMemo } from 'react';
import { User, ScheduleMap, AttendanceMap, AvailabilityMap, AppNotification, Announcement, SwapRequest, RepertoireItem, TeamMemberProfile, MemberMap, Role, GlobalConflictMap, AvailabilityNotesMap, DEFAULT_ROLES } from '../types';
import { useMinistryQueries, keys } from './useMinistryQueries';
import { useQueryClient } from '@tanstack/react-query';
import { getSupabase } from '../services/supabaseService';
import { useAppStore } from '../store/appStore';

export function useMinistryData(ministryId: string | null, currentMonth: string, currentUser: User | null) {
  // STRICT: No fallback to 'midia' or slugs.
  // If ministryId is null or not a UUID, the queries will be disabled in useMinistryQueries
  const mid = ministryId || ''; 
  const orgId = currentUser?.organizationId || '';
  
  const {
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
    isLoading
  } = useMinistryQueries(mid, currentMonth, currentUser);

  const queryClient = useQueryClient();
  const { setMinistryId, availableMinistries } = useAppStore();

  useEffect(() => {
      // Security Check: If user has lost access to this ministry, redirect
      if (currentUser && currentUser.allowedMinistries && !currentUser.isSuperAdmin && mid) {
          const hasAccess = currentUser.allowedMinistries.includes(mid);
          if (!hasAccess && currentUser.allowedMinistries.length > 0) {
              console.warn(`Acesso revogado ao ministério ${mid}. Redirecionando...`);
              const fallback = currentUser.allowedMinistries[0];
              setMinistryId(fallback);
          }
      }
  }, [mid, currentUser, setMinistryId]);

  // Derived Title
  const ministryTitle = settingsQuery.data?.displayName || (mid.length === 36 ? 'Carregando...' : (mid ? 'Ministério' : 'Selecione um Ministério'));
  
  const roles: Role[] = useMemo(() => {
      let r = settingsQuery.data?.roles || [];
      // Default roles only if we have a valid ministry ID but no specific settings
      if (r.length === 0 && mid) {
          const ministryDef = availableMinistries.find(m => m.id === mid);
          const code = ministryDef?.code || '';
          r = DEFAULT_ROLES[code] || DEFAULT_ROLES['default'] || [];
      }
      return r;
  }, [settingsQuery.data, mid, availableMinistries]);

  const availabilityWindow = useMemo(() => ({
      start: settingsQuery.data?.availabilityStart,
      end: settingsQuery.data?.availabilityEnd
  }), [settingsQuery.data]);

  const refreshData = async () => {
      await queryClient.invalidateQueries({ predicate: (query) => 
          query.queryKey[0] === 'schedule' || 
          query.queryKey[0] === 'settings' || 
          query.queryKey[0] === 'members' ||
          query.queryKey[0] === 'audit' ||
          query.queryKey[0] === 'conflicts'
      });
  };

  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !mid) return;

    // Only subscribe if mid is valid
    if (mid.length !== 36) return;

    const channel = sb.channel(`ministry-live-${mid}`);

    channel
        .on(
            'postgres_changes', 
            { event: '*', schema: 'public', table: 'events', filter: `ministry_id=eq.${mid}` }, 
            () => {
                queryClient.invalidateQueries({ queryKey: keys.schedule(mid, currentMonth, orgId) });
            }
        )
        .on(
            'postgres_changes', 
            { event: '*', schema: 'public', table: 'schedule_assignments', filter: `ministry_id=eq.${mid}` }, 
            () => {
                queryClient.invalidateQueries({ queryKey: keys.schedule(mid, currentMonth, orgId) });
                queryClient.invalidateQueries({ queryKey: keys.auditLogs(mid, orgId) });
                queryClient.invalidateQueries({ queryKey: keys.ranking(mid, orgId) });
            }
        )
        .on(
            'postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'notifications', filter: `ministry_id=eq.${mid}` }, 
            () => {
                queryClient.invalidateQueries({ queryKey: ['notifications'] });
            }
        )
        .on(
            'postgres_changes', 
            { event: '*', schema: 'public', table: 'swap_requests', filter: `ministry_id=eq.${mid}` }, 
            () => {
                queryClient.invalidateQueries({ queryKey: keys.swapRequests(mid, orgId) });
            }
        )
        .on(
            'postgres_changes', 
            { event: 'UPDATE', schema: 'public', table: 'ministry_settings', filter: `ministry_id=eq.${mid}` }, 
            () => {
                queryClient.invalidateQueries({ queryKey: keys.settings(mid, orgId) });
            }
        )
        .subscribe();

    return () => {
        sb.removeChannel(channel);
    };
  }, [mid, currentMonth, queryClient, orgId]);

  return {
    events: scheduleQuery.data?.events || [],
    schedule: scheduleQuery.data?.schedule || {},
    attendance: scheduleQuery.data?.attendance || {},
    membersMap: membersQuery.data?.memberMap || {},
    publicMembers: membersQuery.data?.publicList || [],
    availability: availabilityQuery.data?.availability || {},
    availabilityNotes: availabilityQuery.data?.notes || {},
    notifications: notificationsQuery.data || [],
    announcements: announcementsQuery.data || [],
    repertoire: repertoireQuery.data || [],
    swapRequests: swapsQuery.data || [],
    globalConflicts: conflictsQuery.data || {}, 
    auditLogs: auditLogsQuery.data || [], 
    roles,
    ministryTitle,
    availabilityWindow,
    isLoading,
    refreshData,
    setEvents: () => refreshData(), 
    setSchedule: () => refreshData(),
    setAttendance: () => refreshData(),
    setPublicMembers: () => refreshData(),
    setAvailability: () => refreshData(),
    setNotifications: () => refreshData(),
    setRepertoire: () => refreshData(),
    setMinistryTitle: () => refreshData(),
    setAvailabilityWindow: () => refreshData()
  };
}
