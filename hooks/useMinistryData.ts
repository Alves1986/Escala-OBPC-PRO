
import { useState, useEffect, useMemo } from 'react';
import { User, ScheduleMap, AttendanceMap, AvailabilityMap, AppNotification, Announcement, SwapRequest, RepertoireItem, TeamMemberProfile, MemberMap, Role, GlobalConflictMap, AvailabilityNotesMap, DEFAULT_ROLES } from '../types';
import { useMinistryQueries, keys } from './useMinistryQueries';
import { useQueryClient } from '@tanstack/react-query';
import { getSupabase } from '../services/supabaseService';

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

  // --- SUPABASE REALTIME INTEGRATION ---
  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !mid) return;

    // Create a single channel for this ministry context
    const channel = sb.channel(`ministry-live-${mid}`);

    channel
        // 1. SCHEDULE & EVENTS
        // Updates when an event is created/deleted/edited
        .on(
            'postgres_changes', 
            { event: '*', schema: 'public', table: 'events', filter: `ministry_id=eq.${mid}` }, 
            () => {
                queryClient.invalidateQueries({ queryKey: keys.schedule(mid, currentMonth) });
            }
        )
        // Updates when someone is assigned/removed/confirms (Assumes ministry_id exists on assignments or linked via trigger)
        // Compliance with "Filtro obrigatório: ministry_id" for Escala
        .on(
            'postgres_changes', 
            { event: '*', schema: 'public', table: 'schedule_assignments', filter: `ministry_id=eq.${mid}` }, 
            () => {
                queryClient.invalidateQueries({ queryKey: keys.schedule(mid, currentMonth) });
                queryClient.invalidateQueries({ queryKey: keys.auditLogs(mid) });
                queryClient.invalidateQueries({ queryKey: keys.ranking(mid) });
            }
        )
        // 2. NOTIFICATIONS
        // Updates when a new notification is sent
        // Compliance with "contexto" via ministry_id filter
        .on(
            'postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'notifications', filter: `ministry_id=eq.${mid}` }, 
            () => {
                // Invalidate all notifications queries to update the bell icon count
                queryClient.invalidateQueries({ queryKey: ['notifications'] });
            }
        )
        // 3. SWAPS (Extra UX improvement)
        .on(
            'postgres_changes', 
            { event: '*', schema: 'public', table: 'swap_requests', filter: `ministry_id=eq.${mid}` }, 
            () => {
                queryClient.invalidateQueries({ queryKey: keys.swapRequests(mid) });
            }
        )
        .subscribe();

    return () => {
        sb.removeChannel(channel);
    };
  }, [mid, currentMonth, queryClient]);

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
