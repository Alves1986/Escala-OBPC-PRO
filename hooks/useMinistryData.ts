
import { useState, useEffect, useMemo } from 'react';
import { User, ScheduleMap, AttendanceMap, AvailabilityMap, AppNotification, Announcement, SwapRequest, RepertoireItem, TeamMemberProfile, MemberMap, Role, GlobalConflictMap, AvailabilityNotesMap, DEFAULT_ROLES } from '../types';
import { useMinistryQueries } from './useMinistryQueries';
import { useQueryClient } from '@tanstack/react-query';

export function useMinistryData(ministryId: string | null, currentMonth: string, currentUser: User | null) {
  const mid = ministryId || 'midia';
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

  // --- Derived State (Transforming Query Data to match old hook interface) ---
  
  const ministryTitle = settingsQuery.data?.displayName || (mid.charAt(0).toUpperCase() + mid.slice(1));
  
  const roles: Role[] = useMemo(() => {
      let r = settingsQuery.data?.roles || [];
      if (r.length === 0) {
          const cleanId = mid.trim().toLowerCase();
          r = DEFAULT_ROLES[cleanId] || DEFAULT_ROLES['default'] || [];
      }
      return r;
  }, [settingsQuery.data, mid]);

  const availabilityWindow = useMemo(() => ({
      start: settingsQuery.data?.availabilityStart,
      end: settingsQuery.data?.availabilityEnd
  }), [settingsQuery.data]);

  // Setters wrappers that trigger refetches or optimistic updates
  // In a full refactor, components would use useMutation directly.
  // Here we provide "fake" setters that invalidate queries to refresh data.

  const refreshData = async () => {
      await queryClient.invalidateQueries({ predicate: (query) => 
          query.queryKey[0] === 'schedule' || 
          query.queryKey[0] === 'settings' || 
          query.queryKey[0] === 'members' ||
          query.queryKey[0] === 'audit' ||
          query.queryKey[0] === 'conflicts'
      });
  };

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
    globalConflicts: conflictsQuery.data || {}, // New
    auditLogs: auditLogsQuery.data || [], // New
    roles,
    ministryTitle,
    availabilityWindow,
    isLoading,
    refreshData,
    
    // Legacy setters (No-ops or re-implementations)
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
